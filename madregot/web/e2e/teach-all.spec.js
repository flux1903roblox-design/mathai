// Every stair's teaching can be completed, start to end, through its own screens: understand (every step kind,
// every interactive object), the worked examples step by step, and solving together with the last step typed; each stage
// ends in its completion moment. The stairs come from the skill catalogue itself, so a topic registered there is walked
// here with no change.
import { test, expect } from '@playwright/test';
import { open, student } from './helpers.js';
import { STAIRS, GRADE_OF as GRADE } from '../src/learn/skills.ts';
import { VISUAL_EXEMPT } from '../src/learn/visualPlan.ts';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'one phone is enough for the content walk'); });
const plain = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e6) / 1e6));

for (const [topic, n] of Object.entries(STAIRS)) {
  for (let level = 1; level <= n; level += 1) {
    test(`${topic}:${level} can be learned from start to end`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // a daily goal the three stages do not reach: the goal's own moment (STUDENT-7) is tested in learn.spec.js
      await open(page, `#/learn/${topic}/${level}/A`, student(GRADE[topic], { goalXp: 50 }));
      await expect(page.locator('.step-player')).toBeVisible();
      // A: every step
      for (let i = 0; i < 20; i += 1) {
        await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
        const st = await page.evaluate(() => window.__madregotStep);
        if (st.kind === 'explore') {
          await expect(page.locator('.ls-explore .manip')).toBeVisible();
          await expect.poll(() => page.evaluate(() => window.__madregotSolveStep?.forStep === window.__madregotStep)).toBe(true);
          await page.evaluate(() => window.__madregotSolveStep());
          await page.locator('.lm-check').click();
          await expect(page.locator('.lm-actions.has-good')).toBeVisible();
        }
        if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); await expect(page.locator('.lm-actions.has-good')).toBeVisible(); }
        const next = page.locator('.sp-next');
        const last = (await next.textContent()).includes('לדוגמה');
        const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
        await next.click();
        if (last) break;
        await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
      }
      // each stage ends in its short completion moment, whose button goes on to the next stage
      await expect(page.locator('.stage-done')).toContainText('שלב 1 הושלם!');
      await page.locator('.stage-done').getByRole('button', { name: 'לדוגמה הפתורה', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`learn/${topic}/${level}/B`));
      await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible(); // the first example is on screen
      // B: every worked example, one step at a time
      for (let e = 0; e < 6; e += 1) {
        while (await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).count()) await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).click();
        const go = page.getByRole('button', { name: /לדוגמה הבאה|לפתור יחד/ });
        const label = await go.textContent();
        await go.click();
        if (label.includes('לפתור')) break;
      }
      await expect(page.locator('.stage-done')).toContainText('שלב 2 הושלם!');
      await page.locator('.stage-done').getByRole('button', { name: 'לפתור יחד', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`learn/${topic}/${level}/C`));
      await expect(page.locator('.stage-done')).toHaveCount(0); // the moment has given way to the first problem
      // C: every guided problem: the right move at each step, then the last step typed
      for (let g = 0; g < 6 && !(await page.locator('.stage-done').count()); g += 1) {
        for (let k = 0; k < 8; k += 1) {
          await expect.poll(() => page.evaluate(() => window.__madregotGuided)).toBeTruthy();
          const gd = await page.evaluate(() => window.__madregotGuided);
          if (gd.final) {
            await page.locator('.tg-input').fill(plain(gd.final.answer));
            await page.getByRole('button', { name: 'בדיקה' }).click();
            await expect(page.getByText('פתרתם את הצעד האחרון לבד')).toBeVisible();
            await page.evaluate(() => { window.__madregotGuided = null; });
            await page.getByRole('button', { name: 'המשך' }).click();
            // the next problem, or the stage's completion moment after the last one
            await expect.poll(async () => (await page.locator('.stage-done').count()) > 0 || !!(await page.evaluate(() => window.__madregotGuided))).toBe(true);
            break;
          }
          const ok = gd.step.choices.findIndex((c) => c.ok);
          const before = gd.step.prompt;
          await page.locator('.tg-step .ls-choice').nth(ok).click();
          await page.locator('.lm-check').click();
          await page.locator('.lm-actions.has-good .sp-next').click();
          await expect.poll(() => page.evaluate(() => window.__madregotGuided?.final ? 'final' : window.__madregotGuided?.step?.prompt)).not.toBe(before);
        }
      }
      await expect(page.locator('.stage-done')).toContainText('שלב 3 הושלם!');
      await expect(page.locator('.stage-done .climb-caption')).toHaveText('3 מתוך 5 שלבים במדרגה');
      // the map is a tap away; the stair's page shows the three teaching stages done
      await page.locator('.stage-done').getByRole('button', { name: 'למפה', exact: true }).click();
      await expect(page.locator('.learn')).toBeVisible();
      await page.goto(`./#/learn/${topic}/${level}`);
      await expect(page.locator('.journey')).toBeVisible();
      await expect(page.locator('.jstage.done')).toHaveCount(3);
      expect(errors).toEqual([]);
    });
  }
}

