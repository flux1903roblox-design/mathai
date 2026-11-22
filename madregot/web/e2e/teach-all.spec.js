// Every stair's teaching can be completed, start to end, through its own screens: understand (every step kind,
// every interactive object), the worked examples step by step, and solving together with the last step typed; each stage
// ends in its completion moment. The stairs come from the skill catalogue itself, so a topic registered there is walked
// here with no change.
import { test, expect } from '@playwright/test';
import { open, student, expectNoSidewaysScroll, leaveStage } from './helpers.js';
import { STAIRS, GRADE_OF as GRADE } from '../src/learn/skills.ts';
import { VISUAL_EXEMPT } from '../src/learn/visualPlan.ts';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'one phone is enough for the content walk'); });
const plain = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e6) / 1e6));
/**
 * Every display of maths on a teaching step shows whole: none is wider than its box, where its end would hide in a
 * scroll box with no bar (a rule cut at "x = 1" for x = 13, or at "V = π·"). FitDisplay sets a long one smaller, and
 * breaks one still too wide after an = sign; a long rule is written on stacked lines.
 */
async function expectDisplaysFit(page, id) {
  // the step on screen is the one the progress bar names (the one before has left and this one has come in)
  const at = Number(await page.locator('.sp-progress').getAttribute('aria-valuenow'));
  await expect(page.locator(`.sp-step[aria-label^="צעד ${at + 1} מתוך"]`), id).toHaveCount(1);
  await expect(page.locator('.sp-step')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.sp-step .katex-display')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1)
    .map((e) => `${e.scrollWidth}>${e.clientWidth}: ${(e.querySelector('annotation')?.textContent || e.textContent).slice(0, 100)}`)), { message: `${id}: a display is cut off`, timeout: 4000 }).toEqual([]);
}

