// The class report (spec TEACHER-7), and one student's page (TEACHER-8, studentDetail at the end of this file).
// The class report: the class over a range of days, for the screen, the printout and the CSV the
// teacher downloads. Per student: active days, exercises, first-try and correct answers, hints, minutes, last practice,
// the stair on each topic and their most frequent mistakes; the assignments due in the range with each student's work;
// and the class's repeated mistakes. The numbers are the dashboard's own queries (index.js dashboard) over
// a.day BETWEEN from AND to, so the report's week is the board's week.
//
//   GET /api/teacher/report?from=YYYY-MM-DD&to=YYYY-MM-DD   (requireTeacher)
//   GET /api/teacher/students/:id                           (requireTeacher; the student's page, with the student's id)
//
// No student id is in the answer: students are rows ordered by name, an assignment's work is keyed by the row's index,
// and nothing else carries an id (the assignments' ids neither). Only what the students typed as their names, never an
// ID number: the class join asks for a first name. 60 reports an hour per class (ai_usage report:c:<code>).
import { HttpError, json, dayOf, isDay, nowIso, limitOrThrow } from './util.js';
import { requireTeacher } from './entitle.js';
import { plusDays } from './assignments.js';
import { myHelp } from './help.js';

export const REPORT = Object.freeze({
  /** The longest range, in days (from and to both counted). A longer one is cut to its last 400 days. */
  maxDays: 400,
  /** The range when none is asked: the last 14 days, today included. */
  defaultDays: 14,
  /** Reports a class asks for in an hour. */
  perHour: 60,
  /** The class's repeated mistakes, as on the board; and a student's own, most frequent first. */
  mistakes: 12,
  studentMistakes: 3,
  /** Assignments in the range, at most (the earliest due first). */
  assignments: 200,
});

/**
 * The range a request asks for: { from, to }. `to` is at most today (a later day is today); with no `to`, today; with
 * no `from`, the 14 days that end on `to`. A range longer than 400 days keeps its last 400. A day that is not
 * YYYY-MM-DD, or `from` after `to`, is 400 bad_range.
 */
export function reportRange(params, today = dayOf()) {
  const f = params.get('from'); const t = params.get('to');
  if ((f && !isDay(f)) || (t && !isDay(t))) throw new HttpError(400, 'bad_range');
  const to = t && t < today ? t : today;
  let from = f || plusDays(to, -(REPORT.defaultDays - 1));
  if (from > to) throw new HttpError(400, 'bad_range');
  const earliest = plusDays(to, -(REPORT.maxDays - 1));
  if (from < earliest) from = earliest;
  return { from, to };
}

/**
 * The assignments of a range: due in it, and also those still open in it (started by its end and due after it), so the
 * report of this week shows the work due next week too.
 */
const IN_RANGE = 'a.class_code = ?1 AND a.due_on >= ?2 AND a.starts_on <= ?3';
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const num = (v) => Number(v) || 0;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Mistake rows in a fixed order: most answers first, then by topic, stair and mistake. */
const byMistake = (a, b) => b.n - a.n || cmp(a.topic, b.topic) || a.level - b.level || cmp(a.cat, b.cat);

