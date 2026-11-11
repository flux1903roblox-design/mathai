// Percent (אחוזים, הגדלה והקטנה באחוזים): the second unit of grade 8 (ח׳), October in the Ministry's תשפ״ז schedule
// (curriculum stage 1, CURRICULUM-4). Five stairs: what a percent is, a percent of an amount, what percent, finding the
// whole, and increase and decrease by a percent. sys:1 (equations with a percent change), relative frequency and
// probability rest on it.
//
// One picture carries the unit: the percent bar, 0% to 100% above and 0 to the whole below (the double number line), or
// the fraction bar with the whole written under it. A percent is hundredths; the benchmarks 50%, 25%, 10%, 5% and 1% are
// built in the head; "what percent" is the part over the whole; the whole is found through 1% or a benchmark and checked;
// a change multiplies by 1 ± p/100, always of the amount before it, so +10% and then −10% is 99% of the price. Every
// error the topic names (content/pct.js, with its source) is shown wrong at its stair. The diagnostic models are the
// plan's (content/pct.js PCT1 to PCT5T, ported unchanged). The numbers and situations of the Ministry's examples (48%
// of 200 voters, the two classes, the volunteers, Maya's skateboard, the download at 35%, the cinema ticket, Guy and
// Meital) are used; the sentences are the app's own. Every number written here is checked by the lane's
// verify/facts-pct.mjs, and the maths of every step by learn/content.test.ts.
import type { DiagModel, FigSpec, StairContent, ManipSpec, DlineLine, FractionFig } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/pct.js';

// ---------------------------------------------------------------- figures

const bar = (den: number, shaded: number, extra: Record<string, unknown> = {}): FigSpec => ({ type: 'fbar', den, shaded, ...extra } satisfies FractionFig);
const bars = (rows: { den: number; shaded: number; label?: string }[], extra: Record<string, unknown> = {}): FigSpec => ({ type: 'fbar', rows, ...extra } satisfies FractionFig);
const dl = (top: DlineLine, bottom: DlineLine, extra: { at?: number; show?: 'both' | 'top' | 'bottom'; label?: string; blank?: boolean } = {}): FigSpec => ({ type: 'dline', top, bottom, ...extra } satisfies FractionFig);
const table = (head: string[], rows: (string | number)[][]): FigSpec => ({ type: 'table', head, rows });
/** The percent line on top: 0% to max%, a tick every step, a label every `every` ticks. */
const pctLine = (step = 10, every?: number, max = 100): DlineLine => ({ max, step, unit: '%', label: 'אחוזים', ...(every ? { every } : {}) });
/** The amount below: 0 to max, a tick every step, labels every `every` ticks (a large `every`: only 0 and the end). */
const amount = (max: number, step: number, label = 'הכמות', every?: number): DlineLine => ({ max, step, label, ...(every ? { every } : {}) });
const moveT = (top: DlineLine, bottom: DlineLine, start = 0): ManipSpec => ({ kind: 'dline', top, bottom, move: 't', start: { t: start } });
const stretchTo = (top: DlineLine, bottom: DlineLine, fixT: number, from: number): ManipSpec => ({ kind: 'dline', top, bottom, move: 'max', fixT, start: { t: fixT, max: from } });
const shadeBar = (den: number): ManipSpec => ({ kind: 'fbar', start: { den, shaded: 0 }, lockDen: true });

/** The volunteers of a village by place (the Ministry's table): 120 in all. */
const VOLUNTEERS: (string | number)[][] = [['החברה להגנת הטבע', 30], ['מד״א', 42], ['בית אבות', 24], ['ספרייה', 24]];
const volunteers = (total: boolean): FigSpec => table(['מקום', 'מתנדבים'], total ? [...VOLUNTEERS, ['כל המתנדבים', 120]] : VOLUNTEERS);
/** The cinema ticket: 35 and 38.50 ₪, both cut into parts of 3.50 (10 and 11 of them). */
const ticket = bars([{ den: 11, shaded: 10, label: '35' }, { den: 11, shaded: 11, label: '38.50' }]);

// ================================================================ stair 1: what a percent is

type P1 = { k: 0 | 1; a?: number; b?: number; x?: number };
const pct1: DiagModel<P1> = {
  params: (rnd) => G.PCT1.params(rnd),
  text: (p) => G.pct1Text(p),
  answer: (p) => G.PCT1.answer(p),
  bugs: G.PCT1.bugs,
  solution: (p) => G.pct1Solution(p),
  hint: (p) => G.pct1Hint(p),
  unit: '%',
};
type P1T = { a: number; b: number };
const pct1T: DiagModel<P1T> = {
  params: (rnd) => G.PCT1T.params(rnd),
  text: (p) => G.testText(p),
  answer: (p) => G.PCT1T.answer(p),
  bugs: G.PCT1T.bugs,
  solution: (p) => G.testSolution(p),
  hint: () => G.testHint(),
  unit: '%',
};

