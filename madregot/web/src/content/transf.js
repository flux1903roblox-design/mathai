// Transformations (טרנספורמציות): slides, reflections and turns on the grid, and congruent shapes and tilings. The ז׳
// programme's unit 7.11 (November–December) and, in the transition year תשפ״ז, the ח׳ unit 8.5 too (curriculum stage 4,
// GEOM-4). Taught in November, so the first-day placement test skips it (placement: false).
//
// This is the topic object: its name, colour, levels, misconception names and lesson summary, and each level's
// generator. The arithmetic (the diagnostic models, the practice generators, their texts and drawings) is
// content/transf.gen.js. Neither file is on the first load (the boot split): the first screen reads the topic's names
// from content/topics.gen.js, which scripts/gen-content-meta.mjs writes from this object, and the generators load with
// the topic (content/topics.js importGens).
import { TRANSF_GENS } from './transf.gen.js';

export const TRANSF = {
  id: 'transf', grade: '7', title: 'טרנספורמציות', color: 'violet',
  desc: 'הזזה, שיקוף וסיבוב על מערכת הצירים, וצורות חופפות',
  // taught in November and December: the first-day placement test does not ask about it (the jump test does)
  placement: false,
  levels: ['הזזה', 'שיקוף', 'סיבוב', 'צורות חופפות וריצוף'].map((title, i) => ({ title, gen: TRANSF_GENS[i] })),
  cats: {
    'shift-sign': 'הזיזו לכיוון ההפוך באחד הצירים',
    'shift-swap': 'הוסיפו את ההזזה שמאלה־ימינה ל־$y$ ואת ההזזה למעלה־למטה ל־$x$',
    'one-axis': 'הזיזו רק לאורך ציר אחד',
    gap: 'מדדו את הרווח בין הצורות במקום את הדרך מנקודה לתמונה שלה',
    'axis-not-line': 'שיקפו ביחס לציר במקום ביחס לישר שבשאלה',
    'wrong-axis': 'שיקפו ביחס לציר השני',
    'both-signs': 'החליפו את הסימן של שני השיעורים: זה חצי סיבוב, לא שיקוף',
    'diagonal-axis': 'חשבו שאלכסון של מלבן הוא ציר סימטריה שלו',
    'wrong-centre': 'סובבו סביב ראשית הצירים במקום סביב מרכז הסיבוב',
    'reflect-not-turn': 'שיקפו במקום לסובב: רק שיעור אחד השתנה',
    'turn-direction': 'סובבו לכיוון ההפוך',
    'rot-swap': 'החליפו בין השיעורים בלי לשנות סימן',
    'double-perimeter': 'חיברו את שני ההיקפים, וספרו פעמיים את הצלע המשותפת',
    'equal-area': 'חשבו שצורות עם אותו שטח הן חופפות',
    'equal-perimeter': 'חשבו שצורות עם אותו היקף הן חופפות',
  },
  lesson: {
    points: [
      'בהזזה כל נקודה זזה אותו מרחק ובאותו כיוון: $(2, 3)$ שזזה $4$ ימינה ו־$1$ למטה מגיעה ל־$(6, 2)$.',
      'שיקוף ביחס לציר ה־$x$: $(2, 3) \\to (2, -3)$. ביחס לציר ה־$y$: $(2, 3) \\to (-2, 3)$.',
      'חצי סיבוב סביב ראשית הצירים: $(2, 3) \\to (-2, -3)$.',
      'הזזה, שיקוף וסיבוב שומרים על אורכים, זוויות ושטח: הצורה והתמונה שלה חופפות.',
    ],
    words: ['הזזה', 'תמונה', 'שיקוף', 'ישר שיקוף', 'ציר סימטריה', 'סיבוב', 'מרכז הסיבוב', 'עם כיוון השעון', 'נגד כיוון השעון', 'צורות חופפות', 'ריצוף'],
  },
};
