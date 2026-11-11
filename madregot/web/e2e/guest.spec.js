// The guest rule (stage5.md FUNC-6) in a real browser: another grade's stair that this grade's programme lists reaches
// the student through the one "what next". A ח׳ student in December who has every own stair taught by then is offered
// motion problems (eq:6, a stair of the ז׳ equations unit) in the banner above the path, with the reason line; Topics
// lists the grade's guest stairs between its units and the floor. The app's clock is fixed on 5 November
// (helpers.js NOW), so the December student gets a clock of their own.
import { test, expect } from '@playwright/test';
import { open, appReady, student, saved, expectUsable, expectNoSidewaysScroll, NOW } from './helpers.js';
import { gradeSkillsOf } from '../src/learn/skills.ts';
import { monthIndex } from '../../shared/coverage.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the guest rule runs on both phones'); });

/** A Tuesday in December: school month 3, when ח׳ classes teach motion problems (8.9). */
const DECEMBER = new Date('2026-12-08T10:00:00');
const at = '2026-12-02T10:00:00.000Z';
const mastered = {
  taught: { A: at, B: at, C: at },
  attempts: [...Array.from({ length: 6 }, () => ({ at, ok: true, independent: true, purpose: 'practice' })), ...Array.from({ length: 5 }, () => ({ at, ok: true, independent: true, purpose: 'mastery' }))],
  mastered: { at, box: 3, due: '2027-01-20T10:00:00.000Z' },
};

/** A ח׳ student with every own stair the school calendar teaches by December mastered (and done on the map). */
function eighthInDecember() {
  const ids = gradeSkillsOf('8').filter((id) => (monthIndex(id, '8') ?? 99) <= 3);
  const path = {};
  ids.forEach((id) => {
    const [t, l] = id.split(':');
    path[t] ||= { parts: {}, reviews: 0, jumped: 0, done: {} };
    path[t].done[l] = 'mastered'; path[t].parts[l] = 2;
  });
  const st = student('8', { path });
  st.state.learn = { skills: Object.fromEntries(ids.map((id) => [id, mastered])), miscon: {}, missions: {}, events: [], exam: null, floor: null, challenges: {} };
  return { ...st, version: 6 };
}

/** Open a route with the student's state, then move the clock to December and start the app again. */
async function openInDecember(page, route, state) {
  await open(page, route, state);
  await page.clock.setFixedTime(DECEMBER);
  await page.reload();
  await appReady(page);
}

