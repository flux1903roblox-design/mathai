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
import Figure, { geoSweep, geoSquare } from '@/components/Figure.jsx';
// @ts-ignore: plain JS
import { rectStory, angleEqStory, rectFig } from '@/content/eq.js';
// @ts-ignore: plain JS
import { straightThree, linearPairDiff, fanItem, threeLines, crossBisect, splitTriangleS1, splitTriangleS2, parallelTriangle, parallelBisect } from '@/content/angleItems.js';
// @ts-ignore: plain JS
import { figPlain } from '@/content/index.js';

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
      default: return [];
    }
  })();
  return new Set(out.filter((x) => x != null && x !== '' && x !== 0).map(plainOf));
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

  it('every figure renders, with no broken numbers', () => {
    for (const { where, st } of ALL_STEPS()) {
      const fig = figOf(st); if (!fig) continue;
      const html = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(html, where).toMatch(/<svg|<table/);
      expect(html, where).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

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
    const DRAWS = new Set(['numline', 'thermo', 'machine', 'dots', 'coord', 'bars', 'table']);
    const bad = Object.values(CONTENT).flatMap((c) => {
      const st = c.discover[0]; const f = figOf(st) as AnyFig | undefined;
      return st.kind === 'say' && f && DRAWS.has(f.type) && !f.anim ? [`${c.skill} #0: ${f.type} without anim`] : [];
    });
    expect(bad).toEqual([]);
  });
});

