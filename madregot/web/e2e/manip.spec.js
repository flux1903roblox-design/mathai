// The interactive exercises: the student moves a maths object (a marker on a number line, a point, a line, a ray,
// the legs of a triangle, a bar) and the state is checked exactly. On every device: the object is whole on screen,
// a real drag moves it, the keyboard and the step buttons move it too, checking is off until it has been moved,
// and the "not yet" and "right" paths work with the object still in view.
import { test, expect } from '@playwright/test';
import { open, student, item, openOn, answer, proceed, expectUsable, expectNoSidewaysScroll } from './helpers.js';
import { textContrastFailures } from './contrast.js';
import { expectNoAxeViolations } from './axe.js';

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
  // a line cut into thirds to sixths: the marker moves one part at a time (fractions floor, frac:1 "place")
  ['numberline', 'frac/1', '7', [0.06, 0.75, 0.7, 0.75], (it) => !!it.manip.den, 'a fraction on a cut number line'],
  // the fraction bar cut so two marks fall on lines: a common denominator, built (frac:3 "common")
  ['fbar', 'frac/3', '7', [0.1, 0.5, 0.9, 0.5], (it) => it.answer?.mode === 'common', 'a common number of parts on the fraction bar'],
  // the pitcher on a double number line: the marker moves along the water line until the sugar under it is right (ratio:3)
  ['dline', 'ratio/3', '8', [0.1, 0.35, 0.6, 0.35], (it) => it.manip.move === 't', 'a proportion on the double number line'],
  // the percent bar stretched: the marker stays at p%, a drag along the bottom line moves its end (pct:4 "find the whole")
  ['dline', 'pct/4', '8', [0.5, 0.72, 0.85, 0.72], (it) => it.manip.move === 'max', 'the whole, by stretching the percent bar'],
  // a story drawn as a graph: a drag in a point's column moves that point to the finger's height (func:1 drawStory)
  ['graph', 'func/1', '8', [0.62, 0.6, 0.62, 0.25], (it) => it.answer?.mode === 'shape', 'a story drawn as a situation graph'],
  // a function's table drawn point by point: a drag in a column moves that point (func:2 drawTable)
  ['graph', 'func/2', '8', [0.62, 0.6, 0.62, 0.25], (it) => it.answer?.mode === 'values', 'a table of a function drawn as a graph'],
  // a graph drawn to a named shape, up, flat and down: a drag in a column moves that point (func:3 drawShape)
  ['graph', 'func/3', '8', [0.62, 0.6, 0.62, 0.25], (it) => it.answer?.mode === 'shape', 'a graph drawn to rise, stay and fall'],
  // a uniform rate continued from two given minutes: a drag in a free column moves that point (func:4 continueRate)
  ['graph', 'func/4', '8', [0.62, 0.6, 0.62, 0.25], (it) => it.answer?.mode === 'values', 'a uniform rate continued on a graph'],
  // the grid object (stage 2), first used by area: a drag anywhere puts the rectangle's corner there (area:1 "build a
  // rectangle"), and a drag on the parallelogram's triangle slides it a whole number of cells (area:4)
  ['polygon', 'area/1', '7', [0.15, 0.85, 0.55, 0.45], (it) => it.manip.task === 'rect', 'a rectangle on the grid, its corner dragged'],
  ['polygon', 'area/4', '7', [0.2, 0.6, 0.75, 0.6], (it) => it.manip.task === 'move', "the parallelogram's triangle moved across"],
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

// the grid object on the smallest phone: the drawing keeps room to work in, its corner follows a finger, and nothing
// scrolls sideways (MEASURE-1 e2e)
test('the grid object on a 320×568 phone: tall enough, its corner dragged, no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openOn(page, '#/lesson/area/1?part=1', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'polygon' && it.manip.task === 'rect');
  await expectNoSidewaysScroll(page);
  const canvas = page.locator('.manip-canvas');
  const box = await canvas.boundingBox();
  expect(box.height, 'the grid is at least 160px high on the smallest phone').toBeGreaterThanOrEqual(160);
  const read = () => canvas.getAttribute('aria-valuetext');
  const before = await read();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.85);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + box.width * (0.15 + 0.45 * i / 8), box.y + box.height * (0.85 - 0.45 * i / 8));
  await page.mouse.up();
  await expect.poll(read, 'the corner followed the finger').not.toBe(before);
  expect(await read()).toMatch(/^מלבן ברוחב \d+ ובגובה \d+ משבצות/);
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: test.info().outputPath('grid-phone-small.png') });
});

// the net object (stage 3), first used by solid:1. In the teaching (discover 2) its Stepper folds the box's net closed a
// quarter at a time (the drawing itself takes no drag, so the page still scrolls under a finger); in practice (so1n) a
// tap on the face opposite the shaded one is right.
async function toFold(page) {
  await open(page, '#/learn/solid/1/A', student('7', { goalXp: 50 }));
  await expect.poll(() => page.evaluate(() => window.__madregotStep?.kind)).toBe('say');
  await page.locator('.sp-next').click();
  await expect.poll(() => page.evaluate(() => window.__madregotStep?.kind)).toBe('explore');
  await expect(page.locator('.ls-explore .manip')).toBeVisible();
  // the step before has finished leaving (its card slides out, and on a narrow phone it may stick out while it goes)
  await expect(page.locator('.sp-say')).toHaveCount(0);
  // and this one has come in whole: on a busy machine its card can still stick out by a few pixels for a moment
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  return page.locator('.ls-explore .manip-canvas');
}

test('the net object (solid:1 discover 2): the fold Stepper to 100% closes the box', async ({ page }) => {
  const canvas = await toFold(page);
  await expect(canvas).toHaveAttribute('aria-valuenow', '0');
  const more = page.getByRole('button', { name: 'לקפל עוד רבע', exact: true });
  for (const want of ['25', '50', '75', '100']) {
    await more.click();
    await expect(canvas).toHaveAttribute('aria-valuenow', want);
  }
  await expect(canvas).toHaveAttribute('aria-valuetext', /התיבה סגורה/);
  await expect(more).toBeDisabled();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: test.info().outputPath('net-fold-closed.png') });
});

test('the net object on a 320×568 phone: tall enough, its Stepper thumb-sized, no sideways scroll while it folds', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const canvas = await toFold(page);
  await expectNoSidewaysScroll(page);
  const box = await canvas.boundingBox();
  expect(box.height, 'the net is at least 160px high on the smallest phone').toBeGreaterThanOrEqual(160);
  for (const b of await page.locator('.ls-explore .step-btn').all()) {
    const s = await b.boundingBox();
    expect(Math.min(s.width, s.height), 'the fold buttons are thumb-sized').toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'לקפל עוד רבע', exact: true }).click();
  await page.getByRole('button', { name: 'לקפל עוד רבע', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-valuenow', '50');
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: test.info().outputPath('net-fold-phone-small.png') });
});

test('the net object in practice (solid:1): a tap on the face opposite the shaded one is right', async ({ page }) => {
  const it = await openOn(page, '#/lesson/solid/1?part=1', student('7'), (x) => x.form === 'manip' && x.manip.kind === 'net' && x.manip.task === 'face');
  await expectNoSidewaysScroll(page);
  await expect(checkBtn(page)).toBeDisabled();
  await page.getByRole('button', { name: `פאה ${it.answer.face}`, exact: true }).click();
  await checkBtn(page).click();
  await expect(page.locator('section.fb-good')).toBeVisible();
});

// the circle object (stage 4), first used by circle:1 (discover 2): its Stepper rolls the wheel one turn along the line, a
// quarter at a time (the drawing takes no drag for the roll, so the page still scrolls under a finger)
async function toRoll(page) {
  await open(page, '#/learn/circle/1/A', student('8', { goalXp: 50 }));
  await expect.poll(() => page.evaluate(() => window.__madregotStep?.kind)).toBe('say');
  await page.locator('.sp-next').click();
  await expect.poll(() => page.evaluate(() => window.__madregotStep?.kind)).toBe('explore');
  await expect(page.locator('.ls-explore .manip')).toBeVisible();
  // the step before has finished leaving (its card slides out, and on a narrow phone it may stick out while it goes)
  await expect(page.locator('.sp-say')).toHaveCount(0);
  // and this one has come in whole: on a busy machine its card can still stick out by a few pixels for a moment
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  return page.locator('.ls-explore .manip-canvas');
}

