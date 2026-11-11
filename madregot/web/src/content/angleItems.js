// Angle questions that take two steps (CURRICULUM-10). A one-step angle question ("equal to the drawn angle", or
// "180° minus it") can be passed by a student who copies the number in the drawing, or completes it to a straight
// line, without reading which angle is asked. These questions need two facts in a row: three angles on a straight line,
// two adjacent angles from their difference, three lines through one point, a bisector after a crossing or after
// parallel lines, a triangle between parallel lines. Each is practised (30% of its stair's exercises) and makes most of
// its stair's checks (the level's testGen, content/grade7.js).
// Every draw is fair (fairAngle): the answer is no number printed in the question or its drawing, nor 180°, 90° or
// 360° minus one; no mistake predicts the answer or a slip of it (one off, ten off, two digits swapped); no two
// mistakes predict one value. The drawings are 'geo' figures from points, drawn to size: the given angles carry their
// degrees, the asked one a '?'. No point has a letter, since no text names one (learn/figures.test.ts).
import { R, pick, near } from './util.js';
import { slipOf } from '@/learn/misconceptions.ts';
import { diagOf, triesOf } from './eq.js';

const rad = (d) => (d * Math.PI) / 180;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** The point `len` from `from` in the direction `d` degrees, counterclockwise from the right. */
const dir = (d, len = 1, from = [0, 0]) => [r4(from[0] + len * Math.cos(rad(d))), r4(from[1] + len * Math.sin(rad(d)))];
const DEG = 'מעלות';
const ASK = 'מה גודל הזווית המסומנת ב־$?$';
const given = (v) => ({ text: `${v}°` });
const asked = { text: '?', target: true };

/**
 * Is a draw fair? The answer is not a printed number, nor 180°, 90° or 360° minus one; no prediction is the answer or
 * a slip of it; two different mistakes never predict one value (one mistake may name two values: `id#0`, `id#1`).
 */
