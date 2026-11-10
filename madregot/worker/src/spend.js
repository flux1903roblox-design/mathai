// What Claude really cost, from each answer's usage, in nano-USD (1e-9 dollars) per pool and period (table ai_spend),
// and the breakers that read it: the free taste pauses when its day costs FREE_DAILY_BUDGET_USD, a trial pauses at
// TRIAL_DAILY_BUDGET_USD a day, and a paid pool switches to economy mode past its monthly budget. When everything
// together passes OWNER_ALERT_USD in a day, the owner gets one notice. The hard backstop is the spend limit of the
// Anthropic workspace.
import { dayOf, monthOf, nowIso } from './util.js';

// nano-USD per token: input, output, cache read, cache write (5-minute cache, 1.25x input).
export const PRICES = {
  'claude-opus-5-5': { input: 4000, output: 20000, cacheRead: 200, cacheWrite: 5000 },
  'claude-sonnet-5-5': { input: 2000, output: 10000, cacheRead: 100, cacheWrite: 2500 },
  // the low-cost model's cache prices assume the usual 0.1x read and 1.25x write ratios
  'claude-haiku-5-5': { input: 100, output: 500, cacheRead: 10, cacheWrite: 125 },
  // models a declined request may be rerun on by the server-side fallback; they cost more than the main model
  'claude-opus-5': { input: 5000, output: 25000, cacheRead: 500, cacheWrite: 6250 },
  'claude-opus-4-8': { input: 5000, output: 25000, cacheRead: 500, cacheWrite: 6250 },
};
/**
 * Any other model: a deliberately high price (above every model the tutor may run on, fallbacks included), so the
 * ledger, the breakers and economy mode never count less than was spent.
 */
export const UNKNOWN_PRICE = { input: 10000, output: 50000, cacheRead: 1000, cacheWrite: 12500 };
/** The price of a model; an unknown model is priced at UNKNOWN_PRICE. */
export const priceFor = (model) => PRICES[String(model || '')] || UNKNOWN_PRICE;

const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
function tokensOf(u) {
  return { input: n(u.input_tokens), output: n(u.output_tokens), cacheRead: n(u.cache_read_input_tokens), cacheWrite: n(u.cache_creation_input_tokens) };
}

/**
 * What one Claude message cost. When a server-side fallback ran, usage.iterations lists every attempt with its own
 * tokens (and model); each is priced on its own. Returns { nano, input, output, cache }.
 */
export function priceOf(message) {
  const usage = message?.usage || {};
  const parts = Array.isArray(usage.iterations) && usage.iterations.length
    ? usage.iterations.map((it) => ({ model: it.model || message.model, t: tokensOf(it) }))
    : [{ model: message?.model, t: tokensOf(usage) }];
  const out = { nano: 0, input: 0, output: 0, cache: 0 };
  for (const { model, t } of parts) {
    const p = priceFor(model);
    out.nano += t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheWrite * p.cacheWrite;
    out.input += t.input; out.output += t.output; out.cache += t.cacheRead + t.cacheWrite;
  }
  return out;
}

const UPSERT = `INSERT INTO ai_spend (pool, period, calls, input_tokens, output_tokens, cache_tokens, nano_usd) VALUES (?, ?, 1, ?, ?, ?, ?)
  ON CONFLICT (pool, period) DO UPDATE SET calls = calls + 1, input_tokens = input_tokens + excluded.input_tokens,
  output_tokens = output_tokens + excluded.output_tokens, cache_tokens = cache_tokens + excluded.cache_tokens,
  nano_usd = nano_usd + excluded.nano_usd RETURNING nano_usd`;

const usd = (env, name, d) => {
  const v = Number(env[name]);
  return env[name] !== undefined && env[name] !== '' && Number.isFinite(v) && v >= 0 ? v : d;
};
export const ownerAlertUsd = (env) => usd(env, 'OWNER_ALERT_USD', 20);

/** Add one answer's cost to its pool (day and month), to 'all' (day and month) and to its kind (month). */
export async function recordSpend(env, { pool, kind, message }) {
  const c = priceOf(message);
  const day = dayOf(); const month = monthOf();
  const rows = [[pool, day], [pool, month], ['all', day], ['all', month], [`kind:${kind}`, month]];
  const res = await env.DB.batch(rows.map(([p, period]) => env.DB.prepare(UPSERT).bind(p, period, c.input, c.output, c.cache, c.nano)));
  const allToday = Number(res[2]?.results?.[0]?.nano_usd || 0);
  if (allToday > ownerAlertUsd(env) * 1e9) {
    await queueNotices(env, [ownerNotice(day, `owner:spend:${day}`, { usd: Math.round(allToday / 1e7) / 100, day })]);
  }
  return c;
}

async function spendOf(env, pool, period) {
  const row = await env.DB.prepare('SELECT nano_usd FROM ai_spend WHERE pool = ? AND period = ?').bind(pool, period).first();
  return Number(row?.nano_usd || 0) / 1e9;
}
/** Today's spend of a pool, in USD (Jerusalem day). */
export const daySpendUsd = (env, pool) => spendOf(env, pool, dayOf());
/** This month's spend of a pool, in USD. */
export const monthSpendUsd = (env, pool) => spendOf(env, pool, monthOf());

// ---------------------------------------------------------------- the notices outbox (sent by email.js)
/** A notice row: ref + kind are its key, so the same notice is queued once. to: an account id, or null for the owner. */
export const notice = (ref, kind, to, params = {}) => ({ ref: String(ref), kind: String(kind), to: to || null, params });
export const ownerNotice = (ref, kind, params = {}) => notice(ref, kind, null, params);
export const noticeStmt = (env, nt) => env.DB.prepare(
  'INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at) VALUES (?, ?, ?, ?, ?)',
).bind(nt.ref, nt.kind, nt.to, JSON.stringify(nt.params || {}), nowIso());
export async function queueNotices(env, list) {
  if (list.length) await env.DB.batch(list.map((nt) => noticeStmt(env, nt)));
}
