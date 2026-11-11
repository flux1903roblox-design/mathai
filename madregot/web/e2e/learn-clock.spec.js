// The learning clock in a real browser (PARENTS-1): a student on a lesson for a few seconds, then back to the map, has
// that time in days[today].tsecs; the map itself counts nothing, and the time alone does not make the day count.
import { test, expect } from '@playwright/test';
import { student, open, item, saved, NOW } from './helpers.js';

const TODAY = NOW.toLocaleDateString('en-CA');

test('time on a lesson is written when the student leaves it; time on the map is not counted', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'one project is enough for a clock');
  await open(page, '#/', student('7'));
  await expect(page.locator('.learn')).toBeVisible();
  await page.waitForTimeout(11_000); // on the map: counted as nothing
  // leaving the map writes what was counted there: nothing
  await page.evaluate(() => { window.location.hash = '#/lesson/signed/1'; });
  await expect.poll(() => item(page)).toBeTruthy();
  await page.waitForTimeout(1500);
  expect((await saved(page)).days[TODAY]?.tsecs ?? 0).toBe(0);
  await page.locator('body').click({ position: { x: 5, y: 5 } }); // a tap: the student is there
  await page.waitForTimeout(11_000); // two ticks of 5 s at least
  await page.evaluate(() => { window.location.hash = '#/'; });
  await expect.poll(async () => (await saved(page)).days[TODAY]?.tsecs ?? 0, { timeout: 5000 }).toBeGreaterThanOrEqual(10);
  const day = (await saved(page)).days[TODAY];
  expect(day.tsecs).toBeLessThanOrEqual(20);
  expect(day.lessons ?? 0).toBe(0); // the time alone is not a lesson, and the streak does not move
  await expect(page.locator('.top-stat.streak')).toHaveAttribute('aria-label', 'רצף של 0 ימים');
});
