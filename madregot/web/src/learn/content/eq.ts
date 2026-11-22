// Equations (משוואות), grade 7, in the order of the Ministry's programme (March to May): what an equation and its
// solution are, two steps, the unknown on both sides, brackets, word problems; then motion problems (eq:6) and equations
// with denominators and proportion (eq:7), ח׳ 8.9's, which a ז׳ class meets in June.
// One idea carries the five stairs: an equation is a balance. Doing the same to both sides keeps it level and keeps
// its solution, and the solution is checked by putting it back in (the curriculum: "פתרון מלא כולל בחובו הצבה במשוואה
// המקורית לצורך בדיקה"). The balance carries positive whole numbers only; negatives follow the same rule without it
// (Vlassis 2002 on the balance's limit), and the stairs say so. The models are those of the algebra plan with the
// critique's corrections: x : a in the first stair, b − x = c and dividing only some terms (divide-part) in the second,
// friendlier fractions, the subtracted coefficient (sub-coef), slip-like predictions redrawn, and the classroom phrase
// "מעבירים אגף ומחליפים סימן" tied to the balance.
// Teaching content: see MADREGOT2.md (content conventions) and content/signed.ts (the quality bar).
import type { DiagModel, FigSpec, ManipSpec, StairContent } from '../types';
import { rint, rnz, rpick, same } from '../expr';
import { slipLike } from '../misconceptions';
// @ts-ignore: plain JS helpers shared with the exercise generators
import { T, undoOp, divOp, mulOp } from '@/content/util.js';
// @ts-ignore: plain JS, the board lines of the exercise generators (CLASSROOM-7): the operation after a slash at the end
// of the line it acts on, the named steps of an equation with brackets, and "x = 9 (הפכנו צדדים)"
import { line, bothSolution, twoStepSolution, stampsLines, agesLines, STEP1, STEP2, rectAt, rectBugs, rectText, rectHint, rectLines, rectStoryFig, rectFig, transferFig, lastStepBugs } from '@/content/eq.js';
// @ts-ignore: plain JS, the same TeX the expression generators print
import { linTex, sumTex } from '@/content/expr.js';
// @ts-ignore: plain JS, eq:6's and eq:7's models (the critique's eq6 and eq7, the spec's eq6T and eq7T), texts and worked solutions
import { EQ6, EQ6T, eq6Text, eq6Hint, eq6Solution, eq6TText, eq6THint, eq6TSolution, EQ7, EQ7T, eq7Show, eq7Hint, eq7Solution, eq7TText, eq7THint, eq7TSolution } from '@/content/eq.js';

const abs = Math.abs;
/** A still scale: boxes and weights on each pan; tilt 1 when the right pan is down, −1 the left. */
const scale = (lx: number, l1: number, rx: number, r1: number, tilt = 0): FigSpec => ({ type: 'scale', left: { x: lx, n: l1 }, right: { x: rx, n: r1 }, ...(tilt ? { tilt } : {}) });
const balance = (lx: number, l1: number, rx: number, r1: number): ManipSpec => ({ kind: 'balance', start: { lx, l1, rx, r1 } });
// the rectangle starts two units high: one unit high, its labels and both handles crowd a strip of 23px
const area = (): ManipSpec => ({ kind: 'area', start: { a: 2, b: 0 }, maxA: 6, maxB: 9 });
// The teaching figures (STUDENT-8): the balance where it can carry the numbers (positive, at most 6 boxes and 20
// weights); otherwise a machine (which number goes in to give this?), the number line for a solution reached by a move,
// a table for a story or for both sides at a few x.
const machine = (inX: number | string, rule: string, outY: number | string): FigSpec => ({ type: 'machine', inX, rule, outY });
// the class's layout (CLASSROOM-8): the people in rows, before and after in columns
const STAMPS_FIG: FigSpec = { type: 'table', head: ['', 'בהתחלה', 'אחרי הנתינה'], rows: [['רינה', 'x', 'x + 7'], ['דני', '2x', '2x − 7']] };
// The worked examples and solving together (SK-STUDENT-1) draw what stage A drew: the machine (which number goes in?),
// the balance where every number is positive, the line for a move, the rectangle of a bracket, the class's table for a
// story or a trip, and a table of both sides at the solution (learn/figures.test.ts checks each one against its numbers).
/** Both sides of an equation at x: the check, as the class writes it (left to right, as the equation is). */
const sides = (left: string, right: string, xs: number[], at: (x: number) => [number, number]): FigSpec =>
  ({ type: 'table', ltr: true, head: ['x', left, right], rows: xs.map((x) => [x, ...at(x)]) });
/** The gyms of eq:3: month by month, what each one has cost so far (120 + 80 a month, 40 + 100 a month). */
const gyms = (months: number[]): FigSpec => ({ type: 'table', head: ['חודשים', 'מכון א׳ (₪)', 'מכון ב׳ (₪)'], rows: months.map((m) => [m, 120 + 80 * m, 40 + 100 * m]) });
/** A right triangle whose acute angles are x and x + 20° (35° and 55°, drawn to size; the right angle at the bottom). */
const RIGHT_X: FigSpec = {
  type: 'geo', view: [300, 200], pad: [44, 34], label: 'משולש ישר־זווית: זווית חדה אחת x, והשנייה x + 20°',
  pts: { _C: [0, 0], _A: [4, 0], _B: [0, 4 * Math.tan((35 * Math.PI) / 180)] }, polys: [{ pts: ['_A', '_B', '_C'] }],
  segs: [{ a: '_A', b: '_C' }, { a: '_C', b: '_B' }, { a: '_B', b: '_A' }],
  angles: [{ at: '_C', from: '_A', to: '_B', right: true }, { at: '_A', from: '_B', to: '_C', text: 'x' }, { at: '_B', from: '_C', to: '_A', text: 'x + 20°' }],
};
/** Bars of the whole x cut into `den` equal parts: one row per term, its parts shaded (x/4 is 3 of 12), named by the term. */
const xBars = (den: number, rows: [number, string][]): FigSpec => ({ type: 'fbar', rows: rows.map(([shaded, label]) => ({ den, shaded, label })) });

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
/** The rule of the last line kx = m when the number is the smaller (stair 1's divide-flip, again on stairs 2 and 3). */
const DIVIDE_RULE = {
  kind: 'rule' as const, text: 'מחלקים את המספר שבאגף השני במקדם, גם כשהוא קטן מהמקדם.', display: '4x = 2 \\;\\Rightarrow\\; x = \\frac{2}{4} = \\frac{1}{2}',
  why: 'המקדם כופל את $x$, ולכן בו מחלקים. כשהמספר קטן מהמקדם, הפתרון קטן מ־$1$.',
};
type LastId = 'sign' | 'divide-flip' | 'sub-coef';
/**
 * The first two stairs' mistakes on the last line kx = m of a model's question (content/eq.js lastStepBugs), as the
 * model's bugs: `km` gives the line, `ids` the mistakes that can show on the model's questions (a model whose answers are
 * whole numbers never has the number smaller than the coefficient). A model predicts one number a mistake: the first.
 */
function lastStep<P>(km: (p: P) => [number, number], ids: LastId[]): Record<string, (p: P) => number | null> {
  const first = (v: number | number[] | null) => (Array.isArray(v) ? v[0] : v);
  return Object.fromEntries(ids.map((id) => [id, (p: P) => first(lastStepBugs(...km(p))[id])]));
}
/** "Remove b from both sides", in words. */
const undo = (b: number) => (b > 0 ? `מחסירים $${b}$ משני האגפים` : `מוסיפים $${-b}$ לשני האגפים`);
/** a·v + b with v put in, as TeX: 3 \cdot (-2) + 5. */
const at = (a: number, b: number, v: number) => {
  const prod = a === 1 ? T(v) : a === -1 ? `-${T(v, true)}` : `${T(a)} \\cdot ${T(v, true)}`;
  return b === 0 ? prod : `${prod} ${b < 0 ? '-' : '+'} ${abs(b)}`;
};

// ================================================================ stair 1: an equation and its solution (משוואה ופתרון)

type One = { k: number; a: number; b: number; x: number }; // k 0: x + a = b, 1: x − a = b, 2: ax = b, 3: x : a = b
const oneShow = (p: One) => (p.k === 0 ? `x + ${p.a} = ${T(p.b)}` : p.k === 1 ? `x - ${p.a} = ${T(p.b)}` : p.k === 2 ? `${linTex(p.a, 0)} = ${T(p.b)}` : `\\frac{x}{${p.a}} = ${T(p.b)}`);
const oneBugs: Record<string, (p: One) => number | null> = {
  // the number moved to the other side with the same operation (Hall 2002): x + 5 = 12 → 17, x : 4 = 3 → 3 : 4
  'move-no-flip': (p) => (p.k === 0 ? p.b + p.a : p.k === 1 ? p.b - p.a : p.k === 3 ? p.b / p.a : null),
  // the larger divided by the smaller (Fischbein et al. 1985): 12x = 3 → 4
  'divide-flip': (p) => (p.k === 2 && abs(p.a) > abs(p.b) ? p.a / p.b : null),
  // the coefficient's minus lost (Vlassis 2002): −3x = 12 → 4
  sign: (p) => (p.k === 2 && p.a < 0 ? -p.x : null),
  // 3x read as 3 + x: 3x = 12 → 9
  'sub-coef': (p) => (p.k === 2 ? p.b - p.a : null),
};
const oneDraw = (rnd: () => number): One => {
  const u = rnd(); const k = u < 0.25 ? 0 : u < 0.4 ? 1 : u < 0.8 ? 2 : 3;
  if (k < 2) { const a = rint(rnd, 2, 15); const x = rnz(rnd, -12, 12); return { k, a, x, b: k === 0 ? x + a : x - a }; }
  if (k === 2) {
    // a fraction a fifth of the time, small ones only: 1/2, 1/4, 3/4, 2/5, 3/5
    if (rnd() < 0.2) { const b = rpick(rnd, [1, 1, 2, 3, -1]); const a = abs(b) === 1 ? rpick(rnd, [2, 4]) : rpick(rnd, [4, 5]); return { k, a, x: b / a, b }; }
    const a = rint(rnd, 2, 9) * (rnd() < 0.35 ? -1 : 1); const x = rnz(rnd, -10, 10); return { k, a, x, b: a * x };
  }
  const a = rint(rnd, 2, 6); const b = rnz(rnd, -9, 9); return { k, a, x: a * b, b };
};
const oneStepModel: DiagModel<One> = {
  params: (rnd) => fair(() => oneDraw(rnd), (p) => p.x, oneBugs),
  text: () => 'פתרו את המשוואה.',
  display: oneShow,
  answer: (p) => p.x,
  bugs: oneBugs,
  // the problem's line with the operation after a slash, as the class writes it (CLASSROOM-7), then what it gives
  solution: (p) => [line('', oneShow(p), [`-${p.a}`, `+${p.a}`, divOp(p.a), mulOp(p.a)][p.k]), ...(p.k === 0 ? [`מחסירים $${p.a}$ משני האגפים: $x = ${T(p.b)} - ${p.a} = ${T(p.x)}$`, `בדיקה: $${T(p.x)} + ${p.a} = ${T(p.b)}$`]
    : p.k === 1 ? [`מוסיפים $${p.a}$ לשני האגפים: $x = ${T(p.b)} + ${p.a} = ${T(p.x)}$`, `בדיקה: $${T(p.x)} - ${p.a} = ${T(p.b)}$`]
      : p.k === 2 ? [`מחלקים את שני האגפים ב־$${T(p.a)}$: $x = ${T(p.b)} : ${T(p.a, true)} = ${T(p.x)}$`, `בדיקה: $${at(p.a, 0, p.x)} = ${T(p.b)}$`]
        : [`כופלים את שני האגפים ב־$${p.a}$: $x = ${T(p.b, true)} \\cdot ${p.a} = ${T(p.x)}$`, `בדיקה: $${T(p.x)} : ${p.a} = ${T(p.b)}$`])],
  hint: (p) => (p.k === 0 ? `מה מבטל את ה"ועוד $${p.a}$"? עושים את זה לשני האגפים.` : p.k === 1 ? `חיסור של $${p.a}$ מבטלים בחיבור, בשני האגפים.`
    : p.k === 2 ? 'כפל מבטלים בחילוק: מחלקים את שני האגפים במקדם, עם הסימן שלו.' : `$x$ מחולק ב־$${p.a}$. חילוק מבטלים בכפל, בשני האגפים.`),
};

type Think = { k: number; a: number; x: number; b: number; n: number }; // a number thought of: added, took away, divided, multiplied
const THINKERS = ['דנה', 'מאיה', 'שירה', 'נועה'];
const thinkBugs: Record<string, (p: Think) => number | null> = {
  'move-no-flip': (p) => (p.k === 0 ? p.b + p.a : p.k === 1 ? p.b - p.a : p.k === 2 ? p.b / p.a : null),
  'sub-coef': (p) => (p.k === 3 ? p.b - p.a : null),
};
const thinkModel: DiagModel<Think> = {
  // the same one step as a story: "I thought of a number, added 7 and got 3"
  params: (rnd) => fair(() => {
    const u = rnd(); const k = u < 0.3 ? 0 : u < 0.55 ? 1 : u < 0.8 ? 2 : 3; const n = rint(rnd, 0, THINKERS.length - 1);
    if (k < 2) { const a = rint(rnd, 2, 15); const x = rnz(rnd, -9, 15); return { k, a, x, b: k === 0 ? x + a : x - a, n }; }
    if (k === 2) { const a = rint(rnd, 2, 6); const b = rnz(rnd, -9, 9); return { k, a, x: a * b, b, n }; }
    const a = rint(rnd, 2, 9); const x = rnz(rnd, -9, 9); return { k, a, x, b: a * x, n };
  }, (p) => p.x, thinkBugs),
  text: (p) => `${THINKERS[p.n]} חשבה על מספר, ${['הוסיפה לו', 'הורידה ממנו', 'חילקה אותו ב־', 'כפלה אותו ב־'][p.k]}${p.k < 2 ? ' ' : ''}$${p.a}$ וקיבלה $${T(p.b)}$. על איזה מספר היא חשבה?`,
  answer: (p) => p.x,
  bugs: thinkBugs,
  solution: (p) => {
    const eq = [`x + ${p.a}`, `x - ${p.a}`, `x : ${p.a}`, `${p.a}x`][p.k];
    const how = [`מחסירים $${p.a}$ משני האגפים`, `מוסיפים $${p.a}$ לשני האגפים`, `כופלים את שני האגפים ב־$${p.a}$`, `מחלקים את שני האגפים ב־$${p.a}$`][p.k];
    return [line('נסמן את המספר ב־$x$', `${eq} = ${T(p.b)}`, [`-${p.a}`, `+${p.a}`, mulOp(p.a), divOp(p.a)][p.k]), line(how, `x = ${T(p.x)}`), `בדיקה: $${[`${T(p.x)} + ${p.a}`, `${T(p.x)} - ${p.a}`, `${T(p.x)} : ${p.a}`, `${p.a} \\cdot ${T(p.x, true)}`][p.k]} = ${T(p.b)}$`];
  },
  hint: (p) => `כתבו משוואה: המספר הוא $x$. מה ${THINKERS[p.n]} עשתה לו? עכשיו מבטלים את זה בפעולה ההפוכה.`,
};

const stair1: StairContent = {
  skill: 'eq:1', topic: 'eq', level: 1, title: 'משוואה ופתרון',
  objectives: [
    'להבין שמשוואה היא שוויון בין שני אגפים, ושהפתרון הוא המספר שמאזן אותם.',
    'לבדוק בהצבה אם מספר הוא פתרון של משוואה.',
    'לפתור משוואה בצעד אחד: פעולה הפוכה על שני האגפים, שנכתבת בסוף השורה אחרי קו.',
  ],
  idea: 'משוואה היא כמו מאזניים מאוזנים. פותרים כשעושים את אותו דבר לשני האגפים, עד שהנעלם נשאר לבד.',
  why: [
    'אם מורידים $5$ רק מכף אחת, המאזניים נוטים. אם מורידים $5$ משתי הכפות, הם נשארים מאוזנים, וגם הפתרון לא משתנה.',
    'פעולה הפוכה מבטלת פעולה: חיסור מבטל חיבור, וחילוק מבטל כפל.',
  ],
  alt: [
    '"איזה מספר ועוד $5$ נותן $12$?" אפשר לחשוב אחורה: $12 - 5 = 7$. פעולה על שני האגפים עושה את אותו הדבר, בדרך שמתאימה גם למשוואות ארוכות.',
    'בכיתה אומרים "מעבירים אגף ומחליפים סימן": $x + 5 = 12$ הופך ל־$x = 12 - 5$. זה קיצור של "מחסירים $5$ משני האגפים".',
  ],
  discover: [
    { kind: 'say', mood: 'happy', fig: scale(1, 5, 0, 12), text: 'בכף אחת קופסה ו־$5$ משקולות, ובשנייה $12$ משקולות, והמאזניים מאוזנים. אם הקופסה שוקלת $x$, אפשר לכתוב משוואה:', display: 'x + 5 = 12' },
    { kind: 'predict', fig: scale(1, 5, 0, 12), text: 'כמה שוקלת הקופסה?', choices: ['$7$', '$17$', '$12$'], answer: 0,
      why: '$7 + 5 = 12$: עם $7$ שתי הכפות שוקלות $12$. המספר שמאזן את המשוואה נקרא הפתרון שלה.',
      wrongWhy: { 1: 'עם $17$ הכף השמאלית שוקלת $17 + 5 = 22$, יותר מ־$12$.', 2: '$12$ הוא כל המשקל של הכף הימנית. בשמאלית יש גם $5$ משקולות, ולכן הקופסה קלה יותר.' } },
    { kind: 'predict', fig: scale(1, 5, 0, 12), text: 'מה יקרה אם נוריד $5$ משקולות רק מהכף השמאלית?', choices: ['הכף הימנית תרד', 'המאזניים יישארו מאוזנים', 'הכף השמאלית תרד'], answer: 0,
      why: 'בשמאלית נשארת רק הקופסה, $7$, ובימנית עדיין $12$. הכבדה יורדת. כדי לשמור על איזון, מורידים $5$ גם מהימנית.',
      wrongWhy: { 1: 'הורדנו משקל רק מצד אחד, ולכן הצדדים כבר לא שווים: $7$ מול $12$.', 2: 'השמאלית נעשתה קלה יותר, ולכן היא עולה, והימנית יורדת.' } },
    { kind: 'explore', text: 'עכשיו אתם: הקישו על המשקולות של כף, ואחת מהן יורדת. הורידו עד שהקופסה לבד, והמאזניים מאוזנים.', manip: balance(1, 5, 0, 12), answer: 7,
      hint: 'מה שמורידים מכף אחת, מורידים גם מהשנייה.', success: 'הקופסה לבד מול $7$ משקולות: $x = 7$. הורדתם $5$ מכל כף, והמאזניים נשארו מאוזנים.' },
    { kind: 'rule', fig: scale(1, 0, 0, 7), text: 'מה שעושים לאגף אחד של משוואה, עושים גם לאגף השני.', display: '\\begin{aligned} x + 5 - 5 &= 12 - 5 \\\\ x &= 7 \\end{aligned}',
      why: 'כך המשוואה נשארת מאוזנת, וגם הפתרון לא משתנה. ממשיכים עד שהנעלם לבד באגף אחד.' },
    { kind: 'say', fig: { type: 'numline', from: 0, to: 14, jumps: [{ from: 12, to: 7, label: '−5' }] }, text: 'בכיתה אומרים לפעמים "מעבירים אגף ומחליפים סימן". זה בדיוק מה שעשינו: הורדנו $5$ משני האגפים, ולכן ה־$5$ נעלם משמאל והופיע מימין עם מינוס. ובמחברת כותבים את הפעולה בסוף השורה, אחרי קו: $x + 5 = 12 \\;/{-5}$, ובשורה הבאה $x = 7$.', display: '\\begin{aligned} x + 5 &= 12 \\qquad /{-5} \\\\ x &= 12 - 5 \\\\ x &= 7 \\end{aligned}' },
    { kind: 'predict', fig: machine('?', '4x - 2', 10), text: 'איזה מספר פותר את המשוואה? בדקו בהצבה.', display: '4x - 2 = 10', choices: ['$2$', '$3$', '$12$'], answer: 1,
      why: 'מציבים $3$: $4 \\cdot 3 - 2 = 12 - 2 = 10$. שני האגפים שווים, ולכן $3$ הוא פתרון.',
      wrongWhy: { 0: 'כש־$x = 2$: $4 \\cdot 2 - 2 = 6$, ולא $10$.', 2: 'כש־$x = 12$: $4 \\cdot 12 - 2 = 46$, ולא $10$.' } },
    { kind: 'rule', fig: machine(3, '4x - 2', 10), text: 'בדיקה: מציבים את המספר במשוואה. אם שני האגפים שווים, הוא פתרון.', display: 'x = 3:\\quad 4 \\cdot 3 - 2 = 10',
      why: 'פתרון הוא מספר שהופך את המשוואה לשוויון נכון. אפשר לבדוק עוד לפני שיודעים לפתור, ובסוף כל פתרון בודקים כך.' },
    { kind: 'predict', fig: machine('?', '3x', 21), text: 'ומשוואה עם כפל: מה $x$?', display: '3x = 21', choices: ['$7$', '$18$', '$63$'], answer: 0,
      why: 'כפל מבטלים בחילוק: מחלקים את שני האגפים ב־$3$, ו־$x = 7$. בדיקה: $3 \\cdot 7 = 21$.',
      wrongWhy: { 1: '$18$ הוא $21 - 3$. אבל $3x$ הוא $3$ כפול $x$, ו־$3 \\cdot 18 = 54$.', 2: '$63$ הוא $21 \\cdot 3$. כפל מבטלים בחילוק, ו־$3 \\cdot 63 = 189$.' } },
    { kind: 'rule', fig: { type: 'numline', from: 0, to: 21, jumps: [{ from: 0, to: 7, label: 'x' }, { from: 7, to: 14, label: 'x' }, { from: 14, to: 21, label: 'x' }] }, text: 'פעולה הפוכה מבטלת: חיסור מבטל חיבור, חילוק מבטל כפל, וכפל מבטל חילוק.', display: '\\begin{aligned} 3x = 21 &\\;\\Rightarrow\\; x = 7 \\\\ x : 4 = 3 &\\;\\Rightarrow\\; x = 12 \\end{aligned}',
      why: 'ב־$3x = 21$ מחלקים את שני האגפים ב־$3$: $x = 21 : 3 = 7$. ב־$x : 4 = 3$ כופלים אותם ב־$4$: $x = 3 \\cdot 4 = 12$, ובדיקה: $12 : 4 = 3$.' },
  ],
  examples: [
    { problem: 'פתרו את המשוואה.', display: 'x - 9 = -4', answer: 5, check: '-4 + 9', fig: machine('?', 'x - 9', -4),
      steps: [
        { action: 'מוסיפים $9$ לשני האגפים.', mark: '+9', why: 'חיסור של $9$ מתבטל בחיבור של $9$. מה שעושים לאגף אחד, עושים גם לשני.', result: 'x - 9 + 9 = -4 + 9', eq: 'x - 9 + 9 = -4 + 9' },
        { action: 'מחשבים בכל אגף.', why: '$-9 + 9 = 0$, ולכן באגף שמאל נשאר $x$.', result: 'x = 5', eq: 'x = 5' },
        { action: 'בודקים: מציבים $5$ במשוואה.', why: 'אם שני האגפים שווים, הפתרון נכון.', result: '5 - 9 = -4', calc: { expr: '5 - 9', value: -4 }, fig: machine(5, 'x - 9', -4) },
      ] },
    { problem: 'השלימו את המספר החסר כך ש־$x = 4$ יהיה הפתרון של המשוואה.', display: '2x - \\square = -4', answer: 12, check: '2*4 - (-4)', fig: machine(4, '2x - □', -4),
      steps: [
        { action: 'מציבים $x = 4$ ומחשבים את הכפל.', why: 'הפתרון מאזן את המשוואה, ולכן אחרי ההצבה צריך לצאת שוויון נכון.', result: '8 - \\square = -4', calc: { expr: '2*4', value: 8 } },
        { action: 'שואלים: כמה מורידים מ־$8$ כדי להגיע ל־$-4$?', why: 'מ־$8$ עד $0$ יורדים $8$, ועד $-4$ עוד $4$.', result: '\\square = 8 - (-4) = 12', value: '8 - (-4)', fig: { type: 'numline', from: -6, to: 10, marks: [{ x: 8, label: '8' }, { x: -4, label: '\u22124' }], jumps: [{ from: 8, to: -4, label: '\u221212' }] } },
        { action: 'בודקים.', why: 'מציבים $x = 4$ ואת $12$ במקום הריבוע.', result: '2 \\cdot 4 - 12 = -4', calc: { expr: '2*4 - 12', value: -4 } },
      ] },
    { problem: 'פתרו את המשוואה.', display: '\\frac{x}{5} = -2', answer: -10, check: '-2*5', fig: machine('?', '\\frac{x}{5}', -2),
      steps: [
        { action: 'כופלים את שני האגפים ב־$5$.', mark: '\\cdot 5', why: '$x$ חולק ב־$5$, וחילוק מבטלים בכפל.', result: '\\dfrac{x}{5} \\cdot 5 = -2 \\cdot 5', eq: 'x/5*5 = -2*5' },
        { action: 'מחשבים.', why: 'שלילי כפול חיובי הוא שלילי.', result: 'x = -10', eq: 'x = -10', fig: { type: 'numline', from: -11, to: 1, marks: [{ x: -10, label: '\u221210' }], jumps: [0, 1, 2, 3, 4].map((i) => ({ from: -2 * i, to: -2 * i - 2, label: '\u22122' })) } },
        { action: 'בודקים.', why: 'מציבים $-10$ במשוואה.', result: '\\dfrac{-10}{5} = -2', calc: { expr: '-10/5', value: -2 } },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '-5x = 30', fig: machine('?', '-5x', 30),
      steps: [
        { prompt: 'מה עושים לשני האגפים?', choices: [
          { text: 'מחלקים ב־$-5$', ok: true, feedback: 'נכון: $-5x$ הוא $-5$ כפול $x$. כפל מבטלים בחילוק, במקדם כולו, עם הסימן.' },
          { text: 'מחלקים ב־$5$', ok: false, feedback: 'אז נשאר $-x = 6$, ועוד צריך להיפטר מהמינוס. מחלקים ב־$-5$, במקדם כולו.' },
          { text: 'מוסיפים $5$', ok: false, feedback: '$-5x$ הוא כפל, לא חיסור. כפל מבטלים בחילוק.' },
        ], hints: ['איזו פעולה יש בין $-5$ ל־$x$?', 'זה כפל, והמקדם הוא $-5$. מחלקים את שני האגפים ב־$-5$.'], done: '$x = 30 : (-5)$' },
      ],
      final: { prompt: 'מה $x$?', answer: -6, check: '30 / (-5)', hints: ['חילוק של חיובי בשלילי נותן שלילי.', '$30 : 5 = 6$, והסימן שלילי.'] } },
    { problem: 'ועוד אחת.', display: 'x + 8 = 3', fig: machine('?', 'x + 8', 3),
      steps: [
        { prompt: 'איך משאירים את $x$ לבד?', choices: [
          { text: 'מחסירים $8$ משני האגפים', ok: true, feedback: 'נכון: $x + 8 - 8 = 3 - 8$.' },
          { text: 'מוסיפים $8$ לשני האגפים', ok: false, feedback: 'אז באגף שמאל יהיה $x + 16$. חיבור מבטלים בחיסור.' },
          { text: 'מחסירים $8$ רק מאגף שמאל', ok: false, feedback: 'אז המשוואה כבר לא מאוזנת. מחסירים משני האגפים.' },
        ], hints: ['מה מבטל את ה"ועוד $8$"?', 'חיסור של $8$, משני האגפים.'], done: '$x = 3 - 8$' },
      ],
      final: { prompt: 'מה $x$?', answer: -5, check: '3 - 8', hints: ['מ־$3$ יורדים $8$, אל מתחת לאפס.', 'מ־$3$ עד $0$ שלושה צעדים, ועוד חמישה.'] } },
  ],
  diag: oneStepModel,
  transfer: thinkModel,
  misconceptions: [
    { id: 'move-no-flip', title: 'מספר עבר לאגף השני בלי פעולה הפוכה',
      cause: 'הכלל "מעבירים אגף" נזכר בלי החלק השני שלו, "ומחליפים סימן", ולכן המספר עובר כמו שהוא.',
      explain: ['נראה שהמספר עבר לאגף השני בלי להתהפך.', 'ב־$x + 4 = 10$ מחסירים $4$ משני האגפים: $x = 10 - 4 = 6$. וכש־$x$ מחולק ב־$4$, כופלים ב־$4$.'],
      remedy: [
        { kind: 'explore', text: 'קופסה ו־$4$ משקולות מול $10$ משקולות. הורידו עד שהקופסה לבד, ושמרו על המאזניים מאוזנים.', manip: balance(1, 4, 0, 10), answer: 6,
          hint: 'כל משקולת שיורדת מכף אחת, יורדת גם מהשנייה.', success: '$x = 6$: הורדתם $4$ משתי הכפות, כלומר $10 - 4$.' },
        { kind: 'predict', text: 'מה הפתרון של $x + 4 = 10$?', choices: ['$6$', '$14$'], answer: 0,
          why: 'בדיקה: $6 + 4 = 10$. ואילו $14 + 4 = 18$, לא $10$.' },
        { kind: 'predict', text: 'ומה הפתרון של $x : 4 = 3$?', choices: ['$12$', '$\\dfrac{3}{4}$'], answer: 0,
          why: 'חילוק מבטלים בכפל: $x = 3 \\cdot 4 = 12$. בדיקה: $12 : 4 = 3$. ואילו $\\frac{3}{4} : 4$ קטן מ־$1$.' },
      ] },
    { id: 'divide-flip', title: 'החילוק נעשה הפוך',
      cause: 'נדמה שחילוק חייב לתת מספר שלם, ולכן מחלקים את הגדול בקטן. אבל הפתרון יכול להיות שבר.',
      explain: ['נראה שחילקתם את המקדם במספר שבאגף השני.', 'ב־$12x = 3$ מחלקים את שני האגפים ב־$12$: $x = \\frac{3}{12} = \\frac{1}{4}$.'],
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $12x = 3$?', choices: ['$\\dfrac{1}{4}$', '$4$'], answer: 0,
          why: 'בדיקה: $12 \\cdot \\frac{1}{4} = 3$. ואילו $12 \\cdot 4 = 48$, לא $3$.' },
        { kind: 'predict', text: 'ושל $8x = 2$?', choices: ['$\\dfrac{1}{4}$', '$4$', '$-6$'], answer: 0,
          why: 'מחלקים ב־$8$: $x = \\frac{2}{8} = \\frac{1}{4}$. בדיקה: $8 \\cdot \\frac{1}{4} = 2$.',
          wrongWhy: { 1: '$8 \\cdot 4 = 32$, לא $2$.', 2: '$-6$ הוא $2 - 8$. אבל $8x$ הוא כפל.' } },
        { kind: 'rule', text: 'מחלקים את המספר שבאגף השני במקדם, גם כשהוא קטן מהמקדם.', display: '12x = 3 \\;\\Rightarrow\\; x = \\frac{3}{12} = \\frac{1}{4}',
          why: 'המקדם הוא מה שכופל את $x$, ולכן בו מחלקים. כשהמספר קטן מהמקדם, הפתרון קטן מ־$1$.' },
      ] },
    { id: 'sign', title: 'הפתרון יצא עם הסימן ההפוך',
      cause: 'המינוס של המקדם נשכח בחילוק: את $-3x = 12$ חילקו ב־$3$ במקום ב־$-3$.',
      explain: ['נראה שהסימן של הפתרון התהפך.', 'ב־$-3x = 12$ מחלקים ב־$-3$, במקדם כולו: $x = 12 : (-3) = -4$. בדיקה: $-3 \\cdot (-4) = 12$.'],
      prereq: 'signed:3',
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $-3x = 12$?', choices: ['$-4$', '$4$'], answer: 0,
          why: 'בדיקה: $-3 \\cdot (-4) = 12$. ואילו $-3 \\cdot 4 = -12$.' },
        { kind: 'rule', text: 'מחלקים במקדם עם הסימן שלו.', display: '-3x = 12 \\;\\Rightarrow\\; x = 12 : (-3) = -4',
          why: 'המקדם של $x$ ב־$-3x$ הוא $-3$, לא $3$. חוקי הסימנים של חילוק קובעים את הסימן של הפתרון.' },
      ] },
    { id: 'sub-coef', title: 'המקדם הוחסר במקום לחלק בו',
      cause: '$3x$ נקרא כמו $3 + x$, ולכן מורידים $3$. אבל $3x$ הוא $3$ כפול $x$.',
      explain: ['נראה שהמקדם הוחסר.', '$3x = 12$ פירושו $3 \\cdot x = 12$. כפל מבטלים בחילוק: $x = 12 : 3 = 4$, ולא $12 - 3 = 9$.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'explore', text: 'שלוש קופסאות ו־$3$ משקולות מול $12$ משקולות. הביאו לקופסה אחת לבד.', manip: balance(3, 3, 0, 12), answer: 3,
          hint: 'אם מורידים קופסה רק מכף אחת, המאזניים נוטים. שלוש קופסאות מחלקים לשלוש.', success: '$x = 3$: שלוש קופסאות שוקלות $9$, ולכן קופסה אחת שוקלת $9 : 3 = 3$, ולא $9 - 3 = 6$.' },
        { kind: 'predict', text: 'מה הפתרון של $3x = 12$?', choices: ['$4$', '$9$'], answer: 0,
          why: 'בדיקה: $3 \\cdot 4 = 12$. ואילו $3 \\cdot 9 = 27$.' },
      ] },
  ],
};

