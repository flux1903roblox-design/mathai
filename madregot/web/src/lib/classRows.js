// The teacher's work as the screens and the plan show it (spec TEACHER-5 §5, CURRICULUM-7.1 band 1): which rows show
// today, where each leads, and the calm words for its due day. Pure: it reads no store and no clock (`day` comes in, as
// in learn/next.ts), so the learning engine's planNext can use the very same selection and routes as TodayCard's
// ClassWork rows without pulling the app's store into the engine. lib/classWork.js re-exports all of it.
import { today } from './days.js';
import { daysFrom, weekdayName, dm } from './workDates.js';
import { mergeWork } from '@/learn/assignments.ts';
import { routeOf, STAGE_MIN } from '@/learn/recommend.ts';

/** The kinds a student sees: a stair, a mastery check and a class exam. */
export const SHOWN = ['stair', 'check', 'exam'];

/**
 * The class assignments with this device's reports: the server's copy of each (`mine`) merged with the report still
 * waiting in the outbox (learn/assignments.ts mergeWork, the server's own rules). What the plan reads (lib/useLearn.js).
 */
export const classAssignments = (list, box = {}) => (Array.isArray(list) ? list : []).map((a) => (box?.[a.id] ? { ...a, mine: mergeWork(a.mine, box[a.id]) } : a));

const localDay = (iso) => today(new Date(iso));

/**
 * The due line in calm words: "להיום", "עד מחר", "עד יום חמישי, 12.11", and for a date that passed "המועד עבר, ועדיין
 * אפשר להשלים". Never red, never "late".
 */
export function dueLine(dueOn, day = today()) {
  const left = daysFrom(day, dueOn);
  if (left < 0) return 'המועד עבר, ועדיין אפשר להשלים';
  if (left === 0) return 'להיום';
  if (left === 1) return 'עד מחר';
  return `עד יום ${weekdayName(dueOn)}, ${dm(dueOn)}`;
}

/** The stair page's line: "משימה מהמורה, עד יום חמישי, 12.11" (or ", להיום", or ". המועד עבר, ועדיין אפשר להשלים"). */
export function workBanner(dueOn, day = today()) {
  const d = dueLine(dueOn, day);
  return daysFrom(day, dueOn) < 0 ? `משימה מהמורה. ${d}` : `משימה מהמורה, ${d}`;
}

/** Where a row leads: the stair's page (with its banner), the mastery check counted for it, or the class exam's start. */
export const workRoute = (a) => (a.kind === 'exam' ? `/class/exam/${a.id}` : a.kind === 'check' ? `${routeOf.check(a.skill, 'mastery')}&assignment=${a.id}` : `${routeOf.journey(a.skill)}?assignment=${a.id}`);

const STAGES = ['A', 'B', 'C', 'D', 'E'];
/** Minutes left: the stages a stair still has, a check's 3, or 3 for each question of a class exam. */
export const EXAM_MIN_PER_Q = 3;
const minutesLeft = (a, w) => (a.kind === 'exam' ? (a.examCount || 0) * EXAM_MIN_PER_Q : a.kind === 'check' ? 3 : STAGES.slice(Math.min(5, w?.stage || 0)).reduce((s, x) => s + STAGE_MIN[x], 0));

/**
 * The rows of the "מהמורה" block on a day: due within 3 days, or past by at most 14 days and not done (`show`), later
 * ones (`later`, folded), done ones only on the day they were finished. `next` is the first unfinished row by due date;
 * `minutes` the time the shown unfinished rows still take. The unfinished rows of `show` are band 1 of the plan
 * (learn/next.ts planNext), whose top is TodayCard's big button.
 */
export function classRows(cw, box = {}, day = today()) {
  const rows = (cw?.assignments || []).filter((a) => SHOWN.includes(a.kind) && (a.kind === 'exam' ? a.hasExam !== false : !!a.skill)).map((a) => {
    const w = mergeWork(a.mine, box[a.id]);
    const done = w?.state === 'done';
    const left = daysFrom(day, a.dueOn);
    return { a, w, done, doneToday: done && !!w.doneAt && localDay(w.doneAt) === day, started: !done && (w?.state === 'started' || (w?.stage || 0) > 0), left, to: workRoute(a), minutes: minutesLeft(a, w) };
  });
  const order = (x, y) => (x.a.dueOn < y.a.dueOn ? -1 : x.a.dueOn > y.a.dueOn ? 1 : String(x.a.createdAt || '') < String(y.a.createdAt || '') ? -1 : 1);
  const open = rows.filter((r) => !r.done && r.left >= -14).sort(order);
  const show = [...open.filter((r) => r.left <= 3), ...rows.filter((r) => r.doneToday).sort(order)];
  const later = open.filter((r) => r.left > 3);
  const next = open[0] || null;
  return { show, later, next, minutes: show.filter((r) => !r.done).reduce((s, r) => s + r.minutes, 0), allDone: show.length > 0 && show.every((r) => r.done) && !later.length };
}

/** Work not done that came after the student last opened the missions tab (the tab's dot). */
export function hasNewWork(cw, box = {}) {
  const seen = cw?.seenAt || '';
  return (cw?.assignments || []).some((a) => SHOWN.includes(a.kind) && mergeWork(a.mine, box[a.id])?.state !== 'done' && (!seen || String(a.createdAt || '') > seen));
}

/** The most urgent unfinished work due within 3 days (or past by at most 14), for the chip on the learning home. */
export function urgentWork(cw, box = {}, day = today()) {
  return classRows(cw, box, day).show.find((r) => !r.done) || null;
}

/** "משימה מהמורה: {title} · עד יום חמישי" (the date is left out once it passed). */
export function urgentText(r) {
  const when = r.left < 0 ? '' : r.left === 0 ? ' · להיום' : r.left === 1 ? ' · עד מחר' : ` · עד יום ${weekdayName(r.a.dueOn)}`;
  return `משימה מהמורה: ${r.a.title}${when}`;
}
