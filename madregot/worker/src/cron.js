// The hourly cron ([triggers] crons = ["7 * * * *"] in wrangler.toml; scheduled() in index.js calls run()).
//
// Every hour: end plans whose time is over (past_due after the grace days, finished terms, trials and class licences,
// canceled plans at their period end), expire open orders after 2 h, retry cancellations the provider has not confirmed
// (owner notice after 24 h), process the refund queue, and send pending notices.
//
// In the 03:00 hour in Jerusalem: reconcile renewing plans whose period is over with the provider (extend only from the
// truth pulled from it, or end the plan), queue the yearly renewal reminder (45 days ahead) and the licence-ending email
// (30 days ahead), purge what is no longer needed (spec §6.9, the safety records, and the class data by TRUST-7:
// shared/retention.js), alert the owner when yesterday's safety events jumped, and queue the owner's daily summary when
// OWNER_DAILY_SUMMARY = "true". Each step runs on its own: one failing step never stops the others.
import { nowIso, addDays, daysAgo, dayOf, monthOf, hourOf, startOfDayIso, endOfDayIso } from './util.js';
import { limits } from './entitle.js';
import { retryCancels, processRefundQueue } from './billing.js';
import { purgeAccountsSql } from './account.js';
import { purgeFamilySql } from './family.js';
import { providerById } from './providers/index.js';
import { queueNotices, ownerNotice, ownerAlertUsd } from './spend.js';
import { flushNotices } from './email.js';
import { SUPPORT } from '../../shared/safety.js';
import { studentsDeleteSteps, classDeleteSteps, countSteps } from './forget.js';
import { RETENTION } from '../../shared/retention.js';

const DAY = 864e5;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const changes = (r) => (Array.isArray(r) ? r : [r]).reduce((n, x) => n + Number(x?.meta?.changes || 0), 0);
const auditStmt = (env, action, target, detail) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(nowIso(), 'cron', action, target, JSON.stringify(detail || {}));

/** Plans whose time is over. Recurring plans that are still active are left to the provider's renewal events. */
export async function endFinished(env) {
  const now = nowIso();
  const grace = addDays(now, -limits(env).graceDays);
  const r = await env.DB.batch([
    env.DB.prepare("UPDATE subscriptions SET status = 'ended', ended_reason = 'payment_failed', updated_at = ? WHERE status = 'past_due' AND current_period_end <= ?").bind(now, grace),
    env.DB.prepare(`UPDATE subscriptions SET status = 'ended', ended_reason = 'expired', updated_at = ?
      WHERE status = 'active' AND plan IN ('term', 'trial', 'class_year') AND current_period_end <= ?`).bind(now, now),
    env.DB.prepare("UPDATE subscriptions SET status = 'ended', ended_reason = COALESCE(ended_reason, 'canceled'), updated_at = ? WHERE status = 'canceled' AND current_period_end <= ?").bind(now, now),
  ]);
  return changes(r);
}

export const expireOrders = (env) => env.DB.prepare("UPDATE orders SET status = 'expired' WHERE status = 'open' AND expires_at < ?").bind(nowIso()).run();

/**
 * Renewing plans (family_month, family_year) whose period is over with no renewal event: ask the provider. Its pulled
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
  const due = await all(env, `SELECT * FROM subscriptions WHERE kind = 'family' AND plan IN ('family_month', 'family_year')
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

export const RENEWAL_REMINDER_DAYS = 45;
export const LICENCE_ENDING_DAYS = 30;
/**
 * The yearly renewal reminder 45 days ahead (to the payer), and the licence-ending email 30 days ahead (to the buyer, or
 * else the teacher who last asked about the class). Each is queued once per period end: the notice key holds the date.
 */
