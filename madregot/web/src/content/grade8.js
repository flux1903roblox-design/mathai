// Grade 8 (ח׳): ratio (ratio.js), percent (pct.js), functions (func.js), the linear function (linear.js), Pythagoras,
// statistics (its stairs 6-8 in stats2.js), equations and systems (sys.js), probability (prob.js).
import { R, pick, shuffle, near, TRIPLES, listMath } from './util.js';
import { LINEAR } from './linear.js';
import { SYS } from './sys.js';
import { PROB } from './prob.js';
import { RATIO } from './ratio.js';
import { PCT } from './pct.js';
import { FUNC } from './func.js';
import { STATS2_LEVELS, STATS2_CATS } from './stats2.js';
import { CIRCLE } from './circle.js';
import { SPACE } from './space.js';
import { CONGR } from './congr.js';
import { SIM } from './sim.js';
import { diagOf } from './eq.js';
import { slipOf } from '@/learn/misconceptions.ts';
import { rightTrapFig } from './area.js';
import { barFig } from './data.js';

// ---------------------------------------------------------------- Pythagoras
// About half the questions come from whole-number triangles (Pythagorean triples), the rest need a root that is not
// whole, rounded to tenths, as the grade-8 programme asks (roots of numbers that are not perfect squares, and
// estimating a root). A rounded answer is right when it is within half a tenth of the exact length (`exact`).
const scaled = () => { const [a, b, c] = pick(TRIPLES); return Math.random() < 0.5 ? [a, b, c] : [b, a, c]; };
const r1 = (x) => Math.round(x * 10) / 10;
const isSquare = (n) => Number.isInteger(Math.sqrt(n));
const ROUND = 'אם יוצא מספר לא שלם, עגלו לעשירית.';
/** "= 13" for a whole root, "≈ 7.1" for one that is not. */
const eqRoot = (n) => (isSquare(n) ? `= ${Math.sqrt(n)}` : `\\approx ${r1(Math.sqrt(n))}`);
/** Two legs (each up to max) whose hypotenuse is not whole. */
function rootLegs(max = 12) { for (;;) { const a = R(2, max); const b = R(2, max); if (!isSquare(a * a + b * b)) return [a, b]; } }
/** A hypotenuse and a leg (whole) whose other leg is not whole. */
function rootLeg() { for (;;) { const c = R(5, 20); const a = R(Math.ceil(c / 3), c - 1); if (!isSquare(c * c - a * a)) return [a, c]; } }

function hypotenuse() {
  const whole = Math.random() < 0.5;
  const [a, b] = whole ? scaled() : rootLegs();
  const n = a * a + b * b; const c = Math.sqrt(n);
  return {
    key: `py1:${a}:${b}`, text: `במשולש ישר־זווית נתונים שני הניצבים. מה אורך היתר? ${ROUND}`, form: 'num', answer: whole ? c : r1(c), exact: c, unit: 'ס״מ',
    fig: { type: 'right', a, b, c: '?' },
    hint: 'במשולש ישר־זווית: $a^2 + b^2 = c^2$, כש־$c$ הוא היתר (מול הזווית הישרה).',
    solution: [`$c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${n}$`, `$c = \\sqrt{${n}} ${eqRoot(n)}$`],
    diag: (u) => [near(u, a + b) && 'add-legs', near(u, n) && 'no-root'].filter(Boolean),
  };
}

// Estimating a root without a calculator: between which two whole numbers is it?
function estimateRoot() {
  const [a, b] = rootLegs(9);
  const n = a * a + b * b; const lo = Math.floor(Math.sqrt(n));
  return {
    key: `py1e:${a}:${b}`, text: `בלי מחשבון: הניצבים $${a}$ ו־$${b}$, ולכן היתר הוא $\\sqrt{${n}}$. הוא נמצא בין שני מספרים שלמים עוקבים. כתבו את הקטן מהשניים.`,
    form: 'num', answer: lo,
    fig: { type: 'right', a, b, c: '?' },
    hint: `מחפשים את הריבוע השלם הגדול ביותר שעדיין קטן מ־$${n}$: $1, 4, 9, 16, 25, 36, 49, 64, 81, 100, \\ldots$`,
    solution: [`$${lo}^2 = ${lo * lo}$ ו־$${lo + 1}^2 = ${(lo + 1) ** 2}$`, `$${lo * lo} < ${n} < ${(lo + 1) ** 2}$, ולכן $${lo} < \\sqrt{${n}} < ${lo + 1}$`, `הקטן מהשניים: $${lo}$`],
    diag: (u) => (near(u, n) ? 'no-root' : null),
  };
}

// The theorem by building: change the legs until the square on the hypotenuse has area c².
const SQUARES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20]];
function squaresHyp() {
  const [x, y, c] = pick(SQUARES); const [a, b] = Math.random() < 0.5 ? [x, y] : [y, x];
  return {
    key: `py1s:${c}:${a}`, text: `שנו את הניצבים כך שהיתר יהיה $${c}$: הריבוע על היתר צריך שטח $${c * c}$.`, form: 'manip',
    manip: { kind: 'squares', start: { a: 2, b: 2 }, max: 16 }, answer: { c, a, b },
    hint: `במשולש ישר־זווית שטח הריבוע על היתר שווה לסכום שטחי הריבועים על הניצבים: $a^2 + b^2 = c^2$. מחפשים שני ריבועים שיחד הם $${c * c}$.`,
    solution: [`$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}$`, `$${c * c} = ${c}^2$, ולכן ניצבים $${a}$ ו־$${b}$ נותנים יתר $${c}$.`],
    diag: (u) => (u && u.a + u.b === c ? 'add-legs' : null),
  };
}

