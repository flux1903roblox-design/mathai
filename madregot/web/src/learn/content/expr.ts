// Algebraic expressions (ביטויים אלגבריים), grade 7, in the order of the Ministry's programme (December to February):
// substituting, writing an expression, collecting like terms, the distributive law, simplifying.
// One idea carries the five stairs: a letter holds the place of a number. So an expression is checked by putting a
// number in, two expressions are equal when every number gives the same value, and a rewrite (collecting, opening
// brackets) is right exactly when it never changes the value. The models are those of the algebra plan, with the
// critique's corrections: slip-like predictions are redrawn, the Herscovics–Linchevski detachment (9 − 3x + 2x → 9 − 5x)
// is told apart from a dropped minus (7x − 3x → 10x), and no step teaches a key-word rule.
// Teaching content: see MADREGOT2.md (content conventions) and content/signed.ts (the quality bar).
import type { DiagModel, FigSpec, ManipSpec, StairContent } from '../types';
import { rint, rnz, same } from '../expr';
import { slipLike } from '../misconceptions';
// @ts-ignore: plain JS helpers shared with the exercise generators
import { T } from '@/content/util.js';
// @ts-ignore: plain JS, the same TeX the expression generators print
import { linTex, sumTex, bracketTex } from '@/content/expr.js';

const abs = Math.abs;
/** A number line for a substitution: start at the first number, move by the product. */
const nl = (from: number, min = -10, max = 10): ManipSpec => ({ kind: 'numberline', min, max, from, start: from });
const tiles = (px: number, nx: number, p1: number, n1: number): ManipSpec => ({ kind: 'tiles', start: { px, nx, p1, n1 } });
// the rectangle starts two units high: one unit high, its labels and both handles crowd a strip of 23px
const area = (): ManipSpec => ({ kind: 'area', start: { a: 2, b: 0 }, maxA: 6, maxB: 9 });
/** A table of a pattern: its terms by place (also any small table: a check with a number, who has what). */
const table = (head: string[], rows: (number | string)[][]) => ({ type: 'table' as const, head, rows });
/** Still tiles (the picture of the tiles object): x, −x, 1 and −1; a row holds 5 long tiles and 8 small ones. */
const still = (px: number, nx: number, p1: number, n1: number): FigSpec => ({ type: 'tiles', px, nx, p1, n1 });
/** A substitution as a machine: the number goes in, the expression is the rule, its value comes out ('?' when asked). */
const machine = (inX: number, rule: string, outY: number | string): FigSpec => ({ type: 'machine', inX, rule, outY });
/** Different a and b with the same sum: what the brackets hold is one number. */
const SUM_TABLE = table(['a', 'b', 'a + b'], [[-1, -3, -4], [1, -5, -4], [-6, 2, -4]]);

/**
 * Draws until no misconception of the model predicts what a slip of the hand gives (one off, ten off, two digits
 * swapped), itself or typed rounded (418.95 as 419 when the answer is 420): diagnose() reads a matching prediction
 * before a slip, so such a draw would turn a slip into evidence.
 */
function fair<P>(draw: () => P, answer: (p: P) => number, bugs: Record<string, (p: P) => number | null>): P {
  for (;;) {
    const p = draw(); const a = answer(p);
    if (Object.values(bugs).every((f) => { const v = f(p); return v == null || same(v, a) || !slipLike(v, a); })) return p;
  }
}

// ================================================================ stair 1: substituting (הצבה בביטוי)

type Sub = { f: number; a: number; b: number; x: number }; // f 0: b + ax, 1: b − ax
const subShow = (p: Sub) => `${T(p.b)} ${p.f ? '-' : '+'} ${p.a}x`;
const subWith = (p: Sub, prod: number) => (p.f ? p.b - prod : p.b + prod);
const subValue = (p: Sub) => subWith(p, p.a * p.x);
const subBugs: Record<string, (p: Sub) => number | null> = {
  // 3x at x = 4 read as the number 34 (the Ministry's curriculum warns of exactly this, algebra_7 note 10)
  concat: (p) => (p.x >= 1 && p.x <= 9 ? subWith(p, 10 * p.a + p.x) : null),
  // left to right, without multiplication first: (b ± a)·x
  order: (p) => (p.f ? (p.b - p.a) * p.x : (p.b + p.a) * p.x),
  // a negative value put in without brackets: its minus is lost
  'neg-sub': (p) => (p.x < 0 ? subWith(p, p.a * -p.x) : null),
};
const substModel: DiagModel<Sub> = {
  params: (rnd) => fair(() => ({ f: rint(rnd, 0, 1), a: rint(rnd, 2, 9), b: rnz(rnd, -12, 12), x: rnz(rnd, -6, 9) }), subValue, subBugs),
  text: (p) => `מה ערך הביטוי כש־$x = ${T(p.x)}$?`,
  display: subShow,
  answer: subValue,
  bugs: subBugs,
  solution: (p) => [
    `מציבים${p.x < 0 ? ' בסוגריים' : ''}: $${T(p.b)} ${p.f ? '-' : '+'} ${p.a} \\cdot ${T(p.x, true)}$`,
    `קודם הכפל: $${p.a} \\cdot ${T(p.x, true)} = ${T(p.a * p.x)}$`,
    `אחר כך: $${T(p.b)} ${p.f ? '-' : '+'} ${T(p.a * p.x, true)} = ${T(subValue(p))}$`,
  ],
  hint: (p) => (p.x < 0 ? `מציבים את $${T(p.x)}$ בסוגריים, ואחר כך כפל לפני חיבור וחיסור.` : `$${p.a}x$ הוא $${p.a} \\cdot x$. אחרי ההצבה: קודם הכפל.`),
};

type Ride = { a: number; b: number; n: number };
const rideBugs: Record<string, (p: Ride) => number | null> = {
  order: (p) => (p.b + p.a) * p.n,
  concat: (p) => p.b + 10 * p.a + p.n,
};
const rideModel: DiagModel<Ride> = {
  // the same skill in a context: the expression of a price, and one value of it
  params: (rnd) => fair(() => ({ a: rint(rnd, 2, 9), b: rint(rnd, 5, 15), n: rint(rnd, 2, 9) }), (p) => p.b + p.a * p.n, rideBugs),
  text: (p) => `נסיעה במונית של $n$ קילומטרים עולה $${p.b} + ${p.a}n$ שקלים. כמה עולה נסיעה של $${p.n}$ קילומטרים?`,
  answer: (p) => p.b + p.a * p.n,
  bugs: rideBugs,
  solution: (p) => [`מציבים $n = ${p.n}$: $${p.b} + ${p.a} \\cdot ${p.n}$`, `קודם הכפל: $${p.a} \\cdot ${p.n} = ${p.a * p.n}$`, `$${p.b} + ${p.a * p.n} = ${p.b + p.a * p.n}$ ₪`],
  hint: (p) => `$${p.a}n$ הוא $${p.a}$ שקלים לכל קילומטר. כמה זה ל־$${p.n}$ קילומטרים? ואחר כך מוסיפים את $${p.b}$.`,
  unit: '₪',
};

