// Isosceles triangles and similarity (שווה־שוקיים ודמיון): the ח׳ unit 8.13 of March and April (curriculum stage 4,
// GEOM-6).
//
// One picture carries it: an enlargement multiplies every length by one number and keeps every angle. The isosceles
// triangle's bisector cuts it into two congruent halves (צ.ז.צ), so it is the median and the altitude too, and a triangle
// with two equal angles is isosceles (a converse, checked on its own); similar shapes keep one ratio for all their sides
// (multiplied, never added), two equal angles make two triangles similar (ז.ז), also in the "פרפר" whose correspondence
// crosses over, and areas grow by the square of the ratio.
//
// The diagnostic models (SIM1 to SIM4T, and sim:3's bowtie) are the stage's (scratchpad/lanes/stage4/spec/models.mjs),
// ported unchanged, with the same redraw rule as content/congr.gen.js (clean(), and the answer never a printed number).
// Every number written here is checked by the lane's spec/facts-sim.mjs, and every drawing is computed from its numbers.
// Errors and their sources (stage4.md §0.4):
//   side-at-angle, stopped-at-x, whole-base   the sides at the equal angles equated, not the ones opposite them; x found
//                     and the question left; the whole base in Pythagoras (Hoyles & Küchemann 2002; teacher-reported)
//   converse-equal    a theorem and its converse taken to stand or fall together (the Ministry's "להבחין בין שני משפטים
//                     הפוכים"; Weizmann "טענה הפוכה")
//   additive, ratio-flip   an enlargement by adding; the factor turned over (Hart 1984; Karplus, Pulos & Stage 1983)
//   angles-enough, part-not-whole, order-mixed, third-angle   equal angles taken as enough for rectangles; a part of a
//                     side compared; the similarity written out of order; the third angle not worked out
//   linear-area, area-for-perimeter   an area scaled like a length; the perimeters squared too (De Bock et al. 1998)
// This module is the topic's arithmetic. It is not on the first screen: content/sim.js, the topic object, puts SIM_GENS
// on its levels, and both load with the topic (content/topics.js importGens; the teaching content, learn/content/sim.ts,
// imports this file too). It imports the proof templates (content/proofs.js: T5 and T6 for the isosceles triangle, T7
// for similarity), so a proof item is checkable wherever the unit has loaded.
import { shuffle } from './util.js';
import { clean, notGuessable } from './frac.js';
import { slipOf } from '@/learn/misconceptions.ts';
import { triFromAngles, PROOF, proofManip, proofDiag } from './proofs.js';
import { proofSolution } from './proof.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const r9 = (v) => Math.round(v * 1e9) / 1e9;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const rad = (d) => (d * Math.PI) / 180;
/** A number as the app writes it: a decimal point, at most two decimals. */
const num = (v) => String(Math.round(v * 100) / 100);

// ---------------------------------------------------------------- the models' draws (spec/models.mjs, unchanged)
/** content/congr.gen.js mk: clean(), and the answer is never a number the question or its drawing shows. */
function mk(m) {
  m.params = (r) => {
    for (let i = 0; i < 200000; i += 1) {
      const p = m.raw(r);
      if (!p || !clean(m, p)) continue;
      // every printed number with and without its sign: AC = 6x − 9 shows a 9 (stage 4's review)
      if (!notGuessable(m.answer(p), [...m.printed(p), ...(m.figNums ? m.figNums(p) : [])].flatMap((n) => (n < 0 ? [n, -n] : [n])), false)) continue;
      return p;
    }
    throw new Error('no clean draw');
  };
  return m;
}

