// Isosceles triangles and similarity (שווה־שוקיים ודמיון): the ח׳ unit 8.13 of March and April (curriculum stage 4,
// GEOM-6). Taught near the end of the year, so the first-day placement test skips it (placement: false).
//
// This is the topic object the first screen reads: its name, colour, levels, misconception names and lesson summary.
// The arithmetic (the diagnostic models, the practice generators, their texts and the true-to-scale drawings) is
// content/sim.gen.js, which loads with the topic's teaching content; each level's gen() calls it there
// (content/lazyGen.js). The proof templates it uses (T5, T6 and T7) are content/proofs.js, loaded with them.
import { lazyLevels } from './lazyGen.js';

export const SIM = {
  id: 'sim', grade: '8', title: 'שווה־שוקיים ודמיון', color: 'sky',
  desc: 'משפטים הפוכים בשווה־שוקיים, צורות דומות, דמיון ז.ז ויחס השטחים',
  // taught in March and April: the first-day placement test does not ask about it (the jump test does)
  placement: false,
  levels: lazyLevels('sim', ['שווה־שוקיים ומשפטים הפוכים', 'צורות דומות', 'דמיון משולשים (ז.ז)', 'יחס צלעות ויחס שטחים']),
  cats: {
    'side-at-angle': 'השוו צלעות שיוצאות מהזוויות השוות, ולא את הצלעות שמולן',
    'stopped-at-x': 'מצאו את $x$ ועצרו, בלי לחשב את אורך הצלע',
    'whole-base': 'השתמשו בכל הבסיס במקום בחצי שלו',
    'converse-equal': 'חשבו שמשפט והמשפט ההפוך לו נכונים או לא נכונים יחד',
    additive: 'הוסיפו לכל צלע אותו מספר במקום לכפול באותו מספר',
    'ratio-flip': 'הכפילו ביחס הדמיון ההפוך',
    'angles-enough': 'חשבו שבמרובעים זוויות שוות מספיקות לדמיון',
    'part-not-whole': 'השוו לחלק של הצלע במקום לכל הצלע',
    'order-mixed': 'כתבו את הדמיון בסדר קודקודים שאינו מתאים',
    'third-angle': 'השוו זוויות בלי לחשב קודם את הזווית השלישית',
    'linear-area': 'חשבו שהשטח גדל פי אותו מספר כמו האורכים',
    'area-for-perimeter': 'העלו בריבוע גם את יחס ההיקפים',
    // the two proof mistakes (content/proofs.js proofDiag), in the isosceles and the similarity proofs too
    circular: 'השתמשו במה שצריך להוכיח כאילו הוא כבר ידוע',
    'wrong-theorem': 'בחרו משפט שלא מתאים לנתונים',
  },
  lesson: {
    points: [
      'במשולש שווה־שוקיים חוצה זווית הראש הוא גם תיכון וגם גובה; ומשולש עם שתי זוויות שוות הוא שווה־שוקיים.',
      'הגדלה כופלת כל צלע באותו מספר: $4 \\to 6$ זה פי $1.5$, ולכן $6 \\to 9$.',
      'שתי זוויות שוות מספיקות לדמיון משולשים (ז.ז).',
      'יחס הדמיון $3$: ההיקף פי $3$, השטח פי $9$.',
    ],
    words: ['שוקיים', 'בסיס', 'זווית הראש', 'משפט הפוך', 'דומים', 'יחס הדמיון', 'ז.ז'],
  },
};
