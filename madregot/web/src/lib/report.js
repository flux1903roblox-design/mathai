// The class report's ranges and calls (spec TEACHER-7): "השבוע" (Sunday to today), "שבועיים" (the last 14 days),
// "החודש" (from the 1st), "מתחילת השנה" (1 September of the school year: before September, of the previous year) and a
// range the teacher picks. The server cuts a range to 400 days and to today (worker/src/report.js); these never ask
// for more. Days are 'YYYY-MM-DD'.
import { teacherApi } from './teacher.js';
import { today as todayOf } from './store.js';
import { plusDays } from './workDates.js';
import { reportCsv, csvName, downloadCsv } from './teacherCsv.js';

/** The range chips, in order. */
export const RANGES = [['week', 'השבוע'], ['two', 'שבועיים'], ['month', 'החודש'], ['year', 'מתחילת השנה'], ['custom', 'טווח אחר']];
/** The longest range a teacher can pick (the server's cap). */
export const MAX_DAYS = 400;

/** 1 September of the school year `day` is in. */
export function schoolYearStart(day) {
  const y = Number(day.slice(0, 4)); const m = Number(day.slice(5, 7));
  return `${m >= 9 ? y : y - 1}-09-01`;
}

/** The days of a named range on `day`: { from, to }. Unknown names are "שבועיים". */
export function rangeDays(range, day = todayOf()) {
  if (range === 'week') return { from: plusDays(day, -new Date(`${day}T12:00:00Z`).getUTCDay()), to: day };
  if (range === 'month') return { from: `${day.slice(0, 8)}01`, to: day };
  if (range === 'year') return { from: schoolYearStart(day), to: day };
  return { from: plusDays(day, -13), to: day };
}

/** A range the teacher typed, if it can be asked: both days, from ≤ to ≤ today, at most 400 days. */
export function customRange(from, to, day = todayOf()) {
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  if (!ok(from) || !ok(to) || from > to || to > day || from < plusDays(to, -(MAX_DAYS - 1))) return null;
  return { from, to };
}

/** "6.11.2026" */
export const dmyDots = (day) => { const [y, m, d] = day.split('-').map(Number); return `${d}.${m}.${y}`; };
/** "6.11–12.11.2026", or with both years when they differ. */
export function rangeText(from, to) {
  const same = from.slice(0, 4) === to.slice(0, 4);
  const short = (day) => { const [, m, d] = day.split('-').map(Number); return `${d}.${m}`; };
  return `${same ? short(from) : dmyDots(from)}–${dmyDots(to)}`;
}

/** GET /api/teacher/report for a range. */
export const fetchReport = (cls, { from, to }) => teacherApi(`/api/teacher/report?from=${from}&to=${to}`, {}, cls);

/** The report's CSV, handed to the device (lib/teacherCsv.js downloadCsv): 'saved', 'shared' or 'closed'. */
export const saveReportCsv = (report) => downloadCsv(reportCsv(report), csvName(report.class?.name, report.from, report.to));

/** The whole school year's report as a CSV, in one step (the class settings and the delete sheet). */
export async function saveYearCsv(cls) {
  return saveReportCsv(await fetchReport(cls, rangeDays('year')));
}
