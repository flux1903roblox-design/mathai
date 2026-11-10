// The teacher's side of class licences (spec §5.4, §6.8): the licence card on the dashboard, a request for a trial or a
// school quote (answered by the owner, who grants with npm run owner; a trial is never granted automatically), a school
// licence code that attaches the class, the join lock, and removing a student who does not belong to the class.
// Every route needs X-Class-Code and X-Teacher-Key. The licence card shows class totals only: no per-student AI data and
// no sign of which students have a family plan.
import { HttpError, body, json, nowIso, daysAgo, sha256, randomToken, netKey, key, take, limitOrThrow, CODE_ALPHABET } from './util.js';
import { requireTeacher, liveLicence, legacyWindow } from './entitle.js';
import { requireAccount } from './account.js';
import { prices, vatExempt, onlineCheckout, SEATS } from './billing.js';
import { flushNotices } from './email.js';

const SMALL = 4096;
const DAY = 864e5;
export const ENDING_DAYS = 30;
export const REQUEST_LIMITS = { perClassDay: 5 };
export const CLAIM_LIMITS = { netHour: 10, classDay: 10 };
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const audit = (env, cls, action, target, detail = {}) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(nowIso(), `teacher:${cls}`, action, target, JSON.stringify(detail));

/** Is the class closed to new names? */
export const joinLocked = async (env, classCode) => !!(await first(env, 'SELECT 1 AS x FROM class_locks WHERE class_code = ?', classCode));

/**
 * The class's AI questions in the last 7 days, all students and the teacher together, whatever the tier (the counters
 * of the switch-off and legacy limits, the paid groups and the free taste). The tries guards and class units are left
 * out, and family plans (counted per family) are never seen here.
 */
export async function classAiWeek(env, classCode) {
  const row = await first(env, `WITH g(s) AS (VALUES (''), (':tutor'), (':check'), (':generate'), (':exam'))
    SELECT COALESCE(SUM(u.count), 0) AS n FROM ai_usage u WHERE length(u.day) = 10 AND u.day >= ?2 AND u.who IN (
      SELECT 's:' || st.id || g.s FROM students st, g WHERE st.class_code = ?1
      UNION ALL SELECT 'free:s:' || st.id FROM students st WHERE st.class_code = ?1
      UNION ALL SELECT 't:' || ?1 || g.s FROM g
      UNION ALL SELECT 'free:t:' || ?1)`, classCode, daysAgo(6));
  return Number(row?.n || 0);
}

/** GET /api/teacher/licence: the licence card. */
export async function licenceStatus(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const lic = await liveLicence(env, cls.code);
  const legacy = !lic && legacyWindow(env, cls.created_at);
  const last = lic ? null : await first(env, "SELECT current_period_end FROM subscriptions WHERE kind = 'class' AND class_code = ? ORDER BY current_period_end DESC LIMIT 1", cls.code);
  let status = 'none';
  if (lic) {
    const ending = lic.status === 'canceled' || Date.parse(lic.current_period_end) - Date.now() <= ENDING_DAYS * DAY;
    status = lic.plan === 'trial' ? 'trial' : ending ? 'ending' : 'active';
  } else if (legacy) status = 'legacy';
  else if (last) status = 'ended';
  const [students, aiWeek, locked, request] = await Promise.all([
    first(env, 'SELECT COUNT(*) AS n FROM students WHERE class_code = ?', cls.code).then((r) => Number(r?.n || 0)),
    classAiWeek(env, cls.code),
    joinLocked(env, cls.code),
    first(env, 'SELECT wants, created_at FROM licence_requests WHERE class_code = ? AND handled_at IS NULL ORDER BY created_at DESC LIMIT 1', cls.code),
  ]);
  return json({
    status,
    until: lic ? lic.current_period_end : status === 'ended' ? last.current_period_end : null,
    seats: lic ? lic.seats : null,
    students, aiWeek, joinLocked: locked,
    request: request ? { wants: request.wants, at: request.created_at } : null,
    legacyUntil: legacy ? env.LEGACY_CLASS_AI_UNTIL : null,
    offer: { seatYearAgorot: prices(env).seat, minSeats: SEATS.min, vatMode: vatExempt(env) ? 'exempt' : 'included', online: onlineCheckout(env) },
  }, 200, cors);
}

const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
function intIn(v, min, max, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, 'bad_request');
  return n;
}

