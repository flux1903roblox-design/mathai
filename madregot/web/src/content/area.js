// Areas and perimeters (שטחים והיקפים): unit 7.12 of grade 7 (ז׳) in the Ministry's תשפ״ז schedule, areas A in
// December and January, areas B in April and perimeters in May (curriculum stage 2, MEASURE-2). Five stairs: the
// rectangle's perimeter and area, the triangle (CLASSROOM-13's right triangle inside, in the class's form), composite
// shapes, the parallelogram and the trapezoid, and perimeters (the same perimeter, another area). Taught from December,
// so the first-day placement test skips it (placement: false, MEASURE-1.6).
//
// This file is the practice and diagnosis layer: the topic object, the names of its mistakes, the generators of every
// practice kind, and the ten diagnostic and transfer models (AREA1 to AREA5T) with their texts, drawings, solutions and
// hints. It is not on the path yet (it is in neither GRADE7 nor TOPIC_ORDER): a topic goes on the path whole, with its
// teaching (learn/content/area.ts), its challenges, its programme parts, its scenery and its stair names, which land
// together in the next sitting. Its tests import it directly.
//
// The models are the stage-2 spec's (scratchpad/lanes/stage2/spec/models.mjs), ported unchanged: a draw is redrawn
// when a misconception's prediction looks like a slip of the hand, lies within 0.06 of the right answer or of another
// prediction (clean). Practice kinds that share a model's situation draw through its params; every practice draw with a
// diagnosis is redrawn by the same rule, and every practice draw is redone while its answer is a number the question
// prints (noCopy), so copying a number from the question is never right. Units sit after the number, outside the
// maths, and an item's `unit` is the answer's unit. Every number a drawing writes is in the text too, except on a grid,
// where the text says that each square is 1 סמ״ר and the drawing's words list the corners. Errors and their sources
// (stage2.md MEASURE-2):
//   perimeter, area-for-perim       area and perimeter swapped (Tan Şişman & Aksu 2016, IJSME 14(7): "confusing area
//                                   formula with perimeter"; coord:4 already names the first)
//   same-perim-same-area            equal perimeters read as equal areas (Tirosh & Stavy 1999, ESM 38, "same A – same B")
//   add-sides, two-sides, one-side-perim, missing-sides, perim-as-area   teacher-reported; the Ministry asks for
//                                   "פתרון שאלות הפוכות" and perimeters of composite shapes
//   no-half, half-twice, hyp-as-height   the class's notebook (CLASSROOM-13); no-half is linear's id
//   slant-as-height, inside-height  non-internal altitudes are the hardest items, an internal altitude the prototype
//                                   (Gutiérrez & Jaime 1999, JMTE 2; Hershkowitz 1989)
//   no-subtract, double-count       teacher-reported; the Ministry's strategies "השלמות, פירוק וחלוקה"
//   diag-no-half, one-base, half-para   teacher-reported
//   no-convert, div-by-side, unit-mix   the Ministry: "המרת יחידות אורך", "(שימו לב ליחידות המידה!)"
//   add-legs                        pyth's id: the hypotenuse taken as the sum of the legs
import { shuffle } from './util.js';
import { slipOf, slipLike, matchesValue } from '@/learn/misconceptions.ts';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const r9 = (v) => Math.round(v * 1e9) / 1e9;
/** A number as written: 2.3, 6.5 (never 6.4999999). */
export const num = (v) => String(r9(v));
const same = (a, b) => Math.abs(a - b) < 1e-9;

/** The units, written after the number and outside the maths. */
export const UNIT = { cm: 'ס״מ', cm2: 'סמ״ר', m: 'מ׳', m2: 'מ״ר', tiles: 'אריחים' };

// ---------------------------------------------------------------- clean draws (models.mjs, unchanged)

/** No two predictions a hair apart (within 0.06, not equal). */
function apart(vals) {
  for (let i = 0; i < vals.length; i += 1) for (let j = i + 1; j < vals.length; j += 1) {
    const d = Math.abs(vals[i] - vals[j]);
    if (d > 1e-9 && d <= 0.06) return false;
  }
  return true;
}
/** Predictions that are fair for a diagnosis: none a slip of the hand (or typed rounded to one), none near the answer, none near another. */
export function fair(ans, values) {
  const vals = [];
  for (const v of values) {
    if (v == null) continue;
    if (!Number.isFinite(v)) return false;
    if (Math.abs(v - ans) < 1e-9) continue; // does not show here
    if (slipLike(v, ans)) return false;
    if (Math.abs(v - ans) <= 0.06) return false;
    vals.push(v);
  }
  return apart(vals);
}
/** A draw is clean when every prediction of the model is fair. */
export const clean = (model, p) => fair(model.answer(p), Object.values(model.bugs).map((f) => f(p)));
export function mk(m) {
  m.params = (r) => { for (let i = 0; i < 100000; i += 1) { const p = m.raw(r); if (p && clean(m, p)) return p; } throw new Error('no clean draw'); };
  return m;
}

/**
 * The diagnosis of a typed answer from [id, predicted value] pairs (one id may predict several values): the rule of
 * eq.js diagOf. A prediction that is the answer or a slip of the hand from it names nothing; an exact match names its
 * id; a prediction that is not whole also matches its rounding to tenths or hundredths, when only one id rounds there.
 */
export function diagList(ans, pairs) {
  const real = pairs.filter(([, v]) => v != null && Number.isFinite(v) && !same(v, ans) && !slipOf(v, ans));
  return (u) => {
    if (typeof u !== 'number') return null;
    const exact = real.find(([, v]) => Math.abs(u - v) <= 1e-6);
    if (exact) return exact[0];
    const near = [...new Set(real.filter(([, v]) => !Number.isInteger(v) && matchesValue(v, u, ans)).map(([id]) => id))];
    return near.length === 1 ? near[0] : null;
  };
}
/** Every prediction of a model for one draw, as [id, value] pairs. */
export const bugsAt = (model, p) => Object.entries(model.bugs).map(([id, f]) => [id, f(p)]);
/**
 * A practice draw: `f` returns { answer, printed, bugs? } (or null to draw again). It is redone while its answer is a
 * number the question prints, or while a prediction is unfair (a slip, near the answer, near another prediction).
 */
function draw(f) {
  for (;;) {
    const q = f();
    if (!q) continue;
    if ((q.printed || []).some((v) => same(v, q.answer))) continue;
    if (q.bugs && !fair(q.answer, q.bugs.map(([, v]) => v))) continue;
    return q;
  }
}
/** A level's generator: one of its kinds, by weight. */
const byWeight = (kinds) => () => {
  let r = Math.random() * kinds.reduce((a, [w]) => a + w, 0);
  for (const [w, f] of kinds) { r -= w; if (r < 0) return f(); }
  return kinds[kinds.length - 1][1]();
};

// ---------------------------------------------------------------- right triangles with whole sides

/** Every Pythagorean triple (p < q < c) with hypotenuse at most max. */
export function triples(max) {
  const out = [];
  for (let p = 1; p <= max; p += 1) for (let q = p + 1; q <= max; q += 1) { const c = Math.sqrt(p * p + q * q); if (Number.isInteger(c) && c <= max) out.push([p, q, c]); }
  return out;
}
const T30 = triples(30);
const T34 = triples(34); // CLASSROOM-13's 16, 30, 34 can come up
/** A triple in a random order of its legs: [leg1, leg2, hyp]. */
const tri = (r, list) => { const [p, q, c] = pick(r, list); return r() < 0.5 ? [p, q, c] : [q, p, c]; };
/** [h, d, s]: a height h, the offset d of its foot, the slanted side s, from the triples 3-4-5 to 8-15-17. */
export const HDS = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [9, 12, 15], [12, 9, 15], [8, 15, 17], [15, 8, 17]];

// ---------------------------------------------------------------- the models (models.mjs, unchanged)

/** area:1 — the area or the perimeter of a rectangle a by b (the length a is the longer side). */
export const AREA1 = mk({
  raw: (r) => { const k = rint(r, 0, 1); const a = rint(r, 3, 15); const b = rint(r, 2, 12); if (b >= a || a * b === 2 * (a + b)) return null; return { k, a, b }; },
  answer: ({ k, a, b }) => (k ? 2 * (a + b) : a * b),
  bugs: {
    perimeter: ({ k, a, b }) => (k ? null : 2 * (a + b)), // coord's id: the perimeter where the area was asked
    'add-sides': ({ k, a, b }) => (k ? null : a + b), // coord's id: the two sides added, not multiplied
    'area-for-perim': ({ k, a, b }) => (k ? a * b : null), // the area where the perimeter was asked
    'two-sides': ({ k, a, b }) => (k ? a + b : null), // CLASSROOM-8's id: one length and one width, half the way round
  },
});
/** area:1 transfer — a fence of P metres round a garden a metres long: how wide is it? */
export const AREA1T = mk({
  raw: (r) => { const a = rint(r, 4, 20); const b = rint(r, 2, 15); if (b >= a) return null; return { a, b, P: 2 * (a + b) }; },
  answer: ({ b }) => b,
  bugs: {
    'one-side-perim': ({ a, P }) => P - a, // one length taken off, not two
    'perim-as-area': ({ a, P }) => P / a, // the perimeter divided by the length, as if it were an area
  },
});

