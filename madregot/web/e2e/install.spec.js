// The install offer on Android and desktop (STUDENT-10). Chrome's beforeinstallprompt is played by an init script: a
// synthetic event with a stub prompt() that counts its calls, dispatched on every load. The offer comes as the last
// screen after a lesson from the second learning day, never on the first, never in a store app or the installed app;
// Settings always has the row while the browser offers it. The manifest's shortcuts and screenshots, and "today's lesson"
// (?go=today).
// The clock is fixed on Thursday 5 November 2026 (helpers.js NOW).
import { test, expect } from '@playwright/test';
import { open, student, answer, proceedToNext, saved, expectUsable } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'Chrome\'s install prompt, on the phone'); });

/** Chrome's install event, played: a stub prompt() that counts, the person's choice; optionally the installed app. */
async function stubInstall(page, { standalone = false, outcome = 'accepted' } = {}) {
  await page.addInitScript(([sa, out]) => {
    window.__prompted = 0;
    if (sa) {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q === '(display-mode: standalone)'
        ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
        : real(q));
    }
    window.addEventListener('load', () => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => { window.__prompted += 1; return Promise.resolve(); };
      e.userChoice = Promise.resolve({ outcome: out, platform: 'web' });
      window.dispatchEvent(e);
    });
  }, [standalone, outcome]);
}
const prompted = (page) => page.evaluate(() => window.__prompted);

/** Wednesday 4 November learned: a lesson today makes the second learning day. */
const yesterday = { '2026-11-04': { lessons: 1, xp: 12, q: 8, ok: 7 } };

async function playLesson(page) {
  await expect.poll(() => page.evaluate(() => window.__madregotItem)).toBeTruthy();
  for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen .stats')).toBeVisible();
}

/** Press on through the screens after a lesson until the install offer or the map: which one came. */
async function walkEndScreens(page) {
  const heading = () => page.locator('.done-screen h1').first().textContent({ timeout: 1000 }).catch(() => null);
  for (let k = 0; k < 8; k += 1) {
    // a screen that loads on demand shows an empty frame first: wait for one with something to press, or the map
    await expect(page.locator('.install-stage, .learn-top, .done-screen .done-actions .btn').first()).toBeVisible();
    if (await page.locator('.install-stage').isVisible()) return 'install';
    if (await page.locator('.learn-top').isVisible()) return 'map';
    const before = await heading();
    await page.locator('.done-screen .done-actions .btn').first().click();
    await expect.poll(async () => { const now = await heading(); return now === null || now !== before; }, { timeout: 5000 }).toBe(true);
  }
  throw new Error('more screens after a lesson than expected');
}

test('from the second learning day, the last screen after a lesson offers the install; "להתקין" opens the browser\'s prompt', async ({ page }) => {
  await stubInstall(page);
  await open(page, '#/lesson/signed/1', student('7', { days: yesterday }));
  await playLesson(page);
  expect(await walkEndScreens(page)).toBe('install');
  const card = page.locator('.install-stage');
  await expect(card.getByRole('heading', { level: 1 })).toHaveText('מדרגות במסך הבית');
  await expect(card.locator('.install-text')).toHaveText('פותחים בלחיצה, עובד גם בלי אינטרנט, וההתקדמות נשמרת טוב יותר.');
  const yes = card.getByRole('button', { name: 'להתקין', exact: true });
  await expectUsable(page, yes, 'the install button');
  await expectUsable(page, card.getByRole('button', { name: 'לא עכשיו', exact: true }), 'not now');
  for (const b of await card.getByRole('button').all()) expect((await b.boundingBox()).height, await b.textContent()).toBeGreaterThanOrEqual(44);
  await expect(yes).toBeFocused();
  // no price, no timer, nothing to lose on a child's screen
  await expect(card).not.toContainText(/₪|שקל|נשאר|עוד \d+ (שניות|דקות)|תפספסו/);
  // one of the two offers is used, and it is set aside from today
  expect((await saved(page)).nudges).toMatchObject({ installOffers: 1, installDismissedAt: '2026-11-05' });
  // a second tap while the browser's prompt is up does nothing; once accepted the button says the install started
  await yes.dblclick();
  await expect.poll(() => prompted(page)).toBe(1);
  await expect(card.getByRole('button', { name: 'ההתקנה התחילה', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.learn-top')).toBeVisible();
  expect(await prompted(page)).toBe(1);
  // the browser installs: a calm toast says where the app is now
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByText('מדרגות הותקנה. אפשר לפתוח אותה ממסך הבית.')).toBeVisible();
});

test('"לא עכשיו" goes on to the map, and the next lesson that day does not offer it again', async ({ page }) => {
  await stubInstall(page, { outcome: 'dismissed' });
  await open(page, '#/lesson/signed/1', student('7', { days: yesterday }));
  await playLesson(page);
  expect(await walkEndScreens(page)).toBe('install');
  await page.locator('.install-stage').getByRole('button', { name: 'לא עכשיו', exact: true }).click();
  await expect(page.locator('.learn-top')).toBeVisible();
  expect(await prompted(page)).toBe(0);
  // 30 days apart: a second lesson today ends on the map
  await page.goto('./#/lesson/signed/1');
  await playLesson(page);
  expect(await walkEndScreens(page)).toBe('map');
  expect((await saved(page)).nudges).toMatchObject({ installOffers: 1, installDismissedAt: '2026-11-05' });
});

test('the first learning day: no offer after the lesson; Settings has the row, and it opens the prompt', async ({ page }) => {
  await stubInstall(page);
  await open(page, '#/lesson/signed/1', student('7'));
  await playLesson(page);
  expect(await walkEndScreens(page)).toBe('map');
  expect((await saved(page)).nudges.installOffers || 0).toBe(0);
  await page.goto('./#/settings');
  const row = page.getByRole('button', { name: 'להתקין את האפליקציה', exact: true });
  await row.scrollIntoViewIfNeeded();
  await expectUsable(page, row, 'the install row');
  expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await row.click();
  await expect.poll(() => prompted(page)).toBe(1);
  // the browser gives one prompt: the row goes once it is used
  await expect(row).toHaveCount(0);
});

test('a Play Store app (?src=play, running standalone) never offers the install, after a lesson or in Settings', async ({ page }) => {
  await stubInstall(page, { standalone: true });
  await open(page, '#/lesson/signed/1?src=play', student('7', { days: yesterday }));
  expect(await page.evaluate(() => localStorage.getItem('madregot-src'))).toBe('play');
  await playLesson(page);
  expect(await walkEndScreens(page)).toBe('map');
  await page.goto('./#/settings');
  await expect(page.locator('.settings .set-head').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'להתקין את האפליקציה' })).toHaveCount(0);
});