// ================================================================ stair 2: two steps (משוואה בשני צעדים)

type Two = { k: number; a: number; b: number; c: number; x: number }; // k 0: ax + b = c, 1: c = ax + b, 2: b − |a|x = c
const twoShow = (p: Two) => (p.k === 0 ? `${linTex(p.a, p.b)} = ${T(p.c)}` : p.k === 1 ? `${T(p.c)} = ${linTex(p.a, p.b)}` : `${sumTex([[p.b, ''], [p.a, 'x']])} = ${T(p.c)}`);
const twoBugs: Record<string, (p: Two) => number | null> = {
  // b moved to the other side as it is: 3x + 4 = 19 → 3x = 23
  'move-no-flip': (p) => (p.c + p.b) / p.a,
  // only some terms divided: 2x + 4 = 10 → x + 4 = 5 (when the division comes out whole, as students choose it)
  'divide-part': (p) => (p.k !== 2 && abs(p.a) !== 1 && Number.isInteger(p.c / p.a) ? p.c / p.a - p.b : null),
  // on the last line ax = c − b: the coefficient's minus lost (also the hidden −1 of 7 − x = 3) or the result's
  // (3x + 8 = 2 solved as 3x = 6); the division the other way round on a half (4x + 3 = 5: 4x = 2 made 2); 3x read as
  // 3 + x (3x = 15 → 12)
  ...lastStep((p: Two) => [p.a, p.c - p.b], ['sign', 'divide-flip', 'sub-coef']),
};
const twoDraw = (rnd: () => number): Two => {
  const k = rint(rnd, 0, 2); const b = rnz(rnd, -15, 15);
  let a = k === 2 ? (rnd() < 0.25 ? -1 : -rint(rnd, 2, 9)) : rint(rnd, 2, 9) * (rnd() < 0.3 ? -1 : 1);
  let x: number;
  // halves only, 15% of the time
  if (rnd() < 0.15 && a !== -1) { a = (a < 0 ? -1 : 1) * rpick(rnd, [2, 4]); x = rpick(rnd, [1, 3, -1, 5]) / 2; } else x = rnz(rnd, -10, 10);
  return { k, a, b, x, c: a * x + b };
};
const twoStepModel: DiagModel<Two> = {
  params: (rnd) => fair(() => twoDraw(rnd), (p) => p.x, twoBugs),
  text: () => 'פתרו את המשוואה.',
  display: twoShow,
  answer: (p) => p.x,
  bugs: twoBugs,
  // the exercise generator's own board lines (content/eq.js): the same equation shapes, words and marks
  solution: (p) => twoStepSolution(p),
  hint: (p) => (p.k === 2 ? `קודם מורידים את $${T(p.b)}$ משני האגפים. ו־$${linTex(p.a, 0)}$ הוא $${T(p.a)}$ כפול $x$.` : 'קודם מבטלים את המספר שנוסף ל־$x$, בשני האגפים. אחר כך מחלקים במקדם.'),
};

type Rent = { f: number; r: number; h: number };
const rentBugs: Record<string, (p: Rent) => number | null> = { 'move-no-flip': (p) => (p.f + p.r * p.h + p.f) / p.r };
const rentModel: DiagModel<Rent> = {
  // the Ministry's sample exam: a scooter costs 4x + 10 for x hours
  params: (rnd) => fair(() => ({ f: rint(rnd, 5, 20), r: rint(rnd, 2, 9), h: rint(rnd, 1, 9) }), (p) => p.h, rentBugs),
  text: (p) => `השכרת קורקינט עולה $${p.f}$ ₪ דמי פתיחה ועוד $${p.r}$ ₪ לכל שעה. נועם שילם $${p.f + p.r * p.h}$ ₪. כמה שעות הוא נסע?`,
  answer: (p) => p.h,
  bugs: rentBugs,
  solution: (p) => [line('נסמן ב־$x$ את מספר השעות', `${p.r}x + ${p.f} = ${p.f + p.r * p.h}`, `-${p.f}`), line(`מחסירים $${p.f}$ משני האגפים`, `${p.r}x = ${p.r * p.h}`, divOp(p.r)), line(`מחלקים ב־$${p.r}$`, `x = ${p.h}`), `בדיקה: $${p.r} \\cdot ${p.h} + ${p.f} = ${p.f + p.r * p.h}$`],
  hint: (p) => `המחיר של $x$ שעות הוא $${p.r}x + ${p.f}$. כתבו משוואה, ומבטלים קודם את דמי הפתיחה.`,
  unit: 'שעות',
};

const stair2: StairContent = {
  skill: 'eq:2', topic: 'eq', level: 2, title: 'משוואה בשני צעדים',
  objectives: [
    'לפתור $ax + b = c$: קודם מבטלים את המספר שנוסף, אחר כך מחלקים במקדם.',
    'לפתור גם כשהמקדם או המספרים שליליים, וגם כש־$x$ מחולק.',
    'לבדוק את הפתרון בהצבה.',
  ],
  idea: 'מבטלים בסדר הפוך: קודם את מה שנוסף ל־$x$, אחר כך את מה שכפל אותו.',
  why: [
    'ב־$3x + 2$ קודם כפלו את $x$ ב־$3$, ואחר כך הוסיפו $2$. כדי לחזור ל־$x$ מבטלים קודם את מה שנעשה אחרון.',
    'במאזניים אין משקולות שליליות. כשיש מספרים שליליים, ממשיכים באותו כלל, אבל בלי המאזניים.',
  ],
  alt: [
    '"חשבתי על מספר, כפלתי ב־$3$, הוספתי $4$ וקיבלתי $19$." הולכים אחורה: $19 - 4 = 15$, ו־$15 : 3 = 5$.',
    'אפשר גם לחלק קודם, אבל אז מחלקים כל איבר: $2x + 4 = 10$ הופך ל־$x + 2 = 5$, ולא ל־$x + 4 = 5$.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', fig: scale(3, 2, 0, 11), text: 'שלוש קופסאות ו־$2$ משקולות מול $11$ משקולות, והמאזניים מאוזנים. כל קופסה שוקלת $x$, ולכן:', display: '3x + 2 = 11' },
    { kind: 'predict', fig: scale(3, 2, 0, 11), text: 'מה כדאי לעשות קודם?', choices: ['להוריד $2$ משקולות מכל כף', 'לחלק כל כף לשלוש', 'להוריד קופסה מכל כף'], answer: 0,
      why: 'כשהמשקולות הבודדות יורדות, נשארות רק קופסאות מול משקולות: $3x = 9$. אחר כך מחלקים לשלוש.',
      wrongWhy: { 1: 'את $2$ המשקולות שליד הקופסאות אי אפשר לחלק לשלוש קבוצות שוות. קודם מורידים אותן.', 2: 'בכף הימנית אין קופסה להוריד.' } },
    { kind: 'explore', text: 'עכשיו אתם: הביאו את המאזניים לקופסה אחת לבד.', manip: balance(3, 2, 0, 11), answer: 3,
      hint: 'קודם מורידים משקולות משתי הכפות, אחר כך מחלקים.', success: '$x = 3$: הורדתם $2$ מכל כף, ואז חילקתם לשלוש. בדיקה: $3 \\cdot 3 + 2 = 11$.' },
    { kind: 'rule', fig: scale(3, 0, 0, 9), text: 'מבטלים בסדר הפוך: קודם את החיבור, אחר כך את הכפל.', display: '\\begin{aligned} 3x + 2 &= 11 \\qquad /{-2} \\\\ 3x &= 9 \\qquad /{:}3 \\\\ x &= 3 \\end{aligned}',
      why: 'ב־$3x + 2$ קודם כפלו ואחר כך הוסיפו. חוזרים ל־$x$ מהסוף להתחלה, כמו שחולצים קודם נעליים ורק אחר כך גרביים.' },
    { kind: 'predict', fig: scale(2, 4, 0, 10), text: 'ואם מחלקים קודם? את $2x + 4 = 10$ חילקו ב־$2$. מה יוצא?', choices: ['$x + 2 = 5$', '$x + 4 = 5$'], answer: 0,
      why: 'מחלקים כל איבר: $2x : 2 = x$, $4 : 2 = 2$, $10 : 2 = 5$. ואז $x = 3$, ובדיקה: $2 \\cdot 3 + 4 = 10$.',
      wrongWhy: { 1: 'ה־$4$ לא חולק. מ־$x + 4 = 5$ יוצא $x = 1$, ובדיקה: $2 \\cdot 1 + 4 = 6$, לא $10$.' } },
    { kind: 'predict', fig: machine('?', '4x + 10', 22), text: 'השכרת קורקינט ל־$x$ שעות עולה $4x + 10$ ₪. נועם שילם $22$ ₪. כמה שעות הוא נסע?', choices: ['$3$', '$8$', '$12$'], answer: 0,
      why: '$4x + 10 = 22$. מחסירים $10$: $4x = 12$, ומחלקים ב־$4$: $x = 3$. בדיקה: $4 \\cdot 3 + 10 = 22$.',
      wrongWhy: { 1: '$8$ יוצא כשה־$10$ עובר לאגף השני בלי להתהפך: $4x = 32$. בדיקה: $4 \\cdot 8 + 10 = 42$.', 2: '$12$ הוא $4x$, המחיר של השעות בלבד. צריך עוד לחלק ב־$4$.' } },
    { kind: 'say', fig: scale(3, 2, 0, 11), text: 'במאזניים אין משקולות שליליות. עם מספרים שליליים פותרים באותו כלל בדיוק, רק בלי המאזניים.' },
    { kind: 'predict', fig: machine('?', '20 - 3x', 8), text: 'מה $x$?', display: '20 - 3x = 8', choices: ['$4$', '$-4$', '$-\\dfrac{28}{3}$'], answer: 0,
      why: 'מחסירים $20$: $-3x = -12$. מחלקים ב־$-3$: $x = 4$. בדיקה: $20 - 3 \\cdot 4 = 8$.',
      wrongWhy: { 1: 'המינוס של $-3x$ נשכח בחילוק. בדיקה: $20 - 3 \\cdot (-4) = 32$.', 2: 'ה־$20$ עבר לאגף השני בלי להתהפך: $-3x = 28$. מחסירים $20$ משני האגפים: $8 - 20 = -12$.' } },
    { kind: 'predict', fig: machine('?', '7 - x', 3), text: 'ומה $x$ כאן?', display: '7 - x = 3', choices: ['$4$', '$-4$', '$-10$'], answer: 0,
      why: 'מחסירים $7$: $-x = -4$, כלומר $x = 4$. בדיקה: $7 - 4 = 3$.',
      wrongWhy: { 1: '$-x$ הוא $-1 \\cdot x$. מ־$-x = -4$ יוצא $x = 4$. בדיקה: $7 - (-4) = 11$.', 2: 'ה־$7$ עבר לאגף השני בלי להתהפך: $-x = 10$, ולכן $x = -10$. בדיקה: $7 - (-10) = 17$.' } },
    { kind: 'rule', fig: { type: 'numline', from: 0, to: 8, jumps: [{ from: 7, to: 3, label: '−x' }] }, text: 'גם עם מספרים שליליים: מבטלים את המספר, מחלקים במקדם עם הסימן שלו, ובודקים.', display: '\\begin{aligned} 7 - x &= 3 \\qquad /{-7} \\\\ -x &= -4 \\qquad /{:}(-1) \\\\ x &= 4 \\end{aligned}',
      why: '$-x$ הוא $-1 \\cdot x$, ולכן המקדם שלו $-1$. מחלקים ב־$-1$, והסימן מתהפך.' },
  ],
  examples: [
    { problem: 'פתרו את המשוואה.', display: '5x - 3 = 22', answer: 5, check: '(22 + 3) / 5', fig: machine('?', '5x - 3', 22),
      steps: [
        { action: 'מוסיפים $3$ לשני האגפים.', mark: '+3', why: 'קודם מבטלים את מה שנעשה אחרון: החיסור של $3$.', result: '5x - 3 + 3 = 22 + 3', eq: '5*x - 3 + 3 = 22 + 3' },
        { action: 'מחשבים.', why: '$-3 + 3 = 0$.', result: '5x = 25', eq: '5*x = 25' },
        { action: 'מחלקים את שני האגפים ב־$5$.', mark: ':5', why: 'עכשיו מבטלים את הכפל.', result: 'x = 5', eq: 'x = 5' },
        { action: 'בודקים.', why: 'מציבים $5$ במשוואה המקורית.', result: '5 \\cdot 5 - 3 = 22', calc: { expr: '5*5 - 3', value: 22 }, fig: machine(5, '5x - 3', 22) },
      ] },
    { problem: 'פתרו את המשוואה.', display: '\\frac{x}{3} + 4 = 9', answer: 15, check: '(9 - 4) * 3', fig: machine('?', '\\frac{x}{3} + 4', 9),
      steps: [
        { action: 'מחסירים $4$ משני האגפים.', mark: '-4', why: 'ה־$4$ נוסף אחרון, ולכן מבטלים אותו קודם.', result: '\\dfrac{x}{3} = 5', eq: 'x/3 = 5' },
        { action: 'כופלים את שני האגפים ב־$3$.', mark: '\\cdot 3', why: '$x$ חולק ב־$3$, וחילוק מבטלים בכפל.', result: 'x = 15', eq: 'x = 15' },
        { action: 'בודקים.', why: 'מציבים $15$ במשוואה המקורית.', result: '15 : 3 + 4 = 9', calc: { expr: '15/3 + 4', value: 9 }, fig: machine(15, '\\frac{x}{3} + 4', 9) },
      ] },
    { problem: 'פתרו את המשוואה.', display: '7 - 2x = 15', answer: -4, check: '(15 - 7) / (-2)', fig: machine('?', '7 - 2x', 15),
      steps: [
        { action: 'מחסירים $7$ משני האגפים.', mark: '-7', why: 'ה־$7$ הוא המספר שליד $-2x$.', result: '-2x = 8', eq: '-2*x = 8' },
        { action: 'מחלקים את שני האגפים ב־$-2$.', mark: ':(-2)', why: 'המקדם של $x$ הוא $-2$, עם המינוס.', result: 'x = -4', eq: 'x = -4' },
        { action: 'בודקים.', why: '$-2 \\cdot (-4) = 8$, ו־$7 + 8 = 15$.', result: '7 - 2 \\cdot (-4) = 15', calc: { expr: '7 - 2*(-4)', value: 15 }, fig: machine(-4, '7 - 2x', 15) },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '3x + 8 = 2', fig: machine('?', '3x + 8', 2),
      steps: [
        { prompt: 'מה הצעד הראשון?', choices: [
          { text: 'מחסירים $8$ משני האגפים', ok: true, feedback: 'נכון: $3x = 2 - 8 = -6$.' },
          { text: 'מוסיפים $8$ לשני האגפים', ok: false, feedback: 'חיבור של $8$ מבטלים בחיסור של $8$, לא בעוד חיבור.' },
          { text: 'מחלקים ב־$3$ רק את $3x$', ok: false, feedback: 'כשמחלקים, מחלקים את שני האגפים, כל איבר. וקל יותר קודם להוריד את ה־$8$.' },
        ], hints: ['מה נעשה ל־$3x$ אחרון?', 'הוסיפו לו $8$. מבטלים את זה קודם, בשני האגפים.'], done: '$3x = -6$' },
        { prompt: 'ועכשיו?', choices: [
          { text: 'מחלקים את שני האגפים ב־$3$', ok: true, feedback: 'נכון: $3x$ הוא $3$ כפול $x$, וכפל מבטלים בחילוק.' },
          { text: 'מחסירים $3$ משני האגפים', ok: false, feedback: '$3x$ הוא כפל, $3 \\cdot x$, לא $3 + x$. כפל מבטלים בחילוק.' },
          { text: 'מחלקים את שני האגפים ב־$-6$', ok: false, feedback: 'מחלקים במקדם של $x$, שהוא $3$, לא במספר שבאגף השני.' },
        ], hints: ['איזו פעולה יש בין $3$ ל־$x$?', 'כפל. מחלקים את שני האגפים ב־$3$.'], done: '$x = -6 : 3$' },
      ],
      final: { prompt: 'מה $x$?', answer: -2, check: '(2 - 8) / 3', hints: ['שלילי חלקי חיובי נותן שלילי.', '$6 : 3 = 2$, והסימן שלילי.'] } },
    { problem: 'ועכשיו ה־$x$ באגף ימין.', display: '17 = 4x + 5', fig: scale(0, 17, 4, 5),
      steps: [
        { prompt: 'איך מתחילים?', choices: [
          { text: 'מחסירים $5$ משני האגפים', ok: true, feedback: 'נכון: $12 = 4x$. לא משנה באיזה אגף נמצא $x$.' },
          { text: 'מוסיפים $5$ לשני האגפים', ok: false, feedback: 'אז באגף ימין יהיה $4x + 10$. את ה־$5$ מבטלים בחיסור.' },
          { text: 'מחלקים את $17$ ב־$4$', ok: false, feedback: 'כשמחלקים, מחלקים כל איבר בשני האגפים, גם את $5$. קל יותר קודם להוריד את $5$.' },
        ], hints: ['מה נוסף ל־$4x$?', '$5$. מחסירים אותו משני האגפים.'], done: '$12 = 4x$', fig: scale(0, 12, 4, 0) },
      ],
      final: { prompt: 'מה $x$?', answer: 3, check: '(17 - 5) / 4', hints: ['מחלקים את שני האגפים ב־$4$.', '$12 : 4$.'] } },
  ],
  diag: twoStepModel,
  transfer: rentModel,
  misconceptions: [
    { id: 'move-no-flip', title: 'מספר עבר לאגף השני בלי פעולה הפוכה',
      cause: 'בשני צעדים קל להעביר את המספר כמו שהוא. אבל מה שעושים לאגף אחד, עושים גם לשני.',
      explain: ['נראה שהמספר עבר לאגף השני בלי להתהפך.', 'ב־$2x + 6 = 14$ מחסירים $6$ משני האגפים: $2x = 8$, ולא $2x = 20$.'],
      remedy: [
        { kind: 'explore', text: 'שתי קופסאות ו־$6$ משקולות מול $12$ משקולות. הביאו לקופסה אחת לבד.', manip: balance(2, 6, 0, 12), answer: 3,
          hint: 'כל משקולת שיורדת מכף אחת, יורדת גם מהשנייה. אחר כך מחלקים.', success: '$x = 3$: הורדתם $6$ מכל כף, $2x = 6$, וחילקתם לשתיים. בדיקה: $2 \\cdot 3 + 6 = 12$.' },
        { kind: 'predict', text: 'מה הפתרון של $2x + 6 = 14$?', choices: ['$4$', '$10$'], answer: 0,
          why: 'מחסירים $6$: $2x = 8$, ו־$x = 4$. בדיקה: $2 \\cdot 4 + 6 = 14$. ואילו $2 \\cdot 10 + 6 = 26$.' },
      ] },
    { id: 'divide-part', title: 'רק חלק מהאיברים חולק במקדם',
      cause: 'רואים $2x$ ורוצים להיפטר מה־$2$, ומחלקים רק את מה שנראה קשור אליו.',
      explain: ['נראה שחילקתם במקדם רק חלק מהאיברים.', 'כשמחלקים משוואה, מחלקים כל איבר: $2x + 4 = 10$ הופך ל־$x + 2 = 5$. או שמורידים קודם את $4$: $2x = 6$.'],
      remedy: [
        { kind: 'explore', text: 'שתי קופסאות ו־$4$ משקולות מול $10$: זו המשוואה $2x + 4 = 10$. חלקו את שתי הכפות לשתיים, וראו מה נשאר בכל כף.', manip: balance(2, 4, 0, 10), answer: 3,
          hint: 'כשמחלקים לשתיים, גם המשקולות שליד הקופסאות מתחלקות.', success: '$x = 3$. כשמחלקים את $2x + 4 = 10$ לשתיים, בכל כף נשארים קופסה ו־$2$ משקולות מול $5$: גם ה־$4$ התחלק.' },
        { kind: 'predict', text: 'את $2x + 4 = 10$ חילקו ב־$2$. מה יוצא?', choices: ['$x + 2 = 5$', '$x + 4 = 5$'], answer: 0,
          why: 'כל איבר מתחלק: $4 : 2 = 2$. מ־$x + 4 = 5$ היה יוצא $x = 1$, ובדיקה: $2 \\cdot 1 + 4 = 6$, לא $10$.' },
      ] },
    { id: 'sign', title: 'הפתרון יצא עם הסימן ההפוך',
      cause: 'בדרך הלך לאיבוד מינוס: המינוס שלפני $x$ (ב־$10 - 4x$ המקדם של $x$ הוא $-4$, וב־$7 - x$ הוא $-1$), או המינוס של המספר שבאגף השני ($2 - 8$ הוא $-6$, לא $6$).',
      explain: ['נראה שהסימן של הפתרון התהפך.', 'ב־$10 - 4x = 2$: מחסירים $10$, $-4x = -8$, ומחלקים ב־$-4$: $x = 2$. וב־$3x + 8 = 2$: $3x = 2 - 8 = -6$, ולכן $x = -2$.'],
      prereq: 'signed:3',
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $10 - 4x = 2$?', choices: ['$2$', '$-2$'], answer: 0,
          why: 'בדיקה: $10 - 4 \\cdot 2 = 2$. ואילו $10 - 4 \\cdot (-2) = 18$.' },
        { kind: 'predict', text: 'ומה הפתרון של $3x + 8 = 2$?', choices: ['$-2$', '$2$'], answer: 0,
          why: 'מחסירים $8$: $3x = 2 - 8 = -6$, ו־$-6 : 3 = -2$. בדיקה: $3 \\cdot (-2) + 8 = 2$. ואילו $3 \\cdot 2 + 8 = 14$.' },
        { kind: 'rule', text: 'המקדם של $x$ כולל את הסימן שלפניו.', display: '\\begin{aligned} 10 - 4x &= 2 \\qquad /{-10} \\\\ -4x &= -8 \\qquad /{:}(-4) \\\\ x &= 2 \\end{aligned}',
          why: 'שלילי חלקי שלילי הוא חיובי. בדיקה בסוף מראה אם הסימן נכון.' },
      ] },
    { id: 'sub-coef', title: 'המקדם הוחסר במקום לחלק בו',
      cause: 'אחרי הצעד הראשון נשאר $3x = 15$, ו־$3x$ נקרא כמו $3 + x$.',
      explain: ['נראה שבצעד השני המקדם הוחסר.', '$3x = 15$ פירושו $3 \\cdot x = 15$, ולכן מחלקים: $x = 5$, ולא $15 - 3 = 12$.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'predict', text: 'מ־$3x + 4 = 19$ יצא $3x = 15$. מה $x$?', choices: ['$5$', '$12$'], answer: 0,
          why: 'בדיקה: $3 \\cdot 5 + 4 = 19$. ואילו $3 \\cdot 12 + 4 = 40$.' },
        { kind: 'rule', text: '$3x$ הוא כפל, ולכן מחלקים ב־$3$.', display: '3x = 15 \\;\\Rightarrow\\; x = 15 : 3 = 5',
          why: 'מספר צמוד ל־$x$ כופל אותו. כפל מבטלים בחילוק.' },
      ] },
    // stair 1's mistake, on the last line of a two-step equation whose answer is a half (4x + 3 = 5)
    { id: 'divide-flip', title: 'החילוק נעשה הפוך',
      cause: 'בצעד האחרון המספר קטן מהמקדם, למשל $4x = 2$, ונדמה שמחלקים תמיד את הגדול בקטן. אבל הפתרון יכול להיות שבר.',
      explain: ['נראה שחילקתם את המקדם במספר שבאגף השני.', 'ב־$4x + 3 = 5$ מחסירים $3$: $4x = 2$. מחלקים ב־$4$: $x = \\frac{2}{4} = \\frac{1}{2}$, ולא $4 : 2 = 2$.'],
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $4x + 3 = 5$?', choices: ['$\\dfrac{1}{2}$', '$2$'], answer: 0,
          why: '$4x = 2$, ולכן $x = \\frac{2}{4} = \\frac{1}{2}$. בדיקה: $4 \\cdot \\frac{1}{2} + 3 = 5$. ואילו $4 \\cdot 2 + 3 = 11$.' },
        DIVIDE_RULE,
      ] },
  ],
};