/** area:2 — any triangle: a side b, the height h to it (inside, or outside for an obtuse triangle), a slanted side s. */
export const AREA2 = mk({
  raw: (r) => {
    const [h, d, s] = pick(r, HDS); const b = rint(r, 4, 16); const out = r() < 0.4;
    if (!out && d >= b) return null; if ((b * h) % 2) return null;
    return { b, h, d, s, out: out ? 1 : 0 };
  },
  answer: ({ b, h }) => (b * h) / 2,
  bugs: {
    'no-half': ({ b, h }) => b * h,
    'slant-as-height': ({ b, s }) => (b * s) / 2, // the slanted side used as the height
  },
});
/** area:2 transfer — CLASSROOM-13 T2 in the class's form: one leg a and the area S, the other leg x. */
export const AREA2T = mk({
  raw: (r) => {
    const a = rint(r, 6, 16); const x = rint(r, 4, 15); if ((a * x) % 2 || x === a) return null;
    const S = (a * x) / 2; if ((a === 10 && S === 45) || (a === 7 && S === 21)) return null; // never the notebook's
    return { a, x, S, at: pick(r, ['C', 'B', 'A']) };
  },
  answer: ({ x }) => x,
  bugs: {
    'no-half': ({ a, S }) => S / a, // S = a·x without the /2
    'half-twice': ({ a, S }) => S / (2 * a), // divided by 2 on the other side too
  },
});

/** area:3 — an L: a W by H rectangle with a w by h corner missing (all four lengths given). */
export const AREA3 = mk({
  raw: (r) => { const W = rint(r, 6, 14); const H = rint(r, 5, 12); const w = rint(r, 2, W - 2); const h = rint(r, 2, H - 2); return { W, H, w, h }; },
  answer: ({ W, H, w, h }) => W * H - w * h,
  bugs: {
    'no-subtract': ({ W, H }) => W * H, // the whole rectangle, the missing corner not taken off
    'double-count': ({ W, H, w, h }) => W * (H - h) + (W - w) * H, // the two parts overlap: (W − w)(H − h) counted twice
  },
});
/** area:3 transfer — a W by H plot with a right-triangle corner (legs p, q) cut off. */
export const AREA3T = mk({
  raw: (r) => { const W = rint(r, 6, 14); const H = rint(r, 4, 10); const p = rint(r, 2, W - 1); const q = rint(r, 2, H - 1); if ((p * q) % 2) return null; return { W, H, p, q }; },
  answer: ({ W, H, p, q }) => W * H - (p * q) / 2,
  bugs: {
    'no-subtract': ({ W, H }) => W * H,
    'no-half': ({ W, H, p, q }) => W * H - p * q, // the triangle taken as the whole rectangle p by q
  },
});

/** area:4 — a right trapezoid: bases a > b, height h (the upright leg), slanted leg s; a − b = d from [h, d, s]. */
export const AREA4 = mk({
  raw: (r) => { const [h, d, s] = pick(r, HDS); const b = rint(r, 3, 12); const a = b + d; if (((a + b) * h) % 2) return null; return { a, b, h, s }; },
  answer: ({ a, b, h }) => ((a + b) * h) / 2,
  bugs: {
    'no-half': ({ a, b, h }) => (a + b) * h,
    'one-base': ({ a, h }) => a * h, // only the long base times the height
    'slant-as-height': ({ a, b, s }) => ((a + b) * s) / 2,
  },
});
/** area:4 transfer — a parallelogram plot: side a, the height h to it, the slanted side s. */
export const AREA4T = mk({
  raw: (r) => { const [h, , s] = pick(r, HDS); const a = rint(r, 4, 16); if ((a * h) % 2) return null; return { a, h, s }; },
  answer: ({ a, h }) => a * h,
  bugs: {
    'slant-as-height': ({ a, s }) => a * s,
    'half-para': ({ a, h }) => (a * h) / 2, // halved as in a triangle
  },
});

/** area:5 — the perimeter of an L: only W, H, w, h are written; the top and the right side are not. */
export const AREA5 = mk({
  raw: AREA3.raw,
  answer: ({ W, H }) => 2 * (W + H),
  bugs: {
    'missing-sides': ({ W, H, w, h }) => W + H + w + h, // only the sides with a number on them
    'area-for-perim': ({ W, H, w, h }) => W * H - w * h, // the area
  },
});
/** area:5 transfer — a notice board a metres (one decimal) by b cm: its frame, in cm. */
export const AREA5T = mk({
  raw: (r) => { const a = rint(r, 11, 35) / 10; const b = 5 * rint(r, 4, 18); if (Number.isInteger(a)) return null; return { a, b }; },
  answer: ({ a, b }) => r9(2 * (100 * a + b)),
  bugs: {
    'no-convert': ({ a, b }) => r9(2 * (a + b)), // metres added to centimetres
    'two-sides': ({ a, b }) => r9(100 * a + b), // CLASSROOM-8's id
  },
});

/** Which models serve which stair, as its diagnostic and its transfer model. */
export const STAIR_MODELS = {
  'area:1': [AREA1, AREA1T], 'area:2': [AREA2, AREA2T], 'area:3': [AREA3, AREA3T], 'area:4': [AREA4, AREA4T], 'area:5': [AREA5, AREA5T],
};

// ---------------------------------------------------------------- drawings
// Still geo figures (components/Figure.jsx). A point whose name starts with "_" is drawn without a letter: a figure
// shows only the letters its text uses. Every number written on a figure is in its text.

/** A side with its length (or a letter) written on it. */
const lab = (a, b, label, extra = {}) => ({ a, b, label: String(label), ...extra });
const rightAt = (at, from, to) => ({ at, from, to, right: true });

/** A rectangle a by b, both lengths written. */
export const rectFig = (a, b) => ({
  type: 'geo', label: 'מלבן', pts: { _a: [0, 0], _b: [a, 0], _c: [a, b], _d: [0, b] },
  polys: [{ pts: ['_a', '_b', '_c', '_d'] }], segs: [lab('_a', '_b', a), lab('_b', '_c', b)],
});

/** The two legs at the right angle, by the vertex it is at: the class reads them from the square (CLASSROOM-13). */
export const LEGS = { C: ['AC', 'BC'], B: ['AB', 'BC'], A: ['AB', 'AC'] };
/** The side opposite the right angle. */
export const HYP = { C: 'AB', B: 'AC', A: 'BC' };
/** Triangle ABC with the right angle at `at`, its first leg (LEGS[at][0]) l1 long and its second l2; `labels` by side name. */
export function rightTriFig(at, l1, l2, labels) {
  const pts = at === 'C' ? { C: [0, 0], A: [0, l1], B: [l2, 0] } : at === 'B' ? { B: [0, 0], A: [0, l1], C: [l2, 0] } : { A: [0, 0], B: [l1, 0], C: [0, l2] };
  const [o1, o2] = ['A', 'B', 'C'].filter((k) => k !== at);
  return {
    type: 'geo', label: 'משולש ישר־זווית', pts, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: Object.entries(labels).map(([side, v]) => lab(side[0], side[1], v)),
    angles: [rightAt(at, o1, o2)],
  };
}
/** A right triangle with no letters: its legs p (up) and q (across), the hypotenuse written only when `c` is given. */
export function legsFig(p, q, c) {
  return {
    type: 'geo', label: 'משולש ישר־זווית', pts: { _r: [0, 0], _p: [0, p], _q: [q, 0] }, polys: [{ pts: ['_r', '_q', '_p'] }],
    segs: [lab('_r', '_p', p), lab('_r', '_q', q), ...(c ? [lab('_p', '_q', c)] : [])], angles: [rightAt('_r', '_q', '_p')],
  };
}

/** Triangle ABC on base BC (b) with the height h from A (dashed, its foot on BC, or outside on BC's extension) and AB = s. */
export function heightFig({ b, h, d, s, out }) {
  const ax = out ? -d : d;
  // an inside height has its number on C's side, clear of AB's; outside, B's letter sits left, clear of a short BC's number
  const segs = [lab('B', 'C', b), lab('A', '_H', h, { dash: true, ...(out ? {} : { side: 'in' }) }), lab('A', 'B', s)];
  if (out) segs.push({ a: '_H', b: 'B', dash: true }); // BC's extension, to the foot of the height
  return {
    type: 'geo', label: out ? 'משולש קהה־זווית, והגובה מחוץ לו' : 'משולש והגובה בתוכו',
    pts: { B: [0, 0], C: [b, 0], A: [ax, h], _H: [ax, 0] }, polys: [{ pts: ['A', 'B', 'C'] }], segs,
    angles: [rightAt('_H', out ? 'B' : 'C', 'A')],
    ...(out ? { lab: { B: [-15, 12] } } : {}),
  };
}

