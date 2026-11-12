// Probability (הסתברות), ח׳'s "הסתברות ב" in unit 8.16 (March; curriculum stage 3, DATA-6): equally likely outcomes,
// the complementary event, and a two-stage experiment counted in a table. ח׳'s "הסתברות א – בסיס" is data:4 (the ז׳
// data unit, on the ח׳ path this year). Symmetry first, then the complement, then the table of pairs, as the Ministry
// frames it; trees, the product rule, conditional probability and independence are ט׳ and are taught nowhere here.
// Taught in March, so the first-day placement test skips it (placement: false).
//
// The updated curriculum says of ח׳ probability "בשלב הזה עדיין לא משתמשים בסימון של מאורע באותיות": no text, display or
// step writes P(A) or "P =": it says "ההסתברות של …" in words.
// The diagnostic models (PROB1 to PROB3T) are the stage-3 spec's (scratchpad/lanes/stage3/spec/models.mjs), ported
// unchanged, all with the exact-typing rule for answers in [0, 1] (content/data.js cleanP); prob:3's answers are a
// fraction (form 'frac': 6/36 and 1/6 both right), since two dice's probabilities are 1/36 apart. Every probability
// typed as a number is `precise`. The numbers and situations of the Ministry's examples (the raffle of 72, the sticker
// die, the rain table, the 28 pens, "30% chance of rain") are facts; every sentence here is the app's own. Errors and
// sources:
//   count-not-prob, one-over-n, equiprob-event   the count k, one outcome's 1/n, or "it happens or not" = 1/2 for an event
//                    (Lecoutre 1992, ESM 23(6); Fischbein & Schnarch 1997, JRME 28(1))
//   fencepost        b to N counted as N − b numbers (the Ministry's raffle; teacher-reported)
//   no-symmetry      1/n assumed for a die or a coin that is not symmetric (the Ministry's sticker die)
//   same-prob, hundred-minus, others-given, one-part   the complement given the event's own probability, 100 − p for a
//                    probability between 0 and 1, only the listed outcomes added (the Ministry's "הסכום … הוא 1")
//   complement-only  the complement found and not taken from 1 (critique)
//   gambler          after many heads, tails "is due" or heads "is hot" (Tversky & Kahneman 1974)
//   outcome-approach a probability read as a sure forecast or as a part of the time (Konold 1989; the Ministry's Danny;
//                    the forecast choice of prob:2, forecastMc)
//   equiprob-sums, unordered, space-21   the 11 sums taken as equally likely; (5, 6) and (6, 5) as one; the 21 pairs
//                    without order as equally likely (Lecoutre 1992; Fischbein, Nello & Marino 1991)
//   add-probs, one-stage   the two stages' probabilities added; one stage only (teacher-reported)
//   representativeness     a "mixed" result taken as likelier than an "ordered" one (Fischbein & Schnarch 1997)
import { shuffle, toFrac } from './util.js';
import { cleanP, mk, bugsAt, diagWith, num, relTex, tableFig } from './data.js';
import { simDiag } from './manip.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
/** A fraction answer ({ n, d }, the 'frac' form) or a number, as its value. */
const valueOf = (u) => (u && typeof u === 'object' ? u.n / u.d : u);
/**
 * The diagnosis of a fraction answer: a typed fraction names a mistake only when its value is a prediction exactly
 * (6/21 and 2/7 alike); a fraction near one (1/10 for 1/11) names nothing, since nothing is rounded when a fraction is
 * typed. The predictions are listed as fractions ({ n, d }), so content/index.js namesOf finds them at once.
 */
function fracDiag(ans, bugs) {
  const real = Object.entries(bugs).filter(([, v]) => v != null && Number.isFinite(v) && Math.abs(v - ans) > 1e-9);
  const f = (u) => {
    if (!u || typeof u !== 'object' || !u.d) return null;
    const hit = real.find(([, v]) => Math.abs(valueOf(u) - v) <= 1e-9);
    return hit ? hit[0] : null;
  };
  f.wrongs = real.map(([, v]) => toFrac(v)).filter(Boolean);
  return f;
}
/** \frac{a}{b}, reduced when it reduces: \frac{6}{36} = \frac{1}{6}. */
const fracTex = (a, b) => { const g = gcd(a, b); return g > 1 ? `\\frac{${a}}{${b}} = \\frac{${a / g}}{${b / g}}` : `\\frac{${a}}{${b}}`; };

// ---------------------------------------------------------------- the models (spec/models.mjs, unchanged)

const EVENTS = [
  { id: 'even', ok: (v) => v % 2 === 0 },
  { id: 'gt', ok: (v, t) => v > t },
  { id: 'mult', ok: (v, t) => v % t === 0 },
  { id: 'le', ok: (v, t) => v <= t },
];
/**
 * prob:1 D. n equally likely outcomes (a die, cards 1..n, a spinner of n equal sectors); an event of k of them.
 * Bugs: the count k, one outcome's 1/n, and "it happens or it does not" = 1/2.
 */
