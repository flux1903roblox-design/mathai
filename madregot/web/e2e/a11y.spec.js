// Every screen and state through axe (PKG-1): WCAG 2.0 and 2.1, levels A and AA, with axe-core 4.10.3 (e2e/axe.js).
// Each test opens a screen and walks its states the way a student does; before each scan (a step of its own in the
// report, named after the screen and state) it waits until the screen is drawn: no loading state, its heading on screen,
// its entrances ended. The whole page is scanned. It runs on 'phone' (light) and on 'phone-dark' (playwright.config.js
// adds this file to that project), so every colour pair is checked in both themes. A violation is fixed in the app,
// never scoped out here. Server screens answer from e2e/fakeServer.js (no Worker, no AI, synthetic data).
// The screens, in order: the first visit, the map and the topics, a lesson in all its states, the result screens,
// Rescue, Quests and a challenge (the student's core); the profile, Settings with its saving states, the daily reminder,
// the restore screen and the weekly summary; the tutor with its sheets, the photo check (a photo and a PDF page through
// PhotoPrep) and the exams; the parents' area; the legal and landing pages; and every teacher screen, the demo included.
// The setups the other specs use too (the class, the teachers, the parent and the family devices, the class exam, the
// landing pages) live in helpers.js and fakeServer.js.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import {
  NOW, open, openOn, student, livedIn, item, answer, proceed, proceedToNext, appReady, screenReady, DURABLE_DB,
  withServer, inClass, dressed, doneStairs, linkedWeek, reportWeek, backupFile, examPng, keyTeacher, openLanding, landingMetrics,
} from './helpers.js';
import {
  fakeServer, API, CORS, livePlan, TABLET, examWork, given, PUSH_KEY, PARENT, parentServer, nine, helpNoa, yoavPage,
} from './fakeServer.js';
import { expectNoAxeViolations } from './axe.js';
import { derive } from '../src/lib/durable/crypto.js';
import { makeCode } from '../src/lib/durable/code.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-dark'].includes(info.project.name), 'axe runs on one phone, light and dark'); });