/** An L: a W by H rectangle with its top right corner w by h missing; `cut` draws the missing corner hatched. */
export function lFig(W, H, w, h, { cut = false } = {}) {
  const pts = { _1: [0, 0], _2: [W, 0], _3: [W, H - h], _4: [W - w, H - h], _5: [W - w, H], _6: [0, H] };
  const polys = [{ pts: ['_1', '_2', '_3', '_4', '_5', '_6'] }];
  if (cut) { pts._7 = [W, H]; polys.push({ pts: ['_4', '_3', '_7', '_5'], tone: 'cut' }); }
  // the corner's numbers go inside the L, under its bottom edge and left of its side, so even a small corner keeps
  // them apart. Figure.jsx puts a label away from the middle of the shapes ('in' turns it round): the middle is the
  // average of the shapes' points, as there
  const all = polys.flatMap((pg) => pg.pts.map((k) => pts[k]));
  const mx = all.reduce((a, p) => a + p[0], 0) / all.length; const my = all.reduce((a, p) => a + p[1], 0) / all.length;
  const under = H - h > my ? { side: 'in' } : {}; // away from the middle would be up, into the corner
  const left = W - w >= mx ? { side: 'in' } : {}; // away from the middle (or no side at all) would be right, into the corner
  return { type: 'geo', label: 'צורה בצורת L', pts, polys, segs: [lab('_1', '_2', W), lab('_6', '_1', H), lab('_4', '_3', w, under), lab('_4', '_5', h, left)] };
}

/** A W by H plot with a right triangle (legs p along the top, q down the right side) cut off its top right corner. */
export function plotFig(W, H, p, q) {
  return {
    type: 'geo', label: 'חלקה מלבנית שחתכו ממנה משולש בפינה',
    pts: { _1: [0, 0], _2: [W, 0], _3: [W, H - q], _4: [W - p, H], _5: [0, H], _6: [W, H] },
    polys: [{ pts: ['_1', '_2', '_3', '_4', '_5'] }, { pts: ['_4', '_6', '_3'], tone: 'cut' }],
    segs: [lab('_1', '_2', W), lab('_5', '_1', H), lab('_4', '_6', p), lab('_6', '_3', q)],
  };
}

/** A quadrilateral whose diagonals d1 (across) and d2 (up) meet at right angles: a rhombus, or a kite (`kite`). */
export function diagonalsFig(d1, d2, kite) {
  const [across, up] = d1 >= d2 ? [d1, d2] : [d2, d1]; // the longer diagonal across, where the drawing has room
  const k = kite ? r9(across * 0.3) : across / 2;
  // the across number sits under its diagonal just past the crossing, where the shape is deepest (16 px on, at the
  // scale Figure.jsx fits the drawing to its 240 by 140 box), clear of the right-angle mark above the line
  const scale = Math.min(240 / across, 140 / up);
  const t = r9(Math.min(0.9, (k + 16 / scale) / across));
  return {
    type: 'geo', label: kite ? 'דלתון ואלכסוניו' : 'מעוין ואלכסוניו',
    pts: { _l: [0, 0], _r: [across, 0], _t: [k, up / 2], _b: [k, -up / 2], _o: [k, 0] },
    polys: [{ pts: ['_l', '_b', '_r', '_t'] }],
    segs: [lab('_l', '_r', across, { dash: true, t }), lab('_t', '_b', up, { dash: true, t: 0.3 })],
    angles: [rightAt('_o', '_r', '_t')],
  };
}

/** Parallelogram ABCD on AB (a), with the height h from D (dashed) and AD = s; d is how far D sits past A. */
export function paraFig({ a, h, s }) {
  const d = Math.round(Math.sqrt(s * s - h * h));
  const segs = [lab('A', 'B', a), lab('A', 'D', s), lab('D', '_F', h, { dash: true })];
  if (d > a) segs.push({ a: 'B', b: '_F', dash: true }); // AB's extension, to the foot of the height
  return {
    type: 'geo', label: 'מקבילית והגובה לצלע', pts: { A: [0, 0], B: [a, 0], C: [a + d, h], D: [d, h], _F: [d, 0] },
    polys: [{ pts: ['A', 'B', 'C', 'D'] }], segs, angles: [rightAt('_F', 'A', 'D')],
    lab: { B: [12, 14] }, // below and to the right of B, clear of a short AB's number
  };
}

/** A right trapezoid: the long base a below, the short base b above, the upright leg h; the slanted leg s when given. */
export function rightTrapFig(a, b, h, s) {
  return {
    type: 'geo', label: 'טרפז ישר־זווית', pts: { _1: [0, 0], _2: [a, 0], _3: [b, h], _4: [0, h] },
    polys: [{ pts: ['_1', '_2', '_3', '_4'] }],
    segs: [lab('_1', '_2', a), lab('_4', '_3', b), lab('_1', '_4', h), ...(s ? [lab('_2', '_3', s)] : [])],
    angles: [rightAt('_1', '_2', '_4'), rightAt('_4', '_1', '_3')],
  };
}

/** A triangle with its corners on the grid's points: the drawing's words list them (no length is written). */
export const gridTriFig = (pts, grid) => ({
  type: 'geo', label: 'משולש על רשת משבצות', grid, pts: { _a: pts[0], _b: pts[1], _c: pts[2] }, polys: [{ pts: ['_a', '_b', '_c'] }],
});

// ---------------------------------------------------------------- the models' words (texts, solutions, hints)

/** area:1: the area or the perimeter of a rectangle. */
export const area1Text = ({ k, a, b }) => `מה ${k ? 'היקף' : 'שטח'} מלבן שאורכו $${a}$ ס״מ ורוחבו $${b}$ ס״מ?`;
export const area1Unit = ({ k }) => (k ? UNIT.cm : UNIT.cm2);
export const area1Fig = ({ a, b }) => rectFig(a, b);
export const area1Solution = ({ k, a, b }) => (k
  ? ['היקף: שני אורכים ושני רוחבים.', `$2 \\cdot (${a} + ${b}) = ${2 * (a + b)}$ ס״מ`]
  : ['שטח: אורך כפול רוחב.', `$${a} \\cdot ${b} = ${a * b}$ סמ״ר`]);
export const area1Hint = () => 'שטח: כמה משבצות בפנים. היקף: כמה צעדים מסביב.';
/** area:1 transfer: the fence round a garden. */
export const gardenText = ({ a, P }) => `סביב גינה מלבנית שאורכה $${a}$ מ׳ יש גדר באורך $${P}$ מ׳. מה רוחב הגינה?`;
export const gardenSolution = ({ a, b, P }) => [
  `בגדר יש שני אורכים ושני רוחבים, ולכן חצי ממנה הוא אורך אחד ועוד רוחב אחד: $${P} : 2 = ${P / 2}$.`,
  `הרוחב: $${P / 2} - ${a} = ${b}$ מ׳`,
];
export const gardenHint = () => 'בגדר יש שני אורכים ושני רוחבים. כמה הם אורך אחד ועוד רוחב אחד?';

/** area:2: a triangle with its base, the height to it and a slanted side. */
export const area2Text = ({ b, h, s }) => `במשולש $ABC$: $BC = ${b}$ ס״מ, הגובה לצלע $BC$ הוא $${h}$ ס״מ, ו־$AB = ${s}$ ס״מ. מה שטח המשולש?`;
export const area2Fig = (p) => heightFig(p);
export const area2Solution = ({ b, h, s, out }) => [
  `הגובה לצלע $BC$ הוא $${h}$${out ? ', והוא נופל מחוץ למשולש, על ההמשך של $BC$' : ''}. $AB = ${s}$ היא צלע משופעת, לא הגובה.`,
  `$\\frac{${b} \\cdot ${h}}{2} = ${(b * h) / 2}$ סמ״ר`,
];
export const area2Hint = () => 'הגובה ניצב לבסיס. איזה קטע בשרטוט ניצב ל־$BC$?';
/** area:2 transfer (CLASSROOM-13 T2): one leg and the area, the other leg in the class's form; `c` writes the hypotenuse too. */
export function area2TText({ a, S, at }, c) {
  const [l1, l2] = LEGS[at];
  return `במשולש $ABC$: $\\sphericalangle ${at} = 90^\\circ$, $${l1} = ${a}$ ס״מ, $${l2} = x$ ס״מ${c ? `, $${HYP[at]} = ${c}$ ס״מ` : ''}, ושטח המשולש $${S}$ סמ״ר. מה $x$?`;
}
export const area2TFig = ({ a, x, at }, c) => rightTriFig(at, a, x, { [LEGS[at][0]]: a, [LEGS[at][1]]: 'x', ...(c ? { [HYP[at]]: c } : {}) });
/** The class's solution lines: the givens, the formula with the legs at the square, and the equation with its slash marks. */
export function area2TSolution({ a, x, S, at }) {
  const [l1, l2] = LEGS[at];
  return [
    `נתון: $S_{\\triangle ABC} = ${S}$`,
    `$S_{\\triangle ABC} = \\frac{${l1} \\cdot ${l2}}{2}$: שני הניצבים יוצאים מהזווית הישרה.`,
    `$\\frac{${a}x}{2} = ${S} \\;/{\\cdot}2$`,
    `$${a}x = ${2 * S} \\;/{:}${a}$`,
    `$x = ${x}$ ס״מ`,
  ];
}
export const area2THint = ({ a }) => `הציבו בנוסחה: $\\frac{${a} \\cdot x}{2}$ הוא השטח. כדי לבטל את החלוקה ב־$2$, כופלים את שני האגפים ב־$2$.`;

