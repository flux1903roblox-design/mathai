// Challenge tasks of fractions (curriculum stage 1, CURRICULUM-6.5): frac:c1, a claim about adding the same number to the
// numerator and the denominator, judged with a counterexample. Checked by learn/challenges.test.ts.
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
];
