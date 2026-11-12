// Challenge tasks of equations (curriculum stage 1, CURRICULUM-6.5), as the spec writes them: eq:c1, a claim about how
// many solutions ax + b = cx + d has; eq:c2, a number moved across without the inverse operation ('move-no-flip');
// eq:c3, two gym plans and the number of visits where they cost the same. Every number is in the lane skeptic's
// check.mjs and in verify/facts-challenges17.mjs; learn/challenges.test.ts checks them again.
// eq:c4 (stage5.md FUNC-7.4), after the motion problems of eq:6: a race of three legs, each leg's minutes and the whole
// race's, and why the mean of the three speeds is not the average speed (the stage-5 critique's check.mjs and the lane's
// spec/facts.mjs hold its numbers).
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
];
