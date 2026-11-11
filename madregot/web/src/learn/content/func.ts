// Introduction to functions (מבוא לפונקציות): unit 8.7 of grade 8 (ח׳), November in the Ministry's תשפ״ז schedule, in
// the order of the Ministry's updated ח׳ algebra curriculum (stage5.md FUNC-2). This file holds the stairs built so far:
// func:1, reading a graph of a situation (also ז׳ 7.9's "קריאת גרף שמתאר מצב"), func:2, the function and its
// representations, and func:3, increasing, decreasing and constant (with func:3 the November unit 8.7 is whole).
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

// ================================================================ stair 2: the function and its representations
// One idea carries the stair: a function gives every x exactly one y, and it is the same function in words, in a table,
// on a graph and as a rule. The night refuel (7 ₪ a litre and a fixed 2 ₪ a refuel) is the Ministry's own example
// (algebra_8); F = 1.8C + 32 too. A y given is a value of the function: its x is found by undoing the rule.

type P2 = { m: number; b: number; x: number; y: number; q: number };
const func2: DiagModel<P2> = {
  params: (rnd) => G.FUNC2.params(rnd),
  text: (p) => G.func2Text(p),
  answer: (p) => G.FUNC2.answer(p),
  bugs: G.FUNC2.bugs,
  solution: (p) => G.func2Solution(p),
  hint: (p) => G.func2Hint(p),
};
type P2T = { C: number; F: number; q: number };
const func2T: DiagModel<P2T> = {
  params: (rnd) => G.FUNC2T.params(rnd),
  text: (p) => G.func2TText(p),
  answer: (p) => G.FUNC2T.answer(p),
  bugs: G.FUNC2T.bugs,
  solution: (p) => G.func2TSolution(p),
  hint: (p) => G.func2THint(p),
  unit: 'מעלות',
};

/** The night refuel: 7 ₪ a litre and 2 ₪ once a refuel, for 1 to 4 litres. */
const FUEL: Pt[] = [[1, 9], [2, 16], [3, 23], [4, 30]];
const fuelTable: FigSpec = { type: 'table', head: ['ליטרים', 'ש״ח'], rows: FUEL };
/** The same function as points on a graph (the litres are counted, so points, not a line). */
const fuelDots: FigSpec = { type: 'sgraph', x: { max: 5, step: 1, label: 'דלק', unit: 'ליטרים' }, y: { max: 35, step: 1, every: 5, label: 'מחיר', unit: 'ש״ח' }, series: [{ pts: FUEL, dots: true }] };
/**
 * A big wheel's cabin: its height by the minute, a curve; a vertical line from minute 4 meets it once, at the top (there
 * the guide's line across to the y axis touches the curve once too, so no dashed line crosses it twice).
 */
const wheel: FigSpec = { type: 'sgraph', x: { max: 8, step: 1, label: 'זמן', unit: 'דקות' }, y: { max: 40, step: 5, label: 'גובה', unit: 'מטרים' }, series: [{ pts: [[0, 5], [2, 20], [4, 35], [6, 20], [8, 5]], smooth: true }], guide: { x: 4 } };
/** A gym membership: 150 ₪ a month whatever the number of workouts. */
const gym: FigSpec = { type: 'sgraph', x: { max: 12, step: 1, every: 2, label: 'אימונים בחודש' }, y: { max: 200, step: 50, label: 'מחיר', unit: 'ש״ח' }, series: [{ pts: [[0, 150], [12, 150]] }] };

