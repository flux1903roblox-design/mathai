// The opt-in daily reminder (STUDENT-11), end to end against a fake server (page.route: no Worker), with the service
// worker running (this file opts in) and notifications allowed (context.grantPermissions). Chromium here has no push
// service to subscribe with (subscribe() fails there), so an init script plays the browser's PushManager: subscribe() returns a subscription with
// a synthetic push address. From the third learning day the last screen after a lesson offers the reminder; "להפעיל"
// sends the subscription with the hour; Settings shows it on, changes the hour with `replaces`, and turns it off. A
// push delivered to the service worker (DevTools ServiceWorker.deliverPushMessage) shows a Hebrew notification, right
// to left. iPhone Safari in a tab gets only the Home Screen sentence. The clock is Thursday 5 November 2026.
// PUSH_SHOTS=<folder> saves screenshots for a look (nothing is compared).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student, answer, proceedToNext, saved, expectUsable } from './helpers.js';

// Chromium's headless shell (the other files' browser) has no notifications at all: Notification.permission stays
// 'denied' whatever is granted. The full Chromium in its new headless mode has them, so this file runs on it.
test.use({ serviceWorkers: 'allow', channel: 'chromium' });
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'Chrome on the phone, with its service worker'); });

const API = 'https://api.madregot.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
// a P-256 public key (RFC 8291's example sender key): the server's VAPID key as /api/push/key gives it
const KEY = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
// Tuesday and Wednesday learned: a lesson today (Thursday) makes the third learning day
const TWO_DAYS = { '2026-11-03': { lessons: 1, xp: 12, q: 8, ok: 7 }, '2026-11-04': { lessons: 1, xp: 12, q: 8, ok: 7 } };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

/** A fake Worker: the reminder's four endpoints (the key can be off: 404), the reach counts and the tutor's status. */
async function fakeServer(page, { keyStatus = 200 } = {}) {
  const log = [];
  let n = 0;
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    if (path === '/api/metrics') { log.push({ path, body: req.postData() }); return route.fulfill({ status: 204, headers: CORS }); }
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.push({ path, body });
    const reply = (code, data) => route.fulfill({ status: code, contentType: 'application/json', headers: CORS, body: JSON.stringify(data) });
    if (path === '/api/push/key') return keyStatus === 200 ? reply(200, { key: KEY }) : reply(keyStatus, { error: 'not_found' });
    if (path === '/api/push/subscribe') { n += 1; return reply(200, { id: `${n}`.padStart(16, 'a'), secret: `${n}`.padStart(32, 'b') }); }
    if (path === '/api/push/seen') return reply(200, { status: 'on' });
    if (path === '/api/push/off') return reply(200, { ok: true });
    if (path === '/api/ai/status') return reply(200, { paywall: false, tier: 'open', kinds: ['explain', 'chat', 'generate', 'check', 'exam'], groups: { all: { left: 40, limit: 40 } }, aiReady: true });
    return reply(404, { error: 'not_found' });
  });
  return log;
}

/** The browser's push manager, played (Chromium here has no push service); and no install prompt (STUDENT-10). */
async function playPush(page) {
  await page.addInitScript(() => {
    // the install offer would take the last screen instead (one card per result): keep the browser's event away
    window.addEventListener('beforeinstallprompt', (e) => e.stopImmediatePropagation(), true);
    if (!('PushManager' in window)) return;
    const fake = (endpoint) => ({
      endpoint, options: { applicationServerKey: null },
      toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'BKkDzOKmhm6v0d8Ty2pSZ6bF1Kq0rCq1YQ6b3xJ2O1z7', auth: 'c2ludGhldGljLWF1dGg' } }),
      unsubscribe: async () => { sessionStorage.removeItem('e2e-push'); sessionStorage.setItem('e2e-unsub', '1'); return true; },
    });
    PushManager.prototype.subscribe = async function subscribe(opts) {
      const made = JSON.parse(sessionStorage.getItem('e2e-made') || '[]');
      made.push({ userVisibleOnly: opts.userVisibleOnly, keyBytes: new Uint8Array(opts.applicationServerKey).length });
      sessionStorage.setItem('e2e-made', JSON.stringify(made));
      sessionStorage.setItem('e2e-push', `https://fcm.googleapis.com/fcm/send/e2e-${made.length}`);
      return fake(sessionStorage.getItem('e2e-push'));
    };
    PushManager.prototype.getSubscription = async function getSubscription() {
      const ep = sessionStorage.getItem('e2e-push');
      return ep ? fake(ep) : null;
    };
  });
}

