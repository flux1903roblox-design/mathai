// Congruent triangles (חפיפת משולשים): the ח׳ unit 8.12 of January and February (curriculum stage 4, GEOM-5).
//
// One picture carries it: a congruence is read in the order of its letters. △ABC ≅ △KML says A goes with K, B with M
// and C with L, wherever the second triangle is drawn, turned or mirrored; corresponding sides and angles are equal; three
// parts in the right arrangement (צ.ז.צ, ז.צ.ז, צ.צ.צ) make two triangles congruent, and two sides with an angle not
// between them, or three angles, do not; a proof writes it in the class's table, and a median halves a triangle's area.
//
// The diagnostic models (CONGR1 to CONGR4T) are the stage's (scratchpad/lanes/stage4/spec/models.mjs), the critique's
// revised ones, ported unchanged: the form is drawn first (a "third angle" form and an x form, five forms in congr:3,
// an area and a height form in congr:4), then redrawn inside it when a prediction looks like a slip or another
// prediction (clean), and when the answer is a printed number or 180 − n, 90 − n, 360 − n of a printed angle
// (notGuessable). What the models leave free (which letters the second triangle has, how it is turned, the x form's
// vertex) is read from their draw, so the port draws exactly what models.mjs draws. Every number written here is checked
// by the lane's spec/facts-congr.mjs.
// Errors and their sources (stage4.md §0.4):
//   alpha-order, match-by-place   vertices matched by the alphabet or by their place in the drawing, not by the order
//                     of the congruence (the Ministry's "קריאת חפיפה לפי סדר הקודקודים"; Fischbein's figural concepts)
//   one-angle, wrong-pair   one angle only taken from 180°; a part compared with one that does not match (the
//                     critique's x form: "180° minus both" gives the third angle, not the one asked)
//   ssa, aaa          two sides and an angle not between them, or three angles, taken for a theorem (the Weizmann kit's
//                     "משפט מזויף"; the Ministry's ט׳ fourth theorem is the case with the angle opposite the longer side)
//   circular, wrong-theorem   a conclusion above the congruence it follows from; a theorem that does not fit the data
//   half-only, no-half   the angle of one triangle where both make the angle, or the whole angle where half is meant
//   full-base, median-as-height, full-side   the whole side as the base of half the triangle, the median as the height,
//                     the whole side in a half's perimeter (Hershkowitz 1989, prototypes of the altitude)
//   median-congruent, median-altitude, equal-perimeter   a median taken to cut congruent halves, a median, an altitude and
//                     a bisector confused, equal perimeters taken for congruence
// This module is the topic's arithmetic: the models, the practice generators, their texts, drawings and solutions. It
// is not on the first screen: content/congr.js, the topic object, puts CONGR_GENS on its levels, and both load with the
// topic (content/topics.js importGens; the teaching content, learn/content/congr.ts, imports this file too). It imports
// the proof templates (content/proofs.js, which registers the proof object), so a proof item is checkable wherever the
// unit has loaded.
import { shuffle } from './util.js';
import { clean, notGuessable } from './frac.js';
import { slipOf } from '@/learn/misconceptions.ts';
import { triFromAngles, PROOF, R, proofIn, proofManip, proofDiag, checkProofItem } from './proofs.js';
import { proofSolution } from './proof.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const r9 = (v) => Math.round(v * 1e9) / 1e9;
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------------- the models' draws (spec/models.mjs, unchanged)
/**
 * The redraw rule of every model here (models.mjs mk): the form first, by weight, so the stated shares are the real
 * ones; then clean(), and the answer never a number the question shows (`printed`, and `figNums` for a drawing, each
 * with and without its sign: the student reads the 6 of "5x − 6"). A model
 * with `degs` keeps its printed angles apart: the answer is none of the numbers, and none of 180 − n, 90 − n, 360 − n of a
 * printed angle n; a model without `degs` applies the degree rule to all its numbers when `deg` is set.
 */
function mk(m) {
  m.params = (r) => {
    const raw = m.forms ? (() => { let x = r() * m.forms.reduce((a, f) => a + f.w, 0); for (const f of m.forms) { x -= f.w; if (x <= 0) return f.raw; } return m.forms[m.forms.length - 1].raw; })() : m.raw;
    for (let i = 0; i < 200000; i += 1) {
      const p = raw(r);
      if (!p || !clean(m, p)) continue;
      // every printed number as the student reads it, without its sign too: (5x − 10)° shows a 10 (stage 4's review)
      const nums = [...m.printed(p), ...(m.figNums ? m.figNums(p) : [])].flatMap((n) => (n < 0 ? [n, -n] : [n]));
      if (m.degs) {
        if (!notGuessable(m.answer(p), nums, false)) continue;
        if (!notGuessable(m.answer(p), m.degs(p), true)) continue;
      } else if (!notGuessable(m.answer(p), nums, !!m.deg)) continue;
      return p;
    }
    throw new Error('no clean draw');
  };
  return m;
}
/** A shuffle of 0..n-1 (the order in which a question prints its givens). */
const order = (r, n) => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const inOrder = (vals, ord) => (ord ? ord.map((i) => vals[i]) : vals);

const angle3 = (r) => {
  const al = 5 * rint(r, 7, 21); const be = 5 * rint(r, 7, 21); const ga = 180 - al - be;
  if (ga < 35 || ga > 105 || new Set([al, be, ga]).size < 3 || [al, be, ga].includes(90)) return null;
  return { al, be, ga };
};
const xForm = (r, t) => {
  const V = pick(r, ['al', 'be', 'ga']); const others = ['al', 'be', 'ga'].filter((k) => k !== V);
  const D = pick(r, others); const T = others.find((k) => k !== D);
  const p = pick(r, [2, 3, 4, 5]); const x = rint(r, 5, 35); const q = t[V] - p * x;
  if (q === 0 || q < -20 || q > 30) return null;
  return { form: 'x', th: t[V], ph: t[D], tt: t[T], p, q, x };
};
const thirdForm = (r) => { const t = angle3(r); return t && { form: 'third', ...t, alpha: r() < 0.5 ? 'A' : 'B' }; };
const xFormRaw = (r) => { const t = angle3(r); return t && xForm(r, t); };
const CONGR12 = {
  forms: [{ w: 20, raw: thirdForm }, { w: 80, raw: xFormRaw }],
  answer: (p) => (p.form === 'third' ? p.ga : p.x),
  printed: (p) => (p.form === 'third' ? [p.al, p.be] : [p.p, p.q, p.th, p.ph]),
  degs: (p) => (p.form === 'third' ? [p.al, p.be] : [p.th, p.ph]),
  // the answer is in degrees in the third form only (x is a number)
  deg: (p) => p.form === 'third',
};
const BUGS12 = {
  'alpha-order': (p) => (p.form === 'third' ? (p.alpha === 'A' ? p.al : p.be) : r9((p.ph - p.q) / p.p)), // letters matched in alphabetical order
  'match-by-place': (p) => (p.form === 'third' ? (p.alpha === 'A' ? p.be : p.al) : null), // matched by where the vertex is drawn
  'one-angle': (p) => (p.form === 'third' ? 180 - p.al : null), // only one angle taken from 180
  'wrong-pair': (p) => (p.form === 'x' ? r9((180 - p.th - p.ph - p.q) / p.p) : null), // V matched with the third vertex
};
/** congr:1 — a congruence read in the order of its letters (the third angle, or x through the matching angle). */
export const CONGR1 = mk({ ...CONGR12, bugs: BUGS12 });
/** congr:1 transfer: the same two forms, as two frames of a stage roof. */
export const CONGR1T = mk({ ...CONGR12, bugs: BUGS12 });
const BUGS2 = { 'alpha-order': BUGS12['alpha-order'], 'one-angle': BUGS12['one-angle'], 'wrong-pair': BUGS12['wrong-pair'] };
/** congr:2 — the same two forms, the correspondence read from the equal sides (no match-by-place). */
export const CONGR2 = mk({ ...CONGR12, bugs: BUGS2 });
/** congr:2 transfer: two flower beds whose sides are equal in pairs. */
export const CONGR2T = mk({ ...CONGR12, bugs: BUGS2 });

const kAC = (r, T, f, cmin, cmax) => { const a = 5 * rint(r, 4, 14); const c = 5 * rint(r, cmin, cmax); if (a === c || 180 - a - c < 20 || 180 - a - c === 90) return null; return { T, f, a, c }; };
/**
 * congr:3 — a congruence found in a figure and used. K1 the kite (צ.צ.צ, AC common), ∢BAC = a, ∢BCA = c: asked ∢ADC
 * (third) or ∢BAD = 2a (whole); K2 crossing segments (צ.ז.צ, vertical angles), ∢CAM = a, ∢AMC = c: asked ∢MDB (third),
 * or the x form, ∢ACM = (px + q)°, ∢MDB = th, ∢MBD = ph; K5 a perpendicular from C to the middle of AB (צ.ז.צ), ∢CAD = a,
 * asked ∢ACB.
 */
export const CONGR3 = mk({
  forms: [
    { w: 25, raw: (r) => { const a = 5 * rint(r, 5, 16) + pick(r, [0, 2]); if (a === 45) return null; return { T: 'K5', a, c: 0 }; } },
    // (the spec's shares were K1 whole 20, K1 third 15, K2 third 15, K2 x 25: the two "third" forms, 30%, are answered by
    // "180° minus the two printed angles" without the congruence, and the verification of the proof mistakes, which only
    // practice-only questions show, asks three of these questions: 2.98% by that guess, over the 2% gate. At 10 and 10
    // it is under 1%, and every bug still shows on at least 45% of the draws)
    { w: 25, raw: (r) => kAC(r, 'K1', 'whole', 4, 14) },
    { w: 10, raw: (r) => kAC(r, 'K1', 'third', 4, 14) },
    { w: 10, raw: (r) => kAC(r, 'K2', 'third', 8, 22) },
    { w: 30, raw: (r) => {
      const th = 5 * rint(r, 7, 21); const ph = 5 * rint(r, 7, 21); const m = 180 - th - ph;
      if (m < 30 || new Set([th, ph, m]).size < 3 || [th, ph, m].includes(90)) return null;
      const p = pick(r, [2, 3, 4, 5]); const x = rint(r, 5, 35); const q = th - p * x;
      if (q === 0 || q < -20 || q > 30) return null;
      return { T: 'K2', f: 'x', th, ph, p, q, x };
    } },
  ],
  answer: (p) => (p.T === 'K5' ? 180 - 2 * p.a : p.f === 'whole' ? 2 * p.a : p.f === 'x' ? p.x : 180 - p.a - p.c),
  bugs: {
    // a part that does not match in the congruence
    'wrong-pair': (p) => (p.T === 'K2' && p.f === 'x' ? r9((p.ph - p.q) / p.p) : p.f === 'third' ? (p.T === 'K1' ? p.c : p.a) : null),
    // only one angle taken from 180
    'one-angle': (p) => (p.T === 'K5' ? 180 - p.a : p.f === 'third' ? (p.T === 'K2' ? 180 - p.c : 180 - p.a) : null),
    // the angle of one of the two triangles only
    'half-only': (p) => (p.T === 'K5' ? 90 - p.a : p.f === 'whole' ? p.a : null),
  },
  printed: (p) => (p.T === 'K5' ? [p.a] : p.f === 'x' ? [p.p, p.q, p.th, p.ph] : [p.a, p.c]),
  degs: (p) => (p.T === 'K5' ? [p.a] : p.f === 'x' ? [p.th, p.ph] : [p.a, p.c]),
  deg: (p) => p.f !== 'x',
});
/** congr:3 transfer — a toy kite: AB = AD, CB = CD; the head angle ∢BAD = 2a and ∢BCD = 2c; asked ∢ABC. */
export const CONGR3T = mk({
  raw: (r) => { const a = 5 * rint(r, 3, 12); const c = 5 * rint(r, 2, 10); if (a === c || a + c >= 90 || 180 - a - c === 90) return null; return { a, c }; },
  answer: ({ a, c }) => 180 - a - c,
  bugs: {
    'no-half': ({ a, c }) => 180 - 2 * a - 2 * c, // the whole angles at A and C used, not their halves
    'one-angle': ({ a }) => 180 - a,
  },
  printed: ({ a, c }) => [2 * a, 2 * c], deg: true,
});
/** (h, t, m): the height AH, the distance DH and the median AD of congr:4, all whole. */
export const HTM = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [8, 15, 17], [9, 12, 15], [12, 9, 15]];
/**
 * congr:4 — BC = b, the height from A is h, the median AD = m (h, t, m a triple, t = DH, and 2t ≠ b so H is not B or C).
 * Form 'area' (60%): the area of △ABD; form 'h' (40%): the height AH from the area S of △ABD, BC and the median. The
 * givens are printed in a shuffled order (`ord`).
 */
