// The teacher's side, end to end against the fake server (e2e/fakeServer.js: no Worker, no email, no payment company).
// Grouped by spec item. Every name and address is synthetic (example.test).
//
// TEACHER-1: a teacher signs in with an email code and the class follows the email to any device; a lost phone costs
// nothing. The public site (this suite's own build, with no server) sends teachers to the full app. The sign-in
// survives a reload, unless the teacher said it is a shared computer. The board offers to bind a class that only its
// key opens, adds the email's other classes, and says how to come back when leaving.
//
// TEACHER-2: the teacher opens every lesson, every mastery check and the AI. The lessons library leads to each stair
// in the student view (a bar that says so and leads back), which works on this device only: no progress or help
// request reaches the class, and the tutor never asks by itself there. The teacher's assistant carries the class's
// credentials. A student screen that ends on "/" (or "/quests", "/rescue") comes back to where the preview was opened;
// with no preview open, those addresses are the board.
//
// TEACHER-9: the class settings, opened from the board's tools: the class's name, grade, code and join lock; the email
// it is bound to and the teacher key, with a new key after a fresh code; how long the data is kept (the words come from
// shared/retention.js); and deleting the class, which waits for its name to be typed and, for a class bound to an
// email, for the owner's fresh code.
//
// Screenshots for a look at the screens (TEACHER_SHOTS=<folder>), at the project's size and at 320×568; nothing is
// compared.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student, item, answer, proceed } from './helpers.js';
import { API, TOKEN, fakeServer } from './fakeServer.js';

const EMAIL = 'teacher@example.test';

/** Open a route on a device with a saved state (seeded before the app starts). `local`: more localStorage keys; `at`: the clock. */
let seeds = 0;
async function open(page, route, state = null, { local = {}, at = NOW } = {}) {
  await page.clock.setFixedTime(at);
  await page.goto('about:blank');
  seeds += 1;
  const key = `seeded-${seeds}-${Date.now()}`;
  await page.addInitScript(([s, k, extra]) => {
    if (location.protocol === 'about:' || sessionStorage.getItem(k)) return;
    Object.keys(sessionStorage).filter((x) => !x.startsWith('seeded-')).forEach((x) => sessionStorage.removeItem(x));
    sessionStorage.setItem(k, '1');
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', '424242');
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
    Object.entries(extra).forEach(([n, v]) => localStorage.setItem(n, v));
  }, [state, key, local]);
  await page.goto(`./${route}`);
  await page.evaluate(() => document.fonts.ready);
}
/** A device with the app pointed at the fake server. `profile: null`: nobody has used the app here yet. */
// introSeen: the one-time introduction to the tutor (trust spec TRUST-4 §4.6) was read on this device, as helpers.js seeds it
const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true }, ...extra }), version: 3 });
const fresh = () => withServer({ profile: null });
const keyClass = { code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7' };
const keyTeacher = (cls = {}) => withServer({ profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [{ ...keyClass, ...cls }], active: 'K7Q2MD' } });
const ownedTeacher = () => withServer({ profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [{ code: 'K7Q2MD', key: null, className: 'ז׳3', grade: '7', owned: true }], active: 'K7Q2MD' } });
const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state);
const teacherCalls = (log) => log.filter((r) => r.path.startsWith('/api/teacher/') && r.path !== '/api/teacher/classes');

/** Another device: a new browser context of the same size, answered by the same fake server. */
async function newDevice(browser, attach) {
  const u = test.info().project.use;
  const ctx = await browser.newContext({ baseURL: baseOf(), viewport: u.viewport, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, locale: 'he-IL', reducedMotion: 'reduce' });
  await attach(ctx);
  return ctx;
}

async function shot(page, name) {
  const dir = process.env.TEACHER_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const size = page.viewportSize();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png` });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/320-${name}.png` });
  await page.setViewportSize(size);
}

/** The email code form, wherever it is (the page or a sheet). */
async function signIn(scope, { email = EMAIL, shared = false } = {}) {
  await scope.getByLabel('כתובת המייל שלכם').fill(email);
  if (shared) await scope.getByRole('checkbox', { name: /מחשב משותף/ }).check();
  await scope.getByRole('button', { name: 'שליחת קוד' }).click();
  await scope.getByLabel('הקוד מהמייל').fill('123456');
}

/** From the first screen: "אני מורה", a new class with the email, its details. Ends on the board. */
async function openClassWithEmail(page, { shared = false, shotEmail = false } = {}) {
  await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
  await expect(page.getByText('שלום! איך נכנסים ללוח המורה?')).toBeVisible();
  await expect(page.getByRole('radio', { name: /פתיחת כיתה חדשה/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /כבר יש לי כיתה/ })).toBeVisible();
  if (shotEmail) await shot(page, 'teacher-start-choose');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await expect(page.getByText('מה המייל שלכם?')).toBeVisible();
  await expect(page.getByText('המייל משמש רק לכניסה ללוח המורה ולהודעות על הכיתות שלכם.')).toBeVisible();
  if (shotEmail) await shot(page, 'teacher-start-email');
  await signIn(page, { shared });
  await expect(page.getByText('איך קוראים לכם ולכיתה?')).toBeVisible();
  await expect(page.getByText(`הכיתה תישמר בחשבון של ${EMAIL}.`)).toBeVisible();
  await page.locator('#t-name').fill('רונית כהן');
  await page.locator('#t-class').fill('ז׳3');
  if (shotEmail) await shot(page, 'teacher-start-details');
  await page.getByRole('button', { name: 'פתיחת הכיתה' }).click();
  await expect(page.getByRole('heading', { name: 'הכיתה מוכנה!' })).toBeVisible();
  if (shotEmail) await shot(page, 'teacher-fresh-bound');
}