test('the circle object (circle:1 discover 2): the roll Stepper to 100% unrolls one turn, a little past three diameters', async ({ page }) => {
  const canvas = await toRoll(page);
  await expect(canvas).toHaveAttribute('aria-valuenow', '0');
  await expect(canvas).toHaveAttribute('aria-valuetext', /לא מגולגל/);
  const more = page.getByRole('button', { name: 'לגלגל קדימה רבע סיבוב', exact: true });
  for (const want of ['25', '50', '75', '100']) {
    await more.click();
    await expect(canvas).toHaveAttribute('aria-valuenow', want);
  }
  await expect(canvas).toHaveAttribute('aria-valuetext', /מגולגל עד הסוף/);
  await expect(more).toBeDisabled();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: test.info().outputPath('circle-roll-done.png') });
});

test('the circle object on a 320×568 phone: tall enough, its Steppers thumb-sized, no sideways scroll while it rolls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const canvas = await toRoll(page);
  // once the step has come in (its card slides in from the side), nothing scrolls sideways
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), { message: 'page scrolls sideways' }).toBeLessThanOrEqual(0);
  const box = await canvas.boundingBox();
  expect(box.height, 'the circle and its line are at least 160px high on the smallest phone').toBeGreaterThanOrEqual(160);
  for (const b of await page.locator('.ls-explore .step-btn').all()) {
    const s = await b.boundingBox();
    expect(Math.min(s.width, s.height), 'the radius and roll buttons are thumb-sized').toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'לגלגל קדימה רבע סיבוב', exact: true }).click();
  await page.getByRole('button', { name: 'לגלגל קדימה רבע סיבוב', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-valuenow', '50');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'לגלגל קדימה רבע סיבוב', exact: true }).click();
  await page.getByRole('button', { name: 'לגלגל קדימה רבע סיבוב', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-valuenow', '100');
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: test.info().outputPath('circle-roll-phone-small.png') });
});

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

// The still figure of ratio:1's first steps: the scouts as dots in rows of five, each row named, readable on every phone
// and read out in full to a screen reader (2 instructors, 10 scouts).
test('teaching figure: groups (ratio:1, the scouts)', async ({ page }) => {
  await open(page, '#/learn/ratio/1/A', student('8'));
  const fig = page.locator('.step-player svg.fg-groups').first();
  await expect(fig).toBeVisible();
  await expect(fig).toHaveAttribute('aria-label', 'קבוצות: מדריכים 2, חניכים 10');
  await expect(fig.locator('circle')).toHaveCount(12);
  await expect(fig.locator('text')).toHaveText(['מדריכים', 'חניכים']);
  await expectNoSidewaysScroll(page);
  const box = await fig.boundingBox();
  expect(box.width, 'the rows fit the screen').toBeLessThanOrEqual(page.viewportSize().width);
  expect(box.height, 'the dots are large enough to count').toBeGreaterThanOrEqual(60);
  // the next step asks about the same rows, and the right choice is accepted
  await page.locator('.sp-next').click();
  const st = await page.evaluate(() => window.__madregotStep);
  expect(st.kind).toBe('predict');
  await expect(page.locator('.step-player svg.fg-groups')).toBeVisible();
  await page.locator('.ls-choice').nth(st.answer).click();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
});

// The objects that only teach (algebra tiles in collecting like terms, the rectangle of the distributive law) are not
// practice items, so they are driven here inside their stair's discover step: a real tap or drag, the step buttons and
// the arrow keys move them, a wrong state is "not yet", the right one is accepted.
// the fraction bar (frac:1, discover step 7): a drag along the bar shades parts, ↑ shades one more
for (const [kind, route, [fx, fy, tx, ty]] of [['tiles', 'expr/3', [0.5, 0.3, 0.52, 0.3]], ['area', 'expr/4', [0.24, 0.78, 0.24, 0.3]], ['fbar', 'frac/1', [0.1, 0.5, 0.9, 0.5]]]) {
  test(`teaching object: ${kind}`, async ({ page }) => {
    await open(page, `#/learn/${route}/A`, student('7'));
    for (let i = 0; i < 12; i += 1) {
      await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
      const st = await page.evaluate(() => window.__madregotStep);
      if (st.kind === 'explore' && st.manip.kind === kind) break;
      if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
      // an object of another kind on the way: solve it as a student would, and check
      if (st.kind === 'explore') {
        await expect.poll(() => page.evaluate(() => !!window.__madregotSolveStep && window.__madregotSolveStep.forStep === window.__madregotStep)).toBe(true);
        await page.evaluate(() => window.__madregotSolveStep());
        await page.locator('.lm-check').click();
      }
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

// STUDENT-9 §2 (council: "elementFromPoint at the centre of 'הסמן שמאלה' returned 'lm-banner'"): after a wrong check in
// a teaching step, the number line and its buttons sit above the "not yet" sheet, on the council's phone and the smallest.
for (const [w, h] of [[390, 664], [320, 568]]) {
  test(`teaching step at ${w}×${h}: the number line's buttons stay above the "not yet" sheet`, async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'the viewport is set here');
    await page.setViewportSize({ width: w, height: h });
    await open(page, '#/learn/signed/1/A', student('7'));
    for (let i = 0; i < 12; i += 1) {
      await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
      const st = await page.evaluate(() => window.__madregotStep);
      if (st.kind === 'explore' && st.manip.kind === 'numberline') break;
      if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
      const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
      await page.locator('.sp-next').click();
      await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
    }
    // the wrong way (the step asks for 5 steps to the right), then check
    await page.getByRole('button', { name: 'הסמן שמאלה' }).click();
    await page.locator('.lm-check').click();
    await expect(page.locator('.lm-actions.has-warm')).toBeVisible();
    // the sheet is short: its first sentence, the rest behind "עוד"
    await expect(page.locator('.lm-actions .bl-why-text')).toHaveText(/^חיבור של מספר חיובי מזיז ימינה\.\s*עוד$/);
    for (const name of ['הסמן שמאלה', 'הסמן ימינה']) {
      const btn = page.getByRole('button', { name });
      // the centre answers a tap, and the whole button is above the sheet and below the header
      await expect.poll(() => btn.evaluate((el) => {
        const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const sheet = document.querySelector('.lm-actions').getBoundingClientRect(); const head = document.querySelector('.bl-head').getBoundingClientRect();
        return !!hit && (hit === el || el.contains(hit)) && r.bottom <= sheet.top + 1 && r.top >= head.bottom - 1;
      }), `${name} is whole and not under the sheet`).toBe(true);
    }
    await page.screenshot({ path: test.info().outputPath(`numberline-not-yet-${w}.png`) });
    // the rest of the help opens in place
    await page.getByRole('button', { name: 'עוד', exact: true }).click();
    await expect(page.locator('.lm-actions .bl-why-text')).toContainText('ספרו 5 צעדים');
    await expect(page.locator('.bl-why-more')).toBeFocused(); // the keyboard keeps its place
    // and the buttons move the marker again
    await page.getByRole('button', { name: 'הסמן ימינה' }).click();
    await expect(page.locator('.lm-actions.has-warm')).toHaveCount(0);
  });
}

// ---------------------------------------------------------------- the data unit's two objects (DATA-2, on DATA-4's routes)
// A run of a random experiment (simulate) and a chart built (chart), where a student meets them: data:4's teaching and
// practice, data:1's bar chart, data:3's pie. On a phone and on the small phone: each is whole on screen, nothing scrolls
// sideways, and the buttons a finger presses are in view.

/** Walk a stair's teaching to its first explore step, answering the steps before it right. */
async function toExplore(page, route, grade) {
  await open(page, route, student(grade));
  await expect(page.locator('.step-player')).toBeVisible();
  for (let i = 0; i < 12; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.kind === 'explore') {
      await expect(page.locator('.ls-explore .manip')).toBeVisible();
      // the step before may still be sliding out (the step card enters from 24px aside): the page settles first (review:
      // a check of sideways scroll right after this failed once by the 4px still to slide)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      return st;
    }
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); await expect(page.locator('.lm-actions.has-good')).toBeVisible(); }
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await page.locator('.sp-next').click();
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  throw new Error(`no explore step in ${route}`);
}
const simBtn = (page, k) => page.locator('.manip-simulate .mp-sim-btn').nth(k);
const simRows = (page) => page.locator('.manip-simulate .mp-sim-table tbody tr').allTextContents();

