// Signed fractions and decimals (שברים ועשרוניים מכוונים): the sixth stair of the signed-number unit, signed:6
// (curriculum stage 1, CURRICULUM-3). The grade 7 programme asks for signed numbers "שלמים, שברים פשוטים ועשרוניים";
// the first five stairs use whole numbers only. Here the same number line and the same sign rules carry halves,
// quarters and tenths: -2.5 + 1.2, -3/4 - (-1/2), (-0.5) · (-8), and where -2.4 sits between two whole numbers.
//
// The diagnostic models are the plan's frac5 and frac5T (finish/scratch/curriculum/plan/models.mjs), ported unchanged
// as SIGNED6 and SIGNED6T. Their errors are the ones the signed unit already diagnoses with whole numbers
// (learn/content/signed.ts): abs-add (distances added when the signs differ) and minus-minus (a negative subtracted
// as if it were positive); here also toward-zero, a negative fraction placed on the wrong side of its whole number.
// Every question has a negative number in it, so content/index.js fairForCheck keeps it in checks.
import { gcd, shuffle } from './util.js';
import { diagOf } from './eq.js';
import { mk, r9, dec } from './frac.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------- the models (plan/models.mjs frac5, frac5T, unchanged)

/** signed:6: two one-place decimals with different signs, added (k 0), or a negative number of quarters minus a negative one (k 1). */
export const SIGNED6 = mk({
  raw: (r) => {
    if (r() < 0.55) {
      const s = r() < 0.5 ? 1 : -1; const ai = rint(r, 1, 99); const bi = rint(r, 1, 99);
      if (ai % 10 === 0 || bi % 10 === 0 || ai === bi) return null;
      return { k: 0, a: (s * ai) / 10, b: (-s * bi) / 10, ai: s * ai, bi: -s * bi };
    }
    const xi = -rint(r, 1, 11); const yi = rint(r, 1, 7);
    return { k: 1, x: xi / 4, y: yi / 4, xi, yi };
  },
  answer: (p) => (p.k === 0 ? (p.ai + p.bi) / 10 : (p.xi + p.yi) / 4),
  bugs: {
    'abs-add': (p) => (p.k === 0 ? (Math.sign(Math.abs(p.ai) > Math.abs(p.bi) ? p.ai : p.bi) * (Math.abs(p.ai) + Math.abs(p.bi))) / 10 : null),
    'minus-minus': (p) => (p.k === 1 ? (p.xi - p.yi) / 4 : null),
  },
});
/** signed:6 transfer: a morning temperature below zero, then a rise. */
export const SIGNED6T = mk({
  raw: (r) => { const ai = -rint(r, 11, 89); const bi = rint(r, 11, 99); if (ai % 10 === 0 || bi % 10 === 0 || -ai === bi) return null; return { ai, bi }; },
  answer: ({ ai, bi }) => (ai + bi) / 10,
  bugs: { 'abs-add': ({ ai, bi }) => (Math.sign(Math.abs(ai) > Math.abs(bi) ? ai : bi) * (Math.abs(ai) + Math.abs(bi))) / 10 },
});

// ---------------------------------------------------------------- shared words

/** A decimal as TeX, bracketed when negative and `wrap` is set: (-1.2). */
export const decTex = (v, wrap = false) => (v < 0 && wrap ? `(${dec(v)})` : dec(v));
/** A number of quarters as TeX, reduced and as a mixed number: -1\frac{1}{4}, -\frac{1}{2}, -2, \frac{3}{4}. */
export function quarterTex(v) {
  const n = Math.round(v * 4); if (n === 0) return '0';
  const g = gcd(Math.abs(n), 4); const N = Math.abs(n) / g; const D = 4 / g;
  const sign = n < 0 ? '-' : '';
  if (D === 1) return `${sign}${N}`;
  const w = Math.floor(N / D); const rest = N % D;
  return `${sign}${w || ''}\\frac{${rest}}{${D}}`;
}
/** A number of quarters as an improper fraction over 4, as it is computed: -\frac{7}{4}. */
const fourths = (n) => (n === 0 ? '0' : `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{4}`);
/** Draw the model until it gives the kind wanted (0: decimals, 1: quarters). */
export const drawKind = (k, r = rnd) => { for (;;) { const p = SIGNED6.params(r); if (p.k === k) return p; } };