/** sim:1 — ∢B = ∢C; AB = px + q, AC = rx + s, BC = tx + u; the length of AB (the converse: AB = AC). */
export const SIM1 = mk({
  raw: (r) => {
    const x = rint(r, 2, 9); const p = rint(r, 2, 6); const rr = rint(r, 2, 6); if (p === rr) return null;
    const q = rint(r, -9, 9); const s = (p - rr) * x + q; const t = rint(r, 1, 5); const u = rint(r, -9, 9);
    if (q === 0 || s === 0 || u === 0 || Math.abs(s) > 15 || t === p || t === rr) return null;
    const AB = p * x + q; const BC = t * x + u;
    if (AB <= 0 || BC <= 0 || BC >= 2 * AB || BC === AB) return null;
    // drawn true to scale, so a triangle that reads: the base between half a leg and 1.6 legs (no needle, no sliver)
    if (BC < 0.5 * AB || BC > 1.6 * AB) return null;
    return { x, p, q, r: rr, s, t, u };
  },
  answer: ({ x, p, q }) => p * x + q,
  bugs: {
    'side-at-angle': ({ p, q, t, u }) => { const x2 = (u - q) / (p - t); const v = p * x2 + q; return x2 > 0 && v > 0 ? v : null; }, // AB = BC taken
    'stopped-at-x': ({ x }) => x, // x found, and the answer stopped there
  },
  printed: ({ p, q, r: rr, s, t, u }) => [p, q, rr, s, t, u],
});
/** sim:1 transfer: the same draw, as a tent seen from the side. */
export const SIM1T = mk({ raw: SIM1.raw, answer: SIM1.answer, bugs: SIM1.bugs, printed: SIM1.printed });
const KS = [1.5, 2, 2.5, 3, 0.5, 0.75, 1.25];
/** sim:2 — a rectangle p by q enlarged or reduced so that p becomes kp; what q becomes. */
export const SIM2 = mk({
  raw: (r) => {
    const k = pick(r, KS); const p = rint(r, 2, 16); const q = rint(r, 2, 16);
    if (p === q || Math.round(k * p * 2) !== k * p * 2 || Math.round(k * q * 2) !== k * q * 2 || q + k * p - p <= 0) return null;
    return { k, p, q };
  },
  answer: ({ k, q }) => r9(k * q),
  bugs: {
    additive: ({ k, p, q }) => r9(q + k * p - p), // the same added to every side
    'ratio-flip': ({ k, q }) => r9(q / k), // multiplied by the factor turned over
  },
  printed: ({ k, p, q }) => [p, q, r9(k * p)],
});
/** sim:2 transfer: a photo printed larger or smaller (the same draw). */
export const SIM2T = mk({ raw: SIM2.raw, answer: SIM2.answer, bugs: SIM2.bugs, printed: SIM2.printed });
/** sim:3 — DE ∥ BC in △ABC, AD = a, DB = b, DE = d; the length of BC. */
export const SIM3 = mk({
  raw: (r) => {
    const a = rint(r, 2, 9); const b = rint(r, 2, 12); const d = rint(r, 2, 12); if (a === b) return null;
    // drawn true to scale, so a shape that reads: the small triangle at least a quarter of the large one's side (b ≤ 3a),
    // and BC between 0.6 and 1.8 times AB (BC : AB = d : a), not a sliver
    if (b > 3 * a || d < 0.6 * a || d > 1.8 * a) return null;
    const ans = (d * (a + b)) / a; if (Math.round(ans * 2) !== ans * 2) return null;
    return { a, b, d };
  },
  answer: ({ a, b, d }) => r9((d * (a + b)) / a),
  bugs: {
    'part-not-whole': ({ a, b, d }) => r9((d * b) / a), // DB used where the whole side AB belongs
    additive: ({ b, d }) => d + b, // the same added
  },
  printed: ({ a, b, d }) => [a, b, d],
});
/** sim:3's bowtie (the critique): AB ∥ CD, AD and BC cross at M; AM = a, MD = b, AB = d; CD = d·b/a (A ↔ D, B ↔ C). */
export const BOWTIE = mk({
  raw: (r) => {
    const a = rint(r, 2, 9); const b = rint(r, 2, 12); const d = rint(r, 2, 12); if (a === b) return null;
    // drawn true to scale: neither triangle a third of the other's size or less (a : b between 1 : 3 and 3 : 1), and
    // AB between 0.6 and 2 times AM, so the triangle AMB is not a sliver
    if (b > 3 * a || a > 3 * b || d < 0.6 * a || d > 2 * a) return null;
    const ans = (d * b) / a; if (Math.round(ans * 2) !== ans * 2) return null; return { a, b, d };
  },
  answer: ({ a, b, d }) => r9((d * b) / a),
  bugs: {
    'ratio-flip': ({ a, b, d }) => r9((d * a) / b), // the ratio turned over
    additive: ({ a, b, d }) => d + b - a, // the same added
  },
  printed: ({ a, b, d }) => [a, b, d],
});
/** sim:3 transfer — a person h tall casts a shadow s; a tree casts S at the same hour; the tree's height. */
export const SIM3T = mk({
  raw: (r) => {
    const h = pick(r, [1.5, 1.6, 1.8, 2]); const s = pick(r, [1, 1.2, 1.5, 2, 2.4, 3]); const S = rint(r, 4, 15);
    const ans = (h * S) / s; if (Math.abs(Math.round(ans * 10) - ans * 10) > 1e-9 || S <= s) return null;
    return { h, s, S };
  },
  answer: ({ h, s, S }) => r9((h * S) / s),
  bugs: {
    'ratio-flip': ({ h, s, S }) => r9((h * s) / S),
    additive: ({ h, s, S }) => r9(h + S - s),
  },
  printed: ({ h, s, S }) => [h, s, S],
});
/** sim:4 — △ABC ∼ △DEF with AB = p, DE = q (k = q/p); the area of ABC is S; the area of DEF. */
export const SIM4 = mk({
  raw: (r) => {
    const k = pick(r, [1.5, 2, 2.5, 3, 4, 0.5]); const p = rint(r, 2, 12); const q = k * p; if (!Number.isInteger(q)) return null;
    const S = rint(r, 2, 30); const ans = S * k * k; if (Math.round(ans * 2) !== ans * 2 || Math.round(S / k / k * 100) !== S / k / k * 100) return null;
    return { k, p, q, S };
  },
  answer: ({ k, S }) => r9(S * k * k),
  bugs: {
    'linear-area': ({ k, S }) => r9(S * k), // the area scaled like a length
    'ratio-flip': ({ k, S }) => r9(S / (k * k)), // the factor turned over
  },
  printed: ({ p, q, S }) => [p, q, S],
});
/** sim:4 transfer — a projector moved from d1 to d2 metres from the wall; the picture's area was A. */
export const SIM4T = mk({
  raw: (r) => {
    const d1 = pick(r, [1, 1.5, 2, 2.5, 3]); const d2 = pick(r, [2, 3, 4, 4.5, 5, 6]); const k = d2 / d1;
    if (d2 <= d1 || ![1.5, 2, 2.5, 3, 4].includes(k)) return null;
    const A = pick(r, [0.5, 0.8, 1, 1.2, 1.5, 2]); const ans = A * k * k; if (Math.abs(Math.round(ans * 100) - ans * 100) > 1e-9) return null;
    return { d1, d2, k, A };
  },
  answer: ({ k, A }) => r9(A * k * k),
  bugs: { 'linear-area': ({ k, A }) => r9(A * k), 'ratio-flip': ({ k, A }) => r9(A / (k * k)) },
  printed: ({ d1, d2, A }) => [d1, d2, A],
});
/** (BD, AD, AB): half the base, the height, the leg of an isosceles triangle, all whole (models.mjs). */
export const ISO_TRIPLES = [[5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15], [12, 16, 20], [7, 24, 25], [12, 5, 13], [15, 8, 17], [8, 6, 10], [12, 9, 15], [16, 12, 20]];

// ---------------------------------------------------------------- words
const ang = (s) => `\\sphericalangle ${s}`;
const tri = (s) => `\\triangle ${s}`;
/** px + q in TeX, and the same for a drawing's label (a real minus sign). */
// a coefficient of 1 is not written: x + 2, as at school
const lin = (p, q) => `${p === 1 ? '' : p}x ${q < 0 ? '-' : '+'} ${Math.abs(q)}`;
const linFig = (p, q) => `${p === 1 ? '' : p}x ${q < 0 ? '−' : '+'} ${Math.abs(q)}`;

// ---------------------------------------------------------------- drawings, every one from its numbers
/** An angle mark at V inside the triangle V, a, b (content/congr.gen.js innerAngle): the inner angle's sweep. */
export function innerAngle(P, V, a, b, more = {}) {
  const v = P[V]; const u = P[a]; const w = P[b];
  const cross = (u[0] - v[0]) * (w[1] - v[1]) - (u[1] - v[1]) * (w[0] - v[0]);
  return cross > 0 ? { at: V, from: a, to: b, ...more } : { at: V, from: b, to: a, ...more };
}
/** An isosceles triangle ABC with AB = AC = leg over BC = base: C (0, 0), B (base, 0), A on top; D the middle of BC. */
export function isoPts(base, leg) {
  const h = Math.sqrt(leg * leg - (base * base) / 4);
  return { A: [base / 2, h], B: [base, 0], C: [0, 0], D: [base / 2, 0] };
}
/** sim:1's question: ∢B = ∢C marked, the three sides written as expressions, drawn at their values. */
export function sim1Fig({ x, p, q, r, s, t, u }, label = 'משולש ABC. הזוויות B ו־C מסומנות שוות, ועל כל צלע ביטוי') {
  const P = isoPts(t * x + u, p * x + q); delete P.D;
  return {
    type: 'geo', label, pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'B', label: linFig(p, q) }, { a: 'A', b: 'C', label: linFig(r, s) }, { a: 'C', b: 'B', label: linFig(t, u) }],
    angles: [innerAngle(P, 'B', 'A', 'C', { n: 1 }), innerAngle(P, 'C', 'A', 'B', { n: 1 })],
    view: [300, 210], pad: [34, 28],
  };
}
export const sim1Text = ({ p, q, r, s, t, u }) => `ב־$${tri('ABC')}$: $${ang('B')} = ${ang('C')}$, $AB = ${lin(p, q)}$, $AC = ${lin(r, s)}$, $BC = ${lin(t, u)}$ (ס״מ). מה אורך $AB$?`;
export const sim1TText = ({ p, q, r, s, t, u }) => `לאוהל קטן צורה של משולש $ABC$ במבט מהצד. הזוויות ליד הקרקע, $${ang('B')}$ ו־$${ang('C')}$, שוות. אורכי הדפנות $AB = ${lin(p, q)}$ ו־$AC = ${lin(r, s)}$, והרוחב בקרקע $BC = ${lin(t, u)}$ (בס״מ). מה אורך הדופן $AB$?`;
export function sim1Solution({ x, p, q, r, s }) {
  return [
    `מול זוויות שוות צלעות שוות: $AB = AC$.`,
    `$${lin(p, q)} = ${lin(r, s)}$, ולכן $x = ${x}$`,
    `$AB = ${p} \\cdot ${x} ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${p * x + q}$`,
  ];
}
export const sim1Hint = () => 'איזו צלע מול $\\sphericalangle B$, ואיזו מול $\\sphericalangle C$? הצלעות האלה שוות.';

