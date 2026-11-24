// The app can be installed (DURABLE-3): the manifest has the fields an install needs, and every icon it names (and the
// Home Screen icon in index.html) is a real PNG of the size it says, read from the file's own header.
import { test, expect } from '@playwright/test';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'the files are the same on every screen size'); });

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf) {
  expect(buf.subarray(0, 8).toString('hex'), 'a PNG file').toBe('89504e470d0a1a0a');
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

test('the manifest has the install fields, and each icon loads at its stated size', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').evaluate((el) => el.href);
  const res = await request.get(href);
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m).toMatchObject({
    name: 'מדרגות', short_name: 'מדרגות', lang: 'he', dir: 'rtl', start_url: './#/', scope: './', display: 'standalone',
    background_color: '#FFFFFF', theme_color: '#FFFFFF',
  });
  const purposes = m.icons.map((i) => `${i.sizes}:${i.purpose || 'any'}`).sort();
  expect(purposes).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
  for (const icon of m.icons) {
    expect(icon.type).toBe('image/png');
    const img = await request.get(new URL(icon.src, href).href);
    expect(img.status(), icon.src).toBe(200);
    expect(pngSize(await img.body()), icon.src).toBe(icon.sizes);
  }
  // the browser itself reads the same files
  const loaded = await page.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode(); return `${im.naturalWidth}x${im.naturalHeight}`;
  }, new URL(m.icons[0].src, href).href);
  expect(loaded).toBe('192x192');
});

test('index.html links the Home Screen icon and name for iPhone', async ({ page, request }) => {
  await page.goto('./');
  const touch = await page.locator('link[rel="apple-touch-icon"]').evaluate((el) => el.href);
  const img = await request.get(touch);
  expect(img.status()).toBe(200);
  expect(pngSize(await img.body())).toBe('180x180');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'מדרגות');
});

test('the icons kept for later stages are there: three shortcuts and the notification badge', async ({ request }) => {
  for (const name of ['sc-today-96', 'sc-quests-96', 'sc-rescue-96', 'badge-96']) {
    const img = await request.get(`icons/${name}.png`);
    expect(img.status(), name).toBe(200);
    expect(pngSize(await img.body()), name).toBe('96x96');
  }
});
