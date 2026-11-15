// Boxes and prisms (תיבה ומנסרה): unit 7.13 of grade 7 (ז׳) in the Ministry's תשפ״ז schedule, the cube and the box in
// January and the triangular prism in May (curriculum stage 2, MEASURE-3). Four stairs: the box's net and surface area,
// the volume of a box and a cube (litres too), the right triangular prism's net and surface area, and its volume.
//
// One picture carries the unit: the cardboard outside (the net, its faces, in סמ״ר) against what fills the box inside
// (unit cubes in layers, in סמ״ק). The net object (`net`) folds a box and a prism closed by its Stepper, builds a box or
// a prism of a given volume from Steppers, and takes the prism's missing base to the end where the net closes. A right
// triangular prism is half a box: its volume is the triangle's area times the length.
// The diagnostic models are the spec's (content/solid.js SOLID1 to SOLID4T, ported unchanged); every misconception's
// source is listed in content/solid.js. The Ministry's situations (the half box, the open box, the aquarium in litres,
// small cubes in a big box, the tent) are used; the sentences are the app's own. Every number written here is checked
// by the lane's spec/facts-solid-teach.mjs, and the maths of every step by learn/content.test.ts.
import type { DiagModel, FigSpec, ManipSpec, NetFig, SolidFig, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and drawings
import * as SOLID_JS from '@/content/solid.js';

// the drawings content/solid.js builds are solid figures (FigSpec); its inferred types say only "string" for their type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: any = SOLID_JS;

// ---------------------------------------------------------------- figures
// Still solids and nets (components/SolidFigs.jsx). A box is a long, b deep and c high; a prism's base is in front.

type SolidExtra = Partial<Omit<SolidFig, 'type' | 'shape'>>;
const box = (a: number, b: number, c: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'box', a, b, c, ...extra });
const cube = (a: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'cube', a, ...extra });
/** A prism whose base is a right triangle: legs p (along the bottom) and q (up); r writes the hypotenuse. */
const rprism = (p: number, q: number, L: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'prism', p, q, L, ...extra });
/** A prism whose base is a triangle with a side p, the height h to it and a slanted side q. */
const hprism = (p: number, h: number, q: number, L: number, extra: SolidExtra = {}): FigSpec => ({ type: 'solid', shape: 'prism', p, h, q, L, ...extra });
const netfig = (solid: NetFig['solid'], dims: NetFig['dims'], extra: Partial<Omit<NetFig, 'type' | 'solid' | 'dims'>> = {}): FigSpec => ({ type: 'netfig', solid, dims, ...extra });

// the net object (components/manip/NetFold.jsx)
const foldBox: ManipSpec = { kind: 'net', solid: 'box', dims: { a: 4, b: 3, c: 2 }, layout: 'cross', task: 'fold', start: { t: 0 } };
const foldPrism: ManipSpec = { kind: 'net', solid: 'prism', dims: { p: 3, q: 4, r: 5, L: 10 }, task: 'fold', start: { t: 0 } };
const buildBox = (c: number): ManipSpec => ({ kind: 'net', solid: 'box', task: 'build', start: { a: 1, b: 1, c } });
const buildPrism = (L: number): ManipSpec => ({ kind: 'net', solid: 'prism', task: 'build', start: { p: 1, q: 1, L } });
/** The prism 6-8-10, 5 long, its second base loose: every slot at the far end of the strip closes it. */
const fixPrism: ManipSpec = { kind: 'net', solid: 'prism', dims: { p: 6, q: 8, r: 10, L: 5 }, task: 'fix', loose: 'E', start: { slot: null } };

// ================================================================ the models (content/solid.js, ported unchanged)

type PB = { a: number; b: number; c: number };
const solid1: DiagModel<PB> = {
  params: (rnd) => S.SOLID1.params(rnd), text: (p) => S.solid1Text(p), fig: (p) => S.solid1Fig(p),
  answer: (p) => S.SOLID1.answer(p), bugs: S.SOLID1.bugs, solution: (p) => S.solid1Solution(p), hint: () => S.solid1Hint(), unit: S.UNIT.cm2,
};
const solid1T: DiagModel<PB> = {
  params: (rnd) => S.SOLID1T.params(rnd), text: (p) => S.openBoxText(p), fig: (p) => S.openBoxFig(p),
  answer: (p) => S.SOLID1T.answer(p), bugs: S.SOLID1T.bugs, solution: (p) => S.openBoxSolution(p), hint: () => S.openBoxHint(), unit: S.UNIT.cm2,
};
const solid2: DiagModel<PB> = {
  params: (rnd) => S.SOLID2.params(rnd), text: (p) => S.solid2Text(p), fig: (p) => S.solid2Fig(p),
  answer: (p) => S.SOLID2.answer(p), bugs: S.SOLID2.bugs, solution: (p) => S.solid2Solution(p), hint: () => S.solid2Hint(), unit: S.UNIT.cm3,
};
const solid2T: DiagModel<PB> = {
  params: (rnd) => S.SOLID2T.params(rnd), text: (p) => S.tankText(p), fig: (p) => S.tankFig(p),
  answer: (p) => S.SOLID2T.answer(p), bugs: S.SOLID2T.bugs, solution: (p) => S.tankSolution(p), hint: () => S.tankHint(), unit: S.UNIT.litre,
};
type P3 = { p: number; q: number; c: number; L: number };
const solid3: DiagModel<P3> = {
  params: (rnd) => S.SOLID3.params(rnd), text: (p) => S.solid3Text(p), fig: (p) => S.solid3Fig(p),
  answer: (p) => S.SOLID3.answer(p), bugs: S.SOLID3.bugs, solution: (p) => S.solid3Solution(p), hint: () => S.solid3Hint(), unit: S.UNIT.cm2,
};
type P3T = { b: number; h: number; s: number; L: number };
const solid3T: DiagModel<P3T> = {
  params: (rnd) => S.SOLID3T.params(rnd), text: (p) => S.tentText(p), fig: (p) => S.tentFig(p),
  answer: (p) => S.SOLID3T.answer(p), bugs: S.SOLID3T.bugs, solution: (p) => S.tentSolution(p), hint: () => S.tentHint(), unit: S.UNIT.m2,
};
const solid4: DiagModel<P3> = {
  params: (rnd) => S.SOLID4.params(rnd), text: (p) => S.solid4Text(p), fig: (p) => S.solid4Fig(p),
  answer: (p) => S.SOLID4.answer(p), bugs: S.SOLID4.bugs, solution: (p) => S.solid4Solution(p), hint: () => S.solid4Hint(), unit: S.UNIT.cm3,
};
type P4T = { h: number; d: number; s: number; w: number };
const solid4T: DiagModel<P4T> = {
  params: (rnd) => S.SOLID4T.params(rnd), text: (p) => S.rampText(p), fig: (p) => S.rampFig(p),
  answer: (p) => S.SOLID4T.answer(p), bugs: S.SOLID4T.bugs, solution: (p) => S.rampSolution(p), hint: () => S.rampHint(), unit: S.UNIT.m3,
};

// ================================================================ stair 1: the box, its net and its surface area

