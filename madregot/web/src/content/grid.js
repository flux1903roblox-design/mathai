// The rules of the grid object (kind 'polygon', רשת משבצות; stage 2, MEASURE-1.1): checking a state, saying it in words,
// a solving state and a near miss, and the geometry the object and the tests share. It loads after the first screen and
// registers itself with content/manip.js (registerKind), which asks for it as soon as it loads; components/manip/
// GridShape.jsx imports it too, so wherever the object is drawn its rules are here.
import { registerKind, registerFigWords, figNum, labelPlain } from './manip.js';

// maths inside a Hebrew sentence is isolated left to right, so x = 5 never reads 5 = x
const ltr = (t) => `\u2066${t}\u2069`;

// A grid of cols × rows unit squares (at most 11 × 8). Points are lattice points (x, y), y up, (0, 0) the bottom-left
// corner; everything snaps to them. Four tasks, each with the value the object holds and the answer it is checked by:
//   rect   a rectangle from (0, 0) to its corner at (w, h)                                   value { w, h }
//          answer { mode: 'rect', area?, perim? } (every property given holds; both orientations are right), or
//          { mode: 'maxArea', perim } (that perimeter, and the largest area a whole-sided rectangle with it has)
//   move   a fixed outline `shape` and a `piece` ({ pts, name? }) moved whole cells          value { dx, dy }
//          answer { mode: 'move', dx, dy } (the piece fills the gap)
//   cut    a fixed outline `shape` cut along one grid line, across or along                  value { axis, at }
//          (axis names the coordinate that is fixed: { axis: 'y', at: 4 } is the line y = 4, a cut across)
//          answer { mode: 'cut', lines: [{ axis, at }, …] } (each line leaves two rectangles)
//   apex   a triangle on `base` ({ x0, x1, h, y? }) whose top vertex slides on the line y = base.y + h   value { x }
//          answer { mode: 'apex', xs: [x, …] } (every x listed is right)
export const GRID_MAX = [11, 8];
/** A shape's area by the shoelace formula (its points in order, either way round). */
export const polyArea = (pts) => Math.abs(pts.reduce((a, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return a + x * v - u * y; }, 0)) / 2;
/** The largest area of a rectangle with whole sides and perimeter P: ⌊P/4⌋ · (P/2 − ⌊P/4⌋). */
export const maxRectArea = (P) => { const q = Math.floor(P / 4); return q * (P / 2 - q); };
/** The smallest and largest x and y of some points. */
export const boundsOf = (pts) => ({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) });
/** The part of a shape on one side of an axis line: { axis: 'x', at } keeps x ≤ at (side −1) or x ≥ at (side 1). */
function clipSide(pts, axis, at, side) {
  const k = axis === 'x' ? 0 : 1; const inside = (p) => side * (p[k] - at) >= -1e-9;
  const out = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    if (inside(p)) out.push(p);
    if (inside(p) !== inside(q)) { const t = (at - p[k]) / (q[k] - p[k]); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  });
  return out;
}
/** A shape cut along a line: the two parts' areas, the left (or lower) one first. */
export function cutAreas(shape, { axis, at }) {
  return [-1, 1].map((side) => { const part = clipSide(shape, axis, at, side); return part.length >= 3 ? polyArea(part) : 0; });
}
/** A polygon without repeated corners and without corners on a straight line (or doubling back along one). */
function simplify(pts) {
  let out = [...pts];
  for (let changed = true; changed && out.length > 2;) {
    changed = false;
    for (let i = 0; i < out.length; i += 1) {
      const a = out[(i + out.length - 1) % out.length]; const b = out[i]; const c = out[(i + 1) % out.length];
      if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9) { out = out.filter((_, k) => k !== i); changed = true; break; }
    }
  }
  return out;
}
/** Does a cut leave two parts that are each a rectangle (four corners, filling the box around them)? */
export function cutMakesRectangles(shape, cut) {
  return [-1, 1].every((side) => {
    const part = simplify(clipSide(shape, cut.axis, cut.at, side));
    if (part.length !== 4) return false;
    const b = boundsOf(part); const area = polyArea(part);
    return area > 0 && Math.abs(area - (b.x1 - b.x0) * (b.y1 - b.y0)) < 1e-9;
  });
}
/** The lines a cut can be on: the grid lines strictly inside the shape, across (axis y) or along (axis x). */
export function cutRange(m, axis) {
  const b = boundsOf(m.shape);
  return axis === 'x' ? [b.x0 + 1, b.x1 - 1] : [b.y0 + 1, b.y1 - 1];
}
/** Where a moving piece may go: dx (and dy) keep it on the grid. */
export function moveRange(m) {
  const b = boundsOf(m.piece.pts); const [cols, rows] = m.grid;
  return { dx: [-b.x0, cols - b.x1], dy: [-b.y0, rows - b.y1] };
}
/** The piece moved by { dx, dy }. */
export const movedPts = (m, { dx = 0, dy = 0 }) => m.piece.pts.map(([x, y]) => [x + dx, y + dy]);
/** The apex at x: the triangle's three corners. */
export const apexPts = (m, x) => { const y = m.base.y || 0; return [[m.base.x0, y], [m.base.x1, y], [x, y + m.base.h]]; };
/** The step controls the grid object shows for a task (the cut's direction is a pair of buttons, 'axis'). */
export const gridControls = (m, answer) => (m.task === 'rect' ? ['w', 'h'] : m.task === 'move' ? ['dx', ...(answer?.dy ? ['dy'] : [])] : m.task === 'cut' ? ['axis', 'at'] : m.task === 'apex' ? ['x'] : []);
/**
 * One press of a control (dir −1 or 1), kept on the grid: the steppers, the arrow keys and the tests all move the
 * object through here. 'axis' turns the cut the other way and puts it in the middle of the shape.
 */
