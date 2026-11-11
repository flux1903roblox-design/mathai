// Probability (הסתברות), ח׳'s "הסתברות ב" in unit 8.16 (March; curriculum stage 3, DATA-6). Three stairs: equally likely
// outcomes, the complementary event, and a two-stage experiment counted in a table. "הסתברות א – בסיס" (probability as a
// relative frequency) is data:4, met before this unit.
//
// The Ministry's order: symmetry first (a fair die, equal sectors, identical tickets), then the complement (everything
// that can happen except the event, 1 minus its probability), then the table of pairs (each stage fair, every cell equally
// likely, (5, 6) and (6, 5) two cells). Trees, the product rule, conditional probability and independence are ט׳ and are
// taught nowhere here. Grade 8 does not name events with letters ("בשלב הזה עדיין לא משתמשים בסימון של מאורע באותיות"):
// no text, display or step writes P(A) or "P =", only "ההסתברות של …" in words. The three documented errors (the
// equiprobability bias, the outcome approach, order ignored in pairs) are named and shown wrong at their stair.
// The diagnostic models are the spec's (content/prob.js PROB1 to PROB3T, ported unchanged). The Ministry's items (the
// raffle of 72, the sticker die, the rain table, the 28 pens, "30% rain") are retold; the sentences are the app's own.
// Every number written here is checked by web/scripts/verify/facts-stage3.mjs, and the maths of every step by
// learn/content.test.ts. No teaching text quotes a seeded number: the runs of discover 5 (prob:1) and 6 (prob:3) are
// seeded so that their screenshots hold, and the texts say only what holds for any long run.
import type { DiagModel, FigSpec, StairContent, ManipSpec, DataFig, FractionFig } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/prob.js';

// ---------------------------------------------------------------- figures

const table = (head: string[], rows: (string | number)[][]): FigSpec => ({ type: 'table', head, rows });
const pie = (cats: string[], values: number[], extra: { hide?: number; tones?: number[]; pct?: boolean } = {}): FigSpec => ({ type: 'chart', mode: 'pie', cats, values, ...extra } satisfies DataFig);
const bar = (cats: string[], values: number[], extra: { step?: number; max?: number; every?: number; unit?: string; labels?: boolean } = {}): FigSpec => ({ type: 'chart', mode: 'bar', cats, values, ...extra } satisfies DataFig);
const fbar = (den: number, shaded: number): FigSpec => ({ type: 'fbar', den, shaded } satisfies FractionFig);
/** One die's faces in a row, the given faces marked. */
const dieRow = (marked: number[] = []): FigSpec => G.dieRow(marked) as FigSpec;
/** The 36 cells of two dice (each the sum), the given [first, second] cells marked. */
const dice = (marked: [number, number][] = []): FigSpec => G.diceTable(marked) as FigSpec;
const sumCells = (...sums: number[]): [number, number][] => G.sumCells(sums) as [number, number][];
/** A die thrown again and again (the simulate object), watching one face. */
const throwDie = (watch: number, extra: Record<string, unknown> = {}): ManipSpec => ({ kind: 'simulate', device: 'die', watch, guided: true, ...extra } as ManipSpec);
const throwTwo = (watch: number, extra: Record<string, unknown> = {}): ManipSpec => ({ kind: 'simulate', device: 'dice2', watch, guided: true, ...extra } as ManipSpec);
const coinFlip = (extra: Record<string, unknown> = {}): ManipSpec => ({ kind: 'simulate', device: 'coin', watch: 0, guided: true, ...extra } as ManipSpec);
/** The rain table (the Ministry's): Arad 0.05, Jerusalem 0.5, Haifa 0.9, Tel Aviv 0. */
const RAIN = table(['עיר', 'ההסתברות לגשם'], [['ערד', '0.05'], ['ירושלים', '0.5'], ['חיפה', '0.9'], ['תל אביב', '0']]);
/** The sticker die (the Ministry's; the critique's counts): 1000 throws, faces 1 to 6. */
const STICKER = bar(['1', '2', '3', '4', '5', '6'], [255, 168, 165, 170, 162, 80], { step: 50, max: 300, every: 2, unit: 'כמה פעמים יצאה כל פאה, ב־1000 הטלות' });
/** A coin and a die: 12 cells. */
/** A coin and a die: 12 cells, each a dot (six columns of pairs do not fit a 320 px phone). */
const COIN_DIE: FigSpec = { type: 'outcomes', rows: ['עץ', 'פלי'], cols: ['1', '2', '3', '4', '5', '6'], rowHead: 'מטבע', colHead: 'קובייה', dots: true, label: 'של מטבע וקובייה' } satisfies DataFig;
/** The same, (עץ, 5) and (עץ, 6) marked. */
const COIN_DIE_HEADS56: FigSpec = { ...(COIN_DIE as DataFig), marked: [[0, 4], [0, 5]] } as FigSpec;

// ================================================================ stair 1: equally likely outcomes

type P1 = { n: number; e: string; t: number | null; k: number };
const prob1: DiagModel<P1> = {
  params: (rnd) => G.PROB1.params(rnd),
  text: (p) => G.prob1Text(p),
  fig: (p) => G.prob1Fig(p) as FigSpec,
  answer: (p) => G.PROB1.answer(p),
  bugs: G.PROB1.bugs,
  solution: (p) => G.prob1Solution(p),
  hint: () => G.prob1Hint(),
  precise: true,
};
type P1T = { N: number; a: number; b: number; w: number };
const prob1T: DiagModel<P1T> = {
  params: (rnd) => G.PROB1T.params(rnd),
  text: (p) => G.prob1TText(p),
  fig: (p) => G.raffleFig(p) as FigSpec,
  answer: (p) => G.PROB1T.answer(p),
  bugs: G.PROB1T.bugs,
  solution: (p) => G.prob1TSolution(p),
  hint: (p) => G.prob1THint(p),
  precise: true,
};

const FOUR = { kind: 'predict' as const, text: 'מה ההסתברות לקבל $4$?', fig: dieRow(),
  choices: ['$\\frac{1}{6}$', '$\\frac{1}{2}$', '$\\frac{4}{6}$'], answer: 0,
  why: 'פאה אחת מתוך $6$.',
  wrongWhy: { 1: '"יוצא או לא יוצא" הן שתי אפשרויות, אבל הן לא שוות סיכוי.', 2: '$4$ הוא המספר שעל הפאה, לא מספר הפאות.' } };
