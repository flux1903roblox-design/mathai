// Reach numbers with no tracker (STUDENT-14). The owner can see how many people saw a landing page, were offered an
// install and installed, turned reminders on, opened a store app or opened a screen, without anything that tells who.
//
// POST /api/metrics takes one name, as the plain body ('install_offer') or as { "n": "install_offer" }. A name on the
// list adds 1 to that name's count for the Jerusalem day (table metrics_daily: day, name, n and nothing else). A name
// not on the list is dropped. The answer is 204 with no body every time, so a count never holds up or breaks a page.
// A network may add at most 300 counts a day (the hashed network key, as every other counter; past it nothing is added).
// No cookie, device id, address or user agent is read into the table. Rows are kept 400 days (cron.js purge).
//
// The server adds counts it already knows (countServer): class_goal_reached when a class first reaches its week's goal.
import { dayOf, netKey, limitOrThrow, rawBody } from './util.js';

/** The names a page may count. Anything else is ignored. */
export const METRIC_NAMES = [
  'landing_view_mivchan', 'landing_view_pilot', 'landing_cta_mivchan', 'landing_cta_pilot', 'welcome_from_landing',
  'install_offer', 'install_accept', 'installed', 'push_offer', 'push_on', 'push_off', 'push_open',
  'store_open_play', 'store_open_ios', 'recap_open', 'wardrobe_open'];
/** Counts only the server adds (never accepted from a page). */
export const SERVER_METRICS = ['class_goal_reached'];
/** Counts a network may add in a Jerusalem day. */
export const METRICS_PER_NET = 300;
/** The largest body read: a name, or { "n": name }, is far smaller. */
const BODY_MAX = 256;

const PAGE = new Set(METRIC_NAMES);
const SERVER = new Set(SERVER_METRICS);

/** The name in a body: the plain name, or the n of a JSON object. null when it is not a name on the list. */
export function metricName(raw) {
  const s = String(raw ?? '').trim();
  if (PAGE.has(s)) return s;
  if (!s.startsWith('{')) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v.n === 'string' && PAGE.has(v.n) ? v.n : null;
  } catch { return null; }
}

/** One more of a name on a Jerusalem day. */
export const countStmt = (env, name, now = new Date()) => env.DB.prepare(
  'INSERT INTO metrics_daily (day, name, n) VALUES (?, ?, 1) ON CONFLICT (day, name) DO UPDATE SET n = n + 1',
).bind(dayOf(now), name);

/** A count the server knows by itself (SERVER_METRICS). Never throws: a count is never worth failing a request. */
export async function countServer(env, name, now = new Date()) {
  if (!SERVER.has(name)) return;
  try { await countStmt(env, name, now).run(); } catch (e) { console.error('metric', name, e?.message); }
}

/** POST /api/metrics: 204 always. */
export async function postMetric(req, env, cors) {
  const none = () => new Response(null, { status: 204, headers: cors });
  let name = null;
  try { name = metricName(await rawBody(req, BODY_MAX)); } catch { return none(); }
  if (!name) return none();
  try {
    // without the network key's secret nothing is counted (health() reports netKeys: false)
    await limitOrThrow(env, `metric:n:${await netKey(req, env)}`, METRICS_PER_NET, 429, 'too_many_metrics');
    await countStmt(env, name).run();
  } catch { /* over the day's limit, or no key: nothing is added, and the page is not told */ }
  return none();
}
