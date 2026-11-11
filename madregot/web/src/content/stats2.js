// Statistics, the rest of ח׳ units 8.10 and 8.11 (December–January; curriculum stage 3, DATA-5): range and a change to
// every value (stats:6), two sources of data (stats:7), and interpolation and extrapolation (stats:8). They extend the
// topic `stats` (content/grade8.js) after stats:1-5, in their own file so that file does not grow; grade8.js reads
// STATS2_LEVELS and STATS2_CATS from here.
//
// The diagnostic models (STATS6 to STATS8T) are the stage-3 spec's (scratchpad/lanes/stage3/spec/models.mjs, stats8 and
// stats8T in their critique versions with no-start and hours-as-steps), ported unchanged, with stage 1's redraw rule
// (content/data.js `clean`: no prediction is a slip of the hand, within 0.06 of the answer or of another prediction).
// A generator built on a model diagnoses with the model's predictions (diagWith), so an exercise and a model question
// name the same mistakes for the same typed value.
// The range is the difference of the largest and the smallest value, one number (the updated programme's definition);
// some books write its two ends ("מ־37 עד 42"), and the teaching says so once. The numbers and situations of the
// Ministry's examples (the 5-point raise, the basketball player, the workshop, the long jump, the electricity bill, the
// population, the salary, the festival's tickets, a child's growth) are facts; every sentence here is the app's own.
// Errors and sources:
//   range-max, first-last              the largest value, or the last minus the first, for the range (Weizmann unit 18
//                                      writes the range as two ends; first-last is stats:2's `unsorted` in another measure)
//   shift-range, range-unchanged       a constant added "widens" the range; a factor "keeps" it (Mokros & Russell 1995)
//   mean-unchanged, whole-raise        one value raised: the mean "does not move", or moves by the whole raise
//   ignore-source, all-count           one source used; the legal sum divided by every jump (the Ministry's long jump)
//   total-not-mean, all-months         a spring total against a monthly mean; all five months averaged (the bill)
//   midpoint, steps-not-scaled, wrong-end, no-start   interpolation read as the middle, the whole change each step,
//                                      counted from the other end, or the change without the start (the Ministry's 2.6;
//                                      Leinhardt, Zaslavsky & Stein 1990)
//   last-value, one-step, hours-as-steps, far-extrap  extrapolation stopped, one step only, hours counted as steps of
//                                      two hours, or a trend taken far beyond the data (the Ministry's child's growth)
//   count-as-pct                       pct's id and meaning (content/pct.js): the percent read as the count
import { listMath, shuffle } from './util.js';
import { r9 } from './frac.js';
import { mk, bugsAt, diagWith, num, tableFig, pieFig, barFig, HOBBIES } from './data.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuf = (r, a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const whole = (v) => Math.abs(v - Math.round(v)) <= 1e-9;
/** A number in TeX, its thousands grouped from 10,000 (55{,}000; 5000 as it is), the app's rule (content/ratio.js big). */
export const k = (v) => (Number.isInteger(v) && Math.abs(v) >= 10000 ? v.toLocaleString('en-US').replace(/,/g, '{,}') : num(v));
/** a + b·c or a − b·|c| as TeX, the way a student writes a change from a start. */
const plusTimes = (a, b, c) => `${a} ${c < 0 ? '-' : '+'} ${b} \\cdot ${Math.abs(c)}`;

// ---------------------------------------------------------------- the models (spec/models.mjs, unchanged)

/**
 * stats:6 D. Grades (8 of them, unsorted); the teacher adds c points to every grade, or doubles every value, or adds a
 * tenth of each grade (×1.1, grades multiples of 10). "What is the range now?".
 */
export const STATS6 = mk({
  raw: (r) => {
    const op = pick(r, ['add', 'add', 'x2', 'x1.1']);
    const vals = op === 'x1.1' ? Array.from({ length: 8 }, () => 10 * rint(r, 4, 9)) : Array.from({ length: 8 }, () => rint(r, op === 'x2' ? 1 : 40, op === 'x2' ? 20 : 95));
    const rg = Math.max(...vals) - Math.min(...vals); if (rg < 6) return null;
    const c = op === 'add' ? rint(r, 3, 10) : null;
    return { op, vals, c, r: rg };
  },
  answer: ({ op, r }) => (op === 'add' ? r : op === 'x2' ? 2 * r : Math.round(1.1 * r * 1e9) / 1e9),
  bugs: {
    'shift-range': ({ op, r, c }) => (op === 'add' ? r + c : null), // adding to every value taken to widen the range
    'range-unchanged': ({ op, r }) => (op === 'add' ? null : r), // multiplying taken to leave the range as it was
    'range-max': ({ op, vals, c }) => { const M = Math.max(...vals); return op === 'add' ? M + c : op === 'x2' ? 2 * M : Math.round(1.1 * M * 1e9) / 1e9; }, // the new largest value, not the spread
  },
});
/**
 * stats:6 T. A workshop (the Ministry's): a workers earn w1, b workers w2, and the manager M; the manager gets a raise
 * of d. "What is the mean wage now?". Bugs: the whole raise added to the mean, and the mean taken not to move.
 */
