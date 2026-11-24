// Boxes and prisms (תיבה ומנסרה): unit 7.13 of grade 7 (ז׳) in the Ministry's תשפ״ז schedule, the cube and the box in
// January and the triangular prism in May (curriculum stage 2, MEASURE-3). Four stairs: the box's net and surface area,
// the volume of a box and a cube (litres too), the triangular prism's net and surface area, and the prism's volume.
// Taught from January, so the first-day placement test skips it (placement: false, MEASURE-1.6).
//
// This file is the practice and diagnosis layer: the topic object, the names of its mistakes, the generators of every
// practice kind, and the eight diagnostic and transfer models (SOLID1 to SOLID4T) with their texts, drawings, solutions
// and hints. GRADE7 puts it on the path after the areas; its teaching is learn/content/solid.ts, its challenges
// learn/challenges/solid.ts.
//
// The models are the stage-2 spec's (scratchpad/lanes/stage2/spec/models.mjs), ported unchanged with the redraw rule of
// content/area.js (clean: no prediction that is a slip of the hand, near the answer or near another prediction).
// Practice kinds that share a model's situation draw through its params; every practice draw with a diagnosis is redrawn
// by the same rule, and every practice draw is redone while its answer is a number the question prints (noCopy), so
// copying a number from the question is never right. Units sit after the number, outside the maths, and an item's `unit`
// is the answer's unit; a question in litres says ליטר. Every number a drawing writes is in the text too. The net tasks
// (a face, a missing base, a box or a prism built from steppers) are the `net` object's (content/net.js, which the app
// loads after the first screen); this file does not import it, so the opposite faces of the eleven cube nets are written
// out below and checked against it by content/manip.test.js. Errors and their sources (stage2.md MEASURE-3):
//   three-faces, vol-for-surf, surf-for-vol   the box as "an uncoordinated set of faces" (Battista & Clements 1996, JRME
//                                   27(3)); surface area and volume in one test (Tan Şişman & Aksu 2016)
//   lid-counted                     the Ministry's sample exam asks the surface "כולל הבסיס והמכסה"; teacher-reported
//   three-edges                     the sample exam's sum of all edges; teacher-reported
//   cube-times3, square-not-cube    the classroom lane's pow-times; the Ministry: "חזקה שלישית ומציאת שורש שלישי"
//   no-convert, div-by-edge         the litre carton ("1000 סמ"ק") and small boxes in a big one; teacher-reported
//   one-base, missing-face, slant-as-height, add-legs   teacher-reported; "יש לדעת לסרטט פריסה של מנסרה משולשת"
//   no-half, hyp-as-height          the prism's volume "על ידי חציית תיבה לשתי מנסרות"
//   linear-volume, square-scale     De Bock, Verschaffel & Janssens (1998), ESM 35 (the linear model for area and volume)
//   no-root, one-divide, add-edges, opposite-adjacent   teacher-reported
import { shuffle } from './util.js';
import { fair, mk, diagList, bugsAt, triples, AREA2 } from './area.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const same = (a, b) => Math.abs(a - b) < 1e-9;
/** A number as written: 2.5, 0.012 (never 2.4999999). */
const num = (v) => String(Math.round(v * 1e9) / 1e9);

/** The units, written after the number and outside the maths. */
export const UNIT = { cm: 'ס״מ', cm2: 'סמ״ר', cm3: 'סמ״ק', m: 'מ׳', m2: 'מ״ר', m3: 'מ״ק', litre: 'ליטר', cubes: 'קוביות' };

/**
 * A practice draw: `f` returns { answer, printed, bugs? } (or null to draw again). It is redone while its answer is a
 * number the question prints, while a prediction is unfair (a slip, near the answer, near another prediction), or while
 * two different mistakes predict the same number (a box 2 by 3 by 6: three faces and the volume are both 36), so that a
 * diagnosis never names one of two mistakes at random. The models keep the spec's rule, which allows such a tie.
 */
const tie = (bugs) => bugs.some(([id, v], i) => v != null && bugs.some(([id2, w], j) => j > i && id2 !== id && w != null && same(v, w)));
function draw(f) {
  for (;;) {
    const q = f();
    if (!q) continue;
    if ((q.printed || []).some((v) => same(v, q.answer))) continue;
    if (q.bugs && (!fair(q.answer, q.bugs.map(([, v]) => v)) || tie(q.bugs))) continue;
    return q;
  }
}
/** A level's generator: one of its kinds, by weight. */
const byWeight = (kinds) => () => {
  let r = Math.random() * kinds.reduce((a, [w]) => a + w, 0);
  for (const [w, f] of kinds) { r -= w; if (r < 0) return f(); }
  return kinds[kinds.length - 1][1]();
};

// ---------------------------------------------------------------- boxes and right triangles with whole sides

/** Three different edges lo..hi, or null (redrawn: no fixed fallback box). */
export const box3 = (r, lo = 2, hi = 12) => { const a = rint(r, lo, hi); const b = rint(r, lo, hi); const c = rint(r, lo, hi); return new Set([a, b, c]).size === 3 ? { a, b, c } : null; };
/** A box's surface area. */
export const surf = ({ a, b, c }) => 2 * (a * b + b * c + a * c);
export const T17 = triples(17); // legs and hypotenuse up to 17
/** A triple in a random order of its legs: [leg1, leg2, hyp]. */
const tri = (r, list) => { const [p, q, c] = pick(r, list); return r() < 0.5 ? [p, q, c] : [q, p, c]; };
/** [b, h, s]: an isosceles triangle's base b, height h and legs s (b/2, h, s a triple). */
export const BHS = [[6, 4, 5], [8, 3, 5], [12, 8, 10], [16, 6, 10], [10, 12, 13], [24, 5, 13], [18, 12, 15], [24, 9, 15], [16, 15, 17]];
/**
 * [h, d, s]: the skateboard ramp's height, foot and slanted top, from the triples 3-4-5 to 8-15-17 (area.js HDS), the
 * height always below the foot: a ramp slopes under 45° (council round 3 found one 15 m high on an 8 m base).
 */
const RAMPS = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17]];

// ---------------------------------------------------------------- the models (models.mjs, unchanged)

