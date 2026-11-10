// The whole app offline, and updates that never reload a lesson (DURABLE-10), with the service worker allowed (every
// other spec blocks it, playwright.config.js):
//   - after one visit online, a class student goes offline: the profile, Settings, a lesson, a teaching stage and Exam
//     Rescue open (no error screen, each with its heading); a reload with no connection opens the app; the map says
//     calmly that there is no connection; an answer given offline reaches the class server once the connection is back;
//     the restore screen and the parents' area say they need the connection;
//   - two releases (the e2e build, and one more built here with another VITE_RELEASE), served from a small server of the
//     test's own on port 4203 that switches from the first to the second: the new worker waits; in a lesson, 31
//     minutes away and back reloads nothing; on the map it does, and the page runs the new release (window.__RELEASE).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { student, open, item, answer, appReady, NOW } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';

test.use({ serviceWorkers: 'allow' });

const WEB = fileURLToPath(new URL('..', import.meta.url));
const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const classStudent = () => ({
  ...student('7', {
    ai: { mode: 'server', apiUrl: API, key: '', device: '' },
    profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' },
    days: { '2026-11-04': { lessons: 2, xp: 25, q: 16, ok: 12 } }, xp: 25,
  }),
  version: 3,
});

/** Screenshots for the evidence folder (DURABLE_SHOTS=<folder>); nothing is compared. */
async function shot(page, name) {
  const dir = process.env.DURABLE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700); // a screen's entrance ends
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png` });
}

/** The worker controls the page, and its cache holds the whole precache list. */
async function cached(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  const want = await page.evaluate(async () => {
    const text = await (await fetch('sw.js', { cache: 'no-store' })).text();
    return JSON.parse(/^self\.__PRECACHE = (.*);\n/.exec(text)[1]);
  });
  expect(want).toContain('index.html');
  await expect.poll(() => page.evaluate(async (list) => {
    const name = (await caches.keys()).find((k) => k.startsWith('madregot-'));
    if (!name) return 0;
    const c = await caches.open(name);
    let n = 0;
    for (const p of list) if (await c.match(new URL(p, location.href).href)) n += 1;
    return n;
  }, want), { timeout: 30_000 }).toBe(want.length);
  return want.length;
}
const go = (page, hash) => page.evaluate((h) => { window.location.hash = h; }, hash);

test.describe('offline', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('after one visit, every screen opens offline, a reload works, and an answer given offline reaches the class', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const { st } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', classStudent());
    await cached(page);
    const answersBefore = st.answers.length;

    await page.context().setOffline(true);
    const chip = page.getByRole('status').filter({ hasText: 'אין אינטרנט כרגע. אפשר להמשיך לתרגל, והכול יישמר.' });
    await expect(chip).toBeVisible();
    // each screen's own title (Exam Rescue's first visit is its setup questions, which have a progress bar and no h1)
    const titles = {
      '#/me': page.getByRole('heading', { level: 1, name: 'נועה' }),
      '#/settings': page.getByRole('heading', { level: 1, name: 'הגדרות' }),
      '#/lesson/signed/1': page.locator('h1#qtext'),
      '#/learn/signed/1/A': page.locator('.step-player h1'),
      '#/rescue': page.getByRole('heading', { level: 1, name: 'מציל המבחנים' }).or(page.getByRole('progressbar', { name: 'פרטי המבחן' })),
    };
    for (const [hash, title] of Object.entries(titles)) {
      await go(page, hash);
      await expect(title, hash).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.error-screen'), hash).toHaveCount(0);
      if (hash === '#/me') await shot(page, 'offline-me');
    }

    // a reload with no connection: the worker serves the app
    await go(page, '#/');
    await page.reload();
    await appReady(page);
    await expect(page.locator('.learn')).toBeVisible();
    await expect(chip).toBeVisible();
    expect((await chip.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'offline-learn');
    // the assistant says it too
    await go(page, '#/assistant');
    await expect(chip).toBeVisible();
    await shot(page, 'offline-assistant');

    // an answer offline: kept in the outbox
    await go(page, '#/lesson/signed/1');
    await expect.poll(() => item(page)).toBeTruthy();
    await answer(page, true);
    await expect(page.locator('section.fb')).toBeVisible();
    await shot(page, 'offline-lesson');
    await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.outbox.length))).toBeGreaterThan(0);
    expect(st.answers.length).toBe(answersBefore);

    // what needs the connection says so
    await go(page, '#/restore');
    await expect(page.getByText('כדי להמשיך צריך חיבור לאינטרנט.')).toBeVisible();
    await shot(page, 'offline-restore');
    await go(page, '#/parents/info');
    await expect(page.getByText('כדי להמשיך צריך חיבור לאינטרנט.')).toBeVisible();

    // back online: the answer reaches the class, and the chip goes
    await go(page, '#/');
    await page.context().setOffline(false);
    await expect.poll(() => st.answers.length, { timeout: 20_000 }).toBeGreaterThan(answersBefore);
    await expect(chip).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------- updates
const PORT = Number(process.env.SW_E2E_PORT) || 4203;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
/** A static server of the test's own, whose folder can change (a new release deployed). */
function releaseServer(root) {
  const state = { root };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(state.root, path === '/' ? 'index.html' : path));
    if (!file.startsWith(state.root) || !existsSync(file) || statSync(file).isDirectory()) file = join(state.root, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(readFileSync(file));
  });
  return { state, listen: () => new Promise((done) => server.listen(PORT, '127.0.0.1', done)), close: () => new Promise((done) => server.close(done)) };
}
const hide = (page) => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
const show = (page) => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
});

test.describe('updates', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  test.skip(({ viewport }) => viewport.width !== 390, 'one project builds the second release');

  test('a new release waits: no reload in a lesson; on the map after 30 minutes away, the page runs the new release', async ({ page }) => {
    test.setTimeout(420_000);
    const first = join(WEB, 'dist-test');
    const next = join(WEB, 'test-results', 'sw-next');
    // the second release: the same build with another name
    execFileSync('npx', ['vite', 'build', '--base', './', '--outDir', next, '--emptyOutDir', '--logLevel', 'warn'], {
      cwd: WEB, env: { ...process.env, VITE_API_URL: 'none', VITE_RELEASE: 'e2e-next' }, stdio: 'pipe', timeout: 300_000,
    });
    const srv = releaseServer(first);
    await srv.listen();
    try {
      const url = `http://127.0.0.1:${PORT}/`;
      await page.clock.setFixedTime(NOW);
      await page.goto(url);
      await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('madregot-debug', '1'); localStorage.setItem('madregot-seed', '424242'); localStorage.setItem('madregot', JSON.stringify(s)); }, student('7'));
      await page.reload();
      await appReady(page);
      await cached(page);
      const firstRelease = await page.evaluate(() => window.__RELEASE);
      expect(firstRelease).toBeTruthy();
      expect(firstRelease).not.toBe('e2e-next');

      // the second release is deployed; the browser finds it, and its worker waits
      srv.state.root = next;
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
      await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), { timeout: 60_000 }).toBe(true);

      // in a lesson: 31 minutes away and back, and nothing reloads
      await go(page, '#/lesson/signed/1');
      await expect.poll(() => item(page)).toBeTruthy();
      await page.evaluate(() => { window.__stay = 1; });
      await hide(page);
      await page.clock.setFixedTime(new Date(NOW.getTime() + 31 * 60_000));
      await show(page);
      await page.waitForTimeout(2000);
      expect(await page.evaluate(() => [window.__stay, window.__RELEASE])).toEqual([1, firstRelease]);

      // on the map: the same, and the page reloads into the new release
      await go(page, '#/');
      await expect(page.locator('.learn')).toBeVisible();
      await hide(page);
      await page.clock.setFixedTime(new Date(NOW.getTime() + 62 * 60_000));
      await show(page);
      await expect.poll(() => page.evaluate(() => window.__RELEASE).catch(() => null), { timeout: 30_000 }).toBe('e2e-next');
      expect(await page.evaluate(() => window.__stay)).toBeUndefined();
      await appReady(page);
      await expect(page.locator('.learn')).toBeVisible();
      // only the new release's cache is left
      expect(await page.evaluate(() => caches.keys())).toEqual(['madregot-e2e-next']);
    } finally {
      await srv.close();
    }
  });
});