export const STATS6T = mk({
  raw: (r) => {
    const a = rint(r, 2, 5); const b = rint(r, 2, 5); const w1 = 100 * rint(r, 45, 55); const w2 = w1 + 100 * rint(r, 1, 4);
    const M = 1000 * rint(r, 8, 12); const d = 500 * rint(r, 2, 6); const N = a + b + 1;
    const S = a * w1 + b * w2 + M; if (!whole((S + d) / N) || !whole(S / N)) return null;
    return { a, b, w1, w2, M, d, N, S };
  },
  answer: ({ S, d, N }) => (S + d) / N,
  bugs: {
    'whole-raise': ({ S, d, N }) => S / N + d, // the whole raise added to the mean
    'mean-unchanged': ({ S, N }) => S / N, // one wage changed, so the mean was taken to stay
  },
});
/**
 * stats:7 D. Two sources (the Ministry's long jump): source 1, a line chart of the tail wind at each of five jumps
 * (legal when at most 2.0 m/s); source 2, a table of one jumper's five distances in centimetres. "What is the mean of
 * the legal jumps?". Bugs: source 1 ignored (the mean of all five), and the legal sum divided by all five.
 */
export const STATS7 = mk({
  raw: (r) => {
    const L = pick(r, [3, 4]); const ill = 5 - L;
    const legal = shuf(r, [0, 1, 2, 3, 4]).slice(0, L).sort();
    const wind = [0, 1, 2, 3, 4].map((i) => (legal.includes(i) ? rint(r, 3, 20) / 10 : rint(r, 21, 32) / 10));
    const d = [0, 1, 2, 3, 4].map(() => rint(r, 560, 690));
    const s = sum(legal.map((i) => d[i])); if (!whole((2 * s) / L)) return null; // a mean in whole or half centimetres
    if (ill < 1) return null;
    return { L, legal, wind, d };
  },
  answer: ({ legal, d }) => sum(legal.map((i) => d[i])) / legal.length,
  bugs: {
    'ignore-source': ({ d }) => sum(d) / 5, // one source used: every jump counted
    'all-count': ({ legal, d }) => sum(legal.map((i) => d[i])) / 5, // the legal jumps added, divided by all five
  },
});
/**
 * stats:7 T. The Ministry's electricity bill: source 1, this year's use in January-May; source 2, last year's mean
 * monthly use in each season. "By how many kWh is this spring's monthly mean (March-May) above last spring's?".
 * Bugs: the spring total compared with a monthly mean, and all five months averaged.
 */
export const STATS7T = mk({
  raw: (r) => {
    const m = Array.from({ length: 5 }, () => 10 * rint(r, 30, 60)); const spring = m.slice(2);
    if (sum(spring) % 3) return null; const mean = sum(spring) / 3;
    const S = 10 * rint(r, 25, Math.floor(mean / 10) - 2); if (S >= mean) return null;
    const seasons = [10 * rint(r, 50, 70), S, 10 * rint(r, 40, 60), 10 * rint(r, 30, 45)]; // winter, spring, summer, autumn
    return { m, S, seasons };
  },
  answer: ({ m, S }) => sum(m.slice(2)) / 3 - S,
  bugs: {
    'total-not-mean': ({ m, S }) => sum(m.slice(2)) - S, // the spring total set against a monthly mean
    'all-months': ({ m, S }) => sum(m) / 5 - S, // all five months averaged, not spring's three
  },
});
/**
 * stats:8 D. Interpolation with a uniform change: a table gives the values at years x1 and x1 + d; the value at
 * x1 + j (j not d/2). Bugs: the midpoint (the Ministry's own wrong student), the whole difference per year, the
 * distance measured from the other end, and the change alone with the start forgotten (critique).
 */
export const STATS8 = mk({
  raw: (r) => {
    const d = pick(r, [4, 5, 6, 8, 10]); const j = rint(r, 1, d - 1); if (2 * j === d) return null;
    const rate = pick(r, [2, 3, 4, 5, 6, 8, 12, 15, 20, 25]) * (r() < 0.25 ? -1 : 1);
    const y1 = rint(r, 40, 300); const y2 = y1 + d * rate; if (y2 <= 0) return null;
    const x1 = rint(r, 2010, 2016);
    return { d, j, rate, y1, y2, x1 };
  },
  answer: ({ y1, j, rate }) => y1 + j * rate,
  bugs: {
    midpoint: ({ y1, y2 }) => (y1 + y2) / 2,
    'steps-not-scaled': ({ y1, y2, j }) => y1 + j * (y2 - y1),
    'wrong-end': ({ y1, d, j, rate }) => y1 + (d - j) * rate,
    'no-start': ({ j, rate }) => Math.abs(j * rate), // (critique) the change alone, the starting value forgotten
  },
});
/**
 * stats:8 T. Extrapolation (the Ministry's festival): tickets sold by 8, 10, 12 and 14 o'clock rise by the same amount
 * every two hours; how many by 16, 18 or 20 if the trend goes on? Bugs: the last value kept, one step added, and hours
 * counted as steps of two hours (critique).
 */