/** solid:1 — the surface area of a box a by b by c. */
export const SOLID1 = mk({
  raw: (r) => { const q = box3(r); if (!q || q.a * q.b * q.c === surf(q)) return null; return q; },
  answer: surf,
  bugs: {
    'three-faces': ({ a, b, c }) => a * b + b * c + a * c, // one face of each pair
    'vol-for-surf': ({ a, b, c }) => a * b * c, // the volume
  },
});
/** solid:1 transfer — an open box (no lid, the lid a by b) painted outside. */
export const SOLID1T = mk({
  raw: (r) => { const q = box3(r); if (!q || q.a * q.b * q.c === surf(q) - q.a * q.b) return null; return q; },
  answer: (q) => surf(q) - q.a * q.b,
  bugs: {
    'lid-counted': (q) => surf(q), // a face the box does not have
    'vol-for-surf': ({ a, b, c }) => a * b * c,
  },
});

/** solid:2 — the volume of a box. */
export const SOLID2 = mk({
  raw: (r) => { const q = box3(r); if (!q || q.a * q.b * q.c === surf(q)) return null; return q; },
  answer: ({ a, b, c }) => a * b * c,
  bugs: {
    'surf-for-vol': surf, // the surface area
    'add-edges': ({ a, b, c }) => a + b + c, // the edges added, not multiplied
  },
});
/** solid:2 transfer — an aquarium in cm (multiples of 10): how many litres? (redrawn while the litres equal a dimension) */
export const SOLID2T = mk({
  raw: (r) => { const a = 10 * rint(r, 2, 9); const b = 10 * rint(r, 2, 6); const c = 10 * rint(r, 2, 6); if (new Set([a, b, c]).size < 3 || [a, b, c].includes((a * b * c) / 1000)) return null; return { a, b, c }; },
  answer: ({ a, b, c }) => (a * b * c) / 1000,
  bugs: {
    'no-convert': ({ a, b, c }) => a * b * c, // the cm³ given as litres
    'surf-for-vol': (q) => surf(q) / 1000,
  },
});

/** solid:3 — the surface area of a prism whose base is a right triangle p, q, c (all given), length L. */
export const SOLID3 = mk({
  raw: (r) => { const [p, q, c] = tri(r, T17); const L = rint(r, 4, 20); if (L === p || L === q || L === c) return null; return { p, q, c, L }; },
  answer: ({ p, q, c, L }) => p * q + L * (p + q + c),
  bugs: {
    'one-base': ({ p, q, c, L }) => (p * q) / 2 + L * (p + q + c), // one triangle only
    'missing-face': ({ p, q, L }) => p * q + L * (p + q), // the face on the hypotenuse left out
  },
});
/** solid:3 transfer — a tent: an isosceles triangle (base b, height h, legs s), length L; every face. */
export const SOLID3T = mk({
  raw: (r) => { const [b, h, s] = pick(r, BHS); const L = rint(r, 5, 20); return { b, h, s, L }; },
  answer: ({ b, h, s, L }) => b * h + L * (b + 2 * s),
  bugs: {
    'one-base': ({ b, h, s, L }) => (b * h) / 2 + L * (b + 2 * s),
    'slant-as-height': ({ b, s, L }) => b * s + L * (b + 2 * s), // the triangle's leg used as its height
  },
});

/** solid:4 — the volume of a prism, base a right triangle p, q (hypotenuse c shown), length L. */
export const SOLID4 = mk({
  raw: (r) => { const [p, q, c] = tri(r, T17); const L = rint(r, 3, 15); return { p, q, c, L }; },
  answer: ({ p, q, L }) => (p * q * L) / 2,
  bugs: {
    'no-half': ({ p, q, L }) => p * q * L, // the base taken as a rectangle
    'hyp-as-height': ({ p, c, L }) => (p * c * L) / 2, // a leg times the hypotenuse
  },
});
/** solid:4 transfer — a ramp: height h, foot d, slanted top s (a triple), width w. */
export const SOLID4T = mk({
  raw: (r) => { const [h, d, s] = pick(r, RAMPS); const w = rint(r, 2, 12); if (w === h || w === d || w === s) return null; return { h, d, s, w }; },
  answer: ({ h, d, w }) => (h * d * w) / 2,
  bugs: {
    'no-half': ({ h, d, w }) => h * d * w,
    'slant-as-height': ({ s, d, w }) => (s * d * w) / 2,
  },
});

/** Which models serve which stair, as its diagnostic and its transfer model. */
export const STAIR_MODELS = { 'solid:1': [SOLID1, SOLID1T], 'solid:2': [SOLID2, SOLID2T], 'solid:3': [SOLID3, SOLID3T], 'solid:4': [SOLID4, SOLID4T] };

// ---------------------------------------------------------------- drawings
// Still solid figures (components/SolidFigs.jsx): a box a long, b deep and c high; a prism with its base in front.

export const boxFig = ({ a, b, c }, extra = {}) => ({ type: 'solid', shape: 'box', a, b, c, ...extra });
export const cubeFig = (s, extra = {}) => ({ type: 'solid', shape: 'cube', a: s, ...extra });
/** A prism whose base is a right triangle: legs p (along the bottom) and q (up), the hypotenuse written when `c` is given. */
export const rightPrismFig = ({ p, q, c, L }, extra = {}) => ({ type: 'solid', shape: 'prism', p, q, ...(c ? { r: c } : {}), L, ...extra });

// ---------------------------------------------------------------- the models' words (texts, solutions, hints)

export const solid1Text = ({ a, b, c }) => `מה שטח הפנים של תיבה שמידותיה $${a}$ ס״מ, $${b}$ ס״מ ו־$${c}$ ס״מ?`;
export const solid1Fig = (p) => boxFig(p);
export const solid1Solution = ({ a, b, c }) => [
  `שלוש פאות שונות: $${a} \\cdot ${b} + ${a} \\cdot ${c} + ${b} \\cdot ${c} = ${a * b + a * c + b * c}$.`,
  `כל פאה מופיעה פעמיים: $2 \\cdot ${a * b + a * c + b * c} = ${surf({ a, b, c })}$ סמ״ר`,
];
export const solid1Hint = () => 'כמה פאות יש לתיבה, וכמה מהן שוות?';
/** solid:1 transfer: an open box painted outside. */
export const openBoxText = ({ a, b, c }) => `צובעים מבחוץ קופסה בלי מכסה, $${a}$ על $${b}$ על $${c}$ ס״מ (הפתח $${a}$ על $${b}$). כמה סמ״ר צובעים?`;
export const openBoxFig = (p) => boxFig(p, { open: true });
export const openBoxSolution = ({ a, b, c }) => [
  `שטח הפנים המלא: $2 \\cdot (${a * b} + ${a * c} + ${b * c}) = ${surf({ a, b, c })}$.`,
  `בלי המכסה, $${a} \\cdot ${b} = ${a * b}$: $${surf({ a, b, c })} - ${a * b} = ${surf({ a, b, c }) - a * b}$ סמ״ר`,
];
export const openBoxHint = () => 'לקופסה בלי מכסה יש חמש פאות. איזו פאה חסרה?';