export async function reminders(env) {
  const now = nowIso();
  const r = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
      SELECT id, 'renewal_reminder:' || current_period_end, account_id, json_object('periodEnd', current_period_end, 'priceAgorot', price_agorot), ?1
      FROM subscriptions WHERE kind = 'family' AND plan = 'family_year' AND status = 'active' AND cancel_at_period_end = 0
        AND account_id IS NOT NULL AND price_agorot IS NOT NULL AND current_period_end > ?1 AND current_period_end <= ?2`)
      .bind(now, addDays(now, RENEWAL_REMINDER_DAYS)),
    env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
      SELECT id, 'licence_ending:' || current_period_end, recipient, json_object('until', current_period_end, 'classCode', class_code), ?1 FROM (
        SELECT s.id, s.current_period_end, s.class_code, COALESCE(s.account_id, (SELECT r.account_id FROM licence_requests r
          WHERE r.class_code = s.class_code AND r.account_id IS NOT NULL ORDER BY r.created_at DESC LIMIT 1)) AS recipient
        FROM subscriptions s WHERE s.kind = 'class' AND s.plan != 'trial' AND s.status = 'active'
          AND s.current_period_end > ?1 AND s.current_period_end <= ?2)
      WHERE recipient IS NOT NULL`).bind(now, addDays(now, LICENCE_ENDING_DAYS)),
  ]);
  return { renewal: changes(r[0]), licence: changes(r[1]) };
}

