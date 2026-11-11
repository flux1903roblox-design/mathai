// The transform object (GEOM-2): move, flip and turn a copy of a shape on the grid. The student moves a copy
// (components/manip/Transform.jsx) with the moves the item lists: slides (drag, arrow keys, arrow buttons), a flip in
// each listed mirror (an axis, or the line x = k or y = k) and turns about one centre (quarter turns both ways, or a
// half turn). The copy's value is its vertices in the order of the shape's names, so A′ is always the image of A. A
// move that would put a vertex off the plane (|x| or |y| above the range) is refused.
//
// Everything about the kind is here: the moves in exact whole numbers, the search that says which poses the item's
// own moves can reach, checking, the words for the tutor and the teacher, and the words of the coord figure's still
// twin (shapes, arrows, a mirror, a centre and its turn). This file registers the kind with content/manip.js when it
// loads, so manipCorrect, manipText, manipPlain, manipSolution, manipWrong, figWords and figPlain answer for it; it is
// not part of the first screen. Whatever makes a transform item or draws the twin imports it: Transform.jsx,
// Figure.jsx, and the content of the geometry topics (curriculum stage 4).
import { registerManipKind, registerCoordWords, figNum } from './manip.js';

// ---------------------------------------------------------------- the moves
/** The plane's half-width when the item gives none. */
export const TF_RANGE = 6;
const z0 = (v) => v + 0; // never −0
/** The copy slid by (dx, dy). */
export const tfSlide = (pts, dx, dy) => pts.map(([x, y]) => [z0(x + dx), z0(y + dy)]);
/** The reflection in a mirror: 'x' (the x-axis), 'y' (the y-axis), { x: k } (the line x = k) or { y: k }. */
export function tfReflect(pts, mirror) {
  const f = mirror === 'x' ? ([x, y]) => [x, -y]
    : mirror === 'y' ? ([x, y]) => [-x, y]
      : mirror.x != null ? ([x, y]) => [2 * mirror.x - x, y] : ([x, y]) => [x, 2 * mirror.y - y];
  return pts.map((p) => f(p).map(z0));
}
/** A turn about `centre`: by 90 counterclockwise, −90 clockwise, 180 a half turn. */
export function tfRotate(pts, [a, b], by) {
  const f = Math.abs(by) === 180 ? ([x, y]) => [2 * a - x, 2 * b - y]
    : by === 90 ? ([x, y]) => [a - (y - b), b + (x - a)] : ([x, y]) => [a + (y - b), b - (x - a)];
  return pts.map((p) => f(p).map(z0));
}
/** Every vertex on the plane: |x| and |y| at most `range`. */
export const tfInside = (pts, range = TF_RANGE) => pts.every(([x, y]) => Math.abs(x) <= range && Math.abs(y) <= range);
/** The same vertices in the same order. */
export const tfSame = (p, q) => Array.isArray(p) && Array.isArray(q) && p.length === q.length && p.every((a, i) => a[0] === q[i][0] && a[1] === q[i][1]);
/** The same set of vertices, whatever their letters. */
export const tfSameSet = (p, q) => Array.isArray(p) && Array.isArray(q) && p.length === q.length
  && p.map((a) => a.join(',')).sort().join(';') === q.map((a) => a.join(',')).sort().join(';');
/** Where the copy starts: `start`, else on the original. */
export const tfStart = (m) => m.start || m.shape.pts;
/** A mirror as an id: 'x', 'y', 'x=2', 'y=-1'. */
export const mirrorId = (mr) => (typeof mr === 'string' ? mr : mr.x != null ? `x=${mr.x}` : `y=${mr.y}`);
/** Twice the signed area: positive when the vertices run counterclockwise. A flip changes its sign, a slide or a turn never. */
export const tfOrient = (pts) => pts.reduce((s, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return s + (x * v - u * y); }, 0);
/**
 * The item's moves, each a function of the copy's vertices: the four slides (with drag), a flip in each mirror, and
 * the turns (both quarter turns, or the half turn). `kind` is slide, flip or turn.
 */
