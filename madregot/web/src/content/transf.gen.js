// Transformations (טרנספורמציות): slides, reflections and turns on the grid, and congruent shapes and tilings. The ז׳
// programme's unit 7.11 (November–December) and, in the transition year תשפ״ז, the ח׳ unit 8.5 too (curriculum stage 4,
// GEOM-4). Taught in November, so the first-day placement test skips it (placement: false).
//
// One picture carries it: a move takes every point of a shape the same way. A slide adds the same to every x and to
// every y; a reflection sends each point to the same distance on the other side of the mirror line; a turn needs a
// centre, an angle and a direction, and keeps every point's distance from the centre. None of them changes a length, an
// angle or an area, so the image is congruent; equal areas or perimeters alone are not.
//
// The diagnostic models (TRANSF1 to TRANSF4T) are the stage's (scratchpad/lanes/stage4/spec/models.mjs), ported
// unchanged: their draws are redrawn when a prediction looks like a slip or another prediction (clean), and when the
// answer is a number the question shows (notGuessable). The check-eligible practice kinds use the models' own draws
// (models.mjs GEN). The objects a question names a target for (the transform copy, which move, symmetry and tilings)
// are practice only. Every number written here is checked by the lane's spec/facts-transf.mjs.
// Errors and their sources (stage4.md §0.4):
//   shift-sign, shift-swap, one-axis   a coordinate moved the wrong way, the shifts swapped between x and y, a move
//                     along one axis only (Yanık 2014, JMB 36; the Ministry's "הכיוון והמרחק … זהים לכל נקודות הצורה")
//   gap               a slide measured by the gap between the two shapes (a choice in practice only; teacher-reported)
//   axis-not-line, wrong-axis, both-signs   a reflection in the axis instead of the line x = k, in the other axis, or
//                     both signs changed, which is a half turn (Edwards & Zazkis 1993; Naidoo & Bansilal)
//   diagonal-axis     a rectangle's diagonal taken for an axis of symmetry (Leikin, Berman & Zaslavsky 2000)
//   wrong-centre, reflect-not-turn, turn-direction, rot-swap   a turn about the origin instead of the given centre, a
//                     reflection instead of a turn, the other way round, the coordinates swapped with no sign (Hollebrands
//                     2004; the Ministry's "מרכז, זווית, כיוון")
//   double-perimeter  both perimeters added, the glued side twice; equal-area, equal-perimeter: equal measures taken
//                     for congruence (Tirosh & Stavy 1999; the Ministry's equal-area rectangles and trapezoids)
// This module is the topic's arithmetic: the models, the practice generators, their texts, drawings and solutions. It
// loads with the topic's teaching content (learn/content/transf.ts imports it), not on the first screen: content/transf.js
// is the topic object in the boot list, and its levels call the generators registered here (content/lazyGen.js). The
// transform object's checking and words (content/transform.js) register with content/manip.js; this module imports it,
// so once the unit has loaded its items are checked and its drawings read in words (figPlain's shapes, arrows, mirror
// and centre) wherever they show, in a lesson or in the tutor's context, before any object was ever drawn.
import { shuffle } from './util.js';
import { clean, notGuessable } from './frac.js';
import { registerGens } from './lazyGen.js';
import './transform.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
/** A whole number between a and b, either sign. */
const sgnPick = (r, a, b) => (r() < 0.5 ? -1 : 1) * rint(r, a, b);
/** On the plane: |v| at most 6. */
const inR = (v, r = 6) => Math.abs(v) <= r;
const z0 = (v) => v + 0; // never −0

// ---------------------------------------------------------------- the models' draws (spec/models.mjs, unchanged)
/**
 * The redraw rule of every model here (models.mjs mk): clean() (no prediction a slip, a rounding or another prediction),
 * and the answer never a number the question shows (in its text, `printed`, or its drawing, `figNums`).
 */
function mk(m) {
  m.params = (r) => {
    for (let i = 0; i < 200000; i += 1) {
      const p = m.raw(r);
      if (!p || !clean(m, p)) continue;
      if (!notGuessable(m.answer(p), [...m.printed(p), ...(m.figNums ? m.figNums(p) : [])])) continue;
      return p;
    }
    throw new Error('no clean draw');
  };
  return m;
}

/** transf:1 — A moved to A' gives the translation; the asked coordinate of C'. */
export const TRANSF1 = mk({
  raw: (r) => {
    const a1 = rint(r, -5, 5); const a2 = rint(r, -5, 5);
    const dx = sgnPick(r, 2, 6); const dy = sgnPick(r, 2, 6);
    if (Math.abs(dx) === Math.abs(dy)) return null;
    const c1 = rint(r, -5, 5); const c2 = rint(r, -5, 5);
    if (c1 === a1 && c2 === a2) return null;
    if (![a1 + dx, a2 + dy, c1 + dx, c2 + dy].every((v) => inR(v))) return null;
    return { a1, a2, dx, dy, c1, c2, ask: r() < 0.5 ? 'x' : 'y' };
  },
  answer: (p) => (p.ask === 'x' ? p.c1 + p.dx : p.c2 + p.dy),
  bugs: {
    'shift-sign': (p) => (p.ask === 'x' ? p.c1 - p.dx : p.c2 - p.dy), // moved the other way along this axis
    'shift-swap': (p) => (p.ask === 'x' ? p.c1 + p.dy : p.c2 + p.dx), // the shift along y added to x (or back)
    'one-axis': (p) => (p.ask === 'x' ? p.c1 : p.c2), // moved along the other axis only
  },
  printed: (p) => [p.a1, p.a2, p.a1 + p.dx, p.a2 + p.dy, p.c1, p.c2],
  figNums: (p) => [p.a1, p.a2, p.a1 + p.dx, p.a2 + p.dy, p.c1, p.c2],
});
/** transf:1 transfer — a spaceship at (p1, p2) told to move |dx| right or left and |dy| up or down. */
export const TRANSF1T = mk({
  raw: (r) => {
    const p1 = rint(r, -5, 5); const p2 = rint(r, -5, 5);
    const dx = sgnPick(r, 2, 6); const dy = sgnPick(r, 2, 6);
    if (Math.abs(dx) === Math.abs(dy) || !inR(p1 + dx) || !inR(p2 + dy)) return null;
    return { p1, p2, dx, dy, ask: r() < 0.5 ? 'x' : 'y' };
  },
  answer: (p) => (p.ask === 'x' ? p.p1 + p.dx : p.p2 + p.dy),
  bugs: {
    'shift-sign': (p) => (p.ask === 'x' ? p.p1 - p.dx : p.p2 - p.dy),
    'shift-swap': (p) => (p.ask === 'x' ? p.p1 + p.dy : p.p2 + p.dx),
    'one-axis': (p) => (p.ask === 'x' ? p.p1 : p.p2),
  },
  printed: (p) => [p.p1, p.p2, Math.abs(p.dx), Math.abs(p.dy)],
});

