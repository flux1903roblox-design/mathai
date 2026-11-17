// The waitlist page for the store apps (/waitlist/ and its short address /w/, web/landing/waitlist.html, the Worker's
// worker/src/waitlist.js), built into dist-test by scripts/landing-build.mjs with the stand-in owner values of
// playwright.config.js; its form posts to API_BASE, answered by the fake server (fakeServer.js, /api/waitlist). On the two
// phones (390 and 320): the hook and the form in the first screen, the chips, every error tied to its field, the consent
// required, the signup with the ad's labels, the thank-you with no count in it and its share (the phone's sheet, else the
// link copied, else the link to copy by hand), the server's answers (too many, closed), the page without its script, and
// axe and contrast in light and dark. WAITLIST_SHOTS=<folder> saves screenshots of each state for a look.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, openLanding, expectNoSidewaysScroll } from './helpers.js';
import { fakeServer, FAKE_API } from './fakeServer.js';
import { expectNoAxeViolations } from './axe.js';
import { expectTextContrast } from './contrast.js';

test.skip(({ viewport }) => viewport.width > 800, 'the phone sizes');

const AD = 'waitlist/?utm_source=instagram&utm_campaign=launch';
const SHARE_URL = 'https://madregot.example.test/waitlist/?utm_source=share'; // PUBLIC_URL in playwright.config.js

