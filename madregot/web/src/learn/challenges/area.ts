// Challenge tasks of areas and perimeters (curriculum stage 2, MEASURE-7): area:c1, a claim about a larger perimeter and a
// larger area; area:c2, the class's right triangle (CLASSROOM-13) with the half forgotten; area:c3, a wooden deck shaped
// as a trapezoid, boards laid over the rectangle round it (the Ministry's deck task, with new numbers). Their numbers are
// checked by the lane's spec/facts-area-teach.mjs and by learn/challenges.test.ts.
import type { ChallengeTask, FigSpec } from '../types';

/** The deck of area:c3: a trapezoid 9 m along the garden, 5 m along the house, 4 m between them, in its dashed rectangle. */
const DECK_FIG: FigSpec = {
  type: 'geo', label: 'מרפסת בצורת טרפז, והמלבן שמקיף אותה',
  pts: { _1: [0, 0], _2: [9, 0], _3: [7, 4], _4: [2, 4], _5: [9, 4], _6: [0, 4], _7: [2, 0] },
  polys: [{ pts: ['_1', '_2', '_3', '_4'] }],
  segs: [
    { a: '_1', b: '_2', label: '9' }, { a: '_4', b: '_3', label: '5' }, { a: '_4', b: '_7', label: '4', dash: true },
    { a: '_3', b: '_5', dash: true }, { a: '_4', b: '_6', dash: true }, { a: '_6', b: '_1', dash: true }, { a: '_2', b: '_5', dash: true },
  ],
  angles: [{ at: '_7', from: '_2', to: '_4', right: true }],
};

