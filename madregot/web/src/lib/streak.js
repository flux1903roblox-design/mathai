// The streak, kept calm (STUDENT-5), as pure functions of the saved days ('YYYY-MM-DD' -> { lessons, stages, mp, q,
// frozen, … }):
//  - Shabbat and Yom Tov are rest days: a rest day without learning is passed over, never missed (shared/restDays.js);
//  - a missed school day can be repaired by the student's own effort: two finished items the next school day, at most
//    once in 30 days (streakRepair). A repaired day is saved as frozen: 'repair';
//  - two counters that never reset: learning days this month and in all;
//  - a weekly personal best in steps: a lesson, a teaching stage or a check is one, and a passed mastery check is 3.
import { isRestDay } from '@shared/restDays.js';

/** Today's key in the device's own time zone. */
export const today = (d = new Date()) => d.toLocaleDateString('en-CA');
/** The day before a key (local noon, so a clock change never skips a day). */
export const dayBefore = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return today(d); };
const dayAfter = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + 1); return today(d); };
/** Whole days from one key to another (b − a). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/** Something was finished that day: a lesson or check, or a teaching stage (understand, worked examples, solve together). */
export const learnedOn = (d) => !!d && ((d.lessons || 0) > 0 || (d.stages || 0) > 0);
/** A day counts for the streak with one finished lesson or teaching stage (or answers saved before lessons existed). */
export const isActiveDay = (d) => learnedOn(d) || (!!d && d.lessons == null && (d.q || 0) > 0);
/** A day that keeps the chain without adding to it: a rest day, a day a freeze covered, or a repaired day. */
export const keptDay = (days, key) => !!days[key]?.frozen || isRestDay(key);
/** Finished learning items that day: lessons (checks count here too) and teaching stages. */
export const itemsOn = (d) => (d?.lessons || 0) + (d?.stages || 0);

/** Consecutive active days ending at `key` (or the day before, if `key` has none yet). Kept days are passed over. */
export function streakAt(days, key) {
  let k = key;
  if (!isActiveDay(days[k])) k = dayBefore(k);
  let n = 0;
  for (;;) {
    if (isActiveDay(days[k])) n += 1;
    else if (!keptDay(days, k)) break;
    k = dayBefore(k);
  }
  return n;
}

/** The last school day before `key`: rest days in between are not missed days (a Friday before Shabbat, a holiday eve). */
export function lastSchoolDay(key) {
  let k = dayBefore(key);
  for (let i = 0; i < 7 && isRestDay(k); i += 1) k = dayBefore(k);
  return k;
}

export const REPAIR_ITEMS = 2;
export const REPAIR_EVERY = 30;

/**
 * Can the streak be repaired today, and how? Repairable when:
 *  - today is not a rest day;
 *  - the last school day before today (yesterday, or the day before a Shabbat or a holiday) had no learning, no freeze
 *    and no repair;
 *  - the last active day before that gap (across rest days and frozen days) ended a streak of at least 2;
 *  - the last repair (lastRepair) was at least 30 days ago, or never.
 * Returns null, or { gap, streak, left }: the day to repair, the streak it keeps, and the items still to finish today.
 */
export function streakRepair(days, todayKey, lastRepair) {
  if (isRestDay(todayKey)) return null;
  if (lastRepair && daysBetween(lastRepair, todayKey) < REPAIR_EVERY) return null;
  const gap = lastSchoolDay(todayKey);
  if (isActiveDay(days[gap]) || keptDay(days, gap)) return null;
  let k = dayBefore(gap);
  for (let i = 0; i < 14 && !isActiveDay(days[k]) && keptDay(days, k); i += 1) k = dayBefore(k);
  if (!isActiveDay(days[k])) return null;
  const streak = streakAt(days, k);
  if (streak < 2) return null;
  return { gap, streak, left: Math.max(0, REPAIR_ITEMS - itemsOn(days[todayKey])) };
}

/** Active days in the calendar month of `todayKey`, up to it. Starts again on the 1st. */
export function learnDaysThisMonth(days, todayKey) {
  const month = todayKey.slice(0, 7);
  return Object.keys(days).filter((k) => k.startsWith(month) && k <= todayKey && isActiveDay(days[k])).length;
}
/** Active days in all. Never goes down. */
export const learnDaysTotal = (days) => Object.keys(days).filter((k) => isActiveDay(days[k])).length;

/** The Sunday that starts the week of `key` (an Israeli week: Sunday to Shabbat). */
export function weekStart(key) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
/** Steps on one day: a finished lesson, stage or check is one step; a passed mastery check (mp) adds two more. */
export const stepsOn = (d) => (d?.lessons || 0) + (d?.stages || 0) + 2 * (d?.mp || 0);
/** Steps in the week that starts on `start` (a Sunday). */
export function weekSteps(days, start) {
  let n = 0; let k = start;
  for (let i = 0; i < 7; i += 1) { n += stepsOn(days[k]); k = dayAfter(k); }
  return n;
}
/**
 * The best week before the week that starts on `beforeWeek`: { steps, week } or null when no earlier week has a step.
 * Days saved before mp existed count a mastery check as 1, which can only lower an old best, never raise it.
 */
export function bestWeek(days, beforeWeek) {
  const sums = {};
  Object.keys(days).forEach((k) => { const w = weekStart(k); if (w < beforeWeek) sums[w] = (sums[w] || 0) + stepsOn(days[k]); });
  let best = null;
  Object.entries(sums).forEach(([week, steps]) => { if (steps > 0 && (!best || steps > best.steps)) best = { steps, week }; });
  return best;
}