test('a Chrome tab that once saw ?src=play is no store app: Settings offers the install there', async ({ page }) => {
  await stubInstall(page);
  await open(page, '#/settings?src=play', student('7'));
  expect(await page.evaluate(() => localStorage.getItem('madregot-src'))).toBe('play');
  await expect(page.getByRole('button', { name: 'להתקין את האפליקציה', exact: true })).toBeVisible();
});

test('the manifest has an id, a description, three shortcuts with their icons, and focuses an open app', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').evaluate((el) => el.href);
  const m = await (await request.get(href)).json();
  expect(m).toMatchObject({
    id: './', description: 'תרגול מתמטיקה יומי לכיתות ז׳ וח׳, בעברית.', categories: ['education'],
    launch_handler: { client_mode: 'focus-existing' },
  });
  expect(m.shortcuts.length).toBe(3);
  expect(m.shortcuts.map((s) => [s.name, s.url])).toEqual([['השיעור של היום', './#/?go=today'], ['משימות', './#/quests'], ['מבחן קרוב', './#/rescue']]);
  for (const s of m.shortcuts) {
    const img = await request.get(new URL(s.icons[0].src, href).href);
    expect(img.status(), s.icons[0].src).toBe(200);
    const buf = await img.body();
    expect(buf.subarray(0, 8).toString('hex'), 'a PNG file').toBe('89504e470d0a1a0a');
    expect(`${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`).toBe(s.icons[0].sizes);
  }
});

test('the manifest has four screenshots (three for a phone, one for a computer), each loading at its stated size', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').evaluate((el) => el.href);
  const m = await (await request.get(href)).json();
  expect(m.screenshots.map((s) => [s.src, s.sizes, s.form_factor])).toEqual([
    ['screens/narrow-1.png', '1080x2340', 'narrow'], ['screens/narrow-2.png', '1080x2340', 'narrow'],
    ['screens/narrow-3.png', '1080x2340', 'narrow'], ['screens/wide-1.png', '1920x1080', 'wide'],
  ]);
  for (const s of m.screenshots) {
    expect(s.type).toBe('image/png');
    expect(s.label, s.src).toMatch(/[\u0590-\u05FF]/); // a Hebrew label: the install sheet reads it aloud
    const img = await request.get(new URL(s.src, href).href);
    expect(img.status(), s.src).toBe(200);
    const buf = await img.body();
    expect(buf.subarray(0, 8).toString('hex'), 'a PNG file').toBe('89504e470d0a1a0a');
    expect(`${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`, s.src).toBe(s.sizes);
    // the browser decodes it at that size too
    expect(await page.evaluate(async (src) => {
      const im = new Image(); im.src = src; await im.decode(); return `${im.naturalWidth}x${im.naturalHeight}`;
    }, new URL(s.src, href).href)).toBe(s.sizes);
  }
});

test('"today\'s lesson" (?go=today) opens what the mission\'s button opens, and fixes the day\'s mission as the card does', async ({ page }) => {
  const at = (to) => new RegExp(`#${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  await open(page, '#/?go=today', student('7'));
  await expect(page).not.toHaveURL(/go=today/);
  // the shortcut built today's mission and saved it, as TodayCard does when it shows it
  const items = (await saved(page)).learn.missions['2026-11-05'].items;
  expect(items.length).toBeGreaterThan(0);
  await expect(page).toHaveURL(at(items[0].to));
  // the address was replaced: Back does not land on the shortcut again
  await page.goBack();
  await expect(page).not.toHaveURL(/go=today/);
  // the missions tab's button opens the same place, and the mission was not built again
  await page.goto('./#/quests');
  await page.locator('.continue-go').click();
  await expect(page).toHaveURL(at(items[0].to));
  expect((await saved(page)).learn.missions['2026-11-05'].items).toEqual(items);
});
