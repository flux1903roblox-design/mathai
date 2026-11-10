// One "what next" (CURRICULUM-7): the home's next step, the mission's first row and Exam Rescue's start button name the
// same step and lead to the same route. The student has a review due and an exam in three days; the exam's steps come
// first, and the review is under them.
import { test, expect } from '@playwright/test';
import { open, student, expectUsable, expectNoSidewaysScroll } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the next step runs on both phones'); });

const at = '2026-11-01T10:00:00.000Z';
const mastered = { taught: { A: at, B: at, C: at }, attempts: Array.from({ length: 6 }, () => ({ at, ok: true, independent: true, purpose: 'practice' })), mastered: { at, box: 0, due: '2026-11-02T10:00:00.000Z' } };
/** NOW is Thursday 5.11: the exam is on Sunday 8.11, diagnosed (חיבור וחיסור a gap, השוואת מספרים right twice); קריאת נקודה's review is due. */
function examSoon() {
  const st = student('7', { path: { coord: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered' } } } });
  st.state.learn = {
    skills: { 'coord:1': mastered }, miscon: {}, missions: {}, events: [], floor: null, challenges: {},
    exam: { grade: '7', date: '2026-11-08', skills: ['signed:1', 'signed:2'], confidence: 2, minutes: 15, createdAt: '2026-11-04T10:00:00.000Z', diagnostic: { 'signed:1': { asked: 2, right: 0, at: '2026-11-04T10:00:00.000Z' }, 'signed:2': { asked: 2, right: 2, at: '2026-11-04T10:00:00.000Z' } } },
  };
  return { ...st, version: 4 };
}

// Proof screenshots, only when NEXT_SHOTS names a folder.
const shot = async (page, name) => {
  const dir = process.env.NEXT_SHOTS; if (!dir) return;
  await page.waitForTimeout(900); // a screen that just opened has settled (its fade-in)
  await page.screenshot({ path: `${dir}/next-${name}-${test.info().project.name}.png`, animations: 'disabled' });
};
const route = (page) => new URL(page.url()).hash;
const STEP = 'לומדים: חיבור וחיסור';

test('the home banner, the mission\'s first row and Rescue\'s start button lead to the same step', async ({ page }) => {
  // home: the next step is an exam step, not a stop of the map, so it is the banner above the path
  await open(page, '#/', examSoon());
  const banner = page.getByRole('region', { name: 'הצעד הבא' });
  await expect(banner).toContainText(STEP);
  await expect(banner).toContainText('הכנה למבחן · 5 דק׳');
  await expect(page.locator('.next-banner')).toHaveCount(1);
  await expectUsable(page, banner.getByRole('button', { name: 'לצעד הבא' }), 'the banner button');
  await expectNoSidewaysScroll(page);
  await shot(page, 'home');
  await banner.getByRole('button', { name: 'לצעד הבא' }).click();
  const fromHome = route(page);
  expect(fromHome).toBe('#/learn/signed/1');

  // the mission: its first row is the same step, then the due review; the button starts it; the exam card names it
  await open(page, '#/quests', examSoon());
  const rows = page.locator('.today-items li');
  await expect(rows.first()).toContainText(STEP);
  await expect(page.locator('.today-exam .exam-cta-sub')).toHaveText(STEP);
  await shot(page, 'mission');
  await page.locator('.continue-go').click();
  expect(route(page)).toBe(fromHome);

  // Exam Rescue: today's first step, and its start button
  await open(page, '#/rescue', examSoon());
  const today = page.locator('.rescue-day.today');
  await expect(today.locator('.rescue-task').first()).toContainText(STEP);
  await today.scrollIntoViewIfNeeded();
  await shot(page, 'rescue');
  await today.getByRole('button', { name: 'מתחילים', exact: true }).click();
  expect(route(page)).toBe(fromHome);
});

test('with the next step a stair of the map, there is no banner and the map opens on that stair', async ({ page }) => {
  // a ז׳ student in November with nothing done: the next step is the first stair, the map's current stop
  await open(page, '#/', student('7'));
  await expect(page.locator('.learn-top')).toBeVisible();
  await expect(page.locator('.next-banner')).toHaveCount(0);
  await expect(page.locator('.node-current').first()).toBeVisible();
  // a stair kept from before mastery checks: its check is the next step, marked on the map, and its card leads with it
  const kept = student('7', { path: { signed: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept' } } } });
  kept.state.learn = { skills: {}, miscon: {}, missions: {}, events: [], exam: null, floor: null, challenges: {} };
  await open(page, '#/', { ...kept, version: 4 });
  await expect(page.locator('.next-banner')).toHaveCount(0);
  const next = page.locator('.node-next');
  await expect(next).toHaveText('הצעד הבא');
  await shot(page, 'map-kept');
  await page.locator('.unit').first().locator('.node').first().click();
  await expect(page.locator('.node-card')).toContainText('המדרגה הושלמה לפני שהיו בדיקות שליטה');
  const check = page.locator('.node-card').getByRole('button', { name: 'לבדיקת שליטה' });
  // the card's foot just above the tab bar, so the unit's sticky banner covers none of it
  await page.locator('.node-card').evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom - (window.innerHeight - 88)));
  await expectUsable(page, check, 'the check button');
  await shot(page, 'card-kept');
  await check.click();
  await expect(page).toHaveURL(/lesson\/signed\/1\?kind=check&purpose=mastery/);
});
