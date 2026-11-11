// The floor under the grade (curriculum stage 1, CURRICULUM-3): the short floor check (/floor) and its three end
// screens, and multiplication facts practice (/facts).
import { test, expect } from '@playwright/test';
import { open, student, item, answer, type, proceed, saved, expectUsable, expectNoSidewaysScroll, leaveEndScreens } from './helpers.js';

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

// Proof screenshots, only when FLOOR_SHOTS names a folder: the end screens whole (nothing on them is fixed), the other
// screens as the phone shows them.
const shot = async (page, name, fullPage = true) => {
  const dir = process.env.FLOOR_SHOTS; if (!dir) return;
  await page.waitForTimeout(600); // a screen that just opened has settled (the colour change from a dark end screen)
  await page.screenshot({ path: `${dir}/floor-${name}-${test.info().project.name}.png`, fullPage });
};

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
  // the lesson screen loads on its own (main's lazy screens): wait for its first question
  await expect.poll(() => item(page)).toBeTruthy();
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

// ---------------------------------------------------------------- where the floor shows (stage 9)

/** Onboarding as a student for whom everything is new (KNOW 0), up to the start step. */
async function onboardNew(page) {
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await page.fill('#w-name', 'נועה');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^הכול חדש לי/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click(); // daily goal: the default
}

/** Every target in a list is a 44px target, inside the screen, with no sideways scroll. */
async function targetsUsable(page, locators) {
  await expectNoSidewaysScroll(page);
  for (const [what, l] of locators) {
    await l.scrollIntoViewIfNeeded();
    await expectUsable(page, l, what);
    expect((await l.boundingBox()).height, `${what} is a 44px target`).toBeGreaterThanOrEqual(44);
  }
}

test('a student who finds everything new can check the basics: onboarding → the check → the map → Topics → hide', async ({ page }) => {
  await open(page, '#/');
  await onboardNew(page);
  // the start step: three ways in; the floor check is offered and not recommended
  const opts = page.locator('.ob-opt');
  await expect(opts).toHaveCount(3);
  const floorOpt = page.getByRole('radio', { name: /^בדיקת יסודות קצרה/ });
  await expect(floorOpt).toContainText('6 שאלות על שברים ולוח הכפל. אם צריך, נחזק אותם קודם.');
  await expect(floorOpt.locator('.ob-badge')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /^מתחילים מההתחלה/ })).toHaveAttribute('aria-checked', 'true');
  await floorOpt.click();
  await expect(floorOpt).toHaveAttribute('aria-checked', 'true');
  await targetsUsable(page, [['the floor option', floorOpt], ['the start button', page.getByRole('button', { name: 'לבדיקת היסודות', exact: true })]]);
  await shot(page, 'onboarding', false);
  await page.getByRole('button', { name: 'לבדיקת היסודות', exact: true }).click();
  await expect(page).toHaveURL(/#\/floor$/);

  // the check: 6 questions; the frac:3 question is answered 2/7 (tops and bottoms added: 1/3 + 1/4 = 2/7), never its answer
  const asked = [];
  for (let k = 0; k < 6; k += 1) {
    await expect.poll(() => item(page)).toBeTruthy();
    const it = await item(page);
    asked.push(`${it.topic}:${it.level}`);
    if (it.topic === 'frac' && it.level === 3) {
      await page.locator('#slot-v').click();
      await type(page, '2/7');
      await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
    } else await answer(page, true);
    await proceed(page);
    if (k < 5) await expect.poll(async () => (await item(page))?.key).not.toBe(it.key);
  }
  expect(asked.sort()).toEqual(['facts:0', 'facts:0', 'frac:1', 'frac:2', 'frac:3', 'frac:4']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('בדיקת היסודות הסתיימה');
  await expect(page.locator('.check-done .lead').first()).toContainText('כדאי לחזק: חיבור וחיסור שברים.');
  const st = await saved(page);
  expect(st.learn.floor).toMatchObject({ on: true, results: { 'frac:3': { asked: 1, right: 0 } } });
  expect(st.profile).toMatchObject({ know: 0 });
  await page.getByRole('button', { name: 'חזרה למפה', exact: true }).click();

  // the map: the fractions floor first, named יסודות and not numbered; the grade's units keep their numbers
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.unit-title').first()).toHaveText('שברים ועשרוניים');
  await expect(page.locator('.unit-label').first()).toHaveText(/^יסודות · /);
  await expect(page.locator('.unit-title').nth(1)).toHaveText('מספרים מכוונים');
  await expect(page.locator('.unit-label').nth(1)).toHaveText(/^יחידה 1 · /);
  await expectNoSidewaysScroll(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'map', false);

  // Topics: יסודות לחיזוק under the grade's units
  await page.getByRole('link', { name: 'כל הנושאים והמצב בכל אחד' }).click();
  const section = page.locator('.floor-section');
  await expect(section.getByRole('heading', { level: 2, name: 'יסודות לחיזוק' })).toBeVisible();
  await expect(section.locator('.section-card-title')).toHaveText('שברים ועשרוניים');
  await expect(section.locator('.section-card-label')).toHaveCount(0); // under the יסודות heading: no unit number
  await expect(section.locator('.qbar, [role="progressbar"]')).toHaveCount(0); // nothing done in it yet: no row of zeros
  await expect(section.getByRole('link', { name: /^בדיקה קצרה/ })).toHaveAttribute('href', '#/floor');
  await expect(section.getByRole('link', { name: /^לוח הכפל/ })).toHaveCount(0); // the facts were right
  const hide = section.getByRole('button', { name: 'להסתיר את היסודות מהמפה', exact: true });
  await targetsUsable(page, [['the unit button', section.getByRole('button', { name: 'התחלה: שברים ועשרוניים' })], ['the short check', section.getByRole('link', { name: /^בדיקה קצרה/ })], ['the hide button', hide]]);
  await section.scrollIntoViewIfNeeded();
  await shot(page, 'topics', false);
  await hide.click();
  await expect(hide).toHaveCount(0);
  const after = await saved(page);
  expect(after.learn.floor).toMatchObject({ on: false, results: { 'frac:3': { asked: 1, right: 0 } } }); // the evidence stays
  // still reachable from Topics, gone from the map
  await expect(section.locator('.section-card-title')).toHaveText('שברים ועשרוניים');
  await page.getByRole('button', { name: 'חזרה למפה' }).click();
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.unit-title').first()).toHaveText('מספרים מכוונים');
  await expect(page.locator('.unit-title').filter({ hasText: 'שברים ועשרוניים' })).toHaveCount(0);
});

