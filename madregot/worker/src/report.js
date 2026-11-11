// The parents' progress report on the Worker (PARENTS-3): one small row per linked child device and day
// (table family_daily), sent by the child's own device and read by the parent on /parents.
//
// What a row holds: codes and counts only (the app's DaySummary, web/src/learn/report.ts): minutes on learning screens,
// questions, lessons and checks, teaching stages, review checks, the streak, the stair ids worked on and mastered, the
// mistake ids being repaired or repaired that day, an exam ahead. No name, no Hebrew, no answers, chats or photos:
// cleanDay refuses anything else (400 bad_summary {field}), and nothing is ever partly saved.
//
// Two switches per device, each changed only by its owner: share_child (the child, on the device) and share_parent (the
// parent, on /parents). A row is stored only while both are on (the write itself checks them) and the family plan is
// live (402 otherwise). The state a device and a parent see is derived from them (summaryState).
//
// Routes (index.js):
//   POST /api/family/summary                   X-Family-Device  {days: DaySummary[1..8]} (≤ 8 KB): upsert by (device, day)
//   POST /api/family/summary/sharing           X-Family-Device  {on, forget?}: the child's switch (forget deletes the rows)
//   GET  /api/family/summary?days=7..90        X-Account-Token  the account's devices and their rows (also after the plan ends)
//   POST /api/family/devices/:id/sharing       X-Account-Token  {on}: the parent's switch
//   POST /api/family/devices/:id/history/delete X-Account-Token {}: the parent deletes the device's rows
//   POST /api/report/feedback                  X-Account-Token  {useful}: "הסיכום עוזר לכם?" (PARENTS-5)
// A parent's session (X-Account-Token) alone never posts a summary: 401 not_linked.
//
// Retention: REPORT_KEEP_DAYS, fixed in code (not a var, so it cannot drift upward); the night purge keeps the last 90
// days. Rows also go with the device (unlink, leave, the device purge: family.js), the account (billing.js
// forgetAccount), the parent's "delete history" and the child's "stop and delete". PARENT_REPORT = "off" (wrangler.toml)
// stops storing (503 report_off on the device's routes); rows already kept stay readable and deletable until the purge,
// and the child can still stop sharing and delete. TRUST-6's "delete everything" route, when it lands and does not call
// leaveFamily, deletes the device's rows the same way: DELETE FROM family_daily WHERE device_id = ? before the device.
//
// Counters (ai_usage): sum:d:<device> 150 posts a day, sum:n:<net> 3000. The usefulness answers (PARENTS-5): fb:report:yes
// and fb:report:no, one count per answer per month, with no account in them; fb:a:<account> on the week's Sunday, one
// answer a week per account (429 already_answered), purged with the daily keys after 35 days. Audit actions (no personal data in detail):
// summary.child_on | summary.child_off (actor device:<id>, detail {forget}), summary.parent_on | summary.parent_off and
// summary.delete (actor account:<id>).
import { HttpError, body, json, nowIso, dayOf, netKey, key, take, peek, isDay } from './util.js';
import { weekStart } from '../../shared/week.js';
import { requireAccount } from './account.js';
import { familyDeviceFrom, liveFamily, paywallOn } from './entitle.js';

/** How long a day's summary is kept. Fixed in code. */
export const REPORT_KEEP_DAYS = 90;
export const SUMMARY_LIMITS = { device: 150, net: 3000 };
export const SUMMARY_MAX_BYTES = 8192;
export const SUMMARY_MAX_DAYS = 8;
const SMALL = 1024;
const DAY_MS = 864e5;

/** Is the report on: a family plan exists only with the paywall on, and PARENT_REPORT = "off" is its kill switch. */
export const reportOn = (env) => paywallOn(env) && String(env.PARENT_REPORT || 'on') !== 'off';

/**
 * The state of a device's summary: 'off' (the report is off) · 'no_plan' (no live family plan: consent-only links,
 * ended plans) · 'on' · 'child_off' · 'parent_off' · 'both_off'. `live`: the plan check when the caller already has it.
 */
