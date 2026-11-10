// The floor under the grade (curriculum stage 1, CURRICULUM-3): the short floor check (/floor) and its three end
// screens, and multiplication facts practice (/facts).
import { test, expect } from '@playwright/test';
import { open, student, item, answer, proceed, saved, expectUsable, expectNoSidewaysScroll, leaveEndScreens } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the floor runs on both phones'); });
const small = () => test.info().project.name === 'phone-small';

/** Answer every question of the open check or lesson: `miss(it)` says which to answer wrong. Returns the items asked. */
async function playThrough(page, miss = () => false, endSel = '.check-done') {
  const asked = [];
  for (let k = 0; k < 20; k += 1) {
    if (await page.locator(endSel).count()) return asked;
    await expect.poll(() => item(page)).toBeTruthy();
    const it = await item(page);
    asked.push(it);
    await answer(page, !miss(it));
    await proceed(page);
    await expect.poll(async () => (await page.locator(`${endSel}, .done-screen`).count()) > 0 || (await item(page))?.key !== it.key || (await page.locator('.redo-note').count()) > 0).toBe(true);
  }
  throw new Error('the check did not end');
}

/** The end screen is calm and usable at this size: its title, every button at least 44px high, no sideways scroll. */
async function endUsable(page, title, buttons) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expectNoSidewaysScroll(page);
  for (const name of buttons) {
    const b = page.getByRole('button', { name, exact: true });
    await b.scrollIntoViewIfNeeded();
    await expectUsable(page, b, name);
    expect((await b.boundingBox()).height, `${name} is a 44px target`).toBeGreaterThanOrEqual(44);
  }
}

const shots = '/tmp/claude-0/-home-user-mathai/57543833-d78c-5819-be1d-0302cd9d61ed/scratchpad/lanes/curriculum/shots';
const shot = (page, name) => page.screenshot({ path: `${shots}/floor-${name}-${test.info().project.name}.png`, fullPage: true });

test('the floor check: 6 questions, a missed fractions question puts the unit on the map and leads to its stair', async ({ page }) => {
  await open(page, '#/floor', student('7'));
  const asked = await playThrough(page, (it) => it.topic === 'frac' && it.level === 2);
  expect(asked).toHaveLength(6);
  expect(asked.map((it) => `${it.topic}:${it.level}`).sort()).toEqual(['facts:0', 'facts:0', 'frac:1', 'frac:2', 'frac:3', 'frac:4']);
  await endUsable(page, 'בדיקת היסודות הסתיימה', ['ליסודות', 'חזרה למפה']);
  await expect(page.locator('.check-done .lead').first()).toHaveText('כדאי לחזק: השוואת שברים ועשרוניים. הוספנו את "שברים ועשרוניים" למפה, בראש הדרך.');
  await expect(page.getByLabel('5 נכונות מתוך 6')).toBeVisible();
  await shot(page, 'end-missed');
  const st = await saved(page);
  expect(st.learn.floor).toMatchObject({ on: true, results: { 'frac:2': { asked: 1, right: 0 } }, facts: { asked: 2, right: 2 } });
  expect(st.days['2026-11-05']).toMatchObject({ lessons: 1 });
  // the button goes to the first stair missed
  await page.getByRole('button', { name: 'ליסודות', exact: true }).click();
  await expect(page).toHaveURL(/#\/learn\/frac\/2$/);
  await expect(page.locator('.journey')).toBeVisible();
});

test('the floor check: nothing missed says so and goes back to the map', async ({ page }) => {
  await open(page, '#/floor', student('7'));
  expect(await playThrough(page)).toHaveLength(6);
  await endUsable(page, 'היסודות במקום', ['חזרה למפה']);
  await expect(page.locator('.check-done .lead')).toHaveText('שברים ולוח הכפל עובדים לכם. ממשיכים מאיפה שהייתם.');
  await expect(page.getByRole('button', { name: 'ליסודות' })).toHaveCount(0);
  await shot(page, 'end-none');
  expect((await saved(page)).learn.floor).toMatchObject({ on: false });
  await page.getByRole('button', { name: 'חזרה למפה', exact: true }).click();
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.unit-title').first()).toHaveText('מספרים מכוונים'); // the floor stays off the map
});

test('the floor check: only the facts missed offers multiplication facts practice', async ({ page }) => {
  await open(page, '#/floor', student('7'));
  expect(await playThrough(page, (it) => it.topic === 'facts')).toHaveLength(6);
  await endUsable(page, 'בדיקת היסודות הסתיימה', ['לתרגול לוח הכפל', 'חזרה למפה']);
  await expect(page.locator('.check-done .lead')).toHaveText('לוח הכפל הוא בסיס לשברים. תרגול קצר עוזר לכל השאר.');
  await shot(page, 'end-facts');
  expect((await saved(page)).learn.floor).toMatchObject({ on: false, facts: { asked: 2, right: 0 } });
  await page.getByRole('button', { name: 'לתרגול לוח הכפל', exact: true }).click();
  await expect(page).toHaveURL(/#\/facts$/);
  await expect.poll(async () => (await item(page))?.topic).toBe('facts');
});

test('multiplication facts: 8 questions, and the day counts one lesson', async ({ page }) => {
  test.skip(small(), 'the lesson screen itself is covered by layout.spec at both sizes');
  await open(page, '#/facts', student('7'));
  const first = await item(page);
  expect(first).toMatchObject({ topic: 'facts', level: 0, form: 'num' });
  await expect(page.locator('#qtext')).toHaveText('חשבו:');
  const asked = await playThrough(page, () => false, '.done-screen');
  expect(asked).toHaveLength(8);
  asked.forEach((it) => expect(it.key).toMatch(/^facts:[3-9]:[3-9]:(mul|div)$/));
  await expect(page.locator('.done-screen h1').first()).toBeVisible();
  const st = await saved(page);
  expect(st.days['2026-11-05']).toMatchObject({ lessons: 1, q: 8, ok: 8 });
  expect(st.learn.skills).toEqual({});
  expect(st.path).toEqual({});
  await leaveEndScreens(page);
  await expect(page.locator('.unit').first()).toBeVisible();
});
