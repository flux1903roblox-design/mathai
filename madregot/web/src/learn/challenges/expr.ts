// Challenge tasks of algebraic expressions (curriculum stage 1, CURRICULUM-6.5), as the spec writes them: expr:c1, the
// claim 2(x + 3) = 2x + 3; expr:c2, someone's 5(2x − 3) opened with only the first term multiplied ('partial-dist');
// expr:c3, a row of matchstick squares and 3n + 1. Every number is in the lane skeptic's check.mjs and in
// verify/facts-challenges17.mjs; learn/challenges.test.ts checks them again.
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
];