// ================================================================ stair 3: the unknown on both sides (נעלם בשני האגפים)

type Both = { a: number; b: number; c: number; d: number; x: number }; // ax + b = cx + d
const bothBugs: Record<string, (p: Both) => number | null> = {
  // the number moved without changing sign
  'move-no-flip': (p) => (p.d + p.b) / (p.a - p.c),
  // the x-term moved without changing sign: 4x + 2 = x + 14 → 5x = 12
  'move-x-no-flip': (p) => (p.d - p.b) / (p.a + p.c),
  // the first two stairs' mistakes on the last line, |a − c|x = …, where the solution leaves the x-terms (content/eq.js
  // bothSolution): 7x − 12 = 6x − 16 ends on x = −4, answered 4; 3x = 12 answered 9. (Its answers are whole: the
  // number is never smaller than the coefficient, so the division the other way round cannot show.)
  ...lastStep((p: Both) => [abs(p.a - p.c), abs(p.a - p.c) * p.x], ['sign', 'sub-coef']),
};
const bothDraw = (rnd: () => number): Both => {
  for (;;) {
    // positive x-coefficients in about two thirds (as on the balance), both negative rarely (the critique)
    const u = rnd(); let a: number; let c: number;
    if (u < 0.65) { a = rint(rnd, 1, 9); c = rint(rnd, 1, 9); } else if (u < 0.88) { a = rint(rnd, 1, 9); c = -rint(rnd, 1, 9); if (rnd() < 0.5) [a, c] = [c, a]; } else { a = -rint(rnd, 1, 9); c = -rint(rnd, 1, 9); }
    if (a === c || a + c === 0) continue;
    const x = rnz(rnd, -10, 10); const b = rnz(rnd, -15, 15); const d = (a - c) * x + b;
    if (abs(d) > 40) continue;
    return { a, b, c, d, x };
  }
};
const bothModel: DiagModel<Both> = {
  params: (rnd) => fair(() => bothDraw(rnd), (p) => p.x, bothBugs),
  text: () => 'פתרו את המשוואה.',
  display: (p) => `${linTex(p.a, p.b)} = ${linTex(p.c, p.d)}`,
  answer: (p) => p.x,
  bugs: bothBugs,
  // the x-terms go where there are more of them (content/eq.js bothSolution): a mark on every line, no zero step,
  // and a "9 = x" turned round
  solution: (p) => {
    const s = bothSolution(p);
    return [line('', `${linTex(p.a, p.b)} = ${linTex(p.c, p.d)}`, s.op), ...s.lines, `בדיקה: באגף שמאל $${at(p.a, p.b, p.x)} = ${p.a * p.x + p.b}$, ובאגף ימין $${at(p.c, p.d, p.x)} = ${p.c * p.x + p.d}$.`];
  },
  hint: () => 'מורידים משני האגפים אותו מספר של $x$־ים, כך שיישאר $x$ רק באגף אחד. אחר כך פותרים כמו קודם.',
};

type Gym = { a: number; b: number; c: number; d: number; m: number }; // A: a a month + b to join; B: c a month + d to join
const gymBugs: Record<string, (p: Gym) => number | null> = {
  'move-no-flip': (p) => (p.d + p.b) / (p.a - p.c),
  'move-x-no-flip': (p) => (p.d - p.b) / (p.a + p.c),
};
const gymModel: DiagModel<Gym> = {
  // two price plans: when do they cost the same? (multiples of 10, joining fees of at least 10)
  params: (rnd) => fair(() => {
    for (;;) {
      const c = 10 * rint(rnd, 4, 12); const a = c + 10 * rint(rnd, 1, 4); const m = rint(rnd, 2, 12); const d = 10 * rint(rnd, 2, 30);
      const b = d - (a - c) * m; if (b >= 10) return { a, b, c, d, m };
    }
  }, (p) => p.m, gymBugs),
  text: (p) => `במכון כושר א׳ משלמים $${p.b}$ ₪ דמי הרשמה ועוד $${p.a}$ ₪ לחודש. במכון ב׳: $${p.d}$ ₪ דמי הרשמה ועוד $${p.c}$ ₪ לחודש. אחרי כמה חודשים התשלום הכולל שווה?`,
  answer: (p) => p.m,
  bugs: gymBugs,
  solution: (p) => [line('נסמן ב־$x$ את מספר החודשים', `${p.a}x + ${p.b} = ${p.c}x + ${p.d}`, `-${p.c}x`), line(`מחסירים $${p.c}x$ משני האגפים`, `${p.a - p.c}x + ${p.b} = ${p.d}`, `-${p.b}`),
    line(`מחסירים $${p.b}$ משני האגפים`, `${p.a - p.c}x = ${p.d - p.b}`, divOp(p.a - p.c)), line(`מחלקים ב־$${p.a - p.c}$`, `x = ${p.m}`), `בדיקה: $${p.a} \\cdot ${p.m} + ${p.b} = ${p.a * p.m + p.b}$, וגם $${p.c} \\cdot ${p.m} + ${p.d} = ${p.c * p.m + p.d}$`],
  hint: (p) => `אחרי $x$ חודשים במכון א׳ משלמים $${p.a}x + ${p.b}$. כמה במכון ב׳? המשוואה אומרת ששניהם שווים.`,
  unit: 'חודשים',
};

const stair3: StairContent = {
  skill: 'eq:3', topic: 'eq', level: 3, title: 'נעלם בשני האגפים',
  objectives: [
    'לפתור $ax + b = cx + d$: מורידים את אותו מספר $x$־ים משני האגפים.',
    'לזהות משוואה שאין לה פתרון, ומשוואה שכל מספר פותר אותה.',
    'לבדוק את הפתרון בשני האגפים.',
  ],
  idea: 'כשיש $x$ בשני האגפים, מורידים משניהם אותו מספר $x$־ים, וחוזרים למשוואה שכבר יודעים לפתור.',
  why: [
    'במאזניים אפשר להוריד קופסה מכל כף, כי כל הקופסאות שוקלות אותו דבר. באותו אופן מחסירים $x$ משני האגפים.',
    'אם ה־$x$־ים נעלמים ונשאר שוויון לא נכון, כמו $3 = 5$, אין פתרון. אם נשאר שוויון נכון, כמו $6 = 6$, כל מספר הוא פתרון.',
  ],
  alt: [
    '$3$ ק״ג ועוד $5$ כדורים מול $1$ ק״ג ועוד $7$ כדורים: מורידים $5$ כדורים ו־$1$ ק״ג משתי הכפות. נשארים $2$ ק״ג מול $2$ כדורים, ולכן כדור שוקל $1$ ק״ג.',
    'אפשר להוריד את ה־$x$־ים מכל אחד מהאגפים. נוח להוריד מהאגף שבו יש פחות $x$־ים, כדי שהמקדם שנשאר יהיה חיובי.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', fig: scale(3, 5, 1, 11), text: 'עכשיו יש קופסאות בשתי הכפות: שלוש קופסאות ו־$5$ משקולות מול קופסה אחת ו־$11$ משקולות.', display: '3x + 5 = x + 11' },
    { kind: 'predict', fig: scale(3, 5, 1, 11), text: 'מה אפשר להוריד משתי הכפות?', choices: ['קופסה אחת מכל כף', 'שלוש קופסאות מכל כף', 'רק את הקופסה הימנית'], answer: 0,
      why: 'בכף הימנית יש קופסה אחת, ולכן מורידים קופסה אחת מכל כף. נשארת המשוואה $2x + 5 = 11$, שכבר יודעים לפתור.',
      wrongWhy: { 1: 'בכף הימנית יש רק קופסה אחת. אי אפשר להוריד ממנה שלוש.', 2: 'אם מורידים רק מצד אחד, המאזניים נוטים.' } },
    { kind: 'explore', text: 'הביאו את המאזניים לקופסה אחת לבד.', manip: balance(3, 5, 1, 11), answer: 3,
      hint: 'קודם קופסה מכל כף, אחר כך משקולות מכל כף, ובסוף חלוקה.', success: '$x = 3$. בדיקה: $3 \\cdot 3 + 5 = 14$, וגם $3 + 11 = 14$.' },
    { kind: 'rule', fig: scale(2, 5, 0, 11), text: 'מורידים $x$־ים משני האגפים, ואז פותרים כמו קודם.', display: '\\begin{aligned} 3x + 5 &= x + 11 \\qquad /{-x} \\\\ 2x + 5 &= 11 \\qquad /{-5} \\\\ 2x &= 6 \\qquad /{:}2 \\\\ x &= 3 \\end{aligned}',
      why: 'מחסירים $x$ משני האגפים: באגף ימין לא נשאר $x$, ובאגף שמאל נשארים $2x$.' },
    { kind: 'predict', fig: scale(4, 2, 1, 14), text: 'מה $x$?', display: '4x + 2 = x + 14', choices: ['$4$', '$2.4$', '$\\dfrac{16}{3}$'], answer: 0,
      why: 'מחסירים $x$: $3x + 2 = 14$. אחר כך $3x = 12$, ו־$x = 4$. בדיקה: $18 = 18$.',
      wrongWhy: { 1: '$2.4$ יוצא כש־$x$ עובר לאגף השני בלי להתהפך: $5x = 12$. אבל מחסירים $x$ משני האגפים, ולכן נשאר $3x$.', 2: '$\\frac{16}{3}$ יוצא כשה־$2$ עובר לאגף השני בלי להתהפך: $3x = 16$.' } },
    { kind: 'say', fig: { type: 'table', ltr: true, head: ['אגף שמאל', 'אגף ימין', 'עושים'], rows: [['2x − 3', 'x + 4', '/−x'], ['x − 3', '4', '/+3'], ['x', '7', '']] }, text: 'עם מספרים שליליים אין מאזניים, אבל הכלל אותו כלל: מה שמורידים מאגף אחד, מורידים גם מהשני. בעמודה "עושים" כתוב מה עושים לשורה, כמו אחרי הקו במחברת.' },
    { kind: 'predict', fig: scale(2, 3, 2, 5, 1), text: 'כמה פתרונות יש למשוואה?', display: '2x + 3 = 2x + 5', choices: ['אין פתרון', 'פתרון אחד', 'כל מספר הוא פתרון'], answer: 0,
      why: 'מחסירים $2x$ משני האגפים: $3 = 5$. זה לא נכון אף פעם, ולכן אין מספר שפותר את המשוואה.',
      wrongWhy: { 1: 'נסו כל מספר: באגף ימין תמיד יוצא $2$ יותר מבאגף שמאל.', 2: 'כש־$x = 0$: $3$ מול $5$. לא שווים.' } },
    { kind: 'predict', fig: { type: 'tiles', px: 3, nx: 1, p1: 6, n1: 0 }, text: 'וכמה פתרונות יש לזאת?', display: '3x + 6 - x = 2x + 6', choices: ['אין פתרון', 'פתרון אחד', 'כל מספר הוא פתרון'], answer: 2,
      why: 'מכנסים באגף שמאל: $2x + 6 = 2x + 6$. שני האגפים זהים, ולכן כל מספר פותר את המשוואה.',
      wrongWhy: { 0: 'כש־$x = 1$: $3 + 6 - 1 = 8$, וגם $2 + 6 = 8$. יש פתרונות.', 1: 'נסו $x = 0$ ו־$x = 1$: שניהם פותרים. ובאמת, כל מספר.' } },
    { kind: 'rule', fig: scale(2, 3, 2, 5, 1), text: 'כשה־$x$־ים נעלמים: שוויון לא נכון, אין פתרון. שוויון נכון, כל מספר הוא פתרון.', display: '\\begin{aligned} 2x + 3 &= 2x + 5 \\qquad /{-2x} \\\\ 3 &= 5 \\end{aligned}',
      why: 'מ־$2x + 3 = 2x + 5$ נשאר $3 = 5$, שלא נכון אף פעם: אין פתרון. מ־$2x + 6 = 2x + 6$ נשאר $6 = 6$, שנכון תמיד: כל מספר הוא פתרון. ברוב המשוואות יש פתרון אחד, ובודקים אותו בשני האגפים.' },
  ],
  examples: [
    { problem: 'פתרו את המשוואה.', display: '7x - 3 = 4x + 9', answer: 4, check: '(9 + 3) / (7 - 4)',
      steps: [
        { action: 'מחסירים $4x$ משני האגפים.', mark: '-4x', why: 'כך $x$ נשאר רק באגף שמאל.', result: '3x - 3 = 9', eq: '3*x - 3 = 9' },
        { action: 'מוסיפים $3$ לשני האגפים.', mark: '+3', why: 'מבטלים את החיסור של $3$.', result: '3x = 12', eq: '3*x = 12' },
        { action: 'מחלקים ב־$3$.', mark: ':3', why: 'מבטלים את הכפל.', result: 'x = 4', eq: 'x = 4' },
        { action: 'בודקים בשני האגפים.', why: 'באגף שמאל $7 \\cdot 4 - 3 = 25$, ובאגף ימין $4 \\cdot 4 + 9 = 25$.', result: '25 = 25', calc: { expr: '7*4 - 3', value: 25 }, fig: sides('7x \u2212 3', '4x + 9', [4], (x) => [7 * x - 3, 4 * x + 9]) },
      ] },
    { problem: 'במכון כושר א׳: $120$ ₪ דמי הרשמה ועוד $80$ ₪ לחודש. במכון ב׳: $40$ ₪ דמי הרשמה ועוד $100$ ₪ לחודש. אחרי כמה חודשים התשלום הכולל שווה?', fig: gyms([1, 2, 3]), answer: 4, check: '(120 - 40) / (100 - 80)',
      steps: [
        { action: 'נסמן ב־$x$ את מספר החודשים, ונבנה משוואה.', why: 'בכל מכון: המחיר לחודש כפול $x$, ועוד דמי ההרשמה.', result: '80x + 120 = 100x + 40', eq: '80*x + 120 = 100*x + 40' },
        { action: 'מחסירים $80x$ משני האגפים.', mark: '-80x', why: 'מורידים את ה־$x$־ים מהאגף שבו יש פחות, כך שהמקדם שנשאר חיובי.', result: '120 = 20x + 40', eq: '120 = 20*x + 40' },
        { action: 'מחסירים $40$ משני האגפים.', mark: '-40', why: 'מבטלים את המספר שליד $20x$.', result: '80 = 20x', eq: '80 = 20*x' },
        { action: 'מחלקים ב־$20$.', mark: ':20', why: 'מבטלים את הכפל.', result: '4 = x', eq: '4 = x' },
        { action: 'הופכים צדדים.', why: '$4 = x$ ו־$x = 4$ אומרים אותו דבר. במחברת כותבים: $x = 4$ (הפכנו צדדים).', result: 'x = 4', eq: 'x = 4' },
        { action: 'בודקים בסיפור.', why: 'אחרי $4$ חודשים: במכון א׳ $120 + 80 \\cdot 4 = 440$, ובמכון ב׳ $40 + 100 \\cdot 4 = 440$.', result: '440 = 440', calc: { expr: '120 + 80*4', value: 440 }, fig: gyms([1, 2, 3, 4]) },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '2x - 7 = 5x + 8',
      steps: [
        { prompt: 'מה עושים קודם?', choices: [
          { text: 'מחסירים $2x$ משני האגפים', ok: true, feedback: 'נכון: $-7 = 3x + 8$. (גם הורדה של $5x$ עובדת: $-3x - 7 = 8$.)' },
          { text: 'מוסיפים $2x$ לשני האגפים', ok: false, feedback: 'אז באגף שמאל יהיה $4x$. מורידים $x$־ים, לא מוסיפים.' },
          { text: 'מחסירים $7$ רק מאגף שמאל', ok: false, feedback: 'מה שעושים לאגף אחד עושים גם לשני. וחוץ מזה, $-7$ מבטלים בחיבור של $7$.' },
        ], hints: ['איך משאירים $x$ רק באגף אחד?', 'מורידים $2x$ משני האגפים.'], done: '$-7 = 3x + 8$' },
        { prompt: 'ועכשיו?', choices: [
          { text: 'מחסירים $8$ משני האגפים', ok: true, feedback: 'נכון: $-15 = 3x$.' },
          { text: 'מוסיפים $8$ לשני האגפים', ok: false, feedback: 'חיבור של $8$ מבטלים בחיסור של $8$.' },
          { text: 'מחלקים ב־$3$ רק את $3x$', ok: false, feedback: 'קודם מורידים את ה־$8$, ואז מחלקים את שני האגפים.' },
        ], hints: ['מה נוסף ל־$3x$?', '$8$. מחסירים אותו משני האגפים.'], done: '$-15 = 3x$' },
      ],
      final: { prompt: 'מה $x$?', answer: -5, check: '(-7 - 8) / (5 - 2)', hints: ['מחלקים את שני האגפים ב־$3$.', '$-15 : 3$.'] } },
    { problem: 'ועוד אחת.', display: '6x + 1 = 2x + 3', fig: scale(6, 1, 2, 3),
      steps: [
        { prompt: 'מה מקבלים אחרי שמורידים $2x$ ו־$1$ משני האגפים?', choices: [
          { text: '$4x = 2$', ok: true, feedback: 'נכון: $6x - 2x = 4x$, ו־$3 - 1 = 2$.' },
          { text: '$8x = 2$', ok: false, feedback: '$2x$ הוחסר משני האגפים, ולכן נשאר $6x - 2x = 4x$.' },
          { text: '$4x = 4$', ok: false, feedback: '$1$ הוחסר משני האגפים: $3 - 1 = 2$.' },
        ], hints: ['מה נשאר מ־$6x$ אחרי שמורידים $2x$?', '$4x$. ובאגף ימין: $3 - 1$.'], done: '$4x = 2$', fig: scale(4, 0, 0, 2) },
      ],
      final: { prompt: 'מה $x$? אפשר לכתוב שבר או מספר עשרוני.', answer: 0.5, check: '(3 - 1) / (6 - 2)', hints: ['מחלקים את שני האגפים ב־$4$.', '$2 : 4$ הוא חצי.'] } },
  ],
  diag: bothModel,
  transfer: gymModel,
  misconceptions: [
    { id: 'move-no-flip', title: 'מספר עבר לאגף השני בלי פעולה הפוכה',
      cause: 'כשהמשוואה ארוכה, קל להעביר מספר כמו שהוא, בלי לשאול מה נעשה לשני האגפים.',
      explain: ['נראה שמספר עבר לאגף השני בלי להתהפך.', 'ב־$2x + 6 = x + 9$ מחסירים $6$ משני האגפים: $2x = x + 3$. ואז $x = 3$, ובבדיקה שני האגפים $12$.'],
      remedy: [
        { kind: 'explore', text: 'שתי קופסאות ו־$6$ משקולות מול קופסה ו־$9$ משקולות. הביאו לקופסה אחת לבד.', manip: balance(2, 6, 1, 9), answer: 3,
          hint: 'מה שמורידים מכף אחת, מורידים גם מהשנייה: קופסה מכל כף, משקולות מכל כף.', success: '$x = 3$. בדיקה: $2 \\cdot 3 + 6 = 12$, וגם $3 + 9 = 12$.' },
        { kind: 'predict', text: 'מישהו פתר את $2x + 6 = x + 9$ וקיבל $x = 15$. זה נכון?', choices: ['לא', 'כן'], answer: 0,
          why: 'מציבים $15$: באגף שמאל $2 \\cdot 15 + 6 = 36$, ובאגף ימין $15 + 9 = 24$. לא שווים: ה־$6$ עבר לאגף ימין בלי להתהפך.' },
      ] },
    { id: 'move-x-no-flip', title: 'איבר ה־$x$ עבר לאגף השני בלי שהסימן שלו התהפך',
      cause: '"מעבירים אגף" נזכר כתנועה של איבר, וה־$x$ מצטרף לצד השני כמו שהוא.',
      explain: ['נראה שה־$x$ שעבר לאגף השני נוסף במקום להיות מוחסר.', 'ב־$5x + 2 = 3x + 10$ מחסירים $3x$ משני האגפים: $2x + 2 = 10$, ולא $8x + 2 = 10$.'],
      remedy: [
        { kind: 'explore', text: 'חמש קופסאות ו־$2$ משקולות מול שלוש קופסאות ו־$10$ משקולות. הביאו לקופסה אחת לבד.', manip: balance(5, 2, 3, 10), answer: 4,
          hint: 'כמה קופסאות אפשר להוריד מכל כף?', success: '$x = 4$: הורדתם שלוש קופסאות מכל כף, ונשארו שתיים, לא שמונה.' },
        { kind: 'predict', text: 'מישהו פתר את $5x + 2 = 3x + 10$ וקיבל $x = 1$. זה נכון?', choices: ['לא', 'כן'], answer: 0,
          why: 'מציבים $1$: באגף שמאל $7$, ובאגף ימין $13$. לא שווים. $3x$ הוחסר משני האגפים, ולכן נשאר $2x$.' },
      ] },
    // the first two stairs' mistakes, on the last line this stair's equations end on (content/eq.js lastStepBugs)
    { id: 'sign', title: 'הפתרון יצא עם הסימן ההפוך',
      cause: 'כשיש מינוסים בשני האגפים, קל לאבד אחד מהם בדרך: למשל לחשב $16 - 12$ במקום $-16 + 12$.',
      explain: ['נראה שהסימן של הפתרון התהפך.', 'ב־$7x - 12 = 6x - 16$ מחסירים $6x$: $x - 12 = -16$. מוסיפים $12$: $x = -16 + 12 = -4$. בדיקה: באגף שמאל $7 \\cdot (-4) - 12 = -40$, ובאגף ימין $6 \\cdot (-4) - 16 = -40$.'],
      prereq: 'signed:1',
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $7x - 12 = 6x - 16$?', choices: ['$-4$', '$4$'], answer: 0,
          why: 'בדיקה: באגף שמאל $7 \\cdot (-4) - 12 = -40$, ובאגף ימין $6 \\cdot (-4) - 16 = -40$. ואילו ב־$x = 4$ יוצא $16$ מול $8$.' },
        { kind: 'rule', text: 'כל מספר עובר משורה לשורה עם הסימן שלפניו, ובסוף בודקים בשני האגפים.', display: '\\begin{aligned} 7x - 12 &= 6x - 16 \\qquad /{-6x} \\\\ x - 12 &= -16 \\qquad /{+12} \\\\ x &= -4 \\end{aligned}',
          why: '$-16 + 12$ הוא $-4$: מ־$-16$ עולים $12$, ועדיין מתחת לאפס. הבדיקה בשני האגפים מראה אם הסימן נכון.' },
      ] },
    { id: 'sub-coef', title: 'המקדם הוחסר במקום לחלק בו',
      cause: 'אחרי שמורידים $x$־ים ומספרים נשארת שורה כמו $3x = 9$, ו־$3x$ נקרא כמו $3 + x$.',
      explain: ['נראה שבצעד האחרון המקדם הוחסר.', 'ב־$4x + 1 = x + 10$ נשאר $3x = 9$. $3x$ הוא $3 \\cdot x$, ולכן מחלקים: $x = 3$, ולא $9 - 3 = 6$.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'explore', text: 'ארבע קופסאות ומשקולת אחת מול קופסה ו־$10$ משקולות. הביאו לקופסה אחת לבד.', manip: balance(4, 1, 1, 10), answer: 3,
          hint: 'בסוף נשארות שלוש קופסאות מול $9$ משקולות. מחלקים כל כף לשלוש.', success: '$x = 3$: שלוש קופסאות שוקלות $9$, ולכן קופסה אחת שוקלת $9 : 3 = 3$, ולא $9 - 3 = 6$.' },
        { kind: 'predict', text: 'מ־$4x + 1 = x + 10$ יצא $3x = 9$. מה $x$?', choices: ['$3$', '$6$'], answer: 0,
          why: 'בדיקה: $4 \\cdot 3 + 1 = 13$, וגם $3 + 10 = 13$. ואילו ב־$x = 6$ יוצא $25$ מול $16$.' },
      ] },
    // named on the last step of solving together (6x + 1 = 2x + 3 leaves 4x = 2); this stair's exercises have whole
    // answers, so the number is never smaller than the coefficient there
    { id: 'divide-flip', title: 'החילוק נעשה הפוך',
      cause: 'אחרי שמורידים $x$־ים ומספרים, המספר שנשאר קטן מהמקדם, כמו $4x = 2$, ונדמה שמחלקים את הגדול בקטן. אבל הפתרון יכול להיות שבר.',
      explain: ['נראה שחילקתם את המקדם במספר שבאגף השני.', 'ב־$6x + 1 = 2x + 3$ נשאר $4x = 2$. מחלקים ב־$4$: $x = \\frac{2}{4} = \\frac{1}{2}$, ולא $4 : 2 = 2$.'],
      remedy: [
        { kind: 'predict', text: 'מ־$6x + 1 = 2x + 3$ יצא $4x = 2$. מה $x$?', choices: ['$\\dfrac{1}{2}$', '$2$'], answer: 0,
          why: 'בדיקה: $6 \\cdot \\frac{1}{2} + 1 = 4$, וגם $2 \\cdot \\frac{1}{2} + 3 = 4$. ואילו ב־$x = 2$ יוצא $13$ מול $7$.' },
        DIVIDE_RULE,
      ] },
  ],
};

