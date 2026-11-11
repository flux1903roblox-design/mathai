// Statistics, stairs 6–8 (ח׳, the rest of units 8.10 and 8.11, December–January; curriculum stage 3, DATA-5): the range
// and what happens to every measure when all the data change; two sources of data read together; interpolation and
// extrapolation. They extend `stats` (learn/content/stats.ts holds stairs 1–5); learn/content/index.ts loads both files
// as one topic.
//
// The range is the difference of the largest and the smallest value, one number (the updated programme); some books
// write its two ends ("מ־37 עד 42"), and stair 6 says so once. Two sources are joined by what they share (the jump, the
// month) and checked against each other. A uniform change is the same in every step: the change per step times the
// steps; beyond the data it is only an estimate. The diagnostic models are the spec's (content/stats2.js STATS6 to
// STATS8T, ported unchanged). The Ministry's items (the 5-point raise, the basketball player, the workshop, the long
// jump, the electricity bill, the population, the salary, the festival, a child's growth) are retold; the sentences are
// the app's own. Every number written here is checked by web/scripts/verify/facts-stage3.mjs, and the maths of every
// step by learn/content.test.ts.
import type { DiagModel, FigSpec, StairContent, ManipSpec, DataFig, DlineLine } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/stats2.js';

// ---------------------------------------------------------------- figures

const dots = (values: number[], axis: [number, number], more: { span?: { from: number; to: number; label?: string }; unit?: string; anim?: boolean } = {}): FigSpec =>
  ({ type: 'dots', values, axis, ...more });
const bars = (labels: string[], values: number[], more: { unit?: string; highlight?: number } = {}): FigSpec => ({ type: 'bars', labels, values, ...more });
const table = (head: string[], rows: (string | number)[][], extra: { cross?: number[]; highlight?: (number | [number, number])[] } = {}): FigSpec => ({ type: 'table', head, rows, ...extra });
const pair = (a: FigSpec, b: FigSpec, titles?: [string, string]): FigSpec => ({ type: 'pair', items: [a, b], ...(titles ? { titles } : {}) } satisfies DataFig);
type ChartExtra = { step?: number; max?: number; every?: number; unit?: string; labels?: boolean; pct?: boolean; dp?: number; level?: number; dashed?: number; mark?: number | string; cross?: number[] };
const line = (xs: (number | string)[], values: number[], extra: ChartExtra = {}): FigSpec => ({ type: 'chart', mode: 'line', xs, values, ...extra } satisfies DataFig);
const pie = (cats: string[], values: number[], extra: ChartExtra = {}): FigSpec => ({ type: 'chart', mode: 'pie', cats, values, ...extra } satisfies DataFig);
const pins = (labels: string[], start: number[]): ManipSpec => ({ kind: 'pins', min: 0, max: 10, labels, start } as ManipSpec);
const moveT = (top: DlineLine, bottom: DlineLine, start = 0): ManipSpec => ({ kind: 'dline', top, bottom, move: 't', start: { t: start } } as ManipSpec);

/** The shoe sizes of a class (stair 6, step 1). */
const SHOES = [37, 38, 38, 38, 39, 40, 42];
const LIST = [12, 5, 9, 17, 8];
/** The Ministry's long jump: the wind in jumps 1–4 and Yoav's distances in metres. */
const WIND = [0.5, 1.2, 2.4, 1.8];
const YOAV = ['6.20', '6.45', '6.80', '6.50'];
const jumpPair = (cross: boolean) => pair(
  G.windFig(WIND, { xs: [1, 2, 3, 4], ...(cross ? { cross: [2] } : {}) }) as FigSpec,
  table(['קפיצה', 'מרחק (מטר)'], YOAV.map((d, i) => [i + 1, d]), cross ? { cross: [2] } : {}),
  ['מקור 1: הרוח', 'מקור 2: הקפיצות של יואב'],
);
/** Five jumps of another jumper, in centimetres (stair 7, step 4 and example 1). */
const WIND5 = [1.4, 2.3, 0.8, 1.9, 2.6];
const DIST5 = [612, 640, 628, 635, 655];
const jumps5 = pair(G.windFig(WIND5) as FigSpec, G.jumpsTable(DIST5) as FigSpec, ['מקור 1: הרוח', 'מקור 2: המרחקים']);
/** The bill (the Ministry's, own numbers): this year January–May, last year's seasonal monthly means. */
const BILL = { m: [520, 480, 420, 390, 360], seasons: [600, 350, 480, 400] };
/** The population (the Ministry's): 2.0 million in 2010, 3.2 million in 2016. */
const POP = table(['שנה', 'אוכלוסייה (מיליונים)'], [[2010, '2.0'], [2016, '3.2']]);
/** The festival's tickets by 8, 10, 12 and 14 o'clock. */
const TICKETS = [200, 350, 500, 650];

// ================================================================ stair 6: the range, and every value changed

type P6 = { op: 'add' | 'x2' | 'x1.1'; vals: number[]; c: number | null; r: number };
const stats6: DiagModel<P6> = {
  params: (rnd) => G.STATS6.params(rnd),
  text: (p) => G.stats6Text(p),
  answer: (p) => G.STATS6.answer(p),
  bugs: G.STATS6.bugs,
  solution: (p) => G.stats6Solution(p),
  hint: (p) => G.stats6Hint(p),
};
type P6T = { a: number; b: number; w1: number; w2: number; M: number; d: number; N: number; S: number };
const stats6T: DiagModel<P6T> = {
  params: (rnd) => G.STATS6T.params(rnd),
  text: (p) => G.stats6TText(p),
  answer: (p) => G.STATS6T.answer(p),
  bugs: G.STATS6T.bugs,
  solution: (p) => G.stats6TSolution(p),
  hint: () => G.stats6THint(),
  unit: 'ש״ח',
};

const WORKSHOP = { kind: 'predict' as const, text: 'בבית מלאכה $4$ עובדים מרוויחים $5000$ ש״ח, $5$ עובדים $5200$ ש״ח והמנהל $9000$ ש״ח. המנהל קיבל תוספת של $2000$ ש״ח. מה השכר הממוצע עכשיו?',
  fig: table(['שכר (ש״ח)', 'מספר עובדים'], [[5000, 4], [5200, 5], [9000, 1]]),
  choices: ['$5700$', '$5500$', '$7500$'], answer: 0,
  why: 'הסכום עלה ב־$2000$, והוא מתחלק בין $10$ עובדים: $5500 + 200 = 5700$.',
  wrongWhy: { 1: '$5500$ הוא הממוצע לפני התוספת. התוספת נכנסה לסכום, ולכן הממוצע זז.', 2: '$7500$: הוסיפו לממוצע את כל ה־$2000$, כאילו כל עובד קיבל אותם.' } };