const stair1: StairContent = {
  skill: 'solid:1', topic: 'solid', level: 1, title: 'תיבה: פריסה ושטח פנים',
  objectives: [
    'להכיר את חלקי התיבה: $6$ פאות, $12$ מקצועות ו־$8$ קודקודים.',
    'לזהות פריסה של קובייה ושל תיבה, ולמצוא פאות נגדיות.',
    'לחשב שטח פנים של תיבה ושל קובייה, וסכום של כל המקצועות.',
  ],
  idea: 'פריסה היא הגוף כשפותחים אותו על השולחן. שטח הפנים הוא כל הקרטון של הפריסה: שש פאות, שלושה זוגות שווים.',
  why: [
    'כל פאה של תיבה מופיעה פעמיים: למטה ולמעלה, מקדימה ומאחור, מימין ומשמאל.',
    'לכל כיוון $4$ מקצועות שווים, ולכן סכום כל המקצועות הוא $4(a + b + c)$.',
  ],
  alt: ['עטיפת מתנה: כמה נייר צריך כדי לכסות את הקופסה בלי חפיפות? בדיוק שטח הפנים.'],
  discover: [
    { kind: 'say', text: 'לתיבה $6$ פאות מלבניות, $12$ מקצועות ו־$8$ קודקודים. כל פאה שווה לפאה שמולה.',
      fig: box(4, 3, 2, { label: 'פאה, מקצוע וקודקוד' }) },
    { kind: 'explore', text: 'קפלו את הפריסה עד שתיסגר תיבה.', manip: foldBox, answer: { mode: 'fold', t: 1 },
      hint: 'כל פאה מתקפלת סביב הקו שמחבר אותה לשכנה.',
      success: 'שש פאות, שלושה זוגות: $4 \\cdot 3$, $4 \\cdot 2$ ו־$3 \\cdot 2$, כל זוג פעמיים.' },
    { kind: 'predict', text: 'בפריסה הזו $A$, $B$, $C$ ו־$D$ בשורה, $E$ מעל $B$ ו־$F$ מתחת ל־$B$. איזו פאה תהיה מול $A$?',
      fig: netfig('cube', { a: 2 }, { layout: 'cross', letters: true }),
      choices: ['פאה $C$', 'פאה $B$', 'פאה $E$'], answer: 0,
      why: 'בשורה של ארבע פאות, פאה נגדית היא זו שאחרי השכנה: $A$ מול $C$, $B$ מול $D$, ו־$E$ מול $F$.',
      wrongWhy: { 1: '$B$ נוגעת ב־$A$ בפריסה, ולכן גם בקובייה: הן סמוכות.', 2: '$E$ נוגעת ב־$B$, וכשמקפלים היא נוגעת גם ב־$A$.' } },
    { kind: 'rule', text: 'שטח פנים: הסכום של שטחי כל שש הפאות.', display: 'S = 2(ab + ac + bc)',
      why: 'כל פאה מופיעה פעמיים, ולכן מחברים שלוש פאות שונות וכופלים ב־$2$.',
      fig: netfig('box', { a: 4, b: 3, c: 2 }, { labels: 'area' }) },
    { kind: 'predict', text: 'מה שטח הפנים של תיבה $5$ על $3$ על $2$?', fig: box(5, 3, 2),
      choices: ['$62$', '$31$', '$30$'], answer: 0,
      why: '$5 \\cdot 3 + 5 \\cdot 2 + 3 \\cdot 2 = 15 + 10 + 6 = 31$, וכל פאה פעמיים: $62$.',
      wrongWhy: { 1: '$31$ סופר רק שלוש פאות, אחת מכל זוג.', 2: '$30 = 5 \\cdot 3 \\cdot 2$ הוא הנפח: כמה קוביות בפנים, לא כמה קרטון מבחוץ.' } },
    { kind: 'predict', text: 'מה שטח הפנים של קובייה שמקצועה $4$?', fig: cube(4),
      choices: ['$96$', '$64$', '$48$'], answer: 0,
      why: '$6$ פאות של $4 \\cdot 4 = 16$: $96$.',
      wrongWhy: { 1: '$64 = 4^3$ הוא הנפח.', 2: '$48 = 3 \\cdot 16$: ספרתם רק את שלוש הפאות שרואים בשרטוט.' } },
    { kind: 'rule', text: 'סכום כל המקצועות של תיבה: $4$ מכל כיוון.', display: '4(a + b + c)',
      why: '$4$ מקצועות לאורך, $4$ לרוחב ו־$4$ לגובה.', fig: box(4, 3, 2) },
    { kind: 'predict', text: 'קופסה בלי מכסה, $6$ על $4$ על $3$ (הפתח $6$ על $4$). כמה קרטון?', fig: box(6, 4, 3, { open: true }),
      choices: ['$84$', '$108$', '$72$'], answer: 0,
      why: 'שטח הפנים המלא $2 \\cdot (24 + 18 + 12) = 108$, ובלי המכסה $6 \\cdot 4 = 24$: $84$.',
      wrongWhy: { 1: '$108$ כולל מכסה, ולקופסה אין מכסה.', 2: '$72$ הוא הנפח.' } },
  ],
  examples: [
    { problem: 'מה שטח הפנים של תיבה $7$ על $4$ על $3$ ס״מ?', answer: 122, check: '2*(7*4+7*3+4*3)', fig: box(7, 4, 3),
      steps: [
        { action: 'שלוש פאות שונות. הראשונה: $7$ על $4$.', why: 'למטה ולמעלה.', result: '7 \\cdot 4 = 28', calc: { expr: '7*4', value: 28 } },
        { action: 'השנייה: $7$ על $3$.', why: 'מקדימה ומאחור.', result: '7 \\cdot 3 = 21', calc: { expr: '7*3', value: 21 } },
        { action: 'השלישית: $4$ על $3$.', why: 'מימין ומשמאל.', result: '4 \\cdot 3 = 12', calc: { expr: '4*3', value: 12 } },
        { action: 'שלוש הפאות יחד.', why: 'אחת מכל זוג.', result: '28 + 21 + 12 = 61', calc: { expr: '28+21+12', value: 61 } },
        { action: 'כל פאה פעמיים: שטח הפנים בסמ״ר.', why: 'שש פאות, שלושה זוגות שווים.', result: '2 \\cdot 61 = 122', value: '2*61' },
      ] },
    { problem: 'מידות תיבה $x$, $x + 3$ ו־$5$ ס״מ, וסכום כל המקצועות שלה $64$ ס״מ. מה $x$?', answer: 4, check: '(64/4-3-5)/2',
      steps: [
        { action: 'שלושה מקצועות, אחד מכל כיוון: רבע מהסכום.', why: 'מכל כיוון $4$ מקצועות שווים.', result: '64 : 4 = 16', calc: { expr: '64/4', value: 16 } },
        { action: 'שלושת המקצועות יחד הם $16$, ובהם $x$ פעמיים.', why: '$x + (x + 3) + 5$ הוא $2x + 8$.', result: '2x = 16 - 3 - 5 = 8', calc: { expr: '16-3-5', value: 8 } },
        { action: 'מחלקים ב־$2$.', why: 'כדי שיישאר $x$ לבד.', result: 'x = 8 : 2 = 4', value: '8/2' },
        { action: 'בדיקה: התיבה $4$ על $7$ על $5$.', why: 'ארבעה מכל כיוון צריכים לתת $64$.', result: '4 \\cdot (4 + 7 + 5) = 64', calc: { expr: '4*(4+7+5)', value: 64 } },
      ] },
    { problem: 'שטח הפנים של קובייה $150$ סמ״ר. מה אורך המקצוע?', answer: 5, check: 'sqrt(150/6)',
      steps: [
        { action: 'שטח פאה אחת.', why: 'לקובייה שש פאות שוות.', result: '150 : 6 = 25', calc: { expr: '150/6', value: 25 } },
        { action: 'מספר שבריבוע נותן $25$.', why: 'כל פאה ריבוע: מקצוע כפול מקצוע.', result: '5 \\cdot 5 = 25', value: 'sqrt(25)' },
      ] },
  ],
  together: [
    { problem: 'קופסת מתנה $10$ על $6$ על $4$ ס״מ. כמה נייר עטיפה צריך, בלי חפיפות?', fig: box(10, 6, 4),
      steps: [
        { prompt: 'כמה פאות עוטפים?', choices: [
          { text: '$6$: שלושה זוגות', ok: true, feedback: 'נכון: למטה ולמעלה, מקדימה ומאחור, מימין ומשמאל.' },
          { text: '$3$', ok: false, feedback: 'לכל פאה יש פאה נגדית שווה לה.' },
          { text: '$4$', ok: false, feedback: 'גם למעלה ולמטה צריך נייר.' },
        ], hints: ['ספרו את הפאות של הקופסה.', 'שלושה זוגות של פאות שוות.'], done: 'שש פאות: $2 \\cdot (60 + 40 + 24)$.' },
      ],
      final: { prompt: 'כמה סמ״ר נייר?', answer: 248, check: '2*(10*6+10*4+6*4)', hints: ['$60 + 40 + 24 = 124$.', '$2 \\cdot 124$.'] } },
    { problem: 'קובייה שמקצועה $5$ ס״מ. מה שטח הפנים שלה?', fig: cube(5),
      steps: [
        { prompt: 'שטח פאה אחת:', choices: [
          { text: '$25$', ok: true, feedback: 'נכון: $5 \\cdot 5 = 25$.' },
          { text: '$20$', ok: false, feedback: '$20 = 4 \\cdot 5$ הוא ההיקף של הפאה.' },
        ], hints: ['כל פאה היא ריבוע.', '$5 \\cdot 5$.'], done: 'כל פאה $25$ סמ״ר.' },
      ],
      final: { prompt: 'שטח הפנים בסמ״ר:', answer: 150, check: '6*5*5', hints: ['לקובייה $6$ פאות.', '$6 \\cdot 25$.'] } },
  ],
  diag: solid1,
  transfer: solid1T,
  misconceptions: [
    { id: 'three-faces', title: 'ספרו רק שלוש פאות, אחת מכל זוג',
      cause: 'בשרטוט רואים רק שלוש פאות.',
      explain: ['לכל פאה שרואים יש פאה מאחור, שווה לה.', 'לכן מחברים שלוש פאות שונות וכופלים ב־$2$.'],
      remedy: [
        { kind: 'explore', text: 'קפלו את הפריסה, וספרו את הפאות של התיבה.', manip: foldBox, answer: { mode: 'fold', t: 1 },
          hint: 'כל פאה מתקפלת סביב הקו שמחבר אותה לשכנה.', success: 'שש פאות: כל פאה שרואים, ועוד אחת מאחוריה.' },
        { kind: 'predict', text: 'מה שטח הפנים של תיבה $4$ על $3$ על $2$?', fig: box(4, 3, 2), choices: ['$52$', '$26$'], answer: 0,
          why: '$12 + 8 + 6 = 26$, וכל פאה פעמיים: $52$.', wrongWhy: { 1: '$26$ הם רק שלוש פאות. לכל אחת יש פאה נגדית.' } },
      ] },
    { id: 'vol-for-surf', title: 'חישבו נפח במקום שטח פנים',
      cause: 'שני המספרים יוצאים מאותם שלושה מקצועות.',
      explain: ['שטח פנים הוא הקרטון מבחוץ, בסמ״ר.', 'נפח הוא מה שממלא את הקופסה, בסמ״ק.'],
      remedy: [
        { kind: 'predict', text: 'מה שטח הפנים של קובייה שמקצועה $2$?', fig: cube(2), choices: ['$24$', '$8$'], answer: 0,
          why: 'שש פאות של $2 \\cdot 2 = 4$: $24$.', wrongWhy: { 1: '$8 = 2 \\cdot 2 \\cdot 2$ הוא הנפח: כמה קוביות בפנים.' } },
      ] },
    { id: 'lid-counted', title: 'ספרו גם פאה שאין לקופסה',
      cause: 'הנוסחה סופרת שש פאות, ומשתמשים בה כמו שהיא.',
      explain: ['לקופסה בלי מכסה יש חמש פאות.', 'מחשבים את כל שש הפאות, ומורידים את הפתח.'],
      remedy: [
        { kind: 'predict', text: 'קופסה בלי מכסה, $5$ על $4$ על $2$ (הפתח $5$ על $4$). כמה קרטון?', fig: box(5, 4, 2, { open: true }), choices: ['$56$', '$76$'], answer: 0,
          why: 'כל שש הפאות $2 \\cdot (20 + 10 + 8) = 76$, ובלי הפתח $76 - 20 = 56$.', wrongWhy: { 1: '$76$ כולל את המכסה, ולקופסה אין מכסה.' } },
      ] },
    { id: 'three-edges', title: 'חיברו רק שלושה מקצועות, אחד מכל כיוון',
      cause: 'בשרטוט כתובים שלושה מספרים, ונדמה שהם כל המקצועות.',
      explain: ['לתיבה $12$ מקצועות: $4$ לאורך, $4$ לרוחב ו־$4$ לגובה.', 'לכן כופלים את סכום שלושת המקצועות ב־$4$.'],
      remedy: [
        { kind: 'predict', text: 'מה סכום כל המקצועות של תיבה $6$ על $4$ על $3$?', fig: box(6, 4, 3), choices: ['$52$', '$13$'], answer: 0,
          why: '$4 \\cdot (6 + 4 + 3) = 52$.', wrongWhy: { 1: '$13 = 6 + 4 + 3$ הם רק שלושה מתוך $12$ המקצועות.' } },
      ] },
  ],
  words: ['פאה', 'מקצוע', 'קודקוד', 'פריסה', 'פאות נגדיות', 'שטח פנים'],
};