// STUDENT-8: a picture or an object on every teaching step. On a small phone (320×568), every step of Stage A in every
// topic has its visual region, with a drawing or an object to move in it, at least 120px tall; a step in
// learn/visualPlan.ts VISUAL_EXEMPT is the one allowed to have none.
test.describe('every teaching step shows its drawing on a small phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  for (const topic of Object.keys(STAIRS)) {
    for (let level = 1; level <= STAIRS[topic]; level += 1) {
      test(`${topic}:${level}: a drawing on every step at 320px`, async ({ page }) => {
        await open(page, `#/learn/${topic}/${level}/A`, student(GRADE[topic], { goalXp: 50 }));
        let done = false;
        for (let i = 0; i < 20 && !done; i += 1) {
          await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
          const st = await page.evaluate(() => window.__madregotStep);
          // the step on screen is this one: the one before has left and this one has come in (they swap one after the other)
          const at = Number(await page.locator('.sp-progress').getAttribute('aria-valuenow'));
          const id = `${topic}:${level}#${at}`;
          await expect(page.locator(`.sp-step[aria-label^="צעד ${at + 1} מתוך"]`), id).toHaveCount(1);
          await expect(page.locator('.sp-step')).toHaveCount(1);
          const visual = page.locator('.sp-step [data-region="visual"]');
          if (VISUAL_EXEMPT[id]) {
            await expect(visual.locator('.lm-fig, .manip'), `${id} is exempt: ${VISUAL_EXEMPT[id]}`).toHaveCount(0);
          } else {
            await expect(visual, id).toHaveCount(1);
            await expect(visual.locator('.lm-fig [role="img"], .lm-fig table, .manip').first(), `${id}: a drawing or an object`).toBeVisible();
            expect((await visual.boundingBox()).height, `${id}: the visual's height`).toBeGreaterThanOrEqual(120);
          }
          if (st.kind === 'explore') {
            await expect.poll(() => page.evaluate(() => window.__madregotSolveStep?.forStep === window.__madregotStep)).toBe(true);
            await page.evaluate(() => window.__madregotSolveStep());
            await page.locator('.lm-check').click();
          }
          if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
          const next = page.locator('.sp-next');
          done = (await next.textContent()).includes('לדוגמה'); // the last step: every step was measured
          if (!done) {
            const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
            await next.click();
            await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
          }
        }
        expect(done, `${topic}:${level}: reached the last step`).toBe(true);
      });
    }
  }
});

// STUDENT-9 §4: nothing that looks active is disabled. Step 1 has no "previous" button at all; step 2 has one.
test('the first teaching step has no "previous" button; the second has a working one', async ({ page }) => {
  await open(page, '#/learn/signed/1/A', student('7'));
  await expect(page.locator('.step-player')).toBeVisible();
  await expect(page.getByRole('button', { name: 'הצעד הקודם' })).toHaveCount(0);
  await expect(page.locator('.sp-back:disabled, .lm-actions button:disabled:not(.lm-check)')).toHaveCount(0);
  const st = await page.evaluate(() => window.__madregotStep);
  if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
  await page.locator('.sp-next').click();
  await expect(page.locator('.sp-progress')).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'הצעד הקודם' }).click();
  await expect(page.locator('.sp-progress')).toHaveAttribute('aria-valuenow', '0');
});

// STUDENT-9 §3: maths in a sentence uses the sentence's digits. In "כש־$x = -3$" the 3 is Rubik and the x is KaTeX's
// italic; a bare number ($16$ on a card) is plain Rubik text.
test('digits inside inline maths are Rubik, letters stay KaTeX', async ({ page }) => {
  await open(page, '#/learn/expr/1/A', student('7'));
  for (let i = 0; i < 12; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.text.includes('$x = -3$')) break;
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await page.locator('.sp-next').click();
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  const fonts = await page.locator('.lm-say').evaluate((say) => {
    const leaves = [...say.querySelectorAll('.mt-inline .katex-html .mord')].filter((el) => !el.children.length);
    const three = leaves.find((el) => el.textContent === '3');
    const x = leaves.find((el) => el.textContent === 'x');
    return { three: three && getComputedStyle(three).fontFamily, x: x && getComputedStyle(x).fontFamily };
  });
  expect(fonts.three, 'the digit 3 of x = -3').toMatch(/^"?Rubik/);
  expect(fonts.x, 'the letter x').toMatch(/KaTeX_Math/);
  // the answer cards are bare numbers: plain text, no KaTeX
  await expect(page.locator('.ls-choice bdi.num').first()).toBeVisible();
  await expect(page.locator('.ls-choice .katex')).toHaveCount(0);
  const card = await page.locator('.ls-choice bdi.num').first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(card).toMatch(/^"?Rubik/);
});
