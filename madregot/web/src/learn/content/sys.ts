// Equations and systems (משוואות ומערכות), grade 8, in the order of the Ministry's grade 8 programme: equations with a
// percent change, a system by substitution, by equal coefficients, word problems with two unknowns, and inequalities.
// This is the critique's grade 8 topic: percent equations come first because they are what a grade 8 student meets
// next (December to January), systems get three stairs (13 hours in the curriculum), and inequalities one, with the
// flip and the wrong flip side by side.
// One idea carries the stairs: a solution is checked by putting it back in: a percent story with its numbers, a pair
// in both equations, an inequality with one number from the range.
// The diagnostic models use the practice generators' own draws and worked solutions (content/sys.js), so a question
// of a check and an exercise of practice read alike. Every misconception's source is listed in content/sys.js.
// Teaching content: see MADREGOT2.md (content conventions) and content/signed.ts (the quality bar).
import type { DiagModel, ManipSpec, StairContent } from '../types';
import { rint, same } from '../expr';
import { slipOf } from '../misconceptions';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/sys.js';
// @ts-ignore: plain JS helpers shared with the exercise generators
import { T } from '@/content/util.js';

/**
 * Draws until no misconception of the model predicts what a slip of the hand gives (one off, ten off, two digits
 * swapped): diagnose() reads a matching prediction before a slip, so such a draw would turn a slip into evidence.
 */
function fair<P>(draw: () => P, answer: (p: P) => number, bugs: Record<string, (p: P) => number | null>): P {
  for (;;) {
    const p = draw(); const a = answer(p);
    if (Object.values(bugs).every((f) => { const v = f(p); return v == null || same(v, a) || !slipOf(v, a); })) return p;
  }
}
const lines = (a: [number, number], b: [number, number]): ManipSpec => ({ kind: 'plot', range: 6, label: '', start: null, lines: [{ m: a[0], b: a[1] }, { m: b[0], b: b[1] }] });
const area = (): ManipSpec => ({ kind: 'area', start: { a: 1, b: 0 }, maxA: 6, maxB: 9 });
const ray = (start: { at: number; dir: 1 | -1; closed: boolean }): ManipSpec => ({ kind: 'ray', min: -10, max: 10, start });
const pins = (vals: number[], start: number[]): ManipSpec => ({ kind: 'pins', min: -10, max: 10, labels: vals.map((v) => (v < 0 ? `−${-v}` : `${v}`)), start });

// ================================================================ stair 1: equations with percents (משוואות עם אחוזים)

type Pct = { k: 0 | 1; up: boolean; p: number; x: number; N: number; n: number; cheap: boolean; o: number; T: number; q: number };
const pctAnswer = (p: Pct) => (p.k === 0 ? p.x : G.togetherAnswer(p));
const pctBugs: Record<string, (p: Pct) => number | null> = {
  // the percent taken of the new price: after +20% the price is 60, and 60 − 12 = 48
  'pct-of-new': (p) => (p.k === 0 ? G.pctOfNew(p) : null),
  // two prices: the one the equation finds (the base) answered when the other was asked
  'wrong-unknown': (p) => (p.k === 1 && p.q === 1 ? p.x : null),
};
const pctModel: DiagModel<Pct> = {
  // one shape for both kinds of question: each kind reads only its own fields (k says which)
  params: (rnd) => fair(() => (rnd() < 0.65 ? { k: 0, ...G.pctDraw(rnd) } : { k: 1, ...G.togetherDraw(rnd) }) as Pct, pctAnswer, pctBugs),
  text: (p) => (p.k === 0 ? G.pctText(p) : G.togetherText(p)),
  answer: pctAnswer,
  bugs: pctBugs,
  solution: (p) => (p.k === 0 ? G.pctSolution(p) : G.togetherSolution(p)),
  hint: (p) => (p.k === 0 ? G.pctHint(p) : G.togetherHint(p)),
  unit: '₪',
};

type Growth = { up: boolean; p: number; x: number; N: number; c: number; q: number };
const PLACES = [['במועדון הספורט', 'חברים'], ['בבית הספר', 'תלמידים'], ['בספרייה העירונית', 'קוראים רשומים']];
const growthAnswer = (p: Growth) => (p.q === 0 ? p.x : (p.x * p.p) / 100);
const growthBugs: Record<string, (p: Growth) => number | null> = {
  // the percent taken of this year's number: before, or the change itself
  'pct-of-new': (p) => (p.q === 0 ? G.change(p.N, !p.up, p.p) : (p.N * p.p) / 100),
  // last year's number answered when the change was asked
  'wrong-unknown': (p) => (p.q === 1 ? p.x : null),
};
const growthModel: DiagModel<Growth> = {
  // the same idea with numbers of people: this year is p% more (or less) than last year
  params: (rnd) => fair(() => {
    const up = rnd() < 0.6; const p = [5, 10, 15, 20, 25, 30, 40][rint(rnd, 0, 6)];
    const step = 100 / [5, 10, 5, 20, 25, 10, 20][[5, 10, 15, 20, 25, 30, 40].indexOf(p)];
    const x = step * rint(rnd, Math.ceil(100 / step), Math.floor(900 / step));
    return { up, p, x, N: G.change(x, up, p), c: rint(rnd, 0, PLACES.length - 1), q: rnd() < 0.6 ? 0 : 1 };
  }, growthAnswer, growthBugs),
  text: (p) => {
    const [where, who] = PLACES[p.c];
    return `השנה יש ${where} $${p.N}$ ${who}, $${p.p}\\%$ ${p.up ? 'יותר' : 'פחות'} מבשנה שעברה. ${p.q === 0 ? `כמה ${who} היו ${where} בשנה שעברה?` : `בכמה ${p.up ? 'עלה' : 'ירד'} מספר ה${who} מהשנה שעברה?`}`;
  },
  answer: growthAnswer,
  bugs: growthBugs,
  solution: (p) => {
    const who = PLACES[p.c][1]; const m = G.dec(G.mult(p.up, p.p)); const d = (p.x * p.p) / 100;
    return [
      `נסמן ב־$x$ את מספר ה${who} בשנה שעברה. השנה יש $${p.up ? 100 + p.p : 100 - p.p}\\%$ ממנו: $${m}x = ${p.N}$`,
      `מחלקים ב־$${m}$: $x = ${p.x}$`,
      ...(p.q === 1 ? [`השינוי: $${p.p}\\%$ מ־$${p.x}$ הם $${d}$.`] : []),
      `בדיקה: $${p.x} ${p.up ? '+' : '-'} ${d} = ${p.N}$.`,
    ];
  },
  hint: (p) => `האחוזים הם ממספר השנה שעברה. נסמנו אותו ב־$x$: השנה יש $${G.dec(G.mult(p.up, p.p))}x$.${p.q === 1 ? ' ובסוף: שאלו על השינוי, לא על מספר השנה שעברה.' : ''}`,
};

