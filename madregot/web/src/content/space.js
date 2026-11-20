// Pythagoras in space (פיתגורס במרחב): unit 8.17 of grade 8 (ח׳) in the Ministry's תשפ״ז schedule, May, with June's
// mandatory task (curriculum stage 2, MEASURE-5). Two stairs: the diagonal of a box and of a cube (a face's diagonal told
// apart from the box's, an edge found from the diagonal), and the right triangles inside solids (the longest rod in a
// cylinder, the triangle a box's diagonal stands in, the face on a prism's hypotenuse, and the cone met in October once
// more). Taught in May, so the first-day placement test skips it (placement: false, MEASURE-1.6).
//
// This file is the practice and diagnosis layer: the topic object, the names of its mistakes, the generators of every
// practice kind, and the four diagnostic and transfer models (SPACE1 to SPACE2T) with their texts, drawings, solutions
// and hints. GRADE8 puts it last on the ח׳ path (May); its teaching is learn/content/space.ts, its challenges
// learn/challenges/space.ts.
//
// The models are the stage-2 spec's (scratchpad/lanes/stage2/spec/models.mjs), ported unchanged with the redraw rule of
// content/area.js (clean: no prediction that is a slip of the hand, near the answer or near another prediction).
// Practice kinds that share a model's situation draw through its params; every practice draw with a diagnosis is redrawn
// by the same rule and when two different mistakes give the same number, and every practice draw is redone while its
// answer is a number the question prints (noCopy), so copying a number from the question is never right. A length that is
// not whole (a face's diagonal, a cube's) is rounded to tenths with `exact`, as Pythagoras does (content/grade8.js), and
// right within half a tenth of it. Units sit after the number, outside the maths; every number a drawing writes is in
// its text too. The cone's volume (sp2v) is circle:4's model again (content/circle.js CIRCLE4), with the height left out.
// Errors and their sources (stage2.md MEASURE-5):
//   face-for-space, which-diagonal  the Ministry's topic page: "יש להבחין בין אלכסון של פאה … לבין אלכסון של תיבה";
//                                   teacher-reported
//   add-edges3, add-legs            the error pyth already names (add-legs, content/grade8.js)
//   no-root, add-not-sub            pyth's ids
//   r-for-d                         teacher-reported; the Ministry: "חתך צירי של גליל"
//   no-half                         linear's id; teacher-reported (the triangle inside a box not halved)
//   slant-as-height, no-third       circle's ids (the cone's volume once more)
import { shuffle } from './util.js';
import { fair, mk, diagList, bugsAt, triples } from './area.js';
import { CIRCLE4 } from './circle.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const same = (a, b) => Math.abs(a - b) < 1e-9;
const r1 = (v) => Math.round(v * 10) / 10;
/** A number as written: 6.7, 13 (never 6.69999). */
const num = (v) => String(Math.round(v * 1e9) / 1e9);

/** The units, written after the number and outside the maths. */
export const UNIT = { cm: 'ס״מ', cm2: 'סמ״ר', cm3: 'סמ״ק' };
/** The end of a question whose length may not be whole. */
const ROUND = 'עגלו לעשירית.';
/** The end of a question whose length may or may not be whole (pyth's words, content/grade8.js). */
const MAYBE_ROUND = 'אם יוצא מספר לא שלם, עגלו לעשירית.';
const WITH_PI = 'כתבו בעזרת $\\pi$.';
const LETTERS = ['א', 'ב', 'ג'];

/**
 * A practice draw: `f` returns { answer, printed, bugs? } (or null to draw again). It is redone while its answer is a
 * number the question prints, while a prediction is unfair (a slip, near the answer, near another prediction), or while
 * two different mistakes predict the same number, so a diagnosis never names one of two mistakes at random.
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

// ---------------------------------------------------------------- the models (models.mjs, unchanged)

const T30 = triples(30);
const T20 = triples(20);
/** Boxes a ≤ b ≤ c ≤ max whose space diagonal is whole. */
export function quads(max) {
  const out = [];
  for (let a = 1; a <= max; a += 1) for (let b = a; b <= max; b += 1) for (let c = b; c <= max; c += 1) { const d = Math.sqrt(a * a + b * b + c * c); if (Number.isInteger(d)) out.push([a, b, c, d]); }
  return out;
}
const Q20 = quads(20);
/** A triple in a random order of its legs: [leg1, leg2, hyp]. */
const tri = (r, list) => { const [p, q, c] = pick(r, list); return r() < 0.5 ? [p, q, c] : [q, p, c]; };