const RANGE_PREDICT = { kind: 'predict' as const, text: 'מה הטווח של $12, 5, 9, 17, 8$?', fig: dots(LIST, [0, 20]),
  choices: ['$12$', '$17$', '$4$'], answer: 0,
  why: 'הגדול $17$, הקטן $5$: $17 - 5 = 12$.',
  wrongWhy: { 1: '$17$ הוא הנתון הגדול. הטווח הוא המרחק ממנו לקטן.', 2: '$4$ הוא המרחק בין הראשון לאחרון ברשימה. מחפשים את הגדול ואת הקטן.' } };
const SHIFT_EXPLORE = { kind: 'explore' as const, text: 'הזיזו כל נקודה $3$ ימינה.', manip: pins(['2+3', '4+3', '7+3'], [2, 4, 7]), answer: [5, 7, 10],
  hint: '$2 + 3 = 5$.', success: 'כל הנקודות זזו יחד. המרחק מהקטנה לגדולה נשאר $5$.' };
const RAISE10 = { kind: 'predict' as const, text: 'כל עובד קיבל העלאה של $10\\%$, כלומר השכר הוכפל ב־$1.1$. לפני ההעלאה הטווח היה $2000$ ש״ח. מה הטווח עכשיו?',
  fig: bars(['דנה', 'יוסי', 'מירב', 'רון'], [6000, 7000, 7500, 8000], { unit: 'שכר לפני ההעלאה (ש״ח)' }),
  choices: ['$2200$', '$2000$', '$2010$'], answer: 0,
  why: 'כפל מותח כל מרחק: $2000 \\cdot 1.1 = 2200$.',
  wrongWhy: { 1: 'הוספה לא משנה את הטווח, אבל כאן כל שכר הוכפל, והמרחקים נמתחו.', 2: '$2010$: הוסיפו $10$ במקום לכפול ב־$1.1$.' } };

