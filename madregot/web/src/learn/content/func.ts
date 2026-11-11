// Introduction to functions (מבוא לפונקציות): unit 8.7 of grade 8 (ח׳), November in the Ministry's תשפ״ז schedule, in
// the order of the Ministry's updated ח׳ algebra curriculum (stage5.md FUNC-2). This file holds the stairs built so far:
// func:1, reading a graph of a situation (also ז׳ 7.9's "קריאת גרף שמתאר מצב").
//
// One picture carries the stair: a graph of a situation is a story told point by point. Each point is a pair, a moment
// (x) and what was true then (y); it is read both ways, by the scale of each axis; a flat part means the value did not
// change; a duration is a difference on the x axis. The graph is never a picture of the way: Noa's walk to the library
// has a flat part because she stood still, not because the road was flat (Leinhardt, Zaslavsky & Stein 1990).
// The diagnostic models are the spec's (content/func.js FUNC1, FUNC1T, ported unchanged); each misconception's source is
// listed there. The stories and their numbers are the app's own; the RAMA 2024 item's type (a walk with a stop) is used,
// never its text.
import type { DiagModel, FigSpec, StairContent, ManipSpec, GraphAxis } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/func.js';

// ---------------------------------------------------------------- figures

type Pt = [number, number];
const time = (max: number, step: number, every?: number): GraphAxis => ({ max, step, label: 'זמן', unit: 'דקות', ...(every ? { every } : {}) });
const away = (max: number, step: number, every?: number): GraphAxis => ({ max, step, label: 'מרחק מהבית', unit: 'מטרים', ...(every ? { every } : {}) });
const sgraph = (x: GraphAxis, y: GraphAxis, pts: Pt[], extra: Record<string, unknown> = {}): FigSpec => ({ type: 'sgraph', x, y, series: [{ pts }], ...extra });

/** Noa's walk to the library and back: 10 minutes out to 600 m, 15 minutes there, 20 minutes home. */
const NOA: Pt[] = [[0, 0], [10, 600], [25, 600], [45, 0]];
const noa = (extra: Record<string, unknown> = {}) => sgraph(time(45, 5), away(700, 100), NOA, extra);
/** Dani's walk to the bus stop and back: 15 minutes out to 1200 m, 20 minutes there, 30 minutes home (40 m a minute). */
const DANI: Pt[] = [[0, 0], [15, 1200], [35, 1200], [65, 0]];
const dani = (extra: Record<string, unknown> = {}) => sgraph(time(65, 5, 2), away(1400, 200), DANI, extra);
/** A day's temperatures every 2 hours, 6:00 to 18:00 (a dot graph: 7.9's "נקודות על גרף"). */
const DAY: Pt[] = [[6, 12], [8, 15], [10, 18], [12, 22], [14, 24], [16, 21], [18, 18]];
const day: FigSpec = { type: 'sgraph', x: { min: 6, max: 18, step: 2, label: 'שעה', every: 2 }, y: { min: 10, max: 26, step: 1, every: 2, label: 'טמפרטורה', unit: 'מעלות' }, series: [{ pts: DAY, dots: true }] };
/** A point A three squares up on an axis numbered every 400 m (a square is 200 m), on an unnumbered line. */
const threeUp = sgraph(time(8, 1, 2), away(1200, 200, 2), [[0, 0], [4, 800], [8, 800]], { marks: [{ x: 3, y: 600, label: 'A' }] });
/** Water in a tank by the hour: 100 litres, filled from hour 2 to hour 6 up to 500. */
const tank = sgraph({ max: 8, step: 1, label: 'זמן', unit: 'שעות' }, { max: 600, step: 100, label: 'מים במכל', unit: 'ליטרים' }, [[0, 100], [2, 100], [6, 500], [8, 500]]);

/** The graph you draw: a walk of three parts of 5 minutes, home fixed, the other points starting at 200 m. */
const walkGraph = (y: GraphAxis): ManipSpec => ({ kind: 'graph', x: time(15, 5), y, start: [0, 200, 200, 200], fixed: [0] });

// ================================================================ stair 1: reading a graph of a situation

