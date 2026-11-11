// The circle, the cylinder and the cone (מעגל, גליל וחרוט): unit 8.4 of grade 8 (ח׳) in the Ministry's תשפ״ז schedule,
// October and November, after Pythagoras (curriculum stage 2, MEASURE-4). Four stairs: the circumference, the area of a
// disc, the cylinder and the cone.
//
// One picture carries each stair: a wheel rolled one turn along a line is a little more than three diameters (π); a disc
// cut into thin sectors and laid head to tail is nearly a rectangle πr by r; a can's label unrolled is a rectangle 2πr by
// h, and its volume is layers of its base; a cone is a third of the cylinder with its base and height, and its height,
// radius and slant height make a right triangle in the axial section. The circle object (`circle`) rolls the wheel and
// slices the disc by its Steppers; the net object (`net`) unrolls the cylinder.
//
// Answers come in the two forms the Ministry accepts: with π (the number before π is typed: 25 for 25π, the item's and
// the together step's `after`) and with π ≈ 3.14 rounded to tenths (`pk`, the calculator's π right too). The diagnostic
// models are the spec's (content/circle.js CIRCLE1 to CIRCLE4T, ported unchanged); every misconception's source is listed
// in content/circle.js. The Ministry's situations (the wheel, the water park's pool and path, the vessel filled with
// litres, the ice-cream cone) are used; the sentences are the app's own. Every number written here is checked by the
// lane's spec/facts-circle-teach.mjs, and the maths of every step by learn/content.test.ts.
import type { DiagModel, FigSpec, ManipSpec, SolidFig, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and drawings
import * as CIRCLE_JS from '@/content/circle.js';

// the drawings content/circle.js builds are geo and solid figures (FigSpec); its inferred types say only "string"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const C: any = CIRCLE_JS;
const PI = '\\pi';

// ---------------------------------------------------------------- figures
// Still drawings: a circle is a geo drawing (components/Figure.jsx), its radius drawn from the centre and written; a
// cylinder and a cone are solid figures (components/SolidFigs.jsx). A point whose name starts with "_" has no letter.

type Pt = [number, number];
type SolidExtra = Partial<Omit<SolidFig, 'type' | 'shape'>>;
const geo = (label: string, pts: Record<string, Pt>, rest: Record<string, unknown> = {}): FigSpec => ({ type: 'geo', label, pts, ...rest });
/** A circle of radius r, its radius written (or a word for it). */
const circle = (r: number, label: string | number = r): FigSpec => C.circleFig(r, label);
/** A circle of diameter d, its diameter drawn and written. */
const diameter = (d: number): FigSpec => C.diameterFig(d);
const cyl = (r: number, h: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'cylinder', r, h, ...extra });
const cone = (r: number, h: number, l?: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'cone', r, h, ...(l != null ? { l } : {}), ...extra });

/** The centre O, a radius r and a diameter d. */
const centreFig: FigSpec = geo('מעגל: המרכז, רדיוס וקוטר', { O: [0, 0], _p: [0, -3], _q: [0, 3] }, {
  circles: [{ c: 'O', r: 3, label: 'r' }], segs: [{ a: '_p', b: '_q', label: 'd', t: 0.22 }],
});
/**
 * A circle standing on a line marked at one, two and three diameters; `unrolled` draws its circumference rolled out along
 * the line (a little past 3d), `end` writes a word at the end of it.
 */
function rollFig(r: number, o: { label?: string | number; unrolled?: boolean; end?: string } = {}): FigSpec {
  const d = 2 * r; const P = Math.PI * d;
  const pts: Record<string, Pt> = { _o: [0, r], _s: [0, 0], _e: [4 * d, 0], _u: [P, 0] };
  const segs: Record<string, unknown>[] = [{ a: '_s', b: '_e', thin: true }];
  const words: { at: Pt; text: string }[] = [];
  [1, 2, 3].forEach((k) => {
    pts[`_t${k}`] = [k * d, 0]; pts[`_h${k}`] = [k * d, r * 0.3];
    segs.push({ a: `_t${k}`, b: `_h${k}` });
    words.push({ at: [k * d, -r * 0.45], text: k === 1 ? 'd' : `${k}d` });
  });
  if (o.unrolled) segs.push({ a: '_s', b: '_u', hi: true });
  if (o.end) words.push({ at: [P, r * 0.62], text: o.end });
  return geo(o.unrolled ? 'עיגול, והיקפו פרוש על קו שמסומנים עליו קטרים' : 'עיגול על קו שמסומנים עליו קטרים', pts,
    { circles: [{ c: '_o', r, label: String(o.label ?? r) }], segs, words });
}
/** A wheel of radius r on a road. */
const wheelFig = (r: number): FigSpec => geo('גלגל על כביש', { _o: [0, r], _a: [-1.3 * r, 0], _b: [3.2 * r, 0] }, {
  circles: [{ c: '_o', r, label: String(r) }], segs: [{ a: '_a', b: '_b' }],
});
/** A circle with the circumference written beside it and its radius asked. */
const circumFig = (r: number, P: string): FigSpec => geo('מעגל שההיקף שלו כתוב והרדיוס שואלים', { _o: [0, 0] }, {
  circles: [{ c: '_o', r, label: 'r = ?' }], words: [{ at: [0, -r - 1.6], text: P }],
});
/** A circle of radius r and the square r by r on its radius, in the accent tone: the unit an area is counted in. */
const squareFig: FigSpec = geo('עיגול, וריבוע שצלעו הרדיוס', { _o: [0, 0], _a: [3, 0], _b: [3, 3], _c: [0, 3] }, {
  circles: [{ c: '_o', r: 3, label: 'r' }], polys: [{ pts: ['_o', '_a', '_b', '_c'], tone: 'add' }],
});
/**
 * A disc of radius r and its n sectors laid head to tail into a near-parallelogram: the base is half the circumference,
 * πr, and the height is r (the sectors pointing down in the accent tone).
 */
function slicedFig(r = 2, n = 8): FigSpec {
  const w = (2 * Math.PI * r) / n; const x0 = r + 1.6; const k = n / 2;
  const pts: Record<string, Pt> = { _o: [0, r / 2], _f: [x0 + w / 2, 0] };
  for (let i = 0; i <= k; i += 1) { pts[`_b${i}`] = [x0 + i * w, 0]; pts[`_t${i}`] = [x0 + (i + 0.5) * w, r]; }
  const polys: Record<string, unknown>[] = [];
  for (let i = 0; i < k; i += 1) {
    polys.push({ pts: [`_b${i}`, `_b${i + 1}`, `_t${i}`] });
    polys.push({ pts: [`_t${i}`, `_t${i + 1}`, `_b${i + 1}`], tone: 'add' });
  }
  return geo('עיגול, והפרוסות שלו מסודרות לסירוגין לצורה שבסיסה חצי ההיקף וגובהה הרדיוס', pts, {
    circles: [{ c: '_o', r, label: 'r' }], polys,
    segs: [{ a: `_b0`, b: `_b${k}`, label: 'πr' }, { a: '_t0', b: '_f', label: 'r', dash: true }],
  });
}
/** Two discs, of radius r and of radius 2r. */
const twoDiscs: FigSpec = geo('שני עיגולים: ברדיוס r וברדיוס כפול', { _o1: [0, 0], _o2: [7, 0] }, {
  circles: [{ c: '_o1', r: 2, label: 'r' }, { c: '_o2', r: 4, label: '2r' }],
});
/** A circle of radius r with its area to tenths written under it. */
const areaNear = (r: number, S: string): FigSpec => geo('עיגול ושטחו בקירוב', { _o: [0, 0] }, {
  circles: [{ c: '_o', r, label: String(r) }], words: [{ at: [0, -r - 1.4], text: S }],
});
/** A round pool of radius r and the path w wide round it (content/circle.js ringFig). */
const ring = (r: number, w: number): FigSpec => C.ringFig({ r, w });
/** A half disc of radius r. */
const half = (r: number): FigSpec => C.partFig(0, r);

/** The axial section of a cone of radius r and slant l, its height dashed and asked. */
const axialAsk = (r: number, l: number, h: number): FigSpec => geo('החתך הצירי של חרוט', { _a: [-r, 0], _b: [r, 0], _t: [0, h], _m: [0, 0] }, {
  polys: [{ pts: ['_a', '_b', '_t'] }],
  segs: [{ a: '_m', b: '_b', label: String(r) }, { a: '_b', b: '_t', label: String(l) }, { a: '_t', b: '_m', label: '?', dash: true }],
  angles: [{ at: '_m', from: '_b', to: '_t', right: true }],
});
/** Half the axial section: legs r and h, the slant l the hypotenuse. */
const halfSection: FigSpec = geo('חצי החתך הצירי: משולש ישר־זווית', { _m: [0, 0], _b: [3, 0], _t: [0, 4] }, {
  polys: [{ pts: ['_m', '_b', '_t'] }],
  segs: [{ a: '_m', b: '_b', label: 'r' }, { a: '_m', b: '_t', label: 'h' }, { a: '_b', b: '_t', label: 'ℓ' }],
  angles: [{ at: '_m', from: '_b', to: '_t', right: true }],
});
/** The axial section of a cone of radius r (or of diameter 2r with g) and height h (content/circle.js axialFig). */
const axial = (g: 0 | 1, r: number, h: number): FigSpec => C.axialFig(g, r, h);

