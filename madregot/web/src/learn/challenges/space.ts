// Challenge tasks of Pythagoras in space (curriculum stage 2, MEASURE-7): space:c1, a claim about a box's diagonal and
// its faces' diagonals; space:c2, the longest rod in a cylinder with the radius taken as the section's width; space:c3,
// an ant walking on a box's faces, which joins ז׳'s nets to Pythagoras (the straight line on the net against the line
// through the air). Their numbers are checked by the lane's spec/facts-space-teach.mjs and by learn/challenges.test.ts.
import type { ChallengeTask, FigSpec } from '../types';

/** The box 6 by 5 by 3 with its front face (6 by 3) and its lid (6 by 5) unfolded into one rectangle 6 by 8, and the ant's straight path across it. */
const antNet: FigSpec = {
  type: 'geo', label: 'הדופן הקדמית והמכסה של הקופסה פרושים למלבן אחד, והדרך הישרה של הנמלה מפינה לפינה',
  pts: { _a: [0, 0], _b: [6, 0], _c: [6, 3], _d: [0, 3], _e: [6, 8], _f: [0, 8] },
  polys: [{ pts: ['_a', '_b', '_c', '_d'] }, { pts: ['_d', '_c', '_e', '_f'], tone: 'add' }],
  segs: [{ a: '_a', b: '_b', label: '6' }, { a: '_b', b: '_c', label: '3' }, { a: '_c', b: '_e', label: '5' }, { a: '_a', b: '_e', hi: true }],
  words: [{ at: [1.6, 1.5], text: 'דופן קדמית' }, { at: [1.6, 6.4], text: 'מכסה' }],
};

export const SPACE_CHALLENGES: ChallengeTask[] = [
  {
    id: 'space:c1', topic: 'space', after: 'space:1', kind: 'claim', title: 'האלכסון הארוך', minutes: 5,
    parts: [
      { type: 'num', prompt: 'מה אורך האלכסון של תיבה $2$ על $3$ על $6$ ס״מ?', answer: 7, check: 'sqrt(2*2+3*3+6*6)', unit: 'ס״מ',
        solution: ['$2^2 + 3^2 + 6^2 = 49$.', '$\\sqrt{49} = 7$ ס״מ.'] },
      { type: 'num', prompt: 'ומה אורך האלכסון של הפאה $3$ על $6$? עגלו לעשירית.', answer: 6.7, check: 'round(sqrt(3*3+6*6)*10)/10', unit: 'ס״מ',
        solution: ['$3^2 + 6^2 = 45$.', '$\\sqrt{45} \\approx 6.7$ ס״מ.'] },
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"אלכסון התיבה ארוך מכל אחד מאלכסוני הפאות שלה."', verdict: 'always',
        why: '$a^2 + b^2 + c^2$ גדול מ־$a^2 + b^2$, כי $c^2$ חיובי. וכך לכל פאה: למקצוע השלישי יש אורך.' },
    ],
  },
  {
    id: 'space:c2', topic: 'space', after: 'space:2', kind: 'error', title: 'המקל בגליל', minutes: 5, misc: 'r-for-d',
    parts: [
      { type: 'error', prompt: 'כך חישב עידו את המקל הארוך ביותר.',
        lines: ['גליל: רדיוס $6$ ס״מ, גובה $16$ ס״מ. מה המקל הארוך ביותר?', '$\\ell^2 = 6^2 + 16^2 = 292$', '$\\ell \\approx 17.1$'], wrong: 1,
        why: 'רוחב החתך הצירי הוא הקוטר, $12$.',
        fix: { prompt: 'מה אורך המקל הארוך ביותר, בס״מ?', answer: 20, check: 'sqrt(12*12+16*16)' } },
      { type: 'mc', prompt: 'איך אפשר היה לגלות את הטעות?', choices: [
        { text: 'לשרטט את החתך הצירי: מלבן שרוחבו הקוטר', ok: true, feedback: 'נכון: המלבן $12$ על $16$, והאלכסון שלו $\\sqrt{144 + 256} = 20$.' },
        { text: 'לבדוק שהתשובה מספר שלם', ok: false, feedback: 'אורך יכול לצאת לא שלם. הבדיקה היא איזה משולש באמת נמצא בתוך הגליל.' },
        { text: 'לחבר את הרדיוס והגובה ולהשוות', ok: false, feedback: '$6 + 16$ היא דרך לאורך צלעות, ואת זה כבר לא בודקים בפיתגורס.' },
      ] },
    ],
  },
  {
    id: 'space:c3', topic: 'space', after: 'space:1', kind: 'literacy', title: 'הנמלה והקופסה', minutes: 9, fig: antNet,
    story: 'נמלה עומדת בפינה התחתונה של קופסה: אורך $6$ ס״מ, רוחב $5$ ס״מ, גובה $3$ ס״מ. היא רוצה להגיע לפינה העליונה הרחוקה ביותר, והיא הולכת רק על הדפנות.',
    parts: [
      { type: 'num', prompt: 'אילו הנמלה הייתה עפה בקו ישר, מה אורך הדרך? עגלו לעשירית.', answer: 8.4, check: 'round(sqrt(6*6+5*5+3*3)*10)/10', unit: 'ס״מ',
        solution: ['הקו הישר הוא אלכסון הקופסה: $6^2 + 5^2 + 3^2 = 70$.', '$\\sqrt{70} \\approx 8.4$ ס״מ.'] },
      { type: 'num', prompt: 'פורשים את הדופן הקדמית ($6$ על $3$) ואת המכסה ($6$ על $5$) למלבן אחד, $6$ על $8$. מה אורך הקו הישר בין שתי הפינות שלו?', answer: 10, check: 'sqrt(6*6+8*8)', unit: 'ס״מ',
        solution: ['$3 + 5 = 8$, ו־$\\sqrt{6^2 + 8^2} = 10$.'] },
      { type: 'mc', prompt: 'ויש עוד דרך: דרך הדופן שבצד ($5$ על $3$) והמכסה. בפריסה שלה הקו הישר הוא $\\sqrt{5^2 + 9^2} \\approx 10.3$ ס״מ. איזו דרך קצרה יותר?', choices: [
        { text: 'דרך הדופן הקדמית: $10$ ס״מ', ok: true, feedback: '$10 < 10.3$. ובשתי הדרכים הנמלה הולכת יותר מ־$8.4$, הקו באוויר.' },
        { text: 'דרך הדופן שבצד', ok: false, feedback: '$\\sqrt{106} \\approx 10.3$, יותר מ־$10$.' },
        { text: 'הן שוות', ok: false, feedback: '$10$ ו־$10.3$ אינם שווים: כל פריסה נותנת מלבן אחר.' },
      ] },
      { type: 'explain', prompt: 'למה הקו הישר על הפריסה הוא הדרך הקצרה ביותר על שתי הדפנות?',
        rubric: ['הסברתי שבפריסה שתי הדפנות הן מלבן שטוח, ובו הקו הישר הוא הקצר ביותר', 'הסברתי שכשמקפלים חזרה, האורך של הדרך לא משתנה'],
        sample: 'כשפורשים את שתי הדפנות, הדרך של הנמלה נשארת באותו אורך, והדפנות נהיות מלבן שטוח. במלבן הדרך הקצרה ביותר בין שתי פינות היא הקו הישר, וכשמקפלים חזרה הוא הופך לדרך על הקופסה.' },
    ],
  },
];