// ================================================================ stair 2: the volume of a box and of a cube

const stair2: StairContent = {
  skill: 'solid:2', topic: 'solid', level: 2, title: 'נפח תיבה וקובייה',
  objectives: [
    'לחשב נפח של תיבה: אורך כפול רוחב כפול גובה, בסמ״ק.',
    'למצוא מקצוע חסר מהנפח, ומקצוע של קובייה מנפחה (שורש שלישי).',
    'לעבור בין סמ״ק לליטרים: $1000$ סמ״ק הם ליטר.',
  ],
  idea: 'נפח הוא כמה קוביות של $1$ סמ״ק ממלאות את הגוף: שכבה של אורך כפול רוחב קוביות, כמה שכבות כמו הגובה.',
  why: [
    'שטח הבסיס הוא מספר הקוביות בשכבה, והגובה הוא מספר השכבות.',
    'קובייה שמקצועה $10$ ס״מ מחזיקה בדיוק ליטר, ובה $10 \\cdot 10 \\cdot 10 = 1000$ קוביות של סמ״ק.',
  ],
  alt: ['ארגז בקבוקים: שורות כפול טורים בשכבה אחת, כפול מספר השכבות.'],
  discover: [
    { kind: 'say', text: 'נפח הוא כמה קוביות של $1$ סמ״ק ממלאות את הגוף.', fig: box(4, 3, 2, { cubes: true }) },
    { kind: 'predict', text: 'כמה קוביות בתיבה $4$ על $3$ על $2$?', fig: box(4, 3, 2, { cubes: true }),
      choices: ['$24$', '$9$', '$52$'], answer: 0,
      why: 'בשכבה אחת $4 \\cdot 3 = 12$ קוביות, ויש $2$ שכבות: $24$.',
      wrongWhy: { 1: '$4 + 3 + 2 = 9$ מחבר מקצועות.', 2: '$52$ הוא שטח הפנים: ריבועים על הדפנות, לא קוביות בפנים.' } },
    { kind: 'rule', text: 'נפח תיבה: אורך כפול רוחב כפול גובה. כלומר: שטח הבסיס כפול הגובה.', display: 'V = a \\cdot b \\cdot c',
      why: 'שטח הבסיס הוא כמה קוביות בשכבה, והגובה הוא כמה שכבות.', fig: box(4, 3, 2, { cubes: true }) },
    { kind: 'explore', text: 'בנו תיבה שנפחה $24$ סמ״ק וגובהה $2$.', manip: buildBox(2), answer: { mode: 'build', V: 24, fixed: { c: 2 } },
      hint: 'שתי שכבות של $24$: כמה קוביות בכל שכבה?',
      success: 'שכבה של $12$ קוביות, פעמיים: $24$.' },
    { kind: 'predict', text: 'מה הנפח של קובייה שמקצועה $5$?', fig: cube(5),
      choices: ['$125$', '$15$', '$25$'], answer: 0,
      why: '$5 \\cdot 5 \\cdot 5 = 5^3 = 125$.',
      wrongWhy: { 1: '$15 = 3 \\cdot 5$: חזקה שלישית היא כפל של המספר בעצמו שלוש פעמים.', 2: '$25$ הוא שטח של פאה אחת.' } },
    { kind: 'predict', text: 'נפח קובייה $64$ סמ״ק. מה המקצוע?', fig: cube(4, { labels: { a: '?' } }),
      choices: ['$4$', '$21\\frac{1}{3}$', '$8$'], answer: 0,
      why: '$4^3 = 64$: זה השורש השלישי של $64$.',
      wrongWhy: { 1: '$64 : 3$: שורש שלישי אינו חלוקה ב־$3$.', 2: '$8 \\cdot 8 = 64$, אבל בנפח שלושה מקצועות: $8^3 = 512$.' } },
    { kind: 'rule', text: 'ליטר אחד הוא $1000$ סמ״ק: קובייה שמקצועה $10$ ס״מ.', display: '10 \\cdot 10 \\cdot 10 = 1000',
      why: 'לכן מסמ״ק לליטרים מחלקים ב־$1000$.', fig: cube(10, { label: '1 ליטר' }) },
    { kind: 'predict', text: 'אקווריום $50$ על $30$ על $40$ ס״מ. כמה ליטרים הוא מחזיק?', fig: box(50, 30, 40),
      choices: ['$60$', '$60{,}000$', '$600$'], answer: 0,
      why: '$50 \\cdot 30 \\cdot 40 = 60{,}000$ סמ״ק, וזה $60$ ליטר.',
      wrongWhy: { 1: '$60{,}000$ הם סמ״ק. בליטר יש $1000$ סמ״ק.', 2: '$600$: חילקתם ב־$100$. בליטר יש $1000$ סמ״ק.' } },
  ],
  examples: [
    { problem: 'מה נפח תיבה $8$ על $5$ על $3$ ס״מ?', answer: 120, check: '8*5*3', fig: box(8, 5, 3),
      steps: [
        { action: 'שטח הבסיס.', why: 'כמה קוביות בשכבה אחת.', result: '8 \\cdot 5 = 40', calc: { expr: '8*5', value: 40 } },
        { action: 'כפול הגובה: הנפח בסמ״ק.', why: '$3$ שכבות.', result: '40 \\cdot 3 = 120', value: '40*3' },
      ] },
    { problem: 'נפח תיבה $180$ סמ״ק, ובסיסה $6$ על $5$ ס״מ. מה גובהה?', answer: 6, check: '180/(6*5)',
      steps: [
        { action: 'שטח הבסיס.', why: 'כמה קוביות בכל שכבה.', result: '6 \\cdot 5 = 30', calc: { expr: '6*5', value: 30 } },
        { action: 'נפח לחלק לשטח הבסיס.', why: 'כמה שכבות של $30$ קוביות יש ב־$180$.', result: '180 : 30 = 6', value: '180/30' },
      ] },
    { problem: 'מיכל בצורת תיבה, בסיסו $25$ על $20$ ס״מ. שופכים לתוכו $6$ ליטרים. לאיזה גובה יגיעו המים?', answer: 12, check: '6000/(25*20)',
      steps: [
        { action: '$6$ ליטרים בסמ״ק.', why: 'ליטר אחד הוא $1000$ סמ״ק.', result: '6 \\cdot 1000 = 6000', calc: { expr: '6*1000', value: 6000 } },
        { action: 'שטח הבסיס.', why: 'המים ממלאים שכבות על הבסיס.', result: '25 \\cdot 20 = 500', calc: { expr: '25*20', value: 500 } },
        { action: 'נפח לחלק לשטח הבסיס: הגובה בס״מ.', why: 'כמה שכבות של $500$ סמ״ק יש ב־$6000$.', result: '6000 : 500 = 12', value: '6000/500' },
      ] },
  ],
  together: [
    { problem: 'תבנית אפייה $30$ על $20$ על $5$ ס״מ. כמה סמ״ק בצק נכנסים בה?', fig: box(30, 20, 5, { open: true }),
      steps: [
        { prompt: 'מה מחשבים?', choices: [
          { text: 'נפח: $30 \\cdot 20 \\cdot 5$', ok: true, feedback: 'נכון: הבצק ממלא את הפנים.' },
          { text: 'שטח פנים', ok: false, feedback: 'שטח פנים הוא הקרטון מבחוץ. בצק ממלא את הפנים.' },
        ], hints: ['הבצק ממלא או עוטף?', 'מה שממלא הוא נפח.'], done: 'מחשבים נפח: $30 \\cdot 20 \\cdot 5$.' },
      ],
      final: { prompt: 'כמה סמ״ק?', answer: 3000, check: '30*20*5', hints: ['$30 \\cdot 20 = 600$ בשכבה.', '$600 \\cdot 5$.'] } },
    { problem: 'כמה קוביות שמקצוען $2$ ס״מ נכנסות בתיבה $8$ על $6$ על $4$ ס״מ?', fig: box(8, 6, 4),
      steps: [
        { prompt: 'כמה קוביות לאורך $8$?', choices: [
          { text: '$4$', ok: true, feedback: 'נכון: $8 : 2 = 4$.' },
          { text: '$8$', ok: false, feedback: 'כל קובייה תופסת $2$ ס״מ.' },
        ], hints: ['כמה פעמים $2$ ס״מ נכנסים ב־$8$ ס״מ?', '$8 : 2$.'], done: '$4$ לאורך. ובאותו אופן $3$ לרוחב ו־$2$ לגובה.' },
      ],
      final: { prompt: 'כמה קוביות?', answer: 24, check: '(8/2)*(6/2)*(4/2)', hints: ['$4$ לאורך, $3$ לרוחב, $2$ לגובה.', '$4 \\cdot 3 \\cdot 2$.'] } },
  ],
  diag: solid2,
  transfer: solid2T,
  misconceptions: [
    { id: 'surf-for-vol', title: 'חישבו שטח פנים במקום נפח',
      cause: 'רואים את הקופסה מבחוץ, את הפאות שלה, ולא את הקוביות שבפנים.',
      explain: ['נפח סופר קוביות בפנים: שכבה, כפול מספר השכבות.', 'שטח פנים סופר ריבועים על הדפנות, מבחוץ.'],
      remedy: [
        { kind: 'explore', text: 'בנו תיבה שנפחה $12$ סמ״ק וגובהה $2$, וספרו את הקוביות שכבה אחרי שכבה.', manip: buildBox(2), answer: { mode: 'build', V: 12, fixed: { c: 2 } },
          hint: 'שתי שכבות של $12$: $6$ קוביות בכל שכבה.', success: 'שכבה של $6$ קוביות, פעמיים: $12$ קוביות בפנים.' },
        { kind: 'predict', text: 'מה הנפח של תיבה $3$ על $2$ על $2$?', fig: box(3, 2, 2, { cubes: true }), choices: ['$12$', '$32$'], answer: 0,
          why: 'שכבה של $3 \\cdot 2 = 6$ קוביות, פעמיים: $12$.', wrongWhy: { 1: '$32$ הוא שטח הפנים: הריבועים על הדפנות.' } },
      ] },
    { id: 'add-edges', title: 'חיברו את המקצועות במקום לכפול',
      cause: 'כתובים שלושה מספרים, ונדמה שמחברים אותם.',
      explain: ['בשכבה יש אורך כפול רוחב קוביות.', 'ויש כמה שכבות כמו הגובה: כופלים, לא מחברים.'],
      remedy: [
        { kind: 'predict', text: 'כמה קוביות בתיבה $3$ על $2$ על $2$?', fig: box(3, 2, 2, { cubes: true }), choices: ['$12$', '$7$'], answer: 0,
          why: '$3 \\cdot 2 \\cdot 2 = 12$.', wrongWhy: { 1: '$7 = 3 + 2 + 2$ לא סופר קוביות. ספרו שכבות.' } },
      ] },
    { id: 'cube-times3', title: 'כפלו ב־$3$ במקום להעלות בחזקה שלישית',
      cause: '"בחזקה $3$" נשמע כמו "כפול $3$".',
      explain: ['$4^3$ הוא $4 \\cdot 4 \\cdot 4$: המספר כפול עצמו שלוש פעמים.', 'כפול $3$ הוא חיבור חוזר: $4 + 4 + 4$.'],
      remedy: [
        { kind: 'predict', text: 'מה הנפח של קובייה שמקצועה $4$?', fig: cube(4), choices: ['$64$', '$12$'], answer: 0,
          why: '$4^3 = 4 \\cdot 4 \\cdot 4 = 64$.', wrongWhy: { 1: '$12 = 3 \\cdot 4$: זה כפל ב־$3$, לא חזקה שלישית.' } },
      ] },
    { id: 'no-convert', title: 'שכחו להמיר בין סמ״ק לליטרים',
      cause: 'המספר יוצא מהכפל בסמ״ק, ושוכחים שהשאלה בליטרים.',
      explain: ['ליטר אחד הוא $1000$ סמ״ק: קובייה שמקצועה $10$ ס״מ.', 'מסמ״ק לליטרים מחלקים ב־$1000$.'],
      remedy: [
        { kind: 'predict', text: '$2000$ סמ״ק הם:', fig: cube(10, { label: '1 ליטר' }), choices: ['$2$ ליטרים', '$2000$ ליטרים'], answer: 0,
          why: 'בכל ליטר $1000$ סמ״ק: $2000 : 1000 = 2$.', wrongWhy: { 1: '$2000$ הם סמ״ק. ליטר גדול פי $1000$ מסמ״ק.' } },
      ] },
    { id: 'one-divide', title: 'חילקו רק באחד המקצועות',
      cause: 'מחלקים במספר הראשון שכתוב, ושוכחים שגם השני הוא חלק מהבסיס.',
      explain: ['הנפח הוא שטח הבסיס כפול הגובה.', 'לכן מחלקים בשטח הבסיס: אורך כפול רוחב.'],
      remedy: [
        { kind: 'predict', text: 'נפח תיבה $60$, ובסיסה $5$ על $3$. מה הגובה?', fig: box(5, 3, 4, { labels: { c: '?' } }), choices: ['$4$', '$12$'], answer: 0,
          why: 'שטח הבסיס $15$, ו־$60 : 15 = 4$.', wrongWhy: { 1: '$12 = 60 : 5$: חילקתם רק באורך. מחלקים בשטח הבסיס.' } },
      ] },
    { id: 'div-by-edge', title: 'חילקו את הנפח במקצוע של הקובייה הקטנה ולא בנפח שלה',
      cause: 'הקובייה הקטנה היא "קובייה של $2$", ונדמה שמחלקים ב־$2$.',
      explain: ['קובייה שמקצועה $2$ ס״מ תופסת $2 \\cdot 2 \\cdot 2 = 8$ סמ״ק.', 'הכי פשוט: סופרים כמה נכנסות לאורך, לרוחב ולגובה, וכופלים.'],
      remedy: [
        { kind: 'predict', text: 'כמה קוביות שמקצוען $2$ ס״מ נכנסות בתיבה $6$ על $4$ על $4$ ס״מ?', fig: box(6, 4, 4), choices: ['$12$', '$48$'], answer: 0,
          why: '$3$ לאורך, $2$ לרוחב ו־$2$ לגובה: $3 \\cdot 2 \\cdot 2 = 12$.', wrongWhy: { 1: '$48 = 96 : 2$: חילקתם במקצוע. כל קובייה תופסת $8$ סמ״ק.' } },
      ] },
  ],
  words: ['נפח', 'סמ״ק', 'שכבה', 'שטח הבסיס', 'ליטר', 'חזקה שלישית', 'שורש שלישי'],
};

