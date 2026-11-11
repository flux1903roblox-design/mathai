// Signed fractions and decimals (שברים ועשרוניים מכוונים), the sixth stair of the signed-number unit (signed:6). The
// grade 7 programme asks for signed numbers with "שלמים, שברים פשוטים ועשרוניים"; the first five stairs use whole
// numbers. Nothing new is taught about signs: the same number line and the same rules, now with halves, quarters and
// tenths. A negative fraction sits as far from zero as the positive one, on the left; adding with different signs
// subtracts the distances; subtracting a negative adds its opposite.
//
// The diagnostic models are the plan's frac5 and frac5T (content/signed6.js SIGNED6 and SIGNED6T, ported unchanged).
// Every number written here is checked by the lane's verify/facts-signed6.mjs, and the maths of every step by
// learn/content.test.ts. Teaching content: see MADREGOT2.md (content conventions) and content/signed.ts.
import type { DiagModel, FigSpec, StairContent, ManipSpec } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/signed6.js';

/** A number line from..to, each unit cut into den parts; marks at values (labels as TeX), jumps as arcs. */
const nl = (from: number, to: number, den: number, marks: { x: number; label?: string; tone?: 'brand' | 'good' | 'bad' }[] = [], extra: Record<string, unknown> = {}): FigSpec =>
  ({ type: 'numline', from, to, den, marks, ...extra });
/** The object: a number line min..max cut into den parts, the marker starting at `start`; values written as decimals. */
const cut = (min: number, max: number, den: number, start: number): ManipSpec => ({ kind: 'numberline', min, max, from: start, start, den, fmt: 'dec' });

type P6 = { k: 0; a: number; b: number; ai: number; bi: number } | { k: 1; x: number; y: number; xi: number; yi: number };
const signed6: DiagModel<P6> = {
  params: (rnd) => G.SIGNED6.params(rnd),
  text: () => 'חשבו:',
  display: (p) => G.signed6Tex(p),
  answer: (p) => G.SIGNED6.answer(p),
  bugs: G.SIGNED6.bugs,
  solution: (p) => G.signed6Solution(p),
  hint: (p) => G.signed6Hint(p),
  precise: true,
  // decimals are answered as decimals; quarters as fractions
  fmt: (p) => (p.k === 0 ? 'dec' : undefined),
};
type P6T = { ai: number; bi: number };
const signed6T: DiagModel<P6T> = {
  params: (rnd) => G.SIGNED6T.params(rnd),
  text: (p) => G.tempText(p),
  answer: (p) => G.SIGNED6T.answer(p),
  bugs: G.SIGNED6T.bugs,
  solution: (p) => G.tempSolution(p),
  hint: () => 'עלייה בטמפרטורה היא חיבור. סימנים שונים: מחסרים את המרחקים מאפס.',
  unit: 'מעלות',
  precise: true,
  fmt: 'dec',
};

/** -2.5 and the jump of +1.2 that lands on -1.3. */
const jump25 = (end: boolean) => nl(-3, 0, 10, [{ x: -2.5, label: '-2.5' }, ...(end ? [{ x: -1.3, label: '-1.3', tone: 'good' as const }] : [])], { jumps: [{ from: -2.5, to: -1.3, label: '+1.2' }] });

