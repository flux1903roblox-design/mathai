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
// TEACHER-3: a class practice exam from the board's tools: stairs (a whole unit at once), a length, one or two versions;
// the sheet with its title and version switch; printing the exam (the name line, the questions) or the key (a page per
// version, answers and steps, no question text), and a PDF of each (test-results/teacher-exam-{exam,key}.pdf). Sent to
// the class as version ב, the post carries ב's frozen questions; the assignment prints again, read-only (a:<id>).
//
// TEACHER-6: help both ways. The teacher filters the requests, reads the thread, fills the box with a quick reply,
// sends (a link is refused), and meets the limit of three; "מחר" counts a student's answer as new; the owner turns the
// daily email on. The student gets one calm notice outside lessons, the tab's dot, the thread in a sheet (read on
// opening), and answers "עדיין לא ברור לי" or "תודה, הבנתי" only after the teacher wrote.
//
// TEACHER-7: the class report from the board's tools: its ranges (the default two weeks, this week from Sunday, a range
// of the teacher's own), a row per student, the CSV (the BOM, the header, no id: test-results/teacher-report.csv) and
// the printout (landscape, the table only: test-results/teacher-report.pdf); the year's CSV from the class settings and
// from the delete sheet.
//
// TEACHER-9: the class settings, opened from the board's tools: the class's name, grade, code and join lock; the email
// it is bound to and the teacher key, with a new key after a fresh code; how long the data is kept (the words come from
// shared/retention.js); and deleting the class, which waits for its name to be typed and, for a class bound to an
// email, for the owner's fresh code. Student AI by the Ministry's rules (TRUST-11's screens, trust §E.8's words): the
// card in a school class before approval (off, the reason, no switch) and its licence (the quote only); consent and the
// switch once approved; the per-student switch and badge; "איפה הכיתה הזו לומדת?" in TeacherStart, AddClass and the
// settings (a change asks first; a private group needs the attestation).
//
// TEACHER-10: the pilot kit from the board's tools: the list of five documents; the parent letter filled in from the
// pilot's form (kept on the class), the preview with the class and the dates, the print (the document only, the slip
// on a new page under a dashed cut line: test-results/teacher-guide-letter.pdf), "העתקה" and the short version on the
// clipboard; the principal form with the same details (test-results/teacher-guide-principal.pdf); the new class's link
// and the consent block's; the demo class's guide with "בית ספר לדוגמה" and no request to /api.
//
// TEACHER-15: the demo class on this suite's own build (no server): from "אני מורה" to a board of 24 invented students
// under the demo banner, every tab, a student's page, the settings (no delete, no new key), assigning, a reply, the
// library and a stage, the exam key under print media, the report's CSV (the demo's file name, the BOM) and the
// assistant's labelled sample, with no request to /api at all; a reload keeps it; on a student's device it opens in a
// new tab and the student's saved state is untouched; #/?start=demo and ?qa-teacher=demo open it directly.
//
// Visual baselines (TEACHER-14 §3): every shot() is compared with its reviewed picture in
// e2e/__screens__/<project>/teacher-<name>.png, on all four projects (phone-small 320, phone 390, tablet 768, desktop
// 1440). After an intended change, look at the new pictures before accepting them:
//   npx playwright test -c e2e/playwright.config.js teacher.spec.js --update-snapshots
// TEACHER_SHOTS=<folder> also keeps a copy of each picture there, toasts included, for a look outside the suite.
import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOW, student, item, answer, proceed } from './helpers.js';
import { API, TOKEN, fakeServer } from './fakeServer.js';
import { MOE_RULES } from '../../shared/schoolRules.js';
import { AI_COPY, SETTING_Q, ATTEST } from '../src/content/classAi.js';

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
// a class this device opened with the key flow (createdHere): only such a device is offered to bind it to the email
const keyClass = { code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7', createdHere: true };
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

/** Toasts leave on their own timer, so the compared picture hides them (each test checks their words). */
const SHOT_CSS = fileURLToPath(new URL('./shots.css', import.meta.url));
/** The screen as it is now, compared with its baseline teacher-<name>.png (a "student-…" name gets the prefix too). */
async function shot(page, name) {
  const file = name.startsWith('teacher-') ? name : `teacher-${name}`;
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${file}.png`, { stylePath: SHOT_CSS });
  const dir = process.env.TEACHER_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${file}.png` });
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
    await expect(page.getByText(`לא מצאנו כיתות שמקושרות ל־${EMAIL}. אם פתחתם כיתה בלי מייל, נכנסים עם קוד הכיתה ומפתח המורה, ואז מקשרים אותה למייל בהגדרות הכיתה.`)).toBeVisible();
    await shot(page, 'teacher-restore-empty');
    await page.getByRole('button', { name: 'כניסה עם קוד ומפתח' }).click();
    await page.getByLabel('קוד כיתה').fill('K7Q2MD');
    await page.getByLabel('מפתח מורה').fill('tkey-123');
    await page.getByRole('button', { name: 'כניסה ללוח' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    // the key was typed in: this may be a co-teacher's device, so the board does not ask to bind the class (the review
    // of the teacher lane); the settings say who binds it, and the teacher who opened it confirms first
    expect((await saved(page)).profile.classes[0].createdHere).toBe(false);
    await expect(page.getByRole('region', { name: 'קישור הכיתה למייל' })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await expect(page.getByText('את הכיתה מקשר למייל רק מי שפתח אותה. מורים נוספים נכנסים עם מפתח המורה.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'לקשר למייל שלי' })).toHaveCount(0);
    await page.getByRole('button', { name: 'אני פתחתי את הכיתה הזו' }).click();
    const ask = page.getByRole('dialog', { name: 'לקשר את הכיתה למייל שלכם?' });
    await expect(ask).toContainText('רק מי שפתח את הכיתה מקשר אותה למייל שלו.');
    await ask.getByRole('button', { name: 'כן, אני פתחתי אותה' }).click();
    await expect(page.getByText(`הכיתה ז׳3 מקושרת עכשיו ל־${EMAIL}.`)).toBeVisible();
    await expect(page.getByText(`מקושרת ל־${EMAIL}.`)).toBeVisible();
    expect(log.filter((r) => r.path === '/api/teacher/class/owner')).toHaveLength(1);
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

  // the review of the teacher lane: a co-teacher who was given the key bound the class to their own email by pressing
  // the same card, and the class left the teacher who opened it
  test('a device that came with the key is not asked to bind the class; a class bound from another device says when, and how to undo it', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/teacher', keyTeacher({ createdHere: false }));
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await expect(page.getByRole('region', { name: 'קישור הכיתה למייל' })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await expect(page.getByText('את הכיתה מקשר למייל רק מי שפתח אותה. מורים נוספים נכנסים עם מפתח המורה.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'לקשר למייל שלי' })).toHaveCount(0);
    const quiet = page.getByRole('button', { name: 'אני פתחתי את הכיתה הזו' });
    expect((await quiet.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => document.getElementById('ts-access').scrollIntoView({ block: 'start' }));
    await shot(page, 'teacher-settings-key-device');
    // "לא, חזרה" binds nothing
    await quiet.click();
    await page.getByRole('dialog', { name: 'לקשר את הכיתה למייל שלכם?' }).getByRole('button', { name: 'לא, חזרה' }).click();
    expect(log.filter((r) => r.path === '/api/teacher/class/owner')).toHaveLength(0);

    // the class was bound to an email from another device on 4 November: every device that opens it with the key is told,
    // the one that opened it too, and none of them is offered to bind it
    st.lateBoundAt = '2026-11-04T09:00:00.000Z';
    await open(page, '#/teacher', keyTeacher());
    const line = page.getByRole('link', { name: 'הכיתה קושרה למייל ב־04.11.2026, לא מהמכשיר הזה. לפרטים' });
    await expect(line).toBeVisible();
    await expect(page.getByRole('region', { name: 'קישור הכיתה למייל' })).toHaveCount(0);
    expect((await line.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'teacher-bound-elsewhere-board');
    await line.click();
    await expect(page).toHaveURL(/#\/teacher\/settings$/);
    const status = page.locator('.t-bound');
    await expect(status).toHaveText('הכיתה קושרה למייל ב־04.11.2026, לא מהמכשיר הזה. מפתח המורה ממשיך לפתוח אותה כאן.אם זה לא נעשה בידיעתכם, כתבו לנו עד 11.11.2026, ונבטל את הקישור.');
    await expect(status).toBeInViewport();
    await expect(page.getByRole('button', { name: 'לקשר למייל שלי' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'אני פתחתי את הכיתה הזו' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'העתקת מפתח המורה tkey-123' })).toBeVisible();
    await shot(page, 'teacher-bound-elsewhere');
    // after the week the board says nothing more; the settings still say whose class it is now
    await open(page, '#/teacher', keyTeacher(), { at: new Date('2026-11-12T10:00:00') });
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await expect(line).toHaveCount(0);
    await page.goto('./#/teacher/settings');
    await expect(status).toHaveText('הכיתה קושרה למייל ב־04.11.2026, לא מהמכשיר הזה. מפתח המורה ממשיך לפתוח אותה כאן.');
  });

  test('the owner of a class bound late cannot replace the key in the first week, and the page says from when', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { owned: true, rekeyFrom: '2026-11-11T09:00:00.000Z' }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/teacher/settings', ownedTeacher(), { local: { 'madregot-parent': JSON.stringify({ token: TOKEN(9), email: EMAIL, shared: false }) } });
    await expect(page.getByText(`מקושרת ל־${EMAIL}.`)).toBeVisible();
    await expect(page.getByText('אפשר ליצור מפתח מורה חדש מ־11.11.2026. בשבוע הראשון אחרי הקישור למייל המפתח נשאר כמו שהוא, כדי שאפשר יהיה לתקן קישור שנעשה בטעות.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'החלפת מפתח המורה' })).toHaveCount(0);
    await expect(page.locator('.t-bound')).toHaveCount(0);
    expect(log.filter((r) => r.path === '/api/teacher/class/rekey')).toHaveLength(0);
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
    // the page has its licence card before the tap, so the page under the sheet is where it stays (the picture)
    await expect(page.getByRole('button', { name: 'הצעת מחיר לבית הספר' })).toBeVisible();
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

test.describe('TEACHER-9: student AI by the Ministry\'s rules, the licence in the settings, the per-student switch', () => {
  const session = (n = 9) => ({ 'madregot-parent': JSON.stringify({ token: TOKEN(n), email: EMAIL, shared: false }) });
  const aiCard = (page) => page.getByRole('region', { name: AI_COPY.switch });
  const aiPosts = (log) => log.filter((r) => r.path === '/api/teacher/class/ai').map((r) => r.body);

  test('a school class before approval: "כבוי", the Ministry\'s words and link, no switch; the licence offers only the quote', async ({ page }) => {
    const { log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/teacher/settings', keyTeacher());
    const card = aiCard(page);
    await expect(card.getByText('לתלמידים בכיתה:')).toContainText(AI_COPY.off);
    await expect(card.getByText(AI_COPY.notInCatalogue)).toBeVisible();
    await expect(card.getByText(AI_COPY.prep)).toBeVisible();
    const rules = card.getByRole('link', { name: AI_COPY.rulesLink });
    await expect(rules).toHaveAttribute('href', MOE_RULES.url);
    await expect(rules).toHaveAttribute('target', '_blank');
    await expect(card.getByRole('switch')).toHaveCount(0);
    await expect(card.getByRole('checkbox')).toHaveCount(0);
    await expect(card.getByRole('radio', { name: /בבית ספר/ })).toBeChecked();
    // the licence: §E.8's school-before-approval text and one button
    const lic = page.locator('#t-licence');
    await expect(page.getByRole('heading', { name: AI_COPY.licenceTitle, exact: true })).toBeVisible();
    await expect(lic.getByText(AI_COPY.licenceBeforeApproval)).toBeVisible();
    await expect(lic.getByRole('button')).toHaveText([AI_COPY.quote]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-settings-school-ai-off');
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'teacher-settings-school-ai-off-card');
    await lic.getByRole('button', { name: AI_COPY.quote }).click();
    await expect(page.getByRole('dialog', { name: AI_COPY.quote })).toBeVisible();
    await page.keyboard.press('Escape');
    // "מחר" has no licence card any more, and no line while the licence is not ending; the sheet has no AI row
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await expect(page.locator('#t-licence')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /רישיון הכיתה/ })).toHaveCount(0);
    await page.getByRole('tab', { name: 'תלמידים' }).click();
    await page.getByRole('button', { name: 'פרטים על דנה' }).click();
    const sheet = page.getByRole('dialog', { name: 'דנה' });
    await expect(sheet.getByRole('button', { name: 'הסרה מהכיתה' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: AI_COPY.studentOff })).toHaveCount(0);
    await expect(sheet.getByText(AI_COPY.badge)).toHaveCount(0);
    expect(aiPosts(log)).toEqual([]);
  });

  test('approved, consent needed: the Ministry\'s forms, the box and "שמירה" post {consent:true}; then the switch; one student off on their sheet', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { owned: true, ai: { approval: 'approved' } }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/teacher/settings', ownedTeacher(), { local: session() });
    const card = aiCard(page);
    await expect(card.getByText(AI_COPY.consentSchool)).toBeVisible();
    await expect(card.getByRole('link', { name: AI_COPY.consentPortal })).toHaveAttribute('href', MOE_RULES.consentFormUrl);
    await expect(card.getByRole('link', { name: AI_COPY.consentPdf })).toHaveAttribute('href', MOE_RULES.consentPdfUrl);
    await expect(card.getByRole('switch')).toHaveCount(0);
    const save = card.getByRole('button', { name: AI_COPY.save });
    await expect(save).toBeDisabled();
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'teacher-settings-consent');
    await card.getByRole('checkbox', { name: AI_COPY.consentSchoolBox }).check();
    await save.click();
    await expect(page.getByText('אישור ההורים נשמר.')).toBeVisible();
    expect(aiPosts(log)).toEqual([{ consent: true }]);
    expect(log.find((r) => r.path === '/api/teacher/class/ai').headers['x-account-token']).toBe(TOKEN(9));
    // the switch, off, with the day the consent was recorded
    const sw = card.getByRole('switch', { name: AI_COPY.switch });
    await expect(sw).not.toBeChecked();
    await expect(card.getByText(AI_COPY.consentAt('05.11.2026'))).toBeVisible();
    await sw.click();
    await expect(page.getByText(AI_COPY.turnedOn)).toBeVisible();
    await expect(sw).toBeChecked();
    await expect(card.getByText('לתלמידים בכיתה:')).toContainText(AI_COPY.on);
    expect(aiPosts(log).at(-1)).toEqual({ studentAi: 'on' });
    await shot(page, 'teacher-settings-ai-on');
    // the licence may be offered now: the card is the usual one
    await expect(page.locator('#t-licence').getByRole('heading', { name: 'העוזר החכם בכיתה' })).toBeVisible();
    // on the board: the student's sheet turns it off for her alone, with the badge; the table shows it too
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await page.getByRole('tab', { name: 'תלמידים' }).click();
    await page.getByRole('button', { name: 'פרטים על דנה' }).click();
    const sheet = page.getByRole('dialog', { name: 'דנה' });
    await sheet.getByRole('button', { name: AI_COPY.studentOff }).click();
    await expect(page.getByText('העוזר החכם כבוי לדנה.')).toBeVisible();
    await expect(sheet.getByText(AI_COPY.badge)).toBeVisible();
    await expect(sheet.getByRole('button', { name: AI_COPY.studentOn })).toBeVisible();
    const off = log.find((r) => r.path === '/api/teacher/students/a1/ai');
    expect(off.body).toEqual({ off: true });
    expect(st.students.find((x) => x.id === 'a1').aiOff).toBe(true);
    // after a reload (the toast gone): the table's badge, and the sheet as the teacher finds it next time
    await page.reload();
    await expect(page.getByRole('row', { name: /דנה/ }).getByText(AI_COPY.badge)).toBeVisible();
    await expect(page.getByRole('row', { name: /יואב/ }).getByText(AI_COPY.badge)).toHaveCount(0);
    await page.getByRole('button', { name: 'פרטים על דנה' }).click();
    await expect(sheet.getByText(AI_COPY.badge)).toBeVisible();
    await shot(page, 'teacher-student-ai-off');
    await sheet.getByRole('button', { name: AI_COPY.studentOn }).scrollIntoViewIfNeeded();
    await shot(page, 'teacher-student-ai-actions');
    // and on again
    await sheet.getByRole('button', { name: AI_COPY.studentOn }).click();
    await expect(sheet.getByText(AI_COPY.badge)).toHaveCount(0);
    expect(log.filter((r) => r.path === '/api/teacher/students/a1/ai').map((r) => r.body)).toEqual([{ off: true }, { off: false }]);
  });

  test('"איפה הכיתה הזו לומדת?": a new class posts its setting, a private group needs the attestation; a change in the settings asks first', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), {}, baseOf());
    await open(page, '#/', fresh());
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await signIn(page);
    await page.locator('#t-name').fill('רונית כהן');
    await page.locator('#t-class').fill('קבוצת תגבור');
    const where = page.getByRole('group', { name: SETTING_Q });
    await expect(where.getByRole('radio', { name: /בבית ספר/ })).toBeChecked();
    await expect(where).toContainText('העוזר החכם לתלמידים פועל לפי ההנחיות של משרד החינוך');
    await where.getByRole('radio', { name: /בשיעורים פרטיים, חוג או תגבור/ }).check();
    await expect(where).toContainText('ההורים מחליטים על העוזר החכם');
    const open1 = page.getByRole('button', { name: 'פתיחת הכיתה' });
    await expect(open1).toBeDisabled();
    await shot(page, 'teacher-start-setting');
    await where.getByRole('checkbox', { name: ATTEST }).check();
    await open1.click();
    await expect(page.getByRole('heading', { name: 'הכיתה מוכנה!' })).toBeVisible();
    expect(log.find((r) => r.path === '/api/classes').body).toMatchObject({ className: 'קבוצת תגבור', setting: 'private', privateAttest: true });
    expect(st.ai.setting).toBe('private');
    // the settings: a private group, consent first, no Ministry form
    await page.goto('./#/teacher/settings');
    const card = aiCard(page);
    await expect(card.getByRole('radio', { name: /בשיעורים פרטיים/ })).toBeChecked();
    await expect(card.getByText(AI_COPY.consentPrivate)).toBeVisible();
    await expect(card.getByRole('checkbox', { name: AI_COPY.consentPrivateBox })).toBeVisible();
    await expect(card.getByRole('link', { name: AI_COPY.consentPortal })).toHaveCount(0);
    // back to a school class: asked first (the choice stays as it was until the change is confirmed), then the rule says off
    await card.getByRole('radio', { name: /בבית ספר/ }).click();
    const toSchool = page.getByRole('dialog', { name: 'לשנות לכיתה בבית ספר?' });
    await expect(toSchool).toContainText('לבית ספר ולקבוצה פרטית יש כללים שונים לעוזר החכם.');
    await toSchool.getByRole('button', { name: 'לא לשנות' }).click();
    await expect(card.getByRole('radio', { name: /בשיעורים פרטיים/ })).toBeChecked();
    expect(aiPosts(log)).toEqual([]);
    await card.getByRole('radio', { name: /בבית ספר/ }).click();
    await toSchool.getByRole('button', { name: 'לשנות', exact: true }).click();
    await expect(page.getByText('המקום שבו הכיתה לומדת עודכן.')).toBeVisible();
    await expect(card.getByText(AI_COPY.notInCatalogue)).toBeVisible();
    expect(aiPosts(log)).toEqual([{ setting: 'school' }]);
    await expect(card.getByRole('radio', { name: /בבית ספר/ })).toBeChecked();
    // and private again: the attestation is required in the sheet
    await card.getByRole('radio', { name: /בשיעורים פרטיים/ }).click();
    const toPrivate = page.getByRole('dialog', { name: 'לשנות לקבוצה פרטית?' });
    const change = toPrivate.getByRole('button', { name: 'לשנות', exact: true });
    await expect(change).toBeDisabled();
    await shot(page, 'teacher-settings-change-setting');
    await toPrivate.getByRole('checkbox', { name: ATTEST }).check();
    await change.click();
    await expect(card.getByText(AI_COPY.consentPrivate)).toBeVisible();
    expect(aiPosts(log).at(-1)).toEqual({ setting: 'private', privateAttest: true });
    // a second class from the board asks the same, a school class unless changed
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await page.getByRole('button', { name: 'כיתה נוספת' }).click();
    const add = page.getByRole('dialog', { name: 'כיתה נוספת' });
    await add.getByLabel('שם הכיתה החדשה').fill('ח׳2');
    await expect(add.getByRole('group', { name: SETTING_Q }).getByRole('radio', { name: /בבית ספר/ })).toBeChecked();
    await shot(page, 'teacher-add-class-setting');
    await add.getByRole('button', { name: 'פתיחת הכיתה' }).click();
    await expect(add).toBeHidden();
    expect(log.filter((r) => r.path === '/api/classes').at(-1).body).toMatchObject({ className: 'ח׳2', setting: 'school' });
    expect(log.filter((r) => r.path === '/api/classes').at(-1).body.privateAttest).toBeUndefined();
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
    const { st, log } = await fakeServer(page, {}, baseOf());
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
    // a group its teacher marked private (TRUST-11: the dashboard's aiPolicy.setting) is not a school class: the line
    // about the class goes
    st.ai.setting = 'private';
    await open(page, '#/teacher/assistant', keyTeacher());
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

test.describe('TEACHER-3: a class practice exam, printed with its key, in two versions', () => {
  const tools = (page) => page.getByRole('navigation', { name: 'כלים' });
  const PDF_DIR = path.join(process.cwd(), 'test-results');
  /** Print a mode as the buttons do (<html data-print>), under print media. */
  const printAs = async (page, mode) => {
    await page.evaluate((m) => { document.documentElement.dataset.print = m; }, mode);
    await page.emulateMedia({ media: 'print' });
  };

  test('6 questions on 2 stairs in two versions: the sheet, the print of each mode, the key, and the PDFs', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await tools(page).getByRole('link', { name: 'מבחן להדפסה' }).click();
    await expect(page).toHaveURL(/#\/teacher\/exam\/new$/);
    await expect(page.getByText('על אילו מדרגות יהיה המבחן?')).toBeVisible();
    await expect(page.getByText('עוד לא הכנתם מבחן. מבחן תרגול מוכן בשתי דקות, עם מפתח תשובות.')).toBeVisible();
    const next = page.getByRole('button', { name: 'המשך', exact: true });
    await expect(next).toBeDisabled();
    // "כל היחידה" ticks a whole topic, and again clears it
    const unit = page.getByRole('checkbox', { name: 'כל היחידה: מספרים מכוונים' });
    await unit.click();
    await expect(unit).toHaveAttribute('aria-checked', 'true');
    // all six stairs of signed numbers (the sixth, signed fractions and decimals, is the curriculum lane's)
    await expect(page.getByRole('group', { name: 'מספרים מכוונים' }).getByRole('checkbox', { checked: true })).toHaveCount(6);
    await page.getByRole('checkbox', { name: '1. חיבור וחיסור' }).click();
    await expect(unit).toHaveAttribute('aria-checked', 'mixed');
    await unit.click(); await unit.click();
    await expect(unit).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('checkbox', { name: '3. כפל וחילוק' }).click();
    await page.getByRole('checkbox', { name: '3. אורך קטע' }).click();
    await expect(page.getByText('נבחרו 2 מדרגות.')).toBeVisible();
    // the builder from its top (ticking "3. אורך קטע", below signed numbers' six stairs, scrolled the page)
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-exam-new');
    await next.click();
    await expect(page.getByText('כמה שאלות?')).toBeVisible();
    await page.getByRole('radio', { name: /6 שאלות/ }).click();
    await next.click();
    await expect(page.getByText('גרסה אחת או שתיים?')).toBeVisible();
    await expect(page.getByRole('radio', { name: /שתי גרסאות, א׳ ו־ב׳/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'הכנת המבחן' }).click();

    await expect(page).toHaveURL(/#\/teacher\/exam\/[a-f0-9]{12}$/);
    const sheet = page.locator('.xs-screen');
    await expect(sheet.locator('.exam-q')).toHaveCount(6);
    await expect(sheet.getByRole('heading', { name: 'מבחן תרגול: מספרים מכוונים, מערכת צירים' })).toBeVisible();
    await expect(sheet).toContainText('כיתה: ז׳3');
    const [te] = (await saved(page)).teacherExams;
    expect(te).toMatchObject({ classCode: 'K7Q2MD', skills: ['signed:3', 'coord:3'], count: 6, assignmentId: null });
    expect(te.versions.map((v) => v.label)).toEqual(['א', 'ב']);
    for (const v of te.versions) {
      expect(v.items.map((x) => x.topic)).toEqual(['signed', 'coord', 'signed', 'coord', 'signed', 'coord']);
      expect(v.items.every((x) => x.answerText && !('diag' in x))).toBe(true);
    }
    const keysA = te.versions[0].items.map((x) => x.key);
    expect(te.versions[1].items.filter((x) => keysA.includes(x.key))).toEqual([]);
    // the version switch: ב shows ב's questions
    const vB = page.getByRole('radio', { name: 'גרסה ב׳' });
    await expect(page.getByRole('radio', { name: 'גרסה א׳' })).toBeChecked();
    await shot(page, 'teacher-exam-sheet');
    await vB.check();
    await expect(sheet).toContainText('גרסה ב׳');
    await page.getByRole('radio', { name: 'גרסה א׳' }).check();
    // the title can change, up to 80 characters
    const title = page.getByLabel('כותרת המבחן');
    await title.fill('מבחן תרגול לפני החנוכה');
    await expect(sheet.getByRole('heading', { name: 'מבחן תרגול לפני החנוכה' })).toBeVisible();
    await expect(title).toHaveAttribute('maxlength', '80');
    expect((await saved(page)).teacherExams[0].title).toBe('מבחן תרגול לפני החנוכה');

    // the buttons say which mode prints, and the mode ends when the print dialog closes
    await page.evaluate(() => { window.__printed = []; window.print = () => window.__printed.push(document.documentElement.dataset.print); });
    await page.getByRole('button', { name: 'הדפסת המבחן' }).click();
    await page.getByRole('button', { name: 'הדפסת מפתח התשובות' }).click();
    expect(await page.evaluate(() => window.__printed)).toEqual(['exam', 'key']);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await page.evaluate(() => document.documentElement.dataset.print || null)).toBe(null);

    // printed, the exam: no bar and no buttons, the name line and the 6 questions of version א
    const exam = page.locator('.print-sheet[data-mode="exam"]');
    const key = page.locator('.print-sheet[data-mode="key"]');
    await printAs(page, 'exam');
    await expect(page.locator('.screen-bar')).toBeHidden();
    await expect(page.getByRole('button', { name: 'הדפסת המבחן' })).toBeHidden();
    await expect(exam).toBeVisible();
    await expect(key).toBeHidden();
    await expect(exam.locator('.ps-name')).toBeVisible();
    await expect(exam.locator('.ps-name')).toHaveText(/^שם:/);
    await expect(exam.locator('.ps-lines')).toContainText('כיתה: ז׳3');
    await expect(exam.locator('.ps-version')).toHaveText('גרסה א׳');
    await expect(exam.locator('.exam-q')).toHaveCount(6);
    await expect(exam.locator('.exam-work').first()).toBeVisible();
    const colour = await exam.locator('.ps-title b').evaluate((el) => getComputedStyle(el).color);
    expect(colour).toBe('rgb(0, 0, 0)');
    mkdirSync(PDF_DIR, { recursive: true });
    const examPdf = await page.pdf({ path: path.join(PDF_DIR, 'teacher-exam-exam.pdf'), preferCSSPageSize: true });
    expect((examPdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBeGreaterThanOrEqual(1);

    // printed, the key: a page per version, 6 answers each with the steps, no question text, and the footnote
    await printAs(page, 'key');
    await expect(exam).toBeHidden();
    await expect(key).toBeVisible();
    const pages = key.locator('.ps-key-page');
    await expect(pages).toHaveCount(2);
    await expect(pages.nth(0).locator('.ps-key-title')).toHaveText('מפתח תשובות: מבחן תרגול לפני החנוכה · גרסה א׳ (למורה)');
    await expect(pages.nth(0).locator('.ps-key-line')).toHaveCount(6);
    await expect(pages.nth(1).locator('.ps-key-line')).toHaveCount(6);
    await expect(key.locator('.qtext, .exam-q, .exam-work')).toHaveCount(0);
    const firstText = te.versions[0].items[0].text.replace(/\$[^$]*\$/g, '').trim();
    if (firstText.length > 6) await expect(key).not.toContainText(firstText);
    await expect(pages.nth(0).locator('.ps-key-line').first()).toContainText(te.versions[0].items[0].answerText.replace(/-/g, '−'));
    await expect(pages.nth(0).locator('.ps-key-steps').first()).toContainText('הדרך:');
    await expect(pages.nth(0).locator('.ps-key-foot')).toContainText('וכל תשובה חושבה ונבדקה בקוד, לא בבינה מלאכותית');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-exam-key');
    const keyPdf = await page.pdf({ path: path.join(PDF_DIR, 'teacher-exam-key.pdf'), preferCSSPageSize: true });
    expect((keyPdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBeGreaterThanOrEqual(2);
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => { delete document.documentElement.dataset.print; });

    // the exam is listed under "מבחנים להדפסה" and opens again
    await page.getByRole('button', { name: 'חזרה למבחנים' }).click();
    const list = page.getByRole('region', { name: 'מבחנים להדפסה' });
    await expect(list.getByRole('link', { name: /מבחן תרגול לפני החנוכה/ })).toContainText('6 שאלות · שתי גרסאות');
    await list.getByRole('link', { name: /מבחן תרגול לפני החנוכה/ }).click();
    await expect(page.locator('.xs-screen .exam-q')).toHaveCount(6);
  });

  test('?skills preselects the stairs; one version prints without a version mark; an unknown exam says so', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher/exam/new?skills=pyth:2,signed:4', keyTeacher());
    // a grade-8 stair given by the address joins the list with its topic
    await expect(page.getByRole('checkbox', { name: '4. סדר פעולות' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('group', { name: 'משפט פיתגורס' }).getByRole('checkbox', { checked: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /14 שאלות/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: 'גרסה אחת' }).click();
    await page.getByRole('button', { name: 'הכנת המבחן' }).click();
    await expect(page.locator('.xs-screen .exam-q')).toHaveCount(14);
    await expect(page.getByRole('radio', { name: 'גרסה ב׳' })).toHaveCount(0);
    await printAs(page, 'exam');
    await expect(page.locator('.print-sheet[data-mode="exam"] .ps-version')).toHaveCount(0);
    await printAs(page, 'key');
    await expect(page.locator('.ps-key-page')).toHaveCount(1);
    await expect(page.locator('.ps-key-title')).not.toContainText('גרסה');
    await page.emulateMedia({ media: 'screen' });
    await page.goto('./#/teacher/exam/000000000000');
    await expect(page.getByRole('heading', { name: 'המבחן לא נמצא' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'מבחן חדש' })).toBeVisible();
  });

  test('sent to the class as version ב: the post carries ב\'s questions; the assignment prints again, read-only', async ({ page }) => {
    const { log, st } = await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher/exam/new', keyTeacher());
    await page.getByRole('checkbox', { name: '3. כפל וחילוק' }).click();
    await page.getByRole('checkbox', { name: '4. סדר פעולות' }).click();
    const next = page.getByRole('button', { name: 'המשך', exact: true });
    await next.click();
    await page.getByRole('radio', { name: /6 שאלות/ }).click();
    await next.click();
    await page.getByRole('button', { name: 'הכנת המבחן' }).click();
    await expect(page.locator('.xs-screen .exam-q')).toHaveCount(6);
    const [te] = (await saved(page)).teacherExams;
    // the version on screen goes with the sheet: ב׳
    await page.getByRole('radio', { name: 'גרסה ב׳' }).check();
    await page.getByRole('button', { name: 'לשלוח לכיתה כמשימה' }).click();
    const sheet = page.getByRole('dialog', { name: 'משימה לכיתה ז׳3' });
    await expect(sheet.getByRole('radio', { name: /^מבחן תרגול\s*מבחן שהכנתם/ })).toBeChecked();
    await expect(sheet.getByRole('radio', { name: new RegExp(`^${te.title}`) })).toBeChecked();
    await expect(sheet.getByRole('radio', { name: 'גרסה ב׳' })).toBeChecked();
    await expect(sheet.getByLabel('איזו מדרגה?')).toHaveCount(0);
    await expect(sheet.getByLabel('כותרת')).toHaveValue(te.title);
    await shot(page, 'teacher-assign-exam');
    await sheet.getByRole('button', { name: 'שליחה לכיתה' }).click();
    await expect(page.getByRole('dialog', { name: 'לספר לכיתה?' })).toBeVisible();
    const post = log.find((r) => r.path === '/api/teacher/assignments' && r.method === 'POST');
    expect(post.body).toMatchObject({ kind: 'exam', title: te.title, exam: { version: 'b' } });
    expect(post.body.skill).toBeUndefined();
    expect(post.body.exam.items.map((x) => x.key)).toEqual(te.versions[1].items.map((x) => x.key));
    expect(post.body.exam.items).toEqual(te.versions[1].items);
    const id = st.assignments[0].id;
    expect((await saved(page)).teacherExams[0].assignmentId).toBe(id);
    await page.getByRole('button', { name: 'סיום' }).click();

    // the assignment's detail prints it again: the version the class got, as the server keeps it, read-only
    await page.goto('./#/teacher?tab=work');
    await page.getByRole('button', { name: new RegExp(te.title) }).click();
    const detail = page.getByRole('dialog', { name: te.title });
    await detail.getByRole('link', { name: 'הדפסת המבחן' }).click();
    await expect(page).toHaveURL(new RegExp(`#/teacher/exam/a:${id}$`));
    await expect(page.locator('.xs-screen .exam-q')).toHaveCount(6);
    await expect(page.locator('.xs-screen')).toContainText('גרסה ב׳');
    await expect(page.getByText('זה המבחן כפי שנשלח לכיתה, גרסה ב׳. אפשר להדפיס אותו ואת מפתח התשובות.')).toBeVisible();
    await expect(page.getByLabel('כותרת המבחן')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'לשלוח לכיתה כמשימה' })).toHaveCount(0);
    await printAs(page, 'key');
    await expect(page.locator('.ps-key-title')).toHaveText(`מפתח תשובות: ${te.title} · גרסה ב׳ (למורה)`);
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: 'חזרה למשימות' }).click();
    await expect(page).toHaveURL(/#\/teacher\?tab=work$/);
  });

  test('"מבחן תרגול" in the assign sheet with no exam for the class: it says so and leads to the builder', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher?tab=work', keyTeacher());
    await page.getByRole('button', { name: 'משימה חדשה' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'משימה לכיתה ז׳3' });
    await sheet.getByRole('radio', { name: /^מבחן תרגול\s*מבחן שהכנתם/ }).check();
    await expect(sheet.getByText('עוד אין מבחן לכיתה הזו.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'שליחה לכיתה' })).toBeDisabled();
    await sheet.getByRole('link', { name: 'להכנת מבחן' }).click();
    await expect(page).toHaveURL(/#\/teacher\/exam\/new$/);
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

  // TEACHER-16: the words the student saw on that stair, with the stair named; the same id on two stairs is two rows
  test('TEACHER-16: each repeated mistake names its stair and says what the student saw there; practice goes to that stair', async ({ page }) => {
    const rows3 = [
      { topic: 'signed', level: 3, cat: 'sign', n: 4, students: 2, ids: ['a1', 'b2'], names: ['דנה', 'יואב'] },
      { topic: 'signed', level: 1, cat: 'sign', n: 2, students: 1, ids: ['a1'], names: ['דנה'] },
      { topic: 'coord', level: 3, cat: 'sign', n: 1, students: 1, ids: ['b2'], names: ['יואב'] },
    ];
    await fakeServer(page, { mistakes: rows3 }, baseOf());
    await open(page, '#/teacher', keyTeacher({ bindLater: '2026-11-30' }));
    const group = page.getByRole('region', { name: 'טעויות שחוזרות השבוע' });
    const rows = group.locator('.t-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.locator('.t-list-main')).toHaveText([
      'מספרים מכוונים, מדרגה 3: כפל וחילוק. הסימן של המכפלה או של המנה יצא הפוך',
      'מספרים מכוונים, מדרגה 1: חיבור וחיסור. התשובה יצאה עם הסימן ההפוך',
      'מערכת צירים, מדרגה 3: אורך קטע. יצא אורך שלילי',
    ]);
    await expect(group).not.toContainText('sign');
    await expect(group).not.toContainText('טעות בסימן של אחד השיעורים'); // the topic's wording, not what the student saw
    await group.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await shot(page, 'teacher-tomorrow-stairs');
    // practice from the level-3 row: that stair, for the two who made the mistake there
    await rows.nth(0).getByRole('button', { name: 'לתת תרגול על זה' }).click();
    const s = sheet(page, 'משימה לכיתה ז׳3');
    await expect(s.getByLabel('איזו מדרגה?')).toHaveValue('signed:3');
    await expect(s.getByRole('radio', { name: /לתלמידים שטעו בזה \(2\)/ })).toBeChecked();
  });

  test('from "מחר": practice on that stair for the two students who made the mistake, then the message and the Classroom link', async ({ page }) => {
    const { st, log } = await fakeServer(page, { mistakes: [mistake] }, baseOf());
    await open(page, '#/teacher', keyTeacher());
    const row = page.locator('.t-row', { hasText: 'התשובה יצאה עם הסימן ההפוך' });
    await expect(row.locator('.t-list-main')).toHaveText('מספרים מכוונים, מדרגה 1: חיבור וחיסור. התשובה יצאה עם הסימן ההפוך');
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
    await expect.poll(() => log.some((r) => r.path === '/api/teacher/assignments' && r.method === 'POST')).toBe(true);
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
    await expect(page.getByText('אפשר לתת לכיתה מדרגה ללמוד, בדיקת שליטה או מבחן תרגול, עם תאריך הגשה.')).toBeVisible();
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
    const posted = () => log.find((r) => r.path === '/api/teacher/assignments' && r.method === 'POST');
    await expect.poll(posted).toBeTruthy();
    const sent = posted();
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
// gave report how far they are; the class exam runs from its start card, its three fixed questions in order, and its
// result reaches the teacher (once, even after a lost connection, with the line that says it waits); the missions tab
// has a dot for new work; a student with no class sees none of it.
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

  // a class exam of three frozen questions, as the teacher's device made them (lib/exam.js freezeItem)
  const EXAM_ITEMS = [
    { key: 'sn3:-8:3', topic: 'signed', level: 3, levelTitle: 'כפל וחילוק', text: 'חשבו:', display: '-8 \\cdot 3', form: 'num', choices: null, fig: null, label: null, unit: null, var: null, exact: null, answer: -24, answerText: '-24', solution: ['הסימנים שונים, לכן התוצאה שלילית.', '$8 \\cdot 3 = 24$'], hint: 'מה קורה לסימן כשכופלים שלילי בחיובי?' },
    { key: 'sn2c:-3:2', topic: 'signed', level: 2, levelTitle: 'השוואת מספרים', text: 'איזה סימן מתאים?', display: '-3 \;\\square\; 2', form: 'mc', choices: [{ tex: '<' }, { tex: '=' }, { tex: '>' }], fig: null, label: null, unit: null, var: null, exact: null, answer: 0, answerText: '<', solution: ['$-3$ משמאל ל־$2$ על ציר המספרים.'], hint: 'איפה כל מספר על הציר?' },
    { key: 'py1:5:5', topic: 'pyth', level: 1, levelTitle: 'מציאת היתר', text: 'במשולש ישר־זווית הניצבים $5$ ו־$5$. מה אורך היתר? עגלו לעשיריות.', display: null, form: 'num', choices: null, fig: null, label: null, unit: 'ס״מ', var: null, exact: Math.sqrt(50), answer: 7.1, answerText: '7.1', solution: ['$5^2 + 5^2 = 50$', '$\\sqrt{50} \\approx 7.1$'], hint: 'מחברים את ריבועי הניצבים.' },
  ];
  const examWork = (over = {}) => given({ id: 'a000000000000004', kind: 'exam', skill: null, title: 'מבחן תרגול: לפני החנוכה', note: '', exam: EXAM_ITEMS, version: 'b', dueOn: '2026-11-11', ...over });
  const typeIn = async (page, v) => { await page.locator('#slot-v').click(); for (const ch of v) await page.getByRole('button', { name: { '.': 'נקודה עשרונית', '-': 'מינוס' }[ch] || ch, exact: true }).click(); await page.getByRole('button', { name: 'בדיקה', exact: true }).click(); };
  /** Through the exam: right, wrong, then 7.07 for √50 (right: the frozen exact length). */
  async function solveExam(page) {
    await expect.poll(() => item(page)).toBeTruthy();
    expect((await item(page)).key).toBe('sn3:-8:3');
    await expect(page.locator('.tools .tool[aria-label="רמז"], .tools .tool.ai, .tools .tool[aria-label="למורה"]')).toHaveCount(0);
    await answer(page, true); await proceed(page);
    await expect.poll(async () => (await item(page)).key).toBe('sn2c:-3:2');
    await answer(page, false); await proceed(page);
    await expect.poll(async () => (await item(page)).key).toBe('py1:5:5');
    await typeIn(page, '7.07');
    await expect(page.locator('section.fb')).toHaveClass(/fb-good/);
    await proceed(page);
  }
  const DONE_QS = [{ topic: 'signed', level: 3, status: 'correct' }, { topic: 'signed', level: 2, status: 'wrong' }, { topic: 'pyth', level: 1, status: 'correct' }];

  test('3. the class exam: the start card, the three questions in order, the result to the teacher; no AI is asked', async ({ page }) => {
    const { log, st } = await fakeServer(page, { today: '2026-11-09', assignments: [examWork()] }, baseOf());
    await open(page, '#/quests', inClass(), { at: MONDAY });
    const block = page.getByRole('region', { name: 'מהמורה רונית' });
    const row = block.getByRole('listitem').filter({ hasText: 'מבחן תרגול: לפני החנוכה' });
    await expect(row).toContainText('מבחן תרגול · עד יום רביעי, 11.11');
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '9 דק׳');
    await page.locator('.continue-go').click();
    await expect(page).toHaveURL(/#\/class\/exam\/a000000000000004$/);
    await expect(page.getByRole('heading', { level: 1, name: 'מבחן תרגול: לפני החנוכה' })).toBeVisible();
    await expect(page.getByText('מבחן תרגול מהמורה: 3 שאלות, בערך 9 דקות.')).toBeVisible();
    await expect(page.getByText('פותרים לבד, בלי רמזים. לכל שאלה יש ניסיון אחד, כמו בבדיקת שליטה. כדאי להחזיק דף טיוטה.')).toBeVisible();
    await expect(page.getByText('התוצאה נשלחת למורה.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'לא עכשיו' })).toBeVisible();
    expect(log.filter((r) => r.path === '/api/class/work/a000000000000004/exam')).toHaveLength(1);
    expect((await saved(page)).classWork.exams.a000000000000004).toEqual(JSON.parse(JSON.stringify(EXAM_ITEMS)));
    await shot(page, 'student-class-exam-start');
    await page.getByRole('button', { name: 'מתחילים' }).click();
    await expect(page).toHaveURL(/#\/class\/exam\/a000000000000004\/run$/);
    await expect.poll(() => workPosts(log).length).toBe(1);
    expect(workPosts(log)[0].body).toEqual({ state: 'started' });
    await solveExam(page);
    await expect(page.getByRole('heading', { name: 'סיימתם את המבחן' })).toBeVisible();
    await expect(page.getByText('2 מתוך 3 תשובות נכונות.')).toBeVisible();
    await expect(page.getByText('התוצאה נשלחה למורה.')).toBeVisible();
    const done = workPosts(log).filter((r) => r.body.state === 'done');
    expect(done).toHaveLength(1);
    expect(done[0].body).toEqual({ state: 'done', right: 2, asked: 3, questions: DONE_QS });
    expect(st.work.a000000000000004.a1).toMatchObject({ state: 'done', right: 2, asked: 3, questions: DONE_QS, tries: 1 });
    // no AI call of any kind (the status of the tutor is not a call to it)
    expect(log.filter((r) => r.path.startsWith('/api/ai/') && r.path !== '/api/ai/status')).toEqual([]);
    await shot(page, 'student-class-exam-done');
    await page.getByRole('button', { name: 'חזרה למשימות' }).click();
    await expect(page).toHaveURL(/#\/quests$/);
    await expect(block.getByRole('listitem').filter({ hasText: 'מבחן תרגול: לפני החנוכה' })).toContainText('הושלם');
    // opened again: it says it was done, and that the teacher sees the first try
    await page.goto('./#/class/exam/a000000000000004');
    await expect(page.getByText('כבר סיימתם את המבחן הזה: 2 מתוך 3. אפשר לפתור אותו שוב, והמורה רואה את הניסיון הראשון.')).toBeVisible();
  });

  test('4. offline at the end: the result waits on the device and says so, then goes to the teacher once', async ({ page }) => {
    const { log, st } = await fakeServer(page, { today: '2026-11-09', assignments: [examWork()] }, baseOf());
    await open(page, '#/class/exam/a000000000000004', inClass(), { at: MONDAY });
    await page.getByRole('button', { name: 'מתחילים' }).click();
    await expect.poll(() => workPosts(log).length).toBe(1);
    st.down = true;
    await solveExam(page);
    await expect(page.getByText('התוצאה תישלח למורה כשיהיה חיבור.')).toBeVisible();
    expect((await saved(page)).workOutbox.a000000000000004).toMatchObject({ state: 'done', right: 2, asked: 3, questions: DONE_QS });
    expect(st.work.a000000000000004.a1).toMatchObject({ state: 'started' });
    // back online: the next sync sends the report exactly once, and the line follows
    st.down = false;
    const from = log.length;
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.getByText('התוצאה נשלחה למורה.')).toBeVisible();
    await expect.poll(async () => (await saved(page)).workOutbox).toEqual({});
    const sent = log.slice(from).filter((r) => r.path === '/api/class/work/a000000000000004' && r.method === 'POST');
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ state: 'done', right: 2, asked: 3, questions: DONE_QS });
    expect(st.work.a000000000000004.a1).toMatchObject({ state: 'done', right: 2, asked: 3, tries: 1 });
    // later syncs send nothing more
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(300);
    expect(log.slice(from).filter((r) => r.path === '/api/class/work/a000000000000004' && r.method === 'POST')).toHaveLength(1);
  });

  test('started before and left: the start card says it begins again from the first question', async ({ page }) => {
    await fakeServer(page, { today: '2026-11-09', assignments: [examWork()], work: { a000000000000004: { a1: { state: 'started', startedAt: '2026-11-09T07:30:00.000Z', tries: 0 } } } }, baseOf());
    await open(page, '#/class/exam/a000000000000004', inClass(), { at: MONDAY });
    await expect(page.getByText('התחלתם את המבחן ולא סיימתם. אם תתחילו שוב, הוא יתחיל מהשאלה הראשונה.')).toBeVisible();
    await page.getByRole('button', { name: 'מתחילים' }).click();
    await expect.poll(() => item(page)).toBeTruthy();
    expect((await item(page)).key).toBe('sn3:-8:3');
    // leaving asks first, and says the exam will not be sent
    await page.getByRole('button', { name: 'יציאה מהמבחן' }).click();
    const exit = page.getByRole('dialog', { name: 'לצאת מהמבחן?' });
    await expect(exit).toContainText('אם יוצאים עכשיו, המבחן לא יישלח למורה. בפעם הבאה הוא יתחיל מהשאלה הראשונה.');
    await exit.getByRole('button', { name: 'יציאה', exact: true }).click();
    await expect(page).toHaveURL(/#\/quests$/);
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

test.describe('TEACHER-7: the class report, its CSV and its printout', () => {
  /**
   * The file's name as the app gives it (the link's download attribute, kept by an init script), and as the browser
   * names the download. Chromium names a file whose name is not ASCII "download" when it runs under a C locale (a bare
   * machine with no LANG); a teacher's device has a UTF-8 one, so the browser's name is checked only under one too.
   */
  const keepNames = (page) => page.addInitScript(() => {
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function keep() { if (this.download) window.__files = [...(window.__files || []), this.download]; return click.call(this); };
  });
  const utf8 = /utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || '');
  const named = async (page, download, name) => {
    expect(await page.evaluate(() => window.__files?.at(-1))).toBe(name);
    if (utf8) expect(download.suggestedFilename()).toBe(name);
  };
  const PDF_DIR = path.join(process.cwd(), 'test-results');
  const reportCalls = (log) => log.filter((r) => r.path === '/api/teacher/report');
  /** The search of every report the page asks for, in order. */
  const reportUrls = (page) => {
    const urls = [];
    page.on('request', (r) => { if (r.url().includes('/api/teacher/report')) urls.push(new URL(r.url()).search); });
    return urls;
  };
  // one assignment for the whole class, due on Friday: דנה finished it, יואב did not start
  const stairWork = {
    assignments: [{ id: 'a000000000000001', kind: 'stair', skill: 'signed:1', title: 'חיבור וחיסור', note: '', startsOn: '2026-11-02', dueOn: '2026-11-06', forAll: true, targets: [], createdAt: '2026-11-02T07:00:00.000Z' }],
    work: { a000000000000001: { a1: { state: 'done', stage: 5, passed: true, tries: 1, startedAt: '2026-11-03T10:00:00.000Z', doneAt: '2026-11-04T10:00:00.000Z', doneDay: '2026-11-04' } } },
    mistakes: [{ topic: 'signed', cat: 'sign', level: 1, n: 3, students: 1, ids: ['a1'], names: ['דנה'] }],
  };

  test('1. from the board\'s tools: the ranges, a row per student, the CSV (BOM and header) and the printout (the table only)', async ({ page }) => {
    const { log } = await fakeServer(page, stairWork, baseOf());
    const asked = reportUrls(page);
    await keepNames(page);
    await open(page, '#/teacher', keyTeacher());
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'דוח וייצוא' }).click();
    await expect(page).toHaveURL(/#\/teacher\/report$/);
    await expect(page.getByRole('heading', { name: 'דוח הכיתה' })).toBeVisible();
    const urls = () => asked;
    // the default: the last two weeks, with the board's credentials
    await expect.poll(urls).toContain('?from=2026-10-23&to=2026-11-05');
    expect(reportCalls(log)[0].headers).toMatchObject({ 'x-class-code': 'K7Q2MD', 'x-teacher-key': 'tkey-123' });
    await expect(page.getByRole('radio', { name: 'שבועיים' })).toBeChecked();
    // "השבוע": Sunday 1 November to today
    await page.getByText('השבוע', { exact: true }).click();
    await expect.poll(urls).toContain('?from=2026-11-01&to=2026-11-05');
    await expect(page).toHaveURL(/#\/teacher\/report\?range=week$/);
    await expect(page.getByText('ז׳3 · 1.11–5.11.2026', { exact: true })).toBeVisible();
    const table = page.getByRole('region', { name: 'טבלת הדוח' });
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.locator('tbody th')).toHaveText(['דנה', 'יואב']);
    await expect(table.locator('thead')).toContainText('חיבור וחיסור');
    await expect(table.locator('tbody tr').nth(0)).toContainText('הושלם · שולט/ת');
    await expect(table.locator('tbody tr').nth(1)).toContainText('לא התחיל/ה');
    await expect(page.getByText('תרגלו בטווח')).toBeVisible();
    await expect(page.locator('.kpi').filter({ hasText: 'משימות שהושלמו' })).toContainText('1/2');
    await expect(page.locator('.kpi').filter({ hasText: 'נכון בניסיון ראשון' })).toContainText('70%');
    const mis = page.getByRole('region', { name: 'טעויות שחוזרות בטווח' });
    await expect(mis.locator('.t-list-main')).toHaveText(['מספרים מכוונים, מדרגה 1: חיבור וחיסור. התשובה יצאה עם הסימן ההפוך']);
    await expect(mis).toContainText('תלמיד אחד: דנה');
    await expect(page.getByText('בקובץ יש רק את השמות כפי שהתלמידים כתבו אותם, בלי תעודות זהות ובלי מספרים מזהים.', { exact: false })).toBeVisible();
    for (const b of [page.getByRole('button', { name: 'הורדת קובץ CSV (לאקסל)' }), page.getByRole('button', { name: 'הדפסה' })]) {
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-report');

    // the CSV: a UTF-8 file with the BOM first, its first line the header, a row per student
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'הורדת קובץ CSV (לאקסל)' }).click()]);
    await named(page, download, 'madregot-ז3-2026-11-01-2026-11-05.csv');
    mkdirSync(PDF_DIR, { recursive: true });
    const file = path.join(PDF_DIR, 'teacher-report.csv');
    await download.saveAs(file);
    const bytes = readFileSync(file);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = bytes.toString('utf8').slice(1).split('\r\n');
    expect(lines[0].startsWith('שם,ימים עם תרגול,תרגילים,נכון בניסיון ראשון (%),דקות,תרגול אחרון,מספרים מכוונים: מדרגה,מערכת צירים: מדרגה,')).toBe(true);
    expect(lines[0].endsWith(',חיבור וחיסור (עד 06/11),טעויות שחוזרות')).toBe(true);
    expect(lines[1].startsWith('דנה,3,24,75,31,05/11/2026,')).toBe(true);
    expect(lines[1]).toContain(',הושלם · שולט/ת,');
    expect(lines[1].endsWith(',"התשובה יצאה עם הסימן ההפוך (מספרים מכוונים, מדרגה 1)"')).toBe(true); // the stair, quoted for its comma
    expect(lines[2].startsWith('יואב,1,6,50,7,03/11/2026,')).toBe(true);
    expect(lines.at(-1)).toBe('');
    expect(lines).toHaveLength(4);
    expect(bytes.toString('utf8')).not.toMatch(/a1|b2|a000000000000001|K7Q2MD/);
    await expect(page.getByText('הקובץ הורד למכשיר.')).toBeVisible();

    // printed: the table only, its header with the class, the range and the day, landscape
    await page.evaluate(() => { document.documentElement.dataset.print = 'report'; });
    await page.emulateMedia({ media: 'print' });
    const sheet = page.locator('.print-sheet[data-mode="report"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.pr-head')).toHaveText('דוח הכיתה ז׳3 · 1.11–5.11.2026 · הופק ב־5.11.2026');
    await expect(sheet.locator('tbody tr')).toHaveCount(2);
    await expect(sheet.locator('tbody th')).toHaveText(['דנה', 'יואב']);
    for (const hidden of ['.t-report', '.screen-bar', '.as-chips', '.t-kpis', '.screen-foot', '.t-report-note']) await expect(page.locator(hidden).first()).toBeHidden();
    const pdf = await page.pdf({ path: path.join(PDF_DIR, 'teacher-report.pdf'), preferCSSPageSize: true });
    const box = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    expect(Number(box[1])).toBeGreaterThan(Number(box[2])); // landscape
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => { delete document.documentElement.dataset.print; });
  });

  test('2. a range of the teacher\'s own, and a range with no practice says so calmly', async ({ page }) => {
    const { log } = await fakeServer(page, { reportRows: { a1: { activeDays: 0, exercises: 0, firstTry: 0, minutes: 0, topMistakes: [] }, b2: { activeDays: 0, exercises: 0, firstTry: 0, minutes: 0 } } }, baseOf());
    const urls = reportUrls(page);
    await open(page, '#/teacher/report', keyTeacher());
    await expect(page.getByRole('heading', { name: 'בטווח הזה עוד לא היה תרגול בכיתה.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'הורדת קובץ CSV (לאקסל)' })).toHaveCount(0);
    await page.getByText('טווח אחר', { exact: true }).click();
    await page.getByLabel('מתאריך').fill('2026-10-01');
    await page.getByLabel('עד תאריך').fill('2026-10-31');
    await expect.poll(() => urls).toContain('?from=2026-10-01&to=2026-10-31');
    await expect(page).toHaveURL(/range=custom&from=2026-10-01&to=2026-10-31/);
    await expect(page.getByText('ז׳3 · 1.10–31.10.2026', { exact: true })).toBeVisible();
    expect(reportCalls(log).length).toBeGreaterThan(1);
  });

  test('3. printed, 25 students a page: 30 students make two landscape pages, the header on each', async ({ page }) => {
    const students = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, name: `תלמיד ${String(i + 1).padStart(2, '0')}` }));
    await fakeServer(page, { students }, baseOf());
    await open(page, '#/teacher/report', keyTeacher());
    await expect(page.getByRole('region', { name: 'טבלת הדוח' }).locator('tbody tr')).toHaveCount(30);
    await page.emulateMedia({ media: 'print' });
    const sheet = page.locator('.print-sheet[data-mode="report"]');
    await expect(sheet.locator('tbody tr')).toHaveCount(30);
    await expect(sheet.locator('tbody tr.pr-break')).toHaveCount(1);
    await expect(sheet.locator('tbody tr').nth(24)).toHaveClass(/pr-break/);
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(2);
    await page.emulateMedia({ media: 'screen' });
  });

  test('4. the class settings\' "הורדת הדוח של כל השנה" opens the school year and starts its CSV; the delete sheet offers it first', async ({ page }) => {
    await fakeServer(page, stairWork, baseOf());
    const urls = reportUrls(page);
    await keepNames(page);
    await open(page, '#/teacher/settings', keyTeacher());
    await expect(page.getByText('בסוף השנה כדאי להוריד את הדוח ולמחוק את הכיתה. בשנה הבאה פותחים כיתה חדשה, והתלמידים מצטרפים עם קוד חדש.')).toBeVisible();
    const [year] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'הורדת הדוח של כל השנה' }).click()]);
    await named(page, year, 'madregot-ז3-2026-09-01-2026-11-05.csv');
    expect(urls).toContain('?from=2026-09-01&to=2026-11-05');
    await expect(page.getByRole('radio', { name: 'מתחילת השנה' })).toBeChecked();
    await expect(page).toHaveURL(/#\/teacher\/report\?range=year$/); // the file starts once: the address no longer asks for it
    // the delete sheet: the year's CSV without leaving the sheet
    await page.goto('./#/teacher/settings');
    await page.getByRole('button', { name: 'מחיקת הכיתה' }).click();
    const sheet = page.getByRole('dialog', { name: 'למחוק את הכיתה ז׳3?' });
    const offer = sheet.getByRole('button', { name: 'הורדת הדוח לפני המחיקה' });
    expect((await offer.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const [again] = await Promise.all([page.waitForEvent('download'), offer.click()]);
    await named(page, again, 'madregot-ז3-2026-09-01-2026-11-05.csv');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'כן, למחוק את הכיתה' })).toBeDisabled();
  });
});

test.describe('TEACHER-6: help both ways', () => {
  const at = '2026-11-05T07:30:00.000Z';
  const m = (id, from, body, read = false) => ({ id, from, body, at, read });
  /** Three requests: דנה's, new; יואב's, where he answered the teacher; and one the teacher closed after three replies. */
  const threads = () => [
    { id: 1, studentId: 'a1', name: 'דנה', topic: 'signed', level: 1, question: '$3 - 8$', answer: '5', note: 'לא הבנתי למה יוצא מינוס', has_image: 0, created_at: '2026-11-05T07:00:00.000Z', seen_at: null, done_at: null, messages: [] },
    { id: 2, studentId: 'b2', name: 'יואב', topic: 'signed', level: 2, question: '$-2 + 7$', answer: '-9', note: '', has_image: 0, created_at: '2026-11-04T15:00:00.000Z', seen_at: '2026-11-04T16:00:00.000Z', done_at: null,
      messages: [m(11, 'teacher', 'נסו שוב, והתחילו מהשלב הראשון בדרך', true), m(12, 'student', 'עדיין לא ברור לי איך מתחילים')] },
    { id: 3, studentId: 'a1', name: 'דנה', topic: 'coord', level: 1, question: 'קראו את הנקודה', answer: '(2, 3)', note: '', has_image: 0, created_at: '2026-11-03T10:00:00.000Z', seen_at: '2026-11-03T11:00:00.000Z', done_at: null,
      messages: [m(21, 'teacher', 'נעבור על זה מחר בכיתה', true), m(22, 'student', 'עדיין לא ברור לי', true), m(23, 'teacher', 'כתבו לי איפה בדיוק נתקעתם', true), m(24, 'student', 'בשלב השני', true), m(25, 'teacher', 'נעבור על זה בכיתה')] },
  ];
  const inClass = () => withServer({ profile: { role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', teacherName: 'רונית', token: 'stok-a1', studentId: 'a1' } });
  const replies = (log, path) => log.filter((r) => r.path === path && r.method === 'POST');
  const missionsTab = (page) => page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link', { name: /^משימות/ });

  test('1. the teacher: filters, the thread, quick replies that fill the box, sending, the contact guard and the limit', async ({ page }) => {
    const { st, log } = await fakeServer(page, { help: threads() }, baseOf());
    await open(page, '#/teacher?tab=help', keyTeacher());
    const items = page.locator('.help-item');
    await expect(page.getByRole('radio', { name: 'פתוחות (3)' })).toBeChecked();
    await expect(items).toHaveCount(3);
    // waiting for the teacher: דנה's (no reply yet) and יואב's (he wrote last)
    await page.getByRole('radio', { name: /^מחכות לתשובה שלכם/ }).check();
    await expect(items).toHaveCount(2);
    await expect(items.nth(1)).toContainText('יואב');
    await expect(items.nth(1).locator('.new-tag')).toHaveText('תשובה חדשה');
    // יואב's thread: "אתם" and "יואב", oldest first
    await expect(items.nth(1).locator('.hb-who')).toHaveText([/^אתם · /, /^יואב · /]);
    await expect(items.nth(1).locator('.hb-text')).toHaveText(['נסו שוב, והתחילו מהשלב הראשון בדרך', 'עדיין לא ברור לי איך מתחילים']);
    // a quick reply fills the box and sends nothing
    const dana = items.nth(0);
    const box = dana.getByLabel('תשובה לדנה');
    await expect(box).toHaveAttribute('placeholder', 'כמה מילים על התרגיל. התשובה תופיע אצל דנה באפליקציה.');
    await dana.getByRole('button', { name: 'נסו שוב, והתחילו מהשלב הראשון בדרך' }).click();
    await expect(box).toHaveValue('נסו שוב, והתחילו מהשלב הראשון בדרך');
    await expect(dana.getByText('34/500')).toBeVisible();
    expect(replies(log, '/api/teacher/help/1/reply')).toHaveLength(0);
    for (const b of await dana.locator('.hr-chip').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    // a link is refused by the server, and the box keeps the text
    await box.fill('הסבר נוסף כאן: www.x.test');
    await dana.getByRole('button', { name: 'שליחה' }).click();
    await expect(page.getByText('בלי קישורים, מספרי טלפון או כתובות מייל בתשובה. כל השאר אפשר להמשיך בכיתה.')).toBeVisible();
    await expect(box).toHaveValue('הסבר נוסף כאן: www.x.test');
    await box.fill('נסו שוב, והתחילו מהשלב הראשון בדרך: 3 פחות 8 זה כמו ללכת שמאלה על הישר.');
    await page.evaluate(() => window.scrollTo(0, 0));
    await dana.getByRole('button', { name: 'שליחה' }).click();
    await expect(page.getByText('התשובה נשלחה לדנה.')).toBeVisible();
    expect(replies(log, '/api/teacher/help/1/reply').at(-1)).toMatchObject({ body: { body: 'נסו שוב, והתחילו מהשלב הראשון בדרך: 3 פחות 8 זה כמו ללכת שמאלה על הישר.' }, headers: { 'x-class-code': 'K7Q2MD', 'x-teacher-key': 'tkey-123' } });
    expect(st.help[0].messages).toHaveLength(1);
    // answered: no longer waiting; under "פתוחות" her bubble shows
    await expect(items).toHaveCount(1);
    await page.getByRole('radio', { name: /^פתוחות/ }).check();
    await expect(items.nth(0).locator('.hb-who')).toHaveText([/^אתם · היום, /]);
    await expect(items.nth(0).getByLabel('תשובה לדנה')).toHaveValue('');
    // three replies already on דנה's other request: the box is gone and the limit says so
    await expect(items.nth(2).getByText('על בקשה אחת אפשר לכתוב עד 3 תשובות. את השאר כדאי להמשיך בכיתה.')).toBeVisible();
    await expect(items.nth(2).locator('textarea')).toHaveCount(0);
    await expect(page.getByText('בתשובות אין קישורים, מספרי טלפון או כתובות מייל, והן נשארות באפליקציה. הן נמחקות יחד עם הבקשה.')).toBeVisible();
    await items.nth(1).scrollIntoViewIfNeeded();
    await shot(page, 'teacher-help-thread');
    // "מחר": יואב's answer counts as new, with his words
    await page.getByRole('tab', { name: 'מחר' }).click();
    const fresh = page.getByRole('region', { name: 'בקשות עזרה חדשות' });
    await expect(fresh.locator('li.unseen')).toHaveCount(1);
    await expect(fresh.locator('li.unseen')).toContainText('“עדיין לא ברור לי איך מתחילים”');
  });

  test('2. the class\'s owner turns the daily email on in the settings; a key alone does not see the switch', async ({ page }) => {
    const { st, log } = await fakeServer(page.context(), { owned: true, digest: false }, baseOf());
    st.sessions.add(TOKEN(9));
    await open(page, '#/teacher/settings', ownedTeacher(), { local: { 'madregot-parent': JSON.stringify({ token: TOKEN(9), email: EMAIL, shared: false }) } });
    const sw = page.getByRole('switch', { name: 'מייל אחד ביום כשיש בקשות עזרה חדשות' });
    await expect(sw).not.toBeChecked();
    await expect(page.getByText('במייל יש רק את מספר הבקשות, בלי שמות. נשלח בסביבות 16:00.')).toBeVisible();
    await sw.click();
    await expect(sw).toBeChecked();
    expect(log.find((r) => r.path === '/api/teacher/class/digest')).toMatchObject({ body: { on: true }, headers: { 'x-class-code': 'K7Q2MD', 'x-account-token': TOKEN(9) } });
    expect(st.digest).toBe(true);
    await expect(page.getByText('המייל היומי פועל.')).toBeVisible();
    await page.getByRole('region', { name: 'התראות' }).scrollIntoViewIfNeeded();
    await shot(page, 'teacher-settings-notices');
    const p2 = await page.context().newPage();
    await open(p2, '#/teacher/settings', keyTeacher());
    await expect(p2.getByRole('heading', { name: 'הגדרות הכיתה ז׳3' })).toBeVisible();
    await expect(p2.getByText('תלמידים שכבר בכיתה ממשיכים להיכנס עם הקוד האישי שלהם.')).toBeVisible();
    await expect(p2.getByRole('switch', { name: 'מייל אחד ביום כשיש בקשות עזרה חדשות' })).toHaveCount(0);
  });

  test('3. the student: a calm notice outside lessons, the tab dot, the thread, "עדיין לא ברור לי" posts still', async ({ page }) => {
    const help = threads().filter((x) => x.studentId === 'a1');
    help[0].messages = [m(31, 'teacher', 'נסו שוב, והתחילו מהשלב הראשון בדרך')];
    help[0].seen_at = '2026-11-05T07:20:00.000Z';
    help[1].messages[4].read = true; // the other request's last reply was read on another day
    const { log } = await fakeServer(page, { help }, baseOf());
    // inside a lesson the notice waits
    await open(page, '#/lesson/signed/1', inClass());
    await expect.poll(() => log.some((r) => r.path === '/api/class/work')).toBe(true);
    await page.waitForTimeout(500);
    await expect(page.getByText('יש תשובה מהמורה על בקשת העזרה')).toHaveCount(0);
    // the next screen out of the lesson: once
    await page.evaluate(() => { window.location.hash = '#/'; });
    const notice = page.getByText('יש תשובה מהמורה על בקשת העזרה');
    await expect(notice).toBeVisible();
    await expect(missionsTab(page)).toHaveAccessibleName('משימות · יש משהו חדש מהמורה');
    expect((await page.getByRole('button', { name: 'לקריאה' }).boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'לקריאה' }).click();
    await expect(page).toHaveURL(/#\/quests$/);
    const sheet = page.getByRole('dialog', { name: 'הבקשה שלי' });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.hb-who')).toHaveText([/^המורה רונית · /]);
    await expect(sheet.locator('.hb-text')).toHaveText(['נסו שוב, והתחילו מהשלב הראשון בדרך']);
    await expect.poll(() => replies(log, '/api/help/1/read').length).toBe(1);
    await expect(page.locator('.tab-dot')).toHaveCount(0);
    // the exercise's maths in KaTeX (it loads on demand: the day's mission above may have no maths to load it first)
    await expect(sheet.locator('.mh-ex-q .katex').first()).toBeVisible();
    await page.evaluate(async () => { await document.fonts.load('16px KaTeX_Main'); await document.fonts.load('italic 16px KaTeX_Math'); });
    await shot(page, 'student-my-help');
    // "עדיין לא ברור לי": a few words, then "שליחה למורה"
    await sheet.getByRole('button', { name: 'עדיין לא ברור לי' }).click();
    await sheet.getByLabel('מה עדיין לא ברור?').fill('למה שמונה פחות שלוש זה לא אותו דבר?');
    await sheet.getByRole('button', { name: 'שליחה למורה' }).click();
    await expect(page.getByText('שלחנו למורה.')).toBeVisible();
    expect(replies(log, '/api/help/1/reply').at(-1)).toMatchObject({ body: { quick: 'still', body: 'למה שמונה פחות שלוש זה לא אותו דבר?' }, headers: { authorization: 'Bearer stok-a1' } });
    await expect(sheet.locator('.hb-who')).toHaveText([/^המורה רונית · /, /^אני · /]);
    await expect(sheet.getByRole('button', { name: 'תודה, הבנתי' })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'סגירה' }).click();
    // the card: each request with where it stands
    const card = page.getByRole('region', { name: 'הבקשות שלי למורה' });
    await expect(card.locator('.mh-row')).toHaveCount(2);
    await expect(card.locator('.mh-chip')).toHaveText(['יש תשובה', 'יש תשובה']);
    for (const r of await card.locator('.mh-row').all()) expect((await r.boundingBox()).height).toBeGreaterThanOrEqual(44);
    // a reload does not bring the notice back
    const fetched = log.filter((r) => r.path === '/api/class/work').length;
    await page.evaluate(() => { window.location.hash = '#/'; });
    await page.reload();
    await expect(missionsTab(page)).toBeVisible();
    await expect.poll(() => log.filter((r) => r.path === '/api/class/work').length).toBeGreaterThan(fetched);
    await page.waitForTimeout(600);
    await expect(notice).toHaveCount(0);
  });

  test('4. "תודה, הבנתי" closes the sheet; before any reply there is nothing to answer; the help sheet says where the answer comes', async ({ page }) => {
    const help = threads().filter((x) => x.studentId === 'a1');
    const { log } = await fakeServer(page, { help: [help[0], { ...help[0], id: 4, question: '$-4 \\cdot 2$', messages: [m(41, 'teacher', 'כתבו לי איפה בדיוק נתקעתם', true)] }] }, baseOf());
    await open(page, '#/quests', inClass());
    const card = page.getByRole('region', { name: 'הבקשות שלי למורה' });
    await expect(card.locator('.mh-chip')).toHaveText(['נשלחה', 'יש תשובה']);
    await card.locator('.mh-row').nth(0).click();
    const sheet = page.getByRole('dialog', { name: 'הבקשה שלי' });
    await expect(sheet).toContainText('הבקשה מחכה אצל המורה. כשתגיע תשובה, היא תופיע כאן.');
    await expect(sheet.getByRole('button', { name: 'תודה, הבנתי' })).toHaveCount(0);
    expect(replies(log, '/api/help/1/read')).toHaveLength(0);
    await sheet.getByRole('button', { name: 'סגירה' }).click();
    await card.locator('.mh-row').nth(1).click();
    await sheet.getByRole('button', { name: 'תודה, הבנתי' }).click();
    await expect(page.getByText('שלחנו למורה.')).toBeVisible();
    await expect(sheet).toBeHidden();
    expect(replies(log, '/api/help/4/reply').at(-1).body).toEqual({ quick: 'thanks' });
    // a new request from a lesson: the sent line says where the answer will come
    await page.goto('./#/lesson/signed/1');
    await page.getByRole('button', { name: 'למורה' }).click();
    const ask = page.getByRole('dialog', { name: 'לבקש עזרה מהמורה' });
    await ask.getByLabel('מה לא ברור? (לא חובה)').fill('לא הבנתי את הסימן');
    await ask.getByRole('button', { name: 'שליחה למורה' }).click();
    await expect(page.getByText('הבקשה נשלחה למורה. התשובה תופיע במסך המשימות.')).toBeVisible();
    expect(replies(log, '/api/help').at(-1).body).toMatchObject({ topic: 'signed', level: 1, note: 'לא הבנתי את הסימן' });
  });
});

// TEACHER-8: each student has a page, and "כדאי לבדוק איתם" is a short ranked list. The list shows six names with the
// reasons as chips and "ועוד n" for the rest (the students tab, sorted by need); a name opens the student's sheet; a
// mistake's "לתת תרגול" opens the assign sheet for that student alone; the sheet's help link filters the help view;
// the PIN reset and the removal live on the sheet; and the class report's names open the same sheet.
test.describe('TEACHER-8: each student has a page, and a short ranked list', () => {
  // the server's day is Thursday 5 November 2026
  const nine = () => [
    { id: 's1', name: 'דנה', lastPractice: '2026-10-20T08:00:00Z' }, // idle 16 days: 10
    { id: 's2', name: 'יואב', week: { n: 10, first: 2, days: 3 } }, // 20% first try: 16
    { id: 's3', name: 'נועה', late: 2 }, // two late (4) and a help request waiting (3): 7
    { id: 's4', name: 'איתי', lastPractice: null, joinedOn: '2026-10-31', today: { n: 0 }, week: { n: 0, first: 0, days: 0 } }, // never, 5 days: 5.5
    { id: 's5', name: 'מאיה', lastPractice: '2026-11-01T08:00:00Z' }, // idle 4: 5
    { id: 's6', name: 'רוני', week: { n: 8, first: 4, days: 2 } }, // 50%: 4
    { id: 's7', name: 'עדי', lastPractice: '2026-11-02T08:00:00Z' }, // idle 3: 4.5
    { id: 's8', name: 'שירה', late: 1 }, // 2
    { id: 's9', name: 'תמר' }, // practising and doing well
  ];
  const helpNoa = () => [{ id: 7, studentId: 's3', name: 'נועה', topic: 'signed', level: 1, question: '$3 - 8$', answer: '5', note: '', has_image: 0, created_at: '2026-11-05T07:00:00.000Z', seen_at: null, done_at: null, messages: [] }];
  const yoavPage = () => ({
    days14: Array.from({ length: 14 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 9, 23 + i)).toISOString().slice(0, 10);
      const n = [0, 4, 0, 0, 12, 0, 0, 3, 0, 6, 0, 0, 5, 2][i];
      return { day, n, first: Math.floor(n / 3), minutes: n * 2 };
    }),
    levels: { signed: { level: 2, max: 2 } },
    mistakes: [{ topic: 'signed', cat: 'sign', level: 1, n: 4, lastAt: '2026-11-04T10:00:00.000Z' }],
    exams: [{ id: '31', title: 'מבחן במספרים מכוונים', correct: 6, total: 10, at: '2026-11-02T10:00:00.000Z', questions: [{ topic: 'signed', status: 'correct' }, { topic: 'signed', status: 'wrong' }] }],
  });

  test('1. "מחר" ranks six with their reasons; a name opens the sheet; "לתת תרגול" gives practice to that student alone', async ({ page }) => {
    const { st, log } = await fakeServer(page, { students: nine(), help: helpNoa(), studentPages: { s2: yoavPage() } }, baseOf());
    await open(page, '#/teacher', keyTeacher());
    const group = page.getByRole('region', { name: 'כדאי לבדוק איתם' });
    const rows = group.locator('.t-row');
    await expect(rows).toHaveCount(6);
    await expect(rows.locator('.t-name')).toHaveText(['יואב', 'דנה', 'נועה', 'איתי', 'מאיה', 'עדי']);
    await expect(rows.nth(0)).toContainText('20% נכון בניסיון ראשון השבוע');
    await expect(rows.nth(1)).toContainText('לא תרגל/ה 16 ימים');
    await expect(rows.nth(2).locator('.t-chip')).toHaveText(['2 משימות באיחור', 'בקשת עזרה מחכה']);
    await expect(rows.nth(3)).toContainText('עוד לא התחיל/ה לתרגל');
    await expect(group.getByRole('button', { name: 'ועוד 2. לרשימה המלאה' })).toBeVisible();
    for (const b of await rows.locator('.t-name').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await group.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await shot(page, 'teacher-attention');

    // the name opens the student's page, titled with the name
    await group.getByRole('button', { name: 'יואב', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'יואב' });
    await expect(sheet).toBeVisible();
    await expect.poll(() => log.some((r) => r.path === '/api/teacher/students/s2' && r.headers['x-teacher-key'] === 'tkey-123')).toBe(true);
    for (const h of ['השבוע', 'מדרגות', 'טעויות שחוזרות', 'משימות', 'בקשות עזרה', 'מבחנים']) await expect(sheet.getByRole('heading', { name: h, exact: true })).toBeVisible();
    await expect(sheet.getByText('הצטרף/ה ב־2.9 · תרגול אחרון היום')).toBeVisible();
    await expect(sheet.getByRole('img', { name: 'ב־14 הימים האחרונים: 6 ימים עם תרגול' })).toBeVisible();
    await expect(sheet.getByText('4 ימים עם תרגול · 16 תרגילים · 32 דקות')).toBeVisible();
    // signed numbers has six stairs now (signed:6, the curriculum lane's)
    await expect(sheet.getByRole('img', { name: 'מדרגה 2 מתוך 6' }).first()).toBeVisible();
    await expect(sheet.getByText('4 פעמים בחודש האחרון')).toBeVisible();
    await expect(sheet.locator('.ss-row-main').first()).toHaveText('מספרים מכוונים, מדרגה 1: חיבור וחיסור. התשובה יצאה עם הסימן ההפוך');
    await expect(sheet.locator('#ss-work').locator('..').getByText('אין עדיין')).toBeVisible();
    await expect(sheet.getByText('מבחן במספרים מכוונים')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'איפוס קוד אישי' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'הסרה מהכיתה' })).toBeVisible();
    await shot(page, 'teacher-student-sheet');
    await sheet.getByRole('button', { name: 'הסרה מהכיתה' }).scrollIntoViewIfNeeded();
    await shot(page, 'teacher-student-sheet-end');

    // "לתת תרגול" on the mistake: the assign sheet on that stair, for יואב alone
    await sheet.getByRole('button', { name: 'לתת תרגול' }).click();
    await expect(sheet).toHaveCount(0);
    const assign = page.getByRole('dialog', { name: 'משימה לכיתה ז׳3' });
    await expect(assign).toBeVisible();
    await expect(assign.getByLabel('איזו מדרגה?')).toHaveValue('signed:1');
    await expect(assign.getByRole('radio', { name: /רק ליואב/ })).toBeChecked();
    await assign.getByRole('button', { name: 'שליחה לכיתה' }).click();
    await expect.poll(() => log.some((r) => r.path === '/api/teacher/assignments' && r.method === 'POST')).toBe(true);
    expect(log.find((r) => r.path === '/api/teacher/assignments' && r.method === 'POST').body).toMatchObject({ kind: 'stair', skill: 'signed:1', targets: ['s2'] });
    expect(st.assignments[0].targets).toEqual(['s2']);
  });

  test('2. "ועוד": the students tab sorted by need; "פרטים" opens the sheet, with the PIN reset; the help link filters the help view', async ({ page }) => {
    const { st } = await fakeServer(page, { students: nine(), help: helpNoa() }, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await page.getByRole('button', { name: 'ועוד 2. לרשימה המלאה' }).click();
    await expect(page.getByRole('tab', { name: 'תלמידים' })).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toContain('sort=need');
    await expect(page.getByLabel('סדר הרשימה')).toHaveValue('need');
    const names = page.locator('.t-table tbody th');
    await expect(names).toHaveText(['יואב', 'דנה', 'נועה', 'איתי', 'מאיה', 'עדי', 'רוני', 'שירה', 'תמר']);
    // no PIN reset or removal on the row any more: they are on the student's page
    await expect(page.locator('.t-table').getByRole('button', { name: 'הסרה מהכיתה' })).toHaveCount(0);
    await page.getByLabel('סדר הרשימה').selectOption('name');
    await expect(names.first()).toHaveText('איתי');
    expect(page.url()).not.toContain('sort=');
    await page.getByRole('row', { name: /דנה/ }).getByRole('button', { name: 'פרטים על דנה' }).click();
    const dana = page.getByRole('dialog', { name: 'דנה' });
    await dana.getByRole('button', { name: 'איפוס קוד אישי' }).click();
    await expect(page.getByText('הקוד האישי של דנה אופס. בכניסה הבאה ייבחר קוד חדש.')).toBeVisible();
    await expect(dana.getByText('הקוד האישי אופס. בכניסה הבאה ייבחר קוד חדש.')).toBeVisible();
    expect(st.students.find((s) => s.id === 's1').pinReset).toBe(true);
    await dana.getByRole('button', { name: 'סגירה' }).click();
    // נועה's page: her request, and the way to her requests in the help view
    await page.getByRole('button', { name: 'נועה', exact: true }).click();
    const noa = page.getByRole('dialog', { name: 'נועה' });
    await expect(noa.getByText('נשלחה')).toBeVisible();
    await noa.getByRole('button', { name: 'לבקשות של נועה' }).click();
    await expect(page.getByRole('tab', { name: /^עזרה/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('הבקשות של נועה בשבוע האחרון')).toBeVisible();
    await expect(page.locator('.help-item')).toHaveCount(1);
    await page.getByRole('button', { name: 'לכל הבקשות' }).click();
    await expect(page.getByText('הבקשות של נועה בשבוע האחרון')).toHaveCount(0);
  });

  test('3. the class report\'s names open the same sheet, with the board\'s ids', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher/report', keyTeacher());
    await page.getByRole('region', { name: 'טבלת הדוח' }).getByRole('button', { name: 'יואב', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'יואב' })).toBeVisible();
    expect(log.some((r) => r.path === '/api/teacher/students/b2')).toBe(true);
  });
});

test.describe('TEACHER-10: the pilot kit, in the app', () => {
  const tools = (page) => page.getByRole('navigation', { name: 'כלים' });
  const doc = (page) => page.locator('article.sd-doc');
  const PDF_DIR = path.join(process.cwd(), 'test-results');
  const AI_OFF = 'העוזר החכם (בינה מלאכותית) כבוי לתלמידים בכיתה הזו, לפי ההנחיות של משרד החינוך.';
  /** What the page put on the clipboard. */
  const clip = (page) => page.evaluate(() => navigator.clipboard.readText());

  test('the guide, the parent letter filled in from the form, printed with its slip on a new page, copied, and the principal form', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await tools(page).getByRole('link', { name: 'מדריך למורה' }).click();
    await expect(page).toHaveURL(/#\/teacher\/guide$/);
    await expect(page.getByRole('heading', { name: 'ערכת פיילוט ומדריכים', level: 1 })).toBeVisible();
    const list = page.getByRole('navigation', { name: 'המסמכים בערכה' });
    await expect(list.getByRole('link')).toHaveText([/^מדריך למורה/, /^מכתב להורים ואישור השתתפות/, /^אישור מנהל\/ת/, /^תוכנית פיילוט לשבועיים/, /^מדרגות בכיתה: דף מידע/]);
    await shot(page, 'teacher-guide-list');
    await list.getByRole('link', { name: /מכתב להורים ואישור השתתפות/ }).click();
    await expect(page).toHaveURL(/#\/teacher\/guide\/parent-letter$/);
    await expect(page.getByRole('heading', { name: 'מכתב להורים ואישור השתתפות', level: 1 })).toBeVisible();
    // before the form: blanks to fill by hand, never a stray rule
    await expect(doc(page)).toContainText('בתקופה __________–__________ כיתה ז׳3 תתרגל מתמטיקה');
    await expect(doc(page).locator('hr')).toHaveCount(1);
    // the form: the school, the dates, the contact; the preview follows, and the class keeps them
    await page.getByLabel('שם בית הספר').fill('בית ספר לדוגמה');
    await page.getByLabel('תאריך התחלה').fill('2026-11-15');
    await page.getByLabel('תאריך סיום').fill('2026-11-12');
    await expect(page.getByText('תאריך הסיום לפני תאריך ההתחלה.')).toBeVisible();
    await page.getByLabel('תאריך סיום').fill('2026-11-26');
    await expect(page.getByText('תאריך הסיום לפני תאריך ההתחלה.')).toHaveCount(0);
    await page.getByLabel('איך ההורים יכולים לפנות אליכם (מייל או טלפון בבית הספר)').fill('teacher@example.test');
    await expect(doc(page)).toContainText('בתקופה 15.11.2026–26.11.2026 כיתה ז׳3 תתרגל מתמטיקה גם באפליקציה "מדרגות", במסגרת ניסיון בהובלת רונית.');
    await expect(doc(page)).toContainText('בית ספר לדוגמה');
    await expect(doc(page)).toContainText(AI_OFF);
    await expect(doc(page)).toContainText(`הפרטים במדיניות הפרטיות: ${baseOf()}#/privacy`);
    await expect(doc(page)).toContainText('שם התלמיד או התלמידה: ______________________   כיתה: ז׳3');
    expect((await saved(page)).profile.classes[0].pilot).toEqual({ school: 'בית ספר לדוגמה', start: '2026-11-15', end: '2026-11-26', contact: 'teacher@example.test' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-guide-letter');
    await doc(page).locator('hr').scrollIntoViewIfNeeded();
    await shot(page, 'teacher-guide-letter-slip');

    // "העתקה": the whole letter, as plain text; "גרסה קצרה לווטסאפ": the short one
    await page.getByRole('button', { name: 'העתקה' }).click();
    await expect(page.getByText('הועתק', { exact: true })).toBeVisible();
    const copied = await clip(page);
    expect(copied.startsWith('מכתב להורים: תרגול מתמטיקה באפליקציה "מדרגות"')).toBe(true);
    expect(copied).toContain('בתקופה 15.11.2026–26.11.2026 כיתה ז׳3');
    expect(copied).not.toMatch(/\*\*|\\|^#/m);
    await page.getByRole('button', { name: 'גרסה קצרה לווטסאפ' }).click();
    expect(await clip(page)).toBe('הורים יקרים, בתאריכים 15.11.2026–26.11.2026 כיתה ז׳3 תתרגל מתמטיקה גם באפליקציה "מדרגות" (10–15 דקות ביום, בדפדפן, בלי התקנה ובלי פרסומות). נשמרים רק שם פרטי ואות משם המשפחה והתשובות בתרגול, ורק המורה רואה אותם. ההשתתפות מרצון. מי שלא משתתף מקבל דפי תרגול. המכתב המלא ואישור ההשתתפות יישלחו הביתה. לשאלות: teacher@example.test. רונית');

    // "הדפסה" prints the document mode; printed, only the letter shows, and the slip starts a new page under a dashed line
    await page.evaluate(() => { window.__printed = []; window.print = () => window.__printed.push(document.documentElement.dataset.print); });
    await page.getByRole('button', { name: 'הדפסה' }).click();
    expect(await page.evaluate(() => window.__printed)).toEqual(['doc']);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.emulateMedia({ media: 'print' });
    const printed = page.locator('.print-sheet[data-mode="doc"]');
    await expect(printed).toBeVisible();
    await expect(doc(page)).toBeHidden();
    await expect(page.locator('.screen-bar')).toBeHidden();
    await expect(page.getByLabel('שם בית הספר')).toBeHidden();
    await expect(printed.getByRole('heading', { name: 'מכתב להורים: תרגול מתמטיקה באפליקציה "מדרגות"', level: 1 })).toBeVisible();
    await expect(printed.getByRole('heading', { name: 'אישור הורה (לגזור ולהחזיר למורה)' })).toBeVisible();
    const cut = await printed.locator('hr').evaluate((el) => { const s = getComputedStyle(el); return { brk: s.breakBefore, line: s.borderTopStyle, colour: s.borderTopColor }; });
    expect(cut).toEqual({ brk: 'page', line: 'dashed', colour: 'rgb(0, 0, 0)' });
    mkdirSync(PDF_DIR, { recursive: true });
    const letterPdf = await page.pdf({ path: path.join(PDF_DIR, 'teacher-guide-letter.pdf'), preferCSSPageSize: true });
    // the letter on one page, the slip on the next
    expect((letterPdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(2);
    await page.emulateMedia({ media: 'screen' });

    // the principal form: the same school and dates, no contact field; ten checks, each its own line; items 3 and 8
    await page.getByRole('button', { name: 'חזרה לערכה' }).click();
    await page.getByRole('link', { name: /אישור מנהל\/ת/ }).click();
    await expect(page.getByLabel('שם בית הספר')).toHaveValue('בית ספר לדוגמה');
    await expect(page.getByLabel('תאריך התחלה')).toHaveValue('2026-11-15');
    await expect(page.getByLabel(/איך ההורים יכולים לפנות/)).toHaveCount(0);
    await expect(doc(page).locator('li')).toHaveCount(10);
    await expect(doc(page)).toContainText('הכיתה: ז׳3 (שכבה ז׳)');
    await expect(doc(page)).toContainText('תקופה: 15.11.2026–26.11.2026');
    await expect(doc(page)).toContainText(`קראתי את הצהרת הנגישות: ${baseOf()}#/accessibility`);
    await expect(doc(page)).toContainText('באחריותי לפי סעיף 8 במכתב המשרד');
    await expect(doc(page).locator('hr')).toHaveCount(0);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-sheet[data-mode="doc"]')).toContainText('שם המנהל/ת:');
    await page.pdf({ path: path.join(PDF_DIR, 'teacher-guide-principal.pdf'), preferCSSPageSize: true });
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-guide-principal');
    // the teacher guide: Madregot's own contact from the server, and no form
    await page.goto('./#/teacher/guide/teacher-guide');
    await expect(page.getByRole('heading', { name: 'מדריך למורה', level: 1 })).toBeVisible();
    await expect(doc(page)).toContainText('כל שאלה אחרת: hello@example.test');
    await expect(page.getByLabel('שם בית הספר')).toHaveCount(0);
    // an unknown document is the list
    await page.goto('./#/teacher/guide/nope');
    await expect(page).toHaveURL(/#\/teacher\/guide$/);
  });

  test('the ways in: the new class\'s link and the consent block both open the parent letter; with consent to gather, it tells parents about the AI', async ({ page }) => {
    await fakeServer(page, { ai: { approval: 'approved' } }, baseOf());
    await open(page, '#/teacher', keyTeacher({ fresh: true }));
    await expect(page.getByRole('heading', { name: 'הכיתה מוכנה!' })).toBeVisible();
    await page.getByRole('link', { name: 'מכתב להורים להדפסה' }).click();
    await expect(page).toHaveURL(/#\/teacher\/guide\/parent-letter$/);
    await expect(doc(page)).toContainText('Claude של Anthropic');
    await expect(doc(page)).toContainText(`בטופס של משרד החינוך: ${MOE_RULES.consentPdfUrl}`);
    await page.goto('./#/teacher/settings');
    const card = page.getByRole('region', { name: AI_COPY.switch });
    await expect(card.getByText(AI_COPY.consentSchool)).toBeVisible();
    await card.getByRole('link', { name: 'מכתב להורים להדפסה' }).click();
    await expect(page).toHaveURL(/#\/teacher\/guide\/parent-letter$/);
  });

  test('the demo class: the guide opens with the demo class and "בית ספר לדוגמה", and asks nothing of a server', async ({ page }) => {
    const calls = []; page.on('request', (r) => { if (r.url().includes('/api/')) calls.push(r.url()); });
    await open(page, '#/?start=demo');
    await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
    await tools(page).getByRole('link', { name: 'מדריך למורה' }).click();
    await expect(page.getByRole('region', { name: 'כיתה לדוגמה' })).toBeVisible();
    await page.getByRole('link', { name: /מכתב להורים ואישור השתתפות/ }).click();
    await expect(page.getByLabel('שם בית הספר')).toHaveValue('בית ספר לדוגמה');
    await expect(doc(page)).toContainText('כיתה ז׳3 (דוגמה) תתרגל מתמטיקה גם באפליקציה "מדרגות", במסגרת ניסיון בהובלת מורה לדוגמה.');
    await expect(doc(page)).toContainText(AI_OFF);
    // no server here: no privacy address to print, a line to fill by hand
    await expect(doc(page)).toContainText('הפרטים במדיניות הפרטיות: __________');
    await page.getByRole('button', { name: 'חזרה לערכה' }).click();
    await page.getByRole('link', { name: /דף מידע/ }).click();
    await expect(doc(page)).toContainText('הנושאים: כיתה ז׳: מספרים מכוונים');
    await expect(doc(page)).toContainText(`לוח מורה לדוגמה, עם כיתה בדויה, בלי הרשמה: ${baseOf()}#/?start=demo`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-guide-demo-sheet');
    expect(calls).toEqual([]);
  });
});

test.describe('TEACHER-15: the demo class, with no server and no sign-in', () => {
  const tools = (page) => page.getByRole('navigation', { name: 'כלים' });
  const banner = (page) => page.getByRole('region', { name: 'כיתה לדוגמה' });
  /** Every request this page makes to a /api/ address. */
  const apiCalls = (page) => { const calls = []; page.on('request', (r) => { if (r.url().includes('/api/')) calls.push(r.url()); }); return calls; };
  /** From the first screen of a device with no profile: "אני מורה", then the demo. `pic`: a picture of the public page. */
  async function enter(page, { pic = false } = {}) {
    await open(page, '#/');
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'לוח המורה נמצא באתר המלא' })).toBeVisible();
    if (pic) await shot(page, 'teacher-public-demo-button');
    await page.getByRole('button', { name: 'לראות לוח לדוגמה, בלי הרשמה' }).click();
    await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
  }

  test('1. "אני מורה" → the demo: the board of 24 with the banner, every tab, a student\'s page, the settings; no /api request', async ({ page }) => {
    const calls = apiCalls(page);
    await enter(page, { pic: true });
    await expect(banner(page)).toContainText('כיתה לדוגמה: השמות והנתונים בדויים, ושום דבר כאן לא נשלח.');
    await expect(banner(page).getByRole('button', { name: 'יציאה מהדוגמה' })).toBeVisible();
    await expect(banner(page).getByRole('button', { name: 'לפתיחת כיתה אמיתית' })).toHaveCount(0); // no server in this build
    await expect(page.getByText('תרגלו השבוע')).toBeVisible();
    await expect(page.locator('.t-kpis')).toContainText('/24');
    // "מחר": repeated mistakes with their students, the ranked six and "ועוד", new help requests
    await expect(page.getByRole('region', { name: 'טעויות שחוזרות השבוע' }).locator('.t-row').first()).toBeVisible();
    const attn = page.getByRole('region', { name: 'כדאי לבדוק איתם' });
    await expect(attn.locator('.t-attn > li')).toHaveCount(6);
    await expect(attn.getByRole('button', { name: /^ועוד \d+/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'בקשות עזרה חדשות' }).locator('.t-row')).toHaveCount(3);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-demo-board');
    // the profile is the demo's, kept in this tab only: nothing of it was saved to the device
    expect(await page.evaluate(() => localStorage.getItem('madregot') || '')).not.toContain('DEMO01');
    expect(await page.evaluate(() => !!sessionStorage.getItem('madregot-demo'))).toBe(true);
    // each tab
    await page.getByRole('tab', { name: /משימות/ }).click();
    await expect(page.getByRole('list', { name: 'משימות פתוחות' }).locator('.tw-row')).toHaveCount(2);
    await page.getByRole('tab', { name: 'תלמידים' }).click();
    await expect(page.getByRole('region', { name: 'טבלת התלמידים' }).locator('tbody tr')).toHaveCount(24);
    await expect(page.getByRole('button', { name: 'מחיקת הכיתה' })).toBeDisabled();
    await expect(page.getByText('בכיתה לדוגמה אי אפשר למחוק או להחליף מפתח.')).toBeVisible();
    await page.getByRole('tab', { name: /מבחנים/ }).click();
    await expect(page.getByRole('region', { name: 'טבלת המבחנים' }).locator('tbody tr')).toHaveCount(6);
    await page.getByRole('tab', { name: /עזרה/ }).click();
    await expect(page.locator('.help-item').first()).toBeVisible();
    // a student's page from a name
    await page.getByRole('tab', { name: 'מחר' }).click();
    const first = attn.locator('.t-attn > li').first().getByRole('button');
    const name = (await first.textContent()).trim();
    await first.click();
    const sheet = page.getByRole('dialog', { name });
    await expect(sheet.getByRole('heading', { name: 'השבוע' })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'מדרגות' })).toBeVisible();
    await page.keyboard.press('Escape');
    // the settings: the AI card in a school class before approval, and no delete or new key
    await tools(page).getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await expect(page.getByRole('heading', { name: 'הגדרות הכיתה ז׳3 (דוגמה)' })).toBeVisible();
    await expect(banner(page)).toBeVisible();
    await expect(page.getByRole('region', { name: 'העוזר החכם לתלמידים' })).toContainText('לתלמידים בכיתה: כבוי');
    await expect(page.getByRole('button', { name: 'מחיקת הכיתה' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'החלפת מפתח המורה' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'הכניסה לכיתה' })).toContainText('בכיתה לדוגמה אי אפשר למחוק או להחליף מפתח.');
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-demo-settings');
    await page.getByRole('button', { name: 'מחיקת הכיתה' }).scrollIntoViewIfNeeded();
    await shot(page, 'teacher-demo-settings-end');
    expect(calls).toEqual([]);
    // leaving the demo: the first screen again, and nothing left on the device
    await banner(page).getByRole('button', { name: 'יציאה מהדוגמה' }).click();
    await expect(page.getByRole('button', { name: 'אני מורה', exact: true })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('madregot-demo'))).toBeNull();
    expect(calls).toEqual([]);
  });

  test('2. assigning, a reply, a lesson stage, the exam key printed, the report\'s CSV and the assistant\'s sample, all on the device', async ({ page }) => {
    const calls = apiCalls(page);
    await enter(page);
    // assign: practice on a repeated mistake, for the students who made it; the row appears in "משימות"
    await page.getByRole('region', { name: 'טעויות שחוזרות השבוע' }).getByRole('button', { name: 'לתת תרגול על זה' }).first().click();
    const assign = page.getByRole('dialog', { name: 'משימה לכיתה ז׳3 (דוגמה)' });
    await expect(assign).toBeVisible();
    await shot(page, 'teacher-demo-assign');
    await assign.getByRole('button', { name: 'שליחה לכיתה' }).click();
    await expect(page.getByText('בכיתה לדוגמה זה נשמר רק כאן, עד שתסגרו את הלשונית.')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: /משימות/ }).click();
    await expect(page.getByRole('list', { name: 'משימות פתוחות' }).locator('.tw-row')).toHaveCount(3);
    // a reply to a help request: its bubble appears
    await page.getByRole('tab', { name: /עזרה/ }).click();
    // a request with no thread yet: found again by the student's name once the reply is in it
    const label = await page.locator('.help-item').filter({ hasNot: page.locator('.hb-who') }).first().locator('label.field-label').textContent();
    const item = page.locator('.help-item').filter({ has: page.getByLabel(label.trim(), { exact: true }) });
    const box = item.getByLabel(label.trim(), { exact: true });
    await box.fill('בדקו באיזה כיוון זזים על הציר, ונסו שוב.');
    await item.getByRole('button', { name: 'שליחה' }).click();
    await expect(item.locator('.hb-text').last()).toHaveText('בדקו באיזה כיוון זזים על הציר, ונסו שוב.');
    // reload: the demo and what was done in it stay for the visit
    await page.reload();
    await expect(banner(page)).toBeVisible();
    await page.getByRole('tab', { name: /עזרה/ }).click();
    await expect(page.getByText('בדקו באיזה כיוון זזים על הציר, ונסו שוב.')).toBeVisible();
    // the library and a lesson stage, in the student view
    await page.getByRole('tab', { name: 'מחר' }).click();
    await tools(page).getByRole('link', { name: 'השיעורים' }).click();
    await page.getByRole('region', { name: 'מספרים מכוונים' }).getByRole('link', { name: /^לשיעור: / }).first().click();
    await expect(page.getByRole('region', { name: 'תצוגת תלמיד' })).toBeVisible();
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    // the exam builder, and its key under print media
    await page.goto('./#/teacher');
    await tools(page).getByRole('link', { name: 'מבחן להדפסה' }).click();
    await page.getByRole('checkbox', { name: '1. חיבור וחיסור' }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /6 שאלות/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('button', { name: 'הכנת המבחן' }).click();
    await expect(page.locator('.xs-screen')).toContainText('כיתה: ז׳3 (דוגמה)');
    await page.evaluate(() => { document.documentElement.dataset.print = 'key'; });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-sheet[data-mode="key"]')).toBeVisible();
    await expect(banner(page)).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => { delete document.documentElement.dataset.print; });
    // the report and its CSV: the demo's file name, the BOM first
    await page.goto('./#/teacher/report');
    await expect(page.getByRole('heading', { name: 'דוח הכיתה' })).toBeVisible();
    await expect(page.locator('.t-report-table tbody tr')).toHaveCount(24);
    // the wide table scrolls inside its frame: the page itself never scrolls sideways (KaTeX in the mistakes column)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, 'teacher-demo-report');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'הורדת קובץ CSV (לאקסל)' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^madregot-demo-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
    const dir = path.join(process.cwd(), 'test-results'); mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'teacher-demo-report.csv');
    await download.saveAs(file);
    const bytes = readFileSync(file);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8').split('\r\n').length).toBe(24 + 2);
    // the assistant: its note, and a sample answer that says it is one
    await page.goto('./#/teacher/assistant');
    await page.getByLabel('ההודעה שלכם').fill('איך להסביר חיבור של מספרים מכוונים?');
    await page.getByRole('button', { name: 'שליחה' }).click();
    await expect(page.getByText('תשובה לדוגמה. בכיתה אמיתית העוזר עונה על השאלה שלכם.')).toBeVisible();
    await expect(page.getByText('בכיתה לדוגמה העוזר מראה תשובה לדוגמה, ושום שאלה לא נשלחת.')).toBeVisible();
    // the answer as the app shows it once its markdown has loaded (RichText loads it on demand, DURABLE-11)
    await expect(page.locator('.msg.assistant .md p').first()).toBeVisible();
    await shot(page, 'teacher-demo-assistant');
    expect(calls).toEqual([]);
  });

  test('3. on a student\'s device the demo asks, opens in a new tab, and the student\'s profile is unchanged', async ({ page, context }) => {
    const mine = student('7', { profile: { role: 'student', name: 'נועה', grade: '7' } });
    await open(page, '#/?start=demo', mine);
    const before = await page.evaluate(() => localStorage.getItem('madregot'));
    const ask = page.getByRole('dialog', { name: 'לוח לדוגמה' });
    await expect(ask).toContainText('הלוח לדוגמה ייפתח בלשונית חדשה');
    await shot(page, 'demo-ask');
    const [tab] = await Promise.all([context.waitForEvent('page'), ask.getByRole('button', { name: 'לפתוח בלשונית חדשה' }).click()]);
    await tab.waitForLoadState();
    await expect(tab.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
    await expect(tab.getByRole('region', { name: 'כיתה לדוגמה' })).toBeVisible();
    // the demo tab offers no "real class": this device belongs to a student
    await expect(tab.getByRole('button', { name: 'לפתיחת כיתה אמיתית' })).toHaveCount(0);
    await tab.getByRole('tab', { name: 'תלמידים' }).click();
    await tab.getByRole('switch', { name: 'נעילת הכיתה לתלמידים חדשים' }).click();
    await expect(tab.getByText('הכיתה נעולה לתלמידים חדשים.')).toBeVisible();
    // the student's saved state is exactly as it was, in both tabs
    expect(await tab.evaluate(() => localStorage.getItem('madregot'))).toBe(before);
    expect(JSON.parse(before).state.profile).toMatchObject({ role: 'student', name: 'נועה' });
    // leaving the demo in that tab gives the student's app back there
    await tab.getByRole('region', { name: 'כיתה לדוגמה' }).getByRole('button', { name: 'יציאה מהדוגמה' }).click();
    await expect(tab.getByRole('region', { name: 'כיתה לדוגמה' })).toHaveCount(0);
    expect(await tab.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.profile.name)).toBe('נועה');
    await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toHaveCount(0);
  });

  test('5. in the app with a server: TeacherStart\'s link opens the demo, nothing reaches the server, and "לפתיחת כיתה אמיתית" leads to a real class', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/', fresh());
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await expect(page.getByText('שלום! איך נכנסים ללוח המורה?')).toBeVisible();
    // TeacherStart asks the server what it offers once; that answer comes before the demo is opened
    await expect.poll(() => log.some((r) => r.path === '/api/health')).toBe(true);
    const before = log.length;
    await page.getByRole('button', { name: 'לראות לוח לדוגמה, בלי הרשמה' }).click();
    await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
    await page.getByRole('tab', { name: /עזרה/ }).click();
    await tools(page).getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await expect(page.getByRole('region', { name: 'העוזר החכם לתלמידים' })).toBeVisible();
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    expect(log.slice(before).map((r) => r.path)).toEqual([]);
    await banner(page).getByRole('button', { name: 'לפתיחת כיתה אמיתית' }).click();
    await expect(page.getByText('שלום! איך נכנסים ללוח המורה?')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('madregot-demo'))).toBeNull();
  });

  test('4. #/?start=demo on a fresh device and ?qa-teacher=demo open it directly', async ({ page }) => {
    const calls = apiCalls(page);
    await open(page, '#/?start=demo');
    await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
    await expect(page).toHaveURL(/#\/teacher$/);
    await open(page, '#/?qa-teacher=demo');
    await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
    expect(calls).toEqual([]);
  });
});
