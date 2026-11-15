// Due dates of class work (spec TEACHER-4 and TEACHER-5), as both sides of the class read them. Every day is a
// 'YYYY-MM-DD' string; the weekday is read at noon UTC, so it is the same day in every time zone.
import { isShabbat } from './days.js';

import { localized, t } from '@/lib/i18n.js';
let LONG = localized(() => ([t('shell.workdates.1'), t('shell.workdates.2'), t('shell.workdates.3'), t('shell.workdates.4'), t('shell.workdates.5'), t('shell.workdates.6'), t('shell.workdates.7')]), (v) => { LONG = v; });
let SHORT = localized(() => ([t('shell.workdates.8'), t('shell.workdates.9'), t('shell.workdates.10'), t('shell.workdates.11'), t('shell.workdates.12'), t('shell.workdates.13'), t('shell.workdates.14')]), (v) => { SHORT = v; });
const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** "חמישי" */
export const weekdayName = (day) => LONG[weekday(day)];
/** "ה׳" */
export const weekdayLetter = (day) => SHORT[weekday(day)];
/** "12.11" */
export const dm = (day) => { const [, m, d] = day.split('-').map(Number); return `${d}.${m}`; };

/** The day `n` days after `day`. */
export function plusDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Whole days from `a` to `b` (both 'YYYY-MM-DD'). */
const utc = (day) => Date.parse(`${day}T00:00:00Z`);
export const daysFrom = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);

/**
 * A day with no school work due: Saturday, as the server decides it (worker/src/assignments.js), until the student
 * lane's shared/restDays.js adds Yom Tov to both sides. The server's answer (moved) is the truth.
 */
export const isRestDay = (day) => isShabbat(day);
/** A due date on a rest day moves to the next day that is not one: { day, moved }. */
export function schoolDay(day) {
  let d = day; let moved = false;
  while (isRestDay(d)) { d = plusDays(d, 1); moved = true; }
  return { day: d, moved };
}

/** The teacher's due line: "עד יום ה׳, 12.11". */
export const dueShort = (day) => t('shell.workdates.15', { p0: weekdayLetter(day), p1: dm(day) });
/** "יום חמישי, 12.11" */
export const dayLong = (day) => t('shell.workdates.16', { p0: weekdayName(day), p1: dm(day) });