// CLASSROOM-8: the class's rectangle and angles with x. A side may carry an expression ('x + 5') or a found length
// ('16 ס״מ'); equal sides carry the same number of ticks, and they are opposite sides: as long as each other and sharing
// no corner. The angles with x are drawn to their size, each with its expression on its arc.
describe('the class\'s word-problem drawings', () => {
  const ticked = (f: Geo) => {
    const groups: Record<number, any[]> = {};
    (f.segs || []).forEach((sg: any) => { if (sg.ticks) (groups[sg.ticks] ||= []).push(sg); });
    return groups;
  };
  it('a rectangle\'s ticks sit on opposite, equal sides, and its expression labels are drawn', () => {
    for (let i = 0; i < 200; i += 1) {
      const it = rectStory(); const f = it.fig as Geo;
      const groups = ticked(f);
      expect(Object.keys(groups).sort(), it.key).toEqual(['1', '2']);
      Object.values(groups).forEach(([a, b]) => {
        expect([a.a, a.b].some((k) => k === b.a || k === b.b), `${it.key}: ticked sides share a corner`).toBe(false);
        expect(dist(f.pts[a.a], f.pts[a.b])).toBeCloseTo(dist(f.pts[b.a], f.pts[b.b]), 9);
      });
      const html = renderToStaticMarkup(createElement(Figure, { fig: f }));
      expect(html).not.toMatch(/NaN|undefined|Infinity/);
      const labels = (f.segs || []).map((sg: any) => sg.label).filter(Boolean);
      expect(labels).toContain('x');
      expect(labels.some((l: string) => /^x \+ \d$|^2x$/.test(l)), it.key).toBe(true);
    }
    // the found lengths written back, in proportion and right to left
    const done = rectFig('16 ס״מ', '11 ס״מ', { long: 16 / 11 }) as Geo;
    expect(dist(done.pts._A, done.pts._B) / dist(done.pts._B, done.pts._C)).toBeCloseTo(16 / 11, 9);
    expect(renderToStaticMarkup(createElement(Figure, { fig: done }))).toContain('direction="rtl"');
  });
  it('angles with x are drawn to their size, each with its expression on its arc', () => {
    for (let i = 0; i < 300; i += 1) {
      const it = angleEqStory(i % 2 ? 3 : 4); const f = it.fig as Geo;
      const [, n, cs, es] = String(it.key).split(':'); const c = cs.split(',').map(Number); const e = es.split(',').map(Number);
      const total = Number(n) === 3 ? 180 : 360; const x = (total - e.reduce((a, b) => a + b, 0)) / c.reduce((a, b) => a + b, 0);
      (f.angles || []).forEach((g: any, k: number) => {
        expect(geoSweep(f.pts, g).deg, `${it.key} at ${g.at}`).toBeCloseTo(c[k] * x + e[k], 6);
        expect(g.text, it.key).toMatch(/^\d*x( [+−] \d+°)?$/);
      });
      expect(renderToStaticMarkup(createElement(Figure, { fig: f }))).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});

// CURRICULUM-10: the two-step angle questions draw their numbers in the figure only. 200 of each kind: the drawing has no
// letter (no text names a point), every given angle is drawn its size and is a number of the key, the '?' is drawn the
// size of the answer, a bisector's two halves are equal, and no arc marks a reflex angle.
describe('the two-step angle questions are drawn to size', () => {
  const kinds = [
    ['three angles on a line', straightThree, (k: string[]) => [Number(k[1]), Number(k[2])]],
    ['two adjacent angles and their difference', linearPairDiff, () => []],
    ['three lines through one point', threeLines, (k: string[]) => [Number(k[1]), Number(k[2])]],
    ['a bisector after a crossing', crossBisect, (k: string[]) => [Number(k[1])]],
    ['a triangle between parallel lines', parallelTriangle, (k: string[]) => [Number(k[1]), Number(k[2])]],
    ['a bisector after parallel lines', parallelBisect, (k: string[]) => [Number(k[1])]],
  ] as const;
  it.each(kinds)('%s', (_name, make, givens) => {
    for (let i = 0; i < 200; i += 1) {
      const it = make(); const f = it.fig as Geo;
      expect(f.type, it.key).toBe('geo');
      expect(Object.keys(f.pts).filter((k) => !k.startsWith('_')), `${it.key}: a letter no text names`).toEqual([]);
      const shown: number[] = []; const asked: number[] = []; const halves: number[] = [];
      for (const g of f.angles || []) {
        const { deg } = geoSweep(f.pts, g);
        expect(deg, `${it.key}: the arc at ${g.at} spans ${deg.toFixed(1)}°`).toBeLessThanOrEqual(180.0001);
        const m = /^(\d+)°$/.exec(g.text || '');
        if (m) { expect(Math.abs(deg - Number(m[1])), `${it.key}: ${g.text} drawn ${deg.toFixed(1)}°`).toBeLessThan(0.6); shown.push(Number(m[1])); }
        if (g.target) { expect(g.text, it.key).toBe('?'); asked.push(deg); }
        if (g.n === 2) halves.push(deg);
      }
      expect(asked, it.key).toHaveLength(1);
      expect(Math.abs(asked[0] - it.answer), `${it.key}: the '?' is drawn ${asked[0].toFixed(1)}°, the answer is ${it.answer}°`).toBeLessThan(0.6);
      expect(shown.sort((a, b) => a - b), it.key).toEqual([...givens(String(it.key).split(':'))].sort((a, b) => a - b));
      if (halves.length) { expect(halves, it.key).toHaveLength(2); expect(Math.abs(halves[0] - halves[1]), it.key).toBeLessThan(0.01); }
      expect(renderToStaticMarkup(createElement(Figure, { fig: f })), it.key).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it('reads a drawing in words, so the tutor, an answer key and the guessing test see its numbers', () => {
    // figPlain's geo case (GEOM-1.5, which landed first in this branch): each angle with its vertex, CURRICULUM-10's
    // "שרטוט: 40°, ?" with the vertex named
    expect(figPlain({ type: 'geo', angles: [{ at: 'O', from: 'A', to: 'B', text: '40°' }, { at: 'O', from: 'B', to: 'C', text: '?', target: true }] })).toBe('שרטוט: ∢O 40°, ∢O ?');
    const it = parallelTriangle();
    const [, a, b] = String(it.key).split(':');
    expect(figPlain(it.fig)).toContain(`${a}°`);
    expect(figPlain(it.fig)).toContain(`${b}°`);
  });
});

// CLASSROOM-11's rule, over every angle drawing of the angles stairs (teaching steps, repairs, worked examples and their
// steps): an angle the text treats as known (∢X = 50°, ∢ABC = 90°, "the angle at C is right") is drawn, a right angle
// as a square, at the point the text names; and every number on an arc sits inside its own angle: at the distance the
// drawing puts it, it is still between the angle's two arms (it never floats past their ends, where it would read as
// another angle's).
/** The drawing's scale in pixels per unit, as components/Figure.jsx fits it (Geo). */
function geoScale(f: Geo): number { return geoFit(f).s; }
/** The drawing's scale and its map from units to pixels (y down), as components/Figure.jsx fits it (Geo). */
function geoFit(f: Geo): { s: number; X: (p: Pt) => Pt } {
  const [W, H] = (f.view as [number, number]) || [300, 200];
  const [padX, padY] = Array.isArray(f.pad) ? (f.pad as [number, number]) : [(f.pad as number) ?? 30, (f.pad as number) ?? 30];
  const P = f.pts;
  const ends = (f.segs || []).flatMap((sg: any) => {
    const a = P[sg.a]; const b = P[sg.b]; const len = dist(a, b) || 1; const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]; const [e0, e1] = sg.ext || [0, 0];
    return [[a[0] - u[0] * e0, a[1] - u[1] * e0], [b[0] + u[0] * e1, b[1] + u[1] * e1]] as Pt[];
  });
  const sq = (f.squares || []).flatMap((q: any) => geoSquare(P[q.a], P[q.b], q.away ? P[q.away] : null) as Pt[]);
  const all = [...Object.values(P), ...ends, ...sq, ...((f.words || []).filter((w: any) => Array.isArray(w.at)).map((w: any) => w.at) as Pt[]), ...(((f as any).moves || []).flatMap((m: any) => [m.from, m.to]) as Pt[])];
  const xs = all.map((p) => p[0]); const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((W - 2 * padX) / Math.max(x1 - x0, 1e-9), (H - 2 * padY) / Math.max(y1 - y0, 1e-9));
  const ox = (W - (x1 - x0) * s) / 2 - x0 * s; const oy = (H + (y1 - y0) * s) / 2 + y0 * s;
  return { s, X: (p: Pt) => [ox + p[0] * s, oy - p[1] * s] };
}
/** Where Figure.jsx puts an angle's number: its distance from the vertex in pixels. */
const labelDistance = (g: any, deg: number) => (g.r ?? 24) + (deg < 40 ? 30 : deg < 60 ? 22 : 16) + Math.max(0, String(g.text || '').length - 4) * 3;
/** The angles a step's text gives as known: ∢X = n° or ∢XYZ = n° (vertex Y), and a right angle named in words. */
function knownAngles(text: string): { at: string; deg: number }[] {
  const out: { at: string; deg: number }[] = [];
  for (const m of text.matchAll(/(?<!\+\s{0,3})\\sphericalangle\s*([A-Z]{1,3})\s*=\s*(\d+)\^\\circ/g)) out.push({ at: m[1].length === 3 ? m[1][1] : m[1][0], deg: Number(m[2]) });
  for (const m of text.matchAll(/הזווית(?: ב־)?\s*\$([A-Z])\$\s*ישרה/g)) out.push({ at: m[1], deg: 90 });
  return out;
}
describe('every angle drawing shows what its text gives, and every number sits inside its own angle', () => {
  const angleFigs = () => Object.values(CONTENT).filter((c) => c.topic === 'angles').flatMap((c) => [
    ...c.discover.map((st, i) => ({ where: `${c.skill} #${i}`, text: `${st.text} ${'display' in st ? st.display || '' : ''}`, f: figOf(st) })),
    ...c.misconceptions.flatMap((m) => m.remedy.map((st, i) => ({ where: `${c.skill} ${m.id} remedy #${i}`, text: st.text, f: figOf(st) }))),
    ...c.examples.flatMap((ex, k) => [{ where: `${c.skill} example ${k + 1}`, text: ex.problem, f: ex.fig }, ...ex.steps.map((sp, i) => ({ where: `${c.skill} example ${k + 1} step ${i + 1}`, text: sp.action, f: sp.fig }))]),
  ]).filter((x) => (x.f as any)?.type === 'geo') as { where: string; text: string; f: Geo }[];
  it('there are angle drawings to check', () => { expect(angleFigs().length).toBeGreaterThan(40); });
  it('an angle the text gives is drawn at its vertex, a right angle as a square', () => {
    const bad: string[] = [];
    for (const { where, text, f } of angleFigs()) {
      for (const k of knownAngles(text)) {
        if (!(k.at in f.pts)) continue; // the text's point is not one this drawing names (a sketch of part of the shape)
        const at = (f.angles || []).filter((g: any) => g.at === k.at);
        const ok = k.deg === 90 ? at.some((g: any) => g.right || g.text === '90°') : at.some((g: any) => g.text === `${k.deg}°` || g.target);
        if (!ok) bad.push(`${where}: ${k.deg}° at ${k.at} is not drawn`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('every number on an arc sits inside its own angle, between its two arms', () => {
    const bad: string[] = [];
    for (const { where, f } of angleFigs()) {
      const s = geoScale(f);
      for (const g of f.angles || []) {
        if (g.right || !/\d/.test(String(g.text || ''))) continue;
        const { deg } = geoSweep(f.pts, g);
        const reach = labelDistance(g, deg);
        // the arms are drawn at least to the points they are named by
        const arm = Math.min(dist(f.pts[g.at], f.pts[g.from]), dist(f.pts[g.at], f.pts[g.to])) * s;
        if (reach > arm + 4) bad.push(`${where}: ${g.text} at ${g.at} sits ${reach.toFixed(0)}px out, past arms ${arm.toFixed(0)}px long`);
      }
    }
    expect(bad).toEqual([]);
  });
});

// CLASSROOM-9 and -11: the fan's drawn angles are T and a; the split triangle has its square at C, D on BC, and every
// given (∢ADC, ∢BAD or ∢BAC) drawn its size in its own arc, β drawn the size of the answer.
describe('the fan and the split triangle are drawn to size', () => {
  it('the fan: ∢AOC is T, ∢AOB is a, and the asked ∢BOC is T − a, with the letters the text names', () => {
    for (let i = 0; i < 200; i += 1) {
      const it = fanItem(); const f = it.fig as Geo; const [, T, a] = String(it.key).split(':').map(Number);
      const by = (from: string, to: string) => (f.angles || []).find((g: any) => g.from === from && g.to === to);
      expect(geoSweep(f.pts, by('A', 'C')).deg, it.key).toBeCloseTo(T, 1);
      expect(geoSweep(f.pts, by('A', 'B')).deg, it.key).toBeCloseTo(a, 1);
      expect(geoSweep(f.pts, by('B', 'C')).deg, it.key).toBeCloseTo(it.answer, 1);
      expect([by('A', 'C').text, by('A', 'B').text, by('B', 'C').text]).toEqual([`${T}°`, `${a}°`, '?']);
      expect(Object.keys(f.pts).sort()).toEqual(['A', 'B', 'C', 'O']);
    }
  });
  it.each([['S1', splitTriangleS1], ['S2', splitTriangleS2]] as const)('the split triangle, %s', (_n, make) => {
    for (let i = 0; i < 200; i += 1) {
      const it = make(); const f = it.fig as Geo;
      expect(Object.keys(f.pts).sort(), it.key).toEqual(['A', 'B', 'C', 'D']);
      // the right angle at C is drawn as a square, and is right
      const right = (f.angles || []).find((g: any) => g.right);
      expect(right?.at, it.key).toBe('C');
      expect(geoSweep(f.pts, right).deg % 180, it.key).toBeCloseTo(90, 6);
      // D is on BC, between B and C
      expect(f.pts.D[1]).toBe(0); expect(f.pts.B[0] < f.pts.D[0] && f.pts.D[0] < f.pts.C[0], it.key).toBe(true);
      for (const g of f.angles || []) {
        if (g.right) continue;
        const { deg } = geoSweep(f.pts, g);
        const m = /^(\d+)°$/.exec(g.text || '');
        if (m) expect(Math.abs(deg - Number(m[1])), `${it.key}: ${g.text} at ${g.at}`).toBeLessThan(0.6);
        if (g.target) expect(Math.abs(deg - it.answer), `${it.key}: ${g.text} drawn ${deg.toFixed(1)}°`).toBeLessThan(0.6);
      }
      // the givens of the text are the ones drawn
      const said = [...String(it.text).matchAll(/\\sphericalangle (\w+) = (\d+)\^\\circ/g)].filter((m) => m[1] !== 'C').map((m) => `${m[2]}°`).sort();
      expect((f.angles || []).filter((g: any) => /°$/.test(g.text || '')).map((g: any) => g.text).sort(), it.key).toEqual(said);
      expect(renderToStaticMarkup(createElement(Figure, { fig: f }))).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});

// CLASSROOM-9 and -11: on the fan, the split triangle and the two names rule, every number on an arc can be read: its
// text box, measured in the app's font (Rubik 17px, 19px for the asked angle: a digit 0.665em wide, ° 0.41em, a letter
// 0.7em; 0.74em above the baseline, β 0.22em below it), is laid out as components/Figure.jsx lays it, and no line, no
// other angle's arc and no other number passes through it. A whole angle split by a ray (∢AOC, ∢BAC) has its number in
// the wider part, past its own wide arc, never on the ray. The points' letters stay inside the drawing, off the numbers.
type Box = [number, number, number, number];
function angleBoxes(f: Geo) {
  const { X } = geoFit(f); const P = f.pts;
  const lines: [Pt, Pt][] = [
    ...(f.segs || []).map((sg: any) => { const a = P[sg.a]; const b = P[sg.b]; const len = dist(a, b) || 1; const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]; const [e0, e1] = sg.ext || [0, 0]; return [X([a[0] - u[0] * e0, a[1] - u[1] * e0]), X([b[0] + u[0] * e1, b[1] + u[1] * e1])] as [Pt, Pt]; }),
    ...(f.polys || []).flatMap((q: any) => q.pts.map((k: string, i: number) => [X(P[k]), X(P[q.pts[(i + 1) % q.pts.length]])] as [Pt, Pt])),
  ];
  const arcs: { i: number; pts: Pt[] }[] = []; const boxes: { i: number; text: string; box: Box }[] = [];
  (f.angles || []).forEach((g: any, i: number) => {
    const v = X(P[g.at]);
    if (g.right) {
      // the small square of a right angle, 13px along each arm (Figure.jsx)
      const u = (q: Pt): Pt => { const w = X(q); const n = dist(v, w) || 1; return [(w[0] - v[0]) / n, (w[1] - v[1]) / n]; };
      const [u1, u2] = [u(P[g.from]), u(P[g.to])]; const c: Pt = [v[0] + (u1[0] + u2[0]) * 13, v[1] + (u1[1] + u2[1]) * 13];
      lines.push([[v[0] + u1[0] * 13, v[1] + u1[1] * 13], c], [c, [v[0] + u2[0] * 13, v[1] + u2[1] * 13]]);
      return;
    }
    const { a0, a1, deg } = geoSweep(P, g); const rr = g.r ?? 24;
    const rad = (x: number) => (x * Math.PI) / 180;
    for (let k = 0; k < Math.max(1, g.n || 1); k += 1) {
      const r = rr - 5 * k;
      arcs.push({ i, pts: Array.from({ length: 61 }, (_, j) => { const t = rad(a0 + ((a1 - a0) * j) / 60); return [v[0] + r * Math.cos(t), v[1] - r * Math.sin(t)] as Pt; }) });
    }
    const text = String(g.text || ''); if (!text) return;
    const em = g.target ? 19 : 17;
    const w = [...text].reduce((t, ch) => t + (/\d/.test(ch) ? 0.665 : ch === '°' ? 0.41 : 0.7) * em, 0);
    const lr = labelDistance(g, deg); const mid = rad(a0 + (a1 - a0) * (g.lt ?? 0.5));
    const cx = v[0] + lr * Math.cos(mid); const base = v[1] - lr * Math.sin(mid) + 5;
    boxes.push({ i, text, box: [cx - w / 2, base - 0.74 * em, cx + w / 2, base + (/β/.test(text) ? 0.22 * em : 1)] });
  });
  // the points' letters, 16px out from each point, away from the middle of the shape (Figure.jsx), about 14 by 14
  const core = f.polys?.length ? f.polys.flatMap((q: any) => q.pts.map((k: string) => P[k])) : Object.values(P);
  const centre = X([core.reduce((a: number, p: Pt) => a + p[0], 0) / core.length, core.reduce((a: number, p: Pt) => a + p[1], 0) / core.length]);
  const letters = Object.keys(P).filter((k) => !k.startsWith('_') && !(f.hide || []).includes(k)).map((k) => {
    const p = X(P[k]); const n = dist(p, centre); const [dx, dy] = (f as any).lab?.[k] || (n < 1 ? [0, -16] : [((p[0] - centre[0]) / n) * 16, ((p[1] - centre[1]) / n) * 16]);
    const base = p[1] + dy + 6;
    return { text: k, box: [p[0] + dx - 7, base - 13, p[0] + dx + 7, base + 1] as Box };
  });
  return { lines, arcs, boxes, letters };
}
const inBox = (p: Pt, [x0, y0, x1, y1]: Box, m = 1.5) => p[0] > x0 - m && p[0] < x1 + m && p[1] > y0 - m && p[1] < y1 + m;
const along = ([a, b]: [Pt, Pt]) => { const n = Math.max(2, Math.ceil(dist(a, b))); return Array.from({ length: n + 1 }, (_, j) => [a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n] as Pt); };
function clashes(f: Geo): string[] {
  const { lines, arcs, boxes, letters } = angleBoxes(f); const out: string[] = [];
  const [W, H] = (f.view as [number, number]) || [300, 200];
  const overlap = (a: Box, b: Box) => !(a[0] > b[2] + 1 || a[2] < b[0] - 1 || a[1] > b[3] + 1 || a[3] < b[1] - 1);
  for (const l of letters) if (l.box[0] < 0 || l.box[1] < 0 || l.box[2] > W || l.box[3] > H) out.push(`the letter ${l.text} cut by the drawing's edge`);
  for (const b of boxes) {
    if (b.box[0] < 0 || b.box[1] < 0 || b.box[2] > W || b.box[3] > H) out.push(`${b.text} cut by the drawing's edge`);
    for (const ln of lines) if (along(ln).some((p) => inBox(p, b.box))) out.push(`${b.text} on a line (${ln.map((p) => p.map(Math.round).join(',')).join(' ')})`);
    // its own arc is the label distance's business (the rule above); another angle's arc must not cross it
    for (const a of arcs) if (a.i !== b.i && a.pts.some((p) => inBox(p, b.box))) out.push(`${b.text} on the arc of ${(f.angles as any[])[a.i].text || (f.angles as any[])[a.i].at}`);
    for (const c of boxes) if (c.i > b.i && overlap(b.box, c.box)) out.push(`${b.text} on ${c.text}`);
    for (const l of letters) if (overlap(b.box, l.box)) out.push(`${b.text} on the letter ${l.text}`);
  }
  return out;
}
describe('the fan, the split triangle and the two names rule: every number clear of every line, arc and number', () => {
  it.each([['the fan', fanItem], ['the split triangle, S1', splitTriangleS1], ['the split triangle, S2', splitTriangleS2]] as const)('%s, 3,000 items', (_n, make) => {
    const bad = new Set<string>();
    for (let i = 0; i < 3000; i += 1) { const it = make(); for (const c of clashes(it.fig as Geo)) bad.add(`${it.key}: ${c}`); }
    expect([...bad].slice(0, 12)).toEqual([]);
  }, 60000);
  it('the teaching drawings of angles:1 and angles:3 made with them', () => {
    const named = /שלוש קרניים|ישר וקרניים|ישר־זווית ABC|שרטוט עזר/;
    const figs = ['angles:1', 'angles:3'].flatMap((k) => { const c = CONTENT[k]; return [...c.discover.map(figOf), ...c.misconceptions.flatMap((m) => m.remedy.map(figOf)), ...c.examples.flatMap((ex) => [ex.fig, ...ex.steps.map((sp) => sp.fig)])]; })
      .filter((f) => (f as any)?.type === 'geo' && named.test(String((f as any).label))) as Geo[];
    expect(figs.length).toBeGreaterThanOrEqual(8);
    expect(figs.flatMap((f) => clashes(f).map((c) => `${f.label}: ${c}`))).toEqual([]);
  });
});
