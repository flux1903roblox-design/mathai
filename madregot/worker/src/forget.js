// Deleting students and classes from the server (spec TRUST-6, TRUST-7). One list of the tables that hold a student's
// rows and one list of the counters keyed by a student or a class, and the statements built from them, so every path
// that deletes deletes the same things: the teacher removing a student (licence.js removeStudent), the teacher deleting
// a class (licence.js deleteClass), the night purge of idle students and classes (cron.js purgeClassSql), and the
// device's own "delete all" (POST /api/me/forget, TRUST-6 §1: forgetMe below), which also deletes a family device and
// the counters of an install.
import { body, json, nowIso, sha256, netKey, devKey, limitOrThrow } from './util.js';
import { studentFrom, deviceFrom, liveFamily } from './entitle.js';
import { flushNotices } from './email.js';
//
// A lane that adds a table holding a student's rows adds it to STUDENT_ROWS (a table keyed by a help request id goes
// before help_requests); a table or counter keyed by the class goes into classDeleteSteps and CLASS_COUNTERS.
// The practice saved on the devices themselves is never touched from here.
// (The same file as the school lane's on the main branch, without the teacher lane's three assignment tables and their
// counters, which this lane does not have. class_owners is here: the trust lane binds a class to an email too, TRUST-9.)

// An account's deletion (the parents' page, the owner's CLI, and the idle-account purge) lives in billing.js beside the
// money records it unlinks; it is named here too, so the data map (worker/datamap.json, purgedBy) finds every way a
// row is deleted in cron.js or this file (test/datamap.test.js).
export { forgetAccount } from './billing.js';

/**
 * [table, column] pairs: every row of a student, deleted before the student row itself. help_meta (a help request's
 * kind and care mark, TRUST-3) is keyed by the help request: [table, column, 'help'] means the column holds the ids of
 * the student's help requests, so it comes before help_requests. student_ai_off is the teacher's AI switch for the
 * student (TRUST-11). [table, column, 'tag'] means the column holds 'student:<id>': the audit rows about the student
 * (the teacher's AI switch for them, student.ai). The teacher's own student.remove row is written after these run.
 */
export const STUDENT_ROWS = [
  ['attempts', 'student_id'], ['levels', 'student_id'], ['help_meta', 'help_id', 'help'], ['help_requests', 'student_id'], ['exams', 'student_id'],
  ['student_ai_off', 'student_id'], ['audit_log', 'target', 'tag'],
];
/** The WHERE of one STUDENT_ROWS entry, for the students `sel` selects. */
const rowsOf = ([, col, via], sel) => {
  if (via === 'help') return `${col} IN (SELECT id FROM help_requests WHERE student_id IN (${sel}))`;
  if (via === 'tag') return `(${col} >= 'student:' AND ${col} < 'student;' AND substr(${col}, 9) IN (${sel}))`;
  return `${col} IN (${sel})`;
};
/**
 * ai_usage keys that carry a student id: <prefix><id>, or <prefix><id>:<more> (PIN tries, also per network (TRUST-12),
 * every AI tier and its tries, care (TRUST-3), and the student's reported AI answers (TRUST-4)).
 */
export const STUDENT_COUNTERS = ['pin:', 's:', 'free:s:', 'care:s:', 'report:s:'];
/**
 * ai_usage keys that carry a class code: the teacher's AI, the class's free and paid pools, the teacher's care and
 * reported-answer counters (TRUST-3, TRUST-4), and licence requests and claims.
 */
export const CLASS_COUNTERS = ['t:', 'free:t:', 'free:c:', 'cls:', 'care:t:', 'report:t:', 'licreq:c:', 'licclaim:c:'];

/**
 * SQL that is true for an ai_usage row whose key is <prefix><id> or <prefix><id>:<more>, with <id> in `sel` (a SELECT
 * of ids). The range on `who` uses the table's key, so the night purge does not scan every counter; the id is cut at
 * its first ':' so that one id is never taken for the start of another.
 */
export function keyIn(prefix, sel) {
  if (!/^[a-z:]+:$/.test(prefix)) throw new Error(`bad counter prefix ${prefix}`);
  const rest = `substr(who, ${prefix.length + 1})`;
  return `(who >= '${prefix}' AND who < '${prefix.slice(0, -1)};' AND (CASE WHEN instr(${rest}, ':') > 0 `
    + `THEN substr(${rest}, 1, instr(${rest}, ':') - 1) ELSE ${rest} END) IN (${sel}))`;
}
const countersStmt = (env, prefixes, sel, args) => env.DB.prepare(`DELETE FROM ai_usage WHERE ${prefixes.map((p) => keyIn(p, sel)).join(' OR ')}`).bind(...args);