const stair1: StairContent = {
  skill: 'sys:1', topic: 'sys', level: 1, title: 'משוואות עם אחוזים',
  objectives: [
    'לכתוב הגדלה או הקטנה באחוזים ככפל: עוד $20\\%$ הם כפל ב־$1.2$, והנחה של $30\\%$ היא כפל ב־$0.7$.',
    'לבנות משוואה כשהכמות המקורית לא ידועה, ולפתור אותה.',
    'לזכור שהאחוזים הם מהכמות שמשווים אליה, ולבדוק בסוף עם המספרים של הסיפור.',
  ],
  idea: 'אחוזים הם תמיד מהכמות המקורית. כשהיא לא ידועה, מסמנים אותה ב־$x$, כותבים את השינוי ככפל, ופותרים משוואה.',
  why: [
    'המחיר המקורי הוא $100\\%$. עוד $20\\%$ הם $120\\%$ ממנו, כלומר $1.2x$. הנחה של $30\\%$ משאירה $70\\%$, כלומר $0.7x$.',
    '$20\\%$ מהמחיר החדש הם לא $20\\%$ מהמחיר הישן, כי המספרים שונים. לכן לא מורידים $20\\%$ מהמחיר החדש, אלא פותרים $1.2x = 60$.',
  ],
  alt: [
    'אפשר לחשוב באחוזים: $120\\%$ הם $60$, אז $1\\%$ הוא $60 : 120 = 0.5$, ו־$100\\%$ הם $50$.',
    'בדיקה במספר תמיד עוזרת: אם המחיר היה $50$, אחרי $20\\%$ הוא $60$. אם היה $48$, אחרי $20\\%$ הוא רק $57.6$.',
  ],
  discover: [
    { kind: 'predict', text: 'משחק עלה $50$ ₪, והמחיר שלו עלה ב־$20\\%$. מה המחיר החדש?', choices: ['$60$', '$70$', '$10$'], answer: 0,
      why: '$20\\%$ מ־$50$ הם $10$, ולכן $50 + 10 = 60$. ואפשר בצעד אחד: $1.2 \\cdot 50 = 60$, כי המחיר החדש הוא $120\\%$ מהישן.',
      wrongWhy: { 1: '$70$ הוא $50 + 20$, כאילו $20\\%$ הם $20$ ₪. אבל $20\\%$ מ־$50$ הם $10$.', 2: '$10$ הוא רק ההתייקרות. המחיר החדש הוא הישן ועוד $10$.' } },
    { kind: 'rule', text: 'הגדלה באחוזים היא כפל: עוד $20\\%$ הם כפל ב־$1.2$. הקטנה היא כפל: פחות $30\\%$ הם כפל ב־$0.7$.', display: '\\begin{aligned} x + 0.2x &= 1.2x \\\\ x - 0.3x &= 0.7x \\end{aligned}',
      why: 'המחיר הישן הוא $100\\%$. עוד $20\\%$ הם $120\\%$, כלומר $1.2$ כפול המחיר. הנחה של $30\\%$ משאירה $70\\%$, כלומר $0.7$ כפול המחיר.' },
    { kind: 'predict', text: 'ועכשיו הפוך: אחרי התייקרות של $20\\%$ משחק עולה $60$ ₪. כמה הוא עלה לפני?', choices: ['$48$', '$50$', '$40$'], answer: 1,
      why: 'המחיר הישן $x$, והחדש $1.2x$: $1.2x = 60$, ולכן $x = 60 : 1.2 = 50$. בדיקה: $20\\%$ מ־$50$ הם $10$, ו־$50 + 10 = 60$.',
      wrongWhy: { 0: '$48$ הוא $60$ פחות $20\\%$ מ־$60$. אבל ה־$20\\%$ הם מהמחיר הישן. בדיקה: $20\\%$ מ־$48$ הם $9.6$, ו־$48 + 9.6 = 57.6$, לא $60$.', 2: '$40$ הוא $60 - 20$, כאילו $20\\%$ הם $20$ ₪.' } },
    { kind: 'rule', text: 'המחיר הישן לא ידוע? מסמנים אותו ב־$x$, ובונים משוואה עם הכפל.', display: '1.2x = 60 \\;\\Rightarrow\\; x = 50',
      why: 'האחוזים הם מהמחיר הישן, וזה $x$. מחלקים את שני האגפים ב־$1.2$, ובודקים עם המספרים של הסיפור.' },
    { kind: 'predict', text: 'אחרי הנחה של $25\\%$ חולצה עולה $60$ ₪. $x$ הוא המחיר לפני ההנחה. איזו משוואה מתאימה?', choices: ['$0.75x = 60$', '$0.25x = 60$', '$x - 0.25 = 60$'], answer: 0,
      why: 'אחרי הנחה של $25\\%$ נשארים $75\\%$ מהמחיר: $0.75x = 60$, ולכן $x = 80$. בדיקה: $25\\%$ מ־$80$ הם $20$, ו־$80 - 20 = 60$.',
      wrongWhy: { 1: '$0.25x$ הוא סכום ההנחה, לא מה ששילמו.', 2: 'ההנחה היא $25\\%$ מהמחיר, כלומר $0.25x$ ₪, ולא $0.25$ ₪.' } },
    { kind: 'predict', text: 'התפוחים יקרים ב־$25\\%$ מהאגסים. הילה סימנה: אגסים $x$, תפוחים $1.25x$. צופיה סימנה: תפוחים $x$, אגסים $0.75x$. מי צודקת?', choices: ['צופיה', 'הילה', 'שתיהן'], answer: 1,
      why: 'האחוזים הם מהאגסים, כי משווים אליהם. אם קילו אגסים עולה $8$ ₪, תפוחים עולים $1.25 \\cdot 8 = 10$ ₪. אבל $0.75 \\cdot 10 = 7.5$, לא $8$.',
      wrongWhy: { 0: 'בדיקה במספר: תפוחים $10$, ואגסים $0.75 \\cdot 10 = 7.5$. אז התפוחים יקרים ב־$2.5$ ₪, יותר מ־$25\\%$ מ־$7.5$.', 2: 'הן יקבלו פתרונות שונים. עם אגסים ב־$8$ ותפוחים ב־$10$ רק הסימון של הילה מתאים.' } },
    { kind: 'rule', text: 'האחוזים הם מהכמות שמשווים אליה. "יקר ב־$25\\%$ מהאגסים" הוא $25\\%$ מהאגסים.', display: '8 \\cdot 1.25 = 10',
      why: 'יקר ב־$25\\%$ וזול ב־$25\\%$ הם לא אותו דבר, כי אלה אחוזים ממספרים שונים: התפוחים יקרים מהאגסים ב־$25\\%$, אבל האגסים זולים מהתפוחים רק ב־$20\\%$.' },
  ],
  examples: [
    { problem: 'החולצה זולה ב־$30\\%$ מהמכנסיים. אלון שילם על שניהם $204$ ₪. כמה עלו המכנסיים?', answer: 120, check: '204 / 1.7',
      steps: [
        { action: 'מסמנים ב־$x$ את מחיר המכנסיים.', why: 'האחוזים הם מהמכנסיים. החולצה זולה ב־$30\\%$: $70\\%$ מהם, $0.7x$.', result: 'x,\\quad 0.7x' },
        { action: 'יחד שילם $204$ ₪.', why: 'מחיר המכנסיים ועוד מחיר החולצה.', result: 'x + 0.7x = 204', eq: 'x + 0.7*x = 204' },
        { action: 'מכנסים איברים דומים.', why: '$x$ הוא $1x$, ו־$1 + 0.7 = 1.7$.', result: '1.7x = 204', eq: '1.7*x = 204' },
        { action: 'מחלקים את שני האגפים ב־$1.7$.', why: '$204 : 1.7 = 120$.', result: 'x = 120', eq: 'x = 120' },
        { action: 'בודקים: החולצה ועוד המכנסיים.', why: 'החולצה: $0.7 \\cdot 120 = 84$ ₪.', result: '120 + 84 = 204', calc: { expr: '120 + 0.7*120', value: 204 } },
      ] },
    { problem: 'אחרי הנחה של $15\\%$ אופניים עולים $680$ ₪. כמה הם עלו לפני ההנחה?', answer: 800, check: '680 / 0.85',
      steps: [
        { action: 'מסמנים ב־$x$ את המחיר לפני ההנחה.', why: 'אחרי הנחה של $15\\%$ נשארים $85\\%$ מהמחיר.', result: '0.85x = 680', eq: '0.85*x = 680' },
        { action: 'מחלקים את שני האגפים ב־$0.85$.', why: '$680 : 0.85 = 800$.', result: 'x = 800', eq: 'x = 800' },
        { action: 'בודקים עם המספרים של הסיפור.', why: '$15\\%$ מ־$800$ הם $120$.', result: '800 - 120 = 680', calc: { expr: '800 - 0.15*800', value: 680 } },
      ] },
    { problem: 'בשני אולמות קולנוע יש יחד $240$ צופים. אם $20\\%$ מהצופים באולם א׳ יעברו לאולם ב׳, יהיה בשני האולמות אותו מספר צופים. כמה צופים יש באולם א׳?', answer: 150, check: '240 / 1.6',
      steps: [
        { action: 'מסמנים ב־$x$ את הצופים באולם א׳.', why: 'באולם ב׳ כל השאר: $240 - x$.', result: 'x,\\quad 240 - x' },
        { action: 'עוברים $20\\%$ מאולם א׳, כלומר $0.2x$ צופים.', why: 'באולם א׳ נשארים $0.8x$, ולאולם ב׳ נוספים $0.2x$. אז הם שווים.', result: '0.8x = 240 - x + 0.2x', eq: '0.8*x = 240 - x + 0.2*x' },
        { action: 'מוסיפים $x$ ומחסירים $0.2x$, בשני האגפים.', why: '$0.8x + x - 0.2x = 1.6x$.', result: '1.6x = 240', eq: '1.6*x = 240' },
        { action: 'מחלקים ב־$1.6$.', why: '$240 : 1.6 = 150$.', result: 'x = 150', eq: 'x = 150' },
        { action: 'בודקים: $20\\%$ מ־$150$ הם $30$ צופים.', why: 'באולם א׳ נשארים $120$. באולם ב׳ היו $90$, ועכשיו $120$.', result: '150 - 30 = 90 + 30', calc: { expr: '150 - 30', value: 120 } },
      ] },
  ],
  together: [
    { problem: 'אחרי התייקרות של $10\\%$ כרטיס להופעה עולה $55$ ₪.',
      steps: [
        { prompt: 'המחיר החדש הוא כמה אחוזים מהמחיר הישן?', choices: [
          { text: '$110\\%$', ok: true, feedback: 'נכון: $100\\%$ ועוד $10\\%$. כלומר $1.1$ כפול המחיר הישן.' },
          { text: '$10\\%$', ok: false, feedback: '$10\\%$ הם רק ההתייקרות. המחיר החדש הוא הישן ועוד ההתייקרות.' },
          { text: '$90\\%$', ok: false, feedback: '$90\\%$ הם אחרי הנחה. כאן המחיר עלה.' },
        ], hints: ['המחיר הישן הוא $100\\%$. מה מוסיפים לו?', '$100\\% + 10\\% = 110\\%$, כלומר $1.1$.'], done: 'המחיר החדש: $1.1x$.' },
        { prompt: 'איזו משוואה מתאימה?', choices: [
          { text: '$1.1x = 55$', ok: true, feedback: 'נכון: $110\\%$ מהמחיר הישן הם $55$.' },
          { text: '$x = 55 - 5.5$', ok: false, feedback: '$5.5$ הם $10\\%$ מ־$55$, המחיר החדש. האחוזים הם מהמחיר הישן.' },
          { text: '$x + 10 = 55$', ok: false, feedback: 'ההתייקרות היא $10\\%$ מהמחיר, לא $10$ ₪.' },
        ], hints: ['האחוזים הם מ־$x$, המחיר הישן.', '$110\\%$ מ־$x$ הם $1.1x$, והם $55$.'], done: '$1.1x = 55$' },
      ],
      final: { prompt: 'כמה שקלים עלה הכרטיס לפני ההתייקרות?', answer: 50, check: '55 / 1.1', hints: ['מחלקים את $55$ ב־$1.1$.', 'זה כמו $550 : 11$.'] } },
    { problem: 'מחיר של מעיל עלה ב־$20\\%$, ואחר כך ירד ב־$20\\%$. עכשיו הוא עולה $96$ ₪.',
      steps: [
        { prompt: 'בכמה כפול המחיר המקורי אחרי שני השינויים?', choices: [
          { text: '$1.2 \\cdot 0.8 = 0.96$', ok: true, feedback: 'נכון: קודם כפל ב־$1.2$, אחר כך ב־$0.8$.' },
          { text: '$1$: עלה וירד באותו אחוז', ok: false, feedback: 'הירידה היא $20\\%$ מהמחיר הגבוה, ולכן יורדים יותר ממה שעלו. $1.2 \\cdot 0.8 = 0.96$.' },
          { text: '$1.4$', ok: false, feedback: 'ירידה של $20\\%$ היא כפל ב־$0.8$, לא תוספת.' },
        ], hints: ['עלייה של $20\\%$ היא כפל ב־$1.2$. ומה ירידה של $20\\%$?', 'ירידה היא כפל ב־$0.8$, ושני כפלים זה אחרי זה: $1.2 \\cdot 0.8$.'], done: '$0.96x = 96$' },
      ],
      final: { prompt: 'כמה שקלים עלה המעיל בהתחלה?', answer: 100, check: '96 / 0.96', hints: ['מחלקים את $96$ ב־$0.96$.', 'זה כמו $9600 : 96$.'] } },
  ],
  diag: pctModel,
  transfer: growthModel,
  misconceptions: [
    { id: 'pct-of-new', title: 'האחוזים חושבו מהמחיר החדש במקום מהמחיר המקורי',
      cause: 'בשאלה כתוב רק המחיר החדש, ולכן מחשבים את האחוזים ממנו. אבל ההתייקרות או ההנחה היו אחוזים מהמחיר המקורי.',
      explain: ['נראה שהאחוזים נלקחו מהמחיר החדש.', 'אחרי התייקרות של $20\\%$ המחיר $60$: המקורי $x$ הוא $100\\%$, והחדש $120\\%$. $1.2x = 60$, ולכן $x = 50$, ולא $60 - 12 = 48$.'],
      prereq: 'eq:1',
      remedy: [
        { kind: 'predict', text: 'מחיר של $48$ ₪ התייקר ב־$20\\%$. מה המחיר החדש?', choices: ['$57.6$', '$60$'], answer: 0,
          why: '$20\\%$ מ־$48$ הם $9.6$, ו־$48 + 9.6 = 57.6$. לכן $48$ לא יכול להיות המחיר שהתייקר והגיע ל־$60$.' },
        { kind: 'predict', text: 'אחרי התייקרות של $20\\%$ המחיר $60$ ₪. מה היה המחיר לפני?', choices: ['$48$', '$50$'], answer: 1,
          why: '$1.2x = 60$, ולכן $x = 50$. בדיקה: $20\\%$ מ־$50$ הם $10$, ו־$50 + 10 = 60$.' },
        { kind: 'rule', text: 'האחוזים הם מהמחיר המקורי. מסמנים אותו ב־$x$ ובונים משוואה.', display: '1.2x = 60 \\;\\Rightarrow\\; x = 50',
          why: 'המחיר המקורי לא ידוע, ולכן אי אפשר לחשב ממנו אחוזים ישר. המשוואה עושה את זה בשבילנו.' },
      ] },
    { id: 'wrong-unknown', title: 'נמצא נעלם, אבל התשובה לא עונה על מה שנשאל',
      cause: 'אחרי שפותרים את המשוואה מרגישים שסיימנו. אבל $x$ הוא לפעמים רק צעד בדרך לתשובה.',
      explain: ['נראה שעניתם את $x$, אבל שאלו על משהו אחר.', 'בחולצה ובמכנסיים $x = 120$ הוא מחיר המכנסיים. אם שאלו על החולצה, מחשבים ממנו: $0.7 \\cdot 120 = 84$.'],
      prereq: 'eq:5',
      remedy: [
        { kind: 'predict', text: 'החולצה זולה ב־$30\\%$ מהמכנסיים, ויחד הם עלו $204$ ₪. יצא $x = 120$, מחיר המכנסיים. כמה עלתה החולצה?', choices: ['$84$', '$120$'], answer: 0,
          why: '$0.7 \\cdot 120 = 84$. בדיקה: $120 + 84 = 204$.' },
        { kind: 'rule', text: 'לפני שעונים, קוראים שוב את השאלה: על מה שאלו?', display: 'x = 120:\\quad 0.7x = 84',
          why: 'כותבים במילים מה $x$ מייצג, ואז מחשבים ממנו את מה שנשאל.' },
      ] },
  ],
};

// ================================================================ stair 2: substitution (שיטת ההצבה)

type Subst = { xe: boolean; x: number; y: number; m: number; b: number; p: number; q: number; r: number; top: boolean; ask: number };
const substFirst = (s: Subst) => (s.xe ? 1 : 0); // the coordinate the substitution finds first
const substAnswer = (s: Subst) => (s.ask ? s.y : s.x);
const substBugs: Record<string, (s: Subst) => number | null> = {
  // k(mx + b) opened as kmx + b: the value it leads to for what was asked
  'partial-dist': (s) => G.substPartial(s)[s.ask],
  // asked the unknown found second, answered the one found first
  'forgot-y': (s) => (s.ask !== substFirst(s) ? [s.x, s.y][substFirst(s)] : null),
};
const substModel: DiagModel<Subst> = {
  params: (rnd) => fair(() => { const s = G.substDraw(rnd); const second = s.xe ? 0 : 1; return { ...s, ask: rnd() < 0.6 ? second : 1 - second }; }, substAnswer, substBugs),
  text: (s) => `פתרו את מערכת המשוואות. מה $${s.ask ? 'y' : 'x'}$?`,
  display: (s) => G.substShow(s),
  answer: substAnswer,
  bugs: substBugs,
  solution: (s) => G.substSolution(s),
  hint: (s) => G.substHint(s),
};

type Tix = { A: number; d: number; na: number; nc: number; M: number; q: number };
const tixAnswer = (t: Tix) => (t.q ? t.A - t.d : t.A);
const tixBugs: Record<string, (t: Tix) => number | null> = {
  // nc(x − d) opened as nc·x − d
  'partial-dist': (t) => { const a = (t.M + t.d) / (t.na + t.nc); return t.q ? a - t.d : a; },
  // the adult price found first, answered for the child's
  'forgot-y': (t) => (t.q ? t.A : null),
};
const tixModel: DiagModel<Tix> = {
  // the same substitution in a story: y = x − d is the explicit equation
  params: (rnd) => fair(() => {
    const A = rint(rnd, 6, 12) * 5; const d = rint(rnd, 1, 4) * 5; const na = rint(rnd, 2, 4); const nc = rint(rnd, 2, 5);
    return { A, d, na, nc, M: na * A + nc * (A - d), q: rnd() < 0.55 ? 1 : 0 };
  }, tixAnswer, tixBugs),
  text: (t) => `כרטיס לילד זול ב־$${t.d}$ ₪ מכרטיס למבוגר. $${t.na}$ מבוגרים ו־$${t.nc}$ ילדים שילמו יחד $${t.M}$ ₪. כמה עולה כרטיס ${t.q ? 'לילד' : 'למבוגר'}?`,
  answer: tixAnswer,
  bugs: tixBugs,
  solution: (t) => [
    `נסמן ב־$x$ את מחיר הכרטיס למבוגר וב־$y$ לילד: $y = x - ${t.d}$, וגם $${t.na}x + ${t.nc}y = ${t.M}$.`,
    `מציבים, בסוגריים: $${t.na}x + ${t.nc}(x - ${t.d}) = ${t.M}$`,
    `פותחים סוגריים: $${t.na + t.nc}x - ${t.nc * t.d} = ${t.M}$, ולכן $x = ${t.A}$.`,
    `$y = ${t.A} - ${t.d} = ${t.A - t.d}$.`,
    `בדיקה: $${t.na} \\cdot ${t.A} + ${t.nc} \\cdot ${t.A - t.d} = ${t.M}$.`,
  ],
  hint: (t) => `$x$ מחיר למבוגר, $y$ לילד: $y = x - ${t.d}$. מציבים בסוגריים במשוואה של הקנייה.${t.q ? ' ובסוף: שאלו על הילד.' : ''}`,
  unit: '₪',
};