// ================================================================ stair 4: brackets (משוואות עם סוגריים)

type Brk = { k: number; a: number; b: number; c: number; d: number; x: number }; // k 0: a(x + b) = d; 1: a(x + b) = cx + d; 2: cx − (x + b) = d
const brkShow = (p: Brk) => (p.k === 2 ? `${linTex(p.c, 0)} - (${linTex(1, p.b)}) = ${T(p.d)}` : `${p.a}(${linTex(1, p.b)}) = ${p.k === 0 ? T(p.d) : linTex(p.c, p.d)}`);
const brkBugs: Record<string, (p: Brk) => number | null> = {
  // a(x + b) opened as ax + b
  'partial-dist': (p) => (p.k === 2 ? null : (p.d - p.b) / (p.a - p.c)),
  // cx − (x + b) opened as cx − x + b; a negative a: a(x + b) opened as ax − ab
  'minus-bracket': (p) => (p.k === 2 ? (p.d - p.b) / (p.c - 1) : p.a < 0 ? (p.d + p.a * p.b) / (p.a - p.c) : null),
  // the first two stairs' mistakes on the last line the solution ends on: (c − 1)x = d + b, ax = d − ab (a may be
  // negative: −3x = 15), or |a − c|x = … where bothSolution leaves the x-terms
  ...lastStep((p: Brk) => { const K = p.k === 2 ? p.c - 1 : p.k === 0 ? p.a : abs(p.a - p.c); return [K, K * p.x]; }, ['sign', 'sub-coef']),
};
const brkDraw = (rnd: () => number): Brk => {
  const k = rint(rnd, 0, 2); const x = rnz(rnd, -10, 10); const b = rnz(rnd, -9, 9);
  if (k === 2) { const c = rint(rnd, 2, 7); return { k, a: 0, b, c, x, d: (c - 1) * x - b }; }
  const a = rint(rnd, 2, 6) * (rnd() < 0.5 ? -1 : 1);
  if (k === 0) return { k, a, b, c: 0, x, d: a * (x + b) };
  let c: number; do { c = rnz(rnd, -5, 5); } while (c === a);
  return { k, a, b, c, x, d: a * (x + b) - c * x };
};
const brkModel: DiagModel<Brk> = {
  params: (rnd) => fair(() => brkDraw(rnd), (p) => p.x, brkBugs),
  text: () => 'פתרו את המשוואה.',
  display: brkShow,
  answer: (p) => p.x,
  bugs: brkBugs,
  // the class's two named steps (CLASSROOM-7): the distributive law first, then solved as before, a slash on every line
  solution: (p) => {
    if (p.k === 2) {
      const A = p.c - 1;
      return [line(`${STEP1}, והמינוס הופך את שני הסימנים`, `${linTex(p.c, 0)} - x ${p.b < 0 ? '+' : '-'} ${abs(p.b)} = ${T(p.d)}`), line(`${STEP2} מכנסים`, `${linTex(A, -p.b)} = ${T(p.d)}`, undoOp(-p.b)),
        line(undo(-p.b), `${linTex(A, 0)} = ${T(p.d + p.b)}`, A === 1 ? null : divOp(A)), ...(A === 1 ? [] : [line(`מחלקים ב־$${A}$`, `x = ${T(p.x)}`)]),
        `בדיקה: $${at(p.c, 0, p.x)} - (${T(p.x)} ${p.b < 0 ? '-' : '+'} ${abs(p.b)}) = ${T(p.d)}$`];
    }
    const opened = `${linTex(p.a, p.a * p.b)} = ${p.k === 0 ? T(p.d) : linTex(p.c, p.d)}`;
    const check = `בדיקה במשוואה המקורית: $${p.a}(${T(p.x)} ${p.b < 0 ? '-' : '+'} ${abs(p.b)}) = ${T(p.a * (p.x + p.b))}$${p.k === 1 ? `, וגם $${at(p.c, p.d, p.x)} = ${T(p.c * p.x + p.d)}$` : ''}`;
    if (p.k === 0) return [line(STEP1, opened, undoOp(p.a * p.b)), `${STEP2} ${line(undo(p.a * p.b), `${linTex(p.a, 0)} = ${T(p.d - p.a * p.b)}`, divOp(p.a))}`, line(`מחלקים ב־$${T(p.a)}$`, `x = ${T(p.x)}`), check];
    const both = bothSolution({ a: p.a, b: p.a * p.b, c: p.c, d: p.d, x: p.x });
    return [line(STEP1, opened, both.op), `${STEP2} ${both.lines[0]}`, ...both.lines.slice(1), check];
  },
  hint: (p) => (p.k === 2 ? 'מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.' : 'קודם פותחים סוגריים: המספר שלפני הסוגריים כופל כל איבר בתוכם, עם הסימן שלו.'),
};

type Balls = { n2: number; e: number; p: number }; // n2 + e balls at x = n2 balls at x + p
const ballsBugs: Record<string, (q: Balls) => number | null> = { 'partial-dist': (q) => q.p / q.e };
const ballsModel: DiagModel<Balls> = {
  // the curriculum's two balls (algebra_7, example 6): 18 balls at x cost as much as 15 balls at x + 6
  params: (rnd) => fair(() => {
    for (;;) { const e = rint(rnd, 1, 3); const n2 = rint(rnd, 6, 20); const p = rint(rnd, 2, 12); if (!((n2 * p) % e) && (n2 * p) / e <= 60) return { n2, e, p }; }
  }, (q) => (q.n2 * q.p) / q.e, ballsBugs),
  text: (q) => `יוסי קנה $${q.n2 + q.e}$ כדורים, ודנה קנתה $${q.n2}$ כדורים, כל אחד יקר ב־$${q.p}$ ₪ מכדור של יוסי. הם שילמו אותו סכום. כמה עלה כדור של יוסי?`,
  answer: (q) => (q.n2 * q.p) / q.e,
  bugs: ballsBugs,
  solution: (q) => {
    const x = (q.n2 * q.p) / q.e;
    return [`כדור של יוסי $x$, כדור של דנה $x + ${q.p}$: $${q.n2 + q.e}x = ${q.n2}(x + ${q.p})$`, line(STEP1, `${q.n2 + q.e}x = ${q.n2}x + ${q.n2 * q.p}`, `-${q.n2}x`),
      `${STEP2} ${line(`מחסירים $${q.n2}x$ משני האגפים`, `${linTex(q.e, 0)} = ${q.n2 * q.p}`, q.e > 1 ? divOp(q.e) : null)}`, ...(q.e > 1 ? [line(`מחלקים ב־$${q.e}$`, `x = ${x}`)] : []), `בדיקה: $${q.n2 + q.e} \\cdot ${x} = ${(q.n2 + q.e) * x}$, וגם $${q.n2} \\cdot ${x + q.p} = ${q.n2 * (x + q.p)}$`];
  },
  hint: (q) => `נסמנו ב־$x$ את המחיר של כדור של יוסי. כמה שילמה דנה על $${q.n2}$ כדורים של $x + ${q.p}$?`,
  unit: '₪',
};