/** area:3: an L, all four lengths given. */
export const area3Text = ({ W, H, w, h }) => `צורה בצורת $L$: מלבן $${W}$ על $${H}$ ס״מ שחסר בפינתו מלבן $${w}$ על $${h}$ ס״מ. מה השטח?`;
export const area3Fig = ({ W, H, w, h }) => lFig(W, H, w, h, { cut: true });
export const area3Solution = ({ W, H, w, h }) => [
  `המלבן השלם $${W} \\cdot ${H} = ${W * H}$, פחות הפינה $${w} \\cdot ${h} = ${w * h}$.`,
  `$${W * H} - ${w * h} = ${W * H - w * h}$ סמ״ר`,
];
export const area3Hint = () => 'השלימו למלבן, והורידו את הפינה.';
/** area:3 transfer: a plot with a triangle cut off a corner. */
export const plotText = ({ W, H, p, q }) => `חלקה בצורת מלבן $${W}$ על $${H}$ מ׳. בפינה אחת חתכו משולש ישר־זווית שניצביו $${p}$ ו־$${q}$ מ׳. מה השטח שנשאר?`;
export const plotFigOf = ({ W, H, p, q }) => plotFig(W, H, p, q);
export const plotSolution = ({ W, H, p, q }) => [
  `המלבן השלם: $${W} \\cdot ${H} = ${W * H}$.`,
  `המשולש: $\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}$.`,
  `$${W * H} - ${(p * q) / 2} = ${W * H - (p * q) / 2}$ מ״ר`,
];
export const plotHint = () => 'חשבו את המלבן כולו, והורידו את המשולש: הוא חצי ממלבן שצלעותיו הן הניצבים.';

/** area:4: a right trapezoid, its slanted leg written too. */
export const area4Text = ({ a, b, h, s }) => `בטרפז ישר־זווית הבסיסים $${a}$ ס״מ ו־$${b}$ ס״מ, הגובה $${h}$ ס״מ, והשוק המשופעת $${s}$ ס״מ. מה השטח?`;
export const area4Fig = ({ a, b, h, s }) => rightTrapFig(a, b, h, s);
export const area4Solution = ({ a, b, h, s }) => [
  `הגובה הוא $${h}$: השוק המשופעת, $${s}$, אינה ניצבת לבסיסים.`,
  `סכום הבסיסים: $${a} + ${b} = ${a + b}$.`,
  `$\\frac{${a + b} \\cdot ${h}}{2} = ${((a + b) * h) / 2}$ סמ״ר`,
];
export const area4Hint = () => 'סכום הבסיסים, כפול הגובה, חלקי $2$. הגובה ניצב לבסיסים.';
/** area:4 transfer: a plot in the shape of a parallelogram. */
export const paraPlotText = ({ a, h, s }) => `חלקת קרקע בצורת מקבילית: צלע $${a}$ מ׳, הגובה אליה $${h}$ מ׳, והצלע השנייה $${s}$ מ׳. מה שטחה?`;
export const paraPlotFig = (p) => paraFig(p);
export const paraPlotSolution = ({ a, h, s }) => [`הגובה לצלע הוא $${h}$. הצלע השנייה, $${s}$, משופעת.`, `$${a} \\cdot ${h} = ${a * h}$ מ״ר`];
export const paraPlotHint = () => 'שטח מקבילית: צלע כפול הגובה אליה, בלי חלוקה ב־$2$.';

/** area:5: the perimeter of an L, two of its sides not written. */
export const area5Text = ({ W, H, w, h }) => `צורה בצורת $L$: מלבן $${W}$ על $${H}$ ס״מ שחסר בפינתו מלבן $${w}$ על $${h}$ ס״מ. מה היקף הצורה?`;
export const area5Fig = ({ W, H, w, h }) => lFig(W, H, w, h);
export const area5Solution = ({ W, H, w, h }) => [
  `הצלע העליונה: $${W} - ${w} = ${W - w}$. הצלע הימנית: $${H} - ${h} = ${H - h}$.`,
  `$${W} + ${H} + ${W - w} + ${h} + ${w} + ${H - h} = ${2 * (W + H)}$ ס״מ`,
];
export const area5Hint = () => 'גם לצלעות שאין עליהן מספר יש אורך: מצאו אותן מהצלעות שמולן.';
/** area:5 transfer: the frame of a notice board, metres and centimetres. */
export const boardText = ({ a, b }) => `לוח מודעות מלבני: $${num(a)}$ מ׳ על $${b}$ ס״מ. כמה ס״מ פס עץ צריך למסגרת סביב כל הלוח?`;
export const boardSolution = ({ a, b }) => [`$${num(a)}$ מ׳ הם $${num(100 * a)}$ ס״מ.`, `$2 \\cdot (${num(100 * a)} + ${b}) = ${num(2 * (100 * a + b))}$ ס״מ`];
export const boardHint = () => 'העבירו קודם את שני האורכים לאותה יחידה, ס״מ.';

// ---------------------------------------------------------------- area:1 — the rectangle

/** The area or the perimeter of a rectangle (the model's own draw). */
function ar1r() {
  const p = draw(() => { const q = AREA1.params(rnd); return { ...q, answer: AREA1.answer(q), printed: [q.a, q.b] }; });
  return {
    key: `ar1r:${p.k}:${p.a}:${p.b}`, text: area1Text(p), form: 'num', answer: p.answer, unit: area1Unit(p), fig: area1Fig(p),
    hint: area1Hint(p), solution: area1Solution(p), diag: diagList(p.answer, bugsAt(AREA1, p)),
  };
}

/** The width from the area (k 0) or from the perimeter (k 1) and the length. */
function ar1m() {
  const p = draw(() => {
    const k = rint(rnd, 0, 1); const a = rint(rnd, 3, 12); const b = rint(rnd, 2, 12); if (b >= a) return null; // the width is the shorter side
    const X = k ? 2 * (a + b) : a * b;
    // the area case names nothing: S − a or S/2 − a have no honest name of their own
    return { k, a, b, X, answer: b, printed: [X, a], bugs: k ? [['one-side-perim', X - a], ['perim-as-area', X / a]] : [] };
  });
  const { k, a, b, X } = p;
  return {
    key: `ar1m:${k}:${a}:${X}`, form: 'num', answer: b, unit: UNIT.cm,
    text: k ? `היקף מלבן $${X}$ ס״מ, ואורכו $${a}$ ס״מ. מה רוחבו?` : `שטח מלבן $${X}$ סמ״ר, ואורכו $${a}$ ס״מ. מה רוחבו?`,
    hint: k ? 'בהיקף יש שני אורכים ושני רוחבים: חצי ההיקף הוא אורך אחד ועוד רוחב אחד.' : 'אורך כפול רוחב הוא השטח. במה כופלים את האורך כדי לקבל את השטח?',
    solution: k
      ? [`חצי היקף הוא אורך ועוד רוחב: $${X} : 2 = ${X / 2}$.`, `הרוחב: $${X / 2} - ${a} = ${b}$ ס״מ`]
      : [`$${a} \\cdot \\square = ${X}$, ולכן מחלקים.`, `הרוחב: $${X} : ${a} = ${b}$ ס״מ`],
    diag: diagList(b, p.bugs),
  };
}

/** A square: its area or perimeter from the side, or the side from either. */
function ar1s() {
  const p = draw(() => {
    const s = rint(rnd, 2, 12); const k = rint(rnd, 0, 3);
    return [
      { k, s, answer: s * s, printed: [s], bugs: [['perimeter', 4 * s]] },
      { k, s, answer: 4 * s, printed: [s], bugs: [['area-for-perim', s * s]] },
      { k, s, answer: s, printed: [s * s] },
      { k, s, answer: s, printed: [4 * s] },
    ][k];
  });
  const { k, s } = p;
  const text = [
    `מה שטח ריבוע שצלעו $${s}$ ס״מ?`, `מה היקף ריבוע שצלעו $${s}$ ס״מ?`,
    `שטח ריבוע $${s * s}$ סמ״ר. מה אורך צלעו?`, `היקף ריבוע $${4 * s}$ ס״מ. מה אורך צלעו?`,
  ][k];
  const solution = [
    ['בריבוע האורך והרוחב שווים: צלע כפול צלע.', `$${s} \\cdot ${s} = ${s * s}$ סמ״ר`],
    ['לריבוע ארבע צלעות שוות.', `$4 \\cdot ${s} = ${4 * s}$ ס״מ`],
    [`מחפשים מספר שכפול עצמו נותן $${s * s}$.`, `$${s} \\cdot ${s} = ${s * s}$, ולכן הצלע $${s}$ ס״מ`],
    ['ארבע צלעות שוות: מחלקים את ההיקף ב־$4$.', `$${4 * s} : 4 = ${s}$ ס״מ`],
  ][k];
  return {
    key: `ar1s:${k}:${s}`, text, form: 'num', answer: p.answer, unit: k === 0 ? UNIT.cm2 : UNIT.cm,
    hint: k === 0 || k === 2 ? 'שטח ריבוע: צלע כפול צלע.' : 'היקף ריבוע: ארבע צלעות שוות.',
    solution, diag: diagList(p.answer, p.bugs || []),
  };
}