const stair6: StairContent = {
  skill: 'signed:6', topic: 'signed', level: 6, title: 'שברים ועשרוניים מכוונים',
  objectives: [
    'למקם שבר או עשרוני שלילי על הציר, ולמצוא את שני השלמים הקרובים לו.',
    'לחבר, לחסר ולכפול שברים ועשרוניים מכוונים באותם כללים כמו בשלמים.',
  ],
  idea: 'שברים ועשרוניים שליליים מתנהגים כמו שלמים שליליים: אותו ציר, אותם כללי סימנים.',
  why: [
    '$-2.5 + 1.2$: זזים מ־$-2.5$ ימינה $1.2$, ומגיעים ל־$-1.3$. כשהסימנים שונים מחסרים את המרחקים.',
    '$-2.4$ נמצא בין $-3$ ל־$-2$, כי הוא קצת משמאל ל־$-2$.',
  ],
  alt: ['חשבון בנק: חוב של $2.5$ ש״ח ($-2.5$) והפקדה של $1.2$ ש״ח: נשאר חוב של $1.3$ ש״ח.'],
  discover: [
    { kind: 'predict', text: 'בין אילו שני שלמים נמצא $-2.4$?', fig: nl(-4, 0, 10, [{ x: -2.4, label: 'A' }]),
      choices: ['$-3$ ו־$-2$', '$-2$ ו־$-1$'], answer: 0,
      why: '$-2.4$ רחוק מאפס יותר מ־$-2$, ולכן הוא משמאל לו.',
      wrongWhy: { 1: '$-2.4$ הוא $-2$ ועוד $0.4$ שמאלה, לא ימינה: הוא רחוק מאפס יותר מ־$-2$.' } },
    { kind: 'explore', text: 'שימו את הסמן על $-1.75$.', manip: cut(-3, 1, 4, 0), answer: -1.75,
      hint: '$-1.75$ הוא $-1$ ועוד שלושה רבעים שמאלה.',
      success: '$-1.75$ בין $-2$ ל־$-1$, קרוב יותר ל־$-2$.' },
    { kind: 'rule', text: 'שבר שלילי נמצא באותו מרחק מאפס כמו החיובי, בצד השמאלי.', display: '-1.75 < -1.5 < -1',
      why: 'ככל שמספר שלילי רחוק יותר מאפס, הוא קטן יותר.',
      // -2..-1 only, so the three labels have room on a phone
      fig: nl(-2, -1, 4, [{ x: -1.75, label: '-1.75' }, { x: -1.5, label: '-1.5' }, { x: -1, label: '-1' }]) },
    { kind: 'predict', text: '$-2.5 + 1.2 = ?$', fig: jump25(false),
      choices: ['$-1.3$', '$-3.7$', '$1.3$'], answer: 0,
      why: 'סימנים שונים: $2.5 - 1.2 = 1.3$, והסימן של $-2.5$, הרחוק יותר מאפס.',
      wrongWhy: { 1: 'חיברתם את המרחקים. כשהסימנים שונים מחסרים.', 2: 'המרחק נכון, אבל $-2.5$ רחוק יותר מאפס, ולכן התוצאה שלילית.' } },
    { kind: 'explore', text: '$-2.5 + 1.5$: הזיזו את הסמן.', manip: cut(-3, 2, 2, -2.5), answer: -1,
      hint: 'חיבור של חיובי: ימינה.',
      success: '$-2.5 + 1.5 = -1$.' },
    { kind: 'rule', text: 'חיבור עם סימנים שונים: מחסרים את המרחקים, ולוקחים את הסימן של הרחוק יותר מאפס.',
      why: 'זה אותו כלל כמו בשלמים, רק עם חלקים.',
      fig: jump25(true) },
    { kind: 'predict', text: '$-\\frac{3}{4} - \\left(-\\frac{1}{2}\\right) = ?$',
      fig: nl(-1, 0, 4, [{ x: -0.75, label: '-\\frac{3}{4}' }], { jumps: [{ from: -0.75, to: -0.25, label: '+\\frac{1}{2}' }] }),
      choices: ['$-\\frac{1}{4}$', '$-1\\frac{1}{4}$', '$\\frac{1}{4}$'], answer: 0,
      why: 'חיסור של $-\\frac{1}{2}$ הוא חיבור של $\\frac{1}{2}$: $-\\frac{3}{4} + \\frac{2}{4} = -\\frac{1}{4}$.',
      wrongWhy: { 1: 'חיסור של מספר שלילי לא מזיז שמאלה. הוא מזיז ימינה, כמו חיבור של הנגדי.', 2: 'זזים ימינה חצי מ־$-\\frac{3}{4}$, ועדיין לא מגיעים לאפס.' } },
    { kind: 'rule', text: 'חיסור מספר שלילי הוא חיבור של הנגדי שלו, גם בשברים.',
      display: '-\\frac{3}{4} - \\left(-\\frac{1}{2}\\right) = -\\frac{3}{4} + \\frac{1}{2} = -\\frac{1}{4}',
      why: 'אותו "חיסור מבטל חיבור" כמו ב־$5 - (-3) = 8$.',
      fig: nl(-1, 0, 4, [{ x: -0.75, label: '-\\frac{3}{4}' }, { x: -0.25, label: '-\\frac{1}{4}', tone: 'good' }], { jumps: [{ from: -0.75, to: -0.25, label: '+\\frac{1}{2}' }] }) },
  ],
  examples: [
    { problem: 'חשבו:', display: '-3.6 + 1.25', answer: -2.35, check: '-3.6+1.25',
      steps: [
        { action: 'סימנים שונים: מחסרים מרחקים.', why: 'המרחקים מאפס הם $3.6$ ו־$1.25$. משלימים לאותו מספר ספרות: $3.60 - 1.25$.', result: '3.60 - 1.25 = 2.35', calc: { expr: '3.6-1.25', value: 2.35 } },
        { action: 'הסימן של $-3.6$.', why: '$-3.6$ רחוק יותר מאפס, ולכן התוצאה שלילית.', result: '-3.6 + 1.25 = -2.35', value: '-(3.6-1.25)' },
      ] },
    { problem: 'חשבו:', display: '-\\frac{2}{3} - \\frac{1}{4}', answer: -11 / 12, check: '-2/3-1/4',
      steps: [
        { action: 'מכנה משותף: $12$.', why: '$\\frac{2}{3} = \\frac{8}{12}$ ו־$\\frac{1}{4} = \\frac{3}{12}$.', result: '-\\frac{8}{12} - \\frac{3}{12}', value: '-8/12 - 3/12' },
        { action: 'שני המספרים שליליים: מחברים מרחקים ושומרים על המינוס.', why: 'חיסור של חיובי מזיז שמאלה, הרחק מאפס: $8 + 3 = 11$.', result: '-\\frac{11}{12}', value: '-11/12' },
      ] },
    { problem: 'חשבו:', display: '(-0.5) \\cdot (-8)', answer: 4, check: '(-0.5)*(-8)',
      steps: [
        { action: 'כופלים בלי הסימנים.', why: 'חצי מ־$8$.', result: '0.5 \\cdot 8 = 4', calc: { expr: '0.5*8', value: 4 } },
        { action: 'שני שליליים: חיובי.', why: 'סימנים זהים נותנים חיובי, כמו בשלמים.', result: '(-0.5) \\cdot (-8) = 4', value: '4' },
      ] },
  ],
  together: [
    { problem: 'חשבו: $-4.2 + 2.5$.',
      steps: [
        { prompt: 'סימנים שונים. מה עושים עם המרחקים?', choices: [
          { text: 'מחסרים: $4.2 - 2.5$', ok: true, feedback: 'נכון: צעד אחד מרחיק מאפס והשני מקרב.' },
          { text: 'מחברים: $4.2 + 2.5$', ok: false, feedback: 'חיבור המרחקים מתאים רק כשהסימנים שווים.' },
        ], hints: ['לשני המספרים יש סימנים שונים.', 'כשהסימנים שונים, המרחקים מתקזזים: מחסרים.'], done: '$4.2 - 2.5 = 1.7$' },
        { prompt: 'איזה סימן?', choices: [
          { text: 'מינוס: $-4.2$ רחוק יותר מאפס', ok: true, feedback: 'נכון: הרחוק יותר מאפס קובע.' },
          { text: 'פלוס', ok: false, feedback: '$2.5$ קרוב יותר לאפס מ־$-4.2$, ולכן הוא לא קובע את הסימן.' },
        ], hints: ['מי רחוק יותר מאפס, $-4.2$ או $2.5$?', '$4.2 > 2.5$, ולכן הסימן של $-4.2$.'], done: 'התוצאה שלילית.' },
      ],
      final: { prompt: 'כמה יוצא?', answer: -1.7, check: '-4.2+2.5', precise: true, fmt: 'dec', hints: ['המרחק הוא $1.7$, והסימן מינוס.', '$-1.7$'] } },
    { problem: 'חשבו: $-1\\frac{1}{2} - \\left(-2\\frac{3}{4}\\right)$.',
      steps: [
        { prompt: 'חיסור של מספר שלילי:', choices: [
          { text: 'חיבור של הנגדי: $-1\\frac{1}{2} + 2\\frac{3}{4}$', ok: true, feedback: 'נכון: חיסור של $-2\\frac{3}{4}$ הוא חיבור של $2\\frac{3}{4}$.' },
          { text: 'חיסור: $-1\\frac{1}{2} - 2\\frac{3}{4}$', ok: false, feedback: 'זה חיסור של חיובי. כאן מחסרים מספר שלילי, וזה כמו להוסיף את הנגדי שלו.' },
        ], hints: ['מה הנגדי של $-2\\frac{3}{4}$?', 'חיסור של $-2\\frac{3}{4}$ מזיז ימינה $2\\frac{3}{4}$.'], done: '$-1\\frac{1}{2} + 2\\frac{3}{4}$' },
      ],
      final: { prompt: 'כמה יוצא? (שבר או עשרוני)', answer: 1.25, check: '-1.5+2.75', precise: true, hints: ['סימנים שונים: $2\\frac{3}{4} - 1\\frac{1}{2}$.', '$2.75 - 1.5 = 1.25$, והסימן פלוס.'] } },
  ],
  diag: signed6,
  transfer: signed6T,
  words: ['שבר שלילי', 'עשרוני שלילי', 'המספר הנגדי', 'מרחק מאפס', 'השלמים הקרובים'],
  misconceptions: [
    { id: 'abs-add', title: 'חיברו מרחקים כשהסימנים שונים, במקום לחסר', prereq: 'signed:1',
      cause: 'כשהסימנים שונים, צעד אחד מקרב לאפס והשני מרחיק ממנו. המרחקים מתקזזים, גם בעשרוניים.',
      explain: ['$-2.5 + 1.2$: מ־$-2.5$ זזים $1.2$ ימינה, לכיוון האפס.', 'לכן מחסרים: $2.5 - 1.2 = 1.3$, בצד של $-2.5$.'],
      remedy: [
        { kind: 'explore', text: '$-3.5 + 2$: מתחילים ב־$-3.5$ וזזים $2$ ימינה, לכיוון האפס.', manip: cut(-4, 1, 2, -3.5), answer: -1.5,
          hint: 'שני שלמים ימינה מקרבים לאפס.', success: '$-3.5 + 2 = -1.5$. התקרבנו לאפס ב־$2$.' },
        { kind: 'predict', text: 'כמה רחוק מאפס יוצא $4.5 + (-2.5)$?', choices: ['$7$', '$2$'], answer: 1,
          why: 'הצעדים שמאלה מקרבים את $4.5$ לאפס: $4.5 - 2.5 = 2$.' },
      ] },
    { id: 'minus-minus', title: 'חיסור של מספר שלילי חושב כמו חיסור של חיובי', prereq: 'signed:1',
      cause: 'רואים מינוס ליד מינוס וזזים שמאלה. אבל חיסור של מספר שלילי מזיז ימינה, גם כשהוא שבר.',
      explain: ['חיבור של $-\\frac{1}{2}$ מזיז שמאלה חצי. חיסור מבטל חיבור, ולכן חיסור של $-\\frac{1}{2}$ מזיז ימינה חצי.', 'בדיקה: $-\\frac{3}{4} - \\left(-\\frac{1}{2}\\right) = -\\frac{1}{4}$, כי $-\\frac{1}{4} + \\left(-\\frac{1}{2}\\right) = -\\frac{3}{4}$.'],
      remedy: [
        { kind: 'explore', text: '$-\\frac{3}{4} - \\left(-\\frac{1}{2}\\right)$: חיסור של שלילי מזיז ימינה. הזיזו את הסמן.', manip: { kind: 'numberline', min: -2, max: 1, from: -0.75, start: -0.75, den: 4 }, answer: -0.25,
          hint: 'חצי הוא שני רבעים. מ־$-\\frac{3}{4}$ זזים שני רבעים ימינה.', success: '$-\\frac{3}{4} - \\left(-\\frac{1}{2}\\right) = -\\frac{1}{4}$.' },
        { kind: 'predict', text: '$-2.5 - (-1) = ?$', choices: ['$-1.5$', '$-3.5$'], answer: 0,
          why: 'חיסור של $-1$ הוא חיבור של $1$: $-2.5 + 1 = -1.5$.' },
      ] },
    { id: 'sign', title: 'הסימן של התוצאה יצא הפוך',
      cause: 'הגודל חושב נכון, אבל הסימן נקבע לא לפי הכלל.',
      explain: ['המספר יצא נכון, רק הסימן התהפך.', 'בכפל: סימנים זהים נותנים חיובי, סימנים שונים נותנים שלילי, גם בעשרוניים.'],
      remedy: [
        { kind: 'predict', text: 'בלי לחשב: חיובי או שלילי?', display: '(-0.5) \\cdot (-8)', choices: ['חיובי', 'שלילי'], answer: 0,
          why: 'לשני המספרים אותו סימן, ולכן התוצאה חיובית: $(-0.5) \\cdot (-8) = 4$.' },
        { kind: 'predict', text: 'ו־$1.5 \\cdot (-4)$?', choices: ['$-6$', '$6$'], answer: 0,
          why: 'סימנים שונים: התוצאה שלילית. $1.5 \\cdot 4 = 6$, ולכן $-6$.' },
      ] },
    { id: 'toward-zero', title: 'מיקמו שבר שלילי בצד הלא נכון של השלם',
      cause: 'קוראים את $-2.4$ כמו $-2$ ועוד $0.4$ ימינה. אבל $0.4$ הוא חלק מהמרחק מאפס.',
      explain: ['$-2.4$ רחוק מאפס $2.4$: יותר מ־$2$ ופחות מ־$3$.', 'לכן הוא משמאל ל־$-2$, בין $-3$ ל־$-2$.'],
      remedy: [
        { kind: 'explore', text: 'שימו את הסמן על $-2.4$.', manip: cut(-3, 0, 10, 0), answer: -2.4,
          hint: 'מ־$0$ שמאלה: שני שלמים עד $-2$, ועוד $4$ עשיריות.', success: '$-2.4$ בין $-3$ ל־$-2$, משמאל ל־$-2$.' },
      ] },
  ],
};

export const SIGNED6: StairContent[] = [stair6];
/** Names of misconceptions new with this stair: none beyond the topic's own (content/grade7.js names toward-zero). */
export const CATS_SIGNED6: Record<string, string> = {};
export { signed6, signed6T };