export const STATS8T = mk({
  raw: (r) => {
    const t0 = 10 * rint(r, 5, 40); const a = 10 * rint(r, 5, 30); const s = pick(r, [1, 2, 2, 3]);
    return { t0, a, s, vals: [0, 1, 2, 3].map((i) => t0 + i * a), at: 14 + 2 * s };
  },
  answer: ({ vals, a, s }) => vals[3] + s * a,
  bugs: {
    'last-value': ({ vals }) => vals[3], // the trend taken to stop
    'one-step': ({ vals, a, s }) => (s > 1 ? vals[3] + a : null), // one step added whatever the time asked
    'hours-as-steps': ({ vals, a, s }) => vals[3] + 2 * s * a, // (critique) hours counted as steps of two hours
  },
});

// ---------------------------------------------------------------- shared words (the models' texts and solutions)

/** stats:6: every value changed, the range after. */
export function stats6Text({ op, vals, c }) {
  if (op === 'add') return `המורה הוסיפה $${c}$ נקודות לכל אחד מהציונים ${listMath(vals)}. מה הטווח של הציונים עכשיו?`;
  if (op === 'x2') return `בסיבוב הראשון של משחק קיבלו השחקנים את הנקודות ${listMath(vals)}. בסיבוב הבונוס הנקודות של כל שחקן הוכפלו ב־$2$. מה הטווח של הנקודות בסיבוב הבונוס?`;
  return `מחירי המוצרים בחנות, בשקלים: ${listMath(vals)}. כל המחירים עלו ב־$10\\%$, כלומר הוכפלו ב־$1.1$. מה הטווח של המחירים עכשיו?`;
}
export function stats6Solution({ op, vals, c, r }) {
  const M = Math.max(...vals); const m = Math.min(...vals);
  const before = `לפני: הגדול $${M}$ והקטן $${m}$, הטווח $${M} - ${m} = ${r}$.`;
  if (op === 'add') return [before, `אחרי: $${M + c} - ${m + c} = ${r}$. הגדול והקטן עלו שניהם ב־$${c}$, והמרחק ביניהם לא השתנה.`];
  const f = op === 'x2' ? 2 : 1.1;
  return [before, `אחרי: $${num(f * M)} - ${num(f * m)} = ${num(f * r)}$. כל מרחק הוכפל ב־$${num(f)}$, וגם הטווח.`];
}
export const stats6Hint = ({ op, c }) => (op === 'add' ? `מה קורה לנתון הגדול ולנתון הקטן כשמוסיפים לכולם $${c}$?` : 'כשכל נתון מוכפל, גם הגדול וגם הקטן מוכפלים. מה קורה למרחק ביניהם?');

/** stats:6 transfer: the workshop. */
export const stats6TText = ({ a, b, w1, w2, M, d }) => `בבית מלאכה $${a}$ עובדים מרוויחים $${k(w1)}$ ש״ח בחודש, $${b}$ עובדים $${k(w2)}$ ש״ח, והמנהל $${k(M)}$ ש״ח. המנהל קיבל תוספת של $${k(d)}$ ש״ח. מה השכר הממוצע עכשיו?`;
export const stats6TSolution = ({ a, b, w1, w2, M, d, N, S }) => [
  `סכום השכר: $${a} \\cdot ${k(w1)} + ${b} \\cdot ${k(w2)} + ${k(M)} = ${k(S)}$, של $${N}$ עובדים.`,
  `הממוצע לפני: $${k(S)} : ${N} = ${k(S / N)}$.`,
  `התוספת מתחלקת בין כולם: $${k(d)} : ${N} = ${k(d / N)}$.`,
  `$${k(S / N)} + ${k(d / N)} = ${k((S + d) / N)}$`,
];
export const stats6THint = () => 'קודם סכום כל המשכורות ומספר העובדים. תוספת לעובד אחד מתחלקת בין כולם.';

/** stats:7: the long jump, two sources. */
export const JUMPS = [1, 2, 3, 4, 5];
export const windFig = (wind, extra = {}) => ({ type: 'chart', mode: 'line', xs: JUMPS, values: wind, level: 2, dp: 1, step: 0.5, max: 3.5, unit: 'רוח גב (מטר לשנייה) בכל קפיצה', ...extra });
export const jumpsTable = (d, extra = {}) => ({ ...tableFig(['קפיצה', 'מרחק (ס״מ)'], d.map((x, i) => [i + 1, x])), ...extra });
export const stats7Fig = ({ wind, d }) => ({ type: 'pair', items: [windFig(wind), jumpsTable(d)], titles: ['מקור 1: הרוח', 'מקור 2: המרחקים'] });
export const stats7Text = () => 'קפיצה לרוחק נחשבת רק אם רוח הגב לא עלתה על $2.0$ מטר לשנייה. מה הממוצע של הקפיצות שנחשבות, בס״מ?';
export function stats7Solution({ legal, wind, d }) {
  const s = sum(legal.map((i) => d[i])); const out = legal.map((i) => i + 1);
  return [
    `מגרף הרוח: ${[0, 1, 2, 3, 4].filter((i) => !legal.includes(i)).map((i) => `בקפיצה $${i + 1}$ הרוח $${wind[i].toFixed(1)}$`).join(' ו')}, יותר מ־$2.0$. נחשבות ${out.map((i) => `$${i}$`).join(', ')}.`,
    `מהטבלה: $${legal.map((i) => d[i]).join(' + ')} = ${s}$`,
    `$${s} : ${legal.length} = ${num(s / legal.length)}$`,
  ];
}
export const stats7Hint = () => 'קודם בגרף הרוח: אילו קפיצות נחשבות? אחר כך בטבלה: רק המרחקים שלהן.';

