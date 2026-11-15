// Where a geo drawing's words go (Figure.jsx's Geo draws them): the fit of the points into the box, then each side's
// label, each angle's label and each point's letter, in pixels of the view box. Pure, so the tests read the same layout
// the screen draws (learn/figures.test.ts: no label on another, none crossed by a line, none outside the box).
//
// Every label first takes its usual place: a side's label beside the middle of the side, away from the middle of the
// shape; an angle's label on its bisector, past its arc; a letter just outside its point. A label that would sit on a
// letter or on another label, across a drawn line or outside the box (a narrow angle, a long expression like
// (3x − 15)°, two numbered angles of one flat triangle) takes the first free place of a few others instead: further
// along its bisector, or just outside the vertex for an angle; further along its side, or on the side's other face,
// for a side. A drawing with no such clash is laid out exactly as before.

const WORD = /[֐-׿\u0600-\u06ff]/; // a word, Hebrew or Arabic (COUNCIL2-34)
/** About half the width and half the height of a label, in drawing units (Hebrew words at 16px, numbers at 18px). */
export const labelSize = (t) => [String(t).length * (WORD.test(t) ? 4.6 : 5.4) + 2, 9];
export const unitDir = (p, q) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]; };

/** The four corners of the square on segment ab, on the side away from point `away` (outward when there is none). */
export function geoSquare(a, b, away) {
  const n = [-(b[1] - a[1]), b[0] - a[0]]; // a normal of ab, as long as ab
  const side = away ? Math.sign(n[0] * (away[0] - a[0]) + n[1] * (away[1] - a[1])) : -1;
  const k = side > 0 ? -1 : 1;
  return [a, b, [b[0] + k * n[0], b[1] + k * n[1]], [a[0] + k * n[0], a[1] + k * n[1]]];
}
export const segEnds = (P, sg) => {
  const a = P[sg.a]; const b = P[sg.b]; const [ux, uy] = unitDir(a, b); const [e0, e1] = sg.ext || [0, 0];
  return [[a[0] - ux * e0, a[1] - uy * e0], [b[0] + ux * e1, b[1] + uy * e1]];
};
/** Degrees, counterclockwise, of the angle at `at` from ray at→from to ray at→to (units, y up): what a mark spans. */
export function geoSweep(P, g) {
  const v = P[g.at]; const f = P[g.from]; const t = P[g.to];
  const a0 = (Math.atan2(f[1] - v[1], f[0] - v[0]) * 180) / Math.PI; let a1 = (Math.atan2(t[1] - v[1], t[0] - v[0]) * 180) / Math.PI;
  while (a1 <= a0) a1 += 360;
  return { a0, a1, deg: a1 - a0 };
}
/** Half the width and half the height of an angle's label (17px, 19px when it is the one asked). */
const angleHalf = (text, target) => { const fs = target || text === '?' ? 19 : 17; return [String(text).length * fs * 0.29 + 1, fs * 0.36]; };
const LETTER_HALF = [6, 8];

/** Does the segment pq pass through the box (centre c, half sizes h), shrunk by a pixel? Clipped against the box. */
function hits([p, q], { c, h }) {
  const x0 = c[0] - h[0] + 1; const x1 = c[0] + h[0] - 1; const y0 = c[1] - h[1] + 1; const y1 = c[1] + h[1] - 1;
  let t0 = 0; let t1 = 1; const dx = q[0] - p[0]; const dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - x0], [dx, x1 - p[0]], [-dy, p[1] - y0], [dy, y1 - p[1]]]) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}
/** Do segments pq and rs cross (properly, not just touch at an end)? */
function cross(p, q, r, s) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(r, s, p); const d2 = d(r, s, q); const d3 = d(p, q, r); const d4 = d(p, q, s);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
const nearLine = (pt, [p, q]) => { const dx = q[0] - p[0]; const dy = q[1] - p[1]; const L = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((pt[0] - p[0]) * dx + (pt[1] - p[1]) * dy) / L)); return Math.hypot(pt[0] - p[0] - t * dx, pt[1] - p[1] - t * dy) < 1.5; };
const overlaps = (a, b) => Math.abs(a.c[0] - b.c[0]) < a.h[0] + b.h[0] - 1 && Math.abs(a.c[1] - b.c[1]) < a.h[1] + b.h[1] - 1;
const inside = (b, W, H) => b.c[0] - b.h[0] >= 0 && b.c[0] + b.h[0] <= W && b.c[1] - b.h[1] >= 0 && b.c[1] + b.h[1] <= H;