const EVEN = { kind: 'predict' as const, text: 'מה ההסתברות לקבל מספר זוגי?', fig: dieRow([2, 4, 6]),
  choices: ['$\\frac{3}{6}$', '$\\frac{1}{6}$', '$3$'], answer: 0,
  why: 'שלוש פאות מתאימות מתוך שש.',
  wrongWhy: { 1: '$\\frac{1}{6}$ היא פאה אחת. "זוגי" הוא שלוש פאות.', 2: '$3$ הוא מספר הפאות המתאימות. ההסתברות היא החלק שלהן מכל השש.' } };
const RAFFLE = { kind: 'predict' as const, text: 'בהגרלה $72$ כרטיסים. זוכים הכרטיסים $1$ עד $9$ ו־$46$ עד $72$. מה ההסתברות לזכות?',
  fig: G.raffleFig({ N: 72, a: 9, b: 46 }) as FigSpec,
  choices: ['$\\frac{36}{72}$', '$\\frac{35}{72}$', '$36$'], answer: 0,
  why: '$9$ כרטיסים, ועוד $72 - 46 + 1 = 27$: יחד $36$.',
  wrongWhy: { 1: 'מ־$46$ עד $72$ יש $27$ מספרים, לא $26$: גם $46$ בפנים.', 2: '$36$ הוא מספר הכרטיסים הזוכים. ההסתברות היא החלק שלהם מ־$72$.' } };
const STICKER_PREDICT = { kind: 'predict' as const, text: 'על הפאה של $6$ הדביקו מדבקה כבדה, והטילו את הקובייה $1000$ פעמים. ההסתברות לקבל $6$ היא עדיין $\\frac{1}{6}$?', fig: STICKER,
  choices: ['לא בטוח: אין סימטריה, וצריך לנסות הרבה פעמים', 'כן, יש $6$ פאות'], answer: 0,
  why: '$\\frac{1}{n}$ נכון רק כשאין סיבה שתוצאה אחת תצא יותר. המדבקה מושכת את ה־$6$ למטה, ולכן יוצא פחות $6$ ויותר $1$, שנמצא מולו.' };

