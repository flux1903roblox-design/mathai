// The hourly cron ([triggers] crons = ["7 * * * *"] in wrangler.toml; scheduled() in index.js calls run()).
//
// Every hour: end plans whose time is over (past_due after the grace days, finished terms, trials, class licences and
// one-year family plans, canceled plans at their period end), expire open orders after 2 h, retry cancellations the
// provider has not confirmed (owner notice after 24 h), process the refund queue, and send pending notices.
//
// In the 03:00 hour in Jerusalem: reconcile the monthly plans whose period is over with the provider (extend only from
// the truth pulled from it, or end the plan), queue the one-year plan's end-date emails (30-45 days and 7 days ahead,
// trust spec TRUST-10 §2) and the licence-ending email (30 days ahead), purge what is no longer needed (spec §6.9, and the safety records), alert the owner when yesterday's
// safety events jumped, and queue the owner's daily summary when OWNER_DAILY_SUMMARY = "true". Each step runs on its
// own: one failing step never stops the others.
import { nowIso, addDays, daysAgo, dayOf, monthOf, hourOf, startOfDayIso, endOfDayIso } from './util.js';
import { limits } from './entitle.js';
import { retryCancels, processRefundQueue, prices, vatOf } from './billing.js';
import { purgeAccountsSql } from './account.js';
import { purgeFamilySql } from './family.js';
import { providerById } from './providers/index.js';
import { queueNotices, ownerNotice, ownerAlertUsd } from './spend.js';
import { flushNotices } from './email.js';
import { SUPPORT } from '../../shared/safety.js';
import { RETENTION } from '../../shared/retention.js';
import { qualityCounts, QUALITY_KEEP_DAYS } from './quality.js';

const DAY = 864e5;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const changes = (r) => (Array.isArray(r) ? r : [r]).reduce((n, x) => n + Number(x?.meta?.changes || 0), 0);
const auditStmt = (env, action, target, detail) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(nowIso(), 'cron', action, target, JSON.stringify(detail || {}));

/**
 * Plans whose time is over. The monthly plan, which renews by itself, is left to the provider's renewal events while it
 * is active; a one-year plan ends at its end like a licence (trust spec TRUST-10 §1): nothing is charged again.
 */
export async function endFinished(env) {
  const now = nowIso();
  const grace = addDays(now, -limits(env).graceDays);
  const r = await env.DB.batch([
    env.DB.prepare("UPDATE subscriptions SET status = 'ended', ended_reason = 'payment_failed', updated_at = ? WHERE status = 'past_due' AND current_period_end <= ?").bind(now, grace),
    env.DB.prepare(`UPDATE subscriptions SET status = 'ended', ended_reason = 'expired', updated_at = ?
      WHERE status = 'active' AND plan IN ('term', 'trial', 'class_year', 'family_year') AND current_period_end <= ?`).bind(now, now),
    env.DB.prepare("UPDATE subscriptions SET status = 'ended', ended_reason = COALESCE(ended_reason, 'canceled'), updated_at = ? WHERE status = 'canceled' AND current_period_end <= ?").bind(now, now),
  ]);
  return changes(r);
}

export const expireOrders = (env) => env.DB.prepare("UPDATE orders SET status = 'expired' WHERE status = 'open' AND expires_at < ?").bind(nowIso()).run();

/**
 * Monthly plans (the one plan that renews by itself; a one-year plan ends in endFinished) whose period is over with no
 * renewal event: ask the provider. Its pulled
 * truth may extend the plan (never shorten it) or end it. With no answer to go on (a provider without the API, or a
 * plan the provider does not know), an active plan ends once the grace days have passed as well, as a failed payment:
 * a late renewal event still brings it back (apply.js), and the family can subscribe again meanwhile.
 * A provider that cannot be reached is asked again the next night.
 */