function leg() {
  const whole = Math.random() < 0.5;
  let a; let c; let n;
  if (whole) { const t = scaled(); [a, , c] = t; n = t[1] * t[1]; } else { [a, c] = rootLeg(); n = c * c - a * a; }
  const b = Math.sqrt(n);
  return {
    key: `py2:${a}:${c}`, text: `במשולש ישר־זווית נתונים היתר וניצב אחד. מה אורך הניצב השני? ${ROUND}`, form: 'num', answer: whole ? b : r1(b), exact: b, unit: 'ס״מ',
    fig: { type: 'right', a, b: '?', c },
    hint: 'מחפשים ניצב, אז מחסרים: $b^2 = c^2 - a^2$.',
    solution: [`$b^2 = ${c}^2 - ${a}^2$`, `$b^2 = ${c * c} - ${a * a} = ${n}$`, `$b = \\sqrt{${n}} ${eqRoot(n)}$`],
    diag: (u) => [near(u, Math.sqrt(a * a + c * c), 0.06) && 'add-not-sub', near(u, c - a) && 'subtract-sides', near(u, n) && 'no-root'].filter(Boolean),
  };
}

/** Three sides of a real triangle that just miss being right-angled (a triple with one side moved by one). */
function nearMiss() {
  for (;;) {
    const [a, b, c] = pick(TRIPLES);
    const s = pick([[a, b, c + 1], [a, b, c - 1], [a + 1, b, c], [a, b + 1, c], [a, b, c + 2]]);
    const [u, v, w] = [...s].sort((x, y) => x - y);
    if (u + v > w && v < w && u * u + v * v !== w * w) return shuffle(s);
  }
}
const isRightSet = (s) => { const [u, v, w] = [...s].sort((x, y) => x - y); return u * u + v * v === w * w; };
const setTex = (s) => s.join(',\\ ');
const checkLine = (s) => { const [u, v, w] = [...s].sort((x, y) => x - y); return `$${setTex(s)}$: $${u}^2 + ${v}^2 = ${u * u + v * v}$, $${w}^2 = ${w * w}$, ${u * u + v * v === w * w ? 'שווים: ישר־זווית' : 'לא שווים'}.`; };
/** Four different triangles (never the same three sides twice, in any order): each right-angled (a triple) or a near miss. */
function fourSets(right) {
  for (;;) {
    const sets = Array.from({ length: 4 }, (_, i) => (right(i) ? shuffle(scaled()) : nearMiss()));
    if (new Set(sets.map((s) => [...s].sort((x, y) => x - y).join(','))).size === 4) return sets;
  }
}

// Which of four triangles is right-angled (or none): five answers, each as likely, so testing is the only way.
function whichRight() {
  const k = R(0, 4); // 4: none of them
  const sets = fourSets((i) => i === k);
  const rightSet = sets[k];
  return {
    key: `py3w:${sets.map((s) => s.join(',')).join(';')}`, text: 'איזה מהמשולשים האלה ישר־זווית? (אורכי הצלעות בס״מ)', form: 'mc',
    choices: [...sets.map((s) => ({ tex: setTex(s) })), { text: 'אף אחד מהם' }], answer: k,
    hint: 'בכל משולש: הצלע הארוכה היא המועמדת להיות היתר. בודקים אם הריבוע שלה שווה לסכום הריבועים של שתי האחרות.',
    solution: sets.map(checkLine),
    // the side written last taken as the hypotenuse: a right triangle whose hypotenuse is not last is missed
    diag: (u) => (u === 4 && k < 4 && rightSet[2] !== Math.max(...rightSet) ? 'wrong-hyp' : null),
  };
}

// How many of four triangles are right-angled: 0 to 4, each as likely.
function howManyRight() {
  const n = R(0, 4);
  const pickRight = shuffle([0, 1, 2, 3]).slice(0, n);
  const sets = fourSets((i) => pickRight.includes(i));
  const lastHyp = sets.filter((s) => isRightSet(s) && s[2] === Math.max(...s)).length;
  return {
    key: `py3n:${sets.map((s) => s.join(',')).join(';')}`, text: 'כמה מהמשולשים בטבלה ישרי־זווית?', form: 'num', answer: n,
    fig: { type: 'table', head: ['משולש', 'אורכי הצלעות (ס״מ)'], rows: sets.map((s, i) => [['א', 'ב', 'ג', 'ד'][i], s.join(', ')]) },
    hint: 'בודקים כל משולש לבד: האם הריבוע של הצלע הארוכה שווה לסכום הריבועים של שתי האחרות?',
    solution: [...sets.map(checkLine), `ישרי־זווית: $${n}$`],
    diag: (u) => [u === 4 && n < 4 && 'assume-right', u === lastHyp && lastHyp !== n && 'wrong-hyp'].filter(Boolean),
  };
}

/**
 * A ladder in metres, never decimetres (PRODUCT2-9): its sides are drawn whole in tenths of a metre (1.2 to 3 m) and
 * shown in metres, so a triple still gives an exact answer (2.4 מטר for 2.5 and 0.7).
 */
function ladder() {
  const askHeight = Math.random() < 0.6;
  const whole = Math.random() < 0.5;
  let wall; let foot; let len; // in tenths of a metre
  if (whole) { const [a, b, c] = pick(TRIPLES.filter((t) => t[2] >= 10 && t[2] <= 30)); wall = Math.max(a, b); foot = Math.min(a, b); len = c; } else if (askHeight) {
    for (;;) { len = R(12, 30); foot = R(3, Math.floor(len / 2)); if (!isSquare(len * len - foot * foot)) break; }
    wall = Math.sqrt(len * len - foot * foot);
  } else {
    for (;;) { wall = R(10, 28); foot = R(3, Math.min(12, wall - 1)); if (!isSquare(wall * wall + foot * foot)) break; }
    len = Math.sqrt(wall * wall + foot * foot);
  }
  const m = (d) => Math.round(d * 1e5) / 1e6; // tenths to metres, as shown
  const exact = (askHeight ? wall : len) / 10;
  const n = askHeight ? len * len - foot * foot : wall * wall + foot * foot; // in hundredths of a square metre, whole
  const root = isSquare(n) ? `= ${m(Math.sqrt(n))}` : `\\approx ${r1(exact)}`;
  return {
    key: `py4:${askHeight ? 'h' : 'L'}:${m(foot)}:${m(askHeight ? len : wall)}`,
    // short enough to stay three lines on a 320px phone, so the drawing below keeps its room (e2e/layout.spec.js)
    text: askHeight
      ? `סולם באורך ${m(len)} מטר נשען על קיר, ורגלו ${m(foot)} מטר מהקיר. לאיזה גובה הוא מגיע? ${ROUND}`
      : `סולם נשען על קיר ומגיע לגובה ${m(wall)} מטר, ורגלו ${m(foot)} מטר מהקיר. מה אורך הסולם? ${ROUND}`,
    form: 'num', answer: isSquare(n) ? exact : r1(exact), exact, unit: 'מטר',
    fig: { type: 'ladder', wall: askHeight ? '?' : m(wall), foot: m(foot), len: askHeight ? m(len) : '?' },
    hint: 'הקיר, הרצפה והסולם יוצרים משולש ישר־זווית. הסולם הוא היתר.',
    solution: askHeight
      ? [`$h^2 = ${m(len)}^2 - ${m(foot)}^2 = ${n / 100}$`, `$h = \\sqrt{${n / 100}} ${root}$`]
      : [`$L^2 = ${m(wall)}^2 + ${m(foot)}^2 = ${n / 100}$`, `$L = \\sqrt{${n / 100}} ${root}$`],
    diag: (u) => [askHeight && near(u, Math.sqrt(len * len + foot * foot) / 10, 0.06) && 'add-not-sub', !askHeight && near(u, (wall + foot) / 10) && 'add-legs'].filter(Boolean),
  };
}

