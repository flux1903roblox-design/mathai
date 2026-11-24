// Graphs and formulas as a screen reader meets them (the external review, Nov 2026, finding 5). A drawing's numbers along
// its axes are for the eye; a screen reader that walks into a graph should not hear "0, 5, 10, 15, 0, 100, 200…" one by
// one. The still figures are one picture (role="img") with their words, which already hides what is inside; the graph a
// student draws (GraphDraw, a group of sliders) and the coordinate planes a student works on (PlotPoint, TriangleDrag,
// Transform: role="application") showed every tick number and axis letter in the tree. Their axes are now hidden, and
// the drawn graph says its two axes once, in words (the same words as the still graph's).
import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GraphDraw from './GraphDraw.jsx';
import PlotPoint from './PlotPoint.jsx';
import { Plane, gridGeometry } from './grid.jsx';
import Figure from '@/components/Figure.jsx';
import { MathText, loadKatex } from '@/components/MathText.jsx';
import { axisWords } from '@/content/manip.js';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/**
 * The words a screen reader can reach in static markup: every text outside an element marked aria-hidden="true", and
 * nothing inside a picture (role="img": what is inside it is presentational, its name is its words).
 */
function exposedText(html) {
  let out = ''; let hidden = 0; const stack = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g)) {
    const [, close, tag, attrs = '', self, text] = m;
    if (text != null) { if (!hidden) out += `${text} `; continue; }
    if (close) { if (stack.pop()) hidden -= 1; continue; }
    if (self || VOID.has(tag.toLowerCase())) continue;
    const hides = /\baria-hidden="true"/.test(attrs) || /\brole="img"/.test(attrs);
    stack.push(hides); if (hides) hidden += 1;
  }
  return out.replace(/\s+/g, ' ').trim();
}
const canvas = (html) => /<svg[^>]*class="manip-canvas[^"]*"[\s\S]*?<\/svg>/.exec(html)[0];
const attr = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const textOf = (html, id) => { const m = new RegExp(`<(\\w+)[^>]*\\bid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html); return m ? m[2].replace(/<[^>]+>/g, '') : null; };

const time = { max: 15, step: 5, label: 'זמן', unit: 'דקות' };
const dist = { max: 600, step: 100, label: 'מרחק מהבית', unit: 'מטרים' };
const walk = { kind: 'graph', x: time, y: dist, start: [0, 200, 200, 200], fixed: [0] };
const draw = (props) => renderToStaticMarkup(createElement(GraphDraw, { m: walk, value: [0, 400, 300, 200], onChange: () => {}, locked: false, reveal: false, good: false, hint: false, ...props }));

describe('the graph a student draws: its axes said once, not number by number', () => {
  it('no tick number or axis name is reachable inside it; only its four points (sliders)', () => {
    for (const test of [false, true]) {
      const svg = canvas(draw({ test }));
      expect(exposedText(svg), `test ${test}`).toBe('');
      expect(svg.match(/role="slider"/g)).toHaveLength(4);
      // the numbers are still drawn for the eye
      expect(svg).toMatch(/class="mp-graph-num"[^>]*>600</);
    }
  });

  it('its two axes are its description, in the still graph\'s words', () => {
    const out = draw({});
    const svg = /<svg[^>]*class="manip-canvas[^>]*>/.exec(out)[0];
    expect(attr(svg, 'aria-label')).toBe('גרף: מרחק מהבית לפי זמן');
    const id = attr(svg, 'aria-describedby');
    expect(id).toBeTruthy();
    expect(textOf(out, id)).toBe(`${axisWords('x', time)}; ${axisWords('y', dist)}`);
    expect(textOf(out, id)).toBe('ציר x מ־0 עד 15, קו כל 5; ציר y מ־0 עד 600, קו כל 100');
    // a scale with a number on every other line says so, as the eye reads it
    expect(axisWords('x', { max: 45, step: 5, every: 2 })).toBe('ציר x מ־0 עד 45, קו כל 5, מספר כל 10');
  });

  it('the still situation graph keeps its one name with every number (its words did not change)', () => {
    const fig = { type: 'sgraph', x: { ...time, every: 1 }, y: dist, series: [{ pts: [[0, 0], [5, 400], [10, 400], [15, 0]] }] };
    const out = renderToStaticMarkup(createElement(Figure, { fig }));
    expect(out).toMatch(/<svg [^>]*role="img"/);
    expect(attr(out, 'aria-label')).toBe('גרף: מרחק מהבית (מטרים) לפי זמן (דקות); ציר x מ־0 עד 15, קו כל 5; ציר y מ־0 עד 600, קו כל 100; (0, 0) → (5, 400) → (10, 400) → (15, 0)');
    expect(exposedText(out)).toBe('');
  });
});

describe('the coordinate plane a student works on: its grid is drawing, not text to read', () => {
  it('the plane\'s numbers and the letters x and y are hidden; what is put on it is not', () => {
    const plane = renderToStaticMarkup(createElement('svg', null, createElement(Plane, { g: gridGeometry(6) }, createElement('text', null, 'A'))));
    expect(plane).toMatch(/class="mp-num"[^>]*>−6</); // drawn
    expect(exposedText(plane)).toBe('A');
  });

  it('putting a point: the plane says where the point is, and no tick number besides', () => {
    const out = renderToStaticMarkup(createElement(PlotPoint, { m: { kind: 'plot', range: 6, label: 'A' }, value: [2, -3], onChange: () => {}, locked: false, reveal: false, good: false, hint: false }));
    const svg = canvas(out);
    expect(attr(svg, 'aria-label')).toBe('הנקודה A בשיעורים 2, −3');
    expect(exposedText(svg)).not.toMatch(/\d|−/);
  });
});

describe('a formula is read as maths, not as its drawing', () => {
  beforeAll(async () => { await loadKatex(); });
  it('KaTeX draws it for the eye (hidden) and writes it as MathML with its TeX for a screen reader', () => {
    const out = renderToStaticMarkup(createElement(MathText, { text: 'הפתרון: $x = \\frac{3}{4}$' }));
    expect(out).toContain('<math');
    expect(out).toMatch(/<annotation encoding="application\/x-tex">x = \\frac\{3\}\{4\}<\/annotation>/);
    expect(out).toMatch(/class="katex-html" aria-hidden="true"/);
  });
});
