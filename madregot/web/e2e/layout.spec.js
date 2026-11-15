// The exercise screen on every device: for each kind of exercise, the question, the maths, the answer field
// and the check button stay usable, the keypad never covers them, and the page never scrolls.
import { test, expect } from '@playwright/test';
import { open, openOn, student, item, answer, proceed, expectUsable, expectNoSidewaysScroll, type, openUnit } from './helpers.js';
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
  // a slope with no two-place decimal says how to write it (PRODUCT2-6): the longer question still fits every phone
  ['a slope between two points, with the line on how to write it', 'line/4', '8', (x) => /מעוגל לשתי ספרות/.test(x.text || '')],
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
  // two stacked fractions with a minus between them: on the smallest phone the equation fits, with no sideways scroll
  ['an equation with two stacked fractions', 'eq/7', '7', (x) => x.form === 'num' && x.key.startsWith('eq7:2:')],
  ['a proportion', 'eq/7', '7', (x) => x.form === 'num' && x.key.startsWith('eq7p:')],
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
  // areas (stage 2): a triangle whose height falls outside it, drawn with the height dashed on BC's extension
  ['a triangle with its height outside (areas)', 'area/2', '7', (x) => /^ar2g:.*:1$/.test(x.key || '')],
  // the circle (stage 2): a cylinder's volume with π (the answer row □ π סמ״ר) under a solid figure, and a disc with π ≈ 3.14
  ['a cylinder\'s volume with π (circle)', 'circle/3', '8', (x) => /^ci3v:/.test(x.key || '')],
  ['a disc\'s area with π ≈ 3.14 (circle)', 'circle/2', '8', (x) => /^ci2n:/.test(x.key || '')],
  // Pythagoras in space (stage 2): a box with its diagonal marked, and the three segments of which only one is the box's
  ['a box\'s diagonal (space)', 'space/1', '8', (x) => /^sp1s:/.test(x.key || '')],
  ['which segment is the box\'s diagonal (space)', 'space/1', '8', (x) => /^sp1w:/.test(x.key || '')],
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

