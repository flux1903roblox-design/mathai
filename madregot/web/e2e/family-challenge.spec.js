// Safe pull with no strangers (PRODUCT2-39): a family challenge over a link, and the student's own last week.
// The parent, on their own phone with no profile and no account (the public build has no server), picks a small goal for
// the week on /parents and sends it as a link; the goal rides in the # fragment, so nothing reaches any server. The child
// opens it on their device, takes it, and sees it on the missions tab; its progress shows in the child's weekly summary
// and in the /r link the child sends back. A link that is cut, or is for a week that ended, says so calmly; a device with
// no student says where to open it. No price, no countdown, no loss words, and no other student anywhere.
// Screenshots for the evidence folder with FC_SHOTS=<folder>.
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { open, student, saved, appReady, expectNoSidewaysScroll, expectUsable } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'a phone journey'); });

const SUNDAY = new Date('2026-11-08T10:00:00');
const WEDNESDAY = new Date('2026-11-11T17:00:00');
const WA = 'https://wa.me/?text=';
const PRESSURE = /פספס|תפספסו|איבד|תאבדו|נשבר|נכשל|מהרו|נשאר(ו|ה)? רק|עוד \d+ ימים|לפני שייגמר|ייגמר|הזדמנות אחרונה/;
const PRICE = /₪|מנוי|מחיר|לשלם/;

/** Screenshots for the evidence folder (FC_SHOTS=<folder>); nothing is compared. */
async function shot(page, name, { fullPage = false } = {}) {
  const dir = process.env.FC_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  await page.screenshot({ path: `${dir}/${name}-${test.info().project.name}.png`, fullPage });
}

/** Every request a page makes from now on. */
function watch(page) {
  const reqs = [];
  page.on('request', (r) => reqs.push({ url: r.url(), body: r.postData() || '' }));
  return reqs;
}

/** The payload of a family challenge link inside a text. */
const payloadIn = (text) => /#\/f\/(1\.[A-Za-z0-9_-]+)/.exec(text)?.[1];
const decoded = (payload) => JSON.parse(Buffer.from(payload.slice(2), 'base64url').toString('utf8'));

/** A link made the way the parent's card makes it (for the states that need a week the card would not offer). */
const linkFor = (o) => `1.${Buffer.from(JSON.stringify({ v: 1, ...o })).toString('base64url')}`;

/** The child's week: last week 5 stages on 3 days, this week (to Wednesday) 5 stages on 2 practice days. */
const childDays = {
  '2026-11-01': { lessons: 2, xp: 24 }, '2026-11-03': { lessons: 1, stages: 1, xp: 20 }, '2026-11-05': { lessons: 1, xp: 12 },
  '2026-11-08': { lessons: 1, stages: 2, xp: 30, q: 8, ok: 7, secs: 400 }, '2026-11-10': { lessons: 2, xp: 24, q: 12, ok: 9, secs: 560 },
};

