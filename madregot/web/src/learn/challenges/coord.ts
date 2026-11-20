// Challenge tasks of the coordinate plane (curriculum stage 1, CURRICULUM-6.5): coord:c1, a claim about swapping x and y;
// coord:c2, a rectangle's width taken without the sign; coord:c3, food trucks on a schoolyard grid, distances along the
// lines. Their numbers are checked by the lane's verify/facts-challenges17.mjs and by learn/challenges.test.ts.
// PRODUCT2-21 (a task after every stair): coord:c4, after coord:1, a point written with x and y swapped ('swap'), and
// when swapping changes nothing; coord:c5, after coord:5, the proof that the missing vertex takes x from one neighbour
// and y from the other, then that vertex and the rectangle's area.
import type { ChallengeTask, FigSpec } from '../types';

/** The rectangle ABCD of coord:c2 on the grid. */
const RECT_FIG: FigSpec = {
  type: 'coord', range: 4, polygon: [[-2, 1], [3, 1], [3, -3], [-2, -3]],
  points: [{ x: -2, y: 1, label: 'A' }, { x: 3, y: 1, label: 'B' }, { x: 3, y: -3, label: 'C' }, { x: -2, y: -3, label: 'D' }],
};
/** The three trucks of coord:c3: ice cream at A, falafel at B, juice at C. */
const TRUCKS_FIG: FigSpec = {
  type: 'coord', range: 5,
  points: [{ x: -3, y: 2, label: 'A' }, { x: 4, y: 2, label: 'B' }, { x: 4, y: -3, label: 'C' }],
};
/** coord:c4: the point P(−3, −4), three squares left of the y-axis and four below the x-axis. */
const P_FIG: FigSpec = { type: 'coord', range: 5, points: [{ x: -3, y: -4, label: 'P' }] };
/** coord:c5: three vertices of the rectangle ABCD, A(−3, 2), B(4, 2) and D(−3, −4); C(4, −4) is the one to find. */
const ABD_FIG: FigSpec = {
  type: 'coord', range: 5,
  points: [{ x: -3, y: 2, label: 'A' }, { x: 4, y: 2, label: 'B' }, { x: -3, y: -4, label: 'D' }],
};

