// The drawings of the worked examples (stage B) and of solving together (stage C) in geometry (SK-STUDENT-1): a straight
// line split by rays, a triangle from its angles, a sail and a folding ladder, a rectangle and its diagonal, a frame that
// is not quite square, a pole and its cable, a ladder, a triangle split by its height and a kite string. Each is drawn from its problem's own numbers, so
// the picture cannot disagree with the text: an angle written in degrees is drawn that size, and a side's number is in
// proportion to the other sides (learn/figures.test.ts checks both, and that the drawing names only the text's letters).
// The angle or the side a problem asks for is marked '?', never written. The building blocks are geo.ts's.
import type { GeoFig } from '../types';
import { dir, apex, triangle } from './geo';

type Pt = [number, number];
type Mark = { text?: string; target?: boolean; n?: number; r?: number };
const R = (v: number) => Math.round(v * 1e4) / 1e4;
const rad = (d: number) => (d * Math.PI) / 180;
const geo = (label: string, f: Record<string, unknown>): GeoFig => ({ type: 'geo', label, ...f }) as GeoFig;
/** A side's mark: a number, '?' or nothing. */
const lab = (t?: string) => (t ? { label: t } : {});

// ---------------------------------------------------------------- angles

/**
 * A straight line with a point on it and rays from that point, each `rays[i]` degrees from the line's right end, in
 * order; `marks[i]` is the angle between neighbours, from the right end leftwards (null: none). `names` gives letters:
 * the line's right end, the point, each ray and the left end (leave one out for no letter).
 */
export function lineFan(rays: number[], marks: (Mark | null)[], names: { right?: string; o?: string; rays?: string[]; left?: string } = {}, label = 'ישר, נקודה עליו וקרניים שיוצאות ממנה'): GeoFig {
  const right = names.right || '_R'; const o = names.o || '_O'; const left = names.left || '_L';
  const ends = rays.map((_, i) => names.rays?.[i] || `_B${i}`);
  const pts: Record<string, Pt> = { [left]: [-3.2, 0], [o]: [0, 0], [right]: [3.2, 0] };
  rays.forEach((d, i) => { pts[ends[i]] = dir(d, 2.8); });
  const order = [right, ...ends, left];
  // neighbouring arcs at two radii, so their numbers do not sit on each other
  const angles = marks.flatMap((m, i) => (m ? [{ at: o, from: order[i], to: order[i + 1], r: i % 2 ? 36 : 26, ...m }] : []));
  return geo(label, { pts, segs: [{ a: left, b: right }, ...ends.map((e) => ({ a: o, b: e, hi: true }))], angles, dots: [o] });
}

/** Triangle ABC on its base AB from the angles at A and B (in degrees), with the marks of its corners. */
export function triFromAngles(a: number, b: number, marks: Record<string, Mark | null>, names: [string, string, string] = ['A', 'B', 'C']): GeoFig {
  return triangle(names, [[0, 0], [5, 0], apex(a, b)], marks);
}

/**
 * A sail: the mast stands straight up from the boom, and the sail's edge runs from the top of the mast to the boom's
 * end; the angle at the top of the mast is `top` degrees, the angle at the boom's end is asked.
 */
export function sail(top: number): GeoFig {
  const h = 4; const w = R(h * Math.tan(rad(top)));
  return geo('מפרש: תורן ישר, מוט תחתון ושפת המפרש', {
    pts: { _F: [0, 0], _E: [w, 0], _T: [0, h] }, polys: [{ pts: ['_F', '_E', '_T'] }],
    angles: [{ at: '_F', from: '_E', to: '_T', right: true }, { at: '_T', from: '_F', to: '_E', r: 30, text: `${top}°` }, { at: '_E', from: '_T', to: '_F', r: 26, text: '?', target: true }],
    words: [{ at: [0, R(h / 2)], text: 'תורן', dx: -30 }, { at: [R(w / 2), 0], text: 'מוט', dy: 24 }],
    view: [300, 210],
  });
}

/**
 * A folding ladder standing open: two equal legs `top` degrees apart at the top, the floor under them going on past one
 * foot (dashed), and the angle between that leg and the floor outside the ladder, asked.
 */
export function aFrame(top: number): GeoFig {
  const h = 3.4; const w = R(h * Math.tan(rad(top / 2)));
  return geo('סולם דו־צדדי פתוח על הרצפה', {
    pts: { _B: [-w, 0], _C: [w, 0], _A: [0, h], _E: [R(w + 2.4), 0], _G: [R(-w - 1), 0] },
    segs: [{ a: '_A', b: '_B', ticks: 1 }, { a: '_A', b: '_C', ticks: 1 }, { a: '_G', b: '_C', thin: true }, { a: '_C', b: '_E', dash: true }],
    angles: [{ at: '_A', from: '_B', to: '_C', r: 26, text: `${top}°` }, { at: '_C', from: '_E', to: '_A', r: 28, text: '?', target: true }],
    words: [{ at: [R(-w - 0.4), 0], text: 'רצפה', dy: 24 }],
  });
}

// ---------------------------------------------------------------- Pythagoras

