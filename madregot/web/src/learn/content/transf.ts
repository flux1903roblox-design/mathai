// Transformations (טרנספורמציות): the ז׳ unit 7.11 of November and December, and in the transition year תשפ״ז the ח׳
// unit 8.5 too (curriculum stage 4, GEOM-4). Four stairs: a slide, a reflection, a turn, and congruent shapes with
// tilings. A ז׳ student does on the phone what the class does with tracing paper: slides, flips and turns a shape (the
// transform object, components/manip/Transform.jsx) and reads the image's coordinates on the plane (its still twin, the
// coord figure's shapes, arrows, mirror and centre).
//
// One picture carries the unit: a move takes every point the same way, and keeps every length, angle and area. The
// errors researchers and teachers see are named where they happen and repaired: a shift the wrong way or on the wrong
// axis, a mirror taken for the axis, a turn about the wrong centre or the wrong way, perimeters added like areas. The
// diagnostic models are the stage's (content/transf.gen.js TRANSF1 to TRANSF4T, ported unchanged); every
// misconception's source is listed there. Importing that module also registers the topic's practice generators
// (content/lazyGen.js), so they load with this file and not on the first screen. Every number written here is checked by
// the lane's spec/facts-transf.mjs, and the maths of every step by learn/content.test.ts.
import type { DiagModel, FigSpec, ManipSpec, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as GEN from '@/content/transf.gen.js';

/** The plain-JS module, untyped here: its drawings are checked by learn/figures.test.ts, not by the compiler. */
const G: any = GEN;

// ---------------------------------------------------------------- figures
type Pt = [number, number];
type Shape = { pts: Pt[]; names?: string[]; tone?: 'brand' | 'alt' | 'ghost'; label?: string };
const ABC = ['A', 'B', 'C'];
const ABC2 = ['A′', 'B′', 'C′'];
/** A coordinate plane with shapes and more (points, arrows, a mirror, a centre and its turn). */
const plane = (more: Record<string, unknown>): FigSpec => ({ type: 'coord', ...more } as FigSpec);
const pt = (x: number, y: number, label: string) => ({ x, y, label });
const tri = (pts: Pt[], names = ABC, tone?: Shape['tone']): Shape => ({ pts, names, ...(tone ? { tone } : {}) });
const arrowsOf = (from: Pt[], to: Pt[]) => from.map((p, i) => ({ from: p, to: to[i] }));
/** The transform object. */
const tf = (pts: Pt[], moves: Record<string, unknown>, more: Record<string, unknown> = {}): ManipSpec => ({ kind: 'transform', shape: { pts, names: ABC }, moves, ...more });
/** A rectangle w by h at (x0, 0) as geo points. */
const rect = (prefix: string, x0: number, w: number, h: number): Record<string, Pt> => ({ [`${prefix}1`]: [x0, 0], [`${prefix}2`]: [x0 + w, 0], [`${prefix}3`]: [x0 + w, h], [`${prefix}4`]: [x0, h] });
/** Two rectangles side by side, each side labelled with its length. */
function twoRects(label: string, [w1, h1]: [number, number], [w2, h2]: [number, number]): FigSpec {
  return {
    type: 'geo', label,
    pts: { ...rect('_a', 0, w1, h1), ...rect('_b', w1 + 1.5, w2, h2) },
    polys: [{ pts: ['_a1', '_a2', '_a3', '_a4'] }, { pts: ['_b1', '_b2', '_b3', '_b4'] }],
    segs: [{ a: '_a1', b: '_a2', label: String(w1) }, { a: '_a2', b: '_a3', label: String(h1) }, { a: '_b1', b: '_b2', label: String(w2) }, { a: '_b2', b: '_b3', label: String(h2) }],
    view: [320, 170], pad: [28, 26],
  };
}
/** A rectangle w by h with one diagonal dashed (labelled sides). */
function rectDiagonal(label: string, w: number, h: number, sides = true): FigSpec {
  return {
    type: 'geo', label,
    pts: rect('_r', 0, w, h),
    polys: [{ pts: ['_r1', '_r2', '_r3', '_r4'] }],
    segs: [{ a: '_r1', b: '_r3', dash: true }, ...(sides ? [{ a: '_r1', b: '_r2', label: String(w) }, { a: '_r2', b: '_r3', label: String(h) }] : [])],
    view: [300, 180], pad: [30, 26],
  };
}

// stair 1: the slide of the opening step, 5 right and 2 down
const S1_ABC: Pt[] = [[-4, 1], [-1, 1], [-4, 3]];
const S1_IMG: Pt[] = [[1, -1], [4, -1], [1, 1]];
const slideFig = (anim = false): FigSpec => plane({ shapes: [tri(S1_ABC), tri(S1_IMG, ABC2, 'alt')], arrows: arrowsOf(S1_ABC, S1_IMG), ...(anim ? { anim: true } : {}) });
// stair 1, step 2: PQR, and P moved to P′(3, 4)
const PQR: Pt[] = [[1, 1], [4, 1], [1, 3]];
const PQR_IMG: Pt[] = [[3, 4], [6, 4], [3, 6]];
const pqrFig = (all: boolean): FigSpec => plane({
  shapes: [tri(PQR, ['P', 'Q', 'R']), ...(all ? [tri(PQR_IMG, ['P′', 'Q′', 'R′'], 'alt')] : [])],
  ...(all ? { arrows: arrowsOf(PQR, PQR_IMG) } : { points: [pt(3, 4, 'P′')], arrows: [{ from: [1, 1], to: [3, 4] }] }),
});
// stair 1, step 5: a square with side 2 and its image 5 to the right (the gap between them is 3)
const SQ: Pt[] = [[-4, 1], [-2, 1], [-2, 3], [-4, 3]];
const SQ_IMG: Pt[] = [[1, 1], [3, 1], [3, 3], [1, 3]];
const squaresFig = (arrow: boolean): FigSpec => plane({
  shapes: [{ pts: SQ }, { pts: SQ_IMG, tone: 'alt' }],
  points: [pt(-4, 1, 'A'), pt(1, 1, 'A′')],
  ...(arrow ? { arrows: [{ from: [-4, 1], to: [1, 1], label: '5' }] } : {}),
});

// ================================================================ stair 1: a slide

type P1 = { a1: number; a2: number; dx: number; dy: number; c1: number; c2: number; ask: 'x' | 'y' };
const transf1: DiagModel<P1> = {
  params: (rnd) => G.TRANSF1.params(rnd),
  text: (p) => G.transf1Text(p),
  fig: (p) => G.transf1Fig(p),
  answer: (p) => G.TRANSF1.answer(p),
  bugs: G.TRANSF1.bugs,
  solution: (p) => G.transf1Solution(p),
  hint: () => G.transf1Hint(),
};
type P1T = { p1: number; p2: number; dx: number; dy: number; ask: 'x' | 'y' };
const transf1T: DiagModel<P1T> = {
  params: (rnd) => G.TRANSF1T.params(rnd),
  text: (p) => G.transf1TText(p),
  fig: (p) => plane({ points: [pt(p.p1, p.p2, 'חללית')] }),
  answer: (p) => G.TRANSF1T.answer(p),
  bugs: G.TRANSF1T.bugs,
  solution: (p) => G.transf1TSolution(p),
  hint: (p) => G.transf1THint(p),
};

const stair1: StairContent = {
  skill: 'transf:1', topic: 'transf', level: 1, title: 'הזזה',
  objectives: [
    'להזיז צורה על מערכת הצירים: כל נקודה זזה אותו מרחק ובאותו כיוון.',
    'למצוא את שיעורי התמונה אחרי הזזה, ולמצוא את ההזזה מנקודה ומהתמונה שלה.',
    'לדעת שהזזה שומרת על אורכים, זוויות ושטח.',
  ],
  idea: 'בהזזה כל נקודה של הצורה זזה אותו מרחק ובאותו כיוון, ולכן מוסיפים לכל $x$ אותו מספר ולכל $y$ אותו מספר.',
  why: [
    'כל הנקודות זזות יחד, ולכן הצורה לא משתנה: רק המקום שלה.',
    'הזזה מודדים מנקודה לתמונה שלה, כי זו הדרך שכל נקודה עשתה. הרווח בין הצורות תלוי בגודל שלהן.',
  ],
  alt: ['כמו ספר שמחליקים על שולחן בלי לסובב: כל פינה שלו עוברת אותה דרך.'],
  discover: [
    { kind: 'say', text: 'הזזה: כל נקודה של הצורה זזה אותו מרחק ובאותו כיוון. כאן כל נקודה זזה $5$ ימינה ו־$2$ למטה.', fig: slideFig(true) },
    { kind: 'predict', text: 'המשולש הוזז כך ש־$P$ עברה ל־$P\'$. איפה $Q\'$?', fig: pqrFig(false),
      choices: ['$(6, 4)$', '$(4, 4)$', '$(7, 3)$'], answer: 0,
      why: 'מ־$P$ ל־$P\'$: $2$ ימינה ו־$3$ למעלה. אותו דבר ל־$Q(4, 1)$: $(4 + 2, 1 + 3) = (6, 4)$.',
      wrongWhy: { 1: 'הזזתם רק למעלה. כל נקודה זזה גם $2$ ימינה.', 2: 'החלפתם: $3$ ימינה ו־$2$ למעלה. מ־$P$ ל־$P\'$ זזים $2$ ימינה ו־$3$ למעלה.' } },
    { kind: 'rule', text: 'בהזזה מוסיפים לכל שיעור $x$ אותו מספר, ולכל שיעור $y$ אותו מספר. ימינה ולמעלה מוסיפים, שמאלה ולמטה מחסירים.',
      display: '(x,\\ y) \\to (x + 2,\\ y + 3)', why: 'ההזזה היא אותה הזזה לכל נקודה, ולכן מספיק למצוא אותה פעם אחת.', fig: pqrFig(true) },
    { kind: 'explore', text: 'הזיזו את המשולש $4$ ימינה ו־$1$ למעלה.',
      manip: tf([[-3, -2], [0, -2], [-3, 1]], { drag: true }), answer: { pts: [[1, -1], [4, -1], [1, 2]] },
      hint: 'כל לחיצה על חץ מזיזה משבצת אחת. ארבע ימינה, ואחת למעלה.',
      success: 'כל קודקוד זז $4$ ימינה ו־$1$ למעלה: $A(-3, -2) \\to A\'(1, -1)$.' },
    { kind: 'predict', text: 'הריבוע הוזז ימינה. כמה יחידות?', fig: squaresFig(false),
      choices: ['$5$', '$3$', '$2$'], answer: 0,
      why: '$A(-4, 1)$ עברה ל־$A\'(1, 1)$: $5$ יחידות. מודדים מנקודה לתמונה שלה.',
      wrongWhy: { 1: '$3$ הוא הרווח בין הריבועים. כל נקודה עשתה דרך של $5$.', 2: '$2$ הוא אורך הצלע.' } },
    { kind: 'rule', text: 'מודדים הזזה מנקודה לתמונה שלה, למשל מ־$A$ ל־$A\'$, ולא את הרווח בין הצורות.',
      why: 'הרווח בין הצורות תלוי בגודל הצורה, וההזזה לא.', fig: squaresFig(true) },
    { kind: 'predict', text: 'אחרי ההזזה, מה קרה לאורך $AB$ ולזווית ב־$A$?', fig: slideFig(),
      choices: ['שניהם כמו שהיו', 'האורך השתנה', 'הזווית השתנתה'], answer: 0,
      why: '$AB = 3$ וגם $A\'B\' = 3$, והזווית ב־$A$ ישרה גם אחרי ההזזה. הזזה לא משנה אורכים, זוויות ושטח.' },
    { kind: 'explore', text: 'בהזזה $A(-5, 0)$ עוברת ל־$A\'(-1, -3)$. הזיזו את כל המשולש באותה הזזה.',
      manip: tf([[-5, 0], [-2, 0], [-2, 2]], { drag: true }), answer: { pts: [[-1, -3], [2, -3], [2, -1]] },
      hint: 'מ־$A$ ל־$A\'$: כמה ימינה, וכמה למטה?',
      success: 'כל קודקוד זז $4$ ימינה ו־$3$ למטה, בדיוק כמו $A$.' },
  ],
  examples: [
    { problem: 'המשולש $ABC$, עם $A(-2, 1)$, $B(1, 1)$ ו־$C(-2, 4)$, מוזז $5$ ימינה ו־$3$ למטה. מה שיעור ה־$y$ של $C\'$?',
      fig: plane({ shapes: [tri([[-2, 1], [1, 1], [-2, 4]])] }), answer: 1, check: '4-3',
      steps: [
        { action: 'כותבים את ההזזה.', why: 'ימינה מוסיפים ל־$x$, למטה מחסירים מ־$y$.', result: '(x,\\ y) \\to (x + 5,\\ y - 3)' },
        { action: 'מציבים את $C$: קודם ה־$x$.', why: 'ל־$x$ של $C$ מוסיפים $5$.', result: 'x = -2 + 5 = 3', calc: { expr: '-2+5', value: 3 } },
        { action: 'ועכשיו ה־$y$.', why: 'מ־$y$ של $C$ מחסירים $3$, ולכן $C\'(3, 1)$.', result: 'y = 4 - 3 = 1', value: '4-3' },
      ] },
    { problem: 'בהזזה $A(3, -1)$ עברה ל־$A\'(-1, 2)$. לאן עוברת $B(5, 2)$? כתבו את שיעור ה־$x$.',
      fig: plane({ points: [pt(3, -1, 'A'), pt(-1, 2, 'A′'), pt(5, 2, 'B')], arrows: [{ from: [3, -1], to: [-1, 2] }] }), answer: 1, check: '5+(-1-3)',
      steps: [
        { action: 'מוצאים את ההזזה ב־$x$.', why: 'מ־$3$ ל־$-1$: מה שהתווסף ל־$x$.', result: '-1 - 3 = -4', calc: { expr: '-1-3', value: -4 } },
        { action: 'מוצאים את ההזזה ב־$y$.', why: 'מ־$-1$ ל־$2$.', result: '2 - (-1) = 3', calc: { expr: '2-(-1)', value: 3 } },
        { action: 'מוסיפים את אותה הזזה ל־$B$.', why: 'כל נקודה זזה אותה הזזה.', result: "B'(5 - 4,\\ 2 + 3) = B'(1, 5)", value: '5-4' },
      ] },
  ],
  together: [
    { problem: 'הנקודה $P(-3, 2)$ מוזזת $4$ ימינה ו־$5$ למטה. מה שיעור ה־$y$ של $P\'$?', fig: plane({ points: [pt(-3, 2, 'P')] }),
      steps: [
        { prompt: 'מה עושים ל־$y$?', choices: [
          { text: 'מחסירים $5$', ok: true, feedback: 'למטה מחסירים: $2 - 5$.' },
          { text: 'מוסיפים $5$', ok: false, feedback: 'למטה מחסירים: $y$ קטן.' },
          { text: 'מוסיפים $4$', ok: false, feedback: '$4$ היא ההזזה ימינה, והיא שייכת ל־$x$.' },
        ], hints: ['לאן הנקודה זזה לאורך ציר $y$?', '$2 - 5$.'], done: 'מחסירים $5$ מ־$y$.' },
      ],
      final: { prompt: 'מה שיעור ה־$y$ של $P\'$?', answer: -3, check: '2-5', hints: ['$y$ של $P$ הוא $2$.', '$2 - 5$.'] } },
    { problem: 'בהזזה $A(1, 1)$ עוברת ל־$A\'(4, -1)$. לאן עוברת $B(-2, 3)$? כתבו את שיעור ה־$x$.',
      fig: plane({ points: [pt(1, 1, 'A'), pt(4, -1, 'A′'), pt(-2, 3, 'B')], arrows: [{ from: [1, 1], to: [4, -1] }] }),
      steps: [
        { prompt: 'מה ההזזה?', choices: [
          { text: '$3$ ימינה ו־$2$ למטה', ok: true, feedback: 'נכון: מ־$1$ ל־$4$ ימינה $3$, ומ־$1$ ל־$-1$ למטה $2$.' },
          { text: '$2$ ימינה ו־$3$ למטה', ok: false, feedback: 'החלפתם בין הכיוונים: מ־$1$ ל־$4$ זה $3$.' },
          { text: '$3$ שמאלה ו־$2$ למעלה', ok: false, feedback: 'זו ההזזה ההפוכה, מ־$A\'$ ל־$A$.' },
        ], hints: ['כמה זזים מ־$x = 1$ ל־$x = 4$?', '$4 - 1 = 3$ ימינה.'], done: 'ההזזה: $3$ ימינה ו־$2$ למטה.' },
      ],
      final: { prompt: 'מה שיעור ה־$x$ של $B\'$?', answer: 1, check: '-2+3', hints: ['ל־$x$ של $B$ מוסיפים $3$.', '$-2 + 3$.'] } },
  ],
  diag: transf1,
  transfer: transf1T,
  words: ['הזזה', 'תמונה', 'כיוון', 'מרחק'],
  misconceptions: [
    { id: 'shift-sign', title: 'הזיזו לכיוון ההפוך באחד הצירים',
      cause: '"למטה" ו"שמאלה" הם חיסור, ובקלות מוסיפים במקום להחסיר.',
      explain: ['ימינה ולמעלה השיעור גדל, שמאלה ולמטה הוא קטן.', '$(2, 3)$ שזזה $4$ שמאלה מגיעה ל־$x = 2 - 4 = -2$.'],
      prereq: 'coord:2',
      remedy: [
        { kind: 'predict', text: '$(2, 3)$ זזה $4$ שמאלה. מה $x$?', fig: plane({ points: [pt(2, 3, 'P')] }),
          choices: ['$-2$', '$6$'], answer: 0, why: 'שמאלה $x$ קטן: $2 - 4 = -2$.', wrongWhy: { 1: '$6$ הוא $4$ ימינה. שמאלה מחסירים.' } },
        { kind: 'explore', text: 'הזיזו את המשולש $3$ שמאלה ו־$2$ למטה.',
          manip: tf([[1, 1], [4, 1], [1, 3]], { drag: true }), answer: { pts: [[-2, -1], [1, -1], [-2, 1]] },
          hint: 'שמאלה ולמטה: החצים שמאלה ולמטה.', success: 'כל $x$ קטן ב־$3$, וכל $y$ קטן ב־$2$.' },
      ] },
    { id: 'shift-swap', title: 'הוסיפו את ההזזה שמאלה־ימינה ל־$y$ ואת ההזזה למעלה־למטה ל־$x$',
      cause: 'שני המספרים של ההזזה נכתבים יחד, וקל לחבר כל אחד לשיעור הלא נכון.',
      explain: ['ההזזה ימינה־שמאלה שייכת ל־$x$, ההזזה למעלה־למטה ל־$y$.'],
      remedy: [
        { kind: 'predict', text: '$3$ ימינה ו־$1$ למעלה: $(0, 0) \\to ?$', fig: plane({ path: [[0, 0], [3, 0], [3, 1]] }),
          choices: ['$(3, 1)$', '$(1, 3)$'], answer: 0, why: 'ימינה זה $x$, למעלה זה $y$: $(3, 1)$.', wrongWhy: { 1: 'זה $1$ ימינה ו־$3$ למעלה.' } },
        { kind: 'explore', text: 'הזיזו את המשולש $1$ ימינה ו־$4$ למעלה.',
          manip: tf([[-2, -4], [1, -4], [-2, -2]], { drag: true }), answer: { pts: [[-1, 0], [2, 0], [-1, 2]] },
          hint: 'משבצת אחת ימינה, וארבע למעלה.', success: 'ה־$x$ גדל ב־$1$, וה־$y$ גדל ב־$4$.' },
      ] },
    { id: 'one-axis', title: 'הזיזו רק לאורך ציר אחד',
      cause: 'הזזה באלכסון נראית כמו "זזה ימינה", ושוכחים את הירידה.',
      explain: ['כל הזזה היא שני צעדים: לאורך ציר $x$ ולאורך ציר $y$.'],
      remedy: [
        { kind: 'predict', text: 'המשולש הוזז כך ש־$P$ עברה ל־$P\'$. איפה $Q\'$?', fig: pqrFig(false),
          choices: ['$(6, 4)$', '$(6, 1)$'], answer: 0, why: 'מ־$P$ ל־$P\'$: $2$ ימינה וגם $3$ למעלה: $(6, 4)$.', wrongWhy: { 1: 'הזזתם רק ימינה. כל נקודה זזה גם $3$ למעלה.' } },
        { kind: 'explore', text: 'בהזזה $A(-5, 0)$ עוברת ל־$A\'(-1, -3)$. הזיזו את כל המשולש באותה הזזה.',
          manip: tf([[-5, 0], [-2, 0], [-2, 2]], { drag: true }), answer: { pts: [[-1, -3], [2, -3], [2, -1]] },
          hint: '$4$ ימינה, וגם $3$ למטה.', success: 'שני צעדים: $4$ ימינה ו־$3$ למטה.' },
      ] },
    { id: 'gap', title: 'מדדו את הרווח בין הצורות במקום את הדרך מנקודה לתמונה שלה',
      cause: 'רואים את שתי הצורות, ומודדים את המרחק ביניהן.',
      explain: ['ההזזה היא הדרך שכל נקודה עשתה: מ־$A$ ל־$A\'$.', 'הרווח בין הצורות קטן ממנה בגודל של הצורה.'],
      remedy: [
        { kind: 'predict', text: 'הריבוע הוזז ימינה. כמה יחידות?', fig: squaresFig(false), choices: ['$5$', '$3$'], answer: 0,
          why: 'מ־$A$ ל־$A\'$: $5$. הרווח בין הריבועים, $3$, לא סופר את הצלע של הריבוע.' },
        { kind: 'rule', text: 'מודדים הזזה מנקודה לתמונה שלה, למשל מ־$A$ ל־$A\'$, ולא את הרווח בין הצורות.',
          why: 'הרווח בין הצורות תלוי בגודל הצורה, וההזזה לא.', fig: squaresFig(true) },
      ] },
  ],
};

// ================================================================ stair 2: a reflection

type P2 = { t: 0 | 1; k: number; a: number; b: number };
const transf2: DiagModel<P2> = {
  params: (rnd) => G.TRANSF2.params(rnd),
  text: (p) => G.transf2Text(p),
  fig: (p) => G.transf2Fig(p),
  answer: (p) => G.TRANSF2.answer(p),
  bugs: G.TRANSF2.bugs,
  solution: (p) => G.transf2Solution(p),
  hint: () => G.transf2Hint(),
};
const transf2T: DiagModel<P2> = {
  params: (rnd) => G.TRANSF2T.params(rnd),
  text: (p) => G.transf2TText(p),
  fig: (p) => plane({ points: [pt(p.a, p.b, 'מנורה')], mirror: { x: p.k } }),
  answer: (p) => G.TRANSF2T.answer(p),
  bugs: G.TRANSF2T.bugs,
  solution: (p) => G.transf2TSolution(p),
  hint: () => 'המנורה שבמראה רחוקה מהמראה כמו המנורה עצמה, אבל מהצד השני.',
};
const S2_ABC: Pt[] = [[2, 1], [5, 1], [2, 3]];
const S2_IMG: Pt[] = [[-2, 1], [-5, 1], [-2, 3]];
const L_SHAPE: Pt[] = [[1, 0], [4, 0], [4, 1], [2, 1], [2, 3], [1, 3]];
const reflectP = (anim = false): FigSpec => plane({ points: [pt(4, 1, 'P')], mirror: { x: 2 }, ...(anim ? { anim: true } : {}) });
const rectangleDiag = rectDiagonal('מלבן 6 על 3 והאלכסון שלו, מקווקו', 6, 3);

const stair2: StairContent = {
  skill: 'transf:2', topic: 'transf', level: 2, title: 'שיקוף',
  objectives: [
    'לשקף נקודה וצורה ביחס לציר $x$, לציר $y$ ולישר אנכי או אופקי על הרשת.',
    'לדעת שנקודה ותמונתה באותו מרחק מישר השיקוף, משני צדדיו, ושהשיקוף הופך את כיוון הצורה.',
    'למצוא צירי סימטריה של צורה.',
  ],
  idea: 'בשיקוף כל נקודה עוברת לצד השני של ישר השיקוף, באותו מרחק ממנו, על ישר המאונך לו.',
  why: [
    'השיעור שמודד את המרחק מהציר מחליף סימן, והשיעור השני לא זז: $(3, 2) \\to (3, -2)$ ביחס לציר ה־$x$.',
    'ישר השיקוף הוא האמצע בין נקודה לתמונה שלה, ולכן מודדים את המרחק אליו והולכים אותו מרחק לצד השני.',
  ],
  alt: ['מקפלים את הדף לאורך ישר השיקוף: הנקודה נוחתת בדיוק על התמונה שלה.'],
  discover: [
    { kind: 'say', text: 'שיקוף הוא תמונת מראה ביחס לישר. כל נקודה עוברת לצד השני של הישר, באותו מרחק ממנו.',
      fig: plane({ shapes: [tri(S2_ABC), tri(S2_IMG, ABC2, 'alt')], mirror: 'y', anim: true }) },
    { kind: 'predict', text: 'שקפו את $A(3, 2)$ ביחס לציר ה־$x$. איפה $A\'$?', fig: plane({ points: [pt(3, 2, 'A')], mirror: 'x' }),
      choices: ['$(3, -2)$', '$(-3, 2)$', '$(-3, -2)$'], answer: 0,
      why: 'ציר ה־$x$ אופקי. $A$ נמצאת $2$ מעליו, ולכן $A\'$ נמצאת $2$ מתחתיו: $(3, -2)$.',
      wrongWhy: { 1: 'זה שיקוף ביחס לציר ה־$y$, הציר האנכי.', 2: 'שיניתם את שני הסימנים: זה חצי סיבוב, לא שיקוף.' } },
    { kind: 'rule', text: 'שיקוף ביחס לציר ה־$x$: $(x, y) \\to (x, -y)$. שיקוף ביחס לציר ה־$y$: $(x, y) \\to (-x, y)$.',
      why: 'הנקודה עוברת לצד השני של הציר: השיעור שמודד את המרחק מהציר מחליף סימן.',
      fig: plane({ points: [pt(3, 2, 'A'), pt(3, -2, '(3, −2)'), pt(-3, 2, '(−3, 2)')], arrows: [{ from: [3, 2], to: [3, -2] }, { from: [3, 2], to: [-3, 2] }] }) },
    { kind: 'explore', text: 'שקפו את המשולש ביחס לציר ה־$y$.',
      manip: tf([[1, 1], [3, 1], [1, 4]], { flips: ['y', 'x'] }), answer: { pts: [[-1, 1], [-3, 1], [-1, 4]] },
      hint: 'לחצו על "שיקוף ביחס לציר $y$". הזזה לא תעזור: היא לא הופכת את הצורה.',
      success: 'כל $x$ החליף סימן, וכל $y$ נשאר. והאותיות? הן רצות עכשיו בכיוון השני.' },
    { kind: 'predict', text: 'שקפו את $P(4, 1)$ ביחס לישר $x = 2$. איפה $P\'$?', fig: reflectP(),
      choices: ['$(0, 1)$', '$(-4, 1)$', '$(4, 3)$'], answer: 0,
      why: '$P$ נמצאת $2$ ימינה מהישר $x = 2$, ולכן $P\'$ נמצאת $2$ שמאלה ממנו: $x = 0$.',
      wrongWhy: { 1: 'שיקפתם ביחס לציר ה־$y$. כאן ישר השיקוף הוא $x = 2$.', 2: 'שיקפתם ביחס לישר אופקי, $y = 2$.' } },
    { kind: 'rule', text: 'בשיקוף ביחס לישר: מודדים את המרחק של הנקודה מהישר, והולכים אותו מרחק לצד השני, בניצב לישר.',
      display: "x = 2:\\quad P(4, 1) \\to P'(0, 1)", why: 'הישר הוא האמצע בין הנקודה לתמונה שלה.',
      fig: plane({ points: [pt(4, 1, 'P'), pt(0, 1, 'P′')], mirror: { x: 2 }, segments: [[[0, 1], [4, 1]]], words: [{ at: [3, 1.7], text: '2' }, { at: [1, 1.7], text: '2' }] }) },
    { kind: 'predict', text: 'אחרי שיקוף, הצורה "מסתכלת" לאותו צד?',
      fig: plane({ shapes: [{ pts: L_SHAPE }, { pts: L_SHAPE.map(([x, y]) => [-x, y] as Pt), tone: 'alt' }], mirror: 'y' }),
      choices: ['לא, היא הפוכה, כמו במראה', 'כן, כמו בהזזה'], answer: 0,
      why: 'שיקוף הופך את הכיוון: מה שהיה מימין עובר לשמאל. בהזזה ובסיבוב הצורה לא מתהפכת.' },
    { kind: 'predict', text: 'האלכסון של המלבן הוא ציר סימטריה שלו?', fig: rectangleDiag,
      choices: ['לא', 'כן'], answer: 0,
      why: 'אם מקפלים לאורך האלכסון, החלקים לא נופלים זה על זה. למלבן שני צירי סימטריה: הישרים דרך אמצעי הצלעות.',
      wrongWhy: { 1: 'האלכסון מחלק את המלבן לשני חלקים שווים, אבל שיקוף של אחד לא נופל על השני.' } },
  ],
  examples: [
    { problem: 'שקפו את $A(-4, 3)$ ביחס לציר ה־$y$. מה שיעור ה־$x$ של $A\'$?', fig: plane({ points: [pt(-4, 3, 'A')], mirror: 'y' }), answer: 4, check: '-(-4)',
      steps: [
        { action: 'ציר ה־$y$ אנכי: משתנה $x$.', why: 'הנקודה עוברת ימינה, לצד השני של הציר, ו־$y$ נשאר.', result: '(x,\\ y) \\to (-x,\\ y)' },
        { action: 'מחליפים את הסימן של $x$.', why: 'הנקודה $4$ משמאל לציר, והתמונה $4$ מימינו.', result: 'x = -(-4) = 4', value: '-(-4)' },
        { action: 'כותבים את התמונה.', why: '$y$ לא משתנה.', result: "A'(4, 3)" },
      ] },
    { problem: 'שקפו את $B(1, -2)$ ביחס לישר $y = 1$. מה שיעור ה־$y$ של $B\'$?', fig: plane({ points: [pt(1, -2, 'B')], mirror: { y: 1 } }), answer: 4, check: '2*1-(-2)',
      steps: [
        { action: 'מודדים את המרחק מהישר.', why: 'מ־$y = -2$ עד $y = 1$.', result: '1 - (-2) = 3', calc: { expr: '1-(-2)', value: 3 } },
        { action: 'הולכים $3$ מעל הישר.', why: '$B$ מתחת לישר, ולכן התמונה מעליו, באותו מרחק.', result: 'y = 1 + 3 = 4', value: '1+3' },
        { action: 'כותבים את התמונה.', why: '$x$ לא משתנה: הישר אופקי.', result: "B'(1, 4)" },
      ] },
  ],
  together: [
    { problem: 'שקפו את $C(-2, -5)$ ביחס לציר ה־$x$. מה שיעור ה־$y$ של $C\'$?', fig: plane({ points: [pt(-2, -5, 'C')], mirror: 'x' }),
      steps: [
        { prompt: 'איזה שיעור משתנה?', choices: [
          { text: 'שיעור ה־$y$', ok: true, feedback: 'נכון: הנקודה קופצת מעל הציר, ולכן $y$ מחליף סימן.' },
          { text: 'שיעור ה־$x$', ok: false, feedback: 'ציר ה־$x$ אופקי: הנקודה עוברת למעלה או למטה, ולכן משתנה $y$.' },
          { text: 'שניהם', ok: false, feedback: 'זה כבר חצי סיבוב.' },
        ], hints: ['ציר ה־$x$ שוכב. לאן "קופצים" מעליו?', '$y$ מחליף סימן.'], done: 'משתנה רק $y$.' },
      ],
      final: { prompt: 'מה שיעור ה־$y$ של $C\'$?', answer: 5, check: '-(-5)', hints: ['$C$ נמצאת $5$ מתחת לציר.', '$-(-5)$.'] } },
    { problem: 'שקפו את $D(5, 2)$ ביחס לישר $x = 3$. מה שיעור ה־$x$ של $D\'$?', fig: plane({ points: [pt(5, 2, 'D')], mirror: { x: 3 } }),
      steps: [
        { prompt: 'כמה $D$ רחוקה מהישר?', choices: [
          { text: '$2$', ok: true, feedback: 'נכון: מ־$x = 5$ עד $x = 3$.' },
          { text: '$5$', ok: false, feedback: '$5$ הוא המרחק מציר ה־$y$.' },
          { text: '$3$', ok: false, feedback: '$3$ הוא המקום של הישר, לא המרחק ממנו.' },
        ], hints: ['מ־$x = 5$ עד $x = 3$.', '$2$ ימינה מהישר, אז $2$ שמאלה ממנו.'], done: '$D$ רחוקה $2$ מהישר.' },
      ],
      final: { prompt: 'מה שיעור ה־$x$ של $D\'$?', answer: 1, check: '3-(5-3)', hints: ['$2$ שמאלה מהישר $x = 3$.', '$3 - 2$.'] } },
  ],
  diag: transf2,
  transfer: transf2T,
  words: ['שיקוף', 'ישר שיקוף', 'ציר סימטריה', 'תמונת מראה', 'ניצב'],
  misconceptions: [
    { id: 'axis-not-line', title: 'שיקפו ביחס לציר במקום ביחס לישר שבשאלה',
      cause: 'ציר ה־$y$ הוא ישר השיקוף המוכר, והוא נבחר גם כשהשאלה אומרת $x = 2$.',
      explain: ['מודדים את המרחק מהישר שבשאלה, לא מהציר.', '$P(4, 1)$ רחוקה $2$ מהישר $x = 2$, ולכן $P\'(0, 1)$.'],
      remedy: [
        { kind: 'predict', text: 'שקפו את $P(4, 1)$ ביחס לישר $x = 2$. איפה $P\'$?', fig: reflectP(), choices: ['$(0, 1)$', '$(-4, 1)$'], answer: 0,
          why: '$2$ ימינה מהישר, ולכן $2$ שמאלה ממנו: $x = 0$.', wrongWhy: { 1: 'זה שיקוף ביחס לציר ה־$y$.' } },
        { kind: 'explore', text: 'שקפו את המשולש ביחס לישר $x = -1$.',
          manip: tf([[1, 1], [3, 1], [1, 3]], { flips: [{ x: -1 }] }), answer: { pts: [[-3, 1], [-5, 1], [-3, 3]] },
          hint: 'לחצו על כפתור השיקוף בישר $x = -1$.', success: 'כל קודקוד עבר לצד השני של הישר $x = -1$, באותו מרחק ממנו.' },
      ] },
    { id: 'wrong-axis', title: 'שיקפו ביחס לציר השני',
      cause: '"ביחס לציר ה־$x$" נשמע כמו "השיעור $x$ משתנה", אבל ציר ה־$x$ שוכב, והנקודה קופצת מעליו למטה.',
      explain: ['ביחס לציר ה־$x$ (האופקי) משתנה $y$; ביחס לציר ה־$y$ (האנכי) משתנה $x$.'],
      remedy: [
        { kind: 'predict', text: 'שקפו את $A(3, 2)$ ביחס לציר ה־$x$. איפה $A\'$?', fig: plane({ points: [pt(3, 2, 'A')], mirror: 'x' }),
          choices: ['$(3, -2)$', '$(-3, 2)$'], answer: 0, why: 'הנקודה קופצת מעל הציר האופקי: $y$ מחליף סימן.' },
        { kind: 'explore', text: 'שקפו את המשולש ביחס לציר ה־$x$.',
          manip: tf([[1, 1], [3, 1], [1, 4]], { flips: ['x', 'y'] }), answer: { pts: [[1, -1], [3, -1], [1, -4]] },
          hint: 'ציר ה־$x$ הוא הציר השוכב.', success: 'כל $y$ החליף סימן, וכל $x$ נשאר.' },
      ] },
    { id: 'both-signs', title: 'החליפו את הסימן של שני השיעורים: זה חצי סיבוב, לא שיקוף',
      cause: 'שיקוף ביחס לשני הצירים נראה כמו "הופכים הכול".',
      explain: ['זה חצי סיבוב סביב ראשית הצירים, לא שיקוף.', 'בשיקוף רק שיעור אחד מחליף סימן.'],
      remedy: [
        { kind: 'predict', text: '$(3, 2) \\to (-3, -2)$: שיקוף או סיבוב?', fig: plane({ points: [pt(3, 2, 'A'), pt(-3, -2, 'A′')], segments: [[[3, 2], [-3, -2]]] }),
          choices: ['סיבוב של $180°$', 'שיקוף'], answer: 0, why: 'שני השיעורים החליפו סימן: הנקודה עברה לצד השני של ראשית הצירים. זה חצי סיבוב.' },
      ] },
    { id: 'diagonal-axis', title: 'חשבו שאלכסון של מלבן הוא ציר סימטריה שלו',
      cause: 'האלכסון חוצה את המלבן לשני משולשים שווים, ונדמה שזה מספיק.',
      explain: ['ציר סימטריה: מקפלים לאורכו, וחצי נופל על חצי.', 'במלבן שאינו ריבוע הקיפול לאורך האלכסון לא מניח חצי על חצי.'],
      remedy: [
        { kind: 'predict', text: 'האלכסון של המלבן הוא ציר סימטריה שלו?', fig: rectangleDiag, choices: ['לא', 'כן'], answer: 0,
          why: 'בקיפול לאורך האלכסון הפינות לא נופלות זו על זו.' },
        { kind: 'predict', text: 'ריבוע: האלכסון ציר סימטריה?', fig: rectDiagonal('ריבוע והאלכסון שלו, מקווקו', 3, 3, false), choices: ['כן', 'לא'], answer: 0,
          why: 'בריבוע הצלעות שוות, ולכן הקיפול לאורך האלכסון מניח חצי על חצי.' },
      ] },
  ],
};

// ================================================================ stair 3: a turn

type P3 = { c1: number; c2: number; a1: number; a2: number; ask: 'x' | 'y' };
const transf3: DiagModel<P3> = {
  params: (rnd) => G.TRANSF3.params(rnd),
  text: (p) => G.transf3Text(p),
  fig: (p) => G.transf3Fig(p),
  answer: (p) => G.TRANSF3.answer(p),
  bugs: G.TRANSF3.bugs,
  solution: (p) => G.transf3Solution(p),
  hint: () => G.transf3Hint(),
};
const transf3T: DiagModel<P3> = {
  params: (rnd) => G.TRANSF3T.params(rnd),
  text: (p) => G.transf3TText(p),
  fig: (p) => G.transf3Fig(p),
  answer: (p) => G.TRANSF3T.answer(p),
  bugs: G.TRANSF3T.bugs,
  solution: (p) => G.transf3Solution(p),
  hint: () => G.transf3Hint(),
};
const S3_ABC: Pt[] = [[3, 2], [5, 2], [3, 4]];
const S3_IMG: Pt[] = [[-2, 3], [-2, 5], [-4, 3]];
const quarterP = (steps: boolean): FigSpec => plane({
  points: [pt(3, 1, 'P'), ...(steps ? [pt(1, -3, 'P′')] : [])], centre: [0, 0], turn: -90,
  ...(steps ? { path: [[0, 0], [3, 0], [3, 1]], helper: [[0, 0], [0, -3], [1, -3]] } : {}),
});
const equilateral = (): FigSpec => {
  const h = 2 * Math.sqrt(3);
  return { type: 'geo', label: 'משולש שווה צלעות והמרכז שלו', pts: { _A: [0, 0], _B: [4, 0], _C: [2, h], _O: [2, h / 3] }, polys: [{ pts: ['_A', '_B', '_C'] }], dots: ['_O'], view: [260, 190], pad: [24, 20] };
};

const stair3: StairContent = {
  skill: 'transf:3', topic: 'transf', level: 3, title: 'סיבוב',
  objectives: [
    'לסובב נקודה וצורה ב־$90°$ וב־$180°$ סביב נקודה, עם כיוון השעון ונגדו.',
    'לדעת שבסיבוב כל נקודה נשארת באותו מרחק ממרכז הסיבוב, ושצריך מרכז, זווית וכיוון.',
    'לזהות סימטריה סיבובית.',
  ],
  idea: 'בסיבוב כל נקודה מסתובבת סביב מרכז הסיבוב באותה זווית ובאותו כיוון, ונשארת באותו מרחק ממנו.',
  why: [
    'חצי סיבוב סביב $O$: $O$ הוא האמצע בין הנקודה לתמונה שלה.',
    'ברבע סיבוב, הצעדים מ־$O$ לנקודה מסתובבים יחד איתה: "ימינה" הופך ל"למעלה" נגד כיוון השעון, ול"למטה" עם כיוון השעון.',
  ],
  alt: ['כמו מחוגי שעון, או גלגל ענק: כל תא נשאר באותו מרחק מהציר שלו.'],
  discover: [
    { kind: 'say', text: 'סיבוב: כל נקודה מסתובבת סביב נקודה קבועה, מרכז הסיבוב. צריך לדעת שלושה דברים: המרכז, הזווית והכיוון.',
      fig: plane({ shapes: [tri(S3_ABC), tri(S3_IMG, ABC2, 'alt')], centre: [0, 0], turn: 90, helper: [[3, 2], [0, 0], [-2, 3]], anim: true }) },
    { kind: 'predict', text: 'מסובבים את $A(4, 0)$ ב־$90°$ נגד כיוון השעון סביב $O(0, 0)$. איפה $A\'$?', fig: plane({ points: [pt(4, 0, 'A')], centre: [0, 0], turn: 90 }),
      choices: ['$(0, 4)$', '$(0, -4)$', '$(-4, 0)$'], answer: 0,
      why: 'נגד כיוון השעון עולים מציר ה־$x$ החיובי לציר ה־$y$ החיובי. $OA = 4$, ולכן גם $OA\' = 4$.',
      wrongWhy: { 1: 'זה עם כיוון השעון: למטה.', 2: 'זה סיבוב של $180°$.' } },
    { kind: 'rule', text: 'בסיבוב כל נקודה נשארת באותו מרחק ממרכז הסיבוב. חצי סיבוב סביב $O(0, 0)$: $(x, y) \\to (-x, -y)$.',
      why: '$O$ הוא האמצע בין נקודה לתמונה שלה בחצי סיבוב.',
      fig: plane({ points: [pt(3, 2, 'A'), pt(-3, -2, 'A′')], centre: [0, 0], turn: 180, segments: [[[3, 2], [-3, -2]]] }) },
    { kind: 'explore', text: 'סובבו את המשולש ב־$180°$ סביב ראשית הצירים.',
      manip: tf([[1, 1], [4, 1], [1, 3]], { turns: { centre: [0, 0], by: 90 } }), answer: { pts: [[-1, -1], [-4, -1], [-1, -3]] },
      hint: 'חצי סיבוב הם שני רבעים באותו כיוון.',
      success: 'כל קודקוד עבר לצד השני של $O$, באותו מרחק: $(1, 1) \\to (-1, -1)$.' },
    { kind: 'predict', text: 'מסובבים את $P(3, 1)$ ב־$90°$ עם כיוון השעון סביב $O(0, 0)$. איפה $P\'$?', fig: quarterP(false),
      choices: ['$(1, -3)$', '$(1, 3)$', '$(-1, 3)$'], answer: 0,
      why: 'מ־$O$ ל־$P$: $3$ ימינה ו־$1$ למעלה. עם כיוון השעון "ימינה" הופך ל"למטה" ו"למעלה" ל"ימינה": $1$ ימינה ו־$3$ למטה, $(1, -3)$.',
      wrongWhy: { 1: 'החלפתם בין השיעורים בלי לשנות סימן. נקודה ברביע הראשון שמסתובבת עם כיוון השעון עוברת לרביע הרביעי.', 2: 'זה נגד כיוון השעון.' } },
    { kind: 'rule', text: 'ברבע סיבוב סביב $O$ מסובבים את הצעדים מ־$O$ לנקודה. נגד כיוון השעון: "ימינה" נעשה "למעלה", ו"למעלה" נעשה "שמאלה". עם כיוון השעון: "ימינה" נעשה "למטה", ו"למעלה" נעשה "ימינה".',
      display: "P(3, 1) \\to P'(1, -3)", why: 'הצעדים יוצרים משולש ישר־זווית קטן, והוא מסתובב יחד עם הנקודה.', fig: quarterP(true) },
    { kind: 'predict', text: 'מסובבים את $A(3, 1)$ ב־$180°$ סביב $O(1, 1)$. איפה $A\'$?', fig: plane({ points: [pt(3, 1, 'A')], centre: [1, 1], turn: 180 }),
      choices: ['$(-1, 1)$', '$(-3, -1)$', '$(-3, 1)$'], answer: 0,
      why: '$A$ נמצאת $2$ ימינה מ־$O$. אחרי חצי סיבוב היא $2$ שמאלה מ־$O$: $(-1, 1)$.',
      wrongWhy: { 1: 'סובבתם סביב ראשית הצירים. כאן המרכז $O(1, 1)$.', 2: 'שיקפתם ביחס לציר ה־$y$.' } },
    { kind: 'predict', text: 'בכמה מעלות לפחות צריך לסובב משולש שווה צלעות סביב המרכז שלו כדי שייראה שוב אותו דבר?', fig: equilateral(),
      choices: ['$120°$', '$60°$', '$360°$'], answer: 0,
      why: 'שלושה קודקודים מחלקים את הסיבוב השלם: $360° : 3 = 120°$.' },
  ],
  examples: [
    { problem: 'מסובבים את $A(-2, 5)$ ב־$180°$ סביב $O(0, 0)$. מה שיעור ה־$y$ של $A\'$?', fig: plane({ points: [pt(-2, 5, 'A')], centre: [0, 0], turn: 180 }), answer: -5, check: '-(5)',
      steps: [
        { action: 'חצי סיבוב סביב $O$ מחליף את שני הסימנים.', why: 'הנקודה עוברת לצד השני של $O$, באותו מרחק.', result: '(x,\\ y) \\to (-x,\\ -y)' },
        { action: 'מציבים.', why: '$x = -2$ נעשה $2$, ו־$y = 5$ נעשה $-5$.', result: "A'(2, -5)", value: '-5' },
      ] },
    { problem: 'מסובבים את $B(4, 2)$ ב־$90°$ נגד כיוון השעון סביב $O(0, 0)$. מה שיעור ה־$x$ של $B\'$?', fig: plane({ points: [pt(4, 2, 'B')], centre: [0, 0], turn: 90 }), answer: -2, check: '-(2)',
      steps: [
        { action: 'מ־$O$ ל־$B$: $4$ ימינה ו־$2$ למעלה.', why: 'אלה הצעדים שמסתובבים יחד עם הנקודה.', result: '4,\\ 2' },
        { action: 'נגד כיוון השעון: "ימינה" נעשה "למעלה", "למעלה" נעשה "שמאלה".', why: '$4$ ימינה הופכים ל־$4$ למעלה, ו־$2$ למעלה הופכים ל־$2$ שמאלה.', result: "B'(-2, 4)", value: '-2' },
      ] },
  ],
  together: [
    { problem: 'מסובבים את $P(-3, 1)$ ב־$180°$ סביב $O(1, 2)$. מה שיעור ה־$x$ של $P\'$?', fig: plane({ points: [pt(-3, 1, 'P')], centre: [1, 2], turn: 180 }),
      steps: [
        { prompt: 'כמה $P$ רחוקה מ־$O$ לאורך ציר ה־$x$?', choices: [
          { text: '$4$ שמאלה', ok: true, feedback: 'נכון: מ־$x = 1$ עד $x = -3$.' },
          { text: '$3$ שמאלה', ok: false, feedback: '$3$ הוא המרחק מציר ה־$y$. המרכז הוא $O(1, 2)$.' },
          { text: '$1$', ok: false, feedback: '$1$ הוא השיעור של $O$, לא המרחק ממנו.' },
        ], hints: ['מ־$x = -3$ עד $x = 1$.', 'ב־$P\'$: $4$ ימינה מ־$O$.'], done: '$P$ נמצאת $4$ שמאלה מ־$O$.' },
      ],
      final: { prompt: 'מה שיעור ה־$x$ של $P\'$?', answer: 5, check: '1+(1-(-3))', hints: ['$4$ ימינה מ־$O$.', '$1 + 4$.'] } },
    { problem: 'מסובבים את $Q(2, 3)$ ב־$90°$ עם כיוון השעון סביב $O(0, 0)$. מה שיעור ה־$y$ של $Q\'$?', fig: plane({ points: [pt(2, 3, 'Q')], centre: [0, 0], turn: -90 }),
      steps: [
        { prompt: 'לאיזה רביע תגיע $Q\'$?', choices: [
          { text: 'לרביע הרביעי', ok: true, feedback: 'נכון: עם כיוון השעון יורדים מהרביע הראשון לרביע הרביעי.' },
          { text: 'לרביע השני', ok: false, feedback: 'זה נגד כיוון השעון.' },
          { text: 'נשארת ברביע הראשון', ok: false, feedback: 'החלפת שיעורים בלי סימן משאירה אותה ברביע הראשון, וזה לא סיבוב.' },
        ], hints: ['עם כיוון השעון מהרביע הראשון יורדים.', '$Q\'(3, -2)$.'], done: '$Q\'$ ברביע הרביעי.' },
      ],
      final: { prompt: 'מה שיעור ה־$y$ של $Q\'$?', answer: -2, check: '-(2)', hints: ['"ימינה" נעשה "למטה".', '$2$ ימינה הופכים ל־$2$ למטה.'] } },
  ],
  diag: transf3,
  transfer: transf3T,
  words: ['סיבוב', 'מרכז הסיבוב', 'זווית הסיבוב', 'עם כיוון השעון', 'נגד כיוון השעון', 'סימטריה סיבובית'],
  misconceptions: [
    { id: 'wrong-centre', title: 'סובבו סביב ראשית הצירים במקום סביב מרכז הסיבוב',
      cause: 'ראשית הצירים היא המרכז המוכר, והמרכז שבשאלה נשכח.',
      explain: ['קודם מודדים מ־$O$, אחר כך מסובבים את המדידה.', '$A(3, 1)$ נמצאת $2$ ימינה מ־$O(1, 1)$, ולכן אחרי חצי סיבוב $2$ שמאלה ממנו: $(-1, 1)$.'],
      remedy: [
        { kind: 'predict', text: 'מסובבים את $A(3, 1)$ ב־$180°$ סביב $O(1, 1)$. איפה $A\'$?', fig: plane({ points: [pt(3, 1, 'A')], centre: [1, 1], turn: 180 }),
          choices: ['$(-1, 1)$', '$(-3, -1)$'], answer: 0, why: 'מודדים מ־$O(1, 1)$: $2$ ימינה, ולכן אחרי חצי סיבוב $2$ שמאלה.' },
        { kind: 'explore', text: 'סובבו את המשולש חצי סיבוב סביב $O(1, 1)$.',
          manip: tf([[2, 2], [4, 2], [2, 3]], { turns: { centre: [1, 1], by: 180 } }), answer: { pts: [[0, 0], [-2, 0], [0, -1]] },
          hint: 'לחצו על "חצי סיבוב". המרכז הוא $O(1, 1)$, לא ראשית הצירים.', success: 'כל קודקוד עבר לצד השני של $O(1, 1)$, באותו מרחק.' },
      ] },
    { id: 'reflect-not-turn', title: 'שיקפו במקום לסובב: רק שיעור אחד השתנה',
      cause: 'חצי סיבוב ושיקוף נראים דומים; בשיקוף רק שיעור אחד משתנה.',
      explain: ['בחצי סיבוב סביב $O(0, 0)$ שני השיעורים מחליפים סימן.'],
      remedy: [
        { kind: 'predict', text: 'חצי סיבוב של $(3, 1)$ סביב $O(0, 0)$:', fig: plane({ points: [pt(3, 1, 'A')], centre: [0, 0], turn: 180 }),
          choices: ['$(-3, -1)$', '$(-3, 1)$'], answer: 0, why: 'הנקודה עוברת לצד השני של $O$: שני השיעורים מחליפים סימן. $(-3, 1)$ הוא שיקוף.' },
      ] },
    { id: 'turn-direction', title: 'סובבו לכיוון ההפוך',
      cause: '"עם" ו"נגד" כיוון השעון מתבלבלים.',
      explain: ['כיוון השעון: מלמעלה ימינה, ואז למטה. נגד כיוון השעון: מימין למעלה.'],
      remedy: [
        { kind: 'predict', text: 'מסובבים את $A(4, 0)$ ב־$90°$ נגד כיוון השעון סביב $O(0, 0)$. איפה $A\'$?', fig: plane({ points: [pt(4, 0, 'A')], centre: [0, 0], turn: 90 }),
          choices: ['$(0, 4)$', '$(0, -4)$'], answer: 0, why: 'נגד כיוון השעון עולים מימין למעלה: $(0, 4)$.' },
      ] },
    { id: 'rot-swap', title: 'החליפו בין השיעורים בלי לשנות סימן',
      cause: 'ברבע סיבוב השיעורים מתחלפים, וזוכרים רק את ההחלפה.',
      explain: ['ברבע סיבוב מסובבים את הצעדים: אחד מהם גם מחליף כיוון.'],
      remedy: [
        { kind: 'predict', text: 'מסובבים את $P(3, 1)$ ב־$90°$ עם כיוון השעון סביב $O(0, 0)$. איפה $P\'$?', fig: quarterP(false),
          choices: ['$(1, -3)$', '$(1, 3)$'], answer: 0, why: '$(1, 3)$ נשארת ברביע הראשון. עם כיוון השעון יורדים לרביע הרביעי: $(1, -3)$.' },
        { kind: 'rule', text: 'עם כיוון השעון: "ימינה" נעשה "למטה", ו"למעלה" נעשה "ימינה".', display: "P(3, 1) \\to P'(1, -3)",
          why: 'הצעדים מ־$O$ לנקודה יוצרים משולש קטן, והוא מסתובב יחד איתה.', fig: quarterP(true) },
      ] },
  ],
};

// ================================================================ stair 4: congruent shapes and tilings

type P4 = { a: number; b: number; h: number; s: number; v: 'm' | 't' };
const transf4: DiagModel<P4> = {
  params: (rnd) => G.TRANSF4.params(rnd),
  text: (p) => G.glueText(p),
  fig: (p) => G.glueFig(p),
  answer: (p) => G.TRANSF4.answer(p),
  bugs: G.TRANSF4.bugs,
  solution: (p) => G.glueSolution(p),
  hint: () => G.glueHint(),
};
const transf4T: DiagModel<P4> = {
  params: (rnd) => G.TRANSF4T.params(rnd),
  text: (p) => G.transf4TText(p),
  fig: (p) => G.glueFig(p),
  answer: (p) => G.TRANSF4T.answer(p),
  bugs: G.TRANSF4T.bugs,
  solution: (p) => G.glueSolution(p),
  hint: () => G.glueHint(),
};
const S4_ABC: Pt[] = [[-5, 1], [-2, 1], [-5, 3]];
const S4_TARGET: Pt[] = [[5, -2], [2, -2], [5, 0]];
const trap364 = G.glueFig({ a: 3, b: 6, h: 4, s: 5, v: 'm' });
/** Tiles around one point: every polygon has a vertex there (content/transf.gen.js tilesAround). */
const around = (label: string, sides: number, n: number, gap?: { text: string }): FigSpec => {
  const { pts, polys } = G.tilesAround(sides, n, gap ? 180 - 360 / sides : undefined);
  const last = `_${n - 1}_${sides - 1}`;
  return { type: 'geo', label, pts, polys, hide: ['O'], ...(gap ? { angles: [{ at: 'O', from: last, to: '_0_1', text: gap.text, r: 18 }] } : {}), view: [240, 200], pad: [22, 18] };
};
/** Two squares, an equilateral triangle and the gap of the fourth tile (120°) around one point. */
const mixedPoint = (): FigSpec => {
  const c = (d: number): Pt => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)];
  const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]];
  const pts: Record<string, Pt> = { O: [0, 0], _a: c(0), _b: add(c(0), c(90)), _c: c(90), _d: add(c(90), c(180)), _e: c(180), _f: c(240) };
  return {
    type: 'geo', label: 'שני ריבועים ומשולש שווה צלעות סביב נקודה, והזווית שנשארה לאריח הרביעי',
    pts, polys: [{ pts: ['O', '_a', '_b', '_c'] }, { pts: ['O', '_c', '_d', '_e'] }, { pts: ['O', '_e', '_f'] }],
    angles: [{ at: 'O', from: '_f', to: '_a', text: '?', target: true, r: 20 }], hide: ['O'], view: [240, 200], pad: [24, 20],
  };
};