/** Open a route on a device with a saved state, seeded once before the app starts (as class-goal.spec.js does). */
let seeds = 0;
async function open(page, route, state) {
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  seeds += 1;
  const key = `seeded-${seeds}-${Date.now()}`;
  await page.addInitScript(([s, k]) => {
    if (location.protocol === 'about:' || sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', '424242');
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
  }, [state, key]);
  await page.goto(`./${route}`);
  await page.evaluate(() => document.fonts.ready);
}
const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, ...extra }), version: 4 });
const calls = (log, path) => log.filter((r) => r.path === path);

async function shot(page, name) {
  const dir = process.env.PUSH_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${name}.png` });
}

async function playLesson(page) {
  await expect.poll(() => page.evaluate(() => window.__madregotItem)).toBeTruthy();
  for (let k = 0; k < 16 && !(await page.locator('.done-screen').count()); k += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen .stats')).toBeVisible();
}

/** Press on through the screens after a lesson until the reminder's offer or the map: which one came. */
async function walkEndScreens(page) {
  const heading = () => page.locator('.done-screen h1').first().textContent({ timeout: 1000 }).catch(() => null);
  for (let k = 0; k < 8; k += 1) {
    await expect(page.locator('.remind-stage, .learn-top, .done-screen .done-actions .btn').first()).toBeVisible();
    if (await page.locator('.remind-stage').isVisible()) return 'reminder';
    if (await page.locator('.learn-top').isVisible()) return 'map';
    const before = await heading();
    await page.locator('.done-screen .done-actions .btn').first().click();
    await expect.poll(async () => { const now = await heading(); return now === null || now !== before; }, { timeout: 5000 }).toBe(true);
  }
  throw new Error('more screens after a lesson than expected');
}

test('from the third learning day, the last screen offers the reminder; "להפעיל" sends the subscription with 17:00', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['notifications'], { origin: new URL(baseURL).origin });
  const log = await fakeServer(page);
  await playPush(page);
  await open(page, '#/lesson/signed/1', withServer({ days: TWO_DAYS }));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await playLesson(page);
  // the server is asked while the first screen after the lesson is up (its answer counts only until the student moves on)
  await expect.poll(() => calls(log, '/api/push/key').length).toBe(1);
  await page.waitForTimeout(200);
  expect(await walkEndScreens(page)).toBe('reminder');
  const card = page.locator('.remind-stage');
  await expect(card.getByRole('heading', { level: 1 })).toHaveText('רוצים תזכורת קטנה?');
  await expect(card.locator('#remind-text')).toHaveText('הודעה אחת ביום, בשעה שתבחרו. לא בשבת ובחגים, ולא ביום שכבר למדתם.');
  const slots = card.getByRole('radiogroup', { name: 'באיזו שעה?' });
  await expect(slots.getByRole('radio')).toHaveText(['16:00', '17:00', '18:00', '19:00', '20:00']);
  await expect(slots.getByRole('radio', { name: '17:00' })).toHaveAttribute('aria-checked', 'true');
  const yes = card.getByRole('button', { name: 'להפעיל', exact: true });
  await expect(yes).toBeFocused();
  await expectUsable(page, yes, 'the turn-on button');
  await expectUsable(page, card.getByRole('button', { name: 'לא, תודה', exact: true }), 'no thanks');
  for (const b of await card.getByRole('button').all()) expect((await b.boundingBox()).height, await b.textContent()).toBeGreaterThanOrEqual(44);
  // nothing about the plan, a price or a streak on a child's screen
  await expect(card).not.toContainText(/₪|שקל|מנוי|רצף|נשאר|תפספסו/);
  expect((await saved(page)).nudges.pushOffered).toBe(true);
  expect(calls(log, '/api/metrics').map((r) => r.body)).toContain('push_offer');
  await shot(page, 'card-390');
  await yes.click();
  await expect(page.getByText('התזכורת תגיע בכל יום ב־17:00')).toBeVisible();
  await expect(page.locator('.learn-top')).toBeVisible();
  const [sub] = calls(log, '/api/push/subscribe');
  expect(sub.body.endpoint).toBe('https://fcm.googleapis.com/fcm/send/e2e-1');
  expect(Number(sub.body.slot)).toBe(17);
  expect(sub.body.keys).toEqual({ p256dh: 'BKkDzOKmhm6v0d8Ty2pSZ6bF1Kq0rCq1YQ6b3xJ2O1z7', auth: 'c2ludGhldGljLWF1dGg' });
  expect(sub.body.replaces).toBeUndefined();
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem('e2e-made')))).toEqual([{ userVisibleOnly: true, keyBytes: 65 }]);
  expect((await saved(page)).reminder).toMatchObject({ on: true, slot: 17, id: 'aaaaaaaaaaaaaaa1', state: 'on' });
  // the service worker can read the id where it looks for it
  const kept = await page.evaluate(() => new Promise((ok) => {
    const req = indexedDB.open('madregot-push', 1);
    req.onsuccess = () => { const g = req.result.transaction('sub').objectStore('sub').get('current'); g.onsuccess = () => ok(g.result); };
  }));
  expect(kept).toEqual({ id: 'aaaaaaaaaaaaaaa1', secret: `${'b'.repeat(31)}1`, slot: 17, key: KEY, api: API });
  expect(calls(log, '/api/metrics').map((r) => r.body)).toContain('push_on');

  // a second lesson the same day tells the server once that today was learned; the card never comes again
  await page.goto('./#/lesson/signed/1');
  await playLesson(page);
  expect(await walkEndScreens(page)).toBe('map');
  await expect.poll(() => calls(log, '/api/push/seen').length).toBe(1);
  expect(calls(log, '/api/push/seen')[0].body).toEqual({ id: 'aaaaaaaaaaaaaaa1', secret: `${'b'.repeat(31)}1`, day: '2026-11-05', done: true });
});

test('Settings: on with its hour; a new hour subscribes again with replaces; "כבויה" turns it off on the server', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['notifications'], { origin: new URL(baseURL).origin });
  const log = await fakeServer(page);
  await playPush(page);
  await open(page, '#/settings', withServer({ days: TWO_DAYS }));
  await page.evaluate(() => navigator.serviceWorker.ready);
  const section = page.getByRole('region', { name: 'תזכורת יומית' });
  await section.scrollIntoViewIfNeeded();
  const onOff = section.getByRole('radiogroup', { name: 'תזכורת יומית' });
  await expect(onOff.getByRole('radio', { name: 'כבויה' })).toHaveAttribute('aria-checked', 'true');
  await expect(section).toContainText('הודעה אחת ביום לכל היותר. לא נשלחת בשבת ובחגים, בימי הזיכרון ובתשעה באב, לא אחרי 12:00 בערב שלהם, ולא ביום שכבר למדתם בו.');
  await shot(page, 'settings-off-390');
  await onOff.getByRole('radio', { name: 'פועלת' }).click();
  await expect(page.getByText('התזכורת תגיע בכל יום ב־17:00')).toBeVisible();
  await expect(onOff.getByRole('radio', { name: 'פועלת' })).toHaveAttribute('aria-checked', 'true');
  const hours = section.getByRole('radiogroup', { name: 'באיזו שעה?' });
  await expect(hours.getByRole('radio', { name: '17:00' })).toHaveAttribute('aria-checked', 'true');
  for (const r of await section.getByRole('radio').all()) expect((await r.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await shot(page, 'settings-on-390');
  // a new hour: the same browser subscription, sent again with replaces
  await hours.getByRole('radio', { name: '19:00' }).click();
  await expect(page.getByText('התזכורת תגיע בכל יום ב־19:00')).toBeVisible();
  await expect(hours.getByRole('radio', { name: '19:00' })).toHaveAttribute('aria-checked', 'true');
  const subs = calls(log, '/api/push/subscribe');
  expect(subs).toHaveLength(2);
  expect(subs[1].body).toMatchObject({ endpoint: subs[0].body.endpoint, slot: '19', replaces: { id: 'aaaaaaaaaaaaaaa1', secret: `${'b'.repeat(31)}1` } });
  // off: the server deletes the row, the browser drops the subscription
  await onOff.getByRole('radio', { name: 'כבויה' }).click();
  await expect(page.getByText('התזכורות כבויות')).toBeVisible();
  expect(calls(log, '/api/push/off')).toEqual([{ path: '/api/push/off', body: { id: 'aaaaaaaaaaaaaaa2', secret: `${'b'.repeat(31)}2` } }]);
  await expect(hours).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('e2e-unsub'))).toBe('1');
  expect((await saved(page)).reminder).toMatchObject({ on: false, id: null, secret: null, slot: 19 });
  expect(calls(log, '/api/metrics').map((r) => r.body)).toEqual(expect.arrayContaining(['push_on', 'push_off']));
});

test('a push delivered to the service worker shows "מדרגות" right to left, in Hebrew', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['notifications'], { origin: new URL(baseURL).origin });
  await open(page, '#/', student('7'));
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  const regs = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations.filter((r) => !r.isDeleted)));
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => regs.length).toBeGreaterThan(0);
  const message = { web_push: 8030, notification: { title: 'מדרגות', body: 'שיעור קצר אחד היום, וזה מספיק.', lang: 'he', dir: 'rtl', navigate: `${new URL(baseURL).origin}/#/?go=today&src=push`, tag: 'daily', silent: false } };
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(baseURL).origin, registrationId: regs[0].registrationId, data: JSON.stringify(message) });
  const shown = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications())
    .map((n) => ({ title: n.title, body: n.body, dir: n.dir, lang: n.lang, tag: n.tag, url: n.data?.url })));
  await expect.poll(shown).toEqual([{ title: 'מדרגות', body: 'שיעור קצר אחד היום, וזה מספיק.', dir: 'rtl', lang: 'he', tag: 'daily', url: message.notification.navigate }]);
});