export const PROB1 = mk({
  raw: (r) => {
    const n = pick(r, [6, 6, 8, 10, 12, 20]); const e = pick(r, EVENTS);
    const t = e.id === 'mult' ? pick(r, [3, 4, 5]) : e.id === 'even' ? null : rint(r, 2, n - 2);
    const k = Array.from({ length: n }, (_, i) => i + 1).filter((v) => e.ok(v, t)).length;
    if (k < 2 || k === n) return null;
    if (2 * k === n && r() < 0.8) return null; // P = 1/2 kept rare: the constant guess 1/2 must not pass a check
    return { n, e: e.id, t, k };
  },
  answer: ({ n, k }) => k / n,
  bugs: {
    'count-not-prob': ({ k }) => k,
    'one-over-n': ({ n }) => 1 / n,
    'equiprob-event': () => 1 / 2,
  },
}, cleanP);
/**
 * prob:1 T. The Ministry's raffle: tickets 1..N, the winners are 1..a and b..N. P(win). Bugs: b..N counted as N - b
 * numbers (the fencepost), and the count of winners.
 */
export const PROB1T = mk({
  raw: (r) => {
    const N = pick(r, [50, 60, 72, 80, 100, 120]); const a = rint(r, 3, 12); const b = rint(r, Math.ceil(N / 2), N - 5);
    return { N, a, b, w: a + N - b + 1 };
  },
  answer: ({ N, w }) => w / N,
  bugs: {
    fencepost: ({ N, a, b }) => (a + N - b) / N,
    'count-not-prob': ({ w }) => w,
  },
}, cleanP);
/**
 * prob:2 D. A spinner of four colours, three probabilities given (multiples of 0.05), "the rest is green".
 * P(not X) for a listed X. Bugs: the same probability as X, 100 − p on a 0..1 scale, and only the listed others added.
 */
export const PROB2 = mk({
  raw: (r) => {
    const p = [0, 1, 2].map(() => rint(r, 2, 8) * 0.05); const g = 1 - sum(p);
    if (g < 0.1 - 1e-9) return null;
    const x = rint(r, 0, 2);
    return { p: p.map((v) => Math.round(v * 100) / 100), g: Math.round(g * 100) / 100, x };
  },
  answer: ({ p, x }) => Math.round((1 - p[x]) * 100) / 100,
  bugs: {
    'same-prob': ({ p, x }) => p[x],
    'hundred-minus': ({ p, x }) => Math.round((100 - p[x]) * 100) / 100,
    'others-given': ({ p, x }) => Math.round(sum(p.filter((_, i) => i !== x)) * 100) / 100,
  },
}, cleanP);
/**
 * prob:2 T. The Ministry's pens: N pens, P(blue) = a/b, there are m times as many pink as blue, the rest other
 * colours. P(neither blue nor pink). Bugs: only blue taken away, and pens counted instead of a probability.
 */
export const PROB2T = mk({
  raw: (r) => {
    const N = pick(r, [20, 24, 28, 30, 36, 40, 42, 48, 50, 60]); const b = pick(r, [4, 5, 6, 7, 8, 10, 12]); if (N % b) return null;
    const a = rint(r, 1, b - 1); if (gcd(a, b) !== 1) return null; const m = pick(r, [2, 3]);
    const blue = (a * N) / b; const pink = m * blue; if (blue + pink >= N - 1) return null;
    return { N, a, b, m, blue, pink };
  },
  answer: ({ N, blue, pink }) => (N - blue - pink) / N,
  bugs: {
    'one-part': ({ a, b }) => 1 - a / b, // only blue taken away
    'count-not-prob': ({ N, blue, pink }) => N - blue - pink,
  },
}, cleanP);

/** Ordered pairs of two dice with sum s, and the pairs without order. */
export const sumCount = (s) => 6 - Math.abs(s - 7);
export const sumPairs = (s) => { let c = 0; for (let x = 1; x <= 6; x += 1) for (let y = x; y <= 6; y += 1) if (x + y === s) c += 1; return c; };
/**
 * prob:3 D. Two fair dice, P(sum = s). Bugs: the 11 sums taken as equally likely (Lecoutre 1992), (5, 6) and (6, 5)
 * counted once out of 36, and the 21 unordered pairs taken as the equally likely outcomes. Answered as a fraction.
 */
export const PROB3 = mk({
  raw: (r) => {
    const e = pick(r, ['sum', 'sum', 'sum', 'ge', 'le']);
    const t = e === 'sum' ? rint(r, 3, 11) : e === 'ge' ? rint(r, 8, 10) : rint(r, 4, 6);
    const sums = e === 'sum' ? [t] : e === 'ge' ? Array.from({ length: 13 - t }, (_, i) => t + i) : Array.from({ length: t - 1 }, (_, i) => 2 + i);
    return { e, t, sums };
  },
  answer: ({ sums }) => sum(sums.map(sumCount)) / 36,
  bugs: {
    'equiprob-sums': ({ sums }) => sums.length / 11, // the 11 sums 2..12 taken as equally likely (Lecoutre 1992)
    unordered: ({ sums }) => sum(sums.map(sumPairs)) / 36, // (5, 6) and (6, 5) counted once (Fischbein, Nello & Marino 1991)
    'space-21': ({ sums }) => sum(sums.map(sumPairs)) / 21, // the 21 unordered pairs taken as the equally likely outcomes
  },
  form: 'frac',
}, cleanP);
/**
 * prob:3 T. A coin and a die, or a die and a four-colour spinner, or two spinners: P(X on the first and Y on the second),
 * counted in the table of n1·n2 cells. Bugs: the two stages' probabilities added, and one stage's only.
 */
