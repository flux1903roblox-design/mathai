// The class goal of the week (STUDENT-4): one shared number of "steps" a class works toward together, with no names
// and no ranks. A step is a finished lesson, teaching stage, check or placement (1 point); a passed mastery check is
// worth 3 (1 for finishing and 2 for mastery, so steps reward learning and not only clicks).
//
// - The device mints each step with its own id (sid), so a retry or a second tab never counts twice; the steps ride
//   in POST /api/progress (saveProgress calls stepStatements).
// - The device mints the steps, so one student can add at most 30 points and 6 three-point steps in a Jerusalem day;
//   anything over is dropped without a word. 30 points is about 20 lessons, far above a real day.
// - A week runs Sunday to Saturday in Jerusalem. Its target is fixed at the week's first read (class_goal_weeks), so it
//   never moves mid-week: the teacher's number (10-400), or 4 steps for each student with a step in the 14 days before
//   the week (the class size when nobody has one), rounded up to 5, from 10 to 400.
// - A student sees the class total and their own share only (GET /api/class/goal); the teacher sees the total on the
//   dashboard and can turn the goal off or set its size (POST /api/teacher/class/goal).
// Rows are kept 120 days (steps) and 400 days (weeks) by the nightly purge; removing a student deletes their steps.
import { dayOf, nowIso, HttpError, body, json } from './util.js';
import { requireStudent, requireTeacher } from './entitle.js';
import { countServer } from './metrics.js';
import { teacherAudit } from './licence.js';

export const GOAL = { maxItems: 50, dayPts: 30, dayThrees: 6, min: 10, max: 400, perActive: 4, activeDays: 14 };
const SID = /^[0-9a-f-]{36}$/;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();