// ---------------------------------------------------------------- Pythagoras in two steps (the council's round 3)
// The figures grade-8 exams in this chapter build on: an altitude that splits a triangle into two right triangles, an
// isosceles triangle's height to its base, a rhombus from its diagonals, a right trapezoid's slanted leg. Each needs a
// step before the theorem (the common leg first, half the base, half the diagonals, the difference of the bases), and
// every length is whole: the right triangles are Pythagorean triples. Each mistake's prediction is read by eq.js diagOf
// (exactly, or rounded to tenths or hundredths when it is not whole), and a draw is kept only when no two predictions,
// the answer and the numbers printed in the question are the same.
const CM = 'ס״מ';
/** Every right triangle of TRIPLES both ways round: [leg, leg, hypotenuse]. */
const RIGHTS = TRIPLES.flatMap(([a, b, c]) => [[a, b, c], [b, a, c]]);
const sq = (v) => v * v;
/** Is a draw fair: no prediction is the answer, none is another's, and the answer is not a number of the question? */
function fairTwo(ans, bugs, printed) {
  // compared as a student types them, rounded to tenths: √442 ≈ 21.0 and 21 are one answer
  const vals = Object.values(bugs).filter((v) => v != null && Number.isFinite(v)).map(r1);
  // (a prediction one off the answer, or ten off, or with two digits swapped, is a slip of the hand: eq.js diagOf names
  // nothing there, so such a draw is drawn again)
  if (vals.some((v) => near(v, ans, 0.05) || slipOf(v, ans))) return false;
  if (new Set(vals.map((v) => v.toFixed(1))).size !== vals.length) return false;
  return !printed.some((v) => near(v, ans));
}
const lab = (a, b, label, extra = {}) => ({ a, b, label: String(label), ...extra });

/** An altitude AD splits ABC into two right triangles with the leg AD in common: AB, BD and DC given, AC asked (py4a:ab:bd:dc). */
function altitudeSplit() {
  for (;;) {
    const [bd, h, ab] = pick(RIGHTS); const others = RIGHTS.filter(([x, y]) => y === h && x !== bd);
    if (!others.length) continue;
    const [dc, , ac] = pick(others);
    const bugs = { 'skip-step': Math.sqrt(sq(ab) + sq(dc)), 'add-not-sub': Math.sqrt(sq(ab) + sq(bd) + sq(dc)), 'add-legs': h + dc, 'no-root': sq(ac) };
    if (!fairTwo(ac, bugs, [ab, bd, dc])) continue;
    return {
      key: `py4a:${ab}:${bd}:${dc}`, form: 'num', answer: ac, unit: CM,
      text: `במשולש $ABC$ הקטע $AD$ הוא הגובה לצלע $BC$. נתון: $AB = ${ab}$, $BD = ${bd}$ ו־$DC = ${dc}$ (בס״מ). מה אורך $AC$?`,
      fig: {
        type: 'geo', label: 'משולש והגובה לצלע BC', pts: { B: [0, 0], D: [bd, 0], C: [bd + dc, 0], A: [bd, h] }, polys: [{ pts: ['A', 'B', 'C'] }],
        segs: [lab('A', 'B', ab), lab('B', 'D', bd), lab('D', 'C', dc), lab('A', 'C', '?'), { a: 'A', b: 'D', dash: true }],
        angles: [{ at: 'D', from: 'C', to: 'A', right: true }],
      },
      hint: 'בשרטוט שני משולשים ישרי־זווית עם ניצב משותף, $AD$. קודם מוצאים את $AD$ במשולש $ABD$, ואחר כך את $AC$ במשולש $ADC$.',
      solution: [
        `במשולש $ABD$ (ישר־זווית ב־$D$): $AD^2 = ${ab}^2 - ${bd}^2$, כלומר $${sq(ab)} - ${sq(bd)} = ${sq(h)}$, ולכן $AD = ${h}$`,
        `במשולש $ADC$ (ישר־זווית ב־$D$): $AC^2 = ${h}^2 + ${dc}^2$, כלומר $${sq(h)} + ${sq(dc)} = ${sq(ac)}$, ולכן $AC = ${ac}$`,
      ],
      diag: diagOf(ac, bugs),
    };
  }
}

