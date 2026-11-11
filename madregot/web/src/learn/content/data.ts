// Data and frequency (נתונים ושכיחות): the Ministry's ז׳ unit "איסוף, ייצוג וקריאת מידע, שכיחות", January–February,
// and in the תשפ״ז transition year also ח׳'s 8.6 (October–November) and the base of "הסתברות א – בסיס" (curriculum
// stage 3, DATA-4). Four stairs: charts and the frequency table, relative frequency, percent and the pie, and
// probability from relative frequency.
//
// The unit is taught with the Ministry's own representations: the frequency table, the bar chart read off its axis (a
// grid line at every step, so "count the squares" points at something on the screen), the pictogram with its key, the
// pie of 20 equal parts, and a spinner turned 10, then 100, then 1000 times. A relative frequency is a part of all the
// data (a fraction, a decimal or a percent), all of them together are 1, and picking at random the probability of a kind
// is its relative frequency. Every error the topic names (content/data.js, with its source) is shown wrong at its stair.
// The diagnostic models are the spec's (content/data.js DATA1 to DATA4J, ported unchanged). The numbers and situations of
// the Ministry's examples (the sports survey, the headache ad, the two classes, the junction, the 500 calls, the colour
// survey, the rain table, the spinner turned 1000 times, the bag of 24 marbles) are used; the sentences are the app's
// own. Every number written here is checked by web/scripts/verify/facts-stage3.mjs, and the maths of every step by
// learn/content.test.ts. No teaching text quotes a seeded number: the spinner of discover 5 is seeded so that its
// screenshots hold, and the texts say only what holds for any long run.
import type { DiagModel, FigSpec, StairContent, ManipSpec, DataFig, FractionFig } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/data.js';

// ---------------------------------------------------------------- figures

const SPORTS = ['כדורגל', 'כדורסל', 'שחייה', 'טניס'];
const SPORT_COUNTS = [12, 8, 6, 4];
type ChartExtra = { step?: number; max?: number; every?: number; from?: number; unit?: string; labels?: boolean; pct?: boolean; hide?: number; tones?: number[]; anim?: boolean; level?: number; dp?: number };
const bar = (cats: string[], values: number[], extra: ChartExtra = {}): FigSpec => ({ type: 'chart', mode: 'bar', cats, values, ...extra } satisfies DataFig);
const pie = (cats: string[], values: number[], extra: ChartExtra = {}): FigSpec => ({ type: 'chart', mode: 'pie', cats, values, ...extra } satisfies DataFig);
const picto = (cats: string[], values: number[], key: number, unit = 'ילדים', icon: 'person' | 'book' = 'person'): FigSpec => ({ type: 'chart', mode: 'picto', cats, values, key, unit, icon } satisfies DataFig);
const table = (head: string[], rows: (string | number)[][], extra: { highlight?: (number | [number, number])[] } = {}): FigSpec => ({ type: 'table', head, rows, ...extra });
const fbar = (den: number, shaded: number, extra: Record<string, unknown> = {}): FigSpec => ({ type: 'fbar', den, shaded, ...extra } satisfies FractionFig);
const fbars = (rows: { den: number; shaded: number; label?: string }[]): FigSpec => ({ type: 'fbar', rows } satisfies FractionFig);
/** The sports survey (the Ministry's): football 12, basketball 8, swimming 6, tennis 4, the axis every 2 to 14. */
const sports = (extra: ChartExtra = {}) => bar(SPORTS, SPORT_COUNTS, { step: 2, max: 14, unit: 'מספר תלמידים', labels: false, ...extra });
/** The headache ad (the Ministry's): 82% and 88%, drawn from 80 (or honestly from 0). */
const ad = (from0: boolean) => bar(['ראשקל', 'בלי כאב'], [82, 88], from0 ? { step: 10, max: 100, every: 2, unit: 'אחוז שהרגישו טוב יותר' } : { from: 80, step: 2, max: 90, unit: 'אחוז שהרגישו טוב יותר' });
/** A chart to build: bars on the axis's steps, or a pie of `parts` equal slices. */
const buildBars = (cats: string[], start: number[], step: number, max: number, extra: Record<string, unknown> = {}): ManipSpec => ({ kind: 'chart', mode: 'bar', cats, start, bar: { max, step, unit: 'מספר תלמידים' }, ...extra });
const buildPie = (cats: string[], parts: 10 | 12 | 20, extra: Record<string, unknown> = {}): ManipSpec => ({ kind: 'chart', mode: 'pie', cats, start: cats.map(() => 0), pie: { parts }, ...extra });
const shadeBar = (den: number, whole?: number): ManipSpec => ({ kind: 'fbar', start: { den, shaded: 0 }, lockDen: true, ...(whole ? { whole } : {}) });
/** The calls (the Ministry's): 500 tries, 250 talked, 100 no answer, 125 a broken line, 25 busy. */
const CALLS = ['שיחה', 'אין תשובה', 'קו מקולקל', 'תפוס'];
const CALL_COUNTS = [250, 100, 125, 25];
/** The spinner of the explore steps: red 3, blue 5, green 4 of 12 equal parts. */
const WHEEL = [{ label: 'אדום', parts: 3, tone: 3 }, { label: 'כחול', parts: 5, tone: 0 }, { label: 'ירוק', parts: 4, tone: 2 }];
const spin = (extra: Record<string, unknown> = {}): ManipSpec => ({ kind: 'simulate', device: 'spinner', sectors: WHEEL, watch: 0, guided: true, truth: true, ...extra });
/** Another child's ten spins of the same wheel (red, blue, red, red, green, blue, red, green, red, blue): red after each. */
const NOA = [1, 1, 2, 3, 3, 3, 4, 4, 5, 5].map((k, i) => Math.round((100 * k) / (i + 1)) / 100);

// ================================================================ stair 1: charts and the frequency table

type P1 = { s: number; vals: number[]; i: number; j: number; max: number };
const data1: DiagModel<P1> = {
  params: (rnd) => G.DATA1.params(rnd),
  text: (p) => G.data1Text(p),
  fig: (p) => G.data1Fig(p) as FigSpec,
  answer: (p) => G.DATA1.answer(p),
  bugs: G.DATA1.bugs,
  solution: (p) => G.data1Solution(p),
  hint: () => G.data1Hint(),
};
type P1T = { k: number; icons: number[]; x: number };
const data1T: DiagModel<P1T> = {
  params: (rnd) => G.DATA1T.params(rnd),
  text: (p) => G.data1TText(p),
  fig: (p) => G.data1TFig(p) as FigSpec,
  answer: (p) => G.DATA1T.answer(p),
  bugs: G.DATA1T.bugs,
  solution: (p) => G.data1TSolution(p),
  hint: () => G.data1THint(),
};