export const PROB3T = mk({
  raw: (r) => {
    const kind = pick(r, ['coin-die', 'die-spin', 'spin-spin']);
    const n1 = kind === 'coin-die' ? 2 : kind === 'die-spin' ? 6 : pick(r, [3, 4]);
    const n2 = kind === 'coin-die' ? 6 : kind === 'die-spin' ? 4 : pick(r, [4, 5]);
    const k1 = kind === 'coin-die' ? 1 : rint(r, 1, n1 - 1); const k2 = rint(r, 1, n2 - 1);
    return { kind, n1, n2, k1, k2 };
  },
  answer: ({ n1, n2, k1, k2 }) => (k1 * k2) / (n1 * n2),
  bugs: {
    'add-probs': ({ n1, n2, k1, k2 }) => k1 / n1 + k2 / n2,
    'one-stage': ({ n2, k2 }) => k2 / n2,
  },
  form: 'frac',
}, cleanP);

// ---------------------------------------------------------------- figures and words

const FACES = ['1', '2', '3', '4', '5', '6'];
/** One die's six faces in a row, the given faces marked. */
export const dieRow = (marked = []) => ({ type: 'outcomes', cols: FACES, marked: marked.map((v) => [0, v - 1]), label: 'של קובייה אחת' });
/** The 36 cells of two dice (rows the first die, columns the second), each the sum, the given [first, second] marked. */
export const diceTable = (marked = []) => ({
  type: 'outcomes', rows: FACES, cols: FACES, rowHead: 'קובייה ראשונה', colHead: 'קובייה שנייה',
  cells: FACES.map((_, i) => FACES.map((__, j) => String(i + j + 2))), marked: marked.map(([a, b]) => [a - 1, b - 1]), label: 'של סכום שתי קוביות',
});
/** The cells of two dice whose sum is one of these. */
export const sumCells = (sums) => { const out = []; for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) if (sums.includes(a + b)) out.push([a, b]); return out; };

const deviceOf = ({ n, t }) => (n === 6 ? 'die' : (n + (t || 0)) % 2 ? 'cards' : 'wheel');
const setting = (dev, n) => (dev === 'die' ? 'מטילים קובייה הוגנת.' : dev === 'cards' ? `בקופסה $${n}$ כרטיסים, ממוספרים $1$ עד $${n}$. מוציאים כרטיס אחד בלי להסתכל.` : `מסובבים גלגל של $${n}$ גזרות שוות, ממוספרות $1$ עד $${n}$.`);
const eventWords = ({ e, t }) => (e === 'even' ? 'מספר זוגי' : e === 'gt' ? `מספר גדול מ־$${t}$` : e === 'mult' ? `כפולה של $${t}$` : `מספר שהוא $${t}$ או פחות`);
/** The outcomes of the event, as a student lists them (a long run as its ends). */
function outcomesOf({ n, e, t }) {
  const all = Array.from({ length: n }, (_, i) => i + 1).filter((v) => EVENTS.find((x) => x.id === e).ok(v, t));
  if (all.length <= 6) return all.map((v) => `$${v}$`).join(', ');
  if (e === 'gt' || e === 'le') return `המספרים מ־$${all[0]}$ עד $${all[all.length - 1]}$`;
  return `$${all[0]}, ${all[1]}, \\ldots, ${all[all.length - 1]}$`;
}

/** prob:1: equally likely outcomes. */
export const prob1Text = (p) => `${setting(deviceOf(p), p.n)} מה ההסתברות לקבל ${eventWords(p)}?`;
export const prob1Fig = (p) => (p.n === 6 ? dieRow() : undefined);
export const prob1Solution = (p) => [
  `יש $${p.n}$ תוצאות, וכולן שוות סיכוי.`,
  `מתאימות: ${outcomesOf(p)}. כלומר $${p.k}$ תוצאות.`,
  `$${relTex(p.k, p.n)}$`,
];
export const prob1Hint = () => 'כמה תוצאות יש בסך הכול? וכמה מהן מתאימות?';

/** prob:1 transfer: the raffle. */
export const raffleFig = ({ N, a, b }) => ({ type: 'outcomes', cols: [`1–${a}`, `${a + 1}–${b - 1}`, `${b}–${N}`], marked: [[0, 0], [0, 2]], label: 'כרטיסי ההגרלה, הזוכים מסומנים' });
export const prob1TText = ({ N, a, b }) => `בהגרלה $${N}$ כרטיסים, ממוספרים $1$ עד $${N}$. זוכים הכרטיסים $1$ עד $${a}$ ו־$${b}$ עד $${N}$. מה ההסתברות שכרטיס שנבחר באקראי יזכה?`;
export const prob1TSolution = ({ N, a, b, w }) => [
  `מ־$1$ עד $${a}$: $${a}$ כרטיסים.`,
  `מ־$${b}$ עד $${N}$: $${N} - ${b} + 1 = ${N - b + 1}$ כרטיסים, כי גם $${b}$ עצמו זוכה.`,
  `יחד $${w}$ מתוך $${N}$: $${relTex(w, N)}$`,
];
export const prob1THint = ({ b, N }) => `כמה מספרים יש מ־$${b}$ עד $${N}$? ספרו גם את שני הקצוות.`;

