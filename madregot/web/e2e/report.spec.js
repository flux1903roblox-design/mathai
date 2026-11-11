// The weekly summary sent to a parent with no account (PARENTS-2, PARENTS-6 states 8 and 9, PARENTS-10 flows 1 and 2).
// Flow 1: the child opens the summary from the profile, sees the week, and opens the share sheet; the WhatsApp address
// carries the text and the link, unticking the repairs takes them out of the link, and nothing is sent to any server.
// The child's app knows its server (a fake Worker answers on the API host), so "nothing reaches it" is a real check.
// Flow 2: the parent opens the link on another phone (a fresh browser context, no profile): the same numbers, no
// request to /api/ or to any other host, and a cut link says so calmly. A phone whose app knows the server (as the
// production build does) makes no request to it either. The "no server" claim is proved by the network log, not
// stated. Screenshots for the evidence folder with REPORT_SHOTS=<folder>.
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { open, student, reportWeek, appReady, saved, NOW } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';

const API_HOST = new URL(API).host;
const WA = 'https://wa.me/?text=';
/** The week to report on, saved as a v3 save so the server address is kept (as monitor.spec.js does). */
const withServer = () => { const s = { ...reportWeek(), version: 3 }; s.state.ai = { mode: 'server', apiUrl: API, key: '', device: '' }; return s; };

/** Every request a page makes from now on: its address and its body. */
function watch(page) {
  const reqs = [];
  page.on('request', (r) => reqs.push({ url: r.url(), body: r.postData() || '' }));
  return reqs;
}

/** The WeekShare inside a payload ('1.' + base64url), as the server would see it if it ever got it. */
const decoded = (payload) => JSON.parse(Buffer.from(payload.slice(2), 'base64url').toString('utf8'));
const payloadIn = (text) => /#\/r\/(1\.[A-Za-z0-9_-]+)/.exec(text)?.[1];

