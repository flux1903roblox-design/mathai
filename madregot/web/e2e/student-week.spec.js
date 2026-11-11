// A week in a student's life (STUDENT-16): one command shows what the student and market judges asked to see end to
// end, with a picture for each day in qa-evidence/student/week/. The clock (page.clock) walks from Sunday 8 to Sunday
// 15 November 2026; the same student, נועה in ז׳, on one phone, through the app's own buttons:
//   Sunday     the first questions, the first teaching stage (its XP), the first lesson, the daily goal's moment
//   Monday     she joins her class (code from the teacher) and sees the class goal of the week
//   Tuesday    no learning: she opens the app in the evening and nothing pressures her
//   Wednesday  the calm repair card, two lessons: "הרצף נשמר"; the reminder is offered and turned on (17:00)
//   Thursday   three mastery checks in זוויות: the third opens the unit's chest, Madi's new piece, the wardrobe
//   Friday     no learning; the Worker's own reminder code sends nothing (Shabbat eve), and an ordinary evening would
//   Shabbat    the streak is kept (a rest day; the freeze earned on Wednesday covers Friday), and no reminder goes out
//   Sunday     last week's class goal was reached with her steps: the moment, and Madi's class scarf; then the Sunday
//              recap (STUDENT-6): the card, its sheet with /report's numbers for that week, and "לשלוח להורים"
// Also captured, as the council's "not completed end to end" list asks: the placement result, the unit review, Exam
// Rescue to its first task; and the council's seven screenshots again, now (qa-evidence/student/after/).
// Every test fails on a console error, and every picture first checks that the page does not scroll sideways. The server
// is a fake (Playwright's routes: no Worker process runs), except
// that the reminder's key and subscription are answered by the Worker's own code in memory (worker/test/helpers.js:
// in-memory D1, no network), so the subscription the app sends is the one the Worker would keep, and Friday's check runs
// the Worker's own pushDue on it. Synthetic data only (example.test, a made-up class).
// Run it alone: npm run test:week (phone, phone-small and phone-dark).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { student, open, item, answer, proceed, proceedToNext, playDiscover, stageDone, expectNoSidewaysScroll } from './helpers.js';
import { setup, stubFetch } from '../../worker/test/helpers.js';
import { makeSubscription } from '../../worker/test/fixtures/push.js';
import { makeVapidKeys } from '../../worker/scripts/push-keys.mjs';
import { pushDue } from '../../worker/src/push.js';
import { jerusalemMidnight } from '../../worker/src/util.js';

// Chromium's headless shell has no notifications (Notification.permission stays 'denied'), so the reminder could never
// be offered there: this file runs on the full Chromium in its new headless mode, as push.spec.js does.
test.use({ channel: 'chromium', actionTimeout: 20_000 });

const PHONES = ['phone', 'phone-small', 'phone-dark'];
const EVIDENCE = fileURLToPath(new URL('../../qa-evidence/student/', import.meta.url));
const API = 'https://api.madregot.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const CLASS = { code: 'K7Q2MD', name: 'ז׳3', token: 'stu_week_token', pin: '2468' };
const TARGET = 60;
// What the rest of the class added this week, by the day the server is asked (Sunday 8 to Shabbat 14), and what it had
// added by the end of the week: with her steps the class passes 60 only after she has gone quiet for Shabbat.
const CLASSMATES = { '2026-11-08': 6, '2026-11-09': 14, '2026-11-10': 20, '2026-11-11': 26, '2026-11-12': 32, '2026-11-13': 36, '2026-11-14': 36 };
const CLASSMATES_FINAL = 50;
// words that would put a missed day on the student, or threaten a loss (STUDENT-5, the owner's "no pressure" rule)
const PRESSURE = /פספסתם|תפספסו|איבדתם|נשבר|נגמר הרצף|תאבדו|יימחק|עוד מעט ייגמר|מהרו/;

/** The day a time falls on, and the Sunday of its week (an Israeli week: Sunday to Shabbat). */
const dayOf = (iso) => iso.slice(0, 10);
const weekOf = (day) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10); };
/** The instant hh:mm on a day in Jerusalem (no clock change in November). */
const inJerusalem = (day, hh, mm = 37) => new Date(jerusalemMidnight(day).ms + (hh * 60 + mm) * 60_000);

