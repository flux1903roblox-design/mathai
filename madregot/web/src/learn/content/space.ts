// Pythagoras in space (פיתגורס במרחב): unit 8.17 of grade 8 (ח׳) in the Ministry's תשפ״ז schedule, May (curriculum
// stage 2, MEASURE-5). Two stairs: the diagonal of a box and of a cube, and the right triangles inside solids.
//
// One picture carries the unit: a right triangle standing inside the solid. In a box, the base's diagonal is the
// hypotenuse of a triangle on the floor, and the box's diagonal is the hypotenuse of a second triangle that stands on it
// with the upright edge, so d² = a² + b² + c². In a cylinder the axial section is a rectangle 2r by h, whose diagonal is
// the longest rod; in a cone half the axial section is a right triangle (met in October, circle:4, once more here). The
// net object (`net`) builds a box from Steppers until its diagonal is 9 (a² + b² + c² = 81).
// The diagnostic models are the spec's (content/space.js SPACE1 to SPACE2T, ported unchanged); every misconception's
// source is listed in content/space.js. The Ministry's distinction (a face's diagonal against the box's) and its
// examples (the longest stick, a cylinder's axial section) are used; the sentences are the app's own. Every number written
// here is checked by the lane's spec/facts-space-teach.mjs, and the maths of every step by learn/content.test.ts.
import type { DiagModel, FigSpec, ManipSpec, SolidFig, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and drawings
import * as SPACE_JS from '@/content/space.js';

// the drawings content/space.js builds are solid figures (FigSpec); its inferred types say only "string" for their type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: any = SPACE_JS;
const PI = '\\pi';

// ---------------------------------------------------------------- figures
// Still solids (components/SolidFigs.jsx): a box is a long, b deep and c high; diag 'face' marks the base's diagonal,
// 'space' the box's, 'tri' the right triangle the box's diagonal stands in; a cylinder's 'rod' its longest rod.

type Pt = [number, number];
type SolidExtra = Partial<Omit<SolidFig, 'type' | 'shape'>>;
const box = (a: number, b: number, c: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'box', a, b, c, ...extra });
const cube = (a: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'cube', a, ...extra });
const cyl = (r: number, h: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'cylinder', r, h, ...extra });
const cone = (r: number, h: number, l?: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'cone', r, h, ...(l != null ? { l } : {}), ...extra });
/** A prism whose base is a right triangle: legs p (along the bottom) and q (up), length L. */
const prism = (p: number, q: number, L: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'prism', p, q, L, ...extra });
const geo = (label: string, pts: Record<string, Pt>, rest: Record<string, unknown> = {}): FigSpec => ({ type: 'geo', label, pts, ...rest });

/** The axial section of a cylinder: a rectangle d by h and its diagonal, the longest rod. */
const sectionRod: FigSpec = geo('החתך הצירי של גליל: מלבן ואלכסון שלו', { _a: [0, 0], _b: [6, 0], _c: [6, 8], _d: [0, 8] }, {
  polys: [{ pts: ['_a', '_b', '_c', '_d'] }],
  segs: [{ a: '_a', b: '_b', label: 'd = 2r' }, { a: '_b', b: '_c', label: 'h' }, { a: '_a', b: '_c', hi: true }],
  angles: [{ at: '_b', from: '_a', to: '_c', right: true }],
});
/** Half the axial section of a cone in the accent tone: the radius r, the height asked, the slant l. */
const halfCone = (r: number, h: number, l: number): FigSpec => geo('חצי החתך הצירי של חרוט', { _a: [-r, 0], _m: [0, 0], _b: [r, 0], _t: [0, h] }, {
  polys: [{ pts: ['_a', '_m', '_t'] }, { pts: ['_m', '_b', '_t'], tone: 'add' }],
  segs: [{ a: '_m', b: '_b', label: String(r) }, { a: '_b', b: '_t', label: String(l) }, { a: '_t', b: '_m', label: '?', dash: true }],
  angles: [{ at: '_m', from: '_b', to: '_t', right: true }],
});

// the net object (components/manip/NetFold.jsx): a box built from Steppers until its diagonal is 9
const buildD9: ManipSpec = { kind: 'net', solid: 'box', task: 'build', start: { a: 1, b: 1, c: 1 } };

// ================================================================ the models (content/space.js, ported unchanged)

