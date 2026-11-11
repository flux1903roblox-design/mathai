// The landing pages (STUDENT-13), built into dist-test by scripts/landing-build.mjs with stand-in owner values
// (playwright.config.js): /mivchan/ for parents and /pilot/ for schools. Each says what the app does in one screen, and
// its button leads into the right place in the app: Exam Rescue after the first questions, or the teacher's way in.
// They read well in light and dark, never scroll sideways at 320, and count a view and a press with a beacon (count.js).
// LANDING_SHOTS=<folder> saves full-page screenshots for a look (nothing is compared).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student, onboard, expectNoSidewaysScroll } from './helpers.js';
import { expectTextContrast } from './contrast.js';

const API = 'https://api.madregot.test'; // API_BASE in playwright.config.js
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

test.skip(({ viewport }) => viewport.width > 800, 'the phone sizes; the desktop layout is in qa-evidence/student/landing');

/** The Worker's /api/metrics, as a list of the names counted (204, as the Worker answers). */
async function metrics(page) {
  const names = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (new URL(req.url()).pathname === '/api/metrics' && req.method() === 'POST') names.push(req.postData());
    return route.fulfill({ status: 204, headers: CORS });
  });
  return names;
}

/** A landing page on a device with a saved state (null: nothing saved), at the e2e tests' fixed time. */
async function openLanding(page, path, state = null) {
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('madregot', JSON.stringify(s)); }, state);
  await page.goto(`./${path}`);
  if (path.startsWith('#')) await page.reload(); // the app reads a link when it starts, as it does from another page
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page, name) {
  const dir = process.env.LANDING_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png`, fullPage: true });
}

test('/mivchan/: the question, the plan in one screen, and its button leads to Exam Rescue after the first questions', async ({ page }) => {
  const counted = await metrics(page);
  await openLanding(page, 'mivchan/');
  await expect(page).toHaveTitle('מבחן במתמטיקה ביום חמישי? · מדרגות');
  await expect(page.getByRole('heading', { level: 1, name: 'מבחן במתמטיקה ביום חמישי?' })).toBeVisible();
  const cta = page.getByRole('link', { name: 'לבנות תוכנית חזרה, חינם' }).first();
  // the question, what the app does and the way in, all in the first screen of a phone
  await expect(cta).toBeInViewport();
  await expect(page.getByText('בונה לילד תוכנית חזרה לימים שנשארו')).toBeInViewport();
  await expect(page.getByRole('img', { name: /מסך תוכנית החזרה/ })).toBeVisible();
  // the price is the server's own, with its VAT words, and the topics are the app's
  await expect(page.getByText('₪29.90 לחודש או ₪249 לשנה, כולל מע״מ. בלי התחייבות, מבטלים באתר.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'כיתה ז׳:' })).toContainText('מספרים מכוונים');
  await expect.poll(() => counted).toEqual(['landing_view_mivchan']);
  await shot(page, 'mivchan');

  await cta.click();
  await expect(page).toHaveURL(/#\/\?next=\/rescue&src=mivchan$/);
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
  await expect.poll(() => counted).toEqual(['landing_view_mivchan', 'landing_cta_mivchan']);
  await onboard(page, { name: 'נועה', grade: '7', start: null });
  // no "where to start" question: the link's place is next, and its button says so
  await expect(page).toHaveURL(/#\/rescue$/);
  await expect(page.getByText('מתי המבחן?')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.profile);
  expect(saved).toMatchObject({ role: 'student', name: 'נועה', grade: '7' });
});

test('the daily goal\'s button names the link\'s place, and a student who already uses the app goes straight there', async ({ page }) => {
  await openLanding(page, 'mivchan/');
  await page.getByRole('link', { name: 'לבנות תוכנית חזרה, חינם' }).first().click();
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await page.fill('#w-name', 'דנה');
  for (const pick of [/^כיתה ח׳/, /^קצת מוכר/]) {
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: pick }).click();
  }
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await expect(page.getByText('כמה זמן ביום מתאים לכם?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'לתוכנית החזרה', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^בדיקת רמה קצרה/ })).toHaveCount(0);

  // a returning student: the same link opens Exam Rescue at once
  await openLanding(page, 'mivchan/', student('7'));
  await page.getByRole('link', { name: 'לבנות תוכנית חזרה, חינם' }).first().click();
  await expect(page).toHaveURL(/#\/rescue$/);
  await expect(page.getByText('מתי המבחן?')).toBeVisible();
});

test('/pilot/: two weeks, one class, free; its button opens the teacher\'s way in (start=teacher, and role=teacher)', async ({ page }) => {
  const counted = await metrics(page);
  await openLanding(page, 'pilot/');
  await expect(page).toHaveTitle('פיילוט לכיתה · מדרגות');
  await expect(page.getByRole('heading', { level: 1, name: 'פיילוט של שבועיים בכיתה אחת. חינם.' })).toBeVisible();
  const cta = page.getByRole('link', { name: 'לפתוח כיתה' }).first();
  await expect(cta).toBeInViewport();
  // nothing about prices on the schools' page; the message for parents is there to copy, as plain text
  await expect(page.locator('body')).not.toContainText('₪');
  await expect(page.locator('#wa-text')).toHaveText('שלום, אני מנסה בכיתה שלנו אפליקציה לתרגול מתמטיקה בשם מדרגות. הקישור לכיתה יגיע מחר. אין צורך בהרשמה או במייל.');
  await expect(page.getByRole('link', { name: 'hello@example.test' }).first()).toHaveAttribute('href', 'mailto:hello@example.test');
  await expect.poll(() => counted).toEqual(['landing_view_pilot']);
  await shot(page, 'pilot');

  await cta.click();
  await expect(page).toHaveURL(/#\/\?start=teacher&src=pilot$/);
  // this build has no server: the teacher's way in (the school lane's TeacherStart) points to the full app, whose
  // address the build names (VITE_TEACHER_URL); with a server it opens a class
  await expect(page.getByRole('heading', { name: 'לוח המורה נמצא באתר המלא' })).toBeVisible();
  await expect.poll(() => counted).toEqual(['landing_view_pilot', 'landing_cta_pilot']);
  // back goes to the student's first screen
  await page.getByRole('button', { name: 'חזרה' }).click();
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();

  await openLanding(page, '#/?role=teacher');
  await expect(page.getByRole('heading', { name: 'לוח המורה נמצא באתר המלא' })).toBeVisible();
});

for (const scheme of ['light', 'dark']) {
  test(`both pages: text contrast in ${scheme}, a skip link first, and no sideways scroll at 320`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ['mivchan/', 'pilot/']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await openLanding(page, path);
      const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(paper).toBe(scheme === 'dark' ? 'rgb(15, 17, 21)' : 'rgb(255, 255, 255)');
      // the whole page at once: a phone's width, tall enough that every line is on screen
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: 390, height });
      await expectTextContrast(page, `${path} ${scheme}`);
      await page.setViewportSize({ width: 320, height: 568 });
      await expectNoSidewaysScroll(page);
      // the keyboard: the skip link comes first and takes focus to the content
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: 'דילוג לתוכן העיקרי' });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(page.locator('main#main')).toBeFocused();
      // every press target is at least 44px tall
      const small = await page.evaluate(() => [...document.querySelectorAll('main a, footer a')].filter((a) => a.getBoundingClientRect().height < 44).map((a) => a.textContent.trim()));
      expect(small, `${path}: links under 44px`).toEqual([]);
    }
  });
}
