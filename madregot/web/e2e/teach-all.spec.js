// Every stair's teaching can be completed, start to end, through its own screens: understand (every step kind,
// every interactive object), the worked examples step by step, and solving together with the last step typed; each stage
// ends in its completion moment.
import { test, expect } from '@playwright/test';
import { open, student } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'one phone is enough for the content walk'); });

const STAIRS = { signed: 5, coord: 5, angles: 5, line: 8, pyth: 5, stats: 5 };
const GRADE = { signed: '7', coord: '7', angles: '7', line: '8', pyth: '8', stats: '8' };
const plain = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e6) / 1e6));

for (const [topic, n] of Object.entries(STAIRS)) {
  for (let level = 1; level <= n; level += 1) {
    test(`${topic}:${level} can be learned from start to end`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await open(page, `#/learn/${topic}/${level}/A`, student(GRADE[topic]));
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