/** Two rectangles side by side, true to scale: w1 × h1 and w2 × h2, each side written (or '?'). */
export function twoRects([w1, h1], [w2, h2], [lw1, lh1, lw2, lh2], label) {
  const gap = Math.max(w1, w2) * 0.35 + 0.8;
  const P = { _a: [0, 0], _b: [w1, 0], _c: [w1, h1], _d: [0, h1], _e: [w1 + gap, 0], _f: [w1 + gap + w2, 0], _g: [w1 + gap + w2, h2], _h: [w1 + gap, h2] };
  const seg = (a, b, l) => (l === '' || l == null ? { a, b } : { a, b, label: String(l) });
  return {
    type: 'geo', label, pts: P, polys: [{ pts: ['_a', '_b', '_c', '_d'] }, { pts: ['_e', '_f', '_g', '_h'] }],
    // the first's height on its left side and the second's on its right: a label goes away from the middle of the whole
    // drawing, so the sides that face each other would take theirs inside
    segs: [seg('_a', '_b', lw1), seg('_d', '_a', lh1), seg('_e', '_f', lw2), seg('_f', '_g', lh2)],
    view: [320, 190], pad: [28, 28],
  };
}
const grow = (k) => (k > 1 ? 'הוגדל' : 'הוקטן');
export const sim2Text = ({ k, p, q }) => `מלבן באורך $${p}$ ס״מ וברוחב $${q}$ ס״מ ${grow(k)}, ונוצר מלבן דומה שאורכו $${num(k * p)}$ ס״מ. מה הרוחב שלו?`;
export const sim2Fig = ({ k, p, q }, label = 'שני מלבנים דומים: למקורי אורך ורוחב, לדומה לו רק האורך') => twoRects([p, q], [k * p, k * q], [p, q, num(k * p), '?'], label);
export const sim2TText = ({ k, p, q }) => `תמונה ברוחב $${p}$ ס״מ ובגובה $${q}$ ס״מ ${k > 1 ? 'מוגדלת' : 'מוקטנת'} במדפסת כך שהרוחב $${num(k * p)}$ ס״מ. מה הגובה?`;
export function sim2Solution({ k, p, q }) {
  return [`יחס הדמיון: $${num(k * p)} : ${p} = ${num(k)}$. כל צלע מוכפלת ב־$${num(k)}$.`, `$${q} \\cdot ${num(k)} = ${num(k * q)}$`];
}
export const sim2Hint = () => 'פי כמה השתנה האורך? גם הצלע השנייה משתנה פי אותו מספר.';

/**
 * △ABC with DE ∥ BC: C (0, 0), B (BC, 0), A from AB = a + b at 65° to BC; D on AB with AD = a, E on AC in the same
 * ratio. `labels` writes AD, DB, DE and BC (a number, '?' or nothing).
 */
export function cutFig({ a, b, bc }, { AD = String(a), DB = String(b), DE = '', BC = '?' } = {}, label = 'משולש ABC. הנקודה D על AB, הנקודה E על AC, ו־DE מקביל ל־BC') {
  const AB = a + b; const t = a / AB;
  const A = [bc + AB * Math.cos(rad(115)), AB * Math.sin(rad(115))];
  const P = { A, B: [bc, 0], C: [0, 0], D: [A[0] + (bc - A[0]) * t, A[1] * (1 - t)], E: [A[0] * (1 - t), A[1] * (1 - t)] };
  const seg = (s, e, l, more = {}) => ({ a: s, b: e, ...(l ? { label: l } : {}), ...more });
  return {
    type: 'geo', label, pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [seg('A', 'D', AD), seg('D', 'B', DB), seg('D', 'E', DE, { arrows: 1 }), seg('C', 'B', BC, { arrows: 1 })],
    view: [300, 220], pad: [30, 28],
  };
}
export const sim3Text = ({ a, b, d }) => `ב־$${tri('ABC')}$ הנקודה $D$ על $AB$ והנקודה $E$ על $AC$, ו־$DE \\parallel BC$. $AD = ${a}$, $DB = ${b}$, $DE = ${d}$. מה $BC$?`;
export const sim3Fig = (p) => cutFig({ a: p.a, b: p.b, bc: SIM3.answer(p) }, { DE: String(p.d) });
export function sim3Solution({ a, b, d }) {
  const ans = r9((d * (a + b)) / a);
  return [
    `$${tri('ADE')} \\sim ${tri('ABC')}$ (ז.ז): $${ang('A')}$ משותפת, ו־$${ang('ADE')} = ${ang('ABC')}$ (מתאימות בין מקבילים).`,
    `$AD$ מתאימה ל־$AB = ${a} + ${b} = ${a + b}$, כל הצלע.`,
    `$BC = \\frac{${d} \\cdot ${a + b}}{${a}} = ${num(ans)}$`,
  ];
}
export const sim3Hint = () => 'הצלע שמתאימה ל־$AD$ במשולש הגדול היא כל $AB$, לא רק $DB$.';

/**
 * The "פרפר": AB ∥ CD, the segments AD and BC crossing at M. M (0, 0), A up and left with AM = a, B = A + (d, 0); D and
 * C on the other side, MD = b and MC in the same ratio (a homothety about M with the ratio −b/a), so CD = d·b/a.
 */
