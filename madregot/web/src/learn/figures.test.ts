// The drawings of the teaching steps (Stage A, "מבינים את הרעיון"). A step that names a shape or a part of one (a ray,
// a vertex, a leg, the hypotenuse, a transversal, an exterior angle) shows it: every angles and Pythagoras step has a
// drawing or an object to move. A drawing must agree with its text and with itself:
//  - its letters are the text's letters (a drawing never names a point the text does not, and when it names points,
//    every point the text names is in it); a side named a, b or c, or an angle named α or β, is named so in the text;
//  - every angle written in degrees is drawn that size, every right-angle mark is 90°;
//  - numbers on sides are in proportion to the drawn lengths, and a number in a square is its side squared;
//  - the coordinate drawings put their points where the text says.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
// @ts-ignore: react-dom has no type declarations here
import { renderToStaticMarkup } from 'react-dom/server';
import { contentOf } from './content/index';
import type { DiscoverStep, FigSpec } from './types';
// @ts-ignore: plain JS
import Figure, { geoSweep, geoSquare } from '@/components/Figure.jsx';

type Pt = [number, number];
type Geo = FigSpec & { pts: Record<string, Pt>; segs?: any[]; angles?: any[]; squares?: any[]; polys?: any[]; dots?: string[]; words?: any[]; hide?: string[] };

const TOPICS = { angles: 5, pyth: 5 } as Record<string, number>;
/** Steps that name no shape of their own, with the reason. */
const NO_DRAWING: Record<string, number[]> = {
  // "a word problem comes with no drawing: first find the hidden right triangle"; the next step draws the ladder
  'pyth:4': [0],
};

const steps = () => Object.entries(TOPICS).flatMap(([topic, n]) => Array.from({ length: n }, (_, i) => `${topic}:${i + 1}`))
  .flatMap((skill) => contentOf(skill)!.discover.map((st, i) => ({ skill, i, st })));
const figOf = (st: DiscoverStep) => (st as { fig?: FigSpec }).fig;

