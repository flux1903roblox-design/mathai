// The rules and the geometry of the nets (kind 'net', פריסה; stage 3, MEASURE-1.2) and the words of the still figures
// 'netfig' (stage 3) and 'solid' (stage 4, MEASURE-1.5). It loads after the first screen through content/late.js and registers itself with
// content/manip.js; components/manip/NetFold.jsx and components/SolidFigs.jsx import it too, so wherever a net or a
// solid is drawn its geometry and words are here.
//
// A net is a list of flat faces in the plane of the screen (x right, y up, the units of the solid's own lengths). One face
// is the root and stays where it is; every other face hangs from its parent on a hinge (an edge they share) and turns
// about it, away from the viewer, by t times its fold angle. At t = 1 the faces close the solid: 90° for a cube or a
// box, 90° for a prism's triangles and 180° less the base's angle between two of its strip's faces, 360°/33 between two
// slats of a cylinder's side (33 thin slats stand for the curved side) and 90° for its two discs.
//   spec  { kind: 'net', solid: 'cube' | 'box' | 'prism' | 'cylinder', dims, task, layout?, shade?, loose?, start }
//         dims { a, b, c } (a box: a long, b wide, c high; a cube a, or three equal), { p, q, r, L } (a prism: the base's
//         sides, p and q around its right angle when it has one, and its length), { r, h } (a cylinder)
//         layout: one of the 11 cube nets (NET_LAYOUTS, or six cells [col, row]; a box too, the cross by default); a
//         prism's 'row' (the default) or 'column'
//         face ids: A–F (cube, box), A–E (prism: A, B, C the strip, D and E the triangles), top, side, bottom (cylinder)
//   fold  Stepper קיפול by quarters                       value { t }       answer { mode: 'fold', t: 1 | 0 }
//   face  tap a face                                       value { face }    answer { mode: 'face', face }
//   fix   a loose face put on one of the slots              value { slot }    answer { mode: 'slot', ok: [slot ids] }
//   build Steppers אורך, רוחב, גובה (box) or ניצב א׳, ניצב ב׳, אורך (prism), 1..9
//         value { a, b, c } or { p, q, L }; answer { mode: 'build', V?, S?, d2?, fixed? } (every property given holds)
import { registerKind, registerFigWords, figNum } from './manip.js';
// the circle's rules (stage 4) travel with the nets' and the solids': a cylinder and a cone are drawn from circles, and
// so content/late.js's one request for the drawings brings all three
import './roll.js';

// maths inside a Hebrew sentence is isolated left to right
const ltr = (t) => `⁦${t}⁩`;
const D2R = Math.PI / 180;

// ---------------------------------------------------------------- the oblique view (shared with the solid figure)
// Depth runs at 30° to the right and up, at half its length (the school drawing of a box). A point (x, y, z), z away
// from the viewer, is drawn at (x + z·k·cos 30°, y + z·k·sin 30°), k = ½. obliqueDepth is how far a point is along the
// lines of sight: the painter draws the farthest face first.
export const OBLIQUE = { angle: 30, k: 0.5 };
const CA = OBLIQUE.k * Math.cos(OBLIQUE.angle * D2R); const SA = OBLIQUE.k * Math.sin(OBLIQUE.angle * D2R);
export const oblique = ([x, y, z]) => [x + z * CA, y + z * SA];
export const obliqueDepth = ([x, y, z]) => z - x * CA - y * SA;
/** The way the viewer looks (into the screen, along the depth's slant): a face whose outer side faces it is seen from outside. */
export const VIEW_DIR = [-CA, -SA, 1];

// ---------------------------------------------------------------- vectors and turns
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ID = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], T: [0, 0, 0] };
const apply = (M, p) => [dot(M.R[0], p) + M.T[0], dot(M.R[1], p) + M.T[1], dot(M.R[2], p) + M.T[2]];
const rotate = (M, v) => [dot(M.R[0], v), dot(M.R[1], v), dot(M.R[2], v)];
const compose = (A, B) => ({ R: A.R.map((row) => [0, 1, 2].map((j) => row[0] * B.R[0][j] + row[1] * B.R[1][j] + row[2] * B.R[2][j])), T: apply(A, B.T) });
/** A turn by th (radians) about the line through P along the unit vector k (right-hand rule). */
function turn(P, k, th) {
  const c = Math.cos(th); const s = Math.sin(th); const C = 1 - c; const [x, y, z] = k;
  const R = [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
  return { R, T: sub(P, [dot(R[0], P), dot(R[1], P), dot(R[2], P)]) };
}
export const centroid = (pts) => pts.reduce((a, p) => p.map((v, i) => a[i] + v / pts.length), pts[0].map(() => 0));

// ---------------------------------------------------------------- the eleven nets of a cube
// Cells [col, row], row 0 at the top; the faces are named A–F in this order. Every cube net is one of these, up to
// turning and flipping (the tests fold all 35 hexominoes: exactly these 11 close).
//   cross  .E..   t  E...   l1  E...   l2  E...   z  E...   s  .E..   hook1 AB..  hook2 AB..  hook3 AB..  steps AB..  rows ABC..
//          ABCD      ABCD       ABCD       ABCD      ABCD      ABCD        .CDE        .CDE        .CDE        .CD.        ..DEF
//          .F..      F...       .F..       ..F.      ...F      ..F.        .F..        ..F.        ...F        ..EF
export const NET_LAYOUTS = {
  cross: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2]],
  t: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [0, 2]],
  l1: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [1, 2]],
  l2: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [2, 2]],
  z: [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [3, 2]],
  s: [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [2, 2]],
  hook1: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [1, 2]],
  hook2: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [2, 2]],
  hook3: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]],
  steps: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
  rows: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],
};
const IDS6 = ['A', 'B', 'C', 'D', 'E', 'F'];
const SIDES = { up: [0, 1], down: [0, -1], right: [1, 0], left: [-1, 0] };
const rectPts = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A cube's or a box's dims, always { a, b, c }. */
export const boxDims = (m) => (m.solid === 'cube' ? { a: m.dims.a, b: m.dims.a, c: m.dims.a } : { a: m.dims.a, b: m.dims.b, c: m.dims.c });

/**
 * The faces of a cube's or a box's net, flat. Each cell is a rectangle whose sides follow from the fold: the root (the
 * cell with the most neighbours) is the front, a long and c high; a face hung on a side edge of its parent is as high as
 * it and as wide as the parent's depth, one hung on a top or bottom edge as wide as it and as high as that depth.
 */