/** prob:2: the complement on a spinner of four colours, each named as it is drawn (TONE_WORDS). */
export const COLOURS4 = ['כתום', 'כחול', 'צהוב', 'סגול'];
export const prob2Fig = ({ p, g }) => ({ type: 'chart', mode: 'pie', cats: COLOURS4, values: [...p, g], hide: 3, tones: [1, 0, 4, 6] });
export const prob2Text = ({ p, x }) => `גלגל צבוע בארבעה צבעים. ההסתברות לכתום היא $${num(p[0])}$, לכחול $${num(p[1])}$ ולצהוב $${num(p[2])}$, והשאר סגול. מה ההסתברות לא לקבל ${COLOURS4[x]}?`;
export const prob2Solution = ({ p, x }) => [
  `"לא ${COLOURS4[x]}" הוא המאורע המשלים: כל מה שיכול לקרות חוץ מ${COLOURS4[x]}.`,
  `$1 - ${num(p[x])} = ${num(Math.round((1 - p[x]) * 100) / 100)}$`,
];
export const prob2Hint = () => 'ההסתברות של מאורע ועוד ההסתברות של המשלים שלו הן $1$.';

/** prob:2 transfer: the pens. */
export const prob2TText = ({ N, a, b, m }) => `במגירה $${N}$ עטים: כחולים, ורודים ועטים בצבעים אחרים. ההסתברות להוציא באקראי עט כחול היא $\\frac{${a}}{${b}}$, ויש פי $${m}$ עטים ורודים מכחולים. מה ההסתברות להוציא עט שאינו כחול ואינו ורוד?`;
export const prob2TSolution = ({ N, a, b, m, blue, pink }) => [
  `כחולים: $\\frac{${a}}{${b}} \\cdot ${N} = ${blue}$ עטים.`,
  `ורודים: $${m} \\cdot ${blue} = ${pink}$ עטים.`,
  `האחרים: $${N} - ${blue} - ${pink} = ${N - blue - pink}$, ולכן $${relTex(N - blue - pink, N)}$`,
];
export const prob2THint = () => 'קודם כמה עטים כחולים וכמה ורודים. מה שנשאר הם העטים האחרים.';

/** prob:3: the sum of two dice. */
const sumWords = ({ e, t }) => (e === 'sum' ? `הסכום יהיה $${t}$` : e === 'ge' ? `הסכום יהיה $${t}$ או יותר` : `הסכום יהיה $${t}$ או פחות`);
export const prob3Text = (p) => `מטילים שתי קוביות הוגנות. מה ההסתברות ש${sumWords(p)}?`;
export const prob3Fig = () => diceTable();
export function prob3Solution({ sums }) {
  const c = sum(sums.map(sumCount));
  return [
    'בטבלה $36$ תאים, וכולם שווי סיכוי.',
    `${sums.map((s) => `לסכום $${s}$: $${sumCount(s)}$ ${sumCount(s) === 1 ? 'תא' : 'תאים'}`).join(', ')}.${sums.length > 1 ? ` יחד $${c}$.` : ''}`,
    `$${fracTex(c, 36)}$`,
  ];
}
export const prob3Hint = () => 'סופרים בטבלה את התאים המתאימים. כל תא הוא תוצאה אחת מתוך $36$.';

/** prob:3 transfer: two stages in a table. */
const SPIN4 = ['אדום', 'כחול', 'ירוק', 'צהוב'];
const orList = (a) => (a.length === 1 ? a[0] : `${a.slice(0, -1).join(', ')} או ${a[a.length - 1]}`);
const range1 = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
export function prob3TStages({ kind, n1, n2 }) {
  if (kind === 'coin-die') return { rows: ['עץ', 'פלי'], cols: range1(6), rowHead: 'מטבע', colHead: 'קובייה' };
  if (kind === 'die-spin') return { rows: range1(6), cols: SPIN4, rowHead: 'קובייה', colHead: 'גלגל' };
  return { rows: range1(n1), cols: range1(n2), rowHead: 'גלגל ראשון', colHead: 'גלגל שני' };
}
/** The table of the two stages; more than three columns of pairs do not fit a 320 px phone, so each cell is a dot. */
export const prob3TFig = (p) => { const st = prob3TStages(p); return { type: 'outcomes', ...st, ...(st.cols.length > 3 ? { dots: true } : {}), label: 'של שני השלבים' }; };
export function prob3TText({ kind, n1, n2, k1, k2 }) {
  if (kind === 'coin-die') return `מטילים מטבע, ואחר כך קובייה. מה ההסתברות לקבל עץ, ואחר כך מספר גדול מ־$${6 - k2}$?`;
  if (kind === 'die-spin') return `מטילים קובייה, ואחר כך מסובבים גלגל של ארבע גזרות שוות: אדום, כחול, ירוק וצהוב. מה ההסתברות לקבל מספר קטן מ־$${k1 + 1}$, ואחר כך ${orList(SPIN4.slice(0, k2))}?`;
  return `בגלגל הראשון $${n1}$ גזרות שוות, ממוספרות $1$ עד $${n1}$, ובשני $${n2}$ גזרות שוות, ממוספרות $1$ עד $${n2}$. מסובבים את שניהם. מה ההסתברות שבראשון ייצא מספר גדול מ־$${n1 - k1}$, ובשני מספר גדול מ־$${n2 - k2}$?`;
}
export const prob3TSolution = ({ n1, n2, k1, k2 }) => [
  `בטבלה $${n1}$ שורות ו־$${n2}$ עמודות: $${n1} \\cdot ${n2} = ${n1 * n2}$ תאים שווי סיכוי.`,
  `מתאימות $${k1}$ שורות ו־$${k2}$ עמודות: $${k1} \\cdot ${k2} = ${k1 * k2}$ תאים.`,
  `$${fracTex(k1 * k2, n1 * n2)}$`,
];
export const prob3THint = () => 'בונים טבלה: שורה לכל תוצאה של השלב הראשון, ועמודה לכל תוצאה של השני. סופרים תאים.';

