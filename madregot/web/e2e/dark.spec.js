// Dark mode (STUDENT-2): the app follows the phone, the student's explicit choice wins and holds from the first paint,
// every screen stays readable (text 4.5:1, control edges 3:1) in both themes, and printouts stay black on white.
// DARK_SHOTS=<folder> also saves a picture of each screen in each theme (the proof pairs in qa-evidence/student/dark/).
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { open, openOn, student, livedIn, answer } from './helpers.js';
import { expectTextContrast, expectNonTextContrast, focusRingPair } from './contrast.js';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'dark mode is checked on one phone (phone-dark holds its pictures)'); });

const DARK_BG = 'rgb(15, 17, 21)';
const LIGHT_BG = 'rgb(255, 255, 255)';
const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function shot(page, name) {
  const dir = process.env.DARK_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false, animations: 'disabled' });
}

// a teacher with a class, on a fake server that answers the dashboard (no Worker, no real data)
const API = 'https://api.madregot.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const teacher = () => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7' }], active: 'K7Q2MD' } }), version: 3 });
async function teacherServer(page) {
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(data) });
    if (path === '/api/teacher/dashboard') {
      return json({
        class: { name: 'ז׳3', grade: '7', teacherName: 'רונית' }, joinLocked: false, help: [], mistakes: [], exams: [],
        students: [{ id: 'a1', name: 'דנה' }, { id: 'b2', name: 'יואב' }].map((s) => ({ ...s, lastPractice: '2026-11-05T08:00:00Z', today: { n: 3 }, week: { n: 10, first: 8, days: 2 }, levels: {}, pinReset: false })),
      });
    }
    if (path === '/api/teacher/licence') return json({ status: 'none', until: null, seats: null, students: 2, aiWeek: 0, joinLocked: false, request: null, legacyUntil: null, offer: { seatYearAgorot: 4900, minSeats: 10, vatMode: 'included', online: true } });
    if (path === '/api/ai/status') return json({ paywall: true, tier: 'free', kinds: ['explain', 'chat'], groups: { tutor: { left: 5, limit: 5 } }, aiReady: true });
    return route.fulfill({ status: 404, contentType: 'application/json', headers: CORS, body: '{"error":"not_found"}' });
  });
}

// the nine screens of the spec: [name, route, saved state, what shows the screen is there]
const SCREENS = [
  ['welcome', '#/', () => null, '.wordmark'],
  ['learn', '#/', () => livedIn('7'), '.learn-top'],
  ['lesson', '#/lesson/signed/1', () => student('7'), '#qtext'],
  ['teaching-step', '#/learn/signed/1/A', () => student('7'), '.teach'],
  ['quests', '#/quests', () => livedIn('7'), '.page-hero-title'],
  ['me', '#/me', () => livedIn('7'), '.profile-name'],
  ['settings', '#/settings', () => livedIn('7'), '#look-title'],
  ['parents', '#/parents', () => null, 'h1'],
  ['teacher', '#/teacher', teacher, 'h1'],
];