function boxFaces(m, skip) {
  const cells = Array.isArray(m.layout) ? m.layout : NET_LAYOUTS[m.layout || 'cross'];
  if (!cells) throw new Error(`no net layout ${m.layout}`);
  const d = boxDims(m);
  const ids = IDS6.filter((id) => id !== skip);
  const at = cells.filter((_, i) => IDS6[i] !== skip);
  const near = (i, j) => Math.abs(at[i][0] - at[j][0]) + Math.abs(at[i][1] - at[j][1]) === 1;
  const degree = (i) => at.filter((_, j) => near(i, j)).length;
  let root = 0; at.forEach((_, i) => { if (degree(i) > degree(root)) root = i; });
  // axes: which of the box's lengths runs across the face (X), up it (Y), and through it (N)
  const ax = { [root]: { X: 'a', Y: 'c', N: 'b' } }; const box = { [root]: [0, 0, d.a, d.c] };
  const queue = [root];
  while (queue.length) {
    const i = queue.shift(); const p = ax[i]; const [x0, y0, x1, y1] = box[i];
    at.forEach((c, j) => {
      if (ax[j] || !near(i, j)) return;
      const dx = c[0] - at[i][0]; const dy = at[i][1] - c[1]; // dy > 0: the cell above
      if (dx) { ax[j] = { X: p.N, Y: p.Y, N: p.X }; const w = d[p.N]; box[j] = dx > 0 ? [x1, y0, x1 + w, y1] : [x0 - w, y0, x0, y1]; } else { ax[j] = { X: p.X, Y: p.N, N: p.Y }; const h = d[p.N]; box[j] = dy > 0 ? [x0, y1, x1, y1 + h] : [x0, y0 - h, x1, y0]; }
      queue.push(j);
    });
  }
  if (at.some((_, i) => !box[i])) throw new Error(`net ${m.layout || 'cross'}: face ${skip} holds the net together and cannot be loose`);
  return { faces: at.map((_, i) => ({ id: ids[i], kind: 'rect', pts: rectPts(...box[i]), sides: [d[ax[i].X], d[ax[i].Y]] })), root: ids[root] };
}

/** Where the third corner of a triangle on the base P→Q is, |XP| = u and |XQ| = v, on the side `out` points to. */
function apexOn(P, Q, u, v, out) {
  const b = Math.hypot(Q[0] - P[0], Q[1] - P[1]); const d = [(Q[0] - P[0]) / b, (Q[1] - P[1]) / b];
  const a = (u * u - v * v + b * b) / (2 * b); const h = Math.sqrt(Math.max(0, u * u - a * a));
  return [P[0] + a * d[0] + h * out[0], P[1] + a * d[1] + h * out[1]];
}
/** The angle (degrees) between sides u and v of a triangle whose third side is w. */
const angleBetween = (u, v, w) => Math.acos((u * u + v * v - w * w) / (2 * u * v)) / D2R;
const PRISM_SIDES = ['p', 'q', 'r'];
/** A prism's base sides; p and q alone are the legs of a right triangle. */
export const prismSides = (dims) => ({ p: dims.p, q: dims.q, r: dims.r ?? Math.hypot(dims.p, dims.q), L: dims.L });
/**
 * A prism's net, in a row: the strip A (p wide), B (q), C (r), each L high, and the triangles D on top of B and E under
 * it. A triangle on a strip face's end has, at each end of its base, the side of the strip face next to it (around the
 * prism: A's other neighbour is C).
 */
function prismTri(s, i, end) {
  const x0 = PRISM_SIDES.slice(0, i).reduce((a, k) => a + s[k], 0); const x1 = x0 + s[PRISM_SIDES[i]];
  const y = end === 'up' ? s.L : 0;
  const left = s[PRISM_SIDES[(i + 2) % 3]]; const right = s[PRISM_SIDES[(i + 1) % 3]];
  return [[x0, y], [x1, y], apexOn([x0, y], [x1, y], left, right, end === 'up' ? [0, 1] : [0, -1])];
}
function prismFaces(m, skip) {
  const s = prismSides(m.dims); const out = [];
  let x = 0;
  PRISM_SIDES.forEach((k, i) => { out.push({ id: 'ABC'[i], kind: 'rect', side: k, pts: rectPts(x, 0, x + s[k], s.L), sides: [s[k], s.L] }); x += s[k]; });
  out.push({ id: 'D', kind: 'tri', pts: prismTri(s, 1, 'up') }, { id: 'E', kind: 'tri', pts: prismTri(s, 1, 'down') });
  return { faces: out.filter((f) => f.id !== skip), root: skip === 'D' ? 'E' : 'D' };
}

/** How many slats a cylinder's side is cut into (odd: one is in the middle, under the discs). */
export const CYL_N = 33;
/** A regular N-gon with the edge P→Q, on the side `out` points to: a disc whose rim meets the side's slats exactly. */
function discOn(P, Q, out, n = CYL_N) {
  const w = Math.hypot(Q[0] - P[0], Q[1] - P[1]); const ri = w / (2 * Math.tan(Math.PI / n)); const R = w / (2 * Math.sin(Math.PI / n));
  const mid = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2]; const c = [mid[0] + ri * out[0], mid[1] + ri * out[1]];
  const a0 = Math.atan2(-out[1], -out[0]); // from the centre toward the edge
  return Array.from({ length: n }, (_, k) => { const a = a0 + Math.PI / n + (2 * Math.PI * k) / n; return [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]; });
}
/** A cylinder's net: its side (2πr wide, h high) in CYL_N slats, a disc on top of the middle slat and one under it. */
function cylinderFaces(m, skip) {
  const { r, h } = m.dims; const W = 2 * Math.PI * r; const w = W / CYL_N; const mid = (CYL_N - 1) / 2;
  const out = Array.from({ length: CYL_N }, (_, i) => ({ id: 'side', slat: i, kind: 'slat', pts: rectPts(-W / 2 + i * w, 0, -W / 2 + (i + 1) * w, h) }));
  out.push({ id: 'top', kind: 'disc', pts: discOn([w / 2, h], [-w / 2, h], [0, 1]) }, { id: 'bottom', kind: 'disc', pts: discOn([-w / 2, 0], [w / 2, 0], [0, -1]) });
  return { faces: out.filter((f) => f.id !== skip), root: { slat: mid } };
}

// ---------------------------------------------------------------- hinges and folding
const close2 = (p, q, e = 1e-6) => Math.abs(p[0] - q[0]) < e && Math.abs(p[1] - q[1]) < e;
const edgesOf = (pts) => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
/** The edge two flat faces share (the whole edge, either way round), or null. */
function sharedEdge(f, g) {
  for (const [p, q] of edgesOf(f.pts)) for (const [u, v] of edgesOf(g.pts)) if ((close2(p, u) && close2(q, v)) || (close2(p, v) && close2(q, u))) return [p, q];
  return null;
}
/** How far a child turns at t = 1 (degrees). */
function foldAngle(m, f, g) {
  if (m.solid === 'prism' && f.kind === 'rect' && g.kind === 'rect') {
    const s = prismSides(m.dims); const third = PRISM_SIDES.find((k) => k !== f.side && k !== g.side);
    return 180 - angleBetween(s[f.side], s[g.side], s[third]);
  }
  if (f.kind === 'slat' && g.kind === 'slat') return 360 / CYL_N;
  return 90;
}
const isRoot = (f, root) => (typeof root === 'string' ? f.id === root : f.slat === root.slat);
/**
 * The faces in folding order (each after its parent), each with its parent, its hinge and its fold angle: a walk from
 * the root through the edges the faces share.
 */
