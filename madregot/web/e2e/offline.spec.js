// Offline (DURABLE-10): after one visit online, the council's offline probe passes. With the network gone, the
// profile, Settings, a lesson, a teaching stage and Exam Rescue all open, a reload still loads the app, and a calm
// line says there is no internet. The only spec file that lets the service worker run (the others block it).
import { test, expect } from '@playwright/test';
import { open, livedIn } from './helpers.js';

test.use({ serviceWorkers: 'allow' });
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'one phone is enough for the offline probe'); });

/** The number of files the built worker keeps, from its own list. */
async function precacheCount(request) {
  const sw = await (await request.get('sw.js')).text();
  return JSON.parse(/self\.__PRECACHE = (\[.*\]);/.exec(sw)[1]).length;
}

test('after one visit online, every main screen and a reload work offline', async ({ page, context, request }) => {
  const kept = await precacheCount(request);
  expect(kept).toBeGreaterThan(40);
  await open(page, '#/', livedIn());
  // the worker is installed (every file kept), active, and in control of the page
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const name = (await caches.keys()).find((n) => n.startsWith('madregot-'));
    return name ? (await (await caches.open(name)).keys()).length : 0;
  })).toBe(kept);
  await expect(page.locator('.offline-chip')).toHaveCount(0);

  await context.setOffline(true);
  // the network is really gone, for the worker too: a file it does not keep cannot be fetched
  expect(await page.evaluate(() => fetch('manifest.webmanifest?not-kept').then(() => 'fetched', () => 'failed'))).toBe('failed');
  await expect(page.locator('.offline-chip')).toHaveText('אין אינטרנט כרגע. אפשר להמשיך לתרגל, והכול יישמר.');

  const screens = [
    ['#/me', page.locator('#profile-name')],
    ['#/settings', page.getByRole('heading', { level: 1, name: 'הגדרות' })],
    ['#/lesson/signed/1', page.locator('#qtext')],
    ['#/learn/signed/1/A', page.locator('.step-player')],
    ['#/rescue', page.getByText('מתי המבחן?')],
  ];
  for (const [route, sign] of screens) {
    await page.goto(`./${route}`);
    await expect(sign, route).toBeVisible();
    await expect(page.locator('.error-screen'), route).toHaveCount(0);
  }

  // a reload with no network: the worker answers with the saved app
  await page.goto('./#/');
  await page.reload();
  await expect(page.locator('.learn-top')).toBeVisible();
  await expect(page.locator('.offline-chip')).toBeVisible();
  await expect(page.locator('.error-screen')).toHaveCount(0);

  // back online: the line goes away by itself
  await context.setOffline(false);
  await expect(page.locator('.offline-chip')).toHaveCount(0);
});

test('the offline line also sits at the top of the assistant', async ({ page, context }) => {
  await open(page, '#/assistant', livedIn());
  await context.setOffline(true);
  await expect(page.locator('.assistant-page .offline-chip')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'אין אינטרנט כרגע' })).toHaveCount(1);
});
