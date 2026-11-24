// Arabic is behind one build flag, off by default (VITE_ARABIC, lib/i18n.js; the review of COUNCIL2-34 found a
// half-Arabic app within everyone's reach: the choice on the first screen and in Settings, ?lang=ar, and a stored
// choice). This is the default build, the one that ships: no screen offers Arabic, the address and the device's storage
// cannot turn it on, and no Arabic file is ever requested. e2e/arabic.spec.js runs the same app built with the flag on.
import { test, expect } from '@playwright/test';
import { open, student, appReady, screenReady } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the two phones'); });

const ARABIC = /[؀-ۿ]/;
/** Every request for an Arabic file: a catalogue or content chunk (<name>.ar-<hash>.js) or Rubik's Arabic part. */
function watchArabic(page) {
  const seen = [];
  page.on('request', (r) => { if (/\.ar-[\w-]+\.js$|rubik-arabic/.test(r.url())) seen.push(r.url()); });
  return seen;
}
const words = (page) => page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('[aria-label], [title], [placeholder]')]
  .flatMap((e) => ['aria-label', 'title', 'placeholder'].map((a) => e.getAttribute(a)).filter(Boolean))].join('\n'));

test('the first screen offers no language choice, and ?lang=ar leaves it in Hebrew', async ({ page }) => {
  const arabic = watchArabic(page);
  await open(page, '#/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('מתמטיקה שמבינים.');
  await expect(page.locator('.lang-pick')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'العربية' })).toHaveCount(0);
  expect(ARABIC.test(await words(page)), 'no Arabic letter on the first screen').toBe(false);
  // a link that asks for Arabic: the page stays Hebrew, before the first paint (theme-boot.js) and after it (i18n.js)
  await page.goto('./?lang=ar#/');
  await appReady(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('מתמטיקה שמבינים.');
  expect(await page.evaluate(() => localStorage.getItem('madregot-locale')), 'and nothing is remembered').toBeNull();
  await page.evaluate(() => document.fonts.ready);
  expect(arabic, 'no Arabic file was requested').toEqual([]);
});

test('a device that stored Arabic (from a build that had it) opens in Hebrew everywhere, with no Arabic file and no Arabic word', async ({ page }) => {
  const arabic = watchArabic(page);
  await open(page, '#/', student('7'));
  await page.evaluate(() => localStorage.setItem('madregot-locale', 'ar'));
  for (const route of ['#/', '#/lesson/signed/1', '#/topics', '#/assistant', '#/me', '#/settings']) {
    await page.goto(`./${route}`);
    await page.reload();
    await appReady(page);
    await screenReady(page, route);
    await expect(page.locator('html'), route).toHaveAttribute('lang', 'he');
    expect(ARABIC.test(await words(page)), `${route}: no Arabic letter`).toBe(false);
  }
  // Settings has no "שפה" section and no choice
  await expect(page.getByRole('heading', { name: 'שפה', exact: true })).toHaveCount(0);
  await expect(page.locator('.lang-pick')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  expect(arabic, 'no Arabic file was requested').toEqual([]);
  // the tutor is never asked for Arabic: the app's own language is Hebrew
  expect(await page.evaluate(() => document.querySelector('meta[name="madregot-arabic"]')?.content)).toBe('off');
});

test('the build itself holds no Arabic file: nothing to fetch even by its address', async ({ page, request }) => {
  await open(page, '#/');
  // every script and style the page names, and the service worker's list of files kept for offline use
  const sw = await (await request.get('./sw.js')).text();
  const kept = JSON.parse(/^self\.__PRECACHE = (\[.*\]);$/m.exec(sw)[1]);
  expect(kept.filter((f) => /\.ar-[\w-]+\.js$|rubik-arabic/.test(f))).toEqual([]);
  // the Arabic catalogue's first words are in no file the build kept for offline use
  for (const f of kept.filter((x) => /\.js$/.test(x)).slice(0, 400)) {
    const text = await (await request.get(`./${f}`)).text();
    expect(text.includes('رياضيات نفهمها'), f).toBe(false);
  }
});