export const solid2Text = ({ a, b, c }) => `מה נפח תיבה שמידותיה $${a}$ ס״מ, $${b}$ ס״מ ו־$${c}$ ס״מ?`;
export const solid2Fig = (p) => boxFig(p);
export const solid2Solution = ({ a, b, c }) => [`שטח הבסיס: $${a} \\cdot ${b} = ${a * b}$.`, `כפול הגובה: $${a * b} \\cdot ${c} = ${a * b * c}$ סמ״ק`];
export const solid2Hint = () => 'שטח הבסיס הוא כמה קוביות בשכבה, והגובה הוא כמה שכבות.';
/** solid:2 transfer: an aquarium's litres. */
export const tankText = ({ a, b, c }) => `אקווריום $${a}$ על $${b}$ על $${c}$ ס״מ. כמה ליטרים מים הוא מחזיק?`;
export const tankFig = (p) => boxFig(p);
export const tankSolution = ({ a, b, c }) => [`הנפח: $${a} \\cdot ${b} \\cdot ${c} = ${a * b * c}$ סמ״ק.`, `בליטר יש $1000$ סמ״ק: $${a * b * c} : 1000 = ${num((a * b * c) / 1000)}$ ליטר`];
export const tankHint = () => 'ליטר אחד הוא $1000$ סמ״ק.';

export const solid3Text = ({ p, q, c, L }) => `מנסרה ישרה שבסיסה משולש ישר־זווית: ניצבים $${p}$ ס״מ ו־$${q}$ ס״מ, יתר $${c}$ ס״מ, ואורכה $${L}$ ס״מ. מה שטח הפנים?`;
export const solid3Fig = (p) => rightPrismFig(p);
export const solid3Solution = ({ p, q, c, L }) => [
  `שני בסיסים: $2 \\cdot \\frac{${p} \\cdot ${q}}{2} = ${p * q}$.`,
  `שלוש הפאות הצדדיות: $(${p} + ${q} + ${c}) \\cdot ${L} = ${(p + q + c) * L}$.`,
  `$${p * q} + ${(p + q + c) * L} = ${p * q + (p + q + c) * L}$ סמ״ר`,
];
export const solid3Hint = () => 'שני משולשים ועוד שלושה מלבנים, אחד לכל צלע של המשולש.';
/** solid:3 transfer: a tent, every face. */
export const tentText = ({ b, h, s, L }) => `אוהל בצורת מנסרה משולשת. הבסיס משולש שווה־שוקיים: הצלע שעל הקרקע $${b}$ מ׳, הגובה אליה $${h}$ מ׳, וכל שוק $${s}$ מ׳. אורך האוהל $${L}$ מ׳. כמה מ״ר בד צריך לכל הפאות, כולל הרצפה?`;
export const tentFig = ({ b, h, s, L }) => ({ type: 'solid', shape: 'prism', p: b, h, q: s, L });
export const tentSolution = ({ b, h, s, L }) => [
  `שני המשולשים: $2 \\cdot \\frac{${b} \\cdot ${h}}{2} = ${b * h}$. הגובה הוא $${h}$, לא השוק $${s}$.`,
  `שלושת המלבנים: $(${b} + ${s} + ${s}) \\cdot ${L} = ${(b + 2 * s) * L}$.`,
  `$${b * h} + ${(b + 2 * s) * L} = ${b * h + (b + 2 * s) * L}$ מ״ר`,
];
export const tentHint = () => 'שטח משולש: צלע כפול הגובה אליה, חלקי $2$. השוק משופעת, והיא אינה הגובה.';

export const solid4Text = ({ p, q, c, L }) => `מנסרה שבסיסה משולש ישר־זווית: ניצבים $${p}$ ס״מ ו־$${q}$ ס״מ, יתר $${c}$ ס״מ, ואורכה $${L}$ ס״מ. מה הנפח?`;
export const solid4Fig = (p) => rightPrismFig(p);
export const solid4Solution = ({ p, q, L }) => [`שטח הבסיס: $\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}$.`, `כפול האורך: $${(p * q) / 2} \\cdot ${L} = ${(p * q * L) / 2}$ סמ״ק`];
export const solid4Hint = () => 'שטח הבסיס כפול האורך. הבסיס משולש: חצי ממלבן שצלעותיו הניצבים.';
/** solid:4 transfer: a skate ramp in concrete. */
export const rampText = ({ h, d, s, w }) => `רמפה לסקייטבורד בצורת מנסרה: גובה $${h}$ מ׳, אורך הבסיס $${d}$ מ׳, המשטח המשופע $${s}$ מ׳, ורוחב $${w}$ מ׳. כמה מ״ק בטון?`;
export const rampFig = ({ h, d, s, w }) => ({ type: 'solid', shape: 'prism', p: d, q: h, r: s, L: w });
export const rampSolution = ({ h, d, w }) => [`הבסיס משולש ישר־זווית שניצביו $${h}$ ו־$${d}$: $\\frac{${h} \\cdot ${d}}{2} = ${(h * d) / 2}$.`, `כפול הרוחב: $${(h * d) / 2} \\cdot ${w} = ${(h * d * w) / 2}$ מ״ק`];
export const rampHint = () => 'הבסיס משולש ישר־זווית: הגובה ואורך הבסיס הם הניצבים, והמשטח המשופע הוא היתר.';

// ---------------------------------------------------------------- the cube's nets

/**
 * The eleven cube nets (content/net.js NET_LAYOUTS, faces A–F in order) and the face opposite each face once the net is
 * folded, written out so this file needs no folding code; content/manip.test.js checks every pair against net.js.
 */
