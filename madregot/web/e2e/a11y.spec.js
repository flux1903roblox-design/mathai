// Every screen and state through axe (PKG-1): WCAG 2.0 and 2.1, levels A and AA, with axe-core 4.10.3 (e2e/axe.js).
// Each test opens a screen and walks its states the way a student does; before each scan (a step of its own in the
// report, named after the screen and state) it waits until the screen is drawn: no loading state, its heading on screen,
// its entrances ended. The whole page is scanned. It runs on 'phone' (light) and on 'phone-dark' (playwright.config.js
// adds this file to that project), so every colour pair is checked in both themes. A violation is fixed in the app,
// never scoped out here. Server screens answer from e2e/fakeServer.js (no Worker, no AI, synthetic data).
import { test, expect } from '@playwright/test';
import { NOW, open, openOn, student, livedIn, item, answer, proceed, proceedToNext, appReady, screenReady, DURABLE_DB } from './helpers.js';
import { fakeServer, API, CORS, livePlan } from './fakeServer.js';
import { expectNoAxeViolations } from './axe.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-dark'].includes(info.project.name), 'axe runs on one phone, light and dark'); });

const baseOf = () => test.info().project.use.baseURL;
/** A device that talks to the (fake) server. */
const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true }, ...extra }), version: 3 });

/**
 * The screen is drawn: nothing is loading, its heading is on screen, and its entrances have ended (a fade that is
 * still running would be measured half way; the student reads the screen at its end, as contrast.js measures it).
 * Endless animations (a pulse on the current stair) are left running.
 */
async function drawn(page) {
  await page.waitForFunction(() => !document.querySelector('.loading-state'));
  await expect(page.locator('h1:visible, h2:visible').first()).toBeVisible();
  // quiet for three polls in a row: an exit that ends starts the next screen's entrance a moment later
  await page.evaluate(() => { window.__axeQuiet = 0; });
  await page.waitForFunction(() => {
    const running = document.getAnimations().filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime));
    for (const a of running) { try { a.finish(); } catch { /* cancelled meanwhile */ } }
    window.__axeQuiet = running.length ? 0 : window.__axeQuiet + 1;
    return window.__axeQuiet >= 3;
  }, null, { polling: 100, timeout: 10_000 });
}
/** Scan the page as it is now: each scan is its own step in the report, named after the screen and state. */
async function scan(page, what, opts = {}) {
  return test.step(`axe: ${what}`, async () => {
    await drawn(page);
    await page.evaluate(() => document.fonts.ready);
    return expectNoAxeViolations(page, opts, `${what} (${test.info().project.name})`);
  });
}