/** transf:2 — reflect A(a, b) in the line x = k (t 0) or y = k (t 1); the coordinate that changes. */
export const TRANSF2 = mk({
  raw: (r) => {
    const t = r() < 0.5 ? 0 : 1; const k = sgnPick(r, 1, 4);
    const a = rint(r, -5, 5); const b = rint(r, -5, 5);
    const v = t === 0 ? a : b; const d = v - k;
    if (d === 0 || Math.abs(d) > 5 || !inR(2 * k - v)) return null;
    return { t, k, a, b };
  },
  answer: ({ t, k, a, b }) => 2 * k - (t === 0 ? a : b),
  bugs: {
    'axis-not-line': ({ t, a, b }) => -(t === 0 ? a : b), // reflected in the axis, not in the line x = k
    'wrong-axis': ({ t, a, b }) => (t === 0 ? a : b), // reflected in the other direction: this coordinate kept
  },
  printed: ({ k, a, b }) => [a, b, k],
});
/** transf:2 transfer — a lamp at (a, b) and a mirror along the wall x = k; where its image is seen. */
export const TRANSF2T = mk({
  raw: (r) => { const k = rint(r, 4, 8); const a = rint(r, 1, k - 1); const b = rint(r, 1, 5); return { t: 0, k, a, b }; },
  answer: TRANSF2.answer,
  bugs: TRANSF2.bugs,
  printed: ({ k, a, b }) => [a, b, k],
});

/** transf:3 — a half turn of A(a1, a2) about O(c1, c2), O not the origin; the asked coordinate of A'. */
export const TRANSF3 = mk({
  raw: (r) => {
    const c1 = rint(r, -3, 3); const c2 = rint(r, -3, 3); const a1 = rint(r, -5, 5); const a2 = rint(r, -5, 5);
    const ask = r() < 0.5 ? 'x' : 'y'; const c = ask === 'x' ? c1 : c2; const a = ask === 'x' ? a1 : a2;
    if (c === 0 || a === c || (a1 === c1 && a2 === c2) || !inR(2 * c1 - a1) || !inR(2 * c2 - a2)) return null;
    return { c1, c2, a1, a2, ask };
  },
  answer: (p) => (p.ask === 'x' ? 2 * p.c1 - p.a1 : 2 * p.c2 - p.a2),
  bugs: {
    'wrong-centre': (p) => -(p.ask === 'x' ? p.a1 : p.a2), // turned about the origin, not about O
    'reflect-not-turn': (p) => (p.ask === 'x' ? p.a1 : p.a2), // reflected in a line through O: this coordinate kept
  },
  printed: (p) => [p.a1, p.a2, p.c1, p.c2],
});
/** transf:3 transfer — a drawing app turns a picture half a turn about O(c1, c2). */
export const TRANSF3T = mk({ raw: TRANSF3.raw, answer: TRANSF3.answer, bugs: TRANSF3.bugs, printed: TRANSF3.printed });

/** (b − a, h, s): the difference of the bases, the height and the slanted leg of a right trapezoid, all whole. */
export const TRIPLES = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13]];
/**
 * transf:4 — a right trapezoid (bases a < b, height h, slanted leg s) glued to its image: mirrored along the height (an
 * isosceles trapezoid, v 'm') or turned half a turn about the middle of s (a rectangle, v 't'); the new perimeter.
 */
export const TRANSF4 = mk({
  raw: (r) => { const [d, h, s] = pick(r, TRIPLES); const a = rint(r, 2, 8); return { a, b: a + d, h, s, v: r() < 0.5 ? 'm' : 't' }; },
  answer: ({ a, b, h, s, v }) => (v === 'm' ? 2 * a + 2 * b + 2 * s : 2 * (a + b) + 2 * h),
  bugs: { 'double-perimeter': ({ a, b, h, s }) => 2 * (a + b + h + s) }, // both perimeters added, the glued side twice
  printed: ({ a, b, h, s }) => [a, b, h, s],
});
/** transf:4 transfer — two trapezoid tiles laid one turned beside the other make a rectangle; its perimeter. */
export const TRANSF4T = mk({
  raw: (r) => ({ ...TRANSF4.raw(r), v: 't' }),
  answer: TRANSF4.answer, bugs: TRANSF4.bugs, printed: TRANSF4.printed,
});

// ---------------------------------------------------------------- the moves, in whole numbers
const slide = (pts, dx, dy) => pts.map(([x, y]) => [z0(x + dx), z0(y + dy)]);
/** A reflection in 'x' (the x-axis), 'y', { x: k } or { y: k }. */
const reflect = (pts, mr) => pts.map(([x, y]) => (mr === 'x' ? [x, -y] : mr === 'y' ? [-x, y] : mr.x != null ? [2 * mr.x - x, y] : [x, 2 * mr.y - y]).map(z0));
/** A turn about (a, b): 90 counterclockwise, −90 clockwise, 180 half. */
const turn = (pts, [a, b], by) => pts.map(([x, y]) => (Math.abs(by) === 180 ? [2 * a - x, 2 * b - y] : by === 90 ? [a - (y - b), b + (x - a)] : [a + (y - b), b - (x - a)]).map(z0));
const onPlane = (pts) => pts.every(([x, y]) => inR(x) && inR(y));
const samePt = (u, p) => Array.isArray(u) && u.length === 2 && u[0] === p[0] && u[1] === p[1];
/**
 * A typed point's misconception: the id whose predicted point it is. `preds` lists each id's points; a draw keeps it
 * only when every prediction differs from the answer and from every other id's (distinctPreds).
 */
const ptDiag = (preds) => (u) => Object.keys(preds).find((id) => preds[id].some((p) => samePt(u, p))) || null;
function distinctPreds(ans, preds) {
  const all = Object.entries(preds).flatMap(([id, ps]) => ps.map((p) => [id, p]));
  if (all.some(([, p]) => samePt(p, ans))) return false;
  return all.every(([i, p], a) => all.every(([j, q], b) => b <= a || i === j || !samePt(p, q)));
}

// ---------------------------------------------------------------- words
/** A number in maths: −3 as (-3) where it is added or multiplied. */
const paren = (v) => (v < 0 ? `(${v})` : `${v}`);
export const P = ([x, y]) => `(${x}, ${y})`;
const horiz = (d) => (d > 0 ? 'ימינה' : 'שמאלה');
const vert = (d) => (d > 0 ? 'למעלה' : 'למטה');
/** "$4$ ימינה ו־$1$ למעלה" (one part when the other is 0). */
export const shiftWords = (dx, dy, unit = '') => [dx && `$${Math.abs(dx)}$${unit} ${horiz(dx)}`, dy && `$${Math.abs(dy)}$${unit} ${vert(dy)}`].filter(Boolean).join(' ו־');
/** The same words with no maths, for a choice (a choice in words is plain text): "4 ימינה ו־1 למעלה". */
export const shiftPlain = (dx, dy) => [dx && `${Math.abs(dx)} ${horiz(dx)}`, dy && `${Math.abs(dy)} ${vert(dy)}`].filter(Boolean).join(' ו־');
const NAMES = ['A', 'B', 'C'];
/** A coord figure of a triangle (and its image, toned alt), with letters. */
const shapeFig = (pts, more = {}) => ({ type: 'coord', range: 6, shapes: [{ pts, names: NAMES }], ...more });

