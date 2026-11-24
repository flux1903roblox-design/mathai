// Areas and perimeters (שטחים והיקפים): unit 7.12 of grade 7 (ז׳) in the Ministry's תשפ״ז schedule, areas A in December
// and January, areas B in April and perimeters in May (curriculum stage 2, MEASURE-2). Five stairs in school order: the
// rectangle's perimeter and area, the triangle (CLASSROOM-13's right triangle inside, in the class's form), composite
// shapes, the parallelogram and the trapezoid, and perimeters (the same perimeter, another area).
//
// One picture carries the unit: area counts the squares inside, perimeter walks round the edge. Every formula is found by
// cutting, moving and completing (a triangle is half a rectangle, a parallelogram becomes a rectangle, two trapezoids make
// a parallelogram, an L is a rectangle less its corner), on the grid object (`polygon`) where a finger can do it. The
// height is the distance to the base's line, in a right angle, inside or outside: the slanted side is never it.
// The diagnostic models are the spec's (content/area.js AREA1 to AREA5T, ported unchanged); every misconception's source
// is listed in content/area.js. The Ministry's situations (the three triangles between parallels, the trapezoid cut into a
// rectangle and a triangle, the tiled floor, the frame in metres and centimetres) are used; the sentences are the app's
// own. Every number written here is checked by the lane's spec/facts-area-teach.mjs, and the maths of every step by
// learn/content.test.ts.
import type { DiagModel, FigSpec, ManipSpec, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and drawings
import * as AREA_JS from '@/content/area.js';

// the drawings content/area.js builds are geo figures (FigSpec); its inferred types say only "string" for their type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G: any = AREA_JS;

// ---------------------------------------------------------------- figures
// Still geo drawings (components/Figure.jsx), drawn to scale. A point whose name starts with "_" has no letter.

type Pt = [number, number];
const geo = (label: string, pts: Record<string, Pt>, rest: Record<string, unknown> = {}): FigSpec => ({ type: 'geo', label, pts, ...rest });
const lab = (a: string, b: string, label: string | number, extra: Record<string, unknown> = {}) => ({ a, b, label: String(label), ...extra });
const seg = (a: string, b: string, extra: Record<string, unknown> = {}) => ({ a, b, ...extra });
const rightAt = (at: string, from: string, to: string) => ({ at, from, to, right: true });
const word = (at: Pt, text: string) => ({ at, text });

/** A w by h rectangle on the grid; `thick` draws its edge bold (the perimeter), `words` writes inside it. */
function gridRect(w: number, h: number, opts: { labels?: [string | number, string | number]; thick?: boolean; words?: { at: Pt; text: string }[] } = {}): FigSpec {
  const [lw, lh] = opts.labels || [w, h];
  const hi = opts.thick ? { hi: true } : {};
  return geo('מלבן על רשת משבצות', { _a: [0, 0], _b: [w, 0], _c: [w, h], _d: [0, h] }, {
    grid: [0, 0, w, h], polys: [{ pts: ['_a', '_b', '_c', '_d'] }],
    segs: [lab('_a', '_b', lw, hi), lab('_b', '_c', lh, hi), seg('_c', '_d', hi), seg('_d', '_a', hi)],
    ...(opts.words ? { words: opts.words } : {}),
  });
}
/** A w by h rectangle off the grid, its two sides written (or other words), and words inside. */
function rect(w: number, h: number, labels: [string | number, string | number], words: { at: Pt; text: string }[] = [], hiHalf = false): FigSpec {
  const hi = hiHalf ? { hi: true } : {};
  return geo('מלבן', { _a: [0, 0], _b: [w, 0], _c: [w, h], _d: [0, h] }, {
    polys: [{ pts: ['_a', '_b', '_c', '_d'] }],
    segs: [lab('_a', '_b', labels[0], hi), lab('_b', '_c', labels[1], hi), seg('_c', '_d'), seg('_d', '_a')],
    ...(words.length ? { words } : {}),
  });
}
/** A right triangle with legs p (up) and q (across) in its dashed p by q rectangle; `hyp` writes the hypotenuse. */
function triInRect(q: number, p: number, labels: [string | number, string | number], words: { at: Pt; text: string }[] = []): FigSpec {
  return geo('משולש ישר־זווית בתוך מלבן', { _o: [0, 0], _q: [q, 0], _c: [q, p], _p: [0, p] }, {
    polys: [{ pts: ['_o', '_q', '_p'] }],
    segs: [lab('_o', '_q', labels[0]), lab('_o', '_p', labels[1]), seg('_q', '_c', { dash: true }), seg('_c', '_p', { dash: true })],
    angles: [rightAt('_o', '_q', '_p')], ...(words.length ? { words } : {}),
  });
}
/** A right triangle with legs across (q) and up (p), written as given, and words beside it. */
function legs(q: number, p: number, labels: [string | number, string | number], words: { at: Pt; text: string }[] = []): FigSpec {
  return geo('משולש ישר־זווית', { _o: [0, 0], _q: [q, 0], _p: [0, p] }, {
    polys: [{ pts: ['_o', '_q', '_p'] }], segs: [lab('_o', '_q', labels[0]), lab('_o', '_p', labels[1])],
    angles: [rightAt('_o', '_q', '_p')], ...(words.length ? { words } : {}),
  });
}
/** The obtuse triangle of area:2 (BC 6, the height 4 outside, AB 5), with three dashed segments from A when `three`. */
function obtuse(b: number, h: number, d: number, s: number, three = false): FigSpec {
  if (!three) return G.heightFig({ b, h, d, s, out: 1 });
  return geo('משולש קהה־זווית ושלושה קטעים מהקודקוד A', { B: [0, 0], C: [b, 0], A: [-d, h], _H: [-d, 0], _M: [b / 2, 0] }, {
    polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [lab('B', 'C', b), seg('_H', 'B', { dash: true }), seg('A', '_H', { dash: true }), seg('A', '_M', { dash: true }), seg('B', '_M', { ticks: 1 }), seg('_M', 'C', { ticks: 1 })],
    angles: [rightAt('_H', 'B', 'A')], lab: { B: [-15, 12] },
  });
}
/** A triangle in its dashed rectangle: base a, the height hₐ inside it (the rule's figure). */
const triRule: FigSpec = geo('משולש בתוך מלבן: בסיס וגובה', { _b: [0, 0], _c: [8, 0], _a: [3, 4], _h: [3, 0], _r: [8, 4], _l: [0, 4] }, {
  polys: [{ pts: ['_a', '_b', '_c'] }],
  segs: [lab('_b', '_c', 'a'), lab('_a', '_h', 'hₐ', { dash: true }), seg('_c', '_r', { dash: true }), seg('_r', '_l', { dash: true }), seg('_l', '_b', { dash: true })],
  angles: [rightAt('_h', '_c', '_a')],
});
/** The L of area:3 and area:5 on the grid: 8 by 6 less its top right corner 3 by 2. */
const L862 = { ...G.lFig(8, 6, 3, 2), grid: [0, 0, 8, 6] } as FigSpec;
/** The L with the two rectangles someone added: 8 by 4 and 5 by 6, overlapping in 5 by 4. */
const lOverlap: FigSpec = geo('צורת L ושני מלבנים שחופפים', { _1: [0, 0], _2: [8, 0], _3: [8, 4], _4: [5, 4], _5: [5, 6], _6: [0, 6], _7: [0, 4], _8: [5, 0] }, {
  polys: [{ pts: ['_1', '_2', '_3', '_4', '_5', '_6'] }, { pts: ['_1', '_2', '_3', '_7'], tone: 'add' }, { pts: ['_1', '_8', '_5', '_6'], tone: 'add' }],
  segs: [lab('_1', '_2', 8), lab('_6', '_1', 6), lab('_2', '_3', 4), lab('_5', '_6', 5)],
});
/** A kite with diagonals across (10) and up (6) in its dashed 10 by 6 rectangle. */
function kiteInRect(): FigSpec {
  const k = G.diagonalsFig(10, 6, true);
  return {
    ...k, label: 'דלתון ואלכסוניו, בתוך מלבן',
    pts: { ...k.pts, _r1: [0, -3], _r2: [10, -3], _r3: [10, 3], _r4: [0, 3] },
    segs: [...k.segs, seg('_r1', '_r2', { dash: true }), seg('_r2', '_r3', { dash: true }), seg('_r3', '_r4', { dash: true }), seg('_r4', '_r1', { dash: true })],
  } as FigSpec;
}
/** The parallelogram of area:4 (base 6, height 4, its left triangle 2 wide), the triangle moved to the right in `moved`. */
function paraMove(moved: boolean): FigSpec {
  const pts: Record<string, Pt> = { _1: [0, 0], _2: [6, 0], _3: [8, 4], _4: [2, 4], _5: [2, 0], _6: [8, 0] };
  return geo(moved ? 'מקבילית, והמשולש שעבר לצד השני' : 'מקבילית, ומשולש שזז לצד השני', pts, moved
    ? {
      polys: [{ pts: ['_1', '_2', '_3', '_4'] }, { pts: ['_1', '_5', '_4'], tone: 'cut' }, { pts: ['_2', '_6', '_3'], tone: 'add' }],
      segs: [lab('_5', '_6', 'a'), lab('_4', '_5', 'hₐ', { dash: true })], angles: [rightAt('_5', '_6', '_4')],
    }
    : {
      polys: [{ pts: ['_1', '_2', '_3', '_4'] }, { pts: ['_1', '_5', '_4'], tone: 'add' }],
      segs: [lab('_1', '_2', 6), lab('_4', '_5', 4, { dash: true })], angles: [rightAt('_5', '_2', '_4')],
      moves: [{ from: [1.4, 1.6], to: [7.4, 1.6] }],
    });
}
/** Two equal trapezoids (bases a and b, height h), the second turned, making a parallelogram with base a + b. */
const twoTraps: FigSpec = geo('שני טרפזים זהים, אחד הפוך, יוצרים מקבילית', { _1: [0, 0], _2: [6, 0], _3: [4, 3], _4: [1, 3], _5: [9, 0], _6: [10, 3], _7: [1, 0] }, {
  polys: [{ pts: ['_1', '_2', '_3', '_4'] }, { pts: ['_2', '_5', '_6', '_3'], tone: 'add' }],
  segs: [lab('_1', '_2', 'a'), lab('_4', '_3', 'b'), lab('_2', '_5', 'b'), lab('_3', '_6', 'a'), lab('_4', '_7', 'h', { dash: true })],
  angles: [rightAt('_7', '_2', '_4')],
});
/** A trapezoid with bases 7 and 5 and height 4. */
const trap754: FigSpec = geo('טרפז', { _1: [0, 0], _2: [7, 0], _3: [6, 4], _4: [1, 4], _5: [1, 0] }, {
  polys: [{ pts: ['_1', '_2', '_3', '_4'] }],
  segs: [lab('_1', '_2', 7), lab('_4', '_3', 5), lab('_4', '_5', 4, { dash: true })], angles: [rightAt('_5', '_2', '_4')],
});
/** The right trapezoid 8, 5, 4 cut into a 5 by 4 rectangle and a triangle. */
const trapCut: FigSpec = geo('טרפז ישר־זווית: מלבן ומשולש', { _1: [0, 0], _2: [8, 0], _3: [5, 4], _4: [0, 4], _5: [5, 0] }, {
  polys: [{ pts: ['_1', '_2', '_3', '_4'] }, { pts: ['_5', '_2', '_3'], tone: 'add' }],
  segs: [lab('_1', '_2', 8), lab('_4', '_3', 5), lab('_1', '_4', 4), seg('_3', '_5', { dash: true })],
  angles: [rightAt('_1', '_2', '_4'), rightAt('_4', '_1', '_3')],
});
/** Rectangles side by side, each its sides and its area written inside. */
function rects(list: [number, number][], gap = 2, withArea = true): FigSpec {
  const pts: Record<string, Pt> = {}; const polys: unknown[] = []; const segs: unknown[] = []; const words: unknown[] = [];
  let x = 0;
  list.forEach(([w, h], i) => {
    const n = (k: string) => `_${i}${k}`;
    pts[n('a')] = [x, 0]; pts[n('b')] = [x + w, 0]; pts[n('c')] = [x + w, h]; pts[n('d')] = [x, h];
    polys.push({ pts: [n('a'), n('b'), n('c'), n('d')] });
    segs.push(lab(n('a'), n('b'), w), lab(n('b'), n('c'), h), seg(n('c'), n('d')), seg(n('d'), n('a')));
    if (withArea) words.push(word([x + w / 2, h / 2], String(w * h)));
    x += w + gap;
  });
  return geo(list.length === 2 ? 'שני מלבנים' : 'מלבנים זה ליד זה', pts, { polys, segs, ...(words.length ? { words } : {}) });
}

// the grid object (components/manip/GridShape.jsx)
const rectBuild = (start: { w: number; h: number }): ManipSpec => ({ kind: 'polygon', grid: [10, 8], task: 'rect', start });
const L_SHAPE: Pt[] = [[0, 0], [8, 0], [8, 4], [5, 4], [5, 6], [0, 6]];
const cutL: ManipSpec = { kind: 'polygon', grid: [8, 6], task: 'cut', shape: L_SHAPE, start: { axis: 'y', at: 1 } };
const apex: ManipSpec = { kind: 'polygon', grid: [10, 6], task: 'apex', base: { x0: 0, x1: 8, h: 4 }, start: { x: 6 } };
const movePara: ManipSpec = {
  kind: 'polygon', grid: [10, 6], task: 'move', shape: [[2, 0], [6, 0], [8, 4], [2, 4]],
  piece: { pts: [[0, 0], [2, 0], [2, 4]], name: 'המשולש' }, start: { dx: 0, dy: 0 },
};

// ================================================================ the models (content/area.js, ported unchanged)

type P1 = { k: number; a: number; b: number };
const area1: DiagModel<P1> = {
  params: (rnd) => G.AREA1.params(rnd), text: (p) => G.area1Text(p), fig: (p) => G.area1Fig(p),
  answer: (p) => G.AREA1.answer(p), bugs: G.AREA1.bugs, solution: (p) => G.area1Solution(p), hint: () => G.area1Hint(),
  unit: (p) => G.area1Unit(p),
};
type P1T = { a: number; b: number; P: number };
const area1T: DiagModel<P1T> = {
  params: (rnd) => G.AREA1T.params(rnd), text: (p) => G.gardenText(p),
  answer: (p) => G.AREA1T.answer(p), bugs: G.AREA1T.bugs, solution: (p) => G.gardenSolution(p), hint: () => G.gardenHint(), unit: G.UNIT.m,
};
type P2 = { b: number; h: number; d: number; s: number; out: number };
const area2: DiagModel<P2> = {
  params: (rnd) => G.AREA2.params(rnd), text: (p) => G.area2Text(p), fig: (p) => G.area2Fig(p),
  answer: (p) => G.AREA2.answer(p), bugs: G.AREA2.bugs, solution: (p) => G.area2Solution(p), hint: () => G.area2Hint(), unit: G.UNIT.cm2,
};
type P2T = { a: number; x: number; S: number; at: 'A' | 'B' | 'C' };
const area2T: DiagModel<P2T> = {
  params: (rnd) => G.AREA2T.params(rnd), text: (p) => G.area2TText(p), fig: (p) => G.area2TFig(p),
  answer: (p) => G.AREA2T.answer(p), bugs: G.AREA2T.bugs, solution: (p) => G.area2TSolution(p), hint: (p) => G.area2THint(p), unit: G.UNIT.cm,
};
type P3 = { W: number; H: number; w: number; h: number };
const area3: DiagModel<P3> = {
  params: (rnd) => G.AREA3.params(rnd), text: (p) => G.area3Text(p), fig: (p) => G.area3Fig(p),
  answer: (p) => G.AREA3.answer(p), bugs: G.AREA3.bugs, solution: (p) => G.area3Solution(p), hint: () => G.area3Hint(), unit: G.UNIT.cm2,
};
type P3T = { W: number; H: number; p: number; q: number };
const area3T: DiagModel<P3T> = {
  params: (rnd) => G.AREA3T.params(rnd), text: (p) => G.plotText(p), fig: (p) => G.plotFigOf(p),
  answer: (p) => G.AREA3T.answer(p), bugs: G.AREA3T.bugs, solution: (p) => G.plotSolution(p), hint: () => G.plotHint(), unit: G.UNIT.m2,
};
type P4 = { a: number; b: number; h: number; s: number };
const area4: DiagModel<P4> = {
  params: (rnd) => G.AREA4.params(rnd), text: (p) => G.area4Text(p), fig: (p) => G.area4Fig(p),
  answer: (p) => G.AREA4.answer(p), bugs: G.AREA4.bugs, solution: (p) => G.area4Solution(p), hint: () => G.area4Hint(), unit: G.UNIT.cm2,
};
type P4T = { a: number; h: number; s: number };
const area4T: DiagModel<P4T> = {
  params: (rnd) => G.AREA4T.params(rnd), text: (p) => G.paraPlotText(p), fig: (p) => G.paraPlotFig(p),
  answer: (p) => G.AREA4T.answer(p), bugs: G.AREA4T.bugs, solution: (p) => G.paraPlotSolution(p), hint: () => G.paraPlotHint(), unit: G.UNIT.m2,
};
const area5: DiagModel<P3> = {
  params: (rnd) => G.AREA5.params(rnd), text: (p) => G.area5Text(p), fig: (p) => G.area5Fig(p),
  answer: (p) => G.AREA5.answer(p), bugs: G.AREA5.bugs, solution: (p) => G.area5Solution(p), hint: () => G.area5Hint(), unit: G.UNIT.cm,
};
type P5T = { a: number; b: number };
const area5T: DiagModel<P5T> = {
  params: (rnd) => G.AREA5T.params(rnd), text: (p) => G.boardText(p),
  answer: (p) => G.AREA5T.answer(p), bugs: G.AREA5T.bugs, solution: (p) => G.boardSolution(p), hint: () => G.boardHint(), unit: G.UNIT.cm,
};

// ================================================================ stair 1: the rectangle's perimeter and area

const stair1: StairContent = {
  skill: 'area:1', topic: 'area', level: 1, title: 'היקף ושטח של מלבן',
  objectives: [
    'להבחין בין היקף, האורך מסביב, לבין שטח, כמה משבצות מכסות.',
    'לחשב היקף ושטח של מלבן ושל ריבוע, ולמצוא צלע חסרה מהשטח או מההיקף.',
    'לכתוב יחידות מתאימות: ס״מ להיקף, סמ״ר לשטח.',
  ],
  idea: 'שטח סופר משבצות בפנים; היקף מודד את הגבול מסביב. במלבן: שטח הוא אורך כפול רוחב, והיקף הוא שני אורכים ושני רוחבים.',
  why: [
    'במלבן $a$ על $b$ יש $b$ שורות של $a$ משבצות, ולכן השטח $a \\cdot b$.',
    'ההיקף הולך מסביב: אורך, רוחב, אורך, רוחב, כלומר $2(a + b)$.',
  ],
  alt: ['גינה: השטח הוא כמה דשא צריך, וההיקף הוא כמה גדר צריך.'],
  discover: [
    { kind: 'say', text: 'ההיקף הוא האורך של הגבול, הקו מסביב. השטח הוא כמה משבצות מכסות את הצורה.', fig: gridRect(5, 3, { thick: true }) },
    { kind: 'predict', text: 'מלבן $6$ על $4$. מה השטח שלו?', fig: gridRect(6, 4),
      choices: ['$24$ סמ״ר', '$20$ ס״מ', '$10$'], answer: 0,
      why: '$4$ שורות של $6$ משבצות: $4 \\cdot 6 = 24$ משבצות של סמ״ר.',
      wrongWhy: { 1: '$20$ הוא ההיקף: $6 + 4 + 6 + 4$. ההיקף מודד את הגבול, לא את מה שבפנים.', 2: '$6 + 4$ הוא רק אורך ורוחב, לא משבצות.' } },
    { kind: 'rule', text: 'שטח מלבן: אורך כפול רוחב. היקף מלבן: סכום כל הצלעות.', display: 'S = a \\cdot b,\\qquad P = 2(a + b)',
      why: 'בשטח סופרים משבצות בשורות. בהיקף הולכים מסביב: שני אורכים ושני רוחבים.',
      fig: gridRect(6, 4, { words: [word([3, 2.4], 'שטח 24'), word([3, 1.2], 'היקף 20')] }) },
    { kind: 'explore', text: 'בנו מלבן ששטחו $12$ משבצות והיקפו $14$.', manip: rectBuild({ w: 2, h: 2 }), answer: { mode: 'rect', area: 12, perim: 14 },
      hint: 'מלבנים ששטחם $12$: $1 \\cdot 12$, $2 \\cdot 6$, $3 \\cdot 4$. לאיזה מהם היקף $14$?',
      success: '$3 \\cdot 4 = 12$ משבצות, ו־$2 \\cdot (3 + 4) = 14$.' },
    { kind: 'predict', text: 'באיזו יחידה מודדים שטח?',
      fig: geo('ריבוע שצלעו 1 ס״מ', { _a: [0, 0], _b: [1, 0], _c: [1, 1], _d: [0, 1] }, { polys: [{ pts: ['_a', '_b', '_c', '_d'] }], segs: [lab('_a', '_b', '1 ס״מ'), lab('_b', '_c', '1 ס״מ')], view: [220, 170] }),
      choices: ['סמ״ר: ריבוע שצלעו $1$ ס״מ', 'ס״מ'], answer: 0,
      why: 'שטח נמדד בריבועים. סמ״ר הוא ריבוע שצלעו $1$ ס״מ, ומ״ר ריבוע שצלעו $1$ מ׳.',
      wrongWhy: { 1: 'ס״מ מודד אורך, קו. שטח מכסה משבצות, ולכן מודדים אותו בריבועים.' } },
    { kind: 'predict', text: 'שטח מלבן $35$ סמ״ר, ואורכו $7$ ס״מ. מה רוחבו?', fig: rect(7, 5, [7, '?'], [word([3.5, 2.5], '35')]),
      choices: ['$5$', '$28$', '$10.5$'], answer: 0,
      why: '$7 \\cdot \\square = 35$, ולכן הרוחב $35 : 7 = 5$.',
      wrongWhy: { 1: '$35 - 7$: חיסרתם, אבל השטח הוא כפל. מחלקים.', 2: '$10.5 = 35 : 2 - 7$: כך מוצאים צלע מהיקף. כאן $35$ הוא שטח.' } },
    { kind: 'rule', text: 'מצלע ושטח: מחלקים. מצלע והיקף: חצי היקף הוא אורך ועוד רוחב.', display: 'P = 30,\\ a = 9:\\quad a + b = 15,\\ b = 6',
      why: 'בהיקף יש כל אורך פעמיים, ולכן חצי היקף הוא אורך אחד ועוד רוחב אחד.', fig: rect(9, 6, [9, 6], [], true) },
    { kind: 'predict', text: 'היקף מלבן $30$ ס״מ, ואורכו $9$ ס״מ. מה רוחבו?', fig: rect(9, 6, [9, '?'], [word([4.5, 3], 'היקף 30')]),
      choices: ['$6$', '$21$', '$15$'], answer: 0,
      why: '$30 : 2 = 15$ הם אורך ועוד רוחב, ולכן הרוחב $15 - 9 = 6$.',
      wrongWhy: { 1: '$30 - 9$ מוריד רק אורך אחד. בהיקף יש שני אורכים.', 2: '$15$ הם אורך ועוד רוחב יחד.' } },
  ],
  examples: [
    { problem: 'מה שטח מלבן שאורכו $9$ ס״מ ורוחבו $4$ ס״מ?', answer: 36, check: '9*4', fig: rect(9, 4, [9, 4]),
      steps: [
        { action: 'שטח: אורך כפול רוחב.', why: 'יש $4$ שורות של $9$ משבצות.', result: '9 \\cdot 4 = 36', value: '9*4' },
        { action: 'כותבים את היחידה: סמ״ר.', why: 'שטח נמדד במשבצות של סנטימטר על סנטימטר.', result: '36', value: '36' },
      ] },
    { problem: 'היקף מלבן $26$ ס״מ, ורוחבו $5$ ס״מ. מה אורכו?', answer: 8, check: '26/2-5',
      steps: [
        { action: 'חצי היקף הוא אורך ועוד רוחב.', why: 'בהיקף יש שני אורכים ושני רוחבים.', result: '26 : 2 = 13', calc: { expr: '26/2', value: 13 } },
        { action: 'האורך: מורידים את הרוחב.', why: 'אורך ועוד $5$ הם $13$.', result: '13 - 5 = 8', value: '13-5' },
        { action: 'בדיקה: $2 \\cdot (8 + 5) = 26$.', why: 'שני אורכים ושני רוחבים צריכים לתת את ההיקף.', result: '2 \\cdot (8 + 5) = 26', calc: { expr: '2*(8+5)', value: 26 } },
      ] },
    { problem: 'שטח ריבוע $49$ סמ״ר. מה היקפו?', answer: 28, check: '4*7',
      steps: [
        { action: 'צלע הריבוע: מספר שבריבוע נותן $49$.', why: 'בריבוע האורך והרוחב שווים, והשטח הוא צלע כפול צלע.', result: '7 \\cdot 7 = 49', calc: { expr: '7*7', value: 49 } },
        { action: 'ההיקף: ארבע צלעות.', why: 'לריבוע ארבע צלעות שוות, כל אחת $7$ ס״מ.', result: '4 \\cdot 7 = 28', value: '4*7' },
      ] },
  ],
  together: [
    { problem: 'מלבן שאורכו $11$ ס״מ ורוחבו $3$ ס״מ. מה שטחו?', fig: rect(11, 3, [11, 3]),
      steps: [
        { prompt: 'מה מחשבים?', choices: [
          { text: 'כמה משבצות בפנים: $11 \\cdot 3$', ok: true, feedback: 'שלוש שורות של $11$.' },
          { text: 'את הגבול: $11 + 3 + 11 + 3$', ok: false, feedback: 'זה ההיקף. השטח הוא מה שבפנים.' },
          { text: '$11 + 3$', ok: false, feedback: 'חיבור של אורך ורוחב לא סופר משבצות.' },
        ], hints: ['שטח נמדד בסמ״ר: משבצות.', '$11 \\cdot 3$.'], done: 'כופלים: $11 \\cdot 3$.' },
      ],
      final: { prompt: 'השטח בסמ״ר:', answer: 33, check: '11*3', hints: ['שלוש שורות.', '$3 \\cdot 11$.'] } },
    { problem: 'סביב גינה מלבנית שאורכה $14$ מ׳ יש גדר באורך $40$ מ׳. מה רוחב הגינה?',
      steps: [
        { prompt: 'מה הם $40$ המטרים?', choices: [
          { text: 'ההיקף: שני אורכים ושני רוחבים', ok: true, feedback: 'נכון: גדר הולכת מסביב.' },
          { text: 'השטח', ok: false, feedback: 'גדר הולכת מסביב: זה אורך, לא משבצות.' },
        ], hints: ['גדר מקיפה את הגינה.', 'הגדר היא ההיקף.'], done: '$40$ מ׳ הם ההיקף.' },
        { prompt: 'אורך ועוד רוחב:', choices: [
          { text: '$20$', ok: true, feedback: 'חצי מהגדר: $40 : 2 = 20$.' },
          { text: '$26$', ok: false, feedback: '$40 - 14$ מוריד רק אורך אחד.' },
        ], hints: ['חצי מהגדר.', '$40 : 2 = 20$.'], done: 'אורך ועוד רוחב הם $20$.' },
      ],
      final: { prompt: 'הרוחב במטרים:', answer: 6, check: '40/2-14', hints: ['$20$ פחות האורך.', '$20 - 14$.'] } },
  ],
  diag: area1,
  transfer: area1T,
  misconceptions: [
    { id: 'perimeter', title: 'חישבו היקף במקום שטח',
      cause: 'שתי הנוסחאות של המלבן משתמשות באותם שני מספרים, ולכן קל להחליף ביניהן.',
      explain: ['שטח סופר משבצות בפנים, ונמדד בסמ״ר.', 'היקף סופר צעדים מסביב, ונמדד בס״מ.'],
      remedy: [
        { kind: 'predict', text: 'מלבן $5$ על $3$: כמה משבצות בפנים?', fig: gridRect(5, 3), choices: ['$15$', '$16$'], answer: 0,
          why: '$3$ שורות של $5$ משבצות: $15$. $16$ הוא ההיקף, הצעדים מסביב.', wrongWhy: { 1: '$16 = 5 + 3 + 5 + 3$ סופר את הגבול, לא את מה שבפנים.' } },
        { kind: 'explore', text: 'בנו מלבן ששטחו $10$ משבצות והיקפו $14$.', manip: rectBuild({ w: 1, h: 1 }), answer: { mode: 'rect', area: 10, perim: 14 },
          hint: 'שטח $10$: $2 \\cdot 5$ או $1 \\cdot 10$. למי מהם היקף $14$?', success: '$5 \\cdot 2 = 10$ משבצות בפנים, ו־$14$ צעדים מסביב.' },
      ] },
    { id: 'add-sides', title: 'חיברו את הצלעות במקום לכפול',
      cause: 'בשרטוט כתובים שני מספרים, ונדמה שמחברים אותם.',
      explain: ['שטח הוא שורות של משבצות: כל שורה באורך המלבן, וכמה שורות כמו הרוחב.', 'לכן כופלים: $6 \\cdot 2 = 12$, ולא $6 + 2$.'],
      remedy: [
        { kind: 'predict', text: 'מלבן $6$ על $2$: כמה משבצות בפנים?', fig: gridRect(6, 2), choices: ['$12$', '$8$'], answer: 0,
          why: 'שתי שורות של $6$: $6 \\cdot 2 = 12$.', wrongWhy: { 1: '$6 + 2 = 8$ לא סופר משבצות. ספרו את השורות.' } },
      ] },
    { id: 'area-for-perim', title: 'חישבו שטח במקום היקף',
      cause: 'שתי הנוסחאות של המלבן משתמשות באותם שני מספרים, וכשהשאלה על גדר מחשבים בטעות את מה שבפנים.',
      explain: ['היקף הוא הגבול: גדר, מסגרת, שביל מסביב.', 'בהיקף מחברים את ארבע הצלעות, ולא כופלים.'],
      remedy: [
        { kind: 'predict', text: 'גדר סביב גינה $9$ על $5$ מ׳:', fig: rect(9, 5, [9, 5]), choices: ['$28$ מ׳', '$45$'], answer: 0,
          why: 'הגדר הולכת מסביב: $9 + 5 + 9 + 5 = 28$.', wrongWhy: { 1: '$45 = 9 \\cdot 5$ הוא הדשא בפנים, לא הגדר.' } },
        { kind: 'explore', text: 'בנו את הגינה, $9$ על $5$ משבצות, וספרו את הצעדים מסביב.', manip: rectBuild({ w: 2, h: 2 }), answer: { mode: 'rect', area: 45, perim: 28 },
          hint: 'גררו את הפינה עד $9$ משבצות לרוחב ו־$5$ לגובה.', success: 'מסביב $28$ צעדים: $9 + 5 + 9 + 5$.' },
      ] },
    { id: 'two-sides', title: 'בהיקף נספרו רק שתי צלעות (חצי היקף)',
      cause: 'סופרים את הצלעות שרואים בשרטוט, אחת מכל סוג.',
      explain: ['למלבן ארבע צלעות: שני אורכים ושני רוחבים.', 'הצלעות שמול הכתובות שוות להן, ונספרות גם הן.'],
      remedy: [
        { kind: 'predict', text: 'היקף מלבן $7$ על $2$:', fig: rect(7, 2, [7, 2]), choices: ['$18$', '$9$'], answer: 0,
          why: '$7 + 2 + 7 + 2 = 18$: כל צלע פעם אחת, ויש ארבע.', wrongWhy: { 1: '$9 = 7 + 2$ הוא רק חצי הדרך מסביב.' } },
      ] },
    { id: 'one-side-perim', title: 'הורידו מההיקף רק אורך אחד, ולא שניים',
      cause: 'בהיקף יש שני אורכים, ונדמה שמספיק להוריד אחד.',
      explain: ['ההיקף הוא שני אורכים ושני רוחבים.', 'חצי היקף הוא אורך אחד ועוד רוחב אחד: ממנו מורידים את האורך.'],
      remedy: [
        { kind: 'predict', text: 'היקף $24$, אורך $8$. רוחב?', fig: rect(8, 4, [8, '?'], [word([4, 2], 'היקף 24')]), choices: ['$4$', '$16$', '$3$'], answer: 0,
          why: 'חצי היקף $12$, ו־$12 - 8 = 4$.', wrongWhy: { 1: '$24 - 8$ הוריד אורך אחד, אבל נשארו עוד אורך ושני רוחבים.', 2: '$24 : 8$: כך מוצאים צלע משטח, לא מהיקף.' } },
      ] },
    { id: 'perim-as-area', title: 'חילקו את ההיקף באורך, כאילו הוא שטח',
      cause: 'משטח מוצאים צלע בחלוקה, ונדמה שגם מהיקף.',
      explain: ['בהיקף מחברים צלעות, לא כופלים.', 'לכן צלע חסרה מוצאים מההיקף בחיסור: חצי היקף, פחות האורך.'],
      remedy: [
        { kind: 'predict', text: 'היקף מלבן $30$, ואורכו $10$. מה רוחבו?', fig: rect(10, 5, [10, '?'], [word([5, 2.5], 'היקף 30')]), choices: ['$5$', '$3$'], answer: 0,
          why: 'חצי היקף $15$ הוא אורך ועוד רוחב: $15 - 10 = 5$.', wrongWhy: { 1: '$30 : 10 = 3$: כך מוצאים צלע משטח. ההיקף הוא סכום הצלעות.' } },
      ] },
  ],
  words: ['היקף', 'שטח', 'סמ״ר', 'ס״מ', 'אורך', 'רוחב', 'ריבוע'],
};

// ================================================================ stair 2: the triangle (CLASSROOM-13's right triangle inside)

/** The class's right triangle of example 2: ∢B = 90°, AB = 6, BC = x, the area 33. */
const class33 = G.rightTriFig('B', 6, 11, { AB: 6, BC: 'x' });
/** together 2: ∢C = 90°, BC = 6, AC = 2x, the area 48 (AC is 16). */
const class48 = G.rightTriFig('C', 16, 6, { AC: '2x', BC: 6 });

const stair2: StairContent = {
  skill: 'area:2', topic: 'area', level: 2, title: 'שטח משולש',
  objectives: [
    'לחשב שטח משולש: צלע כפול הגובה אליה, חלקי $2$.',
    'לזהות את הגובה לצלע: ניצב לישר של הצלע, מהקודקוד שמולה, גם כשהוא נופל מחוץ למשולש.',
    'במשולש ישר־זווית: הניצבים הם צלע וגובה; למצוא ניצב חסר מהשטח.',
  ],
  idea: 'כל משולש הוא חצי ממלבן או ממקבילית שיש להם אותו בסיס ואותו גובה. לכן שטחו: צלע כפול הגובה אליה, חלקי $2$.',
  why: [
    'האלכסון חותך מלבן לשני משולשים זהים, ולכן משולש ישר־זווית הוא חצי ממנו.',
    'גובה הוא המרחק מהקודקוד לישר שעליו הצלע. מרחק מודדים בניצב, ולכן הצלע המשופעת אינה הגובה.',
  ],
  alt: ['שני משולשים זהים, אחד הפוך, מרכיבים מקבילית: בסיס $a$, גובה $h$. המשולש הוא חצי ממנה.'],
  discover: [
    { kind: 'say', text: 'משולש ישר־זווית הוא חצי מלבן: האלכסון חותך את המלבן לשני משולשים זהים.',
      fig: geo('מלבן שהאלכסון חותך לשני משולשים', { _a: [0, 0], _b: [6, 0], _c: [6, 4], _d: [0, 4] }, {
        polys: [{ pts: ['_a', '_b', '_c', '_d'] }, { pts: ['_a', '_b', '_c'], tone: 'add' }],
        segs: [lab('_a', '_b', 6), lab('_b', '_c', 4), seg('_a', '_c')],
      }) },
    { kind: 'predict', text: 'מה שטח המשולש?', fig: triInRect(8, 6, [8, 6]),
      choices: ['$24$', '$48$', '$14$'], answer: 0,
      why: 'המלבן $6 \\cdot 8 = 48$, והמשולש חצי ממנו: $24$.',
      wrongWhy: { 1: '$48$ הוא כל המלבן.', 2: '$6 + 8$ מחבר צלעות. שטח סופר משבצות.' } },
    { kind: 'explore', text: 'גררו את הקודקוד העליון לאורך הקו המקווקו, עד שהמשולש יהיה ישר־זווית.', manip: apex, answer: { mode: 'apex', xs: [0, 8] },
      hint: 'הזווית הישרה תהיה כשהקודקוד ממש מעל קצה הבסיס.',
      success: 'השטח לא השתנה: $\\frac{8 \\cdot 4}{2} = 16$. רק הבסיס והגובה קובעים אותו.' },
    { kind: 'rule', text: 'שטח משולש: צלע כפול הגובה אליה, חלקי $2$.', display: 'S = \\frac{a \\cdot h_a}{2}',
      why: 'בכל משולש השטח הוא בסיס כפול גובה חלקי $2$. במשולש ישר־זווית הניצב השני הוא הגובה: מקרה פרטי.', fig: triRule },
    { kind: 'predict', text: 'במשולש $ABC$: $BC = 6$, הגובה לצלע $BC$ הוא $4$, והוא נופל מחוץ למשולש. $AB = 5$. מה שטח המשולש?', fig: obtuse(6, 4, 3, 5),
      choices: ['$12$', '$15$', '$24$'], answer: 0,
      why: 'הגובה לצלע $BC$ הוא $4$, גם כשהוא נופל מחוץ למשולש: $\\frac{6 \\cdot 4}{2} = 12$.',
      wrongWhy: { 1: '$15 = \\frac{6 \\cdot 5}{2}$: $5$ היא צלע משופעת. הגובה ניצב לבסיס.', 2: '$24$: שכחתם לחלק ב־$2$.' } },
    { kind: 'predict', text: 'מהקודקוד $A$ יוצאים שלושה קטעים מקווקווים. איזה מהם הוא הגובה לצלע $BC$?', fig: obtuse(6, 4, 3, 5, true),
      choices: ['הקטע שמחוץ למשולש, הניצב להמשך של $BC$', 'הקטע מ־$A$ לאמצע $BC$', 'הצלע $AB$'], answer: 0,
      why: 'גובה יוצא מהקודקוד שמול הצלע, וניצב לישר שעליו הצלע. במשולש קהה־זווית הוא יכול ליפול בחוץ.',
      wrongWhy: { 1: 'הקטע לאמצע $BC$ חוצה את הצלע, אבל הוא לא ניצב לה.', 2: '$AB$ היא צלע משופעת: היא לא ניצבת ל־$BC$.' } },
    { kind: 'rule', text: 'ניצב חסר מהשטח: מציבים בנוסחה ופותרים.', display: '\\begin{aligned} \\frac{8x}{2} &= 52 \\;/{\\cdot}2 \\\\ 8x &= 104 \\;/{:}8 \\\\ x &= 13 \\end{aligned}',
      why: 'כופלים ב־$2$ כדי לבטל את החלוקה, ואז מחלקים בניצב הידוע.', fig: legs(8, 13, [8, 'x'], [word([5, 7], 'שטח 52')]) },
    { kind: 'predict', text: 'במשולש ישר־זווית ניצב אחד $12$, והשטח $90$. מה הניצב השני?', fig: legs(12, 15, [12, '?'], [word([8, 9], 'שטח 90')]),
      choices: ['$15$', '$7.5$', '$3.75$'], answer: 0,
      why: '$\\frac{12x}{2} = 90$, $12x = 180$, $x = 15$.',
      wrongWhy: { 1: '$7.5 = 90 : 12$: שכחתם את ה־$2$ שבנוסחה.', 2: '$3.75$: חילקתם ב־$2$ גם באגף השני. כדי לבטל חלוקה ב־$2$ כופלים.' } },
  ],
  examples: [
    { problem: 'במשולש $ABC$ הצלע $BC = 10$ ס״מ, והגובה אליה $AH = 7$ ס״מ. מה שטח המשולש?', answer: 35, check: '10*7/2',
      steps: [
        { action: 'צלע כפול הגובה אליה.', why: 'הגובה $AH$ ניצב ל־$BC$.', result: '10 \\cdot 7 = 70', calc: { expr: '10*7', value: 70 } },
        { action: 'חלקי $2$: השטח בסמ״ר.', why: 'המשולש הוא חצי מהמלבן $10$ על $7$.', result: '70 : 2 = 35', value: '70/2' },
      ] },
    { problem: 'במשולש $ABC$: $\\sphericalangle B = 90^\\circ$, $AB = 6$, $BC = x$, ושטח המשולש $33$. מה $x$?', answer: 11, check: '2*33/6', fig: class33,
      steps: [
        { action: 'נתון: $S_{\\triangle ABC} = 33$', why: 'כך כותבים בכיתה את מה שידוע.', result: 'S_{\\triangle ABC} = 33' },
        { action: 'הנוסחה, עם הניצבים שליד הזווית הישרה.', why: 'ניצב מעל כל ניצב: הניצב השני הוא הגובה.', result: 'S_{\\triangle ABC} = \\frac{AB \\cdot BC}{2}' },
        { action: 'מציבים וכופלים ב־$2$.', why: 'כדי לבטל את החלוקה ב־$2$.', result: '\\frac{6x}{2} = 33 \\;/{\\cdot}2', calc: { expr: '33*2', value: 66 } },
        { action: 'מחלקים ב־$6$.', why: 'כדי שיישאר $x$ לבד.', result: '6x = 66 \\;/{:}6', value: '66/6' },
        { action: 'הניצב החסר.', why: 'בדיקה: $\\frac{6 \\cdot 11}{2} = 33$.', result: 'x = 11', value: '11' },
      ] },
    { problem: 'במשולש קהה־זווית $ABC$: $BC = 9$, הגובה מ־$A$ להמשך של $BC$ הוא $4$, ו־$AB = 5$. מה השטח?', answer: 18, check: '9*4/2', fig: obtuse(9, 4, 3, 5),
      steps: [
        { action: 'הגובה לצלע $BC$ הוא $4$, לא $5$.', why: 'הגובה ניצב לישר של $BC$, גם מחוץ למשולש. $AB$ משופעת.', result: '9 \\cdot 4 = 36', calc: { expr: '9*4', value: 36 } },
        { action: 'חלקי $2$.', why: 'המשולש הוא חצי ממקבילית עם אותו בסיס ואותו גובה.', result: '36 : 2 = 18', value: '36/2' },
      ] },
  ],
  together: [
    { problem: 'במשולש ישר־זווית הניצבים $9$ ו־$12$, והיתר $15$. מה השטח?', fig: G.legsFig(9, 12, 15),
      steps: [
        { prompt: 'אילו שתי צלעות כופלים?', choices: [
          { text: 'שני הניצבים, $9$ ו־$12$', ok: true, feedback: 'נכון: ניצב אחד הוא הגובה לשני.' },
          { text: 'ניצב ויתר, $12$ ו־$15$', ok: false, feedback: 'היתר אינו ניצב לאף ניצב. הגובה לניצב אחד הוא הניצב השני.' },
          { text: 'את שלוש הצלעות', ok: false, feedback: 'שטח משולש הוא צלע כפול גובה, שני מספרים.' },
        ], hints: ['איזו צלע ניצבת לאיזו?', 'שתי הצלעות שליד הזווית הישרה.'], done: 'כופלים את הניצבים: $9 \\cdot 12 = 108$.' },
        { prompt: 'ואחר כך?', choices: [
          { text: 'חלקי $2$', ok: true, feedback: 'נכון: המשולש הוא חצי מהמלבן.' },
          { text: 'זהו, $108$', ok: false, feedback: '$108$ הוא המלבן שסביב המשולש.' },
        ], hints: ['המשולש הוא חצי ממה?', 'חצי מהמלבן $9$ על $12$.'], done: 'מחלקים ב־$2$.' },
      ],
      final: { prompt: 'השטח:', answer: 54, check: '9*12/2', hints: ['$108 : 2$.', 'חצי מ־$108$.'] } },
    { problem: 'במשולש $ABC$: $\\sphericalangle C = 90^\\circ$, $BC = 6$, $AC = 2x$, ושטח המשולש $48$. מה אורך $AC$?', fig: class48,
      steps: [
        { prompt: 'השטח בנוסחה:', choices: [
          { text: '$\\frac{6 \\cdot 2x}{2} = 48$', ok: true, feedback: 'נכון: הניצבים $BC$ ו־$AC$, חלקי $2$.' },
          { text: '$6 \\cdot 2x = 48$', ok: false, feedback: 'שכחתם את החלוקה ב־$2$.' },
        ], hints: ['אילו צלעות יוצאות מ־$C$?', '$S_{\\triangle ABC} = \\frac{BC \\cdot AC}{2}$.'], done: '$\\frac{6 \\cdot 2x}{2} = 48$, כלומר $6x = 48$.' },
        { prompt: '$6x = 48$, ולכן $x =$', choices: [
          { text: '$8$', ok: true, feedback: 'נכון: $48 : 6 = 8$.' },
          { text: '$42$', ok: false, feedback: '$48 - 6$: כאן כופלים, ולכן מחלקים.' },
        ], hints: ['$6$ כפול כמה הם $48$?', '$48 : 6$.'], done: '$x = 8$.' },
      ],
      final: { prompt: 'אורך $AC$:', answer: 16, check: '2*8', hints: ['$AC = 2x$.', '$2 \\cdot 8$.'] } },
  ],
  diag: area2,
  transfer: area2T,
  misconceptions: [
    { id: 'no-half', title: 'שכחו לחלק ב־2 בשטח המשולש', prereq: 'area:1',
      cause: 'זוכרים "אורך כפול רוחב" מהמלבן, ושוכחים שהמשולש הוא רק חצי ממנו.',
      explain: ['צלע כפול גובה נותן את כל המלבן שסביב המשולש.', 'המשולש הוא חצי: מחלקים ב־$2$.'],
      remedy: [
        { kind: 'predict', text: 'ניצבים $5$ ו־$8$:', fig: triInRect(8, 5, [8, 5]), choices: ['$20$', '$40$'], answer: 0,
          why: 'המלבן $5 \\cdot 8 = 40$, והמשולש חצי ממנו: $20$.', wrongWhy: { 1: '$40$ הוא המלבן כולו, שני משולשים.' } },
        { kind: 'explore', text: 'גררו את הקודקוד העליון עד שהמשולש יהיה ישר־זווית, ושימו לב לשטח.', manip: apex, answer: { mode: 'apex', xs: [0, 8] },
          hint: 'הזווית הישרה תהיה כשהקודקוד ממש מעל קצה הבסיס.', success: 'המשולש הוא חצי מהמלבן $8$ על $4$: $16$ משבצות.' },
      ] },
    { id: 'slant-as-height', title: 'כפלו בצלע משופעת במקום בגובה',
      cause: 'הצלע המשופעת נראית "גבוהה", ונדמה שהיא הגובה.',
      explain: ['הגובה הוא המרחק לבסיס, והמרחק נמדד בניצב.', 'צלע משופעת ארוכה תמיד מהגובה (היא יתר במשולש ישר־זווית).'],
      remedy: [
        { kind: 'predict', text: 'במשולש $ABC$: $BC = 4$, הגובה לצלע $BC$ הוא $3$ ונופל בחוץ, ו־$AB = 5$. מה השטח?', fig: obtuse(4, 3, 4, 5), choices: ['$6$', '$10$'], answer: 0,
          why: '$\\frac{4 \\cdot 3}{2} = 6$: הגובה הוא $3$.', wrongWhy: { 1: '$10 = \\frac{4 \\cdot 5}{2}$: $5$ היא הצלע המשופעת, לא הגובה.' } },
        { kind: 'predict', text: 'מהקודקוד $A$ יוצאים שלושה קטעים מקווקווים. איזה מהם הוא הגובה לצלע $BC$?', fig: obtuse(6, 4, 3, 5, true),
          choices: ['הקטע הניצב להמשך של $BC$', 'הצלע $AB$', 'הקטע לאמצע $BC$'], answer: 0,
          why: 'גובה ניצב לישר שעליו הצלע. כאן הוא נופל מחוץ למשולש.' },
      ] },
    { id: 'half-twice', title: 'חילקו ב־$2$ גם באגף השני, במקום לכפול ב־$2$',
      cause: '"חלקי $2$" נשאר בראש, ומחלקים שוב במקום לבטל.',
      explain: ['כדי לבטל חלוקה ב־$2$ כופלים ב־$2$ את שני האגפים.'],
      remedy: [
        { kind: 'predict', text: '$\\frac{10x}{2} = 40$. מה $x$?', fig: legs(10, 8, [10, 'x'], [word([6, 5], 'שטח 40')]), choices: ['$8$', '$2$'], answer: 0,
          why: 'כופלים ב־$2$: $10x = 80$, ולכן $x = 8$.', wrongWhy: { 1: '$2$: חילקתם ב־$2$ גם באגף השני. את החלוקה מבטלים בכפל.' } },
      ] },
    { id: 'hyp-as-height', title: 'כפלו ביתר במקום בניצב',
      cause: 'היתר הוא הצלע הארוכה והבולטת בשרטוט.',
      explain: ['הגובה לניצב הוא הניצב השני, שיוצא מהזווית הישרה.'],
      remedy: [
        { kind: 'predict', text: 'ניצבים $5$ ו־$12$, יתר $13$:', fig: G.legsFig(5, 12, 13), choices: ['$30$', '$78$', '$32.5$'], answer: 0,
          why: '$\\frac{5 \\cdot 12}{2} = 30$: כופלים את שני הניצבים.', wrongWhy: { 1: '$78 = \\frac{12 \\cdot 13}{2}$: היתר אינו גובה לאף ניצב.', 2: '$32.5 = \\frac{5 \\cdot 13}{2}$: היתר אינו גובה לאף ניצב.' } },
      ] },
  ],
  words: ['גובה לצלע', 'גובה פנימי', 'גובה חיצוני', 'ניצב', 'יתר', 'מקרה פרטי'],
};

// ================================================================ stair 3: composite shapes

/** A 9 by 6 garden with a right triangle (legs 9 and 4) against its 9 side. */
const gardenTri: FigSpec = geo('מלבן ומשולש ישר־זווית צמוד לו', { _1: [0, 0], _2: [9, 0], _3: [9, 6], _4: [0, 6], _5: [0, 10] }, {
  polys: [{ pts: ['_1', '_2', '_3', '_4'] }, { pts: ['_4', '_3', '_5'], tone: 'add' }],
  segs: [lab('_1', '_2', 9), lab('_2', '_3', 6), lab('_4', '_5', 4)], angles: [rightAt('_4', '_3', '_5')],
});
/** The triangle at (0, 0), (6, 2), (2, 5) on the grid, in its dashed 6 by 5 box. */
const gridTri: FigSpec = {
  ...G.gridTriFig([[0, 0], [6, 2], [2, 5]], [0, 0, 6, 5]),
  pts: { _a: [0, 0], _b: [6, 2], _c: [2, 5], _d: [6, 0], _e: [6, 5], _f: [0, 5] },
  segs: [seg('_a', '_d', { dash: true }), seg('_d', '_e', { dash: true }), seg('_e', '_f', { dash: true }), seg('_f', '_a', { dash: true })],
} as FigSpec;

const stair3: StairContent = {
  skill: 'area:3', topic: 'area', level: 3, title: 'צורות מורכבות',
  objectives: [
    'לחשב שטח של צורה מורכבת: לפרק לחלקים ולחבר, או להשלים למלבן ולחסר.',
    'לחשב שטח של מרובע שאלכסוניו מאונכים: חצי מכפלת האלכסונים.',
    'לחשב שטח של צורה על הרשת בעזרת המלבן שסביבה.',
    'לחשב כמה אריחים מרצפים רצפה, אחרי שמעבירים את המידות לאותה יחידה.',
  ],
  idea: 'צורה מורכבת מפרקים לחלקים פשוטים, או משלימים לצורה גדולה ומורידים את מה שנוסף. כל משבצת נספרת פעם אחת.',
  why: [
    'פירוק והשלמה סופרים את אותן משבצות, ולכן נותנים אותו שטח.',
    'במרובע שאלכסוניו מאונכים, האלכסונים יוצרים ארבעה משולשים ישרי־זווית, וכל אחד הוא חצי מחלק של המלבן שסביב.',
  ],
  alt: ['ריצוף: סופרים כמה אריחים בכל חלק של החדר, ומחברים.'],
  discover: [
    { kind: 'say', text: 'צורה מורכבת: אפשר לפרק אותה לחלקים פשוטים, או להשלים אותה למלבן ולהוריד את מה שנוסף.', fig: L862 },
    { kind: 'explore', text: 'גררו קו חיתוך כך שהצורה תתחלק לשני מלבנים.', manip: cutL,
      answer: { mode: 'cut', lines: [{ axis: 'y', at: 4 }, { axis: 'x', at: 5 }] },
      hint: 'נסו קו שממשיך את אחת הצלעות של הפינה החסרה.',
      success: 'שני מלבנים: למשל $8 \\cdot 4 = 32$ ועוד $5 \\cdot 2 = 10$, יחד $42$.' },
    { kind: 'rule', text: 'פירוק: מחברים את שטחי החלקים. השלמה: מחשבים את המלבן שמסביב ומורידים את מה שאינו בצורה.', display: '8 \\cdot 6 - 3 \\cdot 2 = 48 - 6 = 42',
      why: 'שתי הדרכים סופרות את אותן משבצות.', fig: G.lFig(8, 6, 3, 2, { cut: true }) },
    { kind: 'predict', text: 'מישהו חישב $8 \\cdot 4 + 5 \\cdot 6$. זה השטח?', fig: lOverlap,
      choices: ['לא: החלק $5 \\cdot 4$ נספר פעמיים', 'כן'], answer: 0,
      why: '$8 \\cdot 4 + 5 \\cdot 6 = 62$, אבל השטח $42$: החלק המשותף $5 \\cdot 4 = 20$ נספר פעמיים.',
      wrongWhy: { 1: 'שני המלבנים חופפים: החלק $5$ על $4$ נמצא בשניהם, ולכן נספר פעמיים.' } },
    { kind: 'predict', text: 'ממלבן $10$ על $6$ חתכו בפינה משולש ישר־זווית שניצביו $4$ ו־$3$. מה שטח הצורה?', fig: G.plotFig(10, 6, 4, 3),
      choices: ['$54$', '$48$', '$60$'], answer: 0,
      why: '$10 \\cdot 6 = 60$, המשולש $\\frac{4 \\cdot 3}{2} = 6$, ו־$60 - 6 = 54$.',
      wrongWhy: { 1: '$48 = 60 - 12$: הורדתם מלבן $4 \\cdot 3$ במקום משולש, שהוא חצי ממנו.', 2: '$60$ הוא המלבן כולו.' } },
    { kind: 'predict', text: 'האלכסונים של הדלתון מאונכים זה לזה, ואורכם $10$ ו־$6$. מה שטח הדלתון?', fig: kiteInRect(),
      choices: ['$30$', '$60$', '$16$'], answer: 0,
      why: 'המלבן שסביבו $10 \\cdot 6 = 60$, והדלתון בדיוק חצי ממנו.',
      wrongWhy: { 1: '$60$ הוא המלבן שסביב הדלתון.', 2: '$16 = 10 + 6$: שטח מוצאים בכפל.' } },
    { kind: 'rule', text: 'מרובע שאלכסוניו מאונכים: השטח הוא חצי מכפלת האלכסונים.', display: 'S = \\frac{d_1 \\cdot d_2}{2}',
      why: 'ארבעת המשולשים שבתוך המרובע הם חצי מארבעת המלבנים שבתוך המלבן הגדול.', fig: kiteInRect() },
    { kind: 'predict', text: 'כל משבצת היא $1$ סמ״ר. קודקודי המשולש ב־$(0, 0)$, ב־$(6, 2)$ וב־$(2, 5)$. מה שטח המשולש?', fig: gridTri,
      choices: ['$13$', '$30$', '$15$'], answer: 0,
      why: 'המלבן שסביבו $6 \\cdot 5 = 30$, ומורידים שלושה משולשים ישרי־זווית: $6 + 6 + 5 = 17$. $30 - 17 = 13$.',
      wrongWhy: { 1: '$30$ הוא המלבן שמסביב.', 2: '$15 = \\frac{6 \\cdot 5}{2}$: אף צלע אינה אופקית, ולכן אין כאן בסיס $6$ עם גובה $5$.' } },
  ],
  examples: [
    { problem: 'צורה: מלבן $10$ על $7$ ס״מ שחסר בפינתו מלבן $4$ על $3$ ס״מ. מה השטח?', answer: 58, check: '10*7-4*3', fig: G.lFig(10, 7, 4, 3, { cut: true }),
      steps: [
        { action: 'המלבן השלם.', why: 'משלימים את הפינה החסרה למלבן.', result: '10 \\cdot 7 = 70', calc: { expr: '10*7', value: 70 } },
        { action: 'החלק החסר.', why: 'אותו מורידים, כי הוא לא בצורה.', result: '4 \\cdot 3 = 12', calc: { expr: '4*3', value: 12 } },
        { action: 'מחסרים: השטח בסמ״ר.', why: 'השלם פחות מה שחסר.', result: '70 - 12 = 58', value: '70-12' },
      ] },
    { problem: 'גינה: מלבן $9$ על $6$ מ׳, וצמוד לצלע של $9$ מ׳ משולש ישר־זווית שניצביו $9$ מ׳ ו־$4$ מ׳. מה שטח הגינה?', answer: 72, check: '9*6+9*4/2', fig: gardenTri,
      steps: [
        { action: 'המלבן.', why: 'פירוק: כל חלק לחוד.', result: '9 \\cdot 6 = 54', calc: { expr: '9*6', value: 54 } },
        { action: 'המשולש: ניצב כפול ניצב, חלקי $2$.', why: 'במשולש ישר־זווית הניצבים הם צלע וגובה.', result: '\\frac{9 \\cdot 4}{2} = 18', calc: { expr: '9*4/2', value: 18 } },
        { action: 'מחברים: השטח במ״ר.', why: 'החלקים לא חופפים, וביחד הם כל הגינה.', result: '54 + 18 = 72', value: '54+18' },
      ] },
    { problem: 'רצפה $4$ מ׳ על $3$ מ׳ מרצפים באריחים ריבועיים שצלעם $50$ ס״מ. כמה אריחים צריך?', answer: 48, check: '(400/50)*(300/50)',
      steps: [
        { action: 'לאורך: $4$ מ׳ הם $400$ ס״מ.', why: 'מעבירים לאותה יחידה כמו האריח.', result: '400 : 50 = 8', calc: { expr: '400/50', value: 8 } },
        { action: 'לרוחב: $3$ מ׳ הם $300$ ס״מ.', why: 'גם הרוחב בס״מ.', result: '300 : 50 = 6', calc: { expr: '300/50', value: 6 } },
        { action: 'שורות כפול אריחים בשורה.', why: '$6$ שורות, ובכל שורה $8$ אריחים.', result: '8 \\cdot 6 = 48', value: '8*6' },
      ] },
  ],
  together: [
    { problem: 'רצפה בצורת $L$: מלבן $12$ על $8$ מ׳ שחסר בו מלבן $5$ על $3$ מ׳. כמה מ״ר?', fig: G.lFig(12, 8, 5, 3),
      steps: [
        { prompt: 'איך?', choices: [
          { text: 'משלימים: $12 \\cdot 8$ פחות $5 \\cdot 3$', ok: true, feedback: 'נכון: המלבן השלם, פחות הפינה.' },
          { text: '$12 \\cdot 8$', ok: false, feedback: 'יש פינה חסרה, ואותה צריך להוריד.' },
          { text: '$12 \\cdot 8 + 5 \\cdot 3$', ok: false, feedback: 'החלק החסר לא בצורה: מורידים, לא מוסיפים.' },
        ], hints: ['מה חסר במלבן?', 'השלם פחות הפינה.'], done: '$12 \\cdot 8 - 5 \\cdot 3$.' },
      ],
      final: { prompt: 'השטח במ״ר:', answer: 81, check: '12*8-5*3', hints: ['$96 - 15$.', '$12 \\cdot 8 = 96$, ו־$5 \\cdot 3 = 15$.'] } },
    { problem: 'ממלבן $8$ על $5$ ס״מ חתכו בפינה משולש ישר־זווית שניצביו $4$ ו־$2$ ס״מ. מה השטח שנשאר?', fig: G.plotFig(8, 5, 4, 2),
      steps: [
        { prompt: 'שטח המשולש:', choices: [
          { text: '$4$', ok: true, feedback: 'נכון: $\\frac{4 \\cdot 2}{2} = 4$.' },
          { text: '$8$', ok: false, feedback: '$4 \\cdot 2 = 8$ הוא מלבן. המשולש חצי ממנו.' },
        ], hints: ['המשולש הוא חצי ממלבן $4$ על $2$.', '$\\frac{4 \\cdot 2}{2}$.'], done: 'המשולש $4$ סמ״ר.' },
      ],
      final: { prompt: 'השטח שנשאר, בסמ״ר:', answer: 36, check: '8*5-4*2/2', hints: ['המלבן פחות המשולש.', '$40 - 4$.'] } },
  ],
  diag: area3,
  transfer: area3T,
  misconceptions: [
    { id: 'no-subtract', title: 'חישבו את הצורה השלמה ולא הורידו את החלק החסר',
      cause: 'מחשבים את המלבן הגדול, כי הוא נוח, ושוכחים שחסר בו חלק.',
      explain: ['המלבן השלם כולל גם את הפינה החסרה.', 'הפינה לא בצורה, ולכן מורידים אותה.'],
      remedy: [
        { kind: 'predict', text: 'מלבן $7$ על $5$ חסר פינה $2$ על $2$:', fig: G.lFig(7, 5, 2, 2, { cut: true }), choices: ['$31$', '$35$'], answer: 0,
          why: '$7 \\cdot 5 = 35$, פחות הפינה $2 \\cdot 2 = 4$: $31$.', wrongWhy: { 1: '$35$ הוא המלבן כולו, עם הפינה שאין בצורה.' } },
      ] },
    { id: 'double-count', title: 'ספרו פעמיים חלק ששייך לשני החלקים',
      cause: 'כל אחד משני החלקים נראה מלבן שלם, ושוכחים שהם חולקים משבצות.',
      explain: ['בפירוק, החלקים לא חופפים: כל משבצת בחלק אחד בלבד.', 'קו חיתוך אחד מפריד ביניהם.'],
      remedy: [
        { kind: 'predict', text: 'מישהו חישב $8 \\cdot 4 + 5 \\cdot 6$. זה השטח?', fig: lOverlap, choices: ['לא: החלק $5 \\cdot 4$ נספר פעמיים', 'כן'], answer: 0,
          why: 'שני המלבנים חופפים בחלק $5$ על $4$. השטח $62 - 20 = 42$.' },
        { kind: 'explore', text: 'חתכו את הצורה לשני מלבנים שלא חופפים.', manip: { ...cutL, start: { axis: 'x', at: 2 } },
          answer: { mode: 'cut', lines: [{ axis: 'y', at: 4 }, { axis: 'x', at: 5 }] },
          hint: 'קו אחד, בהמשך של צלע הפינה החסרה.', success: 'כל משבצת בחלק אחד בלבד, ולכן $42$.' },
      ] },
    { id: 'no-half', title: 'שכחו לחלק ב־2 בשטח המשולש שהורידו',
      cause: 'מורידים את המלבן שהניצבים בונים, ושוכחים שהמשולש הוא רק חצי ממנו.',
      explain: ['המשולש שנחתך הוא חצי ממלבן שצלעותיו הניצבים.', 'לכן מורידים רק חצי מהמכפלה.'],
      remedy: [
        { kind: 'predict', text: 'מלבן $8$ על $6$ בלי משולש שניצביו $6$ ו־$4$:', fig: G.plotFig(8, 6, 6, 4), choices: ['$36$', '$24$'], answer: 0,
          why: '$48 - \\frac{6 \\cdot 4}{2} = 48 - 12 = 36$.', wrongWhy: { 1: '$24 = 48 - 24$: הורדתם את כל המלבן $6$ על $4$, ולא את המשולש שהוא חצי ממנו.' } },
      ] },
  ],
  words: ['צורה מורכבת', 'פירוק', 'השלמה', 'דלתון', 'מעוין', 'אלכסונים מאונכים'],
};

// ================================================================ stair 4: the parallelogram and the trapezoid

const stair4: StairContent = {
  skill: 'area:4', topic: 'area', level: 4, title: 'מקבילית וטרפז',
  objectives: [
    'לחשב שטח מקבילית: צלע כפול הגובה אליה.',
    'לחשב שטח טרפז: סכום הבסיסים, כפול הגובה, חלקי $2$.',
    'להבין את שתי הנוסחאות מגזירה והזזה: מקבילית שהופכת למלבן, ושני טרפזים שיוצרים מקבילית.',
  ],
  idea: 'מקבילית הופכת למלבן כשחותכים משולש מצד אחד ומזיזים אותו לצד השני. שני טרפזים זהים, אחד הפוך, הם מקבילית שבסיסה סכום הבסיסים.',
  why: [
    'גזירה והזזה לא משנות שטח, והמלבן שמתקבל הוא הצלע על הגובה.',
    'לכן הטרפז הוא חצי מקבילית: $\\frac{(a + b) \\cdot h}{2}$.',
  ],
  alt: ['טרפז הוא גם מלבן ועוד משולשים: מחשבים כל חלק ומחברים.'],
  discover: [
    { kind: 'say', text: 'חותכים משולש מצד אחד של המקבילית, מזיזים אותו לצד השני, ומקבלים מלבן.', fig: paraMove(false) },
    { kind: 'explore', text: 'גררו את המשולש הצבוע לצד השני של המקבילית.', manip: movePara, answer: { mode: 'move', dx: 6, dy: 0 },
      hint: 'החור נסגר כשהמשולש זז בדיוק אורך של צלע.',
      success: 'מלבן $6 \\cdot 4 = 24$: אותו שטח כמו המקבילית.' },
    { kind: 'rule', text: 'שטח מקבילית: צלע כפול הגובה אליה.', display: 'S = a \\cdot h_a',
      why: 'הגזירה וההזזה לא משנות שטח, והמלבן שמתקבל הוא $a$ על $h_a$.', fig: paraMove(true) },
    { kind: 'predict', text: 'במקבילית $ABCD$: $AB = 10$, הגובה לצלע $AB$ הוא $4$, ו־$AD = 5$. מה השטח?', fig: G.paraFig({ a: 10, h: 4, s: 5 }),
      choices: ['$40$', '$50$', '$20$'], answer: 0,
      why: '$10 \\cdot 4 = 40$.',
      wrongWhy: { 1: '$50 = 10 \\cdot 5$: $5$ היא הצלע המשופעת. הגובה ניצב לבסיס.', 2: '$20$: במקבילית לא מחלקים ב־$2$. רק המשולש הוא חצי.' } },
    { kind: 'say', text: 'שני טרפזים זהים, אחד הפוך, יוצרים מקבילית: הבסיס שלה $a + b$, והגובה $h$.', fig: twoTraps },
    { kind: 'predict', text: 'טרפז שבסיסיו $7$ ו־$5$, וגובהו $4$. מה השטח?', fig: trap754,
      choices: ['$24$', '$48$', '$28$'], answer: 0,
      why: '$\\frac{(7 + 5) \\cdot 4}{2} = 24$: חצי מהמקבילית שבנינו.',
      wrongWhy: { 1: '$48$ היא המקבילית של שני הטרפזים.', 2: '$28 = 7 \\cdot 4$: לקחתם רק את הבסיס הגדול.' } },
    { kind: 'rule', text: 'שטח טרפז: סכום הבסיסים, כפול הגובה, חלקי $2$.', display: 'S = \\frac{(a + b) \\cdot h}{2}',
      why: 'הטרפז הוא חצי ממקבילית שבסיסה $a + b$ וגובהה $h$.', fig: twoTraps },
    { kind: 'predict', text: 'טרפז ישר־זווית: בסיסים $8$ ו־$5$, גובה $4$. אפשר לחשב את השטח גם כמלבן ועוד משולש?', fig: trapCut,
      choices: ['כן: $20 + 6 = 26$', 'לא, רק בנוסחה'], answer: 0,
      why: '$5 \\cdot 4 + \\frac{3 \\cdot 4}{2} = 20 + 6 = 26$, וגם $\\frac{(8 + 5) \\cdot 4}{2} = 26$.',
      wrongWhy: { 1: 'קו אנכי חותך את הטרפז למלבן $5$ על $4$ ולמשולש שניצביו $3$ ו־$4$. שתי הדרכים נותנות $26$.' } },
  ],
  examples: [
    { problem: 'במקבילית $ABCD$: $AB = 9$ ס״מ, הגובה ל־$AB$ הוא $8$ ס״מ, ו־$AD = 10$ ס״מ. מה שטחה?', answer: 72, check: '9*8', fig: G.paraFig({ a: 9, h: 8, s: 10 }),
      steps: [
        { action: 'הגובה ל־$AB$ הוא $8$, לא $AD$.', why: '$AD$ משופעת. הגובה ניצב לצלע.', result: 'h = 8' },
        { action: 'צלע כפול הגובה אליה: השטח בסמ״ר.', why: 'מקבילית היא מלבן אחרי גזירה והזזה.', result: '9 \\cdot 8 = 72', value: '9*8' },
      ] },
    { problem: 'טרפז שבסיסיו $11$ ו־$7$ ס״מ וגובהו $6$ ס״מ. מה שטחו?', answer: 54, check: '(11+7)*6/2',
      steps: [
        { action: 'סכום הבסיסים.', why: 'שני טרפזים יוצרים מקבילית שבסיסה הסכום.', result: '11 + 7 = 18', calc: { expr: '11+7', value: 18 } },
        { action: 'כפול הגובה.', why: 'זה שטח המקבילית של שני הטרפזים.', result: '18 \\cdot 6 = 108', calc: { expr: '18*6', value: 108 } },
        { action: 'חלקי $2$.', why: 'הטרפז הוא חצי מהמקבילית.', result: '108 : 2 = 54', value: '108/2' },
      ] },
    { problem: 'שטח טרפז $60$ סמ״ר, ובסיסיו $9$ ו־$11$ ס״מ. מה גובהו?', answer: 6, check: '2*60/(9+11)',
      steps: [
        { action: 'מציבים בנוסחה: $\\frac{(9 + 11)h}{2} = 60$.', why: 'השטח, הבסיסים והגובה הנעלם.', result: '9 + 11 = 20', calc: { expr: '9+11', value: 20 } },
        { action: '$10h = 60$.', why: '$20$ חלקי $2$ הם $10$.', result: '20 : 2 = 10', calc: { expr: '20/2', value: 10 } },
        { action: 'מחלקים ב־$10$: הגובה בס״מ.', why: 'כדי שיישאר $h$ לבד.', result: '60 : 10 = 6', value: '60/10' },
      ] },
  ],
  together: [
    // AD = 13 with the height 5 (5, 12, 13): the drawing keeps its sides in proportion (learn/figures.test.ts)
    { problem: 'במקבילית $ABCD$: $AB = 14$ ס״מ, הגובה ל־$AB$ הוא $5$ ס״מ, ו־$AD = 13$ ס״מ. מה השטח?', fig: G.paraFig({ a: 14, h: 5, s: 13 }),
      steps: [
        { prompt: 'מה כופלים?', choices: [
          { text: '$14 \\cdot 5$', ok: true, feedback: 'נכון: צלע כפול הגובה אליה.' },
          { text: '$14 \\cdot 13$', ok: false, feedback: '$13$ היא צלע משופעת, לא גובה.' },
          { text: '$\\frac{14 \\cdot 5}{2}$', ok: false, feedback: 'מקבילית אינה חצי מלבן.' },
        ], hints: ['איזה קטע ניצב לצלע $14$?', 'הגובה הוא $5$.'], done: '$14 \\cdot 5$.' },
      ],
      final: { prompt: 'השטח בסמ״ר:', answer: 70, check: '14*5', hints: ['$14 \\cdot 5$.', '$10 \\cdot 5 + 4 \\cdot 5$.'] } },
    { problem: 'גינה בצורת טרפז: בסיסים $6$ מ׳ ו־$10$ מ׳, והמרחק ביניהם $5$ מ׳. מה השטח?',
      fig: geo('טרפז', { _1: [0, 0], _2: [10, 0], _3: [8, 5], _4: [2, 5], _5: [2, 0] }, { polys: [{ pts: ['_1', '_2', '_3', '_4'] }], segs: [lab('_1', '_2', 10), lab('_4', '_3', 6), lab('_4', '_5', 5, { dash: true })], angles: [rightAt('_5', '_2', '_4')] }),
      steps: [
        { prompt: 'מה הגובה?', choices: [
          { text: '$5$ מ׳: המרחק בין הבסיסים', ok: true, feedback: 'נכון: הגובה הוא המרחק בין הבסיסים.' },
          { text: 'השוק המשופעת', ok: false, feedback: 'הגובה הוא המרחק בין הבסיסים, בניצב.' },
        ], hints: ['גובה נמדד בניצב.', 'המרחק בין שני הבסיסים.'], done: 'הגובה $5$ מ׳.' },
      ],
      final: { prompt: 'השטח במ״ר:', answer: 40, check: '(6+10)*5/2', hints: ['$\\frac{(6 + 10) \\cdot 5}{2}$.', '$16 \\cdot 5 = 80$, וחצי ממנו.'] } },
  ],
  diag: area4,
  transfer: area4T,
  misconceptions: [
    { id: 'slant-as-height', title: 'כפלו בצלע משופעת במקום בגובה',
      cause: 'הצלע המשופעת נראית "גבוהה", ונדמה שהיא הגובה.',
      explain: ['הגובה הוא המרחק בין הצלע לצלע שמולה, בניצב.', 'הצלע המשופעת ארוכה מהגובה, ולכן היא נותנת שטח גדול מדי.'],
      remedy: [
        { kind: 'predict', text: 'מקבילית: בסיס $8$, גובה $3$, צלע משופעת $5$. מה השטח?', fig: G.paraFig({ a: 8, h: 3, s: 5 }), choices: ['$24$', '$40$'], answer: 0,
          why: '$8 \\cdot 3 = 24$: הגובה הוא $3$.', wrongWhy: { 1: '$40 = 8 \\cdot 5$: $5$ משופעת. המלבן שמתקבל גבוה $3$, לא $5$.' } },
        { kind: 'explore', text: 'גררו את המשולש לצד השני, וראו את המלבן שמתקבל.', manip: movePara, answer: { mode: 'move', dx: 6, dy: 0 },
          hint: 'החור נסגר כשהמשולש זז בדיוק אורך של צלע.', success: 'המלבן גבוה כמו הגובה של המקבילית, לא כמו הצלע המשופעת.' },
      ] },
    { id: 'one-base', title: 'כפלו בגובה רק בסיס אחד',
      cause: 'במלבן יש בסיס אחד, ונדמה שגם בטרפז.',
      explain: ['לטרפז שני בסיסים באורכים שונים.', 'שני טרפזים יוצרים מקבילית שבסיסה סכום הבסיסים, ולכן משתמשים בשניהם.'],
      remedy: [
        { kind: 'predict', text: 'טרפז שבסיסיו $9$ ו־$3$, וגובהו $4$. מה השטח?',
          fig: geo('טרפז', { _1: [0, 0], _2: [9, 0], _3: [6, 4], _4: [3, 4], _5: [3, 0] }, { polys: [{ pts: ['_1', '_2', '_3', '_4'] }], segs: [lab('_1', '_2', 9), lab('_4', '_3', 3), lab('_4', '_5', 4, { dash: true })], angles: [rightAt('_5', '_2', '_4')] }),
          choices: ['$24$', '$36$'], answer: 0,
          why: '$\\frac{(9 + 3) \\cdot 4}{2} = 24$.', wrongWhy: { 1: '$36 = 9 \\cdot 4$: זה מלבן על הבסיס הגדול, גדול מהטרפז.' } },
      ] },
    { id: 'no-half', title: 'שכחו לחלק ב־2 בשטח הטרפז',
      cause: 'סכום הבסיסים כפול הגובה נותן את המקבילית של שני טרפזים, ושוכחים שהטרפז הוא חצי ממנה.',
      explain: ['$(a + b) \\cdot h$ הוא שטח של שני טרפזים יחד.', 'לכן מחלקים ב־$2$.'],
      remedy: [
        { kind: 'predict', text: 'טרפז שבסיסיו $9$ ו־$3$, וגובהו $4$. מה השטח?',
          fig: geo('טרפז', { _1: [0, 0], _2: [9, 0], _3: [6, 4], _4: [3, 4], _5: [3, 0] }, { polys: [{ pts: ['_1', '_2', '_3', '_4'] }], segs: [lab('_1', '_2', 9), lab('_4', '_3', 3), lab('_4', '_5', 4, { dash: true })], angles: [rightAt('_5', '_2', '_4')] }),
          choices: ['$24$', '$48$'], answer: 0,
          why: '$(9 + 3) \\cdot 4 = 48$ הוא שני טרפזים. אחד הוא $24$.', wrongWhy: { 1: '$48$ היא המקבילית של שני טרפזים כאלה.' } },
      ] },
    { id: 'half-para', title: 'חילקו ב־$2$ כמו במשולש',
      cause: 'הנוסחה של המשולש מתחילה גם היא ב"צלע כפול גובה".',
      explain: ['משולש הוא חצי מקבילית, ולכן בו מחלקים ב־$2$.', 'המקבילית עצמה היא מלבן אחרי הזזה: צלע כפול גובה, בלי חלוקה.'],
      remedy: [
        { kind: 'predict', text: 'מקבילית: בסיס $8$, וגובה $3$. מה השטח?', fig: G.paraFig({ a: 8, h: 3, s: 5 }), choices: ['$24$', '$12$'], answer: 0,
          why: 'המלבן שמתקבל מהמקבילית הוא $8$ על $3$: $24$.', wrongWhy: { 1: '$12$ הוא משולש, חצי מהמקבילית.' } },
      ] },
  ],
  words: ['מקבילית', 'טרפז', 'בסיסי הטרפז', 'שוק', 'גובה הטרפז', 'טרפז ישר־זווית'],
};

// ================================================================ stair 5: perimeters, the same perimeter and another area

/** Two rectangles on one grid: 6 by 2 and 4 by 4, both with perimeter 16. */
const twoOnGrid: FigSpec = geo('שני מלבנים על רשת משבצות', { _a: [0, 0], _b: [6, 0], _c: [6, 2], _d: [0, 2], _e: [8, 0], _f: [12, 0], _g: [12, 4], _h: [8, 4] }, {
  grid: [0, 0, 12, 4], polys: [{ pts: ['_a', '_b', '_c', '_d'] }, { pts: ['_e', '_f', '_g', '_h'] }],
  segs: [lab('_a', '_b', 6), lab('_b', '_c', 2), lab('_e', '_f', 4), lab('_f', '_g', 4)],
});
/** The L of area:5 with its two found sides written in the accent tone. */
const lFound: FigSpec = (() => {
  const f = G.lFig(8, 6, 3, 2);
  return { ...f, segs: [...f.segs, lab('_5', '_6', 5, { hi: true }), lab('_2', '_3', 4, { hi: true })] } as FigSpec;
})();

const stair5: StairContent = {
  skill: 'area:5', topic: 'area', level: 5, title: 'היקפים: אותו היקף, שטח אחר',
  objectives: [
    'לחשב היקף של מצולע, גם כשצלע חסרה מחושבת מצלעות אחרות או בפיתגורס.',
    'להמיר יחידות אורך לפני שמחברים.',
    'לדעת שלמלבנים באותו היקף יכולים להיות שטחים שונים, ולמצוא את הגדול מהם.',
  ],
  idea: 'היקף סופר כל צלע פעם אחת, גם צלע שלא כתוב עליה מספר. ההיקף לא קובע את השטח: באותו היקף, הריבוע מכסה הכי הרבה.',
  why: [
    'בכל המלבנים בהיקף $16$ אורך ועוד רוחב הם $8$, אבל המכפלה גדלה ככל ששני המספרים קרובים יותר.',
    'בצורת $L$ הצלעות הקצרות יחד שוות לצלעות של המלבן החיצוני, ולכן ההיקף שלה כמו של המלבן.',
  ],
  alt: ['חבל באורך $16$ מטר: אפשר לגדר בו ריבוע $4$ על $4$ או מלבן $7$ על $1$. אותו חבל, הרבה פחות דשא.'],
  discover: [
    { kind: 'predict', text: 'לשני המלבנים אותו היקף, $16$. גם אותו שטח?', fig: twoOnGrid,
      choices: ['לא: $12$ ו־$16$', 'כן, אותו היקף אז אותו שטח'], answer: 0,
      why: '$6 \\cdot 2 = 12$ ו־$4 \\cdot 4 = 16$. ההיקף לא קובע את השטח.',
      wrongWhy: { 1: 'ספרו את המשבצות: $12$ בראשון ו־$16$ בשני. אותו היקף, שטח אחר.' } },
    { kind: 'explore', text: 'בנו מלבן בהיקף $16$ שהשטח שלו הכי גדול.', manip: rectBuild({ w: 7, h: 1 }), answer: { mode: 'maxArea', perim: 16 },
      hint: 'אורך ועוד רוחב צריכים להיות $8$. נסו כמה זוגות.',
      success: 'ריבוע $4 \\cdot 4 = 16$: מכל המלבנים בהיקף $16$, לריבוע השטח הגדול ביותר.' },
    { kind: 'rule', text: 'באותו היקף, ככל שהמלבן קרוב יותר לריבוע, השטח שלו גדול יותר.', display: '\\begin{gathered} 1 \\cdot 7 = 7,\\quad 2 \\cdot 6 = 12 \\\\ 3 \\cdot 5 = 15,\\quad 4 \\cdot 4 = 16 \\end{gathered}',
      why: 'בכל המלבנים בהיקף $16$ אורך ועוד רוחב הם $8$. המכפלה גדלה כשהשניים מתקרבים.', fig: rects([[7, 1], [6, 2], [5, 3], [4, 4]], 1.5) },
    { kind: 'predict', text: 'מלבן $12$ על $1$ ומלבן $4$ על $3$. לשניהם שטח $12$. ומה עם ההיקף?', fig: rects([[12, 1], [4, 3]], 2, false),
      choices: ['שונה: $26$ ו־$14$', 'שווה'], answer: 0,
      why: '$2 \\cdot (12 + 1) = 26$ ו־$2 \\cdot (4 + 3) = 14$.',
      wrongWhy: { 1: 'אותו שטח לא אומר אותו היקף: המלבן הארוך והצר מוקף בגבול ארוך הרבה יותר.' } },
    { kind: 'predict', text: 'צורת $L$: מלבן $8$ על $6$ שחסרה בפינתו פינה $3$ על $2$. רק $8$, $6$, $3$ ו־$2$ כתובים. מה ההיקף?', fig: G.lFig(8, 6, 3, 2),
      choices: ['$28$', '$19$', '$42$'], answer: 0,
      why: 'הצלע העליונה $8 - 3 = 5$ והצלע הימנית $6 - 2 = 4$. יחד: $8 + 6 + 5 + 2 + 3 + 4 = 28$, כמו מלבן $8$ על $6$.',
      wrongWhy: { 1: '$19 = 8 + 6 + 3 + 2$: חיברתם רק צלעות שכתוב עליהן מספר. יש עוד שתיים.', 2: '$42$ הוא השטח.' } },
    { kind: 'rule', text: 'היקף: מחברים את כל הצלעות. צלע בלי מספר מוצאים מהצלעות שמולה.', display: '8 + 6 + 5 + 2 + 3 + 4 = 28',
      why: 'כל צלע שהולכים עליה מסביב נספרת פעם אחת.', fig: lFound },
    { kind: 'predict', text: 'משולש ישר־זווית שניצביו $6$ ו־$8$. היתר לא כתוב. מה ההיקף?', fig: G.legsFig(6, 8),
      choices: ['$24$', '$14$', '$28$'], answer: 0,
      why: 'היתר $\\sqrt{6^2 + 8^2} = 10$, וההיקף $6 + 8 + 10 = 24$.',
      wrongWhy: { 1: '$14$: חסרה הצלע השלישית.', 2: '$28 = 6 + 8 + 14$: היתר אינו $6 + 8$. מחשבים אותו בפיתגורס.' } },
    { kind: 'predict', text: 'מלבן $1.5$ מ׳ על $40$ ס״מ. ההיקף בס״מ:', fig: rect(15, 4, ['1.5 מ׳', '40 ס״מ']),
      choices: ['$380$', '$83$', '$190$'], answer: 0,
      why: '$1.5$ מ׳ הם $150$ ס״מ, ו־$2 \\cdot (150 + 40) = 380$.',
      wrongWhy: { 1: '$83 = 2 \\cdot (1.5 + 40)$: חיברתם מטרים עם סנטימטרים.', 2: '$190$ הוא חצי היקף.' } },
  ],
  examples: [
    { problem: 'מה היקף משולש ישר־זווית שניצביו $5$ ו־$12$ ס״מ?', answer: 30, check: '5+12+13', fig: G.legsFig(5, 12),
      steps: [
        { action: 'היתר בריבוע.', why: 'פיתגורס: סכום ריבועי הניצבים.', result: '5^2 + 12^2 = 169', calc: { expr: '5*5+12*12', value: 169 } },
        { action: '$13^2 = 169$, ולכן היתר $13$.', why: 'מוציאים שורש.', result: '13 \\cdot 13 = 169', calc: { expr: '13*13', value: 169 } },
        { action: 'כל הצלעות: ההיקף בס״מ.', why: 'כל צלע נספרת פעם אחת.', result: '5 + 12 + 13 = 30', value: '5+12+13' },
      ] },
    { problem: 'מה השטח הגדול ביותר של מלבן שהיקפו $24$ ס״מ?', answer: 36, check: '6*6',
      steps: [
        { action: 'אורך ועוד רוחב: חצי היקף.', why: 'בהיקף כל אחד מהם פעמיים.', result: '24 : 2 = 12', calc: { expr: '24/2', value: 12 } },
        { action: 'הכי קרוב לריבוע: $6$ ו־$6$. השטח בסמ״ר.', why: 'כשהשניים שווים, המכפלה הכי גדולה.', result: '6 \\cdot 6 = 36', value: '6*6' },
      ] },
    { problem: 'צורת $L$: מלבן $10$ על $7$ ס״מ שחסרה בפינתו פינה $4$ על $3$ ס״מ. מה ההיקף?', answer: 34, check: '2*(10+7)', fig: G.lFig(10, 7, 4, 3),
      steps: [
        { action: 'הצלע העליונה.', why: 'מול הבסיס $10$, פחות הפינה.', result: '10 - 4 = 6', calc: { expr: '10-4', value: 6 } },
        { action: 'הצלע הימנית.', why: 'מול הצלע $7$, פחות הפינה.', result: '7 - 3 = 4', calc: { expr: '7-3', value: 4 } },
        { action: 'כל שש הצלעות: ההיקף בס״מ.', why: 'כל צלע פעם אחת.', result: '10 + 7 + 6 + 3 + 4 + 4 = 34', value: '10+7+6+3+4+4' },
      ] },
  ],
  together: [
    { problem: 'גדר סביב חצר בצורת $L$: מלבן $12$ על $9$ מ׳ שחסרה בו פינה $5$ על $4$ מ׳. כמה מטר גדר?', fig: G.lFig(12, 9, 5, 4),
      steps: [
        { prompt: 'כמה צלעות יש לצורה?', choices: [
          { text: 'שש', ok: true, feedback: 'נכון: ארבע של המלבן, ועוד שתיים של הפינה.' },
          { text: 'ארבע', ok: false, feedback: 'גם לפינה החסרה יש שתי צלעות.' },
        ], hints: ['לכו מסביב וספרו.', 'שש צלעות.'], done: 'שש צלעות.' },
        { prompt: 'הצלע העליונה:', choices: [
          { text: '$7$', ok: true, feedback: 'נכון: $12 - 5 = 7$.' },
          { text: '$5$', ok: false, feedback: '$5$ היא הפינה החסרה. העליונה היא $12 - 5$.' },
        ], hints: ['מול הצלע $12$.', '$12 - 5$.'], done: 'העליונה $7$, והימנית $9 - 4 = 5$.' },
      ],
      final: { prompt: 'אורך הגדר במטרים:', answer: 42, check: '2*(12+9)', hints: ['$12 + 9 + 7 + 4 + 5 + 5$.', 'כמו מלבן $12$ על $9$.'] } },
    { problem: 'לריבוע ולמלבן אותו היקף, $20$ ס״מ. צלע הריבוע $5$ ס״מ, ואורך המלבן $8$ ס״מ. בכמה סמ״ר שטח הריבוע גדול משטח המלבן?',
      steps: [
        { prompt: 'רוחב המלבן:', choices: [
          { text: '$2$', ok: true, feedback: 'נכון: חצי היקף $10$, ו־$10 - 8 = 2$.' },
          { text: '$12$', ok: false, feedback: '$20 - 8$ מוריד אורך אחד. חצי היקף הוא $10$.' },
        ], hints: ['חצי היקף הוא אורך ועוד רוחב.', '$10 - 8$.'], done: 'המלבן $8$ על $2$.' },
      ],
      final: { prompt: 'ההפרש בסמ״ר:', answer: 9, check: '5*5-8*2', hints: ['$25 - 16$.', 'הריבוע $25$, המלבן $16$.'] } },
  ],
  diag: area5,
  transfer: area5T,
  misconceptions: [
    { id: 'missing-sides', title: 'חיברו רק את הצלעות שכתוב עליהן מספר',
      cause: 'סופרים את המספרים שבשרטוט, לא את הצלעות.',
      explain: ['היקף הולך על כל הצלעות, גם על צלע בלי מספר.', 'צלע חסרה מוצאים מהצלעות שמולה.'],
      remedy: [
        { kind: 'predict', text: 'צורת $L$: מלבן $9$ על $7$ שחסרה בו פינה $4$ על $2$. מה ההיקף?', fig: G.lFig(9, 7, 4, 2), choices: ['$32$', '$22$'], answer: 0,
          why: 'העליונה $9 - 4 = 5$, הימנית $7 - 2 = 5$: $9 + 7 + 5 + 2 + 4 + 5 = 32$.', wrongWhy: { 1: '$22 = 9 + 7 + 4 + 2$: שתי צלעות לא נספרו.' } },
        { kind: 'predict', text: 'צורת $L$: מלבן $8$ על $6$ שחסרה בפינתו פינה $3$ על $2$. כמה צלעות יש לה?', fig: lFound, choices: ['שש', 'ארבע'], answer: 0,
          why: 'הולכים מסביב: $8$, $4$, $3$, $2$, $5$, $6$. שש צלעות, ושתיים מהן בצבע.' },
      ] },
    { id: 'same-perim-same-area', title: 'חשבו שבאותו היקף יש אותו שטח',
      cause: 'כשדבר אחד שווה, נדמה שגם השני שווה ("אותו היקף, אותו שטח").',
      explain: ['ההיקף הוא הגבול, והשטח הוא מה שבפנים: הם לא קובעים זה את זה.', 'באותו היקף, המלבן הקרוב לריבוע מכסה יותר.'],
      remedy: [
        { kind: 'predict', text: 'מלבן $5$ על $1$ וריבוע $3$ על $3$. לשניהם היקף $12$. מה השטחים?', fig: rects([[5, 1], [3, 3]], 2, false),
          choices: ['$5$ ו־$9$', 'אותו שטח'], answer: 0,
          why: '$5 \\cdot 1 = 5$ ו־$3 \\cdot 3 = 9$: אותו היקף, שטחים שונים.' },
        { kind: 'explore', text: 'בנו מלבן בהיקף $16$ שהשטח שלו הכי גדול.', manip: rectBuild({ w: 7, h: 1 }), answer: { mode: 'maxArea', perim: 16 },
          hint: 'אורך ועוד רוחב צריכים להיות $8$.', success: 'הריבוע $4$ על $4$: $16$ משבצות, הכי הרבה בהיקף $16$.' },
      ] },
    { id: 'no-convert', title: 'שכחו להמיר בין סנטימטרים למטרים',
      cause: 'רואים שני מספרים ומחברים אותם, בלי לשים לב שהם ביחידות שונות.',
      explain: ['מחברים רק אורכים באותה יחידה.', 'מטר אחד הוא $100$ ס״מ.'],
      remedy: [
        { kind: 'predict', text: 'מלבן $2$ מ׳ על $30$ ס״מ. ההיקף בס״מ:', fig: rect(20, 3, ['2 מ׳', '30 ס״מ']), choices: ['$460$', '$64$'], answer: 0,
          why: '$2$ מ׳ הם $200$ ס״מ: $2 \\cdot (200 + 30) = 460$.', wrongWhy: { 1: '$64 = 2 \\cdot (2 + 30)$: חיברתם מטרים עם סנטימטרים.' } },
      ] },
    { id: 'two-sides', title: 'בהיקף נספרו רק שתי צלעות (חצי היקף)',
      cause: 'רואים אורך אחד ורוחב אחד, ושוכחים את שתי הצלעות שמולם.',
      explain: ['מסגרת הולכת מסביב לכל הלוח: שני אורכים ושני רוחבים.', 'אורך ועוד רוחב הם רק חצי מהדרך.'],
      remedy: [
        { kind: 'predict', text: 'מסגרת ללוח $1.2$ מ׳ על $50$ ס״מ. כמה ס״מ?', fig: rect(12, 5, ['1.2 מ׳', '50 ס״מ']), choices: ['$340$', '$170$'], answer: 0,
          why: '$120 + 50 = 170$ הם חצי הדרך מסביב. כל הדרך: $2 \\cdot 170 = 340$.', wrongWhy: { 1: '$170$ הם אורך אחד ורוחב אחד, חצי מהמסגרת.' } },
      ] },
    { id: 'area-for-perim', title: 'חישבו שטח במקום היקף',
      cause: 'בצורה מורכבת התרגלו לחשב שטח, וכשהשאלה על הגבול מחשבים את מה שבפנים.',
      explain: ['היקף הוא הגבול: מחברים צלעות.', 'שטח הוא מה שבפנים: כופלים, ומורידים פינות.'],
      remedy: [
        { kind: 'predict', text: 'צורת $L$: מלבן $8$ על $6$ שחסרה בפינתו פינה $3$ על $2$. מה ההיקף?', fig: G.lFig(8, 6, 3, 2), choices: ['$28$', '$42$'], answer: 0,
          why: 'הולכים מסביב: $8 + 6 + 5 + 2 + 3 + 4 = 28$.', wrongWhy: { 1: '$42 = 48 - 6$ הוא השטח, מה שבפנים.' } },
      ] },
    { id: 'add-legs', title: 'חיברו את הצלעות בלי לרבע',
      cause: 'היתר נראה כמו המשך של שני הניצבים.',
      explain: ['היתר קצר מסכום הניצבים: הדרך הישרה קצרה מהדרך בפינה.', 'מוצאים אותו בפיתגורס, ורק אז מחברים להיקף.'],
      remedy: [
        { kind: 'predict', text: 'משולש ישר־זווית שניצביו $6$ ו־$8$. מה ההיקף?', fig: G.legsFig(6, 8), choices: ['$24$', '$28$'], answer: 0,
          why: 'היתר $\\sqrt{36 + 64} = 10$, וההיקף $6 + 8 + 10 = 24$.', wrongWhy: { 1: '$28 = 6 + 8 + 14$: היתר אינו $6 + 8$.' } },
      ] },
  ],
  words: ['היקף מצולע', 'צלע חסרה', 'המרת יחידות', 'אותו היקף', 'השטח הגדול ביותר'],
};

export const AREA: StairContent[] = [stair1, stair2, stair3, stair4, stair5];

/** The misconception names this topic adds to its practice's (content/area.js cats names them all). */
export const CATS_AREA: Record<string, string> = {};