const stair1: StairContent = {
  skill: 'prob:1', topic: 'prob', level: 1, title: 'תוצאות שוות סיכוי',
  objectives: [
    'כשאף תוצאה לא מועדפת (קובייה הוגנת, גזרות שוות, כרטיסים זהים), לכל אחת מ־$n$ התוצאות הסתברות $\\frac{1}{n}$, ולמאורע של $k$ מהן $\\frac{k}{n}$.',
    'לספור נכון את התוצאות המתאימות.',
    'לזהות מתי אין סימטריה, ואז להעריך לפי הרבה ניסויים.',
  ],
  idea: 'כשכל התוצאות שוות סיכוי, ההסתברות היא מספר התוצאות המתאימות חלקי מספר כל התוצאות.',
  why: ['בקובייה הוגנת אין סיבה ש־$4$ ייצא יותר מ־$2$: לכל פאה $\\frac{1}{6}$. "מספר זוגי" הוא שלוש פאות: $\\frac{3}{6}$.'],
  alt: ['סביבון: ארבע אותיות, נ, ג, ה, פ. אם הוא הוגן, לכל אות רבע.'],
  discover: [
    { kind: 'say', text: 'קובייה הוגנת: לכל פאה אותו סיכוי. יש $6$ תוצאות.', fig: dieRow() },
    FOUR,
    EVEN,
    { kind: 'rule', text: 'כשיש $n$ תוצאות שוות סיכוי, לכל אחת הסתברות $\\frac{1}{n}$, ולמאורע של $k$ מהן $\\frac{k}{n}$.', display: '\\frac{3}{6}',
      why: 'השכיחות היחסית בהרבה הטלות מתקרבת לחלק הזה.', fig: dieRow([2, 4, 6]) },
    { kind: 'explore', text: 'הטילו $10$ פעמים, ואז עוד $100$ ועוד $1000$. כמה קרוב ל־$\\frac{1}{6}$?',
      manip: throwDie(6, { seed: 20261111 }), answer: { mode: 'trials', atLeast: 1000 },
      hint: 'אחרי $10$ הטלות נפתח הכפתור של $100$, ואחריו של $1000$.',
      success: 'ככל שמטילים יותר, השכיחות היחסית של כל פאה מתקרבת ל־$\\frac{1}{6}$. גם אחרי $1000$ הטלות היא לא בדיוק $\\frac{1}{6}$, אבל קרובה.' },
    RAFFLE,
    STICKER_PREDICT,
    { kind: 'rule', text: 'הסתברות $0$: לא יכול לקרות. $1$: ודאי. $\\frac{1}{2}$: סיכוי שווה לקרות ולא לקרות. בלי סימטריה מעריכים לפי שכיחות יחסית בהרבה ניסויים.',
      why: 'המספר אומר עד כמה סביר, בין "אף פעם" ל"תמיד".',
      fig: { type: 'numline', from: 0, to: 1, step: 0.5, marks: [{ x: 0, label: 'אף פעם' }, { x: 0.5, label: 'סיכוי שווה' }, { x: 1, label: 'תמיד' }] } satisfies FractionFig },
  ],
  examples: [
    { problem: 'כרטיסים ממוספרים $1$ עד $20$. מה ההסתברות להוציא כפולה של $3$?', answer: 0.3, check: '6/20',
      steps: [
        { action: 'כל התוצאות: $20$.', why: 'עשרים כרטיסים זהים: כולם שווי סיכוי.', result: '20' },
        { action: 'כפולות של $3$: $3, 6, 9, 12, 15, 18$.', why: 'סופרים את המתאימות.', result: '6', calc: { expr: '6', value: 6 } },
        { action: 'מתאימות חלקי כולן.', why: 'כל התוצאות שוות סיכוי.', result: '\\frac{6}{20} = 0.3', value: '6/20' },
      ] },
    { problem: 'גלגל של $8$ גזרות שוות, ממוספרות $1$ עד $8$. מה ההסתברות למספר גדול מ־$5$?', answer: 0.375, check: '3/8',
      steps: [
        { action: 'גדולים מ־$5$: $6, 7, 8$.', why: '$5$ עצמו לא גדול מ־$5$.', result: '3', calc: { expr: '8 - 5', value: 3 } },
        { action: 'שלוש מתוך שמונה.', why: 'שמונה גזרות שוות.', result: '\\frac{3}{8} = 0.375', value: '3/8' },
      ] },
    { problem: 'סביבון הוגן: נ, ג, ה, פ. מה ההסתברות ל־ג או ל־ה?', answer: 0.5, check: '2/4',
      steps: [
        { action: 'ארבע אותיות שוות סיכוי.', why: 'הסביבון הוגן.', result: '4' },
        { action: 'מתאימות שתיים: ג ו־ה.', why: '"ג או ה": כל אחת מהן מתאימה.', result: '\\frac{2}{4} = 0.5', value: '2/4' },
      ] },
  ],
  together: [
    { problem: 'כרטיסים $1$ עד $10$. מה ההסתברות למספר גדול מ־$7$?',
      steps: [
        { prompt: 'אילו מספרים מתאימים?', choices: [
          { text: '$8, 9, 10$', ok: true, feedback: 'נכון: שלושה מספרים.' },
          { text: '$7, 8, 9, 10$', ok: false, feedback: '"גדול מ־$7$" לא כולל את $7$.' },
          { text: 'רק $10$', ok: false, feedback: 'גם $8$ ו־$9$ גדולים מ־$7$.' },
        ], hints: ['מה בא אחרי $7$?', '$8$, $9$ ו־$10$.'], done: 'שלושה מספרים מתאימים מתוך עשרה.' },
      ],
      final: { prompt: 'מה ההסתברות?', answer: 0.3, check: '3/10', precise: true, hints: ['מתאימים חלקי כולם.', '$\\frac{3}{10}$.'] } },
    { problem: '$100$ כרטיסים; זוכים $1$ עד $5$ ו־$91$ עד $100$. מה ההסתברות לזכות?', fig: G.raffleFig({ N: 100, a: 5, b: 91 }) as FigSpec,
      steps: [
        { prompt: 'כמה מספרים מ־$91$ עד $100$?', choices: [
          { text: '$10$', ok: true, feedback: 'נכון: גם $91$ וגם $100$ בפנים.' },
          { text: '$9$', ok: false, feedback: '$100 - 91 = 9$, ועוד $91$ עצמו: $10$.' },
          { text: '$91$', ok: false, feedback: '$91$ הוא המספר שבו הטווח מתחיל, לא כמה מספרים יש בו.' },
        ], hints: ['ספרו גם את הקצוות.', '$100 - 91 + 1$.'], done: '$10$ כרטיסים, ועוד $5$: יחד $15$.' },
      ],
      final: { prompt: 'מה ההסתברות לזכות?', answer: 0.15, check: '15/100', precise: true, hints: ['$5 + 10 = 15$ כרטיסים זוכים.', '$\\frac{15}{100}$.'] } },
  ],
  diag: prob1,
  transfer: prob1T,
  words: ['תוצאה', 'מאורע', 'שוות סיכוי', 'הוגן', 'סימטריה'],
  misconceptions: [
    { id: 'count-not-prob', title: 'כתבו את מספר התוצאות המתאימות במקום ההסתברות',
      cause: 'סופרים נכון, ושוכחים לחלק במספר כל התוצאות.',
      explain: ['ההסתברות היא חלק: המתאימות חלקי כולן.', 'שלוש פאות זוגיות מתוך שש: $\\frac{3}{6}$, לא $3$.'],
      remedy: [EVEN] },
    { id: 'one-over-n', title: 'כתבו את ההסתברות של תוצאה אחת במקום של כל התוצאות המתאימות',
      cause: '$\\frac{1}{n}$ היא תוצאה אחת. מאורע יכול לכלול כמה.',
      explain: ['כשכמה תוצאות מתאימות, ההסתברות היא כמה מהן חלקי כולן.', '"זוגי" בקובייה: $2$, $4$ ו־$6$, כלומר $\\frac{3}{6}$.'],
      remedy: [
        { kind: 'explore', text: 'הטילו קובייה הרבה פעמים, ושימו לב כמה פעמים יוצא $2$.', manip: throwDie(2), answer: { mode: 'trials', atLeast: 1000 },
          hint: 'אחרי $10$ הטלות נפתח הכפתור של $100$, ואחריו של $1000$.', success: 'פאה אחת יוצאת בערך שישית מהפעמים. שלוש פאות זוגיות יחד: בערך חצי.' },
        EVEN,
      ] },
    { id: 'equiprob-event', title: 'חשבו שמה שקורה או לא קורה הוא חצי',
      cause: '"קורה או לא קורה" נשמעות כמו שתי אפשרויות שוות. אבל בקובייה "$4$" היא פאה אחת, ו"לא $4$" הן חמש.',
      explain: ['סופרים תוצאות שוות סיכוי, לא "כן" ו"לא".', 'לקבל $4$: פאה אחת מתוך שש, $\\frac{1}{6}$.'],
      remedy: [FOUR] },
    { id: 'fencepost', title: 'ספרו את המספרים מ־$a$ עד $b$ כאילו יש $b - a$ ולא $b - a + 1$',
      cause: 'ההפרש $b - a$ סופר את הקפיצות, לא את המספרים: אחד מהקצוות נשאר בחוץ.',
      explain: ['מ־$46$ עד $72$: $72 - 46 = 26$ קפיצות, אבל $27$ מספרים.', 'בדיקה קטנה: מ־$1$ עד $3$ יש שלושה מספרים, ו־$3 - 1 = 2$.'],
      remedy: [RAFFLE] },
    { id: 'no-symmetry', title: 'הניחו סיכוי שווה גם כשהקובייה או המטבע לא סימטריים',
      cause: 'סופרים פאות ושוכחים לשאול אם כולן שוות סיכוי.',
      explain: ['$\\frac{1}{n}$ נכון רק כשאין סיבה שתוצאה אחת תצא יותר.', 'בלי סימטריה מעריכים לפי השכיחות היחסית בהרבה ניסויים.'],
      remedy: [STICKER_PREDICT] },
  ],
};

