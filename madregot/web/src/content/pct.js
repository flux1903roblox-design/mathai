// Percent (אחוזים, הגדלה והקטנה באחוזים): the second unit of grade 8 (ח׳) in the Ministry's תשפ״ז schedule, October
// (curriculum stage 1, CURRICULUM-4). It is the base under sys:1 (equations with a percent change), relative frequency and
// probability. Taught from October, so the first-day placement test skips it (placement: false): a ח׳ student who
// learned it in class uses the unit's jump test, and the plan offers pct:1 among the first new stairs of a ח׳ student.
// ז׳ meets "שכיחות יחסית עם אחוזים" in February, so Exam Rescue offers the unit to ז׳ as well (alsoFor).
//
// One picture carries it: a percent is hundredths of a whole, drawn as the percent bar (0% to 100% above, 0 to the whole
// below, the double number line). The three static questions are "p% of N" (multiply by p/100, or build from 10%, 5%,
// 1%), "what percent is A of B" (part over whole, times 100) and "p% is A, the whole?" (through 1% or a benchmark, then
// check); the dynamic one is a change, which is a multiplication by 1 ± p/100, always of the amount before the change,
// so two changes multiply and +10% then −10% is not the price again.
//
// The diagnostic models (PCT1 to PCT5T) are the plan's (finish/scratch/curriculum/plan/models.mjs), ported unchanged: a
// draw is redrawn when a misconception's prediction looks like a slip of the hand, lies within 0.06 of the right answer
// or of another prediction. The practice generators below use the same draws. The numbers and situations of the
// Ministry's examples (48% of 200 voters, the two classes, the download at 35%, the cinema ticket, Guy and Meital's
// stationery) are facts; every sentence here is the app's own. Errors and their sources:
//   count-as-pct      the number of parts, or the percent itself, written as the amount (Parker & Leinhardt 1995,
//                     "Percent: a privileged proportion", Review of Educational Research 65(4))
//   digit-pct         the digits after the point read as the percent, 0.4 as 4% (the decimal whole-number rule, Resnick
//                     et al. 1989, carried into percent; teacher-reported)
//   div-by-pct        the amount divided by the percent number (teacher-reported)
//   inverse-ratio     the whole divided by the part (Fischbein et al. 1985: the larger divided by the smaller)
//   pct-of-part       the percent taken of the part given, when the whole is asked (Baratta et al. 2010, MERGA 33:
//                     finding the whole is the hardest of the three)
//   stop-at-one       1% found, and the answer stopped there (Baratta et al. 2010)
//   add-pct           the percent number added or taken away as shekels (Parker & Leinhardt 1995)
//   change-only       the size of the change given as the new price (teacher-reported)
//   additive-changes  a rise and a fall by the same percent taken to cancel (Parker & Leinhardt 1995; Gould et al. 2021)
//   pct-of-new        the change taken as a percent of the new price (sys.js's id and words)
import { shuffle, gcd } from './util.js';
import { diagOf } from './eq.js';
import { mk, r9, fracTex } from './frac.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
/** Every prediction of a model for one draw. */
const bugsAt = (model, p) => Object.fromEntries(Object.entries(model.bugs).map(([id, f]) => [id, f(p)]));
/** A number as written: decimals as they are (2.5), never 2.4999999. */
export const num = (v) => String(r9(v));
/** A percent in TeX: 35\%. */
export const pc = (v) => `${num(v)}\\%`;
/** The digits of a decimal read as a whole number (0.4 is 4, 1.5 is 15): the digit-pct reading. */
export const digitsOf = (x) => Number(String(x).replace('.', ''));

// ---------------------------------------------------------------- the models' draws (plan/models.mjs, unchanged)

/** pct:1 — a fraction a/b (k 0) or a decimal x (k 1) as a percent. */
export const PCT1 = mk({
  raw: (r) => {
    if (r() < 0.6) { const b = pick(r, [2, 4, 5, 10, 20, 25, 50]); const a = rint(r, 1, b - 1); if (gcd(a, b) !== 1) return null; return { k: 0, a, b }; }
    const x = r() < 0.75 ? rint(r, 1, 9) / 10 : pick(r, [1.2, 1.5, 2.5]);
    return { k: 1, x };
  },
  answer: (p) => (p.k === 0 ? (100 * p.a) / p.b : Math.round(100 * p.x)),
  bugs: {
    'count-as-pct': (p) => (p.k === 0 ? p.a : null), // a parts taken as a percent
    'digit-pct': (p) => (p.k === 1 ? digitsOf(p.x) : null), // 0.4 read as 4%
  },
});
/** pct:1 transfer — a test: a right out of b questions. */
export const PCT1T = mk({
  raw: (r) => { const b = pick(r, [4, 5, 10, 20, 25, 50]); const a = rint(r, 1, b - 1); return { a, b }; },
  answer: ({ a, b }) => (100 * a) / b,
  bugs: { 'count-as-pct': ({ a }) => a },
});