const stair4: StairContent = {
  skill: 'eq:4', topic: 'eq', level: 4, title: 'משוואות עם סוגריים',
  objectives: [
    'לפתוח סוגריים במשוואה, לכנס איברים דומים ולפתור.',
    'לטפל נכון במינוס לפני סוגריים.',
    'לבדוק את הפתרון במשוואה המקורית.',
  ],
  idea: 'סוגריים במשוואה פותחים כמו בביטוי, ואז זו משוואה שכבר יודעים לפתור.',
  why: [
    'פתיחת סוגריים לא משנה את הערך של האגף, ולכן גם לא את הפתרון.',
    'הבדיקה במשוואה המקורית, זו שעם הסוגריים, תופסת טעות בפתיחת הסוגריים.',
  ],
  alt: [
    '$3(x + 2) = 21$ אפשר לפתור גם בלי לפתוח סוגריים: מחלקים קודם את שני האגפים ב־$3$, ו־$x + 2 = 7$.',
    'מלבן בגובה $3$ ובאורך $x + 2$: השטח שלו $3x + 6$. אם השטח $21$, אז $3x + 6 = 21$.',
  ],
  discover: [
    { kind: 'say', fig: { type: 'area', a: 3, b: 2 }, mood: 'happy', text: 'גם במשוואה יכולים להיות סוגריים. נתחיל ממלבן ששטחו $3(x + 2)$.' },
    { kind: 'explore', text: 'בנו מלבן בגובה $3$ ובאורך $x + 2$, ושימו לב לשטח של כל חלק.', display: '3(x + 2)', manip: area(), answer: { a: 3, b: 2 },
      hint: 'גובה $3$, ואורך $x$ ועוד $2$ יחידות.', success: 'השטח $3x + 6$: החלק של $x$ הוא $3x$, וחלק היחידות $3 \\cdot 2 = 6$.' },
    { kind: 'predict', fig: { type: 'area', a: 3, b: 2, areas: true }, text: 'השטח של המלבן הוא $21$. מה $x$?', display: '3(x + 2) = 21', choices: ['$5$', '$\\dfrac{19}{3}$', '$7$'], answer: 0,
      why: 'פותחים: $3x + 6 = 21$, ואז $3x = 15$ ו־$x = 5$. בדיקה: $3(5 + 2) = 21$.',
      wrongWhy: { 1: '$\\frac{19}{3}$ יוצא כשה־$2$ לא נכפל ב־$3$: $3x + 2 = 21$. אבל שני חלקי המלבן נכפלים בגובה.', 2: '$7$ הוא $x + 2$, כל האורך. $x$ עצמו קטן ממנו ב־$2$.' } },
    { kind: 'rule', fig: { type: 'area', a: 3, b: 2, areas: true }, text: 'פותרים בשני שלבים, כמו בכיתה. שלב 1: חוק הפילוג (פותחים סוגריים). שלב 2: פותרים כרגיל.', display: '\\begin{aligned} 3(x + 2) &= 21 \\\\ 3x + 6 &= 21 \\qquad /{-6} \\\\ 3x &= 15 \\qquad /{:}3 \\\\ x &= 5 \\end{aligned}',
      why: 'פתיחת הסוגריים לא משנה את הערך של האגף, ולכן גם לא את הפתרון.' },
    { kind: 'predict', fig: { type: 'table', head: ['x', 'x − 5 + 6x', '4x − (x + 5)'], rows: [[1, 2, -2], [2, 9, 1]] }, text: 'מה הפתרון של המשוואה?', display: 'x - 5 + 6x = 4x - (x + 5)', choices: ['$0$', '$2.5$', '$-2.5$'], answer: 0,
      why: 'באגף שמאל $7x - 5$. באגף ימין $4x - x - 5 = 3x - 5$. מחסירים $3x$ ומוסיפים $5$: $4x = 0$, ולכן $x = 0$.',
      wrongWhy: { 1: '$2.5$ יוצא כשהמינוס לפני הסוגריים הופך רק את $x$. אבל $-(x + 5)$ הוא $-x - 5$, לא $-x + 5$.', 2: 'כש־$x = -2.5$: באגף שמאל $-22.5$, ובאגף ימין $-12.5$. לא שווים.' } },
    { kind: 'say', fig: { type: 'table', head: ['x', 'x − 5 + 6x', '4x − (x + 5)'], rows: [[0, -5, -5], [1, 2, -2]] }, text: 'הפתרון יכול להיות $0$, וזה פתרון ככל פתרון: כש־$x = 0$ שני האגפים שווים $-5$.' },
    { kind: 'rule', fig: { type: 'tiles', px: 0, nx: 1, p1: 0, n1: 5 }, text: 'מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.', display: '-(x + 5) = -x - 5',
      why: '$-(x + 5)$ הוא $-1 \\cdot (x + 5)$: גם $x$ וגם $5$ נכפלים ב־$-1$.' },
    { kind: 'predict', fig: { type: 'area', a: 3, b: 2 }, text: 'כמה פתרונות יש למשוואה?', display: '3(x + 2) = 3x + 6', choices: ['כל מספר הוא פתרון', 'פתרון אחד', 'אין פתרון'], answer: 0,
      why: 'פותחים: $3x + 6 = 3x + 6$. שני האגפים זהים, ולכן כל מספר הוא פתרון.',
      wrongWhy: { 1: 'נסו $x = 0$ ו־$x = 1$: שניהם פותרים. ובאמת, כל מספר.', 2: 'כש־$x = 0$: $3 \\cdot 2 = 6$, וגם באגף ימין $6$. יש פתרון.' } },
    { kind: 'rule', fig: machine(5, '3(x + 2)', 21), text: 'בודקים במשוואה המקורית, זו שעם הסוגריים.', display: 'x = 5:\\quad 3(5 + 2) = 21',
      why: 'טעות בפתיחת הסוגריים לא תיראה בבדיקה של המשוואה שאחרי הפתיחה. במשוואה המקורית היא נראית מיד.' },
  ],
  examples: [
    { problem: 'פתרו את המשוואה.', display: '4(x - 3) = 2x + 6', answer: 9, check: '(6 + 12) / (4 - 2)',
      steps: [
        { action: 'שלב 1: חוק הפילוג (פותחים סוגריים).', why: '$4$ כופל גם את $x$ וגם את $-3$.', result: '4x - 12 = 2x + 6', eq: '4*x - 12 = 2*x + 6' },
        { action: 'שלב 2: פותרים כרגיל. מחסירים $2x$ משני האגפים.', mark: '-2x', why: 'כך $x$ נשאר רק באגף שמאל. כותבים קודם מה עשינו: $4x - 2x$.', result: '4x - 2x - 12 = 6', eq: '4*x - 2*x - 12 = 6' },
        { action: 'מכנסים: $x$־ים עם $x$־ים.', why: '$4x - 2x = 2x$.', result: '2x - 12 = 6', eq: '2*x - 12 = 6' },
        { action: 'מוסיפים $12$ לשני האגפים.', mark: '+12', why: 'מבטלים את החיסור.', result: '2x = 18', eq: '2*x = 18' },
        { action: 'מחלקים ב־$2$.', mark: ':2', why: 'מבטלים את הכפל.', result: 'x = 9', eq: 'x = 9' },
        { action: 'בודקים במשוואה המקורית.', why: 'באגף שמאל $4(9 - 3) = 24$, ובאגף ימין $2 \\cdot 9 + 6 = 24$.', result: '24 = 24', calc: { expr: '4*(9 - 3)', value: 24 }, fig: sides('4(x \u2212 3)', '2x + 6', [9], (x) => [4 * (x - 3), 2 * x + 6]) },
      ] },
    { problem: 'פתרו את המשוואה.', display: '4(x + 2) = 5x', answer: 8, check: '4*2 / (5 - 4)', fig: { type: 'area', a: 4, b: 2 },
      steps: [
        { action: 'שלב 1: חוק הפילוג (פותחים סוגריים).', why: '$4$ כופל גם את $x$ וגם את $2$.', result: '4x + 8 = 5x', eq: '4*x + 8 = 5*x', fig: scale(4, 8, 5, 0) },
        { action: 'שלב 2: פותרים כרגיל. מחסירים $4x$ משני האגפים.', mark: '-4x', why: 'ב־$5x$ יש יותר $x$־ים, ולכן הם נשארים באגף ימין. כותבים קודם מה עשינו: $5x - 4x$.', fig: scale(0, 8, 1, 0), result: '8 = 5x - 4x', eq: '8 = 5*x - 4*x' },
        { action: 'מכנסים: $x$־ים עם $x$־ים.', why: '$5x - 4x = x$.', result: '8 = x', eq: '8 = x' },
        { action: 'הופכים צדדים.', why: '$8 = x$ ו־$x = 8$ אומרים אותו דבר. במחברת כותבים: $x = 8$ (הפכנו צדדים).', result: 'x = 8', eq: 'x = 8' },
        { action: 'בודקים במשוואה המקורית.', why: 'באגף שמאל $4(8 + 2) = 4 \\cdot 10 = 40$, ובאגף ימין $5 \\cdot 8 = 40$.', result: '4 \\cdot 10 = 5 \\cdot 8 = 40', calc: { expr: '4*10', value: 40 } },
      ] },
    { problem: 'יוסי קנה $18$ כדורים, ודנה קנתה $15$ כדורים, כל אחד יקר ב־$6$ ₪ מכדור של יוסי. הם שילמו אותו סכום. כמה עלה כדור של יוסי?', answer: 30, check: '15*6 / (18 - 15)',
      steps: [
        { action: 'נסמן ב־$x$ את המחיר של כדור של יוסי, ונבנה משוואה.', why: 'כדור של דנה עולה $x + 6$. כל אחד שילם מספר הכדורים כפול המחיר.', fig: { type: 'table', head: ['', 'כדורים', 'מחיר כדור (₪)', 'שילמו (₪)'], rows: [['יוסי', 18, 'x', '18x'], ['דנה', 15, 'x + 6', '15(x + 6)']] }, result: '18x = 15(x + 6)', eq: '18*x = 15*(x + 6)' },
        { action: 'שלב 1: חוק הפילוג (פותחים סוגריים).', why: '$15$ כופל גם את $x$ וגם את $6$.', result: '18x = 15x + 90', eq: '18*x = 15*x + 90' },
        { action: 'שלב 2: פותרים כרגיל. מחסירים $15x$ משני האגפים.', mark: '-15x', why: 'כך $x$ נשאר רק באגף שמאל.', result: '18x - 15x = 90', eq: '18*x - 15*x = 90' },
        { action: 'מכנסים: $x$־ים עם $x$־ים.', why: '$18x - 15x = 3x$.', result: '3x = 90', eq: '3*x = 90' },
        { action: 'מחלקים ב־$3$.', mark: ':3', why: 'מבטלים את הכפל.', result: 'x = 30', eq: 'x = 30' },
        { action: 'בודקים בסיפור.', why: 'יוסי: $18 \\cdot 30 = 540$. דנה: $15 \\cdot 36 = 540$.', result: '540 = 540', calc: { expr: '15*36', value: 540 } },
      ] },
  ],
  together: [
    { problem: 'נפתור יחד.', display: '5 - (x - 3) = 2x - 4',
      steps: [
        { prompt: 'מה זה $5 - (x - 3)$ בלי סוגריים?', choices: [
          { text: '$5 - x + 3$', ok: true, feedback: 'נכון: המינוס הופך גם את $-3$ ל־$+3$. מכנסים: $8 - x$.' },
          { text: '$5 - x - 3$', ok: false, feedback: 'המינוס לפני הסוגריים הופך את הסימן של כל איבר, גם של $-3$.' },
          { text: '$5 + x - 3$', ok: false, feedback: 'המינוס הופך גם את $x$: $-x$.' },
        ], hints: ['$-(x - 3)$ הוא $-1 \\cdot (x - 3)$.', '$-1 \\cdot x = -x$, ו־$-1 \\cdot (-3) = 3$.'], done: '$8 - x = 2x - 4$' },
        { prompt: 'מה עושים עכשיו?', choices: [
          { text: 'מוסיפים $x$ לשני האגפים', ok: true, feedback: 'נכון: $8 = 3x - 4$.' },
          { text: 'מחסירים $x$ משני האגפים', ok: false, feedback: 'אז באגף שמאל יהיה $8 - 2x$. כדי שה־$-x$ ייעלם, מוסיפים $x$.' },
          { text: 'מחסירים $8$ רק מאגף שמאל', ok: false, feedback: 'מה שעושים לאגף אחד, עושים גם לשני.' },
        ], hints: ['איך מעלימים את $-x$ מאגף שמאל?', 'מוסיפים $x$ לשני האגפים.'], done: '$8 = 3x - 4$' },
      ],
      final: { prompt: 'מה $x$?', answer: 4, check: '(8 + 4) / 3', hints: ['מוסיפים $4$ לשני האגפים: $12 = 3x$.', '$12 : 3$.'] } },
    { problem: 'סוגריים בשני האגפים.', display: '2(x + 5) = 4(x - 1)',
      steps: [
        { prompt: 'מה מקבלים אחרי פתיחת הסוגריים?', choices: [
          { text: '$2x + 10 = 4x - 4$', ok: true, feedback: 'נכון: כל מספר שלפני סוגריים כופל כל איבר בתוכם.' },
          { text: '$2x + 5 = 4x - 1$', ok: false, feedback: 'גם $5$ וגם $-1$ נכפלים: $2 \\cdot 5 = 10$, ו־$4 \\cdot (-1) = -4$.' },
          { text: '$2x + 10 = 4x - 1$', ok: false, feedback: 'גם $-1$ נכפל ב־$4$: $4 \\cdot (-1) = -4$.' },
        ], hints: ['$2$ כופל את $x$ ואת $5$; $4$ כופל את $x$ ואת $-1$.', '$2 \\cdot 5 = 10$, ו־$4 \\cdot (-1) = -4$.'], done: '$2x + 10 = 4x - 4$' },
      ],
      final: { prompt: 'מה $x$?', answer: 7, check: '(10 + 4) / (4 - 2)', hints: ['מחסירים $2x$ ומוסיפים $4$: $14 = 2x$.', '$14 : 2$.'] } },
  ],
  diag: brkModel,
  transfer: ballsModel,
  misconceptions: [
    { id: 'partial-dist', title: 'רק האיבר הראשון שבסוגריים נכפל',
      cause: 'בתוך משוואה ארוכה העין רואה את המספר שליד הסוגריים ואת ה־$x$ שצמוד אליו, ושוכחת את האיבר השני.',
      explain: ['נראה שבסוגריים נכפל רק $x$.', '$2(x + 5)$ הוא $2x + 10$: שני החלקים של המלבן נכפלים בגובה. ובדיקה במשוואה המקורית תופסת את הטעות.'],
      prereq: 'expr:4',
      remedy: [
        { kind: 'explore', text: 'בנו מלבן ל־$2(x + 5)$, ושימו לב לשטח של כל חלק.', display: '2(x + 5)', manip: area(), answer: { a: 2, b: 5 },
          hint: 'גובה $2$, ואורך $x$ ועוד $5$ יחידות.', success: '$2x + 10$: גם ה־$5$ נכפל ב־$2$.' },
        { kind: 'predict', text: 'מישהו פתח את $2(x + 5) = 16$ כ־$2x + 5 = 16$, וקיבל $x = 5.5$. מה תראה הבדיקה במשוואה המקורית?', choices: ['$2(5.5 + 5) = 21$, לא $16$', '$16 = 16$, הכול נכון'], answer: 0,
          why: 'הבדיקה במשוואה המקורית תופסת את הטעות. הפתרון הנכון: $2x + 10 = 16$, ולכן $x = 3$.' },
        { kind: 'rule', text: 'בודקים במשוואה המקורית, עם הסוגריים.', display: 'x = 3:\\quad 2(3 + 5) = 16',
          why: 'אם רק $x$ נכפל, הבדיקה במשוואה המקורית לא תצא שוויון נכון.' },
      ] },
    { id: 'minus-bracket', title: 'מינוס לפני סוגריים הפך רק את הסימן הראשון',
      cause: 'המינוס נראה כמו חיסור של האיבר הראשון בלבד. אבל הוא מחסר את כל מה שבסוגריים.',
      explain: ['נראה שהמינוס לפני הסוגריים הפך רק את $x$.', '$12 - (x + 2) = 12 - x - 2 = 10 - x$. ואז $10 - x = 4$, ו־$x = 6$.'],
      prereq: 'expr:5',
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $12 - (x + 2) = 4$?', choices: ['$6$', '$10$'], answer: 0,
          why: 'בדיקה: $12 - (6 + 2) = 4$. ואילו $12 - (10 + 2) = 0$, לא $4$.' },
        { kind: 'rule', text: 'מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.', display: '12 - (x + 2) = 12 - x - 2',
          why: 'מחסרים את כל מה שבסוגריים, ולכן מחסרים גם את $x$ וגם את $2$.' },
      ] },
    // the first two stairs' mistakes, on the last line this stair's equations end on (content/eq.js lastStepBugs)
    { id: 'sign', title: 'הפתרון יצא עם הסימן ההפוך',
      cause: 'אחרי פתיחת הסוגריים יש הרבה סימנים, וקל לאבד מינוס בדרך: של המספר שלפני הסוגריים, או של התוצאה.',
      explain: ['נראה שהסימן של הפתרון התהפך.', 'ב־$-3(x + 2) = 9$ פותחים סוגריים: $-3x - 6 = 9$. מוסיפים $6$: $-3x = 15$. מחלקים ב־$-3$: $x = -5$. בדיקה: $-3(-5 + 2) = 9$.'],
      prereq: 'signed:3',
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $-3(x + 2) = 9$?', choices: ['$-5$', '$5$'], answer: 0,
          why: 'בדיקה: $-3(-5 + 2) = -3 \\cdot (-3) = 9$. ואילו $-3(5 + 2) = -21$.' },
        { kind: 'rule', text: 'המספר שלפני הסוגריים כופל כל איבר עם הסימן שלו, ובסוף מחלקים במקדם עם הסימן שלו.', display: '\\begin{aligned} -3x - 6 &= 9 \\qquad /{+6} \\\\ -3x &= 15 \\qquad /{:}(-3) \\\\ x &= -5 \\end{aligned}',
          why: 'חיובי חלקי שלילי הוא שלילי. הבדיקה במשוואה המקורית מראה אם הסימן נכון.' },
      ] },
    { id: 'sub-coef', title: 'המקדם הוחסר במקום לחלק בו',
      cause: 'אחרי פתיחת הסוגריים והכינוס נשארת שורה כמו $2x = 14$, ו־$2x$ נקרא כמו $2 + x$.',
      explain: ['נראה שבצעד האחרון המקדם הוחסר.', 'ב־$2(x + 5) = 4(x - 1)$ נשאר $14 = 2x$. $2x$ הוא $2 \\cdot x$, ולכן מחלקים: $x = 7$, ולא $14 - 2 = 12$.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'predict', text: 'מ־$2(x + 5) = 4(x - 1)$ יצא $14 = 2x$. מה $x$?', choices: ['$7$', '$12$'], answer: 0,
          why: 'בדיקה: $2(7 + 5) = 24$, וגם $4(7 - 1) = 24$. ואילו ב־$x = 12$ יוצא $34$ מול $44$.' },
        { kind: 'rule', text: '$2x$ הוא כפל, ולכן מחלקים ב־$2$.', display: '14 = 2x \\;\\Rightarrow\\; x = 14 : 2 = 7',
          why: 'מספר צמוד ל־$x$ כופל אותו, גם אחרי פתיחת סוגריים. כפל מבטלים בחילוק.' },
      ] },
  ],
};

// ================================================================ stair 5: word problems (בעיות מילוליות)

type Story = { t: number; k: number; g: number; tt: number; b: number; q: number };
// t 0 ages: Dan is g older than Yoav; b years ago Dan was k times Yoav's age (Yoav then tt). q 0 Yoav, 1 Dan.
// t 1 stamps: Danny has k times Rina's; he gives her g, then they have the same. q 0 Rina, 1 Danny, 2 both.
// t 2 the class's rectangle (CLASSROOM-8, content/eq.js rectStory): sides x = tt and x + g, the perimeter given.
// q 0 x, 1 x + g, 2 the area.
const storyX = (p: Story) => (p.t === 0 ? p.tt + p.b : p.t === 2 ? p.tt : (2 * p.g) / (p.k - 1));
const storyAnswer = (p: Story) => {
  const x = storyX(p);
  if (p.t === 2) return rectAt(p.g, p.q, x);
  if (p.t === 0) return p.q === 0 ? x : x + p.g;
  return p.q === 0 ? x : p.q === 1 ? p.k * x : (p.k + 1) * x;
};
const storyBugs: Record<string, (p: Story) => number | null> = {
  // k(x − b) opened as kx − b: Yoav comes out tt; the rectangle's 2(x + g) opened as 2x + g
  'partial-dist': (p) => (p.t === 0 ? (p.q === 0 ? p.tt : p.tt + p.g) : p.t === 2 ? rectBugs(p.tt, p.g, p.q)['partial-dist'] : null),
  // the unknown answered, not what was asked
  'wrong-unknown': (p) => (p.q === 0 ? null : storyX(p)),
  // the rectangle's perimeter with two sides only, x + (x + g) = P, and its area with the sides added
  'two-sides': (p) => (p.t === 2 ? rectBugs(p.tt, p.g, p.q)['two-sides'] : null),
  'add-sides': (p) => (p.t === 2 ? rectBugs(p.tt, p.g, p.q)['add-sides'] : null),
};
const AGES = [['דן', 'יואב'], ['אורי', 'עידו'], ['אלון', 'רון']];
const STAMPS = [['דני', 'רינה'], ['עומר', 'מאיה'], ['איתי', 'שירה']];
const storyModel: DiagModel<Story & { n: number }> = {
  params: (rnd) => fair(() => {
    const n = rint(rnd, 0, 2); const r = rnd();
    if (r < 1 / 3) { const k = rint(rnd, 2, 4); const tt = rint(rnd, 2, 8); const b = rint(rnd, 2, 6); return { t: 0, k, g: (k - 1) * tt, tt, b, q: rint(rnd, 0, 1), n }; }
    if (r >= 2 / 3) return { t: 2, k: 0, g: rint(rnd, 2, 9), tt: rint(rnd, 3, 15), b: 0, q: rint(rnd, 0, 2), n };
    const k = rint(rnd, 2, 4); let g: number; do { g = rint(rnd, 2, 12); } while ((2 * g) % (k - 1)); return { t: 1, k, g, tt: 0, b: 0, q: rint(rnd, 0, 2), n };
  }, storyAnswer, storyBugs),
  text: (p) => {
    if (p.t === 2) return rectText(p.tt, p.g, p.q);
    if (p.t === 0) { const [A, B] = AGES[p.n]; return `${A} מבוגר מ${B} ב־$${p.g}$ שנים. לפני $${p.b}$ שנים, הגיל של ${A} היה פי $${p.k}$ מהגיל של ${B}. בן כמה ${p.q ? A : B} היום?`; }
    const [A, B] = STAMPS[p.n];
    return `ל${A} יש פי $${p.k}$ בולים מל${B}. ${A} נתן ל${B} $${p.g}$ בולים, ועכשיו לשניהם אותו מספר. ${[`כמה בולים היו ל${B} בהתחלה?`, `כמה בולים היו ל${A} בהתחלה?`, 'כמה בולים היו לשניהם יחד?'][p.q]}`;
  },
  fig: (p) => (p.t === 2 ? rectStoryFig(p.g) : undefined),
  answer: storyAnswer,
  bugs: storyBugs,
  solution: (p) => {
    const x = storyX(p);
    if (p.t === 2) return rectLines(x, p.g, p.q);
    if (p.t === 0) {
      const [A, B] = AGES[p.n];
      return [`נסמן ב־$x$ את הגיל של ${B} היום. לפני $${p.b}$ שנים: ${B} $x - ${p.b}$, ו${A} $${linTex(1, p.g - p.b)}$.`, ...agesLines(p.k, p.g, p.b, x), p.q ? `${A} מבוגר ב־$${p.g}$: $${x} + ${p.g} = ${x + p.g}$` : `${B} בן $${x}$.`, `בדיקה: לפני $${p.b}$ שנים ${B} היה בן $${p.tt}$ ו${A} בן $${p.tt + p.g}$, ו־$${p.tt + p.g} = ${p.k} \\cdot ${p.tt}$.`];
    }
    const [A, B] = STAMPS[p.n];
    return [`נסמן ב־$x$ את הבולים של ${B} בהתחלה.`, ...stampsLines(p.k, p.g, x), [`ל${B} היו $${x}$ בולים.`, `ל${A} היו $${p.k} \\cdot ${x} = ${p.k * x}$ בולים.`, `יחד: $${x} + ${p.k * x} = ${(p.k + 1) * x}$ בולים.`][p.q], `בדיקה: ל${A} נשארו $${p.k * x - p.g}$, ול${B} יש $${x + p.g}$.`];
  },
  hint: (p) => (p.t === 2 ? rectHint(p.g, p.q) : p.t === 0 ? 'נסמנו ב־$x$ את הגיל של הצעיר היום. בן כמה היה כל אחד אז? ולבסוף: על מי שאלו?' : 'נסמנו ב־$x$ את הבולים של מי שיש לו פחות. כמה יש לכל אחד אחרי הנתינה? ולבסוף: על מי שאלו?'),
};

type Class = { k: number; boys: number; q: number }; // k times as many girls as boys; q 0 boys, 1 girls
const classBugs: Record<string, (p: Class) => number | null> = {
  // the relation reversed: boys = k · girls (Clement 1982)
  reversal: (p) => (p.q === 0 ? p.k * p.boys : p.boys),
  // the unknown (the boys) answered when the girls were asked
  'wrong-unknown': (p) => (p.q === 1 ? p.boys : null),
};
const classModel: DiagModel<Class> = {
  params: (rnd) => fair(() => ({ k: rint(rnd, 2, 5), boys: rint(rnd, 3, 8), q: rnd() < 0.6 ? 0 : 1 }), (p) => (p.q ? p.k * p.boys : p.boys), classBugs),
  text: (p) => `בכיתה $${(p.k + 1) * p.boys}$ תלמידים, ויש בה פי $${p.k}$ בנות מבנים. כמה ${p.q ? 'בנות' : 'בנים'} יש בכיתה?`,
  answer: (p) => (p.q ? p.k * p.boys : p.boys),
  bugs: classBugs,
  solution: (p) => [`נסמן ב־$x$ את מספר הבנים. הבנות: $${p.k}x$.`, line('יחד', `x + ${p.k}x = ${(p.k + 1) * p.boys}`), line('מכנסים', `${p.k + 1}x = ${(p.k + 1) * p.boys}`, divOp(p.k + 1)), line(`מחלקים ב־$${p.k + 1}$`, `x = ${p.boys}`), p.q ? `בנות: $${p.k} \\cdot ${p.boys} = ${p.k * p.boys}$` : `יש $${p.boys}$ בנים.`, `בדיקה: $${p.boys} + ${p.k * p.boys} = ${(p.k + 1) * p.boys}$, והבנות פי $${p.k}$ מהבנים.`],
  hint: (p) => `מי יותר, בנים או בנות? נסמנו ב־$x$ את מספר הבנים. כמה בנות יש אז?${p.q ? ' ושימו לב: שאלו על הבנות.' : ''}`,
};