/** GET /api/teacher/report?from&to → the report (see the top of this file). */
export async function classReport(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const today = dayOf();
  const { from, to } = reportRange(new URL(req.url).searchParams, today);
  await limitOrThrow(env, `report:c:${cls.code}`, REPORT.perHour, 429, 'too_many_reports', 'hour');
  const code = cls.code;
  const [students, rangeRows, lastRows, levelRows, studentCats, catRows, catNames, assignments, work, targets] = await Promise.all([
    all(env, 'SELECT id, name, created_at FROM students WHERE class_code = ? ORDER BY name, id', code),
    // the dashboard's week query, over the range
    all(env, `SELECT a.student_id, COUNT(*) AS n, SUM(a.ok) AS ok, SUM(a.first_try) AS first, SUM(a.hint) AS hint,
        COUNT(DISTINCT a.day) AS days, SUM(a.secs) AS secs
      FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? AND a.day BETWEEN ? AND ? GROUP BY a.student_id`, code, from, to),
    // the last practice up to the range's end, so a closed range always gives the same report
    all(env, `SELECT a.student_id, MAX(a.at) AS last FROM attempts a JOIN students s ON s.id = a.student_id
      WHERE s.class_code = ? AND a.day <= ? GROUP BY a.student_id`, code, to),
    all(env, 'SELECT l.student_id, l.topic, l.level, l.max_level FROM levels l JOIN students s ON s.id = l.student_id WHERE s.class_code = ?', code),
    // each student's mistakes in the range, by stair (the stair names the words the student saw)
    all(env, `SELECT a.student_id, a.topic, a.level, a.cat, COUNT(*) AS n FROM attempts a JOIN students s ON s.id = a.student_id
      WHERE s.class_code = ? AND a.day BETWEEN ? AND ? AND a.cat IS NOT NULL GROUP BY a.student_id, a.topic, a.level, a.cat`, code, from, to),
    // the class's repeated mistakes, as the dashboard has them: one row per stair and mistake (TEACHER-16), most
    // students first
    all(env, `SELECT a.topic, a.level, a.cat, COUNT(*) AS n, COUNT(DISTINCT a.student_id) AS students
      FROM attempts a JOIN students s ON s.id = a.student_id
      WHERE s.class_code = ? AND a.day BETWEEN ? AND ? AND a.cat IS NOT NULL GROUP BY a.topic, a.level, a.cat
      ORDER BY students DESC, n DESC, a.topic, a.level, a.cat LIMIT ${REPORT.mistakes}`, code, from, to),
    all(env, `SELECT DISTINCT a.topic, a.level, a.cat, s.id, s.name FROM attempts a JOIN students s ON s.id = a.student_id
      WHERE s.class_code = ? AND a.day BETWEEN ? AND ? AND a.cat IS NOT NULL ORDER BY s.name, s.id`, code, from, to),
    all(env, `SELECT a.id, a.kind, a.skill, a.title, a.for_all, a.due_on FROM assignments a WHERE ${IN_RANGE}
      ORDER BY a.due_on, a.created_at, a.id LIMIT ${REPORT.assignments}`, code, from, to),
    all(env, `SELECT w.assignment_id, w.student_id, w.state, w.stage, w.right_n, w.asked, w.passed, w.tries, w.done_day
      FROM assignment_work w JOIN assignments a ON a.id = w.assignment_id WHERE ${IN_RANGE}`, code, from, to),
    all(env, `SELECT t.assignment_id, t.student_id FROM assignment_targets t JOIN assignments a ON a.id = t.assignment_id
      WHERE ${IN_RANGE}`, code, from, to),
  ]);

  const by = (rows) => Object.fromEntries(rows.map((r) => [r.student_id, r]));
  const range = by(rangeRows); const last = by(lastRows);
  const levels = {};
  for (const r of levelRows) (levels[r.student_id] ||= {})[r.topic] = { level: r.level, max: r.max_level };
  // a student's mistakes: one row per stair and mistake (TEACHER-16: the words the student saw on that stair)
  const mine = {};
  for (const r of studentCats) (mine[r.student_id] ||= []).push({ topic: r.topic, cat: r.cat, level: Number(r.level), n: num(r.n) });
  const topMistakes = (sid) => (mine[sid] || []).sort(byMistake).slice(0, REPORT.studentMistakes);

  const row = Object.fromEntries(students.map((s, i) => [s.id, i]));
  const done = {};
  for (const w of work) (done[w.assignment_id] ||= {})[w.student_id] = w;
  const named = {};
  for (const t of targets) (named[t.assignment_id] ||= new Set()).add(t.student_id);

  return json({
    class: { name: cls.name, grade: cls.grade, teacherName: cls.teacher_name },
    from, to, today, generatedAt: nowIso(),
    students: students.map((s) => {
      const r = range[s.id];
      return {
        name: s.name,
        joinedOn: s.created_at ? dayOf(new Date(s.created_at)) : null,
        lastPractice: last[s.id]?.last || null,
        activeDays: num(r?.days), exercises: num(r?.n), firstTry: num(r?.first), correct: num(r?.ok), hinted: num(r?.hint),
        minutes: Math.round(num(r?.secs) / 60),
        levels: levels[s.id] || {},
        topMistakes: topMistakes(s.id),
      };
    }),
    assignments: assignments.map((a) => {
      const w = {};
      for (const s of students) {
        if (!a.for_all && !named[a.id]?.has(s.id)) continue;
        const x = done[a.id]?.[s.id];
        const state = x?.state || 'none';
        w[row[s.id]] = {
          state, stage: x?.stage ?? null, right: x?.right_n ?? null, asked: x?.asked ?? null,
          passed: x?.passed == null ? null : !!x.passed, tries: num(x?.tries),
          late: state === 'done' ? x.done_day > a.due_on : a.due_on < today,
        };
      }
      return { title: a.title, kind: a.kind, skill: a.skill, dueOn: a.due_on, work: w };
    }),
    mistakes: catRows.map((r) => ({
      topic: r.topic, cat: r.cat, level: r.level == null ? null : Number(r.level), n: num(r.n), students: num(r.students),
      names: catNames.filter((c) => c.topic === r.topic && c.level === r.level && c.cat === r.cat).map((c) => c.name),
    })),
  }, 200, cors);
}