// ================================================================ stair 3: the triangular prism, its net and its surface

const stair3: StairContent = {
  skill: 'solid:3', topic: 'solid', level: 3, title: 'מנסרה משולשת: פריסה ושטח פנים',
  objectives: [
    'להכיר מנסרה משולשת ישרה: שני בסיסים משולשים חופפים ושלוש פאות צדדיות מלבניות.',
    'לזהות ולהשלים פריסה של מנסרה משולשת.',
    'לחשב שטח פנים: שני משולשים ועוד שלושה מלבנים, ולמצוא צלע חסרה בפיתגורס כשצריך.',
  ],
  idea: 'מנסרה משולשת ישרה היא כמו תיבה שבסיסה משולש: שני משולשים זהים למעלה ולמטה, ושלושה מלבנים, אחד לכל צלע של המשולש.',
  why: [
    'בפריסה שלוש הפאות הצדדיות יוצרות מלבן אחד: רוחבו היקף המשולש וגובהו אורך המנסרה.',
    'לכן שטח הפנים הוא שני משולשים ועוד היקף הבסיס כפול האורך.',
  ],
  alt: ['קופסת שוקולד בצורת "גג": שני משולשים בקצוות, ושלושה מלבנים מסביב.'],
  discover: [
    { kind: 'say', text: 'מנסרה משולשת ישרה: שני משולשים חופפים, מקבילים זה לזה, ושלושה מלבנים ביניהם.',
      fig: rprism(3, 4, 10, { r: 5, label: 'בסיסים ופאות צדדיות' }) },
    { kind: 'explore', text: 'קפלו את הפריסה למנסרה.', manip: foldPrism, answer: { mode: 'fold', t: 1 },
      hint: 'קודם מקפלים את שלושת המלבנים לצינור, ואחר כך את המשולשים.',
      success: 'חמש פאות: שני משולשים ושלושה מלבנים.' },
    { kind: 'predict', text: 'כמה פאות יש למנסרה משולשת?', fig: rprism(3, 4, 10, { r: 5, labels: false }),
      choices: ['$5$', '$6$', '$3$'], answer: 0,
      why: '$2$ בסיסים ועוד $3$ פאות צדדיות, אחת לכל צלע של המשולש.',
      wrongWhy: { 1: 'לתיבה $6$ פאות. למשולש $3$ צלעות, ולכן $3$ פאות צדדיות.', 2: '$3$ הן רק הפאות הצדדיות. יש גם שני בסיסים.' } },
    { kind: 'rule', text: 'שטח הפאות הצדדיות: היקף הבסיס כפול אורך המנסרה.', display: '(3 + 4 + 5) \\cdot 10 = 120',
      why: 'בפריסה הן מלבן אחד שרוחבו היקף המשולש.', fig: netfig('prism', { p: 3, q: 4, r: 5, L: 10 }, { labels: true }) },
    { kind: 'predict', text: 'מה שטח הפנים של מנסרה שבסיסה משולש $3$, $4$, $5$ ואורכה $10$?', fig: rprism(3, 4, 10, { r: 5 }),
      choices: ['$132$', '$126$', '$82$'], answer: 0,
      why: 'שני בסיסים $2 \\cdot 6 = 12$, ועוד $120$: $132$.',
      wrongWhy: { 1: '$126$: ספרתם בסיס אחד. למנסרה שני בסיסים.', 2: '$82$: חסרה הפאה שעל היתר, $5 \\cdot 10 = 50$.' } },
    { kind: 'rule', text: 'שטח פנים של מנסרה: שני בסיסים ועוד הפאות הצדדיות.', display: 'S = 2 \\cdot \\frac{3 \\cdot 4}{2} + (3 + 4 + 5) \\cdot 10 = 132',
      why: 'הבסיסים הם משולשים: צלע כפול הגובה אליה, חלקי $2$.', fig: netfig('prism', { p: 3, q: 4, r: 5, L: 10 }, { labels: 'area' }) },
    { kind: 'predict', text: 'בסיס המנסרה משולש ישר־זווית שניצביו $6$ ו־$8$, ואורכה $5$. מה רוחב הפאה שעל היתר?', fig: rprism(6, 8, 5, { r: 10, labels: { r: '?' } }),
      choices: ['$10$', '$14$', '$2$'], answer: 0,
      why: '$\\sqrt{6^2 + 8^2} = \\sqrt{100} = 10$.',
      wrongWhy: { 1: '$6 + 8$: היתר קצר מסכום הניצבים.', 2: '$8 - 6$: מחסרים רק כשמחפשים ניצב, ובריבועים.' } },
    { kind: 'explore', text: 'גררו את הבסיס החסר למקום שבו הפריסה נסגרת.', manip: fixPrism, answer: { mode: 'slot', ok: S.PRISM_FIX_OK },
      hint: 'הבסיס השני צריך להיות בקצה השני של הפאות הצדדיות.',
      success: 'נסגר: משולש בכל קצה.' },
  ],
  examples: [
    { problem: 'מנסרה ישרה שבסיסה משולש ישר־זווית: ניצבים $5$ ו־$12$ ס״מ, יתר $13$ ס״מ, ואורכה $8$ ס״מ. מה שטח הפנים?', answer: 300,
      check: '2*(5*12/2)+(5+12+13)*8', fig: rprism(5, 12, 8, { r: 13 }),
      steps: [
        { action: 'בסיס אחד.', why: 'במשולש ישר־זווית ניצב אחד הוא הגובה לשני.', result: '\\frac{5 \\cdot 12}{2} = 30', calc: { expr: '5*12/2', value: 30 } },
        { action: 'שני בסיסים.', why: 'משולש בכל קצה.', result: '2 \\cdot 30 = 60', calc: { expr: '2*30', value: 60 } },
        { action: 'הפאות הצדדיות.', why: 'מלבן אחד שרוחבו היקף הבסיס.', result: '(5 + 12 + 13) \\cdot 8 = 240', calc: { expr: '(5+12+13)*8', value: 240 } },
        { action: 'שטח הפנים בסמ״ר.', why: 'שני הבסיסים ועוד הפאות הצדדיות.', result: '60 + 240 = 300', value: '60+240' },
      ] },
    { problem: 'קופסת עוגיות בצורת מנסרה: הבסיס משולש שווה־שוקיים שבסיסו $8$ ס״מ, גובהו $3$ ס״מ ושוקיו $5$ ס״מ; אורך הקופסה $10$ ס״מ. כמה קרטון לכל הפאות?',
      answer: 204, check: '8*3+(8+5+5)*10', fig: hprism(8, 3, 5, 10),
      steps: [
        { action: 'שני המשולשים.', why: 'כל אחד $\\frac{8 \\cdot 3}{2} = 12$. הגובה הוא $3$, לא השוק.', result: '2 \\cdot 12 = 24', calc: { expr: '8*3', value: 24 } },
        { action: 'שלושת המלבנים.', why: 'היקף הבסיס כפול האורך.', result: '(8 + 5 + 5) \\cdot 10 = 180', calc: { expr: '(8+5+5)*10', value: 180 } },
        { action: 'כל הקרטון בסמ״ר.', why: 'שני המשולשים ועוד שלושת המלבנים.', result: '24 + 180 = 204', value: '24+180' },
      ] },
    { problem: 'בסיס המנסרה משולש שווה־צלעות שצלעו $6$ ס״מ, ואורכה $9$ ס״מ. מה שטח הפאות הצדדיות?', answer: 162, check: '3*6*9',
      steps: [
        { action: 'היקף הבסיס.', why: 'שלוש צלעות של $6$.', result: '3 \\cdot 6 = 18', calc: { expr: '3*6', value: 18 } },
        { action: 'כפול האורך: השטח בסמ״ר.', why: 'בפריסה הפאות הצדדיות הן מלבן $18$ על $9$.', result: '18 \\cdot 9 = 162', value: '18*9' },
      ] },
  ],
  together: [
    { problem: 'קופסה בצורת מנסרה: בסיס משולש ישר־זווית, ניצבים $9$ ו־$12$, יתר $15$, ואורך $20$ ס״מ. כמה קרטון?', fig: rprism(9, 12, 20, { r: 15 }),
      steps: [
        { prompt: 'כמה בסיסים?', choices: [
          { text: '$2$', ok: true, feedback: 'נכון: משולש בכל קצה.' },
          { text: '$1$', ok: false, feedback: 'משולש בכל קצה.' },
        ], hints: ['הסתכלו על שני הקצוות של הקופסה.', 'יש משולש מקדימה ומשולש מאחור.'], done: 'שני בסיסים: $2 \\cdot 54 = 108$.' },
        { prompt: 'הפאות הצדדיות:', choices: [
          { text: '$(9 + 12 + 15) \\cdot 20$', ok: true, feedback: 'נכון: היקף הבסיס כפול האורך.' },
          { text: '$(9 + 12) \\cdot 20$', ok: false, feedback: 'שכחתם את הפאה שעל היתר.' },
        ], hints: ['פאה לכל צלע של המשולש.', 'גם על היתר יש פאה.'], done: 'הפאות הצדדיות: $36 \\cdot 20 = 720$.' },
      ],
      final: { prompt: 'כמה סמ״ר קרטון?', answer: 828, check: '2*(9*12/2)+(9+12+15)*20', hints: ['$108$ ועוד $720$.', '$108 + 720$.'] } },
    { problem: 'בסיס המנסרה משולש ישר־זווית שניצביו $6$ ו־$8$ ס״מ (היתר לא נתון), ואורכה $10$ ס״מ. מה שטח הפנים?', fig: rprism(6, 8, 10),
      steps: [
        { prompt: 'היתר:', choices: [
          { text: '$10$', ok: true, feedback: 'נכון: $\\sqrt{36 + 64} = 10$.' },
          { text: '$14$', ok: false, feedback: 'היתר מפיתגורס: $\\sqrt{36 + 64}$.' },
        ], hints: ['משפט פיתגורס.', '$\\sqrt{6^2 + 8^2}$.'], done: 'היתר $10$, והיקף הבסיס $24$.' },
      ],
      final: { prompt: 'שטח הפנים בסמ״ר:', answer: 288, check: '2*(6*8/2)+(6+8+10)*10', hints: ['שני בסיסים $48$, ופאות צדדיות $24 \\cdot 10$.', '$48 + 240$.'] } },
  ],
  diag: solid3,
  transfer: solid3T,
  misconceptions: [
    { id: 'one-base', title: 'ספרו רק בסיס אחד',
      cause: 'בשרטוט רואים את המשולש שמקדימה, והמשולש שמאחור מוסתר.',
      explain: ['למנסרה שני בסיסים: משולש בכל קצה.', 'בפריסה רואים את שניהם, משני צדי הרצועה.'],
      remedy: [
        { kind: 'explore', text: 'קפלו את הפריסה, ושימו לב לשני המשולשים.', manip: foldPrism, answer: { mode: 'fold', t: 1 },
          hint: 'קודם מקפלים את שלושת המלבנים לצינור, ואחר כך את המשולשים.', success: 'משולש סוגר כל קצה: שני בסיסים.' },
        { kind: 'predict', text: 'בסיס המנסרה משולש $3$, $4$, $5$, ואורכה $2$. מה שטח הפנים?', fig: rprism(3, 4, 2, { r: 5 }), choices: ['$36$', '$30$'], answer: 0,
          why: 'שני בסיסים $2 \\cdot 6 = 12$, ופאות צדדיות $12 \\cdot 2 = 24$: $36$.', wrongWhy: { 1: '$30$: ספרתם בסיס אחד. למנסרה שניים.' } },
      ] },
    { id: 'missing-face', title: 'שכחו את הפאה הצדדית שעל היתר',
      cause: 'הפאה שעל היתר נמצאת מאחור בשרטוט.',
      explain: ['לכל צלע של המשולש יש פאה צדדית: שלוש פאות.', 'יחד הן מלבן שרוחבו כל היקף המשולש, גם היתר.'],
      remedy: [
        { kind: 'predict', text: 'בסיס המנסרה משולש $6$, $8$, $10$, ואורכה $5$. מה שטח הפנים?', fig: rprism(6, 8, 5, { r: 10 }), choices: ['$168$', '$118$'], answer: 0,
          why: 'בסיסים $48$, ופאות צדדיות $(6 + 8 + 10) \\cdot 5 = 120$: $168$.', wrongWhy: { 1: '$118$: חסרה הפאה שעל היתר, $10 \\cdot 5 = 50$.' } },
      ] },
    { id: 'slant-as-height', title: 'כפלו בצלע משופעת במקום בגובה',
      cause: 'השוק המשופעת נראית גבוהה, ונדמה שהיא הגובה של המשולש.',
      explain: ['גובה המשולש ניצב לבסיס שלו.', 'השוק משופעת, והיא ארוכה מהגובה.'],
      remedy: [
        { kind: 'predict', text: 'אוהל: הבסיס משולש שווה־שוקיים, צלע $6$ על הקרקע, גובה $4$ ושוקיים $5$. אורך האוהל $10$. כמה בד לכל הפאות?', fig: hprism(6, 4, 5, 10),
          choices: ['$184$', '$190$'], answer: 0,
          why: 'שני משולשים $6 \\cdot 4 = 24$, ושלושה מלבנים $(6 + 5 + 5) \\cdot 10 = 160$: $184$.', wrongWhy: { 1: '$190$: כפלתם בשוק $5$ במקום בגובה $4$.' } },
      ] },
    { id: 'add-legs', title: 'חיברו את הצלעות בלי לרבע',
      cause: 'היתר נראה כמו המשך של שני הניצבים.',
      explain: ['היתר קצר מסכום הניצבים: הדרך הישרה קצרה מהדרך בפינה.', 'מוצאים אותו בפיתגורס, ורק אז מחברים להיקף הבסיס.'],
      remedy: [
        { kind: 'predict', text: 'בסיס המנסרה משולש ישר־זווית שניצביו $6$ ו־$8$, ואורכה $5$. מה רוחב הפאה שעל היתר?', fig: rprism(6, 8, 5, { r: 10, labels: { r: '?' } }),
          choices: ['$10$', '$14$'], answer: 0,
          why: '$\\sqrt{36 + 64} = \\sqrt{100} = 10$.', wrongWhy: { 1: '$14 = 6 + 8$: היתר קצר מסכום הניצבים.' } },
      ] },
  ],
  words: ['מנסרה משולשת ישרה', 'בסיסי המנסרה', 'פאות צדדיות', 'אורך המנסרה', 'פריסה'],
};

