// Work a teacher gives the class (spec TEACHER-4) and the students' side of it (TEACHER-5 §1): a stair to learn (all
// five stages), a mastery check, or a class practice exam frozen at the moment it is sent, for the whole class or for
// chosen students, with a due date. Results are worked out on the student's device and reported here: practice, not a
// graded test. Late is a Jerusalem day (done_day > due_on), shown to the teacher only.
//
// Teacher routes (requireTeacher: the key, or the session of the account the class is bound to):
//   GET  /api/teacher/assignments              the class's assignments with their counts (at most 60)
//   POST /api/teacher/assignments              a new one: 201 {assignment, moved}
//   GET  /api/teacher/assignments/:id          one, with its exam's items and a row per assigned student
//   POST /api/teacher/assignments/:id          {dueOn?, note?, title?}: a later date, another note or title
//   POST /api/teacher/assignments/:id/delete   the assignment, its targets and its work, in one batch
// Student routes (requireStudent: the class token):
//   GET  /api/class/work                       the assignments for this student, with what they did on each
//   GET  /api/class/work/:id/exam              the frozen questions of a class exam assigned to them
//   POST /api/class/work/:id                   what they did: one monotonic upsert (never goes backwards)
// Deleting a student or a class deletes their work and targets (forget.js STUDENT_ROWS, classDeleteSteps); the night
// purge deletes an assignment 400 days after its due date (cron.js, shared/retention.js).
import { TOPIC_IDS } from '../../shared/ai.js';
import { HttpError, body, json, nowIso, dayOf, nextDay, isDay, randomToken, key, take, giveBack, limitOrThrow } from './util.js';
import { requireTeacher, requireStudent } from './entitle.js';
import { classSeenStmt, teacherDetail } from './licence.js';
import { myHelp } from './help.js';

const KB = 1024;
export const ASSIGN = Object.freeze({
  /** Open assignments in a class (due today − 14 or later). */
  open: 20,
  /** Assignments a class makes in a day (ai_usage assign:c:<code>). */
  perDay: 30,
  /** Students one assignment may name. */
  targets: 45,
  /** Questions in a class exam, and the frozen exam's size. */
  examItems: 14,
  examBytes: 48 * KB,
  /** How far ahead a due date may be. */
  aheadDays: 120,
  /** Work reports a student sends in a day (ai_usage work:s:<id>). */
  workPerDay: 200,
});
const LIMIT = { create: 64 * KB, small: 4 * KB };
/** Topics a teacher can assign: every stair topic of the app (the algebra lane's included), never 'other'. */
const TOPICS = TOPIC_IDS.filter((t) => t !== 'other');
const FORMS = ['num', 'mc', 'pt', 'line', 'lin'];
const STATUSES = ['correct', 'partial', 'wrong', 'missing'];

const bad = (field, extra = {}) => new HttpError(400, 'bad_assignment', undefined, { field, ...extra });
const badWork = (field) => new HttpError(400, 'bad_work', undefined, { field });
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const bytes = (s) => new TextEncoder().encode(s).length;

// ---------------------------------------------------------------- dates (YYYY-MM-DD in Jerusalem)
/** The day `n` days after `day`. */
export function plusDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
/**
 * A day with no school work due. Saturday until the student lane's shared/restDays.js lands; then its isRestDay
 * (Shabbat and Yom Tov) replaces this one, and the app's due-date hint uses the same function.
 */
export const isRestDay = (day) => new Date(`${day}T12:00:00Z`).getUTCDay() === 6;
/** A due date on a rest day moves to the next day that is not one: { day, moved }. */
export function schoolDay(day) {
  let d = day; let moved = false;
  while (isRestDay(d)) { d = nextDay(d); moved = true; }
  return { day: d, moved };
}
/** A due date the teacher may set today: from today to today + 120, moved off a rest day. Else 400 {field}. */
function dueDate(value, today, { from = today, field = 'dueOn' } = {}) {
  const v = String(value ?? '');
  if (!isDay(v) || v < today || v > plusDays(today, ASSIGN.aheadDays)) throw bad(field);
  const due = schoolDay(v);
  if (due.day < from) throw bad(field);
  return due;
}

