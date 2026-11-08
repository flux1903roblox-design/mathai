// Visual regression: screenshots of the critical screens, compared with the approved ones in __screens__/.
// After an intended design change, review the new pictures and update them: npm run test:e2e -- --update-snapshots
import { test, expect } from '@playwright/test';
import { open, student, livedIn, answer } from './helpers.js';

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
  await shot(page, 'learn', '.continue');
});

for (const [name, route, grade] of [['exercise-number', 'signed/1', '7'], ['exercise-choice', 'signed/2', '7'], ['exercise-grid', 'coord/1', '7'], ['exercise-table', 'stats/4', '8'], ['exercise-line', 'line/5', '8']]) {
  test(`visual: ${name}`, async ({ page }) => {
    await open(page, `#/lesson/${route}`, student(grade));
    await shot(page, name, '#qtext');
  });
}

test('visual: a wrong answer', async ({ page }) => {
  await open(page, '#/lesson/coord/1', student('7'));
  await answer(page, false);
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await shot(page, 'feedback-retry', 'section.fb-retry');
});

test('visual: a right answer', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7'));
  await answer(page, true);
  await expect(page.locator('section.fb-good')).toBeVisible();
  await shot(page, 'feedback-good', 'section.fb-good');
});

for (const [name, route] of [['quests', '#/quests'], ['assistant-offline', '#/assistant'], ['profile', '#/me'], ['exams', '#/exams']]) {
  test(`visual: ${name}`, async ({ page }) => {
    await open(page, route, livedIn('7'));
    await shot(page, name, '.page-hero-title');
  });
}