// the objects
const roll: ManipSpec = { kind: 'circle', show: 'circumference', start: { r: 2, t: 0 } };
const slice: ManipSpec = { kind: 'circle', show: 'area', start: { r: 4, n: 4 } };
const unroll: ManipSpec = { kind: 'net', solid: 'cylinder', dims: { r: 2, h: 5 }, task: 'fold', start: { t: 1 } };

// ================================================================ the models (content/circle.js, ported unchanged)

type P1 = { k: number; r: number; c: number };
const circle1: DiagModel<P1> = {
  params: (rnd) => C.CIRCLE1.params(rnd), text: (p) => C.circle1Text(p), fig: (p) => C.circle1Fig(p),
  answer: (p) => C.CIRCLE1.answer(p), bugs: C.CIRCLE1.bugs, solution: (p) => C.circle1Solution(p), hint: (p) => C.circle1Hint(p),
  unit: C.UNIT.cm, after: C.CIRCLE1.after,
};
const circle1T: DiagModel<P1> = {
  params: (rnd) => C.CIRCLE1T.params(rnd), text: (p) => C.trackText(p), fig: (p) => C.trackFig(p),
  answer: (p) => C.CIRCLE1T.answer(p), bugs: C.CIRCLE1T.bugs, solution: (p) => C.trackSolution(p), hint: () => C.trackHint(),
  unit: C.UNIT.m, after: C.CIRCLE1T.after,
};
type P2 = { k: number; r: number; d: number };
const circle2: DiagModel<P2> = {
  params: (rnd) => C.CIRCLE2.params(rnd), text: (p) => C.circle2Text(p), fig: (p) => C.circle2Fig(p),
  answer: (p) => C.CIRCLE2.answer(p), bugs: C.CIRCLE2.bugs, solution: (p) => C.circle2Solution(p), hint: (p) => C.circle2Hint(p),
  unit: C.UNIT.cm2, after: C.CIRCLE2.after,
};
type P2T = { r: number; w: number; R: number };
const circle2T: DiagModel<P2T> = {
  params: (rnd) => C.CIRCLE2T.params(rnd), text: (p) => C.poolText(p), fig: (p) => C.poolFig(p),
  answer: (p) => C.CIRCLE2T.answer(p), bugs: C.CIRCLE2T.bugs, solution: (p) => C.poolSolution(p), hint: () => C.poolHint(),
  unit: C.UNIT.m2, after: C.CIRCLE2T.after,
};
type P3 = { r: number; h: number };
const circle3: DiagModel<P3> = {
  params: (rnd) => C.CIRCLE3.params(rnd), text: (p) => C.circle3Text(p), fig: (p) => C.circle3Fig(p),
  answer: (p) => C.CIRCLE3.answer(p), bugs: C.CIRCLE3.bugs, solution: (p) => C.circle3Solution(p), hint: () => C.circle3Hint(),
  unit: C.UNIT.cm3, after: C.CIRCLE3.after,
};
const circle3T: DiagModel<P3> = {
  params: (rnd) => C.CIRCLE3T.params(rnd), text: (p) => C.labelText(p), fig: (p) => C.labelFig(p),
  answer: (p) => C.CIRCLE3T.answer(p), bugs: C.CIRCLE3T.bugs, solution: (p) => C.labelSolution(p), hint: () => C.labelHint(),
  unit: C.UNIT.cm2, after: C.CIRCLE3T.after,
};
type P4 = { r: number; h: number; l: number };
const circle4: DiagModel<P4> = {
  params: (rnd) => C.CIRCLE4.params(rnd), text: (p) => C.circle4Text(p), fig: (p) => C.circle4Fig(p),
  answer: (p) => C.CIRCLE4.answer(p), bugs: C.CIRCLE4.bugs, solution: (p) => C.circle4Solution(p), hint: () => C.circle4Hint(),
  unit: C.UNIT.cm3, after: C.CIRCLE4.after,
};
const circle4T: DiagModel<P4> = {
  params: (rnd) => C.CIRCLE4T.params(rnd), text: (p) => C.iceText(p), fig: (p) => C.iceFig(p),
  answer: (p) => C.CIRCLE4T.answer(p), bugs: C.CIRCLE4T.bugs, solution: (p) => C.iceSolution(p), hint: () => C.iceHint(),
  unit: C.UNIT.cm3, after: C.CIRCLE4T.after,
};

// ================================================================ stair 1: the circumference