export function gridStep(m, v, key, dir, answer) {
  const c = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const [cols, rows] = m.grid;
  switch (key) {
    case 'w': return { w: c(v.w + dir, 1, cols), h: v.h };
    case 'h': return { w: v.w, h: c(v.h + dir, 1, rows) };
    case 'dx': { const r = moveRange(m); return { dx: c((v.dx || 0) + dir, r.dx[0], r.dx[1]), dy: v.dy || 0 }; }
    case 'dy': { const r = moveRange(m); return { dx: v.dx || 0, dy: answer?.dy ? c((v.dy || 0) + dir, r.dy[0], r.dy[1]) : 0 }; }
    case 'at': { const [lo, hi] = cutRange(m, v.axis); return { axis: v.axis, at: c(v.at + dir, lo, hi) }; }
    case 'axis': { const axis = v.axis === 'y' ? 'x' : 'y'; const [lo, hi] = cutRange(m, axis); return { axis, at: Math.round((lo + hi) / 2) }; }
    case 'x': return { x: c(v.x + dir, 0, cols) };
    default: return v;
  }
}
/** A cut's tap: the grid line nearest a lattice coordinate, kept strictly inside the shape. */
export function cutAt(m, axis, coord) {
  const [lo, hi] = cutRange(m, axis);
  return { axis, at: Math.min(hi, Math.max(lo, Math.round(coord))) };
}
/** Every whole-sided rectangle on the grid that answers a rect or maxArea question, the wider ones first. */
function rectsFor(m, a) {
  const [cols, rows] = m.grid; const out = [];
  for (let w = cols; w >= 1; w -= 1) for (let h = 1; h <= rows; h += 1) if (polygonCorrect(a, { w, h })) out.push({ w, h });
  return [...out.filter((r) => r.w >= r.h), ...out.filter((r) => r.w < r.h)];
}
const cellsWord = (n) => (Math.abs(n) === 1 ? 'משבצת אחת' : `${Math.abs(n)} משבצות`);
const pieceName = (m) => m.piece?.name || (m.piece?.pts.length === 3 ? 'המשולש' : 'החלק');
/** A cut in words: "חיתוך לאורך בקו x = 5". */
const cutWords = ({ axis, at }) => `חיתוך ${axis === 'y' ? 'לרוחב' : 'לאורך'} בקו ${ltr(`${axis} = ${at}`)}`;
/** A move in words: "המשולש הוזז 6 משבצות ימינה". */
function moveWords(m, { dx = 0, dy = 0 }) {
  const name = pieceName(m);
  if (!dx && !dy) return `${name} לא הוזז`;
  const parts = [dx && `${cellsWord(dx)} ${dx > 0 ? 'ימינה' : 'שמאלה'}`, dy && `${cellsWord(dy)} ${dy > 0 ? 'למעלה' : 'למטה'}`].filter(Boolean);
  return `${name} הוזז ${parts.join(' ו־')}`;
}
/** The points of a shape as text: (0, 0) (8, 0) (8, 6). */
const ptsWords = (pts) => ltr(pts.map(([x, y]) => `(${x}, ${y})`).join(' '));
/** The grid object's state (or its answer) in words. */
function polygonText(it, u) {
  const m = it.manip;
  if (u.mode === 'cut') return u.lines.map(cutWords).join(' או ');
  if (u.mode === 'apex') return `הקודקוד מעל ${u.xs.map((x) => ltr(`x = ${x}`)).join(' או מעל ')}`;
  if (u.mode === 'move') return moveWords(m, u);
  if (u.mode) return polygonText(it, polygonSolution(it));
  if (m.task === 'rect') return `מלבן ${u.w} על ${u.h}`;
  if (m.task === 'move') return moveWords(m, u);
  if (m.task === 'cut') return cutWords(u);
  if (m.task === 'apex') return `הקודקוד מעל ${ltr(`x = ${u.x}`)}`;
  return '';
}
/** The grid object's setup in words, for the tutor and the teacher. */
function polygonPlain(m) {
  const grid = `רשת משבצות ${m.grid[0]} על ${m.grid[1]}`;
  if (m.task === 'rect') return `[${grid}; בונים מלבן מהפינה השמאלית התחתונה: גוררים את הפינה שמולה, או משנים רוחב וגובה]`;
  if (m.task === 'move') return `[${grid}; צורה שקודקודיה ${ptsWords(m.shape)}; ${pieceName(m)} הצבוע, שקודקודיו ${ptsWords(m.piece.pts)}, זז משבצת אחר משבצת]`;
  if (m.task === 'cut') return `[${grid}; צורה שקודקודיה ${ptsWords(m.shape)}; חותכים אותה בקו אחד של הרשת, לרוחב או לאורך]`;
  if (m.task === 'apex') { const y = m.base.y || 0; return `[${grid}; משולש שבסיסו על הקו ${ltr(`y = ${y}`)} מ־${ltr(`x = ${m.base.x0}`)} עד ${ltr(`x = ${m.base.x1}`)}, והקודקוד העליון זז על קו מקווקו בגובה ${m.base.h}]`; }
  return `[${grid}]`;
}


