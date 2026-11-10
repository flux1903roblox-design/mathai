// The drawings of the teaching steps that name a shape or a part of one (Figure type 'geo', components/Figure.jsx):
// rays and a vertex, a straight line and the ray that splits it, two crossing lines, parallel lines and a transversal,
// triangles with their corners, an isosceles triangle's legs and base, an exterior angle, a right triangle's legs and
// hypotenuse with the squares on them, a ladder, a screen, sticks on a hinge.
// Points are in units with y up. A name that starts with "_" is drawn without a letter, so a drawing has letters only
// where its step's text has them. learn/figures.test.ts checks the letters against each step's text, and every number
// in a drawing against its geometry (angles in degrees, lengths in proportion, squares as the side squared).
import type { FigSpec } from '../types';

type Pt = [number, number];
const R = (v: number) => Math.round(v * 1e4) / 1e4;
/** The point `len` from the origin (or from `from`) in the direction `deg` (counterclockwise from the right). */
export const dir = (deg: number, len = 1, from: Pt = [0, 0]): Pt => [R(from[0] + len * Math.cos((deg * Math.PI) / 180)), R(from[1] + len * Math.sin((deg * Math.PI) / 180))];
type Angle = { at: string; from: string; to: string; text?: string; target?: boolean; right?: boolean; r?: number; n?: number };
type Seg = { a: string; b: string; ext?: [number, number]; dash?: boolean; thin?: boolean; hi?: boolean; label?: string; side?: 'in'; t?: number; ticks?: number; arrows?: number };
const geo = (label: string, f: Record<string, unknown>): FigSpec => ({ type: 'geo', label, ...f });

// ---------------------------------------------------------------- angles

/** Two rays from one point, the vertex, with the opening between them: what an angle is. */
export const rays = (): FigSpec => geo('זווית: שתי קרניים שיוצאות מקודקוד', {
  pts: { _O: [0, 0], _P: [3.2, 0], _Q: dir(48, 3.2) },
  segs: [{ a: '_O', b: '_P', label: 'קרן' }, { a: '_O', b: '_Q', label: 'קרן' }],
  angles: [{ at: '_O', from: '_P', to: '_Q', r: 30 }],
  dots: ['_O'], words: [{ at: '_O', text: 'קודקוד', dx: 12, dy: 30 }], pad: [36, 40],
});

/** A straight line through a point and the half turn over it. */
export const halfTurn = (): FigSpec => geo('קו ישר וחצי סיבוב סביב נקודה עליו', {
  pts: { _L: [-3, 0], _O: [0, 0], _R: [3, 0] },
  segs: [{ a: '_L', b: '_R' }],
  angles: [{ at: '_O', from: '_R', to: '_L', text: '?', target: true, r: 46 }],
  dots: ['_O'],
});

/**
 * A straight line with a point O on it and a ray from O at `ray` degrees: the two adjacent angles. `right` and `left`
 * are the marks of the angle on each side of the ray ({ text, target, n }), `o` the point's letter ('' for none),
 * `before` an earlier place of the ray (dashed) when the ray was turned.
 */
export function onLine(ray: number, { right, left, o = '', before, rightAngle }: { right?: Partial<Angle>; left?: Partial<Angle>; o?: string; before?: number; rightAngle?: boolean } = {}): FigSpec {
  const O = o || '_O';
  const pts: Record<string, Pt> = { _L: [-3, 0], [O]: [0, 0], _R: [3, 0], _B: dir(ray, 2.7) };
  const segs: Seg[] = [{ a: '_L', b: '_R' }, { a: O, b: '_B', hi: true }];
  const moves: { from: Pt; to: Pt }[] = [];
  if (before != null) { pts._W = dir(before, 2.7); segs.push({ a: O, b: '_W', dash: true, thin: true }); moves.push({ from: dir(before, 3.05), to: dir(ray, 3.05) }); }
  const angles: Angle[] = [];
  if (rightAngle) angles.push({ at: O, from: '_R', to: '_B', right: true });
  if (right) angles.push({ at: O, from: '_R', to: '_B', r: 24, ...right });
  if (left) angles.push({ at: O, from: '_B', to: '_L', r: 34, ...left });
  return geo('ישר, נקודה עליו וקרן שיוצאת ממנה: שתי זוויות צמודות', { pts, segs, angles, moves, dots: [O] });
}