const stair6: StairContent = {
  skill: 'stats:6', topic: 'stats', level: 6, title: 'טווח ושינוי של כל הנתונים',
  objectives: [
    'לחשב טווח: הגדול פחות הקטן, מספר אחד.',
    'לדעת מה קורה לשכיח, לחציון, לממוצע ולטווח כשמוסיפים לכל הנתונים אותו מספר, או כופלים את כולם באותו מספר.',
    'להבין שהממוצע מושפע מנתון קיצוני יותר מהחציון.',
  ],
  idea: 'הטווח אומר כמה הנתונים מפוזרים: הגדול פחות הקטן. כשכל הנתונים זזים יחד, הם לא מתרחקים זה מזה.',
  why: [
    'מוסיפים $5$ לכל ציון: גם הגבוה וגם הנמוך עולים ב־$5$, והמרחק ביניהם נשאר.',
    'מכפילים כל נתון ב־$2$: כל מרחק מוכפל, גם הטווח.',
  ],
  alt: ['רכבת: כשכל הקרונות נוסעים $5$ מטר קדימה, אורך הרכבת לא משתנה.'],
  discover: [
    { kind: 'say', text: 'מידות הנעליים בקבוצה. הטווח מראה כמה הנתונים מפוזרים: מהקטן ביותר לגדול ביותר. כאן $42 - 37 = 5$.',
      fig: dots(SHOES, [36, 43], { span: { from: 37, to: 42, label: '5' }, unit: 'מידת נעליים', anim: true }) },
    RANGE_PREDICT,
    { kind: 'rule', text: 'טווח = הנתון הגדול ביותר פחות הנתון הקטן ביותר. זה מספר אחד.',
      why: 'יש ספרים שכותבים "הטווח מ־$5$ עד $17$". כאן הטווח הוא ההפרש, $12$.',
      fig: dots(LIST, [0, 20], { span: { from: 5, to: 17, label: '12' } }) },
    { kind: 'predict', text: 'הציונים במבחן: $60$, $72$, $85$, $90$. לכל הציונים הוסיפו $5$ נקודות. מה הטווח עכשיו?', fig: dots([60, 72, 85, 90], [55, 100]),
      choices: ['$30$', '$35$', '$95$'], answer: 0,
      why: 'לפני: $90 - 60 = 30$. אחרי: $95 - 65 = 30$.',
      wrongWhy: { 1: '$35$: הוספתם את ה־$5$ לטווח. אבל גם הקטן עלה ב־$5$.', 2: '$95$ הוא הציון הגבוה אחרי ההוספה, לא המרחק.' } },
    SHIFT_EXPLORE,
    { kind: 'rule', text: 'מוסיפים לכל הנתונים אותו מספר: השכיח, החציון והממוצע זזים בו, והטווח לא משתנה. כופלים כל נתון במספר: כולם נכפלים בו, גם הטווח.',
      why: 'הוספה מזיזה את כל הנתונים; כפל מותח את המרחקים.',
      fig: pair(dots([2, 4, 7], [0, 10], { span: { from: 2, to: 7, label: '5' } }), dots([5, 7, 10], [0, 10], { span: { from: 5, to: 10, label: '5' } }), ['לפני', 'אחרי הוספה של 3']) },
    RAISE10,
    { kind: 'predict', text: 'הממוצע של שחקן ב־$11$ משחקים הוא $30$ נקודות. במשחק ה־$12$ קלע $6$. מה הממוצע עכשיו?',
      fig: bars(['ממוצע 11 משחקים', 'משחק 12'], [30, 6], { unit: 'נקודות' }),
      choices: ['$28$', '$30$', '$18$'], answer: 0,
      why: '$11 \\cdot 30 + 6 = 336$, ו־$336 : 12 = 28$. נתון רחוק מהממוצע מזיז אותו.',
      wrongWhy: { 1: '$30$ הוא הממוצע הישן. המשחק החדש נכנס לסכום ולחלוקה.', 2: '$18$ הוא האמצע בין $30$ ל־$6$, כאילו שני המשחקים שווים במשקל.' } },
  ],
  examples: [
    { problem: 'בבית מלאכה $4$ עובדים מרוויחים $5000$ ש״ח, $5$ עובדים $5200$ ש״ח והמנהל $9000$ ש״ח. המנהל קיבל תוספת של $2000$ ש״ח. מה השכר הממוצע עכשיו?',
      fig: table(['שכר (ש״ח)', 'מספר עובדים'], [[5000, 4], [5200, 5], [9000, 1]]),
      answer: 5700, check: '(55000 + 2000)/10',
      steps: [
        { action: 'סכום השכר.', why: 'ארבעה עובדים של $5000$, חמישה של $5200$ והמנהל.', result: '4 \\cdot 5000 + 5 \\cdot 5200 + 9000 = 55{,}000', calc: { expr: '4*5000 + 5*5200 + 9000', value: 55000 } },
        { action: 'הממוצע לפני.', why: 'עשרה עובדים.', result: '55{,}000 : 10 = 5500', calc: { expr: '55000/10', value: 5500 } },
        { action: 'התוספת מתחלקת בין $10$.', why: 'התוספת נכנסת לסכום, והסכום מתחלק בין כל העובדים.', result: '2000 : 10 = 200', calc: { expr: '2000/10', value: 200 } },
        { action: 'הממוצע אחרי.', why: 'החציון והשכיח נשארו $5200$: רק הממוצע זז.', result: '5500 + 200 = 5700', value: '5500 + 200' },
      ] },
    { problem: 'ציונים: $64, 78, 55, 91, 70$. לכולם הוסיפו $4$. מה הטווח?', fig: dots([64, 78, 55, 91, 70], [50, 100]),
      answer: 36, check: '91 - 55',
      steps: [
        { action: 'הטווח לפני ההוספה.', why: 'הגדול $91$ והקטן $55$.', result: '91 - 55 = 36', calc: { expr: '91 - 55', value: 36 } },
        { action: 'אחרי ההוספה: $95 - 59$.', why: 'הגדול והקטן עלו שניהם ב־$4$.', result: '95 - 59 = 36', calc: { expr: '95 - 59', value: 36 } },
        { action: 'הטווח לא השתנה.', why: 'כל הנתונים זזו יחד.', result: '36', value: '36' },
      ] },
  ],
  together: [
    { problem: 'מה הטווח של $14, 3, 9, 21, 6, 17$?', fig: dots([14, 3, 9, 21, 6, 17], [0, 25]),
      steps: [
        { prompt: 'מה עושים קודם?', choices: [
          { text: 'מוצאים את הגדול ואת הקטן', ok: true, feedback: 'נכון: הטווח הוא המרחק ביניהם.' },
          { text: 'מחסירים את האחרון מהראשון', ok: false, feedback: '$17 - 14 = 3$ הוא מרחק בין שני נתונים, לא הטווח.' },
          { text: 'הגדול הוא הטווח', ok: false, feedback: '$21$ הוא רק הקצה העליון. הטווח הוא המרחק מהקטן אליו.' },
        ], hints: ['הטווח מדבר על כל הנתונים, לא על שניים מהם.', 'הגדול $21$, והקטן?'], done: 'הגדול $21$, הקטן $3$.' },
      ],
      final: { prompt: 'מה הטווח?', answer: 18, check: '21 - 3', hints: ['הגדול פחות הקטן.', '$21 - 3$.'] } },
    { problem: 'הטווח של הציונים $25$. המורה הוסיפה $8$ לכל ציון. מה הטווח עכשיו?', fig: pair(dots([60, 70, 85], [50, 100]), dots([68, 78, 93], [50, 100]), ['לפני', 'אחרי הוספה של 8']),
      steps: [
        { prompt: 'מה קורה לגדול ולקטן?', choices: [
          { text: 'שניהם עולים ב־$8$', ok: true, feedback: 'נכון: כל ציון עלה ב־$8$, גם הגדול וגם הקטן.' },
          { text: 'רק הגדול עולה', ok: false, feedback: 'הוסיפו $8$ לכל ציון, גם לקטן.' },
          { text: 'אף אחד לא משתנה', ok: false, feedback: 'כל ציון עלה ב־$8$. מה שלא משתנה הוא המרחק ביניהם.' },
        ], hints: ['לכל ציון, גם לגדול וגם לקטן.', 'אם שניהם עולים באותו מספר, מה קורה למרחק?'], done: 'שניהם עולים ב־$8$, והמרחק נשאר.' },
      ],
      final: { prompt: 'מה הטווח עכשיו?', answer: 25, check: '25', hints: ['הגדול והקטן זזו יחד.', 'המרחק לא השתנה.'] } },
  ],
  diag: stats6,
  transfer: stats6T,
  words: ['טווח', 'פיזור', 'נתון קיצוני', 'הוספה לכל הנתונים', 'כפל של כל הנתונים'],
  misconceptions: [
    { id: 'range-max', title: 'כתבו את הערך הגדול ביותר במקום הטווח',
      cause: '"הטווח" נשמע כמו "עד כמה זה מגיע". הוא המרחק מהקטן לגדול.',
      explain: ['הטווח הוא הגדול פחות הקטן, מספר אחד.', 'של $12, 5, 9, 17, 8$: $17 - 5 = 12$, לא $17$.'],
      remedy: [RANGE_PREDICT] },
    { id: 'first-last', title: 'חישבו טווח מהנתון הראשון והאחרון ברשימה בלי לחפש את הגדול והקטן',
      cause: 'הנתונים לא מסודרים, והראשון והאחרון אינם הקטן והגדול.',
      explain: ['קודם מחפשים בכל הרשימה את הגדול ואת הקטן.', 'ב־$3, 9, 1, 6$ הגדול $9$ והקטן $1$: הטווח $8$, לא $6 - 3 = 3$.'],
      remedy: [
        { kind: 'explore', text: 'שימו כל נתון במקום שלו על הציר: $3$, $9$, $1$, $6$.', manip: pins(['3', '9', '1', '6'], [0, 0, 0, 0]), answer: [3, 9, 1, 6],
          hint: 'כל נקודה עוברת למספר שלה.', success: 'על הציר רואים מיד: הקטן $1$ והגדול $9$.' },
        { kind: 'predict', text: 'מה הטווח של $3, 9, 1, 6$?', fig: dots([3, 9, 1, 6], [0, 10]),
          choices: ['$8$', '$3$'], answer: 0, why: 'הגדול $9$ והקטן $1$: $9 - 1 = 8$.', wrongWhy: { 1: '$6 - 3 = 3$ הוא המרחק בין האחרון לראשון ברשימה.' } },
      ] },
    { id: 'shift-range', title: 'חשבו שהוספה של אותו מספר לכל הנתונים מגדילה את הטווח',
      cause: 'מוסיפים לכל הנתונים, ונדמה שגם הטווח גדל. אבל גם הקטן עלה.',
      explain: ['כשמוסיפים לכולם אותו מספר, הגדול והקטן עולים באותו מספר.', 'לכן המרחק ביניהם, הטווח, נשאר כמו שהיה.'],
      remedy: [SHIFT_EXPLORE] },
    { id: 'range-unchanged', title: 'חשבו שכפל של כל הנתונים במספר לא משנה את הטווח',
      cause: 'זוכרים שהוספה לא משנה את הטווח, ומחילים את זה גם על כפל.',
      explain: ['כפל מותח את כל המרחקים: מרחק $10$ כפול $2$ הוא $20$.', 'לכן כשכל נתון מוכפל במספר, גם הטווח מוכפל בו.'],
      remedy: [RAISE10] },
    { id: 'mean-unchanged', title: 'חשבו שהממוצע לא משתנה כשהנתונים משתנים',
      cause: 'הממוצע הוא חלוקה שווה של הסכום: שינוי בנתון אחד משנה את הסכום, ולכן גם את הממוצע.',
      explain: ['כשנתון עולה, הסכום עולה, והממוצע עולה איתו.', 'תוספת של $2000$ לעובד אחד מתוך $10$ מעלה את הממוצע ב־$200$.'],
      remedy: [WORKSHOP] },
    { id: 'whole-raise', title: 'הוסיפו לממוצע את כל התוספת של נתון אחד',
      cause: 'הממוצע הוא חלוקה שווה של הסכום: תוספת לאחד מתחלקת בין כולם.',
      explain: ['התוספת נכנסת לסכום, והסכום מתחלק במספר הנתונים.', '$2000$ בין $10$ עובדים: הממוצע עולה ב־$200$, לא ב־$2000$.'],
      remedy: [WORKSHOP] },
  ],
};