test('simulate (data:4 teaching): 100 opens after 10 and 1000 after 100, and each batch changes the table', async ({ page }) => {
  await toExplore(page, '#/learn/data/4/A', '8');
  const sim = page.locator('.ls-explore .manip-simulate');
  await expectNoSidewaysScroll(page);
  // guided: only 10 is open; a locked button says what comes first
  await expect(simBtn(page, 0)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(simBtn(page, 1)).toHaveAttribute('aria-disabled', 'true');
  await expect(simBtn(page, 1)).toContainText('קודם 10');
  await expect(simBtn(page, 2)).toHaveAttribute('aria-disabled', 'true');
  await expect(simBtn(page, 2)).toContainText('קודם 100');
  await sim.locator('.mp-sim-more').click();
  await expect(sim.locator('.mp-sim-table')).toBeVisible();
  const empty = await simRows(page);
  // pressing a locked batch runs nothing (it is aria-disabled, so the press is forced)
  await simBtn(page, 2).click({ force: true });
  expect(await simRows(page)).toEqual(empty);
  await simBtn(page, 0).click();
  await expect.poll(() => simRows(page)).not.toEqual(empty);
  await expect(simBtn(page, 1)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(simBtn(page, 2)).toHaveAttribute('aria-disabled', 'true');
  const ten = await simRows(page);
  await simBtn(page, 1).click();
  await expect.poll(() => simRows(page)).not.toEqual(ten);
  await expect(simBtn(page, 2)).not.toHaveAttribute('aria-disabled', 'true');
  const more = await simRows(page);
  await simBtn(page, 2).click();
  await expect.poll(() => simRows(page)).not.toEqual(more);
  // 1110 spins: the readout says so, and the step can be checked
  await expect(sim.locator('.mp-sim-small')).toContainText('מתוך 1110');
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test('simulate at 320 × 568: the object is at most 300px tall and its buttons are in view', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await toExplore(page, '#/learn/data/4/A', '7');
  await expectNoSidewaysScroll(page);
  const box = await page.locator('.ls-explore .manip-simulate').boundingBox();
  expect(box.height, 'the simulate object').toBeLessThanOrEqual(300);
  for (let k = 0; k < 4; k += 1) {
    const b = simBtn(page, k);
    await expect(b).toBeInViewport();
    const r = await b.boundingBox();
    expect(Math.min(r.width, r.height), 'a batch button is thumb-sized').toBeGreaterThanOrEqual(44);
  }
  await simBtn(page, 0).click(); await simBtn(page, 1).click(); await simBtn(page, 2).click();
  await expect(page.locator('.manip-simulate .mp-sim-small')).toContainText('מתוך 1110');
  expect((await page.locator('.ls-explore .manip-simulate').boundingBox()).height).toBeLessThanOrEqual(300);
  await expectNoSidewaysScroll(page);
});

test('simulate (data:4 practice): the covered wheel\'s part is right after many spins; a wrong pick after a few is "few trials"', async ({ page }) => {
  const est = (it) => it.form === 'manip' && it.manip.kind === 'simulate' && it.answer?.mode === 'estimate';
  const it = await openOn(page, '#/lesson/data/4?part=1', student('7'), est);
  await expectNoSidewaysScroll(page);
  await expect(checkBtn(page)).toBeDisabled();
  // the right part: the watched sector's share of the wheel, after 10 + 100 + 1000 spins
  for (let k = 0; k < 3; k += 1) await simBtn(page, k).click();
  await page.locator('.mp-sim-choice').nth(it.answer.answer).click();
  await checkBtn(page).click();
  await expect(page.locator('section.fb-good')).toBeVisible();
  await proceed(page);
  // the next one: ten spins and a wrong pick name the mistake of trusting a few trials
  const next = await openOn(page, '#/lesson/data/4?part=1', student('7'), est);
  await simBtn(page, 0).click();
  await page.locator('.mp-sim-choice').nth((next.answer.answer + 1) % next.answer.choices.length).click();
  await checkBtn(page).click();
  await expect(page.locator('section.fb-retry')).toBeVisible();
  // on a short screen the panel is folded under the object until "רמז" opens it
  const more = page.locator('section.fb-folded').getByRole('button', { name: 'רמז', exact: true });
  if (await more.count()) await more.click();
  await expect(page.locator('section.fb-retry')).toContainText('סמכו על מעט ניסויים כאילו הם נותנים את ההסתברות');
});

// DATA-6: two dice thrown many times (prob:3), in the teaching and in practice, where the documented errors are choices
test('simulate dice2 (prob:3 teaching) at 320 × 568: sums of two dice, 1110 throws, whole on screen, the step checked', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const st = await toExplore(page, '#/learn/prob/3/A', '8');
  expect(st.manip).toMatchObject({ kind: 'simulate', device: 'dice2', watch: 7 });
  // the step before (the 6 × 6 table) may still be sliding out: wait for the page to settle, then nothing scrolls sideways
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expectNoSidewaysScroll(page);
  const sim = page.locator('.ls-explore .manip-simulate');
  expect((await sim.boundingBox()).height, 'the simulate object').toBeLessThanOrEqual(300);
  for (let k = 0; k < 3; k += 1) { await expect(simBtn(page, k)).toBeInViewport(); await simBtn(page, k).click(); }
  await expect(sim.locator('.mp-sim-small')).toContainText('מתוך 1110');
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test('simulate dice2 (prob:3 practice): 1/11 after many throws names the equally likely sums', async ({ page }) => {
  const est = (it) => it.form === 'manip' && it.manip.kind === 'simulate' && it.manip.device === 'dice2' && it.answer?.mode === 'estimate';
  const it = await openOn(page, '#/lesson/prob/3?part=1', student('8'), est);
  await expectNoSidewaysScroll(page);
  for (let k = 0; k < 3; k += 1) await simBtn(page, k).click();
  const sums = it.answer.choices.findIndex((c) => c.tag === 'equiprob-sums');
  expect(sums).toBeGreaterThanOrEqual(0);
  await page.locator('.mp-sim-choice').nth(sums).click();
  await checkBtn(page).click();
  await expect(page.locator('section.fb-retry')).toBeVisible();
  const more = page.locator('section.fb-folded').getByRole('button', { name: 'רמז', exact: true });
  if (await more.count()) await more.click();
  await expect(page.locator('section.fb-retry')).toContainText('חשבו שכל הסכומים של שתי קוביות שווי סיכוי');
});

/** The owner of each slice the pie draws, clockwise from 12 o'clock (−1: grey). */
const piePainted = (pie) => pie.locator('[data-slice]').evaluateAll((els) => els.map((e) => Number(e.dataset.owner)));
/** The middle of slice s of a pie of `parts`, in screen pixels (at 60% of the radius). */
async function sliceAt(pie, s, parts) {
  const b = await pie.locator('svg.mp-chart-pie').boundingBox(); const a = ((s + 0.5) * 2 * Math.PI) / parts;
  const r = 0.6 * b.width * (100 / 216);
  return [b.x + b.width / 2 + r * Math.sin(a), b.y + b.height / 2 - r * Math.cos(a)];
}
/** Each element is inside the maths region (the part of the lesson that scrolls) at once: [what, top, bottom] off it. */
const outsideRegion = (page, sels) => page.evaluate((list) => {
  const m = document.querySelector('.lesson-main').getBoundingClientRect();
  return list.flatMap((sel) => [...document.querySelectorAll(sel)].map((el) => ({ sel, r: el.getBoundingClientRect() })))
    .filter(({ r }) => r.top < m.top - 1 || r.bottom > m.bottom + 1).map(({ sel, r }) => `${sel} ${Math.round(r.top)}-${Math.round(r.bottom)} (region ${Math.round(m.top)}-${Math.round(m.bottom)})`);
}, sels);

test('chart (data:3 practice): a tap on a grey slice colours that slice for the chosen category, while a later one has slices', async ({ page }) => {
  const it = await openOn(page, '#/lesson/data/3?part=1', student('7'), (x) => x.form === 'manip' && x.manip.kind === 'chart' && x.manip.mode === 'pie' && x.manip.cats.length >= 3);
  const parts = it.manip.pie.parts; const grey = Array(parts - 5).fill(-1);
  const pie = page.locator('.manip-chart-pie'); const chips = pie.locator('.mp-chart-chip');
  const plus = pie.getByRole('button', { name: /^לצבוע עוד חלק ל/ });
  // the first category two slices, the second three after them: the rest is grey
  await chips.nth(0).click(); await plus.click(); await plus.click();
  await chips.nth(1).click(); for (let k = 0; k < 3; k += 1) await plus.click();
  await expect.poll(() => piePainted(pie)).toEqual([0, 0, 1, 1, 1, ...grey]);
  // the first category again, and a tap on a grey slice past 6 o'clock: that slice is its, nothing else moves (review:
  // the tapped slice took the second category's colour, and a slice at the top changed)
  await chips.nth(0).click();
  const s = Math.floor(parts / 2) + 1;
  const [x, y] = await sliceAt(pie, s, parts);
  await page.mouse.click(x, y);
  const want = [0, 0, 1, 1, 1, ...grey]; want[s] = 0;
  await expect.poll(() => piePainted(pie), 'the tapped slice, and only it').toEqual(want);
  await expect(chips.nth(0)).toHaveAttribute('aria-valuenow', '3');
  await expect(chips.nth(1)).toHaveAttribute('aria-valuenow', '3');
  await expect(checkBtn(page)).toBeEnabled();
  // the same slice tapped again is given back
  await page.mouse.click(x, y);
  await expect.poll(() => piePainted(pie)).toEqual([0, 0, 1, 1, 1, ...grey]);
  // + takes the next grey slice after the category's last one (marked on the rim): slice 5, after the second's three
  await plus.click();
  await expect.poll(() => piePainted(pie)).toEqual([0, 0, 1, 1, 1, 0, ...grey.slice(1)]);
  await expectNoSidewaysScroll(page);
});

test('chart (data:3 practice): the pie is 200px across (160 on the small phone) beside its chips, and the whole object fits the maths region', async ({ page }, info) => {
  const small = info.project.name === 'phone-small';
  // the tallest pie: four categories (the source table five rows), 20 parts
  await open(page, '#/lesson/data/3?part=1', student('7'), '41');
  await expect.poll(() => item(page)).toBeTruthy();
  const it = await item(page);
  expect(it.manip, 'seed 41 opens a pie of four categories in 20 parts (if the generators change, find another seed)').toMatchObject({ kind: 'chart', mode: 'pie', pie: { parts: 20 } });
  expect(it.manip.cats).toHaveLength(4);
  await expectNoSidewaysScroll(page);
  const pie = page.locator('.manip-chart-pie');
  // review: the pie was 120px on both phones, shrunk to fit under the source table
  const circle = await pie.locator('circle.fig-ch-rim').boundingBox();
  expect(circle.width, 'the pie across').toBeGreaterThanOrEqual(small ? 158 : 198);
  for (const chip of await pie.locator('.mp-chart-chip').all()) {
    const b = await chip.boundingBox();
    expect(Math.min(b.width, b.height), 'a chip is thumb-sized').toBeGreaterThanOrEqual(44);
  }
  const object = ['.manip-chart-pie .mp-chart-read', '.manip-chart-pie svg.mp-chart-pie', '.manip-chart-pie .mp-chart-chip', '.manip-chart-pie .manip-controls'];
  // on the phone it is all in view as the question opens; on the small phone the source table fills the top, and choosing
  // a category brings the Stepper (the main path) into view with the pie and the chips above it
  if (small) await pie.locator('.mp-chart-chip').nth(1).click();
  await expect.poll(() => outsideRegion(page, object), 'the readout, the pie, every chip and the Stepper at once').toEqual([]);
  await expectUsable(page, pie.getByRole('button', { name: /^לצבוע עוד חלק ל/ }), 'the + of the Stepper');
  await page.screenshot({ path: test.info().outputPath(`chart-pie-${info.project.name}.png`) });
  // the whole page never scrolls: the maths region does
  const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
});

test('chart (data:1 practice): a bar chart\'s words stay 14px, each bar is a 44px column, a drag changes it, and it fits the maths region', async ({ page }, info) => {
  const small = info.project.name === 'phone-small';
  await openOn(page, '#/lesson/data/1?part=1', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'chart' && it.manip.mode !== 'pie');
  await expectNoSidewaysScroll(page);
  const chart = page.locator('.manip-chart-bar');
  const canvas = chart.locator('.manip-canvas');
  // review: at 320 the drawing was at 60% and its names and numbers 10px; they are HTML now, at a fixed size
  const scale = await canvas.evaluate((svg) => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width);
  expect(scale, 'the drawing is not shrunk').toBeGreaterThanOrEqual(0.85);
  const words = await chart.evaluate((el) => [...el.querySelectorAll('.mp-chart-cat, .mp-chart-num, .mp-chart-title')].map((t) => ({ t: t.textContent, px: parseFloat(getComputedStyle(t).fontSize), h: t.getBoundingClientRect().height })));
  expect(words.length).toBeGreaterThanOrEqual(4 + 3);
  for (const w of words) expect(w.px, `"${w.t}"`).toBeGreaterThanOrEqual(14);
  // each name under its own bar, each bar's column at least 44px wide
  const cols = await chart.locator('.mp-chart-slot').evaluateAll((gs) => gs.map((g) => g.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, w: r.width })));
  const names = await chart.locator('.mp-chart-cat').evaluateAll((ns) => ns.map((n) => { const r = n.getBoundingClientRect(); return (r.left + r.right) / 2; }));
  cols.forEach((c, i) => {
    expect(c.w, `bar ${i}'s column`).toBeGreaterThanOrEqual(44);
    expect(names[i] > c.l && names[i] < c.r, `name ${i} under its bar`).toBe(true);
  });
  // a drag on the first bar, from the bottom up, changes its value
  const read = () => chart.locator('.mp-chart-read').textContent();
  const before = await read();
  const box = await canvas.boundingBox(); const slot = await chart.locator('.mp-chart-slot').first().boundingBox();
  await page.mouse.move(slot.x + slot.width / 2, box.y + box.height * 0.85);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(slot.x + slot.width / 2, box.y + box.height * (0.85 - 0.5 * i / 8));
  await page.mouse.up();
  await expect.poll(read, 'the drag changed the bar').not.toBe(before);
  await expect(checkBtn(page)).toBeEnabled();
  // a tap on a bar on the small phone brings the Stepper into view with the chart above it
  if (small) await page.mouse.click(slot.x + slot.width / 2, box.y + box.height * 0.5);
  await expect.poll(() => outsideRegion(page, ['.manip-chart-bar .mp-chart-read', '.manip-chart-bar .mp-chart-title', '.manip-chart-bar .manip-canvas', '.manip-chart-bar .mp-chart-cats', '.manip-chart-bar .manip-controls']), 'the chart and its Stepper at once').toEqual([]);
  await page.screenshot({ path: test.info().outputPath(`chart-bar-${info.project.name}.png`) });
  await expectNoSidewaysScroll(page);
});

test('chart (data:3 practice): a chip and + colour a slice of the pie', async ({ page }) => {
  await openOn(page, '#/lesson/data/3?part=1', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'chart' && it.manip.mode === 'pie');
  await expectNoSidewaysScroll(page);
  const pie = page.locator('.manip-chart-pie');
  const grey = () => pie.locator('.mp-chart-grey').count();
  const before = await grey();
  const chip = pie.locator('.mp-chart-chip:not(.fixed)').first();
  await chip.click();
  await expect(chip).toHaveClass(/\bon\b/);
  await pie.getByRole('button', { name: /^לצבוע עוד חלק ל/ }).click();
  await expect.poll(grey, 'one more slice is coloured').toBe(before - 1);
  await expect(checkBtn(page)).toBeEnabled();
  await expectNoSidewaysScroll(page);
});

// DATA-2 tests: "axe on both objects has no violation". The objects of the data unit, in the states a student sees them
// (a spinner run with its table open, the covered wheel, two dice, a bar chart and a pie being built), pass axe's WCAG
// 2.1 A/AA rules (e2e/axe.js, the packages lane's shared check, scoped to the object) and the repo's text contrast
// probe. a11y.spec.js scans the same objects with the whole page around them, in light and dark.
test('the data unit\'s objects pass axe (WCAG 2.1 A/AA) and the contrast probe: spinner, covered wheel, two dice, bars, pie', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'scanned on one phone');
  test.slow();
  const scan = async (sel, what) => {
    await expect(page.locator(sel)).toBeVisible();
    expect(await textContrastFailures(page, { root: sel }), `text under AA on ${what}`).toEqual([]);
    const r = await expectNoAxeViolations(page, { include: sel }, what);
    expect(r.passes.length, `axe ran its rules on ${what}`).toBeGreaterThan(5);
  };
  // the spinner in the teaching, after ten spins, its table open
  await toExplore(page, '#/learn/data/4/A', '7');
  await simBtn(page, 0).click();
  await page.locator('.ls-explore .mp-sim-more').click();
  await scan('.ls-explore .manip-simulate', 'the spinner');
  // the covered wheel in practice, after a hundred and ten spins
  await openOn(page, '#/lesson/data/4?part=1', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'simulate' && it.answer?.mode === 'estimate');
  await simBtn(page, 0).click(); await simBtn(page, 1).click();
  await scan('.manip-simulate', 'the covered wheel');
  // two dice in practice
  await openOn(page, '#/lesson/prob/3?part=1', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'simulate' && it.manip.device === 'dice2');
  await simBtn(page, 0).click();
  await scan('.manip-simulate', 'two dice');
  // a bar chart with a bar raised
  await openOn(page, '#/lesson/data/1?part=1', student('8'), (it) => it.form === 'manip' && it.manip.kind === 'chart' && it.manip.mode !== 'pie');
  await page.locator('.manip-chart-bar').getByRole('button', { name: /^להרים את העמודה של/ }).click();
  await scan('.manip-chart-bar', 'the bar chart');
  // a pie with a category coloured
  await openOn(page, '#/lesson/data/3?part=1', student('7'), (it) => it.form === 'manip' && it.manip.kind === 'chart' && it.manip.mode === 'pie');
  await page.locator('.manip-chart-pie .mp-chart-chip').first().click();
  await page.locator('.manip-chart-pie').getByRole('button', { name: /^לצבוע עוד חלק ל/ }).click();
  await scan('.manip-chart-pie', 'the pie');
});