for (const [topic, n] of Object.entries(STAIRS)) {
  for (let level = 1; level <= n; level += 1) {
    test(`${topic}:${level} can be learned from start to end`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // a daily goal the three stages do not reach: the goal's own moment (STUDENT-7) is tested in learn.spec.js
      await open(page, `#/learn/${topic}/${level}/A`, student(GRADE[topic], { goalXp: 50 }));
      await expect(page.locator('.step-player')).toBeVisible();
      // A: every step
      for (let i = 0; i < 20; i += 1) {
        await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
        const st = await page.evaluate(() => window.__madregotStep);
        await expectDisplaysFit(page, `${topic}:${level} A${i} at 390`);
        if (st.kind === 'explore') {
          await expect(page.locator('.ls-explore .manip')).toBeVisible();
          await expect.poll(() => page.evaluate(() => window.__madregotSolveStep?.forStep === window.__madregotStep)).toBe(true);
          await page.evaluate(() => window.__madregotSolveStep());
          await page.locator('.lm-check').click();
          await expect(page.locator('.lm-actions.has-good')).toBeVisible();
        }
        if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); await expect(page.locator('.lm-actions.has-good')).toBeVisible(); }
        const next = page.locator('.sp-next');
        const last = (await next.textContent()).includes('לדוגמה');
        const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
        await next.click();
        if (last) break;
        await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
      }
      // each stage ends in its short completion moment, whose button goes on to the next stage
      await expect(page.locator('.stage-done')).toContainText('שלב 1 הושלם!');
      await leaveStage(page, 'לדוגמה הפתורה'); // the first stage of all brings מדי his first piece, with its moment
      await expect(page).toHaveURL(new RegExp(`learn/${topic}/${level}/B`));
      await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible(); // the first example is on screen
      // B: every worked example, one step at a time
      for (let e = 0; e < 6; e += 1) {
        while (await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).count()) await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).click();
        const go = page.getByRole('button', { name: /לדוגמה הבאה|לפתור יחד/ });
        const label = await go.textContent();
        await go.click();
        if (label.includes('לפתור')) break;
      }
      await expect(page.locator('.stage-done')).toContainText('שלב 2 הושלם!');
      await leaveStage(page, 'לפתור יחד');
      await expect(page).toHaveURL(new RegExp(`learn/${topic}/${level}/C`));
      await expect(page.locator('.stage-done')).toHaveCount(0); // the moment has given way to the first problem
      // C: every guided problem: the right move at each step, then the last step typed
      for (let g = 0; g < 6 && !(await page.locator('.stage-done').count()); g += 1) {
        for (let k = 0; k < 8; k += 1) {
          await expect.poll(() => page.evaluate(() => window.__madregotGuided)).toBeTruthy();
          const gd = await page.evaluate(() => window.__madregotGuided);
          if (gd.final) {
            await page.locator('.tg-input').fill(plain(gd.final.answer));
            await page.getByRole('button', { name: 'בדיקה' }).click();
            await expect(page.getByText('פתרתם את הצעד האחרון לבד')).toBeVisible();
            await page.evaluate(() => { window.__madregotGuided = null; });
            await page.getByRole('button', { name: 'המשך' }).click();
            // the next problem, or the stage's completion moment after the last one
            await expect.poll(async () => (await page.locator('.stage-done').count()) > 0 || !!(await page.evaluate(() => window.__madregotGuided))).toBe(true);
            break;
          }
          const ok = gd.step.choices.findIndex((c) => c.ok);
          const before = gd.step.prompt;
          await page.locator('.tg-step .ls-choice').nth(ok).click();
          await page.locator('.lm-check').click();
          await page.locator('.lm-actions.has-good .sp-next').click();
          await expect.poll(() => page.evaluate(() => window.__madregotGuided?.final ? 'final' : window.__madregotGuided?.step?.prompt)).not.toBe(before);
        }
      }
      await expect(page.locator('.stage-done')).toContainText('שלב 3 הושלם!');
      await expect(page.locator('.stage-done .climb-caption')).toHaveText('3 מתוך 5 שלבים במדרגה');
      // the map is a tap away; the stair's page shows the three teaching stages done
      await leaveStage(page, 'למפה');
      await expect(page.locator('.learn')).toBeVisible();
      await page.goto(`./#/learn/${topic}/${level}`);
      await expect(page.locator('.journey')).toBeVisible();
      await expect(page.locator('.jstage.done')).toHaveCount(3);
      expect(errors).toEqual([]);
    });
  }
}