type P1 = { a: number; b: number; c: number; d: number };
const space1: DiagModel<P1> = {
  params: (rnd) => S.SPACE1.params(rnd), text: (p) => S.space1Text(p), fig: (p) => S.space1Fig(p),
  answer: (p) => S.SPACE1.answer(p), bugs: S.SPACE1.bugs, solution: (p) => S.space1Solution(p), hint: () => S.space1Hint(), unit: S.UNIT.cm,
};
const space1T: DiagModel<P1> = {
  params: (rnd) => S.SPACE1T.params(rnd), text: (p) => S.stickText(p), fig: (p) => S.stickFig(p),
  answer: (p) => S.SPACE1T.answer(p), bugs: S.SPACE1T.bugs, solution: (p) => S.stickSolution(p), hint: () => S.stickHint(), unit: S.UNIT.cm,
};
type P2 = { r: number; d: number; h: number; rod: number };
const space2: DiagModel<P2> = {
  params: (rnd) => S.SPACE2.params(rnd), text: (p) => S.space2Text(p), fig: (p) => S.space2Fig(p),
  answer: (p) => S.SPACE2.answer(p), bugs: S.SPACE2.bugs, solution: (p) => S.space2Solution(p), hint: () => S.space2Hint(), unit: S.UNIT.cm,
};
type P2T = { a: number; b: number; e: number; c: number };
const space2T: DiagModel<P2T> = {
  params: (rnd) => S.SPACE2T.params(rnd), text: (p) => S.triText(p), fig: (p) => S.triFig(p),
  answer: (p) => S.SPACE2T.answer(p), bugs: S.SPACE2T.bugs, solution: (p) => S.triSolution(p), hint: () => S.triHint(), unit: S.UNIT.cm2,
};

// ================================================================ stair 1: the diagonal of a box and of a cube