// ---------------------------------------------------------------- the first screens (PKG-1d)
test.describe('first visit', () => {
  const next = (page) => page.getByRole('button', { name: 'המשך', exact: true }).click();

  test('Welcome', async ({ page }) => {
    await open(page, '#/');
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
    await scan(page, 'Welcome');
  });

  test('the onboarding questions: name, grade, how much is known, the daily goal, where to start', async ({ page }) => {
    await open(page, '#/');
    await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
    await expect(page.locator('#w-name')).toBeVisible();
    await scan(page, 'the name question');
    await page.fill('#w-name', 'נועה');
    await next(page);
    await expect(page.getByRole('radio', { name: /^כיתה ז׳/ })).toBeVisible();
    await scan(page, 'the grade question');
    await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
    await scan(page, 'the grade question, answered');
    await next(page);
    await expect(page.getByRole('radio', { name: /^קצת מוכר/ })).toBeVisible();
    await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
    await scan(page, 'how much is known');
    await next(page);
    await expect(page.locator('.ob-foot button[type="submit"]')).toBeVisible();
    await scan(page, 'the daily goal');
    await next(page);
    await expect(page.getByRole('radio', { name: /^בדיקת רמה קצרה/ })).toBeVisible();
    await scan(page, 'where to start');
  });

  test('the class step: the code, then the personal PIN', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/', withServer({ profile: null }));
    await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
    await page.fill('#w-name', 'נועה');
    await next(page);
    await page.getByRole('radio', { name: /^כיתה ז׳/ }).click(); await next(page);
    await page.getByRole('radio', { name: /^קצת מוכר/ }).click(); await next(page);
    await next(page); // the daily goal keeps its default
    await expect(page.getByText('יש לכם קוד כיתה מהמורה?')).toBeVisible();
    await scan(page, 'the class step');
    await page.getByLabel('קוד כיתה').fill('K7Q2MD');
    await expect(page.getByLabel('קוד אישי של 4 ספרות')).toBeVisible();
    await scan(page, 'the class step with the PIN');
    await page.getByRole('button', { name: 'הצטרפות לכיתה' }).click(); // no PIN yet: the error line
    await expect(page.getByText('בחרו קוד אישי של 4 ספרות.')).toBeVisible();
    await scan(page, 'the class step with its error');
    await page.getByLabel('קוד אישי של 4 ספרות').fill('2468');
    await page.getByRole('button', { name: 'הצטרפות לכיתה' }).click();
    // joined: the next question, with the toast that says so
    await expect(page.getByText('הצטרפתם לכיתה ז׳3')).toBeVisible();
    await expect(page.getByRole('radio', { name: /^בדיקת רמה קצרה/ })).toBeVisible();
    await scan(page, 'the question after joining, with its toast');
    await page.getByRole('button', { name: 'חזרה', exact: true }).click();
    await expect(page.getByText(/אתם בכיתה ז׳3/)).toBeVisible();
    await scan(page, 'the class step, joined');
  });

  test('the placement test: a question, then the result', async ({ page }) => {
    await open(page, '#/placement', student('7'));
    await expect.poll(() => item(page)).toBeTruthy();
    await scan(page, 'a placement question');
    for (let n = 0; n < 30; n += 1) {
      if (await page.locator('.done-screen').count()) break;
      if (await page.locator('.combo-pop').count()) { await page.locator('.combo-pop').click({ timeout: 1500 }).catch(() => {}); continue; }
      await expect.poll(() => item(page)).toBeTruthy();
      const it = await answer(page, (await item(page)).level <= 2);
      await proceedToNext(page, it);
    }
    await expect(page.getByText('מצאנו את המדרגה שלכם')).toBeVisible();
    await scan(page, 'the placement result');
  });
});

test.describe('the map and the topics', () => {
  test('home for a new student', async ({ page }) => {
    await open(page, '#/', student('7'));
    await expect(page.locator('.learn-top')).toBeVisible();
    await scan(page, 'home, new student');
  });

  test('home for a student with history', async ({ page }) => {
    await open(page, '#/', livedIn('7'));
    await expect(page.locator('.learn-top')).toBeVisible();
    await scan(page, 'home, lived in');
  });

  test('home in grade 8', async ({ page }) => {
    await open(page, '#/', livedIn('8'));
    await expect(page.locator('.learn-top')).toBeVisible();
    await scan(page, 'home, grade 8');
  });

  test('a stair page', async ({ page }) => {
    await open(page, '#/learn/coord/3', livedIn('7'));
    await expect(page.locator('.journey-title')).toBeVisible();
    await scan(page, 'the stair page');
  });

  test('a stair page not yet started', async ({ page }) => {
    await open(page, '#/learn/signed/1', student('7'));
    await expect(page.locator('.journey-title')).toBeVisible();
    await scan(page, 'a new stair page');
  });

  test('Topics', async ({ page }) => {
    await open(page, '#/topics', livedIn('7'));
    await expect(page.locator('.topics-page')).toBeVisible();
    await scan(page, 'Topics');
  });

  test('a topic page', async ({ page }) => {
    await open(page, '#/topic/line', livedIn('8'));
    await scan(page, 'the topic page');
  });

  for (const grade of ['7', '8']) {
    test(`the programme page, grade ${grade}`, async ({ page }) => {
      await open(page, `#/programme?grade=${grade}`);
      await expect(page.getByRole('heading', { level: 1, name: 'מה לומדים במדרגות' })).toBeVisible();
      await scan(page, `the programme, grade ${grade}`);
    });
  }
});