/** A YYYY-MM-DD day moved by n days (calendar arithmetic on the date itself, so no time zone is involved). */
export function shiftDay(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** The Sunday on or before a YYYY-MM-DD day: the week the day belongs to. */
export function weekOf(day) {
  const [y, m, d] = day.split('-').map(Number);
  return shiftDay(day, -new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}
export const ceil5 = (n) => Math.ceil(n / 5) * 5;
/** The automatic target for n active students: 4 steps each, rounded up to 5, from 10 to 400. */
export const autoTarget = (n) => Math.min(GOAL.max, Math.max(GOAL.min, ceil5(GOAL.perActive * n)));

/**
 * The steps of one progress sync, as statements for its batch (they commit with the answers or not at all). At most 50
 * are read; a step needs a UUID-shaped sid, pts 1 or 3, and an `at` that is clamped to now like an answer's. Each insert
 * reads the student's points for that Jerusalem day first and is skipped when it would pass the day's caps, so a sid
 * already saved (a retry) neither counts again nor uses up the cap, and two tabs syncing at once cannot pass it.
 */
export function stepStatements(env, s, steps, now = Date.now()) {
  const out = []; const seen = new Set();
  for (const x of (Array.isArray(steps) ? steps : []).slice(0, GOAL.maxItems)) {
    const sid = typeof x?.sid === 'string' ? x.sid : ''; const pts = x?.pts;
    if (!SID.test(sid) || seen.has(sid) || (pts !== 1 && pts !== 3)) continue;
    seen.add(sid);
    const at = new Date(Math.min(Number(new Date(x.at)) || now, now));
    out.push(env.DB.prepare(`INSERT OR IGNORE INTO class_steps (sid, student_id, class_code, day, pts, at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE (SELECT COALESCE(SUM(pts), 0) FROM class_steps WHERE student_id = ?2 AND day = ?4) + ?5 <= ?7
        AND (?5 = 1 OR (SELECT COUNT(*) FROM class_steps WHERE student_id = ?2 AND day = ?4 AND pts = 3) < ?8)`)
      .bind(sid, s.id, s.class_code, dayOf(at), pts, at.toISOString(), GOAL.dayPts, GOAL.dayThrees));
  }
  return out;
}

const settingsOf = (env, code) => first(env, 'SELECT on_flag, target FROM class_goal_settings WHERE class_code = ?', code);
const weekRow = (env, code, week) => first(env, 'SELECT target, reached_at FROM class_goal_weeks WHERE class_code = ? AND week = ?', code, week);

/** A week's points for the class, and for one student. */
async function weekSums(env, code, week, studentId = '') {
  const r = await first(env, `SELECT COALESCE(SUM(pts), 0) AS have, COALESCE(SUM(CASE WHEN student_id = ?4 THEN pts END), 0) AS mine
    FROM class_steps WHERE class_code = ?1 AND day >= ?2 AND day < ?3`, code, week, shiftDay(week, 7), studentId);
  return { have: Number(r?.have || 0), mine: Number(r?.mine || 0) };
}

/** The week's target, fixed the first time the week is read (two first reads at once agree: INSERT OR IGNORE). */
async function fixedTarget(env, code, week, settings) {
  const row = await weekRow(env, code, week);
  if (row) return row;
  let target = Number(settings?.target) || 0;
  if (!target) {
    const a = await first(env, `SELECT COUNT(DISTINCT c.student_id) AS n FROM class_steps c JOIN students s ON s.id = c.student_id AND s.class_code = c.class_code
      WHERE c.class_code = ? AND c.day >= ? AND c.day < ?`, code, shiftDay(week, -GOAL.activeDays), week);
    const n = Number(a?.n || 0) || Number((await first(env, 'SELECT COUNT(*) AS n FROM students WHERE class_code = ?', code))?.n || 0);
    target = autoTarget(n);
  }
  await env.DB.prepare('INSERT OR IGNORE INTO class_goal_weeks (class_code, week, target) VALUES (?, ?, ?)').bind(code, week, target).run();
  return weekRow(env, code, week);
}

/**
 * Reached once, for good: reached_at is set the first time the total meets the target. That first time also adds 1 to
 * the owner's class_goal_reached count (metrics.js; two reads at once set it once, so they count it once).
 */
async function reachedOf(env, code, week, row, have) {
  if (row.reached_at) return true;
  if (have < row.target) return false;
  const r = await env.DB.prepare('UPDATE class_goal_weeks SET reached_at = ? WHERE class_code = ? AND week = ? AND reached_at IS NULL').bind(nowIso(), code, week).run();
  if (Number(r?.meta?.changes || 0) > 0) await countServer(env, 'class_goal_reached');
  return true;
}

/**
 * What a student sees: { on: false } when the teacher turned the goal off; otherwise exactly
 * { on, week, target, have, mine, reached, last }, where last is the week before ({ week, target, have, reached, mine })
 * or null when that week was never read. Never another student's id, name or share.
 */
export async function goalFor(env, s, now = new Date()) {
  const settings = await settingsOf(env, s.class_code);
  if (settings && !settings.on_flag) return { on: false };
  const week = weekOf(dayOf(now));
  const row = await fixedTarget(env, s.class_code, week, settings);
  const cur = await weekSums(env, s.class_code, week, s.id);
  const reached = await reachedOf(env, s.class_code, week, row, cur.have);
  const prevWeek = shiftDay(week, -7);
  const prev = await weekRow(env, s.class_code, prevWeek);
  let last = null;
  if (prev) {
    const p = await weekSums(env, s.class_code, prevWeek, s.id);
    last = { week: prevWeek, target: prev.target, have: p.have, reached: await reachedOf(env, s.class_code, prevWeek, prev, p.have), mine: p.mine };
  }
  return { on: true, week, target: row.target, have: cur.have, mine: cur.mine, reached, last };
}

/**
 * What the teacher sees on the dashboard: { on, week, target, have, reached, custom }, the class total only.
 * custom is the size the teacher chose (null: automatic). With the goal off there is no target.
 */
export async function teacherGoal(env, code, now = new Date()) {
  const settings = await settingsOf(env, code);
  const on = !settings || !!settings.on_flag;
  const week = weekOf(dayOf(now));
  const custom = settings?.target ?? null;
  const { have } = await weekSums(env, code, week);
  if (!on) return { on: false, week, target: null, have, reached: false, custom };
  const row = await fixedTarget(env, code, week, settings);
  return { on: true, week, target: row.target, have, reached: await reachedOf(env, code, week, row, have), custom };
}

/** GET /api/class/goal (a class student's token). */
export async function classGoal(req, env, cors) {
  const s = await requireStudent(req, env);
  return json(await goalFor(env, s), 200, cors);
}

/**
 * POST /api/teacher/class/goal { on: boolean, target: number | null }: on or off, and a size from 10 to 400 (null:
 * automatic). A new size takes effect from next week, unless this week has no steps yet.
 */
export async function setClassGoal(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, 4096);
  if (typeof b.on !== 'boolean') throw new HttpError(400, 'bad_request');
  let target = null;
  if (b.target !== null && b.target !== undefined) {
    if (!Number.isInteger(b.target) || b.target < GOAL.min || b.target > GOAL.max) throw new HttpError(400, 'bad_request');
    target = b.target;
  }
  const now = nowIso();
  const week = weekOf(dayOf());
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO class_goal_settings (class_code, on_flag, target, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (class_code) DO UPDATE SET on_flag = excluded.on_flag, target = excluded.target, updated_at = excluded.updated_at`)
      .bind(cls.code, b.on ? 1 : 0, target, now),
    // a week nobody has added to yet takes the new size at its next read; a week under way keeps the target it started with
    env.DB.prepare(`DELETE FROM class_goal_weeks WHERE class_code = ?1 AND week = ?2 AND reached_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM class_steps WHERE class_code = ?1 AND day >= ?2 AND day < ?3)`).bind(cls.code, week, shiftDay(week, 7)),
    // the teacher's audit row (licence.js teacherAudit: {via: 'account'} when the class was opened with the account)
    teacherAudit(env, cls, 'class.goal', `class:${cls.code}`, { on: b.on, target }),
  ]);
  return json({ goal: await teacherGoal(env, cls.code) }, 200, cors);
}