const stair1: StairContent = {
  skill: 'pct:1', topic: 'pct', level: 1, title: 'מהו אחוז',
  objectives: [
    'לדעת שאחוז הוא מאית, ו־$100\\%$ הם השלם.',
    'לעבור בין שבר, מספר עשרוני ואחוז.',
    'להכיר את האחוזים השכיחים: $50\\%$, $25\\%$, $10\\%$, $1\\%$, וגם אחוזים מעל $100\\%$.',
  ],
  idea: 'אחוז הוא מאית מהשלם. $100\\%$ הם כל השלם, $50\\%$ חצי, $25\\%$ רבע, $10\\%$ עשירית.',
  why: [
    '"אחוז" הוא "אחד ממאה": $7\\%$ הם $\\frac{7}{100}$.',
    'כדי לכתוב שבר כאחוז מרחיבים אותו למכנה $100$: $\\frac{3}{4} = \\frac{75}{100} = 75\\%$.',
  ],
  alt: ['פס הסוללה בטלפון: חצי פס הוא $50\\%$, רבע פס $25\\%$. האחוז אומר איזה חלק מהשלם, לא כמה יחידות.'],
  discover: [
    { kind: 'say', text: 'פס ההורדה מראה $35\\%$: מכל $100$ חלקים של הקובץ, $35$ כבר ירדו.',
      fig: dl(pctLine(5, 4), amount(100, 5, 'הקובץ'), { at: 35, show: 'top', blank: true }) },
    { kind: 'predict', text: 'רבע מהפס צבוע. כמה אחוזים?', fig: bar(4, 1),
      choices: ['$25\\%$', '$4\\%$', '$14\\%$'], answer: 0,
      why: 'רבע מ־$100$ הוא $25$: $\\frac{1}{4} = \\frac{25}{100}$.',
      wrongWhy: { 1: '$4$ הוא המכנה, מספר החלקים, לא האחוז.', 2: 'אחוז הוא "מתוך $100$": רבע מ־$100$ הוא $25$.' } },
    { kind: 'explore', text: 'צבעו $35\\%$ מהפס.', manip: shadeBar(20), answer: { mode: 'value', value: 0.35 },
      hint: 'כל חלק בפס הוא $\\frac{1}{20}$, כלומר $5\\%$. כמה חלקים כאלה הם $35\\%$?',
      success: '$7$ חלקים של $5\\%$ הם $35\\%$.' },
    { kind: 'rule', text: 'אחוז הוא מאית: $p\\% = \\frac{p}{100}$.', display: '35\\% = \\frac{35}{100} = 0.35',
      why: '$100\\%$ הם השלם, ולכן כל אחוז הוא חלק אחד מתוך $100$.',
      fig: dl(pctLine(5, 4), amount(1, 0.05, 'מספר עשרוני', 4), { at: 35 }) },
    { kind: 'predict', text: '$0.4$ באחוזים:', fig: dl(pctLine(10, 5), amount(1, 0.1, 'מספר עשרוני', 5), { at: 40, show: 'bottom' }),
      choices: ['$40\\%$', '$4\\%$', '$0.4\\%$'], answer: 0,
      why: '$0.4 = 0.40 = \\frac{40}{100} = 40\\%$.',
      wrongWhy: { 1: '$4\\%$ הם $0.04$. הספרה $4$ ב־$0.4$ היא עשיריות, כלומר $40$ מאיות.', 2: '$0.4\\%$ הם פחות מאחוז אחד. $0.4$ הוא כמעט חצי מהשלם.' } },
    { kind: 'predict', text: '$3$ חלקים מתוך $5$: כמה אחוזים?', fig: bar(5, 3),
      choices: ['$60\\%$', '$3\\%$', '$35\\%$'], answer: 0,
      why: '$\\frac{3}{5} = \\frac{60}{100}$.',
      wrongWhy: { 1: '$3$ הוא מספר החלקים. אחוז שואל "כמה מתוך $100$".', 2: 'זה לא $3$ ו־$5$ זה ליד זה. מרחיבים: $\\frac{3}{5} = \\frac{60}{100}$.' } },
    { kind: 'predict', text: 'יכול להיות יותר מ־$100\\%$?', fig: bars([{ den: 2, shaded: 2, label: '100%' }, { den: 2, shaded: 1, label: '50%' }]),
      choices: ['כן, למשל פי $1.5$ הם $150\\%$', 'לא, $100\\%$ זה הכול'], answer: 0,
      why: '$100\\%$ הם השלם, ואפשר להשוות לשלם גם כמות גדולה ממנו: $1.5 = 150\\%$.',
      wrongWhy: { 1: 'כשמשווים כמות גדולה לשלם קטן ממנה, יוצא יותר מ־$100\\%$: פס שלם ועוד חצי הם $150\\%$.' } },
    { kind: 'rule', text: 'משבר לאחוז: מרחיבים למכנה $100$, או מחלקים וכופלים ב־$100$.', display: '\\frac{3}{5} = 0.6 = 60\\%',
      why: 'שלוש הכתיבות הן אותו מספר.', fig: bar(5, 3, { labels: true, whole: 100 }) },
  ],
  examples: [
    { problem: 'כתבו את $\\frac{7}{20}$ באחוזים.', answer: 35, check: '7/20*100',
      steps: [
        { action: 'פי כמה מרחיבים ל־$100$?', why: 'אחוז הוא מאיות, ולכן רוצים מכנה $100$.', result: '100 : 20 = 5', calc: { expr: '100/20', value: 5 } },
        { action: 'כופלים גם את המונה ב־$5$.', why: 'הרחבה כופלת את המונה ואת המכנה באותו מספר.', result: '\\frac{7}{20} = \\frac{35}{100}', calc: { expr: '7*5', value: 35 } },
        { action: 'קוראים את האחוז.', why: '$35$ מאיות הם $35\\%$.', result: '\\frac{35}{100} = 35\\%', value: '7*5' },
      ] },
    { problem: 'כתבו את $0.08$ באחוזים.', answer: 8, check: '0.08*100',
      steps: [
        { action: 'כותבים כמאיות.', why: 'הספרה $8$ היא במקום המאיות.', result: '0.08 = \\frac{8}{100}', value: '0.08*100' },
        { action: 'קוראים את האחוז.', why: 'מאיות הן אחוזים.', result: '8\\%', value: '8' },
      ] },
    { problem: 'כתבו את $1.2$ באחוזים.', answer: 120, check: '1.2*100',
      steps: [
        { action: 'כופלים ב־$100$.', why: 'כל שלם הוא $100\\%$.', result: '1.2 \\cdot 100 = 120', value: '1.2*100' },
        { action: 'קוראים את האחוז.', why: 'יותר מ־$1$ הוא יותר מהשלם.', result: '120\\%', value: '120' },
      ] },
  ],
  together: [
    { problem: 'במבחן $25$ שאלות, ודנה ענתה נכון על $19$ מהן. איזה אחוז מהשאלות ענתה נכון?',
      steps: [
        { prompt: 'כמה אחוזים שווה כל שאלה?', choices: [
          { text: '$4\\%$', ok: true, feedback: 'נכון: $100 : 25 = 4$.' },
          { text: '$25\\%$', ok: false, feedback: '$25$ הוא מספר השאלות. כל השאלות יחד הן $100\\%$.' },
          { text: '$19\\%$', ok: false, feedback: '$19$ הוא מספר התשובות הנכונות. כל שאלה היא $4\\%$.' },
        ], hints: ['כל $25$ השאלות יחד הן $100\\%$.', '$100 : 25$.'], done: 'כל שאלה היא $4\\%$.' },
      ],
      final: { prompt: 'איזה אחוז ענתה נכון?', answer: 76, check: '19*4', hints: ['$19$ שאלות, כל אחת $4\\%$.', '$19 \\cdot 4$.'] } },
    { problem: 'כתבו את $0.6$ באחוזים.',
      steps: [
        { prompt: '$0.6$ הם כמה מאיות?', choices: [
          { text: '$60$', ok: true, feedback: 'נכון: $0.6 = 0.60$, שישים מאיות.' },
          { text: '$6$', ok: false, feedback: '$0.6 = 0.60$: שש עשיריות הן שישים מאיות.' },
        ], hints: ['הוסיפו אפס בסוף: $0.6 = 0.60$.', 'עשירית אחת היא $10$ מאיות.'], done: '$0.6 = \\frac{60}{100}$.' },
      ],
      final: { prompt: 'כמה אחוזים?', answer: 60, check: '0.6*100', hints: ['מאיות הן אחוזים.', '$60$ מאיות.'] } },
  ],
  diag: pct1,
  transfer: pct1T,
  words: ['אחוז', 'מאית', 'השלם', '$100\\%$', 'אחוזים שכיחים'],
  misconceptions: [
    { id: 'count-as-pct', title: 'כתבו את מספר החלקים כאילו הוא האחוז',
      cause: 'סופרים חלקים ושוכחים לשאול "מתוך כמה". אחוז תמיד מתוך $100$.',
      explain: ['$3$ חלקים מתוך $5$ הם $\\frac{3}{5}$, ו־$\\frac{3}{5} = \\frac{60}{100} = 60\\%$.', 'האחוז אומר כמה מכל $100$, לא כמה חלקים צבעו.'],
      remedy: [
        { kind: 'predict', text: '$3$ חלקים מתוך $5$: כמה אחוזים?', fig: bar(5, 3), choices: ['$60\\%$', '$3\\%$'], answer: 0,
          why: 'מרחיבים למכנה $100$: $\\frac{3}{5} = \\frac{60}{100}$.' },
        { kind: 'explore', text: 'צבעו $60\\%$ מהפס.', manip: shadeBar(5), answer: { mode: 'value', value: 0.6 },
          hint: 'כל חלק הוא $20\\%$. כמה חלקים הם $60\\%$?', success: '$3$ מתוך $5$ הם $60\\%$ מהפס.' },
      ] },
    { id: 'digit-pct', title: 'קראו את הספרות שאחרי הנקודה כאחוז',
      cause: 'קוראים את הספרות שאחרי הנקודה כמו מספר שלם.',
      explain: ['$0.4$ הם ארבע עשיריות, כלומר $40$ מאיות: $40\\%$.', '$4\\%$ הם $0.04$, עשר פעמים פחות.'],
      remedy: [
        { kind: 'predict', text: '$0.4$ באחוזים:', fig: dl(pctLine(10, 5), amount(1, 0.1, 'מספר עשרוני', 5), { at: 40, show: 'bottom' }),
          choices: ['$40\\%$', '$4\\%$'], answer: 0, why: '$0.4 = 0.40 = \\frac{40}{100}$.' },
        { kind: 'explore', text: 'הזיזו את הסמן עד ש־$0.4$ יהיה מתחתיו, וקראו את האחוז.', manip: moveT(pctLine(10, 5), amount(1, 0.1, 'מספר עשרוני', 5)), answer: 40,
          hint: 'כל שנתה למעלה היא $10\\%$, ומתחתיה $0.1$.', success: 'מעל $0.4$ יש $40\\%$.' },
      ] },
  ],
};

// ================================================================ stair 2: a percent of an amount

type P2 = { p: number; N: number };
const pct2: DiagModel<P2> = {
  params: (rnd) => G.PCT2.params(rnd),
  text: (p) => G.pct2Text(p),
  answer: (p) => G.PCT2.answer(p),
  bugs: G.PCT2.bugs,
  solution: (p) => G.pct2Solution(p),
  hint: (p) => G.pct2Hint(p),
};
const pct2T: DiagModel<P2> = {
  params: (rnd) => G.PCT2T.params(rnd),
  text: (p) => G.saveText(p),
  answer: (p) => G.PCT2T.answer(p),
  bugs: G.PCT2T.bugs,
  solution: (p) => G.saveSolution(p),
  hint: () => G.saveHint(),
  unit: 'ש״ח',
};