const baseOf = () => test.info().project.use.baseURL;

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

  test('the notebook page (writing the way by hand), empty and written on', async ({ page }) => {
    // the page itself is a drawing a screen reader cannot read (accessibility.md, "מה עוד לא נגיש"); its tools, its
    // name and the way back to the answer are scanned like the rest of the lesson
    await openOn(page, '#/lesson/signed/1', student('7'), form('num'));
    await page.getByRole('button', { name: 'מחברת', exact: true }).click();
    const nb = page.locator('.notebook');
    await expect(nb.getByRole('img', { name: /^דף מחברת/ })).toBeVisible();
    await scan(page, 'the notebook page');
    const box = await nb.locator('canvas').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 70, { steps: 5 });
    await page.mouse.up();
    await expect(nb.getByRole('button', { name: 'בטל' })).toBeEnabled();
    await scan(page, 'the notebook page, written on');
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
const done = doneStairs;
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

// ---------------------------------------------------------------- the profile, Settings and saving (PKG-1j)
test.describe('the profile and Settings', () => {
  test('Me, the profile', async ({ page }) => {
    await open(page, '#/me', livedIn('7'));
    await expect(page.locator('.profile-name')).toBeVisible();
    await scan(page, 'Me');
  });

  test('Me on a device linked to a family plan: the notice, the sharing chip and its sheet', async ({ page }) => {
    await fakeServer(page.context(), { report: true, plan: livePlan(), devices: [{ id: TABLET.id, label: TABLET.label, token: TABLET.token }] }, baseOf());
    await open(page, '#/me', linkedWeek());
    const notice = page.getByRole('dialog', { name: 'ההורים יראו סיכום קצר של התרגול' });
    await expect(notice).toBeVisible();
    await scan(page, 'the sharing notice');
    await notice.getByRole('button', { name: 'הבנתי' }).click();
    await expect(notice).toBeHidden();
    const chip = page.getByRole('button', { name: 'משותף עם ההורים' });
    await expect(chip).toBeVisible();
    await scan(page, 'Me with the sharing chip');
    await chip.click();
    await expect(page.getByRole('dialog', { name: 'שיתוף עם ההורים' }).locator('.sharing-status')).toContainText('פועל');
    await scan(page, 'the sharing sheet');
  });

  test('the wardrobe, and a locked piece\'s sheet', async ({ page }) => {
    await open(page, '#/me/madi', dressed());
    await expect(page.getByRole('heading', { level: 1, name: 'המדי שלי' })).toBeVisible();
    await scan(page, 'the wardrobe');
    const colours = page.getByRole('radiogroup', { name: 'צבע' });
    await colours.getByRole('radio', { name: /^זהב/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'זהב' })).toContainText('נפתח כשתשלטו');
    await scan(page, 'the locked piece\'s sheet');
  });

  test('Settings with no server: the backup file, the reminder\'s line, the delete-all sheet', async ({ page }) => {
    await open(page, '#/settings', livedIn('7'));
    await expect(page.locator('.save-section')).toBeVisible();
    await scan(page, 'Settings, no server');
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    await expect(page.getByRole('dialog', { name: 'למחוק הכול?' })).toBeVisible();
    await scan(page, 'the delete-all sheet');
  });

  test('Settings: a backup file read back (RestorePreview)', async ({ page }) => {
    await open(page, '#/settings', livedIn('7'));
    const sibling = { ...student('8').state, profile: { role: 'student', name: 'יואב', grade: '8', know: 1 }, xp: 75, xpBy: { b2c3d4e5: 75 }, days: { '2026-11-03': { lessons: 2, xp: 75, q: 16, ok: 15 } } };
    await page.getByLabel('לשחזר מקובץ').setInputFiles(backupFile(sibling, 'madregot-backup.json'));
    await expect(page.getByRole('dialog', { name: 'מצאנו גיבוי' }).locator('.restore-summary')).toContainText('יואב');
    await scan(page, 'a backup file\'s preview');
  });

  test('Settings with a server: joining a class, the backup code made, shown and stopped', async ({ page }) => {
    await fakeServer(page.context(), { parentOk: true }, baseOf());
    await open(page, '#/settings', withServer());
    await expect(page.getByRole('button', { name: 'ליצור קוד גיבוי' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'הצטרפות לכיתה' })).toBeVisible();
    await scan(page, 'Settings with a server, the backup off');
    await page.getByRole('button', { name: 'ליצור קוד גיבוי' }).click();
    const sheet = page.getByRole('dialog', { name: 'קוד הגיבוי שלכם' });
    await expect(sheet.locator('.backup-code')).toBeVisible();
    await scan(page, 'the backup code sheet');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'להציג את קוד הגיבוי' })).toBeVisible();
    await scan(page, 'Settings, the backup on');
    await page.getByRole('button', { name: 'להפסיק את הגיבוי' }).click();
    await expect(page.getByRole('dialog', { name: 'להפסיק את הגיבוי?' })).toBeVisible();
    await scan(page, 'stopping the backup');
  });

  test('Settings for a class student whose class keeps the code (escrow)', async ({ page }) => {
    await fakeServer(page.context(), { parentOk: true }, baseOf());
    const code = makeCode();
    const { lookup } = await derive(code);
    const st = inClass();
    st.state.backup = { on: true, code, lookup, rev: null, at: null, hash: null, escrow: 'class', state: 'idle' };
    await open(page, '#/settings', st);
    await expect(page.getByRole('switch', { name: 'שמירת עותק בשרת הכיתה' })).toBeChecked();
    await expect(page.locator('.save-kept')).toBeVisible();
    await scan(page, 'Settings, the class keeps the code');
  });

  test('Settings › מתקדם: the public build has no such screen, and the address leads back to Settings', async ({ page }) => {
    // the personal-key screen exists only in the owner's own test builds (VITE_ALLOW_PERSONAL_KEY=1); every copy
    // people use, this suite's included, sends its address back to Settings, which is scanned here once more
    await open(page, '#/settings/advanced', livedIn('7'));
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'הגדרות' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'מתקדם' })).toHaveCount(0);
    await scan(page, 'Settings, from the advanced address');
  });

  test('the restore screen: the code, a typing mistake, and the file', async ({ page }) => {
    await fakeServer(page.context(), { parentOk: true }, baseOf());
    await open(page, '#/restore', withServer({ profile: null }));
    const input = page.getByLabel('קוד הגיבוי');
    await expect(input).toBeVisible();
    await scan(page, 'Restore, the code');
    await input.fill('ABCD-EFGH');
    await page.getByRole('button', { name: 'לחפש את הגיבוי' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await scan(page, 'Restore, a typing mistake');
    await page.getByRole('button', { name: 'יש לי קובץ גיבוי' }).click();
    await expect(page.getByLabel('לשחזר מקובץ')).toBeAttached();
    await scan(page, 'Restore, the file');
  });

  test('the weekly summary and its share sheet', async ({ page }) => {
    await open(page, '#/report', reportWeek());
    await expect(page.getByRole('heading', { level: 1, name: 'הסיכום השבועי' })).toBeVisible();
    await scan(page, 'the weekly summary');
    await page.getByRole('button', { name: 'לשלוח להורים' }).click();
    await expect(page.getByRole('dialog', { name: 'לשלוח להורים' })).toBeVisible();
    await scan(page, 'the share sheet');
  });
});