const stair1: StairContent = {
  skill: 'circle:1', topic: 'circle', level: 1, title: 'היקף מעגל',
  objectives: [
    'להכיר את המעגל: מרכז, רדיוס וקוטר, $d = 2r$.',
    'לדעת ש־$\\pi$ הוא היחס בין ההיקף לקוטר, בערך $3.14$.',
    'לחשב היקף, $P = \\pi d = 2\\pi r$, בעזרת $\\pi$ או עם $\\pi \\approx 3.14$, ולמצוא רדיוס מהיקף.',
  ],
  idea: 'ההיקף של כל מעגל הוא קצת יותר משלושה קטרים: בדיוק $\\pi$ קטרים, ו־$\\pi \\approx 3.14$.',
  why: [
    'כשמגלגלים גלגל סיבוב אחד, הדרך שעבר היא ההיקף, והיא תמיד $\\pi$ פעמים הקוטר, בכל גודל.',
    'הקוטר הוא שני רדיוסים, ולכן $\\pi d = 2\\pi r$.',
  ],
  alt: ['חוט סביב צנצנת עגולה: פורשים אותו ליד הקוטר, ונכנסים בו שלושה קטרים ועוד קצת.'],
  discover: [
    { kind: 'say', text: 'מעגל: כל הנקודות שבאותו מרחק מהמרכז, $O$. המרחק הזה הוא הרדיוס, $r$, והקוטר, $d$, הוא שני רדיוסים.', fig: centreFig },
    { kind: 'explore', text: 'גלגלו את העיגול סיבוב אחד על הקו.', manip: roll, answer: { mode: 'unrolled' },
      hint: 'לחצו על "גלגול" עד הסוף.',
      success: 'ההיקף נגמר קצת אחרי שלושה קטרים.' },
    { kind: 'predict', text: 'ועכשיו העיגול ברדיוס $4$. כמה קטרים יהיה ההיקף שלו?', fig: rollFig(4),
      choices: ['שוב קצת יותר מ־$3$', 'יותר קטרים', 'פחות קטרים'], answer: 0,
      why: 'בכל מעגל ההיקף הוא אותו מספר של קטרים: $\\pi \\approx 3.14$.',
      wrongWhy: { 1: 'עיגול גדול יותר עובר דרך ארוכה יותר, אבל גם הקוטר שלו גדל באותה מידה.', 2: 'עיגול קטן יותר עובר דרך קצרה יותר, אבל גם הקוטר שלו קטן באותה מידה.' } },
    { kind: 'rule', text: 'היקף מעגל: $\\pi$ כפול הקוטר, או $2\\pi$ כפול הרדיוס.', display: 'P = \\pi d = 2\\pi r,\\qquad \\pi \\approx 3.14',
      why: '$\\pi$ הוא היחס הקבוע בין ההיקף לקוטר. $3.14$ הוא קירוב שלו, ולכן תשובה עם $3.14$ היא בערך.',
      fig: rollFig(2, { label: 'r', unrolled: true, end: 'πd' }) },
    { kind: 'predict', text: 'מה היקף מעגל שרדיוסו $5$? בעזרת $\\pi$:', fig: circle(5),
      choices: ['$10\\pi$', '$5\\pi$', '$25\\pi$'], answer: 0,
      why: '$2\\pi \\cdot 5 = 10\\pi$.',
      wrongWhy: { 1: '$5\\pi$: בנוסחה עם רדיוס יש $2$. $\\pi$ כפול הקוטר, $10$.', 2: '$25\\pi = \\pi \\cdot 5^2$ הוא השטח.' } },
    { kind: 'predict', text: 'היקף מעגל שקוטרו $10$, עם $\\pi \\approx 3.14$:', fig: diameter(10),
      choices: ['$31.4$', '$62.8$', '$15.7$'], answer: 0,
      why: '$3.14 \\cdot 10 = 31.4$.',
      wrongWhy: { 1: '$62.8 = 2 \\cdot 3.14 \\cdot 10$: את ה־$2$ כופלים ברדיוס, לא בקוטר.', 2: '$15.7 = 3.14 \\cdot 5$: זה חצי היקף.' } },
    { kind: 'rule', text: 'רדיוס מהיקף: מחלקים ב־$2\\pi$.', display: '2\\pi r = 18\\pi \\;\\Rightarrow\\; r = 9',
      why: '$2r$ הוא הקוטר, ולכן $2r = 18$.', fig: circumFig(9, 'P = 18π') },
    { kind: 'predict', text: 'גלגל שרדיוסו $35$ ס״מ מסתובב $10$ פעמים. כמה הוא מתקדם?', fig: wheelFig(35),
      choices: ['בערך $22$ מ׳', 'בערך $11$ מ׳', '$3.5$ מ׳'], answer: 0,
      why: 'בסיבוב אחד $2 \\cdot 3.14 \\cdot 35 = 219.8$ ס״מ, ובעשרה $2198$ ס״מ, כ־$22$ מ׳.',
      wrongWhy: { 1: '$11$ מ׳: חסר ה־$2$, השתמשתם ברדיוס במקום בקוטר.', 2: '$3.5$ מ׳ $= 35 \\cdot 10$ ס״מ: בכל סיבוב הגלגל עובר את ההיקף, לא את הרדיוס.' } },
  ],
  examples: [
    { problem: 'מה היקף מעגל שרדיוסו $6$ ס״מ, בעזרת $\\pi$?', answer: 12, check: '2*6', after: PI, fig: circle(6),
      steps: [
        { action: 'היקף: $2\\pi$ כפול הרדיוס.', why: 'הקוטר הוא שני רדיוסים, וההיקף הוא $\\pi$ קטרים.', result: 'P = 2\\pi r = 2\\pi \\cdot 6 = 12\\pi', value: '2*6' },
        { action: 'ובקירוב, עם $\\pi \\approx 3.14$.', why: 'כך יודעים בערך כמה ס״מ זה.', result: '12\\pi \\approx 3.14 \\cdot 12 = 37.68 \\approx 37.7', calc: { expr: '3.14*12', value: 37.68 } },
      ] },
    { problem: 'מה היקף מעגל שקוטרו $20$ ס״מ, עם $\\pi \\approx 3.14$?', answer: 62.8, check: '3.14*20', fig: diameter(20),
      steps: [
        { action: 'היקף: $\\pi$ כפול הקוטר.', why: 'הקוטר נתון, ולכן אין צורך ב־$2$.', result: 'P = \\pi d = 20\\pi', calc: { expr: '20', value: 20 } },
        { action: 'עם $\\pi \\approx 3.14$: ההיקף בס״מ.', why: 'כופלים את $3.14$ ב־$20$.', result: '3.14 \\cdot 20 = 62.8', value: '3.14*20' },
      ] },
    { problem: 'היקף מעגל $26\\pi$ ס״מ. מה הרדיוס?', answer: 13, check: '26/2', fig: circle(13, '?'),
      steps: [
        { action: 'ההיקף הוא $\\pi$ כפול הקוטר, ולכן הקוטר $26$.', why: 'משווים את מה שלפני $\\pi$.', result: '2\\pi r = 26\\pi \\;\\Rightarrow\\; 2r = 26', calc: { expr: '26', value: 26 } },
        { action: 'הרדיוס חצי מהקוטר.', why: 'הקוטר הוא שני רדיוסים.', result: 'r = 26 : 2 = 13', value: '26/2' },
      ] },
  ],
  together: [
    { problem: 'גלגל אופניים שקוטרו $70$ ס״מ. כמה ס״מ הוא מתקדם בסיבוב אחד? ($\\pi \\approx 3.14$)', fig: diameter(70),
      steps: [
        { prompt: 'איזו נוסחה?', choices: [
          { text: '$\\pi d$: $3.14 \\cdot 70$', ok: true, feedback: 'נכון: הקוטר נתון, וההיקף הוא $\\pi$ קטרים.' },
          { text: '$2\\pi d$', ok: false, feedback: '$2\\pi$ כופלים ברדיוס. כאן נתון הקוטר.' },
          { text: '$\\pi \\cdot 35^2$', ok: false, feedback: 'זה השטח של הגלגל, לא הדרך.' },
        ], hints: ['בסיבוב אחד הגלגל עובר את ההיקף שלו.', 'ההיקף מהקוטר: $\\pi$ כפול הקוטר.'], done: 'ההיקף: $3.14 \\cdot 70$.' },
      ],
      final: { prompt: 'כמה ס״מ בסיבוב אחד? עגלו לעשירית.', answer: 219.8, check: '3.14*70', pk: 70, hints: ['$3.14 \\cdot 70$.', '$3 \\cdot 70 = 210$, ועוד $0.14 \\cdot 70 = 9.8$.'] } },
    { problem: 'מסלול ריצה עגול שרדיוסו $50$ מ׳. כמה מטרים בסיבוב אחד? כתבו בעזרת $\\pi$.', fig: circle(50),
      steps: [
        { prompt: 'הקוטר:', choices: [
          { text: '$100$', ok: true, feedback: 'נכון: שני רדיוסים.' },
          { text: '$50$', ok: false, feedback: '$50$ הוא הרדיוס. הקוטר הוא שני רדיוסים.' },
        ], hints: ['הקוטר עובר דרך המרכז, מצד לצד.', '$2 \\cdot 50$.'], done: 'הקוטר $100$ מ׳, וההיקף $\\pi$ כפול הקוטר.' },
      ],
      final: { prompt: 'כמה מטרים בסיבוב? כתבו את המספר שלפני $\\pi$.', answer: 100, check: '2*50', after: PI, hints: ['$\\pi$ כפול הקוטר.', '$100\\pi$: מה המספר שלפני $\\pi$?'] } },
  ],
  diag: circle1,
  transfer: circle1T,
  misconceptions: [
    { id: 'r-for-d', title: 'השתמשו ברדיוס במקום בקוטר',
      cause: 'זוכרים "$\\pi$ כפול" ושוכחים אם כופלים ברדיוס או בקוטר.',
      explain: ['$\\pi$ כופלים בקוטר.', 'נתון רדיוס? קודם מכפילים ב־$2$.'],
      remedy: [
        { kind: 'explore', text: 'גלגלו את העיגול סיבוב אחד, וספרו כמה קטרים עבר.', manip: roll, answer: { mode: 'unrolled' },
          hint: 'לחצו על "גלגול" עד הסוף.', success: 'קצת יותר משלושה קטרים: $\\pi$ קטרים, לא $\\pi$ רדיוסים.' },
        { kind: 'predict', text: 'מה היקף מעגל שרדיוסו $4$, בעזרת $\\pi$?', fig: circle(4), choices: ['$8\\pi$', '$4\\pi$'], answer: 0,
          why: 'הקוטר $8$, וההיקף $\\pi \\cdot 8 = 8\\pi$.', wrongWhy: { 1: '$4\\pi$ הוא $\\pi$ כפול הרדיוס: חצי היקף.' } },
      ] },
    { id: 'd-for-r', title: 'השתמשו בקוטר במקום ברדיוס',
      cause: 'המספר שלפני $\\pi$ בהיקף הוא הקוטר, ונדמה שהוא הרדיוס.',
      explain: ['ההיקף הוא $\\pi$ כפול הקוטר: מה שלפני $\\pi$ הוא הקוטר.', 'הרדיוס חצי ממנו.'],
      remedy: [
        { kind: 'predict', text: 'היקף מעגל $14\\pi$. מה הרדיוס?', fig: circle(7, '?'), choices: ['$7$', '$14$'], answer: 0,
          why: 'הקוטר $14$, והרדיוס חצי ממנו: $7$.', wrongWhy: { 1: '$14$ הוא הקוטר. הרדיוס חצי ממנו.' } },
      ] },
    { id: 'area-for-circ', title: 'חישבו שטח במקום היקף',
      cause: 'בשתי הנוסחאות יש $\\pi$ ורדיוס, ומתבלבלים ביניהן.',
      explain: ['היקף הוא אורך מסביב: $2\\pi r$, בס״מ.', 'שטח הוא מה שבפנים: $\\pi r^2$, בסמ״ר.'],
      remedy: [
        { kind: 'predict', text: 'מה היקף מעגל שרדיוסו $3$, בעזרת $\\pi$?', fig: circle(3), choices: ['$6\\pi$', '$9\\pi$'], answer: 0,
          why: '$2\\pi \\cdot 3 = 6\\pi$.', wrongWhy: { 1: '$9\\pi = \\pi \\cdot 3^2$ הוא השטח, מה שבפנים.' } },
      ] },
  ],
  words: ['מעגל', 'מרכז', 'רדיוס', 'קוטר', 'היקף', 'π'],
};

// ================================================================ stair 2: the area of a disc

