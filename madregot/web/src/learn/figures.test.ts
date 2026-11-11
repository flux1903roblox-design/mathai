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
import { contentOf, loadAllContent } from './content/index';
import type { DiscoverStep, FigSpec } from './types';
// @ts-ignore: plain JS
import Figure, { geoSweep, geoSquare, FIG_TYPES } from '@/components/Figure.jsx';
// @ts-ignore: plain JS
import { figPlain } from '@/content/index.js';
// @ts-ignore: plain JS
import { chartAxis, chartNum, pictoIcons, AXIS_LABELS } from '@/content/manip.js';

// the teaching content loads one topic at a time (DURABLE-11): these tests run on all of it, loaded (CONTENT: every
// stair, for the student lane's sweeps over every teaching step)
const CONTENT = await loadAllContent();

type Pt = [number, number];
type Geo = FigSpec & { pts: Record<string, Pt>; segs?: any[]; angles?: any[]; squares?: any[]; polys?: any[]; dots?: string[]; words?: any[]; hide?: string[] };

const TOPICS = { angles: 5, pyth: 5 } as Record<string, number>;

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
    const missing = steps().filter(({ st }) => !figOf(st) && !(st as { manip?: unknown }).manip);
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

// ---------------------------------------------------------------- STUDENT-8: the teaching figures of every topic
// The new types (numline, thermo, machine, dots, bars) and the plane's quadrants, walks, lines, meeting point and
// rise-and-run must agree with themselves everywhere they appear, and, in every topic, with their step's text:
//  - a letter the text names alone ($A$, $x$) or a point it names by its coordinates ($A(3, 4)$) is written in the figure;
//  - a point named with its coordinates is drawn there (a mark on a number line, a point, a corner of a walk or the
//    meeting point on a plane);
//  - a predict step's answer is not written in its own figure;
//  - a function's graph is never the 'linear' figure (a linear pair of angles) in line:* or sys:*;
//  - two lines that meet, meet on a whole or half number inside the plane.
type AnyFig = Record<string, any> & { type: string };
const plainOf = (s: unknown) => String(s ?? '').replace(/\$/g, '').replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim();
const fmt = (v: number) => String(Math.round(v * 1000) / 1000);
const halfStep = (v: number) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
const meetOf = (p: { m: number; b: number }, q: { m: number; b: number }): Pt | null => (p.m === q.m ? null : [(q.b - p.b) / (p.m - q.m), (p.m * (q.b - p.b)) / (p.m - q.m) + p.b]);

/** What a figure writes on itself (names, numbers in labels, words), normalised: not the numbers along an axis. */
function labelsOf(f: AnyFig): Set<string> {
  const io = (v: unknown, d: string) => (v == null ? d : String(v));
  const out: unknown[] = (() => {
    switch (f.type) {
      case 'numline': return [...(f.marks || []).map((k: any) => k.label), ...(f.jumps || []).map((j: any) => j.label)];
      case 'thermo': return [fmt(f.value), f.label, ...(f.also ? [fmt(f.also.value), f.also.label] : [])];
      case 'machine': return [io(f.inX, 'x'), io(f.outY, 'y'), f.rule];
      case 'dots': return [f.unit];
      case 'bars': return [...f.labels, ...f.values.map((v: number | null) => (v == null ? '?' : fmt(v))), f.unit, f.level != null && fmt(f.level)];
      case 'coord': {
        const lines = [...(f.line ? [f.line] : []), ...(f.lines || [])];
        const meet = f.meet && f.lines?.length > 1 ? meetOf(f.lines[0], f.lines[1]) : null;
        const rr = f.riseRun && lines[0] ? [fmt(f.riseRun.run), fmt(lines[0].m * f.riseRun.run)] : [];
        return ['x', 'y', ...(f.points || []).filter((p: any) => !p.hidden).map((p: any) => p.label), ...(f.lines || []).map((l: any) => l.label),
          ...(meet ? [`(${fmt(meet[0])}, ${fmt(meet[1])})`] : []), ...rr, ...(f.words || []).map((w: any) => w.text)];
      }
      case 'geo': return [...Object.keys(f.pts).filter((k) => !k.startsWith('_') && !(f.hide || []).includes(k)), ...(f.segs || []).map((s: any) => s.label),
        ...(f.angles || []).map((g: any) => g.text), ...(f.squares || []).map((q: any) => q.text), ...(f.words || []).map((w: any) => w.text)];
      // the algebra objects write x on a box or a long tile, and the rectangle its sides (and parts' areas)
      case 'tiles': return [f.px && 'x', f.nx && '-x', f.p1 && '1', f.n1 && '-1'];
      case 'scale': return [(f.left.x || f.right.x) && 'x'];
      case 'area': return ['x', fmt(f.a), f.b && fmt(f.b), ...(f.areas ? [`${f.a === 1 ? '' : f.a}x`, fmt(f.a * f.b)] : [])];
      case 'right': return [f.a, f.b, f.c];
      case 'ladder': return [f.wall, f.foot, f.len];
      case 'table': return [...f.head, ...f.rows.flat()];
      // the data figures (DATA-3): names, the numbers printed on bars, slices and points (not with labels: false), the
      // '?' of a hidden one, a line's xs and level, a pictogram's key; a table of outcomes its headings and cells
      case 'chart': return [...(f.cats || []), ...(f.mode === 'line' ? (f.xs || []).map(String) : []), f.unit, f.mode === 'picto' && fmt(f.key),
        f.level != null && chartNum(f.level, f.dp), f.mark != null && String(f.mark),
        ...f.values.map((v: number | null, i: number) => (f.hide === i ? '?' : f.labels === false || f.mode === 'picto' || v == null ? null : `${chartNum(v, f.dp)}${f.pct ? '%' : ''}`))];
      case 'outcomes': return [f.rowHead, f.colHead, ...(f.rows || []), ...f.cols, ...(f.cells || []).flat()];
      case 'pair': return (f.items || []).flatMap((x: AnyFig) => [...labelsOf(x)]);
      default: return [];
    }
  })();
  return new Set(out.filter((x) => x != null && x !== '' && x !== 0).map(plainOf));
}

