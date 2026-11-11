// Grade 7 (ז׳): equations (משוואות), in the order of the Ministry's programme (March to May): what an equation and
// its solution are, two-step equations, the unknown on both sides, brackets, and word problems; then motion problems
// (eq:6), ח׳ 8.9's (December), which a ז׳ class meets in June (the schedule's motion task). Every worked solution
// ends with a check by substitution ("פתרון מלא כולל בדיקה", curriculum note 7). The balance is practice too: a pan
// loses one item at a time, so keeping it level is the student's own decision (content/manip.js).
// Taught from March, so the first-day placement test skips it (placement: false); grade 8 tests revise equations, so
// Exam Rescue offers it to grade 8 too (alsoFor).
import { R, NZ, pick, shuffle, T, near } from './util.js';
import { linTex, sumTex, bracketTex } from './expr.js';
import { slipOf, slipLike, matchesValue, roundings } from '@/learn/misconceptions.ts';
import { holds } from '@/learn/expr.ts';

const abs = Math.abs;
const tex = (t) => ({ tex: t });
const txt = (t) => ({ text: t });

/** Is u the value v rounded to tenths or to hundredths (v not whole), halves away from zero (−0.75 is −0.8)? */
export const roundsTo = (u, v) => roundings(v).some((r) => near(u, r, 1e-9));
/**
 * The first error whose prediction the answer u matches. A prediction that is the right answer, or that an ordinary
 * slip of the hand also gives (one off, ten off, two digits swapped), names nothing: a slip is not a misconception.
 */
export function diagOf(ans, bugs) {
  return (u) => {
    if (typeof u !== 'number') return null;
    const real = Object.entries(bugs).filter(([, v]) => v != null && Number.isFinite(v) && !near(v, ans) && !slipOf(v, ans));
    const exact = real.find(([, v]) => near(u, v, 1e-6));
    if (exact) return exact[0];
    // a fraction typed rounded to tenths or hundredths (−35/9 as −3.9 or −3.89) names an error only when no other one
    // rounds there too; a number near the prediction that is not its rounding (4.45 for 4.5) names nothing, and nor
    // does a rounding that is also a slip from the answer (418.95 typed 419 for 420): the rule of learn/misconceptions
    const close = [...new Set(real.filter(([, v]) => !Number.isInteger(v) && matchesValue(v, u, ans)).map(([id]) => id))];
    return close.length === 1 ? close[0] : null;
  };
}
/** "Remove b from both sides", in words: b is the number added to the x-term. */
const undo = (b) => (b > 0 ? `מחסירים $${b}$ משני האגפים` : `מוסיפים $${-b}$ לשני האגפים`);
/** a·v + b with v substituted, as TeX in the order a student writes it: 3 \cdot (-2) + 5, -x as -(-2). */
function at(a, b, v) {
  const prod = a === 1 ? T(v) : a === -1 ? `-${T(v, true)}` : `${T(a)} \\cdot ${T(v, true)}`;
  return b === 0 ? prod : `${prod} ${b < 0 ? '-' : '+'} ${abs(b)}`;
}
/** b − |a|·v, the order of b − ax. */
const atRev = (a, b, v) => `${T(b)} ${a < 0 ? '-' : '+'} ${abs(a) === 1 ? T(v, true) : `${abs(a)} \\cdot ${T(v, true)}`}`;

// ---------------------------------------------------------------- 1. an equation and its solution (משוואה ופתרון)
// One step, four forms (x + a, x − a, ax, x : a; the critique adds the last). Documented errors: the number moved to
// the other side with the same operation (move-no-flip: x + 5 = 12 → 17, x : 4 = 3 → 3/4; Hall 2002), the larger
// divided by the smaller (divide-flip: 12x = 3 → 4; Fischbein et al. 1985), the coefficient's minus lost (sign:
// −3x = 12 → 4; Vlassis 2002), and 3x read as 3 + x (sub-coef: 3x = 12 → 9).