const stair2: StairContent = {
  skill: 'circle:2', topic: 'circle', level: 2, title: 'שטח עיגול',
  objectives: [
    'לחשב שטח עיגול: $S = \\pi r^2$, בעזרת $\\pi$ או עם $\\pi \\approx 3.14$.',
    'להבחין בין היקף לשטח, ובין רדיוס לקוטר.',
    'לחשב שטח של חצי עיגול, רבע עיגול וטבעת.',
  ],
  idea: 'עיגול שחותכים לפרוסות דקות ומסדרים הפוך־ישר נראה כמעט מלבן: אורכו חצי ההיקף, $\\pi r$, וגובהו $r$.',
  why: [
    'לכן השטח $\\pi r \\cdot r = \\pi r^2$.',
    'ברדיוס פי $2$ השטח פי $4$: $\\pi(2r)^2 = 4\\pi r^2$.',
  ],
  alt: ['פיצה: פורסים לשמונה משולשים ומסדרים בשורה, חוד למעלה וחוד למטה.'],
  discover: [
    { kind: 'say', text: 'שטח עיגול נמדד כמו כל שטח, בריבועים: בסמ״ר. הריבוע הצבוע הוא $r$ על $r$.', fig: squareFig },
    { kind: 'explore', text: 'הגדילו את מספר הפרוסות עד שהצורה כמעט מלבן.', manip: slice, answer: { mode: 'sectors', min: 16 },
      hint: 'ככל שהפרוסות דקות יותר, השוליים ישרים יותר.',
      success: 'כמעט מלבן: גובהו $r$, ואורכו חצי היקף, $\\pi r$.' },
    { kind: 'rule', text: 'שטח עיגול: $\\pi r^2$.', display: 'S = \\pi r \\cdot r = \\pi r^2',
      why: 'חצי ההיקף כפול הרדיוס, כמו מלבן שאורכו $\\pi r$ ורוחבו $r$.', fig: slicedFig() },
    { kind: 'predict', text: 'שטח עיגול שרדיוסו $5$, בעזרת $\\pi$:', fig: circle(5),
      choices: ['$25\\pi$', '$10\\pi$', '$100\\pi$'], answer: 0,
      why: '$\\pi \\cdot 5^2 = 25\\pi$.',
      wrongWhy: { 1: '$10\\pi$ הוא ההיקף: האורך מסביב.', 2: '$100\\pi = \\pi \\cdot 10^2$: השתמשתם בקוטר. בנוסחה יש רדיוס.' } },
    { kind: 'predict', text: 'עיגול שקוטרו $8$. השטח, בעזרת $\\pi$:', fig: diameter(8),
      choices: ['$16\\pi$', '$64\\pi$', '$8\\pi$'], answer: 0,
      why: 'רדיוס $4$, ו־$\\pi \\cdot 4^2 = 16\\pi$.',
      wrongWhy: { 1: '$64\\pi$: העליתם בריבוע את הקוטר.', 2: '$8\\pi$ הוא ההיקף.' } },
    { kind: 'predict', text: 'מכפילים את הרדיוס פי $2$. השטח גדל פי:', fig: twoDiscs,
      choices: ['$4$', '$2$'], answer: 0,
      why: '$\\pi(2r)^2 = 4\\pi r^2$. ההיקף גדל פי $2$, השטח פי $4$.',
      wrongWhy: { 1: 'פי $2$ גדל ההיקף. בשטח הרדיוס מופיע פעמיים: $2 \\cdot 2 = 4$.' } },
    { kind: 'rule', text: 'עם $\\pi \\approx 3.14$: כופלים ומעגלים לפי כללי העיגול.', display: '3.14 \\cdot 5^2 = 78.5',
      why: '$3.14$ הוא קירוב, ולכן גם התשובה קירוב.', fig: areaNear(5, 'S ≈ 78.5') },
    { kind: 'predict', text: 'בריכה עגולה ברדיוס $4$, ומסביבה שביל ברוחב $2$. שטח השביל, בעזרת $\\pi$:', fig: ring(4, 2),
      choices: ['$20\\pi$', '$4\\pi$', '$36\\pi$'], answer: 0,
      why: 'העיגול הגדול $\\pi \\cdot 6^2 = 36\\pi$, הבריכה $16\\pi$, והשביל $36\\pi - 16\\pi = 20\\pi$.',
      wrongWhy: { 1: '$4\\pi = \\pi \\cdot 2^2$: חיסרתם רדיוסים לפני ההעלאה בריבוע.', 2: '$36\\pi$ הוא כל העיגול הגדול, עם הבריכה.' } },
  ],
  examples: [
    { problem: 'מה שטח עיגול שרדיוסו $7$ ס״מ, בעזרת $\\pi$?', answer: 49, check: '7*7', after: PI, fig: circle(7),
      steps: [
        { action: 'שטח עיגול: $\\pi$ כפול הרדיוס בריבוע.', why: 'מלבן של חצי היקף על רדיוס.', result: 'S = \\pi r^2 = \\pi \\cdot 7^2 = 49\\pi', value: '7*7' },
        { action: 'ובקירוב, עם $\\pi \\approx 3.14$.', why: 'כך יודעים בערך כמה סמ״ר זה.', result: '49\\pi \\approx 3.14 \\cdot 49 = 153.86 \\approx 153.9', calc: { expr: '3.14*49', value: 153.86 } },
      ] },
    { problem: 'מה שטח עיגול שקוטרו $10$ ס״מ, בעזרת $\\pi$?', answer: 25, check: '(10/2)^2', after: PI, fig: diameter(10),
      steps: [
        { action: 'הרדיוס.', why: 'בנוסחה יש רדיוס, והוא חצי מהקוטר.', result: 'r = 10 : 2 = 5', calc: { expr: '10/2', value: 5 } },
        { action: 'הרדיוס בריבוע, כפול $\\pi$.', why: 'שטח עיגול: $\\pi r^2$.', result: 'S = \\pi \\cdot 5^2 = 25\\pi', value: '5*5' },
      ] },
    { problem: 'מה שטח חצי עיגול שרדיוסו $6$ ס״מ, בעזרת $\\pi$?', answer: 18, check: '6*6/2', after: PI, fig: half(6),
      steps: [
        { action: 'קודם כל העיגול.', why: 'חצי עיגול הוא חצי מהשטח שלו.', result: '\\pi \\cdot 6^2 = 36\\pi', calc: { expr: '6*6', value: 36 } },
        { action: 'חצי ממנו.', why: 'הקוטר חותך את העיגול לשני חצאים שווים.', result: '36\\pi : 2 = 18\\pi', value: '36/2' },
      ] },
  ],
  together: [
    { problem: 'פיצה עגולה שקוטרה $30$ ס״מ. מה שטחה, בעזרת $\\pi$?', fig: diameter(30),
      steps: [
        { prompt: 'מה הרדיוס?', choices: [
          { text: '$15$', ok: true, feedback: 'נכון: חצי מהקוטר.' },
          { text: '$30$', ok: false, feedback: '$30$ הוא הקוטר. הרדיוס חצי ממנו.' },
        ], hints: ['בנוסחת השטח יש רדיוס.', 'הרדיוס הוא חצי מהקוטר.'], done: 'הרדיוס $15$ ס״מ.' },
      ],
      final: { prompt: 'מה השטח בסמ״ר? כתבו את המספר שלפני $\\pi$.', answer: 225, check: '15*15', after: PI, hints: ['$\\pi r^2$: הרדיוס בריבוע.', '$15 \\cdot 15$.'] } },
    { problem: 'שולחן עגול ברדיוס $60$ ס״מ. כמה סמ״ר מפה מכסים אותו בדיוק, עם $\\pi \\approx 3.14$?', fig: circle(60),
      steps: [
        { prompt: 'מה מחשבים?', choices: [
          { text: 'שטח: $3.14 \\cdot 60^2$', ok: true, feedback: 'נכון: המפה מכסה את כל הפנים.' },
          { text: 'היקף: $2 \\cdot 3.14 \\cdot 60$', ok: false, feedback: 'מפה מכסה את הפנים: זה שטח.' },
        ], hints: ['המפה מכסה, או מקיפה?', 'מה שמכסה הוא שטח.'], done: 'מחשבים שטח: $3.14 \\cdot 60^2$.' },
      ],
      final: { prompt: 'כמה סמ״ר?', answer: 11304, check: '3.14*60*60', pk: 3600, hints: ['$60^2 = 3600$.', '$3.14 \\cdot 3600$.'] } },
  ],
  diag: circle2,
  transfer: circle2T,
  misconceptions: [
    { id: 'circ-for-area', title: 'חישבו היקף במקום שטח',
      cause: 'בשתי הנוסחאות יש $\\pi$ ורדיוס, ומתבלבלים ביניהן.',
      explain: ['שטח הוא מה שבפנים: $\\pi r^2$, הרדיוס בריבוע.', 'היקף הוא האורך מסביב: $2\\pi r$.'],
      remedy: [
        { kind: 'explore', text: 'חתכו את העיגול לפרוסות דקות, עד שהצורה כמעט מלבן.', manip: slice, answer: { mode: 'sectors', min: 16 },
          hint: 'הגדילו את מספר הפרוסות.', success: 'מלבן של חצי היקף על רדיוס: $\\pi r \\cdot r$.' },
        { kind: 'predict', text: 'מה שטח עיגול שרדיוסו $6$, בעזרת $\\pi$?', fig: circle(6), choices: ['$36\\pi$', '$12\\pi$'], answer: 0,
          why: '$\\pi \\cdot 6^2 = 36\\pi$.', wrongWhy: { 1: '$12\\pi$ הוא ההיקף, האורך מסביב.' } },
      ] },
    { id: 'd-in-area', title: 'העלו בריבוע את הקוטר במקום את הרדיוס',
      cause: 'הקוטר הוא המספר הכתוב, ומעלים אותו בריבוע כמו שהוא.',
      explain: ['בנוסחה $\\pi r^2$ יש רדיוס.', 'נתון קוטר? קודם מחלקים ב־$2$.'],
      remedy: [
        { kind: 'predict', text: 'מה שטח עיגול שקוטרו $6$, בעזרת $\\pi$?', fig: diameter(6), choices: ['$9\\pi$', '$36\\pi$'], answer: 0,
          why: 'הרדיוס $3$, ו־$\\pi \\cdot 3^2 = 9\\pi$.', wrongWhy: { 1: '$36\\pi = \\pi \\cdot 6^2$: העליתם בריבוע את הקוטר. פי $4$ יותר מדי.' } },
      ] },
    { id: 'ring-sub-radii', title: 'חיסרו רדיוסים לפני ההעלאה בריבוע',
      cause: 'השביל רחב $1$, ונדמה שהשטח שלו הוא של עיגול ברדיוס $1$.',
      explain: ['השביל הוא העיגול הגדול פחות הבריכה.', 'מחשבים את שני השטחים, ואז מחסרים.'],
      remedy: [
        { kind: 'predict', text: 'בריכה עגולה ברדיוס $3$, ומסביבה שביל ברוחב $1$. מה שטח השביל, בעזרת $\\pi$?', fig: ring(3, 1), choices: ['$7\\pi$', '$\\pi$'], answer: 0,
          why: 'העיגול הגדול $\\pi \\cdot 4^2 = 16\\pi$, הבריכה $9\\pi$, והשביל $16\\pi - 9\\pi = 7\\pi$.',
          wrongWhy: { 1: '$\\pi = \\pi \\cdot 1^2$: חיסרתם רדיוסים לפני ההעלאה בריבוע. השביל מקיף את כל הבריכה.' } },
      ] },
    { id: 'no-subtract', title: 'חישבו את הצורה השלמה ולא הורידו את החלק החסר',
      cause: 'מחשבים את העיגול הגדול ושוכחים שהבריכה בתוכו.',
      explain: ['השביל הוא רק הטבעת שמסביב.', 'מהעיגול הגדול מורידים את הבריכה.'],
      remedy: [
        { kind: 'predict', text: 'בריכה עגולה ברדיוס $3$, ומסביבה שביל ברוחב $1$. מה שטח השביל, בעזרת $\\pi$?', fig: ring(3, 1), choices: ['$7\\pi$', '$16\\pi$'], answer: 0,
          why: '$16\\pi - 9\\pi = 7\\pi$.', wrongWhy: { 1: '$16\\pi$ הוא כל העיגול הגדול, עם הבריכה.' } },
      ] },
    { id: 'whole-circle', title: 'חישבו את כל העיגול במקום חלק ממנו',
      cause: 'מחשבים $\\pi r^2$ כמו שהוא, ושוכחים שהצורה רק חלק מעיגול.',
      explain: ['חצי עיגול הוא חצי מהשטח, ורבע עיגול רבע ממנו.', 'קודם כל העיגול, ואז מחלקים.'],
      remedy: [
        { kind: 'predict', text: 'מה שטח חצי עיגול שרדיוסו $4$, בעזרת $\\pi$?', fig: half(4), choices: ['$8\\pi$', '$16\\pi$'], answer: 0,
          why: 'כל העיגול $16\\pi$, וחצי ממנו $8\\pi$.', wrongWhy: { 1: '$16\\pi$ הוא כל העיגול. כאן רק חצי ממנו.' } },
      ] },
  ],
  words: ['שטח עיגול', '$\\pi r^2$', 'חצי עיגול', 'רבע עיגול', 'טבעת', 'קירוב'],
};

