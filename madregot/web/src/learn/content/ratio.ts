// Ratio, proportion and scale (יחס, פרופורציה וקנה מידה): the first unit of grade 8 (ח׳), September to October in the
// Ministry's תשפ״ז schedule (curriculum stage 1, CURRICULUM-5). Four stairs: a ratio, sharing in a ratio, proportion,
// and scale. Percent, slope, similarity and probability all lean on it.
//
// One picture carries the unit: a ratio compares two amounts in the order the question names them, and it is kept by
// multiplying, never by adding. m : n is m + n equal parts (the fraction bar); a proportion is found through one unit or
// "פי כמה", read on a double number line; a scale 1 : S has both sides in the same unit, then converts; and areas grow
// by the scale squared (a 1 by 1 square inside a 3 by 3 one). The additive error is named and shown wrong at every stair.
// The diagnostic models are the plan's (content/ratio.js RATIO1 to RATIO4T, ported unchanged); every misconception's
// source is listed in content/ratio.js. The numbers and situations of the Ministry's examples (the scouts, 56 marbles,
// the partners, the rectangle, the pitcher, the pastry, the cereals, the museum earth) are used; the sentences are the
// app's own. Every number written here is checked by the lane's verify/facts-ratio.mjs, and the maths of every step by
// learn/content.test.ts.
import type { DiagModel, FigSpec, StairContent, ManipSpec, DlineLine, FractionFig } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/ratio.js';

// ---------------------------------------------------------------- figures

const groups = (rows: { n: number; label: string }[]): FigSpec => ({ type: 'groups', rows } satisfies FractionFig);
const bar = (den: number, shaded: number, extra: Record<string, unknown> = {}): FigSpec => ({ type: 'fbar', den, shaded, ...extra } satisfies FractionFig);
const dl = (top: DlineLine, bottom: DlineLine, extra: { at?: number; show?: 'both' | 'top' | 'bottom'; label?: string } = {}): FigSpec => ({ type: 'dline', top, bottom, ...extra } satisfies FractionFig);
const grid = (rows: number, cols: number, shadeRows: number, shadeCols: number, label?: string): FigSpec => ({ type: 'fgrid', rows, cols, shadeRows, shadeCols, ...(label ? { label } : {}) } satisfies FractionFig);
const table = (head: string[], rows: (string | number)[][]): FigSpec => ({ type: 'table', head, rows });
const dline = (top: DlineLine, bottom: DlineLine, start = 0): ManipSpec => ({ kind: 'dline', top, bottom, move: 't', start: { t: start } });

/** The scouts: 2 instructors and 10 scouts. */
const scouts = groups([{ n: 2, label: 'מדריכים' }, { n: 10, label: 'חניכים' }]);
/** Two right triangles: legs 6 and 8, and the same legs each 2 longer (8 and 10). */
const twoTriangles = (label: string): FigSpec => ({
  type: 'geo', label,
  pts: { _A: [0, 0], _B: [8, 0], _C: [0, 6], _D: [11, 0], _E: [21, 0], _F: [11, 8] },
  polys: [{ pts: ['_A', '_B', '_C'] }, { pts: ['_D', '_E', '_F'] }],
  segs: [{ a: '_A', b: '_C', label: '6' }, { a: '_A', b: '_B', label: '8' }, { a: '_C', b: '_B' }, { a: '_D', b: '_F', label: '8' }, { a: '_D', b: '_E', label: '10' }, { a: '_F', b: '_E' }],
  angles: [{ at: '_A', from: '_B', to: '_C', right: true }, { at: '_D', from: '_E', to: '_F', right: true }],
  view: [320, 170], pad: [26, 24],
});
/** A rectangle with its sides 5x long and 3x wide; `all` labels all four. */
const rectFig = (all: boolean): FigSpec => ({
  type: 'geo', label: all ? 'מלבן: צלעות 5x, 3x, 5x ו־3x' : 'מלבן שצלעותיו 5x ו־3x',
  pts: { _A: [0, 0], _B: [5, 0], _C: [5, 3], _D: [0, 3] },
  polys: [{ pts: ['_A', '_B', '_C', '_D'] }],
  segs: [{ a: '_A', b: '_B', label: '5x' }, { a: '_B', b: '_C', label: '3x' }, { a: '_C', b: '_D', ...(all ? { label: '5x' } : {}) }, { a: '_D', b: '_A', ...(all ? { label: '3x' } : {}) }],
  view: [300, 200], pad: [34, 30],
});
const water = (max: number): DlineLine => ({ max, step: 1, label: 'מים (כוסות)' });
const sugar = (max: number): DlineLine => ({ max, step: 0.25, label: 'סוכר (כוסות)', every: 4 });
const mapCm = (max: number): DlineLine => ({ max, step: 1, unit: 'ס״מ', label: 'במפה (ס״מ)' });
const realKm = (max: number): DlineLine => ({ max, step: 0.5, unit: 'ק״מ', label: 'במציאות (ק״מ)', every: 2 });
const cereals = (quotients: boolean): FigSpec => table(
  ['דגנים', 'משקל (גרם)', 'קלוריות', ...(quotients ? ['קלוריות לגרם'] : [])],
  [['א', 375, 390, ...(quotients ? [1.04] : [])], ['ב', 500, 540, ...(quotients ? [1.08] : [])], ['ג', 625, 675, ...(quotients ? [1.08] : [])]],
);

// ================================================================ stair 1: a ratio

type P1 = { a: number; b: number; g: number; p: number };
const ratio1: DiagModel<P1> = {
  params: (rnd) => G.RATIO1.params(rnd),
  text: (p) => G.ratio1Text(p),
  answer: (p) => G.RATIO1.answer(p),
  bugs: G.RATIO1.bugs,
  solution: (p) => G.ratio1Solution(p),
  hint: () => G.ratio1Hint(),
};
const ratio1T: DiagModel<P1> = {
  params: (rnd) => G.RATIO1T.params(rnd),
  text: (p) => G.ratio1Text(p, true),
  answer: (p) => G.RATIO1T.answer(p),
  bugs: G.RATIO1T.bugs,
  solution: (p) => G.ratio1Solution(p),
  hint: () => G.ratio1Hint(),
};

