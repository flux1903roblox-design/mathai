// Interactive exercises ("manip"): the answer is the state of a maths object the student moves.
// This module checks that state and puts it into words; the drawing lives in components/manip.
//
// kinds and the value each one holds:
//   numberline  a whole number on a number line            answer: the number
//   plot        a point [x, y] on the grid                 answer: [x, y], or any point in manip.quadrant (with manip.fixX / fixY: on that line)
//   line        a line {m, b} built from two handles       answer: {m, b}
//   angle       the turning ray's angle ∠AOB in degrees    answer: degrees
//               with protractor: true (FUNC-1.2), mode 'build' { from?: 'right' | 'left', base?, start }: the angle between
//               the fixed arm (on the 0 of the scale that starts on that side) and the ray, 5..175, answer the target;
//               mode 'align' { arms: [θ1, θ2], start }: the protractor's turn in degrees (0..355), right when its baseline
//               lies on an arm and the angle is under the half disc (two of the four turns that put it on an arm)
//   squares     the legs {a, b} of a right triangle        answer: {c} (any whole a, b with a² + b² = c²)
//   bars        the height of the movable bar              answer: the value (manip.stat 'median': the median is the target)
//   pins        several labelled markers on a number line  answer: the position of each, in order
//   triangle    the free vertex C of triangle ABC           answer: an example C; right: any C with a right angle at C
//   plot        also with manip.line (a point of the line), manip.shape (the vertex that completes it)
//               or manip.lines (two lines [{m, b}, {m, b}]: their meeting point)
//   balance     a scale {lx, l1, rx, r1}: boxes x and unit weights on the left and right pans
//               answer: the value of x (one box alone on a pan, that many weights on the other, the beam level)
//   tiles       algebra tiles {px, nx, p1, n1}: x, −x, 1 and −1 tiles     answer: {k, c} for kx + c, no zero pair left
//   area        a rectangle {a, b}: a high, x + b long                  answer: {a, b}
//   ray         an inequality on the number line {at, dir, closed}      answer: {at, dir, closed}; dir 1 right, −1 left
//   fbar        a bar cut into equal parts, some shaded {den, shaded}     answer: { mode: 'value', value } (shaded/den is the
//               value, any den), { mode: 'common', of: [3, 4] } (den a multiple of each), { mode: 'exact', den, shaded }
//   dline       a double number line (move 't': the marker; 'max': the bottom line's end)  answer: that number
//   graph       a situation graph drawn point by point { x, y, start, fixed?, ref? }: one point above each x, the value
//               is their heights (number[])  answer: { mode: 'values', values } | { mode: 'shape', shape: ('up' | 'flat'
//               | 'down')[] } | { mode: 'uniform', start?, rate? } (see "the graph you draw" below)
// numberline and pins also take `den`: ticks every 1/den, values k/den, compared exactly; `fmt: 'dec'` writes decimals.
import { near, plainNum, gcd, linText } from './util.js';

const QUAD_NAMES = ['', 'הרביע הראשון', 'הרביע השני', 'הרביע השלישי', 'הרביע הרביעי'];
export const quadOf = ([x, y]) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : x > 0 && y < 0 ? 4 : 0);

// ---------------------------------------------------------------- the balance (מאזניים)
// The student removes one box or one weight at a time from one pan; the beam tilts when the pans differ, and a level
// scale whose four counts share a divisor can be divided into that many equal parts (both pans together). Nothing is
// ever added, except by undoing. So the rule "the same on both sides" is the student's choice, never the tool's.

/** Most of a kind a pan can hold (the drawing is made for these; generators keep weights to 12 a pan). */
export const BALANCE_MAX = { boxes: 6, weights: 20 };
/** How the beam leans: −1 the left pan is heavier (it goes down), 1 the right one, 0 level. x is a box's weight. */
export const balanceTilt = (u, x) => Math.sign((u.rx * x + u.r1) - (u.lx * x + u.l1));
/** One box alone on a pan, the box's weight in weights on the other: x is found. */
export const balanceSolved = (u, x) => !!u && ((u.lx === 1 && u.l1 === 0 && u.rx === 0 && u.r1 === x) || (u.rx === 1 && u.r1 === 0 && u.lx === 0 && u.l1 === x));
/** The largest number every count on the scale divides by (2 or more), whether or not it is level; or null. */
export function countsDivisor(u) {
  const g = [u.lx, u.l1, u.rx, u.r1].reduce((a, b) => (b ? (a ? gcd(a, b) : b) : a), 0);
  return g > 1 ? g : null;
}
/** The number both pans can be divided by now (level, and every count divisible by it), or null. */
export function balanceDivisor(u, x) {
  if (balanceTilt(u, x) !== 0) return null;
  return countsDivisor(u);
}
/**
 * In a check: "divide" is offered by the shape of the scale, never by its counts: two or more boxes alone on one pan
 * and only weights on the other, divided by the number of boxes. Whether the weights split into that many equal groups
 * is the student's own sum (a press that cannot split them says so and changes nothing), so the button appearing
 * says nothing about having reached the right state.
 */
export function boxesDivisor(u) {
  if (u.lx >= 2 && !u.l1 && !u.rx) return u.lx;
  if (u.rx >= 2 && !u.r1 && !u.lx) return u.rx;
  return null;
}
/** Can every count be split into g equal groups? */
export const balanceSplits = (u, g) => !!g && [u.lx, u.l1, u.rx, u.r1].every((n) => n % g === 0);
export const balanceDivide = (u, g) => ({ lx: u.lx / g, l1: u.l1 / g, rx: u.rx / g, r1: u.r1 / g });
export const BALANCE_GROUPS = ['lx', 'l1', 'rx', 'r1'];
/** One item less in a group ('lx' a box on the left, 'r1' a weight on the right...), or null when it is empty. */
export const balanceRemove = (u, g) => (u[g] > 0 ? { ...u, [g]: u[g] - 1 } : null);

/**
 * Can the scale reach "x found" from `start` with the student's moves? `pans` limits the removals to some pans
 * ('l', 'r' or 'lr'): with one pan alone a level start can never be solved, which is what makes the tool honest.
 */
export function balanceReachable(start, x, pans = 'lr') {
  const key = (u) => `${u.lx},${u.l1},${u.rx},${u.r1}`;
  const seen = new Set([key(start)]); const queue = [start];
  while (queue.length) {
    const u = queue.shift();
    if (balanceSolved(u, x)) return true;
    const next = BALANCE_GROUPS.filter((g) => pans.includes(g[0])).map((g) => balanceRemove(u, g)).filter(Boolean);
    const d = balanceDivisor(u, x); if (d) next.push(balanceDivide(u, d));
    next.forEach((v) => { const k = key(v); if (!seen.has(k)) { seen.add(k); queue.push(v); } });
  }
  return false;
}
/** One pan as maths: 3x + 5, x, 11, 0. */
export const panTex = (n, w) => linText({ k: n, c: w });
/** The scale as an equation, or with ≠ while it leans. */
export const balanceTex = (u, x) => `${panTex(u.lx, u.l1)} ${x == null || balanceTilt(u, x) === 0 ? '=' : '\\ne'} ${panTex(u.rx, u.r1)}`;
const boxes = (n) => (n === 1 ? 'קופסה אחת' : `${n} קופסאות`);
const weights = (n) => (n === 1 ? 'משקולת אחת' : `${n} משקולות`);
/** What is on one pan, in words: "3 קופסאות ו־5 משקולות", "קופסה אחת", "כף ריקה". */
export function panWords(n, w) {
  if (!n && !w) return 'כף ריקה';
  if (!w) return boxes(n);
  if (!n) return weights(w);
  return `${boxes(n)} ו־${weights(w)}`;
}
export const balanceWords = (u) => `בכף השמאלית ${panWords(u.lx, u.l1)}, בכף הימנית ${panWords(u.rx, u.r1)}`;