test.describe('the daily reminder', () => {
  // the browser's answer about notifications is played (this headless browser always says 'denied'; push.spec.js drives
  // the real permission in the full Chromium); the reminder's id and secret are seeded, so Settings shows it on with no
  // push service. Nothing here is subscribed or sent.
  const notifications = (page, answer) => page.addInitScript((a) => { Object.defineProperty(Notification, 'permission', { configurable: true, get: () => a }); }, answer);

  test('Settings: the daily reminder on, with its hour', async ({ page }) => {
    await notifications(page, 'granted');
    await fakeServer(page.context(), { parentOk: true, push: { key: PUSH_KEY } }, baseOf());
    await open(page, '#/settings', withServer({ reminder: { on: true, slot: 17, id: 'a'.repeat(16), secret: 'b'.repeat(32), state: 'on' } }));
    const section = page.getByRole('region', { name: 'תזכורת יומית' });
    await expect(section.getByRole('radio', { name: 'פועלת' })).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByRole('radiogroup', { name: 'באיזו שעה?' })).toBeVisible();
    await section.scrollIntoViewIfNeeded();
    await scan(page, 'Settings, the reminder on');
  });

  test('the reminder\'s offer after a lesson (ReminderCard)', async ({ page }) => {
    await notifications(page, 'default');
    await fakeServer(page.context(), { parentOk: true, push: { key: PUSH_KEY } }, baseOf());
    const days = { '2026-11-03': { lessons: 1, xp: 12, q: 8, ok: 7 }, '2026-11-04': { lessons: 1, xp: 12, q: 8, ok: 7 } };
    await open(page, '#/lesson/signed/1', withServer({ days }));
    await playLesson(page);
    // through the end screens to the reminder's offer (push.spec.js walks them the same way)
    const heading = () => page.locator('.done-screen h1').first().textContent({ timeout: 1000 }).catch(() => null);
    for (let k = 0; k < 8; k += 1) {
      await expect(page.locator('.remind-stage, .learn-top, .done-screen .done-actions .btn').first()).toBeVisible();
      if (await page.locator('.remind-stage, .learn-top').first().isVisible()) break;
      const before = await heading();
      await page.locator('.done-screen .done-actions .btn').first().click();
      await expect.poll(async () => { const now = await heading(); return now === null || now !== before; }, { timeout: 5000 }).toBe(true);
    }
    await expect(page.locator('.remind-stage')).toBeVisible();
    await scan(page, 'the reminder\'s offer');
  });

  test('Settings: notifications blocked by the browser, the line that says so', async ({ page }) => {
    await fakeServer(page.context(), { parentOk: true }, baseOf());
    await notifications(page, 'denied');
    await open(page, '#/settings', withServer());
    await expect(page.getByRole('region', { name: 'תזכורת יומית' })).toContainText('הדפדפן חוסם התראות');
    await scan(page, 'Settings, notifications blocked');
  });
});

// ---------------------------------------------------------------- the tutor and the exams (PKG-1k)
const FD = `fd1.${'c'.repeat(64)}`;
/** A device on the family plan: the photo check and the exam check are open (trust spec TRUST-5). */
const family = (extra = {}) => withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true, familyDevice: { token: FD, label: 'הטאבלט' } }, ...extra });
async function familyServer(page) {
  const server = await fakeServer(page, { parentOk: true }, baseOf());
  server.st.devices.push({ id: 'd1', label: 'הטאבלט', token: FD }); server.st.plan = livePlan();
  return server;
}
const PDF = fileURLToPath(new URL('./fixtures/exam-2-pages.pdf', import.meta.url));
const warnSheet = (page) => page.getByRole('dialog', { name: 'לפני שמצלמים' });
const prepSheet = (page) => page.getByRole('dialog', { name: 'מסתירים פרטים אישיים' });
const refuseClassAi = (route) => (route.request().method() === 'OPTIONS'
  ? route.fulfill({ status: 204, headers: CORS })
  : route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: 'class_ai_off', message: 'class_ai_off' }) }));
// an exam checked by the AI, one question wrong (tutor.spec.js reads the same kind)
const checkedQ = { number: '1', prompt: 'פתרו: $2x + 3 = 11$', studentAnswer: '$x = 5$', status: 'wrong', correctAnswer: '$x = 4$', feedback: 'כדאי לבדוק את החיסור.', solution: ['$2x = 8$', '$x = 4$'], topic: 'eq', level: 2, skill: 'משוואה בשני צעדים', graded: 'ai' };
const keyQ = { number: '2', prompt: 'חשבו: $3 - (-5)$', studentAnswer: '$8$', status: 'correct', correctAnswer: '8', feedback: 'חיסור של שלילי הוא חיבור, ועשיתם את זה נכון.', solution: ['$3 - (-5) = 3 + 5 = 8$'], topic: 'signed', level: 1, skill: 'חיבור וחיסור', graded: 'key', overridden: true, item: { text: 'חשבו:', display: '3 - (-5)', fig: null, form: 'num', choices: null } };
const checkedExam = { id: 'ex1', at: '2026-11-04T10:00:00.000Z', title: 'מבחן במשוואות', source: 'upload', practiceId: null, result: { readable: true, title: 'מבחן במשוואות', questions: [checkedQ, keyQ], summary: 'כמעט.', weakTopics: [], nextSteps: [], care: false }, score: { correct: 1, total: 2, pct: 50 }, levels: {} };