/** An isosceles triangle's height to its base halves the base: the height from the legs and the base, or a leg from the height and the base (py4i:h|s:s:base:h). */
function isoscelesHeight() {
  for (;;) {
    const [d, h, s] = pick(RIGHTS); const base = 2 * d;
    if (base > 30) continue;
    const askH = Math.random() < 0.6;
    const ans = askH ? h : s;
    const bugs = askH
      ? { 'base-not-halved': s > base ? Math.sqrt(sq(s) - sq(base)) : null, 'add-not-sub': Math.sqrt(sq(s) + sq(d)), 'subtract-sides': s - d }
      : { 'base-not-halved': Math.sqrt(sq(h) + sq(base)), 'add-legs': h + d };
    if (!fairTwo(ans, bugs, askH ? [s, base] : [h, base])) continue;
    return {
      key: `py4i:${askH ? 'h' : 's'}:${s}:${base}:${h}`, form: 'num', answer: ans, unit: CM,
      text: askH
        ? `במשולש שווה־שוקיים $ABC$ ($AB = AC$) השוקיים $${s}$ ס״מ והבסיס $BC = ${base}$ ס״מ. מה אורך הגובה לבסיס, $AD$?`
        : `במשולש שווה־שוקיים $ABC$ ($AB = AC$) הבסיס $BC = ${base}$ ס״מ, והגובה לבסיס הוא $AD = ${h}$ ס״מ. מה אורך השוק $AB$?`,
      fig: {
        type: 'geo', label: 'משולש שווה־שוקיים והגובה לבסיס', pts: { B: [0, 0], D: [d, 0], C: [base, 0], A: [d, h] }, polys: [{ pts: ['A', 'B', 'C'] }],
        segs: [lab('A', 'B', askH ? s : '?', { ticks: 1 }), { a: 'A', b: 'C', ticks: 1 }, lab('B', 'C', base), lab('A', 'D', askH ? '?' : h, { dash: true, side: 'in' })],
        angles: [{ at: 'D', from: 'C', to: 'A', right: true }],
      },
      hint: 'במשולש שווה־שוקיים הגובה לבסיס חוצה את הבסיס. כך מתקבל משולש ישר־זווית $ABD$, שאחד הניצבים שלו הוא חצי מהבסיס.',
      solution: [
        `הגובה לבסיס חוצה אותו: $BD = ${base} : 2 = ${d}$`,
        askH
          ? `במשולש $ABD$ (ישר־זווית ב־$D$): $AD^2 = ${s}^2 - ${d}^2$, כלומר $${sq(s)} - ${sq(d)} = ${sq(h)}$, ולכן $AD = ${h}$`
          : `במשולש $ABD$ (ישר־זווית ב־$D$): $AB^2 = ${h}^2 + ${d}^2$, כלומר $${sq(h)} + ${sq(d)} = ${sq(s)}$, ולכן $AB = ${s}$`,
      ],
      diag: diagOf(ans, bugs),
    };
  }
}

/** A rhombus's diagonals halve each other at right angles: the side from the diagonals, or a diagonal from the side and the other one (py4r:s|d:d1:d2:s). */
function rhombusSide() {
  for (;;) {
    const [x, y, s] = pick(RIGHTS); const d1 = 2 * x; const d2 = 2 * y;
    if (d1 > 40 || d2 > 40) continue;
    const askS = Math.random() < 0.6;
    const ans = askS ? s : d2;
    const bugs = askS
      ? { 'diag-not-halved': Math.sqrt(sq(d1) + sq(d2)), 'add-legs': x + y }
      : { 'half-for-whole': y, 'add-not-sub': 2 * Math.sqrt(sq(s) + sq(x)), 'diag-not-halved': s > d1 ? Math.sqrt(sq(s) - sq(d1)) : null };
    if (!fairTwo(ans, bugs, askS ? [d1, d2] : [s, d1])) continue;
    return {
      key: `py4r:${askS ? 's' : 'd'}:${d1}:${d2}:${s}`, form: 'num', answer: ans, unit: CM,
      text: askS
        ? `במעוין $ABCD$ האלכסונים הם $AC = ${d1}$ ס״מ ו־$BD = ${d2}$ ס״מ. מה אורך הצלע של המעוין?`
        : `צלע המעוין $ABCD$ היא $${s}$ ס״מ, והאלכסון $AC = ${d1}$ ס״מ. מה אורך האלכסון $BD$?`,
      fig: {
        type: 'geo', label: 'מעוין ואלכסוניו', pts: { A: [-x, 0], B: [0, -y], C: [x, 0], D: [0, y], _O: [0, 0] }, polys: [{ pts: ['A', 'B', 'C', 'D'] }],
        segs: [lab('A', 'D', askS ? '?' : s, { ticks: 1 }), { a: 'D', b: 'C', ticks: 1 }, { a: 'C', b: 'B', ticks: 1 }, { a: 'B', b: 'A', ticks: 1 },
          lab('A', 'C', d1, { dash: true, t: 0.75 }), lab('B', 'D', askS ? d2 : '?', { dash: true, t: 0.25 })],
        angles: [{ at: '_O', from: 'C', to: 'D', right: true }],
      },
      hint: 'האלכסונים של מעוין מאונכים זה לזה וחוצים זה את זה. כל צלע היא יתר של משולש ישר־זווית שהניצבים שלו הם חצאי האלכסונים.',
      solution: askS
        ? [`חצאי האלכסונים: $${d1} : 2 = ${x}$ ו־$${d2} : 2 = ${y}$`, `$AD^2 = ${x}^2 + ${y}^2$, כלומר $${sq(x)} + ${sq(y)} = ${sq(s)}$, ולכן הצלע $${s}$ ס״מ`]
        : [`חצי האלכסון $AC$: $${d1} : 2 = ${x}$`,
          `חצי האלכסון $BD$ הוא ניצב במשולש ישר־זווית שהיתר שלו הצלע: $${s}^2 - ${x}^2$, כלומר $${sq(s)} - ${sq(x)} = ${sq(y)}$, ולכן החצי הוא $${y}$`,
          `$BD = 2 \\cdot ${y} = ${d2}$`],
      diag: diagOf(ans, bugs),
    };
  }
}

