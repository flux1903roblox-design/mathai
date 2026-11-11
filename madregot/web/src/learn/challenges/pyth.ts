// Challenge tasks of Pythagoras (curriculum stage 1, CURRICULUM-6.5): pyth:c1, will a pole fit in a box, lying flat or
// slanted from corner to corner; pyth:c2, the proof by one square of side a + b, put in order with its reasons; pyth:c3,
// a claim about a² + b² > c². Their numbers are checked by learn/challenges.test.ts and verify/facts-challenges17.mjs.
import type { ChallengeTask, FigSpec } from '../types';

/** A square of side a + b (a = 3, b = 4) with a right triangle in each corner; the square of side c is left inside. */
const SQUARE_FIG: FigSpec = {
  type: 'geo', label: 'ריבוע שצלעו a ועוד b. בכל פינה משולש ישר־זווית עם ניצבים a ו־b, ובאמצע ריבוע שצלעו c',
  pts: { _0: [0, 0], _1: [3, 0], _2: [7, 0], _3: [7, 3], _4: [7, 7], _5: [4, 7], _6: [0, 7], _7: [0, 4] },
  polys: [{ pts: ['_0', '_1', '_7'] }, { pts: ['_1', '_2', '_3'] }, { pts: ['_3', '_4', '_5'] }, { pts: ['_5', '_6', '_7'] }],
  segs: [{ a: '_0', b: '_1', label: 'a' }, { a: '_1', b: '_2', label: 'b' }, { a: '_1', b: '_3', label: 'c', side: 'in' }],
  angles: [{ at: '_0', from: '_1', to: '_7', right: true }],
  view: [240, 240],
};

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
  {
    id: 'pyth:c2', topic: 'pyth', after: 'pyth:1', kind: 'proof', title: 'הוכחה בעזרת ריבוע אחד', minutes: 7, fig: SQUARE_FIG,
    parts: [
      { type: 'order', prompt: 'סדרו את שלבי ההוכחה של משפט פיתגורס, מהראשון לאחרון.',
        steps: [
          { text: 'בונים ריבוע שצלעו $a + b$. בכל פינה מניחים משולש ישר־זווית עם ניצבים $a$ ו־$b$ ויתר $c$. באמצע נשאר ריבוע שצלעו $c$.' },
          { text: 'שטח הריבוע הגדול הוא $c^2 + 4 \\cdot \\frac{ab}{2} = c^2 + 2ab$.',
            reason: { choices: ['השטח של צורה שלמה הוא סכום השטחים של החלקים שלה', 'סכום הזוויות במשולש הוא $180°$', 'במשולש ישר־זווית היתר הוא הצלע הארוכה'], answer: 0 } },
          { text: 'שטח הריבוע הגדול הוא גם $(a + b)^2 = a^2 + 2ab + b^2$.',
            reason: { choices: ['כינוס איברים דומים בלבד', 'חוק הפילוג: $(a + b)(a + b)$', 'שטח משולש הוא חצי בסיס כפול גובה'], answer: 1 } },
          { text: 'לכן $a^2 + 2ab + b^2 = c^2 + 2ab$. מחסרים $2ab$ משני האגפים: $a^2 + b^2 = c^2$.' },
        ],
        // the two ways to write the big square's area can come in either order: the proof holds both ways
        free: [[1, 2]] },
      { type: 'num', prompt: 'בודקים ב־$a = 3$ ו־$b = 4$: שטח הריבוע הגדול פחות ארבעת המשולשים. כמה זה $c^2$?', answer: 25, check: '(3+4)^2-4*(3*4/2)',
        solution: ['$(3 + 4)^2 = 49$, וכל משולש $\\frac{3 \\cdot 4}{2} = 6$.', '$49 - 4 \\cdot 6 = 25$, וגם $3^2 + 4^2 = 9 + 16 = 25$. שני הצדדים שווים.'] },
    ],
  },
  {
    id: 'pyth:c3', topic: 'pyth', after: 'pyth:3', kind: 'claim', title: 'חד, ישר או קהה?', minutes: 5,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"אם $a^2 + b^2 > c^2$, ו־$c$ היא הצלע הארוכה, המשולש חד־זווית."', verdict: 'always',
        why: 'כשהזווית מול $c$ ישרה, $a^2 + b^2 = c^2$. אם פותחים אותה לזווית קהה, $c$ מתארכת ו־$c^2$ גדל מעבר ל־$a^2 + b^2$. אם סוגרים אותה לזווית חדה, $c^2$ קטן מ־$a^2 + b^2$. והזווית מול הצלע הארוכה היא הגדולה במשולש, ולכן גם השתיים האחרות חדות.' },
      { type: 'num', prompt: 'משולש עם צלעות $5$, $6$ ו־$7$. כמה זה $5^2 + 6^2 - 7^2$?', answer: 12, check: '5^2+6^2-7^2',
        solution: ['$25 + 36 - 49 = 12$.', 'התוצאה חיובית: $5^2 + 6^2 > 7^2$, ולכן המשולש חד־זווית.'] },
      { type: 'mc', prompt: 'משולש עם צלעות $4$, $5$ ו־$7$. איזו זווית יש מול הצלע $7$?', choices: [
        { text: 'קהה: $4^2 + 5^2 = 41$, פחות מ־$49$', ok: true, feedback: 'נכון: $c^2$ גדול מ־$a^2 + b^2$, ולכן הזווית מול $c$ קהה.' },
        { text: 'ישרה', ok: false, feedback: 'זווית ישרה רק כש־$a^2 + b^2 = c^2$. כאן $16 + 25 = 41$, ו־$7^2 = 49$.' },
        { text: 'חדה', ok: false, feedback: 'זווית חדה כש־$a^2 + b^2 > c^2$. כאן $41 < 49$, ולכן היא קהה.' },
      ] },
    ],
  },
];