// CLASSROOM-10: the angle tool with a whole angle, angles:6's second teaching step. A fixed ∢AOB = 110° and a ray OC
// turning inside it in 5° steps: a named slider read in words, ∢AOC + ∢COB written above it, moved by the arrow keys, a
// real drag and the 44px step buttons; the handle does not glide when motion is reduced (the config asks for it); the
// middle, 55° and 55°, is the right state.
test('the angle tool with a whole angle: a ray turning inside ∢AOB, by keys, drag and buttons', async ({ page }) => {
  await open(page, '#/learn/angles/6/A', student('7'));
  await expect(page.locator('.step-player')).toBeVisible();
  await page.locator('.sp-next').click(); // the first step says what a bisector is
  const tool = page.locator('.ls-explore .manip-angle.whole');
  await expect(tool).toBeVisible();
  const canvas = tool.locator('.manip-canvas');
  await expect(canvas).toHaveAttribute('role', 'slider');
  await expect(canvas).toHaveAttribute('aria-label', 'הקרן OC בתוך הזווית AOB');
  await expect(canvas).toHaveAttribute('aria-valuemax', '105');
  await expect(canvas).toHaveAttribute('aria-valuenow', '30');
  await expect(tool.locator('.manip-readout')).toContainText('∢AOC + ∢COB');
  await expect(tool.locator('.manip-readout')).toContainText('= 30° + 80° = 110°');
  await expectNoSidewaysScroll(page);
  await expectUsable(page, canvas, 'the angle tool');
  for (const b of await tool.locator('.step-btn').all()) { const s = await b.boundingBox(); expect(Math.min(s.width, s.height), 'step buttons are thumb-sized').toBeGreaterThanOrEqual(44); }
  // reduced motion: the handle moves at once (the app's rule leaves 0.01 ms, read back as 1e-05s)
  const glide = await tool.locator('.mp-point').evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(Math.max(...glide.split(',').map((t) => parseFloat(t))), `the handle's transition (${glide})`).toBeLessThan(0.001);
  // the keyboard: left turns the ray towards OB, right back towards OA
  await canvas.focus();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowLeft');
  await expect(canvas).toHaveAttribute('aria-valuenow', '60');
  await page.keyboard.press('ArrowRight');
  await expect(canvas).toHaveAttribute('aria-valuenow', '55');
  await expect(canvas).toHaveAttribute('aria-valuetext', 'הזווית AOC 55 מעלות, הזווית COB 55 מעלות');
  await expect(tool.locator('.manip-readout')).toContainText('= 55° + 55° = 110°');
  // a real drag: from the vertex's right towards OA lowers ∢AOC
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + box.width * (0.5 + 0.04 * i), box.y + box.height * (0.2 + 0.03 * i));
  await page.mouse.up();
  await expect.poll(async () => Number(await canvas.getAttribute('aria-valuenow'))).toBeLessThan(55);
  // the step buttons bring it back to the middle, and the middle is right
  const inc = tool.getByRole('button', { name: 'להגדיל את הזווית AOC ב־5 מעלות' });
  while (Number(await canvas.getAttribute('aria-valuenow')) < 55) await inc.click();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
});

