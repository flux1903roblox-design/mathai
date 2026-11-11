// The safe write path in a real browser (DURABLE-1): a full localStorage never breaks the app, the copy on the device
// (IndexedDB) keeps the change across a reload, a calm banner appears only when nothing could save it, and a broken save
// comes back from the copy with one calm toast, its bytes kept in quarantine. Each test seeds once with open() and then
// reloads on its own, so the copy survives the reload.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { open, student, livedIn, saved, appReady, answer, proceedToNext, leaveEndScreens, NOW, DURABLE_DB } from './helpers.js';

/**
 * Fill localStorage until it takes no more (the council's probe: 100 KB pieces, then 1 KB), then down to single
 * characters so not even one more byte fits, and free about `leaveBytes` again. Returns the KB written.
 */
async function fillStorage(page, leaveBytes = 0) {
  return page.evaluate((leave) => {
    const fill = (prefix, size, max) => { let i = 0; const v = 'x'.repeat(size); try { for (; i < max; i += 1) localStorage.setItem(`${prefix}${i}`, v); } catch { /* full */ } return i; };
    const big = fill('__fill', 100_000, 200);
    const kb = fill('__f', 1000, 2000);
    fill('__g', 100, 100); fill('__h', 10, 100); fill('__i', 1, 100);
    for (let k = kb - 1, freed = 0; k >= 0 && freed < leave; k -= 1, freed += 1000) localStorage.removeItem(`__f${k}`);
    return big * 100 + kb;
  }, leaveBytes);
}

/** Every record of one IndexedDB store of the app (the database must exist: the app made it). */
const readDb = (page, store) => page.evaluate(([name, s]) => new Promise((resolve) => {
  const r = indexedDB.open(name);
  r.onerror = () => resolve(null);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains(s)) { db.close(); resolve(null); return; }
    const g = db.transaction(s, 'readonly').objectStore(s).getAll();
    g.onsuccess = () => { db.close(); resolve(g.result); };
    g.onerror = () => { db.close(); resolve(null); };
  };
}), [DURABLE_DB, store]);

