// Where the transform object's letters go (Transform.jsx draws them; GEOM-2.4): the centre O, then the letters of the
// shape to cover, of the original, of the copy the student moves and of the shown answer, in that order. Pure, so the
// tests read the same layout the screen draws (learn/figures.test.ts: no letter on another, on another shape's corner,
// on the centre's dot or on an axis number, and none outside the drawing).
//
// Every letter first takes its usual place: just outside its vertex, away from the middle of its shape (O: up and to
// the side away from both axes). A letter that would sit on a letter already placed, on a corner of another shape, on
// the centre's dot or on one of the plane's numbers takes the first free place of a few others around its vertex
// instead, the nearest to its usual direction first, then a little further out. A drawing with no such clash is laid out
// exactly as before.

/** About half the width and half the height of a letter, in drawing units (17px italic; a primed letter is wider). */
export const tfLetterSize = (t) => [String(t).length > 1 ? 9 : 6.5, 8];
const DOT = 5; // a corner's dot (the copy's), and the room kept around any corner
const NEAR = 15; // a letter's usual distance from its vertex
const centroid = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

/** The plane's own words, as boxes: the numbers on both axes and the axes' names (manip/grid.jsx draws them). */
export function planeWords(g) {
  const { r, X, Y, o } = g;
  const out = [];
  for (let i = -r; i <= r; i += 1) {
    if (!i || i % 2) continue;
    const w = (i < 0 ? 2 : 1) * 4.6;
    out.push({ x: X(i), y: o + 12, w, h: 7 }); // under the x axis
    out.push({ x: o - 7 - w, y: Y(i) - 1, w, h: 7 }); // left of the y axis
  }
  out.push({ x: X(r + 0.7) + 4, y: o + 12, w: 5, h: 7 }, { x: o + 13, y: Y(r + 0.6) - 5, w: 5, h: 7 });
  return out;
}

const overlaps = (a, b, gap = 1) => Math.abs(a.x - b.x) < a.w + b.w + gap && Math.abs(a.y - b.y) < a.h + b.h + gap;
const onDot = (box, d, rad = DOT) => {
  const dx = Math.max(Math.abs(d[0] - box.x) - box.w, 0); const dy = Math.max(Math.abs(d[1] - box.y) - box.h, 0);
  return Math.hypot(dx, dy) < rad;
};

/**
 * The letters, in drawing units: [{ group, i, text, x, y, box }] where (x, y) is the letter's middle (Transform.jsx
 * writes it 5 units lower, on its baseline). `groups` is [{ key, pts: [[x, y], …] in grid units, labels: [...] | null,
 * hide?: Set of 'x,y' where the letter is left out (two letters on one vertex cannot be read), hideIdx?: Set of the
 * vertices whose letter is left out }], placed in that order; `centre` is O's point, or null.
 */
export function tfLetters(g, groups, centre) {
  const { X, Y, size } = g;
  const placed = [];
  const out = [];
  const words = planeWords(g);
  // every corner of every shape drawn (in drawing units), and the centre
  const corners = groups.flatMap((gr) => gr.pts.map((p) => ({ key: gr.key, at: [X(p[0]), Y(p[1])] })));
  const dotC = centre ? [X(centre[0]), Y(centre[1])] : null;
  const free = (box, own) => box.x - box.w >= 2 && box.x + box.w <= size - 2 && box.y - box.h >= 2 && box.y + box.h <= size - 2
    && !placed.some((b) => overlaps(b, box))
    && !words.some((b) => overlaps(b, box, 0))
    && !corners.some((c) => c !== own && onDot(box, c.at))
    && !(dotC && onDot(box, dotC, 5.5));
  // the usual direction first, then the other seven of the compass nearest to it, at the usual distance, then further
  const place = (at, dir, text, own, dist = NEAR) => {
    const [w, h] = tfLetterSize(text);
    const base = Math.atan2(dir[1], dir[0]);
    const tries = [];
    for (const d of [dist, dist + 7, dist + 14]) {
      for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) tries.push([base + (k * Math.PI) / 4, d]);
    }
    let pick = null;
    for (const [a, d] of tries) {
      const box = { x: at[0] + Math.cos(a) * d, y: at[1] + Math.sin(a) * d, w, h };
      if (free(box, own)) { pick = box; break; }
    }
    pick ||= { x: at[0] + Math.cos(base) * dist, y: at[1] + Math.sin(base) * dist, w, h }; // nowhere free: the usual place
    placed.push(pick);
    return pick;
  };
  if (centre) {
    // O beside its dot, on the side away from both axes, so a centre such as (−1, 1) is never read as the origin; the
    // origin's own O up and to the left, where no axis number is
    const right = centre[0] > 0; const up = centre[1] >= 0;
    const box = place(dotC, [right ? 1 : -1, up ? -1 : 1], 'O', null, 19);
    out.push({ group: 'centre', i: 0, text: 'O', x: box.x, y: box.y, box });
  }
  for (const gr of groups) {
    if (!gr.labels) continue;
    const mid = centroid(gr.pts);
    gr.pts.forEach((p, i) => {
      const text = gr.labels[i];
      if (!text || gr.hide?.has(p.join(',')) || gr.hideIdx?.has(i)) return;
      const vx = p[0] - mid[0]; const vy = p[1] - mid[1]; const len = Math.hypot(vx, vy) || 1;
      const own = corners.find((c) => c.key === gr.key && c.at[0] === X(p[0]) && c.at[1] === Y(p[1]));
      const box = place([X(p[0]), Y(p[1])], [vx / len, -vy / len], text, own);
      out.push({ group: gr.key, i, text, x: box.x, y: box.y, box });
    });
  }
  return out;
}

/** Clashes in a layout, as words (for the tests): a letter on a letter, on a corner of another shape, on O's dot, on a number, or outside. */
export function tfClashes(g, groups, centre) {
  const L = tfLetters(g, groups, centre);
  const { X, Y, size } = g;
  const words = planeWords(g);
  const bad = [];
  const name = (l) => `${l.group}:${l.text}`;
  for (let a = 0; a < L.length; a += 1) {
    const A = L[a].box;
    if (A.x - A.w < 0 || A.x + A.w > size || A.y - A.h < 0 || A.y + A.h > size) bad.push(`${name(L[a])} outside`);
    for (let b = a + 1; b < L.length; b += 1) if (overlaps(A, L[b].box, 0)) bad.push(`${name(L[a])} on ${name(L[b])}`);
    if (words.some((w) => overlaps(w, A, 0))) bad.push(`${name(L[a])} on a number`);
    if (centre && L[a].group !== 'centre' && onDot(A, [X(centre[0]), Y(centre[1])], 4.5)) bad.push(`${name(L[a])} on O`);
    for (const gr of groups) {
      gr.pts.forEach((p, i) => {
        if (gr.key === L[a].group && i === L[a].i) return;
        if (onDot(A, [X(p[0]), Y(p[1])], 3)) bad.push(`${name(L[a])} on a corner of ${gr.key}`);
      });
    }
  }
  return bad;
}