// Stage 2 (MEASURE-1.4; CURRICULUM-11 item 1 for the three new objects): in practice, the first try of "build a
// rectangle with area S and perimeter P" (ar1b) shows the sides only, so it cannot be solved by stepping until the
// readout matches; after a miss the readout shows the area and the perimeter, and the feedback says so. The retry is an
// answer with help (lib/lesson.js: the hint is on after a first miss). The circle's radius exercise does the same.
test('a practice first try hides the grid\'s area and perimeter; after a miss they show, and the feedback says so', async ({ page }) => {
  const it = await openOn(page, '#/lesson/area/1?part=1', student('7'), (x) => x.form === 'manip' && x.manip.kind === 'polygon' && x.manip.task === 'rect');
  const readout = page.locator('.mp-grid-readout');
  await expect(readout).toContainText('רוחב');
  await expect(readout).not.toContainText('שטח');
  await expect(readout).not.toContainText('היקף');
  await expect(page.locator('.manip-canvas')).not.toHaveAttribute('aria-valuetext', /שטח|היקף/);
  await page.screenshot({ path: test.info().outputPath('readout-first-try.png') });
  await page.evaluate(() => window.__madregotSolve(false));
  await checkBtn(page).click();
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await expect(page.locator('section.fb-retry .readout-line')).toHaveText('עכשיו רואים גם את השטח ואת ההיקף. נסו שוב.');
  await page.screenshot({ path: test.info().outputPath('readout-after-miss.png') });
  await proceed(page);
  await expect(readout).toContainText('שטח');
  await expect(readout).toContainText('היקף');
  expect(it.key).toMatch(/^ar1/);
  await openOn(page, '#/lesson/circle/1?part=1', student('8'), (x) => x.form === 'manip' && x.manip.kind === 'circle');
  await expect(page.locator('.manip-readout').first()).toContainText('רדיוס');
  await expect(page.locator('.manip-readout').first()).not.toContainText('היקף');
});

// ---------------------------------------------------------------- curriculum stage 4: the transform object and the proof table

// GEOM-2 on the phones (390×844 and 320×568): the transform object in the transformations unit's practice. transf:1
// slides the copy (a drag in whole steps, the arrow buttons, the arrow keys), transf:2 flips it (in an axis, and in a
// line x = k, where a flip far from the line would leave the plane and is refused), transf:3 turns it about O. The
// copy's vertices are read from the drawing's name (practice names them; a check never does).
const isTf = (it) => it.form === 'manip' && it.manip.kind === 'transform';
const TF = [
  ['transf:1, a slide', 'transf/1', (it) => isTf(it) && !it.manip.moves.flips && !it.manip.moves.turns],
  ['transf:2, a flip in an axis', 'transf/2', (it) => isTf(it) && typeof it.manip.moves.flips?.[0] === 'string'],
  ['transf:2, a flip in a line x = k', 'transf/2', (it) => isTf(it) && it.manip.moves.flips?.[0]?.x != null],
  ['transf:3, a turn', 'transf/3', (it) => isTf(it) && !!it.manip.moves.turns],
];
/** The copy's vertices, read from the drawing's name ("… A′ ב־(1, −1), B′ ב־(4, −1) …"). */
const copyOf = (page) => page.locator('.manip-transform .manip-canvas').getAttribute('aria-label')
  .then((l) => [...l.replace(/−/g, '-').matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]));
const moved = (a, b) => b.map((p, i) => [p[0] - a[i][0], p[1] - a[i][1]]);
/** Open a practice item of this kind: the first exercise of a practice lesson, seed after seed. */
async function openTf(page, route, want) {
  for (let sd = 1; sd <= 60; sd += 1) {
    await open(page, `#/lesson/${route}?part=1`, student('7'), String(sd));
    await expect.poll(() => item(page)).toBeTruthy();
    const it = await item(page);
    if (want(it)) { await expect(page.locator('.manip-transform .mp-tf-controls')).toBeVisible(); return it; }
  }
  throw new Error(`no practice item of this kind in ${route}`);
}