// ---------------------------------------------------------------- the lesson (PKG-1f)
const form = (f, kind) => (it) => it.form === f && (!kind || it.manip?.kind === kind);
const step = (page) => page.evaluate(() => window.__madregotStep);
/** Play the lesson to its first end screen, all answers right. */
async function playLesson(page) {
  for (let n = 0; n < 40 && !(await page.locator('.done-screen').count()); n += 1) {
    // the combo moment closes by itself or on a tap
    if (await page.locator('.combo-pop').count()) { await page.locator('.combo-pop').click({ timeout: 1500 }).catch(() => {}); continue; }
    await proceedToNext(page, await answer(page, true));
  }
  await expect(page.locator('.done-screen').first()).toBeVisible();
}

test.describe('a lesson', () => {
  test('a teaching stage, step by step, and the moment at its end', async ({ page }) => {
    await open(page, '#/learn/signed/1/A', student('7'));
    await expect(page.locator('.step-player')).toBeVisible();
    const seen = new Set();
    for (let i = 0; i < 20; i += 1) {
      await expect.poll(() => step(page)).toBeTruthy();
      await expect(page.locator('.sp-step')).toHaveCount(1); // the step before has gone
      const st = await step(page);
      if (!seen.has(st.kind)) { seen.add(st.kind); await scan(page, `a teaching step (${st.kind})`); }
      if (st.kind === 'explore') {
        if (st.manip.kind === 'numberline') {
          const d = st.answer - st.manip.start;
          for (let k = 0; k < Math.abs(d); k += 1) await page.getByRole('button', { name: d > 0 ? 'הסמן ימינה' : 'הסמן שמאלה' }).first().click();
        }
        await page.locator('.lm-check').click();
        await expect(page.locator('.lm-actions.has-good')).toBeVisible();
        if (!seen.has('explore-good')) { seen.add('explore-good'); await scan(page, 'a teaching step, answered'); }
      }
      if (st.kind === 'predict') {
        const wrong = st.answer === 0 ? 1 : 0;
        if (!seen.has('predict-miss')) {
          seen.add('predict-miss');
          await page.locator('.ls-choice').nth(wrong).click();
          await page.locator('.lm-check').click();
          await scan(page, 'a teaching step, a wrong prediction');
        }
        // after a miss the step shows the right choice itself; otherwise choose it
        const right = page.locator('.ls-choice').nth(st.answer);
        if (await right.isEnabled()) {
          await right.click();
          await page.locator('.lm-check').click();
          await expect(page.locator('.lm-actions.has-good')).toBeVisible();
        }
      }
      const next = page.locator('.sp-next');
      const last = (await next.textContent()).includes('לדוגמה');
      const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
      await next.click();
      if (last) break;
      await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
    }
    await expect(page.locator('.stage-done')).toBeVisible();
    await scan(page, 'StageDone');
  });

  test('a question with the keypad, typed into', async ({ page }) => {
    await openOn(page, '#/lesson/signed/1', student('7'), form('num'));
    // the KaTeX policy (axe.js NOT_JUDGED): the maths' MathML twin is on the page and is scanned with it
    expect(await page.locator('.katex-mathml').count(), 'the question has KaTeX maths').toBeGreaterThan(0);
    await scan(page, 'a keypad question');
    await page.locator('#slot-v').click();
    await page.getByRole('button', { name: '7', exact: true }).click();
    await scan(page, 'a keypad question, typed into');
  });

  test('a choice question, chosen', async ({ page }) => {
    await openOn(page, '#/lesson/signed/2', student('7'), form('mc'));
    await scan(page, 'a choice question');
    await page.locator('.choice').first().click();
    await scan(page, 'a choice question, chosen');
  });

  test('a question with a figure, and the figure enlarged', async ({ page }) => {
    await openOn(page, '#/lesson/coord/1', student('7'), form('pt'));
    await scan(page, 'a point question with its figure');
    const zoom = page.getByRole('button', { name: 'הגדלת השרטוט' });
    if (await zoom.count()) {
      await zoom.click();
      await expect(page.getByRole('dialog', { name: 'השרטוט' })).toBeVisible();
      await scan(page, 'the enlarged figure');
    }
  });

  test('a wrong answer: the try-again panel, then the answer shown, then a right answer', async ({ page }) => {
    await openOn(page, '#/lesson/signed/1', student('7'), form('num'));
    await answer(page, false);
    await expect(page.locator('section.fb-retry')).toBeVisible();
    await scan(page, 'the try-again panel');
    await proceed(page);
    await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    await scan(page, 'the answer shown');
    await proceedToNext(page, await item(page));
    await answer(page, true);
    await expect(page.locator('section.fb')).toBeVisible();
    await scan(page, 'a right answer');
  });

  test('a hint, the "מדי" help sheet and the exit sheet', async ({ page }) => {
    await openOn(page, '#/lesson/signed/1', student('7'), form('num'));
    await page.getByRole('button', { name: 'רמז', exact: true }).click();
    await scan(page, 'a question with its hint');
    await page.getByRole('button', { name: 'שאלה למדי' }).click();
    await expect(page.getByRole('dialog', { name: 'שאלה למדי' })).toBeVisible();
    await scan(page, 'the "מדי" help sheet');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'יציאה מהשיעור' }).click();
    await expect(page.getByRole('dialog', { name: 'לצאת מהשיעור?' })).toBeVisible();
    await scan(page, 'the exit sheet');
  });

  test('the tutor\'s chat sheet in a lesson, asked and answered', async ({ page }) => {
    const FAMILY = `fd1.${'c'.repeat(64)}`;
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    await openOn(page, '#/lesson/signed/1', withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true, familyDevice: { token: FAMILY, label: 'הטאבלט' } } }), form('num'));
    await page.getByRole('button', { name: 'שאלו את העוזר' }).click();
    const sheet = page.getByRole('dialog', { name: 'שאלו את העוזר' });
    await expect(sheet).toBeVisible();
    await scan(page, 'the chat sheet');
    await sheet.getByRole('button', { name: 'איך מתחילים?' }).click();
    await expect(sheet.getByText(/כדי לחבר מספרים/)).toBeVisible();
    await scan(page, 'the chat sheet with an answer');
  });

  test('a class student asks the teacher from a lesson', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    const cls = withServer({ profile: { role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stok-a1', studentId: 'a1' } });
    await openOn(page, '#/lesson/signed/1', cls, form('num'));
    await page.getByRole('button', { name: 'למורה' }).click();
    await expect(page.getByRole('dialog', { name: 'לבקש עזרה מהמורה' })).toBeVisible();
    await scan(page, 'the help-from-the-teacher sheet');
  });

  for (const [kind, route, grade] of [
    ['numberline', 'signed/1', '7'], ['plot', 'coord/1', '7'], ['line', 'line/2', '8'], ['angle', 'angles/1', '7'],
    ['squares', 'pyth/1', '8'], ['bars', 'stats/3', '8'], ['pins', 'signed/2', '7'], ['triangle', 'angles/3', '7'],
    ['balance', 'eq/2', '7'], ['ray', 'sys/5', '8'], ['fbar', 'frac/3', '7'], ['dline', 'ratio/3', '8'],
  ]) {
    test(`an interactive question: ${kind}`, async ({ page }) => {
      await openOn(page, `#/lesson/${route}?part=1`, student(grade), form('manip', kind));
      await expect(page.locator('.manip-canvas')).toBeVisible();
      await scan(page, `the ${kind} object`);
      // one move with its own buttons (the balance has none: a tap on a pan takes a weight off)
      const steps = page.locator('.manip .step-btn:not(:disabled)');
      if (await steps.count()) await steps.first().click();
      else await page.locator('.manip [role="button"]:not([aria-disabled="true"])').first().click();
      await scan(page, `the ${kind} object, moved`);
    });
  }

  test('the floor check and the facts practice', async ({ page }) => {
    await open(page, '#/floor', student('7'));
    await expect.poll(() => item(page)).toBeTruthy();
    await scan(page, 'the floor check');
    await open(page, '#/facts', student('7'));
    await expect.poll(() => item(page)).toBeTruthy();
    await scan(page, 'the facts practice');
  });

  test('a repair, from its first screen into its activity', async ({ page }) => {
    const st = student('7');
    st.state.learn = { skills: {}, events: [], missions: {}, exam: null, miscon: { 'signed:1|minus-minus': { skill: 'signed:1', id: 'minus-minus', score: 2, seen: ['a', 'b'], state: 'confirmed', at: NOW.toISOString() } } };
    st.version = 2;
    await open(page, '#/repair/signed/1/minus-minus', st);
    await expect(page.getByText('נראה שהחלק שמבלבל הוא מה קורה כשמחסרים מספר שלילי')).toBeVisible();
    await scan(page, 'the repair');
    await page.getByRole('button', { name: 'בואו נראה את זה' }).click();
    await expect(page.locator('.step-player')).toBeVisible();
    await scan(page, 'the repair activity');
  });
});

