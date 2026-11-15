// The circle, the cylinder and the cone (מעגל, גליל וחרוט): unit 8.4 of grade 8 (ח׳) in the Ministry's תשפ״ז schedule,
// October and November, examined in the first assessment task (curriculum stage 2, MEASURE-4). Four stairs: the
// circumference, the area of a disc (half and quarter discs, a ring), the cylinder (its lateral area, its surface and
// its volume, litres poured into it) and the cone (its volume, its height by Pythagoras, its axial section).
// Taught from October, so the first-day placement test skips it (placement: false, MEASURE-1.6).
//
// This file is the practice and diagnosis layer: the topic object, the names of its mistakes, the generators of every
// practice kind, and the eight diagnostic and transfer models (CIRCLE1 to CIRCLE4T) with their texts, drawings,
// solutions and hints. It is not on the path yet (it is in neither GRADE8 nor TOPIC_ORDER): a topic goes on the path
// whole, with its teaching (learn/content/circle.ts), its challenges, its programme parts, its scenery and its stair
// names, which land together in a later sitting. Its tests import it directly.
//
// Two answer forms, as the Ministry accepts them (content/util.js, MEASURE-1 item 4). "With π" (`after: '\\pi'`): the
// question says בעזרת π, the answer row ends with π and the student types the whole number before it. "With π ≈ 3.14"
// (`pk`, the multiple of π): the question ends "חשבו עם π ≈ 3.14 ועגלו לעשירית.", the answer is 3.14·pk rounded to tenths,
// and the calculator's π is right too; each of its mistakes is named the same two ways (piNear). The models ask with π
// only, whole multiples, for a clean diagnosis; a circumference from a given diameter is never asked with π (its answer
// would be the printed diameter). The models are the stage-2 spec's (scratchpad/lanes/stage2/spec/models.mjs), ported
// unchanged with the redraw rule of content/area.js (clean); practice draws go through their params, every draw with a
// diagnosis is redrawn by the same rule (on the 3.14 values for a pk kind) and when two different mistakes give the same
// number, and every draw is redone while its answer is a number the question prints (noCopy). Units sit after the
// number, outside the maths; a question in litres says ליטר. Every number a drawing writes is in its text too.
// The two objects (the circle rolled or cut into sectors, content/roll.js; the net, content/net.js) load after the first
// screen; this file builds their specs and does not import them. Errors and their sources (stage2.md MEASURE-4):
//   r-for-d, d-for-r, d-in-area     teacher-reported; the diameter squared (Mr Barton Maths, Question of the Week 11);
//                                   the Ministry: "יש ללמוד את הביטויים האלגבריים להיקף מעגל באמצעות הרדיוס והקוטר"
//   area-for-circ, circ-for-area    Tan Şişman & Aksu (2016), area and perimeter formulas confused; teacher-reported
//   ring-sub-radii, no-subtract     teacher-reported; the Ministry's water-park task
//   lateral-for-vol, no-bases, one-base   teacher-reported; "לגליל הישר קיימת מעטפת שהיא בצורת מלבן"
//   no-third, slant-as-height       teacher-reported; the Ministry's axial section and its ice-cream cone
//   no-convert                      the Ministry's vessel ("שופכים אל הגליל 4 ליטרים") and "שילוב המרת מידות"
//   whole-circle, same-sheet, add-not-sub, subtract-sides, no-half   teacher-reported; the Ministry's sheet rolled two ways
import { shuffle, piNear, piValue, PI_AFTER } from './util.js';
import { fair, mk, diagList, bugsAt, triples } from './area.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const same = (a, b) => Math.abs(a - b) < 1e-9;
/** A number as written: 2.5, 0.012 (never 2.4999999). */
const num = (v) => String(Math.round(v * 1e9) / 1e9);

/** The units, written after the number and outside the maths. */
export const UNIT = { cm: 'ס״מ', cm2: 'סמ״ר', cm3: 'סמ״ק', m: 'מ׳', m2: 'מ״ר' };
/** The end of every question that asks with π ≈ 3.14. */
export const PK_END = 'חשבו עם $\\pi \\approx 3.14$ ועגלו לעשירית.';
/** The end of every question whose answer row ends with π. */
const WITH_PI = 'כתבו בעזרת $\\pi$.';

/**
 * A practice draw: `f` returns { answer, printed, bugs?, pk? } (or null to draw again). It is redone while its answer is
 * a number the question prints, while a prediction is unfair (a slip, near the answer, near another prediction; for a
 * pk question on the values with π ≈ 3.14), or while two different mistakes predict the same number, so a diagnosis
 * never names one of two mistakes at random.
 */
const tie = (bugs) => bugs.some(([id, v], i) => v != null && bugs.some(([id2, w], j) => j > i && id2 !== id && w != null && same(v, w)));
function draw(f) {
  for (;;) {
    const q = f();
    if (!q) continue;
    if ((q.printed || []).some((v) => same(v, q.answer))) continue;
    if (q.bugs) {
      const vals = q.pk != null ? q.bugs.map(([, v]) => (v == null ? v : piValue(v))) : q.bugs.map(([, v]) => v);
      if (!fair(q.answer, vals) || tie(q.bugs)) continue;
      // with π ≈ 3.14 and with the calculator's π a pk value is a short range: no two of them (the answer's and the
      // mistakes') may meet, or a typed value would be right and a mistake at once, or two mistakes
      if (q.pk != null) { const ks = [q.pk, ...q.bugs.map(([, v]) => v).filter((v) => v != null && !same(v, q.pk))]; if (ks.some((a, i) => ks.some((b, j) => j > i && !same(a, b) && meet(a, b)))) continue; }
    }
    return q;
  }
}
/**
 * The diagnosis of a pk question: a typed value names a mistake when it is that mistake's multiple of π computed with
 * 3.14 or with the calculator's π (within half a tenth), and only one mistake fits.
 */