test.describe('the tutor', () => {
  test('the assistant: a question and its finished reply', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/assistant', withServer());
    await expect(page.getByText('שאלו כל שאלה במתמטיקה')).toBeVisible();
    await scan(page, 'the assistant');
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך מחברים 3 ועוד מינוס 5?'); await draft.press('Enter');
    await expect(page.locator('.msg-row.assistant').last()).toContainText('כדי לחבר מספרים');
    await scan(page, 'the assistant with a reply');
  });

  test('the assistant with no server: not connected, and the support sheet from it', async ({ page }) => {
    await open(page, '#/assistant', student('7'));
    await expect(page.getByRole('heading', { name: 'העוזר עוד לא מחובר' })).toBeVisible();
    await scan(page, 'the assistant, not connected');
    await page.getByRole('button', { name: 'צריכים לדבר עם מישהו?' }).click();
    await expect(page.getByRole('dialog', { name: 'חשוב לנו שתהיו בסדר' })).toBeVisible();
    await scan(page, 'the support sheet');
  });

  test('a message that reads as distress: the support card in the chat', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await page.route(`${API}/api/ai/chat`, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      log.push({ path: '/api/ai/chat' });
      return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: CORS, body: 'תודה שכתבתם. מה שאתם מרגישים חשוב. אפשר להתקשר לער״ן, 1201, בכל שעה.\n[[care]]' });
    });
    await open(page, '#/assistant', withServer());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('אני רוצה להיעלם'); await draft.press('Enter');
    await expect(page.locator('.chat .support-card')).toBeVisible();
    await expect(page.locator('.msg-row.assistant').last()).toContainText('תודה שכתבתם');
    await scan(page, 'the support card in the chat');
  });

  test('the tutor\'s introduction (AIIntro) before the first message', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/assistant', withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '' } }));
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('מה זה מספר שלילי?'); await draft.press('Enter');
    await expect(page.getByRole('dialog', { name: 'לפני שמתחילים עם העוזר החכם' })).toBeVisible();
    await scan(page, 'the tutor\'s introduction');
  });

  test('a class whose AI is off: the assistant says so', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await page.route(`${API}/api/ai/status`, refuseClassAi);
    await open(page, '#/assistant', inClass());
    await expect(page.getByRole('heading', { name: 'בכיתה הזו העוזר החכם כבוי' })).toBeVisible();
    await scan(page, 'the assistant, class AI off');
  });

  test('a class whose AI is off: the sheet after a refused answer', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf()); // the status still says free: the refusal comes with the answer
    await page.route(`${API}/api/ai/chat`, refuseClassAi);
    await open(page, '#/assistant', inClass());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך פותרים 3x = 12?'); await draft.press('Enter');
    await expect(page.getByRole('dialog', { name: 'בכיתה הזו העוזר החכם כבוי' })).toBeVisible();
    await scan(page, 'the class-AI-off sheet');
  });

  test('waiting for a parent\'s OK: the assistant and the sheet', async ({ page }) => {
    await fakeServer(page, {}, baseOf()); // parentOk false, as on the real server
    await open(page, '#/assistant', withServer());
    await expect(page.getByRole('heading', { name: 'קודם, אישור של הורה' })).toBeVisible();
    await scan(page, 'the assistant, waiting for a parent');
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('מה זה שבר?'); await draft.press('Enter');
    await expect(page.getByRole('dialog', { name: 'קודם, אישור של הורה' })).toBeVisible();
    await scan(page, 'the parent-OK sheet');
  });

  test('the limit sheet in a lesson', async ({ page }) => {
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/lesson/signed/1', withServer());
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    st.freeLimit = 0;
    await page.getByRole('button', { name: 'למה טעיתי?' }).click();
    await expect(page.getByRole('dialog', { name: 'העוזר החכם חוזר מחר' })).toBeVisible();
    await scan(page, 'the limit sheet');
  });

  test('a class student: the help request\'s support card (SupportCard) after a note that reads as distress', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await page.route(`${API}/api/help`, (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      log.push({ path: '/api/help' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"ok":true}' });
    });
    await open(page, '#/lesson/signed/1', inClass());
    await page.getByRole('button', { name: 'למורה' }).click();
    const sheet = page.getByRole('dialog', { name: 'לבקש עזרה מהמורה' });
    await sheet.getByLabel('מה לא ברור? (לא חובה)').fill('לא הבנתי, וגם עושים לי חרם בכיתה');
    await sheet.getByRole('button', { name: 'שליחה למורה' }).click();
    await expect(sheet.locator('.support-card')).toBeVisible();
    await scan(page, 'the support card in the help sheet');
  });

  test('the photo check: the tool, the warning, PhotoPrep on a photo, and the result', async ({ page }) => {
    await familyServer(page);
    await open(page, '#/assistant', family());
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    const sheet = page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' });
    await expect(sheet.getByRole('button', { name: 'צילום הדף' })).toBeVisible();
    await scan(page, 'the photo check');
    await sheet.getByRole('button', { name: 'צילום הדף' }).click();
    await expect(warnSheet(page)).toBeVisible();
    await scan(page, 'PhotoWarn');
    const camera = page.waitForEvent('filechooser');
    await warnSheet(page).getByRole('button', { name: 'הבנתי, לצלם' }).click();
    await (await camera).setFiles({ name: 'work.png', mimeType: 'image/png', buffer: await examPng(page) });
    await expect(prepSheet(page).getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toBeVisible();
    await scan(page, 'PhotoPrep on a photo');
    await prepSheet(page).getByRole('button', { name: 'הוספת מלבן' }).click();
    await expect(prepSheet(page).getByRole('button', { name: 'מלבן שחור 1' })).toBeFocused();
    await scan(page, 'PhotoPrep with a box');
    await prepSheet(page).getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(sheet.getByRole('img', { name: 'התמונה שבחרתם' })).toBeVisible();
    await scan(page, 'the photo check, a picture chosen');
    await sheet.getByRole('button', { name: 'בדיקת הפתרון' }).click();
    await expect(sheet.getByText('התשובה הסופית נכונה.')).toBeVisible();
    await scan(page, 'the photo check\'s result');
  });

  test('the free tutor\'s photo check: what it is, before any upload', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/assistant', withServer());
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    await expect(page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' }).getByText('את הבדיקה הזו עושה העוזר החכם המלא.')).toBeVisible();
    await scan(page, 'the photo check, locked');
  });
});