/** Screenshots for the evidence folder (DURABLE_SHOTS=<folder>); nothing is compared. */
async function shot(page, name) {
  const dir = process.env.DURABLE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700); // a screen's entrance fade ends
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png` });
}

const radio = (page, name) => page.getByRole('radio', { name, exact: true });
const FULL = 'הדפדפן מלא, ולכן ההתקדמות החדשה לא נשמרת כרגע.';

test.describe('storage full', () => {
  test('the copy on the device works: the change survives a reload, and nothing alarms the child', async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await open(page, '#/settings', student('7', { sound: true }));
    await expect(radio(page, 'פועלים')).toHaveAttribute('aria-checked', 'true');
    expect((await saved(page)).sound).toBe(true);
    // the saved envelope: zustand's { state, version } and the write's meta (its build is the commit, or 'dev')
    const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).meta);
    expect(meta).toMatchObject({ rev: 1, parent: { rev: 0 } });
    expect(meta.app).toMatch(/^([0-9a-f]{7,}|dev)$/);
    expect(await page.evaluate(() => localStorage.getItem('madregot:rev'))).toMatch(/^1 [0-9a-f]{8}$/); // the revision and the tab
    expect(await fillStorage(page)).toBeGreaterThan(1000);
    await radio(page, 'כבויים').click();
    await expect(radio(page, 'כבויים')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#save .save-row').filter({ hasText: 'במכשיר הזה' })).toContainText('נשמר');
    expect((await saved(page)).sound).toBe(true); // localStorage could not take it
    await expect.poll(async () => JSON.parse((await readDb(page, 'mirror'))?.[0]?.raw || 'null')?.state?.sound).toBe(false);
    await page.reload();
    await expect(radio(page, 'כבויים')).toHaveAttribute('aria-checked', 'true'); // from the copy
    await expect(page.locator('#save .save-row').filter({ hasText: 'במכשיר הזה' })).toHaveText(/במכשיר הזה\s*נשמר/);
    await page.locator('#save').scrollIntoViewIfNeeded();
    await shot(page, 'durable-settings-saved');
    await page.evaluate(() => { location.hash = '#/'; });
    await expect(page.locator('.learn')).toBeVisible();
    await expect(page.getByText(FULL)).toHaveCount(0);
    await expect(page.locator('.storage-banner')).toHaveCount(0);
    await expect(page.getByText('החזרנו את ההתקדמות')).toHaveCount(0); // a copy newer only because storage is full: no toast
    expect(errors).toEqual([]);
  });

  test('the copy cannot be written either: a calm banner says so, and its link leads to the saving section', async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => { IDBFactory.prototype.open = function open() { throw new DOMException('IndexedDB is off in this test', 'UnknownError'); }; });
    await open(page, '#/', student('7', { sound: true }));
    await expect(page.locator('.learn')).toBeVisible();
    await expect(page.locator('.storage-banner')).toHaveCount(0);
    await fillStorage(page);
    await page.evaluate(() => { location.hash = '#/settings'; });
    await radio(page, 'כבויים').click();
    await expect(page.locator('#save .save-row').filter({ hasText: 'במכשיר הזה' })).toContainText('לא נשמר: הדפדפן מלא');
    await page.evaluate(() => { location.hash = '#/'; });
    const banner = page.getByRole('status').filter({ hasText: FULL });
    await expect(banner).toBeVisible();
    const box = await banner.boundingBox();
    expect(box.y).toBeLessThan(200); // at the top of the screen
    await shot(page, 'durable-full');
    const link = banner.getByRole('link', { name: 'מה עושים' });
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL(/#\/settings#save/);
    await expect(page.locator('#save-title')).toBeFocused();
    await expect(page.locator('#save-title')).toBeInViewport();
    expect(errors).toEqual([]);
  });
});

test('a broken save comes back from the copy on the device, with one calm toast, and its bytes are kept', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await open(page, '#/', livedIn('7'));
  await expect(page.locator('.top-stat.xp')).toHaveAttribute('aria-label', /סך הכול 260/);
  // the copy follows the save a second later
  await expect.poll(async () => JSON.parse((await readDb(page, 'mirror'))?.[0]?.raw || 'null')?.state?.xp, { timeout: 5000 }).toBe(260);
  await page.evaluate(() => localStorage.setItem('madregot', '{"state":'));
  await page.reload();
  await expect(page.locator('.top-stat.xp')).toHaveAttribute('aria-label', /סך הכול 260/);
  await expect(page.getByText('החזרנו את ההתקדמות מהעותק שנשמר במכשיר.')).toBeVisible();
  await expect(page.locator('.node-current').first()).toBeVisible();
  await shot(page, 'durable-recovered');
  expect((await saved(page)).xp).toBe(260); // written back
  const kept = await readDb(page, 'quarantine');
  expect(kept).toEqual([expect.objectContaining({ raw: '{"state":', reason: 'parse' })]);
  expect(errors).toEqual([]);
});

test('"delete all" deletes the copy on the device too: a reload does not bring the progress back', async ({ page }) => {
  await open(page, '#/settings', livedIn('7'));
  await expect.poll(async () => (await readDb(page, 'mirror'))?.length || 0, { timeout: 5000 }).toBe(1);
  await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
  // the app reloads itself after deleting: the test's own reload waits for that one, or the two collide (ERR_ABORTED)
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'כן, למחוק הכול' }).click();
  await reloaded;
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('madregot'))).toBeNull();
  expect(await readDb(page, 'mirror')).toEqual([]); // the new page made a new, empty database
});

// ------------------------------------------------------------------ two tabs (DURABLE-2)

/**
 * A second tab of the same browser, opened on `route` after the first one was seeded. `deaf`: it never hears the other
 * tab's saves (its `storage` events are stopped before the app sees them), the race the write path must handle alone.
 */
async function secondTab(page, route, { deaf = false } = {}) {
  const b = await page.context().newPage();
  await b.clock.setFixedTime(NOW);
  if (deaf) await b.addInitScript(() => { window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true); });
  await b.goto(`./${route}`);
  await appReady(b);
  return b;
}

/** Answer every exercise of the open lesson right, up to its first end screen. */
async function playLesson(page) {
  await expect.poll(() => page.evaluate(() => !!window.__madregotItem)).toBe(true);
  for (let n = 0; n < 20 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen')).toBeVisible();
}

for (const deaf of [false, true]) {
  test(`two tabs: the sound turned off in one stays off when a tab opened earlier changes another setting${deaf ? ' before it hears of it' : ''}`, async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await open(page, '#/settings', student('7', { sound: true }));
    const b = await secondTab(page, '#/settings', { deaf });
    b.on('pageerror', (e) => errors.push(e.message));
    await expect(radio(b, 'פועלים')).toHaveAttribute('aria-checked', 'true');
    // the council's probe, reversed: A turns the sound off, then stale B saves a change of its own
    await radio(page, 'כבויים').click();
    await expect.poll(async () => (await saved(page)).sound).toBe(false);
    if (!deaf) await expect(radio(b, 'כבויים')).toHaveAttribute('aria-checked', 'true'); // B loaded A's save
    // (the solve mode has no control on this build: the grade is B's setting)
    await radio(b, 'כיתה ח׳').click();
    await expect.poll(async () => (await saved(page)).profile.grade).toBe('8');
    expect((await saved(page)).sound).toBe(false);
    await expect(radio(b, 'כבויים')).toHaveAttribute('aria-checked', 'true'); // and B shows it
    const events = (await saved(page)).learn.events.filter((e) => e.e === 'merge');
    expect(events).toEqual(deaf ? [expect.objectContaining({ e: 'merge', m: 'tab' })] : []);
    expect(errors).toEqual([]);
  });
}

test('two tabs: a lesson finished in each, the second in a tab that never heard of the first, counts both', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await open(page, '#/lesson/signed/1', student('7'));
  const b = await secondTab(page, '#/', { deaf: true });
  b.on('pageerror', (e) => errors.push(e.message));
  await expect(b.locator('.learn')).toBeVisible(); // B sits on the map
  await playLesson(page);
  await leaveEndScreens(page);
  const afterA = await saved(page);
  expect(afterA.days['2026-11-05'].lessons).toBe(1);
  expect(afterA.xp).toBeGreaterThan(0);
  await b.evaluate(() => { location.hash = '#/lesson/signed/1'; });
  await playLesson(b);
  await leaveEndScreens(b);
  await expect.poll(async () => (await saved(page)).days['2026-11-05'].lessons).toBe(2);
  const st = await saved(page);
  // every XP of this student was earned by these two lessons (answers earn none), so the total is the sum of the
  // two lessons' XP exactly when it equals today's XP, and today's XP grew by B's lesson
  expect(st.days['2026-11-05'].xp).toBeGreaterThan(afterA.days['2026-11-05'].xp);
  expect(st.xp).toBe(st.days['2026-11-05'].xp);
  expect(afterA.xp).toBe(afterA.days['2026-11-05'].xp);
  expect(st.path.signed.parts['1']).toBe(2);
  expect(st.learn.events.filter((e) => e.e === 'merge')).toHaveLength(1); // B merged once, at its first save
  expect(errors).toEqual([]);
});
