// Challenge tasks of signed numbers (curriculum stage 1, CURRICULUM-6.5): signed:c1, a claim about adding two negative
// numbers; signed:c2, someone's "two minuses make a plus" where it does not hold; signed:c3, a cold week on the Hermon.
// Their numbers are checked by the lane's verify/facts-challenges17.mjs and by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const SIGNED_CHALLENGES: ChallengeTask[] = [
  {
    id: 'signed:c1', topic: 'signed', after: 'signed:1', kind: 'claim', title: 'שני מספרים שליליים', minutes: 4,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"סכום של שני מספרים שליליים הוא מספר שלילי."', verdict: 'always',
        why: 'על ציר המספרים מתחילים משמאל ל־$0$. מוסיפים מספר שלילי, וזזים עוד שמאלה. למשל $(-3) + (-5) = -8$. אי אפשר להגיע ל־$0$ או מימין לו.' },
      { type: 'num', prompt: 'כמה זה $(-7) + (-6)$?', answer: -13, check: '(-7)+(-6)',
        solution: ['שני המספרים שליליים, אז גם הסכום שלילי.', '$7 + 6 = 13$, ולכן $(-7) + (-6) = -13$.'] },
      { type: 'mc', prompt: 'ומה אפשר לומר על סכום של מספר שלילי ומספר חיובי?', choices: [
        { text: 'הוא יכול להיות חיובי, שלילי או $0$', ok: true, feedback: 'נכון: $(-2) + 5 = 3$, $(-5) + 2 = -3$, ו־$(-4) + 4 = 0$. זה תלוי באיזה מהם רחוק יותר מ־$0$.' },
        { text: 'הוא תמיד שלילי', ok: false, feedback: '$(-2) + 5 = 3$, וזה חיובי. כשהמספר החיובי רחוק יותר מ־$0$, הסכום חיובי.' },
        { text: 'הוא תמיד חיובי', ok: false, feedback: '$(-5) + 2 = -3$, וזה שלילי. כשהמספר השלילי רחוק יותר מ־$0$, הסכום שלילי.' },
      ] },
    ],
  },
  {
    id: 'signed:c2', topic: 'signed', after: 'signed:1', kind: 'error', title: 'שני מינוסים?', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך חישבה מיכל.',
        lines: ['צריך לחשב $-4 - 6$.', '"שני מינוסים הם פלוס", ולכן $-4 - 6 = -4 + 6$.', '$-4 + 6 = 2$'], wrong: 1,
        why: 'כאן מחסרים $6$, מספר חיובי. מינוס ועוד מינוס נהיים פלוס רק כשמחסרים מספר שלילי, כמו ב־$5 - (-2) = 5 + 2$. מ־$-4$ זזים $6$ שמאלה, ומגיעים ל־$-10$.',
        fix: { prompt: 'כמה זה $-4 - 6$?', answer: -10, check: '-4-6' } },
      { type: 'mc', prompt: 'באיזה תרגיל שני המינוסים באמת נהיים פלוס?', choices: [
        { text: '$5 - (-2) = 5 + 2$', ok: true, feedback: 'נכון: מחסרים מספר שלילי, וזה כמו להוסיף את הנגדי שלו. $5 - (-2) = 7$.' },
        { text: '$-4 - 6 = -4 + 6$', ok: false, feedback: 'כאן מחסרים $6$, מספר חיובי. אין כאן מינוס לפני מספר שלילי, ו־$-4 - 6 = -10$.' },
        { text: '$-3 - 2 = 3 + 2$', ok: false, feedback: 'המינוס של $-3$ שייך למספר עצמו, והוא לא מתבטל. $-3 - 2 = -5$.' },
      ] },
    ],
  },
  {
    id: 'signed:c3', topic: 'signed', after: 'signed:3', kind: 'literacy', title: 'שבוע קר בחרמון', minutes: 6,
    story: 'בחרמון מדדו את הטמפרטורה בכל בוקר, שבוע שלם. ראשון $-3$, שני $-1$, שלישי $2$, רביעי $0$, חמישי $-4$, שישי $1$, שבת $-2$ מעלות.',
    parts: [
      { type: 'num', prompt: 'מה ההפרש בין הבוקר החם ביותר לבוקר הקר ביותר?', answer: 6, check: '2-(-4)', unit: 'מעלות',
        solution: ['החם ביותר: $2$ מעלות. הקר ביותר: $-4$ מעלות.', '$2 - (-4) = 2 + 4 = 6$ מעלות.'] },
      { type: 'num', prompt: 'מה הסכום של שבע הטמפרטורות?', answer: -7, check: '-3-1+2+0-4+1-2', unit: 'מעלות',
        solution: ['השליליים יחד: $-3 - 1 - 4 - 2 = -10$.', 'החיוביים יחד: $2 + 1 = 3$. וכולם יחד: $-10 + 3 = -7$.'] },
      { type: 'num', prompt: 'הממוצע הוא הסכום חלקי מספר הימים. מה הטמפרטורה הממוצעת בשבוע הזה?', answer: -1, check: '(-3-1+2+0-4+1-2)/7', unit: 'מעלות',
        solution: ['הסכום $-7$, ויש $7$ ימים.', '$(-7) : 7 = -1$ מעלות.'] },
      { type: 'mc', prompt: 'בבוקר שאחרי שבת הטמפרטורה ירדה עוד ב־$3$ מעלות. כמה מעלות היו?', choices: [
        { text: '$-5$', ok: true, feedback: 'נכון: מ־$-2$ יורדים $3$, כלומר $-2 - 3 = -5$.' },
        { text: '$1$', ok: false, feedback: '$1$ הוא $3$ מעלות יותר מ־$-2$. ירידה היא למטה בציר: $-2 - 3 = -5$.' },
        { text: '$-1$', ok: false, feedback: 'מ־$-2$ יורדים $3$ מעלות, לא עולים $1$: $-2 - 3 = -5$.' },
      ] },
    ],
  },
];
