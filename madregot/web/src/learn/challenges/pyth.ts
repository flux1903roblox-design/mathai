// Challenge tasks of Pythagoras (curriculum stage 1, CURRICULUM-6.5): pyth:c1, will a pole fit in a box, lying flat or
// slanted from corner to corner. Its numbers are checked by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const PYTH_CHALLENGES: ChallengeTask[] = [
  {
    id: 'pyth:c1', topic: 'pyth', after: 'pyth:2', kind: 'literacy', title: 'המוט והארגז', minutes: 8,
    story: 'תחתית של ארגז היא מלבן $2$ מטר על $1.5$ מטר, וגובה הארגז $1$ מטר. רוצים להכניס מוט באורך $2.6$ מטר.',
    parts: [
      { type: 'num', prompt: 'מה אורך האלכסון של התחתית?', answer: 2.5, check: 'sqrt(2^2+1.5^2)', unit: 'מטר',
        solution: ['האלכסון הוא יתר במשולש ישר־זווית שניצביו $2$ ו־$1.5$.', '$2^2 + 1.5^2 = 4 + 2.25 = 6.25$, ו־$\\sqrt{6.25} = 2.5$ מטר.'] },
      { type: 'mc', prompt: 'המוט נכנס כשהוא שוכב על התחתית?', choices: [
        { text: 'לא, $2.6 > 2.5$', ok: true, feedback: 'נכון: האלכסון הוא הקו הארוך ביותר על התחתית, והמוט ארוך ממנו.' },
        { text: 'כן', ok: false, feedback: 'הקו הארוך ביותר על התחתית הוא האלכסון, $2.5$ מטר, והמוט $2.6$ מטר.' },
        { text: 'אי אפשר לדעת', ok: false, feedback: 'אפשר: משווים את המוט לאלכסון, הקו הארוך ביותר על התחתית.' },
      ] },
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"אם מגדילים כל צלע של מלבן פי $2$, גם האלכסון גדל פי $2$."', verdict: 'always',
        why: '$2$ על $1.5$: אלכסון $2.5$. $4$ על $3$: אלכסון $5$. כל המשולש גדל פי $2$.' },
      { type: 'explain', prompt: 'הציעו דרך שבה המוט כן ייכנס, ובדקו בחשבון.',
        rubric: ['חשבתי על המוט באלכסון של הארגז, מפינה תחתונה לפינה עליונה', 'בדקתי במשפט פיתגורס פעמיים'],
        sample: 'מטים את המוט מפינה תחתונה לפינה העליונה שמולה. האלכסון הזה הוא $\\sqrt{2.5^2 + 1^2} \\approx 2.69$ מטר, יותר מ־$2.6$, ולכן המוט נכנס.' },
    ],
  },
];