// ---------------------------------------------------------------- transf:1 words (the models' texts and solutions)
export const transf1Text = (p) => `בהזזה הנקודה $A${P([p.a1, p.a2])}$ עוברת ל־$A'${P([p.a1 + p.dx, p.a2 + p.dy])}$. הנקודה $C${P([p.c1, p.c2])}$ עוברת באותה הזזה ל־$C'$. מה שיעור ה־$${p.ask}$ של $C'$?`;
export const transf1Fig = (p) => ({
  type: 'coord', range: 6,
  points: [{ x: p.a1, y: p.a2, label: 'A' }, { x: p.a1 + p.dx, y: p.a2 + p.dy, label: 'A′' }, { x: p.c1, y: p.c2, label: 'C' }],
  arrows: [{ from: [p.a1, p.a2], to: [p.a1 + p.dx, p.a2 + p.dy] }],
});
export const transf1Solution = (p) => {
  const ask = p.ask === 'x'; const c = ask ? p.c1 : p.c2; const d = ask ? p.dx : p.dy;
  return [`מ־$A$ ל־$A'$: $${p.dx}$ ב־$x$ ו־$${p.dy}$ ב־$y$.`, `$C'$: $${p.ask} = ${c} + ${paren(d)} = ${c + d}$`];
};
export const transf1Hint = () => 'מצאו את ההזזה מ־$A$ ל־$A\'$, והוסיפו אותה ל־$C$.';
export const transf1TText = (p) => `במשחק מחשב חללית נמצאת בנקודה $${P([p.p1, p.p2])}$. הפקודה: לזוז $${Math.abs(p.dx)}$ משבצות ${horiz(p.dx)} ו־$${Math.abs(p.dy)}$ משבצות ${vert(p.dy)}. מה שיעור ה־$${p.ask}$ של החללית אחרי הפקודה?`;
export const transf1TSolution = (p) => {
  const ask = p.ask === 'x'; const c = ask ? p.p1 : p.p2; const d = ask ? p.dx : p.dy;
  return [`${ask ? `${horiz(p.dx) === 'ימינה' ? 'ימינה מוסיפים' : 'שמאלה מחסירים'}, ולכן ל־$x$` : `${vert(p.dy) === 'למעלה' ? 'למעלה מוסיפים' : 'למטה מחסירים'}, ולכן ל־$y$`} מצטרף $${d}$.`, `$${p.ask} = ${c} + ${paren(d)} = ${c + d}$`];
};
export const transf1THint = (p) => `ימינה ולמעלה השיעור גדל, שמאלה ולמטה הוא קטן. איזה שיעור שואלים, ${p.ask === 'x' ? 'שמאלה־ימינה' : 'למעלה־למטה'}?`;

// ---------------------------------------------------------------- transf:2 words
const mirrorTex = (t, k) => `${t === 0 ? 'x' : 'y'} = ${k}`;
export const transf2Text = (p) => `שקפו את $A${P([p.a, p.b])}$ ביחס לישר $${mirrorTex(p.t, p.k)}$. מה שיעור ה־$${p.t === 0 ? 'x' : 'y'}$ של $A'$?`;
export const transf2Fig = (p) => ({ type: 'coord', range: 6, points: [{ x: p.a, y: p.b, label: 'A' }], mirror: p.t === 0 ? { x: p.k } : { y: p.k } });
export const transf2Solution = (p) => {
  const v = p.t === 0 ? p.a : p.b; const ax = p.t === 0 ? 'x' : 'y';
  return [`$A$ רחוקה $${Math.abs(v - p.k)}$ מהישר.`, `$A'$ באותו מרחק בצד השני: $${ax} = 2 \\cdot ${paren(p.k)} - ${paren(v)} = ${2 * p.k - v}$`];
};
export const transf2Hint = () => 'כמה רחוקה הנקודה מהישר? באותו מרחק בצד השני.';
export const transf2TText = (p) => `בתוכנית של חדר (במטרים) תלויה מראה לאורך הקיר $x = ${p.k}$. מנורה נמצאת בנקודה $${P([p.a, p.b])}$. במראה רואים את המנורה כאילו היא מאחורי המראה, באותו מרחק ממנה. מה שיעור ה־$x$ של המנורה שרואים במראה?`;
export const transf2TSolution = (p) => [`המנורה רחוקה $${p.k - p.a}$ מטר מהמראה.`, `מאחורי המראה, באותו מרחק: $x = ${p.k} + ${p.k - p.a} = ${2 * p.k - p.a}$`];

// ---------------------------------------------------------------- transf:3 words
export const transf3Text = (p) => `מסובבים את $A${P([p.a1, p.a2])}$ ב־$180°$ סביב $O${P([p.c1, p.c2])}$. מה שיעור ה־$${p.ask}$ של $A'$?`;
export const transf3Fig = (p) => ({ type: 'coord', range: 6, points: [{ x: p.a1, y: p.a2, label: 'A' }], centre: [p.c1, p.c2], turn: 180 });
export const transf3Solution = (p) => {
  const ask = p.ask === 'x'; const a = ask ? p.a1 : p.a2; const c = ask ? p.c1 : p.c2;
  return [`$A$ נמצאת $${a - c}$ מ־$O$ לאורך ציר ה־$${p.ask}$.`, `$A'$ באותו מרחק בצד השני: $2 \\cdot ${paren(c)} - ${paren(a)} = ${2 * c - a}$`];
};
export const transf3Hint = () => 'מדדו מ־$O$ אל $A$, והמשיכו אותו מרחק לצד השני של $O$.';
export const transf3TText = (p) => `באפליקציית ציור מסובבים ציור ב־$180°$ סביב הנקודה $O${P([p.c1, p.c2])}$. הנקודה $A${P([p.a1, p.a2])}$ של הציור עוברת ל־$A'$. מה שיעור ה־$${p.ask}$ שלה?`;