export const CONGR4 = mk({
  forms: [
    { w: 60, raw: (r) => { const [h, t, m] = pick(r, HTM); const b = 2 * rint(r, 3, 10); if (2 * t === b) return null; return { f: 'area', b, h, t, m, ord: order(r, 3) }; } },
    { w: 40, raw: (r) => { const [h, t, m] = pick(r, HTM); const b = 2 * rint(r, 3, 10); if (2 * t === b) return null; return { f: 'h', b, h, t, m, S: (b * h) / 4, ord: order(r, 3) }; } },
  ],
  answer: (p) => (p.f === 'area' ? (p.b * p.h) / 4 : p.h),
  bugs: {
    'full-base': (p) => (p.f === 'area' ? (p.b * p.h) / 2 : (2 * p.S) / p.b), // the whole side BC taken as the base of △ABD
    'median-as-height': (p) => (p.f === 'area' ? (p.b * p.m) / 4 : p.m), // the median taken as the height
  },
  printed: (p) => inOrder(p.f === 'area' ? [p.b, p.h, p.m] : [p.b, p.m, p.S], p.ord),
  degs: () => [],
});
/** congr:4 transfer — the fence, the distance and the path (the area form), told in two orders. */
// (the model's draw; a fence twice DH long would put the foot of the height on B, so the drawing redraws it)
const congr4Area = (r) => { const [h, t, m] = pick(r, HTM); const b = 2 * rint(r, 3, 10); if (2 * t === b) return null; return { b, h, t, m, story: r() < 0.5 ? 0 : 1 }; };
export const CONGR4T = mk({
  raw: congr4Area,
  answer: ({ b, h }) => (b * h) / 4,
  bugs: {
    'full-base': ({ b, h }) => (b * h) / 2,
    'median-as-height': ({ b, m }) => (b * m) / 4,
  },
  printed: ({ b, h, m, story }) => (story ? [m, b, h] : [b, h, m]),
});
/** Every (p, q, r, m) with AD the median to BC = r, AB = p, AC = q, all whole: 4m² = 2p² + 2q² − r² (Apollonius). */
export const MEDIANS = (() => {
  const out = [];
  for (let p = 4; p <= 20; p += 1) for (let q = 3; q < p; q += 1) for (let rr = 4; rr <= 26; rr += 2) {
    if (p + q <= rr || p + rr <= q || q + rr <= p) continue;
    const m2 = (2 * p * p + 2 * q * q - rr * rr) / 4; const m = Math.sqrt(m2);
    if (Number.isInteger(m) && m > 0 && m !== p && m !== q && m !== rr) out.push({ p, q, r: rr, m });
  }
  return out;
})();
/** congr:4 rectMedian: (AB, BC, AC) of a rectangle with its diagonal, a whole triple with BC even (the critique's list). */
export const RECT_TRIPLES = [[8, 6, 10], [6, 8, 10], [12, 16, 20], [16, 12, 20], [5, 12, 13], [9, 12, 15], [15, 8, 17], [24, 10, 26]];

// ---------------------------------------------------------------- words
const ang = (s) => `\\sphericalangle ${s}`;
const tri = (s) => `\\triangle ${s}`;
/** (2x + 10)° in TeX, and the same for a drawing's label (a real minus sign). */
const exprTex = (p, q) => `${p}x ${q < 0 ? '-' : '+'} ${Math.abs(q)}`;
const exprFig = (p, q) => `(${p}x ${q < 0 ? '−' : '+'} ${Math.abs(q)})°`;
const ORD = ['ראשון', 'שני', 'שלישי'];
/** The letter sets of the second triangle, each in alphabetical order. */
export const SECOND = [['K', 'L', 'M'], ['P', 'Q', 'R'], ['D', 'E', 'F'], ['X', 'Y', 'Z']];

// ---------------------------------------------------------------- the two-triangle drawing
const rad = (d) => (d * Math.PI) / 180;
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const BASE = 5;
/** An angle mark at V inside the triangle V, a, b: from and to set so the counterclockwise sweep is the inner angle. */
export function innerAngle(P, V, a, b, more = {}) {
  const v = P[V]; const u = P[a]; const w = P[b];
  const cross = (u[0] - v[0]) * (w[1] - v[1]) - (u[1] - v[1]) * (w[0] - v[0]);
  return cross > 0 ? { at: V, from: a, to: b, ...more } : { at: V, from: b, to: a, ...more };
}
/**
 * Two true triangles: ABC with C at (0, 0), B at (5, 0) and A on top, from its angles (triFromAngles); and its image under
 * `partner` (A → partner.A …), drawn to the right with partner[top] on top, partner[left] bottom left and partner[right]
 * bottom right: the base and its two angles carried over (two angles and the side between them fix a triangle), so the
 * second is congruent to the first under the correspondence, turned or mirrored by where the letters go.
 *   angs     the angles of ABC ({ A, B, C } in degrees)
 *   marks    angle marks by vertex letter: { text?, target?, n?, r? }
 *   ticks    side ticks by side of ABC ('AB', 'BC', 'CA'), drawn on the side and on its image
 *   sides    side labels by segment name of either triangle ('AB', 'KM' …)
 */
export function twoTriangles({ angs, partner, top = 'A', left = 'C', marks = {}, ticks = {}, sides = {}, label, view }) {
  const right = ['A', 'B', 'C'].find((v) => v !== top && v !== left);
  const P = { C: [0, 0], B: [BASE, 0], A: triFromAngles(angs.C, angs.B, BASE) };
  const d = dist(P[left], P[right]);
  const apex = triFromAngles(angs[left], angs[right], d);
  const minX2 = Math.min(0, apex[0]);
  // the gap between the two: wider when a side carries an expression (4x − 1), so its label fits between them
  // (a steep side needs the label's whole width beside it)
  const steep = Math.abs(P.A[0] - P.B[0]) < 0.6 * Math.abs(P.A[1] - P.B[1]);
  const longest = Math.max(0, ...Object.values(sides).map((t) => String(t).length));
  let gap = longest > 3 ? 2.8 : 1.4;
  if (longest > 3 && steep) {
    // as wide as the label (about 11px a character, and 18px of air) at the scale the drawing will have: the box is
    // 320 by 220 with 34px of padding at the sides, and the pair is as wide as both triangles and the gap
    const width = (g) => Math.max(BASE, P.A[0]) + g - minX2 + Math.max(d, apex[0]) - Math.min(0, P.A[0]);
    const tall = Math.max(P.A[1], apex[1]);
    const scale = (g) => Math.min((320 - 68) / width(g), (220 - 56) / tall);
    gap = 4.4;
    while (gap < 8 && gap * scale(gap) < longest * 11 + 18) gap += 0.4;
  }
  const ox = Math.max(BASE, P.A[0]) + gap - minX2;
  P[partner[left]] = [ox, 0];
  P[partner[right]] = [ox + d, 0];
  P[partner[top]] = [ox + apex[0], apex[1]];
  const both = ['A', 'B', 'C'].flatMap((v) => [v, partner[v]]);
  const nb = (v) => {
    const own = ['A', 'B', 'C'].includes(v) ? ['A', 'B', 'C'] : ['A', 'B', 'C'].map((k) => partner[k]);
    return own.filter((k) => k !== v);
  };
  const angles = both.filter((v) => marks[v]).map((v) => { const [a, b] = nb(v); return innerAngle(P, v, a, b, marks[v]); });
  const segs = [];
  for (const [side, n] of Object.entries(ticks)) {
    const [s, t] = side.split('');
    segs.push({ a: s, b: t, ticks: n }, { a: partner[s], b: partner[t], ticks: n });
  }
  for (const [side, text] of Object.entries(sides)) {
    const [s, t] = side.split('');
    const at = segs.find((g) => (g.a === s && g.b === t) || (g.a === t && g.b === s));
    if (at) at.label = text; else segs.push({ a: s, b: t, label: text });
  }
  const second = ['A', 'B', 'C'].map((k) => partner[k]);
  return {
    type: 'geo', label: label || `שני משולשים: ABC ו־${second.join('')}`,
    pts: P,
    polys: [{ pts: ['A', 'B', 'C'] }, { pts: second }],
    ...(segs.length ? { segs } : {}),
    ...(angles.length ? { angles } : {}),
    // a written expression ((3x − 15)° or 4x − 1) is wider than a number: room for it under or over a vertex
    view: view || (Object.values(marks).some((k) => /x/.test(k.text || '')) || Object.values(sides).some((t) => /x/.test(t)) ? [320, 220] : [320, 190]), pad: [Object.keys(sides).length ? 34 : 26, 28],
    // the correspondence the drawing was made under (figures.test.ts checks the two triangles congruent under it)
    match: ['A', 'B', 'C'].map((k) => [k, partner[k]]),
  };
}

// ---------------------------------------------------------------- congr:1 and congr:2 letters, read from the draw
/** The second triangle's letter set, chosen by the draw's numbers (so the port draws exactly what models.mjs draws). */
const setOf = (p) => SECOND[(p.form === 'third' ? p.al + p.be : p.th + p.ph + p.x) % SECOND.length];
/**
 * The third form's correspondence: the asked vertex X3 (C's partner) is the one the alphabet pairs with `alpha` (A or
 * B), so 'alpha-order' names a printed angle; the drawing puts X3 where the other given vertex is drawn
 * ('match-by-place'): on top when alpha is B, bottom right when alpha is A.
 */
export function thirdLetters(p, set = setOf(p)) {
  const i = p.alpha === 'A' ? 0 : 1; const rest = set.filter((_, k) => k !== i);
  const partner = { A: rest[0], B: rest[1], C: set[i] };
  return { partner, asked: set[i], top: p.alpha === 'A' ? 'B' : 'C', left: p.alpha === 'A' ? 'A' : 'B' };
}
/**
 * The x form's correspondence: V (the vertex of ABC whose angle is written (px + q)°) by the draw, V's partner one of the
 * two letters the alphabet does not pair with V, the decoy (the alphabet's partner of V) the partner of D, the vertex
 * whose angle is ph; T the third (its angle tt, not shown).
 */
export function xLetters(p, set = setOf(p)) {
  const V = ['A', 'B', 'C'][(p.th + p.p) % 3];
  const others = ['A', 'B', 'C'].filter((k) => k !== V);
  const D = others[(p.ph + p.q + 60) % 2]; const T = others.find((k) => k !== D);
  const i = ['A', 'B', 'C'].indexOf(V);
  const decoy = set[i];
  const free = set.filter((_, k) => k !== i);
  const pv = free[p.x % 2]; const pt = free.find((k) => k !== pv);
  const partner = { [V]: pv, [D]: decoy, [T]: pt };
  return { V, D, T, partner, decoy };
}
const angsOfX = (p, L) => ({ [L.V]: p.th, [L.D]: p.ph, [L.T]: p.tt });
const nameOf = (partner) => ['A', 'B', 'C'].map((k) => partner[k]).join('');

/** congr:1's question: the congruence in letters, then the angles. */
export function congr1Text(p) {
  const s = setOf(p);
  if (p.form === 'third') {
    const L = thirdLetters(p, s);
    return `$${tri('ABC')} \\cong ${tri(nameOf(L.partner))}$ (לפי סדר הקודקודים). $${ang('A')} = ${p.al}°$, $${ang('B')} = ${p.be}°$. מה גודל $${ang(L.asked)}$?`;
  }
  const L = xLetters(p, s);
  const shown = [[L.partner[L.V], p.th], [L.decoy, p.ph]].sort((a, b) => nameOf(L.partner).indexOf(a[0]) - nameOf(L.partner).indexOf(b[0]));
  return `$${tri('ABC')} \\cong ${tri(nameOf(L.partner))}$ (לפי סדר הקודקודים). $${ang(L.V)} = (${exprTex(p.p, p.q)})°$, ${shown.map(([k, v]) => `$${ang(k)} = ${v}°$`).join(', ')}. מה $x$?`;
}
/** Where V is drawn in ABC: A on top, B bottom right, C bottom left. */
const PLACE = { A: 'top', B: 'right', C: 'left' };
/**
 * A turn or mirror of the second triangle that does not put V's partner where V is drawn (the second triangle drawn
 * "the same way" would let a student match by place): one of the arrangements that move V, chosen by `k`.
 */
