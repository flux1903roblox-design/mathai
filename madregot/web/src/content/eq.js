// Grade 7 (ז׳): equations (משוואות), in the order of the Ministry's programme (March to May): what an equation and
// its solution are, two-step equations, the unknown on both sides, brackets, and word problems; then motion problems
// (eq:6) and equations with denominators and proportion (eq:7), ח׳ 8.9's (December), which a ז׳ class meets in June
// (the schedule's motion task). Every worked solution
// ends with a check by substitution ("פתרון מלא כולל בדיקה", curriculum note 7). The balance is practice too: a pan
// loses one item at a time, so keeping it level is the student's own decision (content/manip.js).
// Taught from March, so the first-day placement test skips it (placement: false); grade 8 tests revise equations, so
// Exam Rescue offers it to grade 8 too (alsoFor).
// Every solution is written as the class writes it on the board (CLASSROOM-7): the operation done to both sides goes
// after a slash at the end of the line it acts on ("3x + 9 = 4x /−3x", util.js opMark), the words of each line say
// how it was reached, and a "9 = x" is turned round to "x = 9 (הפכנו צדדים)". learn/eqLines.test.ts reads them all.
import { R, NZ, pick, shuffle, T, near, opMark, minusOp, undoOp, divOp, mulOp, flipLine } from './util.js';
import { linTex, sumTex, bracketTex } from './expr.js';
import { slipOf, slipLike, matchesValue, roundings } from '@/learn/misconceptions.ts';
import { holds } from '@/learn/expr.ts';

const abs = Math.abs;
const tex = (t) => ({ tex: t });
const txt = (t) => ({ text: t });

/** Is u the value v rounded to tenths or to hundredths (v not whole), halves away from zero (−0.75 is −0.8)? */
export const roundsTo = (u, v) => roundings(v).some((r) => near(u, r, 1e-9));
/**
 * The errors whose prediction the answer u matches: one name, or a list when several predict the same number (the
 * answer is then ambiguous: content/index.js makeItem). A prediction that is the right answer, or that an ordinary
 * slip of the hand also gives (one off, ten off, two digits swapped), names nothing: a slip is not a misconception.
 */
export function diagOf(ans, bugs) {
  const one = (ids) => (ids.length > 1 ? ids : ids[0] || null);
  // an error may predict two numbers (the x-term moved over from either side): a list of values
  const all = Object.entries(bugs).flatMap(([id, v]) => (Array.isArray(v) ? v : [v]).map((x) => [id, x]));
  return (u) => {
    if (typeof u !== 'number') return null;
    const real = all.filter(([, v]) => v != null && Number.isFinite(v) && !near(v, ans) && !slipOf(v, ans));
    const exact = real.filter(([, v]) => near(u, v, 1e-6)).map(([id]) => id);
    // a fraction typed rounded to tenths or hundredths (−35/9 as −3.9 or −3.89) names the errors that round there; a
    // number near the prediction that is not its rounding (4.45 for 4.5) names nothing, and nor does a rounding that is
    // also a slip from the answer (418.95 typed 419 for 420): the rule of learn/misconceptions
    const rounded = real.filter(([, v]) => !Number.isInteger(v) && matchesValue(v, u, ans)).map(([id]) => id);
    // an answer that is one error's own number and another's rounding (−5.6: −28/5, and −50/9 typed to a tenth) fits
    // both, so both are named, the exact one first (as learn/misconceptions diagnose reads a model's question)
    return one([...new Set([...exact, ...rounded])]);
  };
}
/**
 * The last line of an equation, kx = m (k the coefficient as the class's solution leaves it, m the number), and the
 * mistakes the first two stairs name on it, which every later equation ends on just the same (the council's round 3: a
 * solution with the opposite sign was named on eq:2 and almost never on eq:3, eq:4 or eq:7). Each only where it can
 * happen, else null:
 *   sign         the solution with the opposite sign: a minus lost on the way, the coefficient's (−4x = −8 solved as
 *                4x = 8) or the result's (3x = −6 solved as 6 : 3), so only when there is one (k < 0 or x < 0)
 *   divide-flip  the coefficient divided by the number (4x = 2 made 2), only when the number is the smaller (as eq:1)
 *   sub-coef     the coefficient subtracted from the number (3x = 15 made 12), only when it is not 1; from a negative
 *                number, from the number as it stands or from its size with its minus kept (3x = −15 made −18 or −12)
 * A prediction another mistake of the question also gives is named with it (diagOf: an ambiguous answer), and one a
 * slip of the hand gives names nothing. A diagnostic model predicts one number a mistake: the first.
 */
