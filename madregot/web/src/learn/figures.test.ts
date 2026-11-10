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
import { contentOf, CONTENT } from './content/index';
import { PENDING_VISUALS } from './visualPlan';
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

// ---------------------------------------------------------------- STUDENT-8: the teaching figures of every topic
// The new types (numline, thermo, machine, dots, bars) and the plane's quadrants, walks, lines, meeting point and
// rise-and-run must agree with themselves everywhere they appear, and, in every topic that is fully drawn (not in
// visualPlan.ts PENDING_VISUALS), with their step's text:
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
      case 'thermo': return [fmt(f.value), f.label];
      case 'machine': return [io(f.inX, 'x'), io(f.outY, 'y'), f.rule];
      case 'dots': return [];
      case 'bars': return [...f.labels, ...f.values.map(fmt), f.unit];
      case 'coord': {
        const lines = [...(f.line ? [f.line] : []), ...(f.lines || [])];
        const meet = f.meet && f.lines?.length > 1 ? meetOf(f.lines[0], f.lines[1]) : null;
        const rr = f.riseRun && lines[0] ? [fmt(f.riseRun.run), fmt(lines[0].m * f.riseRun.run)] : [];
        return ['x', 'y', ...(f.points || []).filter((p: any) => !p.hidden).map((p: any) => p.label), ...(f.lines || []).map((l: any) => l.label),
          ...(meet ? [`(${fmt(meet[0])}, ${fmt(meet[1])})`] : []), ...rr];
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
  if (f.type === 'thermo' && !(f.min < f.max && within(f.value, f.min, f.max))) bad.push(`thermo ${f.value} on a scale ${f.min}..${f.max}`);
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
    if (f.values.some((v: number) => v < 0)) bad.push('bars with a value under 0');
    if (f.highlight != null && !(f.highlight >= 0 && f.highlight < f.values.length)) bad.push(`bars highlight ${f.highlight}`);
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

/** The checks against the text, for topics that are fully drawn. */
function textProblems(st: DiscoverStep, f: AnyFig): string[] {
  const bad: string[] = [];
  const labels = labelsOf(f);
  const groups = [...st.text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
  // a letter named alone, or a point named by its coordinates, is written in the figure; a letter as a shape ("צורת $Z$",
  // the shape of alternate angles) names no point
  const letters = new Set<string>();
  for (const m of st.text.matchAll(/(צורת\s*)?\$([^$]+)\$/g)) {
    const one = /^\s*([A-Za-z])\s*$/.exec(m[2]); if (one && !m[1]) letters.add(one[1]);
    for (const p of m[2].matchAll(/([A-Z])\s*\(\s*-?\d/g)) letters.add(p[1]);
  }
  for (const k of letters) if (!labels.has(k)) bad.push(`the text names ${k}, the figure does not`);
  // a point named with its coordinates is drawn there
  for (const g of groups) {
    for (const m of g.matchAll(/(?:([A-Z])\s*)?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
      if (f.type !== 'coord') continue;
      const [x, y] = [Number(m[2]), Number(m[3])];
      const lines = f.lines || [];
      const meet = f.meet && lines.length > 1 ? meetOf(lines[0], lines[1]) : null;
      const at = (p: Pt) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9;
      const ok = (f.points || []).some((p: any) => !p.hidden && (!m[1] || p.label === m[1]) && at([p.x, p.y]))
        || (!m[1] && ((meet && at(meet)) || (f.path || []).some((p: Pt) => at(p))));
      if (!ok) bad.push(`${m[0]} is not drawn there`);
    }
    for (const m of g.matchAll(/([A-Z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
      if (f.type !== 'numline') continue;
      if (!(f.marks || []).some((k: any) => k.label === m[1] && Math.abs(k.x - Number(m[2])) < 1e-9)) bad.push(`${m[0]} is not marked there`);
    }
  }
  // a prediction's answer is not written in its own figure (a table's cells are data, where a number may come up by
  // chance: its headings count)
  const written = f.type === 'table' ? new Set((f.head as unknown[]).map(plainOf)) : labels;
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

  it('in every fully drawn topic, a figure writes what its text names and never the answer it asks for', () => {
    const bad = ALL_STEPS().filter(({ skill }) => !PENDING_VISUALS.has(skill.split(':')[0]))
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
  });
});