// ---------------------------------------------------------------- what a teacher may send
/** Plain text: no control characters (and none of the marks that reorder text), trimmed, at most `max`. */
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/g;
export const cleanLine = (s, max) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanNote = (s, max) => String(s ?? '').replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

/** '<topic>:<level>' of a stair the app has (a topic of TOPIC_IDS, never 'other'; levels 1..12), else null. */
export function cleanSkill(v) {
  const m = String(v ?? '').match(/^([a-z]{2,10}):(\d{1,2})$/);
  if (!m || !TOPICS.includes(m[1])) return null;
  const level = Number(m[2]);
  return level >= 1 && level <= 12 ? `${m[1]}:${level}` : null;
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v, max) => typeof v === 'string' && v.length <= max;
const optStr = (v, max) => v === undefined || v === null || str(v, max);
/** One frozen question, with only the fields the app reads; null when a field is wrong. */
function cleanItem(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  if (!TOPICS.includes(it.topic) || !Number.isInteger(it.level) || it.level < 1 || it.level > 12) return null;
  if (!str(it.key, 80) || !it.key || !str(it.text, 600) || !optStr(it.display, 400) || !FORMS.includes(it.form)) return null;
  const a = it.answer;
  const choices = it.choices ?? null;
  if (choices !== null) {
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) return null;
    for (const c of choices) {
      if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).some((k) => k !== 'text' && k !== 'tex')) return null;
      if (!optStr(c.text, 200) || !optStr(c.tex, 200)) return null;
    }
  }
  const ok = {
    num: () => num(a),
    mc: () => Number.isInteger(a) && a >= 0 && !!choices && a < choices.length,
    pt: () => Array.isArray(a) && a.length === 2 && num(a[0]) && num(a[1]),
    line: () => !!a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 2 && num(a.m) && num(a.b),
    lin: () => !!a && typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 2 && num(a.k) && num(a.c),
  }[it.form]();
  if (!ok) return null;
  // `exact` is what a rounded Pythagoras length is graded against (num only); `var` is an expression's letter (lin only)
  if (it.exact != null && (it.form !== 'num' || !num(it.exact))) return null;
  if (it.var != null && (it.form !== 'lin' || typeof it.var !== 'string' || !/^[A-Za-z]$/.test(it.var))) return null;
  if (it.fig != null && (typeof it.fig !== 'object' || Array.isArray(it.fig) || bytes(JSON.stringify(it.fig)) > 2048)) return null;
  if (!optStr(it.label, 30) || !optStr(it.unit, 30) || !optStr(it.levelTitle, 80) || !optStr(it.answerText, 120) || !optStr(it.hint, 300)) return null;
  if (it.solution != null && (!Array.isArray(it.solution) || it.solution.length > 8 || !it.solution.every((x) => str(x, 300)))) return null;
  const out = {};
  for (const k of ['topic', 'level', 'key', 'text', 'display', 'form', 'answer', 'exact', 'var', 'choices', 'fig', 'label', 'unit', 'levelTitle', 'answerText', 'solution', 'hint']) {
    if (it[k] !== undefined) out[k] = it[k];
  }
  return out;
}
/**
 * A class exam's questions, frozen as the app made them: 1..14 items, each keeping only the fields above. A wrong
 * item is 400 bad_assignment {field: 'exam', index}; the whole above 48 KB is 413 too_large. Returns the JSON to keep.
 */
export function cleanExamItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > ASSIGN.examItems) throw bad('exam');
  const out = items.map((it, index) => {
    const c = cleanItem(it);
    if (!c) throw bad('exam', { index });
    return c;
  });
  const text = JSON.stringify(out);
  if (bytes(text) > ASSIGN.examBytes) throw new HttpError(413, 'too_large');
  return text;
}

