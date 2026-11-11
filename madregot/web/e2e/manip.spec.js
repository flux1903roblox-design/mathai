// The interactive exercises: the student moves a maths object (a marker on a number line, a point, a line, a ray,
// the legs of a triangle, a bar) and the state is checked exactly. On every device: the object is whole on screen,
// a real drag moves it, the keyboard and the step buttons move it too, checking is off until it has been moved,
// and the "not yet" and "right" paths work with the object still in view.
import { test, expect } from '@playwright/test';
import { open, student, item, openOn, answer, proceed, expectUsable, expectNoSidewaysScroll } from './helpers.js';

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