/** space:1 — the diagonal of a box (whole), its base a by b and its height c; never a cube. */
export const SPACE1 = mk({
  raw: (r) => { const [a, b, c, d] = pick(r, Q20); if (a === b && b === c) return null; const o = [[a, b, c], [a, c, b], [b, c, a]][rint(r, 0, 2)]; return { a: o[0], b: o[1], c: o[2], d }; },
  answer: ({ d }) => d,
  bugs: {
    'face-for-space': ({ a, b }) => Math.sqrt(a * a + b * b), // the base's diagonal only (a by b is the base)
    'add-edges3': ({ a, b, c }) => a + b + c, // along the edges
    'no-root': ({ d }) => d * d,
  },
});
/** space:1 transfer — the longest stick that fits in a crate a by b by c. */
export const SPACE1T = mk({ raw: SPACE1.raw, answer: SPACE1.answer, bugs: { 'face-for-space': SPACE1.bugs['face-for-space'], 'add-edges3': SPACE1.bugs['add-edges3'] } });

/** The cylinders whose diameter d (even), height h and longest rod make a triple, the rod at most 30. */
const DHR = T30.flatMap(([p, q, c]) => [[p, q, c], [q, p, c]]).filter(([d]) => d % 2 === 0);
/** space:2 — the longest rod in a cylinder: the diagonal of its axial section, 2r by h. */
export const SPACE2 = mk({
  raw: (r) => { const [d, h, rod] = pick(r, DHR); return { r: d / 2, d, h, rod }; },
  answer: ({ rod }) => rod,
  bugs: {
    'r-for-d': ({ r, h }) => Math.sqrt(r * r + h * h), // the radius as the section's width
    'add-legs': ({ d, h }) => d + h,
  },
});
/** The bases a by b whose diagonal e is whole (legs up to 20), in either order. */
const ABE = T30.filter(([, q]) => q <= 20).flatMap(([p, q, c]) => [[p, q, c], [q, p, c]]);
/**
 * space:2 transfer — the right triangle inside a box: the base's diagonal e, the upright edge c at its end and the box's
 * diagonal; its area e·c/2 (c not a side of the base or its diagonal, e·c even).
 */
export const SPACE2T = mk({
  raw: (r) => { const [a, b, e] = pick(r, ABE); const c = rint(r, 2, 20); if (c === a || c === b || c === e || (e * c) % 2) return null; return { a, b, e, c }; },
  answer: ({ e, c }) => (e * c) / 2,
  bugs: {
    'add-legs': ({ a, b, c }) => ((a + b) * c) / 2, // the base's diagonal taken as a + b
    'no-half': ({ e, c }) => e * c, // the triangle's legs multiplied, not halved
  },
});

/** Which models serve which stair, as its diagnostic and its transfer model. */
export const STAIR_MODELS = { 'space:1': [SPACE1, SPACE1T], 'space:2': [SPACE2, SPACE2T] };

// ---------------------------------------------------------------- drawings
// A box is a solid figure (components/SolidFigs.jsx): a long, b deep, c high, its corners V0 to V7 (V0 the front bottom
// left, V6 the back top right); diag 'face' marks the base's diagonal (V0 to V5), 'space' the box's (V0 to V6), 'tri' the
// right triangle between them and the upright edge; segs draws labelled segments between corners.

export const boxFig = (a, b, c, extra = {}) => ({ type: 'solid', shape: 'box', a, b, c, ...extra });
export const cubeFig = (a, extra = {}) => ({ type: 'solid', shape: 'cube', a, ...extra });
export const cylFig = (r, h, extra = {}) => ({ type: 'solid', shape: 'cylinder', r, h, ...extra });
export const coneFig = (r, h, l, extra = {}) => ({ type: 'solid', shape: 'cone', r, h, ...(l != null ? { l } : {}), ...extra });
/** A right triangular prism: legs p (along the bottom) and q (up), length L. */
export const prismFig = (p, q, L, extra = {}) => ({ type: 'solid', shape: 'prism', p, q, L, ...extra });

// ---------------------------------------------------------------- the models' words (texts, drawings, solutions, hints)