/** A right trapezoid's slanted leg: the height from the short base makes a right triangle whose other leg is the bases' difference (py4t:a:b:h). */
function trapezoidLeg() {
  for (;;) {
    const [diff, h, s] = pick(RIGHTS); const b = R(3, 12); const a = b + diff;
    if (a > 30) continue;
    const bugs = { 'whole-base': Math.sqrt(sq(h) + sq(a)), 'add-legs': h + diff };
    if (!fairTwo(s, bugs, [a, b, h])) continue;
    // the trapezoid of the area stairs, with the height from the short base's end dashed down to the long base
    const tf = rightTrapFig(a, b, h, '?');
    return {
      key: `py4t:${a}:${b}:${h}`, form: 'num', answer: s, unit: CM,
      text: `בטרפז ישר־זווית הבסיסים הם $${a}$ ס״מ ו־$${b}$ ס״מ, והגובה $${h}$ ס״מ. מה אורך השוק הנטויה?`,
      fig: { ...tf, pts: { ...tf.pts, _5: [b, 0] }, segs: [...tf.segs, { a: '_3', b: '_5', dash: true }] },
      hint: 'מורידים גובה מקצה הבסיס הקצר. נוצר משולש ישר־זווית: ניצב אחד הוא הגובה, והשני הוא ההפרש בין הבסיסים.',
      solution: [`ההפרש בין הבסיסים: $${a} - ${b} = ${diff}$`, `$${h}^2 + ${diff}^2$, כלומר $${sq(h)} + ${sq(diff)} = ${sq(s)}$, ולכן השוק $${s}$ ס״מ`],
      diag: diagOf(s, bugs),
    };
  }
}

function distance() {
  for (;;) {
    const whole = Math.random() < 0.35;
    const [a, b] = whole ? scaled() : [R(1, 8), R(1, 8)];
    if (a > 12 || b > 12 || (!whole && isSquare(a * a + b * b))) continue;
    const sx = pick([1, -1]); const sy = pick([1, -1]);
    const x1 = R(-6, 6); const y1 = R(-6, 6);
    const x2 = x1 + sx * a; const y2 = y1 + sy * b;
    if (Math.abs(x2) > 6 || Math.abs(y2) > 6) continue;
    const n = a * a + b * b; const d = Math.sqrt(n);
    return {
      key: `py5:${x1}:${y1}:${x2}:${y2}`, text: `מה המרחק בין $A(${x1}, ${y1})$ ל־$B(${x2}, ${y2})$? ${ROUND}`, form: 'num', answer: whole ? d : r1(d), exact: d, unit: 'יחידות',
      fig: { type: 'coord', range: 6, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], segments: [[[x1, y1], [x2, y2]]], helper: [[x1, y1], [x2, y1], [x2, y2]] },
      hint: 'משלימים משולש ישר־זווית: הניצבים הם השינוי ב־$x$ והשינוי ב־$y$.',
      solution: [`$\\Delta x = ${a}$, $\\Delta y = ${b}$`, `$d = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${n}} ${eqRoot(n)}$`],
      diag: (u) => [near(u, a + b) && 'add-legs', near(u, n) && 'no-root'].filter(Boolean),
    };
  }
}

// ---------------------------------------------------------------- statistics
const sortNum = (arr) => [...arr].sort((x, y) => x - y);
const listTex = (arr) => arr.join(',\\ ');
// A list of numbers in a question: one expression per number inside a left-to-right isolate,
// so it keeps its order in a Hebrew line and a narrow screen can wrap it between numbers.

// The mode is a value that repeats three times among 13 or 15, with at least two others close behind (twice each):
// a value picked from the list at random is the mode only about one time in five (src/learn/guessing.test.ts).
function mode() {
  for (;;) {
    const n = pick([13, 15]); const m = R(2, 12);
    const arr = [m, m, m];
    while (arr.length < n) { const v = R(1, 15); if (arr.filter((x) => x === v).length < 2 && v !== m) arr.push(v); }
    const counts = {}; arr.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    if (Object.values(counts).filter((c) => c >= 3).length !== 1 || Object.values(counts).filter((c) => c === 2).length < 2) continue;
    const list = shuffle(arr); const max = Math.max(...arr);
    if (max === m) continue;
    return {
      key: `st1:${list.join(',')}`, text: `מה השכיח של הנתונים ${listMath(list)}?`, form: 'num', answer: m,
      hint: 'השכיח הוא הערך שמופיע הכי הרבה פעמים.',
      solution: [`$${m}$ מופיע ${counts[m]} פעמים, יותר מכל ערך אחר.`],
      diag: (u) => [near(u, max) && 'mode-max', near(u, sortNum(list)[Math.floor(n / 2)]) && 'mode-median', near(u, counts[m]) && 'mode-count'].filter(Boolean),
    };
  }
}

// The mode and the median read from a frequency table or a bar chart (the council's round 3: the teacher's 17.11 list,
// "שכיחות, שכיח ... ממוצע וחציון"): the data are the values, each as many times as its frequency.
const FREQ_CTX = [
  { what: 'את מספר האחים והאחיות של כל תלמיד בכיתה', head: 'מספר אחים', from: 0 },
  { what: 'את הציונים של תלמידי הכיתה בבוחן', head: 'ציון', from: 5 },
  { what: 'את מספר הספרים שקרא כל תלמיד בחופש', head: 'מספר ספרים', from: 1 },
  { what: 'את מספר שעות הספורט בשבוע של כל תלמיד', head: 'מספר שעות', from: 1 },
];
/** k values in a row from the context's first one, each with a frequency of 1 to 8. */
function freqData() {
  const c = R(0, FREQ_CTX.length - 1); const ctx = FREQ_CTX[c]; const k = R(4, 6);
  const vals = Array.from({ length: k }, (_, i) => ctx.from + i); const freqs = vals.map(() => R(1, 8));
  const bar = Math.random() < 0.4;
  const fig = bar
    ? barFig(vals.map(String), freqs, { step: 1, max: Math.max(...freqs) + 1, unit: 'מספר תלמידים' })
    : { type: 'table', head: [ctx.head, 'מספר תלמידים'], rows: vals.map((v, i) => [v, freqs[i]]) };
  return { c, ctx, vals, freqs, bar, fig, intro: `${bar ? 'דיאגרמת העמודות' : 'טבלת השכיחויות'} מציגה ${ctx.what}.` };
}

/**
 * The mode from a frequency table or a bar chart (key st1t:c:t|b:values:freqs): the value with the highest frequency.
 * Mistakes: that frequency itself written (mode-count), the largest value (mode-max).
 */