/** Screenshots for the evidence folder (REPORT_SHOTS=<folder>); nothing is compared. */
async function shot(page, name, { fullPage = false } = {}) {
  const dir = process.env.REPORT_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(500); // a sheet's entrance ends
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png`, fullPage });
}

/** The number on a stat tile of the report, by its label. */
const tile = (page, label) => page.locator('.report-tiles .kpi').filter({ hasText: label }).locator('.kpi-num');

async function expectWeekNumbers(page) {
  await expect(tile(page, 'ימי תרגול')).toHaveText('4');
  await expect(tile(page, 'דקות')).toHaveText('62');
  await expect(tile(page, 'שאלות')).toHaveText('43');
  await expect(tile(page, 'ימים ברצף')).toHaveText('2');
  await expect(page.locator('.report-mastered li')).toHaveText(['מספרים מכוונים: השוואת מספרים', 'מספרים מכוונים: חיבור וחיסור']);
  await expect(page.locator('.report-worked .report-dots li')).toHaveText(['מערכת צירים: קריאת נקודה', 'מספרים מכוונים: השוואת מספרים', 'מספרים מכוונים: חיבור וחיסור']);
  const fixes = page.locator('.report-fix');
  await expect(fixes).toHaveCount(3);
  await expect(fixes.nth(0)).toContainText('מספרים מכוונים: השוואת מספרים');
  await expect(fixes.nth(0)).toContainText('בתיקון');
  await expect(fixes.nth(2)).toContainText('תוקן השבוע');
  await expect(page.locator('.report-exam')).toContainText('מבחן ב־12.11. 2 מתוך 3 המדרגות של המבחן כבר בשליטה.');
  await expect(page.locator('.report-dates')).toHaveText('א׳ 1.11 – ש׳ 7.11');
  await expect(page.getByRole('list', { name: 'ימי תרגול השבוע: 4' })).toBeVisible();
  await expect(page.locator('.report-day').nth(6)).toContainText('שבת, מנוחה');
}

/**
 * The child's part: from the profile to the share sheet, on a device whose app knows its server (a fake Worker).
 * Returns the sheet, every request from the tap on the card on, and the fake server's own log.
 */
async function childToSheet(page, baseURL) {
  const { log } = await fakeServer(page.context(), {}, baseURL);
  await open(page, '#/me', withServer());
  expect((await saved(page)).ai.apiUrl).toBe(API); // the app could reach its server
  await page.waitForLoadState('networkidle');
  const reqs = watch(page);
  const before = log.length;
  const card = page.getByRole('link', { name: /הסיכום השבועי/ });
  await expect(card).toContainText('4 ימי תרגול השבוע');
  await card.click();
  await expect(page.getByRole('heading', { level: 1, name: 'הסיכום השבועי' })).toBeVisible();
  await expect(page.getByText('זה הסיכום של השבוע שלכם. אם תשלחו אותו להורים, זה בדיוק מה שהם יראו.')).toBeVisible();
  // a Thursday: "השבוע" is chosen
  await expect(page.getByRole('radio', { name: 'השבוע', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expectWeekNumbers(page);
  await shot(page, 'report-week');
  if (process.env.REPORT_SHOTS) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await shot(page, 'report-week-end');
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.getByRole('button', { name: 'לשלוח להורים' }).click();
  const sheet = page.getByRole('dialog', { name: 'לשלוח להורים' });
  await expect(sheet).toBeVisible();
  return { sheet, reqs, server: () => log.slice(before) };
}

const hrefOf = async (sheet) => sheet.getByRole('link', { name: 'וואטסאפ' }).getAttribute('href');

test('flow 1: the child previews the week and sends it, and nothing reaches a server', async ({ page, baseURL }) => {
  const { sheet, reqs, server } = await childToSheet(page, baseURL);
  await shot(page, 'share-sheet');
  const wa = sheet.getByRole('link', { name: 'וואטסאפ' });
  await expect(wa).toHaveAttribute('target', '_blank');
  expect(await wa.getAttribute('rel')).toMatch(/\bnoopener\b/);

  const href = await hrefOf(sheet);
  expect(href.startsWith(WA)).toBe(true);
  expect(href.length).toBeLessThanOrEqual(4096);
  const text = decodeURIComponent(href.slice(WA.length));
  expect(text).toContain('#/r/1.');
  expect(text.split('\n')).toEqual([
    'הסיכום השבועי של נועה במדרגות (1.11–7.11):',
    '• תרגלתי 4 ימים, בערך 62 דקות',
    '• עברתי בדיקת שליטה בשתי מדרגות: מספרים מכוונים: השוואת מספרים, מספרים מכוונים: חיבור וחיסור',
    '• תרגלתי: מערכת צירים: קריאת נקודה, מספרים מכוונים: השוואת מספרים, מספרים מכוונים: חיבור וחיסור',
    '• בתיקון עכשיו: שתי טעויות שחוזרות',
    '• רצף: יומיים',
    expect.stringMatching(/^לסיכום המלא: http:\/\/127\.0\.0\.1:\d+\/#\/r\/1\.[A-Za-z0-9_-]+$/),
  ]);
  // the sheet shows exactly that text
  await expect(sheet.getByTestId('share-text')).toContainText('הסיכום השבועי של נועה במדרגות (1.11–7.11):');
  await expect(sheet.getByTestId('share-text')).toContainText('• בתיקון עכשיו: שתי טעויות שחוזרות');
  const payload = payloadIn(text);
  const week = decoded(payload);
  expect(week).toMatchObject({ v: 1, w: '2026-11-01', e: '2026-11-07', dd: [1, 1, 0, 1, 1, 3, 3], m: 62, q: 43, sr: 2, ma: ['signed:2', 'signed:1'] });
  expect(week.fx).toEqual([['signed:2', 'neg-compare', 'o'], ['coord:1', 'swap', 'o'], ['signed:1', 'minus-minus', 'd']]);
  // the name is in the message the child sends, never in the link
  expect(JSON.stringify(week)).not.toContain('נועה');
  expect(Buffer.from(payload.slice(2), 'base64url').toString('latin1')).toMatch(/^[\x20-\x7e]*$/);

  // leaving the repairs out takes them out of the text and out of the link
  await sheet.getByRole('checkbox', { name: 'לכלול את מה שמתקנים עכשיו' }).uncheck();
  const href2 = await hrefOf(sheet);
  const text2 = decodeURIComponent(href2.slice(WA.length));
  expect(text2).not.toContain('בתיקון');
  const payload2 = payloadIn(text2);
  expect(Object.hasOwn(decoded(payload2), 'fx')).toBe(false);
  await expect(sheet.getByTestId('share-text')).not.toContainText('בתיקון');

  // copy the link: the toast says so
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await sheet.getByRole('button', { name: 'העתקת הקישור' }).click();
  await expect(page.getByText('הקישור הועתק')).toBeVisible();

  // the network: nothing to the API host (the fake Worker heard nothing), nothing that carries the week, nothing to
  // another host
  const origin = new URL(baseURL).origin;
  expect(reqs.filter((r) => r.url.includes(API_HOST))).toEqual([]);
  expect(server()).toEqual([]);
  for (const p of [payload, payload2, payload.slice(2, 40)]) expect(reqs.filter((r) => r.url.includes(p) || r.body.includes(p))).toEqual([]);
  expect(reqs.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))).toEqual([]);
});

test('flow 2: the parent opens the link on another phone: the same week, and no request to any server', async ({ page, browser, baseURL }) => {
  const { sheet } = await childToSheet(page, baseURL);
  const payload = payloadIn(decodeURIComponent((await hrefOf(sheet)).slice(WA.length)));

  // the parent's phone: a new browser with nothing stored, no profile, no account
  const ctx = await browser.newContext({ baseURL, viewport: page.viewportSize(), locale: 'he-IL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const parent = await ctx.newPage();
    await parent.clock.setFixedTime(new Date(NOW.getTime() + 2 * 864e5)); // read two days later, on Saturday
    const reqs = watch(parent);
    await parent.goto(`./#/r/${payload}`);
    await appReady(parent);
    await expect(parent.getByRole('heading', { level: 1, name: 'מדרגות · סיכום שבועי' })).toBeVisible();
    await expectWeekNumbers(parent);
    // the repairs were sent on Thursday, and the page says so
    await expect(parent.locator('.report-asof')).toHaveText('נכון ל־5.11');
    await expect(parent.getByText('הסיכום נוצר במכשיר של הילד ונשלח ממנו. מדרגות לא שומרת אותו.', { exact: false })).toBeVisible();
    const about = parent.getByRole('link', { name: 'מה זה מדרגות?' });
    await expect(about).toHaveAttribute('href', '#/parents');
    // no price and no plan on this page (the frame's footer keeps its static links, the cancel link among them)
    expect(await parent.locator('.parents-main').innerText()).not.toMatch(/₪|מנוי/);
    expect(await parent.locator('body').innerText()).not.toContain('₪');
    await shot(parent, 'r-view', { fullPage: true });

    const origin = new URL(baseURL).origin;
    expect(reqs.filter((r) => r.url.includes('/api/'))).toEqual([]);
    expect(reqs.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))).toEqual([]);
    expect(reqs.filter((r) => r.url.includes(payload.slice(2, 40)) || r.body.includes(payload.slice(2, 40)))).toEqual([]);

    // offline, the account pages say they need the connection; the week does not, since it reads only its link
    await ctx.setOffline(true);
    await parent.evaluate(() => { window.location.hash = '#/parents/info'; });
    await expect(parent.getByText('כדי להמשיך צריך חיבור לאינטרנט.')).toBeVisible();
    await parent.evaluate((p) => { window.location.hash = `#/r/${p}`; }, payload);
    await expect(tile(parent, 'שאלות')).toHaveText('43');
    await expect(parent.getByText('כדי להמשיך צריך חיבור לאינטרנט.')).toHaveCount(0);
    await ctx.setOffline(false);

    // a link cut short (a message that lost its end): a calm sentence, and still no request
    const broken = await ctx.newPage();
    const reqs2 = watch(broken);
    await broken.goto(`./#/r/${payload.slice(0, 30)}`);
    await appReady(broken);
    await expect(broken.getByText('הקישור לא שלם.')).toBeVisible();
    await expect(broken.getByText('אפשר לבקש מהילד לשלוח אותו שוב.')).toBeVisible();
    await expect(broken.locator('.report')).toHaveCount(0);
    expect(reqs2.filter((r) => r.url.includes('/api/') || !r.url.startsWith(origin))).toEqual([]);
    await shot(broken, 'r-broken');
  } finally {
    await ctx.close();
  }

  // a phone whose app knows the server (as the production build does, on the same address), with no profile: the
  // link still makes no request to it
  const prod = await browser.newContext({ baseURL, viewport: page.viewportSize(), locale: 'he-IL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const { log } = await fakeServer(prod, {}, baseURL);
    const known = { ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' } }), version: 3 };
    known.state.profile = null;
    await prod.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('madregot', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(known));
    const p = await prod.newPage();
    await p.clock.setFixedTime(NOW);
    const reqs = watch(p);
    await p.goto(`./#/r/${payload}`);
    await appReady(p);
    await expect(tile(p, 'שאלות')).toHaveText('43');
    expect((await saved(p)).ai.apiUrl).toBe(API); // the app could reach its server
    await p.waitForTimeout(1500);
    expect(log).toEqual([]);
    expect(reqs.filter((r) => r.url.includes(API_HOST) || r.url.includes('/api/'))).toEqual([]);
  } finally {
    await prod.close();
  }
});