export const CUBE_OPPOSITE = {
  cross: { A: 'C', B: 'D', C: 'A', D: 'B', E: 'F', F: 'E' },
  t: { A: 'C', B: 'D', C: 'A', D: 'B', E: 'F', F: 'E' },
  l1: { A: 'C', B: 'D', C: 'A', D: 'B', E: 'F', F: 'E' },
  l2: { A: 'C', B: 'D', C: 'A', D: 'B', E: 'F', F: 'E' },
  z: { A: 'C', B: 'D', C: 'A', D: 'B', E: 'F', F: 'E' },
  s: { A: 'C', B: 'D', C: 'A', D: 'B', E: 'F', F: 'E' },
  hook1: { A: 'D', B: 'F', C: 'E', D: 'A', E: 'C', F: 'B' },
  hook2: { A: 'D', B: 'F', C: 'E', D: 'A', E: 'C', F: 'B' },
  hook3: { A: 'D', B: 'F', C: 'E', D: 'A', E: 'C', F: 'B' },
  steps: { A: 'D', B: 'E', C: 'F', D: 'A', E: 'B', F: 'C' },
  rows: { A: 'C', B: 'E', C: 'A', D: 'F', E: 'B', F: 'D' },
};
/** The cells of a net (as content/net.js NET_LAYOUTS has them), for drawing a net as a choice. */
export const CUBE_NETS = {
  cross: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2]],
  t: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [0, 2]],
  l1: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [1, 2]],
  l2: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [2, 2]],
  z: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [3, 2]],
  s: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [2, 2]],
  hook1: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [1, 2]],
  hook2: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [2, 2]],
  hook3: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]],
  steps: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
  rows: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],
};
/**
 * Six squares that do not fold into a cube (checked by folding in content/manip.test.js, each a different shape): five in
 * a row and one more (two ways), a 2 by 3 block, two squares on one side of a row of four (two ways), a 2 by 2 square
 * with a tail.
 */
export const NOT_NETS = {
  five: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1]],
  fiveEnd: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]],
  block: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  twoUp: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [2, 0]],
  twoApart: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [2, 0]],
  square: [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
};
const netChoiceFig = (cells) => ({ type: 'netfig', solid: 'cube', dims: { a: 1 }, layout: cells });
const LETTERS = ['א', 'ב', 'ג', 'ד'];

// ---------------------------------------------------------------- solid:1 — the box: its net and its surface area