export function piDiag(k, pairs) {
  const real = pairs.filter(([, v]) => v != null && Number.isFinite(v) && !same(v, k));
  return (u) => {
    if (typeof u !== 'number' || piNear(u, k)) return null;
    const hit = [...new Set(real.filter(([, v]) => piNear(u, v)).map(([id]) => id))];
    return hit.length === 1 ? hit[0] : null;
  };
}
/** Do the values of two multiples of π, each with 3.14 and with the calculator's π, come within half a tenth? */
const meet = (a, b) => [3.14 * a, Math.PI * a].some((x) => piNear(x, b)) || [3.14 * b, Math.PI * b].some((x) => piNear(x, a));
/** A level's generator: one of its kinds, by weight. */
const byWeight = (kinds) => () => {
  let r = Math.random() * kinds.reduce((a, [w]) => a + w, 0);
  for (const [w, f] of kinds) { r -= w; if (r < 0) return f(); }
  return kinds[kinds.length - 1][1]();
};

// ---------------------------------------------------------------- the models (models.mjs, unchanged)

const T30 = triples(30);

/**
 * circle:1 — the circumference as a multiple of π (k 0: from the radius r), or the radius from the circumference cπ
 * (k 1). A circumference from a given diameter is never asked with π: its answer would be the printed diameter.
 */
export const CIRCLE1 = mk({
  raw: (r) => { const k = rint(r, 0, 1); const rad = rint(r, 2, 15); return { k, r: rad, c: 2 * rad }; },
  answer: ({ k, r, c }) => (k ? r : c),
  bugs: {
    'r-for-d': ({ k, r }) => (k ? null : r), // π times the radius
    'area-for-circ': ({ k, r }) => (k ? null : r * r), // the area's r²
    'd-for-r': ({ k, c }) => (k ? c : null), // the diameter given as the radius
  },
});
/** circle:1 transfer — a running track: one lap, or the radius from a lap. */
export const CIRCLE1T = mk({ raw: CIRCLE1.raw, answer: CIRCLE1.answer, bugs: CIRCLE1.bugs });

/** circle:2 — the area of a disc as a multiple of π, from the radius (k 0) or the diameter (k 1). */
export const CIRCLE2 = mk({
  raw: (r) => { const k = rint(r, 0, 1); const rad = rint(r, 3, 12); return { k, r: rad, d: 2 * rad }; },
  answer: ({ r }) => r * r,
  bugs: {
    'circ-for-area': ({ k, r, d }) => (k ? d : 2 * r), // the circumference's 2r
    'd-in-area': ({ k, d }) => (k ? d * d : null), // the diameter squared
  },
});
/** circle:2 transfer — a round pool of radius r with a path w wide round it: the path's area. */
export const CIRCLE2T = mk({
  raw: (r) => { const rad = rint(r, 2, 10); const w = rint(r, 1, 5); return { r: rad, w, R: rad + w }; },
  answer: ({ r, R }) => R * R - r * r,
  bugs: {
    'ring-sub-radii': ({ w }) => w * w, // (R − r)²
    'no-subtract': ({ R }) => R * R, // the whole big disc
  },
});

/** circle:3 — the volume of a cylinder, radius r, height h. */
export const CIRCLE3 = mk({
  raw: (r) => { const rad = rint(r, 2, 10); const h = rint(r, 2, 20); if (h === rad) return null; return { r: rad, h }; },
  answer: ({ r, h }) => r * r * h,
  bugs: {
    'd-in-area': ({ r, h }) => 4 * r * r * h, // the diameter squared in the base
    'lateral-for-vol': ({ r, h }) => 2 * r * h, // the lateral area
  },
});
/** circle:3 transfer — the label round a can: the lateral area. */
export const CIRCLE3T = mk({
  raw: CIRCLE3.raw,
  answer: ({ r, h }) => 2 * r * h,
  bugs: {
    'r-for-d': ({ r, h }) => r * h, // the rectangle's width taken as πr, not 2πr
    'area-for-circ': ({ r, h }) => r * r * h, // the base's area times the height
  },
});

/** The cones whose radius r, height h and slant height l make a triple, r ≤ 12, h ≤ 24 and r²h a multiple of 3. */
const RHL = T30.flatMap(([p, q, c]) => [[p, q, c], [q, p, c]]).filter(([r, h]) => r <= 12 && h <= 24 && (r * r * h) % 3 === 0);
/** circle:4 — the volume of a cone: r, h and l all written and drawn. */
export const CIRCLE4 = mk({
  raw: (r) => { const [rad, h, l] = pick(r, RHL); return { r: rad, h, l }; },
  answer: ({ r, h }) => (r * r * h) / 3,
  bugs: {
    'no-third': ({ r, h }) => r * r * h, // the cylinder
    'slant-as-height': ({ r, l }) => (r * r * l) / 3, // the slant height used as the height
  },
});
/** circle:4 transfer — an ice-cream cone: the radius and the slant height given, the height found first by Pythagoras. */
export const CIRCLE4T = mk({ raw: CIRCLE4.raw, answer: CIRCLE4.answer, bugs: CIRCLE4.bugs });

/**
 * Every model asks with π; circle1 and circle1T ask the circumference with π and the radius without it (`after` is a
 * function of the draw, as items.ts modelItem reads it).
 */
CIRCLE1.after = (p) => (p.k ? undefined : PI_AFTER);
CIRCLE1T.after = CIRCLE1.after;
[CIRCLE2, CIRCLE2T, CIRCLE3, CIRCLE3T, CIRCLE4, CIRCLE4T].forEach((m) => { m.after = PI_AFTER; });

/** Which models serve which stair, as its diagnostic and its transfer model. */
export const STAIR_MODELS = { 'circle:1': [CIRCLE1, CIRCLE1T], 'circle:2': [CIRCLE2, CIRCLE2T], 'circle:3': [CIRCLE3, CIRCLE3T], 'circle:4': [CIRCLE4, CIRCLE4T] };

// ---------------------------------------------------------------- drawings
// A circle is a geo drawing (components/Figure.jsx): its centre unnamed, its radius drawn and written, or its diameter.
// A cylinder and a cone are solid figures (components/SolidFigs.jsx).

