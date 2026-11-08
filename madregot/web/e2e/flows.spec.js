// Core journeys: first visit, placement test, a whole lesson with XP and saved progress,
// the AI tutor and the teacher view when there is no server, and a printable practice exam.
import { test, expect } from '@playwright/test';
import { open, student, item, answer, proceed, proceedToNext, saved, expectUsable, leaveEndScreens } from './helpers.js';

// Journeys run on one phone and on desktop; the layout spec covers every size.
test.beforeEach(({}, info) => { test.skip(!['phone', 'desktop'].includes(info.project.name), 'journeys run on phone and desktop'); });

async function onboard(page, start) {
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await page.fill('#w-name', 'נועה');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click(); // daily goal: the default
  await page.getByRole('radio', { name: start === 'test' ? /^בדיקת רמה קצרה/ : /^מתחילים מההתחלה/ }).click();
  await page.getByRole('button', { name: start === 'test' ? 'לבדיקת הרמה' : 'לשיעור הראשון', exact: true }).click();
}

test('first visit, starting from the first stair: the map is right under the continue card', async ({ page }) => {
  await open(page, '#/');
  await onboard(page, 'scratch');
  await expect(page.locator('.continue')).toBeVisible();
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.node-current').first()).toBeVisible();
  const st = await saved(page);
  expect(st.profile).toMatchObject({ name: 'נועה', grade: '7', know: 1 });
  await page.reload();
  await expect(page.locator('.continue')).toBeVisible(); // the profile survives a reload
});

test('first visit with the placement test: every topic gets a starting stair', async ({ page }) => {
  await open(page, '#/');
  await onboard(page, 'test');
  await expect(page).toHaveURL(/#\/placement/);
  for (let n = 0; n < 12; n += 1) {
    if (await page.locator('.done-screen').count()) break;
    const it = await item(page);
    await answer(page, it.level <= 2);
    await proceedToNext(page, it); // the next answer must not be given to this exercise
  }
  await expect(page.getByText('מצאנו את המדרגה שלכם')).toBeVisible();
  await expect(page.locator('.place-row')).toHaveCount(3);
  const st = await saved(page);
  expect(Object.values(st.placement.results).every((r) => r.level === 2)).toBe(true);
  await leaveEndScreens(page);
  await expect(page.locator('#board-title')).toBeVisible();
});

test('a whole lesson: a mistake, its retry, the reveal, the end screens, XP and the path are saved', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7'));
  await answer(page, false);
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await proceed(page);
  await answer(page, false);
  await expect(page.locator('section.fb-reveal')).toBeVisible();
  await proceed(page);
  for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen')).toBeVisible();
  await expect(page.locator('.stat-gold')).toContainText('+');
  await leaveEndScreens(page);
  await expect(page.locator('.learn')).toBeVisible();
  const st = await saved(page);
  expect(st.xp).toBeGreaterThan(0);
  expect(st.path.signed.parts['1']).toBe(1);
  expect(st.days['2026-11-05'].lessons).toBe(1);
  await page.reload();
  expect((await saved(page)).xp).toBe(st.xp);
});

test('the AI tutor without a connection says so and offers a way on, without actions that would fail', async ({ page }) => {
  await open(page, '#/assistant', student('7'));
  await expect(page.getByRole('heading', { name: 'העוזר עוד לא מחובר' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'כתיבת תרגילים' })).toHaveCount(0);
  await expect(page.locator('#chat-draft')).toHaveCount(0);
  await expectUsable(page, page.getByRole('link', { name: 'להמשיך לתרגל' }), 'the way back to practice');
  await page.getByRole('link', { name: 'להמשיך לתרגל' }).click();
  await expect(page.locator('.learn')).toBeVisible();
});

test('the teacher view without a server explains it and how to turn it on', async ({ page }) => {
  await open(page, '#/');
  await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'לוח המורה עובד עם שרת הכיתה' })).toBeVisible();
  await expect(page.locator('.teacher-off-steps li')).toHaveCount(3);
  await page.getByRole('button', { name: 'חזרה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
});

test('a practice exam is made from the chosen topics and prints without the app around it', async ({ page }) => {
  await open(page, '#/exams/new', student('7'));
  await page.getByRole('button', { name: 'הכנת המבחן' }).click();
  await expect(page.locator('.exam-sheet, .page-sheet, ol').first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.tabbar')).toBeHidden();
});
