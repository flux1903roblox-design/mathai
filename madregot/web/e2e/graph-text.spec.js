// The numbers and names of a graph read at their size on the phone (stage5.md FUNC-1, after the review). A lesson fits a
// situation graph (Figure.jsx SGraph) or the graph to draw (GraphDraw.jsx) into the room the screen leaves it: on a
// 320×568 phone about 155px of height for a drawing 266 units tall, which would draw 15-unit text at under 9px. The
// drawing grows its text there (graphAxes.jsx graphFont) as far as the axis's numbers stay apart; this measures what a
// student sees: each text's computed size times the scale the SVG is drawn at, in the real lesson.
import { test, expect } from '@playwright/test';
import { openOn, student, expectNoSidewaysScroll } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the two phones'); });

const SHOTS = process.env.GRAPH_SHOTS;
/** The smallest text a graph may show in a lesson, in pixels, on either phone: 12, or 11.5 on an axis of ten numbers
 * (learn/visuals.test.ts checks every draw of every kind at these boxes). */
const GRAPH_TEXT_FLOOR = Number(process.env.GRAPH_FLOOR ?? 11.5);

// every kind of exercise that shows a graph or asks for one to be drawn: [name, route, grade, which item]
const CASES = [
  ['a walk read off its graph (typed)', 'func/1', '8', (x) => x.key.startsWith('fu1:')],
  ['a day of temperatures as dots (typed)', 'func/1', '8', (x) => x.key.startsWith('fu1d:')],
  ['what a flat part means (choices)', 'func/1', '8', (x) => x.key.startsWith('fu1f:')],
  ['what the point A describes (choices)', 'func/1', '8', (x) => x.key.startsWith('fu1p:')],
  ['a story drawn as a graph', 'func/1', '8', (x) => x.key.startsWith('fu1s:')],
  ['a table drawn as a graph', 'func/2', '8', (x) => x.key.startsWith('fu2d:')],
  ['how long a graph rises (typed)', 'func/3', '8', (x) => x.key.startsWith('fu3:')],
  ['which way between two x\'s (choices)', 'func/3', '8', (x) => x.key.startsWith('fu3w:')],
  ['a shape drawn', 'func/3', '8', (x) => x.key.startsWith('fu3s:')],
  ['who is faster (choices)', 'func/4', '8', (x) => x.key.startsWith('fu4f:')],
  ['a rate continued (drawn)', 'func/4', '8', (x) => x.key.startsWith('fu4n:')],
  ['a meeting read off two cars', 'eq/6', '7', (x) => x.key.startsWith('eq6g:')],
];

for (const [what, route, grade, want] of CASES) {
  test(`graph text is readable: ${what}`, async ({ page }, info) => {
    const it = await openOn(page, `#/lesson/${route}`, student(grade), want);
    const svg = page.locator('.lesson-main svg.fig-sgraph, .lesson-main svg.manip-canvas').first();
    await expect(svg).toBeVisible();
    // the drawing measures itself once it is on the page; the sizes settle on the next frame
    await page.waitForTimeout(300);
    const r = await svg.evaluate((el) => {
      const vb = el.viewBox.baseVal; const box = el.getBoundingClientRect();
      const scale = Math.min(box.width / vb.width, box.height / vb.height);
      const texts = [...el.querySelectorAll('text')].filter((t) => t.textContent.trim());
      const sizes = texts.map((t) => ({ t: t.textContent.trim(), px: parseFloat(getComputedStyle(t).fontSize) * scale }));
      return { drawn: `${Math.round(box.width)}x${Math.round(box.height)}`, scale, min: Math.min(...sizes.map((s) => s.px)), smallest: sizes.sort((a, b) => a.px - b.px)[0] };
    });
    console.log(`${info.project.name} ${it.key.split(':')[0]} drawn ${r.drawn} scale ${r.scale.toFixed(2)} smallest ${r.min.toFixed(1)}px ("${r.smallest.t}")`);
    expect(r.min, `the smallest text of ${it.key} at ${r.drawn}`).toBeGreaterThanOrEqual(GRAPH_TEXT_FLOOR - 0.05);
    await expectNoSidewaysScroll(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/graph-${it.key.split(':')[0]}-${info.project.name}.png` });
  });
}
