// The exercise screen on every device: for each kind of exercise, the question, the maths, the answer field
// and the check button stay usable, the keypad never covers them, and the page never scrolls.
import { test, expect } from '@playwright/test';
import { open, openOn, student, item, answer, proceed, expectUsable, expectNoSidewaysScroll } from './helpers.js';
import { textContrastFailures, expectNonTextContrast } from './contrast.js';

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
  ['a motion problem: two movers in one story', 'eq/6', '7', (x) => x.form === 'num' && x.key.startsWith('eq6:')],
  ['a meeting read off a graph of two cars', 'eq/6', '7', (x) => x.form === 'num' && x.fig?.type === 'sgraph'],
  ['which equation fits a motion table', 'eq/6', '7', (x) => x.form === 'mc' && x.key.startsWith('eq6t:')],
  ['an equation with a percent', 'sys/1', '8'],
  ['a system of two equations (a pair answer)', 'sys/2', '8'],
  ['a system by equal coefficients', 'sys/3', '8'],
  ['a word problem with two unknowns', 'sys/4', '8'],
  ['an inequality (which numbers solve it)', 'sys/5', '8'],
  // a scale question writes its large numbers with the thousands grouped (1 : 50{,}000): they fit the smallest phone
  ['a scale question (thousands in TeX)', 'ratio/4', '8', (x) => /\d\{,\}\d/.test(x.text || '')],
  // (a choice with no maths above it keeps its choices low, by the check button: the typed question is the one measured)
  ['a ratio completed in lowest terms', 'ratio/1', '8', (x) => x.form === 'num'],
  ['a missing value in a proportional table', 'ratio/3', '8', (x) => x.fig?.type === 'table'],
  // percent: finding the whole (the hardest of the three questions) and the volunteers' table, on every phone
  ['finding the whole from a percent', 'pct/4', '8'],
  ['what percent, from a table', 'pct/3', '8', (x) => x.fig?.type === 'table'],
  // functions: a walk read off its situation graph, the axes numbered on every second line (stage5.md FUNC-2)
  ['a situation graph to read', 'func/1', '8', (x) => x.form === 'num' && x.fig?.type === 'sgraph'],
  // the function and its representations: a value from a table of y = mx + b
  ['a function from its table of values', 'func/2', '8', (x) => x.form === 'num' && x.fig?.type === 'table'],
  // increasing, decreasing and constant: an interval's length read off a graph, and the hours a table rose or fell
  ['how long a graph rises, falls or stays', 'func/3', '8', (x) => x.form === 'num' && x.fig?.type === 'sgraph'],
  ['how many hours a table rose or fell', 'func/3', '8', (x) => x.form === 'num' && x.fig?.type === 'table'],
  // uniform and non-uniform rate: a pot's rate from two readings, and who runs faster on a graph of two named lines
  ['a rate from two readings', 'func/4', '8', (x) => x.form === 'num' && x.key.startsWith('fu4:')],
  ['who is faster: two named lines on a graph', 'func/4', '8', (x) => x.form === 'mc' && x.fig?.type === 'sgraph'],
];