/**
 * POST /api/teacher/licence/request {wants, school, classes, students?, note?}: also needs X-Account-Token (the teacher's
 * verified email, for the owner's answer). One open request per kind per class, 5 a day per class. The owner gets an email.
 */
export async function licenceRequest(req, env, ctx, cors) {
  const cls = await requireTeacher(req, env);
  const a = await requireAccount(req, env);
  const b = await body(req, SMALL);
  const wants = String(b.wants || '');
  if (!['trial', 'quote'].includes(wants)) throw new HttpError(400, 'bad_request');
  const school = cleanText(b.school, 80);
  if (!school) throw new HttpError(400, 'missing_fields');
  const classes = intIn(b.classes, 1, 30, 1);
  const students = intIn(b.students, 1, 45, null);
  const note = cleanText(b.note, 500);
  await limitOrThrow(env, `licreq:c:${cls.code}`, REQUEST_LIMITS.perClassDay, 429, 'too_many_requests');
  const id = randomToken(8);
  const now = nowIso();
  const params = { classCode: cls.code, wants, school, classes, students, note };
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO licence_requests (id, class_code, account_id, wants, school, classes, students, note, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM licence_requests WHERE class_code = ? AND wants = ? AND handled_at IS NULL)`)
      .bind(id, cls.code, a.id, wants, school, classes, students, note, now, cls.code, wants),
    // the owner's email (to OWNER_EMAIL); the teacher's address is looked up when it is sent, never copied here
    env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
      SELECT ?1, 'owner:licence_request', NULL, ?2, ?3 WHERE EXISTS (SELECT 1 FROM licence_requests WHERE id = ?1)`).bind(id, JSON.stringify(params), now),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail)
      SELECT ?1, ?2, 'licence.request', ?3, ?4 WHERE EXISTS (SELECT 1 FROM licence_requests WHERE id = ?5)`)
      .bind(now, `teacher:${cls.code}`, `class:${cls.code}`, JSON.stringify({ wants, classes, students }), id),
  ]);
  if (Number(res[0].meta?.changes) !== 1) throw new HttpError(409, 'request_open');
  ctx?.waitUntil?.(flushNotices(env));
  return json({ ok: true }, 200, cors);
}

const LICENCE_RE = new RegExp(`^[${CODE_ALPHABET}]{12}$`);
/** A school licence code as typed (XXXX-XXXX-XXXX, any case): its 12 symbols, or null. */
export function normLicenceCode(v) {
  const c = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return LICENCE_RE.test(c) ? c : null;
}
// A licence that is not a trial and still renews or runs (a trial gives way to a licence; two licences never run together).
const LICENSED = "plan != 'trial' AND status IN ('active', 'past_due')";
const hasLicence = async (env, classCode) => !!(await first(env, `SELECT 1 AS x FROM subscriptions WHERE kind = 'class' AND class_code = ? AND ${LICENSED}`, classCode));
/** The stored form of a licence code: SHA-256 of its 12 symbols (the same as licenceHash in scripts/owner.mjs). */
export const licenceCodeHash = (code) => sha256(code);

/**
 * POST /api/teacher/licence/claim {code}: a school licence code (from npm run owner -- grant-school) attaches this class.
 * Each class takes one of the code's places; the code works for 60 days. 10 an hour per network, 10 a day per class.
 */
export async function licenceClaim(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, SMALL);
  const net = await netKey(req, env);
  const tooMany = new HttpError(429, 'too_many_tries');
  const r = await take(env, [
    key(`licclaim:n:${net}`, CLAIM_LIMITS.netHour, { period: 'hour', err: tooMany }),
    key(`licclaim:c:${cls.code}`, CLAIM_LIMITS.classDay, { err: tooMany }),
  ]);
  if (!r.ok) throw r.error;
  const code = normLicenceCode(b.code);
  if (!code) throw new HttpError(400, 'bad_licence_code');
  const hash = await licenceCodeHash(code);
  const now = nowIso();
  const VALID = 'code_hash = ?1 AND classes_left > 0 AND expires_at > ?2 AND until > ?2';
  const lc = await first(env, `SELECT * FROM licence_codes WHERE ${VALID}`, hash, now);
  if (!lc) throw new HttpError(400, 'bad_licence_code');
  if (await hasLicence(env, cls.code)) throw new HttpError(409, 'class_has_licence');
  const NOT_LICENSED = `NOT EXISTS (SELECT 1 FROM subscriptions WHERE kind = 'class' AND class_code = ?3 AND ${LICENSED})`;
  const id = randomToken(8);
  const res = await env.DB.batch([
    // a running trial gives way to the school licence (two running licences for one class are never allowed)
    env.DB.prepare(`UPDATE subscriptions SET status = 'ended', ended_reason = 'expired',
      current_period_end = MAX(MIN(current_period_end, ?2), strftime('%Y-%m-%dT%H:%M:%fZ', current_period_start, '+1 second')), updated_at = ?2
      WHERE kind = 'class' AND class_code = ?3 AND plan = 'trial' AND status IN ('active', 'past_due')
      AND EXISTS (SELECT 1 FROM licence_codes WHERE ${VALID}) AND ${NOT_LICENSED}`).bind(hash, now, cls.code),
    env.DB.prepare(`INSERT INTO subscriptions (id, kind, account_id, class_code, plan, status, provider, seats, invoice_ref, current_period_start, current_period_end, note, created_at, updated_at)
      SELECT ?4, 'class', NULL, ?3, 'term', 'active', 'manual', seats, invoice_ref, ?2, until, note, ?2, ?2 FROM licence_codes
      WHERE ${VALID} AND ${NOT_LICENSED}`).bind(hash, now, cls.code, id),
    env.DB.prepare('UPDATE licence_codes SET classes_left = classes_left - 1 WHERE code_hash = ? AND EXISTS (SELECT 1 FROM subscriptions WHERE id = ?)').bind(hash, id),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail)
      SELECT ?, ?, 'licence.claim', ?, ? WHERE EXISTS (SELECT 1 FROM subscriptions WHERE id = ?)`)
      .bind(now, `teacher:${cls.code}`, `class:${cls.code}`, JSON.stringify({ seats: lc.seats, until: lc.until, invoice: lc.invoice_ref }), id),
  ]);
  if (Number(res[1].meta?.changes) !== 1) {
    if (await hasLicence(env, cls.code)) throw new HttpError(409, 'class_has_licence');
    throw new HttpError(400, 'bad_licence_code');
  }
  return json({ ok: true, until: lc.until, seats: lc.seats }, 200, cors);
}

