// The hourly cron ([triggers] crons = ["7 * * * *"] in wrangler.toml; scheduled() in index.js calls run()).
// Every hour: send pending notices, retry cancellations the provider has not confirmed (owner notice after 24 h),
// process the refund queue, expire open orders after 2 h, end past_due plans after the grace days, and end licences,
// terms, trials and canceled plans whose period is over. Around 03:00 in Jerusalem: delete old counters, expired codes
// and idle sessions.
import { nowIso, addDays, daysAgo, monthOf, hourOf } from './util.js';
import { limits } from './entitle.js';
import { retryCancels, processRefundQueue } from './billing.js';
import { purgeAccountsSql } from './account.js';
import { flushNotices } from './email.js';

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
  return r.reduce((n, x) => n + Number(x.meta?.changes || 0), 0);
}

export const expireOrders = (env) => env.DB.prepare("UPDATE orders SET status = 'expired' WHERE status = 'open' AND expires_at < ?").bind(nowIso()).run();

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

export async function run(env, { now = new Date() } = {}) {
  const report = {};
  const step = async (name, fn) => { try { report[name] = await fn(); } catch (e) { console.error('cron', name, e?.message); report[name] = 'failed'; } };
  await step('endFinished', () => endFinished(env));
  await step('expireOrders', () => expireOrders(env));
  await step('retryCancels', () => retryCancels(env));
  await step('refunds', () => processRefundQueue(env));
  if (hourOf(now).endsWith('T03')) await step('purge', () => env.DB.batch([...purgeCountersSql(env, now), ...purgeAccountsSql(env)]));
  await step('notices', () => flushNotices(env));
  return report;
}