/** Which unit measures an area, which a length: a unit of the other kind is unit-mix. Three choices: practice only. */
const UNIT_QUESTIONS = [
  { text: 'באיזו יחידה מודדים את השטח של רצפת חדר?', right: 'מ״ר', mix: 'מ׳', other: 'סמ״ק' },
  { text: 'באיזו יחידה מודדים את האורך של גדר סביב גינה?', right: 'מ׳', mix: 'מ״ר', other: 'ליטר' },
  { text: 'באיזו יחידה מודדים את השטח של דף במחברת?', right: 'סמ״ר', mix: 'ס״מ', other: 'ליטר' },
  { text: 'באיזו יחידה מודדים את ההיקף של תמונה?', right: 'ס״מ', mix: 'סמ״ר', other: 'סמ״ק' },
];
function ar1u() {
  const k = rint(rnd, 0, UNIT_QUESTIONS.length - 1); const q = UNIT_QUESTIONS[k]; const area = k % 2 === 0;
  const choices = shuffle([{ text: q.right, ok: true }, { text: q.mix, ok: false, bug: 'unit-mix' }, { text: q.other, ok: false }]);
  return {
    key: `ar1u:${k}`, text: q.text, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'שטח מודדים בריבועים: סמ״ר או מ״ר. אורך מודדים בס״מ או במ׳.',
    solution: [area ? `שטח נמדד ביחידות ריבועיות: ${q.right}.` : `זה אורך, והוא נמדד ביחידות אורך: ${q.right}.`, 'סמ״ק וליטר מודדים נפח, כמה נכנס בתוך כלי.'],
    diag: (u) => choices[u]?.bug || null,
  };
}

