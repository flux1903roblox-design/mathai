// Challenge tasks of the circle, the cylinder and the cone (curriculum stage 2, MEASURE-7): circle:c1, a claim about a
// disc whose radius doubles (the Ministry's water park, "נכפיל את רדיוס הבריכה"); circle:c2, a cone's volume with the
// slant height used as the height; circle:c3, two honey jars, one twice as tall with half the radius (the Ministry's
// honey jars, with new numbers). A part "with π" carries `after: '\\pi'`: the number before π is typed, as in a lesson,
// and so does circle:c2's fix. Their numbers are checked by the lane's spec/facts-circle-teach.mjs and by
// learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

const PI = '\\pi';

export const CIRCLE_CHALLENGES: ChallengeTask[] = [
  {
    id: 'circle:c1', topic: 'circle', after: 'circle:2', kind: 'claim', title: 'רדיוס כפול', minutes: 5,
    parts: [
      { type: 'num', prompt: 'מה שטח עיגול שרדיוסו $3$ ס״מ, בעזרת $\\pi$?', answer: 9, check: '3*3', unit: 'סמ״ר', after: PI,
        solution: ['שטח עיגול: $\\pi r^2$.', '$\\pi \\cdot 3^2 = 9\\pi$ סמ״ר.'] },
      { type: 'num', prompt: 'ומה שטח עיגול שרדיוסו $6$ ס״מ, בעזרת $\\pi$?', answer: 36, check: '6*6', unit: 'סמ״ר', after: PI,
        solution: ['הרדיוס בריבוע: $6^2 = 36$.', '$\\pi \\cdot 6^2 = 36\\pi$ סמ״ר.'] },
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"כשמכפילים את הרדיוס של עיגול פי $2$, גם השטח שלו גדל פי $2$."', verdict: 'never',
        why: '$\\pi(2r)^2 = 4\\pi r^2$: השטח גדל פי $4$, כמו מ־$9\\pi$ ל־$36\\pi$. ההיקף הוא שגדל פי $2$.' },
    ],
  },
  {
    id: 'circle:c2', topic: 'circle', after: 'circle:4', kind: 'error', title: 'הקו היוצר', minutes: 5, misc: 'slant-as-height',
    parts: [
      { type: 'error', prompt: 'כך חישבה נועה את נפח החרוט.',
        lines: ['חרוט: רדיוס $5$ ס״מ, קו יוצר $13$ ס״מ', '$V = \\frac{\\pi \\cdot 5^2 \\cdot 13}{3}$', '$V \\approx 108.3\\pi$'], wrong: 1,
        why: 'בנוסחה יש גובה, והקו היוצר אינו הגובה: $h = \\sqrt{13^2 - 5^2} = 12$.',
        lineWhy: { 0: 'אלה רק הנתונים מהשאלה. הטעות מתחילה אחריהם.', 2: '$\\frac{25 \\cdot 13}{3} \\approx 108.3$: החשבון נכון. הטעות באורך שנכנס לנוסחה.' },
        fix: { prompt: 'מה הנפח, בעזרת $\\pi$?', answer: 100, check: '5*5*12/3', after: PI } },
      { type: 'mc', prompt: 'איך אפשר היה לגלות את הטעות?', choices: [
        { text: 'לבדוק איזה אורך נכנס לנוסחה: גובה, ניצב לבסיס', ok: true, feedback: 'נכון: הקו היוצר $13$ הוא היתר בחצי החתך, והגובה $12$ קצר ממנו.' },
        { text: 'לבדוק שהתשובה מספר שלם', ok: false, feedback: 'תשובה שאינה שלמה יכולה להיות נכונה. הבדיקה היא איזה אורך נכנס לנוסחה.' },
        { text: 'לחשב את נפח הגליל ולהשוות', ok: false, feedback: 'גם בנפח הגליל יש גובה, ואותה טעות הייתה חוזרת שם.' },
      ] },
    ],
  },
  {
    id: 'circle:c3', topic: 'circle', after: 'circle:3', kind: 'literacy', title: 'צנצנות דבש', minutes: 8,
    story: 'בחנות שתי צנצנות דבש גליליות, מלאות. צנצנת א: רדיוס $4$ ס״מ, גובה $10$ ס״מ, $24$ ₪. צנצנת ב: רדיוס $2$ ס״מ, גובה $20$ ס״מ, $15$ ₪.',
    parts: [
      { type: 'num', prompt: 'מה נפח צנצנת א, בעזרת $\\pi$?', answer: 160, check: '4*4*10', unit: 'סמ״ק', after: PI,
        solution: ['שטח הבסיס: $\\pi \\cdot 4^2 = 16\\pi$.', 'כפול הגובה: $16\\pi \\cdot 10 = 160\\pi$ סמ״ק.'] },
      { type: 'num', prompt: 'ומה נפח צנצנת ב, בעזרת $\\pi$?', answer: 80, check: '2*2*20', unit: 'סמ״ק', after: PI,
        solution: ['שטח הבסיס: $\\pi \\cdot 2^2 = 4\\pi$.', 'כפול הגובה: $4\\pi \\cdot 20 = 80\\pi$ סמ״ק.'] },
      { type: 'mc', prompt: 'באיזו צנצנת הדבש זול יותר לכל סמ״ק?', choices: [
        { text: 'א', ok: true, feedback: 'א: $24$ ₪ ל־$160\\pi$; ב: $15$ ₪ ל־$80\\pi$, כלומר $30$ ₪ ל־$160\\pi$.' },
        { text: 'ב', ok: false, feedback: 'ב גבוהה פי $2$, אבל הרדיוס שלה חצי, והנפח חצי.' },
        { text: 'אותו מחיר', ok: false, feedback: 'בשתי צנצנות ב יש בדיוק כמו בצנצנת א, והן עולות $30$ ₪, לא $24$.' },
      ] },
    ],
  },
];