test('state 8: a week with nothing yet: מדי, a calm line, and nothing to send yet', async ({ page }) => {
  await open(page, '#/report', student('7'));
  await expect(page.getByRole('heading', { name: 'עוד אין מה לסכם השבוע.' })).toBeVisible();
  await expect(page.getByText('אחרי השיעור הבא יופיע כאן.')).toBeVisible();
  const send = page.getByRole('button', { name: 'לשלוח להורים' });
  await expect(send).toBeDisabled();
  await expect(page.getByText('אחרי השיעור הבא יהיה כאן מה לשלוח.')).toBeVisible();
  await expect(page.locator('.report')).toHaveCount(0);
  await shot(page, 'report-empty');
  // last week is there to look at too
  await page.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(page.getByRole('heading', { name: 'בשבוע שעבר לא היה תרגול.' })).toBeVisible();
});

test('last week: its own days, no repairs as of now, and the switch is a radio group', async ({ page }) => {
  await open(page, '#/report', reportWeek());
  await page.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(page.getByRole('radio', { name: 'השבוע שעבר' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.report-dates')).toHaveText('א׳ 25.10 – ש׳ 31.10');
  await expect(tile(page, 'ימי תרגול')).toHaveText('1');
  await expect(page.locator('.report-fixes')).toHaveCount(0);
});

test('the staging copy shows a fixed week with ?qa-report=week', async ({ page }) => {
  await open(page, '#/report?qa-report=week', student('7'));
  await expect(page.locator('.report-dates')).toHaveText('א׳ 8.11 – ש׳ 14.11');
  await expect(tile(page, 'ימי תרגול')).toHaveText('4');
  await expect(page.locator('.report-mastered li')).toHaveCount(2);
});

test('on a Sunday the summary opens on last week, the week that has just ended', async ({ page }) => {
  await open(page, '#/report', reportWeek());
  await page.clock.setFixedTime(new Date('2026-11-08T10:00:00')); // Sunday 8 November
  await page.reload();
  await appReady(page);
  await expect(page.getByRole('radio', { name: 'השבוע שעבר' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.report-dates')).toHaveText('א׳ 1.11 – ש׳ 7.11');
  await expect(tile(page, 'ימי תרגול')).toHaveText('4');
  // this week has only just begun: its own empty state, and the button waits
  await page.getByRole('radio', { name: 'השבוע', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'עוד אין מה לסכם השבוע.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'לשלוח להורים' })).toBeDisabled();
});