function modeTable() {
  for (;;) {
    const d = freqData(); const { vals, freqs } = d;
    const top = Math.max(...freqs); const at = freqs.indexOf(top);
    if (freqs.filter((f) => f === top).length > 1) continue;
    const mode = vals[at]; const bugs = { 'mode-count': top, 'mode-max': vals[vals.length - 1] };
    // (a prediction one off the answer is a slip of the hand, which diagOf never names: such a draw is drawn again)
    if (Object.values(bugs).some((v) => v === mode || slipOf(v, mode)) || bugs['mode-count'] === bugs['mode-max']) continue;
    return {
      key: `st1t:${d.c}:${d.bar ? 'b' : 't'}:${vals.join(',')}:${freqs.join(',')}`, form: 'num', answer: mode, fig: d.fig,
      text: `${d.intro} מה השכיח?`,
      hint: 'השכיח הוא הערך שמופיע הכי הרבה פעמים: מחפשים את השכיחות הגבוהה ביותר, והתשובה היא הערך שלה, לא השכיחות עצמה.',
      solution: [`השכיחות הגבוהה ביותר היא $${top}$, של הערך $${mode}$.`, `השכיח הוא הערך עצמו: $${mode}$ (ולא $${top}$, מספר הפעמים שהוא מופיע).`],
      diag: diagOf(mode, bugs),
    };
  }
}

/**
 * The median from a frequency table or a bar chart (key st2t:c:t|b:values:freqs): n data in order, the median is the
 * one in place (n + 1) : 2, or the mean of the two middle ones, found by counting the frequencies from the smallest value.
 * Mistakes: the place written for the value (position-not-value), the median of the frequencies (freq-median), the middle
 * of the values with the frequencies left out (median-of-values), the mean (mean-not-median). Each draw keeps them apart.
 */
function medianTable() {
  for (;;) {
    const d = freqData(); const { vals, freqs } = d;
    const n = freqs.reduce((a, b) => a + b, 0);
    if (n < 9 || n > 31) continue;
    const data = vals.flatMap((v, i) => Array(freqs[i]).fill(v));
    const lo = data[Math.floor((n - 1) / 2)]; const hi = data[Math.ceil((n - 1) / 2)]; const med = (lo + hi) / 2;
    const mid = (a) => { const s = sortNum(a); const k = s.length; return k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2; };
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const bugs = { 'position-not-value': (n + 1) / 2, 'freq-median': mid(freqs), 'median-of-values': mid(vals), 'mean-not-median': mean };
    const shown = Object.values(bugs).map((v) => (Math.round(v * 10) / 10).toFixed(1));
    if (new Set(shown).size !== shown.length || Object.values(bugs).some((v) => near(v, med, 0.05) || slipOf(v, med))) continue;
    const cum = freqs.map((_, i) => freqs.slice(0, i + 1).reduce((a, b) => a + b, 0));
    const until = cum.findIndex((c) => c >= Math.ceil((n + 1) / 2)) + 1;
    const odd = n % 2 === 1; const p = (n + 1) / 2;
    return {
      key: `st2t:${d.c}:${d.bar ? 'b' : 't'}:${vals.join(',')}:${freqs.join(',')}`, form: 'num', answer: med, fig: d.fig,
      text: `${d.intro} מה החציון?`,
      hint: 'קודם סופרים כמה נתונים יש: מחברים את כל השכיחויות. החציון הוא הנתון שבאמצע כשהנתונים מסודרים מהקטן לגדול: סופרים את השכיחויות מהערך הקטן עד שמגיעים למקום האמצעי.',
      solution: [
        `מספר הנתונים: $${freqs.join(' + ')} = ${n}$`,
        odd ? `החציון הוא הנתון במקום $\\frac{${n} + 1}{2} = ${p}$ בסדר עולה.` : `החציון הוא הממוצע של הנתונים במקומות $${n / 2}$ ו־$${n / 2 + 1}$ בסדר עולה.`,
        `סופרים מהערך הקטן: ${vals.slice(0, until).map((v, i) => `עד $${v}$ יש ${cum[i] === 1 ? 'נתון אחד' : `$${cum[i]}$ נתונים`}`).join(', ')}.`,
        odd ? `הנתון במקום $${p}$ הוא $${med}$, ולכן החציון $${med}$.`
          : lo === hi ? `הנתונים במקומות $${n / 2}$ ו־$${n / 2 + 1}$ הם $${lo}$, ולכן החציון $${med}$.`
            : `במקום $${n / 2}$ הנתון $${lo}$ ובמקום $${n / 2 + 1}$ הנתון $${hi}$: החציון $\\frac{${lo} + ${hi}}{2} = ${med}$.`,
      ],
      diag: diagOf(med, bugs),
    };
  }
}

function median() {
  for (;;) {
    const n = pick([7, 9, 6, 8]); const arr = Array.from({ length: n }, () => R(1, 20));
    const s = sortNum(arr);
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    if (!Number.isInteger(med * 2)) continue;
    const list = shuffle(arr);
    const unsortedMid = n % 2 ? list[(n - 1) / 2] : (list[n / 2 - 1] + list[n / 2]) / 2;
    if (near(unsortedMid, med)) continue;
    return {
      key: `st2:${list.join(',')}`, text: `מה החציון של הנתונים ${listMath(list)}?`, form: 'num', answer: med,
      hint: n % 2 ? 'מסדרים את הנתונים מהקטן לגדול. החציון הוא הערך שבאמצע.' : 'מסדרים מהקטן לגדול. במספר זוגי של נתונים, החציון הוא הממוצע של שני האמצעיים.',
      solution: [`מסודר: $${listTex(s)}$`, n % 2 ? `האמצעי: $${med}$` : `$\\frac{${s[n / 2 - 1]} + ${s[n / 2]}}{2} = ${med}$`],
      diag: (u) => [near(u, unsortedMid) && 'unsorted', near(u, arr.reduce((x, y) => x + y, 0) / n) && 'mean-not-median'].filter(Boolean),
    };
  }
}