// ================================================================ stair 7: two sources

type P7 = { L: number; legal: number[]; wind: number[]; d: number[] };
const stats7: DiagModel<P7> = {
  params: (rnd) => G.STATS7.params(rnd),
  text: () => G.stats7Text(),
  fig: (p) => G.stats7Fig(p) as FigSpec,
  answer: (p) => G.STATS7.answer(p),
  bugs: G.STATS7.bugs,
  solution: (p) => G.stats7Solution(p),
  hint: () => G.stats7Hint(),
  unit: 'ס״מ',
};
type P7T = { m: number[]; S: number; seasons: number[] };
const stats7T: DiagModel<P7T> = {
  params: (rnd) => G.STATS7T.params(rnd),
  text: () => G.stats7TText(),
  fig: (p) => G.billFig(p) as FigSpec,
  answer: (p) => G.STATS7T.answer(p),
  bugs: G.STATS7T.bugs,
  solution: (p) => G.stats7TSolution(p),
  hint: () => G.stats7THint(),
};

const JUMP_PREDICT = { kind: 'predict' as const, text: 'באיזו קפיצה יואב קפץ הכי רחוק מבין הקפיצות שנחשבות?', fig: jumpPair(false),
  choices: ['קפיצה $4$', 'קפיצה $3$', 'קפיצה $2$'], answer: 0,
  why: 'בקפיצה $3$ הרוח הייתה $2.4$: היא לא נחשבת. מבין $1$, $2$ ו־$4$ הכי רחוקה קפיצה $4$, $6.50$ מטר.',
  wrongWhy: { 1: 'בקפיצה $3$ יואב קפץ הכי רחוק, $6.80$, אבל הרוח עזרה לו. רק שני המקורות יחד אומרים את זה.', 2: 'קפיצה $2$ נחשבת, אבל בקפיצה $4$ יואב קפץ $6.50$, עוד יותר.' } };
const JUMPS5_PREDICT = { kind: 'predict' as const, text: 'קפיצה נחשבת רק אם רוח הגב לא עלתה על $2.0$ מטר לשנייה. מה הממוצע של הקפיצות שנחשבות?', fig: jumps5,
  choices: ['$625$', '$634$', '$375$'], answer: 0,
  why: 'נחשבות $1$, $3$, $4$: $612 + 628 + 635 = 1875$, ו־$1875 : 3 = 625$.',
  wrongWhy: { 1: '$634$ הוא הממוצע של כל חמש הקפיצות, גם הפסולות.', 2: 'חילקתם ב־$5$ את הסכום של שלוש.' } };
const BILL_PREDICT = { kind: 'predict' as const, text: 'בכמה קוט״ש הממוצע החודשי באביב השנה (מרץ, אפריל ומאי) גבוה מהממוצע החודשי באביב בשנה שעברה?', fig: G.billFig(BILL) as FigSpec,
  choices: ['$40$', '$820$', '$84$'], answer: 0,
  why: '$420 + 390 + 360 = 1170$, ו־$1170 : 3 = 390$; $390 - 350 = 40$.',
  wrongWhy: { 1: '$1170 - 350$ משווה סכום של שלושה חודשים לממוצע של חודש.', 2: '$84$: הממוצע של כל חמשת החודשים, גם החורף.' } };
const CLUBS = ['בלי חוג', 'חוג אחד', 'יותר מחוג אחד'];