export async function summaryState(env, dev, live) {
  if (!reportOn(env)) return 'off';
  const plan = live === undefined ? await liveFamily(env, dev.account_id) : live;
  if (!plan) return 'no_plan';
  const child = Number(dev.share_child) === 1;
  const parent = Number(dev.share_parent) === 1;
  return child && parent ? 'on' : !child && !parent ? 'both_off' : !child ? 'child_off' : 'parent_off';
}

// ---------------------------------------------------------------- validation
const KEYS = ['v', 'd', 'm', 'q', 'ls', 'st', 'sk', 'ma', 'rv', 'fx', 'sr', 'ex'];
const REQUIRED = ['v', 'd', 'm', 'q', 'ls', 'st', 'sk', 'ma', 'rv', 'fx', 'sr'];
const RANGES = { m: 600, q: 2000, ls: 200, st: 200, rv: 200, sr: 3650 };
export const SKILL_RE = /^[a-z]{2,8}:\d{1,2}$/;
export const MISTAKE_RE = /^[a-z0-9-]{1,30}$/;
const MAX_STAIRS = 12;
const MAX_FIXES = 8;
// the table's CHECKs, so a valid day can never fail one (a failing statement would be a 500, not a 400)
const MAX_JSON = { worked: 200, mastered: 200, fixes: 400, exam: 60 };