// ---------------------------------------------------------------- prob:1 generators

/** An event of equally likely outcomes (the model's own draw). */
function eventK() {
  const p = PROB1.params(rnd); const ans = PROB1.answer(p); const fig = prob1Fig(p);
  return {
    key: `pr1:${p.n}:${p.e}:${p.t ?? 0}`, text: prob1Text(p), ...(fig ? { fig } : {}), form: 'num', answer: ans, precise: true,
    hint: prob1Hint(p), solution: prob1Solution(p), diag: diagWith(ans, bugsAt(PROB1, p)),
  };
}
/** The raffle (the transfer model's own draw). */
function raffle() {
  const p = PROB1T.params(rnd); const ans = PROB1T.answer(p);
  return {
    key: `pr1r:${p.N}:${p.a}:${p.b}`, text: prob1TText(p), fig: raffleFig(p), form: 'num', answer: ans, precise: true,
    hint: prob1THint(p), solution: prob1TSolution(p), diag: diagWith(ans, bugsAt(PROB1T, p)),
  };
}
const CITIES = ['ערד', 'ירושלים', 'חיפה', 'תל אביב'];
const SCALE_Q = [
  { q: 'באיזו עיר בטוח שלא ירד גשם?', kind: 0, why: 'הסתברות $0$: לא יכול לקרות.' },
  { q: 'באיזו עיר לא סביר שירד גשם, אבל זה יכול לקרות?', kind: 1, why: 'הסתברות קרובה ל־$0$ אבל גדולה ממנו: לא סביר, אבל אפשרי.' },
  { q: 'באיזו עיר הסיכוי שירד גשם שווה לסיכוי שלא ירד?', kind: 2, why: 'הסתברות $0.5$: סיכוי שווה לקרות ולא לקרות.' },
  { q: 'באיזו עיר כמעט בטוח שירד גשם?', kind: 3, why: 'הסתברות קרובה ל־$1$: כמעט ודאי.' },
];
/** The rain table (the Ministry's): which city fits a word on the scale from 0 to 1 (practice only). */
function scaleMc() {
  const probs = [0, pick(rnd, [0.05, 0.1]), 0.5, pick(rnd, [0.9, 0.95])];
  const order = shuffle([0, 1, 2, 3]); const ask = pick(rnd, SCALE_Q);
  const choices = CITIES.map((c) => ({ text: c }));
  return {
    key: `pr1s:${order.join('')}:${ask.kind}:${probs.map(num).join(',')}`, text: `בטבלה: ההסתברות שירד גשם מחר בכל עיר. ${ask.q}`,
    fig: tableFig(['עיר', 'ההסתברות לגשם'], CITIES.map((c, i) => [c, num(probs[order[i]])])),
    form: 'mc', choices, answer: order.indexOf(ask.kind), practiceOnly: true,
    hint: 'הסתברות $0$ היא "בלתי אפשרי", $1$ היא "ודאי", ו־$0.5$ באמצע.',
    solution: [`ב${CITIES[order.indexOf(ask.kind)]} ההסתברות $${num(probs[ask.kind])}$.`, ask.why],
    diag: () => null,
  };
}
const UNFAIR = [
  { text: 'על הפאה של $6$ בקובייה הדביקו מדבקה כבדה. האם ההסתברות לקבל $6$ היא עדיין $\\frac{1}{6}$?', ok: 'לא בטוח: אין סימטריה, וצריך לנסות הרבה פעמים', bad: 'כן, יש לקובייה 6 פאות', why: 'המדבקה מושכת את ה־$6$ למטה, ולכן הוא יוצא פחות.' },
  { text: 'מטבע נפל ונעקם. האם ההסתברות לקבל עץ היא עדיין חצי?', ok: 'לא בטוח: המטבע כבר לא סימטרי, וצריך לנסות הרבה פעמים', bad: 'כן, יש למטבע שני צדדים', why: 'מטבע עקום יכול ליפול על צד אחד יותר מעל השני.' },
  { text: 'גלגל מחולק לארבע גזרות: אחת גדולה ושלוש קטנות. האם ההסתברות לכל גזרה היא רבע?', ok: 'לא: הגזרה הגדולה תצא יותר', bad: 'כן, יש ארבע גזרות', why: 'הגזרות לא שוות, ולכן התוצאות לא שוות סיכוי.' },
];
/** A die, a coin or a wheel that is not symmetric (two choices, practice only; the "fair" pick is no-symmetry). */
function fairMc() {
  const i = rint(rnd, 0, UNFAIR.length - 1); const u = UNFAIR[i];
  const choices = shuffle([{ text: u.ok, ok: true }, { text: u.bad, ok: false, bug: 'no-symmetry' }]);
  return {
    key: `pr1f:${i}`, text: u.text, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: '$\\frac{1}{n}$ נכון רק כשאין סיבה שתוצאה אחת תצא יותר מאחרת.',
    solution: [u.why, 'בלי סימטריה מעריכים את ההסתברות לפי השכיחות היחסית בהרבה ניסויים.'],
    diag: (x) => choices[x]?.bug || null,
  };
}

