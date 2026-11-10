// Touch targets (STUDENT-9 §1): on the student's main screens every button, link, radio and tab is at least 44×44,
// on the council's phone and the smallest. Links inside running text are exempt (WCAG 2.5.8): they sit in a <p> or a
// list item's text, or carry data-inline. Each screen's sizes are written to targets.json in the test's output, for the
// before/after table in qa-evidence/student/polish/.
import { test, expect } from '@playwright/test';
import { open, livedIn, student } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'touch targets are a phone matter'); });

const MIN = 44;

/** Every visible target on the page with its size; text-run links are marked exempt. */
const measure = (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, a[href], summary, [role="radio"], [role="tab"]')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"], [inert]')) continue; // not shown (or only to screen readers)
    const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const inline = el.hasAttribute('data-inline') || !!el.closest('p, li > span');
    out.push({ name, cls: String(el.className || '').split(' ').filter(Boolean).slice(0, 2).join('.'), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, inline });
  }
  return out;
});

async function check(page, screen) {
  await page.evaluate(() => document.fonts.ready);
  const all = await measure(page);
  const info = test.info();
  await info.attach(`targets-${screen}.json`, { body: JSON.stringify({ screen, project: info.project.name, targets: all }, null, 1), contentType: 'application/json' });
  const small = all.filter((t) => !t.inline && (t.w < MIN - 0.5 || t.h < MIN - 0.5));
  expect(small, `${screen}: targets under ${MIN}×${MIN}`).toEqual([]);
  expect(all.filter((t) => !t.inline).length, `${screen}: targets were found`).toBeGreaterThan(2);
}

test('Learn', async ({ page }) => {
  await open(page, '#/', livedIn('7'));
  await expect(page.locator('.learn-top')).toBeVisible();
  await check(page, 'learn');
});

test('Topics', async ({ page }) => {
  await open(page, '#/topics', livedIn('7'));
  await expect(page.locator('.mm-tile').first()).toBeVisible();
  await check(page, 'topics');
});

test('Quests', async ({ page }) => {
  await open(page, '#/quests', livedIn('7'));
  await expect(page.locator('.page-hero-title')).toBeVisible();
  await check(page, 'quests');
});

test('Me', async ({ page }) => {
  await open(page, '#/me', livedIn('7'));
  await expect(page.locator('.profile-name')).toBeVisible();
  await check(page, 'me');
});

test('a lesson, with its tools', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7'));
  await expect(page.locator('#qtext')).toBeVisible();
  await expect(page.locator('.lesson .tool').first()).toBeVisible();
  await check(page, 'lesson');
});

test('a teaching step', async ({ page }) => {
  await open(page, '#/learn/signed/1/A', student('7'));
  await expect(page.locator('.step-player')).toBeVisible();
  await check(page, 'teach');
});