// ---------------------------------------------------------------- the result screens (PKG-1g)
const done = (levels) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) });
/** Every end screen in turn, back to the map, each scanned; returns the kinds scanned. */
async function scanEndScreens(page, what) {
  const kinds = [];
  for (let k = 0; k < 7; k += 1) {
    const screen = page.locator('.done-screen').first();
    if (!(await screen.isVisible().catch(() => false))) return kinds;
    const kind = await screen.evaluate((el) => [...el.classList].find((c) => /-(stage|screen)$/.test(c) && c !== 'done-screen') || 'lesson-done');
    kinds.push(kind);
    await scan(page, `${what}: ${kind}`);
    const title = await page.locator('.done-screen h1').first().textContent();
    await page.locator('.done-screen .done-actions .btn').first().click();
    await expect.poll(async () => (await page.locator('.done-screen h1').first().textContent({ timeout: 500 }).catch(() => null)) !== title).toBe(true);
  }
  return kinds;
}

test.describe('results', () => {
  test('the end of a lesson: the summary, the daily goal, a new accessory and the streak', async ({ page }) => {
    await open(page, '#/lesson/signed/1', student('7', { goalXp: 10, path: { coord: done([1, 2, 3]) } }));
    await playLesson(page);
    const kinds = await scanEndScreens(page, 'after a lesson');
    expect(kinds, 'the summary, the goal, the accessory and the streak were scanned').toEqual(expect.arrayContaining(['lesson-done', 'goal-stage', 'unlock-stage', 'streak-screen']));
  });

  test('a mastery check passed: CheckDone, then a new colour', async ({ page }) => {
    const last = student('7', { path: { angles: done([1, 2, 3, 4]) }, look: { color: 'sky', head: null, face: null, neck: null, body: null, earned: ['protractor-crown'], seen: ['protractor-crown'], earnedAt: { 'protractor-crown': '2026-10-20' } } });
    await open(page, '#/lesson/angles/5?kind=check&purpose=mastery', last);
    for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
    await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
    await scan(page, 'CheckDone, passed');
    await page.getByRole('button', { name: 'למפה' }).click();
    await expect(page.locator('.unlock-stage')).toBeVisible();
    await expect(page.locator('canvas.math-burst'), 'under reduced motion there is no burst').toHaveCount(0);
    await scan(page, 'UnlockStage, a colour');
  });

  test('a mastery check not passed', async ({ page }) => {
    await open(page, '#/lesson/signed/1?kind=check&purpose=mastery', student('7'));
    for (let i = 0; i < 5 && !(await page.locator('.check-done').count()); i += 1) {
      await expect.poll(() => item(page)).toBeTruthy(); await answer(page, i < 2); await proceed(page);
    }
    await expect(page.getByRole('heading', { name: 'עוד לא, וזה בסדר' })).toBeVisible();
    await scan(page, 'CheckDone, not yet');
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('a new colour while the maths burst plays (its canvas is hidden from screen readers)', async ({ page }) => {
      const last = student('7', { path: { angles: done([1, 2, 3, 4]) }, look: { color: 'sky', head: null, face: null, neck: null, body: null, earned: ['protractor-crown'], seen: ['protractor-crown'], earnedAt: { 'protractor-crown': '2026-10-20' } } });
      await open(page, '#/lesson/angles/5?kind=check&purpose=mastery', last);
      for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
      await page.getByRole('button', { name: 'למפה' }).click();
      await expect(page.locator('canvas.math-burst')).toHaveCount(1);
      await expect(page.locator('canvas.math-burst')).toHaveAttribute('aria-hidden', 'true');
      await scan(page, 'UnlockStage with the burst');
    });
  });
});