// ================================================================ stair 2: the complementary event

type P2 = { p: number[]; g: number; x: number };
const prob2: DiagModel<P2> = {
  params: (rnd) => G.PROB2.params(rnd),
  text: (p) => G.prob2Text(p),
  fig: (p) => G.prob2Fig(p) as FigSpec,
  answer: (p) => G.PROB2.answer(p),
  bugs: G.PROB2.bugs,
  solution: (p) => G.prob2Solution(p),
  hint: () => G.prob2Hint(),
  precise: true,
};
type P2T = { N: number; a: number; b: number; m: number; blue: number; pink: number };
const prob2T: DiagModel<P2T> = {
  params: (rnd) => G.PROB2T.params(rnd),
  text: (p) => G.prob2TText(p),
  answer: (p) => G.PROB2T.answer(p),
  bugs: G.PROB2T.bugs,
  solution: (p) => G.prob2TSolution(p),
  hint: () => G.prob2THint(),
  precise: true,
};

const HAIFA = { kind: 'predict' as const, text: 'מה ההסתברות שלא ירד גשם בחיפה?', fig: RAIN,
  choices: ['$0.1$', '$0.9$', '$99.1$'], answer: 0,
  why: '$1 - 0.9 = 0.1$.',
  wrongWhy: { 1: '$0.9$ הוא הסיכוי לגשם. ליום יבש נשאר מה שחסר עד $1$.', 2: 'ההסתברות היא מ־$0$ עד $1$, לא עד $100$.' } };
const NOT_RED = { kind: 'explore' as const, text: 'בגלגל $12$ חלקים שווים, ו־$3$ מהם אדומים. צבעו את "לא אדום".',
  manip: { kind: 'fbar', start: { den: 12, shaded: 0 }, lockDen: true } as ManipSpec, answer: { mode: 'value', value: 0.75 },
  hint: 'כמה חלקים אינם אדומים?', success: '$9$ מתוך $12$: $\\frac{9}{12} = 1 - \\frac{3}{12}$.' };
const GREEN = { kind: 'predict' as const, text: 'בגלגל שלושה צבעים: ההסתברות לאדום $0.3$, לכחול $0.25$, והשאר ירוק. מה ההסתברות לירוק?',
  fig: pie(['אדום', 'כחול', 'ירוק'], [0.3, 0.25, 0.45], { hide: 2, tones: [3, 0, 2] }),
  choices: ['$0.45$', '$0.55$', '$0.7$'], answer: 0,
  why: '$1 - 0.3 - 0.25 = 0.45$.',
  wrongWhy: { 1: '$0.55$ הוא אדום וכחול יחד. הירוק הוא מה שנשאר.', 2: '$0.7$: הורדתם רק את האדום. גם הכחול אינו ירוק.' } };
const AT_LEAST_2 = { kind: 'predict' as const, text: 'מה ההסתברות לקבל לפחות $2$ בקובייה?', fig: dieRow([2, 3, 4, 5, 6]),
  choices: ['$\\frac{5}{6}$', '$\\frac{1}{6}$', '$\\frac{4}{6}$'], answer: 0,
  why: '"לפחות $2$" הוא המשלים של "$1$": $1 - \\frac{1}{6} = \\frac{5}{6}$.',
  wrongWhy: { 1: '$\\frac{1}{6}$ היא ההסתברות של המשלים, "$1$". נשאר להחסיר אותה מ־$1$.', 2: 'מ־$2$ עד $6$ יש חמש פאות, לא ארבע: גם $2$ בפנים.' } };
const DANNY = { kind: 'predict' as const, text: 'בתחזית: $50\\%$ סיכוי לגשם מחר. מה זה אומר?', fig: pie(['גשם', 'בלי גשם'], [50, 50], { tones: [0, 4], pct: true }),
  choices: ['בימים כאלה יורד גשם בערך בחצי מהם', 'חצי מהיום יירד גשם'], answer: 0,
  why: 'ההסתברות אומרת כמה סביר שיירד גשם, לא כמה זמן. מתוך הרבה ימים עם תחזית כזאת, בערך בחצי מהם יורד גשם.' };