export function bowtieFig({ a, b, d }, { AM = String(a), MD = String(b), AB = String(d), CD = '?' } = {}, label = 'הקטעים AD ו־BC נחתכים ב־M. AB מקביל ל־CD') {
  const A = [-a * Math.cos(rad(50)), a * Math.sin(rad(50))]; const B = [A[0] + d, A[1]];
  const k = -b / a;
  const P = { A, B, M: [0, 0], D: [A[0] * k, A[1] * k], C: [B[0] * k, B[1] * k] };
  const seg = (s, e, l, more = {}) => ({ a: s, b: e, ...(l ? { label: l } : {}), ...more });
  return {
    type: 'geo', label, pts: P, polys: [{ pts: ['A', 'M', 'B'] }, { pts: ['D', 'M', 'C'] }],
    segs: [seg('A', 'M', AM), seg('M', 'D', MD), seg('A', 'B', AB, { arrows: 1 }), seg('D', 'C', CD, { arrows: 1 })],
    view: [300, 230], pad: [30, 28],
  };
}
export const bowtieText = ({ a, b, d }) => `$AB \\parallel CD$, והקטעים $AD$ ו־$BC$ נחתכים ב־$M$. $AM = ${a}$, $MD = ${b}$, $AB = ${d}$. מה $CD$?`;
export function bowtieSolution({ a, b, d }) {
  return [
    `$${ang('AMB')} = ${ang('DMC')}$ (קודקודיות) ו־$${ang('MAB')} = ${ang('MDC')}$ (מתחלפות בין מקבילים): $${tri('AMB')} \\sim ${tri('DMC')}$.`,
    `$A$ מתאים ל־$D$: $AM$ מתאימה ל־$MD$, ו־$AB$ ל־$CD$.`,
    `$CD = \\frac{${d} \\cdot ${b}}{${a}} = ${num((d * b) / a)}$`,
  ];
}
export const bowtieHint = () => 'בפרפר $A$ מתאים ל־$D$. פי כמה $MD$ ארוכה מ־$AM$?';

/** A person h tall with a shadow s and a tree H tall with a shadow S, one sun ray each (dashed), all true to scale. */
export function shadowFig({ h, s, S, H }, { hl = num(h), sl = num(s), Sl = num(S), Hl = '?' } = {}, label = 'אדם וצלו, ועץ וצלו. קרן שמש מראש כל אחד לקצה הצל שלו') {
  const X = s + Math.max(1.2, S * 0.15);
  const P = { _p: [0, 0], _ph: [0, h], _ps: [s, 0], _t: [X, 0], _th: [X, H], _ts: [X + S, 0] };
  const seg = (a, b, l, more = {}) => ({ a, b, ...(l ? { label: l } : {}), ...more });
  return {
    type: 'geo', label, pts: P,
    segs: [seg('_p', '_ph', hl), seg('_p', '_ps', sl), seg('_ph', '_ps', '', { dash: true, thin: true }),
      seg('_t', '_th', Hl), seg('_t', '_ts', Sl), seg('_th', '_ts', '', { dash: true, thin: true })],
    angles: [{ at: '_p', from: '_ps', to: '_ph', right: true }, { at: '_t', from: '_ts', to: '_th', right: true }],
    // room on the left for the person's height ("1.6"), written outside the drawing
    view: [320, 200], pad: [42, 26],
  };
}
export const sim3TText = ({ h, s, S }) => `אדם בגובה $${num(h)}$ מטר מטיל צל של $${num(s)}$ מטר. עץ מטיל באותה שעה צל של $${S}$ מטר. מה גובה העץ, במטרים?`;
export function sim3TSolution({ h, s, S }) {
  return [`הצל של העץ ארוך פי $\\frac{${S}}{${num(s)}}$ מהצל של האדם, ולכן גם העץ גבוה פי אותו מספר.`, `$\\frac{${num(h)} \\cdot ${S}}{${num(s)}} = ${num((h * S) / s)}$`];
}
export const sim3THint = () => 'פי כמה ארוך הצל של העץ? העץ גבוה פי אותו מספר.';

export const sim4Text = ({ p, q, S }) => `$${tri('ABC')} \\sim ${tri('DEF')}$, $AB = ${p}$, $DE = ${q}$, ושטח $${tri('ABC')}$ הוא $${S}$. מה שטח $${tri('DEF')}$?`;
export function sim4Solution({ k, p, q, S }) {
  return [`יחס הדמיון: $${q} : ${p} = ${num(k)}$.`, `יחס השטחים: $${num(k)}^2 = ${num(k * k)}$.`, `$${S} \\cdot ${num(k * k)} = ${num(S * k * k)}$`];
}
export const sim4Hint = () => 'השטח משתנה פי ריבוע יחס הדמיון.';
export const sim4TText = ({ d1, d2, A }) => `מקרן עומד $${num(d1)}$ מטר מהקיר, והתמונה שלו בשטח $${num(A)}$ מ״ר. מזיזים אותו ל־$${num(d2)}$ מטר מהקיר, והתמונה החדשה דומה לקודמת. מה השטח שלה, במ״ר?`;
export function sim4TSolution({ d1, d2, k, A }) {
  return [`המרחק פי $${num(d2)} : ${num(d1)} = ${num(k)}$, וכל אורך בתמונה גדל פי $${num(k)}$.`, `השטח גדל פי $${num(k)}^2 = ${num(k * k)}$: $${num(A)} \\cdot ${num(k * k)} = ${num(A * k * k)}$`];
}
export const sim4THint = () => 'האורכים בתמונה גדלים כמו המרחק. והשטח?';

/** A triangle with the angles al at its left end and be at its right end, on a base of `base`, from x0 (unnamed). */
function triAt(al, be, base, x0, names) {
  const top = triFromAngles(al, be, base);
  return { [names[0]]: [x0, 0], [names[1]]: [x0 + base, 0], [names[2]]: [x0 + top[0], top[1]] };
}
/**
 * Two triangles with two angles written in each, at the ends of the base. A flat triangle gets a longer base than a tall
 * one (its height over its base to the power −0.3), a small angle a smaller arc (its label goes further out), and the
 * drawing is tall enough for both: over angleCheck's whole domain no two labels meet and none sits on a side (checked
 * by the lane's brute force of the renderer's placement). The second triangle is `scale` times its size.
 */
export function twoAngleTris([a1, b1], [a2, b2], label, scale = 1) {
  const k1 = triFromAngles(a1, b1, 1)[1] ** -0.3; const k2 = triFromAngles(a2, b2, 1)[1] ** -0.3;
  const m = Math.max(k1, k2); const s1 = (4 * k1) / m; const s2 = ((4 * k2) / m) * scale;
  const P = { ...triAt(a1, b1, s1, 0, ['_a', '_b', '_c']), ...triAt(a2, b2, s2, s1 + 0.9, ['_d', '_e', '_f']) };
  const mark = (deg) => ({ text: `${deg}°`, r: deg < 40 ? 12 : deg < 60 ? 16 : 20 });
  return {
    type: 'geo', label, pts: P, polys: [{ pts: ['_a', '_b', '_c'] }, { pts: ['_d', '_e', '_f'] }],
    angles: [innerAngle(P, '_a', '_b', '_c', mark(a1)), innerAngle(P, '_b', '_a', '_c', mark(b1)),
      innerAngle(P, '_d', '_e', '_f', mark(a2)), innerAngle(P, '_e', '_d', '_f', mark(b2))],
    view: [320, 240], pad: [28, 26],
  };
}