export async function reconcile(env, { limit = 100 } = {}) {
  const now = nowIso();
  const grace = addDays(now, -limits(env).graceDays);
  // every renewing plan past its period, also one stored without the provider's subscription id (nothing can be pulled
  // for it, so it ends after the grace days like a plan the provider does not know, instead of staying 'active' forever)
  const due = await all(env, `SELECT * FROM subscriptions WHERE kind = 'family' AND plan = 'family_month'
    AND status IN ('active', 'past_due') AND current_period_end <= ? ORDER BY current_period_end LIMIT ?`, now, limit);
  const out = { checked: due.length, extended: 0, ended: 0, failed: 0 };
  for (const sub of due) {
    const provider = providerById(env, sub.provider);
    let truth = null;
    try { truth = provider && sub.provider_subscription_id ? await provider.fetchSubscription(env, sub) : null; } catch { out.failed++; continue; }
    const periodEnd = truth?.periodEnd && Number.isFinite(Date.parse(truth.periodEnd)) ? new Date(Date.parse(truth.periodEnd)).toISOString() : null;
    if (truth?.status === 'active' && periodEnd && periodEnd > sub.current_period_end && periodEnd > now) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE subscriptions SET current_period_start = current_period_end, current_period_end = MAX(current_period_end, ?),
          status = 'active', updated_at = ? WHERE id = ? AND status IN ('active', 'past_due')`).bind(periodEnd, now, sub.id),
        auditStmt(env, 'subscription.reconcile', `sub:${sub.id}`, { from: sub.current_period_end, to: periodEnd }),
      ]);
      out.extended++;
      continue;
    }
    let reason = null;
    if (truth?.status === 'canceled') reason = 'canceled';
    else if (truth?.status === 'ended') reason = 'expired';
    else if (sub.status === 'active' && sub.current_period_end <= grace) reason = 'payment_failed';
    if (!reason) continue; // past_due without news: the grace rule in endFinished decides
    await env.DB.batch([
      env.DB.prepare("UPDATE subscriptions SET status = 'ended', ended_reason = ?, updated_at = ? WHERE id = ? AND status IN ('active', 'past_due')").bind(reason, now, sub.id),
      auditStmt(env, 'subscription.reconcile', `sub:${sub.id}`, { ended: reason, pulled: !!truth }),
    ]);
    out.ended++;
  }
  return out;
}

/**
 * The one-year plan's end-date notice (trust spec TRUST-10 §2): the law asks for it 60 to 30 days before the end, so it
 * is queued on the first night inside 30-45 days (a missed night still lands in the window), and once more at 7 days.
 */
export const YEAR_ENDING_DAYS = Object.freeze({ from: 30, to: 45, last: 7 });
export const LICENCE_ENDING_DAYS = 30;
/**
 * The one-year plan's end-date emails, year_ending:<end> (30-45 days ahead) and year_ending_7:<end> (7 days ahead), to
 * the payer, with the price of a new year as it is now; and the licence-ending email 30 days ahead (to the buyer, or
 * else the teacher who last asked about the class). Each is queued once per period end: the notice key holds the date.
 */
export async function reminders(env) {
  const now = nowIso();
  const price = prices(env).family_year;
  const year = (kind, from, to) => env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
      SELECT id, '${kind}:' || current_period_end, account_id, json_object('periodEnd', current_period_end, 'priceAgorot', ?4, 'vatAgorot', ?5), ?1
      FROM subscriptions WHERE kind = 'family' AND plan = 'family_year' AND status = 'active' AND account_id IS NOT NULL
        AND current_period_end > ?2 AND current_period_end <= ?3`).bind(now, from, to, price, vatOf(env, price));
  const Y = YEAR_ENDING_DAYS;
  const r = await env.DB.batch([
    year('year_ending', addDays(now, Y.from), addDays(now, Y.to)),
    year('year_ending_7', now, addDays(now, Y.last)),
    env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
      SELECT id, 'licence_ending:' || current_period_end, recipient, json_object('until', current_period_end, 'classCode', class_code), ?1 FROM (
        SELECT s.id, s.current_period_end, s.class_code, COALESCE(s.account_id, (SELECT r.account_id FROM licence_requests r
          WHERE r.class_code = s.class_code AND r.account_id IS NOT NULL ORDER BY r.created_at DESC LIMIT 1)) AS recipient
        FROM subscriptions s WHERE s.kind = 'class' AND s.plan != 'trial' AND s.status = 'active'
          AND s.current_period_end > ?1 AND s.current_period_end <= ?2)
      WHERE recipient IS NOT NULL`).bind(now, addDays(now, LICENCE_ENDING_DAYS)),
  ]);
  return { yearEnding: changes(r[0]), yearEnding7: changes(r[1]), licence: changes(r[2]) };
}

/**
 * Old counters: daily (and hourly) rows after 35 days, monthly rows after 13 months (length(day) keeps them apart), and
 * the tutor's quality counts (ai_quality) after 400 days.
 */
export function purgeCountersSql(env, now = new Date()) {
  const [y, m] = monthOf(now).split('-').map(Number);
  const back = new Date(Date.UTC(y, m - 1 - 13, 1));
  const oldMonth = `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, '0')}`;
  return [
    env.DB.prepare('DELETE FROM ai_usage WHERE length(day) >= 10 AND day < ?').bind(daysAgo(35)),
    env.DB.prepare('DELETE FROM ai_usage WHERE length(day) = 7 AND day < ?').bind(oldMonth),
    env.DB.prepare('DELETE FROM ai_quality WHERE day < ?').bind(dayOf(new Date(now.getTime() - QUALITY_KEEP_DAYS * DAY))),
  ];
}

/** Retention (spec §6.9): notices 90 days after sending, expired orders after 30 days, spend after 400 days, the audit
 *  log after 2 years, provider events after 7 years. Payments are kept. */
export function purgeRecordsSql(env, now = new Date()) {
  const t = now.getTime();
  const iso = (days) => new Date(t - days * DAY).toISOString();
  return [
    env.DB.prepare('DELETE FROM notices WHERE (sent_at IS NOT NULL AND sent_at < ?1) OR (sent_at IS NULL AND tries >= 6 AND created_at < ?1)').bind(iso(90)),
    env.DB.prepare(`DELETE FROM orders WHERE status = 'expired' AND created_at < ?
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = orders.id)`).bind(iso(30)),
    env.DB.prepare('DELETE FROM ai_spend WHERE (length(period) = 10 AND period < ?) OR (length(period) = 7 AND period < ?)')
      .bind(dayOf(new Date(t - 400 * DAY)), monthOf(new Date(t - 400 * DAY))),
    env.DB.prepare('DELETE FROM audit_log WHERE at < ?').bind(iso(730)),
    env.DB.prepare('DELETE FROM billing_events WHERE received_at < ?').bind(iso(7 * 365 + 2)),
  ];
}

/**
 * Safety records (trust spec TRUST-4 §4.4, §4.5): safety events (counts, by Jerusalem day) after
 * RETENTION.safetyEventsDays, and reported answers after RETENTION.answerReportsDays.
 */
export function purgeSafetySql(env, now = new Date()) {
  const t = now.getTime();
  return [
    env.DB.prepare('DELETE FROM safety_events WHERE day < ?').bind(dayOf(new Date(t - RETENTION.safetyEventsDays * DAY))),
    env.DB.prepare('DELETE FROM answer_reports WHERE created_at < ?').bind(new Date(t - RETENTION.answerReportsDays * DAY).toISOString()),
  ];
}

export async function purge(env, now = new Date()) {
  const r = await env.DB.batch([...purgeCountersSql(env, now), ...purgeAccountsSql(env), ...purgeFamilySql(env), ...purgeRecordsSql(env), ...purgeSafetySql(env, now)]);
  return changes(r);
}

// ---------------------------------------------------------------- safety counts and the spike alert (TRUST-4 §4.4)
/** The kinds the owner's summary counts, in this order. */
export const SUMMARY_SAFETY = Object.freeze(['distress', 'pii_masked', 'output_blocked', 'refusal', 'user_report']);
/** Days the distress baseline is averaged over, and the rule's floor (one event never alerts while the average is 0). */
export const SPIKE_BASE_DAYS = 14;
export const SPIKE_DISTRESS_MIN = 3;
export const SPIKE_REPORTED_MIN = 10;

/** A day's safety counts: { distress, pii_masked, output_blocked, refusal, user_report }, each a number. */
export async function safetyCounts(env, day) {
  const rows = await all(env, 'SELECT kind, COUNT(*) AS n FROM safety_events WHERE day = ? GROUP BY kind', day);
  return Object.fromEntries(SUMMARY_SAFETY.map((k) => [k, Number(rows.find((r) => r.kind === k)?.n || 0)]));
}

/**
 * Yesterday (Jerusalem) against the rule: output_blocked + user_report of 10 or more, or distress at least
 * max(3, 3 × its daily average over the 14 days before yesterday). On a hit the owner gets one alert for that day
 * (owner:safety_spike:<day>), with the counts only. Runs every night, whether or not the daily summary is on.
 */
export async function safetySpike(env, now = new Date()) {
  const day = dayOf(new Date(now.getTime() - DAY));
  const counts = await safetyCounts(env, day);
  const from = dayOf(new Date(now.getTime() - (SPIKE_BASE_DAYS + 1) * DAY));
  const base = Number((await first(env, "SELECT COUNT(*) AS n FROM safety_events WHERE kind = 'distress' AND day >= ? AND day < ?", from, day))?.n || 0);
  const avg = base / SPIKE_BASE_DAYS;
  const reported = counts.output_blocked + counts.user_report >= SPIKE_REPORTED_MIN;
  const distress = counts.distress >= Math.max(SPIKE_DISTRESS_MIN, 3 * avg);
  if (!reported && !distress) return { day, alert: false };
  await queueNotices(env, [ownerNotice(day, `owner:safety_spike:${day}`, { ...counts, distressAvg: Math.round(avg * 10) / 10, reported, distressHigh: distress })]);
  return { day, alert: true };
}

/**
 * The owner's daily summary of yesterday (Jerusalem): spend by pool, free calls, plans started, cancelled and ended;
 * what needs a hand (unsynced cancels, manual refunds, odd provider events, open licence requests); and the invariant
 * checks: a running paid plan with no payment covering now, a paid order with no plan, spend over a budget.
 */
/** Days after which the owner is reminded to check the support numbers in shared/safety.js again (trust spec §3.6). */
export const SUPPORT_CHECK_DAYS = 330;
/** The reminder line when SUPPORT.checked is more than SUPPORT_CHECK_DAYS old on `now`, else null. */
export function supportCheckLine(now = new Date(), checked = SUPPORT.checked) {
  const at = Date.parse(`${checked}T00:00:00Z`);
  if (!Number.isFinite(at) || now.getTime() - at > SUPPORT_CHECK_DAYS * DAY) {
    return `מספרי העזרה בעוזר החכם נבדקו לאחרונה ב־${checked}. כדאי לבדוק שהם עדיין נכונים (shared/safety.js).`;
  }
  return null;
}

export async function dailySummary(env, now = new Date()) {
  const L = limits(env);
  const day = dayOf(new Date(now.getTime() - DAY));
  const month = monthOf(new Date(now.getTime() - DAY));
  const nowIsoStr = now.toISOString();
  // yesterday in Jerusalem, as UTC instants
  const startIso = startOfDayIso(day); const endIso = endOfDayIso(day);
  const spend = await all(env, 'SELECT pool, calls, nano_usd FROM ai_spend WHERE period = ? ORDER BY nano_usd DESC', day);
  const pool = (p) => spend.find((x) => x.pool === p) || null;
  const allRow = pool('all'); const freeRow = pool('free'); const trialRow = pool('trial'); const careRow = pool('care');
  const count = async (sql, ...a) => Number((await first(env, sql, ...a))?.n || 0);
  const params = {
    day,
    allUsd: Number(allRow?.nano_usd || 0) / 1e9,
    freeCalls: Number(freeRow?.calls || 0),
    // care replies (a message that read as distress): never counted against anyone's questions, so shown on their own
    careCalls: Number(careRow?.calls || 0),
    careUsd: Math.round(Number(careRow?.nano_usd || 0) / 1e7) / 100,
    spend: spend.filter((x) => x.pool !== 'all' && !x.pool.startsWith('kind:')).slice(0, 12).map((x) => ({ pool: x.pool, calls: x.calls, usd: Math.round(x.nano_usd / 1e7) / 100 })),
    newPlans: await count('SELECT COUNT(*) AS n FROM subscriptions WHERE created_at >= ? AND created_at < ?', startIso, endIso),
    canceled: await count('SELECT COUNT(*) AS n FROM subscriptions WHERE cancel_requested_at >= ? AND cancel_requested_at < ?', startIso, endIso),
    ended: await count("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'ended' AND updated_at >= ? AND updated_at < ?", startIso, endIso),
    unsyncedCancels: await count('SELECT COUNT(*) AS n FROM subscriptions WHERE cancel_requested_at IS NOT NULL AND cancel_synced_at IS NULL'),
    manualRefunds: await count('SELECT COUNT(*) AS n FROM refund_queue WHERE manual = 1 AND done_at IS NULL'),
    badEvents: await count("SELECT COUNT(*) AS n FROM billing_events WHERE outcome IN ('mismatch', 'unknown', 'test_mode') AND received_at >= ? AND received_at < ?", startIso, endIso),
    openRequests: await count('SELECT COUNT(*) AS n FROM licence_requests WHERE handled_at IS NULL'),
    // counts only: what kind of safety event, never who or what was written (trust spec TRUST-4 §4.4)
    safety: await safetyCounts(env, day),
    // tutor requests from a child alone that waited for a parent's OK (trust spec TRUST-9): how many children wait
    parentOkNeeded: await count("SELECT COUNT(*) AS n FROM safety_events WHERE day = ? AND kind = 'parent_ok_needed'", day),
    // the tutor's answers (ai spec AI-3 Design 6), counts only: final answers the guard masked, empty streamed replies,
    // generated exercises code dropped, and generate requests where every exercise was dropped
    quality: await qualityCounts(env, day),
    violations: [],
  };
  const v = params.violations;
  for (const s of await all(env, `SELECT s.id, s.kind, s.plan FROM subscriptions s WHERE s.status = 'active' AND s.provider != 'manual'
    AND s.current_period_start <= ?1 AND s.current_period_end > ?1 AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.subscription_id = s.id
      AND p.kind = 'charge' AND p.status = 'ok' AND p.occurred_at <= ?1 AND COALESCE(p.period_end, '') >= ?1) LIMIT 20`, nowIsoStr)) {
    v.push(`מנוי פעיל בלי תשלום שמכסה את היום: ${s.id} (${s.plan})`);
  }
  for (const o of await all(env, `SELECT o.id FROM orders o WHERE o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.id = o.subscription_id)
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'duplicate') LIMIT 20`)) {
    v.push(`הזמנה ששולמה בלי מנוי: ${o.id}`);
  }
  const support = supportCheckLine(now);
  if (support) v.push(support);
  const over = (usd, budget) => budget > 0 && usd >= budget;
  if (over(params.allUsd, ownerAlertUsd(env))) v.push(`העלות של היום ${params.allUsd.toFixed(2)}$ עברה את ${ownerAlertUsd(env)}$`);
  if (over(Number(freeRow?.nano_usd || 0) / 1e9, L.budgets.freeDailyUsd)) v.push(`הטעימה בחינם עברה את התקציב היומי (${L.budgets.freeDailyUsd}$)`);
  if (over(Number(trialRow?.nano_usd || 0) / 1e9, L.budgets.trialDailyUsd)) v.push(`הניסיונות לכיתות עברו את התקציב היומי (${L.budgets.trialDailyUsd}$)`);
  const fam = await count("SELECT COUNT(*) AS n FROM ai_spend WHERE period = ? AND pool LIKE 'fam:%' AND nano_usd >= ?", month, Math.round(L.budgets.familyMonthlyUsd * 1e9));
  if (fam && L.budgets.familyMonthlyUsd > 0) v.push(`${fam} מנויים משפחתיים עברו את התקציב החודשי (${L.budgets.familyMonthlyUsd}$) ועובדים בחיסכון`);
  const cls = await count(`SELECT COUNT(DISTINCT a.pool) AS n FROM ai_spend a JOIN subscriptions s ON a.pool = 'cls:' || s.class_code AND s.kind = 'class'
    AND s.plan != 'trial' AND s.status IN ('active', 'past_due', 'canceled') WHERE a.period = ? AND a.nano_usd >= s.seats * ? * 1e9`, month, L.budgets.classSeatMonthlyUsd);
  if (cls && L.budgets.classSeatMonthlyUsd > 0) v.push(`${cls} כיתות עברו את התקציב החודשי לפי מקומות ועובדות בחיסכון`);
  await queueNotices(env, [ownerNotice(day, `owner:summary:${day}`, params)]);
  return { day, violations: v.length };
}

export async function run(env, { now = new Date() } = {}) {
  const report = {};
  const step = async (name, fn) => { try { report[name] = await fn(); } catch (e) { console.error('cron', name, e?.message); report[name] = 'failed'; } };
  const night = hourOf(now).endsWith('T03');
  if (night) await step('reconcile', () => reconcile(env));
  await step('endFinished', () => endFinished(env));
  await step('expireOrders', () => expireOrders(env));
  await step('retryCancels', () => retryCancels(env));
  await step('refunds', () => processRefundQueue(env));
  if (night) {
    await step('reminders', () => reminders(env));
    await step('purge', () => purge(env, now));
    await step('safety', () => safetySpike(env, now));
    if (String(env.OWNER_DAILY_SUMMARY) === 'true') await step('summary', () => dailySummary(env, now));
  }
  await step('notices', () => flushNotices(env));
  return report;
}