async function shot(page, name, { full = false } = {}) {
  const dir = process.env.WAITLIST_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png`, fullPage: full });
}
/** The page from an ad, with the fake server answering; `over` sets its state ({ waitlistBusy, waitlistClosed }). */
async function open(page, path = AD, over = {}) {
  const server = await fakeServer(page, over);
  await openLanding(page, path);
  return server;
}
const signups = (log) => log.filter((l) => l.path === '/api/waitlist');
const form = (page) => page.locator('#wl-form');
const join = (page) => page.getByRole('button', { name: 'הצטרפו לרשימה', exact: true });
async function fill(page, { email = 'parent@example.test', role = 'הורה', grade = 'ח׳', phones = [], consent = true } = {}) {
  await page.getByRole('textbox', { name: 'המייל שלכם' }).fill(email);
  if (role) await page.getByRole('radio', { name: role, exact: true }).check();
  if (grade) await page.getByRole('radio', { name: grade, exact: true }).check();
  for (const p of phones) await page.getByRole('checkbox', { name: p, exact: true }).check();
  if (consent) await page.getByRole('checkbox', { name: 'אפשר לשלוח לי מייל אחד כשהאפליקציה יוצאת לחנויות' }).check();
}

test('the hook, what it is and the form are on the first screen; the view is counted; the quiet way into the browser app', async ({ page }) => {
  const { log } = await open(page);
  await expect(page).toHaveTitle('מבחן במתמטיקה מחר? · מדרגות');
  await expect(page.getByRole('heading', { level: 1, name: 'מבחן במתמטיקה מחר?' })).toBeInViewport();
  await expect(page.getByText('תרגול מתמטיקה לכיתות ז׳–ח׳ לפי תוכנית משרד החינוך, בעברית')).toBeInViewport();
  // the one action, in its working form: the email field is on the first screen
  await expect(page.getByRole('heading', { level: 2, name: 'רוצים לדעת כשהיא בחנויות?' })).toBeInViewport();
  await expect(page.getByRole('textbox', { name: 'המייל שלכם' })).toBeInViewport();
  await expect(join(page)).toHaveCount(1);
  // every Latin word and number in the Hebrew is isolated left to right
  for (const t of ['iPhone', 'Android', '13']) expect(await page.locator('main bdi[dir="ltr"]').filter({ hasText: new RegExp(`^${t}$`) }).count(), t).toBeGreaterThan(0);
  await expect.poll(() => log.filter((l) => l.path === '/api/metrics').map((l) => l.body)).toEqual(['landing_view_waitlist']);
  // no number of people, no countdown, no "only N left"
  expect(await page.locator('main').innerText()).not.toMatch(/נרשמו כבר|כבר \d+|נשארו|רק עוד|מקומות/);
  await expectNoSidewaysScroll(page);
  await shot(page, '1-top');
  // the three things, each with a real screen of the app
  for (const [h, img] of [['תוכנית לערב שלפני המבחן', /מסך מציל המבחנים/], ['ציורים, וטעות שמקבלת שם', /תרגיל במערכת צירים/], ['מדי, ופרסים על מה שלומדים', /המסך של מדי/]]) {
    await expect(page.getByRole('heading', { level: 3, name: h })).toBeVisible();
    await expect(page.getByRole('img', { name: img })).toHaveAttribute('src', /\.\.\/l\/phone-(paste|mistake|madi)\.webp$/);
  }
  await expect(page.getByText(/מדביקים את ההודעה מהמורה על המבחן/)).toBeVisible();
  await shot(page, 'page', { full: true });
  // "אפשר כבר לנסות בדפדפן": into the app, counted as from a landing page
  await page.getByRole('link', { name: 'אפשר כבר לנסות בדפדפן' }).click();
  await expect(page).toHaveURL(/#\/\?src=waitlist$/);
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
  await expect.poll(() => log.filter((l) => l.path === '/api/metrics').map((l) => l.body).slice(0, 2)).toEqual(['landing_view_waitlist', 'landing_cta_waitlist']);
});

test('errors: each under its field and tied to it, the focus on the first; nothing is sent until they are fixed', async ({ page }) => {
  const { log } = await open(page);
  await join(page).click();
  const email = page.getByRole('textbox', { name: 'המייל שלכם' });
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('כתבו כתובת מייל.');
  await expect(page.getByRole('group', { name: 'אני' })).toHaveAccessibleDescription('בחרו מי אתם: הורה, תלמיד/ה או מורה.');
  const consent = page.getByRole('checkbox', { name: 'אפשר לשלוח לי מייל אחד כשהאפליקציה יוצאת לחנויות' });
  await expect(consent).toHaveAttribute('aria-invalid', 'true');
  await expect(consent).toHaveAccessibleDescription(/^כדי שנוכל לשלוח את המייל, סמנו את התיבה\./);
  await expectNoSidewaysScroll(page);
  await shot(page, '2-errors');
  // a wrong address says what is wrong; typing a right one takes its line away
  await email.fill('parent@example');
  await join(page).click();
  await expect(email).toHaveAccessibleDescription('זו לא נראית כמו כתובת מייל. בדקו שיש בה @ ונקודה.');
  await email.fill('parent@example.test');
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#wl-email-err')).toBeHidden();
  // a chip right under the email field is pressed at once (no line moves away under the finger)
  await page.locator('.wl-chip', { hasText: 'הורה' }).click();
  await expect(page.getByRole('radio', { name: 'הורה', exact: true })).toBeChecked();
  await expect(page.locator('#wl-role-err')).toBeHidden();
  // the consent is required: without it, nothing goes
  await join(page).click();
  await expect(consent).toBeFocused();
  await expect(page.locator('#wl-consent-err')).toHaveText('כדי שנוכל לשלוח את המייל, סמנו את התיבה.');
  expect(signups(log)).toEqual([]);
  await shot(page, '3-consent');
});

test('joining: the chips and the ad\'s labels go with it, and the thank-you takes the form\'s place, with no number in it', async ({ page }) => {
  const { log, st } = await open(page);
  // the chips: one "אני", one grade, both phones; each is a 44px target
  const heights = await page.locator('.wl-chip').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  await fill(page, { email: ' Student@Example.test', role: 'תלמיד/ה', grade: 'ח׳', phones: ['iPhone', 'Android'] });
  await page.getByRole('radio', { name: 'ז׳', exact: true }).check(); // a change of mind: one grade at a time
  await expect(page.getByRole('radio', { name: 'ח׳', exact: true })).not.toBeChecked();
  await shot(page, '4-filled');
  await join(page).click();
  const done = page.locator('#joined');
  await expect(done.getByRole('heading', { name: 'נרשמתם. תודה!' })).toBeVisible();
  await expect(done).toBeFocused();
  await expect(form(page)).toBeHidden();
  expect(signups(log).map((l) => l.body)).toEqual([{
    email: 'Student@Example.test', role: 'student', grade: '7', platform: 'both', consent: true, utm_source: 'instagram', utm_campaign: 'launch', website: '',
  }]);
  expect(st.waitlist.map((w) => w.email)).toEqual(['student@example.test']);
  // no count, no place in a queue
  expect(await done.innerText()).not.toMatch(/\d/);
  await expect(done).toContainText('נשלח לכם מייל אחד');
  await expectNoSidewaysScroll(page);
  await shot(page, '5-joined');
});

test('sharing after joining: the phone\'s share sheet with the page\'s address; else the link copied; else the link to copy', async ({ page }) => {
  // 1. a phone with a share sheet
  await page.addInitScript(() => { window.__shared = []; navigator.share = (d) => { window.__shared.push(d); return Promise.resolve(); }; });
  await open(page);
  await fill(page);
  await join(page).click();
  await page.getByRole('button', { name: 'לשלוח להם את הקישור' }).click();
  const shared = await page.evaluate(() => window.__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].url).toBe(SHARE_URL);
  expect(shared[0].text).toMatch(/^מדרגות: תרגול מתמטיקה/);
});

test('sharing without a share sheet: the link is copied, and when copying is refused it is shown to copy by hand', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    window.__copied = [];
    window.__refuse = false;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => (window.__refuse ? Promise.reject(new Error('no')) : (window.__copied.push(t), Promise.resolve())) }, configurable: true });
  });
  await open(page);
  await fill(page);
  await join(page).click();
  const share = page.getByRole('button', { name: 'לשלוח להם את הקישור' });
  await share.click();
  await expect(page.locator('#wl-share-status')).toHaveText('הקישור הועתק. אפשר להדביק אותו בוואטסאפ או בהודעה.');
  expect(await page.evaluate(() => window.__copied)).toEqual([SHARE_URL]);
  await expect(page.getByRole('textbox', { name: 'הקישור להעתקה' })).toBeHidden();
  await page.evaluate(() => { window.__refuse = true; });
  await share.click();
  const link = page.getByRole('textbox', { name: 'הקישור להעתקה' });
  await expect(link).toBeVisible();
  await expect(link).toHaveValue(SHARE_URL);
  await expect(link).toBeFocused();
  await expect(page.locator('#wl-share-status')).toHaveText('העתיקו את הקישור מכאן:');
  await expectNoSidewaysScroll(page);
  await shot(page, '6-share-by-hand');
});

test('the server\'s answers: too many from this network, the list closed, and a lost connection', async ({ page }) => {
  const { st } = await open(page, AD, { waitlistBusy: true });
  await fill(page);
  await join(page).click();
  await expect(page.locator('#wl-status')).toHaveText('היום כבר נשלחו מכאן הרבה הרשמות. נסו שוב מאוחר יותר.');
  await expect(join(page)).toBeEnabled();
  st.waitlistBusy = false; st.waitlistClosed = true;
  await join(page).click();
  const closed = page.locator('#closed');
  await expect(closed).toBeVisible();
  await expect(closed).toHaveText('האפליקציה כבר יצאה לחנויות, והרשימה סגורה.');
  await expect(closed).toBeFocused();
  st.waitlistClosed = false; st.down = true;
  await join(page).click();
  await expect(page.locator('#wl-status')).toHaveText('לא הצלחנו לשלוח. בדקו את החיבור לאינטרנט ונסו שוב.');
  st.down = false;
  await join(page).click();
  await expect(page.locator('#joined')).toBeVisible();
});

test('/w/ is the same page, with /waitlist/ as its address', async ({ page }) => {
  await open(page, 'w/?utm_source=story');
  await expect(page.getByRole('heading', { level: 1, name: 'מבחן במתמטיקה מחר?' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://madregot.example.test/waitlist/');
  await expect(page.locator('input[name="utm_source"]')).toHaveValue('story');
});

for (const scheme of ['light', 'dark']) {
  test(`axe and contrast in ${scheme}: the page, its errors and the thank-you; a skip link first; 44px targets`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(paper).toBe(scheme === 'dark' ? 'rgb(15, 17, 21)' : 'rgb(255, 255, 255)');
    await expectNoAxeViolations(page, {}, `the waitlist page (${scheme})`);
    const vp = page.viewportSize();
    const tall = async () => page.setViewportSize({ width: vp.width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
    await tall();
    await expectTextContrast(page, `waitlist ${scheme}`);
    await page.setViewportSize(vp);
    await join(page).click();
    await expectNoAxeViolations(page, {}, `the waitlist page with its errors (${scheme})`);
    await tall();
    await expectTextContrast(page, `waitlist errors ${scheme}`);
    await page.setViewportSize(vp);
    await fill(page);
    await join(page).click();
    await expect(page.locator('#joined')).toBeVisible();
    await expectNoAxeViolations(page, {}, `the waitlist page after joining (${scheme})`);
    if (scheme === 'dark') await shot(page, '7-joined-dark');
    // every press target in the page is at least 44px tall
    const small = await page.evaluate(() => [...document.querySelectorAll('main a, main button, footer a, .wl-chip span')]
      .filter((a) => a.offsetParent && a.getBoundingClientRect().height < 44).map((a) => a.textContent.trim()));
    expect(small).toEqual([]);
    // the keyboard: the skip link first, then into the content
    await page.reload();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'דילוג לתוכן העיקרי' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });
}

test.describe('without the page\'s script', () => {
  test.use({ javaScriptEnabled: false });

  test('the form is a plain form to the Worker, and its answers (#joined, #oops, #closed) show without any script', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await page.goto('./waitlist/');
    const f = form(page);
    await expect(f).toHaveAttribute('method', 'post');
    await expect(f).toHaveAttribute('action', `${FAKE_API}/api/waitlist`);
    for (const name of ['email', 'role', 'consent']) await expect(f.locator(`[name="${name}"]`).first()).toHaveAttribute('required', '');
    await expect(page.getByRole('button', { name: 'לשלוח להם את הקישור' })).toHaveCount(0); // hidden: it needs the script
    await page.goto('./waitlist/#joined');
    await expect(page.getByRole('heading', { name: 'נרשמתם. תודה!' })).toBeVisible();
    await expect(f).toBeHidden();
    await page.goto('./waitlist/#oops');
    await expect(page.locator('#oops')).toBeVisible();
    await expect(f).toBeVisible();
    await page.goto('./waitlist/#closed');
    await expect(page.locator('#closed')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});