// ---------------------------------------------------------------- Rescue, Quests and Challenge (PKG-1h)
const exam = (extra = {}) => ({ grade: '7', date: '2026-11-10', skills: ['signed:1', 'signed:2', 'coord:1'], confidence: 2, minutes: 30, createdAt: '2026-11-03T10:00:00.000Z', ...extra });
const withExam = (e) => { const st = student('7'); st.state.learn = { skills: {}, events: [], missions: {}, miscon: {}, exam: e }; st.version = 2; return st; };

test.describe('Exam Rescue', () => {
  test('its first question, and the date error', async ({ page }) => {
    await open(page, '#/rescue', student('7'));
    await expect(page.locator('#exam-date')).toBeVisible();
    await scan(page, 'Rescue, the date question');
    await page.locator('#exam-date').fill('2026-11-07');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('שבת');
    await scan(page, 'Rescue, the date on Shabbat');
    await page.locator('#exam-date').fill('2026-11-10');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await expect(page.getByText('מספרים מכוונים (כל הנושא)')).toBeVisible();
    await scan(page, 'Rescue, the topics question');
  });

  test('the plan before the short check, and the check\'s first question', async ({ page }) => {
    await open(page, '#/rescue', withExam(exam()));
    await expect(page.locator('.rescue-msg')).toContainText('בדיקה קצרה');
    await scan(page, 'the plan before the check');
    await open(page, '#/rescue/check', withExam(exam()));
    await expect.poll(() => item(page)).toBeTruthy();
    await scan(page, 'the short check');
  });

  test('the plan after the check, and the practice exam', async ({ page }) => {
    const at = '2026-11-04T10:00:00.000Z';
    const diagnosed = exam({ diagnostic: { 'signed:1': { asked: 2, right: 2, at }, 'signed:2': { asked: 2, right: 1, at }, 'coord:1': { asked: 2, right: 0, at } } });
    await open(page, '#/rescue', withExam(diagnosed));
    await expect(page.locator('.rescue-day').first()).toBeVisible();
    await scan(page, 'the plan');
    await open(page, '#/rescue/exam', withExam(diagnosed));
    await expect.poll(() => item(page)).toBeTruthy();
    await scan(page, 'the practice exam');
  });
});