/** pct:2 — p% of N. */
export const PCT2 = mk({
  raw: (r) => { const p = pick(r, [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 150]); const step = 100 / gcd(p, 100); const N = step * rint(r, Math.ceil(20 / step), Math.floor(800 / step)); if (N === 100) return null; return { p, N }; },
  answer: ({ p, N }) => (p * N) / 100,
  bugs: {
    'count-as-pct': ({ p }) => p, // the percent itself as the amount
    'div-by-pct': ({ p, N }) => N / p, // N divided by the percent
  },
});
/** pct:2 transfer — the shekels saved on a discount. */
export const PCT2T = mk({ raw: (r) => { const q = PCT2.raw(r); return q && q.p <= 75 ? q : null; }, answer: PCT2.answer, bugs: PCT2.bugs });

/** pct:3 — what percent A is of B (sometimes more than 100%). */
export const PCT3 = mk({
  raw: (r) => {
    const B = pick(r, [20, 25, 40, 50, 60, 80, 120, 200, 250, 300, 400, 500]); const step = B / gcd(B, 100);
    const A = step * rint(r, 1, Math.floor((1.6 * B) / step)); if (A === B) return null; return { A, B };
  },
  answer: ({ A, B }) => (100 * A) / B,
  bugs: {
    'inverse-ratio': ({ A, B }) => (100 * B) / A, // the whole divided by the part
    'count-as-pct': ({ A }) => A,
  },
});
export const PCT3T = mk({ raw: (r) => { const q = PCT3.raw(r); return q && q.A < q.B ? q : null; }, answer: PCT3.answer, bugs: PCT3.bugs });

/** pct:4 — p% of the whole is A: the whole. */
export const PCT4 = mk({
  raw: (r) => { const p = pick(r, [5, 10, 20, 25, 30, 35, 40, 50, 60, 75]); const step = 100 / gcd(p, 100); const W = step * rint(r, Math.ceil(40 / step), Math.floor(2000 / step)); const A = (p * W) / 100; if (A < 2) return null; return { p, W, A }; },
  answer: ({ W }) => W,
  bugs: {
    'pct-of-part': ({ p, A }) => (A * p) / 100, // the percent taken of the part given
    'stop-at-one': ({ p, A }) => A / p, // 1% found, and the answer stopped there
  },
});
export const PCT4T = mk({ raw: (r) => { const q = PCT4.raw(r); return q && q.p >= 20 ? q : null; }, answer: PCT4.answer, bugs: PCT4.bugs });

/** pct:5 — a price after one change (k 0), or after a rise and a fall by the same percent (k 1). */
export const PCT5 = mk({
  raw: (r) => {
    if (r() < 0.55) {
      const p = pick(r, [5, 10, 15, 20, 25, 30, 40, 50]); const up = r() < 0.5; const step = 100 / gcd(p, 100);
      const N = step * rint(r, Math.ceil(40 / step), Math.floor(600 / step)); return { k: 0, p, up, N };
    }
    const p = pick(r, [10, 20, 25, 30, 40, 50]); const N = pick(r, [100, 200, 300, 400, 500, 800, 1000, 1200, 2000]);
    if (((N * p * p) % 10000) !== 0) return null; return { k: 1, p, N };
  },
  answer: (q) => (q.k === 0 ? (q.N * (100 + (q.up ? q.p : -q.p))) / 100 : (q.N * (100 + q.p) * (100 - q.p)) / 10000),
  bugs: {
    'add-pct': (q) => (q.k === 0 ? q.N + (q.up ? q.p : -q.p) : null), // p shekels added, not p percent
    'change-only': (q) => (q.k === 0 ? (q.p * q.N) / 100 : null), // the change given as the new price
    'additive-changes': (q) => (q.k === 1 ? q.N : null), // +p% then −p% taken as no change
  },
});
/** pct:5 transfer — by what percent the price changed (old N, new M). */
export const PCT5T = mk({
  raw: (r) => { const p = pick(r, [5, 10, 20, 25, 30, 40, 50]); const up = r() < 0.6; const step = 100 / gcd(p, 100); const N = step * rint(r, Math.ceil(20 / step), Math.floor(400 / step)); if (!up && p === 50 && N < 4) return null; return { p, up, N, M: (N * (100 + (up ? p : -p))) / 100 }; },
  answer: ({ p }) => p,
  bugs: { 'pct-of-new': ({ N, M }) => (100 * Math.abs(M - N)) / M }, // the change taken as a percent of the new price
});

// ---------------------------------------------------------------- shared words (the models' texts and solutions)