const stair1: StairContent = {
  skill: 'data:1', topic: 'data', level: 1, title: 'דיאגרמות וטבלת שכיחויות',
  objectives: [
    'לקרוא דיאגרמת עמודות, פיקטוגרמה וטבלת שכיחויות, ולעבור מאחת לשנייה.',
    'לקרוא את המספרים על הציר ואת המקרא, ולא לספור משבצות או סמלים.',
    'לבדוק מאיפה הציר מתחיל לפני שמשווים עמודות.',
  ],
  idea: 'שכיחות היא כמה פעמים מופיע כל ערך. טבלה, דיאגרמת עמודות ופיקטוגרמה מראות את אותן שכיחויות, וקוראים אותן לפי הציר והמקרא.',
  why: [
    'הציר הוא סרגל: כל שנתה שווה מספר, לא תמיד $1$. לכן קוראים את המספר, לא סופרים משבצות.',
    'בפיקטוגרמה כל סמל מייצג כמה פריטים, וחצי סמל מייצג חצי מזה.',
  ],
  alt: ['ספירה בקווים: לכל תשובה מסמנים קו, והקו החמישי חוצה את ארבעת הקודמים. סופרים קבוצות של $5$ ואת מה שנשאר.'],
  discover: [
    { kind: 'say', text: 'שאלנו תלמידים מה הספורט האהוב עליהם. כל עמודה מראה כמה בחרו בכל ספורט: זו השכיחות.', fig: sports({ anim: true }) },
    { kind: 'predict', text: 'כמה תלמידים בחרו בכדורסל?', fig: sports(),
      choices: ['$8$', '$4$', '$12$'], answer: 0,
      why: 'ראש העמודה מגיע לקו של $8$.',
      wrongWhy: { 1: 'ספרתם $4$ משבצות. כל משבצת היא $2$ תלמידים: $4 \\cdot 2 = 8$.', 2: '$12$ בחרו בכדורגל, העמודה הגבוהה ביותר.' } },
    { kind: 'explore', text: 'בנו את הדיאגרמה מהנתונים: כדורגל $12$, כדורסל $8$, שחייה $6$, טניס $4$.',
      manip: buildBars(SPORTS, [0, 0, 0, 0], 2, 14), answer: { values: SPORT_COUNTS },
      hint: 'גררו כל עמודה עד הקו של המספר שלה. הציר קופץ ב־$2$.',
      success: 'הרשימה והדיאגרמה מספרות אותו דבר: אותן שכיחויות, בשתי דרכים.' },
    { kind: 'rule', text: 'בדיאגרמת עמודות, הגובה של עמודה הוא השכיחות. קוראים את המספר על הציר, לא סופרים משבצות.',
      why: 'הציר יכול לקפוץ ב־$2$, ב־$5$ או ב־$10$. משבצת אחת שווה קפיצה אחת.', fig: sports({ labels: true }) },
    { kind: 'predict', text: 'כמה תלמידים ענו על הסקר?', fig: table(['ספורט', 'מספר תלמידים'], SPORTS.map((s, i) => [s, SPORT_COUNTS[i]])),
      choices: ['$30$', '$4$', '$12$'], answer: 0,
      why: 'כל תלמיד ענה פעם אחת, ולכן סכום השכיחויות הוא מספר העונים: $12 + 8 + 6 + 4 = 30$.',
      wrongWhy: { 1: '$4$ הוא מספר השורות, מספר סוגי הספורט.', 2: '$12$ בחרו בכדורגל בלבד. מחברים את כל השורות.' } },
    { kind: 'predict', text: 'כל סמל הוא $4$ ילדים. כמה ילדים בחרו בספרי מתח?', fig: picto(['מתח', 'הרפתקאות', 'קומיקס'], [14, 8, 10], 4),
      choices: ['$14$', '$3.5$', '$16$'], answer: 0,
      why: '$3$ סמלים שלמים הם $12$, וחצי סמל הוא $2$: $14$.',
      wrongWhy: { 1: '$3.5$ הוא מספר הסמלים. כל סמל שווה $4$ ילדים.', 2: 'חצי סמל הוא חצי מ־$4$, כלומר $2$, לא עוד $4$.' } },
    { kind: 'predict', text: 'בפרסומת, העמודה של "בלי כאב" נראית גבוהה פי $4$ מזו של "ראשקל". זה נכון?', fig: ad(false),
      choices: ['לא: $88$ לעומת $82$, הפרש של $6$ בלבד', 'כן, פי $4$'], answer: 0,
      why: 'הציר מתחיל ב־$80$, ולכן רואים רק את מה שמעל $80$: $8$ מול $2$. במציאות $88$ ו־$82$ קרובים מאוד.' },
    { kind: 'rule', text: 'לפני שמשווים עמודות, בודקים מאיפה הציר מתחיל ובכמה הוא קופץ. בפיקטוגרמה בודקים במקרא כמה שווה כל סמל.',
      why: 'ציר שמתחיל רחוק מ־$0$ מגדיל הבדלים קטנים.', fig: ad(true) },
  ],
  examples: [
    { problem: 'כמה תלמידים יותר בחרו בשחייה מאשר בטניס?', fig: bar(SPORTS, [25, 15, 30, 10], { step: 5, max: 35, unit: 'מספר תלמידים', labels: false }),
      answer: 20, check: '30 - 10',
      steps: [
        { action: 'בודקים בכמה קופץ הציר.', why: 'המספרים על הציר: $0$, $5$, $10$ וכן הלאה.', result: '5', calc: { expr: '10 - 5', value: 5 } },
        { action: 'העמודה של שחייה מגיעה $6$ משבצות.', why: 'כל משבצת היא $5$ תלמידים.', result: '6 \\cdot 5 = 30', calc: { expr: '6*5', value: 30 } },
        { action: 'העמודה של טניס מגיעה $2$ משבצות.', why: 'כל משבצת היא $5$ תלמידים.', result: '2 \\cdot 5 = 10', calc: { expr: '2*5', value: 10 } },
        { action: 'מחסרים.', why: '"כמה יותר" שואל על ההפרש בין שתי העמודות.', result: '30 - 10 = 20', value: '30 - 10' },
      ] },
    { problem: 'שאלנו $10$ ילדים כמה אחים ואחיות יש להם, וקיבלנו את התשובות: $2$, $1$, $3$, $2$, $0$, $2$, $1$, $4$, $2$, $1$. כמה ילדים ענו $2$?',
      fig: table(['מספר אחים ואחיות', 'מספר ילדים'], [[0, 1], [1, 3], [2, 4], [3, 1], [4, 1]]),
      answer: 4, check: '4',
      steps: [
        { action: 'מסדרים בטבלת שכיחויות.', why: 'סופרים כמה פעמים מופיע כל מספר: $0$ פעם אחת, $1$ שלוש פעמים, $2$ ארבע פעמים, $3$ ו־$4$ פעם אחת.', result: '1, 3, 4, 1, 1' },
        { action: 'בודקים שסכום השכיחויות הוא מספר הילדים.', why: 'כל ילד נספר פעם אחת.', result: '1 + 3 + 4 + 1 + 1 = 10', calc: { expr: '1+3+4+1+1', value: 10 } },
        { action: 'קוראים בטבלה את השכיחות של $2$.', why: 'השכיחות היא כמה פעמים מופיע הערך.', result: '4', value: '4' },
      ] },
    { problem: 'כל סמל הוא $10$ ספרים. בשורה של מדע בדיוני $4$ סמלים וחצי. כמה ספרים?', fig: picto(['מתח', 'מדע בדיוני'], [30, 45], 10, 'ספרים', 'book'),
      answer: 45, check: '4*10 + 5',
      steps: [
        { action: 'ארבעה סמלים שלמים.', why: 'כל סמל הוא $10$ ספרים.', result: '4 \\cdot 10 = 40', calc: { expr: '4*10', value: 40 } },
        { action: 'חצי סמל.', why: 'חצי סמל הוא חצי מ־$10$.', result: '10 : 2 = 5', calc: { expr: '10/2', value: 5 } },
        { action: 'מחברים.', why: 'הסמלים השלמים והחצי יחד.', result: '40 + 5 = 45', value: '40 + 5' },
      ] },
  ],
  together: [
    { problem: 'שאלנו ילדים מה הצבע האהוב עליהם. כמה ילדים יותר בחרו בכחול מאשר באדום?',
      fig: bar(['ירוק', 'כחול', 'אדום'], [6, 10, 4], { step: 2, max: 12, unit: 'מספר ילדים', labels: false, tones: [2, 0, 3] }),
      steps: [
        { prompt: 'כמה שווה משבצת אחת בציר?', choices: [
          { text: '$2$ ילדים', ok: true, feedback: 'נכון: המספרים על הציר קופצים ב־$2$.' },
          { text: 'ילד אחד', ok: false, feedback: 'ספירת משבצות נותנת $3$, אבל כל משבצת היא $2$.' },
          { text: '$10$', ok: false, feedback: '$10$ הוא ראש העמודה של כחול, לא משבצת.' },
        ], hints: ['הסתכלו על המספרים שליד הקווים.', '$0$, $2$, $4$, $6$ וכן הלאה.'], done: 'כל משבצת היא $2$ ילדים.' },
      ],
      final: { prompt: 'כמה ילדים יותר בחרו בכחול מאשר באדום?', answer: 6, check: '10 - 4', hints: ['כחול מגיע ל־$10$, אדום ל־$4$.', '$10 - 4$.'] } },
    { problem: 'בכיתה בדקו את מידת הנעליים של כל תלמיד. כמה תלמידים נמדדו?',
      fig: table(['מידה', 'מספר תלמידים'], [[36, 2], [37, 5], [38, 7], [39, 4], [40, 2]]),
      steps: [
        { prompt: 'מה מחברים?', choices: [
          { text: 'את מספרי התלמידים', ok: true, feedback: 'נכון: בכל שורה כמה תלמידים, וכל תלמיד מופיע בשורה אחת.' },
          { text: 'את המידות', ok: false, feedback: '$36 + 37 + 38$ וכן הלאה הן מידות נעליים, לא תלמידים.' },
          { text: 'סופרים את השורות', ok: false, feedback: 'יש $5$ שורות, אבל בכל שורה כמה תלמידים.' },
        ], hints: ['השאלה היא על תלמידים.', 'בעמודה "מספר תלמידים".'], done: 'מחברים את העמודה של מספר התלמידים.' },
      ],
      final: { prompt: 'כמה תלמידים נמדדו?', answer: 20, check: '2+5+7+4+2', hints: ['מחברים את כל המספרים בעמודה "מספר תלמידים".', '$2 + 5 + 7 + 4 + 2$.'] } },
  ],
  diag: data1,
  transfer: data1T,
  words: ['שכיחות', 'טבלת שכיחויות', 'דיאגרמת עמודות', 'פיקטוגרמה', 'מקרא', 'ציר', 'קפיצה בציר'],
  misconceptions: [
    { id: 'scale-units', title: 'ספרו משבצות בציר במקום לקרוא את המספרים שעליו',
      cause: 'סופרים משבצות כאילו כל משבצת היא $1$. אבל הציר יכול לקפוץ ב־$2$, ב־$5$ או ב־$10$.',
      explain: ['קודם קוראים בכמה קופץ הציר, ואז את המספר שליד ראש העמודה.', 'עמודה של $4$ משבצות בציר שקופץ ב־$5$ היא $20$, לא $4$.'],
      remedy: [
        { kind: 'predict', text: 'כמה תלמידים בחרו בשחייה?', fig: bar(['שחייה', 'טניס'], [20, 10], { step: 5, max: 30, unit: 'מספר תלמידים', labels: false }),
          choices: ['$20$', '$4$'], answer: 0, why: 'העמודה מגיעה $4$ משבצות, וכל משבצת היא $5$: $4 \\cdot 5 = 20$.' },
        { kind: 'explore', text: 'הרימו את העמודה של שחייה ל־$35$.', manip: buildBars(['שחייה', 'טניס'], [0, 20], 5, 40, { lock: [1] }), answer: { values: [35, 20] },
          hint: 'הציר קופץ ב־$5$. $35$ הם $7$ משבצות.', success: '$7$ משבצות של $5$ הן $35$.' },
      ] },
    { id: 'one-value', title: 'ענו כמה יש בקבוצה אחת במקום את ההפרש',
      cause: '"כמה יותר" שואל על ההפרש בין שתי עמודות, לא כמה יש באחת מהן.',
      explain: ['כמה יותר: מחסרים את הקטנה מהגדולה.', 'בשחייה $30$ ובטניס $10$: בשחייה $20$ יותר.'],
      remedy: [
        { kind: 'predict', text: 'בשחייה $30$ תלמידים ובטניס $10$. כמה יותר בחרו בשחייה?', fig: bar(['שחייה', 'טניס'], [30, 10], { step: 5, max: 35, unit: 'מספר תלמידים', labels: true }),
          choices: ['$20$', '$30$'], answer: 0, why: 'ההפרש: $30 - 10 = 20$.' },
        { kind: 'explore', text: 'בטניס $20$ פחות מאשר בשחייה. כוונו את העמודה של טניס.', manip: buildBars(['שחייה', 'טניס'], [30, 0], 5, 35, { lock: [0] }), answer: { values: [30, 10] },
          hint: 'שחייה מגיעה ל־$30$. מה קטן מ־$30$ ב־$20$?', success: 'בין שתי העמודות $20$: זה ה"כמה יותר".' },
      ] },
    { id: 'icon-count', title: 'ספרו סמלים ושכחו כמה שווה כל סמל',
      cause: 'סופרים סמלים ושוכחים את המקרא: כל סמל שווה כמה פריטים.',
      explain: ['המקרא אומר כמה שווה סמל אחד. מספר הסמלים כפול זה.', '$3$ סמלים של $4$ ילדים הם $12$ ילדים.'],
      remedy: [
        { kind: 'predict', text: 'כל סמל הוא $4$ ילדים. כמה ילדים בחרו בספרי מתח?', fig: picto(['מתח', 'קומיקס'], [12, 8], 4),
          choices: ['$12$', '$3$'], answer: 0, why: '$3$ סמלים, כל אחד $4$ ילדים: $3 \\cdot 4 = 12$.' },
        { kind: 'predict', text: 'כל סמל הוא $10$ ילדים. כמה ילדים בחרו בספרי הרפתקאות?', fig: picto(['הרפתקאות', 'קומיקס'], [25, 10], 10),
          choices: ['$25$', '$2.5$'], answer: 0, why: '$2$ סמלים הם $20$, וחצי סמל $5$: $25$.' },
      ] },
    { id: 'half-icon', title: 'ספרו חצי סמל כסמל שלם',
      cause: 'חצי סמל נראה כמו סמל, ולכן סופרים אותו שלם.',
      explain: ['חצי סמל שווה חצי ממה שסמל שלם שווה.', 'כשסמל הוא $4$, חצי סמל הוא $2$.'],
      remedy: [
        { kind: 'predict', text: 'כל סמל הוא $4$ ילדים. כמה ילדים בחרו בספרי מתח?', fig: picto(['מתח', 'הרפתקאות'], [14, 8], 4),
          choices: ['$14$', '$16$'], answer: 0, why: '$3$ סמלים שלמים הם $12$, והחצי $2$: $14$.' },
      ] },
    { id: 'truncated-axis', title: 'השוו גובה של עמודות בציר שלא מתחיל ב־$0$',
      cause: 'העין משווה גבהים. כשהציר לא מתחיל ב־$0$, הגבהים לא מתאימים למספרים.',
      explain: ['בודקים את המספר הראשון על הציר.', 'כשהציר מתחיל ב־$80$, $88$ נראה פי $4$ מ־$82$, אף שההפרש רק $6$.'],
      remedy: [
        { kind: 'predict', text: 'אותם נתונים, והפעם הציר מתחיל ב־$0$. פי כמה גבוהה העמודה של "בלי כאב"?', fig: { type: 'pair', items: [ad(false), ad(true)], titles: ['בפרסומת', 'מ־0'] },
          choices: ['כמעט אותו גובה: $88$ ו־$82$', 'פי $4$'], answer: 0, why: 'מ־$0$ רואים את כל העמודות: $88$ ו־$82$ כמעט שווים.' },
      ] },
  ],
};