/** stats:7 transfer: the electricity bill. */
export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי'];
export const SEASONS = ['חורף', 'אביב', 'קיץ', 'סתיו'];
export const billFig = ({ m, seasons }) => ({
  type: 'pair',
  items: [barFig(MONTHS, m, { step: 100, max: 700, unit: 'קוט״ש בכל חודש, השנה', labels: true }), barFig(SEASONS, seasons, { step: 100, max: 700, unit: 'ממוצע חודשי בכל עונה, בשנה שעברה (קוט״ש)', labels: true })],
  titles: ['מקור 1: השנה', 'מקור 2: בשנה שעברה'],
});
export const stats7TText = () => 'בכמה קוט״ש הממוצע החודשי באביב השנה (מרץ, אפריל ומאי) גבוה מהממוצע החודשי באביב בשנה שעברה?';
export function stats7TSolution({ m, S }) {
  const sp = m.slice(2); const mean = sum(sp) / 3;
  return [`האביב השנה: $${sp.join(' + ')} = ${sum(sp)}$, ו־$${sum(sp)} : 3 = ${num(mean)}$`, `מהמקור השני: באביב בשנה שעברה $${S}$ בחודש.`, `$${num(mean)} - ${S} = ${num(mean - S)}$`];
}
export const stats7THint = () => 'משווים ממוצע חודשי לממוצע חודשי: קודם הממוצע של שלושת חודשי האביב השנה.';

/** stats:8: two years in a table, a uniform change. */
const THINGS = [
  { what: 'החברים במועדון', short: 'חברים' }, { what: 'העצים בחורשה', short: 'עצים' },
  { what: 'הציפורים בשמורה', short: 'ציפורים' }, { what: 'התלמידים בבית הספר', short: 'תלמידים' },
];
export const thingOf = ({ y1, x1 }) => THINGS[(y1 + x1) % THINGS.length];
export const stats8Fig = (p) => tableFig(['שנה', `מספר ${thingOf(p).short}`], [[p.x1, p.y1], [p.x1 + p.d, p.y2]]);
export const stats8Text = (p) => `בטבלה: מספר ${thingOf(p).what} בשתי שנים. השינוי היה אחיד, אותו שינוי בכל שנה. כמה ${thingOf(p).short} היו ב־$${p.x1 + p.j}$?`;
export function stats8Solution({ d, j, rate, y1, y2, x1 }) {
  return [
    `השינוי: $${y2} - ${y1} = ${y2 - y1}$ ב־$${d}$ שנים, כלומר $${y2 - y1} : ${d} = ${rate}$ בכל שנה.`,
    `$${x1 + j}$ היא $${j}$ ${j === 1 ? 'שנה' : 'שנים'} אחרי $${x1}$.`,
    `$${plusTimes(y1, j, rate)} = ${y1 + j * rate}$`,
  ];
}
export const stats8Hint = () => 'כמה השתנה בכל שנה? וכמה שנים עברו מהשנה הראשונה בטבלה?';

/** stats:8 transfer: the festival's tickets. */
export const HOURS = ['8:00', '10:00', '12:00', '14:00'];
export const ticketsFig = (vals, extra = {}) => ({ type: 'chart', mode: 'line', xs: [...HOURS, '16:00', '18:00', '20:00'].slice(0, vals.length), values: vals, unit: 'כרטיסים שנמכרו עד השעה', ...extra });
export const stats8TFig = ({ vals }) => ticketsFig(vals);
export const stats8TText = ({ at }) => `בגרף: כמה כרטיסים לפסטיבל נמכרו עד כל שעה. בכל שעתיים נמכר אותו מספר כרטיסים. אם המגמה תימשך, כמה כרטיסים יימכרו עד $${at}{:}00$?`;
export const stats8TSolution = ({ vals, a, s, at }) => [
  `בכל שעתיים עוד $${a}$ כרטיסים: $${vals[1]} - ${vals[0]} = ${a}$.`,
  `מ־$14{:}00$ עד $${at}{:}00$: ${s === 1 ? 'צעד אחד' : `$${s}$ צעדים`} של שעתיים.`,
  `$${s === 1 ? `${vals[3]} + ${a}` : `${vals[3]} + ${s} \\cdot ${a}`} = ${vals[3] + s * a}$`,
];
export const stats8THint = () => 'בכמה עולה המספר בכל שעתיים? כמה צעדים של שעתיים יש מ־14:00 עד השעה שבשאלה?';

