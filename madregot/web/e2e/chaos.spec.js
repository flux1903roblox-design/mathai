// The chaos suite (DURABLE-15): the browser throws away everything the site kept, as Safari's 7-day cap on
// script-written storage (ITP) or "clear website data" does, and the student gets it all back.
//   - a student with a class, a backup code and 3 days of progress (two saved days and a lesson today, in the app);
//   - eviction: cookies, localStorage, sessionStorage, the copy on the device (the IndexedDB database
//     'madregot-durable') and the service worker's caches, all cleared while the app is closed;
//   - the app opens on the first screen (Welcome), with nothing of the student left;
//   - (a) "יש לי קוד גיבוי" with the code brings everything back;
//   - (b) separately, joining the class again with the class code, the name and the PIN brings everything back.
// Against the fake server (fakeServer.js): its in-memory vault, its class K7Q2MD and the code the class keeps.
// The test build has no server compiled in (VITE_API_URL=none, the public website's build); a production build carries
// its server's address in its code, so clearing the site's data cannot take it. After the eviction the test puts back
// that address only (a save with no profile and no progress, as `fresh()` in restore.spec.js), which stands for it.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { student, open, item, answer, proceedToNext, leaveEndScreens, saved, appReady, NOW, DURABLE_DB } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';
import { derive, open as openSealed } from '../src/lib/durable/crypto.js';

const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const TODAY = '2026-11-05';
const PIN = '4821';

/** Two days of progress before today, saved as a v3 save so the server address is kept (as restore.spec.js does). */
const lived = () => ({
  ...student('7', {
    ai: { mode: 'server', apiUrl: API, key: '', device: '' },
    days: { '2026-11-03': { lessons: 2, xp: 30, q: 16, ok: 14, secs: 420 }, '2026-11-04': { lessons: 1, xp: 15, q: 8, ok: 7, secs: 260 } },
    xp: 45, lastTopic: 'coord', freezes: 1,
    progress: { signed: { level: 2, max: 2 }, coord: { level: 3, max: 3 } },
    path: { signed: { parts: { 1: 2 }, reviews: 0, jumped: 0 }, coord: { parts: { 1: 2, 2: 2, 3: 1 }, reviews: 0, jumped: 0 } },
    gaps: { 'coord:swap': { level: 2, n: 2, ok: 1, at: '2026-11-04T10:00:00Z' } },
    mistakes: { 'coord:swap': 2 },
  }),
  version: 3,
});
/** What a production build still knows after the eviction: its server. No profile, no progress. */
const serverOnly = () => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, profile: null }), version: 3 });

/** The student's progress: everything a restore must bring back (not this device's own settings or class token). */
const progressOf = (st) => ({
  name: st.profile?.name, grade: st.profile?.grade, xp: st.xp, xpBy: st.xpBy, days: st.days, path: st.path,
  progress: st.progress, gaps: st.gaps, mistakes: st.mistakes, lastTopic: st.lastTopic, freezes: st.freezes,
  skills: st.learn?.skills, miscon: st.learn?.miscon,
});