/** The fixed fee is paid once (discover step 2, and the forgot-b remedy). */
const feeStep = {
  kind: 'predict' as const, text: 'בלילה מוסיפים עמלה קבועה של $2$ ש״ח לכל תדלוק. כמה יעלו $5$ ליטרים?', fig: fuelTable,
  choices: ['$37$', '$35$', '$45$'], answer: 0,
  why: '$7 \\cdot 5 + 2 = 37$. העמלה משולמת פעם אחת, לא על כל ליטר.',
  wrongWhy: { 1: '$35$ הוא רק מחיר הדלק. העמלה מתווספת פעם אחת.', 2: '$45$ הוא כאילו העמלה על כל ליטר: $9 \\cdot 5$.' },
};
/** A price paid is a value of the function: find its x (discover step 7, and the forward remedy). */
const paidStep = {
  kind: 'predict' as const, text: 'שילמו בלילה $72$ ש״ח. כמה ליטרים תדלקו?', fig: fuelTable,
  choices: ['$10$', '$506$', '$70$'], answer: 0,
  why: '$7x + 2 = 72$, כלומר $7x = 70$ ו־$x = 10$. כאן $72$ הוא ערך הפונקציה ($y$), ומחפשים את $x$.',
  wrongWhy: { 1: '$506$ הוא המחיר של $72$ ליטרים: הציבו את $72$ במקום $x$.', 2: '$70$ הוא מחיר הדלק בלי העמלה, עוד לא מספר הליטרים.' },
};
/** A constant is a function (discover step 8, and the const-not-function remedy). */
const gymStep = {
  kind: 'predict' as const, text: 'מנוי לחדר כושר עולה $150$ ש״ח בחודש, בלי קשר למספר האימונים. האם זו פונקציה?', fig: gym,
  choices: ['כן: לכל מספר אימונים יש מחיר אחד, $150$', 'לא: אין בה $x$'], answer: 0,
  why: 'פונקציה צריכה ערך אחד לכל $x$, לא ערכים שונים. קבוע הוא פונקציה, והגרף שלו קו אופקי.',
  wrongWhy: { 1: 'גם בלי $x$ בכלל, לכל מספר אימונים יש מחיר אחד: $y = 150$. זו פונקציה קבועה.' },
};
/** Multiply before adding (the order-ops remedy, example 1 as a question). */
const orderStep = {
  kind: 'predict' as const, text: 'לפי $F = 1.8C + 32$, כמה מעלות פרנהייט הן $25$ מעלות צלזיוס?', fig: { type: 'machine', inX: 25, rule: '1.8C + 32', outY: '?' } as FigSpec,
  choices: ['$77$', '$102.6$', '$45$'], answer: 0,
  why: 'קודם כופלים: $1.8 \\cdot 25 = 45$, ואז מוסיפים: $45 + 32 = 77$.',
  wrongWhy: { 1: '$102.6$ יוצא כשמחברים קודם: $1.8 \\cdot (25 + 32)$. בנוסחה כופלים לפני שמחברים.', 2: '$45$ הוא רק $1.8 \\cdot 25$: עוד צריך להוסיף $32$.' },
};
/** The taxi with and without its opening fee, drawn against y = 4x (the forgot-b remedy). */
const taxiStep = {
  kind: 'explore' as const,
  text: 'מונית: $12$ ש״ח דמי פתיחה ועוד $4$ ש״ח לכל ק״מ. הקו המקווקו הוא $y = 4x$, המחיר בלי דמי הפתיחה. גררו כל נקודה למחיר האמיתי.',
  manip: { kind: 'graph', x: { max: 3, step: 1, label: 'נסיעה', unit: 'ק״מ' }, y: { max: 24, step: 4, label: 'מחיר', unit: 'ש״ח' }, start: [0, 4, 8, 12], ref: { pts: [[0, 0], [1, 4], [2, 8], [3, 12]], label: 'y = 4x' } } as ManipSpec,
  answer: { mode: 'values', values: [12, 16, 20, 24] },
  hint: 'כבר ב־$0$ ק״מ משלמים $12$ ש״ח: כל נקודה עולה $12$ מעל הקו המקווקו.',
  success: 'כל נקודה גבוהה ב־$12$ מהקו המקווקו: $y = 4x + 12$. את דמי הפתיחה משלמים פעם אחת בכל נסיעה.',
};