for (const [name, route, want] of TF) {
  test(`the transform object: ${name}`, async ({ page }) => {
    test.skip(!['phone', 'phone-small'].includes(test.info().project.name), 'the phones');
    test.setTimeout(120_000); // the line x = k is one practice exercise in sixteen: several seeds are opened
    const it = await openTf(page, route, want);
    const canvas = page.locator('.manip-transform .manip-canvas');
    await expectNoSidewaysScroll(page);
    await expectUsable(page, canvas, 'the grid');
    await expectUsable(page, checkBtn(page), 'the check button');
    const box = await canvas.boundingBox();
    // the square plane is drawn in the middle of its box (the box can be wider than tall where the controls take room)
    const side = Math.min(box.width, box.height);
    expect(side, 'the plane is large enough to count on').toBeGreaterThanOrEqual(200);
    await expect(checkBtn(page)).toBeDisabled();
    const s = side / 316; // the viewBox is 316 square; a grid step is 22 of it
    const x0 = box.x + (box.width - side) / 2; const y0 = box.y + (box.height - side) / 2;
    const px = ([x, y]) => [x0 + (158 + 22 * x) * s, y0 + (158 - 22 * y) * s];

    // a real drag from a vertex: the copy moves in whole steps, every vertex by the same step
    const p0 = await copyOf(page);
    const dirX = p0[0][0] > 0 ? -1 : 1; const dirY = p0[0][1] > 0 ? -1 : 1;
    const [ax, ay] = px(p0[0]); const [bx, by] = px([p0[0][0] + 2.3 * dirX, p0[0][1] + 1.2 * dirY]);
    await page.mouse.move(ax, ay); await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(ax + ((bx - ax) * i) / 8, ay + ((by - ay) * i) / 8);
    await page.mouse.up();
    await expect.poll(() => copyOf(page), 'the drag moved the copy').not.toEqual(p0);
    const p1 = await copyOf(page);
    const d = moved(p0, p1);
    d.forEach((v) => expect(v, 'every vertex moves by the same whole step').toEqual([2 * dirX, dirY]));
    await expect(checkBtn(page)).toBeEnabled();

    // the arrow buttons and the arrow keys: one step each
    const right = page.getByRole('button', { name: 'הזיזו ימינה' }); const left = page.getByRole('button', { name: 'הזיזו שמאלה' });
    const btn = (await right.isEnabled()) ? right : left; const bx1 = (await right.isEnabled()) ? 1 : -1;
    await btn.click();
    await expect.poll(() => copyOf(page)).toEqual(p1.map(([x, y]) => [x + bx1, y]));
    const p2 = await copyOf(page);
    await canvas.focus();
    const up = p2.every(([, y]) => y < 6);
    await page.keyboard.press(up ? 'ArrowUp' : 'ArrowDown');
    await expect.poll(() => copyOf(page), 'an arrow key moves the copy one step').toEqual(p2.map(([x, y]) => [x, y + (up ? 1 : -1)]));
    await expect(page.locator('.manip-transform .visually-hidden[aria-live]')).toHaveText(up ? 'העותק זז למעלה' : 'העותק זז למטה');

    const mr = it.manip.moves.flips?.[0];
    if (mr) {
      // a flip button reflects the copy where it is now
      const flip = page.getByRole('button', { name: typeof mr === 'string' ? `שיקוף ביחס לציר ${mr}` : `שיקוף ביחס לישר x = ${String(mr.x).replace('-', '−')}` });
      await expectUsable(page, flip, 'the flip button');
      // back to the start, so the copy is near the line
      await page.getByRole('button', { name: 'התחלה מחדש' }).click();
      const f0 = await copyOf(page);
      await flip.click();
      const k = typeof mr === 'string' ? 0 : mr.x;
      const want = f0.map(([x, y]) => (mr === 'x' ? [x, -y] : [2 * k - x, y]));
      await expect.poll(() => copyOf(page), 'the flip reflected the copy').toEqual(want);
      await expect(page.locator('.manip-transform .visually-hidden[aria-live]')).toContainText('העותק שוקף');
      if (typeof mr !== 'string') {
        // far from the line, a flip would carry the copy off the plane: nothing moves, and the object and מדי say why
        const away = page.getByRole('button', { name: mr.x > 0 ? 'הזיזו שמאלה' : 'הזיזו ימינה' });
        while (await away.isEnabled()) await away.click();
        const far = await copyOf(page);
        await flip.click();
        await expect(page.locator('.mp-tf-refuse')).toHaveText('העותק ייצא מהרשת. הזיזו אותו קודם קרוב יותר לישר השיקוף.');
        await expect(page.locator('.manip-transform .visually-hidden[aria-live]')).toHaveText('העותק ייצא מהרשת. הזיזו אותו קודם קרוב יותר לישר השיקוף.');
        expect(await copyOf(page), 'the refused flip did nothing').toEqual(far);
      }
    }
    const turns = it.manip.moves.turns;
    if (turns) {
      await page.getByRole('button', { name: 'התחלה מחדש' }).click();
      const t0 = await copyOf(page);
      const [cx, cy] = turns.centre;
      const half = turns.by === 180;
      // a quarter turn either way, whichever keeps the copy on the plane (the item's own turn always does)
      const ccw = t0.map(([x, y]) => [cx - (y - cy), cy + (x - cx)]); const cw = t0.map(([x, y]) => [cx + (y - cy), cy - (x - cx)]);
      const onPlane = (pts) => pts.every((p) => p.every((v) => Math.abs(v) <= 6));
      const want = half ? t0.map(([x, y]) => [2 * cx - x, 2 * cy - y]) : onPlane(ccw) ? ccw : cw;
      await page.getByRole('button', { name: half ? 'חצי סיבוב סביב O' : `סיבוב של 90° ${want === ccw ? 'נגד' : 'עם'} כיוון השעון סביב O` }).click();
      await expect.poll(() => copyOf(page), 'the turn moved every vertex about O').toEqual(want);
      await expect(page.locator('.manip-transform .visually-hidden[aria-live]')).toContainText('העותק הסתובב');
    }

    // the right state is accepted, the copy locked
    await page.evaluate(() => window.__madregotSolve(true));
    await checkBtn(page).click();
    await expect(page.locator('section.fb-good')).toBeVisible();
    for (const b of await page.locator('.manip-transform .step-btn').all()) await expect(b).toBeDisabled();
  });
}