type P1 = { sx: number; sy: number; a: number; b: number; c: number; e: number; t1: number; d1: number; t2: number; t3: number; q: number; pts: Pt[] };
const func1: DiagModel<P1> = {
  params: (rnd) => G.FUNC1.params(rnd),
  text: (p) => G.func1Text(p),
  fig: (p) => G.walkFig(p) as FigSpec,
  answer: (p) => G.FUNC1.answer(p),
  bugs: G.FUNC1.bugs,
  solution: (p) => G.func1Solution(p),
  hint: (p) => G.func1Hint(p),
};
type P1T = { k: number; temps: number[]; hours: number[]; q: number; i: number; j: number };
const func1T: DiagModel<P1T> = {
  params: (rnd) => G.FUNC1T.params(rnd),
  text: (p) => G.func1TText(p),
  fig: (p) => G.dayFig(p) as FigSpec,
  answer: (p) => G.FUNC1T.answer(p),
  bugs: G.FUNC1T.bugs,
  solution: (p) => G.func1TSolution(p),
  hint: (p) => G.func1THint(p),
};

/** The flat part: what did Noa do there (discover step 2, and the graph-picture remedy). */
const flatStep = {
  kind: 'predict' as const, text: 'מה עשתה נועה בין הדקה ה־$10$ לדקה ה־$25$?', fig: noa({ bands: [{ from: 10, to: 25 }] }),
  choices: ['עמדה במקום, בספרייה', 'הלכה בדרך ישרה ושטוחה', 'הלכה מהר מאוד'], answer: 0,
  why: 'המרחק מהבית לא השתנה: $600$ מטרים כל הזמן. קו שטוח אומר שהערך לא משתנה.',
  wrongWhy: { 1: 'הגרף אינו ציור של הדרך. הוא מראה מרחק מהבית לפי הזמן, וקו שטוח אומר שהמרחק לא השתנה.', 2: 'מהירות רואים בקו תלול. כאן הקו לא עולה ולא יורד.' },
};
/** Uri's walk drawn point by point (discover step 3, and the graph-picture remedy). */
const uriStep = {
  kind: 'explore' as const, text: 'אורי הלך $5$ דקות והגיע $400$ מטרים מהבית, עמד $5$ דקות, וחזר הביתה ב־$5$ דקות. סמנו את הגרף שלו.',
  manip: walkGraph(away(600, 100)), answer: { mode: 'values', values: [0, 400, 400, 0] },
  hint: 'בכל עמודה שאלו: כמה מטרים מהבית היה אורי ברגע הזה?', success: 'עלייה, קו שטוח וירידה: הלך, עמד וחזר.',
};
/** Three squares of 200 (discover step 5, and the count-squares remedy). */
const squaresStep = {
  kind: 'predict' as const, text: 'כל משבצת לגובה היא $200$ מטרים. הנקודה $A$ נמצאת שלוש משבצות מעל ציר $x$. כמה מטרים מהבית?', fig: threeUp,
  choices: ['$600$', '$3$', '$300$'], answer: 0,
  why: '$3 \\cdot 200 = 600$. סופרים משבצות וכופלים בגודל של משבצת.',
  wrongWhy: { 1: '$3$ הוא מספר המשבצות, לא המרחק.', 2: 'כל משבצת היא $200$ מטרים, לא $100$.' },
};
/** A duration is a difference (discover step 7). */
const durationRule = {
  kind: 'rule' as const, text: 'משך זמן הוא הפרש בין שני רגעים: נועה הייתה בספרייה מהדקה ה־$10$ עד הדקה ה־$25$, כלומר $25 - 10 = 15$ דקות.',
  display: '25 - 10 = 15', why: 'הרגע שבו משהו נגמר אינו כמה זמן הוא נמשך.', fig: noa({ bands: [{ from: 10, to: 25 }] }),
};
/** How long the way back took (discover step 8, and the end-for-duration remedy). */
const backStep = {
  kind: 'predict' as const, text: 'כמה דקות לקחה הדרך חזרה?', fig: noa({ bands: [{ from: 25, to: 45 }] }),
  choices: ['$20$', '$45$', '$25$'], answer: 0,
  why: '$45 - 25 = 20$: מהרגע שיצאה מהספרייה עד שהגיעה הביתה.',
  wrongWhy: { 1: '$45$ הוא הרגע שבו הגיעה הביתה, לא משך הדרך.', 2: '$25$ הוא הרגע שבו יצאה מהספרייה.' },
};