function oneStepParams() {
  const u = Math.random(); const k = u < 0.25 ? 0 : u < 0.4 ? 1 : u < 0.8 ? 2 : 3;
  if (k < 2) { const a = R(2, 15); const x = NZ(-12, 12); return { k, a, x, b: k === 0 ? x + a : x - a }; }
  if (k === 2) {
    // a fraction answer a fifth of the time, with small numbers only (1/2, 1/4, 3/4, 2/5, 3/5)
    if (Math.random() < 0.2) { const b = pick([1, 1, 2, 3, -1]); const a = abs(b) === 1 ? pick([2, 4]) : pick([4, 5]); return { k, a, x: b / a, b }; }
    const a = R(2, 9) * (Math.random() < 0.35 ? -1 : 1); const x = NZ(-10, 10); return { k, a, x, b: a * x };
  }
  const a = R(2, 6); const b = NZ(-9, 9); return { k, a, x: a * b, b };
}
const oneStepBugs = ({ k, a, b, x }) => ({
  'move-no-flip': k === 0 ? b + a : k === 1 ? b - a : k === 3 ? b / a : null,
  'divide-flip': k === 2 && abs(a) > abs(b) ? a / b : null,
  sign: k === 2 && a < 0 ? -x : null,
  'sub-coef': k === 2 ? b - a : null,
});
function oneStepItem() {
  const p = oneStepParams(); const { k, a, b, x } = p;
  const mirror = Math.random() < 0.15 && k !== 3;
  const left = k === 0 ? (Math.random() < 0.25 ? `${a} + x` : `x + ${a}`) : k === 1 ? `x - ${a}` : k === 2 ? linTex(a, 0) : (Math.random() < 0.5 ? `x : ${a}` : `\\frac{x}{${a}}`);
  const display = mirror ? `${T(b)} = ${left}` : `${left} = ${T(b)}`;
  const solution = k === 0 ? [`מחסירים $${a}$ משני האגפים: $x = ${T(b)} - ${a}$`, `$x = ${T(x)}$`, `בדיקה: $${T(x)} + ${a} = ${T(b)}$`]
    : k === 1 ? [`מוסיפים $${a}$ לשני האגפים: $x = ${T(b)} + ${a}$`, `$x = ${T(x)}$`, `בדיקה: $${T(x)} - ${a} = ${T(b)}$`]
      : k === 2 ? [`מחלקים את שני האגפים ב־$${T(a)}$: $x = ${T(b)} : ${T(a, true)}$`, `$x = ${T(x)}$`, `בדיקה: $${at(a, 0, x)} = ${T(b)}$`]
        : [`חילוק מבטלים בכפל: כופלים את שני האגפים ב־$${a}$. $x = ${T(b, true)} \\cdot ${a}$`, `$x = ${T(x)}$`, `בדיקה: $${T(x)} : ${a} = ${T(b)}$`];
  const hint = k === 0 ? `מה מבטל את ה"ועוד $${a}$"? עושים את זה לשני האגפים.`
    : k === 1 ? `חיסור של $${a}$ מבטלים בחיבור של $${a}$, בשני האגפים.`
      : k === 2 ? `$${linTex(a, 0)}$ הוא $${T(a)}$ כפול $x$. כפל מבטלים בחילוק, במקדם עם הסימן שלו.`
        : `$x$ מחולק ב־$${a}$. חילוק מבטלים בכפל, בשני האגפים.`;
  return {
    key: `eq1:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x, hint, solution,
    diag: diagOf(x, oneStepBugs(p)),
  };
}

/**
 * Which of these numbers solves it? A solution has a meaning before the student can solve the equation (the
 * curriculum's point), so half the items are equations not taught yet (x² + 6 = 5x, x(x − 3) = 10), the others
 * linear with the errors' answers as the wrong choices. Four choices, exactly one solves.
 */
function whichSolves() {
  for (;;) {
    let display; let right; let lhs; let rhs; let pool;
    const kind = pick(['sq', 'prod', 'lin', 'lin']);
    if (kind === 'sq') {
      // x² + pq = (p + q)x: its solutions are p and q, and only one of them is offered
      const p = R(1, 6); const q = R(1, 6); if (p === q) continue;
      right = pick([p, q]); const other = right === p ? q : p;
      display = `x^2 + ${p * q} = ${p + q}x`;
      lhs = (v) => `${T(v, true)}^2 + ${p * q} = ${v * v + p * q}`; rhs = (v) => `${p + q} \\cdot ${T(v, true)} = ${(p + q) * v}`;
      pool = [p * q, p + q, right + 1, right + 2, right - 1, 10].filter((v) => v !== other);
    } else if (kind === 'prod') {
      // x(x − a) = b with solutions r > 0 and s < 0 (a = r + s, b = −rs)
      const r = R(2, 7); const s = -R(1, r - 1); const a = r + s; const b = -r * s;
      right = r; display = `x(x - ${a}) = ${b}`;
      lhs = (v) => `${T(v, true)} \\cdot (${T(v)} - ${a}) = ${v * (v - a)}`; rhs = () => `${b}`;
      pool = [b, -r, a, r + 1, r + 2, 2 * r].filter((v) => v !== s);
    } else {
      const a = R(2, 7); const c = R(1, 6); if (a === c) continue;
      const x = NZ(-6, 8); const b = NZ(-12, 12); const d = (a - c) * x + b;
      right = x; display = `${linTex(a, b)} = ${linTex(c, d)}`;
      lhs = (v) => `${at(a, b, v)} = ${a * v + b}`; rhs = (v) => `${at(c, d, v)} = ${c * v + d}`;
      // two answers of the errors (the number moved without its sign, the x-term moved without its sign, the division
      // forgotten), and numbers not tied to x: −x and x ± 2 beside x would point at it
      const errs = shuffle([...new Set([(d + b) / (a - c), (d - b) / (a + c), d - b].filter((v) => Number.isInteger(v) && v !== x && abs(v) <= 40))]).slice(0, 2);
      while (errs.length < 3) { const v = R(-8, 10); if (v !== x && v !== -x && abs(v - x) !== 2 && !errs.includes(v)) errs.push(v); }
      pool = shuffle(errs);
    }
    const wrong = [...new Set(pool.filter((v) => v !== right))];
    if (wrong.length < 3) continue;
    const three = kind === 'lin' ? wrong.slice(0, 3) : shuffle(wrong).slice(0, 3);
    const choices = shuffle([{ ...tex(String(right)), ok: true }, ...three.map((v) => tex(String(v)))]);
    const w = three[0];
    const sides = (v) => `$${lhs(v)}$, ובאגף ימין $${rhs(v)}$`;
    return {
      key: `eq1w:${display}:${three.join(',')}`, text: kind === 'lin' ? 'איזה מהמספרים פותר את המשוואה? בדקו בהצבה.' : 'את המשוואה הזאת עוד לא למדנו לפתור, אבל אפשר לבדוק. איזה מהמספרים פותר אותה?',
      display, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
      hint: 'מציבים כל מספר במקום $x$, ומחשבים כל אגף לבד. פתרון הוא מספר ששני האגפים שלו יוצאים שווים.',
      solution: [`$x = ${T(right)}$: באגף שמאל ${sides(right)}. שווים, ולכן $${T(right)}$ פותר את המשוואה.`, `$x = ${T(w)}$: באגף שמאל ${sides(w)}. לא שווים.`],
      diag: () => null,
    };
  }
}

// The Ministry's sample exam: complete the missing number so that x = 4 solves x + □ = 10 and 2x − □ = −4.
function missingItem() {
  const form = pick([0, 0, 1, 2]); // 0: ax − □ = c, 1: ax + □ = c, 2: x + □ = c
  const k = NZ(-9, 9); const box = R(1, 20); const a = form === 2 ? 1 : R(2, 9);
  const c = form === 0 ? a * k - box : a * k + box;
  const op = form === 0 ? '-' : '+';
  const xs = form === 2 ? 'x' : `${a}x`;
  const put = form === 2 ? T(k) : `${a} \\cdot ${T(k, true)}`;
  return {
    key: `eq1m:${form}:${a}:${k}:${box}`, text: `השלימו את המספר החסר כך ש־$x = ${T(k)}$ יהיה הפתרון של המשוואה.`,
    display: `${xs} ${op} \\square = ${T(c)}`, form: 'num', answer: box, checkDisplay: false,
    hint: `מציבים $${T(k)}$ במקום $x$, ושואלים: איזה מספר הופך את זה לשוויון נכון?`,
    solution: [
      `מציבים $x = ${T(k)}$: $${put} ${op} \\square = ${T(c)}$`,
      ...(form === 2 ? [] : [`כלומר $${T(a * k)} ${op} \\square = ${T(c)}$`]),
      form === 0 ? `$\\square = ${T(a * k)} - ${T(c, true)} = ${box}$` : `$\\square = ${T(c)} - ${T(a * k, true)} = ${box}$`,
      `בדיקה: $${put} ${op} ${box} = ${T(c)}$`,
    ],
    diag: diagOf(box, { sign: -box }),
  };
}

/** A level balance as an exercise: one box alone is x. */
function balanceItem(start, x, key, solution) {
  return {
    key, text: 'המאזניים מאוזנים, וכל קופסה שוקלת $x$ משקולות. הורידו מהכפות עד שתישאר קופסה אחת לבד.', form: 'manip',
    manip: { kind: 'balance', start }, answer: x,
    hint: 'מה שמורידים מכף אחת, מורידים גם מהשנייה. כשרק קופסאות מול משקולות, מחלקים.',
    solution, diag: () => null,
  };
}
const mirrorPans = (s) => ({ lx: s.rx, l1: s.r1, rx: s.lx, r1: s.l1 });
// x + a = b only: a start of boxes against weights alone (ax = b) is solved by one press of "divide", so it never asks
// for "the same on both sides"; the tests reject it (content/manip.test.js)
function balance1() {
  const a = R(1, 7); const x = R(1, 12 - a); let start = { lx: 1, l1: a, rx: 0, r1: x + a };
  const solution = [`מורידים $${a}$ ${a === 1 ? 'משקולת' : 'משקולות'} מכל כף: $x + ${a} - ${a} = ${x + a} - ${a}$`, `נשארת קופסה לבד מול $${x}$ משקולות: $x = ${x}$`];
  if (Math.random() < 0.3) start = mirrorPans(start);
  return balanceItem(start, x, `eq1b:${start.lx}:${start.l1}:${start.rx}:${start.r1}`, solution);
}

// ---------------------------------------------------------------- 2. two steps (משוואה בשני צעדים)
// ax + b = c undone in reverse order. The critique's additions: b − x = c (the hidden −1), x : a in two steps,
// collecting on one side first, and the error teachers see most here, dividing only some terms (divide-part:
// 2x + 4 = 10 → x + 4 = 5).

function twoStepParams() {
  const k = R(0, 2); const b = NZ(-15, 15);
  // k 2 is b − |a|x, written with the number first; there a = −1 a quarter of the time (7 − x = 3)
  let a = k === 2 ? (Math.random() < 0.25 ? -1 : -R(2, 9)) : R(2, 9) * (Math.random() < 0.3 ? -1 : 1);
  let x;
  // a fraction answer 15% of the time, halves only
  if (Math.random() < 0.15 && a !== -1) { a = (a < 0 ? -1 : 1) * pick([2, 4]); x = pick([1, 3, -1, 5]) / 2; } else x = NZ(-10, 10);
  return { k, a, b, x, c: a * x + b };
}
/** The errors of ax + b = c (a is the coefficient as it acts, negative in b − |a|x). */
const twoStepBugs = ({ k, a, b, c, x }) => ({
  'move-no-flip': (c + b) / a,
  'divide-part': k !== 2 && abs(a) !== 1 && Number.isInteger(c / a) ? c / a - b : null,
  sign: a < 0 ? -x : null,
  'sub-coef': abs(a) !== 1 ? c - b - a : null,
});
const twoShow = ({ k, a, b, c }) => (k === 0 ? `${linTex(a, b)} = ${T(c)}` : k === 1 ? `${T(c)} = ${linTex(a, b)}` : `${sumTex([[b, ''], [a, 'x']])} = ${T(c)}`);
function twoStepSolution({ k, a, b, c, x }) {
  const ax = linTex(a, 0);
  return [
    `${undo(b)}: $${k === 1 ? `${T(c - b)} = ${ax}` : `${ax} = ${T(c - b)}`}$`,
    a === 1 ? `$x = ${T(x)}$` : `מחלקים את שני האגפים ב־$${T(a)}$: $x = ${T(x)}$`,
    `בדיקה: $${k === 2 ? atRev(a, b, x) : at(a, b, x)} = ${T(c)}$`,
  ];
}
function twoStepItem() {
  const p = twoStepParams();
  return {
    key: `eq2:${twoShow(p)}`, text: 'פתרו את המשוואה.', display: twoShow(p), form: 'num', answer: p.x,
    hint: p.k === 2 ? `קודם מורידים את $${T(p.b)}$ משני האגפים. ושימו לב: $${linTex(p.a, 0)}$ הוא $${T(p.a)}$ כפול $x$.` : 'קודם מבטלים את המספר שנוסף ל־$x$, בשני האגפים. אחר כך מחלקים במקדם.',
    solution: twoStepSolution(p), diag: diagOf(p.x, twoStepBugs(p)),
  };
}

// x : a in two steps, and a fraction bar over a sum: \frac{x}{3} + 4 = 9 (x = 15), \frac{x + 1}{3} = 7 (x = 20)
function fracItem() {
  const a = R(2, 5);
  if (Math.random() < 0.5) {
    const m = NZ(-9, 9); const b = NZ(-9, 9); const x = a * m; const c = m + b;
    const display = `\\frac{x}{${a}} ${b < 0 ? '-' : '+'} ${abs(b)} = ${T(c)}`;
    return {
      key: `eq2f:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
      hint: `קודם מורידים את $${T(b)}$ משני האגפים. אחר כך: $x$ מחולק ב־$${a}$, וחילוק מבטלים בכפל.`,
      solution: [`${undo(b)}: $\\frac{x}{${a}} = ${T(m)}$`, `כופלים את שני האגפים ב־$${a}$: $x = ${T(x)}$`, `בדיקה: $${T(x)} : ${a} ${b < 0 ? '-' : '+'} ${abs(b)} = ${T(c)}$`],
      // the number moved without changing sign, or the division moved over as a division
      diag: (u) => diagOf(x, { 'move-no-flip': a * (c + b) })(u) || diagOf(x, { 'move-no-flip': (c - b) / a })(u),
    };
  }
  const c = NZ(-6, 9); const b = NZ(-9, 9); const x = a * c - b;
  const display = `\\frac{${linTex(1, b)}}{${a}} = ${T(c)}`;
  return {
    key: `eq2f:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
    hint: `כל האגף השמאלי, $${linTex(1, b)}$, מחולק ב־$${a}$. קודם כופלים את שני האגפים ב־$${a}$.`,
    solution: [`כופלים את שני האגפים ב־$${a}$: $${linTex(1, b)} = ${T(a * c)}$`, `${undo(b)}: $x = ${T(x)}$`, `בדיקה: $\\frac{${T(x)} ${b < 0 ? '-' : '+'} ${abs(b)}}{${a}} = \\frac{${x + b}}{${a}} = ${T(c)}$`],
    // only x divided, as if it were \frac{x}{a} + b (divide-part); the division moved over as a division (move-no-flip)
    diag: diagOf(x, { 'divide-part': a * (c - b), 'move-no-flip': c / a - b }),
  };
}

// collect on one side first: 2x + 3x − 4 = 21, and the curriculum's books x + 2x + (x + 6) = 26
function collectFirst() {
  if (Math.random() < 0.35) {
    const k = R(2, 3); const m = R(2, 9); const x = R(2, 12); const A = k + 2; const total = A * x + m;
    const display = `x + ${k}x + (x + ${m}) = ${total}`;
    return {
      key: `eq2c:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
      hint: 'קודם מכנסים איברים דומים באגף שמאל: $x$־ים עם $x$־ים.',
      solution: [`מכנסים: $x + ${k}x + x = ${A}x$, ולכן $${A}x + ${m} = ${total}$`, `מחסירים $${m}$: $${A}x = ${total - m}$`, `מחלקים ב־$${A}$: $x = ${x}$`, `בדיקה: $${x} + ${k * x} + ${x + m} = ${total}$`],
      diag: diagOf(x, { 'move-no-flip': (total + m) / A, 'divide-part': Number.isInteger(total / A) ? total / A - m : null }),
    };
  }
  const p = R(1, 6); const q = R(1, 6); const b = NZ(-12, 12); const x = NZ(-8, 9); const A = p + q; const c = A * x + b;
  const terms = Math.random() < 0.5 ? [[p, 'x'], [q, 'x'], [b, '']] : [[p, 'x'], [b, ''], [q, 'x']];
  const display = `${sumTex(terms)} = ${T(c)}`;
  return {
    key: `eq2c:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
    hint: 'קודם מכנסים איברים דומים באגף שמאל, ואז זו משוואה בשני צעדים.',
    solution: [`מכנסים: $${linTex(A, b)} = ${T(c)}$`, `${undo(b)}: $${A}x = ${T(c - b)}$`, `מחלקים ב־$${A}$: $x = ${T(x)}$`, `בדיקה: $${sumTex(terms.map(([n, v]) => [v ? n * x : n, '']))} = ${T(c)}$`],
    diag: diagOf(x, { 'move-no-flip': (c + b) / A, 'divide-part': Number.isInteger(c / A) ? c / A - b : null }),
  };
}

// The Ministry's sample exam: a scooter costs 4x + 10 for x hours; 22 shekels paid, so 3 hours.
const RENTALS = [
  { story: (f, r, P) => `השכרת קורקינט עולה $${f}$ ₪ דמי פתיחה ועוד $${r}$ ₪ לכל שעה. נועם שילם $${P}$ ₪. כמה שעות הוא נסע?`, x: 'מספר השעות', unit: 'שעות' },
  { story: (f, r, P) => `נסיעה במונית עולה $${f}$ ₪ ועוד $${r}$ ₪ לכל קילומטר. הנסיעה של מאיה עלתה $${P}$ ₪. כמה קילומטרים היא נסעה?`, x: 'מספר הקילומטרים', unit: 'ק״מ' },
  { story: (f, r, P) => `מנוי לבריכה עולה $${f}$ ₪ ועוד $${r}$ ₪ לכל כניסה. יואב שילם $${P}$ ₪. כמה פעמים הוא נכנס?`, x: 'מספר הכניסות', unit: 'כניסות' },
];
function rentItem() {
  const C = pick(RENTALS); const r = R(2, 9); const f = R(5, 20); const h = R(1, 9); const P = f + r * h;
  return {
    key: `eq2s:${RENTALS.indexOf(C)}:${f}:${r}:${P}`, text: C.story(f, r, P), form: 'num', answer: h, unit: C.unit,
    hint: `נסמנו ב־$x$ את ${C.x}. המחיר הוא $${r}x + ${f}$, והוא שווה ל־$${P}$.`,
    solution: [`נסמן ב־$x$ את ${C.x}: $${r}x + ${f} = ${P}$`, `מחסירים $${f}$ משני האגפים: $${r}x = ${P - f}$`, `מחלקים ב־$${r}$: $x = ${h}$`, `בדיקה: $${r} \\cdot ${h} + ${f} = ${P}$`],
    diag: diagOf(h, { 'move-no-flip': (P + f) / r }),
  };
}

// x is rarely 1 and spread up to 7 (a pan holds up to 15 weights, three bars of five): "leave one box against one
// weight" or "against two" is not a likely answer
const BAL2 = [2, 3, 4].flatMap((a) => Array.from({ length: Math.floor(14 / a) - 1 }, (_, i) => [a, i + 2])); // a·x ≤ 14, x ≥ 2
function balance2() {
  const [a, x] = Math.random() < 0.1 ? [R(2, 4), 1] : pick(BAL2); const b = R(1, 15 - a * x); const c = a * x + b;
  let start = { lx: a, l1: b, rx: 0, r1: c };
  if (Math.random() < 0.3) start = mirrorPans(start);
  return balanceItem(start, x, `eq2b:${start.lx}:${start.l1}:${start.rx}:${start.r1}`,
    [`מורידים $${b}$ ${b === 1 ? 'משקולת' : 'משקולות'} מכל כף: $${a}x = ${a * x}$`, `מחלקים כל כף ל־$${a}$ קבוצות שוות: $x = ${x}$`, `בדיקה: $${a} \\cdot ${x} + ${b} = ${c}$`]);
}

// ---------------------------------------------------------------- 3. the unknown on both sides (נעלם בשני האגפים)
// Documented errors: the number moved without changing sign (move-no-flip), the x-term moved without changing sign
// (move-x-no-flip); Hall (2002) finds transposing errors are most of all errors in such equations.

function bothParams() {
  for (;;) {
    // positive x-coefficients in about two thirds (the balance's world), both negative rarely (the critique)
    const u = Math.random(); let a; let c;
    if (u < 0.65) { a = R(1, 9); c = R(1, 9); } else if (u < 0.88) { a = R(1, 9); c = -R(1, 9); if (Math.random() < 0.5) [a, c] = [c, a]; } else { a = -R(1, 9); c = -R(1, 9); }
    if (a === c || a + c === 0) continue;
    const x = NZ(-10, 10); const b = NZ(-15, 15); const d = (a - c) * x + b;
    if (abs(d) > 40) continue;
    return { a, b, c, d, x };
  }
}
const bothBugs = ({ a, b, c, d }) => ({ 'move-no-flip': (d + b) / (a - c), 'move-x-no-flip': (d - b) / (a + c) });
/** The worked solution of ax + b = cx + d: the x-terms go where there are more of them, so the coefficient stays positive. */
function bothSolution({ a, b, c, d, x }) {
  const lines = [];
  if (a > c) {
    const take = c > 0 ? `מחסירים $${linTex(c, 0)}$ משני האגפים` : `מוסיפים $${linTex(-c, 0)}$ לשני האגפים`;
    lines.push(`${take}: $${linTex(a - c, b)} = ${T(d)}$`, `${undo(b)}: $${linTex(a - c, 0)} = ${T(d - b)}$`);
  } else {
    const take = a > 0 ? `מחסירים $${linTex(a, 0)}$ משני האגפים` : `מוסיפים $${linTex(-a, 0)}$ לשני האגפים`;
    lines.push(`${take}: $${T(b)} = ${linTex(c - a, d)}$`, `${undo(d)}: $${T(b - d)} = ${linTex(c - a, 0)}$`);
  }
  if (abs(a - c) !== 1) lines.push(`מחלקים את שני האגפים ב־$${abs(a - c)}$: $x = ${T(x)}$`); else lines.push(`$x = ${T(x)}$`);
  lines.push(`בדיקה: באגף שמאל $${at(a, b, x)} = ${a * x + b}$, ובאגף ימין $${at(c, d, x)} = ${c * x + d}$.`);
  return lines;
}
function bothItem() {
  const p = bothParams(); const display = `${linTex(p.a, p.b)} = ${linTex(p.c, p.d)}`;
  return {
    key: `eq3:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: p.x,
    hint: 'מורידים משני האגפים אותו מספר של $x$־ים, כך שיישאר $x$ רק באגף אחד. אחר כך פותרים כמו קודם.',
    solution: bothSolution(p), diag: diagOf(p.x, bothBugs(p)),
  };
}