// ---------------------------------------------------------------- prob:2 generators

/** Not a colour of the spinner (the model's own draw). */
function notA() {
  const p = PROB2.params(rnd); const ans = PROB2.answer(p);
  return {
    key: `pr2:${p.p.map(num).join(',')}:${p.x}`, text: prob2Text(p), fig: prob2Fig(p), form: 'num', answer: ans, precise: true,
    hint: prob2Hint(p), solution: prob2Solution(p), diag: diagWith(ans, bugsAt(PROB2, p)),
  };
}
const PLACES = ['חיפה', 'באר שבע', 'אילת', 'צפת', 'נתניה'];
/** "30% chance of rain": the dry day in percent, typed with % beside the input (the complement out of 100%). */
function rainPct() {
  const p = pick(rnd, [10, 15, 20, 25, 30, 35, 40, 60, 65, 70, 75, 80, 85, 90]); const at = pick(rnd, PLACES);
  return {
    key: `pr2c:${p}:${PLACES.indexOf(at)}`, text: `בתחזית: $${p}\\%$ סיכוי לגשם מחר ב${at}. מה הסיכוי שלא ירד גשם מחר ב${at}?`,
    form: 'num', answer: 100 - p, unit: '%',
    hint: 'כשההסתברות כתובה באחוזים, הכול הוא $100\\%$.',
    solution: ['"לא ירד גשם" הוא המשלים של "ירד גשם".', `$100\\% - ${p}\\% = ${100 - p}\\%$`],
    diag: diagWith(100 - p, { 'same-prob': p }),
  };
}
/** The pens (the transfer model's own draw). */
function pens() {
  const p = PROB2T.params(rnd); const ans = PROB2T.answer(p);
  return {
    key: `pr2p:${p.N}:${p.a}:${p.b}:${p.m}`, text: prob2TText(p), form: 'num', answer: ans, precise: true,
    hint: prob2THint(p), solution: prob2TSolution(p), diag: diagWith(ans, bugsAt(PROB2T, p)),
  };
}
/**
 * At least t on a die or cards 1..n: the complement of "less than t". The complement left as it is is complement-only;
 * "t to n" counted as n − t numbers is the fencepost (when that is not one half, which equiprob would also give).
 */
export const AT_LEAST = mk({
  raw: (r) => {
    const n = pick(r, [6, 6, 8, 10, 12, 20]); const t = rint(r, 2, n - 1);
    return { n, t };
  },
  answer: ({ n, t }) => (n - t + 1) / n,
  bugs: {
    'complement-only': ({ n, t }) => (t - 1) / n,
    fencepost: ({ n, t }) => (2 * (n - t) === n ? null : (n - t) / n),
  },
}, cleanP);
function atLeast() {
  const p = AT_LEAST.params(rnd); const ans = AT_LEAST.answer(p); const { n, t } = p;
  const dev = n === 6 ? 'die' : 'cards';
  return {
    key: `pr2a:${n}:${t}`, text: `${setting(dev, n)} מה ההסתברות לקבל לפחות $${t}$?`, ...(n === 6 ? { fig: dieRow() } : {}),
    form: 'num', answer: ans, precise: true,
    hint: `"לפחות $${t}$" הוא כל מה שאינו "פחות מ־$${t}$". מה קל יותר לספור?`,
    solution: [
      `המשלים, "פחות מ־$${t}$": ${t - 1 === 1 ? 'רק $1$' : `$1$ עד $${t - 1}$`}, ${t - 1 === 1 ? 'תוצאה אחת' : `$${t - 1}$ תוצאות`}.`,
      `$1 - \\frac{${t - 1}}{${n}} = ${relTex(n - t + 1, n)}$`,
    ],
    diag: diagWith(ans, bugsAt(AT_LEAST, p)),
  };
}
/** After a run of one side of a fair coin (three choices, practice only; both "due" and "hot" are the gambler's belief). */
function gamblerMc() {
  const side = rint(rnd, 0, 1); const k = rint(rnd, 4, 7); const [A, B] = side ? ['פלי', 'עץ'] : ['עץ', 'פלי'];
  const choices = shuffle([
    { text: `הסיכוי ל${B} הוא עדיין חצי`, ok: true },
    { text: `${B} יותר סביר, כי הגיע תורו`, ok: false, bug: 'gambler' },
    { text: `${A} יותר סביר, הוא "חם"`, ok: false, bug: 'gambler' },
  ]);
  return {
    key: `pr2g:${side}:${k}`, text: `מטבע הוגן יצא "${A}" $${k}$ פעמים ברצף. מה נכון על ההטלה הבאה?`,
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'האם המטבע זוכר מה יצא קודם?',
    solution: ['למטבע אין זיכרון: בכל הטלה הסיכוי לעץ ולפלי שווה, מה שלא יצא קודם.', 'רק בהרבה הטלות השכיחות היחסית מתקרבת לחצי, ולא כי משהו "מתקן" אותה.'],
    diag: (x) => choices[x]?.bug || null,
  };
}
/**
 * "p% chance of rain tomorrow": what it says (three choices, practice only; the Ministry's Danny, as the teaching's
 * DANNY step asks it). Reading it as the part of tomorrow it rains, or as a sure forecast, is the outcome approach.
 */