const stair5: StairContent = {
  skill: 'eq:5', topic: 'eq', level: 5, title: 'בעיות מילוליות',
  objectives: [
    'לבחור נעלם ולכתוב במילים מה הוא מייצג.',
    'לבטא את שאר הכמויות בעזרת הנעלם ולבנות משוואה.',
    'לפתור, לבדוק בסיפור ולענות על מה שנשאל.',
  ],
  idea: 'בבעיה מילולית בונים משוואה מהסיפור: נעלם אחד, כל השאר בעזרתו, ושני ביטויים שהסיפור אומר שהם שווים.',
  why: [
    'המשוואה היא תרגום של משפט אחד בסיפור, המשפט שאומר ששני דברים שווים.',
    'בסוף בודקים בסיפור, לא רק במשוואה, ועונים בדיוק על מה שנשאל.',
  ],
  alt: [
    'חושבים על מאזניים: מה שווה למה בסיפור? אחרי שדני נתן $7$ בולים, לשניהם אותו מספר: $2x - 7 = x + 7$.',
    'אפשר לנחש מספר ולבדוק אותו בסיפור. הניחוש מראה מה מחשבים, והמשוואה עושה את אותו החשבון עם $x$.',
  ],
  discover: [
    { kind: 'predict', fig: { type: 'table', head: ['x = ?', 'בהתחלה', 'אחרי הנתינה'], rows: [['רינה', '?', '+7'], ['דני', 'פי 2 מרינה', '−7']] }, text: 'לדני יש פי $2$ בולים מלרינה. דני נתן לרינה $7$ בולים, ועכשיו לשניהם אותו מספר. מה כדאי לסמן ב־$x$?', choices: ['מספר הבולים של רינה בהתחלה', 'מספר הבולים שדני נתן', 'מספר הבולים של שניהם יחד'], answer: 0,
      why: 'בוחרים את הכמות שכל השאר נבנה ממנה. אם לרינה $x$, לדני $2x$.',
      wrongWhy: { 1: 'את זה כבר יודעים: $7$. הנעלם הוא מה שלא יודעים.', 2: 'מזה קשה לבטא כמה היה לכל אחד. נוח לבחור את מה שהכול נבנה ממנו.' } },
    { kind: 'predict', fig: { type: 'table', head: ['', 'בהתחלה'], rows: [['רינה', 'x'], ['דני', '?']] }, text: 'לרינה $x$ בולים. כמה בולים יש לדני?', choices: ['$2x$', '$x + 2$', '$\\dfrac{x}{2}$'], answer: 0,
      why: 'פי $2$ פירושו כפול $2$. בדיקה במספר: אם לרינה $5$, לדני $10$, ו־$2x$ נותן $10$.',
      wrongWhy: { 1: '$x + 2$ הוא $2$ יותר. אם לרינה $5$, לדני היו $7$, לא $10$.', 2: '$\\frac{x}{2}$ נותן לדני פחות מלרינה, אבל לדני יש יותר.' } },
    { kind: 'rule', fig: STAMPS_FIG, text: 'המשוואה אומרת מה שווה למה בסיפור: אחרי הנתינה לשניהם אותו מספר.', display: '2x - 7 = x + 7',
      why: 'דני נתן $7$, ולכן נשאר לו $2x - 7$. רינה קיבלה $7$, ולכן יש לה $x + 7$. הסיפור אומר שהם שווים.' },
    { kind: 'explore', text: 'עוד סיפור: שלוש חבילות זהות ועוד $2$ ק״ג שוקלות כמו חבילה אחת ועוד $8$ ק״ג. זו המשוואה $3x + 2 = x + 8$. כמה שוקלת חבילה?', manip: balance(3, 2, 1, 8), answer: 3,
      hint: 'מה שמורידים מכף אחת, מורידים גם מהשנייה.', success: 'חבילה שוקלת $3$ ק״ג. בדיקה בסיפור: $3 \\cdot 3 + 2 = 11$, וגם $3 + 8 = 11$.' },
    { kind: 'predict', fig: STAMPS_FIG, text: 'בסיפור הבולים יוצא $x = 14$. השאלה הייתה: כמה בולים היו לשניהם יחד בהתחלה?', choices: ['$42$', '$14$', '$21$'], answer: 0,
      why: 'לרינה היו $14$ ולדני $28$, ויחד $42$. $14$ הוא רק מה שהיה לרינה.',
      wrongWhy: { 1: '$14$ הוא $x$, הבולים של רינה. אבל שאלו על שניהם יחד.', 2: '$21$ הוא מה שיש לכל אחד אחרי הנתינה. שאלו על ההתחלה, ועל שניהם יחד.' } },
    { kind: 'rule', fig: { type: 'table', head: ['', 'בהתחלה', 'אחרי הנתינה'], rows: [['רינה', 14, 21], ['דני', 28, 21]] }, text: 'בסוף בודקים בסיפור, ועונים על מה שנשאל.', display: '28 - 7 = 21 = 14 + 7',
      why: 'דני נתן $7$ ונשארו לו $21$, ורינה קיבלה $7$ והגיעה ל־$21$. אחר כך חוזרים לשאלה: היא שאלה על שניהם יחד.' },
    { kind: 'predict', fig: { type: 'table', head: ['מורים', 'תלמידים'], rows: [['m', 't'], [10, '?']] }, text: '"בבית הספר יש פי $6$ תלמידים ממורים." $t$ הוא מספר התלמידים, ו־$m$ מספר המורים. איזו משוואה מתאימה?', choices: ['$t = 6m$', '$6t = m$'], answer: 0,
      why: 'בודקים במספר: אם יש $10$ מורים, יש $60$ תלמידים, ו־$t = 6m$ נותן $60$. ב־$6t = m$ המורים יוצאים יותר מהתלמידים.',
      wrongWhy: { 1: 'עם $m = 12$: מ־$6t = 12$ יוצא $t = 2$, רק שני תלמידים. אבל התלמידים הם הרבים.' } },
    { kind: 'predict', fig: { type: 'table', head: ['בנים', 'בנות', 'יחד'], rows: [['x', '3x', '4x'], ['?', '?', 30]] }, text: 'בכיתה $30$ תלמידים, ויש פי $3$ בנות מבנים. אם יש $x$ בנים, אז $4x = 30$. מה עונים?', choices: ['אין כיתה כזאת: הנתונים לא מתאימים', '$7.5$ בנים', '$7$ בנים'], answer: 0,
      why: 'מ־$4x = 30$ יוצא $x = 7.5$. אבל מספר בנים הוא מספר שלם, ולכן הסיפור לא אפשרי.',
      wrongWhy: { 1: 'חצי בן? מספר תלמידים הוא שלם.', 2: 'עם $7$ בנים יש $21$ בנות, ויחד $28$, לא $30$.' } },
    { kind: 'rule', fig: { type: 'table', head: ['בנים', 'בנות', 'יחד'], rows: [[7, 21, 28], [7.5, 22.5, 30], [8, 24, 32]] }, text: 'הפתרון צריך להתאים גם לסיפור: מספר שלם כשסופרים, וחיובי כשמודדים.',
      why: 'המשוואה לא יודעת שמדובר בתלמידים. אנחנו יודעים, ולכן בודקים.' },
  ],
  examples: [
    { problem: 'לדני יש פי $2$ בולים מלרינה. דני נתן לרינה $7$ בולים, ועכשיו לשניהם אותו מספר. כמה בולים היו לשניהם יחד בהתחלה?', answer: 42, check: 'x + 2*x', vars: { x: 14 },
      steps: [
        { action: 'בוחרים נעלם: $x$ הבולים של רינה בהתחלה.', why: 'לדני פי $2$: $2x$.', result: 'x,\\quad 2x', fig: { type: 'table', head: ['', 'בהתחלה'], rows: [['רינה', 'x'], ['דני', '2x']] } },
        { action: 'בונים משוואה: אחרי הנתינה שניהם שווים.', why: 'דני נתן $7$: $2x - 7$. רינה קיבלה $7$: $x + 7$.', result: '2x - 7 = x + 7', eq: '2*x - 7 = x + 7', fig: STAMPS_FIG },
        { action: 'מחסירים $x$ משני האגפים.', mark: '-x', why: 'כך $x$ נשאר רק באגף שמאל.', result: 'x - 7 = 7', eq: 'x - 7 = 7' },
        { action: 'מוסיפים $7$ לשני האגפים.', mark: '+7', why: 'מבטלים את החיסור של $7$, ו־$x$ לבד.', result: 'x = 14', eq: 'x = 14' },
        { action: 'עונים על השאלה: כמה לשניהם יחד?', why: 'לרינה $14$, ולדני $2 \\cdot 14 = 28$.', result: '14 + 28 = 42', value: '14 + 28' },
        { action: 'בודקים בסיפור.', why: 'אחרי הנתינה: לדני $28 - 7 = 21$, ולרינה $14 + 7 = 21$. שווים.', result: '28 - 7 = 21', calc: { expr: '28 - 7', value: 21 }, fig: { type: 'table', head: ['', 'בהתחלה', 'אחרי הנתינה'], rows: [['רינה', 14, 21], ['דני', 28, 21]] } },
      ] },
    { problem: 'דן מבוגר מיואב ב־$6$ שנים. לפני $4$ שנים, הגיל של דן היה פי $2$ מהגיל של יואב. בן כמה יואב היום?', answer: 10, check: '16 - 6',
      steps: [
        { action: 'נעלם: $x$ הגיל של יואב היום.', why: 'דן מבוגר ב־$6$: $x + 6$.', result: 'x,\\quad x + 6' },
        { action: 'לפני $4$ שנים כל אחד היה צעיר ב־$4$.', why: 'יואב: $x - 4$. דן: $x + 6 - 4 = x + 2$.', result: 'x - 4,\\quad x + 2', fig: { type: 'table', head: ['', 'היום', 'לפני 4 שנים'], rows: [['יואב', 'x', 'x − 4'], ['דן', 'x + 6', 'x + 2']] } },
        { action: 'בונים משוואה.', why: 'אז הגיל של דן היה פי $2$ מהגיל של יואב.', result: 'x + 2 = 2(x - 4)', eq: 'x + 2 = 2*(x - 4)' },
        { action: 'פותחים סוגריים.', why: '$2$ כופל גם את $x$ וגם את $-4$.', result: 'x + 2 = 2x - 8', eq: 'x + 2 = 2*x - 8' },
        { action: 'מחסירים $x$ משני האגפים.', mark: '-x', why: 'ב־$2x$ יש יותר $x$־ים, ולכן הם נשארים באגף ימין.', result: '2 = x - 8', eq: '2 = x - 8' },
        { action: 'מוסיפים $8$ לשני האגפים.', mark: '+8', why: 'כך $x$ לבד באגף ימין.', result: '10 = x', eq: '10 = x' },
        { action: 'הופכים צדדים.', why: '$10 = x$ ו־$x = 10$ אומרים אותו דבר. במחברת כותבים: $x = 10$ (הפכנו צדדים).', result: 'x = 10', eq: 'x = 10' },
        { action: 'בודקים בסיפור.', why: 'היום יואב בן $10$ ודן בן $16$. לפני $4$ שנים: $6$ ו־$12$, ו־$12$ הוא פי $2$ מ־$6$.', fig: { type: 'table', head: ['', 'היום', 'לפני 4 שנים'], rows: [['יואב', 10, 6], ['דן', 16, 12]] }, result: '12 = 2 \\cdot 6', calc: { expr: '2*6', value: 12 } },
      ] },
    // CLASSROOM-8: the class's rectangle, in the class's layout (נתון, צ״ל, the asked side boxed, the found lengths
    // written on the drawing at the end)
    { problem: 'צלעות המלבן הן $x$ ו־$x + 5$ (בס״מ), וההיקף שלו $54$ ס״מ. מה אורכי הצלעות, ומה השטח?', fig: rectFig('x + 5', 'x'),
      answer: 176, answerTex: '\\begin{gathered} x = 11,\\; x + 5 = 16 \\\\ S = 176 \\end{gathered}', check: 'x * (x + 5)', vars: { x: 11 },
      steps: [
        { action: 'נתון: $P = 54$ ס״מ. צ״ל: $x = ?$, $x + 5 = ?$, $S = ?$', why: 'במלבן הצלעות הנגדיות שוות, ולכן בשרטוט הן מסומנות באותם קווים: שתי צלעות $x$ ושתי צלעות $x + 5$.', result: 'x,\\quad x + 5' },
        { action: 'ההיקף הוא סכום ארבע הצלעות.', why: 'שתי צלעות $x$ ושתי צלעות $x + 5$.', result: '2x + 2(x + 5) = 54', eq: '2*x + 2*(x + 5) = 54' },
        { action: 'שלב 1: חוק הפילוג (פותחים סוגריים).', why: '$2$ כופל גם את $x$ וגם את $5$.', result: '2x + 2x + 10 = 54', eq: '2*x + 2*x + 10 = 54' },
        { action: 'שלב 2: פותרים כרגיל. מכנסים משפחות.', why: '$2x + 2x = 4x$.', result: '4x + 10 = 54', eq: '4*x + 10 = 54' },
        { action: 'מחסירים $10$ משני האגפים.', mark: '-10', why: 'כך באגף שמאל נשאר רק $4x$.', result: '4x = 44', eq: '4*x = 44' },
        { action: 'מחלקים ב־$4$.', mark: ':4', why: '$44 : 4 = 11$: הצלע הקצרה $11$ ס״מ.', result: 'x = 11', eq: 'x = 11' },
        { action: 'מציבים בצלע השנייה.', why: 'מסמנים את מה שצריך למצוא, ומציבים בו $x = 11$.', result: '\\boxed{x + 5} = 11 + 5 = 16', calc: { expr: '11 + 5', value: 16 } },
        { action: 'השטח: אורך כפול רוחב. כותבים את האורכים על השרטוט.', why: 'בדיקה: $2 \\cdot 11 + 2 \\cdot 16 = 54$, כמו בנתון.', result: 'S = 16 \\cdot 11 = 176', value: '16 * 11', fig: rectFig('16 ס״מ', '11 ס״מ', { long: 16 / 11 }) },
      ] },
    // the transfer table: the boxes in rows, before and after in columns, the cell after the move simplified in place
    { problem: 'בתיבה א׳ יש פריטים, ובתיבה ב׳ יש $5$ יותר. מעבירים את כל מה שבתיבה א׳ לתיבה ב׳, ועכשיו בתיבה ב׳ $31$ פריטים. כמה פריטים היו בתיבה ב׳ בהתחלה?',
      fig: transferFig(['x', 'x + 5'], ['0', 'x + 5 + x = 2x + 5']), answer: 18, check: 'x + 5', vars: { x: 13 },
      steps: [
        { action: 'בוחרים נעלם: $x$ הפריטים בתיבה א׳ בהתחלה.', why: 'בתיבה ב׳ יש $5$ יותר: $x + 5$. בטבלה כל תיבה בשורה, ולפני ואחרי בעמודות.', result: 'x,\\quad x + 5' },
        { action: 'אחרי ההעברה בתיבה ב׳ מה שהיה בה ועוד מה שעבר.', why: 'בתא של הטבלה מכנסים: $x + 5 + x = 2x + 5$. והסיפור אומר שזה $31$.', result: '2x + 5 = 31', eq: '2*x + 5 = 31' },
        { action: 'מחסירים $5$ משני האגפים.', mark: '-5', why: 'כך $2x$ נשאר לבד.', result: '2x = 26', eq: '2*x = 26' },
        { action: 'מחלקים ב־$2$.', mark: ':2', why: '$26 : 2 = 13$: בתיבה א׳ היו $13$ פריטים.', result: 'x = 13', eq: 'x = 13' },
        { action: 'עונים על מה שנשאל: תיבה ב׳ בהתחלה.', why: '$x$ הוא תיבה א׳. מסמנים את מה ששאלו, ומציבים.', result: '\\boxed{x + 5} = 13 + 5 = 18', value: '13 + 5' },
        { action: 'בודקים בסיפור.', why: 'אחרי ההעברה בתיבה ב׳: $18 + 13 = 31$, כמו בסיפור.', result: '18 + 13 = 31', calc: { expr: '18 + 13', value: 31 } },
      ] },
  ],
  together: [
    { problem: 'שתי חבילות שוקלות יחד $13.5$ ק״ג. חבילה אחת כבדה פי $2$ מהשנייה.', fig: { type: 'fbar', rows: [{ den: 2, shaded: 1, label: 'הקלה' }, { den: 2, shaded: 2, label: 'הכבדה' }] },
      steps: [
        { prompt: 'אם החבילה הקלה שוקלת $x$, כמה שוקלת הכבדה?', choices: [
          { text: '$2x$', ok: true, feedback: 'נכון: פי $2$ הוא כפול $2$.' },
          { text: '$x + 2$', ok: false, feedback: '$x + 2$ הוא $2$ ק״ג יותר. אם הקלה $3$, הכבדה פי $2$ היא $6$, ו־$x + 2$ נותן $5$.' },
          { text: '$\\dfrac{x}{2}$', ok: false, feedback: '$\\frac{x}{2}$ קטן מ־$x$. אבל זו החבילה הכבדה.' },
        ], hints: ['נסו מספר: אם הקלה $3$ ק״ג, כמה הכבדה?', 'פי $2$ מ־$3$ הוא $6$. איזה ביטוי נותן $6$ כש־$x = 3$?'], done: 'הכבדה: $2x$.' },
        { prompt: 'איזו משוואה מתאימה?', choices: [
          { text: '$x + 2x = 13.5$', ok: true, feedback: 'נכון: יחד הן שוקלות $13.5$.' },
          { text: '$2x = 13.5$', ok: false, feedback: '$2x$ היא רק החבילה הכבדה. יחד: $x + 2x$.' },
          { text: '$x \\cdot 2x = 13.5$', ok: false, feedback: '"יחד" הוא חיבור של המשקלים, לא כפל.' },
        ], hints: ['מה הסיפור אומר על שתי החבילות יחד?', 'הקלה ועוד הכבדה: $x + 2x$.'], done: '$3x = 13.5$' },
      ],
      final: { prompt: 'כמה שוקלת החבילה הקלה, בק״ג?', answer: 4.5, check: '13.5 / 3', hints: ['מחלקים את $13.5$ ב־$3$.', '$12 : 3 = 4$, ו־$1.5 : 3 = 0.5$.'] } },
    { problem: 'במשולש ישר־זווית, זווית חדה אחת גדולה מהשנייה ב־$20^\\circ$.', fig: RIGHT_X,
      steps: [
        { prompt: 'מה הסכום של שתי הזוויות החדות?', choices: [
          { text: '$90^\\circ$', ok: true, feedback: 'נכון: $180^\\circ$ פחות הזווית הישרה.' },
          { text: '$180^\\circ$', ok: false, feedback: '$180^\\circ$ הוא הסכום של כל שלוש הזוויות. אחת מהן ישרה, $90^\\circ$.' },
          { text: '$360^\\circ$', ok: false, feedback: 'סכום הזוויות במשולש הוא $180^\\circ$, ואחת מהן ישרה.' },
        ], hints: ['כמה כל הזוויות במשולש יחד? וכמה מהן כבר בזווית הישרה?', '$180 - 90$.'], done: 'שתי החדות יחד: $90^\\circ$.' },
        { prompt: 'אם הזווית הקטנה $x$, איזו משוואה מתאימה?', choices: [
          { text: '$x + x + 20 = 90$', ok: true, feedback: 'נכון: הקטנה $x$, והגדולה $x + 20$.' },
          { text: '$x + 20 = 90$', ok: false, feedback: '$x + 20$ היא רק הזווית הגדולה. צריך גם את הקטנה.' },
          { text: '$x \\cdot 20 = 90$', ok: false, feedback: '"גדולה ב־$20$" הוא חיבור, לא כפל.' },
        ], hints: ['מה הזווית הגדולה, בעזרת $x$?', '$x + 20$. ויחד עם הקטנה: $90$.'], done: '$2x + 20 = 90$' },
      ],
      final: { prompt: 'מה הגודל של הזווית הקטנה, במעלות?', answer: 35, check: '(90 - 20) / 2', hints: ['מחסירים $20$: $2x = 70$.', '$70 : 2$.'] } },
  ],
  diag: storyModel,
  transfer: classModel,
  misconceptions: [
    { id: 'wrong-unknown', title: 'נמצא הנעלם, אבל התשובה לא עונה על מה שנשאל',
      cause: 'אחרי שפותרים את המשוואה מרגישים שסיימנו. אבל $x$ הוא לפעמים רק צעד בדרך לתשובה.',
      explain: ['נראה שעניתם את $x$, אבל שאלו על משהו אחר.', 'בסיפור הבולים $x = 14$ הם הבולים של רינה. השאלה הייתה על שניהם יחד: $14 + 28 = 42$.'],
      remedy: [
        { kind: 'predict', text: 'בסיפור הבולים $x = 14$, ו־$x$ הוא מספר הבולים של רינה בהתחלה. כמה בולים היו לדני בהתחלה?', choices: ['$28$', '$14$'], answer: 0,
          why: 'לדני פי $2$ מרינה: $2 \\cdot 14 = 28$. $14$ הוא של רינה.' },
        { kind: 'rule', text: 'לפני שעונים, קוראים שוב את השאלה: על מה שאלו?', display: 'x = 14:\\quad 2x = 28,\\quad x + 2x = 42',
          why: 'כותבים במילים מה $x$ מייצג, ואז מחשבים ממנו את מה שנשאל.' },
      ] },
    { id: 'partial-dist', title: 'רק האיבר הראשון שבסוגריים נכפל',
      cause: 'בבעיות גיל הסוגריים מופיעים כשמשהו "פי $2$" מגיל של פעם, וקל לכפול רק את $x$.',
      explain: ['נראה ש־$2(x - 4)$ נפתח כ־$2x - 4$.', '"פי $2$ מהגיל לפני $4$ שנים" הוא $2(x - 4) = 2x - 8$: כופלים את כל הגיל, גם את ה־$4$.'],
      prereq: 'eq:4',
      remedy: [
        { kind: 'predict', text: 'בסיפור של דן ויואב מישהו כתב $x + 2 = 2x - 4$, וקיבל שיואב בן $6$. מה מראה הבדיקה בסיפור?', choices: ['לפני $4$ שנים יואב היה בן $2$ ודן בן $8$, ו־$8$ אינו פי $2$ מ־$2$', 'הכול מתאים'], answer: 0,
          why: 'הבדיקה בסיפור תופסת את הטעות. עם $2(x - 4) = 2x - 8$ יוצא $x = 10$: לפני $4$ שנים $6$ ו־$12$, ו־$12$ הוא פי $2$ מ־$6$.' },
        { kind: 'rule', text: 'פי $2$ מגיל שלם: כופלים את כל הסוגריים.', display: '2(x - 4) = 2x - 8',
          why: 'הגיל לפני $4$ שנים הוא $x - 4$, מספר אחד. פי $2$ ממנו כופל את כולו.' },
      ] },
    // CLASSROOM-8: the rectangle, the transfer table and the angles with x
    { id: 'two-sides', title: 'בהיקף נספרו רק שתי צלעות (חצי היקף)',
      cause: 'בשרטוט כתובה צלע אחת מכל סוג, וקל לחבר רק אותן. אבל למלבן ארבע צלעות.',
      explain: ['נראה שבמשוואה של ההיקף נספרו רק שתי צלעות.', 'ההיקף הוא סכום כל ארבע הצלעות: $x + (x + 5) + x + (x + 5)$, כלומר $2x + 2(x + 5)$.'],
      remedy: [
        { kind: 'predict', fig: rectFig('5', '3', { long: 5 / 3 }), text: 'צלעות המלבן $3$ ס״מ ו־$5$ ס״מ. מה ההיקף שלו?', choices: ['$16$ ס״מ', '$8$ ס״מ'], answer: 0,
          why: 'מקיפים את כל המלבן: $3 + 5 + 3 + 5 = 16$. $8$ הוא רק חצי הדרך.' },
        { kind: 'rule', text: 'ההיקף של מלבן: שתי צלעות מכל סוג.', display: 'P = 2x + 2(x + 5)',
          why: 'צלעות נגדיות שוות, ולכן כל צלע שכתובה בשרטוט נספרת פעמיים.' },
      ] },
    { id: 'add-sides', title: 'חיברו את הצלעות במקום לכפול',
      cause: 'היקף ושטח מתבלבלים: בהיקף מחברים את הצלעות, ובשטח כופלים אותן.',
      explain: ['נראה שבשטח חיברתם את שתי הצלעות.', 'השטח של מלבן הוא אורך כפול רוחב: מלבן $16$ על $11$ ס״מ הוא $16 \\cdot 11 = 176$ סמ״ר, ולא $16 + 11$.'],
      remedy: [
        { kind: 'predict', fig: rectFig('5', '3', { long: 5 / 3 }), text: 'כמה ריבועים של $1$ ס״מ על $1$ ס״מ מכסים מלבן $3$ על $5$ ס״מ?', choices: ['$15$', '$8$'], answer: 0,
          why: '$3$ שורות של $5$ ריבועים: $3 \\cdot 5 = 15$ סמ״ר. $3 + 5 = 8$ הוא חצי ההיקף.' },
      ] },
    { id: 'wrong-total', title: 'השתמשו בסכום הזוויות הלא נכון (במשולש $180^\\circ$, במרובע $360^\\circ$)',
      cause: 'סכום הזוויות תלוי בצורה: במשולש $180^\\circ$, ובמרובע $360^\\circ$.',
      explain: ['נראה שהמשוואה נבנתה עם הסכום של צורה אחרת.', 'אלכסון מחלק מרובע לשני משולשים, ולכן סכום הזוויות במרובע $2 \\cdot 180^\\circ = 360^\\circ$.'],
      remedy: [
        { kind: 'predict', text: 'אלכסון מחלק מרובע לשני משולשים. מה סכום הזוויות של המרובע?', choices: ['$360^\\circ$', '$180^\\circ$'], answer: 0,
          why: 'בכל משולש $180^\\circ$, ושני משולשים יחד $360^\\circ$.' },
      ] },
    { id: 'drop-minus', title: 'המינוס שלפני מספר נעלם',
      cause: 'כשמחברים את כל הביטויים, קל לחבר מספר בלי הסימן שלפניו.',
      explain: ['נראה שהמינוס של אחד המספרים נעלם כשחיברתם את הביטויים.', 'ב־$2x - 5^\\circ$ המספר הוא $-5$: $x + 10 + 2x - 5 + 3x + 25 = 6x + 30$.'],
      prereq: 'expr:3',
      remedy: [
        { kind: 'predict', text: 'כמה זה $10 - 5 + 25$?', choices: ['$30$', '$40$'], answer: 0,
          why: 'המינוס שייך ל־$5$: $10 - 5 + 25 = 30$. מי שמחבר $10 + 5 + 25$ מקבל $40$.' },
      ] },
    { id: 'divide-part', title: 'רק חלק מהאיברים חולק ב־$2$',
      cause: 'רוצים להגיע מהר ל־$x$, ומחלקים רק את $2x$ ואת המספר שבאגף השני.',
      explain: ['נראה ש־$2x + 5 = 31$ חולק ב־$2$ רק בחלקו.', 'קודם מחסירים $5$: $2x = 26$, ורק אז מחלקים: $x = 13$.'],
      prereq: 'eq:2',
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $2x + 4 = 10$?', choices: ['$3$', '$1$'], answer: 0,
          why: 'קודם מחסירים $4$: $2x = 6$, ואז $x = 3$. בדיקה: $2 \\cdot 3 + 4 = 10$. $1$ יוצא מ־$x + 4 = 5$, כשרק חלק חולק.' },
      ] },
    { id: 'reversal', title: 'היחס נכתב הפוך',
      cause: 'ב"פי $6$ תלמידים ממורים" ה־$6$ נכתב ליד המילה "תלמידים", כמו במשפט. אבל מי שיש לו פי $6$ הוא הגדול.',
      explain: ['נראה שהיחס נכתב הפוך: הקבוצה הקטנה קיבלה את ה"פי".', 'בודקים במספר: אם יש $10$ מורים, יש $60$ תלמידים. המשוואה הנכונה נותנת יותר תלמידים ממורים.'],
      remedy: [
        { kind: 'predict', text: 'יש $12$ מורים, ויש פי $6$ תלמידים ממורים. כמה תלמידים יש?', choices: ['$72$', '$2$'], answer: 0,
          why: '$6 \\cdot 12 = 72$. התלמידים הם הקבוצה הגדולה, ולכן $t = 6m$.' },
        { kind: 'rule', text: 'בודקים כל משוואה במספר: הקבוצה שיש לה "פי" היא הגדולה.', display: 'm = 12:\\quad t = 6 \\cdot 12 = 72',
          why: 'אם המשוואה נותנת לקבוצה הגדולה מספר קטן, היא הפוכה.' },
      ] },
  ],
};

// ================================================================ stair 6: motion problems (שאלות תנועה)
// Distance = speed × time in units that agree, and the three stories the textbooks teach: meeting, catching up, there
// and back, each with a row per mover and an equation (stage5.md FUNC-3). The rule stays in words, as the class writes
// it: no d, v or t, and no S (in this class S is an area). The models are content/eq.js EQ6 (the critique's eq6: movers
// named by their speed, at most 450 km apart, a catching-up car at most 110 km/h, a walk at most 15 km) and EQ6T (the
// minutes of a train), ported unchanged; each misconception's source is listed there.

type P6 = { k: 'toward' | 'catch' | 'trip'; bike?: boolean; v1: number; v2: number; t?: number; D?: number; h?: number; d?: number; T?: number; q: number };
const eq6: DiagModel<P6> = {
  params: (rnd) => EQ6.params(rnd),
  text: (p) => eq6Text(p),
  answer: (p) => EQ6.answer(p),
  bugs: EQ6.bugs,
  solution: (p) => eq6Solution(p),
  hint: (p) => eq6Hint(p),
};
type P6T = { v: number; t: number };
const eq6T: DiagModel<P6T> = {
  params: (rnd) => EQ6T.params(rnd),
  text: (p) => eq6TText(p),
  answer: (p) => EQ6T.answer(p),
  bugs: EQ6T.bugs,
  solution: (p) => eq6TSolution(p),
  hint: (p) => eq6THint(p),
  unit: 'ק״מ',
};