export function placeAway(V, k) {
  const all = [['A', 'C'], ['A', 'B'], ['B', 'C'], ['B', 'A'], ['C', 'A'], ['C', 'B']].map(([top, left]) => ({ top, left }));
  const away = all.filter(({ top, left }) => (top === V ? 'top' : left === V ? 'left' : 'right') !== PLACE[V]);
  return away[k % away.length];
}
/**
 * The second triangle of an x form, where two of its angles carry numbers: the widest angle on top, so the base is long
 * and the numbers at its corners stay apart, as long as V's partner is not drawn where V is (V the vertex whose angle
 * is the expression).
 */
export function wideTop(angs, V) {
  const byAngle = ['A', 'B', 'C'].sort((u, v) => angs[v] - angs[u]);
  for (const top of byAngle) {
    for (const left of ['A', 'B', 'C'].filter((k) => k !== top)) {
      const place = top === V ? 'top' : left === V ? 'left' : 'right';
      if (place !== PLACE[V]) return { top, left };
    }
  }
  return { top: 'A', left: 'B' };
}
/** The two triangles of congr:1 and congr:2: the given angles, the asked one, and (congr:2) the equal sides' ticks. */
export function congrFig(p, { sideTicks = false } = {}) {
  const s = setOf(p);
  if (p.form === 'third') {
    const L = thirdLetters(p, s);
    return twoTriangles({
      angs: { A: p.al, B: p.be, C: p.ga }, partner: L.partner, top: L.top, left: L.left,
      marks: { A: { text: `${p.al}°` }, B: { text: `${p.be}°` }, [L.asked]: { text: '?', target: true } },
      ticks: sideTicks ? { AB: 1, BC: 2, CA: 3 } : {},
    });
  }
  const L = xLetters(p, s);
  const { top, left } = wideTop(angsOfX(p, L), L.V);
  return twoTriangles({
    angs: angsOfX(p, L), partner: L.partner, top, left,
    marks: { [L.V]: { text: exprFig(p.p, p.q) }, [L.partner[L.V]]: { text: `${p.th}°` }, [L.decoy]: { text: `${p.ph}°` } },
    ticks: sideTicks ? { AB: 1, BC: 2, CA: 3 } : {},
  });
}
// The third angle's line, in two short runs: a line of maths does not wrap, and the chain of three equalities was wider
// than the solution's box on a 320 phone (e2e/solutions-fit.spec.js).
const thirdLine = (p, asked) => `$${ang('C')} = 180° - ${p.al}° - ${p.be}° = ${p.ga}°$, ולכן גם $${ang(asked)} = ${p.ga}°$`;
/** The same for angles named by three letters: the sum on its own, then the two equal angles. */
const thirdOf = (p, name, asked, twin) => `הזווית השלישית ב־$${tri(name)}$: $180° - ${p.a}° - ${p.c}° = ${180 - p.a - p.c}°$. לכן $${ang(asked)} = ${ang(twin)} = ${180 - p.a - p.c}°$`;
export function congr1Solution(p) {
  const s = setOf(p);
  if (p.form === 'third') {
    const L = thirdLetters(p, s);
    return [`$${L.asked}$ שלישי ב־$${tri(nameOf(L.partner))}$, ולכן הוא מתאים ל־$C$, השלישי ב־$${tri('ABC')}$.`, thirdLine(p, L.asked)];
  }
  const L = xLetters(p, s); const i = ['A', 'B', 'C'].indexOf(L.V);
  return [
    `$${L.V}$ ${ORD[i]} ב־$${tri('ABC')}$, ולכן הוא מתאים ל־$${L.partner[L.V]}$, ה${ORD[i]} ב־$${tri(nameOf(L.partner))}$.`,
    `$${exprTex(p.p, p.q)} = ${p.th}$, ולכן $${p.p}x = ${p.th - p.q}$ ו־$x = ${p.x}$`,
  ];
}
export const congr1Hint = (p) => (p.form === 'third'
  ? `מצאו לאיזה קודקוד של $ABC$ מתאים $${thirdLetters(p).asked}$, לפי מקומו בכתיבה.`
  : `מצאו לאיזה קודקוד מתאים $${xLetters(p).V}$ לפי מקומו בכתיבה, והשוו את הזוויות שלהם.`);
/** congr:1's transfer: two congruent frames of a stage roof, △ABC ≅ △FDE or △EFD (the letters by the draw's alpha). */
const FRAME = { A: { A: 'E', B: 'F', C: 'D' }, B: { A: 'F', B: 'D', C: 'E' } };
const frameOf = (p) => (p.form === 'third' ? FRAME[p.alpha] : FRAME.B);
export function congr1TText(p) {
  const f = frameOf(p); const name = nameOf(f);
  if (p.form === 'third') return `גג של במה נשען על שתי מסגרות משולשות חופפות, $${tri('ABC')} \\cong ${tri(name)}$. במסגרת הראשונה $${ang('A')} = ${p.al}°$ ו־$${ang('B')} = ${p.be}°$. כמה מעלות הזווית ב־$${f.C}$?`;
  return `גג של במה נשען על שתי מסגרות משולשות חופפות, $${tri('ABC')} \\cong ${tri(name)}$. בתוכנית של המסגרת הראשונה כתוב $${ang('B')} = (${exprTex(p.p, p.q)})°$. במסגרת השנייה מדדו $${ang('D')} = ${p.th}°$ ו־$${ang('E')} = ${p.ph}°$. מה $x$?`;
}
export function congr1TFig(p) {
  const f = frameOf(p);
  if (p.form === 'third') {
    return twoTriangles({
      angs: { A: p.al, B: p.be, C: p.ga }, partner: f, top: p.alpha === 'A' ? 'B' : 'C', left: p.alpha === 'A' ? 'A' : 'B',
      marks: { A: { text: `${p.al}°` }, B: { text: `${p.be}°` }, [f.C]: { text: '?', target: true } }, label: 'שתי מסגרות משולשות של גג',
    });
  }
  // B ↔ D shows th; E (the alphabet's partner of B) is C's partner and shows ph
  return twoTriangles({
    angs: { A: p.tt, B: p.th, C: p.ph }, partner: f, ...wideTop({ A: p.tt, B: p.th, C: p.ph }, 'B'),
    marks: { B: { text: exprFig(p.p, p.q) }, D: { text: `${p.th}°` }, E: { text: `${p.ph}°` } }, label: 'שתי מסגרות משולשות של גג',
  });
}
export function congr1TSolution(p) {
  const f = frameOf(p);
  if (p.form === 'third') return [`$${f.C}$ שלישי ב־$${tri(nameOf(f))}$, ולכן הפינה ב־$${f.C}$ מתאימה לפינה ב־$C$.`, `$${ang('C')} = 180° - ${p.al}° - ${p.be}° = ${p.ga}°$`];
  return [`$B$ שני ב־$${tri('ABC')}$ ו־$D$ שני ב־$${tri(nameOf(f))}$: $${ang('B')} = ${ang('D')}$.`, `$${exprTex(p.p, p.q)} = ${p.th}$, ולכן $x = ${p.x}$`];
}
export const congr1THint = (p) => (p.form === 'third' ? 'איזו פינה במסגרת השנייה מתאימה לפינה $C$? לפי הסדר בכתיבה.' : 'לאיזו פינה במסגרת השנייה מתאימה $B$? לפי הסדר בכתיבה.');

/** congr:2: the correspondence written as equal sides (SSS), or two sides and the angle between them (SAS). */
const sidesOf = (p) => ((p.form === 'third' ? p.al : p.th) % 10 === 0 ? 'sss' : 'sas');
const sideName = (a, b, flip) => (flip ? `${b}${a}` : `${a}${b}`);
/** The equalities of congr:2's question, in letters: the sides (and with SAS the angle between two of them). */
function dataOf(p, partner) {
  const kind = sidesOf(p);
  const pairs = [['A', 'B'], ['B', 'C'], ['C', 'A']].map(([a, b], i) => `$${a}${b} = ${sideName(partner[a], partner[b], (p.p || p.al) % (i + 2) === 0)}$`);
  if (kind === 'sss') return pairs;
  // SAS: the two sides at the vertex the draw picks, and the angle between them
  const at = ['A', 'B', 'C'][((p.form === 'third' ? p.be : p.ph) / 5) % 3];
  const keep = [['A', 'B'], ['B', 'C'], ['C', 'A']].map((s, i) => [s, i]).filter(([s]) => s.includes(at)).map(([, i]) => pairs[i]);
  return [keep[0], `$${ang(at)} = ${ang(partner[at])}$`, keep[1]];
}
export function congr2Text(p) {
  const s = setOf(p);
  const L = p.form === 'third' ? thirdLetters(p, s) : xLetters(p, s);
  const second = [...s].join('');
  const data = dataOf(p, L.partner).join(', ');
  if (p.form === 'third') return `במשולשים $ABC$ ו־$${second}$: ${data}. $${ang('A')} = ${p.al}°$, $${ang('B')} = ${p.be}°$. מה גודל $${ang(L.asked)}$?`;
  const shown = [[L.partner[L.V], p.th], [L.decoy, p.ph]].sort((a, b) => a[0].localeCompare(b[0]));
  return `במשולשים $ABC$ ו־$${second}$: ${data}. $${ang(L.V)} = (${exprTex(p.p, p.q)})°$, ${shown.map(([k, v]) => `$${ang(k)} = ${v}°$`).join(', ')}. מה $x$?`;
}
export function congr2Fig(p) {
  const f = congrFig(p, { sideTicks: sidesOf(p) === 'sss' });
  if (sidesOf(p) === 'sss') return f;
  // SAS: the ticks on the two sides at the vertex, and one arc each at the angle between them
  const s = setOf(p); const L = p.form === 'third' ? thirdLetters(p, s) : xLetters(p, s);
  const at = ['A', 'B', 'C'][((p.form === 'third' ? p.be : p.ph) / 5) % 3];
  const sides = [['A', 'B'], ['B', 'C'], ['C', 'A']].filter((sd) => sd.includes(at));
  const segs = sides.flatMap(([a, b], i) => [{ a, b, ticks: i + 1 }, { a: L.partner[a], b: L.partner[b], ticks: i + 1 }]);
  return { ...f, segs };
}
export function congr2Solution(p) {
  const s = setOf(p);
  if (p.form === 'third') {
    const L = thirdLetters(p, s);
    return [`מהצלעות השוות: $A \\leftrightarrow ${L.partner.A}$, $B \\leftrightarrow ${L.partner.B}$, $C \\leftrightarrow ${L.partner.C}$.`, thirdLine(p, L.asked)];
  }
  const L = xLetters(p, s);
  const [n1, n2] = ['A', 'B', 'C'].filter((k) => k !== L.V);
  return [
    `$${L.V}$ נמצא על $${L.V}${n1}$ ועל $${L.V}${n2}$. הצלעות השוות להן נפגשות ב־$${L.partner[L.V]}$: $${L.V} \\leftrightarrow ${L.partner[L.V]}$.`,
    `$${exprTex(p.p, p.q)} = ${p.th}$, ולכן $x = ${p.x}$`,
  ];
}
export const congr2Hint = (p) => {
  const V = p.form === 'third' ? 'C' : xLetters(p).V;
  return `$${V}$ נמצא על שתי צלעות. אילו צלעות שוות להן, ובאיזה קודקוד הן נפגשות?`;
};
export function congr2TText(p) {
  const s = ['D', 'E', 'F'];
  const L = p.form === 'third' ? thirdLetters(p, s) : xLetters(p, s);
  const sides = [['A', 'B'], ['B', 'C'], ['C', 'A']].map(([a, b]) => `$${a}${b} = ${L.partner[a]}${L.partner[b]}$`);
  if (p.form === 'third') return `בגינה שתי ערוגות משולשות. הצלעות שלהן שוות בזוגות: ${sides.join(', ')}. בערוגה הראשונה $${ang('A')} = ${p.al}°$, $${ang('B')} = ${p.be}°$. כמה מעלות הפינה $${L.asked}$ של הערוגה השנייה?`;
  const shown = [[L.partner[L.V], p.th], [L.decoy, p.ph]].sort((a, b) => a[0].localeCompare(b[0]));
  return `בגינה שתי ערוגות משולשות. הצלעות שלהן שוות בזוגות: ${sides.join(', ')}. בתוכנית של הערוגה הראשונה כתוב $${ang(L.V)} = (${exprTex(p.p, p.q)})°$. בערוגה השנייה ${shown.map(([k, v]) => `$${ang(k)} = ${v}°$`).join(' ו־')}. מה $x$?`;
}
export function congr2TFig(p) {
  const s = ['D', 'E', 'F'];
  if (p.form === 'third') {
    const L = thirdLetters(p, s);
    return twoTriangles({ angs: { A: p.al, B: p.be, C: p.ga }, partner: L.partner, top: L.top, left: L.left, ticks: { AB: 1, BC: 2, CA: 3 },
      marks: { A: { text: `${p.al}°` }, B: { text: `${p.be}°` }, [L.asked]: { text: '?', target: true } }, label: 'שתי ערוגות משולשות' });
  }
  const L = xLetters(p, s);
  return twoTriangles({ angs: angsOfX(p, L), partner: L.partner, ...wideTop(angsOfX(p, L), L.V), ticks: { AB: 1, BC: 2, CA: 3 },
    marks: { [L.V]: { text: exprFig(p.p, p.q) }, [L.partner[L.V]]: { text: `${p.th}°` }, [L.decoy]: { text: `${p.ph}°` } }, label: 'שתי ערוגות משולשות' });
}
export function congr2TSolution(p) {
  const s = ['D', 'E', 'F'];
  if (p.form === 'third') { const L = thirdLetters(p, s); return [`מהצלעות השוות: $C \\leftrightarrow ${L.asked}$.`, thirdLine(p, L.asked)]; }
  const L = xLetters(p, s);
  return [`מהצלעות השוות: $${L.V} \\leftrightarrow ${L.partner[L.V]}$.`, `$${exprTex(p.p, p.q)} = ${p.th}$, ולכן $x = ${p.x}$`];
}

