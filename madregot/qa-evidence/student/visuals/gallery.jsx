import { writeFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Figure from '@/components/Figure.jsx';

const out = process.argv[2];
const SAMPLES = [
  ['numline — signed:1#0 (spec)', { type: 'numline', from: -6, to: 6, marks: [{ x: 0, label: '0' }], jumps: [{ from: -2, to: 3, label: '+5' }], anim: true }],
  ['numline — two points', { type: 'numline', from: -6, to: 6, marks: [{ x: -4, label: 'A' }, { x: 3, label: 'B', tone: 'good' }] }],
  ['numline — two jumps, letters under', { type: 'numline', from: -8, to: 8, marks: [{ x: 5, label: 'A' }], jumps: [{ from: 5, to: -3, label: '-8' }, { from: -3, to: -1, label: '+2' }] }],
  ['numline — wide range', { type: 'numline', from: -20, to: 20, step: 5, marks: [{ x: -15, label: 'C' }] }],
  ['numline — den 4', { type: 'numline', from: 0, to: 3, den: 4, marks: [{ x: 1.75, label: 'P' }] }],
  ['thermo', { type: 'thermo', value: -4, min: -10, max: 10, label: 'בלילה' }],
  ['thermo — warm', { type: 'thermo', value: 23, min: -10, max: 40 }],
  ['machine', { type: 'machine', inX: 3, rule: '2x + 1', outY: '?' }],
  ['machine — letters', { type: 'machine', rule: 'x \\cdot 3 - 2' }],
  ['dots — mode', { type: 'dots', values: [6, 7, 7, 8, 9, 7, 5, 8], axis: [4, 10], mark: { mode: 7 } }],
  ['dots — median', { type: 'dots', values: [3, 1, 2, 2, 5, 4, 2], axis: [0, 6], mark: { median: 2 } }],
  ['dots — mean (fulcrum)', { type: 'dots', values: [2, 4, 4, 6, 9], axis: [0, 10], mark: { mean: 5 } }],
  ['bars', { type: 'bars', labels: ['כדורגל', 'כדורסל', 'שחייה', 'ריקוד'], values: [12, 8, 5, 9], highlight: 0, unit: 'תלמידים' }],
  ['coord — quadrants + walk', { type: 'coord', range: 6, quadrants: true, path: [[3, 0], [3, 4]], points: [{ x: 3, y: 4, label: 'D' }], anim: true }],
  ['coord — line + riseRun', { type: 'coord', range: 6, line: { m: 2, b: -1 }, riseRun: { x: 1, run: 1 } }],
  ['coord — negative slope riseRun', { type: 'coord', range: 6, lines: [{ m: -0.5, b: 2, label: 'y = −0.5x + 2' }], riseRun: { x: -2, run: 2 } }],
  ['coord — two lines meet', { type: 'coord', range: 6, lines: [{ m: 1, b: 1, label: 'y = x + 1' }, { m: -1, b: 5, label: 'y = −x + 5' }], meet: true }],
  ['coord — parallel', { type: 'coord', range: 6, lines: [{ m: 2, b: 1 }, { m: 2, b: -3 }] }],
];
const css = readdirSync(`${out}/assets`).filter((f) => f.endsWith('.css')).map((f) => `<link rel="stylesheet" href="assets/${f}">`).join('');
const cards = SAMPLES.map(([t, fig]) => `<section class="g-card"><h2>${t}</h2><div class="lm-canvas big"><div class="lm-fig">${renderToStaticMarkup(createElement(Figure, { fig: { ...fig, anim: false } }))}</div></div><p class="g-aria">aria-label: ${renderToStaticMarkup(createElement(Figure, { fig: { ...fig, anim: false } })).match(/aria-label="([^"]*)"/)[1]}</p></section>`).join('');
for (const theme of ['light', 'dark']) {
  writeFileSync(`${out}/gallery-${theme}.html`, `<!doctype html><html lang="he" dir="rtl" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${css}
<style>body{background:var(--paper);color:var(--ink);margin:0;padding:16px;font-family:var(--font-ui)} .g-card{margin:0 0 20px} h2{font-size:14px;margin:0 0 6px;color:var(--ink-2)} .g-aria{font-size:12px;color:var(--ink-2);margin:6px 0 0}</style></head><body>${cards}</body></html>`);
}
console.log('ok');
