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
 * Open a route with a saved state (null: a first visit), a fixed clock and repeatable exercises.
 * madregot-debug exposes the current exercise as window.__madregotItem; madregot-seed fixes Math.random.
 */
export async function open(page, route, state = null, seed = '424242') {
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  await page.evaluate(([s, sd]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', sd);
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
  }, [state, seed]);
  await page.goto(`./${route}`);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
}

export const item = (page) => page.evaluate(() => window.__madregotItem);
export const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state);

const KEY_NAME = { '-': 'מינוס', '/': 'שבר', '.': 'נקודה עשרונית' };
/** Type a value on the app's own keypad. */
export async function type(page, value) {
  for (const ch of String(value)) await page.getByRole('button', { name: KEY_NAME[ch] || ch, exact: true }).click();
}

const slotNames = (it) => (it.form === 'pt' ? ['x', 'y'] : it.form === 'line' ? ['m', 'b'] : ['v']);
const values = (it) => (it.form === 'pt' ? it.answer : it.form === 'line' ? [it.answer.m, it.answer.b] : [it.answer]);

/** Answer the current exercise, right or wrong (a wrong choice that is still enabled). */
export async function answer(page, right) {
  const it = await item(page);
  if (it.form === 'mc') {
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