/** The class goal, answered by the fake server for a class student (on top of fakeServer's routes). */
async function classGoal(page, goal) {
  await page.route(`${API}/api/class/goal`, (route) => (route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(goal) })));
}
const WEEK = '2026-11-01';
const LAST = '2026-10-25';
const goalOf = (over = {}) => ({ on: true, week: WEEK, target: 60, have: 23, mine: 4, reached: false, last: { week: LAST, target: 55, have: 61, reached: true, mine: 7 }, ...over });
const classStudent = (extra = {}) => withServer({
  profile: { role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stok-a1', studentId: 'a1' },
  nudges: { repairDismissed: null, pbWeek: null, goalSeen: { [LAST]: '2026-10-29' } }, ...extra,
});

test.describe('Quests', () => {
  test('today\'s missions, for a student with history', async ({ page }) => {
    await open(page, '#/quests', livedIn('7'));
    await expect(page.locator('.page-hero-title')).toBeVisible();
    await scan(page, 'Quests');
  });

  test('a class student: the class block and the class goal card', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await classGoal(page, goalOf());
    await open(page, '#/quests', classStudent());
    await expect(page.getByRole('region', { name: 'מטרת הכיתה השבוע' })).toContainText('23 מתוך 60 צעדים');
    await scan(page, 'Quests with the class goal');
  });

  test('the class goal reached: its moment', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await classGoal(page, goalOf({ have: 64, mine: 9, reached: true, last: null }));
    await open(page, '#/', classStudent());
    await expect(page.getByRole('dialog', { name: 'עשינו את זה יחד' })).toBeVisible();
    await scan(page, 'ClassGoalMoment');
  });

  test('Sunday: the recap card and its sheet', async ({ page }) => {
    const at = (day, hh = 15) => `${day}T${String(hh).padStart(2, '0')}:00:00.000Z`;
    const st = {
      ...student('7', {
        days: { '2026-11-08': { lessons: 1, q: 8, ok: 7, secs: 300, xp: 15 }, '2026-11-10': { lessons: 2, stages: 1, mp: 1, q: 16, ok: 14, secs: 600, xp: 30 }, '2026-11-12': { stages: 2, q: 4, ok: 4, secs: 120, xp: 10 } },
        xp: 80,
        learn: {
          skills: { 'signed:1': { attempts: [], mastered: { at: at('2026-11-10', 14), box: 0, due: '2026-11-24T00:00:00.000Z' } } }, miscon: {}, exam: null, missions: {}, floor: null, challenges: {},
          events: [{ t: at('2026-11-08'), e: 'lesson-done', s: 'signed:1', p: 'practice', ok: true }, { t: at('2026-11-10', 14), e: 'check-done', s: 'signed:1', p: 'mastery', ok: true }, { t: at('2026-11-10', 15), e: 'repair-done', s: 'signed:1', m: 'minus-minus', ok: true }, { t: at('2026-11-12'), e: 'stage-A', s: 'signed:2' }],
        },
        look: { color: 'sky', head: null, face: null, neck: null, body: null, earned: ['thermo-scarf'], seen: ['thermo-scarf'], earnedAt: { 'thermo-scarf': '2026-11-12' } },
        durable: { nudgeCount: 2 },
      }),
      version: 6,
    };
    await page.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
    await page.goto('./');
    await page.evaluate(async ([s, db]) => {
      localStorage.clear(); localStorage.setItem('madregot-debug', '1'); localStorage.setItem('madregot', JSON.stringify(s));
      await new Promise((ok) => { const r = indexedDB.deleteDatabase(db); r.onsuccess = ok; r.onerror = ok; r.onblocked = ok; });
    }, [st, DURABLE_DB]);
    await page.goto('./#/');
    await page.reload();
    await appReady(page); await screenReady(page, '#/');
    await expect(page.locator('.recap-card')).toBeVisible();
    await scan(page, 'the recap card');
    await page.locator('.recap-card').getByRole('button', { name: 'לראות' }).click();
    await expect(page.getByRole('dialog', { name: /^השבוע שעבר/ })).toBeVisible();
    await scan(page, 'RecapSheet');
  });
});

