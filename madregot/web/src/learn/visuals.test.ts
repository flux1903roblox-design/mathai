// A picture or an object on every teaching step (STUDENT-8). The council found the teaching screens "mostly text with no
// pictures"; every discover step of every topic now shows a drawing (fig) or an object to move (manip). A handful of
// steps may be exempt, each with a reason (learn/visualPlan.ts VISUAL_EXEMPT, at most 5% of a topic). A topic added
// later is held to the same rule from its first commit. The table of every topic is printed on each run.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
// @ts-ignore: react-dom has no type declarations here
import { renderToStaticMarkup } from 'react-dom/server';
import { loadAllContent } from './content/index';
import { VISUAL_EXEMPT } from './visualPlan';
import { STAIRS } from './skills';
import type { DiscoverStep } from './types';
// @ts-ignore: plain JS
import Figure from '@/components/Figure.jsx';
// @ts-ignore: plain JS
import GraphDraw from '@/components/manip/GraphDraw.jsx';
// @ts-ignore: plain JS
import AngleTurner from '@/components/manip/AngleTurner.jsx';
// @ts-ignore: plain JS
import { numWidth, nameWidth, numbered, graphFont, graphFrame, numbersApart, GRAPH_MAX_GROW, GRAPH_MIN_PX } from '@/components/manip/graphAxes.jsx';
import { makeItem } from '@/content/index.js';
import { seeded } from './expr';

// the teaching content loads one topic at a time (DURABLE-11): every topic, loaded
const CONTENT = await loadAllContent();

const hasVisual = (st: DiscoverStep) => !!((st as { fig?: unknown }).fig || (st as { manip?: unknown }).manip);

/** Every discover step by topic: its id (`signed:1#0`) and whether it shows something. */
function byTopic() {
  const out: Record<string, { id: string; shown: boolean }[]> = {};
  for (const [skill, c] of Object.entries(CONTENT)) {
    const topic = skill.split(':')[0];
    c.discover.forEach((st, i) => (out[topic] ||= []).push({ id: `${skill}#${i}`, shown: hasVisual(st) }));
  }
  return out;
}

