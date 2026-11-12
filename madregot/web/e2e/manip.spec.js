// The interactive exercises: the student moves a maths object (a marker on a number line, a point, a line, a ray,
// the legs of a triangle, a bar) and the state is checked exactly. On every device: the object is whole on screen,
// a real drag moves it, the keyboard and the step buttons move it too, checking is off until it has been moved,
// and the "not yet" and "right" paths work with the object still in view.
import { test, expect } from '@playwright/test';
import { open, student, item, openOn, proceed, expectUsable, expectNoSidewaysScroll } from './helpers.js';
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
