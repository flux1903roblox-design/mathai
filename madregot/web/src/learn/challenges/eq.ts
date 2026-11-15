// Challenge tasks of equations (curriculum stage 1, CURRICULUM-6.5), as the spec writes them: eq:c1, a claim about how
// many solutions ax + b = cx + d has; eq:c2, a number moved across without the inverse operation ('move-no-flip');
// eq:c3, two gym plans and the number of visits where they cost the same. Every number is in the lane skeptic's
// check.mjs and in verify/facts-challenges17.mjs; learn/challenges.test.ts checks them again.
// eq:c4 (stage5.md FUNC-7.4), after the motion problems of eq:6: a race of three legs, each leg's minutes and the whole
// race's, and why the mean of the three speeds is not the average speed (the stage-5 critique's check.mjs and the lane's
// spec/facts.mjs hold its numbers).
// PRODUCT2-21 (a task after every stair): eq:c5, after eq:1, a "think of a number" game, one-step equations and the
// one that has every number as a solution; eq:c6, after eq:4, a solution with brackets put in order with a reason for
// each line, then a minus before brackets and an equation to solve. (The product2 lane wrote them as eq:c4 and eq:c5;
// they took the next free ids after stage 5's eq:c4 when the lanes met.)
import type { ChallengeTask } from '../types';