export function tfMoves(m) {
  const out = [];
  if (m.moves?.drag) {
    [['left', -1, 0], ['right', 1, 0], ['up', 0, 1], ['down', 0, -1]].forEach(([id, dx, dy]) => out.push({ id, kind: 'slide', d: [dx, dy], apply: (p) => tfSlide(p, dx, dy) }));
  }
  (m.moves?.flips || []).forEach((mr) => out.push({ id: `flip:${mirrorId(mr)}`, kind: 'flip', mirror: mr, apply: (p) => tfReflect(p, mr) }));
  const t = m.moves?.turns;
  if (t) {
    (t.by === 180 ? [180] : [90, -90]).forEach((by) => out.push({ id: by === 180 ? 'half' : by > 0 ? 'ccw' : 'cw', kind: 'turn', by, centre: t.centre, apply: (p) => tfRotate(p, t.centre, by) }));
  }
  return out;
}
/**
 * Can the copy reach `goal` from its start with the item's own moves, never through a vertex off the plane? A search
 * over every pose the moves reach: the orientations its flips and turns make, each slid within the grid. With `match`
 * 'set', any copy that covers the goal's vertices counts, whatever its letters.
 */
export function transformReachable(m, goal, match = 'labels') {
  const range = m.range || TF_RANGE;
  const start = tfStart(m);
  if (!tfInside(start, range) || !tfInside(goal, range)) return false;
  const moves = tfMoves(m);
  const key = (p) => p.map((a) => a.join(',')).join(';');
  const done = (p) => (match === 'set' ? tfSameSet(p, goal) : tfSame(p, goal));
  const seen = new Set([key(start)]); const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    const p = queue[i];
    if (done(p)) return true;
    for (const mv of moves) {
      const q = mv.apply(p); const k = key(q);
      if (tfInside(q, range) && !seen.has(k)) { seen.add(k); queue.push(q); }
    }
  }
  return false;
}
/** The copy's images under each of the item's flips and turns (not its slides) that stay on the plane. */
export const tfImages = (m, pts) => tfMoves(m).filter((mv) => mv.kind !== 'slide').map((mv) => mv.apply(pts)).filter((q) => tfInside(q, m.range || TF_RANGE));

// ---------------------------------------------------------------- words
const ltr = (t) => `⁦${t}⁩`; // a run of maths inside Hebrew, isolated left to right
/** A vertex as written: (1, −1), with a real minus sign. */
export const tfPt = ([x, y]) => `(${figNum(x)}, ${figNum(y)})`;
/** A shape's name by its number of vertices. */
export const tfShapeName = (n) => (n === 3 ? 'משולש' : n === 4 ? 'מרובע' : 'מצולע');
/** A mirror in words: 'ציר y', 'x = 2'. */
export const mirrorWords = (mr) => (typeof mr === 'string' ? `ציר ${mr}` : mr.x != null ? `x = ${figNum(mr.x)}` : `y = ${figNum(mr.y)}`);
/** "ביחס לציר y" or "ביחס לישר x = 2". */
export const mirrorTo = (mr) => `ביחס ל${typeof mr === 'string' ? mirrorWords(mr) : `ישר ${mirrorWords(mr)}`}`;
/** A turn in words: 90° נגד כיוון השעון, 90° עם כיוון השעון, חצי סיבוב. */
export const turnWords = (by) => (Math.abs(by) === 180 ? 'חצי סיבוב' : `90° ${by > 0 ? 'נגד' : 'עם'} כיוון השעון`);
/** A slide in words: "4 ימינה ו־1 למעלה" (nothing for no slide). */
export const tfSlideWords = (dx, dy) => [dx && `${Math.abs(dx)} ${dx > 0 ? 'ימינה' : 'שמאלה'}`, dy && `${Math.abs(dy)} ${dy > 0 ? 'למעלה' : 'למטה'}`].filter(Boolean).join(' ו־');