// ---------------------------------------------------------------- algebra tiles (אריחים)

/** Most tiles a row holds: x tiles (x and −x together) and unit tiles (1 and −1 together). */
export const TILES_MAX = { x: 5, unit: 8 };
/** The tiles as they lie, term by term: 3x - x + 2 - 5. Nothing at all is 0. */
export function tilesTex(u) {
  const terms = [];
  const push = (n, sign, unit) => { if (n) terms.push({ sign, body: unit ? String(n) : n === 1 ? 'x' : `${n}x` }); };
  push(u.px, '+', false); push(u.nx, '-', false); push(u.p1, '+', true); push(u.n1, '-', true);
  if (!terms.length) return '0';
  return terms.map((t, i) => (i === 0 ? (t.sign === '-' ? `-${t.body}` : t.body) : `${t.sign} ${t.body}`)).join(' ');
}
/** How many zero pairs each row still has. */
export const tilesPairs = (u) => ({ x: Math.min(u.px, u.nx), unit: Math.min(u.p1, u.n1) });
const tileCount = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
export const tilesWords = (u) => [
  u.px && tileCount(u.px, 'אריח x אחד', 'אריחי x'), u.nx && tileCount(u.nx, 'אריח −x אחד', 'אריחי −x'),
  u.p1 && tileCount(u.p1, 'אריח 1 אחד', 'אריחי 1'), u.n1 && tileCount(u.n1, 'אריח −1 אחד', 'אריחי −1'),
].filter(Boolean).join(', ') || 'אין אריחים';

// ---------------------------------------------------------------- the area model (מלבן)

/** a(x + b) as maths: 3(x + 4), x + 4 (a = 1), 3x (b = 0). */
export const areaTex = ({ a, b }) => (b === 0 ? linText({ k: a, c: 0 }) : a === 1 ? `x + ${b}` : `${a}(x + ${b})`);
/** Its two parts' areas added: 3x + 12. */
export const areaSumTex = ({ a, b }) => linText({ k: a, c: a * b });

// ---------------------------------------------------------------- an inequality on the number line (קרן)

/** The inequality a ray shows: x ≥ 4 (closed circle, to the right), x < −3 (open, to the left). */
export const rayText = ({ at, dir, closed }, v = 'x') => `${v} ${dir > 0 ? (closed ? '≥' : '>') : (closed ? '≤' : '<')} ${plainNum(at)}`;
export const rayTex = ({ at, dir, closed }, v = 'x') => `${v} ${dir > 0 ? (closed ? '\\ge' : '>') : (closed ? '\\le' : '<')} ${plainNum(at)}`;
/** Is a number on the ray? */
export const rayHas = ({ at, dir, closed }, n) => (n === at ? !!closed : dir > 0 ? n > at : n < at);

// ---------------------------------------------------------------- fractions on the number lines
// A line with `den` cuts every unit into den equal parts: its values are k/den (floats, compared within 1e-9), and a
// step moves one part. The labels stay on whole numbers, so the student counts parts.

/** One part of a line: 1/den with `den`, else 1. */
export const lineStep = (m) => (m.den ? 1 / m.den : 1);
/** A line's value as plain text: a fraction as counted up to the line's den, or a decimal with fmt: 'dec'. */
export const lineNum = (m, v) => plainNum(v, m.den ? { maxDen: Math.max(12, m.den), decimal: m.fmt === 'dec', places: 3 } : {});
/** Two values of a line are the same place: exactly for whole lines, within 1e-9 for a line cut into parts. */
const samePlace = (m, u, a) => (m.den ? typeof u === 'number' && near(u, a, 1e-9) : u === a);
/** Ticks from one value to another, in parts: "5 שנתות ימינה מ־0" (what a screen reader hears in a check). */
export function ticksWords(m, v, from) {
  const k = Math.round((v - from) * (m.den || 1));
  const f = from < 0 ? `−${-from}` : `${from}`;
  if (!k) return `הסמן על ${f}`;
  const n = Math.abs(k);
  return `${n === 1 ? 'שנתה אחת' : `${n} שנתות`} ${k > 0 ? 'ימינה' : 'שמאלה'} מ־${f}`;
}
/** A label of a marker as plain text: \frac{1}{4} is 1/4. */
const labelPlain = (l) => String(l).replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');

// ---------------------------------------------------------------- the fraction bar (פס שברים)
// One bar, the whole: the student chooses how many equal parts (den) and how many are shaded, from the left.

export const FBAR_MAX_DEN = 24;
export const lcm = (a, b) => (a / gcd(a, b)) * b;
/** The smallest number of parts (up to maxDen) in which a value is a whole number of parts, or null. */
export function fbarDenFor(value, maxDen = FBAR_MAX_DEN) {
  for (let d = 1; d <= maxDen; d += 1) if (near(value * d, Math.round(value * d), 1e-9)) return d;
  return null;
}
/** What the bar shows, in words: "הפס מחולק ל־12 חלקים, 7 צבועים". */
export function fbarWords({ den, shaded }) {
  const parts = den === 1 ? 'הפס שלם, חלק אחד' : `הפס מחולק ל־${den} חלקים`;
  const sh = shaded === 0 ? 'אף חלק לא צבוע' : shaded === den && den > 1 ? 'כולם צבועים' : shaded === 1 ? 'חלק אחד צבוע' : `${shaded} צבועים`;
  return `${parts}, ${sh}`;
}
/** The bar as a fraction, as built (8/12 is not reduced): TeX. */
export const fbarTex = ({ den, shaded }) => `\\frac{${shaded}}{${den}}`;
const fbarOk = (m, u) => !!u && typeof u === 'object' && Number.isInteger(u.den) && Number.isInteger(u.shaded)
  && u.den >= 1 && u.den <= (m.maxDen || FBAR_MAX_DEN) && u.shaded >= 0 && u.shaded <= u.den && (!m.lockDen || u.den === m.start.den);

// ---------------------------------------------------------------- the double number line (ציר כפול)
// Two lines with 0 on the left: the top in its units (%, ס״מ, כוסות מים), the bottom in the other (₪, ק״מ). The same
// place on both is the same part of the whole. move 't': the marker moves along the top line in top.step steps;
// move 'max': the marker stays at fixT, and the student stretches the bottom line (its end, in bottom.step steps).

/** The object's number: t (move 't') or the bottom line's end (move 'max'), from a value or from manip.start. */
export const dlineValue = (m, u) => (typeof u === 'number' ? u : u && typeof u === 'object' ? (m.move === 'max' ? u.max : u.t) : null);
/** Where everything is for a value: the marker on the top line, the bottom line's end, and the value under the marker. */
export function dlineAt(m, v) {
  const t = m.move === 'max' ? m.fixT : v; const max = m.move === 'max' ? v : m.bottom.max;
  return { t, max, under: (t * max) / m.top.max };
}
/** A number of a double line: thousands with a comma from 10,000, decimals to three places. */
export const dlineNum = (v) => {
  const s = plainNum(v, { decimal: true, places: 3 });
  return Math.abs(v) >= 10000 && /^-?\d+$/.test(s) ? Number(s).toLocaleString('en-US') : s;
};
/** A number with its unit, the unit word outside the number: "30%", "7 ס״מ", "72". */
export const withUnit = (v, unit) => (!unit ? dlineNum(v) : unit === '%' ? `${dlineNum(v)}%` : `${dlineNum(v)} ${unit}`);

