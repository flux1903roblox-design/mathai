// One week of a child's learning, from the day summaries (PARENTS-1): the same function on the child's device
// (learn/report.ts re-exports it), on the /r link, on /parents and in the Worker's weekly email (PARENTS-7), so no two
// surfaces can disagree. Plain JS with JSDoc types and no imports; the Worker imports it as ../../shared/week.js.
// shared/week.fixture.json is one week tested on both sides (web report.test.ts, worker test/week.test.js).
//
// The Israeli week runs Sunday to Saturday. A rest day (Shabbat; Yom Tov once the student lane's rest days land) is
// shown as rest, never as a missed day: the predicate is passed in, and defaults to Saturday.
// A day counts as a practice day ("on") when a lesson, a check or a teaching stage was finished on it: the app's own
// rule for the streak (isActiveDay). Answers alone or minutes alone never make a day count.

/**
 * @typedef {'o' | 'd'} FixState  o: confirmed or being repaired (the newest summary's snapshot); d: resolved that day
 * @typedef {{ d: string, n: number, of: number }} ExamAhead  an exam ahead: its date, its stairs mastered, its stairs
 * @typedef {{
 *   v: 1, d: string, m: number, q: number, ls: number, st: number, sk: string[], ma: string[], rv: number,
 *   fx: [string, string, FixState][], sr: number, ex?: ExamAhead | null
 * }} DaySummary
 * @typedef {{ d: string, on: boolean, rest: boolean, future: boolean, m: number }} WeekDay
 * @typedef {{
 *   start: string, end: string, days: WeekDay[],
 *   activeDays: number, minutes: number, questions: number, lessons: number, stages: number, reviews: number,
 *   worked: string[], mastered: string[], open: [string, string][], openAt: string | null, fixed: [string, string][],
 *   streak: number, exam: ExamAhead | null, empty: boolean
 * }} WeekReport
 */

const DAY_MS = 86400000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' → a UTC time at that date's midnight (no time zone can move it to another day). */
const utc = (day) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (t) => new Date(t).toISOString().slice(0, 10);

/** Saturday, the default rest day. @param {string} day @returns {boolean} */
export const isSaturday = (day) => new Date(utc(day)).getUTCDay() === 6;

/** The Sunday on or before `day`. @param {string} day 'YYYY-MM-DD' @returns {string} */
export function weekStart(day) {
  if (typeof day !== 'string' || !DAY_RE.test(day)) throw new TypeError(`not a day: ${day}`);
  const t = utc(day);
  return fmt(t - new Date(t).getUTCDay() * DAY_MS);
}

/** The 7 days of the week that starts on `start`, Sunday to Saturday. @param {string} start @returns {string[]} */
export function weekDays(start) {
  const t = utc(weekStart(start));
  return Array.from({ length: 7 }, (_, i) => fmt(t + i * DAY_MS));
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const list = (v) => (Array.isArray(v) ? v : []);
const pushNew = (out, seen, key, value) => { if (!seen.has(key)) { seen.add(key); out.push(value); } };

/**
 * The streak a summary still stands for on `ref`: its own (sr) when it is `ref`'s, or when only rest days lie between
 * them and its day was a practice day or a rest day; else 0 (the chain broke on a day the device never sent).
 * @param {DaySummary | null} row @param {string} ref @param {(day: string) => boolean} isRest @returns {number}
 */
function streakAt(row, ref, isRest) {
  if (!row) return 0;
  if (row.d >= ref) return num(row.sr);
  for (let t = utc(ref) - DAY_MS; t > utc(row.d); t -= DAY_MS) if (!isRest(fmt(t))) return 0;
  return num(row.ls) > 0 || num(row.st) > 0 || isRest(row.d) ? num(row.sr) : 0;
}

/**
 * The week report from the day summaries that fall in the week of `start` (others are ignored; a day given twice
 * keeps its last summary).
 * - `open` and `openAt` come from the NEWEST summary of the week, even when its list is empty: a past day never
 *   carries the open mistakes (daySummary fills them only on its own today), so an older list would be stale.
 * - `fixed` is every resolved mistake of the week, once each; `worked` and `mastered` likewise, in the order they
 *   first appear (days in order).
 * - `streak` and `exam` are those of the newest summary on or before the day the report is read for (`today`, or the
 *   week's Saturday for a past week), from all the rows given, and only while they are still true, so the parent sees
 *   what the child sees (streakOf, lib/days.js): the streak holds only when every day between that summary and that day
 *   is a rest day (that day itself may still be empty), and that summary's own day was a practice day or a rest day;
 *   otherwise it is 0. An exam whose date has passed is dropped.
 * - `empty`: no summary with questions, lessons, stages or minutes.
 * @param {DaySummary[]} rows
 * @param {string} start  any day of the week (its Sunday is used)
 * @param {string} today  'YYYY-MM-DD' on the device that shows the report
 * @param {(day: string) => boolean} [isRest]  default: Saturday
 * @returns {WeekReport}
 */
export function weekFrom(rows, start, today, isRest = isSaturday) {
  const days = weekDays(start);
  const inWeek = new Set(days);
  const byDay = new Map();
  for (const r of list(rows)) if (r && typeof r === 'object' && inWeek.has(r.d)) byDay.set(r.d, r);
  const given = days.filter((d) => byDay.has(d)).map((d) => byDay.get(d));
  const newest = given.length ? given[given.length - 1] : null;
  const ref = today < days[6] ? today : days[6];
  let last = null;
  for (const r of list(rows)) if (r && typeof r === 'object' && typeof r.d === 'string' && DAY_RE.test(r.d) && r.d <= ref && (!last || r.d >= last.d)) last = r;

  const worked = []; const seenW = new Set();
  const mastered = []; const seenM = new Set();
  const fixed = []; const seenF = new Set();
  const out = { minutes: 0, questions: 0, lessons: 0, stages: 0, reviews: 0 };
  for (const r of given) {
    out.minutes += num(r.m); out.questions += num(r.q); out.lessons += num(r.ls); out.stages += num(r.st); out.reviews += num(r.rv);
    for (const s of list(r.sk)) if (typeof s === 'string') pushNew(worked, seenW, s, s);
    for (const s of list(r.ma)) if (typeof s === 'string') pushNew(mastered, seenM, s, s);
    for (const f of list(r.fx)) if (Array.isArray(f) && f[2] === 'd') pushNew(fixed, seenF, `${f[0]}|${f[1]}`, [f[0], f[1]]);
  }
  const week = days.map((d) => {
    const r = byDay.get(d);
    return { d, on: !!r && (num(r.ls) > 0 || num(r.st) > 0), rest: !!isRest(d), future: d > today, m: r ? num(r.m) : 0 };
  });
  return {
    start: days[0],
    end: days[6],
    days: week,
    activeDays: week.filter((w) => w.on).length,
    ...out,
    worked,
    mastered,
    open: newest ? list(newest.fx).filter((f) => Array.isArray(f) && f[2] === 'o').map((f) => [f[0], f[1]]) : [],
    openAt: newest ? newest.d : null,
    fixed,
    streak: streakAt(last, ref, isRest),
    exam: last && last.ex && typeof last.ex === 'object' && typeof last.ex.d === 'string' && last.ex.d >= today
      ? { d: last.ex.d, n: num(last.ex.n), of: num(last.ex.of) } : null,
    empty: !given.some((r) => num(r.q) > 0 || num(r.ls) > 0 || num(r.st) > 0 || num(r.m) > 0),
  };
}