const HOW_MANY = ['פתרון אחד', 'אין פתרון', 'כל מספר הוא פתרון'];
/** "How many solutions?" with three answers. Some items collect on the left first, so the special case is hidden. */
function howManyItem(level) {
  for (;;) {
    const kind = pick(['one', 'none', 'all']);
    const A = R(1, 5); const b = NZ(-9, 9);
    let left; let leftWords;
    if (level === 4) {
      const m = R(2, 5); const e = NZ(-6, 6); // m(x + e) = mx + me
      left = bracketTex(m, 1, e); leftWords = `פותחים סוגריים: $${linTex(m, m * e)}$`;
      const L = { k: m, c: m * e };
      if (kind === 'all') { const right = Math.random() < 0.5 ? linTex(L.k, L.c) : sumTex([[L.c, ''], [L.k, 'x']]); if (L.c === 0) continue; return special(`${left} = ${right}`, kind, [leftWords, `שני האגפים זהים: $${linTex(L.k, L.c)} = ${linTex(L.k, L.c)}$. כל מספר שמציבים נותן בשניהם אותו ערך.`]); }
      if (kind === 'none') { const d = Math.random() < 0.5 && e !== m * e ? e : L.c + NZ(-5, 5); if (d === L.c) continue; return special(`${left} = ${linTex(L.k, d)}`, kind, [leftWords, `מחסירים $${linTex(L.k, 0)}$ משני האגפים: $${T(L.c)} = ${T(d)}$. זה לא נכון לאף $x$, ולכן אין פתרון.`]); }
      const x = NZ(-6, 6); const r = m * (x + e);
      return special(`${left} = ${T(r)}`, kind, [leftWords, `$${linTex(m, 0)} = ${T(r - m * e)}$, ולכן $x = ${T(x)}$. יש פתרון אחד.`]);
    }
    // level 3: Ax + b, sometimes written as px + b − qx
    if (Math.random() < 0.5) { const q = R(1, 4); left = sumTex([[A + q, 'x'], [b, ''], [-q, 'x']]); leftWords = `מכנסים באגף שמאל: $${linTex(A, b)}$`; } else { left = linTex(A, b); leftWords = null; }
    if (kind === 'all') return special(`${left} = ${sumTex([[b, ''], [A, 'x']])}`, kind, [leftWords, `שני האגפים זהים: $${linTex(A, b)}$. כל מספר שמציבים נותן בשניהם אותו ערך.`]);
    if (kind === 'none') { const d = b + NZ(-6, 6); if (d === 0) continue; return special(`${left} = ${linTex(A, d)}`, kind, [leftWords, `מחסירים $${linTex(A, 0)}$ משני האגפים: $${T(b)} = ${T(d)}$. זה לא נכון לאף $x$, ולכן אין פתרון.`]); }
    const C = A + NZ(-3, 3); if (C === A || C <= 0) continue;
    const x = NZ(-6, 6); const d = (A - C) * x + b;
    return special(`${left} = ${linTex(C, d)}`, kind, [leftWords, `מורידים $x$־ים משני האגפים ופותרים: $x = ${T(x)}$. יש פתרון אחד.`, `בדיקה: כש־$x = ${T(x)}$ שני האגפים $${A * x + b}$.`]);
  }
}
function special(display, kind, solution) {
  const choices = shuffle(HOW_MANY.map((t, i) => ({ ...txt(t), ok: ['one', 'none', 'all'][i] === kind })));
  return {
    key: `eqs:${display}`, text: 'כמה פתרונות יש למשוואה?', display, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
    hint: 'מכנסים ומורידים משני האגפים את ה־$x$־ים. מה נשאר: שוויון נכון, שוויון לא נכון, או משוואה עם $x$?',
    solution: solution.filter(Boolean), diag: () => null,
  };
}

