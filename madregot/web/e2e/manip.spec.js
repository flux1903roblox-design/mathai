// The interactive exercises: the student moves a maths object (a marker on a number line, a point, a line, a ray,
// the legs of a triangle, a bar) and the state is checked exactly. On every device: the object is whole on screen,
// a real drag moves it, the keyboard and the step buttons move it too, checking is off until it has been moved,
// and the "not yet" and "right" paths work with the object still in view.
import { test, expect } from '@playwright/test';
import { student, item, openOn, proceed, expectUsable, expectNoSidewaysScroll } from './helpers.js';

const KINDS = [
  ['numberline', 'signed/1', '7', [0.5, 0.75, 0.85, 0.75]],
  ['plot', 'coord/1', '7', [0.5, 0.5, 0.75, 0.25]],
  ['line', 'line/2', '8', [0.5, 0.5, 0.5, 0.25]],
  ['angle', 'angles/1', '7', [0.5, 0.2, 0.85, 0.4]],
  ['squares', 'pyth/1', '8', [0.6, 0.6, 0.85, 0.6]],
  ['bars', 'stats/3', '8', [0.88, 0.5, 0.88, 0.2]],
  ['pins', 'signed/2', '7', [0.92, 0.6, 0.3, 0.6]],
  ['triangle', 'angles/3', '7', [0.33, 0.27, 0.5, 0.1]],
  ['plot', 'coord/5', '7', [0.5, 0.5, 0.3, 0.3], (it) => !!it.manip.shape, 'the missing vertex of a rectangle'],
  ['plot', 'line/1', '8', [0.5, 0.5, 0.7, 0.3], (it) => !!it.manip.line, 'a point of a line'],
  ['bars', 'stats/2', '8', [0.88, 0.2, 0.88, 0.6], (it) => it.manip.stat === 'median', 'the median and an outlier'],
];
const state = (page) => page.evaluate(() => {
  const c = document.querySelector('.manip-canvas'); const r = document.querySelector('.manip-readout');
  return `${c.getAttribute('aria-valuenow')}|${c.getAttribute('aria-label')}|${r?.textContent || ''}|${[...document.querySelectorAll('.step-label b')].map((b) => b.textContent).join(',')}`;
});
const checkBtn = (page) => page.getByRole('button', { name: 'בדיקה', exact: true });

for (const [kind, route, grade, [fx, fy, tx, ty], extra = () => true, name = kind] of KINDS) {
  test(`interactive exercise: ${name}`, async ({ page }) => {
    await openOn(page, `#/lesson/${route}?part=1`, student(grade), (it) => it.form === 'manip' && it.manip.kind === kind && extra(it));
    const canvas = page.locator('.manip-canvas');
    await expectNoSidewaysScroll(page);
    const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
    expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
    await expectUsable(page, page.locator('#qtext'), 'the question');
    await expectUsable(page, canvas, 'the maths object');
    const main = await page.locator('.lesson-main').boundingBox(); const box = await canvas.boundingBox();
    expect(box.y + box.height, 'the object ends inside the maths region').toBeLessThanOrEqual(main.y + main.height + 1);
    expect(box.height, 'the object is large enough to work with').toBeGreaterThanOrEqual(120);
    for (const b of await page.locator('.manip .step-btn').all()) {
      await b.scrollIntoViewIfNeeded();
      const s = await b.boundingBox();
      expect(Math.min(s.width, s.height), 'step buttons are thumb-sized').toBeGreaterThanOrEqual(40);
    }
    // nothing to check before the object has been moved
    await expect(checkBtn(page)).toBeDisabled();

    // a real drag across the drawing moves the object
    const before = await state(page);
    const drag = async (x0, y0, x1, y1) => {
      await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0);
      await page.mouse.down();
      for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + box.width * (x0 + (x1 - x0) * i / 8), box.y + box.height * (y0 + (y1 - y0) * i / 8));
      await page.mouse.up();
    };
    await drag(fx, fy, tx, ty);
    // the object may have started where this drag ends: then the other way
    if (await state(page) === before) await drag(fx, fy, Math.min(0.95, Math.max(0.05, 2 * fx - tx)), Math.min(0.95, Math.max(0.05, 2 * fy - ty)));
    await expect.poll(() => state(page), 'the drag moved the object').not.toBe(before);
    await expect(checkBtn(page)).toBeEnabled();

    // the step buttons move it without dragging; arrow keys too where the drawing itself takes the focus
    const s1 = await state(page);
    await page.locator('.manip .step-btn:not(:disabled)').first().click();
    await expect.poll(() => state(page), 'a step button moved the object').not.toBe(s1);
    if (await canvas.getAttribute('tabindex') === '0') {
      const s2 = await state(page);
      await canvas.focus();
      await page.keyboard.press('ArrowRight');
      if (await state(page) === s2) await page.keyboard.press('ArrowLeft'); // it was at the end of its range
      await expect.poll(() => state(page), 'arrow keys moved the object').not.toBe(s2);
    }

    // a near miss: "not yet", the object stays in view and can be moved again; checking waits for a change
    await page.evaluate(() => window.__madregotSolve(false));
    await checkBtn(page).click();
    await expect(page.locator('section.fb-retry')).toBeVisible();
    await expectUsable(page, page.locator('section.fb .fb-actions .btn'), 'the try-again button');
    const share = await page.evaluate(() => { const f = document.querySelector('.manip-canvas').getBoundingClientRect(); const m = document.querySelector('.lesson-main').getBoundingClientRect(); return Math.max(0, Math.min(f.bottom, m.bottom) - Math.max(f.top, m.top)) / f.height; });
    expect(share, 'the object stays in view after a mistake').toBeGreaterThanOrEqual(0.6);
    await proceed(page);
    await expect(checkBtn(page)).toBeDisabled();

    // the right state: the success panel; the object is locked
    await page.evaluate(() => window.__madregotSolve(true));
    await checkBtn(page).click();
    await expect(page.locator('section.fb-good')).toBeVisible();
    const s3 = await state(page);
    const steps = page.locator('.manip .step-btn');
    for (const b of await steps.all()) await expect(b).toBeDisabled();
    expect(await state(page)).toBe(s3);
    await proceed(page);
    await expect.poll(async () => (await item(page))?.form !== 'manip' || (await page.locator('section.fb').count()) === 0).toBe(true);
  });
}

test('interactive exercise: the second miss shows the answer on the object', async ({ page }) => {
  await openOn(page, '#/lesson/coord/1?part=1', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'plot');
  for (let k = 0; k < 2; k += 1) {
    await page.evaluate(() => window.__madregotSolve(false));
    await checkBtn(page).click();
    if (k === 0) { await expect(page.locator('section.fb-retry')).toBeVisible(); await proceed(page); }
  }
  await expect(page.locator('section.fb-reveal')).toBeVisible();
  await expect(page.locator('.mp-ghost-pt')).toHaveCount(1); // the right place, drawn beside the student's point
  await expect(page.locator('.fb-answer')).toContainText('(');
});
