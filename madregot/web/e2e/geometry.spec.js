// The geometry of curriculum stage 4 (GEOM-4 to GEOM-6: transformations, congruent triangles, isosceles triangles and
// similarity) on both phones. For each of its 13 stairs: the first discover step shows its drawing or its object, with
// the button that goes on, and one practice exercise (a fixed seed) shows its question, its answer and the check button
// on screen; nothing scrolls sideways and no script error is thrown. The stairs come from the skill catalogue, so a
// stair added to these topics is walked here with no change.
//
// GEOM_SHOTS=<folder> also saves a picture of each (nothing is compared): the QA pictures listed in QA_MATRIX.md's
// stage-4 section, <topic><level>-discover1-<width>.png and <topic><level>-practice-<width>.png.
import { test, expect } from '@playwright/test';
import { open, openOn, item, student, expectNoSidewaysScroll, expectUsable } from './helpers.js';
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

// A choice that states a relation (congr:2 "what else is needed for צ.ז.צ": ∢A = ∢P) is too wide for three in a row:
// it goes in the list, every choice shows all of its text, and the page never scrolls sideways. A short choice (congr:5
// "which angle is the largest": ∢A) still sits three in a row.
for (const [what, want, inline] of [
  ['congr:2 a relation of two angles', (it) => it.key.startsWith('cg2n'), false],
  ['congr:5 one angle', (it) => it.key.startsWith('cg5m'), true],
]) {
  test(`${what}: every choice shows all of its text on the phone`, async ({ page }) => {
    const route = what.startsWith('congr:2') ? '#/lesson/congr/2' : '#/lesson/congr/5';
    const it = await openOn(page, route, student('8'), want);
    const group = page.locator('.lesson-main [role="radiogroup"]');
    await expect(group, it.key).toBeVisible();
    const choices = group.getByRole('radio');
    await expect(choices).toHaveCount(3);
    const vw = page.viewportSize().width;
    for (const c of await choices.all()) {
      const box = await c.boundingBox();
      expect(box.x, `${it.key}: the choice starts on screen`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${it.key}: the choice ends on screen`).toBeLessThanOrEqual(vw + 1);
      const cut = await c.evaluate((el) => [el, ...el.querySelectorAll('.choice-text, .katex')].map((x) => x.scrollWidth - x.clientWidth).filter((d) => d > 1));
      expect(cut, `${it.key}: nothing in the choice is cut off`).toEqual([]);
    }
    await expectNoSidewaysScroll(page);
    await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), `${it.key}: the check button`);
    expect(await group.evaluate((el) => el.classList.contains('inline')), `${it.key}: three in a row`).toBe(inline);
  });
}

// Solving together (stage C) on the small phone: transf:1-3 open with a coordinate plane under the problem; the step's
// first choice is on screen above the bar, not under it (curriculum stage 4's review), and nothing scrolls sideways.
for (const level of [1, 2, 3]) {
  test(`transf:${level} solving together: the first choice is on screen with the plane`, async ({ page }) => {
    await open(page, `#/learn/transf/${level}/C`, student('7'));
    await expect(page.locator('.together .lm-fig svg.figure.coord').first()).toBeVisible();
    await expectUsable(page, page.locator('.together .ls-choice').first(), `transf:${level} C: the first choice`);
    await expectNoSidewaysScroll(page);
  });
}