const stair2: StairContent = {
  skill: 'prob:2', topic: 'prob', level: 2, title: 'מאורע משלים',
  objectives: [
    'לדעת שהמאורע המשלים הוא כל מה שיכול לקרות חוץ מהמאורע, וההסתברות שלו היא $1$ פחות ההסתברות של המאורע.',
    'לחבר הסתברויות של תוצאות שאינן חופפות, ולדעת שכולן יחד $1$.',
    'להשתמש במשלים כשקל יותר לחשב "לא".',
  ],
  idea: 'המאורע ומשלימו מכסים את כל מה שיכול לקרות, ולכן ההסתברויות שלהם יחד הן $1$.',
  why: ['בחיפה $0.9$ לגשם: בעשרה ימים כאלה יורד גשם בערך בתשעה, ובאחד לא. $1 - 0.9 = 0.1$.'],
  alt: ['פס הסתברויות: פס באורך $1$; צובעים את המאורע, והשאר הוא המשלים.'],
  discover: [
    { kind: 'say', text: 'המאורע המשלים ל"ירד גשם" הוא "לא ירד גשם": כל מה שיכול לקרות חוץ ממנו.', fig: { ...RAIN, anim: true } as FigSpec },
    HAIFA,
    { kind: 'rule', text: 'ההסתברות של מאורע ועוד ההסתברות של המשלים שלו הן $1$. לכן ההסתברות של המשלים היא $1$ פחות ההסתברות של המאורע.',
      display: '0.9 + 0.1 = 1', why: 'יחד הם כל מה שיכול לקרות.', fig: fbar(10, 9) },
    { kind: 'predict', text: 'מה ההסתברות לא לקבל $6$ בקובייה?', fig: dieRow([6]),
      choices: ['$\\frac{5}{6}$', '$\\frac{1}{6}$', '$5$'], answer: 0,
      why: 'חמש פאות לא מתאימות ל־$6$.',
      wrongWhy: { 1: '$\\frac{1}{6}$ היא ההסתברות לקבל $6$. "לא $6$" הוא כל השאר.', 2: '$5$ הוא מספר הפאות. ההסתברות היא חמש מתוך שש.' } },
    NOT_RED,
    GREEN,
    { kind: 'rule', text: 'תוצאות שאינן חופפות מחברים: ההסתברות לאדום או לכחול היא $0.3 + 0.25 = 0.55$. כל התוצאות יחד: $1$.',
      why: 'אין תוצאה שנספרת פעמיים.', fig: pie(['אדום', 'כחול', 'ירוק'], [0.3, 0.25, 0.45], { tones: [3, 0, 2] }) },
    AT_LEAST_2,
  ],
  examples: [
    { problem: 'במגירה $28$ עטים. ההסתברות לעט כחול $\\frac{2}{7}$, ויש פי $2$ עטים ורודים מכחולים. מה ההסתברות לעט שאינו כחול ואינו ורוד?', answer: 1 / 7, check: '4/28',
      steps: [
        { action: 'כחולים.', why: '$\\frac{2}{7}$ מ־$28$ עטים.', result: '28 \\cdot \\frac{2}{7} = 8', calc: { expr: '28*2/7', value: 8 } },
        { action: 'ורודים.', why: 'פי $2$ מהכחולים.', result: '2 \\cdot 8 = 16', calc: { expr: '2*8', value: 16 } },
        { action: 'האחרים.', why: 'מה שנשאר מ־$28$.', result: '28 - 8 - 16 = 4', calc: { expr: '28 - 24', value: 4 } },
        { action: 'האחרים חלקי כל העטים.', why: 'כל עט שווה סיכוי.', result: '\\frac{4}{28} = \\frac{1}{7}', value: '4/28' },
      ] },
    { problem: '$30\\%$ סיכוי לגשם. מה הסיכוי שלא ירד גשם?', answer: 70, check: '100 - 30',
      steps: [
        { action: 'באחוזים, הכול הוא $100\\%$.', why: 'גשם ובלי גשם יחד הם כל מה שיכול לקרות.', result: '100\\%' },
        { action: 'מה שנשאר.', why: 'המשלים של "גשם".', result: '100 - 30 = 70', value: '100 - 30' },
      ] },
  ],
  together: [
    { problem: 'בשקית כדורים אדומים, כחולים וצהובים. ההסתברות להוציא אדום היא $0.35$, וכחול $0.4$. מה ההסתברות לא להוציא כחול?',
      steps: [
        { prompt: 'מה המשלים של "כחול"?', choices: [
          { text: 'אדום או צהוב', ok: true, feedback: 'נכון: כל מה שאינו כחול.' },
          { text: 'אדום', ok: false, feedback: 'גם צהוב הוא "לא כחול".' },
          { text: 'כחול', ok: false, feedback: 'המשלים הוא כל מה שאינו המאורע עצמו.' },
        ], hints: ['אילו צבעים אינם כחולים?', 'גם הצהוב, שהסיכוי שלו לא כתוב.'], done: 'המשלים של "כחול" הוא "אדום או צהוב".' },
      ],
      final: { prompt: 'מה ההסתברות לא להוציא כחול?', answer: 0.6, check: '1 - 0.4', precise: true, hints: ['$1$ פחות ההסתברות לכחול.', '$1 - 0.4$.'] } },
    { problem: 'ההסתברות לנצח במשחק $\\frac{3}{8}$. מה ההסתברות לא לנצח?',
      steps: [
        { prompt: 'ההסתברויות יחד הן:', choices: [
          { text: '$1$', ok: true, feedback: 'נכון: לנצח ולא לנצח הם כל מה שיכול לקרות.' },
          { text: '$100$', ok: false, feedback: 'כאן ההסתברות כתובה כשבר, והשלם הוא $1$.' },
          { text: '$8$', ok: false, feedback: '$8$ הוא המכנה. השלם הוא $\\frac{8}{8} = 1$.' },
        ], hints: ['איך כתובה ההסתברות: באחוזים או כשבר?', 'כשבר: השלם הוא $1$.'], done: 'יחד $1$, כלומר $\\frac{8}{8}$.' },
      ],
      final: { prompt: 'מה ההסתברות לא לנצח?', answer: 5 / 8, check: '1 - 3/8', precise: true, hints: ['$1 - \\frac{3}{8}$.', '$\\frac{8}{8} - \\frac{3}{8}$.'] } },
  ],
  diag: prob2,
  transfer: prob2T,
  words: ['מאורע משלים', 'תוצאות שאינן חופפות', 'לפחות', 'לכל היותר'],
  misconceptions: [
    { id: 'same-prob', title: 'נתנו למשלים אותה הסתברות',
      cause: '"לא" נשמע כמו אותו דבר הפוך. המשלים לוקח את מה שנשאר עד $1$.',
      explain: ['המאורע ומשלימו יחד הם $1$.', 'בחיפה $0.9$ לגשם, ולכן $1 - 0.9 = 0.1$ ליום יבש.'],
      remedy: [HAIFA, NOT_RED] },
    { id: 'hundred-minus', title: 'השלימו ל־$100$ הסתברות שכתובה כמספר בין $0$ ל־$1$',
      cause: 'אחוזים משלימים ל־$100$; הסתברות שכתובה כמספר משלימה ל־$1$.',
      explain: ['$0.9$ ו־$90\\%$ הם אותה הסתברות, בשתי כתיבות.', 'כשהיא כתובה כמספר, השלם הוא $1$: $1 - 0.9 = 0.1$.'],
      remedy: [HAIFA] },
    { id: 'others-given', title: 'חיברו רק את ההסתברויות שכתובות, ושכחו תוצאה שלא כתובה',
      cause: 'סופרים רק את מה שכתוב, ושוכחים תוצאה שנשארה.',
      explain: ['המשלים הוא כל מה שאינו המאורע, גם מה שלא כתוב.', 'אם הצהוב לא כתוב, הוא עדיין חלק מ"לא כחול".'],
      remedy: [GREEN] },
    { id: 'one-part', title: 'הורידו רק חלק מהתוצאות שאינן מתאימות',
      cause: 'סופרים רק את מה שכתוב, ושוכחים תוצאה שנשארה.',
      explain: ['"לא כחול ולא ורוד": מורידים את שניהם.', 'מ־$28$ עטים יורדים $8$ כחולים ו־$16$ ורודים.'],
      remedy: [GREEN] },
    { id: 'count-not-prob', title: 'כתבו את מספר התוצאות המתאימות במקום ההסתברות',
      cause: 'סופרים נכון, ושוכחים לחלק במספר כל התוצאות.',
      explain: ['ההסתברות היא חלק מהכול, מספר בין $0$ ל־$1$.', '$4$ עטים מתוך $28$: $\\frac{4}{28} = \\frac{1}{7}$, לא $4$.'],
      remedy: [
        { kind: 'predict', text: 'במגירה $28$ עטים, ו־$4$ מהם אינם כחולים ואינם ורודים. מה ההסתברות להוציא אחד מהם?', fig: fbar(7, 1),
          choices: ['$\\frac{4}{28}$', '$4$'], answer: 0, why: 'ארבעה מתוך עשרים ושמונה: $\\frac{4}{28} = \\frac{1}{7}$.', wrongWhy: { 1: '$4$ הוא מספר העטים, לא החלק שלהם.' } },
      ] },
    { id: 'gambler', title: 'חשבו שאחרי הרבה פעמים אותה תוצאה, הסיכוי לשנייה גדל',
      cause: 'נדמה שהמטבע "מאזן" את עצמו. אבל למטבע אין זיכרון.',
      explain: ['בכל הטלה של מטבע הוגן הסיכוי לעץ ולפלי שווה, מה שלא יצא קודם.', 'רק בהרבה הטלות השכיחות היחסית מתקרבת לחצי.'],
      remedy: [
        { kind: 'explore', text: 'הטילו מטבע הרבה פעמים, וראו איך השכיחות היחסית של עץ מתנהגת.', manip: coinFlip(), answer: { mode: 'trials', atLeast: 1000 },
          hint: 'אחרי $10$ הטלות נפתח הכפתור של $100$, ואחריו של $1000$.', success: 'גם אחרי כמה "עץ" ברצף, ההטלות הבאות לא מתקנות: רק הרבה הטלות יחד מתקרבות לחצי.' },
      ] },
    { id: 'outcome-approach', title: 'קראו הסתברות כתחזית בטוחה או כחלק מהזמן',
      cause: 'מספר כמו "$50\\%$" נשמע כמו חלק מהיום, או כמו הבטחה.',
      explain: ['הסתברות אומרת כמה סביר שמשהו יקרה, לא כמה זמן הוא יימשך.', '$50\\%$ גשם: מתוך הרבה ימים כאלה, בערך בחצי מהם יורד גשם.'],
      remedy: [DANNY] },
    { id: 'complement-only', title: 'חישבו את ההסתברות של המשלים, ולא החסירו אותה מ־$1$',
      cause: 'קל לחשב את המשלים, ואז שוכחים את הצעד האחרון: $1$ פחות.',
      explain: ['המשלים הוא דרך קצרה, לא התשובה.', '"לפחות $2$": המשלים "$1$" הוא $\\frac{1}{6}$, ולכן $1 - \\frac{1}{6} = \\frac{5}{6}$.'],
      remedy: [AT_LEAST_2] },
  ],
};