export const AREA_CHALLENGES: ChallengeTask[] = [
  {
    id: 'area:c1', topic: 'area', after: 'area:5', kind: 'claim', title: 'היקף גדול יותר, שטח גדול יותר?', minutes: 6, misc: 'same-perim-same-area',
    parts: [
      { type: 'num', prompt: 'מה ההיקף של מלבן $8$ על $1$?', answer: 18, check: '2*(8+1)', unit: 'ס״מ',
        solution: ['שני אורכים ושני רוחבים: $2 \\cdot (8 + 1) = 18$ ס״מ.', 'השטח שלו רק $8 \\cdot 1 = 8$ סמ״ר.'] },
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"אם ההיקף של מלבן גדול יותר, גם השטח שלו גדול יותר."', verdict: 'sometimes',
        why: 'ריבוע $4 \\cdot 4$: היקף $16$, שטח $16$. מלבן $8 \\cdot 1$: היקף $18$, שטח רק $8$. ולפעמים שניהם גדלים: $5 \\cdot 4$ גדול מ־$4 \\cdot 4$ בשניהם.',
        example: {
          ask: 'מצאו מלבן עם צלעות שלמות שהיקפו יותר מ־$16$ ושטחו פחות מ־$16$.', slots: [{ name: 'a', label: 'האורך' }, { name: 'b', label: 'הרוחב' }],
          // both conditions at once: the perimeter 2(a + b) at least 17, and the area ab at most 15
          domain: 'positive-int', expr: 'min(2*(a+b)-17, 15-a*b)', rel: '>=', value: 0, hint: 'נסו מלבן ארוך וצר מאוד.',
        } },
      { type: 'explain', prompt: 'למה מלבן ארוך וצר יכול להיות עם היקף גדול ושטח קטן?',
        rubric: ['השוויתי שני מלבנים במספרים', 'הסברתי שהשטח תלוי בכפל, וההיקף בחיבור'],
        sample: 'מלבן $8$ על $1$ והריבוע $4$ על $4$: ההיקף של המלבן $18$, יותר מ־$16$, אבל השטח שלו $8$ בלבד. בהיקף מחברים את הצלעות, ולכן צלע ארוכה מגדילה אותו. בשטח כופלים, וצלע קצרה מאוד מקטינה את המכפלה.' },
    ],
  },
  {
    id: 'area:c2', topic: 'area', after: 'area:2', kind: 'error', title: 'הניצב החסר', minutes: 5, misc: 'no-half',
    parts: [
      { type: 'error', prompt: 'כך פתרה נועה.',
        lines: ['נתון: $S_{\\triangle ABC} = 39$, $\\sphericalangle C = 90^\\circ$, $BC = 6$, $AC = x$', '$S_{\\triangle ABC} = 6x$', '$6x = 39 \\;/{:}6$', '$x = 6.5$'], wrong: 1,
        why: 'בשטח משולש מחלקים ב־$2$: $\\frac{6x}{2} = 39$.',
        fix: { prompt: 'מה $x$ באמת?', answer: 13, check: '2*39/6' } },
      { type: 'mc', prompt: 'איך אפשר היה לגלות את הטעות?', choices: [
        { text: 'להציב $x = 6.5$ בנוסחת השטח: $\\frac{6 \\cdot 6.5}{2} = 19.5$, ולא $39$', ok: true, feedback: 'נכון: הצבה בחזרה בנוסחה בודקת כל פתרון. עם $13$: $\\frac{6 \\cdot 13}{2} = 39$.' },
        { text: 'לבדוק ש־$x$ הוא מספר שלם', ok: false, feedback: 'אורך יכול להיות $6.5$. הבדיקה היא להציב בנוסחה: $\\frac{6 \\cdot 6.5}{2} = 19.5$, לא $39$.' },
        { text: 'לבדוק ש־$6 \\cdot 6.5 = 39$', ok: false, feedback: 'זו בדיקה של השורה השגויה עצמה. המשולש הוא חצי מלבן, ולכן בודקים עם החלוקה ב־$2$.' },
      ] },
    ],
  },
  {
    id: 'area:c3', topic: 'area', after: 'area:4', kind: 'literacy', title: 'המרפסת של משפחת אור', minutes: 9, fig: DECK_FIG,
    story: 'משפחת אור בונה מרפסת עץ בצורת טרפז: הצלע שליד הבית $5$ מ׳, הצלע שמול הגינה $9$ מ׳, והמרחק ביניהן $4$ מ׳. הם קנו $30$ חבילות קרשים, וכל חבילה מכסה $1$ מ״ר. הנגר מניח קרשים ישרים לכל האורך, ולכן הוא צריך עץ כמו המלבן שמקיף את הטרפז.',
    parts: [
      { type: 'num', prompt: 'מה שטח המרפסת?', answer: 28, check: '(5+9)*4/2', unit: 'מ״ר',
        solution: ['שטח טרפז: סכום הבסיסים, כפול הגובה, חלקי $2$.', '$\\frac{(5 + 9) \\cdot 4}{2} = 28$ מ״ר.'] },
      { type: 'num', prompt: 'מה שטח המלבן שמקיף אותה?', answer: 36, check: '9*4', unit: 'מ״ר',
        solution: ['המלבן ארוך כמו הצלע הארוכה, $9$ מ׳, ורחב כמו המרחק בין הבסיסים, $4$ מ׳.', '$9 \\cdot 4 = 36$ מ״ר.'] },
      { type: 'num', prompt: 'כמה חבילות חסרות?', answer: 6, check: '9*4-30', unit: 'חבילות',
        solution: ['הנגר צריך עץ ל־$36$ מ״ר, וכל חבילה מכסה $1$ מ״ר.', '$36 - 30 = 6$ חבילות.'] },
      { type: 'explain', prompt: 'הציעו שינוי בצורה, בלי לקצר את הצלע שליד הבית, שבו $30$ חבילות יספיקו בלי פחת.',
        rubric: ['הצעתי צורה ששטחה $30$ מ״ר', 'השארתי את הצלע שליד הבית $5$ מ׳', 'הסברתי למה אין פחת'],
        sample: 'מלבן $5$ על $6$: $30$ מ״ר בדיוק, וכל קרש נכנס שלם.' },
    ],
  },
];