const stair1: StairContent = {
  skill: 'ratio:1', topic: 'ratio', level: 1, title: 'יחס',
  objectives: [
    'לכתוב יחס בין שתי כמויות בסדר שבשאלה.',
    'לצמצם ולהרחיב יחס.',
    'להבחין בין יחס של חלק לחלק לבין חלק מתוך השלם.',
  ],
  idea: 'יחס משווה שתי כמויות: "על כל $2$ מדריכים יש $10$ חניכים". הסדר חשוב, וצמצום לא משנה את היחס.',
  why: [
    '$2 : 10$ ו־$1 : 5$ אומרים אותו דבר: על כל מדריך $5$ חניכים.',
    'הוספה של אותו מספר לשתי הכמויות משנה את היחס: $6 : 8$ הוא $3 : 4$, אבל $8 : 10$ הוא $4 : 5$.',
  ],
  alt: ['יחס הוא גם מנה: $10 : 2 = 5$, כלומר יש פי $5$ חניכים ממדריכים.'],
  discover: [
    { kind: 'say', text: 'בשבט צופים יש $2$ מדריכים לכל $10$ חניכים. כותבים את זה כיחס: $2 : 10$.', fig: scouts },
    { kind: 'predict', text: 'מה היחס בין מספר החניכים למספר המדריכים?', fig: scouts,
      choices: ['$10 : 2$', '$2 : 10$', '$10 : 12$'], answer: 0,
      why: 'קודם החניכים, אחר כך המדריכים: "עשר לשתיים".',
      wrongWhy: { 1: 'זה היחס בין המדריכים לחניכים, בסדר ההפוך.', 2: '$12$ הם כולם יחד. היחס הוא בין שתי הקבוצות.' } },
    { kind: 'rule', text: 'יחס נקרא משמאל לימין, באותו סדר שבשאלה.', display: '10 : 2',
      why: 'הסדר אומר מי מושווה למי: $10 : 2$ ו־$2 : 10$ הם יחסים שונים.',
      fig: groups([{ n: 10, label: 'א. חניכים' }, { n: 2, label: 'ב. מדריכים' }]) },
    { kind: 'predict', text: 'מה היחס $10 : 2$ אחרי צמצום?',
      fig: groups([{ n: 1, label: 'מדריך' }, { n: 5, label: 'חניכים' }, { n: 1, label: 'מדריך' }, { n: 5, label: 'חניכים' }]),
      choices: ['$5 : 1$', '$8 : 0$', '$1 : 5$'], answer: 0,
      why: 'מחלקים את שני המספרים ב־$2$, כמו בצמצום שבר.',
      wrongWhy: { 1: 'חיסור משנה את היחס. מחלקים את שניהם באותו מספר.', 2: '$1 : 5$ הוא מדריכים לחניכים, בסדר ההפוך.' } },
    { kind: 'explore', text: 'במחרוזת $15$ חרוזים. צבעו אדומים כך שהיחס בין האדומים לכחולים יהיה $2 : 3$.',
      manip: { kind: 'fbar', start: { den: 15, shaded: 0 }, lockDen: true }, answer: { mode: 'value', value: 0.4 },
      hint: '$2 : 3$: מכל $5$ חרוזים, $2$ אדומים. ב־$15$ יש שלוש קבוצות של $5$.',
      success: '$6$ אדומים ו־$9$ כחולים: $6 : 9 = 2 : 3$.' },
    { kind: 'predict', text: '$6$ אדומים ו־$9$ כחולים. איזה חלק מכל החרוזים אדומים?', fig: bar(15, 6),
      choices: ['$\\frac{2}{5}$', '$\\frac{2}{3}$'], answer: 0,
      why: '$2 : 3$ הוא יחס בין אדומים לכחולים. מתוך כל החרוזים, האדומים $2$ מכל $5$: $\\frac{6}{15} = \\frac{2}{5}$.',
      wrongWhy: { 1: '$\\frac{2}{3}$ משווה את האדומים לכחולים, לא לכל החרוזים.' } },
    { kind: 'predict', text: 'ניצבים $6$ ו־$8$. מאריכים כל ניצב ב־$2$. היחס בין הניצבים משתנה?', fig: twoTriangles('שני משולשים ישרי־זווית: ניצבים 6 ו־8, וניצבים 8 ו־10'),
      choices: ['כן: $3 : 4$ הופך ל־$4 : 5$', 'לא'], answer: 0,
      why: '$6 : 8 = 3 : 4$, אבל $8 : 10 = 4 : 5$. הוספה לא שומרת על היחס.',
      wrongWhy: { 1: 'הוספנו לשניהם אותו דבר, אבל היחס עבר מ־$3 : 4$ ל־$4 : 5$.' } },
    { kind: 'rule', text: 'מותר לכפול או לחלק את שני חלקי היחס באותו מספר. הוספה משנה את היחס.',
      why: 'כפל שומר על "פי כמה", הוספה רק על ההפרש.', fig: twoTriangles('ניצבים 6 ו־8 (יחס 3 : 4), וניצבים 8 ו־10 (יחס 4 : 5)') },
  ],
  examples: [
    { problem: 'בכיתה $12$ בנות ו־$18$ בנים. השלימו: היחס בין הבנות לבנים הוא $2 : \\square$.', answer: 3, check: '18/6',
      steps: [
        { action: 'כותבים את היחס בסדר שבשאלה.', why: 'השאלה מתחילה בבנות, ולכן $12$ ראשון.', result: '12 : 18' },
        { action: 'מחפשים את המחלק המשותף הגדול.', why: 'גם $12$ וגם $18$ מתחלקים ב־$6$, ואין מספר גדול יותר שמחלק את שניהם.', result: '12 : 6 = 2', calc: { expr: '12/6', value: 2 } },
        { action: 'מחלקים גם את מספר הבנים ב־$6$.', why: 'בצמצום מחלקים את שני חלקי היחס באותו מספר.', result: '18 : 6 = 3', value: '18/6' },
      ] },
    { problem: 'מלבן באורך $20$ ס״מ וברוחב $8$ ס״מ. פי כמה האורך גדול מהרוחב?', answer: 2.5, check: '20/8',
      steps: [
        { action: 'כותבים את היחס בין האורך לרוחב, ומצמצמים ב־$4$.', why: 'גם $20$ וגם $8$ מתחלקים ב־$4$.', result: '20 : 4 = 5', calc: { expr: '20/4', value: 5 } },
        { action: 'מצמצמים גם את הרוחב.', why: 'את שני חלקי היחס מחלקים באותו מספר.', result: '8 : 4 = 2', calc: { expr: '8/4', value: 2 } },
        { action: 'קוראים את היחס כמנה.', why: 'יחס הוא גם מנה: פי כמה החלק הראשון גדול מהשני.', result: '20 : 8 = 5 : 2 = 2.5', value: '5/2' },
      ] },
  ],
  together: [
    { problem: 'בשבט $2$ מדריכים ו־$10$ חניכים. השלימו: היחס בין החניכים למדריכים הוא $\\square : 1$.', fig: scouts,
      steps: [
        { prompt: 'באיזה סדר כותבים?', choices: [
          { text: 'חניכים קודם: $10 : 2$', ok: true, feedback: 'נכון: השאלה מתחילה בחניכים.' },
          { text: '$2 : 10$', ok: false, feedback: 'השאלה מתחילה בחניכים, ולכן הם ראשונים.' },
        ], hints: ['מי מופיע ראשון בשאלה?', 'השאלה: "היחס בין החניכים למדריכים".'], done: 'היחס $10 : 2$.' },
      ],
      final: { prompt: 'מה המספר החסר?', answer: 5, check: '10/2', hints: ['מחלקים את שני המספרים ב־$2$.', '$10 : 2$.'] } },
    { problem: 'בקופסה $9$ כדורים אדומים ו־$15$ כחולים. השלימו: היחס בין האדומים לכחולים הוא $3 : \\square$.',
      steps: [
        { prompt: 'מה עושים עם שני המספרים?', choices: [
          { text: 'מחלקים את שניהם ב־$3$', ok: true, feedback: 'נכון: $9 : 3 = 3$, וגם $15$ מתחלק ב־$3$.' },
          { text: 'מחסירים $6$ משניהם', ok: false, feedback: 'חיסור משנה את היחס. מחלקים את שניהם באותו מספר.' },
          { text: 'מחלקים את שניהם ב־$9$', ok: false, feedback: '$15$ לא מתחלק ב־$9$, ובצד שמאל צריך לקבל $3$.' },
        ], hints: ['איך הופכים את $9$ ל־$3$?', 'מחלקים ב־$3$, את שני המספרים.'], done: 'מחלקים את שניהם ב־$3$.' },
      ],
      final: { prompt: 'מה המספר החסר?', answer: 5, check: '15/3', hints: ['גם $15$ מחלקים ב־$3$.', '$15 : 3$.'] } },
  ],
  diag: ratio1,
  transfer: ratio1T,
  words: ['יחס', 'יחס מצומצם', '"a ל־b"', 'פי כמה'],
  misconceptions: [
    { id: 'reversed-ratio', title: 'קראו את היחס בסדר ההפוך',
      cause: 'כותבים את המספרים לפי הסדר שבו הופיעו בסיפור, ולא לפי הסדר בשאלה.',
      explain: ['היחס נכתב בסדר שבשאלה: "החניכים למדריכים" הוא $10 : 2$.', '$10 : 2$ ו־$2 : 10$ שונים: פי $5$ יותר חניכים, או פי $5$ פחות.'],
      remedy: [
        { kind: 'predict', text: 'מה היחס בין מספר החניכים למספר המדריכים?', fig: scouts, choices: ['$10 : 2$', '$2 : 10$'], answer: 0,
          why: 'השאלה מתחילה בחניכים, ולכן $10$ ראשון: $10 : 2$.' },
        { kind: 'predict', text: 'בכיתה $14$ בנות ו־$7$ בנים. מה היחס בין הבנים לבנות?', fig: groups([{ n: 14, label: 'בנות' }, { n: 7, label: 'בנים' }]),
          choices: ['$1 : 2$', '$2 : 1$'], answer: 0, why: 'קודם הבנים: $7 : 14$, ובצמצום ב־$7$: $1 : 2$.' },
      ] },
    { id: 'part-whole', title: 'השוו חלק לכל הכמות במקום לחלק השני',
      cause: 'מבלבלים בין "אדומים לכחולים" לבין "אדומים מתוך כולם".',
      explain: ['יחס משווה חלק לחלק: $6$ אדומים ל־$9$ כחולים הוא $6 : 9 = 2 : 3$.', 'חלק מתוך כולם הוא שבר: $6$ מתוך $15$ הם $\\frac{2}{5}$ מכל החרוזים.'],
      remedy: [
        { kind: 'explore', text: 'במחרוזת $10$ חרוזים. צבעו אדומים כך שהיחס בין האדומים לכחולים יהיה $3 : 2$.',
          manip: { kind: 'fbar', start: { den: 10, shaded: 0 }, lockDen: true }, answer: { mode: 'value', value: 0.6 },
          hint: '$3 : 2$: מכל $5$ חרוזים, $3$ אדומים ו־$2$ כחולים.', success: '$6$ אדומים ו־$4$ כחולים: $6 : 4 = 3 : 2$.' },
        { kind: 'predict', text: '$6$ אדומים ו־$9$ כחולים. איזה חלק מכל החרוזים אדומים?', fig: bar(15, 6), choices: ['$\\frac{2}{5}$', '$\\frac{2}{3}$'], answer: 0,
          why: 'מתוך כל $15$ החרוזים, $6$ אדומים: $\\frac{6}{15} = \\frac{2}{5}$. $\\frac{2}{3}$ הוא אדומים לכחולים.' },
      ] },
    { id: 'add-same', title: 'חשבו שהוספה של אותו מספר לשני חלקי היחס שומרת עליו',
      cause: 'בחשבון רגילים ש"אותו דבר לשני הצדדים" שומר על משהו. ביחס זה שומר רק על ההפרש, לא על "פי כמה".',
      explain: ['$6 : 8 = 3 : 4$, ואחרי הוספה של $2$: $8 : 10 = 4 : 5$. יחס אחר.', 'כפל באותו מספר שומר על היחס: $6 : 8 = 12 : 16$.'],
      prereq: 'frac:1',
      remedy: [
        { kind: 'predict', text: 'ניצבים $6$ ו־$8$. מאריכים כל ניצב ב־$2$. היחס בין הניצבים משתנה?', fig: twoTriangles('ניצבים 6 ו־8, ואחרי הוספה 8 ו־10'),
          choices: ['כן', 'לא'], answer: 0, why: '$6 : 8 = 3 : 4$ ו־$8 : 10 = 4 : 5$: שני יחסים שונים.' },
      ] },
  ],
};

