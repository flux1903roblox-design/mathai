// A calm streak (STUDENT-5): after a school day without learning, a quiet card offers the repair in words that blame
// no one; two finished lessons keep the streak; the month's learning days and the weekly best are always in view.
// The clock is fixed on Thursday 5 November 2026 (helpers.js NOW).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, student, answer, proceedToNext, saved, expectUsable, expectNoSidewaysScroll, playDiscover } from './helpers.js';

// (the returning student's home below runs on both phone sizes instead)
const RETURNING = "a returning student's home screen";
test.beforeEach(({}, info) => { test.skip(!['phone', 'desktop'].includes(info.project.name) && !info.titlePath.includes(RETURNING), 'journeys run on phone and desktop'); });

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
  // the same streak the header shows: kept, and waiting for today (PRODUCT2-40)
  await expect(streak.getByRole('heading', { level: 2 })).toHaveText('הרצף של 3 ימים מחכה לכם');
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
  // the lesson completed the stair's practice, a first stage: מדי's first piece has its moment first (PRODUCT2-36)
  await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
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

test('the ghost race: this week against my own last week, two calm bars, the practice days and the best (PRODUCT2-39)', async ({ page }) => {
  // the clock is Thursday 5.11: last week is 25.10 to 31.10
  const days = {
    '2026-10-19': { lessons: 6, stages: 3 }, // the best: 9 stages in the week of 18.10
    '2026-10-26': { lessons: 3, stages: 2, mp: 1 }, '2026-10-27': { lessons: 2, stages: 1, mp: 1 }, // last week: 8 stages on 2 days
    '2026-11-02': { lessons: 1, stages: 1 }, '2026-11-04': { lessons: 1 }, // this week so far: 3 stages on 2 days
  };
  await open(page, '#/quests', student('7', { days }));
  const card = page.locator('.ghost-card');
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('השבוע שלי');
  await expect(card.locator('.ghost-row.is-last')).toHaveText(/^השבוע שעבר:\s*8 שלבים$/);
  await expect(card.locator('.ghost-row.is-now')).toHaveText(/^השבוע:\s*3 שלבים$/);
  await expect(card.locator('.ghost-days')).toHaveText('ימי תרגול: השבוע 2, בשבוע שעבר 2');
  await expect(card.locator('.ghost-best')).toHaveText('השיא שלכם: 9 שלבים בשבוע');
  await expect(card).toContainText('שלב הוא שלב לימוד, שיעור או בדיקה.');
  // the bars are pictures of the words: hidden from screen readers, and drawn on one scale (last week full, this week 3/8)
  await expect(card.locator('.ghost-bar').first()).toHaveAttribute('aria-hidden', 'true');
  const widths = await card.locator('.ghost-bar i').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width));
  expect(widths[0]).toBeCloseTo(1, 2);
  expect(widths[1]).toBeCloseTo(3 / 8, 1);
  // no other student, no countdown, no loss words
  await expect(card).not.toContainText(/תלמיד|דירוג|ליגה|מקום/);
  await expect(page.locator('body')).not.toContainText(BLAME);
  await expectNoSidewaysScroll(page);
  // the profile: learning days, a number that only grows, in place of total XP
  await page.goto('./#/me');
  await expect(page.locator('.profile-stats')).toContainText('ימי לימוד');
  await expect(page.locator('.profile-stats')).not.toContainText('סך הכול XP');
  await expect(page.locator('.profile-stats .kpi').filter({ hasText: 'ימי לימוד' }).locator('.kpi-num')).toHaveText('5');
});

test('a first week has no last week and no best yet, and a student who never learned has no streak yet', async ({ page }) => {
  await open(page, '#/quests', student('7'));
  await expect(page.locator('.ghost-card .ghost-say')).toHaveText('השבוע עוד לא התחיל. כל שלב קטן נספר כאן.');
  await expect(page.locator('.ghost-card .ghost-best')).toHaveText('זה השבוע הראשון. מה שתעשו השבוע יהיה השיא.');
  await expect(page.locator('.streak-card h2')).toHaveText('עוד אין רצף');
  await expect(page.locator('.streak-month')).toHaveCount(0);
});

// Streak milestones (PRODUCT2-38): 3, 7 and 30 days in a row each get their own moment, once, in place of the streak's
// usual one. No countdown and nothing to lose: one line about what was done. Under reduced motion (this file) it is
// still; celebrate.spec.js runs it with motion.
const PRESSURE = /פספסתם|תפספסו|איבדתם|נשבר|נגמר הרצף|תאבדו|יימחק|עוד מעט ייגמר|מהרו|נשארו|עוד \d+ ימים/;
const twoDays = { '2026-11-03': { lessons: 1, xp: 12, q: 8, ok: 7 }, '2026-11-04': { lessons: 1, xp: 12, q: 8, ok: 7 } };