test('no reminder where there is none: a server with the switch off, and no server at all', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['notifications'], { origin: new URL(baseURL).origin });
  await fakeServer(page, { keyStatus: 404 });
  await open(page, '#/settings', withServer());
  const section = page.getByRole('region', { name: 'תזכורת יומית' });
  await expect(section).toContainText('בגרסה הזו אין תזכורות.');
  await expect(section.getByRole('radio')).toHaveCount(0);
  await open(page, '#/settings', student('7'));
  await expect(page.getByRole('region', { name: 'תזכורת יומית' })).toContainText('בגרסה הזו אין תזכורות.');
});

test.describe('iPhone Safari in a tab', () => {
  test.use({ userAgent: IPHONE });
  test('Settings says the Home Screen sentence, and no card comes after a lesson', async ({ page }) => {
    const log = await fakeServer(page);
    await playPush(page);
    await open(page, '#/settings', withServer({ days: TWO_DAYS }));
    const section = page.getByRole('region', { name: 'תזכורת יומית' });
    await expect(section).toContainText('באייפון התזכורות עובדות אחרי שמוסיפים את מדרגות למסך הבית.');
    await expect(section.getByRole('radio')).toHaveCount(0);
    await expect(section.getByRole('button')).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await shot(page, 'settings-iphone-390');
    await page.goto('./#/lesson/signed/1');
    await playLesson(page);
    expect(await walkEndScreens(page)).toBe('map');
    expect(calls(log, '/api/push/key')).toEqual([]);
  });
});