const stair1: StairContent = {
  skill: 'expr:1', topic: 'expr', level: 1, title: 'הצבה בביטוי',
  objectives: [
    'להבין שאות מחזיקה מקום למספר שיכול להשתנות.',
    'להציב מספר, גם שלילי, בביטוי, ולחשב לפי סדר הפעולות.',
    'לקרוא את $3x$ כ־$3 \\cdot x$.',
  ],
  idea: 'האות היא מקום שמור למספר. כשמציבים מספר במקומה, הביטוי הופך לתרגיל חשבון.',
  why: [
    '$3x$ הוא קיצור של $3 \\cdot x$. אחרי ההצבה סדר הפעולות לא משתנה: כפל לפני חיבור.',
    'מספר שלילי מציבים בסוגריים, כי הסימן שלו הוא חלק מהמספר.',
  ],
  alt: [
    'מחברת עולה $7$ ₪. שלוש מחברות עולות $7 \\cdot 3$, ועשר מחברות $7 \\cdot 10$. מספר כלשהו של מחברות, $n$, עולה $7n$: האות אומרת "כל מספר שתבחרו".',
    'אפשר לחשוב על ביטוי כמו על מכונה: נכנס מספר, והביטוי אומר מה לעשות בו. $5 + 3x$ אומר: כפלו ב־$3$, ואז הוסיפו $5$.',
  ],
  discover: [
    { kind: 'say', fig: { type: 'table', head: ['מחברות', 'מחיר בשקלים'], rows: [[1, '7 · 1'], [2, '7 · 2'], [3, '7 · 3'], ['n', '7n']], anim: true }, mood: 'happy', text: 'מחברת עולה $7$ ₪, ולכן $3$ מחברות עולות $7 \\cdot 3$. במקום מספר אפשר לכתוב אות: $n$ מחברות עולות $7n$.', display: '7n = 7 \\cdot n' },
    { kind: 'predict', fig: machine(5, '2x', '?'), text: 'כמה זה $2x$ כש־$x = 5$?', choices: ['$25$', '$10$', '$7$'], answer: 1,
      why: '$2x$ פירושו $2 \\cdot x$. כש־$x = 5$: $2 \\cdot 5 = 10$.',
      wrongWhy: { 0: '$25$ יוצא כשכותבים את $2$ ואת $5$ זה ליד זה. אבל מספר ליד אות כופל אותה.', 2: '$7$ הוא $2 + 5$. מספר ליד אות כופל, לא מחבר.' } },
    { kind: 'predict', fig: machine(4, '5 + 3x', '?'), text: 'כמה זה $5 + 3x$ כש־$x = 4$?', choices: ['$17$', '$32$', '$39$'], answer: 0,
      why: 'מציבים: $5 + 3 \\cdot 4$. קודם הכפל, $3 \\cdot 4 = 12$, ואז $5 + 12 = 17$.',
      wrongWhy: { 1: '$32$ הוא $(5 + 3) \\cdot 4$, חישוב משמאל לימין. אבל כפל קודם לחיבור.', 2: '$39$ יוצא כשקוראים את $3x$ כמו $34$. אבל $3x$ הוא $3 \\cdot 4$.' } },
    { kind: 'rule', fig: machine(4, '5 + 3x', 17), text: 'הצבה: שמים את המספר במקום האות, ומחשבים לפי סדר הפעולות.', display: 'x = 4:\\quad 5 + 3 \\cdot 4 = 17',
      why: 'אחרי שהמספר נכנס במקום האות, זה תרגיל רגיל. כותבים את סימן הכפל שהיה מוסתר, וכפל קודם לחיבור.' },
    { kind: 'predict', fig: machine(-3, '10 - 2x', '?'), text: 'ומספר שלילי? כמה זה $10 - 2x$ כש־$x = -3$?', choices: ['$16$', '$4$', '$-24$'], answer: 0,
      why: 'מציבים בסוגריים: $10 - 2 \\cdot (-3)$, כלומר $10 - (-6) = 16$.',
      wrongWhy: { 1: '$4$ הוא $10 - 2 \\cdot 3$: המינוס של $-3$ נעלם. מספר שלילי מציבים בסוגריים.', 2: '$-24$ הוא $(10 - 2) \\cdot (-3)$, חישוב משמאל לימין. כפל קודם לחיסור.' } },
    { kind: 'explore', text: 'נראה את זה על הציר: $3 + 2x$ כש־$x = -2$. מתחילים ב־$3$ וזזים $2 \\cdot (-2)$.', display: '3 + 2 \\cdot (-2)', manip: nl(3), answer: -1,
      hint: '$2 \\cdot (-2) = -4$: ארבעה צעדים שמאלה מ־$3$.', success: '$3 + 2 \\cdot (-2) = 3 + (-4) = -1$. הכפל אמר כמה לזוז, והסימן שלו אמר לאן.' },
    { kind: 'rule', fig: { type: 'numline', from: -6, to: 6, jumps: [{ from: 3, to: -1, label: '2 · (−2)' }] }, text: 'מספר שלילי מציבים בסוגריים.', display: '3 + 2 \\cdot (-2) = -1',
      why: 'המינוס הוא חלק מהמספר. בלי סוגריים קל לאבד אותו, ואז יוצא $3 + 2 \\cdot 2 = 7$ במקום $-1$.' },
    { kind: 'say', text: 'לביטוי אחד יש הרבה ערכים: כל מספר שמציבים נותן ערך משלו. כך נראה $3x + 1$:', fig: table(['x', 'ערך הביטוי'], [[-1, -2], [0, 1], [1, 4], [2, 7], [3, 10]]) },
  ],
  examples: [
    { problem: 'מה ערך הביטוי כש־$x = 5$?', display: '4 + 3x', answer: 19, check: '4 + 3*5',
      steps: [
        { action: 'מציבים $5$ במקום $x$.', why: '$3x$ הוא $3 \\cdot x$, ולכן במקום $x$ בא $5$, עם סימן הכפל.', result: '4 + 3 \\cdot 5', value: '4 + 3*5' },
        { action: 'קודם הכפל.', why: 'כפל קודם לחיבור, גם אחרי הצבה.', result: '3 \\cdot 5 = 15', calc: { expr: '3*5', value: 15 } },
        { action: 'עכשיו החיבור.', why: 'נשאר תרגיל חיבור.', result: '4 + 15 = 19', value: '4 + 15' },
      ] },
    { problem: 'ליטר דלק עולה $7$ ₪, ובלילה יש עמלה קבועה של $2$ ₪. לכן $b$ ליטרים בלילה עולים $7b + 2$ ₪. כמה עולים $40$ ליטרים בלילה?', display: '7b + 2', answer: 282, check: '7*40 + 2',
      steps: [
        { action: 'מציבים $40$ במקום $b$.', why: '$b$ הוא מספר הליטרים.', result: '7 \\cdot 40 + 2', value: '7*40 + 2' },
        { action: 'כופלים: המחיר של $40$ ליטרים.', why: 'כל ליטר עולה $7$ ₪.', result: '7 \\cdot 40 = 280', calc: { expr: '7*40', value: 280 } },
        { action: 'מוסיפים את העמלה.', why: 'העמלה משולמת פעם אחת, לא על כל ליטר.', result: '280 + 2 = 282', value: '280 + 2' },
      ] },
    { problem: 'מה ערך הביטוי כש־$x = -3$?', display: '10 - 2x', answer: 16, check: '10 - 2*(-3)',
      steps: [
        { action: 'מציבים בסוגריים.', why: 'הסימן של $-3$ שייך למספר. בלי סוגריים היה נראה $10 - 2 \\cdot 3$.', result: '10 - 2 \\cdot (-3)', value: '10 - 2*(-3)' },
        { action: 'קודם הכפל.', why: 'חיובי כפול שלילי נותן שלילי.', result: '2 \\cdot (-3) = -6', calc: { expr: '2*(-3)', value: -6 } },
        { action: 'חיסור של מספר שלילי הוא חיבור.', why: '$10 - (-6) = 10 + 6$.', result: '10 - (-6) = 16', value: '10 - (-6)' },
      ] },
  ],
  together: [
    { problem: 'נחשב יחד את ערך הביטוי כש־$x = -2$.', display: '6 - 4x',
      steps: [
        { prompt: 'איך מציבים?', choices: [
          { text: '$6 - 4 \\cdot (-2)$', ok: true, feedback: 'נכון: המספר השלילי נכנס בסוגריים, עם סימן הכפל.' },
          { text: '$6 - 4 \\cdot 2$', ok: false, feedback: 'המינוס של $-2$ נעלם. מספר שלילי מציבים בסוגריים.' },
          { text: '$6 - 4 - 2$', ok: false, feedback: 'כך $4x$ הפך לחיסור. אבל $4x$ הוא $4 \\cdot x$.' },
        ], hints: ['מה כתוב באמת ב־$4x$?', '$4x$ הוא $4 \\cdot x$, ו־$-2$ נכנס בסוגריים: $4 \\cdot (-2)$.'], done: '$6 - 4 \\cdot (-2)$' },
        { prompt: 'מה מחשבים קודם?', choices: [
          { text: 'את הכפל: $4 \\cdot (-2) = -8$', ok: true, feedback: 'נכון: כפל קודם לחיסור.' },
          { text: 'את החיסור: $6 - 4 = 2$', ok: false, feedback: 'משמאל לימין היה יוצא $2 \\cdot (-2) = -4$. אבל כפל קודם לחיסור.' },
          { text: 'את הכפל: $4 \\cdot (-2) = 8$', ok: false, feedback: 'חיובי כפול שלילי נותן שלילי: $-8$.' },
        ], hints: ['איזו פעולה קודמת, כפל או חיסור?', 'כפל קודם: $4 \\cdot (-2)$. סימנים שונים נותנים שלילי.'], done: '$4 \\cdot (-2) = -8$, ונשאר $6 - (-8)$.' },
      ],
      final: { prompt: 'כמה זה $6 - (-8)$? כתבו את ערך הביטוי.', answer: 14, check: '6 - 4*(-2)', hints: ['חיסור של מספר שלילי הוא חיבור.', '$6 - (-8) = 6 + 8$.'] } },
    { problem: 'ועכשיו ביטוי עם סוגריים, כש־$x = -1$.', display: '3(x + 5)',
      steps: [
        { prompt: 'מה עושים קודם?', choices: [
          { text: 'מחשבים את הסוגריים: $-1 + 5 = 4$', ok: true, feedback: 'נכון: סוגריים קודם.' },
          { text: 'כופלים $3 \\cdot (-1)$ ומוסיפים $5$', ok: false, feedback: 'כך חישבתם $3x + 5$, ויוצא $2$. ה־$3$ כופל את כל הסוגריים.' },
          { text: 'מחברים $3 + (-1)$', ok: false, feedback: '$3(x + 5)$ הוא $3$ כפול הסוגריים, לא $3$ ועוד משהו.' },
        ], hints: ['מה כתוב בתוך הסוגריים, ומה מחוץ להם?', 'בתוך הסוגריים: $-1 + 5$. אחר כך כופלים ב־$3$.'], done: '$x + 5 = -1 + 5 = 4$' },
      ],
      final: { prompt: 'מה ערך הביטוי?', answer: 12, check: '3*(-1 + 5)', hints: ['הסוגריים שווים $4$.', '$3 \\cdot 4$.'] } },
  ],
  diag: substModel,
  transfer: rideModel,
  misconceptions: [
    { id: 'concat', title: '$3x$ נקרא כמספר דו־ספרתי',
      cause: 'בחשבון ספרות צמודות יוצרות מספר: $3$ ו־$4$ הם $34$. באלגברה מספר צמוד לאות כופל אותה.',
      explain: ['נראה ש־$3x$ נקרא כמו מספר בן שתי ספרות.', '$3x$ הוא קיצור של $3 \\cdot x$. כש־$x = 4$: $3 \\cdot 4 = 12$, ולא $34$.'],
      remedy: [
        { kind: 'predict', text: 'כמה זה $3x$ כש־$x = 4$?', choices: ['$34$', '$12$', '$7$'], answer: 1,
          why: '$3x = x + x + x$. כש־$x = 4$: $4 + 4 + 4 = 12$.',
          wrongWhy: { 0: '$34$ הוא שלושים וארבע. אבל $3x$ הוא שלוש פעמים $x$.', 2: '$7$ הוא $3 + 4$. מספר ליד אות כופל, לא מחבר.' } },
        { kind: 'rule', text: 'מספר צמוד לאות כופל אותה.', display: '3x = 3 \\cdot x = x + x + x',
          why: 'כך כותבים כפל באלגברה בלי סימן. כשמציבים מספר, מחזירים את סימן הכפל: $3 \\cdot 4$.' },
        { kind: 'predict', text: 'כמה זה $5x$ כש־$x = 2$?', choices: ['$52$', '$10$', '$7$'], answer: 1, why: '$5 \\cdot 2 = 10$.' },
      ] },
    { id: 'order', title: 'חישוב משמאל לימין, בלי כפל קודם',
      cause: 'אחרי ההצבה רואים תרגיל ארוך, וקל לחשב אותו לפי הסדר שבו הוא כתוב.',
      explain: ['נראה שחישבתם משמאל לימין.', 'אחרי ההצבה סדר הפעולות לא משתנה: קודם כפל, אחר כך חיבור. $2 + 5 \\cdot 3 = 2 + 15 = 17$.'],
      prereq: 'signed:4',
      remedy: [
        { kind: 'predict', text: 'כמה זה $2 + 5x$ כש־$x = 3$?', choices: ['$17$', '$21$'], answer: 0,
          why: '$5x$ הוא $5 \\cdot 3 = 15$, ו־$2 + 15 = 17$.', wrongWhy: { 1: '$21$ הוא $(2 + 5) \\cdot 3$: חישוב משמאל לימין.' } },
        { kind: 'explore', text: 'מתחילים ב־$2$ ומוסיפים $5 \\cdot 3$. לאן מגיעים?', display: '2 + 5 \\cdot 3', manip: nl(2, 0, 20), answer: 17,
          hint: '$5 \\cdot 3 = 15$: חמישה־עשר צעדים ימינה מ־$2$.', success: '$2 + 5 \\cdot 3 = 17$. הכפל אומר כמה לזוז, ולכן מחשבים אותו קודם.' },
      ] },
    { id: 'neg-sub', title: 'מספר שלילי הוצב בלי סוגריים',
      cause: 'כשכותבים מספר שלילי בלי סוגריים, המינוס שלו נראה כמו חיסור, ונעלם בחישוב.',
      explain: ['נראה שהמינוס של המספר שהצבתם נעלם.', 'מציבים מספר שלילי בסוגריים: $8 - 3 \\cdot (-2) = 8 - (-6) = 14$.'],
      prereq: 'signed:3',
      remedy: [
        { kind: 'predict', text: 'כמה זה $8 - 3x$ כש־$x = -2$?', choices: ['$14$', '$2$'], answer: 0,
          why: '$3 \\cdot (-2) = -6$, ו־$8 - (-6) = 14$.', wrongWhy: { 1: '$2$ הוא $8 - 3 \\cdot 2$: המינוס של $-2$ נעלם.' } },
        { kind: 'explore', text: 'מתחילים ב־$8$. $3 \\cdot (-2) = -6$, ומחסרים אותו. חיסור של שלילי מזיז ימינה.', display: '8 - 3 \\cdot (-2)', manip: nl(8, 0, 20), answer: 14,
          hint: 'חיסור של $-6$ הוא חיבור של $6$: שישה צעדים ימינה.', success: '$8 - 3 \\cdot (-2) = 8 + 6 = 14$.' },
      ] },
    // two more readings of ax that the stair's choice question offers (content/expr.js substMc, FOLLOWUP-36)
    { id: 'plus', title: '$3x$ נקרא כחיבור',
      cause: 'בחשבון יש מקומות שבהם מה שכתוב צמוד מתחבר: $2\\frac{1}{2}$ הוא $2 + \\frac{1}{2}$. באלגברה מספר צמוד לאות כופל אותה.',
      explain: ['נראה ש־$3x$ נקרא כמו $3 + x$.', '$3x$ הוא $3 \\cdot x$, שלוש פעמים $x$. כש־$x = 4$: $3 \\cdot 4 = 12$, ולא $3 + 4 = 7$.'],
      remedy: [
        { kind: 'predict', text: 'כמה זה $5x$ כש־$x = 2$?', choices: ['$7$', '$10$'], answer: 1,
          why: '$5x$ הוא חמש פעמים $x$: $2 + 2 + 2 + 2 + 2 = 10$.', wrongWhy: { 0: '$7$ הוא $5 + 2$. מספר ליד אות כופל אותה, לא מתחבר אליה.' } },
        { kind: 'rule', text: 'מספר צמוד לאות כופל אותה, לא מתחבר אליה.', display: '4x = x + x + x + x = 4 \\cdot x',
          why: 'ארבע פעמים $x$. כש־$x = 3$: $3 + 3 + 3 + 3 = 12$, וזה $4 \\cdot 3$.' },
        { kind: 'predict', text: 'כמה זה $2x$ כש־$x = 6$?', choices: ['$12$', '$8$'], answer: 0,
          why: 'פעמיים $6$: $2 \\cdot 6 = 12$.', wrongWhy: { 1: '$8$ הוא $2 + 6$: חיבור במקום כפל.' } },
      ] },
    { id: 'coef', title: 'המספר שלפני $x$ נשכח',
      cause: 'כשמציבים, קל לשים את המספר במקום כל ה־$3x$ ולא רק במקום ה־$x$, וכך ה־$3$ נעלם.',
      explain: ['נראה שה־$3$ שלפני $x$ נשכח בהצבה.', 'המספר בא רק במקום האות, וה־$3$ נשאר וכופל אותו: כש־$x = 4$, $3x = 3 \\cdot 4 = 12$, ולא $4$.'],
      remedy: [
        { kind: 'predict', text: 'כמה זה $6x$ כש־$x = 2$?', choices: ['$2$', '$12$'], answer: 1,
          why: 'מציבים $2$ במקום $x$, וה־$6$ נשאר: $6 \\cdot 2 = 12$.', wrongWhy: { 0: '$2$ הוא רק $x$. ה־$6$ שלפני האות אומר לכפול ב־$6$.' } },
        { kind: 'rule', text: 'מציבים את המספר רק במקום האות. המספר שלפניה נשאר.', display: '6x = 6 \\cdot x',
          why: 'ה־$6$ אומר כמה פעמים לקחת את $x$. כש־$x = 2$: $6 \\cdot 2 = 12$.' },
      ] },
  ],
};

// ================================================================ stair 2: writing an expression (כותבים ביטוי)

