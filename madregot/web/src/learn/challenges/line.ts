// Challenge tasks of the linear function (curriculum stage 1, CURRICULUM-6.5): line:c1, two taxi companies and the
// distance where they cost the same; line:c2, a claim about two lines with the same slope; line:c3, a slope computed
// upside down. Their numbers are checked by the lane's verify/facts-challenges17.mjs and by learn/challenges.test.ts.
// PRODUCT2-21 (a task after every stair): line:c4, after line:1, a claim that y doubles when x doubles
// ('proportional'); line:c5, after line:2, the first number read as the slope ('m-b'); line:c6, after line:3, a claim
// that a steeper line has a bigger slope, and a slope counted in steps; line:c7, after line:5, the proof that the slope
// between any two points of y = mx + b is m, then a line through two points; line:c8, after line:6, a phone battery:
// slope and intercept from a story, then where the line crosses the x-axis; line:c9, after line:7, a triangle with
// the axes whose area came out negative ('neg-length').
import type { ChallengeTask, FigSpec } from '../types';

/** line:c6: the line y = −3x + 4 through A(0, 4) and B(2, −2): 2 steps right, 6 down. */
const STEEP_FIG: FigSpec = {
  type: 'coord', range: 5, line: { m: -3, b: 4 },
  points: [{ x: 0, y: 4, label: 'A' }, { x: 2, y: -2, label: 'B' }],
};

