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
import { R, pick, near, T, minusOp, divOp } from './util.js';
import { slipOf } from '@/learn/misconceptions.ts';
import { diagOf, triesOf, line } from './eq.js';
import { fan, splitTri } from '@/learn/content/geo.ts';

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
/**
 * The item's diagnosis: the mistake whose prediction the answer is, without the value's number (or several whose
 * predictions are the same number: eq.js diagOf names them all, PRODUCT2-15).
 */
const diagFor = (ans, bugs) => {
  const d = diagOf(ans, bugs);
  return (u) => { const ids = [...new Set([d(u) || []].flat().map((id) => id.replace(/#\d+$/, '')))]; return ids.length > 1 ? ids : ids[0] || null; };
};

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

/**
 * The fan (CLASSROOM-9): rays OA, OB, OC with ∢AOC = T and ∢AOB = a; ∢BOC = T − a (key an1f:T:a). The two angles are
 * side by side but OA and OC are not on one line, so they do not add up to 180°. Mistakes: adjacent-not-line (180° − a,
 * "side by side means 180°", the class's notes), sum-not-diff (T + a). T is 95° to 165°; a is at least 30° and ∢BOC at
 * least 20° (the spec's 15° each draws a number that no longer fits its angle), so each number fits inside its own angle
 * in the drawing, clear of the rays (learn/figures.test.ts).
 */
export function fanItem() {
  for (;;) {
    // every (T, a) pair equally likely, so no answer is much more common than another
    const T = 5 * R(19, 33); const a = 5 * R(6, 29); const ans = T - a;
    if (ans < 20 || a === ans) continue;
    const bugs = { 'adjacent-not-line': 180 - a, 'sum-not-diff': T + a };
    if (!fairAngle(ans, bugs, [T, a])) continue;
    const fig = { ...fan(T, a, { AOC: given(T), AOB: given(a), BOC: asked }), label: `שלוש קרניים מ־O: ∢AOC = ${T}°, ∢AOB = ${a}°, ו־∢BOC מסומנת ב־?` };
    return {
      key: `an1f:${T}:${a}`, form: 'num', answer: ans, unit: DEG, fig,
      text: `$\\sphericalangle AOC = ${T}^\\circ$ ו־$\\sphericalangle AOB = ${a}^\\circ$. מה גודל $\\sphericalangle BOC$?`,
      hint: '$\\sphericalangle AOB$ ו־$\\sphericalangle BOC$ יחד הן $\\sphericalangle AOC$. הן זו ליד זו, אבל $OA$ ו־$OC$ לא על ישר אחד.',
      solution: ['$\\sphericalangle AOB + \\sphericalangle BOC = \\sphericalangle AOC$', `$\\sphericalangle BOC = ${T}^\\circ - ${a}^\\circ = ${ans}^\\circ$`, `הן לא משלימות ל־$180^\\circ$: $OA$ ו־$OC$ לא על ישר אחד, ויחד הן $${T}^\\circ$.`],
      diag: diagFor(ans, bugs), tries: triesOf(bugs),
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
 * @returns {import('../learn/types').GeoFig}
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

// ---------------------------------------------------------------- angles:3

const SPLIT = 'במשולש ישר־זווית $ABC$ ($\\sphericalangle C = 90^\\circ$) הנקודה $D$ על הצלע $BC$.';
/**
 * The class's split triangle, S1 (CLASSROOM-11): ∢BAC = w and ∢ADC = d given; β = 90° − w (the big triangle ABC) or
 * α = ∢DAC = 90° − d (the small ADC) asked (key an3a:w:d:b|a). Both are 90° minus a printed number, so it is practice
 * only. Mistakes: one-angle (the right angle forgotten: 180° − w or 180° − d), other-vertex (β paired with d at D).
 * w is 40° to 60° and d 48° to 70°, with ∢BAD = w + d − 90° at least 21° and ∢DAC = 90° − d at least 20°: the two
 * parts of the angle at A are wide enough for their numbers, and D is far enough from C for d's (learn/figures.test.ts).
 */
export function splitTriangleS1() {
  for (;;) {
    const w = R(40, 60); const d = R(48, 70); const beta = 90 - w;
    if (w + d - 90 < 21) continue;
    const askBeta = Math.random() < 0.5;
    const ans = askBeta ? beta : 90 - d;
    const bugs = askBeta ? { 'one-angle': 180 - w, 'other-vertex': 180 - d } : { 'one-angle': 180 - d };
    if (!fairAngle(ans, bugs, [])) continue;
    // β answered 180° − d is also one angle taken from 180° with the right angle forgotten, as 180° − w is: both
    // mistakes are named for it (PRODUCT2-15); fairAngle above saw them apart, each once
    const named = askBeta ? { 'one-angle#0': 180 - w, 'one-angle#1': 180 - d, 'other-vertex': 180 - d } : bugs;
    const fig = splitTri(beta, d, { BAC: given(w), ADC: given(d), [askBeta ? 'B' : 'DAC']: { text: askBeta ? 'β' : 'α', target: true } });
    return {
      key: `an3a:${w}:${d}:${askBeta ? 'b' : 'a'}`, form: 'num', answer: ans, unit: DEG, fig, practiceOnly: true,
      text: `${SPLIT} $\\sphericalangle BAC = ${w}^\\circ$ ו־$\\sphericalangle ADC = ${d}^\\circ$. ${askBeta ? 'מה גודל $\\beta$, הזווית ב־$B$?' : 'מה גודל $\\alpha = \\sphericalangle DAC$?'}`,
      hint: 'בשרטוט שלושה משולשים. חפשו משולש שיש בו את הזווית המבוקשת ועוד שתי זוויות ידועות. גם הזווית הישרה ידועה.',
      solution: askBeta
        ? ['במשולש הגדול $ABC$: סכום זוויות ב־$\\Delta$ שווה $180^\\circ$.', `$\\beta = 180^\\circ - 90^\\circ - ${w}^\\circ = ${beta}^\\circ$`]
        : ['במשולש הקטן $ADC$: סכום זוויות ב־$\\Delta$ שווה $180^\\circ$.', `$\\alpha = 180^\\circ - 90^\\circ - ${d}^\\circ = ${90 - d}^\\circ$`],
      diag: diagFor(ans, named), tries: triesOf(named),
    };
  }
}

/**
 * The split triangle, S2 (CLASSROOM-11): ∢ADC = d (48° to 72°) and ∢BAD = p (20° to 40°) given; β = d − p (at least
 * 23°), through the left triangle ABD, whose angle at D is 180° − d (key an3b:d:p). Mistakes: other-vertex (β + d = 180°,
 * the notebook's line), part-for-whole (∢BAD taken for the whole angle at A in ABC: 90° − p). The spec's d up to 80° and
 * p from 10° draw a number that no longer fits its angle (a 10° wedge, or D a few pixels from C), so the ranges stop
 * where every number still sits clear inside its own angle (learn/figures.test.ts).
 */
export function splitTriangleS2() {
  for (;;) {
    const d = R(48, 72); const p = R(20, 40); const beta = d - p;
    if (beta < 23) continue;
    const bugs = { 'other-vertex': 180 - d, 'part-for-whole': 90 - p };
    if (!fairAngle(beta, bugs, [d, p, 90])) continue;
    const fig = splitTri(beta, d, { ADC: given(d), BAD: given(p), B: { text: 'β', target: true } });
    return {
      key: `an3b:${d}:${p}`, form: 'num', answer: beta, unit: DEG, fig,
      text: `${SPLIT} $\\sphericalangle ADC = ${d}^\\circ$ ו־$\\sphericalangle BAD = ${p}^\\circ$. מה גודל $\\beta$, הזווית ב־$B$?`,
      hint: 'במשולש $ABD$ יש את $\\beta$ ואת $\\sphericalangle BAD$. הזווית השלישית שלו, ב־$D$, צמודה ל־$\\sphericalangle ADC$.',
      solution: [
        `$\\sphericalangle ADB$ צמודה ל־$\\sphericalangle ADC$: $180^\\circ - ${d}^\\circ = ${180 - d}^\\circ$`,
        `במשולש $ABD$, סכום זוויות ב־$\\Delta$ שווה $180^\\circ$: $\\beta = 180^\\circ - ${p}^\\circ - ${180 - d}^\\circ = ${beta}^\\circ$`,
      ],
      diag: diagFor(beta, bugs), tries: triesOf(bugs),
    };
  }
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
 * @returns {import('../learn/types').GeoFig}
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
 * @returns {{ pts: Record<string, [number, number]>, segs: { a: string, b: string, arrows?: number }[], span: (w: 'U' | 'L', pos: string) => [string, string], start: (pos: string) => number }}
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

// ---------------------------------------------------------------- angles:4, ח׳'s continuation (unit 8.3)
// The council's round 3, from the teacher's message for the 17.11 exam ("זוויות מתחלפות ומתאימות בין ישרים מקבילים
// (המשך מכיתה ז׳)"): angles written with x, the converse (are the two lines parallel, and why), and a point between the
// parallels with a helper line through it. ז׳ meets angles:4 in September to November, months before its equations
// (unit 7.8, March): content/grade7.js draws these only when the learner is not in ז׳ (content/learner.js).

/** a·x + c as the class writes an angle, with its degree sign (CLASSROOM-8): 3x + 10^\circ, x - 15^\circ. */
const xAngle = (a, c) => `${a === 1 ? '' : a}x${c ? ` ${c < 0 ? '-' : '+'} ${Math.abs(c)}` : ''}^\\circ`;
/** The same as an equation's side, without the degree sign. */
const xSide = (a, c) => xAngle(a, c).replace('^\\circ', '');
/** The same on a drawing: 3x + 10°, with a real minus. */
const xLabel = (a, c) => xAngle(a, c).replace('^\\circ', '°').replace(/-/g, '−');
/** a·x + c with x substituted, as the check line writes it: 3 \cdot 20 + 10. */
const xAt = (a, c, x) => `${a === 1 ? x : `${a} \\cdot ${x}`} ${c < 0 ? '-' : '+'} ${Math.abs(c)}`;
/** A prediction that is an angle a student could write: positive, below 180°, whole or a half. */
const okAngle = (v) => (v != null && Number.isFinite(v) && Math.round(v * 2) === v * 2 && v > 0 && v < 180 ? v : null);

/**
 * Two parallel lines and a transversal; two angles of a named pair written with x, a1·x + c1 at the upper crossing and
 * a2·x + c2 at the lower one: corresponding or alternate (equal), or co-interior (180° together). Asked: x, or the size of
 * the upper angle. The drawing is to size (the transversal at the angle x gives), each angle with its expression
 * (key an4x:e|s:a1:c1:a2:c2:x|a:p:q). Mistakes: the pair taken as the other kind, so the other equation is solved
 * (supp-not-equal for an equal pair, equal-not-supp for a co-interior one), and the unknown answered for what was asked
 * (wrong-unknown: an angle's size for x, x for the size). Every draw is fair (fairAngle).
 */
export function parallelX() {
  for (;;) {
    const eq = Math.random() < 0.6;
    const [p, q, name] = pick(eq ? EQUAL_PAIRS : SUPP_PAIRS);
    const x = R(5, 35); const a1 = R(1, 6); const a2 = R(1, 6); const c1 = 5 * R(-10, 12);
    const V1 = a1 * x + c1;
    // both angles 55° or more, so a label as long as 3x − 15° fits inside its own angle (components/geoLayout.js)
    if (V1 < 55 || V1 > 125 || V1 === 90) continue;
    const V2 = eq ? V1 : 180 - V1; const c2 = V2 - a2 * x;
    if (c2 % 5 || Math.abs(c2) > 80 || !c1 || !c2 || (eq && a1 === a2)) continue;
    const askX = Math.random() < 0.7;
    const ans = askX ? x : V1;
    // the other kind of pair: 180° together for an equal pair, equal for a co-interior one
    const xw = eq ? (180 - c1 - c2) / (a1 + a2) : a1 === a2 ? null : (c2 - c1) / (a1 - a2);
    const other = eq ? 'supp-not-equal' : 'equal-not-supp';
    const bugs = askX
      ? { [other]: okAngle(xw), 'wrong-unknown#0': V1, ...(V2 !== V1 ? { 'wrong-unknown#1': V2 } : {}) }
      : { [other]: okAngle(xw) == null ? null : okAngle(a1 * xw + c1), 'wrong-unknown': x };
    if (!fairAngle(ans, bugs, [a1, Math.abs(c1), a2, Math.abs(c2)])) continue;
    const t = p === 'ur' || p === 'll' ? V1 : 180 - V1;
    const par = parallelLines(t, 3.6);
    const [u0, u1] = par.span('U', p); const [l0, l1] = par.span('L', q);
    // each expression near the parallel line its angle sits on (the arm along the line is `from` for ur and ll, `to` for
    // ul and lr), so two angles between the lines keep their labels apart
    const toLine = (pos) => (pos === 'ur' || pos === 'll' ? 0.3 : 0.7);
    const fig = {
      type: 'geo', view: [300, 240], label: `שני ישרים מקבילים וחותך: בחיתוך העליון זווית ${xLabel(a1, c1)}, ובחיתוך התחתון זווית ${xLabel(a2, c2)}`,
      pts: par.pts, segs: par.segs,
      angles: [{ at: '_U', from: u0, to: u1, r: 20, lt: toLine(p), text: xLabel(a1, c1) }, { at: '_L', from: l0, to: l1, r: 20, lt: toLine(q), text: xLabel(a2, c2) }],
      dots: ['_U', '_L'],
    };
    let steps;
    if (eq) {
      // the side with more x on the left, as the class moves the x-terms
      const [A, B] = a1 >= a2 ? [[a1, c1], [a2, c2]] : [[a2, c2], [a1, c1]];
      const d = A[0] - B[0]; const r = B[1] - A[1];
      steps = [
        `הזוויות ${PAR_NAME[name]} בין ישרים מקבילים, ולכן הן שוות:`,
        line('', `${xSide(...A)} = ${xSide(...B)}`, minusOp(`${B[0] === 1 ? '' : B[0]}x`)),
        line('', `${xSide(d, A[1])} = ${B[1]}`, minusOp(T(A[1]))),
        d === 1 ? line('', `x = ${r}`) : line('', `${d}x = ${r}`, divOp(d)),
        ...(d === 1 ? [] : [line('', `x = ${x}`)]),
      ];
    } else {
      const s = a1 + a2; const cs = c1 + c2;
      steps = [
        'הזוויות חד־צדדיות בין ישרים מקבילים, ולכן יחד הן $180^\\circ$:',
        `$${xSide(a1, c1)} + ${xSide(a2, c2)} = 180$`,
        line('כינוס', `${xSide(s, cs)} = 180`, cs ? minusOp(T(cs)) : divOp(s)),
        ...(cs ? [line('', `${s}x = ${180 - cs}`, divOp(s))] : []),
        line('', `x = ${x}`),
      ];
    }
    const check = `בדיקה: $${xAt(a1, c1, x)} = ${V1}^\\circ$ ו־$${xAt(a2, c2, x)} = ${V2}^\\circ$${eq ? ', שוות' : ', ויחד $180^\\circ$'}.`;
    return {
      key: `an4x:${eq ? 'e' : 's'}:${a1}:${c1}:${a2}:${c2}:${askX ? 'x' : 'a'}:${p}:${q}`, form: 'num', answer: ans, unit: askX ? null : DEG, fig,
      text: `שני ישרים מקבילים נחתכים על ידי ישר שלישי. בשרטוט מסומנות שתי זוויות: $${xAngle(a1, c1)}$ ו־$${xAngle(a2, c2)}$. ${askX ? 'מצאו את $x$.' : `מה גודל הזווית $${xAngle(a1, c1)}$?`}`,
      hint: 'מה הקשר בין שתי הזוויות: מתאימות, מתחלפות או חד־צדדיות? זוויות מתאימות ומתחלפות שוות, וזוויות חד־צדדיות יחד $180^\\circ$. מזה בונים משוואה.',
      solution: askX ? [...steps, check] : [...steps, `הזווית: $${xAt(a1, c1, x)} = ${V1}^\\circ$`],
      diag: diagFor(ans, bugs), tries: triesOf(bugs),
    };
  }
}

/**
 * The converse: two lines (drawn to size, not marked parallel) cut by a transversal, and two angles of a named pair given
 * in degrees. Are the lines parallel, and why? Four choices, each a yes or a no with a reason about this pair: equal, or
 * 180° together. The draws: parallel; a trap, where the pair has the other kind's property (corresponding angles of
 * 85° and 95°, together 180°; co-interior angles both 85°), whose choice names supp-not-equal or equal-not-supp; and a
 * near miss of a few degrees, which a drawing cannot show. A choice of four with a reason: practice only, as the
 * bisector's (an6c), so its wording tells a check nothing (key an4c:name:A:B:p:q).
 */
export function parallelConverse() {
  for (;;) {
    const eqKind = Math.random() < 0.6;
    const [p, q, name] = pick(eqKind ? EQUAL_PAIRS : SUPP_PAIRS);
    const A = 5 * R(8, 28); if (A === 90) continue;
    const kind = pick(['par', 'par', 'trap', 'near']);
    const B = kind === 'par' ? (eqKind ? A : 180 - A) : kind === 'trap' ? (eqKind ? 180 - A : A) : (eqKind ? A : 180 - A) + pick([-1, 1]) * R(3, 9);
    const parallel = eqKind ? A === B : A + B === 180;
    // the lower line turned by delta draws B to size; small enough that the two lines do not meet in the drawing
    const t = p === 'ur' || p === 'll' ? A : 180 - A;
    const delta = q === 'ur' || q === 'll' ? t - B : B - (180 - t);
    if (Math.abs(delta) > 20 || B < 20 || B > 160) continue;
    const par = parallelLines(t);
    const lo = par.pts._l1[0]; const hi = par.pts._r1[0]; const tan = Math.tan(rad(delta));
    const pts = { ...par.pts, _l1: [lo, r4(lo * tan)], _r1: [hi, r4(hi * tan)] };
    const [u0, u1] = par.span('U', p); const [l0, l1] = par.span('L', q);
    const fig = {
      type: 'geo', view: [300, 230], label: `שני ישרים וישר שחותך אותם: בחיתוך העליון זווית של ${A}°, ובחיתוך התחתון זווית של ${B}°`,
      // no parallel marks: whether the lines are parallel is the question
      pts, segs: par.segs.map(({ a, b }) => ({ a, b })),
      angles: [{ at: '_U', from: u0, to: u1, r: 22, ...given(A) }, { at: '_L', from: l0, to: l1, r: 22, ...given(B) }],
      dots: ['_U', '_L'],
    };
    const the = { corresponding: 'המתאימות', alternate: 'המתחלפות', cointerior: 'החד־צדדיות' }[name];
    const opts = [
      { text: `כן, כי הזוויות ${the} שוות`, ok: eqKind && parallel, bug: !eqKind && A === B ? 'equal-not-supp' : null },
      { text: `כן, כי הזוויות ${the} משלימות ל־180°`, ok: !eqKind && parallel, bug: eqKind && A + B === 180 ? 'supp-not-equal' : null },
      { text: `לא, כי הזוויות ${the} לא שוות`, ok: eqKind && !parallel, bug: !eqKind && parallel ? 'equal-not-supp' : null },
      { text: `לא, כי הזוויות ${the} לא משלימות ל־180°`, ok: !eqKind && !parallel, bug: eqKind && parallel ? 'supp-not-equal' : null },
    ];
    const why = eqKind
      ? (parallel ? `הן שוות, ולכן הישרים מקבילים: אם זוויות ${PAR_NAME[name]} שוות, הישרים מקבילים (המשפט ההפוך).`
        : `$${A}^\\circ \\ne ${B}^\\circ$: הן לא שוות, ולכן הישרים לא מקבילים${A + B === 180 ? ', אף על פי שיחד הן $180^\\circ$' : ''}.`)
      : (parallel ? `יחד הן $${A}^\\circ + ${B}^\\circ = 180^\\circ$, ולכן הישרים מקבילים: אם זוויות חד־צדדיות משלימות ל־$180^\\circ$, הישרים מקבילים (המשפט ההפוך).`
        : `יחד הן $${A}^\\circ + ${B}^\\circ = ${A + B}^\\circ$ ולא $180^\\circ$, ולכן הישרים לא מקבילים${A === B ? ', אף על פי שהן שוות' : ''}.`);
    return {
      key: `an4c:${name}:${A}:${B}:${p}:${q}`, form: 'mc', practiceOnly: true,
      choices: opts.map(({ text, ok }) => ({ text, ...(ok ? { ok } : {}) })), answer: opts.findIndex((c) => c.ok), fig,
      text: `בשרטוט שני ישרים וישר שלישי שחותך אותם. מסומנות שתי זוויות: $${A}^\\circ$ ו־$${B}^\\circ$. האם שני הישרים מקבילים? בחרו את התשובה עם ההסבר הנכון.`,
      hint: 'קודם מזהים את סוג הזוויות: מתאימות, מתחלפות או חד־צדדיות. הישרים מקבילים אם זוויות מתאימות או מתחלפות שוות, או אם זוויות חד־צדדיות משלימות ל־$180^\\circ$. בשרטוט קשה לראות הבדל של כמה מעלות.',
      solution: [`הזוויות $${A}^\\circ$ ו־$${B}^\\circ$ הן זוויות ${PAR_NAME[name]}.`, why],
      diag: (u) => opts[u]?.bug || null,
    };
  }
}

/**
 * A point E between two parallel lines, joined to a point on each; through E a helper line (dashed) parallel to them
 * splits the angle at E into two parts, each alternate to the angle at one of the lines, so ∢E = α + β. Asked: ∢E from
 * α and β, or α (or β) from ∢E and the other. Drawn to size; E points right or (mirrored) left (key
 * an4h:E|P|Q:a:b:mirror). Mistakes: ∢E found as a triangle's third angle (wrong-total: 180° minus the givens), and the
 * given part added to ∢E instead of taken from it (sum-not-diff).
 */
export function parallelBend() {
  for (;;) {
    const a = 5 * R(5, 14); const b = 5 * R(5, 14); const e = a + b;
    if (e > 140) continue;
    const ask = pick(['E', 'E', 'E', 'P', 'Q']);
    const g = ask === 'P' ? b : a; // the part given beside ∢E when a part is asked
    const ans = ask === 'E' ? e : ask === 'P' ? a : b;
    const bugs = ask === 'E' ? { 'wrong-total': 180 - e } : { 'sum-not-diff': okAngle(e + g), 'wrong-total': okAngle(180 - e - g) };
    if (!fairAngle(ans, bugs, ask === 'E' ? [a, b] : [e, g])) continue;
    const mirror = Math.random() < 0.5;
    const H = 3; const P = [r4(-(H / 2) / Math.tan(rad(a))), H]; const Q = [r4(-(H / 2) / Math.tan(rad(b))), 0];
    const lo = Math.min(P[0], Q[0]) - 1.6; const hi = 2;
    const fx = (pt) => (mirror ? [r4(-pt[0]), pt[1]] : pt);
    // the helper line runs a short way into the angle at E, so the angle's number past its end sits on no line
    const pts = Object.fromEntries(Object.entries({ _l2: [lo, H], _r2: [hi, H], _l1: [lo, 0], _r1: [hi, 0], E: [0, H / 2], _P: P, _Q: Q, _h0: [-0.55, H / 2], _h1: [1.5, H / 2] }).map(([k, v]) => [k, fx(v)]));
    // an arc sweeps counterclockwise from `from` to `to`: a mirror image sweeps the other way
    const arc = (at, from, to, mk, r = 24) => ({ at, from: mirror ? to : from, to: mirror ? from : to, r, ...mk });
    const fig = {
      type: 'geo', view: [300, 220], label: `שני ישרים מקבילים והנקודה E ביניהם, ודרכה ישר עזר מקווקו: ${ask === 'E' ? `זוויות של ${a}° ו־${b}° על הישרים, והזווית ב־E מסומנת ב־?` : `הזווית ב־E היא ${e}°, על אחד הישרים זווית של ${g}°, והזווית על הישר השני מסומנת ב־?`}`,
      pts,
      segs: [{ a: '_l2', b: '_r2', arrows: 1 }, { a: '_l1', b: '_r1', arrows: 1 }, { a: '_P', b: 'E' }, { a: '_Q', b: 'E' }, { a: '_h0', b: '_h1', dash: true }],
      angles: [
        arc('_P', 'E', '_r2', ask === 'P' ? asked : given(a)),
        arc('_Q', '_r1', 'E', ask === 'Q' ? asked : given(b)),
        arc('E', '_P', '_Q', ask === 'E' ? asked : given(e), 28),
      ],
      dots: ['E'],
      // E's letter above the helper line, on the side away from the angle
      lab: { E: [mirror ? -12 : 12, -14] },
    };
    const solution = ask === 'E'
      ? [`ישר העזר מקביל לשני הישרים. החלק העליון של הזווית ב־$E$ והזווית $${a}^\\circ$ הן זוויות מתחלפות, ולכן שוות: $${a}^\\circ$.`,
        `גם החלק התחתון שלה והזווית $${b}^\\circ$ הן זוויות מתחלפות: $${b}^\\circ$.`,
        `$\\sphericalangle E = ${a}^\\circ + ${b}^\\circ = ${e}^\\circ$`]
      : [`ישר העזר מקביל לשני הישרים. החלק ${ask === 'P' ? 'התחתון' : 'העליון'} של $\\sphericalangle E$ והזווית $${g}^\\circ$ הן זוויות מתחלפות, ולכן שוות: $${g}^\\circ$.`,
        `החלק ${ask === 'P' ? 'העליון' : 'התחתון'}: $${e}^\\circ - ${g}^\\circ = ${ans}^\\circ$`,
        `הוא והזווית המסומנת הן זוויות מתחלפות, ולכן גם היא $${ans}^\\circ$.`];
    return {
      key: `an4h:${ask}:${a}:${b}:${mirror ? 1 : 0}`, form: 'num', answer: ans, unit: DEG, fig,
      text: ask === 'E'
        ? `שני ישרים מקבילים, והנקודה $E$ ביניהם. דרך $E$ עובר ישר עזר (מקווקו) המקביל לשניהם. ${ASK}`
        : `שני ישרים מקבילים, והנקודה $E$ ביניהם: $\\sphericalangle E = ${e}^\\circ$. דרך $E$ עובר ישר עזר (מקווקו) המקביל לשניהם. ${ASK}`,
      hint: 'ישר העזר מחלק את הזווית ב־$E$ לשני חלקים. כל חלק והזווית שעל הישר המקביל הקרוב אליו הן זוויות מתחלפות, ולכן הן שוות.',
      solution, diag: diagFor(ans, bugs), tries: triesOf(bugs),
    };
  }
}
