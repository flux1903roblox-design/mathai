// Store mode (STUDENT-12): the Play Store app (a TWA: ?src=play, then running standalone) sells nothing. The tutor's
// limit sheet says when the questions come back, with no price, plan or way to the parents' pages; Settings has no row
// that leads to buying or cancelling; /parents/info (and /parents, /cancel) say only how a parent lets the child ask
// the tutor. The same phone's ordinary Chrome tab, or a visit without ?src=play, keeps the website's rows.
// The server is a fake one (page.route): the free taste with one question left, then "done for today".
// STORE_SHOTS=<folder> saves screenshots for a look (nothing is compared).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student } from './helpers.js';

const API = 'https://api.madregot.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const FREE = { paywall: true, tier: 'free', kinds: ['explain', 'chat'], groups: { tutor: { left: 1, limit: 2 }, check: null, generate: null, exam: null }, economy: false, shared: null, resetsAt: '2026-11-06T00:00:00+02:00', linked: null, legacyUntil: null, aiReady: true };
const SELLING = /₪|מנוי|באתר|לקנות|לרכוש/;

test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

/** The Worker: the free taste's status, and the chat already done for today. */
async function fakeServer(page) {
  const log = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    log.push({ path, headers: req.headers(), body: req.postData() });
    const reply = (status, data) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(data) });
    if (path === '/api/ai/status') return reply(200, FREE);
    if (path === '/api/ai/chat') return reply(429, { error: 'daily_limit', tier: 'free', group: 'tutor', limit: 2, left: 0 });
    if (path === '/api/metrics') return route.fulfill({ status: 204, headers: CORS });
    return reply(404, { error: 'not_found' });
  });
  return log;
}

/** The Play Store app's window: display-mode standalone (a TWA runs so). */
const standalone = (page) => page.addInitScript(() => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q)
    ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
    : real(q));
});

/** Seed the device once (as saved by this version of the app, with the server's address), then open `route`. */
let seeds = 0;
async function open(page, route, state) {
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  seeds += 1;
  await page.addInitScript(([s, k]) => {
    if (location.protocol === 'about:' || sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
    localStorage.clear();
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
  }, [state, `seeded-${seeds}-${Date.now()}`]);
  await page.goto(`./${route}`);
  await page.evaluate(() => document.fonts.ready);
}
const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, ...extra }), version: 4 });
const fresh = () => ({ state: { ai: { mode: 'server', apiUrl: API, key: '', device: '' } }, version: 4 });

async function shot(page, name) {
  const dir = process.env.STORE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png` });
  // the same in dark mode, then back
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}-dark.png` });
  await page.emulateMedia({ colorScheme: 'light' });
}

/** Ask the tutor in the chat: today's questions are over, so the calm sheet opens. */
async function useUpTheTutor(page) {
  await page.goto('./#/assistant');
  const draft = page.getByLabel('ההודעה שלכם');
  await draft.fill('איך מחברים 3 ועוד מינוס 5?');
  await draft.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'העוזר החכם חוזר מחר' });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** The reach counts the page sent (STUDENT-14 beacons to /api/metrics), by name. */
const beacons = (log) => log.filter((r) => r.path === '/api/metrics').map((r) => r.body);

test('the Play Store app: a limit sheet, Settings and the parents\' pages with nothing to buy', async ({ page }) => {
  const log = await fakeServer(page);
  await standalone(page);
  await open(page, '#/?src=play', withServer());
  await expect(page.locator('.unit').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('madregot-src'))).toBe('play');
  // the open is counted once a day (STUDENT-14): a reload the same day sends nothing more
  await expect.poll(() => beacons(log)).toEqual(['store_open_play']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.nudges.storeOpenDay)).toBe('2026-11-05');
  await page.reload();
  await expect(page.locator('.unit').first()).toBeVisible();
  await page.waitForTimeout(300);
  expect(beacons(log)).toEqual(['store_open_play']);

  const sheet = await useUpTheTutor(page);
  await expect(sheet).toContainText('סיימתם את השאלות לעוזר החכם להיום. מחר יש עוד. השיעורים, התרגול ומדי פתוחים תמיד.');
  await expect(sheet.getByRole('button', { name: 'מידע להורים' })).toHaveCount(0);
  await expect(sheet.locator('a[href*="parents"], a[href*="cancel"]')).toHaveCount(0);
  expect(await sheet.innerText()).not.toMatch(SELLING);
  await shot(page, 'limit-sheet');
  await page.keyboard.press('Escape');

  await page.goto('./#/settings');
  const ai = page.locator('section[aria-labelledby="ai-title"]');
  await expect(ai.getByRole('link', { name: 'מידע להורים' })).toBeVisible();
  await expect(ai.getByText('חיבור למנוי משפחתי')).toHaveCount(0);
  await expect(page.getByText('ביטול מנוי')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /מנוי/ })).toHaveCount(0);
  await ai.scrollIntoViewIfNeeded();
  await shot(page, 'settings');

  for (const route of ['#/parents/info', '#/parents', '#/parents/link', '#/cancel']) {
    await page.goto(`./${route}`);
    await expect(page.getByRole('heading', { level: 1, name: 'מידע להורים' }), route).toBeVisible();
    await expect(page.getByText('כדי לשאול את העוזר החכם, אחד ההורים צריך לאשר את זה פעם אחת. זה בחינם ולוקח דקה.')).toBeVisible();
    expect(await page.locator('body').innerText(), route).not.toMatch(SELLING);
  }
  await page.goto('./#/parents/info');
  await shot(page, 'parents-info');
});

test('the Play Store app\'s first screen has no way to the parents\' or the cancel page; the website\'s has', async ({ page }) => {
  const log = await fakeServer(page);
  // the website first: once the server says the tutor is sold, the first screen links the parents' and cancel pages
  await open(page, '#/', fresh());
  await expect(page.getByRole('link', { name: 'להורים' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ביטול מנוי' })).toBeVisible();

  await standalone(page);
  await open(page, '#/?src=play', fresh());
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
  await expect.poll(() => log.filter((r) => r.path === '/api/ai/status').length).toBeGreaterThan(1);
  await page.waitForTimeout(300);
  const legal = page.getByRole('navigation', { name: 'מידע משפטי' });
  await expect(legal.getByRole('link', { name: 'פרטיות' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'להורים' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'ביטול מנוי' })).toHaveCount(0);
});

test('the website (no ?src=play), and ?src=play in an ordinary tab, keep the parents\' rows', async ({ page }) => {
  const log = await fakeServer(page);
  await open(page, '#/', withServer());
  const sheet = await useUpTheTutor(page);
  await expect(sheet.getByRole('button', { name: 'מידע להורים' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('./#/settings');
  for (const row of ['חיבור למנוי משפחתי', 'מידע להורים', 'ביטול מנוי']) await expect(page.getByRole('link', { name: row })).toBeVisible();
  await page.goto('./#/parents/info');
  await expect(page.getByRole('heading', { level: 1, name: 'המסך הזה בשביל ההורים' })).toBeVisible();

  // the Play Store note alone is not a store app: the same phone's Chrome tab shares the storage, but is not standalone
  await page.goto('./#/?src=play');
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('madregot-src'))).toBe('play');
  await page.goto('./#/settings');
  await expect(page.getByRole('link', { name: 'ביטול מנוי' })).toBeVisible();
  // and the website counts no store-app open
  expect(beacons(log).filter((b) => /^store_open/.test(b))).toEqual([]);
});