const stair2: StairContent = {
  skill: 'pct:2', topic: 'pct', level: 2, title: 'אחוז מכמות',
  objectives: [
    'לחשב $p\\%$ מכמות: $\\frac{p}{100} \\cdot N$.',
    'לחשב בעל פה $50\\%$, $25\\%$, $10\\%$, $5\\%$ ו־$1\\%$, ולבנות מהם אחוזים אחרים.',
    'לבדוק שהתוצאה סבירה: $48\\%$ הם קצת פחות מחצי.',
  ],
  idea: '"$p\\%$ מ־" זה כפל: $\\frac{p}{100}$ כפול הכמות. בונים מאחוזים קלים: $10\\%$ הם חלק עשירי, $5\\%$ חצי מזה.',
  why: [
    '$1\\%$ מ־$240$ הוא $2.4$, ולכן $30\\%$ הם פי $30$: $72$.',
    '$30\\% = 0.3$, ו־$0.3 \\cdot 240 = 72$: שתי הדרכים נותנות אותו דבר.',
  ],
  alt: ['פס אחוזים: מעל הפס $0\\%$ עד $100\\%$, מתחתיו $0$ עד $240$. כל $10\\%$ הם $24$, ושלושה כאלה $72$.'],
  discover: [
    { kind: 'predict', text: '$50\\%$ מ־$80$:', fig: dl(pctLine(10, 5), amount(80, 8, 'הכמות', 100), { at: 50, show: 'top' }),
      choices: ['$40$', '$50$', '$1.6$'], answer: 0,
      why: '$50\\%$ הם חצי.',
      wrongWhy: { 1: '$50$ הוא האחוז, לא הכמות.', 2: 'חילקתם ב־$50$. $50\\%$ הם חצי, כלומר חילוק ב־$2$.' } },
    { kind: 'explore', text: 'הזיזו את הסמן ל־$30\\%$ מ־$240$, וקראו מה מתחתיו.', manip: moveT(pctLine(10), amount(240, 24, 'הכמות', 10)), answer: 30,
      hint: 'כל שנתה למעלה היא $10\\%$. מה מתחתיה?',
      success: '$30\\%$ מ־$240$ הם $3 \\cdot 24 = 72$.' },
    { kind: 'rule', text: '$p\\%$ מ־$N$: $\\frac{p}{100} \\cdot N$.', display: '\\frac{30}{100} \\cdot 240 = 0.3 \\cdot 240 = 72',
      why: '$\\frac{30}{100}$ מהכמות הם $30$ חלקים מתוך $100$ חלקים שלה.',
      fig: dl(pctLine(10), amount(240, 24, 'הכמות', 10), { at: 30 }) },
    { kind: 'predict', text: '$10\\%$ מ־$350$:', fig: dl(pctLine(10, 5), amount(350, 35, 'הכמות', 100), { at: 10, show: 'top' }),
      choices: ['$35$', '$10$', '$340$'], answer: 0,
      why: '$10\\%$ הם עשירית: $350 : 10 = 35$.',
      wrongWhy: { 1: '$10$ הוא האחוז. עשרה אחוזים הם עשירית מהכמות.', 2: 'הורדתם $10$ מהכמות. $10\\%$ הם עשירית ממנה.' } },
    { kind: 'rule', text: '$10\\%$: מחלקים ב־$10$. $5\\%$: חצי מזה. $1\\%$: מחלקים ב־$100$.',
      why: 'עשירית, חצי עשירית ומאית.', fig: dl(pctLine(5, 2), amount(200, 10, 'הכמות', 10), { at: 10 }) },
    { kind: 'predict', text: '$15\\%$ מ־$60$:', fig: dl(pctLine(5, 2), amount(60, 3, 'הכמות', 100), { at: 15, show: 'top' }),
      choices: ['$9$', '$4$', '$15$'], answer: 0,
      why: '$10\\%$ הם $6$, ו־$5\\%$ הם $3$: יחד $9$.',
      wrongWhy: { 1: '$60 : 15 = 4$ שואל כמה פעמים $15$ נכנס ב־$60$, לא כמה הם $15\\%$.', 2: '$15$ הוא האחוז, לא הכמות.' } },
    { kind: 'predict', text: 'בכנס $200$ משתתפים, ו־$48\\%$ מהם הצביעו בעד. בעד הצביעו:', fig: bar(25, 12, { whole: 200 }),
      choices: ['קרוב לחצי', 'רוב המשתתפים', '$48$ אנשים'], answer: 0,
      why: '$48\\%$ הם קצת פחות מ־$50\\%$, כלומר $96$ אנשים: קרוב לחצי, לא רוב.',
      wrongWhy: { 1: 'רוב הוא יותר מחצי, ו־$48\\%$ הם פחות מ־$50\\%$.', 2: '$48$ הוא האחוז. $48\\%$ מ־$200$ הם $96$ אנשים.' } },
    { kind: 'predict', text: 'בכיתה ח׳1 יש $28$ תלמידים, ו־$25\\%$ מהם מנגנים. בכיתה ח׳2 יש $35$ תלמידים, ו־$20\\%$ מהם מנגנים. באיזו כיתה מנגנים יותר?',
      fig: bars([{ den: 4, shaded: 1, label: 'ח׳1' }, { den: 5, shaded: 1, label: 'ח׳2' }]),
      choices: ['באותו מספר: $7$ בכל כיתה', 'בח׳1', 'בח׳2'], answer: 0,
      why: '$25\\%$ מ־$28$ הם $7$, ו־$20\\%$ מ־$35$ הם $7$. אחוז גדול יותר לא אומר כמות גדולה יותר.',
      wrongWhy: { 1: 'בח׳1 האחוז גדול יותר, אבל הכיתה קטנה יותר: $25\\%$ מ־$28$ הם $7$, כמו בח׳2.', 2: 'בח׳2 יש יותר תלמידים, אבל אחוז קטן יותר: $20\\%$ מ־$35$ הם $7$.' } },
  ],
  examples: [
    { problem: 'כמה הם $35\\%$ מ־$240$?', answer: 84, check: '0.35*240',
      steps: [
        { action: 'מוצאים $10\\%$: מחלקים ב־$10$.', why: '$10\\%$ הם עשירית מהכמות.', result: '240 : 10 = 24', calc: { expr: '240/10', value: 24 } },
        { action: 'מוצאים $5\\%$: חצי מ־$10\\%$.', why: '$5$ הוא חצי מ־$10$.', result: '24 : 2 = 12', calc: { expr: '24/2', value: 12 } },
        { action: 'מחברים: $35\\% = 30\\% + 5\\%$.', why: '$30\\%$ הם שלוש פעמים $10\\%$.', result: '3 \\cdot 24 + 12 = 84', value: '3*24 + 12' },
      ] },
    { problem: 'מעיל עולה $360$ ש״ח, ויש עליו הנחה של $25\\%$. כמה שקלים חוסכים?', answer: 90, check: '360/4',
      steps: [
        { action: 'הנחה של $25\\%$ היא רבע מהמחיר.', why: '$25\\% = \\frac{25}{100} = \\frac{1}{4}$.', result: '25\\% = \\frac{1}{4}', calc: { expr: '25/100', value: 0.25 } },
        { action: 'מחלקים את המחיר ב־$4$.', why: 'רבע מכמות הוא הכמות חלקי $4$.', result: '360 : 4 = 90', value: '0.25*360' },
      ] },
    { problem: 'כמה הם $150\\%$ מ־$40$?', answer: 60, check: '1.5*40',
      steps: [
        { action: 'מפרקים: $150\\% = 100\\% + 50\\%$.', why: '$100\\%$ הם כל הכמות, ו־$50\\%$ חצי ממנה.', result: '100\\% + 50\\% = 150\\%', calc: { expr: '100+50', value: 150 } },
        { action: 'כל הכמות ועוד חצי ממנה.', why: 'יותר מ־$100\\%$ נותן יותר מהכמות.', result: '40 + 20 = 60', value: '40 + 0.5*40' },
      ] },
  ],
  together: [
    { problem: 'כמה הם $30\\%$ מ־$70$?',
      steps: [
        { prompt: 'כמה הם $10\\%$ מ־$70$?', choices: [
          { text: '$7$', ok: true, feedback: 'נכון: $70 : 10 = 7$.' },
          { text: '$10$', ok: false, feedback: '$10$ הוא האחוז, לא הכמות.' },
          { text: '$0.7$', ok: false, feedback: '$0.7$ הם $1\\%$.' },
        ], hints: ['$10\\%$ הם עשירית.', '$70 : 10$.'], done: '$10\\%$ מ־$70$ הם $7$.' },
      ],
      final: { prompt: 'כמה הם $30\\%$?', answer: 21, check: '3*7', hints: ['$30\\%$ הם שלוש פעמים $10\\%$.', '$3 \\cdot 7$.'] } },
    { problem: 'בכיתה $28$ תלמידים, ו־$25\\%$ מהם מנגנים. כמה תלמידים מנגנים?',
      steps: [
        { prompt: '$25\\%$ הם:', choices: [
          { text: 'רבע', ok: true, feedback: 'נכון: $\\frac{25}{100} = \\frac{1}{4}$.' },
          { text: '$\\frac{1}{25}$', ok: false, feedback: '$\\frac{1}{25}$ הוא $4\\%$.' },
        ], hints: ['$25$ מתוך $100$.', '$\\frac{25}{100}$ אחרי צמצום.'], done: '$25\\%$ הם רבע.' },
      ],
      final: { prompt: 'כמה מנגנים?', answer: 7, check: '28/4', hints: ['רבע מ־$28$.', '$28 : 4$.'] } },
  ],
  diag: pct2,
  transfer: pct2T,
  words: ['אחוז מכמות', 'אחוזים שכיחים', 'אומדן', 'סבירות'],
  misconceptions: [
    { id: 'count-as-pct', title: 'כתבו את האחוז עצמו כאילו הוא הכמות',
      cause: 'האחוז הוא המספר הבולט בשאלה, ונדמה שהוא התשובה.',
      explain: ['$50\\%$ מ־$80$ הם חצי מ־$80$, כלומר $40$. $50$ הוא האחוז.', 'האחוז אומר איזה חלק לקחת, והכמות יוצאת מהשלם.'],
      remedy: [
        { kind: 'predict', text: '$50\\%$ מ־$80$:', fig: dl(pctLine(10, 5), amount(80, 8, 'הכמות', 100), { at: 50, show: 'top' }),
          choices: ['$40$', '$50$'], answer: 0, why: '$50\\%$ הם חצי מ־$80$, כלומר $40$.' },
      ] },
    { id: 'div-by-pct', title: 'חילקו את הכמות במספר האחוזים',
      cause: '"מ־" נשמע כמו חלוקה, אז מחלקים במספר האחוזים.',
      explain: ['$25\\%$ מ־$80$ הם רבע מ־$80$, כלומר $20$.', 'חלוקה ב־$25$ נותנת $3.2$, הרבה פחות מרבע.'],
      remedy: [
        { kind: 'predict', text: '$25\\%$ מ־$80$:', fig: dl(pctLine(5, 5), amount(80, 4, 'הכמות', 100), { at: 25, show: 'top' }),
          choices: ['$20$', '$3.2$'], answer: 0, why: '$25\\%$ הם רבע: $80 : 4 = 20$.' },
        { kind: 'explore', text: 'הזיזו את הסמן ל־$25\\%$ מ־$80$, וקראו מה מתחתיו.', manip: moveT(pctLine(5, 5), amount(80, 4, 'הכמות', 5)), answer: 25,
          hint: 'כל $5\\%$ הם $4$.', success: '$25\\%$ מ־$80$ הם $20$: רבע.' },
      ] },
  ],
};