// ---------------------------------------------------------------- the graph you draw (גרף שמציירים, FUNC-1)
// One point stands above each x of the x axis, from x.min to x.max in x.steps; the student drags each point to its
// height. A height is y.min plus a whole number of y.steps, within the axis (a grid line). `fixed` points (the start of a
// story) never move, and may sit between grid lines (a given value). At most 7 points, so each column is at least 36px
// wide on a 320px phone, and at most 9 heights, so a finger lands on the height it means (checkSteps holds content to it).
// Answer modes: 'values' (every point exactly: a table drawn, a rate continued), 'shape' (each segment up, flat or down:
// a story drawn) and 'uniform' (every segment changes by the same amount; with `start` the first value, and with `rate`
// the change for one unit of x, the stair's meaning of a rate: with x.step 1 that is each segment's change).

export const GRAPH_MAX = { points: 7, heights: 9 };
const round9 = (v) => Math.round(v * 1e9) / 1e9;
/** An axis's lowest value (0 unless it says otherwise) and its number of steps from there to its end. */
export const axisLo = (a) => a.min ?? 0;
export const axisSteps = (a) => Math.round((a.max - axisLo(a)) / a.step);
/** The values of an axis's grid lines, lowest first. */
export const axisValues = (a) => Array.from({ length: axisSteps(a) + 1 }, (_, i) => round9(axisLo(a) + i * a.step));
/** Is a value on one of the axis's grid lines? */
export const onAxisGrid = (a, v) => typeof v === 'number' && v >= axisLo(a) - 1e-9 && v <= a.max + 1e-9 && near((v - axisLo(a)) / a.step, Math.round((v - axisLo(a)) / a.step), 1e-9);
/** The x of each point. */
export const graphXs = (m) => axisValues(m.x);
/** A height snapped to the nearest grid line and kept on the axis. */
export const graphSnap = (m, v) => round9(Math.min(m.y.max, Math.max(axisLo(m.y), axisLo(m.y) + Math.round((v - axisLo(m.y)) / m.y.step) * m.y.step)));
const isFixed = (m, i) => (m.fixed || []).includes(i);
/**
 * The graph after point i is moved to height v (a drag, a step button, a key): snapped to a grid line and kept on the
 * axis. A fixed point never moves, and a move that changes nothing returns the same array (GraphDraw.jsx sends no change).
 */
export function graphMove(m, vals, i, v) {
  if (isFixed(m, i) || i < 0 || i >= vals.length) return vals;
  const s = graphSnap(m, v);
  return near(s, vals[i], 1e-9) ? vals : vals.map((w, k) => (k === i ? s : w));
}
/** What a key does to point i: ↑ and ↓ one step, Home and End the ends of the axis; any other key changes nothing. */
export function graphKey(m, vals, i, key) {
  const to = { ArrowUp: vals[i] + m.y.step, ArrowDown: vals[i] - m.y.step, Home: axisLo(m.y), End: m.y.max }[key];
  return to == null ? vals : graphMove(m, vals, i, to);
}
const GRAPH_SIGN = { up: 1, flat: 0, down: -1 };
export const GRAPH_SHAPE_WORD = { up: 'עולה', flat: 'קבוע', down: 'יורד' };
/** Each segment's direction, left to right: 'up', 'flat' or 'down'. */
export const graphShape = (vals) => vals.slice(1).map((v, i) => (near(v, vals[i], 1e-9) ? 'flat' : v > vals[i] ? 'up' : 'down'));
/** A drawn graph's state: one number per point, the fixed points where they started, the others on the grid. */
const graphOk = (m, u) => Array.isArray(u) && u.length === graphXs(m).length
  && u.every((v, i) => (isFixed(m, i) ? typeof v === 'number' && near(v, m.start[i], 1e-9) : onAxisGrid(m.y, v)));
/** The change of each segment, and whether they are all the same (a uniform rate). */
const graphRises = (vals) => vals.slice(1).map((v, i) => v - vals[i]);
export function graphCorrect(m, a, u) {
  if (!graphOk(m, u) || !a) return false;
  if (a.mode === 'values') return a.values.length === u.length && u.every((v, i) => near(v, a.values[i], 1e-9));
  if (a.mode === 'shape') { const s = graphShape(u); return a.shape.length === s.length && s.every((d, i) => d === a.shape[i]); }
  if (a.mode === 'uniform') {
    const r = graphRises(u);
    if (!r.every((d) => near(d, r[0], 1e-9))) return false;
    if (a.start != null && !near(u[0], a.start, 1e-9)) return false;
    return a.rate == null || near(r[0], a.rate * m.x.step, 1e-9);
  }
  return false;
}
/** A graph that answers: the values; a shape built one step a segment from the first point (fixed, or the grid line
 * nearest the middle of the axis); a uniform rate from its start (or the first fixed point, or the end of the axis it
 * moves away from). Fixed points keep their places. */
export function graphSolution(m, a) {
  const n = graphXs(m).length;
  if (a.mode === 'values') return [...a.values];
  if (a.mode === 'shape') {
    const out = [isFixed(m, 0) ? m.start[0] : graphSnap(m, (axisLo(m.y) + m.y.max) / 2)];
    for (let i = 1; i < n; i += 1) out.push(isFixed(m, i) ? m.start[i] : graphSnap(m, out[i - 1] + GRAPH_SIGN[a.shape[i - 1]] * m.y.step));
    return out;
  }
  // uniform: the rate asked, or the one two fixed points give, or else one step up, one step down or flat, whichever fits
  const fixedAt = (m.fixed || []).slice().sort((p, q) => p - q);
  const rises = a.rate != null ? [a.rate * m.x.step]
    : fixedAt.length >= 2 ? [(m.start[fixedAt[1]] - m.start[fixedAt[0]]) / (fixedAt[1] - fixedAt[0])] : [m.y.step, -m.y.step, 0];
  const build = (rise) => {
    const first = a.start != null ? a.start : fixedAt.length ? m.start[fixedAt[0]] - fixedAt[0] * rise : rise >= 0 ? axisLo(m.y) : m.y.max;
    return Array.from({ length: n }, (_, i) => round9(first + i * rise));
  };
  const fits = (vs) => vs.every((v) => v >= axisLo(m.y) - 1e-9 && v <= m.y.max + 1e-9);
  return rises.map(build).find(fits) || build(rises[0]);
}
/** A graph one step from the answer that is wrong: values, the first point that moves one step off; shape, its first
 * moving segment that is not flat made flat; uniform, the last point one step off. */
export function graphWrong(m, a) {
  const sol = graphSolution(m, a); const n = sol.length;
  const off = (i) => { const v = sol[i] + m.y.step <= m.y.max + 1e-9 ? sol[i] + m.y.step : sol[i] - m.y.step; return sol.map((w, k) => (k === i ? round9(v) : w)); };
  const free = [...Array(n).keys()].filter((i) => !isFixed(m, i));
  if (a.mode === 'shape') {
    const seg = a.shape.findIndex((d, i) => d !== 'flat' && (!isFixed(m, i + 1) || !isFixed(m, i)));
    const flat = seg >= 0 && sol.map((w, k) => (k === seg + 1 && !isFixed(m, seg + 1) ? sol[seg] : k === seg && isFixed(m, seg + 1) ? sol[seg + 1] : w));
    // a fixed point between grid lines cannot be matched by its neighbour: then a point one step off instead
    return flat && graphOk(m, flat) ? flat : off(free[0]);
  }
  return off(a.mode === 'uniform' ? free[free.length - 1] : free[0]);
}
/** The points as maths: (0, 0) → (5, 400) → (10, 400). */
export const graphPointsText = (m, u) => graphXs(m).map((x, i) => `(${plainNum(x)}, ${plainNum(u[i])})`).join(' → ');
/** Which axis is in which unit, after the points: "(x בדקות, y במטרים)". */
const graphUnits = (m) => [m.x.unit && `x ב${m.x.unit}`, m.y.unit && `y ב${m.y.unit}`].filter(Boolean).join(', ');
/** Which points are fixed, in words (the first one, the first two, or each by its x). */
function fixedWords(m) {
  const f = (m.fixed || []).slice().sort((p, q) => p - q);
  if (!f.length) return '';
  if (f.length === 1 && f[0] === 0) return 'הנקודה הראשונה קבועה';
  if (f.length === 2 && f[0] === 0 && f[1] === 1) return 'שתי הנקודות הראשונות קבועות';
  const xs = graphXs(m);
  return f.length === 1 ? `הנקודה ב־${plainNum(xs[f[0]])} קבועה` : `הנקודות ב־${f.map((i) => plainNum(xs[i])).join(', ')} קבועות`;
}
// ---------------------------------------------------------------- the situation graph, still (sgraph, FUNC-1)
// A graph on two named, scaled axes (components/Figure.jsx SGraph): its series are polylines through their points (or
// the points alone, dots), read left to right; these helpers place what it marks on them.

