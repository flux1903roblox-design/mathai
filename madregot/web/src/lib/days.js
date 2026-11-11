// The calendar of the saved days, with no store around it: what a day is, which days count for the streak, and the
// streak itself. lib/store.js re-exports all of it (the app imports it from there); learn/report.ts imports it from
// here, so the report engine stays free of the store.

/** A day on this device, 'YYYY-MM-DD', in its own time zone. */
export const today = (d = new Date()) => d.toLocaleDateString('en-CA');
export const dayBefore = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return today(d); };

/** Something was finished that day: a lesson or check, or a teaching stage (understand, worked examples, solve together). */
export const learnedOn = (d) => !!d && ((d.lessons || 0) > 0 || (d.stages || 0) > 0);
/**
 * A day counts for the streak with one finished lesson or teaching stage (or answers saved before lessons existed).
 * Time on learning screens (tsecs, lib/learnClock.js) never makes a day count.
 */
export const isActiveDay = (d) => learnedOn(d) || (!!d && d.lessons == null && (d.q || 0) > 0);
/** Shabbat never breaks a streak: a Saturday without practice is skipped, not missed. */
export const isShabbat = (key) => new Date(`${key}T12:00:00`).getDay() === 6;
const kept = (days, key) => days[key]?.frozen || isShabbat(key);

/**
 * Consecutive active days ending on `from` (default today), or the day before it if `from` has none yet. A frozen day
 * or a Shabbat keeps the chain without adding to it. `from` lets the report ask for the streak at the end of a past day.
 */
export function streakOf(days, from = today()) {
  let key = from;
  if (!isActiveDay(days[key])) key = dayBefore(key);
  let n = 0;
  // Walk back: an active day adds one; a frozen day or a Shabbat is passed over; any other day ends the streak.
  for (;;) {
    if (isActiveDay(days[key])) n += 1;
    else if (!kept(days, key)) break;
    key = dayBefore(key);
  }
  return n;
}