/** The question as shown: -2.5 + 1.2, 2.5 + (-1.2); -\frac{3}{4} - \left(-\frac{1}{2}\right). */
export const signed6Tex = (p) => (p.k === 0
  ? `${decTex(p.a)} + ${decTex(p.b, true)}`
  : `${quarterTex(p.x)} - \\left(${quarterTex(-p.y)}\\right)`);
/** The answer as written: a decimal for decimals, quarters as a fraction (with its decimal when it is not whole). */
export const signed6Answer = (p, ans) => (p.k === 0 ? dec(ans) : `${quarterTex(ans)}${Number.isInteger(r9(ans)) ? '' : ` = ${dec(ans)}`}`);
export function signed6Solution(p) {
  const ans = SIGNED6.answer(p);
  if (p.k === 0) {
    const A = Math.abs(p.a); const B = Math.abs(p.b); const far = A > B ? p.a : p.b;
    return [
      `סימנים שונים: מחסרים את המרחקים מאפס, $${dec(Math.max(A, B))} - ${dec(Math.min(A, B))} = ${dec(Math.abs(ans))}$.`,
      `הסימן הוא של $${dec(far)}$, הרחוק יותר מאפס: $${signed6Tex(p)} = ${signed6Answer(p, ans)}$`,
    ];
  }
  return [
    `חיסור של מספר שלילי הוא חיבור של הנגדי שלו: $${signed6Tex(p)} = ${quarterTex(p.x)} + ${quarterTex(p.y)}$.`,
    `ברבעים: $${fourths(p.xi)} + ${fourths(p.yi)} = ${fourths(p.xi + p.yi)}$`,
    `התשובה: $${signed6Answer(p, ans)}$`,
  ];
}
export const signed6Hint = (p) => (p.k === 0
  ? 'סימנים שונים: מחסרים את המרחקים מאפס, והסימן הוא של המספר הרחוק יותר מאפס.'
  : 'חיסור של מספר שלילי הוא חיבור של הנגדי שלו: הופכים את החיסור לחיבור, ואת המספר השלילי לחיובי.');

/** The transfer question's story: a morning below zero, then a rise. */
export const tempText = ({ ai, bi }) => `בבוקר נמדדו $${dec(ai / 10)}^\\circ$, ועד הצהריים הטמפרטורה עלתה ב־$${dec(bi / 10)}^\\circ$. כמה מעלות היו בצהריים?`;
export function tempSolution({ ai, bi }) {
  const ans = (ai + bi) / 10;
  const far = -ai > bi ? ai / 10 : bi / 10;
  return [
    `עלייה היא חיבור: $${dec(ai / 10)} + ${dec(bi / 10)}$.`,
    `סימנים שונים: $${dec(Math.max(-ai, bi) / 10)} - ${dec(Math.min(-ai, bi) / 10)} = ${dec(Math.abs(ans))}$, והתוצאה ${ans < 0 ? 'שלילית' : 'חיובית'}, כי $${dec(far)}$ רחוק יותר מאפס.`,
    `בצהריים היו $${dec(ans)}^\\circ$.`,
  ];
}

// ---------------------------------------------------------------- generators

/** Two decimals with different signs, added (the model's decimal draw). */
function addDec() {
  const p = drawKind(0); const ans = SIGNED6.answer(p);
  return {
    key: `sn6a:${signed6Tex(p)}`, text: 'חשבו:', display: signed6Tex(p), form: 'num', answer: ans, fmt: 'dec',
    ...(Number.isInteger(r9(ans)) ? {} : { precise: true }),
    hint: signed6Hint(p), solution: signed6Solution(p),
    diag: diagOf(ans, { 'abs-add': SIGNED6.bugs['abs-add'](p) }),
  };
}

/** A negative number of quarters minus a negative one (the model's quarter draw): the answer as a fraction. */
function subNeg() {
  // the model's quarter draw, without the few where both numbers are whole (-2 - (-1) is signed:1, not this stair)
  let p; do { p = drawKind(1); } while (p.xi % 4 === 0 && p.yi % 4 === 0);
  const ans = SIGNED6.answer(p);
  return {
    key: `sn6s:${signed6Tex(p)}`, text: Number.isInteger(r9(ans)) ? 'חשבו:' : 'חשבו. אפשר לכתוב כשבר או כמספר עשרוני.', display: signed6Tex(p), form: 'num', answer: ans,
    ...(Number.isInteger(r9(ans)) ? {} : { precise: true }),
    hint: signed6Hint(p), solution: signed6Solution(p),
    diag: diagOf(ans, { 'minus-minus': SIGNED6.bugs['minus-minus'](p) }),
  };
}