// ================================================================ stair 3: what percent

type P3 = { A: number; B: number };
const pct3: DiagModel<P3> = {
  params: (rnd) => G.PCT3.params(rnd),
  text: (p) => G.pct3Text(p),
  answer: (p) => G.PCT3.answer(p),
  bugs: G.PCT3.bugs,
  solution: (p) => G.pct3Solution(p),
  hint: () => G.pct3Hint(),
  unit: '%',
};
const pct3T: DiagModel<P3> = {
  params: (rnd) => G.PCT3T.params(rnd),
  text: (p) => G.bikeText(p),
  answer: (p) => G.PCT3T.answer(p),
  bugs: G.PCT3T.bugs,
  solution: (p) => G.pct3Solution(p),
  hint: () => G.bikeHint(),
  unit: '%',
};

const stair3: StairContent = {
  skill: 'pct:3', topic: 'pct', level: 3, title: 'איזה אחוז?',
  objectives: [
    'לחשב איזה אחוז חלק הוא מהשלם: החלק חלקי השלם, כפול $100$.',
    'לזהות מהו השלם בשאלה.',
    'להבין שאחוז יכול להיות מעל $100\\%$ כשמשווים לכמות קטנה יותר.',
  ],
  idea: '"איזה אחוז" הוא החלק חלקי השלם, כפול $100$. השלם הוא מה שאחרי "מתוך" או "מ־".',
  why: [
    '$15$ מתוך $60$: $\\frac{15}{60} = \\frac{1}{4} = 25\\%$.',
    'כשהשלם קטן מהחלק, האחוז מעל $100$: השנה $30$ ובשנה שעברה $20$, כלומר $150\\%$.',
  ],
  alt: ['פס: מסמנים את השלם כ־$100\\%$ ובודקים איפה נופל החלק.'],
  discover: [
    { kind: 'predict', text: '$15$ מתוך $60$ הם:', fig: bar(4, 1, { whole: 60 }),
      choices: ['$25\\%$', '$400\\%$', '$15\\%$'], answer: 0,
      why: '$15$ הוא רבע מ־$60$.',
      wrongWhy: { 1: '$60 : 15 = 4$ הוא פי כמה השלם גדול מהחלק. האחוז הוא החלק חלקי השלם.', 2: '$15$ הוא החלק עצמו. משווים אותו לשלם, $60$.' } },
    { kind: 'explore', text: 'הזיזו את הסמן עד $15$ בפס התחתון, וקראו את האחוז למעלה.', manip: moveT(pctLine(5, 2), amount(60, 3, 'הכמות', 5)), answer: 25,
      hint: '$60$ הם $100\\%$. איפה $15$?',
      success: '$15$ מתוך $60$ הם $25\\%$.' },
    { kind: 'rule', text: 'איזה אחוז: החלק חלקי השלם, כפול $100$.', display: '\\frac{15}{60} \\cdot 100 = 25',
      why: '$\\frac{15}{60} = \\frac{25}{100}$: אותו מספר, בשתי כתיבות.',
      fig: dl(pctLine(5, 2), amount(60, 3, 'הכמות', 5), { at: 25 }) },
    { kind: 'predict', text: 'ביישוב $120$ מתנדבים, ו־$30$ מהם בחברה להגנת הטבע. איזה אחוז מהמתנדבים?', fig: volunteers(false),
      choices: ['$25\\%$', '$30\\%$', '$400\\%$'], answer: 0,
      why: '$\\frac{30}{120} = \\frac{1}{4}$, כלומר $25\\%$.',
      wrongWhy: { 1: '$30$ הוא מספר המתנדבים שם, לא האחוז.', 2: '$120 : 30 = 4$ הוא פי כמה השלם גדול. האחוז הוא $\\frac{30}{120}$.' } },
    { kind: 'say', text: 'השלם הוא הכמות שאליה משווים. ב"איזה אחוז מהמתנדבים" השלם הוא כל המתנדבים.', fig: volunteers(true) },
    { kind: 'predict', text: 'השנה $30$ חברים במועדון, ובשנה שעברה היו $20$. מספר החברים השנה הוא כמה אחוזים ממספרם בשנה שעברה?',
      fig: bars([{ den: 3, shaded: 3, label: '30' }, { den: 3, shaded: 2, label: '20' }]),
      choices: ['$150\\%$', '$66.7\\%$', '$30\\%$'], answer: 0,
      why: '$\\frac{30}{20} = 1.5 = 150\\%$. משווים לשנה שעברה, ולכן היא השלם.',
      wrongWhy: { 1: '$\\frac{20}{30}$ משווה את שנה שעברה להשנה: השלם הפוך.', 2: '$30$ הוא מספר החברים, לא האחוז.' } },
    { kind: 'rule', text: 'השלם יכול להיות קטן מהחלק, ואז האחוז מעל $100\\%$.', why: '$100\\%$ הוא השלם, לא התקרה.',
      fig: dl(pctLine(10, 5, 150), amount(30, 2, 'חברים', 5), { at: 100 }) },
    { kind: 'predict', text: 'הסקייטבורד עולה $225$ ש״ח, ומאיה חסכה $90$ ש״ח. איזה אחוז מהמחיר חסכה?', fig: bar(5, 2, { whole: 225 }),
      choices: ['$40\\%$', '$90\\%$', '$250\\%$'], answer: 0,
      why: '$\\frac{90}{225} = \\frac{2}{5} = 40\\%$.',
      wrongWhy: { 1: '$90$ הוא הסכום שחסכה, לא האחוז.', 2: '$\\frac{225}{90}$ הפוך: החלק למעלה, השלם למטה.' } },
  ],
  examples: [
    { problem: 'איזה אחוז הם $18$ מתוך $24$?', answer: 75, check: '18/24*100',
      steps: [
        { action: 'כותבים את החלק חלקי השלם ומצמצמים.', why: 'גם $18$ וגם $24$ מתחלקים ב־$6$.', result: '\\frac{18}{24} = \\frac{3}{4}', calc: { expr: '18/24', value: 0.75 } },
        { action: 'כופלים ב־$100$.', why: 'אחוזים הם מאיות.', result: '\\frac{3}{4} \\cdot 100 = 75', value: '3/4*100' },
      ] },
    { problem: 'הסקייטבורד עולה $225$ ש״ח, ומאיה חסכה $90$ ש״ח. איזה אחוז מהמחיר חסכה?', answer: 40, check: '90/225*100',
      steps: [
        { action: 'מצמצמים את $\\frac{90}{225}$ ב־$45$: המונה.', why: 'גם $90$ וגם $225$ מתחלקים ב־$45$.', result: '90 : 45 = 2', calc: { expr: '90/45', value: 2 } },
        { action: 'גם המכנה.', why: 'מצמצמים את שניהם באותו מספר.', result: '225 : 45 = 5', calc: { expr: '225/45', value: 5 } },
        { action: 'כופלים ב־$100$.', why: '$\\frac{2}{5}$ מהמחיר, באחוזים.', result: '\\frac{2}{5} \\cdot 100 = 40', value: '2/5*100' },
      ] },
  ],
  together: [
    { problem: 'איזה אחוז הם $12$ מתוך $80$?',
      steps: [
        { prompt: 'איזה שבר?', choices: [
          { text: '$\\frac{12}{80}$', ok: true, feedback: 'נכון: החלק למעלה, השלם למטה.' },
          { text: '$\\frac{80}{12}$', ok: false, feedback: 'החלק למעלה, השלם למטה.' },
        ], hints: ['מהו השלם? מה שאחרי "מתוך".', 'החלק $12$, השלם $80$.'], done: 'השבר $\\frac{12}{80}$.' },
      ],
      final: { prompt: 'כמה אחוזים?', answer: 15, check: '12/80*100', hints: ['כופלים את השבר ב־$100$.', '$\\frac{12}{80} \\cdot 100$.'] } },
    { problem: 'מחיר עלה מ־$40$ ל־$50$ ש״ח. המחיר החדש הוא כמה אחוזים מהמחיר הקודם?',
      steps: [
        { prompt: 'מהו השלם?', choices: [
          { text: 'המחיר הקודם, $40$', ok: true, feedback: 'נכון: משווים למחיר הקודם.' },
          { text: 'המחיר החדש, $50$', ok: false, feedback: 'השאלה משווה למחיר הקודם, ולכן הוא השלם.' },
        ], hints: ['"כמה אחוזים מ..." : אחרי "מ־" בא השלם.', 'מהמחיר הקודם.'], done: 'השלם $40$, $100\\%$.' },
      ],
      final: { prompt: 'כמה אחוזים?', answer: 125, check: '50/40*100', hints: ['$\\frac{50}{40} \\cdot 100$.', '$\\frac{50}{40} = 1.25$.'] } },
  ],
  diag: pct3,
  transfer: pct3T,
  words: ['איזה אחוז', 'מתוך', 'השלם', 'מעל $100\\%$'],
  misconceptions: [
    { id: 'inverse-ratio', title: 'חילקו את השלם בחלק במקום את החלק בשלם',
      cause: 'נדמה שבחילוק מחלקים את הגדול בקטן.',
      explain: ['$400\\%$ הם פי $4$ מהשלם, אבל $15$ קטן מ־$60$.', 'החלק למעלה והשלם למטה: $\\frac{15}{60} = 25\\%$.'],
      remedy: [
        { kind: 'predict', text: '$15$ מתוך $60$ הם:', fig: bar(4, 1, { whole: 60 }), choices: ['$25\\%$', '$400\\%$'], answer: 0,
          why: '$15$ הוא רבע מ־$60$, ולכן $25\\%$. החלק קטן מהשלם, אז האחוז קטן מ־$100$.' },
        { kind: 'explore', text: 'הזיזו את הסמן עד $20$ בפס התחתון, וקראו את האחוז.', manip: moveT(pctLine(5, 2), amount(80, 4, 'הכמות', 5)), answer: 25,
          hint: '$80$ הם $100\\%$. איפה $20$?', success: '$20$ מתוך $80$ הם $25\\%$.' },
      ] },
    { id: 'count-as-pct', title: 'כתבו את החלק כאילו הוא האחוז',
      cause: 'כותבים את החלק עצמו, בלי להשוות לשלם.',
      explain: ['$30$ מתוך $120$ הם $\\frac{30}{120} = \\frac{1}{4}$, כלומר $25\\%$.', 'האחוז הוא $30\\%$ רק כשהשלם הוא $100$.'],
      remedy: [
        { kind: 'predict', text: 'ביישוב $120$ מתנדבים, ו־$30$ מהם בחברה להגנת הטבע. איזה אחוז?', fig: volunteers(true), choices: ['$25\\%$', '$30\\%$'], answer: 0,
          why: 'משווים לכל $120$ המתנדבים: $\\frac{30}{120} = 25\\%$.' },
      ] },
  ],
};