/** Old counters: daily (and hourly) rows after 35 days, monthly rows after 13 months. length(day) keeps them apart. */
export function purgeCountersSql(env, now = new Date()) {
  const [y, m] = monthOf(now).split('-').map(Number);
  const back = new Date(Date.UTC(y, m - 1 - 13, 1));
  const oldMonth = `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, '0')}`;
  return [
    env.DB.prepare('DELETE FROM ai_usage WHERE length(day) >= 10 AND day < ?').bind(daysAgo(35)),
    env.DB.prepare('DELETE FROM ai_usage WHERE length(day) = 7 AND day < ?').bind(oldMonth),
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

/** Rows one purge statement touches at the most, so one night never runs out of time; the next batch or night goes on. */
export const PURGE_BATCH = 2000;
/** Class purge batches in one night, at the most (each one runs again only while a step was full). */
export const PURGE_ROUNDS = 5;

/**
 * Class data past its time (spec TRUST-7; the periods are in shared/retention.js), as [name, statement] steps:
 * notebook pages 30 days after the request was closed (60 at most), help requests 180 days after closing (365 at most),
 * attempts and exams after 400 days, assignments 400 days after their due date (with their work and targets),
 * students nobody has seen for 400 days (with all their rows and counters), and
 * classes with no activity for 400 days and no running licence (their students, lock, settings, owner, counters, notices
 * and the class row). Every step is limited to PURGE_BATCH rows (or students, or classes).
 */
export function purgeClassSteps(env, now = new Date()) {
  const t = now.getTime();
  const iso = (days) => new Date(t - days * DAY).toISOString();
  const oldDay = (days) => dayOf(new Date(t - days * DAY));
  const R = RETENTION;
  const N = PURGE_BATCH;
  const stmt = (sql, ...a) => env.DB.prepare(sql).bind(...a);
  const idleStudents = `SELECT id FROM students WHERE last_seen < ?1 OR (last_seen IS NULL AND created_at < ?1) ORDER BY id LIMIT ${N}`;
  // a class with no activity of its own (class_settings.last_seen, else the day it was made), no student seen in the
  // period, and no class licence that still runs (a trial included)
  const idleClasses = `SELECT c.code FROM classes c LEFT JOIN class_settings cs ON cs.code = c.code
    WHERE COALESCE(cs.last_seen, substr(c.created_at, 1, 10)) < ?1
      AND NOT EXISTS (SELECT 1 FROM students st WHERE st.class_code = c.code AND COALESCE(st.last_seen, st.created_at) >= ?2)
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.kind = 'class' AND s.class_code = c.code AND s.status IN ('active', 'past_due', 'canceled'))
    ORDER BY c.code LIMIT ${N}`;
  return [
    ['helpImages', stmt(`UPDATE help_requests SET image = NULL WHERE id IN (SELECT id FROM help_requests WHERE image IS NOT NULL
      AND ((done_at IS NOT NULL AND done_at < ?1) OR created_at < ?2) LIMIT ${N})`, iso(R.helpImageAfterDoneDays), iso(R.helpImageMaxDays))],
    ['help', stmt(`DELETE FROM help_requests WHERE id IN (SELECT id FROM help_requests
      WHERE (done_at IS NOT NULL AND done_at < ?1) OR created_at < ?2 LIMIT ${N})`, iso(R.helpAfterDoneDays), iso(R.helpMaxDays))],
    // a help request's help_meta row (TRUST-3) goes with it (its foreign key cascades on D1; this also covers a
    // database without it)
    ['helpMeta', stmt(`DELETE FROM help_meta WHERE help_id IN (SELECT m.help_id FROM help_meta m
      LEFT JOIN help_requests h ON h.id = m.help_id WHERE h.id IS NULL LIMIT ${N})`)],
    ['attempts', stmt(`DELETE FROM attempts WHERE id IN (SELECT id FROM attempts WHERE at < ? LIMIT ${N})`, iso(R.attemptsDays))],
    ['exams', stmt(`DELETE FROM exams WHERE id IN (SELECT id FROM exams WHERE created_at < ? LIMIT ${N})`, iso(R.examsDays))],
    // assignments 400 days after their due date (a Jerusalem day): what was done on them and who they were for first,
    // then each assignment that has none left, every step at most PURGE_BATCH rows
    ['assignmentWork', stmt(`DELETE FROM assignment_work WHERE rowid IN (SELECT w.rowid FROM assignment_work w
      JOIN assignments a ON a.id = w.assignment_id WHERE a.due_on < ? LIMIT ${N})`, oldDay(R.assignmentsDays))],
    ['assignmentTargets', stmt(`DELETE FROM assignment_targets WHERE rowid IN (SELECT t.rowid FROM assignment_targets t
      JOIN assignments a ON a.id = t.assignment_id WHERE a.due_on < ? LIMIT ${N})`, oldDay(R.assignmentsDays))],
    ['assignmentsOld', stmt(`DELETE FROM assignments WHERE id IN (SELECT a.id FROM assignments a WHERE a.due_on < ?
      AND NOT EXISTS (SELECT 1 FROM assignment_work w WHERE w.assignment_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM assignment_targets t WHERE t.assignment_id = a.id) LIMIT ${N})`, oldDay(R.assignmentsDays))],
    ...studentsDeleteSteps(env, idleStudents, [iso(R.studentIdleDays)]),
    ...classDeleteSteps(env, idleClasses, [dayOf(new Date(t - R.classIdleDays * DAY)), iso(R.classIdleDays)], { limit: N }),
  ];
}
export const purgeClassSql = (env, now = new Date()) => purgeClassSteps(env, now).map(([, s]) => s);

/** The class purge: batches of purgeClassSteps while a step was full, PURGE_ROUNDS at the most. Counts by step. */
export async function purgeClass(env, now = new Date()) {
  const total = {};
  for (let round = 0; round < PURGE_ROUNDS; round++) {
    const steps = purgeClassSteps(env, now);
    const counts = countSteps(steps, await env.DB.batch(steps.map(([, s]) => s)));
    for (const [k, v] of Object.entries(counts)) total[k] = (total[k] || 0) + v;
    if (!Object.values(counts).some((v) => v >= PURGE_BATCH)) break;
  }
  return total;
}

/** The night purge: the records, counters and safety records in one batch, then the class data. The counts go into the cron report. */
export async function purge(env, now = new Date()) {
  const r = await env.DB.batch([...purgeCountersSql(env, now), ...purgeAccountsSql(env), ...purgeFamilySql(env), ...purgeRecordsSql(env), ...purgeSafetySql(env, now)]);
  const cls = await purgeClass(env, now);
  return {
    rows: changes(r),
    class: {
      helpImages: cls.helpImages, help: cls.help, attempts: cls.attempts, exams: cls.exams, assignments: (cls.assignmentsOld || 0) + (cls.assignments || 0),
      students: cls.students, classes: cls.classes,
    },
  };
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
