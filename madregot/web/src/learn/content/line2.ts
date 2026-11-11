// The linear function (פונקציה קווית), grade 8, stairs 5–8: the equation of a line, meeting the axes, the
// triangle with the axes, and the point where two lines meet. One idea carries all four: a point is on a line
// exactly when its coordinates satisfy the equation. Substituting a known point finds b; substituting the zero
// of an axis finds where the line crosses it; two lines meet where the same x gives the same y.
// Teaching content: see MADREGOT2.md (content conventions) and content/signed.ts (the quality bar).
import type { DiagModel, FigSpec, ManipSpec, StairContent } from '../types';
import { rint, rnz } from '../expr';
// @ts-ignore: plain JS helpers shared with the exercise generators
import { T } from '@/content/util.js';
// @ts-ignore: plain JS, the same TeX the linear generators print
import { lineTex } from '@/content/linear.js';

// ---------------------------------------------------------------- helpers

// The teaching steps' drawings (STUDENT-8): the plane with the line, its points and where it meets the axes or another
// line. A step that asks for a meeting point or an intercept draws the lines without writing it.
type Plane = Extract<FigSpec, { type: 'coord' }>;
const plane = (more: Omit<Plane, 'type'>): FigSpec => ({ type: 'coord', range: 6, ...more });
const P = (label: string, x: number, y: number) => ({ x, y, label });
/** y = 3x - 2 and y = -2x + 8, which meet at (2, 4) (stair 8). */
const TWO_LINES = [{ m: 3, b: -2, label: 'y = 3x − 2' }, { m: -2, b: 8, label: 'y = −2x + 8' }];
const TWO = plane({ lines: TWO_LINES });

/** mx as TeX: x, -x, 3x, -2x. */
const mx = (m: number, v = 'x') => (m === 1 ? v : m === -1 ? `-${v}` : `${T(m)}${v}`);
/** A free term after another term: " + 3", " - 3", or nothing for 0. */
const plus = (v: number) => (v === 0 ? '' : v > 0 ? ` + ${T(v)}` : ` - ${T(-v)}`);
/** The right side of y = mx + b. */
const rhs = (m: number, b: number) => `${mx(m)}${plus(b)}`;
const abs = Math.abs;
/** A small table of values in TeX: the x row, then one row per function. */
const tab = (xs: number[], rows: [string, number[]][]) =>
  `\\begin{array}{c|${'c'.repeat(xs.length)}} x & ${xs.map((v) => T(v)).join(' & ')} \\\\ \\hline ${rows.map(([h, vs]) => `${h} & ${vs.map((v) => T(v)).join(' & ')}`).join(' \\\\ ')} \\end{array}`;

// interactive objects (the shapes the generators use: content/linear.js predictPoint, buildLine; grade7.js rectangle)
const onLine = (m: number, b: number, label = 'P'): ManipSpec => ({ kind: 'plot', range: 6, label, start: null, line: { m, b } });
const dot = (label = 'P'): ManipSpec => ({ kind: 'plot', range: 6, label, start: null });
const builder = (): ManipSpec => ({ kind: 'line', range: 6, start: { m: 1, b: 0 } });
/** The rectangle O, B(x0, 0), C, A(0, b): the student puts C, the corner that completes it. */
const rectangle = (x0: number, b: number): ManipSpec => ({
  kind: 'plot', range: 6, label: 'C', start: null,
  shape: [{ label: 'B', at: [x0, 0] }, { label: 'O', at: [0, 0] }, { label: 'A', at: [0, b] }],
});

// ================================================================ stair 5: the equation of a line

type EqP = { k: number; m: number; b: number; x1: number; x2: number }; // k 0: slope and a point, 1: two points
const y1Of = (p: { m: number; b: number; x1: number }) => p.m * p.x1 + p.b;
const y2Of = (p: { m: number; b: number; x2: number }) => p.m * p.x2 + p.b;
/** b = y1 − m·x1, written as the student computes it. */
const bLine = (y1: number, mx1: number, b: number) => `$b = ${T(y1)} ${mx1 > 0 ? '-' : '+'} ${abs(mx1)} = ${T(b)}$`;

const equationModel: DiagModel<EqP> = {
  params: (rnd) => {
    for (;;) {
      const m = rnz(rnd, -4, 4); const b = rint(rnd, -8, 8);
      const x1 = rnz(rnd, -5, 5); const x2 = x1 + rint(rnd, 1, 4);
      if (abs(m) === 1 && rnd() < 0.7) continue; // slope 1 hides the substitution (and makes two bugs agree)
      const p = { k: rnd() < 0.5 ? 0 : 1, m, b, x1, x2 };
      if (abs(y1Of(p)) <= 15 && abs(y2Of(p)) <= 15) return p;
    }
  },
  text: (p) => (p.k === 0
    ? `ישר עם שיפוע $${T(p.m)}$ עובר דרך הנקודה $(${T(p.x1)}, ${T(y1Of(p))})$. המשוואה שלו היא $y = ${mx(p.m)} + b$. מה $b$?`
    : `ישר עובר דרך הנקודות $A(${T(p.x1)}, ${T(y1Of(p))})$ ו־$B(${T(p.x2)}, ${T(y2Of(p))})$. כתבו את המשוואה שלו בצורה $y = mx + b$. מה $b$?`),
  answer: (p) => p.b,
  bugs: {
    // b read off the point: "b is the y of the point"
    'b-is-y': (p) => y1Of(p),
    // y1 = m·x1 + b, and m·x1 crossed to the other side keeping its sign: b = y1 + m·x1
    'move-no-flip': (p) => y1Of(p) + p.m * p.x1,
    // subtracted in the wrong order (m·x1 − y1): b with the opposite sign
    'b-sign': (p) => (p.b !== 0 ? -p.b : null),
    // the point's coordinates substituted in each other's place: x1 = m·y1 + b
    swap: (p) => p.x1 - p.m * y1Of(p),
  },
  solution: (p) => {
    const y1 = y1Of(p); const y2 = y2Of(p); const out: string[] = [];
    if (p.k === 1) out.push(`קודם השיפוע: $m = \\frac{${T(y2)} - ${T(y1, true)}}{${T(p.x2)} - ${T(p.x1, true)}}${p.x2 - p.x1 === 1 ? '' : ` = \\frac{${T(y2 - y1)}}{${T(p.x2 - p.x1)}}`} = ${T(p.m)}$`);
    out.push(`מציבים את $(${T(p.x1)}, ${T(y1)})$ ב־$y = ${mx(p.m)} + b$: $${T(y1)} = ${T(p.m)} \\cdot ${T(p.x1, true)} + b = ${T(p.m * p.x1)} + b$`);
    out.push(bLine(y1, p.m * p.x1, p.b));
    out.push(`המשוואה: $${lineTex(p.m, p.b)}$`);
    if (p.k === 1) out.push(`בדיקה בנקודה $B$: $${T(p.m)} \\cdot ${T(p.x2, true)}${plus(p.b)} = ${T(y2)}$`);
    return out;
  },
  hint: (p) => (p.k === 0
    ? 'הנקודה על הישר, ולכן היא מקיימת את המשוואה: מציבים את ה־$x$ שלה במקום $x$ ואת ה־$y$ שלה במקום $y$, ונשאר נעלם אחד, $b$.'
    : 'קודם מוצאים את $m$ משתי הנקודות. אחר כך מציבים נקודה אחת ב־$y = mx + b$ ופותרים את $b$.'),
};

type EqStory = { k: number; m: number; b: number; x1: number; x2: number }; // k 0: a candle, 1: a water tank, 2: a table
const equationStory: DiagModel<EqStory> = {
  // the same skill when the start (x = 0) was never measured: a candle that burns, a tank that fills, a table
  params: (rnd) => {
    for (;;) {
      const k = rint(rnd, 0, 2);
      if (k === 0) {
        const m = -rint(rnd, 1, 3); const b = rint(rnd, 16, 30); const x1 = rint(rnd, 1, 3); const x2 = x1 + rint(rnd, 2, 4);
        if (m * x2 + b >= 2) return { k, m, b, x1, x2 };
      } else if (k === 1) {
        const m = 5 * rint(rnd, 2, 6); const b = 10 * rint(rnd, 2, 12); const x1 = rint(rnd, 2, 5); const x2 = x1 + rint(rnd, 2, 5);
        return { k, m, b, x1, x2 };
      } else {
        const m = rnz(rnd, -4, 4); const b = rnz(rnd, -8, 8); const x1 = rnz(rnd, -3, 4); const x2 = x1 + rint(rnd, 1, 3);
        if (abs(m * x1 + b) <= 20 && abs(m * x2 + b) <= 20) return { k, m, b, x1, x2 };
      }
    }
  },
  text: (p) => {
    const y1 = y1Of(p); const y2 = y2Of(p);
    if (p.k === 0) return `נר נשרף בקצב קבוע. ${p.x1 === 1 ? 'שעה אחת' : `$${p.x1}$ שעות`} אחרי שהדליקו אותו הגובה שלו $${y1}$ ס״מ, ואחרי $${p.x2}$ שעות הגובה שלו $${y2}$ ס״מ. מה היה הגובה של הנר כשהדליקו אותו?`;
    if (p.k === 1) return `ממלאים מיכל בקצב קבוע, אבל כבר היו בו מים לפני שהתחילו. אחרי $${p.x1}$ דקות יש בו $${y1}$ ליטר, ואחרי $${p.x2}$ דקות $${y2}$ ליטר. כמה ליטר היו במיכל בהתחלה?`;
    return 'בטבלה שני ערכים של פונקציה קווית $y = mx + b$. מה $b$?';
  },
  display: (p) => (p.k === 2 ? tab([p.x1, p.x2], [['y', [y1Of(p), y2Of(p)]]]) : ''),
  answer: (p) => p.b,
  bugs: {
    // the first measurement taken as the start
    'b-is-y': (p) => y1Of(p),
    // went from the measurement the wrong way: further on instead of back to x = 0
    'move-no-flip': (p) => y1Of(p) + p.m * p.x1,
    // in a bare table nothing says b must be positive: subtracted in the wrong order
    'b-sign': (p) => (p.k === 2 ? -p.b : null),
  },
  solution: (p) => {
    const y1 = y1Of(p); const y2 = y2Of(p);
    const out = [`הקצב הוא השיפוע: $m = \\frac{${T(y2)} - ${T(y1, true)}}{${T(p.x2)} - ${T(p.x1, true)}} = ${T(p.m)}$`];
    out.push(`ההתחלה היא $x = 0$, כלומר $b$. מציבים את $(${T(p.x1)}, ${T(y1)})$: $${T(y1)} = ${T(p.m)} \\cdot ${T(p.x1, true)} + b$`);
    out.push(bLine(y1, p.m * p.x1, p.b));
    if (p.k === 0) out.push(`הנר היה בגובה $${p.b}$ ס״מ: בכל שעה הוא התקצר ב־$${-p.m}$, ו־$${p.x1}$ שעות אחורה מוסיפות $${-p.m * p.x1}$ ס״מ.`);
    else if (p.k === 1) out.push(`בהתחלה היו במיכל $${p.b}$ ליטר.`);
    else out.push(`הפונקציה: $${lineTex(p.m, p.b)}$`);
    return out;
  },
  hint: (p) => (p.k === 2
    ? 'קודם $m$: השינוי ב־$y$ חלקי השינוי ב־$x$. אחר כך מציבים עמודה אחת ב־$y = mx + b$.'
    : 'מוצאים בכמה הכמות משתנה בכל יחידת זמן (השיפוע). ההתחלה היא $x = 0$: מציבים מדידה אחת ב־$y = mx + b$ ומוצאים את $b$.'),
};