test('the parent picks a goal on /parents and sends a link: no account, no server, no price', async ({ browser, baseURL }) => {
  // the parent's own phone: nothing stored, no profile
  const ctx = await browser.newContext({ baseURL, viewport: test.info().project.use.viewport, locale: 'he-IL', reducedMotion: 'reduce', serviceWorkers: 'block', isMobile: true, hasTouch: true });
  try {
    const page = await ctx.newPage();
    await page.clock.setFixedTime(SUNDAY);
    const reqs = watch(page);
    await page.goto('./#/parents');
    await appReady(page);
    const card = page.locator('.challenge-card');
    await expect(card.getByRole('heading', { level: 2, name: 'אתגר משפחתי לשבוע' })).toBeVisible();
    await expect(card.locator('.ch-week')).toHaveText('לשבוע הזה: 8.11–14.11');
    // a short list, four days chosen first; every goal of days fits the school days left (Sunday: all three)
    const goals = card.getByRole('radio');
    await expect(goals).toHaveCount(5);
    await expect(card.getByRole('radio', { name: '4 ימי תרגול' })).toBeChecked();
    for (const box of await card.locator('.ch-chip').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    // the keyboard moves between the goals
    await card.getByRole('radio', { name: '4 ימי תרגול' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(card.getByRole('radio', { name: '5 ימי תרגול' })).toBeChecked();
    await page.keyboard.press('ArrowUp');
    await expect(card.getByRole('radio', { name: '4 ימי תרגול' })).toBeChecked();
    expect(await card.innerText()).not.toMatch(PRICE);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'parent-picker');
    await shot(page, 'parent-picker-full', { fullPage: true });

    // the message: the goal, its week, and the link last, whole
    const wa = card.getByRole('link', { name: 'וואטסאפ' });
    await expect(wa).toHaveAttribute('target', '_blank');
    const text = decodeURIComponent((await wa.getAttribute('href')).slice(WA.length));
    const lines = text.split('\n');
    expect(lines[0]).toBe('אתגר משפחתי במדרגות לשבוע 8.11–14.11: 4 ימי תרגול.');
    expect(lines[1]).toBe('פותחים את הקישור בטלפון שבו מתרגלים, ומקבלים את האתגר:');
    expect(lines[2]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/#\/f\/1\.[A-Za-z0-9_-]+$/);
    const payload = payloadIn(text);
    expect(decoded(payload)).toEqual({ v: 1, w: '2026-11-08', k: 'd', n: 4 });

    // copying the link remembers what was sent (the parent's report counts that week against it), and says so
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await card.getByRole('button', { name: 'העתקת הקישור' }).click();
    await expect(page.getByText('הקישור הועתק')).toBeVisible();
    await expect(card.locator('.ch-sent')).toHaveText('שלחתם: 4 ימי תרגול לשבוע 8.11–14.11.');
    expect((await saved(page)).family.sent).toMatchObject({ w: '2026-11-08', k: 'd', n: 4 });

    // nothing reached a server: no /api/ and no other host, and nothing carried the goal
    const origin = new URL(baseURL).origin;
    expect(reqs.filter((r) => r.url.includes('/api/'))).toEqual([]);
    expect(reqs.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))).toEqual([]);
    expect(reqs.filter((r) => r.url.includes(payload.slice(2)) || r.body.includes(payload.slice(2)))).toEqual([]);
    await expectNoSidewaysScroll(page);

    // on Wednesday only a goal of days that still fits is offered; from Thursday the goal is for next week
    await page.clock.setFixedTime(WEDNESDAY);
    await page.reload(); await appReady(page);
    await expect(card.locator('.ch-chip')).toHaveText(['3 ימי תרגול', '5 שלבים', '10 שלבים']);
    await page.clock.setFixedTime(new Date('2026-11-12T09:00:00'));
    await page.reload(); await appReady(page);
    await expect(card.locator('.ch-week')).toHaveText('לשבוע הבא: 15.11–21.11');
  } finally {
    await ctx.close();
  }
});

test('the child takes the challenge: it waits on the missions tab with the week\'s days, and can be taken off', async ({ page }) => {
  const payload = linkFor({ w: '2026-11-08', k: 'd', n: 4 });
  await open(page, `#/f/${payload}`, student('7', { days: { '2026-11-01': { lessons: 2 } } }), '424242', SUNDAY);
  const reqs = watch(page);
  await expect(page.getByRole('heading', { level: 1, name: 'אתגר משפחתי' })).toBeVisible();
  const offer = page.locator('.offer-card');
  await expect(offer.locator('.offer-goal')).toHaveText('4 ימי תרגול');
  await expect(offer.locator('.offer-week')).toHaveText('בשבוע 8.11–14.11');
  await expect(offer).toContainText('האתגר נשמר רק במכשיר הזה. אפשר להסיר אותו בכל רגע במסך המשימות.');
  expect(await page.locator('body').innerText()).not.toMatch(PRICE);
  expect(await page.locator('body').innerText()).not.toMatch(PRESSURE);
  await expectUsable(page, page.getByRole('button', { name: 'לקבל את האתגר' }), 'the way to take it');
  await shot(page, 'child-offer');
  await page.getByRole('button', { name: 'לקבל את האתגר' }).click();
  await expect(page).toHaveURL(/#\/quests$/);
  await expect(page.getByText('האתגר נשמר במסך המשימות')).toBeVisible();
  const card = page.locator('.family-card');
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('אתגר משפחתי');
  await expect(card.locator('.fc-goal')).toHaveText('4 ימי תרגול השבוע');
  await expect(card.locator('.fc-line')).toHaveText('עד עכשיו: 0 מתוך 4.');
  expect((await saved(page)).family.challenges['2026-11-08']).toMatchObject({ k: 'd', n: 4 });
  expect(reqs.filter((r) => r.url.includes('/api/'))).toEqual([]);

  // the same link again: it is already here
  await page.goto(`./#/f/${payload}`);
  await expect(page.locator('.offer-kept')).toHaveText('האתגר הזה כבר אצלכם, במסך המשימות.');
  await page.getByRole('button', { name: 'למשימות' }).click();

  // the child takes it off: gone from the tab, and said calmly
  await card.getByRole('button', { name: 'להסיר את האתגר' }).click();
  await expect(page.getByText('האתגר הוסר. אם תרצו, אפשר לפתוח שוב את הקישור מההורים.')).toBeVisible();
  await expect(page.locator('.family-card')).toHaveCount(0);
  expect((await saved(page)).family.challenges).toEqual({});
});

test('on Wednesday: the ghost race and the challenge side by side on the missions tab, the same in the weekly summary and the /r link', async ({ page, browser, baseURL }) => {
  const family = { challenges: { '2026-11-08': { k: 'd', n: 4, at: '2026-11-08T08:00:00.000Z' } }, sent: null };
  await open(page, '#/quests', student('7', { days: childDays, family }), '424242', WEDNESDAY);
  const card = page.locator('.family-card');
  await expect(card.locator('.fc-line')).toHaveText('עד עכשיו: 2 מתוך 4.');
  await expect(card.locator('.fc-dot.is-on')).toHaveCount(2);
  await expect(card.locator('.fc-dot')).toHaveCount(4);
  const ghost = page.locator('.ghost-card');
  await expect(ghost.locator('.ghost-row.is-last')).toHaveText(/^השבוע שעבר:\s*5 שלבים$/);
  await expect(ghost.locator('.ghost-row.is-now')).toHaveText(/^השבוע:\s*5 שלבים$/);
  await expect(ghost.locator('.ghost-say')).toHaveText('בדיוק כמו בשבוע שעבר.');
  await expect(ghost.locator('.ghost-days')).toHaveText('ימי תרגול: השבוע 2, בשבוע שעבר 3');
  for (const t of [await card.innerText(), await ghost.innerText()]) { expect(t).not.toMatch(PRESSURE); expect(t).not.toMatch(PRICE); }
  await expectNoSidewaysScroll(page);
  await card.scrollIntoViewIfNeeded();
  await shot(page, 'quests-challenge');
  await ghost.scrollIntoViewIfNeeded();
  await shot(page, 'quests-ghost');

  // the weekly summary has the challenge, in the same words a parent will read
  await page.goto('./#/report');
  const sec = page.locator('.report-challenge');
  await expect(sec.getByRole('heading')).toHaveText('אתגר משפחתי');
  await expect(sec.locator('.report-line')).toHaveText('היעד: 4 ימי תרגול. עד עכשיו: 2 מתוך 4.');
  await sec.scrollIntoViewIfNeeded();
  await shot(page, 'report-challenge');
  await page.getByRole('button', { name: 'לשלוח להורים' }).click();
  const sheet = page.getByRole('dialog', { name: 'לשלוח להורים' });
  const text = decodeURIComponent((await sheet.getByRole('link', { name: 'וואטסאפ' }).getAttribute('href')).slice(WA.length));
  expect(text.split('\n')).toContain('• האתגר המשפחתי: 2 מתוך 4 ימי תרגול');
  const week = /#\/r\/(1\.[A-Za-z0-9_-]+)/.exec(text)[1];
  expect(JSON.parse(Buffer.from(week.slice(2), 'base64url').toString('utf8')).fc).toEqual(['d', 4]);

  // the parent opens the /r link on their own phone: the same section, the same numbers
  const ctx = await browser.newContext({ baseURL, viewport: page.viewportSize(), locale: 'he-IL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const parent = await ctx.newPage();
    await parent.clock.setFixedTime(WEDNESDAY);
    await parent.goto(`./#/r/${week}`);
    await appReady(parent);
    await expect(parent.locator('.report-challenge .report-line')).toHaveText('היעד: 4 ימי תרגול. עד עכשיו: 2 מתוך 4.');
    await expect(parent.locator('.report-challenge')).toContainText('האתגר הגיע בקישור מההורים, והתקבל במכשיר.');
  } finally {
    await ctx.close();
  }
});

test('a link that is cut, one for a week that ended, and one opened on a phone with no student: calm words, nothing kept', async ({ page }) => {
  await open(page, '#/f/1.eyJ2IjoxLCJ', student('7'), '424242', WEDNESDAY);
  await expect(page.getByText('הקישור לא שלם.')).toBeVisible();
  await expect(page.getByText('אפשר לבקש מההורים לשלוח אותו שוב.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'לקבל את האתגר' })).toHaveCount(0);
  await page.goto(`./#/f/${linkFor({ w: '2026-11-01', k: 'd', n: 3 })}`);
  await expect(page.getByText('האתגר הזה היה לשבוע שכבר עבר.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'לקבל את האתגר' })).toHaveCount(0);
  expect((await saved(page)).family?.challenges || {}).toEqual({});

  // a phone with no student (the parent's own, before the child has the app): where to open it, and a way to start
  await open(page, `#/f/${linkFor({ w: '2026-11-08', k: 's', n: 5 })}`, null, '424242', WEDNESDAY);
  await expect(page.locator('.offer-goal')).toHaveText('5 שלבים');
  await expect(page.locator('.offer-elsewhere')).toHaveText('את האתגר מקבלים בטלפון שבו מתרגלים במדרגות. פתחו את הקישור שם.');
  await expect(page.getByRole('button', { name: 'לקבל את האתגר' })).toHaveCount(0);
  await page.getByRole('button', { name: 'להתחיל לתרגל במדרגות' }).click();
  await expect(page.locator('.ob').first()).toBeVisible();
});

test('a linked device: the parent\'s daily report counts that week against the goal sent from this phone', async ({ page }) => {
  // the staging copy's QA state of /parents (two linked devices, nothing asked of a server); the goal was sent from here
  const state = student('7', { family: { challenges: {}, sent: { w: '2026-11-01', k: 'd', n: 4, at: '2026-11-01T08:00:00.000Z' } } });
  state.state.profile = null;
  const reqs = watch(page);
  await open(page, '#/parents?qa-parent=report', state);
  const tablet = page.locator('.report-device').filter({ has: page.getByRole('heading', { name: 'הטאבלט' }) });
  const sec = tablet.locator('.report-challenge');
  await expect(sec.getByRole('heading')).toHaveText('אתגר משפחתי');
  await expect(sec.locator('.report-line')).toHaveText(/^היעד: 4 ימי תרגול\. (עד עכשיו: \d מתוך 4\.|הושלם, 4 מתוך 4\.)$/);
  await expect(sec).toContainText('זה האתגר ששלחתם. ההתקדמות נספרת מהסיכומים שמגיעים מהמכשיר.');
  // last week had no goal: no section there
  await tablet.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(tablet.locator('.report-challenge')).toHaveCount(0);
  expect(reqs.filter((r) => r.url.includes('/api/'))).toEqual([]);
});