// Proof screenshots, light and dark, only when GUEST_SHOTS names a folder.
const shot = async (page, name) => {
  const dir = process.env.GUEST_SHOTS; if (!dir) return;
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/guest-${name}-${test.info().project.name}-${scheme}.png`, animations: 'disabled' });
  }
  await page.emulateMedia({ colorScheme: 'light' });
};

const REASON = 'שאלות תנועה הן חלק מהתוכנית של כיתה ח׳. המדרגה נמצאת ביחידת המשוואות. לפי תוכנית הלימודים, זה נלמד בכיתה בדצמבר.';

test('a ח׳ student in December is offered motion problems in the banner, with why, and it opens the stair', async ({ page }) => {
  await openInDecember(page, '#/', eighthInDecember());
  const banner = page.getByRole('region', { name: 'הצעד הבא' });
  await expect(banner.getByRole('heading', { level: 2 })).toHaveText('מבינים את הרעיון: שאלות תנועה');
  await expect(banner.locator('.next-banner-meta')).toHaveText('חדש · 5 דק׳');
  await expect(banner.locator('.next-banner-why')).toHaveText(REASON);
  await expect(page.locator('.next-banner')).toHaveCount(1);
  // the equations unit is not on the ח׳ map: the stair is reached from the banner alone
  await expect(page.locator('.unit-title').filter({ hasText: /^משוואות$/ })).toHaveCount(0);
  const go = banner.getByRole('button', { name: 'לצעד הבא' });
  await expectUsable(page, go, 'the banner button');
  expect((await go.boundingBox()).height, 'a 44px target').toBeGreaterThanOrEqual(44);
  await expectNoSidewaysScroll(page);
  await shot(page, 'banner');
  // the mission's first row is the same step
  await page.goto('./#/quests');
  await expect(page.locator('.today-items li').first()).toContainText('שאלות תנועה');
  await page.goto('./#/');
  await banner.getByRole('button', { name: 'לצעד הבא' }).click();
  await expect(page).toHaveURL(/#\/learn\/eq\/6\/A$/);
});

test('Topics lists the grade\'s guest stairs between its units and the floor, each a link to its stair', async ({ page }) => {
  await open(page, '#/topics', student('8'));
  const section = page.locator('.guest-section');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText('גם בתוכנית של כיתה ח׳');
  const links = section.getByRole('list').getByRole('link');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveText('שאלות תנועהמתוך היחידה "משוואות"');
  await expect(links.nth(0)).toHaveAttribute('href', '#/learn/eq/6');
  await expect(links.nth(1)).toHaveText('משוואות עם מכנים ופרופורציהמתוך היחידה "משוואות"');
  await expect(links.nth(1)).toHaveAttribute('href', '#/learn/eq/7');
  // after the grade's units, before יסודות לחיזוק
  const order = await page.evaluate(() => {
    const [cards, guest, floor] = ['.topics-page > .section-cards', '.guest-section', '.floor-section'].map((s) => document.querySelector(s));
    return [!!(cards.compareDocumentPosition(guest) & Node.DOCUMENT_POSITION_FOLLOWING), !!(guest.compareDocumentPosition(floor) & Node.DOCUMENT_POSITION_FOLLOWING)];
  });
  expect(order).toEqual([true, true]);
  for (let k = 0; k < 2; k += 1) {
    await links.nth(k).scrollIntoViewIfNeeded();
    await expectUsable(page, links.nth(k), `guest row ${k + 1}`);
    expect((await links.nth(k).boundingBox()).height, 'a 44px target').toBeGreaterThanOrEqual(44);
  }
  await expectNoSidewaysScroll(page);
  await section.scrollIntoViewIfNeeded();
  await shot(page, 'topics-8');
  // ז׳: the situation graph of the functions unit
  await page.getByRole('radio', { name: 'כיתה ז׳' }).click();
  await expect(section.getByRole('heading', { level: 2 })).toHaveText('גם בתוכנית של כיתה ז׳');
  await expect(section.getByRole('link')).toHaveCount(1);
  await expect(section.getByRole('link')).toHaveText('קריאת גרף של מצבמתוך היחידה "מבוא לפונקציות"');
  await section.scrollIntoViewIfNeeded();
  await shot(page, 'topics-7');
  // by keyboard: the row is a link and Enter opens the stair's page
  await section.getByRole('link').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/learn\/func\/1$/);
  await expect(page.locator('.journey-head')).toBeVisible();
});

// Exam Rescue (FUNC-6 item 6): a ז׳ student who picks "מבוא לפונקציות" for a test gets func:1, the part of the unit ז׳
// learns, not the three ח׳ stairs; a ח׳ student's equations row is the whole ז׳ unit, as before (a ח׳ test revises it).
async function rescueTopics(page, grade) {
  await open(page, '#/rescue', student(grade));
  const d = new Date(NOW); d.setDate(d.getDate() + 3);
  await page.locator('#exam-date').fill(d.toLocaleDateString('en-CA'));
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await expect(page.locator('.rescue-topics')).toBeVisible();
}
async function buildPlan(page) {
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: /לבניית התוכנית/ }).click();
  await expect.poll(async () => (await saved(page)).learn?.exam?.skills).toBeTruthy();
  return (await saved(page)).learn.exam.skills;
}

test('ז׳ Rescue: the functions row is func:1 alone, and choosing it plans func:1', async ({ page }) => {
  await rescueTopics(page, '7');
  const row = page.getByRole('group', { name: 'מבוא לפונקציות', exact: true });
  const all = row.getByRole('checkbox', { name: 'מבוא לפונקציות (מה שלומדים בכיתה ז׳)' });
  await expect(row.locator('.chip-toggle')).toHaveText(['קריאת גרף של מצב']);
  await row.scrollIntoViewIfNeeded();
  await all.check();
  await expect(row.locator('.rescue-topic-count')).toHaveText('1/1');
  await expect(row.getByRole('checkbox', { name: 'קריאת גרף של מצב' })).toBeChecked();
  // the row's "whole topic" target (the stair chips keep Rescue's own size)
  expect((await all.locator('xpath=ancestor::label').boundingBox()).height, 'a 44px target').toBeGreaterThanOrEqual(44);
  await expectNoSidewaysScroll(page);
  await shot(page, 'rescue-7');
  expect(await buildPlan(page)).toEqual(['func:1']);
});

test('ח׳ Rescue: the equations row is the whole ז׳ unit, eq:6 and eq:7 included, as before', async ({ page }) => {
  await rescueTopics(page, '8');
  const row = page.getByRole('group', { name: 'משוואות', exact: true });
  await expect(row.locator('.chip-toggle')).toHaveCount(7);
  await row.scrollIntoViewIfNeeded();
  await row.getByRole('checkbox', { name: 'משוואות מכיתה ז׳ (כל הנושא)' }).check();
  await expect(row.locator('.rescue-topic-count')).toHaveText('7/7');
  expect(await buildPlan(page)).toEqual(['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5', 'eq:6', 'eq:7']);
});