// ---------------------------------------------------------------- generators: a model's draw as a practice item
function modelGen(key, model, p, words) {
  return {
    key, text: words.text(p), form: 'num', answer: model.answer(p), ...(words.fig ? { fig: words.fig(p) } : {}),
    hint: words.hint(p), solution: words.solution(p),
    diag: (u) => Object.keys(model.bugs).find((id) => { const v = model.bugs[id](p); return v != null && Number.isFinite(u) && near(u, v); }) || null,
  };
}
const keyOf = (prefix, p) => `${prefix}:${Object.values(p).join(':')}`;
/** A draw is clean for a generator's own bugs: none a slip of the answer, none within 0.06 of it or of another. */
function cleanBugs(ans, vals) {
  const vs = vals.filter((v) => v != null);
  for (const v of vs) { if (!Number.isFinite(v) || slipOf(v, ans) || (Math.abs(v - ans) <= 0.06 && !near(v, ans))) return false; }
  for (let i = 0; i < vs.length; i += 1) for (let j = i + 1; j < vs.length; j += 1) { const dd = Math.abs(vs[i] - vs[j]); if (dd > 1e-9 && dd <= 0.06) return false; }
  return true;
}

// ---------------------------------------------------------------- sim:1 generators
function isoX() {
  const p = SIM1.params(rnd);
  return modelGen(keyOf('sm1x', p), SIM1, p, { text: sim1Text, fig: (x) => sim1Fig(x), hint: sim1Hint, solution: sim1Solution });
}
/** The height to the base of an isosceles triangle, from its leg and its base (a whole triple). */
function isoAlt() {
  // half the time a triangle whose leg is longer than its whole base (5–12–13, 8–15–17, 7–24–25): only there does the
  // whole base in Pythagoras give a number, so only there can the exercise show that mistake
  const flat = ISO_TRIPLES.filter(([bd, , ab]) => ab > 2 * bd);
  const [bd, ad, ab] = pick(rnd, rnd() < 0.5 ? flat : ISO_TRIPLES);
  const bc = 2 * bd; const whole = ab > bc ? Math.sqrt(ab * ab - bc * bc) : null;
  const P = isoPts(bc, ab);
  return {
    key: `sm1h:${bd}:${ad}:${ab}`, text: `$AB = AC = ${ab}$, $AD$ תיכון לבסיס, $BC = ${bc}$. מה $AD$?`,
    form: 'num', answer: ad,
    fig: {
      type: 'geo', label: 'משולש שווה־שוקיים ABC והתיכון AD לבסיס BC', pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
      segs: [{ a: 'A', b: 'B', label: String(ab), ticks: 1 }, { a: 'A', b: 'C', ticks: 1 }, { a: 'C', b: 'D', ticks: 2 }, { a: 'D', b: 'B', ticks: 2 }, { a: 'A', b: 'D', label: '?' }],
      view: [300, 210], pad: [30, 28],
    },
    hint: 'התיכון לבסיס הוא גם הגובה. במשולש $ABD$: מה היתר, ומה הניצב שעל הבסיס?',
    solution: [`התיכון לבסיס במשולש שווה־שוקיים הוא גם גובה, ו־$BD = ${bc} : 2 = ${bd}$.`, `$AD = \\sqrt{${ab}^2 - ${bd}^2} = ${ad}$`],
    // the whole base in Pythagoras: √(AB² − BC²), typed as it rounds to a tenth
    diag: (u) => (whole != null && Number.isFinite(u) && Math.abs(u - whole) < 0.051 ? 'whole-base' : null),
  };
}
/**
 * How many isosceles triangles: the 36°–72°–72° triangle with the bisector of a base angle (three: ABC, ABD, BDC), or
 * with the altitude from B instead (one: ABC). Practice only.
 */