// ---------------------------------------------------------------- congr:3 figures and words
/** K1: the kite ABCD, A on top and C at the bottom, B on the right and D its mirror image in the diagonal AC. */
export function kiteFig(a, c, { whole = false, askD = false, aText = `${a}°`, cText = `${c}°`, label } = {}) {
  // the triangle ABC on the diagonal: A (0, 0), C (0, −L), B to the right, ∢BAC = a and ∢BCA = c
  const L = 5;
  const q = triFromAngles(a, c, L); // apex with base from (0,0) to (L,0): rotate so the base points down
  const B = [q[1], -q[0]];
  const P = { A: [0, 0], C: [0, -L], B, D: [-B[0], B[1]] };
  const angles = [innerAngle(P, 'A', 'B', 'C', { text: aText, r: whole ? 22 : 26 }), innerAngle(P, 'C', 'B', 'A', { text: cText, r: 26 })];
  // the whole angle at A, both halves, on a wider arc than its half
  if (whole) angles.push(innerAngle(P, 'A', 'B', 'D', { text: '?', target: true, r: 44 }));
  if (askD) angles.push(innerAngle(P, 'D', 'A', 'C', { text: '?', target: true }));
  return {
    type: 'geo', label: label || 'דלתון ABCD והאלכסון AC. AB ו־AD מסומנים שווים, וגם CB ו־CD',
    pts: P, polys: [{ pts: ['A', 'B', 'C', 'D'] }],
    segs: [{ a: 'A', b: 'B', ticks: 1 }, { a: 'A', b: 'D', ticks: 1 }, { a: 'C', b: 'B', ticks: 2 }, { a: 'C', b: 'D', ticks: 2 }, { a: 'A', b: 'C', thin: true }],
    angles,
    view: [300, 220], pad: [28, 24],
  };
}
/** K2: AB and CD cross at M, each halved there; the triangle AMC drawn true from its angles at A and at M. */
export function crossFig(atA, atM, marks) {
  const d = 3;
  const C = (() => { const q = triFromAngles(atA, atM, d); return [q[0] - d, q[1]]; })();
  const P = { A: [-d, 0], M: [0, 0], B: [d, 0], C, D: [-C[0], -C[1]] };
  const nbs = { A: ['M', 'C'], C: ['A', 'M'], M: ['A', 'C'], B: ['M', 'D'], D: ['M', 'B'] };
  const angles = Object.entries(marks).map(([v, m]) => innerAngle(P, v, ...nbs[v], m));
  return {
    type: 'geo', label: 'הקטעים AB ו־CD נחתכים בנקודה M. AM ו־MB מסומנים שווים, וגם CM ו־MD',
    pts: P, polys: [{ pts: ['A', 'M', 'C'] }, { pts: ['B', 'M', 'D'] }],
    segs: [{ a: 'A', b: 'M', ticks: 1 }, { a: 'M', b: 'B', ticks: 1 }, { a: 'C', b: 'M', ticks: 2 }, { a: 'M', b: 'D', ticks: 2 }, { a: 'A', b: 'C' }, { a: 'B', b: 'D' }],
    angles, view: [300, 210], pad: [28, 24],
  };
}
/** K5: CD ⊥ AB at D, the middle of AB; ∢CAD = a. */
export function perpFig(a, { aText = `${a}°`, ask = true } = {}) {
  const w = 3; const h = w * Math.tan(rad(a));
  const P = { A: [-w, 0], B: [w, 0], D: [0, 0], C: [0, h] };
  return {
    type: 'geo', label: 'משולש ABC והקטע CD המאונך ל־AB. D באמצע AB: AD ו־DB מסומנים שווים',
    pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }, { a: 'C', b: 'D' }],
    angles: [
      { at: 'D', from: 'B', to: 'C', right: true },
      innerAngle(P, 'A', 'D', 'C', { text: aText }),
      ...(ask ? [innerAngle(P, 'C', 'A', 'B', { text: '?', target: true, r: 30 })] : []),
    ],
    view: [300, 230], pad: [28, 24],
  };
}
export function congr3Text(p) {
  if (p.T === 'K5') return `ב־$${tri('ABC')}$ הקטע $CD$ מאונך ל־$AB$, ו־$D$ היא אמצע $AB$. $${ang('CAD')} = ${p.a}°$. מה גודל $${ang('ACB')}$?`;
  if (p.T === 'K1') return `בדלתון $ABCD$: $AB = AD$ ו־$CB = CD$. $${ang('BAC')} = ${p.a}°$, $${ang('BCA')} = ${p.c}°$. מה גודל $${ang(p.f === 'whole' ? 'BAD' : 'ADC')}$?`;
  if (p.f === 'x') return `הקטעים $AB$ ו־$CD$ נחתכים בנקודה $M$, ו־$AM = MB$, $CM = MD$. $${ang('ACM')} = (${exprTex(p.p, p.q)})°$, $${ang('MDB')} = ${p.th}°$, $${ang('MBD')} = ${p.ph}°$. מה $x$?`;
  return `הקטעים $AB$ ו־$CD$ נחתכים בנקודה $M$, ו־$AM = MB$, $CM = MD$. $${ang('CAM')} = ${p.a}°$, $${ang('AMC')} = ${p.c}°$. מה גודל $${ang('MDB')}$?`;
}
export function congr3Fig(p) {
  if (p.T === 'K5') return perpFig(p.a);
  if (p.T === 'K1') return kiteFig(p.a, p.c, { whole: p.f === 'whole', askD: p.f !== 'whole' });
  if (p.f === 'x') return crossFig(p.ph, 180 - p.th - p.ph, { C: { text: exprFig(p.p, p.q) }, D: { text: `${p.th}°` }, B: { text: `${p.ph}°` } });
  return crossFig(p.a, p.c, { A: { text: `${p.a}°` }, M: { text: `${p.c}°` }, D: { text: '?', target: true } });
}
export function congr3Solution(p) {
  if (p.T === 'K5') return [`$AD = DB$, $${ang('ADC')} = ${ang('BDC')} = 90°$ ו־$CD$ משותפת: $${tri('ADC')} \\cong ${tri('BDC')}$ לפי צ.ז.צ.`, `$${ang('ACD')} = 90° - ${p.a}° = ${90 - p.a}°$, וגם $${ang('BCD')} = ${90 - p.a}°$. לכן $${ang('ACB')} = 2 \\cdot ${90 - p.a}° = ${180 - 2 * p.a}°$`];
  if (p.T === 'K1' && p.f === 'whole') return [`$AC$ צלע משותפת, ולכן $${tri('ABC')} \\cong ${tri('ADC')}$ לפי צ.צ.צ, ו־$${ang('DAC')} = ${ang('BAC')} = ${p.a}°$.`, `$${ang('BAD')} = ${p.a}° + ${p.a}° = ${2 * p.a}°$`];
  if (p.T === 'K1') return [`$AC$ צלע משותפת, ולכן $${tri('ABC')} \\cong ${tri('ADC')}$ לפי צ.צ.צ.`, thirdOf(p, 'ABC', 'ADC', 'ABC')];
  if (p.f === 'x') return [`$${ang('AMC')} = ${ang('BMD')}$ (זוויות קודקודיות), ולכן $${tri('AMC')} \\cong ${tri('BMD')}$ לפי צ.ז.צ: $C$ מתאים ל־$D$.`, `$${ang('ACM')} = ${ang('BDM')}$: $${exprTex(p.p, p.q)} = ${p.th}$, ולכן $x = ${p.x}$`];
  return [`$${ang('AMC')} = ${ang('BMD')}$ (זוויות קודקודיות), ולכן $${tri('AMC')} \\cong ${tri('BMD')}$ לפי צ.ז.צ.`, thirdOf(p, 'AMC', 'MDB', 'MCA')];
}
export const congr3Hint = (p) => (p.T === 'K5' ? '$\\sphericalangle ACB$ בנויה משתי זוויות, אחת בכל משולש.'
  : p.T === 'K1' ? '$AC$ שייכת לשני המשולשים. אילו משולשים חופפים?' : 'אילו זוויות ב־$M$ שוות? אילו משולשים חופפים, ולאיזה קודקוד מתאים כל קודקוד?');
export const congr3TText = (p) => `לעפיפון צורה של דלתון $ABCD$: $AB = AD$, $CB = CD$. זווית הראש $${ang('BAD')} = ${2 * p.a}°$, והזווית $${ang('BCD')} = ${2 * p.c}°$. כמה מעלות $${ang('ABC')}$?`;
export function congr3TFig(p) {
  const f = kiteFig(p.a, p.c, { label: 'עפיפון בצורת דלתון ABCD' });
  const P = f.pts;
  return { ...f, angles: [innerAngle(P, 'A', 'B', 'D', { text: `${2 * p.a}°`, r: 26 }), innerAngle(P, 'C', 'D', 'B', { text: `${2 * p.c}°`, r: 26 }), innerAngle(P, 'B', 'A', 'C', { text: '?', target: true })] };
}
export const congr3TSolution = (p) => [`$AC$ משותפת, ולכן $${tri('ABC')} \\cong ${tri('ADC')}$ (צ.צ.צ): האלכסון חוצה את שתי הזוויות, $${p.a}°$ ו־$${p.c}°$.`, `$${ang('ABC')} = 180° - ${p.a}° - ${p.c}° = ${180 - p.a - p.c}°$`];

// ---------------------------------------------------------------- congr:4 figures and words
/**
 * A triangle with base BC on the line (C at 0, B at b, as the class draws it, right to left), D the middle of BC, the
 * height from A to H, DH = t on B's side (outside BC, beyond B, when t > b/2), and the median AD.
 */
export function medianFig({ b, h, t }, { labels = {}, label } = {}) {
  const D = [b / 2, 0]; const H = [b / 2 + t, 0];
  const P = { C: [0, 0], B: [b, 0], D, H, A: [H[0], h] };
  const segs = [
    { a: 'C', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 },
    { a: 'A', b: 'D', label: labels.AD },
    { a: 'A', b: 'H', dash: true, label: labels.AH },
    ...(H[0] > b + 1e-9 ? [{ a: 'B', b: 'H', dash: true }] : []),
  ];
  if (labels.BC != null) segs.push({ a: 'C', b: 'B', label: labels.BC, side: 'in' });
  // when the foot of the height falls next to B, their letters go to either side, so "B" and "H" never run together
  const close = Math.abs(H[0] - b) < 2.5;
  const side = H[0] > b ? 1 : -1;
  const fig = {
    type: 'geo', label: label || 'משולש ABC, התיכון AD לאמצע BC, והגובה AH',
    pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
    ...(close ? { lab: { B: [-12 * side, 16], H: [12 * side, 16] } } : {}),
    segs: segs.map((sg) => Object.fromEntries(Object.entries(sg).filter(([, v]) => v != null))),
    angles: [{ at: 'H', from: 'A', to: H[0] > b + 1e-9 ? 'B' : 'C', right: true }],
    view: [320, 200], pad: [28, 26],
  };
  return fig;
}
const givensOf = (p) => (p.f === 'area'
  ? inOrder([`$BC = ${p.b}$`, `$AH = ${p.h}$`, `$AD = ${p.m}$`], p.ord)
  : inOrder([`$BC = ${p.b}$`, `$AD = ${p.m}$`, `שטח $${tri('ABD')}$ הוא $${p.S}$`], p.ord));