// In a check the object says nothing about where the copy is: no chips, and the drawing's name counts the moves. The
// transform items are practice only, so the QA hook draws the exercise on screen as a check draws it.
test('the transform object in a check render: no coordinate text anywhere in the object', async ({ page }) => {
  test.skip(!['phone', 'phone-small'].includes(test.info().project.name), 'the phones');
  await openTf(page, 'transf/1', TF[0][2]);
  await expect(page.locator('.mp-tf-chip').first()).toBeVisible(); // practice: the chips are there
  expect(await page.evaluate(() => window.__madregotAsCheck(true))).toBe(true);
  await expect(page.locator('.mp-tf-chip')).toHaveCount(0);
  await expect(page.locator('.manip-transform .manip-readout')).toHaveCount(0);
  await expect(page.locator('.manip-coach')).toHaveCount(0);
  const coords = /\(\s*[−-]?\d+\s*,\s*[−-]?\d+\s*\)/;
  const look = () => page.evaluate(() => {
    const m = document.querySelector('.manip-transform');
    return [m.textContent, ...[...m.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label'))].join(' | ');
  });
  expect(await look()).not.toMatch(coords);
  expect(await look()).not.toContain('′(');
  await page.getByRole('button', { name: 'הזיזו ימינה' }).or(page.getByRole('button', { name: 'הזיזו שמאלה' })).first().click();
  await expect(page.locator('.manip-transform .manip-canvas')).toHaveAttribute('aria-label', /העותק זז 1 (ימינה|שמאלה) מההתחלה/);
  expect(await look()).not.toMatch(coords);
});

// GEOM-2 on the small phone (320×568): the busiest transform item is congruence's teaching step 5 (congr:1: the arrows,
// a flip, two turns and a target). The plane is at least 220 px wide and tall, the check button is on screen, nothing
// scrolls sideways, and the step is solved with the buttons alone: two quarter turns about O, then three steps up.
test('the transform object at its busiest: congr:1 step 5 on the small phone', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone-small', 'the small phone');
  await open(page, '#/learn/congr/1/A', student('8'));
  for (let i = 0; i < 8; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.kind === 'explore' && st.manip.kind === 'transform') break;
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await page.locator('.sp-next').click();
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  const st = await page.evaluate(() => window.__madregotStep);
  expect(st.manip.moves.drag && st.manip.moves.flips.length === 1 && st.manip.moves.turns.by === 90 && !!st.manip.target, 'the arrows, one flip, the turns and a target').toBe(true);
  const canvas = page.locator('.ls-explore .manip-transform .manip-canvas');
  await expect(page.locator('.ls-explore .mp-tf-controls')).toBeVisible();
  await expectNoSidewaysScroll(page);
  const box = await canvas.boundingBox();
  expect(box.width, 'the plane is at least 220 px wide').toBeGreaterThanOrEqual(220);
  expect(box.height, 'the plane is at least 220 px tall').toBeGreaterThanOrEqual(220);
  await expectUsable(page, canvas, 'the grid');
  await expectUsable(page, page.locator('.lm-check'), 'the check button');
  if (process.env.PROOF_SHOTS) await page.screenshot({ path: `${process.env.PROOF_SHOTS}/transform-busiest-phone-small.png` }); // the proof picture
  for (const b of await page.locator('.ls-explore .mp-tf-controls .step-btn').all()) await expectUsable(page, b, `the button ${await b.getAttribute('aria-label')}`);
  // K(1, −1), M(4, −1), L(1, 2): a half turn, as two quarter turns, and three steps up put them on A, B and C
  const ccw = page.getByRole('button', { name: 'סיבוב של 90° נגד כיוון השעון סביב O' });
  await ccw.click();
  await ccw.click();
  for (let k = 0; k < 3; k += 1) await page.getByRole('button', { name: 'הזיזו למעלה' }).click();
  await expect(page.locator('.lm-check')).toBeEnabled();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
  await expectNoSidewaysScroll(page);
});

// GEOM-2.3 on the short phones (curriculum stage 4's review): every teaching step and every repair that uses the transform
// object, at 320×568, 360×640 and 375×667 (an iPhone SE), shows every one of its buttons and בדיקה on the first
// screen, none under the bar: the plane takes the room the step's question leaves (Transform.jsx measures it), at least
// 200 px; the vertex chips are on screen, or (when they would take the plane under 220 px) off it but still in the live
// region, read by a screen reader;
// nothing scrolls sideways. The stairs and repairs are those whose teaching has the object (learn/figures.test.ts walks
// the same steps for their letters).
const TF_TEACH = ['transf/1', 'transf/2', 'transf/3', 'transf/4', 'congr/1', 'congr/2'];
const TF_REPAIRS = ['congr/1/alpha-order', 'congr/2/alpha-order', 'transf/1/shift-sign', 'transf/1/shift-swap', 'transf/1/one-axis', 'transf/2/axis-not-line', 'transf/2/wrong-axis', 'transf/3/wrong-centre', 'transf/4/double-perimeter'];
async function tfStepsFit(page, where) {
  let seen = 0;
  for (let i = 0; i < 16; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.kind === 'explore' && st.manip.kind === 'transform') {
      seen += 1;
      const what = `${where} step ${i + 1}`;
      const plane = page.locator('.ls-explore .manip-transform .manip-canvas');
      await expect(plane, `${what}: the plane`).toBeVisible();
      await page.waitForTimeout(150); // the plane's size is measured once the question's maths is laid out
      const box = await plane.boundingBox();
      expect(box.width, `${what}: the plane is at least 200 px`).toBeGreaterThanOrEqual(199.5);
      for (const b of await page.locator('.ls-explore .manip-transform button').all()) await expectUsable(page, b, `${what}: ${await b.getAttribute('aria-label') || await b.textContent()}`);
      await expectUsable(page, page.locator('.lm-check'), `${what}: בדיקה`);
      await expectNoSidewaysScroll(page);
      // the chips: on screen, or only when the plane would be under 220 px, off it but still in the live region
      const read = page.locator('.ls-explore .manip-transform .mp-tf-read');
      await expect(read).toHaveAttribute('aria-live', 'polite');
      await expect(read).toContainText('′(');
      if (!(await page.locator('.ls-explore .manip-transform.is-tight').count())) await expect(read).toBeInViewport();
    }
    if (st.kind === 'explore') {
      await page.waitForFunction(() => window.__madregotSolveStep?.forStep === window.__madregotStep);
      await page.evaluate(() => window.__madregotSolveStep());
      await page.locator('.lm-check').click();
      await expect(page.locator('.lm-actions.has-good')).toBeVisible();
    }
    if (st.kind === 'predict') {
      await page.locator('.ls-choice').nth(st.answer).click();
      await page.locator('.lm-check').click();
      await expect(page.locator('.lm-actions.has-good')).toBeVisible();
    }
    const next = page.locator('.sp-next');
    if (!(await next.count()) || (await next.textContent()).includes('לדוגמה')) break;
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await next.click();
    const moved = await page.waitForFunction((a) => document.querySelector('.sp-progress')?.getAttribute('aria-valuenow') !== a, at, { timeout: 4000 }).then(() => true).catch(() => false);
    if (!moved || !(await page.locator('.step-player .sp-progress').count())) break; // the repair's last step: its check comes next
  }
  return seen;
}
for (const [w, h] of [[320, 568], [360, 640], [375, 667]]) {
  test.describe(`the transform object's teaching at ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone-small', 'the short phones, once'); });
    for (const route of TF_TEACH) {
      test(`${route}: every transform step shows all its buttons and בדיקה`, async ({ page }) => {
        await open(page, `#/learn/${route}/A`, student(route.startsWith('transf') ? '7' : '8'));
        expect(await tfStepsFit(page, route), `${route} has a transform step`).toBeGreaterThan(0);
      });
    }
    for (const route of TF_REPAIRS) {
      test(`the repair ${route}: its transform step shows all its buttons and בדיקה`, async ({ page }) => {
        await open(page, `#/repair/${route}`, student(route.startsWith('transf') ? '7' : '8'));
        await page.getByRole('button', { name: 'בואו נראה את זה' }).click();
        expect(await tfStepsFit(page, `repair ${route}`), `${route} has a transform step`).toBeGreaterThan(0);
      });
    }
  });
}

// GEOM-3 on the phones (390×844 and 320×568): a congr:3 practice proof whose order and theorem are asked (proofOrder).
// The rows move with their buttons alone; the theorem is chosen from the keyboard alone (Enter opens the list on the
// chip, the arrows choose, Enter keeps it); while the last row's list is open the drawing is still on screen; a wrong
// order is outlined at its first row out of place; nothing scrolls sideways. PROOF_SHOTS=<folder> saves the table with
// the last row's list open and mid-way through the order (the proof pictures of GEOM-3; the feedback panel's entrance
// waits for the clock, which these tests fix, so the picture after a wrong check is taken on a running clock).
test('the proof object: a congr:3 practice proof ordered by its buttons, its reason chosen from the keyboard', async ({ page }) => {
  const project = test.info().project.name;
  test.skip(!['phone', 'phone-small'].includes(project), 'the phones');
  test.setTimeout(120_000);
  const it = await openOn(page, '#/lesson/congr/3?part=1', student('8'), (x) => x.form === 'manip' && x.manip.kind === 'proof' && !x.manip.lockOrder);
  const part = it.manip.part; const n = part.steps.length;
  // the right order is the steps' own (0 … n − 1), any order inside a free group (learn/challenges/grade.ts firstOutOfPlace)
  const groupOf = (s) => (part.free || []).find((g) => g.includes(s))?.reduce((a, b) => Math.min(a, b)) ?? s;
  const firstOff = (order) => order.findIndex((s, place) => groupOf(s) !== groupOf(place));
  const table = page.locator('.manip-proof');
  const ids = () => table.locator('td.claim').evaluateAll((els) => els.map((e) => Number(e.id.replace(/^.*-c/, ''))));
  const shot = async (name) => { if (process.env.PROOF_SHOTS) { await page.waitForTimeout(600); await page.screenshot({ path: `${process.env.PROOF_SHOTS}/proof-${name}-${project}.png` }); } };
  const move = (s, dir) => table.locator(`.mp-proof-move[aria-describedby$="-c${s}"][aria-label="הזיזו ${dir}"]`);
  await expect(table).toBeVisible();
  await expectNoSidewaysScroll(page);
  for (const b of await table.locator('.mp-proof-move').all()) { const r = await b.boundingBox(); expect(Math.min(r.width, r.height), 'the move buttons are 44 px').toBeGreaterThanOrEqual(43.5); }

  // the asked row (the congruence, its theorem) to the bottom with its own button: its reason list then opens on the last row
  const asked = part.steps.findIndex((s) => s.reason);
  while ((await ids()).indexOf(asked) < n - 1) await move(asked, 'למטה').click();
  const chip = table.locator('.mp-proof-chip');
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(table.locator('.mp-proof-pick')).toBeVisible();
  const opts = table.getByRole('radio');
  await expect(opts.first()).toBeFocused();
  const want = part.steps[asked].reason.answer;
  for (let k = 0; k < want; k += 1) await page.keyboard.press('ArrowDown');
  await expect(opts.nth(want)).toHaveAttribute('aria-checked', 'true');
  await expect(opts.nth(want)).toBeFocused();
  // the drawing is still on screen, whole, while the last row's list is open; the chosen reason is on screen too
  const vp = page.viewportSize();
  const fig = await table.locator('.mp-proof-fig').boundingBox();
  expect(fig.y, 'the drawing starts on screen').toBeGreaterThanOrEqual(-1);
  expect(fig.y + fig.height, 'the drawing ends on screen').toBeLessThanOrEqual(vp.height + 1);
  const opt = await opts.nth(want).boundingBox();
  expect(opt.y + opt.height, 'the chosen reason is on screen').toBeLessThanOrEqual(vp.height + 1);
  expect(opt.y, 'the chosen reason is not under the drawing').toBeGreaterThanOrEqual(fig.y + fig.height - 1);
  await shot('open');
  await page.keyboard.press('Enter');
  await expect(table.locator('.mp-proof-pick')).toHaveCount(0);
  await expect(chip).toBeFocused();
  await expectNoSidewaysScroll(page);

  // a wrong order (the congruence below the conclusion that follows from it): the check outlines the first row out of place
  const wrong = await ids();
  expect(firstOff(wrong)).toBeGreaterThanOrEqual(0);
  await checkBtn(page).click();
  await expect(page.locator('section.fb-retry')).toBeVisible();
  const off = table.locator('.mp-proof-row.off');
  await expect(off).toHaveCount(1);
  await expect(off.locator('td.n')).toHaveText(String(firstOff(wrong) + 1));
  await expect(table.locator('.mp-proof-note')).toHaveText('השורה הזאת עוד לא במקום');
  await expectNoSidewaysScroll(page);
  await proceed(page);

  // the order, with the move buttons alone: step k to place k by its "up" button (the chosen reason stays)
  for (let k = 0; k < n; k += 1) {
    while ((await ids()).indexOf(k) > k) await move(k, 'למעלה').click();
    if (k === 1) await shot('mid');
  }
  expect(firstOff(await ids())).toBe(-1);
  await expect(chip).toContainText(part.steps[asked].reason.choices[want].replace(/\$/g, '').slice(0, 4));
  await checkBtn(page).click();
  await expect(page.locator('section.fb-good')).toBeVisible();
  await expectNoSidewaysScroll(page);
});

