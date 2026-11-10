// The exercise screen on every device: for each kind of exercise, the question, the maths, the answer field
// and the check button stay usable, the keypad never covers them, and the page never scrolls.
import { test, expect } from '@playwright/test';
import { open, openOn, student, item, answer, proceed, expectUsable, expectNoSidewaysScroll } from './helpers.js';

const CASES = [
  ['a number (signed numbers)', 'signed/1', '7'],
  ['multiple choice', 'signed/2', '7'],
  ['a long expression', 'signed/5', '7'],
  ['a point on a grid', 'coord/1', '7'],
  ['an area on a grid', 'coord/4', '7'],
  ['a missing vertex', 'coord/5', '7'],
  ['a triangle drawing', 'angles/3', '7'],
  ['parallel lines', 'angles/4', '7'],
  ['a table of values', 'line/1', '8'],
  ['a graph', 'line/3', '8'],
  ['a line equation (two fields)', 'line/5', '8'],
  ['a word problem with a drawing', 'pyth/4', '8'],
  ['a list of data', 'stats/2', '8'],
  ['a frequency table', 'stats/4', '8'],
  ['an expression answer (two fields)', 'expr/3', '7'],
  ['an expression from a pattern table', 'expr/2', '7'],
  ['simplifying a long expression', 'expr/5', '7'],
  ['an equation (one step, or a missing number)', 'eq/1', '7'],
  ['an equation with the unknown on both sides', 'eq/3', '7'],
  ['an equation with brackets', 'eq/4', '7'],
  ['a word problem (equations)', 'eq/5', '7'],
  ['an equation with a percent', 'sys/1', '8'],
  ['a system of two equations (a pair answer)', 'sys/2', '8'],
  ['a system by equal coefficients', 'sys/3', '8'],
  ['a word problem with two unknowns', 'sys/4', '8'],
  ['an inequality (which numbers solve it)', 'sys/5', '8'],
];

for (const [what, route, grade] of CASES) {
  test(`exercise layout: ${what}`, async ({ page }) => {
    // typed and multiple-choice exercises (the interactive ones have their own spec, manip.spec.js)
    const it = await openOn(page, `#/lesson/${route}`, student(grade), (x) => x.form !== 'manip');
    await expect(page.locator('#qtext')).toBeVisible();
    const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
    expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
    await expectNoSidewaysScroll(page);
    await expectUsable(page, page.locator('#qtext'), 'the question');

    // The maths region is the one place that scrolls, and it keeps real room.
    const main = page.locator('.lesson-main');
    const mainBox = await main.boundingBox();
    expect(mainBox.height, 'room for the maths').toBeGreaterThanOrEqual(120);

    // The whole drawing (or table) is inside the maths region, never cut by the answer row or the keypad.
    const fig = page.locator('.lesson-main .figure, .lesson-main .fg-table').first();
    if (await fig.count()) {
      const f = await fig.boundingBox();
      expect(f.y, 'the drawing starts inside the maths region').toBeGreaterThanOrEqual(mainBox.y - 1);
      expect(f.y + f.height, 'the drawing ends inside the maths region').toBeLessThanOrEqual(mainBox.y + mainBox.height + 1);
      // on the smallest phone a drawing still opens readable (the compact bottom gives it the room)
      if (test.info().project.name === 'phone-small' && await page.locator('.lesson-main svg.figure').count()) {
        expect(f.height, 'the drawing is readable on a 320×568 phone').toBeGreaterThanOrEqual(160);
      }
    }

    if (it.form === 'mc') {
      // the choices come right under the question (with the expression or drawing between them), not far below
      const q = await page.locator('#qtext').boundingBox();
      const first = await page.locator('.lesson-main .q-stage > *').first().boundingBox();
      expect(first.y - (q.y + q.height), 'the maths starts right under the question').toBeLessThanOrEqual(64);
      // every choice can be brought into view in the maths region and is not under the bottom bar
      const choices = page.locator('.choice');
      for (let k = 0; k < await choices.count(); k += 1) {
        await choices.nth(k).evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
        await expectUsable(page, choices.nth(k), `choice ${k + 1}`);
      }
      await main.evaluate((el) => el.scrollTo(0, 0));
    } else {
      await expectUsable(page, page.locator('.answer-bar .answer'), 'the answer field');
    }
    await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), 'the check button');

    // A wrong answer: the try-again panel, with the answer still in view and most of the drawing too.
    await answer(page, false);
    await expect(page.locator('section.fb-retry')).toBeVisible();
    if (await fig.count()) {
      const share = await page.evaluate(() => { const f = document.querySelector('.lesson-main .figure, .lesson-main .fg-table').getBoundingClientRect(); const m = document.querySelector('.lesson-main').getBoundingClientRect(); return Math.max(0, Math.min(f.bottom, m.bottom) - Math.max(f.top, m.top)) / f.height; });
      expect(share, 'the drawing stays in view after a mistake').toBeGreaterThanOrEqual(0.6);
    }
    await expectUsable(page, page.locator('section.fb .fb-actions .btn'), 'the try-again button');
    if (it.form !== 'mc') await expectUsable(page, page.locator('.answer-bar .answer'), 'the answer after a mistake');
    await proceed(page);

    // Then the right answer: the success panel, and on to the next exercise.
    await answer(page, true);
    await expect(page.locator('section.fb-good')).toBeVisible();
    await expectUsable(page, page.locator('section.fb .fb-actions .btn'), 'the continue button');
    await proceed(page);
    await expect(page.locator('section.fb')).toHaveCount(0);
    await expectUsable(page, page.locator('#qtext'), 'the next question');
  });
}