const andList = (xs) => `${xs.slice(0, -1).join(', ')} ו־${xs[xs.length - 1]}`;
export const congr4Text = (p) => (p.f === 'area'
  ? `ב־$${tri('ABC')}$, $AD$ הוא התיכון לצלע $BC$ ו־$AH$ הוא הגובה. ${andList(givensOf(p))}. מה שטח $${tri('ABD')}$?`
  : `ב־$${tri('ABC')}$, $AD$ הוא התיכון לצלע $BC$. ${andList(givensOf(p))}. מה אורך הגובה $AH$ מ־$A$ ל־$BC$?`);
// BC is given in the text and not written on the base: at its middle the number would sit on D, and read as a part of it
export const congr4Fig = (p) => medianFig(p, { labels: p.f === 'area' ? { AH: String(p.h), AD: String(p.m) } : { AD: String(p.m), AH: '?' } });
export const congr4Solution = (p) => (p.f === 'area'
  ? [`$D$ אמצע $BC$, ולכן $BD = ${p.b / 2}$.`, `הגובה של $${tri('ABD')}$ הוא $AH = ${p.h}$, ולא התיכון.`, `$\\frac{${p.b / 2} \\cdot ${p.h}}{2} = ${(p.b * p.h) / 4}$`]
  : [`הבסיס של $${tri('ABD')}$ הוא $BD = ${p.b / 2}$, חצי מ־$BC$.`, `$\\frac{${p.b / 2} \\cdot AH}{2} = ${p.S}$, ולכן $AH = ${p.h}$`]);
export const congr4Hint = (p) => (p.f === 'area' ? 'לחצי המשולש בסיס $BD$, חצי מ־$BC$, והגובה הוא $AH$.' : 'הבסיס של $\\triangle ABD$ הוא $BD$, חצי מ־$BC$. שטח משולש: בסיס כפול גובה, לחלק ל־$2$.');
export const congr4TText = (p) => (p.story
  ? `שביל ישר באורך $${p.m}$ מטר יוצא מהפינה $A$ של חלקה משולשת $ABC$ אל אמצע הגדר $BC$, ומחלק את החלקה בין שתי משפחות. אורך הגדר $${p.b}$ מטר, והמרחק מ־$A$ אל הגדר $${p.h}$ מטר. מה השטח של החלק של כל משפחה, במ״ר?`
  : `לחלקה משולשת $ABC$ גדר $BC$ באורך $${p.b}$ מטר, והמרחק מ־$A$ אל הגדר $${p.h}$ מטר. שביל ישר מ־$A$ לאמצע הגדר, באורך $${p.m}$ מטר, מחלק את החלקה בין שתי משפחות. מה השטח של החלק של כל משפחה, במ״ר?`);
// the story names no H: the foot of the distance is drawn, its letter is not
export const congr4TFig = (p) => ({ ...medianFig(p, { labels: { AH: String(p.h), AD: String(p.m) }, label: 'חלקה משולשת ABC, השביל AD לאמצע הגדר BC, והמרחק מ־A אל הגדר' }), hide: ['H'] });
export const congr4TSolution = (p) => [`השביל הוא תיכון: הוא מחלק את $BC$ לשני חלקים של $${p.b / 2}$ מטר.`, `לכל חלק בסיס $${p.b / 2}$ וגובה $${p.h}$: $\\frac{${p.b / 2} \\cdot ${p.h}}{2} = ${(p.b * p.h) / 4}$`];

// ---------------------------------------------------------------- generators: a model's draw as a practice item
/** An item from a model's draw: the bug a wrong answer equals names the mistake. */
function modelGen(key, model, p, words) {
  return {
    key, text: words.text(p), form: 'num', answer: model.answer(p), fig: words.fig(p),
    hint: words.hint(p), solution: words.solution(p),
    // every mistake whose prediction the answer is: two that predict the same number are both named (PRODUCT2-15)
    diag: (u) => {
      const ids = Object.keys(model.bugs).filter((id) => { const v = model.bugs[id](p); return v != null && Number.isFinite(u) && near(u, v); });
      return ids.length > 1 ? ids : ids[0] || null;
    },
  };
}
const keyOf = (prefix, p) => `${prefix}:${Object.entries(p).filter(([k]) => k !== 'ord').map(([, v]) => v).join(':')}${p.ord ? `:${p.ord.join('')}` : ''}`;

// ---------------------------------------------------------------- congr:1 generators
/** The angle through the congruence (the model's draws). */
function angleVia() {
  const p = CONGR1.params(rnd);
  return modelGen(keyOf('cg1a', p), CONGR1, p, { text: congr1Text, fig: (q) => congrFig(q), hint: congr1Hint, solution: congr1Solution });
}
/**
 * A side through the congruence: AB = ax + b and the three sides of the second triangle in a shuffled order (the one
 * that matches AB is not always the first after the expression); the second triangle's letters so the alphabet pairs AB
 * with another side ('alpha-order').
 */
function sideX() {
  for (;;) {
    const x = rint(rnd, 2, 9); const a = rint(rnd, 2, 5); const b = rint(rnd, -6, 6); if (b === 0) continue;
    const s1 = a * x + b; const s2 = rint(rnd, 4, 20); const s3 = rint(rnd, 4, 20);
    if (s1 <= 0 || new Set([s1, s2, s3]).size < 3) continue;
    const [u, v, w] = [s1, s2, s3].sort((m, n) => m - n); if (u + v <= w) continue;
    // drawn true to scale: no needle (the shortest side at least a third of the longest), so the letters stay apart
    if (u < w / 3) continue;
    // the numbers printed, b also without its sign (AB = 5x − 6 shows a 6)
    const pr = [a, b, Math.abs(b), s1, s2, s3]; if (pr.includes(x) || (s2 - b) / a === x) continue;
    const set = pick(rnd, SECOND);
    // A, B, C go with set[i0], set[i1], set[i2]: the alphabet's partner of AB (set[0]set[1]) is another side
    const perm = pick(rnd, [[1, 2, 0], [2, 0, 1], [2, 1, 0], [0, 2, 1]]).map((i) => set[i]);
    const partner = { A: perm[0], B: perm[1], C: perm[2] };
    const sides = [[`${partner.A}${partner.B}`, s1], [`${partner.B}${partner.C}`, s2], [`${partner.A}${partner.C}`, s3]];
    const shown = shuffle(sides);
    const alphaSide = sides.find(([n]) => [...n].sort().join('') === `${set[0]}${set[1]}`);
    const bug = alphaSide && alphaSide[1] !== s1 ? r9((alphaSide[1] - b) / a) : null;
    if (bug == null || pr.includes(bug) || Math.abs(bug - x) <= 1) continue;
    const name = `${partner.A}${partner.B}${partner.C}`;
    return {
      key: `cg1x:${a}:${b}:${s1}:${s2}:${s3}:${name}`,
      text: `$${tri('ABC')} \\cong ${tri(name)}$ (לפי סדר הקודקודים). $AB = ${exprTex(a, b)}$ ס״מ, ${shown.map(([n, v]) => `$${n} = ${v}$ ס״מ`).join(', ')}. מה $x$?`,
      form: 'num', answer: x,
      // drawn true from the three sides, AB with its expression and the second triangle with its lengths
      fig: twoTriangles({
        angs: anglesOfSides(s1, s2, s3), partner, top: 'A', left: 'B', label: `שני משולשים חופפים: ABC ו־${name}`,
        sides: { AB: `${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}`, [`${partner.A}${partner.B}`]: String(s1), [`${partner.B}${partner.C}`]: String(s2), [`${partner.A}${partner.C}`]: String(s3) },
      }),
      hint: `$A$ ו־$B$ הם הראשון והשני ב־$${tri('ABC')}$. מי הראשון והשני ב־$${tri(name)}$?`,
      solution: [`$AB$ מתאימה ל־$${partner.A}${partner.B}$: הראשון והשני בכל משולש.`, `$${exprTex(a, b)} = ${s1}$, ולכן $${a}x = ${s1 - b}$ ו־$x = ${x}$`],
      diag: (uu) => (bug != null && near(uu, bug) ? 'alpha-order' : null),
    };
  }
}
/** The angles of a triangle with sides AB = c, BC = a, CA = b (the law of cosines), in degrees. */
function anglesOfSides(c, a, b) {
  const at = (opp, s1, s2) => (Math.acos((s1 * s1 + s2 * s2 - opp * opp) / (2 * s1 * s2)) * 180) / Math.PI;
  return { A: at(a, b, c), B: at(b, a, c), C: at(c, a, b) };
}
/**
 * Two triangles marked by ticks only, no statement: the angle of the second that matches the first's third angle,
 * found by the ticks of the side opposite it. Practice only: its answer is always 180° minus the two printed angles.
 */