// ================================================================ stair 3: the cylinder

const stair3: StairContent = {
  skill: 'circle:3', topic: 'circle', level: 3, title: 'גליל',
  objectives: [
    'להכיר גליל: שני עיגולים חופפים ומעטפת שהיא מלבן.',
    'לחשב שטח מעטפת, $2\\pi r h$, שטח פנים ונפח, $\\pi r^2 h$.',
    'לזהות פריסה של גליל ולעבור בין ליטרים לסמ״ק.',
  ],
  idea: 'גליל הוא "תיבה עגולה": הנפח הוא שטח הבסיס כפול הגובה, והמעטפת נפרשת למלבן.',
  why: [
    'כשפותחים את התווית של פחית מקבלים מלבן: רוחבו היקף הבסיס, $2\\pi r$, וגובהו גובה הפחית.',
    'שכבות של עיגולים זו על זו: כל שכבה $\\pi r^2$, וכמה שכבות כמו הגובה.',
  ],
  alt: ['ערימת מטבעות: כל מטבע הוא עיגול, והערימה גליל.'],
  discover: [
    { kind: 'say', text: 'גליל: שני עיגולים חופפים במישורים מקבילים, ומעטפת ביניהם. הרדיוס $r$, והגובה $h$.', fig: cyl(3, 6, { labels: { r: 'r', h: 'h' } }) },
    { kind: 'explore', text: 'פרשו את המעטפת של הגליל.', manip: unroll, answer: { mode: 'fold', t: 0 },
      hint: 'לחצו על "קיפול" עד אפס.',
      success: 'המעטפת היא מלבן: רוחבו היקף הבסיס, $2\\pi r$, וגובהו $h$.' },
    { kind: 'rule', text: 'שטח המעטפת: היקף הבסיס כפול הגובה.', display: '2\\pi r \\cdot h',
      why: 'המלבן עוטף את הבסיס בדיוק פעם אחת.', fig: { type: 'netfig', solid: 'cylinder', dims: { r: 2, h: 5 }, labels: true } },
    { kind: 'predict', text: 'גליל שרדיוסו $3$ וגובהו $10$. שטח המעטפת, בעזרת $\\pi$:', fig: cyl(3, 10),
      choices: ['$60\\pi$', '$30\\pi$', '$90\\pi$'], answer: 0,
      why: '$2\\pi \\cdot 3 \\cdot 10 = 60\\pi$.',
      wrongWhy: { 1: '$30\\pi = \\pi \\cdot 3 \\cdot 10$: רוחב המלבן הוא כל ההיקף, $2\\pi r$.', 2: '$90\\pi = \\pi \\cdot 3^2 \\cdot 10$ הוא הנפח.' } },
    { kind: 'rule', text: 'נפח גליל: שטח הבסיס כפול הגובה.', display: 'V = \\pi r^2 \\cdot h',
      why: 'כמו בתיבה ובמנסרה: שכבות של בסיס, אחת על השנייה.', fig: cyl(3, 6, { labels: { r: 'r', h: 'h' }, layers: 6 }) },
    { kind: 'predict', text: 'גליל שרדיוסו $4$ וגובהו $5$. הנפח, בעזרת $\\pi$:', fig: cyl(4, 5),
      choices: ['$80\\pi$', '$40\\pi$', '$320\\pi$'], answer: 0,
      why: '$\\pi \\cdot 4^2 \\cdot 5 = 80\\pi$.',
      wrongWhy: { 1: '$40\\pi$ הוא שטח המעטפת.', 2: '$320\\pi = \\pi \\cdot 8^2 \\cdot 5$: העליתם בריבוע את הקוטר.' } },
    { kind: 'predict', text: 'גליל שרדיוסו $2$ וגובהו $5$. שטח הפנים, בעזרת $\\pi$:', fig: cyl(2, 5),
      choices: ['$28\\pi$', '$20\\pi$', '$24\\pi$'], answer: 0,
      why: 'שני בסיסים $2 \\cdot 4\\pi = 8\\pi$ ומעטפת $20\\pi$: $28\\pi$.',
      wrongWhy: { 1: '$20\\pi$ היא רק המעטפת.', 2: '$24\\pi$: ספרתם בסיס אחד.' } },
    { kind: 'predict', text: 'כלי בצורת גליל ששטח בסיסו $500$ סמ״ר. שופכים לתוכו $3$ ליטרים. מה גובה המים?', fig: cyl(4, 5, { labels: false, label: 'שטח הבסיס 500 סמ״ר' }),
      choices: ['$6$ ס״מ', '$0.006$ ס״מ', '$1500$ ס״מ'], answer: 0,
      why: '$3$ ליטרים הם $3000$ סמ״ק, ו־$3000 : 500 = 6$.',
      wrongWhy: { 1: '$3 : 500$: לא המרתם ליטרים לסמ״ק.', 2: '$1500 = 3 \\cdot 500$: כשמחפשים גובה מחלקים את הנפח בבסיס.' } },
  ],
  examples: [
    { problem: 'מה נפח גליל שרדיוסו $5$ ס״מ וגובהו $8$ ס״מ, בעזרת $\\pi$?', answer: 200, check: '5*5*8', after: PI, fig: cyl(5, 8),
      steps: [
        { action: 'שטח הבסיס.', why: 'הבסיס הוא עיגול: $\\pi r^2$.', result: '\\pi \\cdot 5^2 = 25\\pi', calc: { expr: '5*5', value: 25 } },
        { action: 'כפול הגובה: הנפח בסמ״ק.', why: '$8$ שכבות של בסיס.', result: 'V = 25\\pi \\cdot 8 = 200\\pi', value: '25*8' },
      ] },
    { problem: 'מה שטח המעטפת של גליל שרדיוסו $6$ ס״מ וגובהו $10$ ס״מ, בעזרת $\\pi$?', answer: 120, check: '2*6*10', after: PI, fig: cyl(6, 10),
      steps: [
        { action: 'היקף הבסיס: רוחב המלבן.', why: 'המעטפת עוטפת את הבסיס פעם אחת.', result: '2\\pi \\cdot 6 = 12\\pi', calc: { expr: '2*6', value: 12 } },
        { action: 'כפול הגובה: השטח בסמ״ר.', why: 'גובה המלבן הוא גובה הגליל.', result: '12\\pi \\cdot 10 = 120\\pi', value: '12*10' },
      ] },
    { problem: 'מה שטח הפנים של גליל שרדיוסו $3$ ס״מ וגובהו $7$ ס״מ, בעזרת $\\pi$?', answer: 60, check: '2*3*3+2*3*7', after: PI, fig: cyl(3, 7),
      steps: [
        { action: 'שני בסיסים.', why: 'למטה ולמעלה, עיגול שווה.', result: '2 \\cdot \\pi \\cdot 3^2 = 18\\pi', calc: { expr: '2*3*3', value: 18 } },
        { action: 'המעטפת.', why: 'היקף הבסיס כפול הגובה.', result: '2\\pi \\cdot 3 \\cdot 7 = 42\\pi', calc: { expr: '2*3*7', value: 42 } },
        { action: 'יחד: שטח הפנים בסמ״ר.', why: 'שטח הפנים הוא כל מה שבחוץ.', result: '18\\pi + 42\\pi = 60\\pi', value: '18+42' },
      ] },
  ],
  together: [
    { problem: 'פחית: קוטר $8$ ס״מ, גובה $12$ ס״מ. מה נפחה, בעזרת $\\pi$?', fig: cyl(4, 12, { labels: false, label: 'קוטר 8 ס״מ, גובה 12 ס״מ' }),
      steps: [
        { prompt: 'רדיוס:', choices: [
          { text: '$4$', ok: true, feedback: 'נכון: חצי מהקוטר.' },
          { text: '$8$', ok: false, feedback: '$8$ הוא הקוטר.' },
        ], hints: ['בשטח הבסיס יש רדיוס.', 'חצי מהקוטר.'], done: 'הרדיוס $4$ ס״מ, ושטח הבסיס $\\pi \\cdot 4^2 = 16\\pi$.' },
      ],
      final: { prompt: 'מה הנפח בסמ״ק? כתבו את המספר שלפני $\\pi$.', answer: 192, check: '4*4*12', after: PI, hints: ['שטח הבסיס כפול הגובה.', '$16 \\cdot 12$.'] } },
    { problem: 'אותה פחית: כמה סמ״ר נייר בתווית שעוטפת את הדופן, בעזרת $\\pi$?', fig: cyl(4, 12, { labels: false, label: 'קוטר 8 ס״מ, גובה 12 ס״מ' }),
      steps: [
        { prompt: 'מה התווית?', choices: [
          { text: 'המעטפת: $2\\pi r \\cdot h$', ok: true, feedback: 'נכון: התווית היא מלבן סביב הדופן.' },
          { text: 'הבסיס: $\\pi r^2$', ok: false, feedback: 'התווית עוטפת את הדופן, לא את המכסה.' },
        ], hints: ['התווית סביב הדופן או על המכסה?', 'פרושה היא מלבן: היקף הבסיס על הגובה.'], done: 'התווית היא המעטפת: $2\\pi \\cdot 4 \\cdot 12$.' },
      ],
      final: { prompt: 'כמה סמ״ר? כתבו את המספר שלפני $\\pi$.', answer: 96, check: '2*4*12', after: PI, hints: ['היקף הבסיס $8\\pi$.', '$8 \\cdot 12$.'] } },
  ],
  diag: circle3,
  transfer: circle3T,
  misconceptions: [
    { id: 'd-in-area', title: 'העלו בריבוע את הקוטר במקום את הרדיוס',
      cause: 'הקוטר הוא המספר הכתוב, ומעלים אותו בריבוע כמו שהוא.',
      explain: ['בשטח הבסיס $\\pi r^2$ יש רדיוס.', 'נתון קוטר? קודם מחלקים ב־$2$.'],
      remedy: [
        { kind: 'predict', text: 'גליל שקוטרו $4$ וגובהו $3$. מה נפחו, בעזרת $\\pi$?', fig: cyl(2, 3, { labels: false, label: 'קוטר 4, גובה 3' }), choices: ['$12\\pi$', '$48\\pi$'], answer: 0,
          why: 'הרדיוס $2$: $\\pi \\cdot 2^2 \\cdot 3 = 12\\pi$.', wrongWhy: { 1: '$48\\pi = \\pi \\cdot 4^2 \\cdot 3$: העליתם בריבוע את הקוטר.' } },
      ] },
    { id: 'lateral-for-vol', title: 'חישבו מעטפת במקום נפח',
      cause: 'שני החישובים כופלים בגובה, ומתבלבלים בין היקף הבסיס לשטח שלו.',
      explain: ['נפח: שכבות של בסיס, $\\pi r^2$, כפול הגובה.', 'מעטפת: היקף הבסיס, $2\\pi r$, כפול הגובה.'],
      remedy: [
        { kind: 'predict', text: 'גליל שרדיוסו $3$ וגובהו $4$. מה נפחו, בעזרת $\\pi$?', fig: cyl(3, 4, { layers: 4 }), choices: ['$36\\pi$', '$24\\pi$'], answer: 0,
          why: '$\\pi \\cdot 3^2 \\cdot 4 = 36\\pi$.', wrongWhy: { 1: '$24\\pi = 2\\pi \\cdot 3 \\cdot 4$ הוא שטח המעטפת, לא מה שבפנים.' } },
      ] },
    { id: 'r-for-d', title: 'השתמשו ברדיוס במקום בקוטר',
      cause: 'זוכרים שבמעטפת יש $\\pi$ ורדיוס, ושוכחים את ה־$2$.',
      explain: ['רוחב המעטפת הוא כל היקף הבסיס, $2\\pi r$.', '$\\pi r$ הוא רק חצי היקף.'],
      remedy: [
        { kind: 'explore', text: 'פרשו את המעטפת, ובדקו כמה רחב המלבן.', manip: unroll, answer: { mode: 'fold', t: 0 },
          hint: 'לחצו על "קיפול" עד אפס.', success: 'הרוחב הוא כל ההיקף של הבסיס: $2\\pi r$.' },
        { kind: 'predict', text: 'גליל שרדיוסו $2$ וגובהו $5$. מה שטח המעטפת, בעזרת $\\pi$?', fig: cyl(2, 5), choices: ['$20\\pi$', '$10\\pi$'], answer: 0,
          why: 'היקף הבסיס $4\\pi$, כפול $5$: $20\\pi$.', wrongWhy: { 1: '$10\\pi = \\pi \\cdot 2 \\cdot 5$: חסר ה־$2$ של ההיקף.' } },
      ] },
    { id: 'area-for-circ', title: 'חישבו שטח במקום היקף',
      cause: 'במעטפת כופלים בגובה, וכופלים בטעות את שטח הבסיס.',
      explain: ['רוחב המעטפת הוא היקף הבסיס, אורך.', 'שטח הבסיס כפול הגובה הוא הנפח.'],
      remedy: [
        { kind: 'predict', text: 'גליל שרדיוסו $3$ וגובהו $5$. מה שטח המעטפת, בעזרת $\\pi$?', fig: cyl(3, 5), choices: ['$30\\pi$', '$45\\pi$'], answer: 0,
          why: '$2\\pi \\cdot 3 \\cdot 5 = 30\\pi$.', wrongWhy: { 1: '$45\\pi = \\pi \\cdot 3^2 \\cdot 5$ הוא הנפח.' } },
      ] },
    { id: 'no-bases', title: 'חישבו רק את המעטפת, בלי הבסיסים',
      cause: 'המעטפת היא החלק שרואים, ושוכחים את המכסה ואת התחתית.',
      explain: ['שטח הפנים הוא כל מה שבחוץ: מעטפת ושני בסיסים.', 'מחברים $2\\pi r^2$ למעטפת.'],
      remedy: [
        { kind: 'predict', text: 'גליל שרדיוסו $1$ וגובהו $4$. מה שטח הפנים שלו, בעזרת $\\pi$?', fig: cyl(1, 4), choices: ['$10\\pi$', '$8\\pi$'], answer: 0,
          why: 'המעטפת $2\\pi \\cdot 1 \\cdot 4 = 8\\pi$, ועוד שני בסיסים $2\\pi$: $10\\pi$.', wrongWhy: { 1: '$8\\pi$ היא רק המעטפת. חסרים שני הבסיסים.' } },
      ] },
    { id: 'one-base', title: 'ספרו רק בסיס אחד',
      cause: 'רואים בשרטוט את הבסיס העליון, והתחתון מוסתר.',
      explain: ['לגליל שני בסיסים שווים, למעלה ולמטה.', 'לכן $2\\pi r^2$ ועוד המעטפת.'],
      remedy: [
        { kind: 'predict', text: 'גליל שרדיוסו $2$ וגובהו $3$. מה שטח הפנים שלו, בעזרת $\\pi$?', fig: cyl(2, 3), choices: ['$20\\pi$', '$16\\pi$'], answer: 0,
          why: 'שני בסיסים $8\\pi$ ומעטפת $12\\pi$: $20\\pi$.', wrongWhy: { 1: '$16\\pi$: ספרתם בסיס אחד. לגליל שניים.' } },
      ] },
    { id: 'no-convert', title: 'שכחו להמיר בין ליטרים לסמ״ק',
      cause: 'הבסיס בסמ״ר והמים בליטרים, ומחלקים את המספרים כמו שהם.',
      explain: ['ליטר אחד הוא $1000$ סמ״ק.', 'קודם הופכים ליטרים לסמ״ק, ואז מחלקים בשטח הבסיס.'],
      remedy: [
        { kind: 'predict', text: 'כלי בצורת גליל ששטח בסיסו $400$ סמ״ר. שופכים לתוכו $2$ ליטרים. מה גובה המים?', fig: cyl(4, 5, { labels: false, label: 'שטח הבסיס 400 סמ״ר' }), choices: ['$5$ ס״מ', '$0.005$ ס״מ'], answer: 0,
          why: '$2$ ליטרים הם $2000$ סמ״ק, ו־$2000 : 400 = 5$.', wrongWhy: { 1: '$2 : 400$: לא המרתם ליטרים לסמ״ק.' } },
      ] },
  ],
  words: ['גליל', 'בסיסי הגליל', 'מעטפת', 'פריסה של גליל', 'שטח פנים', 'נפח גליל'],
};

