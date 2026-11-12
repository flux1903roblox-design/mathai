// The geometry of curriculum stage 4 (GEOM-4 to GEOM-6: transformations, congruent triangles, isosceles triangles and
// similarity) on both phones. For each of its 13 stairs: the first discover step shows its drawing or its object, with
// the button that goes on, and one practice exercise (a fixed seed) shows its question, its answer and the check button
// on screen; nothing scrolls sideways and no script error is thrown. The stairs come from the skill catalogue, so a
// stair added to these topics is walked here with no change.
//
// GEOM_SHOTS=<folder> also saves a picture of each (nothing is compared): the QA pictures listed in QA_MATRIX.md's
// stage-4 section, <topic><level>-discover1-<width>.png and <topic><level>-practice-<width>.png.
import { test, expect } from '@playwright/test';
import { open, item, student, expectNoSidewaysScroll, expectUsable } from './helpers.js';
import { STAIRS, GRADE_OF } from '../src/learn/skills.ts';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the stairs on both phones'); });

async function shot(page, name) {
  const dir = process.env.GEOM_SHOTS; if (!dir) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${name}-${page.viewportSize().width}.png` });
}

for (const topic of ['transf', 'congr', 'sim']) {
  for (let level = 1; level <= STAIRS[topic]; level += 1) {
    test(`${topic}:${level}: the first discover step and a practice exercise fit the phone`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const who = student(GRADE_OF[topic]);

      // the first discover step: its drawing (or the object to move) and the button that goes on
      await open(page, `#/learn/${topic}/${level}/A`, who);
      await expect(page.locator('.step-player')).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
      const visual = page.locator('.sp-step .figure-wrap, .sp-step .manip:not(.manip-loading)').first();
      await expect(visual, 'the step has a drawing or an object').toBeVisible();
      const v = await visual.boundingBox();
      expect(v.x, 'the drawing starts on screen').toBeGreaterThanOrEqual(-1);
      expect(v.x + v.width, 'the drawing ends on screen').toBeLessThanOrEqual(page.viewportSize().width + 1);
      await expectUsable(page, page.locator('.sp-nav [data-region="primary"]'), 'the step\'s button');
      await expectNoSidewaysScroll(page);
      await shot(page, `${topic}${level}-discover1`);

      // one practice exercise: the question, the answer and the check button
      await open(page, `#/lesson/${topic}/${level}`, who);
      await expect.poll(() => item(page)).toBeTruthy();
      const it = await item(page);
      await expect(page.locator('#qtext'), it.key).toBeVisible();
      const answerArea = it.form === 'manip' ? page.locator('.lesson-main .manip').first()
        : it.form === 'mc' ? page.locator('.lesson-main [role="radiogroup"]').first()
          : page.locator('.answer-bar .answer');
      await expect(answerArea, `${it.key}: the answer`).toBeVisible();
      await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), `${it.key}: the check button`);
      await expectNoSidewaysScroll(page);
      await shot(page, `${topic}${level}-practice`);
      expect(errors, 'no script error').toEqual([]);
    });
  }
}