// ================================================================ stair 3: a two-stage experiment in a table

type P3 = { e: string; t: number; sums: number[] };
const prob3: DiagModel<P3> = {
  params: (rnd) => G.PROB3.params(rnd),
  text: (p) => G.prob3Text(p),
  fig: () => G.prob3Fig() as FigSpec,
  answer: (p) => G.PROB3.answer(p),
  bugs: G.PROB3.bugs,
  solution: (p) => G.prob3Solution(p),
  hint: () => G.prob3Hint(),
  form: 'frac',
};
type P3T = { kind: string; n1: number; n2: number; k1: number; k2: number };
const prob3T: DiagModel<P3T> = {
  params: (rnd) => G.PROB3T.params(rnd),
  text: (p) => G.prob3TText(p),
  fig: (p) => G.prob3TFig(p) as FigSpec,
  answer: (p) => G.PROB3T.answer(p),
  bugs: G.PROB3T.bugs,
  solution: (p) => G.prob3TSolution(p),
  hint: () => G.prob3THint(),
  form: 'frac',
};

const TWELVE = { kind: 'predict' as const, text: 'יש $11$ סכומים, מ־$2$ עד $12$. ההסתברות לסכום $12$ היא $\\frac{1}{11}$?', fig: dice(sumCells(12)),
  choices: ['לא: תא אחד מתוך $36$, כלומר $\\frac{1}{36}$', 'כן'], answer: 0,
  why: 'הסכומים אינם שווי סיכוי; התאים כן.' };
const ORDER = { kind: 'predict' as const, text: '$(5, 6)$ ו־$(6, 5)$: תוצאה אחת או שתיים?', fig: dice([[5, 6], [6, 5]]),
  choices: ['שתיים', 'אחת'], answer: 0,
  why: 'בקובייה אדומה וכחולה רואים: $5$ באדומה ו־$6$ בכחולה, או להפך.' };
const ELEVEN = { kind: 'predict' as const, text: 'מה ההסתברות לסכום $11$?', fig: dice(sumCells(11)),
  choices: ['$\\frac{2}{36}$', '$\\frac{1}{36}$', '$\\frac{1}{11}$'], answer: 0,
  why: 'שני תאים: $(5, 6)$ ו־$(6, 5)$.',
  wrongWhy: { 1: 'ספרתם את $(5, 6)$ ואת $(6, 5)$ כתא אחד. הם שניים.', 2: '$\\frac{1}{11}$ מניח שכל אחד מ־$11$ הסכומים שווה סיכוי. סופרים תאים, לא סכומים.' } };
const ROLL_TWO = { kind: 'explore' as const, text: 'הטילו $1000$ פעמים. מה יוצא הכי הרבה?', manip: throwTwo(7, { seed: 20261111 }), answer: { mode: 'trials', atLeast: 1000 },
  hint: 'אחרי $10$ הטלות נפתח הכפתור של $100$, ואחריו של $1000$.',
  success: '$7$ יצא בערך שישית מהפעמים, ו־$12$ בערך פעם ב־$36$.' };