/**
 * Two lines that cross at a point, the second at `theta` degrees, with the four angles numbered counterclockwise
 * from the right: 1 between the right ray and the upper one, then 2, 3 (opposite 1) and 4 (opposite 2).
 * `marks[i]` is the mark of angle i+1 (null: no mark); `ray` draws the second line as a ray up and a dashed half down.
 */
export function crossing(theta: number, marks: (Partial<Angle> | null)[], { ray = false, second = false }: { ray?: boolean; second?: boolean } = {}): FigSpec {
  const pts: Record<string, Pt> = { _O: [0, 0], _R: [3, 0], _L: [-3, 0], _U: dir(theta, 3), _D: dir(theta + 180, 3) };
  const segs: Seg[] = ray
    ? [{ a: '_L', b: '_R', hi: true }, { a: '_O', b: '_U', hi: true }, { a: '_O', b: '_D', dash: true, thin: true }]
    : [{ a: '_L', b: '_R' }, { a: '_D', b: '_U', hi: second }];
  const spans: [string, string][] = [['_R', '_U'], ['_U', '_L'], ['_L', '_D'], ['_D', '_R']];
  const angles = marks.flatMap((m, i) => (m ? [{ at: '_O', from: spans[i][0], to: spans[i][1], r: 26, ...m }] : []));
  return geo('שני ישרים נחתכים וארבע הזוויות סביב נקודת החיתוך', { pts, segs, angles, dots: ['_O'] });
}

/** Scissors: two crossing bars, the blades open to the right by `open` degrees, the handles to the left. */
export const scissors = (open: number): FigSpec => {
  const h = open / 2;
  return geo('מספריים: שני מוטות נחתכים, הלהבים מצד אחד והידיות מהצד השני', {
    pts: { _O: [0, 0], _a: dir(-h, 3.2), _b: dir(h, 3.2), _c: dir(180 - h, 2.2), _d: dir(180 + h, 2.2) },
    segs: [{ a: '_d', b: '_b' }, { a: '_c', b: '_a' }],
    angles: [{ at: '_O', from: '_a', to: '_b', r: 30 }, { at: '_O', from: '_c', to: '_d', r: 26, text: '?', target: true }],
    dots: ['_O'], words: [{ at: [2.3, 0], text: 'להבים', dy: 6 }, { at: [-2.75, 0], text: 'ידיות', dy: 6 }],
  });
};

/** The third corner of a triangle on base [0,0]–[base,0] with the angles `a` at the left end and `b` at the right. */
export function apex(a: number, b: number, base = 5): Pt {
  const c = 180 - a - b;
  const side = (base * Math.sin((b * Math.PI) / 180)) / Math.sin((c * Math.PI) / 180);
  return dir(a, side);
}

/**
 * A triangle with its corners at `pts` (three names, counterclockwise: base left, base right, top) and the marks of
 * its angles, keyed by corner name.
 */
export function triangle(names: [string, string, string], corners: [Pt, Pt, Pt], marks: Record<string, Partial<Angle> | null> = {}, extra: Record<string, unknown> = {}): FigSpec {
  const [p, q, r] = names;
  const pts: Record<string, Pt> = { [p]: corners[0], [q]: corners[1], [r]: corners[2] };
  const span: Record<string, [string, string]> = { [p]: [q, r], [q]: [r, p], [r]: [p, q] };
  const angles = Object.entries(marks).flatMap(([k, m]) => (m ? [{ at: k, from: span[k][0], to: span[k][1], r: 24, ...m }] : []));
  const { pts: more, ...rest } = extra as { pts?: Record<string, Pt> };
  return geo('משולש', { pts: { ...pts, ...(more || {}) }, polys: [{ pts: names }], angles, ...rest });
}