/** One student's rows (STUDENT_ROWS): the statements for a batch that then deletes the counters and the student row. */
export const studentDeleteStmts = (env, id) => STUDENT_ROWS.map((r) => env.DB.prepare(`DELETE FROM ${r[0]} WHERE ${rowsOf(r, 'SELECT ?1')}`).bind(id));
/** One student's counters (STUDENT_COUNTERS). */
export const studentCountersStmt = (env, id) => countersStmt(env, STUDENT_COUNTERS, 'SELECT ?1', [id]);

/**
 * Everything of the students a query selects, as [name, statement] steps for one batch, in order: their rows, their
 * counters, and the student rows last, so `sel` finds the same students in every step. `sel` is a SELECT of student
 * ids written with numbered parameters (?1, ?2 …), bound to `args` in every statement.
 */
export function studentsDeleteSteps(env, sel, args = []) {
  return [
    ...STUDENT_ROWS.map((r) => ['studentRows', env.DB.prepare(`DELETE FROM ${r[0]} WHERE ${rowsOf(r, sel)}`).bind(...args)]),
    ['studentCounters', countersStmt(env, STUDENT_COUNTERS, sel, args)],
    ['students', env.DB.prepare(`DELETE FROM students WHERE id IN (${sel})`).bind(...args)],
  ];
}

/**
 * Everything of the classes a query selects, as [name, statement] steps for one batch: first their students with all
 * their rows (at most `limit` students in one batch, when given), then, for each class that has no student left, its
 * join lock, settings, counters, the notices about it and its audit rows (a licence's audit rows stay, as the licence
 * itself does: subscriptions, payments and licence requests keep the code, which names no one), and the class row
 * last. `sel` is a SELECT of class codes with numbered parameters, bound to `args`. A class whose students were not all
 * deleted in this batch (the limit) keeps its own rows until the next one.
 */
export function classDeleteSteps(env, sel, args = [], { limit } = {}) {
  const students = `SELECT id FROM students WHERE class_code IN (${sel})${limit ? ` ORDER BY id LIMIT ${Number(limit)}` : ''}`;
  const empty = `SELECT code FROM classes WHERE code IN (${sel}) AND NOT EXISTS (SELECT 1 FROM students s WHERE s.class_code = classes.code)`;
  const stmt = (sql) => env.DB.prepare(sql).bind(...args);
  return [
    ...studentsDeleteSteps(env, students, args),
    ['classLocks', stmt(`DELETE FROM class_locks WHERE class_code IN (${empty})`)],
    ['classSettings', stmt(`DELETE FROM class_settings WHERE code IN (${empty})`)],
    ['classOwners', stmt(`DELETE FROM class_owners WHERE class_code IN (${empty})`)],
    ['classCounters', countersStmt(env, CLASS_COUNTERS, empty, args)],
    ['classNotices', stmt(`DELETE FROM notices WHERE ref IN (${empty})`)],
    ['classAudit', stmt(`DELETE FROM audit_log WHERE action NOT LIKE 'licence.%' AND action != 'class.delete'
      AND (target IN (SELECT 'class:' || code FROM (${empty})) OR actor IN (SELECT 'teacher:' || code FROM (${empty})))`)],
    ['classes', stmt(`DELETE FROM classes WHERE code IN (${empty})`)],
  ];
}

/** The changes of a batch's results, added up by step name. */
export function countSteps(steps, results) {
  const out = {};
  steps.forEach(([name], i) => { out[name] = (out[name] || 0) + Number(results[i]?.meta?.changes || 0); });
  return out;
}

// ---------------------------------------------------------------- "delete all" from a device (TRUST-6 §1)
/**
 * ai_usage keys that carry a family device id (X-Family-Device): its free taste and tries, care and reported answers.
 * The family's own counters (fam:<account>…) are the parent's and stay.
 */
export const FAMILY_DEVICE_COUNTERS = ['fd:', 'free:fd:', 'care:fd:', 'report:fd:'];
/**
 * ai_usage keys that carry an install's devKey (X-Device, hashed: util.js devKey): its free taste and tries, link codes
 * asked for, care and reported answers. Pending link codes hold no device id (TRUST-1 §2) and expire within the hour.
 */
