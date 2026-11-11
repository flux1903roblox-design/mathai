// Challenge tasks of statistics (curriculum stage 1, CURRICULUM-6.5): stats:c1, a company's salaries, the mean against
// the median, and a claim about the mean judged with a counterexample; stats:c2, a claim about a new datum above the
// mean; stats:c3, a median taken without sorting. Checked by learn/challenges.test.ts and verify/facts-challenges17.mjs.
import type { ChallengeTask } from '../types';

export const STATS_CHALLENGES: ChallengeTask[] = [
  {
    id: 'stats:c1', topic: 'stats', after: 'stats:3', kind: 'literacy', title: 'השכר בחברה הקטנה', minutes: 6,
    story: 'בחברה $6$ עובדים מרוויחים $8{,}000$ ש״ח בחודש, והמנהלת $50{,}000$ ש״ח.',
    parts: [
      { type: 'num', prompt: 'מה השכר הממוצע?', answer: 14000, check: '(6*8000+50000)/7', unit: 'ש״ח',
        solution: ['ששת העובדים: $6 \\cdot 8{,}000 = 48{,}000$ ש״ח. עם המנהלת: $48{,}000 + 50{,}000 = 98{,}000$ ש״ח.', 'בחברה $7$ אנשים: $98{,}000 : 7 = 14{,}000$ ש״ח.'] },
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
  {
    id: 'stats:c2', topic: 'stats', after: 'stats:3', kind: 'claim', title: 'נתון חדש והממוצע', minutes: 5,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"מוסיפים לנתונים נתון חדש, גדול מהממוצע. הממוצע עולה."', verdict: 'always',
        why: 'הממוצע הוא חלוקה שווה של הסכום. נתון חדש שגדול מהממוצע מביא איתו יותר מהחלק השווה, והעודף מתחלק בין כולם. למשל, ל־$4, 6, 8$ הממוצע $6$. מוסיפים $10$: $28 : 4 = 7$, יותר מ־$6$.' },
      { type: 'num', prompt: 'הממוצע של $4$ מבחנים הוא $80$. נוסף מבחן עם ציון $90$. מה הממוצע עכשיו?', answer: 82, check: '(4*80+90)/5',
        solution: ['סכום הציונים היה $4 \\cdot 80 = 320$, ועכשיו $320 + 90 = 410$.', '$410 : 5 = 82$, יותר מ־$80$.'] },
      { type: 'mc', prompt: 'ומה קורה לממוצע כשהנתון החדש שווה בדיוק לממוצע?', choices: [
        { text: 'הוא לא משתנה', ok: true, feedback: 'נכון: ל־$4, 6, 8$ מוסיפים $6$, ו־$24 : 4 = 6$. הנתון החדש מביא בדיוק את החלק השווה.' },
        { text: 'הוא עולה', ok: false, feedback: 'ל־$4, 6, 8$ מוסיפים $6$: $24 : 4 = 6$, כמו קודם. הממוצע עולה רק כשהנתון גדול ממנו.' },
        { text: 'הוא יורד', ok: false, feedback: 'הממוצע יורד רק כשהנתון החדש קטן ממנו. ל־$4, 6, 8$ ועוד $6$ הממוצע נשאר $6$.' },
      ] },
    ],
  },
  {
    id: 'stats:c3', topic: 'stats', after: 'stats:2', kind: 'error', title: 'החציון של אורי', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך מצא אורי את החציון.',
        lines: ['הנתונים: $7, 3, 9, 4, 8$', 'יש $5$ נתונים, והחציון הוא האמצעי, השלישי.', 'השלישי ברשימה הוא $9$, ולכן החציון $9$.'], wrong: 2,
        why: 'החציון הוא האמצעי אחרי שמסדרים את הנתונים מהקטן לגדול: $3, 4, 7, 8, 9$. השלישי בסדר הזה הוא $7$, לא השלישי בסדר שבו נכתבו.',
        fix: { prompt: 'מה החציון?', answer: 7, check: '7' } },
      { type: 'mc', prompt: 'איך אפשר לחשוד ב־$9$ בלי לסדר?', choices: [
        { text: '$9$ הוא הנתון הגדול ביותר, והחציון אמור להיות באמצע', ok: true, feedback: 'נכון: מחצית מהנתונים קטנים מהחציון ומחצית גדולים ממנו. אף נתון לא גדול מ־$9$.' },
        { text: 'חציון לא יכול להיות מספר אי־זוגי', ok: false, feedback: 'חציון יכול להיות כל מספר, גם אי־זוגי. כאן הוא $7$. החשד בא מזה ש־$9$ הוא הגדול ביותר.' },
        { text: 'אי אפשר לחשוד בלי לסדר', ok: false, feedback: 'אפשר: $9$ הוא הנתון הגדול ביותר, וחציון של כמה נתונים שונים לא יכול להיות הגדול שבהם.' },
      ] },
    ],
  },
];