const COIN_DIE_PREDICT = { kind: 'predict' as const, text: 'מטילים מטבע וקובייה. מה ההסתברות ל"עץ" ולמספר גדול מ־$4$?', fig: COIN_DIE,
  choices: ['$\\frac{2}{12}$', '$\\frac{1}{2} + \\frac{2}{6}$'], answer: 0,
  why: 'בטבלה $2 \\cdot 6 = 12$ תאים, ומתאימים שניים: (עץ, $5$) ו־(עץ, $6$).',
  wrongWhy: { 1: 'חיברתם את ההסתברויות של שני השלבים. "וגם" הוא תאים ששני התנאים מתקיימים בהם.' } };
const DOUBLE_ONE = { kind: 'predict' as const, text: 'מה יותר סביר: דאבל $1$, או $1$ ו־$2$ בכל סדר?', fig: dice([[1, 1], [1, 2], [2, 1]]),
  choices: ['$1$ ו־$2$: שני תאים', 'שווה'], answer: 0,
  why: 'הדאבל הוא תא אחד, $(1, 1)$. "$1$ ו־$2$ בכל סדר" הוא שני תאים: $(1, 2)$ ו־$(2, 1)$.' };
const SAME_CELL = { kind: 'predict' as const, text: 'מטילים קובייה פעמיים. מה יותר סביר: $6$ ואחר כך $6$, או $2$ ואחר כך $5$?', fig: dice([[6, 6], [2, 5]]),
  choices: ['שווה: כל אחת היא תא אחד מתוך $36$', '$2$ ואחר כך $5$', '$6$ ואחר כך $6$'], answer: 0,
  why: '$(6, 6)$ ו־$(2, 5)$ הם שני תאים בטבלה, ולכל תא אותו סיכוי: $\\frac{1}{36}$.',
  wrongWhy: { 1: 'תוצאה "מעורבבת" נראית טבעית יותר, אבל היא תא אחד, כמו $(6, 6)$.', 2: 'גם $(6, 6)$ הוא תא אחד בלבד.' } };

