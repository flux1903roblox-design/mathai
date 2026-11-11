// Shared helpers for the end-to-end tests.
import { expect } from '@playwright/test';
import { toFrac } from '../src/content/util.js';
import { API, CORS, TABLET } from './fakeServer.js';

/** A fixed Thursday, so streaks, the week strip and daily quests are the same on every run. */
export const NOW = new Date('2026-11-05T10:00:00');

/** A saved student, as the app stores it (zustand persist, key 'madregot'). */
export function student(grade = '7', extra = {}) {
  return {
    state: {
      profile: { role: 'student', name: 'נועה', grade, know: 1 }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [],
      // introSeen: the one-time introduction to the tutor was read on this device (trust.spec.js tests it on its own)
      ai: { mode: 'server', apiUrl: '', key: '', introSeen: true }, path: {}, freezes: 0, goalXp: 20, sound: false, gaps: {}, placement: null, ...extra,
    },
    version: 1,
  };
}

/** A student with some history: a mastered unit, a unit in progress, a streak, one gap. */
export function livedIn(grade = '7') {
  const days = { '2026-11-02': { lessons: 2, xp: 30, q: 16, ok: 14 }, '2026-11-03': { lessons: 1, xp: 15, q: 8, ok: 8, perfect: 1 }, '2026-11-04': { lessons: 2, xp: 25, q: 16, ok: 12 }, '2026-11-05': { lessons: 1, xp: 12, q: 8, ok: 7, combo: 4 } };
  return student(grade, {
    days, xp: 260, lastTopic: 'coord', freezes: 1,
    path: { signed: { parts: {}, reviews: 1, jumped: 5 }, coord: { parts: { 1: 2, 2: 2, 3: 1 }, reviews: 0, jumped: 0 } },
    gaps: { 'coord:swap': { level: 2, n: 2, ok: 1, at: '2026-11-04T10:00:00Z' } },
  });
}

/**
 * A week to report on (PARENTS-2), Sunday 1 to Shabbat 7 November with "today" Thursday the 5th: four practice days
 * (62 minutes on learning screens, 43 questions), two stairs that passed a mastery check, a repair done and two
 * mistakes being repaired now, and an exam on the 12th with 2 of its 3 stairs mastered. Synthetic.
 */
export function reportWeek(grade = '7') {
  const ev = (t, e, extra = {}) => ({ t, e, ...extra });
  const misc = (skill, id, score, state) => ({ skill, id, score, seen: [], state, at: '2026-11-04T14:00:00.000Z' });
  return student(grade, {
    xp: 140,
    days: {
      '2026-10-29': { lessons: 1, q: 6, ok: 5, secs: 240, xp: 12 },
      '2026-11-01': { lessons: 1, stages: 1, q: 8, ok: 7, secs: 300, tsecs: 720, xp: 20 },
      '2026-11-02': { lessons: 2, q: 16, ok: 13, secs: 600, tsecs: 1500, xp: 30 },
      '2026-11-04': { lessons: 1, stages: 1, q: 10, ok: 8, secs: 420, tsecs: 900, xp: 18 },
      '2026-11-05': { lessons: 1, q: 9, ok: 8, secs: 330, tsecs: 600, xp: 14 },
    },
    learn: {
      skills: {
        'signed:1': { attempts: [], mastered: { at: '2026-11-02T15:10:00.000Z', box: 0, due: '2026-11-20T00:00:00.000Z' } },
        'signed:2': { attempts: [], mastered: { at: '2026-11-04T14:30:00.000Z', box: 0, due: '2026-11-22T00:00:00.000Z' } },
      },
      miscon: {
        'signed:2|neg-compare': misc('signed:2', 'neg-compare', 2.5, 'confirmed'),
        'coord:1|swap': misc('coord:1', 'swap', 2, 'repairing'),
      },
      exam: { grade, date: '2026-11-12', skills: ['signed:1', 'signed:2', 'coord:1'], confidence: 2, minutes: 30, createdAt: '2026-10-29T10:00:00.000Z' },
      missions: {},
      events: [
        ev('2026-11-01T10:00:00.000Z', 'answer', { s: 'signed:1', ok: true }),
        ev('2026-11-01T10:20:00.000Z', 'lesson-done', { s: 'signed:1', p: 'practice', ok: true }),
        ev('2026-11-02T15:00:00.000Z', 'answer', { s: 'signed:2', ok: false }),
        ev('2026-11-02T15:10:00.000Z', 'check-done', { s: 'signed:1', p: 'mastery', ok: true }),
        ev('2026-11-02T15:30:00.000Z', 'repair-done', { s: 'signed:1', m: 'minus-minus', ok: true }),
        ev('2026-11-04T14:00:00.000Z', 'stage-A', { s: 'coord:1' }),
        ev('2026-11-04T14:10:00.000Z', 'answer', { s: 'coord:1', ok: true }),
        ev('2026-11-04T14:30:00.000Z', 'check-done', { s: 'signed:2', p: 'mastery', ok: true }),
        ev('2026-11-05T07:00:00.000Z', 'answer', { s: 'coord:1', ok: true }),
      ],
    },
  });
}