const stair5: StairContent = {
  skill: 'line:5', topic: 'line', level: 5, title: 'משוואת ישר',
  objectives: [
    'למצוא את $b$ כשנתונים השיפוע ונקודה אחת על הישר.',
    'למצוא את משוואת הישר דרך שתי נקודות: קודם $m$, אחר כך $b$.',
    'לבדוק את המשוואה בהצבה של נקודה.',
  ],
  idea: 'נקודה שנמצאת על ישר מקיימת את המשוואה שלו. לכן מציבים אותה ב־$y = mx + b$, וה־$b$ החסר יוצא מהמשוואה.',
  why: [
    'השיפוע לבד קובע רק את הכיוון: יש אינסוף ישרים מקבילים עם אותו $m$, אחד לכל $b$. הנקודה בוחרת מהם ישר אחד.',
    'ישר הוא כל הנקודות שמקיימות את המשוואה שלו. אם $(2, 3)$ על הישר, אז כשמציבים $x = 2$ חייבים לקבל $y = 3$.',
    'אחרי ההצבה נשאר במשוואה נעלם אחד, $b$, ופותרים אותה כמו כל משוואה.',
  ],
  alt: [
    'הולכים על הישר עד ציר $y$. מהנקודה $(2, 3)$ על ישר עם שיפוע $2$ זזים שני צעדים שמאלה. בכל צעד שמאלה יורדים $2$, ולכן מגיעים לגובה $3 - 2 \\cdot 2 = -1$. זה $b$.',
    'במילים: $b$ הוא ה־$y$ של הנקודה, פחות מה שהשיפוע הוסיף בדרך מ־$x = 0$ עד ה־$x$ שלה: $b = y_1 - m x_1$.',
    'חשבו על מונית: השיפוע הוא המחיר לכל קילומטר, ו־$b$ הוא מחיר הפתיחה, מה שמשלמים לפני שנוסעים מטר.',
  ],
  discover: [
    { kind: 'say', fig: plane({ lines: [{ m: 3, b: 1 }], anim: true }), mood: 'happy', text: 'עד עכשיו קיבלתם משוואה ומצאתם את הישר. עכשיו נלך הפוך: מקבלים ישר, וכותבים את המשוואה שלו.' },
    { kind: 'say', fig: plane({ lines: [{ m: 3, b: 1 }], riseRun: { x: -2, run: 1 }, points: [P('(0, b)', 0, 1)], words: [{ at: [-3.6, -3.5], text: 'm = 3' }] }), text: 'המשוואה היא $y = mx + b$. כדי לכתוב אותה צריך שני מספרים: השיפוע $m$ ו־$b$.' },
    { kind: 'predict', fig: plane({ lines: [{ m: 2, b: 3 }], riseRun: { x: -2, run: 1 } }), text: 'ידוע שהשיפוע של ישר הוא $2$. כמה ישרים יש עם שיפוע $2$?',
      choices: ['אחד', 'שניים', 'אינסוף'], answer: 2,
      why: 'לכל $b$ יש ישר אחר: $y = 2x$, $y = 2x + 1$, $y = 2x - 5$ וכן הלאה. כולם מקבילים. השיפוע לבד לא מספיק, צריך גם נקודה.',
      wrongWhy: { 0: 'נסו: $y = 2x + 1$ ו־$y = 2x + 3$ שניהם עם שיפוע $2$, והם ישרים שונים.' } },
    { kind: 'explore', text: 'בנו ישר עם שיפוע $2$ שעובר דרך הנקודה $(2, 3)$. קודם קבעו $m = 2$, ואז הזיזו את $b$ עד שהישר עובר בנקודה.',
      manip: builder(), answer: { m: 2, b: -1 },
      hint: 'קבעו $m = 2$. עכשיו הזיזו את הנקודה שעל ציר $y$ למטה, עד שהישר עובר במשבצת שבה $x = 2$ ו־$y = 3$.',
      success: 'רק $b = -1$ מתאים: $y = 2x - 1$. בדיקה: כש־$x = 2$ מקבלים $2 \\cdot 2 - 1 = 3$.' },
    { kind: 'say', mood: 'thinking', text: 'על הרשת אפשר לנסות ולתקן. אבל הנקודה $(7, 30)$ בכלל לא נכנסת למסך. צריך דרך לחשב את $b$.' },
    { kind: 'predict', fig: plane({ lines: [{ m: 2, b: -1 }], points: [P('(2, 3)', 2, 3)] }), text: 'הנקודה $(2, 3)$ נמצאת על הישר $y = 2x + b$. איזו משוואה נכונה?',
      choices: ['$3 = 2 \\cdot 2 + b$', '$2 = 2 \\cdot 3 + b$', '$b = 3$'], answer: 0,
      why: 'נקודה על הישר מקיימת את המשוואה: ה־$x$ שלה נכנס במקום $x$, וה־$y$ שלה במקום $y$. מכאן $3 = 4 + b$, ולכן $b = -1$, כמו בבנייה.',
      wrongWhy: { 1: 'כאן $x$ ו־$y$ התחלפו. בנקודה $(2, 3)$ ה־$x$ הוא $2$ וה־$y$ הוא $3$.', 2: '$3$ הוא ה־$y$ כש־$x = 2$. $b$ הוא ה־$y$ רק כש־$x = 0$.' } },
    { kind: 'rule', fig: plane({ lines: [{ m: 2, b: -1 }], points: [P('(2, 3)', 2, 3), P('(0, b)', 0, -1)], words: [{ at: [-3.4, 2.6], text: 'y = 2x − 1', tone: 'brand' }] }), text: 'שיפוע ונקודה: מציבים את הנקודה $(x_1, y_1)$ ב־$y = mx + b$ ופותרים את $b$.', display: 'y_1 = m \\cdot x_1 + b',
      why: 'נקודה נמצאת על הישר בדיוק כשהשיעורים שלה מקיימים את המשוואה. $m$ ידוע, ולכן אחרי ההצבה נשאר נעלם אחד: $b$.' },
    { kind: 'predict', fig: plane({ points: [P('(−1, 4)', -1, 4), P('(2, −2)', 2, -2)] }), text: 'עכשיו נתונות רק שתי נקודות, $(-1, 4)$ ו־$(2, -2)$. מה עושים קודם?',
      choices: ['מוצאים את $m$ משתי הנקודות', 'מציבים נקודה ומוצאים את $b$', 'לוקחים $b = 4$, ה־$y$ של הנקודה הראשונה'], answer: 0,
      why: 'בהצבה יש עכשיו שני נעלמים, $m$ ו־$b$. לכן קודם השיפוע: $m = \\frac{-2 - 4}{2 - (-1)} = \\frac{-6}{3} = -2$. משם זה כמו שיפוע ונקודה.',
      wrongWhy: { 1: 'בלי $m$ ההצבה נותנת $4 = m \\cdot (-1) + b$: משוואה עם שני נעלמים.', 2: '$4$ הוא ה־$y$ כש־$x = -1$, לא כש־$x = 0$.' } },
    { kind: 'explore', text: 'זה הישר דרך $(-1, 4)$ ו־$(2, -2)$, עם שיפוע $-2$. שימו את הנקודה שבה הוא חותך את ציר $y$.', display: 'y = -2x + b',
      manip: onLine(-2, 2), answer: [0, 2],
      hint: 'על ציר $y$ מתקיים $x = 0$. מ־$(-1, 4)$ זזים צעד אחד ימינה על הישר: יורדים $2$.',
      success: 'הישר חותך את ציר $y$ ב־$(0, 2)$, ולכן $b = 2$. גם החישוב נותן את זה: $4 = -2 \\cdot (-1) + b = 2 + b$, ו־$b = 2$.' },
    { kind: 'rule', fig: plane({ lines: [{ m: -2, b: 2 }], points: [P('(−1, 4)', -1, 4), P('(2, −2)', 2, -2), P('(0, b)', 0, 2)], riseRun: { x: -1, run: 3 }, words: [{ at: [-3.5, -3.5], text: 'm = −2' }] }), text: 'שתי נקודות: מוצאים את $m$ משתיהן, מציבים אחת מהן ומוצאים את $b$, ובודקים בשנייה.', display: 'm = \\frac{y_2 - y_1}{x_2 - x_1}, \\qquad y_1 = m x_1 + b',
      why: 'דרך שתי נקודות עובר ישר אחד בלבד. אם המשוואה נכונה, גם הנקודה השנייה מקיימת אותה, וזו בדיקה בחינם: $-2 \\cdot 2 + 2 = -2$.' },
  ],
  examples: [
    { problem: 'ישר עם שיפוע $-3$ עובר דרך הנקודה $(2, -1)$. מצאו את $b$ וכתבו את משוואת הישר.', display: 'm = -3, \\quad (2, -1)', answer: 5, check: '-1 - (-3) * 2',
      steps: [
        { action: 'כותבים את המשוואה עם השיפוע הידוע.', why: 'את $m$ כבר יודעים. חסר רק $b$.', result: 'y = -3x + b' },
        { action: 'מציבים את הנקודה: $x = 2$, $y = -1$, ומחשבים את הכפל.', why: 'הנקודה על הישר, ולכן השיעורים שלה מקיימים את המשוואה.', result: '-1 = -3 \\cdot 2 + b = -6 + b', calc: { expr: '-3 * 2', value: -6 } },
        { action: 'מוסיפים $6$ לשני האגפים.', why: 'כך $b$ נשאר לבד: $-6 + 6 = 0$. מה שעושים באגף אחד עושים גם בשני.', result: 'b = -1 + 6 = 5', value: '-1 + 6' },
        { action: 'כותבים את המשוואה ובודקים בנקודה.', why: 'אם $b$ נכון, הצבה של $x = 2$ מחזירה את $y = -1$.', result: 'y = -3x + 5, \\quad -3 \\cdot 2 + 5 = -1', calc: { expr: '-3 * 2 + 5', value: -1 } },
      ] },
    { problem: 'במונית משלמים מחיר פתיחה קבוע ועוד מחיר קבוע לכל קילומטר. נסיעה של $4$ ק״מ עלתה $30$ ש״ח, ונסיעה של $10$ ק״מ עלתה $60$ ש״ח. כתבו את משוואת המחיר. מה מחיר הפתיחה?', answer: 10, check: '30 - (60 - 30) / (10 - 4) * 4',
      steps: [
        { action: 'מתרגמים לנקודות: $x$ הוא מספר הקילומטרים, $y$ המחיר בש״ח.', why: 'מחיר שגדל בקצב קבוע הוא פונקציה קווית, וכל נסיעה היא נקודה על הישר.', result: '(4, 30), \\quad (10, 60)' },
        { action: 'מוצאים את השיפוע.', why: 'השיפוע הוא כמה המחיר עולה על כל קילומטר נוסף: $30$ ש״ח על $6$ ק״מ.', result: 'm = \\frac{60 - 30}{10 - 4} = \\frac{30}{6} = 5', calc: { expr: '(60 - 30) / (10 - 4)', value: 5 } },
        { action: 'מציבים את $(4, 30)$ ב־$y = 5x + b$.', why: 'הנסיעה הראשונה היא נקודה על הישר.', result: '30 = 5 \\cdot 4 + b = 20 + b', calc: { expr: '5 * 4', value: 20 } },
        { action: 'מחסירים $20$ משני האגפים.', why: '$b$ הוא המחיר כש־$x = 0$: מחיר הפתיחה, לפני שנסעתם מטר.', result: 'b = 30 - 20 = 10', value: '30 - 20' },
        { action: 'כותבים את המשוואה ובודקים בנסיעה השנייה.', why: 'גם $(10, 60)$ חייבת לקיים את המשוואה.', result: 'y = 5x + 10, \\quad 5 \\cdot 10 + 10 = 60', calc: { expr: '5 * 10 + 10', value: 60 } },
      ] },
  ],
  together: [
    { problem: 'נמצא יחד את משוואת הישר שעובר דרך שתי הנקודות.', display: '(-2, 1), \\quad (1, 7)',
      steps: [
        { prompt: 'מה מוצאים קודם?', choices: [
          { text: 'את השיפוע $m$, משתי הנקודות', ok: true, feedback: 'נכון: בלי $m$ יש בהצבה שני נעלמים.' },
          { text: 'את $b$: הוא $1$, ה־$y$ של הנקודה הראשונה', ok: false, feedback: '$b$ הוא ה־$y$ רק בנקודה שבה $x = 0$. כאן $x = -2$.' },
          { text: 'מציבים נקודה ב־$y = mx + b$ ופותרים', ok: false, feedback: 'כש־$m$ ו־$b$ לא ידועים, במשוואה יש שני נעלמים. קודם מוצאים את $m$.' },
        ], hints: ['כמה מספרים לא ידועים יש ב־$y = mx + b$? איזה מהם אפשר לחשב משתי נקודות?', 'מתחילים בשיפוע: $m = \\frac{y_2 - y_1}{x_2 - x_1}$.'], done: 'קודם $m$, אחר כך $b$.' },
        { prompt: 'מה השיפוע?', choices: [
          { text: '$m = \\frac{7 - 1}{1 - (-2)} = 2$', ok: true, feedback: 'נכון: $\\frac{6}{3} = 2$.' },
          { text: '$m = \\frac{7 - 1}{1 - 2} = -6$', ok: false, feedback: 'ה־$x$ של הנקודה הראשונה הוא $-2$, ולכן במכנה $1 - (-2) = 3$. המינוס לא נעלם.' },
          { text: '$m = \\frac{1 - (-2)}{7 - 1} = \\frac{1}{2}$', ok: false, feedback: 'המונה והמכנה התהפכו. השיפוע הוא השינוי ב־$y$ חלקי השינוי ב־$x$.' },
        ], hints: ['השינוי ב־$y$ למעלה, השינוי ב־$x$ למטה, באותו סדר של הנקודות.', '$\\frac{7 - 1}{1 - (-2)} = \\frac{6}{3}$'], done: '$m = 2$, ולכן $y = 2x + b$.' },
        { prompt: 'איך מוצאים עכשיו את $b$?', choices: [
          { text: 'מציבים את $(1, 7)$: $7 = 2 \\cdot 1 + b$', ok: true, feedback: 'נכון. אפשר להציב כל אחת מהנקודות, וכאן החשבון קל.' },
          { text: 'מציבים את $(1, 7)$: $1 = 2 \\cdot 7 + b$', ok: false, feedback: 'ה־$x$ וה־$y$ התחלפו. ה־$x$ של הנקודה נכנס במקום $x$: $7 = 2 \\cdot 1 + b$.' },
          { text: '$b = 7$, כי זה ה־$y$ של הנקודה', ok: false, feedback: '$7$ הוא ה־$y$ כש־$x = 1$. $b$ הוא ה־$y$ כש־$x = 0$.' },
        ], hints: ['הנקודה $(1, 7)$ על הישר. מה זה אומר על $y = 2x + b$?', 'במקום $x$ שמים $1$, ובמקום $y$ שמים $7$.'], done: '$7 = 2 + b$' },
      ],
      final: { prompt: 'מה $b$? כתבו את המספר.', answer: 5, check: '7 - 2 * 1', hints: ['איזה מספר ועוד $2$ נותן $7$?', '$b = 7 - 2 = 5$. בדיקה בנקודה השנייה: $2 \\cdot (-2) + 5 = 1$.'] } },
    { problem: 'ועכשיו שיפוע ונקודה, עם מספרים שליליים.', display: 'm = -2, \\quad (-3, 4)',
      steps: [
        { prompt: 'מה מקבלים אחרי ההצבה ב־$y = -2x + b$?', choices: [
          { text: '$4 = -2 \\cdot (-3) + b$', ok: true, feedback: 'נכון: $x = -3$, $y = 4$, והמספר השלילי בסוגריים.' },
          { text: '$-3 = -2 \\cdot 4 + b$', ok: false, feedback: 'ה־$x$ וה־$y$ התחלפו. בנקודה $(-3, 4)$ ה־$x$ הוא $-3$.' },
          { text: '$4 = -2 - 3 + b$', ok: false, feedback: 'בין $m$ ל־$x$ יש כפל, לא חיבור: $-2 \\cdot (-3)$.' },
        ], hints: ['ה־$x$ של הנקודה נכנס במקום $x$, וה־$y$ שלה במקום $y$.', 'מספר שלילי מציבים בסוגריים: $4 = -2 \\cdot (-3) + b$.'], done: '$4 = -2 \\cdot (-3) + b$' },
        { prompt: 'כמה זה $-2 \\cdot (-3)$?', choices: [
          { text: '$6$', ok: true, feedback: 'נכון: שלילי כפול שלילי הוא חיובי.' },
          { text: '$-6$', ok: false, feedback: 'שני הגורמים שליליים, ולכן המכפלה חיובית.' },
          { text: '$-5$', ok: false, feedback: 'זה החיבור $-2 + (-3)$. כאן יש כפל.' },
        ], hints: ['מה הסימן של שלילי כפול שלילי?', '$2 \\cdot 3 = 6$, והסימן חיובי.'], done: '$4 = 6 + b$' },
        { prompt: '$4 = 6 + b$. מה עושים כדי ש־$b$ יישאר לבד?', choices: [
          { text: 'מחסירים $6$ משני האגפים', ok: true, feedback: 'נכון: $b = 4 - 6$.' },
          { text: 'מוסיפים $6$ לשני האגפים', ok: false, feedback: '$6$ כבר מחובר ל־$b$. מבטלים חיבור בחיסור.' },
          { text: 'מחלקים את שני האגפים ב־$6$', ok: false, feedback: '$6$ לא כופל את $b$, הוא מחובר אליו.' },
        ], hints: ['מה הפעולה ההפוכה ל"ועוד $6$"?', 'מחסירים $6$: $b = 4 - 6$.'], done: '$b = 4 - 6$' },
      ],
      final: { prompt: 'מה $b$?', answer: -2, check: '4 - (-2) * (-3)', hints: ['$4 - 6$: מתחילים ב־$4$ ויורדים $6$.', '$b = -2$, והמשוואה $y = -2x - 2$. בדיקה: $-2 \\cdot (-3) - 2 = 4$.'] } },
  ],
  diag: equationModel,
  transfer: equationStory,
  misconceptions: [
    { id: 'b-is-y', title: 'כתבו את ה־$y$ של הנקודה בתור $b$',
      cause: '$b$ הוא ה־$y$ של נקודה אחת מסוימת: הנקודה שבה $x = 0$. בנקודה אחרת על הישר ה־$y$ הוא $b$ ועוד מה שהשיפוע הוסיף בדרך.',
      explain: [
        '$b$ הוא הגובה של הישר כש־$x = 0$, על ציר $y$.',
        'הנקודה $(2, 5)$ על הישר $y = 2x + 1$: ה־$y$ שלה $5$, אבל $b = 1$. מ־$x = 0$ עד $x = 2$ הישר עלה עוד $2 \\cdot 2 = 4$.',
        'לכן לא מעתיקים, מציבים: $5 = 2 \\cdot 2 + b$, ומכאן $b = 1$.',
      ],
      remedy: [
        { kind: 'explore', text: 'הישר $y = 2x + b$ עובר דרך $(2, 5)$. שימו את הנקודה שבה הוא חותך את ציר $y$.', manip: onLine(2, 1), answer: [0, 1],
          hint: 'ציר $y$ הוא הקו שבו $x = 0$. לכו על הישר שמאלה עד אליו.', success: 'הישר חותך את ציר $y$ ב־$(0, 1)$, ולכן $b = 1$ ולא $5$.' },
        { kind: 'predict', text: 'ישר עם שיפוע $3$ עובר דרך $(1, 4)$. מה $b$?', choices: ['$4$', '$1$', '$7$'], answer: 1,
          why: '$4 = 3 \\cdot 1 + b$, ולכן $b = 1$. ה־$4$ הוא הגובה כש־$x = 1$, לא כש־$x = 0$.' },
      ],
      prereq: 'line:2' },
    { id: 'move-no-flip', title: 'העבירו את $m x_1$ לאגף השני בלי להפוך את הסימן',
      cause: 'להעביר מספר לאגף השני זה בעצם לחסר (או להוסיף) אותו משני האגפים, ולכן הוא מחליף סימן. כשמעבירים "בראש" קל לשכוח את זה.',
      explain: [
        'ב־$3 = 4 + b$ המספר $4$ מחובר ל־$b$. כדי לבטל אותו מחסירים $4$ משני האגפים: $b = 3 - 4 = -1$.',
        'בדיקה תמיד מגלה: אם $b = 7$, אז $4 + 7 = 11$, לא $3$.',
      ],
      remedy: [
        { kind: 'predict', text: '$5 = 6 + b$. מה $b$?', choices: ['$11$', '$-1$', '$1$'], answer: 1,
          why: 'מחסירים $6$ משני האגפים: $b = 5 - 6 = -1$. בדיקה: $6 + (-1) = 5$.',
          wrongWhy: { 0: 'בדיקה: $6 + 11 = 17$, לא $5$. את $6$ צריך לחסר, לא להוסיף.' } },
        { kind: 'explore', text: 'בנו ישר עם שיפוע $3$ שעובר דרך $(2, 5)$.', manip: builder(), answer: { m: 3, b: -1 },
          hint: 'קבעו $m = 3$, ואז הזיזו את $b$ עד שהישר עובר במשבצת $(2, 5)$.',
          success: '$b = -1$: $y = 3x - 1$. בחישוב: $5 = 6 + b$, ולכן $b = 5 - 6 = -1$, לא $5 + 6$.' },
      ] },
    { id: 'b-sign', title: 'יצא $b$ עם הסימן ההפוך',
      cause: 'בחישוב של $b$ חיסרו בסדר ההפוך: במקום $y_1 - m x_1$ חישבו $m x_1 - y_1$. זה קורה כשמחסירים "את הקטן מהגדול".',
      explain: [
        'ב־$3 = 4 + b$ צריך מספר שמוסיפים ל־$4$ ומקבלים $3$. הוא קטן מאפס: $b = 3 - 4 = -1$.',
        'בחיסור הסדר חשוב: $3 - 4 = -1$, אבל $4 - 3 = 1$.',
      ],
      remedy: [
        { kind: 'predict', text: '$3 = 4 + b$. מה $b$?', choices: ['$1$', '$-1$', '$7$'], answer: 1,
          why: 'בודקים: $4 + 1 = 5$, לא $3$. אבל $4 + (-1) = 3$.' },
        { kind: 'explore', text: 'בנו ישר עם שיפוע $-1$ שעובר דרך $(-3, 1)$.', manip: builder(), answer: { m: -1, b: -2 },
          hint: 'קבעו $m = -1$, ואז הזיזו את $b$ עד שהישר עובר במשבצת $(-3, 1)$.',
          success: '$b = -2$: מההצבה $1 = 3 + b$, ולכן $b = 1 - 3 = -2$.' },
      ],
      prereq: 'signed:1' },
    { id: 'swap', title: 'הציבו את ה־$x$ של הנקודה במקום $y$ (ולהפך)',
      cause: 'בנקודה $(x, y)$ המספר הראשון הוא תמיד $x$. כשמציבים מהר, קל להכניס אותו במקום של $y$.',
      explain: ['הנקודה $(1, 4)$ אומרת: $x = 1$ ו־$y = 4$.', 'לכן ב־$y = 3x + b$ מציבים $4 = 3 \\cdot 1 + b$, ולא $1 = 3 \\cdot 4 + b$.'],
      remedy: [
        { kind: 'explore', text: 'שימו את הנקודה $(1, 4)$.', manip: dot(), answer: [1, 4],
          hint: 'המספר הראשון הוא $x$: צעד אחד ימינה. השני הוא $y$: ארבעה למעלה.', success: '$(1, 4)$: קודם $x = 1$ ימינה, אחר כך $y = 4$ למעלה.' },
        { kind: 'predict', text: 'הנקודה $(1, 4)$ על הישר $y = 3x + b$. מה מציבים?', choices: ['$4 = 3 \\cdot 1 + b$', '$1 = 3 \\cdot 4 + b$'], answer: 0,
          why: '$x = 1$ נכנס במקום $x$, ו־$y = 4$ במקום $y$. מכאן $b = 1$.' },
      ],
      prereq: 'coord:1' },
  ],
};