// ---------------------------------------------------------------- reading assignments
// One aggregate: each assignment with the students it is for (the class's current students, or the named ones still in
// it) and what they did, by state. Late is by Jerusalem day: done after the due day, or not done when the day is over.
const LIST_SQL = `SELECT a.id, a.kind, a.skill, a.title, a.note, a.version, a.for_all, a.starts_on, a.due_on, a.created_at,
    a.exam IS NOT NULL AS has_exam, CASE WHEN a.exam IS NOT NULL THEN json_array_length(a.exam) END AS exam_count,
    (SELECT group_concat(t.student_id) FROM assignment_targets t JOIN students s ON s.id = t.student_id
      WHERE t.assignment_id = a.id AND s.class_code = a.class_code) AS target_ids,
    CASE WHEN a.for_all = 1 THEN (SELECT COUNT(*) FROM students s WHERE s.class_code = a.class_code)
      ELSE (SELECT COUNT(*) FROM assignment_targets t JOIN students s ON s.id = t.student_id
        WHERE t.assignment_id = a.id AND s.class_code = a.class_code) END AS assigned,
    COALESCE(SUM(w.state = 'started'), 0) AS started,
    COALESCE(SUM(w.state = 'done'), 0) AS done,
    COALESCE(SUM(w.state = 'done' AND w.done_day > a.due_on), 0) AS done_late
  FROM assignments a LEFT JOIN assignment_work w ON w.assignment_id = a.id`;

/** An assignment as the teacher's screens read it (never with its exam's items). */
function view(r, today) {
  const assigned = Number(r.assigned) || 0; const started = Number(r.started) || 0; const done = Number(r.done) || 0;
  const notStarted = Math.max(0, assigned - started - done);
  return {
    id: r.id, kind: r.kind, skill: r.skill, title: r.title, note: r.note, startsOn: r.starts_on, dueOn: r.due_on,
    forAll: !!r.for_all, targets: r.target_ids ? String(r.target_ids).split(',').sort() : [], createdAt: r.created_at,
    hasExam: !!r.has_exam, examCount: r.exam_count == null ? null : Number(r.exam_count), version: r.version || null,
    counts: { assigned, notStarted, started, done, late: Number(r.done_late) + (r.due_on < today ? assigned - done : 0) },
  };
}

/**
 * The class's assignments with their counts. `open`: only those due `open` days ago or later, soonest first; else all,
 * the latest due date first. Also used by the dashboard.
 */
export async function classAssignments(env, code, { open = null, limit = 60, id = null } = {}) {
  const today = dayOf();
  const where = ['a.class_code = ?1'];
  const args = [code];
  if (open != null) { where.push(`a.due_on >= ?${args.length + 1}`); args.push(plusDays(today, -open)); }
  if (id) { where.push(`a.id = ?${args.length + 1}`); args.push(id); }
  const order = open != null ? 'a.due_on ASC, a.created_at ASC' : 'a.due_on DESC, a.created_at DESC';
  const list = await all(env, `${LIST_SQL} WHERE ${where.join(' AND ')} GROUP BY a.id ORDER BY ${order} LIMIT ${Number(limit)}`, ...args);
  return list.map((r) => view(r, today));
}
const oneAssignment = async (env, code, id) => (await classAssignments(env, code, { id, limit: 1 }))[0] || null;
const auditStmt = (env, cls, action, id, detail = {}) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(nowIso(), `teacher:${cls.code}`, action, `assignment:${id}`, teacherDetail(cls, detail));

// ---------------------------------------------------------------- teacher routes
/** GET /api/teacher/assignments → {today, assignments}: the latest due date first, at most 60, no exam items. */
export async function listAssignments(req, env, cors) {
  const cls = await requireTeacher(req, env);
  return json({ today: dayOf(), assignments: await classAssignments(env, cls.code) }, 200, cors);
}