/** A chart agrees with itself: a name for every value, values on its axis, a key that halves, marks on the chart. */
function chartProblems(f: AnyFig): string[] {
  const bad: string[] = [];
  const n = f.values.length; const at = (i: number) => Number.isInteger(i) && i >= 0 && i < n;
  if (!['bar', 'pie', 'line', 'picto'].includes(f.mode)) bad.push(`chart mode ${f.mode}`);
  if (f.mode !== 'line' && (f.cats || []).length !== n) bad.push(`chart: ${(f.cats || []).length} names for ${n} values`);
  if (f.mode === 'line' && f.xs && f.xs.length !== n) bad.push(`chart: ${f.xs.length} xs for ${n} values`);
  if (f.values.some((v: number | null) => v != null && v < 0)) bad.push('chart with a value under 0');
  if (f.hide != null && !at(f.hide)) bad.push(`chart hide ${f.hide}`);
  for (const i of f.cross || []) if (!at(i)) bad.push(`chart cross ${i}`);
  if (f.mode === 'bar' || f.mode === 'line') {
    const ax = chartAxis(f);
    for (const v of f.values) if (v != null && (v < ax.from - 1e-9 || v > ax.max + 1e-9)) bad.push(`chart value ${v} off the axis ${ax.from}..${ax.max}`);
    if (f.level != null && (f.level < ax.from || f.level > ax.max)) bad.push(`chart level ${f.level} off the axis`);
    if (f.step && Math.abs((ax.max - ax.from) / f.step - Math.round((ax.max - ax.from) / f.step)) > 1e-9) bad.push(`chart axis ${ax.from}..${ax.max} is not whole steps of ${f.step}`);
  }
  if (f.mode === 'line' && f.dashed != null && !(f.dashed >= 1 && f.dashed < n)) bad.push(`chart dashed ${f.dashed}`);
  if (f.mode === 'line' && f.mark != null) {
    const xs = f.xs || [];
    const ok = typeof f.mark === 'number' && xs.every((x: unknown) => typeof x === 'number') ? f.mark >= Math.min(...xs) && f.mark <= Math.max(...xs) : xs.includes(f.mark);
    if (!ok) bad.push(`chart mark ${f.mark} is not on the line`);
  }
  if (f.mode === 'picto') {
    if (!(f.key > 0)) bad.push(`pictogram key ${f.key}`);
    else for (const v of f.values) if (v != null && Math.abs(pictoIcons(v, f.key) - (2 * v) / f.key / 2) > 1e-9) bad.push(`pictogram value ${v} is not a whole or half icon of ${f.key}`);
  }
  if (f.mode === 'pie' && !(f.values.reduce((a: number, v: number | null) => a + (v || 0), 0) > 0)) bad.push('a pie with nothing in it');
  return bad;
}

/** The structural checks: a figure agrees with itself. */
function selfProblems(skill: string, f: AnyFig): string[] {
  const bad: string[] = [];
  const within = (v: number, lo: number, hi: number) => v >= lo - 1e-9 && v <= hi + 1e-9;
  const topic = skill.split(':')[0];
  if (f.type === 'linear' && (topic === 'line' || topic === 'sys')) bad.push("a function's graph drawn as 'linear', which is a linear pair of angles: use coord with line or lines");
  if (f.type === 'numline') {
    if (!(f.from < f.to)) bad.push(`numline from ${f.from} to ${f.to}`);
    if (f.den != null && !(Number.isInteger(f.den) && f.den > 0)) bad.push(`numline den ${f.den}`);
    for (const k of f.marks || []) if (!within(k.x, f.from, f.to)) bad.push(`numline mark at ${k.x} outside [${f.from}, ${f.to}]`);
    for (const j of f.jumps || []) if (!within(j.from, f.from, f.to) || !within(j.to, f.from, f.to)) bad.push(`numline jump ${j.from} → ${j.to} outside [${f.from}, ${f.to}]`);
  }
  if (f.type === 'thermo') for (const v of [f.value, ...(f.also ? [f.also.value] : [])]) if (!(f.min < f.max && within(v, f.min, f.max))) bad.push(`thermo ${v} on a scale ${f.min}..${f.max}`);
  if (f.type === 'machine' && !String(f.rule || '').trim()) bad.push('a machine with no rule');
  if (f.type === 'dots') {
    const [lo, hi] = f.axis; const vs: number[] = f.values; const k = f.mark || {};
    if (!(lo < hi)) bad.push(`dots axis ${lo}..${hi}`);
    for (const v of vs) if (!within(v, lo, hi)) bad.push(`dots value ${v} outside the axis ${lo}..${hi}`);
    const sorted = [...vs].sort((a, b) => a - b); const n = sorted.length;
    const count = (v: number) => vs.filter((x) => x === v).length; const most = Math.max(...vs.map(count));
    if (k.mode != null && count(k.mode) !== most) bad.push(`dots mode ${k.mode} is not the most common value`);
    if (k.median != null && Math.abs(k.median - (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2)) > 1e-9) bad.push(`dots median ${k.median} is not the median`);
    if (k.mean != null && Math.abs(k.mean - vs.reduce((a, b) => a + b, 0) / n) > 1e-9) bad.push(`dots mean ${k.mean} is not the mean`);
  }
  if (f.type === 'bars') {
    if (f.labels.length !== f.values.length) bad.push(`bars: ${f.labels.length} names for ${f.values.length} values`);
    if (f.values.some((v: number | null) => v != null && v < 0)) bad.push('bars with a value under 0');
    if (f.highlight != null && !(f.highlight >= 0 && f.highlight < f.values.length)) bad.push(`bars highlight ${f.highlight}`);
    if (f.level != null && !(f.level >= 0)) bad.push(`bars level ${f.level}`);
  }
  if (f.type === 'chart') bad.push(...chartProblems(f));
  if (f.type === 'outcomes') {
    const n = f.rows?.length || 1;
    if (f.cells && (f.cells.length !== n || f.cells.some((r: unknown[]) => r.length !== f.cols.length))) bad.push(`outcomes: cells are not ${n} × ${f.cols.length}`);
    for (const [i, j] of f.marked || []) if (!(i >= 0 && i < n && j >= 0 && j < f.cols.length)) bad.push(`outcomes: marked (${i}, ${j}) outside the table`);
  }
  if (f.type === 'pair') {
    if (f.items?.length !== 2) bad.push(`pair of ${f.items?.length} sources`);
    for (const x of f.items || []) if (x?.type === 'pair') bad.push('a pair inside a pair'); else if (x) bad.push(...selfProblems(skill, x).map((p) => `source: ${p}`));
  }
  if (f.type === 'coord') {
    const r = f.range || 6; const inside = ([x, y]: Pt) => Math.abs(x) <= r && Math.abs(y) <= r;
    for (const p of f.path || []) if (!inside(p)) bad.push(`a walk through (${p}) outside the plane`);
    const first = f.line || f.lines?.[0];
    if (f.riseRun) {
      if (!first) bad.push('riseRun with no line');
      else {
        const { x, run } = f.riseRun; const ends: Pt[] = [[x, first.m * x + first.b], [x + run, first.m * (x + run) + first.b]];
        if (!ends.every(inside)) bad.push(`riseRun from x = ${x}, run ${run} leaves the plane`);
      }
    }
    if (f.meet) {
      if (!(f.lines?.length >= 2)) bad.push('meet with fewer than two lines');
      else {
        const p = meetOf(f.lines[0], f.lines[1]);
        if (!p) bad.push('meet on two parallel lines');
        else if (!p.every(halfStep) || !inside(p)) bad.push(`the lines meet at (${p.map(fmt)}): not a whole or half number inside the plane`);
      }
    }
  }
  return bad;
}