export const COORD_CHALLENGES: ChallengeTask[] = [
  {
    id: 'coord:c1', topic: 'coord', after: 'coord:2', kind: 'claim', title: 'מחליפים בין $x$ ל־$y$', minutes: 4,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"אם מחליפים בין $x$ ל־$y$, הנקודה נשארת באותו רביע."', verdict: 'sometimes',
        why: '$(2, 5)$ ו־$(5, 2)$ שתיהן ברביע הראשון, ו־$(-1, -4)$ ו־$(-4, -1)$ שתיהן בשלישי. אבל $(-3, 2)$ ברביע השני, ו־$(2, -3)$ ברביע הרביעי.',
        example: {
          ask: 'תנו נקודה שעוברת לרביע אחר.', slots: [{ name: 'x', label: 'שיעור ה־$x$' }, { name: 'y', label: 'שיעור ה־$y$' }],
          domain: 'int', expr: 'x*y', rel: '<', value: 0, hint: 'נסו נקודה ש־$x$ שלה שלילי ו־$y$ שלה חיובי.',
        } },
      { type: 'mc', prompt: 'לאילו נקודות הטענה נכונה?', choices: [
        { text: 'לנקודות ברביע הראשון ובשלישי', ok: true, feedback: 'כן. שם ל־$x$ ול־$y$ יש אותו סימן, ולכן ההחלפה לא משנה את הרביע.' },
        { text: 'לנקודות ברביע השני וברביעי', ok: false, feedback: '$(-3, 2)$ ברביע השני הופכת ל־$(2, -3)$, ברביע הרביעי. כאן הרביע משתנה.' },
        { text: 'לכל הנקודות', ok: false, feedback: '$(-3, 2)$ הופכת ל־$(2, -3)$: הנקודה עברה מהרביע השני לרביעי.' },
      ] },
    ],
  },
  {
    id: 'coord:c2', topic: 'coord', after: 'coord:4', kind: 'error', title: 'הרוחב של המלבן', minutes: 4, fig: RECT_FIG,
    parts: [
      { type: 'error', prompt: 'כך חישב יואב את השטח של המלבן $ABCD$.',
        lines: ['$A(-2, 1)$, $B(3, 1)$, $C(3, -3)$, $D(-2, -3)$', 'רוחב: $3 - 2 = 1$', 'גובה: $1 - (-3) = 4$', 'שטח: $1 \\cdot 4 = 4$'], wrong: 1,
        why: 'הרוחב הוא המרחק מ־$x = -2$ עד $x = 3$. מחסרים את השיעור עם הסימן שלו: $3 - (-2) = 5$. ברשת אפשר לספור $5$ משבצות.',
        lineWhy: { 0: 'אלה רק הקודקודים מהשאלה. הטעות מתחילה אחריהם.', 2: 'מ־$y = -3$ עד $y = 1$ יש $4$ משבצות.', 3: 'הכפל נכון, אבל הוא משתמש ברוחב משורה קודמת. הטעות שם.' },
        fix: { prompt: 'מה השטח של המלבן?', answer: 20, check: '(3-(-2))*(1-(-3))' } },
      { type: 'mc', prompt: 'איך אפשר היה לראות שהרוחב $1$ שגוי?', choices: [
        { text: 'בשרטוט יש $5$ משבצות מ־$A$ עד $B$', ok: true, feedback: 'נכון: סופרים משבצות מ־$-2$ עד $3$, ומקבלים $5$. שרטוט הוא בדיקה טובה לחשבון.' },
        { text: 'רוחב של מלבן גדול מהגובה שלו', ok: false, feedback: 'זה לא כלל: יש מלבנים צרים וגבוהים. כאן הבדיקה היא לספור את המשבצות מ־$A$ עד $B$.' },
        { text: 'אי אפשר לדעת בלי לחשב שוב', ok: false, feedback: 'אפשר: בשרטוט סופרים $5$ משבצות מ־$A$ עד $B$, ולא $1$.' },
      ] },
    ],
  },
  {
    id: 'coord:c3', topic: 'coord', after: 'coord:3', kind: 'literacy', title: 'משאיות אוכל בחצר', minutes: 6, fig: TRUCKS_FIG,
    story: 'בחצר סימנו צירים. כל משבצת היא $1$ מטר, והולכים רק לאורך הקווים. גלידה ב־$A(-3, 2)$, פלאפל ב־$B(4, 2)$, מיץ ב־$C(4, -3)$.',
    parts: [
      { type: 'num', prompt: 'כמה מטרים בין משאית הגלידה למשאית הפלאפל?', answer: 7, check: '4-(-3)', unit: 'מטר',
        solution: ['שתיהן על הקו $y = 2$, אז מודדים רק לאורך $x$.', '$4 - (-3) = 7$ מטר.'] },
      { type: 'num', prompt: 'כמה מטרים בין משאית הפלאפל למשאית המיץ?', answer: 5, check: '2-(-3)', unit: 'מטר',
        solution: ['שתיהן על הקו $x = 4$, אז מודדים רק לאורך $y$.', '$2 - (-3) = 5$ מטר.'] },
      { type: 'num', prompt: 'נועה עומדת בראשית הצירים, $(0, 0)$. כמה מטרים היא הולכת עד משאית המיץ?', answer: 7, check: '4+3', unit: 'מטר',
        solution: ['$4$ מטר ימינה, עד $x = 4$.', 'ועוד $3$ מטר למטה, עד $y = -3$. ביחד $4 + 3 = 7$ מטר.'] },
      { type: 'mc', prompt: 'לאיזו משאית נועה מגיעה בדרך הקצרה ביותר?', choices: [
        { text: 'משאית הגלידה: $3 + 2 = 5$ מטר', ok: true, feedback: 'נכון: $3$ מטר שמאלה ו־$2$ למעלה. לפלאפל $4 + 2 = 6$, ולמיץ $7$.' },
        { text: 'משאית הפלאפל', ok: false, feedback: 'לפלאפל הולכים $4 + 2 = 6$ מטר. לגלידה רק $3 + 2 = 5$.' },
        { text: 'משאית המיץ', ok: false, feedback: 'למיץ הולכים $4 + 3 = 7$ מטר, הדרך הארוכה מהשלוש. לגלידה רק $5$.' },
      ] },
    ],
  },
  {
    id: 'coord:c4', topic: 'coord', after: 'coord:1', kind: 'error', title: 'הנקודה $P$ ברשת', minutes: 5, misc: 'swap', fig: P_FIG,
    parts: [
      { type: 'error', prompt: 'כך כתב ליאור את השיעורים של הנקודה $P$ שבשרטוט.',
        lines: ['$P$ נמצאת $3$ משבצות משמאל לציר ה־$y$.', '$P$ נמצאת $4$ משבצות מתחת לציר ה־$x$.', 'לכן $P = (-4, -3)$.'], wrong: 2,
        why: 'בזוג סדור כותבים קודם את $x$, ימינה או שמאלה, ואחר כך את $y$, למעלה או למטה. $3$ שמאלה הוא $x = -3$, ו־$4$ למטה הוא $y = -4$. לכן $P = (-3, -4)$.',
        lineWhy: { 0: 'בשרטוט $P$ באמת שלוש משבצות משמאל לציר ה־$y$.', 1: 'בשרטוט $P$ באמת ארבע משבצות מתחת לציר ה־$x$.' },
        fix: { prompt: 'מה שיעור ה־$x$ של $P$?', answer: -3, check: '-3' } },
      { type: 'mc', prompt: 'האם $(-4, -3)$ ו־$(-3, -4)$ הן אותה נקודה?', choices: [
        { text: 'לא, הן במקומות שונים ברשת', ok: true, feedback: 'נכון: אל $(-4, -3)$ זזים $4$ שמאלה ו־$3$ למטה, ואל $(-3, -4)$ זזים $3$ שמאלה ו־$4$ למטה. הסדר בזוג קובע את המקום.' },
        { text: 'כן, יש בהן אותם מספרים', ok: false, feedback: 'יש בהן אותם מספרים, אבל בסדר אחר. המספר הראשון הוא $x$, ולכן הן במקומות שונים.' },
        { text: 'כן, כי שתיהן משמאל ולמטה', ok: false, feedback: 'שתיהן משמאל לציר ה־$y$ ומתחת לציר ה־$x$, אבל לא באותו מקום: $3$ שמאלה ו־$4$ למטה זה לא $4$ שמאלה ו־$3$ למטה.' },
      ] },
      { type: 'num', prompt: 'בנקודה $(-3, y)$ מחליפים בין $x$ ל־$y$, ומקבלים את אותה נקודה. מה $y$?', answer: -3, check: '-3',
        solution: ['אחרי ההחלפה הנקודה היא $(y, -3)$.', 'זו אותה נקודה רק אם $y = -3$. הנקודה היא $(-3, -3)$.'] },
    ],
  },
  {
    id: 'coord:c5', topic: 'coord', after: 'coord:5', kind: 'proof', title: 'הקודקוד הרביעי', minutes: 7, fig: ABD_FIG,
    parts: [
      { type: 'order', prompt: 'במלבן $ABCD$ הצלעות מקבילות לצירים, ו־$C$ מול $A$. למה $C = (x_B, y_D)$? סדרו את שלבי ההוכחה.',
        steps: [
          { text: '$C$ שכן של $B$ ושל $D$: גם $BC$ וגם $DC$ הן צלעות של המלבן.' },
          { text: '$BC$ מקבילה לציר ה־$y$, ולכן ל־$C$ אותו $x$ כמו ל־$B$.',
            reason: { choices: ['על קו שמקביל לציר ה־$y$, לכל הנקודות אותו $x$', 'על קו שמקביל לציר ה־$y$, לכל הנקודות אותו $y$', 'לקודקודים שמול זה את זה יש אותו $x$'], answer: 0 } },
          { text: '$DC$ מקבילה לציר ה־$x$, ולכן ל־$C$ אותו $y$ כמו ל־$D$.',
            reason: { choices: ['על קו שמקביל לציר ה־$x$, לכל הנקודות אותו $y$', 'על קו שמקביל לציר ה־$x$, לכל הנקודות אותו $x$', 'לקודקודים שמול זה את זה יש אותו $y$'], answer: 0 } },
          { text: 'לכן $C = (x_B, y_D)$: את $x$ לוקחים משכן אחד, ואת $y$ מהשכן השני.' },
        ],
        // x from B and y from D can be found in either order: the proof holds both ways
        free: [[1, 2]] },
      { type: 'num', prompt: 'בשרטוט $A(-3, 2)$, $B(4, 2)$ ו־$D(-3, -4)$. מה שיעור ה־$x$ של $C$?', answer: 4, check: '4',
        solution: ['$BC$ מקבילה לציר ה־$y$, ולכן ל־$C$ אותו $x$ כמו ל־$B$.', 'שיעור ה־$x$ של $C$ הוא $4$.'] },
      { type: 'num', prompt: 'ומה שיעור ה־$y$ של $C$?', answer: -4, check: '-4',
        solution: ['$DC$ מקבילה לציר ה־$x$, ולכן ל־$C$ אותו $y$ כמו ל־$D$.', 'שיעור ה־$y$ של $C$ הוא $-4$, ולכן $C = (4, -4)$.'] },
      { type: 'num', prompt: 'מה השטח של המלבן $ABCD$?', answer: 42, check: '(4-(-3))*(2-(-4))', unit: 'יחידות שטח',
        solution: ['רוחב: מ־$x = -3$ עד $x = 4$, כלומר $4 - (-3) = 7$. גובה: מ־$y = -4$ עד $y = 2$, כלומר $2 - (-4) = 6$.', 'שטח: $7 \\cdot 6 = 42$ יחידות שטח.'] },
    ],
  },
];