test('3 days in a row: the milestone\'s moment once, focused, gone with Enter, and the next day is an ordinary streak', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7', { days: twoDays, goalXp: 500 }));
  await playLesson(page);
  await page.locator('.done-screen .done-actions .btn').click();
  await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
  const ms = page.locator('.streak-screen.streak-milestone');
  await expect(ms).toHaveAttribute('data-milestone', '3');
  await expect(ms.getByRole('heading', { level: 1 })).toHaveText('3 ימים ברצף!');
  await expect(ms.locator('.milestone-line')).toHaveText('שלושה ימים של תרגול. מדי שמח איתכם.');
  await expect(ms.locator('.milestone-medal b')).toHaveText('3');
  // the week and what keeps the streak stay, as on the usual moment
  await expect(ms.locator('.week-day.on')).toHaveCount(3);
  await expect(ms.locator('.streak-card-text')).toContainText('בשבת ובחג הרצף נשמר.');
  await expect(page.locator('body')).not.toContainText(PRESSURE);
  const go = ms.getByRole('button', { name: 'המשך', exact: true });
  await expect(go).toBeFocused();
  await expect(go).toHaveAttribute('aria-describedby', 'streak-title milestone-line');
  await page.keyboard.press('Enter');
  await expect(ms).toHaveCount(0);
  expect((await saved(page)).nudges.streakSeen).toEqual({ 3: '2026-11-05' });
});

test('a milestone already shown is not shown again: the streak\'s usual moment comes', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7', { days: twoDays, goalXp: 500, nudges: { streakSeen: { 3: '2026-10-20' } } }));
  await playLesson(page);
  await page.locator('.done-screen .done-actions .btn').click();
  await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
  await expect(page.locator('.streak-screen h1')).toHaveText('3 ימים ברצף!');
  await expect(page.locator('.streak-milestone')).toHaveCount(0);
  await expect(page.locator('.streak-num')).toBeVisible();
});

test('a teaching stage that makes 7 days in a row: the milestone comes after the stage, then the way the student picked', async ({ page }) => {
  // Thursday 29 October to Wednesday 4 November, Shabbat passed over: six days; today's first stage makes seven
  const d = { lessons: 1, xp: 12, q: 8, ok: 7 };
  const six = { '2026-10-29': d, '2026-10-30': d, '2026-11-01': d, '2026-11-02': d, '2026-11-03': d, '2026-11-04': d };
  await open(page, '#/learn/signed/1/A', student('7', { days: six, goalXp: 500 }));
  await playDiscover(page);
  const stage = page.locator('.stage-done');
  await expect(stage.locator('.badges')).toContainText('7 ימים ברצף');
  // reduced motion: the XP is there at once, no counting
  await expect(stage.locator('.xp-pill .xp-count')).toHaveAttribute('data-done', 'true');
  await expect(stage.locator('.xp-pill .xp-count-n')).toHaveText('+10');
  await stage.getByRole('button', { name: 'לדוגמה הפתורה', exact: true }).click();
  await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
  const ms = page.locator('.streak-milestone');
  await expect(ms.getByRole('heading', { level: 1 })).toHaveText('7 ימים ברצף!');
  await expect(ms.locator('.milestone-line')).toHaveText('שבעה ימים של תרגול. זה כבר הרגל.');
  await expect(page.locator('body')).not.toContainText(PRESSURE);
  await ms.getByRole('button', { name: 'המשך', exact: true }).click();
  await expect(page).toHaveURL(/learn\/signed\/1\/B/);
  expect((await saved(page)).nudges.streakSeen).toEqual({ 7: '2026-11-05' });
});