// ---------------------------------------------------------------- transf:4 words
/** A right trapezoid: the bases a (top) and b (bottom), the height h on the left, the slanted leg s on the right. */
const trap = (a, b, h, ox = 0) => [[ox, 0], [ox + b, 0], [ox + a, h], [ox, h]];
/** The trapezoid and its image glued: mirrored along the height ('m'), or turned half a turn along the slanted leg ('t'). */
export function glueFig({ a, b, h, s, v }, label = true) {
  // v 'm': the image is the mirror image in the line x = 0 (the height); v 't': the half turn about the middle of s
  const T = trap(a, b, h);
  const img = v === 'm' ? T.map(([x, y]) => [-x, y]) : T.map(([x, y]) => [a + b - x, h - y]);
  const names = ['_P', '_Q', '_R', '_S'];
  const pts = Object.fromEntries([...T.map((p, i) => [names[i], p]), ...img.map((p, i) => [`${names[i]}2`, p])]);
  const lab = (x) => (label ? String(x) : undefined);
  return {
    type: 'geo', label: v === 'm' ? `טרפז ישר־זווית ותמונת המראה שלו, צמודים לאורך הגובה ${h}` : `טרפז ישר־זווית ועותק שלו מסובב, צמודים לאורך השוק המשופעת ${s}`,
    pts,
    polys: [{ pts: names }, { pts: names.map((n) => `${n}2`) }],
    segs: [
      { a: '_P', b: '_Q', label: lab(b) }, { a: '_S', b: '_R', label: lab(a) },
      { a: '_P', b: '_S', label: lab(h), dash: v === 'm' }, { a: '_Q', b: '_R', label: lab(s), dash: v === 't' },
    ],
    angles: [{ at: '_P', from: '_Q', to: '_S', right: true }],
    view: [320, 200], pad: [30, 26],
  };
}
export const glueText = (p) => `טרפז ישר־זווית: בסיסים $${p.a}$ ו־$${p.b}$, גובה $${p.h}$, השוק המשופעת $${p.s}$. ${p.v === 'm' ? 'משקפים אותו ביחס לגובה, ומצמידים את הטרפז ואת תמונת המראה שלו לאורך הגובה' : 'מסובבים עותק שלו ב־$180°$, ומצמידים את שני הטרפזים לאורך השוק המשופעת'}. מה ההיקף של הצורה החדשה?`;
export const glueSolution = (p) => (p.v === 'm'
  ? ['הצורה החדשה היא טרפז שווה־שוקיים. הגובה בפנים, ולא נספר.', `בסיסים $${2 * p.a}$ ו־$${2 * p.b}$, ושתי שוקיים $${p.s}$: $${2 * p.a} + ${2 * p.b} + ${p.s} + ${p.s} = ${2 * p.a + 2 * p.b + 2 * p.s}$`]
  : ['נוצר מלבן: הצלע הארוכה היא שני הבסיסים יחד, $' + `${p.a} + ${p.b} = ${p.a + p.b}` + '$, והקצרה היא הגובה.', `$2 \\cdot ${p.a + p.b} + 2 \\cdot ${p.h} = ${2 * (p.a + p.b) + 2 * p.h}$`]);
export const glueHint = () => 'היקף הוא רק השפה. הצלע שבה מצמידים נכנסת פנימה, ולא נספרת.';
export const transf4TText = (p) => `שני אריחים חופפים בצורת טרפז ישר־זווית (בסיסים $${p.a}$ ו־$${p.b}$ ס״מ, גובה $${p.h}$ ס״מ, שוק משופעת $${p.s}$ ס״מ). מניחים אחד מסובב לצד השני ויוצרים מלבן. מה ההיקף שלו, בס״מ?`;