function mean() {
  for (;;) {
    const n = R(4, 6); const arr = Array.from({ length: n }, () => R(2, 20));
    const sum = arr.reduce((x, y) => x + y, 0);
    if (sum % n) continue;
    const avg = sum / n; const s = sortNum(arr);
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    if (near(med, avg)) continue;
    return {
      key: `st3:${arr.join(',')}`, text: `מה הממוצע של הנתונים ${listMath(arr)}?`, form: 'num', answer: avg,
      hint: 'מחברים את כל הנתונים ומחלקים במספר הנתונים.',
      solution: [`סכום: $${arr.join(' + ')} = ${sum}$`, `$${sum} : ${n} = ${avg}$`],
      diag: (u) => [near(u, med) && 'median-not-mean', near(u, sum) && 'no-divide'].filter(Boolean),
    };
  }
}

// The mean by moving one value: the mean line follows the bar.
// The median by moving one value: the last bar decides which value is in the middle, and the mean line shows
// how far an outlier pulls the mean while the median hardly moves.
function medianBars() {
  const a = R(1, 3); const b = R(a + 1, 5); const c = R(b + 3, 9); const d = R(c + 1, 12);
  const t = R(b + 1, c - 1);
  const vals = shuffle([a, b, c, d]);
  const start = t === 12 ? 11 : 12;
  const sorted = [a, b, t, c, d];
  return {
    key: `st2b:${vals.join(',')}:${t}`, text: `גררו את העמודה האחרונה כך שהחציון של כל העמודות יהיה $${t}$.`, form: 'manip',
    manip: { kind: 'bars', stat: 'median', values: vals, target: t, max: 12, start }, answer: t,
    // the bar that makes the median t is t itself, the number the question names: practice, never a check
    // (CURRICULUM-10: the guessing test sets an object to a number it prints, and passed stats:2 3.7% of the time)
    practiceOnly: true,
    hint: 'מסדרים את חמשת המספרים מהקטן לגדול. החציון הוא המספר האמצעי, השלישי.',
    solution: [`בסדר עולה: $${sorted.join(',\\ ')}$`, `כדי שהמספר האמצעי יהיה $${t}$, העמודה האחרונה צריכה להיות $${t}$.`],
    diag: (u) => ((vals.reduce((s, v) => s + v, 0) + u) / 5 === t ? 'mean-not-median' : null),
  };
}

function meanBars() {
  for (;;) {
    const n = 5; const mean = R(3, 8);
    const vals = Array.from({ length: n - 1 }, () => R(1, 10));
    const sum = vals.reduce((t, v) => t + v, 0);
    const last = mean * n - sum;
    if (last < 0 || last > 12 || vals.includes(last)) continue;
    let start; do { start = R(0, 12); } while (start === last);
    return {
      key: `st3b:${vals.join(',')}:${mean}`, text: `גררו את העמודה האחרונה כך שהממוצע של כל העמודות יהיה $${mean}$.`, form: 'manip',
      manip: { kind: 'bars', values: vals, mean, max: 12, start }, answer: last,
      hint: `ממוצע $${mean}$ של $${n}$ מספרים פירושו שהסכום שלהם הוא $${mean} \\cdot ${n} = ${mean * n}$.`,
      solution: [`הסכום צריך להיות $${mean} \\cdot ${n} = ${mean * n}$.`, `סכום ארבע העמודות: $${vals.join(' + ')} = ${sum}$.`, `העמודה האחרונה: $${mean * n} - ${sum} = ${last}$.`],
      diag: (u) => (u === mean ? 'mean-as-answer' : null),
    };
  }
}

function freqMean() {
  for (;;) {
    const vals = sortNum(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, R(3, 4)));
    const freqs = vals.map(() => R(1, 6));
    const n = freqs.reduce((x, y) => x + y, 0);
    const sum = vals.reduce((acc, v, i) => acc + v * freqs[i], 0);
    const avg = sum / n;
    if (Math.round(avg * 100) / 100 !== avg) continue; // terminating, at most two decimals
    const naive = vals.reduce((x, y) => x + y, 0) / vals.length;
    if (near(naive, avg)) continue;
    return {
      key: `st4:${vals.join(',')}:${freqs.join(',')}`, text: 'בטבלה ציונים של שאלון קצר ומספר התלמידים שקיבלו כל ציון. מה הציון הממוצע?',
      form: 'num', answer: avg,
      fig: { type: 'table', head: ['ציון', 'מספר תלמידים'], rows: vals.map((v, i) => [v, freqs[i]]) },
      hint: 'כופלים כל ציון במספר התלמידים שקיבלו אותו, מחברים, ומחלקים במספר התלמידים הכולל.',
      solution: [`$${vals.map((v, i) => `${v} \\cdot ${freqs[i]}`).join(' + ')} = ${sum}$`, `מספר התלמידים: $${n}$`, `$${sum} : ${n} = ${avg}$`],
      diag: (u) => [near(u, naive) && 'ignore-freq', near(u, sum / vals.length) && 'wrong-count'].filter(Boolean),
    };
  }
}

function missingValue() {
  for (;;) {
    const n = R(4, 6); const avg = R(5, 15); const known = Array.from({ length: n - 1 }, () => R(2, 20));
    const x = avg * n - known.reduce((a, b) => a + b, 0);
    if (x < 0 || x > 30) continue;
    return {
      key: `st5:${known.join(',')}:${avg}`, text: `הממוצע של ${n} מספרים הוא $${avg}$. ${n - 1} מהם הם ${listMath(known)}. מה המספר החסר?`,
      form: 'num', answer: x,
      hint: 'ממוצע כפול מספר הנתונים נותן את הסכום של כולם. מה חסר כדי להגיע לסכום הזה?',
      solution: [`סכום כולם: $${avg} \\cdot ${n} = ${avg * n}$`, `סכום הידועים: $${known.reduce((a, b) => a + b, 0)}$`, `החסר: $${avg * n} - ${known.reduce((a, b) => a + b, 0)} = ${x}$`],
      diag: (u) => (near(u, avg) ? 'mean-as-answer' : null),
    };
  }
}

