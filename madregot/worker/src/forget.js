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
// before help_requests); a table or counter keyed by the class goes into classDeleteSteps and CLASS_COUNTERS; a table
// or counter keyed by a family device goes into familyDeviceDeleteStmts and FAMILY_DEVICE_COUNTERS.
// The practice saved on the devices themselves is never touched from here.

// An account's deletion (the parents' page, the owner's CLI, and the idle-account purge) lives in billing.js beside the
// money records it unlinks; it is named here too, so the data map (worker/datamap.json, purgedBy) finds every way a
// row is deleted in cron.js or this file (test/datamap.test.js).
export { forgetAccount } from './billing.js';

/**
 * [table, column] pairs, or [table, column, via] for a table keyed by another table's id: every row of a student,
 * deleted before the student row itself. `via` is a SELECT of those ids by student ("SELECT id FROM help_requests WHERE
 * student_id"), so such a table comes before the table it reads. The trust lane's help_meta (a help request's kind and
 * care mark, TRUST-3) and the replies on the student's help requests (TEACHER-6) are keyed by the help request; the
 * teacher's assignments (TEACHER-4): what the student did on each, and the assignments given to them by name.
 */
export const STUDENT_ROWS = [
  ['attempts', 'student_id'], ['levels', 'student_id'],
  ['help_meta', 'help_id', 'SELECT id FROM help_requests WHERE student_id'],
  ['help_messages', 'help_id', 'SELECT id FROM help_requests WHERE student_id'],
  ['help_requests', 'student_id'], ['exams', 'student_id'],
  ['assignment_work', 'student_id'], ['assignment_targets', 'student_id'],
  // the teacher turned the AI off for this student (TRUST-11), and the audit rows of the teacher's actions on the
  // student (student.ai): they carry the student's id, so they go with the student
  ['student_ai_off', 'student_id'],
  ['audit_log', 'target', "SELECT 'student:' || id FROM students WHERE id"],
  // the durable lane (DURABLE-6): the restore code the class kept for the student (a 4th element is a condition the
  // rows must also meet: the table holds family accounts' codes too), and every device token of the student
  ['vault_escrow', 'owner_id', null, "owner_kind = 'student'"],
  ['student_tokens', 'student_id'],
];
/**
 * The WHERE of one STUDENT_ROWS entry, for a student test `match` ("= ?" or "IN (<a SELECT of ids>)"), with the entry's
 * own condition first when it has one.
 */
export const studentWhere = ([, col, via, and], match) => (and ? `${and} AND ` : '') + (via ? `${col} IN (${via} ${match})` : `${col} ${match}`);
/**
 * ai_usage keys that carry a student id: <prefix><id>, or <prefix><id>:<more> (PIN tries, also per network (TRUST-12),
 * every AI tier and its tries, care (TRUST-3), the student's reported AI answers (TRUST-4), the student's assignment
 * reports, and their replies to the teacher (TEACHER-6), and the student's backup lookups and escrow writes
 * (DURABLE-5, DURABLE-6: vault.js vault:miss:s:<id>, escrow:s:<id>)).
 */
export const STUDENT_COUNTERS = ['pin:', 's:', 'free:s:', 'care:s:', 'report:s:', 'work:s:', 'helpreply:s:', 'vault:miss:s:', 'escrow:s:'];
/**
 * ai_usage keys that carry a class code: the teacher's AI, the class's free and paid pools, the teacher's care and
 * reported-answer counters (TRUST-3, TRUST-4), licence requests and claims, the assignments made a day (TEACHER-4), the
 * class report's exports (TEACHER-7) and the student AI requests refused in a class whose AI is off (TRUST-11).
 */
export const CLASS_COUNTERS = ['t:', 'free:t:', 'free:c:', 'cls:', 'care:t:', 'report:t:', 'licreq:c:', 'licclaim:c:', 'assign:c:', 'report:c:', 'aioff:c:'];

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
export const studentDeleteStmts = (env, id) => STUDENT_ROWS.map((row) => env.DB.prepare(`DELETE FROM ${row[0]} WHERE ${studentWhere(row, '= ?')}`).bind(id));
/** One student's counters (STUDENT_COUNTERS). */
export const studentCountersStmt = (env, id) => countersStmt(env, STUDENT_COUNTERS, 'SELECT ?1', [id]);