// ---------------------------------------------------------------- transf:1 generators
/** A right triangle ABC with the right angle at B: legs along the grid, every vertex on the plane. */
function rightTriangle(r, x, y) {
  for (;;) {
    const w = sgnPick(r, 1, 3); const h = sgnPick(r, 1, 3);
    if (inR(x + w) && inR(y + h)) return [[x, y + h], [x, y], [x + w, y]];
  }
}
/** ABC slid by a stated shift: the coordinates of B' (models.mjs GEN slidePt). */
function slidePt() {
  for (;;) {
    const x = rint(rnd, -5, 5); const y = rint(rnd, -5, 5); const dx = sgnPick(rnd, 2, 5); const dy = sgnPick(rnd, 2, 5);
    if (Math.abs(dx) === Math.abs(dy) || !inR(x + dx) || !inR(y + dy)) continue;
    const ans = [x + dx, y + dy]; const pr = [x, y, Math.abs(dx), Math.abs(dy)];
    if (pr.includes(ans[0]) && pr.includes(ans[1])) continue;
    const preds = { 'shift-sign': [[x - dx, y + dy], [x + dx, y - dy]], 'shift-swap': [[x + dy, y + dx]], 'one-axis': [[x + dx, y], [x, y + dy]] };
    if (!distinctPreds(ans, preds)) continue;
    const tri = rightTriangle(rnd, x, y);
    return {
      key: `tf1s:${x}:${y}:${dx}:${dy}`, text: `המשולש $ABC$ מוזז ${shiftWords(dx, dy, ' יחידות')}. מה שיעורי $B'$?`,
      form: 'pt', answer: ans, label: "B'", fig: shapeFig(tri),
      hint: 'כל נקודה זזה אותה הזזה: ימינה ולמעלה מוסיפים, שמאלה ולמטה מחסירים.',
      solution: [`$B${P([x, y])}$. ההזזה: $${dx}$ ב־$x$ ו־$${dy}$ ב־$y$.`, `$B'(${x} + ${paren(dx)}, ${y} + ${paren(dy)}) = B'${P(ans)}$`],
      diag: ptDiag(preds),
    };
  }
}
/** A → A' given: where C goes (the model's draws, models.mjs GEN vectorPt). */
function vectorPt() {
  for (;;) {
    const p = TRANSF1.raw(rnd); if (!p) continue;
    const ans = [p.c1 + p.dx, p.c2 + p.dy]; const pr = TRANSF1.printed(p);
    if (pr.includes(ans[0]) && pr.includes(ans[1])) continue;
    const { c1, c2, dx, dy } = p;
    const preds = { 'shift-sign': [[c1 - dx, c2 + dy], [c1 + dx, c2 - dy]], 'shift-swap': [[c1 + dy, c2 + dx]], 'one-axis': [[c1 + dx, c2], [c1, c2 + dy]] };
    if (!distinctPreds(ans, preds)) continue;
    const a2 = [p.a1 + dx, p.a2 + dy];
    return {
      key: `tf1v:${p.a1}:${p.a2}:${a2[0]}:${a2[1]}:${c1}:${c2}`,
      text: `בהזזה $A${P([p.a1, p.a2])}$ עוברת ל־$A'${P(a2)}$. באותה הזזה $C${P([c1, c2])}$ עוברת ל־$C'$. מה שיעורי $C'$?`,
      form: 'pt', answer: ans, label: "C'", fig: transf1Fig(p),
      hint: transf1Hint(),
      solution: [`מ־$A$ ל־$A'$: $${dx}$ ב־$x$ ו־$${dy}$ ב־$y$.`, `$C'(${c1} + ${paren(dx)}, ${c2} + ${paren(dy)}) = C'${P(ans)}$`],
      diag: ptDiag(preds),
    };
  }
}
/** A scalene triangle on the grid (no two sides equal), within `lim` of the origin. */
function scalene(r, lim = 4) {
  for (;;) {
    const pts = [[rint(r, -lim, lim), rint(r, -lim, lim)]];
    pts.push([pts[0][0] + sgnPick(r, 2, 4), pts[0][1] + rint(r, -1, 1)]);
    pts.push([pts[0][0] + rint(r, -1, 1), pts[0][1] + sgnPick(r, 2, 3)]);
    const d = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    const s = [d(pts[0], pts[1]), d(pts[1], pts[2]), d(pts[2], pts[0])];
    const area2 = Math.abs((pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[2][0] - pts[0][0]) * (pts[1][1] - pts[0][1]));
    if (new Set(s).size === 3 && area2 >= 3 && onPlane(pts)) return pts;
  }
}
/** Slide the copy by a stated shift (drag only): practice only. */
function slideCopy() {
  for (;;) {
    const tri = scalene(rnd); const dx = sgnPick(rnd, 1, 5); const dy = sgnPick(rnd, 1, 4);
    const goal = slide(tri, dx, dy);
    if (!onPlane(goal)) continue;
    return {
      key: `tf1c:${tri.flat().join(',')}:${dx}:${dy}`, text: `הזיזו את המשולש ${shiftWords(dx, dy)}.`,
      form: 'manip', practiceOnly: true,
      manip: { kind: 'transform', shape: { pts: tri, names: NAMES }, moves: { drag: true } },
      answer: { pts: goal },
      hint: `כל לחיצה על חץ מזיזה משבצת אחת: $${Math.abs(dx)}$ ${horiz(dx)} ו־$${Math.abs(dy)}$ ${vert(dy)}.`,
      solution: [`כל קודקוד זז ${shiftWords(dx, dy)}: $A${P(tri[0])} \\to A'${P(goal[0])}$.`],
      diag: () => null,
    };
  }
}
/** Which slide takes ABC to A'B'C'? The slide, the shifts swapped, the slide back, and the gap between them. */
function whichShift() {
  for (;;) {
    const w = rint(rnd, 1, 2); const h = rint(rnd, 1, 2);
    const dx = sgnPick(rnd, w + 1, 5); const dy = sgnPick(rnd, h + 1, 4);
    if (Math.abs(dx) === Math.abs(dy)) continue;
    const x0 = rint(rnd, -6, 6 - w); const y0 = rint(rnd, -6, 6 - h);
    const tri = [[x0, y0 + h], [x0, y0], [x0 + w, y0]];
    const img = slide(tri, dx, dy);
    if (!onPlane(img)) continue;
    const gap = [Math.sign(dx) * (Math.abs(dx) - w), Math.sign(dy) * (Math.abs(dy) - h)];
    const opts = [{ d: [dx, dy], ok: true }, { d: [dy, dx], bug: 'shift-swap' }, { d: [-dx, -dy], bug: 'shift-sign' }, { d: gap, bug: 'gap' }];
    const keys = opts.map((o) => o.d.join(','));
    if (new Set(keys).size < 4 || gap.some((v) => v === 0)) continue;
    const choices = shuffle(opts.map((o) => ({ text: shiftPlain(o.d[0], o.d[1]), ok: !!o.ok, bug: o.bug })));
    return {
      key: `tf1w:${dx}:${dy}:${w}:${h}`, text: 'איזו הזזה מעבירה את $ABC$ ל־$A\'B\'C\'$?',
      form: 'mc', practiceOnly: true, choices, answer: choices.findIndex((c) => c.ok),
      fig: { type: 'coord', range: 6, shapes: [{ pts: tri, names: NAMES }, { pts: img, names: ['A′', 'B′', 'C′'], tone: 'alt' }] },
      hint: 'מודדים מנקודה לתמונה שלה: מ־$A$ ל־$A\'$.',
      solution: [`מ־$A${P(tri[0])}$ ל־$A'${P(img[0])}$: ${shiftWords(dx, dy)}.`, 'הרווח בין המשולשים קטן מההזזה: הוא תלוי ברוחב המשולש.'],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- transf:2 generators
/** Reflect A(x, y) in an axis: the coordinates of A' (models.mjs GEN reflectAxis). */
function reflectAxis() {
  for (;;) {
    const x = sgnPick(rnd, 1, 6); const y = sgnPick(rnd, 1, 6); if (Math.abs(x) === Math.abs(y)) continue;
    const ax = rnd() < 0.5 ? 'x' : 'y'; const ans = ax === 'x' ? [x, -y] : [-x, y];
    const preds = { 'wrong-axis': [ax === 'x' ? [-x, y] : [x, -y]], 'both-signs': [[-x, -y]], 'rot-swap': [[y, x]] };
    if (!distinctPreds(ans, preds)) continue;
    return {
      key: `tf2a:${x}:${y}:${ax}`, text: `שקפו את הנקודה $A${P([x, y])}$ ביחס לציר ה־$${ax}$. מה שיעורי $A'$?`,
      form: 'pt', answer: ans, label: "A'", fig: { type: 'coord', range: 6, points: [{ x, y, label: 'A' }], mirror: ax },
      hint: `ציר ה־$${ax}$ ${ax === 'x' ? 'אופקי: הנקודה עוברת למעלה או למטה' : 'אנכי: הנקודה עוברת ימינה או שמאלה'}, באותו מרחק.`,
      solution: [`ביחס לציר ה־$${ax}$ השיעור $${ax === 'x' ? 'y' : 'x'}$ מחליף סימן, והשני נשאר.`, `$A'${P(ans)}$`],
      diag: ptDiag(preds),
    };
  }
}
/** Reflect A(a, b) in x = k or y = k (the model's draws, models.mjs GEN reflectLine). */
function reflectLine() {
  for (;;) {
    const p = TRANSF2.raw(rnd); if (!p) continue;
    // a point on an axis has its letter beside the mirror line, where it reads as the line's: not drawn
    if (p.a === 0 || p.b === 0) continue;
    const { t, k, a, b } = p;
    const ans = t === 0 ? [2 * k - a, b] : [a, 2 * k - b];
    const preds = { 'axis-not-line': [t === 0 ? [-a, b] : [a, -b]], 'wrong-axis': [t === 0 ? [a, 2 * k - b] : [2 * k - a, b]] };
    if (!distinctPreds(ans, preds)) continue;
    const ax = t === 0 ? 'x' : 'y'; const v = t === 0 ? a : b;
    return {
      key: `tf2l:${t}:${k}:${a}:${b}`, text: `שקפו את $A${P([a, b])}$ ביחס לישר $${mirrorTex(t, k)}$. מה שיעורי $A'$?`,
      form: 'pt', answer: ans, label: "A'", fig: transf2Fig(p),
      hint: transf2Hint(),
      solution: [`$A$ רחוקה $${Math.abs(v - k)}$ מהישר $${mirrorTex(t, k)}$, ולכן $A'$ באותו מרחק בצד השני: $${ax} = 2 \\cdot ${paren(k)} - ${paren(v)} = ${2 * k - v}$.`, `השיעור השני לא משתנה: $A'${P(ans)}$`],
      diag: ptDiag(preds),
    };
  }
}
/** The mirror lines a copy can be flipped in, by kind. */
const MIRRORS = (r) => pick(r, ['x', 'y', { x: sgnPick(r, 1, 3) }, { y: sgnPick(r, 1, 3) }]);
/** Flip the copy in the dashed line (and slide it, which never makes a mirror image): practice only. */
function mirrorCopy() {
  for (;;) {
    const tri = scalene(rnd); const mr = MIRRORS(rnd);
    const goal = reflect(tri, mr);
    if (!onPlane(goal) || goal.every((p, i) => samePt(p, tri[i]))) continue;
    const id = typeof mr === 'string' ? mr : mr.x != null ? `x=${mr.x}` : `y=${mr.y}`;
    return {
      key: `tf2c:${tri.flat().join(',')}:${id}`, text: 'שקפו את המשולש ביחס לישר המקווקו.',
      form: 'manip', practiceOnly: true,
      manip: { kind: 'transform', shape: { pts: tri, names: NAMES }, moves: { drag: true, flips: [mr] } },
      answer: { pts: goal },
      hint: 'הזזה לא הופכת את הצורה. לחצו על כפתור השיקוף.',
      solution: [`כל קודקוד עובר לצד השני של הישר, באותו מרחק: $A${P(tri[0])} \\to A'${P(goal[0])}$.`],
      diag: () => null,
    };
  }
}
/** The shapes whose axes of symmetry are counted: name, count, a drawing (and the count with the diagonals added). */
const SYM_SHAPES = {
  square: { name: 'ריבוע', n: 4, pts: [[0, 0], [3, 0], [3, 3], [0, 3]] },
  rectangle: { name: 'מלבן', n: 2, pts: [[0, 0], [5, 0], [5, 3], [0, 3]], diag: 4 },
  rhombus: { name: 'מעוין', n: 2, pts: [[0, 0], [3, 2], [0, 4], [-3, 2]] },
  equilateral: { name: 'משולש שווה צלעות', n: 3, pts: [[0, 0], [4, 0], [2, 2 * Math.sqrt(3)]] },
  isosceles: { name: 'משולש שווה־שוקיים', n: 1, pts: [[0, 0], [4, 0], [2, 4]] },
  kite: { name: 'דלתון', n: 1, pts: [[0, 0], [2, 1.5], [0, 5], [-2, 1.5]] },
  hexagon: { name: 'משושה משוכלל', n: 6, pts: [0, 60, 120, 180, 240, 300].map((a) => [2 * Math.cos((a * Math.PI) / 180), 2 * Math.sin((a * Math.PI) / 180)]) },
  parallelogram: { name: 'מקבילית', n: 0, pts: [[0, 0], [4, 0], [5.5, 2.5], [1.5, 2.5]], diag: 2 },
};
const shapeGeo = (sh, label) => ({
  type: 'geo', label,
  pts: Object.fromEntries(sh.pts.map((p, i) => [`_${i}`, p])),
  polys: [{ pts: sh.pts.map((_, i) => `_${i}`) }],
  view: [260, 170], pad: [28, 20],
});
/** How many axes of symmetry: practice only (one count per shape). */
function symAxes() {
  const id = pick(rnd, Object.keys(SYM_SHAPES)); const sh = SYM_SHAPES[id];
  return {
    key: `tf2s:${id}`, text: `כמה צירי סימטריה יש ל${sh.name}?`, form: 'num', practiceOnly: true, answer: sh.n,
    fig: shapeGeo(sh, sh.name),
    hint: 'ציר סימטריה הוא ישר שאם מקפלים לאורכו, שני החלקים נופלים זה על זה בדיוק.',
    solution: [sh.n ? `ל${sh.name} ${sh.n === 1 ? 'ציר סימטריה אחד' : `$${sh.n}$ צירי סימטריה`}.` : `למקבילית אין ציר סימטריה: קיפול לאורך אלכסון או דרך אמצעי הצלעות לא מניח חצי על חצי.`,
      ...(sh.diag ? ['האלכסונים מחלקים אותה לשני חלקים שווים, אבל קיפול לאורכם לא מניח חלק על חלק.'] : [])],
    diag: (u) => (sh.diag != null && u === sh.diag ? 'diagonal-axis' : null),
  };
}

// ---------------------------------------------------------------- transf:3 generators
/** A half turn of A about the origin or a grid point (models.mjs GEN halfTurnPt). */
function halfTurnPt() {
  for (;;) {
    const o = rnd() < 0.5; const c1 = o ? 0 : rint(rnd, -2, 2); const c2 = o ? 0 : rint(rnd, -2, 2);
    const x = rint(rnd, -5, 5); const y = rint(rnd, -5, 5);
    if ((x === c1 && y === c2) || x === 0 || y === 0 || x === c1 || y === c2) continue;
    const ans = [2 * c1 - x, 2 * c2 - y]; if (!inR(ans[0]) || !inR(ans[1])) continue;
    const origin = c1 === 0 && c2 === 0;
    const preds = { ...(origin ? {} : { 'wrong-centre': [[-x, -y]] }), 'reflect-not-turn': [[x, 2 * c2 - y], [2 * c1 - x, y]] };
    if (!distinctPreds(ans, preds)) continue;
    return {
      key: `tf3h:${x}:${y}:${c1}:${c2}`,
      text: `מסובבים את $A${P([x, y])}$ ב־$180°$ סביב ${origin ? 'ראשית הצירים, $O(0, 0)$' : `$O${P([c1, c2])}$`}. מה שיעורי $A'$?`,
      form: 'pt', answer: ans, label: "A'", fig: { type: 'coord', range: 6, points: [{ x, y, label: 'A' }], centre: [c1, c2], turn: 180 },
      hint: transf3Hint(),
      solution: [`מ־$O$ אל $A$: $${x - c1}$ ב־$x$ ו־$${y - c2}$ ב־$y$.`, `אחרי חצי סיבוב אותם צעדים בכיוון ההפוך: $A'(${c1} - ${paren(x - c1)}, ${c2} - ${paren(y - c2)}) = A'${P(ans)}$`],
      diag: ptDiag(preds),
    };
  }
}
/** A quarter turn about the origin, either way (models.mjs GEN quarterPt). */
function quarterPt() {
  for (;;) {
    const x = sgnPick(rnd, 1, 6); const y = sgnPick(rnd, 1, 6); if (Math.abs(x) === Math.abs(y)) continue;
    const cw = rnd() < 0.5; const ans = cw ? [y, -x] : [-y, x]; const other = cw ? [-y, x] : [y, -x];
    const preds = { 'rot-swap': [[y, x]], 'turn-direction': [other] };
    if (!distinctPreds(ans, preds)) continue;
    return {
      key: `tf3q:${x}:${y}:${cw ? 'cw' : 'ccw'}`,
      text: `מסובבים את $A${P([x, y])}$ ב־$90°$ ${cw ? 'עם' : 'נגד'} כיוון השעון סביב ראשית הצירים. מה שיעורי $A'$?`,
      form: 'pt', answer: ans, label: "A'", fig: { type: 'coord', range: 6, points: [{ x, y, label: 'A' }], centre: [0, 0], turn: cw ? -90 : 90 },
      hint: cw ? 'עם כיוון השעון: "ימינה" נעשה "למטה", ו"למעלה" נעשה "ימינה".' : 'נגד כיוון השעון: "ימינה" נעשה "למעלה", ו"למעלה" נעשה "שמאלה".',
      solution: [`מ־$O$ אל $A$: ${shiftWords(x, y)}.`, `${cw ? 'עם' : 'נגד'} כיוון השעון הצעדים מסתובבים יחד עם הנקודה: $A'${P(ans)}$`],
      diag: ptDiag(preds),
    };
  }
}
/** Turn the copy about a marked O (and slide it): practice only. */
function turnCopy() {
  for (;;) {
    const tri = scalene(rnd, 3); const centre = rnd() < 0.5 ? [0, 0] : [rint(rnd, -2, 2), rint(rnd, -2, 2)];
    const by = pick(rnd, [90, -90, 180]);
    const goal = turn(tri, centre, by);
    // the corners stay two squares clear of the centre, so O and its turn are seen, and it is never a turn about a corner
    if (!onPlane(goal) || tri.some(([x, y]) => (x - centre[0]) ** 2 + (y - centre[1]) ** 2 < 4)) continue;
    const words = by === 180 ? 'חצי סיבוב' : `$90°$ ${by > 0 ? 'נגד' : 'עם'} כיוון השעון`;
    return {
      key: `tf3c:${tri.flat().join(',')}:${centre.join(',')}:${by}`,
      text: `סובבו את המשולש ${by === 180 ? 'חצי סיבוב' : `ב־${words}`} סביב $O${P(centre)}$.`,
      form: 'manip', practiceOnly: true,
      manip: { kind: 'transform', shape: { pts: tri, names: NAMES }, moves: { drag: true, turns: { centre, by: Math.abs(by) === 180 ? 180 : 90 } } },
      answer: { pts: goal },
      hint: `לחצו על כפתור הסיבוב: ${by === 180 ? 'חצי סיבוב' : by > 0 ? 'נגד כיוון השעון' : 'עם כיוון השעון'}. הזזה לא מסובבת.`,
      solution: [`כל קודקוד מסתובב סביב $O$ ונשאר באותו מרחק ממנו: $A${P(tri[0])} \\to A'${P(goal[0])}$.`],
      diag: () => null,
    };
  }
}
/** The least turn that brings a shape back onto itself: practice only. */
const ROT_SHAPES = {
  square: { name: 'ריבוע', deg: 90, sh: SYM_SHAPES.square },
  equilateral: { name: 'משולש שווה צלעות', deg: 120, sh: SYM_SHAPES.equilateral },
  hexagon: { name: 'משושה משוכלל', deg: 60, sh: SYM_SHAPES.hexagon },
  rectangle: { name: 'מלבן', deg: 180, sh: SYM_SHAPES.rectangle },
};
function rotSym() {
  const id = pick(rnd, Object.keys(ROT_SHAPES)); const s = ROT_SHAPES[id];
  return {
    key: `tf3r:${id}`, text: `בכמה מעלות לפחות צריך לסובב ${id === 'equilateral' ? 'משולש שווה צלעות' : s.name} סביב המרכז שלו כדי שייראה שוב אותו דבר?`,
    form: 'num', practiceOnly: true, answer: s.deg, unit: 'מעלות',
    fig: shapeGeo(s.sh, s.name),
    hint: 'סיבוב שלם הוא $360°$. כמה פעמים בסיבוב שלם הצורה נראית שוב אותו דבר?',
    solution: [id === 'rectangle' ? 'מלבן נראה שוב אותו דבר רק אחרי חצי סיבוב: $180°$.' : `${s.name}: $360° : ${360 / s.deg} = ${s.deg}°$.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- transf:4 generators
/** A trapezoid glued to its image: the perimeter (the model's draws). */
function glue() {
  const p = TRANSF4.params(rnd); const ans = TRANSF4.answer(p);
  return {
    key: `tf4g:${p.a}:${p.b}:${p.h}:${p.s}:${p.v}`, text: glueText(p), form: 'num', answer: ans, fig: glueFig(p),
    hint: glueHint(), solution: glueSolution(p),
    diag: (u) => (u === TRANSF4.bugs['double-perimeter'](p) ? 'double-perimeter' : null),
  };
}
/** Asymmetric shapes for "which move": a scalene right triangle and an L whose arms differ. */
const MOVE_SHAPES = [
  [[0, 0], [3, 0], [0, 2]],
  [[0, 0], [3, 0], [3, 1], [1, 1], [1, 2], [0, 2]],
];
/** A shape with the same area that is not the same shape (for the pairs that are not congruent). */
const SAME_AREA = [
  [[0, 0], [1, 0], [1, 3], [0, 3]], // the triangle 3 by 2 has area 3; a 1 by 3 rectangle too
  [[0, 0], [2, 0], [2, 2], [0, 2]], // the L of four squares; a 2 by 2 square too
];
const MOVE_NAMES = { slide: 'הזזה', flip: 'שיקוף', turn: 'סיבוב', none: 'הצורות לא חופפות' };
/** Which one move takes shape א to shape ב (or are they not congruent)? Practice only. */
function whichMove() {
  for (;;) {
    const k = rint(rnd, 0, 1); const base = MOVE_SHAPES[k];
    const type = rnd() < 0.25 ? 'none' : pick(rnd, ['slide', 'flip', 'turn']);
    const a = slide(base, rint(rnd, -6, 0), rint(rnd, -6, 0));
    let b;
    if (type === 'slide') b = slide(a, sgnPick(rnd, 2, 6), sgnPick(rnd, 0, 4));
    else if (type === 'flip') b = reflect(a, rnd() < 0.5 ? { x: rint(rnd, -1, 3) } : { y: rint(rnd, -1, 3) });
    else if (type === 'turn') b = turn(a, [rint(rnd, -1, 2), rint(rnd, -1, 2)], pick(rnd, [90, -90, 180]));
    else b = slide(SAME_AREA[k], rint(rnd, 1, 4), rint(rnd, 0, 3));
    if (!onPlane(a) || !onPlane(b)) continue;
    // apart on the plane: no vertex of one inside the other's box
    const box = (s) => [Math.min(...s.map((p) => p[0])), Math.max(...s.map((p) => p[0])), Math.min(...s.map((p) => p[1])), Math.max(...s.map((p) => p[1]))];
    const [ax0, ax1, ay0, ay1] = box(a); const [bx0, bx1, by0, by1] = box(b);
    if (!(ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0)) continue;
    const order = ['slide', 'flip', 'turn', 'none'];
    const choices = order.map((t) => ({ text: MOVE_NAMES[t], ok: t === type, bug: type === 'none' && t !== 'none' ? 'equal-area' : undefined }));
    return {
      key: `tf4m:${type}:${k}:${a.flat().join(',')}:${b.flat().join(',')}`, text: 'איזו תנועה מעבירה את צורה א׳ לצורה ב׳?',
      form: 'mc', practiceOnly: true, choices, answer: order.indexOf(type),
      fig: { type: 'coord', range: 6, shapes: [{ pts: a, label: 'א' }, { pts: b, label: 'ב', tone: 'alt' }] },
      hint: 'הצורה ב׳ הפוכה, כמו במראה? מסובבת? או רק במקום אחר?',
      solution: [type === 'none' ? 'לשתי הצורות אותו שטח, אבל הן לא אותה צורה: אף תנועה לא מניחה אחת על השנייה.'
        : type === 'slide' ? 'הצורה רק עברה למקום אחר, באותו כיוון: הזזה.' : type === 'flip' ? 'הצורה הפוכה, כמו במראה: שיקוף.' : 'הצורה מסובבת, ולא הפוכה: סיבוב.'],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}
/** Two rectangles: congruent? Pairs of equal area, of equal perimeter, or the same rectangle turned. Practice only. */
const RECT_PAIRS = [
  [4, 3, 6, 2], [6, 2, 4, 3], [8, 3, 6, 4], [6, 4, 8, 3], [9, 2, 6, 3], [12, 2, 8, 3], // equal areas
  [5, 1, 3, 3], [5, 2, 4, 3], [6, 2, 5, 3], [7, 1, 4, 4], [6, 1, 4, 3], // equal perimeters
  [4, 3, 3, 4], [5, 2, 2, 5], [6, 3, 3, 6], // the same rectangle, turned
];
function rectCong() {
  const [a, b, c, d] = pick(rnd, RECT_PAIRS);
  const same = a === d && b === c;
  const tag = same ? null : a * b === c * d ? 'equal-area' : 'equal-perimeter';
  const options = shuffle([{ text: 'כן', ok: same, bug: same ? undefined : tag }, { text: 'לא', ok: !same }]);
  const two = {
    type: 'geo', label: `מלבן ${a} על ${b} ומלבן ${c} על ${d}`,
    pts: { _A: [0, 0], _B: [a, 0], _C: [a, b], _D: [0, b], _E: [a + 1.5, 0], _F: [a + 1.5 + c, 0], _G: [a + 1.5 + c, d], _H: [a + 1.5, d] },
    polys: [{ pts: ['_A', '_B', '_C', '_D'] }, { pts: ['_E', '_F', '_G', '_H'] }],
    segs: [{ a: '_A', b: '_B', label: String(a) }, { a: '_B', b: '_C', label: String(b) }, { a: '_E', b: '_F', label: String(c) }, { a: '_F', b: '_G', label: String(d) }],
    view: [320, 170], pad: [28, 26],
  };
  return {
    key: `tf4r:${a}:${b}:${c}:${d}`, text: `המלבנים $${a} \\times ${b}$ ו־$${c} \\times ${d}$ חופפים?`,
    form: 'mc', practiceOnly: true, choices: options, answer: options.findIndex((o) => o.ok), fig: two,
    hint: 'חופפים אם אפשר להניח אחד על השני בדיוק: כל הצלעות שוות.',
    solution: [same ? 'זה אותו מלבן, מסובב: הצלעות $' + `${a}` + '$ ו־$' + `${b}` + '$ בשניהם.'
      : tag === 'equal-area' ? `לשניהם אותו שטח, $${a * b}$, אבל הצלעות שונות: הם לא חופפים.` : `לשניהם אותו היקף, $${2 * (a + b)}$, אבל הצלעות שונות: הם לא חופפים.`],
    diag: (u) => options[u]?.bug || null,
  };
}
/** How many regular tiles meet at a point of a tiling (one shape per angle): practice only. */
const TILES = { 90: { name: 'ריבועים', one: 'ריבוע', n: 4, sides: 4 }, 60: { name: 'משולשים שווי צלעות', one: 'משולש שווה צלעות', n: 6, sides: 3 }, 120: { name: 'משושים משוכללים', one: 'משושה משוכלל', n: 3, sides: 6 } };
/**
 * Regular polygons with `sides` sides around one point: n tiles sharing the vertex (0, 0), each in its own wedge of
 * `wedge` degrees (its angle there; 360 / n when they fill the point, less for the pentagons that leave a gap).
 */
export function tilesAround(sides, n, wedge = 360 / n) {
  const ang = wedge; const pts = { O: [0, 0] }; const polys = [];
  for (let i = 0; i < n; i += 1) {
    // a regular polygon with one vertex at the origin, its angle there between the rays at i·ang and i·ang + its angle
    const a0 = (i * ang * Math.PI) / 180; const ext = (2 * Math.PI) / sides; const names = ['O'];
    let p = [0, 0]; let dir = a0;
    for (let k = 1; k < sides; k += 1) { p = [p[0] + Math.cos(dir), p[1] + Math.sin(dir)]; const nm = `_${i}_${k}`; pts[nm] = p; names.push(nm); dir += ext; }
    polys.push({ pts: names });
  }
  return { pts, polys };
}
function tiling() {
  const angle = pick(rnd, [90, 60, 120]); const t = TILES[angle];
  const { pts, polys } = tilesAround(t.sides, t.n);
  return {
    key: `tf4t:${angle}`, text: `ב${t.one} כל זווית $${angle}°$. כמה ${t.name} נפגשים בנקודה אחת של ריצוף?`,
    form: 'num', practiceOnly: true, answer: t.n,
    fig: { type: 'geo', label: `${t.name} סביב נקודה אחת`, pts, polys, dots: ['O'], hide: ['O'], view: [240, 200], pad: [22, 18] },
    hint: 'סביב נקודה יש סיבוב שלם, $360°$.',
    solution: [`$360 : ${angle} = ${t.n}$`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- the levels (content/transf.js calls these)
/** Each level's mix: the models' typed questions most of the time, the objects and the choices the rest. */
export const TRANSF_GENS = [
  () => { const r = Math.random(); return r < 0.35 ? slidePt() : r < 0.6 ? vectorPt() : r < 0.85 ? slideCopy() : whichShift(); },
  () => { const r = Math.random(); return r < 0.35 ? reflectAxis() : r < 0.6 ? reflectLine() : r < 0.85 ? mirrorCopy() : symAxes(); },
  () => { const r = Math.random(); return r < 0.3 ? halfTurnPt() : r < 0.6 ? quarterPt() : r < 0.85 ? turnCopy() : rotSym(); },
  () => { const r = Math.random(); return r < 0.35 ? glue() : r < 0.6 ? whichMove() : r < 0.8 ? rectCong() : tiling(); },
];
/** Each generator by name (tests draw every kind). */
export const TRANSF_KINDS = { slidePt, vectorPt, slideCopy, whichShift, reflectAxis, reflectLine, mirrorCopy, symAxes, halfTurnPt, quarterPt, turnCopy, rotSym, glue, whichMove, rectCong, tiling };
registerGens('transf', TRANSF_GENS);
