// Deleting students and classes from the server (spec TRUST-6, TRUST-7). One list of the tables that hold a student's
// rows and one list of the counters keyed by a student or a class, and the statements built from them, so every path
// that deletes deletes the same things: the teacher removing a student (licence.js removeStudent), the teacher deleting
// a class (licence.js deleteClass), and the night purge of idle students and classes (cron.js purgeClassSql). The
// student's own "delete all" (POST /api/me/forget, the trust lane) uses the same helper.
//
// A lane that adds a table holding a student's rows adds it to STUDENT_ROWS (a table keyed by a help request id goes
// before help_requests); a table or counter keyed by the class goes into classDeleteSteps and CLASS_COUNTERS.
// The practice saved on the devices themselves is never touched from here.

/**
 * [table, column] pairs: every row of a student, deleted before the student row itself. The teacher's assignments
 * (TEACHER-4): what the student did on each, and the assignments given to them by name. The trust lane's help_meta (a
 * help request's kind and care mark, TRUST-3) is keyed by the help request: [table, column, 'help'] means the column
 * holds the ids of the student's help requests, so it comes before help_requests. student_ai_off is the teacher's AI
 * switch for the student (TRUST-11).
 */
export const STUDENT_ROWS = [
  ['attempts', 'student_id'], ['levels', 'student_id'], ['help_meta', 'help_id', 'help'], ['help_requests', 'student_id'], ['exams', 'student_id'],
  ['assignment_work', 'student_id'], ['assignment_targets', 'student_id'], ['student_ai_off', 'student_id'],
];
/** The WHERE of one STUDENT_ROWS entry, for the students `sel` selects. */
const rowsOf = ([, col, via], sel) => (via === 'help' ? `${col} IN (SELECT id FROM help_requests WHERE student_id IN (${sel}))` : `${col} IN (${sel})`);
/**
 * ai_usage keys that carry a student id: <prefix><id>, or <prefix><id>:<more> (PIN tries, every AI tier, care, the
 * student's reported AI answers (TRUST-4), the student's assignment reports, and their replies to the teacher, TEACHER-6).
 */
export const STUDENT_COUNTERS = ['pin:', 's:', 'free:s:', 'care:s:', 'report:s:', 'work:s:', 'helpreply:s:'];
/**
 * ai_usage keys that carry a class code: the teacher's AI, the class's free and paid pools, the teacher's care and
 * reported-answer counters (TRUST-3, TRUST-4), licence requests and claims, the assignments made a day (TEACHER-4) and
 * the class report's exports (TEACHER-7).
 */
export const CLASS_COUNTERS = ['t:', 'free:t:', 'free:c:', 'cls:', 'care:t:', 'report:t:', 'licreq:c:', 'licclaim:c:', 'assign:c:', 'report:c:'];

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