const stair1: StairContent = {
  skill: 'func:1', topic: 'func', level: 1, title: 'קריאת גרף של מצב',
  objectives: [
    'לקרוא גרף של מצב: מה הערך ברגע נתון, ומתי היה ערך נתון (לפעמים יותר מפעם אחת).',
    'לקרוא את קנה המידה של כל ציר: כמה שווה משבצת.',
    'להבין מה אומרים קו עולה, קו יורד וקו שטוח, ולחשב משך זמן כהפרש.',
  ],
  idea: 'גרף של מצב הוא סיפור: כל נקודה היא זוג, רגע ($x$) ומה שקרה בו ($y$). קוראים בשני כיוונים, ובודקים כמה שווה כל משבצת.',
  why: [
    'ציר $x$ הוא בדרך כלל הזמן, וציר $y$ הוא מה שמשתנה: מרחק, טמפרטורה, כמות.',
    'קו שטוח אומר שהערך לא השתנה. אם $y$ הוא המרחק מהבית, קו שטוח אומר שעמדו במקום.',
    'משך זמן הוא הפרש בין שני רגעים על ציר $x$.',
  ],
  alt: ['דמיינו שמצלמים את נועה כל דקה ורושמים כמה רחוק היא מהבית. הגרף הוא כל הרישומים, מחוברים בקו.'],
  discover: [
    { kind: 'say', text: 'נועה הלכה לספרייה וחזרה. הגרף מספר את הסיפור: כל נקודה היא רגע והמרחק מהבית באותו רגע. אחרי $10$ דקות נועה הייתה $600$ מטרים מהבית.', fig: noa({ anim: true }) },
    flatStep,
    uriStep,
    { kind: 'rule', text: 'קוראים גרף בשני כיוונים. מ־$x$ אל $y$: עולים מהזמן עד הגרף ופונים לציר $y$. מ־$y$ אל $x$: הולכים מהערך ימינה עד הגרף ויורדים לציר $x$.',
      why: 'אחרי $5$ דקות נועה הייתה $300$ מטרים מהבית, ו־$300$ מטרים היא הייתה גם אחרי $35$ דקות.', fig: noa({ guide: { x: 5, y: 300 } }) },
    squaresStep,
    { kind: 'predict', text: 'מתי נועה הייתה $300$ מטרים מהבית?', fig: noa(),
      choices: ['אחרי $5$ דקות, וגם אחרי $35$ דקות', 'רק אחרי $5$ דקות', 'אחרי $300$ דקות'], answer: 0,
      why: 'קו אופקי בגובה $300$ פוגש את הגרף פעמיים: בדרך לספרייה ובדרך חזרה.',
      wrongWhy: { 1: 'גם בדרך חזרה נועה עברה במרחק $300$ מטרים מהבית, אחרי $35$ דקות.', 2: '$300$ הוא מרחק במטרים, על ציר $y$. הזמן נקרא על ציר $x$.' } },
    durationRule,
    backStep,
  ],
  examples: [
    { problem: 'הגרף מראה את המרחק של דני מהבית בדרך לתחנה ובחזרה. כמה דקות עמד דני בתחנה?', fig: dani(), answer: 20, check: '35-15',
      steps: [
        { action: 'מוצאים את הקטע השטוח.', why: 'בקטע שטוח המרחק מהבית לא משתנה: דני עמד במקום, מהדקה ה־$15$ עד הדקה ה־$35$.', result: '(15, 1200) \\to (35, 1200)' },
        { action: 'מחסירים: הרגע שנגמר פחות הרגע שהתחיל.', why: 'משך זמן הוא הפרש בין שני רגעים.', result: '35 - 15 = 20', calc: { expr: '35-15', value: 20 }, value: '35-15' },
      ] },
    { problem: 'כמה מטרים מהבית היה דני אחרי $50$ דקות?', fig: dani({ guide: { x: 50 } }), answer: 600, check: '1200 - (50-35)*1200/30',
      steps: [
        { action: 'עולים מ־$50$ על ציר $x$ עד הגרף, ופונים לציר $y$.', why: 'הגרף שם שלוש משבצות מעל הציר, וכל משבצת לגובה היא $200$ מטרים.', result: '3 \\cdot 200 = 600', calc: { expr: '3*200', value: 600 }, value: '3*200' },
        { action: 'בדיקה בחשבון: בדרך חזרה $1200$ מטרים ב־$30$ דקות.', why: 'מהדקה ה־$35$ עד הדקה ה־$65$ המרחק ירד מ־$1200$ ל־$0$ באופן שווה.', result: '1200 : 30 = 40', calc: { expr: '1200/30', value: 40 } },
        { action: 'אחרי $50$ דקות עברו $15$ דקות מאז הדקה ה־$35$.', why: 'בכל דקה המרחק קטן ב־$40$ מטרים.', result: '1200 - 15 \\cdot 40 = 600', value: '1200 - 15*40' },
      ] },
    { problem: 'הגרף מראה את הטמפרטורה ביום אחד, נקודה בכל שעתיים. כמה שעות עברו בין הפעם הראשונה שהיו $18^\\circ$ לפעם השנייה?', fig: day, answer: 8, check: '18-10',
      steps: [
        { action: 'מוצאים את שתי הנקודות בגובה $18$.', why: 'הולכים מ־$18$ על ציר $y$ ימינה, ומוצאים נקודה בשעה $10$ ונקודה בשעה $18$.', result: '(10, 18),\\ (18, 18)' },
        { action: 'מחסירים את השעות.', why: 'הזמן שעבר הוא הפרש בין שתי השעות, לא מספר המשבצות.', result: '18 - 10 = 8', calc: { expr: '18-10', value: 8 }, value: '18-10' },
      ] },
  ],
  together: [
    { problem: 'באיזו דקה היה דני $800$ מטרים מהבית בדרך חזרה?', fig: dani({ guide: { y: 800 } }),
      steps: [
        { prompt: 'יש שתי נקודות על הגרף בגובה $800$. איזו מהן בדרך חזרה?', choices: [
          { text: 'זו שב־$45$', ok: true, feedback: 'נכון: בחלק היורד המרחק מהבית קטן, וזו הדרך חזרה.' },
          { text: 'זו שב־$10$', ok: false, feedback: 'בדקה ה־$10$ דני עוד הלך לתחנה: המרחק גדל.' },
        ], hints: ['באיזה חלק של הגרף דני חוזר הביתה?', 'בדרך חזרה המרחק מהבית קטן: זה החלק היורד.'], done: 'הנקודה בחלק היורד.' },
        { prompt: 'איך יודעים איזה חלק הוא הדרך חזרה?', choices: [
          { text: 'המרחק מהבית קטן', ok: true, feedback: 'נכון: כשחוזרים, מתקרבים לבית.' },
          { text: 'הקו יורד כמו במורד', ok: false, feedback: 'הגרף לא מצייר את השטח. ירידה בגרף אומרת שהמרחק מהבית קטן.' },
        ], hints: ['מה מראה ציר $y$ בגרף הזה?', 'ציר $y$ הוא המרחק מהבית, לא הגובה של הדרך.'], done: 'בדרך חזרה המרחק מהבית קטן.' },
      ],
      final: { prompt: 'באיזו דקה?', answer: 45, check: '35 + (1200-800)/40', hints: ['הולכים מ־$800$ ימינה עד החלק היורד, ויורדים לציר $x$.', 'בדרך חזרה דני מתקרב $40$ מטרים בכל דקה: $400$ מטרים הם $10$ דקות אחרי הדקה ה־$35$.'] } },
    { problem: 'הגרף מראה כמה ליטרים מים יש במכל לפי השעה. כמה ליטרים נוספו בין שעה $2$ לשעה $6$?', fig: tank,
      steps: [
        { prompt: 'כמה ליטרים היו במכל בשעה $2$?', choices: [
          { text: '$100$', ok: true, feedback: 'נכון: ב־$x = 2$ הגרף בגובה $100$.' },
          { text: '$0$', ok: false, feedback: 'ב־$x = 2$ הגרף בגובה $100$, לא $0$.' },
        ], hints: ['עלו מ־$2$ על ציר $x$ עד הגרף.', 'הגרף מתחיל בגובה $100$ ונשאר שם עד שעה $2$.'], done: 'בשעה $2$ היו $100$ ליטרים.' },
      ],
      final: { prompt: 'כמה ליטרים נוספו?', answer: 400, check: '500-100', hints: ['כמה היו בשעה $6$?', 'בשעה $6$ היו $500$ ליטרים. כמה נוספו מאז שעה $2$?'] } },
  ],
  diag: func1,
  transfer: func1T,
  words: ['גרף של מצב', 'ציר', 'משבצת', 'קנה מידה של ציר', 'מרחק מהבית', 'משך זמן'],
  misconceptions: [
    { id: 'graph-picture', title: 'קראו את הגרף כמו ציור של הדרך, ולא כקשר בין שני גדלים',
      cause: 'הגרף נראה כמו נוף, אז קוראים אותו כמו תמונה של המקום.',
      explain: ['ציר $y$ הוא מרחק מהבית, לא גובה. קו שטוח: המרחק לא משתנה. קו יורד: מתקרבים הביתה.'],
      remedy: [flatStep, uriStep] },
    { id: 'count-squares', title: 'ספרו משבצות ולא כפלו בגודל של כל משבצת',
      cause: 'סופרים משבצות ושוכחים לבדוק כמה שווה כל אחת.',
      explain: ['כל ציר כותב מספר רק על חלק מהקווים. בודקים כמה שווה משבצת אחת, וכופלים במספר המשבצות.', 'שלוש משבצות של $200$ מטרים הן $3 \\cdot 200 = 600$ מטרים.'],
      remedy: [
        squaresStep,
        { kind: 'explore', text: 'דני הלך $5$ דקות והגיע $600$ מטרים מהבית, עמד $5$ דקות, וחזר הביתה ב־$5$ דקות. כל משבצת לגובה היא $200$ מטרים. סמנו את הגרף שלו.',
          manip: walkGraph(away(1200, 200, 2)), answer: { mode: 'values', values: [0, 600, 600, 0] },
          hint: '$600$ מטרים הם שלוש משבצות של $200$.', success: 'שלוש משבצות של $200$ הן $600$ מטרים.' },
      ] },
    { id: 'end-for-duration', title: 'ענו את הרגע שבו זה נגמר, ולא כמה זמן זה נמשך',
      cause: '"מתי" ו"כמה זמן" נשמעים דומה.',
      explain: ['"מתי" שואל על רגע אחד על ציר $x$. "כמה זמן" שואל על ההפרש בין שני רגעים.', 'נועה יצאה מהספרייה בדקה ה־$25$ והגיעה הביתה בדקה ה־$45$: הדרך נמשכה $45 - 25 = 20$ דקות.'],
      remedy: [durationRule, backStep] },
    { id: 'value-not-change', title: 'ענו את הערך בסוף, ולא בכמה הוא השתנה',
      cause: 'שואלים "בכמה עלה", ועונים "לכמה הגיע".',
      explain: ['"בכמה עלתה" שואל על השינוי: ההפרש בין הערך בסוף לערך בהתחלה.', 'מ־$15^\\circ$ ל־$22^\\circ$ הטמפרטורה עלתה ב־$22 - 15 = 7$ מעלות, והגיעה ל־$22$.'],
      remedy: [
        { kind: 'predict', text: 'בכמה מעלות עלתה הטמפרטורה מהשעה $8$ עד השעה $12$?', fig: day,
          choices: ['$7$', '$22$', '$4$'], answer: 0,
          why: 'בשעה $8$ היו $15^\\circ$ ובשעה $12$ היו $22^\\circ$: העלייה היא $22 - 15 = 7$.',
          wrongWhy: { 1: '$22$ הוא הערך בשעה $12$, לא בכמה הוא עלה.', 2: '$4$ הוא מספר השעות שעברו, לא בכמה מעלות עלתה הטמפרטורה.' } },
      ] },
  ],
};

export const FUNC: StairContent[] = [stair1];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/func.js names them all). */
export const CATS_FUNC: Record<string, string> = {};
export { func1, func1T };
