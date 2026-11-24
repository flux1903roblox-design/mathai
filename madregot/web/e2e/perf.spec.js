// The timing test (DURABLE-11, tag @perf): the app on a slow phone, as Lighthouse's mobile profile has it. Chrome's
// CPU slowed 4x, the network at 150 ms latency, 1.6 Mbit/s down and 750 kbit/s up, and the build served gzipped by
// scripts/serve-gzip.mjs (vite preview does not compress). It measures the first contentful paint and the largest
// contentful paint (PerformanceObserver), the longest task while the app starts, and a second visit with the service
// worker for the repeat LCP. It writes test-results/perf.json and fails over web/budget.json's timing × 1.1.
//
// It runs only with PERF=1 (the nightly workflow .github/workflows/perf.yml, or by hand), so the ordinary phone suite
// stays steady on a shared machine:  PERF=1 npx playwright test -c e2e/playwright.config.js --project=phone --grep @perf
// It measures the e2e build (dist-test); PERF_DIST=<folder> measures another build (an older release, to compare).
import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveGzip } from '../scripts/serve-gzip.mjs';
import { livedIn, NOW } from './helpers.js';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PERF_PORT) || 4204;
const BUDGET = JSON.parse(readFileSync(new URL('../budget.json', import.meta.url), 'utf8')).timing;
const SLACK = 1.1;

test.use({ serviceWorkers: 'allow' });

/** Collects the paints and the long tasks from the very start of the page. */
function observe() {
  window.__perf = { fcp: null, lcp: null, longest: 0 };
  const on = (type, fn) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch { /* not supported */ } };
  on('paint', (e) => { if (e.name === 'first-contentful-paint') window.__perf.fcp = e.startTime; });
  on('largest-contentful-paint', (e) => { window.__perf.lcp = e.startTime; });
  on('longtask', (e) => { window.__perf.longest = Math.max(window.__perf.longest, e.duration); });
}

async function slowPhone(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return cdp;
}

/** One visit (a new page load: `url`, or a reload): wait until the map is drawn and the page is quiet, then read it. */
async function visit(page, url) {
  if (url) await page.goto(url, { waitUntil: 'load' }); else await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.learn')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000); // a late, larger paint still counts as the LCP
  return page.evaluate(() => ({ ...window.__perf }));
}

test.describe('@perf load time on a slow phone', () => {
  test.skip(!process.env.PERF, 'timing runs with PERF=1 (nightly), not in the ordinary suite');
  test.skip(({ viewport }) => viewport?.width !== 390, 'the phone project only');

  test('first visit and repeat visit within the budget @perf', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome DevTools Protocol throttling');
    test.setTimeout(240_000);
    const server = await serveGzip(process.env.PERF_DIST || `${WEB}dist-test`, PORT);
    try {
      const url = `http://127.0.0.1:${PORT}/#/`;
      await page.clock.setFixedTime(NOW);
      // a student with some history, saved before the page's own scripts run: the first visit starts cold
      await page.addInitScript((s) => { try { if (!localStorage.getItem('madregot')) localStorage.setItem('madregot', s); } catch { /* blocked */ } }, JSON.stringify(livedIn('7')));
      await page.addInitScript(observe);
      await slowPhone(page);

      const first = await visit(page, url);
      // the service worker takes the app in and keeps every file before the second visit
      await page.evaluate(() => navigator.serviceWorker.ready);
      await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('madregot-'))), { timeout: 120_000 }).toBe(true);
      await expect.poll(() => page.evaluate(async () => {
        const list = JSON.parse(/^self\.__PRECACHE = (.*);\n/.exec(await (await fetch('sw.js', { cache: 'no-store' })).text())[1]);
        const c = await caches.open((await caches.keys()).find((k) => k.startsWith('madregot-')));
        const have = await Promise.all(list.map((p) => c.match(new URL(p, location.href).href)));
        return have.every(Boolean);
      }), { timeout: 120_000 }).toBe(true);
      const repeat = await visit(page, null);

      const out = {
        at: new Date().toISOString(),
        release: await page.evaluate(() => window.__RELEASE || null),
        profile: { cpuSlowdown: 4, latencyMs: 150, downBytesPerSec: 200_000, upBytesPerSec: 93_750, served: 'gzip level 9 (scripts/serve-gzip.mjs)' },
        note: process.env.PERF_NOTE || (process.env.CI ? 'GitHub Actions runner' : 'local run'),
        first: { fcpMs: Math.round(first.fcp), lcpMs: Math.round(first.lcp), longestBootTaskMs: Math.round(first.longest) },
        repeat: { fcpMs: Math.round(repeat.fcp), lcpMs: Math.round(repeat.lcp) },
        budget: BUDGET, slack: SLACK,
      };
      mkdirSync(`${WEB}test-results`, { recursive: true });
      writeFileSync(`${WEB}test-results/perf.json`, `${JSON.stringify(out, null, 2)}\n`);
      console.log(JSON.stringify(out));

      expect(first.fcp, 'first contentful paint').toBeLessThanOrEqual(BUDGET.fcpMs * SLACK);
      expect(first.lcp, 'largest contentful paint').toBeLessThanOrEqual(BUDGET.lcpMs * SLACK);
      expect(first.longest, 'the longest task while the app starts').toBeLessThanOrEqual(BUDGET.longestBootTaskMs * SLACK);
      expect(repeat.lcp, 'largest contentful paint on a repeat visit').toBeLessThanOrEqual(BUDGET.repeatLcpMs * SLACK);
    } finally {
      await new Promise((done) => server.close(done));
    }
  });
});