export function goldenFig(kind = 'bisector', marks = true) {
  const base = 3; const A = triFromAngles(72, 72, base); const L = Math.hypot(A[0], A[1]);
  const P = { A, B: [base, 0], C: [0, 0] };
  if (kind === 'bisector') { const t = base / (L + base); P.D = [A[0] * t, A[1] * t]; } else {
    // the foot of the perpendicular from B to AC
    const u = [A[0] / L, A[1] / L]; const s = base * u[0]; P.D = [u[0] * s, u[1] * s];
  }
  return {
    type: 'geo', label: kind === 'bisector' ? 'משולש ABC עם AB שווה ל־AC, זוויות של 72 מעלות ב־B וב־C, ו־BD חוצה את הזווית B' : 'משולש ABC עם AB שווה ל־AC, זוויות של 72 מעלות ב־B וב־C, ו־BD מאונך ל־AC',
    pts: P, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'B', ticks: 1 }, { a: 'A', b: 'C', ticks: 1 }, { a: 'B', b: 'D' }],
    angles: [
      ...(marks ? [innerAngle(P, 'C', 'B', 'A', { text: '72°' })] : []),
      ...(kind === 'bisector' ? [innerAngle(P, 'B', 'C', 'D', { n: 1, r: 26 }), innerAngle(P, 'B', 'D', 'A', { n: 1, r: 26 })] : [{ at: 'D', from: 'B', to: 'C', right: true }]),
    ],
    view: [260, 230], pad: [28, 26],
  };
}
function isoCount() {
  const kind = rnd() < 0.6 ? 'bisector' : 'height';
  const n = kind === 'bisector' ? 3 : 1;
  return {
    key: `sm1c:${kind}`,
    text: `ב־$${tri('ABC')}$: $AB = AC$ ו־$${ang('C')} = 72°$. ${kind === 'bisector' ? '$BD$ חוצה את $\\sphericalangle B$.' : '$BD$ מאונך ל־$AC$.'} כמה משולשים שווי־שוקיים יש בשרטוט?`,
    form: 'num', practiceOnly: true, answer: n, fig: goldenFig(kind),
    hint: 'חשבו את כל הזוויות: $\\sphericalangle A$, ושתי הזוויות שנוצרות ב־$B$ וב־$D$. משולש עם שתי זוויות שוות הוא שווה־שוקיים.',
    solution: kind === 'bisector'
      ? [`$${ang('A')} = 36°$ ו־$${ang('ABD')} = ${ang('DBC')} = 36°$.`, `$${tri('ABC')}$; $${tri('ABD')}$, כי $${ang('A')} = ${ang('ABD')}$; ו־$${tri('BDC')}$, כי $${ang('C')} = ${ang('BDC')} = 72°$. שלושה.`]
      : [`$${ang('A')} = 36°$, $${ang('ABD')} = 54°$, $${ang('DBC')} = 18°$.`, `רק ב־$${tri('ABC')}$ יש שתי זוויות שוות. אחד.`],
    diag: () => null,
  };
}
/** Five theorems and their converses: two converses true, three not necessarily (the critique's clean pairs). */
export const CONVERSES = [
  { th: 'במשולש שווה־שוקיים זוויות הבסיס שוות', conv: 'משולש עם שתי זוויות שוות הוא שווה־שוקיים', ok: true, why: 'מוכיחים אותו בחפיפה, עם חוצה הזווית ו־ז.צ.ז.' },
  { th: 'במשולש שווה־שוקיים התיכון לבסיס הוא גם הגובה לבסיס', conv: 'משולש שבו תיכון לצלע הוא גם הגובה לצלע הוא שווה־שוקיים', ok: true, why: 'מוכיחים אותו בחפיפה, ב־צ.ז.צ: שתי הזוויות ליד התיכון ישרות.' },
  { th: 'משולשים חופפים שווים בשטח', conv: 'משולשים שווים בשטח הם חופפים', ok: false, why: 'משולש עם בסיס $6$ וגובה $2$ ומשולש עם בסיס $4$ וגובה $3$ שווים בשטח, $6$, ולא חופפים.' },
  { th: 'זוויות קודקודיות שוות', conv: 'זוויות שוות הן זוויות קודקודיות', ok: false, why: 'שתי זוויות של $40°$ בשני משולשים שונים שוות, ואינן קודקודיות.' },
  { th: 'משולש שווה־צלעות הוא שווה־שוקיים', conv: 'משולש שווה־שוקיים הוא שווה־צלעות', ok: false, why: 'במשולש עם צלעות $5$, $5$ ו־$8$ יש שתי צלעות שוות, ולא שלוש.' },
];
function converseMc() {
  const i = rint(rnd, 0, CONVERSES.length - 1); const c = CONVERSES[i];
  const choices = [{ text: 'נכון', ok: c.ok, bug: c.ok ? undefined : 'converse-equal' }, { text: 'לא נכון בהכרח', ok: !c.ok }];
  return {
    key: `sm1v:${i}`, text: `המשפט "${c.th}" נכון. ומה עם המשפט ההפוך: "${c.conv}"?`,
    form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((x) => x.ok),
    hint: 'משפט הפוך בודקים בנפרד: אפשר להוכיח אותו? אפשר למצוא דוגמה שבה הוא לא מתקיים?',
    solution: [`${c.ok ? 'המשפט ההפוך נכון' : 'המשפט ההפוך לא נכון בהכרח'}: ${c.why}`],
    diag: (u) => choices[u]?.bug || null,
  };
}
/** The isosceles proofs: T5 completed (order locked, the bisector, the theorem and the right angle asked), or T6 ordered. */
function isoProof() {
  const set = rint(rnd, 0, 2);
  if (rnd() < 0.5) {
    const manip = proofManip(PROOF.T5, { set, lockOrder: true });
    const ask = new Set([1, 3, 6]);
    manip.part = { ...manip.part, steps: manip.part.steps.map((s, i) => (ask.has(i) || !s.reason ? s : { text: s.text, fixed: s.reason.choices[s.reason.answer] })) };
    manip.seed = `T5:${set}:fill`;
    return proofItem(`sm1p:T5:${set}`, 'השלימו את הנימוקים החסרים בהוכחה.', manip, 'מה נתון, מה מגדירה חוצה זווית, ולפי איזה משפט המשולשים חופפים?');
  }
  const seed = rint(rnd, 1, 9999);
  const manip = proofManip(PROOF.T6, { set, seed: String(seed) });
  return proofItem(`sm1p:T6:${set}:${seed}`, 'סדרו את ההוכחה, ובחרו נימוק לכל שורה שחסר בה.', manip, 'קודם הנתונים, אחר כך הזווית השלישית, ורק אז החפיפה ומה שנובע ממנה.');
}
function proofItem(key, text, manip, hint) {
  return {
    key, text, form: 'manip', practiceOnly: true, manip, answer: proofSolution(manip), hint,
    solution: manip.part.steps.map((s, i) => `${i + 1}. ${s.text} — ${s.fixed ?? s.reason.choices[s.reason.answer]}`),
    // a conclusion above the congruence ('circular'), or another theorem on it ('wrong-theorem')
    diag: (u) => proofDiag(manip.part, u),
  };
}