/**
 * Everything of the students a query selects, as [name, statement] steps for one batch, in order: their rows, their
 * counters, and the student rows last, so `sel` finds the same students in every step. `sel` is a SELECT of student
 * ids written with numbered parameters (?1, ?2 …), bound to `args` in every statement.
 */
export function studentsDeleteSteps(env, sel, args = []) {
  return [
    ...STUDENT_ROWS.map((row) => ['studentRows', env.DB.prepare(`DELETE FROM ${row[0]} WHERE ${studentWhere(row, `IN (${sel})`)}`).bind(...args)]),
    ['studentCounters', countersStmt(env, STUDENT_COUNTERS, sel, args)],
    ['students', env.DB.prepare(`DELETE FROM students WHERE id IN (${sel})`).bind(...args)],
  ];
}

/**
 * Everything of the classes a query selects, as [name, statement] steps for one batch: first their students with all
 * their rows (at most `limit` students in one batch, when given), then, for each class that has no student left, its
 * join lock, settings, owner, assignments (with their work and targets), counters, the notices about it and its audit rows (a licence's audit rows stay, as the
 * licence itself does: subscriptions, payments and licence requests keep the code, which names no one), and the class
 * row last. `sel` is a SELECT of class codes with numbered parameters, bound to `args`. A class whose students were
 * not all deleted in this batch (the limit) keeps its own rows until the next one.
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
    // the class's assignments: what was done on them and who they were for go first (their students are gone already)
    ['assignmentWork', stmt(`DELETE FROM assignment_work WHERE assignment_id IN (SELECT id FROM assignments WHERE class_code IN (${empty}))`)],
    ['assignmentTargets', stmt(`DELETE FROM assignment_targets WHERE assignment_id IN (SELECT id FROM assignments WHERE class_code IN (${empty}))`)],
    ['assignments', stmt(`DELETE FROM assignments WHERE class_code IN (${empty})`)],
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
 * ai_usage keys that carry a family device id (X-Family-Device): its free taste and tries, care and reported answers,
 * its daily summaries for the parents (PARENTS-3: report.js sum:d:<id>), its backup lookups and escrow writes
 * (DURABLE-5, DURABLE-6: vault.js vault:miss:fd:<id>, escrow:fd:<id>). The family's own counters (fam:<account>…) are
 * the parent's and stay.
 */
export const FAMILY_DEVICE_COUNTERS = ['fd:', 'free:fd:', 'care:fd:', 'report:fd:', 'sum:d:', 'vault:miss:fd:', 'escrow:fd:'];
/**
 * ai_usage keys that carry an install's devKey (X-Device, hashed: util.js devKey): its free taste and tries, link codes
 * asked for, care and reported answers. Pending link codes hold no device id (TRUST-1 §2) and expire within the hour.
 */
export const DEVICE_COUNTERS = ['free:d:', 'link:d:', 'care:d:', 'report:d:'];
export const familyDeviceCountersStmt = (env, id) => countersStmt(env, FAMILY_DEVICE_COUNTERS, 'SELECT ?1', [id]);
export const deviceCountersStmt = (env, dk) => countersStmt(env, DEVICE_COUNTERS, 'SELECT ?1', [dk]);

/**
 * Everything of one family device, children first: its counters, the link codes that made it, the notices and audit
 * rows about it (device_linked:<id>, device.link, device.unlink), its daily summaries for the parents (PARENTS-3,
 * family_daily), and the device row. The device's escrow stays with the account ("התקדמות שמורה", as on an unlink:
 * family.js leaveFamily), without the device id. Bind nothing: the id is bound here.
 */
export function familyDeviceDeleteStmts(env, id) {
  const stmt = (sql) => env.DB.prepare(sql).bind(id);
  return [
    familyDeviceCountersStmt(env, id),
    stmt('DELETE FROM link_codes WHERE device_id = ?1'),
    stmt('DELETE FROM notices WHERE ref = ?1'),
    stmt("DELETE FROM audit_log WHERE target = 'device:' || ?1 OR actor = 'device:' || ?1"),
    stmt('UPDATE vault_escrow SET device_id = NULL WHERE device_id = ?1'),
    stmt('DELETE FROM family_daily WHERE device_id = ?1'),
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