const stair7: StairContent = {
  skill: 'stats:7', topic: 'stats', level: 7, title: 'שני מקורות מידע',
  objectives: [
    'לענות על שאלה שצריך בשבילה שני מקורות: טבלה ודיאגרמה, תיאור וטבלה, שתי דיאגרמות.',
    'למצוא מה מחבר את המקורות (אותה קפיצה, אותו חודש) ולקחת מכל אחד את מה שצריך.',
    'לבדוק שהמקורות לא סותרים זה את זה.',
  ],
  idea: 'שני מקורות משלימים זה את זה: מוצאים מה מחבר אותם, לוקחים מכל אחד את מה שצריך, ובודקים שהם לא סותרים.',
  why: ['טבלת המרחקים לא אומרת אם הקפיצה חוקית; גרף הרוח לא אומר כמה קפצו. רק יחד יודעים אילו קפיצות נחשבות.'],
  alt: ['כמו מתכון ומזווה: המתכון אומר כמה צריך, והמזווה כמה יש בבית. רק יחד יודעים מה לקנות.'],
  discover: [
    { kind: 'say', text: 'קפיצה לרוחק נחשבת לשיא רק אם רוח הגב לא עלתה על $2.0$ מטר לשנייה. מקור אחד מראה את הרוח בכל קפיצה, והשני את הקפיצות של יואב.', fig: jumpPair(false) },
    JUMP_PREDICT,
    { kind: 'rule', text: 'כשהמידע בשני מקורות, מוצאים מה מחבר אותם (כאן מספר הקפיצה), ובודקים בכל מקור מה הוא אומר על אותו פריט.',
      why: 'כל מקור עונה על חצי מהשאלה.', fig: jumpPair(true) },
    { kind: 'predict', text: 'עכשיו המרחקים בסנטימטרים. מה הממוצע של הקפיצות שנחשבות?', fig: jumps5,
      choices: ['$625$', '$634$', '$375$'], answer: 0,
      why: 'נחשבות $1$, $3$, $4$: $612 + 628 + 635 = 1875$, ו־$1875 : 3 = 625$.',
      wrongWhy: { 1: '$634$ הוא הממוצע של כל חמש הקפיצות, גם הפסולות.', 2: 'חילקתם ב־$5$ את הסכום של שלוש.' } },
    { kind: 'explore', text: 'מקור 1: בשכבה $200$ תלמידים. מקור 2: דיאגרמת עוגה: $15\\%$ בלי חוג, $35\\%$ בחוג אחד, $50\\%$ ביותר מחוג אחד. בנו דיאגרמת עמודות של מספר התלמידים.',
      manip: { kind: 'chart', mode: 'bar', cats: CLUBS, start: [0, 0, 0], bar: { max: 120, step: 10, every: 2, unit: 'מספר תלמידים' } } as ManipSpec,
      answer: { values: [30, 70, 100] },
      hint: '$10\\%$ מ־$200$ הם $20$, ו־$5\\%$ הם $10$.',
      success: 'מהעוגה האחוזים, מהמשפט השלם: יחד, מספרי התלמידים.' },
    { kind: 'rule', text: 'לפני שמשתמשים בשני מקורות יחד, בודקים שהם מדברים על אותו דבר: אותה קבוצה, אותן יחידות, אותו זמן.',
      why: 'מקורות יכולים גם לסתור, ואז קודם מבררים מה נכון.',
      fig: pair(table(['כיתה', 'מספר תלמידים'], [['ח׳1', 40]]), pie(['ברגל', 'באוטובוס', 'ברכב'], [50, 30, 20], { pct: true }), ['מקור 1: טבלה', 'מקור 2: עוגה']) },
    { kind: 'predict', text: 'בטבלה של הכיתה $30$ תלמידים, ובדיאגרמת העוגה שלה $40\\%$, $35\\%$ ו־$30\\%$. מה לא מסתדר?',
      fig: pie(['ברגל', 'באוטובוס', 'באופניים'], [40, 35, 30], { pct: true }),
      choices: ['סכום האחוזים $105\\%$', 'הכול מסתדר'], answer: 0,
      why: 'גזרות של עוגה יחד הן $100\\%$: $40 + 35 + 30 = 105$.' },
    BILL_PREDICT,
  ],
  examples: [
    { problem: 'קפיצה נחשבת רק אם רוח הגב לא עלתה על $2.0$ מטר לשנייה. מה הממוצע של הקפיצות שנחשבות, בס״מ?', fig: jumps5,
      answer: 625, check: '(612+628+635)/3',
      steps: [
        { action: 'מגרף הרוח: נחשבות $1$, $3$, $4$.', why: 'בקפיצות $2$ ו־$5$ הרוח $2.3$ ו־$2.6$, יותר מ־$2.0$.', result: '1,\\ 3,\\ 4' },
        { action: 'מהטבלה: המרחקים של הקפיצות האלה.', why: 'רק הקפיצות שנחשבות.', result: '612 + 628 + 635 = 1875', calc: { expr: '612+628+635', value: 1875 } },
        { action: 'מחלקים בשלוש.', why: 'שלוש קפיצות נחשבות, ולכן מחלקים ב־$3$, לא ב־$5$.', result: '1875 : 3 = 625', value: '1875/3' },
      ] },
    { problem: 'מקור 1: בשכבה $160$ תלמידים. מקור 2: עוגה: $25\\%$ אוכלים בקפטריה, $40\\%$ מביאים מהבית, $35\\%$ הולכים הביתה. כמה מביאים מהבית?',
      fig: pie(['בקפטריה', 'מהבית', 'הולכים הביתה'], [25, 40, 35], { pct: true }),
      answer: 64, check: '0.4*160',
      steps: [
        { action: '$10\\%$ מ־$160$.', why: 'מהמקור הראשון השלם, $160$.', result: '160 : 10 = 16', calc: { expr: '160/10', value: 16 } },
        { action: '$40\\%$ הם ארבע פעמים $10\\%$.', why: 'מהמקור השני האחוז, $40\\%$.', result: '4 \\cdot 16 = 64', value: '4*16' },
      ] },
  ],
  together: [
    { problem: 'השנה צרכה משפחה $460$, $440$, $380$, $350$ ו־$320$ קוט״ש בינואר עד מאי. בשנה שעברה הממוצע החודשי באביב היה $330$. בכמה גבוה הממוצע החודשי באביב השנה?',
      fig: G.billFig({ m: [460, 440, 380, 350, 320], seasons: [600, 330, 500, 400] }) as FigSpec,
      steps: [
        { prompt: 'אילו חודשים הם האביב?', choices: [
          { text: 'מרץ, אפריל, מאי', ok: true, feedback: 'נכון: שלושת חודשי האביב.' },
          { text: 'כל חמשת החודשים', ok: false, feedback: 'ינואר ופברואר הם חורף.' },
          { text: 'רק מאי', ok: false, feedback: 'האביב הוא שלושה חודשים: מרץ, אפריל ומאי.' },
        ], hints: ['האביב מתחיל במרץ.', 'מרץ, אפריל ו...?'], done: 'מרץ, אפריל ומאי: $380$, $350$ ו־$320$.' },
      ],
      final: { prompt: 'בכמה קוט״ש גבוה הממוצע החודשי באביב השנה?', answer: 20, check: '(380+350+320)/3 - 330', hints: ['קודם הממוצע של שלושת החודשים: $(380 + 350 + 320) : 3$.', '$350 - 330$.'] } },
    { problem: 'מחירון: כרטיס לילד $25$ ש״ח, למבוגר $40$ ש״ח. משפחה: $2$ מבוגרים ו־$3$ ילדים. כמה ישלמו?',
      fig: table(['כרטיס', 'מחיר (ש״ח)'], [['ילד', 25], ['מבוגר', 40]]),
      steps: [
        { prompt: 'מה לוקחים מכל מקור?', choices: [
          { text: 'מהמחירון המחירים, מהמשפחה כמה מכל סוג', ok: true, feedback: 'נכון: מכל מקור החלק שלו.' },
          { text: 'רק את המחירון', ok: false, feedback: 'המחירון לא אומר כמה כרטיסים צריך.' },
          { text: 'רק את מספר האנשים', ok: false, feedback: 'בלי המחירון לא יודעים כמה עולה כל כרטיס.' },
        ], hints: ['מה כל מקור יודע?', 'מחיר מכל סוג כפול כמה מכל סוג.'], done: 'שני מבוגרים של $40$ ושלושה ילדים של $25$.' },
      ],
      final: { prompt: 'כמה ישלמו, בש״ח?', answer: 155, check: '2*40 + 3*25', hints: ['$2 \\cdot 40$ ועוד $3 \\cdot 25$.', '$80 + 75$.'] } },
  ],
  diag: stats7,
  transfer: stats7T,
  words: ['מקור מידע', 'סתירה', 'נתון חוקי', 'ממוצע חודשי'],
  misconceptions: [
    { id: 'ignore-source', title: 'השתמשו רק במקור מידע אחד',
      cause: 'מקור אחד נראה כאילו הוא כל התשובה.',
      explain: ['כל מקור עונה על חלק מהשאלה: אחד אומר אילו קפיצות נחשבות, השני כמה קפצו.', 'קודם מסננים לפי מקור אחד, ורק אז מחשבים מהשני.'],
      remedy: [JUMP_PREDICT] },
    { id: 'all-count', title: 'חילקו במספר כל הנתונים, גם אלה שהמקור השני פוסל',
      cause: 'סופרים את כל השורות בטבלה, גם אלה שהמקור השני פסל.',
      explain: ['ממוצע של הקפיצות שנחשבות: הסכום שלהן חלקי מספרן.', 'שלוש קפיצות נחשבות: מחלקים ב־$3$, לא ב־$5$.'],
      remedy: [JUMPS5_PREDICT] },
    { id: 'total-not-mean', title: 'השוו סכום לממוצע',
      cause: 'מחברים את שלושת החודשים ושוכחים שבמקור השני ממוצע של חודש אחד.',
      explain: ['משווים דבר לדבר דומה: ממוצע חודשי לממוצע חודשי.', 'קודם מחלקים את סכום שלושת החודשים ב־$3$.'],
      remedy: [BILL_PREDICT] },
    { id: 'all-months', title: 'חישבו ממוצע של כל החודשים ולא רק של העונה',
      cause: 'לוקחים את כל מה שבמקור הראשון, גם חודשים שאינם האביב.',
      explain: ['המקור השני מדבר על האביב: מרץ, אפריל ומאי.', 'ינואר ופברואר הם חורף, ולא נכנסים לממוצע של האביב.'],
      remedy: [BILL_PREDICT] },
    { id: 'count-as-pct', title: 'כתבו את האחוז עצמו כאילו הוא מספר התלמידים',
      cause: 'האחוז הוא המספר הראשון שרואים בעוגה. אבל הוא אומר איזה חלק, לא כמה.',
      explain: ['$40\\%$ מ־$160$ תלמידים הם $64$ תלמידים, לא $40$.', 'מהעוגה החלק; מהמקור השני השלם. רק יחד יודעים כמה.'],
      remedy: [
        { kind: 'predict', text: 'בשכבה $160$ תלמידים. כמה מביאים אוכל מהבית?', fig: pie(['בקפטריה', 'מהבית', 'הולכים הביתה'], [25, 40, 35], { pct: true }),
          choices: ['$64$', '$40$'], answer: 0, why: '$40\\%$ מ־$160$: $4 \\cdot 16 = 64$.', wrongWhy: { 1: '$40$ הוא האחוז, החלק. כמה תלמידים הם $40\\%$ מ־$160$?' } },
      ] },
  ],
};