/** An axis's name as drawn: its label and, outside the maths, its unit: "זמן (דקות)". */
export const axisName = (a) => (a.unit ? `${a.label} (${a.unit})` : a.label);
/** The y of a polyline at x (its first piece that spans x), or null outside it. */
export function seriesAt(pts, x) {
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    if (x >= Math.min(x0, x1) - 1e-9 && x <= Math.max(x0, x1) + 1e-9) return x1 === x0 ? y1 : round9(y0 + ((x - x0) * (y1 - y0)) / (x1 - x0));
  }
  return pts.length === 1 && near(pts[0][0], x, 1e-9) ? pts[0][1] : null;
}
/** Every x where a polyline is at height y, left to right (a flat piece at that height gives its two ends). */
export function seriesCrossings(pts, y) {
  const out = [];
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    if (near(y0, y1, 1e-9)) { if (near(y0, y, 1e-9)) out.push(x0); continue; }
    if (y >= Math.min(y0, y1) - 1e-9 && y <= Math.max(y0, y1) + 1e-9) out.push(round9(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
  }
  return [...new Set(out.map((v) => round9(v)))].sort((p, q) => p - q);
}
/** Where two polylines first meet (left to right), or null. */
export function seriesMeet(p, q) {
  let best = null;
  for (let i = 1; i < p.length; i += 1) {
    for (let j = 1; j < q.length; j += 1) {
      const [a, b] = [p[i - 1], p[i]]; const [c, d] = [q[j - 1], q[j]];
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (Math.abs(den) < 1e-12) continue;
      const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      const s = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (t < -1e-9 || t > 1 + 1e-9 || s < -1e-9 || s > 1 + 1e-9) continue;
      const at = [round9(a[0] + t * (b[0] - a[0])), round9(a[1] + t * (b[1] - a[1]))];
      if (!best || at[0] < best[0]) best = at;
    }
  }
  return best;
}
/** riseRun on the first series: the run (the change in x) and the rise (the change in y) it draws, or null. */
export function sgraphRiseRun(f) {
  const s = f.series?.[0]; if (!f.riseRun || !s) return null;
  const y0 = seriesAt(s.pts, f.riseRun.from); const y1 = seriesAt(s.pts, f.riseRun.to);
  return y0 == null || y1 == null ? null : { from: f.riseRun.from, to: f.riseRun.to, y0, y1, run: round9(f.riseRun.to - f.riseRun.from), rise: round9(y1 - y0) };
}
/** The sgraph in words: every number it draws, in reading order (the axes, each series, then what it marks). */
export function sgraphWords(f) {
  const n = (v) => figNum(v);
  const pt = ([x, y]) => `(${n(x)}, ${n(y)})`;
  const axis = (name, a) => `ציר ${name} מ־${n(axisLo(a))} עד ${n(a.max)}, קו כל ${n(a.step)}${a.every > 1 ? `, מספר כל ${n(round9(a.step * a.every))}` : ''}`;
  const series = (f.series || []).map((s) => `${s.label ? `${s.label}: ` : ''}${s.dots ? `נקודות ${s.pts.map(pt).join(', ')}` : `${s.pts.map(pt).join(' → ')}${s.smooth ? ' (קו מעוגל)' : ''}`}`);
  const first = f.series?.[0]?.pts || [];
  const g = f.guide || {};
  const guideX = g.x != null ? `קו עזר מ־x = ${n(g.x)}${seriesAt(first, g.x) != null ? ` עד הגרף, בגובה ${n(seriesAt(first, g.x))}` : ''}` : '';
  const guideY = g.y != null ? `קו עזר מ־y = ${n(g.y)}${seriesCrossings(first, g.y).length ? ` עד הגרף, ב־x = ${seriesCrossings(first, g.y).map(n).join(' וב־x = ')}` : ''}` : '';
  const rr = sgraphRiseRun(f);
  const meet = f.meet && f.series?.length > 1 ? seriesMeet(f.series[0].pts, f.series[1].pts) : null;
  return [
    `גרף: ${axisName(f.y)} לפי ${axisName(f.x)}`, axis('x', f.x), axis('y', f.y), ...series,
    ...(f.marks || []).map((k) => `הנקודה ${k.label} ב־${pt([k.x, k.y])}`),
    ...(f.bands || []).map((b) => `מסומן על ציר x מ־${n(b.from)} עד ${n(b.to)}`),
    guideX, guideY,
    rr && `שינוי ב־x: ${n(rr.run)}, שינוי ב־y: ${n(rr.rise)}`,
    meet && `הקווים נפגשים ב־${pt(meet)}`,
    f.dirArrow && 'חץ משמאל לימין',
  ].filter(Boolean).join('; ');
}

// ---------------------------------------------------------------- the protractor and the clock (FUNC-1.2, FUNC-1.3b)
// A direction is in degrees counterclockwise from the right. A protractor turned by ρ has its baseline along ρ and
// ρ + 180 and covers the directions from ρ to ρ + 180 (its half disc). It has two scales, laid out as on the class's
// plastic one: the scale that starts on the right (its 0 at the right end of the baseline, the inner ring) reads a
// direction d as d − ρ, and the scale that starts on the left (the outer ring) as 180 − (d − ρ). The words name a scale
// only by the side its 0 is on.

export const mod360 = (d) => ((Math.round(d * 1e9) / 1e9) % 360 + 360) % 360;
/** Does a protractor turned by ρ cover direction d (under its half disc, the baseline's ends included)? */
export const protCovers = (rho, d) => mod360(d - rho) <= 180 + 1e-9;
/** Is the baseline of a protractor turned by ρ on one of the arms (either end of it on an arm)? */
export const baselineOnArm = (arms, rho) => arms.some((t) => { const d = mod360(t - rho); return d < 1e-9 || d > 360 - 1e-9 || Math.abs(d - 180) < 1e-9; });
/** align is right: the baseline on an arm and the angle under the half disc, where it can be read. */
export const protAligned = (arms, rho) => baselineOnArm(arms, rho) && arms.every((t) => protCovers(rho, t));
/** The four turns that put the baseline on an arm, smallest first. */
export const armTurns = (arms) => [...new Set(arms.flatMap((t) => [mod360(t), mod360(t + 180)]))].sort((p, q) => p - q);
/** The smaller angle between two directions. */
export const armsAngle = ([a, b]) => { const d = mod360(b - a); return d > 180 ? 360 - d : d; };
/** Where the build mode's ray points on the protractor (its reading on the scale that starts on the right). */
export const buildRay = (m, v) => (m.from === 'left' ? 180 - v : v);
/** The words for the two numbers a direction meets on the protractor, one by scale. */
export const protReadingWords = (r) => `${plainNum(r)} בסולם שמתחיל מימין, ${plainNum(180 - r)} בסולם שמתחיל משמאל`;
/** What a screen reader hears for the build mode's ray: the two numbers a sighted student sees at it (choosing is the skill). */
export const buildWords = (m, v) => { const r = buildRay(m, v); return `הקרן מול ${plainNum(r)} בסולם שמתחיל מימין ומול ${plainNum(180 - r)} בסולם שמתחיל משמאל`; };
const armLetter = (m, i) => (m.letters ? (i === 0 ? m.letters.a : m.letters.b) : (i === 0 ? 'הראשונה' : 'השנייה'));
/**
 * What a screen reader hears for the align mode: on an arm, and whether the angle is under the protractor; otherwise how
 * far the nearer end of the baseline is from the nearest arm (and that it is between the arms, when it is).
 */
export function alignWords(m, rho) {
  const arms = m.arms; const dist = (a, b) => { const d = mod360(a - b); return Math.min(d, 360 - d); };
  let best = { d: Infinity, i: 0 };
  arms.forEach((t, i) => [rho, rho + 180].forEach((end) => { const d = dist(t, end); if (d < best.d - 1e-9) best = { d, i }; }));
  const L = armLetter(m, best.i); const name = m.letters ? `השוק ${m.letters.vertex}${L}` : `השוק ${L}`;
  if (best.d < 1e-9) return `קו האפס על ${name}, ${protAligned(arms, rho) ? 'והזווית מתחת למד הזווית' : 'אבל הזווית מחוץ למד הזווית'}`;
  // the angle runs counterclockwise from its first arm for `span` degrees; is an end of the baseline inside it?
  const span = armsAngle(arms); const start = mod360(arms[1] - arms[0]) <= 180 ? arms[0] : arms[1];
  const between = [rho, rho + 180].some((e) => { const d = mod360(e - start); return d > 1e-9 && d < span - 1e-9; });
  return `קו האפס ${between ? 'בין השוקיים, ' : ''}${plainNum(Math.round(best.d))} מעלות מ${name}`;
}
/** The clock's hands, in degrees clockwise from 12: the hour hand moves on with the minutes (30h + m/2), the minute hand 6m. */
export const clockHands = (h, m) => ({ hour: mod360(30 * (h % 12) + m / 2), minute: mod360(6 * m) });
/** The time as a clock shows it: 4:30, 10:05. */
export const clockText = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
/** The protractor figure in words: arm by arm, the arm on a 0 first, each arm's two readings named by scale. */
export function protractorWords(f) {
  const L = f.letters;
  const order = f.arms.map((r, i) => ({ r, i })).sort((p, q) => Number(q.r === 0 || q.r === 180) - Number(p.r === 0 || p.r === 180));
  const arm = ({ r, i }) => `${L ? `השוק ${L.vertex}${i === 0 ? L.a : L.b}` : `השוק ${i === 0 ? 'הראשונה' : 'השנייה'}`}: ${protReadingWords(r)}`;
  return [`מד זווית על ${L ? `∢${L.a}${L.vertex}${L.b}` : 'הזווית'}`, ...order.map(arm)].join('; ');
}

/** A point's height in squares above the x axis, for a screen reader in a check: "4 משבצות מעל הציר". */
export function squaresWords(m, v) {
  const k = Math.round((v - axisLo(m.y)) / m.y.step);
  return k === 0 ? 'על הציר' : k === 1 ? 'משבצת אחת מעל הציר' : `${k} משבצות מעל הציר`;
}

// ---------------------------------------------------------------- the teaching figures in words (STUDENT-8)
// The spoken name of each drawing (components/Figure.jsx puts it in aria-label): what a sighted student sees, never
// more. A coordinate plane names its points but not where they are, because an exercise may ask exactly that.

/** A number as the drawings write it: a real minus sign, a half as 2.5 (as 1/2 with decimal false: a line cut in parts). */
export const figNum = (v, decimal = true) => plainNum(v, { decimal }).replace(/^-/, '−');
/** A rule written in TeX (2x + 1, x \cdot 3 - 2) as the text a drawing can hold. */
export const ruleText = (tex) => String(tex ?? '').replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2').replace(/\\(cdot|times)/g, '×')
  .replace(/\\div/g, ':').replace(/\\[a-zA-Z]+|[{}\\]/g, '').replace(/-/g, '−').replace(/\s+/g, ' ').trim();
/** Where two lines y = mx + b cross, or null when they are parallel (or one line). */
export const linesMeet = (p, q) => (p.m === q.m ? null : [(q.b - p.b) / (p.m - q.m), (p.m * (q.b - p.b)) / (p.m - q.m) + p.b]);
/** What a machine takes in or gives out, as drawn: x and y when nothing is given. */
export const machineIO = (v, letter) => (v == null ? letter : typeof v === 'number' ? figNum(v) : String(v));

// ---------------------------------------------------------------- the still figures of stage 1, in words
// What content/index.js figPlain says for numline, fbar, fgrid, dline and groups: every number the drawing writes, so
// the tutor and an answer key see what the student saw. A point named by a letter on a line cut into parts is placed
// by counting parts ("A: 7 חלקים מ־0"), as the student counts them: its value is not written in the drawing.
const fracNum = (v, den) => plainNum(v, { maxDen: Math.max(12, den || 1), places: 3 });
// The teaching figures (STUDENT-8) add thermo, machine, dots, bars and coord. A number line cut into parts (den) is the
// fraction lane's and is read the curriculum's way, by counting parts (so the words never give away the value an exercise
// asks for); a number line with no den is a teaching figure and is read the student lane's way.
/** A number line cut into parts (den): the curriculum's words. */
function partsLineWords(f) {
  const where = (x) => {
    if (!f.den) return fracNum(x);
    const k = Math.round((x - f.from) * f.den);
    return `${k === 1 ? 'חלק אחד' : `${k} חלקים`} מ־${fracNum(f.from)}`;
  };
  // a mark labelled with its number is that number; a letter is placed (by parts on a cut line); a bare dot too
  const marks = (f.marks || []).map((k) => (k.label && /\d/.test(k.label) ? `נקודה ${labelPlain(k.label)}` : `${k.label ? labelPlain(k.label) : 'נקודה'}${f.den ? ': ' : ' ב־'}${where(k.x)}`));
  const jumps = (f.jumps || []).map((j) => `קפיצה מ־${fracNum(j.from, f.den)} ל־${fracNum(j.to, f.den)}${j.label ? ` (${labelPlain(j.label)})` : ''}`);
  return [`ציר מספרים מ־${fracNum(f.from)} עד ${fracNum(f.to)}${f.den ? `, כל יחידה מחולקת ל־${f.den} חלקים שווים` : f.step && f.step !== 1 ? `, שנתה כל ${fracNum(f.step)}` : ''}`, ...marks, ...jumps].join('; ');
}
/** A number line with no parts (a teaching figure, STUDENT-8): the student lane's words. */
function teachLineWords(f) {
  const at = (v) => figNum(v);
  return `ציר מספרים מ־${at(f.from)} עד ${at(f.to)}${(f.marks || []).map((k) => `, נקודה${/^[A-Z]$/.test(k.label || '') ? ` ${k.label}` : ''} ב־${at(k.x)}`).join('')}${(f.jumps || []).map((j) => `, קפיצה מ־${at(j.from)} ל־${at(j.to)}`).join('')}`;
}

export function figWords(f) {
  switch (f.type) {
    case 'numline': return f.den ? partsLineWords(f) : teachLineWords(f);
    case 'fbar': {
      const rows = f.rows?.length ? f.rows : [{ den: f.den, shaded: f.shaded }];
      const parts = rows.map((r) => `${r.label ? `${labelPlain(r.label)}: ` : ''}${fbarWords(r)}`);
      if (f.hatch) parts.push(`${f.hatch === 1 ? 'חלק צבוע אחד מקווקו' : `${f.hatch} מהחלקים הצבועים מקווקווים`}`);
      if (f.cross) parts.push(`${f.cross === 1 ? 'חלק צבוע אחד מחוק' : `${f.cross} מהחלקים הצבועים מחוקים`}`);
      if (f.marks?.length) parts.push(`סימונים מעל הפס ב־${f.marks.map((x) => fracNum(x, 100)).join(', ')}`);
      if (f.whole != null) parts.push(`הפס כולו ${dlineNum(f.whole)}`);
      return `פס שברים: ${parts.join('; ')}`;
    }
    case 'fgrid':
      return `מלבן מחולק ל־${f.rows} שורות ול־${f.cols} עמודות; ${f.shadeCols} עמודות צבועות בכיוון אחד ו־${f.shadeRows} שורות בכיוון השני, והחלק המשותף כהה${f.label ? `; ${labelPlain(f.label)}` : ''}`;
    case 'dline': {
      const line = (L) => `${L.label ? `${L.label} ` : ''}מ־0 עד ${withUnit(L.max, L.unit)}, שנתה כל ${withUnit(L.step, L.unit)}`;
      const show = f.show || 'both';
      const at = f.at == null ? '' : `; הסמן ${show !== 'bottom' ? `על ${withUnit(f.at, f.top.unit)}` : 'על הציר העליון'}${f.label != null ? `, מתחתיו ${f.label}` : show !== 'top' ? `, מתחתיו ${withUnit(dlineAt({ ...f, move: 't' }, f.at).under, f.bottom.unit)}` : ''}`;
      // a blank bottom line writes only its 0: its end (the whole) is what the picture asks
      const low = f.blank ? `${f.bottom.label ? `${f.bottom.label} ` : ''}מ־0, בלי מספרים` : line(f.bottom);
      return `ציר כפול: למעלה ${line(f.top)}; למטה ${low}${at}`;
    }
    case 'groups': return `קבוצות: ${f.rows.map((r) => `${r.label} ${r.n}`).join(', ')}`;
    case 'thermo': return f.also
      ? `שני מדחומים: ${[f, f.also].map((t) => `${t.label ? `${t.label} ` : ''}${figNum(t.value)} מעלות`).join(', ')}`
      : `מדחום שמראה ${figNum(f.value)} מעלות${f.label ? `, ${f.label}` : ''}`;
    case 'machine': {
      const out = machineIO(f.outY, 'y');
      return `מכונה: נכנס ${machineIO(f.inX, 'x')}, הכלל ${ruleText(f.rule)}, יוצא ${out === '?' ? 'סימן שאלה' : out}`;
    }
    case 'dots': {
      const k = f.mark || {};
      return `תרשים נקודות של ${f.values.length} ערכים בין ${figNum(f.axis[0])} ל־${figNum(f.axis[1])}${k.mode != null ? ', השכיח מסומן' : ''}${k.median != null ? ', החציון מסומן' : ''}${k.mean != null ? ', הממוצע מסומן' : ''}${f.unit ? `: ${f.unit}` : ''}`;
    }
    case 'bars': {
      // a bar with no name is read by its value; a missing one says so; the level line is read last
      const bar = (l, v) => [l, v == null ? 'חסר' : figNum(v)].filter(Boolean).join(' ');
      return `תרשים עמודות: ${f.labels.map((l, i) => bar(l, f.values[i])).join(', ')}${f.unit ? ` (${f.unit})` : ''}${f.level != null ? `, קו בגובה ${figNum(f.level)}` : ''}`;
    }
    case 'coord': {
      const names = (f.points || []).filter((p) => !p.hidden).map((p) => p.label);
      const lines = [...(f.line ? [f.line] : []), ...(f.lines || [])];
      const meet = f.meet && f.lines?.length > 1 ? linesMeet(f.lines[0], f.lines[1]) : null;
      const rr = f.riseRun && lines[0] ? { run: f.riseRun.run, rise: lines[0].m * f.riseRun.run } : null;
      const said = lines.map((l) => l.label).filter(Boolean);
      // a rectangle with sides along the grid is named so; a shape's sides and the words on the plane are read out
      const rect = f.polygon?.length === 4 && f.polygon.every(([x, y], i) => { const [u, v] = f.polygon[(i + 1) % 4]; return x === u || y === v; });
      const segs = f.segments?.length || 0;
      return ['מערכת צירים', f.quadrants && 'ארבעה רביעים', f.polygon && (rect ? 'מלבן' : 'מצולע'), segs && (segs === 1 ? 'קטע' : `${segs} קטעים`),
        names.length && `${names.length === 1 ? 'הנקודה' : 'הנקודות'} ${names.join(', ')}`,
        lines.length && (lines.length === 1 ? `ישר${said.length ? ` ${said[0]}` : ''}` : `${lines.length} ישרים${said.length ? `: ${said.join(', ')}` : ''}`),
        meet && `הישרים נפגשים ב־(${figNum(meet[0])}, ${figNum(meet[1])})`,
        f.path?.length && 'מסלול מראשית הצירים',
        rr && `צעד של ${figNum(Math.abs(rr.run))} ${rr.run > 0 ? 'ימינה' : 'שמאלה'} ו־${figNum(Math.abs(rr.rise))} ${rr.rise >= 0 ? 'למעלה' : 'למטה'}`,
        f.words?.length && `כתוב: ${f.words.map((w) => w.text).join(', ')}`].filter(Boolean).join(', ');
    }
    // a graph is read: its words give every number it draws, as the eye reads them off the grid
    case 'sgraph': return sgraphWords(f);
    // a protractor is read arm by arm, each arm's two numbers named by scale; a clock says its time
    case 'protractor': return protractorWords(f);
    case 'clock': return `שעון: השעה ${clockText(f.h, f.m)}`;
    default: return '';
  }
}

// ---------------------------------------------------------------- checking, words and test states

export function manipCorrect(it, u) {
  if (u == null) return false;
  const m = it.manip; const a = it.answer;
  switch (m.kind) {
    case 'numberline': return samePlace(m, u, a);
    case 'angle': return m.protractor && m.mode === 'align' ? typeof u === 'number' && protAligned(m.arms, u) : u === a;
    case 'bars': return u === a;
    case 'plot': return m.quadrant ? quadOf(u) === m.quadrant && (m.fixX == null || u[0] === m.fixX) && (m.fixY == null || u[1] === m.fixY) : u[0] === a[0] && u[1] === a[1];
    case 'line': return near(u.m, a.m, 1e-9) && near(u.b, a.b, 1e-9);
    case 'squares': return Number.isInteger(u.a) && Number.isInteger(u.b) && u.a * u.a + u.b * u.b === a.c * a.c;
    case 'pins': return Array.isArray(u) && u.length === a.length && u.every((v, i) => samePlace(m, v, a[i]));
    case 'triangle': return rightAtC(m, u);
    // the answer is x's value: the value itself counts (as answerText shows it), and a scale must show one box alone
    case 'balance': return typeof u === 'number' ? u === a : balanceSolved(u, a);
    case 'tiles': return u.px - u.nx === a.k && u.p1 - u.n1 === a.c && Math.min(u.px, u.nx) === 0 && Math.min(u.p1, u.n1) === 0;
    case 'area': return u.a === a.a && u.b === a.b;
    case 'ray': return u.at === a.at && u.dir === a.dir && !!u.closed === !!a.closed;
    case 'fbar': {
      if (!fbarOk(m, u)) return false;
      if (a.mode === 'exact') return u.den === a.den && u.shaded === a.shaded;
      if (a.mode === 'common') return a.of.every((q) => u.den % q === 0);
      return near(u.shaded / u.den, a.value, 1e-9);
    }
    case 'dline': { const v = dlineValue(m, u); return typeof v === 'number' && near(v, a, 1e-9); }
    case 'graph': return graphCorrect(m, a, u);
    default: return false;
  }
}

const num = (v) => plainNum(v);
/** Triangle ABC with A and B fixed: is the angle at C (strictly above the base) exactly a right angle? */
export const rightAtC = (m, c) => !!c && c[1] > 0 && (m.A[0] - c[0]) * (m.B[0] - c[0]) + (m.A[1] - c[1]) * (m.B[1] - c[1]) === 0;
/** The three angles of the triangle in degrees, A, B and C. */
export function triangleAngles(m, c) {
  const ang = (p, q, r) => { const u = [q[0] - p[0], q[1] - p[1]]; const v = [r[0] - p[0], r[1] - p[1]]; return (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI; };
  return [ang(m.A, m.B, c), ang(m.B, m.A, c), ang(c, m.A, m.B)];
}
// maths inside a Hebrew sentence is isolated left to right, so it reads 6² + 8² = 10² and not backwards
const ltr = (t) => `⁦${t}⁩`;
export const lineText = ({ m, b }) => `y = ${m === 1 ? '' : m === -1 ? '-' : num(m)}x${b === 0 ? '' : b > 0 ? ` + ${num(b)}` : ` - ${num(-b)}`}`;

/** The answer (or a student's state) as plain text. */
export function manipText(it, u = it.answer) {
  if (u == null) return '';
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': return lineNum(m, u);
    case 'bars': return num(u);
    case 'angle': return m.protractor && m.mode === 'align' ? `מד הזווית מסובב ב־${num(u)}°` : `${num(u)}°`;
    case 'plot': return m.quadrant && u === it.answer ? `נקודה ב${QUAD_NAMES[m.quadrant]}, למשל ${ltr(`(${num(u[0])}, ${num(u[1])})`)}` : `(${num(u[0])}, ${num(u[1])})`;
    case 'line': return lineText(u);
    case 'squares': return u.c != null ? `ניצבים ${u.a} ו־${u.b}: ${ltr(`${u.a}² + ${u.b}² = ${u.c}²`)}` : `ניצבים ${u.a} ו־${u.b}`;
    case 'pins': return m.labels.map((l, i) => `${labelPlain(l)} ב־${ltr(lineNum(m, u[i]))}`).join(', ');
    case 'triangle': return u === it.answer ? `למשל ${ltr(`C(${num(u[0])}, ${num(u[1])})`)}: הזווית C ישרה` : ltr(`C(${num(u[0])}, ${num(u[1])})`);
    // the answer is x's value; a student's state is the scale as an equation (≠ while it leans)
    case 'balance': return typeof u === 'number' ? `x = ${num(u)}` : balanceTex(u, it.answer).replace('\\ne', '≠');
    case 'tiles': return u.px != null ? tilesTex(u) : linText(u);
    case 'area': return areaTex(u);
    case 'ray': return rayText(u);
    // the answer is a rule ({ mode }); a student's state is the bar as built
    case 'fbar': {
      if (u.mode === 'value') return plainNum(u.value, { maxDen: FBAR_MAX_DEN, places: 3 });
      if (u.mode === 'common') return `מספר חלקים שמתחלק ב־${u.of.join(' וב־')}, למשל ${u.of.reduce(lcm, 1)}`;
      return `${u.shaded}/${u.den}`;
    }
    case 'dline': { const v = dlineValue(m, u); return v == null ? '' : withUnit(v, m.move === 'max' ? m.bottom.unit : m.top.unit); }
    // a student's state, or values, is the points; a shape is its segments in words; a uniform rate says so and shows one
    case 'graph': {
      const units = graphUnits(m); const pts = (vals) => `${ltr(graphPointsText(m, vals))}${units ? ` (${units})` : ''}`;
      if (Array.isArray(u)) return pts(u);
      if (u.mode === 'values') return pts(u.values);
      if (u.mode === 'shape') return `קטעים משמאל לימין: ${u.shape.map((d) => GRAPH_SHAPE_WORD[d]).join(', ')}`;
      const given = [u.start != null && `מתחילים ב־${plainNum(u.start)}`, u.rate != null && `${plainNum(u.rate)} לכל יחידה של x`].filter(Boolean).join(', ');
      return `קצב אחיד: כל קטע משתנה באותו מספר${given ? `, ${given}` : ''}; למשל ${pts(graphSolution(m, u))}`;
    }
    default: return '';
  }
}

/** The interactive setup in words, for the AI tutor and the teacher. */
export function manipPlain(it) {
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': return m.den
      ? `[ציר מספרים מ־${m.min} עד ${m.max}, כל יחידה מחולקת ל־${m.den} חלקים שווים; מזיזים סמן מהנקודה ${m.from}]`
      : `[ציר מספרים מ־${m.min} עד ${m.max}; מזיזים סמן מהנקודה ${m.from}]`;
    case 'plot': return m.quadrant ? `[מערכת צירים; שמים נקודה ב${QUAD_NAMES[m.quadrant]}${m.fixX != null ? ` שה־x שלה ${m.fixX}` : m.fixY != null ? ` שה־y שלה ${m.fixY}` : ''}]`
      : m.line ? `[מערכת צירים עם הישר; שמים עליו את הנקודה שבה x = ${it.answer[0]}]`
        : m.lines ? `[מערכת צירים עם שני ישרים, ${m.lines.map(lineText).join(' ו־')}; שמים את נקודת המפגש שלהם]`
          : m.shape ? `[מערכת צירים; הקודקודים ${m.shape.map((q) => `${q.label}(${q.at.join(', ')})`).join(', ')}; שמים את הקודקוד ${m.label}]` : `[מערכת צירים; שמים את הנקודה ${m.label || ''}]`;
    case 'line': return '[מערכת צירים; בונים ישר בעזרת שתי נקודות: החיתוך עם ציר y וצעד אחד ימינה]';
    case 'angle':
      if (m.protractor && m.mode === 'align') return `[זווית ששוקיה בכיוונים ${num(m.arms[0])}° ו־${num(m.arms[1])}°; מסובבים את מד הזווית עד שקו האפס שלו על אחת השוקיים]`;
      if (m.protractor) return `[מד זווית על הקודקוד${m.letters?.vertex ? ` ${m.letters.vertex}` : ''}; השוק הקבועה על 0 של הסולם ש${m.from === 'left' ? 'מתחיל משמאל' : 'מתחיל מימין'}; מסובבים את הקרן]`;
      return `[קו ישר וקרן מסתובבת; הזווית הצמודה צריכה להיות ${m.target}°]`;
    case 'squares': return `[משולש ישר־זווית עם ריבועים על הצלעות; שטח הריבוע על היתר צריך להיות ${it.answer.c * it.answer.c}]`;
    case 'bars': return m.stat === 'median' ? `[עמודות: ${m.values.join(', ')} ועוד עמודה אחת שמזיזים; החציון צריך להיות ${m.target}]` : `[עמודות: ${m.values.join(', ')} ועוד עמודה אחת שמזיזים; הממוצע צריך להיות ${m.mean}]`;
    case 'pins': return `[ציר מספרים מ־${m.min} עד ${m.max}${m.den ? `, כל יחידה מחולקת ל־${m.den} חלקים שווים` : ''}; שמים עליו את המספרים ${m.labels.map(labelPlain).join(', ')}]`;
    case 'triangle': return `[משולש ABC עם A(${m.A.join(', ')}) ו־B(${m.B.join(', ')}); מזיזים את C עד שהזווית C ישרה]`;
    case 'balance': return `[מאזניים מאוזנים: ${balanceWords(m.start)}. כל קופסה שוקלת x משקולות. מורידים קופסאות ומשקולות מהכפות עד שנשארת קופסה אחת לבד]`;
    case 'tiles': return `[אריחים: ${tilesWords(m.start)}; מורידים זוגות אפס (x עם −x, 1 עם −1)]`;
    case 'area': return `[מלבן שבונים: גובה (עד ${m.maxA || 6}) ואורך x ועוד יחידות (עד ${m.maxB || 9})]`;
    case 'ray': return `[ציר מספרים מ־${m.min ?? -10} עד ${m.max ?? 10}; מסמנים את הפתרונות: נקודה, עיגול מלא או ריק, וקרן ימינה או שמאלה]`;
    case 'fbar': return `[פס שברים: ${fbarWords(m.start)}${m.lockDen ? ' (מספר החלקים קבוע)' : `; אפשר לחלק לעד ${m.maxDen || FBAR_MAX_DEN} חלקים`}${m.marks?.length ? `; סימונים מעל הפס ב־${m.marks.map((x) => num(x)).join(', ')}` : ''}${m.whole != null ? `; הפס כולו ${dlineNum(m.whole)}` : ''}]`;
    case 'dline': {
      const line = (L) => `${L.label} מ־0 עד ${withUnit(L.max, L.unit)}`;
      return m.move === 'max'
        ? `[ציר כפול: למעלה ${line(m.top)}, למטה ${m.bottom.label}; הסמן קבוע על ${withUnit(m.fixT, m.top.unit)}; מותחים את הציר התחתון (השלם) בצעדים של ${dlineNum(m.bottom.step)}, עד ${withUnit(m.bottom.max, m.bottom.unit)}]`
        : `[ציר כפול: למעלה ${line(m.top)}, למטה ${line(m.bottom)}; מזיזים את הסמן בצעדים של ${withUnit(m.top.step, m.top.unit)}]`;
    }
    case 'graph': {
      const ax = (name, A) => `ציר ${name} ${A.label} מ־${plainNum(axisLo(A))} עד ${plainNum(A.max)} כל ${plainNum(A.step)}`;
      const fixed = fixedWords(m);
      const ref = m.ref ? `; קו קבוע נוסף${m.ref.label ? ` ${m.ref.label}` : ''}: ${m.ref.pts.map(([x, y]) => `(${plainNum(x)}, ${plainNum(y)})`).join(' → ')}` : '';
      return `[גרף: ${ax('x', m.x)}; ${ax('y', m.y)}; מזיזים נקודה מעל כל ערך של x${fixed ? `; ${fixed}` : ''}${ref}]`;
    }
    default: return '';
  }
}

