// Challenge tasks of fractions (curriculum stage 1, CURRICULUM-6.5): frac:c1, a claim about adding the same number to the
// numerator and the denominator, judged with a counterexample; frac:c2, a third and a quarter added as 2/7; frac:c3, a
// recipe for four cooked for six. Checked by learn/challenges.test.ts and verify/facts-challenges17.mjs.
import type { ChallengeTask } from '../types';

export const FRAC_CHALLENGES: ChallengeTask[] = [
  {
    id: 'frac:c1', topic: 'frac', after: 'frac:1', kind: 'claim', title: 'מי צודק?', minutes: 4,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה של דני נכונה?', claim: 'דני: "אם מוסיפים אותו מספר חיובי למונה ולמכנה, השבר גדל."', verdict: 'sometimes',
        why: 'לשבר קטן מ־$1$ זה נכון: $\\frac{1}{2} \\to \\frac{2}{3}$. לשבר גדול מ־$1$ השבר קטן: $\\frac{3}{2} \\to \\frac{4}{3}$. ושבר ששווה $1$ לא משתנה.',
        example: {
          ask: 'תנו דוגמה שבה השבר לא גדל.', slots: [{ name: 'a', label: 'מונה' }, { name: 'b', label: 'מכנה' }, { name: 'k', label: 'מה מוסיפים' }],
          domain: 'positive-int', expr: '(a+k)/(b+k) - a/b', rel: '<=', value: 0, hint: 'נסו שבר שהמונה שלו גדול מהמכנה.',
        } },
      { type: 'mc', prompt: 'לאילו שברים דני צודק?', choices: [
        { text: 'לשברים חיוביים קטנים מ־$1$', ok: true, feedback: 'כן. שבר קטן מ־$1$ מתקרב ל־$1$ כשמוסיפים לשניהם, ולכן גדל.' },
        { text: 'לכל השברים', ok: false, feedback: '$\\frac{3}{2}$ הופך ל־$\\frac{4}{3}$, שקטן ממנו. אז לא לכולם.' },
        { text: 'לאף שבר', ok: false, feedback: '$\\frac{1}{2}$ הופך ל־$\\frac{2}{3}$, שגדול ממנו. אז לפעמים דני צודק.' },
      ] },
    ],
  },
  {
    id: 'frac:c2', topic: 'frac', after: 'frac:3', kind: 'error', title: 'שליש ועוד רבע', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך חיבר עומר.',
        lines: ['$\\frac{1}{3} + \\frac{1}{4}$', '$= \\frac{1 + 1}{3 + 4}$', '$= \\frac{2}{7}$'], wrong: 1,
        why: 'מחברים רק חלקים באותו גודל. קודם מכנה משותף: $\\frac{1}{3} = \\frac{4}{12}$ ו־$\\frac{1}{4} = \\frac{3}{12}$. ולכן $\\frac{1}{3} + \\frac{1}{4} = \\frac{7}{12}$.',
        fix: { prompt: '$\\frac{1}{3} + \\frac{1}{4} = \\frac{?}{12}$. מה המונה?', answer: 7, check: '(1/3+1/4)*12' } },
      { type: 'mc', prompt: 'איך אפשר לראות ש־$\\frac{2}{7}$ לא יכול להיות התשובה?', choices: [
        { text: '$\\frac{2}{7}$ קטן מ־$\\frac{1}{3}$, אבל לשליש הוסיפו עוד רבע', ok: true, feedback: 'נכון: הסכום צריך להיות גדול מכל אחד מהחלקים. $\\frac{2}{7}$ קטן אפילו מ־$\\frac{1}{3}$.' },
        { text: '$\\frac{2}{7}$ גדול מ־$1$', ok: false, feedback: '$\\frac{2}{7}$ קטן מ־$1$: המונה קטן מהמכנה. הבעיה היא שהוא קטן מ־$\\frac{1}{3}$, שאליו הוסיפו עוד.' },
        { text: 'אי אפשר לראות בלי מכנה משותף', ok: false, feedback: 'אפשר: $\\frac{2}{7}$ קטן מ־$\\frac{1}{3}$, והסכום של שליש ועוד משהו לא יכול להיות קטן משליש.' },
      ] },
    ],
  },
  {
    id: 'frac:c3', topic: 'frac', after: 'frac:4', kind: 'literacy', title: 'עוגיות לשישה', minutes: 8,
    story: 'במתכון לעוגיות לארבעה אנשים יש $\\frac{3}{4}$ כוס סוכר. נועה מכינה את אותן עוגיות לשישה אנשים.',
    parts: [
      { type: 'mc', prompt: 'פי כמה צריך להגדיל את המתכון?', choices: [
        { text: '$1\\frac{1}{2}$, כי $\\frac{6}{4} = 1\\frac{1}{2}$', ok: true, feedback: 'נכון: שישה אנשים הם פי $\\frac{6}{4}$ מארבעה, כלומר פי $1\\frac{1}{2}$.' },
        { text: '$2$', ok: false, feedback: 'פי $2$ זה לשמונה אנשים. לשישה: $6 : 4 = 1\\frac{1}{2}$.' },
        { text: '$\\frac{2}{3}$', ok: false, feedback: 'פי $\\frac{2}{3}$ מקטין את המתכון. לשישה צריך יותר: $\\frac{6}{4} = 1\\frac{1}{2}$.' },
      ] },
      { type: 'num', prompt: 'כמה כוסות סוכר צריך? אפשר לכתוב מספר עשרוני או שבר.', answer: 1.125, check: '3/4*6/4', unit: 'כוסות',
        solution: ['$\\frac{3}{4} \\cdot 1\\frac{1}{2} = \\frac{3}{4} \\cdot \\frac{3}{2} = \\frac{9}{8}$.', '$\\frac{9}{8} = 1\\frac{1}{8}$, כלומר $1.125$ כוסות.'] },
      { type: 'num', prompt: 'לנועה יש כוס מדידה של $\\frac{1}{4}$ כוס. כמה פעמים היא ממלאת אותה?', answer: 4.5, check: '(9/8)/(1/4)',
        solution: ['$\\frac{9}{8} : \\frac{1}{4} = \\frac{9}{8} \\cdot 4 = \\frac{9}{2}$.', '$\\frac{9}{2} = 4\\frac{1}{2}$: ארבע כוסות מלאות, ועוד חצי כוס.'] },
      { type: 'explain', prompt: 'יש שני אנשים יותר. למה לא מוסיפים פשוט חצי כוס סוכר?',
        rubric: ['אמרתי שכל אדם מקבל אותו חלק מהסוכר', 'חישבתי כמה סוכר יש לאדם אחד, או כמה זה פי $1\\frac{1}{2}$'],
        sample: 'לכל אדם יש $\\frac{3}{4} : 4 = \\frac{3}{16}$ כוס. לשני אנשים נוספים צריך $\\frac{6}{16} = \\frac{3}{8}$ כוס, ולא חצי כוס. ולכן $\\frac{3}{4} + \\frac{3}{8} = \\frac{9}{8}$.' },
    ],
  },
];
