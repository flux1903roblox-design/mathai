// The backup code (DURABLE-5) in a real browser, against the fake server's in-memory vault (fakeServer.js keeps sealed
// copies by X-Vault, with the Worker's revisions):
//   - a student with a server makes a code from Settings, sees it once in its sheet (the code, its QR code, the three
//     ways to keep it), finishes a lesson, and the lesson's push reaches the vault: opened here with the code, it holds
//     that lesson. Then the code is shown again and the backup is stopped, which deletes the copy. No request ever
//     carries the code;
//   - (1) the lost phone: a fresh browser takes the code on Welcome › "יש לי קוד גיבוי" and gets everything back, then
//     (2) two devices on one code: a lesson on the new one reaches the old one when it comes back into view;
//   - (3) a typing mistake is said on the device, with no network call; the Home Screen app's first open;
//   - (4) "delete all" deletes the vault first, and when the server cannot, nothing at all;
//   - (5) a sibling's code on a device with another student's progress: nothing is merged, Settings says so;
//   - the backup question, once in a while, never in a lesson.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { student, open, item, answer, proceedToNext, leaveEndScreens, saved, appReady, NOW } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';
import { derive, open as openSealed } from '../src/lib/durable/crypto.js';
import { makeCode as newCode, formatCode, CODE_ALPHABET } from '../src/lib/durable/code.js';

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

// ---------------------------------------------------------------- restoring (Stage 12)
/** A device with the app pointed at the fake server and nothing saved yet: the first screen. */
const fresh = () => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, profile: null }), version: 3 });
/** What a restore must bring back: the progress, not this device's own settings. */
const progressOf = (st) => ({ profile: st.profile, xp: st.xp, xpBy: st.xpBy, days: st.days, path: st.path, progress: st.progress, gaps: st.gaps, skills: st.learn?.skills });