/** pct:1: a fraction or a decimal as a percent. */
export const pct1Text = (p) => (p.k === 0 ? `כתבו כאחוז: $${fracTex(p.a, p.b)}$` : `כתבו כאחוז: $${num(p.x)}$`);
export function pct1Solution(p) {
  const ans = PCT1.answer(p);
  if (p.k === 0) {
    const m = 100 / p.b;
    return [`מרחיבים למכנה $100$: כופלים את המונה ואת המכנה ב־$${m}$.`, `$${fracTex(p.a, p.b)} = ${fracTex(p.a * m, 100)} = ${ans}\\%$`];
  }
  return [`אחוז הוא מאית: כופלים ב־$100$.`, `$${num(p.x)} = ${fracTex(ans, 100)} = ${ans}\\%$`];
}
export const pct1Hint = (p) => (p.k === 0 ? 'אחוז הוא "מתוך $100$": הרחיבו את השבר למכנה $100$.' : 'כמה מאיות יש במספר? $0.1$ הוא $10$ מאיות.');
/** pct:1 transfer: a test. */
export const testText = ({ a, b }) => `במבחן $${b}$ שאלות, ונועה ענתה נכון על $${a}$ מהן. איזה אחוז מהשאלות ענתה נכון?`;
export const testSolution = ({ a, b }) => [`כל שאלה היא $100 : ${b} = ${num(100 / b)}$ אחוזים.`, `$${a} \\cdot ${num(100 / b)} = ${num((100 * a) / b)}$, כלומר $${pc((100 * a) / b)}$ מהשאלות.`];
export const testHint = () => 'כמה אחוזים שווה כל שאלה? כל השאלות יחד הן $100\\%$.';

/** pct:2: p% of N. */
export const pct2Text = ({ p, N }) => `כמה הם $${pc(p)}$ מ־$${N}$?`;
export function pct2Solution({ p, N }) {
  const ans = (p * N) / 100;
  return [`$${pc(p)} = ${num(p / 100)}$: כופלים את הכמות ב־$${num(p / 100)}$.`, `$${num(p / 100)} \\cdot ${N} = ${num(ans)}$`];
}
export const pct2Hint = ({ p }) => (p % 10 === 0 && p <= 100 ? `מצאו קודם כמה הם $10\\%$, ואז קחו $${p / 10}$ כאלה.` : `$${pc(p)}$ מ־ זה כפל ב־$${num(p / 100)}$. אפשר גם לבנות מ־$10\\%$ ומ־$5\\%$.`);

const ITEMS = ['המעיל', 'המשחק', 'התיק', 'השעון', 'הטלפון'];
/** One of the things a story is about, chosen by its numbers (so a model's text is the same for the same draw). */
export const itemOf = (...vals) => ITEMS[Math.abs(vals.reduce((a, v) => a + Math.round(v), 0)) % ITEMS.length];
/** pct:2 transfer: the shekels saved on a discount. */
export const saveText = ({ p, N }, item = itemOf(p, N)) => `${item} עולה $${N}$ ש״ח, ויש עליו הנחה של $${pc(p)}$. כמה שקלים חוסכים?`;
export const saveSolution = ({ p, N }) => [`ההנחה היא $${pc(p)}$ מהמחיר: $${num(p / 100)} \\cdot ${N}$.`, `$${num(p / 100)} \\cdot ${N} = ${num((p * N) / 100)}$ ש״ח`];
export const saveHint = () => 'ההנחה היא אחוז מהמחיר. כמה הם האחוזים האלה מהמחיר?';

/** pct:3: what percent A is of B. */
export const pct3Text = ({ A, B }) => `איזה אחוז הם $${A}$ מתוך $${B}$?`;
export function pct3Solution({ A, B }) {
  const ans = (100 * A) / B;
  return [`החלק חלקי השלם: $${fracTex(A, B)}$.`, `$${fracTex(A, B)} \\cdot 100 = ${num(ans)}$, כלומר $${pc(ans)}$`];
}
export const pct3Hint = () => 'השלם הוא מה שאחרי "מתוך". החלק חלקי השלם, כפול $100$.';
/** pct:3 transfer: a class that comes by bicycle. */
export const bikeText = ({ A, B }) => `בכיתה $${B}$ תלמידים, ו־$${A}$ מהם מגיעים באופניים. איזה אחוז מהתלמידים מגיעים באופניים?`;
export const bikeHint = () => 'השלם הוא כל התלמידים. כמה מתוכם מגיעים באופניים, חלקי כולם, כפול $100$.';

/** pct:4: p% of an amount is A; the whole amount. */
export const pct4Text = ({ p, A }) => `$${pc(p)}$ מכמות הם $${A}$. מה הכמות כולה?`;
export function pct4Solution({ p, A, W }) {
  return [`$1\\%$ הוא $${A} : ${p} = ${num(A / p)}$.`, `$100\\%$ הם $${num(A / p)} \\cdot 100 = ${num(W)}$`, `בדיקה: $${pc(p)}$ מ־$${num(W)}$ הם $${A}$.`];
}
export const pct4Hint = ({ p, A }) => `$${A}$ הם רק $${pc(p)}$ מהכמות. מצאו קודם כמה הוא $1\\%$, ואז כמה הם $100\\%$.`;
/** pct:4 transfer: a download. */
export const downloadText = ({ p, A }) => `ההורדה של קובץ הגיעה ל־$${pc(p)}$, וירדו כבר $${A}$ מגה־בייט. מה גודל הקובץ כולו, במגה־בייט?`;
export const downloadHint = ({ p, A }) => `$${A}$ מגה־בייט הם $${pc(p)}$ מהקובץ. כמה הוא $1\\%$? וכמה $100\\%$?`;