type Pat = { s: number; d: number; k: number; m: number; n: number }; // f(1) = s, step d; f(k) known; ask f(n), n = k·m
const patAt = (p: { s: number; d: number }, i: number) => p.s + p.d * (i - 1);
const patBugs: Record<string, (p: Pat) => number | null> = {
  // n steps counted from the first term instead of n − 1 (the Ministry exam's own distractor 10 + 3n)
  'start-n': (p) => p.s + p.d * p.n,
  // the step times n, the start forgotten (Stacey 1989, "the difference method")
  'diff-only': (p) => p.d * p.n,
  // a known term scaled: f(n) = m·f(k) (Stacey 1989, "whole object")
  'whole-object': (p) => p.m * patAt(p, p.k),
};
const patDraw = (rnd: () => number): Pat => {
  for (;;) {
    const s = rint(rnd, 2, 15); const d = rint(rnd, 2, 9);
    if (s === d) continue;
    const k = rint(rnd, 2, 5); const m = rint(rnd, 2, 6);
    return { s, d, k, m, n: k * m };
  }
};
const patRows = (p: Pat) => [1, 2, 3, ...(p.k > 3 ? [p.k] : [])].map((i) => [i, patAt(p, i)]);
const patSolution = (p: Pat) => [
  `הצעד: $${patAt(p, 2)} - ${p.s} = ${p.d}$.`,
  `מהאיבר הראשון עד האיבר ה־$${p.n}$ יש $${p.n} - 1 = ${p.n - 1}$ צעדים.`,
  `$${p.s} + ${p.d} \\cdot ${p.n - 1} = ${patAt(p, p.n)}$`,
];
const patternModel: DiagModel<Pat> = {
  params: (rnd) => fair(() => patDraw(rnd), (p) => patAt(p, p.n), patBugs),
  text: (p) => `בטבלה איברים של סדרה, ובכל צעד מוסיפים אותו מספר. מה האיבר ה־$${p.n}$?`,
  fig: (p) => table(['מקום', 'איבר'], patRows(p)),
  answer: (p) => patAt(p, p.n),
  bugs: patBugs,
  solution: patSolution,
  hint: () => 'מהאיבר הראשון עד האיבר ה־$n$ יש $n - 1$ צעדים, לא $n$.',
};
const savingsModel: DiagModel<Pat> = {
  // the same pattern as a story with its own table: months of savings
  params: (rnd) => fair(() => patDraw(rnd), (p) => patAt(p, p.n), patBugs),
  text: (p) => `בחודש הראשון היו בחיסכון של יואב $${p.s}$ ₪, ובכל חודש הוא מוסיף $${p.d}$ ₪. כמה ₪ יהיו בחיסכון בחודש ה־$${p.n}$?`,
  fig: (p) => table(['חודש', 'בחיסכון (₪)'], patRows(p)),
  answer: (p) => patAt(p, p.n),
  bugs: patBugs,
  solution: (p) => [`בחודש הראשון $${p.s}$ ₪. עד החודש ה־$${p.n}$ עוברים עוד $${p.n - 1}$ חודשים.`, `$${p.s} + ${p.d} \\cdot ${p.n - 1} = ${patAt(p, p.n)}$ ₪`],
  hint: (p) => `בחודש הראשון כבר יש $${p.s}$ ₪. כמה פעמים מוסיפים $${p.d}$ עד החודש ה־$${p.n}$?`,
  unit: '₪',
};

const MATCH_HEAD: [string, string] = ['צורה', 'גפרורים'];
const stair2: StairContent = {
  skill: 'expr:2', topic: 'expr', level: 2, title: 'כותבים ביטוי',
  objectives: [
    'לכתוב ביטוי אלגברי שמתאר מצב או חוקיות.',
    'לחשב איבר רחוק בסדרה בעזרת ביטוי.',
    'לבדוק ביטוי בהצבה של מקרה שאנחנו מכירים.',
  ],
  idea: 'ביטוי אלגברי הוא כלל שעובד לכל מספר. כותבים אותו מהמקרים הקטנים, ובודקים אותו במקרה שאנחנו מכירים.',
  why: [
    'בסדרה שמתחילה ב־$s$ ומוסיפה $d$ בכל צעד, מהאיבר הראשון עד האיבר ה־$n$ עושים $n - 1$ צעדים.',
    'אותו מצב אפשר לתאר בכמה ביטויים, כמו $4 + 3(n - 1)$ ו־$3n + 1$. בודקים שהם נותנים אותם מספרים.',
  ],
  alt: [
    'ריבועים מגפרורים: לריבוע הראשון $4$ גפרורים, וכל ריבוע נוסף מוסיף $3$. בביטוי $4 + 3(n - 1)$ רואים את ה־$4$ של ההתחלה ואת ה־$3$ שחוזר.',
    'מספר ממשפט: "לדוד $6$ ספרים יותר מלעמית". בוחרים מספר לעמית, למשל $5$, ומחשבים לפי הסיפור: לדוד $11$. הביטוי הנכון נותן $11$.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', fig: { ...table(MATCH_HEAD, [[1, 4], [2, 7], [3, 10]]), anim: true }, text: 'בונים שורה של ריבועים מגפרורים. לריבוע הראשון צריך $4$ גפרורים, וכל ריבוע נוסף מוסיף $3$.' },
    { kind: 'predict', fig: table(MATCH_HEAD, [[1, 4], [2, 7], [3, 10]]), text: 'כמה גפרורים יש בצורה ה־$10$?', choices: ['$31$', '$40$', '$30$'], answer: 0,
      why: 'מהצורה הראשונה עד הצורה ה־$10$ יש $9$ צעדים: $4 + 3 \\cdot 9 = 31$.',
      wrongWhy: { 1: '$40$ הוא $10 \\cdot 4$, כאילו כל ריבוע בנוי לבד. אבל ריבוע חדש משתמש בצלע של הקודם, ולכן מוסיף רק $3$.', 2: '$30$ הוא $10 \\cdot 3$: הצורה הראשונה התחילה ב־$4$, לא ב־$3$.' } },
    { kind: 'rule', fig: table(MATCH_HEAD, [[1, '4'], [2, '4 + 3'], [3, '4 + 3 · 2'], ['n', '4 + 3(n − 1)']]), text: 'האיבר ה־$n$: ההתחלה, ועוד $n - 1$ צעדים.', display: '4 + 3(n - 1)',
      why: 'מהאיבר הראשון לשני יש צעד אחד, לשלישי שני צעדים, ולאיבר ה־$n$ יש $n - 1$ צעדים.' },
    { kind: 'predict', fig: { type: 'table', head: ['צורה', 'מאיה', 'דן'], rows: [[1, 4, 4], [2, 7, 7], [3, 10, 10], [10, 31, 31]] },
      text: 'מאיה כתבה $4 + 3(n - 1)$, ודן כתב $3n + 1$. בטבלה מה שכל ביטוי נותן. מי צודק?', choices: ['מאיה', 'דן', 'שניהם'], answer: 2,
      why: 'בכל הצורות שבדקנו הם שווים. בחוק הפילוג נראה שזה תמיד כך: $4 + 3(n - 1) = 3n + 1$.',
      wrongWhy: { 0: 'גם הביטוי של דן נותן בדיוק את המספרים של הגפרורים.', 1: 'גם הביטוי של מאיה נותן בדיוק את המספרים של הגפרורים.' } },
    { kind: 'predict', fig: table(['יום', 'גובה בס״מ'], [[1, 10], [2, 13], [3, 16], ['n', '?']]), text: 'צמח גבוה $10$ ס״מ ביום הראשון, וגדל $3$ ס״מ בכל יום. איזה ביטוי נותן את הגובה ביום ה־$n$?',
      choices: ['$10 + 3(n - 1)$', '$10 + 3n$', '$30n$'], answer: 0,
      why: 'בודקים ביום הראשון, $n = 1$: $10 + 3 \\cdot 0 = 10$. נכון. $10 + 3n$ נותן $13$, ו־$30n$ נותן $30$.',
      wrongWhy: { 1: 'ביום הראשון $10 + 3n$ נותן $13$. אבל ביום הראשון הצמח עוד לא גדל.', 2: 'ביום הראשון $30n$ נותן $30$, ולא $10$.' } },
    { kind: 'say', fig: table(['מי', 'כמה ספרים'], [['עמית', 'x'], ['יובל', '2x']]), text: 'ביטוי כותבים גם ממשפט. לעמית יש $x$ ספרים, וליובל יש פי $2$ ממה שיש לעמית, כלומר $2x$ ספרים.' },
    { kind: 'predict', fig: table(['מי', 'כמה ספרים'], [['עמית', 'x'], ['יובל', '2x'], ['דוד', '?']]), text: 'לדוד יש $6$ ספרים יותר מלעמית. כמה ספרים יש לדוד?', choices: ['$x + 6$', '$6x$', '$x - 6$'], answer: 0,
      why: 'בודקים במספר: אם לעמית $5$ ספרים, לדוד $11$. הביטוי $x + 6$ נותן $11$, ו־$6x$ נותן $30$.',
      wrongWhy: { 1: '$6x$ הוא פי $6$. אם לעמית $5$ ספרים, לדוד היו $30$, ולא $11$.', 2: '$x - 6$ נותן פחות ממה שיש לעמית, אבל לדוד יש יותר.' } },
    { kind: 'rule', fig: { type: 'table', head: ['מי', 'כמה ספרים', 'x = 5'], rows: [['עמית', 'x', 5], ['יובל', '2x', 10], ['דוד', 'x + 6', 11]] }, text: 'כותבים ביטוי, ובודקים אותו במספר.', display: 'x = 5:\\quad x + 6 = 11',
      why: 'אם לעמית $5$ ספרים, לפי הסיפור לדוד $11$, ו־$x + 6$ נותן $11$. בדיקה במספר תופסת ביטוי שנכתב הפוך.' },
  ],
  examples: [
    { problem: 'בשורת הריבועים מגפרורים, בצורה ה־$n$ יש $4 + 3(n - 1)$ גפרורים. כמה גפרורים יש בצורה ה־$25$?', display: '4 + 3(n - 1)', answer: 76, check: '4 + 3*24',
      steps: [
        { action: 'סופרים צעדים מהצורה הראשונה עד הצורה ה־$25$.', why: 'הצורה הראשונה כבר בנויה, וכל צעד מוסיף $3$ גפרורים.', result: '25 - 1 = 24', calc: { expr: '25 - 1', value: 24 } },
        { action: 'מוסיפים להתחלה $24$ צעדים של $3$.', why: 'בצורה הראשונה $4$ גפרורים.', result: '4 + 3 \\cdot 24 = 76', value: '4 + 3*24' },
        { action: 'בודקים בביטוי השני, $3n + 1$.', why: 'שני ביטויים שמתארים אותו דבר נותנים אותו מספר.', result: '3 \\cdot 25 + 1 = 76', value: '3*25 + 1' },
      ] },
    { problem: 'לעמית יש $x$ ספרים. ליובל יש פי $2$ ממה שיש לעמית, ולדוד יש $6$ ספרים יותר מלעמית. כתבו ביטוי למספר הספרים של שלושתם.',
      expr: 'x + 2*x + (x + 6)', answerTex: 'x + 2x + (x + 6)', answer: 26, check: '5 + 2*5 + (5 + 6)',
      steps: [
        { action: 'כותבים כמה ספרים יש לכל אחד.', why: 'לעמית $x$. ליובל פי $2$: $2x$. לדוד $6$ יותר: $x + 6$.', result: 'x,\\quad 2x,\\quad x + 6' },
        { action: 'מחברים את שלושתם.', why: 'כמה יש לכולם יחד הוא סכום.', result: 'x + 2x + (x + 6)', ident: 'x + 2*x + (x + 6)' },
        { action: 'בודקים במספר: נניח שלעמית $5$ ספרים.', why: 'אז ליובל $10$ ולדוד $11$, ויחד $26$. הביטוי צריך לתת $26$.', result: '5 + 10 + 11 = 26', value: '5 + 10 + 11' },
      ] },
  ],
  together: [
    { problem: 'מה האיבר ה־$20$ בסדרה?', display: '5,\\; 9,\\; 13,\\; 17,\\; \\dots',
      steps: [
        { prompt: 'כמה מוסיפים בכל צעד?', choices: [
          { text: '$4$', ok: true, feedback: 'נכון: $9 - 5 = 4$, וגם $13 - 9 = 4$.' },
          { text: '$5$', ok: false, feedback: '$5$ הוא האיבר הראשון, לא הצעד.' },
          { text: '$9$', ok: false, feedback: '$9$ הוא האיבר השני. הצעד הוא ההפרש בין שני איברים צמודים.' },
        ], hints: ['מה ההפרש בין שני איברים צמודים?', '$9 - 5 = 4$, ו־$13 - 9 = 4$.'], done: 'בכל צעד מוסיפים $4$.' },
        { prompt: 'כמה צעדים יש מהאיבר הראשון עד האיבר ה־$20$?', choices: [
          { text: '$19$', ok: true, feedback: 'נכון: $20 - 1 = 19$.' },
          { text: '$20$', ok: false, feedback: 'מהאיבר הראשון לשני יש צעד אחד, לא שניים. לכן לאיבר ה־$20$ יש $19$ צעדים.' },
          { text: '$21$', ok: false, feedback: 'יותר מדי. מהראשון לשני צעד אחד, ולכן לעשרים $19$.' },
        ], hints: ['כמה צעדים מהראשון לשני? ומהראשון לשלישי?', 'צעד אחד לשני, שניים לשלישי: לאיבר ה־$20$ יש $19$.'], done: '$19$ צעדים של $4$.' },
      ],
      final: { prompt: 'מה האיבר ה־$20$?', answer: 81, check: '5 + 4*19', hints: ['מתחילים ב־$5$ ומוסיפים $19$ צעדים של $4$.', '$5 + 4 \\cdot 19 = 5 + 76$.'] } },
    { problem: 'הצלע הארוכה של מלבן גדולה פי $3$ מהצלע הקצרה. הצלע הקצרה היא $a$.',
      steps: [
        { prompt: 'מה אורך הצלע הארוכה?', choices: [
          { text: '$3a$', ok: true, feedback: 'נכון. בדיקה: אם $a = 2$, הארוכה $6$, ו־$3a$ נותן $6$.' },
          { text: '$a + 3$', ok: false, feedback: 'אם $a = 2$, הארוכה פי $3$, כלומר $6$. אבל $a + 3$ נותן $5$.' },
          { text: '$a : 3$', ok: false, feedback: '$a : 3$ קטן מ־$a$. אבל הצלע הארוכה גדולה מהקצרה.' },
        ], hints: ['נסו מספר: אם $a = 2$, כמה היא הצלע הארוכה?', 'פי $3$ מ־$2$ הוא $6$. איזה ביטוי נותן $6$ כש־$a = 2$?'], done: 'הצלע הארוכה: $3a$.' },
        { prompt: 'מה ההיקף של המלבן?', choices: [
          { text: '$a + 3a + a + 3a$', ok: true, feedback: 'נכון: ההיקף הוא סכום ארבע הצלעות.' },
          { text: '$a + 3a$', ok: false, feedback: 'אלה רק שתי צלעות. למלבן יש ארבע.' },
          { text: '$a \\cdot 3a$', ok: false, feedback: 'מכפלת הצלעות היא השטח, לא ההיקף.' },
        ], hints: ['ההיקף הוא סכום כל הצלעות.', 'שתי צלעות קצרות, $a$, ושתי צלעות ארוכות, $3a$.'], done: 'ההיקף: $a + 3a + a + 3a$.' },
      ],
      final: { prompt: 'מה ההיקף כש־$a = 5$?', answer: 40, check: '5 + 3*5 + 5 + 3*5', hints: ['הצלע הקצרה $5$, והארוכה $15$.', '$5 + 15 + 5 + 15$.'] } },
  ],
  diag: patternModel,
  transfer: savingsModel,
  misconceptions: [
    { id: 'start-n', title: 'נספרו $n$ צעדים במקום $n - 1$',
      cause: 'האיבר הראשון קיים לפני הצעד הראשון. לכן עד האיבר ה־$n$ יש רק $n - 1$ צעדים.',
      explain: ['נראה שהוספתם צעד אחד יותר מדי.', 'מהאיבר הראשון לשני צעד אחד, לשלישי שניים. לאיבר ה־$n$: $n - 1$ צעדים.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'predict', text: 'צמח גבוה $10$ ס״מ ביום הראשון, וגדל $3$ ס״מ בכל יום. מה הגובה שלו ביום השני?', choices: ['$13$', '$16$'], answer: 0,
          why: 'מהיום הראשון לשני עבר יום אחד של גדילה: $10 + 3 = 13$. הביטוי $10 + 3n$ נותן ביום השני $16$, ולכן הוא לא מתאים.' },
        { kind: 'rule', text: 'עד האיבר ה־$n$ יש $n - 1$ צעדים.', display: '10 + 3(n - 1)',
          why: 'בודקים את $n = 1$: $10 + 3 \\cdot 0 = 10$, בדיוק הגובה ביום הראשון. וביום השני $10 + 3 = 13$.' },
      ] },
    { id: 'diff-only', title: 'רק הצעד נכפל ב־$n$, וההתחלה נשכחה',
      cause: 'הצעד שחוזר בולט בטבלה, וקל לשכוח מאיפה הסדרה התחילה.',
      explain: ['נראה שכתבתם רק את הצעד כפול $n$.', 'בגפרורים $3n$ נותן בצורה הראשונה $3$, אבל בצורה הראשונה יש $4$. חסר מה שהיה בהתחלה.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'predict', fig: table(MATCH_HEAD, [[1, 4], [2, 7], [3, 10]]), text: 'כמה נותן $3n$ בצורה הראשונה, $n = 1$?', choices: ['$3$', '$4$'], answer: 0,
          why: '$3 \\cdot 1 = 3$, אבל בצורה הראשונה יש $4$ גפרורים. לכן $3n$ לא מתאים, ו־$3n + 1$ נותן $4$.' },
        { kind: 'rule', text: 'בודקים ביטוי באיבר הראשון.', display: '3 \\cdot 1 + 1 = 4',
          why: 'אם הביטוי לא נותן את האיבר הראשון, הוא לא הביטוי של הסדרה.' },
      ] },
    { id: 'whole-object', title: 'איבר שלם הוכפל',
      cause: 'נראה הגיוני שבצורה רחוקה פי $2$ יש פי $2$ גפרורים. אבל ההתחלה לא מוכפלת, רק הצעדים.',
      explain: ['נראה שכפלתם איבר שלם.', 'בצורה ה־$10$ יש $31$ גפרורים, ובצורה ה־$20$ יש $61$, לא $62$. ה־$4$ של ההתחלה מופיע פעם אחת בלבד.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'predict', text: 'בשורת הריבועים, בצורה ה־$10$ יש $31$ גפרורים. כמה יש בצורה ה־$20$?', choices: ['$61$', '$62$'], answer: 0,
          why: '$4 + 3 \\cdot 19 = 61$. כשמכפילים את $31$, סופרים את ההתחלה פעמיים.' },
        { kind: 'rule', text: 'מחשבים מההתחלה, לא מכפילים איבר.', display: '4 + 3 \\cdot 19 = 61',
          why: 'בצורה ה־$20$ יש התחלה אחת ו־$19$ צעדים. בשתי צורות של $10$ יש שתי התחלות.' },
      ] },
    { id: 'reversal', title: 'היחס נכתב הפוך',
      cause: 'במשפט "לדוד $6$ יותר מלעמית" המספרים מופיעים בסדר אחד, וקל לכתוב אותם בסדר הזה בלי לבדוק למי יש יותר.',
      explain: ['נראה שהביטוי נותן יותר למי שיש לו פחות.', 'בודקים במספר: אם לעמית $5$ ספרים, לדוד $11$. הביטוי $x - 6$ נותן $-1$, ולכן הוא הפוך.'],
      remedy: [
        { kind: 'predict', text: 'לעמית $x$ ספרים, ולדוד $6$ יותר מלעמית. אם לעמית $5$ ספרים, כמה לדוד?', choices: ['$11$', '$-1$'], answer: 0,
          why: 'לדוד יש יותר: $5 + 6 = 11$. לכן הביטוי הוא $x + 6$.' },
        { kind: 'rule', text: 'מי שיש לו יותר מקבל את הביטוי הגדול יותר.', display: 'x = 5:\\quad x + 6 = 11',
          why: 'בדיקה במספר מראה מיד אם הביטוי הפוך.' },
      ] },
    { id: 'times-plus', title: '"פי" ו"יותר" התחלפו',
      cause: '"פי $3$" ו"$3$ יותר" נשמעים דומה, אבל אחד הוא כפל והשני חיבור.',
      explain: ['נראה ש"פי" ו"יותר" התחלפו.', 'בודקים במספר: אם הרוחב $2$ והאורך פי $3$ ממנו, האורך $6$. $3a$ נותן $6$, ו־$a + 3$ נותן $5$.'],
      remedy: [
        { kind: 'predict', text: 'הרוחב $2$ ס״מ, והאורך גדול ממנו פי $3$. מה האורך?', choices: ['$6$', '$5$'], answer: 0, why: 'פי $3$ מ־$2$ הוא $2 \\cdot 3 = 6$. לכן האורך $3a$.' },
        { kind: 'predict', text: 'הרוחב $2$ ס״מ, והאורך ארוך ממנו ב־$3$ ס״מ. מה האורך?', choices: ['$6$', '$5$'], answer: 1, why: 'ארוך ב־$3$ הוא $2 + 3 = 5$. לכן האורך $a + 3$.' },
      ] },
  ],
};