/** A picture for the evidence folder, after checking that the page does not scroll sideways. */
async function snap(page, folder, name) {
  await expectNoSidewaysScroll(page);
  await page.evaluate(() => document.fonts.ready);
  const dir = `${EVIDENCE}${folder}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled', caret: 'hide' });
}

/**
 * A whole page in one picture: the viewport grows to the page's height first, so the tab bar sits at the bottom
 * instead of being painted over the middle (as a full-page capture paints fixed bars).
 */
async function snapWhole(page, folder, name) {
  const vp = page.viewportSize();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height });
  await page.waitForTimeout(250);
  try { await snap(page, folder, name); } finally { await page.setViewportSize(vp); }
}

/** Collect console errors and page errors; each test ends by asserting there were none. */
function watchConsole(page, errors = []) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  return errors;
}

/** A screen that loads on demand shows its loading state first: wait until it is gone. */
async function settled(page) {
  await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0 && !document.querySelector('.loading-state'));
}

/** Play a practice lesson to its end, every answer right. */
async function playLesson(page) {
  await expect.poll(() => item(page)).toBeTruthy();
  for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true)); // the "in a row" pop goes by the locator handler, on a tap
  }
  await expect(page.locator('.done-screen').first()).toBeVisible();
}

/** The worked examples (a teaching stage) to their end: one step at a time, then on to the next example. */
async function playWorked(page) {
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  for (let e = 0; e < 4 && !(await page.locator('.stage-done').count()); e += 1) {
    while (await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).count()) await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).first().click();
    await page.getByRole('button', { name: /לדוגמה הבאה|לפתור יחד/ }).first().click();
  }
}

/** A check (mastery or diagnostic) to its result, every answer right. */
async function playCheck(page, n = 5) {
  for (let i = 0; i < n; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
}

const END_KINDS = ['goal-stage', 'streak-screen', 'unlock-stage', 'remind-stage', 'quests-done-screen', 'install-stage'];
/**
 * Press on through the screens after a lesson. `at[kind]` runs when that screen is up; it returns true when it moved on
 * by itself, else the screen's main button is pressed here. Returns the screens met, in order ('summary' is the lesson's
 * own result).
 */
async function walkEnd(page, at = {}) {
  const seen = [];
  for (let k = 0; k < 10; k += 1) {
    await page.waitForTimeout(150);
    const kind = await page.evaluate((kinds) => {
      const el = document.querySelector('.done-screen');
      if (!el) return null;
      return kinds.find((c) => el.classList.contains(c)) || 'summary';
    }, END_KINDS);
    if (!kind) return seen;
    seen.push(kind);
    if (at[kind] && await at[kind]()) {
      await expect.poll(async () => page.evaluate((c) => !document.querySelector(`.done-screen.${c}`), kind), { timeout: 8000 }).toBe(true);
      continue;
    }
    const before = await page.locator('.done-screen h1').first().textContent({ timeout: 2000 }).catch(() => null);
    await page.locator('.done-screen .done-actions .btn').first().click();
    await expect.poll(async () => {
      const now = await page.locator('.done-screen h1').first().textContent({ timeout: 500 }).catch(() => null);
      return now === null || now !== before;
    }, { timeout: 8000 }).toBe(true);
  }
  throw new Error(`too many screens after the lesson: ${seen.join(', ')}`);
}

/** A unit on the home path, by its title. */
const unit = (page, title) => page.locator('.unit').filter({ has: page.locator('.unit-title', { hasText: title }) });

/** From the home path: a stair's card, then its page ("כל חמשת השלבים"). */
async function openStair(page, unitTitle, level) {
  const u = unit(page, unitTitle);
  await u.getByRole('button', { name: new RegExp(`^מדרגה ${level}:`) }).click();
  await u.locator('.node-card').getByRole('button', { name: 'כל חמשת השלבים' }).click();
  await expect(page.locator('.journey')).toBeVisible();
}

/**
 * The server, faked: the class (join, progress with its steps, the goal of the week, and on the integrated branch the
 * teacher's work and the backup code the class keeps), the tutor's status and the counts.
 * Its state (serverState) lives across the week's days. The reminder's key and subscription go to the Worker's own code
 * (`worker`); its "seen" reports are kept here with the day they were sent on. Anything else is a test failure (a 404
 * would also be a console error).
 */
const serverState = () => ({ day: null, steps: {}, joined: false, seen: [], subscribed: [], unknown: [], goalAsked: [], metrics: [], vaults: {}, escrows: 0 });
async function fakeServer(context, worker, st) {
  const goalFor = (day) => {
    const week = weekOf(day);
    const mine = st.steps[week] || 0;
    const have = (week === '2026-11-08' ? CLASSMATES[day] : 0) + mine;
    const lastMine = st.steps['2026-11-08'] || 0;
    const last = week === '2026-11-15' ? { week: '2026-11-08', target: TARGET, have: CLASSMATES_FINAL + lastMine, mine: lastMine, reached: CLASSMATES_FINAL + lastMine >= TARGET } : null;
    return { on: true, week, target: TARGET, have, mine, reached: have >= TARGET, last };
  };
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname; const h = req.headers();
    const reply = (code, data) => route.fulfill({ status: code, contentType: 'application/json', headers: CORS, body: JSON.stringify(data) });
    if (path === '/api/metrics') { st.metrics.push(req.postData()); return route.fulfill({ status: 204, headers: CORS }); }
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    if (path === '/api/push/key' || path === '/api/push/subscribe') {
      // the Worker's own handlers, in memory: a subscription it would refuse fails here too
      const res = await worker.call(req.method(), path, { body: req.method() === 'POST' ? body : undefined });
      if (path === '/api/push/subscribe') st.subscribed.push({ status: res.status, body });
      return route.fulfill({ status: res.status, contentType: 'application/json', headers: CORS, body: await res.text() });
    }
    if (path === '/api/push/seen') { st.seen.push({ day: st.day, done: body.done === true }); return reply(200, { status: 'on' }); }
    if (path === '/api/push/off') return reply(200, { ok: true });
    if (path === '/api/ai/status') return reply(200, { paywall: false, tier: 'open', kinds: ['explain', 'chat', 'generate', 'check', 'exam'], groups: { all: { left: 40, limit: 40 } }, aiReady: true });
    if (path === `/api/classes/${CLASS.code}/join`) {
      if (body.pin !== CLASS.pin || !body.name) return reply(400, { error: 'bad_pin' });
      st.joined = true;
      return reply(200, { classCode: CLASS.code, className: CLASS.name, grade: '7', token: CLASS.token, studentId: 's9', name: body.name, returning: false });
    }
    if (path === '/api/progress') {
      if (h.authorization !== `Bearer ${CLASS.token}`) return reply(401, { error: 'not_signed_in' });
      for (const s of body.steps || []) { const w = weekOf(dayOf(s.at)); st.steps[w] = (st.steps[w] || 0) + s.pts; }
      return reply(200, { saved: (body.events || []).length, steps: (body.steps || []).length });
    }
    if (path === '/api/class/goal') {
      if (h.authorization !== `Bearer ${CLASS.token}`) return reply(401, { error: 'not_signed_in' });
      st.goalAsked.push(st.day);
      return reply(200, goalFor(st.day));
    }
    // the other lanes' class routes on the integrated branch, as e2e/fakeServer.js answers them: the teacher's work
    // (TEACHER-5: none this week), and the backup code the class keeps for a student who joins (DURABLE-5/6: the
    // sealed copy by X-Vault, then its code with the class)
    if (path === '/api/class/work') {
      if (h.authorization !== `Bearer ${CLASS.token}`) return reply(401, { error: 'not_signed_in' });
      return reply(200, { today: st.day, teacherName: null, help: [], assignments: [] });
    }
    if (path === '/api/vault' || path === '/api/vault/rev') {
      const id = String(h['x-vault'] || ''); const v = st.vaults[id];
      if (req.method() === 'GET') return v ? reply(200, { rev: v.rev, updatedAt: v.updatedAt, ...(path === '/api/vault' ? { blob: v.blob } : {}) }) : reply(404, { error: 'vault_not_found' });
      const updatedAt = new Date().toISOString(); const rev = (v?.rev || 0) + 1;
      if ((body.ifRev ?? null) !== (v ? v.rev : null)) return reply(409, { error: 'vault_conflict', rev: v?.rev ?? null });
      st.vaults[id] = { rev, blob: body.blob, updatedAt };
      return reply(200, { rev, updatedAt });
    }
    if (path === '/api/vault/escrow') {
      if (h.authorization !== `Bearer ${CLASS.token}`) return reply(401, { error: 'not_signed_in' });
      st.escrows += 1;
      return reply(200, { escrow: 'class' });
    }
    st.unknown.push(`${req.method()} ${path}`);
    return reply(404, { error: 'not_found' });
  });
}

test.describe('a week in a student\'s life', { tag: '@student' }, () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });
  let browser; let options; let context; let page; let server; let worker; let sub; let shots; let now;
  const errors = [];

  /**
   * A phone's browser for one day, carrying what the app saved on the days before (localStorage and IndexedDB). Each
   * day starts its own, because the test clock counts the page's performance.now() from the moment it was set: on a
   * browser kept all week, that count runs ahead of the page's animation timeline, and the app's exit animations (the
   * "in a row" pop, the streak counter) would then wait as many seconds to start.
   */
  async function openPhone(storageState) {
    if (context) await context.close();
    context = await browser.newContext({ ...options, storageState });
    context.setDefaultTimeout(20_000);
    await context.grantPermissions(['notifications'], { origin: new URL(options.baseURL).origin });
    await context.addInitScript(([ep, keys]) => {
      // the install offer would take the last screen after a lesson (install.spec.js covers it)
      window.addEventListener('beforeinstallprompt', (e) => e.stopImmediatePropagation(), true);
      if (!('PushManager' in window)) return;
      const made = () => ({
        endpoint: ep, options: { applicationServerKey: null },
        toJSON: () => ({ endpoint: ep, expirationTime: null, keys }),
        unsubscribe: async () => { localStorage.removeItem('e2e-push'); return true; },
      });
      PushManager.prototype.subscribe = async function subscribe() { localStorage.setItem('e2e-push', '1'); return made(); };
      PushManager.prototype.getSubscription = async function getSubscription() { return localStorage.getItem('e2e-push') ? made() : null; };
    }, [sub.endpoint, { p256dh: sub.p256dh, auth: sub.auth }]);
    await fakeServer(context, worker, server);
    page = await context.newPage();
    watchConsole(page, errors);
    // the "in a row" pop over a lesson goes on a tap, as a student taps it away
    await page.addLocatorHandler(page.locator('.combo-pop'), (pop) => pop.click());
  }

  /** She opens the app on that day: the clock is set first, then the app starts. */
  const day = async (iso) => {
    await openPhone(await context.storageState({ indexedDB: true }));
    now = new Date(iso);
    server.day = dayOf(iso);
    await page.clock.setFixedTime(now);
    await page.goto('./#/');
    await settled(page);
  };

  test.beforeAll(async ({ browser: b }, info) => {
    if (!PHONES.includes(info.project.name)) return;
    browser = b;
    const u = info.project.use;
    options = {
      baseURL: u.baseURL, viewport: u.viewport, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor,
      colorScheme: u.colorScheme || 'light', locale: u.locale, reducedMotion: u.reducedMotion, serviceWorkers: 'allow',
    };
    // the Worker's reminder half, in memory (its fetch stub is put back at once: nothing here fetches until Friday)
    const vapid = await makeVapidKeys();
    worker = await setup({ PUSH: 'on', VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_JWK: JSON.stringify(vapid.jwk), VAPID_SUBJECT: 'mailto:hello@example.test', PUSH_BATCH: '10' });
    worker.net.restore();
    // the browser's push service, played: Chromium here has no push service to subscribe with. The keys are a real
    // P-256 pair, so the Worker accepts the subscription and could encrypt for it.
    sub = await makeSubscription();
    sub.endpoint = `https://fcm.googleapis.com/fcm/send/week-${info.project.name}`;
    server = serverState();
    await openPhone(undefined);
    shots = `week/${info.project.name}`;
  });
  test.afterAll(async () => { await context?.close(); worker?.done(); });
  test.beforeEach(({}, info) => {
    test.skip(!PHONES.includes(info.project.name), 'the week runs on the two phones and the phone in dark mode');
    errors.length = 0;
  });
  test.afterEach(({}, info) => {
    if (!PHONES.includes(info.project.name)) return;
    expect(errors, 'no console errors').toEqual([]);
    expect(server.unknown, 'every request the app made was expected').toEqual([]);
  });
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state);
  // the clock stands still within a day (setFixedTime), so the class goal's 15-second memory never runs out: the
  // student puts the app aside for a moment and comes back, which asks the server again (lib/classGoal.js)
  const comeBack = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  test('Sunday 8.11: the first questions, the first teaching stage pays off, a first lesson, and the daily goal\'s moment', async () => {
    // a phone that opens the class's address: the app with a server (the e2e build has none of its own)
    now = new Date('2026-11-08T16:00:00');
    await page.clock.setFixedTime(now);
    server.day = '2026-11-08';
    await page.goto('./');
    await page.evaluate((ai) => {
      localStorage.clear();
      localStorage.setItem('madregot-debug', '1');
      localStorage.setItem('madregot-seed', '424242');
      localStorage.setItem('madregot', JSON.stringify({ state: { ai }, version: 4 }));
    }, { mode: 'server', apiUrl: API, key: '', device: '', familyDevice: null, pendingLink: null, lastTier: null, consentAt: '' });
    await page.reload();
    await settled(page);
    await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
    await page.fill('#w-name', 'נועה');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click(); // the daily goal: the default, 10 minutes
    // no class code yet: she joins tomorrow, from the app
    await expect(page.getByText('יש לכם קוד כיתה מהמורה?')).toBeVisible();
    await page.getByRole('button', { name: 'המשך בלי קוד', exact: true }).click();
    await page.getByRole('radio', { name: /^מתחילים מההתחלה/ }).click();
    await page.getByRole('button', { name: 'לשיעור הראשון', exact: true }).click();
    // the first stair starts by understanding, and that stage alone already gives something back
    await expect(page).toHaveURL(/#\/learn\/signed\/1\/A/);
    await playDiscover(page);
    const moment = await stageDone(page, 1);
    await expect(moment.locator('.badges')).toContainText('+10 XP');
    await expect(moment.locator('.badges')).toContainText('התחלתם רצף');
    await moment.getByRole('button', { name: 'למפה', exact: true }).click();
    await expect(page.locator('.top-stat.streak')).toContainText('1');
    // the first lesson, from the stair's page: practice
    await openStair(page, 'מספרים מכוונים', 1);
    await page.getByRole('button', { name: 'מתרגלים לבד: פתיחה' }).click();
    await playLesson(page);
    let goalShot = false;
    const seen = await walkEnd(page, {
      'goal-stage': async () => {
        await expect(page.locator('.goal-stage h1')).toHaveText('הגעתם ליעד היומי!');
        await snap(page, shots, '1-sunday-goal');
        goalShot = true;
        return false;
      },
    });
    expect(seen.slice(0, 2)).toEqual(['summary', 'goal-stage']);
    expect(goalShot).toBe(true);
    await expect(page.locator('.journey')).toBeVisible();
    const st = await saved(page);
    expect(st.profile).toMatchObject({ role: 'student', name: 'נועה', grade: '7' });
    expect(st.days['2026-11-08']).toMatchObject({ stages: 1, lessons: 1 });
    expect(st.days['2026-11-08'].xp).toBeGreaterThanOrEqual(20);
  });

  test('Monday 9.11: she joins her class with the teacher\'s code and sees the class goal, with her own part and no one\'s name', async () => {
    await day('2026-11-09T16:00:00');
    await page.getByRole('link', { name: 'אני', exact: true }).click();
    await page.getByRole('link', { name: 'הגדרות' }).click();
    await settled(page);
    await page.locator('#me-code').fill(CLASS.code);
    await page.locator('#me-pin').fill(CLASS.pin);
    await page.getByRole('button', { name: 'הצטרפות', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'הכיתה שלי' })).toBeVisible();
    expect(server.joined).toBe(true);
    // a classroom is quiet: sounds start off for a student who joins a class and never chose (STUDENT-7)
    expect((await saved(page)).sound).toBe(false);
    // today's step, the one the stair's page offers next: the worked examples
    await page.getByRole('button', { name: 'חזרה' }).click();
    await page.getByRole('link', { name: 'לימוד', exact: true }).click();
    await openStair(page, 'מספרים מכוונים', 1);
    await page.getByRole('button', { name: 'לדוגמה הפתורה' }).click();
    await playWorked(page);
    await (await stageDone(page, 2)).getByRole('button', { name: 'למפה', exact: true }).click();
    await expect(page.locator('.learn-top')).toBeVisible();
    await comeBack();
    // the class goal, above today's missions: the class total and her own part, never a classmate's name or a rank
    await page.getByRole('link', { name: 'משימות', exact: true }).click();
    const card = page.getByRole('region', { name: 'מטרת הכיתה השבוע' });
    await expect(card).toBeVisible();
    await expect.poll(() => server.steps['2026-11-08'] || 0).toBeGreaterThan(0);
    const g = { mine: server.steps['2026-11-08'], have: CLASSMATES['2026-11-09'] + server.steps['2026-11-08'] };
    await expect(card).toContainText(`${g.have} מתוך ${TARGET} צעדים`);
    await expect(card).toContainText('החלק שלכם השבוע');
    expect(await page.locator('body').innerText()).not.toMatch(/דירוג|מקום ה|ליגה/);
    await card.scrollIntoViewIfNeeded();
    await snap(page, shots, '2-monday-class-goal');
  });

  test('Tuesday 10.11: no learning; she opens the app in the evening and nothing pressures her', async () => {
    await day('2026-11-10T20:30:00');
    await expect(page.locator('.learn-top')).toBeVisible();
    await expect(page.locator('.top-stat.streak')).toContainText('2');
    await expect(page.locator('.repair-card')).toHaveCount(0); // yesterday she learned
    await expect(page.locator('body')).not.toContainText(PRESSURE);
    await snap(page, shots, '3-tuesday-home');
    expect((await saved(page)).days['2026-11-10']).toBeUndefined();
  });

  test('Wednesday 11.11: the calm repair card, two lessons, "הרצף נשמר"; the reminder is offered once and she turns it on', async () => {
    await day('2026-11-11T16:00:00');
    const card = page.locator('.repair-card');
    await expect(card.locator('.repair-text')).toHaveText('אתמול לא יצא ללמוד. עוד שני שיעורים היום, והרצף של 2 ימים נשמר.');
    await expect(page.locator('body')).not.toContainText(PRESSURE);
    // the first lesson: practice again on the stair she is on
    await openStair(page, 'מספרים מכוונים', 1);
    await page.getByRole('button', { name: 'מתרגלים לבד: שוב' }).click();
    await playLesson(page);
    let offered = false;
    const first = await walkEnd(page, {
      'remind-stage': async () => {
        offered = true;
        const r = page.locator('.remind-stage');
        await expect(r.getByRole('heading', { level: 1 })).toHaveText('רוצים תזכורת קטנה?');
        await expect(r.locator('#remind-text')).toHaveText('הודעה אחת ביום, בשעה שתבחרו. לא בשבת ובחגים, ולא ביום שכבר למדתם.');
        await expect(r.getByRole('radio', { name: '17:00' })).toHaveAttribute('aria-checked', 'true');
        await expect(r).not.toContainText(/₪|מנוי|רצף/); // no price, no plan, no streak as a threat
        await r.getByRole('button', { name: 'להפעיל' }).click();
        await expect(r.getByRole('button', { name: 'התזכורת פועלת' })).toBeVisible();
        return true;
      },
    });
    // the third learning day: the reminder is offered after this lesson, the last screen
    expect(first.at(-1)).toBe('remind-stage');
    expect(offered).toBe(true);
    expect(server.subscribed).toHaveLength(1);
    expect(server.subscribed[0]).toMatchObject({ status: 200, body: { endpoint: sub.endpoint, slot: '17', keys: { p256dh: sub.p256dh, auth: sub.auth } } });
    await expect(page.locator('.journey')).toBeVisible();
    await page.locator('.journey').getByRole('button', { name: 'למפה', exact: true }).click();
    await expect(page.locator('.repair-card .repair-text')).toContainText('עוד שיעור אחד היום');
    // the second lesson keeps the streak: Tuesday is saved as repaired, and nothing calls it lost
    await openStair(page, 'מספרים מכוונים', 1);
    await page.getByRole('button', { name: 'מתרגלים לבד: שוב' }).click();
    await playLesson(page);
    let kept = false;
    const second = await walkEnd(page, {
      'streak-screen': async () => {
        await expect(page.locator('.streak-screen h1')).toHaveText('3 ימים ברצף!');
        await expect(page.locator('.streak-card-text')).toHaveText('הרצף נשמר. 3 ימים ברצף.');
        await expect(page.locator('.week-day.frozen .visually-hidden')).toHaveText('הרצף נשמר');
        await expect(page.locator('body')).not.toContainText(PRESSURE);
        await page.waitForTimeout(900); // the big number ticks up from today's 1 to the whole streak
        await snap(page, shots, '4-wednesday-streak-kept');
        kept = true;
        return false;
      },
    });
    expect(kept).toBe(true);
    // the reminder was offered once, ever: not again
    expect(second).not.toContain('remind-stage');
    const st = await saved(page);
    expect(st.days['2026-11-10']).toEqual({ frozen: 'repair' });
    expect(st.reminder).toMatchObject({ on: true, slot: 17 });
    // two lessons without a mistake: the day's three missions, and a streak freeze for a day without learning
    expect(second).toContain('quests-done-screen');
    expect(st.freezes).toBe(1);
  });

  test('Thursday 12.11: three mastery checks in זוויות; the third opens the chest, Madi\'s new piece, and the wardrobe', async () => {
    await day('2026-11-12T16:00:00');
    for (const level of [1, 2, 3]) {
      await openStair(page, 'זוויות', level);
      await page.getByRole('button', { name: 'בדיקת שליטה: פתיחה' }).click();
      await playCheck(page);
      await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
      if (level === 3) await expect(page.locator('.check-done .badges')).toContainText('פתחתם תיבת אוצר');
      await page.getByRole('button', { name: 'למפה' }).click();
      await settled(page);
    }
    // the chest's piece comes with its own calm moment, and is only saved when she says so
    const stage = page.locator('.unlock-stage');
    await expect(stage.getByRole('heading', { level: 1 })).toHaveText('מדי קיבל משהו חדש');
    await expect(stage.locator('.unlock-reason')).toHaveText('שלטתם בחצי הראשון של זוויות, ומדי קיבל כתר מד־זווית.');
    await snap(page, shots, '5-thursday-unlock');
    await stage.getByRole('button', { name: 'לשמור על מדי' }).click();
    await expect(page.locator('.learn-top')).toBeVisible();
    // the chest on the path says what it gave
    const angles = unit(page, 'זוויות');
    await angles.getByRole('button', { name: /^תיבת אוצר\. פתוחה/ }).click();
    await expect(angles.locator('.node-card')).toContainText('פתחתם: כתר מד־זווית.');
    await expect(angles.locator('.node-card [data-item="protractor-crown"]')).toHaveCount(1); // its picture loads on demand
    // the card just above the tab bar, clear of the unit's banner that stays on top while the path scrolls
    await angles.locator('.node-card').evaluate((el) => {
      const bar = document.querySelector('.tabbar')?.getBoundingClientRect().height || 0;
      window.scrollBy(0, el.getBoundingClientRect().bottom - (window.innerHeight - bar - 12));
    });
    await snap(page, shots, '5b-thursday-chest');
    // and the wardrobe: the crown is on, the class scarf waits for the class
    await page.getByRole('link', { name: 'אני', exact: true }).click();
    await page.getByRole('link', { name: 'עיצוב מדי' }).click();
    await settled(page);
    await expect(page.getByRole('radiogroup', { name: 'על הראש' }).getByRole('radio', { name: /^כתר מד־זווית/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.wardrobe-madi g[data-item="protractor-crown"]')).toHaveCount(1);
    await expect(page.getByRole('radio', { name: /^צעיף הכיתה/ })).toHaveAttribute('aria-disabled', 'true');
    await snap(page, shots, '5c-thursday-wardrobe');
    const st = await saved(page);
    expect(st.look).toMatchObject({ head: 'protractor-crown' });
    expect(st.days['2026-11-12'].mp).toBe(3);
  });

  test('Friday 13.11: no learning; she looks at the reminder in Settings, and on Shabbat eve the Worker sends nothing', async () => {
    await day('2026-11-13T10:30:00');
    await page.getByRole('link', { name: 'אני', exact: true }).click();
    await page.getByRole('link', { name: 'הגדרות' }).click();
    await settled(page);
    const reminder = page.getByRole('radiogroup', { name: 'תזכורת יומית' });
    await expect(reminder.getByRole('radio', { name: 'פועלת' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('לא נשלחת בשבת ובחגים, בימי הזיכרון ובתשעה באב, לא אחרי 12:00 בערב שלהם')).toBeVisible();
    await reminder.scrollIntoViewIfNeeded();
    await snap(page, shots, '6-friday-reminder');
    expect((await saved(page)).days['2026-11-13']).toBeUndefined();
    // the Worker's own sending code on the row the app made on Wednesday, with the days the app told it about since
    const done = server.seen.filter((s) => s.done).map((s) => s.day).sort().at(-1);
    expect(done).toBe('2026-11-12'); // Thursday's checks told the server she learned
    const seenDay = server.seen.map((s) => s.day).sort().at(-1);
    worker.env.DB.raw.prepare('UPDATE push_subs SET last_done_day = ?, last_seen_day = ? WHERE endpoint = ?').run(done, seenDay, sub.endpoint);
    const sent = [];
    const net = stubFetch({ other: async (url) => { sent.push(url); return new Response(null, { status: 201 }); } });
    try {
      // the cron runs at :37 every hour; on Friday the reminder's hours (16-20) are all on Shabbat's eve
      for (const hh of [16, 17, 18, 19, 20]) expect(await pushDue(worker.env, inJerusalem('2026-11-13', hh))).toEqual({ skipped: 'quiet' });
      expect(await pushDue(worker.env, inJerusalem('2026-11-13', 11))).toEqual({ skipped: 'hour' });
      expect(sent, 'nothing is sent on Friday').toEqual([]);
    } finally { net.restore(); }
  });

  test('Shabbat 14.11: a rest day: the streak is kept, the freeze covers Friday, and no reminder goes out', async ({}, info) => {
    await day('2026-11-14T11:00:00');
    // on opening, the freeze she earned on Wednesday covers Friday; Shabbat itself is a rest day
    await expect(page.locator('.top-stat.streak')).toContainText('4');
    const st = await saved(page);
    expect(st.days['2026-11-13']).toMatchObject({ frozen: true });
    expect(st.days['2026-11-14']).toBeUndefined();
    expect(st.freezes).toBe(0);
    // her home and her profile after a week: the after pictures of the council's home (light, whole page, and dark)
    // and profile (whole page)
    if (info.project.name === 'phone') {
      await snapWhole(page, 'after', 'h1-02-home-full');
      await page.getByRole('link', { name: 'אני', exact: true }).click();
      await expect(page.locator('.profile-avatar svg.mascot')).toBeVisible();
      await snapWhole(page, 'after', 'T13-06-__me-full');
    }
    if (info.project.name === 'phone-dark') await snap(page, 'after', 'dark-home');
    await page.getByRole('link', { name: 'משימות', exact: true }).click();
    const streak = page.locator('.streak-card');
    await expect(streak).toContainText('בשבת ובחג הרצף נשמר.');
    await expect(page.locator('body')).not.toContainText(PRESSURE);
    // the class has not reached its goal yet: no moment on Shabbat
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await streak.scrollIntoViewIfNeeded();
    await snap(page, shots, '7-shabbat-streak');
    const sent = [];
    const net = stubFetch({ other: async (url) => { sent.push(url); return new Response(null, { status: 201 }); } });
    try {
      for (const hh of [16, 17, 18, 19, 20]) expect(await pushDue(worker.env, inJerusalem('2026-11-14', hh))).toEqual({ skipped: 'quiet' });
      expect(sent).toEqual([]);
      // the same row on an ordinary evening is sent (Monday 16.11, 17:37, nothing learned yet that day): the quiet on
      // Friday and Shabbat is the rule, not a row that could never be sent
      const monday = await pushDue(worker.env, inJerusalem('2026-11-16', 17));
      expect(monday).toMatchObject({ sent: 1, failed: 0 });
      expect(sent).toEqual([sub.endpoint]);
    } finally { net.restore(); }
  });

  test('Sunday 15.11: last week\'s class goal was reached with her steps: the moment, and Madi\'s class scarf', async () => {
    await day('2026-11-15T10:00:00');
    const mine = server.steps['2026-11-08'];
    expect(mine).toBe(12); // the worked examples on Monday, two lessons on Wednesday, three passed mastery checks (3 each)
    const sheet = page.getByRole('dialog', { name: 'עשינו את זה יחד' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(`הכיתה שלכם עברה את המטרה של השבוע שעבר, ואתם הוספתם ${mine} צעדים. מדי קיבל צעיף כיתה.`);
    await snap(page, shots, '8-sunday-class-goal');
    await sheet.getByRole('button', { name: 'לראות את מדי' }).click();
    await expect(page).toHaveURL(/#\/me\/madi/);
    await settled(page);
    const scarf = page.getByRole('radio', { name: /צעיף הכיתה/ });
    await expect(scarf).toBeChecked();
    await expect(page.locator('.wardrobe-madi g[data-item="protractor-crown"]')).toHaveCount(1);
    await expect(page.locator('.wardrobe-madi g[data-item="class-scarf"]')).toHaveCount(1);
    await scarf.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await snap(page, shots, '8b-sunday-wardrobe');
    const st = await saved(page);
    expect(st.look).toMatchObject({ head: 'protractor-crown', neck: 'class-scarf' });
    expect(st.nudges.goalSeen['2026-11-08']).toBe('2026-11-15');
    // and the moment does not come again
    await page.goto('./#/');
    await page.reload();
    await settled(page);
    await page.waitForTimeout(400);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Sunday 15.11: the recap card, its sheet and "לשלוח להורים" (STUDENT-6)', async () => {
    await day('2026-11-15T11:00:00');
    // the class goal's moment was seen above; the Sunday card is on the home screen, above the path
    const card = page.locator('.recap-card');
    await expect(card.getByRole('heading', { name: 'איך היה השבוע שעבר?' })).toBeVisible();
    await snap(page, shots, '9-sunday-recap-card');
    await card.getByRole('button', { name: 'לראות' }).click();
    const sheet = page.getByRole('dialog', { name: 'השבוע שעבר, 8.11–14.11' });
    await expect(sheet).toBeVisible();
    const num = (label) => sheet.locator('.recap-tiles .kpi').filter({ hasText: label }).locator('.kpi-num');
    const days = Number(await num('ימי לימוד').textContent());
    expect(days).toBeGreaterThanOrEqual(3); // Sunday, Wednesday, Thursday at least (Tuesday and Friday had none)
    // her steps are the week's own count (STUDENT-5): the 12 the class got, and Sunday's before she joined
    const st = await saved(page);
    let steps = 0;
    for (let i = 0; i < 7; i += 1) { const d = new Date(Date.UTC(2026, 10, 8 + i)).toISOString().slice(0, 10); const r = st.days[d] || {}; steps += (r.lessons || 0) + (r.stages || 0) + 2 * (r.mp || 0); }
    await expect(num('צעדים')).toHaveText(String(steps));
    expect(steps).toBeGreaterThanOrEqual(server.steps['2026-11-08']);
    await expect(num('מדרגות בשליטה')).toHaveText('3'); // Thursday's three mastery checks in זוויות
    await expect(sheet.locator('.recap-mastered')).toContainText('מדרגות חדשות בשליטה: ');
    await expect(sheet.locator('.recap-class')).toHaveText(`הכיתה: ${CLASSMATES_FINAL + server.steps['2026-11-08']} מתוך ${TARGET}. הגעתם למטרה יחד. החלק שלכם: ${server.steps['2026-11-08']} צעדים.`);
    await expect(sheet.locator('.recap-earned')).toContainText('כתר מד־זווית'); // the chest she opened on Thursday
    await expect(sheet).not.toContainText(PRESSURE);
    await snap(page, shots, '9b-sunday-recap-sheet');
    await sheet.locator('.recap-actions').getByRole('button', { name: 'לשלוח להורים' }).click();
    const share = page.getByRole('dialog', { name: 'לשלוח להורים' });
    await expect(share.locator('a.share-wa')).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
    await snap(page, shots, '9c-sunday-recap-share');
    await page.keyboard.press('Escape');
    await expect(share).toHaveCount(0);
    expect((await saved(page)).nudges.recapWeek).toBe('2026-11-08');
    // the parents' page for "השבוע שעבר" counts the same week the same way
    await page.goto('./#/report');
    await settled(page);
    await page.getByRole('radio', { name: 'השבוע שעבר' }).click();
    await expect(page.locator('.report-tiles .kpi').filter({ hasText: 'ימי תרגול' }).locator('.kpi-num')).toHaveText(String(days));
    await expect(page.locator('.report-mastered li')).toHaveCount(3);
    // and the card does not come back
    await page.goto('./#/');
    await page.reload();
    await settled(page);
    await page.waitForTimeout(400);
    await expect(page.locator('.recap-card')).toHaveCount(0);
  });
});

test.describe('also captured: what the council could not finish end to end', { tag: '@student' }, () => {
  let errors;
  test.beforeEach(async ({ page }, info) => {
    test.skip(!PHONES.includes(info.project.name), 'on the two phones and the phone in dark mode');
    errors = watchConsole(page);
    await page.addLocatorHandler(page.locator('.combo-pop'), (pop) => pop.click());
  });
  test.afterEach(({}, info) => { if (PHONES.includes(info.project.name)) expect(errors, 'no console errors').toEqual([]); });

  test('the placement result: each topic it tests gets its starting stair', async ({ page }, info) => {
    await open(page, '#/');
    await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
    await page.fill('#w-name', 'נועה');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('radio', { name: /^בדיקת רמה קצרה/ }).click();
    await page.getByRole('button', { name: 'לבדיקת הרמה', exact: true }).click();
    await expect(page).toHaveURL(/#\/placement/);
    for (let n = 0; n < 30; n += 1) {
      if (await page.locator('.done-screen').count()) break;
      await expect.poll(() => item(page)).toBeTruthy();
      const it = await answer(page, (await item(page)).level <= 2);
      await proceedToNext(page, it);
    }
    await expect(page.getByText('מצאנו את המדרגה שלכם')).toBeVisible();
    await expect(page.locator('.place-row').first()).toBeVisible();
    await snap(page, `extra/${info.project.name}`, 'placement-result');
  });

  test('the unit review: a unit whose stairs are all mastered closes with its review', async ({ page }, info) => {
    const all = (n) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 'mastered'])) });
    const st = student('7', { path: { coord: all(5) }, lastTopic: 'coord' });
    await open(page, '#/', st);
    const coord = unit(page, 'מערכת צירים');
    await coord.getByRole('button', { name: /^חזרה על היחידה/ }).click();
    await coord.locator('.node-card').getByRole('button', { name: 'התחלה' }).click();
    await playLesson(page);
    await expect(page.locator('.done-screen h1').first()).toHaveText('סיימתם חזרה על היחידה!');
    await expect(page.locator('.done-screen .badges')).toContainText('מערכת צירים: היחידה הושלמה');
    await snap(page, `extra/${info.project.name}`, 'unit-review-done');
  });

  test('Exam Rescue to its first task: the date, the stairs, the short check, the plan, and today\'s first task', async ({ page }, info) => {
    await open(page, '#/rescue', student('7'));
    const d = new Date('2026-11-05T10:00:00'); d.setDate(d.getDate() + 4); // the helpers' Thursday: the exam is on Monday
    await page.locator('#exam-date').fill(d.toLocaleDateString('en-CA'));
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByText('מספרים מכוונים (כל הנושא)').click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByRole('button', { name: /לבניית התוכנית/ }).click();
    await page.getByRole('button', { name: /לבדיקה הקצרה/ }).click();
    await expect.poll(() => item(page)).toBeTruthy();
    // one question or two for each stair of the topic (on the integrated branch מספרים מכוונים has six), to its end
    const over = page.getByRole('heading', { name: 'הבדיקה הסתיימה' });
    for (let i = 0; i < 20 && !(await over.count()); i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, i % 2 === 0); await proceed(page); }
    await expect(over).toBeVisible();
    await page.getByRole('button', { name: /לתוכנית ההכנה/ }).click();
    await expect(page.locator('.rescue-day').first()).toContainText('היום');
    await snap(page, `extra/${info.project.name}`, 'rescue-plan');
    await page.locator('.rescue-day').first().getByRole('button', { name: 'מתחילים' }).click();
    await settled(page);
    await expect(page).toHaveURL(/#\/(learn|lesson|repair)\//);
    await page.waitForTimeout(300);
    await snap(page, `extra/${info.project.name}`, 'rescue-first-task');
  });
});

// The council's seven screenshots (council/student, copied to qa-evidence/student/before/), taken again on the same
// screens for the before/after sheet in QA_STUDENT.md, on the phone at 390 wide. The home (light and dark) and the
// profile are her own after the week (the Shabbat test); the teaching steps and a lesson's end are taken here.
test.describe('the council\'s screens, after', { tag: '@student' }, () => {
  let errors;
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'one phone takes the after pictures (it emulates dark for the dark home)');
    errors = watchConsole(page);
    await page.addLocatorHandler(page.locator('.combo-pop'), (pop) => pop.click());
  });
  test.afterEach(({}, info) => { if (info.project.name === 'phone') expect(errors, 'no console errors').toEqual([]); });
  const step = (page) => page.evaluate(() => window.__madregotStep);

  test('the first teaching steps of מספרים מכוונים: the first screen, a wrong move on the line, a wrong prediction', async ({ page }) => {
    await open(page, '#/learn/signed/1/A', student('7'));
    await expect(page.locator('.step-player')).toBeVisible();
    await expect.poll(() => step(page)).toBeTruthy();
    await page.waitForTimeout(300);
    await snap(page, 'after', 'i13f-02-teach-0');
    const next = async () => { const at = await page.locator('.sp-progress').getAttribute('aria-valuenow'); await page.locator('.sp-next').click(); await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at); };
    const right = async (st) => {
      const d = st.answer - st.manip.start;
      for (let k = 0; k < Math.abs(d); k += 1) await page.getByRole('button', { name: d > 0 ? 'הסמן ימינה' : 'הסמן שמאלה' }).first().click();
      await page.locator('.lm-check').click();
      await expect(page.locator('.lm-actions.has-good')).toBeVisible();
    };
    await next();
    await right(await step(page)); // −2 + 5
    await next();
    // 4 + (−6), moved the wrong way: six steps right
    const st = await step(page);
    expect(st.display).toBe('4 + (-6)');
    for (let k = 0; k < 6; k += 1) await page.getByRole('button', { name: 'הסמן ימינה' }).first().click();
    await page.locator('.lm-check').click();
    await expect(page.locator('.lm-actions.has-warm, .lm-actions.has-bad').first()).toBeVisible();
    await page.waitForTimeout(300);
    await snap(page, 'after', 't3-02-wrong1');
    // back to the start of the step and the right way
    await page.reload();
    await settled(page);
    await expect.poll(() => step(page)).toBeTruthy();
    for (let i = 0; i < 6; i += 1) {
      const s = await step(page);
      if (s.kind === 'predict') break;
      if (s.kind === 'explore') await right(s);
      await next();
    }
    const p = await step(page);
    expect(p.display).toBe('2 - (-3)');
    await page.locator('.ls-choice').nth(0).click(); // −1: what adding −3 would give
    await page.locator('.lm-check').click();
    await expect(page.locator('.lm-actions').first()).toBeVisible();
    await page.waitForTimeout(300);
    await snap(page, 'after', 't6-01-predict-wrong');
  });

  test('the end of a perfect first lesson: what moved, not "0 מתוך 5 מדרגות"', async ({ page }) => {
    await open(page, '#/lesson/signed/1', student('7', { goalXp: 50 }));
    await playLesson(page);
    await expect(page.locator('.done-screen .climb-caption')).toBeVisible();
    await expect(page.locator('.done-screen')).not.toContainText('0 מתוך 5 מדרגות');
    await page.waitForTimeout(300);
    await snap(page, 'after', 'L2-09-end-16');
  });
});