/** Is a state of the grid object right for its answer? */
export function polygonCorrect(a, u) {
  if (!u || typeof u !== 'object' || !a) return false;
  const side = (v) => Number.isInteger(v) && v >= 1;
  switch (a.mode) {
    // every property the question gives holds; a rectangle turned on its side is the same rectangle
    case 'rect': return side(u.w) && side(u.h) && (a.area == null || u.w * u.h === a.area) && (a.perim == null || 2 * (u.w + u.h) === a.perim);
    case 'maxArea': return side(u.w) && side(u.h) && 2 * (u.w + u.h) === a.perim && u.w * u.h === maxRectArea(a.perim);
    case 'move': return Number.isInteger(u.dx) && u.dx === a.dx && (u.dy || 0) === (a.dy || 0);
    case 'cut': return (a.lines || []).some((l) => l.axis === u.axis && l.at === u.at);
    case 'apex': return (a.xs || []).includes(u.x);
    default: return false;
  }
}

/** A state that answers the question (the shape the object holds). */
export function polygonSolution(it) {
  const a = it.answer; const m = it.manip;
  // maxArea: ⌊P/4⌋ by P/2 − ⌊P/4⌋ (turned when it is too tall for the grid); rect: the wider rectangle that works
  if (a.mode === 'maxArea') { const q = Math.floor(a.perim / 4); const h = a.perim / 2 - q; return h <= m.grid[1] ? { w: q, h } : { w: h, h: q }; }
  if (a.mode === 'rect') return rectsFor(m, a)[0] || null;
  if (a.mode === 'move') return { dx: a.dx, dy: a.dy || 0 };
  if (a.mode === 'cut') return { ...a.lines[0] };
  if (a.mode === 'apex') return { x: a.xs[0] };
  return null;
}

/** A state close to the answer that is wrong: for automated checks of the "not yet" path. */
export function polygonWrong(it) {
  const a = it.answer; const m = it.manip;
  const s = polygonSolution(it);
  // a cell wider; the piece one cell further; the next line (the one before, when the next is right too); the
  // vertex one cell past the first right place (never another right one)
  if (a.mode === 'rect' || a.mode === 'maxArea') return { w: s.w + 1 <= m.grid[0] ? s.w + 1 : s.w - 1, h: s.h };
  if (a.mode === 'move') { const r = moveRange(m); return { dx: s.dx + 1 <= r.dx[1] ? s.dx + 1 : s.dx - 1, dy: s.dy }; }
  const nextFree = (v0, lo, hi, taken) => { for (let k = 1; k <= hi - lo + 1; k += 1) for (const v of [v0 + k, v0 - k]) if (v >= lo && v <= hi && !taken(v)) return v; return null; };
  if (a.mode === 'cut') {
    const taken = (axis) => (v) => a.lines.some((l) => l.axis === axis && l.at === v);
    const [lo, hi] = cutRange(m, s.axis); const at = nextFree(s.at, lo, hi, taken(s.axis));
    if (at != null) return { axis: s.axis, at };
    // every line this way is right (a rectangle): a line the other way that is not
    const other = s.axis === 'x' ? 'y' : 'x'; const [lo2, hi2] = cutRange(m, other);
    return { axis: other, at: nextFree(lo2 - 1, lo2, hi2, taken(other)) };
  }
  if (a.mode === 'apex') return { x: nextFree(s.x, 0, m.grid[0], (v) => a.xs.includes(v)) };
  return null;
}