/** A triangle whose three corners are torn off along the dashed lines. */
export function torn(): FigSpec {
  const A: Pt = [0, 0]; const B: Pt = [5, 0]; const C: Pt = [1.8, 3];
  const cut = (v: Pt, p: Pt, q: Pt, k = 0.32): Record<string, Pt> => ({ [`_${v.join('_')}a`]: [R(v[0] + (p[0] - v[0]) * k), R(v[1] + (p[1] - v[1]) * k)], [`_${v.join('_')}b`]: [R(v[0] + (q[0] - v[0]) * k), R(v[1] + (q[1] - v[1]) * k)] });
  const f = triangle(['_A', '_B', '_C'], [A, B, C], { _A: { n: 1 }, _B: { n: 2 }, _C: { n: 3, r: 22 } });
  const cuts = { ...cut(A, B, C), ...cut(B, C, A), ...cut(C, A, B) };
  const keys = Object.keys(cuts);
  return { ...f, label: 'משולש ששלוש הפינות שלו נקרעות', pts: { ...(f.pts as object), ...cuts }, segs: [0, 2, 4].map((i) => ({ a: keys[i], b: keys[i + 1], dash: true, thin: true })) };
}

/** A small and a large triangle of the same shape, each corner marked like its partner. */
export function similar(): FigSpec {
  const k = 3; const small: Pt[] = [[0, 0], [1.6, 0], [0.58, 0.96]];
  const big = small.map(([x, y]) => [R(2.6 + x * k), R(y * k)] as Pt);
  const marks = (p: string, q: string, r: string): Angle[] => [{ at: p, from: q, to: r, r: 14 }, { at: q, from: r, to: p, r: 14, n: 2 }, { at: r, from: p, to: q, r: 12, n: 3 }];
  return geo('משולש קטן ומשולש גדול באותה צורה', {
    pts: { _a: small[0], _b: small[1], _c: small[2], _A: big[0], _B: big[1], _C: big[2] },
    polys: [{ pts: ['_a', '_b', '_c'] }, { pts: ['_A', '_B', '_C'] }],
    angles: [...marks('_a', '_b', '_c'), ...marks('_A', '_B', '_C').map((m) => ({ ...m, r: 24 }))],
    view: [300, 180],
  });
}

/** Why the three angles make 180°: the line through C parallel to AB, with A's and B's angles again beside C's. */
export function triangleSum(): FigSpec {
  const C: Pt = [1.8, 3];
  return triangle(['A', 'B', 'C'], [[0, 0], [5, 0], C], { A: { n: 1 }, B: { n: 2 }, C: { n: 3, r: 22 } }, {
    pts: { _L: [R(C[0] - 2.4), 3], _R: [R(C[0] + 2.6), 3] },
    segs: [{ a: '_L', b: '_R', dash: true }],
    angles: [{ at: 'A', from: 'B', to: 'C', r: 24 }, { at: 'B', from: 'C', to: 'A', r: 24, n: 2 }, { at: 'C', from: 'A', to: 'B', r: 18, n: 3 }, { at: 'C', from: '_L', to: 'A', r: 34 }, { at: 'C', from: 'B', to: '_R', r: 34, n: 2 }],
    view: [300, 210],
  });
}

/** A side with a right angle at each end: the two other sides go up side by side and never meet. */
export const twoRights = (): FigSpec => geo('צלע עם זווית ישרה בכל קצה', {
  pts: { _A: [0, 0], _B: [4, 0], _P: [0, 3.2], _Q: [4, 3.2] },
  segs: [{ a: '_A', b: '_B' }, { a: '_A', b: '_P', hi: true }, { a: '_B', b: '_Q', hi: true }],
  angles: [{ at: '_A', from: '_B', to: '_P', right: true }, { at: '_B', from: '_Q', to: '_A', right: true }],
  words: [{ at: [2, 3.2], text: '?' }],
});

/**
 * Triangle ABC, B at the left end of the base and C at the right, with the angle `a` at A and `b` at B; the side BC
 * goes on past C (dashed), and the exterior angle at C lies between that and CA. Marks keyed A, B, C (inside), ext.
 */
