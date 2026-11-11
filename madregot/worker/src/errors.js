// Error reports (DURABLE-9): counts of what broke, per day, with no per-user trail. No device id, no address, no name,
// no route values: a row is (day, fingerprint, release, browser class, route pattern) and how many times it happened.
// Kept 30 days (cron.js). Separate from any product metrics: other tables, other retention.
//
//   POST /api/errors   { v: 1, release, items: [≤ 10 × { kind, name, message, frame, route, agent }] }, ≤ 8 KB, no auth.
//     The app sends it as text/plain (no CORS preflight; sendBeacon can carry it), and the JSON is read from that body.
//     Every field is checked and scrubbed again here (@shared/errors.js): the client is never trusted. An unknown kind is
//     400. Caps, taken atomically: 100 items a day per network (err:n:<net>), 20,000 a day for everyone (err:all);
//     beyond them the answer is 202 and the items are dropped.
//   The Worker's own unhandled exceptions are counted the same way, kind 'server', under the route's pattern
//   (routePattern): a path with a secret in it (the payment webhook) is stored as its pattern, never as it was.
import { ERROR_KINDS, CLIENT_KINDS, LIMITS, MAX_ITEMS, clean, fingerprintText } from '../../shared/errors.js';
import { dayOf, nowIso, json, HttpError, rawBody, sha256, netKey, take, key } from './util.js';

export const BODY_MAX = 8 * 1024;
export const NET_DAILY = 100;
export const ALL_DAILY = 20_000;
export const KEEP_DAYS = 30;

const FRAME = /^[\w.-]{1,90}\.js:\d{1,7}:\d{1,7}$/;
const ROUTE = /^\/[A-Za-z0-9/:*_-]{0,59}$/;
const AGENT = /^[a-z0-9-]{1,30}$/;
const RELEASE = /^[A-Za-z0-9._-]{1,20}$/;

/** The Worker's routes as patterns: known paths as they are, values replaced, anything else '/api/other'. */
const ROUTES = [
  ...['/api/health', '/api/ai/status', '/api/devices', '/api/account/code', '/api/account/verify', '/api/account/signout', '/api/account',
    '/api/account/export', '/api/account/delete', '/api/billing/plans', '/api/billing/checkout', '/api/billing/cancel', '/api/billing/resume',
    '/api/billing/portal', '/api/family/link/start', '/api/family/link/finish', '/api/family/link/claim', '/api/family/devices/this',
    '/api/family/devices/leave', '/api/classes', '/api/progress', '/api/help', '/api/exams', '/api/teacher/dashboard', '/api/teacher/class/lock',
    '/api/teacher/licence', '/api/teacher/licence/request', '/api/teacher/licence/claim', '/api/errors', '/api/vault', '/api/vault/rev',
    '/api/vault/delete', '/api/vault/escrow', '/api/vault/escrow/delete', '/api/family/vaults', '/api/family/summary', '/api/family/summary/sharing',
    '/api/report/feedback'].map((p) => [p, p]),
  [/^\/api\/ai\/[^/]+$/, '/api/ai/:kind'],
  [/^\/api\/billing\/orders\/[^/]+$/, '/api/billing/orders/:id'],
  [/^\/api\/billing\/payments\/[^/]+\/invoice$/, '/api/billing/payments/:id/invoice'],
  [/^\/api\/billing\/webhook\/[^/]+\/[^/]+$/, '/api/billing/webhook/:provider/:secret'],
  [/^\/api\/billing\/test-pay\/[^/]+$/, '/api/billing/test-pay/:id'],
  [/^\/api\/family\/devices\/[^/]+\/unlink$/, '/api/family/devices/:id/unlink'],
  [/^\/api\/family\/devices\/[^/]+\/sharing$/, '/api/family/devices/:id/sharing'],
  [/^\/api\/family\/devices\/[^/]+\/history\/delete$/, '/api/family/devices/:id/history/delete'],
  [/^\/api\/family\/vaults\/[^/]+\/delete$/, '/api/family/vaults/:id/delete'],
  [/^\/api\/classes\/[^/]+$/, '/api/classes/:code'],
  [/^\/api\/classes\/[^/]+\/join$/, '/api/classes/:code/join'],
  [/^\/api\/teacher\/help\/[^/]+$/, '/api/teacher/help/:id'],
  [/^\/api\/teacher\/help\/[^/]+\/image$/, '/api/teacher/help/:id/image'],
  [/^\/api\/teacher\/students\/[^/]+\/reset-pin$/, '/api/teacher/students/:id/reset-pin'],
  [/^\/api\/teacher\/students\/[^/]+\/remove$/, '/api/teacher/students/:id/remove'],
];
export function routePattern(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  for (const [m, pattern] of ROUTES) if (typeof m === 'string' ? m === p : m.test(p)) return pattern;
  return '/api/other';
}