// ================================================================ stair 8: interpolation and extrapolation

type P8 = { d: number; j: number; rate: number; y1: number; y2: number; x1: number };
const stats8: DiagModel<P8> = {
  params: (rnd) => G.STATS8.params(rnd),
  text: (p) => G.stats8Text(p),
  fig: (p) => G.stats8Fig(p) as FigSpec,
  answer: (p) => G.STATS8.answer(p),
  bugs: G.STATS8.bugs,
  solution: (p) => G.stats8Solution(p),
  hint: () => G.stats8Hint(),
};
type P8T = { t0: number; a: number; s: number; vals: number[]; at: number };
const stats8T: DiagModel<P8T> = {
  params: (rnd) => G.STATS8T.params(rnd),
  text: (p) => G.stats8TText(p),
  fig: (p) => G.stats8TFig(p) as FigSpec,
  answer: (p) => G.STATS8T.answer(p),
  bugs: G.STATS8T.bugs,
  solution: (p) => G.stats8TSolution(p),
  hint: () => G.stats8THint(),
};

const POP_PREDICT = { kind: 'predict' as const, text: 'מה הייתה האוכלוסייה ב־$2014$?', fig: POP,
  choices: ['$2.8$ מיליון', '$2.6$ מיליון', '$3.0$ מיליון'], answer: 0,
  why: '$1.2 : 6 = 0.2$ בכל שנה. ארבע שנים: $2.0 + 0.8 = 2.8$.',
  wrongWhy: { 1: '$2.6$ הוא האמצע, וזה נכון ל־$2013$, באמצע הדרך. $2014$ קרובה יותר ל־$2016$.', 2: '$3.0$ הוא חמש שנים של $0.2$, כלומר $2015$.' } };
const POP_EXPLORE = { kind: 'explore' as const, text: 'הזיזו את הסמן ל־$2014$, ארבע שנים אחרי $2010$.',
  manip: moveT({ max: 6, step: 1, label: 'שנים אחרי 2010' }, { max: 1.2, step: 0.2, label: 'גידול (מיליונים)' }), answer: 4,
  hint: 'כל שנה היא שנתה אחת למעלה.', success: '$0.8$ מיליון גידול: $2.0 + 0.8 = 2.8$.' };
const FESTIVAL = { kind: 'predict' as const, text: 'אם המגמה תימשך, כמה כרטיסים יימכרו עד $16{:}00$?', fig: G.ticketsFig(TICKETS) as FigSpec,
  choices: ['$800$', '$650$', '$950$'], answer: 0,
  why: 'בכל שעתיים עוד $150$: $650 + 150 = 800$.',
  wrongWhy: { 1: '$650$ הם הכרטיסים עד $14{:}00$. אם המגמה נמשכת, נמכרים עוד.', 2: '$950$: ספרתם שתי שעות כשני צעדים. צעד אחד הוא שעתיים.' } };
const GROWTH = { kind: 'predict' as const, text: 'ילד גדל $6$ ס״מ בשנה מגיל $4$ עד $10$. אם נמשיך את המגמה, מה יהיה גובהו בגיל $30$?',
  fig: line([4, 6, 8, 10], [102, 114, 126, 138], { unit: 'גובה (ס״מ) לפי גיל' }),
  choices: ['לא הגיוני להמשיך כך: $258$ ס״מ, ואנשים מפסיקים לגדול', '$258$ ס״מ'], answer: 0,
  why: '$138 + 20 \\cdot 6 = 258$ ס״מ, יותר משני מטרים וחצי. מגמה לא נמשכת לעד.' };
const STEPS_PREDICT = { kind: 'predict' as const, text: 'ב־$8{:}00$ נמכרו $120$ כרטיסים, ב־$10{:}00$ $180$ וב־$12{:}00$ $240$. כמה צעדים של שעתיים יש מ־$12{:}00$ עד $18{:}00$?',
  fig: G.ticketsFig([120, 180, 240]) as FigSpec,
  choices: ['$3$', '$6$', '$1$'], answer: 0,
  why: '$14{:}00$, $16{:}00$ ו־$18{:}00$: שלושה צעדים של שעתיים. עד $18{:}00$ נמכרים $240 + 3 \\cdot 60 = 420$.',
  wrongWhy: { 1: '$6$ שעות הן $3$ צעדים של שעתיים.', 2: '$14{:}00$ הוא רק הצעד הראשון.' } };