// ================================================================ stair 6: meeting the axes

type AxP = { m: number; b: number; ax: number; f: number; n: number }; // ax 0: the x-axis, 1: the y-axis; f 1: written b first
const NAMES = ['y', 'f', 'g'];
const x0Of = (p: { m: number; b: number }) => -p.b / p.m;
const fnRhs = (p: AxP) => (p.f ? `${T(p.b)} ${p.m < 0 ? '-' : '+'} ${mx(abs(p.m))}` : rhs(p.m, p.b));
const fnName = (p: AxP, at = 'x') => (p.n === 0 ? 'y' : `${NAMES[p.n]}(${at})`);
/** Solving 0 = mx + b in the solution's words. */
const solveZero = (m: number, b: number) => {
  const x0 = -b / m;
  return [
    `מעבירים את $${T(b)}$ לאגף השני (הוא מחליף סימן): $${mx(m)} = ${T(-b)}$`,
    ...(m === 1 ? [] : [`מחלקים ב־$${T(m)}$: $x = \\frac{${T(-b)}}{${T(m)}} = ${T(x0)}$`]),
  ];
};

const axesModel: DiagModel<AxP> = {
  params: (rnd) => {
    for (;;) {
      const m = rnz(rnd, -6, 6); const b = rnz(rnd, -12, 12); const x0 = -b / m;
      if (!Number.isInteger(2 * x0) || abs(x0) > 12) continue;
      if (abs(m) === 1 && rnd() < 0.75) continue; // dividing by 1 teaches nothing (and makes the bugs agree)
      // with m = −1 both intercepts are b, a number the question prints: copying it would answer either axis
      if (m === -1) continue;
      return { m, b, ax: rnd() < 0.8 ? 0 : 1, f: rnd() < 0.3 ? 1 : 0, n: rint(rnd, 0, 2) };
    }
  },
  text: (p) => (p.ax === 0
    ? 'מצאו את נקודת החיתוך של הגרף עם ציר $x$. מה שיעור ה־$x$ שלה?'
    : 'מצאו את נקודת החיתוך של הגרף עם ציר $y$. מה שיעור ה־$y$ שלה?'),
  display: (p) => `${fnName(p)} = ${fnRhs(p)}`,
  answer: (p) => (p.ax === 0 ? x0Of(p) : p.b),
  bugs: {
    // 0 = mx + b → mx = b: b crossed over without changing sign
    sign: (p) => (p.ax === 0 ? p.b / p.m : null),
    // stopped at mx = −b
    'no-divide': (p) => (p.ax === 0 ? -p.b : null),
    // found the other axis: x = 0 for the x-axis (gives b), y = 0 for the y-axis (gives −b/m)
    'axes-mixed': (p) => (p.ax === 0 ? p.b : x0Of(p)),
  },
  solution: (p) => (p.ax === 0
    ? [`על ציר $x$ מתקיים $y = 0$: $0 = ${fnRhs(p)}$`, ...solveZero(p.m, p.b), `נקודת החיתוך: $(${T(x0Of(p))}, 0)$`]
    : [`על ציר $y$ מתקיים $x = 0$: $${fnName(p, '0')} = ${p.f ? `${T(p.b)} ${p.m < 0 ? '-' : '+'} ${abs(p.m)} \\cdot 0` : `${T(p.m)} \\cdot 0${plus(p.b)}`} = ${T(p.b)}$`, `נקודת החיתוך: $(0, ${T(p.b)})$`]),
  hint: (p) => (p.ax === 0
    ? 'על ציר $x$ הגובה אפס: מציבים $y = 0$, מעבירים את המספר החופשי לאגף השני ומחלקים במקדם של $x$.'
    : 'על ציר $y$ מתקיים $x = 0$. מה נשאר מהמשוואה כש־$x = 0$?'),
};

type ZeroStory = { k: number; m: number; b: number }; // k 0: temperature, 1: paying back a debt, 2: a table
const axesStory: DiagModel<ZeroStory> = {
  // where the graph meets the x-axis is "when does it reach zero"
  params: (rnd) => {
    for (;;) {
      const k = rint(rnd, 0, 2);
      if (k === 0) { const m = rint(rnd, 2, 4); const x0 = rint(rnd, 2, 8); return { k, m, b: -m * x0 }; }
      if (k === 1) { const m = 5 * rint(rnd, 2, 10); const x0 = rint(rnd, 3, 12); return { k, m, b: -m * x0 }; }
      const m = rnz(rnd, -4, 4); const x0 = rnz(rnd, -6, 6);
      if (abs(m) >= 2 && (x0 < 0 || x0 >= 3) && abs(m * x0) <= 20) return { k, m, b: -m * x0 };
    }
  },
  text: (p) => {
    if (p.k === 0) return `בבוקר חורפי הטמפרטורה עולה בקצב קבוע: $t$ שעות אחרי הזריחה היא $T = ${mx(p.m, 't')} - ${-p.b}$ מעלות. אחרי כמה שעות הטמפרטורה תגיע ל־$0$ מעלות?`;
    if (p.k === 1) return `דנה חייבת להורים $${-p.b}$ ש״ח ומחזירה $${p.m}$ ש״ח בכל שבוע. אחרי $x$ שבועות היתרה שלה היא $y = ${p.m}x - ${-p.b}$ ש״ח. אחרי כמה שבועות היתרה תגיע ל־$0$?`;
    return 'בטבלה ערכים של פונקציה קווית. באיזה $x$ הגרף שלה חותך את ציר $x$?';
  },
  display: (p) => (p.k === 2 ? tab([0, 1, 2], [['y', [p.b, p.b + p.m, p.b + 2 * p.m]]]) : ''),
  answer: (p) => x0Of(p),
  bugs: {
    sign: (p) => p.b / p.m,
    'no-divide': (p) => -p.b,
    // the starting value (x = 0) given as the answer
    'axes-mixed': (p) => p.b,
  },
  solution: (p) => {
    const x0 = x0Of(p);
    if (p.k === 0) return [`הגרף פוגש את ציר $t$ כש־$T = 0$: $0 = ${mx(p.m, 't')} - ${-p.b}$`, `$${mx(p.m, 't')} = ${-p.b}$`, `$t = \\frac{${-p.b}}{${p.m}} = ${T(x0)}$: אחרי $${T(x0)}$ שעות.`];
    if (p.k === 1) return [`היתרה $0$ כש־$y = 0$: $0 = ${p.m}x - ${-p.b}$`, `$${p.m}x = ${-p.b}$`, `$x = \\frac{${-p.b}}{${p.m}} = ${T(x0)}$: אחרי $${T(x0)}$ שבועות.`];
    return [`מהטבלה: כש־$x = 0$, $y = ${T(p.b)}$, ולכן $b = ${T(p.b)}$. בכל צעד של $x$ ה־$y$ משתנה ב־$${T(p.m)}$, ולכן $m = ${T(p.m)}$.`,
      `הפונקציה: $${lineTex(p.m, p.b)}$. מציבים $y = 0$: $0 = ${rhs(p.m, p.b)}$`, ...solveZero(p.m, p.b)];
  },
  hint: (p) => (p.k === 2
    ? 'קודם מוצאים את $b$ (כש־$x = 0$) ואת $m$ (השינוי בכל צעד). אחר כך מציבים $y = 0$ ופותרים.'
    : 'הכמות מגיעה ל־$0$ בנקודה שבה הגרף פוגש את הציר האופקי: מציבים $0$ במקום הכמות ופותרים.'),
};

