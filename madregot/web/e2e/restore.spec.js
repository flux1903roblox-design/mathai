// The backup code (DURABLE-5) in a real browser, against the fake server's in-memory vault (fakeServer.js keeps sealed
// copies by X-Vault, with the Worker's revisions). This file grows with the restore screens (Stage 12): here, a student
// with a server makes a code from Settings, sees it once in its sheet (the code, its QR code, the three ways to keep
// it), finishes a lesson, and the lesson's push reaches the vault: opened here with the code, it holds that lesson.
// Then the code is shown again and the backup is stopped, which deletes the copy. No request ever carries the code.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { student, open, item, answer, proceedToNext, leaveEndScreens, saved } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';
import { derive, open as openSealed } from '../src/lib/durable/crypto.js';

const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const TODAY = '2026-11-05';
/** A student with some days, saved as a v3 save so the server address is kept (as class-sync.spec.js does). */
const withServer = () => ({
  ...student('7', {
    ai: { mode: 'server', apiUrl: API, key: '', device: '' },
    days: { '2026-11-04': { lessons: 2, xp: 25, q: 16, ok: 12 }, [TODAY]: { lessons: 1, xp: 12, q: 8, ok: 7 } }, xp: 37,
  }),
  version: 3,
});
const vaultPosts = (log) => log.filter((r) => r.path === '/api/vault' && r.method === 'POST');

/** Screenshots for the evidence folder (DURABLE_SHOTS=<folder>); nothing is compared. */
async function shot(page, name) {
  const dir = process.env.DURABLE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700); // a sheet's entrance ends
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