test.describe('the exams', () => {
  test('the exams list', async ({ page }) => {
    await open(page, '#/exams', family({ exams: [checkedExam] }));
    await expect(page.getByRole('heading', { name: 'מבחנים שנבדקו' })).toBeVisible();
    await scan(page, 'the exams list');
  });

  test('the exam check: locked on the free tutor', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/exams/check', withServer());
    await expect(page.getByText('את בדיקת המבחן עושה העוזר החכם המלא.')).toBeVisible();
    await scan(page, 'the exam check, locked');
  });

  test('the exam check: the pages, PhotoPrep on a PDF page, the pages chosen', async ({ page }) => {
    await familyServer(page);
    await open(page, '#/exams/check', family());
    await expect(page.getByRole('button', { name: 'תמונה או PDF' })).toBeVisible();
    await scan(page, 'the exam check');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'תמונה או PDF' }).click();
    await warnSheet(page).getByRole('button', { name: 'הבנתי, לצלם' }).click();
    await (await chooser).setFiles(PDF);
    const prep = prepSheet(page);
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '15');
    await scan(page, 'PhotoPrep on a PDF page');
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '0');
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(prep).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'דף 2' })).toBeVisible();
    await scan(page, 'the exam check with two pages');
  });

  test('a checked exam (ExamResult) and its question sheet', async ({ page }) => {
    await familyServer(page);
    await open(page, '#/exams/ex1', family({ exams: [checkedExam] }));
    await expect(page.locator('.q-card')).toHaveCount(2);
    await scan(page, 'ExamResult');
    await page.getByRole('button', { name: 'שאלו על השאלה' }).first().click();
    await expect(page.getByRole('dialog', { name: 'שאלה 1' })).toBeVisible();
    await scan(page, 'a question\'s sheet');
  });

  test('a new practice exam (NewPracticeExam), then its sheet (PracticeSheet)', async ({ page }) => {
    await open(page, '#/exams/new', livedIn('7'));
    await scan(page, 'NewPracticeExam, the topics');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /10 שאלות/ }).click();
    await scan(page, 'NewPracticeExam, the length');
    await page.getByRole('button', { name: 'הכנת המבחן' }).click();
    await expect(page.locator('.exam-q')).toHaveCount(10);
    await scan(page, 'PracticeSheet');
  });

  test('a class exam from the teacher (ClassExam)', async ({ page }) => {
    await fakeServer(page, { today: '2026-11-09', assignments: [examWork()] }, baseOf());
    await open(page, '#/class/exam/a000000000000004', inClass(), undefined, { at: new Date('2026-11-09T10:00:00') });
    await expect(page.getByRole('heading', { level: 1, name: 'מבחן תרגול: לפני החנוכה' })).toBeVisible();
    await scan(page, 'ClassExam');
  });
});

// ---------------------------------------------------------------- the parents' area (PKG-1n)
/** The parent's own phone: no student profile, the app pointed at the fake server, and (signedIn) the parent's session. */
const parentPhone = () => withServer({ profile: null });
const session = { 'madregot-parent': JSON.stringify({ token: PARENT, email: 'parent@example.test' }) };

