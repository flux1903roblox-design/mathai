// Every student screen on every device: nothing scrolls sideways, nothing hides under the tab bar,
// no picture is broken, no error in the console.
import { test, expect } from '@playwright/test';
import { open, livedIn, student, expectNoSidewaysScroll } from './helpers.js';

const SCREENS = [
  ['the learn screen', '#/', livedIn('7')],
  ['a first-day learn screen', '#/', student('7')],
  ['daily quests', '#/quests', livedIn('7')],
  ['exams', '#/exams', livedIn('7')],
  ['a new practice exam', '#/exams/new', livedIn('7')],
  ['checking an exam', '#/exams/check', livedIn('7')],
  ['the improvement plan', '#/plan', livedIn('7')],
  ['the AI tutor', '#/assistant', livedIn('7')],
  ['the profile', '#/me', livedIn('7')],
  ['topics', '#/topics', livedIn('8')],
  ['a topic guide', '#/topic/line', livedIn('8')],
];

for (const [what, route, state] of SCREENS) {
  test(`screen: ${what}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page, route, state);
    await expect(page.locator('.shell-main')).toBeVisible();
    await expectNoSidewaysScroll(page);
    // At the end of the page, everything the student can press or read sits above the tab bar.
    const covered = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const bar = document.querySelector('.tabbar').getBoundingClientRect();
      if (bar.top < innerHeight / 2) return []; // the side rail on wide screens covers nothing
      return [...document.querySelectorAll('a[href], button, input, select, textarea, [role="alert"]')]
        .filter((el) => !el.closest('.tabbar') && !el.closest('.visually-hidden') && el.getClientRects().length)
        .filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > bar.top + 1 && r.top < bar.bottom; })
        .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30));
    });
    expect(covered, 'controls under the tab bar').toEqual([]);
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    expect(broken, 'broken images').toEqual([]);
    expect(errors, 'console errors').toEqual([]);
  });
}
