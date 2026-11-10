// The coordinate plane (מערכת צירים), grade 7. The plane is two number lines that cross at zero, and the
// draggable plane is the model throughout: a point is a walk from the origin (first along x, then along y),
// a quadrant is a pair of signs, a length is a distance on one of the lines, an area counts squares in rows,
// and a missing vertex borrows one coordinate from each neighbour.
import type { DiagModel, StairContent } from '../types';
import { rint, rnz, rpick } from '../expr';
// @ts-ignore: plain JS helpers shared with the exercise generators
import { T } from '@/content/util.js';

/** Metres in a story, with the number agreeing in Hebrew: "מטר אחד", "$5$ מטרים". */
const metres = (n: number) => (n === 1 ? 'מטר אחד' : `$${n}$ מטרים`);
const plot = (label: string, more: Record<string, unknown> = {}) => ({ kind: 'plot' as const, range: 6, label, start: null, ...more });
const corner = (label: string, x: number, y: number) => ({ label, at: [x, y] });
const pt = (x: number, y: number) => `(${x}, ${y})`;
const steps = (n: number) => (n === 1 ? 'צעד אחד' : `${n} צעדים`);
const XY = (ask: number) => (ask ? 'y' : 'x');
type Rnd = () => number;
const shuffled = <V>(rnd: Rnd, a: V[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ---------------------------------------------------------------- stair 1: reading a point

type ReadP = { k: number; x: number; y: number; ask: number; rev: number }; // k 0: a walk, 1: a point on an axis
const horiz = (x: number) => `${steps(Math.abs(x))} ${x > 0 ? 'ימינה' : 'שמאלה'}`;
const vert = (y: number) => `${steps(Math.abs(y))} ${y > 0 ? 'למעלה' : 'למטה'}`;
const readAns = (p: { x: number; y: number; ask: number }) => (p.ask ? p.y : p.x);

const readModel: DiagModel<ReadP> = {
  // mostly a walk (sometimes told up or down first: the trap of the order), and points that sit on an axis
  params: (rnd) => {
    if (rnd() < 0.7) {
      let x = 0; let y = 0;
      do { x = rnz(rnd, -6, 6); y = rnz(rnd, -6, 6); } while (Math.abs(x) === Math.abs(y));
      return { k: 0, x, y, ask: rint(rnd, 0, 1), rev: rnd() < 0.35 ? 1 : 0 };
    }
    const a = rnz(rnd, -6, 6); const onX = rnd() < 0.5;
    return { k: 1, x: onX ? a : 0, y: onX ? 0 : a, ask: rint(rnd, 0, 1), rev: 0 };
  },
  text: (p) => {
    const q = `מה שיעור ה־$${XY(p.ask)}$ של $P$?`;
    if (p.k === 0) return `מהראשית הולכים ${p.rev ? vert(p.y) : horiz(p.x)}, ואז ${p.rev ? horiz(p.x) : vert(p.y)}, ומגיעים לנקודה $P$. ${q}`;
    return p.y === 0
      ? `הנקודה $P$ נמצאת על ציר $x$, ${steps(Math.abs(p.x))} ${p.x > 0 ? 'מימין' : 'משמאל'} לראשית. ${q}`
      : `הנקודה $P$ נמצאת על ציר $y$, ${steps(Math.abs(p.y))} ${p.y > 0 ? 'מעל' : 'מתחת'} לראשית. ${q}`;
  },
  answer: readAns,
  bugs: {
    // x and y change places
    swap: (p) => (p.ask ? p.x : p.y),
    // the distance is right, the direction (left or down) lost its minus
    sign: (p) => (readAns(p) !== 0 ? -readAns(p) : null),
    // "on the x-axis" read as "x = 0"
    'axis-zero': (p) => (p.k === 1 ? (p.ask ? p.x : p.y) : null),
  },
  solution: (p) => {
    const out: string[] = [];
    if (p.k === 0) {
      out.push(`$x$ אומר כמה זזים ימינה או שמאלה: ${horiz(p.x)}, ולכן $x = ${T(p.x)}$.`);
      out.push(`$y$ אומר כמה זזים למעלה או למטה: ${vert(p.y)}, ולכן $y = ${T(p.y)}$.`);
    } else if (p.y === 0) {
      out.push('על ציר $x$ לא עולים ולא יורדים, ולכן $y = 0$.');
      out.push(`הולכים ${horiz(p.x)}, ולכן $x = ${T(p.x)}$.`);
    } else {
      out.push('על ציר $y$ לא זזים ימינה או שמאלה, ולכן $x = 0$.');
      out.push(`הולכים ${vert(p.y)}, ולכן $y = ${T(p.y)}$.`);
    }
    out.push(`$P${pt(p.x, p.y)}$, ושיעור ה־$${XY(p.ask)}$ שלה הוא $${T(readAns(p))}$.`);
    return out;
  },
  hint: (p) => (p.k === 0
    ? (p.rev ? 'בזוג $(x, y)$ קודם התזוזה ימינה או שמאלה, גם כשבתיאור הלכו קודם למעלה או למטה.' : 'שמאלה ולמטה הם הכיוונים השליליים. $x$ הוא ימינה או שמאלה, $y$ הוא למעלה או למטה.')
    : (p.y === 0 ? 'על ציר $x$ הולכים רק ימינה או שמאלה. איזה שיעור נשאר אפס?' : 'על ציר $y$ הולכים רק למעלה או למטה. איזה שיעור נשאר אפס?')),
};

type MapP = { k: number; x: number; y: number; ask: number; rev: number; n: number };
const PLACES = ['הספרייה', 'הבריכה', 'המאפייה'];
const streets = (n: number) => (n === 1 ? 'רחוב אחד' : `${n} רחובות`);
const mapModel: DiagModel<MapP> = {
  // the same reading on a map (east and north instead of right and up) and as a robot's two commands
  params: (rnd) => {
    let x = 0; let y = 0;
    do { x = rnz(rnd, -6, 6); y = rnz(rnd, -6, 6); } while (Math.abs(x) === Math.abs(y));
    return { k: rnd() < 0.55 ? 0 : 1, x, y, ask: rint(rnd, 0, 1), rev: rnd() < 0.4 ? 1 : 0, n: rint(rnd, 0, 2) };
  },
  text: (p) => {
    if (p.k === 0) {
      const ew = `${streets(Math.abs(p.x))} ${p.x > 0 ? 'מזרחה' : 'מערבה'}`;
      const ns = `${streets(Math.abs(p.y))} ${p.y > 0 ? 'צפונה' : 'דרומה'}`;
      return `במפה של שכונה, הכיכר היא ראשית הצירים: מזרח הוא הכיוון החיובי של $x$, וצפון הוא הכיוון החיובי של $y$. מהכיכר אל ${PLACES[p.n]} הולכים ${p.rev ? ns : ew}, ואז ${p.rev ? ew : ns}. מה שיעור ה־$${XY(p.ask)}$ של ${PLACES[p.n]}?`;
    }
    const h = `"${p.x > 0 ? 'ימינה' : 'שמאלה'} ${Math.abs(p.x)}"`; const v = `"${p.y > 0 ? 'למעלה' : 'למטה'} ${Math.abs(p.y)}"`;
    return `רובוט יוצא מראשית הצירים ומבצע שתי פקודות: קודם ${p.rev ? v : h}, ואחר כך ${p.rev ? h : v}. מה שיעור ה־$${XY(p.ask)}$ של הנקודה שבה הוא עוצר?`;
  },
  answer: readAns,
  bugs: {
    swap: (p) => (p.ask ? p.x : p.y),
    sign: (p) => -readAns(p),
  },
  solution: (p) => [
    p.k === 0 ? 'מזרח הוא ימינה וצפון הוא למעלה, ולכן מערב ודרום הם הכיוונים השליליים.' : 'הפקודה ימינה או שמאלה קובעת את $x$, והפקודה למעלה או למטה קובעת את $y$, לא משנה מה בא קודם.',
    `$x = ${T(p.x)}$ ו־$y = ${T(p.y)}$: הנקודה $${pt(p.x, p.y)}$.`,
    `שיעור ה־$${XY(p.ask)}$ הוא $${T(readAns(p))}$.`,
  ],
  hint: (p) => (p.k === 0 ? 'תרגמו לכיווני הציר: מזרח ימינה, מערב שמאלה, צפון למעלה, דרום למטה.' : 'רק הפקודה ימינה או שמאלה משנה את $x$. רק הפקודה למעלה או למטה משנה את $y$.'),
};

const stair1: StairContent = {
  skill: 'coord:1', topic: 'coord', level: 1, title: 'קריאת נקודה',
  objectives: [
    'לשים נקודה לפי השיעורים שלה: קודם $x$, אחר כך $y$.',
    'לקרוא את השיעורים של נקודה, גם כשהם שליליים או אפס.',
    'להבין למה הסדר בזוג $(x, y)$ חשוב.',
  ],
  idea: 'נקודה $(x, y)$ היא הוראות הליכה מהראשית: $x$ אומר כמה ימינה או שמאלה, ואחר כך $y$ אומר כמה למעלה או למטה.',
  why: [
    'מערכת הצירים היא שני צירי מספרים: אחד שוכב ואחד עומד. כל ציר מודד תזוזה בכיוון אחד, וביחד הם מגיעים לכל מקום במישור.',
    'מספר אחד לא מספיק: $3$ יכול להיות שלושה צעדים ימינה או שלושה למעלה. לכן צריך שני מספרים, וצריך להסכים מי ראשון.',
    'המוסכמה היא $x$ קודם. בזכותה לכל זוג יש מקום אחד בלבד: $(2, 5)$ ו־$(5, 2)$ הם שני מקומות שונים.',
  ],
  alt: [
    'חשבו על אולם קולנוע: "שורה 5, כיסא 2" ו"שורה 2, כיסא 5" הם שני כיסאות שונים. גם בנקודה, המקום של כל מספר אומר מה הוא מודד.',
    'אפשר לקרוא נקודה מהסוף: מהנקודה יורדים או עולים בקו ישר אל ציר $x$, ושם קוראים את $x$. הולכים בקו ישר אל ציר $y$, ושם קוראים את $y$.',
    'סימן הוא כיוון, כמו בציר המספרים: ב־$x$ פלוס זה ימינה ומינוס זה שמאלה. ב־$y$ פלוס זה למעלה ומינוס זה למטה.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', text: 'מערכת צירים היא שני צירי מספרים: ציר $x$ שוכב, וציר $y$ עומד. הם נפגשים באפס של שניהם, בנקודה שנקראת ראשית הצירים.' },
    { kind: 'explore', text: 'נצא מהראשית: 4 צעדים ימינה, ואז 3 צעדים למעלה. שימו שם את הנקודה $A$.', manip: plot('A'), answer: [4, 3],
      hint: 'קודם 4 צעדים ימינה לאורך ציר $x$, ורק אחר כך 3 למעלה.', success: 'הגעתם ל־$A(4, 3)$. המספר הראשון הוא הצעדים ימינה, השני הוא הצעדים למעלה.' },
    { kind: 'predict', text: 'הנקודה $B(3, 4)$ בנויה מאותם מספרים. היא באותו מקום כמו $A(4, 3)$?',
      choices: ['כן, אלה אותם מספרים', 'לא, היא במקום אחר', 'אי אפשר לדעת'], answer: 1,
      why: 'ב־$B$ הולכים 3 ימינה ואז 4 למעלה. זה לא המקום של $A$: הסדר של המספרים קובע לאן הולכים.',
      wrongWhy: { 0: 'אותם מספרים, אבל כל אחד עושה עבודה אחרת. לכו לשתיהן ותראו.', 2: 'אפשר לדעת: המספר הראשון הוא תמיד $x$, והשני תמיד $y$.' } },
    { kind: 'explore', text: 'הנקודה עומדת ב־$(4, 3)$. הזיזו אותה אל $B(3, 4)$.', manip: plot('B', { start: [4, 3] }), answer: [3, 4],
      hint: 'ב־$B$ רק 3 צעדים ימינה אבל 4 למעלה: צעד אחד שמאלה וצעד אחד למעלה.', success: 'אותם שני מספרים, שתי נקודות שונות. לכן קוראים ל־$(x, y)$ זוג סדור: הסדר הוא חלק מהמידע.' },
    { kind: 'explore', text: 'ומה עושה מינוס? מה שהוא עושה בציר המספרים: הופך כיוון. $x$ שלילי הולך שמאלה. שימו את $C(-5, 2)$.', manip: plot('C'), answer: [-5, 2],
      hint: 'קודם $x = -5$: חמישה צעדים שמאלה. אחר כך $y = 2$: שניים למעלה.', success: '$C(-5, 2)$ משמאל לציר $y$, כי $x$ שלילי.' },
    { kind: 'predict', text: 'איך הולכים מהראשית אל $D(3, -4)$?',
      choices: ['3 ימינה, ואז 4 למטה', '3 למטה, ואז 4 ימינה', '3 שמאלה, ואז 4 למעלה'], answer: 0,
      why: 'המספר הראשון הוא $x$: $3$ חיובי, אז 3 ימינה. השני הוא $y$: $-4$ שלילי, אז 4 למטה.',
      wrongWhy: { 1: 'המספר הראשון שייך תמיד לציר $x$, השוכב: הוא אומר ימינה או שמאלה.', 2: 'הסימנים התהפכו: $3$ חיובי הולך ימינה, ו־$-4$ שלילי הולך למטה.' } },
    { kind: 'predict', text: 'ואיפה $E(0, -3)$?',
      choices: ['על ציר $y$, 3 מתחת לראשית', 'על ציר $x$, 3 משמאל לראשית', 'בראשית'], answer: 0,
      why: '$x = 0$: לא זזים ימינה או שמאלה, כלומר נשארים על ציר $y$. משם $y = -3$: שלושה למטה.',
      wrongWhy: { 1: 'על ציר $x$ דווקא $y = 0$. כאן $x = 0$, ולכן הנקודה על ציר $y$.', 2: 'רק $(0, 0)$ היא הראשית. כאן יורדים 3.' } },
    { kind: 'explore', text: 'בדקו: שימו את $E(0, -3)$.', manip: plot('E'), answer: [0, -3],
      hint: 'אל תזוזו ימינה או שמאלה בכלל. רק 3 צעדים למטה.', success: '$E$ יושבת על ציר $y$. כשאחד השיעורים אפס, הנקודה נמצאת על ציר.' },
    { kind: 'rule', text: 'נקודה נכתבת $(x, y)$. קודם $x$: כמה ימינה (חיובי) או שמאלה (שלילי) מהראשית. אחר כך $y$: כמה למעלה (חיובי) או למטה (שלילי).', display: 'P(x, y)',
      why: 'בלי סדר קבוע, $(2, 5)$ יכול לשלוח אחד ימינה ואחד למעלה. בזכות המוסכמה "$x$ קודם", לכל זוג יש מקום אחד בדיוק, וכל מי שקורא אותו מגיע לאותה נקודה.' },
    { kind: 'explore', text: 'נסו לבד: שימו את $F(-2, -6)$.', manip: plot('F'), answer: [-2, -6],
      hint: 'שני השיעורים שליליים: 2 שמאלה, ואז 6 למטה.', success: '$F(-2, -6)$: שמאלה ולמטה. עכשיו אתם קוראים כל נקודה.' },
  ],
  examples: [
    { problem: 'מהראשית הולכים 3 צעדים שמאלה, ואז 5 צעדים למעלה, ומגיעים לנקודה $A$. מה שיעור ה־$x$ של $A$?', display: 'A(?, ?)', answer: -3, check: '0 - 3',
      steps: [
        { action: 'מתחילים ב־$x$: התזוזה ימינה או שמאלה.', why: 'שמאלה זה הכיוון השלילי של ציר $x$, כמו בציר המספרים.', result: 'x = 0 - 3 = -3', value: '0 - 3' },
        { action: 'עכשיו $y$: התזוזה למעלה או למטה.', why: 'למעלה זה הכיוון החיובי של ציר $y$.', result: 'y = 0 + 5 = 5', calc: { expr: '0 + 5', value: 5 } },
        { action: 'כותבים את הזוג בסדר: $x$ ואז $y$.', why: 'הנקודה $(5, -3)$ נמצאת במקום אחר לגמרי: 5 ימינה ו־3 למטה.', result: 'A(-3, 5)', value: '-3' },
      ] },
    { problem: 'במפת אוצר, העץ הגדול הוא הראשית. מזרח הוא הכיוון החיובי של $x$, וצפון הוא הכיוון החיובי של $y$. האוצר נמצא 2 צעדים מזרחה ו־4 צעדים דרומה מהעץ. מה שיעור ה־$y$ של האוצר?', answer: -4, check: '0 - 4',
      steps: [
        { action: 'מתרגמים את הכיוונים לסימנים.', why: 'מזרח הוא ימינה וצפון הוא למעלה, ולכן מערב ודרום הם הכיוונים השליליים. האוצר מזרחה ודרומה: $x$ חיובי ו־$y$ שלילי.', result: '(+,\\ -)' },
        { action: '2 מזרחה: $x$ חיובי.', why: 'הולכים ימינה לאורך ציר $x$.', result: 'x = 2', calc: { expr: '0 + 2', value: 2 } },
        { action: '4 דרומה, כלומר למטה: $y$ שלילי.', why: 'הולכים למטה לאורך ציר $y$, מתחת לציר $x$.', result: 'y = -4', value: '0 - 4' },
        { action: 'כותבים את האוצר כזוג: קודם $x$.', why: 'מי שיחפור ב־$(-4, 2)$ ילך 4 מערבה ו־2 צפונה, ולא ימצא כלום.', result: 'P(2, -4)', value: '-4' },
      ] },
  ],
  together: [
    { problem: 'נשים יחד את הנקודה $K(-4, 1)$.', display: 'K(-4, 1)',
      steps: [
        { prompt: 'מהראשית, לאן זזים קודם?', choices: [
          { text: '4 צעדים שמאלה, לאורך ציר $x$', ok: true, feedback: 'נכון: המספר הראשון הוא $x = -4$, ושלילי זה שמאלה.' },
          { text: '4 צעדים למטה', ok: false, feedback: '$-4$ הוא המספר הראשון, ולכן הוא שייך לציר $x$ השוכב: ימינה או שמאלה, לא למטה.' },
          { text: 'צעד אחד למעלה', ok: false, feedback: 'זה $y$, המספר השני. קודם $x$.' },
        ], hints: ['איזה מספר בא ראשון בזוג, ולאיזה ציר הוא שייך?', 'הראשון הוא $x = -4$: ציר $x$ שוכב, והמינוס אומר שמאלה.'], done: 'מהראשית 4 צעדים שמאלה.' },
        { prompt: 'ועכשיו?', choices: [
          { text: 'צעד אחד למעלה', ok: true, feedback: 'נכון: $y = 1$ חיובי, וחיובי ב־$y$ זה למעלה.' },
          { text: 'צעד אחד למטה', ok: false, feedback: '$y = 1$ חיובי. למטה הולכים רק כש־$y$ שלילי.' },
          { text: '4 צעדים למעלה', ok: false, feedback: 'את ה־4 כבר הלכנו לאורך ציר $x$. עכשיו $y = 1$.' },
        ], hints: ['המספר השני הוא $y$. מה הסימן שלו?', '$y = 1$: צעד אחד למעלה.'], done: '$K(-4, 1)$: ארבעה שמאלה ואחד למעלה.' },
      ],
      final: { prompt: 'הנקודה $L$ נמצאת בדיוק מתחת ל־$K$, על ציר $x$. מה שיעור ה־$x$ של $L$?', answer: -4, check: '-4',
        hints: ['כשיורדים בדיוק למטה, $x$ לא משתנה.', '$L$ על ציר $x$, ולכן $y = 0$: $L(-4, 0)$.'] } },
    { problem: 'מהראשית הולכים קודם 6 צעדים למטה, ורק אחר כך 2 צעדים ימינה, ומגיעים ל־$M$. מה $M$?',
      steps: [
        { prompt: 'מה שיעור ה־$x$ של $M$?', choices: [
          { text: '$2$', ok: true, feedback: 'נכון: $x$ הוא התזוזה ימינה או שמאלה, לא משנה מתי הלכו אותה.' },
          { text: '$-6$', ok: false, feedback: 'זו התזוזה הראשונה בתיאור, אבל היא למטה, כלומר לאורך ציר $y$. בזוג, $x$ הוא תמיד התזוזה הצידה.' },
          { text: '$6$', ok: false, feedback: '6 הצעדים היו למטה: הם שייכים ל־$y$, ועם מינוס.' },
        ], hints: ['איזו תזוזה הייתה ימינה או שמאלה?', 'שני צעדים ימינה: $x = 2$.'], done: '$x = 2$' },
      ],
      final: { prompt: 'ומה שיעור ה־$y$ של $M$?', answer: -6, check: '0 - 6', hints: ['איזו תזוזה הייתה למעלה או למטה?', '6 צעדים למטה: $y$ שלילי.'] } },
  ],
  diag: readModel,
  transfer: mapModel,
  misconceptions: [
    { id: 'swap', title: 'החליפו בין $x$ ל־$y$',
      cause: 'שני המספרים נראים אותו דבר, וקל לשכוח שלכל אחד תפקיד: הראשון תמיד לאורך ציר $x$ השוכב, והשני לאורך ציר $y$ העומד. מי שכותב לפי סדר התיאור, ולא לפי הכיוון, מחליף ביניהם.',
      explain: [
        'נראה שהתפקידים של שני המספרים התחלפו. בזוג $(x, y)$ הראשון הוא תמיד ימינה או שמאלה, והשני תמיד למעלה או למטה.',
        'עוזר לזכור: $x$ לפני $y$ באלף־בית האנגלי, והולכים קודם לאורך הרצפה (הציר השוכב) ורק אחר כך עולים.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו את $A(2, 5)$.', manip: plot('A'), answer: [2, 5], hint: '2 ימינה, ואז 5 למעלה.', success: '$A(2, 5)$: קרוב לציר $y$ וגבוה.' },
        { kind: 'explore', text: 'עכשיו הזיזו את הנקודה אל $B(5, 2)$.', manip: plot('B', { start: [2, 5] }), answer: [5, 2], hint: '5 ימינה ורק 2 למעלה.', success: 'אותם מספרים, מקום אחר: $B$ רחוקה מציר $y$ ונמוכה.' },
        { kind: 'predict', text: 'מהראשית הולכים קודם 6 למטה ואז צעד אחד ימינה. איזו נקודה זו?', choices: ['$(1, -6)$', '$(-6, 1)$'], answer: 0,
          why: 'גם כשהולכים קודם למטה, בזוג $x$ ראשון: התזוזה ימינה היא $x = 1$, והתזוזה למטה היא $y = -6$.' },
      ] },
    { id: 'sign', title: 'טעות בסימן של אחד השיעורים',
      cause: 'המרחק מהראשית נכון, אבל הכיוון לא. שמאלה ולמטה הם הכיוונים השליליים, בדיוק כמו בציר המספרים.',
      explain: [
        'המספר יצא נכון, רק הסימן התהפך: הכיוון הלך לאיבוד.',
        'ימינה ולמעלה חיוביים. שמאלה ולמטה שליליים. נקודה 3 צעדים שמאלה מהראשית היא $x = -3$, לא $3$.',
      ],
      remedy: [
        { kind: 'predict', text: 'מה ההבדל בין $(3, 2)$ ל־$(-3, 2)$?', choices: ['אין הבדל', 'אחת מימין לציר $y$ והשנייה משמאל לו', 'אחת למעלה ואחת למטה'], answer: 1,
          why: 'המינוס ב־$x$ מעביר את הנקודה לצד השני של ציר $y$, כמו תמונת מראה. הגובה, $y = 2$, לא משתנה.' },
        { kind: 'explore', text: 'שימו את $G(-3, -2)$.', manip: plot('G'), answer: [-3, -2], hint: 'שני מינוסים: 3 שמאלה, ואז 2 למטה.', success: '$G(-3, -2)$: שמאלה ולמטה, כי שני השיעורים שליליים.' },
      ] },
    { id: 'axis-zero', title: 'חשבו שנקודה על ציר $x$ היא נקודה שבה $x = 0$',
      cause: 'השם "על ציר $x$" מתבלבל עם "$x$ שווה אפס". אבל על ציר $x$ הולכים רק ימינה או שמאלה ולא עולים בכלל, ולכן דווקא $y = 0$.',
      explain: [
        'נראה שהשם של הציר התבלבל עם השיעור שהוא אפס.',
        'על ציר $x$ זזים ימינה ושמאלה, אבל לא למעלה: $y = 0$. למשל $(4, 0)$ ו־$(-2, 0)$.',
        'על ציר $y$ עולים ויורדים בלי לזוז הצידה: $x = 0$. למשל $(0, 5)$.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו את $H(4, 0)$.', manip: plot('H'), answer: [4, 0], hint: '4 ימינה, ולא עולים בכלל.', success: '$H$ יושבת על ציר $x$, ושיעור ה־$y$ שלה הוא $0$.' },
        { kind: 'predict', text: 'הנקודה $J$ על ציר $y$, 2 צעדים מתחת לראשית. מה $J$?', choices: ['$(0, -2)$', '$(-2, 0)$'], answer: 0,
          why: 'על ציר $y$ לא זזים הצידה, ולכן $x = 0$. יורדים 2, ולכן $y = -2$.' },
        { kind: 'explore', text: 'שימו את $J(0, -2)$.', manip: plot('J'), answer: [0, -2], hint: 'בלי לזוז הצידה: רק 2 למטה.', success: '$J$ על ציר $y$, כי $x = 0$.' },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 2: quadrants

const SX = [0, 1, -1, -1, 1];
const SY = [0, 1, 1, -1, -1];
const ORD = ['', 'ראשון', 'שני', 'שלישי', 'רביעי'];
const quadOf = (x: number, y: number) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : x > 0 && y < 0 ? 4 : 0);
/** The number a clockwise count gives a quadrant (it swaps the second and the fourth). */
const cw = (q: number) => (q === 2 ? 4 : q === 4 ? 2 : q);
/** A point on an axis, on the edge of quadrant q. */
const nextTo = (q: number, x: number, y: number) => (x === 0 && y !== 0 && Math.sign(y) === SY[q]) || (y === 0 && x !== 0 && Math.sign(x) === SX[q]);
const countPts = (pts: number[][], f: (x: number, y: number) => boolean) => pts.filter(([x, y]) => f(x, y)).length;
const sideOf = (x: number, y: number) => `${y > 0 ? 'מעל ציר $x$' : 'מתחת לציר $x$'} ו${x > 0 ? 'מימין לציר $y$' : 'משמאל לציר $y$'}`;
const whereIs = (x: number, y: number) => (quadOf(x, y) ? `ברביע ה${ORD[quadOf(x, y)]}` : x === 0 ? 'על ציר $y$' : 'על ציר $x$');

// k 0: a point, 1: signs in words, 2: count in a list, 3: a coordinate from the quadrant and the distances to the axes
// (the quadrant gives its sign; answers spread widely, so a fixed number cannot answer the stair's questions)
type QuadP = { k: number; x: number; y: number; t: number; pts: number[][]; ask?: number };
const quadAns = (p: QuadP) => (p.k === 0 ? quadOf(p.x, p.y) : p.k === 1 ? p.t : p.k === 3 ? (p.ask ? p.y : p.x) : countPts(p.pts, (x, y) => quadOf(x, y) === p.t));

const quadModel: DiagModel<QuadP> = {
  params: (rnd) => {
    const r = rnd();
    // the second and fourth quadrants are where a swap or a clockwise count shows
    const q = rnd() < 0.6 ? rpick(rnd, [2, 4]) : rpick(rnd, [1, 3]);
    if (r < 0.25) return { k: 0, x: SX[q] * rint(rnd, 1, 9), y: SY[q] * rint(rnd, 1, 9), t: q, pts: [] };
    if (r < 0.35) return { k: 1, x: SX[q], y: SY[q], t: q, pts: [] };
    if (r < 0.7) {
      let x = rint(rnd, 1, 9); let y = rint(rnd, 1, 9);
      while (x === y) y = rint(rnd, 1, 9);
      return { k: 3, x: SX[q] * x, y: SY[q] * y, t: q, pts: [], ask: rnd() < 0.5 ? 0 : 1 };
    }
    // four points: none to all four in the quadrant (each count as likely), some on its edges (the axes), the rest in another
    const t = rnd() < 0.7 ? rpick(rnd, [2, 4]) : rpick(rnd, [1, 3]);
    const c = rint(rnd, 0, 4); const a = c === 4 ? 0 : rint(rnd, c === 0 ? 1 : 0, Math.min(2, 4 - c));
    const other = t === 2 || t === 4 ? 6 - t : rpick(rnd, [1, 2, 3, 4].filter((v) => v !== t));
    const pts: number[][] = [];
    const add = (f: () => number[]) => { let v = f(); while (pts.some((u) => u[0] === v[0] && u[1] === v[1])) v = f(); pts.push(v); };
    for (let i = 0; i < c; i += 1) add(() => [SX[t] * rint(rnd, 1, 6), SY[t] * rint(rnd, 1, 6)]);
    const first = rint(rnd, 0, 1);
    for (let i = 0; i < a; i += 1) add(() => ((first + i) % 2 ? [SX[t] * rint(rnd, 1, 6), 0] : [0, SY[t] * rint(rnd, 1, 6)]));
    for (let i = 0; i < 4 - c - a; i += 1) add(() => [SX[other] * rint(rnd, 1, 6), SY[other] * rint(rnd, 1, 6)]);
    return { k: 2, x: 0, y: 0, t, pts: shuffled(rnd, pts) };
  },
  text: (p) => (p.k === 0
    ? `באיזה רביע נמצאת הנקודה $${pt(p.x, p.y)}$? כתבו את מספר הרביע.`
    : p.k === 3
      ? `הנקודה $P$ נמצאת ברביע ה${ORD[p.t]}. המרחק שלה מציר $y$ הוא $${Math.abs(p.x)}$, והמרחק שלה מציר $x$ הוא $${Math.abs(p.y)}$. מה שיעור ה־$${p.ask ? 'y' : 'x'}$ של $P$?`
    : p.k === 1
      ? `לנקודה $P$ שיעור $x$ ${p.x > 0 ? 'חיובי' : 'שלילי'} ושיעור $y$ ${p.y > 0 ? 'חיובי' : 'שלילי'}. באיזה רביע היא? כתבו את מספר הרביע.`
      : `כמה מהנקודות האלה נמצאות ברביע ה${ORD[p.t]}? ${p.pts.map(([x, y]) => `$${pt(x, y)}$`).join(', ')}`),
  answer: quadAns,
  bugs: {
    // the first sign read as y's: a point of the second quadrant lands in the fourth and back
    swap: (p) => (p.k === 0 ? quadOf(p.y, p.x) : p.k === 2 ? countPts(p.pts, (x, y) => quadOf(y, x) === p.t)
      // the two distances swapped: the other axis's distance, with this coordinate's sign
      : p.k === 3 ? (p.ask ? Math.sign(p.y) * Math.abs(p.x) : Math.sign(p.x) * Math.abs(p.y)) : null),
    // counted the quadrants clockwise (the second and the fourth change places: both signs turn)
    'quad-order': (p) => (p.k === 2 ? countPts(p.pts, (x, y) => quadOf(x, y) === cw(p.t)) : p.k === 3 ? (p.t === 2 || p.t === 4 ? -(p.ask ? p.y : p.x) : null) : cw(p.k === 0 ? quadOf(p.x, p.y) : p.t)),
    // counted points on the axes at the quadrant's edge as inside it
    'axis-quadrant': (p) => (p.k === 2 ? quadAns(p) + countPts(p.pts, (x, y) => nextTo(p.t, x, y)) : null),
  },
  solution: (p) => {
    if (p.k === 2) {
      return [
        `${p.pts.map(([x, y]) => `$${pt(x, y)}$ ${whereIs(x, y)}`).join(', ')}.`,
        'נקודה ששיעור אחד שלה $0$ יושבת על ציר, ולא שייכת לאף רביע.',
        `מספר הנקודות ברביע ה${ORD[p.t]}: $${quadAns(p)}$.`,
      ];
    }
    if (p.k === 3) {
      return [
        `ברביע ה${ORD[p.t]} $x$ ${p.x > 0 ? 'חיובי' : 'שלילי'} ו־$y$ ${p.y > 0 ? 'חיובי' : 'שלילי'}.`,
        `המרחק מציר $y$ הוא כמה צעדים ימינה או שמאלה, כלומר $|x| = ${Math.abs(p.x)}$; המרחק מציר $x$ הוא כמה צעדים למעלה או למטה, $|y| = ${Math.abs(p.y)}$.`,
        `לכן $P(${p.x}, ${p.y})$, ושיעור ה־$${p.ask ? 'y' : 'x'}$ הוא $${p.ask ? p.y : p.x}$.`,
      ];
    }
    const q = quadAns(p);
    return [
      `$x$ ${p.x > 0 ? 'חיובי' : 'שלילי'} ו־$y$ ${p.y > 0 ? 'חיובי' : 'שלילי'}: הנקודה ${sideOf(p.x, p.y)}.`,
      `סופרים נגד כיוון השעון מהרביע שלמעלה מימין: זה הרביע ה${ORD[q]}, $${q}$.`,
    ];
  },
  hint: (p) => (p.k === 2
    ? 'בדקו כל נקודה לפי שני הסימנים. נקודה עם שיעור $0$ נמצאת על ציר, ולא באף רביע.'
    : p.k === 3
      ? 'הרביע קובע את הסימנים. המרחק מציר $y$ הוא הגודל של $x$, והמרחק מציר $x$ הוא הגודל של $y$.'
      : 'הסימן של $x$ אומר ימין או שמאל, והסימן של $y$ אומר למעלה או למטה. סופרים נגד כיוון השעון מהרביע שלמעלה מימין.'),
};

type CityP = { k: number; sx: number; sy: number; n: number; dx?: number; dy?: number; ask?: number };
const BUILDINGS = ['בית הספר', 'הקניון', 'האצטדיון'];
const cityModel: DiagModel<CityP> = {
  // quadrants without numbers: a city cut by two roads, and points written with letters
  params: (rnd) => {
    const q = rnd() < 0.6 ? rpick(rnd, [2, 4]) : rpick(rnd, [1, 3]);
    const r = rnd();
    if (r < 0.4) { let dx = rint(rnd, 1, 9); let dy = rint(rnd, 1, 9); while (dx === dy) dy = rint(rnd, 1, 9); return { k: 2, sx: SX[q], sy: SY[q], n: rint(rnd, 0, 2), dx, dy, ask: rnd() < 0.5 ? 0 : 1 }; }
    return { k: r < 0.7 ? 0 : 1, sx: SX[q], sy: SY[q], n: rint(rnd, 0, 2) };
  },
  text: (p) => (p.k === 2
    ? `במפה של עיר, כביש ממזרח למערב הוא ציר $x$ וכביש מצפון לדרום הוא ציר $y$; מזרח וצפון הם הכיוונים החיוביים, וכל יחידה היא קילומטר. ${BUILDINGS[p.n]} נמצא ${p.dy} ק״מ ${p.sy > 0 ? 'צפונית' : 'דרומית'} לכביש המזרח־מערב, ו־${p.dx} ק״מ ${p.sx > 0 ? 'מזרחית' : 'מערבית'} לכביש הצפון־דרום. מה שיעור ה־$${p.ask ? 'y' : 'x'}$ שלו?`
    : p.k === 0
    ? `שני כבישים ראשיים חוצים עיר ומחלקים אותה לארבעה רובעים: כביש ממזרח למערב (ציר $x$) וכביש מצפון לדרום (ציר $y$). מזרח הוא הכיוון החיובי של $x$, צפון הוא הכיוון החיובי של $y$, והרובעים ממוספרים כמו הרביעים. ${BUILDINGS[p.n]} נמצא ${p.sy > 0 ? 'צפונית' : 'דרומית'} לכביש המזרח־מערב ו${p.sx > 0 ? 'מזרחית' : 'מערבית'} לכביש הצפון־דרום. מה מספר הרובע שלו?`
    : `המספרים $a$ ו־$b$ חיוביים. באיזה רביע נמצאת הנקודה $(${p.sx > 0 ? 'a' : '-a'}, ${p.sy > 0 ? 'b' : '-b'})$? כתבו את מספר הרביע.`),
  answer: (p) => (p.k === 2 ? (p.ask ? p.sy * p.dy! : p.sx * p.dx!) : quadOf(p.sx, p.sy)),
  bugs: {
    // k 2: the distance to the other road taken (north-south read as x)
    swap: (p) => (p.k === 1 ? quadOf(p.sy, p.sx) : p.k === 2 ? (p.ask ? p.sy * p.dx! : p.sx * p.dy!) : null),
    'quad-order': (p) => (p.k === 2 ? null : cw(quadOf(p.sx, p.sy))),
  },
  solution: (p) => {
    if (p.k === 2) {
      return [
        `${p.sy > 0 ? 'צפונית' : 'דרומית'} לכביש האופקי: $y$ ${p.sy > 0 ? 'חיובי' : 'שלילי'}, $y = ${T(p.sy * p.dy!)}$. ${p.sx > 0 ? 'מזרחית' : 'מערבית'} לכביש האנכי: $x$ ${p.sx > 0 ? 'חיובי' : 'שלילי'}, $x = ${T(p.sx * p.dx!)}$.`,
        `שיעור ה־$${p.ask ? 'y' : 'x'}$: $${T(p.ask ? p.sy * p.dy! : p.sx * p.dx!)}$.`,
      ];
    }
    const q = quadOf(p.sx, p.sy);
    return [
      p.k === 0
        ? `${p.sy > 0 ? 'צפונית' : 'דרומית'} לכביש האופקי: $y$ ${p.sy > 0 ? 'חיובי' : 'שלילי'}. ${p.sx > 0 ? 'מזרחית' : 'מערבית'} לכביש האנכי: $x$ ${p.sx > 0 ? 'חיובי' : 'שלילי'}.`
        : `$a$ ו־$b$ חיוביים, ולכן $-a$ ו־$-b$ שליליים: כאן $x$ ${p.sx > 0 ? 'חיובי' : 'שלילי'} ו־$y$ ${p.sy > 0 ? 'חיובי' : 'שלילי'}.`,
      `הנקודה ${sideOf(p.sx, p.sy)}: הרביע ה${ORD[q]}, $${q}$.`,
    ];
  },
  hint: (p) => (p.k === 1 ? 'לא צריך לדעת כמה הם $a$ ו־$b$: מספיק לדעת את הסימנים.' : 'צפון ודרום קובעים את הסימן של $y$, מזרח ומערב את הסימן של $x$.'),
};

const stair2: StairContent = {
  skill: 'coord:2', topic: 'coord', level: 2, title: 'רביעים',
  objectives: [
    'לדעת באיזה רביע נמצאת נקודה לפי הסימנים של השיעורים שלה, בלי לשרטט.',
    'לדעת שהרביעים ממוספרים נגד כיוון השעון, מהרביע שלמעלה מימין.',
    'לדעת שנקודה על אחד הצירים לא נמצאת באף רביע.',
  ],
  idea: 'הצירים חותכים את המישור לארבעה רביעים, וכל רביע הוא צירוף של סימנים: הסימן של $x$ אומר ימין או שמאל, והסימן של $y$ אומר למעלה או למטה.',
  why: [
    'ציר $y$ מפריד בין ימין ($x$ חיובי) לשמאל ($x$ שלילי). ציר $x$ מפריד בין למעלה ($y$ חיובי) ללמטה ($y$ שלילי).',
    'שתי שאלות של כן או לא, "ימינה?" ו"למעלה?", נותנות בדיוק ארבע תשובות. לכן יש ארבעה רביעים, ולכל אחד צירוף סימנים משלו.',
    'הגודל של המספרים לא משנה: $(1, 1)$ ו־$(100, 6)$ שתיהן ברביע הראשון. רק הסימן קובע באיזה צד של כל ציר הנקודה.',
  ],
  alt: [
    'סדר המספור: מתחילים ברביע שלמעלה מימין, וממשיכים הפוך לכיוון המחוגים של שעון: למעלה משמאל, למטה משמאל, למטה מימין.',
    'דמיינו קרן שיוצאת מהראשית לאורך ציר $x$ החיובי ומסתובבת נגד כיוון השעון, כמו זווית שגדלה. היא עוברת קודם ברביע הראשון, אחר כך בשני, בשלישי ובסוף ברביעי.',
    'נקודה שאחד השיעורים שלה $0$ יושבת על הגבול בין רביעים, על ציר. היא לא שייכת לאף רביע.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', text: 'שני הצירים חוצים את המישור לארבעה חלקים. כל חלק נקרא רביע. נגלה מה משותף לכל הנקודות שבאותו רביע.' },
    { kind: 'explore', text: 'שימו נקודה כלשהי שבה גם $x$ וגם $y$ חיוביים.', manip: plot('P', { quadrant: 1 }), answer: [3, 2],
      hint: 'חיובי ב־$x$ זה ימינה, וחיובי ב־$y$ זה למעלה.', success: 'כל נקודה כזאת נמצאת למעלה מימין. זה הרביע הראשון, $(+, +)$.' },
    { kind: 'explore', text: 'עכשיו נקודה שבה $x$ שלילי ו־$y$ חיובי.', manip: plot('P', { quadrant: 2 }), answer: [-3, 2],
      hint: 'שלילי ב־$x$: שמאלה. חיובי ב־$y$: למעלה.', success: 'למעלה משמאל: הרביע השני, $(-, +)$. ממשיכים נגד כיוון השעון.' },
    { kind: 'predict', text: 'איפה יהיו כל הנקודות שבהן גם $x$ וגם $y$ שליליים?',
      choices: ['למטה משמאל', 'למטה מימין', 'למעלה משמאל'], answer: 0,
      why: '$x$ שלילי: שמאלה. $y$ שלילי: למטה. ביחד: למטה משמאל. זה הרביע השלישי, $(-, -)$.',
      wrongWhy: { 1: 'מימין זה $x$ חיובי. כאן $x$ שלילי.', 2: 'למעלה זה $y$ חיובי. כאן $y$ שלילי.' } },
    { kind: 'explore', text: 'נשאר רביע אחד, למטה מימין: הרביע הרביעי. שימו בו נקודה.', manip: plot('P', { quadrant: 4 }), answer: [3, -2],
      hint: 'למטה מימין: $x$ חיובי ו־$y$ שלילי.', success: 'הרביע הרביעי הוא $(+, -)$. סגרנו סיבוב נגד כיוון השעון.' },
    { kind: 'predict', text: 'בלי לשרטט: באיזה רביע הנקודה $(5, -1)$?',
      choices: ['ראשון', 'שני', 'שלישי', 'רביעי'], answer: 3,
      why: '$x = 5$ חיובי: ימינה. $y = -1$ שלילי: למטה. למטה מימין זה הרביע הרביעי. לא צריך לשרטט: מספיק לבדוק סימנים.',
      wrongWhy: { 1: 'מי שסופר עם כיוון השעון מקבל "שני". הרביעים ממוספרים נגד כיוון השעון: אחרי הראשון בא הרביע שלמעלה משמאל.', 0: 'ברביע הראשון שני השיעורים חיוביים. כאן $y$ שלילי.' } },
    { kind: 'predict', text: 'הנקודות $(-2, 7)$ ו־$(7, -2)$: הן באותו רביע?',
      choices: ['כן, אלה אותם מספרים', 'לא'], answer: 1,
      why: '$(-2, 7)$ היא $(-, +)$, ברביע השני. $(7, -2)$ היא $(+, -)$, ברביע הרביעי. כשמחליפים את הסדר, הסימנים עוברים מציר לציר.' },
    { kind: 'predict', text: 'ובאיזה רביע $(0, 4)$?',
      choices: ['ראשון', 'שני', 'באף רביע'], answer: 2,
      why: '$x = 0$: הנקודה לא מימין ולא משמאל, היא על ציר $y$. הצירים הם הגבולות בין הרביעים, ונקודה על ציר לא שייכת לאף רביע.' },
    { kind: 'rule', text: 'הרביע נקבע רק לפי הסימנים: ראשון $(+, +)$, שני $(-, +)$, שלישי $(-, -)$, רביעי $(+, -)$. נקודה עם שיעור $0$ נמצאת על ציר, לא ברביע.',
      display: '\\begin{array}{c|c} \\text{II}\\ (-,+) & \\text{I}\\ (+,+) \\\\ \\hline \\text{III}\\ (-,-) & \\text{IV}\\ (+,-) \\end{array}',
      why: 'הסימן של $x$ אומר באיזה צד של ציר $y$ הנקודה, והסימן של $y$ אומר באיזה צד של ציר $x$. שני צדדים כפול שני צדדים: ארבעה רביעים. כמה רחוק הולכים לא משנה, כל עוד לא עוברים את הציר.' },
    { kind: 'explore', text: 'נסו לבד: שימו נקודה ברביע השלישי.', manip: plot('P', { quadrant: 3 }), answer: [-3, -2],
      hint: 'רביע שלישי: $(-, -)$, שמאלה ולמטה.', success: 'כל נקודה למטה משמאל מתאימה. בלי שרטוט אפשר לדעת: שני שיעורים שליליים, רביע שלישי.' },
  ],
  examples: [
    { problem: 'באיזה רביע נמצאת הנקודה $(-6, -1)$? כתבו את מספר הרביע.', display: '(-6, -1)', answer: 3, check: '3',
      steps: [
        { action: 'בודקים את הסימן של $x$.', why: '$x = -6$ שלילי, ולכן הנקודה משמאל לציר $y$: ברביע השני או בשלישי.', result: 'x = -6 < 0' },
        { action: 'בודקים את הסימן של $y$.', why: '$y = -1$ שלילי, ולכן הנקודה מתחת לציר $x$: ברביע השלישי או ברביעי.', result: 'y = -1 < 0' },
        { action: 'מצרפים: משמאל ולמטה.', why: 'הרביע היחיד שגם משמאל וגם למטה הוא השלישי, $(-, -)$. הגודל של $-6$ לא משנה.', result: '(-,-) \\Rightarrow \\text{III}', value: '3' },
      ] },
    { problem: 'שני כבישים ראשיים חוצים עיר: כביש ממזרח למערב הוא ציר $x$, וכביש מצפון לדרום הוא ציר $y$. מזרח וצפון הם הכיוונים החיוביים, והרובעים ממוספרים כמו הרביעים. מסעדה נמצאת בנקודה $(-2, 5)$. באיזה רובע היא?', answer: 2, check: '2',
      steps: [
        { action: '$x = -2$ שלילי: המסעדה מערבית לכביש הצפון־דרום.', why: 'הסימן של $x$ אומר באיזה צד של ציר $y$, הכביש האנכי, הנקודה נמצאת.', result: 'x = -2 < 0' },
        { action: '$y = 5$ חיובי: המסעדה צפונית לכביש המזרח־מערב.', why: 'הסימן של $y$ אומר באיזה צד של ציר $x$, הכביש האופקי.', result: 'y = 5 > 0' },
        { action: 'צפון־מערב הוא למעלה משמאל: הרובע השני.', why: 'מהרובע הראשון, צפון־מזרח, סופרים נגד כיוון השעון. הבא אחריו הוא צפון־מערב.', result: '(-,+) \\Rightarrow \\text{II}', value: '2' },
      ] },
  ],
  together: [
    { problem: 'באיזה רביע נמצאת הנקודה $Q(-8, 3)$?', display: 'Q(-8, 3)',
      steps: [
        { prompt: 'מה אומר הסימן של $x$?', choices: [
          { text: '$x$ שלילי: הנקודה משמאל לציר $y$', ok: true, feedback: 'נכון: $x$ הוא ימין או שמאל, ושלילי זה שמאל.' },
          { text: '$x$ שלילי: הנקודה מתחת לציר $x$', ok: false, feedback: 'מעל או מתחת קובע $y$. הסימן של $x$ קובע ימין או שמאל.' },
          { text: '$-8$ רחוק מאוד, אז הנקודה ברביע השלישי', ok: false, feedback: 'הגודל לא קובע רביע, רק הסימן. וצריך לבדוק גם את $y$.' },
        ], hints: ['$x$ הוא התזוזה ימינה או שמאלה.', 'שלילי ב־$x$ זה שמאלה: הצד השמאלי של ציר $y$.'], done: 'משמאל לציר $y$: הרביע השני או השלישי.' },
        { prompt: 'ומה אומר הסימן של $y$?', choices: [
          { text: '$y = 3$ חיובי: הנקודה מעל ציר $x$', ok: true, feedback: 'נכון: חיובי ב־$y$ זה למעלה.' },
          { text: '$y = 3$ חיובי: הנקודה מימין לציר $y$', ok: false, feedback: 'ימין או שמאל כבר נקבע לפי $x$. $y$ אומר למעלה או למטה.' },
        ], hints: ['$y$ הוא התזוזה למעלה או למטה.', 'חיובי ב־$y$: מעל ציר $x$.'], done: 'משמאל ולמעלה.' },
      ],
      final: { prompt: 'כתבו את מספר הרביע.', answer: 2, check: '2', hints: ['איזה רביע נמצא למעלה משמאל?', 'סופרים נגד כיוון השעון מהרביע שלמעלה מימין: הבא אחריו, למעלה משמאל, הוא השני.'] } },
    { problem: 'כמה מהנקודות $(-1, 4)$, $(0, 6)$, $(-5, 2)$, $(-3, 0)$ נמצאות ברביע השני?',
      steps: [
        { prompt: 'מה עושים עם $(0, 6)$?', choices: [
          { text: 'היא על ציר $y$, ולכן לא סופרים אותה', ok: true, feedback: 'נכון: $x = 0$ הוא לא חיובי ולא שלילי, הנקודה על הגבול.' },
          { text: 'היא ברביע השני, כי $y$ חיובי', ok: false, feedback: 'כדי להיות ברביע השני צריך גם $x$ שלילי. $x = 0$ הוא לא שלילי.' },
          { text: 'היא ברביע הראשון', ok: false, feedback: 'ברביע הראשון צריך $x$ חיובי. $x = 0$ הוא לא חיובי.' },
        ], hints: ['מה הסימן של $0$?', '$0$ הוא לא חיובי ולא שלילי: הנקודה על ציר $y$.'], done: '$(0, 6)$ על ציר $y$.' },
        { prompt: 'ומה עם $(-3, 0)$?', choices: [
          { text: 'היא על ציר $x$, ולכן לא סופרים אותה', ok: true, feedback: 'נכון: $y = 0$, הנקודה על הגבול בין הרביע השני לשלישי.' },
          { text: 'היא ברביע השני, כי $x$ שלילי', ok: false, feedback: 'צריך גם $y$ חיובי. $y = 0$: הנקודה על ציר $x$.' },
        ], hints: ['בדקו את $y$.', '$y = 0$: הנקודה על ציר $x$, לא ברביע.'], done: '$(-3, 0)$ על ציר $x$.' },
      ],
      final: { prompt: 'כמה נקודות ברביע השני?', answer: 2, check: '2', hints: ['אילו נקודות הן $(-, +)$?', '$(-1, 4)$ ו־$(-5, 2)$.'] } },
  ],
  diag: quadModel,
  transfer: cityModel,
  misconceptions: [
    { id: 'swap', title: 'החליפו בין $x$ ל־$y$', prereq: 'coord:1',
      cause: 'כשקוראים את הזוג בסדר הפוך, הסימן של $x$ נקרא כסימן של $y$. בנקודות שהסימנים שלהן שונים, זה מעביר מהרביע השני לרביעי ובחזרה.',
      explain: [
        'נראה שהסימנים נקראו בסדר הפוך. הסימן הראשון תמיד של $x$ (ימין או שמאל), והשני של $y$ (למעלה או למטה).',
        '$(-2, 5)$: הסימן הראשון מינוס, כלומר שמאלה. השני פלוס, כלומר למעלה. למעלה משמאל: רביע שני.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו את $(-2, 5)$.', manip: plot('A'), answer: [-2, 5], hint: 'קודם 2 שמאלה, ואז 5 למעלה.', success: 'למעלה משמאל: רביע שני.' },
        { kind: 'explore', text: 'ועכשיו את $(5, -2)$.', manip: plot('B'), answer: [5, -2], hint: 'קודם 5 ימינה, ואז 2 למטה.', success: 'למטה מימין: רביע רביעי. החלפת הסדר העבירה את הנקודה רביע.' },
        { kind: 'predict', text: 'באיזה רביע $(-4, 1)$?', choices: ['שני', 'רביעי'], answer: 0, why: 'הראשון, $-4$, הוא $x$: שמאלה. השני, $1$, הוא $y$: למעלה. למעלה משמאל: רביע שני.' },
      ] },
    { id: 'quad-order', title: 'מספרו את הרביעים עם כיוון השעון',
      cause: 'ההתחלה נכונה, ברביע שלמעלה מימין, אבל הספירה ממשיכה כמו המחוגים של שעון. הרביעים ממוספרים בכיוון ההפוך: נגד כיוון השעון.',
      explain: [
        'נראה שהסימנים נקראו נכון, אבל המספור הלך לכיוון הלא נכון.',
        'סופרים מהרביע שלמעלה מימין, נגד כיוון השעון: אחריו למעלה משמאל (שני), למטה משמאל (שלישי) ולמטה מימין (רביעי).',
        'דרך לזכור: קרן שמסתובבת מציר $x$ החיובי נגד כיוון השעון, כמו זווית שגדלה, עוברת ברביעים לפי הסדר: ראשון, שני, שלישי, רביעי.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו נקודה ברביע השני.', manip: plot('P', { quadrant: 2 }), answer: [-3, 2], hint: 'מהרביע הראשון, למעלה מימין, זזים נגד כיוון השעון: הרביע הבא הוא למעלה משמאל.', success: 'הרביע השני: למעלה משמאל, $(-, +)$.' },
        { kind: 'explore', text: 'ועכשיו ברביע הרביעי.', manip: plot('P', { quadrant: 4 }), answer: [3, -2], hint: 'הרביע האחרון בסיבוב נגד כיוון השעון: למטה מימין.', success: 'הרביע הרביעי: למטה מימין, $(+, -)$.' },
        { kind: 'predict', text: 'באיזה רביע $(6, -2)$?', choices: ['שני', 'רביעי'], answer: 1, why: '$(+, -)$: למטה מימין. בסיבוב נגד כיוון השעון זה הרביע האחרון, הרביעי.' },
      ] },
    { id: 'axis-quadrant', title: 'שייכו לרביע נקודה שנמצאת על ציר',
      cause: 'נקודה כמו $(0, 6)$ נראית "למעלה", ולכן נדמה שהיא ברביע. אבל $x = 0$ הוא לא חיובי ולא שלילי: היא בדיוק על הגבול.',
      explain: [
        'נקודה עם שיעור $0$ יושבת על אחד הצירים, והצירים הם הגבולות בין הרביעים.',
        'כדי להיות ברביע, כל אחד משני השיעורים צריך להיות חיובי או שלילי. אפס הוא לא זה ולא זה.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו את $(0, 6)$.', manip: plot('A'), answer: [0, 6], hint: 'בלי לזוז הצידה: רק 6 למעלה.', success: 'הנקודה על ציר $y$, בדיוק בין הרביע הראשון לשני. היא לא בתוך אף אחד מהם.' },
        { kind: 'predict', text: 'באיזה רביע $(-3, 0)$?', choices: ['שני', 'שלישי', 'באף רביע'], answer: 2, why: '$y = 0$: הנקודה על ציר $x$, על הגבול בין הרביע השני לשלישי.' },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 3: the length of a segment

type SegP = { h: number; f: number; p: number; q: number }; // C and D: p and q on the changing coordinate, f on the other
const segPts = (s: SegP) => (s.h ? [[s.p, s.f], [s.q, s.f]] : [[s.f, s.p], [s.f, s.q]]);
const segAns = (s: { p: number; q: number }) => Math.abs(s.q - s.p);
/** Two values on one line, at least 2 apart: across zero, both above it, or both below it (then up to 11 from zero, so
 * the lengths vary as much as across zero). */
function segPair(rnd: Rnd, r: number): [number, number] {
  let p = 0; let q = 0;
  if (r < 0.5) { do { p = -rint(rnd, 1, 6); q = rint(rnd, 1, 6); } while (-p === q); } else if (r < 0.75) { p = rint(rnd, 1, 6); q = rint(rnd, p + 2, 11); } else { q = -rint(rnd, 1, 6); p = -rint(rnd, -q + 2, 11); }
  return rnd() < 0.5 ? [p, q] : [q, p];
}
const segBugs = {
  // across an axis, the distances to zero were subtracted instead of added: −3 to 4 gives 1
  'add-coords': (s: { p: number; q: number }) => (s.p * s.q < 0 ? Math.abs(Math.abs(s.q) - Math.abs(s.p)) : null),
  // subtracted in the order written and kept the minus: a negative length
  sign: (s: { p: number; q: number }) => (s.p < s.q ? s.p - s.q : null),
  // measured from the axis: the far end's coordinate given as the length
  'coord-length': (s: { p: number; q: number }) => (s.p > 0 && s.q > 0 ? Math.max(s.p, s.q) : null),
};
const diffLine = (p: number, q: number) => { const hi = Math.max(p, q); const lo = Math.min(p, q); return `$${T(hi)} - ${T(lo, true)} = ${hi - lo}$`; };

const segModel: DiagModel<SegP> = {
  params: (rnd) => { const [p, q] = segPair(rnd, rnd()); return { h: rint(rnd, 0, 1), f: rnz(rnd, -5, 5), p, q }; },
  text: (s) => { const [[x1, y1], [x2, y2]] = segPts(s); return `מה האורך של הקטע $CD$, כש־$C${pt(x1, y1)}$ ו־$D${pt(x2, y2)}$?`; },
  answer: segAns,
  bugs: segBugs,
  solution: (s) => {
    const ans = segAns(s); const lo = Math.min(s.p, s.q); const hi = Math.max(s.p, s.q);
    const out = [
      `הקטע ${s.h ? 'אופקי' : 'אנכי'}: $${s.h ? 'y' : 'x'} = ${T(s.f)}$ בשתי הנקודות, ולכן רק $${s.h ? 'x' : 'y'}$ משתנה.`,
      `האורך הוא הגדול פחות הקטן: ${diffLine(s.p, s.q)}.`,
    ];
    if (lo < 0 && hi > 0) out.push(`בדיקה: מ־$${T(lo)}$ עד $0$ יש $${-lo}$, ומ־$0$ עד $${hi}$ יש $${hi}$: $${-lo} + ${hi} = ${ans}$.`);
    out.push(`האורך: $${ans}$ יחידות.`);
    return out;
  },
  hint: (s) => (s.p * s.q < 0
    ? 'הקטע חוצה ציר: הצעדים משני הצדדים של האפס מצטברים. הגדול פחות הקטן עושה את זה לבד.'
    : `${s.h ? 'קטע אופקי: רק $x$ משתנה' : 'קטע אנכי: רק $y$ משתנה'}. האורך הוא הגדול פחות הקטן.`),
  unit: 'יחידות',
};

type GameP = { k: number; f: number; p: number; q: number };
const gameModel: DiagModel<GameP> = {
  // a game character walking to a coin, and a seagull above the sea with a fish below it
  params: (rnd) => {
    if (rnd() < 0.6) { const [p, q] = segPair(rnd, rnd() * 0.75); return { k: 0, f: rnz(rnd, -5, 5), p, q }; }
    let p = 0; let q = 0;
    do { p = rint(rnd, 1, 6); q = -rint(rnd, 1, 6); } while (p === -q);
    return { k: 1, f: rnz(rnd, -5, 5), p, q };
  },
  text: (s) => (s.k === 0
    ? `במשחק מחשב, דמות עומדת בנקודה $${pt(s.p, s.f)}$, ומטבע נמצא בנקודה $${pt(s.q, s.f)}$. כמה צעדים של יחידה אחת הדמות צריכה ללכת, בקו ישר, כדי להגיע למטבע?`
    : `ציר $x$ הוא פני הים, וכל יחידה היא מטר. שחף עף בנקודה $${pt(s.f, s.p)}$, ודג שוחה בדיוק מתחתיו, בנקודה $${pt(s.f, s.q)}$. כמה מטרים בין השחף לדג?`),
  answer: segAns,
  bugs: segBugs,
  solution: (s) => (s.k === 0
    ? [`הדמות והמטבע באותו גובה, $y = ${T(s.f)}$: הולכים רק לאורך $x$.`, `הגדול פחות הקטן: ${diffLine(s.p, s.q)}.`, `התשובה: $${segAns(s)}$ צעדים.`]
    : [`השחף והדג על אותו קו אנכי, $x = ${T(s.f)}$: רק הגובה משתנה.`, `השחף ${metres(s.p)} מעל פני הים, והדג ${metres(-s.q)} מתחתם: $${T(s.p)} - ${T(s.q, true)} = ${s.p} + ${-s.q} = ${segAns(s)}$.`, `התשובה: $${segAns(s)}$ מטרים.`]),
  hint: (s) => (s.k === 0 ? 'רק $x$ משתנה. כמה צעדים מה־$x$ של הדמות עד ה־$x$ של המטבע?' : 'פני הים הם האפס: כמה מעליהם השחף, וכמה מתחתם הדג?'),
};

const stair3: StairContent = {
  skill: 'coord:3', topic: 'coord', level: 3, title: 'אורך קטע',
  objectives: [
    'למצוא אורך של קטע שמקביל לציר: רק שיעור אחד משתנה, והאורך הוא ההפרש בו.',
    'לחשב נכון אורך של קטע שחוצה ציר, למשל מ־$-3$ עד $4$.',
    'לדעת שאורך הוא תמיד חיובי: הגדול פחות הקטן.',
  ],
  idea: 'בקטע אופקי רק $x$ משתנה, ובקטע אנכי רק $y$. האורך הוא המרחק בין שני הערכים של השיעור שמשתנה: הגדול פחות הקטן.',
  why: [
    'קטע אופקי שוכב על קו שמקביל לציר $x$. לאורכו $y$ לא משתנה, ולכן כל המידע על האורך נמצא ב־$x$.',
    'המרחק בין שני מספרים על ציר הוא מספר הצעדים מאחד לשני. זה בדיוק הגדול פחות הקטן: $4 - (-3) = 7$.',
    'כשהקטע חוצה ציר, הולכים מ־$-3$ עד האפס (3 צעדים) וממשיכים עד $4$ (עוד 4): $3 + 4 = 7$. החיסור של המספר השלילי עושה את החיבור הזה לבד.',
  ],
  alt: [
    'חשבו על מדחום שעומד על הצד: מ־$-3$ מעלות עד $4$ מעלות הטמפרטורה עולה ב־7 מעלות, לא ב־1.',
    'סרגל שלא מתחיל באפס: אם קצה אחד ב־$2$ והשני ב־$9$, האורך הוא $9 - 2 = 7$, לא $9$.',
    'ספרו קפיצות, לא נקודות: מ־$1$ עד $4$ יש 3 קפיצות של יחידה, ולכן האורך $3$.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', text: 'קטע הוא קו ישר בין שתי נקודות. נתחיל בקטעים שהולכים לאורך קווי הרשת: אופקיים או אנכיים.' },
    { kind: 'explore', text: 'הנקודה $C$ נמצאת ב־$(1, 2)$. שימו את $D$ באותו גובה, 4 צעדים מימין ל־$C$.', manip: plot('D', { shape: [corner('C', 1, 2)] }), answer: [5, 2],
      hint: 'באותו גובה: $y$ נשאר $2$. רק 4 צעדים ימינה לאורך $x$.', success: '$D(5, 2)$. רק $x$ השתנה, מ־$1$ ל־$5$, והאורך הוא $5 - 1 = 4$.' },
    { kind: 'predict', text: 'הקטע מ־$C(1, 2)$ עד $D(5, 2)$: מה מחשבים כדי לקבל את האורך?',
      choices: ['$5 - 1$', '$2 - 2$', '$5 + 2$'], answer: 0,
      why: '$y$ זהה בשתי הנקודות, כי הקטע אופקי. כל האורך נמצא בשינוי של $x$: $5 - 1 = 4$.',
      wrongWhy: { 1: '$2 - 2 = 0$ רק אומר שהקטע לא עולה ולא יורד. האורך הוא השינוי ב־$x$.', 2: 'חיבור של $x$ ושל $y$ של נקודה אחת לא מודד מרחק בין שתי נקודות.' } },
    { kind: 'predict', text: 'ועכשיו קטע שחוצה את ציר $y$: מה האורך של הקטע מ־$E(-3, 1)$ עד $F(4, 1)$?',
      choices: ['$1$', '$7$', '$-7$'], answer: 1,
      why: 'מ־$-3$ הולכים 3 צעדים עד ציר $y$, ועוד 4 צעדים עד $4$: ביחד $7$. בחשבון: $4 - (-3) = 7$.',
      wrongWhy: { 0: '$4 - 3 = 1$ שוכח ש־$E$ משמאל לציר: הצעדים משני הצדדים של האפס מצטברים.', 2: 'אורך הוא מספר צעדים, ולכן הוא לא שלילי. מחסרים את הקטן מהגדול.' } },
    { kind: 'explore', text: 'בדקו בעצמכם: $E$ נמצאת ב־$(-3, 1)$. שימו את $F(4, 1)$ וספרו את הצעדים ביניהן.', manip: plot('F', { shape: [corner('E', -3, 1)] }), answer: [4, 1],
      hint: '$F$ באותו גובה כמו $E$. ספרו: 3 עד ציר $y$, ועוד 4.', success: '7 צעדים: 3 משמאל לציר ו־4 מימינו. $4 - (-3) = 4 + 3 = 7$.' },
    { kind: 'explore', text: '$G$ נמצאת ב־$(-2, -4)$. שימו את $H$ בדיוק מעליה, כך שאורך הקטע $GH$ יהיה 6.', manip: plot('H', { shape: [corner('G', -2, -4)] }), answer: [-2, 2],
      hint: 'בדיוק מעליה: $x$ נשאר $-2$. מ־$-4$ עולים 6 צעדים.', success: '$H(-2, 2)$, כי $2 - (-4) = 6$. גם כאן חצינו ציר, והחיסור של השלילי הוסיף את הצעדים שמתחת לאפס.' },
    { kind: 'predict', text: 'הקטע מ־$(2, -6)$ עד $(2, -1)$. מה האורך?',
      choices: ['$5$', '$7$', '$-5$'], answer: 0,
      why: 'שתי הנקודות מתחת לציר $x$, אז הקטע לא חוצה אותו: $-1 - (-6) = -1 + 6 = 5$.',
      wrongWhy: { 1: 'הקטע לא חוצה ציר: שני הקצוות באותו צד. מ־$-6$ עד $-1$ יש 5 צעדים.', 2: 'מחסרים את הקטן מהגדול: $-1$ גדול מ־$-6$.' } },
    { kind: 'rule', text: 'אורך קטע אופקי הוא ההפרש בין ערכי $x$, ואורך קטע אנכי הוא ההפרש בין ערכי $y$. תמיד הגדול פחות הקטן.', display: 'AB = x_2 - x_1 \\quad (x_2 > x_1)',
      why: 'זה המרחק על ציר המספרים: מספר הצעדים מהקטן לגדול. כשהקטן שלילי, החיסור שלו הופך לחיבור, ומוסיף בדיוק את הצעדים שבצד השני של הציר. והגדול פחות הקטן תמיד חיובי, כמו שאורך צריך להיות.' },
    { kind: 'explore', text: 'נסו לבד: $P$ נמצאת ב־$(-5, -2)$. שימו את $Q$ מימין לה, על אותו קו, כך ש־$PQ = 8$.', manip: plot('Q', { shape: [corner('P', -5, -2)] }), answer: [3, -2],
      hint: 'מ־$-5$ הולכים 8 צעדים ימינה: 5 עד ציר $y$, ועוד 3.', success: '$Q(3, -2)$, כי $3 - (-5) = 8$.' },
  ],
  examples: [
    { problem: 'מה האורך של הקטע $AB$, כש־$A(-3, 2)$ ו־$B(4, 2)$?', answer: 7, check: '4 - (-3)',
      steps: [
        { action: 'בודקים איזה שיעור משתנה.', why: '$y = 2$ בשתי הנקודות, ולכן הקטע אופקי וכל השינוי ב־$x$.', result: 'y_A = y_B = 2' },
        { action: 'מחשבים את ההפרש ב־$x$: הגדול פחות הקטן.', why: 'האורך הוא המרחק על ציר $x$ מ־$-3$ עד $4$. חיסור של שלילי הוא חיבור.', result: '4 - (-3) = 4 + 3', value: '4 + 3' },
        { action: 'מחשבים ובודקים בצעדים.', why: '3 צעדים מ־$-3$ עד האפס, ועוד 4 עד $4$.', result: 'AB = 7', value: '7', calc: { expr: '3 + 4', value: 7 } },
      ] },
    { problem: 'ציר $x$ הוא פני הים, וכל יחידה היא מטר. שחף עף בנקודה $(3, 2)$, ודג שוחה בדיוק מתחתיו בנקודה $(3, -5)$. כמה מטרים בין השחף לדג?', answer: 7, check: '2 - (-5)',
      steps: [
        { action: 'בודקים מה משתנה.', why: '$x = 3$ בשתי הנקודות: הדג בדיוק מתחת לשחף, ולכן רק הגובה, $y$, משתנה.', result: 'x = 3' },
        { action: 'הגדול פחות הקטן ב־$y$.', why: 'השחף ב־$y = 2$, מעל המים. הדג ב־$y = -5$, מתחת למים.', result: '2 - (-5) = 2 + 5', value: '2 + 5' },
        { action: 'מחשבים ומפרשים.', why: '2 מטרים מעל פני הים ועוד 5 מטרים מתחתם.', result: '7', value: '7', calc: { expr: '2 + 5', value: 7 } },
      ] },
  ],
  together: [
    { problem: 'מה האורך של הקטע $MN$, כש־$M(-1, -6)$ ו־$N(-1, 3)$?',
      steps: [
        { prompt: 'איזה שיעור משתנה?', choices: [
          { text: '$y$: הקטע אנכי', ok: true, feedback: 'נכון: $x = -1$ בשתי הנקודות.' },
          { text: '$x$: הקטע אופקי', ok: false, feedback: '$x = -1$ גם ב־$M$ וגם ב־$N$, כלומר הוא לא משתנה. הקטע עומד.' },
          { text: 'שניהם', ok: false, feedback: 'בדקו שוב: $x$ זהה בשתי הנקודות.' },
        ], hints: ['השוו את $x$ של $M$ לשל $N$.', '$x$ שווה, ולכן רק $y$ משתנה: מ־$-6$ עד $3$.'], done: 'הקטע אנכי: מ־$y = -6$ עד $y = 3$.' },
        { prompt: 'איך מחשבים את האורך?', choices: [
          { text: '$3 - (-6)$', ok: true, feedback: 'נכון: הגדול פחות הקטן.' },
          { text: '$6 - 3$', ok: false, feedback: 'זה שוכח ש־$-6$ מתחת לציר $x$ ו־$3$ מעליו. הצעדים משני הצדדים מצטברים.' },
          { text: '$-6 - 3$', ok: false, feedback: 'זה יוצא שלילי, כי התחלתם מהקטן. אורך הוא הגדול פחות הקטן.' },
        ], hints: ['הגדול פחות הקטן. מי גדול: $3$ או $-6$?', '$3 - (-6)$: חיסור של שלילי הוא חיבור.'], done: '$MN = 3 - (-6)$' },
      ],
      final: { prompt: 'כמה זה?', answer: 9, check: '3 - (-6)', hints: ['$3 - (-6) = 3 + 6$.', '6 צעדים מתחת לציר $x$, ועוד 3 מעליו.'] } },
    { problem: 'מה האורך של הקטע $RS$, כש־$R(-6, 4)$ ו־$S(-2, 4)$?',
      steps: [
        { prompt: 'האם הקטע חוצה את ציר $y$?', choices: [
          { text: 'לא: שני ערכי $x$ שליליים', ok: true, feedback: 'נכון: שני הקצוות משמאל לציר $y$.' },
          { text: 'כן, כי יש מספרים שליליים', ok: false, feedback: 'קטע חוצה ציר רק כשקצה אחד חיובי והשני שלילי. כאן שני הקצוות באותו צד.' },
        ], hints: ['מה הסימנים של שני ערכי $x$?', '$-6$ ו־$-2$ שניהם שליליים: אותו צד של ציר $y$.'], done: 'שני הקצוות משמאל לציר $y$.' },
        { prompt: 'מה מחשבים?', choices: [
          { text: '$-2 - (-6)$', ok: true, feedback: 'נכון: $-2$ הוא הגדול.' },
          { text: '$6 + 2$', ok: false, feedback: 'מחברים את שני המרחקים רק כשהקטע עובר את האפס. כאן הוא לא עובר.' },
          { text: '$-6 - (-2)$', ok: false, feedback: 'זה יוצא שלילי. $-2$ גדול מ־$-6$, אז מחסרים ממנו.' },
        ], hints: ['מי גדול: $-6$ או $-2$?', '$-2$ קרוב יותר לאפס ולכן גדול יותר: $-2 - (-6)$.'], done: '$RS = -2 - (-6)$' },
      ],
      final: { prompt: 'מה האורך?', answer: 4, check: '-2 - (-6)', hints: ['$-2 - (-6) = -2 + 6$.', 'מ־$-6$ עד $-2$: ספרו את הצעדים.'] } },
  ],
  diag: segModel,
  transfer: gameModel,
  misconceptions: [
    { id: 'add-coords', title: 'חיסרו את המספרים בלי הסימנים כשהקטע חוצה ציר', prereq: 'signed:1',
      cause: 'בקטע מ־$-3$ עד $4$ קל לכתוב $4 - 3$. אבל $-3$ ו־$3$ הם שני מקומות שונים: הקצה השלילי נמצא בצד השני של הציר, והצעדים משני הצדדים מצטברים.',
      explain: [
        'נראה שבקטע שחוצה ציר, הצעדים שמעבר לאפס הלכו לאיבוד.',
        'מ־$-3$ עד $4$: שלושה צעדים עד האפס, ועוד ארבעה אחריו, $3 + 4 = 7$. בחשבון: $4 - (-3) = 4 + 3 = 7$.',
      ],
      remedy: [
        { kind: 'explore', text: '$A$ נמצאת ב־$(-3, 0)$. שימו את $B(4, 0)$ וספרו את הצעדים מ־$A$.', manip: plot('B', { shape: [corner('A', -3, 0)] }), answer: [4, 0],
          hint: 'לאורך ציר $x$: 3 צעדים עד הראשית, ועוד 4.', success: 'ספרתם 7 צעדים: 3 עד הראשית ו־4 אחריה.' },
        { kind: 'predict', text: 'אז מה האורך של $AB$?', choices: ['$1$', '$7$'], answer: 1, why: '$4 - (-3) = 4 + 3 = 7$. ה־$1$ היה יוצא רק אם $A$ הייתה ב־$3$, באותו צד כמו $B$.' },
        { kind: 'explore', text: '$K$ נמצאת ב־$(1, -5)$. שימו את $L$ מעליה, כך ש־$KL = 7$.', manip: plot('L', { shape: [corner('K', 1, -5)] }), answer: [1, 2],
          hint: 'מ־$-5$ עולים 5 צעדים עד ציר $x$, ועוד 2.', success: '$L(1, 2)$, כי $2 - (-5) = 7$.' },
      ] },
    { id: 'sign', title: 'יצא אורך שלילי',
      cause: 'חיסרו לפי הסדר שבו הנקודות כתובות, ולא את הקטן מהגדול. אורך הוא מספר צעדים, והוא לא יכול להיות שלילי.',
      explain: [
        'המספר יצא נכון, רק עם מינוס. אורך תמיד חיובי.',
        'מחסרים את הקטן מהגדול, לא לפי הסדר שבשאלה: $5 - (-2) = 7$, לא $-2 - 5$.',
      ],
      remedy: [
        { kind: 'predict', text: 'מ־$C(-2, 3)$ עד $D(5, 3)$: מה מחשבים?', choices: ['$-2 - 5$', '$5 - (-2)$'], answer: 1, why: '$5$ הוא הגדול, אז מחסרים ממנו: $5 - (-2) = 7$. החיסור ההפוך נותן $-7$, ואורך לא יכול להיות שלילי.' },
        { kind: 'explore', text: 'בדקו: $C$ ב־$(-2, 3)$. שימו את $D(5, 3)$ וספרו.', manip: plot('D', { shape: [corner('C', -2, 3)] }), answer: [5, 3],
          hint: '2 צעדים עד ציר $y$, ועוד 5.', success: '7 צעדים. מספר צעדים הוא תמיד חיובי.' },
      ] },
    { id: 'coord-length', title: 'ענו את השיעור של הקצה במקום את האורך',
      cause: 'כמו לקרוא סרגל מהאפס כשהחפץ לא מתחיל באפס: השיעור של קצה הוא המרחק שלו מהציר, לא מהקצה השני של הקטע.',
      explain: [
        'נראה שהתשובה הייתה השיעור של אחד הקצוות.',
        'השיעור $7$ אומר שהקצה נמצא 7 צעדים מהציר. אם הקצה השני ב־$2$, הקטע מתחיל שם, והאורך $7 - 2 = 5$.',
      ],
      remedy: [
        { kind: 'explore', text: '$C$ נמצאת ב־$(2, 3)$. שימו את $D(6, 3)$.', manip: plot('D', { shape: [corner('C', 2, 3)] }), answer: [6, 3],
          hint: 'באותו גובה, 4 צעדים מימין ל־$C$.', success: 'ספרו את הצעדים מ־$C$ ל־$D$: ארבעה, לא שישה. הקטע מתחיל ב־$x = 2$, לא בציר.' },
        { kind: 'predict', text: 'מה האורך של הקטע מ־$(1, -2)$ עד $(6, -2)$?', choices: ['$6$', '$5$'], answer: 1, why: '$6 - 1 = 5$. השיעור $6$ סופר גם את הצעד מהציר עד $x = 1$, שלא שייך לקטע.' },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 4: the area of a rectangle

type RectP = { x1: number; x2: number; y1: number; y2: number; d: number }; // x1 < x2, y1 < y2; d: which diagonal is given (transfer)
const crossPair = (rnd: Rnd): [number, number] => { let a = 0; let b = 0; do { a = -rint(rnd, 1, 4); b = rint(rnd, 1, 5); } while (-a === b); return [a, b]; };
const sidePair = (rnd: Rnd): [number, number] => {
  if (rnd() < 0.5) { const lo = rint(rnd, 0, 3); return [lo, lo + rint(rnd, 2, 3)]; }
  const hi = -rint(rnd, 0, 3) || 0; return [hi - rint(rnd, 2, 3), hi];
};
/** A rectangle with sides along the grid: mostly across an axis, often in the first quadrant away from the axes. */
function rectParams(rnd: Rnd): RectP {
  const r = rnd(); const d = rint(rnd, 0, 1);
  if (r < 0.55) {
    const cx = rnd() < 0.7; const cy = !cx || rnd() < 0.4;
    const [x1, x2] = cx ? crossPair(rnd) : sidePair(rnd); const [y1, y2] = cy ? crossPair(rnd) : sidePair(rnd);
    return { x1, x2, y1, y2, d };
  }
  const x1 = rint(rnd, 1, 4); const x2 = x1 + rint(rnd, 2, 5); const y1 = rint(rnd, 1, 4); const y2 = y1 + rint(rnd, 2, 4);
  if (r < 0.8) return { x1, x2, y1, y2, d };
  const fx = rnd() < 0.5; const fy = !fx || rnd() < 0.5; // moved into the second, third or fourth quadrant
  return { x1: fx ? -x2 : x1, x2: fx ? -x1 : x2, y1: fy ? -y2 : y1, y2: fy ? -y1 : y2, d };
}
const W = (p: RectP) => p.x2 - p.x1;
const H = (p: RectP) => p.y2 - p.y1;
const areaBugs = {
  perimeter: (p: RectP) => 2 * (W(p) + H(p)),
  'add-sides': (p: RectP) => W(p) + H(p),
  // a side that crosses an axis came out too short: |x2| − |x1| instead of x2 − x1
  'add-coords': (p: RectP) => {
    const cx = p.x1 < 0 && p.x2 > 0; const cy = p.y1 < 0 && p.y2 > 0;
    if (!cx && !cy) return null;
    return (cx ? Math.abs(Math.abs(p.x2) - Math.abs(p.x1)) : W(p)) * (cy ? Math.abs(Math.abs(p.y2) - Math.abs(p.y1)) : H(p));
  },
  // multiplied the coordinates of the far corner, as if the rectangle started at the origin
  'coord-length': (p: RectP) => (p.x1 >= 0 && p.y1 >= 0 && p.d === 0 ? p.x2 * p.y2 : null),
};
const areaSolution = (p: RectP) => [
  `רוחב: $${T(p.x2)} - ${T(p.x1, true)} = ${W(p)}$`,
  `גובה: $${T(p.y2)} - ${T(p.y1, true)} = ${H(p)}$`,
  `שטח: $${W(p)} \\cdot ${H(p)} = ${W(p) * H(p)}$`,
];

const areaModel: DiagModel<RectP> = {
  params: (rnd) => ({ ...rectParams(rnd), d: 0 }),
  text: (p) => `מה השטח של המלבן $ABCD$? $A${pt(p.x1, p.y1)}$, $B${pt(p.x2, p.y1)}$, $C${pt(p.x2, p.y2)}$, $D${pt(p.x1, p.y2)}$`,
  answer: (p) => W(p) * H(p),
  bugs: areaBugs,
  solution: areaSolution,
  hint: () => 'מוצאים את אורך הצלע האופקית (לפי $x$) ואת אורך הצלע האנכית (לפי $y$), וכופלים: שורות של משבצות.',
  unit: 'יחידות ריבועיות',
};

const carpetModel: DiagModel<RectP> = {
  // only two opposite corners are given: the student has to see the width and the height in them
  params: rectParams,
  text: (p) => {
    const [a, b] = p.d === 0 ? [pt(p.x1, p.y1), pt(p.x2, p.y2)] : [pt(p.x1, p.y2), pt(p.x2, p.y1)];
    return `על תוכנית של חדר, כל יחידה היא מטר אחד. שטיח מלבני מונח כך שהצלעות שלו מקבילות לצירים, ושתי פינות נגדיות שלו נמצאות ב־$${a}$ וב־$${b}$. כמה מטרים רבועים השטח של השטיח?`;
  },
  answer: (p) => W(p) * H(p),
  bugs: areaBugs,
  solution: (p) => [`הפינות הנגדיות נותנות את שני ערכי $x$, $${T(p.x1)}$ ו־$${T(p.x2)}$, ואת שני ערכי $y$, $${T(p.y1)}$ ו־$${T(p.y2)}$.`, ...areaSolution(p)],
  hint: () => 'שתי פינות נגדיות שונות גם ב־$x$ וגם ב־$y$. ההפרש ב־$x$ הוא הרוחב, וההפרש ב־$y$ הוא הגובה.',
  unit: 'מטרים רבועים',
};

const stair4: StairContent = {
  skill: 'coord:4', topic: 'coord', level: 4, title: 'שטח מלבן',
  objectives: [
    'למצוא את הרוחב ואת הגובה של מלבן שהצלעות שלו מקבילות לצירים, מתוך השיעורים של הקודקודים.',
    'לחשב שטח כרוחב כפול גובה, ולהבין למה כופלים ולא מחברים.',
    'להבחין בין שטח (מה שבפנים) לבין היקף (הגבול).',
  ],
  idea: 'השטח הוא מספר המשבצות שבתוך המלבן. המשבצות מסודרות בשורות: בכל שורה יש כמספר הרוחב, ויש כמספר הגובה שורות. לכן שטח = רוחב כפול גובה.',
  why: [
    'מלבן שהצלעות שלו מקבילות לצירים מתחלק בדיוק למשבצות של הרשת, וכל משבצת היא יחידה ריבועית אחת.',
    'בשורה אחת יש משבצות כמספר הרוחב. השורות נערמות זו על זו כמספר הגובה. שורות שוות שנערמות הן כפל.',
    'חיבור הרוחב והגובה סופר צעדים לאורך הגבול, לא משבצות בפנים: $a + b$ הוא חצי מההיקף, ו־$2(a + b)$ הוא ההיקף כולו.',
  ],
  alt: [
    'חשבו על חפיסת שוקולד: 5 קוביות בשורה ו־3 שורות הן $5 \\cdot 3 = 15$ קוביות, לא $5 + 3 = 8$.',
    'אפשר לבדוק בספירה: במלבן ברוחב 4 ובגובה 2 יש 2 שורות של 4 משבצות, $4 + 4 = 8 = 4 \\cdot 2$.',
    'הרוחב והגובה הם אורכים של קטעים, כמו במדרגה הקודמת: הגדול פחות הקטן. רק אחרי שיש אורכים כופלים.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', text: 'שטח הוא כמה משבצות של $1 \\times 1$ מכסות צורה. ברשת של מערכת הצירים כל משבצת היא יחידה ריבועית אחת.' },
    { kind: 'explore', text: 'שימו את $P(4, 3)$. הקווים המקווקווים מ־$P$ אל הצירים סוגרים איתם מלבן.', manip: plot('P'), answer: [4, 3],
      hint: '4 ימינה, ואז 3 למעלה.', success: 'המלבן שבין הראשית ל־$P$: 4 משבצות לרוחב ו־3 לגובה.' },
    { kind: 'predict', text: 'כמה משבצות בתוך המלבן הזה?', choices: ['$7$', '$12$', '$14$'], answer: 1,
      why: '3 שורות, ובכל אחת 4 משבצות: $3 \\cdot 4 = 12$.',
      wrongWhy: { 0: '$4 + 3 = 7$ סופר צעדים לאורך שתי צלעות, לא משבצות בפנים.', 2: '$14$ הוא ההיקף: כל הצעדים מסביב למלבן. השטח הוא מה שבפנים.' } },
    { kind: 'explore', text: 'מלבן לא חייב להתחיל בראשית. שלושה קודקודים: $A(-3, -2)$, $B(2, -2)$, $C(2, 1)$. שימו את $D$ וסגרו את המלבן.',
      manip: plot('D', { shape: [corner('A', -3, -2), corner('B', 2, -2), corner('C', 2, 1)] }), answer: [-3, 1],
      hint: 'ל־$D$ אותו $x$ כמו ל־$A$, ואותו $y$ כמו ל־$C$.', success: 'המלבן $ABCD$ סגור. עכשיו נמדוד אותו.' },
    { kind: 'predict', text: 'מה הרוחב של המלבן, אורך הצלע $AB$?', choices: ['$5$', '$1$', '$-5$'], answer: 0,
      why: '$AB$ אופקית: $2 - (-3) = 5$. מ־$-3$ עד האפס 3 צעדים, ועוד 2.',
      wrongWhy: { 1: '$3 - 2 = 1$ שוכח את הצד השלילי: הצלע חוצה את ציר $y$.', 2: 'אורך הוא הגדול פחות הקטן, ותמיד חיובי.' } },
    { kind: 'predict', text: 'הגובה הוא $1 - (-2) = 3$. מה השטח?', choices: ['$8$', '$15$', '$16$'], answer: 1,
      why: '3 שורות של 5 משבצות: $5 \\cdot 3 = 15$.',
      wrongWhy: { 0: '$5 + 3 = 8$ מחבר את הצלעות. השטח סופר משבצות בשורות, וזה כפל.', 2: '$16 = 2(5 + 3)$ הוא ההיקף: הגבול, לא מה שבפנים.' } },
    { kind: 'rule', text: 'שטח מלבן שהצלעות שלו מקבילות לצירים הוא רוחב $a$ כפול גובה $b$. הרוחב הוא ההפרש בין ערכי $x$, והגובה הוא ההפרש בין ערכי $y$.', display: 'S = a \\cdot b',
      why: 'המלבן מתחלק לשורות שוות של משבצות: $b$ שורות, ובכל אחת $a$ משבצות. שורות שוות נספרות בכפל. חיבור הצלעות סופר רק צעדים לאורך הגבול.' },
    { kind: 'predict', text: 'מלבן ברוחב 6 ובגובה 2, ומלבן ברוחב 4 ובגובה 4. לאיזה מהם שטח גדול יותר?', choices: ['לראשון', 'לשני', 'השטחים שווים'], answer: 1,
      why: '$6 \\cdot 2 = 12$ ו־$4 \\cdot 4 = 16$. ההיקף של שניהם שווה, $16$, אבל השטח לא. היקף ושטח מודדים דברים שונים.',
      wrongWhy: { 2: 'ההיקפים שווים: $2(6 + 2) = 2(4 + 4) = 16$. אבל השטחים, $12$ ו־$16$, שונים.' } },
    { kind: 'explore', text: 'נסו לבד: שימו נקודה $P$ ברביע השלישי, כך שהמלבן שהקווים המקווקווים סוגרים עם הצירים יהיה ברוחב 5 ובשטח 10.', manip: plot('P'), answer: [-5, -2],
      hint: 'רוחב 5 שמאלה: $x = -5$. השטח 10, אז הגובה $10 : 5 = 2$, למטה.', success: '$P(-5, -2)$: רוחב 5, גובה 2, ו־$5 \\cdot 2 = 10$.' },
  ],
  examples: [
    { problem: 'מה השטח של המלבן $ABCD$? $A(-4, -1)$, $B(2, -1)$, $C(2, 3)$, $D(-4, 3)$', answer: 24, check: '(2 - (-4)) * (3 - (-1))',
      steps: [
        { action: 'מוצאים את הרוחב: הצלע $AB$ אופקית.', why: '$y$ זהה ב־$A$ וב־$B$. האורך הוא ההפרש ב־$x$, הגדול פחות הקטן.', result: '2 - (-4) = 6', calc: { expr: '2 - (-4)', value: 6 } },
        { action: 'מוצאים את הגובה: הצלע $BC$ אנכית.', why: '$x$ זהה ב־$B$ וב־$C$. מ־$-1$ עד $3$: צעד אחד עד הציר ועוד 3.', result: '3 - (-1) = 4', calc: { expr: '3 - (-1)', value: 4 } },
        { action: 'כופלים רוחב בגובה.', why: '4 שורות, ובכל אחת 6 משבצות.', result: 'S = 6 \\cdot 4 = 24', value: '6 * 4' },
      ] },
    { problem: 'גינה מלבנית בתוכנית של חצר, וכל יחידה היא מטר. הפינות של הגינה ב־$(-3, -4)$, $(3, -4)$, $(3, 3)$, $(-3, 3)$. כמה מרצפות דשא של מטר על מטר צריך כדי לכסות אותה?', answer: 42, check: '(3 - (-3)) * (3 - (-4))',
      steps: [
        { action: 'רוחב: ההפרש בין ערכי $x$.', why: 'הצלע התחתונה מ־$x = -3$ עד $x = 3$.', result: '3 - (-3) = 6', calc: { expr: '3 - (-3)', value: 6 } },
        { action: 'גובה: ההפרש בין ערכי $y$.', why: 'הצלע הימנית מ־$y = -4$ עד $y = 3$.', result: '3 - (-4) = 7', calc: { expr: '3 - (-4)', value: 7 } },
        { action: 'מרצפות מכסות את מה שבפנים: מחשבים שטח.', why: '7 שורות של 6 מרצפות.', result: '6 \\cdot 7 = 42', value: '6 * 7' },
        { action: 'להשוואה: גדר מסביב לגינה היא היקף, וזו שאלה אחרת.', why: 'הגדר הולכת לאורך הגבול: $6 + 7 + 6 + 7$ מטרים. המרצפות ממלאות את הפנים.', result: '2(6 + 7) = 26', calc: { expr: '2 * (6 + 7)', value: 26 } },
      ] },
  ],
  together: [
    { problem: 'מה השטח של המלבן $KLMN$? $K(-5, -3)$, $L(1, -3)$, $M(1, 2)$, $N(-5, 2)$',
      steps: [
        { prompt: 'מה הרוחב?', choices: [
          { text: '$1 - (-5) = 6$', ok: true, feedback: 'נכון: $KL$ אופקית, והגדול פחות הקטן.' },
          { text: '$5 - 1 = 4$', ok: false, feedback: 'הצלע חוצה את ציר $y$: מ־$-5$ עד האפס 5 צעדים, ועוד 1.' },
          { text: '$1 + 2 = 3$', ok: false, feedback: 'אלה $x$ ו־$y$ של אותה נקודה. הרוחב הוא ההפרש בין ערכי $x$ של שני קודקודים באותה שורה.' },
        ], hints: ['הרוחב הוא הצלע האופקית $KL$. איזה שיעור משתנה בה?', 'ב־$KL$ משתנה $x$: מ־$-5$ עד $1$. הגדול פחות הקטן.'], done: 'רוחב: $6$' },
        { prompt: 'מה הגובה?', choices: [
          { text: '$2 - (-3) = 5$', ok: true, feedback: 'נכון: $LM$ אנכית.' },
          { text: '$3 - 2 = 1$', ok: false, feedback: 'הצלע חוצה את ציר $x$: 3 צעדים מתחתיו ועוד 2 מעליו.' },
          { text: '$-3 - 2 = -5$', ok: false, feedback: 'גובה הוא אורך, ואורך לא שלילי: הגדול פחות הקטן.' },
        ], hints: ['הגובה הוא הצלע האנכית $LM$: מ־$y = -3$ עד $y = 2$.', 'הגדול פחות הקטן: $2 - (-3)$.'], done: 'גובה: $5$' },
        { prompt: 'מה עושים עם הרוחב והגובה?', choices: [
          { text: 'כופלים: $6 \\cdot 5$', ok: true, feedback: 'נכון: 5 שורות של 6 משבצות.' },
          { text: 'מחברים: $6 + 5$', ok: false, feedback: 'חיבור סופר צעדים לאורך שתי צלעות. השטח הוא 5 שורות של 6 משבצות.' },
          { text: '$2(6 + 5)$', ok: false, feedback: 'זה ההיקף, הגבול. השטח הוא מה שבפנים.' },
        ], hints: ['כמה שורות של משבצות יש, וכמה משבצות בכל שורה?', '5 שורות של 6: כפל.'], done: '$S = 6 \\cdot 5$' },
      ],
      final: { prompt: 'כמה זה?', answer: 30, check: '6 * 5', hints: ['$6 \\cdot 5$', 'חמש פעמים שש.'] } },
    { problem: 'למלבן צלעות מקבילות לצירים, ושני קודקודים נגדיים שלו הם $(-4, 3)$ ו־$(2, -1)$. מה השטח שלו?',
      steps: [
        { prompt: 'מה הרוחב?', choices: [
          { text: '$2 - (-4) = 6$', ok: true, feedback: 'נכון: שני ערכי $x$ של המלבן הם $-4$ ו־$2$.' },
          { text: '$4 - 2 = 2$', ok: false, feedback: 'מ־$-4$ עד $2$ עוברים את ציר $y$: 4 צעדים עד האפס ועוד 2.' },
          { text: '$3 - (-1) = 4$', ok: false, feedback: 'זה ההפרש בין ערכי $y$, כלומר הגובה. הרוחב הולך לאורך $x$.' },
        ], hints: ['קודקודים נגדיים שונים בשני השיעורים. מאיפה לוקחים את הרוחב?', 'הרוחב הוא ההפרש בין ערכי $x$: $-4$ ו־$2$.'], done: 'רוחב: $6$' },
        { prompt: 'ומה הגובה?', choices: [
          { text: '$3 - (-1) = 4$', ok: true, feedback: 'נכון.' },
          { text: '$3 - 1 = 2$', ok: false, feedback: 'המינוס של $-1$ חשוב: מ־$-1$ עד $3$ יש 4 צעדים.' },
        ], hints: ['ההפרש בין ערכי $y$: $3$ ו־$-1$.', 'הגדול פחות הקטן: $3 - (-1)$.'], done: 'גובה: $4$' },
      ],
      final: { prompt: 'מה השטח?', answer: 24, check: '6 * 4', hints: ['רוחב כפול גובה.', '$6 \\cdot 4$'] } },
  ],
  diag: areaModel,
  transfer: carpetModel,
  misconceptions: [
    { id: 'perimeter', title: 'חישבו היקף במקום שטח',
      cause: 'היקף ושטח הם שניהם "גודל" של מלבן, והם מתבלבלים. היקף הוא אורך הגבול, מסביב. שטח הוא כמה משבצות בפנים.',
      explain: [
        'נראה שחושב ההיקף, $2(a + b)$: הדרך מסביב למלבן.',
        'שאלת השטח היא כמה משבצות מכסות את המלבן: $a$ משבצות בשורה, $b$ שורות, ולכן $a \\cdot b$.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו את $P(3, 2)$, והסתכלו על המלבן שהקווים המקווקווים סוגרים עם הצירים.', manip: plot('P'), answer: [3, 2], hint: '3 ימינה, ואז 2 למעלה.', success: 'מלבן של 3 על 2.' },
        { kind: 'predict', text: 'כמה משבצות יש בפנים, וכמה צעדים מסביב?', choices: ['6 בפנים, 10 מסביב', '10 בפנים, 6 מסביב'], answer: 0,
          why: 'בפנים: 2 שורות של 3, $3 \\cdot 2 = 6$. זה השטח. מסביב: $3 + 2 + 3 + 2 = 10$ צעדים. זה ההיקף.' },
      ] },
    { id: 'add-sides', title: 'חיברו את הצלעות במקום לכפול',
      cause: 'רואים שני מספרים, רוחב וגובה, ומחברים אותם. אבל השטח סופר משבצות, והן מסודרות בשורות שוות: זה כפל.',
      explain: [
        '$a + b$ סופר רק צעדים לאורך שתי צלעות, כמו ללכת מפינה לפינה.',
        'בתוך מלבן ברוחב $4$ ובגובה $3$ יש 3 שורות של 4: $4 + 4 + 4 = 4 \\cdot 3 = 12$, לא $4 + 3 = 7$.',
      ],
      remedy: [
        { kind: 'explore', text: 'שימו את $P(5, 2)$: המלבן עם הצירים הוא 5 על 2.', manip: plot('P'), answer: [5, 2], hint: '5 ימינה, ואז 2 למעלה.', success: 'שתי שורות, בכל אחת 5 משבצות.' },
        { kind: 'predict', text: 'כמה משבצות בתוך המלבן?', choices: ['$7$', '$10$'], answer: 1, why: '2 שורות של 5: $5 + 5 = 10 = 5 \\cdot 2$. ה־$7$ הוא רק הצעדים לאורך שתי צלעות.' },
      ] },
    { id: 'add-coords', title: 'טעו ברוחב או בגובה כשהמלבן חוצה ציר', prereq: 'coord:3',
      cause: 'כשצלע חוצה ציר, קל לחסר את המספרים בלי הסימנים. אבל הצעדים משני הצדדים של הציר מצטברים.',
      explain: [
        'הכפל נכון, אבל צלע שחוצה ציר יצאה קצרה מדי.',
        'רוחב מ־$-3$ עד $2$ הוא $2 - (-3) = 5$: שלושה צעדים עד ציר $y$ ועוד שניים. לא $3 - 2 = 1$.',
      ],
      remedy: [
        { kind: 'explore', text: '$A$ נמצאת ב־$(-3, 1)$. שימו את $B(2, 1)$ וספרו את הצעדים.', manip: plot('B', { shape: [corner('A', -3, 1)] }), answer: [2, 1],
          hint: '3 צעדים עד ציר $y$, ועוד 2.', success: '5 צעדים: הרוחב הוא $2 - (-3) = 5$.' },
        { kind: 'predict', text: 'מלבן מ־$x = -4$ עד $x = 1$ ומ־$y = -2$ עד $y = 3$. מה השטח?', choices: ['$25$', '$3$'], answer: 0,
          why: 'רוחב $1 - (-4) = 5$, גובה $3 - (-2) = 5$, שטח $25$. ה־$3$ יוצא מ־$4 - 1$ ו־$3 - 2$: בלי הצעדים שמעבר לצירים.' },
      ] },
    { id: 'coord-length', title: 'כפלו את השיעורים של קודקוד במקום רוחב וגובה',
      cause: 'כשמלבן מתחיל בראשית, השיעורים של הקודקוד הרחוק הם בדיוק הרוחב והגובה. כשהוא לא מתחיל שם, שיעור מודד מהציר, לא מהצלע שמולו.',
      explain: [
        'נראה שהשיעורים של קודקוד אחד שימשו כרוחב וכגובה.',
        'שיעור הוא מרחק מציר. רוחב הוא מרחק בין שתי צלעות. במלבן מ־$x = 2$ עד $x = 6$ הרוחב הוא $6 - 2 = 4$, לא $6$.',
      ],
      remedy: [
        { kind: 'explore', text: 'שלושה קודקודים: $A(2, 1)$, $B(6, 1)$, $C(6, 4)$. שימו את $D$.', manip: plot('D', { shape: [corner('A', 2, 1), corner('B', 6, 1), corner('C', 6, 4)] }), answer: [2, 4],
          hint: 'מעל $A$, בגובה של $C$.', success: 'המלבן לא נוגע בצירים: יש רווח בינו לבין הראשית.' },
        { kind: 'predict', text: 'מה הרוחב של המלבן הזה?', choices: ['$6$', '$4$'], answer: 1, why: 'הרוחב מתחיל ב־$x = 2$, לא באפס: $6 - 2 = 4$.' },
        { kind: 'predict', text: 'ומה השטח?', choices: ['$24$', '$12$'], answer: 1, why: 'רוחב $4$ וגובה $4 - 1 = 3$: $4 \\cdot 3 = 12$. ה־$24 = 6 \\cdot 4$ סופר גם משבצות שבין המלבן לצירים.' },
      ] },
  ],
};

// ---------------------------------------------------------------- stair 5: the missing vertex

const NAMES = ['A', 'B', 'C', 'D'];
/** The corners counterclockwise from the bottom left. */
const cornersOf = (p: { x1: number; x2: number; y1: number; y2: number }) => [[p.x1, p.y1], [p.x2, p.y1], [p.x2, p.y2], [p.x1, p.y2]];
function boxParams(rnd: Rnd) {
  const x1 = rint(rnd, -6, 3); const x2 = rint(rnd, x1 + 2, 6); const y1 = rint(rnd, -6, 3); const y2 = rint(rnd, y1 + 2, 6);
  return { x1, x2, y1, y2 };
}

// k 0: three labelled vertices are given; k 1: one vertex and the length of a side from it
type VertP = { k: number; x1: number; x2: number; y1: number; y2: number; r: number; m: number; ask: number; s: number; o: number; d: number; L: number; h: number };
const vAt = (p: VertP, label: number) => cornersOf(p)[(label + p.r) % 4];
const vAns = (p: VertP) => (p.k === 0 ? vAt(p, p.m)[p.ask] : p.s + p.d * p.L);
const sideWord = (h: number, d: number) => (h ? (d > 0 ? 'מימין' : 'משמאל') : (d > 0 ? 'מעל' : 'מתחת'));
/** One coordinate that starts at s and moves L in direction d, staying on the grid. */
function moveParams(rnd: Rnd) {
  let s = 0; let L = 0; let d = 1;
  do { s = rnz(rnd, -5, 5); L = rint(rnd, 2, 6); d = rnd() < 0.5 ? 1 : -1; } while (Math.abs(s + d * L) > 6);
  return { s, L, d };
}

const vertexModel: DiagModel<VertP> = {
  params: (rnd) => {
    if (rnd() < 0.7) return { k: 0, ...boxParams(rnd), r: rint(rnd, 0, 3), m: rint(rnd, 0, 3), ask: rint(rnd, 0, 1), s: 0, o: 0, d: 0, L: 0, h: 0 };
    return { k: 1, x1: 0, x2: 0, y1: 0, y2: 0, r: 0, m: 1, ask: 0, ...moveParams(rnd), o: rnz(rnd, -5, 5), h: rint(rnd, 0, 1) };
  },
  text: (p) => {
    if (p.k === 0) {
      const given = [0, 1, 2, 3].filter((i) => i !== p.m).map((i) => { const [x, y] = vAt(p, i); return `$${NAMES[i]}${pt(x, y)}$`; });
      return `$ABCD$ הוא מלבן שהצלעות שלו מקבילות לצירים. נתון: ${given.join(', ')}. מה שיעור ה־$${XY(p.ask)}$ של $${NAMES[p.m]}$?`;
    }
    const [ax, ay] = p.h ? [p.s, p.o] : [p.o, p.s];
    return `$ABCD$ הוא מלבן שהצלעות שלו מקבילות לצירים. $A${pt(ax, ay)}$, והצלע $AB$ ${p.h ? 'אופקית' : 'אנכית'} ואורכה $${p.L}$: $B$ ${sideWord(p.h, p.d)} ל־$A$. מה שיעור ה־$${p.h ? 'x' : 'y'}$ של $B$?`;
  },
  answer: vAns,
  bugs: {
    // the vertex is found, its x and y change places
    swap: (p) => (p.k === 0 ? vAt(p, p.m)[1 - p.ask] : p.o),
    // the coordinate taken from the other neighbour: it is the opposite vertex's
    'wrong-neighbour': (p) => (p.k === 0 ? vAt(p, (p.m + 2) % 4)[p.ask] : null),
    // the side's length written as the coordinate
    'coord-length': (p) => (p.k === 1 ? p.L : null),
    // started from the given vertex without its minus
    sign: (p) => (p.k === 1 && p.s < 0 ? -p.s + p.d * p.L : null),
  },
  solution: (p) => {
    const ans = vAns(p);
    if (p.k === 0) {
      const [mx, my] = vAt(p, p.m); const prev = (p.m + 3) % 4; const next = (p.m + 1) % 4;
      const v = vAt(p, prev)[0] === mx ? prev : next; const hz = v === prev ? next : prev;
      return [
        `השכנים של $${NAMES[p.m]}$ הם $${NAMES[prev]}$ ו־$${NAMES[next]}$, ו־$${NAMES[(p.m + 2) % 4]}$ מולו באלכסון.`,
        `$${NAMES[v]}$ ${vAt(p, v)[1] > my ? 'מעליו' : 'מתחתיו'}, על צלע אנכית: אותו $x$, $${T(mx)}$. $${NAMES[hz]}$ ${vAt(p, hz)[0] > mx ? 'מימינו' : 'משמאלו'}, על צלע אופקית: אותו $y$, $${T(my)}$.`,
        `$${NAMES[p.m]}${pt(mx, my)}$, ושיעור ה־$${XY(p.ask)}$ שלו הוא $${T(ans)}$.`,
      ];
    }
    const [bx, by] = p.h ? [ans, p.o] : [p.o, ans];
    return [
      `$AB$ ${p.h ? 'אופקית, ולכן ל־$B$ אותו $y$ כמו ל־$A$' : 'אנכית, ולכן ל־$B$ אותו $x$ כמו ל־$A$'}. משתנה רק $${p.h ? 'x' : 'y'}$.`,
      `$B$ ${sideWord(p.h, p.d)} ל־$A$, במרחק $${p.L}$: $${T(p.s)} ${p.d > 0 ? '+' : '-'} ${p.L} = ${T(ans)}$.`,
      `$B${pt(bx, by)}$, ושיעור ה־$${p.h ? 'x' : 'y'}$ שלו הוא $${T(ans)}$.`,
    ];
  },
  hint: (p) => (p.k === 0
    ? 'לקודקוד החסר אותו $x$ כמו לשכן שמעליו או מתחתיו, ואותו $y$ כמו לשכן שמימינו או משמאלו.'
    : 'האורך אומר כמה זזים. מתחילים מהשיעור של $A$, עם הסימן שלו, וזזים.'),
};

// k 0: three tent pegs, unlabelled; k 1: a square, where the side's length comes from AB
type CampP = { k: number; x1: number; x2: number; y1: number; y2: number; mi: number; order: number[]; ask: number; ax: number; bx: number; ay: number; d: number };
const campAns = (p: CampP) => (p.k === 0 ? cornersOf(p)[p.mi][p.ask] : p.ay + p.d * Math.abs(p.bx - p.ax));
const campModel: DiagModel<CampP> = {
  params: (rnd) => {
    if (rnd() < 0.5) {
      const mi = rint(rnd, 0, 3);
      return { k: 0, ...boxParams(rnd), mi, order: shuffled(rnd, [0, 1, 2, 3].filter((i) => i !== mi)), ask: rint(rnd, 0, 1), ax: 0, bx: 0, ay: 0, d: 0 };
    }
    let ax = 0; let bx = 0; let ay = 0; let d = 1; let side = 0;
    do { ax = rint(rnd, -5, 4); side = rint(rnd, 2, 5); bx = ax + side; ay = rnz(rnd, -5, 5); d = rnd() < 0.5 ? 1 : -1; } while (bx > 6 || Math.abs(ay + d * side) > 6);
    if (rnd() < 0.5) [ax, bx] = [bx, ax];
    return { k: 1, x1: 0, x2: 0, y1: 0, y2: 0, mi: 0, order: [], ask: 1, ax, bx, ay, d };
  },
  text: (p) => {
    if (p.k === 0) {
      const K = cornersOf(p); const g = p.order.map((i) => `$${pt(K[i][0], K[i][1])}$`);
      return `על מפת מחנה, שלוש יתדות של אוהל מלבני תקועות ב־${g[0]}, ב־${g[1]} וב־${g[2]}. הצלעות של האוהל מקבילות לצירים. איפה צריך לתקוע את היתד הרביעית? כתבו את שיעור ה־$${XY(p.ask)}$ שלה.`;
    }
    return `$ABCD$ הוא ריבוע שהצלעות שלו מקבילות לצירים. $A${pt(p.ax, p.ay)}$, $B${pt(p.bx, p.ay)}$, והקודקוד $C$ ${p.d > 0 ? 'מעל ' : 'מתחת ל־'}$B$. מה שיעור ה־$y$ של $C$?`;
  },
  answer: campAns,
  bugs: {
    swap: (p) => (p.k === 0 ? cornersOf(p)[p.mi][1 - p.ask] : p.bx),
    'wrong-neighbour': (p) => (p.k === 0 ? cornersOf(p)[(p.mi + 2) % 4][p.ask] : null),
    'coord-length': (p) => (p.k === 1 ? Math.abs(p.bx - p.ax) : null),
    sign: (p) => (p.k === 1 && p.ay < 0 ? -p.ay + p.d * Math.abs(p.bx - p.ax) : null),
  },
  solution: (p) => {
    const ans = campAns(p);
    if (p.k === 0) {
      const [mx, my] = cornersOf(p)[p.mi];
      return [
        'במלבן יש רק שני ערכי $x$ ושני ערכי $y$, וכל אחד מהם מופיע בשתי פינות.',
        `בין שלוש היתדות, $x = ${T(mx)}$ מופיע רק פעם אחת, וגם $y = ${T(my)}$. אלה השיעורים של הפינה החסרה.`,
        `היתד הרביעית ב־$${pt(mx, my)}$, ושיעור ה־$${XY(p.ask)}$ שלה הוא $${T(ans)}$.`,
      ];
    }
    const side = Math.abs(p.bx - p.ax);
    return [
      `הצלע של הריבוע: $AB = ${T(Math.max(p.ax, p.bx))} - ${T(Math.min(p.ax, p.bx), true)} = ${side}$.`,
      `$C$ ${p.d > 0 ? 'מעל ' : 'מתחת ל־'}$B$: אותו $x$, ו־$y$ ${p.d > 0 ? 'גדל' : 'קטן'} ב־$${side}$. $${T(p.ay)} ${p.d > 0 ? '+' : '-'} ${side} = ${T(ans)}$.`,
      `$C${pt(p.bx, ans)}$.`,
    ];
  },
  hint: (p) => (p.k === 0 ? 'כל ערך $x$ מופיע בשתי פינות של המלבן. איזה $x$ מופיע רק פעם אחת בין היתדות?' : 'בריבוע כל הצלעות שוות. כמה אורכה של $AB$?'),
};

const stair5: StairContent = {
  skill: 'coord:5', topic: 'coord', level: 5, title: 'קודקוד חסר',
  objectives: [
    'להשלים את הקודקוד הרביעי של מלבן שהצלעות שלו מקבילות לצירים.',
    'להבין שכל קודקוד חולק $x$ עם שכן אחד ו־$y$ עם השכן השני.',
    'למצוא קודקוד גם כשנתונים קודקוד אחד ואורך של צלע.',
  ],
  idea: 'במלבן שהצלעות שלו מקבילות לצירים, כל קודקוד חולק את ה־$x$ שלו עם השכן שמעליו או מתחתיו, ואת ה־$y$ שלו עם השכן שמימינו או משמאלו. הקודקוד החסר לוקח שיעור אחד מכל שכן.',
  why: [
    'צלע אנכית עומדת על קו שבו $x$ קבוע, ולכן לשני הקצוות שלה אותו $x$. צלע אופקית שוכבת על קו שבו $y$ קבוע.',
    'כל קודקוד הוא מפגש של צלע אנכית אחת וצלע אופקית אחת. מהאנכית הוא מקבל את ה־$x$, ומהאופקית את ה־$y$.',
    'הקודקוד שמול הקודקוד החסר, באלכסון, לא חולק איתו אף שיעור: הוא בשורה אחרת ובעמודה אחרת.',
  ],
  alt: [
    'חשבו על טבלה: במלבן יש רק שתי עמודות (שני ערכי $x$) ושתי שורות (שני ערכי $y$). כל ערך מופיע בשני קודקודים, ולכן בין שלושת הנתונים, הערך שמופיע רק פעם אחת שייך לחסר.',
    'בשם $ABCD$ הקודקודים מסודרים סביב המלבן. לכן השכנים של $D$ הם $C$ ו־$A$, ו־$B$ נמצא מולו באלכסון.',
    'אפשר גם לזוז: מ־$A$ ל־$B$ זזים לאורך צלע אחת. אותה תזוזה בדיוק מ־$D$ מביאה ל־$C$.',
  ],
  discover: [
    { kind: 'say', mood: 'happy', text: 'שלושה קודקודים של מלבן כבר ידועים. איפה הרביעי? נגלה שאפשר למצוא אותו בלי לנחש ובלי לשרטט.' },
    { kind: 'explore', text: 'שלושה קודקודים: $A(-4, -2)$, $B(3, -2)$, $C(3, 4)$. שימו את $D$ וסגרו את המלבן.',
      manip: plot('D', { shape: [corner('A', -4, -2), corner('B', 3, -2), corner('C', 3, 4)] }), answer: [-4, 4],
      hint: 'הצלעות מקבילות לצירים: $D$ מעל $A$, ומשמאל ל־$C$.', success: '$D(-4, 4)$. המלבן סגור.' },
    { kind: 'predict', text: 'מה משותף ל־$D(-4, 4)$ ול־$A(-4, -2)$?', choices: ['אותו $x$', 'אותו $y$', 'אין שיעור משותף'], answer: 0,
      why: '$DA$ צלע אנכית: היא עומדת על הקו $x = -4$. לכן ל־$D$ ול־$A$ אותו $x$.' },
    { kind: 'predict', text: 'ומה משותף ל־$D(-4, 4)$ ול־$C(3, 4)$?', choices: ['אותו $x$', 'אותו $y$', 'אין שיעור משותף'], answer: 1,
      why: '$DC$ צלע אופקית, על הקו $y = 4$. לכן ל־$D$ ול־$C$ אותו $y$.' },
    { kind: 'predict', text: 'ול־$D(-4, 4)$ ול־$B(3, -2)$, שמולו באלכסון?', choices: ['אותו $x$', 'אותו $y$', 'אין שיעור משותף'], answer: 2,
      why: '$B$ שונה מ־$D$ בשני השיעורים. הקודקוד שמול באלכסון לא נותן לחסר כלום: לוקחים מהשכנים.' },
    { kind: 'rule', text: 'הקודקוד החסר לוקח את ה־$x$ מהשכן שמעליו או מתחתיו, ואת ה־$y$ מהשכן שמימינו או משמאלו.', display: 'D(x_A,\\ y_C)',
      why: 'כל צלע מקבילה לציר, ולכן לאורכה שיעור אחד קבוע. קודקוד הוא המפגש של צלע אנכית, שקובעת לו את ה־$x$, וצלע אופקית, שקובעת לו את ה־$y$.' },
    { kind: 'explore', text: 'עכשיו חסר $B$: נתונים $A(-5, 1)$, $C(2, 5)$, $D(-5, 5)$. שימו את $B$.',
      manip: plot('B', { shape: [corner('C', 2, 5), corner('D', -5, 5), corner('A', -5, 1)] }), answer: [2, 1],
      hint: 'השכנים של $B$ הם $A$ ו־$C$. $B$ מתחת ל־$C$ ומימין ל־$A$.', success: '$B(2, 1)$: את ה־$x$ מ־$C$, שמעליו, ואת ה־$y$ מ־$A$, שמשמאלו.' },
    { kind: 'predict', text: 'נתונים $A(1, -3)$, $B(6, -3)$, $C(6, 2)$. מה השיעורים של $D$?', choices: ['$(1, 2)$', '$(6, -3)$', '$(2, 1)$'], answer: 0,
      why: 'את ה־$x$ מ־$A$, שמתחתיו: $1$. את ה־$y$ מ־$C$, שמימינו: $2$.',
      wrongWhy: { 1: 'אלה השיעורים של $B$, שמול $D$ באלכסון. ל־$D$ אין איתו שיעור משותף.', 2: 'המספרים נכונים, אבל הסדר התהפך: $x$ קודם.' } },
    { kind: 'predict', text: 'ואם נתון רק קודקוד אחד ואורך? $A(-2, -3)$, והצלע $AB$ אופקית ואורכה $5$, ימינה. איפה $B$?', choices: ['$(3, -3)$', '$(5, -3)$', '$(-2, 2)$'], answer: 0,
      why: 'אופקית: $y$ לא משתנה. ימינה 5 מ־$-2$: $-2 + 5 = 3$.',
      wrongWhy: { 1: '$5$ הוא האורך, לא השיעור. מתחילים ב־$-2$ וזזים 5.', 2: 'זה 5 למעלה, אבל הצלע אופקית: זזים ימינה.' } },
    { kind: 'explore', text: 'נסו לבד: נתונים $B(4, -5)$, $C(4, 1)$, $D(-3, 1)$. שימו את $A$.',
      manip: plot('A', { shape: [corner('B', 4, -5), corner('C', 4, 1), corner('D', -3, 1)] }), answer: [-3, -5],
      hint: 'השכנים של $A$ הם $B$ ו־$D$. $A$ מתחת ל־$D$ ומשמאל ל־$B$.', success: '$A(-3, -5)$: ה־$x$ מ־$D$ וה־$y$ מ־$B$.' },
  ],
  examples: [
    { problem: '$ABCD$ הוא מלבן שהצלעות שלו מקבילות לצירים. $A(-4, -1)$, $B(3, -1)$, $C(3, 5)$. מה שיעור ה־$x$ של $D$?', answer: -4, check: '-4',
      steps: [
        { action: 'מזהים את השכנים של $D$.', why: 'הקודקודים מסודרים סביב המלבן, $A$, $B$, $C$, $D$ וחוזרים ל־$A$. לכן השכנים של $D$ הם $C$ ו־$A$, ו־$B$ מולו.', result: '\\overline{DA},\\ \\overline{DC}' },
        { action: 'מוצאים איזו צלע אנכית.', why: '$CB$ אנכית ($x = 3$ גם ב־$B$ וגם ב־$C$), ו־$DA$ מקבילה לה. לכן $DA$ אנכית, ול־$D$ אותו $x$ כמו ל־$A$.', result: 'x_D = x_A = -4', value: '-4' },
        { action: 'ה־$y$ מהשכן השני.', why: '$DC$ אופקית, ולכן ל־$D$ אותו $y$ כמו ל־$C$.', result: 'y_D = y_C = 5', calc: { expr: '5', value: 5 } },
        { action: 'כותבים ובודקים.', why: '$D$ חולק שיעור עם כל שכן, ואף שיעור עם $B$ שמולו: $(3, -1)$ שונה בשניהם.', result: 'D(-4, 5)', value: '-4' },
      ] },
    { problem: 'על מפת מחנה, שלוש יתדות של אוהל מלבני תקועות ב־$(-2, 3)$, ב־$(-2, -1)$ וב־$(5, -1)$. איפה צריך לתקוע את היתד הרביעית? כתבו את שיעור ה־$y$ שלה.', answer: 3, check: '3',
      steps: [
        { action: 'מוצאים את הפינה שמול היתד החסרה.', why: '$(-2, -1)$ חולקת $x$ עם $(-2, 3)$ ו־$y$ עם $(5, -1)$: היא שכנה של שתיהן, ולכן היא מול החסרה.', result: '(-2, -1)' },
        { action: 'את ה־$x$ לוקחים מ־$(5, -1)$.', why: 'היתד החסרה מעליה, על אותה צלע אנכית. או בטבלה: $x = 5$ מופיע רק פעם אחת.', result: 'x = 5', calc: { expr: '5', value: 5 } },
        { action: 'ואת ה־$y$ מ־$(-2, 3)$.', why: 'היתד החסרה מימינה, על אותה צלע אופקית. $y = 3$ מופיע רק פעם אחת.', result: 'y = 3', value: '3' },
        { action: 'כותבים את היתד.', why: 'בדיקה: לכל יתד שכנה יש איתה שיעור משותף אחד.', result: '(5, 3)', value: '3' },
      ] },
  ],
  together: [
    { problem: '$ABCD$ הוא מלבן שהצלעות שלו מקבילות לצירים. $A(-3, 4)$, $C(5, -2)$, $D(-3, -2)$. מה השיעורים של $B$?',
      steps: [
        { prompt: 'מי השכנים של $B$?', choices: [
          { text: '$A$ ו־$C$', ok: true, feedback: 'נכון: בסיבוב $A$, $B$, $C$, הקודקוד $B$ באמצע.' },
          { text: '$D$ בלבד', ok: false, feedback: '$D$ מול $B$ באלכסון, ואין להם שיעור משותף.' },
          { text: '$A$ ו־$D$', ok: false, feedback: '$D$ מול $B$. השכנים של $B$ הם הקודקודים שלפניו ואחריו בשם: $A$ ו־$C$.' },
        ], hints: ['בשם $ABCD$ הקודקודים מסודרים בסיבוב.', 'ב־$A$, $B$, $C$ הקודקוד $B$ באמצע: השכנים שלו $A$ ו־$C$.'], done: 'השכנים: $A(-3, 4)$ ו־$C(5, -2)$.' },
        { prompt: 'מאיזה שכן לוקחים את ה־$x$ של $B$?', choices: [
          { text: 'מ־$C$: $x = 5$', ok: true, feedback: 'נכון: $C$ ו־$D$ באותה שורה, $y = -2$, אז $CD$ אופקית ו־$BC$ אנכית.' },
          { text: 'מ־$A$: $x = -3$', ok: false, feedback: 'ל־$A$ ול־$D$ אותו $x$, כלומר $AD$ היא הצלע האנכית שם. $AB$ אופקית, ולכן $A$ נותן ל־$B$ את ה־$y$.' },
        ], hints: ['איזו צלע אנכית, $AB$ או $BC$? בדקו: $D$ חולק $x$ עם $A$.', '$AD$ אנכית, ולכן $AB$ אופקית ו־$BC$ אנכית: $B$ לוקח $x$ מ־$C$.'], done: '$x_B = 5$' },
      ],
      final: { prompt: 'ומה שיעור ה־$y$ של $B$?', answer: 4, check: '4', hints: ['$AB$ אופקית.', 'לאורך צלע אופקית $y$ לא משתנה: $y_B = y_A$.'] } },
    { problem: '$ABCD$ הוא מלבן שהצלעות שלו מקבילות לצירים. $A(-5, -2)$, והצלע $AB$ אופקית ואורכה $7$: $B$ מימין ל־$A$. מה שיעור ה־$x$ של $B$?',
      steps: [
        { prompt: 'מה משתנה בין $A$ ל־$B$?', choices: [
          { text: 'רק $x$', ok: true, feedback: 'נכון: לאורך צלע אופקית $y$ קבוע.' },
          { text: 'רק $y$', ok: false, feedback: '$y$ משתנה לאורך צלע אנכית. $AB$ אופקית.' },
          { text: 'שניהם', ok: false, feedback: 'הצלע מקבילה לציר $x$, ולכן $y$ לא משתנה לאורכה.' },
        ], hints: ['לאורך איזה ציר שוכבת $AB$?', 'אופקית: רק $x$ משתנה.'], done: '$y_B = -2$, ורק $x$ משתנה.' },
        { prompt: 'איך מחשבים את ה־$x$ של $B$?', choices: [
          { text: '$-5 + 7$', ok: true, feedback: 'נכון: מתחילים ב־$A$ וזזים 7 ימינה.' },
          { text: '$7$', ok: false, feedback: '$7$ הוא האורך, כמה זזים. מתחילים מ־$A$, לא מהציר.' },
          { text: '$5 + 7$', ok: false, feedback: '$A$ ב־$x = -5$, משמאל לציר $y$. המינוס חשוב: מתחילים שם.' },
        ], hints: ['מאיפה מתחילים, ולאיזה כיוון זזים?', 'מ־$-5$ זזים 7 ימינה: מוסיפים.'], done: '$x_B = -5 + 7$' },
      ],
      final: { prompt: 'כמה זה?', answer: 2, check: '-5 + 7', hints: ['5 צעדים עד ציר $y$. כמה נשארו?', '$7 - 5 = 2$, מימין לציר.'] } },
  ],
  diag: vertexModel,
  transfer: campModel,
  misconceptions: [
    { id: 'swap', title: 'החליפו בין $x$ ל־$y$', prereq: 'coord:1',
      cause: 'הקודקוד נמצא במקום הנכון, אבל כשכותבים או קוראים אותו, $x$ ו־$y$ מתחלפים.',
      explain: [
        'נראה שהמקום של הקודקוד נמצא נכון, אבל המספרים התחלפו.',
        'בדיקה מהירה: ה־$x$ של הקודקוד חייב להיות אחד משני ערכי ה־$x$ של המלבן, וה־$y$ אחד משני ערכי ה־$y$. אם ה־$x$ שלכם הוא בכלל ערך של $y$, הם התחלפו.',
      ],
      remedy: [
        { kind: 'explore', text: 'שלושה קודקודים: $A(-4, -1)$, $B(3, -1)$, $C(3, 5)$. שימו את $D$.', manip: plot('D', { shape: [corner('A', -4, -1), corner('B', 3, -1), corner('C', 3, 5)] }), answer: [-4, 5],
          hint: 'מעל $A$, בגובה של $C$.', success: '$D$ מעל $A$: 4 שמאלה ו־5 למעלה.' },
        { kind: 'predict', text: 'איך כותבים את $D$?', choices: ['$(-4, 5)$', '$(5, -4)$'], answer: 0, why: 'קודם $x$: 4 שמאלה, $-4$. אחר כך $y$: 5 למעלה. $(5, -4)$ הוא מקום אחר, למטה מימין.' },
      ] },
    { id: 'wrong-neighbour', title: 'לקחו שיעור מהשכן הלא נכון',
      cause: 'יודעים שהקודקוד החסר חולק שיעור עם כל שכן, אבל מתאימים הפוך: לוקחים את ה־$x$ מהשכן שבאותה שורה, שחולק איתו דווקא את ה־$y$. כך יוצא שיעור של הקודקוד שמול, באלכסון.',
      explain: [
        'נראה שהשיעור נלקח מהשכן הלא נכון, ולכן יצא השיעור של הקודקוד שמול באלכסון.',
        'בודקים לפני שלוקחים: שכן שמעל או מתחת לקודקוד החסר נותן את ה־$x$. שכן שמימינו או משמאלו נותן את ה־$y$.',
        'דרך בטוחה: במלבן כל ערך $x$ מופיע בדיוק פעמיים. בין שלושת הקודקודים הנתונים, ה־$x$ שמופיע רק פעם אחת הוא ה־$x$ של החסר.',
      ],
      remedy: [
        { kind: 'explore', text: 'שלושה קודקודים: $A(-3, -2)$, $B(4, -2)$, $C(4, 3)$. שימו את $D$.', manip: plot('D', { shape: [corner('A', -3, -2), corner('B', 4, -2), corner('C', 4, 3)] }), answer: [-3, 3],
          hint: 'סגרו את המלבן: $D$ מעל $A$.', success: '$D(-3, 3)$.' },
        { kind: 'predict', text: 'מעל איזה קודקוד נמצא $D$?', choices: ['מעל $A$', 'מעל $B$'], answer: 0, why: '$D$ מעל $A$, ולכן לקח ממנו את ה־$x$: $-3$. $B$ מול $D$ באלכסון, וה־$x$ שלו, $4$, שייך ל־$C$.' },
        { kind: 'predict', text: 'נתונים $(2, -1)$, $(2, 5)$, $(-4, 5)$. איזה $x$ מופיע רק פעם אחת?', choices: ['$2$', '$-4$'], answer: 1, why: '$2$ מופיע פעמיים, $-4$ פעם אחת. לכן לקודקוד החסר $x = -4$, והוא $(-4, -1)$.' },
      ] },
    { id: 'coord-length', title: 'כתבו את אורך הצלע במקום את השיעור של הקודקוד', prereq: 'coord:3',
      cause: 'האורך אומר כמה זזים, והשיעור אומר לאן מגיעים. מגיעים לשיעור רק אם מתחילים מהקודקוד הנתון, לא מהציר.',
      explain: [
        'נראה שאורך הצלע נכתב כאילו הוא השיעור של הקודקוד החדש.',
        'אם $A$ ב־$x = -2$ והצלע באורך $5$ ימינה, הולכים 5 צעדים מ־$-2$: $-2 + 5 = 3$. רק צלע שיוצאת מהציר עצמו מגיעה בדיוק ל־$5$.',
      ],
      remedy: [
        { kind: 'explore', text: '$A$ נמצאת ב־$(-2, -3)$. שימו את $B$ 5 צעדים מימין ל־$A$.', manip: plot('B', { shape: [corner('A', -2, -3)] }), answer: [3, -3],
          hint: 'מ־$-2$: 2 צעדים עד ציר $y$, ועוד 3.', success: '$B(3, -3)$. הלכתם 5 צעדים, והגעתם ל־$x = 3$.' },
        { kind: 'predict', text: 'מה שיעור ה־$x$ של $B$?', choices: ['$5$', '$3$'], answer: 1, why: '$-2 + 5 = 3$. ה־$5$ הוא מספר הצעדים, לא המקום שאליו מגיעים.' },
      ] },
    { id: 'sign', title: 'שכחו את המינוס של הקודקוד הנתון',
      cause: 'כשהקודקוד הנתון בצד השלילי, קל להתחיל לספור מהמספר בלי המינוס, כלומר מהצד השני של הציר.',
      explain: [
        'נראה שההתחלה הייתה בצד הלא נכון של הציר.',
        'מ־$y = -2$ עולים 5: $-2 + 5 = 3$. מי שמתחיל מ־$2$ מגיע ל־$7$.',
      ],
      remedy: [
        { kind: 'explore', text: '$A$ נמצאת ב־$(1, -2)$. הצלע $AB$ אנכית ואורכה 5, ו־$B$ מעל $A$. שימו את $B$.', manip: plot('B', { shape: [corner('A', 1, -2)] }), answer: [1, 3],
          hint: 'מ־$-2$ עולים: 2 צעדים עד ציר $x$, ועוד 3.', success: '$B(1, 3)$, כי $-2 + 5 = 3$.' },
        { kind: 'predict', text: '$A(-4, 2)$, ו־$B$ נמצא 6 צעדים מימין ל־$A$. מה ה־$x$ של $B$?', choices: ['$2$', '$10$'], answer: 0, why: 'מתחילים ב־$-4$, משמאל לציר: $-4 + 6 = 2$. ה־$10$ יוצא אם מתחילים מ־$4$.' },
      ] },
  ],
};

export const COORD: StairContent[] = [stair1, stair2, stair3, stair4, stair5];
/** Names of misconceptions new to this topic (merged into the topic's cats so the board can name them). */
export const CATS_COORD: Record<string, string> = {
  'axis-zero': 'חשבו שנקודה על ציר $x$ היא נקודה שבה $x = 0$',
  'quad-order': 'מספרו את הרביעים עם כיוון השעון',
  'axis-quadrant': 'שייכו לרביע נקודה שנמצאת על ציר',
  'coord-length': 'בלבלו בין שיעור של נקודה לבין אורך',
  'wrong-neighbour': 'לקחו שיעור מהשכן הלא נכון של הקודקוד',
};
export { readModel, quadModel, segModel, areaModel, vertexModel };