/** POST /api/teacher/class/lock {locked}: close the class to new names (students already in it still sign in with their PIN). */
export async function lockClass(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, SMALL);
  if (typeof b.locked !== 'boolean') throw new HttpError(400, 'bad_request');
  await env.DB.batch([
    b.locked
      ? env.DB.prepare('INSERT OR IGNORE INTO class_locks (class_code, locked_at) VALUES (?, ?)').bind(cls.code, nowIso())
      : env.DB.prepare('DELETE FROM class_locks WHERE class_code = ?').bind(cls.code),
    audit(env, cls.code, 'class.lock', `class:${cls.code}`, { locked: b.locked }),
  ]);
  return json({ joinLocked: b.locked }, 200, cors);
}

/**
 * POST /api/teacher/students/:id/remove {}: one batch deletes the student's attempts, levels, help requests and exams, the
 * PIN counter, the restore code the class kept and every device token (DURABLE-6), and the student; the student's
 * devices are signed out. The practice saved on the device itself stays there, and so does its vault, which only the
 * device's own code opens now.
 */
export async function removeStudent(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  await body(req, SMALL);
  const st = await first(env, 'SELECT id FROM students WHERE id = ? AND class_code = ?', String(id), cls.code);
  if (!st) throw new HttpError(404, 'not_found');
  const mine = 'SELECT id FROM students WHERE id = ? AND class_code = ?';
  await env.DB.batch([
    ...['attempts', 'levels', 'help_requests', 'exams'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE student_id IN (${mine})`).bind(st.id, cls.code)),
    env.DB.prepare('DELETE FROM ai_usage WHERE who = ?').bind(`pin:${st.id}`),
    env.DB.prepare(`DELETE FROM vault_escrow WHERE owner_kind = 'student' AND owner_id IN (${mine})`).bind(st.id, cls.code),
    env.DB.prepare(`DELETE FROM student_tokens WHERE student_id IN (${mine})`).bind(st.id, cls.code),
    env.DB.prepare('DELETE FROM students WHERE id = ? AND class_code = ?').bind(st.id, cls.code),
    audit(env, cls.code, 'student.remove', `student:${st.id}`),
  ]);
  return json({ ok: true }, 200, cors);
}