// The student council's review: sim:1's and sim:3's mastery checks ask two whole proofs, from three templates each
// (content/sim.gen.js: T5, T8, T9 and T7, T10, T11). Each template as a check asks it, on the phones (390×844 and
// 320×568): nothing scrolls sideways, the drawing, every row and every claim fit (a claim never scrolls inside its
// cell), the move buttons are 44 px, and while the last row's reasons are open the drawing is still on screen, whole,
// with the chosen reason under it. PROOF_SHOTS=<folder> saves each table with that list open.
for (const [route, ids] of [['sim/1', ['T5', 'T8', 'T9']], ['sim/3', ['T7', 'T10', 'T11']]]) {
  for (const id of ids) {
    test(`a ${route.replace('/', ':')} check's whole proof ${id} fits the phone`, async ({ page }) => {
      const project = test.info().project.name;
      test.skip(!['phone', 'phone-small'].includes(project), 'the phones');
      test.setTimeout(120_000);
      const it = await openOn(page, `#/lesson/${route}?kind=check&purpose=mastery`, student('8'), (x) => x.form === 'manip' && x.manip.kind === 'proof' && x.manip.tpl === id);
      expect(it.hint, 'a check gives no hint').toBeFalsy();
      const part = it.manip.part; const n = part.steps.length;
      const table = page.locator('.manip-proof');
      await expect(table).toBeVisible();
      await expectNoSidewaysScroll(page);
      const vp = page.viewportSize();
      const within = async (loc, what) => { const r = await loc.boundingBox(); expect(r.x, `${what} starts on screen`).toBeGreaterThanOrEqual(-1); expect(r.x + r.width, `${what} ends on screen`).toBeLessThanOrEqual(vp.width + 1); };
      await within(table.locator('.mp-proof-fig'), 'the drawing');
      await expect(table.locator('.mp-proof-row')).toHaveCount(n);
      for (const row of await table.locator('.mp-proof-row').all()) await within(row, 'a row');
      const cut = await table.locator('td.claim').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      expect(cut, 'a claim wider than its cell').toEqual([]);
      for (const b of await table.locator('.mp-proof-move').all()) { const r = await b.boundingBox(); expect(Math.min(r.width, r.height), 'the move buttons are 44 px').toBeGreaterThanOrEqual(43.5); }
      // every row of a check's proof asks its reason, but a given or a common side: an asked row to the bottom
      const ids0 = () => table.locator('td.claim').evaluateAll((els) => els.map((e) => Number(e.id.replace(/^.*-c/, ''))));
      const asked = part.steps.map((s, i) => (s.reason ? i : -1)).filter((i) => i >= 0);
      const last = asked[asked.length - 1];
      while ((await ids0()).indexOf(last) < n - 1) await table.locator(`.mp-proof-move[aria-describedby$="-c${last}"][aria-label="הזיזו למטה"]`).click();
      const chip = table.locator(`.mp-proof-chip[aria-describedby$="-c${last}"]`);
      await chip.focus();
      await page.keyboard.press('Enter');
      await expect(table.locator('.mp-proof-pick')).toBeVisible();
      const want = part.steps[last].reason.answer;
      const opts = table.getByRole('radio');
      // Home chooses the first reason (a check's choices come in an order of their own: the right one may be first)
      await page.keyboard.press('Home');
      for (let k = 0; k < want; k += 1) await page.keyboard.press('ArrowDown');
      await expect(opts.nth(want)).toHaveAttribute('aria-checked', 'true');
      const fig = await table.locator('.mp-proof-fig').boundingBox();
      expect(fig.y, 'the drawing starts on screen').toBeGreaterThanOrEqual(-1);
      expect(fig.y + fig.height, 'the drawing ends on screen').toBeLessThanOrEqual(vp.height + 1);
      const opt = await opts.nth(want).boundingBox();
      expect(opt.y + opt.height, 'the chosen reason is on screen').toBeLessThanOrEqual(vp.height + 1);
      expect(opt.y, 'the chosen reason is not under the drawing').toBeGreaterThanOrEqual(fig.y + fig.height - 1);
      if (process.env.PROOF_SHOTS) { await page.waitForTimeout(600); await page.screenshot({ path: `${process.env.PROOF_SHOTS}/check-${id}-${project}.png` }); }
      await page.keyboard.press('Enter');
      await expect(table.locator('.mp-proof-pick')).toHaveCount(0);
      await expectNoSidewaysScroll(page);
    });
  }
}

// PRODUCT2-18: a miss on the number line names what probably happened, as a typed miss does, on every phone. On a short
// phone the feedback folds to one row so the line stays in view (the council's iPhone SE runs showed only "רמז"): the
// named mistake is in that row. After the miss, the hint's arrow starts at the marker and points the way to fix it.
for (const [w, h] of [[390, 844], [320, 568]]) {
  test(`a number-line miss on signed:1 names what probably happened, at ${w}×${h}`, async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'the viewport is set here');
    await page.setViewportSize({ width: w, height: h });
    const mirror = (x) => 2 * x.manip.from - x.answer; // the jump's length, the other way
    const it = await openOn(page, '#/lesson/signed/1', student('7'), (x) => x.form === 'manip' && x.manip.kind === 'numberline' && !x.manip.den
      && mirror(x) >= x.manip.min && mirror(x) <= x.manip.max);
    const to = mirror(it);
    const name = to < it.manip.from ? 'הסמן שמאלה' : 'הסמן ימינה';
    for (let k = 0; k < Math.abs(to - it.manip.from); k += 1) await page.getByRole('button', { name }).click();
    await checkBtn(page).click();
    await expect(page.locator('section.fb-retry')).toBeVisible();
    const line = page.locator('section.fb-retry .fb-diag');
    await expect(line).toBeVisible();
    await expect(line).toContainText('מה כנראה קרה:');
    await expectNoSidewaysScroll(page);
    await expect.poll(() => page.locator('section.fb-retry').evaluate((el) => getComputedStyle(el).opacity)).toBe('1'); // it has come in
    await page.screenshot({ path: test.info().outputPath(`numberline-miss-${w}.png`) });
    // the arrow of the hint, on the line: from the marker, back toward the answer
    await expect(page.locator('.mp-hint text')).toHaveText(to < it.answer ? 'ימינה' : 'שמאלה');
  });
}