function balance3() {
  for (;;) {
    const a = R(2, 6); const c = R(1, a - 1); const x = R(1, 6); const b = R(0, 6); const d = (a - c) * x + b;
    if (d > 12 || (b === 0 && c === 1 && Math.random() < 0.5)) continue;
    let start = { lx: a, l1: b, rx: c, r1: d };
    if (Math.random() < 0.3) start = mirrorPans(start);
    return balanceItem(start, x, `eq3b:${start.lx}:${start.l1}:${start.rx}:${start.r1}`, [
      `${c === 1 ? 'מורידים קופסה אחת' : `מורידים $${c}$ קופסאות`} מכל כף: $${linTex(a - c, b)} = ${d}$`,
      ...(b ? [`מורידים $${b}$ ${b === 1 ? 'משקולת' : 'משקולות'} מכל כף: $${linTex(a - c, 0)} = ${d - b}$`] : []),
      a - c > 1 ? `מחלקים כל כף ל־$${a - c}$ קבוצות שוות: $x = ${x}$` : `$x = ${x}$`,
      `בדיקה: $${a} \\cdot ${x} + ${b} = ${a * x + b}$, וגם $${at(c, d, x)} = ${c * x + d}$`,
    ]);
  }
}

// ---------------------------------------------------------------- 4. brackets (משוואות עם סוגריים)
// Documented errors (as in expressions, now inside an equation): only the first term multiplied (partial-dist), and a
// minus before brackets that changes only the first sign (minus-bracket).

