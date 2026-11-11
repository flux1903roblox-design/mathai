// The iPhone store build (STUDENT-12, VITE_STORE=ios, the 'ios' project's own server): before the first AI request the
// app says who the tutor is and what is sent, and asks (Apple 5.1.2(i)); "לא עכשיו" sends nothing. The family plan is
// not used in this build (Apple 3.1.3(b)/(c)): the device's family token, though saved, is never sent, and there is no
// family row. Nothing is sold: no purchase row, and the parents' pages are the store's. No service worker is registered.
// STORE_SHOTS=<folder> saves screenshots for a look (nothing is compared).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student } from './helpers.js';

const API = 'https://api.madregot.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const FREE = { paywall: true, tier: 'free', kinds: ['explain', 'chat'], groups: { tutor: { left: 2, limit: 2 }, check: null, generate: null, exam: null }, economy: false, shared: null, resetsAt: '2026-11-06T00:00:00+02:00', linked: null, legacyUntil: null, aiReady: true };
const TOKEN = `fd1.${'f'.repeat(64)}`;
const SELLING = /₪|מנוי|באתר|לקנות|לרכוש/;

async function fakeServer(page) {
  const log = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    log.push({ path, headers: req.headers(), body: req.postData() });
    if (path === '/api/ai/status') return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(FREE) });
    if (path === '/api/ai/chat') return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: { ...CORS, 'X-AI-Tier': 'free', 'X-AI-Group': 'tutor', 'X-AI-Left': '1' }, body: 'מחסרים ושמים את הסימן של הגדול.' });
    return route.fulfill({ status: 204, headers: CORS });
  });
  return log;
}

async function open(page, route) {
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  // a device that was linked to a family plan before (e.g. a backup brought it here): the token is saved
  const state = { ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '', familyDevice: { token: TOKEN, label: 'הטאבלט' }, consentAt: '' } }), version: 4 };
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('madregot', JSON.stringify(s)); }, state);
  await page.goto(`./${route}`);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
}
const chats = (log) => log.filter((r) => r.path === '/api/ai/chat');

async function shot(page, name) {
  const dir = process.env.STORE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/ios-${name}.png` });
  // the same in dark mode, then back
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/ios-${name}-dark.png` });
  await page.emulateMedia({ colorScheme: 'light' });
}

test('the permission sheet comes before the first AI request; "לא עכשיו" sends nothing; the family token never goes', async ({ page }) => {
  const log = await fakeServer(page);
  await open(page, '#/assistant');
  const draft = page.getByLabel('ההודעה שלכם');
  await draft.fill('איך מחברים 3 ועוד מינוס 5?');
  await draft.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'לפני שמדברים עם העוזר החכם' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('העוזר החכם הוא Claude של חברת Anthropic, תוכנה ולא אדם.');
  await expect(sheet).toContainText('לא נשלחים שם, מייל או טלפון, ומדרגות לא שומרת את השיחות.');
  await expect(sheet.getByRole('link', { name: 'מה עוד כדאי לדעת' })).toHaveAttribute('href', '#/privacy');
  expect(chats(log)).toHaveLength(0);
  await shot(page, 'consent');

  await sheet.getByRole('button', { name: 'לא עכשיו' }).click();
  await expect(sheet).toBeHidden();
  await expect(draft).toHaveValue('איך מחברים 3 ועוד מינוס 5?'); // the question waits, nothing was sent
  await page.waitForTimeout(500);
  expect(chats(log)).toHaveLength(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.ai.consentAt)).toBe('');
  await expect(page.locator('.form-error')).toHaveCount(0);

  await draft.press('Enter');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'כן, להמשיך' }).click();
  await expect(page.getByText('מחסרים ושמים את הסימן של הגדול.')).toBeVisible();
  expect(chats(log)).toHaveLength(1);
  const consentAt = await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.ai.consentAt);
  expect(Date.parse(consentAt)).not.toBeNaN();
  // asked once: the next question goes straight away
  await draft.fill('ועוד שאלה');
  await draft.press('Enter');
  await expect.poll(() => chats(log).length).toBe(2);
  await expect(sheet).toBeHidden();
  // no request of this build carried the family token, though the device has one saved
  expect(log.length).toBeGreaterThan(2);
  for (const r of log) expect(r.headers['x-family-device'], r.path).toBeUndefined();
});

test('nothing to buy and no family rows; the parents\' pages are the store\'s; no service worker', async ({ page }) => {
  await fakeServer(page);
  await open(page, '#/settings');
  const ai = page.locator('section[aria-labelledby="ai-title"]');
  await expect(ai.getByRole('link', { name: 'מידע להורים' })).toBeVisible();
  for (const row of ['חיבור למנוי משפחתי', 'ניתוק המכשיר מהמנוי', 'ביטול מנוי']) await expect(page.getByText(row)).toHaveCount(0);
  await ai.scrollIntoViewIfNeeded();
  await shot(page, 'settings');
  await ai.getByRole('link', { name: 'מידע להורים' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'מידע להורים' })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(SELLING);
  await shot(page, 'parents-info');
  // the web build registers its offline worker after the page loads (offline.spec.js); this build never does
  await page.goto('./#/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0);
});