// ---------------------------------------------------------------- stats:6 generators

/** The range of 7 to 10 unsorted values (the range never one of them). */
function rangeOf() {
  for (;;) {
    const n = rint(rnd, 7, 10); const vals = Array.from({ length: n }, () => rint(rnd, 1, 60));
    const M = Math.max(...vals); const m = Math.min(...vals); const r = M - m;
    if (r < 6 || vals.includes(r)) continue;
    const fl = Math.abs(vals[n - 1] - vals[0]);
    return {
      key: `st6r:${vals.join(',')}`, text: `מה הטווח של הנתונים ${listMath(vals)}?`, form: 'num', answer: r,
      hint: 'מחפשים את הנתון הגדול ביותר ואת הקטן ביותר, בכל הרשימה.',
      solution: [`הגדול $${M}$, הקטן $${m}$.`, `$${M} - ${m} = ${r}$`],
      diag: diagWith(r, { 'range-max': M, 'first-last': fl > 0 && fl !== r ? fl : null }),
    };
  }
}
/** The range after every value changed (the model's own draw). */
function shiftRange() {
  const p = STATS6.params(rnd); const ans = STATS6.answer(p);
  return {
    key: `st6s:${p.op}:${p.vals.join(',')}:${p.c ?? 0}`, text: stats6Text(p), form: 'num', answer: ans,
    hint: stats6Hint(p), solution: stats6Solution(p), diag: diagWith(ans, bugsAt(STATS6, p)),
  };
}
/** The mean after every value changed: +c moves it by c, ×2 doubles it. */
function shiftMean() {
  const n = rint(rnd, 5, 8); const m = rint(rnd, 10, 40); const op = rnd() < 0.6 ? 'add' : 'x2'; const c = rint(rnd, 3, 9);
  const ans = op === 'add' ? m + c : 2 * m;
  return {
    key: `st6m:${n}:${m}:${op}:${op === 'add' ? c : 2}`,
    text: op === 'add' ? `הממוצע של $${n}$ נתונים הוא $${m}$. לכל אחד מהנתונים הוסיפו $${c}$. מה הממוצע עכשיו?` : `הממוצע של $${n}$ נתונים הוא $${m}$. כל אחד מהנתונים הוכפל ב־$2$. מה הממוצע עכשיו?`,
    form: 'num', answer: ans,
    hint: op === 'add' ? `הסכום גדל ב־$${n} \\cdot ${c}$, ומחלקים שוב ב־$${n}$.` : 'כשכל נתון מוכפל, גם הסכום מוכפל.',
    solution: op === 'add'
      ? [`כל נתון עלה ב־$${c}$, ולכן הסכום עלה ב־$${n} \\cdot ${c} = ${n * c}$.`, `הממוצע עלה ב־$${n * c} : ${n} = ${c}$: $${m} + ${c} = ${ans}$`]
      : [`כל נתון הוכפל, ולכן גם הסכום הוכפל, ומספר הנתונים נשאר $${n}$.`, `$2 \\cdot ${m} = ${ans}$`],
    diag: diagWith(ans, { 'mean-unchanged': m }),
  };
}
/** The workshop's mean after one raise (the transfer model's own draw). */
function raise() {
  const p = STATS6T.params(rnd); const ans = STATS6T.answer(p);
  return {
    key: `st6t:${p.a}:${p.b}:${p.w1}:${p.w2}:${p.M}:${p.d}`, text: stats6TText(p), form: 'num', answer: ans, unit: 'ש״ח',
    hint: stats6THint(p), solution: stats6TSolution(p), diag: diagWith(ans, bugsAt(STATS6T, p)),
  };
}
/** Which measure moves most when a very large value joins (three choices, practice only): the mean. */
function outlierMc() {
  for (;;) {
    const mode = rint(rnd, 12, 20); const vals = [mode, mode, mode, ...Array.from({ length: 4 }, () => rint(rnd, 10, 24))];
    if (vals.slice(3).filter((v) => v === mode).length) continue;
    if (new Set(vals.slice(3)).size < 4) continue;
    const S = sum(vals); if (S % 7) continue;
    const X = 10 * rint(rnd, 10, 20); if ((S + X) % 8) continue;
    const sorted = [...vals].sort((a, b) => a - b); const med = sorted[3]; const med2 = (sorted[3] + sorted[4]) / 2;
    const list = shuf(rnd, vals);
    const choices = shuffle([{ text: 'הממוצע', ok: true }, { text: 'החציון', ok: false }, { text: 'השכיח', ok: false }]);
    return {
      key: `st6o:${list.join(',')}:${X}`, text: `הנתונים: ${listMath(list)}. מוסיפים להם נתון גדול מאוד, $${X}$. איזה מדד ישתנה הכי הרבה?`,
      form: 'mc', choices, answer: choices.findIndex((x) => x.ok), practiceOnly: true,
      hint: 'הממוצע מחלק את הסכום בין כל הנתונים. החציון רק סופר מקומות, והשכיח סופר חזרות.',
      solution: [
        `הממוצע: לפני $${S} : 7 = ${S / 7}$, אחרי $${S + X} : 8 = ${(S + X) / 8}$.`,
        `החציון: לפני $${med}$, אחרי $${num(med2)}$. השכיח נשאר $${mode}$.`,
        'נתון רחוק מהשאר מזיז את הממוצע הכי הרבה.',
      ],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- stats:7 generators

/** The mean of the legal jumps (the model's own draw). */
function jumps() {
  const p = STATS7.params(rnd); const ans = STATS7.answer(p);
  return {
    key: `st7j:${p.wind.map(num).join(',')}:${p.d.join(',')}`, text: stats7Text(p), fig: stats7Fig(p), form: 'num', answer: ans, unit: 'ס״מ',
    hint: stats7Hint(p), solution: stats7Solution(p), diag: diagWith(ans, bugsAt(STATS7, p)),
  };
}
/** This spring's monthly mean against last spring's (the transfer model's own draw). */
function bill() {
  const p = STATS7T.params(rnd); const ans = STATS7T.answer(p);
  return {
    key: `st7b:${p.m.join(',')}:${p.seasons.join(',')}`, text: stats7TText(p), fig: billFig(p), form: 'num', answer: ans,
    hint: stats7THint(p), solution: stats7TSolution(p), diag: diagWith(ans, bugsAt(STATS7T, p)),
  };
}
const CLASSES8 = ['ח׳1', 'ח׳2', 'ח׳3'];
/** A pie in percents of a grade, and a table of its classes' sizes: how many chose X? (the total from the table) */
function pieTotal() {
  for (;;) {
    const sizes = CLASSES8.map(() => rint(rnd, 24, 36)); const N = sum(sizes); if (N % 20) continue;
    const n = pick(rnd, [3, 4]); const ps = []; let left = 100;
    for (let i = 0; i < n - 1; i += 1) { const q = 5 * rint(rnd, 2, Math.min(12, left / 5 - 2 * (n - 1 - i))); ps.push(q); left -= q; }
    ps.push(left); if (left < 10 || new Set(ps).size !== n) continue;
    const x = rint(rnd, 0, n - 1); const ans = (ps[x] * N) / 100;
    if (!whole(ans) || [...sizes, ...ps, N].includes(ans)) continue;
    return {
      key: `st7p:${sizes.join(',')}:${ps.join(',')}:${x}`,
      text: `כל תלמידי שכבת ח׳ בחרו חוג אחד. כמה תלמידים בשכבה בחרו ב${HOBBIES[x]}?`,
      fig: { type: 'pair', items: [tableFig(['כיתה', 'מספר תלמידים'], CLASSES8.map((c, i) => [c, sizes[i]])), pieFig(HOBBIES.slice(0, n), ps, { pct: true })], titles: ['מקור 1: הכיתות', 'מקור 2: החוגים בשכבה'] },
      form: 'num', answer: ans,
      hint: 'מהטבלה: כמה תלמידים בכל השכבה? מהעוגה: איזה אחוז מהם בחרו בחוג הזה?',
      solution: [`מהטבלה: בשכבה $${sizes.join(' + ')} = ${N}$ תלמידים.`, `מהעוגה: $${ps[x]}\\%$. $${ps[x]}\\%$ מ־$${N}$: $${num(ps[x] / 100)} \\cdot ${N} = ${ans}$`],
      diag: diagWith(ans, { 'count-as-pct': ps[x] }),
    };
  }
}
const SPORTS3 = ['כדורגל', 'כדורסל', 'שחייה', 'טניס'];
/** What does not fit: a pie of more than 100%, or a chart that says another number than the table (practice only). */
function contradictMc() {
  if (rnd() < 0.5) {
    for (;;) {
      const ps = [5 * rint(rnd, 4, 10), 5 * rint(rnd, 4, 10)]; const extra = pick(rnd, [5, 10]); ps.push(100 + extra - sum(ps));
      if (ps[2] < 10 || new Set(ps).size < 3) continue;
      const N = pick(rnd, [20, 25, 30, 40]);
      const choices = shuffle([{ text: `סכום האחוזים בעוגה הוא ${100 + extra}%, לא 100%`, ok: true }, { text: 'הכול מסתדר', ok: false }, { text: `בכיתה של ${N} תלמידים אי אפשר להציג אחוזים`, ok: false }]);
      return {
        key: `st7c:0:${ps.join(',')}:${N}`, text: `בכיתה ח׳ יש $${N}$ תלמידים. דיאגרמת העוגה מראה איך הם מגיעים לבית הספר. מה לא מסתדר?`,
        fig: pieFig(['ברגל', 'באוטובוס', 'באופניים'], ps, { pct: true }),
        form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
        hint: 'כל הגזרות של עוגה אחת יחד הן כמה אחוזים?',
        solution: [`$${ps.join('\\% + ')}\\% = ${100 + extra}\\%$`, 'בעוגה אחת כל הגזרות יחד הן $100\\%$, ולכן אחד המספרים שגוי.'],
        diag: () => null,
      };
    }
  }
  const vals = SPORTS3.map(() => 2 * rint(rnd, 2, 7)); const i = rint(rnd, 0, 3);
  const off = vals[i] + (vals[i] > 4 && rnd() < 0.5 ? -2 : 2); const drawn = vals.map((v, j) => (j === i ? off : v));
  const other = (i + 1 + rint(rnd, 0, 2)) % 4;
  const choices = shuffle([
    { text: `${SPORTS3[i]}: בטבלה ${vals[i]} ובדיאגרמה ${off}`, ok: true },
    { text: 'הכול מסתדר', ok: false },
    { text: `${SPORTS3[other]}: בטבלה ${vals[other]} ובדיאגרמה ${vals[other] + 2}`, ok: false },
  ]);
  return {
    key: `st7c:1:${vals.join(',')}:${i}:${off}`, text: 'שני מקורות על אותו סקר: כמה תלמידים בחרו בכל ספורט. מה לא מסתדר?',
    fig: { type: 'pair', items: [tableFig(['ספורט', 'מספר תלמידים'], SPORTS3.map((s, j) => [s, vals[j]])), barFig(SPORTS3, drawn, { step: 2, max: 16, unit: 'מספר תלמידים', labels: false })], titles: ['מקור 1: טבלה', 'מקור 2: דיאגרמה'] },
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'עוברים ספורט אחרי ספורט: מה הטבלה אומרת, ולאן מגיעה העמודה?',
    solution: [`ב${SPORTS3[i]} הטבלה אומרת $${vals[i]}$, והעמודה מגיעה ל־$${off}$.`, 'שני מקורות על אותו סקר צריכים להסכים. כשהם סותרים, קודם בודקים מה נכון.'],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- stats:8 generators

/** A value between two years (the model's own draw). */
function interp() {
  const p = STATS8.params(rnd); const ans = STATS8.answer(p);
  return {
    key: `st8i:${p.d}:${p.j}:${p.rate}:${p.y1}:${p.x1}`, text: stats8Text(p), fig: stats8Fig(p), form: 'num', answer: ans,
    hint: stats8Hint(p), solution: stats8Solution(p), diag: diagWith(ans, bugsAt(STATS8, p)),
  };
}
/** The festival's tickets carried on (the transfer model's own draw). */
function extrap() {
  const p = STATS8T.params(rnd); const ans = STATS8T.answer(p);
  return {
    key: `st8e:${p.t0}:${p.a}:${p.s}`, text: stats8TText(p), fig: stats8TFig(p), form: 'num', answer: ans,
    hint: stats8THint(p), solution: stats8TSolution(p), diag: diagWith(ans, bugsAt(STATS8T, p)),
  };
}
/** Between the data or beyond them? (two choices, practice only) */
function whichMc() {
  const x1 = rint(rnd, 2010, 2016); const d = pick(rnd, [4, 5, 6, 8]); const inside = rnd() < 0.5;
  const ask = inside ? x1 + rint(rnd, 1, d - 1) : rnd() < 0.5 ? x1 + d + rint(rnd, 1, 4) : x1 - rint(rnd, 1, 3);
  const y1 = 10 * rint(rnd, 5, 20); const y2 = y1 + 10 * rint(rnd, 2, 8);
  const choices = [{ text: 'אינטרפולציה: בין הנתונים' }, { text: 'אקסטרפולציה: מעבר לנתונים' }];
  return {
    key: `st8w:${x1}:${d}:${ask}:${y1}:${y2}`, text: `בטבלה מספר המנויים לספרייה ב־$${x1}$ וב־$${x1 + d}$. מעריכים כמה מנויים היו ב־$${ask}$. זו אינטרפולציה או אקסטרפולציה?`,
    fig: tableFig(['שנה', 'מספר מנויים'], [[x1, y1], [x1 + d, y2]]),
    form: 'mc', choices, answer: inside ? 0 : 1, practiceOnly: true,
    hint: `האם $${ask}$ נמצאת בין $${x1}$ ל־$${x1 + d}$?`,
    solution: [inside ? `$${ask}$ נמצאת בין $${x1}$ ל־$${x1 + d}$: אינטרפולציה.` : `$${ask}$ ${ask > x1 ? `אחרי $${x1 + d}$` : `לפני $${x1}$`}, מחוץ לנתונים: אקסטרפולציה, ולכן רק הערכה.`],
    diag: () => null,
  };
}
/** A trend carried far beyond the data (two choices, practice only; the far value is far-extrap). */
const LIMITS = [
  { key: 0, text: (a, r, t0, t1, T) => `ילד גדל $${r}$ ס״מ בשנה מגיל $${t0}$ עד גיל $${t1}$, ובגיל $${t1}$ גובהו $${a}$ ס״מ. אם נמשיך את המגמה, מה יהיה גובהו בגיל $${T}$?`, unit: 'ס״מ', why: 'אנשים מפסיקים לגדול בסוף גיל ההתבגרות.' },
  { key: 1, text: (a, r, t0, t1, T) => `גור כלבים עלה $${r}$ ק״ג בכל חודש מגיל $${t0}$ חודשים עד גיל $${t1}$ חודשים, ובגיל $${t1}$ חודשים שקל $${a}$ ק״ג. אם נמשיך את המגמה, כמה ישקול בגיל $${T}$ חודשים?`, unit: 'ק״ג', why: 'כלב מפסיק לגדול כשהוא מבוגר.' },
  { key: 2, text: (a, r, t0, t1, T) => `שתיל גדל $${r}$ ס״מ בכל שבוע משבוע $${t0}$ עד שבוע $${t1}$, ובשבוע $${t1}$ גובהו $${a}$ ס״מ. אם נמשיך את המגמה, מה יהיה גובהו בשבוע $${T}$?`, unit: 'ס״מ', why: 'צמח לא ממשיך לגדול באותו קצב לעולם.' },
];
function limitsMc() {
  const L = pick(rnd, LIMITS);
  const [r, t0, t1, T, a] = L.key === 0 ? [rint(rnd, 5, 7), 4, 10, 30, rint(rnd, 130, 145)] : L.key === 1 ? [rint(rnd, 2, 3), 2, 6, 60, rint(rnd, 10, 16)] : [rint(rnd, 3, 6), 1, 5, 200, rint(rnd, 15, 30)];
  const far = a + r * (T - t1);
  const choices = shuffle([
    { text: `לא הגיוני להמשיך כך: ${far} ${L.unit}`, ok: true },
    { text: `${far} ${L.unit}`, ok: false, bug: 'far-extrap' },
  ]);
  return {
    key: `st8l:${L.key}:${a}:${r}:${t1}:${T}`, text: L.text(a, r, t0, t1, T),
    fig: { type: 'chart', mode: 'line', xs: [t0, t1, T], values: [a - r * (t1 - t0), a, far], dashed: 1, unit: L.unit === 'ק״ג' ? 'משקל (ק״ג)' : 'גובה (ס״מ)' },
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'חשבו כמה זה יוצא, ושאלו: האם המגמה באמת נמשכת כל כך הרבה זמן?',
    solution: [`$${plusTimes(a, T - t1, r)} = ${far}$ ${L.unit}.`, `זה לא הגיוני: ${L.why} ככל שמתרחקים מהנתונים, ההערכה פחות בטוחה.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- the levels and the names (grade8.js stats)

export const STATS2_LEVELS = [
  { title: 'טווח ושינוי של כל הנתונים', gen: () => { const r = Math.random(); return r < 0.3 ? rangeOf() : r < 0.6 ? shiftRange() : r < 0.75 ? shiftMean() : r < 0.9 ? raise() : outlierMc(); } },
  { title: 'שני מקורות מידע', gen: () => { const r = Math.random(); return r < 0.4 ? jumps() : r < 0.65 ? bill() : r < 0.85 ? pieTotal() : contradictMc(); } },
  { title: 'אינטרפולציה ואקסטרפולציה', gen: () => { const r = Math.random(); return r < 0.4 ? interp() : r < 0.7 ? extrap() : r < 0.85 ? whichMc() : limitsMc(); } },
];

export const STATS2_CATS = {
  'range-max': 'כתבו את הערך הגדול ביותר במקום הטווח',
  'first-last': 'חישבו טווח מהנתון הראשון והאחרון ברשימה בלי לחפש את הגדול והקטן',
  'shift-range': 'חשבו שהוספה של אותו מספר לכל הנתונים מגדילה את הטווח',
  'range-unchanged': 'חשבו שכפל של כל הנתונים במספר לא משנה את הטווח',
  'mean-unchanged': 'חשבו שהממוצע לא משתנה כשהנתונים משתנים',
  'whole-raise': 'הוסיפו לממוצע את כל התוספת של נתון אחד',
  'ignore-source': 'השתמשו רק במקור מידע אחד',
  'all-count': 'חילקו במספר כל הנתונים, גם אלה שהמקור השני פוסל',
  'total-not-mean': 'השוו סכום לממוצע',
  'all-months': 'חישבו ממוצע של כל החודשים ולא רק של העונה',
  midpoint: 'לקחו את האמצע בין שני הערכים בלי להתחשב במרחק',
  'steps-not-scaled': 'הוסיפו את כל ההפרש בכל צעד',
  'wrong-end': 'מדדו את המרחק מהקצה השני',
  'last-value': 'הניחו שהערך יישאר כמו בפעם האחרונה',
  'one-step': 'הוסיפו צעד אחד במקום כל הצעדים עד הזמן המבוקש',
  'no-start': 'חישבו רק את השינוי, בלי הערך שממנו מתחילים',
  'hours-as-steps': 'ספרו שעות במקום צעדים של שעתיים',
  'far-extrap': 'המשיכו מגמה רחוק מעבר לנתונים כאילו היא בטוחה',
  // pct's id and words (content/pct.js)
  'count-as-pct': 'כתבו את מספר החלקים או את האחוז עצמו כאילו הוא הכמות',
};