test.describe('the parents\' area', () => {
  test('the adult step on a child\'s device, open and then closed for a child\'s year', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/parents?here=1', withServer());
    const gate = page.locator('.adult-gate');
    await expect(gate.getByRole('heading', { name: 'המסך הזה בשביל ההורים' })).toBeVisible();
    await scan(page, 'the adult step');
    await gate.getByLabel('שנת הלידה שלכם').fill('2013');
    await gate.getByRole('button', { name: 'המשך' }).click();
    await expect(gate.getByText('המסך הזה מיועד להורים.', { exact: false })).toBeVisible();
    await scan(page, 'the adult step, closed');
  });

  test('the parents\' sign-in: the email, then the code, then a wrong code', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/parents', parentPhone());
    await expect(page.getByRole('heading', { name: 'כניסה עם המייל' })).toBeVisible();
    await scan(page, 'the parents\' sign-in');
    await page.getByLabel('כתובת המייל שלכם').fill('parent@example.test');
    await page.getByRole('button', { name: 'שליחת קוד' }).click();
    await expect(page.getByText('שלחנו קוד בן 6 ספרות אל')).toBeVisible();
    await scan(page, 'the code form');
    await page.getByLabel('הקוד מהמייל').fill('111111');
    await expect(page.getByRole('alert')).toContainText('הקוד לא נכון');
    await scan(page, 'a wrong code');
  });

  test('/parents signed in: the plan card, the cancel sheet, the devices', async ({ page }) => {
    const { st } = await fakeServer(page, { parentOk: true, plan: livePlan() }, baseOf());
    st.sessions.add(PARENT);
    st.devices.push({ id: 'd000000000000009', label: 'הטאבלט', token: `fd1.${'9'.repeat(64)}` });
    await open(page, '#/parents', parentPhone(), undefined, { local: session });
    await expect(page.getByRole('heading', { name: /^המנוי פעיל/ })).toBeVisible();
    await scan(page, '/parents with a plan');
    await page.getByRole('button', { name: 'מכשירים מחוברים (1)' }).click();
    await expect(page.getByRole('button', { name: 'ניתוק' })).toBeVisible();
    await scan(page, '/parents, the devices open');
    await page.getByRole('button', { name: 'ביטול המנוי' }).click();
    await expect(page.getByRole('dialog', { name: 'לבטל את המנוי?' })).toBeVisible();
    await scan(page, 'the cancel sheet');
  });

  test('/parents signed in with no plan: the plans', async ({ page }) => {
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    st.sessions.add(PARENT);
    await open(page, '#/parents', parentPhone(), undefined, { local: session });
    await expect(page.getByRole('heading', { name: 'אין מנוי פעיל' })).toBeVisible();
    await scan(page, '/parents, no plan');
  });

  test('the parents\' report (.parents-report): each device\'s week, the 8 weeks, the switches', async ({ page }) => {
    await parentServer(page.context(), baseOf());
    await open(page, '#/parents', parentPhone(), undefined, { local: session });
    await expect(page.getByRole('heading', { level: 2, name: 'ההתקדמות' })).toBeVisible();
    await expect(page.locator('.report-device-head h3')).toHaveText(['הטאבלט', 'הטלפון']);
    await expect(page.locator('.weeks-chart table tbody tr').first()).toBeAttached();
    await page.locator('.parents-report').scrollIntoViewIfNeeded();
    await scan(page, 'the parents\' report');
    const tablet = page.locator('.report-device').filter({ has: page.getByRole('heading', { level: 3, name: 'הטאבלט', exact: true }) });
    await tablet.getByRole('radio', { name: 'השבוע שעבר' }).click();
    await expect(tablet.locator('.report-dates')).toHaveText('א׳ 25.10 – ש׳ 31.10');
    await scan(page, 'the parents\' report, last week');
    await tablet.getByRole('button', { name: 'לכבות' }).click();
    await expect(tablet.getByText('כיביתם את הסיכום מהמכשיר הזה.')).toBeVisible();
    await scan(page, 'the parents\' report, a device switched off');
  });

  test('the parents\' report on the first day: a device linked with nothing yet', async ({ page }) => {
    await parentServer(page.context(), baseOf(), { summaries: {} });
    await open(page, '#/parents', parentPhone(), undefined, { local: session });
    await expect(page.getByRole('heading', { level: 2, name: 'ההתקדמות' })).toBeVisible();
    await scan(page, 'the parents\' report, nothing yet');
  });

  test('/parents/link: the consent for the child\'s device', async ({ page }) => {
    const { st } = await fakeServer(page, { links: { K7M4QX: { secret: 'f'.repeat(32), claimed: false, collected: false } } }, baseOf());
    st.sessions.add(PARENT);
    await open(page, '#/parents/link?c=K7M4QX', parentPhone(), undefined, { local: session });
    const card = page.locator('section', { has: page.getByRole('heading', { name: 'אישור העוזר החכם במכשיר של הילד' }) });
    await expect(card).toBeVisible();
    await scan(page, '/parents/link');
    await card.getByRole('button', { name: 'אישור וחיבור המכשיר' }).click();
    await expect(card.getByRole('alert')).toBeVisible();
    await scan(page, '/parents/link, the box not ticked');
  });

  test('/parents/info: the screen for the parents on the child\'s device', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/parents/info', withServer());
    await expect(page.getByRole('heading', { name: 'המסך הזה בשביל ההורים' })).toBeVisible();
    await expect(page.locator('.handoff-code')).toHaveText('K7M4QX');
    await scan(page, '/parents/info');
  });

  test('/cancel: signed out', async ({ page }) => {
    await fakeServer(page, { parentOk: true, plan: livePlan({ canRefundNow: false }) }, baseOf());
    await open(page, '#/cancel', parentPhone());
    await expect(page.getByRole('heading', { name: 'ביטול מנוי' })).toBeVisible();
    await scan(page, '/cancel');
  });

  test('the shared report (/r/:data), and a cut link', async ({ page }) => {
    await open(page, '#/report', reportWeek());
    await page.getByRole('button', { name: 'לשלוח להורים' }).click();
    const href = await page.getByRole('dialog', { name: 'לשלוח להורים' }).getByRole('link', { name: 'וואטסאפ' }).getAttribute('href');
    const payload = /#\/r\/(1\.[A-Za-z0-9_-]+)/.exec(decodeURIComponent(href))[1];
    await open(page, `#/r/${payload}`);
    await expect(page.getByRole('link', { name: 'מה זה מדרגות?' })).toBeVisible();
    await scan(page, 'the shared report');
    await open(page, `#/r/${payload.slice(0, 20)}`);
    await scan(page, 'a cut link');
  });
});