/** A circle of radius r, its radius written (`label`, or '?'). */
export const circleFig = (r, label = r) => ({ type: 'geo', label: 'מעגל', pts: { _o: [0, 0] }, circles: [{ c: '_o', r, label: String(label) }] });
/** A circle of diameter d, its diameter drawn and written. */
export const diameterFig = (d) => ({
  type: 'geo', label: 'מעגל וקוטר', pts: { _o: [0, 0], _a: [-d / 2, 0], _b: [d / 2, 0] },
  circles: [{ c: '_o', r: d / 2 }], segs: [{ a: '_a', b: '_b', label: String(d) }],
});
/** A half disc (q 0) or a quarter disc (q 1) of radius r. */
export const partFig = (q, r) => (q
  ? { type: 'geo', label: 'רבע עיגול', pts: { _o: [0, 0], _a: [r, 0], _b: [0, r] }, arcs: [{ c: '_o', r, from: 0, to: 90 }], segs: [{ a: '_o', b: '_a', label: String(r) }, { a: '_o', b: '_b' }], angles: [{ at: '_o', from: '_a', to: '_b', right: true }] }
  : { type: 'geo', label: 'חצי עיגול', pts: { _o: [0, 0], _a: [r, 0], _b: [-r, 0] }, arcs: [{ c: '_o', r, from: 0, to: 180 }], segs: [{ a: '_b', b: '_o' }, { a: '_o', b: '_a', label: String(r) }] });
/** A round pool of radius r and the path w wide round it. */
export const ringFig = ({ r, w }) => ({
  type: 'geo', label: 'בריכה עגולה ושביל סביבה', pts: { _o: [0, 0], _p: [r, 0], _q: [r + w, 0] },
  circles: [{ c: '_o', r: r + w }, { c: '_o', r, label: String(r), fill: true }], segs: [{ a: '_p', b: '_q', label: String(w) }],
});
export const cylinderFig = (r, h, extra = {}) => ({ type: 'solid', shape: 'cylinder', r, h, ...extra });
export const coneFig = (r, h, l, extra = {}) => ({ type: 'solid', shape: 'cone', r, h, ...(l != null ? { l } : {}), ...extra });
/** The axial section of a cone: an isosceles triangle on the diameter, its height dashed; the radius (g 0) or the diameter (g 1) written. */
export const axialFig = (g, r, h) => ({
  type: 'geo', label: 'החתך הצירי של חרוט', pts: { _a: [-r, 0], _b: [r, 0], _t: [0, h], _m: [0, 0] },
  polys: [{ pts: ['_a', '_b', '_t'] }],
  segs: [g ? { a: '_a', b: '_b', label: String(2 * r) } : { a: '_m', b: '_b', label: String(r) }, { a: '_t', b: '_m', label: String(h), dash: true }],
  angles: [{ at: '_m', from: '_b', to: '_t', right: true }],
});
/** One sheet a by b rolled two ways: the side that wraps the base is drawn bold, the other side is the height. */
export const sheetsFig = (a, b) => ({
  type: 'geo', label: 'דף נייר מגולגל בשתי דרכים: הצלע המודגשת מקיפה את הבסיס',
  pts: { _1: [0, 0], _2: [a, 0], _3: [a, b], _4: [0, b], _5: [a + 6, 0], _6: [a + 6 + b, 0], _7: [a + 6 + b, a], _8: [a + 6, a] },
  polys: [{ pts: ['_1', '_2', '_3', '_4'] }, { pts: ['_5', '_6', '_7', '_8'] }],
  segs: [
    { a: '_1', b: '_2', label: String(a) }, { a: '_2', b: '_3', label: String(b) }, { a: '_3', b: '_4', hi: true },
    { a: '_5', b: '_6', label: String(b) }, { a: '_6', b: '_7', label: String(a) }, { a: '_7', b: '_8', hi: true },
  ],
});

// ---------------------------------------------------------------- the models' words (texts, solutions, hints)

export const circle1Text = ({ k, r, c }) => (k ? `היקף מעגל $${c}\\pi$ ס״מ. מה הרדיוס?` : `מה היקף מעגל שרדיוסו $${r}$ ס״מ? ${WITH_PI}`);
export const circle1Fig = ({ k, r }) => circleFig(r, k ? '?' : r);
export const circle1Solution = ({ k, r, c }) => (k
  ? [`$2\\pi r = ${c}\\pi$, ולכן הקוטר $2r = ${c}$.`, `הרדיוס חצי מהקוטר: $${c} : 2 = ${r}$ ס״מ`]
  : [`הקוטר הוא שני רדיוסים: $2 \\cdot ${r} = ${c}$.`, `ההיקף $\\pi d = ${c}\\pi$ ס״מ`]);
export const circle1Hint = ({ k }) => (k ? 'ההיקף הוא $\\pi$ כפול הקוטר. מה הקוטר, ומה חצי ממנו?' : 'ההיקף הוא $\\pi$ כפול הקוטר, והקוטר הוא שני רדיוסים.');
/** circle:1 transfer: a running track. */
export const trackText = ({ k, r, c }) => (k ? `סיבוב במסלול עגול הוא $${c}\\pi$ מ׳. מה רדיוס המסלול?` : `מסלול ריצה עגול שרדיוסו $${r}$ מ׳. כמה מטרים בסיבוב אחד? ${WITH_PI}`);
export const trackFig = ({ k, r }) => circleFig(r, k ? '?' : r);
export const trackSolution = ({ k, r, c }) => (k
  ? [`סיבוב אחד הוא ההיקף: $2\\pi r = ${c}\\pi$, ולכן $2r = ${c}$.`, `$${c} : 2 = ${r}$ מ׳`]
  : [`סיבוב אחד הוא ההיקף, והקוטר $2 \\cdot ${r} = ${c}$.`, `$\\pi d = ${c}\\pi$ מ׳`]);
export const trackHint = () => 'סיבוב אחד הוא ההיקף: $\\pi$ כפול הקוטר.';