export const DEVICE_COUNTERS = ['free:d:', 'link:d:', 'care:d:', 'report:d:'];
export const familyDeviceCountersStmt = (env, id) => countersStmt(env, FAMILY_DEVICE_COUNTERS, 'SELECT ?1', [id]);
export const deviceCountersStmt = (env, dk) => countersStmt(env, DEVICE_COUNTERS, 'SELECT ?1', [dk]);

/**
 * Everything of one family device, children first: its counters, the link codes that made it, the notices and audit
 * rows about it (device_linked:<id>, device.link, device.unlink), and the device row. Bind nothing: the id is bound here.
 */
export function familyDeviceDeleteStmts(env, id) {
  const stmt = (sql) => env.DB.prepare(sql).bind(id);
  return [
    familyDeviceCountersStmt(env, id),
    stmt('DELETE FROM link_codes WHERE device_id = ?1'),
    stmt('DELETE FROM notices WHERE ref = ?1'),
    stmt("DELETE FROM audit_log WHERE target = 'device:' || ?1 OR actor = 'device:' || ?1"),
    stmt('DELETE FROM family_devices WHERE id = ?1'),
  ];
}

/** "Delete all" requests a day from one network. */
export const FORGET_NET_DAILY = 30;

/**
 * POST /api/me/forget {} (trust spec TRUST-6 §1): the device's "delete all" on the server, one batch for every header
 * that is valid, before anything is deleted on the device itself. Each header is optional:
 *   Authorization: Bearer <student token>  the student's rows (STUDENT_ROWS), counters and student row; the audit row
 *     (student.self_delete, target class:<code>) deliberately names no student;
 *   X-Family-Device: fd1.…  the device's counters, link codes, notices and audit rows, then the device row; the parent
 *     is told by email (device_unlinked:<time>, to the account, with the device's label only);
 *   X-Device  the install's counters, by its devKey.
 * forget:n:<net> 30 a day. Returns {ok, student, familyDevice, device}: whether anything of each was found and deleted
 * (so a second call answers false, false, false). Teachers delete students and classes from the dashboard instead;
 * this route never takes X-Teacher-Key.
 */
export async function forgetMe(req, env, ctx, cors) {
  await body(req, 1024);
  await limitOrThrow(env, `forget:n:${await netKey(req, env)}`, FORGET_NET_DAILY, 429, 'too_many_requests');
  const at = nowIso();
  const out = { ok: true, student: false, familyDevice: false, device: false };
  const stmts = [];
  const st = await studentFrom(req, env);
  if (st) {
    out.student = true;
    stmts.push(
      ...studentDeleteStmts(env, st.id),
      studentCountersStmt(env, st.id),
      env.DB.prepare('DELETE FROM students WHERE id = ?').bind(st.id),
      env.DB.prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, 'student', 'student.self_delete', ?, '{}')").bind(at, `class:${st.class_code}`),
    );
  }
  const token = String(req.headers.get('X-Family-Device') || '');
  const fd = /^fd1\.[a-f0-9]{64}$/.test(token)
    ? await env.DB.prepare('SELECT id, account_id, label FROM family_devices WHERE token_hash = ?').bind(await sha256(token)).first()
    : null;
  if (fd) {
    out.familyDevice = true;
    const plan = !!(await liveFamily(env, fd.account_id));
    stmts.push(
      ...familyDeviceDeleteStmts(env, fd.id),
      env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at) VALUES (?1, 'device_unlinked:' || ?2, ?1, ?3, ?2)`)
        .bind(fd.account_id, at, JSON.stringify({ label: fd.label || '', plan })),
      env.DB.prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, 'device', 'device.self_delete', ?, '{}')").bind(at, `account:${fd.account_id}`),
    );
  }
  const device = await deviceFrom(req, env);
  const devAt = device ? stmts.push(deviceCountersStmt(env, await devKey(env, device))) - 1 : -1;
  if (stmts.length) {
    const res = await env.DB.batch(stmts);
    if (devAt >= 0) out.device = Number(res[devAt]?.meta?.changes || 0) > 0;
  }
  if (fd) ctx?.waitUntil?.(flushNotices(env));
  return json(out, 200, cors);
}