test.describe('a challenge', () => {
  const mastered = { attempts: Array.from({ length: 5 }, () => ({ at: '2026-11-04T10:00:00.000Z', ok: true, independent: true, purpose: 'mastery' })), mastered: { at: '2026-11-04T10:00:00.000Z', box: 0, due: '2026-11-08T10:00:00.000Z' } };
  const pctStudent = () => ({
    ...student('8', {
      path: { pct: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered', 2: 'mastered' } } },
      learn: { skills: { 'pct:1': mastered, 'pct:2': mastered }, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {} },
    }),
    version: 6,
  });
  const go = (page, name) => page.locator('.ch-foot .ch-go', { hasText: name });
  const type = async (page, v) => { for (const ch of String(v)) await page.getByRole('button', { name: ch === '.' ? 'נקודה עשרונית' : ch, exact: true }).click(); };

  test('the task, a wrong try, a choice part, the explanation, its self-check and the end', async ({ page }) => {
    await open(page, '#/challenge/pct:c1', pctStudent());
    await expect(page.locator('.ch-title')).toHaveText('שתי דרכים לשלם עמלה');
    await scan(page, 'a challenge task');
    await type(page, '7'); await go(page, 'בדיקה').click();
    await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
    await scan(page, 'a challenge part, a wrong try');
    await type(page, '7.5'); await go(page, 'בדיקה').click(); await go(page, 'המשך').click();
    await type(page, '400'); await go(page, 'בדיקה').click(); await go(page, 'המשך').click();
    await expect(page.getByRole('radio', { name: /מסלול ב/ })).toBeVisible();
    await scan(page, 'a challenge choice part');
    await page.getByRole('radio', { name: /מסלול ב/ }).click(); await go(page, 'בדיקה').click(); await go(page, 'המשך').click();
    await expect(page.locator('.ch-explain')).toBeVisible();
    await scan(page, 'the explanation part');
    await page.locator('.ch-explain').fill('מי שקונה בפחות מ־400 משלם פחות במסלול א.');
    await go(page, 'סיימתי').click();
    await expect(page.getByRole('heading', { name: 'בדקו את התשובה שלכם' })).toBeVisible();
    await scan(page, 'the self-check');
    await go(page, 'לסיום').click();
    await expect(page.getByRole('heading', { name: 'אתגר הושלם. זה לא היה פשוט, והצלחתם.' })).toBeVisible();
    await scan(page, 'the challenge done');
  });
});