/** Settings › "ליצור קוד גיבוי" on `page`: the code as shown (with dashes), its sheet closed. */
async function makeCode(page) {
  await page.evaluate(() => { window.location.hash = '#/settings'; });
  await page.getByRole('button', { name: 'ליצור קוד גיבוי' }).click();
  const sheet = page.getByRole('dialog', { name: 'קוד הגיבוי שלכם' });
  const shown = (await sheet.locator('.backup-code').textContent()).trim();
  await sheet.getByRole('button', { name: 'שמרתי', exact: true }).click();
  await expect(sheet).toBeHidden();
  return shown;
}
/** The page goes out of view (the hidden moment pushes at once), or comes back at `at` (the clock moves with it). */
const hide = (page) => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
async function show(page, at) {
  await page.clock.setFixedTime(at);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
/** What the vault holds for a code, opened. */
async function vaultOf(st, shown) {
  const { key, lookup } = await derive(shown.replace(/-/g, ''));
  return st.vaults[lookup] ? (await openSealed(st.vaults[lookup].blob, key)).state : null;
}
const vaultCalls = (log) => log.filter((r) => r.path.startsWith('/api/vault'));

test.describe('restoring from the backup code', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('(1) the lost phone: a fresh browser types the code and gets everything back; (2) then a lesson on it reaches the first device', async ({ page, browser }) => {
    test.setTimeout(180_000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const { st, log, attach } = await fakeServer(page.context(), {}, baseOf());
    // device A: a code from Settings, then a lesson; going out of view sends it at once
    await open(page, '#/settings', withServer());
    const shown = await makeCode(page);
    await lesson(page);
    await hide(page);
    await expect.poll(async () => (await vaultOf(st, shown))?.days[TODAY].lessons, { timeout: 20_000 }).toBe(2);
    await show(page, new Date(NOW.getTime() + 5_000));
    const a = await saved(page);

    // device B: a fresh browser, nothing saved
    const ctx = await browser.newContext(test.info().project.use);
    await attach(ctx);
    const b = await ctx.newPage();
    b.on('pageerror', (e) => errors.push(e.message));
    await open(b, '#/', fresh());
    const way = b.getByRole('button', { name: 'יש לי קוד גיבוי' });
    expect((await way.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await way.click();
    await expect(b.getByRole('heading', { name: 'יש לי קוד גיבוי', level: 1 })).toBeVisible();
    const input = b.getByLabel('קוד הגיבוי');
    await expect(input).toHaveAttribute('dir', 'ltr');
    await expect(input).toHaveAttribute('autocomplete', 'off');
    await expect(input).toHaveAccessibleDescription('16 אותיות באנגלית ומספרים. אפשר להדביק את כל הקוד, עם מקפים או בלי. גם במקלדת בעברית זה עובד.');
    await input.pressSequentially(shown); // typed, dashes and all
    const look = b.getByRole('button', { name: 'לחפש את הגיבוי' });
    expect((await look.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(b, 'restore-code');
    await look.click();
    await expect(b.getByRole('heading', { name: 'מצאנו גיבוי', level: 1 })).toBeFocused();
    await expect(b.locator('.restore-summary')).toContainText(`${a.xp} XP`);
    await expect(b.locator('.restore-summary')).toContainText('נועה');
    await shot(b, 'restore-preview');
    await b.getByRole('button', { name: 'להמשיך מכאן' }).click();
    await expect(b.getByRole('heading', { name: 'ההתקדמות חזרה', level: 1 })).toBeFocused();
    await expect(b.getByText('מעכשיו ההתקדמות במכשיר הזה נשמרת באותו קוד גיבוי.')).toBeVisible();
    await shot(b, 'restore-done');
    const back = await saved(b);
    expect(progressOf(back)).toEqual(progressOf(a));
    // B keeps the code and is in step with the vault (the restore's own line was sent at once)
    const code = shown.replace(/-/g, '');
    await expect.poll(async () => (await saved(b)).backup.rev).toBe(st.vaults[(await derive(code)).lookup].rev);
    expect((await saved(b)).backup).toMatchObject({ on: true, code, state: 'idle' });
    await b.getByRole('button', { name: 'להמשיך', exact: true }).click();
    await expect(b.locator('.learn')).toBeVisible();

    // (2) B finishes a lesson and goes out of view; A comes back after more than a minute: it has B's lesson
    await lesson(b);
    await hide(b);
    await expect.poll(async () => (await vaultOf(st, shown))?.days[TODAY].lessons, { timeout: 20_000 }).toBe(3);
    const bLessons = (await saved(b)).days[TODAY].lessons;
    expect(bLessons).toBe(3);
    await hide(page);
    await show(page, new Date(NOW.getTime() + 5_000 + 2 * 60_000));
    await expect.poll(async () => (await saved(page)).days[TODAY].lessons, { timeout: 15_000 }).toBe(bLessons);
    expect((await saved(page)).xp).toBe((await saved(b)).xp);
    // the code itself never left either device
    for (const r of log) expect(JSON.stringify([r.headers, r.body]), r.path).not.toContain(code);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('(3) a typing mistake or a symbol that is not in a code is said here, with no network call', async ({ page }) => {
    const { log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/restore', fresh());
    const input = page.getByLabel('קוד הגיבוי');
    const code = newCode();
    const typo = code.slice(0, 15) + CODE_ALPHABET[(CODE_ALPHABET.indexOf(code[15]) + 1) % CODE_ALPHABET.length];
    await input.fill(formatCode(typo));
    await input.press('Enter'); // the keyboard's own "search" sends the form
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText('נראה שיש בקוד טעות הקלדה. בדקו אותו שוב.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    await input.fill('ABCD-EFGH-JKMN-PQR0');
    await page.getByRole('button', { name: 'לחפש את הגיבוי' }).click();
    await expect(alert).toHaveText('בקוד יש רק אותיות באנגלית ומספרים מ־2 עד 9.');
    expect(vaultCalls(log)).toEqual([]);
    // a sound code that has no backup: the server is asked, and says so
    await input.fill(formatCode(code));
    await page.getByRole('button', { name: 'לחפש את הגיבוי' }).click();
    await expect(alert).toHaveText('לא מצאנו גיבוי עם הקוד הזה. אולי הוא נמחק, או שעברה יותר משנה בלי שימוש בו.');
    expect(vaultCalls(log)).toHaveLength(1);
    // the file is on the same screen
    await page.getByRole('button', { name: 'יש לי קובץ גיבוי' }).click();
    await expect(page.getByRole('heading', { name: 'יש לי קובץ גיבוי', level: 1 })).toBeVisible();
    await expect(page.locator('.file-pick')).toBeVisible();
  });

  test('the Home Screen app\'s first open: the banner comes first and takes the code from the clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
    });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', fresh());
    const banner = page.locator('.hello-home');
    await expect(banner).toContainText('פתחתם את מדרגות ממסך הבית? אם התחלתם בספארי, הדביקו את קוד הגיבוי וההתקדמות תעבור לכאן.');
    // first in the footer, before "מתחילים"
    expect(await page.locator('.hello-foot > *').first().evaluate((el) => el.classList.contains('hello-home'))).toBe(true);
    await shot(page, 'welcome-home-screen');
    const code = newCode();
    await page.evaluate((t) => navigator.clipboard.writeText(t), `קוד הגיבוי שלי במדרגות: ${formatCode(code)}`);
    await banner.getByRole('button', { name: 'להדביק קוד גיבוי' }).click();
    await expect(page.getByLabel('קוד הגיבוי')).toHaveValue(formatCode(code));
  });

  test('(4) "delete all" deletes the vault first; when the server cannot, nothing is deleted at all', async ({ page }) => {
    test.setTimeout(90_000);
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/settings', withServer());
    const shown = await makeCode(page);
    const { lookup } = await derive(shown.replace(/-/g, ''));
    // signing out keeps the backup, and says how to come back
    await page.getByRole('button', { name: 'התנתקות מהמכשיר' }).click();
    const out = page.getByRole('dialog', { name: 'להתנתק מהמכשיר?' });
    await expect(out).toContainText('הגיבוי בשרת נשאר. כדי לחזור להתקדמות, פותחים את מדרגות ובוחרים "יש לי קוד גיבוי".');
    await out.getByRole('button', { name: 'להישאר מחוברים' }).click();

    // the server breaks: the vault and everything here stay
    st.failVaultDelete = true;
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    const sheet = page.getByRole('dialog', { name: 'למחוק הכול?' });
    await expect(sheet).toContainText('גם הגיבוי המוצפן בשרת יימחק, וקוד הגיבוי יפסיק לעבוד.');
    await sheet.getByRole('button', { name: 'כן, למחוק הכול' }).click();
    await expect(sheet.getByRole('alert')).toHaveText('לא הצלחנו למחוק את הגיבוי בשרת, ולכן לא מחקנו כלום. השרת נתקל בתקלה. נסו שוב בעוד רגע.');
    expect(st.vaults[lookup]).toBeTruthy();
    const kept = await saved(page);
    expect(kept.profile.name).toBe('נועה');
    expect(kept.backup).toMatchObject({ on: true, code: shown.replace(/-/g, '') });
    await sheet.getByRole('button', { name: 'לא למחוק' }).click();

    // the server works: the vault goes with x-vault, then everything here, and the app starts again
    st.failVaultDelete = false;
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    await page.getByRole('dialog', { name: 'למחוק הכול?' }).getByRole('button', { name: 'כן, למחוק הכול' }).click();
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
    const deletes = log.filter((r) => r.path === '/api/vault/delete');
    expect(deletes).toHaveLength(2);
    expect(deletes.at(-1).headers['x-vault']).toBe(lookup);
    expect(st.vaults).toEqual({});
    expect((await saved(page).catch(() => null))?.profile ?? null).toBeNull();
  });

  test('(5) a sibling\'s code on a device with another student\'s progress: nothing is merged, and Settings says so', async ({ page }) => {
    test.setTimeout(90_000);
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/settings', withServer());
    const shown = await makeCode(page);
    const code = shown.replace(/-/g, '');
    const { lookup } = await derive(code);
    const before = st.vaults[lookup].blob;
    // the brother's device, with his own progress and his sister's code (typed on the wrong device)
    const sibling = {
      ...student('7', {
        ai: { mode: 'server', apiUrl: API, key: '', device: '' }, profile: { role: 'student', name: 'יואב', grade: '7', know: 1 },
        days: { '2026-11-03': { lessons: 3, xp: 40, q: 24, ok: 20 } }, xp: 40,
        backup: { on: true, code, lookup, rev: null, at: null, hash: null, state: 'idle' },
      }),
      version: 3,
    };
    const n = log.length;
    await open(page, '#/settings', sibling);
    await expect(page.getByText('בגיבוי של הקוד הזה יש התקדמות של מישהו אחר, אז לא איחדנו אותה עם מה שיש כאן. אפשר להפסיק את הגיבוי וליצור קוד חדש.')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.save-backup .save-row dd')).toHaveText('מושהה');
    await expect(page.getByRole('button', { name: 'ליצור קוד חדש' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'להשאיר כך' })).toBeVisible();
    const here = await saved(page);
    expect(here.profile.name).toBe('יואב');
    expect(here.xp).toBe(40);
    expect(Object.keys(here.days)).toEqual(['2026-11-03']);
    expect(here.backup.state).toBe('other_student');
    // the sister's vault is untouched: read, never written
    expect(log.slice(n).filter((r) => r.method === 'POST' && r.path.startsWith('/api/vault'))).toEqual([]);
    expect(st.vaults[lookup].blob).toBe(before);
    expect((await vaultOf(st, shown)).profile.name).toBe('נועה');
  });
});

test.describe('the backup question', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('never in a lesson; on the map after two days of learning, once; "לקבל קוד גיבוי" makes the code', async ({ page }) => {
    test.setTimeout(90_000);
    const { st } = await fakeServer(page.context(), {}, baseOf());
    const ask = page.getByRole('dialog', { name: 'שומרים את ההתקדמות?' });
    // in a lesson: never
    await open(page, '#/lesson/signed/1', withServer());
    await expect.poll(() => item(page)).toBeTruthy();
    await page.waitForTimeout(2500);
    await expect(ask).toHaveCount(0);
    // on the map: a moment after it settles
    await open(page, '#/', withServer());
    await expect(page.locator('.learn')).toBeVisible();
    await expect(ask).toBeVisible({ timeout: 6000 });
    await expect(ask).toContainText('כרגע ההתקדמות שמורה רק במכשיר הזה. עם קוד גיבוי אפשר להחזיר אותה גם אם המכשיר יתחלף.');
    await expect(ask).toContainText('קוד גיבוי שומר עותק מוצפן. בלי הקוד אף אחד לא יכול לקרוא אותו, גם לא אנחנו.');
    for (const name of ['לקבל קוד גיבוי', 'לשמור קובץ במקום', 'לא עכשיו']) {
      expect((await ask.getByRole('button', { name, exact: true }).boundingBox()).height, name).toBeGreaterThanOrEqual(44);
    }
    await shot(page, 'backup-nudge');
    expect((await saved(page)).durable).toMatchObject({ nudgeCount: 1, nudgeAt: NOW.toISOString() });
    await ask.getByRole('button', { name: 'לקבל קוד גיבוי' }).click();
    const sheet = page.getByRole('dialog', { name: 'קוד הגיבוי שלכם' });
    await expect(sheet).toBeVisible();
    await expect(ask).toHaveCount(0);
    expect(Object.keys(st.vaults)).toHaveLength(1);
    await sheet.getByRole('button', { name: 'שמרתי', exact: true }).click();
    expect((await saved(page)).backup.on).toBe(true);
  });

  test('"לא עכשיו" counts: not again on a reload, nor within 14 days', async ({ page }) => {
    await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/quests', withServer());
    const ask = page.getByRole('dialog', { name: 'שומרים את ההתקדמות?' });
    await expect(ask).toBeVisible({ timeout: 6000 });
    await ask.getByRole('button', { name: 'לא עכשיו' }).click();
    await expect(ask).toHaveCount(0);
    expect((await saved(page)).durable.nudgeCount).toBe(1);
    await page.reload();
    await appReady(page);
    await page.waitForTimeout(2500);
    await expect(ask).toHaveCount(0);
  });
});
