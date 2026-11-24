// The Sunday recap (STUDENT-6, FOLLOWUP-38): when its card shows on Learn. Pure and small, so the home screen pays almost
// nothing for it; the week itself comes from the report engine (learn/report.ts weekLocal), loaded only when the card
// is due, and the sheet (components/learn/RecapSheet.jsx) loads only when it is opened.
//   - only Sunday to Tuesday, so never on Shabbat (and not on a holiday either: a rest day has no recap);
//   - never right after a lesson (Learn back from a lesson passes afterLesson);
//   - only once a week: closing the card or the sheet keeps that week's Sunday in nudges.recapWeek (this device only,
//     durable/merge.js DEVICE_ONLY);
//   - only after a week with some learning: weekLocal's `empty`, the same call /report makes for "השבוע שעבר", so the
//     card and the report never disagree about a week. It is never a push.
import { isRestDay } from '@shared/restDays.js';
import { weekStart } from './streak.js';

/** The days of the week the card may show: Sunday (0) to Tuesday (2). */
export const RECAP_DAYS = Object.freeze([0, 1, 2]);

/** The Sunday of the week before the week of `day` ('YYYY-MM-DD'). */
export function recapStart(day) {
  const t = new Date(`${weekStart(day)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 7);
  return t.toISOString().slice(0, 10);
}

/**
 * The week the card is due for, or null: { today, seen: nudges.recapWeek, afterLesson }. Due does not yet mean shown:
 * the week must also have had learning (recapShown).
 */
export function recapDue({ today, seen = null, afterLesson = false }) {
  if (afterLesson || !today) return null;
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (!RECAP_DAYS.includes(dow) || isRestDay(today)) return null;
  const start = recapStart(today);
  return seen === start ? null : start;
}

/** Does the card show? Due, and `week` (weekLocal of that Sunday) is that week and not empty. */
export function recapShown(opts, week) {
  const start = recapDue(opts);
  return !!start && !!week && week.start === start && !week.empty;
}