export function exterior(a: number, b: number, marks: { A?: Partial<Angle>; B?: Partial<Angle>; C?: Partial<Angle>; ext?: Partial<Angle> }): FigSpec {
  const A = apex(b, 180 - a - b);
  const span: Record<string, [string, string, string]> = { A: ['A', 'B', 'C'], B: ['B', 'C', 'A'], C: ['C', 'A', 'B'], ext: ['C', '_E', 'A'] };
  const angles = Object.entries(marks).flatMap(([k, m]) => (m ? [{ at: span[k][0], from: span[k][1], to: span[k][2], r: k === 'ext' ? 30 : 24, ...m }] : []));
  return geo('משולש והזווית החיצונית ליד C', {
    pts: { B: [0, 0], C: [5, 0], A, _E: [R(Math.max(A[0], 5) + 2.6), 0] }, polys: [{ pts: ['B', 'C', 'A'] }],
    segs: [{ a: 'C', b: '_E', dash: true }], angles,
  });
}

/**
 * Two parallel lines (y = 0 and y = 2) and a transversal at `a` degrees; marks at the upper (U) and lower (L) crossing
 * by position: ur (above its line, right of the transversal), ul, ll, lr. `tilt` turns the upper line (not parallel).
 */
export function parallels(a: number, marks: { at: 'U' | 'L'; pos: 'ur' | 'ul' | 'll' | 'lr'; text?: string; target?: boolean; n?: number }[] = [], { tilt = 0, slide = false, words }: { tilt?: number; slide?: boolean; words?: { at: Pt | string; text: string; dx?: number; dy?: number }[] } = {}): FigSpec {
  const L: Pt = [0, 0]; const U: Pt = [R(2 / Math.tan((a * Math.PI) / 180)), 2];
  const pts: Record<string, Pt> = {
    _L: L, _U: U, _l1: [-2.6, 0], _r1: [3.4, 0], _l2: dir(180 + tilt, 3, U), _r2: dir(tilt, 3, U),
    _t0: dir(a + 180, 1.3, L), _t1: dir(a, 1.3, U),
  };
  const ways = { U: { right: '_r2', up: '_t1', left: '_l2', down: '_L' }, L: { right: '_r1', up: '_U', left: '_l1', down: '_t0' } };
  const span = (w: 'U' | 'L', pos: string): [string, string] => { const d = ways[w]; return ({ ur: [d.right, d.up], ul: [d.up, d.left], ll: [d.left, d.down], lr: [d.down, d.right] } as Record<string, [string, string]>)[pos]; };
  const angles = marks.map((m) => { const [from, to] = span(m.at, m.pos); return { at: m.at === 'U' ? '_U' : '_L', from, to, r: 22, text: m.text, target: m.target, n: m.n }; });
  const segs: Seg[] = [{ a: '_l1', b: '_r1', arrows: tilt ? 0 : 1 }, { a: '_l2', b: '_r2', arrows: tilt ? 0 : 1 }, { a: '_t0', b: '_t1', hi: true }];
  // the slide: an arrow beside the transversal, from the upper crossing down to the lower one
  const side = dir(a - 90, 0.5);
  const moves = slide ? [{ from: dir(a + 180, 0.3, [U[0] + side[0], U[1] + side[1]]), to: dir(a, 0.3, [L[0] + side[0], L[1] + side[1]]) }] : [];
  return geo(tilt ? 'שני ישרים לא מקבילים וחותך' : 'שני ישרים מקבילים וחותך', { pts, segs, angles, moves, dots: ['_U', '_L'], words });
}

/** An isosceles triangle, apex angle `top` degrees: legs marked equal, the base below; marks keyed top/left/right. */
export function isosceles(top: number, marks: { top?: Partial<Angle>; left?: Partial<Angle>; right?: Partial<Angle> } = {}, { names = ['_B', '_C', '_A'] as [string, string, string], words = false, fold = false } = {}): FigSpec {
  const h = 3.4; const w = R(h * Math.tan(((top / 2) * Math.PI) / 180));
  const [b, c, a] = names;
  const f = triangle([b, c, a], [[-w, 0], [w, 0], [0, h]], { [a]: marks.top ? { r: 26, ...marks.top } : null, [b]: marks.left || null, [c]: marks.right || null });
  const segs: Seg[] = [
    { a, b, ticks: 1, ...(words ? { label: 'שוק', t: 0.62 } : {}) }, { a, b: c, ticks: 1, ...(words ? { label: 'שוק', t: 0.62 } : {}) },
    ...(words ? [{ a: b, b: c, label: 'בסיס' }] : []),
  ];
  const pts = { ...(f.pts as Record<string, Pt>) };
  if (fold) { pts._M = [0, 0]; segs.push({ a, b: '_M', dash: true, thin: true }); }
  return { ...f, label: 'משולש שווה־שוקיים', pts, segs, ...(words ? { words: [{ at: a, text: 'זווית הראש', dy: -18 }], pad: 40 } : {}) };
}