for (const [what, route, grade, want = () => true] of CASES) {
  test(`exercise layout: ${what}`, async ({ page }) => {
    // typed and multiple-choice exercises (the interactive ones have their own spec, manip.spec.js)
    const it = await openOn(page, `#/lesson/${route}`, student(grade), (x) => x.form !== 'manip' && want(x));
    // every piece of maths in the question sits inside the question's own box (a long number is not cut or pushed out)
    const outside = await page.evaluate(() => {
      const q = document.querySelector('#qtext').getBoundingClientRect();
      return [...document.querySelectorAll('#qtext .katex')].map((k) => k.getBoundingClientRect()).filter((r) => r.left < q.left - 1 || r.right > q.right + 1).length;
    });
    expect(outside, 'maths that sticks out of the question').toBe(0);
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

// The graph you draw, in func:1's teaching (step 3, Uri's walk), on every phone: the drawing keeps room to aim a
// finger (150 px or more on a 320×568 phone), a drag in a column moves that column's point, Tab reaches a point and ↑
// moves it a step, nothing scrolls sideways, and its text and edges are readable in light and dark.
test('the graph you draw (func:1 step 3): room, a column drag, Tab and up, light and dark', async ({ page }, info) => {
  await open(page, '#/learn/func/1/A', student('8'));
  for (let i = 0; i < 8; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.kind === 'explore') break;
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); await expect(page.locator('.lm-actions.has-good')).toBeVisible(); }
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await page.locator('.sp-next').click();
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  const canvas = page.locator('.ls-explore .manip-graph .manip-canvas');
  await expect(canvas).toBeVisible();
  // the step before has slid away and this one has slid in (while they slide, they sit beside each other; the new one
  // waits a moment unmoved and unseen, opacity 0, before it slides in, so it has settled only once it is seen too)
  await expect.poll(() => page.evaluate(() => { const s = [...document.querySelectorAll('.sp-step')]; return s.length === 1 && getComputedStyle(s[0]).transform === 'none' && getComputedStyle(s[0]).opacity === '1'; }), { timeout: 20_000 }).toBe(true);
  await expect(canvas).toHaveAttribute('role', 'group');
  await expect(canvas).toHaveAttribute('aria-label', 'גרף: מרחק מהבית לפי זמן');
  await expectNoSidewaysScroll(page);
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box.height, 'the graph keeps room to aim a finger').toBeGreaterThanOrEqual(150);
  expect(box.x + box.width, 'the graph is inside the screen').toBeLessThanOrEqual(page.viewportSize().width + 1);
  const pts = page.locator('.ls-explore .mp-graph-pt');
  await expect(pts).toHaveCount(4);
  await expect(pts.nth(0)).toHaveAttribute('aria-readonly', 'true'); // home, where the story starts
  await expect(pts.nth(1)).toHaveAttribute('aria-valuetext', 'ב־5 דקות: 200 מטרים');
  // a drag in the third column (10 minutes), from the middle of the plot to near its top, moves that point only
  const third = await pts.nth(2).locator('.mp-graph-ring').boundingBox();
  const cx = third.x + third.width / 2;
  await page.mouse.move(cx, box.y + box.height * 0.55);
  await page.mouse.down();
  for (let k = 1; k <= 8; k += 1) await page.mouse.move(cx, box.y + box.height * (0.55 - 0.035 * k));
  await page.mouse.up();
  await expect.poll(async () => Number(await pts.nth(2).getAttribute('aria-valuenow')), 'the drag moved the 10-minute point').toBeGreaterThan(200);
  await expect(pts.nth(1)).toHaveAttribute('aria-valuenow', '200');
  await expect(pts.nth(3)).toHaveAttribute('aria-valuenow', '200');
  // Tab reaches the first point that moves, and ↑ lifts it one step (100 m)
  await pts.nth(0).focus();
  await page.keyboard.press('Tab');
  await expect(pts.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(pts.nth(1)).toHaveAttribute('aria-valuenow', '300');
  await expect(pts.nth(1)).toHaveAttribute('aria-valuetext', 'ב־5 דקות: 300 מטרים');
  // → moves the focus to the next point, Home takes it to the axis
  await page.keyboard.press('ArrowRight');
  await expect(pts.nth(2)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(pts.nth(2)).toHaveAttribute('aria-valuenow', '0');
  // readable: text at AA and edges at 3:1, light and dark (the in-house probes; axe-core is not in this tree)
  if (info.project.name === 'phone') {
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      // the colours change with the theme over a short transition: the probe waits for it to settle
      await expect.poll(() => textContrastFailures(page), `text under AA, the graph step in ${scheme}`).toEqual([]);
      await expectNonTextContrast(page);
    }
    await page.emulateMedia({ colorScheme: 'light' });
  }
  // the readout says the chosen point, its units outside the maths
  await expect(page.locator('.ls-explore .manip-readout')).toContainText('(10, 0)');
  // the dump of every point's words, for the proof
  info.annotations.push({ type: 'aria-valuetext', description: (await pts.evaluateAll((els) => els.map((e) => e.getAttribute('aria-valuetext')))).join(' | ') });
});

// func:2's "which table is not a function": four tables as the choices. Each choice is a table a screen reader reads row
// by row ("x: 1, 2, 2, 3; y: …"), never its TeX; all four are thumb-sized and inside the screen; nothing scrolls sideways.
test('four tables as choices (func:2): read row by row, thumb-sized, inside the screen', async ({ page }) => {
  await openOn(page, '#/lesson/func/2', student('8'), (x) => x.form === 'mc' && x.key.startsWith('fu2i:'));
  const choices = page.locator('.choices .choice');
  await expect(choices).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) await expect(choices.nth(i)).toHaveAttribute('aria-label', /^x: \d, \d, \d, \d; y: \d+, \d+, \d+, \d+$/);
  await expectNoSidewaysScroll(page);
  const width = page.viewportSize().width;
  for (let i = 0; i < 4; i += 1) {
    await choices.nth(i).scrollIntoViewIfNeeded();
    const b = await choices.nth(i).boundingBox();
    expect(b.height, 'a choice is thumb-sized').toBeGreaterThanOrEqual(44);
    expect(b.x >= 0 && b.x + b.width <= width + 1, 'a choice is inside the screen').toBe(true);
  }
});
