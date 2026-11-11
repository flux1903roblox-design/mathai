// Challenge tasks of algebraic expressions (curriculum stage 1, CURRICULUM-6.5), as the spec writes them: expr:c1, the
// claim 2(x + 3) = 2x + 3; expr:c2, someone's 5(2x − 3) opened with only the first term multiplied ('partial-dist');
// expr:c3, a row of matchstick squares and 3n + 1. Every number is in the lane skeptic's check.mjs and in
// verify/facts-challenges17.mjs; learn/challenges.test.ts checks them again.
// PRODUCT2-21 (a task after every stair): expr:c5, after expr:1, a claim about 2x and x, judged with a counterexample,
// then a negative number substituted; expr:c6, after expr:5, the proof that three consecutive whole numbers add up to a
// multiple of 3, and a claim about four. The classroom lane's expr:c4 (after expr:3) comes before them.
import type { ChallengeTask } from '../types';

export const EXPR_CHALLENGES: ChallengeTask[] = [
  {
    id: 'expr:c1', topic: 'expr', after: 'expr:4', kind: 'claim', title: 'סוגריים שנפתחו', minutes: 4, misc: 'partial-dist',
    parts: [
      { type: 'claim', prompt: 'מתי השוויון נכון?', claim: '"$2(x + 3) = 2x + 3$"', verdict: 'never',
        why: '$2(x + 3) = 2x + 6$, ולכן שני הצדדים נבדלים ב־$3$ בכל $x$. למשל ב־$x = 0$: $6 \\ne 3$.',
        example: {
          ask: 'תנו ערך של $x$ שבו השוויון לא מתקיים.', slots: [{ name: 'x', label: '$x$' }],
          domain: 'number', expr: '2*(x+3) - (2*x+3)', rel: '!=', value: 0, hint: 'נסו $x = 0$.',
        } },
      { type: 'mc', prompt: 'מה נכון?', choices: [
        { text: '$2(x + 3) = 2x + 6$', ok: true, feedback: 'נכון: ה־$2$ כופל את כל מה שבסוגריים, גם את $x$ וגם את $3$.' },
        { text: '$2(x + 3) = 2x + 5$', ok: false, feedback: 'את $3$ לא מחברים עם $2$, אלא כופלים בו: $2 \\cdot 3 = 6$.' },
        { text: '$2(x + 3) = 5x$', ok: false, feedback: '$x$ ו־$3$ אינם איברים דומים, ולא מחברים אותם לאיבר אחד. $2(x + 3) = 2x + 6$.' },
      ] },
    ],
  },
  {
    id: 'expr:c2', topic: 'expr', after: 'expr:4', kind: 'error', title: 'הטעות בפתיחת הסוגריים', minutes: 4, misc: 'partial-dist',
    parts: [
      { type: 'error', prompt: 'כך פתחה תמר סוגריים.',
        lines: ['פתחו סוגריים: $5(2x - 3)$', '$= 5 \\cdot 2x - 3$', '$= 10x - 3$'], wrong: 1,
        why: 'גם $-3$ שבתוך הסוגריים מוכפל ב־$5$: $5(2x - 3) = 10x - 15$.',
        lineWhy: { 0: 'זו רק השאלה. הטעות מתחילה אחריה.', 2: '$5 \\cdot 2x = 10x$ נכון. השורה ממשיכה את מה שלפניה, והטעות שם.' },
        fix: { prompt: 'מה הערך של $5(2x - 3)$ כש־$x = 2$?', answer: 5, check: '5*(2*2-3)' } },
      { type: 'mc', prompt: 'איך אפשר לבדוק פתיחת סוגריים לבד?', choices: [
        { text: 'מציבים מספר בשני הביטויים ומשווים: ב־$x = 2$ יוצא $5$ מול $17$', ok: true, feedback: 'נכון: $5(2 \\cdot 2 - 3) = 5$, ו־$10 \\cdot 2 - 3 = 17$. ביטויים שווים נותנים אותו ערך בכל $x$, אז מספר אחד כבר מגלה את הטעות.' },
        { text: 'סופרים כמה איברים יש', ok: false, feedback: 'ב־$10x - 3$ וב־$10x - 15$ יש אותו מספר איברים, ורק אחד מהם נכון. הצבה של מספר מגלה את ההבדל.' },
        { text: 'אי אפשר בלי מורה', ok: false, feedback: 'אפשר: מציבים מספר, למשל $x = 2$, בביטוי המקורי ובביטוי שקיבלתם. אם יוצא ערך שונה, יש טעות.' },
      ] },
    ],
  },
  {
    id: 'expr:c3', topic: 'expr', after: 'expr:2', kind: 'literacy', title: 'שורת ריבועים מגפרורים', minutes: 7, misc: 'whole-object',
    story: 'בונים שורת ריבועים מגפרורים, כל ריבוע צמוד לקודם. ריבוע אחד הוא $4$ גפרורים, שני ריבועים $7$, שלושה ריבועים $10$.',
    parts: [
      { type: 'num', prompt: 'כמה גפרורים צריך ל־$10$ ריבועים?', answer: 31, check: '3*10+1', unit: 'גפרורים',
        solution: ['כל ריבוע נוסף מוסיף $3$ גפרורים: $4, 7, 10, \\ldots$', 'ל־$10$ ריבועים: $4 + 3 \\cdot 9 = 31$ גפרורים.'] },
      { type: 'mc', prompt: 'איזה ביטוי נותן את מספר הגפרורים ל־$n$ ריבועים?', choices: [
        { text: '$3n + 1$', ok: true, feedback: 'נכון: $3$ גפרורים לכל ריבוע, ועוד גפרור אחד בקצה. ב־$n = 1$: $4$, וב־$n = 2$: $7$.' },
        { text: '$4n$', ok: false, feedback: 'ב־$n = 2$ זה $8$, אבל לשני ריבועים צריך רק $7$. הצלע המשותפת נספרה פעמיים.' },
        { text: '$n + 3$', ok: false, feedback: 'ב־$n = 2$ זה $5$, אבל צריך $7$. כל ריבוע מוסיף $3$ גפרורים, לא $1$.' },
      ] },
      { type: 'num', prompt: 'כמה ריבועים בונים מ־$100$ גפרורים בדיוק?', answer: 33, check: '(100-1)/3', unit: 'ריבועים',
        solution: ['מחפשים $n$ שבו $3n + 1 = 100$.', '$3n = 99$, ולכן $n = 33$ ריבועים.'] },
      { type: 'explain', prompt: 'הסבירו למה כל ריבוע חדש מוסיף $3$ גפרורים.',
        rubric: ['אמרתי שהצלע המשותפת כבר קיימת', 'קישרתי את ה־$3$ למספר שכופל את $n$'],
        sample: 'כל ריבוע חדש נצמד לקודם, והצלע ביניהם כבר שם. לכן צריך רק $3$ גפרורים חדשים, וזה ה־$3$ ב־$3n + 1$. ה־$1$ הוא הצלע הראשונה בקצה.' },
    ],
  },
  {
    id: 'expr:c5', topic: 'expr', after: 'expr:1', kind: 'claim', title: 'פי שניים זה יותר?', minutes: 5,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"$2x$ גדול מ־$x$."', verdict: 'sometimes',
        why: 'כש־$x = 5$: $2x = 10$, וזה יותר מ־$5$. אבל כש־$x = -5$: $2x = -10$, וזה פחות מ־$-5$. וכש־$x = 0$, שניהם $0$.',
        example: {
          ask: 'תנו ערך של $x$ שבו $2x$ לא גדול מ־$x$.', slots: [{ name: 'x', label: '$x$' }],
          domain: 'number', expr: '2*x - x', rel: '<=', value: 0, hint: 'נסו מספר שלילי, או $0$.',
        } },
      { type: 'mc', prompt: 'מתי $2x$ גדול מ־$x$?', choices: [
        { text: 'כש־$x$ חיובי', ok: true, feedback: 'נכון: $2x$ הוא $x$ ועוד $x$. כש־$x$ חיובי מוסיפים מספר חיובי, והתוצאה גדלה.' },
        { text: 'בכל ערך של $x$', ok: false, feedback: 'כש־$x = -5$: $2x = -10$, וזה פחות מ־$-5$. הוספה של מספר שלילי מקטינה.' },
        { text: 'כש־$x$ מספר שלם', ok: false, feedback: 'גם $-3$ הוא מספר שלם, ו־$2 \\cdot (-3) = -6$ קטן מ־$-3$. מה שקובע הוא הסימן של $x$.' },
      ] },
      { type: 'num', prompt: 'מה הערך של $5 - 2x$ כש־$x = -4$?', answer: 13, check: '5-2*(-4)',
        solution: ['$2x = 2 \\cdot (-4) = -8$.', '$5 - (-8) = 5 + 8$, כלומר $13$.'] },
    ],
  },
  {
    id: 'expr:c6', topic: 'expr', after: 'expr:5', kind: 'proof', title: 'שלושה מספרים עוקבים', minutes: 7,
    parts: [
      { type: 'order', prompt: 'למה הסכום של שלושה מספרים שלמים עוקבים מתחלק ב־$3$? סדרו את שלבי ההוכחה, מהראשון לאחרון.',
        steps: [
          { text: 'נקרא למספר הראשון $n$. שני המספרים שאחריו הם $n + 1$ ו־$n + 2$.' },
          { text: 'הסכום הוא $n + (n + 1) + (n + 2)$.' },
          { text: 'מכנסים איברים דומים: $3n + 3$.',
            reason: { choices: ['$n + n + n = 3n$, ו־$1 + 2 = 3$', 'חוק הפילוג: $3 \\cdot n + 3 \\cdot 1$', 'מציבים $n = 1$'], answer: 0 } },
          { text: '$3n + 3 = 3(n + 1)$: שלוש פעמים המספר האמצעי.',
            reason: { choices: ['הוצאת גורם משותף: חוק הפילוג בכיוון ההפוך', 'כינוס איברים דומים', 'מחלקים ב־$3$ רק את $3n$'], answer: 0 } },
          { text: 'לכן הסכום מתחלק ב־$3$.' },
        ] },
      { type: 'num', prompt: 'הסכום של שלושה מספרים עוקבים הוא $219$. מה המספר האמצעי?', answer: 73, check: '219/3',
        solution: ['הסכום הוא שלוש פעמים המספר האמצעי.', '$219 : 3 = 73$. בדיקה: $72 + 73 + 74 = 219$.'] },
      { type: 'claim', prompt: 'ומתי הטענה הזאת נכונה?', claim: '"הסכום של ארבעה מספרים שלמים עוקבים מתחלק ב־$4$."', verdict: 'never',
        why: 'ארבעה מספרים עוקבים הם $n$, $n + 1$, $n + 2$ ו־$n + 3$, והסכום שלהם $4n + 6$. החלק $4n$ מתחלק ב־$4$, אבל $6$ לא: נשארת שארית $2$. למשל $1 + 2 + 3 + 4 = 10$.' },
    ],
  },
];