/**
 * The layout of a geo figure: X (units to pixels) and its scale (pixels a unit), the shape's middle, the drawn lines, and the boxes of its words:
 * sides[i] for fig.segs[i] (null when it has no label), angles[i] for fig.angles[i] (null for a right angle or no text),
 * letters { name: box }. A box is { c: [x, y] its middle, h: [half width, half height], text }.
 */
export function geoLayout(fig) {
  const [W, H] = fig.view || [300, 200];
  const [padX, padY] = Array.isArray(fig.pad) ? fig.pad : [fig.pad ?? 30, fig.pad ?? 30];
  const P = fig.pts;
  const sqs = (fig.squares || []).map((q) => geoSquare(P[q.a], P[q.b], q.away ? P[q.away] : null));
  const ends = (fig.segs || []).map((sg) => segEnds(P, sg));
  // stage 2 (measurement): the grid's corners, each circle's box and points along each arc are fitted in too (a centre
  // is a point's name or [x, y])
  const pt = (k) => (Array.isArray(k) ? k : P[k]);
  const circles = (fig.circles || []).map((c) => ({ o: pt(c.c), r: c.r }));
  const arcPts = (a) => { const o = pt(a.c); return Array.from({ length: 13 }, (_, i) => { const d = ((a.from + ((a.to - a.from) * i) / 12) * Math.PI) / 180; return [o[0] + a.r * Math.cos(d), o[1] + a.r * Math.sin(d)]; }); };
  const all = [...Object.values(P), ...sqs.flat(), ...ends.flat(), ...(fig.words || []).filter((w) => Array.isArray(w.at)).map((w) => w.at), ...(fig.moves || []).flatMap((mv) => [mv.from, mv.to]),
    ...(fig.grid ? [[fig.grid[0], fig.grid[1]], [fig.grid[2], fig.grid[3]]] : []),
    ...circles.flatMap((c) => [[c.o[0] - c.r, c.o[1] - c.r], [c.o[0] + c.r, c.o[1] + c.r]]), ...(fig.arcs || []).flatMap(arcPts)];
  const xs = all.map((p) => p[0]); const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((W - 2 * padX) / Math.max(x1 - x0, 1e-9), (H - 2 * padY) / Math.max(y1 - y0, 1e-9));
  const ox = (W - (x1 - x0) * s) / 2 - x0 * s; const oy = (H + (y1 - y0) * s) / 2 + y0 * s;
  const X = (p) => [ox + p[0] * s, oy - p[1] * s];
  // labels go out, away from the middle of the shape (the filled shape when there is one, else all the points)
  const core = fig.polys?.length ? fig.polys.flatMap((pg) => pg.pts.map((k) => P[k])) : Object.values(P);
  const centre = X([core.reduce((a, p) => a + p[0], 0) / core.length, core.reduce((a, p) => a + p[1], 0) / core.length]);
  const lines = [
    ...(fig.polys || []).flatMap((pg) => pg.pts.map((k, i) => [X(P[k]), X(P[pg.pts[(i + 1) % pg.pts.length]])])),
    ...ends.map((e) => e.map(X)),
    ...sqs.flatMap((c) => c.map((p, i) => [X(p), X(c[(i + 1) % 4])])),
  ];
  const named = Object.keys(P).filter((k) => !k.startsWith('_') && !(fig.hide || []).includes(k));
  const letters = Object.fromEntries(named.map((k) => {
    const p = X(P[k]); const [dx, dy] = fig.lab?.[k] || (() => { const u = unitDir(centre, p); return Math.hypot(p[0] - centre[0], p[1] - centre[1]) < 1 ? [0, -16] : [u[0] * 16, u[1] * 16]; })();
    return [k, { c: [p[0] + dx, p[1] + dy], h: LETTER_HALF, text: k }];
  }));
  const placed = Object.values(letters);
  // a label is free where it sits on no letter or label, no line crosses it, it is inside the box, and no other line
  // runs between it and what it names (its side, or its angle's vertex): a label past a neighbouring line reads as that
  // line's
  const free = (b) => inside(b, W, H) && !placed.some((o) => overlaps(b, o)) && !lines.some((l) => hits(l, b))
    && !lines.some((l) => !nearLine(b.anchor, l) && cross(b.anchor, b.c, l[0], l[1]));
  // when no place is free (the median of a long, flat triangle runs in a thin wedge), the first place that is at least
  // on its own side of every line, on nothing and inside the box: a line may run behind it (the label has a halo)
  const fair = (b) => inside(b, W, H) && !placed.some((o) => overlaps(b, o)) && !lines.some((l) => !nearLine(b.anchor, l) && cross(b.anchor, b.c, l[0], l[1]));
  const choose = (cands) => { const b = cands.find(free) || cands.find(fair) || cands[0]; placed.push(b); return b; };

  const angles = (fig.angles || []).map((g) => {
    if (g.right || !g.text) return null;
    const v = X(P[g.at]); const { a0, a1, deg } = geoSweep(P, g);
    const rr = g.r ?? 24;
    // a narrow angle has its label further out, clear of its two arms, and so does a long one (an expression, 3x − 10°)
    const lr = rr + (deg < 40 ? 30 : deg < 60 ? 22 : 16) + Math.max(0, String(g.text || '').length - 4) * 3;
    // lt: where along the arc the number sits (a whole angle split by a ray puts it inside one of its parts); the middle otherwise
    const h = angleHalf(g.text, g.target); const m = (a0 + (a1 - a0) * (g.lt ?? 0.5)) * (Math.PI / 180);
    const at = (r, th = m) => ({ c: [v[0] + r * Math.cos(th), v[1] - r * Math.sin(th)], h, text: g.text, anchor: v });
    // then right beside the vertex, all round it, nearest the angle's opening first: the box's near edge 9px from the
    // vertex, or (above and below it) slid along so that the label starts at the vertex
    const ring = [];
    for (let k = 0; k < 16; k += 1) {
      const th = m + (Math.PI / 8) * (k % 2 ? (k + 1) / 2 : -k / 2);
      ring.push(at(Math.abs(Math.cos(th)) * h[0] + Math.abs(Math.sin(th)) * h[1] + 9, th));
    }
    const slid = [9, 24].flatMap((gap) => [-1, 1].flatMap((sy) => [-1, 1].map((sx) => ({ c: [v[0] + sx * (h[0] - 6), v[1] + sy * (h[1] + gap)], h, text: g.text, anchor: v }))));
    return { ...choose([at(lr), at(lr + 10), at(lr + 20), ...ring, ...slid]), r: rr };
  });
  const sides = (fig.segs || []).map((sg) => {
    if (!sg.label) return null;
    const A = X(P[sg.a]); const B = X(P[sg.b]);
    const [ux, uy] = unitDir(A, B); let nx = -uy; let ny = ux;
    const t0 = sg.t ?? 0.5; const mid0 = [A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0];
    // a label goes on the side away from the middle of the figure, or inside with side: 'in'
    if ((mid0[0] - centre[0]) * nx + (mid0[1] - centre[1]) * ny < 0) { nx = -nx; ny = -ny; }
    if (sg.side === 'in') { nx = -nx; ny = -ny; }
    // far enough out that the whole label clears the line: half its width across, half its height up
    const half = labelSize(sg.label);
    const at = (t, sgn, more = 0) => {
      const mid = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
      const off = (sg.off ?? 7) + more + Math.abs(nx) * half[0] + Math.abs(ny) * half[1];
      return { c: [mid[0] + sgn * nx * off, mid[1] + sgn * ny * off], h: [half[0] - 2, 8], text: sg.label, anchor: mid };
    };
    // along the side, then on its other face, then further out on either face (a thin triangle has room for a label
    // only well inside it, near the wide end)
    const along = [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3, -0.4, 0.4];
    const further = [0, 10, 20, 32, 46].flatMap((more) => along.flatMap((dt) => [at(t0 + dt, 1, more), at(t0 + dt, -1, more)]));
    // last, on the side itself (its halo breaks the line), for a side in a wedge too thin for any of these
    return choose([at(t0, 1), at(t0 - 0.18, 1), at(t0 + 0.18, 1), at(t0 - 0.3, 1), at(t0 + 0.3, 1), at(t0, -1), at(t0 - 0.2, -1), at(t0 + 0.2, -1), ...further, ...along.map((dt) => at(t0 + dt, 0))]);
  });
  return { W, H, X, scale: s, centre, lines, letters, angles, sides };
}

/**
 * What a reader would trip on: a label on a letter or another label, a label crossed by a line, a label cut off, a label
 * with another line between it and what it names.
 */
export function geoClashes(fig) {
  const { W, H, lines, letters, angles, sides } = geoLayout(fig);
  const words = [...Object.values(letters).map((b) => ({ ...b, letter: true })), ...angles.filter(Boolean), ...sides.filter(Boolean)];
  const out = [];
  words.forEach((b, i) => {
    words.slice(i + 1).forEach((o) => { if (overlaps(b, o)) out.push(`"${b.text}" on "${o.text}"`); });
    if (!b.letter && lines.some((l) => hits(l, b))) out.push(`"${b.text}" crossed by a line`);
    if (b.anchor && lines.some((l) => !nearLine(b.anchor, l) && cross(b.anchor, b.c, l[0], l[1]))) out.push(`"${b.text}" past another line`);
    if (!inside(b, W, H)) out.push(`"${b.text}" cut off`);
  });
  return out;
}