// ---------------------------------------------------------------- the kind, as content/manip.js asks for it
registerManipKind('transform', {
  // exact whole numbers: every vertex in place, or (match 'set') the same vertices whatever their letters
  correct: (it, u) => (it.answer.match === 'set' ? tfSameSet(u, it.answer.pts) : tfSame(u, it.answer.pts)),
  // the answer ({ pts, match }) or the copy as it is: its vertices with their letters; a cover counts any letters
  text: (it, u) => {
    const pts = Array.isArray(u) ? u : u.pts;
    if (!Array.isArray(u) && u.match === 'set') return `העותק מכסה את ${ltr(pts.map(tfPt).join(', '))}`;
    return ltr(pts.map((q, i) => `${it.manip.shape.names[i]}′${tfPt(q)}`).join(', '));
  },
  // the setup for the tutor and the teacher: the shape, the moves, where the copy starts, the dashed target
  plain: (it) => {
    const m = it.manip; const { names, pts } = m.shape;
    const can = [m.moves?.drag && 'להזיז', ...(m.moves?.flips || []).map((mr) => `לשקף ${mirrorTo(mr)}`),
      m.moves?.turns && `לסובב ${m.moves.turns.by === 180 ? 'חצי סיבוב' : 'רבע סיבוב'} סביב O${tfPt(m.moves.turns.centre)}`].filter(Boolean);
    const start = m.start && !tfSame(m.start, pts) ? `; העותק מתחיל ב־${m.start.map(tfPt).join(', ')}` : '';
    const target = m.target ? `; יעד מקווקו: ${m.target.pts.map((q, i) => `${m.target.names?.[i] || ''}${tfPt(q)}`).join(', ')}` : '';
    return `[${tfShapeName(pts.length)} ${pts.map((q, i) => `${names[i]}${tfPt(q)}`).join(', ')}; אפשר ${can.join(', ')}${start}${target}]`;
  },
  solution: (it) => it.answer.pts.map((q) => [...q]),
  // one step right of the answer, one step left when right leaves the plane
  wrong: (it) => { const a = it.answer.pts; const right = tfSlide(a, 1, 0); return tfInside(right, it.manip.range || TF_RANGE) ? right : tfSlide(a, -1, 0); },
});

// ---------------------------------------------------------------- the coord figure's still twin (GEOM-2.8)
registerCoordWords({
  // its name for a screen reader: the shapes by name, the mirror's equation, the centre and the turn's way; never where
  // they are (an exercise may ask exactly that)
  words: (f) => [
    ...(f.shapes || []).map((sh) => `${tfShapeName(sh.pts.length)}${sh.names ? ` ${sh.names.join('')}` : ''}${sh.tone === 'ghost' ? ' מקווקו' : ''}`),
    f.arrows?.length && (f.arrows.length === 1 ? 'חץ מנקודה לתמונה שלה' : `${f.arrows.length} חצים מנקודות לתמונות שלהן`),
    f.mirror && (typeof f.mirror === 'string' ? `ישר השיקוף: ${mirrorWords(f.mirror)}` : `ישר השיקוף ${mirrorWords(f.mirror)}`),
    f.centre && `מרכז סיבוב O${f.turn ? `, חץ של ${turnWords(f.turn)}` : ''}`,
  ].filter(Boolean),
  // in words for the tutor and an answer key: every vertex, the arrows, the mirror, the centre and the turn
  plain: (f) => [
    f.shapes?.length && `צורות: ${f.shapes.map((sh) => (sh.names ? `${sh.names.join('')} (${sh.pts.map((q, i) => `${sh.names[i]}${tfPt(q)}`).join(', ')})` : `(${sh.pts.map(tfPt).join(', ')})`) + (sh.label ? ` ${sh.label}` : '')).join(', ')}`,
    ...(f.arrows || []).map((a) => `חץ מ־${tfPt(a.from)} ל־${tfPt(a.to)}${a.label ? ` (${a.label})` : ''}`),
    f.mirror && (typeof f.mirror === 'string' ? `ישר השיקוף: ${mirrorWords(f.mirror)}` : `ישר שיקוף ${mirrorWords(f.mirror)}`),
    f.centre && `מרכז סיבוב O${tfPt(f.centre)}${f.turn ? `, ${turnWords(f.turn)}` : ''}`,
  ].filter(Boolean),
});