// ================================================================ stair 3: collecting like terms (כינוס איברים דומים)

// q − |r|x + px + s, the order in which Herscovics and Linchevski saw the minus detach (9 − 3x + 2x → 9 − 5x)
type Col = { p: number; r: number; q: number; s: number; ask: number }; // ask 0: the coefficient of x, 1: the constant
const colTerms = (c: Col): [number, string][] => [[c.q, ''], [c.r, 'x'], [c.p, 'x'], ...(c.s ? [[c.s, ''] as [number, string]] : [])];
const colShow = (c: Col) => sumTex(colTerms(c));
const colBugs: Record<string, (c: Col) => number | null> = {
  // everything joined into one term: 9 − 3x + 2x + 4 → 12x (Booth 1988; Tirosh, Even & Robinson 1998)
  conjoin: (c) => (c.ask === 0 ? c.p + c.q + c.r + c.s : 0),
  // the minus of −3x carried to the next x-term: −3x + 2x read as −(3x + 2x) (Herscovics & Linchevski 1994)
  detach: (c) => (c.ask === 0 ? -(abs(c.r) + c.p) : null),
  // a minus simply dropped: −3x + 2x as 3x + 2x, or a negative number added as positive
  'drop-minus': (c) => (c.ask === 0 ? c.p - c.r : c.s < 0 ? c.q - c.s : null),
};
const collectModel: DiagModel<Col> = {
  params: (rnd) => fair(() => {
    for (;;) {
      const p = rint(rnd, 1, 9); const r = -rint(rnd, 1, 9); const q = rnz(rnd, -12, 12); const s = rnz(rnd, -12, 12);
      if (p + r !== 0 && q + s !== 0) return { p, r, q, s, ask: rint(rnd, 0, 1) };
    }
  }, (c) => (c.ask === 0 ? c.p + c.r : c.q + c.s), colBugs),
  text: (c) => `כנסו איברים דומים: $${colShow(c)}$. ${c.ask === 0 ? 'מה המקדם של $x$ בביטוי שמתקבל?' : 'מה המספר החופשי בביטוי שמתקבל?'}`,
  answer: (c) => (c.ask === 0 ? c.p + c.r : c.q + c.s),
  bugs: colBugs,
  solution: (c) => [
    `מסדרים, כל איבר עם הסימן שלפניו: $${sumTex([[c.r, 'x'], [c.p, 'x'], [c.q, ''], [c.s, '']])}$`,
    `$x$־ים: $${T(c.r)} + ${c.p} = ${T(c.p + c.r)}$. מספרים: $${T(c.q)} + ${T(c.s, true)} = ${T(c.q + c.s)}$`,
    `$${linTex(c.p + c.r, c.q + c.s)}$: ${c.ask === 0 ? `המקדם של $x$ הוא $${T(c.p + c.r)}$` : `המספר החופשי הוא $${T(c.q + c.s)}$`}.`,
  ],
  hint: () => 'הסימן שלפני איבר שייך לו. מחברים את המקדמים של $x$, ובנפרד את המספרים.',
};

type Rect = { p: number; q: number; r: number; ask: number }; // sides px + q and rx
const rectBugs: Record<string, (c: Rect) => number | null> = {
  // px + q taken as one term (p + q)x, so the perimeter has no constant
  conjoin: (c) => (c.ask === 0 ? 2 * (c.p + c.q + c.r) : 0),
};
const perimeterModel: DiagModel<Rect> = {
  params: (rnd) => fair(() => ({ p: rint(rnd, 1, 4), q: rint(rnd, 1, 9), r: rint(rnd, 1, 4), ask: rint(rnd, 0, 1) }), (c) => (c.ask === 0 ? 2 * (c.p + c.r) : 2 * c.q), rectBugs),
  text: (c) => `לצלעות של מלבן אורכים $${linTex(c.p, c.q)}$ ו־$${linTex(c.r, 0)}$. כתבו ביטוי מכונס להיקף שלו. ${c.ask === 0 ? 'מה המקדם של $x$?' : 'מה המספר החופשי?'}`,
  answer: (c) => (c.ask === 0 ? 2 * (c.p + c.r) : 2 * c.q),
  bugs: rectBugs,
  solution: (c) => [
    `ההיקף: $${linTex(c.p, c.q)} + ${linTex(c.r, 0)} + ${linTex(c.p, c.q)} + ${linTex(c.r, 0)}$`,
    `$x$־ים: $${c.p} + ${c.r} + ${c.p} + ${c.r} = ${2 * (c.p + c.r)}$. מספרים: $${c.q} + ${c.q} = ${2 * c.q}$`,
    `ההיקף $${linTex(2 * (c.p + c.r), 2 * c.q)}$: ${c.ask === 0 ? `המקדם של $x$ הוא $${2 * (c.p + c.r)}$` : `המספר החופשי הוא $${2 * c.q}$`}.`,
  ],
  hint: (c) => `ההיקף הוא סכום ארבע הצלעות. בצלע $${linTex(c.p, c.q)}$ יש שני איברים שונים: $${linTex(c.p, 0)}$ ו־$${c.q}$.`,
};