const stair6: StairContent = {
  skill: 'line:6', topic: 'line', level: 6, title: 'חיתוך עם הצירים',
  objectives: [
    'למצוא את נקודת החיתוך עם ציר $y$: מציבים $x = 0$.',
    'למצוא את נקודת החיתוך עם ציר $x$: מציבים $y = 0$, מעבירים ומחלקים ב־$m$.',
    'לכתוב את התשובה כנקודה, ולהבין מה היא אומרת בבעיה מהחיים.',
  ],
  idea: 'על ציר $y$ לכל נקודה $x = 0$, ועל ציר $x$ לכל נקודה $y = 0$. מציבים את האפס המתאים במשוואה ופותרים.',
  why: [
    'ציר $x$ הוא הקו שבו הגובה אפס: $(3, 0)$, $(-5, 0)$. לכן הישר פוגש אותו במקום שבו $y = 0$.',
    'ב־$0 = mx + b$ המספר $m$ כופל את $x$. כדי לקבל $x$ לבד מבטלים את הכפל בחילוק ב־$m$: $x = \\frac{-b}{m}$.',
    'רואים את החילוק על הגרף: מ־$(0, b)$ צריך לעלות או לרדת $|b|$ עד הגובה $0$, ובכל צעד ימינה הישר משתנה ב־$m$. מספר הצעדים הוא $|b|$ חלקי $|m|$.',
  ],
  alt: [
    'חשבו על מעלית שיורדת: $y = 12 - 3x$ הוא הגובה שלה במטרים אחרי $x$ שניות. היא מגיעה לקרקע כשהגובה $0$, אחרי $12 : 3 = 4$ שניות. זה החיתוך עם ציר $x$, $(4, 0)$.',
    'בטבלת ערכים ממשיכים עד שה־$y$ מגיע ל־$0$. ב־$y = 2x - 6$: $x = 0, 1, 2, 3$ נותנים $y = -6, -4, -2, 0$. החיתוך: $(3, 0)$.',
  ],
  discover: [
    { kind: 'say', fig: plane({ lines: [{ m: -1, b: 3 }], anim: true }), mood: 'happy', text: 'ישר שאינו מקביל לצירים חוצה את שניהם. היום נמצא בדיוק איפה, בלי לצייר.' },
    { kind: 'explore', text: 'זה הישר $y = 2x - 4$. שימו את הנקודה שבה הוא חותך את ציר $y$.', display: 'y = 2x - 4', manip: onLine(2, -4), answer: [0, -4],
      hint: 'ציר $y$ הוא הקו האנכי שעובר באפס. מה ה־$x$ של כל נקודה עליו?',
      success: 'הנקודה $(0, -4)$. כש־$x = 0$ נשאר רק $b$, ולכן החיתוך עם ציר $y$ הוא תמיד $(0, b)$.' },
    { kind: 'explore', text: 'ועכשיו שימו את הנקודה שבה אותו ישר חותך את ציר $x$.', display: 'y = 2x - 4', manip: onLine(2, -4), answer: [2, 0],
      hint: 'ציר $x$ הוא הקו האופקי. לכו על הישר עד שהוא בגובה $0$.',
      success: 'הנקודה $(2, 0)$. בדיקה: $2 \\cdot 2 - 4 = 0$. שם הגובה של הישר אפס.' },
    { kind: 'predict', fig: plane({ range: 9, points: [P('(2, 0)', 2, 0), P('(−5, 0)', -5, 0), P('(7, 0)', 7, 0)] }), text: 'מה משותף לכל הנקודות על ציר $x$, כמו $(2, 0)$, $(-5, 0)$ ו־$(7, 0)$?',
      choices: ['$y = 0$', '$x = 0$', '$x = y$'], answer: 0,
      why: 'כולן בגובה אפס: ה־$y$ שלהן $0$. לכן החיתוך עם ציר $x$ הוא המקום שבו $y = 0$, ועם ציר $y$ המקום שבו $x = 0$.',
      wrongWhy: { 1: '$x = 0$ הוא ציר $y$, הקו האנכי. הסתכלו על המספר השני בכל נקודה.' } },
    { kind: 'rule', fig: plane({ lines: [{ m: 2, b: -4 }], points: [P('(0, −4)', 0, -4), P('(2, 0)', 2, 0)], words: [{ at: [-3.5, 2], text: 'y = 2x − 4', tone: 'brand' }] }), text: 'חיתוך עם ציר $y$: מציבים $x = 0$ ומקבלים $(0, b)$. חיתוך עם ציר $x$: מציבים $y = 0$ ופותרים.', display: 'x = 0 \\Rightarrow (0, b), \\qquad y = 0 \\Rightarrow 0 = mx + b',
      why: 'נקודת החיתוך נמצאת גם על הישר וגם על הציר. לכן היא מקיימת את משוואת הישר, וגם את התנאי של הציר: $x = 0$ על ציר $y$, $y = 0$ על ציר $x$.' },
    { kind: 'predict', fig: plane({ lines: [{ m: 3, b: -6 }], points: [P('(0, −6)', 0, -6)] }), text: 'הישר $y = 3x - 6$ מתחיל ב־$(0, -6)$ ועולה $3$ בכל צעד ימינה. אחרי כמה צעדים הוא יגיע לגובה $0$?',
      choices: ['$2$', '$3$', '$6$'], answer: 0,
      why: 'צריך לעלות $6$, ובכל צעד עולים $3$: $6 : 3 = 2$ צעדים. לכן הישר חותך את ציר $x$ ב־$(2, 0)$. זה החילוק ב־$m$.',
      wrongWhy: { 1: '$3$ הוא כמה עולים בצעד אחד. כמה צעדים כאלה צריך כדי לעלות $6$?', 2: '$6$ הוא כמה צריך לעלות, לא כמה צעדים. כל צעד מעלה $3$.' } },
    { kind: 'predict', fig: { type: 'scale', left: { x: 3, n: 0 }, right: { x: 0, n: 6 } }, text: 'בחישוב: $0 = 3x - 6$. מוסיפים $6$ לשני האגפים ומקבלים $3x = 6$. מה $x$?',
      choices: ['$6$', '$2$', '$3$'], answer: 1,
      why: '$3x$ הוא שלוש פעמים $x$. כדי לקבל $x$ אחד מחלקים ב־$3$: $x = 2$. בדיוק שני הצעדים שספרנו.',
      wrongWhy: { 0: 'אם $x = 6$, אז $3x = 18$ ולא $6$. עוד לא חילקתם ב־$3$.' } },
    { kind: 'predict', fig: { type: 'table', head: ['x', 'y'], rows: [[0, 8], [1, 6], [2, 4], [3, 2]] }, text: 'איפה הישר $y = -2x + 8$ חותך את ציר $x$?',
      choices: ['$(4, 0)$', '$(-4, 0)$', '$(0, 8)$'], answer: 0,
      why: '$0 = -2x + 8$. מחסירים $8$: $-2x = -8$. מחלקים ב־$-2$: $x = 4$. בדיקה: $-2 \\cdot 4 + 8 = 0$.',
      wrongWhy: { 1: 'כש־$8$ עובר לאגף השני הוא נעשה $-8$, ואז מחלקים ב־$-2$: שלילי חלקי שלילי הוא חיובי.', 2: '$(0, 8)$ היא החיתוך עם ציר $y$. על ציר $x$ ה־$y$ הוא $0$.' } },
    { kind: 'explore', text: 'נסו לבד: הישר $y = 2x + 6$. חשבו איפה הוא חותך את ציר $x$, ושימו שם את הנקודה.', display: 'y = 2x + 6', manip: onLine(2, 6), answer: [-3, 0],
      hint: '$0 = 2x + 6$. מחסירים $6$ משני האגפים ומחלקים ב־$2$.',
      success: '$2x = -6$, ולכן $x = -3$: הנקודה $(-3, 0)$, משמאל לראשית.' },
    { kind: 'rule', fig: plane({ lines: [{ m: 2, b: 6 }], points: [P('(−3, 0)', -3, 0), P('(0, b)', 0, 6)], words: [{ at: [3.4, -3], text: 'm = 2' }] }), text: 'חיתוך עם ציר $x$: פותרים $0 = mx + b$. מעבירים את $b$, כך ש־$mx = -b$, ומחלקים ב־$m$.', display: 'x = \\frac{-b}{m}',
      why: 'מעבירים את $b$ כדי ש־$mx$ יישאר לבד, והוא מחליף סימן כי מחסירים אותו משני האגפים. אחר כך מחלקים ב־$m$, כי $m$ כופל את $x$, וחילוק מבטל כפל.' },
  ],
  examples: [
    { problem: 'מצאו איפה הגרף של הפונקציה חותך את שני הצירים. מה שיעור ה־$x$ של נקודת החיתוך עם ציר $x$?', display: 'f(x) = -3x + 9', answer: 3, check: '-9 / (-3)',
      steps: [
        { action: 'ציר $y$: מציבים $x = 0$.', why: 'על ציר $y$ לכל נקודה $x = 0$.', result: 'f(0) = -3 \\cdot 0 + 9 = 9 \\;\\Rightarrow\\; A(0, 9)', calc: { expr: '-3 * 0 + 9', value: 9 } },
        { action: 'ציר $x$: מציבים $f(x) = 0$.', why: 'על ציר $x$ לכל נקודה הגובה $0$.', result: '0 = -3x + 9' },
        { action: 'מחסירים $9$ משני האגפים.', why: 'כדי ש־$-3x$ יישאר לבד באגף אחד.', result: '-9 = -3x' },
        { action: 'מחלקים ב־$-3$.', why: '$-3$ כופל את $x$, וחילוק מבטל כפל. שלילי חלקי שלילי הוא חיובי.', result: 'x = \\frac{-9}{-3} = 3 \\;\\Rightarrow\\; B(3, 0)', value: '-9 / (-3)' },
        { action: 'בודקים.', why: 'בנקודה על ציר $x$ הפונקציה שווה $0$.', result: 'f(3) = -3 \\cdot 3 + 9 = 0', calc: { expr: '-3 * 3 + 9', value: 0 } },
      ] },
    { problem: 'במכל הדלק של מכונית יש $45$ ליטר. בכל שעת נסיעה היא שורפת $6$ ליטר, ולכן אחרי $x$ שעות נשארים $y = 45 - 6x$ ליטר. איפה הגרף חותך את הצירים, ומה זה אומר? אחרי כמה שעות המכל יתרוקן?', display: 'y = 45 - 6x', answer: 7.5, check: '45 / 6',
      steps: [
        { action: 'ציר $y$: מציבים $x = 0$.', why: '$x = 0$ הוא רגע היציאה, לפני שנסעו.', result: 'y = 45 - 6 \\cdot 0 = 45 \\;\\Rightarrow\\; (0, 45)', calc: { expr: '45 - 6 * 0', value: 45 } },
        { action: 'ציר $x$: המכל ריק, $y = 0$.', why: 'החיתוך עם ציר $x$ הוא הרגע שבו לא נשאר דלק.', result: '0 = 45 - 6x' },
        { action: 'מוסיפים $6x$ לשני האגפים.', why: 'כך $x$ עובר לאגף שבו המקדם שלו חיובי.', result: '6x = 45' },
        { action: 'מחלקים ב־$6$.', why: 'שורפים $6$ ליטר בכל שעה: כמה פעמים $6$ נכנס ב־$45$?', result: 'x = \\frac{45}{6} = 7.5', value: '45 / 6' },
        { action: 'בודקים ומפרשים.', why: 'אחרי שבע שעות וחצי המכל ריק: הנקודה $(7.5, 0)$.', result: '45 - 6 \\cdot 7.5 = 0', calc: { expr: '45 - 6 * 7.5', value: 0 } },
      ] },
  ],
  together: [
    { problem: 'נמצא יחד איפה הישר חותך את ציר $x$.', display: 'y = 4x + 10',
      steps: [
        { prompt: 'מה מציבים?', choices: [
          { text: '$y = 0$', ok: true, feedback: 'נכון: על ציר $x$ הגובה אפס.' },
          { text: '$x = 0$', ok: false, feedback: '$x = 0$ נותן את החיתוך עם ציר $y$, הנקודה $(0, 10)$.' },
          { text: '$x = 4$', ok: false, feedback: '$4$ הוא השיפוע, לא מקום על ציר.' },
        ], hints: ['מה ה־$y$ של כל נקודה על ציר $x$?', 'נקודות על ציר $x$ הן כמו $(5, 0)$: $y = 0$.'], done: '$0 = 4x + 10$' },
        { prompt: 'מה הצעד הבא?', choices: [
          { text: 'מחסירים $10$: $-10 = 4x$', ok: true, feedback: 'נכון: $10$ עובר לאגף השני ומחליף סימן.' },
          { text: 'מחסירים $10$: $10 = 4x$', ok: false, feedback: 'כשמחסירים $10$ משני האגפים, באגף השמאלי $0 - 10 = -10$.' },
          { text: 'מחלקים ב־$4$: $0 = x + 10$', ok: false, feedback: 'אם מחלקים ב־$4$, צריך לחלק גם את $10$. קל יותר קודם להעביר את $10$.' },
        ], hints: ['מה מפריע ל־$4x$ להיות לבד?', 'מחסירים $10$ משני האגפים: $0 - 10 = 4x$.'], done: '$4x = -10$' },
        { prompt: '$4x = -10$. איך מקבלים את $x$?', choices: [
          { text: 'מחלקים ב־$4$', ok: true, feedback: 'נכון: $4$ כופל את $x$, וחילוק מבטל את הכפל.' },
          { text: 'מחסירים $4$', ok: false, feedback: '$4x$ הוא $4$ כפול $x$, לא $4$ ועוד $x$.' },
          { text: 'זהו, $x = -10$', ok: false, feedback: '$-10$ הוא $4x$, ארבע פעמים $x$. צריך עוד לחלק ב־$4$.' },
        ], hints: ['$4x$ הוא ארבע פעמים $x$. איך מוצאים פעם אחת?', 'מחלקים את שני האגפים ב־$4$: $x = \\frac{-10}{4}$.'], done: '$x = \\frac{-10}{4}$' },
      ],
      final: { prompt: 'מה שיעור ה־$x$ של נקודת החיתוך? (אפשר שבר או מספר עשרוני)', answer: -2.5, check: '-10 / 4', hints: ['$\\frac{-10}{4}$: מצמצמים או מחלקים.', '$x = -2.5$, הנקודה $(-2.5, 0)$. בדיקה: $4 \\cdot (-2.5) + 10 = 0$.'] } },
    { problem: 'ועכשיו פונקציה שכתובה בסדר אחר.', display: 'g(x) = 12 - 3x',
      steps: [
        { prompt: 'איפה הגרף חותך את ציר $y$?', choices: [
          { text: '$(0, 12)$', ok: true, feedback: 'נכון: $g(0) = 12 - 0 = 12$.' },
          { text: '$(0, -3)$', ok: false, feedback: '$-3$ כופל את $x$: זה השיפוע. כש־$x = 0$ הוא נעלם, ו־$g(0) = 12$.' },
          { text: '$(12, 0)$', ok: false, feedback: 'על ציר $y$ ה־$x$ הוא $0$, ולכן הנקודה $(0, 12)$.' },
        ], hints: ['מציבים $x = 0$.', '$g(0) = 12 - 3 \\cdot 0$.'], done: '$(0, 12)$' },
        { prompt: 'לחיתוך עם ציר $x$ פותרים $0 = 12 - 3x$. מה מקבלים?', choices: [
          { text: '$3x = 12$', ok: true, feedback: 'נכון: מוסיפים $3x$ לשני האגפים.' },
          { text: '$3x = -12$', ok: false, feedback: 'כשמוסיפים $3x$ לשני האגפים, $12$ לא זז ולא משנה סימן: $3x = 12$.' },
          { text: '$x = 12$', ok: false, feedback: '$12 - 3 \\cdot 12$ הוא לא $0$. ה־$3$ שכופל את $x$ נשכח.' },
        ], hints: ['איזו פעולה מעבירה את $-3x$ לאגף השני?', 'מוסיפים $3x$ לשני האגפים: $3x = 12$.'], done: '$3x = 12$' },
      ],
      final: { prompt: 'מה שיעור ה־$x$ של החיתוך עם ציר $x$?', answer: 4, check: '12 / 3', hints: ['$3x = 12$: מחלקים ב־$3$.', '$x = 4$, הנקודה $(4, 0)$. בדיקה: $12 - 3 \\cdot 4 = 0$.'] } },
  ],
  diag: axesModel,
  transfer: axesStory,
  misconceptions: [
    { id: 'sign', title: 'החיתוך עם ציר $x$ יצא בצד הלא נכון של הראשית',
      cause: 'ב־$0 = mx + b$ מעבירים את $b$ לאגף השני והוא מחליף סימן: $mx = -b$. מי שמעביר בלי להחליף סימן מקבל $mx = b$, ונקודה הפוכה.',
      explain: [
        'להעביר את $b$ זה לחסר אותו משני האגפים: $0 - b = mx$.',
        'דוגמה: $0 = 2x - 6$. מוסיפים $6$: $2x = 6$, ו־$x = 3$. בדיקה: $2 \\cdot 3 - 6 = 0$. עם $x = -3$ יוצא $-12$.',
        'תמיד אפשר לבדוק: מציבים את ה־$x$ שמצאתם, וחייב לצאת $0$.',
      ],
      remedy: [
        { kind: 'explore', text: 'הישר $y = 2x - 6$. שימו את הנקודה שבה הוא חותך את ציר $x$: מימין לראשית או משמאל לה?', display: 'y = 2x - 6', manip: onLine(2, -6), answer: [3, 0],
          hint: 'הישר עולה, ומתחיל ב־$(0, -6)$, מתחת לציר. כדי להגיע לגובה $0$ הולכים ימינה.',
          success: '$(3, 0)$, מימין לראשית. בחישוב: $2x = 6$, ולא $2x = -6$.' },
        { kind: 'predict', text: '$0 = 5x + 10$. מה מקבלים אחרי שמעבירים את $10$?', choices: ['$5x = 10$', '$5x = -10$'], answer: 1,
          why: 'מחסירים $10$ משני האגפים: $0 - 10 = 5x$. ולכן $x = -2$. בדיקה: $5 \\cdot (-2) + 10 = 0$.' },
      ] },
    { id: 'no-divide', title: 'עצרו ב־$mx = -b$ ולא חילקו ב־$m$',
      cause: 'אחרי שמעבירים את $b$ מקבלים $mx = -b$. זה עוד לא $x$: זה $m$ פעמים $x$.',
      explain: [
        '$3x = 12$ אומר: שלוש פעמים $x$ הן $12$. ולכן $x$ אחד הוא $12 : 3 = 4$.',
        'על הגרף: מ־$(0, -12)$ עולים $3$ בכל צעד ימינה. כדי לעלות $12$ צריך $4$ צעדים, לא $12$.',
      ],
      remedy: [
        { kind: 'predict', text: 'הישר $y = 4x - 8$ מתחיל ב־$(0, -8)$ ועולה $4$ בכל צעד ימינה. אחרי כמה צעדים הוא בגובה $0$?', choices: ['$8$', '$2$', '$4$'], answer: 1,
          why: 'צריך לעלות $8$, ובכל צעד עולים $4$: $8 : 4 = 2$. לכן $x = 2$, לא $8$.' },
        { kind: 'explore', text: 'הישר $y = 3x - 6$. שימו את הנקודה שבה הוא חותך את ציר $x$.', display: 'y = 3x - 6', manip: onLine(3, -6), answer: [2, 0],
          hint: '$3x = 6$: כמה פעמים $3$ נכנס ב־$6$?', success: '$(2, 0)$: $3x = 6$, ולכן $x = 6 : 3 = 2$.' },
      ],
      prereq: 'signed:3' },
    { id: 'axes-mixed', title: 'התבלבלו בין ציר $x$ לציר $y$',
      cause: 'השמות מבלבלים: על ציר $x$ דווקא $y$ שווה $0$, ועל ציר $y$ דווקא $x$ שווה $0$.',
      explain: [
        'ציר $x$ הוא הקו האופקי. כל הנקודות עליו בגובה $0$, כמו $(4, 0)$ ו־$(-1, 0)$. לכן מציבים $y = 0$.',
        'ציר $y$ הוא הקו האנכי. כל הנקודות עליו עם $x = 0$, כמו $(0, 3)$. לכן מציבים $x = 0$, ומקבלים את $b$.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו נקודה על ציר $x$, ארבעה צעדים מימין לראשית.', manip: dot(), answer: [4, 0],
          hint: 'ציר $x$ הוא הקו האופקי. זזים ימינה בלי לעלות.', success: '$(4, 0)$: על ציר $x$ ה־$y$ הוא $0$.' },
        { kind: 'predict', text: 'כדי למצוא איפה ישר חותך את ציר $x$, מה מציבים?', choices: ['$x = 0$', '$y = 0$'], answer: 1,
          why: 'על ציר $x$ כל נקודה בגובה $0$, כלומר $y = 0$. הצבה של $x = 0$ נותנת את החיתוך עם ציר $y$.' },
      ],
      prereq: 'coord:1' },
  ],
};