export const circle2Text = ({ k, r, d }) => (k ? `מה שטח עיגול שקוטרו $${d}$ ס״מ? ${WITH_PI}` : `מה שטח עיגול שרדיוסו $${r}$ ס״מ? ${WITH_PI}`);
export const circle2Fig = ({ k, r, d }) => (k ? diameterFig(d) : circleFig(r));
export const circle2Solution = ({ k, r, d }) => [
  ...(k ? [`הרדיוס חצי מהקוטר: $${d} : 2 = ${r}$.`] : []),
  `$\\pi r^2 = \\pi \\cdot ${r}^2 = ${r * r}\\pi$ סמ״ר`,
];
export const circle2Hint = ({ k }) => (k ? 'בנוסחה $\\pi r^2$ יש רדיוס. קודם מוצאים אותו מהקוטר.' : 'שטח עיגול: $\\pi r^2$, הרדיוס בריבוע.');
/** circle:2 transfer: the path round a pool. */
export const poolText = ({ r, w }) => `בריכה עגולה ברדיוס $${r}$ מ׳, ומסביבה שביל ברוחב $${w}$ מ׳. מה שטח השביל? ${WITH_PI}`;
export const poolFig = (p) => ringFig(p);
export const poolSolution = ({ r, w, R }) => [
  `העיגול הגדול, הבריכה עם השביל: רדיוס $${r} + ${w} = ${R}$, ושטחו $${R * R}\\pi$.`,
  `הבריכה $${r * r}\\pi$, והשביל: $${R * R}\\pi - ${r * r}\\pi = ${R * R - r * r}\\pi$ מ״ר`,
];
export const poolHint = () => 'השביל הוא העיגול הגדול פחות הבריכה. מה הרדיוס של העיגול הגדול?';

export const circle3Text = ({ r, h }) => `מה נפח גליל שרדיוסו $${r}$ ס״מ וגובהו $${h}$ ס״מ? ${WITH_PI}`;
export const circle3Fig = ({ r, h }) => cylinderFig(r, h);
export const circle3Solution = ({ r, h }) => [`שטח הבסיס: $\\pi \\cdot ${r}^2 = ${r * r}\\pi$.`, `כפול הגובה: $${r * r}\\pi \\cdot ${h} = ${r * r * h}\\pi$ סמ״ק`];
export const circle3Hint = () => 'נפח גליל: שטח הבסיס כפול הגובה, כמו בתיבה.';
/** circle:3 transfer: the paper label round a can. */
export const labelText = ({ r, h }) => `תווית סביב פחית שרדיוסה $${r}$ ס״מ וגובהה $${h}$ ס״מ. כמה סמ״ר נייר בתווית? ${WITH_PI}`;
export const labelFig = ({ r, h }) => cylinderFig(r, h);
export const labelSolution = ({ r, h }) => [`התווית פרושה היא מלבן: רוחבו היקף הבסיס, $2\\pi \\cdot ${r} = ${2 * r}\\pi$, וגובהו $${h}$.`, `$${2 * r}\\pi \\cdot ${h} = ${2 * r * h}\\pi$ סמ״ר`];
export const labelHint = () => 'התווית פרושה היא מלבן. כמה רחב הוא?';

export const circle4Text = ({ r, h, l }) => `מה נפח חרוט שרדיוסו $${r}$ ס״מ, גובהו $${h}$ ס״מ והקו היוצר שלו $${l}$ ס״מ? ${WITH_PI}`;
export const circle4Fig = ({ r, h, l }) => coneFig(r, h, l);
export const circle4Solution = ({ r, h }) => [`גליל עם אותו בסיס ואותו גובה: $\\pi \\cdot ${r}^2 \\cdot ${h} = ${r * r * h}\\pi$.`, `החרוט שליש ממנו: $${r * r * h}\\pi : 3 = ${(r * r * h) / 3}\\pi$ סמ״ק`];
export const circle4Hint = () => 'נפח חרוט: שליש מנפח הגליל. בנוסחה יש גובה, לא קו יוצר.';
/** circle:4 transfer: an ice-cream cone, the height found first. */
export const iceText = ({ r, l }) => `גביע גלידה בצורת חרוט: רדיוס הפתח $${r}$ ס״מ, והאורך מהשפה עד החוד $${l}$ ס״מ. כמה סמ״ק גלידה נכנסים בגביע? ${WITH_PI}`;
export const iceFig = ({ r, h, l }) => coneFig(r, h, l, { labels: { r, l, h: '?' } });
export const iceSolution = ({ r, h, l }) => [
  `הגובה, ניצב בחתך הצירי: $\\sqrt{${l}^2 - ${r}^2} = \\sqrt{${l * l - r * r}} = ${h}$.`,
  `הנפח: $\\frac{\\pi \\cdot ${r}^2 \\cdot ${h}}{3} = ${(r * r * h) / 3}\\pi$ סמ״ק`,
];
export const iceHint = () => 'קודם הגובה: הרדיוס, הגובה והקו היוצר יוצרים משולש ישר־זווית.';

// ---------------------------------------------------------------- circle:1 — the circumference