const bad = (field) => new HttpError(400, 'bad_summary', undefined, { field });
const isPlain = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
/** 'YYYY-MM-DD' plus n days (calendar arithmetic on the date itself, no time zone). */
export function shiftDay(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}
const realDay = (s) => isDay(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const stairs = (v) => Array.isArray(v) && v.length <= MAX_STAIRS && v.every((s) => typeof s === 'string' && SKILL_RE.test(s)) && new Set(v).size === v.length;
const fix = (f) => Array.isArray(f) && f.length === 3 && typeof f[0] === 'string' && SKILL_RE.test(f[0])
  && typeof f[1] === 'string' && MISTAKE_RE.test(f[1]) && (f[2] === 'o' || f[2] === 'd');
const exam = (x) => x === null || (isPlain(x) && Object.keys(x).length === 3 && realDay(x.d) && isInt(x.of, 1, 60) && isInt(x.n, 0, x.of));

/**
 * One DaySummary as a row, or 400 bad_summary {field}: the exact whitelist of keys, v 1, a day from 8 days ago to
 * tomorrow (the device's calendar may be a day ahead of Jerusalem's), whole numbers in the table's ranges (out of range
 * is refused, never clipped), at most 12 stairs each, at most 8 repairs, an exam of exactly {d, n, of}.
 */
export function cleanDay(o, today) {
  if (!isPlain(o)) throw bad('day');
  const keys = Object.keys(o);
  if (keys.some((k) => !KEYS.includes(k)) || REQUIRED.some((k) => !Object.hasOwn(o, k))) throw bad('keys');
  if (o.v !== 1) throw bad('v');
  if (!realDay(o.d) || o.d < shiftDay(today, -8) || o.d > shiftDay(today, 1)) throw bad('d');
  for (const [k, hi] of Object.entries(RANGES)) if (!isInt(o[k], 0, hi)) throw bad(k);
  if (!stairs(o.sk)) throw bad('sk');
  if (!stairs(o.ma)) throw bad('ma');
  if (!Array.isArray(o.fx) || o.fx.length > MAX_FIXES || !o.fx.every(fix)) throw bad('fx');
  const ex = Object.hasOwn(o, 'ex') ? o.ex : null;
  if (!exam(ex)) throw bad('ex');
  const row = {
    day: o.d, minutes: o.m, questions: o.q, lessons: o.ls, stages: o.st, reviews: o.rv, streak: o.sr,
    worked: JSON.stringify(o.sk), mastered: JSON.stringify(o.ma), fixes: JSON.stringify(o.fx), exam: ex ? JSON.stringify({ d: ex.d, n: ex.n, of: ex.of }) : null,
  };
  for (const [col, max] of Object.entries(MAX_JSON)) if (row[col] !== null && row[col].length > max) throw bad({ worked: 'sk', mastered: 'ma', fixes: 'fx', exam: 'ex' }[col]);
  return row;
}

/** A body of 1 to 8 distinct days, each clean. */
export function cleanBody(b, today) {
  if (!isPlain(b) || Object.keys(b).some((k) => k !== 'days')) throw bad('body');
  if (!Array.isArray(b.days) || b.days.length < 1 || b.days.length > SUMMARY_MAX_DAYS) throw bad('days');
  const rows = b.days.map((d) => cleanDay(d, today));
  if (new Set(rows.map((r) => r.day)).size !== rows.length) throw bad('d');
  return rows;
}

/** A stored row as the app's DaySummary again (the arrays parsed). */
export function rowToDay(r) {
  const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
  return {
    v: 1, d: r.day, m: r.minutes, q: r.questions, ls: r.lessons, st: r.stages, sk: parse(r.worked, []), ma: parse(r.mastered, []),
    rv: r.reviews, fx: parse(r.fixes, []), sr: r.streak, ex: r.exam ? parse(r.exam, null) : null,
  };
}

// ---------------------------------------------------------------- the child's device (X-Family-Device)
/** The calling device with both switches, or 401 not_linked (X-AI-Linked: 0 when a token was sent but is not known). */
async function requireDevice(req, env) {
  const token = req.headers.get('X-Family-Device');
  if (!token) throw new HttpError(401, 'not_linked');
  const dev = await familyDeviceFrom(env, token);
  if (!dev) throw new HttpError(401, 'not_linked', undefined, undefined, { 'X-AI-Linked': '0' });
  return dev;
}
const auditStmt = (env, actor, action, target, detail = {}) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(nowIso(), actor, action, target, JSON.stringify(detail));

const UPSERT = `INSERT INTO family_daily (device_id, day, minutes, questions, lessons, stages, reviews, streak, worked, mastered, fixes, exam, updated_at)
  SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
  WHERE EXISTS (SELECT 1 FROM family_devices WHERE id = ?1 AND share_child = 1 AND share_parent = 1)
  ON CONFLICT (device_id, day) DO UPDATE SET minutes = excluded.minutes, questions = excluded.questions, lessons = excluded.lessons,
    stages = excluded.stages, reviews = excluded.reviews, streak = excluded.streak, worked = excluded.worked,
    mastered = excluded.mastered, fixes = excluded.fixes, exam = excluded.exam, updated_at = excluded.updated_at`;

/**
 * POST /api/family/summary {days}: the device's summaries of up to 8 days, each replacing that day's row (the device is
 * the source of truth for its own day, so a retry or a second tab is harmless). 200 { ok, saved, sharing: 'on' }.
 */
export async function saveSummary(req, env, cors) {
  const dev = await requireDevice(req, env);
  if (!reportOn(env)) throw new HttpError(503, 'report_off');
  const rows = cleanBody(await body(req, SUMMARY_MAX_BYTES), dayOf());
  if (!(await liveFamily(env, dev.account_id))) throw new HttpError(402, 'needs_subscription');
  const state = await summaryState(env, dev, true);
  if (state !== 'on') throw new HttpError(403, 'sharing_off', undefined, { sharing: state });
  const err = new HttpError(429, 'slow_down');
  const r = await take(env, [key(`sum:d:${dev.device_id}`, SUMMARY_LIMITS.device, { err }), key(`sum:n:${await netKey(req, env)}`, SUMMARY_LIMITS.net, { err })]);
  if (!r.ok) throw r.error; // take() returns, it does not throw
  const now = nowIso();
  const res = await env.DB.batch([
    ...rows.map((x) => env.DB.prepare(UPSERT).bind(dev.device_id, x.day, x.minutes, x.questions, x.lessons, x.stages, x.reviews, x.streak,
      x.worked, x.mastered, x.fixes, x.exam, now)),
    env.DB.prepare('UPDATE family_devices SET summary_sent_at = ? WHERE id = ? AND share_child = 1 AND share_parent = 1').bind(now, dev.device_id),
  ]);
  // a switch turned off between the check and the write: nothing was stored
  if (Number(res.at(-1)?.meta?.changes) !== 1) {
    const again = await env.DB.prepare('SELECT account_id, share_child, share_parent FROM family_devices WHERE id = ?').bind(dev.device_id).first();
    if (!again) throw new HttpError(401, 'not_linked', undefined, undefined, { 'X-AI-Linked': '0' });
    throw new HttpError(403, 'sharing_off', undefined, { sharing: await summaryState(env, again, true) });
  }
  return json({ ok: true, saved: rows.length, sharing: 'on' }, 200, cors);
}

/**
 * POST /api/family/summary/sharing {on, forget?}: the child's own switch. Off is always possible (also with the report
 * switched off); with forget the device's rows are deleted in the same batch. Turning it on needs the report on.
 * 200 { sharing } (the derived state: the parent's switch and the plan still count).
 */
export async function childSharing(req, env, cors) {
  const dev = await requireDevice(req, env);
  const b = await body(req, SMALL);
  if (typeof b.on !== 'boolean' || (b.forget !== undefined && typeof b.forget !== 'boolean')) throw new HttpError(400, 'bad_sharing');
  if (b.on && !reportOn(env)) throw new HttpError(503, 'report_off');
  const on = b.on ? 1 : 0;
  const forget = b.forget === true;
  const now = nowIso();
  await env.DB.batch([
    // share_at says since when the child's switch is as it is: an unchanged switch keeps its date
    env.DB.prepare('UPDATE family_devices SET share_at = CASE WHEN share_child = ?1 AND share_at IS NOT NULL THEN share_at ELSE ?2 END, share_child = ?1 WHERE id = ?3')
      .bind(on, now, dev.device_id),
    ...(forget ? [env.DB.prepare('DELETE FROM family_daily WHERE device_id = ?').bind(dev.device_id)] : []),
    auditStmt(env, `device:${dev.device_id}`, on ? 'summary.child_on' : 'summary.child_off', `device:${dev.device_id}`, { forget }),
  ]);
  return json({ sharing: await summaryState(env, { ...dev, share_child: on }) }, 200, cors);
}

// ---------------------------------------------------------------- the parent (X-Account-Token)
async function ownDevice(env, accountId, id) {
  const dev = await env.DB.prepare('SELECT id, account_id, share_child, share_parent FROM family_devices WHERE id = ? AND account_id = ?')
    .bind(String(id), accountId).first();
  if (!dev) throw new HttpError(404, 'not_found');
  return dev;
}

/** POST /api/family/devices/:id/sharing {on}: the parent's own switch for one device. 200 { sharing }. */
export async function parentSharing(id, req, env, cors) {
  const a = await requireAccount(req, env);
  const b = await body(req, SMALL);
  if (typeof b.on !== 'boolean') throw new HttpError(400, 'bad_sharing');
  const dev = await ownDevice(env, a.id, id);
  const on = b.on ? 1 : 0;
  await env.DB.batch([
    env.DB.prepare('UPDATE family_devices SET share_parent = ? WHERE id = ? AND account_id = ?').bind(on, dev.id, a.id),
    auditStmt(env, `account:${a.id}`, on ? 'summary.parent_on' : 'summary.parent_off', `device:${dev.id}`),
  ]);
  return json({ sharing: await summaryState(env, { ...dev, share_parent: on }) }, 200, cors);
}

/** POST /api/family/devices/:id/history/delete {}: the parent deletes the device's summaries; the device stays linked. */
export async function deleteHistory(id, req, env, cors) {
  const a = await requireAccount(req, env);
  await body(req, SMALL);
  const dev = await ownDevice(env, a.id, id);
  const res = await env.DB.batch([
    env.DB.prepare('DELETE FROM family_daily WHERE device_id = ?').bind(dev.id),
    auditStmt(env, `account:${a.id}`, 'summary.delete', `device:${dev.id}`, { by: 'parent' }),
  ]);
  return json({ ok: true, deleted: Number(res[0].meta?.changes || 0) }, 200, cors);
}

/**
 * GET /api/family/summary?days=N (7 to 90, default 56): each linked device of the account with its state and its rows
 * of the last N days, as DaySummary. Answers after the plan has ended and with the report off, so the parent can read
 * and delete until the purge. Never another account's device.
 */
export async function familySummary(req, env, cors) {
  const a = await requireAccount(req, env);
  const asked = Number(new URL(req.url).searchParams.get('days'));
  const n = Number.isInteger(asked) && asked > 0 ? Math.min(REPORT_KEEP_DAYS, Math.max(7, asked)) : 56;
  const from = shiftDay(dayOf(), -(n - 1));
  const devices = (await env.DB.prepare(`SELECT id, account_id, label, created_at, last_seen, share_child, share_parent, share_at, summary_sent_at
    FROM family_devices WHERE account_id = ? AND token_hash IS NOT NULL ORDER BY created_at`).bind(a.id).all()).results || [];
  const rows = (await env.DB.prepare(`SELECT f.* FROM family_daily f JOIN family_devices d ON d.id = f.device_id
    WHERE d.account_id = ? AND f.day >= ? ORDER BY f.day`).bind(a.id, from).all()).results || [];
  const live = !!(await liveFamily(env, a.id));
  const out = [];
  for (const d of devices) {
    out.push({
      id: d.id, label: d.label, linkedAt: d.created_at, lastSeen: d.last_seen,
      sharing: await summaryState(env, d, live), sharingAt: d.share_at || null, lastSync: d.summary_sent_at || null,
      days: rows.filter((r) => r.device_id === d.id).map(rowToDay),
    });
  }
  return json({ retentionDays: REPORT_KEEP_DAYS, days: n, devices: out }, 200, cors);
}

// ---------------------------------------------------------------- retention
/**
 * The night purge (cron.js), after purgeFamilySql in the same batch: rows older than the last 90 days (the cut is
 * Jerusalem day 89 days before today, so exactly 90 days are kept), and rows whose device is gone (the FK cascade removes them too).
 */
export function purgeReportSql(env, now = new Date()) {
  return [
    env.DB.prepare('DELETE FROM family_daily WHERE day < ?').bind(shiftDay(dayOf(now), -(REPORT_KEEP_DAYS - 1))),
    env.DB.prepare('DELETE FROM family_daily WHERE device_id NOT IN (SELECT id FROM family_devices)'),
  ];
}

// ---------------------------------------------------------------- "הסיכום עוזר לכם?" (PARENTS-5)
/** The monthly counts of the answers: aggregate only, no account in the key. */
export const FEEDBACK_KEYS = Object.freeze({ yes: 'fb:report:yes', no: 'fb:report:no' });
const FEEDBACK_CAP = 1_000_000;

/** The account's one answer this week (the week of Sunday in Jerusalem), as a counter key take() accepts. */
export const feedbackWeekKey = (accountId, now = new Date()) => ({
  who: `fb:a:${accountId}`, day: weekStart(dayOf(now)), limit: 1, n: 1, period: 'week', err: new HttpError(429, 'already_answered'),
});

/**
 * POST /api/report/feedback { useful: boolean }: a parent says whether the report helps. Counted once per account a
 * week (429 already_answered) into the month's yes or no; no free text, and nothing else is kept. 503 report_off when
 * the report is off.
 */
export async function feedback(req, env, cors) {
  const a = await requireAccount(req, env);
  if (!reportOn(env)) throw new HttpError(503, 'report_off');
  const b = await body(req, SMALL);
  if (!isPlain(b) || typeof b.useful !== 'boolean' || Object.keys(b).length !== 1) throw new HttpError(400, 'bad_feedback');
  const r = await take(env, [feedbackWeekKey(a.id), key(b.useful ? FEEDBACK_KEYS.yes : FEEDBACK_KEYS.no, FEEDBACK_CAP, { period: 'month' })]);
  if (!r.ok) throw r.error;
  return json({ ok: true }, 200, cors);
}

/** The month's answers so far (the owner's daily summary): { yes, no }. `now`: a time in that month. */
export async function feedbackCounts(env, now = new Date()) {
  const [yes, no] = await peek(env, [key(FEEDBACK_KEYS.yes, FEEDBACK_CAP, { period: 'month', now }), key(FEEDBACK_KEYS.no, FEEDBACK_CAP, { period: 'month', now })]);
  return { yes, no };
}