/** pct:5: one change, or a rise and a fall by the same percent. */
export const pct5Text = (q, item = itemOf(q.p, q.N)) => (q.k === 0
  ? `${item} עלה $${q.N}$ ש״ח ו${q.up ? 'התייקר' : 'הוזל'} ב־$${pc(q.p)}$. כמה הוא עולה עכשיו?`
  : `${item} עלה $${q.N}$ ש״ח, התייקר ב־$${pc(q.p)}$ ואחר כך הוזל ב־$${pc(q.p)}$. כמה הוא עולה עכשיו?`);
export function pct5Solution(q) {
  if (q.k === 0) {
    const m = (100 + (q.up ? q.p : -q.p)) / 100; const ans = (q.N * (100 + (q.up ? q.p : -q.p))) / 100;
    return [`${q.up ? `אחרי התייקרות של $${pc(q.p)}$ המחיר הוא $${pc(100 + q.p)}$ מהקודם` : `אחרי הוזלה של $${pc(q.p)}$ נשארים $${pc(100 - q.p)}$ מהמחיר`}: כופלים ב־$${num(m)}$.`, `$${q.N} \\cdot ${num(m)} = ${num(ans)}$`];
  }
  const up = (q.N * (100 + q.p)) / 100; const ans = (q.N * (100 + q.p) * (100 - q.p)) / 10000;
  return [`אחרי ההתייקרות: $${q.N} \\cdot ${num(1 + q.p / 100)} = ${num(up)}$.`, `ההוזלה נלקחת מ־$${num(up)}$: $${num(up)} \\cdot ${num(1 - q.p / 100)} = ${num(ans)}$`, `פחות מ־$${q.N}$: השינוי השני נלקח משלם גדול יותר.`];
}
export const pct5Hint = (q) => (q.k === 0
  ? (q.up ? `התייקרות של $${pc(q.p)}$: המחיר החדש הוא $${pc(100 + q.p)}$ מהקודם.` : `הוזלה של $${pc(q.p)}$: נשארים $${pc(100 - q.p)}$ מהמחיר.`)
  : 'חשבו שלב אחרי שלב: קודם המחיר אחרי ההתייקרות, ואז ההוזלה ממנו.');
/** pct:5 transfer: by what percent a price changed. */
export const byWhatText = ({ up, N, M, p }, item = itemOf(p, N)) => `${item} עלה $${N}$ ש״ח, ועכשיו הוא עולה $${num(M)}$ ש״ח. בכמה אחוזים ${up ? 'התייקר' : 'הוזל'}?`;
export const byWhatSolution = ({ up, N, M, p }) => [`השינוי: $${num(Math.abs(M - N))}$ ש״ח.`, `מתוך המחיר שלפני השינוי: $${fracTex(num(Math.abs(M - N)), N)} \\cdot 100 = ${p}$, כלומר ${up ? 'התייקר' : 'הוזל'} ב־$${pc(p)}$`];
export const byWhatHint = () => 'האחוז תמיד מהמחיר שלפני השינוי: השינוי חלקי המחיר הקודם, כפול $100$.';

// ---------------------------------------------------------------- pct:1 generators

/** A fraction or a decimal as a percent (the model's own draw). */
function toPct() {
  const p = PCT1.params(rnd); const ans = PCT1.answer(p);
  return {
    key: p.k === 0 ? `pc1f:${p.a}:${p.b}` : `pc1d:${num(p.x)}`, text: pct1Text(p), form: 'num', answer: ans, unit: '%',
    hint: pct1Hint(p), solution: pct1Solution(p), diag: diagOf(ans, bugsAt(PCT1, p)),
  };
}

/** Shade p% of a bar cut into den equal parts (the parts are locked): the target is named, so practice only. */
function shade() {
  const den = pick(rnd, [4, 5, 10, 20]); const k = rint(rnd, 1, den - 1); const p = (100 * k) / den;
  return {
    key: `pc1s:${den}:${p}`, text: `הפס מחולק ל־$${den}$ חלקים שווים. צבעו $${pc(p)}$ ממנו.`,
    form: 'manip', practiceOnly: true,
    manip: { kind: 'fbar', start: { den, shaded: 0 }, lockDen: true }, answer: { mode: 'value', value: p / 100 },
    hint: `כל חלק הוא $${pc(100 / den)}$ מהפס. כמה חלקים כאלה הם $${pc(p)}$?`,
    solution: [`כל חלק: $100 : ${den} = ${num(100 / den)}$ אחוזים.`, `$${num(p)} : ${num(100 / den)} = ${k}$ חלקים צבועים.`],
    diag: () => null,
  };
}

/**
 * A vote of p% (45-49 or 51-55) of N: about how many voted for? The right choice says "a little less (more) than half";
 * "p people" reads the percent as a count. For p > 50 the wrong choices are "a little less than half" and "p people"
 * ("most of them" would be right too, as 51% is a majority). Three choices, so practice only.
 */
