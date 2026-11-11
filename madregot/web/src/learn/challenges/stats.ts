// Challenge tasks of statistics (curriculum stage 1, CURRICULUM-6.5): stats:c1, a company's salaries, the mean against
// the median, and a claim about the mean judged with a counterexample. Checked by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const STATS_CHALLENGES: ChallengeTask[] = [
  {
    id: 'stats:c1', topic: 'stats', after: 'stats:3', kind: 'literacy', title: 'השכר בחברה הקטנה', minutes: 6,
    story: 'בחברה $6$ עובדים מרוויחים $8{,}000$ ש״ח בחודש, והמנהלת $50{,}000$ ש״ח.',
    parts: [
      { type: 'num', prompt: 'מה השכר הממוצע?', answer: 14000, check: '(6*8000+50000)/7', unit: 'ש״ח',
        solution: ['כל השכר יחד: $6 \\cdot 8{,}000 + 50{,}000 = 98{,}000$ ש״ח.', 'בחברה $7$ אנשים: $98{,}000 : 7 = 14{,}000$ ש״ח.'] },
      { type: 'num', prompt: 'מה החציון?', answer: 8000, check: '8000', unit: 'ש״ח',
        solution: ['בסדר עולה: שישה שכרים של $8{,}000$, ואחריהם $50{,}000$.', 'האמצעי מבין $7$ הוא הרביעי: $8{,}000$ ש״ח.'] },
      { type: 'mc', prompt: 'מודעת דרושים כתבה: "אצלנו מרוויחים בממוצע $14{,}000$ ש״ח". מה מטעה?', choices: [
        { text: 'רוב העובדים מרוויחים הרבה פחות מהממוצע', ok: true, feedback: 'נכון: שכר אחד גבוה מושך את הממוצע למעלה, ושישה מתוך שבעה מרוויחים $8{,}000$.' },
        { text: 'הממוצע חושב לא נכון', ok: false, feedback: 'הממוצע נכון: $98{,}000 : 7 = 14{,}000$. המטעה הוא מה שהוא לא מספר.' },
        { text: 'שום דבר', ok: false, feedback: 'מי שקורא את המודעה יחשוב שירוויח בערך $14{,}000$, אבל רוב העובדים מרוויחים $8{,}000$.' },
      ] },
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"הממוצע הוא אחד מהנתונים."', verdict: 'sometimes',
        why: 'של $2, 4, 6$ הממוצע $4$, נתון. של $1, 2$ הממוצע $1.5$, לא נתון.',
        // the mean of two different numbers lies strictly between them, so it is neither
        example: {
          ask: 'תנו שני מספרים שהממוצע שלהם אינו אחד מהם.', slots: [{ name: 'x', label: 'מספר ראשון' }, { name: 'y', label: 'מספר שני' }],
          domain: 'number', expr: 'x - y', rel: '!=', value: 0, hint: 'נסו שני מספרים שונים.',
        } },
    ],
  },
];