export function hingeTree(m, faces, root) {
  const r = faces.findIndex((f) => isRoot(f, root));
  const order = [{ ...faces[r], parent: -1 }]; const seen = new Set([r]);
  for (let k = 0; k < order.length; k += 1) {
    faces.forEach((g, j) => {
      if (seen.has(j)) return;
      const e = sharedEdge(order[k], g);
      if (!e) return;
      seen.add(j); order.push({ ...g, parent: k, hinge: e, angle: foldAngle(m, g, order[k]) });
    });
  }
  return order;
}
/**
 * Every face at fold t: its corners in space (p3) and the direction its outer side faces (n). The net lies in the plane
 * z = 0 with its outer side toward the viewer; each face turns about its hinge away from the viewer.
 */
export function foldFaces(tree, t) {
  const M = [];
  return tree.map((f, i) => {
    let mx = ID;
    if (f.parent >= 0) {
      const [p, q] = f.hinge; const d = unit([q[0] - p[0], q[1] - p[1], 0]);
      const c = centroid(f.pts); const v = [c[0] - p[0], c[1] - p[1], 0]; const along = dot(v, d);
      const o = unit([v[0] - along * d[0], v[1] - along * d[1], 0]); // from the hinge toward the face
      mx = compose(M[f.parent], turn([p[0], p[1], 0], cross(o, [0, 0, 1]), t * f.angle * D2R));
    }
    M[i] = mx;
    return { ...f, p3: f.pts.map(([x, y]) => apply(mx, [x, y, 0])), n: rotate(mx, [0, 0, -1]) };
  });
}
/**
 * Does the net close at t = 1? Every edge of every face meets exactly one edge of another face (a closed surface: no
 * gap, and no two faces on the same place).
 */
export function foldsClosed(tree) {
  const F = foldFaces(tree, 1);
  const same = (a, b) => Math.hypot(...sub(a, b)) < 1e-6;
  const edges = F.flatMap((f, i) => f.p3.map((p, k) => ({ i, p, q: f.p3[(k + 1) % f.p3.length] })));
  return edges.every((e) => edges.filter((g) => g.i !== e.i && ((same(e.p, g.p) && same(e.q, g.q)) || (same(e.p, g.q) && same(e.q, g.p)))).length === 1);
}

// ---------------------------------------------------------------- a loose face and its slots (fix)
/** Do two convex flat polygons overlap (more than touch)? */
function overlaps(a, b) {
  const axes = [a, b].flatMap((P) => edgesOf(P).map(([p, q]) => [q[1] - p[1], p[0] - q[0]]));
  return axes.every((ax) => {
    const pr = (P) => P.map((p) => p[0] * ax[0] + p[1] * ax[1]);
    const A = pr(a); const B = pr(b); const l = Math.hypot(...ax) || 1;
    return Math.min(Math.max(...A), Math.max(...B)) - Math.max(Math.min(...A), Math.min(...B)) > 1e-6 * l;
  });
}
const sideOf = (o) => (Math.abs(o[0]) > Math.abs(o[1]) ? (o[0] > 0 ? 'right' : 'left') : (o[1] > 0 ? 'up' : 'down'));
/** Does a face have the edge p–q (either way round)? */
const hasEdge = (g, p, q) => edgesOf(g.pts).some(([u, v]) => (close2(p, u) && close2(q, v)) || (close2(p, v) && close2(q, u)));
/** The face a fix task leaves loose: the spec's, else the last of a cube or a box, a prism's E, a cylinder's bottom. */
export const looseOf = (m) => m.loose || (m.solid === 'prism' ? 'E' : m.solid === 'cylinder' ? 'bottom' : 'F');
/**
 * The slots a loose face may be put on: free edges of the net it fits (a square or a rectangle on an edge as long as
 * one of its sides, a prism's triangle on an end of a strip face, a cylinder's disc on the side's bottom or top edge or
 * at its right end), never over a face already there. Each slot: { parent (a face id), slat?, hinge: [p, q], pts }.
 */
function slotsFor(m, faces) {
  const out = [];
  const add = (parent, hinge, pts, slat) => {
    if (faces.some((f) => overlaps(f.pts, pts))) return;
    const c = centroid(pts); if (out.some((x) => close2(centroid(x.pts), c, 1e-4))) return;
    out.push({ parent, slat, hinge, pts });
  };
  if (m.solid === 'cylinder') {
    const slats = faces.filter((f) => f.kind === 'slat'); const n = slats.length;
    const has = (id) => faces.some((f) => f.id === id);
    const mid = slats[(n - 1) / 2]; const end = slats[n - 5]; const last = slats[n - 1];
    // the missing disc's own place, in the middle; the other edge, near its end (clear of the disc in its middle)
    const under = (f) => add('side', [f.pts[0], f.pts[1]], discOn(f.pts[0], f.pts[1], [0, -1]), f.slat);
    const over = (f) => add('side', [f.pts[3], f.pts[2]], discOn(f.pts[3], f.pts[2], [0, 1]), f.slat);
    if (!has('bottom')) under(mid); else under(end);
    if (!has('top')) over(mid); else over(end);
    // the side's right end: a disc there turns up across the side's seam
    const w = mid.pts[1][0] - mid.pts[0][0]; const x = last.pts[1][0]; const y = m.dims.h / 2;
    add('side', [[x, y - w / 2], [x, y + w / 2]], discOn([x, y - w / 2], [x, y + w / 2], [1, 0]), last.slat);
    return out;
  }
  if (m.solid === 'prism') {
    const s = prismSides(m.dims);
    faces.filter((f) => f.kind === 'rect').forEach((f) => {
      const i = PRISM_SIDES.indexOf(f.side);
      ['up', 'down'].forEach((end) => { const pts = prismTri(s, i, end); add(f.id, [pts[0], pts[1]], pts); });
    });
    return out;
  }
  // a cube or a box: the loose face's two sides, from the same fold
  const lf = boxFaces(m, null).faces.find((f) => f.id === looseOf(m)); const [lw, lh] = lf.sides;
  faces.forEach((f) => edgesOf(f.pts).forEach(([p, q]) => {
    if (faces.some((g) => g !== f && hasEdge(g, p, q))) return;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]); const along = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const c = centroid(f.pts); const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let o = [-along[1], along[0]]; if ((mid[0] - c[0]) * o[0] + (mid[1] - c[1]) * o[1] < 0) o = [-o[0], -o[1]];
    [[lw, lh], [lh, lw]].forEach(([u, v], k) => {
      if (Math.abs(u - len) > 1e-9 || (k === 1 && lw === lh)) return;
      add(f.id, [p, q], [p, q, [q[0] + o[0] * v, q[1] + o[1] * v], [p[0] + o[0] * v, p[1] + o[1] * v]]);
    });
  }));
  return out;
}
/** The tree with the loose face hung on a slot (its own hinge, its parent's fold angle). */
function withSlot(m, tree, loose, s) {
  const k = tree.findIndex((f) => (s.slat != null ? f.slat === s.slat : f.id === s.parent));
  return [...tree, { ...loose, pts: s.pts, slot: s.id, parent: k, hinge: s.hinge, angle: foldAngle(m, loose, tree[k]) }];
}