// ---------------------------------------------------------------- one student's page (spec TEACHER-8 §1)
export const DETAIL = Object.freeze({
  /** The strip of days: the last 14, today included, zero days filled. */
  days: 14,
  /** Repeated mistakes: this many days back, the most frequent this many. */
  mistakeDays: 30,
  mistakes: 8,
  /** Given work: due this many days back, or later; at most this many, the latest due first. */
  workDays: 60,
  work: 40,
  /** Exams checked in the app and class exams solved in it: the newest this many. */
  exams: 20,
});

/**
 * GET /api/teacher/students/:id (requireTeacher): one student of the class, for the student's sheet on the board.
 * A student of another class, or none, is 404 not_found.
 *   { student: { id, name, joinedOn, lastPractice, pinReset, aiOff },   aiOff: the teacher turned the AI off for them (TRUST-11)
 *     days14: [{ day, n, first, minutes }]          the last 14 Jerusalem days, oldest first, a day with no practice as zeros
 *     levels: { [topic]: { level, max } },
 *     mistakes: [{ topic, cat, level, n, lastAt }]   the last 30 days, one row per stair and mistake (TEACHER-16), most
 *                                                   frequent first, at most 8
 *     work: [{ assignmentId, title, kind, dueOn, state, stage, right, asked, passed, late }]   given to the student, due
 *                                                   in the last 60 days or later; late as in the class report
 *     help: [{ id, topic, question, createdAt, status }]   the last 30 days, newest first (status as the student sees it)
 *     exams: [{ id, title, correct, total, at, questions }] }   newest first, class exams solved in the app included
 */