export const EQ_CHALLENGES: ChallengeTask[] = [
  {
    id: 'eq:c1', topic: 'eq', after: 'eq:3', kind: 'claim', title: 'כמה פתרונות?', minutes: 4,
    parts: [
      // no counterexample slots: a counterexample here is a whole equation
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"למשוואה מהצורה $ax + b = cx + d$ יש פתרון אחד בדיוק."', verdict: 'sometimes',
        why: 'ל־$2x + 3 = 7$ יש פתרון אחד, $x = 2$. אבל ב־$2x + 3 = 2x + 5$ נשאר $3 = 5$: אין פתרון. וב־$2(x + 1) = 2x + 2$ כל מספר הוא פתרון.' },
      { type: 'mc', prompt: 'כמה פתרונות יש למשוואה $3x + 1 = 3x + 1$?', choices: [
        { text: 'כל מספר הוא פתרון', ok: true, feedback: 'נכון: שני האגפים זהים, ולכן כל $x$ שמציבים נותן שוויון. למשל ב־$x = 5$: $16 = 16$.' },
        { text: 'פתרון אחד, $x = 0$', ok: false, feedback: '$x = 0$ הוא פתרון, אבל לא היחיד: גם ב־$x = 5$ יוצא $16 = 16$. האגפים זהים, וכל מספר פותר.' },
        { text: 'אין פתרון', ok: false, feedback: 'מציבים $x = 5$: $16 = 16$. יש פתרון, ולמעשה כל מספר הוא פתרון, כי האגפים זהים.' },
      ] },
    ],
  },
  {
    id: 'eq:c2', topic: 'eq', after: 'eq:2', kind: 'error', title: 'המספר שעבר אגף', minutes: 4, misc: 'move-no-flip',
    parts: [
      { type: 'error', prompt: 'כך פתר אלון.',
        lines: ['$3x + 5 = 20$', '$3x = 25$', '$x = \\frac{25}{3}$'], wrong: 1,
        why: 'מעבירים את $5$ בפעולה ההפוכה: מחסרים $5$ משני האגפים, ו־$3x = 15$.',
        lineWhy: { 0: 'זו המשוואה עצמה. הטעות מתחילה אחריה.', 2: 'מ־$3x = 25$ באמת יוצא $x = \\frac{25}{3}$. הטעות בשורה שלפניה.' },
        fix: { prompt: 'מה $x$?', answer: 5, check: '(20-5)/3' } },
      { type: 'mc', prompt: 'איך בודקים פתרון של משוואה?', choices: [
        { text: 'מציבים אותו: $3 \\cdot 5 + 5 = 20$', ok: true, feedback: 'נכון: מציבים במשוואה המקורית, ואם שני האגפים שווים, הפתרון נכון. אצל אלון: $3 \\cdot \\frac{25}{3} + 5 = 30$, לא $20$.' },
        { text: 'פותרים שוב באותה דרך', ok: false, feedback: 'באותה דרך אפשר לחזור על אותה טעות. הצבה במשוואה המקורית בודקת באמת.' },
        { text: 'בודקים שהתשובה מספר שלם', ok: false, feedback: 'יש משוואות שהפתרון שלהן שבר. בודקים בהצבה: $3 \\cdot 5 + 5 = 20$.' },
      ] },
    ],
  },
  {
    id: 'eq:c3', topic: 'eq', after: 'eq:5', kind: 'literacy', title: 'שני מסלולים בחדר הכושר', minutes: 8,
    story: 'חדר כושר מציע שני מסלולים. מסלול א: $120$ ש״ח דמי הרשמה ועוד $15$ ש״ח לכל כניסה. מסלול ב: $25$ ש״ח לכל כניסה, בלי דמי הרשמה.',
    parts: [
      { type: 'num', prompt: 'כמה עולות $10$ כניסות במסלול א?', answer: 270, check: '120+15*10', unit: 'ש״ח',
        solution: ['דמי הרשמה ועוד $10$ כניסות: $120 + 15 \\cdot 10$.', '$120 + 150 = 270$ ש״ח.'] },
      { type: 'num', prompt: 'אחרי כמה כניסות המחיר בשני המסלולים שווה?', answer: 12, check: '120/(25-15)', unit: 'כניסות',
        solution: ['משווים: $120 + 15x = 25x$.', 'מחסרים $15x$: $120 = 10x$, ולכן $x = 12$ כניסות.'] },
      { type: 'mc', prompt: 'נועה מתכננת $8$ כניסות. איזה מסלול זול לה יותר?', choices: [
        { text: 'מסלול ב: $200$ ש״ח מול $240$', ok: true, feedback: 'נכון: במסלול ב $25 \\cdot 8 = 200$, ובמסלול א $120 + 15 \\cdot 8 = 240$. עד $12$ כניסות מסלול ב זול יותר.' },
        { text: 'מסלול א', ok: false, feedback: 'במסלול א: $120 + 15 \\cdot 8 = 240$ ש״ח, ובמסלול ב רק $200$. מסלול א משתלם רק מעל $12$ כניסות.' },
        { text: 'שווה', ok: false, feedback: 'המחירים שווים רק ב־$12$ כניסות. ב־$8$ כניסות: $240$ מול $200$.' },
      ] },
      { type: 'explain', prompt: 'כתבו משוואה שאומרת מתי המסלולים שווים, והסבירו כל חלק בה.',
        rubric: ['כתבתי משוואה כמו $120 + 15x = 25x$', 'אמרתי מה $x$ מייצג', 'הסברתי מה כל אגף'],
        sample: '$x$ הוא מספר הכניסות. אגף שמאל הוא המחיר במסלול א: $120$ ועוד $15$ לכל כניסה. אגף ימין הוא מסלול ב: $25$ לכל כניסה. הם שווים כש־$120 + 15x = 25x$, כלומר $x = 12$.' },
    ],
  },
  {
    id: 'eq:c4', topic: 'eq', after: 'eq:6', kind: 'literacy', title: 'שלושה מקצים', minutes: 8,
    story: 'בתחרות שוחים $0.75$ ק״מ ב־$3$ קמ״ש, רוכבים $20$ ק״מ ב־$30$ קמ״ש, ורצים $5$ ק״מ ב־$10$ קמ״ש.',
    parts: [
      { type: 'num', prompt: 'כמה דקות שחו?', answer: 15, check: '0.75/3*60', unit: 'דקות',
        solution: ['זמן = דרך : מהירות: $0.75 : 3 = 0.25$ שעה.', 'רבע שעה היא $15$ דקות.'] },
      { type: 'num', prompt: 'כמה דקות רכבו?', answer: 40, check: '20/30*60', unit: 'דקות',
        solution: ['$20 : 30 = \\frac{2}{3}$ שעה.', 'שני שלישים של $60$ דקות הם $40$ דקות.'] },
      { type: 'num', prompt: 'כמה דקות נמשכה כל התחרות?', answer: 85, check: '15+40+30', unit: 'דקות',
        solution: ['הריצה: $5 : 10 = \\frac{1}{2}$ שעה, כלומר $30$ דקות.', 'כל התחרות: $15 + 40 + 30 = 85$ דקות.'] },
      { type: 'mc', prompt: 'האם הממוצע של $3$, $30$ ו־$10$ הוא המהירות הממוצעת?', choices: [
        { text: 'לא: בכל קטע הזמן שונה, והמהירות הממוצעת היא כל הדרך חלקי כל הזמן', ok: true, feedback: '$25.75$ ק״מ ב־$85$ דקות הם בערך $18.18$ קמ״ש, לא $14.33$.' },
        { text: 'כן', ok: false, feedback: 'הממוצע $14.33$ נותן לכל מהירות אותו משקל, אבל רכבו $40$ דקות ושחו רק $15$. כל הדרך, $25.75$ ק״מ, ב־$85$ דקות: בערך $18.18$ קמ״ש.' },
      ] },
    ],
  },
  {
    id: 'eq:c5', topic: 'eq', after: 'eq:1', kind: 'literacy', title: 'חשבו על מספר', minutes: 6,
    story: 'במשחק "חשבו על מספר" כל אחד חושב על מספר, עושה עליו פעולה אחת ואומר מה יצא. האחרים צריכים לגלות על איזה מספר הוא חשב.',
    parts: [
      { type: 'num', prompt: 'יעל כפלה את המספר שלה ב־$-3$, ויצא $27$. על איזה מספר היא חשבה?', answer: -9, check: '27/(-3)',
        solution: ['המשוואה: $-3x = 27$.', 'מחלקים את שני האגפים ב־$-3$: $x = -9$. בדיקה: $-3 \\cdot (-9) = 27$.'] },
      { type: 'num', prompt: 'עומרי חיסר מהמספר שלו $8$, ויצא $-5$. על איזה מספר הוא חשב?', answer: 3, check: '-5+8',
        solution: ['המשוואה: $x - 8 = -5$.', 'מוסיפים $8$ לשני האגפים: $x = 3$. בדיקה: $3 - 8 = -5$.'] },
      { type: 'num', prompt: 'נור חילקה את המספר שלה ב־$4$, ויצא $-2.5$. על איזה מספר היא חשבה?', answer: -10, check: '-2.5*4',
        solution: ['המשוואה: $\\frac{x}{4} = -2.5$.', 'כופלים את שני האגפים ב־$4$: $x = -10$. בדיקה: $-10 : 4 = -2.5$.'] },
      { type: 'mc', prompt: 'רון כפל את המספר שלו ב־$0$, ויצא $0$. על איזה מספר הוא חשב?', choices: [
        { text: 'אי אפשר לדעת', ok: true, feedback: 'נכון: כל מספר כפול $0$ הוא $0$. למשוואה $0 \\cdot x = 0$ כל מספר הוא פתרון.' },
        { text: '$0$', ok: false, feedback: '$0$ מתאים, אבל גם $5$ מתאים: $0 \\cdot 5 = 0$. כל מספר מתאים, ולכן אי אפשר לדעת.' },
        { text: '$1$', ok: false, feedback: '$0 \\cdot 1 = 0$, אבל גם $0 \\cdot 7 = 0$. כל מספר כפול $0$ הוא $0$, ולכן אי אפשר לדעת.' },
      ] },
    ],
  },
  {
    id: 'eq:c6', topic: 'eq', after: 'eq:4', kind: 'proof', title: 'פתרון עם נימוקים', minutes: 7,
    parts: [
      { type: 'order', prompt: 'אלה שורות הפתרון של $3(x - 2) = 2x + 5$, בסדר מעורבב. סדרו אותן מהראשונה לאחרונה.',
        steps: [
          { text: '$3(x - 2) = 2x + 5$' },
          { text: '$3x - 6 = 2x + 5$',
            reason: { choices: ['חוק הפילוג: $3$ כופל גם את $x$ וגם את $-2$', 'כינוס איברים דומים', 'מחלקים את שני האגפים ב־$3$'], answer: 0 } },
          { text: '$x - 6 = 5$',
            reason: { choices: ['מחסרים $2x$ משני האגפים', 'מחלקים את שני האגפים ב־$2$', 'מעבירים את $2x$ לאגף שמאל בלי לשנות סימן'], answer: 0 } },
          { text: '$x = 11$',
            reason: { choices: ['מוסיפים $6$ לשני האגפים', 'מחסרים $6$ משני האגפים', 'כופלים את שני האגפים ב־$6$'], answer: 0 } },
          { text: 'בדיקה: $3(11 - 2) = 27$, וגם $2 \\cdot 11 + 5 = 27$.' },
        ] },
      { type: 'mc', prompt: 'איך נראה $5 - 2(x - 4)$ אחרי פתיחת הסוגריים?', choices: [
        { text: '$13 - 2x$', ok: true, feedback: 'נכון: $-2$ כופל גם את $x$ וגם את $-4$. יוצא $5 - 2x + 8$, כלומר $13 - 2x$.' },
        { text: '$-3 - 2x$', ok: false, feedback: 'כאן $-2 \\cdot (-4)$ נכתב $-8$. אבל מינוס כפול מינוס הוא פלוס: $+8$. יוצא $5 - 2x + 8$, כלומר $13 - 2x$.' },
        { text: '$3x - 12$', ok: false, feedback: 'כאן חיסרו קודם $5 - 2 = 3$. אבל כפל בא לפני חיסור: פותחים את הסוגריים, ויוצא $5 - 2x + 8$, כלומר $13 - 2x$.' },
      ] },
      { type: 'num', prompt: 'פתרו: $4(x + 3) = 2x - 6$. מה $x$?', answer: -9, check: '(-6-12)/(4-2)',
        solution: ['פותחים סוגריים: $4x + 12 = 2x - 6$. מחסרים $2x$ משני האגפים: $2x + 12 = -6$.', 'מחסרים $12$: $2x = -18$, ולכן $x = -9$. בדיקה: $4(-9 + 3) = -24$, וגם $2 \\cdot (-9) - 6 = -24$.'] },
    ],
  },
];
