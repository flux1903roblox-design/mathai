// The interactive exercises: the student moves a maths object (a marker on a number line, a point, a line, a ray,
// the legs of a triangle, a bar) and the state is checked exactly. On every device: the object is whole on screen,
// a real drag moves it, the keyboard and the step buttons move it too, checking is off until it has been moved,
// and the "not yet" and "right" paths work with the object still in view.
import { test, expect } from '@playwright/test';
import { open, student, item, openOn, proceed, expectUsable, expectNoSidewaysScroll } from './helpers.js';

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
  // a drag that starts on the weights of the left pan takes one off that pan only (the beam then leans)
  ['balance', 'eq/2', '7', [0.33, 0.6, 0.33, 0.15]],
  // a drag along the number line moves the point of the ray (the side and the circle are toggles)
  ['ray', 'sys/5', '8', [0.5, 0.5, 0.78, 0.5]],
  ['plot', 'sys/2', '8', [0.5, 0.5, 0.75, 0.25], (it) => !!it.manip.lines, 'the meeting point of two lines'],
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

// In a check nothing on screen says the target is reached: the live mean, the sum of the squares and the angle at C
// are hidden, so the object cannot be slid until two numbers match. Practice keeps them.
test('in a mastery check, the objects hide the live result; in practice they show it', async ({ page }) => {
  await openOn(page, '#/lesson/stats/3?kind=check&purpose=mastery', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'bars');
  await expect(page.locator('.manip-bars .manip-readout')).not.toContainText('הממוצע עכשיו');
  await expect(page.locator('.mp-mean-line')).toHaveCount(0);
  await expect(page.locator('.manip-coach')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('check-bars.png') });
  await openOn(page, '#/lesson/pyth/1?kind=check&purpose=mastery', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'squares');
  await expect(page.locator('.mp-area.c')).toHaveText('?');
  await expect(page.locator('.manip-squares .manip-readout .sq-c')).toHaveText('?');
  await openOn(page, '#/lesson/angles/3?kind=check&purpose=mastery', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'triangle');
  await expect(page.locator('.manip-triangle .manip-readout .tri-c')).toContainText('?');
  // practice: the same objects with their live readouts
  await openOn(page, '#/lesson/stats/3', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'bars');
  await expect(page.locator('.manip-bars .manip-readout')).toContainText('הממוצע עכשיו');
  await expect(page.locator('.mp-mean-line')).toHaveCount(1);
});

// The algebra objects the same way: in a check the balance does not lean or write = and ≠ (keeping it level is the
// student's reasoning), and the ray is not read back as an inequality. Practice keeps both.
test('in a mastery check, the balance and the ray hide whether the target is reached', async ({ page }) => {
  await openOn(page, '#/lesson/eq/2?kind=check&purpose=mastery', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'balance');
  await expect(page.locator('.manip-balance .manip-readout')).toHaveCount(0);
  await expect(page.locator('.manip-coach')).toHaveCount(0);
  // one weight off one pan only: in practice the beam would lean
  await page.locator('.manip-balance [data-group="l1"][role="button"], .manip-balance [data-group="r1"][role="button"]').first().press('Enter');
  await expect(page.locator('.manip-balance.leaning')).toHaveCount(0);
  await expect(page.locator('.manip-balance .manip-canvas')).not.toHaveAttribute('aria-label', /מאוזנים|למטה/);
  await openOn(page, '#/lesson/sys/5?kind=check&purpose=mastery', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'ray');
  await expect(page.locator('.manip-ray .manip-readout')).toHaveCount(0);
  // practice: the scale leans after a one-sided move, and the ray is read as an inequality
  await openOn(page, '#/lesson/eq/2', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'balance');
  await expect(page.locator('.manip-balance .manip-readout')).toBeVisible();
  await page.locator('.manip-balance [data-group="l1"][role="button"], .manip-balance [data-group="r1"][role="button"]').first().press('Enter');
  await expect(page.locator('.manip-balance.leaning')).toHaveCount(1);
  await openOn(page, '#/lesson/sys/5', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'ray');
  await expect(page.locator('.manip-ray .manip-readout')).toBeVisible();
});

// The objects that only teach (algebra tiles in collecting like terms, the rectangle of the distributive law) are not
// practice items, so they are driven here inside their stair's discover step: a real tap or drag, the step buttons and
// the arrow keys move them, a wrong state is "not yet", the right one is accepted.
for (const [kind, route, [fx, fy, tx, ty]] of [['tiles', 'expr/3', [0.5, 0.3, 0.52, 0.3]], ['area', 'expr/4', [0.24, 0.78, 0.24, 0.3]]]) {
  test(`teaching object: ${kind}`, async ({ page }) => {
    await open(page, `#/learn/${route}/A`, student('7'));
    for (let i = 0; i < 12; i += 1) {
      await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
      const st = await page.evaluate(() => window.__madregotStep);
      if (st.kind === 'explore' && st.manip.kind === kind) break;
      if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
      const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
      await page.locator('.sp-next').click();
      await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
    }
    const canvas = page.locator('.ls-explore .manip-canvas');
    await expectNoSidewaysScroll(page);
    await expectUsable(page, canvas, 'the maths object');
    const box = await canvas.boundingBox();
    expect(box.height, 'the object is large enough to work with').toBeGreaterThanOrEqual(120);
    for (const b of await page.locator('.ls-explore .manip .step-btn').all()) {
      const r = await b.boundingBox();
      expect(Math.min(r.width, r.height), 'step buttons are thumb-sized').toBeGreaterThanOrEqual(40);
    }
    const look = () => page.evaluate(() => `${document.querySelector('.ls-explore .manip-canvas').getAttribute('aria-label')}|${document.querySelector('.ls-explore .manip-readout')?.textContent}`);
    // a real tap or drag on the drawing
    const before = await look();
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + box.width * (fx + (tx - fx) * i / 8), box.y + box.height * (fy + (ty - fy) * i / 8));
    await page.mouse.up();
    await expect.poll(look, 'the drag moved the object').not.toBe(before);
    // the step buttons and the arrow keys
    const s1 = await look();
    await page.locator('.ls-explore .manip .step-btn:not(:disabled)').first().click();
    await expect.poll(look, 'a step button moved the object').not.toBe(s1);
    const s2 = await look();
    await canvas.focus();
    await page.keyboard.press('ArrowUp');
    if (await look() === s2) await page.keyboard.press('ArrowDown');
    await expect.poll(look, 'arrow keys moved the object').not.toBe(s2);
    // not there yet, then there
    // (the moves above never end on the goal: tiles keep a zero pair of units, the rectangle is 6 or 5 high)
    await page.locator('.lm-check').click();
    await expect(page.locator('.lm-actions.has-good')).toHaveCount(0);
    await page.evaluate(() => window.__madregotSolveStep());
    await page.locator('.lm-check').click();
    await expect(page.locator('.lm-actions.has-good')).toBeVisible();
  });
}