// ================================================================ stair 4: finding the whole

type P4 = { p: number; W: number; A: number };
const pct4: DiagModel<P4> = {
  params: (rnd) => G.PCT4.params(rnd),
  text: (p) => G.pct4Text(p),
  answer: (p) => G.PCT4.answer(p),
  bugs: G.PCT4.bugs,
  solution: (p) => G.pct4Solution(p),
  hint: (p) => G.pct4Hint(p),
};
const pct4T: DiagModel<P4> = {
  params: (rnd) => G.PCT4T.params(rnd),
  text: (p) => G.downloadText(p),
  answer: (p) => G.PCT4T.answer(p),
  bugs: G.PCT4T.bugs,
  solution: (p) => G.pct4Solution(p),
  hint: (p) => G.downloadHint(p),
  unit: 'מגה־בייט',
};

const stair4: StairContent = {
  skill: 'pct:4', topic: 'pct', level: 4, title: 'מציאת השלם',
  objectives: [
    'למצוא את השלם כשיודעים חלק ואת האחוז שלו.',
    'לעבור דרך $1\\%$ או דרך אחוז נוח ($10\\%$, $20\\%$, $25\\%$).',
    'לבדוק: האחוז מהשלם שמצאנו מחזיר את החלק.',
  ],
  idea: 'כשיודעים כמה הם $p\\%$, מוצאים קודם $1\\%$ (או $10\\%$), ואחר כך את $100\\%$.',
  why: [
    '$35\\%$ הם $1400$, ולכן $1\\%$ הוא $1400 : 35 = 40$, ו־$100\\%$ הם $4000$.',
    'במשוואה: $0.35x = 1400$, ולכן $x = 4000$.',
  ],
  alt: ['פס: $20\\%$ הם חמישית מהפס. אם חמישית היא $6$, הפס כולו $5 \\cdot 6 = 30$.'],
  discover: [
    { kind: 'predict', text: 'ההורדה הגיעה ל־$35\\%$, וירדו $1400$ מגה־בייט. מה גודל הקובץ כולו?',
      fig: dl(pctLine(5, 4), amount(4000, 200, 'מגה־בייט'), { at: 35, label: '1400', blank: true }),
      choices: ['$4000$', '$490$', '$40$'], answer: 0,
      why: '$1\\%$ הוא $1400 : 35 = 40$, ו־$100\\%$ הם $4000$.',
      wrongWhy: { 1: '$490$ הם $35\\%$ מ־$1400$. אבל $1400$ הוא החלק, לא השלם.', 2: '$40$ הוא רק $1\\%$.' } },
    { kind: 'explore', text: 'מתחו את הפס התחתון עד ש־$35\\%$ ממנו יהיו $1400$.',
      manip: stretchTo(pctLine(5, 4), amount(5000, 200, 'מגה־בייט', 5), 35, 1000), answer: 4000,
      hint: 'כשהשלם $1000$, $35\\%$ ממנו הם $350$. צריך פי $4$.',
      success: 'השלם $4000$: $35\\%$ ממנו הם $1400$.' },
    { kind: 'rule', text: '$p\\%$ הם $A$: $1\\%$ הוא $\\frac{A}{p}$, והשלם $\\frac{A}{p} \\cdot 100$.', display: '\\frac{1400}{35} \\cdot 100 = 4000',
      why: 'מחלקים ל־$p$ חלקים של $1\\%$, וכופלים במאה חלקים.',
      fig: dl(pctLine(5, 4), amount(4000, 200, 'מגה־בייט', 5), { at: 35 }) },
    { kind: 'predict', text: '$20\\%$ מהכיתה הם $6$ תלמידים. כמה תלמידים בכיתה?', fig: bar(5, 1, { label: '20% = 6' }),
      choices: ['$30$', '$1.2$', '$0.3$'], answer: 0,
      why: '$20\\%$ הם חמישית, ולכן הכיתה פי $5$: $30$.',
      wrongWhy: { 1: '$1.2$ הם $20\\%$ מ־$6$. אבל $6$ הוא החלק: הכיתה גדולה ממנו.', 2: '$0.3$ הוא $6 : 20$, רק $1\\%$.' } },
    { kind: 'say', text: 'דרך קצרה: $20\\%$ הם $\\frac{1}{5}$, אז כופלים ב־$5$. $25\\%$ הם $\\frac{1}{4}$, אז כופלים ב־$4$.',
      fig: bars([{ den: 5, shaded: 1, label: '20%' }, { den: 4, shaded: 1, label: '25%' }]) },
    { kind: 'predict', text: '$75\\%$ מהמיכל הם $60$ ליטר. כמה ליטר במיכל מלא?', fig: bar(4, 3, { label: '75% = 60' }),
      choices: ['$80$', '$45$', '$0.8$'], answer: 0,
      why: '$25\\%$ הם $20$, ו־$100\\%$ הם $80$.',
      wrongWhy: { 1: '$45$ הם $75\\%$ מ־$60$. אבל $60$ הוא החלק, והמיכל המלא גדול ממנו.', 2: '$0.8$ הוא $60 : 75$, רק $1\\%$.' } },
    { kind: 'rule', text: 'בדיקה: מחשבים $p\\%$ מהשלם שמצאנו, וצריך לצאת החלק.', why: '$75\\%$ מ־$80$ הם $60$. נכון.', fig: bar(4, 3, { whole: 80 }) },
    { kind: 'predict', text: '$5\\%$ מכמות הם $12$. מה הכמות כולה?', fig: dl(pctLine(5, 4), amount(240, 12), { at: 5, label: '12', blank: true }),
      choices: ['$240$', '$0.6$', '$2.4$'], answer: 0,
      why: '$1\\%$ הוא $2.4$, ו־$100\\%$ הם $240$. או: $5\\%$ הם $\\frac{1}{20}$, ו־$12 \\cdot 20 = 240$.',
      wrongWhy: { 1: '$0.6$ הם $5\\%$ מ־$12$. אבל $12$ הוא החלק.', 2: '$2.4$ הוא רק $1\\%$.' } },
  ],
  examples: [
    { problem: '$40\\%$ מהתלמידים הם $14$. כמה תלמידים יש?', answer: 35, check: '14/40*100',
      steps: [
        { action: 'מוצאים $1\\%$.', why: '$40\\%$ הם $40$ חלקים של $1\\%$.', result: '14 : 40 = 0.35', calc: { expr: '14/40', value: 0.35 } },
        { action: 'מוצאים $100\\%$.', why: 'השלם הוא מאה חלקים של $1\\%$.', result: '0.35 \\cdot 100 = 35', value: '0.35*100' },
        { action: 'בודקים.', why: '$40\\%$ מהשלם צריכים להחזיר את החלק.', result: '0.4 \\cdot 35 = 14', calc: { expr: '0.4*35', value: 14 } },
      ] },
    { problem: 'עמלה של $0.5\\%$ מסכום מסוים היא $40$ ש״ח. מה הסכום?', answer: 8000, check: '40/0.5*100',
      steps: [
        { action: '$1\\%$ הוא פי $2$ מ־$0.5\\%$.', why: 'חצי אחוז הוא $40$, ולכן אחוז שלם $80$.', result: '40 : 0.5 = 80', calc: { expr: '40/0.5', value: 80 } },
        { action: 'מוצאים $100\\%$.', why: 'השלם הוא מאה פעמים $1\\%$.', result: '80 \\cdot 100 = 8000', value: '80*100' },
      ] },
  ],
  together: [
    { problem: '$25\\%$ מהעוגה הם $300$ גרם. כמה שוקלת העוגה כולה?',
      steps: [
        { prompt: '$25\\%$ הם:', choices: [
          { text: 'רבע', ok: true, feedback: 'נכון: $\\frac{25}{100} = \\frac{1}{4}$.' },
          { text: 'חצי', ok: false, feedback: '$50\\%$ הם חצי. $25\\%$ הם חצי של חצי.' },
        ], hints: ['$25$ מתוך $100$.', 'ארבעה חלקים כאלה הם $100\\%$.'], done: '$300$ גרם הם רבע מהעוגה.' },
      ],
      final: { prompt: 'כמה גרם שוקלת העוגה?', answer: 1200, check: '300*4', hints: ['העוגה כולה היא ארבעה רבעים.', '$300 \\cdot 4$.'] } },
    { problem: '$30\\%$ מהדרך הם $45$ ק״מ. כמה ק״מ הדרך כולה?',
      steps: [
        { prompt: 'כמה הם $10\\%$ מהדרך?', choices: [
          { text: '$15$ ק״מ', ok: true, feedback: 'נכון: $30\\%$ הם שלוש פעמים $10\\%$, ו־$45 : 3 = 15$.' },
          { text: '$13.5$ ק״מ', ok: false, feedback: '$13.5$ הם $30\\%$ מ־$45$. אבל $45$ הוא החלק, לא השלם.' },
          { text: '$4.5$ ק״מ', ok: false, feedback: '$4.5$ הם $10\\%$ מ־$45$. אבל $45$ הם כבר $30\\%$ מהדרך.' },
        ], hints: ['$30\\%$ הם שלושה חלקים של $10\\%$.', '$45 : 3$.'], done: '$10\\%$ מהדרך הם $15$ ק״מ.' },
      ],
      final: { prompt: 'כמה ק״מ הדרך כולה?', answer: 150, check: '45/30*100', hints: ['$100\\%$ הם עשר פעמים $10\\%$.', '$15 \\cdot 10$.'] } },
  ],
  diag: pct4,
  transfer: pct4T,
  words: ['מציאת השלם', '$1\\%$', 'בדיקה'],
  misconceptions: [
    { id: 'pct-of-part', title: 'חישבו אחוז מהחלק הנתון במקום למצוא את השלם',
      cause: 'התרגלנו ש"אחוז מ־" זה כפל, אז כופלים גם כשהשלם הוא מה שחסר.',
      explain: ['$1.2$ הם $20\\%$ מ־$6$. אבל בשאלה $6$ הם החלק, לא השלם.', 'אם $6$ הם רק $20\\%$, השלם גדול מ־$6$: $30$.'],
      remedy: [
        { kind: 'predict', text: '$20\\%$ מהכיתה הם $6$ תלמידים. כמה תלמידים בכיתה?', fig: bar(5, 1, { label: '20% = 6' }), choices: ['$30$', '$1.2$'], answer: 0,
          why: '$6$ הם חמישית מהכיתה, ולכן הכיתה $5 \\cdot 6 = 30$.' },
        { kind: 'explore', text: 'מתחו את הפס התחתון עד ש־$20\\%$ ממנו יהיו $6$.', manip: stretchTo(pctLine(5, 4), amount(60, 2, 'תלמידים', 5), 20, 10), answer: 30,
          hint: 'כשהשלם $10$, $20\\%$ ממנו הם $2$. צריך פי $3$.', success: 'השלם $30$: $20\\%$ ממנו הם $6$.' },
      ] },
    { id: 'stop-at-one', title: 'מצאו כמה הם $1\\%$ ועצרו שם',
      cause: 'מצאנו $1\\%$ ושכחנו שהשאלה על השלם.',
      explain: ['$5\\%$ הם $12$, ולכן $1\\%$ הוא $2.4$.', 'השלם הוא $100\\%$: $2.4 \\cdot 100 = 240$.'],
      remedy: [
        { kind: 'predict', text: '$5\\%$ מכמות הם $12$. מה הכמות כולה?', fig: dl(pctLine(5, 4), amount(240, 12), { at: 5, label: '12', blank: true }),
          choices: ['$240$', '$2.4$'], answer: 0, why: '$2.4$ הוא רק $1\\%$. השלם הוא פי $100$: $240$. בדיקה: $5\\%$ מ־$240$ הם $12$.' },
      ] },
  ],
};