// ================================================================ stair 4: the volume of a prism

const stair4: StairContent = {
  skill: 'solid:4', topic: 'solid', level: 4, title: 'נפח מנסרה',
  objectives: [
    'לחשב נפח מנסרה: שטח הבסיס כפול האורך.',
    'לראות מנסרה שבסיסה משולש ישר־זווית כחצי תיבה.',
    'לדעת מה קורה לשטח ולנפח כשמכפילים את כל המקצועות, ולבטא נפח בעזרת משתנה.',
  ],
  idea: 'נפח של כל מנסרה: שטח הבסיס כפול האורך, כמו בתיבה. מנסרה שבסיסה משולש ישר־זווית היא חצי מתיבה.',
  why: [
    'בכל שכבה בעובי $1$ יש כמה קוביות כמו שטח הבסיס, ויש כמה שכבות כמו האורך.',
    'כשכל מקצוע גדל פי $2$, הנפח גדל פי $2 \\cdot 2 \\cdot 2 = 8$: פי $2$ בכל אחד משלושת הכיוונים.',
  ],
  alt: ['פרוסות לחם: כל פרוסה היא הבסיס, ומספר הפרוסות הוא האורך.'],
  discover: [
    { kind: 'say', text: 'תיבה שחותכים לאורך אלכסון של הבסיס נחצית לשתי מנסרות זהות.', fig: box(6, 4, 5, { cut: 'diagonal' }) },
    { kind: 'predict', text: 'תיבה $6$ על $4$ על $5$ נחתכה לאורך אלכסון הבסיס. מה הנפח של כל מנסרה?', fig: box(6, 4, 5, { cut: 'diagonal' }),
      choices: ['$60$', '$120$', '$30$'], answer: 0,
      why: 'התיבה $6 \\cdot 4 \\cdot 5 = 120$, וכל מנסרה חצי ממנה: $60$.',
      wrongWhy: { 1: '$120$ היא כל התיבה.', 2: '$30$ הוא רבע.' } },
    { kind: 'rule', text: 'נפח מנסרה: שטח הבסיס כפול האורך.', display: 'V = \\frac{6 \\cdot 4}{2} \\cdot 5 = 60',
      why: 'בכל שכבה כמה קוביות כמו שטח הבסיס, וכמה שכבות כמו האורך. כמו בתיבה.', fig: rprism(6, 4, 5) },
    { kind: 'explore', text: 'בנו מנסרה שנפחה $36$ ואורכה $6$.', manip: buildPrism(6), answer: { mode: 'build', V: 36, fixed: { L: 6 } },
      hint: 'שטח הבסיס צריך להיות $36 : 6 = 6$. אילו ניצבים נותנים משולש בשטח $6$?',
      success: 'ניצבים $3$ ו־$4$: בסיס $6$, כפול $6$: $36$.' },
    { kind: 'predict', text: 'בסיס המנסרה משולש: צלע $10$, הגובה אליה $3$, וצלע משופעת $5$. אורך המנסרה $8$. מה הנפח?', fig: hprism(10, 3, 5, 8),
      choices: ['$120$', '$200$', '$240$'], answer: 0,
      why: 'שטח הבסיס $\\frac{10 \\cdot 3}{2} = 15$, ו־$15 \\cdot 8 = 120$.',
      wrongWhy: { 1: '$200$: $5$ היא צלע משופעת של המשולש, לא הגובה שלו.', 2: '$240$: הבסיס הוא משולש, חצי מלבן.' } },
    { kind: 'predict', text: 'מכפילים כל מקצוע של קובייה פי $2$. הנפח גדל פי:', fig: cube(2, { cubes: true }),
      choices: ['$8$', '$2$', '$4$'], answer: 0,
      why: '$2 \\cdot 2 \\cdot 2 = 8$: פי $2$ באורך, ברוחב ובגובה.',
      wrongWhy: { 1: 'כל מקצוע גדל פי $2$, אבל הנפח הוא מכפלה של שלושה.', 2: 'פי $4$ גדל השטח של כל פאה.' } },
    { kind: 'rule', text: 'כשכל המקצועות גדלים פי $k$: השטח גדל פי $k^2$, והנפח פי $k^3$.', display: '2^2 = 4,\\qquad 2^3 = 8',
      why: 'בשטח שני כיוונים, בנפח שלושה.', fig: cube(2, { cubes: true, label: 'k = 2' }) },
    { kind: 'predict', text: 'בסיס המנסרה משולש ישר־זווית שניצביו $x$ ו־$4$, ואורכה $10$. מה הנפח?', fig: rprism(5, 4, 10, { labels: { p: 'x' } }),
      choices: ['$20x$', '$40x$', '$14x$'], answer: 0,
      why: '$\\frac{4x}{2} \\cdot 10 = 20x$.',
      wrongWhy: { 1: '$40x$: הבסיס חצי מלבן.', 2: '$14x$ מחבר מספרים שצריך לכפול.' } },
  ],
  examples: [
    { problem: 'מנסרה שבסיסה משולש ישר־זווית: ניצבים $6$ ו־$8$ ס״מ, יתר $10$ ס״מ, אורך $12$ ס״מ. מה הנפח?', answer: 288, check: '6*8/2*12', fig: rprism(6, 8, 12, { r: 10 }),
      steps: [
        { action: 'שטח הבסיס.', why: 'הניצבים הם צלע והגובה אליה. היתר לא נכנס לשטח.', result: '\\frac{6 \\cdot 8}{2} = 24', calc: { expr: '6*8/2', value: 24 } },
        { action: 'כפול האורך: הנפח בסמ״ק.', why: '$12$ שכבות של $24$.', result: '24 \\cdot 12 = 288', value: '24*12' },
      ] },
    { problem: 'אותה קופסת עוגיות: בסיס משולש שבסיסו $8$ ס״מ וגובהו $3$ ס״מ, אורך $10$ ס״מ. מה נפחה?', answer: 120, check: '8*3/2*10', fig: hprism(8, 3, 5, 10),
      steps: [
        { action: 'שטח הבסיס.', why: 'צלע כפול הגובה אליה, חלקי $2$.', result: '\\frac{8 \\cdot 3}{2} = 12', calc: { expr: '8*3/2', value: 12 } },
        { action: 'כפול האורך: הנפח בסמ״ק.', why: '$10$ שכבות של $12$.', result: '12 \\cdot 10 = 120', value: '12*10' },
      ] },
    { problem: 'נפח מנסרה $168$ סמ״ק, ובסיסה משולש ישר־זווית שניצביו $4$ ו־$7$ ס״מ. מה אורכה?', answer: 12, check: '168/(4*7/2)',
      steps: [
        { action: 'שטח הבסיס.', why: 'חצי מכפלת הניצבים.', result: '\\frac{4 \\cdot 7}{2} = 14', calc: { expr: '4*7/2', value: 14 } },
        { action: 'הנפח לחלק לשטח הבסיס: האורך בס״מ.', why: 'כמה שכבות של $14$ יש ב־$168$.', result: '168 : 14 = 12', value: '168/14' },
      ] },
  ],
  together: [
    { problem: 'שוקת בצורת מנסרה: הבסיס משולש שצלעו $60$ ס״מ והגובה אליה $30$ ס״מ, ואורכה $200$ ס״מ. כמה ליטרים מים היא מחזיקה?',
      steps: [
        { prompt: 'שטח הבסיס:', choices: [
          { text: '$900$', ok: true, feedback: 'נכון: $\\frac{60 \\cdot 30}{2} = 900$.' },
          { text: '$1800$', ok: false, feedback: 'שכחתם לחלק ב־$2$.' },
        ], hints: ['צלע כפול הגובה אליה, חלקי $2$.', '$\\frac{60 \\cdot 30}{2}$.'], done: 'שטח הבסיס $900$ סמ״ר.' },
        { prompt: 'הנפח בסמ״ק:', choices: [
          { text: '$180{,}000$', ok: true, feedback: 'נכון: $900 \\cdot 200$.' },
          { text: '$1800$', ok: false, feedback: '$1800 = 900 \\cdot 2$: האורך הוא $200$, לא $2$.' },
        ], hints: ['שטח הבסיס כפול האורך.', '$900 \\cdot 200$.'], done: 'הנפח $180{,}000$ סמ״ק.' },
      ],
      final: { prompt: 'כמה ליטרים?', answer: 180, check: '60*30/2*200/1000', hints: ['בליטר $1000$ סמ״ק.', '$180{,}000 : 1000$.'] } },
    { problem: 'מנסרה: ניצבים $5$ ו־$12$, יתר $13$, אורך $10$. מה הנפח?', fig: rprism(5, 12, 10, { r: 13 }),
      steps: [
        { prompt: 'מאילו צלעות שטח הבסיס?', choices: [
          { text: '$5$ ו־$12$', ok: true, feedback: 'נכון: הניצבים, ניצב אחד הוא הגובה לשני.' },
          { text: '$12$ ו־$13$', ok: false, feedback: 'היתר אינו גובה לאף ניצב.' },
        ], hints: ['איזו צלע ניצבת לאיזו?', 'שני הניצבים, שליד הזווית הישרה.'], done: 'שטח הבסיס $\\frac{5 \\cdot 12}{2} = 30$.' },
      ],
      final: { prompt: 'הנפח:', answer: 300, check: '5*12/2*10', hints: ['שטח הבסיס כפול האורך.', '$30 \\cdot 10$.'] } },
  ],
  diag: solid4,
  transfer: solid4T,
  misconceptions: [
    { id: 'no-half', title: 'חישבו נפח של תיבה, בלי לחלק ב־2 את הבסיס', prereq: 'area:2',
      cause: 'זוכרים "אורך כפול רוחב כפול גובה" מהתיבה, ושוכחים שהבסיס משולש.',
      explain: ['מנסרה שבסיסה משולש ישר־זווית היא חצי תיבה.', 'שטח הבסיס הוא חצי מכפלת הניצבים.'],
      remedy: [
        { kind: 'say', text: 'תיבה שחותכים לאורך אלכסון הבסיס נחצית לשתי מנסרות זהות: כל אחת חצי תיבה.', fig: box(6, 4, 5, { cut: 'diagonal' }) },
        { kind: 'predict', text: 'בסיס המנסרה משולש ישר־זווית שניצביו $3$ ו־$4$, ואורכה $5$. מה הנפח?', fig: rprism(3, 4, 5), choices: ['$30$', '$60$'], answer: 0,
          why: 'שטח הבסיס $\\frac{3 \\cdot 4}{2} = 6$, ו־$6 \\cdot 5 = 30$.', wrongWhy: { 1: '$60 = 3 \\cdot 4 \\cdot 5$ היא כל התיבה. המנסרה חצי ממנה.' } },
      ] },
    { id: 'hyp-as-height', title: 'כפלו ביתר במקום בניצב',
      cause: 'היתר הוא הצלע הארוכה, ונדמה שהיא הגובה.',
      explain: ['במשולש ישר־זווית הניצבים הם צלע והגובה אליה.', 'היתר אינו ניצב לאף ניצב, ולכן הוא לא נכנס לשטח הבסיס.'],
      remedy: [
        { kind: 'predict', text: 'בסיס המנסרה משולש $3$, $4$, $5$ (ניצבים $3$ ו־$4$), ואורכה $5$. מה הנפח?', fig: rprism(3, 4, 5, { r: 5 }), choices: ['$30$', '$50$'], answer: 0,
          why: 'שטח הבסיס מהניצבים: $\\frac{3 \\cdot 4}{2} = 6$, ו־$6 \\cdot 5 = 30$.', wrongWhy: { 1: '$50 = \\frac{4 \\cdot 5}{2} \\cdot 5$: היתר $5$ אינו הגובה.' } },
      ] },
    { id: 'slant-as-height', title: 'כפלו בצלע משופעת במקום בגובה',
      cause: 'הצלע המשופעת נראית גבוהה, ונדמה שהיא הגובה של המשולש.',
      explain: ['גובה המשולש ניצב לצלע שהוא יורד אליה.', 'צלע משופעת ארוכה מהגובה, ולכן היא נותנת נפח גדול מדי.'],
      remedy: [
        { kind: 'predict', text: 'בסיס המנסרה משולש: צלע $6$, הגובה אליה $4$, וצלע משופעת $5$. אורך המנסרה $10$. מה הנפח?', fig: hprism(6, 4, 5, 10), choices: ['$120$', '$150$'], answer: 0,
          why: 'שטח הבסיס $\\frac{6 \\cdot 4}{2} = 12$, ו־$12 \\cdot 10 = 120$.', wrongWhy: { 1: '$150$: כפלתם בצלע המשופעת $5$ במקום בגובה $4$.' } },
      ] },
    { id: 'linear-volume', title: 'חשבו שהנפח גדל פי אותו מספר כמו המקצועות',
      cause: 'כל מקצוע גדל "פי $3$", ונדמה שגם הנפח.',
      explain: ['הנפח הוא מכפלה של שלושה מקצועות.', 'כל אחד מהם גדל פי $3$, ולכן הנפח גדל פי $3 \\cdot 3 \\cdot 3 = 27$.'],
      remedy: [
        { kind: 'predict', text: 'מכפילים כל מקצוע של קובייה פי $3$. הנפח גדל פי:', fig: cube(3, { cubes: true }), choices: ['$27$', '$3$', '$9$'], answer: 0,
          why: '$3 \\cdot 3 \\cdot 3 = 27$: פי $3$ באורך, ברוחב ובגובה.',
          wrongWhy: { 1: 'המקצועות גדלים פי $3$, אבל הנפח הוא מכפלה של שלושה מהם.', 2: 'פי $9$ גדל השטח של פאה אחת: שני כיוונים.' } },
      ] },
  ],
  words: ['נפח מנסרה', 'שטח הבסיס', 'אורך המנסרה', 'חצי תיבה', 'פי $k^2$', 'פי $k^3$'],
};

export const SOLID: StairContent[] = [stair1, stair2, stair3, stair4];

/** The misconception names this topic adds to its practice's (content/solid.js cats names them all). */
export const CATS_SOLID: Record<string, string> = {};
