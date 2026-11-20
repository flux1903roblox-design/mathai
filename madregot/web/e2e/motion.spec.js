// The ux-motion design pass (.claude/skills/ux-motion/SKILL.md), in the browser. The CSS side is held by
// scripts/check-motion.mjs (npm run lint:motion) and the moments' markup by the unit tests; here, what only a page can
// show: what a tap reaches while something celebrates. The tests run with reduced motion (playwright.config.js), as a
// student who asks for it sees the app: every moment is there at once and still.
import { test, expect } from '@playwright/test';
import { open, student, answer, proceedToNext, item, CLASS_PROFILE, livedIn, reportWeek } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'phone layouts'); });

/** Five right first tries in a row: the run the first combo moment celebrates (lib/lessonRules.js COMBO_MARKS). */
async function fiveInARow(page) {
  for (let n = 0; n < 5; n += 1) await proceedToNext(page, await answer(page, true));
}

const rect = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect().toJSON()), sel);
const overlaps = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

// the seed decides the sixth exercise: typed on the keypad (6) or a multiple choice (3)
for (const [seed, form] of [['6', 'num'], ['3', 'mc']]) test(`the combo moment is a pill over the bar: the next answer goes in while it shows (${form}; principles 16, 17)`, async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7'), seed);
  await fiveInARow(page);
  const pop = page.locator('.combo-pop');
  await expect(pop).toHaveText('5 ברצף!');
  await expect(pop).toHaveAttribute('role', 'status');
  // it sits in the bar's box (spilling at most into the gaps beside it): never over the question, the way out, a help
  // button or the keypad
  const [p] = await rect(page, '.combo-pop');
  const [meter] = await rect(page, '.lesson-meter');
  expect(p.left).toBeGreaterThanOrEqual(meter.left - 8.5);
  expect(p.right).toBeLessThanOrEqual(meter.right + 8.5);
  for (const sel of ['.lesson-q', '.lesson-x', '.lesson-top .tool', '.keypad .key', '.lesson .choice', '.check-btn']) {
    for (const r of await rect(page, sel)) expect(overlaps(p, r), `the pill covers ${sel}`).toBe(false);
  }
  // the first tap on the next exercise counts: it used to land on a layer over the lesson and only close it
  const it = await item(page);
  expect(it.form).toBe(form);
  if (it.form === 'mc') {
    const first = page.locator('.lesson .choice').first();
    const free = await first.evaluate((el) => { const r = el.getBoundingClientRect(); return !!document.querySelector('.combo-pop') && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.choice') === el; });
    expect(free, 'the choice is reachable while the pill shows').toBe(true);
    await first.click();
    await expect(first).toHaveAttribute('aria-checked', 'true');
  } else {
    const seven = page.getByRole('button', { name: '7', exact: true });
    const free = await seven.evaluate((el) => { const r = el.getBoundingClientRect(); return !!document.querySelector('.combo-pop') && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.key') === el; });
    expect(free, 'the keypad is reachable while the pill shows').toBe(true);
    await seven.click();
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.lesson .slot')].some((s) => s.value === '7'))).toBe(true);
  }
  // it leaves on its own, and a tap closes it sooner
  await expect(pop).toHaveCount(0, { timeout: 4000 });
});

test('a tap on the pill closes it, and the run stays counted beside the bar', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7'));
  await fiveInARow(page);
  await page.locator('.combo-pop').click();
  await expect(page.locator('.combo-pop')).toHaveCount(0);
  // the run is still counted beside the bar, once: the earlier counts have left (they used to pile up under reduced motion)
  await expect(page.locator('.lesson-combo .combo-chip')).toHaveText(/^5\s*ברצף$/);
});

test('in a quiet class the run is counted beside the bar, with no pill', async ({ page }) => {
  // a student of a class who never turned sound on: the classroom stays quiet (lib/sound.js classQuiet)
  await open(page, '#/lesson/signed/1', student('7', { profile: { ...CLASS_PROFILE } }));
  await fiveInARow(page);
  await expect(page.locator('.lesson-combo .combo-chip')).toHaveText(/^5\s*ברצף$/);
  await expect(page.locator('.combo-pop')).toHaveCount(0);
});

/** The enabled primary buttons on screen (Von Restorff: one standout action per view). */
const primaries = (page) => page.evaluate(() => [...document.querySelectorAll('.btn-primary:not(:disabled):not([aria-disabled="true"])')]
  .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[aria-hidden="true"]'); })
  .map((e) => e.textContent.trim()));

test('one standout action per screen: never two primary buttons in view (principle 15)', async ({ page }) => {
  test.setTimeout(120_000);
  for (const [route, state] of [['#/', livedIn()], ['#/quests', livedIn()], ['#/me', livedIn()], ['#/learn/coord/2', livedIn()], ['#/exams', livedIn()], ['#/rescue', livedIn()], ['#/report', reportWeek()], ['#/assistant', livedIn()], ['#/topic/signed', livedIn()], ['#/', null]]) {
    await open(page, route, state);
    expect((await primaries(page)).length, `${route}${state ? '' : ' (a first visit)'}: ${await primaries(page)}`).toBeLessThanOrEqual(1);
  }
  // the teacher's demo board, on each of its tabs
  await open(page, '#/');
  await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
  await page.getByRole('button', { name: 'לראות לוח לדוגמה, בלי הרשמה' }).click();
  await expect(page.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
  for (const tab of await page.getByRole('tab').all()) {
    await tab.click();
    expect((await primaries(page)).length, `teacher: ${await tab.textContent()}: ${await primaries(page)}`).toBeLessThanOrEqual(1);
  }
});

test('the small links and names reach a 44px tap: the welcome screen\'s legal links, the teacher\'s student names (principle 12)', async ({ page }) => {
  // a tap 4px above and below a link, and beside a short name, still lands on it (its invisible ::after)
  const lands = (loc, dx, dy) => loc.evaluate((el, [x, y]) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2 + x * (r.width / 2 + 6), r.top + r.height / 2 + y * (r.height / 2 + 4)); return el === hit || el.contains(hit); }, [dx, dy]);
  await open(page, '#/', null);
  const legal = page.locator('.hello-legal a').first();
  await legal.scrollIntoViewIfNeeded();
  expect(await lands(legal, 0, -1)).toBe(true);
  expect(await lands(legal, 0, 1)).toBe(true);
  await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
  await page.getByRole('button', { name: 'לראות לוח לדוגמה, בלי הרשמה' }).click();
  await page.getByRole('tab', { name: 'תלמידים' }).click();
  const name = page.locator('.t-table .link-btn').filter({ hasText: 'בן ת.' }).first();
  await expect(name).toBeVisible();
  await name.scrollIntoViewIfNeeded();
  expect(await lands(name, 1, 0)).toBe(true);
  expect(await lands(name, -1, 0)).toBe(true);
});