// ---------------------------------------------------------------- the whole net of a spec
const CACHE = new Map();
/**
 * Everything a net task draws: its faces in folding order (`tree`, without the loose face in a fix task), the loose
 * face, its slots (each named by the face it hangs from and the side it is on: 'B-down'), which slots close the net,
 * and the face ids. The prism's 'column' layout turns the row a quarter.
 */
export function netModel(m) {
  const key = JSON.stringify([m.solid, m.dims, m.layout, m.task === 'fix' && looseOf(m)]);
  if (CACHE.has(key)) return CACHE.get(key);
  const fix = m.task === 'fix';
  const skip = fix ? looseOf(m) : null;
  const build = m.solid === 'prism' ? prismFaces : m.solid === 'cylinder' ? cylinderFaces : boxFaces;
  const { faces, root } = build(m, skip);
  const turn = m.solid === 'prism' && m.layout === 'column' ? (pts) => pts.map(([x, y]) => [y, -x]) : (pts) => pts;
  const flat = faces.map((f) => ({ ...f, pts: turn(f.pts) }));
  const tree = hingeTree(m, flat, root);
  let loose = null; let slots = []; let okSlots = [];
  if (fix) {
    const lf = build(m, null).faces.find((f) => f.id === skip);
    loose = { ...lf, pts: turn(lf.pts) };
    slots = slotsFor(m, faces).map((x) => {
      const pts = turn(x.pts); const hinge = turn(x.hinge);
      const parent = flat.find((f) => (x.slat != null ? f.slat === x.slat : f.id === x.parent));
      const c = centroid(pts); const pc = centroid(parent.pts);
      return { ...x, pts, hinge, id: `${x.parent}-${sideOf([c[0] - pc[0], c[1] - pc[1]])}` };
    });
    // a slot closes the net when the loose face put there folds with the rest into the whole solid
    okSlots = slots.filter((x) => foldsClosed(withSlot(m, tree, loose, x))).map((x) => x.id);
  }
  const ids = m.solid === 'prism' ? ['A', 'B', 'C', 'D', 'E'] : m.solid === 'cylinder' ? ['top', 'side', 'bottom'] : IDS6;
  const out = { tree, loose, slots, okSlots, root, ids };
  if (CACHE.size > 60) CACHE.clear();
  CACHE.set(key, out);
  return out;
}
/** The net with the loose face on a slot (or without it, slot null): what would fold. */
export function netWithSlot(m, slot) {
  const nm = netModel(m); const x = nm.slots.find((s) => s.id === slot);
  return x ? withSlot(m, nm.tree, nm.loose, x) : nm.tree;
}

/** Faces that touch along an edge when the solid is closed (a face's neighbours on the solid). */
export function closedNeighbours(m, id) {
  const F = foldFaces(netModel({ ...m, task: 'face' }).tree, 1);
  const me = F.filter((f) => f.id === id);
  const same = (a, b) => Math.hypot(...sub(a, b)) < 1e-6;
  const touches = (f) => me.some((g) => g.p3.some((p, k) => { const q = g.p3[(k + 1) % g.p3.length]; return f.p3.some((u, j) => { const v = f.p3[(j + 1) % f.p3.length]; return (same(p, u) && same(q, v)) || (same(p, v) && same(q, u)); }); }));
  return [...new Set(F.filter((f) => f.id !== id && touches(f)).map((f) => f.id))];
}
/** The face opposite another on the closed solid (a cube's or a box's, a prism's other triangle), or null. */
export function oppositeFace(m, id) {
  const F = foldFaces(netModel({ ...m, task: 'face' }).tree, 1);
  const f = F.find((x) => x.id === id); if (!f) return null;
  const o = F.find((g) => g.id !== id && Math.abs(dot(g.n, f.n) + 1) < 1e-6);
  return o ? o.id : null;
}

// ---------------------------------------------------------------- the view
export const NET_W = 300; export const NET_H = 220;
/** The scale and the place that fit some points of the drawing (x, y as drawn) into W by H. */
function fitPts(pts, W, H, pad, maxS = Infinity) {
  const b = bounds(pts); const bw = Math.max(b.x1 - b.x0, 1e-9); const bh = Math.max(b.y1 - b.y0, 1e-9);
  const s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh, maxS);
  return { s, ox: (W - bw * s) / 2 - b.x0 * s, oy: (H + bh * s) / 2 + b.y0 * s, b };
}
/**
 * Where the net is drawn. A fold is fitted to the moment it shows (fold t, and the answer's fold when it is drawn
 * after a miss): the open net fills the drawing, and as it closes the view follows it and grows, up to twice the open
 * net's scale, so the closed solid is not lost in a corner; the steps are 300 ms tweens, so the view moves smoothly. A
 * face or fix task is the open net; a fix task also fits its slots and its loose face, which waits beside the net (to
 * its right or under it, whichever leaves the faces larger), on a canvas up to maxH high. Returns { s, X, Y, W, H, tray }
 * where X and Y take a point in space (or a flat [x, y]).
 */