/**
 * A device whose app talks to the (fake) server (fakeServer.js answers on API), seeded as a v3 save: the v3 migration
 * drops a saved server address in builds that cannot change it. introSeen: the tutor's introduction was read here.
 */
export const withServer = (extra = {}, grade = '7') => ({ ...student(grade, { ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true }, ...extra }), version: 3 });
/** A student of the class K7Q2MD (the fake server's class), as the device keeps it after joining. */
export const CLASS_PROFILE = Object.freeze({ role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', teacherName: 'רונית', token: 'stok-a1', studentId: 'a1' });
export const inClass = (extra = {}) => withServer({ profile: { ...CLASS_PROFILE }, ...extra });
/** K7Q2MD as opened with its key on this device (createdHere: only such a device is offered to bind it to the email). */
export const KEY_CLASS = Object.freeze({ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7', createdHere: true });
/** A teacher whose class this device opened with the key. */
export const keyTeacher = (cls = {}) => withServer({ profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [{ ...KEY_CLASS, ...cls }], active: 'K7Q2MD' } });
/** A teacher whose class is bound to the email: no key on the device, the session opens it. */
export const ownedTeacher = () => withServer({ profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [{ code: 'K7Q2MD', key: null, className: 'ז׳3', grade: '7', owned: true }], active: 'K7Q2MD' } });

/** A path whose stairs (levels) are mastered. */
export const doneStairs = (levels) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) });
/** Madi's look: blue, nothing worn; טורקיז earned before (and stays earned), the newer pieces already seen. */
export const madiLook = (extra = {}) => ({ color: 'sky', head: null, face: null, neck: null, body: null, earned: ['petrol'], seen: ['petrol', 'fuchsia', 'protractor-crown', 'bars-pin'], earnedAt: { petrol: '2026-10-20' }, ...extra });
/** A student with something to choose in the wardrobe: the angles chest open (stairs 1 to 3), the stats unit mastered. */
export const dressed = (extra = {}) => student('7', { path: { angles: doneStairs([1, 2, 3]), stats: doneStairs([1, 2, 3, 4, 5]) }, look: madiLook(extra) });

/** The week to report on (reportWeek), on a device linked to a family plan (fakeServer.js's TABLET); the backup question was asked. */
export const linkedWeek = () => {
  const s = { ...reportWeek(), version: 3 };
  s.state.ai = { mode: 'server', apiUrl: API, key: '', device: '', familyDevice: { token: TABLET.token, label: TABLET.label } };
  s.state.durable = { nudgeCount: 2 };
  return s;
};

/** A backup file (DURABLE-4) holding `state`, as Playwright hands it to a file input. */
export const backupFile = (state, name = 'madregot-backup.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'madregot', kind: 'backup', v: 1, at: '2026-11-04T10:00:00.000Z', schema: 1, release: 'test', state })) });

/** A synthetic 1200×1600 exam page (PNG) drawn in the page itself: the top 10% red (where a name and an ID would be). */
export const examPng = async (page, { red = true } = {}) => Buffer.from(await page.evaluate((r) => {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 1600;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 1600);
  if (r) { x.fillStyle = '#ff0000'; x.fillRect(0, 0, 1200, 160); }
  x.fillStyle = '#222'; x.font = '48px sans-serif';
  for (let i = 0; i < 10; i += 1) x.fillText(`${i + 1})  3x + ${i} = ${3 * (i + 2) + i}`, 80, 320 + i * 110);
  return c.toDataURL('image/png').split(',')[1];
}, red), 'base64');

/**
 * The landing pages' counts (STUDENT-13): the Worker's /api/metrics on API_BASE (playwright.config.js, the same host as
 * API), answered 204 as the Worker does; returns the list of the names counted.
 */
export async function landingMetrics(page) {
  const names = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (new URL(req.url()).pathname === '/api/metrics' && req.method() === 'POST') names.push(req.postData());
    return route.fulfill({ status: 204, headers: CORS });
  });
  return names;
}

/** A landing page (or an app link) on a device with a saved state (null: nothing saved), at the e2e tests' fixed time. */
export async function openLanding(page, path, state = null) {
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('madregot', JSON.stringify(s)); }, state);
  await page.goto(`./${path}`);
  if (path.startsWith('#')) await page.reload(); // the app reads a link when it starts, as it does from another page
  await page.evaluate(() => document.fonts.ready);
}