for (const scheme of ['dark', 'light']) {
  for (const [name, route, state, ready] of SCREENS) {
    test(`${name} in ${scheme}: the page colour, text at AA and edges at 3:1`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      if (name === 'teacher') await teacherServer(page);
      await open(page, route, state());
      await expect(page.locator(ready).first()).toBeVisible();
      await expect(page.getByText('טוענים…')).toHaveCount(0);
      expect(await bodyBg(page)).toBe(scheme === 'dark' ? DARK_BG : LIGHT_BG);
      await expectTextContrast(page, `(${name}, ${scheme})`);
      const extra = [];
      if (name === 'settings') {
        // the focus ring on a control, reached with the keyboard
        await page.getByRole('radio', { name: 'כמו במכשיר' }).focus();
        await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        extra.push(await focusRingPair(page));
      }
      const pairs = await expectNonTextContrast(page, extra);
      if (name === 'learn') expect(pairs.some((p) => p.what.startsWith('stop')), 'the stops were measured').toBe(true);
      if (name === 'settings') expect(pairs.some((p) => p.what.startsWith('checked seg')), 'the checked segment was measured').toBe(true);
      await shot(page, `${name}-${scheme}`);
    });
  }

  test(`the feedback sheet, good and not yet, in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openOn(page, '#/lesson/signed/1', student('7'), (it) => it.form === 'num');
    await answer(page, true);
    await expect(page.locator('section.fb-good')).toBeVisible();
    await expectTextContrast(page, `(feedback good, ${scheme})`);
    await shot(page, `feedback-good-${scheme}`);
    await openOn(page, '#/lesson/coord/1', student('7'), (it) => it.form === 'pt');
    await answer(page, false);
    await expect(page.locator('section.fb-retry')).toBeVisible();
    await expectTextContrast(page, `(feedback not yet, ${scheme})`);
    await shot(page, `feedback-retry-${scheme}`);
  });

  for (const [kind, route, grade] of [['numberline', 'signed/1', '7'], ['plot', 'coord/1', '7'], ['line', 'line/2', '8']]) {
    test(`the ${kind} exercise in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openOn(page, `#/lesson/${route}?part=1`, student(grade), (it) => it.form === 'manip' && it.manip.kind === kind);
      await expect(page.locator('.manip-canvas')).toBeVisible();
      await expectTextContrast(page, `(${kind}, ${scheme})`);
      await expectNonTextContrast(page);
      if (kind === 'line') {
        // m and b keep their colours in the equation (KaTeX), read from the theme's tokens: move the line until both show
        const coloured = '.manip-readout .katex [style*="color"]';
        for (const b of await page.locator('.manip .step-btn:not(:disabled)').all()) {
          if ((await page.locator(coloured).count()) >= 2) break;
          await b.click();
        }
        const inks = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => getComputedStyle(e).color), coloured);
        expect(inks.length).toBeGreaterThan(0);
        await expectTextContrast(page, `(line builder moved, ${scheme})`);
        const want = scheme === 'dark' ? ['rgb(255, 171, 92)', 'rgb(169, 144, 255)'] : ['rgb(168, 79, 0)', 'rgb(82, 50, 194)'];
        for (const c of inks) expect(want).toContain(c);
      }
      await shot(page, `${kind}-${scheme}`);
    });
  }
}

test('an explicit choice wins over the phone, holds from the first paint, and "כמו במכשיר" follows the phone again', async ({ page }) => {
  // what <html> says when the document is parsed, before the app's code has run
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { window.__themeAtLoad = document.documentElement.dataset.theme || 'none'; });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, '#/settings', livedIn('7'));
  expect(await bodyBg(page)).toBe(DARK_BG);
  await page.getByRole('radio', { name: 'בהיר' }).click();
  await expect(page.getByRole('radio', { name: 'בהיר' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG);
  expect(await page.evaluate(() => localStorage.getItem('madregot-theme'))).toBe('light');
  expect(await page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content))).toEqual(['#ffffff', '#ffffff']);
  await page.reload();
  expect(await page.evaluate(() => window.__themeAtLoad)).toBe('light');
  expect(await bodyBg(page)).toBe(LIGHT_BG);
  await expect(page.getByRole('radio', { name: 'בהיר' })).toHaveAttribute('aria-checked', 'true');

  // "כהה" under a light phone
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('radio', { name: 'כהה' }).click();
  await expect.poll(() => bodyBg(page)).toBe(DARK_BG);
  await page.reload();
  expect(await page.evaluate(() => window.__themeAtLoad)).toBe('dark');
  expect(await bodyBg(page)).toBe(DARK_BG);

  // back to the phone's setting: nothing is stored, and the page follows the media query both ways
  await page.getByRole('radio', { name: 'כמו במכשיר' }).click();
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG);
  expect(await page.evaluate(() => localStorage.getItem('madregot-theme'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => bodyBg(page)).toBe(DARK_BG);
  await page.reload();
  expect(await page.evaluate(() => window.__themeAtLoad)).toBe('none');
});

test('a practice sheet prints black on white in every theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, '#/exams/new', livedIn('7'));
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('button', { name: 'הכנת המבחן' }).click();
  await expect(page).toHaveURL(/#\/exams\/practice\//);
  expect(await bodyBg(page)).toBe(DARK_BG);
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG);
  const ink = await page.evaluate(() => getComputedStyle(document.body).color);
  expect(ink).toBe('rgb(20, 22, 26)');
  // the student chose "כהה" explicitly
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG);
  await page.emulateMedia({ media: 'screen', colorScheme: 'light' });
  await expect.poll(() => bodyBg(page)).toBe(DARK_BG);
});