export function estimate() {
  const below = Math.random() < 0.5; const p = below ? rint(rnd, 45, 49) : rint(rnd, 51, 55); const N = pick(rnd, [200, 300, 400]);
  const options = shuffle(below
    ? [{ text: 'קצת פחות מחצי', ok: true }, { text: 'רוב המשתתפים', ok: false }, { text: `${p} אנשים`, ok: false, bug: 'count-as-pct' }]
    : [{ text: 'קצת יותר מחצי', ok: true }, { text: 'קצת פחות מחצי', ok: false }, { text: `${p} אנשים`, ok: false, bug: 'count-as-pct' }]);
  return {
    key: `pc1e:${N}:${p}`, text: `בכנס $${N}$ משתתפים, ו־$${pc(p)}$ מהם הצביעו בעד ההחלטה. כמה הצביעו בעד?`,
    form: 'mc', choices: options, answer: options.findIndex((c) => c.ok), practiceOnly: true,
    hint: '$50\\%$ הם חצי. האחוז קרוב ל־$50$: מעט מתחת או מעט מעל?',
    solution: [`$${pc(p)}$ מ־$${N}$ הם $${num((p * N) / 100)}$ אנשים, ${below ? 'קצת פחות' : 'קצת יותר'} מחצי ($${N / 2}$).`, `$${p}$ הוא האחוז, לא מספר האנשים.`],
    diag: (u) => options[u]?.bug || null,
  };
}