const stair3: StairContent = {
  skill: 'expr:3', topic: 'expr', level: 3, title: 'כינוס איברים דומים',
  objectives: [
    'לזהות איברים דומים.',
    'לכנס איברים דומים, גם עם מקדמים שליליים וגם כשהמקדם הוא $1$.',
    'לדעת ש־$3x + 5$ לא מתכנס, ולבדוק שוויון של ביטויים בהצבה.',
  ],
  idea: 'רק איברים מאותו סוג מתחברים: $x$־ים עם $x$־ים, ומספרים עם מספרים.',
  why: [
    '$2x + 3x$ הוא $x + x$ ועוד $x + x + x$: חמישה $x$־ים. זה חוק הפילוג: $(2 + 3)x = 5x$.',
    '$3x + 5$ ו־$8x$ שונים: כש־$x = 2$ הראשון $11$ והשני $16$. לכן $3x + 5$ נשאר כמו שהוא.',
  ],
  alt: [
    'אריחים: אריח ארוך הוא $x$, ואריח קטן הוא $1$. אריח שלילי ואריח חיובי מאותו סוג מבטלים זה את זה, ואריח ארוך לא מתבטל עם קטן.',
    'הצבה: ביטוי מכונס נכון נותן אותו ערך כמו הביטוי המקורי בכל הצבה. כש־$x = 2$, $4x + 7 - x - 2 = 11$, וגם $3x + 5 = 11$.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', fig: { type: 'tiles', px: 3, nx: 0, p1: 2, n1: 0 }, text: 'נעבוד עם אריחים. אריח ארוך הוא $x$, ואריח קטן הוא $1$. כאן יש $3x + 2$.' },
    { kind: 'predict', fig: still(3, 0, 5, 0), text: 'האם $3x + 5$ שווה ל־$8x$?', choices: ['כן', 'לא'], answer: 1,
      why: 'כש־$x = 2$: $3x + 5 = 11$, אבל $8x = 16$. מספר ו־$x$ הם סוגים שונים, והם לא מתחברים לאיבר אחד.',
      wrongWhy: { 0: 'נבדוק במספר: כש־$x = 2$, $3 \\cdot 2 + 5 = 11$ ו־$8 \\cdot 2 = 16$. ערכים שונים, ולכן הם לא שווים.' } },
    { kind: 'explore', text: 'האריחים מראים $3x - x + 2 - 5$. אריח ואריח נגדי הם זוג אפס. הורידו זוגות אפס עד שאי אפשר יותר.', display: '3x - x + 2 - 5',
      manip: tiles(3, 1, 2, 5), answer: { k: 2, c: -3 },
      hint: 'אריח $x$ ואריח $-x$ יחד הם אפס, וכך גם $1$ ו־$-1$. הקישו על שורה כדי להוריד ממנה זוג.', success: 'נשאר $2x - 3$: שני אריחי $x$ ושלושה אריחי $-1$. כלומר $3x - x + 2 - 5 = 2x - 3$.' },
    { kind: 'rule', fig: still(5, 0, 0, 0), text: 'מכנסים: מחברים את המקדמים של $x$, ובנפרד מחברים את המספרים.', display: '2x + 3x = 5x',
      why: '$2x + 3x$ הוא חמישה $x$־ים: $(2 + 3)x = 5x$. ומספר נשאר מספר: הוא מתחבר רק למספרים.' },
    { kind: 'predict', fig: table(['x', '7x − 3x + 2'], [[1, 6], [2, 10]]), text: '$7x - 3x + 2$ שווה ל…', choices: ['$4x + 2$', '$10x + 2$', '$6x$'], answer: 0,
      why: '$7x - 3x = 4x$, וה־$2$ נשאר לבד. בדיקה כש־$x = 2$: $14 - 6 + 2 = 10$, וגם $4 \\cdot 2 + 2 = 10$.',
      wrongWhy: { 1: 'המינוס שלפני $3x$ שייך לו: $7x - 3x = 4x$. כש־$x = 2$, $10x + 2$ נותן $22$ ולא $10$.', 2: '$2$ הוא מספר, והוא לא מתחבר ל־$x$־ים. כש־$x = 2$, $6x$ נותן $12$ ולא $10$.' } },
    { kind: 'rule', fig: { type: 'table', head: ['x', '9 − 3x + 2x', '9 − x'], rows: [[1, 8, 8], [2, 7, 7]] }, text: 'הסימן שלפני איבר שייך לו.', display: '9 - 3x + 2x = 9 - x',
      why: 'האיברים כאן הם $9$, $-3x$ ו־$2x$. מכנסים $-3x + 2x = -x$, ולא $-5x$: המינוס שייך רק ל־$3x$.' },
    { kind: 'say', fig: still(4, 1, 0, 0), text: 'מקדם $1$ לא כותבים: $x$ הוא $1 \\cdot x$, ו־$-x$ הוא $-1 \\cdot x$.', display: '4x - x = 3x' },
    { kind: 'predict', fig: { type: 'table', head: ['x', '3x + 5', '5x + 5'], rows: [[0, 5, 5], [1, '?', '?']] }, text: 'כש־$x = 0$, גם $3x + 5$ וגם $5x + 5$ שווים $5$. האם הביטויים שווים?', choices: ['כן, הם שווים', 'לא'], answer: 1,
      why: 'כש־$x = 1$ הראשון $8$ והשני $10$. ביטויים שווים נותנים אותו ערך בכל הצבה, לא רק באחת.',
      wrongWhy: { 0: 'כש־$x = 1$: $3 + 5 = 8$, אבל $5 + 5 = 10$. הצבה אחת שבה הם שווים עוד לא מספיקה.' } },
    { kind: 'rule', fig: { type: 'table', head: ['x', '3x + 5', '5x + 5'], rows: [[0, 5, 5], [1, 8, 10], [2, 11, 15]] }, text: 'ביטויים שווים (זהים) נותנים אותו ערך בכל הצבה. הצבה אחת יכולה רק לגלות שהם שונים.',
      why: 'הצבה שנותנת ערכים שונים מוכיחה שהביטויים שונים. הצבה שנותנת אותו ערך היא סימן טוב, אבל לא הוכחה: הכינוס הוא שמראה שהם שווים תמיד.' },
  ],
  examples: [
    { problem: 'כנסו איברים דומים:', display: '4x + 7 - x - 2', expr: '4*x + 7 - x - 2', answerTex: '3x + 5', answer: 11, check: '4*2 + 7 - 2 - 2',
      steps: [
        { action: 'מסדרים: האיברים עם $x$ יחד, והמספרים יחד.', why: 'כל איבר זז עם הסימן שלפניו: $-x$ ו־$-2$ זזים עם המינוס.', result: '4x - x + 7 - 2', ident: '4*x - x + 7 - 2' },
        { action: 'מכנסים.', why: '$4x - x = 3x$, כי $-x$ הוא $-1 \\cdot x$. ו־$7 - 2 = 5$.', result: '3x + 5', ident: '3*x + 5' },
        { action: 'בודקים בהצבה $x = 2$.', why: 'בביטוי המקורי: $4 \\cdot 2 + 7 - 2 - 2 = 11$. הביטוי המכונס צריך לתת אותו ערך.', result: '3 \\cdot 2 + 5 = 11', value: '3*2 + 5' },
      ] },
    { problem: 'לצלעות של משולש אורכים $2x$, $x + 3$ ו־$x - 1$. כתבו ביטוי מכונס להיקף שלו.', expr: '2*x + (x + 3) + (x - 1)', answerTex: '4x + 2', answer: 18, check: '2*4 + (4 + 3) + (4 - 1)',
      steps: [
        { action: 'ההיקף הוא סכום שלוש הצלעות.', why: 'מחברים את אורכי כל הצלעות.', result: '2x + (x + 3) + (x - 1)', ident: '2*x + (x + 3) + (x - 1)' },
        { action: 'מסדרים את האיברים הדומים.', why: 'הסוגריים כאן רק מקבצים, ואין לפניהם מינוס או מספר, אז אפשר להוריד אותם.', result: '2x + x + x + 3 - 1', ident: '2*x + x + x + 3 - 1' },
        { action: 'מכנסים.', why: '$2 + 1 + 1 = 4$ $x$־ים, ו־$3 - 1 = 2$.', result: '4x + 2', ident: '4*x + 2' },
        { action: 'בודקים כש־$x = 4$: הצלעות $8$, $7$ ו־$3$.', why: 'ההיקף $8 + 7 + 3 = 18$, ו־$4x + 2$ נותן גם הוא $18$.', result: '4 \\cdot 4 + 2 = 18', value: '4*4 + 2' },
      ] },
  ],
  together: [
    { problem: 'נכנס יחד את הביטוי.', display: '5x - 2 - 3x + 9',
      steps: [
        { prompt: 'אילו איברים מכנסים יחד?', choices: [
          { text: '$5x$ עם $-3x$, ו־$-2$ עם $9$', ok: true, feedback: 'נכון: $x$־ים עם $x$־ים, ומספרים עם מספרים.' },
          { text: '$5x$ עם $-2$', ok: false, feedback: '$5x$ ו־$-2$ הם סוגים שונים: באחד יש $x$, והשני מספר.' },
          { text: 'את כולם יחד', ok: false, feedback: 'מספר לא מתחבר ל־$x$־ים. כש־$x = 0$, למשל, אין בכלל $x$־ים, והמספרים נשארים.' },
        ], hints: ['איזה איבר דומה ל־$5x$?', 'איברים דומים: באותה אות. $5x$ ו־$-3x$ דומים.'], done: 'קבוצה אחת: $5x - 3x$. קבוצה שנייה: $-2 + 9$.' },
        { prompt: 'כמה זה $5x - 3x$?', choices: [
          { text: '$2x$', ok: true, feedback: 'נכון: $5 - 3 = 2$.' },
          { text: '$8x$', ok: false, feedback: 'המינוס שלפני $3x$ שייך לו: $5 - 3 = 2$.' },
          { text: '$2$', ok: false, feedback: 'נשארים $x$־ים: $5x - 3x = 2x$, ולא המספר $2$.' },
        ], hints: ['מחברים רק את המקדמים, עם הסימנים שלהם.', '$5 + (-3) = 2$, ולכן $2x$.'], done: '$5x - 3x = 2x$' },
        { prompt: 'וכמה זה $-2 + 9$?', choices: [
          { text: '$7$', ok: true, feedback: 'נכון.' },
          { text: '$-11$', ok: false, feedback: 'מתחילים ב־$-2$ וזזים $9$ ימינה, ומגיעים ל־$7$.' },
          { text: '$11$', ok: false, feedback: 'המינוס של $-2$ שייך לו: $-2 + 9 = 7$.' },
        ], hints: ['סימנים שונים: מחסרים את המרחקים מאפס.', '$9 - 2 = 7$, והסימן של $9$.'], done: 'הביטוי המכונס: $2x + 7$.' },
      ],
      final: { prompt: 'מה ערך הביטוי כש־$x = 4$? אפשר להציב בביטוי המכונס.', answer: 15, check: '5*4 - 2 - 3*4 + 9', hints: ['הביטוי המכונס הוא $2x + 7$.', '$2 \\cdot 4 + 7$.'] } },
    { problem: 'ועוד אחד, עם מקדם שלא כתוב.', display: '-x + 6 + 4x - 10',
      steps: [
        { prompt: 'כמה זה $-x + 4x$?', choices: [
          { text: '$3x$', ok: true, feedback: 'נכון: $-x$ הוא $-1 \\cdot x$, ו־$-1 + 4 = 3$.' },
          { text: '$5x$', ok: false, feedback: '$-x$ הוא $-1 \\cdot x$, ולכן $-1 + 4 = 3$, לא $1 + 4$.' },
          { text: '$4x$', ok: false, feedback: 'גם $-x$ הוא איבר: $-1 \\cdot x$. הוא לא נעלם.' },
        ], hints: ['מה המקדם של $-x$?', '$-x = -1 \\cdot x$, ולכן $-1 + 4$.'], done: '$-x + 4x = 3x$' },
        { prompt: 'והמספרים, $6 - 10$?', choices: [
          { text: '$-4$', ok: true, feedback: 'נכון.' },
          { text: '$4$', ok: false, feedback: 'מורידים מ־$6$ יותר משיש בו, ולכן התוצאה קטנה מאפס.' },
          { text: '$16$', ok: false, feedback: 'המינוס שלפני $10$ שייך לו: $6 - 10$.' },
        ], hints: ['מ־$6$ זזים $10$ שמאלה.', '$6 - 10 = -4$.'], done: 'הביטוי המכונס: $3x - 4$.' },
      ],
      final: { prompt: 'מה ערך הביטוי כש־$x = 3$?', answer: 5, check: '-3 + 6 + 4*3 - 10', hints: ['הביטוי המכונס הוא $3x - 4$.', '$3 \\cdot 3 - 4$.'] } },
  ],
  diag: collectModel,
  transfer: perimeterModel,
  misconceptions: [
    { id: 'conjoin', title: 'איברים לא דומים חוברו לאיבר אחד',
      cause: 'רוצים תשובה "גמורה" של איבר אחד. אבל $3x + 5$ כבר גמור: אין בו מה לחבר.',
      explain: ['נראה שחיברתם מספר עם $x$־ים לאיבר אחד.', '$3x + 5$ ו־$8x$ לא שווים: כש־$x = 2$ הראשון $11$ והשני $16$.'],
      remedy: [
        { kind: 'predict', text: 'כש־$x = 2$, כמה נותן $3x + 5$, וכמה נותן $8x$?', choices: ['אותו מספר', '$11$ ו־$16$'], answer: 1,
          why: '$3 \\cdot 2 + 5 = 11$, ו־$8 \\cdot 2 = 16$. ערכים שונים, ולכן $3x + 5$ לא שווה ל־$8x$.' },
        { kind: 'explore', text: 'הורידו זוגות אפס. האם אריח $x$ יכול להתבטל עם אריח $1$?', display: '2x + 4 - 1', manip: tiles(2, 0, 4, 1), answer: { k: 2, c: 3 },
          hint: 'רק אריח ואריח נגדי מאותו סוג הם זוג אפס.', success: 'נשאר $2x + 3$. אריחי $x$ ואריחי $1$ לא מתבטלים זה עם זה, ולכן נשארים שני איברים.' },
      ] },
    { id: 'detach', title: 'המינוס עבר גם לאיבר שאחריו',
      cause: 'ב־$9 - 3x + 2x$ קל לקרוא "$9$ פחות $3x$ ועוד $2x$" כאילו גם $2x$ מחוסר.',
      explain: ['נראה שהמינוס של $-3x$ הפך גם את $2x$ לשלילי.', 'המינוס שייך רק לאיבר שאחריו: $-3x + 2x = -x$. לכן $9 - 3x + 2x = 9 - x$.'],
      prereq: 'signed:1',
      remedy: [
        { kind: 'explore', text: 'האריחים מראים $4 - 3x + 2x$. הורידו זוגות אפס.', display: '4 - 3x + 2x', manip: tiles(2, 3, 4, 0), answer: { k: -1, c: 4 },
          hint: 'כל אריח $x$ מתבטל עם אריח $-x$ אחד.', success: 'נשאר אריח $-x$ אחד וארבעה אריחי $1$: $4 - 3x + 2x = 4 - x$, ולא $4 - 5x$.' },
        { kind: 'predict', text: 'כמה זה $9 - 3x + 2x$ כש־$x = 1$?', choices: ['$8$', '$4$'], answer: 0,
          why: '$9 - 3 + 2 = 8$, וגם $9 - x$ נותן $8$. הביטוי $9 - 5x$ היה נותן $4$.' },
      ] },
    { id: 'drop-minus', title: 'המינוס שלפני איבר נעלם',
      cause: 'בכינוס מסתכלים על המספרים ושוכחים את הסימן שלפניהם. אבל הסימן הוא חלק מהאיבר.',
      explain: ['נראה שהמינוס של אחד האיברים נעלם.', '$7x - 3x$ הוא $7$ $x$־ים פחות $3$ $x$־ים: $4x$. כש־$x = 2$: $14 - 6 = 8$, וגם $4 \\cdot 2 = 8$.'],
      prereq: 'signed:1',
      remedy: [
        { kind: 'predict', text: 'כמה זה $7x - 3x$ כש־$x = 2$?', choices: ['$8$', '$20$'], answer: 0,
          why: '$14 - 6 = 8$, וזה $4x$. הביטוי $10x$ היה נותן $20$.' },
        { kind: 'explore', text: 'האריחים מראים $3x - 2x + 2$. הורידו זוגות אפס.', display: '3x - 2x + 2', manip: tiles(3, 2, 2, 0), answer: { k: 1, c: 2 },
          hint: 'כל אריח $-x$ מבטל אריח $x$ אחד.', success: 'נשאר $x + 2$: שני האריחים השליליים ביטלו שניים מהחיוביים, ולא נוספו להם.' },
      ] },
  ],
};