export function netView(m, nm = netModel(m), { W = NET_W, H: H0 = NET_H, pad = 14, maxH = 300, fit = false, t = 0, also = null } = {}) {
  const at = (u) => foldFaces(nm.tree, u).flatMap((f) => f.p3.map((p) => oblique(p)));
  const pts = at(m.task === 'fold' ? t : 0);
  if (m.task === 'fold' && also != null) pts.push(...at(also));
  const maxS = m.task === 'fold' ? 2 * fitPts(at(0), W, H0, pad).s : Infinity;
  let tray = null;
  if (nm.loose) {
    nm.slots.forEach((x) => x.pts.forEach((p) => pts.push(p)));
    const box = bounds(pts); const lb = bounds(nm.loose.pts); const lw = lb.x1 - lb.x0; const lh = lb.y1 - lb.y0; const gap = Math.min(lw, lh) * 0.35;
    // beside the net (to its right) or under it: whichever gives the larger drawing
    const right = [box.x1 + gap - lb.x0, (box.y0 + box.y1) / 2 - (lb.y0 + lb.y1) / 2];
    const under = [(box.x0 + box.x1) / 2 - (lb.x0 + lb.x1) / 2, box.y0 - gap - lb.y1];
    const moved = (dxy) => nm.loose.pts.map(([x, y]) => [x + dxy[0], y + dxy[1]]);
    tray = fitPts([...pts, ...moved(right)], W, maxH, pad).s >= fitPts([...pts, ...moved(under)], W, maxH, pad).s ? right : under;
    pts.push(...moved(tray));
  }
  const b = bounds(pts); const bw = Math.max(b.x1 - b.x0, 1e-9); const bh = Math.max(b.y1 - b.y0, 1e-9);
  // a fix task's canvas grows taller (to maxH) when the width allows larger faces; a still figure (fit) is as tall as
  // its net needs, up to H0
  const H = nm.loose ? Math.max(H0, Math.min(maxH, Math.ceil(((W - 2 * pad) / bw) * bh + 2 * pad)))
    : fit ? Math.min(H0, Math.ceil(((W - 2 * pad) / bw) * bh + 2 * pad)) : H0;
  const { s, ox, oy } = fitPts(pts, W, H, pad, maxS);
  const X = (p) => ox + oblique(p.length === 3 ? p : [p[0], p[1], 0])[0] * s;
  const Y = (p) => oy - oblique(p.length === 3 ? p : [p[0], p[1], 0])[1] * s;
  return { s, X, Y, W, H, tray };
}
export function bounds(pts) {
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) };
}

// ---------------------------------------------------------------- the fold's steps, the build's steppers
export const FOLD_STEP = 0.25; export const BUILD_MAX = 9;
/** The dimension steppers of a build task: a box's a, b, c or a prism's p, q, L. */
export const buildKeys = (m) => (m.solid === 'prism' ? ['p', 'q', 'L'] : ['a', 'b', 'c']);
/** A dimension the answer pins and the start already has: its stepper stays put. */
export const buildFixed = (m, answer, k) => answer?.fixed?.[k] != null && m.start?.[k] === answer.fixed[k];
/** The controls a task shows: the fold's 't', a build's dimensions (face and fix are tapped, not stepped). */
export const netControls = (m, answer) => (m.task === 'fold' ? ['t'] : m.task === 'build' ? buildKeys(m).filter((k) => !buildFixed(m, answer, k)) : []);
/** One press of a control (dir −1 or 1): the stepper, the arrow keys and the tests all move the object through here. */
export function netStep(m, v, key, dir, answer) {
  if (key === 't') return { t: Math.min(1, Math.max(0, Math.round(((v.t ?? 0) + dir * FOLD_STEP) * 4) / 4)) };
  if (buildKeys(m).includes(key) && !buildFixed(m, answer, key)) return { ...v, [key]: Math.min(BUILD_MAX, Math.max(1, v[key] + dir)) };
  return v;
}