/** The app's copy of the progress on the device (IndexedDB, lib/durable/idb.js). */
export const DURABLE_DB = 'madregot-durable';

/**
 * Open a route with a saved state (null: a first visit), a fixed clock and repeatable exercises.
 * madregot-debug exposes the current exercise as window.__madregotItem; madregot-seed fixes Math.random.
 * The seed is written once: a later reload starts from what the app saved since (and its copy on the device).
 * `local`: more localStorage keys (a parent's session on their own phone); `at`: the clock (NOW by default).
 */
export async function open(page, route, state = null, seed = '424242', { local = {}, at = NOW } = {}) {
  await page.clock.setFixedTime(at);
  await page.goto('./');
  await page.evaluate(async ([s, sd, db, extra]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', sd);
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
    Object.entries(extra).forEach(([n, v]) => localStorage.setItem(n, v));
    // the copy of the progress on the device goes too (the app lets go of it at once), so the next start reads the seed
    await new Promise((done) => { const r = indexedDB.deleteDatabase(db); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
  }, [state, seed, DURABLE_DB, local]);
  await page.goto(`./${route}`);
  await page.reload();
  await appReady(page);
  await screenReady(page, route);
}

/** The app has drawn its first screen (it waits for the copy on the device first, at most 300 ms) and its fonts. */
export async function appReady(page) {
  await page.waitForFunction(() => !!document.getElementById('root')?.firstElementChild);
  await page.evaluate(() => document.fonts.ready);
}

/**
 * A screen that loads on demand (the lesson since STUDENT-15's budget, Settings, the wardrobe…) shows the loading state
 * first: wait until it is up. On a lesson route, also until the lesson's QA hook is in place, so the exercise on
 * screen can be read (window.__madregotItem; it is set by the lesson once it has drawn its first screen).
 */
export async function screenReady(page, route = '') {
  await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0 && !document.querySelector('.loading-state'));
  if (/^#\/(lesson|practice|placement|rescue\/(check|exam))\b/.test(route)) {
    await page.waitForFunction(() => '__madregotItem' in window, null, { timeout: 10_000 }).catch(() => { /* a lesson that opens on something else */ });
  }
}

export const item = (page) => page.evaluate(() => window.__madregotItem);
export const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state);

const KEY_NAME = { '-': 'מינוס', '/': 'שבר', '.': 'נקודה עשרונית' };
/** Type a value on the app's own keypad. */
export async function type(page, value) {
  for (const ch of String(value)) await page.getByRole('button', { name: KEY_NAME[ch] || ch, exact: true }).click();
}

const slotNames = (it) => (it.form === 'pt' ? ['x', 'y'] : it.form === 'line' ? ['m', 'b'] : it.form === 'lin' ? ['k', 'c'] : it.form === 'frac' ? ['n', 'd'] : ['v']);
/** The typed values of the right answer; a fraction's value becomes its numerator and denominator in lowest terms. */
const values = (it) => {
  if (it.form === 'pt') return it.answer;
  if (it.form === 'line') return [it.answer.m, it.answer.b];
  if (it.form === 'lin') return [it.answer.k, it.answer.c];
  if (it.form === 'frac') { const f = toFrac(it.answer); return [f.n, f.d]; }
  return [it.answer];
};

/**
 * Answer the current exercise, right or wrong (a wrong choice that is still enabled). A lesson opened inside the app may
 * first wait for its topic's teaching file (DURABLE-11): the exercise is there before it is answered.
 */
export async function answer(page, right) {
  await expect.poll(() => item(page)).toBeTruthy();
  const it = await item(page);
  if (it.form === 'manip') {
    // an interactive exercise: the QA hook puts the object in a right state or a near miss
    // (manip.spec.js drives the objects themselves with real drags, keys and step buttons)
    await page.evaluate((ok) => window.__madregotSolve(ok), !!right);
  } else if (it.form === 'mc') {
    if (right) await page.locator('.choice').nth(it.answer).click();
    else {
      const idx = await page.evaluate((a) => [...document.querySelectorAll('.choice')].findIndex((el, i) => i !== a && !el.disabled), it.answer);
      await page.locator('.choice').nth(idx).click();
    }
  } else {
    const names = slotNames(it); const vals = values(it);
    for (let k = 0; k < names.length; k += 1) {
      await page.locator(`#slot-${names[k]}`).click();
      await type(page, right ? vals[k] : 90 + k);
    }
  }
  await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
  return it;
}

/**
 * Open a lesson on an exercise of a given form (and interactive kind): exercises are drawn at random, so this tries
 * fixed seeds in turn until the first exercise is the one wanted. The same seeds give the same exercise every run.
 */