/** The checks against the text, for topics that are fully drawn. A predict step that asks where a point is, or what its
 * coordinates are, lists that point as hidden (in its place, not drawn), so the figure does not answer the question:
 * there a hidden point counts as the text's point. */
function textProblems(st: DiscoverStep, f: AnyFig): string[] {
  const bad: string[] = [];
  const asks = st.kind === 'predict';
  const labels = labelsOf(f);
  if (asks && f.type === 'coord') for (const p of f.points || []) if (p.hidden) labels.add(plainOf(p.label));
  const groups = [...st.text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
  // a letter named alone, or a point named by its coordinates, is written in the figure; a letter as a shape ("צורת $Z$",
  // the shape of alternate angles) names no point
  const letters = new Set<string>();
  for (const m of st.text.matchAll(/(צורת\s*)?\$([^$]+)\$/g)) {
    const one = /^\s*([A-Za-z])\s*$/.exec(m[2]); if (one && !m[1]) letters.add(one[1]);
    for (const p of m[2].matchAll(/([A-Z])\s*\(\s*-?\d/g)) letters.add(p[1]);
  }
  // a letter is written in the figure on its own (A, x) or inside a label: m = 2, (0, b), y = 2x + 1
  const words = new Set([...labels].flatMap((l) => l.split(/[^A-Za-z]+/)).filter(Boolean));
  // the letters of a fraction written in general ($\frac{a}{b}$, the fraction unit's rule) are its numerator and
  // denominator, not points: the figure shows one case of them (3/5), never the letters
  // (in either case: the percent unit's $\frac{A}{p}$), and a letter a rule multiplies or divides by is a quantity too
  // ($\frac{p}{100} \cdot N$; "כופלים ב־$S$", a map's scale): the figure shows one case of them, never the letters
  const general = new Set([
    ...[...st.text.matchAll(/\\[dt]?frac\{([A-Za-z])\}\{([A-Za-z0-9]+)\}|\\[dt]?frac\{([A-Za-z0-9]+)\}\{([A-Za-z])\}/g)].flatMap((m) => m.slice(1)),
    ...[...st.text.matchAll(/\\cdot\s*([A-Za-z])(?![A-Za-z])|(?<![A-Za-z\\])([A-Za-z])\s*\\cdot/g)].flatMap((m) => m.slice(1)),
    ...[...st.text.matchAll(/(?:כופלים|מחלקים)\s+ב־?\$([A-Za-z])\$/g)].map((m) => m[1]),
  ].filter(Boolean));
  for (const k of letters) if (!labels.has(k) && !words.has(k) && !general.has(k)) bad.push(`the text names ${k}, the figure does not`);
  // a point named with its coordinates is drawn there
  for (const g of groups) {
    for (const m of g.matchAll(/(?:([A-Z])\s*)?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
      if (f.type !== 'coord') continue;
      const [x, y] = [Number(m[2]), Number(m[3])];
      const lines = f.lines || [];
      const meet = f.meet && lines.length > 1 ? meetOf(lines[0], lines[1]) : null;
      const at = (p: Pt) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9;
      const ok = (f.points || []).some((p: any) => (asks || !p.hidden) && (!m[1] || p.label === m[1]) && at([p.x, p.y]))
        || (!m[1] && ((meet && at(meet)) || (f.path || []).some((p: Pt) => at(p))));
      if (!ok) bad.push(`${m[0]} is not drawn there`);
    }
    for (const m of g.matchAll(/([A-Z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
      if (f.type !== 'numline') continue;
      if (!(f.marks || []).some((k: any) => k.label === m[1] && Math.abs(k.x - Number(m[2])) < 1e-9)) bad.push(`${m[0]} is not marked there`);
    }
  }
  // a prediction's answer is not written in its own figure (a table's cells are data, where a number may come up by
  // chance: its headings count; so is a bar the step's own text or display gives, like the 4 of 2, 7, 4, 3)
  const given = new Set([...`${st.text} ${'display' in st ? st.display || '' : ''}`.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => m[0]));
  const written = f.type === 'table' ? new Set((f.head as unknown[]).map(plainOf))
    : f.type === 'bars' ? new Set([...labelsOf({ ...f, values: f.values.filter((v: number | null) => v == null || !given.has(fmt(v))) })]) : labelsOf(f);
  if (st.kind === 'predict' && written.has(plainOf(st.choices[st.answer]))) bad.push(`the answer ${plainOf(st.choices[st.answer])} is written in the figure`);
  return bad;
}

const ALL_STEPS = () => Object.values(CONTENT).flatMap((c) => [
  ...c.discover.map((st, i) => ({ skill: c.skill, where: `${c.skill} #${i}`, st, main: true })),
  ...c.misconceptions.flatMap((mc) => mc.remedy.map((st, i) => ({ skill: c.skill, where: `${c.skill} ${mc.id} remedy #${i}`, st, main: false }))),
]);

describe('the teaching figures (STUDENT-8) agree with themselves and with their text', () => {
  it('every figure in every topic agrees with itself (marks on the line, dots on the axis, lines that meet, no angles for a graph)', () => {
    const bad = ALL_STEPS().flatMap(({ skill, where, st }) => { const f = figOf(st) as AnyFig | undefined; return f ? selfProblems(skill, f).map((p) => `${where}: ${p}`) : []; });
    expect(bad).toEqual([]);
  });

  it('in every topic, a figure writes what its text names and never the answer it asks for', () => {
    const bad = ALL_STEPS()
      .flatMap(({ where, st }) => { const f = figOf(st) as AnyFig | undefined; return f ? textProblems(st, f).map((p) => `${where}: ${p}`) : []; });
    expect(bad).toEqual([]);
  });

  // every teaching figure of every unit drawn to HTML: over 5 s on a busy machine since the data unit, hence its own limit
  it('every figure renders, with no broken numbers', () => {
    for (const { where, st } of ALL_STEPS()) {
      const fig = figOf(st); if (!fig) continue;
      const html = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(html, where).toMatch(/<svg|<table/);
      expect(html, where).not.toMatch(/NaN|undefined|Infinity/);
    }
  }, 30_000);

  // the checks themselves, on made-up steps: each catches what it is for, and lets a right figure through
  const say = (text: string, fig: AnyFig): DiscoverStep => ({ kind: 'say', text, fig: fig as FigSpec });
  const predict = (text: string, fig: AnyFig, choices: string[], answer: number): DiscoverStep => ({ kind: 'predict', text, fig: fig as FigSpec, choices, answer, why: '' });
  const both = (skill: string, st: DiscoverStep) => [...selfProblems(skill, figOf(st) as AnyFig), ...textProblems(st, figOf(st) as AnyFig)];

  it('lets right figures through', () => {
    expect(both('signed:1', say('מתחילים ב־$-2$ וזזים $5$ ימינה.', { type: 'numline', from: -6, to: 6, marks: [{ x: 0, label: '0' }], jumps: [{ from: -2, to: 3, label: '+5' }], anim: true }))).toEqual([]);
    expect(both('signed:1', say('הנקודה $A(-3)$ על הציר.', { type: 'numline', from: -6, to: 6, marks: [{ x: -3, label: 'A' }] }))).toEqual([]);
    expect(both('coord:1', say('הנקודה $B(3, 4)$ ברביע הראשון.', { type: 'coord', range: 6, quadrants: true, points: [{ x: 3, y: 4, label: 'B' }], path: [[3, 0], [3, 4]] }))).toEqual([]);
    expect(both('line:2', say('הישר $y = 2x - 1$: צעד אחד ימינה, שניים למעלה.', { type: 'coord', range: 6, line: { m: 2, b: -1 }, riseRun: { x: 0, run: 1 } }))).toEqual([]);
    expect(both('sys:1', say('שני הישרים נפגשים בנקודה $(2, 3)$.', { type: 'coord', range: 6, lines: [{ m: 1, b: 1 }, { m: -1, b: 5 }], meet: true }))).toEqual([]);
    expect(both('line:1', say('המכונה מקבלת $x$ ומחזירה $2x + 1$.', { type: 'machine', rule: '2x + 1' }))).toEqual([]);
    expect(both('stats:1', say('הציונים: $6, 7, 7, 8, 9$.', { type: 'dots', values: [6, 7, 7, 8, 9], axis: [5, 10], mark: { mode: 7, median: 7, mean: 7.4 } }))).toEqual([]);
    expect(both('stats:1', say('כמה תלמידים בחרו כל ענף.', { type: 'bars', labels: ['כדורגל', 'כדורסל'], values: [12, 8], highlight: 0 }))).toEqual([]);
    expect(both('signed:1', say('בלילה הטמפרטורה ירדה.', { type: 'thermo', value: -4, min: -10, max: 10 }))).toEqual([]);
    expect(both('signed:2', say('ביום ראשון $-3$ מעלות, וביום שני $-8$.', { type: 'thermo', value: -3, label: 'יום ראשון', also: { value: -8, label: 'יום שני' }, min: -10, max: 10 }))).toEqual([]);
    expect(both('coord:4', say('שטח מלבן הוא רוחב $a$ כפול גובה $b$.', { type: 'coord', range: 5, polygon: [[0, 0], [4, 0], [4, 3], [0, 3]], words: [{ at: [2, -0.6], text: 'a' }, { at: [4.6, 1.5], text: 'b' }] }))).toEqual([]);
    // a predict step that asks where a point is keeps it hidden, in its place
    const asked = { type: 'coord', range: 6, quadrants: true, points: [{ x: 0, y: -3, label: 'E', hidden: true }] };
    expect(both('coord:1', predict('ואיפה $E(0, -3)$?', asked, ['על ציר $y$', 'בראשית'], 0))).toEqual([]);
    const corner = { type: 'coord', range: 6, points: [{ x: 1, y: -3, label: 'A' }, { x: 1, y: 2, label: 'D', hidden: true }] };
    expect(both('coord:5', predict('נתון $A(1, -3)$. מה השיעורים של $D$?', corner, ['$(1, 2)$', '$(2, 1)$'], 0))).toEqual([]);
  });

  it('catches a figure that disagrees with itself', () => {
    expect(selfProblems('signed:1', { type: 'numline', from: -6, to: 6, marks: [{ x: 8 }] })).toEqual(['numline mark at 8 outside [-6, 6]']);
    expect(selfProblems('signed:1', { type: 'numline', from: 0, to: 5, jumps: [{ from: 2, to: 7 }] })).toHaveLength(1);
    expect(selfProblems('stats:1', { type: 'dots', values: [1, 12], axis: [0, 10] })).toEqual(['dots value 12 outside the axis 0..10']);
    expect(selfProblems('stats:1', { type: 'dots', values: [1, 2, 2, 9], axis: [0, 10], mark: { mode: 1, median: 3, mean: 3 } })).toEqual([
      'dots mode 1 is not the most common value', 'dots median 3 is not the median', 'dots mean 3 is not the mean']);
    expect(selfProblems('signed:1', { type: 'thermo', value: 15, min: -10, max: 10 })).toHaveLength(1);
    expect(selfProblems('line:3', { type: 'linear', a: 40 })).toHaveLength(1);
    expect(selfProblems('sys:2', { type: 'linear', a: 40 })).toHaveLength(1);
    expect(selfProblems('angles:1', { type: 'linear', a: 40 })).toEqual([]); // in angles it is what it is: a linear pair
    expect(selfProblems('sys:1', { type: 'coord', lines: [{ m: 2, b: 1 }, { m: 2, b: -3 }], meet: true })).toEqual(['meet on two parallel lines']);
    expect(selfProblems('sys:1', { type: 'coord', lines: [{ m: 3, b: 0 }, { m: 0, b: 1 }], meet: true })[0]).toMatch(/not a whole or half number/);
    expect(selfProblems('sys:1', { type: 'coord', range: 6, lines: [{ m: 1, b: 0 }, { m: -1, b: 16 }], meet: true })[0]).toMatch(/inside the plane/);
    expect(selfProblems('line:2', { type: 'coord', riseRun: { x: 0, run: 1 } })).toEqual(['riseRun with no line']);
    expect(selfProblems('stats:2', { type: 'bars', labels: ['א'], values: [1, 2] })).toHaveLength(1);
    expect(selfProblems('stats:5', { type: 'bars', labels: ['', ''], values: [3, null], level: 5 })).toEqual([]); // a missing value is not a negative one
    expect(selfProblems('stats:5', { type: 'bars', labels: ['', ''], values: [3, -1], level: -2 })).toEqual(['bars with a value under 0', 'bars level -2']);
    expect(selfProblems('signed:2', { type: 'thermo', value: -3, also: { value: -12 }, min: -10, max: 10 })).toEqual(['thermo -12 on a scale -10..10']);
  });

  it('catches a figure that disagrees with its text, or gives away the answer', () => {
    expect(textProblems(say('הנקודה $C$ על הציר.', { type: 'numline', from: 0, to: 5, marks: [{ x: 2, label: 'B' }] }), { type: 'numline', from: 0, to: 5, marks: [{ x: 2, label: 'B' }] }))
      .toEqual(['the text names C, the figure does not']);
    const par = { type: 'parallel', a: 55, kind: 'alternate' };
    expect(textProblems(say('זוויות מתחלפות (צורת $Z$).', par), par)).toEqual([]); // a letter as a shape is no point
    const f = { type: 'coord', points: [{ x: 4, y: 3, label: 'B' }] };
    expect(textProblems(say('הנקודה $B(3, 4)$.', f), f)).toEqual(['B(3, 4) is not drawn there']);
    const nl = { type: 'numline', from: -6, to: 6, marks: [{ x: 2, label: 'A' }] };
    expect(textProblems(say('הנקודה $A(-2)$.', nl), nl)).toEqual(['A(-2) is not marked there']);
    const out = { type: 'machine', inX: 3, rule: '2x + 1', outY: 7 };
    expect(textProblems(predict('מה יוצא מהמכונה?', out, ['$7$', '$6$'], 0), out)).toEqual(['the answer 7 is written in the figure']);
    const asked = { ...out, outY: '?' };
    expect(textProblems(predict('מה יוצא מהמכונה?', asked, ['$7$', '$6$'], 0), asked)).toEqual([]);
    const meet = { type: 'coord', lines: [{ m: 1, b: 1 }, { m: -1, b: 5 }], meet: true };
    expect(textProblems(predict('איפה הישרים נפגשים?', meet, ['$(2, 3)$', '$(3, 2)$'], 0), meet)).toEqual(['the answer (2, 3) is written in the figure']);
    // a hidden point stands for the text's point only where a prediction asks about it, and only in its place
    const hid = { type: 'coord', points: [{ x: 0, y: -3, label: 'E', hidden: true }] };
    expect(textProblems(say('הנקודה $E(0, -3)$ על ציר $y$.', hid), hid)).toEqual(['the text names E, the figure does not', 'E(0, -3) is not drawn there']);
    const off = { type: 'coord', points: [{ x: 0, y: 3, label: 'E', hidden: true }] };
    expect(textProblems(predict('ואיפה $E(0, -3)$?', off, ['$1$', '$2$'], 0), off)).toEqual(['E(0, -3) is not drawn there']);
    const side = { type: 'coord', words: [{ at: [0, 0], text: 'a' }] };
    expect(textProblems(say('רוחב $a$ כפול גובה $b$.', side), side)).toEqual(['the text names b, the figure does not']);
    // a letter inside a label counts (m = 2, (0, b)); a letter inside a longer name does not (AB is not A)
    const mb = { type: 'coord', points: [{ x: 0, y: 1, label: '(0, b)' }], words: [{ at: [3, 3], text: 'm = 2' }] };
    expect(textProblems(say('שני מספרים: $m$ ו־$b$.', mb), mb)).toEqual([]);
    const ab = { type: 'coord', words: [{ at: [0, 0], text: 'AB' }] };
    expect(textProblems(say('הנקודה $A$.', ab), ab)).toEqual(['the text names A, the figure does not']);
    const pair = { type: 'thermo', value: -3, also: { value: -8 }, min: -10, max: 10 };
    expect(textProblems(predict('איפה קר יותר?', pair, ['$-8$', '$-3$'], 0), pair)).toEqual(['the answer -8 is written in the figure']);
    // a bar the step's own data gives is data (the 4 of 2, 7, 4, 3); a bar, a level or a missing value it does not give
    // is a giveaway
    const shells = { type: 'bars', labels: ['', '', '', ''], values: [2, 7, 4, 3] };
    expect(textProblems({ kind: 'predict', text: 'כמה יקבל כל אחד?', display: '2,\\ 7,\\ 4,\\ 3', fig: shells as FigSpec, choices: ['$4$', '$16$'], answer: 0, why: '' }, shells)).toEqual([]);
    const even = { type: 'bars', labels: ['', '', '', ''], values: [4, 4, 4, 4] };
    expect(textProblems(predict('כמה יקבל כל אחד?', even, ['$4$', '$16$'], 0), even)).toEqual(['the answer 4 is written in the figure']);
    const level = { type: 'bars', labels: ['', ''], values: [2, 6], level: 4 };
    expect(textProblems(predict('מה הממוצע של $2$ ו־$6$?', level, ['$4$', '$8$'], 0), level)).toEqual(['the answer 4 is written in the figure']);
    // a dot plot's line over it counts as written (n = 7 there names the n of the text)
    const n = { type: 'dots', values: [1, 2, 3], axis: [0, 4], unit: 'יש n = 3 נתונים' };
    expect(textProblems(say('עם $n$ נתונים.', n), n)).toEqual([]);
    expect(textProblems(say('עם $n$ נתונים.', { ...n, unit: undefined }), { ...n, unit: undefined })).toEqual(['the text names n, the figure does not']);
  });

  it('in every topic, a say step that opens a stair draws itself in when its figure can', () => {
    const DRAWS = new Set(['numline', 'thermo', 'machine', 'dots', 'coord', 'bars', 'table', 'chart']);
    const bad = Object.values(CONTENT).flatMap((c) => {
      const st = c.discover[0]; const f = figOf(st) as AnyFig | undefined;
      return st.kind === 'say' && f && DRAWS.has(f.type) && !f.anim ? [`${c.skill} #0: ${f.type} without anim`] : [];
    });
    expect(bad).toEqual([]);
  });
});

// ---------------------------------------------------------------- DATA-3: the data figures and their extensions
// chart (bar, pie, line, picto), outcomes and pair, drawn on their own before any topic uses them: each renders with no
// broken number, says every number it draws in figPlain (and nothing it hides), and keeps its drawing rules (a grid
// line at every step, at most 8 axis numbers, no value on a labels: false bar, a legend under a pie in its clockwise
// order, half icons, runs, two sources). The checks of selfProblems and labelsOf above hold the content stages to them.
describe('the data figures (DATA-3)', () => {
  const html = (fig: AnyFig) => renderToStaticMarkup(createElement(Figure, { fig: fig as FigSpec }));
  const count = (h: string, cls: string) => (h.match(new RegExp(`class="${cls}"`, 'g')) || []).length;
  const sports = { type: 'chart', mode: 'bar', cats: ['כדורגל', 'כדורסל', 'שחייה', 'טניס'], values: [12, 8, 6, 4], max: 14, step: 2 };
  const FIGS: Record<string, AnyFig> = {
    bar: sports,
    barBlank: { ...sports, labels: false },
    truncated: { type: 'chart', mode: 'bar', cats: ['ראשקל', 'בלי כאב'], values: [82, 88], from: 80, max: 90, step: 2 },
    clubs: { type: 'chart', mode: 'bar', cats: ['בלי חוג', 'חוג אחד', 'יותר מחוג אחד'], values: [30, 70, 100], max: 140, step: 10, every: 2 },
    bill: { type: 'chart', mode: 'bar', cats: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי'], values: [520, 480, 420, 390, 360], step: 100, hide: 2, cross: [0], level: 350 },
    pie: { type: 'chart', mode: 'pie', cats: ['שיחה', 'אין תשובה', 'קו מקולקל', 'תפוס'], values: [50, 20, 25, 5], pct: true },
    pieHidden: { type: 'chart', mode: 'pie', cats: ['אדום', 'כחול', 'ירוק'], values: [0.3, 0.25, 0.45], hide: 2 },
    years: { type: 'chart', mode: 'line', xs: [2010, 2016], values: [2, 3.2], mark: 2014, dp: 1, step: 0.5, max: 3.5 },
    tickets: { type: 'chart', mode: 'line', xs: ['8:00', '10:00', '12:00', '14:00', '16:00'], values: [200, 350, 500, 650, 800], dashed: 1, step: 100, max: 900, every: 2 },
    wind: { type: 'chart', mode: 'line', xs: [1, 2, 3, 4], values: [0.5, 1.2, 2.4, 1.8], level: 2, dp: 1, step: 0.5, max: 3, cross: [2] },
    picto: { type: 'chart', mode: 'picto', cats: ['מתח', 'מדע בדיוני', 'שירה'], values: [14, 8, 2], key: 4, unit: 'ילדים', icon: 'person' },
    dice: { type: 'outcomes', rowHead: 'קובייה א׳', colHead: 'קובייה ב׳', rows: ['1', '2', '3', '4', '5', '6'], cols: ['1', '2', '3', '4', '5', '6'], cells: [1, 2, 3, 4, 5, 6].map((r) => [1, 2, 3, 4, 5, 6].map((c) => String(r + c))), marked: [[4, 5], [5, 4]], label: 'של שתי קוביות' },
    coinDie: { type: 'outcomes', rowHead: 'מטבע', colHead: 'קובייה', rows: ['עץ', 'פלי'], cols: ['1', '2', '3', '4', '5', '6'] },
    raffle: { type: 'outcomes', colHead: 'כרטיסים', cols: ['1–9', '10–45', '46–72'], marked: [[0, 0], [0, 2]] },
    pair: { type: 'pair', items: [
      { type: 'chart', mode: 'line', xs: [1, 2, 3, 4], values: [0.5, 1.2, 2.4, 1.8], level: 2, dp: 1, step: 0.5, max: 3, cross: [2] },
      { type: 'table', head: ['קפיצה', 'מרחק (מטר)'], rows: [[1, '6.20'], [2, '6.45'], [3, '6.80'], [4, '6.50']], cross: [2] },
    ] },
  };

  it('every figure renders, with no broken number, agrees with itself and is a type Figure draws', () => {
    for (const [k, f] of Object.entries(FIGS)) {
      const h = html(f);
      expect(h, k).toMatch(/<svg|<table/);
      expect(h, k).not.toMatch(/NaN|undefined|Infinity|null/);
      expect(selfProblems('data:1', f), k).toEqual([]);
      expect(FIG_TYPES, k).toContain(f.type);
    }
    expect(FIG_TYPES).toEqual(expect.arrayContaining(['chart', 'outcomes', 'pair']));
  });

  it('figPlain says every number a chart draws, its axis, and never the value it hides', () => {
    expect(figPlain(FIGS.bar)).toBe('דיאגרמת עמודות: כדורגל 12, כדורסל 8, שחייה 6, טניס 4; הציר מ־0 עד 14 בקפיצות של 2');
    expect(figPlain(FIGS.pie)).toBe('דיאגרמת עוגה, בכיוון השעון מלמעלה: שיחה 50%, אין תשובה 20%, קו מקולקל 25%, תפוס 5%');
    expect(figPlain(FIGS.picto)).toBe('פיקטוגרמה, כל סמל 4 ילדים: מתח 3 סמלים וחצי, מדע בדיוני 2 סמלים, שירה חצי סמל');
    expect(figPlain(FIGS.truncated)).toContain('הציר מ־80 עד 90 בקפיצות של 2');
    for (const k of ['bar', 'barBlank', 'truncated', 'clubs', 'bill', 'pie', 'years', 'tickets', 'wind']) {
      const f = FIGS[k]; const said = figPlain(f);
      f.values.forEach((v: number, i: number) => { if (f.hide !== i) expect(said, `${k} ${v}`).toContain(chartNum(v, f.dp)); });
      (f.cats || []).forEach((c: string) => expect(said, k).toContain(c));
    }
    // a hidden value is a question mark, in the drawing and in the words
    expect(figPlain(FIGS.bill)).toContain('מרץ ?'); expect(figPlain(FIGS.bill)).not.toContain('420');
    expect(figPlain(FIGS.pieHidden)).toContain('ירוק ?'); expect(figPlain(FIGS.pieHidden)).not.toContain('0.45');
    expect(html(FIGS.pieHidden)).not.toContain('0.45');
    // what is drawn on a chart is said too: the crossed bar, the level line, the dashed continuation, the marked year
    expect(figPlain(FIGS.bill)).toContain('ינואר 520 (מחוק)');
    expect(figPlain(FIGS.bill)).toContain('קו מקווקו בגובה 350');
    expect(figPlain(FIGS.tickets)).toContain('16:00: 800 (המשך המגמה, בקו מקווקו)');
    expect(figPlain(FIGS.years)).toBe('גרף: 2010: 2.0, 2016: 3.2; הציר האנכי מ־0 עד 3.5 בקפיצות של 0.5; מסומן 2014');
  });

  it('a bar chart has a grid line at every step and at most 8 axis numbers; labels: false prints no value on its bars', () => {
    const bar = html(FIGS.bar);
    expect(count(bar, 'fig-ch-grid')).toBe(7); // 2, 4, …, 14 (0 is the base)
    expect(count(bar, 'fig-ch-tick')).toBe(8); // 0, 2, …, 14
    expect(count(bar, 'fig-ch-val')).toBe(4);
    expect(count(html(FIGS.barBlank), 'fig-ch-val')).toBe(0);
    // max 140, step 10, every 2: 15 grid lines' worth of steps, 8 numbers; with no every the axis still says 8 at most
    const clubs = html(FIGS.clubs);
    expect(count(clubs, 'fig-ch-grid')).toBe(14);
    expect(count(clubs, 'fig-ch-tick')).toBe(8);
    expect(chartAxis({ ...FIGS.clubs, every: undefined }).labelled).toHaveLength(8);
    expect(chartAxis({ ...FIGS.clubs, every: 1 }).labelled.length).toBeLessThanOrEqual(AXIS_LABELS);
    expect(chartAxis({ values: [7, 3] })).toMatchObject({ from: 0, step: 1, max: 7 });
    // the truncated axis starts at 80, and the first category is on the right
    const tr = html(FIGS.truncated);
    expect(tr).toMatch(/class="fig-ch-tick">80</);
    const xOf = (h: string, word: string) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*class="fig-ch-cat"[^>]*><tspan[^>]*>${word}<`).exec(h)?.[1]);
    expect(xOf(bar, 'כדורגל')).toBeGreaterThan(xOf(bar, 'טניס'));
    // a long name wraps to two lines in its slot
    expect((clubs.match(/<tspan/g) || []).length).toBe(4); // בלי חוג, חוג אחד, and יותר מחוג / אחד
  });

  it('a pie draws its slices clockwise from 12 o\'clock with a legend of chips under it, in that order, never in a slice', () => {
    const h = html(FIGS.pie);
    const chips = [...h.matchAll(/class="fig-ch-chip-text"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(chips).toEqual(['שיחה 50%', 'אין תשובה 20%', 'קו מקולקל 25%', 'תפוס 5%']);
    // the first slice is the right half: it starts at 12 o'clock (160, cy − R) and ends at 6 (160, cy + R)
    expect(h).toMatch(/d="M 160 70 L 160 6 A 64 64 0 0 1 160 134 Z"/);
    // tones beyond the first carry a pattern, so colour is never the only cue; no number is written inside the circle
    expect((h.match(/fill="url\(#/g) || []).length).toBe(2 * 3); // three patterned slices, three patterned chip swatches
    expect(count(h, 'fig-ch-val')).toBe(0);
  });

  it('a line chart runs left to right, continues dashed, marks an x, crosses a point and draws a level line', () => {
    const t = html(FIGS.tickets);
    expect(count(t, 'fig-ch-line dashed')).toBe(1);
    expect(count(t, 'fig-ch-line')).toBe(3);
    expect(count(t, 'fig-ch-pt est')).toBe(1);
    const xs = [...t.matchAll(/class="fig-ch-x[^"]*">([^<]+)</g)].map((m) => m[1]);
    expect(xs).toEqual(['8:00', '10:00', '12:00', '14:00', '16:00']);
    const y = html(FIGS.years);
    expect(y).toMatch(/class="fig-ch-mark"/);
    expect(y).toMatch(/class="fig-ch-x on">2014</);
    const w = html(FIGS.wind);
    expect(w).toMatch(/class="fig-ch-level"/);
    expect(w).toMatch(/class="fig-ch-level-num">2\.0</);
    expect(count(w, 'fig-ch-cross')).toBe(1);
  });

  it('a pictogram draws whole icons and a half icon as a half, with its key', () => {
    const h = html(FIGS.picto);
    expect(pictoIcons(14, 4)).toBe(3.5);
    expect((h.match(/clip-path="url\(#/g) || []).length).toBe(2); // the half icons of מתח (3.5) and שירה (0.5)
    expect(h).toContain('מקרא:');
    expect(h).toMatch(/class="fig-ch-key-text"[^>]*>4 ילדים</);
  });

  it('a table of outcomes: two stages as rows × cols, one stage as one row (runs), marked cells said', () => {
    const d = html(FIGS.dice);
    expect((d.match(/<td/g) || []).length).toBe(36 + 1); // and the empty corner over the row names
    expect(count(d, 'on')).toBe(2);
    expect((d.match(/\(מסומן\)/g) || []).length).toBe(2);
    expect(figPlain(FIGS.dice)).toContain('מסומנים 2 תאים: (5, 6) 11, (6, 5) 11');
    expect(figPlain(FIGS.dice)).toMatch(/^טבלת תוצאות של שתי קוביות: /);
    expect(html(FIGS.coinDie)).toContain('(עץ, 1)');
    const r = html(FIGS.raffle);
    expect((r.match(/<td/g) || []).length).toBe(3);
    expect(figPlain(FIGS.raffle)).toBe('טבלת תוצאות: כרטיסים: 1–9, 10–45, 46–72; מסומנים 2 תאים: 1–9, 46–72');
  });

  it('a pair stacks two titled sources, each compact, and says both; a pair holds no pair', () => {
    const h = html(FIGS.pair);
    expect([...h.matchAll(/class="fig-pair-title">([^<]+)</g)].map((m) => m[1])).toEqual(['מקור 1', 'מקור 2']);
    expect(h).toMatch(/fig-chart fig-chart-line compact/);
    expect(h).toMatch(/fg-table compact/);
    expect(figPlain(FIGS.pair)).toMatch(/^מקור 1: גרף: 1: 0\.5, 2: 1\.2, 3: 2\.4 \(מחוק\), 4: 1\.8; .*; מקור 2: טבלה: .*; מחוק: 3 → 6\.80$/);
    const nested = { type: 'pair', items: [FIGS.pair, FIGS.bar] };
    expect(selfProblems('stats:7', nested)).toContain('a pair inside a pair');
    expect(html(nested)).not.toContain('fig-pair-src"><p class="fig-pair-title">מקור 1</p><div class="fig-pair-body"><div');
  });

  it('the figure extensions: a table\'s shaded cell and struck row, fbar tones, a range arrow, words at 0 and 1', () => {
    const t = { type: 'table', head: ['שטר', 'כמה'], rows: [['20 ש״ח', 4], ['50 ש״ח', 2], ['100 ש״ח', 1]], highlight: [[0, 1]], cross: [2] };
    const th = html(t);
    expect(th).toMatch(/<td class="hi">/);
    expect(th).toMatch(/<tr class="cross"/);
    expect(figPlain(t)).toBe('טבלה: 20 ש״ח → 4; 50 ש״ח → 2; 100 ש״ח → 1; מסומן: 4; מחוק: 100 ש״ח → 1');
    const tones = { type: 'fbar', den: 20, tones: [{ n: 6, label: 'ירוק', tone: 2 }, { n: 9, label: 'כחול' }, { n: 5, label: 'אדום', tone: 3 }] };
    const fh = html(tones);
    expect((fh.match(/mp-fbar-part on fig-tone-/g) || []).length).toBe(20);
    expect((fh.match(/mp-fbar-cut group/g) || []).length).toBe(2);
    expect(figPlain(tones)).toBe('פס שברים: הפס מחולק ל־20 חלקים; ירוק 6 חלקים, כחול 9 חלקים, אדום 5 חלקים');
    const dots = { type: 'dots', values: [12, 5, 9, 17, 8], axis: [4, 18], span: { from: 5, to: 17, label: '12' } };
    expect(html(dots)).toMatch(/class="fig-dt-span-num">12</);
    expect(figPlain(dots)).toContain('חץ מ־5 עד 17 (12)');
    expect(selfProblems('stats:6', dots)).toEqual([]);
    const words = { type: 'numline', from: 0, to: 1, step: 0.5, marks: [{ x: 0, label: 'בלתי אפשרי' }, { x: 0.5, label: 'סיכוי שווה' }, { x: 1, label: 'ודאי' }] };
    const nh = html(words);
    expect(figPlain(words)).toBe('ציר מספרים מ־0 עד 1, נקודה ב־0: בלתי אפשרי, נקודה ב־0.5: סיכוי שווה, נקודה ב־1: ודאי');
    // under the line, held inside the drawing at both ends
    const placed = [...nh.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*class="fig-nl-word"[^>]*><tspan[^>]*>([^<]+)</g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: m[3] }));
    expect(placed.map((p) => p.w)).toEqual(['בלתי אפשרי', 'סיכוי שווה', 'ודאי']);
    const line = Number(/<line x1="10" y1="([\d.]+)"/.exec(nh)?.[1]);
    placed.forEach((p) => expect(p.y).toBeGreaterThan(line + 30));
    expect(placed[0].x).toBeGreaterThan(22); // running inward from 0 (at x = 22)
    expect(placed[1].x).toBe(160); // a word between the ends is centred on its point
    expect(placed[2].x).toBeLessThan(298); // and from 1 (at x = 298)
  });
});
