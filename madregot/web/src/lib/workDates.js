// Due dates of class work (spec TEACHER-4 and TEACHER-5), as both sides of the class read them. Every day is a
// 'YYYY-MM-DD' string; the weekday is read at noon UTC, so it is the same day in every time zone.
import { isShabbat } from './days.js';

const LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
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
export const dueShort = (day) => `עד יום ${weekdayLetter(day)}, ${dm(day)}`;
/** "יום חמישי, 12.11" */
export const dayLong = (day) => `יום ${weekdayName(day)}, ${dm(day)}`;