// The worked examples on the smallest phone (320 wide): no step widens the page, and no line of maths in a step needs
// a sideways scroll inside its box (a 12-year-old does not find a scroll with no bar). Run in the phone project at 320.
for (const [topic, n] of Object.entries(STAIRS)) {
  for (let level = 1; level <= n; level += 1) {
    test(`${topic}:${level} worked examples fit a 320 phone`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await open(page, `#/learn/${topic}/${level}/B`, student(GRADE[topic]));
      for (let e = 0; e < 6; e += 1) {
        await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
        while (await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).count()) await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).click();
        await page.evaluate(() => document.fonts.ready);
        const wide = await page.evaluate(() => [...document.querySelectorAll('.worked-why, .worked-result, .worked-answer, .worked-action')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.className}: ${el.textContent.slice(0, 60)}`));
        expect(wide, `${topic}:${level} example ${e + 1}`).toEqual([]);
        await expectNoSidewaysScroll(page);
        const go = page.getByRole('button', { name: /לדוגמה הבאה|לפתור יחד/ });
        const label = await go.textContent();
        if (label.includes('לפתור')) break;
        await go.click();
      }
    });
  }
}

// STUDENT-8: a picture or an object on every teaching step. On a small phone (320×568), every step of Stage A in every
// topic has its visual region, with a drawing or an object to move in it, at least 120px tall; a step in
// learn/visualPlan.ts VISUAL_EXEMPT is the one allowed to have none. Its maths shows whole too (expectDisplaysFit), as
// it does at 390 in the walk above.
test.describe('every teaching step shows its drawing on a small phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  for (const topic of Object.keys(STAIRS)) {
    for (let level = 1; level <= STAIRS[topic]; level += 1) {
      test(`${topic}:${level}: a drawing on every step at 320px`, async ({ page }) => {
        await open(page, `#/learn/${topic}/${level}/A`, student(GRADE[topic], { goalXp: 50 }));
        let done = false;
        for (let i = 0; i < 20 && !done; i += 1) {
          await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
          const st = await page.evaluate(() => window.__madregotStep);
          // the step on screen is this one: the one before has left and this one has come in (they swap one after the other)
          const at = Number(await page.locator('.sp-progress').getAttribute('aria-valuenow'));
          const id = `${topic}:${level}#${at}`;
          await expect(page.locator(`.sp-step[aria-label^="צעד ${at + 1} מתוך"]`), id).toHaveCount(1);
          await expect(page.locator('.sp-step')).toHaveCount(1);
          const visual = page.locator('.sp-step [data-region="visual"]');
          if (VISUAL_EXEMPT[id]) {
            await expect(visual.locator('.lm-fig, .manip'), `${id} is exempt: ${VISUAL_EXEMPT[id]}`).toHaveCount(0);
          } else {
            await expect(visual, id).toHaveCount(1);
            await expect(visual.locator('.lm-fig [role="img"], .lm-fig table, .manip').first(), `${id}: a drawing or an object`).toBeVisible();
            expect((await visual.boundingBox()).height, `${id}: the visual's height`).toBeGreaterThanOrEqual(120);
          }
          await expectDisplaysFit(page, `${id} at 320`);
          if (st.kind === 'explore') {
            await expect.poll(() => page.evaluate(() => window.__madregotSolveStep?.forStep === window.__madregotStep)).toBe(true);
            await page.evaluate(() => window.__madregotSolveStep());
            await page.locator('.lm-check').click();
          }
          if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
          const next = page.locator('.sp-next');
          done = (await next.textContent()).includes('לדוגמה'); // the last step: every step was measured
          if (!done) {
            const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
            await next.click();
            await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
          }
        }
        expect(done, `${topic}:${level}: reached the last step`).toBe(true);
      });
    }
  }
});

// SK-STUDENT-1: the worked examples (stage B) and solving together (stage C) show their drawings, geometry first. On the
// smallest phone, every angles and Pythagoras problem shows its drawing, and the way on stays in view under it (a worked
// example's first button, the first choice of solving together); in the plane, lines, statistics and fractions at least
// the share learn/visuals.test.ts asks for shows one. Each problem is opened in its place (the place a stage keeps).
const ALL_DRAWN = ['angles', 'pyth', 'pct'];
// the student council's round 3: the signed numbers, the expressions, the equations and systems draw too. Counted as
// the problem opens (a worked example's later steps and a step solved together bring more once shown)
const SOME_DRAWN = { coord: 0.6, line: 0.5, stats: 0.5, frac: 0.4, signed: 0.4, expr: 0.45, eq: 0.5, sys: 0.55 };
const SHOTS_BC = process.env.FIGURE_SHOTS;
test.describe('worked examples and solving together show their drawings on a small phone (SK-STUDENT-1)', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  for (const topic of [...ALL_DRAWN, ...Object.keys(SOME_DRAWN)]) {
    test(`${topic}: the drawings of stages B and C`, async ({ page }) => {
      test.setTimeout(300_000);
      const seen = [];
      for (let level = 1; level <= STAIRS[topic]; level += 1) {
        const skill = `${topic}:${level}`;
        for (const stage of ['B', 'C']) {
          for (let i = 0, of = 1; i < of; i += 1) {
            const learn = { skills: { [skill]: { attempts: [], pos: { [stage]: i } } }, miscon: {}, exam: null, missions: {}, events: [] };
            await open(page, `#/learn/${topic}/${level}/${stage}`, student(GRADE[topic], { learn }));
            const root = page.locator(stage === 'B' ? '.worked' : '.together');
            await expect(root).toBeVisible();
            of = Number(/מתוך (\d+)/.exec(await root.locator('.segs').first().getAttribute('aria-label'))[1]);
            const id = `${skill} ${stage}${i + 1}`;
            const fig = root.locator('.lm-fig [role="img"], .lm-fig table');
            const drawn = (await fig.count()) > 0;
            seen.push({ id, drawn });
            if (drawn) {
              await expect(fig.first(), id).toBeVisible();
              // the drawing never pushes the way on off the screen: a worked example's first button, and in solving
              // together the first choice, at least half of it above the bottom bar
              if (stage === 'B') await expect(page.getByRole('button', { name: 'מתחילים', exact: true }), `${id}: the way on is in view`).toBeInViewport();
              else {
                const choice = await root.locator('.tg-step .ls-choice').first().boundingBox();
                const bar = await root.locator('.lm-actions').first().boundingBox();
                expect(choice.y + choice.height / 2, `${id}: the first choice is in view above the bottom bar`).toBeLessThan(bar.y);
              }
              if (SHOTS_BC) await page.screenshot({ path: `${SHOTS_BC}/${topic}-${level}-${stage}${i + 1}-320.png` });
            }
            await expectNoSidewaysScroll(page);
          }
        }
      }
      if (ALL_DRAWN.includes(topic)) expect(seen.filter((x) => !x.drawn).map((x) => x.id)).toEqual([]);
      else expect(seen.filter((x) => x.drawn).length / seen.length, `${topic}: ${seen.filter((x) => x.drawn).length} of ${seen.length} drawn`).toBeGreaterThanOrEqual(SOME_DRAWN[topic]);
    });
  }
});