// ---------------------------------------------------------------- the public pages (PKG-1o)
const LEGAL = [['#/privacy', 'מדיניות פרטיות'], ['#/terms', 'תקנון'], ['#/accessibility', 'הצהרת נגישות'], ['#/safety', 'בטיחות בעוזר החכם']];
test.describe('the public pages', () => {
  test('the legal pages with no server: the draft banner and the blanks', async ({ page }) => {
    await open(page, '#/');
    for (const [route, title] of LEGAL) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole('note')).toHaveText('טיוטה לבדיקה משפטית. הנוסח עוד לא סופי.');
      await scan(page, `${title}, no server`);
    }
  });

  test('the legal pages with a server: approved, the details filled in', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/privacy', withServer());
    for (const [route, title] of LEGAL) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole('note')).toHaveCount(0); // approved: no draft banner
      await expect(page.locator('article.legal')).not.toContainText('______'); // the details are filled in
      await scan(page, `${title}, approved`);
    }
  });

  test('the legal pages with a server whose texts wait for the lawyer: the draft banner and the details', async ({ page }) => {
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    st.legalApproved = false;
    await open(page, '#/terms', withServer());
    await expect(page.getByRole('note')).toHaveText('טיוטה לבדיקה משפטית. הנוסח עוד לא סופי.');
    await expect(page.locator('article.legal')).toContainText('מדרגות בדיקה, עוסק מורשה 000000000');
    await scan(page, 'the terms, a draft with the details');
  });

  for (const [path, title] of [['mivchan/', 'מבחן במתמטיקה ביום חמישי?'], ['pilot/', null]]) {
    test(`the landing page /${path}`, async ({ page }) => {
      await landingMetrics(page);
      await openLanding(page, path);
      if (title) await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      else await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scan(page, `the landing page /${path}`);
    });
  }
});

// ---------------------------------------------------------------- the teacher (PKG-1p)
const EMAIL = 'teacher@example.test';
const tools = (page) => page.getByRole('navigation', { name: 'כלים' });
/** A class of nine with work, mistakes, help and a page for יואב (fakeServer.js's TEACHER-8 class). */
const richClass = () => ({
  students: nine(), help: helpNoa(), studentPages: { s2: yoavPage() }, assignments: [given({ startsOn: '2026-11-02', createdAt: '2026-11-02T07:00:00.000Z' })],
  mistakes: [{ topic: 'signed', cat: 'sign', level: 1, n: 3, students: 2, ids: ['s1', 's2'], names: ['דנה', 'יואב'] }],
});