export async function openOn(page, route, state, want) {
  for (let sd = 1; sd <= 40; sd += 1) {
    await open(page, route, state, String(sd));
    await expect.poll(() => item(page)).toBeTruthy();
    const it = await item(page);
    if (want(it)) return it;
  }
  throw new Error(`no seed opens ${route} on the exercise wanted`);
}

/** Press the main button of the feedback panel (continue, try again, got it). */
export const proceed = (page) => page.locator('section.fb .fb-actions .btn').click();

/** Press on and wait until the next exercise (or an end screen) has replaced this one. */
export async function proceedToNext(page, it) {
  await proceed(page);
  await expect.poll(async () => (await page.locator('.done-screen, .combo-pop').count()) > 0 || (await item(page))?.key !== it.key).toBe(true);
}

/** The page itself never scrolls sideways. */
export async function expectNoSidewaysScroll(page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

/** An element is fully inside the viewport and not covered at its centre by something else. */
export async function expectUsable(page, locator, what) {
  await expect(locator, `${what} is visible`).toBeVisible();
  const box = await locator.boundingBox();
  const vp = page.viewportSize();
  expect(box.y, `${what} starts on screen`).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height, `${what} ends on screen`).toBeLessThanOrEqual(vp.height + 1);
  const free = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 12));
    return !!hit && (el === hit || el.contains(hit) || hit.contains(el));
  });
  expect(free, `${what} is not covered`).toBe(true);
}

/**
 * Press through the end-of-lesson screens (summary, streak, quests) back to the map.
 * Each press waits for the screen to settle and for the next one to replace it.
 */
export async function leaveEndScreens(page) {
  const title = () => page.locator('.done-screen h1').first().textContent({ timeout: 1000 }).catch(() => null);
  for (let k = 0; k < 5; k += 1) {
    const btn = page.locator('.done-screen .done-actions .btn').first();
    if (!(await btn.isVisible())) return;
    const before = await title();
    await btn.click();
    // the next screen has another heading, or the map is back
    await expect.poll(async () => { const now = await title(); return now === null || now !== before; }, { timeout: 5000 }).toBe(true);
  }
}

/** The short moment at the end of a teaching stage: which stage, what it earned; its button goes on to the next stage. */
export async function stageDone(page, n, go) {
  const moment = page.locator('.stage-done');
  await expect(moment).toBeVisible();
  await expect(moment.getByRole('heading', { level: 1 })).toHaveText(`שלב ${n} הושלם!`);
  if (go) await moment.getByRole('button', { name: go, exact: true }).click();
  return moment;
}

/** Play the current teaching stage (A) to its end, through its own controls (the completion moment stays on screen). */
export async function playDiscover(page) {
  await expect(page.locator('.step-player')).toBeVisible();
  for (let i = 0; i < 20; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.kind === 'explore') {
      if (st.manip.kind === 'numberline') {
        const d = st.answer - st.manip.start;
        for (let k = 0; k < Math.abs(d); k += 1) await page.getByRole('button', { name: d > 0 ? 'הסמן ימינה' : 'הסמן שמאלה' }).first().click();
      }
      await page.locator('.lm-check').click();
      await expect(page.locator('.lm-actions.has-good')).toBeVisible();
    }
    if (st.kind === 'predict') {
      await page.locator('.ls-choice').nth(st.answer).click();
      await page.locator('.lm-check').click();
      await expect(page.locator('.lm-actions.has-good')).toBeVisible();
    }
    const next = page.locator('.sp-next');
    const last = (await next.textContent()).includes('לדוגמה');
    await next.click();
    if (last) return;
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  throw new Error('the stage did not end');
}

/**
 * Through the first questions (Welcome) as a new student, the way a person does: מתחילים, the name, the grade, how much
 * is known (קצת מוכר), the daily goal (the default) and where to start ('test' | 'scratch'). A landing page's link
 * (#/?next=/rescue) has no start question: pass start: null, and the daily goal's button goes on to the link's place.
 */
export async function onboard(page, { name = 'נועה', grade = '7', start = 'scratch' } = {}) {
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await page.fill('#w-name', name);
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: grade === '8' ? /^כיתה ח׳/ : /^כיתה ז׳/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  const last = page.locator('.ob-foot button[type="submit"]');
  if (!start) { await last.click(); return; } // the daily goal (the default) is the last question
  await page.getByRole('button', { name: 'המשך', exact: true }).click(); // the daily goal: the default
  await page.getByRole('radio', { name: start === 'test' ? /^בדיקת רמה קצרה/ : /^מתחילים מההתחלה/ }).click();
  await last.click();
}