test.describe('TEACHER-1: the class follows the teacher\'s email', () => {
  test('a teacher opens a class with email, and on a second device signs in and gets the class back with no key', async ({ browser, page }) => {
    const { st, log, attach } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', fresh());
    await openClassWithEmail(page, { shotEmail: true });
    // the class was made with the session, so it is bound at once; the teacher never sees a key to keep
    const made = log.find((r) => r.path === '/api/classes');
    expect(made.headers['x-account-token']).toBe(TOKEN(1));
    expect(st.owned).toBe(true);
    const freshCard = page.locator('.t-fresh');
    await expect(freshCard).toContainText(`הכיתה שמורה בחשבון שלכם (${EMAIL}). מכל מכשיר אחר נכנסים עם המייל, בלי מפתח.`);
    await expect(freshCard.getByText('מפתח מורה')).toHaveCount(0);
    await expect(freshCard.getByText('tkey-123')).toHaveCount(0);
    await freshCard.getByRole('button', { name: 'אפשר להמשיך' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    // no bind card for a bound class
    await expect(page.getByRole('region', { name: 'קישור הכיתה למייל' })).toHaveCount(0);

    // the second device: the same email gets the class back, and no key is asked anywhere
    const other = await newDevice(browser, attach);
    const p2 = await other.newPage();
    await open(p2, '#/', fresh());
    await p2.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await p2.getByRole('radio', { name: /כבר יש לי כיתה/ }).click();
    await p2.getByRole('button', { name: 'המשך', exact: true }).click();
    await signIn(p2);
    await expect(p2.getByText('הכיתות שלכם')).toBeVisible();
    const row = p2.getByRole('checkbox', { name: /ז׳3 · כיתה ז׳ · 2 תלמידים/ });
    await expect(row).toBeChecked();
    await expect(p2.getByLabel('מפתח מורה')).toHaveCount(0);
    await shot(p2, 'teacher-restore');
    const before = log.length;
    await p2.getByRole('button', { name: 'כניסה ללוח' }).click();
    await expect(p2.getByText('תרגלו היום')).toBeVisible();
    await expect(p2.getByLabel('מפתח מורה')).toHaveCount(0);
    const calls = teacherCalls(log.slice(before));
    expect(calls.length).toBeGreaterThan(0);
    for (const r of calls) { expect(r.headers['x-account-token']).toBe(TOKEN(2)); expect(r.headers['x-teacher-key']).toBeUndefined(); }
    const p = (await saved(p2)).profile;
    expect(p.classes).toEqual([{ code: 'K7Q2MD', key: null, className: 'ז׳3', grade: '7', owned: true }]);
    expect(JSON.stringify(p)).not.toContain('@'); // the email stays in the session only
    await other.close();
  });

  test('an email with no classes says so, and leads to the class code and teacher key', async ({ page }) => {
    const { log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', fresh());
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await page.getByRole('radio', { name: /כבר יש לי כיתה/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await signIn(page);
    await expect(page.getByText(`לא מצאנו כיתות שמקושרות ל־${EMAIL}. אם פתחתם כיתה בלי מייל, נכנסים עם קוד הכיתה ומפתח המורה, ואז מקשרים אותה למייל מתוך הלוח.`)).toBeVisible();
    await shot(page, 'teacher-restore-empty');
    await page.getByRole('button', { name: 'כניסה עם קוד ומפתח' }).click();
    await page.getByLabel('קוד כיתה').fill('K7Q2MD');
    await page.getByLabel('מפתח מורה').fill('tkey-123');
    await page.getByRole('button', { name: 'כניסה ללוח' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    // signed in already, so the board offers to bind the class in one tap
    const card = page.getByRole('region', { name: 'קישור הכיתה למייל' });
    await card.getByRole('button', { name: 'לקשר למייל שלי' }).click();
    await expect(page.getByText(`הכיתה ז׳3 מקושרת עכשיו ל־${EMAIL}.`)).toBeVisible();
    expect(log.filter((r) => r.path === '/api/account/verify')).toHaveLength(1);
  });

  test('the public no-server build sends a teacher to the full app, and never to a server set-up', async ({ page }) => {
    for (const route of ['#/?start=teacher', '#/?role=teacher']) {
      await open(page, route);
      await expect(page.getByRole('heading', { name: 'לוח המורה נמצא באתר המלא' })).toBeVisible();
      const link = page.getByRole('link', { name: 'ללוח המורה' });
      await expect(link).toHaveAttribute('href', /^https:\/\/example\.test\//);
      expect(await link.getAttribute('href')).toBe('https://example.test/#/?start=teacher');
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(/Cloudflare|setup\.ps1/);
      await expect(page.getByText('משימות עם תאריך')).toBeVisible();
      await expect(page.getByText('מבחן תרגול להדפסה')).toBeVisible();
    }
    await shot(page, 'teacher-public-site');
    // back: the student's first screen, and the address loses the teacher question
    await page.getByRole('button', { name: 'לנסות את התרגול כתלמידים' }).click();
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
    expect(page.url()).not.toContain('role=teacher');
  });

  test('the sign-in survives a reload, and with "shared computer" a new tab asks for the email again', async ({ browser, page }) => {
    const { attach } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', fresh());
    await openClassWithEmail(page);
    await page.getByRole('button', { name: 'אפשר להמשיך' }).click();
    await page.reload();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await expect(page.getByText('כדי לפתוח את הלוח, נכנסים עם המייל')).toHaveCount(0);
    expect(await page.evaluate(() => !!localStorage.getItem('madregot-parent'))).toBe(true);

    // the staff-room computer: the sign-in is for this tab only, and the device keeps no key
    const shared = await newDevice(browser, attach);
    const tab = await shared.newPage();
    await open(tab, '#/', fresh());
    await openClassWithEmail(tab, { shared: true });
    await tab.getByRole('button', { name: 'אפשר להמשיך' }).click();
    await expect(tab.getByText('תרגלו היום')).toBeVisible();
    expect(await tab.evaluate(() => [localStorage.getItem('madregot-parent'), !!sessionStorage.getItem('madregot-parent')])).toEqual([null, true]);
    expect((await saved(tab)).profile.classes[0]).toMatchObject({ code: 'K7Q2MD', key: null, owned: true });
    const next = await shared.newPage();
    await next.clock.setFixedTime(NOW);
    await next.goto('./#/teacher');
    await expect(next.getByText('כדי לפתוח את הלוח, נכנסים עם המייל')).toBeVisible();
    await expect(next.getByText('תרגלו היום')).toHaveCount(0);
    await shot(next, 'teacher-signin-again');
    await signIn(next);
    await expect(next.getByText('תרגלו היום')).toBeVisible();
    await shared.close();
  });

  test('FreshClass explains the real student path: the words it quotes are on the student\'s screens', async ({ browser, page }) => {
    const { attach } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', fresh());
    await openClassWithEmail(page);
    const how = await page.locator('.t-fresh-how').innerText();
    const quoted = [...how.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(quoted).toEqual(['מתחילים', 'יש לכם קוד כיתה מהמורה?', 'אני']);
    expect(how).not.toContain('אני תלמיד או תלמידה');
    // a student's device: the first screen's button, then the class question after the first answers
    const kid = await newDevice(browser, attach);
    const s = await kid.newPage();
    await open(s, '#/', fresh());
    await s.getByRole('button', { name: quoted[0], exact: true }).click();
    await s.getByLabel('השם שלכם').fill('נועה');
    await s.getByRole('button', { name: 'המשך', exact: true }).click();
    await s.getByRole('radio', { name: /כיתה ז׳/ }).click();
    await s.getByRole('button', { name: 'המשך', exact: true }).click();
    await s.getByRole('radio').first().click();
    await s.getByRole('button', { name: 'המשך', exact: true }).click();
    await s.getByRole('button', { name: 'המשך', exact: true }).click();
    await expect(s.getByText(quoted[1], { exact: true })).toBeVisible();
    await kid.close();
  });

  test('without email on the server: no "already have a class", and "continue without email" is the key flow with its warning', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { email: false }, baseOf());
    await open(page, '#/', fresh());
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await expect(page.getByRole('radio', { name: /פתיחת כיתה חדשה/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /כבר יש לי כיתה/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await expect(page.getByText('בלי מייל, אפשר להיכנס לכיתה רק עם מפתח המורה.')).toBeVisible();
    await page.locator('#t-name').fill('רונית כהן');
    await page.locator('#t-class').fill('ז׳3');
    await page.getByRole('button', { name: 'פתיחת הכיתה' }).click();
    const card = page.locator('.t-fresh');
    await expect(card.getByText('מפתח מורה (רק לכם)')).toBeVisible();
    await expect(card).toContainText('הם לוחצים "מתחילים"');
    await expect(card.getByRole('button', { name: 'שמרתי, אפשר להמשיך' })).toBeVisible();
    expect(log.find((r) => r.path === '/api/classes').headers['x-account-token']).toBeUndefined();
    expect(st.owned).toBe(false);
    // and no bind card either: the server cannot send the code
    await card.getByRole('button', { name: 'שמרתי, אפשר להמשיך' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await expect(page.getByRole('region', { name: 'קישור הכיתה למייל' })).toHaveCount(0);
  });

  test('"להמשיך בלי מייל" asks first, then opens a class with the key', async ({ page }) => {
    const { st } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', fresh());
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('button', { name: 'להמשיך בלי מייל' }).click();
    const sheet = page.getByRole('dialog', { name: 'להמשיך בלי מייל?' });
    await expect(sheet.getByText('אם המכשיר ילך לאיבוד והמפתח לא נשמר, לא תהיה דרך לחזור לכיתה.')).toBeVisible();
    await shot(page, 'teacher-no-email-sheet');
    await sheet.getByRole('button', { name: 'חזרה' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText('מה המייל שלכם?')).toBeVisible();
    await page.getByRole('button', { name: 'להמשיך בלי מייל' }).click();
    await page.getByRole('dialog', { name: 'להמשיך בלי מייל?' }).getByRole('button', { name: 'להמשיך בלי מייל' }).click();
    await page.locator('#t-name').fill('רונית כהן');
    await page.locator('#t-class').fill('ז׳3');
    await page.getByRole('button', { name: 'פתיחת הכיתה' }).click();
    await expect(page.locator('.t-fresh').getByText('tkey-123')).toBeVisible();
    await shot(page, 'teacher-fresh-key');
    expect(st.owned).toBe(false);
  });

  test('a class opened with its key: the board offers to bind it; "לא עכשיו" waits a week; binding makes the email enough', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/teacher', keyTeacher());
    const card = page.getByRole('region', { name: 'קישור הכיתה למייל' });
    await expect(card).toContainText('הכיתה עוד לא מקושרת למייל. אם המכשיר הזה ילך לאיבוד, לא תוכלו לחזור אליה.');
    await shot(page, 'teacher-bind-card');
    await card.getByRole('button', { name: 'לא עכשיו' }).click();
    await expect(card).toHaveCount(0);
    expect((await saved(page)).profile.classes[0].bindLater).toBe('2026-11-12');
    // a week later it is back
    await open(page, '#/teacher', keyTeacher({ bindLater: '2026-11-05' }));
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'לקשר למייל שלי' }).click();
    const sheet = page.getByRole('dialog', { name: 'קישור הכיתה למייל' });
    await signIn(sheet);
    await expect(page.getByText(`הכיתה ז׳3 מקושרת עכשיו ל־${EMAIL}.`)).toBeVisible();
    await expect(card).toHaveCount(0);
    const bind = log.find((r) => r.path === '/api/teacher/class/owner');
    expect(bind.headers).toMatchObject({ 'x-class-code': 'K7Q2MD', 'x-teacher-key': 'tkey-123' });
    expect(bind.headers['x-account-token']).toBeTruthy();
    expect(st.owned).toBe(true);
    expect((await saved(page)).profile.classes[0]).toMatchObject({ owned: true, key: 'tkey-123' });
    // every class is bound now: leaving says how to come back
    await page.getByRole('button', { name: 'יציאה מהלוח' }).click();
    await expect(page.getByRole('dialog', { name: 'לצאת מהלוח?' })).toContainText(`הלוח ייסגר במכשיר הזה. כדי לחזור, נכנסים עם המייל ${EMAIL}.`);
  });

  test('signed in, the board adds the email\'s other classes; the switcher opens each with its grade', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { owned: true, accountClasses: [{ code: 'AAA222', name: 'ח׳1', grade: '8', teacherName: 'רונית', students: 3 }] }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/teacher', ownedTeacher(), { local: { 'madregot-parent': JSON.stringify({ token: TOKEN(9), email: EMAIL, shared: false }) } });
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await page.getByRole('button', { name: 'עוד כיתות מהחשבון שלי…' }).click();
    const sheet = page.getByRole('dialog', { name: 'עוד כיתות מהחשבון שלי' });
    await expect(sheet.getByText('ח׳1')).toBeVisible();
    await expect(sheet.getByText('ז׳3')).toHaveCount(0); // already on this device
    await shot(page, 'teacher-more-classes');
    await sheet.getByRole('button', { name: 'הוספת ח׳1 ללוח' }).click();
    await expect(page.getByRole('combobox', { name: 'כיתה' })).toHaveValue('AAA222');
    await expect.poll(() => log.filter((r) => r.path === '/api/teacher/dashboard' && r.headers['x-class-code'] === 'AAA222').length).toBeGreaterThan(0);
    expect(log.filter((r) => r.path === '/api/teacher/dashboard' && r.headers['x-class-code'] === 'AAA222').every((r) => r.headers['x-account-token'] === TOKEN(9))).toBe(true);
    expect((await saved(page)).profile).toMatchObject({ active: 'AAA222', grade: '8' });
    await page.getByRole('combobox', { name: 'כיתה' }).selectOption('K7Q2MD');
    expect((await saved(page)).profile).toMatchObject({ active: 'K7Q2MD', grade: '7' });
  });
});

test.describe('TEACHER-9: the class settings and deleting a class', () => {
  const session = (n = 9) => ({ 'madregot-parent': JSON.stringify({ token: TOKEN(n), email: EMAIL, shared: false }) });
  const threeClasses = () => withServer({ profile: { role: 'teacher', name: 'רונית', grade: '7', active: 'K7Q2MD', classes: [
    { ...keyClass }, { code: 'AAA222', key: null, className: 'ח׳1', grade: '8', owned: true }, { code: 'BBB333', key: null, className: 'ז׳5', grade: '7', owned: true },
  ] } });
  const accountClasses = [{ code: 'AAA222', name: 'ח׳1', grade: '8', teacherName: 'רונית', students: 3 }, { code: 'BBB333', name: 'ז׳5', grade: '7', teacherName: 'רונית', students: 4 }];

  test('the settings open from the board\'s tools: name, grade, code, lock, the key, how long data is kept; renaming changes the board', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    const tools = page.getByRole('navigation', { name: 'כלים' });
    await tools.getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await expect(page.getByRole('heading', { name: 'הגדרות הכיתה ז׳3' })).toBeVisible();
    await expect(page.getByText('כיתה ז׳', { exact: true })).toBeVisible();
    await expect(page.getByText('שכבה חדשה? פותחים כיתה חדשה בתחילת השנה.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'העתקת קוד הכיתה K7Q2MD' })).toBeVisible();
    const lock = page.getByRole('switch', { name: 'נעילת הכיתה לתלמידים חדשים' });
    await expect(lock).toBeEnabled();
    await expect(lock).not.toBeChecked();
    // a class only its key opens: the offer to bind it, and the key to give a co-teacher; no new key without the email
    await expect(page.getByText('הכיתה עוד לא מקושרת למייל.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'לקשר למייל שלי' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'העתקת מפתח המורה tkey-123' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'החלפת מפתח המורה' })).toHaveCount(0);
    const keep = page.getByRole('region', { name: 'כמה זמן נשמר המידע' });
    await expect(keep.getByRole('listitem')).toHaveText([
      'דפי מחברת שנשלחו עם בקשת עזרה: חודש אחרי שסוגרים את הבקשה, ולכל היותר חודשיים.',
      'בקשות עזרה והתשובות עליהן: חצי שנה אחרי שסוגרים אותן, ולכל היותר שנה.',
      'תשובות בתרגול, מבחנים ומשימות: 400 יום.',
      'תלמיד שלא נכנס 400 יום נמחק, עם כל המידע שלו. כיתה שאף אחד לא נכנס אליה 400 יום נמחקת.',
      'במכשירים של התלמידים נשמר התרגול שלהם, וכל תלמיד יכול למחוק אותו בעצמו.',
    ]);
    await expect(page.getByText('בשנה הבאה פותחים כיתה חדשה, והתלמידים מצטרפים עם קוד חדש.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'מחיקת הכיתה' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-settings');
    // the join lock from here
    await lock.click();
    await expect(lock).toBeChecked();
    expect(st.joinLocked).toBe(true);
    // a new name
    const save = page.getByRole('button', { name: 'שמירה' });
    await expect(save).toBeDisabled();
    await page.getByLabel('שם הכיתה').fill('  ז׳3   מורחבת ');
    await save.click();
    await expect(page.getByText('שם הכיתה עודכן.')).toBeVisible();
    expect(log.find((r) => r.path === '/api/teacher/class/rename')).toMatchObject({ body: { className: 'ז׳3 מורחבת' }, headers: { 'x-class-code': 'K7Q2MD', 'x-teacher-key': 'tkey-123' } });
    await expect(page.getByRole('heading', { name: 'הגדרות הכיתה ז׳3 מורחבת' })).toBeVisible();
    expect((await saved(page)).profile.classes[0].className).toBe('ז׳3 מורחבת');
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page.getByRole('heading', { name: 'ז׳3 מורחבת' })).toBeVisible();
    // the help list says how long its pages and requests stay; leaving says the server keeps the class
    await page.getByRole('tab', { name: /עזרה/ }).click();
    await expect(page.getByText('דפי מחברת נמחקים חודש אחרי שסוגרים בקשה, ובקשות נמחקות אחרי חצי שנה.')).toBeVisible();
    await page.getByRole('button', { name: 'יציאה מהלוח' }).click();
    await expect(page.getByRole('dialog', { name: 'לצאת מהלוח?' })).toContainText('המידע של הכיתות בשרת נשאר: כדי למחוק אותו, מוחקים כל כיתה בלוח המורה לפני כן.');
  });

  test('a new teacher key: a fresh code to the email, then the key to copy; the old one is replaced on this device', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { owned: true }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/teacher/settings', ownedTeacher(), { local: session() });
    await expect(page.getByText(`מקושרת ל־${EMAIL}.`)).toBeVisible();
    await expect(page.getByText('המפתח לא שמור במכשיר הזה.')).toBeVisible();
    await page.getByRole('button', { name: 'החלפת מפתח המורה' }).click();
    const sheet = page.getByRole('dialog', { name: 'ליצור מפתח מורה חדש?' });
    await expect(sheet).toContainText('המפתח הישן יפסיק לעבוד בכל מכשיר שנכנס איתו. מי שנכנס עם המייל ממשיך כרגיל. כדי לאשר, נשלח קוד למייל.');
    await sheet.getByRole('button', { name: 'ליצור מפתח חדש' }).click();
    await expect(sheet.getByRole('button', { name: 'אישור והחלפת המפתח' })).toBeVisible();
    expect(log.filter((r) => r.path === '/api/teacher/class/rekey')).toHaveLength(0);
    await sheet.getByLabel('הקוד מהמייל').fill('123456');
    const done = page.getByRole('dialog', { name: 'מפתח מורה חדש' });
    await expect(done).toContainText('המפתח החדש מוכן. אפשר להעתיק אותו למורה נוסף.');
    await expect(done.getByRole('button', { name: 'העתקת המפתח החדש tkey-456' })).toBeVisible();
    const call = log.find((r) => r.path === '/api/teacher/class/rekey');
    expect(call.headers['x-account-token']).toBe(TOKEN(1));
    expect((await saved(page)).profile.classes[0]).toMatchObject({ key: 'tkey-456', owned: true });
    await done.getByRole('button', { name: 'סיום' }).click();
    await expect(done).toBeHidden();
    await expect(page.getByRole('button', { name: 'העתקת מפתח המורה tkey-456' })).toBeVisible();
  });

  test('deleting a class waits for its name, posts DELETE, and the class leaves the switcher', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { accountClasses }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/teacher/settings', threeClasses(), { local: session() });
    await page.getByRole('button', { name: 'מחיקת הכיתה' }).click();
    const sheet = page.getByRole('dialog', { name: 'למחוק את הכיתה ז׳3?' });
    await expect(sheet).toContainText('נמחק את רשימת התלמידים, את ההתקדמות שלהם בלוח, את המשימות, את בקשות העזרה והתשובות עליהן ואת המבחנים. התרגול שנשמר במכשירים של התלמידים נשאר בהם. אי אפשר לבטל.');
    const red = sheet.getByRole('button', { name: 'כן, למחוק את הכיתה' });
    await expect(red).toBeDisabled();
    const name = sheet.getByLabel('כדי לאשר, כתבו את שם הכיתה: ז׳3');
    await name.fill('ז׳');
    await expect(red).toBeDisabled();
    await name.fill("ז'3"); // a phone keyboard's apostrophe for the geresh
    await expect(red).toBeEnabled();
    await shot(page, 'teacher-delete-class');
    expect(log.filter((r) => r.path === '/api/teacher/class/delete')).toHaveLength(0);
    await red.click();
    await expect(page.getByText('הכיתה נמחקה')).toBeVisible();
    const del = log.filter((r) => r.path === '/api/teacher/class/delete');
    expect(del).toHaveLength(1);
    expect(del[0].body).toEqual({ confirm: 'DELETE' });
    expect(del[0].headers).toMatchObject({ 'x-class-code': 'K7Q2MD', 'x-teacher-key': 'tkey-123' });
    // the board opens on the next class; the switcher has the two that are left
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    const switcher = page.getByRole('combobox', { name: 'כיתה' });
    await expect(switcher).toHaveValue('AAA222');
    await expect(switcher.locator('option')).toHaveText(['ח׳1', 'ז׳5']);
    const p = (await saved(page)).profile;
    expect(p.classes.map((c) => c.code)).toEqual(['AAA222', 'BBB333']);
    expect(p).toMatchObject({ active: 'AAA222', grade: '8' });
  });

  test('a class bound to the email: the owner\'s fresh code first; the last class gone closes the board; a running licence keeps a class', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { owned: true, licence: { status: 'active', until: '2027-08-31T20:59:59Z', seats: 30, students: 2, aiWeek: 0, joinLocked: false, request: null, legacyUntil: null, offer: { seatYearAgorot: 4900, minSeats: 10, vatMode: 'included', online: true } } }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/teacher?tab=students', ownedTeacher(), { local: session() });
    // the quiet last row of "תלמידים" opens the same sheet
    await page.getByRole('button', { name: 'מחיקת הכיתה' }).click();
    const sheet = page.getByRole('dialog', { name: 'למחוק את הכיתה ז׳3?' });
    await sheet.getByLabel(/כדי לאשר, כתבו את שם הכיתה/).fill('ז׳3');
    await sheet.getByRole('button', { name: 'כן, למחוק את הכיתה' }).click();
    // owned: the step-up comes before any delete is sent
    await expect(sheet.getByText('רק מי שהכיתה מקושרת למייל שלו יכול למחוק אותה. כדי לאשר, שלחנו קוד למייל.')).toBeVisible();
    expect(log.filter((r) => r.path === '/api/teacher/class/delete')).toHaveLength(0);
    await sheet.getByLabel('הקוד מהמייל').fill('123456');
    // the licence still runs: the class stays, and the sheet says why
    await expect(sheet.getByText('לכיתה יש רישיון פעיל. אפשר למחוק אותה אחרי שהרישיון מסתיים, או לכתוב לנו.')).toBeVisible();
    expect(st.deleted).toEqual([]);
    await sheet.getByRole('button', { name: 'סגירה' }).click();
    // the licence has ended: now it goes, and with no class left the board closes
    st.licence = { ...st.licence, status: 'ended' };
    await page.getByRole('button', { name: 'מחיקת הכיתה' }).click();
    await sheet.getByLabel(/כדי לאשר, כתבו את שם הכיתה/).fill('ז׳3');
    await sheet.getByRole('button', { name: 'כן, למחוק את הכיתה' }).click();
    await sheet.getByLabel('הקוד מהמייל').fill('123456');
    await expect(page.getByText('הכיתה נמחקה')).toBeVisible();
    await expect(page.getByRole('button', { name: 'אני מורה', exact: true })).toBeVisible();
    const del = log.filter((r) => r.path === '/api/teacher/class/delete');
    expect(del.at(-1)).toMatchObject({ body: { confirm: 'DELETE' }, headers: { 'x-class-code': 'K7Q2MD', 'x-account-token': TOKEN(2) } });
    expect(st.deleted).toEqual(['K7Q2MD']);
    expect((await saved(page)).profile).toBe(null);
    expect(log.some((r) => r.path === '/api/account/signout')).toBe(true);
  });
});

test.describe('TEACHER-2: the student view, the lessons and the teacher\'s assistant', () => {
  const library = async (page, over = {}) => {
    const srv = await fakeServer(page, over, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'השיעורים' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'השיעורים של כיתה ז׳' })).toBeVisible();
    return srv;
  };
  const bar = (page) => page.getByRole('region', { name: 'תצוגת תלמיד' });
  const topic = (page, name) => page.getByRole('region', { name });
  const back = (page) => page.evaluate(() => sessionStorage.getItem('madregot-preview-back'));
  const previewOn = (page) => page.evaluate(() => document.documentElement.dataset.preview || null);

  test('1. the library opens a stair in the student view, and "חזרה ללוח" comes back to the library', async ({ page }) => {
    await library(page);
    await expect(page.getByText('כל מדרגה בנויה מחמישה שלבים: מבינים את הרעיון, דוגמה פתורה, פותרים יחד, מתרגלים לבד ובדיקת שליטה.')).toBeVisible();
    const signed = topic(page, 'מספרים מכוונים');
    await expect(signed.getByRole('list', { name: 'השלבים של חיבור וחיסור' }).getByRole('listitem')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'איפוס תצוגת התלמיד' })).toBeVisible();
    await shot(page, 'teacher-library');
    await signed.getByRole('link', { name: 'לשיעור: חיבור וחיסור' }).click();
    await expect(page).toHaveURL(/#\/learn\/signed\/1$/);
    await expect(page.getByRole('list', { name: 'שלבי המדרגה' })).toBeVisible();
    await expect(bar(page)).toBeVisible();
    await expect(bar(page)).toContainText('תצוגת תלמיד');
    await expect(bar(page)).toContainText('מה שעושים כאן לא נשלח לכיתה.');
    expect(await previewOn(page)).toBe('1');
    expect(await back(page)).toBe('/teacher/lessons');
    const btn = await bar(page).getByRole('button', { name: 'חזרה ללוח' }).boundingBox();
    expect(btn.height).toBeGreaterThanOrEqual(44);
    // no tab bar of the student app inside the student view
    await expect(page.getByRole('navigation', { name: 'ניווט ראשי' })).toHaveCount(0);
    await bar(page).getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page).toHaveURL(/#\/teacher\/lessons$/);
    await expect(page.getByRole('heading', { level: 1, name: 'השיעורים של כיתה ז׳' })).toBeVisible();
    expect(await previewOn(page)).toBe(null);
    expect(await back(page)).toBe(null);
    // the board's back arrow
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
  });

  test('2. after switching to grade ח׳, a stage C opens, and the way back keeps the grade', async ({ page }) => {
    await library(page);
    await page.getByRole('radio', { name: 'כיתה ח׳' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'השיעורים של כיתה ח׳' })).toBeVisible();
    await expect(page).toHaveURL(/grade=8/);
    await expect(topic(page, 'מספרים מכוונים')).toHaveCount(0);
    await topic(page, 'משפט פיתגורס').getByRole('link', { name: 'לשיעור: מציאת היתר' }).click();
    await expect(page).toHaveURL(/#\/learn\/pyth\/1$/);
    await page.getByRole('button', { name: 'פותרים יחד: פתיחה' }).click();
    await expect(page).toHaveURL(/#\/learn\/pyth\/1\/C$/);
    await expect(bar(page)).toBeVisible();
    await expect(page.locator('.tg-step').first()).toBeVisible();
    expect(await back(page)).toBe('/teacher/lessons?grade=8');
    await shot(page, 'teacher-preview-stage');
    await bar(page).getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page).toHaveURL(/#\/teacher\/lessons\?grade=8$/);
    await expect(page.getByRole('heading', { level: 1, name: 'השיעורים של כיתה ח׳' })).toBeVisible();
  });

  test('3. a mastery check and practice in the student view send nothing to the class, and the tutor never asks by itself', async ({ page }) => {
    // a licensed class: the teacher's tier is a paid one, where a student's lesson would ask the tutor after two misses
    const { log } = await library(page, { licence: { status: 'active', until: '2027-08-31T20:59:59Z', seats: 35, students: 2, aiWeek: 0, joinLocked: false, request: null, legacyUntil: null, offer: { seatYearAgorot: 4900, minSeats: 10, vatMode: 'included', online: true } } });
    await topic(page, 'מספרים מכוונים').getByRole('link', { name: 'בדיקת שליטה: חיבור וחיסור' }).click();
    await expect(page).toHaveURL(/#\/lesson\/signed\/1\?kind=check&purpose=mastery$/);
    await expect.poll(() => item(page)).toBeTruthy();
    await expect(bar(page)).toBeVisible();
    await answer(page, true);
    await proceed(page);
    // practice: two misses on one question
    await bar(page).getByRole('button', { name: 'חזרה ללוח' }).click();
    // leaving a check under way asks first, as it does a student
    await page.getByRole('dialog', { name: 'לצאת מהשיעור?' }).getByRole('button', { name: 'יציאה' }).click();
    await expect(page).toHaveURL(/#\/teacher\/lessons$/);
    await topic(page, 'מספרים מכוונים').getByRole('link', { name: 'לשיעור: חיבור וחיסור' }).click();
    await page.evaluate(() => { window.__madregotItem = null; }); // the check's question is not the practice's
    await page.getByRole('button', { name: 'מתרגלים לבד: פתיחה' }).click();
    await expect(page).toHaveURL(/#\/lesson\/signed\/1\?part=1&from=journey$/);
    await expect.poll(() => item(page)).toBeTruthy();
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.locator('section.fb')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByRole('button', { name: 'לבקש עזרה מהמורה' })).toHaveCount(0);
    const posts = log.filter((r) => r.method === 'POST').map((r) => r.path);
    expect(posts.filter((p) => ['/api/progress', '/api/help'].includes(p))).toEqual([]);
    expect(log.filter((r) => r.path === '/api/ai/explain')).toEqual([]);
    // the answers stayed on this device: its own learning state, an empty class outbox
    const st = await saved(page);
    expect(st.outbox).toEqual([]);
    expect(st.learn.skills['signed:1'].attempts.length).toBeGreaterThan(0);
  });

  test('4. the teacher\'s assistant: the note and the Ministry\'s line, and its questions go as the class', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'העוזר החכם' }).click();
    await expect(page).toHaveURL(/#\/teacher\/assistant$/);
    await expect(page.getByRole('heading', { level: 1, name: 'העוזר החכם' })).toBeVisible();
    await expect(page.getByText('העוזר החכם למורים: להכנת תרגילים, הסברים ורעיונות לשיעור. השאלות שלכם לא מוצגות לתלמידים.')).toBeVisible();
    const note = page.getByRole('complementary', { name: 'על העוזר החכם למורים' });
    await expect(note).toContainText('לפי ההנחיות של משרד החינוך: בלי שמות של תלמידים, ציונים או פרטים מזהים.');
    await expect(note).toContainText('בכיתה לא מציגים את העוזר לתלמידים.');
    await expect(bar(page)).toHaveCount(0); // the teacher's own tool, not a student view
    await page.getByLabel('ההודעה שלכם').fill('איך להסביר חיבור של מספר חיובי ומספר שלילי?');
    await page.getByRole('button', { name: 'שליחה' }).click();
    await expect(page.getByText('כדי לחבר מספרים עם סימנים שונים')).toBeVisible();
    const chat = log.find((r) => r.path === '/api/ai/chat');
    expect(chat.headers['x-class-code']).toBe('K7Q2MD');
    expect(chat.headers['x-teacher-key']).toBe('tkey-123');
    expect(chat.headers.authorization).toBeUndefined();
    await shot(page, 'teacher-assistant');
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    // a class its teacher marked private (TRUST-11, later) is not a school class: the line about the class goes
    await open(page, '#/teacher/assistant', keyTeacher({ aiPolicy: { setting: 'private' } }));
    await expect(note).toContainText('בלי שמות של תלמידים, ציונים או פרטים מזהים.');
    await expect(note).not.toContainText('בכיתה לא מציגים את העוזר לתלמידים.');
  });

  test('5. at 320×568 the lesson\'s keypad and its check button stay on screen under the bar', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await page.setViewportSize({ width: 320, height: 568 });
    // a typed question (the seed picks the first exercise)
    let it = null;
    for (let sd = 1; sd <= 40 && !(it && it.form === 'num'); sd += 1) {
      await open(page, '#/lesson/signed/1?kind=check&purpose=mastery', keyTeacher(), { local: { 'madregot-seed': String(sd) } });
      await expect.poll(() => item(page)).toBeTruthy();
      it = await item(page);
    }
    expect(it.form).toBe('num');
    await expect(bar(page)).toBeVisible();
    const keys = page.locator('.keypad button');
    const last = await keys.last().boundingBox();
    expect(last.y + last.height).toBeLessThanOrEqual(568);
    const check = await page.getByRole('button', { name: 'בדיקה', exact: true }).boundingBox();
    expect(check.y + check.height).toBeLessThanOrEqual(568);
    const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
    expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
  });

  test('6. the end of a check, "למפה" after a stage, and a way to /rescue all come back to the library', async ({ page }) => {
    await library(page);
    const signed = topic(page, 'מספרים מכוונים');
    await signed.getByRole('link', { name: 'בדיקת שליטה: חיבור וחיסור' }).click();
    await expect.poll(() => item(page)).toBeTruthy();
    for (let i = 0; i < 5; i += 1) { await answer(page, true); await proceed(page); }
    await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
    await page.getByRole('button', { name: 'למפה' }).click();
    await expect(page).toHaveURL(/#\/teacher\/lessons$/);
    // the dots of that stair now show its check, done in this view
    await expect(signed.getByRole('list', { name: 'השלבים של חיבור וחיסור' })).toContainText('בדיקת שליטה, נעשה בתצוגה הזו');

    // a worked example to its end, then "למפה" in the stage's moment
    await signed.getByRole('link', { name: 'לשיעור: חיבור וחיסור' }).click();
    await page.getByRole('button', { name: 'דוגמה פתורה: פתיחה' }).click();
    await expect(page).toHaveURL(/#\/learn\/signed\/1\/B$/);
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
    for (let g = 0; g < 8 && !(await page.locator('.stage-done').count()); g += 1) {
      // the check above and this stage reach the day's goal in this view: its own moment comes first (STUDENT-7)
      if (await page.locator('.goal-stage').count()) { await page.locator('.goal-stage').getByRole('button', { name: 'המשך', exact: true }).click(); continue; }
      while (await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).count()) await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).click();
      await page.getByRole('button', { name: /לדוגמה הבאה|לפתור יחד/ }).click();
    }
    await page.locator('.stage-done').getByRole('button', { name: 'למפה', exact: true }).click();
    await expect(page).toHaveURL(/#\/teacher\/lessons$/);

    // CheckDone's way to the exam plan (/rescue), from inside a preview
    await signed.getByRole('link', { name: 'לשיעור: חיבור וחיסור' }).click();
    await expect(bar(page)).toBeVisible();
    await page.evaluate(() => { window.location.hash = '#/rescue'; });
    await expect(page).toHaveURL(/#\/teacher\/lessons$/);
    // the reset of the student view keeps the teacher's profile and clears the dots
    await page.getByRole('button', { name: 'איפוס תצוגת התלמיד' }).click();
    await expect(page.getByText('תצוגת התלמיד אופסה. כל שיעור ייפתח מההתחלה.')).toBeVisible();
    await expect(signed.getByRole('list', { name: 'השלבים של חיבור וחיסור' })).not.toContainText('נעשה בתצוגה הזו');
    expect((await saved(page)).profile).toMatchObject({ role: 'teacher', active: 'K7Q2MD' });
  });

  test('7. with no preview open the student addresses are the board; during one they lead back to the library', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/', keyTeacher());
    await expect(page).toHaveURL(/#\/teacher$/);
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await shot(page, 'teacher-board-tools');
    for (const addr of ['#/quests', '#/teacher/nothing', '#/subscription', '#/me']) {
      await page.evaluate((h) => { window.location.hash = h; }, addr);
      await expect(page).toHaveURL(/#\/teacher$/);
    }
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'השיעורים' }).click();
    await topic(page, 'זוויות').getByRole('link', { name: /^לשיעור: / }).first().click();
    await expect(page).toHaveURL(/#\/learn\/angles\/1$/);
    await expect(bar(page)).toBeVisible();
    await page.evaluate(() => { window.location.hash = '#/quests'; });
    await expect(page).toHaveURL(/#\/teacher\/lessons$/);
    // the library cleared the way back: "#/" is the board again
    await page.evaluate(() => { window.location.hash = '#/'; });
    await expect(page).toHaveURL(/#\/teacher$/);
  });
});

// TEACHER-4: the teacher gives work with a due date, from "מחר", the "משימות" tab and the library; sees each student's
// state; extends a date; deletes after asking; and tells the class with a message to copy (no names) and a Classroom link.
test.describe('TEACHER-4: assignments, from the teacher\'s side', () => {
  const NAMES = ['אביגיל ב.', 'אורי כ.', 'איתי ל.', 'אלה מ.', 'בן נ.', 'גאיה ס.', 'דניאל ע.', 'הדר פ.', 'יהלי צ.', 'יונתן ק.', 'לביא ר.', 'מאיה ש.',
    'נגה ת.', 'נועם א.', 'עדי ב.', 'עומר ג.', 'רוני ד.', 'שירה ה.', 'תמר ו.', 'יואב ז.', 'דנה ח.', 'אלון ט.', 'מיכל י.', 'רועי כ.'];
  const class24 = () => NAMES.map((name, i) => ({ id: `c${String(i + 1).padStart(2, '0')}`, name }));
  const stairWork = (over = {}) => ({ id: 'a000000000000001', kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', note: 'לקראת המבחן ביום חמישי',
    startsOn: '2026-11-05', dueOn: '2026-11-12', forAll: true, targets: [], createdAt: '2026-11-05T09:00:00.000Z', ...over });
  const mistake = { topic: 'signed', cat: 'sign', level: 1, n: 5, students: 2, ids: ['a1', 'b2'], names: ['דנה', 'יואב'] };
  /** The clipboard of this page, kept in window.__copied (the real one asks the browser for a permission). */
  const catchClipboard = (page) => page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  const sheet = (page, name) => page.getByRole('dialog', { name });

  test('from "מחר": practice on that stair for the two students who made the mistake, then the message and the Classroom link', async ({ page }) => {
    const { st, log } = await fakeServer(page, { mistakes: [mistake] }, baseOf());
    await open(page, '#/teacher', keyTeacher());
    const row = page.locator('.t-row', { hasText: 'התשובה יצאה עם הסימן ההפוך' });
    await row.getByRole('button', { name: 'לתת תרגול על זה' }).click();
    const s = sheet(page, 'משימה לכיתה ז׳3');
    await expect(s).toBeVisible();
    await expect(s.getByRole('radio', { name: /ללמוד מדרגה/ })).toBeChecked();
    await expect(s.getByLabel('איזו מדרגה?')).toHaveValue('signed:1');
    await expect(s.getByRole('radio', { name: /לתלמידים שטעו בזה \(2\)/ })).toBeChecked();
    await expect(s.getByRole('radio', { name: /לכל הכיתה \(2\)/ })).not.toBeChecked();
    await expect(s.getByLabel('כותרת')).toHaveValue('מספרים מכוונים: חיבור וחיסור');
    // a week from Thursday is a Thursday: no rest-day line
    await expect(s.getByRole('radio', { name: 'בעוד שבוע' })).toBeChecked();
    await expect(s.getByText('עד יום חמישי, 12.11.')).toBeVisible();
    await shot(page, 'teacher-assign-sheet');
    // the buttons a finger presses are at least 44px tall
    for (const name of ['מחר', 'בעוד 3 ימים', 'בעוד שבוע']) expect((await s.locator('.as-chip', { hasText: name }).boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await s.getByRole('button', { name: 'שליחה לכיתה' }).boundingBox()).height).toBeGreaterThanOrEqual(44);
    await s.getByLabel('מילה לכיתה (לא חובה)').fill('לקראת המבחן ביום חמישי');
    await s.getByRole('button', { name: 'שליחה לכיתה' }).click();
    const sent = log.find((r) => r.path === '/api/teacher/assignments' && r.method === 'POST');
    expect(sent.body).toEqual({ kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', note: 'לקראת המבחן ביום חמישי', dueOn: '2026-11-12', targets: ['a1', 'b2'] });
    expect(sent.headers['x-teacher-key']).toBe('tkey-123');
    await expect(page.getByText('המשימה נשלחה. התלמידים יראו אותה בראש המשימה של היום.')).toBeVisible();

    // "לספר לכיתה?": a message with no student's name, and Google's share address
    const share = sheet(page, 'לספר לכיתה?');
    await expect(share).toBeVisible();
    await catchClipboard(page);
    await share.getByRole('button', { name: 'העתקת הודעה לתלמידים' }).click();
    await expect(page.getByText('ההודעה הועתקה')).toBeVisible();
    const copied = await page.evaluate(() => window.__copied);
    expect(copied).toBe(`משימה חדשה במדרגות: מספרים מכוונים: חיבור וחיסור, עד יום חמישי 12.11. פותחים את האפליקציה, והמשימה מחכה בראש "המשימה שלי להיום". ${baseOf()}`);
    for (const n of ['דנה', 'יואב']) expect(copied).not.toContain(n);
    const link = share.getByRole('link', { name: 'שיתוף ב־Google Classroom' });
    await expect(link).toHaveAttribute('href', `https://classroom.google.com/share?url=${encodeURIComponent(`${baseOf()}#/quests`)}`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await shot(page, 'teacher-assign-share');
    await share.getByRole('button', { name: 'סיום' }).click();
    await expect(share).toHaveCount(0);
    // the tab counts the open assignment; its row shows the two students
    expect(st.assignments).toHaveLength(1);
    await page.getByRole('tab', { name: 'משימות (1)' }).click();
    const r = page.getByRole('list', { name: 'משימות פתוחות' }).getByRole('button', { name: /מספרים מכוונים: חיבור וחיסור/ });
    await expect(r).toContainText('מדרגה · עד יום ה׳, 12.11 · ל־2 תלמידים');
    await expect(r).toContainText('0/2 סיימו');
    await expect(r).toContainText('2 עוד לא התחילו');
  });

  test('a week from a Saturday is a Saturday: the sheet says the date moves to Sunday, as the server does', async ({ page }) => {
    const { log } = await fakeServer(page, { today: '2026-11-07' }, baseOf());
    await open(page, '#/teacher?tab=work', keyTeacher(), { at: new Date('2026-11-07T10:00:00') });
    await expect(page.getByRole('heading', { name: 'עוד אין משימות' })).toBeVisible();
    await expect(page.getByText('אפשר לתת לכיתה מדרגה ללמוד או בדיקת שליטה, עם תאריך הגשה.')).toBeVisible();
    await page.getByRole('button', { name: 'משימה חדשה' }).first().click();
    const s = sheet(page, 'משימה לכיתה ז׳3');
    await s.getByRole('radio', { name: /בדיקת שליטה/ }).check();
    await s.getByLabel('איזו מדרגה?').selectOption('coord:2');
    await expect(s.getByLabel('כותרת')).toHaveValue('בדיקת שליטה: רביעים');
    await s.getByText('בעוד 3 ימים').click();
    await expect(s.getByText('עד יום שלישי, 10.11.')).toBeVisible();
    await s.getByText('בעוד שבוע').click();
    await expect(s.getByText('התאריך יוצא בשבת או בחג, ולכן המועד יהיה ביום ראשון, 15.11.')).toBeVisible();
    await s.getByText('התאריך יוצא בשבת או בחג', { exact: false }).scrollIntoViewIfNeeded();
    await shot(page, 'teacher-assign-restday');
    await s.getByRole('button', { name: 'שליחה לכיתה' }).click();
    const sent = log.find((r) => r.path === '/api/teacher/assignments' && r.method === 'POST');
    expect(sent.body).toMatchObject({ kind: 'check', skill: 'coord:2', dueOn: '2026-11-14' });
    expect(sent.body.targets).toBeUndefined();
    await expect(page.getByText('המשימה נשלחה, עד יום ראשון, 15.11. התלמידים יראו אותה בראש המשימה של היום.')).toBeVisible();
    await expect(sheet(page, 'לספר לכיתה?').locator('.as-msg')).toContainText('עד יום ראשון 15.11.');
  });

  test('"משימות" for a class of 24: "0/24 סיימו", the detail lists 24, a later date, the past folded, and deleting asks first', async ({ page }) => {
    const students = class24();
    const done = { state: 'done', stage: 5, passed: true, tries: 1, startedAt: '2026-11-02T09:00:00Z', doneAt: '2026-11-04T09:00:00Z', doneDay: '2026-11-04' };
    const { st, log } = await fakeServer(page, {
      students,
      assignments: [stairWork(), stairWork({ id: 'a000000000000002', kind: 'check', skill: 'signed:2', title: 'בדיקת שליטה: כפל וחילוק', note: '', startsOn: '2026-11-01', dueOn: '2026-11-03', createdAt: '2026-11-01T09:00:00.000Z' })],
      work: { a000000000000002: { c01: { ...done, stage: null, right: 4, asked: 5, tries: 2 }, c02: { state: 'started', startedAt: '2026-11-02T09:00:00Z', tries: 0 } } },
    }, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await page.getByRole('tab', { name: 'משימות (1)' }).click();
    const open1 = page.getByRole('list', { name: 'משימות פתוחות' }).getByRole('button');
    await expect(open1).toHaveCount(1);
    await expect(open1).toContainText('מספרים מכוונים: חיבור וחיסור');
    await expect(open1).toContainText('מדרגה · עד יום ה׳, 12.11');
    await expect(open1.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '0/24 סיימו');
    await expect(open1).toContainText('24 עוד לא התחילו');
    await expect(open1).not.toContainText('באיחור');
    // the past one is folded; open, it shows the late count (the teacher's eyes only)
    const fold = page.getByRole('button', { name: 'משימות קודמות (1)' });
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await fold.click();
    const past = page.getByRole('list', { name: 'משימות קודמות' }).getByRole('button');
    await expect(past).toContainText('בדיקת שליטה · עד יום ג׳, 3.11');
    await expect(past).toContainText('1/24 סיימו');
    await expect(past).toContainText('1 בדרך');
    await expect(past).toContainText('24 באיחור');
    await shot(page, 'teacher-work-tab');

    // the past check's detail: the first try's score, the muted late chip
    await past.click();
    let d = sheet(page, 'בדיקת שליטה: כפל וחילוק');
    await expect(d.locator('tbody tr')).toHaveCount(24);
    await expect(d.getByRole('row', { name: /אביגיל ב\./ })).toContainText('הושלם');
    await expect(d.getByRole('row', { name: /אביגיל ב\./ })).toContainText('4/5 · עבר/ה (ניסיון ראשון)');
    await expect(d.getByRole('row', { name: /אורי כ\./ })).toContainText('התחיל/הבאיחור');
    await d.getByRole('button', { name: 'סגירה' }).click();

    // the open stair: 24 rows, none started, the footnote; a later date
    await open1.click();
    d = sheet(page, 'מספרים מכוונים: חיבור וחיסור');
    await expect(d.locator('tbody tr')).toHaveCount(24);
    await expect(d.locator('tbody tr').first()).toContainText('עוד לא התחיל/ה');
    await expect(d.getByText('“לקראת המבחן ביום חמישי”')).toBeVisible();
    await expect(d.getByText('התוצאות נבדקות במכשיר של התלמיד. זה תרגול, לא מבחן לציון.')).toBeVisible();
    await shot(page, 'teacher-assignment-detail');
    await d.getByRole('button', { name: 'הארכת המועד' }).click();
    await d.getByLabel('מועד חדש').fill('2026-11-14');
    await expect(d.getByText('התאריך יוצא בשבת או בחג, ולכן המועד יהיה ביום ראשון, 15.11.')).toBeVisible();
    await d.getByLabel('מועד חדש').fill('2026-11-16');
    await d.getByRole('button', { name: 'שמירת המועד' }).click();
    await expect(page.getByText('המועד הוארך ליום שני, 16.11.')).toBeVisible();
    expect(log.find((r) => r.path === '/api/teacher/assignments/a000000000000001' && r.method === 'POST').body).toEqual({ dueOn: '2026-11-16' });
    await expect(d.getByText('מדרגה·עד יום ב׳, 16.11·לכל הכיתה')).toBeVisible();

    // deleting asks first; "לא למחוק" keeps it
    await d.getByRole('button', { name: 'מחיקת המשימה' }).click();
    const ask = sheet(page, 'למחוק את המשימה?');
    await expect(ask).toContainText('המשימה תיעלם אצל התלמידים, ומה שכבר עשו בה לא יופיע כאן. ההתקדמות שלהם בשיעורים עצמם נשארת.');
    await ask.getByRole('button', { name: 'לא למחוק' }).click();
    await expect(ask).toHaveCount(0);
    expect(log.some((r) => r.path.endsWith('/delete'))).toBe(false);
    await d.getByRole('button', { name: 'מחיקת המשימה' }).click();
    await sheet(page, 'למחוק את המשימה?').getByRole('button', { name: 'כן, למחוק' }).click();
    await expect(page.getByText('המשימה נמחקה.')).toBeVisible();
    expect(log.find((r) => r.path === '/api/teacher/assignments/a000000000000001/delete').method).toBe('POST');
    expect(st.assignments.map((a) => a.id)).toEqual(['a000000000000002']);
    await expect(page.getByText('אין משימות פתוחות. אפשר לתת משימה חדשה.')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'משימות', exact: true })).toBeVisible();
  });

  test('from the library: "לתת לכיתה" opens the sheet on that stair, and "לתלמידים שבחרתי" sends only the ones ticked', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher/lessons', keyTeacher());
    await page.getByRole('region', { name: 'מספרים מכוונים' }).getByRole('button', { name: 'לתת לכיתה: כפל וחילוק' }).click();
    const s = sheet(page, 'משימה לכיתה ז׳3');
    await expect(s.getByLabel('איזו מדרגה?')).toHaveValue('signed:3');
    await expect(s.getByRole('radio', { name: /לכל הכיתה \(2\)/ })).toBeChecked();
    await s.getByRole('radio', { name: 'לתלמידים שבחרתי' }).check();
    const send = s.getByRole('button', { name: 'שליחה לכיתה' });
    await expect(send).toBeDisabled();
    await expect(s.getByText('עוד לא נבחרו תלמידים.')).toBeVisible();
    await s.getByRole('group', { name: 'התלמידים שיקבלו את המשימה' }).getByRole('checkbox', { name: 'יואב' }).check();
    await expect(s.getByText('נבחר תלמיד אחד.')).toBeVisible();
    await send.click();
    await expect(sheet(page, 'לספר לכיתה?')).toBeVisible();
    expect(log.find((r) => r.path === '/api/teacher/assignments' && r.method === 'POST').body).toMatchObject({ kind: 'stair', skill: 'signed:3', targets: ['b2'] });
  });
});

// TEACHER-5: the student sees the teacher's work at the top of today's mission, in calm words; the stairs the teacher
// gave report how far they are; the missions tab has a dot for new work; a student with no class sees none of it.
test.describe('TEACHER-5: the teacher\'s work on the student\'s side', () => {
  const MONDAY = new Date('2026-11-09T10:00:00');
  const inClass = (extra = {}) => withServer({ profile: { role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', teacherName: 'רונית', token: 'stok-a1', studentId: 'a1' }, ...extra });
  const given = (over = {}) => ({ id: 'a000000000000001', kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', note: 'לקראת המבחן ביום חמישי',
    startsOn: '2026-11-09', dueOn: '2026-11-12', forAll: true, targets: [], createdAt: '2026-11-09T07:00:00.000Z', ...over });
  const check = (over = {}) => given({ id: 'a000000000000002', kind: 'check', skill: 'signed:2', title: 'בדיקת שליטה: השוואת מספרים', note: '', startsOn: '2026-11-02', dueOn: '2026-11-06', createdAt: '2026-11-02T07:00:00.000Z', ...over });
  const later = given({ id: 'a000000000000003', skill: 'coord:1', title: 'מערכת צירים: קריאת נקודה', note: '', dueOn: '2026-11-19', createdAt: '2026-11-09T07:05:00.000Z' });
  const workPosts = (log) => log.filter((r) => r.path.startsWith('/api/class/work/') && r.method === 'POST');
  const missionsTab = (page) => page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link', { name: /^משימות/ });

  test('1. "מהמורה רונית" first in today\'s mission, in calm words; the big button starts the earliest work', async ({ page }) => {
    const { log } = await fakeServer(page, { today: '2026-11-09', assignments: [given(), check(), later] }, baseOf());
    await open(page, '#/quests', inClass(), { at: MONDAY });
    const block = page.getByRole('region', { name: 'מהמורה רונית' });
    await expect(block).toBeVisible();
    const rows = block.getByRole('list', { name: 'מהמורה רונית' }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    // the check whose date passed comes first, without pressure; the stair is due on Thursday, with the teacher's note
    await expect(rows.nth(0)).toContainText('בדיקת שליטה: השוואת מספרים');
    await expect(rows.nth(0)).toContainText('בדיקת שליטה · המועד עבר, ועדיין אפשר להשלים');
    await expect(rows.nth(1)).toContainText('מספרים מכוונים: חיבור וחיסור');
    await expect(rows.nth(1)).toContainText('מדרגה ללמוד · עד יום חמישי, 12.11');
    await expect(rows.nth(1)).toContainText('“לקראת המבחן ביום חמישי”');
    await expect(rows.nth(1).getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'שלב 1 מתוך 5');
    // the one due in ten days waits folded
    const fold = block.getByRole('button', { name: 'עוד משימות מהמורה (1)' });
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await fold.click();
    await expect(block.getByRole('list', { name: 'עוד משימות מהמורה' })).toContainText('מערכת צירים: קריאת נקודה');
    await fold.click();
    // no red and no "late" for a child
    await expect(page.locator('.teacher, .tw-chip-late, .aw-late')).toHaveCount(0);
    await expect(page.getByText('באיחור')).toHaveCount(0);
    const go = page.locator('.continue-go');
    await expect(go).toHaveText('מתחילים במשימה מהמורה');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'student-today-teacher-work');
    // the big button opens the check the teacher gave; starting it tells the teacher, and nothing more
    await go.click();
    await expect(page).toHaveURL(/#\/lesson\/signed\/2\?kind=check&purpose=mastery&assignment=a000000000000002$/);
    await expect.poll(() => workPosts(log).length).toBe(1);
    expect(workPosts(log)[0]).toMatchObject({ path: '/api/class/work/a000000000000002', body: { state: 'started' }, headers: { authorization: 'Bearer stok-a1' } });
    // the stair's row leads to its page, which says it is the teacher's work
    await page.goto('./#/quests');
    await page.getByRole('link', { name: 'מספרים מכוונים: חיבור וחיסור' }).click();
    await expect(page).toHaveURL(/#\/learn\/signed\/1\?assignment=a000000000000001$/);
    await expect(page.getByText('משימה מהמורה, עד יום חמישי, 12.11')).toBeVisible();
  });

  test('2. finishing stage A of the stair the teacher gave reports stage 1', async ({ page }) => {
    const { log, st } = await fakeServer(page, { today: '2026-11-09', assignments: [given()] }, baseOf());
    await open(page, '#/learn/signed/1?assignment=a000000000000001', inClass(), { at: MONDAY });
    await expect(page.getByText('משימה מהמורה, עד יום חמישי, 12.11')).toBeVisible();
    await page.getByRole('button', { name: 'מבינים את הרעיון: פתיחה' }).click();
    await expect(page.locator('.step-player')).toBeVisible();
    for (let i = 0; i < 20; i += 1) {
      await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
      const s = await page.evaluate(() => window.__madregotStep);
      if (s.kind === 'explore') {
        await expect.poll(() => page.evaluate(() => window.__madregotSolveStep?.forStep === window.__madregotStep)).toBe(true);
        await page.evaluate(() => window.__madregotSolveStep());
        await page.locator('.lm-check').click();
        await expect(page.locator('.lm-actions.has-good')).toBeVisible();
      }
      if (s.kind === 'predict') { await page.locator('.ls-choice').nth(s.answer).click(); await page.locator('.lm-check').click(); await expect(page.locator('.lm-actions.has-good')).toBeVisible(); }
      const nextBtn = page.locator('.sp-next');
      const last = (await nextBtn.textContent()).includes('לדוגמה');
      await nextBtn.click();
      if (last) break;
    }
    await expect(page.locator('.stage-done')).toContainText('שלב 1 הושלם!');
    await expect.poll(() => workPosts(log).length).toBe(1);
    expect(workPosts(log)[0]).toMatchObject({ path: '/api/class/work/a000000000000001', body: { state: 'started', stage: 1, passed: false } });
    expect(st.work.a000000000000001.a1).toMatchObject({ state: 'started', stage: 1 });
    // the report was confirmed: nothing waits on the device
    await expect.poll(async () => (await saved(page)).workOutbox).toEqual({});
  });

  test('5. a student with no class sees no "מהמורה" block, and nothing is asked', async ({ page }) => {
    const { log } = await fakeServer(page, { today: '2026-11-09', assignments: [given()] }, baseOf());
    await open(page, '#/quests', withServer(), { at: MONDAY });
    await expect(page.getByRole('heading', { name: 'המשימה שלי להיום' })).toBeVisible();
    await expect(page.getByText(/מהמורה/)).toHaveCount(0);
    await expect(missionsTab(page)).toHaveAccessibleName('משימות');
    await page.goto('./#/');
    await expect(page.locator('.learn-work-chip')).toHaveCount(0);
    expect(log.filter((r) => r.path.startsWith('/api/class/'))).toHaveLength(0);
  });

  test('6. the missions tab has a dot for new work, the home has a chip, and opening the missions clears the dot', async ({ page }) => {
    await fakeServer(page, { today: '2026-11-09', assignments: [given()] }, baseOf());
    await open(page, '#/', inClass(), { at: MONDAY });
    await expect(missionsTab(page)).toHaveAccessibleName('משימות · יש משהו חדש מהמורה');
    await expect(page.locator('.tab-dot')).toHaveCount(1);
    const chip = page.getByRole('link', { name: 'משימה מהמורה: מספרים מכוונים: חיבור וחיסור · עד יום חמישי' });
    await expect(chip).toBeVisible();
    expect((await chip.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'student-home-teacher-chip');
    await chip.click();
    await expect(page).toHaveURL(/#\/quests$/);
    await expect(page.getByRole('region', { name: 'מהמורה רונית' })).toBeVisible();
    await expect(missionsTab(page)).toHaveAccessibleName('משימות');
    await expect(page.locator('.tab-dot')).toHaveCount(0);
    // and it stays gone after a reload
    await page.reload();
    await expect(page.getByRole('region', { name: 'מהמורה רונית' })).toBeVisible();
    await expect(page.locator('.tab-dot')).toHaveCount(0);
  });
});