const stair4: StairContent = {
  skill: 'transf:4', topic: 'transf', level: 4, title: 'צורות חופפות וריצוף',
  objectives: [
    'לזהות צורות חופפות: אפשר להניח אחת על השנייה בהזזה, בשיקוף, בסיבוב, או בכמה מהם.',
    'לדעת שבצורות חופפות כל האורכים, הזוויות, ההיקף והשטח שווים, ושצורות עם אותו שטח או אותו היקף אינן בהכרח חופפות.',
    'לחשב היקף ושטח של צורה שבנויה מצורות חופפות, ולהבין למה מצולעים מסוימים מרצפים: סביב נקודה $360°$.',
  ],
  idea: 'צורות חופפות הן אותה צורה במקום אחר: הזזה, שיקוף וסיבוב לא משנים אף אורך ואף זווית.',
  why: [
    'כשמצמידים שתי צורות, השטחים מתחברים, אבל הצלע המשותפת נכנסת פנימה ויוצאת מההיקף.',
    'בריצוף, הזוויות שנפגשות בנקודה משלימות סיבוב שלם, $360°$.',
  ],
  alt: ['נסו לגזור את אחת הצורות ולהניח אותה על השנייה: אם היא מכסה אותה בדיוק, אחרי הזזה, היפוך או סיבוב, הן חופפות.'],
  discover: [
    { kind: 'say', text: 'שתי צורות חופפות אם אפשר להניח אחת על השנייה כך שתכסה אותה בדיוק. כדי להניח, מותר להזיז, לשקף ולסובב.',
      fig: plane({ shapes: [tri(S4_ABC), tri(S4_TARGET, ABC2, 'alt')], arrows: arrowsOf(S4_ABC, S4_TARGET), anim: true }) },
    { kind: 'predict', text: 'לשני המלבנים אותו שטח, $12$. הם חופפים?', fig: twoRects('מלבן 4 על 3 ומלבן 6 על 2', [4, 3], [6, 2]),
      choices: ['לא', 'כן'], answer: 0,
      why: 'צלע של $6$ לא נכנסת בצלע של $4$, ולכן אחד לא מכסה את השני. שטח שווה לא מספיק.' },
    { kind: 'rule', text: 'בצורות חופפות כל האורכים, הזוויות, ההיקף והשטח שווים. אבל אותו שטח או אותו היקף לא מבטיחים חפיפה.',
      why: 'הזזה, שיקוף וסיבוב שומרים על כל אורך וכל זווית, ולכן על כל המידות.', fig: twoRects('מלבן 5 על 1 וריבוע 3 על 3: לשניהם היקף 12', [5, 1], [3, 3]) },
    { kind: 'explore', text: 'הניחו את העותק בדיוק על המשולש המקווקו: הזיזו, שקפו או סובבו.',
      manip: tf(S4_ABC, { drag: true, flips: ['y'], turns: { centre: [0, 0], by: 90 } }, { target: { pts: S4_TARGET } }), answer: { pts: S4_TARGET, match: 'set' },
      hint: 'המשולש המקווקו הפוך, כמו במראה. נסו קודם שיקוף.',
      success: 'שיקוף ואחריו הזזה: המשולשים חופפים.' },
    { kind: 'predict', text: 'מצמידים את הטרפז לתמונת המראה שלו לאורך הצלע $4$. מה ההיקף של הצורה החדשה?', fig: trap364,
      choices: ['$28$', '$36$', '$18$'], answer: 0,
      why: 'הצלע $4$ נכנסת פנימה ואינה חלק מההיקף: $6 + 12 + 5 + 5 = 28$.',
      wrongWhy: { 1: 'חיברתם שני היקפים, $18 + 18$, וספרתם פעמיים את הצלע שבפנים.', 2: 'זה ההיקף של טרפז אחד.' } },
    { kind: 'rule', text: 'כשמצמידים שתי צורות: השטח הוא סכום השטחים, וההיקף הוא סכום ההיקפים פחות פעמיים הצלע המשותפת.',
      display: '18 + 18 - 2 \\cdot 4 = 28', why: 'הצלע המשותפת נספרה פעם בכל צורה, ועכשיו היא בפנים.', fig: trap364 },
    { kind: 'predict', text: 'בריצוף במשושים משוכללים כל זווית $120°$. כמה משושים נפגשים בנקודה?', fig: around('משושים משוכללים שנפגשים בנקודה אחת', 6, 3),
      choices: ['$3$', '$4$', '$6$'], answer: 0, why: 'סביב נקודה $360°$: $3 \\cdot 120° = 360°$.' },
    { kind: 'rule', text: 'ריבועים ($4 \\cdot 90°$), משולשים שווי צלעות ($6 \\cdot 60°$) ומשושים ($3 \\cdot 120°$) מרצפים. מחומשים משוכללים ($108°$) לא.',
      why: '$360 : 108$ אינו מספר שלם: נשאר רווח, או שאריחים עולים זה על זה.', fig: around('שלושה מחומשים משוכללים סביב נקודה, ורווח של 36 מעלות', 5, 3, { text: '36°' }) },
  ],
  examples: [
    { problem: 'טרפז ישר־זווית: בסיסים $2$ ו־$5$, גובה $4$, השוק המשופעת $5$. מסובבים עותק שלו ב־$180°$ ומצמידים לאורך השוק המשופעת, ונוצר מלבן. מה ההיקף שלו?',
      fig: G.glueFig({ a: 2, b: 5, h: 4, s: 5, v: 't' }), answer: 22, check: '2*(2+5)+2*4',
      steps: [
        { action: 'הצלע הארוכה של המלבן: שני הבסיסים.', why: 'הבסיס של העותק המסובב ממשיך את הבסיס של הטרפז.', result: '2 + 5 = 7', calc: { expr: '2+5', value: 7 } },
        { action: 'הרוחב: הגובה.', why: 'הצלע הישרה של הטרפז היא צלע של המלבן.', result: '4' },
        { action: 'מחשבים את ההיקף.', why: 'שתי צלעות ארוכות ושתי קצרות. השוק המשופעת בפנים.', result: '2 \\cdot 7 + 2 \\cdot 4 = 22', value: '2*7+2*4' },
      ] },
    { problem: 'שני מלבנים $5 \\times 2$ מוצמדים לאורך הצלע $2$. מה ההיקף?',
      fig: { type: 'geo', label: 'שני מלבנים 5 על 2 צמודים לאורך הצלע 2', pts: { ...rect('_a', 0, 5, 2), ...rect('_b', 5, 5, 2) },
        polys: [{ pts: ['_a1', '_a2', '_a3', '_a4'] }, { pts: ['_b1', '_b2', '_b3', '_b4'] }],
        segs: [{ a: '_a1', b: '_a2', label: '5' }, { a: '_b1', b: '_b2', label: '5' }, { a: '_a2', b: '_a3', dash: true }, { a: '_b2', b: '_b3', label: '2' }], view: [320, 150], pad: [26, 24] },
      answer: 24, check: '2*(5+5)+2*2',
      steps: [
        { action: 'נוצר מלבן $10 \\times 2$.', why: 'הצלעות $5$ ממשיכות זו את זו.', result: '5 + 5 = 10', calc: { expr: '5+5', value: 10 } },
        { action: 'שני היקפים פחות פעמיים הצלע המשותפת.', why: 'ההיקף של כל מלבן $14$; הצלע $2$ שביניהם נספרה פעמיים ועכשיו בפנים.', result: '14 + 14 - 2 \\cdot 2 = 24', value: '14+14-2*2' },
      ] },
  ],
  together: [
    { problem: 'שני משולשים ישרי־זווית חופפים, עם ניצבים $3$ ו־$4$ ויתר $5$, מוצמדים לאורך היתר ויוצרים מלבן. מה ההיקף?',
      fig: rectDiagonal('מלבן 4 על 3: שני משולשים צמודים לאורך היתר, מקווקו', 4, 3),
      steps: [
        { prompt: 'מה קורה ליתר?', choices: [
          { text: 'הוא בפנים, ולא נספר', ok: true, feedback: 'נכון: היתר הוא האלכסון של המלבן.' },
          { text: 'נספר פעמיים', ok: false, feedback: 'הוא בתוך המלבן, לא בשפה שלו.' },
          { text: 'נספר פעם אחת', ok: false, feedback: 'היתר הוא האלכסון של המלבן: הוא בפנים.' },
        ], hints: ['מה נמצא בשפה של המלבן?', 'ארבע הצלעות: $3, 4, 3, 4$.'], done: 'היתר בפנים.' },
      ],
      final: { prompt: 'מה ההיקף של המלבן?', answer: 14, check: '2*(3+4)', hints: ['ארבע הצלעות: $3, 4, 3, 4$.', '$2 \\cdot (3 + 4)$.'] } },
    { problem: 'בנקודה של ריצוף נפגשים שני ריבועים, משולש שווה צלעות ועוד אריח אחד. מה הזווית של האריח?', fig: mixedPoint(),
      steps: [
        { prompt: 'כמה מעלות סביב הנקודה?', choices: [
          { text: '$360°$', ok: true, feedback: 'נכון: סיבוב שלם.' },
          { text: '$180°$', ok: false, feedback: '$180°$ הם קו ישר; סביב נקודה יש סיבוב שלם.' },
        ], hints: ['סיבוב שלם.', '$360 - 90 - 90 - 60$.'], done: 'סביב הנקודה $360°$.' },
      ],
      final: { prompt: 'מה הזווית של האריח, במעלות?', answer: 120, check: '360-90-90-60', hints: ['מורידים מ־$360$ את הזוויות של שלושת האריחים.', '$360 - 90 - 90 - 60$.'] } },
  ],
  diag: transf4,
  transfer: transf4T,
  words: ['צורות חופפות', 'היקף', 'שטח', 'ריצוף', 'מצולע משוכלל'],
  misconceptions: [
    { id: 'double-perimeter', title: 'חיברו את שני ההיקפים, וספרו פעמיים את הצלע המשותפת',
      cause: 'השטח של שתי צורות הוא פי שניים, וזה נראה נכון גם להיקף ("יותר שטח, יותר היקף").',
      explain: ['הצלע המשותפת בפנים. היקף הוא רק השפה.', 'שני טרפזים עם היקף $18$, צמודים לאורך הצלע $4$: $18 + 18 - 2 \\cdot 4 = 28$.'],
      remedy: [
        { kind: 'predict', text: 'מצמידים את הטרפז לתמונת המראה שלו לאורך הצלע $4$. מה ההיקף של הצורה החדשה?', fig: trap364,
          choices: ['$28$', '$36$'], answer: 0, why: 'הצלע $4$ בפנים: $6 + 12 + 5 + 5 = 28$. $36$ סופר אותה פעמיים.' },
        { kind: 'explore', text: 'הניחו את העותק על המשולש המקווקו, כך ששני המשולשים יחד יהיו מלבן.',
          manip: tf([[0, 0], [4, 0], [0, 3]], { drag: true, turns: { centre: [0, 0], by: 180 } }, { target: { pts: [[4, 3], [0, 3], [4, 0]] } }),
          answer: { pts: [[4, 3], [0, 3], [4, 0]], match: 'set' },
          hint: 'סובבו חצי סיבוב, ואז הזיזו.', success: 'שני המשולשים יוצרים מלבן $4 \\times 3$: ההיקף $14$, והיתר בפנים.' },
      ] },
    { id: 'equal-area', title: 'חשבו שצורות עם אותו שטח הן חופפות',
      cause: 'שטח הוא המספר שכבר חישבנו, ונדמה שהוא קובע את הצורה.',
      explain: ['$4 \\times 3$ ו־$6 \\times 2$: לשניהם שטח $12$, אבל הצלעות שונות.'],
      remedy: [
        { kind: 'predict', text: 'לשני המלבנים אותו שטח, $12$. הם חופפים?', fig: twoRects('מלבן 4 על 3 ומלבן 6 על 2', [4, 3], [6, 2]), choices: ['לא', 'כן'], answer: 0,
          why: 'הצלעות שונות, ולכן אחד לא מכסה את השני.' },
      ] },
    { id: 'equal-perimeter', title: 'חשבו שצורות עם אותו היקף הן חופפות',
      cause: 'היקף שווה נשמע כמו "אותו גודל".',
      explain: ['$5 \\times 1$ ו־$3 \\times 3$: לשניהם היקף $12$, אבל הם לא אותה צורה.'],
      remedy: [
        { kind: 'rule', text: 'בצורות חופפות כל האורכים, הזוויות, ההיקף והשטח שווים. אבל אותו שטח או אותו היקף לא מבטיחים חפיפה.',
          why: 'מלבן $5 \\times 1$ וריבוע $3 \\times 3$: אותו היקף, $12$, וצורות שונות.', fig: twoRects('מלבן 5 על 1 וריבוע 3 על 3: לשניהם היקף 12', [5, 1], [3, 3]) },
      ] },
  ],
};

export const TRANSF: StairContent[] = [stair1, stair2, stair3, stair4];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/transf.js names them all). */
export const CATS_TRANSF: Record<string, string> = {};
export { transf1, transf1T, transf2, transf2T, transf3, transf3T, transf4, transf4T };
