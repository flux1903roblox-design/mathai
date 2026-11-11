// A calm streak (STUDENT-5): after a school day without learning, a quiet card offers the repair in words that blame
// no one; two finished lessons keep the streak; the month's learning days and the weekly best are always in view.
// The clock is fixed on Thursday 5 November 2026 (helpers.js NOW).
import { test, expect } from '@playwright/test';
import { open, student, answer, proceedToNext, saved, expectUsable } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'desktop'].includes(info.project.name), 'journeys run on phone and desktop'); });

// Sunday 1 to Tuesday 3 November learned, nothing on Wednesday the 4th; an earlier week (26 Oct) of 5 steps
const broken = {
  '2026-10-26': { lessons: 5, xp: 50, q: 40, ok: 36 },
  '2026-11-01': { lessons: 1, xp: 12, q: 8, ok: 7 }, '2026-11-02': { lessons: 2, xp: 30, q: 16, ok: 14 }, '2026-11-03': { lessons: 1, xp: 15, q: 8, ok: 8 },
};
const BLAME = /פספסתם|תפספסו|איבדתם|נשבר|נגמר הרצף/;

async function playLesson(page) {
  await expect.poll(() => page.evaluate(() => window.__madregotItem)).toBeTruthy();
  for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen .stats')).toBeVisible();
}

test('a missed day: a calm card offers the repair, in words that blame no one, and closes for the day', async ({ page }) => {
  await open(page, '#/', student('7', { days: broken }));
  const card = page.locator('.repair-card');
  await expect(card.locator('.repair-text')).toHaveText('אתמול לא יצא ללמוד. עוד שני שיעורים היום, והרצף של 3 ימים נשמר.');
  await expect(page.locator('body')).not.toContainText(BLAME);
  await expectUsable(page, card.getByRole('button', { name: 'לשיעור', exact: true }), 'the way to a lesson');
  // Quests says it too, forward-looking, with the month's days
  await page.goto('./#/quests');
  const streak = page.locator('.streak-card');
  await expect(streak.getByRole('heading', { level: 2 })).toHaveText('רצף חדש מתחיל היום');
  await expect(streak.locator('.streak-month')).toHaveText('החודש למדתם 3 ימים.');
  await expect(streak.locator('.streak-repair-line')).toContainText('עוד שני שיעורים היום');
  await expect(streak).toContainText('בשבת ובחג הרצף נשמר.');
  await expect(page.locator('body')).not.toContainText(BLAME);
  // closing the card hides it until tomorrow
  await page.goto('./#/');
  await card.getByRole('button', { name: 'סגירה', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await saved(page)).nudges.repairDismissed).toBe('2026-11-05');
  await page.reload();
  await expect(page.locator('.learn-top')).toBeVisible();
  await expect(page.locator('.repair-card')).toHaveCount(0);
});

test('"לשיעור" on the repair card opens something to learn', async ({ page }) => {
  await open(page, '#/', student('7', { days: broken }));
  await page.locator('.repair-card').getByRole('button', { name: 'לשיעור', exact: true }).click();
  await expect(page).toHaveURL(/#\/(learn|lesson|check|rescue)\//);
});

test('two lessons keep the streak: the second says "הרצף נשמר", and the header streak is back', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7', { days: broken, goalXp: 50 }));
  await playLesson(page);
  // the first lesson of the day starts a new streak; nothing is kept yet, and the week has not passed its best (5)
  await expect(page.locator('.done-screen')).not.toContainText('שיא שבועי חדש');
  await page.locator('.done-screen .done-actions .btn').click();
  await expect(page.locator('.streak-screen h1')).toHaveText('התחלתם רצף!');
  await expect(page.locator('.streak-card-text')).not.toHaveText(/^הרצף נשמר\./);
  await expect(page.locator('.streak-card-text')).toContainText('בשבת ובחג הרצף נשמר.');
  await page.locator('.streak-screen .done-actions .btn').click();
  await expect(page.locator('.learn-top')).toBeVisible();
  await expect(page.locator('.repair-card .repair-text')).toContainText('עוד שיעור אחד היום');
  // the second lesson: the repair is earned, and this week's 6 steps pass the best of 5
  await page.goto('./#/lesson/signed/1');
  await playLesson(page);
  await expect(page.locator('.done-screen .badges')).toContainText('שיא שבועי חדש');
  await page.locator('.done-screen .done-actions .btn').click();
  await expect(page.locator('.streak-screen h1')).toHaveText('4 ימים ברצף!');
  await expect(page.locator('.streak-card-text')).toHaveText('הרצף נשמר. 4 ימים ברצף.');
  await expect(page.locator('.week-day.frozen .visually-hidden')).toHaveText('הרצף נשמר');
  await expect(page.locator('body')).not.toContainText(BLAME);
  await page.locator('.streak-screen .done-actions .btn').click();
  await expect(page.locator('.top-stat.streak')).toHaveText('4');
  await expect(page.locator('.repair-card')).toHaveCount(0);
  const st = await saved(page);
  expect(st.days['2026-11-04']).toEqual({ frozen: 'repair' });
  expect(st.streak.lastRepair).toBe('2026-11-05');
  expect(st.nudges.pbWeek).toBe('2026-11-01');
});

test('this week against the best week: a best of 12 steps, and a passed mastery check is worth 3', async ({ page }) => {
  const days = {
    '2026-10-26': { lessons: 3, stages: 2, mp: 1 }, '2026-10-27': { lessons: 2, stages: 1, mp: 1 }, // 12 steps in the week of 25 Oct
    '2026-11-02': { lessons: 1, stages: 1 }, '2026-11-04': { lessons: 1 },
  };
  await open(page, '#/quests', student('7', { days }));
  const card = page.locator('.week-best-card');
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('השבוע שלי');
  await expect(card.locator('.wk-line')).toHaveText('השבוע: 3 צעדים');
  await expect(card.locator('.wk-best')).toHaveText('השיא שלכם: 12 צעדים בשבוע');
  await expect(card).toContainText('צעד הוא שיעור, שלב לימוד או בדיקה. בדיקת שליטה שעברתם שווה 3.');
  const bar = card.getByRole('progressbar', { name: 'השבוע שלי' });
  await expect(bar).toHaveAttribute('aria-valuenow', '3');
  await expect(bar).toHaveAttribute('aria-valuemax', '12');
  await expect(bar).toHaveAttribute('aria-valuetext', 'השבוע 3 צעדים, השיא 12 צעדים');
  // the profile: learning days, a number that only grows, in place of total XP
  await page.goto('./#/me');
  await expect(page.locator('.profile-stats')).toContainText('ימי לימוד');
  await expect(page.locator('.profile-stats')).not.toContainText('סך הכול XP');
  await expect(page.locator('.profile-stats .kpi').filter({ hasText: 'ימי לימוד' }).locator('.kpi-num')).toHaveText('4');
});

test('a first week has no best yet, and a student who never learned has no streak yet', async ({ page }) => {
  await open(page, '#/quests', student('7'));
  await expect(page.locator('.week-best-card .wk-line')).toHaveText('השבוע עוד לא התחיל. כל שיעור קצר הוא צעד.');
  await expect(page.locator('.week-best-card .wk-best')).toHaveText('זה השבוע הראשון. מה שתעשו השבוע יהיה השיא.');
  await expect(page.locator('.streak-card h2')).toHaveText('עוד אין רצף');
  await expect(page.locator('.streak-month')).toHaveCount(0);
});