export function lastStepBugs(k, m) {
  const x = m / k;
  const sub = m < 0 && k > 0 && m + k !== 0 ? [m - k, m + k] : m - k;
  return {
    sign: k < 0 || x < 0 ? -x : null,
    'divide-flip': abs(k) > abs(m) && m !== 0 ? k / m : null,
    'sub-coef': abs(k) !== 1 ? sub : null,
  };
}
/** diagOf for bugs with numbered values of one mistake ('wrong-unknown#1'): the names without their numbers, each once. */
export function diagNamed(ans, bugs) {
  const d = diagOf(ans, bugs);
  return (u) => { const ids = [...new Set([d(u) || []].flat().map((id) => id.replace(/#\d+$/, '')))]; return ids.length > 1 ? ids : ids[0] || null; };
}
/** "Remove b from both sides", in words: b is the number added to the x-term. */
const undo = (b) => (b > 0 ? `מחסירים $${b}$ משני האגפים` : `מוסיפים $${-b}$ לשני האגפים`);
/** "Take the term t (3x, −2x) away from both sides", in words. */
export const takeAway = (t) => (t.startsWith('-') ? `מוסיפים $${t.slice(1)}$ לשני האגפים` : `מחסירים $${t}$ משני האגפים`);
/**
 * One board line: the words that say how it was reached (none on the problem's own line), the equation, and the
 * operation done next, written after a slash at its end.
 */
export const line = (say, eq, op, gap) => `${say ? `${say}: ` : ''}$${op ? opMark(eq, op, gap) : eq}$`;
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
  // ax = b: the coefficient multiplied over where it divides (3x = 12 made x = 36), the same mistake as x : a = b made b / a
  'move-no-flip': k === 0 ? b + a : k === 1 ? b - a : k === 2 ? b * a : b / a,
  'divide-flip': k === 2 && abs(a) > abs(b) ? a / b : null,
  sign: k === 2 && a < 0 ? -x : null,
  'sub-coef': k === 2 ? b - a : null,
});
function oneStepItem() {
  const p = oneStepParams(); const { k, a, b, x } = p;
  const mirror = Math.random() < 0.15 && k !== 3;
  const left = k === 0 ? (Math.random() < 0.25 ? `${a} + x` : `x + ${a}`) : k === 1 ? `x - ${a}` : k === 2 ? linTex(a, 0) : (Math.random() < 0.5 ? `x : ${a}` : `\\frac{x}{${a}}`);
  const display = mirror ? `${T(b)} = ${left}` : `${left} = ${T(b)}`;
  // the problem's line with the operation after a slash, then what it gives (the other side not yet worked out), then x
  const op = [`-${a}`, `+${a}`, divOp(a), mulOp(a)][k];
  const say = [`מחסירים $${a}$ משני האגפים`, `מוסיפים $${a}$ לשני האגפים`, `מחלקים את שני האגפים ב־$${T(a)}$`, `חילוק מבטלים בכפל: כופלים את שני האגפים ב־$${a}$`][k];
  const other = [`${T(b)} - ${a}`, `${T(b)} + ${a}`, `${T(b)} : ${T(a, true)}`, `${T(b, true)} \\cdot ${a}`][k];
  const check = [`${T(x)} + ${a}`, `${T(x)} - ${a}`, at(a, 0, x), `${T(x)} : ${a}`][k];
  const solution = [
    line('', display, op),
    line(say, mirror ? `${other} = x` : `x = ${other}`),
    ...(mirror ? [line('', `${T(x)} = x`), flipLine(T(x))] : [line('', `x = ${T(x)}`)]),
    `בדיקה: $${check} = ${T(b)}$`,
  ];
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
/**
 * The errors of ax + b = c (a is the coefficient as it acts, negative in b − |a|x). move-no-flip is a number taken to
 * the other side with the same operation: the number added (b kept its sign), or, after it is removed, the coefficient
 * (ax = c − b multiplied by a where it should be divided, as stair 1 names it for ax = b).
 */
export const twoStepBugs = ({ k, a, b, c }) => ({
  'move-no-flip': [(c + b) / a, (c - b) * a],
  'divide-part': k !== 2 && abs(a) !== 1 && Number.isInteger(c / a) ? c / a - b : null,
  // the last line, ax = c − b: the coefficient's minus or the result's lost, the division the other way round (a half:
  // 4x = 2), the coefficient subtracted
  ...lastStepBugs(a, c - b),
});
const twoShow = ({ k, a, b, c }) => (k === 0 ? `${linTex(a, b)} = ${T(c)}` : k === 1 ? `${T(c)} = ${linTex(a, b)}` : `${sumTex([[b, ''], [a, 'x']])} = ${T(c)}`);
export function twoStepSolution(p) {
  const { k, a, b, c, x } = p;
  const ax = linTex(a, 0);
  // c = ax + b keeps x on the right to the end, and is turned round there
  const side = (l, r) => (k === 1 ? `${r} = ${l}` : `${l} = ${r}`);
  return [
    line('', twoShow(p), undoOp(b)),
    line(undo(b), side(ax, T(c - b)), a === 1 ? null : divOp(a)),
    ...(a === 1 ? [] : [line(`מחלקים את שני האגפים ב־$${T(a)}$`, side('x', T(x)))]),
    ...(k === 1 ? [flipLine(T(x))] : []),
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
      solution: [line('', display, undoOp(b)), line(undo(b), `\\frac{x}{${a}} = ${T(m)}`, mulOp(a)), line(`כופלים את שני האגפים ב־$${a}$`, `x = ${T(x)}`), `בדיקה: $${T(x)} : ${a} ${b < 0 ? '-' : '+'} ${abs(b)} = ${T(c)}$`],
      // the number moved without changing sign, or the division moved over as a division; the result's minus lost (one
      // diagOf, so a number two of them give names both)
      diag: diagOf(x, { 'move-no-flip': [a * (c + b), (c - b) / a], sign: x < 0 ? -x : null }),
    };
  }
  const c = NZ(-6, 9); const b = NZ(-9, 9); const x = a * c - b;
  const display = `\\frac{${linTex(1, b)}}{${a}} = ${T(c)}`;
  return {
    key: `eq2f:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
    hint: `כל האגף השמאלי, $${linTex(1, b)}$, מחולק ב־$${a}$. קודם כופלים את שני האגפים ב־$${a}$.`,
    solution: [line('', display, mulOp(a)), line(`כופלים את שני האגפים ב־$${a}$`, `${linTex(1, b)} = ${T(a * c)}`, undoOp(b)), line(undo(b), `x = ${T(x)}`), `בדיקה: $\\frac{${T(x)} ${b < 0 ? '-' : '+'} ${abs(b)}}{${a}} = \\frac{${x + b}}{${a}} = ${T(c)}$`],
    // only x divided, as if it were \frac{x}{a} + b (divide-part); the division moved over as a division (move-no-flip);
    // the result's minus lost
    diag: diagOf(x, { 'divide-part': a * (c - b), 'move-no-flip': c / a - b, sign: x < 0 ? -x : null }),
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
      solution: [`מכנסים: $x + ${k}x + x = ${A}x$, ולכן $${opMark(`${A}x + ${m} = ${total}`, `-${m}`)}$`, line(`מחסירים $${m}$ משני האגפים`, `${A}x = ${total - m}`, divOp(A)), line(`מחלקים ב־$${A}$`, `x = ${x}`), `בדיקה: $${x} + ${k * x} + ${x + m} = ${total}$`],
      diag: diagOf(x, { 'move-no-flip': [(total + m) / A, (total - m) * A], 'divide-part': Number.isInteger(total / A) ? total / A - m : null, ...lastStepBugs(A, total - m) }),
    };
  }
  const p = R(1, 6); const q = R(1, 6); const b = NZ(-12, 12); const x = NZ(-8, 9); const A = p + q; const c = A * x + b;
  const terms = Math.random() < 0.5 ? [[p, 'x'], [q, 'x'], [b, '']] : [[p, 'x'], [b, ''], [q, 'x']];
  const display = `${sumTex(terms)} = ${T(c)}`;
  return {
    key: `eq2c:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
    hint: 'קודם מכנסים איברים דומים באגף שמאל, ואז זו משוואה בשני צעדים.',
    solution: [line('מכנסים', `${linTex(A, b)} = ${T(c)}`, undoOp(b)), line(undo(b), `${A}x = ${T(c - b)}`, divOp(A)), line(`מחלקים ב־$${A}$`, `x = ${T(x)}`), `בדיקה: $${sumTex(terms.map(([n, v]) => [v ? n * x : n, '']))} = ${T(c)}$`],
    diag: diagOf(x, { 'move-no-flip': [(c + b) / A, (c - b) * A], 'divide-part': Number.isInteger(c / A) ? c / A - b : null, ...lastStepBugs(A, c - b) }),
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
    solution: [line(`נסמן ב־$x$ את ${C.x}`, `${r}x + ${f} = ${P}`, `-${f}`), line(`מחסירים $${f}$ משני האגפים`, `${r}x = ${P - f}`, divOp(r)), line(`מחלקים ב־$${r}$`, `x = ${h}`), `בדיקה: $${r} \\cdot ${h} + ${f} = ${P}$`],
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
    [line(`מורידים $${b}$ ${b === 1 ? 'משקולת' : 'משקולות'} מכל כף`, `${a}x = ${a * x}`, divOp(a)), line(`מחלקים כל כף ל־$${a}$ קבוצות שוות`, `x = ${x}`), `בדיקה: $${a} \\cdot ${x} + ${b} = ${c}$`]);
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
// the x-term moved over keeping its sign, from the right (ax − cx… = d − b) or from the left (b = cx + ax + d); and the
// last line's mistakes of the first two stairs on |a − c|x = …, where bothSolution leaves the x-terms
const bothBugs = ({ a, b, c, d, x }) => ({
  'move-no-flip': (d + b) / (a - c), 'move-x-no-flip': [(d - b) / (a + c), (b - d) / (a + c)],
  ...lastStepBugs(abs(a - c), abs(a - c) * x),
});
/**
 * The worked solution of ax + b = cx + d: the x-terms go where there are more of them, so the coefficient stays
 * positive. `op` is the first operation, for the caller to write after a slash on the line before; `lines` start with
 * what it gives. A number that is 0 is not taken away (no "מוסיפים 0" step), and "9 = x" is turned round.
 */
export function bothSolution({ a, b, c, d, x }) {
  const lines = [];
  const k = abs(a - c); const divide = k !== 1 ? divOp(k) : null;
  const term = linTex(a > c ? c : a, 0);
  if (a > c) {
    // the x-terms stay on the left: ax + b − cx = d
    lines.push(line(takeAway(term), `${linTex(k, b)} = ${T(d)}`, b ? undoOp(b) : divide));
    if (b) lines.push(line(undo(b), `${linTex(k, 0)} = ${T(d - b)}`, divide));
    if (divide) lines.push(line(`מחלקים את שני האגפים ב־$${k}$`, `x = ${T(x)}`));
  } else {
    // they stay on the right, and the line ends "number = x"
    lines.push(line(takeAway(term), `${T(b)} = ${linTex(k, d)}`, d ? undoOp(d) : divide));
    if (d) lines.push(line(undo(d), `${T(b - d)} = ${linTex(k, 0)}`, divide));
    if (divide) lines.push(line(`מחלקים את שני האגפים ב־$${k}$`, `${T(x)} = x`));
    lines.push(flipLine(T(x)));
  }
  return { op: minusOp(term), lines };
}
function bothItem() {
  return bothFrom(bothParams());
}
/** The exercise of ax + b = cx + d with these parameters (bothParams): 7x − 12 = 6x − 16 is { a: 7, b: −12, c: 6, d: −16, x: −4 }. */
export function bothFrom(p) {
  const display = `${linTex(p.a, p.b)} = ${linTex(p.c, p.d)}`;
  const s = bothSolution(p);
  return {
    key: `eq3:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: p.x,
    hint: 'מורידים משני האגפים אותו מספר של $x$־ים, כך שיישאר $x$ רק באגף אחד. אחר כך פותרים כמו קודם.',
    solution: [line('', display, s.op), ...s.lines, `בדיקה: באגף שמאל $${at(p.a, p.b, p.x)} = ${p.a * p.x + p.b}$, ובאגף ימין $${at(p.c, p.d, p.x)} = ${p.c * p.x + p.d}$.`],
    diag: diagOf(p.x, bothBugs(p)),
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
      const L = { k: m, c: m * e }; const mx = linTex(L.k, 0);
      if (kind === 'all') { const right = Math.random() < 0.5 ? linTex(L.k, L.c) : sumTex([[L.c, ''], [L.k, 'x']]); if (L.c === 0) continue; return special(`${left} = ${right}`, kind, [leftWords, `שני האגפים זהים: $${linTex(L.k, L.c)} = ${linTex(L.k, L.c)}$. כל מספר שמציבים נותן בשניהם אותו ערך.`]); }
      if (kind === 'none') {
        const d = Math.random() < 0.5 && e !== m * e ? e : L.c + NZ(-5, 5); if (d === L.c) continue;
        return special(`${left} = ${linTex(L.k, d)}`, kind, [line('פותחים סוגריים', `${linTex(m, m * e)} = ${linTex(L.k, d)}`, minusOp(mx)), `${takeAway(mx)}: $${T(L.c)} = ${T(d)}$. זה לא נכון לאף $x$, ולכן אין פתרון.`]);
      }
      const x = NZ(-6, 6); const r = m * (x + e);
      return special(`${left} = ${T(r)}`, kind, [line('פותחים סוגריים', `${linTex(m, m * e)} = ${T(r)}`, undoOp(m * e)), line(undo(m * e), `${mx} = ${T(r - m * e)}`, divOp(m)), `מחלקים ב־$${m}$: $x = ${T(x)}$. יש פתרון אחד.`]);
    }
    // level 3: Ax + b, sometimes written as px + b − qx
    if (Math.random() < 0.5) { const q = R(1, 4); left = sumTex([[A + q, 'x'], [b, ''], [-q, 'x']]); leftWords = `מכנסים באגף שמאל: $${linTex(A, b)}$`; } else { left = linTex(A, b); leftWords = null; }
    if (kind === 'all') return special(`${left} = ${sumTex([[b, ''], [A, 'x']])}`, kind, [leftWords, `שני האגפים זהים: $${linTex(A, b)}$. כל מספר שמציבים נותן בשניהם אותו ערך.`]);
    if (kind === 'none') {
      const d = b + NZ(-6, 6); if (d === 0) continue;
      const Ax = linTex(A, 0); const display = `${left} = ${linTex(A, d)}`;
      return special(display, kind, [line(leftWords ? 'מכנסים באגף שמאל' : '', leftWords ? `${linTex(A, b)} = ${linTex(A, d)}` : display, minusOp(Ax)), `${takeAway(Ax)}: $${T(b)} = ${T(d)}$. זה לא נכון לאף $x$, ולכן אין פתרון.`]);
    }
    const C = A + NZ(-3, 3); if (C === A || C <= 0) continue;
    const x = NZ(-6, 6); const d = (A - C) * x + b; const display = `${left} = ${linTex(C, d)}`;
    // solved line by line as in bothItem: one solution, the number found
    const s = bothSolution({ a: A, b, c: C, d, x });
    return special(display, kind, [line(leftWords ? 'מכנסים באגף שמאל' : '', leftWords ? `${linTex(A, b)} = ${linTex(C, d)}` : display, s.op), ...s.lines, `יש פתרון אחד. בדיקה: כש־$x = ${T(x)}$ שני האגפים $${A * x + b}$.`]);
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
    // with no loose weights beside the boxes (b = 0) there is nothing to take away, and no zero step
    const divide = a - c > 1 ? divOp(a - c) : null;
    return balanceItem(start, x, `eq3b:${start.lx}:${start.l1}:${start.rx}:${start.r1}`, [
      line(`${c === 1 ? 'מורידים קופסה אחת' : `מורידים $${c}$ קופסאות`} מכל כף`, `${linTex(a - c, b)} = ${d}`, b ? `-${b}` : divide),
      ...(b ? [line(`מורידים $${b}$ ${b === 1 ? 'משקולת' : 'משקולות'} מכל כף`, `${linTex(a - c, 0)} = ${d - b}`, divide)] : []),
      ...(divide ? [line(`מחלקים כל כף ל־$${a - c}$ קבוצות שוות`, `x = ${x}`)] : []),
      `בדיקה: $${a} \\cdot ${x} + ${b} = ${a * x + b}$, וגם $${at(c, d, x)} = ${c * x + d}$`,
    ]);
  }
}

// ---------------------------------------------------------------- 4. brackets (משוואות עם סוגריים)
// Documented errors (as in expressions, now inside an equation): only the first term multiplied (partial-dist), and a
// minus before brackets that changes only the first sign (minus-bracket).

/**
 * The class's 3(x + 3) = 4x: a(x + b) = cx with nothing added on the right (d = 0, CLASSROOM-7). a and b first, then
 * c = a + m with m dividing a·b (m from −6 to 6, c at least 1), so ab = mx and x = ab/m: 4(x + 2) = 5x gives 8,
 * 6(x + 3) = 7x gives 18. Redrawn when the answer is printed in the equation (5(x − 2) = 3x gives 5), or when opening
 * only the first term (partial-dist, x = b/m) gives the answer or a slip of the hand. Its most common answer is 6.2% of
 * the shape (learn/guessing.test.ts).
 */
export function bracketZero() {
  for (;;) {
    const a = R(2, 6); const b = NZ(-9, 9); const m = NZ(-6, 6); const c = a + m;
    if (c < 1 || (a * b) % m) continue;
    const x = (a * b) / m; const partial = b / m;
    if (x === 0 || abs(x) > 40 || [a, b, -b, c].includes(x) || near(partial, x) || slipOf(partial, x)) continue;
    return { k: 1, a, p: 1, b, c, x, d: 0 };
  }
}
function bracketParams() {
  const r = Math.random(); const k = r < 0.3 ? 0 : r < 0.65 ? 1 : r < 0.88 ? 2 : 3;
  // a fifth of the a(x + b) = cx + d items are the class's shape with d = 0
  if (k === 1 && Math.random() < 0.2) return bracketZero();
  const x = NZ(-10, 10); const b = NZ(-9, 9);
  if (k === 2) { const c = R(2, 7); return { k, a: 1, p: 1, b, c, x, d: (c - 1) * x - b }; }
  const p = k === 3 ? R(2, 3) : 1; const a = (k === 3 ? R(2, 4) : R(2, 6)) * (Math.random() < 0.4 ? -1 : 1);
  if (k === 0) return { k, a, p, b, c: 0, x, d: a * (p * x + b) };
  let c; do { c = NZ(-5, 5); } while (c === a * p);
  return { k, a, p, b, c, x, d: a * (p * x + b) - c * x };
}
const bracketBugs = ({ k, a, p, b, c, d, x }) => ({
  // a(px + b) opened as apx + b
  'partial-dist': k === 2 ? null : (d - b) / (a * p - c),
  // cx − (x + b) opened as cx − x + b; a negative a: a(px + b) opened as apx − ab
  'minus-bracket': k === 2 ? (d - b) / (c - 1) : a < 0 ? (d + a * b) / (a * p - c) : null,
  // the last line's mistakes of the first two stairs, on the line bracketSolution ends on
  ...lastStepBugs(...bracketLast({ k, a, p, c }, x)),
});
/**
 * The last line kx = m of bracketSolution: the x-terms collected where bothSolution leaves them (k = |A − C|), or, with
 * nothing in x on the right, Ax = d − B as it is (A may be negative: −3(x + 2) = 9 ends on −3x = 15).
 */
function bracketLast({ k, a, p, c }, x) {
  const A = k === 2 ? c - 1 : a * p; const C = k === 2 ? 0 : c;
  const K = C !== 0 ? abs(A - C) : A;
  return [K, K * x];
}
function bracketShow({ k, a, p, b, c, d }) {
  if (k === 2) return `${linTex(c, 0)} - (${linTex(1, b)}) = ${T(d)}`;
  return `${bracketTex(a, p, b)} = ${k === 0 ? T(d) : linTex(c, d)}`;
}
/** The class's two named steps of an equation with brackets (CLASSROOM-7). */
export const STEP1 = 'שלב 1: חוק הפילוג (פותחים סוגריים)';
export const STEP2 = 'שלב 2: פותרים כרגיל.';
function bracketSolution({ k, a, p, b, c, d, x }) {
  // step 1 opens the brackets; step 2 solves ax + b = cx + d as before
  const A = k === 2 ? c - 1 : a * p; const B = k === 2 ? -b : a * b; const C = k === 2 ? 0 : c;
  const opened = k === 2 ? `${linTex(c, 0)} - x ${b < 0 ? '+' : '-'} ${abs(b)} = ${T(d)}` : `${linTex(a * p, a * b)} = ${k === 0 ? T(d) : linTex(c, d)}`;
  let op; let rest;
  if (C !== 0) ({ op, lines: rest } = bothSolution({ a: A, b: B, c: C, d, x }));
  else {
    op = undoOp(B);
    rest = [line(undo(B), `${linTex(A, 0)} = ${T(d - B)}`, A === 1 ? null : divOp(A)), ...(A === 1 ? [] : [line(`מחלקים ב־$${T(A)}$`, `x = ${T(x)}`)])];
  }
  const lines = k === 2
    ? [line(`${STEP1}, והמינוס הופך את שני הסימנים`, opened), line(`${STEP2} מכנסים`, `${linTex(A, B)} = ${T(d)}`, op), ...rest]
    : [line(STEP1, opened, op), `${STEP2} ${rest[0]}`, ...rest.slice(1)];
  const orig = k === 2 ? `${at(c, 0, x)} - (${T(x)} ${b < 0 ? '-' : '+'} ${abs(b)})` : `${T(a)}(${at(p, b, x)})`.replace(/^1\(/, '(').replace(/^-1\(/, '-(');
  lines.push(`בדיקה במשוואה המקורית: $${orig} = ${T(k === 2 ? (c - 1) * x - b : a * (p * x + b))}$${k === 0 || k === 2 ? '' : `, וגם $${at(c, d, x)} = ${T(c * x + d)}$`}.`);
  return lines;
}
// The curriculum's own equations (algebra_7), each with its bug's answer worked out by hand and checked by script, and
// the last line its solution ends on (`last`: 2y = 10 is [2, 10]), for the first two stairs' mistakes on it.
const FIXED = [
  { display: '3(y - 2) + 1 = y + 5', v: 'y', answer: 5, bugs: { 'partial-dist': 3 }, last: [2, 10],
    solution: [`${STEP1}: $3y - 6 + 1 = y + 5$`, `${STEP2} מכנסים: $3y - 5 = y + 5 \\qquad /{-y}$`, 'מחסירים $y$ משני האגפים: $2y - 5 = 5 \\qquad /{+5}$', 'מוסיפים $5$ לשני האגפים: $2y = 10 \\qquad /{:}2$', 'מחלקים ב־$2$: $y = 5$', 'בדיקה: $3(5 - 2) + 1 = 10$, וגם $5 + 5 = 10$.'] },
  { display: '6x + 20 = 4(2x + 3)', answer: 4, bugs: { 'partial-dist': 8.5 }, last: [2, 8],
    solution: [`${STEP1}: $6x + 20 = 8x + 12 \\qquad /{-6x}$`, `${STEP2} מחסירים $6x$ משני האגפים: $20 = 2x + 12 \\qquad /{-12}$`, 'מחסירים $12$ משני האגפים: $8 = 2x \\qquad /{:}2$', 'מחלקים ב־$2$: $4 = x$', '$x = 4$ (הפכנו צדדים)', 'בדיקה: $6 \\cdot 4 + 20 = 44$, וגם $4(2 \\cdot 4 + 3) = 44$.'] },
  { display: '2(z + 3) - 5 = 5(7 - 2z) + 2', v: 'z', answer: 3, bugs: { 'partial-dist': 9.75 }, last: [12, 36],
    solution: [`${STEP1}: $2z + 6 - 5 = 35 - 10z + 2$`, `${STEP2} מכנסים: $2z + 1 = 37 - 10z \\qquad /{+10z}$`, 'מוסיפים $10z$ לשני האגפים: $12z + 1 = 37 \\qquad /{-1}$', 'מחסירים $1$ משני האגפים: $12z = 36 \\qquad /{:}12$', 'מחלקים ב־$12$: $z = 3$', 'בדיקה: $2(3 + 3) - 5 = 7$, וגם $5(7 - 6) + 2 = 7$.'] },
  { display: '10x = 3(x + 7)', answer: 3, bugs: { 'partial-dist': 1 }, last: [7, 21],
    solution: [`${STEP1}: $10x = 3x + 21 \\qquad /{-3x}$`, `${STEP2} מחסירים $3x$ משני האגפים: $7x = 21 \\qquad /{:}7$`, 'מחלקים ב־$7$: $x = 3$', 'בדיקה: $10 \\cdot 3 = 30$, וגם $3(3 + 7) = 30$.'] },
  { display: 'x + \\frac{1}{3}x = 5', answer: 15 / 4, bugs: {}, last: [4, 15],
    hint: 'כדי להיפטר מהשבר, כופלים את שני האגפים ב־$3$, כל איבר.',
    solution: ['$x + \\frac{1}{3}x = 5 \\qquad /{\\cdot}3$', 'כופלים את שני האגפים ב־$3$, כל איבר: $3x + x = 15$', 'מכנסים: $4x = 15 \\qquad /{:}4$', 'מחלקים ב־$4$: $x = \\frac{15}{4} = 3\\frac{3}{4}$', 'בדיקה: $3\\frac{3}{4} + 1\\frac{1}{4} = 5$'] },
];
function bracketItem() {
  if (Math.random() < 0.15) {
    const F = pick(FIXED);
    return {
      key: `eq4f:${F.display}`, text: 'פתרו את המשוואה.', display: F.display, var: F.v, form: 'num', answer: F.answer, fixed: true,
      hint: F.hint || 'קודם פותחים סוגריים: המספר שלפני הסוגריים כופל כל איבר בתוכם. אחר כך פותרים כמו קודם.',
      // its own mistake, and the last line's (each equation's `last`, kx = m, from its solution: 12z = 36)
      solution: F.solution, diag: diagOf(F.answer, { ...F.bugs, ...lastStepBugs(...F.last) }),
    };
  }
  return bracketFrom(bracketParams());
}
/** The exercise of a(px + b) = cx + d (or cx − (x + b) = d) with these parameters (bracketParams, bracketZero). */
export function bracketFrom(p) {
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
    const kx = linTex(k - 1, 0);
    const lines = [
      line(`${STEP1}, והמינוס הופך את שני הסימנים`, `x - ${m} + ${n}x = ${k}x - x ${e < 0 ? '+' : '-'} ${abs(e)}`),
      line(`${STEP2} מכנסים בכל אגף`, `${linTex(1 + n, -m)} = ${linTex(k - 1, -e)}`, minusOp(kx)),
      line(takeAway(kx), `${linTex(A, -m)} = ${T(-e)}`, `+${m}`),
      line(`מוסיפים $${m}$ לשני האגפים`, `${linTex(A, 0)} = ${T(m - e)}`, A > 1 ? divOp(A) : null),
      ...(A > 1 ? [line(`מחלקים ב־$${A}$`, `x = ${T(x)}`)] : []),
      `בדיקה: שני האגפים $${(1 + n) * x - m}$.${x === 0 ? ' הפתרון $0$ הוא פתרון ככל פתרון: הוא מאזן את המשוואה.' : ''}`,
    ];
    return {
      key: `eq4e:${display}`, text: 'פתרו את המשוואה.', display, form: 'num', answer: x,
      hint: 'מכנסים בכל אגף. ושימו לב: המינוס לפני הסוגריים הופך את הסימן של כל איבר בתוכם.',
      solution: lines, diag: diagOf(x, { 'minus-bracket': (m + e) / A, ...lastStepBugs(A, A * x) }),
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
/**
 * The answers a story's diag() can name (each prediction, and a fraction's roundings to tenths and hundredths): a
 * verification's search for a misconception asks these, not every number (content/index.js namesOf).
 */
export const triesOf = (bugs) => Object.values(bugs).filter((v) => v != null && Number.isFinite(v)).flatMap((v) => [v, ...roundings(v)]);
const story = (key, text, answer, unit, hint, solution, bugs) => ({ key, text, form: 'num', answer, unit, hint, solution, diag: diagOf(answer, bugs), tries: triesOf(bugs) });
/** The stamps' equation kx − g = x + g solved line by line, to x (shared with learn/content/eq.ts). */
export const stampsLines = (k, g, x) => [
  line('אחרי הנתינה', `${k}x - ${g} = x + ${g}`, '-x'),
  line('מחסירים $x$ משני האגפים', `${linTex(k - 1, 0)} - ${g} = ${g}`, `+${g}`),
  line(`מוסיפים $${g}$ לשני האגפים`, `${linTex(k - 1, 0)} = ${2 * g}`, k > 2 ? divOp(k - 1) : null),
  ...(k > 2 ? [line(`מחלקים ב־$${k - 1}$`, `x = ${x}`)] : []),
];
/** The ages' equation x + g − b = k(x − b) solved line by line to x = y, turned round at the end (shared with eq.ts). */
export const agesLines = (k, g, b, y) => [
  `המשוואה: $${linTex(1, g - b)} = ${k}(x - ${b})$, ופותחים סוגריים: $${opMark(`${linTex(1, g - b)} = ${linTex(k, -k * b)}`, '-x')}$`,
  line('מחסירים $x$ משני האגפים', `${T(g - b)} = ${linTex(k - 1, -k * b)}`, `+${k * b}`),
  line(`מוסיפים $${k * b}$ לשני האגפים`, `${T(g - b + k * b)} = ${linTex(k - 1, 0)}`, k > 2 ? divOp(k - 1) : null),
  ...(k > 2 ? [line(`מחלקים ב־$${k - 1}$`, `${y} = x`)] : []), flipLine(y),
];

function stampsStory() {
  const [A, B] = pick(PAIRS_MF); const k = R(2, 4); let g; do { g = R(2, 12); } while ((2 * g) % (k - 1)); const x = (2 * g) / (k - 1);
  const q = R(0, 2); const ans = [x, k * x, (k + 1) * x][q];
  const ask = [`כמה בולים היו ל${B} בהתחלה?`, `כמה בולים היו ל${A} בהתחלה?`, 'כמה בולים היו לשניהם יחד?'][q];
  return story(`eq5s:${k}:${g}:${q}`, `ל${A} יש פי $${k}$ בולים מל${B}. ${A} נתן ל${B} $${g}$ בולים, ועכשיו לשניהם אותו מספר. ${ask}`, ans, 'בולים',
    `נסמנו ב־$x$ את הבולים של ${B} בהתחלה. כמה יש לכל אחד אחרי הנתינה?`,
    [`נסמן ב־$x$ את הבולים של ${B} בהתחלה. ל${A}: $${k}x$.`, ...stampsLines(k, g, x),
      q === 0 ? `ל${B} היו $${x}$ בולים.` : q === 1 ? `ל${A} היו $${k} \\cdot ${x} = ${k * x}$ בולים.` : `יחד: $${x} + ${k * x} = ${(k + 1) * x}$ בולים.`,
      `בדיקה: ל${A} נשארו $${k * x} - ${g} = ${k * x - g}$, ול${B} יש $${x} + ${g} = ${x + g}$.`],
    { 'wrong-unknown': q ? x : null });
}
function agesStory() {
  const [A, B] = pick(PAIRS_M); const k = R(2, 4); const t = R(2, 8); const b = R(2, 6); const g = (k - 1) * t; const y = t + b;
  const q = R(0, 1);
  return story(`eq5a:${k}:${t}:${b}:${q}`, `${A} מבוגר מ${B} ב־$${g}$ שנים. לפני $${b}$ שנים, הגיל של ${A} היה פי $${k}$ מהגיל של ${B}. בן כמה ${q ? A : B} היום?`, q ? y + g : y, 'שנים',
    `נסמנו ב־$x$ את הגיל של ${B} היום. בן כמה היה כל אחד לפני $${b}$ שנים?`,
    [`נסמן ב־$x$ את הגיל של ${B} היום, ו${A} $x + ${g}$. לפני $${b}$ שנים: ${B} $x - ${b}$, ו${A} $${linTex(1, g - b)}$.`,
      ...agesLines(k, g, b, y),
      q ?`${A} מבוגר ב־$${g}$: $${y} + ${g} = ${y + g}$.` : `${B} בן $${y}$.`,
      `בדיקה: לפני $${b}$ שנים ${B} היה בן $${t}$ ו${A} בן $${t + g}$, ו־$${t + g} = ${k} \\cdot ${t}$.`],
    // k(x − b) opened as kx − b gives x = t; and Yoav's age answered when Dan's was asked
    { 'partial-dist': q ? t + g : t, 'wrong-unknown': q ? y : null });
}
function parcelsStory() {
  const k = R(2, 4); const x = R(2, 12); const W = (k + 1) * x; const q = R(0, 1);
  return story(`eq5w:${k}:${x}:${q}`, `שתי חבילות שוקלות יחד $${W}$ ק״ג. חבילה אחת כבדה פי $${k}$ מהשנייה. כמה שוקלת החבילה ה${q ? 'כבדה' : 'קלה'}?`, q ? k * x : x, 'ק״ג',
    'נסמנו ב־$x$ את המשקל של החבילה הקלה. כמה שוקלת הכבדה?',
    [`החבילה הקלה $x$, והכבדה $${k}x$.`, line('יחד', `x + ${k}x = ${W}`), line('מכנסים', `${k + 1}x = ${W}`, divOp(k + 1)), line(`מחלקים ב־$${k + 1}$`, `x = ${x}`), q ? `הכבדה: $${k} \\cdot ${x} = ${k * x}$ ק״ג.` : `הקלה שוקלת $${x}$ ק״ג.`, `בדיקה: $${x} + ${k * x} = ${W}$.`],
    { 'wrong-unknown': q ? x : null });
}
function anglesStory() {
  let d; do { d = 2 * R(2, 20); } while (d >= 80); const x = (90 - d) / 2; const q = R(0, 1);
  return story(`eq5t:${d}:${q}`, `במשולש ישר־זווית, זווית חדה אחת גדולה מהשנייה ב־$${d}^\\circ$. מה גודל הזווית ה${q ? 'גדולה' : 'קטנה'} מבין השתיים?`, q ? x + d : x, 'מעלות',
    'שתי הזוויות החדות במשולש ישר־זווית משלימות ל־$90^\\circ$. נסמנו את הקטנה ב־$x$.',
    [`הזווית הקטנה $x$, והגדולה $x + ${d}$.`, `יחד $90^\\circ$: $x + x + ${d} = 90$`, line('מכנסים', `2x + ${d} = 90`, `-${d}`), line(`מחסירים $${d}$ משני האגפים`, `2x = ${90 - d}`, ':2'), line('מחלקים ב־$2$', `x = ${x}`), q ? `הגדולה: $${x} + ${d} = ${x + d}^\\circ$` : `הקטנה: $${x}^\\circ$`, `בדיקה: $${x} + ${x + d} + 90 = 180$.`],
    { 'wrong-unknown': q ? x : null });
}
function ballsStory() {
  const [A, B] = pick(PAIRS_MF);
  for (;;) {
    const e = R(1, 3); const n2 = R(6, 20); const p = R(2, 12); if ((n2 * p) % e) continue; const x = (n2 * p) / e; if (x > 60) continue;
    const n1 = n2 + e; const q = R(0, 1);
    return story(`eq5b:${n1}:${n2}:${p}:${q}`, `${A} קנה $${n1}$ כדורים, ו${B} קנתה $${n2}$ כדורים, כל אחד יקר ב־$${p}$ ₪ מכדור של ${A}. הם שילמו אותו סכום. כמה עלה כדור של ${q ? B : A}?`, q ? x + p : x, '₪',
      `נסמנו ב־$x$ את המחיר של כדור של ${A}. כמה עולה כדור של ${B}, וכמה שילם כל אחד?`,
      [`כדור של ${A}: $x$. כדור של ${B}: $x + ${p}$.`, `$${n1}x = ${n2}(x + ${p})$`, line('פותחים סוגריים', `${n1}x = ${n2}x + ${n2 * p}`, `-${n2}x`),
        line(`מחסירים $${n2}x$ משני האגפים`, `${linTex(e, 0)} = ${n2 * p}`, e > 1 ? divOp(e) : null), ...(e > 1 ? [line(`מחלקים ב־$${e}$`, `x = ${x}`)] : []),
        q ? `כדור של ${B}: $${x} + ${p} = ${x + p}$ ₪.` : `כדור של ${A} עלה $${x}$ ₪.`, `בדיקה: $${n1} \\cdot ${x} = ${n1 * x}$, וגם $${n2} \\cdot ${x + p} = ${n2 * (x + p)}$.`],
      { 'partial-dist': q ? p / e + p : p / e, 'wrong-unknown': q ? x : null });
  }
}
function consecutiveStory() {
  const x = R(2, 40); const S = 3 * x + 3; const q = R(0, 2); const names = ['הקטן', 'האמצעי', 'הגדול'];
  return story(`eq5c:${S}:${q}`, `סכום של שלושה מספרים שלמים עוקבים הוא $${S}$. מה המספר ${names[q]} מביניהם?`, x + q, null,
    'נסמנו ב־$x$ את המספר הקטן. מה המספר שאחריו, ומה השלישי?',
    [`המספרים: $x$, $x + 1$, $x + 2$.`, `$x + x + 1 + x + 2 = ${S}$`, line('מכנסים', `3x + 3 = ${S}`, '-3'), line('מחסירים $3$ משני האגפים', `3x = ${S - 3}`, ':3'), line('מחלקים ב־$3$', `x = ${x}`), `המספרים: $${x}$, $${x + 1}$, $${x + 2}$. המספר ${names[q]}: $${x + q}$.`, `בדיקה: $${x} + ${x + 1} + ${x + 2} = ${S}$.`],
    { 'wrong-unknown': q ? x : null });
}

// ---------------------------------------------------------------- 5b. the class's word problems (CLASSROOM-8)
// The rectangle (בעיות הנדסיות), the transfer table (בעיות העברה) and angles with x, in the class's layout: נתון: and
// צ״ל:, the equation lines with their slash marks, the asked expression boxed before the number is put in
// ("\boxed{x + 5} = 11 + 5 = 16"), P and S with ס״מ and סמ״ר, ∢ for an angle. Each kind is drawn again until it is fair
// (fairStory): no mistake predicts the answer or a slip of it, no two mistakes one value, and the answer is not a
// number printed in the question (for degrees, not 180 − n, 90 − n or 360 − n of one either).

/** Is the draw fair: no prediction on the answer or a slip of it, no two on one value, the answer not printed? */
function fairStory(ans, bugs, printed, deg = false) {
  const vals = Object.values(bugs).filter((v) => v != null && Number.isFinite(v));
  if (vals.some((v) => near(v, ans) || slipOf(v, ans))) return false;
  if (new Set(vals.map((v) => v.toFixed(6))).size !== vals.length) return false;
  const guesses = printed.flatMap((n) => (deg ? [n, 180 - n, 90 - n, 360 - n] : [n]));
  return !guesses.some((g) => near(g, ans));
}
/**
 * A rectangle with two of its sides written on it (an expression, 'x + 5', or a found length, '16 ס״מ') and its equal
 * sides ticked as the class marks them: one tick on one pair of opposite sides, two on the other. `long`: the drawn
 * length of the bottom side against the right one (1).
 * @returns {import('../learn/types').GeoFig}
 */
export function rectFig(bottom, right, { long = 1.6 } = {}) {
  return {
    type: 'geo', view: [300, 190], pad: [52, 38], label: `מלבן: צלע אחת ${bottom}, והסמוכה לה ${right}`,
    pts: { _A: [0, 0], _B: [long, 0], _C: [long, 1], _D: [0, 1] },
    polys: [{ pts: ['_A', '_B', '_C', '_D'] }],
    segs: [
      { a: '_A', b: '_B', label: bottom, ticks: 1 }, { a: '_B', b: '_C', label: right, ticks: 2 },
      { a: '_C', b: '_D', ticks: 1 }, { a: '_D', b: '_A', ticks: 2 },
    ],
  };
}
const CM = 'ס״מ'; const CM2 = 'סמ״ר';

/**
 * The rectangle (eq:5, the class's geometric word problem, rectStory below): sides x and x + d (a fifth of the time x
 * and 2x, d 0), x 3..15, d 2..9, so P = 4x + 2d (or 6x). It asks x, the other side, or the area S. Mistakes: 2(x + d) opened as 2x + d
 * (partial-dist), only two sides counted, x + (x + d) = P (two-sides, the half perimeter), x answered when the other side
 * or the area was asked (wrong-unknown), and for the area the two sides added (add-sides, coord's name for it).
 */
/** A rectangle story's sides as TeX and numbers: x and x + d, or x and 2x when d is 0. */
const rectSides = (x, d) => ({ otherTex: d ? `x + ${d}` : '2x', other: d ? x + d : 2 * x, P: 2 * (x + (d ? x + d : 2 * x)) });
/** What a rectangle story asks (q 0: x, 1: the other side, 2: the area S), at a value v of x. */
export const rectAt = (d, q, v) => [v, d ? v + d : 2 * v, v * (d ? v + d : 2 * v)][q];
/** The mistakes of a rectangle story and what each gives for what was asked (shared with learn/content/eq.ts). */
export function rectBugs(x, d, q) {
  const { other, P } = rectSides(x, d);
  return {
    'partial-dist': d ? rectAt(d, q, (P - d) / 4) : null,
    'two-sides': rectAt(d, q, d ? (P - d) / 2 : P / 3),
    'wrong-unknown': q ? x : null,
    'add-sides': q === 2 ? x + other : null,
  };
}
/** The question of a rectangle story, in the class's words. */
export function rectText(x, d, q) {
  const { otherTex, P } = rectSides(x, d);
  return `צלעות המלבן שבשרטוט הן $x$ ו־$${otherTex}$ (ב${CM}), וההיקף שלו $${P}$ ${CM}. ${['מה $x$?', `מה אורך הצלע $${otherTex}$?`, 'מה שטח המלבן?'][q]}`;
}
export const rectHint = (d, q) => `ההיקף הוא סכום ארבע הצלעות: שתי צלעות $x$ ושתי צלעות $${d ? `x + ${d}` : '2x'}$.${q === 2 ? ' והשטח: אורך כפול רוחב.' : ''}`;
/** The class's layout: נתון and צ״ל, the equation lines with their marks, the asked side boxed, S, the check. */
export function rectLines(x, d, q) {
  const { otherTex, other, P } = rectSides(x, d);
  const want = ['$x = ?$', `$x = ?$, $${otherTex} = ?$`, `$x = ?$, $${otherTex} = ?$, $S = ?$`][q];
  const solving = d
    ? [`ההיקף, שתי צלעות $x$ ושתי צלעות $${otherTex}$: $P = 2x + 2(${otherTex}) = ${P}$`,
      `פותחים סוגריים: $2x + 2x + ${2 * d} = ${P}$, ומכנסים: $${opMark(`4x + ${2 * d} = ${P}`, `-${2 * d}`)}$`,
      line(`מחסירים $${2 * d}$ משני האגפים`, `4x = ${P - 2 * d}`, ':4')]
    : [`ההיקף, שתי צלעות $x$ ושתי צלעות $2x$: $P = 2x + 2 \\cdot 2x = ${P}$`, line('מכנסים', `6x = ${P}`, ':6')];
  return [
    `נתון: $P = ${P}$ ${CM}. צ״ל: ${want}`,
    ...solving,
    `מחלקים ב־$${d ? 4 : 6}$: $x = ${x}$ ${CM}`,
    ...(q ? [`$\\boxed{${otherTex}} = ${d ? `${x} + ${d}` : `2 \\cdot ${x}`} = ${other}$ ${CM}`] : []),
    ...(q === 2 ? [`$S = ${other} \\cdot ${x} = ${other * x}$ ${CM2}`] : []),
    `בדיקה: $2 \\cdot ${x} + 2 \\cdot ${other} = ${P}$`,
  ];
}
/**
 * The rectangle's drawing for a story with d (0: the sides x and 2x).
 * @param {number} d
 * @returns {import('../learn/types').GeoFig}
 */
export const rectStoryFig = (d) => rectFig(d ? `x + ${d}` : '2x', 'x', { long: d ? 1.6 : 2 });
export function rectStory() {
  for (;;) {
    const x = R(3, 15); const d = Math.random() < 0.2 ? 0 : R(2, 9); const q = R(0, 2);
    const { P, other } = rectSides(x, d); const ans = rectAt(d, q, x);
    // the unknown answered for what was asked: any other length or the area of the story (x, the other side, the
    // area), so a draw where another mistake gives one of them is drawn again, and no answer is named by chance
    // (PRODUCT2-15)
    const told = [x, other, x * other].filter((v) => !near(v, ans));
    const bugs = { ...rectBugs(x, d, q), 'wrong-unknown': null, ...Object.fromEntries(told.map((v, i) => [`wrong-unknown#${i}`, v])) };
    if (!fairStory(ans, bugs, d ? [d, P] : [P, 2])) continue;
    return {
      key: `eq5r:${x}:${d}:${q}`, text: rectText(x, d, q), form: 'num', answer: ans, unit: q === 2 ? CM2 : CM, fig: rectStoryFig(d),
      hint: rectHint(d, q), solution: rectLines(x, d, q), diag: diagNamed(ans, bugs), tries: triesOf(bugs),
    };
  }
}

/**
 * The class's transfer table: boxes in rows, before and after the move in columns.
 * @param {(string | number)[]} before
 * @param {(string | number)[]} after
 * @returns {import('../learn/types').FigSpec}
 */
export const transferFig = (before, after) => ({ type: 'table', head: ['', 'לפני ההעברה', 'אחרי ההעברה'], rows: [['תיבה א׳', before[0], after[0]], ['תיבה ב׳', before[1], after[1]]] });
/**
 * The transfer (eq:5, בעיות העברה), with the class's before-and-after table. Form 1: box A has x, box B d more; all of A
 * goes to B, which then has T = 2x + d. Asked: box B at the start. Mistakes: x answered (wrong-unknown), and 2x + d = T
 * divided as x + d = T : 2 (divide-part, only when T is even: T : 2 is then a whole number of things).
 * Form 2: g things move from A to B, and B then has k times A: x + d + g = k(x − g). Asked: A or B at the start; its
 * one mistake is the other box (wrong-unknown). Opening k(x − g) as kx − g would give x − g, box A after the move, so
 * no distribution mistake is named there: the label could not be told from a misread question.
 */
export function transferTable(form = Math.random() < 0.6 ? 1 : 2) {
  if (form === 1) {
    for (;;) {
      const x = R(3, 20); const d = R(2, 12); if (x === d) continue;
      const T = 2 * x + d; const ans = x + d;
      const bugs = { 'wrong-unknown': x, 'divide-part': T % 2 ? null : T / 2 };
      if (!fairStory(ans, bugs, [d, T, 0])) continue;
      return {
        key: `eq5x:${d}:${T}`, form: 'num', answer: ans, unit: 'פריטים',
        text: `בתיבה א׳ $x$ פריטים, ובתיבה ב׳ $${d}$ יותר. מעבירים את כל מה שבתיבה א׳ לתיבה ב׳, ועכשיו בתיבה ב׳ $${T}$ פריטים. כמה פריטים היו בתיבה ב׳ בהתחלה?`,
        fig: transferFig(['x', `x + ${d}`], ['0', '?']),
        hint: `אחרי ההעברה בתיבה ב׳ גם מה שהיה בה, $x + ${d}$, וגם מה שעבר, $x$.`,
        solution: [
          `בטבלה, אחרי ההעברה בתיבה ב׳: $x + ${d} + x = 2x + ${d}$`,
          line('המשוואה', `2x + ${d} = ${T}`, `-${d}`),
          line(`מחסירים $${d}$ משני האגפים`, `2x = ${T - d}`, ':2'),
          line('מחלקים ב־$2$', `x = ${x}`),
          `בתיבה ב׳ היו בהתחלה: $\\boxed{x + ${d}} = ${x} + ${d} = ${ans}$`,
          `בדיקה: $${ans} + ${x} = ${T}$`,
        ],
        diag: diagOf(ans, bugs), tries: triesOf(bugs),
      };
    }
  }
  for (;;) {
    const k = R(2, 4); const g = R(2, 9); const d = R(1, 12);
    const sum = d + g + k * g; if (sum % (k - 1)) continue;
    const x = sum / (k - 1); if (x <= g || x > 40) continue;
    const q = R(0, 1); const ans = q ? x + d : x;
    const bugs = { 'wrong-unknown': q ? x : x + d };
    if (!fairStory(ans, bugs, [d, g, k, d + g])) continue; // the table prints x + (d + g) after the move
    const check = `בדיקה: אחרי ההעברה $${x - g}$ ו־$${x + d + g}$, ו־$${x + d + g} = ${k} \\cdot ${x - g}$`;
    return {
      key: `eq5y:${d}:${g}:${k}:${q}`, form: 'num', answer: ans, unit: 'פריטים',
      text: `בתיבה א׳ $x$ פריטים, ובתיבה ב׳ $${d}$ יותר. מעבירים $${g}$ פריטים מתיבה א׳ לתיבה ב׳, ועכשיו בתיבה ב׳ פי $${k}$ ממה שנשאר בתיבה א׳. כמה פריטים היו בתיבה ${q ? 'ב׳' : 'א׳'} בהתחלה?`,
      fig: transferFig(['x', `x + ${d}`], [`x − ${g}`, `x + ${d + g}`]),
      hint: `אחרי ההעברה בתיבה א׳ $x - ${g}$, ובתיבה ב׳ $x + ${d + g}$. בתיבה ב׳ פי $${k}$: כופלים את כל מה שבתיבה א׳.`,
      solution: [
        `אחרי ההעברה: בתיבה א׳ $x - ${g}$, ובתיבה ב׳ $x + ${d} + ${g} = x + ${d + g}$`,
        ...agesLines(k, d + 2 * g, g, x),
        q ? `בתיבה ב׳ היו בהתחלה: $\\boxed{x + ${d}} = ${x} + ${d} = ${x + d}$. ${check}` : `בתיבה א׳ היו $${x}$. ${check}`,
      ],
      diag: diagOf(ans, bugs), tries: triesOf(bugs),
    };
  }
}

/** An angle with x as the class writes it: 2x, x + 10°, 3x − 25°. */
const angTex = (c, e) => `${linTex(c, 0)}${e ? ` ${e < 0 ? '-' : '+'} ${abs(e)}^\\circ` : ''}`;
/** The vertices of a triangle or a quadrilateral with these angles (in degrees, counterclockwise from A), or null. */
export function polyWithAngles(angles) {
  const r = (deg) => (deg * Math.PI) / 180; const u = (deg) => [Math.cos(r(deg)), Math.sin(r(deg))];
  if (angles.length === 3) {
    const [a, b, c] = angles; const ac = Math.sin(r(b)) / Math.sin(r(c));
    return [[0, 0], [1, 0], [ac * Math.cos(r(a)), ac * Math.sin(r(a))]];
  }
  // a quadrilateral walked counterclockwise from A along AB: turn by 180° − each angle; AB = 1, BC tried at a few lengths,
  // CD and DA solved so the walk closes, both in a range where no side is a sliver
  const [a, b, c] = angles; const h = [0, 180 - b, 360 - b - c, 180 + a].map(u);
  for (const bc of [1, 0.8, 1.2, 0.65, 1.5, 0.5, 1.9]) {
    const rx = -(h[0][0] + bc * h[1][0]); const ry = -(h[0][1] + bc * h[1][1]);
    const det = h[2][0] * h[3][1] - h[3][0] * h[2][1]; if (Math.abs(det) < 1e-9) continue;
    const cd = (rx * h[3][1] - h[3][0] * ry) / det; const da = (h[2][0] * ry - rx * h[2][1]) / det;
    if (cd < 0.4 || da < 0.4 || cd > 2.6 || da > 2.6) continue;
    const B = [1, 0]; const C = [B[0] + bc * h[1][0], B[1] + bc * h[1][1]];
    return [[0, 0], B, C, [C[0] + cd * h[2][0], C[1] + cd * h[2][1]]];
  }
  return null;
}
const NAMES = ['A', 'B', 'C', 'D'];
/**
 * Angles with x (eq:5; the class meets them in the geometry chapter, exs. 113 and 189): angles c·x + e in a triangle
 * (sum 180°) or a quadrilateral (sum 360°), each written on its arc of the drawing (drawn to its size). c 1..5, e 0 half
 * the time and otherwise a multiple of 5 from −20 to 30; x whole and every angle 15° to 179°. It asks x or one angle.
 * Mistakes: the other shape's sum (wrong-total, the angles topic's id), x answered for an angle (wrong-unknown), and a
 * constant's minus dropped (drop-minus, one prediction per negative constant). A prediction that is not whole or half, or
 * not positive, names nothing. The hint gives the sum, so no geometry stair is needed first.
 */
export function angleEqStory(n = Math.random() < 0.5 ? 3 : 4) {
  const total = n === 3 ? 180 : 360; const wrong = n === 3 ? 360 : 180; const shape = n === 3 ? 'במשולש' : 'במרובע';
  for (;;) {
    const c = Array.from({ length: n }, () => R(1, 5)); const e = Array.from({ length: n }, () => (Math.random() < 0.5 ? 0 : 5 * R(-4, 6)));
    const Cs = c.reduce((s, v) => s + v, 0); const Es = e.reduce((s, v) => s + v, 0);
    if ((total - Es) % Cs) continue;
    const x = (total - Es) / Cs; const ang = c.map((ci, i) => ci * x + e[i]);
    if (ang.some((v) => v < 15 || v > 179)) continue;
    const q = R(-1, n - 1); const at = (v) => (q < 0 ? v : c[q] * v + e[q]);
    const ok = (v) => (Number.isFinite(v) && Math.round(v * 2) === v * 2 && v > 0 ? v : null);
    const ans = at(x);
    // the unknown answered for what was asked: x, or another angle of the figure (each its own value), so a draw where
    // another mistake gives one of them is drawn again, and no answer is named by chance (PRODUCT2-15)
    const told = [x, ...ang].filter((v) => !near(v, ans));
    const bugs = { ...Object.fromEntries([...new Set(told)].map((v, i) => [`wrong-unknown#${i}`, v])), 'wrong-total': ok(at((wrong - Es) / Cs)) };
    e.forEach((ei, i) => { if (ei < 0) bugs[`drop-minus#${i}`] = ok(at((total - Es + 2 * ei) / Cs)); });
    // every number the question prints, with its sign and without (a guesser may take 90 − (−5))
    const printed = [...c, ...e.filter((v) => v), ...e.filter((v) => v).map(abs)];
    if (!fairStory(ans, bugs, printed, true)) continue;
    const pts = polyWithAngles(ang); if (!pts) continue;
    const P = Object.fromEntries(pts.map((p, i) => [NAMES[i], p]));
    const names = NAMES.slice(0, n);
    /** @type {import('../learn/types').GeoFig} */
    const fig = {
      type: 'geo', view: [300, 220], pad: 40, label: `${n === 3 ? 'משולש' : 'מרובע'} ${names.join('')}: ${names.map((k, i) => `∢${k} = ${angTex(c[i], e[i]).replace(/\^\\circ/g, '°').replace(/-/g, '−')}`).join(', ')}`,
      pts: P, polys: [{ pts: names }],
      segs: names.map((k, i) => ({ a: k, b: names[(i + 1) % n] })),
      angles: names.map((k, i) => ({ at: k, from: names[(i + 1) % n], to: names[(i + n - 1) % n], text: angTex(c[i], e[i]).replace(/\^\\circ/g, '°').replace(/-/g, '−'), r: 22, ...(i === q ? { target: true } : {}) })),
    };
    const list = names.map((k, i) => `$\\sphericalangle ${k} = ${angTex(c[i], e[i])}$`);
    const ask = q < 0 ? 'מה $x$?' : `מה גודל $\\sphericalangle ${names[q]}$?`;
    // the class's "פישוט + משפחות": the sum of the angles, each family on its own short line (a phone's width), the equation
    const nums = e.filter((v) => v);
    const lines = [
      `סכום הזוויות ${shape}: $${names.map((k) => `\\sphericalangle ${k}`).join(' + ')} = ${total}^\\circ$`,
      `משפחת ה־$x$: $${sumTex(c.map((ci) => [ci, 'x']))} = ${linTex(Cs, 0)}$`,
      ...(nums.length > 1 ? [`משפחת המספרים: $${sumTex(nums.map((v) => [v, '']))} = ${T(Es)}$`] : nums.length ? [`משפחת המספרים: מספר אחד, $${T(Es)}$`] : []),
      ...(Es ? [line('המשוואה', `${linTex(Cs, Es)} = ${total}`, minusOp(T(Es))), line(`${Es > 0 ? 'מחסירים' : 'מוסיפים'} $${abs(Es)}$ ${Es > 0 ? 'משני' : 'לשני'} האגפים`, `${Cs}x = ${total - Es}`, divOp(Cs))]
        : [line('המשוואה', `${Cs}x = ${total}`, divOp(Cs))]),
      line(`מחלקים ב־$${Cs}$`, `x = ${x}`),
      // the asked angle boxed, then the substitution after a word, so the line breaks there on a phone, not inside the maths
      ...(q >= 0 ? [`הזווית $\\sphericalangle ${names[q]}$ היא $\\boxed{${linTex(c[q], e[q])}}$, ובהצבה: $${c[q] === 1 ? x : `${c[q]} \\cdot ${x}`}${e[q] ? ` ${e[q] < 0 ? '-' : '+'} ${abs(e[q])}` : ''} = ${ans}^\\circ$`] : []),
      `בדיקה: ${ang.slice(0, -1).map((v) => `$${v}^\\circ$`).join(', ')} ו־$${ang[n - 1]}^\\circ$, ויחד $${total}^\\circ$`,
    ];
    return {
      key: `eq5g:${n}:${c.join(',')}:${e.join(',')}:${q}`, form: 'num', answer: ans, unit: q < 0 ? null : 'מעלות',
      text: `${n === 3 ? 'במשולש' : 'במרובע'} $${names.join('')}$ שבשרטוט: ${list.slice(0, -1).join(', ')} ו־${list[n - 1]}. ${ask}`,
      fig, hint: `סכום הזוויות ${shape} $${total}^\\circ$. מחברים את כל הביטויים, ומכנסים משפחות.`,
      solution: lines, diag: diagNamed(ans, bugs), tries: triesOf(bugs),
    };
  }
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
      // x + kx = P counts two sides only: the half perimeter (two-sides, CLASSROOM-8)
      opts = [[`2(x + ${k}x) = ${P}`, true], [`2(x + \\dfrac{x}{${k}}) = ${P}`, 'reversal'], [`x + ${k}x = ${P}`, 'two-sides'], [`x \\cdot ${k}x = ${P}`]];
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
      // the class's lines (CLASSROOM-7): the operation done to both sides after a slash, the next line named by it
      line(`בכל שעה ${bike ? 'הם מתקרבים' : 'הן מתקרבות'} $${p.v1} + ${p.v2} = ${S}$ ק״מ, ומכנסים`, `${S}x = ${p.D}`, divOp(S)),
      line(`מחלקים ב־$${S}$`, `x = ${p.t}`),
      ...(p.q === 1 ? [`${bike ? 'הראשון עבר' : 'הראשונה עברה'} עד המפגש $${p.v1} \\cdot ${p.t} = ${p.v1 * p.t}$ ק״מ.`] : [`${bike ? 'הם ייפגשו' : 'הן ייפגשו'} כעבור $${p.t}$ שעות.`]),
      `בדיקה: $${p.v1} \\cdot ${p.t} + ${p.v2} \\cdot ${p.t} = ${p.D}$`,
    ];
  }
  if (p.k === 'catch') {
    const F = firstOf(p.v1);
    return [
      `הזמן של המכונית $x$, ושל ${F.the} $x + ${p.h}$. כשהמכונית משיגה, הדרכים שוות: $${p.v2}x = ${p.v1}(x + ${p.h})$`,
      line('פותחים סוגריים', `${p.v2}x = ${p.v1}x + ${p.v1 * p.h}`, minusOp(`${p.v1}x`)),
      line(`מחסירים $${p.v1}x$ משני האגפים`, `${linTex(p.v2 - p.v1, 0)} = ${p.v1 * p.h}`, divOp(p.v2 - p.v1)),
      line(`מחלקים ב־$${p.v2 - p.v1}$`, `x = ${p.t}`),
      p.q === 1 ? `המכונית עברה עד אז $${p.v2} \\cdot ${p.t} = ${p.v2 * p.t}$ ק״מ.` : `המכונית משיגה כעבור $${p.t}$ ${p.t === 1 ? 'שעה' : 'שעות'} מיציאתה.`,
      `בדיקה: $${p.v2} \\cdot ${p.t} = ${p.v2 * p.t}$, וגם $${p.v1} \\cdot ${p.t + p.h} = ${p.v1 * (p.t + p.h)}$`,
    ];
  }
  const L = lcm(p.v1, p.v2);
  return [
    `אורך הדרך $x$. זמן הלוך $\\frac{x}{${p.v1}}$ וזמן חזור $\\frac{x}{${p.v2}}$: $${opMark(`\\frac{x}{${p.v1}} + \\frac{x}{${p.v2}} = ${p.T}`, mulOp(L))}$`,
    `כופלים את שני האגפים ב־$${L}$: $${linTex(L / p.v1, 0)} + ${linTex(L / p.v2, 0)} = ${L * p.T}$, ומכנסים: $${opMark(`${linTex(L / p.v1 + L / p.v2, 0)} = ${L * p.T}`, divOp(L / p.v1 + L / p.v2))}$`,
    line(`מחלקים ב־$${L / p.v1 + L / p.v2}$`, `x = ${p.d}`),
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

// ---------------------------------------------------------------- 7. equations with denominators and proportion
// An equation with denominators is cleared by multiplying every term of both sides by a common denominator; a numerator
// of two terms behaves as a bracket, and so does the minus before a fraction; a proportion is solved by multiplying by
// both denominators, also with x in a denominator; every answer is checked in the original (stage5.md FUNC-4). The
// diagnostic models are the critique's (EQ7: scratchpad/lanes/stage5/spec/critique/models.mjs eq7, whose second kind is
// the ז׳ programme's x + x/a = c) and the spec's (EQ7T: models.mjs eq7T), ported unchanged with the draw rule of eq:6.
// Errors and their sources:
//   lcd-partial    multiplied by the common denominator, but not the number on the other side (Booth et al. 2014,
//                  fractions errors; "forgetting to multiply BOTH sides by the LCD")
//   add-across     x/a + x/b read as 2x/(a + b) (frac's id and name; Siegler & Pyke 2013)
//   minus-bracket  the minus before the second fraction changed only the first sign of its numerator (eq's id)
//   partial-dist   the first numerator multiplied as if it were not a bracket, 2(x + p) as 2x + p; in a proportion,
//                  only x multiplied: dx + a = bx − c (eq's id; Booth et al. 2014, the fraction bar not read as a grouping)
//   sub-coef       on the last line, 5x = 60, the coefficient subtracted (eq:1's id; lastStepBugs), and on a proportion
//                  the minus of that line lost too (sign)
// "Only x divided, not the whole numerator" is eq:2's divide-part, already diagnosed on (x + p)/q = r: no new id for it.

export const EQ7 = mkModel({
  raw: (r) => {
    const k = rint6(r, 0, 2);
    if (k === 0) { // x/a + x/b = c
      const a = rint6(r, 2, 6); const b = rint6(r, 2, 6); if (a === b) return null;
      const L = lcm(a, b); const x = L * rint6(r, 1, 5); return { k, a, b, L, x, c: x / a + x / b };
    }
    if (k === 1) { // x + x/a = c
      const a = rint6(r, 2, 6); const x = a * rint6(r, 1, 8); return { k, a, x, c: x + x / a };
    }
    // (x + p)/q − (x − s)/(2q) = r
    const q = pick6(r, [2, 3]); const p = rint6(r, 1, 6); const s = rint6(r, 1, 9); const rr = rint6(r, 2, 9); const x = 2 * q * rr - 2 * p - s;
    if (x <= s) return null; return { k, q, p, s, r: rr, x };
  },
  answer: (p) => p.x,
  bugs: {
    // multiplied by the common denominator, but not the number on the other side
    'lcd-partial': (p) => (p.k === 0 ? p.c / (p.L / p.a + p.L / p.b) : p.k === 1 ? p.c / (p.a + 1) : null),
    // added across: x/a + x/b as 2x/(a + b); x + x/a as 2x/(1 + a)
    'add-across': (p) => (p.k === 0 ? (p.c * (p.a + p.b)) / 2 : p.k === 1 ? (p.c * (p.a + 1)) / 2 : null),
    // the minus before the second fraction changed only the first sign of its numerator
    'minus-bracket': (p) => (p.k === 2 ? 2 * p.q * p.r - 2 * p.p + p.s : null),
    // the first numerator, multiplied by 2, as if it were not a bracket: 2(x + p) written 2x + p
    'partial-dist': (p) => (p.k === 2 ? 2 * p.q * p.r - p.p - p.s : null),
    // the last line (the critique's model has no such id: eq:1's, added with the council's round 3), 5x = 60 after
    // the denominators: the coefficient subtracted (60 − 5). The third kind ends on x + n = m: nothing to subtract
    'sub-coef': (p) => (p.k === 0 ? lastStepBugs(p.L / p.a + p.L / p.b, p.L * p.c)['sub-coef'] : p.k === 1 ? lastStepBugs(p.a + 1, p.a * p.c)['sub-coef'] : null),
  },
  textNums: (p) => (p.k === 0 ? [p.a, p.b, p.c] : p.k === 1 ? [p.a, p.c] : [p.p, p.q, p.s, 2 * p.q, p.r]),
});
/** The spec's eq7T: a share of the money and another share of it come to c (or what is left after spending 1/a of it). */
export const EQ7T = mkModel({
  raw: (r) => {
    if (r() < 0.6) { const a = rint6(r, 2, 5); const b = rint6(r, a + 1, 6); const L = lcm(a, b); const x = L * rint6(r, 2, 10); return { k: 0, a, b, L, x, c: x / a + x / b }; }
    const a = rint6(r, 3, 6); const x = a * rint6(r, 3, 12); return { k: 1, a, x, c: x - x / a };
  },
  answer: (p) => p.x,
  bugs: {
    'lcd-partial': (p) => (p.k === 0 ? p.c / (p.L / p.a + p.L / p.b) : p.c / (p.a - 1)),
    'add-across': (p) => (p.k === 0 ? (p.c * (p.a + p.b)) / 2 : null),
    // the last line, as EQ7's: 5x = 60 or (a − 1)x = ac, the coefficient subtracted
    'sub-coef': (p) => (p.k === 0 ? lastStepBugs(p.L / p.a + p.L / p.b, p.L * p.c) : lastStepBugs(p.a - 1, p.a * p.c))['sub-coef'],
  },
  textNums: (p) => (p.k === 0 ? [1, p.a, 1, p.b, p.c] : [1, p.a, p.c]),
});

/** The equation as the student sees it (\frac, as the other eq displays write it). */
export const eq7Show = (p) => (p.k === 0 ? `\\frac{x}{${p.a}} + \\frac{x}{${p.b}} = ${p.c}` : p.k === 1 ? `x + \\frac{x}{${p.a}} = ${p.c}` : `\\frac{x + ${p.p}}{${p.q}} - \\frac{x - ${p.s}}{${2 * p.q}} = ${p.r}`);
export const eq7Key = (p) => (p.k === 0 ? `eq7:0:${p.a}:${p.b}:${p.c}` : p.k === 1 ? `eq7:1:${p.a}:${p.c}` : `eq7:2:${p.p}:${p.q}:${p.s}:${p.r}`);
export function eq7Hint(p) {
  if (p.k === 0) return `מחפשים מכנה משותף: מספר שמתחלק גם ב־$${p.a}$ וגם ב־$${p.b}$. כופלים בו כל איבר בשני האגפים, גם את $${p.c}$.`;
  if (p.k === 1) return `כופלים את שני האגפים ב־$${p.a}$, כל איבר: גם את $x$ וגם את $${p.c}$.`;
  return `כופלים כל איבר ב־$${2 * p.q}$. כל מונה הוא סוגריים, והמינוס שלפני השבר הופך את שני הסימנים שבמונה.`;
}
export function eq7Solution(p) {
  if (p.k === 0) {
    const { a, b, L, c, x } = p;
    return [
      line(`המכנה המשותף של $${a}$ ו־$${b}$ הוא $${L}$`, eq7Show(p), mulOp(L)),
      `כופלים בו כל איבר בשני האגפים: $${linTex(L / a, 0)} + ${linTex(L / b, 0)} = ${L * c}$, ומכנסים: $${opMark(`${linTex(L / a + L / b, 0)} = ${L * c}`, divOp(L / a + L / b))}$`,
      line(`מחלקים ב־$${L / a + L / b}$`, `x = ${x}`),
      `בדיקה: $${x} : ${a} + ${x} : ${b}$ הם $${x / a} + ${x / b} = ${c}$`,
    ];
  }
  if (p.k === 1) {
    const { a, c, x } = p;
    return [
      line(`המכנה הוא $${a}$`, eq7Show(p), mulOp(a)),
      `כופלים כל איבר בשני האגפים ב־$${a}$: $${linTex(a, 0)} + x = ${a * c}$, ומכנסים: $${opMark(`${linTex(a + 1, 0)} = ${a * c}`, divOp(a + 1))}$`,
      line(`מחלקים ב־$${a + 1}$`, `x = ${x}`),
      `בדיקה: $${x} + ${x} : ${a}$ הם $${x} + ${x / a} = ${c}$`,
    ];
  }
  const { q, s, r, x } = p; const Q = 2 * q;
  return [
    line(`המכנה המשותף הוא $${Q}$`, eq7Show(p), mulOp(Q)),
    `כופלים כל איבר ב־$${Q}$, וכל מונה בסוגריים: $2(x + ${p.p}) - (x - ${s}) = ${Q * r}$`,
    `פותחים סוגריים, והמינוס הופך את שני הסימנים: $2x + ${2 * p.p} - x + ${s} = ${Q * r}$`,
    line('מכנסים', `x + ${2 * p.p + s} = ${Q * r}`, undoOp(2 * p.p + s)),
    line(`מחסירים $${2 * p.p + s}$ משני האגפים`, `x = ${x}`),
    `בדיקה: $2(${x} + ${p.p}) - (${x} - ${s})$ הם $${2 * (x + p.p) - (x - s)}$, כמו $${Q} \\cdot ${r}$`,
  ];
}
const SPENDERS = ['דני', 'עומר', 'איתי', 'יואב'];
const spender = (p) => SPENDERS[(p.x + p.a) % SPENDERS.length];
export const eq7TText = (p) => (p.k === 0
  ? `${spender(p)} קיבל כסף. הוא הוציא $\\frac{1}{${p.a}}$ ממנו על ספרים ו־$\\frac{1}{${p.b}}$ ממנו על משחק, יחד $${p.c}$ ש״ח. כמה כסף קיבל?`
  : `${spender(p)} קיבל כסף. הוא הוציא $\\frac{1}{${p.a}}$ מהכסף ונשארו לו $${p.c}$ ש״ח. כמה כסף קיבל?`);
export const eq7THint = (p) => (p.k === 0
  ? `נסמן ב־$x$ את הכסף: $\\frac{x}{${p.a}} + \\frac{x}{${p.b}} = ${p.c}$. כופלים כל איבר במכנה משותף.`
  : `נסמן ב־$x$ את הכסף. נשאר $x - \\frac{x}{${p.a}}$, והוא $${p.c}$. כופלים כל איבר ב־$${p.a}$.`);
export function eq7TSolution(p) {
  if (p.k === 0) {
    const { a, b, L, c, x } = p;
    return [
      `נסמן ב־$x$ את הכסף: $${opMark(`\\frac{x}{${a}} + \\frac{x}{${b}} = ${c}`, mulOp(L))}$`,
      `כופלים כל איבר ב־$${L}$: $${linTex(L / a, 0)} + ${linTex(L / b, 0)} = ${L * c}$, ומכנסים: $${opMark(`${linTex(L / a + L / b, 0)} = ${L * c}`, divOp(L / a + L / b))}$`,
      line(`מחלקים ב־$${L / a + L / b}$`, `x = ${x}`),
      `בדיקה: $${x} : ${a} + ${x} : ${b}$ הם $${x / a} + ${x / b} = ${c}$ ש״ח.`,
    ];
  }
  const { a, c, x } = p;
  return [
    `נסמן ב־$x$ את הכסף: $${opMark(`x - \\frac{x}{${a}} = ${c}`, mulOp(a))}$`,
    `כופלים כל איבר ב־$${a}$: $${linTex(a, 0)} - x = ${a * c}$, ומכנסים: $${opMark(`${linTex(a - 1, 0)} = ${a * c}`, divOp(a - 1))}$`,
    line(`מחלקים ב־$${a - 1}$`, `x = ${x}`),
    `בדיקה: הוציא $${x} : ${a} = ${x / a}$, ונשארו $${x} - ${x / a} = ${c}$ ש״ח.`,
  ];
}

/** e7 (the critique's eq7): two fractions of x, x and a fraction of it, or two numerators with a minus between them. */
function denomItem() {
  const p = EQ7.params(rnd6); const ans = EQ7.answer(p);
  return { key: eq7Key(p), text: 'פתרו את המשוואה.', display: eq7Show(p), form: 'num', answer: ans, hint: eq7Hint(p), solution: eq7Solution(p), diag: diagOf(ans, bugsOf(EQ7, p)) };
}
/** A proportion (x + a)/b = (x − c)/d, b ≠ d, with a whole answer that is no number of the equation. */
export function propDraw(r = rnd6) {
  for (;;) {
    const b = rint6(r, 2, 7); const d = rint6(r, 2, 7); if (b === d) continue;
    const a = rint6(r, 1, 9); const c = rint6(r, 1, 9); const x = (d * a + b * c) / (b - d);
    if (!Number.isInteger(x) || abs(x) > 60 || [a, b, c, d].includes(x)) continue;
    // only x multiplied, the numerators not as brackets: dx + a = bx − c
    const pd = (a + c) / (b - d);
    if (same6(pd, x) || slipLike(pd, x) || abs(pd - x) <= 0.06) continue;
    return { a, b, c, d, x, pd };
  }
}
function propItem() {
  const { a, b, c, d, x, pd } = propDraw();
  return {
    key: `eq7p:${a}:${b}:${c}:${d}`, text: 'פתרו את המשוואה.', display: `\\frac{x + ${a}}{${b}} = \\frac{x - ${c}}{${d}}`, form: 'num', answer: x,
    hint: 'כופלים את שני האגפים בשני המכנים. כל מונה הוא סוגריים: כל המונה נכפל.',
    solution: [
      // the class's lines (CLASSROOM-7): one operation a line, after a slash
      line(`המכנים $${b}$ ו־$${d}$`, `\\frac{x + ${a}}{${b}} = \\frac{x - ${c}}{${d}}`, mulOp(b * d)),
      `כופלים את שני האגפים ב־$${b * d}$, וכל מונה בסוגריים: $${d}(x + ${a}) = ${b}(x - ${c})$`,
      line('פותחים סוגריים', `${linTex(d, d * a)} = ${linTex(b, -b * c)}`, minusOp(`${b}x`)),
      line(`מחסירים $${b}x$ משני האגפים`, `${linTex(d - b, d * a)} = ${-b * c}`, undoOp(d * a)),
      // with d − b = 1 the line is x itself: no division by 1
      ...(d - b === 1 ? [line(`מחסירים $${d * a}$ משני האגפים`, `x = ${T(x)}`)]
        : [line(`מחסירים $${d * a}$ משני האגפים`, `${linTex(d - b, 0)} = ${-b * c - d * a}`, divOp(d - b)), line(`מחלקים ב־$${T(d - b, true)}$`, `x = ${T(x)}`)]),
      `בדיקה: $${d}(${T(x)} + ${a}) = ${d * (x + a)}$, וגם $${b}(${T(x)} - ${c}) = ${b * (x - c)}$`,
    ],
    // and the last line's mistakes, on (d − b)x = −bc − da: always a minus there, of the number or of both
    diag: diagOf(x, { 'partial-dist': pd, ...lastStepBugs(d - b, (d - b) * x) }),
  };
}
/** a/x = b/c with x in the denominator: x = ac/b, whole, never a number of the equation (a/x is not b/c reduced). */
export function xDenDraw(r = rnd6) {
  for (;;) {
    const b = rint6(r, 2, 7); const c = rint6(r, b + 1, 12); if (gcdN(b, c) !== 1) continue;
    const m = rint6(r, 2, 6); const a = b * m; const x = c * m;
    if ([a, b, c].includes(x)) continue;
    return { a, b, c, m, x };
  }
}
function xDenItem() {
  const { a, b, c, m, x } = xDenDraw();
  return {
    key: `eq7x:${a}:${b}:${c}`, text: 'פתרו את המשוואה.', display: `\\frac{${a}}{x} = \\frac{${b}}{${c}}`, form: 'num', answer: x,
    hint: `$x$ במכנה: כופלים את שני האגפים ב־$${c}x$, ואז נשארת משוואה של צעד אחד.`,
    solution: [`כופלים את שני האגפים ב־$${c}x$: $${opMark(`${a * c} = ${b}x`, divOp(b))}$`, `מחלקים ב־$${b}$: $x = ${x}$`, `בדיקה: $\\frac{${a}}{${x}}$ מצטמצם ב־$${m}$ ל־$\\frac{${b}}{${c}}$.`],
    // the last line, ac = bx: the coefficient subtracted (the only one of the first stairs' mistakes it can show)
    diag: diagOf(x, lastStepBugs(b, a * c)),
  };
}
/** Pairs neither coprime nor one a multiple of the other, so the lcm, the product, the sum and the larger differ. */
export const LCD_PAIRS = [[4, 6], [6, 8], [6, 9], [4, 10], [6, 10], [8, 12], [9, 12], [10, 15]];
/**
 * The smallest common denominator: the lcm, the product (it clears the fractions too, but is not the smallest), the sum
 * and the larger denominator. Four numbers to pick from and the answer is read off them, so practice only.
 */
function lcdMc() {
  const [a, b] = pick(LCD_PAIRS); const L = lcm(a, b);
  const opts = [[L, true], [a * b], [a + b], [b]];
  const choices = shuffle(opts.map(([v, ok]) => ({ ...tex(String(v)), ok: ok === true })));
  const multiples = Array.from({ length: L / b }, (_, i) => b * (i + 1));
  return {
    key: `eq7l:${a}:${b}`, text: `מה המכנה המשותף הקטן ביותר של $${a}$ ו־$${b}$?`, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: `עוברים על הכפולות של $${b}$, ומחפשים את הראשונה שמתחלקת גם ב־$${a}$.`,
    solution: [`הכפולות של $${b}$: $${multiples.join(', ')}$. הראשונה שמתחלקת גם ב־$${a}$ היא $${L}$.`, `גם $${a * b}$ מבטל את שני המכנים, אבל $${L}$ קטן ממנו, והחשבון קצר יותר.`],
    diag: () => null,
  };
}

/**
 * The word problems' mix (CLASSROOM-8): the six stories of before at 7% each (42%), the class's rectangle 12%, the
 * transfer 10.5% (form 1 6%, form 2 4.5%), angles with x 15.5% (a triangle 8%, a quadrilateral 7.5%) and choosing the
 * equation 20%. Every kind is above 4% of the stair's questions, and each kind's mistakes show on more than 4% of its
 * own draws (learn/content.test.ts); r is a number in [0, 1).
 */
/** @type {[number, () => any][]} */
export const STORY_MIX = [
  [0.07, stampsStory], [0.07, agesStory], [0.07, parcelsStory], [0.07, anglesStory], [0.07, ballsStory], [0.07, consecutiveStory],
  [0.12, rectStory], [0.06, () => transferTable(1)], [0.045, () => transferTable(2)], [0.08, () => angleEqStory(3)], [0.075, () => angleEqStory(4)],
  [0.2, pickEquation],
];
export function storyMix(r) {
  let acc = 0;
  for (const [w, make] of STORY_MIX) { acc += w; if (r < acc) return make(); }
  return pickEquation();
}

export const EQ = {
  id: 'eq', grade: '7', title: 'משוואות', color: 'violet',
  desc: 'משוואה ופתרונה, פעולות על שני האגפים, בדיקה בהצבה, בעיות מילוליות, שאלות תנועה ומשוואות עם מכנים',
  placement: false, alsoFor: ['8'],
  levels: [
    { title: 'משוואה ופתרון', gen: () => { const r = Math.random(); return r < 0.45 ? oneStepItem() : r < 0.62 ? whichSolves() : r < 0.82 ? missingItem() : balance1(); } },
    { title: 'משוואה בשני צעדים', gen: () => { const r = Math.random(); return r < 0.45 ? twoStepItem() : r < 0.55 ? fracItem() : r < 0.65 ? collectFirst() : r < 0.8 ? rentItem() : balance2(); } },
    { title: 'נעלם בשני האגפים', gen: () => { const r = Math.random(); return r < 0.6 ? bothItem() : r < 0.75 ? howManyItem(3) : balance3(); } },
    { title: 'משוואות עם סוגריים', gen: () => { const r = Math.random(); return r < 0.62 ? bracketItem() : r < 0.8 ? examItem() : howManyItem(4); } },
    { title: 'בעיות מילוליות', gen: () => storyMix(Math.random()) },
    // the spec's mix: a motion story 50%, minutes and hours 25%, the meeting read off a graph 10%, which equation 15%
    { title: 'שאלות תנועה', gen: () => { const r = Math.random(); return r < 0.5 ? motionItem() : r < 0.75 ? minutesItem() : r < 0.85 ? meetGraph() : tableMc(); } },
    // the spec's mix: two fractions or x and a fraction of it 55%, a proportion 20%, x in a denominator 15%, the smallest
    // common denominator 10%
    { title: 'משוואות עם מכנים ופרופורציה', gen: () => { const r = Math.random(); return r < 0.55 ? denomItem() : r < 0.75 ? propItem() : r < 0.9 ? xDenItem() : lcdMc(); } },
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
    // a time found in hours and given where minutes are asked (eq:c4); the id other units use, in this unit's words
    'no-convert': 'שכחו להמיר בין שעות לדקות',
    // eq:7, equations with denominators and proportion (stage5.md FUNC-4); add-across is frac's id and name
    'lcd-partial': 'כפלו במכנה המשותף רק חלק מהאיברים',
    'add-across': 'חיברו מונה עם מונה ומכנה עם מכנה',
    // CLASSROOM-8: the rectangle, the angles with x (the angles topic's and coord's ids, expr's for a lost minus)
    'two-sides': 'בהיקף נספרו רק שתי צלעות (חצי היקף)',
    'add-sides': 'חיברו את הצלעות במקום לכפול',
    'wrong-total': 'השתמשו בסכום הזוויות הלא נכון (במשולש $180^\\circ$, במרובע $360^\\circ$)',
    'drop-minus': 'המינוס שלפני מספר נעלם ($2x - 5$ נקרא כמו $2x + 5$)',
  },
  lesson: {
    points: [
      'משוואה היא שוויון בין שני ביטויים. הפתרון הוא המספר שמאזן את שני האגפים.',
      'מה שעושים לאגף אחד עושים גם לשני, וכותבים את הפעולה בסוף השורה, אחרי קו: $x + 5 = 12 \\;/{-5}$, ובשורה הבאה $x = 7$.',
      'נעלם בשני האגפים: קודם מורידים $x$־ים, אחר כך מספרים. $3x + 5 = x + 11$, ולכן $x = 3$.',
      'סוגריים בשני שלבים: שלב 1, חוק הפילוג (פותחים סוגריים). שלב 2, פותרים כרגיל. $4(x - 3) = 2x + 6$, ולכן $x = 9$.',
      'כשיוצא $9 = x$, כותבים $x = 9$ (הפכנו צדדים).',
      'תמיד בודקים: מציבים את הפתרון במשוואה המקורית.',
      'בבעיה מילולית בודקים גם בסיפור, ועונים על מה שנשאל.',
      'שאלות תנועה: דרך = מהירות × זמן, באותן יחידות. זה לקראת זה מחברים את המהירויות, ומי שמשיג סוגר את הפער בהפרש שלהן.',
      'משוואה עם מכנים: כופלים כל איבר בשני האגפים במכנה משותף. המונה כולו נכפל, כמו סוגריים: $\\frac{x}{2} + \\frac{x}{3} = 10$, ולכן $3x + 2x = 60$.',
    ],
  },
};
