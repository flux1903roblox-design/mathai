// Grade 8 (ח׳): equations and systems (משוואות ומערכות), in the order of the Ministry's programme for grade 8:
// equations with a percent change (December to January), a system by substitution and by equal coefficients
// (February to April), word problems with two unknowns, and inequalities (May). Every worked solution ends with a
// check: in both equations for a system, in the story for a word problem, with one number for an inequality.
// Taught from December, so the first-day placement test skips it (placement: false).
//
// The parameters of every kind of question are drawn by functions that take a random source (rnd), so the teaching
// content's diagnostic models (learn/content/sys.ts) use the same numbers, words and worked solutions as practice.
//
// Documented errors used here, each with its source:
//   pct-of-new     the percent taken of the new amount (after +20% the price is 60, so 60 − 12 = 48): the curriculum's
//                  own class task (algebra_8, p. 75: "25% dearer than pears" read as "pears 25% cheaper"), and teachers'
//                  diagnostic questions on reverse percentages (Mr Barton Maths, "Probing Questions: Reverse Percentages")
//   partial-dist   only the first term of a bracket multiplied, here when an expression is substituted (2x + 3(x + 2)
//                  → 2x + 3x + 2; Kirshner & Awtry 2004; the app's expr:4)
//   forgot-y       one unknown found and the other never computed (the curriculum: "שימו לב שלנקודת החיתוך יש שני
//                  שיעורים ועליכם למצוא את שניהם", algebra_8 p. 92; the app's line:8)
//   swap           the pair written (y, x) (the app's line:8)
//   minus-bracket  subtracting an equation subtracts only part of it: 19 − 13 written 19 + 13 (Herscovics & Linchevski
//                  1994 on a minus before brackets)
//   wrong-unknown  the unknown answered, not what was asked (the curriculum's note on checking against the question)
//   no-flip        dividing by a negative without reversing the inequality (Tsamir & Almog 2001: inequalities solved
//                  by analogy with equations)
//   over-flip      reversing it because there is a minus somewhere, although the division is by a positive number
//                  (2x > −6 → x < −3; teachers' guides on inequalities, e.g. the Alberta grade 9 planning guide)
//   boundary       < and ≤ confused: the boundary itself taken or left (Tsamir & Almog 2001, "excluded values")
//   (rounding "at most" up, 20.8 boxes → 21, is taught but not diagnosed: it is always one off, as a slip can be)
//   move-no-flip   a number moved to the other side without changing its sign (Hall 2002)
import { NZ, pick, shuffle, T, gcd, listMath } from './util.js';
import { linTex, sumTex } from './expr.js';
import { diagOf } from './eq.js';
import { holds, rint, rnz, rpick } from '@/learn/expr.ts';

const abs = Math.abs;
const tex = (t) => ({ tex: t });
const txt = (t) => ({ text: t });
const rnd0 = Math.random;

/** A decimal as written in school, never as a fraction: 1.2, 0.85, 2.5. */
export const dec = (v) => String(Math.round(v * 1e6) / 1e6);
/** A number in a solution: whole as is, otherwise a decimal (inequalities and percents read as decimals). */
const num = (v) => (Number.isInteger(v) ? T(v) : dec(v));
/** a : b for whole a, b > 0: whole, a decimal of up to two places, or a mixed number (26 : 6 is 4\frac{1}{3}). */
export function quotTex(a, b) {
  const v = a / b;
  if (Number.isInteger(v)) return T(v);
  if (Number.isInteger(Math.round(v * 1e9) / 1e7)) return dec(v);
  const g = gcd(a % b, b); return `${Math.floor(v)}\\frac{${(a % b) / g}}{${b / g}}`;
}
/** A system of two equations as TeX. */
export const cases = (a, b) => `\\begin{cases} ${a} \\\\ ${b} \\end{cases}`;
/** px + qy as TeX: 3x - 2y, -x + y, 4y. */
export const pq = (p, q) => sumTex([[p, 'x'], [q, 'y']].filter(([n]) => n !== 0));
/** k·v as TeX, v put in: 3 \cdot (-2), -(-2), 5. */
export const prod = (k, v) => (k === 1 ? T(v) : k === -1 ? `-${T(v, true)}` : `${T(k)} \\cdot ${T(v, true)}`);
/** p·x + q·y with x and y put in, as TeX: 2 \cdot 3 - 4 \cdot (-1). */
export const combo = (p, x, q, y) => (p === 0 ? prod(q, y) : `${prod(p, x)} ${q < 0 ? '-' : '+'} ${abs(q) === 1 ? T(y, true) : `${abs(q)} \\cdot ${T(y, true)}`}`);
/** a·v + b with v put in: 3 \cdot (-2) + 5. */
export const at = (a, b, v) => (a === 0 ? T(b) : b === 0 ? prod(a, v) : `${prod(a, v)} ${b < 0 ? '-' : '+'} ${abs(b)}`);
export const pairTex = (x, y) => `(${T(x)}, ${T(y)})`;
/** "Remove b from both sides", in words. */
const undo = (b) => (b > 0 ? `מחסירים $${b}$ משני האגפים` : `מוסיפים $${-b}$ לשני האגפים`);

// ================================================================ 1. equations with percents (משוואות עם אחוזים)
// The curriculum: "יש לפתח תובנה חשבונית ואלגברית לשימוש באחוזים באמצעות הדגשת היסוד הכפלי של הגדלה או הקטנה
// באחוזים". An increase of p% multiplies by 1 + p/100, a decrease by 1 − p/100, and the unknown is the amount the
// percent is taken of.

const ITEMS = ['המעיל', 'המשחק', 'התיק', 'השעון', 'הטלפון'];
/** The multiplier of a change: +20% is 1.2, −30% is 0.7. */
export const mult = (up, p) => (100 + (up ? p : -p)) / 100;
/** v changed by p%, computed on whole numbers (220 · 1.15 in floating point is 252.999…). */
export const change = (v, up, p) => (v * (100 + (up ? p : -p))) / 100;
/** Whole amounts that a percent p of is also whole, from lo to hi. */
const wholeFor = (rnd, p, lo, hi) => { const step = 100 / gcd(p, 100); return step * rint(rnd, Math.ceil(lo / step), Math.floor(hi / step)); };

/** A price after a raise or a discount; the price before is asked. */
export function pctDraw(rnd) {
  const up = rnd() < 0.5; const p = rpick(rnd, up ? [5, 10, 15, 20, 25, 30, 40, 50] : [10, 15, 20, 25, 30, 40, 50]);
  const x = wholeFor(rnd, p, 40, 600);
  return { up, p, x, N: change(x, up, p), n: rint(rnd, 0, ITEMS.length - 1) };
}
/** The percent taken of the new price: after +20% the price is 60, and 60 − 20% of 60 = 48. */
export const pctOfNew = ({ up, p, N }) => change(N, !up, p);
export const pctText = ({ up, p, N, n }) => (up
  ? `${ITEMS[n]} התייקר ב־$${p}\\%$, ועכשיו הוא עולה $${N}$ ₪. כמה עלה ${ITEMS[n]} לפני ההתייקרות?`
  : `על ${ITEMS[n]} הייתה הנחה של $${p}\\%$, ואחרי ההנחה הוא עולה $${N}$ ₪. כמה עלה ${ITEMS[n]} לפני ההנחה?`);
export const pctHint = ({ up, p }) => (up
  ? `המחיר הישן הוא $100\\%$, והחדש $${100 + p}\\%$ ממנו, כלומר $${dec(mult(up, p))}$ כפול המחיר הישן. נסמנו ב־$x$ את המחיר הישן.`
  : `אחרי הנחה של $${p}\\%$ נשארים $${100 - p}\\%$ מהמחיר, כלומר $${dec(mult(up, p))}$ כפול המחיר הישן. נסמנו ב־$x$ את המחיר הישן.`);
export function pctSolution({ up, p, x, N }) {
  const m = dec(mult(up, p)); const d = (x * p) / 100;
  return [
    `נסמן ב־$x$ את המחיר לפני ה${up ? 'התייקרות' : 'הנחה'}. ${up ? `אחרי התייקרות של $${p}\\%$ המחיר הוא $${100 + p}\\%$ ממנו` : `אחרי הנחה של $${p}\\%$ נשארים $${100 - p}\\%$ ממנו`}: $${m}x = ${N}$`,
    `מחלקים את שני האגפים ב־$${m}$: $x = ${x}$`,
    `בדיקה: $${p}\\%$ מ־$${x}$ הם $${d}$, ו־$${x} ${up ? '+' : '-'} ${d} = ${N}$.`,
  ];
}
function pctItem() {
  const P = pctDraw(rnd0);
  return { key: `sy1:${P.up}:${P.p}:${P.x}:${P.n}`, text: pctText(P), form: 'num', answer: P.x, unit: '₪', hint: pctHint(P), solution: pctSolution(P), diag: diagOf(P.x, { 'pct-of-new': pctOfNew(P) }) };
}