function forecastMc() {
  const p = pick(rnd, [20, 30, 40, 60, 70, 80]); const at = pick(rnd, PLACES);
  const choices = shuffle([
    { text: `בימים כאלה יורד גשם בערך ב־${p}% מהם`, ok: true },
    { text: `${p}% מהיום יירד גשם`, ok: false, bug: 'outcome-approach' },
    { text: p > 50 ? 'מחר בטוח יירד גשם' : 'מחר בטוח לא יירד גשם', ok: false, bug: 'outcome-approach' },
  ]);
  return {
    key: `pr2f:${p}:${PLACES.indexOf(at)}`, text: `בתחזית: $${p}\\%$ סיכוי לגשם מחר ב${at}. מה זה אומר?`,
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'ההסתברות אומרת כמה סביר שיירד גשם. היא לא אומרת כמה זמן, ולא מבטיחה.',
    solution: [`מתוך הרבה ימים עם תחזית כזאת, בערך ב־$${p}\\%$ מהם יורד גשם.`, 'זה לא אומר כמה זמן יירד גשם מחר, וגם לא שבטוח יירד או לא יירד.'],
    diag: (x) => choices[x]?.bug || null,
  };
}

// ---------------------------------------------------------------- prob:3 generators

/** The sum of two dice (the model's own draw), answered as a fraction. */
function diceSum() {
  const p = PROB3.params(rnd); const ans = PROB3.answer(p);
  return {
    key: `pr3:${p.e}:${p.t}`, text: prob3Text(p), fig: prob3Fig(p), form: 'frac', answer: ans,
    hint: prob3Hint(p), solution: prob3Solution(p), diag: fracDiag(ans, bugsAt(PROB3, p)),
  };
}
/** Two stages in a table (the transfer model's own draw), answered as a fraction. */
function twoStage() {
  const p = PROB3T.params(rnd); const ans = PROB3T.answer(p);
  return {
    key: `pr3t:${p.kind}:${p.n1}:${p.n2}:${p.k1}:${p.k2}`, text: prob3TText(p), fig: prob3TFig(p), form: 'frac', answer: ans,
    hint: prob3THint(p), solution: prob3TSolution(p), diag: fracDiag(ans, bugsAt(PROB3T, p)),
  };
}
/** (a, b) and (b, a): one outcome or two? (two choices, practice only; one is unordered) */
function orderMc() {
  const a = rint(rnd, 1, 5); const b = rint(rnd, a + 1, 6);
  const choices = shuffle([{ text: 'שתי תוצאות: שני תאים בטבלה', ok: true }, { text: 'תוצאה אחת', ok: false, bug: 'unordered' }]);
  return {
    key: `pr3o:${a}:${b}`, text: `מטילים שתי קוביות. $(${a}, ${b})$ ו־$(${b}, ${a})$: תוצאה אחת או שתיים?`, fig: diceTable(),
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'דמיינו קובייה אדומה וקובייה כחולה.',
    solution: [`$${a}$ באדומה ו־$${b}$ בכחולה, או $${b}$ באדומה ו־$${a}$ בכחולה: שני תאים שונים בטבלה.`, `לכן לסכום $${a + b}$ התוצאות האלה נספרות פעמיים.`],
    diag: (x) => choices[x]?.bug || null,
  };
}
/** A double against a mixed pair, in order: each is one cell of 36 (three choices, practice only). */
function sameCellMc() {
  const d = rint(rnd, 1, 6); let a; let b; do { a = rint(rnd, 1, 6); b = rint(rnd, 1, 6); } while (a === b || a === d || b === d);
  const choices = shuffle([
    { text: 'שווה: כל אחת היא תא אחד מתוך 36', ok: true },
    { text: `${a} ואחר כך ${b}`, ok: false, bug: 'representativeness' },
    { text: `${d} ואחר כך ${d}`, ok: false },
  ]);
  return {
    key: `pr3s:${d}:${a}:${b}`, text: `מטילים קובייה פעמיים. מה יותר סביר: $${d}$ ואחר כך $${d}$, או $${a}$ ואחר כך $${b}$?`, fig: diceTable(),
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'כמה תאים בטבלה מתאימים לכל אחת מהשתיים?',
    solution: [`$(${d}, ${d})$ הוא תא אחד, וגם $(${a}, ${b})$ הוא תא אחד.`, 'כל התאים שווי סיכוי: $\\frac{1}{36}$ לכל אחת. תוצאה "מעורבבת" לא סבירה יותר מ"מסודרת".'],
    diag: (x) => choices[x]?.bug || null,
  };
}
/**
 * Two dice thrown many times (the simulate object's estimate mode): about what part of the throws gave sum 7? The two
 * documented errors are the wrong choices: 1/11 (the sums taken as equally likely) and 1/12 (3 pairs without order of
 * 36). Practice only; a wrong pick under 100 throws is the small sample.
 */
