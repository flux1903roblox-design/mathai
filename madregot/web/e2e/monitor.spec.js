// Error reports with no third party (DURABLE-9), in a real browser: a screen that breaks (the QA hook ?qa-throw=render
// makes the profile throw) shows the app's error screen, the server receives one report of kind 'render' for the route
// pattern '/me' (no values, nothing personal), and Settings › מידע לתמיכה lists it from the copy kept on the device.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { open, student } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';

const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const QA_MESSAGE = 'QA: a test error while the profile renders';
/** Saved as a v3 save, so the server address is kept (as class-sync.spec.js does). */
const withServer = () => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' } }), version: 3 });

/** Screenshots for the evidence folder (DURABLE_SHOTS=<folder>); nothing is compared. */
async function shot(page, name) {
  const dir = process.env.DURABLE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png` });
}

test.describe('error reports', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('a screen that breaks: the error screen, one report to the server, and the details in Settings', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    // opened first, then the profile inside the app: the page is not reloaded between the error and its report
    await open(page, '#/', withServer());
    await page.evaluate(() => { window.location.hash = '#/me?qa-throw=render'; });
    // the app's own words, and the ways out
    await expect(page.getByRole('heading', { name: 'משהו במסך הזה לא עבד' })).toBeVisible();
    await expect(page.getByText('ההתקדמות שלכם שמורה במכשיר.')).toBeVisible();
    await shot(page, 'error-screen');
    // sent within the 10 s the monitor gathers reports in, once
    await expect.poll(() => st.errors.length, { timeout: 15_000 }).toBe(1);
    const report = st.errors[0];
    expect(report.v).toBe(1);
    expect(report.release).toMatch(/^[A-Za-z0-9._-]{1,20}$/);
    expect(report.items).toHaveLength(1);
    const [it] = report.items;
    expect(it).toMatchObject({ kind: 'render', route: '/me', message: QA_MESSAGE, n: 1 });
    expect(it.name).toMatch(/^Error(@\w+)?$/);
    expect(it.agent).toMatch(/^android-chrome-\d+$|^desktop-chrome$|^other$/);
    // nothing of the student and nothing of the address in it
    expect(JSON.stringify(report)).not.toMatch(/נועה|qa-throw|127\.0\.0\.1/);
    const post = log.find((r) => r.path === '/api/errors');
    expect(post.headers['content-type']).toMatch(/^text\/plain/); // no CORS preflight
    expect(log.filter((r) => r.path === '/api/errors' && r.method === 'OPTIONS')).toHaveLength(0);
    await page.waitForTimeout(500);
    expect(st.errors).toHaveLength(1);

    // the details for support, from the copy kept on the device (after a reload, with no server needed for it)
    await page.goto('./#/settings');
    await page.reload();
    const support = page.locator('details.support-info');
    await support.locator('summary', { hasText: 'מידע לתמיכה' }).click();
    await expect(support.locator('.support-errors li')).toHaveCount(1);
    await expect(support.locator('.support-errors li')).toContainText('render');
    await expect(support.locator('.support-errors li')).toContainText(QA_MESSAGE);
    await expect(support).toContainText('גרסה');
    await expect(support).toContainText('מקום בשימוש');
    await expect(support).toContainText(/MB מתוך/);
    await support.scrollIntoViewIfNeeded();
    await shot(page, 'support-info');
    // copied as plain text, with no name
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseOf()).origin });
    await support.getByRole('button', { name: 'להעתיק לתמיכה' }).click();
    await expect(page.getByText('הועתק. אפשר להדביק במייל לתמיכה.')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('מדרגות · מידע לתמיכה');
    expect(copied).toContain(QA_MESSAGE);
    expect(copied).not.toContain('נועה');
  });

  test('no server: nothing is sent, and the device still keeps the report', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => { if (r.url().includes('/api/errors')) requests.push(r.url()); });
    await open(page, '#/', student('7'));
    await page.evaluate(() => { window.location.hash = '#/me?qa-throw=render'; });
    await expect(page.getByRole('heading', { name: 'משהו במסך הזה לא עבד' })).toBeVisible();
    await page.waitForTimeout(11_000);
    expect(requests).toHaveLength(0);
    await page.goto('./#/settings');
    await page.reload();
    await page.locator('details.support-info summary').click();
    await expect(page.locator('.support-errors li')).toContainText(QA_MESSAGE);
  });
});