// ================================================================ stair 4: the distributive law (חוק הפילוג)

type Dist = { a: number; c: number; b: number }; // a(cx + b), asked: the constant
const distBugs: Record<string, (p: Dist) => number | null> = {
  // only the first term multiplied: 3(x + 4) → 3x + 4 (teacher-reported; Kirshner & Awtry 2004 on its visual pull)
  'partial-dist': (p) => p.b,
  // a minus before the brackets that changes only the first sign: −2(x − 3) → −2x − 6
  'minus-bracket': (p) => (p.a < 0 ? -p.a * p.b : null),
};
const distModel: DiagModel<Dist> = {
  params: (rnd) => fair(() => ({ a: rint(rnd, 2, 7) * (rnd() < 0.5 ? -1 : 1), c: rnd() < 0.6 ? 1 : rint(rnd, 2, 3), b: rnz(rnd, -9, 9) }), (p) => p.a * p.b, distBugs),
  text: (p) => `פתחו סוגריים: $${bracketTex(p.a, p.c, p.b)}$. מה המספר החופשי בביטוי שמתקבל?`,
  answer: (p) => p.a * p.b,
  bugs: distBugs,
  solution: (p) => [
    `$${T(p.a)}$ כופל כל איבר בסוגריים: $${T(p.a, true)} \\cdot ${linTex(p.c, 0)} = ${linTex(p.a * p.c, 0)}$`,
    `$${T(p.a, true)} \\cdot ${T(p.b, true)} = ${T(p.a * p.b)}$`,
    `$${bracketTex(p.a, p.c, p.b)} = ${linTex(p.a * p.c, p.a * p.b)}$, והמספר החופשי $${T(p.a * p.b)}$.`,
  ],
  hint: (p) => (p.a < 0 ? `גם $${T(p.b)}$ נכפל ב־$${T(p.a)}$, לפי חוקי הסימנים.` : `גם $${T(p.b)}$ נכפל ב־$${p.a}$, לא רק $x$.`),
};

type Garden = { k: number; a: number; b: number; c: number }; // k 0: a garden a × (x + b); 1: a · (100 − c) in the head
const gardenBugs: Record<string, (p: Garden) => number | null> = { 'partial-dist': (p) => (p.k === 0 ? p.b : 100 * p.a - p.c) };
const gardenModel: DiagModel<Garden> = {
  params: (rnd) => fair(() => ({ k: rint(rnd, 0, 1), a: rint(rnd, 3, 9), b: rint(rnd, 2, 9), c: rint(rnd, 1, 3) }), (p) => (p.k === 0 ? p.a * p.b : p.a * (100 - p.c)), gardenBugs),
  text: (p) => (p.k === 0
    ? `גינה מלבנית ברוחב $${p.a}$ מטרים ובאורך $x + ${p.b}$ מטרים. כתבו את השטח שלה בלי סוגריים. מה המספר החופשי?`
    : `חשבו בעל פה, בעזרת חוק הפילוג: $${p.a} \\cdot ${100 - p.c}$`),
  fig: (p) => (p.k === 0 ? { type: 'area', a: p.a, b: p.b } : undefined) as FigSpec,
  answer: (p) => (p.k === 0 ? p.a * p.b : p.a * (100 - p.c)),
  bugs: gardenBugs,
  solution: (p) => (p.k === 0
    ? [`השטח: $${p.a}(x + ${p.b})$`, `החלק של היחידות: $${p.a} \\cdot ${p.b} = ${p.a * p.b}$`, `$${p.a}(x + ${p.b}) = ${p.a}x + ${p.a * p.b}$`]
    : [`$${p.a} \\cdot ${100 - p.c} = ${p.a} \\cdot (100 - ${p.c})$`, `$= ${100 * p.a} - ${p.a * p.c} = ${p.a * (100 - p.c)}$`]),
  hint: (p) => (p.k === 0 ? 'הגינה היא שני מלבנים: אחד באורך $x$ ואחד באורך היחידות.' : `$${100 - p.c} = 100 - ${p.c}$. כופלים ב־$${p.a}$ את שניהם.`),
};

const stair4: StairContent = {
  skill: 'expr:4', topic: 'expr', level: 4, title: 'חוק הפילוג',
  objectives: [
    'לפתוח סוגריים: $a(x + b) = ax + ab$.',
    'לראות את חוק הפילוג כשטח של מלבן משני חלקים.',
    'לפתוח סוגריים עם מספר שלילי לפניהם.',
  ],
  idea: 'מה שמחוץ לסוגריים כופל כל איבר שבתוכם.',
  why: [
    'מלבן בגובה $3$ ובאורך $x + 4$ מורכב משני מלבנים, $3x$ ו־$12$. השטח של כולו הוא סכום השטחים.',
    '$-2(x - 3)$: גם $-2 \\cdot x$ וגם $-2 \\cdot (-3)$, ולפי חוקי הסימנים $-2x + 6$.',
  ],
  alt: [
    '$7 \\cdot 98 = 7 \\cdot (100 - 2) = 700 - 14 = 686$: אותו חוק, בחשבון בעל פה.',
    'הצבה: $3(x + 4)$ ו־$3x + 12$ נותנים אותו ערך בכל הצבה. כש־$x = 2$ שניהם $18$, וכש־$x = -4$ שניהם $0$.',
  ],
  discover: [
    { kind: 'say', fig: { type: 'table', head: ['מחברים', 'יחד'], rows: [['4x', '4x'], ['4x + 4x', '8x'], ['4x + 4x + 4x', '12x']], anim: true }, mood: 'happy', text: 'נתחיל בכפל של איבר: $3 \\cdot 4x$ הוא שלוש פעמים $4x$, כלומר $12x$. ומה עושים עם סוגריים?', display: '3 \\cdot 4x = 12x' },
    { kind: 'predict', fig: { type: 'area', a: 3, b: 4 }, text: 'גינה בגובה $3$ מטרים ובאורך $x + 4$ מטרים. השטח שלה $3(x + 4)$. בלי סוגריים זה…',
      choices: ['$3x + 12$', '$3x + 4$', '$3x + 7$'], answer: 0,
      why: 'הגינה היא שני מלבנים: $3 \\cdot x$ ו־$3 \\cdot 4$. בדיקה כש־$x = 2$: $3(2 + 4) = 18$, וגם $3 \\cdot 2 + 12 = 18$.',
      wrongWhy: { 1: 'כאן רק $x$ נכפל ב־$3$. כש־$x = 2$, $3x + 4$ נותן $10$, אבל $3(x + 4)$ נותן $18$.', 2: 'זה $3x$ ועוד $3 + 4$. את ה־$4$ כופלים ב־$3$, לא מחברים לו.' } },
    { kind: 'explore', text: 'בנו מלבן ל־$3(x + 4)$: גובה $3$, ואורך $x$ ועוד $4$ יחידות.', display: '3(x + 4)', manip: area(), answer: { a: 3, b: 4 },
      hint: 'גררו את הקצה העליון לגובה $3$, ואת הקצה הימני עד $4$ יחידות.', success: 'שני החלקים: $3x$ ו־$12$. לכן $3(x + 4) = 3x + 12$.' },
    { kind: 'rule', fig: { type: 'area', a: 3, b: 4, areas: true }, text: 'חוק הפילוג: מה שמחוץ לסוגריים כופל כל איבר בפנים.', display: 'a(x + b) = ax + ab',
      why: 'במלבן: הגובה $a$ כופל גם את החלק של $x$ וגם את החלק של היחידות.' },
    { kind: 'say', fig: { type: 'numline', from: 680, to: 705, jumps: [{ from: 700, to: 686, label: '−7 · 2' }] }, text: 'אותו חוק עוזר גם בחשבון בעל פה: $7(100 - 2) = 700 - 14 = 686$.', display: '7 \\cdot 98 = 7(100 - 2)' },
    { kind: 'predict', fig: table(['x', '−2(x − 3)'], [[5, -4]]), text: '$-2(x - 3)$ בלי סוגריים זה…', choices: ['$-2x + 6$', '$-2x - 6$', '$-2x - 3$'], answer: 0,
      why: '$-2 \\cdot (-3) = 6$. בדיקה כש־$x = 5$: $-2(5 - 3) = -4$, וגם $-2 \\cdot 5 + 6 = -4$.',
      wrongWhy: { 1: 'מינוס כפול מינוס הוא פלוס: $-2 \\cdot (-3) = 6$. כש־$x = 5$, $-2x - 6$ נותן $-16$ ולא $-4$.', 2: 'גם את $-3$ כופלים ב־$-2$. כש־$x = 5$, $-2x - 3$ נותן $-13$.' } },
    { kind: 'rule', fig: still(0, 1, 3, 0), text: 'מינוס לפני הסוגריים כופל גם את האיבר השני.', display: '-(x - 3) = -x + 3',
      why: '$-(x - 3)$ הוא $-1 \\cdot (x - 3)$: גם $-1 \\cdot x = -x$, וגם $-1 \\cdot (-3) = 3$.' },
    { kind: 'say', fig: { type: 'area', a: 3, b: 4 }, text: 'במלבן יש רק אורכים חיוביים. עם מספרים שליליים ממשיכים באותו כלל, לפי חוקי הסימנים.' },
    { kind: 'predict', fig: still(0, 1, 3, 0), text: 'כמה זה $-(x - 3)$ כש־$x = 5$?', choices: ['$-2$', '$-8$'], answer: 0,
      why: '$-(5 - 3) = -2$, וגם $-5 + 3 = -2$. הביטוי $-x - 3$ היה נותן $-8$.' },
  ],
  examples: [
    { problem: 'פתחו סוגריים:', display: '5(x - 3)', expr: '5*(x - 3)', answerTex: '5x - 15', answer: 5, check: '5*(4 - 3)',
      steps: [
        { action: 'כופלים את $x$ ב־$5$.', why: '$5$ כופל כל איבר בסוגריים. מתחילים בראשון.', result: '5 \\cdot x = 5x' },
        { action: 'כופלים את $-3$ ב־$5$.', why: 'גם האיבר השני נכפל, עם הסימן שלו.', result: '5 \\cdot (-3) = -15', calc: { expr: '5*(-3)', value: -15 } },
        { action: 'כותבים את שני האיברים.', why: 'זה הביטוי בלי סוגריים.', result: '5x - 15', ident: '5*x - 15' },
        { action: 'בודקים כש־$x = 4$.', why: 'בביטוי המקורי: $5(4 - 3) = 5$. הביטוי החדש צריך לתת אותו ערך.', result: '5 \\cdot 4 - 15 = 5', value: '5*4 - 15' },
      ] },
    { problem: 'חשבו בעל פה:', display: '7 \\cdot 98', answer: 686, check: '7*98',
      steps: [
        { action: 'כותבים את $98$ כ־$100 - 2$.', why: 'קל לכפול ב־$100$.', result: '7(100 - 2)', value: '7*(100 - 2)' },
        { action: 'פותחים סוגריים.', why: '$7$ כופל גם את $100$ וגם את $2$: $7 \\cdot 2 = 14$.', result: '700 - 14', value: '700 - 14', calc: { expr: '7*2', value: 14 } },
        { action: 'מחסרים.', why: 'נשאר חיסור פשוט.', result: '686', value: '686' },
      ] },
    { problem: 'פתחו סוגריים:', display: '-3(2x - 4)', expr: '-3*(2*x - 4)', answerTex: '-6x + 12', answer: 6, check: '-3*(2*1 - 4)',
      steps: [
        { action: 'כופלים את $2x$ ב־$-3$.', why: 'סימנים שונים נותנים שלילי: $-3 \\cdot 2 = -6$.', result: '-3 \\cdot 2x = -6x' },
        { action: 'כופלים את $-4$ ב־$-3$.', why: 'מינוס כפול מינוס הוא פלוס.', result: '-3 \\cdot (-4) = 12', calc: { expr: '-3*(-4)', value: 12 } },
        { action: 'כותבים את הביטוי.', why: 'שני האיברים, כל אחד עם הסימן שיצא לו.', result: '-6x + 12', ident: '-6*x + 12' },
        { action: 'בודקים כש־$x = 1$.', why: 'בביטוי המקורי: $-3(2 - 4)$, כלומר $-3 \\cdot (-2) = 6$.', result: '-6 \\cdot 1 + 12 = 6', value: '-6*1 + 12' },
      ] },
  ],
  together: [
    { problem: 'נפתח יחד סוגריים עם מספר שלילי.', display: '-4(x - 5)',
      steps: [
        { prompt: 'מה האיבר הראשון אחרי פתיחת הסוגריים?', choices: [
          { text: '$-4x$', ok: true, feedback: 'נכון: $-4 \\cdot x = -4x$.' },
          { text: '$4x$', ok: false, feedback: 'המינוס של $-4$ נשאר: $-4 \\cdot x = -4x$.' },
          { text: '$-4$', ok: false, feedback: 'כופלים את $x$: $-4 \\cdot x$, לא רק מעתיקים את $-4$.' },
        ], hints: ['כמה זה $-4 \\cdot x$?', 'מספר שלילי כפול $x$: $-4x$.'], done: '$-4 \\cdot x = -4x$' },
        { prompt: 'ומה האיבר השני?', choices: [
          { text: '$-4 \\cdot (-5) = 20$', ok: true, feedback: 'נכון: מינוס כפול מינוס הוא פלוס.' },
          { text: '$-20$', ok: false, feedback: 'מינוס כפול מינוס הוא פלוס: $-4 \\cdot (-5) = 20$.' },
          { text: '$-5$', ok: false, feedback: 'גם $-5$ נכפל ב־$-4$, לא רק $x$.' },
        ], hints: ['כופלים את $-4$ ב־$-5$.', 'סימנים זהים נותנים חיובי.'], done: '$-4(x - 5) = -4x + 20$' },
      ],
      final: { prompt: 'מה ערך הביטוי כש־$x = 2$?', answer: 12, check: '-4*(2 - 5)', hints: ['אפשר להציב ב־$-4x + 20$.', '$-4 \\cdot 2 + 20$.'] } },
    { problem: 'גינה ברוחב $6$ מטרים ובאורך $x + 3$ מטרים.', display: '6(x + 3)',
      steps: [
        { prompt: 'מה השטח בלי סוגריים?', choices: [
          { text: '$6x + 18$', ok: true, feedback: 'נכון: $6 \\cdot x$ ועוד $6 \\cdot 3$.' },
          { text: '$6x + 3$', ok: false, feedback: 'גם את $3$ כופלים ב־$6$: החלק השני של הגינה הוא $6 \\cdot 3$.' },
          { text: '$6x + 9$', ok: false, feedback: '$6 + 3 = 9$ הוא חיבור. השטח של החלק השני הוא $6 \\cdot 3$.' },
        ], hints: ['הגינה היא שני מלבנים: $6$ על $x$, ו־$6$ על $3$.', '$6 \\cdot x$ ועוד $6 \\cdot 3$.'], done: 'השטח: $6x + 18$.' },
      ],
      final: { prompt: 'מה השטח כש־$x = 10$?', answer: 78, check: '6*(10 + 3)', hints: ['אפשר להציב ב־$6x + 18$.', '$6 \\cdot 10 + 18$.'] } },
  ],
  diag: distModel,
  transfer: gardenModel,
  misconceptions: [
    { id: 'partial-dist', title: 'רק האיבר הראשון שבסוגריים נכפל',
      cause: 'העין רואה את המספר ליד הסוגריים ואת $x$ שצמוד אליו. אבל המספר כופל את כל מה שבסוגריים.',
      explain: ['נראה שרק $x$ נכפל.', 'במלבן בגובה $3$ ובאורך $x + 4$ יש שני חלקים: $3x$ וגם $3 \\cdot 4 = 12$. לכן $3(x + 4) = 3x + 12$.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'explore', text: 'בנו מלבן ל־$3(x + 4)$, ושימו לב לשני החלקים.', display: '3(x + 4)', manip: area(), answer: { a: 3, b: 4 },
          hint: 'גובה $3$, ואורך $x$ ועוד $4$ יחידות.', success: 'החלק של $x$ הוא $3x$, וחלק היחידות $12$. שני החלקים נכפלו ב־$3$.' },
        { kind: 'predict', text: 'כמה זה $3(x + 4)$ כש־$x = 1$?', choices: ['$15$', '$7$'], answer: 0,
          why: '$3 \\cdot 5 = 15$, וגם $3x + 12$ נותן $15$. הביטוי $3x + 4$ היה נותן $7$.' },
      ] },
    { id: 'minus-bracket', title: 'מינוס לפני סוגריים הפך רק את הסימן הראשון',
      cause: 'המינוס נראה שייך רק לאיבר הקרוב אליו. אבל הוא כופל את כל הסוגריים.',
      explain: ['נראה שהמינוס הפך רק את האיבר הראשון.', '$-(x - 3) = -1 \\cdot x + (-1) \\cdot (-3) = -x + 3$.'],
      prereq: 'signed:3',
      remedy: [
        { kind: 'predict', text: 'כמה זה $-(x - 3)$ כש־$x = 5$?', choices: ['$-2$', '$-8$'], answer: 0,
          why: '$-(5 - 3) = -2$, וגם $-x + 3$ נותן $-2$. הביטוי $-x - 3$ נותן $-8$.' },
        { kind: 'rule', text: 'מינוס לפני סוגריים כופל כל איבר בפנים.', display: '-2(x - 3) = -2x + 6',
          why: '$-2 \\cdot x = -2x$, ו־$-2 \\cdot (-3) = 6$: מינוס כפול מינוס הוא פלוס.' },
      ] },
  ],
};