test.describe('the teacher', () => {
  test('TeacherStart: the way in, the email, the code, the class\'s details, the class ready', async ({ page }) => {
    await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', withServer({ profile: null }));
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await expect(page.getByText('שלום! איך נכנסים ללוח המורה?')).toBeVisible();
    await scan(page, 'TeacherStart, the way in');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await expect(page.getByText('מה המייל שלכם?')).toBeVisible();
    await scan(page, 'TeacherStart, the email');
    await page.getByLabel('כתובת המייל שלכם').fill(EMAIL);
    await page.getByRole('button', { name: 'שליחת קוד' }).click();
    await expect(page.getByLabel('הקוד מהמייל')).toBeVisible();
    await scan(page, 'TeacherStart, the code');
    await page.getByLabel('הקוד מהמייל').fill('123456');
    await expect(page.getByText('איך קוראים לכם ולכיתה?')).toBeVisible();
    await scan(page, 'TeacherStart, the details');
    await page.locator('#t-name').fill('רונית כהן');
    await page.locator('#t-class').fill('ז׳3');
    await page.getByRole('button', { name: 'פתיחת הכיתה' }).click();
    await expect(page.getByRole('heading', { name: 'הכיתה מוכנה!' })).toBeVisible();
    await scan(page, 'the class ready (FreshClass)');
  });

  test('the board: מחר, משימות, תלמידים, מבחנים, עזרה', async ({ page }) => {
    await fakeServer(page, richClass(), baseOf());
    await open(page, '#/teacher', keyTeacher());
    await expect(page.getByRole('region', { name: 'כדאי לבדוק איתם' }).locator('.t-row')).toHaveCount(6);
    await scan(page, 'the board, מחר');
    for (const tab of [/^משימות/, /^תלמידים/, /^מבחנים/, /^עזרה/]) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
      await scan(page, `the board, ${tab.source.slice(1)}`);
    }
  });

  test('the board\'s sheets: a student\'s page, giving work, the work\'s detail, another class', async ({ page }) => {
    await fakeServer(page, richClass(), baseOf());
    await open(page, '#/teacher', keyTeacher());
    const group = page.getByRole('region', { name: 'כדאי לבדוק איתם' });
    await group.getByRole('button', { name: 'יואב', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'יואב' });
    await expect(sheet.getByRole('heading', { name: 'מבחנים', exact: true })).toBeVisible();
    await scan(page, 'a student\'s page (StudentSheet)');
    await sheet.getByRole('button', { name: 'לתת תרגול' }).click();
    await expect(page.getByRole('dialog', { name: 'משימה לכיתה ז׳3' })).toBeVisible();
    await scan(page, 'giving work (AssignSheet)');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: /^משימות/ }).click();
    await page.locator('.tw-row').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'the work\'s detail (AssignmentSheet)');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'כיתה נוספת' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'another class');
  });

  test('the lessons, and a lesson in the student view (PreviewFrame)', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await tools(page).getByRole('link', { name: 'השיעורים' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'השיעורים של כיתה ז׳' })).toBeVisible();
    await scan(page, 'the lessons');
    await page.getByRole('region', { name: 'מספרים מכוונים' }).getByRole('link', { name: 'לשיעור: חיבור וחיסור' }).click();
    const bar = page.getByRole('region', { name: 'תצוגת תלמיד' });
    await expect(bar).toBeVisible();
    await expect(page.getByRole('list', { name: 'שלבי המדרגה' })).toBeVisible();
    await scan(page, 'a stair in the student view');
    await page.evaluate(() => { window.location.hash = '#/lesson/signed/1'; });
    await expect.poll(() => item(page)).toBeTruthy();
    await expect(bar).toBeVisible();
    await scan(page, 'a lesson in the student view');
  });

  test('the class settings: the class AI card, the licence, and the delete flow', async ({ page }) => {
    await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/teacher/settings', keyTeacher());
    await expect(page.getByRole('region', { name: 'העוזר החכם לתלמידים' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'הצעת מחיר לבית הספר' })).toBeVisible();
    await scan(page, 'the class settings');
    await page.getByRole('button', { name: 'מחיקת הכיתה' }).click();
    const sheet = page.getByRole('dialog', { name: 'למחוק את הכיתה ז׳3?' });
    await expect(sheet).toBeVisible();
    await scan(page, 'deleting the class');
    await sheet.getByLabel('כדי לאשר, כתבו את שם הכיתה: ז׳3').fill('ז׳3');
    await expect(sheet.getByRole('button', { name: 'כן, למחוק את הכיתה' })).toBeEnabled();
    await scan(page, 'deleting the class, the name typed');
  });

  test('the class settings, AI approved: the consent and then the switch', async ({ page }) => {
    const { st } = await fakeServer(page.context(), { owned: true, ai: { approval: 'approved', consentAt: '2026-11-01T10:00:00.000Z', studentAi: 'on' } }, baseOf());
    st.sessions.add(PARENT);
    await open(page, '#/teacher/settings', keyTeacher(), undefined, { local: { 'madregot-parent': JSON.stringify({ token: PARENT, email: EMAIL }) } });
    const card = page.getByRole('region', { name: 'העוזר החכם לתלמידים' });
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await scan(page, 'the class AI card, approved');
  });

  test('the class report', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher/report', keyTeacher());
    await expect(page.getByRole('heading', { name: 'דוח הכיתה' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'טבלת הדוח' })).toBeVisible();
    await scan(page, 'the class report');
  });

  test('the teacher\'s assistant, asked and answered', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/teacher/assistant', keyTeacher());
    await expect(page.getByRole('heading', { level: 1, name: 'העוזר החכם' })).toBeVisible();
    await scan(page, 'the teacher\'s assistant');
    await page.getByLabel('ההודעה שלכם').fill('איך להסביר חיבור של מספר חיובי ומספר שלילי?');
    await page.getByRole('button', { name: 'שליחה' }).click();
    await expect(page.locator('.msg-row.assistant').last()).toContainText('כדי לחבר מספרים');
    await scan(page, 'the teacher\'s assistant with a reply');
  });

  test('a class exam: the builder\'s questions, then the sheet', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher/exam/new', keyTeacher());
    await expect(page.getByText('על אילו מדרגות יהיה המבחן?')).toBeVisible();
    await scan(page, 'the exam builder, the stairs');
    await page.getByRole('checkbox', { name: 'כל היחידה: מספרים מכוונים' }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await scan(page, 'the exam builder, the next question');
    for (let k = 0; k < 4 && /\/exam\/new/.test(page.url()); k += 1) {
      const next = page.locator('.ob-foot button[type="submit"], .ob-foot .btn-primary').last();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
    }
    await expect(page).toHaveURL(/#\/teacher\/exam\/(?!new$)[^/]+$/);
    await expect(page.locator('.exam-q').first()).toBeVisible();
    await scan(page, 'the exam sheet');
  });

  test('the teacher\'s guide and a document in it', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher/guide', keyTeacher());
    await expect(page.getByRole('link', { name: /מכתב להורים ואישור השתתפות/ })).toBeVisible();
    await scan(page, 'the teacher\'s guide');
    await page.getByRole('link', { name: /מכתב להורים ואישור השתתפות/ }).click();
    await expect(page.getByRole('heading', { name: 'מכתב להורים ואישור השתתפות', level: 1 })).toBeVisible();
    await scan(page, 'the parent letter');
  });

  test('the demo board (TEACHER-15): every view, a student\'s page, the settings', async ({ page }) => {
    await open(page, '#/?start=demo');
    await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'כיתה לדוגמה' })).toBeVisible();
    await scan(page, 'the demo board');
    for (const tab of [/^משימות/, /^תלמידים/, /^מבחנים/, /^עזרה/]) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
      await scan(page, `the demo board, ${tab.source.slice(1)}`);
    }
    await tools(page).getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await expect(page.getByRole('heading', { name: 'הגדרות הכיתה ז׳3 (דוגמה)' })).toBeVisible();
    await scan(page, 'the demo\'s settings');
  });

  test('the student\'s Quests with the teacher\'s block', async ({ page }) => {
    await fakeServer(page, { today: '2026-11-09', assignments: [given(), examWork()] }, baseOf());
    await open(page, '#/quests', inClass(), undefined, { at: new Date('2026-11-09T10:00:00') });
    await expect(page.getByRole('region', { name: 'מהמורה רונית' }).getByRole('listitem').first()).toBeVisible();
    await scan(page, 'Quests with the teacher\'s work');
  });
});