/** The capital letters the step's maths names (inside $…$ and in its display), TeX commands removed. */
function mathOf(st: DiscoverStep) {
  const parts = [...st.text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
  if ('display' in st && st.display) parts.push(st.display);
  return parts.join(' ').replace(/\\[a-zA-Z]+/g, ' ');
}
const capitals = (s: string) => new Set([...s.matchAll(/[A-Z]/g)].map((m) => m[0]));
/** Point letters in the text: capitals, except the letter-shapes of angle pairs ("Z", "C" as shapes) when the drawing has none. */

const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const num = (t: unknown) => (typeof t === 'string' && /^\d+(\.\d+)?$/.test(t) ? Number(t) : null);

describe('teaching drawings: every step that names a shape shows it', () => {
  it('every angles and Pythagoras step of Stage A has a drawing or an object to move', () => {
    const missing = steps().filter(({ skill, i, st }) => !figOf(st) && !(st as { manip?: unknown }).manip && !(NO_DRAWING[skill] || []).includes(i));
    expect(missing.map(({ skill, i, st }) => `${skill} #${i}: ${st.text.slice(0, 50)}`)).toEqual([]);
  });

  it('every drawing renders, with no broken numbers', () => {
    for (const { skill, i, st } of steps()) {
      const fig = figOf(st); if (!fig) continue;
      const html = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(html, `${skill} #${i}`).toMatch(/<svg/);
      expect(html, `${skill} #${i}`).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});

describe('teaching drawings agree with their text and with themselves', () => {
  const geos = steps().filter(({ st }) => figOf(st)?.type === 'geo').map(({ skill, i, st }) => ({ where: `${skill} #${i}`, st, f: figOf(st) as Geo }));

  it('there are drawings to check', () => { expect(geos.length).toBeGreaterThan(60); });

  it('every name a drawing uses is one of its points', () => {
    for (const { where, f } of geos) {
      const has = (k: unknown) => typeof k !== 'string' || k in f.pts;
      const used = [
        ...(f.segs || []).flatMap((s) => [s.a, s.b]), ...(f.angles || []).flatMap((g) => [g.at, g.from, g.to]),
        ...(f.squares || []).flatMap((q) => [q.a, q.b, q.away]), ...(f.polys || []).flatMap((p) => p.pts), ...(f.dots || []), ...(f.words || []).map((w) => w.at),
      ];
      expect(used.filter((k) => k != null && !has(k)), where).toEqual([]);
    }
  });

  it('letters in a drawing match the letters in its text', () => {
    for (const { where, st, f } of geos) {
      const drawn = new Set(Object.keys(f.pts).filter((k) => !k.startsWith('_') && !(f.hide || []).includes(k)));
      drawn.forEach((k) => expect(k, `${where}: a point is named by one capital letter`).toMatch(/^[A-Z]$/));
      const said = capitals(mathOf(st));
      // the drawing names no point the text does not
      expect([...drawn].filter((k) => !said.has(k)), `${where}: letters in the drawing but not in the text`).toEqual([]);
      // and when it names points, it names every point the text names
      if (drawn.size) expect([...said].filter((k) => !drawn.has(k)), `${where}: letters in the text but not in the drawing`).toEqual([]);
      // sides named a, b, c and angles named α, β are named so in the text or its display
      const math = `${st.text} ${'display' in st ? st.display || '' : ''}`;
      for (const s of f.segs || []) if (/^[a-z]$/.test(s.label || '')) expect(math, `${where}: side ${s.label}`).toMatch(new RegExp(`\\b${s.label}\\b|${s.label}\\^`));
      for (const g of f.angles || []) {
        if (g.text === 'α') expect(math, where).toContain('\\alpha');
        if (g.text === 'β') expect(math, where).toContain('\\beta');
      }
    }
  });

  it('an angle written in degrees is drawn that size, and a right-angle mark is 90°', () => {
    let checked = 0;
    for (const { where, f } of geos) {
      for (const g of f.angles || []) {
        const { deg } = geoSweep(f.pts, g);
        if (g.right) { expect(Math.min(deg, 360 - deg), `${where}: right angle at ${g.at}`).toBeCloseTo(90, 1); checked += 1; }
        const m = /^(\d+)°$/.exec(g.text || '');
        if (m) { expect(Math.abs(deg - Number(m[1])), `${where}: ${g.text} at ${g.at} is drawn ${deg.toFixed(1)}°`).toBeLessThan(0.6); checked += 1; }
        // an arc marks an angle inside the shape, never the reflex angle outside it
        if (!g.right) expect(deg, `${where}: the arc at ${g.at} spans ${deg.toFixed(1)}°`).toBeLessThanOrEqual(180.0001);
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('numbers on sides are in proportion, and a number in a square is its side squared', () => {
    let checked = 0;
    for (const { where, f } of geos) {
      const ratios: number[] = [];
      for (const s of f.segs || []) { const n = num(s.label); if (n != null) ratios.push(n / dist(f.pts[s.a], f.pts[s.b])); }
      for (const q of f.squares || []) { const n = num(q.text); if (n != null) ratios.push(Math.sqrt(n) / dist(f.pts[q.a], f.pts[q.b])); }
      if (ratios.length >= 2) {
        const k = ratios[0];
        ratios.forEach((r) => expect(Math.abs(r / k - 1), `${where}: sides out of proportion (${ratios.map((x) => x.toFixed(3)).join(', ')})`).toBeLessThan(0.01));
        checked += 1;
      }
      // a square is built outside its triangle, on the side away from the third corner
      for (const q of f.squares || []) {
        if (!q.away) continue;
        const c = geoSquare(f.pts[q.a], f.pts[q.b], f.pts[q.away]);
        const mid: Pt = [(c[2][0] + c[3][0]) / 2, (c[2][1] + c[3][1]) / 2];
        expect(dist(mid, f.pts[q.away]), `${where}: square on ${q.a}${q.b}`).toBeGreaterThan(dist(f.pts[q.a], f.pts[q.away]) * 0.5);
      }
    }
    expect(checked).toBeGreaterThan(15);
  });

  it('the coordinate drawings put their points where the text says, and name only the text\'s points', () => {
    for (const { skill, i, st } of steps()) {
      const f = figOf(st) as any; if (f?.type !== 'coord') continue;
      const where = `${skill} #${i}`;
      const said = capitals(mathOf(st));
      const drawn = new Set<string>((f.points || []).map((p: { label: string }) => p.label));
      expect([...drawn].filter((k) => !said.has(k)), where).toEqual([]);
      if (drawn.size) expect([...said].filter((k) => !drawn.has(k)), where).toEqual([]);
      // a point written with its coordinates, like A(1, 2), is drawn there
      for (const m of st.text.matchAll(/([A-Z])\((-?\d+),\s*(-?\d+)\)/g)) {
        const p = (f.points || []).find((q: { label: string }) => q.label === m[1]);
        expect(p, `${where}: ${m[0]}`).toBeTruthy();
        expect([p.x, p.y], `${where}: ${m[0]}`).toEqual([Number(m[2]), Number(m[3])]);
      }
      const inside = (v: number) => Math.abs(v) <= f.range;
      for (const [[x1, y1], [x2, y2]] of f.segments || []) expect([x1, y1, x2, y2].every(inside), where).toBe(true);
    }
  });
});
