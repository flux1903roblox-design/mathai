// "איך זה ייראה (דוגמה)" (PARENTS-6 state 3): a made-up week shown to a parent whose linked device has not sent a
// summary yet, so they see what the report will hold. It is flagged `example: true`, and ReportView draws the ribbon
// "דוגמה. אלה לא נתונים של הילד שלכם." on it. Fixed dates and numbers; never a real child's data.
import { weekFrom } from '@/learn/report.ts';

export const EXAMPLE_START = '2026-11-08';
export const EXAMPLE_TODAY = '2026-11-12';
const row = (d, over) => ({ v: 1, d, m: 0, q: 0, ls: 0, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 0, ex: null, ...over });

/** The example's day rows: four practice days, two stairs mastered, one repair done and one open, an exam ahead. */
export const EXAMPLE_ROWS = Object.freeze([
  row('2026-11-08', { m: 18, q: 12, ls: 1, st: 2, sk: ['signed:1'], ma: ['signed:1'], sr: 1 }),
  row('2026-11-09', { m: 25, q: 18, ls: 2, sk: ['signed:2'], fx: [['signed:1', 'minus-minus', 'd']], sr: 2 }),
  row('2026-11-11', { m: 16, q: 10, ls: 1, st: 1, sk: ['signed:3', 'signed:2'], ma: ['signed:2'], sr: 3 }),
  row('2026-11-12', { m: 12, q: 9, ls: 1, sk: ['coord:1'], fx: [['coord:1', 'swap', 'o']], sr: 4, ex: { d: '2026-11-19', n: 2, of: 4 } }),
]);

/** The example week, flagged so it can never pass for a child's own. */
export const EXAMPLE_WEEK = Object.freeze({ ...weekFrom(EXAMPLE_ROWS, EXAMPLE_START, EXAMPLE_TODAY), example: true });