// in the order of the Ministry's תשפ״ז schedule: ratio and scale is the first unit of the year (September), percent
// the second (October), the introduction to functions the third (November, before December's rate and slope)
export const GRADE8 = [
  RATIO,
  PCT,
  FUNC,
  LINEAR,
  {
    id: 'pyth', grade: '8', title: 'משפט פיתגורס', color: 'violet',
    desc: 'יתר, ניצב, בדיקת משולש ושאלות מילוליות',
    // The updated ז׳ programme teaches squares and roots in December (unit 7.6) and Pythagoras in March (7.14), so the
    // unit joins the ז׳ path and plan from December, and Exam Rescue offers it to ז׳ (PRODUCT2-20). It stays filed under
    // ח׳ (unit 8.3, September), whose placement test has it.
    alsoFor: ['7'],
    levels: [
      { title: 'מציאת היתר', gen: () => { const r = Math.random(); return r < 0.3 ? squaresHyp() : r < 0.5 ? estimateRoot() : hypotenuse(); } },
      { title: 'מציאת ניצב', gen: leg },
      { title: 'האם המשולש ישר־זווית?', gen: () => (Math.random() < 0.5 ? whichRight() : howManyRight()) },
      // the ladder, and the two-step figures (the council's round 3): an altitude, an isosceles triangle's height, a rhombus,
      // a right trapezoid
      { title: 'שאלה מילולית', gen: () => { const r = Math.random(); return r < 0.4 ? ladder() : r < 0.55 ? altitudeSplit() : r < 0.7 ? isoscelesHeight() : r < 0.85 ? rhombusSide() : trapezoidLeg(); } },
      { title: 'מרחק בין נקודות', gen: distance },
    ],
    cats: {
      'add-legs': 'חיברו את הצלעות בלי לרבע',
      'no-root': 'שכחו להוציא שורש',
      'add-not-sub': 'חיברו ריבועים במקום לחסר (כשמחפשים ניצב)',
      'subtract-sides': 'חיסרו צלעות בלי לרבע',
      'wrong-hyp': 'בדקו את הצלע שכתובה אחרונה כאילו היא היתר',
      'assume-right': 'קבעו שהמשולש ישר־זווית בלי לבדוק',
      // the two-step figures of pyth:4 (the council's round 3)
      'skip-step': 'השתמשו בצלע של משולש אחד כאילו היא צלע של המשולש השני, בלי למצוא קודם את הניצב המשותף',
      'base-not-halved': 'לקחו את כל הבסיס במקום חצי ממנו: הגובה לבסיס במשולש שווה־שוקיים חוצה את הבסיס',
      'diag-not-halved': 'לקחו אלכסונים שלמים במקום חצאים: האלכסונים של מעוין חוצים זה את זה',
      'half-for-whole': 'מצאו חצי אלכסון ולא הכפילו ב־$2$',
      'whole-base': 'לקחו בסיס שלם במקום ההפרש בין הבסיסים',
    },
  },
  // the circle, the cylinder and the cone (stage 2, MEASURE-4): October and November, after Pythagoras (September and
  // October), whose theorem gives the cone's height; cobalt between pyth's violet and stats' fuchsia
  CIRCLE,
  {
    id: 'stats', grade: '8', title: 'סטטיסטיקה', color: 'fuchsia',
    desc: 'שכיח, חציון, ממוצע וטבלת שכיחויות; טווח, שני מקורות מידע, אינטרפולציה ואקסטרפולציה',
    // ז׳ learns the mode in January (unit 7.15): the unit joins the ז׳ path from then (PRODUCT2-20)
    alsoFor: ['7'],
    // The first-day placement test reaches stats:1-5 only (taught from September): stats:6-8 are December and January
    // stairs, and eight levels instead of five would move every probe (lib/placement.js reads placementTop).
    placementTop: 5,
    levels: [
      // the mode and the median also from a frequency table or a bar chart (the council's round 3)
      { title: 'שכיח', gen: () => (Math.random() < 0.35 ? modeTable() : mode()) },
      { title: 'חציון', gen: () => { const r = Math.random(); return r < 0.3 ? medianBars() : r < 0.65 ? median() : medianTable(); } },
      { title: 'ממוצע', gen: () => (Math.random() < 0.5 ? meanBars() : mean()) },
      { title: 'ממוצע מטבלה', gen: freqMean },
      { title: 'נתון חסר', gen: missingValue },
      // the rest of units 8.10 and 8.11 (curriculum stage 3, DATA-5): content/stats2.js
      ...STATS2_LEVELS,
    ],
    cats: {
      'mode-max': 'בחרו את הערך הגדול ביותר במקום השכיח',
      'mode-median': 'בחרו את האמצעי במקום השכיח',
      'mode-count': 'כתבו כמה פעמים הערך מופיע, ולא את הערך',
      unsorted: 'לקחו את האמצעי בלי לסדר קודם',
      'mean-not-median': 'חישבו ממוצע במקום חציון',
      'median-not-mean': 'חישבו חציון במקום ממוצע',
      'no-divide': 'שכחו לחלק במספר הנתונים',
      'ignore-freq': 'התעלמו ממספר התלמידים בכל ציון',
      'wrong-count': 'חילקו במספר השורות ולא במספר התלמידים',
      'mean-as-answer': 'כתבו את הממוצע במקום המספר החסר',
      // the median from a frequency table (the council's round 3)
      'position-not-value': 'כתבו את המקום של החציון בסדר, ולא את הנתון שנמצא במקום הזה',
      'freq-median': 'חישבו את החציון של השכיחויות, ולא של הנתונים',
      'median-of-values': 'לקחו את הערך האמצעי בטבלה בלי להתחשב בשכיחויות',
      ...STATS2_CATS,
    },
  },
  // congruent triangles, January and February (8.12), and isosceles triangles and similarity, March and April (8.13),
  // before the systems of February–May, which end the year
  CONGR,
  SIM,
  SYS,
  // curriculum stage 3 (DATA-6): "הסתברות ב" (March), after the systems
  PROB,
  // Pythagoras in space (stage 2, MEASURE-5): May's unit, last on the path; sky after prob's fuchsia
  SPACE,
];