// ---------------------------------------------------------------- Pythagoras

/**
 * A right triangle with legs `a` (up) and `b` (along) and the right angle at the bottom left; `labels` on the legs
 * and the hypotenuse c ('' for none), `squares` the text of the square on each side (absent: no square), `names` the
 * corner letters [right angle, end of b, end of a] (default: none).
 */
export function rightTri(a: number, b: number, { labels = {}, squares, names = ['_C', '_B', '_A'], right = true, hiHyp = false }: { labels?: { a?: string; b?: string; c?: string }; squares?: { a?: string; b?: string; c?: string }; names?: [string, string, string]; right?: boolean; hiHyp?: boolean } = {}): FigSpec {
  const [C, B, A] = names;
  const pts: Record<string, Pt> = { [C]: [0, 0], [B]: [b, 0], [A]: [0, a] };
  // a side with a square on it has its label inside the triangle, off the square
  const lab = (k: 'a' | 'b' | 'c') => (labels[k] ? { label: labels[k], ...(squares?.[k] != null ? { side: 'in' as const } : {}) } : {});
  const segs: Seg[] = [{ a: C, b: A, ...lab('a') }, { a: C, b: B, ...lab('b') }, { a: A, b: B, hi: hiHyp, ...lab('c') }];
  const sq = squares ? [
    ...(squares.a != null ? [{ a: C, b: A, away: B, text: squares.a }] : []),
    ...(squares.b != null ? [{ a: C, b: B, away: A, text: squares.b }] : []),
    ...(squares.c != null ? [{ a: A, b: B, away: C, text: squares.c, hi: true }] : []),
  ] : [];
  return geo(squares ? 'משולש ישר־זווית והריבועים על הצלעות שלו' : 'משולש ישר־זווית', {
    pts, polys: [{ pts: [C, B, A] }], segs, squares: sq,
    angles: right ? [{ at: C, from: B, to: A, right: true }] : [],
    view: squares ? [300, 260] : [300, 200], pad: squares ? (Object.values(labels).some(Boolean) ? 28 : 14) : [38, 30],
  });
}

/** A triangle drawn to scale from its three sides: `base` along the bottom, `left` and `right` meeting above it. */
export function sides(base: number, left: number, right: number, { labels = true, mark = '?', names = ['_P', '_Q', '_R'] as [string, string, string] } = {}): FigSpec {
  const x = (left * left - right * right + base * base) / (2 * base);
  const y = Math.sqrt(left * left - x * x);
  const [P, Q, Rr] = names;
  return geo('משולש עם שלוש צלעות נתונות', {
    pts: { [P]: [0, 0], [Q]: [base, 0], [Rr]: [R(x), R(y)] }, polys: [{ pts: [P, Q, Rr] }],
    segs: labels ? [{ a: P, b: Q, label: String(base) }, { a: P, b: Rr, label: String(left) }, { a: Q, b: Rr, label: String(right) }] : [],
    angles: mark ? [{ at: Rr, from: P, to: Q, text: mark, target: true, r: 22 }] : [],
  });
}

/** Sides 3 and 4 with an obtuse angle between them: the third side is what the question asks. */
export const obtuse = (): FigSpec => geo('שתי צלעות, 3 ו־4, וזווית קהה ביניהן', {
  pts: { _V: [0, 0], _P: [4, 0], _Q: dir(120, 3) }, polys: [{ pts: ['_V', '_P', '_Q'] }],
  segs: [{ a: '_V', b: '_P', label: '4' }, { a: '_V', b: '_Q', label: '3' }, { a: '_P', b: '_Q', hi: true, label: '?' }],
  angles: [{ at: '_V', from: '_P', to: '_Q', r: 22, target: true }],
});

