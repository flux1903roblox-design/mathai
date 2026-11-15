// The Arabic app shell (COUNCIL2-34): the language choice on the first screen and in Settings, the page's lang and dir,
// Rubik's Arabic face fetched only for Arabic, and the shell's screens in Arabic on a phone: Welcome, home and
// Settings. A Hebrew device never fetches an Arabic file. And an Arabic topic (content/arabic.js) on an Arabic device:
// its guide, its teaching and its exercises in Arabic words. With AR_SHOTS set, each test also saves its screen there.
import { test, expect } from '@playwright/test';
import { open, student, appReady, screenReady, item } from './helpers.js';

// Arabic is behind a build flag (VITE_ARABIC, lib/i18n.js): these tests run in the 'arabic' projects only, against a build
// made with it on (e2e/playwright.config.js). arabic-off.spec.js checks the default build, where there is no Arabic.
test.beforeEach(({}, info) => { test.skip(!['arabic', 'arabic-small'].includes(info.project.name), 'the Arabic shell runs on the two phones of the Arabic build'); });

const HEBREW = /[֐-׿]/;

/** Open a route the way open() does, then switch the device to Arabic (as the language choice stores it) and reload. */
async function openArabic(page, route, state) {
  await open(page, route, state);
  await page.evaluate(() => localStorage.setItem('madregot-locale', 'ar'));
  await page.reload();
  await appReady(page);
  await screenReady(page, route);
}

/** Every word on the page a person or a screen reader meets: the text (screen-reader-only text too) and the labels. */
const pageWords = (page, root = 'body') => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const labels = [...el.querySelectorAll('[aria-label], [title], [placeholder]')].flatMap((e) => ['aria-label', 'title', 'placeholder'].map((a) => e.getAttribute(a)).filter(Boolean));
  return [el.innerText, ...labels].join('\n');
}, root);

// the language choice names Hebrew in Hebrew (its own language), on every screen that offers it
const hebrewLines = (text) => text.split('\n').filter((l) => HEBREW.test(l) && l.trim() !== 'עברית');

