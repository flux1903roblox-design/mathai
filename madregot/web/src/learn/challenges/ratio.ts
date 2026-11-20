// Challenge tasks of ratio (curriculum stage 1, CURRICULUM-6.5): ratio:c1, someone's solution of sharing in a ratio,
// with the error to find and fix; ratio:c2, a claim about adding the same number to both parts; ratio:c3, a hike on a
// 1 : 25,000 map. Checked by learn/challenges.test.ts and verify/facts-challenges17.mjs.
// PRODUCT2-21 (a task after every stair): ratio:c4, after ratio:3, the proof that a proportion's cross products are
// equal, a recipe scaled with it, and the same difference kept instead of the same ratio ('additive').
import type { ChallengeTask } from '../types';

export const RATIO_CHALLENGES: ChallengeTask[] = [
  {
    id: 'ratio:c1', topic: 'ratio', after: 'ratio:2', kind: 'error', title: 'הטעות של רוני', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך פתר רוני.',
        lines: ['חילקו $56$ גולות בין אורי לדן ביחס $2 : 5$.', 'לאורי: $\\frac{2}{5} \\cdot 56 = 22.4$', 'לדן: $56 - 22.4 = 33.6$'], wrong: 1,
        why: '$\\frac{2}{5}$ הוא היחס בין אורי לדן, לא החלק של אורי מכל הגולות: מכל הגולות לאורי $\\frac{2}{7}$. וגם $22.4$ גולות אינו מספר שלם.',
        lineWhy: { 0: 'זו רק השאלה. הטעות מתחילה אחריה.', 2: 'החיסור נכון: מה שלא של אורי הוא של דן. הטעות בחלק של אורי.' },
        fix: { prompt: 'כמה גולות מקבל אורי?', answer: 16, check: '56/7*2' } },
      { type: 'mc', prompt: 'איך אפשר היה לחשוד בטעות בלי לחשב?', choices: [
        { text: 'אי אפשר לקבל חלק של גולה', ok: true, feedback: 'נכון: $22.4$ גולות לא יכול להיות. תשובה שאינה מספר שלם של גולות מסמנת טעות.' },
        { text: '$22.4$ גדול מדי', ok: false, feedback: '$22.4$ לא גדול מדי: אורי מקבל פחות מחצי. מה שחשוד הוא החלק של גולה.' },
        { text: 'אי אפשר לדעת', ok: false, feedback: 'אפשר: גולות סופרים במספרים שלמים, ו־$22.4$ אינו מספר שלם.' },
      ] },
    ],
  },
  {
    id: 'ratio:c2', topic: 'ratio', after: 'ratio:1', kind: 'claim', title: 'מוסיפים לשני החלקים', minutes: 4, misc: 'add-same',
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"מוסיפים אותו מספר חיובי לשני החלקים של יחס. היחס לא משתנה."', verdict: 'sometimes',
        why: '$2 : 3$ ועוד $1$ לכל חלק נהיה $3 : 4$, וזה יחס אחר: $\\frac{2}{3} \\ne \\frac{3}{4}$. רק כששני החלקים שווים, $1 : 1$, היחס נשאר אותו יחס.',
        example: {
          ask: 'תנו יחס ומספר שמשנים אותו.', slots: [{ name: 'a', label: 'החלק הראשון' }, { name: 'b', label: 'החלק השני' }, { name: 'k', label: 'מה מוסיפים' }],
          domain: 'positive-int', expr: '(a+k)/(b+k) - a/b', rel: '!=', value: 0, hint: 'נסו $2 : 3$, ולהוסיף $1$.',
        } },
      { type: 'mc', prompt: 'לאיזה יחס ההוספה לא משנה כלום?', choices: [
        { text: '$1 : 1$, שני חלקים שווים', ok: true, feedback: 'נכון: $1 : 1$ ועוד $5$ הוא $6 : 6$, שוב $1 : 1$. שני חלקים שווים נשארים שווים.' },
        { text: '$1 : 2$', ok: false, feedback: '$1 : 2$ ועוד $1$ הוא $2 : 3$, יחס אחר: $\\frac{1}{2} \\ne \\frac{2}{3}$.' },
        { text: 'לכל יחס', ok: false, feedback: '$2 : 3$ ועוד $1$ הוא $3 : 4$, יחס אחר. היחס נשמר כשכופלים את שני החלקים, לא כשמוסיפים.' },
      ] },
    ],
  },
  {
    id: 'ratio:c3', topic: 'ratio', after: 'ratio:4', kind: 'literacy', title: 'מסלול על המפה', minutes: 8,
    story: 'במפת טיולים בקנה מידה $1 : 25{,}000$ המסלול בנוי משלושה קטעים: $4$ ס״מ, $6.5$ ס״מ ו־$3.5$ ס״מ. הולכים במהירות של $4$ קמ״ש.',
    parts: [
      { type: 'num', prompt: 'כמה ס״מ אורך המסלול במפה?', answer: 14, check: '4+6.5+3.5', unit: 'ס״מ',
        solution: ['מחברים את שלושת הקטעים.', '$4 + 6.5 + 3.5 = 14$ ס״מ.'] },
      { type: 'mc', prompt: 'איך עוברים מסנטימטרים במפה לקילומטרים בשטח?', choices: [
        { text: 'כופלים ב־$25{,}000$, ומחלקים ב־$100{,}000$', ok: true, feedback: 'נכון: ס״מ במפה הוא $25{,}000$ ס״מ בשטח, ובקילומטר יש $100{,}000$ ס״מ.' },
        { text: 'כופלים ב־$25{,}000$, ומחלקים ב־$1{,}000$', ok: false, feedback: 'חלוקה ב־$1{,}000$ עוברת ממטרים לקילומטרים. כאן מתחילים בסנטימטרים, ובקילומטר יש $100{,}000$ ס״מ.' },
        { text: 'מחלקים ב־$25{,}000$', ok: false, feedback: 'בשטח הכול גדול יותר מבמפה, ולכן כופלים ב־$25{,}000$. אחר כך עוברים לקילומטרים.' },
      ] },
      { type: 'num', prompt: 'כמה ק״מ אורך המסלול בשטח?', answer: 3.5, check: '14*25000/100000', unit: 'ק״מ',
        solution: ['$14 \\cdot 25{,}000 = 350{,}000$ ס״מ.', 'בקילומטר $100{,}000$ ס״מ, ולכן $350{,}000$ ס״מ הם $3.5$ ק״מ.'] },
      { type: 'num', prompt: 'כמה דקות תימשך ההליכה?', answer: 52.5, check: '3.5/4*60', unit: 'דקות',
        solution: ['ב־$4$ קמ״ש עוברים ק״מ אחד ב־$60 : 4 = 15$ דקות.', '$3.5 \\cdot 15 = 52.5$ דקות.'] },
    ],
  },
  {
    id: 'ratio:c4', topic: 'ratio', after: 'ratio:3', kind: 'proof', title: 'למה כופלים בהצלבה?', minutes: 7,
    parts: [
      { type: 'order', prompt: 'בפרופורציה $\\frac{a}{b} = \\frac{c}{d}$, ו־$b$ ו־$d$ אינם $0$. למה $a \\cdot d = b \\cdot c$? סדרו את שלבי ההוכחה.',
        steps: [
          { text: '$\\frac{a}{b} = \\frac{c}{d}$' },
          { text: 'כופלים את שני האגפים ב־$b \\cdot d$: $\\frac{a}{b} \\cdot b \\cdot d = \\frac{c}{d} \\cdot b \\cdot d$.',
            reason: { choices: ['כופלים את שני האגפים באותו מספר, והשוויון נשמר', 'מרחיבים כל שבר במספר אחר', 'מוסיפים $b \\cdot d$ לשני האגפים'], answer: 0 } },
          { text: 'מצמצמים: באגף שמאל $b$ מתבטל, ובאגף ימין $d$ מתבטל.',
            reason: { choices: ['$\\frac{b}{b} = 1$ וגם $\\frac{d}{d} = 1$', '$b - b = 0$ וגם $d - d = 0$', '$b$ ו־$d$ שווים'], answer: 0 } },
          { text: 'לכן $a \\cdot d = c \\cdot b$.' },
        ] },
      { type: 'num', prompt: 'מתכון ל־$12$ פנקייקים צריך $3$ ביצים. כמה ביצים צריך ל־$20$ פנקייקים?', answer: 5, check: '3*20/12', unit: 'ביצים',
        solution: ['הפרופורציה: $\\frac{3}{12} = \\frac{x}{20}$. כופלים בהצלבה: $12x = 60$.', '$x = 60 : 12 = 5$ ביצים.'] },
      { type: 'mc', prompt: 'אורי אמר: "$20$ פנקייקים הם $8$ יותר מ־$12$. לכן צריך $3 + 8 = 11$ ביצים." מה הבעיה?', choices: [
        { text: 'בפרופורציה שומרים על אותו יחס, לא על אותו הפרש', ok: true, feedback: 'נכון: ביצה אחת לכל $4$ פנקייקים. ל־$8$ פנקייקים נוספים צריך $2$ ביצים, לא $8$. ביחד $5$.' },
        { text: 'צריך לחסר $8$, לא להוסיף', ok: false, feedback: 'יש יותר פנקייקים, ולכן צריך יותר ביצים, לא פחות. הבעיה היא שהוסיפו אותו הפרש, במקום לשמור על היחס.' },
        { text: 'אין בעיה, $11$ נכון', ok: false, feedback: 'במתכון יש ביצה אחת לכל $4$ פנקייקים. עם $11$ ביצים יש ביצה לכל פחות משני פנקייקים: זה כבר מתכון אחר.' },
      ] },
    ],
  },
];