/** A decimal above 1 as a percent: 150%, not 15% (the digits) and not 1.5%. Three choices, so practice only. */
function over100() {
  const x = pick(rnd, [1.2, 1.4, 1.5, 1.6, 1.8, 2.5, 3.5]); const right = Math.round(100 * x);
  const options = shuffle([{ tex: pc(right), ok: true }, { tex: pc(digitsOf(x)), ok: false, bug: 'digit-pct' }, { tex: pc(x), ok: false }]);
  return {
    key: `pc1o:${num(x)}`, text: `המספר $${num(x)}$ הוא כמה אחוזים?`,
    form: 'mc', choices: options, answer: options.findIndex((c) => c.ok), practiceOnly: true,
    hint: '$1$ הוא כל השלם, כלומר $100\\%$. ומה גדול מ־$1$?',
    solution: [`$1 = 100\\%$, ולכן $${num(x)} = ${num(x)} \\cdot 100\\%$.`, `$${num(x)} = ${pc(right)}$: יותר מהשלם.`],
    diag: (u) => options[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- pct:2 generators

/** p% of N (the model's own draw). */
function ofAny() {
  const p = PCT2.params(rnd); const ans = PCT2.answer(p);
  return {
    key: `pc2:${p.p}:${p.N}`, text: pct2Text(p), form: 'num', answer: ans,
    hint: pct2Hint(p), solution: pct2Solution(p), diag: diagOf(ans, bugsAt(PCT2, p)),
  };
}

/** The benchmarks in the head: 50%, 25%, 10%, 5% and 1% of an amount whose answer is whole. */
const MENTAL = mk({
  raw: (r) => { const p = pick(r, [50, 25, 10, 5, 1]); const step = 100 / gcd(p, 100); const N = step * rint(r, Math.ceil(20 / step), Math.floor(900 / step)); if (N === 100) return null; return { p, N }; },
  answer: ({ p, N }) => (p * N) / 100,
  bugs: PCT2.bugs,
});
const BENCH = { 50: 'חצי: מחלקים ב־$2$', 25: 'רבע: מחלקים ב־$4$', 10: 'עשירית: מחלקים ב־$10$', 5: 'חצי מ־$10\\%$', 1: 'מאית: מחלקים ב־$100$' };
function mental() {
  const p = MENTAL.params(rnd); const ans = MENTAL.answer(p);
  return {
    key: `pc2m:${p.p}:${p.N}`, text: `חשבו בראש: כמה הם $${pc(p.p)}$ מ־$${p.N}$?`, form: 'num', answer: ans,
    hint: `$${pc(p.p)}$ הם ${BENCH[p.p]}.`,
    solution: p.p === 5
      ? [`$10\\%$ מ־$${p.N}$ הם $${num(p.N / 10)}$.`, `$5\\%$ הם חצי מזה: $${num(p.N / 10)} : 2 = ${num(ans)}$`]
      : [`$${pc(p.p)}$ הם ${BENCH[p.p]}.`, `$${p.N} : ${100 / p.p} = ${num(ans)}$`],
    diag: diagOf(ans, bugsAt(MENTAL, p)),
  };
}

/**
 * Two classes, each with its share that plays music (the Ministry's ח1 and ח2): in which do more pupils play? The counts
 * are whole, and equal in about a third of the draws (a bigger percent is not a bigger count). Three choices, so
 * practice only.
 */
function classes() {
  const equal = Math.random() < 1 / 3;
  for (;;) {
    const p1 = pick(rnd, [10, 20, 25, 30, 40, 50, 60, 75]); const p2 = pick(rnd, [10, 20, 25, 30, 40, 50, 60, 75]);
    const n1 = rint(rnd, 20, 40); const n2 = rint(rnd, 20, 40);
    if (p1 === p2 || n1 === n2 || (p1 * n1) % 100 || (p2 * n2) % 100) continue;
    const c1 = (p1 * n1) / 100; const c2 = (p2 * n2) / 100;
    if ((c1 === c2) !== equal) continue;
    const answer = c1 > c2 ? 0 : c2 > c1 ? 1 : 2;
    return {
      key: `pc2c:${n1}:${p1}:${n2}:${p2}`,
      text: `בכיתה ח׳1 יש $${n1}$ תלמידים, ו־$${pc(p1)}$ מהם מנגנים. בכיתה ח׳2 יש $${n2}$ תלמידים, ו־$${pc(p2)}$ מהם מנגנים. באיזו כיתה מנגנים יותר תלמידים?`,
      form: 'mc', choices: [{ text: 'בח׳1' }, { text: 'בח׳2' }, { text: 'באותו מספר' }], answer, practiceOnly: true,
      hint: 'חשבו בכל כיתה כמה תלמידים מנגנים, ואז השוו את המספרים.',
      solution: [`בח׳1: $${pc(p1)}$ מ־$${n1}$ הם $${c1}$ תלמידים.`, `בח׳2: $${pc(p2)}$ מ־$${n2}$ הם $${c2}$ תלמידים.`, answer === 2 ? 'באותו מספר: אחוז גדול יותר לא אומר כמות גדולה יותר.' : `ב${answer === 0 ? 'ח׳1' : 'ח׳2'} מנגנים יותר.`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- pct:3 generators

/** What percent A is of B (the model's own draw). */
function whatPct() {
  const p = PCT3.params(rnd); const ans = PCT3.answer(p);
  return {
    key: `pc3:${p.A}:${p.B}`, text: pct3Text(p), form: 'num', answer: ans, unit: '%',
    hint: pct3Hint(), solution: pct3Solution(p), diag: diagOf(ans, bugsAt(PCT3, p)),
  };
}

const PLACES = ['ספרייה', 'בית אבות', 'גן ילדים', 'שמירת טבע'];
/**
 * The volunteers of a village by place (the Ministry's table): T volunteers in four places, each a whole percent of T.
 * What percent volunteer in one place? Its count over all of them.
 */
const VOLUNTEERS = mk({
  raw: (r) => {
    const T = pick(r, [120, 160, 200, 240, 300, 400]); const step = T / gcd(T, 100);
    const units = T / step; if (units < 8) return null;
    // four places, each a whole number of steps: three different cuts of the units, in order
    const cuts = [rint(r, 1, units - 1), rint(r, 1, units - 1), rint(r, 1, units - 1)].sort((a, b) => a - b);
    if (cuts[0] === cuts[1] || cuts[1] === cuts[2]) return null;
    const counts = [cuts[0], cuts[1] - cuts[0], cuts[2] - cuts[1], units - cuts[2]].map((u) => u * step);
    const i = rint(r, 0, 3); return { T, counts, i, c: counts[i] };
  },
  answer: ({ T, c }) => (100 * c) / T,
  bugs: { 'inverse-ratio': ({ T, c }) => (100 * T) / c, 'count-as-pct': ({ c }) => c },
});
function table() {
  const p = VOLUNTEERS.params(rnd); const ans = VOLUNTEERS.answer(p);
  return {
    key: `pc3t:${p.c}:${p.T}:${p.counts.join(',')}`, text: `ביישוב $${p.T}$ מתנדבים. איזה אחוז מכל המתנדבים מתנדבים ב${PLACES[p.i]}?`,
    fig: { type: 'table', head: ['מקום', 'מתנדבים'], rows: PLACES.map((n, i) => [n, p.counts[i]]) },
    form: 'num', answer: ans, unit: '%',
    hint: 'השלם הוא כל המתנדבים. מצאו בטבלה כמה מתנדבים שם, וחלקו בכולם.',
    solution: [`ב${PLACES[p.i]} $${p.c}$ מתוך $${p.T}$: $${fracTex(p.c, p.T)}$.`, `$${fracTex(p.c, p.T)} \\cdot 100 = ${num(ans)}$, כלומר $${pc(ans)}$`],
    diag: diagOf(ans, bugsAt(VOLUNTEERS, p)),
  };
}

const CLUBS = [['חברים במועדון', 'חברים'], ['ספרים בספרייה', 'ספרים'], ['עצים בחורשה', 'עצים']];
/** This year A, last year B (A > B): this year as a percent of last year, more than 100% (the model's draw, A > B). */
function grow() {
  let p; do { p = PCT3.params(rnd); } while (p.A <= p.B);
  const ans = PCT3.answer(p); const [what, unit] = CLUBS[(p.A + p.B) % CLUBS.length];
  return {
    key: `pc3g:${p.A}:${p.B}`, text: `השנה יש $${p.A}$ ${what}, ובשנה שעברה היו $${p.B}$. מספר ה${unit} השנה הוא כמה אחוזים ממספרם בשנה שעברה?`,
    form: 'num', answer: ans, unit: '%',
    hint: 'משווים לשנה שעברה, ולכן היא השלם, $100\\%$.',
    solution: [`השלם הוא השנה שעברה: $${fracTex(p.A, p.B)}$.`, `$${fracTex(p.A, p.B)} \\cdot 100 = ${num(ans)}$, כלומר $${pc(ans)}$: יותר מ־$100\\%$, כי השנה יש יותר.`],
    diag: diagOf(ans, bugsAt(PCT3, p)),
  };
}

// ---------------------------------------------------------------- pct:4 generators

/** p% of an amount is A: the whole (the model's own draw). */
function whole() {
  const p = PCT4.params(rnd); const ans = PCT4.answer(p);
  return {
    key: `pc4:${p.p}:${p.A}`, text: pct4Text(p), form: 'num', answer: ans,
    hint: pct4Hint(p), solution: pct4Solution(p), diag: diagOf(ans, bugsAt(PCT4, p)),
  };
}

/** A download at p% of A megabytes (the transfer model's own draw). */
function download() {
  const p = PCT4T.params(rnd); const ans = PCT4T.answer(p);
  return {
    key: `pc4d:${p.p}:${p.A}`, text: downloadText(p), form: 'num', answer: ans, unit: 'מגה־בייט',
    hint: downloadHint(p), solution: pct4Solution(p), diag: diagOf(ans, bugsAt(PCT4T, p)),
  };
}

/**
 * The whole on the percent bar: the marker stays at p% on the top line, and the student stretches the bottom line until
 * p% of it is A. The target is named, so practice only. The bottom line starts on a multiple of its step that is not the
 * answer, and the answer is within the line.
 */
function stretch() {
  for (;;) {
    const p = pick(rnd, [10, 20, 25, 30, 40, 50, 60, 75]); const s = pick(rnd, [10, 20, 50, 100]);
    const k = rint(rnd, 4, 20); const W = s * k; const A = (p * W) / 100;
    if (!Number.isInteger(A)) continue;
    let j; do { j = rint(rnd, 2, 24); } while (j === k);
    return {
      key: `pc4s:${p}:${A}:${s}`, text: `מתחו את הפס התחתון עד ש־$${pc(p)}$ ממנו יהיו $${A}$.`,
      form: 'manip', practiceOnly: true,
      manip: { kind: 'dline', top: { max: 100, step: 5, unit: '%', label: 'אחוזים', every: 2 }, bottom: { max: 25 * s, step: s, label: 'הכמות', every: 5 }, move: 'max', fixT: p, start: { t: p, max: j * s } },
      answer: W,
      hint: `$${pc(p)}$ הם $${A}$. כמה הוא $1\\%$? מתחו עד ש־$100\\%$ הם פי $100$ ממנו.`,
      solution: [`$1\\%$ הוא $${A} : ${p} = ${num(A / p)}$.`, `השלם, $100\\%$: $${num(A / p)} \\cdot 100 = ${W}$.`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- pct:5 generators

/** A price after one change (the model's own draw of a single change). */
function newPrice() {
  let q; do { q = PCT5.params(rnd); } while (q.k !== 0);
  const ans = PCT5.answer(q); const item = ITEMS[rint(rnd, 0, ITEMS.length - 1)];
  return {
    key: `pc5:${q.up ? 1 : 0}:${q.p}:${q.N}:${ITEMS.indexOf(item)}`, text: pct5Text(q, item), form: 'num', answer: ans, unit: 'ש״ח',
    hint: pct5Hint(q), solution: pct5Solution(q), diag: diagOf(ans, bugsAt(PCT5, q)),
  };
}

/** A rise and then a fall by the same percent (the model's own draw of two changes). */
function twice() {
  let q; do { q = PCT5.params(rnd); } while (q.k !== 1);
  const ans = PCT5.answer(q); const item = ITEMS[rint(rnd, 0, ITEMS.length - 1)];
  return {
    key: `pc5w:${q.p}:${q.N}:${ITEMS.indexOf(item)}`, text: pct5Text(q, item), form: 'num', answer: ans, unit: 'ש״ח',
    hint: pct5Hint(q), solution: pct5Solution(q), diag: diagOf(ans, bugsAt(PCT5, q)),
  };
}

/** By what percent the price changed, old and new given (the transfer model's own draw). */
function byWhat() {
  const q = PCT5T.params(rnd); const ans = PCT5T.answer(q); const item = ITEMS[rint(rnd, 0, ITEMS.length - 1)];
  return {
    key: `pc5b:${q.N}:${num(q.M)}:${ITEMS.indexOf(item)}`, text: byWhatText(q, item), form: 'num', answer: ans, unit: '%',
    hint: byWhatHint(), solution: byWhatSolution(q), diag: diagOf(ans, bugsAt(PCT5T, q)),
  };
}

const MULTS = [1.2, 0.9, 1.25, 0.75, 1.05, 0.6];
/** A change from its multiplier (×1.2 is a rise of 20%, not of 1.2% or of 120%). Three choices, so practice only. */
function multMc() {
  const m = pick(rnd, MULTS); const up = m > 1; const p = Math.round(Math.abs(m - 1) * 100); const word = up ? 'התייקרות' : 'הוזלה';
  const options = shuffle([
    // choices in words are plain text: the percent is written 20%
    { text: `${word} של ${p}%`, ok: true },
    { text: `${word} של ${num(m)}%`, ok: false },
    { text: `${word} של ${Math.round(m * 100)}%`, ok: false },
  ]);
  return {
    key: `pc5m:${num(m)}`, text: `את המחיר החדש מחשבים כך: המחיר הקודם כפול $${num(m)}$. מה השינוי?`,
    form: 'mc', choices: options, answer: options.findIndex((c) => c.ok), practiceOnly: true,
    hint: `$${num(m)} = ${pc(Math.round(m * 100))}$ מהמחיר הקודם. כמה זה ${up ? 'יותר' : 'פחות'} מ־$100\\%$?`,
    solution: [`$${num(m)} = ${pc(Math.round(m * 100))}$ מהמחיר הקודם.`, `${up ? `$${Math.round(m * 100)} - 100 = ${p}$` : `$100 - ${Math.round(m * 100)} = ${p}$`}: ${word} של $${pc(p)}$.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- the topic

export const PCT = {
  id: 'pct', grade: '8', title: 'אחוזים', color: 'petrol',
  desc: 'אחוז כחלק ממאה, אחוז מכמות, איזה אחוז, מציאת השלם, ושינוי באחוזים',
  // taught in October of ח׳: the first-day placement test does not ask about it (the jump test does); ז׳ meets percents
  // in relative frequency (February), so Exam Rescue offers the unit to ז׳ too
  placement: false,
  alsoFor: ['7'],
  levels: [
    { title: 'מהו אחוז', gen: () => { const r = Math.random(); return r < 0.4 ? toPct() : r < 0.65 ? shade() : r < 0.85 ? estimate() : over100(); } },
    { title: 'אחוז מכמות', gen: () => { const r = Math.random(); return r < 0.45 ? ofAny() : r < 0.65 ? mental() : r < 0.8 ? classes() : estimate(); } },
    { title: 'איזה אחוז?', gen: () => { const r = Math.random(); return r < 0.5 ? whatPct() : r < 0.75 ? table() : grow(); } },
    { title: 'מציאת השלם', gen: () => { const r = Math.random(); return r < 0.55 ? whole() : r < 0.75 ? download() : stretch(); } },
    { title: 'הגדלה והקטנה באחוזים', gen: () => { const r = Math.random(); return r < 0.4 ? newPrice() : r < 0.6 ? twice() : r < 0.8 ? byWhat() : multMc(); } },
  ],
  cats: {
    'count-as-pct': 'כתבו את מספר החלקים או את האחוז עצמו כאילו הוא הכמות',
    'digit-pct': 'קראו את הספרות שאחרי הנקודה כאחוז ($0.4$ כאילו $4\\%$)',
    'div-by-pct': 'חילקו את הכמות במספר האחוזים',
    'inverse-ratio': 'חילקו את השלם בחלק במקום את החלק בשלם',
    'pct-of-part': 'חישבו אחוז מהחלק הנתון במקום למצוא את השלם',
    'stop-at-one': 'מצאו כמה הם $1\\%$ ועצרו שם',
    'add-pct': 'הוסיפו או הורידו את מספר האחוזים כאילו הוא שקלים',
    'change-only': 'ענו את גודל השינוי במקום את המחיר החדש',
    'additive-changes': 'חשבו שהתייקרות והוזלה באותו אחוז מבטלות זו את זו',
    // the same id and words as sys:1 (content/sys.js)
    'pct-of-new': 'האחוזים חושבו מהמחיר החדש במקום מהמחיר המקורי',
  },
  lesson: {
    points: [
      'אחוז הוא מאית: $1\\% = \\frac{1}{100} = 0.01$.',
      '$25\\%$ מ־$80$: $0.25 \\cdot 80 = 20$.',
      'איזה אחוז הם $15$ מתוך $60$? $\\frac{15}{60} = 0.25 = 25\\%$.',
      '$35\\%$ הם $1400$: $1\\%$ הוא $40$, והשלם $4000$.',
      'התייקרות של $20\\%$ היא כפל ב־$1.2$, והנחה של $20\\%$ היא כפל ב־$0.8$.',
      '$+10\\%$ ואחריו $-10\\%$ לא מחזירים למחיר הקודם: $100 \\to 110 \\to 99$.',
    ],
    words: ['אחוז', 'מאית', 'השלם ($100\\%$)', 'החלק', 'אחוז מכמות', 'איזה אחוז', 'מציאת השלם', 'התייקרות', 'הוזלה', 'הנחה', 'הגדלה והקטנה באחוזים', 'פי ($1.2$)', 'פס אחוזים', 'אומדן'],
  },
};