test('the keypad: minus, decimal point, fraction, next field and delete', async ({ page }) => {
  await openOn(page, '#/lesson/coord/1', student('7'), (x) => x.form === 'pt');
  const key = (name) => page.getByRole('button', { name, exact: true }).click();
  await page.locator('#slot-x').click();
  await key('מינוס'); await key('3');
  await page.getByRole('button', { name: /^מעבר ל/ }).click();
  await key('4'); await key('נקודה עשרונית'); await key('5'); await key('6');
  await key('מחיקה');
  await expect(page.locator('#slot-x')).toHaveValue('-3');
  await expect(page.locator('#slot-y')).toHaveValue('4.5');
  await expect(page.locator('#slot-x')).toHaveAttribute('inputmode', 'none');
  await openOn(page, '#/lesson/signed/1', student('7'), (x) => x.form === 'num');
  await expect(page.getByRole('button', { name: /^מעבר ל/ })).toHaveCount(0);
  await page.locator('#slot-v').click();
  await key('3'); await key('שבר'); await key('4');
  await expect(page.locator('#slot-v')).toHaveValue('3/4');
});

// The fraction answer (frac:1 "reduce"): numerator over a bar over denominator, both fields usable on every phone, and
// the keypad's next key moving between them; the stack never pushes the check button off screen.
test('the fraction answer row: two stacked fields, the next key between them', async ({ page }) => {
  await openOn(page, '#/lesson/frac/1', student('7'), (x) => x.form === 'frac');
  const n = page.locator('#slot-n'); const d = page.locator('#slot-d');
  await expectNoSidewaysScroll(page);
  const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
  await expectUsable(page, n, 'the numerator'); await expectUsable(page, d, 'the denominator');
  const [bn, bd] = [await n.boundingBox(), await d.boundingBox()];
  expect(bn.y + bn.height, 'the numerator stands over the denominator').toBeLessThanOrEqual(bd.y + 1);
  expect(Math.min(bn.height, bd.height), 'fields are thumb-sized').toBeGreaterThanOrEqual(40);
  const key = (name) => page.getByRole('button', { name, exact: true }).click();
  await n.click(); await key('3');
  await page.getByRole('button', { name: /^מעבר ל/ }).click();
  await expect(d).toBeFocused();
  await key('4');
  await expect(n).toHaveValue('3'); await expect(d).toHaveValue('4');
  await page.getByRole('button', { name: /^מעבר ל/ }).click();
  await expect(n).toBeFocused();
  await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), 'the check button');
});

// signed:6 (signed fractions and decimals) is the sixth stair of the signed unit: a student who finished the five
// before it finds it current, its card saying that the stair is new; the unit and the card fit every phone.
test('a signed-number unit with six stairs: the new stair is current and says so', async ({ page }) => {
  const done = { 1: 'mastered', 2: 'mastered', 3: 'mastered', 4: 'mastered', 5: 'mastered' };
  await open(page, '#/', student('7', { path: { signed: { parts: {}, reviews: 1, jumped: 0, done } } }));
  const unit = page.locator('.unit').first();
  await expect(unit.locator('.unit-title')).toHaveText('מספרים מכוונים');
  await expect(unit.locator('.unit-label')).toHaveText('יחידה 1 · 5 מתוך 6 מדרגות');
  const nodes = unit.locator('.path-step:not(.path-chest) .node');
  await expect(nodes).toHaveCount(7); // six stairs and the unit's review
  for (let k = 0; k < 7; k += 1) { const b = await nodes.nth(k).boundingBox(); expect(Math.min(b.width, b.height), `node ${k + 1} is thumb-sized`).toBeGreaterThanOrEqual(44); }
  await expect(nodes.nth(5)).toHaveClass(/node-current/);
  await expect(nodes.nth(6)).toHaveClass(/node-locked/); // the unit review waits for the new stair
  await expectNoSidewaysScroll(page);
  await nodes.nth(5).click();
  const card = page.locator('.node-card');
  await expect(card.locator('.node-card-title')).toHaveText('שברים ועשרוניים מכוונים');
  await expect(card.locator('.node-card-added')).toHaveText('נוספה מדרגה חדשה ליחידה: שברים ועשרוניים מכוונים.');
  await card.locator('.node-start-btn').scrollIntoViewIfNeeded();
  await expectUsable(page, card.locator('.node-start-btn'), 'the start button');
  await expectNoSidewaysScroll(page);
  // a stair already climbed says nothing about it
  await nodes.nth(4).click();
  await expect(page.locator('.node-card')).toHaveCount(1);
  await expect(page.locator('.node-card-added')).toHaveCount(0);
});

test('on a computer: digits typed anywhere go to the answer, Enter checks and Enter continues', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'a physical keyboard is a computer case');
  const it = await openOn(page, '#/lesson/signed/1', student('7'), (x) => x.form === 'num');
  await page.locator('#qtext').click(); // the focus is not in the answer field
  await page.keyboard.type(String(it.answer));
  await expect(page.locator('#slot-v')).toHaveValue(String(it.answer));
  await page.locator('#qtext').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('section.fb-good')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('section.fb')).toHaveCount(0);
  await expect.poll(async () => (await item(page)).key).not.toBe(it.key);
});
