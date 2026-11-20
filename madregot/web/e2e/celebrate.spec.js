// Celebrations with life (PRODUCT2-38), with motion on and a live clock (a fixed clock freezes motion mid-way, so these
// tests set none: the days are counted back from the real today). The first teaching stage of a student who learned on
// the two school days before today reaches the daily goal (10 XP of 10), finishes a stage, brings מדי his first piece
// and makes 3 days in a row: the goal's moment, the stage's, the unlock and the 3-day milestone, one after another.
// Each has מדי jumping in with shapes flying out, the XP counting up and landing, and a button that works from the first
// frame (one tap or Enter goes on, mid-animation). Under reduced motion (every other spec) the same screens are still.
// CELEBRATE_SHOTS=<folder> saves screenshots mid-animation for a look (nothing is compared).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { student, saved, appReady, screenReady, playDiscover, DURABLE_DB } from './helpers.js';

test.use({ reducedMotion: 'no-preference' });
test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the moments on both phones'); });

/** A day's key in the browser's own calendar (the app's today()). */
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The `n` school days before today (Shabbat is passed over by the streak, so it is left out here too), each learned once. */
function learnedBefore(n) {
  const days = {}; const d = new Date();
  while (Object.keys(days).length < n) { d.setDate(d.getDate() - 1); if (d.getDay() !== 6) days[key(d)] = { lessons: 1, xp: 12, q: 8, ok: 7 }; }
  return days;
}

/** Open a route with a saved state, no fixed clock and repeatable exercises (helpers.js open, with the real time). */
async function openLive(page, route, state) {
  await page.goto('./');
  await page.evaluate(async ([s, db]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', '424242');
    localStorage.setItem('madregot', JSON.stringify(s));
    await new Promise((done) => { const r = indexedDB.deleteDatabase(db); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
  }, [state, DURABLE_DB]);
  await page.goto(`./${route}`);
  await page.reload();
  await appReady(page);
  await screenReady(page, route);
}

async function shot(page, info, name, ms) {
  const dir = process.env.CELEBRATE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  if (ms) await page.waitForTimeout(ms);
  await page.screenshot({ path: `${dir}/${info.project.name}-${name}.png` });
}

test('the goal, the stage, the unlock and the 3-day milestone come alive, count up, and go on with one tap', async ({ page }, info) => {
  test.setTimeout(90_000);
  await openLive(page, '#/learn/signed/1/A', student('7', { days: learnedBefore(2), goalXp: 10 }));
  await playDiscover(page);

  // the daily goal: מדי jumps in, the ring closes and shapes fly out; today's XP counts up and lands on 10
  const goal = page.locator('.goal-stage');
  await expect(goal).toBeVisible();
  await expect(goal.locator('.celebrate-burst .cb')).toHaveCount(12);
  await shot(page, info, 'goal-250ms', 250);
  await shot(page, info, 'goal-900ms', 650);
  await expect(goal.locator('.goal-xp .xp-count')).toHaveAttribute('data-done', 'true', { timeout: 5000 });
  await expect(goal.locator('.goal-xp .xp-count-n')).toHaveText('10');
  await expect(goal.locator('.goal-xp .visually-hidden')).toHaveText('10');
  await goal.getByRole('button', { name: 'המשך', exact: true }).click();

  // the stage: the XP in its gold pill starts from 0 and counts up to +10, then pops; the screen reader has +10 XP at once
  const stage = page.locator('.stage-done');
  await expect(stage).toBeVisible();
  const xp = stage.locator('.xp-pill .xp-count');
  await expect(xp.locator('.visually-hidden')).toHaveText('+10 XP');
  await expect(stage.locator('.celebrate .mascot')).toBeVisible();
  await expect(stage.locator('.celebrate-burst .cb')).toHaveCount(12);
  await shot(page, info, 'stage-300ms', 300);
  await shot(page, info, 'stage-800ms', 500);
  await expect(xp).toHaveAttribute('data-done', 'true', { timeout: 5000 });
  await expect(xp.locator('.xp-count-n')).toHaveText('+10');
  await expect(xp).toHaveClass(/xp-landed/);
  await shot(page, info, 'stage-landed', 200);
  await stage.getByRole('button', { name: 'לדוגמה הפתורה', exact: true }).click();

  // the first piece for מדי: he jumps in, the piece drops onto him and gold shapes fly as it lands
  const unlock = page.locator('.unlock-stage');
  await expect(unlock).toBeVisible();
  await expect(unlock.locator('.celebrate-burst .cb')).toHaveCount(12);
  await shot(page, info, 'unlock-500ms', 500);
  await shot(page, info, 'unlock-1200ms', 700);
  await unlock.getByRole('button', { name: 'אחר כך', exact: true }).click();

  // three days in a row, for the first time: the milestone's own moment, skipped with Enter while it still moves
  const ms = page.locator('.streak-milestone');
  await expect(ms).toBeVisible();
  await expect(ms).toHaveAttribute('data-milestone', '3');
  await expect(ms.getByRole('heading', { level: 1 })).toHaveText('3 ימים ברצף!');
  await expect(ms.locator('.milestone-medal b')).toHaveText('3');
  await shot(page, info, 'milestone3-300ms', 300);
  await shot(page, info, 'milestone3-1000ms', 700);
  const go = ms.getByRole('button', { name: 'המשך', exact: true });
  await expect(go).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/learn\/signed\/1\/B/);
  expect(Object.keys((await saved(page)).nudges.streakSeen)).toEqual(['3']);
});

for (const n of [7, 30]) {
  test(`the ${n}-day milestone: its number on the medal, one calm line, and one tap goes on at once`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await openLive(page, '#/learn/signed/1/A', student('7', { days: learnedBefore(n - 1), goalXp: 500 }));
    await playDiscover(page);
    await page.locator('.stage-done').getByRole('button', { name: 'למפה', exact: true }).click();
    // the first stage of all brings מדי a piece first (wardrobe.spec.js tests that moment)
    await expect(page.locator('.unlock-stage, .streak-milestone')).toBeVisible();
    if (await page.locator('.unlock-stage').count()) await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
    const ms = page.locator('.streak-milestone');
    await expect(ms).toBeVisible();
    await expect(ms.getByRole('heading', { level: 1 })).toHaveText(`${n} ימים ברצף!`);
    await expect(ms.locator('.milestone-line')).toHaveText(n === 7 ? 'שבעה ימים של תרגול. זה כבר הרגל.' : 'שלושים ימים של תרגול. איזו דרך עשיתם!');
    await shot(page, info, `milestone${n}-600ms`, 600);
    // one tap, while מדי is still moving
    await ms.getByRole('button', { name: 'המשך', exact: true }).click();
    await expect(page.locator('.learn-top')).toBeVisible();
    expect((await saved(page)).nudges.streakSeen[n]).toBeTruthy();
  });
}