// ================================================================ stair 7: the triangle with the axes

type TriP = { k: number; m: number; b: number }; // k 0: the equation, 1: a table, 2: a garden
const areaOf = (p: { m: number; b: number }) => abs(p.b * x0Of(p)) / 2;
const triBugs = {
  // the rectangle, not its half
  'no-half': (p: TriP) => abs(p.b * x0Of(p)),
  // added the legs
  'added-sides': (p: TriP) => abs(p.b) + abs(x0Of(p)),
  // kept the signs of the intercepts: a negative area
  'neg-length': (p: TriP) => (p.b * x0Of(p) < 0 ? (p.b * x0Of(p)) / 2 : null),
  // the leg on the x-axis taken as −b (mx = −b, not divided by m)
  'no-divide': (p: TriP) => (abs(p.m) !== 1 ? (p.b * p.b) / 2 : null),
};
const triSolution = (p: TriP) => {
  const x0 = x0Of(p);
  return [
    `חיתוך עם ציר $y$ ($x = 0$): $A(0, ${T(p.b)})$`,
    `חיתוך עם ציר $x$ ($y = 0$): ${p.m === 1 ? '' : `$${mx(p.m)} = ${T(-p.b)}$, ולכן `}$x = ${T(x0)}$ והנקודה $B(${T(x0)}, 0)$`,
    `הניצבים הם המרחקים מהראשית, בלי סימן: $${abs(p.b)}$ ו־$${T(abs(x0))}$`,
    `השטח: $\\frac{${abs(p.b)} \\cdot ${T(abs(x0))}}{2} = ${T(areaOf(p))}$`,
  ];
};
const triParams = (rnd: () => number, k: number): TriP => {
  for (;;) {
    // |m| = 1 makes the x-intercept just −b; |m| = 2 makes "not divided" and "not halved" agree: both rarer
    const u = rnd(); const am = u < 0.15 ? 1 : u < 0.35 ? 2 : u < 0.65 ? 3 : 4;
    const m = k === 2 ? -Math.min(am, 3) : (rnd() < 0.5 ? -am : am);
    const x0 = k === 2 ? rint(rnd, 2, 8) : rnz(rnd, -6, 6);
    const b = -m * x0;
    if (abs(b) <= (k === 2 ? 15 : 16)) return { k, m, b };
  }
};

const triangleModel: DiagModel<TriP> = {
  params: (rnd) => triParams(rnd, 0),
  text: (p) => `הישר $${lineTex(p.m, p.b)}$ יוצר משולש עם הצירים. מה שטח המשולש?`,
  answer: areaOf,
  bugs: triBugs,
  solution: triSolution,
  hint: () => 'מוצאים את שתי נקודות החיתוך עם הצירים. הניצבים הם המרחקים שלהן מהראשית (בלי סימן), והשטח הוא מכפלתם חלקי $2$.',
  unit: 'יחידות ריבועיות',
};

const triangleStory: DiagModel<TriP> = {
  // the same triangle from a table of values, or as a garden bed between two fences and a path
  params: (rnd) => triParams(rnd, rnd() < 0.5 ? 1 : 2),
  text: (p) => (p.k === 1
    ? 'בטבלה ערכים של פונקציה קווית. הגרף שלה יוצר משולש עם הצירים. מה שטח המשולש?'
    : `שתי גדרות מאונכות נפגשות בפינה של חצר, ושמים אותן על הצירים. שביל ישר עובר לפי $${lineTex(p.m, p.b)}$ (במטרים). השביל והגדרות סוגרים ערוגה משולשת. מה שטח הערוגה במ״ר?`),
  display: (p) => (p.k === 1 ? tab([0, 1, 2], [['y', [p.b, p.b + p.m, p.b + 2 * p.m]]]) : ''),
  answer: areaOf,
  bugs: triBugs,
  solution: (p) => (p.k === 1
    ? [`מהטבלה: $b = ${T(p.b)}$ (כש־$x = 0$), ו־$m = ${T(p.m)}$ (השינוי בכל צעד). הפונקציה: $${lineTex(p.m, p.b)}$`, ...triSolution(p)]
    : [`הגדר שעל ציר $y$: השביל פוגש אותה ב־$(0, ${p.b})$. הגדר שעל ציר $x$: $0 = ${rhs(p.m, p.b)}$, ולכן $x = ${T(x0Of(p))}$.`,
      `הערוגה היא משולש ישר־זווית בפינה: $\\frac{${p.b} \\cdot ${T(x0Of(p))}}{2} = ${T(areaOf(p))}$ מ״ר`]),
  hint: (p) => (p.k === 1
    ? 'קודם $b$ (כש־$x = 0$) ו־$m$ (השינוי בכל צעד). אחר כך שתי נקודות החיתוך, והשטח הוא מכפלת המרחקים חלקי $2$.'
    : 'הפינה של החצר היא ראשית הצירים. מוצאים איפה השביל פוגש כל גדר: $x = 0$ ו־$y = 0$.'),
};

