// A PDF under the production CSP (PKG-2, trust spec TRUST-5 §3). The other tests serve the build with vite preview,
// which sends no CSP at all; here scripts/serve-gzip.mjs serves the same build with its own _headers (public/_headers),
// as the real host does: the CSP on the page and on pdf.js's worker. A scanned page is often one JPEG 2000 picture,
// which pdf.js decodes with WebAssembly inside its worker, so the CSP must allow it ('wasm-unsafe-eval'); without it the
// picture is left out and the page comes out white. The fixture is synthetic (scripts/make-pdf-fixture.mjs: one A4 page,
// a grey band across the top where a name would be, 8 dark bars for lines of writing).
// - With the real headers: the page is drawn, its top 15% cut, and the bars are in the picture the server receives.
// - Where a browser still cannot decode the picture (the same CSP without 'wasm-unsafe-eval'): the calm message, no
//   PhotoPrep, nothing sent, and the family's exam check is not spent.
// The server listens on a free port of its own for each test. PKG_SHOTS=<folder> saves a picture of each state.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { serveGzip } from '../scripts/serve-gzip.mjs';
import { SCAN } from '../scripts/make-pdf-fixture.mjs';
import { NOW, DURABLE_DB, withServer, appReady, screenReady } from './helpers.js';
import { fakeServer, API, livePlan } from './fakeServer.js';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const DIST = process.env.CSP_DIST || `${WEB}dist-test`;
const SCAN_PDF = fileURLToPath(new URL('./fixtures/scan-jpx.pdf', import.meta.url));
const PDF_FAILED = 'לא הצלחנו לפתוח את ה־PDF. אפשר לצלם את הדפים במקום.';
const FD = `fd1.${'c'.repeat(64)}`;
const family = () => withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true, familyDevice: { token: FD, label: 'הטאבלט' } } });

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'one phone is enough: the same build and the same headers'); });

let server = null;
let base = '';
test.beforeEach(async () => {
  server = await serveGzip(DIST, 0);
  base = `http://127.0.0.1:${server.address().port}/`;
});
test.afterEach(async () => { await new Promise((done) => { server?.close(done); }); server = null; });

/** helpers.js open(), on this server: the saved state seeded, then the route, as the app starts. */
async function openAt(page, route, state) {
  await page.clock.setFixedTime(NOW);
  await page.goto(base);
  await page.evaluate(async ([s, db]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', '424242');
    localStorage.setItem('madregot', JSON.stringify(s));
    await new Promise((done) => { const r = indexedDB.deleteDatabase(db); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
  }, [state, DURABLE_DB]);
  await page.goto(`${base}${route}`);
  await page.reload();
  await appReady(page);
  await screenReady(page, route);
}
async function setUp(page) {
  const fake = await fakeServer(page, { parentOk: true }, base);
  fake.st.devices.push({ id: 'd1', label: 'הטאבלט', token: FD }); fake.st.plan = livePlan();
  return fake;
}
/** "תמונה או PDF", the warning in the picker's words, and the scanned PDF chosen. */
async function chooseScan(page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'תמונה או PDF' }).click();
  await page.getByRole('dialog', { name: 'לפני ששולחים דף' }).getByRole('button', { name: 'הבנתי, לבחור קובץ' }).click();
  await (await chooser).setFiles(SCAN_PDF);
}
const shot = async (page, name) => { if (process.env.PKG_SHOTS) await page.screenshot({ path: `${process.env.PKG_SHOTS}/${name}.png` }); };
/** The page as the server got it: its size and the colour of some pixels. */
const sentPixels = (page, src, points) => page.evaluate(async ([s, pts]) => {
  const img = new Image(); img.src = s; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return { width: c.width, height: c.height, px: pts.map(([px, py]) => [...x.getImageData(px, py, 1, 1).data].slice(0, 3)) };
}, [src, points]);

test('a scanned PDF (one JPEG 2000 picture) under the production CSP: drawn, its top cut, and the writing sent', async ({ page }) => {
  test.setTimeout(120_000);
  // the build's own headers, on the page and on pdf.js's worker
  const csp = (await page.request.get(base)).headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(csp).not.toContain("'unsafe-eval'");
  const workers = [];
  page.on('response', (r) => { if (/\/assets\/pdf\.worker\.min-[\w-]+\.mjs$/.test(r.url())) workers.push(r.headers()['content-security-policy']); });
  const violations = [];
  page.on('console', (m) => { if (/Content Security Policy|WebAssembly/i.test(m.text())) violations.push(m.text()); });
  const { log } = await setUp(page);
  await openAt(page, '#/exams/check', family());
  await chooseScan(page);
  const prep = page.getByRole('dialog', { name: 'מסתירים פרטים אישיים' });
  await expect(prep).toBeVisible({ timeout: 30_000 });
  await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '15');
  await shot(page, 'pdf-csp-jpx-prep');
  expect(workers.length).toBeGreaterThan(0);
  for (const h of workers) expect(h).toBe(csp);
  await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
  await expect(page.getByRole('img', { name: 'דף 1' })).toBeVisible();
  await page.getByRole('button', { name: 'בדיקת המבחן' }).click();
  await expect.poll(() => log.filter((r) => r.path === '/api/ai/exam').length).toBe(1);
  const sent = log.find((r) => r.path === '/api/ai/exam').body;
  expect(sent.pages.map((p) => p.mediaType)).toEqual(['image/jpeg']);
  // drawn at 1272 x 1800, then 15% (270 px) cut off the top: the grey band (the top 214 px) is gone with it
  const at = (x, y) => [Math.round((x * 1272) / SCAN.width), Math.round((y * 1800) / SCAN.height) - 270];
  const bar = SCAN.bars[3];
  const got = await sentPixels(page, sent.pages[0].data, [[10, 10], at(200, (bar.y0 + bar.y1) / 2), at(200, bar.y1 + 28)]);
  expect([got.width, got.height]).toEqual([1272, 1530]);
  expect(Math.min(...got.px[0]), `the top of the page as sent is ${got.px[0]}`).toBeGreaterThan(230);
  expect(Math.max(...got.px[1]), `a line of writing is ${got.px[1]}`).toBeLessThan(90);
  expect(Math.min(...got.px[2]), `between the lines is ${got.px[2]}`).toBeGreaterThan(230);
  expect(violations).toEqual([]);
});

test('a browser that cannot decode the picture (the CSP without \'wasm-unsafe-eval\'): the calm message, and nothing is sent', async ({ page }) => {
  test.setTimeout(120_000);
  // the same build and headers, with WebAssembly forbidden, on every file of the app (its page and pdf.js's worker)
  await page.context().route((url) => url.href.startsWith(base), async (route) => {
    const res = await route.fetch();
    const headers = res.headers();
    if (headers['content-security-policy']) headers['content-security-policy'] = headers['content-security-policy'].replace(" 'wasm-unsafe-eval'", '');
    await route.fulfill({ response: res, headers });
  });
  const { log } = await setUp(page);
  await openAt(page, '#/exams/check', family());
  await chooseScan(page);
  await expect(page.getByText(PDF_FAILED, { exact: true })).toBeVisible({ timeout: 30_000 });
  await shot(page, 'pdf-csp-blank');
  await expect(page.getByRole('dialog', { name: 'מסתירים פרטים אישיים' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'דף 1' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'בדיקת המבחן' })).toBeDisabled();
  expect(log.filter((r) => r.path === '/api/ai/exam')).toEqual([]);
});
