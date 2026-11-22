// Powers of directed numbers (חזקות של מספרים מכוונים), the seventh stair of the signed-number unit (signed:7, the
// classroom lane's CLASSROOM-5). The programme's 7.6 part 2: a power is repeated multiplying; the exponent belongs to
// what stands right next to it, so (−5)² = (−5)(−5) = 25 and −5² = (−5 · 5) = −25; an even exponent gives a positive
// result and an odd one keeps the minus; a power comes before multiplying in the order of operations; and a fraction
// or a decimal is raised whole (the numerator and the denominator, every digit after the point).
//
// The class's notation: the factors side by side with no dot, (−5)(−5); −5² written (−5 · 5); the minus in front of a
// bracket kept as its own step, −(+25); "+25 = 25". The numbers are synthetic (the notebook's own exercise 137 items,
// such as (−2)³ = −8, are not reused). Every value here is the app's evaluator's (learn/content.test.ts runs every
// worked step) and the lane's verify script's (spec_check.mjs, section D3).
import type { DiagModel, FigSpec, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generator's draws, texts and worked solutions
import * as G from '@/content/signed7.js';

type P7 = { f: number; n: number; a?: number; b?: number; c?: number; k?: number; p?: number; q?: number; d?: number; w?: number };

const IDS = ['pow-neg-base', 'pow-odd-pos', 'pow-keep-sign', 'outer-minus', 'pow-times', 'order', 'dec-places', 'num-only'];
const bugOf = (id: string) => (p: P7): number | null => G.powBugs(p)[id] ?? null;

/**
 * The diagnostic model: the checked forms F0-F5 (F6, a positive base, never reaches a check), with more fractions and
 * decimals than the exercises have (25%, not 11%), so the two mistakes only they show (dec-places, num-only) are seen
 * often enough to be diagnosed and repaired: F0 20%, F1 20%, F2 10%, F3 10%, F4 15%, F5 25%.
 */
const MODEL_MIX: [number, number][] = [[0, 0.2], [1, 0.2], [2, 0.1], [3, 0.1], [4, 0.15], [5, 0.25]];
const powModel: DiagModel<P7> = {
  params: (rnd) => { const y = rnd(); let acc = 0; const f = MODEL_MIX.find(([, w]) => (acc += w) > y)?.[0] ?? 5; return G.drawPow(rnd, f); },
  text: () => 'חשבו:',
  display: (p) => G.powTex(p),
  answer: (p) => G.powValue(p),
  bugs: Object.fromEntries(IDS.map((id) => [id, bugOf(id)])),
  solution: (p) => G.powSolution(p),
  hint: (p) => G.powHint(p),
  precise: true,
  // decimals are answered as decimals, exactly ((−0.4)³ is −0.064, never −0.06); fractions and whole numbers as they are
  fmt: (p) => (G.powExactDec(p) ? 'dec' : undefined),
  exactDec: (p) => G.powExactDec(p),
};

/**
 * A power and its opposite as arrows from 0 (stair 1's arrows, SK-STUDENT-1): the same distance, the two sides of zero.
 * `plus` and `minus` are the arrows' labels, the expressions the step speaks of.
 */
const mirror = (v: number, plus: string, minus: string): FigSpec =>
  ({ type: 'numline', from: -30, to: 30, step: 5, marks: [{ x: -v, label: `\u2212${v}` }, { x: v, label: `${v}` }], jumps: [{ from: 0, to: v, label: plus }, { from: 0, to: -v, label: minus }] });

/** A game: 1 on the board, multiplied by −a on every turn, n turns. Repeated multiplying is a power: (−a)ⁿ. */
const gameModel: DiagModel<P7> = {
  params: (rnd) => G.drawPow(rnd, 0),
  text: (p) => `במשחק כותבים על הלוח את המספר $1$. בכל תור כופלים את מה שכתוב על הלוח ב־$-${p.a}$. מה כתוב על הלוח אחרי $${p.n}$ תורות?`,
  answer: (p) => G.powValue(p),
  bugs: { 'pow-odd-pos': bugOf('pow-odd-pos'), 'pow-keep-sign': bugOf('pow-keep-sign'), 'pow-times': bugOf('pow-times') },
  solution: (p) => [`בכל תור כופלים ב־$-${p.a}$, ולכן אחרי $${p.n}$ תורות על הלוח כתוב $1 \\cdot (-${p.a})^{${p.n}} = (-${p.a})^{${p.n}}$.`, ...G.powSolution(p).slice(1)],
  hint: () => 'כפל חוזר באותו מספר הוא חזקה: הבסיס הוא המספר שכופלים בו, והמעריך הוא כמה תורות היו.',
};

// ---------------------------------------------------------------- the figures: factors as tiles, side by side

type TileRow = { tiles: string[]; pre?: string; post?: string; under?: string };
/**
 * Rows of factor tiles, the class's (−5)(−5) as a picture: each factor a tile, a minus that waits outside before the
 * row, what the row gives after it, a word under it. A figure of type 'geo' (components/Figure.jsx): unnamed points
 * (their names start with "_") and the squares on them; a few more unnamed points keep the words inside the drawing.
 */
function tiles(rows: TileRow[], label: string): FigSpec {
  const pts: Record<string, [number, number]> = {};
  const squares: { a: string; b: string; text: string }[] = [];
  const words: { at: [number, number]; text: string; anchor?: string; dy?: number }[] = [];
  rows.forEach((r, j) => {
    const y = -1.7 * j; const x0 = r.pre ? 0.9 : 0; const end = x0 + 1.25 * r.tiles.length - 0.25;
    if (r.pre) words.push({ at: [0.35, y + 0.5], text: r.pre, dy: 7 });
    r.tiles.forEach((t, i) => {
      const x = x0 + 1.25 * i; pts[`_${j}a${i}`] = [x, y]; pts[`_${j}b${i}`] = [x + 1, y];
      squares.push({ a: `_${j}a${i}`, b: `_${j}b${i}`, text: t });
    });
    // the words after the row and under it need room: a point at their far end (about 0.3 of a tile a character)
    if (r.post) { words.push({ at: [end + 0.3, y + 0.5], text: r.post, anchor: 'start', dy: 7 }); pts[`_${j}e`] = [end + 0.3 + 0.32 * r.post.length, y + 0.5]; }
    if (r.under) { words.push({ at: [end / 2, y - 0.45], text: r.under, dy: 7 }); pts[`_${j}u`] = [end / 2, y - 0.75]; }
  });
  const h = 1 + 1.7 * (rows.length - 1) + (rows.some((r) => r.under) ? 0.8 : 0);
  return { type: 'geo', label, view: [300, Math.round(24 + 50 * h)], pad: 12, pts, squares, words } as unknown as FigSpec;
}

const aligned = (rows: string[]) => `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`;

const stair7: StairContent = {
  skill: 'signed:7', topic: 'signed', level: 7, title: 'חזקות של מספרים מכוונים',
  objectives: [
    'לחשב חזקה של מספר מכוון: לדעת מה הבסיס ומה המעריך, ולכתוב את הגורמים זה ליד זה.',
    'להבדיל בין $(-5)^2$ לבין $-5^2$: המעריך שייך למה שצמוד אליו.',
    'לדעת את הסימן מראש: מעריך זוגי נותן תוצאה חיובית, ומעריך אי־זוגי משאיר את המינוס.',
    'לחשב תרגיל עם חזקה לפי סדר הפעולות: קודם החזקה, אחר כך כפל, ובסוף חיבור וחיסור.',
  ],
  idea: 'חזקה היא כפל חוזר של הבסיס בעצמו. הסוגריים אומרים מה הבסיס: ב־$(-5)^2$ הבסיס הוא $-5$, וב־$-5^2$ הוא רק $5$, והמינוס מחכה בחוץ.',
  why: [
    '$(-5)^2 = (-5)(-5) = 25$: שני גורמים שליליים נותנים מכפלה חיובית, כמו בכל כפל.',
    '$-5^2 = (-5 \\cdot 5) = -25$: המעריך שייך רק ל־$5$, והמינוס נשאר לפני התוצאה.',
    'כל זוג מינוסים נותן פלוס. לכן במעריך זוגי התוצאה חיובית, ובמעריך אי־זוגי נשאר מינוס אחד.',
  ],
  alt: [
    'אפשר לקרוא את המינוס כ"הנגדי של": $-5^2$ הוא הנגדי של $5^2$, כלומר $-25$. ו־$(-5)^2$ הוא $-5$ כפול עצמו, כלומר $25$.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', fig: tiles([{ tiles: ['2', '2', '2', '2', '2'], under: '5 פעמים' }], 'חמישה גורמים, בכל אחד 2'),
      text: 'חזקה היא כפל חוזר של אותו מספר. ב־$2^5$ המספר $2$ הוא הבסיס, ו־$5$ הוא המעריך: כמה פעמים כופלים את הבסיס בעצמו.',
      display: '2^5 = 2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32' },
    { kind: 'say', fig: tiles([{ tiles: ['−5', '−5'] }], 'שני גורמים, בכל אחד מינוס 5'),
      text: 'כשהבסיס שלילי, כותבים אותו בסוגריים. $(-5)^2$ הוא $-5$ כפול $-5$: שלילי כפול שלילי, ולכן חיובי.',
      display: '(-5)^2 = (-5)(-5) = +25 = 25' },
    { kind: 'predict', fig: tiles([{ tiles: ['−5', '−5'] }, { pre: '−', tiles: ['5', '5'] }], 'למעלה שני גורמים של מינוס 5; למטה מינוס, ואחריו שני גורמים של 5'),
      text: 'ומה יוצא ב־$(-5)^2$ וב־$-5^2$?',
      choices: ['$25$ ו־$-25$', '$25$ ו־$25$', '$-25$ ו־$-25$'], answer: 0,
      why: 'ב־$(-5)^2$ הבסיס הוא $-5$, כולו בתוך הסוגריים: $(-5)(-5) = 25$. ב־$-5^2$ אין סוגריים, והחזקה שייכת רק ל־$5$: $-5^2 = (-5 \\cdot 5) = -25$.',
      wrongWhy: {
        1: 'ב־$-5^2$ אין סוגריים, ולכן המינוס הוא לא חלק מהבסיס. קודם $5^2 = 25$, והמינוס נשאר: $-25$.',
        2: '$(-5)^2 = (-5)(-5)$: שני גורמים שליליים, והמכפלה שלהם חיובית.',
      } },
    { kind: 'rule', fig: tiles([{ pre: '−', tiles: ['5', '5'], post: '= −25' }], 'מינוס, ואחריו שני גורמים של 5, שווה מינוס 25'),
      text: 'המעריך שייך למה שצמוד אליו: לסוגריים כולם, או רק למספר. מינוס שלפני המספר מחכה בחוץ.',
      display: '-5^2 = (-5 \\cdot 5) = -25',
      why: 'ב־$(-5)^2$ צמודים למעריך הסוגריים, ולכן $-5$ כולו מוכפל בעצמו. ב־$-5^2$ צמוד למעריך רק $5$: כופלים $5 \\cdot 5$, והמינוס נשאר לפני התוצאה. כך כותבים בכיתה: $-5^2 = (-5 \\cdot 5)$.' },
    { kind: 'rule', fig: tiles([{ tiles: ['−3', '−3', '−3', '−3'], post: '= 81' }, { tiles: ['−4', '−4', '−4'], post: '= −64' }], 'ארבעה גורמים של מינוס 3 שווים 81; שלושה גורמים של מינוס 4 שווים מינוס 64'),
      text: 'מעריך זוגי נותן תוצאה חיובית. במעריך אי־זוגי נשאר מינוס אחד.',
      display: aligned(['(-3)^4 &= 81', '-3^4 &= -81', '(-4)^3 &= -64 = -4^3']),
      why: 'כמו בכפל של כמה מספרים שליליים: כל זוג מינוסים נותן פלוס. במעריך אי־זוגי $(-a)^n$ ו־$-a^n$ שווים, ולכן רק מעריך זוגי מגלה את ההבדל ביניהם.' },
    { kind: 'explore', text: 'חזקה בסדר פעולות: קודם החזקה, $(-2)^2 = 4$. עכשיו $4 - 9$: מתחילים ב־$4$ וזזים $9$ שמאלה.', display: '(-2)^2 - 9',
      manip: { kind: 'numberline', min: -10, max: 10, from: 4, start: 4 }, answer: -5,
      hint: 'מ־$4$ ארבעה צעדים שמאלה מגיעים ל־$0$, ומשם עוד חמישה.', success: '$(-2)^2 - 9 = 4 - 9 = -5$. החזקה באה לפני החיסור.' },
    { kind: 'predict', fig: tiles([{ tiles: ['−0.3', '−0.3', '−0.3'] }], 'שלושה גורמים, בכל אחד מינוס 0.3'),
      text: 'גם בעשרוני. כמה זה?', display: '(-0.3)^3',
      choices: ['$-0.027$', '$-0.27$', '$0.027$'], answer: 0,
      why: '$(-0.3)(-0.3)(-0.3)$ הוא $-\\frac{27}{1000} = -0.027$: בכל גורם ספרה אחת אחרי הנקודה, ולכן בשלושה גורמים שלוש ספרות. ומעריך אי־זוגי משאיר את המינוס.',
      wrongWhy: {
        1: 'כל גורם הוא עשיריות: עשיריות כפול עשיריות כפול עשיריות הן אלפיות. לכן שלוש ספרות אחרי הנקודה: $-0.027$.',
        2: 'שלושה גורמים שליליים: זוג אחד נותן פלוס, ונשאר מינוס אחד. התוצאה שלילית.',
      } },
    { kind: 'rule', fig: tiles([{ tiles: ['−3/4', '−3/4'], post: '= 9/16' }], 'שני גורמים של מינוס שלושה רבעים, שווים תשעה חלקי שש עשרה'),
      text: 'בשבר מעלים בחזקה גם את המונה וגם את המכנה.',
      display: '\\left(-\\frac{3}{4}\\right)^2 = \\frac{(-3)^2}{4^2} = \\frac{9}{16}',
      why: 'כופלים שבר בשבר: מונה כפול מונה, ומכנה כפול מכנה. $\\left(-\\frac{3}{4}\\right)\\left(-\\frac{3}{4}\\right) = \\frac{9}{16}$, ולא $\\frac{9}{4}$.' },
  ],
  examples: [
    { problem: 'חשבו:', display: '-(-5)^2', answer: -25, check: '-(-5)^2',
      steps: [
        { action: 'קודם החזקה: $(-5)^2 = +25$.', why: 'הסוגריים צמודים למעריך, ולכן $-5$ כולו מוכפל בעצמו: $(-5)(-5) = +25$. המינוס שלפני הסוגריים מחכה.', result: '-(+25)', value: '-(+25)', calc: { expr: '(-5)^2', value: 25 } },
        { action: 'ואז המינוס שבחוץ: הנגדי של $25$.', why: 'המינוס שלפני הסוגריים לא שייך לחזקה. הוא הופך את התוצאה לנגדית.', result: '-(+25) = -25', value: '-25', fig: mirror(25, '(\u22125)²', '\u2212(\u22125)²') },
      ] },
    { problem: 'חשבו:', display: '-(-5^2)', answer: 25, check: '-(-5^2)',
      steps: [
        { action: 'קודם החזקה: $5^2 = 25$.', why: 'בתוך הסוגריים המעריך צמוד רק ל־$5$, ולכן $-5^2 = (-5 \\cdot 5) = -25$.', result: '-(-25)', value: '-(-25)', calc: { expr: '5^2', value: 25 } },
        { action: 'אחר כך המינוס שבפנים, ובסוף המינוס שבחוץ.', why: 'קודם החזקה, אחר כך המינוס שבפנים, ובסוף המינוס שבחוץ: הנגדי של $-25$ הוא $25$.', result: '-(-25) = +25 = 25', value: '25', fig: mirror(25, '\u2212(\u22125²)', '\u22125²') },
      ] },
    { problem: 'חשבו:', display: '9 - 2 \\cdot (-3)^3', answer: 63, check: '9 - 2*(-3)^3',
      steps: [
        { action: 'קודם החזקה: $(-3)^3 = -27$.', why: 'חזקה באה לפני כפל וחיסור: $(-3)(-3)(-3) = -27$. מעריך אי־זוגי, ולכן נשאר מינוס.', result: '9 - 2 \\cdot (-27)', value: '9 - 2*(-27)', calc: { expr: '(-3)^3', value: -27 } },
        { action: 'אחר כך הכפל: $2 \\cdot (-27) = -54$.', why: 'כפל לפני חיסור. סימנים שונים, ולכן התוצאה שלילית.', result: '9 - (-54)', value: '9 - (-54)', calc: { expr: '2*(-27)', value: -54 } },
        { action: 'ובסוף החיסור: חיסור של מספר שלילי הוא חיבור.', why: '$9 - (-54) = 9 + 54$. מי שמחסר קודם $9 - 2$ מקבל $7 \\cdot (-27) = -189$, וזה סדר אחר.', result: '9 + 54 = 63', value: '9 + 54', fig: { type: 'numline', from: 0, to: 72, step: 9, marks: [{ x: 9, label: '9' }], jumps: [{ from: 9, to: 63, label: '\u2212(\u221254)' }] } },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '-2^4',
      steps: [
        { prompt: 'למה שייך המעריך $4$?', choices: [
          { text: 'רק ל־$2$', ok: true, feedback: 'נכון: אין סוגריים, ולכן הבסיס הוא $2$. המינוס מחכה בחוץ.' },
          { text: 'ל־$-2$ כולו', ok: false, feedback: 'כדי שהמינוס יהיה חלק מהבסיס צריך סוגריים, $(-2)^4$. כאן אין סוגריים.' },
        ], hints: ['יש כאן סוגריים?', 'בלי סוגריים, המעריך שייך רק למספר שצמוד אליו.'], done: '$-2^4 = (-2 \\cdot 2 \\cdot 2 \\cdot 2)$' },
        { prompt: 'כמה זה $2^4$?', choices: [
          { text: '$16$', ok: true, feedback: 'נכון: $2 \\cdot 2 \\cdot 2 \\cdot 2 = 16$.' },
          { text: '$8$', ok: false, feedback: '$8$ הוא $2 \\cdot 4$. חזקה היא כפל חוזר: ארבעה גורמים של $2$.' },
        ], hints: ['כמה פעמים כופלים את $2$ בעצמו?', '$2 \\cdot 2 = 4$, ואחר כך עוד פעמיים כפול $2$.'], done: '$2^4 = 16$' },
      ],
      final: { prompt: 'וכמה זה $-2^4$?', answer: -16, check: '-2^4', hints: ['המינוס שבחוץ נשאר לפני התוצאה.', 'קודם $2^4 = 16$, ואחר כך המינוס: $-16$.'] } },
    { problem: 'ועכשיו חזקה בסדר פעולות.', display: '5 - 4 \\cdot (-2)^2',
      steps: [
        { prompt: 'מה מחשבים קודם?', choices: [
          { text: 'את החזקה: $(-2)^2$', ok: true, feedback: 'נכון: חזקה באה לפני כפל וחיסור.' },
          { text: '$5 - 4$', ok: false, feedback: 'החיסור מחכה לסוף: $4$ מוכפל בחזקה, ו־$5$ לא.' },
          { text: '$4 \\cdot (-2)$', ok: false, feedback: 'המעריך שייך לסוגריים $(-2)$: קודם $(-2)^2$, ורק אחר כך כופלים ב־$4$.' },
        ], hints: ['חזקה, כפל או חיסור: מה בא ראשון?', 'קודם $(-2)^2$.'], done: '$(-2)^2 = (-2)(-2) = 4$' },
        { prompt: 'נשאר $5 - 4 \\cdot 4$. מה הלאה?', choices: [
          { text: 'הכפל: $4 \\cdot 4 = 16$', ok: true, feedback: 'נכון: כפל לפני חיסור.' },
          { text: '$5 - 4 = 1$, ואז כפול $4$', ok: false, feedback: 'החיסור בא בסוף, ו־$5$ לא מוכפל.' },
        ], hints: ['כפל או חיסור?', 'קודם $4 \\cdot 4$.'], done: '$5 - 16$' },
      ],
      final: { prompt: 'כמה זה?', answer: -11, check: '5 - 4*(-2)^2', hints: ['$5 - 16$: מחסרים יותר ממה שיש, והתוצאה שלילית.', '$16 - 5 = 11$, והסימן מינוס.'] } },
  ],
  diag: powModel,
  transfer: gameModel,
  words: ['חזקה', 'בסיס', 'מעריך', 'מעריך זוגי', 'מעריך אי־זוגי'],
  misconceptions: [
    { id: 'pow-neg-base', title: 'קראו $-a^2$ כאילו כתוב $(-a)^2$: החזקה שייכת רק למספר, והמינוס נשאר בחוץ',
      cause: 'בלי סוגריים המינוס הוא לא חלק מהבסיס. המעריך שייך רק למספר שצמוד אליו.',
      explain: ['ב־$-4^2$ אין סוגריים, ולכן הבסיס הוא $4$: קודם $4^2 = 16$, והמינוס נשאר. $-4^2 = (-4 \\cdot 4) = -16$.', 'רק כשכתוב $(-4)^2$, עם סוגריים, הבסיס הוא $-4$ ויוצא $16$.'],
      remedy: [
        { kind: 'predict', fig: tiles([{ pre: '−', tiles: ['4', '4'] }], 'מינוס, ואחריו שני גורמים של 4'), text: 'ב־$-4^2$, למה שייך המעריך?', choices: ['רק ל־$4$', 'ל־$-4$ כולו'], answer: 0,
          why: 'אין סוגריים, ולכן המעריך שייך רק ל־$4$: $-4^2 = (-4 \\cdot 4) = -16$.' },
        { kind: 'predict', text: 'ועם סוגריים: כמה זה $(-4)^2$?', choices: ['$16$', '$-16$'], answer: 0,
          why: 'עכשיו הבסיס הוא $-4$: $(-4)(-4) = 16$. הסוגריים הם ההבדל.' },
      ] },
    { id: 'pow-odd-pos', title: 'חשבו שמספר שלילי בחזקה יוצא תמיד חיובי (במעריך אי־זוגי התוצאה שלילית)', prereq: 'signed:3',
      cause: 'זוכרים ש"מינוס כפול מינוס זה פלוס", אבל במעריך אי־זוגי נשאר עוד מינוס אחד אחרי כל הזוגות.',
      explain: ['כופלים שניים שניים: $(-3)(-3) = 9$, ואז $9 \\cdot (-3) = -27$.', 'כל זוג מינוסים נותן פלוס. במעריך אי־זוגי נשאר מינוס אחד, והתוצאה שלילית.'],
      remedy: [
        { kind: 'predict', fig: tiles([{ tiles: ['−3', '−3', '−3'] }], 'שלושה גורמים של מינוס 3'), text: 'בלי לחשב את הגודל: $(-3)^3$ חיובי או שלילי?', choices: ['שלילי', 'חיובי'], answer: 0,
          why: 'שלושה גורמים שליליים: זוג אחד נותן פלוס, ונשאר מינוס אחד. $(-3)^3 = -27$.' },
        { kind: 'predict', text: 'בכל שורה עוד גורם $-1$. מה יוצא בשורה האחרונה?', display: aligned(['(-1)^1 &= -1', '(-1)^2 &= 1', '(-1)^3 &= \\;?']), choices: ['$-1$', '$1$'], answer: 0,
          why: 'כל גורם $-1$ הופך את הסימן: $-1$, אחר כך $1$, ושוב $-1$. מעריך אי־זוגי משאיר את המינוס.' },
      ] },
    { id: 'pow-keep-sign', title: 'השאירו את המינוס של הבסיס גם במעריך זוגי ($(-5)^2 = -25$)',
      cause: 'רואים מינוס בבסיס ומעתיקים אותו לתוצאה. אבל במעריך זוגי המינוסים מתקזזים בזוגות.',
      explain: ['$(-5)^2 = (-5)(-5)$: שני גורמים שליליים, והמכפלה שלהם חיובית, $25$.', 'במעריך זוגי כל המינוסים מתקזזים בזוגות, ולכן התוצאה חיובית.'],
      remedy: [
        { kind: 'predict', fig: tiles([{ tiles: ['−7', '−7'] }], 'שני גורמים של מינוס 7'), text: 'כמה זה $(-7)^2$?', choices: ['$49$', '$-49$'], answer: 0,
          why: '$(-7)(-7)$: שלילי כפול שלילי נותן חיובי. $(-7)^2 = 49$.' },
        { kind: 'predict', text: 'ו־$(-2)^4$: חיובי או שלילי?', choices: ['חיובי', 'שלילי'], answer: 0,
          why: 'ארבעה גורמים שליליים הם שני זוגות, וכל זוג נותן פלוס: $(-2)^4 = 16$.' },
      ] },
    { id: 'outer-minus', title: 'התעלמו מהמינוס שלפני הסוגריים',
      cause: 'בתרגיל יש שני מינוסים: אחד בתוך החזקה ואחד לפניה. את המינוס שבחוץ קל לשכוח, כי הוא בא בסוף.',
      explain: ['ב־$-(-5)^2$ קודם החזקה: $(-5)^2 = 25$. אחר כך המינוס שבחוץ: $-(+25) = -25$.', 'המינוס שלפני הסוגריים הופך את מה שיצא בתוכם לנגדי.'],
      remedy: [
        { kind: 'predict', text: 'ב־$-(-4)^2$ חישבנו $(-4)^2 = 16$. מה עושים עכשיו?', choices: ['לוקחים את הנגדי: $-16$', 'מסיימים: $16$'], answer: 0,
          why: 'המינוס שלפני הסוגריים עוד לא עשה כלום: $-(+16) = -16$.' },
        { kind: 'predict', text: 'ו־$-(-2^2)$?', choices: ['$4$', '$-4$'], answer: 0,
          why: 'בפנים $-2^2 = -4$, והמינוס שבחוץ הופך אותו: $-(-4) = 4$.' },
      ] },
    { id: 'pow-times', title: 'כפלו את הבסיס במעריך במקום כפל חוזר ($(-5)^2 = -10$)',
      cause: 'המעריך הוא לא מספר שכופלים בו. הוא אומר כמה פעמים כופלים את הבסיס בעצמו.',
      explain: ['$(-5)^2$ הוא $(-5)(-5) = 25$, לא $(-5) \\cdot 2 = -10$.', 'המעריך סופר את הגורמים: $4^3 = 4 \\cdot 4 \\cdot 4$, שלושה גורמים.'],
      remedy: [
        { kind: 'say', fig: tiles([{ tiles: ['4', '4', '4'], under: '3 פעמים' }], 'שלושה גורמים של 4'), text: '$4^3$ הוא שלושה גורמים של $4$, זה ליד זה.', display: '4^3 = 4 \\cdot 4 \\cdot 4 = 64' },
        { kind: 'predict', text: 'כמה זה $3^4$?', choices: ['$81$', '$12$'], answer: 0,
          why: 'ארבעה גורמים של $3$: $3 \\cdot 3 \\cdot 3 \\cdot 3 = 81$. המספר $12$ הוא $3 \\cdot 4$.' },
      ] },
    { id: 'order', title: 'חיסרו לפני הכפל (הסדר: חזקה, כפל, ואז חיסור)', prereq: 'signed:4',
      cause: 'בתרגיל עם חזקה יש שלוש פעולות. חישוב משמאל לימין מחסר לפני שכופלים.',
      explain: ['ב־$9 - 2 \\cdot (-3)^3$ קודם החזקה, $-27$, אחר כך הכפל, $-54$, ובסוף החיסור: $9 - (-54) = 63$.', 'מי שמחסר קודם $9 - 2$ מכפיל גם את $9$, וזה תרגיל אחר.'],
      remedy: [
        { kind: 'predict', text: 'מה מחשבים קודם ב־$10 - 3 \\cdot (-2)^2$?', choices: ['$(-2)^2$', '$10 - 3$'], answer: 0,
          why: 'קודם החזקה: $(-2)^2 = 4$. אחר כך $3 \\cdot 4 = 12$, ובסוף $10 - 12 = -2$.' },
        { kind: 'predict', text: 'אחרי החזקה נשאר $10 - 3 \\cdot 4$. מה הלאה?', choices: ['$3 \\cdot 4 = 12$', '$10 - 3 = 7$'], answer: 0,
          why: 'כפל לפני חיסור: $3 \\cdot 4 = 12$, ואז $10 - 12 = -2$.' },
      ] },
    { id: 'dec-places', title: 'טעו במספר המקומות אחרי הנקודה ($(-0.3)^3 = -0.27$)',
      cause: 'בכפל של עשרוניים סופרים את הספרות אחרי הנקודה בכל הגורמים יחד, לא רק באחד מהם.',
      explain: ['$(-0.3)^3$: שלושה גורמים, ובכל אחד ספרה אחת אחרי הנקודה. לכן בתוצאה שלוש ספרות: $-0.027$.', 'אפשר לבדוק בשבר: $\\frac{3}{10} \\cdot \\frac{3}{10} \\cdot \\frac{3}{10} = \\frac{27}{1000}$.'],
      remedy: [
        { kind: 'predict', text: 'כמה זה $0.2 \\cdot 0.2$?', choices: ['$0.04$', '$0.4$'], answer: 0,
          why: '$\\frac{2}{10} \\cdot \\frac{2}{10} = \\frac{4}{100} = 0.04$: שתי ספרות אחרי הנקודה, אחת מכל גורם.' },
        { kind: 'predict', text: 'ו־$(-0.4)^3$?', choices: ['$-0.064$', '$-0.64$'], answer: 0,
          why: 'שלושה גורמים, ולכן שלוש ספרות אחרי הנקודה: $-\\frac{64}{1000} = -0.064$.' },
      ] },
    { id: 'num-only', title: 'העלו בחזקה רק את המונה ($(-\\tfrac{3}{4})^2 = \\tfrac{9}{4}$)',
      cause: 'בכפל של שברים כופלים מונה במונה ומכנה במכנה. בחזקה של שבר גם המכנה מוכפל בעצמו.',
      explain: ['$\\left(-\\frac{3}{4}\\right)^2 = \\left(-\\frac{3}{4}\\right)\\left(-\\frac{3}{4}\\right) = \\frac{9}{16}$.', 'גם המונה וגם המכנה עולים בחזקה: $\\frac{(-3)^2}{4^2} = \\frac{9}{16}$.'],
      remedy: [
        { kind: 'predict', text: 'כמה זה $\\left(\\frac{3}{5}\\right)^2$?', choices: ['$\\frac{9}{25}$', '$\\frac{9}{5}$'], answer: 0,
          why: '$\\frac{3}{5} \\cdot \\frac{3}{5}$: מונה כפול מונה ומכנה כפול מכנה, $\\frac{9}{25}$.' },
      ] },
  ],
};

export const SIGNED7: StairContent[] = [stair7];
/** Names of misconceptions new with this stair: none beyond the topic's own (content/grade7.js names them). */
export const CATS_SIGNED7: Record<string, string> = {};
export { powModel, gameModel };
