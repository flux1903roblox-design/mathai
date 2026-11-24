// Challenge tasks of boxes and prisms (curriculum stage 2, MEASURE-7): solid:c1, a claim about a box cut into two halves
// (the Ministry's sample exam 2, with new numbers); solid:c2, a box's surface area with only three faces counted;
// solid:c3, a litre carton with a square base, its height and its cardboard (the Ministry's "קופסת קרטון" task, with new
// numbers). Their numbers are checked by the lane's spec/facts-solid-teach.mjs and by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const SOLID_CHALLENGES: ChallengeTask[] = [
  {
    id: 'solid:c1', topic: 'solid', after: 'solid:2', kind: 'claim', title: 'חצי תיבה', minutes: 6,
    parts: [
      { type: 'num', prompt: 'מה שטח הפנים של תיבה $10$ על $6$ על $4$ ס״מ?', answer: 248, check: '2*(10*6+10*4+6*4)', unit: 'סמ״ר',
        solution: ['שלוש פאות שונות: $60 + 40 + 24 = 124$.', 'כל פאה פעמיים: $2 \\cdot 124 = 248$ סמ״ר.'] },
      { type: 'num', prompt: 'חוצים אותה לשתי תיבות $5$ על $6$ על $4$. מה שטח הפנים של חצי אחד?', answer: 148, check: '2*(5*6+5*4+6*4)', unit: 'סמ״ר',
        solution: ['שלוש פאות שונות: $30 + 20 + 24 = 74$.', 'כל פאה פעמיים: $2 \\cdot 74 = 148$ סמ״ר.'] },
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"כשחוצים תיבה לשתי תיבות זהות, שטח הפנים של כל חצי הוא חצי משטח הפנים של התיבה."', verdict: 'never',
        why: 'החיתוך מוסיף לכל חצי פאה חדשה, ולכן כל חצי מקבל יותר מחצי: $148 > 124$. הנפח, לעומת זאת, נחצה בדיוק.' },
    ],
  },
  {
    id: 'solid:c2', topic: 'solid', after: 'solid:1', kind: 'error', title: 'שלוש פאות', minutes: 5, misc: 'three-faces',
    parts: [
      { type: 'error', prompt: 'כך חישב יונתן את שטח הפנים.',
        lines: ['תיבה $2$ על $3$ על $4$ ס״מ', '$S = 2 \\cdot 3 + 2 \\cdot 4 + 3 \\cdot 4$', '$S = 6 + 8 + 12 = 26$ סמ״ר'], wrong: 1,
        why: 'לכל פאה יש פאה נגדית שווה לה: צריך לכפול ב־$2$.',
        lineWhy: { 0: 'אלה רק המידות מהשאלה. הטעות מתחילה אחריהן.', 2: '$6 + 8 + 12 = 26$: החיבור נכון. אבל חסרות בו שלוש פאות, מהשורה שלפניה.' },
        fix: { prompt: 'מה שטח הפנים?', answer: 52, check: '2*(2*3+2*4+3*4)' } },
      { type: 'mc', prompt: 'איך אפשר היה לגלות את הטעות?', choices: [
        { text: 'לספור את הפאות בפריסה: שש, ולא שלוש', ok: true, feedback: 'נכון: בפריסה של תיבה יש שש פאות, שלושה זוגות שווים. $2 \\cdot 26 = 52$.' },
        { text: 'לבדוק שהתשובה מספר זוגי', ok: false, feedback: 'גם $26$ זוגי. הבדיקה היא לספור את הפאות: לכל פאה יש פאה נגדית.' },
        { text: 'לחשב את הנפח ולהשוות', ok: false, feedback: 'הנפח, $24$ סמ״ק, הוא גודל אחר. הוא לא בודק כמה קרטון יש מבחוץ.' },
      ] },
    ],
  },
  {
    id: 'solid:c3', topic: 'solid', after: 'solid:2', kind: 'literacy', title: 'קרטון של ליטר', minutes: 10,
    story: 'מפעל אורז מיץ בקרטונים של ליטר אחד, $1000$ סמ״ק, שבסיסם ריבוע. ככל שיש פחות קרטון, האריזה זולה יותר.',
    parts: [
      { type: 'num', prompt: 'בסיס $5$ על $5$ ס״מ. מה הגובה?', answer: 40, check: '1000/25', unit: 'ס״מ',
        solution: ['שטח הבסיס: $5 \\cdot 5 = 25$ סמ״ר.', 'נפח לחלק לשטח הבסיס: $1000 : 25 = 40$ ס״מ.'] },
      { type: 'num', prompt: 'בסיס $10$ על $10$ ס״מ. כמה קרטון (שטח פנים)?', answer: 600, check: '2*10*10+4*10*10', unit: 'סמ״ר',
        solution: ['הגובה: $1000 : 100 = 10$ ס״מ, ולכן הקרטון קובייה.', 'שש פאות של $10 \\cdot 10 = 100$: $600$ סמ״ר.'] },
      { type: 'mc', prompt: 'מבין הבסיסים $5$, $8$ ו־$10$ ס״מ, איזה צריך הכי מעט קרטון?', choices: [
        { text: '$10$: $600$ סמ״ר', ok: true, feedback: '$5$: $850$; $8$: $628$; $10$: $600$.' },
        { text: '$5$', ok: false, feedback: 'בבסיס $5$ הקרטון גבוה, $40$ ס״מ: $2 \\cdot 25 + 4 \\cdot 5 \\cdot 40 = 850$ סמ״ר.' },
        { text: '$8$', ok: false, feedback: 'בבסיס $8$ הגובה $15.625$ ס״מ: $128 + 500 = 628$ סמ״ר, יותר מ־$600$.' },
      ] },
      { type: 'explain', prompt: 'למה בכל זאת רוב קרטוני המיץ גבוהים וצרים?',
        rubric: ['אמרתי שהקובייה חוסכת הכי הרבה קרטון', 'נתתי סיבה מהחיים: אחיזה ביד, מזיגה או מקום במדף'],
        sample: 'קובייה של $10$ ס״מ חוסכת הכי הרבה קרטון, אבל קשה להחזיק אותה ביד אחת ולמזוג ממנה. קרטון גבוה וצר נוח לאחיזה, נכנס בדלת של המקרר ותופס פחות מקום על המדף.' },
    ],
  },
];