// ---------------------------------------------------------------- what a box or a prism measures
/** Volume, surface area and the space diagonal squared of a build state (a prism's surface may not be whole). */
export function buildMeasures(m, u) {
  if (m.solid === 'prism') {
    const r = Math.hypot(u.p, u.q); const base = (u.p * u.q) / 2;
    return { V: base * u.L, S: 2 * base + (u.p + u.q + r) * u.L, base };
  }
  return { V: u.a * u.b * u.c, S: 2 * (u.a * u.b + u.a * u.c + u.b * u.c), d2: u.a * u.a + u.b * u.b + u.c * u.c };
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
function buildCorrect(m, a, u) {
  const keys = buildKeys(m);
  if (!keys.every((k) => Number.isInteger(u[k]) && u[k] >= 1 && u[k] <= BUILD_MAX)) return false;
  const q = buildMeasures(m, u);
  return (a.V == null || near(q.V, a.V)) && (a.S == null || near(q.S, a.S)) && (a.d2 == null || (q.d2 != null && near(q.d2, a.d2)))
    && Object.entries(a.fixed || {}).every(([k, v]) => u[k] === v);
}
/** The first build that answers (a ≥ b ≥ c, or a prism's p ≥ q, when there is one), searched up to 9. */
function buildSolution(m, a) {
  const keys = buildKeys(m); const all = [];
  for (let i = 1; i <= BUILD_MAX; i += 1) for (let j = 1; j <= BUILD_MAX; j += 1) for (let k = 1; k <= BUILD_MAX; k += 1) {
    const u = { [keys[0]]: i, [keys[1]]: j, [keys[2]]: k };
    if (buildCorrect(m, a, u)) all.push(u);
  }
  const ordered = (u) => (m.solid === 'prism' ? u.p >= u.q : u.a >= u.b && u.b >= u.c);
  return all.find(ordered) || all[0] || null;
}

// ---------------------------------------------------------------- words
const CLOSED = { cube: 'הקובייה סגורה', box: 'התיבה סגורה', prism: 'המנסרה סגורה', cylinder: 'הגליל סגור' };
const CLOSED_NOUN = { cube: 'קובייה סגורה', box: 'תיבה סגורה', prism: 'מנסרה סגורה', cylinder: 'גליל סגור' };
const FOLDED = { 0.25: 'רבע', 0.5: 'חצי', 0.75: 'שלושה רבעים' };
/** A fold in words: "הפריסה פתוחה", "הפריסה מקופלת עד חצי", "התיבה סגורה". */
export const foldWords = (m, t) => (t >= 1 ? CLOSED[m.solid] : t <= 0 ? 'הפריסה פתוחה' : `הפריסה מקופלת עד ${FOLDED[t] || `${Math.round(t * 100)}%`}`);
const CYL_FACE = { top: 'הבסיס העליון', bottom: 'הבסיס התחתון', side: 'המעטפת' };
/** A face by name: "פאה C", or a cylinder's part. */
export const faceName = (m, id) => (m.solid === 'cylinder' ? CYL_FACE[id] || id : `פאה ${id}`);
/** A prism's triangle and a cylinder's disc are bases (masculine); a cube's or a box's face is a פאה. */
const looseIsBase = (m) => m.solid === 'cylinder' || (m.solid === 'prism' && ['D', 'E'].includes(looseOf(m)));
/** The missing part of a fix task: "הפאה החסרה", "הבסיס החסר". */
export const looseName = (m) => (looseIsBase(m) ? 'הבסיס החסר' : 'הפאה החסרה');
/** Where a slot is: "מתחת לפאה B", "מעל המעטפת", "מימין למעטפת". */
export function slotWords(m, id) {
  const [parent, side] = String(id).split('-');
  if (side === 'up') return `מעל ${m.solid === 'cylinder' ? 'המעטפת' : `פאה ${parent}`}`;
  return `${{ down: 'מתחת', right: 'מימין', left: 'משמאל' }[side]} ל${m.solid === 'cylinder' ? 'מעטפת' : `פאה ${parent}`}`;
}
/** A build state: "תיבה 4 על 3 על 2", "מנסרה שניצביה 3 ו־4 ואורכה 6". */
export const buildWords = (m, u) => (m.solid === 'prism' ? `מנסרה שניצביה ${u.p} ו־${u.q} ואורכה ${u.L}` : `תיבה ${u.a} על ${u.b} על ${u.c}`);
/** A solid's sizes in words: "קובייה שמקצועה 3", "תיבה 4 על 3 על 2", "גליל שרדיוס בסיסו 2 וגובהו 5". */
function netSetup(m) {
  if (m.solid === 'prism') { const s = prismSides(m.dims); return `מנסרה משולשת שבסיסה משולש שצלעותיו ${figNum(s.p)}, ${figNum(s.q)} ו־${figNum(Math.round(s.r * 100) / 100)}, ואורכה ${figNum(s.L)}`; }
  if (m.solid === 'cylinder') return `גליל שרדיוס בסיסו ${figNum(m.dims.r)} וגובהו ${figNum(m.dims.h)}`;
  const d = boxDims(m);
  return m.solid === 'cube' ? `קובייה שמקצועה ${figNum(d.a)}` : `תיבה ${figNum(d.a)} על ${figNum(d.b)} על ${figNum(d.c)}`;
}

/** The net object's state (or its answer) in words. */
function netText(it, u) {
  const m = it.manip;
  if (u.mode === 'fold') return foldWords(m, u.t);
  if (u.mode === 'face') return faceName(m, u.face);
  if (u.mode === 'slot') return u.ok.map((id) => `${looseName(m)} ${slotWords(m, id)}`).join(' או ');
  if (u.mode === 'build') { const s = buildSolution(m, u); return s ? buildWords(m, s) : ''; }
  if (m.task === 'fold') return foldWords(m, u.t);
  if (m.task === 'face') return u.face ? faceName(m, u.face) : 'עוד לא נבחרה פאה';
  if (m.task === 'fix') return u.slot ? `${looseName(m)} ${slotWords(m, u.slot)}` : `${looseName(m)} עוד בצד`;
  if (m.task === 'build') return buildWords(m, u);
  return '';
}
/** The net object's setup in words, for the tutor and the teacher. */
function netPlain(it) {
  const m = it.manip;
  if (m.task === 'build') return m.solid === 'prism' ? '[בונים מנסרה שבסיסה משולש ישר־זווית: משנים את שני הניצבים ואת האורך, כל אחד מ־1 עד 9]' : '[בונים תיבה מקוביות של 1 סמ״ק: משנים אורך, רוחב וגובה, כל אחד מ־1 עד 9]';
  const net = `פריסה של ${netSetup(m)}`;
  if (m.task === 'fold') return `[${net}; מקפלים ופורשים אותה ברבעים, מפריסה פתוחה עד ${CLOSED_NOUN[m.solid]}]`;
  if (m.task === 'face') return `[${net}; ${netfigLayout({ solid: m.solid, dims: m.dims, layout: m.layout, letters: true })}${m.shade ? `; ${faceName(m, m.shade)} צבועה` : ''}; מקישים על פאה]`;
  if (m.task === 'fix') return `[${net}, ${looseIsBase(m) ? `בלי ${faceName(m, looseOf(m)).replace(/^ה/, '')}` : `בלי ${faceName(m, looseOf(m))}`}; שמים את ${looseName(m)} באחד המקומות המקווקווים]`;
  return `[${net}]`;
}

/** Is a state of the net object right for its answer? */
export function netCorrect(m, a, u) {
  if (!u || typeof u !== 'object' || !a) return false;
  switch (a.mode) {
    case 'fold': return typeof u.t === 'number' && near(u.t, a.t);
    case 'face': return u.face != null && u.face === a.face;
    case 'slot': return u.slot != null && (a.ok || []).includes(u.slot);
    case 'build': return buildCorrect(m, a, u);
    default: return false;
  }
}
/** A state that answers the question. */
export function netSolution(it) {
  const a = it.answer; const m = it.manip;
  if (a.mode === 'fold') return { t: a.t };
  if (a.mode === 'face') return { face: a.face };
  if (a.mode === 'slot') return { slot: a.ok[0] };
  if (a.mode === 'build') return buildSolution(m, a);
  return null;
}
/** A state close to the answer that is wrong: half folded, a face next to the answer, a slot that does not close, a + 1. */
export function netWrong(it) {
  const a = it.answer; const m = it.manip;
  if (a.mode === 'fold') return { t: 0.5 };
  if (a.mode === 'face') return { face: closedNeighbours(m, a.face).find((id) => id !== m.shade) };
  if (a.mode === 'slot') return { slot: netModel(m).slots.map((s) => s.id).find((id) => !a.ok.includes(id)) ?? null };
  if (a.mode === 'build') {
    const s = buildSolution(m, a); const k = buildKeys(m).find((x) => !a.fixed || a.fixed[x] == null) || buildKeys(m)[0];
    return { ...s, [k]: s[k] < BUILD_MAX ? s[k] + 1 : s[k] - 1 };
  }
  return null;
}

// ---------------------------------------------------------------- the still figures in words
const NEXT = { up: 'מעל ', down: 'מתחת ל־', right: 'מימין ל־', left: 'משמאל ל־' };
const ROW_NAMES = ['העליונה', 'השנייה', 'השלישית'];
/** A net's cells: a named layout's, or the cells given (a shape that may not fold, for a "which net folds?" choice). */
const cellsOf = (f) => (Array.isArray(f.layout) ? f.layout : NET_LAYOUTS[f.layout || 'cross']);
/** A cube's or a box's net with no letters drawn, row by row: "בשורה העליונה ריבוע בעמודה 2; …". */
function netRows(f) {
  const cells = cellsOf(f); const rows = [...new Set(cells.map((c) => c[1]))].sort((a, b) => a - b);
  const what = f.solid === 'cube' ? ['ריבוע', 'ריבועים'] : ['מלבן', 'מלבנים'];
  return rows.map((r, i) => {
    const cols = cells.filter((c) => c[1] === r).map((c) => c[0] + 1).sort((a, b) => a - b);
    return `בשורה ${i === rows.length - 1 && i > 0 ? 'התחתונה' : ROW_NAMES[i]} ${cols.length === 1 ? `${what[0]} בעמודה ${cols[0]}` : `${what[1]} בעמודות ${cols.join(', ')}`}`;
  }).join('; ');
}
/** Where a face of an unlettered cube or box net is: "הריבוע בשורה 1 ובעמודה 2". */
const cellWords = (f, id) => { const c = cellsOf(f)[IDS6.indexOf(id)]; return `${f.solid === 'cube' ? 'הריבוע' : 'המלבן'} בשורה ${c[1] + 1} ובעמודה ${c[0] + 1}`; };
/**
 * How a net is laid out: a lettered cube or box net by the face each face hangs from ("A משמאל ל־B, E מעל B"), an
 * unlettered one row by row; a prism's strip and its two triangles; a cylinder's rectangle and its two discs.
 */
export function netfigLayout(f) {
  if (f.solid === 'cylinder') return 'מלבן, ועיגול שנוגע באמצע הצלע העליונה שלו ועיגול שנוגע באמצע הצלע התחתונה';
  if (f.solid === 'prism') {
    const col = f.layout === 'column';
    return f.letters
      ? `שלושה מלבנים ברצועה, ${col ? 'מלמעלה למטה' : 'משמאל לימין'} A, B, C; משולש D ${col ? 'מימין ל־B' : 'מעל B'} ומשולש E ${col ? 'משמאל ל־B' : 'מתחת ל־B'}`
      : `שלושה מלבנים ברצועה, ומשולש ${col ? 'מימין ומשמאל' : 'מעל ומתחת'} למלבן האמצעי`;
  }
  if (!f.letters) return netRows(f);
  const tree = netModel({ solid: f.solid, dims: f.dims, layout: f.layout, task: 'face' }).tree;
  return tree.filter((x) => x.parent >= 0).sort((a, b) => a.id.localeCompare(b.id)).map((x) => {
    const p = tree[x.parent]; const c = centroid(x.pts); const pc = centroid(p.pts);
    return `${x.id} ${NEXT[sideOf([c[0] - pc[0], c[1] - pc[1]])]}${p.id}`;
  }).join(', ');
}
/** The area of a flat face. */
const area2 = (pts) => Math.abs(pts.reduce((a, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return a + x * v - u * y; }, 0)) / 2;
const SIDE_PREF = ['down', 'left', 'up', 'right'];
/**
 * What a netfig writes, in the net's own units, so the figure draws exactly what its words read: with labels: true each
 * length once on an edge that long (a free edge on the outside first, the bottom and the left first; a hinge's label
 * goes inside its face), a cylinder's radius on its top disc and "2πr" under its side; with labels: 'area' each face's
 * area in its middle. { faces: [{ id, text, at }], edges: [{ key, text, at, out, inside }], radius?: { c, r, text } }.
 */
export function netfigMarks(f) {
  const nm = netModel({ solid: f.solid, dims: f.dims, layout: f.layout, task: 'face' });
  const faces = nm.tree; const out = { faces: [], edges: [], radius: null, width: null };
  if (f.labels === 'area') {
    if (f.solid !== 'cylinder') out.faces = faces.map((x) => ({ id: x.id, text: figNum(Math.round(area2(x.pts) * 1000) / 1000), at: centroid(x.pts) }));
    return out;
  }
  if (!f.labels) return out;
  let want;
  if (f.solid === 'cylinder') {
    const top = faces.find((x) => x.id === 'top'); const c = centroid(top.pts);
    out.radius = { c, r: f.dims.r, text: figNum(f.dims.r) };
    const first = faces.find((x) => x.slat === 0); out.width = { at: [first.pts[0][0] + Math.PI * f.dims.r * 0.5, 0], text: '2πr' };
    want = [['h', f.dims.h]];
  } else if (f.solid === 'prism') { const p = prismSides(f.dims); want = ['p', 'q', 'r', 'L'].map((k) => [k, p[k]]); } else {
    const d = boxDims(f); want = (f.solid === 'cube' ? ['a'] : ['a', 'b', 'c']).map((k) => [k, d[k]]);
  }
  const used = [];
  const all = faces.flatMap((x) => edgesOf(x.pts).map(([p, q]) => {
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const c = centroid(x.pts); const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let o = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len]; if ((mid[0] - c[0]) * o[0] + (mid[1] - c[1]) * o[1] < 0) o = [-o[0], -o[1]];
    const free = !faces.some((g) => g !== x && hasEdge(g, p, q));
    return { p, q, mid, len, out: o, free, side: sideOf(o), tri: x.kind === 'tri' };
  }));
  want.forEach(([key, len]) => {
    const ok = all.filter((e) => Math.abs(e.len - len) < 1e-6 && !used.some((u) => close2(u.mid, e.mid)));
    ok.sort((a, b) => (b.free - a.free) || (a.tri - b.tri) || (SIDE_PREF.indexOf(a.side) - SIDE_PREF.indexOf(b.side)));
    const e = ok[0]; if (!e) return;
    used.push(e);
    out.edges.push({ key, text: figNum(Math.round(len * 100) / 100), at: e.mid, out: e.free ? e.out : e.out.map((x) => -x), inside: !e.free });
  });
  return out;
}
/** The texts a netfig writes on its faces and edges (for its words and the tests). */
export function netfigLabels(f) {
  const k = netfigMarks(f);
  return { faces: k.faces.map(({ id, text }) => ({ id, text })), edges: [...k.edges.map(({ key, text }) => ({ key, text })), ...(k.radius ? [{ key: 'r', text: k.radius.text }] : [])] };
}
/** A netfig in words: the solid, how its faces are laid out, each face's sides (or area), and the shaded face. */
export function netfigWords(f) {
  const what = { cube: 'פריסה של קובייה', box: 'פריסה של תיבה', prism: 'פריסה של מנסרה משולשת', cylinder: 'פריסה של גליל' }[f.solid];
  const out = [`${what}: ${netfigLayout(f)}`];
  const L = netfigLabels(f); const e = Object.fromEntries(L.edges.map((x) => [x.key, x.text]));
  const name = (id) => (f.letters ? `פאה ${id}` : cellWords(f, id));
  if (f.labels && f.labels !== 'area') {
    if (f.solid === 'cube') out.push(`כל פאה ריבוע שצלעו ${e.a}`);
    if (f.solid === 'box') {
      const tree = netModel({ solid: 'box', dims: f.dims, layout: f.layout, task: 'face' }).tree;
      out.push([...tree].sort((a, b) => a.id.localeCompare(b.id)).map((x) => `${f.letters ? `פאה ${x.id} ` : ''}${figNum(x.sides[0])} על ${figNum(x.sides[1])}`).join(', '));
    }
    if (f.solid === 'prism') out.push(`רוחבי המלבנים ${e.p}, ${e.q} ו־${e.r}, ואורכם ${e.L}; צלעות כל משולש ${e.p}, ${e.q} ו־${e.r}`);
    if (f.solid === 'cylinder') out.push(`רדיוס כל עיגול ${e.r}, גובה המלבן ${e.h}, ורוחבו היקף העיגול`);
  }
  if (f.labels === 'area' && L.faces.length) out.push(`שטחי הפאות: ${[...L.faces].sort((a, b) => a.id.localeCompare(b.id)).map((x) => `${f.letters ? `${x.id} ` : ''}${x.text}`).join(', ')}`);
  const shade = [].concat(f.shade || []);
  if (shade.length) out.push(`${shade.map((id) => (f.solid === 'cylinder' ? faceName(f, id) : f.solid === 'prism' || f.letters ? `פאה ${id}` : name(id))).join(', ')} ${shade.length > 1 ? 'צבועים' : f.solid === 'cylinder' || (!f.letters && f.solid !== 'prism') ? 'צבוע' : 'צבועה'}`);
  return out.join('; ');
}