// STUDENT-9 §4: nothing that looks active is disabled. Step 1 has no "previous" button at all; step 2 has one.
test('the first teaching step has no "previous" button; the second has a working one', async ({ page }) => {
  await open(page, '#/learn/signed/1/A', student('7'));
  await expect(page.locator('.step-player')).toBeVisible();
  await expect(page.getByRole('button', { name: 'הצעד הקודם' })).toHaveCount(0);
  await expect(page.locator('.sp-back:disabled, .lm-actions button:disabled:not(.lm-check)')).toHaveCount(0);
  const st = await page.evaluate(() => window.__madregotStep);
  if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
  await page.locator('.sp-next').click();
  await expect(page.locator('.sp-progress')).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'הצעד הקודם' }).click();
  await expect(page.locator('.sp-progress')).toHaveAttribute('aria-valuenow', '0');
});

// STUDENT-9 §3, as PRODUCT2-41 set it: flat maths in a sentence is in the sentence's font. In "כש־$x = -3$" the 3 and
// the x are Rubik, the x upright (canon.css .mt-ui; a fraction or a root keeps KaTeX, voice.spec.js); a bare number
// ($16$ on a card) is plain Rubik text.
test('inline maths in a sentence is in the sentence\'s font: digits and letters Rubik, letters upright', async ({ page }) => {
  await open(page, '#/learn/expr/1/A', student('7'));
  for (let i = 0; i < 12; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.text.includes('$x = -3$')) break;
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await page.locator('.sp-next').click();
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  const fonts = await page.locator('.lm-say').evaluate((say) => {
    const leaves = [...say.querySelectorAll('.mt-inline .katex-html .mord')].filter((el) => !el.children.length);
    const three = leaves.find((el) => el.textContent === '3');
    const x = leaves.find((el) => el.textContent === 'x');
    return { three: three && getComputedStyle(three).fontFamily, x: x && getComputedStyle(x).fontFamily, xStyle: x && getComputedStyle(x).fontStyle };
  });
  expect(fonts.three, 'the digit 3 of x = -3').toMatch(/^"?Rubik/);
  expect(fonts.x, 'the letter x').toMatch(/^"?Rubik/);
  expect(fonts.xStyle, 'the letter x, upright').toBe('normal');
  // the answer cards are bare numbers: plain text, no KaTeX
  await expect(page.locator('.ls-choice bdi.num').first()).toBeVisible();
  await expect(page.locator('.ls-choice .katex')).toHaveCount(0);
  const card = await page.locator('.ls-choice bdi.num').first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(card).toMatch(/^"?Rubik/);
});
