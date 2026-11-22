// Congruent triangles (חפיפת משולשים): the ח׳ unit 8.12 of January and February (curriculum stage 4, GEOM-5). Taught in
// the middle of the year, so the first-day placement test skips it (placement: false).
//
// This is the topic object: its name, colour, levels, misconception names and lesson summary, and each level's
// generator. The arithmetic (the diagnostic models, the practice generators, their texts and the two-triangle drawings)
// is content/congr.gen.js; the proof templates and the reason bank are content/proofs.js. None of them is on the first
// load (the boot split): the first screen reads the topic's names from content/topics.gen.js, which
// scripts/gen-content-meta.mjs writes from this object, and the generators load with the topic (content/topics.js
// importGens).
import { CONGR_GENS, CONGR_PROOF_CHECKS } from './congr.gen.js';

export const CONGR = {
  id: 'congr', grade: '8', title: 'חפיפת משולשים', color: 'cobalt',
  desc: 'צלעות וזוויות מתאימות, משפטי החפיפה, הוכחה, תיכון וצלעות במשולש',
  // taught in January and February: the first-day placement test does not ask about it (the jump test does)
  placement: false,
  // the proof stair's mastery check asks whole proofs too (checkProofs, proofGen: content/congr.gen.js)
  levels: ['צלעות וזוויות מתאימות', 'משפטי החפיפה', 'הוכחה בחפיפה', 'תיכון ושטחים', 'צלעות במשולש'].map((title, i) => ({ title, gen: CONGR_GENS[i], ...CONGR_PROOF_CHECKS[i] })),
  cats: {
    'alpha-order': 'התאימו קודקודים לפי סדר האלף־בית, ולא לפי הסדר שבחפיפה',
    'match-by-place': 'התאימו קודקודים לפי המקום בשרטוט, ולא לפי החפיפה',
    'one-angle': 'חיסרו מ־$180°$ רק זווית אחת',
    'wrong-pair': 'השוו חלקים שאינם מתאימים בחפיפה',
    ssa: 'השתמשו בשתי צלעות ובזווית שאינה ביניהן כאילו זה משפט חפיפה',
    aaa: 'חשבו ששלוש זוויות שוות מספיקות לחפיפה',
    'equal-perimeter': 'חשבו שצורות עם אותו היקף הן חופפות',
    circular: 'השתמשו במה שצריך להוכיח כאילו הוא כבר ידוע',
    'wrong-theorem': 'בחרו משפט חפיפה שלא מתאים לנתונים',
    'half-only': 'מצאו את הזווית של משולש אחד, ולא של שני המשולשים יחד',
    'no-half': 'לקחו את כל הזווית במקום חצי ממנה',
    'full-base': 'לקחו את כל הצלע כבסיס של חצי המשולש',
    'median-as-height': 'השתמשו בתיכון כאילו הוא הגובה',
    'full-side': 'חיברו את כל הצלע במקום את החצי שלה',
    'median-congruent': 'חשבו שתיכון מחלק משולש לשני משולשים חופפים',
    'median-altitude': 'בלבלו בין תיכון, גובה וחוצה זווית',
    'sum-equal': 'חשבו שאפשר משולש גם כשסכום שתי צלעות שווה לשלישית',
    'no-lower-limit': 'בדקו רק שהצלע השלישית קצרה מהסכום, ולא שהיא ארוכה מההפרש',
    'ignore-inequality': 'בחרו שוקיים קצרות מדי, שאינן נפגשות',
    'angle-at-side': 'חיפשו את הזווית הגדולה ליד הצלע הגדולה, ולא מולה',
  },
  lesson: {
    points: [
      '$\\triangle ABC \\cong \\triangle KML$: $A$ מתאים ל־$K$, $B$ ל־$M$, $C$ ל־$L$.',
      'משפטי החפיפה: צ.ז.צ, ז.צ.ז, צ.צ.צ. שתי צלעות וזווית שלא ביניהן לא מספיקות.',
      'אם $\\sphericalangle A = 50°$ ו־$\\sphericalangle B = 60°$, הזווית השלישית $70°$.',
      'תיכון מחלק משולש לשני משולשים שווי שטח.',
      'צלעות $12$ ו־$5$: הצלע השלישית בין $7$ ל־$17$.',
    ],
    words: ['משולשים חופפים', 'צלעות מתאימות', 'זוויות מתאימות', 'משפט חפיפה', 'צ.ז.צ', 'ז.צ.ז', 'צ.צ.צ', 'טענה', 'נימוק', 'צלע משותפת', 'תיכון', 'גובה', 'אי־שוויון המשולש'],
  },
};