// ================================================================ stair 2: relative frequency

type P2 = { f: number[]; N: number; j: number };
const data2: DiagModel<P2> = {
  params: (rnd) => G.DATA2.params(rnd),
  text: (p) => G.data2Text(p),
  fig: (p) => G.data2Fig(p) as FigSpec,
  answer: (p) => G.DATA2.answer(p),
  bugs: G.DATA2.bugs,
  solution: (p) => G.data2Solution(p),
  hint: () => G.data2Hint(),
  precise: true,
};
type P2T = { n1: number; k1: number; n2: number; k2: number };
const data2T: DiagModel<P2T> = {
  params: (rnd) => G.DATA2T.params(rnd),
  text: (p) => G.data2TText(p),
  answer: (p) => G.DATA2T.answer(p),
  bugs: G.DATA2T.bugs,
  solution: (p) => G.data2TSolution(p),
  hint: () => G.data2THint(),
  precise: true,
};

const classes = table(['כיתה', 'תלמידים', 'ספורטאים'], [['ז׳1', 40, 20], ['ז׳2', 25, 15]]);
const colours = table(['צבע', 'מספר תלמידים'], [['ירוק', 6], ['כחול', 9], ['אדום', 5]]);

const stair2: StairContent = {
  skill: 'data:2', topic: 'data', level: 2, title: 'שכיחות יחסית',
  objectives: [
    'לחשב שכיחות יחסית: השכיחות חלקי מספר כל הנתונים, כשבר וכמספר עשרוני.',
    'להשוות קבוצות בגדלים שונים לפי השכיחות היחסית, ולא לפי מספר הפריטים.',
    'לדעת שכל השכיחויות היחסיות יחד הן $1$.',
  ],
  idea: 'שכיחות יחסית אומרת איזה חלק מכל הנתונים הוא ערך מסוים: השכיחות חלקי מספר כל הנתונים.',
  why: [
    '$20$ ספורטאים מתוך $40$ הם חצי, ו־$15$ מתוך $25$ הם יותר מחצי. כדי להשוות קבוצות בגדלים שונים משווים חלקים, לא כמויות.',
    'החלקים של כל הערכים יחד הם כל הנתונים, ולכן סכום השכיחויות היחסיות הוא $1$.',
  ],
  alt: ['פס: הפס הוא כל הכיתה. צובעים בו את החלק של הספורטאים, ומשווים פסים באותו אורך.'],
  discover: [
    { kind: 'say', text: 'מועצת התלמידים רוצה לדעת איזו כיתה ספורטיבית יותר.', fig: { ...classes, anim: true } as FigSpec },
    { kind: 'predict', text: 'נציג ז׳1 אומר: "אצלנו $20$ ספורטאים ואצלכם $15$, אז אנחנו ספורטיביים יותר." הוא צודק?', fig: classes,
      choices: ['לא בטוח: הכיתות בגדלים שונים', 'כן, $20 > 15$'], answer: 0,
      why: 'בז׳1 $20$ מתוך $40$, חצי. בז׳2 $15$ מתוך $25$, יותר מחצי.',
      wrongWhy: { 1: '$20$ ספורטאים, אבל מתוך $40$. בז׳2 פחות ספורטאים, מתוך כיתה קטנה יותר.' } },
    { kind: 'explore', text: 'הפס הוא כל ז׳2, $25$ תלמידים, בחמש קבוצות של $5$. צבעו את הספורטאים.',
      manip: shadeBar(5, 25), answer: { mode: 'exact', den: 5, shaded: 3 },
      hint: '$15$ ספורטאים הם כמה קבוצות של $5$?',
      success: '$3$ מתוך $5$ קבוצות: $\\frac{15}{25} = \\frac{3}{5} = 0.6$.' },
    { kind: 'rule', text: 'שכיחות יחסית = השכיחות חלקי מספר כל הנתונים.', display: '\\frac{15}{25} = 0.6',
      why: 'כך משווים קבוצות בגדלים שונים: בז׳1 $0.5$ ובז׳2 $0.6$.',
      fig: fbars([{ den: 2, shaded: 1, label: 'ז׳1' }, { den: 5, shaded: 3, label: 'ז׳2' }]) },
    { kind: 'predict', text: 'מה השכיחות היחסית של כחול?', fig: colours,
      choices: ['$\\frac{9}{20} = 0.45$', '$\\frac{9}{11}$', '$9$'], answer: 0,
      why: 'מחלקים בכל הנתונים: $6 + 9 + 5 = 20$.',
      wrongWhy: { 1: '$11$ הם הירוק והאדום בלבד. מחלקים בכולם, גם בכחול.', 2: '$9$ הוא השכיחות. השכיחות היחסית היא החלק: $9$ מתוך $20$.' } },
    { kind: 'predict', text: 'מה יוצא כשמחברים את השכיחויות היחסיות של שלושת הצבעים?', fig: colours,
      choices: ['$1$', '$20$', '$3$'], answer: 0,
      why: '$\\frac{6}{20} + \\frac{9}{20} + \\frac{5}{20} = \\frac{20}{20} = 1$: כל החלקים יחד הם השלם.',
      wrongWhy: { 1: '$20$ הוא מספר התלמידים. החלקים שלהם יחד הם השלם, $1$.', 2: '$3$ הוא מספר הצבעים, לא סכום החלקים.' } },
    { kind: 'rule', text: 'אפשר לכתוב שכיחות יחסית כשבר פשוט או כמספר עשרוני: $\\frac{9}{20} = 0.45$. כל השכיחויות היחסיות יחד הן $1$.',
      why: 'שבר עם מכנה $20$ מרחיבים למכנה $100$: $\\frac{9}{20} = \\frac{45}{100} = 0.45$.',
      fig: { type: 'fbar', den: 20, tones: [{ n: 6, label: 'ירוק', tone: 2 }, { n: 9, label: 'כחול', tone: 0 }, { n: 5, label: 'אדום', tone: 3 }] } satisfies FractionFig },
    { kind: 'predict', text: 'בכיתה אחת $12$ מתוך $30$ תלמידים מנגנים, ובכיתה אחרת $9$ מתוך $20$. באיזו כיתה החלק של המנגנים גדול יותר?',
      fig: fbars([{ den: 10, shaded: 4, label: '30' }, { den: 20, shaded: 9, label: '20' }]),
      choices: ['בכיתה של $20$', 'בכיתה של $30$', 'שווה'], answer: 0,
      why: '$\\frac{12}{30} = 0.4$ ו־$\\frac{9}{20} = 0.45$.',
      wrongWhy: { 1: '$12 > 9$, אבל הכיתה של $30$ גדולה יותר.', 2: '$0.4$ ו־$0.45$ הם לא אותו חלק.' } },
  ],
  examples: [
    { problem: 'מה השכיחות היחסית של מי שמגיעים ברגל?', fig: table(['איך מגיעים לבית הספר', 'מספר תלמידים'], [['באוטובוס', 8], ['ברגל', 14], ['באופניים', 6], ['ברכב', 12]]),
      answer: 0.35, check: '14/40',
      steps: [
        { action: 'מחברים את כל השכיחויות.', why: 'סך הכול הוא מספר כל הנתונים.', result: '8 + 14 + 6 + 12 = 40', calc: { expr: '8+14+6+12', value: 40 } },
        { action: 'השכיחות חלקי סך הכול.', why: 'שכיחות יחסית היא החלק מכל הנתונים.', result: '\\frac{14}{40}', value: '14/40' },
        { action: 'כותבים כמספר עשרוני.', why: 'מרחיבים למכנה $100$.', result: '\\frac{14}{40} = \\frac{35}{100} = 0.35', value: '35/100' },
      ] },
    { problem: 'בצומת נספרו $50$ כלי רכב: $25$ מכוניות, $10$ אוטובוסים, $5$ אופנועים ו־$10$ משאיות. מה השכיחות היחסית של האוטובוסים?',
      answer: 0.2, check: '10/50',
      steps: [
        { action: 'בודקים את סך הכול.', why: 'כל כלי רכב נספר פעם אחת.', result: '25 + 10 + 5 + 10 = 50', calc: { expr: '25+10+5+10', value: 50 } },
        { action: 'האוטובוסים חלקי כל כלי הרכב.', why: 'שכיחות יחסית היא החלק מכולם.', result: '\\frac{10}{50} = 0.2', value: '10/50' },
        { action: 'בודקים: כל השכיחויות היחסיות יחד.', why: 'יחד הן צריכות להיות $1$.', result: '0.5 + 0.2 + 0.1 + 0.2 = 1', calc: { expr: '0.5+0.2+0.1+0.2', value: 1 } },
      ] },
  ],
  together: [
    { problem: 'בסקר $25$ תלמידים, ו־$7$ מהם בחרו כדורעף.',
      steps: [
        { prompt: 'במה מחלקים?', choices: [
          { text: 'ב־$25$, כל התלמידים', ok: true, feedback: 'נכון: שכיחות יחסית היא חלק מכולם.' },
          { text: 'ב־$18$, מי שלא בחרו כדורעף', ok: false, feedback: 'זה משווה את הכדורעף לשאר. שכיחות יחסית היא מתוך כולם.' },
          { text: 'ב־$7$', ok: false, feedback: '$7$ הם החלק עצמו. מחלקים אותו בכל התלמידים.' },
        ], hints: ['"מתוך" כמה?', '$7$ מתוך $25$.'], done: 'מחלקים את $7$ ב־$25$.' },
      ],
      final: { prompt: 'מה השכיחות היחסית של הכדורעף?', answer: 0.28, check: '7/25', precise: true, hints: ['$\\frac{7}{25}$: הרחיבו למכנה $100$.', '$\\frac{7}{25} = \\frac{28}{100}$.'] } },
    { problem: 'בכיתה אחת $24$ תלמידים, ו־$6$ מהם צמחונים. בכיתה אחרת $20$ תלמידים, ו־$6$ מהם צמחונים.',
      steps: [
        { prompt: 'איך משווים?', choices: [
          { text: 'מחשבים לכל כיתה את החלק', ok: true, feedback: 'נכון: $\\frac{6}{24}$ ו־$\\frac{6}{20}$.' },
          { text: '$6$ ו־$6$: שוות', ok: false, feedback: 'אותו מספר צמחונים, אבל מתוך כיתות בגדלים שונים.' },
          { text: 'הכיתה הגדולה יותר', ok: false, feedback: 'גודל הכיתה לבד לא אומר איזה חלק מהם צמחונים.' },
        ], hints: ['כמה צמחונים מתוך כל כיתה?', '$\\frac{6}{24}$ ו־$\\frac{6}{20}$.'], done: 'בכיתה של $24$: $\\frac{6}{24} = 0.25$. בכיתה של $20$: $\\frac{6}{20}$.' },
      ],
      final: { prompt: 'מה השכיחות היחסית הגדולה מבין השתיים?', answer: 0.3, check: '6/20', precise: true, hints: ['$\\frac{6}{20}$, מתוך הכיתה הקטנה.', '$\\frac{6}{20} = \\frac{30}{100}$.'] } },
  ],
  diag: data2,
  transfer: data2T,
  words: ['שכיחות יחסית', 'סך הכול', 'חלק', 'שבר', 'מספר עשרוני'],
  misconceptions: [
    { id: 'part-part', title: 'חילקו בשאר הנתונים במקום בכל הנתונים',
      cause: 'משווים את החלק לשאר, כמו ביחס $9 : 11$. שכיחות יחסית היא החלק מתוך הכול.',
      explain: ['$9$ מתוך $20$ הם $\\frac{9}{20}$. המכנה הוא כל הנתונים, גם ה־$9$ עצמם.', '$\\frac{9}{11}$ משווה את הכחול לשאר, וזה יחס, לא חלק.'],
      remedy: [
        { kind: 'predict', text: '$9$ מתוך $20$ תלמידים בחרו כחול. מה השכיחות היחסית?', fig: fbar(20, 9),
          choices: ['$\\frac{9}{20}$', '$\\frac{9}{11}$'], answer: 0, why: 'המכנה הוא כל $20$ התלמידים.' },
        { kind: 'explore', text: 'הפס הוא $20$ תלמידים. צבעו את ה־$9$ שבחרו כחול.', manip: shadeBar(20), answer: { mode: 'value', value: 0.45 },
          hint: 'כל חלק בפס הוא תלמיד אחד.', success: '$9$ מתוך $20$ חלקים: $0.45$ מהפס.' },
      ] },
    { id: 'bigger-count', title: 'השוו לפי מספר הפריטים בלי להתחשב בגודל הקבוצה',
      cause: 'במספרים שלמים "יותר" הוא יותר. כשהקבוצות בגדלים שונים, משווים חלקים.',
      explain: ['בז׳1 $20$ ספורטאים מתוך $40$, חצי. בז׳2 $15$ מתוך $25$, יותר מחצי.', 'מחשבים בכל קבוצה את החלק, ורק אז משווים.'],
      remedy: [
        { kind: 'predict', text: 'איזו כיתה ספורטיבית יותר?', fig: classes,
          choices: ['ז׳2', 'ז׳1'], answer: 0, why: '$\\frac{15}{25} = 0.6$, יותר מ־$\\frac{20}{40} = 0.5$.' },
        { kind: 'explore', text: 'הפס הוא כל ז׳2, $25$ תלמידים, בחמש קבוצות של $5$. צבעו את $15$ הספורטאים.', manip: shadeBar(5, 25), answer: { mode: 'exact', den: 5, shaded: 3 },
          hint: '$15$ הם שלוש קבוצות של $5$.', success: '$3$ מתוך $5$: יותר מחצי הפס.' },
      ] },
    { id: 'freq-only', title: 'כתבו את השכיחות במקום את השכיחות היחסית',
      cause: 'השכיחות היא כמה; השכיחות היחסית היא איזה חלק.',
      explain: ['$9$ הוא כמה תלמידים. השכיחות היחסית היא $9$ מתוך כולם.', 'שכיחות יחסית תמיד בין $0$ ל־$1$.'],
      remedy: [
        { kind: 'predict', text: '$9$ מתוך $20$ תלמידים בחרו כחול. מה השכיחות היחסית?', fig: colours,
          choices: ['$0.45$', '$9$'], answer: 0, why: '$\\frac{9}{20} = 0.45$: חלק מהשלם.' },
      ] },
    { id: 'inverse-ratio', title: 'חילקו את השלם בחלק במקום את החלק בשלם',
      cause: 'מחלקים את הגדול בקטן מתוך הרגל. כאן מחלקים את החלק בשלם, ולכן יוצא פחות מ־$1$.',
      explain: ['$14$ מתוך $40$ הם $\\frac{14}{40} = 0.35$.', '$\\frac{40}{14}$ גדול מ־$1$, וחלק לא יכול להיות גדול מהשלם.'],
      remedy: [
        { kind: 'predict', text: '$14$ מתוך $40$ תלמידים מגיעים ברגל. מה השכיחות היחסית?', fig: fbar(20, 7, { whole: 40 }),
          choices: ['$0.35$', '$\\frac{40}{14}$'], answer: 0, why: 'החלק חלקי השלם: $\\frac{14}{40} = 0.35$.' },
      ] },
    { id: 'per-category', title: 'חשבו שכל שורה בטבלה היא חלק שווה מהשלם',
      cause: 'כשיש ארבע שורות נדמה שכל אחת היא רבע. אבל בכל שורה מספר אחר של פריטים.',
      explain: ['החלק של שורה תלוי בכמה פריטים יש בה, לא במספר השורות.', 'בטבלה של $2$, $9$, $4$ ו־$5$, ה־$9$ הם $\\frac{9}{20}$, לא $\\frac{1}{4}$.'],
      remedy: [
        { kind: 'predict', text: 'מה השכיחות היחסית של כחול?', fig: table(['צבע', 'מספר תלמידים'], [['ירוק', 2], ['כחול', 9], ['אדום', 4], ['צהוב', 5]]),
          choices: ['$\\frac{9}{20}$', '$\\frac{1}{4}$'], answer: 0, why: '$2 + 9 + 4 + 5 = 20$, ומתוכם $9$ כחולים.' },
      ] },
    { id: 'pct-for-dec', title: 'כתבו את החלק באחוזים, במקום כשבר או כמספר עשרוני',
      cause: '$45\\%$ ו־$0.45$ הם אותו חלק. כאן מבקשים שבר או מספר עשרוני, ולכן כותבים $0.45$.',
      explain: ['$45\\% = \\frac{45}{100} = 0.45$.', 'המספר $45$ לבד הוא הרבה יותר מהשלם, $1$.'],
      remedy: [
        { kind: 'predict', text: '$9$ מתוך $20$ הם $45\\%$. כמספר עשרוני:', fig: fbar(20, 9),
          choices: ['$0.45$', '$45$'], answer: 0, why: 'אחוז הוא מאית: $45\\% = \\frac{45}{100} = 0.45$.' },
      ] },
    { id: 'div-by-rel', title: 'חילקו את מספר כל הנתונים בשכיחות היחסית במקום לכפול בה',
      cause: 'כשמחפשים חלק מכמות, כופלים בחלק. $0.35$ מ־$40$ הם פחות מ־$40$.',
      explain: ['$0.35$ מ־$40$: $40 \\cdot 0.35 = 14$.', '$40 : 0.35$ יוצא יותר מ־$100$, יותר מכל הכיתה.'],
      remedy: [
        { kind: 'predict', text: 'השכיחות היחסית של מי שמגיעים ברגל היא $0.35$, ובכיתה $40$ תלמידים. כמה מגיעים ברגל?', fig: fbar(20, 7, { whole: 40 }),
          choices: ['$40 \\cdot 0.35 = 14$', '$40 : 0.35$, יותר מ־$100$'], answer: 0, why: 'חלק מכמות הוא כפל: $0.35 \\cdot 40 = 14$.' },
      ] },
  ],
};