const stair7: StairContent = {
  skill: 'line:7', topic: 'line', level: 7, title: 'משולש עם הצירים',
  objectives: [
    'לזהות את המשולש שישר יוצר עם הצירים: ראשית הצירים ושתי נקודות החיתוך.',
    'למצוא את אורכי הניצבים, גם כשנקודות החיתוך שליליות.',
    'לחשב את השטח: מכפלת הניצבים חלקי $2$.',
  ],
  idea: 'המשולש שישר סוגר עם הצירים הוא ישר־זווית בראשית. הניצבים שלו הם המרחקים של נקודות החיתוך מהראשית, והשטח הוא מכפלתם חלקי $2$.',
  why: [
    'הצירים מאונכים זה לזה, ולכן בראשית יש זווית ישרה. הניצבים הם הקטעים על הצירים, והישר הוא היתר.',
    'משולש ישר־זווית הוא חצי ממלבן: האלכסון חוצה את המלבן לשני משולשים שווים. לכן השטח הוא מכפלת הניצבים חלקי $2$.',
    'אורך הוא מרחק, ומרחק אף פעם אינו שלילי. הנקודה $(-4, 0)$ רחוקה $4$ מהראשית, ולכן הצלע $4$.',
  ],
  alt: [
    'ציירו מלבן ששתי צלעות שלו על הצירים, והפינה הרחוקה שלו מול הראשית. הישר הוא האלכסון שלו, ולכן המשולש הוא בדיוק חצי מהמלבן.',
    'לא צריך את כל הגרף, רק את שתי נקודות החיתוך. ב־$y = -2x + 6$: הניצבים $6$ ו־$3$, והשטח $\\frac{6 \\cdot 3}{2} = 9$.',
  ],
  discover: [
    { kind: 'say', fig: plane({ lines: [{ m: -1, b: 4 }], polygon: [[0, 0], [4, 0], [0, 4]], points: [P('O', 0, 0)], anim: true }), mood: 'happy', text: 'ישר שחותך את שני הצירים סוגר איתם משולש. הקודקודים שלו: ראשית הצירים $O$, ושתי נקודות החיתוך.' },
    { kind: 'explore', text: 'זה הישר $y = -2x + 6$. שימו את הקודקוד $A$: הנקודה שבה הוא חותך את ציר $y$.', display: 'y = -2x + 6', manip: onLine(-2, 6, 'A'), answer: [0, 6],
      hint: 'על ציר $y$ מתקיים $x = 0$. מה $y$ כש־$x = 0$?', success: '$A(0, 6)$: כש־$x = 0$ נשאר $b = 6$.' },
    { kind: 'explore', text: 'ועכשיו הקודקוד $B$: הנקודה שבה הישר חותך את ציר $x$.', display: 'y = -2x + 6', manip: onLine(-2, 6, 'B'), answer: [3, 0],
      hint: '$0 = -2x + 6$, ולכן $2x = 6$.', success: '$B(3, 0)$. עכשיו יש משולש $OAB$, עם זווית ישרה בראשית.' },
    { kind: 'predict', fig: plane({ lines: [{ m: -2, b: 6 }], polygon: [[0, 0], [3, 0], [0, 6]], points: [P('O', 0, 0), P('A', 0, 6), P('B', 3, 0)] }), text: 'מה האורכים של שתי הצלעות שעל הצירים, $OA$ ו־$OB$?',
      choices: ['$6$ ו־$3$', '$6$ ו־$-2$', '$0$ ו־$6$'], answer: 0,
      why: '$OA$ הוא המרחק מ־$(0, 0)$ עד $(0, 6)$, כלומר $6$. $OB$ הוא המרחק עד $(3, 0)$, כלומר $3$.',
      wrongWhy: { 1: '$-2$ הוא השיפוע. הצלעות הן המרחקים של נקודות החיתוך מהראשית.', 2: '$O$ היא נקודה, לא צלע. הצלעות הן הקטעים מ־$O$ עד $A$ ועד $B$.' } },
    { kind: 'explore', text: 'למה מחלקים ב־$2$? השלימו את המלבן $OBCA$: שימו את הקודקוד $C$.', manip: rectangle(3, 6), answer: [3, 6],
      hint: '$C$ נמצא מעל $B$, באותו גובה כמו $A$.',
      success: 'שטח המלבן $3 \\cdot 6 = 18$. הישר $AB$ הוא האלכסון שלו, והוא חוצה אותו לשני משולשים שווים. לכן שטח המשולש $18 : 2 = 9$.' },
    { kind: 'rule', fig: plane({ lines: [{ m: -2, b: 6 }], polygon: [[0, 0], [3, 0], [0, 6]], helper: [[0, 6], [3, 6], [3, 0]], points: [P('O', 0, 0), P('A', 0, 6), P('B', 3, 0), P('C', 3, 6)], words: [{ at: [0.6, 2.4], text: '6' }, { at: [1.6, 0.5], text: '3' }] }), text: 'שטח המשולש עם הצירים: מוצאים את שתי נקודות החיתוך, כופלים את המרחקים שלהן מהראשית ומחלקים ב־$2$.', display: 'S = \\frac{OA \\cdot OB}{2}',
      why: 'הצירים מאונכים, ולכן המשולש ישר־זווית בראשית. הוא חצי מהמלבן ש־$OA$ ו־$OB$ הן הצלעות שלו.' },
    { kind: 'predict', fig: plane({ lines: [{ m: 2, b: 4 }], polygon: [[0, 0], [-2, 0], [0, 4]], points: [P('O', 0, 0), P('B', -2, 0)] }), text: 'הישר $y = 2x + 4$ חותך את ציר $x$ ב־$(-2, 0)$. מה אורך הצלע $OB$?',
      choices: ['$-2$', '$2$', '$4$'], answer: 1,
      why: 'אורך הוא מרחק, ומרחק אינו שלילי. מ־$(0, 0)$ עד $(-2, 0)$ יש $2$ צעדים. המינוס אומר רק שהנקודה משמאל לראשית.',
      wrongWhy: { 0: 'הנקודה ב־$-2$, אבל הצלע היא המרחק אליה: $2$. עם $-2$ השטח היה יוצא שלילי, וזה לא ייתכן.', 2: '$4$ הוא החיתוך עם ציר $y$, הצלע השנייה.' } },
    { kind: 'predict', fig: plane({ lines: [{ m: 2, b: 4 }], polygon: [[0, 0], [-2, 0], [0, 4]], points: [P('O', 0, 0), P('A', 0, 4), P('B', -2, 0)] }), text: 'אז מה שטח המשולש שהישר $y = 2x + 4$ יוצר עם הצירים?',
      choices: ['$4$', '$8$', '$-4$'], answer: 0,
      why: 'הניצבים $2$ ו־$4$: $\\frac{2 \\cdot 4}{2} = 4$.',
      wrongWhy: { 1: '$2 \\cdot 4 = 8$ הוא שטח המלבן. המשולש חצי ממנו.', 2: 'שטח לא יכול להיות שלילי. הצלע היא $2$, לא $-2$.' } },
    { kind: 'explore', text: 'עכשיו הפוך: בנו ישר שחותך את ציר $y$ ב־$4$ ואת ציר $x$ ב־$2$.', manip: builder(), answer: { m: -2, b: 4 },
      hint: 'קודם $b = 4$. אחר כך שנו את $m$ עד שהישר עובר ב־$(2, 0)$: יורדים $4$ בשני צעדים.',
      success: '$y = -2x + 4$. הוא סוגר עם הצירים משולש עם ניצבים $4$ ו־$2$, ושטחו $\\frac{4 \\cdot 2}{2} = 4$.' },
    { kind: 'rule', fig: plane({ lines: [{ m: 2, b: 4 }], polygon: [[0, 0], [-2, 0], [0, 4]], points: [P('(−2, 0)', -2, 0), P('(0, 4)', 0, 4)], words: [{ at: [-4, 2], text: '|−2| = 2' }] }), text: 'גם כשנקודות החיתוך שליליות, הצלעות הן המרחקים מהראשית, בלי הסימן. אם הישר חותך את ציר $x$ ב־$(x_0, 0)$ ואת ציר $y$ ב־$(0, b)$:', display: 'S = \\frac{|x_0| \\cdot |b|}{2}',
      why: 'המרחק של $(-2, 0)$ מהראשית הוא $|-2| = 2$. הסימן אומר באיזה צד של הראשית הנקודה, לא כמה היא רחוקה. לכן השטח תמיד חיובי.' },
  ],
  examples: [
    { problem: 'מה שטח המשולש שהישר יוצר עם הצירים?', display: 'y = -3x - 6', answer: 6, check: 'abs(-6) * abs(-6 / 3) / 2',
      steps: [
        { action: 'חיתוך עם ציר $y$: מציבים $x = 0$.', why: 'על ציר $y$ לכל נקודה $x = 0$, ונשאר $b$.', result: 'y = -3 \\cdot 0 - 6 = -6 \\;\\Rightarrow\\; A(0, -6)', calc: { expr: '-3 * 0 - 6', value: -6 } },
        { action: 'חיתוך עם ציר $x$: מציבים $y = 0$.', why: 'מוסיפים $3x$ לשני האגפים: $3x = -6$, ומחלקים ב־$3$.', result: '0 = -3x - 6 \\;\\Rightarrow\\; x = \\frac{-6}{3} = -2 \\;\\Rightarrow\\; B(-2, 0)', calc: { expr: '-6 / 3', value: -2 } },
        { action: 'אורכי הניצבים: המרחקים מהראשית.', why: 'שתי הנקודות בצד השלילי, אבל אורך הוא מרחק: $6$ ו־$2$.', result: 'OA = 6, \\quad OB = 2', calc: { expr: 'abs(-2)', value: 2 } },
        { action: 'השטח: מכפלת הניצבים חלקי $2$.', why: 'המשולש ישר־זווית בראשית, חצי ממלבן $6 \\times 2$.', result: 'S = \\frac{6 \\cdot 2}{2} = 6', value: '6 * 2 / 2' },
      ] },
    { problem: 'בחצר שתי גדרות מאונכות, ושמים אותן על הצירים. שביל ישר עובר לפי המשוואה (במטרים). השביל והגדרות סוגרים ערוגה משולשת. מה שטח הערוגה במ״ר?', display: 'y = -\\frac{3}{4}x + 9', answer: 54, check: '9 * (9 / (3 / 4)) / 2',
      steps: [
        { action: 'הגדר שעל ציר $y$: מציבים $x = 0$.', why: 'השביל פוגש את הגדר הזאת במקום שבו $x = 0$.', result: 'y = 9 \\;\\Rightarrow\\; A(0, 9)', calc: { expr: '-3 / 4 * 0 + 9', value: 9 } },
        { action: 'הגדר שעל ציר $x$: מציבים $y = 0$ ומעבירים.', why: 'מוסיפים $\\frac{3}{4}x$ לשני האגפים.', result: '0 = -\\frac{3}{4}x + 9 \\;\\Rightarrow\\; \\frac{3}{4}x = 9' },
        { action: 'מחלקים ב־$\\frac{3}{4}$, כלומר כופלים ב־$\\frac{4}{3}$.', why: 'חילוק בשבר הוא כפל בשבר ההפוך.', result: 'x = 9 \\cdot \\frac{4}{3} = 12 \\;\\Rightarrow\\; B(12, 0)', calc: { expr: '9 * 4 / 3', value: 12 } },
        { action: 'השטח.', why: 'הערוגה היא משולש ישר־זווית בפינה שבין הגדרות, עם ניצבים $12$ ו־$9$.', result: 'S = \\frac{12 \\cdot 9}{2} = 54', value: '12 * 9 / 2' },
      ] },
  ],
  together: [
    { problem: 'נחשב יחד את שטח המשולש שהישר יוצר עם הצירים.', display: 'y = x - 5',
      steps: [
        { prompt: 'איפה הישר חותך את ציר $y$?', choices: [
          { text: '$(0, -5)$', ok: true, feedback: 'נכון: כש־$x = 0$, $y = -5$.' },
          { text: '$(0, 5)$', ok: false, feedback: 'כש־$x = 0$: $y = 0 - 5 = -5$. הסימן נשאר.' },
          { text: '$(5, 0)$', ok: false, feedback: 'זה החיתוך עם ציר $x$. על ציר $y$ ה־$x$ הוא $0$.' },
        ], hints: ['מציבים $x = 0$.', '$y = 0 - 5$.'], done: '$A(0, -5)$' },
        { prompt: 'ואיפה הוא חותך את ציר $x$?', choices: [
          { text: '$(5, 0)$', ok: true, feedback: 'נכון: $0 = x - 5$, ולכן $x = 5$.' },
          { text: '$(-5, 0)$', ok: false, feedback: 'בדקו: $-5 - 5 = -10$, לא $0$. כש־$-5$ עובר אגף הוא נעשה $5$.' },
          { text: '$(0, 0)$', ok: false, feedback: 'בראשית $y = 0 - 5 = -5$, לא $0$. הישר לא עובר בראשית.' },
        ], hints: ['מציבים $y = 0$.', '$0 = x - 5$: איזה מספר פחות $5$ נותן $0$?'], done: '$B(5, 0)$' },
        { prompt: 'מה אורכי הניצבים?', choices: [
          { text: '$5$ ו־$5$', ok: true, feedback: 'נכון: $(0, -5)$ רחוקה $5$ מהראשית, וגם $(5, 0)$.' },
          { text: '$-5$ ו־$5$', ok: false, feedback: 'אורך הוא מרחק ואינו שלילי. $(0, -5)$ רחוקה $5$ מהראשית.' },
          { text: '$1$ ו־$5$', ok: false, feedback: '$1$ הוא השיפוע. הניצבים הם המרחקים של נקודות החיתוך מהראשית.' },
        ], hints: ['כמה צעדים מהראשית עד כל נקודת חיתוך?', 'מ־$(0, 0)$ עד $(0, -5)$: חמישה צעדים למטה.'], done: 'הניצבים $5$ ו־$5$.' },
      ],
      final: { prompt: 'מה שטח המשולש?', answer: 12.5, check: '5 * 5 / 2', hints: ['מכפלת הניצבים, ואז חלקי $2$.', '$\\frac{5 \\cdot 5}{2} = \\frac{25}{2} = 12.5$.'] } },
    { problem: 'ועוד אחד, עם נקודת חיתוך שלילית.', display: 'y = 2x + 8',
      steps: [
        { prompt: 'איפה הישר חותך את ציר $x$?', choices: [
          { text: '$(-4, 0)$', ok: true, feedback: 'נכון: $2x = -8$, ולכן $x = -4$.' },
          { text: '$(4, 0)$', ok: false, feedback: 'בדקו: $2 \\cdot 4 + 8 = 16$, לא $0$. כש־$8$ עובר אגף הוא נעשה $-8$.' },
          { text: '$(-8, 0)$', ok: false, feedback: 'מ־$2x = -8$ צריך עוד לחלק ב־$2$.' },
        ], hints: ['$0 = 2x + 8$', '$2x = -8$, ומחלקים ב־$2$.'], done: '$B(-4, 0)$, והחיתוך עם ציר $y$ הוא $A(0, 8)$.' },
        { prompt: 'מה אורך הצלע שעל ציר $x$?', choices: [
          { text: '$4$', ok: true, feedback: 'נכון: מרחק אינו שלילי.' },
          { text: '$-4$', ok: false, feedback: 'הנקודה ב־$-4$, אבל הצלע היא המרחק מהראשית: $4$.' },
        ], hints: ['כמה צעדים מהראשית עד $(-4, 0)$?', 'ארבעה צעדים שמאלה: הצלע $4$.'], done: 'הניצבים $8$ ו־$4$.' },
      ],
      final: { prompt: 'מה שטח המשולש?', answer: 16, check: '8 * 4 / 2', hints: ['$\\frac{8 \\cdot 4}{2}$', '$32 : 2 = 16$.'] } },
  ],
  diag: triangleModel,
  transfer: triangleStory,
  misconceptions: [
    { id: 'no-half', title: 'שכחו לחלק ב־$2$: חישבו את המלבן',
      cause: 'מכפלת הניצבים היא השטח של המלבן כולו. המשולש הוא רק חצי ממנו.',
      explain: ['המשולש עם הצירים הוא חצי ממלבן: הישר הוא האלכסון שלו.', 'לכן אחרי הכפל מחלקים ב־$2$: $\\frac{6 \\cdot 3}{2} = 9$, לא $18$.'],
      remedy: [
        { kind: 'explore', text: 'הישר $y = -x + 4$ חותך את הצירים ב־$A(0, 4)$ וב־$B(4, 0)$. השלימו את המלבן $OBCA$.', manip: rectangle(4, 4), answer: [4, 4],
          hint: '$C$ נמצא מעל $B$, בגובה של $A$.', success: 'שטח המלבן $4 \\cdot 4 = 16$. הישר חוצה אותו לשני משולשים שווים, ולכן שטח המשולש $8$.' },
        { kind: 'predict', text: 'הניצבים של משולש עם הצירים הם $5$ ו־$2$. מה השטח?', choices: ['$10$', '$5$', '$7$'], answer: 1,
          why: '$5 \\cdot 2 = 10$ הוא המלבן. המשולש חצי ממנו: $5$.' },
      ],
      prereq: 'coord:4' },
    { id: 'added-sides', title: 'חיברו את הניצבים במקום לכפול',
      cause: 'שטח הוא כמה משבצות יש בפנים, לא כמה ארוך הגבול. חיבור של צלעות שייך להיקף.',
      explain: ['שטח של מלבן הוא אורך כפול רוחב: מספר השורות כפול מספר המשבצות בכל שורה.', 'המשולש חצי מהמלבן, ולכן השטח הוא מכפלת הניצבים חלקי $2$.'],
      remedy: [
        { kind: 'predict', text: 'מלבן $4 \\times 3$ על רשת. כמה משבצות יש בתוכו?', choices: ['$7$', '$12$'], answer: 1,
          why: '$3$ שורות של $4$ משבצות: $4 \\cdot 3 = 12$. החיבור $4 + 3$ הוא חצי מההיקף, משהו אחר.' },
        { kind: 'explore', text: 'הישר $y = -2x + 4$ חותך את הצירים ב־$A(0, 4)$ וב־$B(2, 0)$. השלימו את המלבן $OBCA$.', manip: rectangle(2, 4), answer: [2, 4],
          hint: '$C$ נמצא מעל $B$, בגובה של $A$.', success: 'במלבן $2 \\cdot 4 = 8$ משבצות, והמשולש חצי: $4$. לא $2 + 4 = 6$.' },
      ],
      prereq: 'coord:4' },
    { id: 'neg-length', title: 'השאירו אורך שלילי, והשטח יצא שלילי',
      cause: 'נקודת חיתוך יכולה להיות שלילית, כמו $(-3, 0)$. אבל אורך של צלע הוא מרחק, ומרחק אינו שלילי.',
      explain: ['המינוס אומר באיזה צד של הראשית הנקודה. המרחק עצמו בלי סימן: $(-3, 0)$ רחוקה $3$ מהראשית.', 'שטח הוא מספר משבצות, ולכן תמיד חיובי. אם יצא שטח שלילי, אחד האורכים נשאר עם סימן.'],
      remedy: [
        { kind: 'explore', text: 'הישר $y = 2x + 4$. שימו את הנקודה שבה הוא חותך את ציר $x$, וספרו כמה צעדים היא מהראשית.', display: 'y = 2x + 4', manip: onLine(2, 4, 'B'), answer: [-2, 0],
          hint: '$0 = 2x + 4$, ולכן $2x = -4$.', success: '$(-2, 0)$, שני צעדים משמאל לראשית. הצלע היא $2$, לא $-2$.' },
        { kind: 'predict', text: 'נקודות החיתוך הן $(-2, 0)$ ו־$(0, 4)$. מה השטח?', choices: ['$-4$', '$4$', '$8$'], answer: 1,
          why: 'הצלעות הן המרחקים $2$ ו־$4$: $\\frac{2 \\cdot 4}{2} = 4$. שטח תמיד חיובי.' },
      ],
      prereq: 'coord:3' },
    { id: 'no-divide', title: 'בחיתוך עם ציר $x$ לא חילקו ב־$m$, והצלע יצאה ארוכה מדי',
      cause: 'כדי למצוא את הצלע שעל ציר $x$ פותרים $mx = -b$. מי שעוצר כאן לוקח את $-b$ בתור $x$, והצלע יוצאת פי $|m|$ ארוכה מדי.',
      explain: ['בחיתוך עם ציר $x$: אחרי $mx = -b$ צריך עוד לחלק ב־$m$.', 'ב־$y = -3x + 6$: $3x = 6$, ולכן $x = 2$ והצלע $2$, לא $6$. השטח $\\frac{6 \\cdot 2}{2} = 6$.'],
      remedy: [
        { kind: 'explore', text: 'הישר $y = -3x + 6$. שימו את הנקודה שבה הוא חותך את ציר $x$.', display: 'y = -3x + 6', manip: onLine(-3, 6, 'B'), answer: [2, 0],
          hint: '$0 = -3x + 6$, ולכן $3x = 6$. כמה זה $x$?', success: '$(2, 0)$. הצלע שעל ציר $x$ היא $6 : 3 = 2$.' },
        { kind: 'predict', text: 'אז מה שטח המשולש של $y = -3x + 6$ עם הצירים?', choices: ['$18$', '$6$', '$12$'], answer: 1,
          why: 'הניצבים $6$ ו־$2$: $\\frac{6 \\cdot 2}{2} = 6$. עם $6$ ו־$6$ היה יוצא $18$.' },
      ],
      prereq: 'line:6' },
  ],
};

// ================================================================ stair 8: where two lines meet