const stair2: StairContent = {
  skill: 'func:2', topic: 'func', level: 2, title: 'פונקציה וייצוגיה',
  objectives: [
    'לדעת שפונקציה נותנת לכל $x$ ערך אחד בדיוק של $y$, ולזהות מתי זו לא פונקציה.',
    'לעבור בין מילים, טבלה, גרף וביטוי של אותה פונקציה.',
    'לחשב ערך של פונקציה, ולמצוא את $x$ שנותן ערך נתון.',
  ],
  idea: 'פונקציה היא כלל שנותן לכל $x$ ערך אחד של $y$. אפשר לכתוב אותה במילים, בטבלה, בגרף או בביטוי, וזו אותה פונקציה.',
  why: [
    'ליטר דלק עולה $7$ ש״ח: לכל כמות יש מחיר אחד. בלילה מוסיפים $2$ ש״ח לכל תדלוק: $y = 7x + 2$.',
    'כש־$x$ אחד מקבל שני ערכים, כבר לא יודעים מה הערך שלו: זו לא פונקציה.',
  ],
  alt: ['מכונה: מכניסים $x$, יוצא $y$ אחד. אותו $x$ תמיד מוציא אותו $y$.'],
  discover: [
    { kind: 'say', text: 'פונקציה היא כלל: לכל ערך של $x$ היא נותנת ערך אחד בדיוק של $y$. ליטר דלק עולה $7$ ש״ח, אז $3$ ליטרים עולים $21$ ש״ח.',
      fig: { type: 'machine', inX: 3, rule: 'y = 7x', outY: 21, anim: true } },
    feeStep,
    { kind: 'rule', text: 'ארבעה ייצוגים לאותה פונקציה: מילים, טבלה, גרף וביטוי.', display: 'y = 7x + 2', fig: fuelDots,
      why: 'כל ייצוג אומר אותו דבר: לכל כמות דלק יש מחיר אחד. בגרף, מעל כל כמות יש נקודה אחת.' },
    { kind: 'explore', text: 'סמנו את הנקודות של $y = 2x + 1$ עבור $x = 0, 1, 2, 3$.',
      manip: { kind: 'graph', x: { max: 3, step: 1, label: 'x' }, y: { max: 8, step: 1, label: 'y' }, start: [0, 0, 0, 0] },
      answer: { mode: 'values', values: [1, 3, 5, 7] },
      hint: 'הציבו כל $x$: $2 \\cdot 0 + 1 = 1$.', success: 'ארבע נקודות, וכל צעד ימינה עולה $2$.' },
    { kind: 'predict', text: 'בטבלה הזאת $x = 2$ מופיע פעמיים, עם $y = 5$ ועם $y = 7$. האם זו פונקציה?',
      fig: { type: 'table', head: ['x', 'y'], rows: [[1, 4], [2, 5], [2, 7], [3, 8]] },
      choices: ['לא: ל־$x = 2$ יש שני ערכים', 'כן: כל ה־$y$ שונים'], answer: 0,
      why: 'בפונקציה לכל $x$ יש ערך אחד. כשמבקשים את $y$ של $x = 2$, צריכה להיות תשובה אחת.',
      wrongWhy: { 1: 'מה ש־$y$ שונים לא עוזר: ל־$x = 2$ יש גם $5$ וגם $7$, ואז לא יודעים מה הערך שלו.' } },
    { kind: 'rule', text: 'בגרף של פונקציה כל קו אנכי פוגש את הגרף לכל היותר פעם אחת.', fig: wheel,
      why: 'קו אנכי הוא $x$ אחד. שתי נקודות עליו הן שני ערכים לאותו $x$.' },
    paidStep,
    gymStep,
  ],
  examples: [
    { problem: 'בארצות הברית מודדים טמפרטורה במעלות פרנהייט: $F = 1.8C + 32$. כמה מעלות פרנהייט הן $25^\\circ$ צלזיוס?', answer: 77, check: '1.8*25+32',
      steps: [
        { action: 'קודם כופלים.', why: 'בנוסחה כופלים לפני שמחברים: $1.8$ כפול מספר המעלות בצלזיוס.', result: '1.8 \\cdot 25 = 45', calc: { expr: '1.8*25', value: 45 } },
        { action: 'אחר כך מוסיפים $32$.', why: 'את $32$ מוסיפים פעם אחת, אחרי הכפל.', result: '45 + 32 = 77', value: '45+32' },
      ] },
    { problem: 'מד חום מראה $50$ מעלות פרנהייט. כמה זה בצלזיוס?', answer: 10, check: '(50-32)/1.8',
      steps: [
        { action: 'מחפשים את $C$ שנותן $F = 50$: מבטלים קודם את ההוספה.', why: 'ב־$F = 1.8C + 32$ את $32$ מוסיפים אחרון, ולכן מורידים אותו ראשון.', result: '50 - 32 = 18', calc: { expr: '50-32', value: 18 } },
        { action: 'ואז את הכפל.', why: 'נשאר $1.8C = 18$, ולכן מחלקים ב־$1.8$.', result: '18 : 1.8 = 10', value: '18/1.8' },
      ] },
    { problem: 'בטבלה ארבעה ערכים של פונקציה מהצורה $y = mx + b$. מה $y$ כש־$x = 10$?', fig: { type: 'table', head: ['x', 'y'], rows: [[0, 5], [1, 8], [2, 11], [3, 14]] }, answer: 35, check: '3*10+5',
      steps: [
        { action: 'כל צעד של $1$ ב־$x$ מוסיף ל־$y$ אותו מספר.', why: 'מ־$5$ ל־$8$, מ־$8$ ל־$11$ ומ־$11$ ל־$14$: בכל צעד $3$.', result: '8 - 5 = 3', calc: { expr: '8-5', value: 3 } },
        { action: 'כש־$x = 0$ יש $5$, ולכן $y = 3x + 5$.', why: 'הערך ב־$x = 0$ הוא החלק הקבוע. עכשיו מציבים $x = 10$.', result: 'y = 3 \\cdot 10 + 5 = 35', value: '3*10 + 5' },
      ] },
  ],
  together: [
    { problem: 'מונית: $12$ ש״ח בתחילת הנסיעה ועוד $4$ ש״ח לכל ק״מ. כמה עולה נסיעה של $8$ ק״מ?',
      steps: [
        { prompt: 'איזה ביטוי מתאר את המחיר?', choices: [
          { text: '$y = 4x + 12$', ok: true, feedback: 'נכון: $4$ ש״ח על כל ק״מ, ו־$12$ פעם אחת.' },
          { text: '$y = 12x + 4$', ok: false, feedback: '$12$ משלמים פעם אחת, ו־$4$ על כל ק״מ.' },
          { text: '$y = 16x$', ok: false, feedback: 'אז $8$ ק״מ היו עולים $128$. דמי הפתיחה לא חוזרים בכל ק״מ.' },
        ], hints: ['מה משלמים על כל ק״מ, ומה משלמים פעם אחת?', 'על כל ק״מ $4$ ש״ח, כלומר $4x$, ועוד $12$ פעם אחת.'], done: 'המחיר: $y = 4x + 12$.' },
      ],
      final: { prompt: 'כמה עולה נסיעה של $8$ ק״מ?', answer: 44, check: '4*8+12', hints: ['הציבו $x = 8$ ב־$y = 4x + 12$.', '$4 \\cdot 8 = 32$, ועוד $12$ פעם אחת.'] } },
    { problem: 'באותה מונית שילמו $60$ ש״ח. כמה ק״מ נסעו?',
      steps: [
        { prompt: 'מה פותרים?', choices: [
          { text: '$4x + 12 = 60$', ok: true, feedback: 'נכון: $60$ הוא המחיר, $y$, ומחפשים את $x$ שנותן אותו.' },
          { text: '$4 \\cdot 60 + 12$', ok: false, feedback: '$60$ הוא המחיר, ערך של $y$. מחפשים את $x$.' },
          { text: '$60 : 4$', ok: false, feedback: 'כך שוכחים את $12$ ש״ח של הפתיחה.' },
        ], hints: ['$60$ הוא מספר הק״מ או המחיר?', 'המחיר הוא $y$: כותבים $4x + 12 = 60$ ומוצאים את $x$.'], done: 'פותרים $4x + 12 = 60$.' },
      ],
      final: { prompt: 'כמה ק״מ נסעו?', answer: 12, check: '(60-12)/4', hints: ['קודם מחסירים $12$ משני האגפים.', '$4x = 48$, ואז מחלקים ב־$4$.'] } },
  ],
  diag: func2,
  transfer: func2T,
  words: ['פונקציה', 'ערך הפונקציה', 'משתנה בלתי תלוי', 'ייצוג', 'טבלת ערכים', 'פונקציה קבועה'],
  misconceptions: [
    { id: 'forgot-b', title: 'שכחו את החלק הקבוע (דמי פתיחה, עמלה, ערך ההתחלה)',
      cause: 'התרגלנו ש"כל אחד עולה כך וכך", ושוכחים את מה שמשלמים פעם אחת.',
      explain: ['ב־$y = 7x + 2$ יש שני חלקים: $7x$ גדל עם כל ליטר, ו־$2$ משולם פעם אחת בכל תדלוק.', 'לכן $5$ ליטרים עולים $7 \\cdot 5 + 2 = 37$, ולא $35$.'],
      remedy: [feeStep, taxiStep] },
    { id: 'forward', title: 'הציבו את ערך הפונקציה במקום $x$',
      cause: 'שני המספרים נראים אותו דבר, ושוכחים מי $x$ ומי $y$.',
      explain: ['כששואלים "שילמו $72$ ש״ח, כמה ליטרים?", $72$ הוא המחיר, כלומר $y$. מחפשים את $x$.', 'פותרים $7x + 2 = 72$ ומקבלים $x = 10$. כשמציבים $72$ במקום $x$, מקבלים את המחיר של $72$ ליטרים.'],
      remedy: [paidStep] },
    { id: 'order-ops', title: 'חיברו לפני שכפלו',
      cause: 'מחברים קודם את $C$ ו־$32$, כאילו יש סביבם סוגריים.',
      explain: ['ב־$F = 1.8C + 32$ כופלים קודם, $1.8 \\cdot C$, ורק אחר כך מוסיפים $32$.', 'ל־$25$ מעלות צלזיוס: $1.8 \\cdot 25 = 45$, ועוד $32$ זה $77$.'],
      remedy: [orderStep] },
    { id: 'const-not-function', title: 'חשבו שקבוע אינו פונקציה',
      cause: 'נדמה שפונקציה חייבת להשתנות, או שחייב להיות בה $x$.',
      explain: ['פונקציה צריכה ערך אחד לכל $x$, לא ערכים שונים.', 'מנוי של $150$ ש״ח בחודש נותן לכל מספר אימונים אותו מחיר: זו פונקציה קבועה, והגרף שלה קו אופקי.'],
      remedy: [gymStep] },
  ],
};

