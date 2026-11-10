// Installable, kept, and honest about where the data lives (DURABLE-3), in a real browser: the manifest and its icons
// load (every icon is a PNG of the size it states), the browser is asked to keep the data once after the first lesson
// and not again after a reload, an iPhone in Safari is offered the Home Screen guide on Learn from the 3rd day, and the
// sentences about where the progress lives are true for a class student and never say "מוצפן" (only the backup code's
// own note does, DURABLE-5: that copy only the code opens).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { open, student, livedIn, item, answer, proceedToNext, leaveEndScreens } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';

const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const CLASS_LINE = 'המספרים האלה מחושבים במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.';

/** Screenshots for the evidence folder (DURABLE_SHOTS=<folder>); nothing is compared. */
async function shot(page, name, { fullPage = false } = {}) {
  const dir = process.env.DURABLE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700); // a screen's entrance fade ends
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png`, fullPage });
}

/** Width and height from a PNG's header (the IHDR chunk), or null when the bytes are not a PNG. */
function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b) || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Saved as a v3 save, so the server address is kept (as class-sync.spec.js does). */
const withServer = (profile) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, profile }), version: 3 });
const SOLO = { role: 'student', name: 'נועה', grade: '7', know: 1 };
const CLASS = { ...SOLO, classCode: 'K7Q2MD', className: 'ז׳3', teacherName: 'רונית', token: 'stu_token_1', studentId: 's1' };

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

test.describe('installable and kept', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('the manifest loads with its fields, and every icon is a PNG of the size it states', async ({ page }) => {
    await open(page, '#/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('./manifest.webmanifest');
    const res = await page.request.get(new URL(href, baseOf()).href);
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m).toMatchObject({
      name: 'מדרגות', short_name: 'מדרגות', lang: 'he', dir: 'rtl', start_url: './#/', scope: './',
      display: 'standalone', background_color: '#FFFFFF', theme_color: '#FFFFFF',
    });
    expect(m.icons.map((i) => i.src)).toEqual(['icons/192.png', 'icons/512.png', 'icons/maskable-512.png']);
    expect(m.icons.find((i) => i.purpose === 'maskable')?.src).toBe('icons/maskable-512.png');
    // the manifest's addresses are read from where the manifest is
    const manifestUrl = new URL(href, baseOf()).href;
    for (const icon of m.icons) {
      const r = await page.request.get(new URL(icon.src, manifestUrl).href);
      expect(r.status(), icon.src).toBe(200);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(await r.body()), icon.src).toEqual({ width: w, height: h });
      expect(icon.type).toBe('image/png');
    }
    // the iPhone's Home Screen icon and name
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    const r = await page.request.get(new URL(apple, baseOf()).href);
    expect(pngSize(await r.body())).toEqual({ width: 180, height: 180 });
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'מדרגות');
  });

  test('the browser is asked to keep the data once, after the first lesson, and not again after a reload', async ({ page }) => {
    // the browser's storage, stubbed: it counts the asks across reloads and promises nothing
    await page.addInitScript(() => {
      const n = () => Number(localStorage.getItem('qa-persist-asks') || 0);
      Object.defineProperty(StorageManager.prototype, 'persisted', { configurable: true, value: async () => false });
      Object.defineProperty(StorageManager.prototype, 'persist', { configurable: true, value: async () => { localStorage.setItem('qa-persist-asks', String(n() + 1)); return false; } });
    });
    const asks = () => page.evaluate(() => Number(localStorage.getItem('qa-persist-asks') || 0));
    await open(page, '#/', student('7'));
    await page.evaluate(() => localStorage.removeItem('qa-persist-asks'));
    expect(await asks()).toBe(0); // opening the app reads the answer, it never asks
    await lesson(page);
    await expect.poll(asks).toBe(1);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.durable.persistAsked)).toBeTruthy();
    await page.reload();
    await expect(page.locator('.learn')).toBeVisible();
    await lesson(page);
    await page.waitForTimeout(300);
    expect(await asks()).toBe(1);
    // Settings shows the answer as it is, and the button asks again only when tapped
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    const row = page.locator('#save .save-row').filter({ hasText: 'שמירה קבועה בדפדפן' });
    await expect(row.locator('dd')).toHaveText('לא מובטחת');
    await page.getByRole('button', { name: 'לבקש מהדפדפן לשמור' }).click();
    await expect(page.getByText('הדפדפן לא הבטיח לשמור. כדאי לשמור גיבוי.')).toBeVisible();
    expect(await asks()).toBe(2);
    // the info button says when browsers delete data
    await page.getByRole('button', { name: 'מתי דפדפן מוחק נתונים' }).click();
    const info = page.getByRole('dialog', { name: 'מתי דפדפן מוחק נתונים' });
    await expect(info).toContainText('אפליקציה שהוספתם למסך הבית לא נמחקת כך.');
    await info.getByRole('button', { name: 'הבנתי' }).click();
    await expect(info).toHaveCount(0);
  });

  test('a browser that promised: "כן", and no button', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(StorageManager.prototype, 'persisted', { configurable: true, value: async () => true });
    });
    await open(page, '#/settings', student('7'));
    const row = page.locator('#save .save-row').filter({ hasText: 'שמירה קבועה בדפדפן' });
    await expect(row.locator('dd')).toHaveText('כן');
    await expect(page.getByRole('button', { name: 'לבקש מהדפדפן לשמור' })).toHaveCount(0);
  });
});

test.describe('an iPhone in Safari', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  test.use({ userAgent: IPHONE });
  test.beforeEach(async ({ page }) => {
    // Safari in a tab: not the Home Screen app
    await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); });
  });

  test('from the 3rd day, Learn offers the Home Screen guide once; Settings always has it', async ({ page }) => {
    await open(page, '#/', livedIn('7')); // four days with finished lessons
    const card = page.locator('.install-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('להוסיף את מדרגות למסך הבית');
    await shot(page, 'install-card');
    await card.getByRole('button', { name: 'איך מוסיפים' }).click();
    const sheet = page.getByRole('dialog', { name: 'להוסיף את מדרגות למסך הבית' });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.install-steps > li')).toHaveCount(4);
    await expect(sheet).toContainText('קודם שומרים את ההתקדמות.');
    await expect(sheet).toContainText('צריך את קובץ הגיבוי פעם אחת');
    await shot(page, 'install-sheet');
    // step 1 saves the backup file, and says so
    const download = page.waitForEvent('download');
    await sheet.getByRole('button', { name: 'לשמור קובץ גיבוי' }).click();
    await download;
    await expect(sheet.getByText('שמרנו קובץ גיבוי.')).toBeVisible();
    await sheet.getByRole('button', { name: 'הבנתי' }).click();
    await expect(sheet).toHaveCount(0);
    // offered: not again on Learn for 30 days, also after a reload
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.learn')).toBeVisible();
    await expect(page.locator('.install-card')).toHaveCount(0);
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await page.getByRole('button', { name: 'להוסיף למסך הבית' }).click();
    await expect(page.getByRole('dialog', { name: 'להוסיף את מדרגות למסך הבית' })).toBeVisible();
  });

  test('"לא עכשיו" on the card puts it away for 30 days; two days of learning are not enough for it', async ({ page }) => {
    await open(page, '#/', livedIn('7'));
    await page.locator('.install-card').getByRole('button', { name: 'לא עכשיו' }).click();
    await expect(page.locator('.install-card')).toHaveCount(0);
    const two = student('7', { days: { '2026-11-04': { lessons: 1, xp: 15, q: 8, ok: 8 }, '2026-11-05': { lessons: 1, xp: 12, q: 8, ok: 7 } }, xp: 27 });
    await open(page, '#/', two);
    await expect(page.locator('.learn')).toBeVisible();
    await expect(page.locator('.install-card')).toHaveCount(0);
  });
});

test.describe('where the progress lives, said truly', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('no server: kept on this device, and a backup file now and then', async ({ page }) => {
    await open(page, '#/me', livedIn('7'));
    await expect(page.locator('.nums-where')).toHaveText('ההתקדמות נשמרת במכשיר הזה. כדאי לשמור קובץ גיבוי מדי פעם. הזמן באפליקציה לא נספר כאן: רק מה שפתרתם לבד.');
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await expect(page.locator('.footnote')).toHaveText('מדרגות. ההתקדמות נשמרת במכשיר הזה. כדאי לשמור קובץ גיבוי מדי פעם.');
    await expect(page.locator('.save-section')).toBeVisible();
    await shot(page, 'save-section-none', { fullPage: true });
  });

  test('with a server, alone: only on this device', async ({ page }) => {
    await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/settings', withServer(SOLO));
    await expect(page.locator('.footnote')).toHaveText('מדרגות. ההתקדמות נשמרת רק במכשיר הזה.');
    await shot(page, 'save-section-solo', { fullPage: true });
    await page.evaluate(() => { window.location.hash = '#/me'; });
    await expect(page.locator('.nums-where')).toContainText('ההתקדמות נשמרת רק במכשיר הזה.');
  });

  test('a class student: the numbers say the answers go to the teacher, and only the backup code\'s note says "מוצפן"', async ({ page }) => {
    await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/me', withServer(CLASS));
    await expect(page.locator('.nums-where')).toContainText(CLASS_LINE);
    await expect(page.locator('body')).not.toContainText('לא נשלחים לשום מקום');
    // "מוצפן" outside the backup code's note (the one copy only its code opens)
    const encrypted = () => page.evaluate(() => {
      const count = (t) => t.split('מוצפן').length - 1;
      return count(document.body.innerText) - count(document.querySelector('.save-backup .save-note')?.innerText || '');
    });
    for (const route of ['#/me', '#/settings', '#/']) {
      await page.evaluate((r) => { window.location.hash = r; }, route);
      await expect(page.locator(route === '#/' ? '.learn' : route === '#/me' ? '.profile-name' : '.save-section')).toBeVisible();
      expect(await encrypted(), route).toBe(0);
    }
    expect(await encrypted()).toBe(0);
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await expect(page.locator('.footnote')).toHaveText('מדרגות. ההתקדמות נשמרת במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.');
    await shot(page, 'save-section-class', { fullPage: true });
  });
});