export const LINE_CHALLENGES: ChallengeTask[] = [
  {
    id: 'line:c1', topic: 'line', after: 'line:8', kind: 'literacy', title: 'שתי חברות מוניות', minutes: 7,
    story: 'בחברת מוניות א משלמים $12$ ש״ח על הכניסה ועוד $4$ ש״ח לכל קילומטר. בחברה ב משלמים $20$ ש״ח על הכניסה ועוד $3$ ש״ח לכל קילומטר. המחיר בחברה א הוא $y = 12 + 4x$, ובחברה ב $y = 20 + 3x$, כש־$x$ הוא אורך הנסיעה בק״מ.',
    parts: [
      { type: 'num', prompt: 'כמה עולה נסיעה של $5$ ק״מ בחברה א?', answer: 32, check: '12+4*5', unit: 'ש״ח',
        solution: ['מציבים $x = 5$: $y = 12 + 4 \\cdot 5$.', '$12 + 20 = 32$ ש״ח.'] },
      { type: 'num', prompt: 'באיזה אורך נסיעה המחיר בשתי החברות שווה?', answer: 8, check: '(20-12)/(4-3)', unit: 'ק״מ',
        solution: ['משווים את שני המחירים: $12 + 4x = 20 + 3x$.', 'מחסרים $3x$ ו־$12$ משני האגפים: $x = 8$ ק״מ.'] },
      { type: 'num', prompt: 'ומה המחיר בנסיעה הזאת?', answer: 44, check: '12+4*8', unit: 'ש״ח',
        solution: ['בחברה א: $12 + 4 \\cdot 8 = 44$.', 'בחברה ב: $20 + 3 \\cdot 8 = 44$. אותו מחיר, $44$ ש״ח: זו נקודת המפגש של שני הישרים.'] },
      { type: 'mc', prompt: 'נסיעה של $15$ ק״מ: איזו חברה זולה יותר?', choices: [
        { text: 'חברה ב: $65$ ש״ח מול $72$', ok: true, feedback: 'נכון: $20 + 3 \\cdot 15 = 65$, ו־$12 + 4 \\cdot 15 = 72$. אחרי $8$ ק״מ חברה ב זולה יותר.' },
        { text: 'חברה א', ok: false, feedback: 'בחברה א: $12 + 4 \\cdot 15 = 72$ ש״ח, ובחברה ב רק $65$. חברה א זולה יותר רק בנסיעות קצרות מ־$8$ ק״מ.' },
        { text: 'אותו מחיר', ok: false, feedback: 'המחירים שווים רק בנסיעה של $8$ ק״מ. ב־$15$ ק״מ: $72$ מול $65$.' },
      ] },
    ],
  },
  {
    id: 'line:c2', topic: 'line', after: 'line:8', kind: 'claim', title: 'אותו שיפוע', minutes: 5,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"שני ישרים עם אותו שיפוע לא נפגשים."', verdict: 'sometimes',
        why: 'ל־$y = 2x + 1$ ול־$y = 2x + 4$ יש אותו שיפוע, והם מקבילים: הם לא נפגשים. אבל $y = 2x + 1$ ו־$y = 1 + 2x$ הם אותו ישר בדיוק, ונפגשים בכל נקודה שלו.' },
      { type: 'num', prompt: 'הישרים $y = 2x + 1$ ו־$y = 2x + 4$. בכמה הישר השני גבוה מהראשון, ב־$x = 5$?', answer: 3, check: '(2*5+4)-(2*5+1)',
        solution: ['ב־$x = 5$: $2 \\cdot 5 + 4 = 14$, ו־$2 \\cdot 5 + 1 = 11$.', '$14 - 11 = 3$. בכל $x$ ההפרש הוא $4 - 1 = 3$, ולכן הישרים לא נפגשים.'] },
      { type: 'mc', prompt: 'מתי שני ישרים עם אותו שיפוע נפגשים?', choices: [
        { text: 'כשגם $b$ שלהם שווה: אז זה אותו ישר', ok: true, feedback: 'נכון: אותו $m$ ואותו $b$ הם אותו ישר. עם $b$ שונה, הם מקבילים.' },
        { text: 'כשהשיפוע גדול מ־$1$', ok: false, feedback: 'גודל השיפוע לא משנה. $y = 5x$ ו־$y = 5x + 1$ מקבילים, כי ההפרש ביניהם תמיד $1$.' },
        { text: 'כשממשיכים אותם מספיק רחוק', ok: false, feedback: 'ישרים מקבילים לא נפגשים, גם רחוק מאוד: ההפרש ביניהם נשאר אותו הפרש בכל $x$.' },
      ] },
    ],
  },
  {
    id: 'line:c3', topic: 'line', after: 'line:4', kind: 'error', title: 'שיפוע הפוך', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך חישבה שירה.',
        lines: ['השיפוע של הישר דרך $(1, 2)$ ו־$(3, 8)$:', '$m = \\frac{3 - 1}{8 - 2}$', '$m = \\frac{2}{6} = \\frac{1}{3}$'], wrong: 1,
        why: 'שיפוע הוא השינוי ב־$y$ חלקי השינוי ב־$x$: $m = \\frac{8 - 2}{3 - 1}$. אצל שירה המונה והמכנה התחלפו.',
        lineWhy: { 0: 'זו רק השאלה. הטעות מתחילה אחריה.', 2: 'הצמצום נכון: $\\frac{2}{6} = \\frac{1}{3}$. אבל השבר עצמו הפוך, בשורה שלפניה.' },
        fix: { prompt: 'מה השיפוע של הישר?', answer: 3, check: '(8-2)/(3-1)' } },
      { type: 'mc', prompt: 'איך אפשר לחשוד בתשובה $\\frac{1}{3}$ בלי לחשב?', choices: [
        { text: '$x$ גדל ב־$2$ ו־$y$ עולה ב־$6$: הישר תלול, והשיפוע גדול מ־$1$', ok: true, feedback: 'נכון: כש־$y$ משתנה יותר מ־$x$, השיפוע גדול מ־$1$. ו־$\\frac{1}{3}$ קטן מ־$1$.' },
        { text: 'שיפוע הוא מספר שלם', ok: false, feedback: 'שיפוע יכול להיות שבר, למשל $\\frac{1}{3}$. החשד כאן בא מזה ש־$y$ עולה ב־$6$ כש־$x$ גדל רק ב־$2$.' },
        { text: 'אי אפשר לחשוד בלי לחשב', ok: false, feedback: 'אפשר: $y$ עולה ב־$6$ כש־$x$ גדל ב־$2$. ישר כזה תלול, והשיפוע שלו גדול מ־$1$.' },
      ] },
    ],
  },
  {
    id: 'line:c4', topic: 'line', after: 'line:1', kind: 'claim', title: 'פי שניים ב־$x$, פי שניים ב־$y$?', minutes: 5, misc: 'proportional',
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"ב־$y = 2x + 3$, כש־$x$ גדל פי $2$, גם $y$ גדל פי $2$."', verdict: 'never',
        why: 'ב־$x = 1$, $y = 5$. ב־$x = 2$, $y = 7$ ולא $10$. כש־$x$ גדל פי $2$, החלק $2x$ גדל פי $2$, אבל ה־$3$ נשאר $3$. רק בישר שעובר בראשית, כמו $y = 2x$, גם $y$ גדל פי $2$.',
        example: {
          ask: 'בחרו $x$ ובדקו: האם $y$ גדל פי $2$ כש־$x$ גדל פי $2$?', slots: [{ name: 'x', label: '$x$' }],
          domain: 'number', expr: '(2*(2*x) + 3) - 2*(2*x + 3)', rel: '!=', value: 0, hint: 'נסו $x = 1$: אז $y = 5$. ומה $y$ כש־$x = 2$?',
        } },
      { type: 'num', prompt: 'ב־$y = 2x + 3$, מה $y$ כש־$x = -4$?', answer: -5, check: '2*(-4)+3',
        solution: ['מציבים: $y = 2 \\cdot (-4) + 3$.', '$-8 + 3 = -5$.'] },
      { type: 'mc', prompt: 'ב־$y = 2x + 3$, כש־$x$ גדל ב־$1$, מה קורה ל־$y$?', choices: [
        { text: 'הוא גדל ב־$2$', ok: true, feedback: 'נכון: כל $1$ נוסף ב־$x$ מוסיף $2$ ל־$2x$. ב־$x = 1$, $y = 5$, וב־$x = 2$, $y = 7$.' },
        { text: 'הוא גדל ב־$3$', ok: false, feedback: 'ה־$3$ קבוע: הוא אותו $3$ בכל $x$. ב־$x = 1$, $y = 5$, וב־$x = 2$, $y = 7$: הפרש של $2$.' },
        { text: 'הוא גדל ב־$5$', ok: false, feedback: '$5$ הוא $y$ כש־$x = 1$, ולא השינוי. ב־$x = 2$, $y = 7$, כלומר $y$ גדל ב־$2$.' },
      ] },
    ],
  },
  {
    id: 'line:c5', topic: 'line', after: 'line:2', kind: 'error', title: 'המספר הראשון הוא השיפוע?', minutes: 5, misc: 'm-b',
    parts: [
      { type: 'error', prompt: 'כך קראה שירה את הישר $y = 4 - 3x$.',
        lines: ['$y = 4 - 3x$', 'השיפוע הוא המספר הראשון: $m = 4$.', 'לכן הישר עולה: כש־$x$ גדל ב־$1$, $y$ גדל ב־$4$.'], wrong: 1,
        why: 'השיפוע הוא המספר שכופל את $x$, ולא המספר שכתוב ראשון. $y = 4 - 3x$ הוא $y = -3x + 4$: $m = -3$ ו־$b = 4$, והישר יורד.',
        lineWhy: { 0: 'זה רק הישר מהשאלה. הטעות מתחילה אחריו.', 2: 'אילו $m = 4$, הישר באמת היה עולה. הטעות בשורה שלפניה.' },
        fix: { prompt: 'מה השיפוע של הישר?', answer: -3, check: '-3' } },
      { type: 'num', prompt: 'הישר חותך את ציר ה־$y$ בנקודה $(0, b)$. מה $b$?', answer: 4, check: '4-3*0',
        solution: ['על ציר ה־$y$, $x = 0$.', '$y = 4 - 3 \\cdot 0 = 4$, ולכן $b = 4$.'] },
      { type: 'mc', prompt: 'הישר $y = 4 - 3x$ עולה או יורד?', choices: [
        { text: 'יורד, כי $m = -3$', ok: true, feedback: 'נכון: השיפוע שלילי. בכל צעד ימינה $y$ יורד ב־$3$.' },
        { text: 'עולה, כי $4$ חיובי', ok: false, feedback: 'ה־$4$ הוא $b$: הוא אומר איפה הישר חותך את ציר ה־$y$, לא לאן הוא הולך. הכיוון נקבע לפי $m = -3$.' },
        { text: 'אי אפשר לדעת בלי לשרטט', ok: false, feedback: 'אפשר: הסימן של $m$ אומר את זה. $m = -3$ שלילי, ולכן הישר יורד.' },
      ] },
    ],
  },
  {
    id: 'line:c6', topic: 'line', after: 'line:3', kind: 'claim', title: 'תלול יותר, שיפוע גדול יותר?', minutes: 5, fig: STEEP_FIG,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"ישר תלול יותר הוא ישר עם שיפוע גדול יותר."', verdict: 'sometimes',
        why: 'בישרים עולים זה נכון: $y = 3x$ תלול יותר מ־$y = x$, ו־$3 > 1$. אבל $y = -3x$ תלול יותר מ־$y = -x$, ו־$-3 < -1$. התלילות תלויה במרחק של השיפוע מ־$0$, לא בסימן שלו.',
        // a counterexample: p is steeper than q (p farther from 0), and p is not bigger (p ≤ q; whole numbers, so ≤ is < 0.5 more)
        example: {
          ask: 'תנו שני שיפועים: של ישר תלול יותר, שהשיפוע שלו לא גדול יותר.', slots: [{ name: 'p', label: 'שיפוע הישר התלול' }, { name: 'q', label: 'שיפוע הישר השני' }],
          domain: 'int', expr: 'min(abs(p) - abs(q), q - p + 0.5)', rel: '>', value: 0, hint: 'נסו שני ישרים יורדים.',
        } },
      { type: 'num', prompt: 'בשרטוט הישר עובר דרך $A(0, 4)$ ו־$B(2, -2)$. מה השיפוע שלו?', answer: -3, check: '(-2-4)/(2-0)',
        solution: ['מ־$A$ ל־$B$: $2$ צעדים ימינה, ו־$6$ צעדים למטה.', 'השיפוע: $\\frac{-6}{2} = -3$.'] },
      { type: 'mc', prompt: 'איזה ישר הכי תלול?', choices: [
        { text: '$y = -3x + 4$', ok: true, feedback: 'נכון: השיפוע $-3$ הוא הרחוק ביותר מ־$0$. בכל צעד ימינה הישר יורד $3$.' },
        { text: '$y = 2x$', ok: false, feedback: 'בכל צעד ימינה הישר הזה עולה $2$. הישר $y = -3x + 4$ יורד $3$ בכל צעד, ולכן הוא תלול יותר.' },
        { text: '$y = x + 5$', ok: false, feedback: 'השיפוע כאן $1$: צעד אחד למעלה לכל צעד ימינה. $y = -3x + 4$ זז $3$ בכל צעד, ולכן הוא תלול יותר.' },
      ] },
    ],
  },
  {
    id: 'line:c7', topic: 'line', after: 'line:5', kind: 'proof', title: 'אותו שיפוע בכל מקום', minutes: 7,
    parts: [
      { type: 'order', prompt: 'למה בין כל שתי נקודות על הישר $y = mx + b$ השיפוע יוצא $m$? סדרו את שלבי ההוכחה, מהראשון לאחרון.',
        steps: [
          { text: 'לוקחים על הישר שתי נקודות, $(x_1, y_1)$ ו־$(x_2, y_2)$, כש־$x_1 \\ne x_2$.' },
          { text: 'שתיהן על הישר, ולכן $y_1 = m x_1 + b$ וגם $y_2 = m x_2 + b$.',
            reason: { choices: ['נקודה על ישר מקיימת את המשוואה שלו', 'בכל נקודה על ישר $y = x$', 'השיפוע של כל ישר הוא $b$'], answer: 0 } },
          { text: 'מחסרים את המשוואות: $b$ מתבטל, ו־$y_2 - y_1 = m(x_2 - x_1)$.',
            reason: { choices: ['$b - b = 0$, ו־$m$ יוצא מהסוגריים לפי חוק הפילוג', 'מחברים את שתי המשוואות', 'מציבים $x = 0$'], answer: 0 } },
          { text: 'מחלקים ב־$x_2 - x_1$, שאינו $0$: $\\frac{y_2 - y_1}{x_2 - x_1} = m$.' },
          { text: 'לכן השיפוע בין כל שתי נקודות על הישר הוא אותו מספר, $m$.' },
        ] },
      { type: 'num', prompt: 'ישר עובר דרך $(1, 5)$ ו־$(3, 11)$. מה השיפוע שלו?', answer: 3, check: '(11-5)/(3-1)',
        solution: ['$m = \\frac{11 - 5}{3 - 1} = \\frac{6}{2}$.', '$m = 3$.'] },
      { type: 'num', prompt: 'ומה $b$ במשוואה $y = mx + b$ של הישר הזה?', answer: 2, check: '5-3*1',
        solution: ['מציבים את $(1, 5)$ ואת $m = 3$: $5 = 3 \\cdot 1 + b$.', '$b = 5 - 3 = 2$, והמשוואה $y = 3x + 2$. בדיקה: $3 \\cdot 3 + 2 = 11$.'] },
    ],
  },
  {
    id: 'line:c8', topic: 'line', after: 'line:6', kind: 'literacy', title: 'הסוללה של הטלפון', minutes: 7,
    story: 'בשמונה בבוקר הסוללה של הטלפון של נועה מלאה ב־$80\\%$. היא משתמשת בטלפון כל היום, והסוללה יורדת ב־$5\\%$ בכל שעה. $x$ הוא מספר השעות משמונה, ו־$y$ הוא אחוז הסוללה.',
    parts: [
      { type: 'mc', prompt: 'איזה ישר מתאר את הסוללה?', choices: [
        { text: '$y = 80 - 5x$', ok: true, feedback: 'נכון: מתחילים ב־$80$, ובכל שעה יורדים $5$. השיפוע $-5$, ו־$b = 80$.' },
        { text: '$y = 80 + 5x$', ok: false, feedback: 'כאן הסוללה עולה ב־$5\\%$ בכל שעה. היא יורדת, ולכן השיפוע שלילי: $y = 80 - 5x$.' },
        { text: '$y = 80x - 5$', ok: false, feedback: 'כאן $m$ ו־$b$ התחלפו. כש־$x = 0$ הסוללה ב־$80\\%$, ולכן $b = 80$, והשיפוע $-5$.' },
      ] },
      { type: 'num', prompt: 'בכמה אחוזים הסוללה בשתיים בצהריים?', answer: 50, check: '80-5*6', unit: 'אחוזים',
        solution: ['משמונה עד שתיים עוברות $6$ שעות: $x = 6$.', '$y = 80 - 5 \\cdot 6 = 50$, כלומר $50\\%$.'] },
      { type: 'num', prompt: 'הישר חותך את ציר ה־$x$ כשהסוללה ריקה. אחרי כמה שעות זה קורה?', answer: 16, check: '80/5', unit: 'שעות',
        solution: ['הסוללה ריקה כש־$y = 0$: $0 = 80 - 5x$.', '$5x = 80$, ולכן $x = 16$ שעות: בחצות.'] },
      { type: 'mc', prompt: 'מה אומרת נקודת החיתוך של הישר עם ציר ה־$y$, $(0, 80)$?', choices: [
        { text: 'בשמונה בבוקר הסוללה הייתה ב־$80\\%$', ok: true, feedback: 'נכון: $x = 0$ הוא שמונה בבוקר, ו־$y = 80$ הוא אחוז הסוללה אז.' },
        { text: 'אחרי $80$ שעות הסוללה ריקה', ok: false, feedback: 'הסוללה ריקה אחרי $16$ שעות: זה החיתוך עם ציר ה־$x$. החיתוך עם ציר ה־$y$ הוא הרגע שבו $x = 0$.' },
        { text: 'הסוללה יורדת ב־$80\\%$ בכל שעה', ok: false, feedback: 'הירידה בכל שעה היא השיפוע, $-5$. ה־$80$ הוא אחוז הסוללה בשמונה, כש־$x = 0$.' },
      ] },
    ],
  },
  {
    id: 'line:c9', topic: 'line', after: 'line:7', kind: 'error', title: 'שטח שלילי?', minutes: 6, misc: 'neg-length',
    parts: [
      { type: 'error', prompt: 'כך חישב אלון את השטח של המשולש שהישר $y = 2x - 6$ יוצר עם הצירים.',
        lines: ['חיתוך עם ציר ה־$y$: $(0, -6)$. חיתוך עם ציר ה־$x$: $(3, 0)$.', 'הניצבים של המשולש: $3$ ו־$-6$.', 'השטח: $\\frac{3 \\cdot (-6)}{2} = -9$.'], wrong: 1,
        why: 'אורך הוא מרחק, ולכן הוא לא יכול להיות שלילי. הניצב שעל ציר ה־$y$ הוא מ־$0$ עד $-6$, ואורכו $6$. השטח: $\\frac{3 \\cdot 6}{2} = 9$.',
        lineWhy: { 0: 'החיתוכים נכונים: ב־$x = 0$, $y = -6$. וכש־$y = 0$, $x = 3$.', 2: 'החשבון נכון, אבל הוא משתמש באורך השלילי מהשורה הקודמת.' },
        fix: { prompt: 'מה השטח של המשולש?', answer: 9, check: '3*6/2' } },
      { type: 'mc', prompt: 'איך אפשר היה לחשוד ב־$-9$ מיד?', choices: [
        { text: 'שטח לא יכול להיות שלילי', ok: true, feedback: 'נכון: שטח של צורה הוא מספר חיובי. מינוס בשטח אומר שאורך נכתב עם סימן.' },
        { text: 'השטח צריך להיות מספר זוגי', ok: false, feedback: 'שטח יכול להיות כל מספר חיובי, גם אי־זוגי. מה שחשוד כאן הוא המינוס.' },
        { text: 'אי אפשר לחשוד בלי לשרטט', ok: false, feedback: 'אפשר: שטח הוא אף פעם לא מספר שלילי. $-9$ מראה שאחד האורכים נכתב עם סימן.' },
      ] },
      { type: 'num', prompt: 'ומה השטח של המשולש שהישר $y = -\\frac{1}{2}x + 4$ יוצר עם הצירים?', answer: 16, check: '8*4/2', unit: 'יחידות שטח',
        solution: ['חיתוך עם ציר ה־$y$: $(0, 4)$. חיתוך עם ציר ה־$x$: $0 = -\\frac{1}{2}x + 4$, ולכן $x = 8$.', 'הניצבים $8$ ו־$4$, והשטח $\\frac{8 \\cdot 4}{2} = 16$.'] },
    ],
  },
];