/**
 * The measurement additions of a geo drawing (stage 2, MEASURE-1.5) in words: the shape on a grid with its corners (the
 * student counts its lengths, so the words give the corners), circles with their centre and the radius written on
 * them, arcs, and the parts taken away or added. Every number the drawing writes is read (its sides' and radii's
 * labels too), and so is a right angle it marks: a shape of the areas unit (a triangle and its height, a trapezoid) is
 * read by its name and the lengths written on it (§0.5: every number is in the text and in the words too), and a named
 * drawing with lettered points by its name and letters. A geo drawing with none of these (no grid, circle, arc, tone,
 * written length, right angle or name with letters) says nothing here, as before.
 */
export function geoWords(f) {
  const tones = (f.polys || []).some((pg) => pg.tone);
  const written = (f.segs || []).some((s) => s.label != null && s.label !== '');
  const right = (f.angles || []).some((g) => g.right);
  const P = f.pts || {};
  const named = (k) => typeof k === 'string' && !k.startsWith('_') && !(f.hide || []).includes(k);
  // a drawing with a name and lettered points (a triangle and the segments from its vertex A) says its name and letters
  const lettered = !!f.label && Object.keys(P).some(named);
  if (!f.grid && !f.circles?.length && !f.arcs?.length && !tones && !written && !right && !lettered) return '';
  const at = (k) => (Array.isArray(k) ? k : P[k]);
  const xy = (p) => ltr(`(${figNum(p[0])}, ${figNum(p[1])})`);
  const out = [];
  if (f.grid) { const [x0, y0, x1, y1] = f.grid; out.push(`רשת משבצות ${figNum(x1 - x0)} על ${figNum(y1 - y0)}, כל משבצת ריבוע שצלעו 1`); }
  // off the grid, a drawing with a name ('טרפז ישר־זווית') says it first; its shapes without letters need no more words
  const titled = !f.grid && f.label;
  if (titled) out.push(labelPlain(f.label));
  (f.polys || []).forEach((pg) => {
    const names = pg.pts.filter(named);
    if (titled && !pg.tone && names.length !== pg.pts.length) return;
    // on a grid the corners are where they are; elsewhere a shape is named by its letters
    const shape = f.grid ? `צורה שקודקודיה ${pg.pts.map((k) => `${named(k) ? k : ''}${xy(at(k))}`).join(' ')}` : names.length === pg.pts.length ? `מצולע ${names.join('')}` : 'מצולע';
    out.push(`${shape}${pg.tone === 'cut' ? ' (חלק שהוסר, מקווקו)' : pg.tone === 'add' ? ' (חלק שנוסף, צבוע)' : ''}`);
  });
  const rights = (f.angles || []).filter((g) => g.right).map((g) => (named(g.at) ? `זווית ישרה ב־${g.at}` : 'זווית ישרה'));
  if (rights.length) out.push([...new Set(rights)].join(', '));
  (f.circles || []).forEach((c) => {
    out.push(`${c.dash ? 'עיגול מקווקו' : 'עיגול'}${named(c.c) ? ` שמרכזו ${c.c}` : ''}${c.label != null ? `${named(c.c) ? ' ו' : ' ש'}רדיוסו ${labelPlain(c.label)}` : ''}`);
  });
  (f.arcs || []).forEach((a) => {
    const deg = Math.round(((a.to - a.from) % 360 + 360) % 360) || 360;
    const kind = deg === 180 ? 'חצי עיגול' : deg === 90 ? 'רבע עיגול' : deg === 360 ? 'עיגול שלם' : `קשת של ${deg}°`;
    out.push(`${kind}${named(a.c) ? ` שמרכזו ${a.c}` : ''}`);
  });
  const sides = (f.segs || []).map((s) => s.label).filter((l) => l != null && l !== '');
  if (sides.length) out.push(`על הקטעים כתוב: ${sides.map(labelPlain).join(', ')}`);
  const angles = (f.angles || []).map((g) => g.text).filter(Boolean);
  if (angles.length) out.push(`על הזוויות כתוב: ${angles.join(', ')}`);
  const words = (f.words || []).map((w) => w.text).filter(Boolean);
  if (words.length) out.push(`כתוב: ${words.join(', ')}`);
  return out.join('; ');
}

registerKind('polygon', {
  correct: (it, u) => polygonCorrect(it.answer, u),
  text: polygonText,
  plain: (it) => polygonPlain(it.manip),
  solution: polygonSolution,
  wrong: polygonWrong,
});
registerFigWords('geo', geoWords);
