// The teacher's side, end to end against the fake server (e2e/fakeServer.js: no Worker, no email, no payment company).
// Grouped by spec item. Every name and address is synthetic (example.test).
//
// TEACHER-1: a teacher signs in with an email code and the class follows the email to any device; a lost phone costs
// nothing. The public site (this suite's own build, with no server) sends teachers to the full app. The sign-in
// survives a reload, unless the teacher said it is a shared computer. The board offers to bind a class that only its
// key opens, adds the email's other classes, and says how to come back when leaving.
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
import { NOW, student } from './helpers.js';
import { API, TOKEN, fakeServer } from './fakeServer.js';

const EMAIL = 'teacher@example.test';

/** Open a route on a device with a saved state (seeded before the app starts). `local`: more localStorage keys. */
let seeds = 0;
async function open(page, route, state = null, { local = {} } = {}) {
  await page.clock.setFixedTime(NOW);
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
const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, ...extra }), version: 3 });
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