const stair8: StairContent = {
  skill: 'stats:8', topic: 'stats', level: 8, title: 'אינטרפולציה ואקסטרפולציה',
  objectives: [
    'להעריך ערך בין שני ערכים ידועים כשהשינוי אחיד (אינטרפולציה).',
    'להעריך ערך מעבר לנתונים לפי המגמה (אקסטרפולציה), ולהסביר למה זו רק הערכה.',
    'להבחין בין השתיים.',
  ],
  idea: 'כשהשינוי אחיד, הוא שווה בכל צעד: מחלקים את ההפרש למספר הצעדים, וכופלים במספר הצעדים שרוצים.',
  why: [
    'בין $2010$ ל־$2016$ האוכלוסייה גדלה ב־$1.2$ מיליון, $0.2$ בכל שנה. ל־$2014$ ארבע שנים: $2.0 + 0.8 = 2.8$.',
    'מעבר לנתונים אין בדיקה: ילד שגדל $6$ ס״מ בשנה לא ימשיך כך עד גיל $30$.',
  ],
  alt: ['ציר כפול: למעלה השנים, למטה הגידול. המרחק על הציר אומר כמה גדל.'],
  discover: [
    { kind: 'say', text: 'בין $2010$ ל־$2016$ האוכלוסייה גדלה באופן אחיד: אותו גידול בכל שנה.', fig: { ...POP, anim: true } as FigSpec },
    POP_PREDICT,
    { kind: 'rule', text: 'אינטרפולציה: מעריכים ערך בין שני נתונים ידועים. כשהשינוי אחיד: (השינוי בכל צעד) כפול (מספר הצעדים).',
      why: 'זה יחס ישר: חלק מהדרך הוא אותו חלק מהשינוי.',
      fig: line([2010, 2016], [2, 3.2], { mark: 2014, dp: 1, unit: 'אוכלוסייה (מיליונים)' }) },
    POP_EXPLORE,
    { kind: 'predict', text: 'העריכו את השכר במרץ.',
      fig: table(['חודש', 'שכר (ש״ח)'], [['ינואר', 7200], ['פברואר', 7400], ['מרץ', '?'], ['אפריל', 7900], ['מאי', 8200]]),
      choices: ['$7650$', '$7400$', '$7900$'], answer: 0,
      why: 'מרץ באמצע בין פברואר לאפריל: $(7400 + 7900) : 2 = 7650$. כאן האמצע נכון, כי מרץ באמצע הדרך.',
      wrongWhy: { 1: '$7400$ הוא השכר בפברואר: כאילו השכר לא עלה במרץ.', 2: '$7900$ הוא השכר באפריל, חודש אחרי מרץ.' } },
    FESTIVAL,
    { kind: 'rule', text: 'אקסטרפולציה: מעריכים מעבר לנתונים, לפי המגמה. ככל שמתרחקים, ההערכה פחות בטוחה.',
      why: 'לא יודעים אם המגמה תימשך: אולי הכרטיסים ייגמרו.', fig: G.ticketsFig([...TICKETS, 800], { dashed: 1 }) as FigSpec },
    GROWTH,
  ],
  examples: [
    { problem: 'ב־$2012$ היו בחורשה $140$ עצים, וב־$2020$ $260$, והגידול היה אחיד. כמה עצים היו ב־$2015$?',
      fig: table(['שנה', 'מספר עצים'], [[2012, 140], [2020, 260]]),
      answer: 185, check: '140 + 3*15',
      steps: [
        { action: 'השינוי.', why: 'בין $2012$ ל־$2020$.', result: '260 - 140 = 120', calc: { expr: '260 - 140', value: 120 } },
        { action: 'בכל שנה.', why: 'שמונה שנים, אותו גידול בכל שנה.', result: '120 : 8 = 15', calc: { expr: '120/8', value: 15 } },
        { action: 'שלוש שנים.', why: '$2015$ היא שלוש שנים אחרי $2012$.', result: '3 \\cdot 15 = 45', calc: { expr: '3*15', value: 45 } },
        { action: 'מוסיפים להתחלה.', why: 'הגידול נוסף על $140$ העצים שהיו ב־$2012$.', result: '140 + 45 = 185', value: '140 + 45' },
      ] },
    { problem: 'במיכל $900$ ליטר ב־$8{:}00$, $780$ ב־$9{:}00$ ו־$660$ ב־$10{:}00$. אם המים ימשיכו לרדת כך, כמה יהיו ב־$13{:}00$?',
      fig: line(['8:00', '9:00', '10:00'], [900, 780, 660], { unit: 'ליטרים במיכל' }),
      answer: 300, check: '660 - 3*120',
      steps: [
        { action: 'כמה יורד בכל שעה.', why: 'מ־$8{:}00$ ל־$9{:}00$, ושוב מ־$9{:}00$ ל־$10{:}00$.', result: '900 - 780 = 120', calc: { expr: '900 - 780', value: 120 } },
        { action: 'שלוש שעות אחרי $10{:}00$.', why: '$11{:}00$, $12{:}00$ ו־$13{:}00$.', result: '3 \\cdot 120 = 360', calc: { expr: '3*120', value: 360 } },
        { action: 'מורידים מ־$660$.', why: 'המים יורדים: מחסירים.', result: '660 - 360 = 300', value: '660 - 360' },
      ] },
  ],
  together: [
    { problem: 'ב־$2011$ היו במועדון $48$ חברים, וב־$2017$ $84$, בגידול אחיד. כמה היו ב־$2013$?',
      fig: table(['שנה', 'מספר חברים'], [[2011, 48], [2017, 84]]),
      steps: [
        { prompt: 'בכמה גדל בכל שנה?', choices: [
          { text: '$6$', ok: true, feedback: 'נכון: $36$ בשש שנים, $6$ בכל שנה.' },
          { text: '$36$', ok: false, feedback: '$36$ הוא כל הגידול בשש שנים.' },
          { text: '$18$', ok: false, feedback: '$18$ הוא חצי מהגידול, עד $2014$.' },
        ], hints: ['$84 - 48 = 36$ בכמה שנים?', '$36 : 6$.'], done: '$6$ חברים בכל שנה.' },
      ],
      final: { prompt: 'כמה חברים היו ב־$2013$?', answer: 60, check: '48 + 2*6', hints: ['$2013$ היא שנתיים אחרי $2011$.', '$48 + 2 \\cdot 6$.'] } },
    { problem: 'ב־$8{:}00$ נמכרו $120$ כרטיסים, ב־$10{:}00$ $180$, ב־$12{:}00$ $240$. אם המגמה תימשך, כמה עד $18{:}00$?',
      fig: G.ticketsFig([120, 180, 240]) as FigSpec,
      steps: [
        { prompt: 'כמה צעדים של שעתיים מ־$12{:}00$ עד $18{:}00$?', choices: [
          { text: '$3$', ok: true, feedback: 'נכון: $14{:}00$, $16{:}00$ ו־$18{:}00$.' },
          { text: '$1$', ok: false, feedback: '$14{:}00$ הוא רק הצעד הראשון.' },
          { text: '$6$', ok: false, feedback: '$6$ שעות הן $3$ צעדים של שעתיים.' },
        ], hints: ['כל צעד הוא שעתיים.', '$14{:}00$, $16{:}00$, ...'], done: 'שלושה צעדים, ובכל אחד עוד $60$ כרטיסים.' },
      ],
      final: { prompt: 'כמה כרטיסים יימכרו עד $18{:}00$?', answer: 420, check: '240 + 3*60', hints: ['בכל צעד עוד $60$.', '$240 + 3 \\cdot 60$.'] } },
  ],
  diag: stats8,
  transfer: stats8T,
  words: ['אינטרפולציה', 'אקסטרפולציה', 'שינוי אחיד', 'מגמה', 'הערכה'],
  misconceptions: [
    { id: 'midpoint', title: 'לקחו את האמצע בין שני הערכים בלי להתחשב במרחק',
      cause: '"באמצע" נשמע הגיוני לכל ערך שבין שניים. האמצע נכון רק באמצע הדרך.',
      explain: ['ערך באמצע הדרך מקבל את האמצע. ערך שקרוב לקצה אחד, קרוב גם לערך שלו.', '$2014$ היא ארבע שנים מתוך שש אחרי $2010$: $\\frac{4}{6}$ מהשינוי, לא חצי.'],
      remedy: [POP_PREDICT, POP_EXPLORE] },
    { id: 'steps-not-scaled', title: 'הוסיפו את כל ההפרש בכל צעד',
      cause: 'ההפרש בין שני הנתונים נראה כמו "השינוי", ומוסיפים אותו בכל שנה.',
      explain: ['ההפרש הוא השינוי של כל השנים יחד.', 'קודם מחלקים אותו במספר השנים: זה השינוי בשנה אחת.'],
      remedy: [
        { kind: 'predict', text: 'בשש שנים המועדון גדל ב־$36$ חברים, באופן אחיד. בכמה גדל בכל שנה?', fig: table(['שנה', 'מספר חברים'], [[2011, 48], [2017, 84]]),
          choices: ['$6$', '$36$'], answer: 0, why: '$36 : 6 = 6$ בכל שנה.', wrongWhy: { 1: '$36$ הוא הגידול של כל שש השנים יחד.' } },
      ] },
    { id: 'wrong-end', title: 'מדדו את המרחק מהקצה השני',
      cause: 'סופרים צעדים מהקצה הלא נכון.',
      explain: ['סופרים את הצעדים מהשנה שממנה מתחילים.', 'אם מתחילים מ־$2010$, אז $2012$ היא שני צעדים ממנה.'],
      remedy: [
        { kind: 'predict', text: 'ב־$2010$ היו $100$, ב־$2018$ $180$, בגידול אחיד. כמה היו ב־$2012$?', fig: table(['שנה', 'מספר'], [[2010, 100], [2018, 180]]),
          choices: ['$120$', '$160$'], answer: 0, why: '$10$ בכל שנה, ו־$2012$ היא שנתיים אחרי $2010$: $100 + 20 = 120$.', wrongWhy: { 1: '$160$: ספרתם שש שנים, המרחק מ־$2018$.' } },
      ] },
    { id: 'no-start', title: 'חישבו רק את השינוי, בלי הערך שממנו מתחילים',
      cause: 'השינוי בכל שנה נכון, אבל הוא נוסף על מה שהיה בהתחלה.',
      explain: ['השינוי אומר כמה נוסף. התשובה היא מה שהיה ועוד מה שנוסף.', 'בחורשה: $3 \\cdot 15 = 45$ עצים נוספו ל־$140$, ולכן $185$.'],
      remedy: [
        { kind: 'predict', text: 'ב־$2012$ היו בחורשה $140$ עצים, ובכל שנה נוספו $15$. כמה עצים היו ב־$2015$?', fig: table(['שנה', 'מספר עצים'], [[2012, 140], [2020, 260]]),
          choices: ['$140 + 45 = 185$', '$45$'], answer: 0, why: 'שלוש שנים של $15$ הן $45$, ועוד $140$ שהיו.', wrongWhy: { 1: '$45$ הם רק העצים שנוספו.' } },
      ] },
    { id: 'last-value', title: 'הניחו שהערך יישאר כמו בפעם האחרונה',
      cause: 'הנתון האחרון הוא הקרוב ביותר לשאלה, ונדמה שהוא התשובה.',
      explain: ['כשהמגמה נמשכת, הערך ממשיך להשתנות באותו קצב.', 'עד $14{:}00$ נמכרו $650$; עד $16{:}00$ עוד $150$.'],
      remedy: [FESTIVAL] },
    { id: 'one-step', title: 'הוסיפו צעד אחד במקום כל הצעדים עד הזמן המבוקש',
      cause: 'מוסיפים את השינוי פעם אחת, גם כשהזמן המבוקש רחוק יותר.',
      explain: ['סופרים כמה צעדים יש עד הזמן שבשאלה.', 'מ־$12{:}00$ עד $18{:}00$ שלושה צעדים של שעתיים.'],
      remedy: [STEPS_PREDICT] },
    { id: 'hours-as-steps', title: 'ספרו שעות במקום צעדים של שעתיים',
      cause: 'הנתונים נמדדו כל שעתיים, ולכן צעד אחד הוא שעתיים.',
      explain: ['כשהנתונים נמדדו כל שעתיים, השינוי שבטבלה הוא של שעתיים.', '$6$ שעות הן $3$ צעדים, לא $6$.'],
      remedy: [STEPS_PREDICT] },
    { id: 'far-extrap', title: 'המשיכו מגמה רחוק מעבר לנתונים כאילו היא בטוחה',
      cause: 'החישוב עובד, ולכן נדמה שגם התוצאה נכונה. אבל מגמה לא נמשכת לעד.',
      explain: ['ככל שמתרחקים מהנתונים, ההערכה פחות בטוחה.', 'ילד לא ממשיך לגדול $6$ ס״מ בשנה עד גיל $30$.'],
      remedy: [GROWTH] },
  ],
};

export const STATS2: StairContent[] = [stair6, stair7, stair8];
