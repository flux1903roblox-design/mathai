// Shared helpers for the end-to-end tests.
import { expect } from '@playwright/test';

/** A fixed Thursday, so streaks, the week strip and daily quests are the same on every run. */
export const NOW = new Date('2026-11-05T10:00:00');

/** A saved student, as the app stores it (zustand persist, key 'madregot'). */
export function student(grade = '7', extra = {}) {
  return {
    state: {
      profile: { role: 'student', name: 'נועה', grade, know: 1 }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [],
      ai: { mode: 'server', apiUrl: '', key: '' }, path: {}, freezes: 0, goalXp: 20, sound: false, gaps: {}, placement: null, ...extra,
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

/** The app's copy of the progress on the device (IndexedDB, lib/durable/idb.js). */
export const DURABLE_DB = 'madregot-durable';

/**
 * Open a route with a saved state (null: a first visit), a fixed clock and repeatable exercises.
 * madregot-debug exposes the current exercise as window.__madregotItem; madregot-seed fixes Math.random.
 * The seed is written once: a later reload starts from what the app saved since (and its copy on the device).
 */
export async function open(page, route, state = null, seed = '424242') {
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  await page.evaluate(async ([s, sd, db]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', sd);
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
    // the copy of the progress on the device goes too (the app lets go of it at once), so the next start reads the seed
    await new Promise((done) => { const r = indexedDB.deleteDatabase(db); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
  }, [state, seed, DURABLE_DB]);
  await page.goto(`./${route}`);
  await page.reload();
  await appReady(page);
}

/** The app has drawn its first screen (it waits for the copy on the device first, at most 300 ms) and its fonts. */
export async function appReady(page) {
  await page.waitForFunction(() => !!document.getElementById('root')?.firstElementChild);
  await page.evaluate(() => document.fonts.ready);
}

export const item = (page) => page.evaluate(() => window.__madregotItem);
export const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state);

const KEY_NAME = { '-': 'מינוס', '/': 'שבר', '.': 'נקודה עשרונית' };
/** Type a value on the app's own keypad. */
export async function type(page, value) {
  for (const ch of String(value)) await page.getByRole('button', { name: KEY_NAME[ch] || ch, exact: true }).click();
}

const slotNames = (it) => (it.form === 'pt' ? ['x', 'y'] : it.form === 'line' ? ['m', 'b'] : it.form === 'lin' ? ['k', 'c'] : ['v']);
const values = (it) => (it.form === 'pt' ? it.answer : it.form === 'line' ? [it.answer.m, it.answer.b] : it.form === 'lin' ? [it.answer.k, it.answer.c] : [it.answer]);

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