/**
 * POST /api/teacher/assignments {kind, skill?, title, note?, startsOn?, dueOn, targets?, exam?: {items, version}}
 * → 201 {assignment, moved}. At most 20 open in a class (409 too_many_open) and 30 made a day (429
 * too_many_assignments). A due date on a rest day moves to the next day (moved: true).
 */
export async function createAssignment(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, LIMIT.create);
  const today = dayOf();
  const kind = ['stair', 'check', 'exam'].includes(b.kind) ? b.kind : null;
  if (!kind) throw bad('kind');
  const skill = kind === 'exam' ? null : cleanSkill(b.skill);
  if (kind !== 'exam' && !skill) throw bad('skill');
  const startsOn = b.startsOn == null ? today : String(b.startsOn);
  if (!isDay(startsOn) || startsOn < today) throw bad('startsOn');
  const due = dueDate(b.dueOn, today, { from: startsOn });
  let exam = null; let version = null;
  if (kind === 'exam') {
    if (!b.exam || typeof b.exam !== 'object') throw bad('exam');
    version = b.exam.version == null ? 'a' : b.exam.version;
    if (!['a', 'b'].includes(version)) throw bad('version');
    exam = cleanExamItems(b.exam.items);
  }
  const title = cleanLine(b.title, 80) || (kind === 'exam' ? 'מבחן תרגול' : skill);
  const note = cleanNote(b.note, 200);
  // the students it is for: all of them, or 1..45 named ones of this class
  let targets = [];
  if (b.targets != null && !(Array.isArray(b.targets) && b.targets.length === 0)) {
    if (!Array.isArray(b.targets) || b.targets.length > ASSIGN.targets || !b.targets.every((t) => typeof t === 'string' && /^[a-f0-9]{1,64}$/.test(t))) throw bad('targets');
    targets = [...new Set(b.targets)];
    const found = await all(env, `SELECT id FROM students WHERE class_code = ? AND id IN (${targets.map(() => '?').join(',')})`, cls.code, ...targets);
    if (found.length !== targets.length) throw bad('targets');
  }
  const openFrom = plusDays(today, -14);
  const openNow = await first(env, 'SELECT COUNT(*) AS n FROM assignments WHERE class_code = ? AND due_on >= ?', cls.code, openFrom);
  if (openNow.n >= ASSIGN.open) throw new HttpError(409, 'too_many_open');
  const day = key(`assign:c:${cls.code}`, ASSIGN.perDay, { refundable: true, err: new HttpError(429, 'too_many_assignments') });
  const t = await take(env, [day]);
  if (!t.ok) throw t.error;
  const id = randomToken(8);
  const made = nowIso();
  // the open cap is checked again in the insert itself, so two teachers' devices at once cannot pass it together
  const exists = 'EXISTS (SELECT 1 FROM assignments WHERE id = ?1)';
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO assignments (id, class_code, kind, skill, title, note, exam, version, for_all, starts_on, due_on, created_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
      WHERE (SELECT COUNT(*) FROM assignments WHERE class_code = ?2 AND due_on >= ?13) < ?14`)
      .bind(id, cls.code, kind, skill, title, note, exam, version, targets.length ? 0 : 1, startsOn, due.day, made, openFrom, ASSIGN.open),
    ...targets.map((sid) => env.DB.prepare(`INSERT INTO assignment_targets (assignment_id, student_id) SELECT ?1, ?2 WHERE ${exists}`).bind(id, sid)),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?2, ?3, 'assignment.create', 'assignment:' || ?1, ?4 WHERE ${exists}`)
      .bind(id, made, `teacher:${cls.code}`, teacherDetail(cls, { kind, skill, targets: targets.length })),
  ]);
  if (!res[0]?.meta?.changes) { await giveBack(env, [day]); throw new HttpError(409, 'too_many_open'); }
  return json({ assignment: await oneAssignment(env, cls.code, id), moved: due.moved }, 201, cors);
}