// ================================================================ stair 2: sharing in a ratio

type P2 = { m: number; n: number; k: number; T: number };
const ratio2: DiagModel<P2> = {
  params: (rnd) => G.RATIO2.params(rnd),
  text: (p) => G.ratio2Text(p),
  answer: (p) => G.RATIO2.answer(p),
  bugs: G.RATIO2.bugs,
  solution: (p) => G.shareSolution(p),
  hint: (p) => G.shareHint(p),
};
type P2T = P2 & { P: number; hi: number; lo: number };
const ratio2T: DiagModel<P2T> = {
  params: (rnd) => G.RATIO2T.params(rnd),
  text: (p) => G.rectText(p),
  answer: (p) => G.RATIO2T.answer(p),
  bugs: G.RATIO2T.bugs,
  solution: (p) => G.rectSolution(p),
  hint: () => G.rectHint(),
};

const stair2: StairContent = {
  skill: 'ratio:2', topic: 'ratio', level: 2, title: 'חלוקה ביחס',
  objectives: [
    'לחלק כמות ביחס נתון: סופרים חלקים, מוצאים חלק אחד, וכופלים.',
    'לפתור בעזרת יחס גם שאלות על היקף.',
    'לבדוק שהחלקים מסתכמים לכמות ושהיחס ביניהם נכון.',
  ],
  idea: 'בחלוקה ביחס $m : n$ יש $m + n$ חלקים שווים. מוצאים כמה שווה חלק אחד, וכופלים.',
  why: [
    '$56$ גולות ביחס $2 : 5$: שבעה חלקים, כל אחד $8$ גולות. לאורי $2 \\cdot 8 = 16$, לדן $5 \\cdot 8 = 40$.',
    '$\\frac{2}{5}$ הוא היחס בין אורי לדן, לא החלק של אורי מכל הגולות. מכל הגולות לאורי $\\frac{2}{7}$.',
  ],
  alt: ['במשוואה: לאורי $2x$, לדן $5x$, ויחד $7x = 56$, כלומר $x = 8$.'],
  discover: [
    { kind: 'predict', text: 'חילקו $56$ גולות בין אורי לדן ביחס $2 : 5$ (אורי : דן). כמה קיבל אורי?', fig: bar(7, 0, { whole: 56 }),
      choices: ['$16$', '$40$', '$22.4$'], answer: 0,
      why: 'שבעה חלקים של $8$. לאורי שניים.',
      wrongWhy: { 1: '$40$ הם החלק של דן: היחס הוא אורי לדן.', 2: '$\\frac{2}{5}$ מ־$56$ משווה את אורי לכל הגולות, אבל היחס משווה אותו לדן.' } },
    { kind: 'explore', text: 'הפס הוא כל $56$ הגולות. סמנו את החלק של אורי.',
      manip: { kind: 'fbar', start: { den: 7, shaded: 0 }, lockDen: true, whole: 56 }, answer: { mode: 'value', value: 2 / 7 },
      hint: '$2 : 5$: אורי מקבל $2$ חלקים מתוך $7$.',
      success: '$2$ חלקים מתוך $7$. כל חלק $8$ גולות, ולאורי $16$.' },
    { kind: 'rule', text: 'חלוקה ביחס $m : n$: מחלקים את הכמות ל־$m + n$ חלקים שווים.', display: '56 : (2 + 5) = 8',
      why: 'כל אחד מקבל את מספר החלקים שלו מתוך היחס.', fig: bar(7, 2, { whole: 56 }) },
    { kind: 'predict', text: 'שותף השקיע $2000$ ש״ח וחברו $3000$ ש״ח. רווח של $1200$ ש״ח מתחלק לפי ההשקעות. כמה מקבל הראשון?', fig: bar(5, 2, { whole: 1200 }),
      choices: ['$480$', '$720$', '$800$'], answer: 0,
      why: '$2000 : 3000 = 2 : 3$: חמישה חלקים של $240$.',
      wrongWhy: { 1: '$720$ הם החלק של השני, שהשקיע יותר.', 2: '$800$ הם $\\frac{2}{3}$ מהרווח: זה משווה את הראשון לשני, לא לכל הרווח.' } },
    { kind: 'predict', text: 'היקף מלבן $40$ ס״מ, והיחס בין צלעותיו $5 : 3$. מה אורך הצלע הארוכה?', fig: rectFig(false),
      choices: ['$12.5$', '$25$', '$7.5$'], answer: 0,
      why: 'צלע ארוכה וצלע קצרה יחד הן חצי היקף, $20$. שמונה חלקים של $2.5$.',
      wrongWhy: { 1: 'חילקתם את כל ההיקף, אבל בהיקף כל צלע מופיעה פעמיים.', 2: '$7.5$ היא הצלע הקצרה: $3$ חלקים של $2.5$.' } },
    { kind: 'rule', text: 'בהיקף מלבן כל צלע מופיעה פעמיים: מחלקים ביחס את חצי ההיקף.',
      why: '$5x + 3x + 5x + 3x = 40$, כלומר $16x = 40$ ו־$8x = 20$.', fig: rectFig(true) },
    { kind: 'say', text: 'בודקים: החלקים מסתכמים לכמות ($16 + 40 = 56$), והיחס ביניהם נכון ($16 : 40 = 2 : 5$).', fig: bar(7, 2, { whole: 56, labels: true }) },
    { kind: 'predict', text: 'בטיול, היחס בין התלמידים בנעלי ספורט לתלמידים בסנדלים הוא $3 : 5$. יכול להיות שבאו בדיוק $83$ תלמידים?',
      fig: groups([{ n: 3, label: 'נעלי ספורט' }, { n: 5, label: 'סנדלים' }]),
      choices: ['לא: $83$ לא מתחלק ב־$8$', 'כן'], answer: 0,
      why: '$3 : 5$ הם $8$ חלקים שווים של תלמידים שלמים, ולכן המספר הכולל מתחלק ב־$8$.',
      wrongWhy: { 1: 'בכל קבוצה של $8$ תלמידים יש $3$ ו־$5$. $83$ תלמידים לא מתחלקים לקבוצות של $8$.' } },
  ],
  examples: [
    { problem: 'מחלקים $1200$ ש״ח בין שניים ביחס $2 : 3$. כמה מקבל הראשון?', answer: 480, check: '1200/5*2',
      steps: [
        { action: 'סופרים את החלקים.', why: 'ביחס $2 : 3$ יש $2 + 3$ חלקים שווים.', result: '2 + 3 = 5', calc: { expr: '2+3', value: 5 } },
        { action: 'מוצאים כמה שווה חלק אחד.', why: 'מחלקים את כל הסכום למספר החלקים.', result: '1200 : 5 = 240', calc: { expr: '1200/5', value: 240 } },
        { action: 'לראשון שני חלקים.', why: 'המספר שלו ביחס הוא $2$.', result: '2 \\cdot 240 = 480', value: '2*240' },
      ] },
    { problem: 'היקף מלבן $40$ ס״מ, והיחס בין צלעותיו $5 : 3$. מה אורך הצלע הארוכה?', fig: rectFig(false), answer: 12.5, check: '20/8*5',
      steps: [
        { action: 'מוצאים חצי היקף.', why: 'בהיקף כל צלע מופיעה פעמיים, וצלע ארוכה וקצרה יחד הן חצי ממנו.', result: '40 : 2 = 20', calc: { expr: '40/2', value: 20 } },
        { action: 'מוצאים חלק אחד.', why: 'ביחס $5 : 3$ יש $8$ חלקים.', result: '20 : 8 = 2.5', calc: { expr: '20/8', value: 2.5 } },
        { action: 'לצלע הארוכה $5$ חלקים.', why: 'המספר הגדול ביחס הוא של הצלע הארוכה.', result: '5 \\cdot 2.5 = 12.5', value: '5*2.5' },
      ] },
  ],
  together: [
    { problem: 'מחלקים $45$ ממתקים בין נועה לתמר ביחס $4 : 5$ (נועה : תמר). כמה ממתקים קיבלה תמר?',
      steps: [
        { prompt: 'לכמה חלקים שווים מחלקים?', choices: [
          { text: '$9$', ok: true, feedback: 'נכון: $4 + 5 = 9$.' },
          { text: '$5$', ok: false, feedback: '$5$ הם החלקים של תמר. סופרים את החלקים של שתיהן.' },
          { text: '$20$', ok: false, feedback: '$4 \\cdot 5$ הוא לא מספר החלקים: מחברים $4 + 5$.' },
        ], hints: ['כמה חלקים יש לנועה, וכמה לתמר?', '$4$ ועוד $5$.'], done: 'תשעה חלקים, כל אחד $45 : 9 = 5$ ממתקים.' },
      ],
      final: { prompt: 'כמה ממתקים קיבלה תמר?', answer: 25, check: '45/9*5', hints: ['לתמר $5$ חלקים.', '$5 \\cdot 5$.'] } },
    { problem: 'קטע של $36$ ס״מ מחולק ביחס $1 : 3$. מה אורך החלק הארוך?',
      steps: [
        { prompt: 'כמה ס״מ בחלק אחד?', choices: [
          { text: '$9$', ok: true, feedback: 'נכון: $1 + 3 = 4$ חלקים, ו־$36 : 4 = 9$.' },
          { text: '$12$', ok: false, feedback: '$36 : 3$ מחלק לשלושה חלקים, אבל ביחס $1 : 3$ יש ארבעה.' },
          { text: '$4$', ok: false, feedback: '$4$ הוא מספר החלקים, לא הגודל שלהם.' },
        ], hints: ['כמה חלקים יש ביחס $1 : 3$?', '$36$ מחלקים ל־$4$.'], done: 'כל חלק $9$ ס״מ.' },
      ],
      final: { prompt: 'מה אורך החלק הארוך?', answer: 27, check: '36/4*3', hints: ['לחלק הארוך $3$ חלקים.', '$3 \\cdot 9$.'] } },
  ],
  diag: ratio2,
  transfer: ratio2T,
  words: ['חלוקה ביחס', 'חלק אחד', 'חצי היקף', 'בדיקה'],
  misconceptions: [
    { id: 'reversed-ratio', title: 'קראו את היחס בסדר ההפוך',
      cause: 'נותנים לראשון את המספר השני של היחס, כי לא בדקו מי מופיע ראשון ביחס.',
      explain: ['ביחס "אורי : דן" המספר הראשון הוא של אורי.', 'בודקים בסוף: למי יש יותר? למי שהמספר שלו ביחס גדול יותר.'],
      remedy: [
        { kind: 'predict', text: '$56$ גולות ביחס $2 : 5$ (אורי : דן). למי יותר גולות?', fig: bar(7, 2, { whole: 56 }), choices: ['לדן', 'לאורי'], answer: 0,
          why: 'לדן $5$ חלקים ולאורי רק $2$: לדן $40$ ולאורי $16$.' },
      ] },
    { id: 'part-whole', title: 'השוו חלק לכל הכמות במקום לחלק השני',
      cause: 'קוראים את $2 : 5$ כאילו לאורי $\\frac{2}{5}$ מכל הגולות. אבל $2 : 5$ משווה את אורי לדן.',
      explain: ['ביחס $2 : 5$ יש $7$ חלקים. לאורי $2$ מתוך $7$: $\\frac{2}{7}$ מכל הגולות.', '$\\frac{2}{5}$ הוא כמה יש לאורי לעומת דן, לא לעומת כולם.'],
      remedy: [
        { kind: 'predict', text: 'אורי ודן חילקו $56$ גולות ביחס $2 : 5$. איזה משפט נכון?', fig: bar(7, 2, { whole: 56 }),
          choices: ['לאורי $\\frac{2}{7}$ מכל הגולות', 'לאורי $\\frac{2}{5}$ מכל הגולות'], answer: 0,
          why: 'בפס $7$ חלקים, ולאורי $2$ מהם: $\\frac{2}{7}$ מכל הגולות, כלומר $16$.' },
        { kind: 'explore', text: 'הפס הוא כל $56$ הגולות. סמנו את החלק של אורי ביחס $2 : 5$.',
          manip: { kind: 'fbar', start: { den: 7, shaded: 0 }, lockDen: true, whole: 56 }, answer: { mode: 'value', value: 2 / 7 },
          hint: 'בפס $7$ חלקים. לאורי $2$ מהם.', success: '$\\frac{2}{7}$ מ־$56$ הם $16$ גולות.' },
      ] },
    { id: 'whole-perimeter', title: 'חילקו את כל ההיקף ביחס, כאילו הוא צלע ארוכה וצלע קצרה',
      cause: 'נדמה שההיקף הוא צלע ארוכה ועוד צלע קצרה. אבל במלבן יש ארבע צלעות.',
      explain: ['בהיקף כל צלע מופיעה פעמיים: $5x + 3x + 5x + 3x$.', 'מחלקים ביחס את חצי ההיקף: צלע ארוכה ועוד צלע קצרה.'],
      remedy: [
        { kind: 'predict', text: 'היקף מלבן $40$ ס״מ. כמה הן צלע ארוכה ועוד צלע קצרה יחד?', fig: rectFig(true), choices: ['$20$', '$40$'], answer: 0,
          why: 'בהיקף כל צלע מופיעה פעמיים, ולכן צלע ארוכה ועוד קצרה הן חצי: $20$.' },
      ] },
  ],
};