const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`;

describe('a picture or an object on every teaching step (STUDENT-8)', () => {
  const topics = byTopic();

  it('prints the table of every topic', () => {
    const rows = Object.entries(topics).map(([t, steps]) => {
      const shown = steps.filter((s) => s.shown).length;
      const exempt = steps.filter((s) => !s.shown && VISUAL_EXEMPT[s.id]).length;
      const bare = steps.length - shown - exempt;
      return `${t.padEnd(8)} ${String(steps.length).padStart(5)} ${String(shown).padStart(7)} ${String(exempt).padStart(7)} ${String(bare).padStart(5)} ${pct(shown + exempt, steps.length).padStart(5)}`;
    });
    // eslint-disable-next-line no-console
    console.info(['topic    steps  visual  exempt  bare  done', ...rows].join('\n'));
    expect(rows.length).toBe(Object.keys(topics).length);
  });

  it('every discover step of every topic has a drawing or an object to move', () => {
    const bare = Object.values(topics).flatMap((steps) => steps.filter((s) => !s.shown && !VISUAL_EXEMPT[s.id]).map((s) => s.id));
    expect(bare).toEqual([]);
  });

  it('an exemption names a real step with nothing to see, says why, and stays within 5% of its topic', () => {
    for (const [id, why] of Object.entries(VISUAL_EXEMPT)) {
      const topic = id.split(':')[0];
      const step = (topics[topic] || []).find((s) => s.id === id);
      expect(step, `${id}: no such step`).toBeTruthy();
      expect(step!.shown, `${id} has a visual: take it off the list`).toBe(false);
      expect(why.trim().length, `${id}: the reason`).toBeGreaterThan(10);
    }
    for (const [t, steps] of Object.entries(topics)) {
      const n = steps.filter((s) => VISUAL_EXEMPT[s.id]).length;
      expect(n, `${t}: ${n} of ${steps.length} steps exempt`).toBeLessThanOrEqual(Math.floor(steps.length * 0.05));
    }
  });

  it('the rule covers every topic of the catalogue, every stair of it', () => {
    // a topic or a stair added to the catalogue (learn/skills.ts) is in CONTENT, so the rule above holds it from its
    // first commit: there is no list of topics still being drawn
    expect(Object.keys(topics).sort()).toEqual(Object.keys(STAIRS).sort());
    for (const [t, n] of Object.entries(STAIRS)) {
      const stairs = new Set(topics[t].map((s) => s.id.split('#')[0]));
      expect(stairs.size, `${t}: stairs with teaching steps`).toBe(n);
    }
  });
});

// ---------------------------------------------------------------- stage 5: the new drawings fit a 320px phone
// A 320px phone draws a figure or an object 288px wide. Every drawing stage 5 adds (the situation graph, the graph you
// draw) must then keep each of its texts at 12px or more and inside its box: nothing is cut at the edge (the protractor's
// numbers at their own 11px and 10px, Critique note 8; a clock is shown at most 220px wide). Each text's box
// is estimated from its size and its characters (graphAxes.jsx numWidth, nameWidth), its anchor and its direction; circles,
// lines and rectangles must be inside the box too. Every such drawing in the content is checked, and the fixtures below.
// That is the full width; in a lesson the height the screen leaves decides, and the block after this one checks it.
const DRAWN = 288; const MIN_PX = 12;
/** How wide each kind of drawing is shown on a 320px phone, and the smallest text it may have. */
const SHOWN: Record<string, { drawn: number; min: number }> = { protractor: { drawn: 288, min: 10 }, clock: { drawn: 220, min: 12 } };
const HEB = /[\u0590-\u05ff]/;
const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
/**
 * What does not fit: a text under 12px at 288px wide (or in a box `drawn` wide and `high` tall, as an SVG fits its
 * viewBox into it), or anything drawn outside the box.
 */
export function fitProblems(html: string, { drawn = DRAWN, high = Infinity, min = MIN_PX } = {}): string[] {
  const head = /<svg [^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*class="(?:figure|manip-canvas)[^"]*"[^>]*>/.exec(html);
  if (!head) return ['no drawing'];
  const [W, H] = [Number(head[1]), Number(head[2])]; const k = Math.min(drawn / W, high / H);
  const body = html.slice(head.index + head[0].length, html.indexOf('</svg>', head.index));
  const bad: string[] = [];
  const inside = (what: string, x0: number, y0: number, x1: number, y1: number) => {
    if (x0 < -0.5 || y0 < -0.5 || x1 > W + 0.5 || y1 > H + 0.5) bad.push(`${what} outside the ${W}×${H} box (${x0.toFixed(1)}, ${y0.toFixed(1)}, ${x1.toFixed(1)}, ${y1.toFixed(1)})`);
  };
  for (const m of body.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const a = attrs(m[1]); const t = m[2]; const size = Number(a['font-size']);
    if (!size) { bad.push(`"${t}" has no size of its own`); continue; }
    if (size * k < min - 1e-9) bad.push(`"${t}" is ${(size * k).toFixed(1)}px at ${drawn}px wide${high < Infinity ? ` and ${high}px high` : ''}`);
    const w = HEB.test(t) ? nameWidth(t, size) : numWidth(t, size); const x = Number(a.x); const y = Number(a.y);
    const rtl = a.direction === 'rtl'; const anchor = a['text-anchor'] || 'start';
    const [x0, x1] = anchor === 'middle' ? [x - w / 2, x + w / 2] : (anchor === 'start') !== rtl ? [x, x + w] : [x - w, x];
    inside(`"${t}"`, x0, y - 0.75 * size, x1, y + 0.25 * size);
  }
  for (const m of body.matchAll(/<circle ([^>]*)>/g)) { const a = attrs(m[1]); const r = Number(a.r); inside(`a circle`, Number(a.cx) - r, Number(a.cy) - r, Number(a.cx) + r, Number(a.cy) + r); }
  for (const m of body.matchAll(/<line ([^>]*)>/g)) { const a = attrs(m[1]); inside('a line', Math.min(+a.x1, +a.x2), Math.min(+a.y1, +a.y2), Math.max(+a.x1, +a.x2), Math.max(+a.y1, +a.y2)); }
  for (const m of body.matchAll(/<rect ([^>]*)>/g)) { const a = attrs(m[1]); inside('a rectangle', +a.x, +a.y, +a.x + +a.width, +a.y + +a.height); }
  return bad;
}

const GRAPH_FIGS = [
  { type: 'sgraph', x: { max: 45, step: 5, label: 'זמן', unit: 'דקות', every: 2 }, y: { max: 700, step: 100, label: 'מרחק מהבית', unit: 'מטרים' }, series: [{ pts: [[0, 0], [10, 600], [25, 600], [45, 0]] }], bands: [{ from: 10, to: 25 }], guide: { x: 5, y: 300 } },
  { type: 'sgraph', x: { min: 6, max: 18, step: 2, label: 'שעה' }, y: { min: 10, max: 26, step: 1, every: 2, label: 'טמפרטורה', unit: 'מעלות' }, series: [{ pts: [[6, 12], [8, 15], [10, 18], [12, 22], [14, 24], [16, 21], [18, 18]], dots: true }], marks: [{ x: 18, y: 26, label: 'A' }] },
  { type: 'sgraph', x: { max: 4, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 240, step: 60, label: 'מרחק מתל אביב', unit: 'ק״מ' }, series: [{ pts: [[0, 0], [4, 240]], label: 'רכב א' }, { pts: [[0, 240], [4, 0]], label: 'רכב ב', dashed: true }], meet: true, riseRun: { from: 1, to: 3 }, dirArrow: true },
  { type: 'sgraph', x: { max: 65, step: 5, label: 'זמן', unit: 'דקות' }, y: { max: 1400, step: 200, label: 'מרחק מהבית', unit: 'מטרים' }, series: [{ pts: [[0, 0], [15, 1200], [35, 1200], [65, 0]] }] },
];
const GRAPH_OBJECTS = [
  { m: { kind: 'graph', x: { max: 15, step: 5, label: 'זמן', unit: 'דקות' }, y: { max: 600, step: 100, label: 'מרחק מהבית', unit: 'מטרים' }, start: [0, 600, 600, 600], fixed: [0] }, answer: { mode: 'values', values: [0, 400, 400, 0] } },
  { m: { kind: 'graph', x: { max: 6, step: 1, label: 'x' }, y: { max: 1600, step: 200, label: 'y' }, start: [1600, 0, 1600, 0, 1600, 0, 1600] }, answer: { mode: 'shape', shape: ['down', 'up', 'down', 'up', 'down', 'up'] } },
  { m: { kind: 'graph', x: { max: 5, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 300, step: 60, label: 'מרחק', unit: 'ק״מ' }, start: [0, 0, 0, 0, 0, 0], fixed: [0], ref: { pts: [[0, 300], [5, 0]], label: 'רכב ב' } }, answer: { mode: 'uniform', start: 0, rate: 60 } },
];
const drawObject = (o: { m: unknown; answer: unknown }, extra = {}) => renderToStaticMarkup(createElement(GraphDraw, { m: o.m, value: (o.m as { start: number[] }).start, onChange: () => {}, answer: o.answer, locked: false, reveal: false, good: false, hint: false, ...extra }));

describe('the drawings of stage 5 fit a 320px phone: texts of 12px or more, nothing cut at the edge', () => {
  it('every situation graph in the content and the fixtures', () => {
    const inContent = Object.values(CONTENT).flatMap((c) => [...c.discover, ...c.misconceptions.flatMap((mc) => mc.remedy)])
      .map((st) => (st as { fig?: { type: string } }).fig).filter((f) => f?.type === 'sgraph');
    for (const f of [...inContent, ...GRAPH_FIGS]) expect(fitProblems(renderToStaticMarkup(createElement(Figure, { fig: f }))), JSON.stringify(f).slice(0, 80)).toEqual([]);
  });
  it('every graph to draw in the content and the fixtures, at its start, its answer shown and in a check', () => {
    const inContent = Object.values(CONTENT).flatMap((c) => [...c.discover, ...c.misconceptions.flatMap((mc) => mc.remedy)])
      .filter((st) => st.kind === 'explore' && st.manip.kind === 'graph').map((st) => ({ m: (st as { manip: unknown }).manip, answer: (st as { answer: unknown }).answer }));
    for (const o of [...inContent, ...GRAPH_OBJECTS]) {
      for (const extra of [{}, { reveal: true, locked: true }, { test: true }, { hint: true }]) expect(fitProblems(drawObject(o, extra)), JSON.stringify(o.m).slice(0, 80)).toEqual([]);
    }
  });
  it('every protractor and clock in the content and the fixtures, and the protractor\'s two modes', () => {
    const inContent = Object.values(CONTENT).flatMap((c) => [...c.discover, ...c.misconceptions.flatMap((mc) => mc.remedy)])
      .map((st) => (st as { fig?: { type: string } }).fig).filter((f) => f?.type === 'protractor' || f?.type === 'clock') as { type: string }[];
    const figs = [...inContent, { type: 'protractor', arms: [0, 40] }, { type: 'protractor', arms: [180, 130], letters: { vertex: 'B', a: 'A', b: 'C' } },
      { type: 'protractor', arms: [20, 75] }, { type: 'protractor', arms: [0, 165], base: 45, letters: { vertex: 'O', a: 'P', b: 'Q' } },
      { type: 'protractor', arms: [15, 180], base: 330 }, { type: 'clock', h: 2, m: 30 }, { type: 'clock', h: 10, m: 0, marks: true }];
    for (const f of figs) expect(fitProblems(renderToStaticMarkup(createElement(Figure, { fig: f })), SHOWN[f.type]), JSON.stringify(f)).toEqual([]);
    const turner = (m: object, value: number, extra = {}) => renderToStaticMarkup(createElement(AngleTurner, { m: { kind: 'angle', protractor: true, ...m }, value, onChange: () => {}, answer: 40, locked: false, reveal: false, good: false, hint: false, ...extra }));
    const objects = [
      ...[5, 40, 90, 135, 175].map((v) => turner({ mode: 'build', from: 'right', start: 90 }, v)),
      turner({ mode: 'build', from: 'left', base: 30, start: 90, letters: { vertex: 'B', a: 'A', b: 'C' } }, 65, { hint: true }),
      ...[0, 30, 95, 165, 210, 275, 300].map((r) => turner({ mode: 'align', arms: [30, 95], start: 0, letters: { vertex: 'B', a: 'A', b: 'C' } }, r)),
    ];
    for (const out of objects) expect(fitProblems(out, SHOWN.protractor)).toEqual([]);
  });
  it('catches a text that is too small or runs off the drawing', () => {
    const long = { ...GRAPH_OBJECTS[2], m: { ...(GRAPH_OBJECTS[2].m as object), ref: { pts: [[0, 300], [5, 0]], label: 'המכונית הכחולה שיצאה מבאר שבע בבוקר מוקדם' } } };
    expect(fitProblems(drawObject(long)).join(' ')).toMatch(/המכונית הכחולה.* outside the 340×\d+ box/);
    expect(fitProblems('<svg viewBox="0 0 600 300" class="figure"><text x="10" y="20" font-size="15">7</text></svg>')).toEqual(['"7" is 7.2px at 288px wide']);
    expect(fitProblems('<svg viewBox="0 0 300 200" class="figure"><circle cx="295" cy="100" r="9"></circle></svg>')[0]).toMatch(/a circle outside/);
  });
});

// ---------------------------------------------------------------- the graphs at the size a 320×568 lesson shows them
// The width is not what limits a graph in a lesson: on a 320×568 phone the drawing gets the height the question, the
// choices or the keypad leave it, and a 340×266 drawing fitted into 288×155 is drawn at 0.58, so 15-unit numbers came
// out at 8.7px (the review, scratchpad review-stage5 c.spec.js). The drawing measures its box and grows its text
// (graphAxes.jsx graphFont) as far as an axis's numbers stay apart. Below, every kind of graph exercise at the box its
// kind gets in the lesson on that phone (measured by e2e/graph-text.spec.js on phone-small, which checks the same in a
// real browser): every text 12px, and everything inside the drawing. An axis with ten numbers (a day's temperatures
// from 8° to 26°, a race's metres from 0 to 90) keeps them apart first (graphAxes.jsx numbersApart, about 3px between
// two rows): there the text stops at 11.5px or more.
const LESSON_MIN_PX = 11.5;
const LESSON_BOX: Record<string, number> = { fu1: 183, fu1d: 183, fu1p: 155, fu1f: 156, fu2d: 196, fu3: 205, fu3w: 203, fu3s: 226, fu1s: 226, fu4f: 180, fu4n: 226, eq6g: 183 };
describe('the graphs of stage 5 keep their text at 12px (11.5px on a ten-number axis) in a lesson on a 320×568 phone', () => {
  it('every kind, 300 draws of each unit, at the height its kind gets', () => {
    const real = Math.random;
    const seen: Record<string, number> = {}; const bad: string[] = [];
    try {
      Math.random = seeded(17);
      for (const [t, l] of [['func', 1], ['func', 2], ['func', 3], ['func', 4], ['eq', 6]] as const) {
        for (let i = 0; i < 300; i += 1) {
          const it = makeItem(t, l) as { key: string; fig?: { type: string }; manip?: { kind: string; start: number[] }; answer: unknown };
          const kind = it.key.split(':')[0]; if (!LESSON_BOX[kind]) continue;
          seen[kind] = (seen[kind] || 0) + 1;
          const box = { w: 288, h: LESSON_BOX[kind] };
          const html = it.fig?.type === 'sgraph' ? renderToStaticMarkup(createElement(Figure, { fig: it.fig, box }))
            : renderToStaticMarkup(createElement(GraphDraw, { m: it.manip, value: it.manip!.start, onChange: () => {}, answer: it.answer, box }));
          fitProblems(html, { drawn: box.w, high: box.h, min: LESSON_MIN_PX }).forEach((p) => bad.push(`${it.key}: ${p}`));
          // and 12px unless an axis carries ten numbers
          const a = (it.fig || it.manip) as unknown as { x: { every?: number }; y: { every?: number } };
          if (Math.max(numbered(a.x).length, numbered(a.y).length) < 10) fitProblems(html, { drawn: box.w, high: box.h }).forEach((p) => bad.push(`${it.key}: ${p}`));
        }
      }
    } finally { Math.random = real; }
    expect(Object.keys(seen).sort()).toEqual(Object.keys(LESSON_BOX).sort());
    expect(bad.slice(0, 5)).toEqual([]);
  }, 60_000);
  it('a walk of func:1, shown 288×155: 8.7px before, 12px now; at full width nothing grows', () => {
    const walk = { type: 'sgraph', x: { max: 45, step: 5, label: 'זמן', unit: 'דקות', every: 2 }, y: { max: 700, step: 100, label: 'מרחק מהבית', unit: 'מטרים', every: 2 }, series: [{ pts: [[0, 0], [10, 600], [25, 600], [45, 0]] }] };
    const at155 = renderToStaticMarkup(createElement(Figure, { fig: walk, box: { w: 288, h: 155 } }));
    expect(fitProblems(at155, { drawn: 288, high: 155 })).toEqual([]);
    // the same drawing with GRAPH_FONT's sizes (as before the review) is what the review measured
    expect(fitProblems(renderToStaticMarkup(createElement(Figure, { fig: walk })), { drawn: 288, high: 155 })[0]).toMatch(/is 8\.7px at 288px wide and 155px high/);
    // the box never changes: the text takes its room from the plot
    expect(/viewBox="([^"]+)"/.exec(at155)![1]).toBe(/viewBox="([^"]+)"/.exec(renderToStaticMarkup(createElement(Figure, { fig: walk })))![1]);
    expect(renderToStaticMarkup(createElement(Figure, { fig: walk, box: { w: 288, h: 260 } }))).toBe(renderToStaticMarkup(createElement(Figure, { fig: walk })));
  });
  it('grows only as far as an axis\'s numbers stay apart', () => {
    // ten numbers up a short axis: the text stops growing where they would touch
    const dense = { x: { max: 9, step: 1, label: 'x' }, y: { max: 9, step: 1, label: 'y' } };
    const font = graphFont(0.5, dense.x, dense.y);
    expect(font.k).toBeGreaterThan(1);
    expect(font.k).toBeLessThan(GRAPH_MAX_GROW);
    expect(numbersApart(graphFrame(dense.x, dense.y, { font }), dense.x, dense.y)).toBe(true);
    // a roomy axis grows to the 12px it needs, never past GRAPH_MAX_GROW
    const roomy = { x: { max: 4, step: 1, label: 'x' }, y: { max: 40, step: 10, label: 'y' } };
    expect(graphFont(0.6, roomy.x, roomy.y).num * 0.6).toBeGreaterThanOrEqual(GRAPH_MIN_PX);
    expect(graphFont(0.2, roomy.x, roomy.y).k).toBe(GRAPH_MAX_GROW);
    expect(graphFont(288 / 340, roomy.x, roomy.y).k).toBe(1);
  });
});