type MeetP = { m1: number; b1: number; m2: number; b2: number; x: number; y: number; ask: number }; // ask 0: x, 1: y
const meetModel: DiagModel<MeetP> = {
  params: (rnd) => {
    for (;;) {
      const m1 = rnz(rnd, -4, 4); const m2 = rnz(rnd, -4, 4);
      if (m1 === m2) continue;
      const x = rint(rnd, -5, 5); const y = rint(rnd, -8, 8);
      const b1 = y - m1 * x; const b2 = y - m2 * x;
      if (abs(b1) <= 12 && abs(b2) <= 12) return { m1, b1, m2, b2, x, y, ask: rnd() < 0.6 ? 0 : 1 };
    }
  },
  text: (p) => `מצאו את נקודת המפגש של שני הישרים. מה שיעור ה־$${p.ask === 0 ? 'x' : 'y'}$ שלה?`,
  display: (p) => `${lineTex(p.m1, p.b1)}, \\qquad ${lineTex(p.m2, p.b2)}`,
  answer: (p) => (p.ask === 0 ? p.x : p.y),
  bugs: {
    // m1x − m2x = b2 + b1: the free number of the first line crossed over without changing sign
    'move-no-flip': (p) => (p.ask === 0 ? (p.b1 + p.b2) / (p.m1 - p.m2) : null),
    // divided by a negative coefficient and lost its minus (or subtracted in the wrong order)
    sign: (p) => (p.ask === 0 && p.x !== 0 ? -p.x : null),
    // stopped at (m1 − m2)x = b2 − b1
    'no-divide': (p) => (p.ask === 0 ? p.b2 - p.b1 : null),
    // asked for y, gave the x just found
    'forgot-y': (p) => (p.ask === 1 ? p.x : null),
  },
  solution: (p) => {
    const d = p.m1 - p.m2;
    return [
      `בנקודת המפגש ה־$y$ שווה: $${rhs(p.m1, p.b1)} = ${rhs(p.m2, p.b2)}$`,
      `אוספים את ה־$x$ לאגף אחד ואת המספרים לשני: $${mx(d)} = ${T(p.b2 - p.b1)}$`,
      ...(d === 1 ? [] : [`מחלקים ב־$${T(d)}$: $x = ${T(p.x)}$`]),
      `מציבים בישר הראשון: $y = ${T(p.m1)} \\cdot ${T(p.x, true)}${plus(p.b1)} = ${T(p.y)}$`,
      `בדיקה בישר השני: $${T(p.m2)} \\cdot ${T(p.x, true)}${plus(p.b2)} = ${T(p.y)}$`,
      `נקודת המפגש: $(${T(p.x)}, ${T(p.y)})$`,
    ];
  },
  hint: (p) => (p.ask === 0
    ? 'משווים את שני הביטויים של $y$, אוספים את ה־$x$ לאגף אחד ואת המספרים לשני, ומחלקים במקדם של $x$.'
    : 'קודם מוצאים את $x$ מהשוואת הביטויים. אחר כך מציבים אותו באחת המשוואות ומקבלים את $y$.'),
};

/** Two stories that meet: a1 + r1·x (bigger start, slower) and a2 + r2·x (smaller start, faster); burning candles have r < 0. */
type MeetStory = { k: number; a1: number; r1: number; a2: number; r2: number; x: number; ask: number };
const meetY = (p: MeetStory) => p.a1 + p.r1 * p.x;
const meetStory: DiagModel<MeetStory> = {
  params: (rnd) => {
    for (;;) {
      const k = rnd() < 0.5 ? 0 : 1; const ask = rnd() < 0.6 ? 0 : 1;
      if (k === 0) {
        // gyms: a registration fee and a price per session
        const r1 = rint(rnd, 2, 8) * 5; const r2 = r1 + rint(rnd, 1, 4) * 5; const x = rint(rnd, 2, 12); const a2 = rint(rnd, 1, 10) * 10;
        const a1 = a2 + (r2 - r1) * x;
        if (a1 <= 400) return { k, a1, r1, a2, r2, x, ask };
      } else {
        // candles: a taller one that burns faster catches up with a shorter one
        const rB = rint(rnd, 1, 3); const rA = rB + rint(rnd, 1, 3); const x = rint(rnd, 2, 6); const hB = rint(rnd, 10, 30);
        const hA = hB + (rA - rB) * x;
        if (hB - rB * x >= 2) return { k, a1: hA, r1: -rA, a2: hB, r2: -rB, x, ask };
      }
    }
  },
  text: (p) => (p.k === 0
    ? `במכון כושר א׳ משלמים דמי הרשמה של $${p.a1}$ ש״ח ועוד $${p.r1}$ ש״ח לכל אימון. במכון ב׳ דמי ההרשמה $${p.a2}$ ש״ח ועוד $${p.r2}$ ש״ח לכל אימון. ${p.ask === 0 ? 'אחרי כמה אימונים המחיר הכולל בשני המכונים שווה?' : 'כשהמחיר הכולל בשני המכונים שווה, כמה הוא בש״ח?'}`
    : `נר א׳ בגובה $${p.a1}$ ס״מ ומתקצר ב־$${-p.r1}$ ס״מ בכל שעה. נר ב׳ בגובה $${p.a2}$ ס״מ ומתקצר ב־$${-p.r2}$ ס״מ בכל שעה. מדליקים את שניהם יחד. ${p.ask === 0 ? 'אחרי כמה שעות הם יהיו באותו גובה?' : 'מה יהיה הגובה שלהם, בס״מ, כשהם יהיו באותו גובה?'}`),
  answer: (p) => (p.ask === 0 ? p.x : meetY(p)),
  bugs: {
    // the difference of the starts, not divided by the difference of the rates
    'no-divide': (p) => (p.ask === 0 ? p.a1 - p.a2 : null),
    // r1·x + a1 = r2·x + a2 → (r2 − r1)·x = a1 + a2: a2 crossed over keeping its sign
    'move-no-flip': (p) => (p.ask === 0 ? (p.a1 + p.a2) / (p.r2 - p.r1) : null),
    'forgot-y': (p) => (p.ask === 1 ? p.x : null),
  },
  solution: (p) => {
    const R = p.r2 - p.r1; const D = p.a1 - p.a2; const y = meetY(p);
    const v = p.k === 0 ? 'x' : 't';
    const e1 = p.k === 0 ? `${mx(p.r1)} + ${p.a1}` : `${p.a1} - ${mx(-p.r1, 't')}`;
    const e2 = p.k === 0 ? `${mx(p.r2)} + ${p.a2}` : `${p.a2} - ${mx(-p.r2, 't')}`;
    return [
      p.k === 0 ? `מכון א׳: $y = ${e1}$. מכון ב׳: $y = ${e2}$.` : `נר א׳: $h = ${e1}$. נר ב׳: $h = ${e2}$.`,
      `הם שווים בנקודת המפגש: $${e1} = ${e2}$`,
      R === 1 ? `אוספים: $${D} = ${v}$` : `אוספים: $${D} = ${mx(R, v)}$, ולכן $${v} = ${p.x}$`,
      `מציבים: ${p.k === 0 ? `$${p.r1} \\cdot ${p.x} + ${p.a1} = ${y}$ ש״ח` : `$${p.a1} - ${-p.r1} \\cdot ${p.x} = ${y}$ ס״מ`}, ובדיקה בשני: ${p.k === 0 ? `$${p.r2} \\cdot ${p.x} + ${p.a2} = ${y}$` : `$${p.a2} - ${-p.r2} \\cdot ${p.x} = ${y}$`}`,
    ];
  },
  hint: (p) => (p.k === 0
    ? 'כתבו משוואה לכל מכון: $y$ הוא המחיר אחרי $x$ אימונים. בנקודת המפגש המחירים שווים.'
    : 'כתבו משוואה לכל נר: הגובה אחרי $t$ שעות. בנקודת המפגש הגבהים שווים.'),
};