function bracketParams() {
  const r = Math.random(); const k = r < 0.3 ? 0 : r < 0.65 ? 1 : r < 0.88 ? 2 : 3;
  const x = NZ(-10, 10); const b = NZ(-9, 9);
  if (k === 2) { const c = R(2, 7); return { k, a: 1, p: 1, b, c, x, d: (c - 1) * x - b }; }
  const p = k === 3 ? R(2, 3) : 1; const a = (k === 3 ? R(2, 4) : R(2, 6)) * (Math.random() < 0.4 ? -1 : 1);
  if (k === 0) return { k, a, p, b, c: 0, x, d: a * (p * x + b) };
  let c; do { c = NZ(-5, 5); } while (c === a * p);
  return { k, a, p, b, c, x, d: a * (p * x + b) - c * x };
}
const bracketBugs = ({ k, a, p, b, c, d }) => ({
  // a(px + b) opened as apx + b
  'partial-dist': k === 2 ? null : (d - b) / (a * p - c),
  // cx − (x + b) opened as cx − x + b; a negative a: a(px + b) opened as apx − ab
  'minus-bracket': k === 2 ? (d - b) / (c - 1) : a < 0 ? (d + a * b) / (a * p - c) : null,
});
function bracketShow({ k, a, p, b, c, d }) {
  if (k === 2) return `${linTex(c, 0)} - (${linTex(1, b)}) = ${T(d)}`;
  return `${bracketTex(a, p, b)} = ${k === 0 ? T(d) : linTex(c, d)}`;
}
function bracketSolution({ k, a, p, b, c, d, x }) {
  // open, then it is ax + b = cx + d
  const A = k === 2 ? c - 1 : a * p; const B = k === 2 ? -b : a * b; const C = k === 2 ? 0 : c;
  const open = k === 2 ? `פותחים סוגריים, והמינוס הופך את שני הסימנים: $${linTex(c, 0)} - x ${b < 0 ? '+' : '-'} ${abs(b)} = ${T(d)}$`
    : `פותחים סוגריים: $${linTex(a * p, a * b)} = ${k === 0 ? T(d) : linTex(c, d)}$`;
  const lines = [open];
  if (k === 2) lines.push(`מכנסים: $${linTex(A, B)} = ${T(d)}$`);
  if (C !== 0) lines.push(...bothSolution({ a: A, b: B, c: C, d, x }).slice(0, -1));
  else lines.push(`${undo(B)}: $${linTex(A, 0)} = ${T(d - B)}$`, A === 1 ? `$x = ${T(x)}$` : `מחלקים ב־$${T(A)}$: $x = ${T(x)}$`);
  const orig = k === 2 ? `${at(c, 0, x)} - (${T(x)} ${b < 0 ? '-' : '+'} ${abs(b)})` : `${T(a)}(${at(p, b, x)})`.replace(/^1\(/, '(').replace(/^-1\(/, '-(');
  lines.push(`בדיקה במשוואה המקורית: $${orig} = ${T(k === 2 ? (c - 1) * x - b : a * (p * x + b))}$${k === 0 || k === 2 ? '' : `, וגם $${at(c, d, x)} = ${T(c * x + d)}$`}.`);
  return lines;
}
// The curriculum's own equations (algebra_7), each with its bug's answer worked out by hand and checked by script.
const FIXED = [
  { display: '3(y - 2) + 1 = y + 5', v: 'y', answer: 5, bugs: { 'partial-dist': 3 },
    solution: ['פותחים סוגריים: $3y - 6 + 1 = y + 5$', 'מכנסים: $3y - 5 = y + 5$', 'מחסירים $y$ ומוסיפים $5$: $2y = 10$', '$y = 5$', 'בדיקה: $3(5 - 2) + 1 = 10$, וגם $5 + 5 = 10$.'] },
  { display: '6x + 20 = 4(2x + 3)', answer: 4, bugs: { 'partial-dist': 8.5 },
    solution: ['פותחים סוגריים: $6x + 20 = 8x + 12$', 'מחסירים $6x$ ו־$12$ משני האגפים: $8 = 2x$', '$x = 4$', 'בדיקה: $6 \\cdot 4 + 20 = 44$, וגם $4(2 \\cdot 4 + 3) = 44$.'] },
  { display: '2(z + 3) - 5 = 5(7 - 2z) + 2', v: 'z', answer: 3, bugs: { 'partial-dist': 9.75 },
    solution: ['פותחים סוגריים: $2z + 6 - 5 = 35 - 10z + 2$', 'מכנסים: $2z + 1 = 37 - 10z$', 'מוסיפים $10z$ ומחסירים $1$: $12z = 36$', '$z = 3$', 'בדיקה: $2(3 + 3) - 5 = 7$, וגם $5(7 - 6) + 2 = 7$.'] },
  { display: '10x = 3(x + 7)', answer: 3, bugs: { 'partial-dist': 1 },
    solution: ['פותחים סוגריים: $10x = 3x + 21$', 'מחסירים $3x$: $7x = 21$', '$x = 3$', 'בדיקה: $10 \\cdot 3 = 30$, וגם $3(3 + 7) = 30$.'] },
  { display: 'x + \\frac{1}{3}x = 5', answer: 15 / 4, bugs: {},
    hint: 'כדי להיפטר מהשבר, כופלים את שני האגפים ב־$3$, כל איבר.',
    solution: ['כופלים את שני האגפים ב־$3$, כל איבר: $3x + x = 15$', 'מכנסים: $4x = 15$', '$x = \\frac{15}{4} = 3\\frac{3}{4}$', 'בדיקה: $3\\frac{3}{4} + 1\\frac{1}{4} = 5$'] },
];
function bracketItem() {
  if (Math.random() < 0.15) {
    const F = pick(FIXED);
    return {
      key: `eq4f:${F.display}`, text: 'פתרו את המשוואה.', display: F.display, var: F.v, form: 'num', answer: F.answer, fixed: true,
      hint: F.hint || 'קודם פותחים סוגריים: המספר שלפני הסוגריים כופל כל איבר בתוכם. אחר כך פותרים כמו קודם.',
      solution: F.solution, diag: diagOf(F.answer, F.bugs),
    };
  }
  const p = bracketParams();
  return {
    key: `eq4:${bracketShow(p)}`, text: 'פתרו את המשוואה.', display: bracketShow(p), form: 'num', answer: p.x,
    hint: p.k === 2 ? 'מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.' : 'קודם פותחים סוגריים: המספר שלפני הסוגריים כופל כל איבר בתוכם.',
    solution: bracketSolution(p), diag: diagOf(p.x, bracketBugs(p)),
  };
}

// The Ministry's sample exam: x − 5 + 6x = 4x − (x + 5), whose solution is 0; and equations made like it.
function examItem() {
  for (;;) {
    const n = R(2, 7); const k = R(2, 6); const A = n + 2 - k; if (A < 1) continue;
    const x = R(-4, 4); const m = R(1, 9); const e = m - A * x;
    if (e === 0 || abs(e) > 12) continue;
    const display = `x - ${m} + ${n}x = ${k}x - (${linTex(1, e)})`;
    const lines = [
      `פותחים את הסוגריים, והמינוס הופך את שני הסימנים: $${k}x - x ${e < 0 ? '+' : '-'} ${abs(e)}$`,
      `מכנסים בכל אגף: $${linTex(1 + n, -m)} = ${linTex(k - 1, -e)}$`,
      `מחסירים $${linTex(k - 1, 0)}$ משני האגפים: $${linTex(A, -m)} = ${T(-e)}$`,
      `מוסיפים $${m}$: $${linTex(A, 0)} = ${T(m - e)}$`,
      ...(A > 1 ? [`מחלקים ב־$${A}$: $x = ${T(x)}$`] : []),
      `בדיקה: שני האגפים $${(1 + n) * x - m}$.${x === 0 ? ' הפתרון $0$ הוא פתרון ככל פתרון: הוא מאזן את המשוואה.' : ''}`,
    ];
    return {
      key: `eq4e:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
      hint: 'מכנסים בכל אגף. ושימו לב: המינוס לפני הסוגריים הופך את הסימן של כל איבר בתוכם.',
      solution: lines, diag: diagOf(x, { 'minus-bracket': (m + e) / A }),
    };
  }
}

// ---------------------------------------------------------------- 5. word problems (בעיות מילוליות)
// Built as the curriculum asks: name the unknown, express the rest with it, the sentence that says two things are
// equal is the equation, solve, check in the story, answer what was asked. Documented errors: answering the unknown
// instead of the question (wrong-unknown), k(x − b) opened as kx − b (partial-dist), and the relation reversed
// (reversal: Clement 1982, "6S = P").

const PAIRS_MF = [['דני', 'רינה'], ['עומר', 'מאיה'], ['איתי', 'שירה']];
const PAIRS_M = [['דן', 'יואב'], ['אורי', 'עידו'], ['אלון', 'רון']];
const story = (key, text, answer, unit, hint, solution, bugs) => ({ key, text, form: 'num', answer, unit, hint, solution, diag: diagOf(answer, bugs) });

function stampsStory() {
  const [A, B] = pick(PAIRS_MF); const k = R(2, 4); let g; do { g = R(2, 12); } while ((2 * g) % (k - 1)); const x = (2 * g) / (k - 1);
  const q = R(0, 2); const ans = [x, k * x, (k + 1) * x][q];
  const ask = [`כמה בולים היו ל${B} בהתחלה?`, `כמה בולים היו ל${A} בהתחלה?`, 'כמה בולים היו לשניהם יחד?'][q];
  return story(`eq5s:${k}:${g}:${q}`, `ל${A} יש פי $${k}$ בולים מל${B}. ${A} נתן ל${B} $${g}$ בולים, ועכשיו לשניהם אותו מספר. ${ask}`, ans, 'בולים',
    `נסמנו ב־$x$ את הבולים של ${B} בהתחלה. כמה יש לכל אחד אחרי הנתינה?`,
    [`נסמן ב־$x$ את הבולים של ${B} בהתחלה. ל${A}: $${k}x$.`, `אחרי הנתינה: $${k}x - ${g} = x + ${g}$`, `$${linTex(k - 1, 0)} = ${2 * g}$, ולכן $x = ${x}$.`,
      q === 0 ? `ל${B} היו $${x}$ בולים.` : q === 1 ? `ל${A} היו $${k} \\cdot ${x} = ${k * x}$ בולים.` : `יחד: $${x} + ${k * x} = ${(k + 1) * x}$ בולים.`,
      `בדיקה: ל${A} נשארו $${k * x} - ${g} = ${k * x - g}$, ול${B} יש $${x} + ${g} = ${x + g}$.`],
    { 'wrong-unknown': q ? x : null });
}
function agesStory() {
  const [A, B] = pick(PAIRS_M); const k = R(2, 4); const t = R(2, 8); const b = R(2, 6); const g = (k - 1) * t; const y = t + b;
  const q = R(0, 1);
  return story(`eq5a:${k}:${t}:${b}:${q}`, `${A} מבוגר מ${B} ב־$${g}$ שנים. לפני $${b}$ שנים, הגיל של ${A} היה פי $${k}$ מהגיל של ${B}. בן כמה ${q ? A : B} היום?`, q ? y + g : y, 'שנים',
    `נסמנו ב־$x$ את הגיל של ${B} היום. בן כמה היה כל אחד לפני $${b}$ שנים?`,
    [`נסמן ב־$x$ את הגיל של ${B} היום. ${A}: $x + ${g}$.`, `לפני $${b}$ שנים: ${B} $x - ${b}$, ו${A} $${linTex(1, g - b)}$.`,
      `המשוואה: $${linTex(1, g - b)} = ${k}(x - ${b})$`, `פותחים סוגריים: $${linTex(1, g - b)} = ${linTex(k, -k * b)}$, ולכן $x = ${y}$.`,
      q ? `${A} מבוגר ב־$${g}$: $${y} + ${g} = ${y + g}$.` : `${B} בן $${y}$.`,
      `בדיקה: לפני $${b}$ שנים ${B} היה בן $${t}$ ו${A} בן $${t + g}$, ו־$${t + g} = ${k} \\cdot ${t}$.`],
    // k(x − b) opened as kx − b gives x = t; and Yoav's age answered when Dan's was asked
    { 'partial-dist': q ? t + g : t, 'wrong-unknown': q ? y : null });
}
function parcelsStory() {
  const k = R(2, 4); const x = R(2, 12); const W = (k + 1) * x; const q = R(0, 1);
  return story(`eq5w:${k}:${x}:${q}`, `שתי חבילות שוקלות יחד $${W}$ ק״ג. חבילה אחת כבדה פי $${k}$ מהשנייה. כמה שוקלת החבילה ה${q ? 'כבדה' : 'קלה'}?`, q ? k * x : x, 'ק״ג',
    'נסמנו ב־$x$ את המשקל של החבילה הקלה. כמה שוקלת הכבדה?',
    [`החבילה הקלה $x$, והכבדה $${k}x$.`, `יחד: $x + ${k}x = ${W}$, כלומר $${k + 1}x = ${W}$, ולכן $x = ${x}$.`, q ? `הכבדה: $${k} \\cdot ${x} = ${k * x}$ ק״ג.` : `הקלה שוקלת $${x}$ ק״ג.`, `בדיקה: $${x} + ${k * x} = ${W}$.`],
    { 'wrong-unknown': q ? x : null });
}
function anglesStory() {
  let d; do { d = 2 * R(2, 20); } while (d >= 80); const x = (90 - d) / 2; const q = R(0, 1);
  return story(`eq5t:${d}:${q}`, `במשולש ישר־זווית, זווית חדה אחת גדולה מהשנייה ב־$${d}^\\circ$. מה גודל הזווית ה${q ? 'גדולה' : 'קטנה'} מבין השתיים?`, q ? x + d : x, 'מעלות',
    'שתי הזוויות החדות במשולש ישר־זווית משלימות ל־$90^\\circ$. נסמנו את הקטנה ב־$x$.',
    [`הזווית הקטנה $x$, והגדולה $x + ${d}$.`, `יחד $90^\\circ$: $x + x + ${d} = 90$, כלומר $2x = ${90 - d}$, ולכן $x = ${x}$.`, q ? `הגדולה: $${x} + ${d} = ${x + d}^\\circ$` : `הקטנה: $${x}^\\circ$`, `בדיקה: $${x} + ${x + d} + 90 = 180$.`],
    { 'wrong-unknown': q ? x : null });
}
function ballsStory() {
  const [A, B] = pick(PAIRS_MF);
  for (;;) {
    const e = R(1, 3); const n2 = R(6, 20); const p = R(2, 12); if ((n2 * p) % e) continue; const x = (n2 * p) / e; if (x > 60) continue;
    const n1 = n2 + e; const q = R(0, 1);
    return story(`eq5b:${n1}:${n2}:${p}:${q}`, `${A} קנה $${n1}$ כדורים, ו${B} קנתה $${n2}$ כדורים, כל אחד יקר ב־$${p}$ ₪ מכדור של ${A}. הם שילמו אותו סכום. כמה עלה כדור של ${q ? B : A}?`, q ? x + p : x, '₪',
      `נסמנו ב־$x$ את המחיר של כדור של ${A}. כמה עולה כדור של ${B}, וכמה שילם כל אחד?`,
      [`כדור של ${A}: $x$. כדור של ${B}: $x + ${p}$.`, `$${n1}x = ${n2}(x + ${p})$`, `פותחים סוגריים: $${n1}x = ${n2}x + ${n2 * p}$, ולכן $${linTex(e, 0)} = ${n2 * p}$ ו־$x = ${x}$.`,
        q ? `כדור של ${B}: $${x} + ${p} = ${x + p}$ ₪.` : `כדור של ${A} עלה $${x}$ ₪.`, `בדיקה: $${n1} \\cdot ${x} = ${n1 * x}$, וגם $${n2} \\cdot ${x + p} = ${n2 * (x + p)}$.`],
      { 'partial-dist': q ? p / e + p : p / e, 'wrong-unknown': q ? x : null });
  }
}
function consecutiveStory() {
  const x = R(2, 40); const S = 3 * x + 3; const q = R(0, 2); const names = ['הקטן', 'האמצעי', 'הגדול'];
  return story(`eq5c:${S}:${q}`, `סכום של שלושה מספרים שלמים עוקבים הוא $${S}$. מה המספר ${names[q]} מביניהם?`, x + q, null,
    'נסמנו ב־$x$ את המספר הקטן. מה המספר שאחריו, ומה השלישי?',
    [`המספרים: $x$, $x + 1$, $x + 2$.`, `$x + x + 1 + x + 2 = ${S}$, כלומר $3x + 3 = ${S}$, ולכן $x = ${x}$.`, `המספרים: $${x}$, $${x + 1}$, $${x + 2}$. המספר ${names[q]}: $${x + q}$.`, `בדיקה: $${x} + ${x + 1} + ${x + 2} = ${S}$.`],
    { 'wrong-unknown': q ? x : null });
}

/** Choose the equation for a story: one fits; one has the relation reversed; the others are other slips. Four choices. */
function pickEquation() {
  for (;;) {
    let text; let x; let opts;
    const kind = R(0, 3);
    if (kind === 0) {
      const k = R(2, 5); x = R(3, 12); const N = (k + 1) * x;
      text = `בכיתה $${N}$ תלמידים, ויש בה פי $${k}$ בנות מבנים. מספר הבנים $x$. איזו משוואה מתאימה?`;
      opts = [[`x + ${k}x = ${N}`, true], [`x + \\dfrac{x}{${k}} = ${N}`, 'reversal'], [`${k}x = ${N}`], [`x + (x + ${k}) = ${N}`]];
    } else if (kind === 1) {
      const [A, B] = pick(PAIRS_MF); const k = R(2, 4); let g; do { g = R(2, 12); } while ((2 * g) % (k - 1)); x = (2 * g) / (k - 1);
      text = `ל${A} יש פי $${k}$ בולים מל${B}. ${A} נתן ל${B} $${g}$ בולים, ועכשיו לשניהם אותו מספר. ל${B} היו $x$ בולים. איזו משוואה מתאימה?`;
      opts = [[`${k}x - ${g} = x + ${g}`, true], [`\\dfrac{x}{${k}} - ${g} = x + ${g}`, 'reversal'], [`${k}x - ${g} = x`], [`${k}x + ${g} = x - ${g}`]];
    } else if (kind === 2) {
      const k = R(2, 4); x = R(2, 10); const P = 2 * (k + 1) * x;
      text = `האורך של מלבן גדול פי $${k}$ מהרוחב שלו, וההיקף שלו $${P}$ ס״מ. הרוחב $x$ ס״מ. איזו משוואה מתאימה?`;
      opts = [[`2(x + ${k}x) = ${P}`, true], [`2(x + \\dfrac{x}{${k}}) = ${P}`, 'reversal'], [`x + ${k}x = ${P}`], [`x \\cdot ${k}x = ${P}`]];
    } else {
      const [A, B] = pick(PAIRS_M); const k = R(2, 3); x = R(4, 14); const b = R(2, 6); const g = (k - 1) * (x + b);
      text = `${A} מבוגר מ${B} ב־$${g}$ שנים. בעוד $${b}$ שנים, הגיל של ${A} יהיה פי $${k}$ מהגיל של ${B}. ${B} בן $x$. איזו משוואה מתאימה?`;
      opts = [[`x + ${g + b} = ${k}(x + ${b})`, true], [`x + ${g + b} = ${k}x + ${b}`, 'partial-dist'], [`${k}(x + ${g + b}) = x + ${b}`, 'reversal'], [`x + ${g} = ${k}x`]];
    }
    // exactly one of the equations is true at the story's x (an area that happens to equal the perimeter is redrawn)
    if (opts.filter(([t]) => holds(t, { x })).length !== 1 || !holds(opts[0][0], { x })) continue;
    const choices = shuffle(opts.map(([t, tag]) => ({ ...tex(t), ok: tag === true, bug: typeof tag === 'string' ? tag : undefined })));
    return {
      key: `eq5p:${opts[0][0]}`, text, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), solve: x,
      hint: 'בדקו במספר: נסו מספר במקום $x$, חשבו לפי הסיפור, ובדקו איזו משוואה מתארת אותו.',
      solution: [`הנכונה: $${opts[0][0]}$.`, `בדיקה: הפתרון שלה הוא $x = ${x}$, ועם $${x}$ כל מה שבסיפור מתקיים.`, kind === 3 ? 'בגיל שיהיה "פי" כופלים את כל הסוגריים, וה"פי" שייך לגיל של המבוגר.' : 'מי שיש לו "פי" הוא הגדול: הוא מקבל את ה־$x$ הכפול, לא את החלוק.'],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- 6. motion problems (שאלות תנועה)
// Distance = speed × time in units that agree, the three stories the textbooks teach (meeting, catching up, there and
// back), each with a row per mover and an equation (stage5.md FUNC-3). The diagnostic models are the critique's
// (EQ6: scratchpad/lanes/stage5/spec/critique/models.mjs eq6, movers named by their speed) and the spec's (EQ6T:
// models.mjs eq6T), ported unchanged with their own draw rule: a draw is redrawn when a prediction looks like a slip of
// the hand, lies within 0.06 of the answer or of another prediction, or when the answer is a number of the question's
// text. Errors and their sources:
//   rel-speed          the speeds added where they subtract, or subtracted where they add: toward each other the gap
//                      closes by the sum, catching up by the difference (Mayer 1981: meeting and overtaking are two
//                      templates; teachers' first motion error)
//   wrong-unknown      catching up: the hours since the first one left, when the hours since the car left were asked
//                      (eq's id: an answer to another unknown of the story)
//   mean-speed         there and back: the mean of the two speeds taken for the average speed (Reed & Jazo 2002)
//   minutes-as-hours   the minutes used as hours, v·t (Kamii & Russell 2012: hours and minutes are two units)
//   decimal-minutes    40 minutes written 0.4 hours, v·t/100 (as if an hour had 100 minutes)
//   formula-flip       divided by the time instead of multiplying, 60v/t (the Ministry: "הבנת הקשר בין דרך, מהירות, זמן")

const rnd6 = () => Math.random();
const rint6 = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick6 = (r, arr) => arr[Math.floor(r() * arr.length)];
const lcm = (a, b) => (a * b) / gcdN(a, b);
const gcdN = (a, b) => { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const same6 = (a, b) => abs(a - b) <= 1e-9 * Math.max(1, abs(a), abs(b));
/** Every prediction of a model for one draw. */
const bugsOf = (model, p) => Object.fromEntries(Object.entries(model.bugs).map(([id, f]) => [id, f(p)]));
/**
 * A draw is clean (the critique's rule, as content/func.js clean): no prediction looks like a slip, a rounded answer or
 * another prediction, and the answer is not a number of the question's text.
 */
function cleanDraw(model, p) {
  const ans = model.answer(p);
  if (!Number.isFinite(ans)) return false;
  const vals = [];
  for (const f of Object.values(model.bugs)) {
    const v = f(p);
    if (v == null) continue;
    if (!Number.isFinite(v)) return false;
    if (same6(v, ans)) continue;
    if (slipLike(v, ans) || abs(v - ans) <= 0.06) return false;
    vals.push(v);
  }
  for (let i = 0; i < vals.length; i += 1) for (let j = i + 1; j < vals.length; j += 1) { const d = abs(vals[i] - vals[j]); if (d > 1e-9 && d <= 0.06) return false; }
  return !(model.textNums && model.textNums(p).some((n) => same6(ans, n)));
}
const mkModel = (m) => { m.params = (r) => { for (let g = 0; g < 200000; g += 1) { const p = m.raw(r); if (p && cleanDraw(m, p)) return p; } throw new Error('no clean draw'); }; return m; };

/** A mover's noun follows its speed: walking up to 6 km/h, cycling 10 to 30, a car (or a lorry) 35 and above. */
export const moverOf = (v) => (v <= 6 ? 'walk' : v <= 30 ? 'bike' : 'car');
/**
 * The critique's eq6: the kind is drawn first (meeting 40%, catching up 40%, there and back 20%) and redrawn inside its
 * kind. Meeting: two cyclists (10–30 km/h) or two cars (40–100), at most 450 km apart, q0 when, q1 how far from the first
 * one's start. Catching up: a cyclist (10–30) or a lorry (40–80) leaves h hours before a car (40–110) on the same road,
 * q0 when (from the car's start), q1 how far from the start. There and back: walking, cycling or by car (a walk at most
 * 15 km each way), the way's length.
 */
export const EQ6 = mkModel({
  raw: (r) => { const k = pick6(r, ['toward', 'toward', 'catch', 'catch', 'trip']); for (let g = 0; g < 1000; g += 1) { const p = EQ6.rawOf(k, r); if (p) return p; } return null; },
  rawOf: (k, r) => {
    if (k === 'toward') {
      const bike = r() < 0.4;
      const v1 = bike ? 5 * rint6(r, 2, 6) : 10 * rint6(r, 4, 10); const v2 = bike ? 5 * rint6(r, 2, 6) : 10 * rint6(r, 4, 10);
      if (v1 === v2) return null;
      const t = bike ? rint6(r, 2, 4) : rint6(r, 2, 4); const D = (v1 + v2) * t; if (D > 450) return null;
      return { k, bike, v1, v2, t, D, q: r() < 0.6 ? 0 : 1 };
    }
    if (k === 'catch') {
      const v1 = pick6(r, [10, 15, 20, 25, 30, 40, 50, 60, 70, 80]); const h = rint6(r, 1, 3); const t = rint6(r, 1, 5);
      const v2 = v1 + (v1 * h) / t; if (!Number.isInteger(v2 / 5) || v2 < 40 || v2 > 110) return null;
      return { k, v1, v2, h, t, q: r() < 0.6 ? 0 : 1 };
    }
    const pairs = [[3, 6], [4, 6], [10, 15], [12, 18], [10, 20], [15, 30], [20, 30], [40, 60], [60, 90], [45, 90], [50, 75]];
    const [v1, v2] = pick6(r, pairs); const L = lcm(v1, v2); const d = L * rint6(r, 1, 4); const T = d / v1 + d / v2;
    if (!Number.isInteger(T) || T > 10) return null;
    if (v1 <= 6 && d > 15) return null;
    return { k, v1, v2, d, T, q: 0 };
  },
  answer: (p) => (p.k === 'toward' ? (p.q === 0 ? p.t : p.v1 * p.t) : p.k === 'catch' ? (p.q === 0 ? p.t : p.v2 * p.t) : p.d),
  bugs: {
    // toward each other the speeds subtracted; catching up, added
    'rel-speed': (p) => (p.k === 'toward' ? (p.q === 0 ? p.D / abs(p.v1 - p.v2) : (p.v1 * p.D) / abs(p.v1 - p.v2)) : p.k === 'catch' ? (p.q === 0 ? (p.v1 * p.h) / (p.v1 + p.v2) : (p.v2 * p.v1 * p.h) / (p.v1 + p.v2)) : null),
    // the hours since the first one left, not since the car left
    'wrong-unknown': (p) => (p.k === 'catch' && p.q === 0 ? p.t + p.h : null),
    // the round trip at the mean of the two speeds
    'mean-speed': (p) => (p.k === 'trip' ? (p.T * (p.v1 + p.v2)) / 4 : null),
  },
  textNums: (p) => (p.k === 'toward' ? [p.D, p.v1, p.v2] : p.k === 'catch' ? [p.v1, p.h, p.v2] : [p.v1, p.v2, p.T]),
});
/** The spec's eq6T: a train at v km/h for t minutes; how far? (the units of time) */
export const EQ6T = mkModel({
  raw: (r) => {
    const v = pick6(r, [30, 36, 42, 45, 48, 54, 60, 72, 75, 80, 90]); const t = pick6(r, [10, 12, 15, 20, 30, 36, 40, 45, 50]);
    if (!Number.isInteger((v * t) / 60)) return null; return { v, t };
  },
  answer: (p) => (p.v * p.t) / 60,
  bugs: {
    'minutes-as-hours': (p) => p.v * p.t, // the minutes used as hours
    'decimal-minutes': (p) => (p.v * p.t) / 100, // 40 minutes written as 0.4 hours
    'formula-flip': (p) => (60 * p.v) / p.t, // divided by the time instead of multiplying (the time in hours)
  },
  textNums: (p) => [p.v, p.t],
});

/** Hours in words after "כעבור": one is "שעה", two "שעתיים" (never "$1$ שעות"). */
export const hoursAfter = (h) => (h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `$${h}$ שעות`);
/** The catching-up story's first mover: a cyclist up to 30 km/h, else a lorry; its pronouns agree with it. */
const firstOf = (v1) => (v1 <= 30 ? { who: 'רוכב אופניים יצא', the: 'הרוכב', him: 'אותו', after: 'אחריו', rode: 'נסע', both: 'שניהם' } : { who: 'משאית יצאה', the: 'המשאית', him: 'אותה', after: 'אחריה', rode: 'נסעה', both: 'שתיהן' });
const TRIP = { walk: 'הלכו', bike: 'רכבו על אופניים', car: 'נסעו' };

/** The question's text: the story in the mover's own words, then what is asked. */
export function eq6Text(p) {
  if (p.k === 'toward') {
    const head = p.v1 <= 30
      ? `שני רוכבי אופניים יוצאים באותו רגע משני כפרים במרחק $${p.D}$ ק״מ, זה לקראת זה. הראשון רוכב ב־$${p.v1}$ קמ״ש, והשני ב־$${p.v2}$ קמ״ש.`
      : `שתי מכוניות יוצאות באותו רגע משתי ערים במרחק $${p.D}$ ק״מ, זו לקראת זו. הראשונה נוסעת ב־$${p.v1}$ קמ״ש, והשנייה ב־$${p.v2}$ קמ״ש.`;
    const ask = p.q === 0 ? 'כעבור כמה שעות ייפגשו?' : p.v1 <= 30 ? 'במרחק כמה ק״מ מהכפר של הראשון ייפגשו?' : 'במרחק כמה ק״מ מהעיר של הראשונה ייפגשו?';
    return `${head} ${ask}`;
  }
  if (p.k === 'catch') {
    const F = firstOf(p.v1);
    return `${F.who} ב־$${p.v1}$ קמ״ש. כעבור ${hoursAfter(p.h)} יצאה ${F.after} מכונית מאותו מקום, באותה דרך, ב־$${p.v2}$ קמ״ש. ${p.q === 0 ? `כעבור כמה שעות מיציאתה המכונית תשיג ${F.him}?` : `במרחק כמה ק״מ מנקודת היציאה המכונית תשיג ${F.him}?`}`;
  }
  return `${TRIP[moverOf(p.v1)]} ב־$${p.v1}$ קמ״ש וחזרו באותה דרך ב־$${p.v2}$ קמ״ש, ובסך הכול $${p.T}$ שעות. מה אורך הדרך לכיוון אחד?`;
}
export function eq6Hint(p) {
  if (p.k === 'toward') {
    const bike = p.v1 <= 30;
    return `בכל שעה כל ${bike ? 'אחד' : 'אחת'} סוגר${bike ? '' : 'ת'} חלק מהמרחק. בכמה ק״מ ${bike ? 'הם מתקרבים' : 'הן מתקרבות'} בשעה אחת?${p.q === 1 ? ` ושימו לב: שאלו כמה ${bike ? 'עבר הראשון' : 'עברה הראשונה'}.` : ''}`;
  }
  if (p.k === 'catch') {
    const F = firstOf(p.v1);
    return `נסמן ב־$x$ את הזמן של המכונית. ${F.the} ${F.rode} יותר זמן: $x + ${p.h}$. כשהמכונית משיגה, ${F.both} עברו אותה דרך.`;
  }
  return `נסמן ב־$x$ את אורך הדרך. כמה זמן לקח הלוך, וכמה חזור? יחד $${p.T}$ שעות.`;
}
export function eq6Solution(p) {
  if (p.k === 'toward') {
    const bike = p.v1 <= 30; const S = p.v1 + p.v2;
    return [
      `הזמן של ${bike ? 'שניהם' : 'שתיהן'} $x$ שעות, והדרכים $${p.v1}x$ ו־$${p.v2}x$. יחד הן כל המרחק: $${p.v1}x + ${p.v2}x = ${p.D}$`,
      `בכל שעה ${bike ? 'הם מתקרבים' : 'הן מתקרבות'} $${p.v1} + ${p.v2} = ${S}$ ק״מ: $${S}x = ${p.D}$, ולכן $x = ${p.t}$.`,
      ...(p.q === 1 ? [`${bike ? 'הראשון עבר' : 'הראשונה עברה'} עד המפגש $${p.v1} \\cdot ${p.t} = ${p.v1 * p.t}$ ק״מ.`] : [`${bike ? 'הם ייפגשו' : 'הן ייפגשו'} כעבור $${p.t}$ שעות.`]),
      `בדיקה: $${p.v1} \\cdot ${p.t} + ${p.v2} \\cdot ${p.t} = ${p.D}$`,
    ];
  }
  if (p.k === 'catch') {
    const F = firstOf(p.v1);
    return [
      `הזמן של המכונית $x$, ושל ${F.the} $x + ${p.h}$. כשהמכונית משיגה, הדרכים שוות: $${p.v2}x = ${p.v1}(x + ${p.h})$`,
      `פותחים סוגריים: $${p.v2}x = ${p.v1}x + ${p.v1 * p.h}$, ולכן $${linTex(p.v2 - p.v1, 0)} = ${p.v1 * p.h}$ ו־$x = ${p.t}$.`,
      p.q === 1 ? `המכונית עברה עד אז $${p.v2} \\cdot ${p.t} = ${p.v2 * p.t}$ ק״מ.` : `המכונית משיגה כעבור $${p.t}$ ${p.t === 1 ? 'שעה' : 'שעות'} מיציאתה.`,
      `בדיקה: $${p.v2} \\cdot ${p.t} = ${p.v2 * p.t}$, וגם $${p.v1} \\cdot ${p.t + p.h} = ${p.v1 * (p.t + p.h)}$`,
    ];
  }
  const L = lcm(p.v1, p.v2);
  return [
    `אורך הדרך $x$. זמן הלוך $\\frac{x}{${p.v1}}$ וזמן חזור $\\frac{x}{${p.v2}}$: $\\frac{x}{${p.v1}} + \\frac{x}{${p.v2}} = ${p.T}$`,
    `כופלים את שני האגפים ב־$${L}$: $${linTex(L / p.v1, 0)} + ${linTex(L / p.v2, 0)} = ${L * p.T}$, כלומר $${linTex(L / p.v1 + L / p.v2, 0)} = ${L * p.T}$, ולכן $x = ${p.d}$.`,
    `בדיקה: הלוך $${p.d} : ${p.v1} = ${p.d / p.v1}$ שעות, חזור $${p.d} : ${p.v2} = ${p.d / p.v2}$, ויחד $${p.T}$.`,
  ];
}
/** The answer's unit: hours when the question asks when, km when it asks how far. */
export const eq6Unit = (p) => (p.k !== 'trip' && p.q === 0 ? 'שעות' : 'ק״מ');
export const eq6Key = (p) => (p.k === 'toward' ? `eq6:toward:${p.v1}:${p.v2}:${p.D}:${p.q}` : p.k === 'catch' ? `eq6:catch:${p.v1}:${p.h}:${p.v2}:${p.q}` : `eq6:trip:${p.v1}:${p.v2}:${p.T}`);

export const eq6TText = (p) => `רכבת נוסעת במהירות $${p.v}$ קמ״ש. כמה ק״מ היא עוברת ב־$${p.t}$ דקות?`;
export const eq6THint = (p) => `$${p.v}$ קמ״ש הם $${p.v}$ ק״מ בשעה. איזה חלק משעה הן $${p.t}$ דקות? בשעה $60$ דקות.`;
export const eq6TSolution = (p) => [
  `בשעה $60$ דקות, ולכן $${p.t}$ דקות הן $\\frac{${p.t}}{60}$ שעה.`,
  `דרך = מהירות × זמן: $${p.v} \\cdot \\frac{${p.t}}{60} = ${(p.v * p.t) / 60}$ ק״מ.`,
];

/** e6 (the critique's eq6): a meeting, a catching up or a round trip, a time or a distance asked. */
function motionItem() {
  const p = EQ6.params(rnd6); const ans = EQ6.answer(p);
  return { key: eq6Key(p), text: eq6Text(p), form: 'num', answer: ans, unit: eq6Unit(p), hint: eq6Hint(p), solution: eq6Solution(p), diag: diagOf(ans, bugsOf(EQ6, p)) };
}
/** e6u (eq6T): speed in km/h, time in minutes. */
function minutesItem() {
  const p = EQ6T.params(rnd6); const ans = EQ6T.answer(p);
  return { key: `eq6u:${p.v}:${p.t}`, text: eq6TText(p), form: 'num', answer: ans, unit: 'ק״מ', hint: eq6THint(p), solution: eq6TSolution(p), diag: diagOf(ans, bugsOf(EQ6T, p)) };
}

/**
 * Two cars toward each other on a graph of their distance from city א, by the hour, past the meeting (X is t + 1 or
 * t + 2 hours): both lines stay on the road until X, every point the graph draws is a grid crossing (the meeting too),
 * and the y axis has at most 18 lines (a number every second or third). The meeting time is read off the graph, so it
 * is not marked (the words for a screen reader name the two lines, not where they cross). Cars as in the meeting story:
 * 40–100 km/h, at most 450 km apart.
 */
export function meetDraw(r = rnd6) {
  for (;;) {
    const v1 = 10 * rint6(r, 4, 10); const v2 = 10 * rint6(r, 4, 10); if (v1 === v2) continue;
    const t = rint6(r, 2, 4); const D = (v1 + v2) * t; if (D > 450) continue;
    const X = t + rint6(r, 1, 2); const a = v1 * X; const b = D - v2 * X;
    if (a > D || b < 0) continue;
    const ys = [60, 50, 40, 30, 25, 20].find((s) => [D, v1 * t, a, b].every((v) => v % s === 0) && D / s <= 18);
    if (!ys) continue;
    return { v1, v2, t, D, X, ys };
  }
}
export function meetFig({ v1, v2, D, X, ys }) {
  const lines = D / ys;
  return {
    type: 'sgraph', x: { max: X, step: 1, label: 'זמן', unit: 'שעות' },
    y: { max: D, step: ys, ...(lines > 12 ? { every: 3 } : lines > 6 ? { every: 2 } : {}), label: 'מרחק מעיר א', unit: 'ק״מ' },
    series: [{ pts: [[0, 0], [X, v1 * X]], label: 'מכונית א' }, { pts: [[0, D], [X, D - v2 * X]], label: 'מכונית ב', dashed: true }],
  };
}
function meetGraph() {
  const g = meetDraw(); const { v1, v2, t, D, X } = g;
  return {
    key: `eq6g:${v1}:${v2}:${D}:${X}`,
    text: 'שתי מכוניות יוצאות באותו רגע זו לקראת זו. הגרף מראה את המרחק של כל אחת מעיר א. כעבור כמה שעות ייפגשו?',
    fig: meetFig(g), form: 'num', answer: t, unit: 'שעות',
    hint: 'הן נפגשות כשהן באותו מקום, כלומר באותו מרחק מעיר א: איפה ששני הקווים נחתכים. את הזמן קוראים על ציר הזמן.',
    solution: [
      `שני הקווים נחתכים בנקודה $(${t}, ${v1 * t})$: אחרי $${t}$ שעות שתי המכוניות $${v1 * t}$ ק״מ מעיר א.`,
      `בדיקה: מכונית א נוסעת $${v1}$ קמ״ש ומכונית ב $${v2}$, ו־$${v1} \\cdot ${t} + ${v2} \\cdot ${t} = ${D}$, כל המרחק בין הערים.`,
    ],
    diag: () => null,
  };
}

/**
 * Which equation fits the table? A meeting of two cars (the distances add up to the whole way) or a car catching up
 * (the distances are equal, the first one's time x + h). Four choices: the equation, the relation reversed (the speeds
 * subtracted for a meeting, added for a catching up: rel-speed), and two others. Practice only: the right equation can
 * be matched to the table's cells without solving anything.
 */
function tableMc() {
  const kind = Math.random() < 0.5 ? 'toward' : 'catch';
  let p; do { p = EQ6.rawOf(kind, rnd6); } while (!p || (kind === 'toward' && p.v1 <= 30));
  const opts = [];
  let text; let fig; let x; let key;
  const head = ['', 'מהירות (קמ״ש)', 'זמן (שעות)', 'דרך (ק״מ)'];
  if (kind === 'toward') {
    const { v1, v2, D, t } = p; const hi = Math.max(v1, v2); const lo = Math.min(v1, v2); x = t;
    key = `eq6t:toward:${v1}:${v2}:${D}`;
    text = `שתי מכוניות יוצאות באותו רגע משתי ערים במרחק $${D}$ ק״מ, זו לקראת זו. הטבלה מתארת אותן עד שהן נפגשות. איזו משוואה מתאימה?`;
    fig = { type: 'table', head, rows: [['הראשונה', v1, 'x', `${v1}x`], ['השנייה', v2, 'x', `${v2}x`]] };
    opts.push([`${v1}x + ${v2}x = ${D}`, true], [`${hi}x - ${lo}x = ${D}`, 'rel-speed'], [`${v1}x = ${v2}x`], [`${v1}x + ${v2}x = ${D}x`]);
  } else {
    const { v1, v2, h, t } = p; const F = firstOf(v1); x = t;
    key = `eq6t:catch:${v1}:${h}:${v2}`;
    text = `${F.who} ב־$${v1}$ קמ״ש. כעבור ${hoursAfter(h)} יצאה ${F.after} מכונית מאותו מקום, באותה דרך, ב־$${v2}$ קמ״ש. בטבלה, $x$ הוא הזמן של המכונית עד שהיא משיגה ${F.him}. איזו משוואה מתאימה?`;
    fig = { type: 'table', head, rows: [[v1 <= 30 ? 'הרוכב' : 'המשאית', v1, `x + ${h}`, `${v1}(x + ${h})`], ['המכונית', v2, 'x', `${v2}x`]] };
    opts.push([`${v2}x = ${v1}(x + ${h})`, true], [`${v1 + v2}x = ${v1 * h}`, 'rel-speed'], [`${v2}(x + ${h}) = ${v1}x`], [`${v2}x = ${v1}x + ${h}`]);
  }
  const choices = shuffle(opts.map(([t, tag]) => ({ ...tex(t), ok: tag === true, ...(typeof tag === 'string' ? { bug: tag } : {}) })));
  return {
    key, text, fig, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), solve: x, practiceOnly: true,
    hint: kind === 'toward' ? 'זו לקראת זו: יחד הן עוברות את כל המרחק בין הערים. מה שווה למה?' : 'כשהמכונית משיגה, שתי הדרכים שוות. מה הדרך של כל אחד, לפי השורה שלו בטבלה?',
    solution: kind === 'toward'
      ? [`הנכונה: $${opts[0][0]}$. הדרכים מתחברות לכל המרחק.`, `בדיקה: הפתרון שלה הוא $x = ${x}$, ואחרי $${x}$ שעות המכוניות עברו יחד $${p.D}$ ק״מ.`]
      : [`הנכונה: $${opts[0][0]}$. כשהמכונית משיגה, הדרכים שוות.`, `בדיקה: הפתרון שלה הוא $x = ${x}$, ושתי הדרכים $${p.v2 * x}$ ק״מ.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

export const EQ = {
  id: 'eq', grade: '7', title: 'משוואות', color: 'violet',
  desc: 'משוואה ופתרונה, פעולות על שני האגפים, בדיקה בהצבה, בעיות מילוליות ושאלות תנועה',
  placement: false, alsoFor: ['8'],
  levels: [
    { title: 'משוואה ופתרון', gen: () => { const r = Math.random(); return r < 0.45 ? oneStepItem() : r < 0.62 ? whichSolves() : r < 0.82 ? missingItem() : balance1(); } },
    { title: 'משוואה בשני צעדים', gen: () => { const r = Math.random(); return r < 0.45 ? twoStepItem() : r < 0.55 ? fracItem() : r < 0.65 ? collectFirst() : r < 0.8 ? rentItem() : balance2(); } },
    { title: 'נעלם בשני האגפים', gen: () => { const r = Math.random(); return r < 0.6 ? bothItem() : r < 0.75 ? howManyItem(3) : balance3(); } },
    { title: 'משוואות עם סוגריים', gen: () => { const r = Math.random(); return r < 0.62 ? bracketItem() : r < 0.8 ? examItem() : howManyItem(4); } },
    { title: 'בעיות מילוליות', gen: () => { const r = Math.random(); return r < 0.7 ? pick([stampsStory, agesStory, parcelsStory, anglesStory, ballsStory, consecutiveStory])() : pickEquation(); } },
    // the spec's mix: a motion story 50%, minutes and hours 25%, the meeting read off a graph 10%, which equation 15%
    { title: 'שאלות תנועה', gen: () => { const r = Math.random(); return r < 0.5 ? motionItem() : r < 0.75 ? minutesItem() : r < 0.85 ? meetGraph() : tableMc(); } },
  ],
  cats: {
    'move-no-flip': 'מספר עבר לאגף השני בלי פעולה הפוכה ($x + 5 = 12$ הפך ל־$x = 17$)',
    'move-x-no-flip': 'איבר ה־$x$ עבר לאגף השני בלי שהסימן שלו התהפך',
    'divide-flip': 'החילוק נעשה הפוך: המקדם חולק במספר שבאגף השני ($12x = 3$ הפך ל־$x = 4$)',
    'sub-coef': 'המקדם הוחסר במקום לחלק בו ($3x = 12$ הפך ל־$x = 9$)',
    'divide-part': 'רק חלק מהאיברים חולק במקדם ($2x + 4 = 10$ הפך ל־$x + 4 = 5$)',
    sign: 'הפתרון יצא עם הסימן ההפוך',
    'partial-dist': 'רק האיבר הראשון שבסוגריים נכפל',
    'minus-bracket': 'מינוס לפני סוגריים הפך רק את הסימן הראשון',
    'wrong-unknown': 'נמצא הנעלם, אבל התשובה לא עונה על מה שנשאל',
    reversal: 'היחס נכתב הפוך: הקבוצה הקטנה קיבלה את ה"פי"',
    // eq:6, motion problems (stage5.md FUNC-3)
    'rel-speed': 'חיברו מהירויות במקום לחסר, או חיסרו במקום לחבר',
    'mean-speed': 'השתמשו בממוצע של שתי המהירויות, אבל הזמנים שונים',
    'minutes-as-hours': 'השתמשו בדקות כאילו הן שעות',
    'decimal-minutes': 'כתבו דקות כשבר עשרוני של שעה, כאילו בשעה $100$ דקות',
    'formula-flip': 'חילקו במקום לכפול: דרך היא מהירות כפול זמן',
  },
  lesson: {
    points: [
      'משוואה היא שוויון בין שני ביטויים. הפתרון הוא המספר שמאזן את שני האגפים.',
      'מה שעושים לאגף אחד עושים גם לשני: $x + 5 = 12$, מחסירים $5$, ו־$x = 7$.',
      'נעלם בשני האגפים: קודם מורידים $x$־ים, אחר כך מספרים. $3x + 5 = x + 11$, ולכן $x = 3$.',
      'סוגריים: פותחים קודם. $4(x - 3) = 2x + 6$, ולכן $x = 9$.',
      'תמיד בודקים: מציבים את הפתרון במשוואה המקורית.',
      'בבעיה מילולית בודקים גם בסיפור, ועונים על מה שנשאל.',
      'שאלות תנועה: דרך = מהירות × זמן, באותן יחידות. זה לקראת זה מחברים את המהירויות, ומי שמשיג סוגר את הפער בהפרש שלהן.',
    ],
  },
};