/** A state that answers the exercise (the shape the object holds, not the shape of `answer`). */
export function manipSolution(it) {
  const a = it.answer; const m = it.manip;
  switch (m.kind) {
    case 'squares': return { a: a.a, b: a.b };
    // the box stays on the pan that had more boxes
    case 'balance': return m.start.lx >= m.start.rx ? { lx: 1, l1: 0, rx: 0, r1: a } : { lx: 0, l1: a, rx: 1, r1: 0 };
    case 'tiles': return { px: Math.max(a.k, 0), nx: Math.max(-a.k, 0), p1: Math.max(a.c, 0), n1: Math.max(-a.c, 0) };
    // the smallest bar that shows the value (the locked number of parts when the question fixes it)
    case 'fbar': {
      if (a.mode === 'exact') return { den: a.den, shaded: a.shaded };
      if (a.mode === 'common') return { den: a.of.reduce(lcm, 1), shaded: 0 };
      const den = m.lockDen ? m.start.den : fbarDenFor(a.value, m.maxDen || FBAR_MAX_DEN);
      return { den, shaded: Math.round(a.value * den) };
    }
    case 'graph': return graphSolution(m, a);
    // align: the answer when it is a right turn, else the first right one
    case 'angle': return m.protractor && m.mode === 'align' && !protAligned(m.arms, a) ? armTurns(m.arms).find((r) => protAligned(m.arms, r)) : a;
    default: return a;
  }
}