const stair8: StairContent = {
  skill: 'line:8', topic: 'line', level: 8, title: 'נקודת מפגש של שני ישרים',
  objectives: [
    'להבין שבנקודת המפגש לשני הישרים אותו $x$ ואותו $y$.',
    'למצוא את $x$ מהמשוואה $m_1x + b_1 = m_2x + b_2$, ואז את $y$ בהצבה.',
    'לבדוק את הנקודה בשתי המשוואות, ולפרש אותה בבעיה מהחיים.',
  ],
  idea: 'נקודת המפגש נמצאת על שני הישרים, ולכן באותו $x$ שניהם נותנים אותו $y$. משווים את שני הביטויים, מוצאים את $x$, ומציבים כדי למצוא את $y$.',
  why: [
    'כל ישר הוא אוסף הנקודות שמקיימות את המשוואה שלו. נקודה ששייכת לשניהם מקיימת את שתי המשוואות יחד.',
    'בשתי המשוואות $y$ שווה לביטוי עם $x$. כש־$y$ שווה, גם הביטויים שווים: $m_1x + b_1 = m_2x + b_2$. זו משוואה עם נעלם אחד.',
    'ה־$x$ שמצאתם הוא רק חצי מהנקודה. מציבים אותו באחת המשוואות ומקבלים $y$. הצבה בשנייה חייבת לתת אותו $y$, וזו הבדיקה.',
  ],
  alt: [
    'בטבלה: כותבים את ה־$y$ של שני הישרים לאותם ערכי $x$, ומחפשים את העמודה שבה הם שווים. ב־$y = 3x - 2$ וב־$y = -2x + 8$: כש־$x = 2$ שניהם נותנים $4$.',
    'חשבו על שני חברים שחוסכים: אחד מתחיל עם יותר וחוסך לאט, השני מתחיל עם פחות וחוסך מהר. נקודת המפגש היא השבוע שבו יש להם אותו סכום.',
    'ואם השיפועים שווים? אז ה־$x$ מתבטל: הישרים מקבילים ולא נפגשים, או שהם בכלל אותו ישר.',
  ],
  discover: [
    { kind: 'say', fig: plane({ lines: [{ m: 1, b: 2 }, { m: -2, b: -1 }], meet: true, anim: true }), mood: 'happy', text: 'שני ישרים עם שיפועים שונים נפגשים בנקודה אחת בדיוק. איך מוצאים אותה בלי לצייר?' },
    { kind: 'predict', fig: TWO, text: 'בטבלה ה־$y$ של שני ישרים לכמה ערכים של $x$. באיזו נקודה הם נפגשים?',
      display: tab([0, 1, 2, 3], [['3x - 2', [-2, 1, 4, 7]], ['-2x + 8', [8, 6, 4, 2]]]),
      choices: ['$(2, 4)$', '$(4, 2)$', '$(1, 6)$'], answer: 0,
      why: 'כש־$x = 2$ שני הישרים נותנים $y = 4$: אותו $x$ ואותו $y$, ולכן זו נקודה של שניהם.',
      wrongWhy: { 1: 'נקודה כותבים $(x, y)$: קודם $x = 2$, אחר כך $y = 4$.', 2: 'כש־$x = 1$ הישר הראשון נותן $1$ והשני $6$. הם עוד לא באותו גובה.' } },
    { kind: 'explore', text: 'על הגרף הישר $y = x + 1$. הישר השני הוא $y = -x + 5$. שימו על הישר המצויר את הנקודה שנמצאת גם על הישר השני.', display: 'y = x + 1, \\qquad y = -x + 5',
      manip: onLine(1, 1, 'E'), answer: [2, 3],
      hint: 'בחרו נקודה על הישר המצויר ובדקו אותה בישר השני. למשל $(1, 2)$: $-1 + 5 = 4$, לא $2$. נסו $x$ אחר.',
      success: '$(2, 3)$: בישר הראשון $2 + 1 = 3$, ובשני $-2 + 5 = 3$. אותו $x$, אותו $y$.' },
    { kind: 'say', fig: plane({ lines: [{ m: 3, b: -2 }, { m: -3, b: 12 }] }), mood: 'thinking', text: 'לנסות נקודות זה איטי. ואם הנקודה היא $(\\frac{7}{3}, 5)$, לא נמצא אותה על הרשת בכלל. בואו נחשב.' },
    { kind: 'predict', fig: TWO, text: 'בנקודת המפגש של $y = 3x - 2$ ו־$y = -2x + 8$ ה־$y$ של שניהם שווה. איזו משוואה נכונה שם?',
      choices: ['$3x - 2 = -2x + 8$', '$3x - 2 = 0$', '$3x = -2x$'], answer: 0,
      why: 'שני הביטויים הם אותו $y$, ולכן הם שווים זה לזה. נשאר נעלם אחד: $x$.',
      wrongWhy: { 1: '$= 0$ מוצא את החיתוך עם ציר $x$, לא עם הישר השני.', 2: 'אם משמיטים את המספרים החופשיים, משנים את הישרים.' } },
    { kind: 'rule', fig: plane({ lines: TWO_LINES, meet: true }), text: 'נקודת מפגש: משווים את שני הביטויים של $y$ ופותרים את $x$.', display: 'm_1x + b_1 = m_2x + b_2',
      why: 'הנקודה על שני הישרים, ולכן באותו $x$ ה־$y$ של שניהם שווה. כש־$y = y$, גם הביטויים שווים.' },
    { kind: 'predict', fig: TWO, text: '$3x - 2 = -2x + 8$. איך אוספים את ה־$x$ לאגף אחד?',
      choices: ['מוסיפים $2x$ לשני האגפים: $5x - 2 = 8$', 'מחסירים $2x$ משני האגפים: $x - 2 = 8$', 'מוסיפים $2x$ רק לאגף ימין'], answer: 0,
      why: 'באגף ימין $-2x + 2x = 0$, ובשמאל $3x + 2x = 5x$. ממשיכים: $5x = 10$, ולכן $x = 2$.',
      wrongWhy: { 1: 'באגף ימין יש $-2x$. כדי לבטל אותו מוסיפים $2x$, לא מחסירים.', 2: 'מה שעושים באגף אחד עושים גם בשני, אחרת השוויון נשבר.' } },
    { kind: 'predict', fig: plane({ lines: TWO_LINES, helper: [[2, -6], [2, 6]] }), text: 'מצאנו $x = 2$. מה נקודת המפגש?',
      choices: ['$(2, 4)$', '$(2, 0)$', '$(2, 2)$'], answer: 0,
      why: 'מציבים $x = 2$ באחת המשוואות: $3 \\cdot 2 - 2 = 4$. ובודקים בשנייה: $-2 \\cdot 2 + 8 = 4$. הנקודה $(2, 4)$.',
      wrongWhy: { 1: '$y = 0$ רק על ציר $x$. כאן צריך להציב ולמצוא את $y$.', 2: '$2$ הוא ה־$x$. ה־$y$ יוצא מההצבה: $3 \\cdot 2 - 2 = 4$.' } },
    { kind: 'rule', fig: plane({ lines: TWO_LINES, meet: true, helper: [[2, -6], [2, 6]] }), text: 'אחרי שמוצאים את $x$, מציבים אותו באחת המשוואות ומקבלים $y$. מציבים גם בשנייה, כדי לבדוק.', display: 'y = m_1x + b_1 = m_2x + b_2',
      why: 'הנקודה צריכה להיות על שני הישרים. אם שתי ההצבות נותנות אותו $y$, היא באמת על שניהם. אם לא, יש טעות בחישוב של $x$.' },
    { kind: 'explore', text: 'נסו לבד: $y = 2x - 3$ (מצויר) ו־$y = -x + 3$. חשבו את נקודת המפגש ושימו אותה על הגרף.', display: 'y = 2x - 3, \\qquad y = -x + 3',
      manip: onLine(2, -3, 'E'), answer: [2, 1],
      hint: '$2x - 3 = -x + 3$. מוסיפים $x$ ו־$3$ לשני האגפים: $3x = 6$.',
      success: '$x = 2$, ו־$y = 2 \\cdot 2 - 3 = 1$. בדיקה: $-2 + 3 = 1$. הנקודה $(2, 1)$.' },
  ],
  examples: [
    { problem: 'מצאו את נקודת המפגש של הישרים. מה שיעור ה־$y$ שלה?', display: 'y = 4x - 7, \\qquad y = x + 2', answer: 5, check: '(2 + 7) / (4 - 1) + 2',
      steps: [
        { action: 'משווים את שני הביטויים של $y$.', why: 'בנקודת המפגש ה־$y$ של שני הישרים שווה.', result: '4x - 7 = x + 2' },
        { action: 'מחסירים $x$ משני האגפים.', why: 'אוספים את ה־$x$ לאגף אחד.', result: '3x - 7 = 2' },
        { action: 'מוסיפים $7$ לשני האגפים ומחלקים ב־$3$.', why: 'אוספים את המספרים לאגף השני, ואז מבטלים את הכפל ב־$3$.', result: '3x = 9 \\;\\Rightarrow\\; x = 3', calc: { expr: '9 / 3', value: 3 } },
        { action: 'מציבים $x = 3$ במשוואה הפשוטה יותר.', why: 'הנקודה על הישר $y = x + 2$, ולכן ה־$y$ שלה הוא $3 + 2$.', result: 'y = 3 + 2 = 5', value: '3 + 2' },
        { action: 'בודקים בישר השני.', why: 'הנקודה צריכה להיות גם עליו.', result: '4 \\cdot 3 - 7 = 5 \\;\\Rightarrow\\; E(3, 5)', calc: { expr: '4 * 3 - 7', value: 5 } },
      ] },
    { problem: 'בחברת סלולר א׳ משלמים $30$ ש״ח בחודש ועוד $0.5$ ש״ח לכל דקת שיחה. בחברה ב׳ משלמים $10$ ש״ח בחודש ועוד $1$ ש״ח לכל דקה. אחרי כמה דקות המחיר בשתי החברות שווה?', answer: 40, check: '(30 - 10) / (1 - 0.5)',
      steps: [
        { action: 'כותבים משוואה לכל חברה: $x$ דקות, $y$ ש״ח.', why: 'מחיר קבוע ועוד מחיר לכל דקה: פונקציה קווית.', result: 'y = 0.5x + 30, \\qquad y = x + 10' },
        { action: 'המחיר שווה, ולכן משווים.', why: 'נקודת המפגש היא מספר הדקות שבו שני המחירים זהים.', result: '0.5x + 30 = x + 10' },
        { action: 'מחסירים $0.5x$ ו־$10$ משני האגפים.', why: 'אוספים את ה־$x$ לאגף שבו המקדם גדול יותר, כך שהוא נשאר חיובי.', result: '20 = 0.5x' },
        { action: 'מחלקים ב־$0.5$, כלומר כופלים ב־$2$.', why: 'חצי מ־$x$ הוא $20$, ולכן $x$ כולו $40$.', result: 'x = 40', value: '20 / 0.5' },
        { action: 'מציבים כדי למצוא את המחיר, ובודקים בשתי החברות.', why: 'בשתי החברות צריך לצאת אותו מחיר.', result: '40 + 10 = 50, \\qquad 0.5 \\cdot 40 + 30 = 50', calc: { expr: '0.5 * 40 + 30', value: 50 } },
        { action: 'מפרשים את הנקודה $(40, 50)$.', why: 'פחות מ־$40$ דקות, חברה ב׳ זולה יותר. יותר מ־$40$ דקות, חברה א׳ זולה יותר.', result: 'E(40, 50)' },
      ] },
  ],
  together: [
    { problem: 'נמצא יחד את נקודת המפגש.', display: 'y = 2x + 1, \\qquad y = -x + 7',
      steps: [
        { prompt: 'מה הצעד הראשון?', choices: [
          { text: 'משווים: $2x + 1 = -x + 7$', ok: true, feedback: 'נכון: בנקודת המפגש ה־$y$ שווה.' },
          { text: 'מציבים $x = 0$ בשתי המשוואות', ok: false, feedback: '$x = 0$ נותן את החיתוך של כל ישר עם ציר $y$: $(0, 1)$ ו־$(0, 7)$. אלה שתי נקודות שונות.' },
          { text: 'מציבים $y = 0$ בשתי המשוואות', ok: false, feedback: '$y = 0$ נותן חיתוך עם ציר $x$. אנחנו מחפשים נקודה ששייכת לשני הישרים.' },
        ], hints: ['מה שווה בשני הישרים בנקודת המפגש?', 'אותו $y$: $2x + 1 = -x + 7$.'], done: '$2x + 1 = -x + 7$' },
        { prompt: 'איך אוספים את ה־$x$?', choices: [
          { text: 'מוסיפים $x$ לשני האגפים: $3x + 1 = 7$', ok: true, feedback: 'נכון: $-x + x = 0$.' },
          { text: 'מחסירים $x$: $x + 1 = 7$', ok: false, feedback: 'באגף ימין יש $-x$. חיסור של $x$ נותן שם $-2x$. מוסיפים $x$ כדי לבטל אותו.' },
          { text: 'מעבירים: $2x - x + 1 = 7$', ok: false, feedback: 'כש־$-x$ עובר לאגף השני הוא נעשה $x$: $2x + x$.' },
        ], hints: ['מה מבטל את $-x$?', 'מוסיפים $x$ לשני האגפים: $2x + x = 3x$.'], done: '$3x + 1 = 7$' },
        { prompt: '$3x + 1 = 7$. מה $x$?', choices: [
          { text: '$x = 2$', ok: true, feedback: 'נכון: $3x = 6$, ולכן $x = 2$.' },
          { text: '$x = \\frac{8}{3}$', ok: false, feedback: 'כשמעבירים את $1$ הוא נעשה $-1$: $3x = 7 - 1 = 6$.' },
          { text: '$x = 6$', ok: false, feedback: '$6$ הוא $3x$. צריך עוד לחלק ב־$3$.' },
        ], hints: ['קודם מחסירים $1$, אחר כך מחלקים ב־$3$.', '$3x = 6$, ולכן $x = 2$.'], done: '$x = 2$' },
      ],
      final: { prompt: 'מה שיעור ה־$y$ של נקודת המפגש?', answer: 5, check: '2 * 2 + 1', hints: ['מציבים $x = 2$ באחת המשוואות.', '$2 \\cdot 2 + 1 = 5$, ובשנייה $-2 + 7 = 5$. הנקודה $(2, 5)$.'] } },
    { problem: 'ועוד אחד, עם $x$ שלילי.', display: 'y = -2x + 1, \\qquad y = x + 7',
      steps: [
        { prompt: '$-2x + 1 = x + 7$. מה מקבלים אחרי שמחסירים $x$ ו־$1$ משני האגפים?', choices: [
          { text: '$-3x = 6$', ok: true, feedback: 'נכון: $-2x - x = -3x$, ו־$7 - 1 = 6$.' },
          { text: '$-x = 6$', ok: false, feedback: '$-2x - x$ הוא $-3x$, לא $-x$.' },
          { text: '$-3x = 8$', ok: false, feedback: 'כש־$1$ עובר אגף הוא נעשה $-1$: $7 - 1 = 6$.' },
        ], hints: ['באגף שמאל: $-2x - x$. באגף ימין: $7 - 1$.', '$-3x = 6$'], done: '$-3x = 6$' },
        { prompt: 'מה $x$?', choices: [
          { text: '$x = -2$', ok: true, feedback: 'נכון: חיובי חלקי שלילי הוא שלילי.' },
          { text: '$x = 2$', ok: false, feedback: 'בדיקה: $-3 \\cdot 2 = -6$, לא $6$. חיובי חלקי שלילי הוא שלילי.' },
          { text: '$x = 3$', ok: false, feedback: '$3$ יוצא מ־$6 - 3$. אבל $-3$ כופל את $x$, ולכן מחלקים: $6 : (-3)$.' },
        ], hints: ['מחלקים את שני האגפים ב־$-3$.', '$6 : (-3) = -2$'], done: '$x = -2$' },
      ],
      final: { prompt: 'מה שיעור ה־$y$ של נקודת המפגש?', answer: 5, check: '-2 + 7', hints: ['מציבים $x = -2$ ב־$y = x + 7$.', '$-2 + 7 = 5$. בדיקה: $-2 \\cdot (-2) + 1 = 5$. הנקודה $(-2, 5)$.'] } },
  ],
  diag: meetModel,
  transfer: meetStory,
  misconceptions: [
    { id: 'move-no-flip', title: 'העבירו מספר לאגף השני בלי להפוך את הסימן שלו',
      cause: 'ב־$m_1x + b_1 = m_2x + b_2$ מעבירים גם $x$ וגם מספרים. כשמעבירים כמה איברים בבת אחת, קל לשכוח להפוך את הסימן של אחד מהם.',
      explain: [
        'להעביר איבר זה לחסר (או להוסיף) אותו בשני האגפים, ולכן הוא מחליף סימן.',
        'ב־$3x + 4 = x + 10$ מחסירים $x$ ו־$4$: $2x = 10 - 4 = 6$, ו־$x = 3$. מי שכותב $10 + 4$ מקבל $x = 7$.',
        'הבדיקה מגלה את זה מיד: כש־$x = 7$ הישר הראשון נותן $25$ והשני $17$.',
      ],
      remedy: [
        { kind: 'predict', text: '$3x + 4 = x + 10$. מה מקבלים אחרי שמחסירים $x$ ו־$4$ משני האגפים?', choices: ['$2x = 14$', '$2x = 6$'], answer: 1,
          why: 'מחסירים $4$ גם מימין: $10 - 4 = 6$. ולכן $x = 3$, ובשני הישרים $y = 13$.' },
        { kind: 'explore', text: 'הישר $y = x + 1$ מצויר. הישר השני הוא $y = 3x - 3$. שימו את נקודת המפגש.', display: 'y = x + 1, \\qquad y = 3x - 3', manip: onLine(1, 1, 'E'), answer: [2, 3],
          hint: 'מחסירים $x$ ומוסיפים $3$ לשני האגפים: $4 = 2x$.', success: '$x = 2$ ו־$y = 3$. בדיקה: $3 \\cdot 2 - 3 = 3$.' },
      ] },
    { id: 'sign', title: 'שיעור ה־$x$ של נקודת המפגש יצא עם הסימן ההפוך',
      cause: 'בסוף מחלקים במקדם של $x$, ולפעמים הוא שלילי. מי ששוכח את המינוס שלו, או מחסר בסדר ההפוך, מקבל את המספר הנגדי.',
      explain: ['ב־$-3x = 6$ מחלקים ב־$-3$: $x = -2$. חיובי חלקי שלילי הוא שלילי.', 'הבדיקה בשתי המשוואות תופסת את זה: עם הסימן הלא נכון ה־$y$ לא יוצא שווה.'],
      remedy: [
        { kind: 'predict', text: '$-2x = 8$. מה $x$?', choices: ['$4$', '$-4$'], answer: 1,
          why: '$-2 \\cdot (-4) = 8$, ולכן $x = -4$. ועם $4$: $-2 \\cdot 4 = -8$.' },
        { kind: 'explore', text: 'הישר $y = -x + 1$ מצויר. הישר השני: $y = x + 5$. שימו את נקודת המפגש.', display: 'y = -x + 1, \\qquad y = x + 5', manip: onLine(-1, 1, 'E'), answer: [-2, 3],
          hint: '$-x + 1 = x + 5$, ולכן $-2x = 4$. מחלקים ב־$-2$.', success: '$x = -2$ ו־$y = 3$: הנקודה משמאל לציר $y$. בדיקה: $-2 + 5 = 3$.' },
      ],
      prereq: 'signed:3' },
    { id: 'no-divide', title: 'עצרו לפני החילוק במקדם של $x$',
      cause: 'אחרי שאוספים מקבלים משהו כמו $3x = 12$: זה $3$ פעמים $x$, עוד לא $x$.',
      explain: ['$3x = 12$: שלוש פעמים $x$ הן $12$, ולכן $x = 4$.', 'בסיפור: אם בכל דקה ההפרש בין המחירים קטן ב־$2$ ש״ח, הפרש של $12$ ש״ח נעלם אחרי $12 : 2 = 6$ דקות, לא $12$.'],
      remedy: [
        { kind: 'predict', text: '$4x = 12$. מה $x$?', choices: ['$12$', '$3$', '$8$'], answer: 1,
          why: '$4 \\cdot 3 = 12$, ולכן $x = 3$. $12$ הוא ארבע פעמים $x$, לא $x$ עצמו.' },
        { kind: 'explore', text: 'הישר $y = x + 2$ מצויר. הישר השני: $y = 3x - 4$. שימו את נקודת המפגש.', display: 'y = x + 2, \\qquad y = 3x - 4', manip: onLine(1, 2, 'E'), answer: [3, 5],
          hint: '$3x - 4 = x + 2$, ולכן $2x = 6$.', success: '$2x = 6$, ולכן $x = 3$ ולא $6$. ו־$y = 3 + 2 = 5$.' },
      ] },
    { id: 'forgot-y', title: 'מצאו את $x$ ולא הציבו כדי למצוא את $y$',
      cause: 'פתרון המשוואה נותן רק את $x$. לנקודה יש שני שיעורים, וה־$y$ מגיע מהצבה.',
      explain: ['$x$ אומר באיזה מקום לאורך ציר $x$ הישרים נפגשים. כדי לדעת באיזה גובה, מציבים אותו באחת המשוואות.', 'דוגמה: $x = 2$ במפגש של $y = 3x - 2$ ו־$y = -2x + 8$. $y = 3 \\cdot 2 - 2 = 4$, והנקודה $(2, 4)$.'],
      remedy: [
        { kind: 'explore', text: 'הישרים $y = 3x - 2$ (מצויר) ו־$y = -2x + 8$ נפגשים כש־$x = 2$. שימו את נקודת המפגש.', display: 'y = 3x - 2', manip: onLine(3, -2, 'E'), answer: [2, 4],
          hint: 'מציבים $x = 2$: $y = 3 \\cdot 2 - 2$.', success: '$(2, 4)$. ה־$y$ הוא $4$, לא $2$.' },
        { kind: 'predict', text: 'שני ישרים נפגשים כש־$x = 1$, והראשון הוא $y = 5x + 2$. מה שיעור ה־$y$ של נקודת המפגש?', choices: ['$1$', '$7$', '$5$'], answer: 1,
          why: '$y = 5 \\cdot 1 + 2 = 7$. הנקודה $(1, 7)$.' },
      ],
      prereq: 'line:1' },
  ],
};

export const LINE2: StairContent[] = [stair5, stair6, stair7, stair8];
/** Names of misconceptions new to this topic (merged into the topic's cats so the board can name them). */
export const CATS_LINE2: Record<string, string> = {
  'move-no-flip': 'העבירו איבר לאגף השני בלי להפוך את הסימן שלו',
  'no-divide': 'שכחו לחלק במקדם של $x$',
  'neg-length': 'השאירו אורך שלילי, והשטח יצא שלילי',
};
export { equationModel, axesModel, triangleModel, meetModel };