// ================================================================ stair 3: increasing, decreasing and constant
// One picture carries the stair: a finger on the graph's left end, moved right. Where it climbs, the function rises;
// where it drops, it falls; where it stays, it is constant. The interval is the piece of the x axis under that part,
// written 0 < x < 3, and its length is measured on the x axis (the change in y is something else). Right to left would
// swap rising and falling: the app says it as a possibility only ("אולי"), as no study has measured it in Hebrew readers.

type P3 = { s: number; x0: number; x1: number; x2: number; x3: number; y0: number; y1: number; y2: number; q: number };
const func3: DiagModel<P3> = {
  params: (rnd) => G.FUNC3.params(rnd),
  text: (p) => G.func3Text(p),
  fig: (p) => G.func3Fig(p) as FigSpec,
  answer: (p) => G.FUNC3.answer(p),
  bugs: G.FUNC3.bugs,
  solution: (p) => G.func3Solution(p),
  hint: (p) => G.func3Hint(p),
};
type P3T = { s: number; cols: number; k: number; temps: number[]; hours: number[]; q: number };
const func3T: DiagModel<P3T> = {
  params: (rnd) => G.FUNC3T.params(rnd),
  text: (p) => G.func3TText(p),
  fig: (p) => G.func3TFig(p) as FigSpec,
  answer: (p) => G.FUNC3T.answer(p),
  bugs: G.FUNC3T.bugs,
  solution: (p) => G.func3TSolution(p),
  hint: () => G.func3THint(),
  unit: 'שעות',
};