function simDice() {
  const choices = shuffle([{ tex: '\\frac{1}{6}' }, { tex: '\\frac{1}{11}', tag: 'equiprob-sums' }, { tex: '\\frac{1}{12}', tag: 'unordered' }]);
  const item = {
    key: `pr3d:${choices.map((c) => c.tex.replace(/\D+/g, '')).join(',')}`, text: 'הטילו שתי קוביות כמה פעמים. בערך באיזה חלק מהפעמים יצא סכום $7$?',
    form: 'manip', practiceOnly: true,
    manip: { kind: 'simulate', device: 'dice2', watch: 7 },
    answer: { mode: 'estimate', choices, answer: choices.findIndex((c) => !c.tag) },
    hint: 'הטילו הרבה פעמים: אחרי $100$ ויותר, השכיחות היחסית של סכום $7$ קרובה להסתברות שלו.',
    solution: ['לסכום $7$ יש שישה תאים בטבלה: $(1, 6), (2, 5), (3, 4), (4, 3), (5, 2), (6, 1)$.', '$\\frac{6}{36} = \\frac{1}{6}$, ובהרבה הטלות השכיחות היחסית קרובה לזה.'],
  };
  return { ...item, diag: (u) => simDiag(item, u) };
}

// ---------------------------------------------------------------- the topic

export const PROB = {
  id: 'prob', grade: '8', title: 'הסתברות', color: 'fuchsia',
  desc: 'תוצאות שוות סיכוי, מאורע משלים, וניסוי בשני שלבים בטבלה',
  // taught in March ("הסתברות ב" of unit 8.16): the first-day placement test does not ask about it
  placement: false,
  levels: [
    { title: 'תוצאות שוות סיכוי', gen: () => { const r = Math.random(); return r < 0.45 ? eventK() : r < 0.7 ? raffle() : r < 0.85 ? scaleMc() : fairMc(); } },
    { title: 'מאורע משלים', gen: () => { const r = Math.random(); return r < 0.35 ? notA() : r < 0.4 ? rainPct() : r < 0.65 ? pens() : r < 0.85 ? atLeast() : r < 0.95 ? gamblerMc() : forecastMc(); } },
    { title: 'ניסוי בשני שלבים', gen: () => { const r = Math.random(); return r < 0.45 ? diceSum() : r < 0.75 ? twoStage() : r < 0.8 ? orderMc() : r < 0.85 ? sameCellMc() : simDice(); } },
  ],
  cats: {
    'count-not-prob': 'כתבו את מספר התוצאות המתאימות במקום ההסתברות',
    'one-over-n': 'כתבו את ההסתברות של תוצאה אחת במקום של כל התוצאות המתאימות',
    'equiprob-event': 'חשבו שמה שקורה או לא קורה הוא חצי',
    fencepost: 'ספרו את המספרים מ־$a$ עד $b$ כאילו יש $b - a$ ולא $b - a + 1$',
    'no-symmetry': 'הניחו סיכוי שווה גם כשהקובייה או המטבע לא סימטריים',
    'same-prob': 'נתנו למשלים אותה הסתברות',
    'hundred-minus': 'השלימו ל־$100$ הסתברות שכתובה כמספר בין $0$ ל־$1$',
    'others-given': 'חיברו רק את ההסתברויות שכתובות, ושכחו תוצאה שלא כתובה',
    'one-part': 'הורידו רק חלק מהתוצאות שאינן מתאימות',
    gambler: 'חשבו שאחרי הרבה פעמים אותה תוצאה, הסיכוי לשנייה גדל',
    'outcome-approach': 'קראו הסתברות כתחזית בטוחה או כחלק מהזמן',
    'equiprob-sums': 'חשבו שכל הסכומים של שתי קוביות שווי סיכוי',
    unordered: 'ספרו את $(5, 6)$ ואת $(6, 5)$ כתוצאה אחת',
    'space-21': 'מנו $21$ זוגות בלי סדר כאילו הם שווי סיכוי',
    'add-probs': 'חיברו את ההסתברויות של שני השלבים',
    'one-stage': 'חישבו את ההסתברות של שלב אחד בלבד',
    'complement-only': 'חישבו את ההסתברות של המשלים, ולא החסירו אותה מ־$1$',
    representativeness: 'חשבו שתוצאה שנראית "מסודרת" פחות סבירה מתוצאה שנראית מעורבבת',
    'small-sample': 'סמכו על מעט ניסויים כאילו הם נותנים את ההסתברות',
  },
  lesson: {
    points: [
      'קובייה הוגנת: לכל פאה $\\frac{1}{6}$. מספר זוגי: $\\frac{3}{6} = \\frac{1}{2}$.',
      'ההסתברות שמשהו לא יקרה היא $1$ פחות ההסתברות שיקרה: אם לגשם $0.35$, אז ליום יבש $1 - 0.35 = 0.65$.',
      'שתי קוביות: $36$ תאים שווי סיכוי. סכום $7$: $\\frac{6}{36} = \\frac{1}{6}$.',
    ],
    words: ['ניסוי', 'תוצאה', 'מאורע', 'תוצאות שוות סיכוי', 'סימטריה', 'הוגן', 'מאורע משלים', 'ניסוי בשני שלבים', 'טבלת תוצאות'],
  },
};