// ================================================================ stair 3: percent and the pie

type P3 = { N: number; ps: number[]; x: number };
const data3: DiagModel<P3> = {
  params: (rnd) => G.DATA3.params(rnd),
  text: (p) => G.data3Text(p),
  fig: (p) => G.data3Fig(p) as FigSpec,
  answer: (p) => G.DATA3.answer(p),
  bugs: G.DATA3.bugs,
  solution: (p) => G.data3Solution(p),
  hint: (p) => G.data3Hint(p),
};
type P3T = { p: number; N: number; c: number };
const data3T: DiagModel<P3T> = {
  params: (rnd) => G.DATA3T.params(rnd),
  text: (p) => G.data3TText(p),
  fig: (p) => G.data3TFig(p) as FigSpec,
  answer: (p) => G.DATA3T.answer(p),
  bugs: G.DATA3T.bugs,
  solution: (p) => G.data3TSolution(p),
  hint: (p) => G.data3THint(p),
};

const TRIP = ['ים', 'הרים', 'מדבר'];
const TRIP_PCT = [35, 40, 25];
const BLUE = ['כחול', 'ירוק', 'אדום', 'צהוב'];

const stair3: StairContent = {
  skill: 'data:3', topic: 'data', level: 3, title: 'אחוזים ודיאגרמת עוגה',
  objectives: [
    'לכתוב שכיחות יחסית באחוזים, בעיקר $10\\%$, $20\\%$, $25\\%$, $50\\%$ וכפולותיהם.',
    'לקרוא דיאגרמת עוגה: כל הגזרות יחד הן $100\\%$; למצוא כמה פריטים יש בגזרה, ואת השלם מגזרה אחת.',
    'לדעת מתי מתאימה דיאגרמת עוגה: רק לחלקים של שלם אחד.',
  ],
  idea: 'שכיחות יחסית באחוזים: כופלים ב־$100$. בדיאגרמת עוגה כל גזרה היא חלק מהשלם, וכל הגזרות יחד הן $100\\%$.',
  why: [
    '$\\frac{125}{500} = 0.25$, כלומר $25$ מאיות: $25\\%$.',
    'עוגה היא שלם אחד, ולכן היא מתאימה רק לחלקים שמשלימים זה את זה. $60\\%$, $45\\%$ ו־$70\\%$ של שלוש כיתות שונות הם $175\\%$: אין עוגה כזאת.',
  ],
  alt: ['שעון: חצי עוגה הוא חצי שעה, רבע עוגה הוא רבע שעה. $25\\%$ הם רבע מהעיגול.'],
  discover: [
    { kind: 'say', text: 'משפחה ניסתה להתקשר $500$ פעמים, ורשמה מה קרה בכל פעם.', fig: pie(CALLS, CALL_COUNTS, { anim: true }) },
    { kind: 'predict', text: 'איזה חלק מהחיוגים הסתיימו בשיחה?', fig: table(['מה קרה', 'מספר חיוגים'], CALLS.map((c, i) => [c, CALL_COUNTS[i]])),
      choices: ['חצי, $50\\%$', '$250\\%$', '$25\\%$'], answer: 0,
      why: '$\\frac{250}{500} = 0.5 = 50\\%$.',
      wrongWhy: { 1: '$250$ הוא מספר החיוגים, לא האחוז.', 2: '$25\\%$ הם רבע. $250$ מתוך $500$ הם חצי.' } },
    { kind: 'rule', text: 'שכיחות יחסית באחוזים: השכיחות חלקי הכול, כפול $100$.', display: '\\frac{125}{500} = 0.25 = 25\\%',
      why: 'אחוז הוא מאית, ולכן כופלים ב־$100$.', fig: pie(CALLS, [50, 20, 25, 5], { pct: true }) },
    { kind: 'explore', text: 'צבעו את העוגה לפי החיוגים: שיחה $250$, אין תשובה $100$, קו מקולקל $125$, תפוס $25$. כל חלק בעוגה הוא $5\\%$.',
      manip: buildPie(CALLS, 20), answer: { values: [10, 4, 5, 1] },
      hint: '$250$ מתוך $500$ הם חצי: $10$ חלקים מתוך $20$.',
      success: 'העוגה מראה איזה חלק מהשלם הוא כל תשובה: $50\\%$, $20\\%$, $25\\%$ ו־$5\\%$.' },
    { kind: 'predict', text: 'מה האחוז של מדבר?', fig: pie(TRIP, [45, 30, 25], { pct: true, hide: 2 }),
      choices: ['$25\\%$', '$75\\%$', '$30\\%$'], answer: 0,
      why: 'כל הגזרות יחד הן $100\\%$: $100 - 45 - 30 = 25$.',
      wrongWhy: { 1: '$45 + 30 = 75$ הם שתי הגזרות האחרות. מה שנשאר עד $100$ הוא $25$.', 2: 'הגזרה נראית קטנה מזו של $30\\%$. מחשבים: $100 - 45 - 30$.' } },
    { kind: 'predict', text: 'בשכבה $240$ תלמידים. כמה תלמידים בחרו טיול לים?', fig: pie(TRIP, TRIP_PCT, { pct: true }),
      choices: ['$84$', '$35$', '$6.86$'], answer: 0,
      why: '$10\\%$ מ־$240$ הם $24$, אז $30\\%$ הם $72$ ו־$5\\%$ הם $12$: $72 + 12 = 84$.',
      wrongWhy: { 1: '$35$ הוא האחוז, לא מספר התלמידים.', 2: '$240 : 35$ שואל כמה פעמים $35$ נכנס ב־$240$.' } },
    { kind: 'predict', text: '$75$ תלמידים בחרו כחול, והם $30\\%$ מהשכבה. כמה תלמידים בשכבה?', fig: pie(BLUE, [30, 25, 25, 20], { pct: true, tones: [0, 2, 3, 4] }),
      choices: ['$250$', '$22.5$', '$2.5$'], answer: 0,
      why: '$30\\%$ הם $75$, אז $10\\%$ הם $25$, ו־$100\\%$ הם $250$.',
      wrongWhy: { 1: 'חישבתם $30\\%$ מ־$75$. כאן $75$ הוא החלק, ומחפשים את השלם.', 2: '$75 : 30 = 2.5$ הוא $1\\%$. השלם הוא $100\\%$.' } },
    { kind: 'predict', text: 'אפשר להציג את האחוזים של שלוש הכיתות בדיאגרמת עוגה אחת?', fig: bar(['ז׳1', 'ז׳2', 'ז׳3'], [60, 45, 70], { step: 10, max: 100, every: 2, unit: 'אחוז המשתתפים בחוג', labels: true }),
      choices: ['לא: הם לא חלקים של שלם אחד', 'כן'], answer: 0,
      why: 'סכום האחוזים $175\\%$. בעוגה כל הגזרות יחד הן $100\\%$.',
      wrongWhy: { 1: 'כל אחוז הוא מכיתה אחרת. בעוגה אחת כל הגזרות הן חלקים של אותו שלם.' } },
  ],
  examples: [
    { problem: 'בשכבה $120$ תלמידים. כמה בחרו מחשב?', fig: pie(['קריאה', 'ספורט', 'מחשב'], [25, 40, 35], { pct: true }),
      answer: 42, check: '0.35*120',
      steps: [
        { action: 'מוצאים $10\\%$.', why: '$10\\%$ הם עשירית.', result: '120 : 10 = 12', calc: { expr: '120/10', value: 12 } },
        { action: 'מוצאים $5\\%$.', why: '$5\\%$ הם חצי מ־$10\\%$.', result: '12 : 2 = 6', calc: { expr: '12/2', value: 6 } },
        { action: 'בונים $35\\%$ מ־$30\\%$ ועוד $5\\%$.', why: '$30\\%$ הם שלוש פעמים $10\\%$.', result: '3 \\cdot 12 + 6 = 42', value: '3*12 + 6' },
      ] },
    { problem: 'בכיתה $40$ תלמידים: $14$ באים ברגל, $10$ באוטובוס ו־$16$ ברכב. איזה אחוז באים ברגל?',
      answer: 35, check: '14/40*100',
      steps: [
        { action: 'בודקים את סך הכול.', why: 'כל תלמיד בא בדרך אחת.', result: '14 + 10 + 16 = 40', calc: { expr: '14+10+16', value: 40 } },
        { action: 'החלק כפול $100$.', why: 'אחוז הוא מאית.', result: '\\frac{14}{40} \\cdot 100 = 35', value: '14/40*100' },
        { action: 'כותבים באחוזים.', why: '$35$ מאיות.', result: '35\\%', value: '35' },
      ] },
    { problem: '$75$ תלמידים הם $30\\%$ מהשכבה. כמה בשכבה?',
      answer: 250, check: '75/30*100',
      steps: [
        { action: 'מוצאים $10\\%$.', why: '$10\\%$ הם שליש מ־$30\\%$.', result: '75 : 3 = 25', calc: { expr: '75/3', value: 25 } },
        { action: 'מוצאים $100\\%$.', why: '$100\\%$ הם עשר פעמים $10\\%$.', result: '25 \\cdot 10 = 250', value: '25*10' },
      ] },
  ],
  together: [
    { problem: 'בסקר $300$ תלמידים. כמה בחרו קריאה?', fig: pie(['ספורט', 'קריאה', 'מוזיקה'], [20, 45, 35], { pct: true }),
      steps: [
        { prompt: 'כמה הם $1\\%$ מ־$300$?', choices: [
          { text: '$3$', ok: true, feedback: 'נכון: $300 : 100 = 3$.' },
          { text: '$300$', ok: false, feedback: '$300$ הם כל התלמידים, $100\\%$.' },
          { text: '$45$', ok: false, feedback: '$45$ הוא האחוז, לא הכמות.' },
        ], hints: ['$1\\%$ הוא מאית.', '$300 : 100$.'], done: '$1\\%$ מ־$300$ הם $3$ תלמידים.' },
      ],
      final: { prompt: 'כמה תלמידים בחרו קריאה?', answer: 135, check: '0.45*300', hints: ['קריאה היא $45\\%$, וכל אחוז הוא $3$ תלמידים.', '$45 \\cdot 3$.'] } },
    { problem: '$60$ תלמידים בחרו שחייה, והגזרה שלהם בעוגה היא $25\\%$.',
      steps: [
        { prompt: '$25\\%$ הם:', choices: [
          { text: 'רבע', ok: true, feedback: 'נכון: $25\\% = \\frac{1}{4}$.' },
          { text: 'חצי', ok: false, feedback: 'חצי הם $50\\%$.' },
          { text: '$25$ תלמידים', ok: false, feedback: '$25$ הוא האחוז. $60$ הם הרבע.' },
        ], hints: ['$25$ מתוך $100$.', '$\\frac{25}{100} = \\frac{1}{4}$.'], done: '$60$ תלמידים הם רבע מכולם.' },
      ],
      final: { prompt: 'כמה תלמידים השתתפו בסקר?', answer: 240, check: '60*4', hints: ['רבע הוא $60$. כמה הם ארבעה רבעים?', '$60 \\cdot 4$.'] } },
  ],
  diag: data3,
  transfer: data3T,
  words: ['אחוז', 'דיאגרמת עוגה', 'גזרה', 'השלם ($100\\%$)'],
  misconceptions: [
    { id: 'count-as-pct', title: 'כתבו את האחוז עצמו כאילו הוא מספר התלמידים',
      cause: 'האחוז הוא המספר הראשון שרואים בגזרה. אבל הוא אומר איזה חלק, לא כמה.',
      explain: ['$35\\%$ מ־$240$ תלמידים הם $84$ תלמידים, לא $35$.', 'האחוז הוא החלק; כמה תלמידים תלוי בכמה יש בסך הכול.'],
      remedy: [
        { kind: 'predict', text: 'בשכבה $240$ תלמידים. כמה בחרו טיול לים?', fig: pie(TRIP, TRIP_PCT, { pct: true }),
          choices: ['$84$', '$35$'], answer: 0, why: '$35\\%$ מ־$240$: $72 + 12 = 84$.' },
        { kind: 'explore', text: 'בעוגה $20$ חלקים, כל אחד $5\\%$. צבעו לים $35\\%$, להרים $40\\%$ ולמדבר $25\\%$.', manip: buildPie(TRIP, 20), answer: { values: [7, 8, 5] },
          hint: '$35\\%$ הם $7$ חלקים של $5\\%$.', success: '$7$, $8$ ו־$5$ חלקים: כל העוגה, $100\\%$.' },
      ] },
    { id: 'div-by-pct', title: 'חילקו את מספר התלמידים במספר האחוזים',
      cause: 'מחלקים את שני המספרים שבשאלה. אבל $p\\%$ מכמות הוא $\\frac{p}{100}$ מהכמות.',
      explain: ['$35\\%$ מ־$240$: $0.35 \\cdot 240 = 84$.', '$240 : 35$ עונה על שאלה אחרת: כמה פעמים $35$ נכנס ב־$240$.'],
      remedy: [
        { kind: 'predict', text: 'בשכבה $240$ תלמידים, ו־$35\\%$ בחרו טיול לים. כמה תלמידים?', fig: pie(TRIP, TRIP_PCT, { pct: true }),
          choices: ['$84$', '$6.86$'], answer: 0, why: '$10\\%$ הם $24$; $35\\%$ הם $72 + 12 = 84$.' },
        { kind: 'explore', text: 'בעוגה $20$ חלקים, כל אחד $5\\%$ מ־$240$ תלמידים, כלומר $12$ תלמידים. צבעו $84$ תלמידים לים.', manip: buildPie(['ים', 'אחר'], 20, { lock: [1] }), answer: { values: [7, 0] },
          hint: '$84 : 12$ חלקים.', success: '$7$ חלקים של $12$ תלמידים: $84$, כלומר $35\\%$.' },
      ] },
    { id: 'pct-of-part', title: 'חישבו אחוז מהחלק הנתון במקום למצוא את השלם',
      cause: 'רגילים לחשב אחוז מכמות. כאן הכמות הנתונה היא החלק, ומחפשים את השלם.',
      explain: ['$75$ הם $30\\%$ מהשכבה. השלם גדול מ־$75$.', '$30\\%$ מ־$75$ הם $22.5$, פחות מהחלק עצמו: לא יכול להיות השלם.'],
      remedy: [
        { kind: 'predict', text: '$75$ תלמידים בחרו כחול, והם $30\\%$ מהשכבה. כמה תלמידים בשכבה?', fig: pie(BLUE, [30, 25, 25, 20], { pct: true, tones: [0, 2, 3, 4] }),
          choices: ['$250$', '$22.5$'], answer: 0, why: '$10\\%$ הם $25$, ולכן $100\\%$ הם $250$.' },
        { kind: 'explore', text: 'בעוגה $20$ חלקים, כל אחד $5\\%$. צבעו את ה־$30\\%$ של הכחול.', manip: buildPie(['כחול', 'אחר'], 20, { tones: [0, 5], lock: [1] }), answer: { values: [6, 0] },
          hint: '$30\\%$ הם $6$ חלקים של $5\\%$.', success: '$6$ חלקים הם $75$ תלמידים, ולכן כל חלק הוא $12.5$, וכל העוגה $250$.' },
      ] },
    { id: 'stop-at-one', title: 'מצאו כמה הם $1\\%$ ועצרו שם',
      cause: 'מוצאים את $1\\%$ ושוכחים שהשאלה היא על כל השכבה, $100\\%$.',
      explain: ['$75 : 30 = 2.5$ הוא $1\\%$.', 'השלם הוא $100\\%$: $2.5 \\cdot 100 = 250$.'],
      remedy: [
        { kind: 'predict', text: '$75$ תלמידים הם $30\\%$ מהשכבה, ולכן $1\\%$ הוא $2.5$. כמה בשכבה?', fig: pie(BLUE, [30, 25, 25, 20], { pct: true, tones: [0, 2, 3, 4] }),
          choices: ['$250$', '$2.5$'], answer: 0, why: 'כל השכבה היא $100\\%$: $2.5 \\cdot 100 = 250$.' },
        { kind: 'explore', text: 'בעוגה $20$ חלקים, כל אחד $5\\%$. צבעו את כל השכבה, $100\\%$.', manip: buildPie(['כל השכבה', 'אחר'], 20, { lock: [1] }), answer: { values: [20, 0] },
          hint: 'כל העוגה היא $100\\%$.', success: '$20$ חלקים: כל השכבה, ולא רק $1\\%$ ממנה.' },
      ] },
    { id: 'inverse-ratio', title: 'חילקו את כל התלמידים בחלק במקום את החלק בכולם',
      cause: 'מחלקים את הגדול בקטן מתוך הרגל. איזה אחוז הם $14$ מתוך $40$ זה $14$ חלקי $40$.',
      explain: ['$\\frac{14}{40} \\cdot 100 = 35$, כלומר $35\\%$.', '$\\frac{40}{14} \\cdot 100$ יוצא יותר מ־$100\\%$: יותר מכל הכיתה.'],
      remedy: [
        { kind: 'predict', text: 'בכיתה $40$ תלמידים, ו־$14$ באים ברגל. איזה אחוז באים ברגל?', fig: fbar(20, 7, { whole: 40 }),
          choices: ['$35\\%$', '$285\\%$'], answer: 0, why: 'החלק בשלם: $\\frac{14}{40} = 0.35 = 35\\%$.' },
      ] },
    { id: 'pie-not-whole', title: 'הציגו בעוגה נתונים שאינם חלקים של שלם אחד',
      cause: 'עוגה נראית מתאימה לכל אחוזים. אבל היא שלם אחד, וחלקיה משלימים ל־$100\\%$.',
      explain: ['בעוגה כל הגזרות יחד הן $100\\%$ של אותו שלם.', '$60\\%$, $45\\%$ ו־$70\\%$ של שלוש כיתות שונות הם $175\\%$: אין עוגה כזאת.'],
      remedy: [
        { kind: 'predict', text: 'אפשר להציג את האחוזים של שלוש הכיתות בדיאגרמת עוגה אחת?', fig: bar(['ז׳1', 'ז׳2', 'ז׳3'], [60, 45, 70], { step: 10, max: 100, every: 2, unit: 'אחוז המשתתפים בחוג', labels: true }),
          choices: ['לא: הם לא חלקים של שלם אחד', 'כן'], answer: 0, why: '$60 + 45 + 70 = 175$, יותר מ־$100$.' },
      ] },
  ],
};