/** The surface area of a box (the diagnostic model's draw). */
function so1s() {
  const p = draw(() => { const q = SOLID1.params(rnd); return { ...q, answer: SOLID1.answer(q), printed: [q.a, q.b, q.c], bugs: bugsAt(SOLID1, q) }; });
  return {
    key: `so1s:${p.a}:${p.b}:${p.c}`, text: solid1Text(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: solid1Fig(p),
    hint: solid1Hint(), solution: solid1Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** A cube: its surface area from the edge (s ≠ 6, where 6s² = s³), or the edge from the surface area. */
function so1c() {
  const p = draw(() => {
    const s = rint(rnd, 2, 12); if (s === 6) return null;
    return rnd() < 0.7
      ? { k: 0, s, answer: 6 * s * s, printed: [s], bugs: [['vol-for-surf', s ** 3]] }
      : { k: 1, s, answer: s, printed: [6 * s * s], bugs: [['no-root', s * s]] };
  });
  const { k, s } = p;
  return k === 0
    ? {
      key: `so1c:0:${s}`, text: `מה שטח הפנים של קובייה שמקצועה $${s}$ ס״מ?`, form: 'num', answer: p.answer, unit: UNIT.cm2, fig: cubeFig(s),
      hint: 'לקובייה שש פאות, וכל פאה ריבוע.',
      solution: [`פאה אחת: $${s} \\cdot ${s} = ${s * s}$.`, `שש פאות: $6 \\cdot ${s * s} = ${6 * s * s}$ סמ״ר`],
      diag: diagList(p.answer, p.bugs),
    }
    : {
      key: `so1c:1:${s}`, text: `שטח הפנים של קובייה $${6 * s * s}$ סמ״ר. מה אורך המקצוע?`, form: 'num', answer: s, unit: UNIT.cm, fig: cubeFig(s, { labels: { a: '?' } }),
      hint: 'קודם שטח פאה אחת: שש פאות שוות. ואז, איזה מספר כפול עצמו נותן אותו?',
      solution: [`פאה אחת: $${6 * s * s} : 6 = ${s * s}$.`, `$${s} \\cdot ${s} = ${s * s}$, ולכן המקצוע $${s}$ ס״מ`],
      diag: diagList(s, p.bugs),
    };
}

/** The sum of all twelve edges of a box with three different edges (redrawn: no fixed fallback box). */
function so1e() {
  const p = draw(() => { const q = box3(rnd, 2, 15); if (!q) return null; return { ...q, answer: 4 * (q.a + q.b + q.c), printed: [q.a, q.b, q.c], bugs: [['three-edges', q.a + q.b + q.c]] }; });
  const { a, b, c } = p;
  return {
    key: `so1e:${a}:${b}:${c}`, text: `מה סכום האורכים של כל המקצועות של תיבה שמידותיה $${a}$ ס״מ, $${b}$ ס״מ ו־$${c}$ ס״מ?`,
    form: 'num', answer: p.answer, unit: UNIT.cm, fig: boxFig(p),
    hint: 'לתיבה $12$ מקצועות: $4$ לאורך, $4$ לרוחב ו־$4$ לגובה.',
    solution: [`אחד מכל כיוון: $${a} + ${b} + ${c} = ${a + b + c}$.`, `מכל כיוון $4$ מקצועות: $4 \\cdot ${a + b + c} = ${p.answer}$ ס״מ`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** An open box painted outside (the transfer model's draw). */
function so1o() {
  const p = draw(() => { const q = SOLID1T.params(rnd); return { ...q, answer: SOLID1T.answer(q), printed: [q.a, q.b, q.c], bugs: bugsAt(SOLID1T, q) }; });
  return {
    key: `so1o:${p.a}:${p.b}:${p.c}`, text: openBoxText(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: openBoxFig(p),
    hint: openBoxHint(), solution: openBoxSolution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** Tap the face opposite the shaded one on a cube net (one of the eleven); a face beside it is opposite-adjacent. */
function so1n() {
  const layout = pick(rnd, Object.keys(CUBE_NETS)); const shade = pick(rnd, ['A', 'B', 'C', 'D', 'E', 'F']);
  const face = CUBE_OPPOSITE[layout][shade];
  return {
    key: `so1n:${layout}:${shade}`, text: 'הקישו על הפאה שתהיה מול הפאה הצבועה.', form: 'manip', practiceOnly: true,
    manip: { kind: 'net', solid: 'cube', dims: { a: 3 }, layout, task: 'face', shade, start: { face: null } },
    answer: { mode: 'face', face },
    hint: 'כשמקפלים, כל פאה שנוגעת בפאה הצבועה בפריסה נוגעת בה גם בקובייה. הנגדית לא נוגעת בה.',
    solution: [`פאה ${face} תהיה מול הפאה הצבועה, ${shade}: בקובייה הן לא נוגעות זו בזו.`],
    // any other face (not the shaded one) is beside it on the cube
    diag: (u) => (u && u.face && u.face !== face && u.face !== shade ? 'opposite-adjacent' : null),
  };
}

/** Which of four nets of six squares folds into a cube: one of the eleven, three that do not. Practice only. */
function so1m() {
  const good = pick(rnd, Object.keys(CUBE_NETS));
  const bad = shuffle(Object.keys(NOT_NETS)).slice(0, 3);
  const choices = shuffle([{ ok: true, net: good, cells: CUBE_NETS[good] }, ...bad.map((k) => ({ ok: false, net: k, cells: NOT_NETS[k] }))])
    .map((c, i) => ({ text: `פריסה ${LETTERS[i]}`, ok: c.ok, fig: netChoiceFig(c.cells), net: c.net }));
  const answer = choices.findIndex((c) => c.ok);
  return {
    key: `so1m:${choices.map((c) => c.net).join(',')}`, text: 'איזו מהפריסות תתקפל לקובייה?', form: 'mc', choices, answer, practiceOnly: true,
    hint: 'בקובייה כל פאה נוגעת בארבע פאות אחרות. שתי פאות זו ליד זו באותו צד של שורה ייפגשו בקיפול.',
    solution: [`${choices[answer].text} מתקפלת לקובייה: ארבע פאות בשורה מסתובבות סביב, ושתי האחרות סוגרות משני הצדדים.`, 'בשאר הפריסות שתי פאות נפגשות באותו מקום, ונשאר צד פתוח.'],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- solid:2 — the volume of a box and of a cube

/** The volume of a box (the diagnostic model's draw). */
function so2v() {
  const p = draw(() => { const q = SOLID2.params(rnd); return { ...q, answer: SOLID2.answer(q), printed: [q.a, q.b, q.c], bugs: bugsAt(SOLID2, q) }; });
  return {
    key: `so2v:${p.a}:${p.b}:${p.c}`, text: solid2Text(p), form: 'num', answer: p.answer, unit: UNIT.cm3, fig: solid2Fig(p),
    hint: solid2Hint(), solution: solid2Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The third edge from the volume and two edges; divided by one edge only is one-divide. */
function so2m() {
  const p = draw(() => {
    const q = box3(rnd); if (!q) return null; const V = q.a * q.b * q.c;
    return { ...q, V, answer: q.c, printed: [V, q.a, q.b], bugs: [['one-divide', V / q.a], ['one-divide', V / q.b]] };
  });
  const { a, b, c, V } = p;
  return {
    key: `so2m:${V}:${a}:${b}`, text: `נפח תיבה $${V}$ סמ״ק, ושני מקצועותיה $${a}$ ס״מ ו־$${b}$ ס״מ. מה המקצוע השלישי?`,
    form: 'num', answer: c, unit: UNIT.cm, fig: boxFig(p, { labels: { a, b, c: '?' } }),
    hint: 'הנפח הוא שטח הבסיס כפול הגובה. מה שטח הבסיס?',
    solution: [`שטח הבסיס: $${a} \\cdot ${b} = ${a * b}$.`, `$${V} : ${a * b} = ${c}$ ס״מ`],
    diag: diagList(c, p.bugs),
  };
}

/** A cube (s 2..10, never 3, where 3s = s²): its volume, or its edge from the volume (a cube root found by trying). */
function so2c() {
  const p = draw(() => {
    const s = rint(rnd, 2, 10); if (s === 3) return null;
    return rnd() < 0.5
      ? { k: 0, s, answer: s ** 3, printed: [s], bugs: [['cube-times3', 3 * s], ['square-not-cube', s * s]] }
      : { k: 1, s, answer: s, printed: [s ** 3], bugs: [['cube-times3', s ** 3 / 3]] };
  });
  const { k, s } = p;
  return k === 0
    ? {
      key: `so2c:0:${s}`, text: `מה נפח קובייה שמקצועה $${s}$ ס״מ?`, form: 'num', answer: p.answer, unit: UNIT.cm3, fig: cubeFig(s),
      hint: 'אורך כפול רוחב כפול גובה, וכולם שווים: חזקה שלישית.',
      solution: [`$${s}^3 = ${s} \\cdot ${s} \\cdot ${s}$.`, `$${s} \\cdot ${s} \\cdot ${s} = ${s ** 3}$ סמ״ק`],
      diag: diagList(p.answer, p.bugs),
    }
    : {
      key: `so2c:1:${s}`, text: `נפח קובייה $${s ** 3}$ סמ״ק. מה אורך המקצוע?`, form: 'num', answer: s, unit: UNIT.cm, fig: cubeFig(s, { labels: { a: '?' } }),
      hint: 'נסו מספרים: $2^3 = 8$, $3^3 = 27$, $4^3 = 64$, $5^3 = 125$.',
      solution: [`מחפשים מספר שכפול עצמו שלוש פעמים נותן $${s ** 3}$.`, `$${s} \\cdot ${s} \\cdot ${s} = ${s ** 3}$, ולכן המקצוע $${s}$ ס״מ`],
      diag: diagList(s, p.bugs),
    };
}

/** Litres: a tank's litres from its sides in cm (the transfer model's draw), or the water's height from the litres poured. */
function so2l() {
  const p = draw(() => {
    if (rnd() < 0.5) { const q = SOLID2T.params(rnd); return { k: 0, ...q, answer: SOLID2T.answer(q), printed: [q.a, q.b, q.c], bugs: bugsAt(SOLID2T, q) }; }
    const a = pick(rnd, [10, 20, 25, 30, 40, 50]); const b = pick(rnd, [10, 20, 25, 30, 40, 50]); const L = rint(rnd, 2, 20); const h = (1000 * L) / (a * b);
    if (!Number.isInteger(h) || h > 60 || h < 2) return null;
    return { k: 1, a, b, L, answer: h, printed: [a, b, L], bugs: [['no-convert', L / (a * b)]] };
  });
  if (p.k === 0) {
    return {
      key: `so2l:0:${p.a}:${p.b}:${p.c}`, text: tankText(p), form: 'num', answer: p.answer, unit: UNIT.litre, fig: tankFig(p),
      hint: tankHint(), solution: tankSolution(p), diag: diagList(p.answer, p.bugs),
    };
  }
  const { a, b, L, answer: h } = p;
  return {
    key: `so2l:1:${a}:${b}:${L}`, text: `מיכל בצורת תיבה, בסיסו $${a}$ על $${b}$ ס״מ. שופכים לתוכו $${L}$ ליטרים. לאיזה גובה יגיעו המים?`,
    form: 'num', answer: h, unit: UNIT.cm,
    hint: 'העבירו את הליטרים לסמ״ק: ליטר אחד הוא $1000$ סמ״ק. ואז נפח לחלק לשטח הבסיס.',
    solution: [`$${L}$ ליטרים הם $${1000 * L}$ סמ״ק. שטח הבסיס: $${a} \\cdot ${b} = ${a * b}$.`, `$${1000 * L} : ${a * b} = ${h}$ ס״מ`],
    diag: diagList(h, p.bugs),
  };
}

/** How many cubes of edge e (2 or 3) fill a box whose sides are multiples of e; divided by the edge is div-by-edge. */
function so2f() {
  const p = draw(() => {
    const e = pick(rnd, [2, 3]); const a = e * rint(rnd, 2, 6); const b = e * rint(rnd, 2, 5); const c = e * rint(rnd, 1, 4);
    return { e, a, b, c, answer: (a / e) * (b / e) * (c / e), printed: [a, b, c, e], bugs: [['div-by-edge', (a * b * c) / e]] };
  });
  const { e, a, b, c } = p;
  return {
    key: `so2f:${e}:${a}:${b}:${c}`, text: `כמה קוביות שמקצוען $${e}$ ס״מ נכנסות בתיבה $${a}$ על $${b}$ על $${c}$ ס״מ?`,
    form: 'num', answer: p.answer, unit: UNIT.cubes, fig: boxFig(p),
    hint: `כמה קוביות של $${e}$ ס״מ נכנסות לאורך, כמה לרוחב וכמה לגובה?`,
    solution: [`לאורך $${a} : ${e} = ${a / e}$, לרוחב $${b} : ${e} = ${b / e}$, לגובה $${c} : ${e} = ${c / e}$.`, `$${a / e} \\cdot ${b / e} \\cdot ${c / e} = ${p.answer}$ קוביות`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** Build a box with a given volume and height from unit cubes (the target is named): practice only. */
function so2b() {
  for (;;) {
    const a = rint(rnd, 2, 6); const b = rint(rnd, 2, 5); const c = rint(rnd, 2, 4); const V = a * b * c;
    if (V === c) continue;
    return {
      key: `so2b:${V}:${c}`, text: `בנו תיבה שנפחה $${V}$ סמ״ק וגובהה $${c}$.`, form: 'manip', practiceOnly: true,
      manip: { kind: 'net', solid: 'box', task: 'build', start: { a: 1, b: 1, c } }, answer: { mode: 'build', V, fixed: { c } },
      hint: `$${c}$ שכבות של $${V / c}$ קוביות. איזה אורך ורוחב נותנים $${V / c}$?`,
      solution: [`בכל שכבה $${V} : ${c} = ${V / c}$ קוביות, למשל $${a}$ על $${b}$: $${a} \\cdot ${b} \\cdot ${c} = ${V}$.`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- solid:3 — the triangular prism: its net and its surface

/** The surface area of a right-triangle prism, every side written (the diagnostic model's draw). */
function so3s() {
  const p = draw(() => { const q = SOLID3.params(rnd); return { ...q, answer: SOLID3.answer(q), printed: [q.p, q.q, q.c, q.L], bugs: bugsAt(SOLID3, q) }; });
  return {
    key: `so3s:${p.p}:${p.q}:${p.c}:${p.L}`, text: solid3Text(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: solid3Fig(p),
    hint: solid3Hint(), solution: solid3Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The same with only the legs written: the hypotenuse by Pythagoras (add-legs: the legs' sum taken for it). */
function so3h() {
  const p = draw(() => {
    const q = SOLID3.params(rnd); const { p: a, q: b, c, L } = q;
    return { ...q, answer: SOLID3.answer(q), printed: [a, b, L], bugs: [['missing-face', a * b + L * (a + b)], ['add-legs', a * b + L * (a + b + a + b)]] };
  });
  const { p: a, q: b, c, L } = p;
  return {
    key: `so3h:${a}:${b}:${L}`, text: `מנסרה ישרה שבסיסה משולש ישר־זווית שניצביו $${a}$ ס״מ ו־$${b}$ ס״מ, ואורכה $${L}$ ס״מ. מה שטח הפנים?`,
    form: 'num', answer: p.answer, unit: UNIT.cm2, fig: rightPrismFig({ p: a, q: b, L }),
    hint: 'הפאה השלישית עומדת על היתר. מצאו אותו בפיתגורס.',
    solution: [
      `היתר: $\\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}$.`,
      `שני בסיסים $${a * b}$, ושלוש הפאות הצדדיות $(${a} + ${b} + ${c}) \\cdot ${L} = ${(a + b + c) * L}$.`,
      `$${a * b} + ${(a + b + c) * L} = ${p.answer}$ סמ״ר`,
    ],
    diag: diagList(p.answer, p.bugs),
  };
}

/** The lateral faces of a prism whose base has sides a, b, c (a real triangle): the base's perimeter times the length. */
function so3l() {
  const p = draw(() => {
    const a = rint(rnd, 3, 12); const b = rint(rnd, 3, 12); const c = rint(rnd, 3, 12);
    if (a + b <= c || a + c <= b || b + c <= a) return null;
    const L = rint(rnd, 4, 20);
    return { a, b, c, L, answer: (a + b + c) * L, printed: [a, b, c, L] };
  });
  const { a, b, c, L } = p;
  return {
    key: `so3l:${a}:${b}:${c}:${L}`, text: `בסיס המנסרה משולש שצלעותיו $${a}$ ס״מ, $${b}$ ס״מ ו־$${c}$ ס״מ, ואורכה $${L}$ ס״מ. מה שטח הפאות הצדדיות?`,
    form: 'num', answer: p.answer, unit: UNIT.cm2, fig: { type: 'solid', shape: 'prism', p: a, q: b, r: c, L },
    hint: 'בפריסה הפאות הצדדיות הן מלבן אחד: רוחבו היקף המשולש וגובהו אורך המנסרה.',
    solution: [`היקף הבסיס: $${a} + ${b} + ${c} = ${a + b + c}$.`, `$${a + b + c} \\cdot ${L} = ${p.answer}$ סמ״ר`],
    diag: () => null,
  };
}

/** A tent: an isosceles base, every face (the transfer model's draw). */
function so3i() {
  const p = draw(() => { const q = SOLID3T.params(rnd); return { ...q, answer: SOLID3T.answer(q), printed: [q.b, q.h, q.s, q.L], bugs: bugsAt(SOLID3T, q) }; });
  return {
    key: `so3i:${p.b}:${p.h}:${p.s}:${p.L}`, text: tentText(p), form: 'num', answer: p.answer, unit: UNIT.m2, fig: tentFig(p),
    hint: tentHint(), solution: tentSolution(p), diag: diagList(p.answer, p.bugs),
  };
}

/**
 * A prism's net with a base missing: put the triangle where the net folds closed. With the base E loose, every slot at
 * the far end of the strip closes it (content/net.js computes them; content/manip.test.js folds every set). Practice only.
 */
export const PRISM_FIX_OK = ['A-down', 'B-down', 'C-down'];
function so3n() {
  const [p, q, c] = tri(rnd, triples(13)); const L = rint(rnd, 4, 8);
  return {
    key: `so3n:${p}:${q}:${L}`, text: 'בפריסה חסר בסיס. גררו אותו למקום שבו הפריסה נסגרת.', form: 'manip', practiceOnly: true,
    manip: { kind: 'net', solid: 'prism', dims: { p, q, r: c, L }, task: 'fix', loose: 'E', start: { slot: null } },
    answer: { mode: 'slot', ok: PRISM_FIX_OK },
    hint: 'הבסיס השני צריך להיות בקצה השני של הפאות הצדדיות, מול הבסיס שכבר יש.',
    solution: ['הבסיס החסר נכנס בקצה התחתון של אחד המלבנים: כשמקפלים, הוא סוגר את המנסרה מול הבסיס העליון.'],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- solid:4 — the volume of a prism

/** The volume of a right-triangle prism, the hypotenuse written too (the diagnostic model's draw). */
function so4v() {
  const p = draw(() => { const q = SOLID4.params(rnd); return { ...q, answer: SOLID4.answer(q), printed: [q.p, q.q, q.c, q.L], bugs: bugsAt(SOLID4, q) }; });
  return {
    key: `so4v:${p.p}:${p.q}:${p.c}:${p.L}`, text: solid4Text(p), form: 'num', answer: p.answer, unit: UNIT.cm3, fig: solid4Fig(p),
    hint: solid4Hint(), solution: solid4Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** A prism on any triangle: a side b, the height h to it (inside the triangle) and a slanted side s (area2's draw), length L. */
function so4a() {
  const p = draw(() => {
    const q = AREA2.params(rnd); if (q.out) return null; const L = rint(rnd, 3, 15);
    return { ...q, L, answer: (q.b * q.h * L) / 2, printed: [q.b, q.h, q.s, L], bugs: [['no-half', q.b * q.h * L], ['slant-as-height', (q.b * q.s * L) / 2]] };
  });
  const { b, h, s, L } = p;
  return {
    key: `so4a:${b}:${h}:${s}:${L}`, text: `בסיס המנסרה משולש: צלע $${b}$ ס״מ, הגובה אליה $${h}$ ס״מ, וצלע נוספת $${s}$ ס״מ. אורך המנסרה $${L}$ ס״מ. מה הנפח?`,
    form: 'num', answer: p.answer, unit: UNIT.cm3, fig: { type: 'solid', shape: 'prism', p: b, h, q: s, L },
    hint: 'שטח הבסיס: צלע כפול הגובה אליה, חלקי $2$. הצלע הנוספת משופעת.',
    solution: [`שטח הבסיס: $\\frac{${b} \\cdot ${h}}{2} = ${(b * h) / 2}$. הצלע $${s}$ משופעת, והיא אינה הגובה.`, `$${(b * h) / 2} \\cdot ${L} = ${p.answer}$ סמ״ק`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** A prism's length from its volume and the legs of its right-triangle base; no-half divides by the legs' product. */
function so4m() {
  const p = draw(() => {
    const [a, b] = tri(rnd, T17); const L = rint(rnd, 3, 15); if (L === a || L === b) return null; const V = (a * b * L) / 2;
    return { a, b, L, V, answer: L, printed: [V, a, b], bugs: [['no-half', V / (a * b)]] };
  });
  const { a, b, L, V } = p;
  return {
    key: `so4m:${V}:${a}:${b}`, text: `נפח המנסרה $${V}$ סמ״ק, ובסיסה משולש ישר־זווית שניצביו $${a}$ ס״מ ו־$${b}$ ס״מ. מה אורכה?`,
    form: 'num', answer: L, unit: UNIT.cm, fig: rightPrismFig({ p: a, q: b, L }, { labels: { p: a, q: b, L: '?' } }),
    hint: 'הנפח הוא שטח הבסיס כפול האורך. מה שטח הבסיס?',
    solution: [`שטח הבסיס: $\\frac{${a} \\cdot ${b}}{2} = ${(a * b) / 2}$.`, `$${V} : ${(a * b) / 2} = ${L}$ ס״מ`],
    diag: diagList(L, p.bugs),
  };
}

/** A box with three different edges and an even volume, cut along a diagonal of its base: each half (redrawn). */
function so4h() {
  const p = draw(() => { const q = box3(rnd); if (!q || (q.a * q.b * q.c) % 2) return null; return { ...q, answer: (q.a * q.b * q.c) / 2, printed: [q.a, q.b, q.c], bugs: [['no-half', q.a * q.b * q.c]] }; });
  const { a, b, c } = p;
  return {
    key: `so4h:${a}:${b}:${c}`, text: `חותכים תיבה $${a}$ על $${b}$ על $${c}$ ס״מ לאורך אלכסון של הבסיס. מה הנפח של כל חצי?`,
    form: 'num', answer: p.answer, unit: UNIT.cm3, fig: boxFig(p, { cut: 'diagonal' }),
    hint: 'האלכסון חוצה את הבסיס לשני משולשים שווים, ולכן את התיבה לשתי מנסרות שוות.',
    solution: [`התיבה: $${a} \\cdot ${b} \\cdot ${c} = ${a * b * c}$.`, `כל חצי: $${a * b * c} : 2 = ${p.answer}$ סמ״ק`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** Every edge of a cube times k (2..5): the volume grows k³ times. The answer is one of four numbers: practice only. */
function so4k() {
  const k = rint(rnd, 2, 5);
  return {
    key: `so4k:${k}`, text: `מכפילים כל מקצוע של קובייה פי $${k}$. פי כמה גדל הנפח?`, form: 'num', answer: k ** 3, practiceOnly: true,
    hint: 'הנפח הוא אורך כפול רוחב כפול גובה, וכל אחד מהם גדל פי אותו מספר.',
    solution: [`האורך, הרוחב והגובה גדלים כל אחד פי $${k}$.`, `$${k} \\cdot ${k} \\cdot ${k} = ${k ** 3}$: הנפח גדל פי $${k ** 3}$`],
    diag: diagList(k ** 3, [['linear-volume', k], ['square-scale', k * k]]),
  };
}

/** Build a right-triangle prism with a given volume and length from steppers (the target is named): practice only. */
function so4b() {
  for (;;) {
    const p = rint(rnd, 2, 6); const q = rint(rnd, 2, 6); const L = rint(rnd, 2, 8); if ((p * q) % 2) continue;
    const V = (p * q * L) / 2; if (V === L / 2) continue;
    return {
      key: `so4b:${V}:${L}`, text: `בנו מנסרה שנפחה $${V}$ ואורכה $${L}$.`, form: 'manip', practiceOnly: true,
      manip: { kind: 'net', solid: 'prism', task: 'build', start: { p: 1, q: 1, L } }, answer: { mode: 'build', V, fixed: { L } },
      hint: `שטח הבסיס צריך להיות $${V} : ${L} = ${V / L}$. אילו ניצבים נותנים משולש בשטח $${V / L}$?`,
      solution: [`ניצבים $${p}$ ו־$${q}$: שטח הבסיס $\\frac{${p} \\cdot ${q}}{2} = ${(p * q) / 2}$, ו־$${(p * q) / 2} \\cdot ${L} = ${V}$.`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- the topic

/** The practice kinds of each stair with their weights (stage2.md MEASURE-3; "check" kinds may be in a check). */
export const KINDS = {
  1: [[35, so1s], [15, so1c], [15, so1e], [15, so1o], [10, so1n], [10, so1m]],
  2: [[30, so2v], [20, so2m], [15, so2c], [15, so2l], [10, so2f], [10, so2b]],
  3: [[35, so3s], [20, so3h], [15, so3l], [15, so3i], [15, so3n]],
  4: [[35, so4v], [20, so4a], [15, so4m], [10, so4h], [10, so4k], [10, so4b]],
};
/** Every kind's key prefix, by stair. */
export const KIND_KEYS = Object.fromEntries(Object.entries(KINDS).map(([lv, list]) => [lv, list.map(([, f]) => f.name)]));

export const SOLID = {
  id: 'solid', grade: '7', title: 'תיבה ומנסרה', desc: 'פריסה, שטח פנים ונפח של קובייה, תיבה ומנסרה משולשת', color: 'petrol',
  // taught in January (the cube and the box) and May (the prism): the first-day placement test does not ask it
  placement: false,
  levels: [
    { title: 'תיבה: פריסה ושטח פנים', gen: byWeight(KINDS[1]) },
    { title: 'נפח תיבה וקובייה', gen: byWeight(KINDS[2]) },
    { title: 'מנסרה משולשת: פריסה ושטח פנים', gen: byWeight(KINDS[3]) },
    { title: 'נפח מנסרה', gen: byWeight(KINDS[4]) },
  ],
  cats: {
    // the ids other topics already use keep their names, but for two said in this unit's words: area's one-base (here
    // the prism's two bases) and ratio's no-convert (here cm³ and litres)
    'three-faces': 'ספרו רק שלוש פאות, אחת מכל זוג',
    'vol-for-surf': 'חישבו נפח במקום שטח פנים',
    'three-edges': 'חיברו רק שלושה מקצועות, אחד מכל כיוון',
    'lid-counted': 'ספרו גם פאה שאין לקופסה',
    'no-root': 'שכחו להוציא שורש',
    'opposite-adjacent': 'בחרו פאה צמודה במקום הפאה הנגדית',
    'surf-for-vol': 'חישבו שטח פנים במקום נפח',
    'add-edges': 'חיברו את המקצועות במקום לכפול',
    'one-divide': 'חילקו רק באחד המקצועות',
    'cube-times3': 'כפלו ב־$3$ במקום להעלות בחזקה שלישית',
    'square-not-cube': 'העלו בריבוע במקום בחזקה שלישית',
    'no-convert': 'שכחו להמיר בין סמ״ק לליטרים',
    'div-by-edge': 'חילקו את הנפח במקצוע של הקובייה הקטנה ולא בנפח שלה',
    'one-base': 'ספרו רק בסיס אחד',
    'missing-face': 'שכחו את הפאה הצדדית שעל היתר',
    'slant-as-height': 'כפלו בצלע משופעת במקום בגובה',
    'add-legs': 'חיברו את הצלעות בלי לרבע',
    'no-half': 'שכחו לחלק ב־2 בשטח המשולש',
    'hyp-as-height': 'כפלו ביתר במקום בניצב',
    'linear-volume': 'חשבו שהנפח גדל פי אותו מספר כמו המקצועות',
    'square-scale': 'חשבו שהנפח גדל כמו שטח',
  },
  lesson: {
    points: [
      'לתיבה $6$ פאות, $12$ מקצועות ו־$8$ קודקודים.',
      'שטח הפנים של תיבה $5 \\cdot 3 \\cdot 2$: $2 \\cdot (15 + 10 + 6) = 62$ סמ״ר.',
      'נפח התיבה: $5 \\cdot 3 \\cdot 2 = 30$ סמ״ק.',
      'ליטר אחד הוא $1000$ סמ״ק.',
      'מנסרה משולשת: שני בסיסים משולשים ושלוש פאות מלבניות.',
      'נפח מנסרה: שטח הבסיס כפול האורך.',
    ],
    words: ['גוף', 'פאה', 'מקצוע', 'קודקוד', 'תיבה', 'קובייה', 'פריסה', 'פאות נגדיות', 'פאות סמוכות', 'שטח פנים', 'נפח', 'סמ״ק', 'ליטר', 'חזקה שלישית', 'שורש שלישי', 'מנסרה משולשת ישרה', 'בסיסי המנסרה', 'פאות צדדיות', 'אורך המנסרה'],
  },
};