export const space1Text = ({ a, b, c }) => `תיבה שבסיסה $${a}$ על $${b}$ ס״מ וגובהה $${c}$ ס״מ. מה אורך האלכסון של התיבה?`;
export const space1Fig = ({ a, b, c }) => boxFig(a, b, c, { diag: 'space' });
export const space1Solution = ({ a, b, c, d }) => [
  `אלכסון הבסיס בריבוע: $${a}^2 + ${b}^2 = ${a * a + b * b}$.`,
  `ועם הגובה: $${a * a + b * b} + ${c}^2 = ${d * d}$, ולכן האלכסון $\\sqrt{${d * d}} = ${d}$ ס״מ`,
];
export const space1Hint = () => 'קודם אלכסון הבסיס, בפיתגורס. אחר כך משולש ישר־זווית חדש: אלכסון הבסיס והגובה.';

export const stickText = ({ a, b, c }) => `מה אורך המקל הארוך ביותר שנכנס בארגז $${a}$ על $${b}$ על $${c}$ ס״מ?`;
export const stickFig = ({ a, b, c }) => boxFig(a, b, c, { diag: 'space' });
export const stickSolution = ({ a, b, c, d }) => [
  'המקל הארוך ביותר עובר מפינה תחתונה לפינה העליונה הרחוקה: זה אלכסון הארגז.',
  `$${a}^2 + ${b}^2 + ${c}^2 = ${d * d}$, ולכן $\\sqrt{${d * d}} = ${d}$ ס״מ`,
];
export const stickHint = () => 'המקל הארוך ביותר עובר דרך הפנים, מפינה לפינה הרחוקה ממנה.';

export const space2Text = ({ r, h }) => `גליל שרדיוסו $${r}$ ס״מ וגובהו $${h}$ ס״מ. מה אורך המקל הארוך ביותר שנכנס בו?`;
export const space2Fig = ({ r, h }) => cylFig(r, h, { diag: 'rod' });
export const space2Solution = ({ d, h, rod }) => [
  `החתך הצירי הוא מלבן: רוחבו הקוטר, $${d}$, וגובהו $${h}$.`,
  `האלכסון שלו: $\\sqrt{${d}^2 + ${h}^2} = \\sqrt{${d * d + h * h}} = ${rod}$ ס״מ`,
];
export const space2Hint = () => 'המקל הארוך ביותר הוא האלכסון של החתך הצירי. כמה רחב החתך?';

export const triText = ({ a, b, c }) => `בתיבה שבסיסה $${a}$ על $${b}$ ס״מ וגובהה $${c}$ ס״מ, אלכסון הבסיס, המקצוע האנכי שבקצה שלו ואלכסון התיבה יוצרים משולש. מה שטחו?`;
export const triFig = ({ a, b, c }) => boxFig(a, b, c, { diag: 'tri' });
export const triSolution = ({ a, b, e, c }) => [
  `אלכסון הבסיס $\\sqrt{${a}^2 + ${b}^2} = ${e}$.`,
  `המשולש ישר־זווית ליד המקצוע: $\\frac{${e} \\cdot ${c}}{2} = ${(e * c) / 2}$ סמ״ר`,
];
export const triHint = () => 'איפה הזווית הישרה? המקצוע ניצב לבסיס.';

// ---------------------------------------------------------------- space:1 — the diagonal of a box and of a cube