// ---------------------------------------------------------------- sim:2 generators
function missingSide() {
  const p = SIM2.params(rnd);
  return modelGen(keyOf('sm2m', p), SIM2, p, { text: sim2Text, fig: (x) => sim2Fig(x), hint: sim2Hint, solution: sim2Solution });
}
/** The factor of an enlargement (or a reduction) from a side and its image. */
function factor() {
  for (;;) {
    const k = pick(rnd, [1.5, 2.5, 3, 4, 0.5, 0.75]); const p = rint(rnd, 2, 16); const q = k * p;
    if (!Number.isInteger(q * 2) || q === p || [p, q].includes(k)) continue;
    const flip = r9(p / q); const add = r9(q - p);
    if (!cleanBugs(k, [flip, add])) continue;
    return {
      key: `sm2f:${p}:${num(q)}`, text: `צלע של $${p}$ ס״מ הפכה ב${k > 1 ? 'הגדלה' : 'הקטנה'} לצלע של $${num(q)}$ ס״מ. מה יחס הדמיון?`,
      form: 'num', answer: k,
      fig: {
        type: 'geo', label: `קטע באורך ${p} והקטע שהוא הפך אליו, באורך ${num(q)}`,
        pts: { _a: [0, 1.2], _b: [p, 1.2], _c: [0, 0], _d: [q, 0] },
        segs: [{ a: '_a', b: '_b', label: String(p) }, { a: '_c', b: '_d', label: num(q) }],
        dots: ['_a', '_b', '_c', '_d'], view: [300, 120], pad: [28, 26],
      },
      hint: 'יחס הדמיון הוא המספר שכופלים בו: הצלע החדשה לחלק לישנה.',
      solution: [`$${num(q)} : ${p} = ${num(k)}$: כל צלע מוכפלת ב־$${num(k)}$.`],
      diag: (u) => (near(u, flip) ? 'ratio-flip' : near(u, add) ? 'additive' : null),
    };
  }
}
/** Similar? Two rectangles with the same added, or multiplied; every two rectangles, every two squares; a square and a rhombus. Practice only. */
function isSimilarMc() {
  const kind = pick(rnd, ['add', 'add', 'mult', 'rects', 'squares', 'rhombus']);
  const yesNo = (yes, no, right, yesBug) => [{ text: yes, ok: right, bug: right ? undefined : yesBug }, { text: no, ok: !right }];
  let text; let choices; let fig; let why; let key;
  if (kind === 'add' || kind === 'mult') {
    const a = rint(rnd, 2, 6); const b = rint(rnd, a + 1, 9); const d = kind === 'add' ? rint(rnd, 1, 3) : 0; const k = pick(rnd, [1.5, 2, 3]);
    const [a2, b2] = kind === 'add' ? [a + d, b + d] : [k * a, k * b];
    if (!Number.isInteger(a2) || !Number.isInteger(b2)) return isSimilarMc();
    key = `sm2s:${kind}:${a}:${b}:${a2}:${b2}`;
    text = `המלבנים $${a} \\times ${b}$ ו־$${a2} \\times ${b2}$ דומים?`;
    choices = yesNo('כן, הם דומים', 'לא, הם לא דומים', kind === 'mult', 'additive');
    fig = twoRects([b, a], [b2, a2], [b, a, b2, a2], `מלבן ${a} על ${b} ומלבן ${a2} על ${b2}`);
    why = kind === 'mult' ? `$${b2} : ${b} = ${a2} : ${a} = ${num(k)}$: אותו יחס לשתי הצלעות.` : `$${b2} : ${b} = ${num(b2 / b)}$ אבל $${a2} : ${a} = ${num(a2 / a)}$: הוספה של אותו מספר משנה את היחס.`;
  } else if (kind === 'rects') {
    key = 'sm2s:rects'; text = 'כל שני מלבנים דומים זה לזה?';
    choices = yesNo('כן, כל שני מלבנים דומים', 'לא בהכרח', false, 'angles-enough');
    fig = twoRects([6, 2], [4, 4], ['6', '2', '4', '4'], 'מלבן 6 על 2 ומלבן 4 על 4');
    why = 'בכל המלבנים הזוויות ישרות, אבל מלבן $6 \\times 2$ ומלבן $4 \\times 4$ אינם דומים: $4 : 6$ ו־$4 : 2$ הם יחסים שונים.';
  } else if (kind === 'squares') {
    key = 'sm2s:squares'; text = 'כל שני ריבועים דומים זה לזה?';
    choices = yesNo('כן, כל שני ריבועים דומים', 'לא בהכרח', true);
    fig = twoRects([2, 2], [4, 4], ['2', '2', '4', '4'], 'ריבוע שצלעו 2 וריבוע שצלעו 4');
    why = 'בריבוע כל הזוויות ישרות וכל הצלעות שוות, ולכן ריבוע אחד הוא הגדלה של השני: היחס זהה לכל הצלעות.';
  } else {
    key = 'sm2s:rhombus'; text = 'ריבוע ומעוין עם אותה צלע דומים?';
    choices = yesNo('כן, הם דומים', 'לא בהכרח', false);
    const s = 3; const o = 4.4; const P = { _a: [0, 0], _b: [s, 0], _c: [s, s], _d: [0, s], _e: [o, 0], _f: [o + s, 0], _g: [o + s + s * Math.cos(rad(60)), s * Math.sin(rad(60))], _h: [o + s * Math.cos(rad(60)), s * Math.sin(rad(60))] };
    fig = { type: 'geo', label: 'ריבוע ומעוין עם אותה צלע', pts: P, polys: [{ pts: ['_a', '_b', '_c', '_d'] }, { pts: ['_e', '_f', '_g', '_h'] }],
      segs: [{ a: '_a', b: '_b', label: '3' }, { a: '_e', b: '_f', label: '3' }], angles: [{ at: '_a', from: '_b', to: '_d', right: true }, innerAngle(P, '_e', '_f', '_h', { text: '60°' })], view: [320, 170], pad: [28, 26] };
    why = 'הצלעות שוות, אבל הזוויות לא: במעוין $60°$ ובריבוע $90°$. בצורות דומות כל הזוויות המתאימות שוות.';
  }
  return {
    key, text, form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((x) => x.ok), fig,
    hint: 'בצורות דומות כל הזוויות המתאימות שוות, והיחס בין כל זוג צלעות מתאימות זהה.',
    solution: [why],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- sim:3 generators
function parallelCut() {
  const p = SIM3.params(rnd);
  return modelGen(keyOf('sm3p', p), SIM3, p, { text: sim3Text, fig: sim3Fig, hint: sim3Hint, solution: sim3Solution });
}
function bowtie() {
  const p = BOWTIE.params(rnd);
  return modelGen(`sm3b:${p.a}:${p.b}:${p.d}`, BOWTIE, p, { text: bowtieText, fig: (x) => bowtieFig(x), hint: bowtieHint, solution: bowtieSolution });
}
function shadow() {
  const p = SIM3T.params(rnd);
  return modelGen(`sm3s:${p.h}:${p.s}:${p.S}`, SIM3T, p, { text: sim3TText, fig: (x) => shadowFig({ ...x, H: SIM3T.answer(x) }), hint: sim3THint, solution: sim3TSolution });
}
/** Which triangle, in which order: the parallel cut (ADE ∼ ABC) or the bowtie (AMB ∼ DMC). Practice only. */
function aaWhich() {
  const bow = rnd() < 0.5;
  const raw = bow
    ? [{ tex: tri('DMC'), ok: true }, { tex: tri('CMD'), ok: false, bug: 'order-mixed' }]
    : [{ tex: tri('ABC'), ok: true }, { tex: tri('ACB'), ok: false, bug: 'order-mixed' }];
  const choices = [...shuffle(raw), { text: 'הם לא דומים', ok: false }];
  return {
    key: `sm3w:${bow ? 'bow' : 'nest'}`,
    text: bow ? `$AB \\parallel CD$, והקטעים $AD$ ו־$BC$ נחתכים ב־$M$. לאיזה משולש דומה $${tri('AMB')}$, לפי סדר הקודקודים?` : `$DE \\parallel BC$. לאיזה משולש דומה $${tri('ADE')}$, לפי סדר הקודקודים?`,
    form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((x) => x.ok),
    fig: bow ? bowtieFig({ a: 3, b: 5, d: 4 }, { AM: '', MD: '', AB: '', CD: '' }) : cutFig({ a: 4, b: 3, bc: 7 }, { AD: '', DB: '', BC: '' }),
    hint: bow ? 'בפרפר: לאיזה קודקוד מתאים $A$? הזווית ב־$A$ שווה לזווית ב־$D$ (מתחלפות).' : 'הזווית ב־$D$ שווה לזווית ב־$B$ (מתאימות בין מקבילים). אז $D$ מתאים ל־...',
    solution: [bow ? `$${ang('MAB')} = ${ang('MDC')}$ ו־$${ang('AMB')} = ${ang('DMC')}$: $A \\leftrightarrow D$, $M \\leftrightarrow M$, $B \\leftrightarrow C$. לכן $${tri('AMB')} \\sim ${tri('DMC')}$.` : `$A \\leftrightarrow A$, $D \\leftrightarrow B$, $E \\leftrightarrow C$: $${tri('ADE')} \\sim ${tri('ABC')}$.`],
    diag: (u) => choices[u]?.bug || null,
  };
}
function aaProof() {
  const set = rint(rnd, 0, 2); const seed = rint(rnd, 1, 9999);
  const manip = proofManip(PROOF.T7, { set, seed: String(seed) });
  return proofItem(`sm3o:${set}:${seed}`, 'סדרו את ההוכחה, ובחרו נימוק לכל שורה.', manip, 'שתי זוויות שוות, ואחריהן הדמיון.');
}
/** Two angles in each triangle: similar when the third angles agree. Practice only. */
function angleCheck() {
  for (;;) {
    const a = 5 * rint(rnd, 7, 17); const b = 5 * rint(rnd, 7, 17); const c = 180 - a - b;
    if (c < 30 || new Set([a, b, c]).size < 3) continue;
    const same = rnd() < 0.6;
    const c2 = same ? c : c + pick(rnd, [-10, -5, 5, 10]);
    // the second triangle's angles stay between 30° and 90° too, so its drawing is neither a sliver nor a needle
    if (c2 < 30 || c2 > 90 || [a, b].includes(c2) || 180 - b - c2 < 30) continue;
    const choices = [{ text: 'כן, הם דומים', ok: same }, { text: 'לא, הם לא דומים', ok: !same, bug: same ? 'third-angle' : undefined }];
    return {
      key: `sm3a:${a}:${b}:${c2}`, text: `במשולש אחד $${a}°$ ו־$${b}°$, ובשני $${b}°$ ו־$${c2}°$. הם דומים?`,
      form: 'mc', practiceOnly: true, choices, answer: same ? 0 : 1,
      fig: twoAngleTris([a, b], [b, c2], `משולש עם זוויות של ${a} ושל ${b} מעלות, ומשולש עם זוויות של ${b} ושל ${c2} מעלות`),
      hint: 'חשבו את הזווית השלישית בכל משולש.',
      solution: [`$180 - ${a} - ${b} = ${c}$, ולכן בראשון $${a}°$, $${b}°$, $${c}°$; בשני $${b}°$, $${c2}°$, $${180 - b - c2}°$.`, same ? 'אותן שלוש זוויות: דומים (ז.ז).' : 'הזוויות לא אותן: לא דומים.'],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- sim:4 generators
function areaK() {
  const p = SIM4.params(rnd);
  return modelGen(keyOf('sm4a', p), SIM4, p, { text: sim4Text, hint: sim4Hint, solution: sim4Solution });
}
/** The perimeter of a similar triangle (k, not k²). */
function perimK() {
  for (;;) {
    const k = pick(rnd, [1.5, 2, 2.5, 3]); const p = rint(rnd, 2, 12); const q = k * p; const P = rint(rnd, 3 * p, 6 * p);
    if (!Number.isInteger(q) || !Number.isInteger(P * k * 2)) continue;
    const ans = r9(P * k); const bug = r9(P * k * k);
    if ([p, q, P].includes(ans) || !cleanBugs(ans, [bug])) continue;
    return {
      key: `sm4p:${p}:${q}:${P}`, text: `$${tri('ABC')} \\sim ${tri('DEF')}$, $AB = ${p}$, $DE = ${q}$, וההיקף של $${tri('ABC')}$ הוא $${P}$. מה ההיקף של $${tri('DEF')}$?`,
      form: 'num', answer: ans,
      hint: 'היקף הוא סכום של אורכים. פי כמה גדל כל אורך?',
      solution: [`יחס הדמיון: $${q} : ${p} = ${num(k)}$. כל צלע, ולכן גם ההיקף, גדלה פי $${num(k)}$.`, `$${P} \\cdot ${num(k)} = ${num(ans)}$`],
      diag: (u) => (near(u, bug) ? 'area-for-perimeter' : null),
    };
  }
}
/** The ratio from the areas: a side of the larger triangle (a square root, then a multiplication). */
function kFromArea() {
  for (;;) {
    const k = pick(rnd, [2, 3, 4, 1.5, 2.5]); const S1 = rint(rnd, 2, 12); const S2 = S1 * k * k; const a = rint(rnd, 2, 10);
    if (!Number.isInteger(S2) || !Number.isInteger(a * k * 2)) continue;
    const ans = r9(a * k); const bug = r9((a * S2) / S1);
    if ([S1, S2, a].includes(ans) || !cleanBugs(ans, [bug])) continue;
    return {
      key: `sm4k:${S1}:${S2}:${a}`, text: `שטחי שני משולשים דומים $${S1}$ ו־$${S2}$, וצלע במשולש הקטן $${a}$. מה הצלע המתאימה בגדול?`,
      form: 'num', answer: ans,
      hint: 'יחס השטחים הוא ריבוע יחס הדמיון. איזה מספר בריבוע נותן את יחס השטחים?',
      solution: [`יחס השטחים: $${S2} : ${S1} = ${num(k * k)}$, ולכן יחס הדמיון $\\sqrt{${num(k * k)}} = ${num(k)}$.`, `$${a} \\cdot ${num(k)} = ${num(ans)}$`],
      diag: (u) => (near(u, bug) ? 'linear-area' : null),
    };
  }
}
/** A square enlarged by k on a grid: how many times the area. Practice only. */
function gridSquares() {
  const k = pick(rnd, [3, 4]);
  const choices = shuffle([{ tex: String(k * k), ok: true }, { tex: String(k), ok: false, bug: 'linear-area' }, { tex: String(2 * k), ok: false }]);
  return {
    key: `sm4g:${k}`, text: `ריבוע קטן הוגדל פי $${k}$: כל צלע ארוכה פי $${k}$. פי כמה גדל השטח?`,
    form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((x) => x.ok),
    fig: { type: 'fgrid', rows: k, cols: k, shadeRows: 1, shadeCols: 1, label: `1 על 1 בתוך ${k} על ${k}` },
    hint: 'כמה ריבועים קטנים נכנסים בריבוע הגדול?',
    solution: [`בריבוע הגדול $${k} \\cdot ${k} = ${k * k}$ ריבועים קטנים: השטח פי $${k * k}$.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- the levels (content/sim.js puts these on its stairs)
export const SIM_GENS = [
  () => { const r = Math.random(); return r < 0.3 ? isoX() : r < 0.5 ? isoAlt() : r < 0.65 ? isoCount() : r < 0.85 ? converseMc() : isoProof(); },
  () => { const r = Math.random(); return r < 0.45 ? missingSide() : r < 0.7 ? factor() : isSimilarMc(); },
  () => { const r = Math.random(); return r < 0.3 ? parallelCut() : r < 0.45 ? bowtie() : r < 0.6 ? shadow() : r < 0.75 ? aaWhich() : r < 0.9 ? aaProof() : angleCheck(); },
  () => { const r = Math.random(); return r < 0.35 ? areaK() : r < 0.55 ? perimK() : r < 0.75 ? kFromArea() : gridSquares(); },
];
/** Each generator by name (tests draw every kind). */
export const SIM_KINDS = { isoX, isoAlt, isoCount, converseMc, isoProof, missingSide, factor, isSimilarMc, parallelCut, bowtie, shadow, aaWhich, aaProof, angleCheck, areaK, perimK, kFromArea, gridSquares };