const stair1: StairContent = {
  skill: 'space:1', topic: 'space', level: 1, title: 'אלכסון בקובייה ובתיבה',
  objectives: [
    'להבחין בין אלכסון של פאה לבין אלכסון של תיבה.',
    'לחשב אלכסון תיבה בשני שלבים של משפט פיתגורס, או ישר בנוסחה $d^2 = a^2 + b^2 + c^2$.',
    'לחשב אלכסון קובייה, ולמצוא מקצוע חסר מהאלכסון.',
  ],
  idea: 'אלכסון התיבה הוא יתר של משולש ישר־זווית שעומד על אלכסון הבסיס: ניצב אחד הוא אלכסון הבסיס, והשני הוא הגובה.',
  why: [
    'אלכסון הבסיס: $a^2 + b^2$. ועם הגובה: $(a^2 + b^2) + c^2$.',
    'לכן אלכסון התיבה ארוך מכל אלכסון של פאה, וקצר מהדרך לאורך המקצועות.',
  ],
  alt: ['חדר: מהפינה התחתונה ליד הדלת עד הפינה העליונה הרחוקה, דרך האוויר.'],
  discover: [
    { kind: 'say', text: 'בתיבה יש שני סוגי אלכסונים: אלכסון של פאה, שנמצא על אחת הפאות, ואלכסון של התיבה, שעובר דרך הפנים מקודקוד לקודקוד הרחוק.',
      fig: box(4, 3, 2, { diag: ['face', 'space'], labels: false }) },
    { kind: 'predict', text: 'תיבה $3$ על $4$ על $12$. מה אורך האלכסון של הבסיס, $3$ על $4$?', fig: box(3, 4, 12, { diag: 'face' }),
      choices: ['$5$', '$7$'], answer: 0,
      why: '$\\sqrt{3^2 + 4^2} = \\sqrt{25} = 5$.',
      wrongWhy: { 1: '$3 + 4$: האלכסון קצר מהדרך לאורך הצלעות.' } },
    { kind: 'predict', text: 'ועכשיו האלכסון של התיבה $3$ על $4$ על $12$, מהקודקוד התחתון אל הקודקוד העליון הרחוק:', fig: box(3, 4, 12, { diag: 'space' }),
      choices: ['$13$', '$5$', '$19$'], answer: 0,
      why: 'משולש ישר־זווית חדש: ניצב אחד הוא אלכסון הבסיס, $5$, והשני הגובה, $12$: $\\sqrt{5^2 + 12^2} = 13$.',
      wrongWhy: { 1: '$5$ הוא אלכסון הבסיס בלבד. אלכסון התיבה עולה גם לגובה.', 2: '$3 + 4 + 12 = 19$ היא הדרך לאורך המקצועות.' } },
    { kind: 'rule', text: 'אלכסון התיבה: $d^2 = a^2 + b^2 + c^2$.', display: 'd = \\sqrt{3^2 + 4^2 + 12^2} = \\sqrt{169} = 13',
      why: 'שני שלבים של פיתגורס: קודם אלכסון הבסיס, ואז עם הגובה.', fig: box(3, 4, 12, { diag: 'tri', labels: false }) },
    { kind: 'explore', text: 'בנו תיבה שהאלכסון שלה $9$.', manip: buildD9, answer: { mode: 'build', d2: 81 },
      hint: 'צריך $a^2 + b^2 + c^2 = 81$. נסו מקצוע ארוך אחד ושניים קצרים.',
      success: 'למשל $1$, $4$, $8$: $1 + 16 + 64 = 81$, ו־$\\sqrt{81} = 9$.' },
    { kind: 'predict', text: 'אלכסון קובייה שמקצועה $2$:', fig: cube(2, { diag: 'space' }),
      choices: ['$\\sqrt{12} \\approx 3.5$', '$\\sqrt{8} \\approx 2.8$', '$6$'], answer: 0,
      why: '$\\sqrt{2^2 + 2^2 + 2^2} = \\sqrt{12}$.',
      wrongWhy: { 1: '$\\sqrt{8}$ הוא אלכסון של פאה.', 2: '$6 = 2 + 2 + 2$: הדרך לאורך המקצועות.' } },
    { kind: 'rule', text: 'בקובייה כל המקצועות שווים: $d^2 = 3a^2$.', display: 'd^2 = a^2 + a^2 + a^2 = 3a^2',
      why: 'אותה נוסחה, עם שלושה מקצועות שווים.', fig: cube(3, { diag: 'space', labels: { a: 'a' } }) },
    { kind: 'predict', text: 'בסיס התיבה $2$ על $3$, ואלכסון התיבה $7$. מה הגובה?', fig: box(2, 3, 6, { diag: 'space', labels: { a: 2, b: 3, c: '?', d: 7 } }),
      choices: ['$6$', '$2$', '$\\sqrt{62}$'], answer: 0,
      why: '$49 = 4 + 9 + c^2$, ולכן $c^2 = 36$ ו־$c = 6$.',
      wrongWhy: { 1: '$7 - 2 - 3 = 2$: מחסרים ריבועים, לא אורכים.', 2: '$\\sqrt{49 + 13}$: מחפשים מקצוע, ולכן מחסרים.' } },
  ],
  examples: [
    { problem: 'מה האלכסון של תיבה $2$ על $6$ על $9$ ס״מ?', answer: 11, check: 'sqrt(2*2+6*6+9*9)', fig: box(2, 6, 9, { diag: 'space' }),
      steps: [
        { action: 'אלכסון הבסיס בריבוע.', why: 'הבסיס הוא מלבן $2$ על $6$.', result: '2^2 + 6^2 = 40', calc: { expr: '2*2+6*6', value: 40 } },
        { action: 'ועם הגובה.', why: 'משולש ישר־זווית שעומד על אלכסון הבסיס.', result: '40 + 9^2 = 121', calc: { expr: '40+9*9', value: 121 } },
        { action: 'שורש: אלכסון התיבה בס״מ.', why: 'הריבוע של האלכסון הוא $121$.', result: 'd = \\sqrt{121} = 11', value: 'sqrt(121)' },
      ] },
    { problem: 'מה האלכסון של תיבה $4$ על $4$ על $7$ ס״מ?', answer: 9, check: 'sqrt(4*4+4*4+7*7)', fig: box(4, 4, 7, { diag: 'space' }),
      steps: [
        { action: 'סכום הריבועים של שלושת המקצועות.', why: '$d^2 = a^2 + b^2 + c^2$.', result: '4^2 + 4^2 + 7^2 = 81', calc: { expr: '16+16+49', value: 81 } },
        { action: 'שורש: אלכסון התיבה בס״מ.', why: 'המספר שבריבוע נותן $81$.', result: 'd = \\sqrt{81} = 9', value: 'sqrt(81)' },
      ] },
    { problem: 'האלכסון של תיבה $15$ ס״מ, ושני מקצועותיה $2$ ו־$10$ ס״מ. מה המקצוע השלישי?', answer: 11, check: 'sqrt(15*15-2*2-10*10)',
      fig: box(2, 10, 11, { diag: 'space', labels: { a: 2, b: 10, c: '?', d: 15 } }),
      steps: [
        { action: 'מחסרים מריבוע האלכסון את ריבועי שני המקצועות.', why: 'מחפשים מקצוע, ניצב: מחסרים.', result: 'c^2 = 15^2 - 2^2 - 10^2 = 121', calc: { expr: '225-4-100', value: 121 } },
        { action: 'שורש: המקצוע בס״מ.', why: 'המספר שבריבוע נותן $121$.', result: 'c = \\sqrt{121} = 11', value: 'sqrt(121)' },
      ] },
  ],
  together: [
    { problem: 'ארגז $60$ על $20$ ס״מ בבסיסו, וגובהו $90$ ס״מ. מה המוט הארוך ביותר שנכנס בו?', fig: box(60, 20, 90, { diag: 'space' }),
      steps: [
        { prompt: 'קודם:', choices: [
          { text: 'אלכסון הבסיס בריבוע: $60^2 + 20^2 = 4000$', ok: true, feedback: 'נכון: הבסיס הוא מלבן, והאלכסון שלו יתר.' },
          { text: '$60 + 20 = 80$', ok: false, feedback: 'אלכסון מחשבים בפיתגורס, לא בחיבור.' },
        ], hints: ['המוט עובר מפינה לפינה הרחוקה. מה הצעד הראשון?', 'הבסיס הוא מלבן: האלכסון שלו בפיתגורס.'], done: 'אלכסון הבסיס בריבוע: $4000$. עכשיו עם הגובה.' },
      ],
      final: { prompt: 'כמה ס״מ אורך המוט?', answer: 110, check: 'sqrt(60*60+20*20+90*90)', hints: ['$4000 + 90^2 = 12100$.', '$\\sqrt{12100}$.'] } },
    { problem: 'קובייה שמקצועה $4$ ס״מ. מה אורך האלכסון שלה? עגלו לעשירית.', fig: cube(4, { diag: 'space' }),
      steps: [
        { prompt: 'אלכסון בריבוע:', choices: [
          { text: '$48$', ok: true, feedback: 'נכון: $4^2 + 4^2 + 4^2 = 48$.' },
          { text: '$32$', ok: false, feedback: '$32$ הוא אלכסון של פאה בריבוע. בתיבה שלושה מקצועות.' },
        ], hints: ['שלושה מקצועות, כל אחד בריבוע.', '$16 + 16 + 16$.'], done: 'האלכסון בריבוע $48$.' },
      ],
      final: { prompt: 'אורך האלכסון בס״מ, בעיגול לעשירית:', answer: 6.9, check: 'round(sqrt(48)*10)/10', fmt: 'dec', hints: ['$\\sqrt{48}$: בין $6$ ל־$7$.', '$6.9^2 = 47.61$, קרוב ל־$48$.'] } },
  ],
  diag: space1,
  transfer: space1T,
  misconceptions: [
    { id: 'face-for-space', title: 'חישבו את אלכסון הפאה במקום את אלכסון התיבה',
      cause: 'אלכסון הבסיס הוא האלכסון שרואים, והוא נראה "האלכסון".',
      explain: ['אלכסון התיבה עולה גם לגובה: הוא עובר דרך הפנים.', 'אחרי אלכסון הבסיס יש עוד שלב: משולש עם הגובה.'],
      remedy: [
        { kind: 'predict', text: 'האלכסון של התיבה $3$ על $4$ על $12$, מהקודקוד התחתון אל הקודקוד העליון הרחוק:', fig: box(3, 4, 12, { diag: ['face', 'space'] }), choices: ['$13$', '$5$'], answer: 0,
          why: 'אלכסון הבסיס $5$ והגובה $12$: $\\sqrt{25 + 144} = 13$.', wrongWhy: { 1: '$5$ הוא אלכסון הבסיס בלבד.' } },
        { kind: 'predict', text: 'מה האלכסון של תיבה $2$ על $3$ על $6$?', fig: box(2, 3, 6, { diag: 'space' }), choices: ['$7$', '$3.6$'], answer: 0,
          why: '$\\sqrt{4 + 9 + 36} = \\sqrt{49} = 7$.', wrongWhy: { 1: '$3.6 \\approx \\sqrt{13}$ הוא אלכסון הבסיס. חסר הגובה.' } },
      ] },
    { id: 'add-edges3', title: 'חיברו את שלושת המקצועות במקום פיתגורס',
      cause: 'האלכסון מחבר שתי פינות, ונדמה שזה כמו ללכת לאורך המקצועות.',
      explain: ['קו ישר קצר מהדרך לאורך המקצועות.', 'מחברים ריבועים, ואז שורש.'],
      remedy: [
        { kind: 'predict', text: 'מה האלכסון של תיבה $2$ על $3$ על $6$?', fig: box(2, 3, 6, { diag: 'space' }), choices: ['$7$', '$11$'], answer: 0,
          why: '$\\sqrt{2^2 + 3^2 + 6^2} = \\sqrt{49} = 7$.', wrongWhy: { 1: '$11 = 2 + 3 + 6$ היא הדרך לאורך המקצועות.' } },
      ] },
    { id: 'no-root', title: 'שכחו להוציא שורש',
      cause: 'אחרי חיבור הריבועים יש מספר, ונדמה שזו התשובה.',
      explain: ['סכום הריבועים הוא האלכסון בריבוע.', 'האלכסון עצמו הוא השורש.'],
      remedy: [
        { kind: 'predict', text: 'מה האלכסון של תיבה $2$ על $3$ על $6$?', fig: box(2, 3, 6, { diag: 'space' }), choices: ['$7$', '$49$'], answer: 0,
          why: '$4 + 9 + 36 = 49$, והאלכסון $\\sqrt{49} = 7$.', wrongWhy: { 1: '$49$ הוא האלכסון בריבוע. חסר השורש.' } },
      ] },
    { id: 'add-not-sub', title: 'חיברו ריבועים במקום לחסר (כשמחפשים ניצב)',
      cause: 'זוכרים "מחברים ריבועים", גם כשהאלכסון כבר נתון.',
      explain: ['האלכסון הוא הצלע הארוכה.', 'מחפשים מקצוע: מחסרים מריבוע האלכסון.'],
      remedy: [
        { kind: 'predict', text: 'בסיס התיבה $2$ על $3$, ואלכסון התיבה $7$. מה הגובה?', fig: box(2, 3, 6, { diag: 'space', labels: { a: 2, b: 3, c: '?', d: 7 } }), choices: ['$6$', '$\\sqrt{62}$'], answer: 0,
          why: '$49 - 4 - 9 = 36$, ו־$\\sqrt{36} = 6$.', wrongWhy: { 1: '$\\sqrt{49 + 13}$ ארוך מהאלכסון. מקצוע קצר מהאלכסון: מחסרים.' } },
      ] },
    { id: 'add-legs', title: 'חיברו את הצלעות בלי לרבע',
      cause: 'האלכסון של הבסיס מחבר שתי צלעות, ונדמה שמחברים אותן.',
      explain: ['אלכסון של מלבן הוא יתר של משולש ישר־זווית.', 'מחברים את הריבועים של הצלעות, ואז שורש.'],
      remedy: [
        { kind: 'predict', text: 'תיבה $3$ על $4$ על $12$. מה אורך האלכסון של הבסיס, $3$ על $4$?', fig: box(3, 4, 12, { diag: 'face' }), choices: ['$5$', '$7$'], answer: 0,
          why: '$\\sqrt{9 + 16} = 5$.', wrongWhy: { 1: '$7 = 3 + 4$: קו ישר קצר מהדרך לאורך הצלעות.' } },
      ] },
  ],
  words: ['אלכסון פאה', 'אלכסון התיבה', 'אלכסון הקובייה', '$d^2 = a^2 + b^2 + c^2$'],
};