// ================================================================ stair 4: probability from relative frequency

type P4 = { c: number[]; N: number; j: number; k: number };
const data4: DiagModel<P4> = {
  params: (rnd) => G.DATA4.params(rnd),
  text: (p) => G.data4Text(p),
  fig: (p) => G.data4Fig(p) as FigSpec,
  answer: (p) => G.DATA4.answer(p),
  bugs: G.DATA4.bugs,
  solution: (p) => G.data4Solution(p),
  hint: () => G.data4Hint(),
  precise: true,
};
type P4T = { B: number; n: number; w: number; c: number };
const data4T: DiagModel<P4T> = {
  params: (rnd) => G.DATA4T.params(rnd),
  text: (p) => G.data4TText(p),
  answer: (p) => G.DATA4T.answer(p),
  bugs: G.DATA4T.bugs,
  solution: (p) => G.data4TSolution(p),
  hint: () => G.data4THint(),
};

const wallet = (hl = false) => table(['שטר', 'כמה שטרות'], [['20 ש״ח', 4], ['50 ש״ח', 2], ['100 ש״ח', 1]], hl ? { highlight: [0] } : {});
const marbles = table(['צבע', 'כמה פעמים יצא'], [['לבן', 70], ['שחור', 50]]);

const stair4: StairContent = {
  skill: 'data:4', topic: 'data', level: 4, title: 'הסתברות מתוך שכיחות',
  objectives: [
    'להבין הסתברות כמספר בין $0$ (לא יכול לקרות) ל־$1$ (ודאי).',
    'כשבוחרים באקראי מקבוצה, ההסתברות לסוג היא השכיחות היחסית שלו בקבוצה.',
    'להעריך הסתברות לפי הרבה חזרות על ניסוי, ולדעת שמעט חזרות לא מספיקות.',
  ],
  idea: 'הסתברות היא מספר מ־$0$ עד $1$ שאומר כמה סביר שמשהו יקרה. כשבוחרים באקראי, היא השכיחות היחסית; כשחוזרים על ניסוי הרבה פעמים, השכיחות היחסית מתקרבת אליה.',
  why: [
    'בארנק $7$ שטרות, ו־$4$ מהם של $20$ ש״ח. אם מוציאים שטר בלי להסתכל ומחזירים, שוב ושוב, בערך ב־$4$ מכל $7$ פעמים יוצא שטר של $20$.',
    'אחרי $10$ סיבובים השכיחות היחסית יכולה להיות רחוקה; אחרי $1000$ היא כמעט תמיד קרובה.',
  ],
  alt: ['תחזית: "סיכוי לגשם $0.9$" אומר שבימים כאלה יורד גשם בערך ב־$9$ מכל $10$.'],
  discover: [
    { kind: 'say', text: 'הסתברות היא מספר מ־$0$ עד $1$. $0$: זה לא יכול לקרות. $1$: זה בטוח יקרה.',
      fig: { type: 'numline', from: 0, to: 1, step: 0.1, marks: [{ x: 0, label: 'בלתי אפשרי' }, { x: 0.5, label: 'סיכוי שווה' }, { x: 1, label: 'ודאי' }], anim: true } },
    { kind: 'predict', text: 'איפה כדאי לקחת מטרייה מחר?', fig: table(['עיר', 'הסתברות לגשם מחר'], [['ערד', 0.05], ['חיפה', 0.9]]),
      choices: ['בחיפה', 'בערד'], answer: 0,
      why: '$0.9$ קרוב ל־$1$: כמעט ודאי. $0.05$ קרוב ל־$0$.',
      wrongWhy: { 1: 'בערד ההסתברות $0.05$, קרובה ל־$0$: כמעט בטוח שלא ירד גשם.' } },
    { kind: 'predict', text: 'מוציאים שטר מהארנק בלי להסתכל. מה ההסתברות שזה שטר של $20$ ש״ח?', fig: wallet(),
      choices: ['$\\frac{4}{7}$', '$\\frac{1}{3}$', '$\\frac{4}{3}$'], answer: 0,
      why: '$4$ מתוך $7$ שטרות הם של $20$: השכיחות היחסית שלהם.',
      wrongWhy: { 1: 'יש $3$ סוגי שטרות, אבל לא מכל סוג אותו מספר.', 2: '$4$ מול $3$ האחרים הוא יחס. הסתברות היא מתוך כולם.' } },
    { kind: 'rule', text: 'כשבוחרים באקראי פריט מקבוצה, ההסתברות לסוג היא השכיחות היחסית שלו בקבוצה.', display: '\\frac{4}{7}',
      why: 'לכל שטר אותו סיכוי לצאת, ו־$4$ מתוך $7$ השטרות הם של $20$.', fig: wallet(true) },
    { kind: 'explore', text: 'סובבו $10$ פעמים, ואז עוד $100$, ועוד $1000$. מה קורה לשכיחות היחסית של אדום?',
      manip: spin({ seed: 20261111 }), answer: { mode: 'trials', atLeast: 1000 },
      hint: 'קודם $10$, אחר כך $100$, ואז $1000$.',
      success: 'אחרי מעט סיבובים השכיחות היחסית קופצת. אחרי הרבה היא נשארת ליד $0.25$: האדום הוא $3$ מתוך $12$ חלקים, רבע מהגלגל.' },
    { kind: 'predict', text: 'נועה סובבה את אותו גלגל $10$ פעמים, ואדום יצא $5$ פעמים. ההסתברות לאדום היא $0.5$?',
      fig: { type: 'chart', mode: 'line', xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], values: NOA, step: 0.25, max: 1, dp: 2, labels: false, unit: 'השכיחות היחסית של אדום אחרי כל סיבוב' },
      choices: ['לא: $10$ סיבובים זה מעט, והשכיחות עוד קופצת', 'כן'], answer: 0,
      why: '$10$ סיבובים הם מעט, והשכיחות היחסית עוד קופצת. אחרי $1000$ סיבובים היא קרובה מאוד ל־$0.25$, כי האדום הוא רבע מהגלגל.',
      wrongWhy: { 1: 'האדום הוא רבע מהגלגל. ב־$10$ סיבובים יכול לצאת $5$ במקרה, אבל אחרי הרבה סיבובים יוצא רבע.' } },
    { kind: 'predict', text: 'סובבו גלגל $1000$ פעמים. איך בנוי הגלגל?', fig: table(['צבע', 'כמה פעמים יצא'], [['כתום', 510], ['סגול', 243], ['ירוק', 247]]),
      choices: ['חצי כתום, רבע סגול ורבע ירוק', 'שלוש גזרות שוות', 'רבע כתום'], answer: 0,
      why: '$0.51$, $0.243$, $0.247$: קרוב ל־$\\frac{1}{2}$, $\\frac{1}{4}$, $\\frac{1}{4}$.',
      wrongWhy: { 1: 'בשלוש גזרות שוות כל צבע היה יוצא בערך $333$ פעמים.', 2: 'כתום יצא $510$ מתוך $1000$: בערך חצי.' } },
    { kind: 'predict', text: 'בשקית $24$ גולות. הוציאו גולה, רשמו והחזירו, $120$ פעמים, ו־$70$ פעמים יצאה לבנה. כמה גולות לבנות יש בשקית, בערך?', fig: marbles,
      choices: ['$14$', '$70$', '$0.58$'], answer: 0,
      why: '$\\frac{70}{120} \\approx 0.58$ מהשקית, ו־$0.58$ מ־$24$ הם בערך $14$.',
      wrongWhy: { 1: '$70$ הוא מספר הפעמים שיצאה לבנה. בשקית יש רק $24$ גולות.', 2: '$0.58$ הוא החלק של הלבנות. כמה גולות הן $0.58$ מ־$24$?' } },
  ],
  examples: [
    { problem: 'בקופסה $6$ עפרונות אדומים, $8$ כחולים ו־$6$ ירוקים. מה ההסתברות להוציא באקראי עיפרון כחול?',
      answer: 0.4, check: '8/20',
      steps: [
        { action: 'כמה עפרונות בקופסה?', why: 'ההסתברות היא מתוך כולם.', result: '6 + 8 + 6 = 20', calc: { expr: '6+8+6', value: 20 } },
        { action: 'הכחולים מתוך כולם.', why: 'לכל עיפרון אותו סיכוי לצאת.', result: '\\frac{8}{20}', value: '8/20' },
        { action: 'מצמצמים.', why: 'מחלקים מונה ומכנה ב־$4$.', result: '\\frac{8}{20} = \\frac{2}{5} = 0.4', value: '2/5' },
      ] },
    { problem: 'בשקית $30$ כדורים. $200$ פעמים הוציאו כדור והחזירו, ו־$80$ פעמים יצא אדום. כמה אדומים יש, בערך?',
      answer: 12, check: '80/200*30',
      steps: [
        { action: 'השכיחות היחסית של אדום.', why: 'היא אומדן לחלק של האדומים בשקית.', result: '\\frac{80}{200} = 0.4', calc: { expr: '80/200', value: 0.4 } },
        { action: 'אותו חלק מהשקית.', why: 'בערך $0.4$ מהכדורים אדומים.', result: '0.4 \\cdot 30 = 12', value: '0.4*30' },
      ] },
    { problem: 'בגלגל, האדום הוא $\\frac{1}{8}$ מהגלגל. בכמה מתוך $400$ סיבובים נצפה לאדום, בערך?',
      answer: 50, check: '400/8',
      steps: [
        { action: 'החלק של האדום מכל הסיבובים.', why: 'אחרי הרבה סיבובים השכיחות היחסית קרובה ל־$\\frac{1}{8}$.', result: '400 \\cdot \\frac{1}{8} = 50', value: '400/8' },
        { action: 'אומרים כמה בערך.', why: 'בניסוי אמיתי יכול לצאת קצת יותר או קצת פחות.', result: '50', value: '50' },
      ] },
  ],
  together: [
    { problem: 'בכד $5$ כדורים צהובים, $2$ אדומים ו־$3$ ירוקים. מוציאים כדור אחד באקראי.',
      steps: [
        { prompt: 'כמה כדורים בכד?', choices: [
          { text: '$10$', ok: true, feedback: 'נכון: $5 + 2 + 3 = 10$.' },
          { text: '$3$', ok: false, feedback: '$3$ הם הצבעים. לכל צבע מספר אחר של כדורים.' },
          { text: '$5$', ok: false, feedback: '$5$ הם הצהובים בלבד. ההסתברות היא מתוך כל הכדורים.' },
        ], hints: ['מחברים את כל הכדורים.', '$5 + 2 + 3$.'], done: 'בכד $10$ כדורים.' },
      ],
      final: { prompt: 'מה ההסתברות להוציא כדור אדום?', answer: 0.2, check: '2/10', precise: true, hints: ['$2$ אדומים מתוך $10$ כדורים.', '$\\frac{2}{10}$.'] } },
    { problem: 'קובייה הוטלה $600$ פעמים, ו־$6$ יצא $150$ פעמים.',
      steps: [
        { prompt: 'מה השכיחות היחסית של $6$?', choices: [
          { text: '$\\frac{150}{600}$', ok: true, feedback: 'נכון: $150$ מתוך $600$ הטלות.' },
          { text: '$\\frac{1}{6}$', ok: false, feedback: '$\\frac{1}{6}$ נכון לקובייה הוגנת. כאן מעריכים מהניסוי, ו־$150$ רחוק מ־$100$.' },
          { text: '$150$', ok: false, feedback: '$150$ הוא מספר הפעמים. השכיחות היחסית היא החלק מכל ההטלות.' },
        ], hints: ['כמה פעמים יצא $6$, מתוך כמה הטלות?', '$150$ מתוך $600$.'], done: 'השכיחות היחסית היא $\\frac{150}{600}$.' },
      ],
      final: { prompt: 'מה האומדן להסתברות לקבל $6$ בקובייה הזאת?', answer: 0.25, check: '150/600', precise: true, hints: ['$\\frac{150}{600}$: צמצמו.', '$\\frac{150}{600} = \\frac{1}{4}$.'] } },
  ],
  diag: data4,
  transfer: data4T,
  words: ['הסתברות', 'באקראי', 'ודאי', 'בלתי אפשרי', 'ניסוי', 'אומדן'],
  misconceptions: [
    { id: 'equiprob', title: 'הניחו שלכל סוג אותו סיכוי, בלי להתחשב בכמה יש מכל סוג',
      cause: 'כשיש שלושה סוגים נדמה שלכל סוג סיכוי שליש. הסיכוי תלוי בכמה פריטים יש מכל סוג.',
      explain: ['בארנק $4$ שטרות של $20$, $2$ של $50$ ו־$1$ של $100$: לשטר של $20$ סיכוי $\\frac{4}{7}$, לא $\\frac{1}{3}$.', 'לכל פריט אותו סיכוי, לא לכל סוג.'],
      remedy: [
        { kind: 'predict', text: 'מוציאים שטר מהארנק בלי להסתכל. מה ההסתברות שזה שטר של $20$ ש״ח?', fig: wallet(),
          choices: ['$\\frac{4}{7}$', '$\\frac{1}{3}$'], answer: 0, why: '$4$ מתוך $7$ השטרות הם של $20$.' },
        { kind: 'explore', text: 'מוציאים שטר ומחזירים, שוב ושוב. הוציאו $10$, ואז $100$, ואז $1000$. כמה פעמים יוצא שטר של $20$?',
          manip: { kind: 'simulate', device: 'bag', bag: [{ label: 'שטר של 20', n: 4, tone: 0 }, { label: 'שטר של 50', n: 2, tone: 2 }, { label: 'שטר של 100', n: 1, tone: 4 }], watch: 0, guided: true, truth: true },
          answer: { mode: 'trials', atLeast: 1000 },
          hint: 'קודם $10$, אחר כך $100$, ואז $1000$.', success: 'השכיחות היחסית של שטר של $20$ קרובה ל־$\\frac{4}{7}$, יותר מחצי, לא שליש.' },
      ] },
    { id: 'part-part', title: 'חילקו בשאר הנתונים במקום בכל הנתונים',
      cause: 'משווים את הסוג לשאר, כמו ביחס. הסתברות היא מתוך כל הפריטים.',
      explain: ['$4$ שטרות של $20$ מתוך $7$: $\\frac{4}{7}$.', '$\\frac{4}{3}$ משווה אותם ל־$3$ האחרים, ויוצא יותר מ־$1$: הסתברות לא יכולה להיות כזאת.'],
      remedy: [
        { kind: 'predict', text: 'בכד $2$ כדורים אדומים ו־$8$ כדורים אחרים. מה ההסתברות להוציא אדום?', fig: fbar(10, 2),
          choices: ['$\\frac{2}{10}$', '$\\frac{2}{8}$'], answer: 0, why: 'המכנה הוא כל $10$ הכדורים.' },
      ] },
    { id: 'old-total', title: 'חילקו בסך הכול הישן, לפני שנוספו פריטים',
      cause: 'אחרי שינוי בקבוצה, גם החלק וגם השלם משתנים.',
      explain: ['בסקר $300$ תלמידים, $30$ מהם בלי חוג. הצטרפו $60$ בלי חוג: $90$ מתוך $360$.', '$\\frac{90}{300}$ מחלק בשלם שכבר לא קיים.'],
      remedy: [
        { kind: 'predict', text: 'בסקר $300$ תלמידים, ו־$30$ מהם לא בשום חוג. הצטרפו עוד $60$ תלמידים, וכולם לא בשום חוג. מה ההסתברות לבחור באקראי תלמיד שלא בשום חוג?',
          fig: fbars([{ den: 10, shaded: 1, label: 'לפני' }, { den: 12, shaded: 3, label: 'אחרי' }]),
          choices: ['$\\frac{90}{360}$', '$\\frac{90}{300}$', '$\\frac{30}{360}$'], answer: 0, why: 'עכשיו $90$ בלי חוג, מתוך כל $360$ התלמידים.' },
      ] },
    { id: 'new-not-counted', title: 'הוסיפו את החדשים לסך הכול ולא לחלק',
      cause: 'זוכרים שהשלם גדל, ושוכחים שגם החלק גדל.',
      explain: ['$60$ התלמידים החדשים לא בשום חוג, ולכן הם גם בחלק: $30 + 60 = 90$.', 'ההסתברות: $\\frac{90}{360}$, לא $\\frac{30}{360}$.'],
      remedy: [
        { kind: 'predict', text: 'בסקר $300$ תלמידים, ו־$30$ מהם לא בשום חוג. הצטרפו עוד $60$ תלמידים, וכולם לא בשום חוג. כמה תלמידים לא בשום חוג עכשיו?',
          fig: fbars([{ den: 10, shaded: 1, label: 'לפני' }, { den: 12, shaded: 3, label: 'אחרי' }]),
          choices: ['$90$', '$30$'], answer: 0, why: 'כל $60$ החדשים לא בשום חוג: $30 + 60 = 90$.' },
      ] },
    { id: 'old-rel', title: 'השתמשו בשכיחות היחסית מלפני השינוי',
      cause: 'השכיחות היחסית הייתה $10\\%$, ונדמה שהיא נשארת כך.',
      explain: ['כשמצטרפים תלמידים מסוג אחד, החלק של הסוג הזה גדל.', 'לפני: $\\frac{30}{300} = 0.1$. אחרי: $\\frac{90}{360} = 0.25$.'],
      remedy: [
        { kind: 'predict', text: 'לפני השינוי $10\\%$ מהתלמידים לא היו בשום חוג. הצטרפו תלמידים, וכולם לא בשום חוג. החלק שלהם עכשיו:',
          fig: fbars([{ den: 10, shaded: 1, label: 'לפני' }, { den: 12, shaded: 3, label: 'אחרי' }]),
          choices: ['גדול מ־$10\\%$', 'עדיין $10\\%$'], answer: 0, why: 'החלק גדל: $\\frac{90}{360} = 0.25$.' },
      ] },
    { id: 'rel-not-scaled', title: 'עצרו בשכיחות היחסית ולא כפלו במספר הכולל',
      cause: 'מוצאים איזה חלק יצא בניסוי ושוכחים שהשאלה היא על מספר הכדורים בשקית.',
      explain: ['$\\frac{70}{120} \\approx 0.58$ הוא החלק של הלבנות.', 'בשקית $24$ גולות: $0.58$ מ־$24$ הם בערך $14$.'],
      remedy: [
        { kind: 'predict', text: 'בשקית $24$ גולות. הוציאו גולה, רשמו והחזירו, $120$ פעמים, ו־$70$ פעמים יצאה לבנה. כמה גולות לבנות יש בשקית, בערך?', fig: marbles,
          choices: ['$14$', '$0.58$'], answer: 0, why: '$0.58$ הוא החלק. החלק הזה מ־$24$ הוא בערך $14$.' },
      ] },
    { id: 'draws-as-count', title: 'כתבו כמה פעמים יצא הצבע, במקום כמה כדורים כאלה יש בשקית',
      cause: 'מספר הפעמים שיצא צבע תלוי בכמה פעמים הוציאו, לא בכמה כדורים יש. בשקית יש רק $24$.',
      explain: ['$70$ פעמים מתוך $120$ הוצאות: זה החלק, $\\frac{70}{120}$.', 'בשקית של $24$ גולות לא יכולות להיות $70$ לבנות.'],
      remedy: [
        { kind: 'predict', text: 'בשקית $24$ גולות. הוציאו גולה, רשמו והחזירו, $120$ פעמים, ו־$70$ פעמים יצאה לבנה. כמה גולות לבנות יש בשקית, בערך?', fig: marbles,
          choices: ['$14$', '$70$'], answer: 0, why: 'בשקית רק $24$ גולות. $\\frac{70}{120}$ מהן הן בערך $14$.' },
      ] },
    { id: 'small-sample', title: 'סמכו על מעט ניסויים כאילו הם נותנים את ההסתברות',
      cause: 'אחרי כמה ניסויים נדמה שכבר יודעים. אבל בעשרה ניסויים השכיחות היחסית עוד קופצת.',
      explain: ['אחרי $10$ סיבובים השכיחות היחסית יכולה להיות רחוקה מההסתברות.', 'אחרי $1000$ סיבובים היא כמעט תמיד קרובה.'],
      remedy: [
        { kind: 'explore', text: 'סובבו $10$ פעמים, ואז עוד $100$, ועוד $1000$. מתי השכיחות היחסית של אדום מפסיקה לקפוץ?',
          manip: spin(), answer: { mode: 'trials', atLeast: 1000 },
          hint: 'קודם $10$, אחר כך $100$, ואז $1000$.', success: 'אחרי הרבה סיבובים השכיחות היחסית כמעט לא זזה: היא ליד $0.25$.' },
      ] },
  ],
};

export const DATA: StairContent[] = [stair1, stair2, stair3, stair4];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/data.js names them all). */
export const CATS_DATA: Record<string, string> = {};