/** A rectangle `w` by `h` and its diagonal (a garden, a screen, a frame), its sides marked with numbers or '?'. */
export function rectDiag(w: number, h: number, marks: { w?: string; h?: string; d?: string }, label: string): GeoFig {
  return geo(label, {
    pts: { _P: [0, 0], _Q: [w, 0], _S: [w, h], _T: [0, h] }, polys: [{ pts: ['_P', '_Q', '_S', '_T'] }],
    segs: [{ a: '_P', b: '_Q', ...lab(marks.w) }, { a: '_Q', b: '_S', ...lab(marks.h) }, { a: '_P', b: '_S', hi: true, side: 'in', ...lab(marks.d) }],
    angles: [{ at: '_Q', from: '_S', to: '_P', right: true }], pad: [48, 30],
  });
}

/**
 * A frame `w` wide and `h` high whose diagonal across one corner measures `d`: drawn with that corner at the angle the
 * three lengths give (a little more than a right angle when d is too long), the corner marked '?'.
 */
export function frame(w: number, h: number, d: number): GeoFig {
  const cos = (w * w + h * h - d * d) / (2 * w * h);
  const T: Pt = [R(h * cos), R(h * Math.sqrt(1 - cos * cos))];
  return geo('מסגרת: רוחב, גובה ואלכסון אחד', {
    pts: { _P: [0, 0], _Q: [w, 0], _S: [R(w + T[0]), T[1]], _T: T }, polys: [{ pts: ['_P', '_Q', '_S', '_T'] }],
    segs: [{ a: '_P', b: '_Q', label: String(w) }, { a: '_P', b: '_T', label: String(h) }, { a: '_Q', b: '_T', hi: true, side: 'in', label: String(d) }],
    angles: [{ at: '_P', from: '_Q', to: '_T', r: 22, text: '?', target: true }], pad: [44, 30],
  });
}

/** A pole `h` high and a cable from its top to the ground `d` from its foot; each side a number or '?'. */
export function poleCable(h: number, d: number, marks: { h?: string; d?: string; c?: string }): GeoFig {
  return geo('תורן וכבל מראשו אל הקרקע', {
    pts: { _B: [0, 0], _T: [0, h], _G: [d, 0] }, polys: [{ pts: ['_B', '_G', '_T'] }],
    segs: [{ a: '_B', b: '_T', ...lab(marks.h) }, { a: '_B', b: '_G', ...lab(marks.d) }, { a: '_T', b: '_G', hi: true, ...lab(marks.c) }],
    angles: [{ at: '_B', from: '_G', to: '_T', right: true }], view: [300, 190], pad: [36, 26],
  });
}

/** A ladder against a wall, its foot `foot` from the wall and its top `wall` up it; each length a number or '?'. */
export function ladderAt(foot: number, wall: number, marks: { len?: string; wall?: string; foot?: string }): GeoFig {
  return geo('סולם שנשען על קיר', {
    pts: { _F: [0, 0], _W: [foot, 0], _T: [foot, wall], _G0: [R(-foot * 0.4), 0], _K: [foot, R(wall * 1.15)] },
    polys: [{ pts: ['_F', '_W', '_T'] }],
    segs: [{ a: '_G0', b: '_F' }, { a: '_F', b: '_W', ...lab(marks.foot) }, { a: '_W', b: '_T', ...lab(marks.wall) }, { a: '_T', b: '_K' }, { a: '_F', b: '_T', hi: true, ...lab(marks.len) }],
    angles: [{ at: '_W', from: '_T', to: '_F', right: true }],
    words: [{ at: '_K', text: 'קיר', dx: 24, dy: 10 }], view: [300, 210],
  });
}

/**
 * Triangle ABC split by its height AD into two right triangles with AD in common (pyth:4's two steps, as content/grade8.js
 * altitudeSplit draws it), from AB, BD and DC; each side a number, '?' or nothing, and AD dashed and highlighted.
 */
export function heightSplit(ab: number, bd: number, dc: number, marks: { ab?: string; bd?: string; dc?: string; ac?: string; ad?: string }): GeoFig {
  return geo('משולש והגובה לצלע BC', {
    pts: { B: [0, 0], D: [bd, 0], C: [bd + dc, 0], A: [bd, R(Math.sqrt(ab * ab - bd * bd))] }, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'B', ...lab(marks.ab) }, { a: 'B', b: 'D', ...lab(marks.bd) }, { a: 'D', b: 'C', ...lab(marks.dc) }, { a: 'A', b: 'C', ...lab(marks.ac) }, { a: 'A', b: 'D', dash: true, hi: true, ...lab(marks.ad) }],
    angles: [{ at: 'D', from: 'C', to: 'A', right: true }],
  });
}

/**
 * A kite on a taut string `len` long, straight above a point `run` from the hand: the height is asked. The right angle is
 * not marked: finding it is the problem's first step.
 */
export function kite(len: number, run: number): GeoFig {
  const up = R(Math.sqrt(len * len - run * run));
  return geo('חוט של עפיפון מהיד אל העפיפון', {
    pts: { _H: [0, 0], _G: [run, 0], _K: [run, up] }, polys: [{ pts: ['_H', '_G', '_K'] }],
    segs: [{ a: '_H', b: '_K', hi: true, label: String(len) }, { a: '_H', b: '_G', label: String(run), dash: true }, { a: '_G', b: '_K', label: '?' }],
    dots: ['_K'], words: [{ at: '_K', text: 'עפיפון', dy: -16 }, { at: '_H', text: 'יד', dx: -18, dy: 6 }], view: [300, 220],
  });
}