test.describe('the backup code', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('make a code in Settings, keep it, finish a lesson: the lesson\'s push reaches the vault; then stop the backup', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/settings', withServer());
    const row = page.locator('.save-backup .save-row');
    await expect(row.locator('dt')).toHaveText('גיבוי');
    await expect(row.locator('dd')).toHaveText('כבוי');
    await expect(page.getByText('קוד גיבוי שומר עותק מוצפן. בלי הקוד אף אחד לא יכול לקרוא אותו, גם לא אנחנו.')).toBeVisible();
    const make = page.getByRole('button', { name: 'ליצור קוד גיבוי' });
    expect((await make.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.locator('.save-backup').scrollIntoViewIfNeeded();
    await shot(page, 'save-section-backup-off');
    await make.click();

    // the sheet: the code, left to right and on one line, its QR code, and the three ways to keep it
    const sheet = page.getByRole('dialog', { name: 'קוד הגיבוי שלכם' });
    await expect(sheet).toBeVisible();
    const shown = (await sheet.locator('.backup-code').textContent()).trim();
    expect(shown).toMatch(/^[A-HJ-KMNP-Z2-9]{4}(-[A-HJ-KMNP-Z2-9]{4}){3}$/);
    const code = shown.replace(/-/g, '');
    await expect(sheet.locator('.backup-code')).toHaveAttribute('dir', 'ltr');
    expect(await sheet.locator('.backup-code').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(sheet.getByRole('img', { name: 'קוד QR של קוד הגיבוי' })).toBeVisible();
    await expect(sheet.getByText('עם הקוד הזה אפשר להחזיר את ההתקדמות בכל מכשיר: פותחים את מדרגות ובוחרים "יש לי קוד גיבוי".')).toBeVisible();
    await expect(sheet.getByText('מי שיש לו את הקוד יכול לראות את ההתקדמות שלכם, אז תנו אותו רק למי שאתם סומכים עליו.')).toBeVisible();
    for (const name of ['לשלוח להורים', 'להעתיק', 'שמרתי']) {
      expect((await sheet.getByRole('button', { name, exact: true }).boundingBox()).height, name).toBeGreaterThanOrEqual(44);
    }
    await shot(page, 'backup-code');

    // the server got the first sealed copy, created with ifRev null, under the lookup token the code derives
    const { key, lookup } = await derive(code);
    expect(vaultPosts(log)).toHaveLength(1);
    expect(vaultPosts(log)[0].body.ifRev).toBeNull();
    expect(vaultPosts(log)[0].headers['x-vault']).toBe(lookup);
    expect(Object.keys(st.vaults)).toEqual([lookup]);
    const first = await openSealed(st.vaults[lookup].blob, key);
    expect(first).toMatchObject({ v: 1, schema: 5 });
    expect(first.state.days[TODAY].lessons).toBe(1);

    await sheet.getByRole('button', { name: 'להעתיק', exact: true }).click();
    await expect(page.getByText('הקוד הועתק.')).toBeVisible();
    await sheet.getByRole('button', { name: 'שמרתי', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(row.locator('dd')).toHaveText('פועל · עודכן עכשיו');
    await expect(page.locator('.footnote')).toHaveText('מדרגות. ההתקדמות נשמרת במכשיר, ועותק מוצפן שרק הקוד שלכם פותח נשמר בגיבוי.');
    await page.locator('.save-backup').scrollIntoViewIfNeeded();
    await shot(page, 'save-section-backup');
    const b = (await saved(page)).backup;
    expect(b).toMatchObject({ on: true, code, lookup, rev: 1, state: 'idle' });

    // a lesson: 30 s after it ends, the lesson moment pushes the new copy over the rev the device has (compare-and-swap)
    await lesson(page);
    const lessonsHeld = async () => (await openSealed(st.vaults[lookup].blob, key)).state.days[TODAY].lessons;
    await expect.poll(lessonsHeld, { timeout: 45_000 }).toBe(2);
    const last = vaultPosts(log).at(-1);
    expect(last.body.ifRev).toBe(st.vaults[lookup].rev - 1);
    const pushed = await openSealed(st.vaults[lookup].blob, key);
    expect(pushed.state.xp).toBe((await saved(page)).xp);
    expect((await saved(page)).backup.rev).toBe(st.vaults[lookup].rev);
    for (const k of ['ai', 'outbox', 'durable', 'backup']) expect(pushed.state[k]).toBeUndefined();

    // the code again, then stop: confirmed, the copy on the server is deleted, the row says off
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await page.getByRole('button', { name: 'להציג את קוד הגיבוי' }).click();
    await expect(page.getByRole('dialog', { name: 'קוד הגיבוי שלכם' }).locator('.backup-code')).toHaveText(shown);
    await page.getByRole('button', { name: 'שמרתי', exact: true }).click();
    await page.getByRole('button', { name: 'להפסיק את הגיבוי' }).click();
    const ask = page.getByRole('dialog', { name: 'להפסיק את הגיבוי?' });
    await expect(ask.getByText('העותק המוצפן בשרת יימחק, וקוד הגיבוי יפסיק לעבוד. ההתקדמות במכשיר הזה נשארת.')).toBeVisible();
    await ask.getByRole('button', { name: 'כן, להפסיק' }).click();
    await expect(page.getByText('הגיבוי הופסק, והעותק בשרת נמחק.')).toBeVisible();
    await expect(row.locator('dd')).toHaveText('כבוי');
    expect(st.vaults).toEqual({});
    expect(log.filter((r) => r.path === '/api/vault/delete')).toHaveLength(1);
    expect((await saved(page)).backup.on).toBe(false);
    expect((await saved(page)).days[TODAY].lessons).toBe(2); // the progress here stays

    // the code itself never left the device: no header or body carried it
    for (const r of log) expect(JSON.stringify([r.headers, r.body]), r.path).not.toContain(code);
    expect(errors).toEqual([]);
  });

  test('no server: no backup code is offered (the file is the way)', async ({ page }) => {
    await open(page, '#/settings', student('7'));
    await expect(page.locator('.save-section')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ליצור קוד גיבוי' })).toHaveCount(0);
    await expect(page.locator('.save-backup')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'לשמור קובץ גיבוי' })).toBeVisible();
  });

  test('a server that cannot take a backup today: the backup stays off and the student hears why, calmly', async ({ page }) => {
    const { st } = await fakeServer(page.context(), {}, baseOf());
    await page.route(`${API}/api/vault`, (route) => (route.request().method() === 'POST'
      ? route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'too_many_vaults' }) })
      : route.fallback()));
    await open(page, '#/settings', withServer());
    await page.getByRole('button', { name: 'ליצור קוד גיבוי' }).click();
    await expect(page.locator('.save-backup [role="status"]')).toHaveText('נוצרו היום הרבה גיבויים מהרשת הזו. נסו שוב מחר, או שמרו קובץ.');
    await expect(page.getByRole('dialog', { name: 'קוד הגיבוי שלכם' })).toHaveCount(0);
    await expect(page.locator('.save-backup .save-row dd')).toHaveText('כבוי');
    expect(st.vaults).toEqual({});
  });
});