const X9: GraphAxis = { max: 9, step: 1, label: 'x' };
const Y10: GraphAxis = { max: 10, step: 1, label: 'y' };
/** The graph G of the stair: up from (0, 2) to the peak (3, 8), down to (7, 4), flat to 9. */
const GPTS: Pt[] = [[0, 2], [3, 8], [7, 4], [9, 4]];
const gGraph = (extra: Record<string, unknown> = {}) => sgraph(X9, Y10, GPTS, extra);
/** The graph T of solving together: up from (1, 3) to (4, 9), down to (6, 5), flat to 9. */
const tGraph = sgraph(X9, Y10, [[1, 3], [4, 9], [6, 5], [9, 5]]);
/** A bicycle's speed by the minute: speeding up, a steady 20 km/h, slowing to a stop. */
const speed = sgraph({ max: 8, step: 1, label: 'זמן', unit: 'דקות' }, { max: 25, step: 5, label: 'מהירות', unit: 'קמ״ש' }, [[0, 0], [2, 20], [6, 20], [8, 0]]);

/** Between 3 and 7 the function falls, read left to right (discover step 2, and the rtl-read remedy). */
const fallStep = {
  kind: 'predict' as const, text: 'בין $x = 3$ ל־$x = 7$ הפונקציה:', fig: gGraph({ bands: [{ from: 3, to: 7 }] }),
  choices: ['יורדת', 'עולה'], answer: 0,
  why: 'זזים ימינה מ־$3$ ל־$7$, ו־$y$ קטן מ־$8$ ל־$4$: יורדת.',
  wrongWhy: { 1: 'מי שקורא מימין לשמאל רואה עלייה. בגרף קוראים משמאל לימין, כמו שציר $x$ גדל.' },
};
/** Draw up, flat, down (discover step 4, and the rtl-read remedy). */
const shapeStep = {
  kind: 'explore' as const, text: 'ציירו גרף שעולה עד $x = 2$, קבוע עד $x = 4$, ויורד עד $x = 6$.',
  manip: { kind: 'graph', x: { max: 6, step: 1, label: 'x' }, y: { max: 8, step: 1, label: 'y' }, start: [4, 4, 4, 4, 4, 4, 4] } as ManipSpec,
  answer: { mode: 'shape', shape: ['up', 'up', 'flat', 'flat', 'down', 'down'] },
  hint: 'קטע עולה: כל נקודה גבוהה מזו שלפניה. קטע קבוע: באותו גובה.', success: 'עולה, קבועה, יורדת: משמאל לימין.',
};
/** Until which x does it rise? An x, not the peak's height (discover step 5, and the y-not-x remedy). */
const untilStep = {
  kind: 'predict' as const, text: 'עד איזה $x$ הפונקציה עולה?', fig: gGraph(),
  choices: ['$x = 3$', '$y = 8$', '$x = 7$'], answer: 0,
  why: 'התחום נמדד על ציר $x$: הפונקציה עולה כש־$0 < x < 3$. ב־$x = 3$ יש שיא, ושם $y = 8$.',
  wrongWhy: { 1: '$8$ הוא הגובה של השיא, ערך של $y$. השאלה על $x$.', 2: 'ב־$x = 7$ הפונקציה מפסיקה לרדת. היא עולה רק עד $x = 3$.' },
};
/** The interval is written on the x axis (discover step 6, and the y-not-x remedy). */
const intervalRule = {
  kind: 'rule' as const, text: 'תחום עלייה כותבים על ציר $x$: הפונקציה עולה כש־$0 < x < 3$. האורך שלו $3$.', display: '0 < x < 3',
  why: '"הגרף בתחום העלייה" הוא הקו; "תחום העלייה" הוא הקטע על ציר $x$ שמתחתיו.', fig: gGraph({ bands: [{ from: 0, to: 3 }] }),
};
/** A flat part of a speed graph is a steady speed (discover step 8, and the graph-picture remedy). */
const speedStep = {
  kind: 'predict' as const, text: 'הגרף מתאר את המהירות של אופניים. מה קרה בקטע השטוח?', fig: speed,
  choices: ['נסעו במהירות קבועה', 'עמדו', 'נסעו על כביש שטוח'], answer: 0,
  why: '$y$ כאן הוא מהירות: קו שטוח הוא מהירות שלא משתנה. עמידה היא מהירות $0$.',
  wrongWhy: { 1: 'עמידה היא מהירות $0$, קו על ציר $x$. בקטע השטוח המהירות היא $20$ קמ״ש.', 2: 'הגרף אינו ציור של הכביש. $y$ הוא המהירות, וקו שטוח אומר שהיא לא משתנה.' },
};

