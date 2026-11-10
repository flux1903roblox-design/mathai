// Visual regression: screenshots of the critical screens, compared with the approved ones in __screens__/.
// After an intended design change, review the new pictures and update them: npm run test:e2e -- --update-snapshots
import { test, expect } from '@playwright/test';
import { open, openOn, student, livedIn, answer } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone-small', 'phone', 'desktop'].includes(info.project.name), 'screenshots on two phones and desktop'); });

// Each screen is photographed only once its real content is there (some screens load on demand).
async function shot(page, name, ready) {
  await expect(page.locator(ready)).toBeVisible();
  await expect(page.getByText('טוענים…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false });
}

test('visual: welcome', async ({ page }) => {
  await open(page, '#/');
  await shot(page, 'welcome', '.wordmark');
});

test('visual: learn screen', async ({ page }) => {
  await open(page, '#/', livedIn('7'));
  await shot(page, 'learn', '.learn-top');
});

// each picture is of one kind of exercise: the seed that opens the lesson on it is found once and is the same every run
const form = (f, kind) => (it) => it.form === f && (!kind || it.manip.kind === kind);
for (const [name, route, grade, want] of [
  ['exercise-number', 'signed/1', '7', form('num')], ['exercise-choice', 'signed/2', '7', form('mc')], ['exercise-grid', 'coord/1', '7', form('pt')],
  ['exercise-table', 'stats/4', '8', null], ['exercise-line', 'line/5', '8', null],
  ['exercise-numberline', 'signed/1', '7', form('manip', 'numberline')], ['exercise-plot', 'coord/1', '7', form('manip', 'plot')],
  ['exercise-squares', 'pyth/1', '8', form('manip', 'squares')], ['exercise-bars', 'stats/3', '8', form('manip', 'bars')],
]) {
  test(`visual: ${name}`, async ({ page }) => {
    if (want) await openOn(page, `#/lesson/${route}`, student(grade), want); else await open(page, `#/lesson/${route}`, student(grade));
    await shot(page, name, '#qtext');
  });
}

test('visual: a wrong answer', async ({ page }) => {
  await openOn(page, '#/lesson/coord/1', student('7'), form('pt'));
  await answer(page, false);
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await shot(page, 'feedback-retry', 'section.fb-retry');
});

test('visual: a right answer', async ({ page }) => {
  await openOn(page, '#/lesson/signed/1', student('7'), form('num'));
  await answer(page, true);
  await expect(page.locator('section.fb-good')).toBeVisible();
  await shot(page, 'feedback-good', 'section.fb-good');
});

for (const [name, route, ready] of [
  ['quests', '#/quests', '.page-hero-title'], ['assistant-offline', '#/assistant', '.chat-bubble-title'], ['profile', '#/me', '.profile-name'], ['exams', '#/exams', '.page-hero-title'],
  // a unit's identity beyond the path (STUDENT-1): the topics list, a unit's guide, a stair page
  ['topics', '#/topics', '.section-card.is-current .emblem svg'], ['topic-guide', '#/topic/eq', '.guide-banner .emblem svg'], ['stair', '#/learn/coord/3', '.journey-head .emblem svg'],
]) {
  test(`visual: ${name}`, async ({ page }) => {
    await open(page, route, livedIn('7'));
    await shot(page, name, ready);
  });
}