// ================================================================ stair 4: the cone

const stair4: StairContent = {
  skill: 'circle:4', topic: 'circle', level: 4, title: 'חרוט',
  objectives: [
    'להכיר חרוט: בסיס עגול, קודקוד, גובה וקו יוצר. החתך הצירי הוא משולש שווה־שוקיים.',
    'לחשב נפח חרוט: שליש מנפח הגליל עם אותו בסיס ואותו גובה.',
    'לחשב שטח של החתך הצירי, ולמצוא גובה או קו יוצר בעזרת משפט פיתגורס.',
  ],
  idea: 'חרוט הוא שליש מגליל שיש לו אותו בסיס ואותו גובה. הגובה, הרדיוס והקו היוצר יוצרים משולש ישר־זווית.',
  why: [
    'שלושה חרוטים מלאים ממלאים בדיוק את הגליל.',
    'הגובה ניצב לבסיס, ולכן בחתך הצירי יש משולש ישר־זווית שהקו היוצר הוא היתר שלו.',
  ],
  alt: ['גביע גלידה: הרדיוס הוא הפתח, הקו היוצר הוא הצד, והגובה הוא מהפתח עד החוד, בניצב.'],
  discover: [
    { kind: 'say', text: 'חרוט: בסיס עגול וקודקוד. הגובה יורד מהקודקוד למרכז הבסיס, והקו היוצר יורד מהקודקוד אל שפת הבסיס.',
      fig: cone(3, 4, 5, { labels: { r: 'r', h: 'h', l: 'ℓ' } }) },
    { kind: 'predict', text: 'חרוט וגליל עם אותו בסיס ואותו גובה. כמה חרוטים מלאים במים ממלאים את הגליל?', fig: cyl(3, 6, { inner: 'cone', labels: false }),
      choices: ['$3$', '$2$', '$1$'], answer: 0,
      why: 'בדיוק שלושה: נפח החרוט שליש מנפח הגליל.',
      wrongWhy: { 1: 'החרוט מתחדד, ולכן הוא פחות מחצי הגליל.', 2: 'החרוט צר מהגליל: אחד לא מספיק.' } },
    { kind: 'rule', text: 'נפח חרוט: שליש מנפח הגליל.', display: 'V = \\frac{\\pi r^2 h}{3}',
      why: 'לגליל ולחרוט אותו בסיס ואותו גובה, והחרוט שליש.', fig: cyl(3, 6, { inner: 'cone', labels: { r: 'r', h: 'h' } }) },
    { kind: 'predict', text: 'לחרוט רדיוס $3$, גובה $4$ וקו יוצר $5$. הנפח, בעזרת $\\pi$:', fig: cone(3, 4, 5),
      choices: ['$12\\pi$', '$36\\pi$', '$15\\pi$'], answer: 0,
      why: '$\\frac{\\pi \\cdot 3^2 \\cdot 4}{3} = 12\\pi$: הגובה $4$, לא $5$.',
      wrongWhy: { 1: '$36\\pi$ הוא הגליל. החרוט שליש ממנו.', 2: '$15\\pi$: $5$ הוא הקו היוצר. הגובה ניצב לבסיס.' } },
    { kind: 'say', text: 'חותכים את החרוט דרך הקודקוד והמרכז: מתקבל משולש שווה־שוקיים. הבסיס שלו הוא הקוטר, והשוקיים הן קווים יוצרים.',
      fig: cone(5, 12, 13, { diag: 'axial', labels: false }) },
    { kind: 'predict', text: 'בחתך הצירי: רדיוס $9$, קו יוצר $15$. מה גובה החרוט?', fig: axialAsk(9, 15, 12),
      choices: ['$12$', '$6$', '$17.5$'], answer: 0,
      why: '$\\sqrt{15^2 - 9^2} = \\sqrt{144} = 12$.',
      wrongWhy: { 1: '$15 - 9$: מחסרים צלעות בלי לרבע.', 2: '$\\sqrt{15^2 + 9^2} \\approx 17.5$: הקו היוצר הוא היתר, ולכן מחסרים.' } },
    { kind: 'rule', text: 'בחרוט: $h^2 + r^2 = \\ell^2$.', display: 'h = \\sqrt{\\ell^2 - r^2}',
      why: 'הקו היוצר הוא היתר של המשולש הישר־זווית שבחצי החתך.', fig: halfSection },
    { kind: 'predict', text: 'לחרוט רדיוס $5$ וגובה $12$. מה שטח החתך הצירי?', fig: axial(0, 5, 12),
      choices: ['$60$', '$120$', '$30$'], answer: 0,
      why: 'משולש שבסיסו הקוטר $10$ וגובהו $12$: $\\frac{10 \\cdot 12}{2} = 60$.',
      wrongWhy: { 1: '$120$: שכחתם לחלק ב־$2$.', 2: '$30$: הבסיס הוא הקוטר, לא הרדיוס.' } },
  ],
  examples: [
    { problem: 'מה נפח חרוט שרדיוסו $6$ ס״מ וגובהו $5$ ס״מ, בעזרת $\\pi$?', answer: 60, check: '6*6*5/3', after: PI, fig: cone(6, 5),
      steps: [
        { action: 'הגליל עם אותו בסיס ואותו גובה.', why: 'שטח הבסיס כפול הגובה.', result: '\\pi \\cdot 6^2 \\cdot 5 = 180\\pi', calc: { expr: '6*6*5', value: 180 } },
        { action: 'שליש ממנו: נפח החרוט בסמ״ק.', why: 'שלושה חרוטים כאלה ממלאים את הגליל.', result: 'V = 180\\pi : 3 = 60\\pi', value: '180/3' },
      ] },
    { problem: 'לחרוט רדיוס $8$ ס״מ וקו יוצר $10$ ס״מ. מה נפחו, בעזרת $\\pi$?', answer: 128, check: '8*8*6/3', after: PI, fig: cone(8, 6, 10, { labels: { r: 8, l: 10, h: '?' } }),
      steps: [
        { action: 'הגובה בריבוע.', why: 'בחצי החתך: הקו היוצר הוא היתר, והרדיוס והגובה ניצבים.', result: 'h^2 = 10^2 - 8^2 = 36', calc: { expr: '10*10-8*8', value: 36 } },
        { action: 'הגובה.', why: 'המספר שבריבוע נותן $36$.', result: 'h = \\sqrt{36} = 6', calc: { expr: 'sqrt(36)', value: 6 } },
        { action: 'הנפח: שליש מהגליל.', why: 'עכשיו יש גובה, והקו היוצר כבר לא בנוסחה.', result: 'V = \\frac{\\pi \\cdot 8^2 \\cdot 6}{3} = 128\\pi', value: '8*8*6/3' },
      ] },
    { problem: 'מה שטח החתך הצירי של חרוט שקוטרו $14$ ס״מ וגובהו $9$ ס״מ?', answer: 63, check: '14*9/2', fig: axial(1, 7, 9),
      steps: [
        { action: 'החתך הוא משולש: הבסיס הקוטר, והגובה גובה החרוט.', why: 'החיתוך עובר דרך הקודקוד והמרכז.', result: '14 \\cdot 9 = 126', calc: { expr: '14*9', value: 126 } },
        { action: 'חצי: שטח המשולש בסמ״ר.', why: 'שטח משולש: בסיס כפול גובה, חלקי $2$.', result: 'S = 126 : 2 = 63', value: '126/2' },
      ] },
  ],
  together: [
    { problem: 'משפך בצורת חרוט: רדיוס $9$ ס״מ וקו יוצר $15$ ס״מ. מה נפחו, בעזרת $\\pi$?', fig: cone(9, 12, 15, { labels: { r: 9, l: 15, h: '?' } }),
      steps: [
        { prompt: 'מה הגובה?', choices: [
          { text: '$12$', ok: true, feedback: 'נכון: $\\sqrt{15^2 - 9^2} = \\sqrt{144} = 12$.' },
          { text: '$15$', ok: false, feedback: '$15$ הוא הקו היוצר.' },
        ], hints: ['הקו היוצר הוא היתר של חצי החתך.', '$15^2 - 9^2 = 144$.'], done: 'הגובה $12$ ס״מ.' },
        { prompt: 'נפח הגליל עם אותו בסיס וגובה:', choices: [
          { text: '$972\\pi$', ok: true, feedback: 'נכון: $\\pi \\cdot 9^2 \\cdot 12 = 972\\pi$.' },
          { text: '$324\\pi$', ok: false, feedback: 'זה כבר השליש.' },
        ], hints: ['שטח הבסיס כפול הגובה.', '$81 \\cdot 12$.'], done: 'הגליל $972\\pi$, והחרוט שליש ממנו.' },
      ],
      final: { prompt: 'מה נפח המשפך בסמ״ק? כתבו את המספר שלפני $\\pi$.', answer: 324, check: '9*9*12/3', after: PI, hints: ['שליש מהגליל.', '$972 : 3$.'] } },
    { problem: 'מגליל ברדיוס $4$ ס״מ ובגובה $9$ ס״מ מגלפים חרוט עם אותו בסיס ואותו גובה. כמה סמ״ק נשארים, בעזרת $\\pi$?', fig: cyl(4, 9, { inner: 'cone' }),
      steps: [
        { prompt: 'נפח הגליל:', choices: [
          { text: '$144\\pi$', ok: true, feedback: 'נכון: $\\pi \\cdot 4^2 \\cdot 9 = 144\\pi$.' },
          { text: '$72\\pi$', ok: false, feedback: '$72\\pi$ הוא חצי. שטח הבסיס $16\\pi$, כפול $9$.' },
        ], hints: ['שטח הבסיס כפול הגובה.', '$16 \\cdot 9$.'], done: 'הגליל $144\\pi$, והחרוט שליש ממנו, $48\\pi$.' },
      ],
      final: { prompt: 'כמה נשאר? כתבו את המספר שלפני $\\pi$.', answer: 96, check: '4*4*9-4*4*9/3', after: PI, hints: ['הגליל פחות החרוט.', '$144 - 48$.'] } },
  ],
  diag: circle4,
  transfer: circle4T,
  misconceptions: [
    { id: 'no-third', title: 'שכחו לחלק ב־$3$',
      cause: 'נפח של "גוף ישר" הוא בסיס כפול גובה, ושוכחים שהחרוט מתחדד.',
      explain: ['החרוט צר ככל שעולים, ולכן הוא פחות מהגליל.', 'בדיוק שליש: $\\frac{\\pi r^2 h}{3}$.'],
      remedy: [
        { kind: 'predict', text: 'חרוט וגליל עם אותו בסיס ואותו גובה. כמה חרוטים מלאים ממלאים את הגליל?', fig: cyl(3, 6, { inner: 'cone', labels: false }), choices: ['$3$', '$1$'], answer: 0,
          why: 'שלושה: החרוט שליש מהגליל.', wrongWhy: { 1: 'החרוט מתחדד: הוא רק שליש מהגליל.' } },
        { kind: 'predict', text: 'לחרוט רדיוס $3$ וגובה $5$. מה נפחו, בעזרת $\\pi$?', fig: cone(3, 5), choices: ['$15\\pi$', '$45\\pi$'], answer: 0,
          why: '$\\frac{\\pi \\cdot 3^2 \\cdot 5}{3} = 15\\pi$.', wrongWhy: { 1: '$45\\pi$ הוא הגליל. החרוט שליש ממנו.' } },
      ] },
    { id: 'slant-as-height', title: 'השתמשו בקו היוצר במקום בגובה',
      cause: 'הקו היוצר הוא הקו שרואים בצד, והגובה מוסתר בפנים.',
      explain: ['הגובה ניצב לבסיס, מהקודקוד למרכז.', 'הקו היוצר הוא היתר, ארוך מהגובה.'],
      remedy: [
        { kind: 'predict', text: 'לחרוט רדיוס $6$, גובה $8$ וקו יוצר $10$. מה נפחו, בעזרת $\\pi$?', fig: cone(6, 8, 10), choices: ['$96\\pi$', '$120\\pi$'], answer: 0,
          why: '$\\frac{\\pi \\cdot 6^2 \\cdot 8}{3} = 96\\pi$.', wrongWhy: { 1: '$120\\pi$: כפלתם בקו היוצר $10$. בנוסחה יש גובה.' } },
      ] },
    { id: 'add-not-sub', title: 'חיברו ריבועים במקום לחסר (כשמחפשים ניצב)',
      cause: 'זוכרים "מחברים ריבועים" מפיתגורס, גם כשמחפשים ניצב.',
      explain: ['בחרוט, הקו היוצר הוא היתר: הצלע הארוכה.', 'מחפשים את הגובה, ניצב: מחסרים מהיתר בריבוע.'],
      remedy: [
        { kind: 'predict', text: 'לחרוט רדיוס $5$ וקו יוצר $13$. מה גובהו?', fig: axialAsk(5, 13, 12), choices: ['$12$', '$13.9$'], answer: 0,
          why: '$\\sqrt{13^2 - 5^2} = \\sqrt{144} = 12$.', wrongWhy: { 1: '$\\sqrt{13^2 + 5^2} \\approx 13.9$: ארוך מהקו היוצר, שהוא היתר. מחסרים.' } },
      ] },
    { id: 'subtract-sides', title: 'חיסרו צלעות בלי לרבע',
      cause: 'יודעים שמחסרים, ומחסרים את האורכים עצמם.',
      explain: ['פיתגורס הוא משפט על ריבועים.', 'מחסרים ריבועים, ואז מוציאים שורש.'],
      remedy: [
        { kind: 'predict', text: 'לחרוט רדיוס $6$ וקו יוצר $10$. מה גובהו?', fig: axialAsk(6, 10, 8), choices: ['$8$', '$4$'], answer: 0,
          why: '$\\sqrt{10^2 - 6^2} = \\sqrt{64} = 8$.', wrongWhy: { 1: '$10 - 6 = 4$: חיסרתם אורכים. מחסרים ריבועים.' } },
      ] },
    { id: 'no-half', title: 'שכחו לחלק ב־2 בשטח המשולש',
      cause: 'בסיס כפול גובה נותן את המלבן שמסביב לחתך.',
      explain: ['החתך הצירי הוא משולש.', 'שטח משולש: בסיס כפול גובה, חלקי $2$.'],
      remedy: [
        { kind: 'predict', text: 'לחרוט רדיוס $4$ וגובה $6$. מה שטח החתך הצירי?', fig: axial(0, 4, 6), choices: ['$24$', '$48$'], answer: 0,
          why: 'הבסיס הקוטר $8$: $\\frac{8 \\cdot 6}{2} = 24$.', wrongWhy: { 1: '$48 = 8 \\cdot 6$: שכחתם לחלק ב־$2$.' } },
      ] },
    { id: 'r-for-d', title: 'השתמשו ברדיוס במקום בקוטר',
      cause: 'הרדיוס כתוב בשרטוט, ולוקחים אותו לבסיס המשולש.',
      explain: ['בסיס החתך הצירי הוא כל הקוטר, משפה לשפה.', 'הרדיוס הוא רק חצי ממנו.'],
      remedy: [
        { kind: 'predict', text: 'לחרוט רדיוס $4$ וגובה $6$. מה שטח החתך הצירי?', fig: axial(0, 4, 6), choices: ['$24$', '$12$'], answer: 0,
          why: 'הבסיס הקוטר $8$: $\\frac{8 \\cdot 6}{2} = 24$.', wrongWhy: { 1: '$12 = \\frac{4 \\cdot 6}{2}$: הבסיס הוא הקוטר, לא הרדיוס.' } },
      ] },
  ],
  words: ['חרוט', 'קודקוד', 'גובה החרוט', 'קו יוצר', 'חתך צירי', 'שליש'],
};

export const CIRCLE: StairContent[] = [stair1, stair2, stair3, stair4];

/** The misconception names this topic adds to its practice's (content/circle.js cats names them all). */
export const CATS_CIRCLE: Record<string, string> = {};