// PRODUCT2-40, the council's painful moment #2 (student-verify/t11-repair.js): a returning student opens the app on an
// iPhone 13 in Safari. She learned Thursday 5, Friday 6, Sunday 8 and Monday 9 November, nothing on Tuesday the 10th, and
// today is Wednesday the 11th. The council saw a 0 flame beside "הרצף של 4 ימים נשמר", the install card and the repair
// card pushing the path below the fold, and the scroll button over the unit's emblem.
test.describe(RETURNING, () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  // Safari's visible area on an iPhone 13 (Playwright's own device has the same), and the small phone as it is
  test.use({ userAgent: IPHONE, deviceScaleFactor: 2 });
  test.beforeEach(async ({ page }, info) => {
    test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the phone sizes');
    await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); });
  });
  const d = { lessons: 1, xp: 20, q: 8, ok: 7 };
  const back = () => student('7', { days: { '2026-11-05': d, '2026-11-06': d, '2026-11-08': d, '2026-11-09': d }, xp: 80 });
  const WED = new Date('2026-11-11T16:00:00');
  const EVIDENCE = fileURLToPath(new URL('../../qa-evidence/student/streak/', import.meta.url));
  const evidence = async (page, name) => {
    await expectNoSidewaysScroll(page);
    mkdirSync(EVIDENCE, { recursive: true });
    await page.screenshot({ path: `${EVIDENCE}${name}.png`, animations: 'disabled', caret: 'hide' });
  };

  test('the header and the card agree, one card shows above the path, and the path starts above the fold', async ({ page }, info) => {
    const small = info.project.name === 'phone-small';
    if (!small) await page.setViewportSize({ width: 390, height: 664 });
    await open(page, '#/', back(), '424242', WED);
    const card = page.locator('.repair-card');
    await expect(card.locator('.repair-text')).toHaveText('אתמול לא יצא ללמוד. עוד שני שיעורים היום, והרצף של 4 ימים נשמר.');
    // the flame: the same 4, marked as waiting for today; never 0
    const flame = page.locator('.learn-top .top-stat.streak');
    await expect(flame).toHaveText('4מחכה');
    await expect(flame).toHaveAccessibleName('רצף של 4 ימים, מחכה לשיעור היום. עוד שני שיעורים היום שומרים עליו.');
    await expect(flame).toHaveClass(/at-risk/);
    // one card above the path: the repair card; the iPhone's Home Screen guide waits under the path
    const head = await page.locator('.unit-head').first().boundingBox();
    const above = await page.locator('.repair-card, .install-card, .next-banner, .learn-work-chip').evaluateAll((els, top) => els.filter((el) => el.getBoundingClientRect().top < top).map((el) => el.className), head.y);
    expect(above).toEqual(['repair-card']);
    const install = page.locator('.install-card');
    await expect(install).toHaveCount(1);
    const lastUnit = await page.locator('.unit, .unit-row').last().boundingBox();
    expect((await install.boundingBox()).y).toBeGreaterThan(lastUnit.y + lastUnit.height - 1);
    // the screen opens at the top: the card whole, then the unit's banner and the start of the path. On an iPhone 13 the
    // current stop is above the tab bar, usable; on the 320x568 phone its "התחלה" is (the stop itself is just below)
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const fold = (await page.locator('.tabbar').boundingBox()).y;
    const bottom = async (loc) => { const b = await loc.boundingBox(); return b.y + b.height; };
    expect(await bottom(card)).toBeLessThanOrEqual(fold);
    expect(await bottom(page.locator('.unit-head').first())).toBeLessThanOrEqual(fold);
    expect(await bottom(page.locator('.node-start').first())).toBeLessThanOrEqual(fold);
    if (!small) {
      expect(await bottom(page.locator('.node-anchor.is-current .node').first())).toBeLessThanOrEqual(fold);
      await expectUsable(page, page.locator('.node-anchor.is-current .node').first(), 'the current stop');
      await expect(page.locator('.jump-current')).toHaveCount(0);
    }
    await evidence(page, small ? 'repair-card-320x568' : 'repair-card');
    if (!small) {
      await page.emulateMedia({ colorScheme: 'dark' });
      await evidence(page, 'repair-card-dark');
      await page.emulateMedia({ colorScheme: 'light' });
    }
    // the missions tab and the profile say the same 4
    await flame.click();
    await expect(page.locator('.streak-card h2')).toHaveText('הרצף של 4 ימים מחכה לכם');
    await expect(page.locator('.streak-repair-line')).toHaveText('אתמול לא יצא ללמוד. עוד שני שיעורים היום, והרצף של 4 ימים נשמר.');
    await page.goto('./#/me');
    await expect(page.locator('.profile-stats .kpi').filter({ hasText: 'ימים ברצף' }).locator('.kpi-num')).toHaveText('4');
  });

  test('the scroll-to-current button never covers a unit banner\'s emblem', async ({ page }) => {
    // a short screen puts the unit's banner where the button floats while the current stop is below, as the council saw
    // it on an iPhone 13 under two cards; then the whole home is scrolled through, both ways
    await page.setViewportSize({ width: page.viewportSize().width, height: 440 });
    await open(page, '#/', back(), '424242', WED);
    const jump = page.locator('.jump-current');
    const covers = () => page.evaluate(() => {
      const b = document.querySelector('.jump-current');
      if (!b || getComputedStyle(b).visibility === 'hidden') return null;
      const r = b.getBoundingClientRect();
      return [...document.querySelectorAll('.unit-head .emblem, .unit-row .emblem, .unit-guide')].filter((el) => {
        const e = el.getBoundingClientRect();
        return e.bottom > r.top && e.top < r.bottom && e.right > r.left && e.left < r.right;
      }).map((el) => el.className);
    });
    let shown = 0;
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const steps = [...Array(Math.ceil(height / 24)).keys()].map((i) => i * 24);
    for (const y of [...steps, ...steps.reverse()]) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      // what stays on the screen once the scroll has settled (two frames and a moment)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
      const over = await covers();
      if (over) shown += 1;
      expect(over ?? [], `at scroll ${y}`).toEqual([]);
    }
    expect(shown, 'the button was there to use').toBeGreaterThan(0);
    // and it still takes the student back to the current stop
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(jump).toBeVisible();
    await jump.click();
    await expect(page.locator('.node-anchor.is-current .node').first()).toBeInViewport();
  });
});