// ================================================================ stair 2: right triangles inside solids

const stair2: StairContent = {
  skill: 'space:2', topic: 'space', level: 2, title: 'משולשים ישרי־זווית בגופים',
  objectives: [
    'למצוא משולש ישר־זווית בתוך גוף: בתיבה, במנסרה, ובחתך הצירי של גליל ושל חרוט.',
    'לחשב את המקל הארוך ביותר בגליל, ואורך או שטח של משולש בתוך תיבה.',
    'להשתמש בצלע שמצאו בחישוב של שטח או נפח.',
  ],
  idea: 'בכל גוף מחפשים משולש ישר־זווית ששתי צלעות שלו ידועות: בתיבה המשולש שעומד על אלכסון הבסיס, בגליל המלבן שבחתך, ובחרוט חצי החתך.',
  why: [
    'החתך הצירי של גליל הוא מלבן: רוחבו הקוטר, $2r$, וגובהו $h$. האלכסון שלו הוא המקל הארוך ביותר.',
    'בתיבה המקצוע האנכי ניצב לבסיס, ולכן הוא ניצב גם לאלכסון הבסיס: אלכסון הבסיס, המקצוע ואלכסון התיבה הם משולש ישר־זווית.',
    'בחרוט הגובה ניצב לבסיס, ולכן הרדיוס, הגובה והקו היוצר הם משולש ישר־זווית.',
  ],
  alt: ['קשית בכוס: הקשית הארוכה ביותר שנעלמת בכוס היא האלכסון של החתך.'],
  discover: [
    { kind: 'say', text: 'בגליל, החתך הצירי הוא מלבן: רוחבו הקוטר, וגובהו גובה הגליל.', fig: cyl(3, 8, { diag: 'rod', labels: false }) },
    { kind: 'predict', text: 'גליל שרדיוסו $3$ וגובהו $8$. מה אורך המקל הארוך ביותר שנכנס בו?', fig: cyl(3, 8, { diag: 'rod' }),
      choices: ['$10$', '$8.5$', '$14$'], answer: 0,
      why: 'האלכסון של המלבן $6$ על $8$: $\\sqrt{6^2 + 8^2} = 10$.',
      wrongWhy: { 1: '$\\sqrt{3^2 + 8^2} \\approx 8.5$: רוחב המלבן הוא הקוטר, $6$, לא הרדיוס.', 2: '$6 + 8$: הקו הישר קצר מהדרך לאורך הצלעות.' } },
    { kind: 'rule', text: 'המקל הארוך ביותר בגליל: $\\sqrt{d^2 + h^2}$.', display: '\\sqrt{(2r)^2 + h^2}',
      why: 'זה האלכסון של החתך הצירי.', fig: sectionRod },
    { kind: 'say', text: 'בתיבה $3$ על $4$ על $6$, אלכסון הבסיס, המקצוע האנכי שבקצה שלו ואלכסון התיבה יוצרים משולש ישר־זווית. הזווית הישרה היא בין אלכסון הבסיס למקצוע.',
      fig: box(3, 4, 6, { diag: 'tri' }) },
    { kind: 'predict', text: 'באותה תיבה, $3$ על $4$ על $6$: מה שטח המשולש?', fig: box(3, 4, 6, { diag: 'tri' }),
      choices: ['$15$', '$21$', '$30$'], answer: 0,
      why: 'אלכסון הבסיס $\\sqrt{3^2 + 4^2} = 5$, והמשולש $\\frac{5 \\cdot 6}{2} = 15$.',
      wrongWhy: { 1: '$21 = \\frac{(3 + 4) \\cdot 6}{2}$: אלכסון הבסיס אינו $3 + 4$. מחשבים אותו בפיתגורס.', 2: '$30$: שכחתם לחלק ב־$2$.' } },
    { kind: 'predict', text: 'לחרוט רדיוס $7$ וקו יוצר $25$. בחצי החתך הצירי, מה הגובה?', fig: halfCone(7, 24, 25),
      choices: ['$24$', '$18$', '$\\sqrt{674}$'], answer: 0,
      why: '$\\sqrt{25^2 - 7^2} = \\sqrt{576} = 24$.',
      wrongWhy: { 1: '$25 - 7$: מחסרים ריבועים.', 2: '$\\sqrt{25^2 + 7^2}$: מחפשים ניצב, ולכן מחסרים.' } },
    { kind: 'rule', text: 'בגוף: מוצאים משולש ישר־זווית, מחשבים בו את הצלע החסרה, ואחר כך משתמשים בה.',
      display: '\\ell = 15,\\ r = 9 \\Rightarrow h = 12 \\Rightarrow V = \\frac{\\pi \\cdot 9^2 \\cdot 12}{3} = 324\\pi',
      why: 'הנפח צריך גובה, ולכן קודם פיתגורס.', fig: cone(9, 12, 15, { labels: { r: 9, l: 15, h: '?' } }) },
    { kind: 'predict', text: 'מנסרה שבסיסה משולש ישר־זווית עם ניצבים $9$ ו־$12$, ואורכה $20$. שטח הפאה שעל היתר:', fig: prism(9, 12, 20),
      choices: ['$300$', '$420$', '$240$'], answer: 0,
      why: 'היתר $\\sqrt{81 + 144} = 15$, והפאה $15 \\cdot 20 = 300$.',
      wrongWhy: { 1: '$420 = (9 + 12) \\cdot 20$: היתר אינו סכום הניצבים.', 2: '$240$ היא הפאה שעל הניצב $12$.' } },
  ],
  examples: [
    { problem: 'גליל שרדיוסו $4$ ס״מ וגובהו $6$ ס״מ. מה המקל הארוך ביותר שנכנס בו?', answer: 10, check: 'sqrt(8*8+6*6)', fig: cyl(4, 6, { diag: 'rod' }),
      steps: [
        { action: 'הקוטר: רוחב החתך הצירי.', why: 'החתך עובר דרך המרכז, משפה לשפה.', result: 'd = 2 \\cdot 4 = 8', calc: { expr: '2*4', value: 8 } },
        { action: 'האלכסון של המלבן בריבוע.', why: 'המקל הוא האלכסון של החתך.', result: '8^2 + 6^2 = 100', calc: { expr: '8*8+6*6', value: 100 } },
        { action: 'שורש: אורך המקל בס״מ.', why: 'המספר שבריבוע נותן $100$.', result: '\\sqrt{100} = 10', value: 'sqrt(100)' },
      ] },
    { problem: 'לחרוט רדיוס $12$ ס״מ וקו יוצר $20$ ס״מ. מה נפחו, בעזרת $\\pi$?', answer: 768, check: '12*12*16/3', after: PI, fig: cone(12, 16, 20, { labels: { r: 12, l: 20, h: '?' } }),
      steps: [
        { action: 'הגובה בריבוע.', why: 'בחצי החתך: הקו היוצר הוא היתר.', result: 'h^2 = 20^2 - 12^2 = 256', calc: { expr: '20*20-12*12', value: 256 } },
        { action: 'הגובה.', why: 'המספר שבריבוע נותן $256$.', result: 'h = \\sqrt{256} = 16', calc: { expr: 'sqrt(256)', value: 16 } },
        { action: 'הנפח: שליש מהגליל, בסמ״ק.', why: 'עכשיו יש גובה.', result: 'V = \\frac{\\pi \\cdot 12^2 \\cdot 16}{3} = 768\\pi', value: '12*12*16/3' },
      ] },
    { problem: 'מנסרה: בסיס משולש ישר־זווית עם ניצבים $8$ ו־$15$ ס״מ, אורך $10$ ס״מ. מה שטח הפאה שעל היתר?', answer: 170, check: '17*10', fig: prism(8, 15, 10),
      steps: [
        { action: 'היתר בריבוע.', why: 'בבסיס יש משולש ישר־זווית.', result: '8^2 + 15^2 = 289', calc: { expr: '8*8+15*15', value: 289 } },
        { action: 'היתר.', why: 'המספר שבריבוע נותן $289$.', result: '\\sqrt{289} = 17', calc: { expr: 'sqrt(289)', value: 17 } },
        { action: 'הפאה: היתר על אורך המנסרה, בסמ״ר.', why: 'הפאה שעל היתר היא מלבן.', result: '17 \\cdot 10 = 170', value: '17*10' },
      ] },
  ],
  together: [
    { problem: 'קלמר גלילי: קוטר $5$ ס״מ, גובה $12$ ס״מ. מה העיפרון הארוך ביותר שנכנס בו?', fig: cyl(2.5, 12, { diag: 'rod', labels: { r: '', h: 12 }, label: 'קוטר 5' }),
      steps: [
        { prompt: 'רוחב המלבן שבחתך:', choices: [
          { text: '$5$, הקוטר', ok: true, feedback: 'נכון: החתך עובר דרך כל הקוטר.' },
          { text: '$2.5$', ok: false, feedback: '$2.5$ הוא הרדיוס. החתך עובר דרך כל הקוטר.' },
        ], hints: ['החתך הצירי עובר דרך מרכז הבסיס.', 'משפה לשפה דרך המרכז: הקוטר.'], done: 'החתך מלבן $5$ על $12$, והעיפרון הוא האלכסון שלו.' },
      ],
      final: { prompt: 'כמה ס״מ אורך העיפרון?', answer: 13, check: 'sqrt(5*5+12*12)', hints: ['$5^2 + 12^2 = 169$.', '$\\sqrt{169}$.'] } },
    { problem: 'קופסה $5$ על $12$ ס״מ בבסיסה, וגובהה $4$ ס״מ. מה שטח המשולש שיוצרים אלכסון הבסיס, המקצוע האנכי שבקצה שלו ואלכסון הקופסה?',
      fig: box(5, 12, 4, { diag: 'tri' }),
      steps: [
        { prompt: 'אלכסון הבסיס:', choices: [
          { text: '$13$', ok: true, feedback: 'נכון: $\\sqrt{25 + 144} = 13$.' },
          { text: '$17$', ok: false, feedback: '$5 + 12$: אלכסון מחשבים בפיתגורס, $\\sqrt{25 + 144}$.' },
        ], hints: ['הבסיס הוא מלבן $5$ על $12$.', '$\\sqrt{5^2 + 12^2}$.'], done: 'אלכסון הבסיס $13$.' },
        { prompt: 'הזווית הישרה היא בין:', choices: [
          { text: 'אלכסון הבסיס למקצוע האנכי', ok: true, feedback: 'נכון: המקצוע ניצב לבסיס, ולכן לכל קו בבסיס.' },
          { text: 'אלכסון הבסיס לאלכסון הקופסה', ok: false, feedback: 'המקצוע ניצב לבסיס, ולכן הזווית הישרה צמודה אליו.' },
        ], hints: ['איזו צלע ניצבת לבסיס?', 'המקצוע האנכי.'], done: 'הניצבים: $13$ ו־$4$.' },
      ],
      final: { prompt: 'מה השטח בסמ״ר?', answer: 26, check: '13*4/2', hints: ['הניצבים: $13$ ו־$4$.', '$\\frac{13 \\cdot 4}{2}$.'] } },
  ],
  diag: space2,
  transfer: space2T,
  misconceptions: [
    { id: 'r-for-d', title: 'השתמשו ברדיוס במקום בקוטר כצלע של החתך',
      cause: 'הרדיוס כתוב בשאלה ובשרטוט, ולוקחים אותו לרוחב החתך.',
      explain: ['החתך הצירי עובר דרך המרכז, משפה לשפה.', 'לכן רוחבו הקוטר, שני רדיוסים.'],
      remedy: [
        { kind: 'predict', text: 'גליל שרדיוסו $3$ וגובהו $8$. מה אורך המקל הארוך ביותר שנכנס בו?', fig: cyl(3, 8, { diag: 'rod' }), choices: ['$10$', '$8.5$'], answer: 0,
          why: 'הקוטר $6$: $\\sqrt{6^2 + 8^2} = 10$.', wrongWhy: { 1: '$\\sqrt{3^2 + 8^2} \\approx 8.5$: רוחב החתך הוא הקוטר, לא הרדיוס.' } },
      ] },
    { id: 'add-legs', title: 'חיברו את הצלעות בלי לרבע',
      cause: 'האלכסון מחבר שתי צלעות, ונדמה שמחברים אותן.',
      explain: ['קו ישר קצר מהדרך לאורך הצלעות.', 'מחברים ריבועים, ואז שורש.'],
      remedy: [
        { kind: 'predict', text: 'גליל שרדיוסו $3$ וגובהו $8$. מה אורך המקל הארוך ביותר שנכנס בו?', fig: cyl(3, 8, { diag: 'rod' }), choices: ['$10$', '$14$'], answer: 0,
          why: '$\\sqrt{6^2 + 8^2} = 10$.', wrongWhy: { 1: '$14 = 6 + 8$: הדרך לאורך הצלעות ארוכה מהקו הישר.' } },
      ] },
    { id: 'no-half', title: 'שכחו לחלק ב־2 בשטח המשולש',
      cause: 'המשולש בתוך התיבה נראה כמו פאה, ופאה היא מלבן.',
      explain: ['המשולש הוא חצי מהמלבן שאלכסון הבסיס והמקצוע יוצרים.', 'לכן ניצב כפול ניצב, חלקי $2$.'],
      remedy: [
        { kind: 'predict', text: 'בתיבה $6$ על $8$ על $5$, אלכסון הבסיס, המקצוע האנכי שבקצה שלו ואלכסון התיבה יוצרים משולש. מה שטחו?', fig: box(6, 8, 5, { diag: 'tri' }), choices: ['$25$', '$50$'], answer: 0,
          why: 'אלכסון הבסיס $10$: $\\frac{10 \\cdot 5}{2} = 25$.', wrongWhy: { 1: '$50 = 10 \\cdot 5$ הוא המלבן כולו. המשולש חצי ממנו.' } },
      ] },
    { id: 'slant-as-height', title: 'השתמשו בקו היוצר במקום בגובה',
      cause: 'הקו היוצר הוא הקו שרואים בצד, והגובה מוסתר בפנים.',
      explain: ['בנוסחת הנפח יש גובה, ניצב לבסיס.', 'את הגובה מוצאים קודם, בחצי החתך הצירי.'],
      remedy: [
        { kind: 'predict', text: 'לחרוט רדיוס $6$ וקו יוצר $10$. מה נפחו, בעזרת $\\pi$?', fig: cone(6, 8, 10, { labels: { r: 6, l: 10, h: '?' } }), choices: ['$96\\pi$', '$120\\pi$'], answer: 0,
          why: 'הגובה $\\sqrt{100 - 36} = 8$, והנפח $\\frac{\\pi \\cdot 36 \\cdot 8}{3} = 96\\pi$.', wrongWhy: { 1: '$120\\pi$: כפלתם בקו היוצר $10$ במקום בגובה $8$.' } },
      ] },
    { id: 'no-third', title: 'שכחו לחלק ב־$3$',
      cause: 'נפח של "גוף ישר" הוא בסיס כפול גובה, ושוכחים שהחרוט מתחדד.',
      explain: ['החרוט הוא שליש מהגליל שיש לו אותו בסיס ואותו גובה.', 'לכן מחלקים ב־$3$.'],
      remedy: [
        { kind: 'predict', text: 'לחרוט רדיוס $3$ וקו יוצר $5$. מה נפחו, בעזרת $\\pi$?', fig: cone(3, 4, 5, { labels: { r: 3, l: 5, h: '?' } }), choices: ['$12\\pi$', '$36\\pi$'], answer: 0,
          why: 'הגובה $4$, והנפח $\\frac{\\pi \\cdot 9 \\cdot 4}{3} = 12\\pi$.', wrongWhy: { 1: '$36\\pi$ הוא הגליל. החרוט שליש ממנו.' } },
      ] },
  ],
  words: ['חתך צירי', 'המקל הארוך ביותר', 'משולש בתוך תיבה', 'קו יוצר'],
};

export const SPACE: StairContent[] = [stair1, stair2];

/** The misconception names this topic adds to its practice's (content/space.js cats names them all). */
export const CATS_SPACE: Record<string, string> = {};