// ================================================================ stair 5: increase and decrease by a percent

type P5 = { k: 0 | 1; p: number; up?: boolean; N: number };
const pct5: DiagModel<P5> = {
  params: (rnd) => G.PCT5.params(rnd),
  text: (p) => G.pct5Text(p),
  answer: (p) => G.PCT5.answer(p),
  bugs: G.PCT5.bugs,
  solution: (p) => G.pct5Solution(p),
  hint: (p) => G.pct5Hint(p),
  unit: 'ש״ח',
};
type P5T = { p: number; up: boolean; N: number; M: number };
const pct5T: DiagModel<P5T> = {
  params: (rnd) => G.PCT5T.params(rnd),
  text: (p) => G.byWhatText(p),
  answer: (p) => G.PCT5T.answer(p),
  bugs: G.PCT5T.bugs,
  solution: (p) => G.byWhatSolution(p),
  hint: () => G.byWhatHint(),
  unit: '%',
};

/** A price changed twice, step by step, as a table: the price at the start, after the first change, and the question. */
const chain = (start: number, mid: number, first: string, second: string): FigSpec =>
  table(['שלב', 'מחיר'], [['בהתחלה', start], [first, mid], [second, '?']]);

const stair5: StairContent = {
  skill: 'pct:5', topic: 'pct', level: 5, title: 'הגדלה והקטנה באחוזים',
  objectives: [
    'לחשב מחיר אחרי התייקרות או הנחה בכפל אחד: פי $1.2$, פי $0.8$.',
    'לחשב בכמה אחוזים השתנה מחיר, ביחס למחיר שלפני השינוי.',
    'לדעת ששני שינויים באחוזים לא מתחברים: $+10\\%$ ואז $-10\\%$ אינם $0$.',
  ],
  idea: 'שינוי באחוזים הוא כפל: התייקרות של $p\\%$ היא כפל ב־$1 + \\frac{p}{100}$, והנחה של $p\\%$ כפל ב־$1 - \\frac{p}{100}$. האחוז תמיד מהמחיר שלפני השינוי.',
  why: [
    'אחרי הנחה של $25\\%$ נשארים $75\\%$ מהמחיר, ולכן כופלים ב־$0.75$.',
    'מ־$100$ ל־$110$ זה $+10\\%$ מ־$100$. מ־$110$ חזרה ל־$100$ יורדים $10$ מתוך $110$, כלומר בערך $9.1\\%$.',
  ],
  alt: ['שני שינויים הם שני כפלים: $1.1 \\cdot 0.9 = 0.99$, ולכן אחרי $+10\\%$ ו־$-10\\%$ המחיר הוא $99\\%$ ממה שהיה.'],
  discover: [
    { kind: 'predict', text: 'חולצה עולה $80$ ש״ח, ויש עליה הנחה של $25\\%$. כמה משלמים?', fig: bar(4, 4, { cross: 1, whole: 80 }),
      choices: ['$60$', '$55$', '$20$'], answer: 0,
      why: '$25\\%$ מ־$80$ הם $20$, ו־$80 - 20 = 60$. או: $0.75 \\cdot 80 = 60$.',
      wrongWhy: { 1: 'הורדתם $25$ שקלים, לא $25\\%$.', 2: '$20$ הוא גובה ההנחה, לא המחיר.' } },
    { kind: 'rule', text: 'הנחה של $p\\%$: משלמים $100 - p$ אחוזים. התייקרות של $p\\%$: $100 + p$ אחוזים.', display: '80 \\cdot 0.75 = 60',
      why: 'השינוי והמחיר החדש בצעד אחד.', fig: bar(4, 3, { whole: 80 }) },
    { kind: 'predict', text: 'את המחיר החדש מחשבים כך: המחיר הקודם כפול $1.2$. בכמה אחוזים התייקר?',
      fig: dl(pctLine(10, 2, 120), amount(1.2, 0.1, 'פי', 2), { at: 120 }),
      choices: ['$20\\%$', '$1.2\\%$', '$120\\%$'], answer: 0,
      why: '$1.2 = 120\\%$ מהמחיר הקודם, כלומר $20\\%$ יותר.',
      wrongWhy: { 1: '$1.2$ הוא פי כמה, לא האחוז. $1.2 = 120\\%$.', 2: '$120\\%$ הוא המחיר החדש מתוך הקודם. ההתייקרות היא מה שמעל $100\\%$.' } },
    { kind: 'explore', text: 'מחיר של $150$ ש״ח התייקר ב־$20\\%$. הזיזו את הסמן ל־$120\\%$ וקראו את המחיר החדש.',
      manip: moveT(pctLine(10, 5, 150), amount(225, 15, 'ש״ח', 5), 100), answer: 120,
      hint: '$100\\%$ הם $150$. כל $10\\%$ הם $15$.',
      success: '$120\\%$ מ־$150$ הם $180$.' },
    { kind: 'predict', text: 'כרטיס לקולנוע התייקר מ־$35$ ל־$38.50$ ש״ח, כלומר ב־$10\\%$. אחר כך הוזל חזרה ל־$35$ ש״ח. בכמה אחוזים הוזל?', fig: ticket,
      choices: ['קצת פחות מ־$10\\%$', 'בדיוק $10\\%$', 'יותר מ־$10\\%$'], answer: 0,
      why: 'ההוזלה היא $3.50$ מתוך $38.50$: $\\frac{3.5}{38.5} \\approx 9.1\\%$.',
      wrongWhy: { 1: 'אותם $3.50$ שקלים, אבל עכשיו מתוך $38.50$, שלם גדול יותר. לכן פחות מ־$10\\%$.', 2: 'השלם עכשיו גדול יותר, $38.50$, ולכן אותם $3.50$ הם פחות מ־$10\\%$ ממנו.' } },
    { kind: 'rule', text: 'האחוז תמיד מהמחיר שלפני השינוי.', display: '\\frac{3.5}{35} = 10\\%,\\quad \\frac{3.5}{38.5} \\approx 9.1\\%',
      why: 'באותם $3.50$ שקלים, השלם שונה.', fig: ticket },
    { kind: 'predict', text: 'מחיר של $200$ ש״ח התייקר ב־$10\\%$, ואחר כך הוזל ב־$10\\%$. כמה הוא עכשיו?',
      fig: chain(200, 220, 'התייקר ב־10%', 'הוזל ב־10%'),
      choices: ['$198$', '$200$', '$180$'], answer: 0,
      why: '$200 \\cdot 1.1 = 220$, ו־$220 \\cdot 0.9 = 198$.',
      wrongWhy: { 1: 'ה־$10\\%$ השני נלקח מ־$220$, לא מ־$200$: $22$ שקלים, לא $20$.', 2: 'הוזלה של $10\\%$ מ־$220$ היא $22$, ולכן $198$.' } },
    { kind: 'predict', text: 'ואם קודם מוזילים ב־$10\\%$ ואחר כך מייקרים ב־$10\\%$?',
      fig: chain(200, 180, 'הוזל ב־10%', 'התייקר ב־10%'),
      choices: ['גם $198$', '$200$', '$202$'], answer: 0,
      why: '$0.9 \\cdot 1.1 = 1.1 \\cdot 0.9$: בכפל הסדר לא משנה.',
      wrongWhy: { 1: '$200 \\cdot 0.9 = 180$, ו־$180 \\cdot 1.1 = 198$.', 2: 'ההתייקרות נלקחת מ־$180$: $18$ שקלים. $180 + 18 = 198$.' } },
  ],
  examples: [
    { problem: 'מחיר של $240$ ש״ח בהנחה של $15\\%$. כמה משלמים?', answer: 204, check: '240*0.85',
      steps: [
        { action: 'כמה אחוזים נשארים?', why: 'בהנחה משלמים את מה שלא ירד.', result: '100\\% - 15\\% = 85\\%', calc: { expr: '100-15', value: 85 } },
        { action: 'כופלים ב־$0.85$.', why: '$85\\% = 0.85$.', result: '0.85 \\cdot 240 = 204', value: '0.85*240' },
      ] },
    { problem: 'מחיר עלה מ־$35$ ל־$38.50$ ש״ח. בכמה אחוזים התייקר?', answer: 10, check: '(38.5-35)/35*100',
      steps: [
        { action: 'מוצאים את השינוי.', why: 'כמה שקלים נוספו.', result: '38.5 - 35 = 3.5', calc: { expr: '38.5-35', value: 3.5 } },
        { action: 'משווים למחיר הקודם.', why: 'האחוז תמיד מהמחיר שלפני השינוי.', result: '\\frac{3.5}{35} \\cdot 100 = 10', value: '3.5/35*100' },
      ] },
    { problem: 'מחיר של $500$ ש״ח התייקר ב־$20\\%$, ואחר כך הוזל ב־$20\\%$. כמה הוא עכשיו?', answer: 480, check: '500*1.2*0.8',
      steps: [
        { action: 'אחרי ההתייקרות.', why: 'התייקרות של $20\\%$ היא כפל ב־$1.2$.', result: '500 \\cdot 1.2 = 600', calc: { expr: '500*1.2', value: 600 } },
        { action: 'אחרי ההוזלה, מ־$600$.', why: 'הוזלה של $20\\%$ היא כפל ב־$0.8$, מהמחיר שלפניה.', result: '600 \\cdot 0.8 = 480', value: '600*0.8' },
      ] },
  ],
  together: [
    { problem: 'מכשירי כתיבה מתוצרת הארץ עולים $300$ ש״ח, ויש עליהם הנחה של $15\\%$. כמה ישלם גיא?',
      steps: [
        { prompt: 'בכמה כופלים את המחיר?', choices: [
          { text: '$0.85$', ok: true, feedback: 'נכון: אחרי הנחה של $15\\%$ נשארים $85\\%$.' },
          { text: '$0.15$', ok: false, feedback: '$0.15$ נותן את ההנחה עצמה, לא את המחיר.' },
          { text: '$1.15$', ok: false, feedback: 'כפל ב־$1.15$ הוא התייקרות. בהנחה המחיר יורד.' },
        ], hints: ['כמה אחוזים מהמחיר נשארים?', '$100\\% - 15\\%$.'], done: 'כופלים ב־$0.85$.' },
      ],
      final: { prompt: 'כמה ישלם גיא?', answer: 255, check: '300*0.85', hints: ['$300 \\cdot 0.85$.', '$300 - 45$.'] } },
    { problem: 'מכשירי כתיבה מיובאים עלו $300$ ש״ח והתייקרו ב־$15\\%$. כמה תשלם מיטל?',
      steps: [
        { prompt: 'בכמה כופלים את המחיר?', choices: [
          { text: '$1.15$', ok: true, feedback: 'נכון: אחרי התייקרות של $15\\%$ המחיר הוא $115\\%$ מהקודם.' },
          { text: '$0.85$', ok: false, feedback: 'כפל ב־$0.85$ הוא הנחה. כאן המחיר עלה.' },
          { text: '$15$', ok: false, feedback: '$15$ הוא האחוז. התייקרות של $15\\%$ היא כפל ב־$1.15$.' },
        ], hints: ['המחיר החדש הוא כמה אחוזים מהקודם?', '$100\\% + 15\\%$.'], done: 'כופלים ב־$1.15$.' },
      ],
      final: { prompt: 'כמה תשלם מיטל?', answer: 345, check: '300*1.15', hints: ['$300 \\cdot 1.15$.', '$300 + 45$.'] } },
  ],
  diag: pct5,
  transfer: pct5T,
  words: ['התייקרות', 'הוזלה', 'הנחה', 'פי $1.2$', 'אחוז השינוי', 'שינוי כפול'],
  misconceptions: [
    { id: 'add-pct', title: 'הוסיפו או הורידו את מספר האחוזים כאילו הוא שקלים',
      cause: 'האחוז נראה כמו מספר שקלים.',
      explain: ['$25\\%$ מ־$80$ הם $20$ שקלים, לא $25$.', 'הנחה של $25\\%$: $80 - 20 = 60$, או $0.75 \\cdot 80 = 60$.'],
      remedy: [
        { kind: 'predict', text: 'חולצה עולה $80$ ש״ח, ויש עליה הנחה של $25\\%$. כמה משלמים?', fig: bar(4, 4, { cross: 1, whole: 80 }), choices: ['$60$', '$55$'], answer: 0,
          why: 'ההנחה היא $25\\%$ מ־$80$, כלומר $20$ שקלים: $80 - 20 = 60$.' },
      ] },
    { id: 'change-only', title: 'ענו את גודל השינוי במקום את המחיר החדש',
      cause: 'חישבנו את השינוי ושכחנו לשאול מה המחיר עכשיו.',
      explain: ['התייקרות של $20\\%$ על $150$ היא $30$ שקלים. המחיר החדש $180$.', 'כפל אחד נותן את המחיר החדש מיד: $150 \\cdot 1.2 = 180$.'],
      remedy: [
        { kind: 'explore', text: 'מחיר של $150$ ש״ח התייקר ב־$20\\%$. הזיזו את הסמן ל־$120\\%$ וקראו את המחיר החדש.',
          manip: moveT(pctLine(10, 5, 150), amount(225, 15, 'ש״ח', 5), 100), answer: 120,
          hint: '$100\\%$ הם $150$. המחיר החדש הוא $120\\%$ ממנו.', success: 'המחיר החדש $180$. השינוי עצמו, $30$, הוא רק $20\\%$.' },
      ] },
    { id: 'additive-changes', title: 'חשבו שהתייקרות והוזלה באותו אחוז מבטלות זו את זו',
      cause: 'נדמה ששני שינויים באותו אחוז מבטלים זה את זה, אבל כל אחד נלקח משלם אחר.',
      explain: ['$+10\\%$ מ־$200$ הם $20$, אבל $-10\\%$ מ־$220$ הם $22$.', 'ולכן $200 \\to 220 \\to 198$: פחות ממה שהיה.'],
      remedy: [
        { kind: 'predict', text: 'מחיר של $200$ ש״ח התייקר ב־$10\\%$, ואחר כך הוזל ב־$10\\%$. כמה הוא עכשיו?', fig: chain(200, 220, 'התייקר ב־10%', 'הוזל ב־10%'),
          choices: ['$198$', '$200$'], answer: 0, why: '$200 \\cdot 1.1 = 220$, ו־$220 \\cdot 0.9 = 198$. ההוזלה נלקחה משלם גדול יותר.' },
      ] },
    { id: 'pct-of-new', title: 'האחוזים חושבו מהמחיר החדש במקום מהמחיר המקורי',
      cause: 'לוקחים את המחיר שלפנינו כשלם, ולא את המחיר שלפני השינוי.',
      explain: ['כרטיס מ־$35$ ל־$38.50$: השינוי $3.50$, מתוך $35$, כלומר $10\\%$.', 'מתוך $38.50$ זה רק $9.1\\%$, וזו לא ההתייקרות.'],
      remedy: [
        { kind: 'predict', text: 'כרטיס התייקר מ־$35$ ל־$38.50$ ש״ח. בכמה אחוזים התייקר?', fig: ticket, choices: ['$10\\%$', 'בערך $9.1\\%$'], answer: 0,
          why: 'משווים למחיר שלפני השינוי: $\\frac{3.5}{35} = 10\\%$.' },
      ] },
  ],
};

export const PCT: StairContent[] = [stair1, stair2, stair3, stair4, stair5];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/pct.js names them all). */
export const CATS_PCT: Record<string, string> = {};
export { pct1, pct1T, pct2, pct2T, pct3, pct3T, pct4, pct4T, pct5, pct5T };
