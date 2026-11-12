// The backup file in a real browser (DURABLE-4), on the build with no server: save it from Settings (a download where
// the browser cannot share files, the share sheet where it can), restore it on a fresh browser through Welcome, and
// the three cases of a restore: an empty device, the same student (merged), another student (replace, then undo).
import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { open, student, livedIn, saved, appReady, backupFile } from './helpers.js';

// Chromium names a download from its `download` attribute only when the file system's encoding can hold the name; a
// machine on the POSIX locale cannot hold Hebrew, and the file would be called "download". Phones and computers use
// UTF-8, so the browser here does too.
test.use({ launchOptions: { env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } } });

/** Screenshots for the evidence folder (DURABLE_SHOTS=<folder>); nothing is compared. */
async function shot(page, name) {
  const dir = process.env.DURABLE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700); // a sheet's entrance ends
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png` });
}

/** This browser cannot share files: the backup is downloaded (whatever this Chromium supports). */
const noShare = (page) => page.addInitScript(() => { delete Navigator.prototype.canShare; delete Navigator.prototype.share; });
const restoreInput = (page) => page.getByLabel('לשחזר מקובץ');

test('save a backup file (a download), and restore it on a fresh browser through the first screen', async ({ page, browser }, info) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await noShare(page);
  await open(page, '#/settings', livedIn('7'));
  const source = await saved(page);
  await expect(page.getByText('בקובץ יש את כל ההתקדמות, כולל השם. מי שמקבל אותו יכול לקרוא אותו.')).toBeVisible();
  const save = page.getByRole('button', { name: 'לשמור קובץ גיבוי' });
  expect((await save.boundingBox()).height).toBeGreaterThanOrEqual(44);
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toBe('madregot-נועה-2026-11-05.json');
  await expect(page.getByRole('status').filter({ hasText: 'קובץ הגיבוי נשמר בהורדות.' })).toBeVisible();
  const path = info.outputPath('backup.json');
  await download.saveAs(path);
  const file = JSON.parse(readFileSync(path, 'utf8'));
  // schema: the store's version (6 since the teacher's class work, durable/migrations.js CURRENT_VERSION)
  expect(file).toMatchObject({ app: 'madregot', kind: 'backup', v: 1, schema: 6 });
  for (const k of ['ai', 'outbox', 'durable', 'backup', 'classWork', 'workOutbox']) expect(file.state[k]).toBeUndefined();

  // a fresh browser: nothing saved, the first screen
  const ctx = await browser.newContext(info.project.use);
  const fresh = await ctx.newPage();
  fresh.on('pageerror', (e) => errors.push(e.message));
  await open(fresh, '#/');
  const way = fresh.getByRole('button', { name: 'יש לי קובץ גיבוי' });
  await expect(way).toBeVisible();
  expect((await way.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(way).toBeInViewport({ ratio: 1 }); // all three ways in fit on the first screen, at 320x568 too
  await shot(fresh, 'welcome-hello');
  await way.click();
  await expect(fresh.getByRole('heading', { name: 'בחרו את קובץ הגיבוי ששמרתם.' })).toBeVisible();
  await shot(fresh, 'restore-start');
  const pick = fresh.locator('.file-pick');
  expect((await pick.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await restoreInput(fresh).setInputFiles(path);
  await expect(fresh.getByRole('heading', { name: 'מצאנו גיבוי', level: 1 })).toBeFocused(); // a screen reader hears it at once
  await expect(fresh.locator('.restore-summary')).toHaveText('נועה · כיתה ז׳ · 260 XP · 7 מדרגות · תרגול אחרון: 5 בנובמבר 2026');
  await shot(fresh, 'restore-preview-empty');
  await fresh.getByRole('button', { name: 'להמשיך מכאן' }).click();
  await expect(fresh.getByText('ההתקדמות חזרה. ממשיכים מאיפה שעצרתם.')).toBeVisible();
  await expect(fresh.locator('.learn')).toBeVisible();
  const restored = await saved(fresh);
  expect(restored.xp).toBe(source.xp);
  expect(restored.xpBy).toEqual(source.xpBy);
  expect(restored.path).toEqual(source.path);
  expect(restored.learn.skills).toEqual(source.learn.skills);
  expect(restored.days).toEqual(source.days);
  expect(restored.learn.events.at(-1)).toMatchObject({ e: 'restore', m: 'file' });
  await fresh.reload(); await appReady(fresh);
  await expect(fresh.locator('.top-stat.xp')).toHaveAttribute('aria-label', /סך הכול 260/);
  await ctx.close();
  expect(errors).toEqual([]);
});

test('where the browser can share files, the backup goes to the share sheet: one file, named madregot-*.json', async ({ page }) => {
  await page.addInitScript(() => {
    Navigator.prototype.canShare = function canShare(data) { return !!data?.files?.length; };
    Navigator.prototype.share = async function share(data) {
      window.__shared = { n: data.files.length, name: data.files[0].name, type: data.files[0].type, title: data.title, text: data.text, body: await data.files[0].text() };
    };
  });
  await open(page, '#/settings', livedIn('7'));
  let downloads = 0; page.on('download', () => { downloads += 1; });
  await page.getByRole('button', { name: 'לשמור קובץ גיבוי' }).click();
  await expect.poll(() => page.evaluate(() => window.__shared?.n)).toBe(1);
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.name).toMatch(/^madregot-.+\.json$/);
  expect(shared.type).toBe('application/json');
  expect(shared.title).toBe('גיבוי מדרגות');
  expect(shared.text).toBe('קובץ הגיבוי של מדרגות. שמרו אותו. כדי לשחזר: מדרגות ← הגדרות ← שמירת ההתקדמות ← לשחזר מקובץ.');
  expect(JSON.parse(shared.body).state.xp).toBe(260);
  expect(downloads).toBe(0);
});

test('the same student: the two are merged, nothing lowered, and no undo is offered', async ({ page }) => {
  await open(page, '#/settings', livedIn('7'));
  const here = await saved(page);
  const other = { ...student('7').state, xp: 40, xpBy: { b2c3d4e5: 40 }, days: { '2026-10-01': { lessons: 1, xp: 40, q: 8, ok: 8 } } };
  await restoreInput(page).setInputFiles(backupFile(other));
  const sheet = page.getByRole('dialog', { name: 'מצאנו גיבוי' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('שום דבר לא יימחק: אנחנו משאירים את הגבוה מבין השניים בכל מדרגה ובכל יום.')).toBeVisible();
  await shot(page, 'restore-preview-same');
  await sheet.getByRole('button', { name: 'לאחד עם מה שיש כאן' }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).xp).toBe(here.xp + 40);
  const st = await saved(page);
  expect(st.days['2026-10-01']).toEqual({ lessons: 1, xp: 40, q: 8, ok: 8 });
  for (const [d, day] of Object.entries(here.days)) expect(st.days[d]).toEqual(day);
  await expect(page.getByRole('button', { name: 'לבטל את השחזור האחרון' })).toHaveCount(0);
});

test('a sibling\'s file: a warning, "להחליף" is needed, and undo brings the first child back', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await open(page, '#/settings', livedIn('7'));
  const here = await saved(page);
  const sibling = { ...student('8').state, profile: { role: 'student', name: 'יואב', grade: '8', know: 1 }, xp: 75, xpBy: { b2c3d4e5: 75 }, days: { '2026-11-03': { lessons: 2, xp: 75, q: 16, ok: 15 } } };
  await restoreInput(page).setInputFiles(backupFile(sibling, 'madregot-יואב-2026-11-04.json'));
  const sheet = page.getByRole('dialog', { name: 'מצאנו גיבוי' });
  await expect(sheet.getByText('במכשיר הזה יש התקדמות של נועה. שחזור יחליף אותה. אפשר לבטל את זה במשך 30 יום בהגדרות.')).toBeVisible();
  await expect(sheet.locator('.restore-summary')).toContainText('יואב · כיתה ח׳ · 75 XP');
  await shot(page, 'restore-preview-other');
  // "לא עכשיו" changes nothing
  await sheet.getByRole('button', { name: 'לא עכשיו' }).click();
  await expect(sheet).toHaveCount(0);
  expect((await saved(page)).profile.name).toBe('נועה');
  // again, and replace
  await restoreInput(page).setInputFiles(backupFile(sibling, 'madregot-יואב-2026-11-04.json'));
  await page.getByRole('dialog', { name: 'מצאנו גיבוי' }).getByRole('button', { name: 'להחליף' }).click();
  await expect(page.getByText('ההתקדמות חזרה. ממשיכים מאיפה שעצרתם.')).toBeVisible();
  await expect.poll(async () => (await saved(page)).profile.name).toBe('יואב');
  expect((await saved(page)).xp).toBe(75);
  expect((await saved(page)).backup.on).toBe(false);
  await expect(page.locator('#me-name')).toHaveValue('יואב'); // the settings follow the restored profile
  const undo = page.getByRole('button', { name: 'לבטל את השחזור האחרון' });
  await expect(undo).toBeVisible();
  expect((await undo.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await undo.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 }); // the toast has gone
  await shot(page, 'restore-undo');
  await undo.click();
  await expect(page.getByText('השחזור בוטל. חזרנו למה שהיה לפני.')).toBeVisible();
  await expect.poll(async () => (await saved(page)).profile.name).toBe('נועה');
  const back = await saved(page);
  expect(back.xp).toBe(here.xp);
  expect(back.days).toEqual(here.days);
  expect(back.backup.forcePush).toBe(true);
  await expect(undo).toHaveCount(0);
  await expect(page.locator('#me-name')).toHaveValue('נועה');
  expect(errors).toEqual([]);
});

test('a file that is not a Madregot backup is refused with a plain message, and nothing changes', async ({ page }) => {
  await open(page, '#/settings', livedIn('7'));
  await restoreInput(page).setInputFiles({ name: 'photo.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByRole('alert').filter({ hasText: 'הקובץ הזה לא נראה כמו גיבוי של מדרגות.' })).toBeVisible();
  await restoreInput(page).setInputFiles({ name: 'cut.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"madregot","kind":"backup","state":{') });
  await expect(page.getByRole('alert').filter({ hasText: 'הקובץ פגום, ואי אפשר לשחזר ממנו. נסו קובץ אחר.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await saved(page)).xp).toBe(260);
});

test('keyboard: the file chooser is reached with Tab and shows where the focus is', async ({ page }) => {
  await open(page, '#/settings', livedIn('7'));
  await page.getByRole('button', { name: 'לשמור קובץ גיבוי' }).focus();
  await page.keyboard.press('Tab');
  await expect(restoreInput(page)).toBeFocused();
  const ring = await page.locator('.file-pick').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(ring).toBe('solid');
});