/** Two sticks, 8 and 6, on a hinge: at a right angle the ends are 10 apart; then opened to `deg` degrees. */
export function hinge(deg: number): FigSpec {
  return geo('שני מקלות מחוברים בציר', {
    pts: { _V: [0, 0], _E: [8, 0], _S: [0, 6], _T: dir(deg, 6) },
    segs: [
      // 10 is written near the top of its dashed line, apart from the '?' of the new distance
      { a: '_V', b: '_E', label: '8' }, { a: '_V', b: '_S', dash: true, thin: true }, { a: '_E', b: '_S', dash: true, thin: true, label: '10', t: 0.82 },
      { a: '_V', b: '_T', hi: true, label: '6' }, { a: '_E', b: '_T', label: '?', ...(deg > 90 ? { side: 'in' as const } : {}) },
    ],
    angles: [{ at: '_V', from: '_E', to: '_S', right: true }, { at: '_V', from: '_E', to: '_T', r: 30, target: true }],
    dots: ['_V'], view: [300, 210],
  });
}

/** A ladder against a wall: the floor, the wall and the ladder; with the right angle marked, or not yet. */
export function ladder({ right = true, labels }: { right?: boolean; labels?: { len?: string; wall?: string; foot?: string } } = {}): FigSpec {
  const [foot, wall] = labels ? [6, 8] : [2.6, 4.4];
  return geo('סולם שנשען על קיר', {
    pts: { _F: [0, 0], _W: [foot, 0], _T: [foot, wall], _G0: [-0.8, 0], _K: [foot, wall + (labels ? 1.4 : 0.9)] },
    polys: labels ? [{ pts: ['_F', '_W', '_T'] }] : [],
    segs: [
      { a: '_G0', b: '_F' }, { a: '_F', b: '_W', ...(labels?.foot ? { label: labels.foot } : {}) },
      { a: '_W', b: '_T', ...(labels?.wall ? { label: labels.wall } : {}) }, { a: '_T', b: '_K' },
      { a: '_F', b: '_T', hi: true, ...(labels?.len ? { label: labels.len } : {}) },
    ],
    angles: right ? [{ at: '_W', from: '_T', to: '_F', right: true }] : [],
    words: labels ? [] : [{ at: '_K', text: 'קיר', dx: 26, dy: 14 }, { at: [R(foot / 2 - 0.2), R(wall / 2 + 0.2)], text: 'סולם', dx: -26 }, { at: [R(foot / 2), 0], text: 'רצפה', dy: 24 }],
    view: [300, 210],
  });
}

/** A screen, `w` by `h`, and its diagonal; its sides labelled with words or numbers. */
export function screen(w: number, h: number, { width = 'רוחב', height = 'גובה', diag = 'אלכסון' } = {}): FigSpec {
  return geo('מסך: הרוחב, הגובה והאלכסון', {
    pts: { _P: [0, 0], _Q: [w, 0], _S: [w, h], _T: [0, h] }, polys: [{ pts: ['_P', '_Q', '_S', '_T'] }],
    segs: [{ a: '_P', b: '_Q', label: width }, { a: '_Q', b: '_S', label: height }, { a: '_P', b: '_S', hi: true, label: diag, side: 'in' }],
    angles: [{ at: '_Q', from: '_S', to: '_P', right: true }], pad: [48, 30],
  });
}

/** A pole `h` high and a cable from its top to a point on the ground `d` from its foot. */
export function pole(h: number, d: number): FigSpec {
  return geo('עמוד וכבל מראשו אל הקרקע', {
    pts: { _B: [0, 0], _T: [0, h], _G: [d, 0] }, polys: [{ pts: ['_B', '_G', '_T'] }],
    segs: [{ a: '_B', b: '_T', label: String(h) }, { a: '_B', b: '_G', label: String(d) }, { a: '_T', b: '_G', hi: true, label: '?' }],
    angles: [{ at: '_B', from: '_G', to: '_T', right: true }], view: [300, 170], pad: [36, 26],
  });
}