/** Build a rectangle with a given area and perimeter on the grid (the target is named): practice only. */
function ar1b() {
  const w = rint(rnd, 2, 10); const h = rint(rnd, 2, 8); const S = w * h; const P = 2 * (w + h);
  const [long, short] = w >= h ? [w, h] : [h, w];
  return {
    key: `ar1b:${S}:${P}`, text: `בנו מלבן ששטחו $${S}$ משבצות והיקפו $${P}$.`, form: 'manip', practiceOnly: true,
    manip: { kind: 'polygon', grid: [10, 8], task: 'rect', start: { w: 1, h: 1 } }, answer: { mode: 'rect', area: S, perim: P },
    hint: `אורך ועוד רוחב הם חצי מההיקף, $${P / 2}$. אילו שני מספרים כאלה נותנים במכפלה $${S}$?`,
    solution: [`מלבן $${long}$ על $${short}$: $${long} \\cdot ${short} = ${S}$ משבצות, ו־$2 \\cdot (${long} + ${short}) = ${P}$.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- area:2 — the triangle (CLASSROOM-13 inside)

const VERTICES = ['C', 'B', 'A'];
/** T0: the two legs, the right angle at C, B or A; the formula names the sides at the square. */
function ar2l() {
  const p = draw(() => {
    const a = rint(rnd, 3, 16); const b = rint(rnd, 3, 16); if ((a * b) % 2 || a === b) return null;
    return { a, b, at: pick(rnd, VERTICES), answer: (a * b) / 2, printed: [a, b, 90], bugs: [['no-half', a * b], ['add-sides', a + b]] };
  });
  const { a, b, at } = p; const [l1, l2] = LEGS[at];
  return {
    key: `ar2l:${a}:${b}:${at}`, form: 'num', answer: p.answer, unit: UNIT.cm2,
    text: `במשולש $ABC$: $\\sphericalangle ${at} = 90^\\circ$, $${l1} = ${a}$ ס״מ ו־$${l2} = ${b}$ ס״מ. מה שטח המשולש?`,
    fig: rightTriFig(at, a, b, { [l1]: a, [l2]: b }),
    hint: 'במשולש ישר־זווית ניצב אחד הוא הגובה לניצב השני. ניצב כפול ניצב, חלקי $2$.',
    solution: [`$S_{\\triangle ABC} = \\frac{${l1} \\cdot ${l2}}{2}$: שני הניצבים יוצאים מהזווית הישרה.`, `$\\frac{${a} \\cdot ${b}}{2} = ${p.answer}$ סמ״ר`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** T1: a triple, the hypotenuse written and drawn too (up to 34, so CLASSROOM-13's 16, 30, 34 can come up). */
function ar2t() {
  const p = draw(() => {
    const [a, b, c] = tri(rnd, T34);
    return { a, b, c, at: pick(rnd, VERTICES), answer: (a * b) / 2, printed: [a, b, c, 90], bugs: [['no-half', a * b], ['hyp-as-height', (c * a) / 2], ['hyp-as-height', (c * b) / 2]] };
  });
  const { a, b, c, at } = p; const [l1, l2] = LEGS[at];
  return {
    key: `ar2t:${a}:${b}:${c}:${at}`, form: 'num', answer: p.answer, unit: UNIT.cm2,
    text: `במשולש $ABC$: $\\sphericalangle ${at} = 90^\\circ$, $${l1} = ${a}$ ס״מ, $${l2} = ${b}$ ס״מ ו־$${HYP[at]} = ${c}$ ס״מ. מה שטח המשולש?`,
    fig: rightTriFig(at, a, b, { [l1]: a, [l2]: b, [HYP[at]]: c }),
    hint: 'אילו שתי צלעות יוצאות מהזווית הישרה? הן הצלע והגובה אליה.',
    solution: [
      `$S_{\\triangle ABC} = \\frac{${l1} \\cdot ${l2}}{2}$: שני הניצבים יוצאים מהזווית הישרה. היתר, $${HYP[at]} = ${c}$, אינו גובה לאף צלע כאן.`,
      `$\\frac{${a} \\cdot ${b}}{2} = ${p.answer}$ סמ״ר`,
    ],
    diag: diagList(p.answer, p.bugs),
  };
}

/** T2, the class's: a leg from the other leg and the area (the transfer model's draw); a triple's hypotenuse is written. */
function ar2x() {
  const p = draw(() => {
    const q = AREA2T.params(rnd); const r = Math.sqrt(q.a * q.a + q.x * q.x); const c = Number.isInteger(r) ? r : 0;
    return { ...q, c, answer: q.x, printed: [q.a, q.S, 90, ...(c ? [c] : [])], bugs: [...bugsAt(AREA2T, q), ...(c ? [['hyp-as-height', (2 * q.S) / c]] : [])] };
  });
  return {
    key: `ar2x:${p.a}:${p.S}:${p.c}:${p.at}`, form: 'num', answer: p.x, unit: UNIT.cm,
    text: area2TText(p, p.c), fig: area2TFig(p, p.c), hint: area2THint(p), solution: area2TSolution(p), diag: diagList(p.x, p.bugs),
  };
}

/** Any triangle: base, height (inside or outside), a slanted side (the diagnostic model's draw). */
function ar2g() {
  const p = draw(() => { const q = AREA2.params(rnd); return { ...q, answer: AREA2.answer(q), printed: [q.b, q.h, q.s] }; });
  return {
    key: `ar2g:${p.b}:${p.h}:${p.s}:${p.out}`, text: area2Text(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: area2Fig(p),
    hint: area2Hint(p), solution: area2Solution(p), diag: diagList(p.answer, bugsAt(AREA2, p)),
  };
}

/**
 * A triangle on the grid with a horizontal base b (2..10) and height h (2..8): its top vertex anywhere, above the base
 * or past either end (t is its place from the base's left end). The lengths are counted; the drawing's words list the
 * corners.
 */
function ar2q() {
  const p = draw(() => {
    const b = rint(rnd, 2, 10); const h = rint(rnd, 2, 8); if ((b * h) % 2) return null;
    const t = rint(rnd, -3, b + 3); const lo = Math.min(0, t); const hi = Math.max(b, t); if (hi - lo > 10) return null;
    return { b, h, t, lo, hi, answer: (b * h) / 2, printed: [1], bugs: [['no-half', b * h]] };
  });
  const { b, h, t, lo, hi } = p; const x0 = 1 - lo; // one free column on each side
  const inside = t > 0 && t < b;
  return {
    key: `ar2q:${b}:${h}:${t}`, text: 'כל משבצת היא $1$ סמ״ר. מה שטח המשולש?', form: 'num', answer: p.answer, unit: UNIT.cm2,
    fig: gridTriFig([[x0, 0], [x0 + b, 0], [x0 + t, h]], [0, 0, hi - lo + 2, h + 1]),
    hint: 'הבסיס שוכב על קו של הרשת. כמה משבצות אורכו, וכמה משבצות הגובה אליו?',
    solution: [
      `הבסיס: $${b}$ משבצות. הגובה, מהקודקוד העליון אל הישר של הבסיס: $${h}$ משבצות${inside ? '' : ', והוא נופל מחוץ לבסיס'}.`,
      `$\\frac{${b} \\cdot ${h}}{2} = ${p.answer}$ סמ״ר`,
    ],
    diag: diagList(p.answer, p.bugs),
  };
}

/**
 * Which segment from A is the height to BC, in an obtuse triangle: the perpendicular to BC's extension (outside), the
 * segment to BC's midpoint, or a slanted segment inside (inside-height). Letters D, E, F are dealt at random; the
 * choices are listed in letter order. Three choices: practice only.
 */
function ar2w() {
  const b = rint(rnd, 6, 10); const d = rint(rnd, 2, 4); const h = rint(rnd, 3, 5);
  const [P, Mi, I] = shuffle(['D', 'E', 'F']);
  const ix = r9(b * 0.22); // between B and the mark on BC's first half: no letter or mark on top of another
  const choices = ['D', 'E', 'F'].map((L) => ({ tex: `A${L}`, ok: L === P, ...(L === I ? { bug: 'inside-height' } : {}) }));
  return {
    key: `ar2w:${b}:${d}:${h}:${P}${Mi}${I}`, text: 'איזה קטע הוא הגובה לצלע $BC$?', form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    fig: {
      type: 'geo', label: 'משולש קהה־זווית ושלושה קטעים מהקודקוד A',
      pts: { B: [0, 0], C: [b, 0], A: [-d, h], [P]: [-d, 0], [Mi]: [b / 2, 0], [I]: [ix, 0] },
      polys: [{ pts: ['A', 'B', 'C'] }],
      segs: [{ a: P, b: 'B', dash: true }, { a: 'A', b: P, dash: true }, { a: 'A', b: Mi, dash: true }, { a: 'A', b: I, dash: true }, { a: 'B', b: Mi, ticks: 1, t: 0.72 }, { a: Mi, b: 'C', ticks: 1 }],
      dots: [P, Mi, I],
    },
    hint: 'גובה לצלע יוצא מהקודקוד שמולה, וניצב לישר שעליו הצלע. הוא יכול ליפול מחוץ למשולש.',
    solution: [`$A${P}$ ניצב להמשך של $BC$: זה הגובה לצלע $BC$.`, `הוא נופל מחוץ למשולש, כי הזווית $B$ קהה. $A${Mi}$ הולך לאמצע $BC$, ו־$A${I}$ משופע.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- area:3 — composite shapes

/** An L, all four lengths given (the diagnostic model's draw). */
function ar3l() {
  const p = draw(() => { const q = AREA3.params(rnd); return { ...q, answer: AREA3.answer(q), printed: [q.W, q.H, q.w, q.h] }; });
  return {
    key: `ar3l:${p.W}:${p.H}:${p.w}:${p.h}`, text: area3Text(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: area3Fig(p),
    hint: area3Hint(p), solution: area3Solution(p), diag: diagList(p.answer, bugsAt(AREA3, p)),
  };
}

/** A plot with a right-triangle corner cut off (the transfer model's draw). */
function ar3t() {
  const p = draw(() => { const q = AREA3T.params(rnd); return { ...q, answer: AREA3T.answer(q), printed: [q.W, q.H, q.p, q.q] }; });
  return {
    key: `ar3t:${p.W}:${p.H}:${p.p}:${p.q}`, text: plotText(p), form: 'num', answer: p.answer, unit: UNIT.m2, fig: plotFigOf(p),
    hint: plotHint(p), solution: plotSolution(p), diag: diagList(p.answer, bugsAt(AREA3T, p)),
  };
}

/** A kite or a rhombus from its perpendicular diagonals: half their product. */
function ar3k() {
  const p = draw(() => {
    const d1 = rint(rnd, 4, 16); const d2 = rint(rnd, 3, 14); if ((d1 * d2) % 2 || d1 === d2) return null;
    if (Math.max(d1, d2) > 3 * Math.min(d1, d2)) return null; // a 16 by 3 kite is a sliver: no room for its numbers
    return { d1, d2, kite: rint(rnd, 0, 1), answer: (d1 * d2) / 2, printed: [d1, d2], bugs: [['diag-no-half', d1 * d2]] };
  });
  const { d1, d2, kite } = p;
  return {
    key: `ar3k:${d1}:${d2}:${kite}`, form: 'num', answer: p.answer, unit: UNIT.cm2,
    text: `האלכסונים של המרובע מאונכים זה לזה, ואורכם $${d1}$ ס״מ ו־$${d2}$ ס״מ. מה שטחו?`,
    fig: diagonalsFig(d1, d2, !!kite),
    hint: 'המרובע הוא חצי מהמלבן שצלעותיו באורך האלכסונים.',
    solution: ['האלכסונים מאונכים: השטח הוא חצי ממכפלת האלכסונים.', `$\\frac{${d1} \\cdot ${d2}}{2} = ${p.answer}$ סמ״ר`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** Tiles: a floor a by b metres in square tiles of t cm (every count whole). */
function ar3u() {
  const p = draw(() => {
    const a = rint(rnd, 2, 6); const b = rint(rnd, 2, 5); const t = pick(rnd, [20, 25, 40, 50]);
    if (a === b || (100 * a) % t || (100 * b) % t) return null;
    return { a, b, t, answer: ((100 * a) / t) * ((100 * b) / t), printed: [a, b, t], bugs: [['div-by-side', (100 * a * b) / t]] };
  });
  const { a, b, t } = p; const na = (100 * a) / t; const nb = (100 * b) / t;
  return {
    key: `ar3u:${a}:${b}:${t}`, form: 'num', answer: p.answer, unit: UNIT.tiles,
    text: `רצפה מלבנית $${a}$ מ׳ על $${b}$ מ׳ מרצפים באריחים ריבועיים שצלעם $${t}$ ס״מ. כמה אריחים צריך?`,
    hint: 'העבירו קודם את המידות לס״מ. כמה אריחים נכנסים לאורך, וכמה לרוחב?',
    solution: [
      `לאורך: $${a}$ מ׳ הם $${100 * a}$ ס״מ, ו־$${100 * a} : ${t} = ${na}$ אריחים.`,
      `לרוחב: $${b}$ מ׳ הם $${100 * b}$ ס״מ, ו־$${100 * b} : ${t} = ${nb}$ אריחים.`,
      `$${na} \\cdot ${nb} = ${p.answer}$ אריחים`,
    ],
    diag: diagList(p.answer, p.bugs),
  };
}

/**
 * A triangle on an 8 by 6 grid with no side on a grid line: one corner on a corner of the box around it, the other two
 * on the box's two far sides, so the box less three right triangles is the area (the answer may end in .5).
 */
function ar3g() {
  const p = draw(() => {
    const pts = [[rint(rnd, 0, 8), rint(rnd, 0, 6)], [rint(rnd, 0, 8), rint(rnd, 0, 6)], [rint(rnd, 0, 8), rint(rnd, 0, 6)]];
    const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const ext = (q) => [q[0] === x0, q[0] === x1, q[1] === y0, q[1] === y1].filter(Boolean).length;
    const counts = pts.map(ext);
    if (counts.filter((c) => c === 2).length !== 1 || counts.filter((c) => c === 1).length !== 2) return null;
    const A = Math.abs(pts[0][0] * (pts[1][1] - pts[2][1]) + pts[1][0] * (pts[2][1] - pts[0][1]) + pts[2][0] * (pts[0][1] - pts[1][1])) / 2;
    if (A < 3) return null;
    const box = (x1 - x0) * (y1 - y0);
    const corner = pts[counts.indexOf(2)];
    // the corner first, then the other two round the triangle
    const [P, Q, R] = [corner, ...pts.filter((q) => q !== corner)];
    const legs = [[P, Q], [Q, R], [R, P]].map(([u, v]) => (Math.abs(u[0] - v[0]) * Math.abs(u[1] - v[1])) / 2);
    return { pts, box, w: x1 - x0, h: y1 - y0, legs, answer: A, printed: [1], bugs: [['no-subtract', box]] };
  });
  const { pts, box, w, h, legs } = p;
  return {
    key: `ar3g:${pts.flat().join(':')}`, text: 'כל משבצת היא $1$ סמ״ר. מה שטח המשולש?', form: 'num', answer: p.answer, unit: UNIT.cm2,
    fig: gridTriFig(pts, [0, 0, 8, 6]),
    hint: 'אף צלע אינה על קו של הרשת. השלימו למלבן שסביב המשולש, והורידו את מה שמחוץ למשולש.',
    solution: [
      `המלבן שסביב המשולש: $${w} \\cdot ${h} = ${box}$.`,
      `מסביב למשולש שלושה משולשים ישרי־זווית: $${legs.map(num).join(' + ')} = ${num(legs[0] + legs[1] + legs[2])}$.`,
      `$${box} - ${num(legs[0] + legs[1] + legs[2])} = ${num(p.answer)}$ סמ״ר`,
    ],
    diag: diagList(p.answer, p.bugs),
  };
}

/**
 * Which computation gives an L's area: cut across (the full-width strip and the block above it) or along (the
 * full-height block and the strip beside it), against the two overlapping parts (double-count) and one part alone.
 * Three choices: practice only.
 */
function ar3m() {
  const W = rint(rnd, 6, 12); const H = rint(rnd, 5, 8); const w = rint(rnd, 2, W - 2); const h = rint(rnd, 2, H - 2); const form = rint(rnd, 0, 1);
  const right = form ? `${W - w} \\cdot ${H} + ${w} \\cdot ${H - h}` : `${W} \\cdot ${H - h} + ${W - w} \\cdot ${h}`;
  const choices = shuffle([
    { tex: right, ok: true },
    { tex: `${W} \\cdot ${H - h} + ${W - w} \\cdot ${H}`, ok: false, bug: 'double-count' },
    { tex: form ? `${W - w} \\cdot ${H}` : `${W} \\cdot ${H - h}`, ok: false },
  ]);
  return {
    key: `ar3m:${W}:${H}:${w}:${h}:${form}`, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    text: `צורה בצורת $L$: מלבן $${W}$ על $${H}$ ס״מ שחסר בפינתו מלבן $${w}$ על $${h}$ ס״מ. איזה חישוב נותן את שטח הצורה?`,
    fig: lFig(W, H, w, h),
    hint: 'כל משבצת נספרת פעם אחת: החלקים לא חופפים, ואף חלק לא חסר.',
    solution: form
      ? [`חותכים לאורך, בקו של הפינה החסרה: מלבן $${W - w} \\cdot ${H}$ משמאל, ומלבן $${w} \\cdot ${H - h}$ מימין.`, `$${W - w} \\cdot ${H} + ${w} \\cdot ${H - h} = ${W * H - w * h}$`]
      : [`חותכים לרוחב, בגובה של הפינה החסרה: מלבן $${W} \\cdot ${H - h}$ למטה, ומלבן $${W - w} \\cdot ${h}$ מעליו.`, `$${W} \\cdot ${H - h} + ${W - w} \\cdot ${h} = ${W * H - w * h}$`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- area:4 — the parallelogram and the trapezoid

/** A parallelogram ABCD: a side, the height to it and the slanted side (the transfer model's draw). */
function ar4p() {
  const p = draw(() => { const q = AREA4T.params(rnd); return { ...q, answer: AREA4T.answer(q), printed: [q.a, q.h, q.s] }; });
  const { a, h, s } = p;
  return {
    key: `ar4p:${a}:${h}:${s}`, form: 'num', answer: p.answer, unit: UNIT.cm2, fig: paraFig(p),
    text: `במקבילית $ABCD$: $AB = ${a}$ ס״מ, הגובה לצלע $AB$ הוא $${h}$ ס״מ, ו־$AD = ${s}$ ס״מ. מה שטחה?`,
    hint: 'שטח מקבילית: צלע כפול הגובה אליה. איזה קטע ניצב ל־$AB$?',
    solution: [`הגובה לצלע $AB$ הוא $${h}$. $AD = ${s}$ היא צלע משופעת, לא הגובה.`, `$${a} \\cdot ${h} = ${p.answer}$ סמ״ר`],
    diag: diagList(p.answer, bugsAt(AREA4T, p)),
  };
}

/** A right trapezoid: bases, height and the slanted leg (the diagnostic model's draw). */
function ar4t() {
  const p = draw(() => { const q = AREA4.params(rnd); return { ...q, answer: AREA4.answer(q), printed: [q.a, q.b, q.h, q.s] }; });
  return {
    key: `ar4t:${p.a}:${p.b}:${p.h}:${p.s}`, text: area4Text(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: area4Fig(p),
    hint: area4Hint(p), solution: area4Solution(p), diag: diagList(p.answer, bugsAt(AREA4, p)),
  };
}

/** The height from the area: a parallelogram (k 0) or a trapezoid (k 1). */
function ar4i() {
  const p = draw(() => {
    if (rnd() < 0.5) {
      const a = rint(rnd, 3, 15); const h = rint(rnd, 2, 12); if (a === h) return null;
      return { k: 0, a, h, S: a * h, answer: h, printed: [a * h, a], bugs: [['half-para', (2 * a * h) / a]] };
    }
    const a = rint(rnd, 5, 15); const b = rint(rnd, 2, a - 2); const h = rint(rnd, 2, 12); if (((a + b) * h) % 2) return null;
    const S = ((a + b) * h) / 2;
    return { k: 1, a, b, h, S, answer: h, printed: [S, a, b], bugs: [['no-half', S / (a + b)]] };
  });
  const { k, a, b, h, S } = p;
  return k === 0
    ? {
      key: `ar4i:0:${S}:${a}`, form: 'num', answer: h, unit: UNIT.cm,
      text: `שטח מקבילית $${S}$ סמ״ר, ואחת מצלעותיה $${a}$ ס״מ. מה הגובה לצלע הזאת?`,
      hint: `שטח מקבילית הוא צלע כפול הגובה אליה. במה כופלים את $${a}$ כדי לקבל את השטח?`,
      solution: [`$${a} \\cdot h = ${S}$`, `$h = ${S} : ${a} = ${h}$ ס״מ`],
      diag: diagList(h, p.bugs),
    }
    : {
      key: `ar4i:1:${S}:${a}:${b}`, form: 'num', answer: h, unit: UNIT.cm,
      text: `שטח טרפז $${S}$ סמ״ר, ובסיסיו $${a}$ ס״מ ו־$${b}$ ס״מ. מה גובהו?`,
      hint: 'הציבו בנוסחה: סכום הבסיסים כפול הגובה, חלקי $2$, הוא השטח.',
      solution: [`$\\frac{(${a} + ${b}) \\cdot h}{2} = ${S} \\;/{\\cdot}2$`, `$${a + b}h = ${2 * S} \\;/{:}${a + b}$`, `$h = ${h}$ ס״מ`],
      diag: diagList(h, p.bugs),
    };
}

/** Move the triangle from one side of a parallelogram to the other until it is a rectangle (the target is named): practice only. */
function ar4c() {
  const w = rint(rnd, 3, 6); const o = rint(rnd, 1, Math.min(3, w - 1)); const h = rint(rnd, 2, 4); const x0 = 1; const y0 = 1;
  return {
    key: `ar4c:${w}:${o}:${h}`, text: 'גררו את המשולש מצד אחד של המקבילית לצד השני, כך שיתקבל מלבן.', form: 'manip', practiceOnly: true,
    manip: {
      kind: 'polygon', grid: [10, 6], task: 'move',
      shape: [[x0 + o, y0], [x0 + w, y0], [x0 + w + o, y0 + h], [x0 + o, y0 + h]],
      piece: { pts: [[x0, y0], [x0 + o, y0], [x0 + o, y0 + h]], name: 'המשולש' },
      start: { dx: 0, dy: 0 },
    },
    answer: { mode: 'move', dx: w, dy: 0 },
    hint: 'החור נסגר כשהמשולש זז בדיוק אורך של צלע.',
    solution: [`המשולש זז $${w}$ משבצות ימינה, ומתקבל מלבן $${w}$ על $${h}$: $${w} \\cdot ${h} = ${w * h}$ משבצות, כמו המקבילית.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- area:5 — perimeters

/** The perimeter of an L, two sides not written (the diagnostic model's draw). */
function ar5l() {
  const p = draw(() => { const q = AREA5.params(rnd); return { ...q, answer: AREA5.answer(q), printed: [q.W, q.H, q.w, q.h] }; });
  return {
    key: `ar5l:${p.W}:${p.H}:${p.w}:${p.h}`, text: area5Text(p), form: 'num', answer: p.answer, unit: UNIT.cm, fig: area5Fig(p),
    hint: area5Hint(p), solution: area5Solution(p), diag: diagList(p.answer, bugsAt(AREA5, p)),
  };
}

/** A perimeter with a hypotenuse in it: a right triangle from its legs (k 0), or a right trapezoid from its bases and height (k 1). */
function ar5p() {
  const p = draw(() => {
    if (rnd() < 0.5) {
      const [a, b, c] = tri(rnd, T30);
      return { k: 0, a, b, c, answer: a + b + c, printed: [a, b], bugs: [['missing-sides', a + b], ['add-legs', 2 * (a + b)]] };
    }
    const [h, d, s] = pick(rnd, HDS); const b = rint(rnd, 3, 12); const a = b + d;
    return { k: 1, a, b, h, d, s, answer: a + b + h + s, printed: [a, b, h], bugs: [['missing-sides', a + b + h], ['add-legs', a + b + h + d + h]] };
  });
  const hint = 'לצלע שאין עליה מספר יש אורך: היא יתר, ומוצאים אותה בפיתגורס. רק אחר כך מחברים.';
  if (p.k === 0) {
    const { a, b, c } = p;
    return {
      key: `ar5p:0:${a}:${b}`, form: 'num', answer: p.answer, unit: UNIT.cm, fig: legsFig(a, b),
      text: `מה היקף משולש ישר־זווית שניצביו $${a}$ ס״מ ו־$${b}$ ס״מ?`, hint,
      solution: [`היתר: $\\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}$.`, `$${a} + ${b} + ${c} = ${p.answer}$ ס״מ`],
      diag: diagList(p.answer, p.bugs),
    };
  }
  const { a, b, h, d, s } = p;
  return {
    key: `ar5p:1:${a}:${b}:${h}`, form: 'num', answer: p.answer, unit: UNIT.cm, fig: rightTrapFig(a, b, h),
    text: `בטרפז ישר־זווית הבסיסים $${a}$ ס״מ ו־$${b}$ ס״מ, והגובה $${h}$ ס״מ. מה היקף הטרפז?`, hint,
    solution: [
      `השוק המשופעת היא יתר במשולש ישר־זווית שניצביו $${a} - ${b} = ${d}$ ו־$${h}$: $\\sqrt{${d}^2 + ${h}^2} = ${s}$.`,
      `$${a} + ${b} + ${h} + ${s} = ${p.answer}$ ס״מ`,
    ],
    diag: diagList(p.answer, p.bugs),
  };
}

/** The frame of a notice board, metres and centimetres (the transfer model's draw). */
function ar5u() {
  const p = draw(() => { const q = AREA5T.params(rnd); return { ...q, answer: AREA5T.answer(q), printed: [q.a, q.b] }; });
  return {
    key: `ar5u:${num(p.a)}:${p.b}`, text: boardText(p), form: 'num', answer: p.answer, unit: UNIT.cm,
    hint: boardHint(p), solution: boardSolution(p), diag: diagList(p.answer, bugsAt(AREA5T, p)),
  };
}

/** The largest area of a rectangle with perimeter P (a multiple of 4, 12..48): the square. */
function ar5x() {
  const p = draw(() => { const P = 4 * rint(rnd, 3, 12); return { P, answer: (P / 4) ** 2, printed: [P] }; });
  const { P } = p; const q = P / 4;
  return {
    key: `ar5x:${P}`, text: `מה השטח הגדול ביותר של מלבן שהיקפו $${P}$ ס״מ?`, form: 'num', answer: p.answer, unit: UNIT.cm2,
    hint: 'באותו היקף, ככל שהמלבן קרוב יותר לריבוע, השטח שלו גדול יותר.',
    solution: [`אורך ועוד רוחב הם חצי מההיקף: $${P} : 2 = ${P / 2}$.`, `המכפלה הכי גדולה כשהשניים שווים, בריבוע: $${q} \\cdot ${q} = ${p.answer}$ סמ״ר`],
    diag: () => null,
  };
}

/** Two rectangles with one perimeter: which has the larger area? "The same" is same-perim-same-area. Three choices: practice only. */
function ar5c() {
  for (;;) {
    const half = rint(rnd, 6, 12);
    const w1 = rint(rnd, Math.ceil(half / 2), half - 1); const w2 = rint(rnd, Math.ceil(half / 2), half - 1);
    if (w1 === w2) continue;
    const h1 = half - w1; const h2 = half - w2; const A1 = w1 * h1; const A2 = w2 * h2;
    const choices = [{ text: 'לראשון' }, { text: 'לשני' }, { text: 'השטחים שווים', bug: 'same-perim-same-area' }];
    return {
      key: `ar5c:${w1}:${h1}:${w2}:${h2}`, form: 'mc', choices, answer: A1 > A2 ? 0 : 1, practiceOnly: true,
      text: `למלבן הראשון צלעות $${w1}$ ס״מ ו־$${h1}$ ס״מ, ולמלבן השני צלעות $${w2}$ ס״מ ו־$${h2}$ ס״מ. לשניהם אותו היקף. למי מהם שטח גדול יותר?`,
      hint: 'חשבו את השטח של כל אחד מהם. אותו היקף לא אומר אותו שטח.',
      solution: [
        `ההיקף של שניהם: $2 \\cdot (${w1} + ${h1}) = ${2 * half}$.`,
        `השטחים: $${w1} \\cdot ${h1} = ${A1}$ ו־$${w2} \\cdot ${h2} = ${A2}$.`,
        'אותו היקף, ושטח אחר: למלבן שקרוב יותר לריבוע יש שטח גדול יותר.',
      ],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

/** Build the rectangle with the largest area for a perimeter on the grid (the target is named): practice only. */
function ar5b() {
  const P = 2 * rint(rnd, 5, 16); const q = Math.floor(P / 4); const r = P / 2 - q;
  return {
    key: `ar5b:${P}`, text: `בנו מלבן שהיקפו $${P}$, והשטח שלו הגדול ביותר.`, form: 'manip', practiceOnly: true,
    manip: { kind: 'polygon', grid: [10, 8], task: 'rect', start: { w: 1, h: 1 } }, answer: { mode: 'maxArea', perim: P },
    hint: `אורך ועוד רוחב צריכים להיות $${P / 2}$. נסו כמה זוגות: מתי המכפלה הכי גדולה?`,
    solution: [`$${r} \\cdot ${q} = ${q * r}$ משבצות: ${q === r ? 'ריבוע' : 'הכי קרוב לריבוע'}, והשטח הגדול ביותר בהיקף $${P}$.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- the topic

/** The practice kinds of each stair with their weights (stage2.md MEASURE-2; "check" kinds may be in a check). */
export const KINDS = {
  1: [[35, ar1r], [25, ar1m], [15, ar1s], [10, ar1u], [15, ar1b]],
  2: [[20, ar2l], [15, ar2t], [20, ar2x], [25, ar2g], [10, ar2q], [10, ar2w]],
  3: [[30, ar3l], [20, ar3t], [15, ar3k], [10, ar3u], [15, ar3g], [10, ar3m]],
  4: [[35, ar4p], [35, ar4t], [15, ar4i], [15, ar4c]],
  5: [[30, ar5l], [20, ar5p], [20, ar5u], [10, ar5x], [10, ar5c], [10, ar5b]],
};
/** Every kind's key prefix, by stair. */
export const KIND_KEYS = Object.fromEntries(Object.entries(KINDS).map(([lv, list]) => [lv, list.map(([, f]) => f.name)]));

export const AREA = {
  id: 'area', grade: '7', title: 'שטחים והיקפים', desc: 'מלבן, משולש, צורות מורכבות, מקבילית וטרפז, והיקפים', color: 'fuchsia',
  // taught from December (areas A), April (areas B) and May (perimeters): the first-day placement test does not ask it
  placement: false,
  levels: [
    { title: 'היקף ושטח של מלבן', gen: byWeight(KINDS[1]) },
    { title: 'שטח משולש', gen: byWeight(KINDS[2]) },
    { title: 'צורות מורכבות', gen: byWeight(KINDS[3]) },
    { title: 'מקבילית וטרפז', gen: byWeight(KINDS[4]) },
    { title: 'היקפים: אותו היקף, שטח אחר', gen: byWeight(KINDS[5]) },
  ],
  cats: {
    // the ids other topics already use keep their names: coord's perimeter and add-sides, linear's no-half, pyth's
    // add-legs, ratio's no-convert; two-sides is CLASSROOM-8's, half-twice and hyp-as-height CLASSROOM-13's
    perimeter: 'חישבו היקף במקום שטח',
    'add-sides': 'חיברו את הצלעות במקום לכפול',
    'area-for-perim': 'חישבו שטח במקום היקף',
    'two-sides': 'בהיקף נספרו רק שתי צלעות (חצי היקף)',
    'one-side-perim': 'הורידו מההיקף רק אורך אחד, ולא שניים',
    'perim-as-area': 'חילקו את ההיקף באורך, כאילו הוא שטח',
    'no-half': 'שכחו לחלק ב־2 בשטח המשולש',
    'diag-no-half': 'כפלו את האלכסונים ולא חילקו ב־$2$',
    'div-by-side': 'חילקו את השטח בצלע של האריח, ולא בשטח שלו',
    'half-twice': 'חילקו ב־$2$ גם באגף השני, במקום לכפול ב־$2$',
    'hyp-as-height': 'כפלו ביתר במקום בניצב',
    'slant-as-height': 'כפלו בצלע משופעת במקום בגובה',
    'inside-height': 'חשבו שגובה נמצא תמיד בתוך המשולש',
    'no-subtract': 'חישבו את הצורה השלמה ולא הורידו את החלק החסר',
    'double-count': 'ספרו פעמיים חלק ששייך לשני החלקים',
    'one-base': 'כפלו בגובה רק בסיס אחד',
    'half-para': 'חילקו ב־$2$ כמו במשולש',
    'missing-sides': 'חיברו רק את הצלעות שכתוב עליהן מספר',
    'add-legs': 'חיברו את הצלעות בלי לרבע',
    'no-convert': 'שכחו להמיר בין סנטימטרים למטרים',
    'same-perim-same-area': 'חשבו שבאותו היקף יש אותו שטח',
    'unit-mix': 'כתבו יחידת אורך לשטח, או יחידת שטח לאורך',
  },
  lesson: {
    points: [
      'שטח הוא כמה משבצות מכסות את הצורה; היקף הוא האורך מסביב.',
      'מלבן $6$ על $4$: שטח $24$ סמ״ר, היקף $20$ ס״מ.',
      'משולש: צלע כפול הגובה אליה, חלקי $2$. במשולש ישר־זווית הניצבים הם צלע וגובה.',
      'צורה מורכבת: מפרקים ומחברים, או משלימים ומחסירים.',
      'מקבילית: צלע כפול הגובה אליה. טרפז: סכום הבסיסים כפול הגובה, חלקי $2$.',
      'לשני מלבנים באותו היקף יכולים להיות שטחים שונים: $6 \\cdot 2 = 12$, $4 \\cdot 4 = 16$.',
    ],
    words: ['היקף', 'שטח', 'סמ״ר', 'מ״ר', 'צלע', 'גובה לצלע', 'גובה פנימי', 'גובה חיצוני', 'ניצב', 'יתר', 'בסיס', 'מקבילית', 'טרפז', 'בסיסי הטרפז', 'אלכסונים מאונכים', 'דלתון', 'מעוין', 'צורה מורכבת', 'פירוק', 'השלמה'],
  },
};