/** The circumference with π from the radius, or the radius from the circumference (the diagnostic model's draw). */
function ci1p() {
  const p = draw(() => { const q = CIRCLE1.params(rnd); return { ...q, answer: CIRCLE1.answer(q), printed: q.k ? [q.c] : [q.r], bugs: bugsAt(CIRCLE1, q) }; });
  return {
    key: `ci1p:${p.k}:${p.r}`, text: circle1Text(p), form: 'num', answer: p.answer, unit: UNIT.cm, fig: circle1Fig(p),
    ...(p.k ? {} : { after: PI_AFTER }), hint: circle1Hint(p), solution: circle1Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The circumference with π ≈ 3.14, from the diameter (g 0) or the radius (g 1). */
function ci1n() {
  const p = draw(() => {
    if (rnd() < 0.5) { const d = rint(rnd, 4, 30); return { g: 0, v: d, pk: d, answer: piValue(d), printed: [d, 3.14], bugs: [['d-for-r', 2 * d], ['area-for-circ', (d / 2) ** 2]] }; }
    const r = rint(rnd, 2, 15); return { g: 1, v: r, pk: 2 * r, answer: piValue(2 * r), printed: [r, 3.14], bugs: [['r-for-d', r], ['area-for-circ', r * r]] };
  });
  const { g, v } = p;
  return {
    key: `ci1n:${g}:${v}`, text: `מה היקף מעגל ש${g ? 'רדיוסו' : 'קוטרו'} $${v}$ ס״מ? ${PK_END}`, form: 'num', answer: p.answer, pk: p.pk, unit: UNIT.cm,
    fig: g ? circleFig(v) : diameterFig(v),
    hint: g ? 'ההיקף הוא $\\pi$ כפול הקוטר, והקוטר הוא שני רדיוסים.' : 'ההיקף הוא $\\pi$ כפול הקוטר.',
    solution: g
      ? [`הקוטר: $2 \\cdot ${v} = ${2 * v}$.`, `$3.14 \\cdot ${2 * v} = ${num(3.14 * 2 * v)}$, בעיגול לעשירית $${num(p.answer)}$ ס״מ`]
      : [`$P = \\pi d \\approx 3.14 \\cdot ${v} = ${num(3.14 * v)}$.`, `בעיגול לעשירית: $${num(p.answer)}$ ס״מ`],
    diag: piDiag(p.pk, p.bugs),
  };
}

/** The radius from a circumference written with π; the diameter given for it is d-for-r. */
function ci1r() {
  const p = draw(() => { const r = rint(rnd, 2, 15); return { r, c: 2 * r, answer: r, printed: [2 * r], bugs: [['d-for-r', 2 * r]] }; });
  const { r, c } = p;
  return {
    key: `ci1r:${c}`, text: `היקף מעגל $${c}\\pi$ ס״מ. מה הרדיוס?`, form: 'num', answer: r, unit: UNIT.cm, fig: circleFig(r, '?'),
    hint: 'ההיקף הוא $\\pi$ כפול הקוטר: מה הקוטר? והרדיוס חצי ממנו.',
    solution: [`$\\pi d = ${c}\\pi$, ולכן הקוטר $${c}$.`, `הרדיוס חצי מהקוטר: $${c} : 2 = ${r}$ ס״מ`],
    diag: diagList(r, p.bugs),
  };
}

/** A wheel of radius r (20..45 by 5) turned n times (2..10): how far it goes, with π ≈ 3.14. */
function ci1w() {
  const p = draw(() => { const r = 5 * rint(rnd, 4, 9); const n = rint(rnd, 2, 10); return { r, n, pk: 2 * r * n, answer: piValue(2 * r * n), printed: [r, n, 3.14], bugs: [['r-for-d', r * n]] }; });
  const { r, n } = p;
  return {
    key: `ci1w:${r}:${n}`, text: `גלגל שרדיוסו $${r}$ ס״מ מסתובב $${n}$ פעמים. כמה ס״מ הוא מתקדם? ${PK_END}`, form: 'num', answer: p.answer, pk: p.pk, unit: UNIT.cm,
    fig: circleFig(r),
    hint: 'בכל סיבוב הגלגל מתקדם כמו ההיקף שלו: $\\pi$ כפול הקוטר.',
    solution: [`בסיבוב אחד: $3.14 \\cdot ${2 * r} = ${num(3.14 * 2 * r)}$.`, `ב־$${n}$ סיבובים: $${num(3.14 * 2 * r)} \\cdot ${n} = ${num(3.14 * 2 * r * n)}$, בעיגול לעשירית $${num(p.answer)}$ ס״מ`],
    diag: piDiag(p.pk, p.bugs),
  };
}

/** The circle object: set the radius whose circumference is about C (the readout shows it): practice only. */
function ci1m() {
  const r = rint(rnd, 2, 16) / 2; const C = Math.round(20 * Math.PI * r) / 10;
  const r0 = r <= 4 ? r + 2 : r - 2;
  return {
    key: `ci1m:${r}`, text: `שנו את הרדיוס עד שההיקף יהיה בערך $${num(C)}$ ס״מ.`, form: 'manip', practiceOnly: true,
    manip: { kind: 'circle', show: 'circumference', start: { r: r0, t: 0 } }, answer: { mode: 'r', r },
    hint: 'ההיקף קצת יותר משלושה קטרים: קוטר כפול $3.14$.',
    solution: [`$2\\pi \\cdot ${num(r)} \\approx ${num(C)}$, ולכן הרדיוס $${num(r)}$ ס״מ.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- circle:2 — the area of a disc

/** The area with π from the radius or the diameter (the diagnostic model's draw). */
function ci2p() {
  const p = draw(() => { const q = CIRCLE2.params(rnd); return { ...q, answer: CIRCLE2.answer(q), printed: q.k ? [q.d] : [q.r], bugs: bugsAt(CIRCLE2, q) }; });
  return {
    key: `ci2p:${p.k}:${p.r}`, text: circle2Text(p), form: 'num', answer: p.answer, unit: UNIT.cm2, fig: circle2Fig(p), after: PI_AFTER,
    hint: circle2Hint(p), solution: circle2Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The area with π ≈ 3.14 from the radius (r 2..15). */
function ci2n() {
  const p = draw(() => { const r = rint(rnd, 2, 15); return { r, pk: r * r, answer: piValue(r * r), printed: [r, 3.14], bugs: [['circ-for-area', 2 * r]] }; });
  const { r } = p;
  return {
    key: `ci2n:${r}`, text: `מה שטח עיגול שרדיוסו $${r}$ ס״מ? ${PK_END}`, form: 'num', answer: p.answer, pk: p.pk, unit: UNIT.cm2, fig: circleFig(r),
    hint: 'שטח עיגול: $\\pi r^2$, הרדיוס בריבוע.',
    solution: [`$\\pi r^2 \\approx 3.14 \\cdot ${r * r} = ${num(3.14 * r * r)}$.`, `בעיגול לעשירית: $${num(p.answer)}$ סמ״ר`],
    diag: piDiag(p.pk, p.bugs),
  };
}

/** Half (q 0, 60%) or a quarter (q 1) of a disc of even radius r (4..16), with π; the whole disc is whole-circle. */
function ci2h() {
  const p = draw(() => { const r = 2 * rint(rnd, 2, 8); const q = rnd() < 0.6 ? 0 : 1; return { q, r, answer: q ? (r * r) / 4 : (r * r) / 2, printed: [r], bugs: [['whole-circle', r * r]] }; });
  const { q, r } = p;
  const part = q ? 'רבע' : 'חצי';
  return {
    key: `ci2h:${q}:${r}`, text: `מה שטח ${part} עיגול שרדיוסו $${r}$ ס״מ? ${WITH_PI}`, form: 'num', answer: p.answer, unit: UNIT.cm2, fig: partFig(q, r), after: PI_AFTER,
    hint: `קודם כל העיגול, $\\pi r^2$, ואז ${part} ממנו.`,
    solution: [`כל העיגול: $\\pi \\cdot ${r}^2 = ${r * r}\\pi$.`, `${part} ממנו: $${r * r}\\pi : ${q ? 4 : 2} = ${p.answer}\\pi$ סמ״ר`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** The path round a round pool, with π (the transfer model's draw). */
function ci2r() {
  const p = draw(() => { const q = CIRCLE2T.params(rnd); return { ...q, answer: CIRCLE2T.answer(q), printed: [q.r, q.w], bugs: bugsAt(CIRCLE2T, q) }; });
  return {
    key: `ci2r:${p.r}:${p.w}`, text: poolText(p), form: 'num', answer: p.answer, unit: UNIT.m2, fig: poolFig(p), after: PI_AFTER,
    hint: poolHint(), solution: poolSolution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The circle object cut into sectors: set the radius whose area is about S (the readout shows it): practice only. */
function ci2m() {
  const r = rint(rnd, 2, 16) / 2; const S = Math.round(10 * Math.PI * r * r) / 10;
  const r0 = r <= 4 ? r + 2 : r - 2;
  return {
    key: `ci2m:${r}`, text: `שנו את הרדיוס עד שהשטח יהיה בערך $${num(S)}$ סמ״ר.`, form: 'manip', practiceOnly: true,
    manip: { kind: 'circle', show: 'area', radius: true, start: { r: r0, n: 16 } }, answer: { mode: 'r', r },
    hint: 'השטח הוא $\\pi r^2$: רדיוס גדול פי $2$ נותן שטח גדול פי $4$.',
    solution: [`$\\pi \\cdot ${num(r)}^2 \\approx ${num(S)}$, ולכן הרדיוס $${num(r)}$ ס״מ.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- circle:3 — the cylinder

/** The volume of a cylinder with π (the diagnostic model's draw). */
function ci3v() {
  const p = draw(() => { const q = CIRCLE3.params(rnd); return { ...q, answer: CIRCLE3.answer(q), printed: [q.r, q.h], bugs: bugsAt(CIRCLE3, q) }; });
  return {
    key: `ci3v:${p.r}:${p.h}`, text: circle3Text(p), form: 'num', answer: p.answer, unit: UNIT.cm3, fig: circle3Fig(p), after: PI_AFTER,
    hint: circle3Hint(), solution: circle3Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** The lateral area 2rh with π: the rectangle's width πr is r-for-d, the base's area times the height area-for-circ. */
function ci3l() {
  const p = draw(() => { const q = CIRCLE3.params(rnd); const { r, h } = q; return { r, h, answer: 2 * r * h, printed: [r, h], bugs: [['r-for-d', r * h], ['area-for-circ', r * r * h]] }; });
  const { r, h } = p;
  return {
    key: `ci3l:${r}:${h}`, text: `מה שטח המעטפת של גליל שרדיוסו $${r}$ ס״מ וגובהו $${h}$ ס״מ? ${WITH_PI}`, form: 'num', answer: p.answer, unit: UNIT.cm2,
    fig: cylinderFig(r, h), after: PI_AFTER,
    hint: 'המעטפת פרושה היא מלבן: רוחבו היקף הבסיס, וגובהו גובה הגליל.',
    solution: [`היקף הבסיס: $2\\pi \\cdot ${r} = ${2 * r}\\pi$.`, `כפול הגובה: $${2 * r}\\pi \\cdot ${h} = ${2 * r * h}\\pi$ סמ״ר`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** The surface 2r² + 2rh with π: one base only is one-base, the lateral area alone no-bases. */
function ci3s() {
  const p = draw(() => { const q = CIRCLE3.params(rnd); const { r, h } = q; return { r, h, answer: 2 * r * r + 2 * r * h, printed: [r, h], bugs: [['one-base', r * r + 2 * r * h], ['no-bases', 2 * r * h]] }; });
  const { r, h } = p;
  return {
    key: `ci3s:${r}:${h}`, text: `מה שטח הפנים של גליל שרדיוסו $${r}$ ס״מ וגובהו $${h}$ ס״מ? ${WITH_PI}`, form: 'num', answer: p.answer, unit: UNIT.cm2,
    fig: cylinderFig(r, h), after: PI_AFTER,
    hint: 'שני בסיסים עגולים, ועוד המעטפת.',
    solution: [`שני בסיסים: $2 \\cdot ${r * r}\\pi = ${2 * r * r}\\pi$. המעטפת: $2\\pi \\cdot ${r} \\cdot ${h} = ${2 * r * h}\\pi$.`, `$${2 * r * r}\\pi + ${2 * r * h}\\pi = ${p.answer}\\pi$ סמ״ר`],
    diag: diagList(p.answer, p.bugs),
  };
}

/** Litres poured into a cylinder of base B cm²: the water's height (a whole height up to 40); L/B is no-convert. */
function ci3f() {
  const p = draw(() => {
    const B = pick(rnd, [200, 250, 400, 500, 800, 1000]); const L = rint(rnd, 1, 12); const h = (1000 * L) / B;
    if (!Number.isInteger(h) || h > 40) return null;
    return { B, L, answer: h, printed: [B, L], bugs: [['no-convert', L / B]] };
  });
  const { B, L, answer: h } = p;
  return {
    key: `ci3f:${B}:${L}`, text: `כלי בצורת גליל ששטח בסיסו $${B}$ סמ״ר. שופכים לתוכו $${L}$ ${L === 1 ? 'ליטר' : 'ליטרים'}. לאיזה גובה יגיעו המים?`,
    form: 'num', answer: h, unit: UNIT.cm,
    hint: 'קודם הליטרים בסמ״ק: ליטר אחד הוא $1000$ סמ״ק. ואז נפח לחלק לשטח הבסיס.',
    solution: [`$${L}$ ${L === 1 ? 'ליטר הוא' : 'ליטרים הם'} $${1000 * L}$ סמ״ק.`, `$${1000 * L} : ${B} = ${h}$ ס״מ`],
    diag: diagList(h, p.bugs),
  };
}

/** One sheet rolled two ways: which cylinder holds more? The long side round the base. Practice only. */
function ci3m() {
  for (;;) {
    const a = rint(rnd, 16, 30); const b = rint(rnd, 8, a - 4);
    const choices = shuffle([
      { text: 'זה שהצלע הארוכה מקיפה את הבסיס שלו', ok: true },
      { text: 'זה שהצלע הקצרה מקיפה את הבסיס שלו' },
      { text: 'לשניהם אותו נפח', bug: 'same-sheet' },
    ]);
    return {
      key: `ci3m:${a}:${b}`, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
      text: `מגלגלים דף נייר $${a}$ על $${b}$ ס״מ לגליל בלי בסיסים, פעם כך שהצלע של $${a}$ מקיפה את הבסיס, ופעם כך שהצלע של $${b}$ מקיפה אותו. איזה גליל מחזיק יותר?`,
      fig: sheetsFig(a, b),
      hint: 'הצלע שמקיפה את הבסיס היא ההיקף שלו. בנפח הרדיוס בריבוע, והגובה רק פעם אחת.',
      solution: [
        `הצלע שמקיפה היא ההיקף, $2\\pi r$, והצלע השנייה היא הגובה. הרדיוס בנפח בריבוע, ולכן כדאי שהוא יהיה מהצלע הארוכה.`,
        `הצלע של $${a}$ מקיפה: הגובה $${b}$. הצלע של $${b}$ מקיפה: הגובה $${a}$. הנפחים הם $\\frac{${a}^2 \\cdot ${b}}{4\\pi}$ ו־$\\frac{${b}^2 \\cdot ${a}}{4\\pi}$, והראשון גדול יותר.`,
      ],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- circle:4 — the cone

/** The volume of a cone with π, r, h and l written (the diagnostic model's draw). */
function ci4v() {
  const p = draw(() => { const q = CIRCLE4.params(rnd); return { ...q, answer: CIRCLE4.answer(q), printed: [q.r, q.h, q.l], bugs: bugsAt(CIRCLE4, q) }; });
  return {
    key: `ci4v:${p.r}:${p.h}:${p.l}`, text: circle4Text(p), form: 'num', answer: p.answer, unit: UNIT.cm3, fig: circle4Fig(p), after: PI_AFTER,
    hint: circle4Hint(), solution: circle4Solution(p), diag: diagList(p.answer, p.bugs),
  };
}

/** A cone's height from its radius and slant height (a triple): squares added is add-not-sub, sides subtracted subtract-sides. */
function ci4h() {
  const p = draw(() => {
    const [p1, q1, c] = pick(rnd, T30); const [r, h] = rnd() < 0.5 ? [p1, q1] : [q1, p1];
    return { r, h, l: c, answer: h, printed: [r, c], bugs: [['add-not-sub', Math.sqrt(c * c + r * r)], ['subtract-sides', c - r]] };
  });
  const { r, h, l } = p;
  return {
    key: `ci4h:${r}:${l}`, text: `לחרוט רדיוס $${r}$ ס״מ וקו יוצר $${l}$ ס״מ. מה גובהו?`, form: 'num', answer: h, unit: UNIT.cm,
    fig: coneFig(r, h, l, { labels: { r, h: '?', l } }),
    hint: 'הגובה, הרדיוס והקו היוצר יוצרים משולש ישר־זווית. הקו היוצר הוא היתר.',
    // one chain a line, short enough for the smallest phone (e2e/solutions-fit.spec.js): the words name the height's
    // square, so the line of maths starts at the squares
    solution: [`הגובה בריבוע: $${l}^2 - ${r}^2 = ${l * l} - ${r * r} = ${h * h}$.`, `הגובה: $\\sqrt{${h * h}} = ${h}$ ס״מ`],
    diag: diagList(h, p.bugs),
  };
}

/** The area of a cone's axial section from its radius (g 0) or diameter (g 1) and height; redrawn at rh = 20. */
function ci4a() {
  const p = draw(() => {
    const r = rint(rnd, 2, 12); const h = rint(rnd, 3, 20); if (r * h === 20) return null;
    const g = rnd() < 0.5 ? 0 : 1;
    return { g, r, h, answer: r * h, printed: g ? [2 * r, h] : [r, h], bugs: [['no-half', 2 * r * h], ['r-for-d', (r * h) / 2]] };
  });
  const { g, r, h } = p;
  return {
    key: `ci4a:${g}:${r}:${h}`, text: `מה שטח החתך הצירי של חרוט ש${g ? `קוטרו $${2 * r}$` : `רדיוסו $${r}$`} ס״מ וגובהו $${h}$ ס״מ?`, form: 'num', answer: r * h, unit: UNIT.cm2,
    fig: axialFig(g, r, h),
    hint: 'החתך הצירי הוא משולש: בסיסו הקוטר של החרוט, וגובהו גובה החרוט.',
    solution: [`בסיס המשולש הוא הקוטר, $${2 * r}$, וגובהו $${h}$.`, `$\\frac{${2 * r} \\cdot ${h}}{2} = ${r * h}$ סמ״ר`],
    diag: diagList(r * h, p.bugs),
  };
}

/** A cone with the base and height of a cylinder of volume Vπ (h a multiple of 3): its volume; V itself is no-third. */
function ci4c() {
  const p = draw(() => { const r = rint(rnd, 2, 10); const h = 3 * rint(rnd, 1, 8); const V = r * r * h; return { V, answer: V / 3, printed: [V], bugs: [['no-third', V]] }; });
  const { V } = p;
  return {
    key: `ci4c:${V}`, text: `נפח גליל $${V}\\pi$ סמ״ק. מה נפח חרוט עם אותו בסיס ואותו גובה? ${WITH_PI}`, form: 'num', answer: V / 3, unit: UNIT.cm3, after: PI_AFTER,
    hint: 'חרוט הוא שליש מגליל שיש לו אותו בסיס ואותו גובה.',
    solution: ['שלושה חרוטים כאלה ממלאים בדיוק את הגליל.', `$${V}\\pi : 3 = ${V / 3}\\pi$ סמ״ק`],
    diag: diagList(V / 3, p.bugs),
  };
}

/** How many full cones fill a cylinder with the same base and height: three. One is no-third. Practice only. */
function ci4m() {
  const [r, h] = pick(rnd, [[3, 4], [4, 6], [5, 9], [6, 8], [2, 5], [4, 10]]);
  const choices = shuffle([{ tex: '3', ok: true }, { tex: '2' }, { tex: '1', bug: 'no-third' }]);
  return {
    key: `ci4m:${r}:${h}`, form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    text: `לחרוט רדיוס $${r}$ ס״מ וגובה $${h}$ ס״מ. כמה חרוטים כאלה, מלאים במים, ממלאים גליל עם אותו בסיס ואותו גובה?`,
    fig: coneFig(r, h),
    hint: 'נפח חרוט הוא חלק מנפח הגליל שיש לו אותו בסיס ואותו גובה. איזה חלק?',
    solution: ['נפח החרוט שליש מנפח הגליל, $\\frac{\\pi r^2 h}{3}$.', 'לכן שלושה חרוטים מלאים ממלאים בדיוק את הגליל.'],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- the topic

/** The practice kinds of each stair with their weights (stage2.md MEASURE-4; "check" kinds may be in a check). */
export const KINDS = {
  1: [[30, ci1p], [30, ci1n], [20, ci1r], [10, ci1w], [10, ci1m]],
  2: [[35, ci2p], [25, ci2n], [15, ci2h], [15, ci2r], [10, ci2m]],
  3: [[35, ci3v], [20, ci3l], [15, ci3s], [15, ci3f], [15, ci3m]],
  4: [[35, ci4v], [20, ci4h], [15, ci4a], [15, ci4c], [15, ci4m]],
};
/** Every kind's key prefix, by stair. */
export const KIND_KEYS = Object.fromEntries(Object.entries(KINDS).map(([lv, list]) => [lv, list.map(([, f]) => f.name)]));

export const CIRCLE = {
  id: 'circle', grade: '8', title: 'מעגל, גליל וחרוט', desc: 'היקף מעגל, שטח עיגול, גליל וחרוט', color: 'cobalt',
  // taught in October and November: the first-day placement test does not ask it
  placement: false,
  levels: [
    { title: 'היקף מעגל', gen: byWeight(KINDS[1]) },
    { title: 'שטח עיגול', gen: byWeight(KINDS[2]) },
    { title: 'גליל', gen: byWeight(KINDS[3]) },
    { title: 'חרוט', gen: byWeight(KINDS[4]) },
  ],
  cats: {
    'r-for-d': 'השתמשו ברדיוס במקום בקוטר',
    'd-for-r': 'השתמשו בקוטר במקום ברדיוס',
    'area-for-circ': 'חישבו שטח במקום היקף',
    'circ-for-area': 'חישבו היקף במקום שטח',
    'd-in-area': 'העלו בריבוע את הקוטר במקום את הרדיוס',
    'whole-circle': 'חישבו את כל העיגול במקום חלק ממנו',
    'ring-sub-radii': 'חיסרו רדיוסים לפני ההעלאה בריבוע',
    // the ids other topics already use keep their names (area's no-subtract, pyth's two, linear's no-half), but for
    // three said in this unit's words: one-base (the cylinder's two bases), no-convert (litres and cm³) and
    // slant-as-height (the cone's slant height)
    'no-subtract': 'חישבו את הצורה השלמה ולא הורידו את החלק החסר',
    'lateral-for-vol': 'חישבו מעטפת במקום נפח',
    'one-base': 'ספרו רק בסיס אחד',
    'no-bases': 'חישבו רק את המעטפת, בלי הבסיסים',
    'no-convert': 'שכחו להמיר בין ליטרים לסמ״ק',
    'no-third': 'שכחו לחלק ב־$3$',
    'slant-as-height': 'השתמשו בקו היוצר במקום בגובה',
    'add-not-sub': 'חיברו ריבועים במקום לחסר (כשמחפשים ניצב)',
    'subtract-sides': 'חיסרו צלעות בלי לרבע',
    'no-half': 'שכחו לחלק ב־2 בשטח המשולש',
    'same-sheet': 'חשבו שמאותו דף יוצאים גלילים שווים בנפח',
  },
  lesson: {
    points: [
      'היקף מעגל: $\\pi d = 2\\pi r$, ו־$\\pi \\approx 3.14$.',
      'שטח עיגול: $\\pi r^2$. רדיוס $5$: $25\\pi \\approx 78.5$.',
      'גליל: המעטפת היא מלבן, $2\\pi r \\cdot h$; הנפח $\\pi r^2 h$.',
      'חרוט: שליש מהגליל, $\\frac{\\pi r^2 h}{3}$.',
      'בחרוט: $h^2 + r^2 = \\ell^2$.',
    ],
    words: ['מעגל', 'עיגול', 'מרכז', 'רדיוס', 'קוטר', 'היקף מעגל', 'π', 'שטח עיגול', 'חצי עיגול', 'טבעת', 'גליל', 'בסיסי הגליל', 'מעטפת', 'שטח פנים', 'נפח', 'חרוט', 'קודקוד החרוט', 'גובה החרוט', 'קו יוצר', 'חתך צירי'],
  },
};