// ================================================================ stair 5: simplifying (פישוט ביטויים)

type Simp = { k: number; a: number; b: number; c: number; d: number; e: number }; // k 0: a(x + b) + cx + d; 1: a(x + b) − (x + e)
const simpShow = (p: Simp) => (p.k === 0
  ? `${bracketTex(p.a, 1, p.b)} ${p.c < 0 ? '-' : '+'} ${abs(p.c) === 1 ? '' : abs(p.c)}x ${p.d < 0 ? '-' : '+'} ${abs(p.d)}`
  : `${bracketTex(p.a, 1, p.b)} - ${bracketTex(1, 1, p.e)}`);
const simpK = (p: Simp) => (p.k === 0 ? p.a + p.c : p.a - 1);
const simpC = (p: Simp) => (p.k === 0 ? p.a * p.b + p.d : p.a * p.b - p.e);
const simpBugs: Record<string, (p: Simp) => number | null> = {
  // the first bracket opened only on its first term: a(x + b) → ax + b
  'partial-dist': (p) => (p.k === 0 ? p.b + p.d : p.b - p.e),
  // −(x + e) → −x + e
  'minus-bracket': (p) => (p.k === 1 ? p.a * p.b + p.e : null),
};
const simplifyModel: DiagModel<Simp> = {
  params: (rnd) => fair(() => {
    for (;;) {
      const p = { k: rint(rnd, 0, 1), a: rint(rnd, 2, 6), b: rnz(rnd, -8, 8), c: rnz(rnd, -5, 5), d: rnz(rnd, -9, 9), e: rnz(rnd, -9, 9) };
      if (simpK(p) !== 0) return p;
    }
  }, simpC, simpBugs),
  text: (p) => `פשטו את הביטוי $${simpShow(p)}$. מה המספר החופשי בביטוי המפושט?`,
  answer: simpC,
  bugs: simpBugs,
  solution: (p) => [
    p.k === 0
      ? `פותחים סוגריים: $${p.a}x ${p.a * p.b < 0 ? '-' : '+'} ${abs(p.a * p.b)} ${p.c < 0 ? '-' : '+'} ${abs(p.c) === 1 ? '' : abs(p.c)}x ${p.d < 0 ? '-' : '+'} ${abs(p.d)}$`
      : `פותחים סוגריים, והמינוס הופך את שני הסימנים: $${p.a}x ${p.a * p.b < 0 ? '-' : '+'} ${abs(p.a * p.b)} - x ${p.e < 0 ? '+' : '-'} ${abs(p.e)}$`,
    `מכנסים: $${linTex(simpK(p), simpC(p))}$`,
    `המספר החופשי: $${T(simpC(p))}$`,
  ],
  hint: (p) => (p.k === 0 ? `קודם פותחים את הסוגריים: $${p.a}$ כופל גם את $${T(p.b)}$.` : 'קודם פותחים סוגריים. המינוס לפני $(x ...)$ הופך את הסימן של כל איבר בתוכם.'),
};

type Frame = { a: number; b: number; c: number }; // a rectangle with sides a(x + b) and x + c
const frameBugs: Record<string, (p: Frame) => number | null> = { 'partial-dist': (p) => 2 * (p.b + p.c) };
const frameModel: DiagModel<Frame> = {
  params: (rnd) => fair(() => ({ a: rint(rnd, 2, 5), b: rint(rnd, 1, 6), c: rint(rnd, 1, 9) }), (p) => 2 * (p.a * p.b + p.c), frameBugs),
  text: (p) => `לצלעות של מלבן אורכים $${p.a}(x + ${p.b})$ ו־$x + ${p.c}$. כתבו את ההיקף שלו בלי סוגריים, מכונס. מה המספר החופשי?`,
  answer: (p) => 2 * (p.a * p.b + p.c),
  bugs: frameBugs,
  solution: (p) => [
    `צלע אחת בלי סוגריים: $${p.a}(x + ${p.b}) = ${p.a}x + ${p.a * p.b}$`,
    `ההיקף: פעמיים $${p.a}x + ${p.a * p.b}$ ופעמיים $x + ${p.c}$.`,
    `המספרים: $${p.a * p.b} + ${p.a * p.b} + ${p.c} + ${p.c} = ${2 * (p.a * p.b + p.c)}$`,
  ],
  hint: (p) => `קודם פותחים סוגריים: $${p.a}$ כופל גם את $${p.b}$. אחר כך מחברים את ארבע הצלעות.`,
};