async function shot(page, name) {
  if (!process.env.AR_SHOTS) return;
  // the screen's short fade-in has ended (Shell.jsx), so the picture shows it as a person sees it
  await page.waitForFunction(() => [...document.querySelectorAll('.screen')].every((s) => getComputedStyle(s).opacity === '1'));
  await page.screenshot({ path: `${process.env.AR_SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });
}

test('Welcome: the language choice turns the first screen Arabic, it is remembered, and Hebrew comes back the same way', async ({ page }) => {
  const arabicFiles = [];
  page.on('request', (r) => { if (/\.ar-[\w-]+\.js$|rubik-arabic/.test(r.url())) arabicFiles.push(r.url()); });
  await open(page, '#/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('מתמטיקה שמבינים.');
  expect(arabicFiles, 'a Hebrew device fetches no Arabic file').toEqual([]);

  const group = page.getByRole('group', { name: 'שפת האפליקציה' });
  await expect(group.getByRole('button', { name: 'עברית' })).toHaveAttribute('aria-pressed', 'true');
  await group.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('رياضيات نفهمها.');
  await expect(page.getByRole('group', { name: 'لغة التطبيق' }).getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'لنبدأ', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'معلومات قانونية' }).getByRole('link', { name: 'الخصوصية' })).toBeVisible();
  // Rubik's Arabic part draws the words: fetched now, for this language only
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Rubik Variable"', 'رياضيات'))).toBe(true);
  expect(arabicFiles.some((u) => /rubik-arabic/.test(u))).toBe(true);
  expect(hebrewLines(await pageWords(page)), 'no Hebrew on the Arabic first screen').toEqual([]);
  await shot(page, 'welcome');

  // remembered on the device: a reload opens in Arabic, with lang set before the app draws
  await page.reload();
  await appReady(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('رياضيات نفهمها.');

  // the first question, in Arabic too
  await page.getByRole('button', { name: 'لنبدأ', exact: true }).click();
  await expect(page.getByText('أهلًا، أنا مدي! ما اسمكم؟')).toBeVisible();
  await expect(page.getByPlaceholder('الاسم الشخصي')).toBeVisible();
  expect(hebrewLines(await pageWords(page))).toEqual([]);
  await shot(page, 'welcome-name');
  await page.getByRole('button', { name: 'رجوع' }).click();

  await page.getByRole('group', { name: 'لغة التطبيق' }).getByRole('button', { name: 'עברית' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('מתמטיקה שמבינים.');
});

test('?lang=ar opens the app in Arabic and leaves the address', async ({ page }) => {
  await open(page, '#/');
  await page.goto('./?lang=ar#/');
  await appReady(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('رياضيات نفهمها.');
  expect(new URL(page.url()).search).toBe('');
});

test('home in Arabic: the tab bar, the top bar and the map\'s own words', async ({ page }) => {
  await openArabic(page, '#/', student('7'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  const nav = page.getByRole('navigation', { name: 'التنقّل الرئيسي' });
  for (const tab of ['تعلّم', 'مهامّ', 'امتحانات', 'مساعد AI', 'أنا']) await expect(nav.getByRole('link', { name: tab, exact: true })).toBeVisible();
  expect(hebrewLines(await pageWords(page, 'nav.tabbar'))).toEqual([]);
  await expect(page.locator('.grade-switch')).toContainText('الصف السابع');
  await expect(page.locator('.unit-label').first()).toContainText('الوحدة 1');
  await expect(page.getByRole('link', { name: 'كل المواضيع ووضع كل واحد منها' })).toBeVisible();
  await shot(page, 'home');
});

test('Settings in Arabic: every word is Arabic, and the language can be changed back and forth', async ({ page }) => {
  await openArabic(page, '#/settings', student('7'));
  await expect(page.getByRole('heading', { name: 'الإعدادات', level: 1 })).toBeVisible();
  const lang = page.getByRole('group', { name: 'اللغة' });
  await expect(lang.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('الترجمة إلى العربية في بدايتها')).toBeVisible();
  for (const head of ['تفاصيلي', 'المساعد الذكي', 'المظهر', 'الأصوات', 'الخصوصية والأمان', 'منطقة الحذف']) {
    await expect(page.getByRole('heading', { name: head, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'سياسة الخصوصية' })).toBeVisible();
  expect(hebrewLines(await pageWords(page)), 'no Hebrew on the Arabic Settings').toEqual([]);
  await shot(page, 'settings');

  // the support sheet (the support card) and a confirm sheet, in Arabic
  await page.getByRole('button', { name: 'تحتاجون إلى التحدّث مع أحد؟' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('عيران');
  await expect(sheet).toContainText('على مدار الساعة');
  await expect(sheet.getByRole('link', { name: /اتصال 1201/ })).toHaveAttribute('href', 'tel:1201');
  expect(hebrewLines(await pageWords(page, '[role="dialog"]'))).toEqual([]);
  await shot(page, 'support');
  await sheet.getByRole('button', { name: 'إغلاق' }).click();
  await page.getByRole('button', { name: 'تصفير التقدّم' }).click();
  await expect(page.getByRole('dialog')).toContainText('ستُحذف كل الدرجات والنقاط والسجلّ على هذا الجهاز.');
  await page.getByRole('button', { name: 'إبقاء التقدّم' }).click();

  // to Hebrew and back, on the same screen
  await lang.getByRole('button', { name: 'עברית' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { name: 'הגדרות', level: 1 })).toBeVisible();
  await expect(page.getByText('התרגום לערבית בתחילתו')).toHaveCount(0);
  await page.getByRole('group', { name: 'שפה' }).getByRole('button', { name: 'العربية' }).click();
  await expect(page.getByRole('heading', { name: 'الإعدادات', level: 1 })).toBeVisible();
  // the tab bar (hidden under a pushed screen on a phone) followed too
  await expect(page.locator('nav.tabbar')).toHaveAttribute('aria-label', 'التنقّل الرئيسي');
  await expect(page.locator('nav.tabbar .tab').first()).toContainText('تعلّم');
});

test('an Arabic topic on an Arabic device: its guide, its teaching and its questions are Arabic, a Hebrew topic stays Hebrew', async ({ page }) => {
  const arabicFiles = [];
  page.on('request', (r) => { if (/\.ar-[\w-]+\.js$/.test(r.url())) arabicFiles.push(r.url().split('/').pop().replace(/-[\w-]+\.js$/, '')); });
  await openArabic(page, '#/topic/signed', student('7'));
  await expect(page.locator('.unit-title')).toHaveText('الأعداد الموجّهة');
  const guide = page.locator('.guide-cards').first();
  await expect(guide).toContainText('محور الأعداد');
  expect(await guide.innerText()).not.toMatch(HEBREW);
  await shot(page, 'topic');

  // the teaching: the stair's first step, as the app holds it on screen, is Arabic
  await openArabic(page, '#/learn/signed/1/A', student('7'));
  await page.waitForFunction(() => window.__madregotStep);
  const stepText = await page.evaluate(() => JSON.stringify(window.__madregotStep));
  expect(stepText).toMatch(/[\u0600-\u06FF]/);
  expect(stepText).not.toMatch(HEBREW);
  await shot(page, 'teach');

  // a practice question of the stair: Arabic words around the same maths
  await openArabic(page, '#/lesson/signed/1', student('7'));
  await page.waitForFunction(() => window.__madregotItem);
  const q = await item(page);
  expect(JSON.stringify({ text: q.text, levelTitle: q.levelTitle, choices: q.choices })).not.toMatch(HEBREW);
  expect(q.levelTitle).toMatch(/[\u0600-\u06FF]/);
  await shot(page, 'question');
  expect(arabicFiles).toEqual(expect.arrayContaining(['grade7.ar', 'signed.ar']));

  // a topic without its Arabic yet keeps its Hebrew words
  await openArabic(page, '#/topic/coord', student('7'));
  await expect(page.locator('.unit-title')).toHaveText(/[֐-׿]/);
});