/** Screenshots for the evidence folder (DURABLE_SHOTS=<folder>); nothing is compared. */
async function shot(page, name) {
  const dir = process.env.DURABLE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png` });
}

/** One practice lesson of the first stair with right answers, then back to the map (all inside the app). */
async function lesson(page) {
  await page.evaluate(() => { window.location.hash = '#/lesson/signed/1'; });
  await expect.poll(() => item(page)).toBeTruthy();
  for (let n = 0; n < 20 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen')).toBeVisible();
  await leaveEndScreens(page);
  await expect(page.locator('.learn')).toBeVisible();
}
const hide = (page) => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
async function vaultOf(st, code) {
  const { key, lookup } = await derive(code);
  return st.vaults[lookup] ? (await openSealed(st.vaults[lookup].blob, key)).state : null;
}

/**
 * The student before the eviction: two saved days, then the class joined from Settings (the class keeps the backup
 * code it makes), a lesson today, and the page out of view (the vault has the lesson). The code is read the way a
 * student reads it: Settings › "להציג את קוד הגיבוי". Resolves { code, before }.
 */
async function classStudentWithCode(page, st) {
  await open(page, '#/settings', lived());
  await page.getByLabel('קוד כיתה').fill('K7Q2MD');
  await page.getByLabel('קוד אישי של 4 ספרות').fill(PIN);
  await page.getByRole('button', { name: 'הצטרפות', exact: true }).click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'הצטרפתם לכיתה ז׳3' })).toBeVisible();
  await expect.poll(() => st.escrows.length, { timeout: 20_000 }).toBe(1);
  await expect.poll(async () => (await saved(page)).backup?.escrow).toBe('class');

  await lesson(page);
  await hide(page);
  const code = (await saved(page)).backup.code;
  await expect.poll(async () => (await vaultOf(st, code))?.days[TODAY]?.lessons, { timeout: 20_000 }).toBe(1);

  // the code as the student sees it
  await page.evaluate(() => { window.location.hash = '#/settings'; });
  await page.getByRole('button', { name: 'להציג את קוד הגיבוי' }).click();
  const sheet = page.getByRole('dialog', { name: 'קוד הגיבוי שלכם' });
  const shown = (await sheet.locator('.backup-code').textContent()).trim();
  expect(shown.replace(/-/g, '')).toBe(code);
  await sheet.getByRole('button', { name: 'שמרתי', exact: true }).click();

  const before = await saved(page);
  expect(Object.keys(before.days).sort()).toEqual(['2026-11-03', '2026-11-04', TODAY]);
  expect(before.days[TODAY].lessons).toBe(1);
  expect(before.profile).toMatchObject({ name: 'נועה', classCode: 'K7Q2MD', token: 'stu_s1_1' });
  expect(before.xp).toBeGreaterThan(45);
  // the vault holds the same progress
  expect(progressOf({ ...(await vaultOf(st, code)), profile: before.profile })).toEqual(progressOf(before));
  return { code: shown, before };
}

/**
 * The browser throws away the site's data while the app is closed: a page of the same address with no app on it
 * clears cookies, localStorage, sessionStorage, the IndexedDB copy and the caches. Then the server address comes back
 * (see the top of the file) and the app opens again. Resolves what was left before the address came back.
 */
async function evict(page) {
  await page.route('**/__evicted', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><title>-</title>' }));
  await page.goto('./__evicted');
  await page.context().clearCookies();
  const left = await page.evaluate(async (db) => {
    localStorage.clear(); sessionStorage.clear();
    await new Promise((done) => { const r = indexedDB.deleteDatabase(db); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
    if (self.caches) for (const k of await caches.keys()) await caches.delete(k);
    return {
      local: localStorage.length, session: sessionStorage.length, cookies: document.cookie,
      dbs: (await indexedDB.databases()).map((d) => d.name), caches: self.caches ? (await caches.keys()).length : 0,
    };
  }, DURABLE_DB);
  await page.evaluate((s) => localStorage.setItem('madregot', JSON.stringify(s)), serverOnly());
  await page.goto('./#/');
  await appReady(page);
  return left;
}

test.describe('chaos: the browser clears the site\'s data', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('(a) the backup code brings everything back', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const { st } = await fakeServer(page.context(), {}, baseOf());
    const { code, before } = await classStudentWithCode(page, st);

    const left = await evict(page);
    expect(left).toEqual({ local: 0, session: 0, cookies: '', dbs: [], caches: 0 });
    // the first screen, and nothing of the student is left here
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
    const empty = await saved(page);
    expect(empty.profile).toBeNull();
    expect(empty.xp).toBe(0);
    expect(empty.days).toEqual({});
    await shot(page, 'chaos-welcome-after-eviction');

    await page.getByRole('button', { name: 'יש לי קוד גיבוי' }).click();
    await page.getByLabel('קוד הגיבוי').fill(code);
    await page.getByRole('button', { name: 'לחפש את הגיבוי' }).click();
    await expect(page.getByRole('heading', { name: 'מצאנו גיבוי', level: 1 })).toBeFocused();
    await expect(page.locator('.restore-summary')).toContainText(`${before.xp} XP`);
    await expect(page.locator('.restore-summary')).toContainText('נועה');
    await page.getByRole('button', { name: 'להמשיך מכאן' }).click();
    await expect(page.getByRole('heading', { name: 'ההתקדמות חזרה', level: 1 })).toBeFocused();
    await page.getByRole('button', { name: 'להמשיך', exact: true }).click();
    await expect(page.locator('.learn')).toBeVisible();
    await shot(page, 'chaos-restored-by-code');

    const back = await saved(page);
    expect(progressOf(back)).toEqual(progressOf(before));
    // the class code comes back; the class token never travels in a backup, so the class asks for the PIN once
    expect(back.profile).toMatchObject({ name: 'נועה', classCode: 'K7Q2MD' });
    expect(back.profile.token).toBeUndefined();
    await expect.poll(async () => (await saved(page)).backup.state).toBe('idle');
    expect(back.backup).toMatchObject({ on: true, code: code.replace(/-/g, '') });
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await expect(page.getByRole('heading', { name: 'התחברות מחדש לכיתה' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('(b) joining the class again with the PIN brings everything back', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const { st } = await fakeServer(page.context(), {}, baseOf());
    const { before } = await classStudentWithCode(page, st);

    await evict(page);
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
    expect((await saved(page)).profile).toBeNull();

    // the first questions, as on any new start, then the class code, the same name and the PIN
    await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
    await page.locator('#w-name').fill('נועה');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /כיתה ז׳/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /קצת מוכר/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await expect(page.getByText('יש לכם קוד כיתה מהמורה?')).toBeVisible();
    await page.getByLabel('קוד כיתה').fill('K7Q2MD');
    await page.getByLabel('קוד אישי של 4 ספרות').fill(PIN);
    await page.getByRole('button', { name: 'הצטרפות לכיתה' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'ברוכים השבים לכיתה ז׳3. ההתקדמות שלכם חזרה.' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.learn')).toBeVisible();
    await shot(page, 'chaos-restored-by-class');

    const back = await saved(page);
    expect(progressOf(back)).toEqual(progressOf(before));
    expect(back.profile).toMatchObject({ role: 'student', name: 'נועה', classCode: 'K7Q2MD', studentId: 's1', token: 'stu_s1_2' });
    expect(back.backup).toMatchObject({ on: true, code: before.backup.code, escrow: 'class' });
    expect(errors).toEqual([]);
  });
});