const MUL_DECS = [0.5, 1.5, 2.5, 0.2, 0.4, 0.3, 1.2, 0.25, 0.75];
/** A decimal times a whole number, at least one of them negative: (-0.5) · (-8), 1.5 · (-4). */
function mulDec() {
  const d = pick(MUL_DECS); const n = rint(rnd, 2, 12);
  const sd = Math.random() < 0.5 ? -1 : 1; const sn = sd > 0 || Math.random() < 0.5 ? -1 : 1;
  const [x, y] = Math.random() < 0.6 ? [sd * d, sn * n] : [sn * n, sd * d];
  const ans = r9(x * y); const display = `${decTex(x, true)} \\cdot ${decTex(y, true)}`;
  return {
    key: `sn6m:${display}`, text: 'חשבו:', display, form: 'num', answer: ans, fmt: 'dec',
    ...(Number.isInteger(ans) ? {} : { precise: true }),
    hint: 'קודם הסימן: סימנים זהים נותנים חיובי, סימנים שונים נותנים שלילי. אחר כך כופלים בלי הסימנים.',
    solution: [
      `הסימנים ${Math.sign(x) === Math.sign(y) ? 'זהים, ולכן התוצאה חיובית' : 'שונים, ולכן התוצאה שלילית'}.`,
      `$${dec(Math.abs(x))} \\cdot ${dec(Math.abs(y))} = ${dec(Math.abs(ans))}$`,
      `התשובה: $${dec(ans)}$`,
    ],
    diag: diagOf(ans, { sign: -ans }),
  };
}

/**
 * Between which two whole numbers is -2.4? Three choices (practice only): the right pair; the pair on the zero side
 * (-2 and -1, the decimal placed toward zero: toward-zero); and the positive pair (the minus left out).
 */
function between() {
  let i; do { i = rint(rnd, 11, 49); } while (i % 10 === 0);
  const v = -i / 10; const lo = Math.floor(v); const hi = Math.ceil(v);
  const pair = (a, b) => `${a},\\; ${b}`;
  const choices = shuffle([
    { tex: pair(lo, hi), ok: true },
    { tex: pair(hi, hi + 1), ok: false, bug: 'toward-zero' },
    { tex: pair(-hi, -lo), ok: false },
  ]);
  return {
    key: `sn6b:${dec(v)}`, text: `בין אילו שני שלמים נמצא $${dec(v)}$?`, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: `$${dec(v)}$ הוא $${hi}$ ועוד $${dec(r9(hi - v))}$ שמאלה, רחוק יותר מאפס.`,
    solution: [`$${dec(v)}$ רחוק מאפס יותר מ־$${hi}$, ולכן הוא משמאל לו.`, `$${lo} < ${dec(v)} < ${hi}$`],
    diag: (u) => choices[u]?.bug || null,
  };
}

/** Put the marker on a negative number of quarters, -3..1 cut into quarters (the target is named: practice only). */
function placeNeg() {
  let k; do { k = rint(rnd, -11, -1); } while (k % 4 === 0);
  const v = k / 4; const hi = Math.ceil(v); const lo = Math.floor(v);
  return {
    key: `sn6p:${dec(v)}`, text: `שימו את הסמן על $${dec(v)}$.`, form: 'manip', practiceOnly: true,
    manip: { kind: 'numberline', min: -3, max: 1, from: 0, start: 0, den: 4, fmt: 'dec' }, answer: v,
    hint: `כל שלם מחולק ל־$4$ חלקים, כל חלק $0.25$. מספר שלילי נמצא משמאל לאפס: ספרו ${k === -1 ? 'חלק אחד' : `$${-k}$ חלקים`} שמאלה מ־$0$.`,
    solution: [k === -1 ? `$${dec(v)}$ הוא רבע אחד משמאל לאפס.` : `$${dec(v)}$ הם $${-k}$ רבעים משמאל לאפס.`, `$${lo} < ${dec(v)} < ${hi}$: הוא משמאל ל־$${hi}$.`],
    diag: () => null,
  };
}

/** signed:6, as the sixth level of the signed topic (content/grade7.js). */
export const SIGNED6_LEVEL = {
  title: 'שברים ועשרוניים מכוונים',
  gen: () => { const r = Math.random(); return r < 0.3 ? addDec() : r < 0.55 ? subNeg() : r < 0.75 ? mulDec() : r < 0.9 ? between() : placeNeg(); },
};