test('Topics: after a missed multiplication fact, the facts row leads to practice; a stair begun shows its bar', async ({ page }) => {
  const floor = { at: '2026-11-05T09:00:00.000Z', on: false, results: { 'frac:1': { asked: 1, right: 1 } }, facts: { asked: 2, right: 1 } };
  const learn = { skills: { 'frac:1': { taught: { A: '2026-11-05T09:10:00.000Z' }, attempts: [] } }, miscon: {}, exam: null, missions: {}, events: [], floor, challenges: {} };
  await open(page, '#/topics', { ...student('7'), state: { ...student('7').state, learn }, version: 6 });
  const section = page.locator('.floor-section');
  const facts = section.getByRole('link', { name: /^לוח הכפל/ });
  await expect(facts).toContainText('לוח הכפל הוא בסיס לשברים. תרגול קצר כאן עוזר לכל השאר.');
  await expect(section.getByRole('button', { name: 'להסתיר את היסודות מהמפה' })).toHaveCount(0); // the unit is not on the map
  await expect(section.getByRole('progressbar')).toHaveCount(1); // a stage was done: the bar shows
  await expect(section.locator('.section-card-now')).toHaveText('עכשיו: שבר ושברים שווים');
  await targetsUsable(page, [['the facts row', facts]]);
  await section.scrollIntoViewIfNeeded();
  await shot(page, 'topics-facts', false);
  // the unit's own button opens the stair it is on, though the unit is not on the map
  await section.getByRole('button', { name: 'המשך: שברים ועשרוניים' }).click();
  await expect(page).toHaveURL(/#\/learn\/frac\/1$/);
  await page.goBack();
  await page.locator('.floor-section').getByRole('link', { name: /^לוח הכפל/ }).click();
  await expect(page).toHaveURL(/#\/facts$/);
  await expect.poll(async () => (await item(page))?.topic).toBe('facts');
});