export async function studentDetail(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const s = await env.DB.prepare(`SELECT id, name, created_at, pin_hash = '' AS pin_reset,
    EXISTS (SELECT 1 FROM student_ai_off so WHERE so.student_id = students.id) AS ai_off FROM students WHERE id = ? AND class_code = ?`)
    .bind(String(id), cls.code).first();
  if (!s) throw new HttpError(404, 'not_found');
  const today = dayOf();
  const from14 = plusDays(today, -(DETAIL.days - 1));
  const from30 = plusDays(today, -(DETAIL.mistakeDays - 1));
  const workFrom = plusDays(today, -DETAIL.workDays);
  const [dayRows, lastRow, levelRows, catRows, work, help, examRows, classExams] = await Promise.all([
    all(env, `SELECT day, COUNT(*) AS n, SUM(first_try) AS first, SUM(secs) AS secs FROM attempts
      WHERE student_id = ? AND day >= ? GROUP BY day`, s.id, from14),
    env.DB.prepare('SELECT MAX(at) AS last FROM attempts WHERE student_id = ?').bind(s.id).first(),
    all(env, 'SELECT topic, level, max_level FROM levels WHERE student_id = ?', s.id),
    all(env, `SELECT topic, cat, level, COUNT(*) AS n, MAX(at) AS last_at FROM attempts
      WHERE student_id = ? AND day >= ? AND cat IS NOT NULL GROUP BY topic, cat, level`, s.id, from30),
    all(env, `SELECT a.id, a.title, a.kind, a.due_on, w.state, w.stage, w.right_n, w.asked, w.passed, w.done_day
      FROM assignments a LEFT JOIN assignment_work w ON w.assignment_id = a.id AND w.student_id = ?1
      WHERE a.class_code = ?2 AND a.due_on >= ?3 AND a.starts_on <= ?4
        AND (a.for_all = 1 OR EXISTS (SELECT 1 FROM assignment_targets t WHERE t.assignment_id = a.id AND t.student_id = ?1))
      ORDER BY a.due_on DESC, a.created_at DESC, a.id LIMIT ${DETAIL.work}`, s.id, cls.code, workFrom, today),
    myHelp(env, s.id),
    all(env, `SELECT id, title, correct, total, questions, created_at FROM exams WHERE student_id = ?
      ORDER BY created_at DESC LIMIT ${DETAIL.exams}`, s.id),
    all(env, `SELECT w.assignment_id, a.title, w.right_n, w.asked, w.questions, w.done_at FROM assignment_work w
      JOIN assignments a ON a.id = w.assignment_id WHERE w.student_id = ? AND a.class_code = ? AND a.kind = 'exam' AND w.state = 'done'
      ORDER BY w.done_at DESC LIMIT ${DETAIL.exams}`, s.id, cls.code),
  ]);

  const byDay = Object.fromEntries(dayRows.map((r) => [r.day, r]));
  const days14 = Array.from({ length: DETAIL.days }, (_, i) => {
    const day = plusDays(from14, i); const r = byDay[day];
    return { day, n: num(r?.n), first: num(r?.first), minutes: Math.round(num(r?.secs) / 60) };
  });
  const levels = Object.fromEntries(levelRows.map((r) => [r.topic, { level: r.level, max: r.max_level }]));
  // one row per stair and mistake (TEACHER-16), with its latest time: most frequent first, then the most recent
  const mistakes = catRows.map((r) => ({ topic: r.topic, cat: r.cat, level: Number(r.level), n: num(r.n), lastAt: r.last_at }))
    .sort((a, b) => b.n - a.n || (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0) || byMistake(a, b))
    .slice(0, DETAIL.mistakes);
  const parse = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };
  const exams = [
    ...examRows.map((e) => ({ id: String(e.id), title: e.title, correct: num(e.correct), total: num(e.total), at: e.created_at, questions: parse(e.questions) })),
    ...classExams.map((w) => ({ id: `a:${w.assignment_id}`, title: w.title, correct: num(w.right_n), total: num(w.asked), at: w.done_at, questions: parse(w.questions) })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, DETAIL.exams);

  return json({
    student: {
      id: s.id, name: s.name, joinedOn: s.created_at ? dayOf(new Date(s.created_at)) : null,
      lastPractice: lastRow?.last || null, pinReset: !!s.pin_reset, aiOff: !!s.ai_off,
    },
    days14,
    levels,
    mistakes,
    work: work.map((a) => {
      const state = a.state || 'none';
      return {
        assignmentId: a.id, title: a.title, kind: a.kind, dueOn: a.due_on, state,
        stage: a.stage ?? null, right: a.right_n ?? null, asked: a.asked ?? null, passed: a.passed == null ? null : !!a.passed,
        late: state === 'done' ? a.done_day > a.due_on : a.due_on < today,
      };
    }),
    help: help.map(({ id: hid, topic, question, createdAt, status }) => ({ id: hid, topic, question, createdAt, status })),
    exams,
  }, 200, cors);
}