/** The diagonal of a box from its base and height (the diagnostic model's draw). */
function sp1s() {
  const p = draw(() => { const q = SPACE1.params(rnd); return { ...q, answer: SPACE1.answer(q), printed: [q.a, q.b, q.c], bugs: bugsAt(SPACE1, q) }; });
  return {
    key: `sp1s:${p.a}:${p.b}:${p.c}`, text: space1Text(p), form: 'num', answer: p.answer, unit: UNIT.cm, fig: space1Fig(p),
    hint: space1Hint(), solution: space1Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The diagonal of a box's base a by b (edges 2..15): whole, or rounded to tenths with `exact`. */
function sp1f() {
  const p = draw(() => {
    const a = rint(rnd, 2, 15); const b = rint(rnd, 2, 15); const c = rint(rnd, 2, 15);
    const d = Math.sqrt(a * a + b * b); const whole = Number.isInteger(d);
    return { a, b, c, d, whole, answer: whole ? d : r1(d), printed: [a, b, c], bugs: [['add-legs', a + b], ['no-root', a * a + b * b]] };
  });
  const { a, b, c, d, whole } = p;
  return {
    key: `sp1f:${a}:${b}:${c}`, text: `תיבה שבסיסה $${a}$ על $${b}$ ס״מ וגובהה $${c}$ ס״מ. מה אורך האלכסון של הבסיס? ${MAYBE_ROUND}`,
    form: 'num', answer: p.answer, ...(whole ? {} : { exact: d }), unit: UNIT.cm, fig: boxFig(a, b, c, { diag: 'face' }),
    hint: 'הבסיס הוא מלבן, והאלכסון שלו הוא יתר של משולש ישר־זווית. הגובה לא נכנס לחישוב.',
    solution: [`$${a}^2 + ${b}^2 = ${a * a + b * b}$.`, whole ? `$\\sqrt{${a * a + b * b}} = ${d}$ ס״מ` : `$\\sqrt{${a * a + b * b}} \\approx ${num(p.answer)}$ ס״מ`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** The diagonal of a cube of edge s (2..12), rounded to tenths (`exact` s√3); a face's diagonal is face-for-space. */
function sp1c() {
  const p = draw(() => {
    const s = rint(rnd, 2, 12); const d = s * Math.sqrt(3);
    return { s, d, answer: r1(d), printed: [s], bugs: [['face-for-space', s * Math.SQRT2], ['add-edges3', 3 * s]] };
  });
  const { s, d } = p;
  return {
    key: `sp1c:${s}`, text: `מה אורך האלכסון של קובייה שמקצועה $${s}$ ס״מ? ${ROUND}`, form: 'num', answer: p.answer, exact: d, unit: UNIT.cm,
    fig: cubeFig(s, { diag: 'space' }),
    hint: 'אלכסון הקובייה עובר דרך הפנים: $d^2 = a^2 + a^2 + a^2$.',
    solution: [`$${s}^2 + ${s}^2 + ${s}^2 = ${3 * s * s}$.`, `$\\sqrt{${3 * s * s}} \\approx ${num(p.answer)}$ ס״מ`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** The third edge from the diagonal and two edges (the model's draw): adding the squares is add-not-sub. */
function sp1m() {
  const p = draw(() => {
    const q = SPACE1.params(rnd); const { a, b, c, d } = q;
    return { ...q, answer: c, printed: [d, a, b], bugs: [['add-not-sub', Math.sqrt(d * d + a * a + b * b)]] };
  });
  const { a, b, c, d } = p;
  return {
    key: `sp1m:${a}:${b}:${d}`, text: `האלכסון של תיבה $${d}$ ס״מ, ושני מקצועות הבסיס שלה $${a}$ ו־$${b}$ ס״מ. מה הגובה שלה?`, form: 'num', answer: c, unit: UNIT.cm,
    fig: boxFig(a, b, c, { diag: 'space', labels: { a, b, c: '?', d } }),
    hint: 'אלכסון בריבוע הוא סכום הריבועים של שלושת המקצועות. מחפשים מקצוע, ולכן מחסרים.',
    // the squares on one line and their values on the next: the whole chain as one line of maths was up to 109px wider
    // than a step on the smallest phone (e2e/solutions-fit.spec.js), and a line of maths does not wrap
    solution: [`הגובה בריבוע: $${d}^2 - ${a}^2 - ${b}^2$.`, `$${d * d} - ${a * a} - ${b * b} = ${c * c}$, ולכן הגובה $\\sqrt{${c * c}} = ${c}$ ס״מ`],
    diag: diagList(c, p.bugs),
  };
}

/**
 * Three segments in a box, one of them the box's diagonal and two the diagonals of faces: which is the box's? Practice
 * only (a choice of three). The segments are drawn alike and named by letters; the drawing's words say where each one
 * runs, from corner to corner, and never what it is.
 */
// the corners: 0 front bottom left, 1 front bottom right, 2 front top right, 3 front top left, 4-7 the same at the back
const SPACE_DIAGS = [[0, 6], [1, 7], [2, 4], [3, 5]];
const FACE_DIAGS = [[0, 2], [1, 3], [3, 6], [2, 7], [1, 6], [2, 5], [0, 5], [1, 4]];
function sp1w() {
  const [a, b, c] = pick(rnd, [[6, 4, 3], [5, 3, 4], [7, 4, 3], [6, 3, 5], [8, 4, 3]]);
  const faces = shuffle(FACE_DIAGS).slice(0, 2).map(([f, t]) => ({ from: f, to: t, ok: false }));
  const segs = shuffle([{ ...pick(rnd, SPACE_DIAGS.map(([f, t]) => ({ from: f, to: t }))), ok: true }, ...faces]).map((s, i) => ({ ...s, label: LETTERS[i] }));
  const choices = segs.map((s) => ({ text: `קטע ${s.label}`, ...(s.ok ? { ok: true } : { bug: 'which-diagonal' }) }));
  return {
    key: `sp1w:${segs.map((s) => `${s.from}-${s.to}`).join(',')}`, form: 'mc', choices, answer: choices.findIndex((x) => x.ok), practiceOnly: true,
    text: `בתיבה $${a}$ על $${b}$ על $${c}$ מסומנים שלושה קטעים. איזה מהם הוא אלכסון של התיבה?`,
    fig: boxFig(a, b, c, { labels: false, segs: segs.map(({ from, to, label }) => ({ from, to, label })) }),
    hint: 'אלכסון של פאה נשאר על פאה אחת. אלכסון של התיבה עובר דרך הפנים, לקודקוד הרחוק.',
    solution: [`קטע ${segs.find((s) => s.ok).label} מחבר שני קודקודים שאינם על אותה פאה: הוא עובר דרך הפנים.`, 'שני הקטעים האחרים מונחים כל אחד על פאה אחת: הם אלכסונים של פאות.'],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- space:2 — right triangles inside solids

/** The longest rod in a cylinder, its radius or its diameter written (the model's draw). */
function sp2r() {
  const p = draw(() => { const q = SPACE2.params(rnd); const g = rnd() < 0.5 ? 0 : 1; return { ...q, g, answer: SPACE2.answer(q), printed: g ? [q.d, q.h] : [q.r, q.h], bugs: bugsAt(SPACE2, q) }; });
  const { g, r, d, h } = p;
  return {
    key: `sp2r:${g}:${d}:${h}`, form: 'num', answer: p.answer, unit: UNIT.cm,
    text: g ? `גליל שקוטרו $${d}$ ס״מ וגובהו $${h}$ ס״מ. מה אורך המקל הארוך ביותר שנכנס בו?` : space2Text(p),
    fig: g ? cylFig(r, h, { diag: 'rod', labels: { r: '', h }, label: `קוטר ${d}` }) : space2Fig(p),
    hint: space2Hint(), solution: space2Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The right triangle inside a box: its area (the transfer model's draw). */
function sp2t() {
  const p = draw(() => { const q = SPACE2T.params(rnd); return { ...q, answer: SPACE2T.answer(q), printed: [q.a, q.b, q.c], bugs: bugsAt(SPACE2T, q) }; });
  return {
    key: `sp2t:${p.a}:${p.b}:${p.c}`, text: triText(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: triFig(p),
    hint: triHint(), solution: triSolution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** A cone's volume with π from its radius and slant height (circle:4's draws, the height not written): the review. */
function sp2v() {
  const p = draw(() => { const q = CIRCLE4.params(rnd); return { ...q, answer: CIRCLE4.answer(q), printed: [q.r, q.l], bugs: bugsAt(CIRCLE4, q) }; });
  const { r, h, l } = p;
  return {
    key: `sp2v:${r}:${l}`, text: `לחרוט רדיוס $${r}$ ס״מ וקו יוצר $${l}$ ס״מ. מה נפחו? ${WITH_PI}`, form: 'num', answer: p.answer, unit: UNIT.cm3, after: '\\pi',
    fig: coneFig(r, h, l, { labels: { r, l, h: '?' } }),
    hint: 'בנוסחת הנפח יש גובה. קודם מוצאים אותו בחצי החתך הצירי.',
    solution: [`$h^2 = ${l}^2 - ${r}^2 = ${h * h}$, ולכן $h = ${h}$.`, `$\\frac{\\pi \\cdot ${r}^2 \\cdot ${h}}{3} = ${(r * r * h) / 3}\\pi$ סמ״ק`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** The face on a right prism's hypotenuse (legs p and q from a triple, length L): the legs added is add-legs. */
function sp2p() {
  const p = draw(() => { const [a, b, c] = tri(rnd, T20); const L = rint(rnd, 3, 20); return { a, b, c, L, answer: c * L, printed: [a, b, L], bugs: [['add-legs', (a + b) * L]] }; });
  const { a, b, c, L } = p;
  return {
    key: `sp2p:${a}:${b}:${L}`, text: `מנסרה שבסיסה משולש ישר־זווית עם ניצבים $${a}$ ו־$${b}$ ס״מ, ואורכה $${L}$ ס״מ. מה שטח הפאה שעל היתר?`,
    form: 'num', answer: c * L, unit: UNIT.cm2, fig: prismFig(a, b, L),
    hint: 'הפאה שעל היתר היא מלבן: היתר על אורך המנסרה. את היתר מוצאים בפיתגורס.',
    solution: [`היתר: $\\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}$.`, `הפאה: $${c} \\cdot ${L} = ${c * L}$ סמ״ר`],
    diag: diagList(c * L, p.bugs),
  };
}

/** Which triangle inside a cone is right-angled? Half the axial section. Practice only (a choice of three). */
function sp2m() {
  const [r, h] = pick(rnd, [[3, 4], [5, 12], [6, 8], [4, 7], [5, 9]]);
  const choices = shuffle([
    { text: 'הקודקוד, מרכז הבסיס ונקודה על שפת הבסיס', ok: true },
    { text: 'הקודקוד ושני הקצוות של קוטר הבסיס' },
    { text: 'הקודקוד ושתי נקודות על שפת הבסיס שאינן קצוות של קוטר' },
  ]);
  return {
    key: `sp2m:${r}:${h}`, form: 'mc', choices, answer: choices.findIndex((x) => x.ok), practiceOnly: true,
    text: `לחרוט רדיוס $${r}$ ס״מ וגובה $${h}$ ס״מ. איזה מהמשולשים האלה ישר־זווית?`,
    fig: coneFig(r, h, null, { diag: 'axial' }),
    hint: 'הגובה יורד מהקודקוד למרכז הבסיס, וניצב לבסיס. איפה יש זווית ישרה?',
    solution: ['הגובה ניצב לבסיס, ולכן הזווית במרכז הבסיס, בין הגובה לרדיוס, ישרה.', 'המשולש של הקודקוד, המרכז ושפת הבסיס הוא חצי החתך הצירי: ניצביו הרדיוס והגובה, והיתר הוא הקו היוצר.'],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- the topic

/** The practice kinds of each stair with their weights (stage2.md MEASURE-5; "check" kinds may be in a check). */
export const KINDS = {
  1: [[35, sp1s], [20, sp1f], [15, sp1c], [15, sp1m], [15, sp1w]],
  2: [[30, sp2r], [25, sp2t], [20, sp2v], [15, sp2p], [10, sp2m]],
};
/** Every kind's key prefix, by stair. */
export const KIND_KEYS = Object.fromEntries(Object.entries(KINDS).map(([lv, list]) => [lv, list.map(([, f]) => f.name)]));

export const SPACE = {
  id: 'space', grade: '8', title: 'פיתגורס במרחב', desc: 'אלכסון בקובייה ובתיבה, ומשולשים ישרי־זווית בתוך גופים', color: 'sky',
  // taught in May: the first-day placement test does not ask it
  placement: false,
  levels: [
    { title: 'אלכסון בקובייה ובתיבה', gen: byWeight(KINDS[1]) },
    { title: 'משולשים ישרי־זווית בגופים', gen: byWeight(KINDS[2]) },
  ],
  cats: {
    'face-for-space': 'חישבו את אלכסון הפאה במקום את אלכסון התיבה',
    'add-edges3': 'חיברו את שלושת המקצועות במקום פיתגורס',
    'which-diagonal': 'בחרו אלכסון של פאה במקום אלכסון של התיבה',
    // the ids other topics already use keep their names (pyth's three, linear's no-half, circle's two), but for r-for-d,
    // said here in this unit's words: the radius taken as the side of the axial section
    'no-root': 'שכחו להוציא שורש',
    'add-legs': 'חיברו את הצלעות בלי לרבע',
    'add-not-sub': 'חיברו ריבועים במקום לחסר (כשמחפשים ניצב)',
    'no-half': 'שכחו לחלק ב־2 בשטח המשולש',
    'r-for-d': 'השתמשו ברדיוס במקום בקוטר כצלע של החתך',
    'slant-as-height': 'השתמשו בקו היוצר במקום בגובה',
    'no-third': 'שכחו לחלק ב־$3$',
  },
  lesson: {
    points: [
      'אלכסון פאה הוא אלכסון של מלבן; אלכסון התיבה עובר דרך הפנים.',
      'תיבה $3$ על $4$ על $12$: אלכסון הבסיס $5$, ואלכסון התיבה $13$.',
      '$d^2 = a^2 + b^2 + c^2$.',
      'המקל הארוך ביותר בגליל: $\\sqrt{d^2 + h^2}$.',
      'בחרוט: $h^2 + r^2 = \\ell^2$.',
    ],
    words: ['אלכסון פאה', 'אלכסון התיבה', 'אלכסון הקובייה', 'חתך צירי', 'מקל ארוך ביותר', 'קו יוצר'],
  },
};