/** The teacher's assignment of this class, or 404. */
async function ownRow(env, cls, id) {
  const row = await first(env, 'SELECT * FROM assignments WHERE id = ? AND class_code = ?', String(id), cls.code);
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

/**
 * GET /api/teacher/assignments/:id → {assignment, exam: {items} | null, work}: one row per assigned student, not started
 * first, then started, then done, each by name.
 */
export async function getAssignment(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const row = await ownRow(env, cls, id);
  const today = dayOf();
  const list = await all(env, `SELECT s.id, s.name, w.state, w.stage, w.right_n, w.asked, w.passed, w.questions, w.tries, w.started_at, w.done_at, w.done_day
    FROM students s LEFT JOIN assignment_work w ON w.assignment_id = ?1 AND w.student_id = s.id
    WHERE s.class_code = ?2 AND (?3 = 1 OR s.id IN (SELECT student_id FROM assignment_targets WHERE assignment_id = ?1))
    ORDER BY CASE w.state WHEN 'done' THEN 2 WHEN 'started' THEN 1 ELSE 0 END, s.name`, row.id, cls.code, row.for_all);
  const work = list.map((w) => ({
    studentId: w.id, name: w.name, state: w.state || 'none', stage: w.stage, right: w.right_n, asked: w.asked,
    passed: w.passed == null ? null : !!w.passed, questions: w.questions ? JSON.parse(w.questions) : null, tries: w.tries || 0,
    startedAt: w.started_at || null, doneAt: w.done_at || null,
    late: w.state === 'done' ? w.done_day > row.due_on : row.due_on < today,
  }));
  return json({ assignment: await oneAssignment(env, cls.code, row.id), exam: row.exam ? { items: JSON.parse(row.exam) } : null, work }, 200, cors);
}

/** POST /api/teacher/assignments/:id {dueOn?, note?, title?} → {assignment, moved}. A new due date: today to +120. */
export async function updateAssignment(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, LIMIT.small);
  const row = await ownRow(env, cls, id);
  const today = dayOf();
  const set = {}; let moved = false;
  if (b.dueOn !== undefined) { const due = dueDate(b.dueOn, today, { from: row.starts_on }); set.due_on = due.day; moved = due.moved; }
  if (b.note !== undefined) set.note = cleanNote(b.note, 200);
  if (b.title !== undefined) { const title = cleanLine(b.title, 80); if (!title) throw bad('title'); set.title = title; }
  const cols = Object.keys(set);
  if (cols.length) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE assignments SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND class_code = ?`).bind(...cols.map((c) => set[c]), row.id, cls.code),
      auditStmt(env, cls, 'assignment.update', row.id, { fields: cols }),
    ]);
  }
  return json({ assignment: await oneAssignment(env, cls.code, row.id), moved }, 200, cors);
}

/** POST /api/teacher/assignments/:id/delete {} → {ok}: its work, its targets and the assignment, in one batch. */
export async function deleteAssignment(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  await body(req, LIMIT.small);
  const row = await ownRow(env, cls, id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM assignment_work WHERE assignment_id = ?').bind(row.id),
    env.DB.prepare('DELETE FROM assignment_targets WHERE assignment_id = ?').bind(row.id),
    env.DB.prepare('DELETE FROM assignments WHERE id = ? AND class_code = ?').bind(row.id, cls.code),
    auditStmt(env, cls, 'assignment.delete', row.id, { kind: row.kind }),
  ]);
  return json({ ok: true }, 200, cors);
}

// ---------------------------------------------------------------- student routes
// An assignment is this student's when it is for the whole class or names them, and it has started.
const MINE = `a.class_code = ?2 AND a.starts_on <= ?3
  AND (a.for_all = 1 OR EXISTS (SELECT 1 FROM assignment_targets t WHERE t.assignment_id = a.id AND t.student_id = ?1))`;
const mineView = (w) => (w && w.state ? {
  state: w.state, stage: w.stage ?? null, right: w.right_n ?? null, asked: w.asked ?? null,
  passed: w.passed == null ? null : !!w.passed, doneAt: w.done_at || null,
} : null);

/**
 * GET /api/class/work → {today, teacherName, assignments, help}: the started assignments for this student due in the
 * last 14 days or later, and older ones (30 days) not done yet; not done first, by due date; at most 20. Each carries
 * createdAt, so the app can mark work that is new since the student last looked. `help`: the student's own help
 * requests of the last 30 days with where each stands and the replies on it (help.js myHelp, TEACHER-6), never a page.
 */
export async function classWork(req, env, cors) {
  const s = await requireStudent(req, env);
  const today = dayOf();
  const [cls, list, help] = await Promise.all([
    first(env, 'SELECT teacher_name FROM classes WHERE code = ?', s.class_code),
    all(env, `SELECT a.id, a.kind, a.skill, a.title, a.note, a.starts_on, a.due_on, a.created_at, a.exam IS NOT NULL AS has_exam,
        CASE WHEN a.exam IS NOT NULL THEN json_array_length(a.exam) END AS exam_count,
        w.state, w.stage, w.right_n, w.asked, w.passed, w.done_at
      FROM assignments a LEFT JOIN assignment_work w ON w.assignment_id = a.id AND w.student_id = ?1
      WHERE ${MINE} AND (a.due_on >= ?4 OR (COALESCE(w.state, '') != 'done' AND a.due_on >= ?5))
      ORDER BY CASE WHEN w.state = 'done' THEN 1 ELSE 0 END, a.due_on, a.created_at LIMIT 20`,
    s.id, s.class_code, today, plusDays(today, -14), plusDays(today, -30)),
    myHelp(env, s.id),
  ]);
  return json({
    today, teacherName: cls?.teacher_name || '',
    assignments: list.map((a) => ({
      id: a.id, kind: a.kind, skill: a.skill, title: a.title, note: a.note, startsOn: a.starts_on, dueOn: a.due_on, createdAt: a.created_at,
      hasExam: !!a.has_exam, examCount: a.exam_count == null ? null : Number(a.exam_count), mine: mineView(a),
    })),
    help,
  }, 200, cors);
}

/** This student's assignment (started, for them), or 404. */
async function mineRow(env, s, id) {
  const row = await first(env, `SELECT a.* FROM assignments a WHERE a.id = ?4 AND ${MINE}`, s.id, s.class_code, dayOf(), String(id));
  if (!row) throw new HttpError(404, 'not_found');
  return row;
}

/** GET /api/class/work/:id/exam → {items}: the class exam's questions, for a student it is assigned to. */
export async function workExam(id, req, env, cors) {
  const s = await requireStudent(req, env);
  const row = await mineRow(env, s, id);
  if (!row.exam) throw new HttpError(404, 'not_found');
  return json({ items: JSON.parse(row.exam) }, 200, cors);
}

/** Which result fields each kind reports. */
const FIELDS = { stair: ['stage', 'passed'], check: ['right', 'asked', 'passed'], exam: ['right', 'asked', 'questions'] };
/** A report checked against its assignment's kind: {state, stage, right, asked, passed, questions (JSON)}. */
export function cleanWork(b, kind) {
  const state = b.state;
  if (state !== 'started' && state !== 'done') throw badWork('state');
  const has = (k) => b[k] !== undefined && b[k] !== null;
  for (const k of ['stage', 'right', 'asked', 'passed', 'questions']) if (has(k) && !FIELDS[kind].includes(k)) throw badWork(k);
  const out = { state, stage: null, right: null, asked: null, passed: null, questions: null };
  if (has('stage')) { if (!Number.isInteger(b.stage) || b.stage < 0 || b.stage > 5) throw badWork('stage'); out.stage = b.stage; }
  if (has('passed')) { if (typeof b.passed !== 'boolean') throw badWork('passed'); out.passed = b.passed ? 1 : 0; }
  // a check or an exam reports its result once it is done, and only then
  if (kind !== 'stair') {
    if (state === 'done' && (!has('right') || !has('asked'))) throw badWork('right');
    if (state === 'started' && (has('right') || has('asked') || has('questions'))) throw badWork('right');
  }
  if (has('asked')) { if (!Number.isInteger(b.asked) || b.asked < 1 || b.asked > 40) throw badWork('asked'); out.asked = b.asked; }
  if (has('right')) { if (!Number.isInteger(b.right) || b.right < 0 || b.right > out.asked) throw badWork('right'); out.right = b.right; }
  if (has('questions')) {
    const q = b.questions;
    if (!Array.isArray(q) || q.length > 40) throw badWork('questions');
    const clean = q.map((x) => {
      if (!x || typeof x !== 'object' || !TOPIC_IDS.includes(x.topic) || !Number.isInteger(x.level) || x.level < 1 || x.level > 12 || !STATUSES.includes(x.status)) throw badWork('questions');
      return { topic: x.topic, level: x.level, status: x.status };
    });
    out.questions = JSON.stringify(clean);
  }
  return out;
}

/**
 * POST /api/class/work/:id {state, stage?, right?, asked?, passed?, questions?} → {mine}. One upsert that never goes
 * backwards, so a report sent twice, late or out of order changes nothing it should not: done stays done; the stage and
 * passed only go up; the first finished result (right, asked, questions) is kept, and every finished try is counted;
 * started_at, done_at and done_day (the Jerusalem day of the first 'done', compared with due_on) are set once.
 * 200 reports a student a day.
 */
export async function postWork(id, req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, LIMIT.small);
  const row = await mineRow(env, s, id);
  const w = cleanWork(b, row.kind);
  await limitOrThrow(env, `work:s:${s.id}`, ASSIGN.workPerDay, 429, 'slow_down');
  const now = nowIso(); const day = dayOf();
  const done = w.state === 'done';
  const [up] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO assignment_work (assignment_id, student_id, state, stage, right_n, asked, passed, questions, tries, started_at, done_at, done_day, updated_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?10 WHERE EXISTS (SELECT 1 FROM assignments WHERE id = ?1)
      ON CONFLICT (assignment_id, student_id) DO UPDATE SET
        state = CASE WHEN assignment_work.state = 'done' OR excluded.state = 'done' THEN 'done' ELSE 'started' END,
        stage = NULLIF(MAX(COALESCE(assignment_work.stage, -1), COALESCE(excluded.stage, -1)), -1),
        passed = NULLIF(MAX(COALESCE(assignment_work.passed, -1), COALESCE(excluded.passed, -1)), -1),
        right_n = CASE WHEN assignment_work.done_at IS NULL AND excluded.done_at IS NOT NULL THEN excluded.right_n ELSE assignment_work.right_n END,
        asked = CASE WHEN assignment_work.done_at IS NULL AND excluded.done_at IS NOT NULL THEN excluded.asked ELSE assignment_work.asked END,
        questions = CASE WHEN assignment_work.done_at IS NULL AND excluded.done_at IS NOT NULL THEN excluded.questions ELSE assignment_work.questions END,
        tries = MIN(99, assignment_work.tries + excluded.tries),
        done_at = COALESCE(assignment_work.done_at, excluded.done_at),
        done_day = COALESCE(assignment_work.done_day, excluded.done_day),
        updated_at = excluded.updated_at
      RETURNING state, stage, right_n, asked, passed, done_at`)
      .bind(row.id, s.id, w.state, w.stage, w.right, w.asked, w.passed, w.questions, done ? 1 : 0, now, done ? now : null, done ? day : null),
    env.DB.prepare('UPDATE students SET last_seen = ? WHERE id = ?').bind(now, s.id),
    classSeenStmt(env, s.class_code),
  ]);
  const mine = up?.results?.[0];
  if (!mine) throw new HttpError(404, 'not_found');
  return json({ mine: mineView(mine) }, 200, cors);
}
