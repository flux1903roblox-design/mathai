// Challenge tasks of transformations (curriculum stage 4, GEOM-7): transf:c1, a claim that two reflections in the axes
// make a half turn; transf:c2, Noam's quarter turn that only swapped the coordinates; transf:c3, the mosaic wall, where
// the angles that meet at a point make a full turn. Checked by learn/challenges.test.ts and the lane's
// spec/facts-transf.mjs.
import type { ChallengeTask, FigSpec } from '../types';

/** A(3, −2), its reflection in the x-axis A′(3, 2), and that one's in the y-axis A″(−3, 2). */
const TWO_MIRRORS: FigSpec = {
  type: 'coord',
  points: [{ x: 3, y: -2, label: 'A' }, { x: 3, y: 2, label: 'A′' }, { x: -3, y: 2, label: 'A″' }],
  arrows: [{ from: [3, -2], to: [3, 2] }, { from: [3, 2], to: [-3, 2] }],
};
/** A(2, 5) and the centre O, with the clockwise quarter turn. */
const NOAM: FigSpec = { type: 'coord', points: [{ x: 2, y: 5, label: 'A' }], centre: [0, 0], turn: -90 };

export const TRANSF_CHALLENGES: ChallengeTask[] = [
  {
    id: 'transf:c1', topic: 'transf', after: 'transf:3', kind: 'claim', title: 'שני שיקופים או סיבוב?', minutes: 5, fig: TWO_MIRRORS,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?',
        claim: '"שיקוף ביחס לציר ה־$x$ ואחריו שיקוף ביחס לציר ה־$y$ נותנים אותה תמונה כמו סיבוב של $180°$ סביב ראשית הצירים."', verdict: 'always',
        why: 'השיקוף הראשון: $(x, y) \\to (x, -y)$. השני: $(x, -y) \\to (-x, -y)$. וזה בדיוק חצי סיבוב סביב $O$: כל נקודה עוברת לצד השני של $O$, באותו מרחק.' },
      { type: 'num', prompt: 'לאן מגיעה $A(3, -2)$ אחרי שני השיקופים? כתבו את שיעור ה־$x$.', answer: -3, check: '-3',
        solution: ['ביחס לציר ה־$x$: $(3, -2) \\to (3, 2)$.', 'ביחס לציר ה־$y$: $(3, 2) \\to (-3, 2)$. שיעור ה־$x$ הוא $-3$, כמו בחצי סיבוב של $A$.'] },
      { type: 'mc', prompt: 'ומה נותנים שני שיקופים ביחס לאותו ציר, ציר ה־$x$?', choices: [
        { text: 'הנקודה חוזרת למקומה', ok: true, feedback: 'נכון: $(x, y) \\to (x, -y)$, ואז $(x, -y) \\to (x, y)$. השיקוף השני מבטל את הראשון.' },
        { text: 'חצי סיבוב', ok: false, feedback: 'בחצי סיבוב שני השיעורים מחליפים סימן. כאן $y$ החליף סימן פעמיים, וחזר.' },
        { text: 'שיקוף ביחס לציר ה־$y$', ok: false, feedback: 'ציר ה־$y$ לא השתתף: $x$ לא השתנה בכלל.' },
      ] },
    ],
  },
  {
    id: 'transf:c2', topic: 'transf', after: 'transf:3', kind: 'error', title: 'הסיבוב של נועם', minutes: 4, misc: 'rot-swap', fig: NOAM,
    parts: [
      { type: 'error', prompt: 'כך סובב נועם את הנקודה.',
        lines: ['מסובבים את $A(2, 5)$ ב־$90°$ עם כיוון השעון סביב $O(0, 0)$.', 'מחליפים בין השיעורים: $A\'(5, 2)$.', '$A\'$ ברביע הראשון.'], wrong: 1,
        why: 'ברבע סיבוב עם כיוון השעון נקודה מהרביע הראשון עוברת לרביע הרביעי: $(2, 5) \\to (5, -2)$. החלפה בלי שינוי סימן משאירה את הנקודה ברביע הראשון, ולכן זה לא רבע סיבוב.',
        lineWhy: { 0: 'זו רק השאלה. הטעות מתחילה אחריה.', 2: '$(5, 2)$ באמת ברביע הראשון, אבל זו לא הנקודה אחרי הסיבוב. הטעות בשורה שלפניה.' },
        fix: { prompt: 'מה שיעור ה־$y$ של $A\'$?', answer: -2, check: '-2' } },
      { type: 'mc', prompt: 'איך בודקים סיבוב בלי נוסחה?', choices: [
        { text: 'בודקים ש־$OA = OA\'$, שהזווית $\\sphericalangle AOA\'$ ישרה, ושהסיבוב בכיוון הנכון', ok: true, feedback: 'נכון: גם $(-5, 2)$ רחוקה מ־$O$ כמו $A$ ויוצרת זווית ישרה, אבל היא נגד כיוון השעון. הכיוון הוא חלק מהבדיקה.' },
        { text: 'בודקים שהשיעורים התחלפו', ok: false, feedback: '$(5, 2)$ החליפה שיעורים, ונשארה ברביע הראשון. החלפה לבדה היא לא סיבוב.' },
        { text: 'אי אפשר לבדוק', ok: false, feedback: 'אפשר: המרחק מ־$O$ נשמר, הזווית ישרה, והכיוון לפי השעון.' },
      ] },
    ],
  },
  {
    id: 'transf:c3', topic: 'transf', after: 'transf:4', kind: 'literacy', title: 'קיר הפסיפס', minutes: 7,
    story: 'אמנית מרצפת קיר באריחים חופפים. היא בודקת אילו מצולעים משוכללים יכולים לכסות קיר בלי רווחים ובלי חפיפה: אריחים שנפגשים בנקודה אחת צריכים למלא סביבה סיבוב שלם.',
    parts: [
      { type: 'num', prompt: 'זווית של משושה משוכלל היא $120°$. כמה משושים נפגשים בנקודה אחת?', answer: 3, check: '360/120',
        solution: ['סביב נקודה יש סיבוב שלם, $360°$.', '$360 : 120 = 3$ משושים.'] },
      { type: 'mc', prompt: 'אפשר לרצף במחומשים משוכללים, שהזווית שלהם $108°$?', choices: [
        { text: 'לא: $360 : 108$ אינו מספר שלם', ok: true, feedback: 'נכון: שלושה מחומשים הם $324°$, ונשאר רווח של $36°$; ארבעה כבר עולים זה על זה.' },
        { text: 'כן: כל מצולע משוכלל מרצף', ok: false, feedback: 'רק ריבועים, משולשים שווי צלעות ומשושים משוכללים מרצפים לבד: $90$, $60$ ו־$120$ מחלקים את $360$.' },
        { text: 'כן, אם מסובבים אותם', ok: false, feedback: 'סיבוב לא משנה את הזווית: היא נשארת $108°$.' },
      ] },
      { type: 'num', prompt: 'בנקודה אחת נפגשים שני מתומנים משוכללים וריבוע. כמה מעלות זווית של מתומן?', answer: 135, check: '(360-90)/2', unit: 'מעלות',
        solution: ['סביב הנקודה $360°$, והריבוע לוקח $90°$.', '$(360 - 90) : 2 = 135$, כלומר $135°$.'] },
      { type: 'explain', prompt: 'הסבירו למה אריח שהוזז, שוקף או סובב עדיין מתאים לריצוף.',
        rubric: ['אמרתי שהזזה, שיקוף וסיבוב לא משנים אורכים וזוויות', 'קישרתי את הזוויות שסביב נקודה לסיבוב שלם, $360°$'],
        sample: 'תנועה לא משנה את האריח: הצלעות והזוויות נשארות כמו שהיו, ולכן האריח המוזז חופף לראשון. הוא נכנס בדיוק למקום, והזוויות סביב כל נקודה עדיין משלימות $360°$.' },
    ],
  },
];