/** One item as it is stored, or null when its kind is unknown. Everything else is cleaned to what the table allows. */
export function cleanItem(it, kinds = CLIENT_KINDS) {
  if (!it || typeof it !== 'object' || !kinds.includes(it.kind)) return null;
  const frame = String(it.frame ?? '');
  const route = clean(it.route, LIMITS.route);
  return {
    kind: it.kind,
    name: clean(it.name, LIMITS.name) || it.kind,
    message: clean(it.message, LIMITS.message),
    frame: FRAME.test(frame) ? frame.slice(0, LIMITS.frame) : '',
    route: ROUTE.test(route) ? route : '/other',
    agent: AGENT.test(String(it.agent ?? '')) ? it.agent : 'other',
  };
}
const cleanRelease = (r) => (RELEASE.test(String(r ?? '')) ? String(r) : 'unknown');

/** The statement that counts one item (a new row, or one more on the day's row with the same key). */
async function upsertStmt(env, item, release, at) {
  const fp = (await sha256(fingerprintText(item))).slice(0, 16);
  return env.DB.prepare(
    `INSERT INTO client_errors (day, fp, release, kind, name, message, frame, route, agent, count, first_at, last_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT (day, fp, release, agent, route) DO UPDATE SET count = count + 1, last_at = excluded.last_at`,
  ).bind(dayOf(new Date(at)), fp, release, item.kind, item.name, item.message, item.frame, item.route, item.agent, at, at);
}

/** POST /api/errors. */
export async function postErrors(req, env, cors) {
  let b;
  try { b = JSON.parse(await rawBody(req, BODY_MAX)); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'bad_json'); }
  if (!b || typeof b !== 'object' || b.v !== 1 || !Array.isArray(b.items) || !b.items.length || b.items.length > MAX_ITEMS) throw new HttpError(400, 'bad_report');
  const items = b.items.map((it) => cleanItem(it));
  if (items.some((x) => !x)) throw new HttpError(400, 'unknown_kind');
  const release = cleanRelease(b.release);
  const net = await netKey(req, env);
  const n = items.length;
  const r = await take(env, [key(`err:n:${net}`, NET_DAILY, { n }), key('err:all', ALL_DAILY, { n })]);
  if (!r.ok) return json({ ok: true, dropped: n }, 202, cors);
  const at = nowIso();
  await env.DB.batch(await Promise.all(items.map((it) => upsertStmt(env, it, release, at))));
  return json({ ok: true }, 202, cors);
}

/**
 * The Worker's own unhandled exception, counted as kind 'server' under the route's pattern (fetch's unhandled branch
 * runs this through ctx.waitUntil, and swallows its failure). Within the shared daily cap.
 */
export async function recordServerError(env, e, pathname) {
  const item = cleanItem({ kind: 'server', name: e?.name || 'Error', message: e?.message || String(e), frame: '', route: routePattern(pathname), agent: 'worker' }, ERROR_KINDS);
  const r = await take(env, [key('err:all', ALL_DAILY)]);
  if (!r.ok) return false;
  await (await upsertStmt(env, item, cleanRelease(env.RELEASE || 'worker'), nowIso())).run();
  return true;
}

/** Yesterday's (or a day's) reports: the total and the 5 most frequent, with the largest single fingerprint's count. */
export async function errorsOf(env, day) {
  const total = Number((await env.DB.prepare('SELECT COALESCE(SUM(count), 0) AS n FROM client_errors WHERE day = ?').bind(day).first())?.n || 0);
  const top = (await env.DB.prepare(
    `SELECT kind, message, route, release, SUM(count) AS count FROM client_errors WHERE day = ?
     GROUP BY fp, route, release ORDER BY count DESC, kind, message LIMIT 5`,
  ).bind(day).all()).results || [];
  const worst = Number((await env.DB.prepare('SELECT COALESCE(MAX(n), 0) AS n FROM (SELECT SUM(count) AS n FROM client_errors WHERE day = ? GROUP BY fp)').bind(day).first())?.n || 0);
  return { total, top: top.map((x) => ({ kind: x.kind, message: x.message, route: x.route, release: x.release, count: Number(x.count) })), worst };
}

/** When the owner hears of it the same night: over 300 reports in a day, or over 100 of one failure. */
export const NOTICE_TOTAL = 300;
export const NOTICE_ONE = 100;
export const errorsNoticeDue = (e) => e.total > NOTICE_TOTAL || e.worst > NOTICE_ONE;

/** Retention: rows older than 30 days go. */
export const purgeErrorsSql = (env, now = new Date()) => env.DB.prepare('DELETE FROM client_errors WHERE day < ?').bind(dayOf(new Date(now.getTime() - KEEP_DAYS * 864e5)));