export function fairAngle(ans, bugs, printed) {
  const vals = Object.entries(bugs).filter(([, v]) => v != null && Number.isFinite(v));
  if (vals.some(([, v]) => v <= 0 || near(v, ans) || slipOf(v, ans))) return false;
  const byValue = new Map();
  for (const [id, v] of vals) { const k = v.toFixed(6); const base = id.replace(/#\d+$/, ''); if (byValue.has(k) && byValue.get(k) !== base) return false; byValue.set(k, base); }
  return !printed.flatMap((n) => [n, 180 - n, 90 - n, 360 - n]).some((g) => near(g, ans));
}
/** The mistakes of two given angles taken one at a time: 180° minus each (one id, two values; one when they are equal). */
const oneAngle = (g0, g1) => (g0 === g1 ? { 'one-angle': 180 - g0 } : { 'one-angle#0': 180 - g0, 'one-angle#1': 180 - g1 });
/** The item's diagnosis: the mistake whose prediction the answer is, without the value's number. */
const diagFor = (ans, bugs) => { const d = diagOf(ans, bugs); return (u) => d(u)?.replace(/#\d+$/, '') || null; };

// ---------------------------------------------------------------- angles:1

/**
 * Three angles side by side on a straight line, two of them given in the drawing (key an1s:g0:g1:t:v0:v1). The
 * answer is 180° − g0 − g1. Mistakes: one given angle taken off (one-angle), a full turn used (sum-360).
 */
export function straightThree() {
  for (;;) {
    const v0 = 5 * R(5, 26); const v1 = 5 * R(5, 26); const v2 = 180 - v0 - v1;
    if (v2 < 25) continue;
    const v = [v0, v1, v2]; const t = R(0, 2);
    const [g0, g1] = v.filter((_, i) => i !== t); const ans = v[t];
    const bugs = { ...oneAngle(g0, g1), 'sum-360': 360 - g0 - g1 };
    if (!fairAngle(ans, bugs, [g0, g1])) continue;
    const spans = [['_R', '_P'], ['_P', '_Q'], ['_Q', '_L']];
    const fig = {
      type: 'geo', view: [300, 180], label: `קו ישר ושתי קרניים שיוצאות מנקודה עליו: שלוש זוויות, ${v.map((x, i) => (i === t ? 'הזווית המסומנת ב־?' : `${x}°`)).join(', ')}`,
      pts: { _L: [-3, 0], _O: [0, 0], _R: [3, 0], _P: dir(v0, 2.7), _Q: dir(v0 + v1, 2.7) },
      segs: [{ a: '_L', b: '_R' }, { a: '_O', b: '_P' }, { a: '_O', b: '_Q' }],
      angles: spans.map(([from, to], i) => ({ at: '_O', from, to, r: i === 1 ? 40 : 26, ...(i === t ? asked : given(v[i])) })),
      dots: ['_O'],
    };
    return {
      key: `an1s:${g0}:${g1}:${t}:${v0}:${v1}`, form: 'num', answer: ans, unit: DEG, fig,
      text: `שלוש זוויות יוצרות יחד זווית שטוחה. שתיים מהן נתונות. ${ASK}`,
      hint: 'שלוש הזוויות יחד הן קו ישר, $180^\\circ$. כמה מזה תופסות שתי הזוויות הנתונות?',
      solution: ['שלוש הזוויות יחד ממלאות את הקו הישר: $180^\\circ$.', `$180^\\circ - ${g0}^\\circ - ${g1}^\\circ = ${ans}^\\circ$`],
      diag: diagFor(ans, bugs), tries: triesOf(bugs),
    };
  }
}

/**
 * Two adjacent angles, one larger than the other by d (a multiple of 10, so the answer is whole): the smaller is
 * (180° − d) : 2 (key an1d:d:side). Mistakes: the larger found (took-larger), the difference taken off but not halved
 * (diff-not-halved).
 */
export function linearPairDiff() {
  for (;;) {
    const d = 10 * R(2, 14); const small = (180 - d) / 2; const big = small + d;
    const bugs = { 'took-larger': big, 'diff-not-halved': 180 - d };
    if (!fairAngle(small, bugs, [d])) continue;
    const right = Math.random() < 0.5; // the small angle on the right of the ray
    const fig = {
      type: 'geo', view: [300, 180], label: `קו ישר וקרן: שתי זוויות צמודות, הקטנה מסומנת ב־?, והגדולה גדולה ממנה ב־${d}°`,
      pts: { _L: [-3, 0], _O: [0, 0], _R: [3, 0], _B: dir(right ? small : big, 2.7) },
      segs: [{ a: '_L', b: '_R' }, { a: '_O', b: '_B' }],
      angles: [{ at: '_O', from: '_R', to: '_B', r: 26, ...(right ? asked : {}) }, { at: '_O', from: '_B', to: '_L', r: 26, ...(right ? {} : asked) }],
      dots: ['_O'],
    };
    return {
      key: `an1d:${d}:${right ? 'r' : 'l'}`, form: 'num', answer: small, unit: DEG, fig,
      text: `שתי זוויות צמודות. אחת גדולה מהשנייה ב־$${d}^\\circ$. מה גודל הזווית הקטנה?`,
      hint: 'יחד הן $180^\\circ$. אם מורידים מהגדולה את מה שהיא גדולה יותר, שתיהן שוות. כמה נשאר לשתיהן יחד?',
      solution: [
        `יחד $180^\\circ$. בלי ההפרש נשארות שתי זוויות שוות: $180^\\circ - ${d}^\\circ = ${180 - d}^\\circ$`,
        `כל אחת מהן היא חצי: $${180 - d}^\\circ : 2 = ${small}^\\circ$`,
        `בדיקה: $${small}^\\circ + ${big}^\\circ = 180^\\circ$, והגדולה גדולה ב־$${d}^\\circ$.`,
      ],
      diag: diagFor(small, bugs), tries: triesOf(bugs),
    };
  }
}

// ---------------------------------------------------------------- angles:2

/** Three sectors of three distinct sizes are three side by side somewhere, or three of the six in a row (one line). */
const inARow = (set) => [0, 1, 2, 3, 4, 5].some((s) => [s, s + 1, s + 2].every((v) => set.has(v % 6)));

/**
 * Three lines through one point: six angles, x, y, z twice each (x + y + z = 180°). Two given, of two sizes, not side
 * by side with the asked one (else it is one straight line): the asked angle is 180° minus the two, found through a
 * vertical angle (key an2t:g0:g1:i,j,k:x:y). Mistakes: one-angle, sum-360 (the six angles are 360°, three are not).
 */
export function threeLines() {
  for (;;) {
    const x = 5 * R(7, 22); const y = 5 * R(7, 22); const z = 180 - x - y;
    if (z < 35) continue;
    const size = [x, y, z, x, y, z];
    const k = R(0, 5);
    const [c0, c1] = [0, 1, 2].filter((c) => c !== k % 3);
    const [i, j] = [c0 + 3 * R(0, 1), c1 + 3 * R(0, 1)].sort((p, q) => p - q);
    if (inARow(new Set([i, j, k]))) continue;
    const g0 = size[i]; const g1 = size[j]; const ans = size[k];
    const bugs = { ...oneAngle(g0, g1), 'sum-360': 360 - g0 - g1 };
    if (!fairAngle(ans, bugs, [g0, g1])) continue;
    const ends = ['_A', '_B', '_C', '_D', '_E', '_F'];
    const at = [0, x, x + y, 180, 180 + x, 180 + x + y];
    const pts = { _O: [0, 0], ...Object.fromEntries(ends.map((n, m) => [n, dir(at[m], 2.8)])) };
    const marks = [[i, given(g0)], [j, given(g1)], [k, asked]];
    const fig = {
      type: 'geo', view: [300, 220], label: `שלושה ישרים נחתכים בנקודה אחת: שתי זוויות נתונות, ${g0}° ו־${g1}°, והזווית המבוקשת מסומנת ב־?`,
      pts, segs: [{ a: '_A', b: '_D' }, { a: '_B', b: '_E' }, { a: '_C', b: '_F' }],
      angles: marks.map(([m, mk]) => ({ at: '_O', from: ends[m], to: ends[(m + 1) % 6], r: 26, ...mk })),
      dots: ['_O'],
    };
    return {
      key: `an2t:${g0}:${g1}:${i},${j},${k}:${x}:${y}`, form: 'num', answer: ans, unit: DEG, fig,
      text: `שלושה ישרים נחתכים בנקודה אחת. ${ASK}`,
      hint: 'מול כל זווית יש זווית קודקודית ששווה לה. חפשו שלוש זוויות זו ליד זו על ישר אחד.',
      solution: [
        'זוויות קודקודיות שוות: מול כל זווית נתונה יש זווית בגודל שלה.',
        `כך יש על ישר אחד שלוש זוויות זו ליד זו: $${g0}^\\circ$, $${g1}^\\circ$ והזווית המבוקשת. יחד הן $180^\\circ$.`,
        `$180^\\circ - ${g0}^\\circ - ${g1}^\\circ = ${ans}^\\circ$`,
      ],
      diag: diagFor(ans, bugs), tries: triesOf(bugs),
    };
  }
}

/**
 * Two crossing lines, the angle a given (a multiple of 10), and a ray that halves the angle opposite it (a : 2) or one
 * beside it ((180° − a) : 2) (key an2b:a:v|s:where). Mistakes: the whole angle (no-half); the opposite angle taken
 * as supplementary (supp-not-equal) or the angle beside it as equal (equal-not-supp), then halved.
 */
export function crossBisect() {
  for (;;) {
    const a = 10 * R(4, 14); if (a === 90) continue;
    const vert = Math.random() < 0.5;
    const whole = vert ? a : 180 - a; const ans = whole / 2;
    const bugs = vert ? { 'no-half': a, 'supp-not-equal': (180 - a) / 2 } : { 'no-half': 180 - a, 'equal-not-supp': a / 2 };
    if (!fairAngle(ans, bugs, [a])) continue;
    const where = vert ? 'v' : pick(['ul', 'lr']);
    const fig = crossBisectFig(a, where, Math.random() < 0.5);
    return {
      key: `an2b:${a}:${vert ? 'v' : 's'}:${where}`, form: 'num', answer: ans, unit: DEG, fig,
      text: `שני ישרים נחתכים, וקרן חוצה את אחת הזוויות. ${ASK}`,
      hint: 'קודם מוצאים את הזווית שהקרן חוצה: היא שווה לזווית הנתונה או צמודה לה. אחר כך לוקחים חצי ממנה.',
      solution: vert
        ? [`הקרן חוצה את הזווית שמול $${a}^\\circ$. זוויות קודקודיות שוות, ולכן גם היא $${a}^\\circ$.`, `חוצה זווית מחלק אותה לשני חצאים שווים: $${a}^\\circ : 2 = ${ans}^\\circ$`]
        : [`הקרן חוצה זווית שצמודה ל־$${a}^\\circ$: $180^\\circ - ${a}^\\circ = ${whole}^\\circ$`, `חוצה זווית מחלק אותה לשני חצאים שווים: $${whole}^\\circ : 2 = ${ans}^\\circ$`],
      diag: diagFor(ans, bugs), tries: triesOf(bugs),
    };
  }
}

/**
 * Two crossing lines, the second at a degrees (the given angle, between the rays at 0° and at a), and a ray that halves
 * the angle opposite it (where 'v') or one beside it, above ('ul') or below ('lr'). The two halves carry equal double
 * arcs; the first or the second one the '?'.
 */
export function crossBisectFig(a, where, first = true) {
  const whole = where === 'v' ? a : 180 - a;
  const [from, to, start] = where === 'v' ? ['_L', '_D', 180] : where === 'ul' ? ['_U', '_L', a] : ['_D', '_R', 180 + a];
  return {
    type: 'geo', view: [300, 220], label: `שני ישרים נחתכים, זווית של ${a}°, וקרן שחוצה את ${where === 'v' ? 'הזווית שמולה' : 'אחת הזוויות שלידה'}; אחד החצאים מסומן ב־?`,
    pts: { _O: [0, 0], _R: [3, 0], _L: [-3, 0], _U: dir(a, 3), _D: dir(a + 180, 3), _M: dir(start + whole / 2, 2.5) },
    segs: [{ a: '_L', b: '_R' }, { a: '_D', b: '_U' }, { a: '_O', b: '_M', hi: true }],
    angles: [
      { at: '_O', from: '_R', to: '_U', r: 24, ...given(a) },
      { at: '_O', from, to: '_M', r: 36, n: 2, ...(first ? asked : {}) },
      { at: '_O', from: '_M', to, r: 36, n: 2, ...(first ? {} : asked) },
    ],
    dots: ['_O', '_M'],
  };
}

// ---------------------------------------------------------------- angles:4

/**
 * A triangle between two parallel lines: its top vertex on the upper line, its base on the lower one. Given: the angle
 * a between the upper line and one side (alternate to the base angle at that side's end) and the base angle b at the
 * other end; asked: the top angle, 180° − a − b (key an4t:a:b:mirror). Mistakes: one-angle; the alternate angle taken
 * as supplementary, which gives a − b (supp-not-equal, when that is an angle).
 */
export function parallelTriangle() {
  for (;;) {
    const a = 5 * R(7, 16); const b = 5 * R(7, 16); const ans = 180 - a - b;
    if (ans < 25) continue;
    const bugs = { ...oneAngle(a, b), ...(a - b > 0 ? { 'supp-not-equal': a - b } : {}) };
    if (!fairAngle(ans, bugs, [a, b])) continue;
    const mirror = Math.random() < 0.5; // the given angle on the left of the top vertex, or (mirrored) on the right
    const fig = parallelTriangleFig(a, b, mirror);
    return {
      key: `an4t:${a}:${b}:${mirror ? 1 : 0}`, form: 'num', answer: ans, unit: DEG, fig,
      text: `שני ישרים מקבילים. הקודקוד העליון של המשולש על הישר העליון, והבסיס על הישר התחתון. ${ASK}`,
      hint: 'הזווית שעל הישר העליון מתחלפת לאחת מזוויות הבסיס. אחר כך: סכום הזוויות במשולש.',
      solution: [
        `הזווית $${a}^\\circ$ שעל הישר העליון וזווית הבסיס שבאותו צד של המשולש הן זוויות מתחלפות בין המקבילים, ולכן שוות: גם זווית הבסיס היא $${a}^\\circ$.`,
        `סכום הזוויות במשולש $180^\\circ$: $180^\\circ - ${a}^\\circ - ${b}^\\circ = ${ans}^\\circ$`,
      ],
      diag: diagFor(ans, bugs), tries: triesOf(bugs),
    };
  }
}

/**
 * A triangle between two parallel lines: the top vertex _A on the upper line, the base _B_C on the lower one, the angle
 * a between the upper line and the side to _B, the base angle b at _C, and the top angle marked '?'; `mirror` puts the
 * given angle on the right.
 */
export function parallelTriangleFig(a, b, mirror = false) {
  // tall enough that the top angle's '?' and the base angle's label stay apart in a short, wide triangle
  const H = 3; const B = -H / Math.tan(rad(a)); const C = H / Math.tan(rad(b));
  // the lines run on past the triangle, so their parallel marks (at four fifths of their length) clear the corners
  const lo = Math.min(B, -1) - 1.3; const hi = Math.max(C, 1) + 2.4;
  const fx = (p) => (mirror ? [r4(-p[0]), p[1]] : [r4(p[0]), p[1]]);
  const pts = Object.fromEntries(Object.entries({ _tl: [lo, H], _tr: [hi, H], _bl: [lo, 0], _br: [hi, 0], _A: [0, H], _B: [B, 0], _C: [C, 0] }).map(([k, p]) => [k, fx(p)]));
  // an arc sweeps counterclockwise from `from` to `to`: a mirror image sweeps the other way
  const arc = (at, from, to, mk, r = 24) => ({ at, from: mirror ? to : from, to: mirror ? from : to, r, ...mk });
  return {
    type: 'geo', view: [300, 210], pad: [24, 30], label: `שני ישרים מקבילים ומשולש ביניהם: על הישר העליון זווית של ${a}° ליד צלע אחת, ליד הבסיס זווית של ${b}°, וזווית הראש מסומנת ב־?`,
    pts, polys: [{ pts: mirror ? ['_A', '_C', '_B'] : ['_A', '_B', '_C'] }],
    segs: [{ a: '_tl', b: '_tr', arrows: 1 }, { a: '_bl', b: '_br', arrows: 1 }, { a: '_A', b: '_B' }, { a: '_B', b: '_C' }, { a: '_A', b: '_C' }],
    angles: [arc('_A', '_tl', '_B', given(a), 26), arc('_C', '_A', '_B', given(b)), arc('_A', '_B', '_C', asked, 18)],
  };
}

/**
 * Two parallel lines `gap` apart (y = 0 and y = gap) and a transversal at t degrees through _L on the lower one and _U on
 * the upper one; `span(crossing, pos)` names the two rays of an angle there, by position: ur (above its line, right of
 * the transversal), ul, ll, lr; `start(pos)` is the direction its sweep starts from. The gap is wide enough that an
 * angle between the lines at one crossing and one at the other keep their labels apart.
 */
export function parallelLines(t, gap = 3) {
  const L = [0, 0]; const U = [r4(gap / Math.tan(rad(t))), gap];
  const lo = r4(Math.min(0, U[0]) - 2.8); const hi = r4(Math.max(0, U[0]) + 2.8);
  const pts = { _L: L, _U: U, _l1: [lo, 0], _r1: [hi, 0], _l2: [lo, gap], _r2: [hi, gap], _t0: dir(t + 180, 1.3, L), _t1: dir(t, 1.3, U) };
  const ways = { U: { right: '_r2', up: '_t1', left: '_l2', down: '_L' }, L: { right: '_r1', up: '_U', left: '_l1', down: '_t0' } };
  const span = (w, pos) => { const d = ways[w]; return { ur: [d.right, d.up], ul: [d.up, d.left], ll: [d.left, d.down], lr: [d.down, d.right] }[pos]; };
  const start = (pos) => ({ ur: 0, ul: t, ll: 180, lr: 180 + t }[pos]);
  return { pts, segs: [{ a: '_l1', b: '_r1', arrows: 1 }, { a: '_l2', b: '_r2', arrows: 1 }, { a: '_t0', b: '_t1' }], span, start };
}

const PAR_NAME = { corresponding: 'מתאימות', alternate: 'מתחלפות', cointerior: 'חד־צדדיות' };
/** The pairs with a name: [upper crossing, lower crossing, name]. Corresponding and alternate are equal, co-interior add to 180°. */
const EQUAL_PAIRS = [['ur', 'ur', 'corresponding'], ['ul', 'ul', 'corresponding'], ['ll', 'll', 'corresponding'], ['lr', 'lr', 'corresponding'], ['ll', 'ur', 'alternate'], ['lr', 'ul', 'alternate']];
const SUPP_PAIRS = [['ll', 'ul', 'cointerior'], ['lr', 'ur', 'cointerior']];

/**
 * Two parallel lines and a transversal at t degrees (a multiple of 10). An angle g at the upper crossing is given; a ray
 * halves an angle at the lower crossing that is corresponding or alternate to it (g : 2) or co-interior
 * ((180° − g) : 2) (key an4b:g:e|s:p:q:t). Mistakes: no-half, supp-not-equal, equal-not-supp (each then halved).
 */
export function parallelBisect() {
  for (;;) {
    const t = 10 * R(4, 14); if (t === 90) continue;
    const eq = Math.random() < 0.5;
    const [p, q, name] = pick(eq ? EQUAL_PAIRS : SUPP_PAIRS);
    const size = { ur: t, ul: 180 - t, ll: t, lr: 180 - t };
    const g = size[p]; const whole = size[q]; const ans = whole / 2;
    const bugs = eq ? { 'no-half': whole, 'supp-not-equal': (180 - g) / 2 } : { 'no-half': whole, 'equal-not-supp': g / 2 };
    if (!fairAngle(ans, bugs, [g])) continue;
    const par = parallelLines(t);
    const pts = { ...par.pts, _M: dir(par.start(q) + whole / 2, 1.3) };
    const [u0, u1] = par.span('U', p); const [l0, l1] = par.span('L', q);
    const first = Math.random() < 0.5;
    const fig = {
      type: 'geo', view: [300, 230], label: `שני ישרים מקבילים וחותך: בחיתוך העליון זווית של ${g}°, ובחיתוך התחתון קרן שחוצה זווית; אחד החצאים מסומן ב־?`,
      pts, segs: [...par.segs, { a: '_L', b: '_M', hi: true }],
      angles: [
        { at: '_U', from: u0, to: u1, r: 20, ...given(g) },
        { at: '_L', from: l0, to: '_M', r: 30, n: 2, ...(first ? asked : {}) },
        { at: '_L', from: '_M', to: l1, r: 30, n: 2, ...(first ? {} : asked) },
      ],
      dots: ['_U', '_L', '_M'],
    };
    return {
      key: `an4b:${g}:${eq ? 'e' : 's'}:${p}:${q}:${t}`, form: 'num', answer: ans, unit: DEG, fig,
      text: `שני ישרים מקבילים נחתכים על ידי ישר שלישי, וקרן חוצה את אחת הזוויות. ${ASK}`,
      hint: 'קודם מוצאים את הזווית שהקרן חוצה, בעזרת הזווית הנתונה והמקבילים. אחר כך לוקחים חצי ממנה.',
      solution: eq
        ? [`הזווית שהקרן חוצה והזווית $${g}^\\circ$ הן זוויות ${PAR_NAME[name]} בין ישרים מקבילים, ולכן הן שוות: $${g}^\\circ$.`, `חוצה זווית מחלק אותה לשני חצאים שווים: $${g}^\\circ : 2 = ${ans}^\\circ$`]
        : [`הזווית שהקרן חוצה והזווית $${g}^\\circ$ הן זוויות חד־צדדיות בין ישרים מקבילים, ולכן יחד הן $180^\\circ$: $180^\\circ - ${g}^\\circ = ${whole}^\\circ$`, `חוצה זווית מחלק אותה לשני חצאים שווים: $${whole}^\\circ : 2 = ${ans}^\\circ$`],
      diag: diagFor(ans, bugs), tries: triesOf(bugs),
    };
  }
}