// ================================================================ stair 3: proportion

type P3 = { u: number; a: number; b: number; c: number };
const ratio3: DiagModel<P3> = {
  params: (rnd) => G.RATIO3.params(rnd),
  text: (p) => G.ratio3Text(p),
  answer: (p) => G.RATIO3.answer(p),
  bugs: G.RATIO3.bugs,
  solution: (p) => G.ratio3Solution(p),
  hint: (p) => G.ratio3Hint(p),
  precise: true,
  fmt: 'dec',
};
const ratio3T: DiagModel<P3> = {
  params: (rnd) => G.RATIO3T.params(rnd),
  text: (p) => G.ratio3Text(p, true),
  answer: (p) => G.RATIO3T.answer(p),
  bugs: G.RATIO3T.bugs,
  solution: (p) => G.ratio3Solution(p, true),
  hint: (p) => G.ratio3Hint(p, true),
  precise: true,
  fmt: 'dec',
};

const stair3: StairContent = {
  skill: 'ratio:3', topic: 'ratio', level: 3, title: 'פרופורציה',
  objectives: [
    'לזהות פרופורציה: שני יחסים שווים, ויחס ישר בטבלה.',
    'למצוא ערך חסר דרך היחידה או דרך "פי כמה".',
    'להבחין בין מצב שבו היחס קבוע לבין מצב שבו ההפרש קבוע.',
  ],
  idea: 'בפרופורציה היחס נשמר: אם כמות אחת גדלה פי משהו, גם השנייה גדלה פי אותו דבר. ההפרש לא נשמר.',
  why: [
    '$4$ כוסות מים ו־$1$ סוכר: לכל כוס מים רבע כוס סוכר. ל־$3$ כוסות מים: $\\frac{3}{4}$.',
    '"הוספתי כוס מים אז אוסיף כוס סוכר" שומר על ההפרש, והמשקה כבר לא באותה מתיקות.',
  ],
  alt: ['ציר כפול: למעלה כוסות מים, למטה סוכר. כל כוס מים למעלה היא רבע כוס סוכר למטה.'],
  discover: [
    { kind: 'predict', text: 'בכד $4$ כוסות מים ו־$1$ כוס סוכר. כמה סוכר צריך ל־$3$ כוסות מים, באותה מתיקות?', fig: dl(water(4), sugar(1)),
      choices: ['$\\frac{3}{4}$', '$0$', '$12$'], answer: 0,
      why: 'לכל כוס מים רבע כוס סוכר.',
      wrongWhy: { 1: 'הורדתם כוס מכל אחד. זה שומר על ההפרש, לא על המתיקות.', 2: '$12$ הם $4$ כוסות סוכר לכל כוס מים: הפוך.' } },
    { kind: 'explore', text: 'הזיזו את הסמן ל־$3$ כוסות מים, וקראו כמה סוכר.', manip: dline(water(8), sugar(2)), answer: 3,
      hint: 'כל כוס מים היא רבע כוס סוכר.', success: '$3$ כוסות מים: $\\frac{3}{4}$ כוס סוכר.' },
    { kind: 'rule', text: 'פרופורציה: $\\frac{a}{b} = \\frac{x}{c}$. מוצאים כמה ליחידה אחת, או פי כמה גדלה הכמות.',
      display: '\\frac{1}{4} = \\frac{x}{3} \\Rightarrow x = \\frac{3}{4}',
      why: 'שני יחסים שווים: סוכר לכוס מים.', fig: dl(water(8), sugar(2), { at: 3 }) },
    { kind: 'predict', text: 'ל־$2$ חלמונים צריך $2.5$ כוסות קמח. כמה קמח ל־$3$ חלמונים?',
      fig: dl({ max: 4, step: 1, label: 'חלמונים' }, { max: 5, step: 1.25, label: 'קמח (כוסות)' }),
      choices: ['$3.75$', '$3.5$', '$2.4$'], answer: 0,
      why: 'לכל חלמון $1.25$ כוסות, ול־$3$: $3.75$.',
      wrongWhy: { 1: 'הוספתם כוס כי הוספתם חלמון: שמרתם על ההפרש.', 2: '$2.4$ הם חלמונים לכוס קמח, הפוך.' } },
    { kind: 'rule', text: 'יחס ישר: כמות אחת שווה לכמות השנייה כפול מספר קבוע.', display: 'y = 1.25x',
      why: 'ב־$0$ חלמונים $0$ קמח, וכל חלמון מוסיף אותו דבר.',
      fig: table(['חלמונים', 'קמח (כוסות)'], [[1, 1.25], [2, 2.5], [3, 3.75], [4, 5]]) },
    { kind: 'predict', text: 'שלושה סוגי דגנים. אילו מהם שומרים על אותו יחס בין קלוריות למשקל?', fig: cereals(false),
      choices: ['ב ו־ג', 'כולם', 'אף אחד'], answer: 0,
      why: 'ב: $\\frac{540}{500} = 1.08$, ג: $\\frac{675}{625} = 1.08$, א: $\\frac{390}{375} = 1.04$.',
      wrongWhy: { 1: 'בכולם יש יותר קלוריות מגרמים, אבל המנה של א שונה: $1.04$ ולא $1.08$.', 2: 'ב ו־ג נותנים אותה מנה, $1.08$.' } },
    { kind: 'predict', text: 'דני קורא $2$ עמודים ב־$5$ דקות, בקצב קבוע. כמה דקות ל־$6$ עמודים?',
      fig: dl({ max: 15, step: 5, label: 'דקות' }, { max: 6, step: 2, label: 'עמודים' }),
      choices: ['$15$', '$9$'], answer: 0,
      why: 'פי $3$ עמודים, פי $3$ זמן.',
      wrongWhy: { 1: 'הוספתם $4$ דקות כי הוספתם $4$ עמודים. בקצב קבוע כופלים.' } },
    { kind: 'rule', text: 'בודקים פרופורציה: המנה בכל זוג שווה.', why: 'אם המנות שונות, הקשר אינו יחס ישר.', fig: cereals(true) },
  ],
  examples: [
    { problem: '$6$ מחברות עולות $27$ ש״ח. כמה עולות $10$ מחברות?', answer: 45, check: '27/6*10',
      steps: [
        { action: 'מוצאים את מחיר המחברת.', why: 'דרך היחידה: כמה עולה מחברת אחת.', result: '27 : 6 = 4.5', calc: { expr: '27/6', value: 4.5 } },
        { action: 'כופלים במספר המחברות.', why: 'כל מחברת עולה אותו דבר.', result: '4.5 \\cdot 10 = 45', value: '4.5*10' },
      ] },
    { problem: '$y$ פרופורציונלי ל־$x$. כש־$x = 6$, $y = 4$. מה $y$ כש־$x = 15$?', answer: 10, check: '4/6*15',
      steps: [
        { action: 'פי כמה גדל $x$?', why: 'בפרופורציה גם $y$ גדל פי אותו מספר.', result: '15 : 6 = 2.5', calc: { expr: '15/6', value: 2.5 } },
        { action: 'כופלים את $y$ באותו מספר.', why: 'היחס בין $y$ ל־$x$ נשמר.', result: '4 \\cdot 2.5 = 10', value: '4*2.5' },
      ] },
  ],
  together: [
    { problem: '$3$ ק״ג תפוחים עולים $21$ ש״ח. כמה עולים $5$ ק״ג תפוחים?',
      steps: [
        { prompt: 'כמה עולה ק״ג אחד?', choices: [
          { text: '$7$', ok: true, feedback: 'נכון: $21 : 3 = 7$ ש״ח לק״ג.' },
          { text: '$\\frac{1}{7}$', ok: false, feedback: 'זה ק״ג לשקל, הפוך.' },
          { text: '$18$', ok: false, feedback: 'חיסרתם $3$ מ־$21$. כמה לק״ג אחד? מחלקים.' },
        ], hints: ['מחלקים את המחיר במספר הקילוגרמים.', '$21 : 3$.'], done: 'ק״ג אחד עולה $7$ ש״ח.' },
      ],
      final: { prompt: 'כמה עולים $5$ ק״ג?', answer: 35, check: '21/3*5', hints: ['כל ק״ג עולה $7$.', '$5 \\cdot 7$.'] } },
    { problem: 'מכונית נוסעת $150$ ק״מ ב־$2$ שעות, במהירות קבועה. כמה ק״מ היא נוסעת ב־$5$ שעות?',
      steps: [
        { prompt: 'כמה ק״מ בשעה אחת?', choices: [
          { text: '$75$', ok: true, feedback: 'נכון: $150 : 2 = 75$.' },
          { text: '$300$', ok: false, feedback: 'כפלתם ב־$2$. בשעה אחת נוסעים חצי מ־$150$.' },
          { text: '$148$', ok: false, feedback: 'חיסרתם. כדי למצוא כמה בשעה אחת, מחלקים.' },
        ], hints: ['ב־$2$ שעות $150$ ק״מ. ובשעה אחת?', '$150 : 2$.'], done: 'בשעה אחת $75$ ק״מ.' },
      ],
      final: { prompt: 'כמה ק״מ ב־$5$ שעות?', answer: 375, check: '150/2*5', hints: ['כל שעה $75$ ק״מ.', '$5 \\cdot 75$.'] } },
  ],
  diag: ratio3,
  transfer: ratio3T,
  words: ['פרופורציה', 'יחס ישר', 'ליחידה אחת', 'פי כמה', 'טבלת ערכים'],
  misconceptions: [
    { id: 'additive', title: 'שמרו על אותו הפרש במקום על אותו יחס',
      cause: 'בחיבור רגילים לשמור על "אותו הפרש". בפרופורציה שומרים על "אותו פי".',
      explain: ['ל־$2$ חלמונים $2.5$ כוסות. חלמון נוסף מוסיף $1.25$ כוסות, לא כוס אחת.', 'בודקים: המנה $\\frac{3.75}{3} = \\frac{2.5}{2} = 1.25$ נשמרת.'],
      remedy: [
        { kind: 'predict', text: 'ל־$2$ חלמונים צריך $2.5$ כוסות קמח. כמה קמח ל־$3$ חלמונים?',
          fig: dl({ max: 4, step: 1, label: 'חלמונים' }, { max: 5, step: 1.25, label: 'קמח (כוסות)' }),
          choices: ['$3.75$', '$3.5$'], answer: 0, why: 'לכל חלמון $1.25$ כוסות: $3 \\cdot 1.25 = 3.75$. ב־$3.5$ נשמר רק ההפרש.' },
        { kind: 'explore', text: 'הזיזו את הסמן ל־$5$ כוסות מים, וקראו כמה סוכר.', manip: dline(water(8), sugar(2)), answer: 5,
          hint: 'כל כוס מים היא רבע כוס סוכר.', success: '$5$ כוסות מים: $\\frac{5}{4} = 1.25$ כוסות סוכר. לא $5 - 3$.' },
      ] },
    { id: 'divide-flip', title: 'חילקו הפוך כשמצאו כמה ליחידה',
      cause: 'מחלקים את המספרים בסדר שבו הופיעו, לא לפי "כמה ליחידה".',
      explain: ['כמה עולה ק״ג אחד? מחלקים את המחיר בקילוגרמים: $21 : 3 = 7$ ש״ח.', '$3 : 21$ הם ק״ג לשקל: כמה ק״ג קונים בשקל אחד.'],
      remedy: [
        { kind: 'predict', text: '$3$ ק״ג תפוחים עולים $21$ ש״ח. כמה עולה ק״ג אחד?', fig: dl({ max: 3, step: 1, unit: 'ק״ג', label: 'תפוחים (ק״ג)' }, { max: 21, step: 7, unit: 'ש״ח', label: 'מחיר (ש״ח)' }),
          choices: ['$7$', '$\\frac{1}{7}$'], answer: 0, why: 'מתחת ל־$1$ ק״ג יש $21 : 3 = 7$ ש״ח.' },
      ] },
  ],
};