/** Which equation fits? The percent of the new price, the change alone, and the percent as shekels are the others. */
function pctEquation() {
  for (;;) {
    const P = pctDraw(rnd0); const { up, p, x, N, n } = P; const m = dec(mult(up, p)); const r = dec(p / 100);
    const opts = [[`${m}x = ${N}`, true], [`x = ${N} ${up ? '-' : '+'} ${r} \\cdot ${N}`, 'pct-of-new'], [`${r}x = ${N}`], [`x ${up ? '+' : '-'} ${p} = ${N}`]];
    // exactly one of them holds at the story's price (x − 20 = 80 at x = 100 also holds: redrawn)
    if (opts.filter(([t]) => holds(t, { x })).length !== 1 || !holds(opts[0][0], { x })) continue;
    const choices = shuffle(opts.map(([t, tag]) => ({ ...tex(t), ok: tag === true, bug: typeof tag === 'string' ? tag : undefined })));
    const d = (x * p) / 100;
    return {
      key: `sy1e:${up}:${p}:${x}`, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
      text: up ? `${ITEMS[n]} התייקר ב־$${p}\\%$, ועכשיו הוא עולה $${N}$ ₪. $x$ הוא המחיר לפני ההתייקרות. איזו משוואה מתאימה?`
        : `על ${ITEMS[n]} הייתה הנחה של $${p}\\%$, ואחריה הוא עולה $${N}$ ₪. $x$ הוא המחיר לפני ההנחה. איזו משוואה מתאימה?`,
      hint: 'האחוזים הם מהמחיר הישן, $x$. כמה אחוזים ממנו הוא המחיר החדש?',
      solution: [
        `המחיר הישן הוא $100\\%$, והחדש $${up ? 100 + p : 100 - p}\\%$ ממנו: $${m}x = ${N}$, ולכן $x = ${x}$.`,
        `בדיקה: $${p}\\%$ מ־$${x}$ הם $${d}$, ו־$${x} ${up ? '+' : '-'} ${d} = ${N}$.`,
        `ואילו $${N} ${up ? '-' : '+'} ${r} \\cdot ${N} = ${dec(pctOfNew(P))}$ לוקח את האחוזים מ־$${N}$, המחיר החדש, ולכן זה לא המחיר הישן.`,
      ],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// The curriculum's own: "מחיר החולצה היה נמוך ב־30% ממחיר המכנסיים ... אלון שילם 204 ש״ח על החולצה והמכנסיים יחד".
const PAIRS = [
  { other: 'החולצה', base: 'המכנסיים', adj: ['זולה', 'יקרה'], ask: ['כמה עלו המכנסיים?', 'כמה עלתה החולצה?'] },
  { other: 'המחברת', base: 'הספר', adj: ['זולה', 'יקרה'], ask: ['כמה עלה הספר?', 'כמה עלתה המחברת?'] },
  { other: 'הכדור', base: 'המחבט', adj: ['זול', 'יקר'], ask: ['כמה עלה המחבט?', 'כמה עלה הכדור?'] },
];
/** Two prices, one p% cheaper or dearer than the other (the base), and their total; q 0 asks the base, 1 the other. */
export function togetherDraw(rnd) {
  const cheap = rnd() < 0.6; const p = rpick(rnd, [10, 20, 25, 30, 40, 50]);
  const x = wholeFor(rnd, p, 20, 300); const o = change(x, !cheap, p);
  return { cheap, p, x, o, T: x + o, q: rint(rnd, 0, 1), n: rint(rnd, 0, PAIRS.length - 1) };
}
export const togetherText = ({ cheap, p, T: total, q, n }) => { const P = PAIRS[n]; return `${P.other} ${P.adj[cheap ? 0 : 1]} ב־$${p}\\%$ מ${P.base}. יחד שילמו עליהם $${total}$ ₪. ${P.ask[q]}`; };
export const togetherAnswer = (p) => (p.q ? p.o : p.x);
export const togetherHint = ({ n, q }) => `נסמנו ב־$x$ את המחיר של ${PAIRS[n].base}: האחוזים הם ממנו. כמה עולה ${PAIRS[n].other}, בעזרת $x$?${q ? ` ושימו לב: שאלו על ${PAIRS[n].other}.` : ''}`;
export function togetherSolution({ cheap, p, x, o, T: total, q, n }) {
  const P = PAIRS[n]; const m = dec(mult(!cheap, p)); const s = dec(1 + mult(!cheap, p)); const d = (x * p) / 100;
  return [
    `נסמן ב־$x$ את המחיר של ${P.base}. ${P.other}: $${m}x$`,
    `יחד: $x + ${m}x = ${total}$, כלומר $${s}x = ${total}$`,
    `מחלקים ב־$${s}$: $x = ${x}$`,
    ...(q ? [`${P.other}: $${m} \\cdot ${x} = ${o}$ ₪`] : []),
    `בדיקה: $${p}\\%$ מ־$${x}$ הם $${d}$, ו־$${x} ${cheap ? '-' : '+'} ${d} = ${o}$. יחד: $${x} + ${o} = ${total}$.`,
  ];
}
function togetherItem() {
  const P = togetherDraw(rnd0);
  return { key: `sy1t:${P.cheap}:${P.p}:${P.x}:${P.q}:${P.n}`, text: togetherText(P), form: 'num', answer: togetherAnswer(P), unit: '₪', hint: togetherHint(P), solution: togetherSolution(P), diag: diagOf(togetherAnswer(P), { 'wrong-unknown': P.q ? P.x : null }) };
}

// The curriculum: "בשני אולמות קולנוע יש בסך הכול 240 צופים. אם 20% מהצופים באולם א' יעברו לאולם ב' יהיה מספר
// הצופים בשני האולמות שווה". (1 − r)x = T − x + rx.
function hallsItem() {
  for (;;) {
    const p = pick([10, 20, 25, 30, 40]); const A = wholeFor(rnd0, p, 50, 300); const m = (A * p) / 100; const B = A - 2 * m;
    if (B < 10) continue;
    const total = A + B; const q = rnd0() < 0.5 ? 1 : 0; const r = dec(p / 100); const k = dec(1 - p / 100);
    return {
      key: `sy1h:${p}:${A}:${q}`, form: 'num', answer: q ? B : A, unit: 'צופים',
      text: `בשני אולמות קולנוע יש יחד $${total}$ צופים. אם $${p}\\%$ מהצופים באולם א׳ יעברו לאולם ב׳, יהיה בשני האולמות אותו מספר צופים. כמה צופים יש באולם ${q ? 'ב׳' : 'א׳'}?`,
      hint: `נסמנו ב־$x$ את הצופים באולם א׳. כמה עוברים, כמה נשארים, וכמה יהיו באולם ב׳?`,
      solution: [
        `נסמן ב־$x$ את הצופים באולם א׳. באולם ב׳: $${total} - x$.`,
        `עוברים $${r}x$ צופים: $${k}x = ${total} - x + ${r}x$`,
        `מכנסים: $${dec(2 * (1 - p / 100))}x = ${total}$, ולכן $x = ${A}$.`,
        ...(q ? [`באולם ב׳: $${total} - ${A} = ${B}$.`] : []),
        `בדיקה: עוברים $${m}$ צופים, ובכל אולם $${A - m}$.`,
      ],
      diag: diagOf(q ? B : A, { 'wrong-unknown': q ? A : null }),
    };
  }
}

// ================================================================ 2. substitution (שיטת ההצבה)
// The curriculum: "מומלץ להתחיל לפתור מערכת משוואות בשיטת ההצבה כאשר אחת מהמשוואות רשומה בייצוג מפורש", and to
// begin with a horizontal line. The solution is an ordered pair that makes both equations true: the meeting point.

/**
 * y = mx + b (or x = my + b, xe) and px + qy = r with a whole solution. The coefficient the explicit expression is
 * substituted into is at least 2 in size, and b is not 0, so multiplying only the first term changes the result.
 */
export function substDraw(rnd) {
  for (;;) {
    const xe = rnd() < 0.3;
    const x = rnz(rnd, -6, 6); const y = rnz(rnd, -6, 6); if (x === y) continue;
    const m = rnz(rnd, -4, 4); const b = xe ? x - m * y : y - m * x;
    if (b === 0 || abs(b) > 12) continue;
    const p = rnz(rnd, -5, 5); const q = rnz(rnd, -5, 5);
    if (abs(xe ? p : q) < 2) continue;
    const den = xe ? p * m + q : p + q * m; if (den === 0) continue;
    const r = p * x + q * y; if (abs(r) > 45) continue;
    return { xe, x, y, m, b, p, q, r, top: rnd() < 0.75 };
  }
}
/** The explicit equation as TeX. */
const explicitTex = ({ xe, m, b }) => (xe ? `x = ${linTex(m, b, 'y')}` : `y = ${linTex(m, b)}`);
export const substShow = (s) => (s.top ? cases(explicitTex(s), `${pq(s.p, s.q)} = ${T(s.r)}`) : cases(`${pq(s.p, s.q)} = ${T(s.r)}`, explicitTex(s)));
/** The pair the error gives: k(mv + b) opened as kmv + b. */
export function substPartial({ xe, m, b, p, q, r }) {
  const den = xe ? p * m + q : p + q * m;
  const first = (r - b) / den; const second = m * first + b;
  return xe ? [second, first] : [first, second];
}
export function substSolution(s) {
  const { xe, x, y, m, b, p, q, r } = s;
  const [u, v, uv, vv] = xe ? ['y', 'x', y, x] : ['x', 'y', x, y];
  const k = xe ? p : q; const own = xe ? q : p; // the coefficient the expression goes into, and the other one
  const into = xe ? `${abs(k) === 1 ? (k < 0 ? '-' : '') : k}(${linTex(m, b, 'y')}) ${own < 0 ? '-' : '+'} ${abs(own) === 1 ? '' : abs(own)}y`
    : `${sumTex([[p, 'x']])} ${q < 0 ? '-' : '+'} ${abs(q) === 1 ? '' : abs(q)}(${linTex(m, b)})`;
  const A = own + k * m; const B = k * b;
  return [
    `מציבים את $${explicitTex(s)}$ במשוואה השנייה, בסוגריים: $${into} = ${T(r)}$`,
    `פותחים סוגריים ומכנסים: $${linTex(A, B, u)} = ${T(r)}$`,
    abs(A) === 1 && A === 1 ? `${undo(B)}: $${u} = ${T(uv)}$` : `${undo(B)}: $${linTex(A, 0, u)} = ${T(r - B)}$, ולכן $${u} = ${T(uv)}$`,
    `מציבים בחזרה: $${v} = ${at(m, b, uv)} = ${T(vv)}$`,
    `בדיקה במשוואה השנייה: $${combo(p, x, q, y)} = ${T(r)}$. הפתרון: $${pairTex(x, y)}$`,
  ];
}
export const substHint = ({ xe }) => `במשוואה אחת $${xe ? 'x' : 'y'}$ כבר כתוב בעזרת $${xe ? 'y' : 'x'}$. מציבים את הביטוי, בסוגריים, במשוואה השנייה, ופותרים משוואה עם נעלם אחד.`;
/** An answer (x, y) that is the solution with the coordinates swapped. */
const isSwap = (u, x, y) => x !== y && Array.isArray(u) && abs(u[0] - y) < 1e-6 && abs(u[1] - x) < 1e-6;
function substItem() {
  const s = substDraw(rnd0); const bad = substPartial(s); const first = s.xe ? 1 : 0;
  return {
    key: `sy2:${substShow(s)}`, text: 'פתרו את מערכת המשוואות.', display: substShow(s), form: 'pt', label: '', answer: [s.x, s.y],
    hint: substHint(s), solution: substSolution(s),
    // the coordinate found first: the one the error changes
    diag: (u) => (isSwap(u, s.x, s.y) ? 'swap' : Array.isArray(u) ? diagOf([s.x, s.y][first], { 'partial-dist': bad[first] })(u[first]) : null),
  };
}

/** A horizontal line and a sloped one (the curriculum starts there): y = k, y = mx + b. */
function levelItem() {
  for (;;) {
    const x = rnz(rnd0, -5, 5); const y = rnz(rnd0, -6, 6); const m = rnz(rnd0, -4, 4); const b = y - m * x;
    if (x === y || b === 0 || abs(b) > 12) continue;
    const display = rnd0() < 0.5 ? cases(`y = ${T(y)}`, `y = ${linTex(m, b)}`) : cases(`y = ${linTex(m, b)}`, `y = ${T(y)}`);
    return {
      key: `sy2h:${display}`, text: 'פתרו את מערכת המשוואות.', display, form: 'pt', label: '', answer: [x, y],
      hint: `ישר אחד אופקי: עליו תמיד $y = ${T(y)}$. מציבים את זה במשוואה השנייה.`,
      solution: [`מציבים $y = ${T(y)}$ במשוואה השנייה: $${T(y)} = ${linTex(m, b)}$`, m === 1 ? `${undo(b)}: $${T(y - b)} = x$` : `${undo(b)}: $${T(y - b)} = ${linTex(m, 0)}$, ולכן $x = ${T(x)}$`, `הפתרון: $${pairTex(x, y)}$. בדיקה: $${at(m, b, x)} = ${T(y)}$.`],
      diag: (u) => (isSwap(u, x, y) ? 'swap' : null),
    };
  }
}

/** Which pair solves it? One on both lines, one on each line only, and the swapped pair (the curriculum's own task). */
function whichPair() {
  for (;;) {
    const x = rint(rnd0, -4, 4); const y = rint(rnd0, -6, 6); const m1 = rint(rnd0, -3, 3); const m2 = rint(rnd0, -3, 3);
    if (m1 === m2 || x === y) continue;
    const b1 = y - m1 * x; const b2 = y - m2 * x; if (abs(b1) > 10 || abs(b2) > 10) continue;
    const d1 = x + NZ(-3, 3); const d2 = x + NZ(-3, 3);
    const P1 = [d1, m1 * d1 + b1]; const P2 = [d2, m2 * d2 + b2]; const S = [y, x];
    const all = [[x, y], P1, P2, S];
    if (new Set(all.map((p) => p.join(','))).size !== 4 || all.some((p) => abs(p[0]) > 12 || abs(p[1]) > 12)) continue;
    const on = (P, m, b) => P[1] === m * P[0] + b;
    // only the solution is on both lines
    if (all.filter((P) => on(P, m1, b1) && on(P, m2, b2)).length !== 1) continue;
    const choices = shuffle(all.map((P, i) => ({ ...tex(pairTex(P[0], P[1])), ok: i === 0, bug: i === 3 ? 'swap' : undefined })));
    return {
      key: `sy2w:${m1}:${b1}:${m2}:${b2}:${d1}:${d2}`, text: 'איזה זוג הוא הפתרון של המערכת?', display: cases(`y = ${linTex(m1, b1)}`, `y = ${linTex(m2, b2)}`),
      form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
      hint: 'מציבים כל זוג בשתי המשוואות. הפתרון מקיים את שתיהן, לא רק אחת.',
      solution: [
        `$${pairTex(x, y)}$: בראשונה $${at(m1, b1, x)} = ${T(y)}$, ובשנייה $${at(m2, b2, x)} = ${T(y)}$. שתיהן מתקיימות.`,
        `$${pairTex(P1[0], P1[1])}$ מקיים רק את הראשונה: בשנייה $${at(m2, b2, P1[0])} = ${T(m2 * P1[0] + b2)}$, ולא $${T(P1[1])}$.`,
        `$${pairTex(S[0], S[1])}$ הוא הפתרון בסדר הפוך: קודם $x$, אחר כך $y$.`,
      ],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

/** The solution of a system is where its two lines meet: put it on the graph. */
function meetItem() {
  for (;;) {
    const x = rint(rnd0, -4, 4); const y = rint(rnd0, -5, 5); const m1 = rint(rnd0, -3, 3); const m2 = rint(rnd0, -3, 3);
    if (m1 === m2 || (x === 0 && y === 0)) continue;
    const b1 = y - m1 * x; const b2 = y - m2 * x; if (abs(b1) > 8 || abs(b2) > 8) continue;
    const lines = [{ m: m1, b: b1 }, { m: m2, b: b2 }];
    return {
      key: `sy2m:${m1}:${b1}:${m2}:${b2}`, text: 'בגרף שני הישרים של המערכת. שימו את הנקודה שהיא הפתרון שלה.', form: 'manip',
      manip: { kind: 'plot', range: 6, label: '', start: null, lines }, answer: [x, y],
      hint: 'הפתרון נמצא על שני הישרים. מחפשים את הנקודה שבה הם נפגשים, ובודקים אותה בשתי המשוואות.',
      solution: [`הישרים נפגשים ב־$${pairTex(x, y)}$.`, `בדיקה: $${at(m1, b1, x)} = ${T(y)}$, וגם $${at(m2, b2, x)} = ${T(y)}$.`],
      diag: (u) => (isSwap(u, x, y) ? 'swap' : null),
    };
  }
}

const HOW_MANY = ['פתרון אחד', 'אין פתרון', 'אינסוף פתרונות'];
function howMany(display, kind, solution) {
  const choices = shuffle(HOW_MANY.map((t, i) => ({ ...txt(t), ok: ['one', 'none', 'all'][i] === kind })));
  return {
    key: `sys-n:${display}`, text: 'כמה פתרונות יש למערכת?', display, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
    hint: 'מציבים או משווים מקדמים. נשארה משוואה עם נעלם? שוויון נכון תמיד? או שוויון שאף פעם לא נכון?',
    solution, diag: () => null,
  };
}
/** How many solutions, with one equation explicit: parallel lines, the same line written twice, or one meeting point. */
function howMany2() {
  const kind = pick(['one', 'none', 'all']); const m = NZ(-3, 3); const b = NZ(-6, 6); const k = pick([2, 3, -2]);
  const first = `y = ${linTex(m, b)}`;
  if (kind === 'one') {
    let m2; do { m2 = NZ(-3, 3); } while (m2 === m);
    return howMany(cases(first, `y = ${linTex(m2, NZ(-6, 6))}`), kind, [`לשני הישרים שיפועים שונים, $${T(m)}$ ו־$${T(m2)}$, ולכן הם נפגשים בנקודה אחת בדיוק.`]);
  }
  if (kind === 'none') {
    let b2; do { b2 = b + NZ(-5, 5); } while (b2 === b || b2 === 0);
    if (Math.random() < 0.5) return howMany(cases(first, `y = ${linTex(m, b2)}`), kind, [`משווים: $${linTex(m, b)} = ${linTex(m, b2)}$. מחסירים $${linTex(m, 0)}$ משני האגפים: $${T(b)} = ${T(b2)}$, וזה לא נכון.`, 'לשני הישרים אותו שיפוע וחיתוך שונה עם ציר $y$: הם מקבילים ולא נפגשים. אין פתרון.']);
    return howMany(cases(first, `${pq(k * m, -k)} = ${T(-k * b2)}`), kind, [`מציבים $y = ${linTex(m, b)}$ במשוואה השנייה: $${linTex(k * m, 0)} ${-k < 0 ? '-' : '+'} ${abs(k)}(${linTex(m, b)}) = ${T(-k * b2)}$`, `פותחים סוגריים: $${T(-k * b)} = ${T(-k * b2)}$, וזה לא נכון. אין אף זוג שמקיים את שתיהן: הישרים מקבילים.`]);
  }
  return howMany(cases(first, `${pq(k * m, -k)} = ${T(-k * b)}`), kind, [`מציבים $y = ${linTex(m, b)}$ במשוואה השנייה: $${linTex(k * m, 0)} ${-k < 0 ? '-' : '+'} ${abs(k)}(${linTex(m, b)}) = ${T(-k * b)}$`, `פותחים סוגריים: $${T(-k * b)} = ${T(-k * b)}$, נכון לכל $x$.`, 'המשוואה השנייה היא הראשונה בכתיבה אחרת: זה אותו ישר, וכל נקודה עליו היא פתרון. אינסוף פתרונות.']);
}

// ================================================================ 3. equal coefficients (השוואת מקדמים)
// The curriculum: "על ידי הבאה למקדמים שווים – השוואת מקדמים או הנגדת מקדמים", and "יש לזהות את מספר הפתרונות
// שיש למערכת: 0, 1 או אינסוף".

/**
 * Two equations in which one unknown (gone) goes: its coefficients are equal (k 0: subtract), opposite (k 1: add),
 * or those of the second are mult times those of the first (k 2: multiply the first, then subtract or add).
 * Rows are [coefficient of x, coefficient of y, constant]. When subtracting, the row with the larger remaining
 * coefficient is on top (top: 1 or 2), so the result is positive, as a student would choose.
 */
export function elimDraw(rnd) {
  for (;;) {
    const u = rnd(); const k = u < 0.4 ? 0 : u < 0.72 ? 1 : 2;
    const x = rnz(rnd, -7, 7); const y = rnz(rnd, -7, 7); if (abs(x - y) < 2) continue;
    const gone = rnd() < 0.3 ? 'x' : 'y';
    const g1 = rint(rnd, 1, 5) * (rnd() < 0.3 ? -1 : 1); // the coefficient of the unknown that goes, in the first row
    const mul = k === 2 ? rint(rnd, 2, 3) : 1;
    const g2 = k === 0 ? g1 : k === 1 ? -g1 : (rnd() < 0.5 ? 1 : -1) * mul * g1;
    const a1 = rnz(rnd, -6, 6); const a2 = rnz(rnd, -6, 6); // the coefficients of the unknown that stays
    // the unknown that stays offers no second easy way (equal, opposite or a simple multiple), so the way the worked
    // solution goes is the way a student goes, and an error is read along that way
    if ([1, 2, 3].some((m) => abs(a2) === m * abs(a1) || abs(a1) === m * abs(a2))) continue;
    const sub = mul * g1 === g2;
    const coef = sub ? mul * a1 - a2 : mul * a1 + a2;
    if (coef === 0) continue;
    const [kv, gv] = gone === 'y' ? [x, y] : [y, x];
    const c1 = a1 * kv + g1 * gv; const c2 = a2 * kv + g2 * gv;
    if (abs(c1) > 40 || abs(c2) > 40 || abs(mul * c1) > 60) continue;
    const row = (a, g, c) => (gone === 'y' ? [a, g, c] : [g, a, c]);
    return { k, x, y, gone, mul, sub, top: !sub || coef > 0 ? 1 : 2, r1: row(a1, g1, c1), r2: row(a2, g2, c2), a1, a2, g1, g2, c1, c2 };
  }
}
export const rowTex = ([p, q, c]) => `${pq(p, q)} = ${T(c)}`;
export const elimShow = (e) => cases(rowTex(e.r1), rowTex(e.r2));
/** What the elimination leaves: the coefficient of the unknown that stays, and the constant. */
export function elimLeft(e) {
  const { mul, sub, top, a1, a2, c1, c2 } = e;
  if (!sub) return { coef: mul * a1 + a2, c: mul * c1 + c2 };
  return top === 1 ? { coef: mul * a1 - a2, c: mul * c1 - c2 } : { coef: a2 - mul * a1, c: c2 - mul * c1 };
}
/**
 * Subtracting only part of an equation: its constant added instead of subtracted. The pair it leads to, through the
 * first row, subtracting the way the worked solution does (the coefficient left positive); `other` subtracts the other
 * way round, which a student may also choose, and gives the opposite value.
 */
export function elimMinusBracket(e, other = false) {
  if (!e.sub) return null;
  const { coef } = elimLeft(e); const c = e.mul * e.c1 + e.c2;
  // whichever is subtracted from which, the constants are added instead: their sum (after multiplying)
  const kv = c / (other ? -coef : coef);
  const gv = (e.c1 - e.a1 * kv) / e.g1;
  return e.gone === 'y' ? [kv, gv] : [gv, kv];
}
export function elimSolution(e) {
  const { k, x, y, gone, mul, sub, top, r1, r2, a1, g1, c1 } = e;
  const keep = gone === 'y' ? 'x' : 'y'; const [kv, gv] = gone === 'y' ? [x, y] : [y, x];
  const { coef, c } = elimLeft(e);
  const m1 = r1.map((v) => v * mul);
  const lines = [];
  if (k === 2) lines.push(`כופלים את המשוואה הראשונה ב־$${mul}$, כל איבר: $${rowTex(m1)}$. עכשיו המקדמים של $${gone}$ ${sub ? 'שווים' : 'נגדיים'}.`);
  const one = k === 2 ? 'המשוואה החדשה' : 'הראשונה';
  if (!sub) lines.push(`מחברים את ${one} ואת השנייה: $${gone}$ נעלם. $${linTex(coef, 0, keep)} = ${T(c)}$`);
  else lines.push(`מחסרים ${top === 1 ? `מ${one} את השנייה` : `מהשנייה את ${one}`}, כל אגף וכל איבר: $${gone}$ נעלם. $${linTex(coef, 0, keep)} = ${T(c)}$`);
  if (coef !== 1) lines.push(`$${keep} = ${T(kv)}$`);
  lines.push(`מציבים $${keep} = ${T(kv)}$ במשוואה הראשונה: $${sumTex([[a1 * kv, ''], [g1, gone]])} = ${T(c1)}$, ולכן $${gone} = ${T(gv)}$`);
  lines.push(`בדיקה בשנייה: $${combo(r2[0], x, r2[1], y)} = ${T(r2[2])}$. הפתרון: $${pairTex(x, y)}$`);
  return lines;
}
export const elimHint = (e) => (e.k === 2 ? `המקדמים של $${e.gone}$ לא שווים ולא נגדיים. כופלים קודם משוואה אחת, כל אגף וכל איבר, כך שיהיו.`
  : e.sub ? `למקדמים של $${e.gone}$ אותו מספר: מחסרים את המשוואות, כל אגף וכל איבר.` : `המקדמים של $${e.gone}$ נגדיים: מחברים את המשוואות.`);
function elimItem() {
  const e = elimDraw(rnd0); const bad = elimMinusBracket(e); const bad2 = elimMinusBracket(e, true); const i = e.gone === 'y' ? 0 : 1; // the coordinate found first
  const right = [e.x, e.y][i];
  return {
    key: `sy3:${elimShow(e)}`, text: 'פתרו את מערכת המשוואות.', display: elimShow(e), form: 'pt', label: '', answer: [e.x, e.y],
    hint: elimHint(e), solution: elimSolution(e),
    // the constants added instead of subtracted, whichever equation was subtracted from which
    diag: (u) => (isSwap(u, e.x, e.y) ? 'swap' : Array.isArray(u) && bad ? diagOf(right, { 'minus-bracket': bad[i] })(u[i]) || diagOf(right, { 'minus-bracket': bad2[i] })(u[i]) : null),
  };
}

/** What makes the unknown go? Four moves, exactly one of which makes its coefficient 0 (the critique: never two choices). */
function methodItem() {
  const e = elimDraw(rnd0); const M = e.k === 2 ? e.mul : rint(rnd0, 2, 3);
  // a choice is plain text (no maths inside), so the number is written as a digit
  const moves = [['מחברים את המשוואות', e.g1 + e.g2], ['מחסרים את המשוואות', e.g1 - e.g2], [`כופלים את הראשונה ב־${M}, ואז מחברים`, M * e.g1 + e.g2], [`כופלים את הראשונה ב־${M}, ואז מחסרים`, M * e.g1 - e.g2]];
  const choices = shuffle(moves.map(([t, left]) => ({ ...txt(t), ok: left === 0 })));
  const right = moves.find(([, left]) => left === 0)[0].replace(/ב־(\d)/, 'ב־$$$1$$');
  const zero = `${e.k === 2 ? `${M} \\cdot ${T(e.g1, true)}` : T(e.g1)} ${e.sub ? '-' : '+'} ${T(e.g2, true)} = 0`;
  return {
    key: `sy3m:${elimShow(e)}`, text: `מה עושים כדי ש־$${e.gone}$ ייעלם?`, display: elimShow(e), form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
    hint: `מסתכלים על המקדמים של $${e.gone}$: $${T(e.g1)}$ ו־$${T(e.g2)}$. מקדמים שווים מחסרים, נגדיים מחברים, ואם אין כאלה, כופלים קודם.`,
    solution: [`${right}: המקדם של $${e.gone}$ נעשה $${zero}$.`, ...elimSolution(e).slice(0, e.k === 2 ? 2 : 1)],
    diag: () => null,
  };
}

/** How many solutions, both equations as ax + by = c: one a multiple of the other (every point or none), or one point. */
function howMany3() {
  const kind = pick(['one', 'none', 'all']);
  if (kind === 'one') { const e = elimDraw(rnd0); return howMany(elimShow(e), kind, [...elimSolution(e).slice(0, -1), `יש פתרון אחד: $${pairTex(e.x, e.y)}$.`]); }
  const a = NZ(-5, 5); const b = NZ(-5, 5); const c = NZ(-9, 9); const k = pick([2, 3, -2]);
  let d = k * c; if (kind === 'none') d += NZ(-6, 6);
  const first = rowTex([a, b, c]); const second = rowTex([k * a, k * b, d]);
  const times = `כופלים את $${first}$ ב־$${k}$, כל איבר: $${rowTex([k * a, k * b, k * c])}$.`;
  return howMany(Math.random() < 0.5 ? cases(first, second) : cases(second, first), kind, kind === 'all'
    ? [times, 'זו בדיוק המשוואה השנייה. כל זוג שמקיים את האחת מקיים גם את השנייה: זה אותו ישר, ויש אינסוף פתרונות.']
    : [times, `אגף שמאל כמו במשוואה השנייה, ובאגף ימין $${T(k * c)}$ במקום $${T(d)}$. מחסרים ומקבלים $0 = ${T(d - k * c)}$, וזה לא נכון. אין פתרון: הישרים מקבילים.`]);
}

// ================================================================ 4. two unknowns from a story (בעיות עם שני נעלמים)
// The curriculum: "יש לשלב שאלות מילוליות ואורייניות המחייבות פתרון מערכת של שתי משוואות קוויות בשני נעלמים";
// its examples: two numbers whose sum is 127 and difference 47; towels and sheets at the laundry, with 20% off.

/**
 * x + y = n and px + qy = M: tickets (adults x at p, children y at q) or coins (x of p, y of q); heads and legs
 * (rabbits x with 4 legs, chickens y with 2). s is the story; ask 0 the first unknown, 1 the second. In the worked
 * solution the second unknown is written n − x and substituted.
 */
export function storyDraw(rnd, kinds = ['tickets', 'coins', 'legs']) {
  for (;;) {
    const s = rpick(rnd, kinds);
    let p; let q; let n; let x;
    if (s === 'tickets') { p = rpick(rnd, [30, 35, 40, 45, 50]); q = rpick(rnd, [15, 20, 25].filter((v) => v < p)); n = rint(rnd, 8, 20); x = rint(rnd, 2, n - 2); }
    else if (s === 'coins') { [p, q] = rpick(rnd, [[5, 2], [10, 5], [10, 2]]); n = rint(rnd, 8, 25); x = rint(rnd, 2, n - 2); }
    else { p = 4; q = 2; n = rint(rnd, 10, 30); x = rint(rnd, 2, n - 2); }
    const y = n - x; if (abs(x - y) < 2) continue;
    return { s, p, q, n, x, y, M: p * x + q * y, ask: rint(rnd, 0, 1) };
  }
}
const STORY = {
  tickets: {
    text: ({ p, q, n, M, ask }) => `להצגה נמכרו $${n}$ כרטיסים: למבוגרים ב־$${p}$ ₪ ולילדים ב־$${q}$ ₪. הקופה קיבלה $${M}$ ₪. כמה כרטיסים ${ask ? 'לילדים' : 'למבוגרים'} נמכרו?`,
    names: ['מספר הכרטיסים למבוגרים', 'מספר הכרטיסים לילדים'], count: 'כרטיסים', unit: 'כרטיסים',
  },
  coins: {
    text: ({ p, q, n, M, ask }) => `בקופה $${n}$ מטבעות של $${p}$ ₪ ושל $${q}$ ₪, ובסך הכול $${M}$ ₪. כמה מטבעות של $${ask ? q : p}$ ₪ יש בקופה?`,
    names: ['מספר המטבעות של $P$ ₪', 'מספר המטבעות של $Q$ ₪'], count: 'מטבעות', unit: 'מטבעות',
  },
  legs: {
    text: ({ n, M, ask }) => `בחצר ארנבים ותרנגולות. יש להם יחד $${n}$ ראשים ו־$${M}$ רגליים. כמה ${ask ? 'תרנגולות' : 'ארנבים'} יש בחצר?`,
    names: ['מספר הארנבים', 'מספר התרנגולות'], count: 'ראשים', unit: null,
  },
};
const storyName = (st, i) => STORY[st.s].names[i].replace('$P$', `$${st.p}$`).replace('$Q$', `$${st.q}$`);
export const storyText = (st) => STORY[st.s].text(st);
export const storyAnswer = (st) => (st.ask ? st.y : st.x);
export const storyUnit = (st) => STORY[st.s].unit;
/** q(n − x) opened as qn − x: (p − 1)x = M − qn. The value it gives for what was asked. */
export const storyPartial = ({ p, q, n, M, ask }) => { const x = (M - q * n) / (p - 1); return ask ? n - x : x; };
export const storyHint = (st) => `נסמנו ב־$x$ את ${storyName(st, 0)} וב־$y$ את ${storyName(st, 1)}. משפט אחד סופר ${STORY[st.s].count}, ומשפט שני סופר ${st.s === 'legs' ? 'רגליים' : 'כסף'}.${st.ask ? ' ובסוף: על מה שאלו?' : ''}`;
export function storySolution(st) {
  const { s, p, q, n, M, x, y, ask } = st;
  return [
    `נסמן ב־$x$ את ${storyName(st, 0)} וב־$y$ את ${storyName(st, 1)}: $x + y = ${n}$, וגם $${p}x + ${q}y = ${M}$.`,
    `מהראשונה $y = ${n} - x$. מציבים בשנייה, בסוגריים: $${p}x + ${q}(${n} - x) = ${M}$`,
    `פותחים סוגריים: $${p}x + ${q * n} - ${q}x = ${M}$, כלומר $${linTex(p - q, 0)} = ${M - q * n}$, ולכן $x = ${x}$.`,
    `$y = ${n} - ${x} = ${y}$.`,
    `בדיקה בסיפור: $${x} + ${y} = ${n}$, ו־$${p} \\cdot ${x} + ${q} \\cdot ${y} = ${M}$${s === 'legs' ? ' רגליים' : ' ₪'}.`,
    `${ask ? `שאלו על ${storyName(st, 1)}` : `שאלו על ${storyName(st, 0)}`}: $${ask ? y : x}$.`,
  ];
}
function storyItem() {
  const st = storyDraw(rnd0);
  return {
    key: `sy4:${st.s}:${st.p}:${st.q}:${st.n}:${st.M}:${st.ask}`, text: storyText(st), form: 'num', answer: storyAnswer(st), unit: storyUnit(st),
    hint: storyHint(st), solution: storySolution(st),
    diag: diagOf(storyAnswer(st), { 'wrong-unknown': st.ask ? st.x : st.y, 'partial-dist': storyPartial(st) }),
  };
}

/** The curriculum's: two numbers whose sum is 127 and difference 47. */
function sumDiffItem() {
  for (;;) {
    const a = rint(rnd0, 12, 140); const b = rint(rnd0, 3, a - 3); if (a - b < 4) continue;
    const s = a + b; const d = a - b; const q = rint(rnd0, 0, 1);
    return {
      key: `sy4s:${s}:${d}:${q}`, text: `סכום של שני מספרים הוא $${s}$, וההפרש ביניהם $${d}$. מה המספר ה${q ? 'קטן' : 'גדול'}?`, form: 'num', answer: q ? b : a,
      hint: 'נסמנו את הגדול ב־$x$ ואת הקטן ב־$y$: $x + y$ הוא הסכום ו־$x - y$ ההפרש. מחברים את שתי המשוואות.',
      solution: [`$x + y = ${s}$, וגם $x - y = ${d}$.`, `מחברים: $2x = ${s + d}$, ולכן $x = ${a}$.`, `$y = ${s} - ${a} = ${b}$.`, `בדיקה: $${a} + ${b} = ${s}$, ו־$${a} - ${b} = ${d}$.`],
      diag: diagOf(q ? b : a, { 'wrong-unknown': q ? a : b }),
    };
  }
}

/** The curriculum's laundry: 4 towels and 7 sheets for 29; with 20% off, 5 and 5 for 20. Ask the towel or the sheet. */
function laundryItem() {
  const q = rint(rnd0, 0, 1);
  return {
    key: `sy4l:${q}`, form: 'num', answer: q ? 3 : 2, unit: '₪',
    text: `רות שילמה $29$ ₪ על כביסה של $4$ מגבות ו־$7$ סדינים. במבצע של $20\\%$ הנחה היא שילמה $20$ ₪ על $5$ מגבות ו־$5$ סדינים. מה המחיר הרגיל לכביסה של ${q ? 'סדין' : 'מגבת'}?`,
    hint: 'נסמנו ב־$x$ את המחיר הרגיל למגבת וב־$y$ לסדין. במבצע משלמים $80\\%$ מהמחיר הרגיל.',
    solution: ['$4x + 7y = 29$, ובמבצע $0.8(5x + 5y) = 20$.', 'מחלקים את השנייה ב־$0.8$: $5x + 5y = 25$, ואחר כך ב־$5$: $x + y = 5$.', 'מציבים $y = 5 - x$: $4x + 7(5 - x) = 29$, כלומר $35 - 3x = 29$, ולכן $x = 2$ ו־$y = 3$.', 'בדיקה: $4 \\cdot 2 + 7 \\cdot 3 = 29$, ו־$0.8(5 \\cdot 2 + 5 \\cdot 3) = 20$.', `${q ? 'סדין' : 'מגבת'}: $${q ? 3 : 2}$ ₪.`],
    diag: diagOf(q ? 3 : 2, { 'wrong-unknown': q ? 2 : 3 }),
  };
}

/** Which system fits the story? The money equation with the prices swapped and the totals mixed are the others. */
function pickSystem() {
  for (;;) {
    const st = storyDraw(rnd0, ['tickets', 'coins']); const { p, q, n, M, x, y } = st;
    const opts = [[`x + y = ${n},\\; ${p}x + ${q}y = ${M}`, true], [`x + y = ${n},\\; ${q}x + ${p}y = ${M}`], [`x + y = ${M},\\; ${p}x + ${q}y = ${n}`], [`${p}x + ${q}y = ${n},\\; x + y = ${M}`]];
    const both = (t) => t.split(',\\;').every((e) => holds(e, { x, y }));
    if (opts.filter(([t]) => both(t)).length !== 1 || !both(opts[0][0])) continue;
    const choices = shuffle(opts.map(([t, ok]) => ({ ...tex(t), ok: ok === true })));
    const who = st.s === 'tickets' ? `$x$ מספר הכרטיסים למבוגרים ו־$y$ לילדים` : `$x$ מספר המטבעות של $${p}$ ₪ ו־$y$ של $${q}$ ₪`;
    const story = st.s === 'tickets' ? `להצגה נמכרו $${n}$ כרטיסים: למבוגרים ב־$${p}$ ₪ ולילדים ב־$${q}$ ₪. הקופה קיבלה $${M}$ ₪.` : `בקופה $${n}$ מטבעות של $${p}$ ₪ ושל $${q}$ ₪, ובסך הכול $${M}$ ₪.`;
    return {
      key: `sy4p:${st.s}:${p}:${q}:${n}:${M}`, text: `${story} ${who}. איזו מערכת מתאימה?`, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
      hint: `משוואה אחת סופרת ${st.s === 'tickets' ? 'כרטיסים' : 'מטבעות'}, והשנייה סופרת שקלים. כל מחיר כופל את מה שהוא המחיר שלו.`,
      solution: [`סופרים ${st.s === 'tickets' ? 'כרטיסים' : 'מטבעות'}: $x + y = ${n}$. סופרים שקלים: $${p}x + ${q}y = ${M}$.`, `בדיקה: הפתרון הוא $x = ${x}$ ו־$y = ${y}$, ו־$${p} \\cdot ${x} + ${q} \\cdot ${y} = ${M}$.`],
      diag: () => null,
    };
  }
}

// ================================================================ 5. inequalities (אי־שוויונות)
// The curriculum: build an inequality from words, check whether a number solves it, solve it algebraically and on
// the number line, "אי השוויון הופך כיוון כתוצאה של כפל או חילוק במספר שלילי", strict and weak (<, >, ≤, ≥), and
// the common range of two inequalities.

export const REL = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' };
export const FLIP = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' };
export const TOGGLE = { '<': '<=', '<=': '<', '>': '>=', '>=': '>' };
export const relHas = (rel, n, B) => (rel === '<' ? n < B : rel === '<=' ? n <= B : rel === '>' ? n > B : n >= B);
/** The ray of x rel B. */
export const rayOf = (rel, B) => ({ at: B, dir: rel[0] === '>' ? 1 : -1, closed: rel.length === 2 });

/**
 * A linear inequality with the boundary B: form 0 ax + b rel c, form 1 b − |a|x rel c (the minus hidden after the
 * number), form 2 ax + b rel dx + e (the unknown on both sides). A is the coefficient once x is on one side; the
 * solution is x rel' B, rel' reversed when A < 0. half: B may be a half (only for counting, never for the ray).
 */
export function ineqDraw(rnd, { half = false, strict = null, forms = [0, 0, 1, 2] } = {}) {
  for (;;) {
    let form = rpick(rnd, forms);
    const A = rint(rnd, 2, 6) * (rnd() < 0.5 ? -1 : 1);
    if (form === 1 && A > 0) form = 0;
    const B = half && rnd() < 0.3 ? rint(rnd, -6, 5) + 0.5 : rint(rnd, -7, 7);
    if (!Number.isInteger(A * B)) continue;
    const rel = strict === true ? rpick(rnd, ['<', '>']) : rpick(rnd, ['<', '<=', '>', '>=']);
    const b = rnz(rnd, -12, 12);
    let a = A; let d = 0;
    if (form === 2) { a = rnz(rnd, -6, 6); d = a - A; if (d === 0 || abs(d) > 6) continue; }
    const e = A * B + b; // ax + b rel dx + e, with d = 0 for forms 0 and 1 (c = e)
    if (abs(e) > 40) continue;
    const left = form === 1 ? sumTex([[b, ''], [a, 'x']]) : linTex(a, b);
    const right = form === 2 ? linTex(d, e) : T(e);
    const show = `${left} ${REL[rel]} ${right}`;
    return { form, a, b, d, e, A, B, rel, sol: A > 0 ? rel : FLIP[rel], show, minus: show.includes('-') };
  }
}
/** The worked solution down to x rel' B. */
export function ineqSteps({ form, a, b, d, e, A, B, rel, sol }) {
  const lines = [];
  if (form === 2) lines.push(`${d > 0 ? `מחסירים $${linTex(d, 0)}$ משני האגפים` : `מוסיפים $${linTex(-d, 0)}$ לשני האגפים`}: $${linTex(A, b)} ${REL[rel]} ${T(e)}$`);
  lines.push(`${undo(b)}: $${linTex(A, 0)} ${REL[rel]} ${T(e - b)}$`);
  lines.push(A > 0 ? `מחלקים את שני האגפים ב־$${A}$, מספר חיובי, והכיוון נשאר: $x ${REL[sol]} ${num(B)}$`
    : `מחלקים את שני האגפים ב־$${A}$, מספר שלילי, ולכן הופכים את הכיוון: $x ${REL[sol]} ${num(B)}$`);
  return lines;
}
/** The value of the left side at v, and of the right side, for a check by substitution. */
export const ineqSides = ({ form, a, b, d, e }, v) => ({
  lt: form === 1 ? `${T(b)} ${a < 0 ? '-' : '+'} ${abs(a) === 1 ? T(v, true) : `${abs(a)} \\cdot ${T(v, true)}`}` : at(a, b, v), lv: a * v + b,
  rt: form === 2 ? at(d, e, v) : T(e), rv: d * v + e,
});
export const ineqHint = (q) => (q.A < 0 ? 'פותרים כמו משוואה. כשמחלקים במספר שלילי, הופכים את כיוון אי־השוויון.' : 'פותרים כמו משוואה. מחלקים במספר חיובי? הכיוון נשאר, גם אם יש מינוס באגף השני.');
/** The boundary when b moves to the other side without changing sign (form 0 and 1 only). */
const movedB = (q) => (q.form === 2 ? null : (q.e + q.b) / q.A);

function rayItem() {
  const q = ineqDraw(rnd0); const answer = rayOf(q.sol, q.B);
  const start0 = { at: 0, dir: 1, closed: false };
  const start = answer.at === 0 && answer.dir === 1 && !answer.closed ? { at: 0, dir: -1, closed: false } : start0;
  const mB = movedB(q);
  return {
    // the inequality is in the question line, not a display panel of its own: on a 320x568 phone the ray, its toggles
    // and the retry hint then stay in view after a mistake; `ineq` keeps it for the checks
    key: `sy5r:${q.show}`, text: `סמנו על ציר המספרים את כל הפתרונות של $${q.show}$.`, ineq: q.show, form: 'manip',
    manip: { kind: 'ray', min: -10, max: 10, start }, answer,
    hint: ineqHint(q),
    solution: [...ineqSteps(q), `על הציר: עיגול ${answer.closed ? 'מלא' : 'ריק'} ב־$${T(q.B)}$ וקרן ${answer.dir > 0 ? 'ימינה' : 'שמאלה'}.`],
    diag: (u) => {
      if (!u || typeof u !== 'object') return null;
      const sameEnd = !!u.closed === answer.closed;
      if (u.at === q.B && u.dir === -answer.dir && sameEnd) return q.A < 0 ? 'no-flip' : q.minus ? 'over-flip' : null;
      if (u.at === q.B && u.dir === answer.dir && !sameEnd) return 'boundary';
      if (mB != null && mB !== q.B && Number.isInteger(mB) && u.at === mB && u.dir === answer.dir && sameEnd) return 'move-no-flip';
      return null;
    },
  };
}

/**
 * How many of six whole numbers in a row solve it? (The critique's table instead of a count from −10 to 10: each
 * number is checked on its own, so a miscount is not a misconception.) The predictions: the direction not reversed
 * (no-flip, A < 0), reversed for a minus elsewhere (over-flip, A > 0 with a minus shown), the boundary taken or left.
 */
export function countDraw(rnd) {
  for (;;) {
    const q = ineqDraw(rnd, { half: true });
    const lo = Math.ceil(q.B) - rint(rnd, 1, 4); const list = [0, 1, 2, 3, 4, 5].map((i) => lo + i);
    if (!(list[0] < q.B && q.B < list[5])) continue;
    const p = { ...q, list };
    const ans = countAnswer(p); if (ans < 1 || ans > 5) continue;
    const bugs = Object.values(countBugs).map((f) => f(p)).filter((v) => v != null);
    if (new Set([ans, ...bugs]).size !== bugs.length + 1) continue;
    return p;
  }
}
const countWith = (list, rel, B) => list.filter((n) => relHas(rel, n, B)).length;
export const countAnswer = (p) => countWith(p.list, p.sol, p.B);
export const countBugs = {
  'no-flip': (p) => (p.A < 0 ? countWith(p.list, p.rel, p.B) : null),
  'over-flip': (p) => (p.A > 0 && p.minus ? countWith(p.list, FLIP[p.rel], p.B) : null),
  boundary: (p) => (Number.isInteger(p.B) ? countWith(p.list, TOGGLE[p.sol], p.B) : null),
};
export const countText = (p) => `כמה מהמספרים ${listMath(p.list)} פותרים את אי־השוויון?`;
export function countSolution(p) {
  const yes = p.list.filter((n) => relHas(p.sol, n, p.B));
  const edge = Number.isInteger(p.B) ? (relHas(p.sol, p.B, p.B) ? ` גם $${T(p.B)}$ עצמו פותר, כי ב־$${REL[p.sol]}$ השוויון כלול.` : ` $${T(p.B)}$ עצמו לא פותר, כי ב־$${REL[p.sol]}$ השוויון לא כלול.`) : '';
  return [...ineqSteps(p), `מהמספרים ברשימה פותרים ${listMath(yes)}.${edge}`, `סך הכול: $${yes.length}$.`];
}
function countItem() {
  const p = countDraw(rnd0); const ans = countAnswer(p);
  return {
    key: `sy5c:${p.show}:${p.list[0]}`, text: countText(p), display: p.show, form: 'num', answer: ans, among: p.list,
    hint: `${ineqHint(p)} אחר כך בודקים כל מספר ברשימה, גם את הקצה.`,
    solution: countSolution(p), diag: diagOf(ans, Object.fromEntries(Object.entries(countBugs).map(([id, f]) => [id, f(p)]))),
  };
}

/** Which number solves it? Strict inequalities: the boundary itself, the other side, and one more that does not. */
function memberItem() {
  for (;;) {
    const q = ineqDraw(rnd0, { strict: true }); const s = rayOf(q.sol, q.B).dir;
    const r = q.B + s * rint(rnd0, 1, 4); const w1 = q.B - s * rint(rnd0, 1, 3); const w2 = q.B - s * rint(rnd0, 4, 6);
    const all = [[r, true], [q.B, 'boundary'], [w1, q.A < 0 ? 'no-flip' : q.minus ? 'over-flip' : null], [w2, null]];
    if (all.some(([v]) => abs(v) > 12)) continue;
    // exactly the first one solves, as displayed
    if (all.filter(([v]) => holds(q.show, { x: v })).length !== 1 || !holds(q.show, { x: r })) continue;
    const choices = shuffle(all.map(([v, tag]) => ({ ...tex(T(v)), ok: tag === true, bug: typeof tag === 'string' ? tag : undefined })));
    const { lt, lv, rt, rv } = ineqSides(q, r);
    const check = q.form === 2 ? `$${lt} = ${lv}$ ו־$${rt} = ${rv}$, ו־$${lv} ${REL[q.rel]} ${rv}$ נכון` : `$${lt} = ${lv}$, ו־$${lv} ${REL[q.rel]} ${rv}$ נכון`;
    return {
      key: `sy5m:${q.show}:${w1}:${w2}:${r}`, text: 'איזה מהמספרים פותר את אי־השוויון? בדקו בהצבה.', display: q.show, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
      hint: 'מציבים כל מספר בשני האגפים, ובודקים אם אי־השוויון נכון. ואפשר גם לפתור קודם.',
      solution: [...ineqSteps(q), `$x = ${T(r)}$ פותר: ${check}.`, `$x = ${T(q.B)}$ לא פותר: שני האגפים יוצאים שווים, ו־$${REL[q.rel]}$ לא כולל שוויון.`],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

/** From words to an inequality ("לכל היותר" includes the limit; the curriculum's model planes keep their own distractors). */
function buildItem() {
  const kind = rint(rnd0, 0, 2);
  let text; let opts; let sol;
  if (kind === 0) {
    const W = pick([400, 500, 600, 800]); const P = R5(60, 95); const w = pick([15, 20, 25, 30]);
    text = `מעלית מעמיסה לכל היותר $${W}$ ק״ג. אדם ששוקל $${P}$ ק״ג עולה איתה עם ארגזים של $${w}$ ק״ג כל אחד. $n$ הוא מספר הארגזים. איזה אי־שוויון מתאים?`;
    opts = [[`${P} + ${w}n \\le ${W}`, true], [`${P} + ${w}n < ${W}`, 'boundary'], [`${P} + ${w}n \\ge ${W}`], [`${P}n + ${w} \\le ${W}`]];
    sol = [`המשקל: האדם ועוד $n$ ארגזים, $${P} + ${w}n$.`, `"לכל היותר $${W}$" פירושו $${W}$ או פחות: $\\le$, כולל $${W}$ עצמו.`];
  } else if (kind === 1) {
    const tA = rint(rnd0, 4, 7); const tB = rint(rnd0, 2, tA - 1); const T0 = pick([40, 50, 60]);
    text = `דרושות לאריאל $${tA}$ דקות כדי לבנות טיסן מדגם א׳ ו־$${tB}$ דקות לטיסן מדגם ב׳. יש לו $${T0}$ דקות. $a$ מספר הטיסנים מדגם א׳ ו־$b$ מדגם ב׳. איזה אי־שוויון בודק אם יש לו מספיק זמן?`;
    opts = [[`${tA}a + ${tB}b \\le ${T0}`, true], [`${tB}a + ${tA}b \\le ${T0}`], [`a + b \\le ${T0}`], [`a + b + ${tA + tB} \\le ${T0}`]];
    sol = [`$a$ טיסנים מדגם א׳ לוקחים $${tA}a$ דקות, ו־$b$ מדגם ב׳ לוקחים $${tB}b$ דקות.`, `כל הזמן יחד צריך להיות לכל היותר $${T0}$: $${tA}a + ${tB}b \\le ${T0}$.`];
  } else {
    const G = pick([56, 60, 70, 75]); const b0 = pick([10, 12, 15]); const w = pick([4, 5, 6]);
    text = `במשחק מקבלים $${b0}$ נקודות בונוס ועוד $${w}$ נקודות לכל תשובה נכונה. כדי לעבור שלב צריך לפחות $${G}$ נקודות. $n$ מספר התשובות הנכונות. איזה אי־שוויון מתאים?`;
    opts = [[`${b0} + ${w}n \\ge ${G}`, true], [`${b0} + ${w}n > ${G}`, 'boundary'], [`${b0} + ${w}n \\le ${G}`], [`${b0}n + ${w} \\ge ${G}`]];
    sol = [`הנקודות: $${b0} + ${w}n$.`, `"לפחות $${G}$" פירושו $${G}$ או יותר: $\\ge$, כולל $${G}$ עצמו.`];
  }
  const choices = shuffle(opts.map(([t, tag]) => ({ ...tex(t), ok: tag === true, bug: typeof tag === 'string' ? tag : undefined })));
  return {
    key: `sy5b:${opts[0][0]}`, text, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
    hint: 'כתבו קודם ביטוי למה שמשתנה. אחר כך: "לכל היותר" הוא $\\le$, ו"לפחות" הוא $\\ge$. שניהם כוללים את הגבול.',
    solution: sol, diag: (u) => choices[u]?.bug || null,
  };
}
function R5(a, b) { return 5 * rint(rnd0, Math.ceil(a / 5), Math.floor(b / 5)); }

/**
 * "At most": the largest whole n with P + w·n ≤ W, floor((W − P)/w). The prediction: P moved over keeping its sign
 * (move-no-flip, floor((W + P)/w)).
 */
export function atMostDraw(rnd) {
  for (;;) {
    const s = rint(rnd, 0, 2);
    const w = s === 0 ? rpick(rnd, [15, 20, 25, 30]) : rint(rnd, 3, 8);
    const P = s === 0 ? 5 * rint(rnd, 12, 19) : rint(rnd, 5, 15);
    const W = s === 0 ? rpick(rnd, [400, 450, 500, 600, 700]) : s === 1 ? rpick(rnd, [40, 45, 50, 60]) : rpick(rnd, [30, 40, 50, 60]);
    const n = Math.floor((W - P) / w); if (n < 2) continue;
    return { s, w, P, W, n };
  }
}
const AT_MOST = [
  ({ W, P, w }) => `מעלית מעמיסה לכל היותר $${W}$ ק״ג. אדם ששוקל $${P}$ ק״ג עולה איתה עם ארגזים של $${w}$ ק״ג כל אחד. כמה ארגזים לכל היותר הוא יכול להעלות?`,
  ({ W, P, w }) => `לאריאל יש $${W}$ דקות. $${P}$ דקות הוא כבר השקיע בהכנות, וכל טיסן לוקח לו $${w}$ דקות לבנות. כמה טיסנים לכל היותר הוא יכול לבנות?`,
  ({ W, P, w }) => `לנועה יש $${W}$ ₪. היא כבר קנתה מחברת ב־$${P}$ ₪, וכל עט עולה $${w}$ ₪. כמה עטים לכל היותר היא יכולה לקנות בכסף שנשאר?`,
];
const UNITS = [['ק״ג', 'ארגזים'], ['דקות', 'טיסנים'], ['₪', 'עטים']];
export const atMostText = (p) => AT_MOST[p.s](p);
// Rounding up (20.8 boxes → 21) is always one more than the answer, which a slip of the hand also gives, so it is
// taught (the discover steps and a worked example) but never diagnosed from a number.
export const atMostBugs = {
  'move-no-flip': (p) => Math.floor((p.W + p.P) / p.w),
};
export function atMostSolution({ s, w, P, W, n }) {
  const q = (W - P) / w; const [u, things] = UNITS[s];
  return [
    `נסמן ב־$n$ את מספר ה${things}: $${P} + ${w}n \\le ${W}$`,
    `מחסירים $${P}$ משני האגפים: $${w}n \\le ${W - P}$`,
    `מחלקים ב־$${w}$: $n \\le ${quotTex(W - P, w)}$`,
    Number.isInteger(q) ? `לכל היותר $${n}$ ${things}.` : `מספר ה${things} שלם: לכל היותר $${n}$. עם $${n + 1}$ כבר יוצא $${P} + ${w} \\cdot ${n + 1} = ${P + w * (n + 1)}$, יותר מ־$${W}$ ${u}.`,
  ];
}
export const atMostHint = () => 'כתבו אי־שוויון: מה שכבר יש, ועוד $n$ פעמים כל אחד, לכל היותר הגבול. בסוף: מספר שלם שלא עובר את הגבול.';
function atMostItem() {
  const p = atMostDraw(rnd0);
  return { key: `sy5w:${p.s}:${p.w}:${p.P}:${p.W}`, text: atMostText(p), form: 'num', answer: p.n, unit: UNITS[p.s][1], hint: atMostHint(), solution: atMostSolution(p), diag: diagOf(p.n, Object.fromEntries(Object.entries(atMostBugs).map(([id, f]) => [id, f(p)]))) };
}

/** The common range of two inequalities (the curriculum's 3x > x − 4 and 2x + 1 < 12 − 2x): how many whole numbers solve both? */
function bothItem() {
  for (;;) {
    const q1 = ineqDraw(rnd0, { forms: [0, 1] }); const q2 = ineqDraw(rnd0, { forms: [0, 1] });
    const up1 = q1.sol[0] === '>'; const up2 = q2.sol[0] === '>';
    if (up1 === up2) continue; // one bounds from below, the other from above
    const [lo, hi] = up1 ? [q1, q2] : [q2, q1];
    const ints = []; for (let n = -40; n <= 40; n += 1) if (relHas(lo.sol, n, lo.B) && relHas(hi.sol, n, hi.B)) ints.push(n);
    if (ints.length < 2 || ints.length > 8) continue;
    // one under the other (side by side, which is "first" reads differently in Hebrew and in maths); the solution
    // names each by itself
    const display = `\\begin{aligned} ${q1.show.replace(/ (<|>|\\le|\\ge) /, ' &$1 ')} \\\\ ${q2.show.replace(/ (<|>|\\le|\\ge) /, ' &$1 ')} \\end{aligned}`;
    const solved = (q) => `$${q.show}$, ולכן $x ${REL[q.sol]} ${num(q.B)}$${q.A < 0 ? ' (חילקנו במספר שלילי והפכנו את הכיוון)' : ''}.`;
    return {
      key: `sy5t:${q1.show}:${q2.show}`, text: 'כמה מספרים שלמים פותרים את שני אי־השוויונות?', display, form: 'num', answer: ints.length, whole: [q1.show, q2.show],
      hint: 'פותרים כל אי־שוויון לבד, ומחפשים את המספרים שנמצאים בשני התחומים. שימו לב לקצוות.',
      solution: [solved(q1), solved(q2), `שניהם יחד: $${num(lo.B)} ${lo.sol === '>' ? '<' : '\\le'} x ${hi.sol === '<' ? '<' : '\\le'} ${num(hi.B)}$, והשלמים שם: ${listMath(ints)}.`, `סך הכול: $${ints.length}$.`],
      diag: () => null,
    };
  }
}

export const SYS = {
  id: 'sys', grade: '8', title: 'משוואות ומערכות', color: 'petrol',
  desc: 'משוואות עם אחוזים, מערכת משוואות בהצבה ובהשוואת מקדמים, בעיות עם שני נעלמים ואי־שוויונות',
  placement: false,
  levels: [
    { title: 'משוואות עם אחוזים', gen: () => { const r = Math.random(); return r < 0.35 ? pctItem() : r < 0.6 ? pctEquation() : r < 0.85 ? togetherItem() : hallsItem(); } },
    { title: 'שיטת ההצבה', gen: () => { const r = Math.random(); return r < 0.42 ? substItem() : r < 0.5 ? levelItem() : r < 0.7 ? whichPair() : r < 0.85 ? meetItem() : howMany2(); } },
    { title: 'השוואת מקדמים', gen: () => { const r = Math.random(); return r < 0.6 ? elimItem() : r < 0.8 ? methodItem() : howMany3(); } },
    { title: 'בעיות עם שני נעלמים', gen: () => { const r = Math.random(); return r < 0.5 ? storyItem() : r < 0.62 ? sumDiffItem() : r < 0.7 ? laundryItem() : pickSystem(); } },
    { title: 'אי־שוויונות', gen: () => { const r = Math.random(); return r < 0.3 ? rayItem() : r < 0.5 ? countItem() : r < 0.7 ? memberItem() : r < 0.8 ? buildItem() : r < 0.9 ? atMostItem() : bothItem(); } },
  ],
  cats: {
    'pct-of-new': 'האחוזים חושבו מהמחיר החדש במקום מהמחיר המקורי',
    'wrong-unknown': 'נמצא נעלם, אבל התשובה לא עונה על מה שנשאל',
    'partial-dist': 'בהצבה רק האיבר הראשון שבסוגריים נכפל',
    'forgot-y': 'נמצא נעלם אחד, והשני לא חושב',
    swap: 'הזוג נכתב הפוך: $y$ במקום $x$',
    'minus-bracket': 'בחיסור משוואות, לא כל המשוואה השנייה חוסרה',
    'no-flip': 'חילקו במספר שלילי ולא הפכו את כיוון אי־השוויון',
    'over-flip': 'הכיוון התהפך בלי כפל או חילוק במספר שלילי',
    boundary: 'התבלבלו בין $<$ ל־$\\le$: האם הקצה עצמו פותר',
    'move-no-flip': 'מספר עבר לאגף השני בלי שהסימן שלו התהפך',
  },
  lesson: {
    points: [
      'הגדלה ב־$20\\%$ היא כפל ב־$1.2$, והנחה של $30\\%$ היא כפל ב־$0.7$. המחיר המקורי הוא $x$: $1.2x = 60$, ולכן $x = 50$.',
      'פתרון של מערכת הוא זוג $(x, y)$ שמקיים את שתי המשוואות, והוא נקודת המפגש של שני הישרים.',
      'הצבה: $y = x + 3$ ו־$2x + y = 12$. מציבים בסוגריים: $2x + (x + 3) = 12$, ולכן $(3, 6)$.',
      'השוואת מקדמים: $x + y = 10$ ו־$x - y = 4$. מחברים: $2x = 14$, ולכן $(7, 3)$.',
      'אי־שוויון פותרים כמו משוואה, והפתרון הוא תחום על ציר המספרים.',
      'כפל או חילוק במספר שלילי הופכים את הכיוון: $-2x > 6$, ולכן $x < -3$.',
    ],
  },
};