const stair3: StairContent = {
  skill: 'func:3', topic: 'func', level: 3, title: 'עלייה, ירידה וקבוע',
  objectives: [
    'לזהות בגרף ובטבלה איפה פונקציה עולה, יורדת או קבועה, כשקוראים משמאל לימין.',
    'לכתוב תחום על ציר $x$, למשל $1 < x < 4$, ולמדוד את אורכו.',
    'להבחין בין התחום (על ציר $x$) לבין השינוי ב־$y$.',
  ],
  idea: 'קוראים משמאל לימין, כמו שציר $x$ גדל. אם $y$ גדל, הפונקציה עולה; אם $y$ קטן, יורדת; אם $y$ לא משתנה, קבועה. התחום הוא קטע על ציר $x$.',
  why: [
    '"עולה" מתאר מה קורה ל־$y$ כש־$x$ גדל. ציר $x$ גדל ימינה, ולכן קוראים משמאל לימין, גם כשבעברית קוראים מימין.',
    'התחום הוא אילו ערכים של $x$; את השינוי ב־$y$ רואים על הציר השני.',
  ],
  alt: ['שימו אצבע על הגרף בקצה השמאלי והזיזו אותה ימינה. האצבע עולה? הפונקציה עולה.'],
  discover: [
    { kind: 'say', text: 'קוראים גרף משמאל לימין, כמו שציר $x$ גדל. אם הגרף עולה בזמן שזזים ימינה, הפונקציה עולה.', fig: gGraph({ dirArrow: true, anim: true }) },
    fallStep,
    { kind: 'rule', text: 'הפונקציה עולה בתחום אם כש־$x$ גדל גם $y$ גדל, יורדת אם $y$ קטן, וקבועה אם $y$ לא משתנה.',
      why: 'בודקים תמיד את $y$ כשמתקדמים ימינה על ציר $x$.', fig: gGraph({ bands: [{ from: 0, to: 3 }, { from: 3, to: 7 }, { from: 7, to: 9 }] }) },
    shapeStep,
    untilStep,
    intervalRule,
    { kind: 'predict', text: 'בין אילו ערכים של $x$ הפונקציה קבועה?', fig: { type: 'table', head: ['x', 'y'], rows: [[0, 5], [1, 7], [2, 9], [3, 9], [4, 6]] },
      choices: ['בין $x = 2$ ל־$x = 3$', 'בין $9$ ל־$9$', 'אין תחום כזה'], answer: 0,
      why: 'ב־$x = 2$ וב־$x = 3$ אותו $y$, $9$: שם היא קבועה.',
      wrongWhy: { 1: '$9$ הוא ערך של $y$. את התחום כותבים בערכים של $x$: בין $x = 2$ ל־$x = 3$.', 2: 'ב־$x = 2$ וגם ב־$x = 3$ הערך הוא $9$: שם היא לא משתנה.' } },
    speedStep,
  ],
  examples: [
    { problem: 'באיזה תחום הפונקציה יורדת, ומה אורכו?', fig: sgraph(X9, { max: 12, step: 1, every: 2, label: 'y' }, [[0, 4], [2, 10], [5, 10], [9, 2]]), answer: 4, check: '9-5',
      steps: [
        { action: 'קוראים משמאל לימין.', why: 'עולה עד $x = 2$, קבועה עד $x = 5$, ואז יורדת עד $x = 9$.', result: '5 < x < 9' },
        { action: 'מודדים את התחום על ציר $x$.', why: 'האורך הוא ההפרש בין שני הקצוות שלו.', result: '9 - 5 = 4', calc: { expr: '9-5', value: 4 }, value: '9-5' },
      ] },
    { problem: 'הטבלה מראה את הטמפרטורה ביום אחד. כמה שעות עלתה הטמפרטורה?', fig: { type: 'table', head: ['שעה', 'טמפרטורה (מעלות)'], rows: [[6, 14], [9, 19], [12, 25], [15, 22], [18, 17]] }, answer: 6, check: '12-6',
      steps: [
        { action: 'עוברים בטבלה לפי השעות, מהקטנה לגדולה.', why: 'הטמפרטורה עולה, $14, 19, 25$, ואחר כך יורדת, $22, 17$: היא עולה משעה $6$ עד שעה $12$.', result: '6 < x < 12' },
        { action: 'מחסירים את השעות.', why: 'כמה שעות היא עלתה זה אורך התחום, לא השינוי במעלות.', result: '12 - 6 = 6', calc: { expr: '12-6', value: 6 }, value: '12-6' },
      ] },
  ],
  together: [
    { problem: 'כמה יחידות על ציר $x$ הפונקציה עולה?', fig: tGraph,
      steps: [
        { prompt: 'איפה התחום?', choices: [
          { text: 'מ־$x = 1$ עד $x = 4$, ואורכו $3$', ok: true, feedback: 'נכון: משמאל לימין $y$ גדל מ־$3$ ל־$9$, כש־$x$ עובר מ־$1$ ל־$4$.' },
          { text: 'מ־$y = 3$ עד $y = 9$, ואורכו $6$', ok: false, feedback: 'זה השינוי ב־$y$. התחום נמדד על ציר $x$.' },
          { text: 'מ־$x = 4$ עד $x = 6$, ואורכו $2$', ok: false, feedback: 'שם הגרף יורד: קראו משמאל לימין.' },
        ], hints: ['שימו אצבע בקצה השמאלי של הגרף והזיזו ימינה. איפה הוא עולה?', 'הוא עולה מ־$x = 1$ עד השיא, ב־$x = 4$. את האורך מודדים על ציר $x$.'], done: 'הפונקציה עולה כש־$1 < x < 4$.' },
      ],
      final: { prompt: 'כמה יחידות?', answer: 3, check: '4-1', hints: ['האורך הוא ההפרש בין שני הקצוות על ציר $x$.', 'מ־$1$ עד $4$: $4 - 1$.'] } },
    { problem: 'באותו גרף: כמה יחידות על ציר $x$ הפונקציה יורדת?', fig: tGraph,
      steps: [
        { prompt: 'איפה הפונקציה יורדת?', choices: [
          { text: 'מ־$x = 4$ עד $x = 6$', ok: true, feedback: 'נכון: משמאל לימין $y$ קטן מ־$9$ ל־$5$.' },
          { text: 'מ־$x = 1$ עד $x = 4$', ok: false, feedback: 'שם $y$ גדל מ־$3$ ל־$9$: היא עולה. קוראים משמאל לימין.' },
          { text: 'מ־$x = 6$ עד $x = 9$', ok: false, feedback: 'שם $y$ נשאר $5$: היא קבועה.' },
        ], hints: ['אחרי השיא, איפה האצבע יורדת?', 'מהשיא ב־$x = 4$ הגרף יורד עד $x = 6$, ושם הוא נעשה שטוח.'], done: 'הפונקציה יורדת כש־$4 < x < 6$.' },
      ],
      final: { prompt: 'כמה יחידות?', answer: 2, check: '6-4', hints: ['מודדים על ציר $x$, מ־$4$ עד $6$.', '$6 - 4$.'] } },
  ],
  diag: func3,
  transfer: func3T,
  words: ['עולה', 'יורדת', 'קבועה', 'תחום', 'שיא', 'משמאל לימין'],
  misconceptions: [
    { id: 'rtl-read', title: 'ענו את אורך התחום השני (יורד במקום עולה, או להפך), כמו מי שקורא את הגרף מימין לשמאל',
      cause: 'אולי קראו את הגרף מימין לשמאל, כמו שקוראים עברית. ציר $x$ גדל ימינה.',
      explain: ['"עולה" מתאר מה קורה כש־$x$ גדל. שימו אצבע בקצה השמאלי של הגרף והזיזו ימינה.', 'מימין לשמאל קטע עולה נראה יורד, ולכן מתחלפים התחום העולה והתחום היורד.'],
      remedy: [fallStep, shapeStep] },
    { id: 'y-not-x', title: 'ענו בערך של $y$ (השינוי או הגובה), אבל התחום נמדד על ציר $x$',
      cause: 'השינוי ב־$y$ בולט בציור יותר מהקטע על ציר $x$.',
      explain: ['התחום הוא אילו ערכים של $x$: קטע על ציר $x$, כמו $0 < x < 3$.', 'כמה $y$ השתנה רואים על ציר $y$. זו שאלה אחרת.'],
      remedy: [untilStep, intervalRule] },
    { id: 'graph-picture', title: 'קראו את הגרף כמו ציור של הדרך, ולא כקשר בין שני גדלים',
      cause: 'קו שטוח נראה כמו כביש שטוח או כמו עמידה, בלי לבדוק מה מראה ציר $y$.',
      explain: ['בגרף של מהירות, ציר $y$ הוא המהירות. קו שטוח אומר שהמהירות לא משתנה.', 'עמידה במקום היא מהירות $0$: קו שצמוד לציר $x$.'],
      remedy: [speedStep] },
  ],
};

export const FUNC: StairContent[] = [stair1, stair2, stair3];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/func.js names them all). */
export const CATS_FUNC: Record<string, string> = {};
export { func1, func1T, func2, func2T, func3, func3T };