// ================================================================ stair 4: scale

type P4 = { k: 0 | 1; S: number; d: number; D?: number };
const ratio4: DiagModel<P4> = {
  params: (rnd) => G.RATIO4.params(rnd),
  text: (p) => G.ratio4Text(p),
  answer: (p) => G.RATIO4.answer(p),
  bugs: G.RATIO4.bugs,
  solution: (p) => G.ratio4Solution(p),
  hint: (p) => G.ratio4Hint(p),
};
type P4T = { k: number };
const ratio4T: DiagModel<P4T> = {
  params: (rnd) => G.RATIO4T.params(rnd),
  text: (p) => G.areaText(p),
  answer: (p) => G.RATIO4T.answer(p),
  bugs: G.RATIO4T.bugs,
  solution: (p) => G.areaSolution(p),
  hint: () => G.areaHint(),
};
const metre: [DlineLine, DlineLine] = [{ max: 1, step: 0.1, unit: 'מטר', label: 'מטרים', every: 5 }, { max: 100, step: 10, unit: 'ס״מ', label: 'סנטימטרים', every: 5 }];

const stair4: StairContent = {
  skill: 'ratio:4', topic: 'ratio', level: 4, title: 'קנה מידה',
  objectives: [
    'לדעת שקנה מידה הוא יחס בין גודל בשרטוט לגודל במציאות, באותן יחידות.',
    'למצוא גודל במציאות, גודל בשרטוט, או את קנה המידה, עם המרת יחידות.',
    'לדעת שהשטח גדל בריבוע של קנה המידה.',
  ],
  idea: 'קנה מידה $1 : S$: כל $1$ ס״מ בשרטוט הוא $S$ ס״מ במציאות. שני הצדדים באותה יחידה, ואחר כך ממירים.',
  why: [
    '$1 : 50{,}000$: $1$ ס״מ במפה הם $50{,}000$ ס״מ במציאות, כלומר $500$ מטר.',
    'כשכל אורך גדל פי $3$, ריבוע של $1$ על $1$ הופך לריבוע של $3$ על $3$: שטחו פי $9$.',
  ],
  alt: ['סרגל קנה מידה על המפה: מודדים בסרגל, ומעבירים לפס שמתחת למפה.'],
  discover: [
    { kind: 'say', text: 'במפה כתוב $1 : 50{,}000$. כל ס״מ במפה הוא $50{,}000$ ס״מ במציאות.', fig: dl(mapCm(4), realKm(2)) },
    { kind: 'predict', text: '$50{,}000$ ס״מ הם:', fig: dl(...metre),
      choices: ['$500$ מטר', '$50$ מטר', '$5$ ק״מ'], answer: 0,
      why: '$100$ ס״מ הם מטר: $50{,}000 : 100 = 500$.',
      wrongWhy: { 1: 'חילקתם ב־$1000$. במטר יש $100$ ס״מ.', 2: '$5$ ק״מ הם $5000$ מטר, פי $10$ מ־$500$.' } },
    { kind: 'predict', text: 'במפה בקנה מידה $1 : 50{,}000$ אורך השביל $6$ ס״מ. כמה הוא במציאות?', fig: dl(mapCm(8), { ...realKm(4), every: 8 }, { at: 6, show: 'top' }),
      choices: ['$3$ ק״מ', '$300{,}000$ מטר', '$30$ ק״מ'], answer: 0,
      why: '$6 \\cdot 50{,}000 = 300{,}000$ ס״מ, כלומר $3000$ מטר, $3$ ק״מ.',
      wrongWhy: { 1: '$300{,}000$ הם סנטימטרים. צריך להמיר.', 2: 'בקילומטר יש $100{,}000$ ס״מ, ולכן $300{,}000$ ס״מ הם $3$ ק״מ, לא $30$.' } },
    { kind: 'explore', text: 'הזיזו את הסמן ל־$7$ ס״מ וקראו כמה זה במציאות.', manip: dline(mapCm(10), realKm(5)), answer: 7,
      hint: 'כל $2$ ס״מ הם $1$ ק״מ.', success: '$7$ ס״מ הם $3.5$ ק״מ.' },
    { kind: 'rule', text: 'ממפה למציאות: כופלים ב־$S$ וממירים. ממציאות למפה: ממירים לס״מ ומחלקים ב־$S$.', display: '6 \\cdot 50{,}000 = 300{,}000',
      why: 'שני הצדדים של קנה המידה באותה יחידה, ולכן קודם מחשבים ואחר כך ממירים.', fig: dl(mapCm(4), realKm(2)) },
    { kind: 'predict', text: 'בדגם, קוטר כדור הארץ $1$ מטר. במציאות הקוטר כ־$12{,}500$ ק״מ. מה קנה המידה?',
      fig: dl({ max: 1, step: 0.25, unit: 'מטר', label: 'בדגם (מטר)', every: 4 }, { max: 12500, step: 3125, unit: 'ק״מ', label: 'במציאות (ק״מ)', every: 4 }),
      choices: ['$1 : 12{,}500{,}000$', '$1 : 12{,}500$', '$12{,}500 : 1$'], answer: 0,
      why: '$12{,}500$ ק״מ הם $12{,}500{,}000$ מטר. שני הצדדים במטרים.',
      wrongWhy: { 1: 'מטרים מול קילומטרים: היחידות לא אחידות.', 2: 'בהקטנה ה־$1$ בצד שמאל.' } },
    { kind: 'predict', text: 'דגם בקנה מידה $1 : 500$. פי כמה גדול שטח הגג במציאות משטח הגג בדגם?', fig: grid(3, 3, 1, 1, 'לא בקנה מידה'),
      choices: ['פי $250{,}000$', 'פי $500$'], answer: 0,
      why: 'האורך פי $500$ וגם הרוחב פי $500$: $500 \\cdot 500 = 250{,}000$.',
      wrongWhy: { 1: 'פי $500$ גדל כל אורך. השטח הוא אורך כפול רוחב, ושניהם גדלים.' } },
    { kind: 'rule', text: 'שטח גדל פי קנה המידה בריבוע.', display: '500^2 = 250{,}000',
      why: 'שטח הוא אורך כפול רוחב, ושניהם גדלים.', fig: grid(3, 3, 1, 1, 'פי 3 בכל צלע: 9 ריבועים') },
  ],
  examples: [
    { problem: 'במפה בקנה מידה $1 : 25{,}000$ המרחק בין שתי נקודות הוא $8$ ס״מ. כמה מטרים הוא במציאות?', answer: 2000, check: '8*25000/100',
      steps: [
        { action: 'כופלים בקנה המידה, בסנטימטרים.', why: 'כל ס״מ במפה הוא $25{,}000$ ס״מ במציאות.', result: '8 \\cdot 25{,}000 = 200{,}000', calc: { expr: '8*25000', value: 200000 } },
        { action: 'ממירים למטרים.', why: 'במטר $100$ ס״מ.', result: '200{,}000 : 100 = 2000', value: '200000/100' },
      ] },
    { problem: 'תוכנית בקנה מידה $1 : 200$. אורך חדר $5$ מטר. כמה ס״מ הוא בתוכנית?', answer: 2.5, check: '5*100/200',
      steps: [
        { action: 'ממירים את האורך במציאות לסנטימטרים.', why: 'שני הצדדים של קנה המידה בסנטימטרים.', result: '5 \\cdot 100 = 500', calc: { expr: '5*100', value: 500 } },
        { action: 'מחלקים בקנה המידה.', why: 'כל $200$ ס״מ במציאות הם ס״מ אחד בתוכנית.', result: '500 : 200 = 2.5', value: '500/200' },
      ] },
  ],
  together: [
    { problem: 'במפה בקנה מידה $1 : 20{,}000$ אורך הדרך $12$ ס״מ. כמה מטרים היא במציאות?',
      steps: [
        { prompt: 'כמה ס״מ במציאות?', choices: [
          { text: '$240{,}000$', ok: true, feedback: 'נכון: $12 \\cdot 20{,}000 = 240{,}000$ ס״מ.' },
          { text: '$20{,}012$', ok: false, feedback: 'קנה מידה הוא כפל, לא חיבור.' },
          { text: '$0.0006$', ok: false, feedback: 'חילקתם: ממפה למציאות כופלים.' },
        ], hints: ['כל ס״מ במפה הוא $20{,}000$ ס״מ במציאות.', '$12 \\cdot 20{,}000$.'], done: 'במציאות $240{,}000$ ס״מ.' },
      ],
      final: { prompt: 'כמה מטרים?', answer: 2400, check: '12*20000/100', hints: ['במטר $100$ ס״מ.', '$240{,}000 : 100$.'] } },
    { problem: 'בתוכנית דירה בקנה מידה $1 : 100$ חדר הוא $4$ ס״מ על $3$ ס״מ. מה שטח החדר במציאות, במ״ר?',
      steps: [
        { prompt: '$4$ ס״מ בתוכנית הם:', choices: [
          { text: '$4$ מטר', ok: true, feedback: 'נכון: $4 \\cdot 100 = 400$ ס״מ, כלומר $4$ מטר.' },
          { text: '$400$ מטר', ok: false, feedback: '$400$ ס״מ הם $4$ מטר.' },
        ], hints: ['כל ס״מ בתוכנית הוא $100$ ס״מ במציאות.', '$100$ ס״מ הם מטר אחד.'], done: 'החדר $4$ מטר על $3$ מטר.' },
      ],
      final: { prompt: 'מה השטח, במ״ר?', answer: 12, check: '4*3', hints: ['שטח הוא אורך כפול רוחב, במטרים.', '$4 \\cdot 3$.'] } },
  ],
  diag: ratio4,
  transfer: ratio4T,
  words: ['קנה מידה', 'מפה', 'דגם', 'תוכנית', 'הקטנה', 'הגדלה', 'המרת יחידות', 'ס״מ', 'מטר', 'ק״מ'],
  misconceptions: [
    { id: 'no-convert', title: 'שכחו להמיר בין סנטימטרים למטרים',
      cause: 'קנה המידה נכון, אבל התשובה נשארה בסנטימטרים.',
      explain: ['$1 : 50{,}000$ אומר: ס״מ אחד הוא $50{,}000$ ס״מ. התוצאה בסנטימטרים.', 'אם שואלים במטרים, מחלקים ב־$100$ בסוף.'],
      remedy: [
        { kind: 'predict', text: '$50{,}000$ ס״מ הם:', fig: dl(...metre), choices: ['$500$ מטר', '$50{,}000$ מטר'], answer: 0,
          why: 'בכל מטר $100$ ס״מ: $50{,}000 : 100 = 500$ מטר.' },
        { kind: 'explore', text: 'הזיזו את הסמן ל־$4$ ס״מ במפה, וקראו כמה זה במציאות.', manip: dline(mapCm(10), realKm(5)), answer: 4,
          hint: 'כל $2$ ס״מ במפה הם $1$ ק״מ.', success: '$4$ ס״מ במפה הם $2$ ק״מ, כלומר $2000$ מטר.' },
      ] },
    { id: 'cm-km', title: 'המירו לקילומטרים וכתבו כאילו אלה מטרים',
      cause: 'ממירים בבת אחת לקילומטרים, ואז כותבים את המספר כאילו הוא מטרים.',
      explain: ['$1$ ק״מ $= 1000$ מטר, ו־$1$ מטר $= 100$ ס״מ.', '$300{,}000$ ס״מ הם $3000$ מטר, שהם $3$ ק״מ. כשהשאלה במטרים, התשובה $3000$.'],
      remedy: [
        { kind: 'predict', text: '$300{,}000$ ס״מ, במטרים:', fig: dl(...metre), choices: ['$3000$', '$3$'], answer: 0,
          why: '$300{,}000 : 100 = 3000$ מטר. $3$ הוא אותו מרחק בקילומטרים.' },
      ] },
    { id: 'linear-area', title: 'חשבו שהשטח גדל פי אותו מספר כמו האורכים',
      cause: 'האורכים גדלים פי $k$, ונדמה שהכול גדל פי $k$.',
      explain: ['שטח הוא אורך כפול רוחב, ושניהם גדלים פי $k$.', 'ולכן השטח גדל פי $k \\cdot k$: בקנה מידה $1 : 2$, פי $4$.'],
      remedy: [
        { kind: 'predict', text: 'דגם בקנה מידה $1 : 2$. פי כמה גדל השטח במציאות?', fig: grid(2, 2, 1, 1, 'פי 2 בכל צלע'), choices: ['פי $4$', 'פי $2$'], answer: 0,
          why: 'ריבוע של $1$ על $1$ הופך לריבוע של $2$ על $2$: ארבעה ריבועים קטנים.' },
      ] },
  ],
};

export const RATIO: StairContent[] = [stair1, stair2, stair3, stair4];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/ratio.js names them all). */
export const CATS_RATIO: Record<string, string> = {};
export { ratio1, ratio1T, ratio2, ratio2T, ratio3, ratio3T, ratio4, ratio4T };