const stair3: StairContent = {
  skill: 'prob:3', topic: 'prob', level: 3, title: 'ניסוי בשני שלבים',
  objectives: [
    'לרשום את כל התוצאות של ניסוי בשני שלבים בטבלה: שורה לכל תוצאה של השלב הראשון ועמודה לכל תוצאה של השני.',
    'לדעת שכשכל שלב הוגן, כל התאים שווי סיכוי, ו־$(5, 6)$ ו־$(6, 5)$ הם שני תאים.',
    'לחשב הסתברות בספירת תאים.',
  ],
  idea: 'בניסוי בשני שלבים כל תוצאה היא זוג. בטבלה כל זוג הוא תא, ואם כל שלב הוגן, כל התאים שווי סיכוי: סופרים תאים.',
  why: [
    'צובעים קובייה אחת אדום ואחת כחול: $5$ באדומה ו־$6$ בכחולה זו תוצאה אחרת מ־$6$ באדומה ו־$5$ בכחולה.',
    'לסכום $7$ יש שישה תאים, ולסכום $12$ אחד: הסכומים לא שווי סיכוי.',
  ],
  alt: ['רשימה מסודרת: $(1, 1), (1, 2), \\ldots, (6, 6)$: שש שורות של שש.'],
  discover: [
    { kind: 'say', text: 'מטילים שתי קוביות. כל תוצאה היא זוג: מה יצא בראשונה ומה בשנייה. בטבלה $36$ תאים, וכולם שווי סיכוי.', fig: dice() },
    { kind: 'predict', text: 'איזה סכום הכי סביר?', fig: dice(),
      choices: ['סכום $7$', 'סכום $12$', 'כולם שווים'], answer: 0,
      why: 'לסכום $7$ שישה תאים, יותר מכל סכום אחר.',
      wrongWhy: { 1: 'לסכום $12$ תא אחד בלבד, $(6, 6)$.', 2: 'התאים שווים, הסכומים לא: לכל סכום מספר אחר של תאים.' } },
    TWELVE,
    { kind: 'rule', text: 'בניסוי בשני שלבים בונים טבלה: שורה לכל תוצאה של השלב הראשון, עמודה לכל תוצאה של השני. כשכל שלב הוגן, כל התאים שווי סיכוי. ההסתברות היא מספר התאים המתאימים חלקי מספר כל התאים.',
      display: '\\frac{6}{36} = \\frac{1}{6}', why: 'כל שורה היא תוצאה של הראשונה, ולכל אחת מהן שש אפשרויות שוות לשנייה.', fig: dice(sumCells(7)) },
    ORDER,
    ROLL_TWO,
    ELEVEN,
    { kind: 'rule', text: 'סופרים תאים: ההסתברות היא מספר התאים המתאימים חלקי מספר כל התאים.', why: 'כך גם במטבע וקובייה: $2 \\cdot 6 = 12$ תאים.', fig: COIN_DIE },
  ],
  examples: [
    { problem: 'שתי קוביות. מה ההסתברות שהסכום יהיה לפחות $10$?', fig: dice(sumCells(10, 11, 12)), answer: 1 / 6, check: '6/36',
      steps: [
        { action: 'סכום $10$: שלושה תאים, $11$: שניים, $12$: אחד.', why: 'סופרים בטבלה את התאים של כל סכום.', result: '3 + 2 + 1 = 6', calc: { expr: '3+2+1', value: 6 } },
        { action: 'מתאימים חלקי כולם.', why: 'כל $36$ התאים שווי סיכוי.', result: '\\frac{6}{36} = \\frac{1}{6}', value: '6/36' },
      ] },
    { problem: 'מטבע וקובייה. מה ההסתברות ל"עץ" ולמספר גדול מ־$4$?', fig: COIN_DIE_HEADS56, answer: 1 / 6, check: '2/12',
      steps: [
        { action: 'תאים: $2 \\cdot 6$.', why: 'שתי שורות למטבע, שש עמודות לקובייה.', result: '2 \\cdot 6 = 12', calc: { expr: '2*6', value: 12 } },
        { action: 'מתאימים: (עץ, $5$), (עץ, $6$).', why: 'בשורה של עץ, העמודות של $5$ ו־$6$.', result: '2', calc: { expr: '2', value: 2 } },
        { action: 'מתאימים חלקי כולם.', why: 'כל התאים שווי סיכוי.', result: '\\frac{2}{12} = \\frac{1}{6}', value: '2/12' },
      ] },
  ],
  together: [
    { problem: 'שתי קוביות. מה ההסתברות לדאבל (אותו מספר בשתיהן)?', fig: dice(),
      steps: [
        { prompt: 'כמה תאים באלכסון?', choices: [
          { text: '$6$', ok: true, feedback: 'נכון: $(1, 1)$ עד $(6, 6)$.' },
          { text: '$1$', ok: false, feedback: '$(6, 6)$ הוא רק דאבל אחד. יש עוד חמישה.' },
          { text: '$11$', ok: false, feedback: '$11$ הוא מספר הסכומים, לא מספר הדאבלים.' },
        ], hints: ['דאבל: אותו מספר בשתי הקוביות.', '$(1, 1)$, $(2, 2)$, ...'], done: 'שישה תאים באלכסון מתוך $36$.' },
      ],
      final: { prompt: 'מה ההסתברות לדאבל?', answer: 1 / 6, check: '6/36', precise: true, hints: ['תאים מתאימים חלקי כל התאים.', '$\\frac{6}{36}$.'] } },
    { problem: 'גלגל בשלוש גזרות שוות (אדום, ירוק, כחול) ומטבע. מה ההסתברות לאדום ולפלי?',
      fig: { type: 'outcomes', rows: ['אדום', 'ירוק', 'כחול'], cols: ['עץ', 'פלי'], rowHead: 'גלגל', colHead: 'מטבע', label: 'של גלגל ומטבע' } satisfies DataFig,
      steps: [
        { prompt: 'כמה תאים בטבלה?', choices: [
          { text: '$6$', ok: true, feedback: 'נכון: $3 \\cdot 2 = 6$.' },
          { text: '$5$', ok: false, feedback: '$3 + 2$ הם השורות והעמודות. התאים: $3 \\cdot 2$.' },
          { text: '$3$', ok: false, feedback: '$3$ הן השורות של הגלגל. לכל שורה שתי עמודות.' },
        ], hints: ['שורה לכל צבע, עמודה לכל צד של המטבע.', '$3$ שורות של $2$.'], done: 'שישה תאים, ומתאים אחד: (אדום, פלי).' },
      ],
      final: { prompt: 'מה ההסתברות לאדום ולפלי?', answer: 1 / 6, check: '1/6', precise: true, hints: ['תא אחד מתוך כמה?', '$\\frac{1}{6}$.'] } },
  ],
  diag: prob3,
  transfer: prob3T,
  words: ['ניסוי בשני שלבים', 'טבלת תוצאות', 'זוג', 'תא', 'דאבל'],
  misconceptions: [
    { id: 'equiprob-sums', title: 'חשבו שכל הסכומים של שתי קוביות שווי סיכוי',
      cause: 'כשמונים את הסכומים, נדמה שלכל אחד סיכוי שווה. סופרים תאים, לא סכומים.',
      explain: ['$11$ הסכומים אינם שווי סיכוי: לכל סכום מספר אחר של תאים.', 'לסכום $7$ שישה תאים, ולסכום $12$ אחד.'],
      remedy: [TWELVE, ROLL_TWO] },
    { id: 'unordered', title: 'ספרו את $(5, 6)$ ואת $(6, 5)$ כתוצאה אחת',
      cause: '$(5, 6)$ ו־$(6, 5)$ נראים אותו דבר כשהקוביות זהות.',
      explain: ['דמיינו קובייה אדומה וקובייה כחולה: $5$ באדומה ו־$6$ בכחולה, או להפך.', 'אלה שני תאים בטבלה, ולכן לסכום $11$ ההסתברות $\\frac{2}{36}$.'],
      remedy: [ORDER, ELEVEN] },
    { id: 'space-21', title: 'מנו $21$ זוגות בלי סדר כאילו הם שווי סיכוי',
      cause: '$21$ זוגות בלי סדר אינם שווי סיכוי: הדאבל הוא תא אחד, וזוג שונה הוא שניים.',
      explain: ['$36$ התאים שווי סיכוי; $21$ הזוגות בלי סדר לא.', 'דאבל $1$ הוא תא אחד; "$1$ ו־$2$ בכל סדר" הוא שני תאים.'],
      remedy: [DOUBLE_ONE] },
    { id: 'add-probs', title: 'חיברו את ההסתברויות של שני השלבים',
      cause: '"וגם" נשמע כמו חיבור. בטבלה רואים שהתאים המתאימים מעטים.',
      explain: ['"עץ וגם מספר גדול מ־$4$" הוא תאים ששני התנאים מתקיימים בהם.', 'בטבלה של מטבע וקובייה: שניים מתוך $12$.'],
      remedy: [COIN_DIE_PREDICT] },
    { id: 'one-stage', title: 'חישבו את ההסתברות של שלב אחד בלבד',
      cause: 'רואים רק את השלב השני, ושוכחים שגם הראשון צריך להתקיים.',
      explain: ['התוצאה היא זוג: שני השלבים יחד.', 'בטבלה, התאים המתאימים הם בשורה של השלב הראשון ובעמודה של השני.'],
      remedy: [COIN_DIE_PREDICT] },
    { id: 'representativeness', title: 'חשבו שתוצאה שנראית "מסודרת" פחות סבירה מתוצאה שנראית מעורבבת',
      cause: 'תוצאה "מעורבבת" נראית טבעית יותר, אבל כל תא בטבלה הוא תוצאה אחת עם אותו סיכוי.',
      explain: ['$(6, 6)$ ו־$(2, 5)$ הם כל אחד תא אחד מתוך $36$.', 'הסדר נראה מיוחד לנו, לא לקובייה.'],
      remedy: [SAME_CELL] },
  ],
};

export const PROB: StairContent[] = [stair1, stair2, stair3];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/prob.js names them all). */
export const CATS_PROB: Record<string, string> = {};