const stair5: StairContent = {
  skill: 'expr:5', topic: 'expr', level: 5, title: 'פישוט ביטויים',
  objectives: [
    'לפשט ביטוי: לפתוח סוגריים, ואז לכנס איברים דומים.',
    'לטפל נכון במינוס לפני סוגריים.',
    'לבדוק פישוט בהצבה.',
  ],
  idea: 'קודם פותחים סוגריים, אחר כך מכנסים, ובסוף בודקים בהצבה.',
  why: [
    'פתיחת סוגריים וכינוס לא משנים את ערך הביטוי. לכן הצבה של אותו מספר לפני הפישוט ואחריו חייבת לתת אותו ערך.',
    '$-(x + 4)$ הוא $-1 \\cdot (x + 4)$, ולכן גם ה־$4$ מקבל מינוס.',
  ],
  alt: [
    'אריחים: $2(x + 3)$ הם שתי קבוצות של אריח $x$ ושלושה אריחי $1$. מורידים אריח $x$ אחד, ונשארים $x + 6$.',
    'מבנה: אם יודעים ש־$a + b = -4$, אז $-3(a + b)$ הוא $-3 \\cdot (-4) = 12$, בלי לדעת מה $a$ ומה $b$.',
  ],
  discover: [
    { kind: 'say', fig: still(2, 1, 6, 0), mood: 'happy', text: 'עכשיו שני הכלים יחד: פותחים סוגריים לפי חוק הפילוג, ואז מכנסים איברים דומים.', display: '2(x + 3) - x' },
    { kind: 'explore', text: 'האריחים מראים $2(x + 3) - x$: פעמיים $x + 3$, ועוד אריח $-x$. הורידו זוגות אפס.', display: '2(x + 3) - x',
      manip: tiles(2, 1, 6, 0), answer: { k: 1, c: 6 },
      hint: 'אריח $-x$ מבטל אריח $x$ אחד.', success: 'נשאר $x + 6$. כלומר $2(x + 3) - x = 2x + 6 - x = x + 6$.' },
    { kind: 'rule', fig: still(1, 0, 6, 0), text: 'מפשטים בשני צעדים: קודם פותחים סוגריים, אחר כך מכנסים.', display: '\\begin{aligned} 2(x + 3) - x &= 2x + 6 - x \\\\ &= x + 6 \\end{aligned}',
      why: 'איבר בתוך סוגריים אי אפשר לכנס עם איבר בחוץ. אחרי שפותחים אותם, כל האיברים גלויים.' },
    { kind: 'predict', fig: table(['x', '3(x − 2) − (x + 4)'], [[6, 2]]), text: '$3(x - 2) - (x + 4)$ שווה ל…', choices: ['$2x - 10$', '$2x - 2$', '$2x - 6$'], answer: 0,
      why: 'פותחים: $3x - 6 - x - 4 = 2x - 10$. בדיקה כש־$x = 6$: $3 \\cdot 4 - 10 = 2$, וגם $2 \\cdot 6 - 10 = 2$.',
      wrongWhy: { 1: 'המינוס לפני $(x + 4)$ הופך גם את $4$: $-x - 4$, לא $-x + 4$.', 2: 'גם את $-2$ כופלים ב־$3$: $3x - 6$, לא $3x - 2$.' } },
    { kind: 'rule', fig: still(0, 1, 0, 4), text: 'מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.', display: '-(x + 4) = -x - 4',
      why: '$-(x + 4)$ הוא $-1 \\cdot (x + 4)$: כל איבר נכפל ב־$-1$.' },
    { kind: 'say', fig: SUM_TABLE, text: 'לפעמים לא צריך לפתוח סוגריים בכלל. כשיודעים כמה שווה מה שבסוגריים, מציבים אותו כמספר אחד.' },
    { kind: 'predict', fig: SUM_TABLE, text: 'נתון: $a + b = -4$. כמה זה $-3(a + b)$?', choices: ['$12$', '$-12$', '$-7$'], answer: 0,
      why: '$a + b$ הוא מספר אחד, $-4$. לכן $-3 \\cdot (-4) = 12$.',
      wrongWhy: { 1: 'מינוס כפול מינוס הוא פלוס: $-3 \\cdot (-4) = 12$.', 2: '$-7$ הוא $-3 + (-4)$. אבל $-3(a + b)$ הוא כפל.' } },
    { kind: 'rule', fig: { type: 'table', head: ['x', '2(x + 3) − x', 'x + 6'], rows: [[1, 7, 7], [2, 8, 8]] }, text: 'בדיקה: מציבים את אותו מספר בביטוי המקורי ובביטוי המפושט. כש־$x = 1$:', display: '\\begin{aligned} 2(1 + 3) - 1 &= 7 \\\\ 1 + 6 &= 7 \\end{aligned}',
      why: 'אם יוצא ערך שונה, יש טעות בפישוט. אם יוצא אותו ערך, כדאי לבדוק גם במספר נוסף.' },
  ],
  examples: [
    { problem: 'פשטו את הביטוי:', display: '4(x + 2) - 3x', expr: '4*(x + 2) - 3*x', answerTex: 'x + 8', answer: 11, check: '4*(3 + 2) - 3*3',
      steps: [
        { action: 'פותחים סוגריים.', why: '$4$ כופל גם את $x$ וגם את $2$.', result: '4x + 8 - 3x', ident: '4*x + 8 - 3*x' },
        { action: 'מכנסים.', why: '$4x - 3x = x$.', result: 'x + 8', ident: 'x + 8' },
        { action: 'בודקים כש־$x = 3$.', why: 'בביטוי המקורי: $4 \\cdot 5 - 9 = 11$.', result: '3 + 8 = 11', value: '3 + 8' },
      ] },
    { problem: 'פשטו את הביטוי:', display: '5(x - 1) - 2(x - 4)', expr: '5*(x - 1) - 2*(x - 4)', answerTex: '3x + 3', answer: 9, check: '5*(2 - 1) - 2*(2 - 4)',
      steps: [
        { action: 'פותחים את הסוגריים הראשונים.', why: '$5 \\cdot x = 5x$, ו־$5 \\cdot (-1) = -5$.', result: '5x - 5 - 2(x - 4)', ident: '5*x - 5 - 2*(x - 4)' },
        { action: 'פותחים את הסוגריים השניים, עם המינוס.', why: '$-2 \\cdot x = -2x$, ו־$-2 \\cdot (-4) = 8$.', result: '5x - 5 - 2x + 8', ident: '5*x - 5 - 2*x + 8', calc: { expr: '-2*(-4)', value: 8 } },
        { action: 'מכנסים.', why: '$5x - 2x = 3x$, ו־$-5 + 8 = 3$.', result: '3x + 3', ident: '3*x + 3' },
        { action: 'בודקים כש־$x = 2$.', why: 'בביטוי המקורי: $5 \\cdot 1 - 2 \\cdot (-2)$, כלומר $5 + 4 = 9$.', result: '3 \\cdot 2 + 3 = 9', value: '3*2 + 3' },
      ] },
    { problem: 'נתון: $a + b = -4$. מה הערך של כל אחד משלושת הביטויים?', display: '-3(a + b) \\qquad (a + b) : 2 \\qquad (a + b)^2', answer: 12, check: '-3*(-4)', answerTex: '12,\\; -2,\\; 16',
      steps: [
        { action: 'בביטוי הראשון מציבים $-4$ במקום $a + b$.', why: 'לא צריך לדעת מה $a$ ומה $b$: הסוגריים הם מספר אחד.', result: '-3 \\cdot (-4)', value: '-3*(-4)' },
        { action: 'כופלים.', why: 'מינוס כפול מינוס הוא פלוס.', result: '-3 \\cdot (-4) = 12', value: '12' },
        { action: 'בביטוי השני: אותה הצבה.', why: 'מציבים $-4$ במקום $a + b$, ומחלקים.', result: '-4 : 2 = -2', calc: { expr: '(-4)/2', value: -2 } },
        { action: 'ובשלישי.', why: 'מספר שלילי בריבוע הוא חיובי.', result: '(-4)^2 = 16', calc: { expr: '(-4)^2', value: 16 } },
      ] },
  ],
  together: [
    { problem: 'נפשט יחד.', display: '3(x + 2) - (x - 5)',
      steps: [
        { prompt: 'מה זה $-(x - 5)$ בלי סוגריים?', choices: [
          { text: '$-x + 5$', ok: true, feedback: 'נכון: $-1 \\cdot x = -x$, ו־$-1 \\cdot (-5) = 5$.' },
          { text: '$-x - 5$', ok: false, feedback: 'המינוס הופך גם את $-5$: $-1 \\cdot (-5) = 5$.' },
          { text: '$x - 5$', ok: false, feedback: 'המינוס לפני הסוגריים לא נעלם: הוא הופך את הסימן של כל איבר.' },
        ], hints: ['$-(x - 5)$ הוא $-1 \\cdot (x - 5)$.', '$-1 \\cdot x = -x$, ו־$-1 \\cdot (-5) = 5$.'], done: '$-(x - 5) = -x + 5$' },
        { prompt: 'ומה זה $3(x + 2)$?', choices: [
          { text: '$3x + 6$', ok: true, feedback: 'נכון.' },
          { text: '$3x + 2$', ok: false, feedback: 'גם את $2$ כופלים ב־$3$.' },
          { text: '$x + 6$', ok: false, feedback: 'גם את $x$ כופלים ב־$3$: $3x$.' },
        ], hints: ['$3$ כופל כל איבר בסוגריים.', '$3 \\cdot x$ ו־$3 \\cdot 2$.'], done: '$3(x + 2) = 3x + 6$' },
        { prompt: 'מה מקבלים אחרי כינוס של $3x + 6 - x + 5$?', choices: [
          { text: '$2x + 11$', ok: true, feedback: 'נכון: $3x - x = 2x$, ו־$6 + 5 = 11$.' },
          { text: '$4x + 11$', ok: false, feedback: 'המינוס של $-x$ שייך לו: $3x - x = 2x$.' },
          { text: '$2x + 1$', ok: false, feedback: '$6 + 5 = 11$, ולא $1$.' },
        ], hints: ['$x$־ים עם $x$־ים, מספרים עם מספרים.', '$3x - x$, ו־$6 + 5$.'], done: '$3(x + 2) - (x - 5) = 2x + 11$' },
      ],
      final: { prompt: 'מה ערך הביטוי כש־$x = 1$?', answer: 13, check: '3*(1 + 2) - (1 - 5)', hints: ['אפשר להציב ב־$2x + 11$.', '$2 \\cdot 1 + 11$.'] } },
    { problem: 'ועוד אחד קצר.', display: '10 - (x + 3)',
      steps: [
        { prompt: 'מה מקבלים?', choices: [
          { text: '$7 - x$', ok: true, feedback: 'נכון: $10 - x - 3 = 7 - x$.' },
          { text: '$13 - x$', ok: false, feedback: 'המינוס הופך גם את $3$: $-3$, ולכן $10 - 3$.' },
          { text: '$7 + x$', ok: false, feedback: 'המינוס הופך גם את $x$: $-x$.' },
        ], hints: ['$-(x + 3) = -x - 3$.', '$10 - x - 3$, ואז $10 - 3 = 7$.'], done: '$10 - (x + 3) = 7 - x$' },
      ],
      final: { prompt: 'מה ערך הביטוי כש־$x = 2$?', answer: 5, check: '10 - (2 + 3)', hints: ['אפשר להציב ב־$7 - x$.', '$7 - 2$.'] } },
  ],
  diag: simplifyModel,
  transfer: frameModel,
  misconceptions: [
    { id: 'partial-dist', title: 'רק האיבר הראשון שבסוגריים נכפל',
      cause: 'בביטוי ארוך עם סוגריים קל לפתוח רק את החלק הראשון ולהמשיך הלאה.',
      explain: ['נראה שבסוגריים נכפל רק האיבר הראשון.', 'בפישוט פותחים את הסוגריים עד הסוף: $4(x + 2) = 4x + 8$, ולא $4x + 2$. אחר כך מכנסים.'],
      prereq: 'expr:4',
      remedy: [
        { kind: 'predict', text: 'כמה זה $4(x + 2) - 3x$ כש־$x = 1$?', choices: ['$9$', '$3$'], answer: 0,
          why: '$4 \\cdot 3 - 3 = 9$, וגם $x + 8$ נותן $9$. מי שפתח $4x + 2$ מקבל $x + 2$, שנותן $3$.' },
        { kind: 'explore', text: 'האריחים מראים $2(x + 3) - x$. הורידו זוגות אפס.', display: '2(x + 3) - x', manip: tiles(2, 1, 6, 0), answer: { k: 1, c: 6 },
          hint: 'שתי קבוצות של $x + 3$: שני אריחי $x$ ושישה אריחי $1$.', success: 'נשאר $x + 6$: ה־$3$ הופיע פעמיים, כי גם הוא נכפל ב־$2$.' },
      ] },
    { id: 'minus-bracket', title: 'מינוס לפני סוגריים הפך רק את הסימן הראשון',
      cause: 'בביטוי ארוך המינוס שלפני הסוגריים נראה כמו חיסור של האיבר הראשון בלבד.',
      explain: ['נראה שהמינוס לפני הסוגריים הפך רק את $x$.', '$-(x + 4) = -x - 4$: המינוס הופך כל איבר בסוגריים.'],
      prereq: 'expr:4',
      remedy: [
        { kind: 'predict', text: 'כמה זה $10 - (x + 3)$ כש־$x = 2$?', choices: ['$5$', '$11$'], answer: 0,
          why: '$10 - 5 = 5$, וגם $7 - x$ נותן $5$. מי שכתב $10 - x + 3$ מקבל $11$.' },
        { kind: 'rule', text: 'מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.', display: '\\begin{aligned} 10 - (x + 3) &= 10 - x - 3 \\\\ &= 7 - x \\end{aligned}',
          why: 'מחסרים את כל מה שבסוגריים, ולכן מחסרים גם את $x$ וגם את $3$.' },
      ] },
    { id: 'conjoin', title: 'איברים לא דומים חוברו לאיבר אחד',
      cause: 'אחרי פתיחת הסוגריים יש הרבה איברים, ומתפתה לחבר את כולם לתשובה של איבר אחד.',
      explain: ['נראה שחיברתם מספרים עם $x$־ים.', 'אחרי פתיחת הסוגריים מכנסים רק איברים דומים: $3x + 6 - x + 5 = 2x + 11$, ולא $13x$.'],
      prereq: 'expr:3',
      remedy: [
        { kind: 'predict', text: 'כש־$x = 0$, כמה נותן $2x + 11$, וכמה נותן $13x$?', choices: ['אותו מספר', '$11$ ו־$0$'], answer: 1,
          why: 'ערכים שונים, ולכן $2x + 11$ לא שווה ל־$13x$. מספר ו־$x$־ים נשארים שני איברים.',
          wrongWhy: { 0: 'כש־$x = 1$ שניהם באמת $13$. אבל כש־$x = 0$: $2 \\cdot 0 + 11 = 11$, ו־$13 \\cdot 0 = 0$.' } },
        { kind: 'explore', text: 'הורידו זוגות אפס. האם אריח $x$ מתבטל עם אריח $1$?', display: '3x - x + 6 - 1', manip: tiles(3, 1, 6, 1), answer: { k: 2, c: 5 },
          hint: 'רק אריח ואריח נגדי מאותו סוג הם זוג אפס.', success: 'נשאר $2x + 5$: שני סוגים של אריחים, ולכן שני איברים.' },
      ] },
  ],
};

export const EXPR: StairContent[] = [stair1, stair2, stair3, stair4, stair5];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/expr.js names them all). */
export const CATS_EXPR: Record<string, string> = {};
export { substModel, collectModel, distModel };