/** A state close to the answer that is wrong: for automated checks of the "not yet" path. */
export function manipWrong(it) {
  const m = it.manip; const a = it.answer;
  switch (m.kind) {
    case 'numberline': { const d = lineStep(m); return a + d <= m.max + 1e-9 ? a + d : a - d; }
    // the protractor: the other scale's reading (a right angle reads 90 on both: one step off), or the baseline on an
    // arm with the angle outside the half disc
    case 'angle':
      if (m.protractor && m.mode === 'align') return armTurns(m.arms).find((r) => !protAligned(m.arms, r));
      if (m.protractor) return a === 90 ? 95 : 180 - a;
      return a < 175 ? a + 5 : a - 5;
    case 'bars': return a < m.max ? a + 1 : a - 1;
    case 'plot': return m.quadrant ? (m.fixX != null ? [a[0], -a[1]] : [-a[0], a[1]]) : [a[0] < (m.range || 6) ? a[0] + 1 : a[0] - 1, a[1]];
    case 'line': { const r = m.range || 6; return Math.abs(a.b + a.m + 1) <= r && a.m + 1 !== 0 ? { m: a.m + 1, b: a.b } : { m: a.m - 1, b: a.b }; }
    case 'squares': return { a: a.a, b: a.b + 1 };
    case 'pins': { const d = lineStep(m); return a.map((v, i) => (i === 0 ? (v + d <= m.max + 1e-9 ? v + d : v - d) : v)); }
    case 'triangle': return [a[0] + 1 <= (m.range || 6) ? a[0] + 1 : a[0] - 1, a[1]];
    // one step short: level, but a weight left beside the box
    case 'balance': { const s = manipSolution(it); return s.lx ? { ...s, l1: 1, r1: s.r1 + 1 } : { ...s, r1: 1, l1: s.l1 + 1 }; }
    // one zero pair left
    case 'tiles': { const s = manipSolution(it); return s.p1 + s.n1 + 2 <= TILES_MAX.unit ? { ...s, p1: s.p1 + 1, n1: s.n1 + 1 } : { ...s, px: s.px + 1, nx: s.nx + 1 }; }
    case 'area': return { a: a.a, b: a.b < (m.maxB || 9) ? a.b + 1 : a.b - 1 };
    // the boundary: the circle full instead of empty, or the other way
    case 'ray': return { ...a, closed: !a.closed };
    // one part more shaded (one less on a full bar); for a common count, one part more than the smallest
    case 'fbar': {
      const sol = manipSolution(it);
      if (a.mode === 'common') { const max = m.maxDen || FBAR_MAX_DEN; return { den: sol.den + 1 <= max ? sol.den + 1 : sol.den - 1, shaded: 0 }; }
      return { den: sol.den, shaded: sol.shaded < sol.den ? sol.shaded + 1 : sol.shaded - 1 };
    }
    // one step past the answer (one step short at the end of the line)
    case 'dline': {
      const L = m.move === 'max' ? m.bottom : m.top; const lo = m.move === 'max' ? L.step : 0;
      return a + L.step <= L.max + 1e-9 ? a + L.step : Math.max(lo, a - L.step);
    }
    case 'graph': return graphWrong(m, a);
    default: return null;
  }
}
