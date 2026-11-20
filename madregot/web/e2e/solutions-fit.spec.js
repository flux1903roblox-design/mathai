// Every generated solution fits the smallest phone. Inline maths does not wrap (KaTeX), so a step of a solution that is
// wider than the feedback panel scrolls sideways inside its own box, and a 12-year-old does not find a scroll with no
// bar: the start of the line is simply cut off. For every stair, the steps of many generated questions are drawn in the
// real feedback panel at 320×568, each at its own step's place on the staircase (a later step sits further in), with
// the app's own step component (StairStep), and none may be wider than its box. Run in the phone project.
import { test, expect } from '@playwright/test';
import { open, openOn, student, answer, proceed } from './helpers.js';
import { STAIRS } from '../src/learn/skills.ts';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'one phone is enough for the content walk'); });
test.use({ viewport: { width: 320, height: 568 } });

const N = Number(process.env.FIT_N) || 300;

for (const topic of Object.keys(STAIRS)) {
  test(`${topic}: every step of a generated solution fits a 320 phone`, async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, '#/lesson/signed/1', student('7'));
    // two wrong answers: the solution's staircase is on screen, in the red feedback panel
    await answer(page, false);
    await expect(page.locator('section.fb-retry')).toBeVisible();
    await proceed(page);
    await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    // an interactive question on a short phone folds the panel: open its solution
    if (await page.locator('section.fb-folded').count()) await page.locator('section.fb-reveal').getByRole('button', { name: 'הפתרון', exact: true }).click();
    await expect(page.locator('section.fb-reveal .stair-step')).toHaveCount(1);
    const wide = [];
    for (let level = 1; level <= STAIRS[topic]; level += 1) {
      const lines = await page.evaluate(([t, l, n]) => window.__madregotSolutionLines(t, l, n), [topic, level, N]);
      const over = await page.evaluate(async (list) => {
        const ol = document.createElement('ol');
        ol.className = 'stair-list';
        document.querySelector('section.fb-reveal .fb-body').appendChild(ol);
        const unmount = window.__madregotDrawSteps(ol, list);
        void ol.offsetWidth;
        await document.fonts.ready;
        const out = [...ol.querySelectorAll('.stair-text')].map((el, k) => ({ d: el.scrollWidth - el.clientWidth, ...list[k] })).filter((x) => x.d > 1);
        unmount(); ol.remove();
        return out;
      }, lines);
      wide.push(...over.map((x) => `${topic}:${level} step ${x.i + 1} (${x.key}) ${x.d}px over: ${x.text}`));
    }
    expect(wide).toEqual([]);
  });
}

// A choice that is a line of maths fits its button too: the class's regrouped line (expr:3, five terms) is set smaller
// until it does (Lesson.jsx ChoiceText). Scrolled inside the button, its first term's sign was cut off, and that sign
// is what tells the right line from the one with the minus dropped.
test('a choice that is a long line of maths fits its button on a 320 phone', async ({ page }) => {
  // every number of the line two digits long but one: the widest the question draws
  await openOn(page, '#/lesson/expr/3', student('7'), (it) => /^ex3r:/.test(it.key) && (String(it.key).match(/\d\d/g) || []).length >= 4);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.choice')).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.choice-text')].map((el) => el.scrollWidth - el.clientWidth).filter((d) => d > 1))).toEqual([]);
  // never below the size of a hint's text
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.choice-text .katex')].map((el) => parseFloat(getComputedStyle(el).fontSize)));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(15);
});