const MOTION_HEAD = ['', 'מהירות (קמ״ש)', 'זמן (שעות)', 'דרך (ק״מ)'];
/** The class's table: speed, time, distance (a train at 80 km/h for 3 hours). */
const TRAIN: FigSpec = { type: 'table', head: ['מהירות (קמ״ש)', 'זמן (שעות)', 'דרך (ק״מ)'], rows: [[80, 3, 240]] };
/** 60 km/h by the minute: a kilometre a minute. */
const KM_A_MINUTE: FigSpec = { type: 'sgraph', x: { max: 60, step: 10, label: 'זמן', unit: 'דקות' }, y: { max: 60, step: 10, label: 'דרך', unit: 'ק״מ' }, series: [{ pts: [[0, 0], [60, 60]] }] };
/** Two cities 300 km apart, cars at 40 (from the first) and 60 (from the second): they meet after 3 hours, 120 km out. */
const MEET: FigSpec = {
  type: 'sgraph', x: { max: 5, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 300, step: 20, every: 3, label: 'מרחק מהעיר הראשונה', unit: 'ק״מ' },
  series: [{ pts: [[0, 0], [5, 200]], label: 'הראשונה' }, { pts: [[0, 300], [5, 0]], label: 'השנייה', dashed: true }], meet: true,
};
/** The meeting in the class's table: a row per car, the same time x for both. */
const MEET_TABLE: FigSpec = { type: 'table', head: MOTION_HEAD, rows: [['הראשונה', 40, 'x', '40x'], ['השנייה', 60, 'x', '60x']] };
/** A cyclist at 15 km/h, a car 2 hours later at 45 km/h on the same road: the car catches up at hour 3, 45 km out. */
const CATCH: FigSpec = {
  type: 'sgraph', x: { max: 4, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 90, step: 15, label: 'מרחק מנקודת היציאה', unit: 'ק״מ' },
  series: [{ pts: [[0, 0], [4, 60]], label: 'רוכב' }, { pts: [[2, 0], [4, 90]], label: 'מכונית', dashed: true }],
};
/** There at 4 and back at 6, 12 km each way. */
const TRIP_TABLE: FigSpec = { type: 'table', head: MOTION_HEAD, rows: [['הלוך', 4, 3, 12], ['חזור', 6, 2, 12]] };
/** The worked example's two cars, 360 km apart at 70 and 50 km/h: they meet after 3 hours, 210 km from the first city. */
const MEET_360: FigSpec = {
  type: 'sgraph', x: { max: 4, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 360, step: 30, every: 2, label: 'מרחק מהעיר הראשונה', unit: 'ק״מ' },
  series: [{ pts: [[0, 0], [3, 210]], label: 'הראשונה' }, { pts: [[0, 360], [3, 210]], label: 'השנייה', dashed: true }], meet: true,
};
/** The worked example's cyclist at 20 km/h and the car at 80 km/h 3 hours later: it catches up at hour 4, 80 km out. */
const CATCH_80: FigSpec = {
  type: 'sgraph', x: { max: 5, step: 1, label: 'זמן מיציאת הרוכב', unit: 'שעות' }, y: { max: 100, step: 10, every: 2, label: 'מרחק מנקודת היציאה', unit: 'ק״מ' },
  series: [{ pts: [[0, 0], [5, 100]], label: 'רוכב' }, { pts: [[3, 0], [4, 80]], label: 'מכונית', dashed: true }], meet: true,
};

/** 40 minutes at 60 km/h (discover step 2, and the remedies of the two minutes mistakes). */
const minutesStep = {
  kind: 'predict' as const, text: '$40$ דקות במהירות $60$ קמ״ש. כמה ק״מ?', fig: KM_A_MINUTE,
  choices: ['$40$', '$2400$', '$24$'], answer: 0,
  why: '$40$ דקות הן $\\frac{40}{60} = \\frac{2}{3}$ שעה, ו־$60 \\cdot \\frac{2}{3} = 40$. או: $60$ קמ״ש הם ק״מ בכל דקה.',
  wrongWhy: { 1: 'המהירות בק״מ לשעה, אז גם הזמן צריך להיות בשעות, לא בדקות.', 2: '$40$ דקות אינן $0.4$ שעה: בשעה $60$ דקות, לא $100$.' },
};
/** Two cars toward each other (discover step 4, and the rel-speed remedy). */
const meetStep = {
  kind: 'predict' as const, text: 'שתי מכוניות יוצאות באותו רגע משתי ערים במרחק $300$ ק״מ, זו לקראת זו, ב־$40$ וב־$60$ קמ״ש. כעבור כמה שעות ייפגשו?', fig: MEET,
  choices: ['$3$', '$15$', '$5$'], answer: 0,
  why: 'בכל שעה הן מתקרבות $40 + 60 = 100$ ק״מ, ו־$300 : 100 = 3$.',
  wrongWhy: { 1: '$300 : 20$ היה נכון אם הן נוסעות באותו כיוון. כאן הן מתקרבות זו לזו.', 2: '$300 : 60$ הוא כאילו רק אחת נוסעת.' },
};
/** The second car, hour by hour, on the graph you draw (discover step 5, and the rel-speed remedy). */
const meetExplore = {
  kind: 'explore' as const, text: 'הקו של המכונית הראשונה כבר בגרף. סמנו כמה רחוקה המכונית השנייה, שנוסעת ב־$60$ קמ״ש, מהעיר הראשונה בכל שעה.',
  manip: {
    kind: 'graph', x: { max: 4, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 300, step: 60, label: 'מרחק מהעיר הראשונה', unit: 'ק״מ' },
    start: [300, 300, 300, 300, 300], fixed: [0], ref: { pts: [[0, 0], [4, 160]], label: 'הראשונה' },
  } as ManipSpec,
  answer: { mode: 'values', values: [300, 240, 180, 120, 60] },
  hint: 'היא יוצאת $300$ ק״מ מהעיר ומתקרבת $60$ ק״מ בכל שעה.',
  success: 'בשעה $3$ שני הקווים נפגשים, $120$ ק״מ מהעיר הראשונה.',
};
/** A car catches up with a cyclist (discover step 7, and the wrong-unknown remedy). */
const catchStep = {
  kind: 'predict' as const, text: 'רוכב אופניים יצא ב־$15$ קמ״ש. שעתיים אחריו יצאה מכונית באותה דרך ב־$45$ קמ״ש. כעבור כמה שעות מיציאתה תשיג אותו?', fig: CATCH,
  choices: ['$1$', '$0.5$', '$3$'], answer: 0,
  why: 'כשמשיגים, שניהם עברו אותה דרך: $45x = 15(x + 2)$, ולכן $x = 1$. הפער של $30$ ק״מ נסגר ב־$30$ קמ״ש.',
  wrongWhy: { 1: '$30 : 60$ מחבר את המהירויות, אבל הם נוסעים באותו כיוון.', 2: '$3$ שעות עברו מיציאת הרוכב. השאלה מיציאת המכונית.' },
};
/** There and back: the average speed (discover step 8, and the mean-speed remedy). */
const tripStep = {
  kind: 'predict' as const, text: 'הלכו $12$ ק״מ ב־$4$ קמ״ש, וחזרו באותה דרך ב־$6$ קמ״ש. מה המהירות הממוצעת?', fig: TRIP_TABLE,
  choices: ['$4.8$ קמ״ש', '$5$ קמ״ש'], answer: 0,
  why: '$24$ ק״מ ב־$3 + 2 = 5$ שעות: $24 : 5 = 4.8$. בקצב האיטי הולכים יותר זמן, ולכן הוא שוקל יותר מהמהיר.',
  wrongWhy: { 1: '$5$ הוא הממוצע של $4$ ו־$6$, אבל הזמנים שונים: $3$ שעות הלוך ורק $2$ חזור. מהירות ממוצעת היא כל הדרך חלקי כל הזמן.' },
};

const stair6: StairContent = {
  skill: 'eq:6', topic: 'eq', level: 6, title: 'שאלות תנועה',
  objectives: [
    'להשתמש בדרך = מהירות × זמן, כשהזמן והמהירות באותן יחידות.',
    'לפתור שאלת תנועה בטבלה ובמשוואה: מפגש, השגה, הלוך וחזור.',
    'להבחין מתי מחברים מהירויות ומתי מחסירים.',
  ],
  idea: 'דרך = מהירות × זמן. בשאלת תנועה בונים טבלה, שורה לכל נוסע, ומחפשים מה שווה בסיפור: הדרך, או הזמן.',
  why: [
    '$60$ קמ״ש הם $60$ ק״מ בכל שעה, ולכן ב־$3$ שעות $180$ ק״מ.',
    'כשנעים זה לקראת זה, כל אחד סוגר חלק מהמרחק: בכל שעה המרחק קטן בסכום המהירויות. כשאחד משיג את השני, הפער נסגר בהפרש המהירויות.',
  ],
  alt: ['דמיינו שעון עצר: בכל שעה מסמנים על הכביש איפה כל אחד. איפה שהסימנים נפגשים, הם נפגשים.'],
  discover: [
    { kind: 'say', text: 'רכבת נוסעת $80$ קמ״ש במשך $3$ שעות, ועוברת $240$ ק״מ: דרך = מהירות × זמן.', fig: { ...TRAIN, anim: true } as FigSpec },
    minutesStep,
    { kind: 'rule', text: 'דרך = מהירות × זמן, באותן יחידות. מכאן זמן = דרך : מהירות, ומהירות = דרך : זמן.', fig: TRAIN,
      why: 'מהירות של $80$ קמ״ש אומרת $80$ ק״מ בכל שעה. ב־$3$ שעות: $3$ פעמים $80$. ואם הזמן בדקות, קודם הופכים אותו לשעות.' },
    meetStep,
    meetExplore,
    { kind: 'rule', text: 'שאלת תנועה בטבלה: שורה לכל נוסע, עמודות מהירות, זמן ודרך. מה ששווה בסיפור הוא המשוואה.', fig: MEET_TABLE, display: '40x + 60x = 300',
      why: 'כאן הזמן של שתיהן $x$, והסיפור אומר שיחד הן עוברות את כל $300$ הק״מ. לכן $100x = 300$, ו־$x = 3$.' },
    catchStep,
    tripStep,
  ],
  examples: [
    { problem: 'שתי מכוניות יוצאות באותו רגע משתי ערים במרחק $360$ ק״מ, זו לקראת זו, ב־$70$ וב־$50$ קמ״ש. כעבור כמה שעות ייפגשו?', answer: 3, check: '360/(70+50)',
      steps: [
        { action: 'טבלה: הזמן של שתיהן $x$, הדרכים $70x$ ו־$50x$.', why: 'יחד הן עוברות את כל המרחק בין הערים.', result: '70x + 50x = 360', eq: '70*x + 50*x = 360', fig: { type: 'table', head: MOTION_HEAD, rows: [['הראשונה', 70, 'x', '70x'], ['השנייה', 50, 'x', '50x']] } },
        { action: 'מכנסים.', why: 'בכל שעה הן מתקרבות $70 + 50 = 120$ ק״מ.', result: '120x = 360', eq: '120*x = 360', calc: { expr: '70+50', value: 120 } },
        { action: 'מחלקים ב־$120$.', mark: ':120', why: 'כך נשאר $x$ לבד.', result: 'x = 3', value: '360/120' },
        { action: 'בודקים.', why: 'בשלוש שעות הראשונה עוברת $70 \\cdot 3 = 210$ ק״מ, והשנייה $50 \\cdot 3 = 150$. יחד $360$, כל המרחק.', fig: MEET_360, result: '210 + 150 = 360', calc: { expr: '70*3 + 50*3', value: 360 } },
      ] },
    { problem: 'רוכב אופניים יצא ב־$20$ קמ״ש. כעבור $3$ שעות יצאה אחריו מכונית ב־$80$ קמ״ש. כעבור כמה שעות מיציאתה תשיג אותו?', answer: 1, check: '20*3/(80-20)',
      steps: [
        { action: 'הזמן של המכונית $x$, של הרוכב $x + 3$; הדרכים שוות.', why: 'הרוכב יצא $3$ שעות קודם, וכשהמכונית משיגה אותו שניהם באותו מקום.', result: '80x = 20(x + 3)', eq: '80*x = 20*(x + 3)' },
        { action: 'פותחים סוגריים.', why: '$20$ כופל גם את $x$ וגם את $3$.', result: '80x = 20x + 60', eq: '80*x = 20*x + 60', fig: { type: 'table', head: MOTION_HEAD, rows: [['רוכב', 20, 'x + 3', '20(x + 3)'], ['מכונית', 80, 'x', '80x']] } },
        { action: 'מחסירים $20x$.', mark: '-20x', why: 'בכל שעה המכונית סוגרת $80 - 20 = 60$ ק״מ מהפער.', result: '60x = 60', eq: '60*x = 60', calc: { expr: '80-20', value: 60 } },
        { action: 'מחלקים ב־$60$.', mark: ':60', why: 'הפער של $60$ ק״מ נסגר ב־$60$ קמ״ש.', result: 'x = 1', value: '60/60' },
        { fig: CATCH_80, action: 'עונים על השאלה: מיציאת המכונית.', why: '$x$ הוא הזמן של המכונית: שעה אחת. הרוכב נסע עד אז $1 + 3 = 4$ שעות, ושניהם עברו $80$ ק״מ.', result: '20 \\cdot 4 = 80 \\cdot 1', calc: { expr: '20*4', value: 80 } },
      ] },
    { problem: 'הלכו ב־$4$ קמ״ש וחזרו באותה דרך ב־$6$ קמ״ש, ובסך הכול $5$ שעות. מה אורך הדרך?', answer: 12, check: '5*4*6/(4+6)',
      steps: [
        { action: 'הדרך $x$; זמן הלוך $\\frac{x}{4}$, זמן חזור $\\frac{x}{6}$.', why: 'זמן = דרך : מהירות, ויחד $5$ שעות.', result: '\\frac{x}{4} + \\frac{x}{6} = 5', eq: 'x/4 + x/6 = 5', fig: { type: 'table', head: MOTION_HEAD, rows: [['הלוך', 4, 'x : 4', 'x'], ['חזור', 6, 'x : 6', 'x']] } },
        { action: 'כופלים ב־$12$.', mark: '\\cdot 12', why: '$12$ מתחלק גם ב־$4$ וגם ב־$6$, וכל איבר נכפל, גם ה־$5$.', result: '3x + 2x = 60', eq: '3*x + 2*x = 60' },
        { action: 'מכנסים ומחלקים ב־$5$.', mark: ':5', why: '$3x + 2x = 5x$.', result: 'x = 12', value: '60/5', calc: { expr: '3+2', value: 5 } },
        { action: 'בודקים.', why: 'הלוך $12 : 4 = 3$ שעות, חזור $12 : 6 = 2$ שעות, ויחד $5$.', result: '3 + 2 = 5', calc: { expr: '12/4 + 12/6', value: 5 }, fig: TRIP_TABLE },
      ] },
  ],
  together: [
    { problem: 'שני רוכבי אופניים יוצאים זה לקראת זה משני כפרים במרחק $54$ ק״מ, ב־$10$ וב־$8$ קמ״ש. כעבור כמה שעות ייפגשו?',
      fig: { type: 'table', head: MOTION_HEAD, rows: [['הראשון', 10, 'x', '10x'], ['השני', 8, 'x', '8x']] },
      steps: [
        { prompt: 'בכמה ק״מ הם מתקרבים בכל שעה?', choices: [
          { text: '$18$', ok: true, feedback: 'נכון: כל אחד סוגר חלק מהמרחק, $10 + 8 = 18$ ק״מ בשעה.' },
          { text: '$2$', ok: false, feedback: '$2$ הוא הפרש המהירויות. כשנעים זה לקראת זה, מחברים.' },
          { text: '$10$', ok: false, feedback: 'גם השני נוסע: מתקרבים מהר יותר.' },
        ], hints: ['בשעה אחת הראשון עובר $10$ ק״מ. וכמה עובר השני?', 'שניהם מקטינים את המרחק ביניהם: $10 + 8$.'], done: 'בכל שעה הם מתקרבים $18$ ק״מ.' },
      ],
      final: { prompt: 'כעבור כמה שעות ייפגשו?', answer: 3, check: '54/(10+8)', hints: ['כמה פעמים $18$ ק״מ נכנסים ב־$54$ ק״מ?', '$54 : 18$.'] } },
    { problem: 'אוטובוס יצא ב־$60$ קמ״ש. כעבור שעה יצאה אחריו מכונית ב־$90$ קמ״ש. כעבור כמה שעות מיציאתה תשיג אותו?',
      fig: { type: 'table', head: MOTION_HEAD, rows: [['אוטובוס', 60, '?', '?'], ['מכונית', 90, 'x', '90x']] },
      steps: [
        { prompt: 'הזמן של המכונית $x$ שעות. כמה שעות נסע האוטובוס עד שהמכונית השיגה אותו?', choices: [
          { text: '$x + 1$', ok: true, feedback: 'נכון: הוא יצא שעה לפני המכונית.' },
          { text: '$x - 1$', ok: false, feedback: 'האוטובוס יצא קודם, ולכן נסע יותר זמן, לא פחות.' },
          { text: '$1$', ok: false, feedback: 'שעה אחת נסע לבד, ואחר כך עוד $x$ שעות יחד עם המכונית.' },
        ], hints: ['מי יצא קודם, האוטובוס או המכונית?', 'האוטובוס נסע את כל הזמן של המכונית, ועוד שעה.'], done: 'האוטובוס נסע $x + 1$ שעות.' },
        { prompt: 'מה המשוואה?', choices: [
          { text: '$90x = 60(x + 1)$', ok: true, feedback: 'נכון: כשהמכונית משיגה, שניהם עברו אותה דרך.' },
          { text: '$90x + 60x = 60$', ok: false, feedback: 'הם נוסעים באותו כיוון: שוות הדרכים, לא סכומן.' },
          { text: '$90x = 60x$', ok: false, feedback: 'האוטובוס נסע שעה יותר: $x + 1$.' },
        ], hints: ['מה הדרך של המכונית, ומה הדרך של האוטובוס?', 'המכונית: $90x$. האוטובוס: $60(x + 1)$. ברגע ההשגה הן שוות.'], done: '$90x = 60(x + 1)$, כלומר $30x = 60$.' },
      ],
      final: { prompt: 'כעבור כמה שעות מיציאתה המכונית תשיג את האוטובוס?', answer: 2, check: '60*1/(90-60)', hints: ['פותחים סוגריים: $90x = 60x + 60$.', '$30x = 60$.'] } },
  ],
  diag: eq6,
  transfer: eq6T,
  words: ['מהירות', 'זמן', 'דרך', 'קמ״ש', 'מפגש', 'השגה', 'הלוך וחזור', 'מהירות ממוצעת'],
  misconceptions: [
    { id: 'rel-speed', title: 'חיברו מהירויות במקום לחסר, או חיסרו במקום לחבר',
      cause: 'מהירות נראית כמו מספר שמחברים תמיד.',
      explain: ['זה לקראת זה: כל אחד סוגר חלק מהמרחק, ולכן מחברים. אותו כיוון: המהיר סוגר את הפער רק בהפרש.', 'שתי מכוניות ב־$40$ וב־$60$ קמ״ש זו לקראת זו מתקרבות $100$ ק״מ בשעה. אם אחת רודפת אחרי השנייה, הפער נסגר רק $20$ ק״מ בשעה.'],
      remedy: [meetStep, meetExplore] },
    { id: 'wrong-unknown', title: 'נמצא הנעלם, אבל התשובה לא עונה על מה שנשאל',
      cause: 'בשאלת השגה יש שני זמנים, ושל מי שיצא קודם ארוך יותר. קל לענות את הזמן הלא נכון.',
      explain: ['נראה שעניתם כמה זמן נסע מי שיצא קודם. השאלה הייתה מיציאת המכונית.', 'אם $x$ הוא הזמן של המכונית, התשובה היא $x$ עצמו. $x + 2$ הוא הזמן של הרוכב.'],
      remedy: [catchStep,
        { kind: 'rule', text: 'לפני שעונים, קוראים שוב: מאיזה רגע סופרים? הזמן של המכונית הוא $x$, ושל מי שיצא קודם $x$ ועוד הזמן שהקדים.', fig: CATCH, display: 'x = 1,\\quad x + 2 = 3',
          why: 'המכונית נסעה שעה אחת. הרוכב נסע עד אז $3$ שעות. השאלה שאלה על המכונית.' }] },
    { id: 'mean-speed', title: 'השתמשו בממוצע של שתי המהירויות, אבל הזמנים שונים',
      cause: '"ממוצע" נשמע כמו חיבור וחלוקה בשתיים.',
      explain: ['מהירות ממוצעת היא כל הדרך חלקי כל הזמן, לא הממוצע של שתי המהירויות.', 'הלוך ב־$4$ וחזור ב־$6$: בקצב האיטי הולכים יותר זמן, ולכן הממוצע יוצא $4.8$ ולא $5$.'],
      remedy: [tripStep,
        { kind: 'rule', text: 'מהירות ממוצעת: כל הדרך חלקי כל הזמן.', fig: TRIP_TABLE, display: '\\frac{12 + 12}{3 + 2} = 4.8',
          why: 'כשהזמנים שונים, כל מהירות שוקלת לפי הזמן שלה. רק כשהזמנים שווים הממוצע של המהירויות נכון.' }] },
    { id: 'minutes-as-hours', title: 'השתמשו בדקות כאילו הן שעות',
      cause: 'המהירות בק״מ לשעה, אבל הזמן נתון בדקות, וקל לכפול את המספרים כמו שהם.',
      explain: ['קמ״ש הם ק״מ בשעה. כדי לכפול, גם הזמן צריך להיות בשעות.', '$40$ דקות הן $\\frac{40}{60}$ שעה, ולכן ב־$60$ קמ״ש עוברים $40$ ק״מ, לא $2400$.'],
      remedy: [minutesStep,
        { kind: 'rule', text: 'דקות הופכים לשעות: מחלקים ב־$60$.', fig: KM_A_MINUTE, display: '\\frac{40}{60} = \\frac{2}{3}',
          why: 'בשעה $60$ דקות, ולכן $40$ דקות הן $\\frac{2}{3}$ שעה. עכשיו כופלים: $60 \\cdot \\frac{2}{3} = 40$.' }] },
    { id: 'decimal-minutes', title: 'כתבו דקות כשבר עשרוני של שעה, כאילו בשעה $100$ דקות',
      cause: 'בשעה $60$ דקות, לא $100$, ולכן $40$ דקות הן לא $0.4$ שעה.',
      explain: ['נראה שכתבתם את הדקות כעשרוני, כאילו בשעה $100$ דקות.', 'חצי שעה היא $30$ דקות, ו־$0.5$ שעה, לא $0.3$. $40$ דקות הן $\\frac{2}{3}$ שעה.'],
      remedy: [minutesStep,
        { kind: 'rule', text: 'בשעה $60$ דקות, לא $100$: $30$ דקות הן חצי שעה, $0.5$.', fig: KM_A_MINUTE, display: '\\frac{30}{60} = 0.5',
          why: 'השבר של שעה הוא הדקות חלקי $60$. רק אם בשעה היו $100$ דקות, $40$ דקות היו $0.4$.' }] },
    { id: 'formula-flip', title: 'חילקו במקום לכפול: דרך היא מהירות כפול זמן',
      cause: 'שלושת הגדלים מתערבבים, ולא ברור מה כופלים ומה מחלקים.',
      explain: ['דרך = מהירות × זמן. מחלקים רק כשמחפשים זמן או מהירות.', 'בחצי שעה ב־$60$ קמ״ש עוברים חצי מ־$60$ ק״מ, $30$, ולא $60 : \\frac{1}{2} = 120$.'],
      remedy: [
        { kind: 'predict', text: 'רכבת נוסעת $60$ קמ״ש במשך חצי שעה. כמה ק״מ היא עוברת?', fig: TRAIN, choices: ['$30$', '$120$'], answer: 0,
          why: 'דרך = מהירות × זמן: $60 \\cdot \\frac{1}{2} = 30$. בחצי שעה עוברים פחות מבשעה, לא יותר.',
          wrongWhy: { 1: '$120$ יוצא מחלוקה: $60 : \\frac{1}{2}$. אבל בחצי שעה עוברים חצי מ־$60$, לא פי שניים.' } },
        { kind: 'rule', text: 'דרך = מהירות × זמן, והזמן בשעות. בודקים: בפחות משעה עוברים פחות ממהירות של שעה.', fig: TRAIN, display: '60 \\cdot \\frac{1}{2} = 30',
          why: 'מהירות היא ק״מ בכל שעה. בחלק משעה עוברים את אותו חלק מהק״מ.' }] },
  ],
};