const stair2: StairContent = {
  skill: 'sys:2', topic: 'sys', level: 2, title: 'שיטת ההצבה',
  objectives: [
    'לדעת שפתרון של מערכת הוא זוג סדור $(x, y)$ שמקיים את שתי המשוואות, והוא נקודת המפגש של שני הישרים.',
    'לפתור בהצבה כשמשוואה אחת כבר אומרת כמה זה $y$ (או $x$).',
    'למצוא את שני הנעלמים ולבדוק בשתי המשוואות.',
  ],
  idea: 'במשוואה אחת $y$ כבר כתוב בעזרת $x$. מציבים את הביטוי, בסוגריים, במשוואה השנייה, ונשארת משוואה עם נעלם אחד.',
  why: [
    '$y$ בשתי המשוואות הוא אותו מספר, ולכן מותר לכתוב במקומו את הביטוי ששווה לו.',
    'הפתרון צריך לקיים את שתי המשוואות, ולכן גם הבדיקה היא בשתיהן.',
  ],
  alt: [
    'בגרף כל משוואה היא ישר, והפתרון הוא הנקודה ששני הישרים עוברים בה, כמו נקודת המפגש בפונקציה קווית.',
    'כששתי המשוואות כתובות $y = \\dots$, ההצבה היא השוואת הביטויים: $2x - 1 = -x + 5$, ולכן $x = 2$.',
  ],
  discover: [
    { kind: 'predict', text: 'האם הזוג $(2, 3)$ הוא פתרון של המערכת?', display: '\\begin{cases} x + y = 5 \\\\ 2x - y = 1 \\end{cases}', choices: ['כן, הוא מקיים את שתי המשוואות', 'רק את הראשונה', 'רק את השנייה'], answer: 0,
      why: '$2 + 3 = 5$, וגם $2 \\cdot 2 - 3 = 1$. שתי המשוואות מתקיימות.' },
    { kind: 'predict', text: 'והזוג $(1, 4)$?', display: '\\begin{cases} x + y = 5 \\\\ 2x - y = 1 \\end{cases}', choices: ['כן, הוא מקיים את שתי המשוואות', 'רק את הראשונה', 'רק את השנייה'], answer: 1,
      why: '$1 + 4 = 5$, אבל $2 \\cdot 1 - 4 = -2$, ולא $1$. זוג שמקיים רק משוואה אחת הוא לא פתרון של המערכת.',
      wrongWhy: { 0: 'בשנייה: $2 \\cdot 1 - 4 = -2$, ולא $1$.', 2: 'בשנייה יוצא $-2$, לא $1$. ובראשונה $1 + 4 = 5$ דווקא נכון.' } },
    { kind: 'rule', text: 'פתרון של מערכת הוא זוג $(x, y)$ שמקיים את שתי המשוואות.', display: '(2, 3):\\quad 2 + 3 = 5,\\quad 2 \\cdot 2 - 3 = 1',
      why: 'לכל משוואה לבד יש הרבה פתרונות: כל נקודה על הישר שלה. המערכת מחפשת נקודה ששייכת לשני הישרים.' },
    { kind: 'explore', text: 'אלה אותן משוואות, כתובות $y = -x + 5$ ו־$y = 2x - 1$. שימו את הנקודה שנמצאת על שני הישרים.', manip: lines([-1, 5], [2, -1]), answer: [2, 3],
      hint: 'הנקודה צריכה להיות על שני הישרים. איפה הם נפגשים?', success: '$(2, 3)$: נקודת המפגש היא הפתרון של המערכת.' },
    { kind: 'say', mood: 'thinking', text: 'בגרף קשה לקרוא נקודה כמו $(2.5, 4)$. אז מחשבים: כשמשוואה אחת כבר אומרת כמה זה $y$, מציבים אותה בשנייה.', display: '\\begin{cases} y = 2x - 1 \\\\ 3x + 2y = 12 \\end{cases}' },
    { kind: 'predict', text: 'מציבים $y = 2x - 1$ במשוואה $3x + 2y = 12$. מה מקבלים?', choices: ['$3x + 2(2x - 1) = 12$', '$3x + 2x - 1 = 12$', '$3x + 2y - 1 = 12$'], answer: 0,
      why: 'במקום $y$ כותבים את כל הביטוי, בסוגריים: $y$ שווה ל־$2x - 1$ כולו, ו־$2$ כופל את כולו.',
      wrongWhy: { 1: 'בלי סוגריים ה־$2$ כופל רק את $2x$. אבל $2y$ הוא $2$ כפול כל $y$.', 2: 'אחרי ההצבה לא נשאר $y$: הוא הוחלף בביטוי.' } },
    { kind: 'predict', text: '$3x + 2(2x - 1) = 12$. מה $x$?', choices: ['$\\dfrac{13}{7}$', '$14$', '$2$'], answer: 2,
      why: 'פותחים סוגריים: $3x + 4x - 2 = 12$, כלומר $7x = 14$, ו־$x = 2$.',
      wrongWhy: { 0: 'זה יוצא כש־$2$ כופל רק את $2x$: $7x - 1 = 12$. גם ה־$-1$ נכפל: $2 \\cdot (-1) = -2$.', 1: '$14$ הוא $7x$. מחלקים ב־$7$.' } },
    { kind: 'predict', text: 'מצאנו $x = 2$. מה הפתרון של המערכת?', choices: ['$x = 2$', '$(2, 3)$', '$(2, 12)$'], answer: 1,
      why: 'מציבים $x = 2$ ב־$y = 2x - 1$: $y = 2 \\cdot 2 - 1 = 3$. הפתרון הוא זוג: $(2, 3)$.',
      wrongWhy: { 0: 'זה רק חצי מהפתרון. חסר $y$: מציבים את $x$ בחזרה.', 2: '$12$ הוא אגף ימין. את $y$ מקבלים מ־$y = 2x - 1$.' } },
    { kind: 'rule', text: 'שיטת ההצבה: מציבים את הביטוי בסוגריים, פותרים, ומציבים בחזרה כדי למצוא את הנעלם השני. בודקים בשתי המשוואות.', display: '3 \\cdot 2 + 2 \\cdot 3 = 12',
      why: 'הזוג $(2, 3)$ מקיים את $y = 2x - 1$ וגם את $3x + 2y = 12$, ולכן הוא הפתרון.' },
  ],
  examples: [
    { problem: 'פתרו את המערכת. אחד הישרים אופקי.', display: '\\begin{cases} y = 4 \\\\ y = 2x - 1 \\end{cases}', answer: 2.5, check: 'x', vars: { x: 2.5, y: 4 }, answerTex: '(2.5, 4)',
      steps: [
        { action: 'בישר האופקי תמיד $y = 4$. מציבים במשוואה השנייה.', why: 'בנקודת המפגש $y$ הוא אותו מספר בשתי המשוואות.', result: '4 = 2x - 1', eq: '4 = 2*x - 1' },
        { action: 'מוסיפים $1$ לשני האגפים.', why: 'כך נשאר רק $2x$ באגף ימין.', result: '5 = 2x', eq: '5 = 2*x' },
        { action: 'מחלקים ב־$2$.', why: 'הפתרון לא חייב להיות מספר שלם.', result: 'x = 2.5', eq: 'x = 2.5' },
        { action: 'כותבים את הזוג ובודקים.', why: '$2 \\cdot 2.5 - 1 = 4$, וגם בישר האופקי $y = 4$.', result: '(2.5, 4)', calc: { expr: '2*2.5 - 1', value: 4 } },
      ] },
    { problem: 'פתרו את המערכת בשיטת ההצבה.', display: '\\begin{cases} y = x + 3 \\\\ 2x + y = 12 \\end{cases}', answer: 6, check: 'y', vars: { x: 3, y: 6 }, answerTex: '(3, 6)',
      steps: [
        { action: 'מציבים $y = x + 3$ במשוואה השנייה, בסוגריים.', why: '$y$ שווה לכל הביטוי $x + 3$.', result: '2x + (x + 3) = 12', eq: '2*x + (x + 3) = 12' },
        { action: 'מכנסים.', why: '$2x + x = 3x$.', result: '3x + 3 = 12', eq: '3*x + 3 = 12' },
        { action: 'מחסירים $3$ ומחלקים ב־$3$.', why: 'נשארה משוואה עם נעלם אחד.', result: 'x = 3', eq: 'x = 3' },
        { action: 'מציבים בחזרה כדי למצוא את $y$.', why: '$y = 3 + 3$.', result: 'y = 6', eq: 'y = 6' },
        { action: 'בודקים במשוואה השנייה.', why: 'הזוג צריך לקיים את שתיהן.', result: '2 \\cdot 3 + 6 = 12', calc: { expr: '2*3 + 6', value: 12 } },
      ] },
    { problem: 'כרטיס לילד זול ב־$15$ ₪ מכרטיס למבוגר. $2$ מבוגרים ו־$3$ ילדים שילמו יחד $220$ ₪. כמה עולה כל כרטיס?', answer: 53, check: 'x', vars: { x: 53, y: 38 }, answerTex: 'x = 53,\\; y = 38',
      steps: [
        { action: 'מסמנים: $x$ מחיר כרטיס למבוגר, $y$ לילד.', why: 'הכרטיס לילד זול ב־$15$ ₪.', result: 'y = x - 15', eq: 'y = x - 15' },
        { action: 'כותבים את הקנייה.', why: 'שני מבוגרים ושלושה ילדים.', result: '2x + 3y = 220', eq: '2*x + 3*y = 220' },
        { action: 'מציבים, בסוגריים.', why: '$3y$ הוא $3$ כפול כל המחיר לילד.', result: '2x + 3(x - 15) = 220', eq: '2*x + 3*(x - 15) = 220' },
        { action: 'פותחים סוגריים ומכנסים.', why: '$3 \\cdot (-15) = -45$.', result: '5x - 45 = 220', eq: '5*x - 45 = 220' },
        { action: 'מוסיפים $45$ ומחלקים ב־$5$.', why: '$265 : 5 = 53$.', result: 'x = 53', eq: 'x = 53' },
        { action: 'מציבים בחזרה ובודקים.', why: '$y = 53 - 15 = 38$, ו־$2 \\cdot 53 + 3 \\cdot 38 = 106 + 114 = 220$.', result: 'y = 38', eq: 'y = 38' },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '\\begin{cases} x = 2y + 1 \\\\ 3x - 4y = 7 \\end{cases}',
      steps: [
        { prompt: 'מה מקבלים אחרי ההצבה?', choices: [
          { text: '$3(2y + 1) - 4y = 7$', ok: true, feedback: 'נכון: במקום $x$ כל הביטוי, בסוגריים.' },
          { text: '$3 \\cdot 2y + 1 - 4y = 7$', ok: false, feedback: 'בלי סוגריים ה־$3$ כופל רק את $2y$. אבל $3x$ הוא $3$ כפול כל $x$, גם ה־$1$.' },
          { text: '$3x - 4(2y + 1) = 7$', ok: false, feedback: 'הביטוי שווה ל־$x$, ולכן מציבים אותו במקום $x$, לא במקום $y$.' },
        ], hints: ['במשוואה הראשונה $x$ כתוב בעזרת $y$. איפה יש $x$ בשנייה?', 'במקום $x$ כותבים $(2y + 1)$.'], done: '$6y + 3 - 4y = 7$' },
        { prompt: '$6y + 3 - 4y = 7$. מה $y$?', choices: [
          { text: '$y = 5$', ok: false, feedback: 'כשמחסירים $3$ משני האגפים: $2y = 7 - 3 = 4$, ולא $10$.' },
          { text: '$y = 2$', ok: true, feedback: 'נכון: $2y + 3 = 7$, ולכן $2y = 4$.' },
          { text: '$y = 3$', ok: false, feedback: '$3$ יוצא כש־$3$ כופל רק את $2y$. בהצבה נכונה $2y + 3 = 7$.' },
        ], hints: ['מכנסים: $6y - 4y = 2y$.', '$2y + 3 = 7$, ולכן $2y = 4$.'], done: '$y = 2$' },
      ],
      final: { prompt: 'ומה $x$?', answer: 5, check: '2*2 + 1', hints: ['מציבים $y = 2$ ב־$x = 2y + 1$.', '$x = 2 \\cdot 2 + 1$. ובודקים: $3x - 4 \\cdot 2$ צריך לצאת $7$.'] } },
    { problem: 'ועוד אחת, עם מינוס.', display: '\\begin{cases} y = -x + 4 \\\\ 5x - 2y = 13 \\end{cases}',
      steps: [
        { prompt: 'מה מקבלים אחרי ההצבה ופתיחת הסוגריים?', choices: [
          { text: '$5x + 2x - 8 = 13$', ok: true, feedback: 'נכון: $-2(-x + 4) = 2x - 8$.' },
          { text: '$5x + 2x + 4 = 13$', ok: false, feedback: 'גם ה־$4$ נכפל ב־$-2$: $-2 \\cdot 4 = -8$.' },
          { text: '$5x - 2x - 8 = 13$', ok: false, feedback: '$-2 \\cdot (-x) = 2x$: מינוס כפול מינוס.' },
        ], hints: ['$-2$ כופל את $-x$ וגם את $4$.', '$-2 \\cdot (-x) = 2x$, ו־$-2 \\cdot 4 = -8$.'], done: '$7x - 8 = 13$' },
        { prompt: 'מה $x$?', choices: [
          { text: '$x = 3$', ok: true, feedback: 'נכון: $7x = 21$.' },
          { text: '$x = \\dfrac{5}{7}$', ok: false, feedback: 'כש־$-8$ עובר אגף הוא נעשה $+8$: $7x = 13 + 8 = 21$.' },
          { text: '$x = 21$', ok: false, feedback: '$21$ הוא $7x$. מחלקים ב־$7$.' },
        ], hints: ['מוסיפים $8$ לשני האגפים.', '$7x = 21$.'], done: '$x = 3$' },
      ],
      final: { prompt: 'ומה $y$?', answer: 1, check: '-3 + 4', hints: ['מציבים $x = 3$ ב־$y = -x + 4$.', '$y = -3 + 4$. בדיקה: $5 \\cdot 3 - 2y$ צריך לצאת $13$.'] } },
  ],
  diag: substModel,
  transfer: tixModel,
  misconceptions: [
    { id: 'partial-dist', title: 'בהצבה רק האיבר הראשון שבסוגריים נכפל',
      cause: 'כשכותבים ביטוי במקום $y$ בלי סוגריים, המספר שלפני $y$ כופל רק את האיבר הראשון שלו.',
      explain: ['נראה שבהצבה רק חלק מהביטוי נכפל.', 'ב־$2x + 3y = 16$ עם $y = x + 2$: $2x + 3(x + 2) = 16$, כלומר $5x + 6 = 16$, ו־$x = 2$. בלי סוגריים יוצא $5x + 2 = 16$, ו־$x = 2.8$.'],
      prereq: 'expr:4',
      remedy: [
        { kind: 'explore', text: 'בנו מלבן ל־$3(x + 2)$, ושימו לב לשטח של כל חלק.', display: '3(x + 2)', manip: area(), answer: { a: 3, b: 2 },
          hint: 'גובה $3$, ואורך $x$ ועוד $2$ יחידות.', success: '$3x + 6$: גם ה־$2$ נכפל ב־$3$. לכן $3y$ עם $y = x + 2$ הוא $3x + 6$.' },
        { kind: 'predict', text: 'במערכת $y = x + 2$ ו־$2x + 3y = 16$, איזה זוג הוא הפתרון?', choices: ['$(2, 4)$', '$(2.8, 4.8)$'], answer: 0,
          why: 'בדיקה: $2 \\cdot 2 + 3 \\cdot 4 = 16$. ואילו $2 \\cdot 2.8 + 3 \\cdot 4.8 = 20$, לא $16$.' },
        { kind: 'rule', text: 'מציבים ביטוי תמיד בסוגריים.', display: '3y = 3(x + 2) = 3x + 6',
          why: 'המספר שלפני $y$ כופל את כל מה ש־$y$ שווה לו.' },
      ] },
    { id: 'forgot-y', title: 'נמצא נעלם אחד, והשני לא חושב',
      cause: 'פתרון המשוואה בנעלם אחד מרגיש כמו הסוף. אבל פתרון של מערכת הוא זוג.',
      explain: ['נראה שעניתם את הנעלם שמצאתם ראשון, ולא את השני.', 'אחרי ש־$x = 2$ נמצא במערכת עם $y = 2x - 1$, מציבים אותו: $y = 3$. הפתרון $(2, 3)$.'],
      prereq: 'line:8',
      remedy: [
        { kind: 'explore', text: 'הישרים $y = x + 1$ ו־$y = -2x + 7$ נפגשים כש־$x = 2$. שימו את נקודת המפגש.', manip: lines([1, 1], [-2, 7]), answer: [2, 3],
          hint: 'מציבים $x = 2$ באחת המשוואות: $y = 2 + 1$.', success: '$(2, 3)$. ל־$x = 2$ יש $y = 3$, ובלי $y$ אין נקודה.' },
        { kind: 'predict', text: 'מצאנו $x = 4$ במערכת עם $y = 3x - 5$. מה $y$?', choices: ['$7$', '$4$', '$12$'], answer: 0,
          why: '$y = 3 \\cdot 4 - 5 = 7$. הפתרון $(4, 7)$.' },
      ] },
    { id: 'swap', title: 'הזוג נכתב הפוך: $y$ במקום $x$',
      cause: 'בזוג סדור הסדר קובע: קודם $x$, אחר כך $y$. כשמוצאים קודם את $y$, קל לכתוב אותו ראשון.',
      explain: ['נראה שהזוג נכתב בסדר הפוך.', 'אם $x = 2$ ו־$y = 3$, הפתרון $(2, 3)$. הנקודה $(3, 2)$ היא נקודה אחרת לגמרי.'],
      prereq: 'coord:1',
      remedy: [
        { kind: 'predict', text: 'במערכת $y = 2x - 1$ ו־$x + y = 5$ יצא $x = 2$ ו־$y = 3$. איזה זוג הוא הפתרון?', choices: ['$(3, 2)$', '$(2, 3)$'], answer: 1,
          why: 'קודם $x$, אחר כך $y$. בדיקה: $(3, 2)$ לא מקיים את $y = 2x - 1$, כי $2 \\cdot 3 - 1 = 5$.' },
        { kind: 'rule', text: 'זוג סדור כותבים $(x, y)$.', display: '(2, 3):\\quad x = 2,\\; y = 3',
          why: 'הראשון הוא תמיד $x$, ימינה או שמאלה, והשני $y$, למעלה או למטה.' },
      ] },
  ],
};

// ================================================================ stair 3: equal coefficients (השוואת מקדמים)

type Elim = ReturnType<typeof G.elimDraw> & { ask: number };
const goneIndex = (e: Elim) => (e.gone === 'y' ? 1 : 0); // the coordinate found second
const elimAnswer = (e: Elim) => (e.ask ? e.y : e.x);
const elimBugs: Record<string, (e: Elim) => number | null> = {
  // subtracting an equation subtracts only part of it: the constants added
  'minus-bracket': (e) => { const bad = G.elimMinusBracket(e); return bad ? bad[e.ask] : null; },
  // asked the unknown that went (found second), answered the one found first
  'forgot-y': (e) => (e.ask === goneIndex(e) ? [e.x, e.y][1 - goneIndex(e)] : null),
};
const elimModel: DiagModel<Elim> = {
  params: (rnd) => fair(() => { const e = G.elimDraw(rnd); const gi = e.gone === 'y' ? 1 : 0; return { ...e, ask: rnd() < 0.55 ? gi : 1 - gi }; }, elimAnswer, elimBugs),
  text: (e) => `פתרו את המערכת בהשוואת מקדמים. מה $${e.ask ? 'y' : 'x'}$?`,
  display: (e) => G.elimShow(e),
  answer: elimAnswer,
  bugs: elimBugs,
  solution: (e) => G.elimSolution(e),
  hint: (e) => G.elimHint(e),
};

type Pens = { a: number; n1: number; n2: number; P: number; N: number; q: number };
const pensT1 = (t: Pens) => t.a * t.P + t.n1 * t.N;
const pensT2 = (t: Pens) => t.a * t.P + t.n2 * t.N;
const pensAnswer = (t: Pens) => (t.q ? t.P : t.N);
const pensBugs: Record<string, (t: Pens) => number | null> = {
  // the first purchase's price added instead of subtracted
  'minus-bracket': (t) => { const N = (pensT2(t) + pensT1(t)) / (t.n2 - t.n1); return t.q ? (pensT1(t) - t.n1 * N) / t.a : N; },
  // the notebook found first, answered for the pen
  'forgot-y': (t) => (t.q ? t.N : null),
};
const pensModel: DiagModel<Pens> = {
  // the classroom's pens and notebooks: two purchases with the same number of pens
  params: (rnd) => fair(() => {
    const a = rint(rnd, 2, 4); const n1 = rint(rnd, 2, 4); const n2 = n1 + rint(rnd, 1, 4); const P = rint(rnd, 2, 9); let N = rint(rnd, 3, 12); if (N === P) N += 1;
    return { a, n1, n2, P, N, q: rnd() < 0.55 ? 1 : 0 };
  }, pensAnswer, pensBugs),
  text: (t) => `$${t.a}$ עטים ו־$${t.n1}$ מחברות עולים $${pensT1(t)}$ ₪. $${t.a}$ עטים ו־$${t.n2}$ מחברות עולים $${pensT2(t)}$ ₪. כמה עולה ${t.q ? 'עט' : 'מחברת'}?`,
  answer: pensAnswer,
  bugs: pensBugs,
  solution: (t) => [
    `נסמן ב־$x$ את מחיר העט וב־$y$ את מחיר המחברת: $${t.a}x + ${t.n1}y = ${pensT1(t)}$, וגם $${t.a}x + ${t.n2}y = ${pensT2(t)}$.`,
    `המקדמים של $x$ שווים: מחסרים את הראשונה מהשנייה, כל אגף וכל איבר. $${t.n2 - t.n1 === 1 ? '' : t.n2 - t.n1}y = ${pensT2(t) - pensT1(t)}$, ולכן $y = ${t.N}$.`,
    `מציבים בראשונה: $${t.a}x + ${t.n1 * t.N} = ${pensT1(t)}$, ולכן $x = ${t.P}$.`,
    `בדיקה בשנייה: $${t.a} \\cdot ${t.P} + ${t.n2} \\cdot ${t.N} = ${pensT2(t)}$.`,
  ],
  hint: (t) => `לשתי הקניות אותו מספר עטים. מחסרים את הקנייה הראשונה מהשנייה: ההפרש הוא רק מחברות.${t.q ? ' ובסוף: שאלו על העט.' : ''}`,
  unit: '₪',
};

const stair3: StairContent = {
  skill: 'sys:3', topic: 'sys', level: 3, title: 'השוואת מקדמים',
  objectives: [
    'לחבר או לחסר משוואות כך שאחד הנעלמים ייעלם.',
    'לכפול משוואה שלמה במספר לפני כן, כשהמקדמים לא שווים ולא נגדיים.',
    'לזהות מערכת בלי פתרון או עם אינסוף פתרונות.',
  ],
  idea: 'אם לאחד הנעלמים יש מקדמים שווים, מחסרים את המשוואות. אם הם נגדיים, מחברים. כך נשארת משוואה עם נעלם אחד.',
  why: [
    'שני דברים שווים ועוד שני דברים שווים נותנים שוויון, כמו להוסיף לשתי הכפות של מאזניים מאוזנים את אותו משקל.',
    'חיסור משוואה הוא חיסור של כל האגף שלה, כמו מינוס לפני סוגריים: $-(3x + 2y) = -3x - 2y$.',
  ],
  alt: [
    '$3$ עטים ו־$2$ מחברות עולים $22$ ₪, ו־$3$ עטים ו־$5$ מחברות עולים $37$ ₪. ההבדל בין הקניות הוא $3$ מחברות, וגם $15$ ₪. בלי אלגברה: מחברת עולה $5$ ₪.',
    'כל מערכת אפשר לפתור גם בהצבה. השוואת מקדמים חוסכת שברים כשאף נעלם לא עומד לבד.',
  ],
  discover: [
    { kind: 'predict', text: '$3$ עטים ו־$2$ מחברות עולים $22$ ₪. $3$ עטים ו־$5$ מחברות עולים $37$ ₪. כמה עולה מחברת?', choices: ['$15$', '$5$', '$3$'], answer: 1,
      why: 'ההבדל בין הקניות הוא בדיוק $3$ מחברות, וגם $37 - 22 = 15$ ₪. לכן $3$ מחברות עולות $15$ ₪, ומחברת $5$.',
      wrongWhy: { 0: '$15$ ₪ הם שלוש מחברות, לא אחת.', 2: '$3$ הוא מספר המחברות שנוספו. הן עולות $15$ ₪.' } },
    { kind: 'rule', text: 'כשלנעלם אחד יש אותו מקדם בשתי המשוואות, מחסרים אותן, והוא נעלם.', display: '(3x + 5y) - (3x + 2y) = 37 - 22',
      why: 'מחסרים שוויון משוויון, וזה עדיין שוויון. $3x - 3x = 0$, ונשאר $3y = 15$.' },
    { kind: 'explore', text: 'המערכת $x + y = 5$ ו־$x - y = 1$ היא שני הישרים $y = -x + 5$ ו־$y = x - 1$. שימו את הנקודה המשותפת.', manip: lines([-1, 5], [1, -1]), answer: [3, 2],
      hint: 'הנקודה צריכה להיות על שני הישרים.', success: '$(3, 2)$: $3 + 2 = 5$, וגם $3 - 2 = 1$.' },
    { kind: 'predict', text: 'ועכשיו באלגברה: $x + y = 5$ ו־$x - y = 1$. מה עושים כדי ש־$y$ ייעלם?', choices: ['מחברים את המשוואות', 'מחסרים את המשוואות', 'כופלים את הראשונה ב־$2$'], answer: 0,
      why: '$y + (-y) = 0$. מחברים: $2x = 6$, ולכן $x = 3$ ו־$y = 2$, בדיוק הנקודה מהגרף.',
      wrongWhy: { 1: 'בחיסור יוצא $y - (-y) = 2y$, ו־$y$ לא נעלם. מחסרים כשהמקדמים שווים, וכאן הם נגדיים.', 2: 'אחרי הכפל המקדמים של $y$ הם $2$ ו־$-1$: עדיין לא נגדיים.' } },
    { kind: 'predict', text: '$5x + 2y = 19$ ו־$3x + 2y = 13$. מחסרים את השנייה מהראשונה. מה מקבלים?', choices: ['$2x = 32$', '$8x = 32$', '$2x = 6$'], answer: 2,
      why: 'מחסרים כל אגף, כל איבר: $5x - 3x = 2x$, $2y - 2y = 0$, ו־$19 - 13 = 6$. לכן $x = 3$, ו־$y = 2$.',
      wrongWhy: { 0: '$32$ יוצא כש־$13$ נוסף. מחסרים את כל המשוואה השנייה, גם את $13$.', 1: '$8x = 32$ הוא חיבור המשוואות. אבל בחיבור $y$ לא נעלם: $2y + 2y = 4y$.' } },
    { kind: 'rule', text: 'מחסרים משוואה שלמה: כל אגף, וכל איבר בו.', display: '(5x + 2y) - (3x + 2y) = 19 - 13',
      why: 'זה כמו מינוס לפני סוגריים: $-(3x + 2y) = -3x - 2y$, ובאגף ימין מחסרים $13$.' },
    { kind: 'predict', text: '$x + 2y = 7$ ו־$3x - y = 7$. למקדמים של $y$, $2$ ו־$-1$, אין שווים ואין נגדיים. מה עושים?', choices: ['כופלים את השנייה ב־$2$, ואז מחברים', 'מחברים את המשוואות כמו שהן', 'מחסרים את המשוואות כמו שהן'], answer: 0,
      why: '$2(3x - y) = 2 \\cdot 7$, כלומר $6x - 2y = 14$, ועכשיו $2y + (-2y) = 0$. מחברים: $7x = 21$, $x = 3$ ו־$y = 2$.',
      wrongWhy: { 1: 'בחיבור יוצא $2y - y = y$: הוא לא נעלם.', 2: 'בחיסור יוצא $2y - (-y) = 3y$: הוא לא נעלם.' } },
    { kind: 'rule', text: 'אין מקדמים שווים או נגדיים? כופלים משוואה שלמה במספר: כל איבר, וגם את אגף ימין.', display: '2(3x - y) = 2 \\cdot 7 \\;\\Rightarrow\\; 6x - 2y = 14',
      why: 'כפל של שני האגפים באותו מספר שומר על השוויון, בדיוק כמו במשוואה עם נעלם אחד.' },
    { kind: 'predict', text: 'כמה פתרונות יש למערכת $2x + y = 5$ ו־$4x + 2y = 10$?', choices: ['אינסוף: כל נקודה על הישר', 'פתרון אחד', 'אין פתרון'], answer: 0,
      why: 'המשוואה השנייה היא הראשונה כפול $2$. זה אותו ישר, וכל זוג שמקיים את האחת מקיים גם את השנייה.',
      wrongWhy: { 1: 'נסו שני זוגות: $(0, 5)$ ו־$(1, 3)$. שניהם מקיימים את שתי המשוואות.', 2: 'יש פתרונות: $(1, 3)$ מקיים את שתיהן, $2 + 3 = 5$ ו־$4 + 6 = 10$.' } },
    { kind: 'rule', text: 'למערכת יש פתרון אחד, אין פתרון, או אינסוף פתרונות.', display: '\\begin{cases} 2x + y = 5 \\\\ 4x + 2y = 7 \\end{cases}',
      why: 'כפול $2$, המשוואה הראשונה נותנת $4x + 2y = 10$. כאן השנייה אומרת שאותו ביטוי שווה $7$: אי אפשר, ואין פתרון. אילו גם בשנייה היה $10$, זה אותו ישר, ויש אינסוף פתרונות.' },
  ],
  examples: [
    { problem: 'פתרו את המערכת.', display: '\\begin{cases} 3x + y = 11 \\\\ x - y = 1 \\end{cases}', answer: 3, check: 'x', vars: { x: 3, y: 2 }, answerTex: '(3, 2)',
      steps: [
        { action: 'המקדמים של $y$ נגדיים, $1$ ו־$-1$: מחברים את המשוואות.', why: 'אגף שמאל ועוד אגף שמאל, אגף ימין ועוד אגף ימין. ו־$y - y = 0$.', result: '3x + x = 11 + 1', eq: '3*x + x = 11 + 1' },
        { action: 'מכנסים.', why: 'נשאר נעלם אחד.', result: '4x = 12', eq: '4*x = 12' },
        { action: 'מחלקים ב־$4$.', why: 'כפל מבטלים בחילוק.', result: 'x = 3', eq: 'x = 3' },
        { action: 'מציבים $x = 3$ במשוואה השנייה.', why: '$3 - y = 1$, ולכן $y = 2$.', result: 'y = 2', eq: 'y = 2' },
        { action: 'בודקים בראשונה.', why: 'הזוג צריך לקיים את שתיהן.', result: '3 \\cdot 3 + 2 = 11', calc: { expr: '3*3 + 2', value: 11 } },
      ] },
    { problem: '$3$ עטים ו־$2$ מחברות עולים $22$ ₪. $3$ עטים ו־$5$ מחברות עולים $37$ ₪. כמה עולה עט, וכמה מחברת?', answer: 4, check: 'x', vars: { x: 4, y: 5 }, answerTex: 'x = 4,\\; y = 5',
      steps: [
        { action: 'מסמנים: $x$ מחיר עט, $y$ מחיר מחברת. כל קנייה היא משוואה.', why: 'שלושה עטים ושתי מחברות, ושלושה עטים וחמש מחברות.', result: '\\begin{cases} 3x + 2y = 22 \\\\ 3x + 5y = 37 \\end{cases}' },
        { action: 'מחסרים את הראשונה מהשנייה, כל אגף וכל איבר.', why: 'המקדמים של $x$ שווים: $3x - 3x = 0$, ו־$x$ נעלם.', result: '5y - 2y = 37 - 22', eq: '5*y - 2*y = 37 - 22' },
        { action: 'מכנסים ומחלקים ב־$3$.', why: '$3y = 15$.', result: 'y = 5', eq: 'y = 5' },
        { action: 'מציבים $y = 5$ בראשונה.', why: '$3x + 10 = 22$, ולכן $3x = 12$.', result: 'x = 4', eq: 'x = 4' },
        { action: 'בודקים בשנייה.', why: 'הזוג צריך לקיים את שתיהן.', result: '3 \\cdot 4 + 5 \\cdot 5 = 37', calc: { expr: '3*4 + 5*5', value: 37 } },
      ] },
    { problem: 'פתרו את המערכת.', display: '\\begin{cases} 2x + 3y = 12 \\\\ 5x - y = 13 \\end{cases}', answer: 3, check: 'x', vars: { x: 3, y: 2 }, answerTex: '(3, 2)',
      steps: [
        { action: 'כופלים את השנייה ב־$3$, כל איבר וגם אגף ימין.', why: 'כך המקדם של $y$ נעשה $-3$, נגדי ל־$3$.', result: '15x - 3y = 39', eq: '15*x - 3*y = 39' },
        { action: 'מחברים אותה לראשונה.', why: '$3y - 3y = 0$.', result: '17x = 51', eq: '17*x = 51' },
        { action: 'מחלקים ב־$17$.', why: '$51 : 17 = 3$.', result: 'x = 3', eq: 'x = 3' },
        { action: 'מציבים בראשונה.', why: '$6 + 3y = 12$, ולכן $3y = 6$.', result: 'y = 2', eq: 'y = 2' },
        { action: 'בודקים בשנייה.', why: 'הזוג צריך לקיים את שתיהן.', result: '5 \\cdot 3 - 2 = 13', calc: { expr: '5*3 - 2', value: 13 } },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '\\begin{cases} 5x + 2y = 19 \\\\ 3x + 2y = 13 \\end{cases}',
      steps: [
        { prompt: 'מה עושים כדי ש־$y$ ייעלם?', choices: [
          { text: 'מחסרים את המשוואות', ok: true, feedback: 'נכון: המקדמים של $y$ שווים.' },
          { text: 'מחברים את המשוואות', ok: false, feedback: 'בחיבור יוצא $4y$. מחברים כשהמקדמים נגדיים.' },
          { text: 'כופלים את הראשונה ב־$2$', ok: false, feedback: 'המקדמים כבר שווים, אין צורך לכפול.' },
        ], hints: ['מסתכלים על המקדמים של $y$: $2$ ו־$2$.', 'הם שווים, ולכן מחסרים.'], done: '$(5x + 2y) - (3x + 2y) = 19 - 13$' },
        { prompt: 'מה מקבלים?', choices: [
          { text: '$2x = 6$', ok: true, feedback: 'נכון: $5x - 3x = 2x$, ו־$19 - 13 = 6$.' },
          { text: '$2x = 32$', ok: false, feedback: 'מחסרים גם את $13$: $19 - 13 = 6$.' },
          { text: '$8x = 32$', ok: false, feedback: 'זה החיבור. בחיסור: $5x - 3x = 2x$.' },
        ], hints: ['$5x - 3x$, ו־$19 - 13$.', 'באגף ימין: $19 - 13 = 6$.'], done: '$x = 3$' },
      ],
      final: { prompt: 'ומה $y$?', answer: 2, check: '(19 - 5*3) / 2', hints: ['מציבים $x = 3$ בראשונה: $15 + 2y = 19$.', '$2y = 4$.'] } },
    { problem: 'כאן צריך לכפול קודם.', display: '\\begin{cases} x + 2y = 7 \\\\ 3x - y = 7 \\end{cases}',
      steps: [
        { prompt: 'איך מגיעים למקדמים נגדיים של $y$?', choices: [
          { text: 'כופלים את השנייה ב־$2$: $6x - 2y = 7$', ok: false, feedback: 'גם אגף ימין נכפל: $2 \\cdot 7 = 14$. אחרת השוויון נשבר.' },
          { text: 'כופלים את השנייה ב־$2$: $6x - 2y = 14$', ok: true, feedback: 'נכון: כל איבר, וגם אגף ימין.' },
          { text: 'כופלים את הראשונה ב־$2$: $2x + 4y = 14$', ok: false, feedback: 'אז המקדמים של $y$ הם $4$ ו־$-1$: עדיין לא נגדיים.' },
        ], hints: ['רוצים ש־$-y$ יהיה $-2y$.', 'כופלים את כל המשוואה השנייה ב־$2$, גם את ה־$7$.'], done: '$6x - 2y = 14$' },
        { prompt: 'מחברים את $x + 2y = 7$ ואת $6x - 2y = 14$. מה מקבלים?', choices: [
          { text: '$7x = 21$', ok: true, feedback: 'נכון: $2y - 2y = 0$.' },
          { text: '$7x = 14$', ok: false, feedback: 'מחברים גם את אגפי ימין: $7 + 14 = 21$.' },
          { text: '$7x + 4y = 21$', ok: false, feedback: '$2y + (-2y) = 0$: $y$ נעלם.' },
        ], hints: ['$x + 6x$, ו־$2y - 2y$.', 'ובאגף ימין: $7 + 14$.'], done: '$7x = 21$' },
      ],
      final: { prompt: 'מה $x$?', answer: 3, check: '21 / 7', hints: ['מחלקים ב־$7$.', 'ובדיקה: מציבים בשתי המשוואות ומוצאים $y$.'] } },
  ],
  diag: elimModel,
  transfer: pensModel,
  misconceptions: [
    { id: 'minus-bracket', title: 'בחיסור משוואות, לא כל המשוואה השנייה חוסרה',
      cause: 'מחסרים את מה שרוצים שייעלם, ושוכחים שגם המספר שבאגף ימין של המשוואה השנייה מחוסר.',
      explain: ['נראה שבחיסור לא כל האיברים של המשוואה השנייה חוסרו.', 'חיסור משוואה הוא חיסור של כל האגף שלה: $-(3x + 2y) = -3x - 2y$, ובאגף ימין $19 - 13 = 6$. לכן $2x = 6$, ו־$x = 3$.'],
      prereq: 'expr:5',
      remedy: [
        { kind: 'predict', text: '$5x + 2y = 19$ ו־$3x + 2y = 13$. מחסרים את השנייה מהראשונה. מה באגף ימין?', choices: ['$6$', '$32$'], answer: 0,
          why: '$19 - 13 = 6$. מחסרים את כל המשוואה השנייה, גם את אגף ימין שלה.' },
        { kind: 'predict', text: 'יצא $x = 3$ ו־$y = 2$. האם הזוג מקיים את $3x + 2y = 13$?', choices: ['כן: $9 + 4 = 13$', 'לא'], answer: 0,
          why: 'וגם את $5x + 2y = 19$: $15 + 4 = 19$. הבדיקה בשתי המשוואות תופסת חיסור שגוי.' },
        { kind: 'rule', text: 'חיסור משוואה: מינוס לפני כל האגף, בשני האגפים.', display: '(5x + 2y) - (3x + 2y) = 19 - 13',
          why: '$-(3x + 2y) = -3x - 2y$, ובאגף ימין מחסרים $13$. מה שעושים לאגף אחד עושים גם לשני.' },
      ] },
    { id: 'forgot-y', title: 'נמצא נעלם אחד, והשני לא חושב',
      cause: 'אחרי שנעלם אחד נעלם, מוצאים את השני ומרגישים שסיימנו. אבל פתרון של מערכת הוא זוג.',
      explain: ['נראה שעניתם את הנעלם שמצאתם ראשון.', 'ב־$x + y = 5$ ו־$x - y = 1$ החיבור נותן $x = 3$. מציבים: $3 + y = 5$, ולכן $y = 2$. הפתרון $(3, 2)$.'],
      prereq: 'sys:2',
      remedy: [
        { kind: 'explore', text: 'החיבור של $x + y = 5$ ו־$x - y = 1$ נתן $x = 3$. שימו את נקודת המפגש של $y = -x + 5$ ו־$y = x - 1$.', manip: lines([-1, 5], [1, -1]), answer: [3, 2],
          hint: 'מציבים $x = 3$: $y = -3 + 5$.', success: '$(3, 2)$: ה־$y$ של הנקודה הוא $2$.' },
        { kind: 'predict', text: '$x = 3$ ו־$x + y = 5$. מה $y$?', choices: ['$2$', '$3$', '$5$'], answer: 0,
          why: '$3 + y = 5$, ולכן $y = 2$. הפתרון $(3, 2)$.' },
      ] },
    { id: 'swap', title: 'הזוג נכתב הפוך: $y$ במקום $x$',
      cause: 'בהשוואת מקדמים לפעמים מוצאים קודם את $y$, וקל לכתוב אותו ראשון בזוג.',
      explain: ['נראה שהזוג נכתב בסדר הפוך.', 'אם $x = 7$ ו־$y = 3$, הפתרון $(7, 3)$, גם אם $y$ נמצא קודם.'],
      prereq: 'coord:1',
      remedy: [
        { kind: 'predict', text: 'במערכת $x + y = 10$ ו־$x - y = 4$ יצא $x = 7$ ו־$y = 3$. איזה זוג הוא הפתרון?', choices: ['$(7, 3)$', '$(3, 7)$'], answer: 0,
          why: 'קודם $x$. בדיקה: $(3, 7)$ לא מקיים את $x - y = 4$, כי $3 - 7 = -4$.' },
        { kind: 'rule', text: 'זוג סדור כותבים $(x, y)$, לא משנה מי נמצא קודם.', display: '(7, 3):\\quad 7 + 3 = 10,\\quad 7 - 3 = 4',
          why: 'הבדיקה בשתי המשוואות עם הזוג כפי שכתבתם תגלה אם הסדר הפוך.' },
      ] },
  ],
};

// ================================================================ stair 4: two unknowns from a story (בעיות עם שני נעלמים)

type Story = ReturnType<typeof G.storyDraw>;
const storyBugs: Record<string, (s: Story) => number | null> = {
  // the other unknown answered
  'wrong-unknown': (s) => (s.ask ? s.x : s.y),
  // q(n − x) opened as qn − x
  'partial-dist': (s) => G.storyPartial(s),
};
const storyModel = (kinds: string[]): DiagModel<Story> => ({
  params: (rnd) => fair(() => G.storyDraw(rnd, kinds), G.storyAnswer, storyBugs),
  text: (s) => G.storyText(s),
  answer: (s) => G.storyAnswer(s),
  bugs: storyBugs,
  solution: (s) => G.storySolution(s),
  hint: (s) => G.storyHint(s),
});

const stair4: StairContent = {
  skill: 'sys:4', topic: 'sys', level: 4, title: 'בעיות עם שני נעלמים',
  objectives: [
    'לבחור שני נעלמים ולכתוב במילים מה כל אחד מייצג.',
    'לבנות שתי משוואות מהסיפור: כל משפט שאומר "שווה" הוא משוואה.',
    'לפתור, לבדוק בסיפור ולענות בדיוק על מה שנשאל.',
  ],
  idea: 'בסיפור עם שני נעלמים מחפשים שני משפטים שאומרים "שווה". מכל אחד בונים משוואה, ופותרים את המערכת.',
  why: [
    'לשני נעלמים צריך שתי משוואות: משוואה אחת לבד מתקיימת בהרבה זוגות.',
    'התשובה צריכה להתאים לסיפור: מספר כרטיסים הוא שלם, ומחיר הוא חיובי.',
  ],
  alt: [
    'סכום $6$ והפרש $2$: בגרף אלה שני ישרים, $x + y = 6$ ו־$x - y = 2$, והפתרון $(4, 2)$ הוא המקום שבו הם נפגשים.',
    'אפשר לנחש ולבדוק: $6$ מבוגרים ו־$6$ ילדים נותנים $390$ ₪, פחות מ־$405$. כל מבוגר במקום ילד מוסיף $15$ ₪, וחסרים $15$: אז $7$ מבוגרים.',
  ],
  discover: [
    { kind: 'predict', text: 'להצגה נמכרו $12$ כרטיסים: למבוגרים ב־$40$ ₪ ולילדים ב־$25$ ₪. הקופה קיבלה $405$ ₪. מה כדאי לסמן ב־$x$ וב־$y$?', choices: ['$x$ כרטיסים למבוגרים, $y$ כרטיסים לילדים', '$x$ מחיר כרטיס, $y$ הכסף בקופה', '$x$ הכרטיסים שנמכרו, $y$ המחירים'], answer: 0,
      why: 'מה שלא יודעים הוא כמה כרטיסים מכל סוג. לכל אחד מהם אות.',
      wrongWhy: { 1: 'את המחירים ואת הכסף כבר יודעים: $40$, $25$ ו־$405$.', 2: 'יודעים שנמכרו $12$. לא יודעים כמה מכל סוג.' } },
    { kind: 'predict', text: 'אילו שתי משוואות מתאימות?', choices: ['$x + y = 405$ ו־$40x + 25y = 12$', '$x + y = 12$ ו־$40x + 25y = 405$', '$x + y = 12$ ו־$25x + 40y = 405$'], answer: 1,
      why: 'משפט אחד סופר כרטיסים: $12$. משפט שני סופר שקלים: כל כרטיס למבוגר $40$ ₪, ולכן $40x$.',
      wrongWhy: { 0: 'הכרטיסים הם $12$, והכסף $405$.', 2: '$40$ הוא המחיר של כרטיס למבוגר, ולכן הוא כופל את $x$, מספר המבוגרים.' } },
    { kind: 'rule', text: 'כל משפט בסיפור שאומר "שווה" נותן משוואה. לשני נעלמים צריך שתי משוואות.', display: '\\begin{cases} x + y = 12 \\\\ 40x + 25y = 405 \\end{cases}',
      why: 'משוואה אחת לבד מתקיימת בהרבה זוגות: $x + y = 12$ גם עם $(6, 6)$ וגם עם $(7, 5)$. רק $(7, 5)$ מקיים גם את השנייה.' },
    { kind: 'explore', text: 'שני מספרים: הסכום שלהם $6$, וההפרש $2$. בגרף $y = -x + 6$ ו־$y = x - 2$. שימו את הנקודה שמקיימת את שניהם.', manip: lines([-1, 6], [1, -2]), answer: [4, 2],
      hint: 'הנקודה צריכה להיות על שני הישרים.', success: '$(4, 2)$: $4 + 2 = 6$ ו־$4 - 2 = 2$. המספרים הם $4$ ו־$2$.' },
    { kind: 'predict', text: 'בסיפור הכרטיסים מציבים $y = 12 - x$. מה יוצא מ־$25y$?', choices: ['$300 - 25x$', '$300 - x$', '$12 - 25x$'], answer: 0,
      why: 'ה־$25$ כופל את שני האיברים: $25 \\cdot 12 = 300$, ו־$25 \\cdot x = 25x$. לכן $25(12 - x) = 300 - 25x$.',
      wrongWhy: { 1: 'גם $x$ נכפל ב־$25$: כל כרטיס לילד עולה $25$.', 2: 'גם $12$ נכפל ב־$25$.' } },
    { kind: 'predict', text: 'פתרנו: $40x + 300 - 25x = 405$, ולכן $x = 7$. השאלה: כמה כרטיסים לילדים נמכרו?', choices: ['$7$', '$12$', '$5$'], answer: 2,
      why: '$x = 7$ הם הכרטיסים למבוגרים. לילדים: $y = 12 - 7 = 5$.',
      wrongWhy: { 0: '$7$ הוא $x$, הכרטיסים למבוגרים. שאלו על הילדים.', 1: '$12$ הם כל הכרטיסים.' } },
    { kind: 'rule', text: 'בסוף בודקים בסיפור, ועונים על מה שנשאל.', display: '7 + 5 = 12,\\quad 40 \\cdot 7 + 25 \\cdot 5 = 405',
      why: '$280 + 125 = 405$. ואז חוזרים לשאלה: היא שאלה על הילדים.' },
    { kind: 'predict', text: 'בקופה $10$ מטבעות של $2$ ₪ ושל $5$ ₪, ובסך הכול $33$ ₪. מהמערכת יוצא $y = \\frac{13}{3}$ מטבעות של $5$ ₪. מה עונים?', choices: ['אין קופה כזאת: מספר מטבעות הוא שלם', 'יש $4\\frac{1}{3}$ מטבעות של $5$ ₪', 'מעגלים: $4$ מטבעות של $5$ ₪'], answer: 0,
      why: 'מטבעות סופרים בשלמים, ו־$\\frac{13}{3}$ לא שלם. לכן הסיפור לא אפשרי.',
      wrongWhy: { 1: 'אין שליש מטבע.', 2: 'עם $4$ מטבעות של $5$ ₪ יש $6$ של $2$ ₪, וזה $20 + 12 = 32$ ₪, לא $33$.' } },
    { kind: 'rule', text: 'הפתרון צריך להתאים לסיפור: מספר שלם כשסופרים, וחיובי כשמודדים.',
      why: 'המערכת לא יודעת שמדובר במטבעות. אנחנו יודעים, ולכן בודקים.' },
  ],
  examples: [
    { problem: 'בחצר תרנגולות וארנבים. יש להם יחד $20$ ראשים ו־$56$ רגליים. כמה ארנבים וכמה תרנגולות יש בחצר?', answer: 8, check: 'x', vars: { x: 8, y: 12 }, answerTex: 'x = 8,\\; y = 12',
      steps: [
        { action: 'מסמנים: $x$ מספר הארנבים, $y$ מספר התרנגולות. סופרים ראשים.', why: 'לכל חיה ראש אחד.', result: 'x + y = 20', eq: 'x + y = 20' },
        { action: 'סופרים רגליים.', why: 'לארנב $4$ רגליים, ולתרנגולת $2$.', result: '4x + 2y = 56', eq: '4*x + 2*y = 56' },
        { action: 'מציבים $y = 20 - x$, בסוגריים.', why: 'מהמשוואה הראשונה.', result: '4x + 2(20 - x) = 56', eq: '4*x + 2*(20 - x) = 56' },
        { action: 'פותחים סוגריים ומכנסים.', why: '$2 \\cdot 20 = 40$, ו־$2 \\cdot (-x) = -2x$.', result: '2x + 40 = 56', eq: '2*x + 40 = 56' },
        { action: 'פותרים.', why: '$2x = 16$.', result: 'x = 8', eq: 'x = 8' },
        { action: 'מוצאים את $y$ ובודקים בסיפור.', why: '$y = 20 - 8 = 12$. רגליים: $4 \\cdot 8 + 2 \\cdot 12 = 32 + 24 = 56$.', result: 'y = 12', eq: 'y = 12' },
      ] },
    { problem: 'רות שילמה $29$ ₪ על כביסה של $4$ מגבות ו־$7$ סדינים. במבצע של $20\\%$ הנחה היא שילמה $20$ ₪ על $5$ מגבות ו־$5$ סדינים. מה המחיר הרגיל לכביסה של מגבת, ושל סדין?', answer: 2, check: 'x', vars: { x: 2, y: 3 }, answerTex: 'x = 2,\\; y = 3',
      steps: [
        { action: 'מסמנים: $x$ מגבת, $y$ סדין, במחיר הרגיל.', why: 'הקנייה הראשונה במחיר רגיל.', result: '4x + 7y = 29', eq: '4*x + 7*y = 29' },
        { action: 'במבצע משלמים $80\\%$ מהמחיר הרגיל.', why: 'הנחה של $20\\%$ היא כפל ב־$0.8$.', result: '0.8(5x + 5y) = 20', eq: '0.8*(5*x + 5*y) = 20' },
        { action: 'מחלקים ב־$0.8$, ואחר כך ב־$5$.', why: '$20 : 0.8 = 25$, ו־$25 : 5 = 5$.', result: 'x + y = 5', eq: 'x + y = 5' },
        { action: 'מציבים $y = 5 - x$ בראשונה.', why: 'בסוגריים, כי $7$ כופל את כל $y$.', result: '4x + 7(5 - x) = 29', eq: '4*x + 7*(5 - x) = 29' },
        { action: 'פותחים סוגריים.', why: '$7 \\cdot 5 = 35$, ו־$4x - 7x = -3x$.', result: '35 - 3x = 29', eq: '35 - 3*x = 29' },
        { action: 'פותרים ומוצאים את $y$.', why: '$3x = 6$, ולכן $x = 2$, ו־$y = 5 - 2 = 3$.', result: 'x = 2', eq: 'x = 2' },
        { action: 'בודקים בסיפור.', why: 'במבצע: $0.8(10 + 15) = 20$.', result: '4 \\cdot 2 + 7 \\cdot 3 = 29', calc: { expr: '4*2 + 7*3', value: 29 } },
      ] },
  ],
  together: [
    { problem: 'בקופה $15$ מטבעות של $2$ ₪ ושל $5$ ₪, ובסך הכול $48$ ₪.',
      steps: [
        { prompt: 'אם $x$ מספר המטבעות של $2$ ₪ ו־$y$ של $5$ ₪, אילו משוואות מתאימות?', choices: [
          { text: '$x + y = 15$ ו־$2x + 5y = 48$', ok: true, feedback: 'נכון: סופרים מטבעות, וסופרים שקלים.' },
          { text: '$x + y = 48$ ו־$2x + 5y = 15$', ok: false, feedback: 'יש $15$ מטבעות ו־$48$ ₪, לא להפך.' },
          { text: '$x + y = 15$ ו־$5x + 2y = 48$', ok: false, feedback: 'כל מטבע של $2$ ₪ שווה $2$, ולכן $2x$.' },
        ], hints: ['משפט אחד סופר מטבעות, ומשפט שני סופר שקלים.', 'מטבעות: $x + y = 15$. שקלים: כל מטבע לפי הערך שלו.'], done: '$x + y = 15$ ו־$2x + 5y = 48$' },
        { prompt: 'מציבים $x = 15 - y$. מה מקבלים?', choices: [
          { text: '$30 + 4y = 48$', ok: false, feedback: 'זה יוצא כש־$2$ כופל רק את $15$. גם $-y$ נכפל: $2 \\cdot (-y) = -2y$.' },
          { text: '$30 + 3y = 48$', ok: true, feedback: 'נכון: $2(15 - y) + 5y = 30 - 2y + 5y$.' },
          { text: '$15 + 3y = 48$', ok: false, feedback: 'גם $15$ נכפל ב־$2$: $2 \\cdot 15 = 30$.' },
        ], hints: ['$2(15 - y) + 5y = 48$. פותחים סוגריים.', '$30 - 2y + 5y = 48$.'], done: '$3y = 18$' },
      ],
      final: { prompt: 'כמה מטבעות של $5$ ₪ יש?', answer: 6, check: '(48 - 30) / 3', hints: ['$3y = 48 - 30$.', 'מחלקים את $18$ ב־$3$.'] } },
    { problem: 'סכום של שני מספרים הוא $127$, וההפרש ביניהם $47$.',
      steps: [
        { prompt: '$x$ הגדול ו־$y$ הקטן: $x + y = 127$ ו־$x - y = 47$. מה מקבלים כשמחברים?', choices: [
          { text: '$2x = 174$', ok: true, feedback: 'נכון: $y - y = 0$, ו־$127 + 47 = 174$.' },
          { text: '$x = 174$', ok: false, feedback: '$x + x = 2x$. עוד צריך לחלק ב־$2$.' },
          { text: '$2x = 80$', ok: false, feedback: 'מחברים גם את אגפי ימין: $127 + 47 = 174$.' },
        ], hints: ['$y + (-y) = 0$.', '$x + x = 2x$, ו־$127 + 47$.'], done: '$2x = 174$, ולכן $x = 87$' },
      ],
      final: { prompt: 'מה המספר הקטן?', answer: 40, check: '127 - 87', hints: ['מציבים $x = 87$ ב־$x + y = 127$.', '$y = 127 - 87$.'] } },
  ],
  diag: storyModel(['tickets', 'coins']),
  transfer: storyModel(['legs']),
  misconceptions: [
    { id: 'wrong-unknown', title: 'נמצא נעלם, אבל התשובה לא עונה על מה שנשאל',
      cause: 'אחרי שפותרים מערכת יש שני מספרים, וקל לענות את הראשון שיצא.',
      explain: ['נראה שעניתם את הנעלם השני, ולא את מה שנשאל.', 'בסיפור הכרטיסים $x = 7$ הם המבוגרים ו־$y = 5$ הילדים. שאלו על הילדים: $5$.'],
      prereq: 'eq:5',
      remedy: [
        { kind: 'predict', text: 'בחצר $20$ ראשים ו־$56$ רגליים. יצאו $x = 8$ ארנבים ו־$y = 12$ תרנגולות. כמה תרנגולות יש?', choices: ['$8$', '$12$'], answer: 1,
          why: '$y$ הוא מספר התרנגולות: $12$. בדיקה: $8 + 12 = 20$ ראשים.' },
        { kind: 'rule', text: 'כותבים ליד כל אות מה היא מייצגת, וקוראים שוב את השאלה.', display: 'x = 8,\\quad y = 12',
          why: 'אחרי שפותרים יש שני מספרים. רק אחד מהם הוא מה שנשאל.' },
      ] },
    { id: 'partial-dist', title: 'בהצבה רק האיבר הראשון שבסוגריים נכפל',
      cause: 'בהצבה כמו $25(12 - x)$ קל לכפול רק את המספר הראשון.',
      explain: ['נראה שבהצבה רק האיבר הראשון שבסוגריים נכפל.', '$25(12 - x) = 300 - 25x$: כל כרטיס לילד עולה $25$, ולכן גם $x$ נכפל.'],
      prereq: 'expr:4',
      remedy: [
        { kind: 'explore', text: 'בנו מלבן ל־$2(x + 4)$, ושימו לב לשטח של כל חלק.', display: '2(x + 4)', manip: area(), answer: { a: 2, b: 4 },
          hint: 'גובה $2$, ואורך $x$ ועוד $4$ יחידות.', success: '$2x + 8$: שני החלקים נכפלים ב־$2$.' },
        { kind: 'predict', text: 'בקופה $15$ מטבעות של $2$ ₪ ושל $5$ ₪, ובסך הכול $48$ ₪. איך פותחים את $2(15 - y) + 5y$?', choices: ['$30 - 2y + 5y$', '$30 - y + 5y$'], answer: 0,
          why: '$2$ כופל גם את $15$ וגם את $-y$. עם $30 - 2y + 5y = 48$ יוצא $y = 6$, ובדיקה: $9 \\cdot 2 + 6 \\cdot 5 = 48$.' },
      ] },
  ],
};

// ================================================================ stair 5: inequalities (אי־שוויונות)

type Count = ReturnType<typeof G.countDraw>;
const countModel: DiagModel<Count> = {
  // the sum more often than the count: it shows a boundary taken or left (a count changes by one, as a slip does)
  params: (rnd) => fair(() => G.countDraw(rnd, { sum: 0.75 }), G.countAnswer, G.countBugs),
  text: (p) => G.countText(p),
  display: (p) => p.show,
  answer: (p) => G.countAnswer(p),
  bugs: G.countBugs,
  solution: (p) => G.countSolution(p),
  hint: (p) => `${G.ineqHint(p)} אחר כך בודקים כל מספר ברשימה, גם את הקצה.`,
};
type AtMost = ReturnType<typeof G.atMostDraw>;
const atMostModel: DiagModel<AtMost> = {
  params: (rnd) => fair(() => G.atMostDraw(rnd), (p) => p.n, G.atMostBugs),
  text: (p) => G.atMostText(p),
  answer: (p) => p.n,
  bugs: G.atMostBugs,
  solution: (p) => G.atMostSolution(p),
  hint: () => G.atMostHint(),
};

const stair5: StairContent = {
  skill: 'sys:5', topic: 'sys', level: 5, title: 'אי־שוויונות',
  objectives: [
    'לבדוק בהצבה אם מספר פותר אי־שוויון, ולבנות אי־שוויון מתיאור במילים.',
    'לפתור אי־שוויון כמו משוואה, ולהפוך את הכיוון כשכופלים או מחלקים במספר שלילי, ורק אז.',
    'לסמן את הפתרון על ציר המספרים, עם עיגול מלא או ריק.',
  ],
  idea: 'אי־שוויון פותרים כמו משוואה, והתשובה היא תחום של מספרים. כשכופלים או מחלקים את שני האגפים במספר שלילי, הופכים את הכיוון.',
  why: [
    'חיבור או חיסור של אותו מספר, וכפל או חילוק במספר חיובי, לא משנים מי גדול יותר.',
    '$2 < 5$, אבל $-2 > -5$: כפל ב־$-1$ משקף את ציר המספרים סביב האפס, והסדר מתהפך.',
  ],
  alt: [
    'אפשר להעביר אגף ולא לחלק בשלילי: $-2x > 6$ שקול ל־$-6 > 2x$, כלומר $x < -3$.',
    'בדיקה במספר אחד מגלה אם הכיוון נכון: ב־$-2x > 6$ המספר $-4$ פותר, כי $8 > 6$, ו־$0$ לא, כי $0 > 6$ לא נכון.',
  ],
  discover: [
    { kind: 'predict', text: 'מעלית מעמיסה לכל היותר $600$ ק״ג. אדם ששוקל $80$ ק״ג עולה איתה עם ארגזים של $25$ ק״ג. כמה ארגזים לכל היותר?', choices: ['$21$', '$20$', '$27$'], answer: 1,
      why: 'האדם והארגזים: $80 + 25n \\le 600$. מחסירים $80$: $25n \\le 520$, ולכן $n \\le 20.8$. ארגזים סופרים בשלמים: $20$.',
      wrongWhy: { 0: 'עם $21$ ארגזים: $80 + 25 \\cdot 21 = 605$, יותר מ־$600$. ב"לכל היותר" מעגלים למטה.', 2: '$27$ יוצא כש־$80$ עובר אגף בלי להפוך סימן: $25n \\le 680$. אבל מחסירים $80$ משני האגפים.' } },
    { kind: 'rule', text: 'אי־שוויון פותרים כמו משוואה: מחסירים, מוסיפים, ומחלקים במספר חיובי, תמיד בשני האגפים.', display: '80 + 25n \\le 600 \\;\\Rightarrow\\; n \\le 20.8',
      why: 'הפתרון הוא תחום: כל $n$ עד $20.8$. מתוכו בוחרים מה שמתאים לסיפור: מספר שלם של ארגזים, עד $20$.' },
    { kind: 'predict', text: 'איזה מהם $x = 4$ פותר: $2x + 1 \\le 9$ או $2x + 1 < 9$?', choices: ['רק את $2x + 1 \\le 9$', 'את שניהם', 'אף אחד מהם'], answer: 0,
      why: 'מציבים: $2 \\cdot 4 + 1 = 9$. $9 \\le 9$ נכון, כי $\\le$ כולל שוויון. אבל $9 < 9$ לא נכון.',
      wrongWhy: { 1: '$9 < 9$ לא נכון: מספר לא קטן מעצמו.', 2: '$9 \\le 9$ נכון: "קטן או שווה" כולל שווה.' } },
    { kind: 'explore', text: 'סמנו את כל הפתרונות של $2x + 1 \\le 9$: גררו את הנקודה, ובחרו צד ועיגול.', display: '2x + 1 \\le 9', manip: ray({ at: 0, dir: 1, closed: false }), answer: { at: 4, dir: -1, closed: true },
      hint: 'פותרים: $2x \\le 8$, כלומר $x \\le 4$. ו־$4$ עצמו פותר, ולכן העיגול מלא.', success: '$x \\le 4$: עיגול מלא ב־$4$, כי הוא פותר, וקרן שמאלה. ב־$<$ או $>$ העיגול ריק.' },
    { kind: 'explore', text: 'שימו על הציר את $2$, $5$, $-2$ ו־$-5$.', manip: pins([2, 5, -2, -5], [0, 1, 3, 7]), answer: [2, 5, -2, -5],
      hint: 'מספר שלילי משמאל לאפס, במרחק שלו מאפס.', success: '$2 < 5$, אבל $-2$ מימין ל־$-5$, ולכן $-2 > -5$.' },
    { kind: 'predict', text: '$2 < 5$. כופלים את שני הצדדים ב־$-1$. מה נכון?', choices: ['$-2 > -5$', '$-2 < -5$'], answer: 0,
      why: '$-2$ מימין ל־$-5$, ולכן הוא הגדול. כפל ב־$-1$ משקף את הציר, והסדר מתהפך.' },
    { kind: 'predict', text: '$-2x > 6$. מה הפתרון?', choices: ['$x > -3$', '$x < -3$', '$x > 3$'], answer: 1,
      why: 'מחלקים ב־$-2$, מספר שלילי, ולכן הופכים את הכיוון: $x < -3$. בדיקה: $x = -4$ נותן $8 > 6$, נכון.',
      wrongWhy: { 0: 'בדיקה: $x = 0$ גדול מ־$-3$, אבל $-2 \\cdot 0 = 0$, ו־$0 > 6$ לא נכון.', 2: 'בדיקה: $x = 4$ נותן $-8 > 6$, לא נכון.' } },
    { kind: 'explore', text: 'סמנו את הפתרונות של $-2x > 6$.', display: '-2x > 6', manip: ray({ at: 0, dir: 1, closed: false }), answer: { at: -3, dir: -1, closed: false },
      hint: 'מחלקים ב־$-2$ והופכים: $x < -3$. ו־$-3$ עצמו לא פותר.', success: '$x < -3$: עיגול ריק ב־$-3$ וקרן שמאלה. בדיקה: $-4$ פותר, ו־$0$ לא.' },
    { kind: 'predict', text: '$2x > -6$. הופכים את הכיוון?', choices: ['לא: מחלקים ב־$2$, שהוא חיובי', 'כן: יש מינוס'], answer: 0,
      why: 'הופכים רק כשכופלים או מחלקים במספר שלילי. כאן $x > -3$, ו־$0$ פותר: $0 > -6$.' },
    { kind: 'rule', text: 'כופלים או מחלקים במספר שלילי? הופכים את כיוון אי־השוויון. בכל מקרה אחר הכיוון נשאר.', display: '-2x > 6 \\;\\Rightarrow\\; x < -3',
      why: 'מינוס במקום אחר לא הופך כלום. ובסוף בודקים מספר אחד מהתחום.' },
  ],
  examples: [
    { problem: 'פתרו את אי־השוויון.', display: '4x - 3 > 2x + 5', answer: 5, check: '4 + 1', ray: { at: 4, dir: 1, closed: false }, answerTex: 'x > 4',
      steps: [
        { action: 'מחסירים $2x$ משני האגפים.', why: 'כמו במשוואה: מורידים את $x$ מאגף אחד.', result: '2x - 3 > 5', ineq: '2*x - 3 > 5' },
        { action: 'מוסיפים $3$ לשני האגפים.', why: 'הוספה לא משנה את הכיוון.', result: '2x > 8', ineq: '2*x > 8' },
        { action: 'מחלקים ב־$2$.', why: '$2$ חיובי, ולכן הכיוון נשאר.', result: 'x > 4', ineq: 'x > 4' },
        { action: 'בודקים במספר שלם מהתחום: $x = 5$.', why: 'באגף שמאל $4 \\cdot 5 - 3 = 17$, ובאגף ימין $2 \\cdot 5 + 5 = 15$. ו־$17 > 15$ נכון.', result: '17 > 15', calc: { expr: '4*5 - 3', value: 17 } },
      ] },
    { problem: 'פתרו את אי־השוויון.', display: '-2x + 5 > 11', answer: -4, check: '-3 - 1', ray: { at: -3, dir: -1, closed: false }, answerTex: 'x < -3',
      steps: [
        { action: 'מחסירים $5$ משני האגפים.', why: 'כמו במשוואה.', result: '-2x > 6', ineq: '-2*x > 6' },
        { action: 'מחלקים ב־$-2$, מספר שלילי.', why: 'לכן הופכים את הכיוון.', result: 'x < -3', ineq: 'x < -3' },
        { action: 'בודקים שני מספרים: $-4$ ו־$0$.', why: '$x = -4$: $-2 \\cdot (-4) + 5 = 13$, ו־$13 > 11$ נכון. $x = 0$: $5 > 11$ לא נכון. הכיוון נכון.', result: '13 > 11', calc: { expr: '-2*(-4) + 5', value: 13 } },
      ] },
    { problem: 'הטמפרטורה בבוקר $20^\\circ$, והיא יורדת ב־$3^\\circ$ בכל שעה. אחרי כמה שעות היא תהיה נמוכה מ־$2^\\circ$? $x$ מספר השעות.', answer: 6, check: '(20 - 2) / 3', ray: { at: 6, dir: 1, closed: false }, answerTex: 'x > 6',
      steps: [
        { action: 'כותבים אי־שוויון.', why: 'אחרי $x$ שעות: $20 - 3x$ מעלות, ורוצים פחות מ־$2$.', result: '20 - 3x < 2', ineq: '20 - 3*x < 2' },
        { action: 'מחסירים $20$ משני האגפים.', why: 'כמו במשוואה.', result: '-3x < -18', ineq: '-3*x < -18' },
        { action: 'מחלקים ב־$-3$ והופכים את הכיוון.', why: 'מחלקים במספר שלילי.', result: 'x > 6', ineq: 'x > 6' },
        { action: 'בודקים ומפרשים.', why: 'אחרי $7$ שעות: $20 - 21 = -1$, פחות מ־$2$. אחרי $6$ שעות בדיוק $2^\\circ$, עוד לא פחות.', result: '20 - 3 \\cdot 7 = -1', calc: { expr: '20 - 3*7', value: -1 } },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '5x - 4 \\ge 11',
      steps: [
        { prompt: 'מה הצעד הראשון?', choices: [
          { text: 'מוסיפים $4$ לשני האגפים: $5x \\ge 15$', ok: true, feedback: 'נכון: $-4 + 4 = 0$, ו־$11 + 4 = 15$.' },
          { text: 'מחסירים $4$: $5x \\ge 7$', ok: false, feedback: 'את ה־$-4$ מבטלים בהוספה של $4$: $11 + 4 = 15$.' },
          { text: 'הופכים את הכיוון: $5x - 4 \\le 11$', ok: false, feedback: 'אין סיבה להפוך: לא כפלנו ולא חילקנו במספר שלילי.' },
        ], hints: ['מה מבטל את ה־$-4$?', 'מוסיפים $4$ לשני האגפים.'], done: '$5x \\ge 15$' },
        { prompt: 'מה הפתרון?', choices: [
          { text: '$x \\ge 3$', ok: true, feedback: 'נכון: מחלקים ב־$5$, מספר חיובי.' },
          { text: '$x \\le 3$', ok: false, feedback: 'מחלקים במספר חיובי, ולכן הכיוון נשאר.' },
          { text: '$x > 3$', ok: false, feedback: '$3$ עצמו פותר: $5 \\cdot 3 - 4 = 11$, ו־$11 \\ge 11$ נכון.' },
        ], hints: ['מחלקים ב־$5$. האם הוא חיובי?', 'כן, ולכן $\\ge$ נשאר.'], done: '$x \\ge 3$' },
      ],
      final: { prompt: 'מה המספר השלם הקטן ביותר שפותר?', answer: 3, check: '15 / 5', hints: ['$x \\ge 3$: האם $3$ עצמו בפנים?', '$\\ge$ כולל שוויון.'] } },
    { problem: 'עכשיו עם מינוס מוסתר.', display: '7 - x \\le 3',
      steps: [
        { prompt: 'מחסירים $7$ משני האגפים. מה מקבלים?', choices: [
          { text: '$-x \\le -4$', ok: true, feedback: 'נכון: $7 - 7 = 0$, ו־$3 - 7 = -4$.' },
          { text: '$-x \\le 10$', ok: false, feedback: 'מחסירים $7$ גם מימין: $3 - 7 = -4$.' },
          { text: '$x \\le -4$', ok: false, feedback: 'נשאר $-x$, עם המינוס.' },
        ], hints: ['$7 - 7 = 0$, ומה זה $3 - 7$?', 'באגף שמאל נשאר $-x$.'], done: '$-x \\le -4$' },
        { prompt: 'מחלקים ב־$-1$. מה הפתרון?', choices: [
          { text: '$x \\le 4$', ok: false, feedback: 'מחלקים ב־$-1$, מספר שלילי, ולכן הופכים. בדיקה: $x = 0$ נותן $7 \\le 3$, לא נכון.' },
          { text: '$x \\ge 4$', ok: true, feedback: 'נכון: חילוק בשלילי הופך את הכיוון.' },
          { text: '$x \\ge -4$', ok: false, feedback: '$-4 : (-1) = 4$.' },
        ], hints: ['$-1$ הוא מספר שלילי.', 'הופכים את $\\le$ ל־$\\ge$, ו־$-4 : (-1) = 4$.'], done: '$x \\ge 4$' },
      ],
      final: { prompt: 'מה המספר השלם הקטן ביותר שפותר?', answer: 4, check: '7 - 3', hints: ['$x \\ge 4$.', '$\\ge$ כולל את הקצה עצמו.'] } },
  ],
  diag: countModel,
  transfer: atMostModel,
  misconceptions: [
    { id: 'no-flip', title: 'חילקו במספר שלילי ולא הפכו את כיוון אי־השוויון',
      cause: 'אי־שוויון פותרים כמו משוואה, ובמשוואה אין כיוון שצריך להפוך. אבל בחילוק במספר שלילי הסדר על הציר מתהפך.',
      explain: ['נראה שחילקתם במספר שלילי בלי להפוך את הכיוון.', '$-2x > 6$: מחלקים ב־$-2$ ומקבלים $x < -3$. בדיקה: $-4$ פותר, כי $8 > 6$, ו־$0$ לא.'],
      prereq: 'signed:2',
      remedy: [
        { kind: 'explore', text: 'שימו על הציר את $2$, $5$, $-2$ ו־$-5$.', manip: pins([2, 5, -2, -5], [0, 1, 3, 7]), answer: [2, 5, -2, -5],
          hint: 'מספר שלילי משמאל לאפס, במרחק שלו מאפס.', success: '$2 < 5$, אבל $-2 > -5$. כפל ב־$-1$ הפך את הסדר.' },
        { kind: 'predict', text: '$-3x < 12$. מה הפתרון?', choices: ['$x < -4$', '$x > -4$'], answer: 1,
          why: 'מחלקים ב־$-3$ והופכים. בדיקה: $x = 0$ נותן $0 < 12$, נכון, ו־$0 > -4$.' },
        { kind: 'explore', text: 'סמנו את הפתרונות של $-3x < 12$.', display: '-3x < 12', manip: ray({ at: 0, dir: -1, closed: false }), answer: { at: -4, dir: 1, closed: false },
          hint: 'מחלקים ב־$-3$ והופכים: $x > -4$.', success: '$x > -4$: עיגול ריק ב־$-4$ וקרן ימינה.' },
      ] },
    { id: 'over-flip', title: 'הכיוון התהפך בלי כפל או חילוק במספר שלילי',
      cause: 'הכלל "הופכים כשיש שלילי" נזכר בלי החלק החשוב: רק כשכופלים או מחלקים במספר שלילי.',
      explain: ['נראה שהפכתם את הכיוון כשלא היה צריך.', '$2x > -6$: מחלקים ב־$2$, מספר חיובי, והכיוון נשאר: $x > -3$. המינוס של $-6$ לא הופך כלום.'],
      prereq: 'signed:3',
      remedy: [
        { kind: 'predict', text: '$3x < -12$. מה הפתרון?', choices: ['$x < -4$', '$x > -4$'], answer: 0,
          why: 'מחלקים ב־$3$, מספר חיובי: $x < -4$. בדיקה: $x = -5$ נותן $-15 < -12$, נכון.' },
        { kind: 'explore', text: 'סמנו את הפתרונות של $2x > -6$.', display: '2x > -6', manip: ray({ at: 0, dir: -1, closed: false }), answer: { at: -3, dir: 1, closed: false },
          hint: 'מחלקים ב־$2$, והכיוון נשאר: $x > -3$.', success: '$x > -3$: עיגול ריק ב־$-3$ וקרן ימינה. $0$ פותר: $0 > -6$.' },
        { kind: 'rule', text: 'הופכים רק כשכופלים או מחלקים במספר שלילי.', display: '2x > -6 \\;\\Rightarrow\\; x > -3',
          why: 'מה שקובע הוא המספר שמחלקים בו. כאן $2$, חיובי.' },
      ] },
    { id: 'boundary', title: 'התבלבלו בין $<$ ל־$\\le$: האם הקצה עצמו פותר',
      cause: 'הקצה הוא המספר שבו שני האגפים שווים. ב־$<$ ו־$>$ שוויון לא מספיק, וב־$\\le$ ו־$\\ge$ הוא מספיק.',
      explain: ['נראה שהקצה נכלל או נשאר בחוץ בטעות.', 'ב־$2x + 1 < 9$ הקצה הוא $4$: $2 \\cdot 4 + 1 = 9$, ו־$9 < 9$ לא נכון. לכן $4$ לא פותר, והעיגול ריק.'],
      prereq: 'signed:2',
      remedy: [
        { kind: 'predict', text: 'האם $x = 4$ פותר את $2x + 1 < 9$?', choices: ['לא: $9 < 9$ לא נכון', 'כן'], answer: 0,
          why: 'מציבים: $2 \\cdot 4 + 1 = 9$. מספר לא קטן מעצמו, ולכן $4$ לא פותר.' },
        { kind: 'explore', text: 'סמנו את הפתרונות של $2x + 1 < 9$. שימו לב לעיגול.', display: '2x + 1 < 9', manip: ray({ at: 4, dir: -1, closed: true }), answer: { at: 4, dir: -1, closed: false },
          hint: 'האם $4$ עצמו פותר? אם לא, העיגול ריק.', success: '$x < 4$: עיגול ריק, כי $4$ לא פותר.' },
      ] },
    { id: 'move-no-flip', title: 'מספר עבר לאגף השני בלי שהסימן שלו התהפך',
      cause: 'הכלל "מעבירים אגף" נזכר בלי "ומחליפים סימן".',
      explain: ['נראה שמספר עבר לאגף השני בלי להתהפך.', '$80 + 25n \\le 600$: מחסירים $80$ משני האגפים, $25n \\le 520$, ולא $680$.'],
      prereq: 'eq:2',
      remedy: [
        { kind: 'predict', text: '$80 + 25n \\le 600$. מה מקבלים אחרי שמחסירים $80$ משני האגפים?', choices: ['$25n \\le 520$', '$25n \\le 680$'], answer: 0,
          why: '$600 - 80 = 520$. בדיקה: עם $27$ ארגזים המעלית שוקלת $80 + 675 = 755$, הרבה יותר מ־$600$.' },
        { kind: 'rule', text: 'מחסירים מספר משני האגפים, ולכן באגף השני הוא מופיע עם מינוס.', display: '80 + 25n \\le 600 \\;\\Rightarrow\\; 25n \\le 520',
          why: '"מעבירים אגף ומחליפים סימן" הוא קיצור של "מחסירים משני האגפים".' },
      ] },
  ],
};

export const SYS: StairContent[] = [stair1, stair2, stair3, stair4, stair5];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/sys.js names them all). */
export const CATS_SYS: Record<string, string> = {};
export { pctModel, substModel, elimModel, countModel };
