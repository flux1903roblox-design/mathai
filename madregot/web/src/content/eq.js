// Grade 7 (ז׳): equations (משוואות), in the order of the Ministry's programme (March to May): what an equation and
// its solution are, two-step equations, the unknown on both sides, brackets, and word problems. Every worked solution
// ends with a check by substitution ("פתרון מלא כולל בדיקה", curriculum note 7). The balance is practice too: a pan
// loses one item at a time, so keeping it level is the student's own decision (content/manip.js).
// Taught from March, so the first-day placement test skips it (placement: false); grade 8 tests revise equations, so
// Exam Rescue offers it to grade 8 too (alsoFor).
import { R, NZ, pick, shuffle, T, near } from './util.js';
import { linTex, sumTex, bracketTex } from './expr.js';
import { slipOf } from '@/learn/misconceptions.ts';
import { holds } from '@/learn/expr.ts';

const abs = Math.abs;
const tex = (t) => ({ tex: t });
const txt = (t) => ({ text: t });

/**
 * The first error whose prediction the answer u matches. A prediction that is the right answer, or that an ordinary
 * slip of the hand also gives (one off, ten off, two digits swapped), names nothing: a slip is not a misconception.
 */
function diagOf(ans, bugs) {
  return (u) => {
    if (typeof u !== 'number') return null;
    const real = Object.entries(bugs).filter(([, v]) => v != null && Number.isFinite(v) && !near(v, ans) && !slipOf(v, ans));
    const exact = real.find(([, v]) => near(u, v, 1e-6));
    if (exact) return exact[0];
    // a fraction typed rounded to tenths (−35/9 as −3.9) names an error only when no other one rounds there too
    const close = [...new Set(real.filter(([, v]) => !Number.isInteger(v) && abs(u - v) <= 0.05 + 1e-9).map(([id]) => id))];
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
      // the answers of the errors first: the number moved without its sign, the x-term moved without its sign
      pool = [(d + b) / (a - c), (d - b) / (a + c), -x, d - b, x + 2, x - 2].filter(Number.isInteger);
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

function balance2() {
  const a = R(2, 4); const x = R(1, Math.floor(10 / a)); const b = R(1, 12 - a * x); const c = a * x + b;
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
      key: `eq4f:${F.display}`, text: 'פתרו את המשוואה.', display: F.display, var: F.v, form: 'num', answer: F.answer,
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
const PAIRS_M = [['דן', 'יואב'], ['אורי', 'עידו'], ['גיל', 'רון']];
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

export const EQ = {
  id: 'eq', grade: '7', title: 'משוואות', color: 'violet',
  desc: 'משוואה ופתרונה, פעולות על שני האגפים, בדיקה בהצבה ובעיות מילוליות',
  placement: false, alsoFor: ['8'],
  levels: [
    { title: 'משוואה ופתרון', gen: () => { const r = Math.random(); return r < 0.45 ? oneStepItem() : r < 0.62 ? whichSolves() : r < 0.82 ? missingItem() : balance1(); } },
    { title: 'משוואה בשני צעדים', gen: () => { const r = Math.random(); return r < 0.45 ? twoStepItem() : r < 0.55 ? fracItem() : r < 0.65 ? collectFirst() : r < 0.8 ? rentItem() : balance2(); } },
    { title: 'נעלם בשני האגפים', gen: () => { const r = Math.random(); return r < 0.6 ? bothItem() : r < 0.75 ? howManyItem(3) : balance3(); } },
    { title: 'משוואות עם סוגריים', gen: () => { const r = Math.random(); return r < 0.62 ? bracketItem() : r < 0.8 ? examItem() : howManyItem(4); } },
    { title: 'בעיות מילוליות', gen: () => { const r = Math.random(); return r < 0.7 ? pick([stampsStory, agesStory, parcelsStory, anglesStory, ballsStory, consecutiveStory])() : pickEquation(); } },
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
  },
  lesson: {
    points: [
      'משוואה היא שוויון בין שני ביטויים. הפתרון הוא המספר שמאזן את שני האגפים.',
      'מה שעושים לאגף אחד עושים גם לשני: $x + 5 = 12$, מחסירים $5$, ו־$x = 7$.',
      'נעלם בשני האגפים: קודם מורידים $x$־ים, אחר כך מספרים. $3x + 5 = x + 11$, ולכן $x = 3$.',
      'סוגריים: פותחים קודם. $4(x - 3) = 2x + 6$, ולכן $x = 9$.',
      'תמיד בודקים: מציבים את הפתרון במשוואה המקורית.',
      'בבעיה מילולית בודקים גם בסיפור, ועונים על מה שנשאל.',
    ],
  },
};
