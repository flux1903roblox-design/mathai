// Challenge tasks of percent (curriculum stage 1, CURRICULUM-6.5): pct:c1, a real-world choice between a percent fee and
// a fixed one. Its numbers are checked by the lane's verify/facts-challenges.mjs and by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const PCT_CHALLENGES: ChallengeTask[] = [
  {
    id: 'pct:c1', topic: 'pct', after: 'pct:2', kind: 'literacy', title: 'שתי דרכים לשלם עמלה', minutes: 6,
    story: 'באתר כרטיסים בוחרים איך לשלם עמלה. מסלול א: $3\\%$ מסכום הקנייה. מסלול ב: $12$ ש״ח קבוע, בכל קנייה.',
    parts: [
      { type: 'num', prompt: 'כמה עמלה במסלול א על קנייה של $250$ ש״ח?', answer: 7.5, check: '0.03*250', unit: 'ש״ח',
        solution: ['$3\\% = 0.03$', '$0.03 \\cdot 250 = 7.5$ ש״ח'] },
      { type: 'num', prompt: 'באיזה סכום קנייה העמלה בשני המסלולים שווה?', answer: 400, check: '12/0.03', unit: 'ש״ח',
        solution: ['העמלות שוות כש־$3\\%$ מהסכום הם $12$ ש״ח.', '$1\\%$ הוא $12 : 3 = 4$, ולכן הסכום כולו $4 \\cdot 100 = 400$ ש״ח.'] },
      { type: 'mc', prompt: 'על קנייה של $600$ ש״ח, איזה מסלול זול יותר?', choices: [
        { text: 'מסלול ב: $12$ ש״ח מול $18$', ok: true, feedback: '$3\\%$ מ־$600$ הם $18$ ש״ח, ובמסלול ב משלמים רק $12$.' },
        { text: 'מסלול א', ok: false, feedback: 'במסלול א משלמים $3\\%$ מ־$600$, כלומר $18$ ש״ח. זה יותר מ־$12$.' },
        { text: 'שווה', ok: false, feedback: 'העמלות שוות רק בקנייה של $400$ ש״ח. ב־$600$ ש״ח הן כבר שונות.' },
      ] },
      { type: 'explain', prompt: 'למי כדאי מסלול א, ולמי מסלול ב?',
        rubric: ['אמרתי מתי כל מסלול זול יותר', 'השתמשתי בסכום שבו הם שווים', 'נתתי דוגמה עם מספרים'],
        sample: 'מי שקונה בפחות מ־$400$ ש״ח משלם פחות במסלול א, כי $3\\%$ מסכום קטן הם פחות מ־$12$. מעל $400$ ש״ח מסלול ב זול יותר: ב־$600$ ש״ח, $12$ מול $18$.' },
    ],
  },
];