// ================================================================ stair 7: equations with denominators and proportion
// An equation with denominators is cleared by multiplying every term of both sides by a common denominator; a numerator
// of two terms is a bracket, and so is the minus before a fraction; a proportion is solved by multiplying by both
// denominators, also with x in a denominator; every answer is checked in the original (stage5.md FUNC-4). Written in
// words where the class's slash marks (CLASSROOM-7) would go, except the one display of the rule. The models are
// content/eq.js EQ7 (the critique's eq7) and EQ7T (the spec's eq7T), ported unchanged; the sources are listed there.

type P7 = { k: number; a?: number; b?: number; L?: number; c?: number; x: number; q?: number; p?: number; s?: number; r?: number };
const eq7: DiagModel<P7> = {
  params: (rnd) => EQ7.params(rnd),
  text: () => 'פתרו את המשוואה.',
  display: (p) => eq7Show(p),
  answer: (p) => EQ7.answer(p),
  bugs: EQ7.bugs,
  solution: (p) => eq7Solution(p),
  hint: (p) => eq7Hint(p),
};
type P7T = { k: number; a: number; b?: number; L?: number; c: number; x: number };
const eq7T: DiagModel<P7T> = {
  params: (rnd) => EQ7T.params(rnd),
  text: (p) => eq7TText(p),
  answer: (p) => EQ7T.answer(p),
  bugs: EQ7T.bugs,
  solution: (p) => eq7TSolution(p),
  hint: (p) => eq7THint(p),
  unit: 'ש״ח',
};

/** A half and a third of the same amount, one bar each. */
const HALF_THIRD: FigSpec = { type: 'fbar', rows: [{ den: 2, shaded: 1, label: 'חצי' }, { den: 3, shaded: 1, label: 'שליש' }] };
/** The same half and third in sixths: 3 of 6 parts and 2 of 6. */
const SIXTHS: FigSpec = { type: 'fbar', rows: [{ den: 6, shaded: 3, label: 'חצי' }, { den: 6, shaded: 2, label: 'שליש' }] };

/** Which number clears both denominators (discover step 2, and the add-across remedy). */
const clearStep = {
  kind: 'predict' as const, text: 'במה כדאי לכפול את שני האגפים כדי שלא יישארו מכנים?', fig: HALF_THIRD, display: '\\frac{x}{2} + \\frac{x}{3} = 150',
  choices: ['$6$', '$5$', '$2$'], answer: 0,
  why: '$6$ מתחלק גם ב־$2$ וגם ב־$3$.',
  wrongWhy: { 1: '$5$ הוא סכום המכנים. כפל ב־$5$ לא מבטל את המכנה $2$: $\\frac{5x}{2}$ עדיין שבר.', 2: 'כפל ב־$2$ מבטל רק את המכנה $2$: $\\frac{2x}{3}$ נשאר שבר.' },
};
/** Every term times 6, the 10 too (discover step 4, and the lcd-partial remedy). */
const everyTermStep = {
  kind: 'predict' as const, text: 'כופלים את שני האגפים ב־$6$. מה מקבלים?', display: '\\frac{x}{2} + \\frac{x}{3} = 10', fig: { type: 'fbar', den: 6, shaded: 0 } as FigSpec,
  choices: ['$3x + 2x = 60$', '$3x + 2x = 10$', '$x + x = 60$'], answer: 0,
  why: 'כל איבר נכפל ב־$6$, גם ה־$10$. אז $5x = 60$ ו־$x = 12$.',
  wrongWhy: { 1: 'ה־$10$ לא הוכפל, והאיזון נשבר: יוצא $x = 2$, ו־$\\frac{2}{2} + \\frac{2}{3}$ אינו $10$.', 2: 'גם המכנים נעלמו, אבל $\\frac{x}{2}$ כפול $6$ הוא $3x$, לא $x$.' },
};
/** The rule, with the class's slash mark (discover step 5, and the lcd-partial remedy). */
const clearRule = {
  kind: 'rule' as const, text: 'כופלים כל איבר בשני האגפים במכנה המשותף, ואז פותרים כרגיל.', fig: SIXTHS,
  display: '\\frac{x}{2} + \\frac{x}{3} = 10 \\;/\\cdot 6 \\quad\\Rightarrow\\quad 3x + 2x = 60',
  why: 'כפל של שני האגפים באותו מספר שומר על האיזון. חצי הוא $3$ שישיות, ושליש הוא $2$ שישיות.',
};
/** A numerator of two terms is a bracket (discover step 6, and the partial-dist remedy). */
const bracketStep = {
  kind: 'predict' as const, text: 'מה $x$?', display: '\\frac{x + 4}{3} = 5', fig: { type: 'machine', inX: 'x + 4', rule: ': 3', outY: 5 } as FigSpec,
  choices: ['$11$', '$3$', '$19$'], answer: 0,
  why: '$x + 4 = 15$, ולכן $x = 11$. כל המונה, $x + 4$, מתחלק ב־$3$.',
  wrongWhy: { 1: '$3$ יוצא כשמחלקים רק את $x$: $\\frac{x}{3} + 4 = 5$.', 2: '$19$ יוצא כשמעבירים את $4$ בלי להפוך את הפעולה.' },
};
/** The minus before a fraction is a minus before brackets (discover step 7, and the minus-bracket remedy). */
const minusStep = {
  kind: 'predict' as const, text: 'מה השורה הבאה?', display: '\\frac{x + 1}{2} - \\frac{x - 3}{4} = 3 \\;/\\cdot 4', fig: { type: 'tiles', px: 0, nx: 1, p1: 3, n1: 0 } as FigSpec,
  choices: ['$2(x + 1) - (x - 3) = 12$', '$2(x + 1) - x - 3 = 12$'], answer: 0,
  why: 'המינוס לפני השבר הוא מינוס לפני סוגריים: $-(x - 3) = -x + 3$. ואז $x = 7$.',
  wrongWhy: { 1: 'כך המינוס הפך רק את $x$, ויוצא $13$ במקום $7$.' },
};
/**
 * x in the denominator: a proportion (discover step 8). The two fractions side by side in a table, numerator and
 * denominator: the spec's bar of twelve twentieths would show the 20 asked for, and would not name x.
 */
const xDenStep = {
  kind: 'predict' as const, text: 'מה $x$?', display: '\\frac{12}{x} = \\frac{3}{5}', fig: { type: 'table', head: ['', 'מונה', 'מכנה'], rows: [['השבר עם x', 12, 'x'], ['השבר השני', 3, 5]] } as FigSpec,
  choices: ['$20$', '$7.2$'], answer: 0,
  why: 'כופלים את שני האגפים ב־$5x$: $60 = 3x$, ולכן $x = 20$. בדיקה: $\\frac{12}{20} = \\frac{3}{5}$.',
  wrongWhy: { 1: '$7.2$ הוא $\\frac{3}{5}$ מ־$12$, אבל $x$ במכנה: $\\frac{12}{7.2}$ אינו $\\frac{3}{5}$.' },
};
/** Cut the bar so that a half and a third both fall on lines (discover step 3, and the add-across remedy). */
const commonExplore = {
  kind: 'explore' as const, text: 'חלקו את הפס כך שגם חצי וגם שליש ייפלו על קווים.',
  manip: { kind: 'fbar', start: { den: 1, shaded: 0 }, marks: [1 / 2, 1 / 3] } as ManipSpec, answer: { mode: 'common', of: [2, 3] },
  hint: 'נסו מספר חלקים שמתחלק ב־$2$ וגם ב־$3$.',
  success: '$6$ חלקים: חצי הם $3$ חלקים, ושליש $2$.',
};

const stair7: StairContent = {
  skill: 'eq:7', topic: 'eq', level: 7, title: 'משוואות עם מכנים ופרופורציה',
  objectives: [
    'להיפטר מהמכנים: כופלים כל איבר בשני האגפים במכנה משותף.',
    'לזכור שמונה עם שני איברים הוא כמו סוגריים, גם כשיש מינוס לפני השבר.',
    'לפתור פרופורציה, גם כש־$x$ במכנה, ולבדוק בהצבה.',
  ],
  idea: 'במשוואה עם מכנים כופלים את שני האגפים, כל איבר, במכנה משותף. המונה כולו נכפל, כמו סוגריים.',
  why: [
    'כפל של שני האגפים באותו מספר שומר על האיזון, כמו בכל משוואה.',
    '$\\frac{x + 4}{3}$ הוא $(x + 4) : 3$: כל המונה מתחלק.',
  ],
  alt: ['$\\frac{x}{2} + \\frac{x}{3}$ הוא חצי ועוד שליש של אותו דבר: $\\frac{5}{6}$ ממנו.'],
  discover: [
    { kind: 'say', text: 'חצי מהכסף ועוד שליש ממנו הם $150$ ש״ח: $\\frac{x}{2} + \\frac{x}{3} = 150$. בסוף השלב נדע שהיו $180$ ש״ח.', fig: HALF_THIRD },
    clearStep,
    commonExplore,
    everyTermStep,
    clearRule,
    bracketStep,
    minusStep,
    xDenStep,
  ],
  examples: [
    { problem: 'פתרו את המשוואה.', display: '\\frac{x}{4} + \\frac{x}{6} = 5', answer: 12, check: '5*12/5',
      steps: [
        { action: 'המכנה המשותף של $4$ ו־$6$: $12$.', why: '$12$ מתחלק גם ב־$4$ וגם ב־$6$, והוא הקטן ביותר כזה.', result: '\\frac{x}{4} + \\frac{x}{6} = 5', eq: 'x/4 + x/6 = 5', fig: xBars(12, [[3, '\\frac{x}{4}'], [2, '\\frac{x}{6}']]) },
        { action: 'כופלים כל איבר ב־$12$.', mark: '\\cdot 12', why: '$\\frac{x}{4}$ כפול $12$ הוא $3x$, ו־$\\frac{x}{6}$ כפול $12$ הוא $2x$. גם $5$ נכפל: $60$.', result: '3x + 2x = 60', eq: '3*x + 2*x = 60' },
        { action: 'מכנסים.', why: '$3x + 2x = 5x$.', result: '5x = 60', eq: '5*x = 60' },
        { action: 'מחלקים ב־$5$.', mark: ':5', why: 'כך נשאר $x$ לבד.', result: 'x = 12', value: '60/5' },
        { action: 'בודקים במשוואה המקורית.', why: '$12 : 4 = 3$ ו־$12 : 6 = 2$, ויחד $5$.', result: '3 + 2 = 5', calc: { expr: '12/4 + 12/6', value: 5 } },
      ] },
    { problem: 'פתרו את המשוואה.', display: '\\frac{x - 2}{3} = \\frac{x + 4}{5}', answer: 11, check: '(10+12)/2',
      steps: [
        { action: 'כופלים את שני האגפים ב־$15$; כל מונה בסוגריים.', mark: '\\cdot 15', why: '$15$ מתחלק ב־$3$ וב־$5$. השבר שמכנהו $3$ נכפל ב־$5$, וזה שמכנהו $5$ נכפל ב־$3$.', result: '5(x - 2) = 3(x + 4)', eq: '5*(x - 2) = 3*(x + 4)' },
        { action: 'פותחים סוגריים.', why: 'המספר שלפני הסוגריים כופל כל איבר בתוכם.', result: '5x - 10 = 3x + 12', eq: '5*x - 10 = 3*x + 12' },
        { action: 'מחסירים $3x$ ומוסיפים $10$ לשני האגפים.', why: 'כך $x$ נשאר רק באגף אחד.', result: '2x = 22', eq: '2*x = 22' },
        { action: 'מחלקים ב־$2$.', mark: ':2', why: '$22 : 2 = 11$.', result: 'x = 11', value: '22/2' },
        { action: 'בודקים בשורה שאחרי הכפל.', why: '$5 \\cdot 11 - 10 = 45$, וגם $3 \\cdot 11 + 12 = 45$.', result: '45 = 45', calc: { expr: '5*11 - 10', value: 45 }, fig: sides('5x \u2212 10', '3x + 12', [11], (x) => [5 * x - 10, 3 * x + 12]) },
        { action: 'ובמשוואה המקורית.', why: '$\\frac{9}{3} = 3$ ו־$\\frac{15}{5} = 3$: שני האגפים שווים.', result: '3 = 3', calc: { expr: '(11+4)/5', value: 3 } },
      ] },
    { problem: 'פתרו את המשוואה.', display: '\\frac{18}{x} = \\frac{3}{4}', answer: 24, check: '18*4/3',
      steps: [
        { action: 'כופלים את שני האגפים ב־$4x$.', why: '$\\frac{18}{x}$ כפול $4x$ הוא $18 \\cdot 4 = 72$, ו־$\\frac{3}{4}$ כפול $4x$ הוא $3x$.', result: '72 = 3x', eq: '72 = 3*x', calc: { expr: '18*4', value: 72 } },
        { action: 'מחלקים ב־$3$.', mark: ':3', why: '$72 : 3 = 24$.', result: 'x = 24', value: '72/3' },
        { action: 'בודקים.', why: '$\\frac{18}{24}$ מצטמצם ב־$6$ ל־$\\frac{3}{4}$.', result: '\\frac{18}{24} = \\frac{3}{4}', calc: { expr: '18/24', value: 0.75 }, fig: { type: 'fbar', rows: [{ den: 24, shaded: 18, label: '\\frac{18}{24}' }, { den: 4, shaded: 3, label: '\\frac{3}{4}' }] } },
      ] },
  ],
  together: [
    { problem: 'פתרו את המשוואה.', display: '\\frac{x}{3} - \\frac{x}{5} = 4',
      steps: [
        { prompt: 'במה כופלים?', choices: [
          { text: '$15$', ok: true, feedback: 'נכון: $15$ מתחלק גם ב־$3$ וגם ב־$5$.' },
          { text: '$8$', ok: false, feedback: '$8$ הוא סכום המכנים. צריך מספר שמתחלק בשניהם.' },
          { text: '$2$', ok: false, feedback: '$2$ הוא ההפרש. כפל ב־$2$ לא מבטל את המכנים $3$ ו־$5$.' },
        ], hints: ['איזה מספר מתחלק גם ב־$3$ וגם ב־$5$?', 'הכפולות של $5$: $5$, $10$, $15$. איזו מהן מתחלקת ב־$3$?'], done: 'כופלים ב־$15$: $5x - 3x = 60$.', fig: xBars(15, [[5, '\\frac{x}{3}'], [3, '\\frac{x}{5}']]) },
      ],
      final: { prompt: 'מה $x$?', answer: 30, check: '4*15/2', hints: ['$5x - 3x = 2x$.', '$2x = 60$.'] } },
    { problem: 'פתרו את המשוואה.', display: '\\frac{x + 2}{4} = \\frac{x - 1}{3}',
      steps: [
        { prompt: 'מה מקבלים אחרי הכפל ב־$12$?', choices: [
          { text: '$3(x + 2) = 4(x - 1)$', ok: true, feedback: 'נכון: כל שבר נכפל, וכל המונה שלו בסוגריים.' },
          { text: '$3x + 2 = 4x - 1$', ok: false, feedback: 'כל המונה נכפל: $3(x + 2) = 3x + 6$.' },
          { text: '$4(x + 2) = 3(x - 1)$', ok: false, feedback: '$12$ חלקי $4$ הוא $3$: השבר שמכנהו $4$ נכפל ב־$3$.' },
        ], hints: ['$12 : 4 = 3$ ו־$12 : 3 = 4$. במה נכפל כל שבר?', 'כל מונה נכפל כולו, כמו סוגריים.'], done: '$3(x + 2) = 4(x - 1)$, כלומר $3x + 6 = 4x - 4$.' },
      ],
      final: { prompt: 'מה $x$?', answer: 10, check: '6+4', hints: ['מחסירים $3x$ ומוסיפים $4$ לשני האגפים.', '$6 + 4 = x$.'] } },
    { problem: 'פתרו את המשוואה.', display: 'x + \\frac{x}{3} = 8', fig: xBars(3, [[3, 'x'], [1, '\\frac{x}{3}']]),
      steps: [
        { prompt: 'כופלים את שני האגפים ב־$3$. מה מקבלים?', choices: [
          { text: '$3x + x = 24$', ok: true, feedback: 'נכון: כל איבר נכפל ב־$3$.' },
          { text: '$3x + x = 8$', ok: false, feedback: 'גם $8$ נכפל ב־$3$: כל איבר, בשני האגפים.' },
          { text: '$x + x = 24$', ok: false, feedback: 'גם $x$ הוא איבר: $3 \\cdot x = 3x$.' },
        ], hints: ['כל איבר בשני האגפים נכפל ב־$3$.', '$x$ כפול $3$ הוא $3x$, $\\frac{x}{3}$ כפול $3$ הוא $x$, ו־$8$ כפול $3$ הוא $24$.'], done: '$4x = 24$.' },
      ],
      final: { prompt: 'מה $x$?', answer: 6, check: '24/4', hints: ['$3x + x = 4x$.', '$4x = 24$.'] } },
  ],
  diag: eq7,
  transfer: eq7T,
  words: ['מכנה משותף', 'כפל שני האגפים', 'מונה', 'פרופורציה', 'משתנה במכנה', 'בדיקה בהצבה'],
  misconceptions: [
    { id: 'lcd-partial', title: 'כפלו במכנה המשותף רק חלק מהאיברים',
      cause: 'מתמקדים בשברים ושוכחים את המספר שבאגף השני.',
      explain: ['כופלים כל איבר בשני האגפים, גם את המספר שאין לו מכנה.', 'ב־$\\frac{x}{2} + \\frac{x}{3} = 10$ כפול $6$ יוצא $3x + 2x = 60$. אם ה־$10$ לא נכפל, יוצא $x = 2$, וזה לא פותר את המשוואה.'],
      remedy: [everyTermStep, clearRule,
        { kind: 'predict', text: 'כופלים את שני האגפים ב־$3$. מה מקבלים?', display: 'x + \\frac{x}{3} = 8', choices: ['$3x + x = 24$', '$3x + x = 8$'], answer: 0,
          why: 'כל איבר נכפל ב־$3$: גם $x$ וגם $8$. אז $4x = 24$ ו־$x = 6$.',
          wrongWhy: { 1: 'ה־$8$ לא הוכפל. בדיקה: $x = 2$ נותן $2 + \\frac{2}{3}$, לא $8$.' } }] },
    { id: 'partial-dist', title: 'כפלו רק את $x$ שבמונה, ולא את כל המונה',
      cause: 'קו השבר לא נראה כמו סוגריים.',
      explain: ['מונה עם שני איברים הוא כמו סוגריים: כשכופלים את השבר, כל המונה נכפל.', 'ב־$\\frac{x + 2}{4} = \\frac{x - 1}{3}$ כפול $12$ יוצא $3(x + 2) = 4(x - 1)$, כלומר $3x + 6 = 4x - 4$, ולא $3x + 2 = 4x - 1$.'],
      prereq: 'eq:4',
      remedy: [bracketStep,
        { kind: 'predict', text: 'מה מקבלים אחרי הכפל ב־$12$?', display: '\\frac{x + 2}{4} = \\frac{x - 1}{3}', choices: ['$3(x + 2) = 4(x - 1)$', '$3x + 2 = 4x - 1$'], answer: 0,
          why: 'כל המונה נכפל: $3(x + 2) = 3x + 6$ ו־$4(x - 1) = 4x - 4$. אז $x = 10$, ובדיקה: $\\frac{12}{4} = 3$ וגם $\\frac{9}{3} = 3$.',
          wrongWhy: { 1: 'כך נכפל רק $x$. יוצא $x = 3$, ובדיקה: $\\frac{5}{4}$ אינו $\\frac{2}{3}$.' } }] },
    { id: 'minus-bracket', title: 'מינוס לפני סוגריים הפך רק את הסימן הראשון',
      cause: 'המינוס כתוב לפני השבר, רחוק מהמספר שבסוף המונה.',
      explain: ['מינוס לפני שבר הוא מינוס לפני סוגריים: הוא הופך את הסימן של כל איבר במונה.', 'ב־$\\frac{x + 1}{2} - \\frac{x - 3}{4} = 3$ כפול $4$ יוצא $2(x + 1) - (x - 3) = 12$, ו־$-(x - 3) = -x + 3$.'],
      remedy: [minusStep,
        { kind: 'rule', text: 'מינוס לפני שבר הוא מינוס לפני סוגריים: אחרי הכפל, המונה נשאר בסוגריים.', fig: { type: 'tiles', px: 0, nx: 1, p1: 3, n1: 0 } as FigSpec, display: '-(x - 3) = -x + 3',
          why: 'מורידים את כל המונה, $x - 3$: גם את $x$ וגם את ה־$-3$ שבו, ולכן $+3$.' }] },
    { id: 'add-across', title: 'חיברו מונה עם מונה ומכנה עם מכנה',
      cause: 'חיבור של שברים נראה כמו חיבור של מספרים זה ליד זה.',
      explain: ['$\\frac{x}{2} + \\frac{x}{3}$ הוא חצי ועוד שליש של אותו דבר, $\\frac{5}{6}$ ממנו, ולא $\\frac{2x}{5}$.', 'במשוואה לא מחברים את השברים בכלל: כופלים כל איבר במכנה משותף, והמכנים נעלמים.'],
      prereq: 'frac:3',
      remedy: [commonExplore, clearRule] },
    // the first two stairs' mistakes, on the last line this stair's equations end on (content/eq.js lastStepBugs): the
    // coefficient subtracted (5x = 60), and on a proportion, whose last line always has a minus, the sign lost
    { id: 'sign', title: 'הפתרון יצא עם הסימן ההפוך',
      cause: 'בפרופורציה, אחרי הכפל בשני המכנים, נשארים מינוסים בשני האגפים, וקל לאבד אחד מהם.',
      explain: ['נראה שהסימן של הפתרון התהפך.', 'ב־$\\frac{x + 1}{2} = \\frac{x - 1}{3}$ כופלים ב־$6$: $3(x + 1) = 2(x - 1)$, כלומר $3x + 3 = 2x - 2$. מחסירים $2x$ ו־$3$: $x = -5$.'],
      prereq: 'signed:1',
      remedy: [
        { kind: 'predict', text: 'מה הפתרון של $\\frac{x + 1}{2} = \\frac{x - 1}{3}$?', choices: ['$-5$', '$5$'], answer: 0,
          why: 'בדיקה: $\\frac{-5 + 1}{2} = -2$, וגם $\\frac{-5 - 1}{3} = -2$. ואילו ב־$x = 5$ יוצא $3$ מול $\\frac{4}{3}$.' },
        { kind: 'rule', text: 'כל מספר עובר משורה לשורה עם הסימן שלפניו, ובסוף בודקים במשוואה המקורית.', display: '\\begin{aligned} 3x + 3 &= 2x - 2 \\qquad /{-2x} \\\\ x + 3 &= -2 \\qquad /{-3} \\\\ x &= -5 \\end{aligned}',
          why: '$-2 - 3$ הוא $-5$: יורדים עוד $3$ מתחת לאפס. הבדיקה במשוואה המקורית מראה אם הסימן נכון.' },
      ] },
    { id: 'sub-coef', title: 'המקדם הוחסר במקום לחלק בו',
      cause: 'אחרי שהמכנים נעלמים נשארת שורה כמו $5x = 60$, ו־$5x$ נקרא כמו $5 + x$.',
      explain: ['נראה שבצעד האחרון המקדם הוחסר.', 'ב־$\\frac{x}{2} + \\frac{x}{3} = 10$ כופלים ב־$6$ ומכנסים: $5x = 60$. $5x$ הוא $5 \\cdot x$, ולכן $x = 12$, ולא $60 - 5 = 55$.'],
      prereq: 'expr:1',
      remedy: [
        { kind: 'predict', text: 'מ־$\\frac{x}{3} - \\frac{x}{5} = 4$ יצא $2x = 60$. מה $x$?', choices: ['$30$', '$58$'], answer: 0,
          why: 'בדיקה: $2 \\cdot 30 = 60$, ובמשוואה המקורית $30 : 3 - 30 : 5 = 10 - 6 = 4$. ואילו $2 \\cdot 58 = 116$, לא $60$.' },
        { kind: 'rule', text: '$2x$ הוא כפל, ולכן מחלקים ב־$2$.', display: '2x = 60 \\;\\Rightarrow\\; x = 60 : 2 = 30',
          why: 'מספר צמוד ל־$x$ כופל אותו, גם אחרי שהמכנים נעלמו. כפל מבטלים בחילוק.' },
      ] },
  ],
};

export const EQ: StairContent[] = [stair1, stair2, stair3, stair4, stair5, stair6, stair7];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/eq.js names them all). */
export const CATS_EQ: Record<string, string> = {};
export { oneStepModel, twoStepModel, bothModel, brkModel, storyModel, eq6, eq6T, eq7, eq7T };