function ticks() {
  const p = CONGR1.params(rnd);
  if (p.form !== 'third') return ticks();
  const L = thirdLetters(p);
  const fig = twoTriangles({
    angs: { A: p.al, B: p.be, C: p.ga }, partner: L.partner, top: L.top, left: L.left, ticks: { AB: 1, BC: 2, CA: 3 },
    marks: { A: { text: `${p.al}°` }, B: { text: `${p.be}°` }, [L.asked]: { text: '?', target: true } },
    label: `שני משולשים: ABC ו־${nameOf(L.partner)}. צלעות שוות מסומנות באותו מספר קווים`,
  });
  return {
    key: `cg1t:${p.al}:${p.be}:${p.alpha}`, text: `במשולשים הצלעות המסומנות באותו מספר קווים שוות. $${ang('A')} = ${p.al}°$, $${ang('B')} = ${p.be}°$. מה גודל $${ang(L.asked)}$?`,
    form: 'num', practiceOnly: true, answer: p.ga, fig,
    hint: `מול $${ang(L.asked)}$ יש צלע עם כמה קווים? איזו זווית ב־$${tri('ABC')}$ מונחת מול הצלע עם אותו מספר קווים?`,
    solution: [`מול $${ang(L.asked)}$ הצלע $${L.partner.A}${L.partner.B}$ עם קו אחד, כמו $AB$ שמול $C$: $${L.asked} \\leftrightarrow C$.`, `$${ang('C')} = 180° - ${p.al}° - ${p.be}° = ${p.ga}°$`],
    diag: (u) => (near(u, BUGS12['match-by-place'](p)) ? 'match-by-place' : near(u, 180 - p.al) || near(u, 180 - p.be) ? 'one-angle' : near(u, BUGS12['alpha-order'](p)) ? 'alpha-order' : null),
  };
}
/** Which side is equal to a side: the matching one, the alphabet's pair, another side, "cannot tell". Practice only. */
function pairsMc() {
  for (;;) {
    const set = pick(rnd, SECOND);
    const perm = pick(rnd, [[2, 1, 0], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2]]).map((i) => set[i]);
    const partner = { A: perm[0], B: perm[1], C: perm[2] };
    const alpha = { A: set[0], B: set[1], C: set[2] };
    const [s, t] = pick(rnd, [['A', 'B'], ['B', 'C'], ['A', 'C']]);
    const right = `${partner[s]}${partner[t]}`;
    const alphaSide = `${alpha[s]}${alpha[t]}`;
    const same = (u, v) => [...u].sort().join('') === [...v].sort().join('');
    if (same(right, alphaSide)) continue;
    const other = [[partner.A, partner.B], [partner.B, partner.C], [partner.A, partner.C]].map((x) => x.join('')).find((n) => !same(n, right) && !same(n, alphaSide));
    // the three sides in a shuffled order, "cannot tell" last
    const choices = [...shuffle([
      { tex: right, ok: true },
      { tex: [...alphaSide].reverse().join(''), ok: false, bug: 'alpha-order' },
      { tex: other, ok: false, bug: 'wrong-pair' },
    ]), { text: 'אי אפשר לדעת', ok: false }];
    const name = nameOf(partner);
    return {
      key: `cg1p:${name}:${s}${t}`, text: `$${tri('ABC')} \\cong ${tri(name)}$. איזו צלע שווה ל־$${s}${t}$?`,
      form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((c) => c.ok),
      hint: `$${s}$ מתאים לקודקוד שבאותו מקום בכתיבה של $${tri(name)}$, וכך גם $${t}$.`,
      solution: [`$${s} \\leftrightarrow ${partner[s]}$ ו־$${t} \\leftrightarrow ${partner[t]}$, ולכן $${s}${t} = ${right}$.`],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- congr:2 generators
function matchData() {
  const p = CONGR2.params(rnd);
  return modelGen(keyOf('cg2m', p), CONGR2, p, { text: congr2Text, fig: congr2Fig, hint: congr2Hint, solution: congr2Solution });
}
const THM_CHOICES = ['חופפים לפי צ.ז.צ', 'חופפים לפי ז.צ.ז', 'חופפים לפי צ.צ.צ', 'אין מספיק נתונים'];
/**
 * The SSA case that is truly ambiguous: AB = c, ∢A = al, BC = a shorter than AB and longer than the height from B, so
 * the arc of radius a about B meets the ray from A twice (C1 near A, C2 far). Returns both triangles' C.
 */
export function ssaPoints(c, al, a) {
  const h = c * Math.sin(rad(al)); const base = c * Math.cos(rad(al)); const k = Math.sqrt(a * a - h * h);
  return [base - k, base + k].map((s) => [s * Math.cos(rad(al)), s * Math.sin(rad(al))]);
}
/**
 * Which theorem, if any: two marked triangles and the data in letters. SAS, ASA, AAS (the third angle first: ז.צ.ז),
 * SSS are congruent (the drawing a congruent pair); SSA is always the ambiguous case (the angle opposite the shorter of
 * the two sides, drawn as the two different triangles it allows); AAA two sizes; two sides only. Practice only.
 */
function whichThm() {
  const kind = pick(rnd, ['sas', 'asa', 'aas', 'sss', 'ssa', 'aaa', 'ss']);
  const set = pick(rnd, SECOND); const [K, L, M] = set; const partner = { A: K, B: L, C: M };
  const t = (() => { for (;;) { const x = angle3(rnd); if (x) return x; } })();
  const angs = { A: t.al, B: t.be, C: t.ga };
  const eqS = (s) => `$${s} = ${[...s].map((v) => partner[v]).join('')}$`;
  const eqA = (v) => `$${ang(v)} = ${ang(partner[v])}$`;
  const DATA = {
    sas: [eqS('AB'), eqA('B'), eqS('BC')], asa: [eqA('A'), eqS('AB'), eqA('B')], aas: [eqA('A'), eqA('B'), eqS('BC')],
    sss: [eqS('AB'), eqS('BC'), eqS('CA')], ssa: [eqS('AB'), eqS('BC'), eqA('A')], aaa: [eqA('A'), eqA('B'), eqA('C')], ss: [eqS('AB'), eqS('BC')],
  };
  const answer = { sas: 0, asa: 1, aas: 1, sss: 2 }[kind] ?? 3;
  let fig;
  if (kind === 'ssa' || kind === 'aaa' || kind === 'ss') fig = notCongruentFig(kind, angs, set);
  else {
    const marks = {};
    const tk = {};
    if (kind === 'sas') { tk.AB = 1; tk.BC = 2; marks.B = { n: 1 }; marks[L] = { n: 1 }; }
    if (kind === 'asa') { tk.AB = 1; marks.A = { n: 1 }; marks[K] = { n: 1 }; marks.B = { n: 2 }; marks[L] = { n: 2 }; }
    if (kind === 'aas') { tk.BC = 1; marks.A = { n: 1 }; marks[K] = { n: 1 }; marks.B = { n: 2 }; marks[L] = { n: 2 }; }
    if (kind === 'sss') { tk.AB = 1; tk.BC = 2; tk.CA = 3; }
    const { top, left } = placeAway(pick(rnd, ['A', 'B', 'C']), rint(rnd, 0, 5));
    fig = twoTriangles({ angs, partner, top, left, ticks: tk, marks });
  }
  const tag = kind === 'ssa' ? 'ssa' : kind === 'aaa' ? 'aaa' : null;
  const choices = THM_CHOICES.map((text, i) => ({ text, ok: i === answer, bug: i !== 3 && tag ? tag : undefined }));
  const why = {
    sas: 'שתי צלעות והזווית שביניהן: צ.ז.צ.', asa: 'שתי זוויות והצלע שביניהן: ז.צ.ז.',
    aas: 'גם הזווית השלישית שווה (סכום הזוויות $180°$), ועכשיו הצלע $BC$ כלואה בין שתי זוויות שוות: ז.צ.ז.',
    sss: 'שלוש צלעות שוות: צ.צ.צ.', ssa: 'הזווית $\\sphericalangle A$ אינה בין $AB$ ל־$BC$: יש שני משולשים שונים עם הנתונים האלה.',
    aaa: 'שלוש זוויות שוות קובעות צורה, לא גודל: משולש קטן וגדול.', ss: 'שתי צלעות לבד לא קובעות את הצלע השלישית.',
  }[kind];
  return {
    key: `cg2w:${kind}:${set.join('')}:${t.al}:${t.be}`, text: `במשולשים $ABC$ ו־$${set.join('')}$: ${DATA[kind].join(', ')}. האם המשולשים חופפים? לפי איזה משפט?`,
    form: 'mc', practiceOnly: true, choices, answer, fig,
    hint: 'מה בין מה? בצ.ז.צ הזווית בין שתי הצלעות, בז.צ.ז הצלע בין שתי הזוויות.',
    solution: [why],
    diag: (u) => choices[u]?.bug || null,
  };
}
/** The pairs that are not congruent: SSA's two triangles, AAA's two sizes, two sides with different third sides. */
function notCongruentFig(kind, angs, set) {
  const [K, L, M] = set;
  if (kind === 'ssa') {
    // AB = 5, ∢A = 40°, BC = 3.9 (shorter than AB, longer than the height 3.21): the two triangles of the compass
    const c = 5; const al = 40; const a = 3.9; const [C1, C2] = ssaPoints(c, al, a);
    const off = 6.6;
    const P = { A: [0, 0], B: [c, 0], C: C2, [K]: [off, 0], [L]: [off + c, 0], [M]: [off + C1[0], C1[1]] };
    return {
      type: 'geo', label: `שני משולשים שונים: ABC ו־${set.join('')}. AB ו־${K}${L} מסומנות שוות, BC ו־${L}${M} מסומנות שוות, והזוויות ב־A וב־${K} שוות`,
      pts: P, polys: [{ pts: ['A', 'B', 'C'] }, { pts: [K, L, M] }],
      segs: [{ a: 'A', b: 'B', ticks: 1 }, { a: K, b: L, ticks: 1 }, { a: 'B', b: 'C', ticks: 2 }, { a: L, b: M, ticks: 2 }],
      angles: [innerAngle(P, 'A', 'B', 'C', { n: 1 }), innerAngle(P, K, L, M, { n: 1 })], view: [320, 170], pad: [26, 26],
    };
  }
  if (kind === 'aaa') {
    const A = triFromAngles(angs.C, angs.B, 3.4); const k = 1.6;
    const off = Math.max(3.4, A[0]) + 1.4;
    const P = { C: [0, 0], B: [3.4, 0], A, [M]: [off, 0], [L]: [off + 3.4 * k, 0], [K]: [off + A[0] * k, A[1] * k] };
    const nb = { A: ['B', 'C'], B: ['A', 'C'], C: ['A', 'B'], [K]: [L, M], [L]: [K, M], [M]: [K, L] };
    const marks = [['A', 1], ['B', 2], ['C', 3], [K, 1], [L, 2], [M, 3]].map(([v, n]) => innerAngle(P, v, ...nb[v], { n }));
    return { type: 'geo', label: `משולש קטן ABC ומשולש גדול ${set.join('')} עם אותן שלוש זוויות`, pts: P, polys: [{ pts: ['A', 'B', 'C'] }, { pts: [K, L, M] }], angles: marks, view: [320, 180], pad: [26, 26] };
  }
  // two equal sides, the angle between them different (70° and 110° at B and at its partner): the third sides differ
  const A = triFromAngles(55, 70, 4); const c = dist(A, [4, 0]);
  const off = 5.6; const phi = rad(110);
  const P = { C: [0, 0], B: [4, 0], A, [M]: [off, 0], [L]: [off + 4, 0], [K]: [off + 4 - c * Math.cos(phi), c * Math.sin(phi)] };
  return {
    type: 'geo', label: `שני משולשים: ABC ו־${set.join('')}. AB ו־${K}${L} מסומנות שוות, וגם BC ו־${L}${M}`,
    pts: P, polys: [{ pts: ['A', 'B', 'C'] }, { pts: [K, L, M] }], view: [320, 170], pad: [26, 26],
    segs: [{ a: 'A', b: 'B', ticks: 1 }, { a: K, b: L, ticks: 1 }, { a: 'B', b: 'C', ticks: 2 }, { a: L, b: M, ticks: 2 }],
  };
}
/** What else is needed for צ.ז.צ: the angle between the two equal sides, not another one (ssa). Practice only. */
function whatMissing() {
  const set = pick(rnd, SECOND); const partner = { A: set[0], B: set[1], C: set[2] };
  const at = pick(rnd, ['A', 'B', 'C']);
  const sides = [['A', 'B'], ['B', 'C'], ['C', 'A']].filter((s) => s.includes(at));
  const others = ['A', 'B', 'C'].filter((v) => v !== at);
  const choices = shuffle([
    { tex: `${ang(at)} = ${ang(partner[at])}`, ok: true },
    ...others.map((v) => ({ tex: `${ang(v)} = ${ang(partner[v])}`, ok: false, bug: 'ssa' })),
  ]);
  const t = (() => { for (;;) { const x = angle3(rnd); if (x) return x; } })();
  const fig = twoTriangles({ angs: { A: t.al, B: t.be, C: t.ga }, partner, top: 'A', left: 'B', ticks: { [sides[0].join('')]: 1, [sides[1].join('')]: 2 } });
  return {
    key: `cg2n:${set.join('')}:${at}:${t.al}:${t.be}`,
    text: `$${sides[0].join('')} = ${sides[0].map((v) => partner[v]).join('')}$, $${sides[1].join('')} = ${sides[1].map((v) => partner[v]).join('')}$. מה עוד צריך כדי שהמשולשים יהיו חופפים לפי צ.ז.צ?`,
    form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((c) => c.ok), fig,
    hint: 'בצ.ז.צ הזווית כלואה בין שתי הצלעות. באיזה קודקוד הן נפגשות?',
    solution: [`הצלעות $${sides[0].join('')}$ ו־$${sides[1].join('')}$ נפגשות ב־$${at}$: הזווית ביניהן היא $${ang(at)}$.`],
    diag: (u) => choices[u]?.bug || null,
  };
}
/** Pairs of triangles with the same perimeter and different sides. */
const SAME_PERIMETER = [[[5, 6, 7], [4, 6, 8]], [[4, 5, 6], [3, 5, 7]], [[6, 6, 6], [5, 6, 7]], [[3, 4, 5], [2, 5, 5]], [[5, 5, 8], [6, 6, 6]], [[4, 7, 7], [5, 6, 7]]];
/** Two triangles with the same perimeter: congruent? Practice only. */
function samePerimeter() {
  const [s, t] = pick(rnd, SAME_PERIMETER);
  const per = s[0] + s[1] + s[2];
  const P1 = triPts(s, 0); const P2 = triPts(t, Math.max(...P1.map((p) => p[0])) + 1.4);
  const choices = shuffle([{ text: 'לא בהכרח', ok: true }, { text: 'כן', ok: false, bug: 'equal-perimeter' }]);
  return {
    key: `cg2p:${s.join(',')}:${t.join(',')}`, text: `לשני משולשים אותו היקף, $${per}$. הם חופפים?`,
    form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((c) => c.ok),
    fig: {
      type: 'geo', label: `משולש עם צלעות ${s.join(', ')} ומשולש עם צלעות ${t.join(', ')}`,
      pts: { _a: P1[0], _b: P1[1], _c: P1[2], _d: P2[0], _e: P2[1], _f: P2[2] },
      polys: [{ pts: ['_a', '_b', '_c'] }, { pts: ['_d', '_e', '_f'] }],
      segs: [{ a: '_a', b: '_b', label: String(s[0]) }, { a: '_b', b: '_c', label: String(s[1]) }, { a: '_c', b: '_a', label: String(s[2]) },
        { a: '_d', b: '_e', label: String(t[0]) }, { a: '_e', b: '_f', label: String(t[1]) }, { a: '_f', b: '_d', label: String(t[2]) }],
      view: [320, 170], pad: [28, 26],
    },
    hint: 'חופפים אם אפשר להניח אחד על השני בדיוק: כל הצלעות שוות בזוגות.',
    solution: [`לשניהם היקף $${per}$, אבל הצלעות $${s.join(', ')}$ ו־$${t.join(', ')}$ שונות: הם לא חופפים.`],
    diag: (u) => choices[u]?.bug || null,
  };
}
/** A triangle with sides s[0] (the base, from x0), s[1] and s[2], drawn true. */
function triPts(s, x0) {
  const [c, a, b] = s; // base c from (x0, 0) to (x0 + c, 0); a from the right end, b from the left
  const x = (b * b - a * a + c * c) / (2 * c); const y = Math.sqrt(Math.max(0, b * b - x * x));
  return [[x0, 0], [x0 + c, 0], [x0 + x, y]];
}

// ---------------------------------------------------------------- congr:3 generators
function useCong() {
  const p = CONGR3.params(rnd);
  return modelGen(keyOf('cg3u', p), CONGR3, p, { text: congr3Text, fig: congr3Fig, hint: congr3Hint, solution: congr3Solution });
}
/** The congruence templates of the unit (T1–T4), and the letter sets they are written in. */
const CONGR_TEMPLATES = ['T1', 'T2', 'T3', 'T4'];
/** Complete the missing reasons: the order locked, one or two reasons asked, every other row's reason shown. */
function proofFill() {
  const id = pick(rnd, CONGR_TEMPLATES); const set = rint(rnd, 0, 2);
  const T = proofIn(PROOF[id], set);
  const asked = T.steps.map((s, i) => (s.reason ? i : -1)).filter((i) => i >= 0);
  const keep = new Set(shuffle(asked).slice(0, rnd() < 0.5 ? 1 : Math.min(2, asked.length)));
  const steps = T.steps.map((s, i) => (keep.has(i) || !s.reason ? s : { text: s.text, fixed: s.reason.choices[s.reason.answer] }));
  const manip = { kind: 'proof', given: T.given, goal: T.goal, part: { prompt: 'השלימו את הנימוקים החסרים.', steps, free: T.free }, lockOrder: true, seed: `${id}:${set}:fill:${[...keep].join('')}`, fig: T.fig, tpl: id, set };
  return {
    key: `cg3f:${id}:${set}:${[...keep].sort().join('')}`, text: 'השלימו את הנימוקים החסרים בהוכחה.',
    form: 'manip', practiceOnly: true, manip,
    answer: proofSolution(manip),
    hint: 'לכל שורה: מאיפה אנחנו יודעים את זה? מהנתונים, משרטוט (צלע משותפת, זוויות קודקודיות), ממשפט, או מהחפיפה.',
    solution: steps.map((s, i) => `${i + 1}. ${s.text} — ${s.fixed ?? s.reason.choices[s.reason.answer]}`),
    // the order is locked: only another theorem on the congruence row can show (content/proofs.js proofDiag)
    diag: (u) => proofDiag(manip.part, u),
  };
}
/** Order the proof, and choose the theorem: the rows shuffled, every reason shown but the congruence row's. */
function proofOrder() {
  const id = pick(rnd, CONGR_TEMPLATES); const set = rint(rnd, 0, 2); const seed = rint(rnd, 1, 9999);
  const manip = proofManip(PROOF[id], { set, seed: String(seed), ask: 'theorem' });
  return {
    key: `cg3o:${id}:${set}:${seed}`, text: 'סדרו את ההוכחה, ובחרו לפי איזה משפט המשולשים חופפים.',
    form: 'manip', practiceOnly: true, manip,
    answer: proofSolution(manip),
    hint: 'קודם הנתונים ומה שרואים בשרטוט, אחר כך החפיפה, ובסוף מה שנובע ממנה.',
    solution: manip.part.steps.map((s, i) => `${i + 1}. ${s.text} — ${s.fixed ?? s.reason.choices[s.reason.answer]}`),
    // a conclusion above the congruence ('circular'), or another theorem chosen on it ('wrong-theorem')
    diag: (u) => proofDiag(manip.part, u),
  };
}
/**
 * The stair's mastery check asks two whole proofs (content/proofs.js checkProofItem; the council's round 3): a
 * congruence template (T1–T4) in a letter set, its rows shuffled, every reason asked: three at least, so a student who
 * knows the order and picks reasons at random is right once in 27.
 */
function proofCheck() {
  const id = pick(rnd, CONGR_TEMPLATES); const set = rint(rnd, 0, 2); const seed = rint(rnd, 1, 9999);
  return checkProofItem(PROOF[id], { key: `cg3c:${id}`, set, seed, text: 'סדרו את שורות ההוכחה, ובחרו נימוק לכל שורה.', rnd });
}
/** Each stair's mastery check: how many whole proofs it asks (`checkProofs`) and the generator of one (`proofGen`). */
export const CONGR_PROOF_CHECKS = { 2: { checkProofs: 2, proofGen: proofCheck } };
/**
 * Which row is wrong: a congruence row "לפי צ.ז.צ" on SSA data (the row passed over is 'ssa'), or a conclusion
 * placed above the congruence it follows from ('circular'). Practice only.
 */
function findError() {
  let rows; let wrong; let tag; let given; let goal; let key;
  if (rnd() < 0.5) {
    const set = pick(rnd, SECOND); const [K, L, M] = set;
    given = `במשולשים $ABC$ ו־$${set.join('')}$: $AB = ${K}${L}$, $BC = ${L}${M}$, $${ang('A')} = ${ang(K)}$.`;
    goal = `$AC = ${K}${M}$`;
    rows = [
      { claim: `$AB = ${K}${L}$`, reason: R.given }, { claim: `$BC = ${L}${M}$`, reason: R.given }, { claim: `$${ang('A')} = ${ang(K)}$`, reason: R.given },
      { claim: `$${tri('ABC')} \\cong ${tri(set.join(''))}$`, reason: R.sas }, { claim: `$AC = ${K}${M}$`, reason: R.sides },
    ];
    wrong = 3; tag = 'ssa'; key = `cg3e:ssa:${set.join('')}`;
  } else {
    const id = pick(rnd, CONGR_TEMPLATES); const set = rint(rnd, 0, 2);
    const T = proofIn(PROOF[id], set);
    const reasonOf = (s) => (s.fixed != null ? s.fixed : s.reason.choices[s.reason.answer]);
    const all = T.steps.map((s) => ({ claim: s.text, reason: reasonOf(s) }));
    const last = all[all.length - 1]; const at = rint(rnd, 0, 1);
    rows = [...all.slice(0, at), last, ...all.slice(at, -1)];
    given = T.given; goal = T.goal; wrong = at; tag = 'circular'; key = `cg3e:${id}:${set}:${at}`;
  }
  const choices = rows.map((_, i) => ({ text: `שורה ${i + 1}`, ok: i === wrong, bug: i === wrong ? undefined : tag }));
  return {
    key, text: 'איזו שורה בהוכחה שגויה?', form: 'mc', practiceOnly: true, choices, answer: wrong,
    fig: { type: 'proof', given, goal, rows },
    hint: tag === 'ssa' ? 'בדקו בשורת החפיפה: איפה הזווית ביחס לשתי הצלעות?' : 'מסקנה מחפיפה יכולה לבוא רק אחרי שורת החפיפה.',
    solution: [tag === 'ssa' ? `שורה ${wrong + 1}: הזווית $${ang('A')}$ אינה בין $AB$ ל־$BC$, ולכן זה לא צ.ז.צ. שתי צלעות וזווית שאינה ביניהן לא מספיקות.` : `שורה ${wrong + 1}: "${R.sides}" או "${R.angles}" מותר רק אחרי שהוכחנו שהמשולשים חופפים.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- congr:4 generators
function medArea() {
  const p = CONGR4.params(rnd);
  return modelGen(keyOf('cg4a', p), CONGR4, p, { text: congr4Text, fig: congr4Fig, hint: congr4Hint, solution: congr4Solution });
}
/** The perimeter of half a triangle cut by a median: AB, AC, BC, AD in a shuffled order (Apollonius: true medians). */
function medPerim() {
  const q = pick(rnd, MEDIANS); const ord = order(rnd, 4);
  const ans = q.p + q.r / 2 + q.m;
  const givens = inOrder([`$AB = ${q.p}$`, `$AC = ${q.q}$`, `$BC = ${q.r}$`, `$AD = ${q.m}$`], ord);
  // the triangle drawn true: C (0, 0), B (r, 0), A from AB = p and AC = q
  const ax = (q.q * q.q - q.p * q.p + q.r * q.r) / (2 * q.r); const ay = Math.sqrt(q.q * q.q - ax * ax);
  const P = { C: [0, 0], B: [q.r, 0], A: [ax, ay], D: [q.r / 2, 0] };
  return {
    key: `cg4p:${q.p}:${q.q}:${q.r}:${q.m}:${ord.join('')}`, text: `$AD$ הוא התיכון לצלע $BC$. ${andList(givens)}. מה ההיקף של $${tri('ABD')}$?`,
    form: 'num', answer: ans,
    fig: {
      type: 'geo', label: 'משולש ABC והתיכון AD לאמצע BC', pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
      segs: [{ a: 'A', b: 'B', label: String(q.p) }, { a: 'A', b: 'C', label: String(q.q) }, { a: 'C', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }, { a: 'A', b: 'D', label: String(q.m) }, { a: 'C', b: 'B', label: String(q.r), side: 'in', thin: true }],
      view: [320, 200], pad: [28, 26],
    },
    hint: 'ההיקף של $\\triangle ABD$: $AB$, $AD$, והחצי $BD$ של $BC$.',
    solution: [`$D$ אמצע $BC$, ולכן $BD = ${q.r / 2}$.`, `$${q.p} + ${q.r / 2} + ${q.m} = ${ans}$`],
    diag: (u) => (near(u, q.p + q.r + q.m) ? 'full-side' : null),
  };
}
/** A rectangle, its diagonal AC, and the median AE of △ABC to BC: the area of △ABE (AB, BC, AC shuffled). */
function rectMedian() {
  const [a, b, c] = pick(rnd, RECT_TRIPLES); const ord = order(rnd, 3);
  const givens = inOrder([`$AB = ${a}$`, `$BC = ${b}$`, `$AC = ${c}$`], ord);
  const P = { A: [b, a], B: [b, 0], C: [0, 0], D: [0, a], E: [b / 2, 0] };
  return {
    key: `cg4r:${a}:${b}:${c}:${ord.join('')}`,
    text: `במלבן $ABCD$ האלכסון $AC$, ו־$AE$ הוא התיכון ב־$${tri('ABC')}$ לצלע $BC$. ${andList(givens)}. מה שטח $${tri('ABE')}$?`,
    form: 'num', answer: (a * b) / 4,
    fig: {
      type: 'geo', label: 'מלבן ABCD, האלכסון AC והתיכון AE לאמצע BC', pts: P, polys: [{ pts: ['A', 'B', 'C', 'D'] }],
      segs: [{ a: 'A', b: 'B', label: String(a) }, { a: 'C', b: 'B', label: String(b) }, { a: 'A', b: 'C', label: String(c), thin: true }, { a: 'A', b: 'E' }, { a: 'C', b: 'E', ticks: 1 }, { a: 'E', b: 'B', ticks: 1 }],
      angles: [{ at: 'B', from: 'A', to: 'C', right: true }],
      view: [320, 210], pad: [28, 26],
    },
    hint: 'במשולש $ABE$ הזווית ב־$B$ ישרה: הניצבים $AB$ ו־$BE$, חצי מ־$BC$.',
    solution: [`$E$ אמצע $BC$, ולכן $BE = ${b / 2}$.`, `$\\frac{${a} \\cdot ${b / 2}}{2} = ${(a * b) / 4}$`],
    diag: (u) => (near(u, (a * b) / 2) ? 'full-base' : null),
  };
}
/** Which segment from A is the median (or the altitude, or the bisector): a scalene triangle with all three. */
function whichSeg() {
  for (;;) {
    // 14 of angle3's triangles keep the three feet at least 0.55 apart (a tenth of BC), inside BC
    const t = angle3(rnd); if (!t) continue;
    const A = triFromAngles(t.ga, t.be, 6);
    const C = [0, 0]; const B = [6, 0];
    const Hp = [A[0], 0]; const Mp = [3, 0];
    const lenAB = Math.hypot(A[0] - 6, A[1]); const lenAC = Math.hypot(A[0], A[1]);
    const Kp = [6 * lenAC / (lenAB + lenAC), 0]; // the bisector meets BC dividing it as AC : AB from C
    const xs = [Hp[0], Mp[0], Kp[0]].sort((x, y) => x - y);
    if (xs[1] - xs[0] < 0.55 || xs[2] - xs[1] < 0.55 || xs[0] < 0.6 || xs[2] > 5.4) continue;
    const names = shuffle(['E', 'F', 'G']);
    const [nH, nM, nK] = names;
    const asked = pick(rnd, ['median', 'altitude', 'bisector']);
    const right = { median: nM, altitude: nH, bisector: nK }[asked];
    const P = { A, B, C, [nH]: Hp, [nM]: Mp, [nK]: Kp };
    const choices = ['E', 'F', 'G'].map((n) => ({ tex: `A${n}`, ok: n === right, bug: n === right ? undefined : 'median-altitude' }));
    const word = { median: 'התיכון', altitude: 'הגובה', bisector: 'חוצה הזווית' }[asked];
    return {
      key: `cg4s:${asked}:${t.al}:${t.be}:${names.join('')}`, text: `איזה קטע הוא ${word} מ־$A$ ל־$BC$?`,
      form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((c) => c.ok),
      fig: {
        type: 'geo', label: `משולש ABC ושלושה קטעים מ־A ל־BC: A${nH} מאונך ל־BC, A${nK} חוצה את הזווית A, ו־${nM} אמצע BC`,
        pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
        segs: [{ a: 'A', b: nH }, { a: 'A', b: nM }, { a: 'A', b: nK }, { a: 'C', b: nM, ticks: 1 }, { a: nM, b: 'B', ticks: 1 }],
        angles: [{ at: nH, from: 'A', to: Hp[0] < 3 ? 'B' : 'C', right: true }, innerAngle(P, 'A', 'C', nK, { n: 1, r: 34 }), innerAngle(P, 'A', nK, 'B', { n: 1, r: 34 })],
        view: [320, 210], pad: [28, 26],
      },
      hint: 'תיכון מגיע לאמצע הצלע, גובה מאונך לה, וחוצה זווית חוצה את הזווית.',
      solution: [{ median: `$${nM}$ אמצע $BC$ (הסימונים): $A${nM}$ הוא התיכון.`, altitude: `$A${nH}$ מאונך ל־$BC$: הוא הגובה.`, bisector: `$A${nK}$ מחלק את $${ang('A')}$ לשתי זוויות שוות: הוא חוצה הזווית.` }[asked]],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}
/** A claim about a median: true or not necessarily. Practice only. */
const CLAIMS = [
  { text: 'התיכון מחלק את המשולש לשני משולשים חופפים.', ok: false, tag: 'median-congruent', why: 'השטחים שווים, אבל אם $AB \\ne AC$ הצלעות של שני החלקים שונות, ולכן הם לא חופפים.' },
  { text: 'התיכון מחלק את המשולש לשני משולשים שווי שטח.', ok: true, why: 'לשני החלקים בסיסים שווים, חצי מ־$BC$, ואותו גובה מ־$A$.' },
  { text: 'לשני המשולשים שהתיכון יוצר יש אותו היקף.', ok: false, tag: 'median-congruent', why: '$BD = DC$ ו־$AD$ משותף, אבל $AB$ ו־$AC$ יכולות להיות שונות: ההיקפים שונים.' },
];
function claims() {
  const c = pick(rnd, CLAIMS);
  const choices = shuffle([{ text: 'נכון תמיד', ok: c.ok, bug: c.ok ? undefined : c.tag }, { text: 'לא בהכרח', ok: !c.ok }]);
  const A = triFromAngles(48, 72, 6);
  return {
    key: `cg4c:${CLAIMS.indexOf(c)}`, text: `$AD$ תיכון ב־$${tri('ABC')}$. ${c.text}`,
    form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((x) => x.ok),
    fig: { type: 'geo', label: 'משולש ABC והתיכון AD', pts: { A, B: [6, 0], C: [0, 0], D: [3, 0] }, polys: [{ pts: ['A', 'B', 'C'] }], segs: [{ a: 'A', b: 'D' }, { a: 'C', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }], view: [300, 190], pad: [28, 26] },
    hint: 'מה התיכון חוצה: את הצלע, את השטח, או את כל הצורה?',
    solution: [c.why],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- congr:5 the sides of a triangle
/**
 * congr:5 — two sides a ≠ b, the third a whole number: how many lengths can it have. It lies strictly between |a − b|
 * and a + b, so 2·min − 1 lengths (models.mjs congr5, unchanged).
 */
export const CONGR5 = mk({
  raw: (r) => { const a = rint(r, 3, 20); const b = rint(r, 3, 20); if (a === b) return null; return { a, b }; },
  answer: ({ a, b }) => 2 * Math.min(a, b) - 1,
  bugs: {
    'sum-equal': ({ a, b }) => 2 * Math.min(a, b) + 1, // both ends allowed: the flat "triangles" counted
    'no-lower-limit': ({ a, b }) => a + b - 1, // only "shorter than the sum" checked: 1 to a + b − 1
  },
  printed: ({ a, b }) => [a, b],
});
/** congr:5 transfer: two sticks, and a third one for a triangular frame (the same draw). */
export const CONGR5T = mk({ raw: CONGR5.raw, answer: CONGR5.answer, bugs: CONGR5.bugs, printed: CONGR5.printed });
export const congr5Text = ({ a, b }) => `במשולש שתי צלעות באורך $${a}$ ס״מ ו־$${b}$ ס״מ. אורך הצלע השלישית הוא מספר שלם של סנטימטרים. כמה אורכים שונים היא יכולה להיות?`;
export const congr5TText = ({ a, b }) => `לדנה שני מקלות, $${a}$ ס״מ ו־$${b}$ ס״מ. היא רוצה מקל שלישי, באורך שלם, כדי לבנות מסגרת משולשת. כמה אורכים אפשריים?`;
export function congr5Solution({ a, b }) {
  const lo = Math.abs(a - b); const hi = a + b;
  return [
    `הצלע השלישית ארוכה מההפרש, $${Math.max(a, b)} - ${Math.min(a, b)} = ${lo}$, וקצרה מהסכום, $${a} + ${b} = ${hi}$.`,
    `השלמים ביניהם: $${lo + 1}$ עד $${hi - 1}$. זה $${hi - 1} - ${lo + 1} + 1 = ${hi - lo - 1}$ אורכים.`,
  ];
}
export const congr5Hint = () => 'הצלע השלישית בין ההפרש לסכום של שתי האחרות, בלי הקצוות.';

/** An isosceles triangle with sides a and b, 2a ≤ b: the legs are b (two legs of a do not meet over a base of b). */
function isoPerim() {
  for (;;) {
    const a = rint(rnd, 2, 9); const b = rint(rnd, 2 * a, 20);
    const ans = a + 2 * b; const bug = 2 * a + b;
    if (slipOf(bug, ans)) continue; // b − a = 10 would read as a slip, not as the mistake
    return {
      key: `cg5i:${a}:${b}`, text: `במשולש שווה־שוקיים שתי צלעות באורך $${a}$ ו־$${b}$ ס״מ. מה ההיקף?`,
      form: 'num', answer: ans,
      hint: `אם השוקיים הן $${a}$: האם $${a} + ${a}$ ארוך מ־$${b}$?`,
      solution: [`$${a} + ${a} = ${2 * a}$, וזה לא ארוך מ־$${b}$: שוקיים של $${a}$ לא נפגשות מעל בסיס של $${b}$. השוקיים הן $${b}$.`, `$${a} + ${b} + ${b} = ${ans}$`],
      diag: (u) => (near(u, bug) ? 'ignore-inequality' : null),
    };
  }
}
/** Lengths that make a triangle, lie flat (a + b = c) or do not meet (a + b < c), in a shuffled order. Practice only. */
function canBuild() {
  for (;;) {
    const kind = pick(rnd, ['equal', 'equal', 'short', 'yes']);
    const a = rint(rnd, 2, 9); const b = rint(rnd, 2, 9); if (a === b) continue;
    const c = kind === 'equal' ? a + b : kind === 'short' ? a + b + rint(rnd, 1, 3) : Math.max(a, b) + rint(rnd, 1, Math.min(a, b) - 1);
    if (c === a || c === b || (kind === 'yes' && c >= a + b)) continue;
    const yes = { text: 'כן, נוצר משולש', ok: kind === 'yes', bug: kind === 'equal' ? 'sum-equal' : kind === 'short' ? 'no-lower-limit' : undefined };
    const no = { text: 'לא, לא נוצר משולש', ok: kind !== 'yes' };
    const choices = [yes, no];
    const shown = shuffle([a, b, c]);
    const [s, m] = [Math.min(a, b), Math.max(a, b)];
    return {
      key: `cg5c:${shown.join(':')}`, text: `אפשר לבנות משולש מקטעים של $${shown[0]}$, $${shown[1]}$ ו־$${shown[2]}$ ס״מ?`,
      form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((x) => x.ok),
      hint: 'בדקו אם שני הקטעים הקצרים יחד ארוכים מהארוך.',
      solution: [kind === 'yes'
        ? `$${s} + ${m} = ${a + b}$, ארוך מ־$${c}$: נוצר משולש.`
        : kind === 'equal'
          ? `$${s} + ${m} = ${c}$: שני הקטעים נשכבים בדיוק על הארוך, ואין קודקוד שלישי.`
          : `$${s} + ${m} = ${a + b}$, קצר מ־$${c}$: הקטעים לא נפגשים.`],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}
/**
 * Which angle is the largest: three sides, drawn true (C at (0, 0), B at (BC, 0), A from AB and AC). The largest angle
 * lies opposite the longest side; a choice at an end of that side is 'angle-at-side'. Practice only.
 */
function maxAngle() {
  for (;;) {
    const s = [rint(rnd, 4, 12), rint(rnd, 4, 12), rint(rnd, 4, 12)];
    if (new Set(s).size < 3) continue;
    const w = Math.max(...s); const rest = s.filter((x) => x !== w); if (rest[0] + rest[1] <= w + 1) continue;
    // AB, BC, AC, and the vertex opposite each side: C, A, B
    const [ab, bc, ac] = s;
    const longest = ['AB', 'BC', 'AC'][s.indexOf(w)];
    const right = { AB: 'C', BC: 'A', AC: 'B' }[longest];
    const choices = shuffle(['A', 'B', 'C'].map((V) => ({ tex: ang(V), ok: V === right, bug: V === right ? undefined : 'angle-at-side' })));
    const ax = (ac * ac - ab * ab + bc * bc) / (2 * bc); const ay = Math.sqrt(ac * ac - ax * ax);
    return {
      key: `cg5m:${ab}:${bc}:${ac}`, text: `ב־$${tri('ABC')}$: $AB = ${ab}$, $BC = ${bc}$, $AC = ${ac}$. איזו זווית היא הגדולה ביותר?`,
      form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((x) => x.ok),
      fig: {
        type: 'geo', label: `משולש ABC עם הצלעות AB ${ab}, BC ${bc} ו־AC ${ac}`,
        pts: { A: [ax, ay], B: [bc, 0], C: [0, 0] }, polys: [{ pts: ['A', 'B', 'C'] }],
        segs: [{ a: 'A', b: 'B', label: String(ab) }, { a: 'C', b: 'B', label: String(bc) }, { a: 'A', b: 'C', label: String(ac) }],
        view: [300, 200], pad: [28, 26],
      },
      hint: 'מצאו את הצלע הארוכה. הזווית הגדולה לא נוגעת בה: היא מולה.',
      solution: [`הצלע הארוכה היא $${longest} = ${w}$, ומולה הקודקוד $${right}$: $${ang(right)}$ הגדולה ביותר.`],
      diag: (x) => choices[x]?.bug || null,
    };
  }
}
/** The number of whole lengths of the third side (the model's draws). */
function countLengths() {
  const p = CONGR5.params(rnd);
  return modelGen(keyOf('cg5n', p), CONGR5, p, { text: congr5Text, fig: () => undefined, hint: congr5Hint, solution: congr5Solution });
}

// ---------------------------------------------------------------- the levels (content/congr.js puts these on its stairs)
/** Each level's mix: the models' typed questions most of the time, the choices, the ticks and the proofs the rest. */
export const CONGR_GENS = [
  () => { const r = Math.random(); return r < 0.35 ? angleVia() : r < 0.6 ? sideX() : r < 0.8 ? ticks() : pairsMc(); },
  () => { const r = Math.random(); return r < 0.35 ? matchData() : r < 0.7 ? whichThm() : r < 0.85 ? whatMissing() : samePerimeter(); },
  () => { const r = Math.random(); return r < 0.35 ? useCong() : r < 0.6 ? proofFill() : r < 0.85 ? proofOrder() : findError(); },
  () => { const r = Math.random(); return r < 0.3 ? medArea() : r < 0.55 ? medPerim() : r < 0.7 ? rectMedian() : r < 0.9 ? whichSeg() : claims(); },
  () => { const r = Math.random(); return r < 0.3 ? countLengths() : r < 0.55 ? isoPerim() : r < 0.8 ? canBuild() : maxAngle(); },
];
/** Each generator by name (tests draw every kind). */
export const CONGR_KINDS = { angleVia, sideX, ticks, pairsMc, matchData, whichThm, whatMissing, samePerimeter, useCong, proofFill, proofOrder, findError, proofCheck, medArea, medPerim, rectMedian, whichSeg, claims, countLengths, isoPerim, canBuild, maxAngle };