// GEOM-2: the transform object's controls. Only the moves an item lists are drawn, in at most two rows (the arrows with
// התחלה מחדש, then the flips and turns), and on a 320px phone every row fits the screen. The busiest of the unit is
// transf:4's teaching step that covers a dashed shape (arrows, a flip and a turn); a practice flip has arrows and one.
test('the transform object: at most two rows of controls, none wider than the screen', async ({ page }) => {
  test.skip(!['phone', 'phone-small'].includes(test.info().project.name), 'the phones');
  const rowsOf = () => page.evaluate(() => {
    const ctl = document.querySelector('.mp-tf-controls');
    const btns = [...ctl.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
    const tops = [...new Set(btns.map((r) => Math.round(r.top)))];
    return {
      rows: ctl.querySelectorAll('.mp-tf-row').length, lines: tops.length, vw: innerWidth,
      left: Math.min(...btns.map((r) => r.left)), right: Math.max(...btns.map((r) => r.right)),
      over: [...ctl.querySelectorAll('.mp-tf-row')].some((r) => r.scrollWidth > r.clientWidth + 1),
      small: btns.filter((r) => r.width < 44 || r.height < 44).length,
    };
  });
  const expectFits = async (what) => {
    const r = await rowsOf();
    expect(r.rows, `${what}: rows`).toBeLessThanOrEqual(2);
    expect(r.lines, `${what}: lines of buttons on screen`).toBeLessThanOrEqual(2);
    expect(r.over, `${what}: a row overflows`).toBe(false);
    expect(r.left, `${what}: starts on screen`).toBeGreaterThanOrEqual(0);
    expect(r.right, `${what}: ends on screen`).toBeLessThanOrEqual(r.vw);
    expect(r.small, `${what}: buttons under 44px`).toBe(0);
    await expectNoSidewaysScroll(page);
  };
  // the teaching step of transf:4 with the most moves
  await open(page, '#/learn/transf/4/A', student('7'));
  for (let i = 0; i < 12; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.kind === 'explore' && st.manip.kind === 'transform' && st.manip.moves.flips && st.manip.moves.turns) break;
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
    if (st.kind === 'explore') {
      await expect.poll(() => page.evaluate(() => !!window.__madregotSolveStep && window.__madregotSolveStep.forStep === window.__madregotStep)).toBe(true);
      await page.evaluate(() => window.__madregotSolveStep());
      await page.locator('.lm-check').click();
    }
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await page.locator('.sp-next').click();
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  await expect(page.locator('.ls-explore .mp-tf-controls')).toBeVisible();
  await expectFits('transf:4, arrows, a flip and a turn');
  await expectUsable(page, page.locator('.ls-explore .manip-canvas'), 'the grid');
  // a practice flip in a line x = k (its button's label is the longest)
  await openOn(page, '#/lesson/transf/2?part=1', student('7'), (x) => x.form === 'manip' && x.manip.kind === 'transform');
  await expect(page.locator('.mp-tf-controls')).toBeVisible();
  await expectFits('transf:2, arrows and a flip');
});

// PRODUCT2-6, PRODUCT2-10, SK-STUDENT-3: a slope whose answer has no two-place decimal says how to write it, and on the
// smallest phone the line stays inside the question while every key of the keypad (the space of a mixed number among
// them) stays whole on screen and at least 44px tall. KEYPAD_SHOTS=<folder> saves a picture for a look.
test('a question with its format line keeps the whole keypad on screen', async ({ page }, info) => {
  await openOn(page, '#/lesson/line/4', student('8'), (x) => x.form === 'num' && /מעוגל לשתי ספרות/.test(x.text || ''));
  await expect(page.locator('#qtext')).toContainText('אפשר לכתוב כשבר');
  const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
  await expectUsable(page, page.locator('#qtext'), 'the question with its format line');
  await expectUsable(page, page.locator('.answer-bar .answer'), 'the answer field');
  await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), 'the check button');
  const keys = page.locator('.lesson .keypad .key');
  expect(await keys.count()).toBe(15);
  for (let k = 0; k < 15; k += 1) {
    const b = await keys.nth(k).boundingBox();
    expect(b.height, `key ${k + 1} is at least 44px tall`).toBeGreaterThanOrEqual(43.5);
    expect(b.y + b.height, `key ${k + 1} is on screen`).toBeLessThanOrEqual(page.viewportSize().height + 1);
  }
  await expectUsable(page, page.getByRole('button', { name: 'רווח, בין השלם לשבר', exact: true }), 'the space key');
  const dir = process.env.KEYPAD_SHOTS;
  if (dir) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/line4-format-${info.project.name}.png` });
    await page.locator('#slot-v').click();
    for (const k of ['5', 'רווח, בין השלם לשבר', '1', 'שבר', '3']) await page.getByRole('button', { name: k, exact: true }).click();
    await page.screenshot({ path: `${dir}/keypad-mixed-${info.project.name}.png` });
  }
});

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
test('a signed-number unit with seven stairs: the new sixth stair is current and says so', async ({ page }) => {
  const done = { 1: 'mastered', 2: 'mastered', 3: 'mastered', 4: 'mastered', 5: 'mastered' };
  await open(page, '#/', student('7', { path: { signed: { parts: {}, reviews: 1, jumped: 0, done } } }));
  const unit = page.locator('.unit').first();
  await expect(unit.locator('.unit-title')).toHaveText('מספרים מכוונים');
  await expect(unit.locator('.unit-label')).toHaveText('יחידה 1 · 5 מתוך 7 מדרגות');
  const nodes = unit.locator('.path-step:not(.path-chest) .node');
  await expect(nodes).toHaveCount(8); // seven stairs and the unit's review
  for (let k = 0; k < 8; k += 1) { const b = await nodes.nth(k).boundingBox(); expect(Math.min(b.width, b.height), `node ${k + 1} is thumb-sized`).toBeGreaterThanOrEqual(44); }
  await expect(nodes.nth(5)).toHaveClass(/node-current/);
  await expect(nodes.nth(6)).toHaveClass(/node-locked/); // signed:7 and the unit review wait for the new stair
  await expect(nodes.nth(7)).toHaveClass(/node-locked/);
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

// signed:7 (powers of directed numbers, CLASSROOM-5): a student who had finished the unit's six stairs finds the
// seventh current after them, with its own line; the unit review waits for it.
test('a signed-number unit with a seventh stair: powers are current after the six and say so', async ({ page }) => {
  const done = { 1: 'mastered', 2: 'mastered', 3: 'mastered', 4: 'mastered', 5: 'mastered', 6: 'mastered' };
  await open(page, '#/', student('7', { path: { signed: { parts: {}, reviews: 1, jumped: 0, done } } }));
  // the path opens the unit the student is on (PRODUCT2-37); the signed unit opens from its row
  const unit = await openUnit(page, /^מספרים מכוונים$/);
  await expect(unit.locator('.unit-label')).toHaveText('יחידה 1 · 6 מתוך 7 מדרגות');
  const nodes = unit.locator('.path-step:not(.path-chest) .node');
  await expect(nodes).toHaveCount(8);
  await expect(nodes.nth(6)).toHaveClass(/node-current/);
  await expect(nodes.nth(7)).toHaveClass(/node-locked/);
  await expectNoSidewaysScroll(page);
  await nodes.nth(6).click();
  const card = page.locator('.node-card');
  await expect(card.locator('.node-card-title')).toHaveText('חזקות של מספרים מכוונים');
  await expect(card.locator('.node-card-added')).toHaveText('נוספה מדרגה חדשה ליחידה: חזקות של מספרים מכוונים.');
  await card.locator('.node-start-btn').scrollIntoViewIfNeeded();
  await expectUsable(page, card.locator('.node-start-btn'), 'the start button');
  await expectNoSidewaysScroll(page);
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

// CLASSROOM-13 (area:2): the class's right triangle, a wrong leg typed twice (6.5, the leg with the half forgotten when
// the area is 39 and the other leg 6), then the class's solution lines: the givens, the formula with the legs at the
// square and the equation with its slash marks, every line whole on the smallest phone
test('the class\'s right triangle: after 6.5 twice, the solution in the class\'s form fits the phone', async ({ page }) => {
  const it = await openOn(page, '#/lesson/area/2', student('7'), (x) => /^ar2x:/.test(x.key || ''));
  for (let k = 0; k < 2; k += 1) {
    await type(page, '6.5');
    await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
    if (k === 0) { await expect(page.locator('section.fb-retry')).toBeVisible(); await proceed(page); }
  }
  await expect(page.locator('section.fb-reveal')).toBeVisible();
  await expect(page.locator('.fb-answer')).toContainText(String(it.answer));
  const panel = page.locator('section.fb');
  await expect(panel).toContainText('נתון');
  await expectNoSidewaysScroll(page);
  // every line of maths in the panel is inside the panel's box (nothing cut at 320px)
  const outside = await page.evaluate(() => {
    const p = document.querySelector('section.fb').getBoundingClientRect();
    return [...document.querySelectorAll('section.fb .katex')].map((k) => k.getBoundingClientRect()).filter((r) => r.left < p.left - 1 || r.right > p.right + 1).length;
  });
  expect(outside, 'maths that sticks out of the solution').toBe(0);
  await page.screenshot({ path: test.info().outputPath('ar2x-solution.png') });
});

// boxes and prisms (stage 2): the net of a cube in practice (solid:1 "the face opposite the shaded one") on the smallest
// phone: the net keeps room to be read, every face is a target a thumb can tap, and nothing scrolls sideways
test('the cube net on a 320×568 phone (solid:1): readable, every face a thumb target, no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openOn(page, '#/lesson/solid/1?part=1', student('7'), (x) => x.form === 'manip' && x.manip.kind === 'net' && x.manip.task === 'face');
  await expectNoSidewaysScroll(page);
  const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
  const canvas = page.locator('.manip-canvas');
  await expectUsable(page, canvas, 'the net');
  expect((await canvas.boundingBox()).height, 'the net is at least 160px high').toBeGreaterThanOrEqual(160);
  const faces = page.locator('.mp-net-pick');
  await expect(faces).toHaveCount(6);
  for (const f of await faces.all()) {
    const b = await f.boundingBox();
    expect(Math.min(b.width, b.height), 'a face is a thumb target').toBeGreaterThanOrEqual(30);
  }
  await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), 'the check button');
  await page.screenshot({ path: test.info().outputPath('net-face-phone-small.png') });
});

// the circle (stage 2): an answer "with π" (circle:3, a cylinder's volume) on the smallest phone. The row reads □ π סמ״ק
// on one line: the slot, π after it and the unit, nothing wrapped and nothing out of the screen; the cylinder above it is
// readable. The whole value typed into the slot (3.14 times the answer) is right in another form: it gets the note and
// the question stays open (no mistake counted), and the number before π is then right.
test('a π answer row (circle:3) on a 320×568 phone: □ π סמ״ק on one line, the cylinder readable, the whole value noted', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const it = await openOn(page, '#/lesson/circle/3', student('8'), (x) => /^ci3v:/.test(x.key || ''));
  expect(it.after).toBe('\\pi');
  await expectNoSidewaysScroll(page);
  const parts = ['.answer-bar #slot-v', '.answer-bar .answer-after', '.answer-bar .answer-unit'];
  const boxes = [];
  for (const sel of parts) {
    const loc = page.locator(sel).first();
    await expectUsable(page, loc, sel);
    boxes.push(await loc.boundingBox());
  }
  // one line: every piece's middle is inside every other piece's height
  const mids = boxes.map((b) => b.y + b.height / 2);
  for (const b of boxes) for (const m of mids) expect(m >= b.y - 1 && m <= b.y + b.height + 1, 'the slot, π and the unit sit on one line').toBe(true);
  await expect(page.locator('.answer-bar .answer-after')).toContainText('π');
  // a volume: the row reads □ π סמ״ק
  await expect(page.locator('.answer-bar .answer-unit')).toHaveText('סמ״ק');
  const fig = page.locator('.lesson-main svg.figure').first();
  await expect(fig).toHaveAttribute('aria-label', /גליל/);
  expect((await fig.boundingBox()).height, 'the cylinder is readable on a 320×568 phone').toBeGreaterThanOrEqual(160);
  await page.screenshot({ path: test.info().outputPath('pi-row-phone-small.png') });
  // the whole value: 3.14 times the answer, to tenths
  await page.locator('#slot-v').click();
  await type(page, String(Math.round(3.14 * it.answer * 10) / 10));
  // the whole value shows in the slot, every digit (not only the slot's place on the row)
  expect(await page.locator('#slot-v').evaluate((el) => el.scrollWidth - el.clientWidth), 'the typed value shows whole').toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
  await expect(page.locator('.answer-partial')).toContainText('נכון בקירוב');
  await expect(page.locator('section.fb')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('pi-row-note-phone-small.png') });
  // then the number before π
  await page.locator('#slot-v').click();
  for (let k = 0; k < 9 && await page.locator('#slot-v').inputValue(); k += 1) await page.getByRole('button', { name: 'מחיקה', exact: true }).click();
  await expect(page.locator('#slot-v')).toHaveValue('');
  await type(page, it.answer);
  await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
  await expect(page.locator('section.fb-good')).toBeVisible();
});

// a measurement answer (stage 2) has 4 to 6 characters: 75.4, 251.2, 1080, 153.86. On the smallest phone the number slot
// beside the check button shows every digit typed: none is cut off or scrolled out of the slot (MEASURE-1, "nothing right
// is marked wrong … on a 320 px phone"; the slot was 52px wide and showed 251.2 as 251).
test('a 320×568 phone shows every digit of a measurement answer in the slot', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openOn(page, '#/lesson/circle/3', student('8'), (x) => x.form === 'num' && x.after === '\\pi');
  const slot = page.locator('#slot-v');
  await slot.click();
  const seen = async () => slot.evaluate((el) => ({ over: el.scrollWidth - el.clientWidth, font: parseFloat(getComputedStyle(el).fontSize) }));
  for (const value of ['75.4', '251.2', '1080', '153.86', '1004.8']) {
    for (let k = 0; k < 9 && await slot.inputValue(); k += 1) await page.getByRole('button', { name: 'מחיקה', exact: true }).click();
    await type(page, value);
    await expect(slot).toHaveValue(value);
    const s = await seen();
    expect(s.over, `${value}: the whole number shows in the slot`).toBeLessThanOrEqual(1);
    expect(s.font, `${value}: still readable`).toBeGreaterThanOrEqual(14);
  }
  await expectNoSidewaysScroll(page);
  // the row still reads □ π סמ״ק beside the check button
  await expectUsable(page, page.locator('.answer-bar .answer-after'), 'π after the slot');
  await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), 'the check button');
  await page.screenshot({ path: test.info().outputPath('slot-long-phone-small.png') });
});