// ---------------------------------------------------------------- the solid figure (stage 4, MEASURE-1.5)
// { shape: 'box' | 'cube' | 'prism' | 'cylinder' | 'cone', a?, b?, c?, p?, q?, r?, L?, h?, l?, labels?, diag?, cubes?, cut?,
//   open?, label? }, drawn by components/SolidFigs.jsx SolidFig: a box (a long, b deep, c high), a cube (a), a prism (its
// base in front: p along the bottom; with q alone a right triangle with legs p and q, with h a triangle of height h on p
// and q its left side, with q and r three sides; L its length, into the page), a cylinder (r, h) or a cone (r, h, l).
// labels: true (the default) writes every length given, false none, or an object writes its own text for some ('x',
// '?'). diag: 'face' (the base's diagonal), 'space' (the box's), 'tri' (the base's diagonal, the upright edge at its end
// and the box's diagonal, the right triangle shaded), 'axial' (a cone's or a cylinder's axial section), 'rod' (a rod
// across a cylinder's axial section), or a list of them. cubes: unit cubes; cut: 'diagonal' | 'half'; open: no lid;
// label: a word written under the solid ("1 ליטר").
const SOLID_KEYS = { box: ['a', 'b', 'c'], cube: ['a'], prism: ['p', 'q', 'r', 'h', 'L'], cylinder: ['r', 'h'], cone: ['r', 'h', 'l'] };
/** The lengths a solid figure writes, by key: every length given (labels: true or absent), none, or the texts given. */
export function solidLabels(f) {
  if (f.labels === false) return {};
  const over = f.labels && typeof f.labels === 'object' ? f.labels : {};
  const out = {};
  (SOLID_KEYS[f.shape] || []).forEach((k) => {
    if (over[k] != null) out[k] = String(over[k]);
    else if (typeof f[k] === 'number') out[k] = figNum(Math.round(f[k] * 100) / 100);
  });
  return out;
}
/** A prism's base in its own plane: [0, 0], [p, 0] and its third corner (see SOLID_KEYS above). */
export function prismBase(f) {
  if (f.h != null) return [[0, 0], [f.p, 0], [f.q != null ? Math.sqrt(Math.max(0, f.q * f.q - f.h * f.h)) : f.p * 0.35, f.h]];
  if (f.q != null && f.r != null) return [[0, 0], [f.p, 0], apexOn([0, 0], [f.p, 0], f.q, f.r, [0, 1])];
  return [[0, 0], [f.p, 0], [0, f.q]];
}
const DIAG_WORDS = {
  face: 'אלכסון של הבסיס', space: 'אלכסון התיבה',
  tri: 'המשולש ישר־הזווית שצלעותיו אלכסון הבסיס, המקצוע האנכי שבקצה שלו ואלכסון התיבה',
  rod: 'מוט מקצה הבסיס התחתון לקצה הנגדי של הבסיס העליון, אלכסון של החתך הצירי',
};
/** A solid figure in words: "תיבה: אורך 7, רוחב 4, גובה 3; מסומן אלכסון התיבה". */
export function solidWords(f) {
  const L = solidLabels(f); const out = [];
  const join = (parts) => parts.filter(Boolean).join(', ');
  if (f.shape === 'box') out.push(`תיבה${Object.keys(L).length ? `: ${join([L.a && `אורך ${L.a}`, L.b && `רוחב ${L.b}`, L.c && `גובה ${L.c}`])}` : ''}`);
  if (f.shape === 'cube') out.push(`קובייה${L.a ? ` שמקצועה ${L.a}` : ''}`);
  if (f.shape === 'prism') {
    const base = f.h != null ? `בסיס: משולש שצלע אחת שלו ${L.p ?? 'לא כתובה'} והגובה אליה ${L.h ?? 'לא כתוב'}${L.q ? `, וצלע נוספת ${L.q}` : ''}`
      : f.r != null ? `בסיס: משולש שצלעותיו ${join([L.p, L.q])}${L.r ? ` ו־${L.r}` : ''}`
        : `בסיס: משולש ישר־זווית${L.p || L.q ? ` שניצביו ${[L.p, L.q].filter(Boolean).join(' ו־')}` : ''}`;
    out.push(`מנסרה משולשת: ${base}${L.L ? `; אורך המנסרה ${L.L}` : ''}`);
  }
  if (f.shape === 'cylinder') out.push(`גליל${Object.keys(L).length ? `: ${join([L.r && `רדיוס הבסיס ${L.r}`, L.h && `גובה ${L.h}`])}` : ''}`);
  if (f.shape === 'cone') out.push(`חרוט${Object.keys(L).length ? `: ${join([L.r && `רדיוס הבסיס ${L.r}`, L.h && `גובה ${L.h}`, L.l && `קו יוצר ${L.l}`])}` : ''}`);
  const diags = [].concat(f.diag || []).map((d) => (d === 'axial' ? (f.shape === 'cone' ? 'החתך הצירי: משולש שווה־שוקיים' : 'החתך הצירי: מלבן') : DIAG_WORDS[d])).filter(Boolean);
  if (diags.length) out.push(`${diags.length > 1 ? 'מסומנים' : 'מסומן'} ${diags.join(' ו')}`);
  const fem = f.shape !== 'cylinder' && f.shape !== 'cone';
  if (f.cubes) out.push(`${fem ? 'בנויה' : 'בנוי'} מקוביות שמקצוען 1`);
  if (f.cut === 'diagonal') out.push('חתוכה לאורך אלכסון הבסיס לשתי מנסרות');
  if (f.cut === 'half') out.push('חתוכה לשני חצאים שווים');
  if (f.open) out.push('בלי מכסה');
  if (f.label) out.push(`כתוב: ${f.label}`);
  return out.join('; ');
}

registerKind('net', {
  correct: (it, u) => netCorrect(it.manip, it.answer, u),
  text: netText,
  plain: netPlain,
  solution: netSolution,
  wrong: netWrong,
});
registerFigWords('netfig', netfigWords);
registerFigWords('solid', solidWords);
