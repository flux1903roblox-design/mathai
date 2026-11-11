// The challenge track (CURRICULUM-6): a task solved end to end on a phone, a wrong first try then the right one, a proof
// ordered with the buttons from the keyboard alone, a counterexample typed into its slots, and the end screen's XP. A
// challenge counts for the day like a lesson and never touches mastery.
import { test, expect } from '@playwright/test';
import { open, student, saved, expectNoSidewaysScroll } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the challenge screen is checked on the two phones'); });

const at = '2026-11-04T10:00:00.000Z';
const mastered = { attempts: Array.from({ length: 5 }, () => ({ at, ok: true, independent: true, purpose: 'mastery' })), mastered: { at, box: 0, due: '2026-11-08T10:00:00.000Z' } };
/** A ח׳ student who has mastered pct:2 (pct:c1 follows it), saved by this version (v4: the learning model kept as it is). */
const pctStudent = () => ({
  ...student('8', {
    path: { pct: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered', 2: 'mastered' } } },
    learn: { skills: { 'pct:1': mastered, 'pct:2': mastered }, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {} },
  }),
  version: 4,
});
const go = (page, name) => page.locator('.ch-foot .ch-go', { hasText: name });
const KEY = { '.': 'נקודה עשרונית' };
const type = async (page, v) => { for (const ch of String(v)) await page.getByRole('button', { name: KEY[ch] || ch, exact: true }).click(); };

test('pct:c1, from a fixture with pct:2 mastered: a wrong first try, the right one, every part, and the XP at the end', async ({ page }, info) => {
  await open(page, '#/challenge/pct:c1', pctStudent());
  await expect(page.locator('.ch-title')).toHaveText('שתי דרכים לשלם עמלה');
  await expect(page.locator('.ch-count')).toHaveText('חלק 1 מתוך 4');
  // the story: on a tall phone pinned above the part, on a short one behind "לסיפור"
  if (info.project.name === 'phone-small') {
    const fold = page.getByRole('button', { name: 'לסיפור' });
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.ch-story')).toHaveCount(0);
    await fold.click();
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.locator('.ch-story')).toContainText('מסלול ב');
  await expectNoSidewaysScroll(page);

  // part 1: 7 is wrong, a second try is offered; 7.5 is right
  await type(page, '7');
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
  await type(page, '7.5'); // the struck answer is replaced by the next key
  await expect(page.locator('#ch-slot-v')).toHaveValue('7.5');
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();

  // part 2: the amount where both ways cost the same
  await expect(page.locator('.ch-count')).toHaveText('חלק 2 מתוך 4');
  await type(page, '400');
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();

  // part 3: a choice
  await page.getByRole('radio', { name: /מסלול ב/ }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();

  // part 4: in the student's own words, then the self-check; the words are never saved
  await page.locator('.ch-explain').fill('מי שקונה בפחות מ־400 משלם פחות במסלול א.');
  await go(page, 'סיימתי').click();
  await expect(page.getByRole('heading', { name: 'בדקו את התשובה שלכם' })).toBeVisible();
  await expect(page.locator('.ch-rubric input[type="checkbox"]')).toHaveCount(3);
  await expectNoSidewaysScroll(page);
  await go(page, 'לסיום').click();

  // the end: the lesson-complete words, and 20 + 5 × 2 parts right first time
  await expect(page.getByRole('heading', { name: 'אתגר הושלם. זה לא היה פשוט, והצלחתם.' })).toBeVisible();
  await expect(page.locator('.ch-done .stat-value')).toHaveText('+30');
  await expectNoSidewaysScroll(page);
  const st = await saved(page);
  expect(st.days['2026-11-05']).toMatchObject({ lessons: 1, xp: 30 });
  expect(st.learn.challenges['pct:c1']).toMatchObject({ firstTry: 2, parts: 3 });
  expect(st.learn.skills['pct:2']).toEqual(mastered); // no evidence, no check
  expect(JSON.stringify(st)).not.toContain('מי שקונה בפחות'); // the explanation stayed on the screen
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(page).toHaveURL(/#\/learn\/pct\/2$/);
});

test('angles:c1: the proof put in order with the move buttons from the keyboard alone', async ({ page }) => {
  await open(page, '#/challenge/angles:c1', student('8'));
  await expect(page.locator('.ch-count')).toHaveText('חלק 1 מתוך 2');
  const ids = () => page.locator('.ch-order .ch-step-text').evaluateAll((els) => els.map((e) => Number(e.id.replace('ch-step-', ''))));
  const start = await ids();
  expect(start).not.toEqual([0, 1, 2, 3, 4]); // never shown already in order
  // every move button is a full 44px target with its name
  for (const b of await page.getByRole('button', { name: 'הזיזו למעלה' }).all()) {
    const box = await b.boundingBox();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  // put step k at place k: focus its "up" button once, then Enter; the focus stays on the moved step
  for (let k = 0; k < 5; k += 1) {
    let order = await ids();
    let from = order.indexOf(k);
    if (from === k) continue;
    await page.locator(`.ch-move[aria-describedby="ch-step-${k}"][aria-label="הזיזו למעלה"]`).focus();
    while (from > k) {
      await page.keyboard.press('Enter');
      order = await ids();
      expect(order.indexOf(k)).toBe(from - 1);
      from -= 1;
      if (from > 0) await expect(page.locator(`.ch-move[aria-describedby="ch-step-${k}"][aria-label="הזיזו למעלה"]`)).toBeFocused();
      else await expect(page.locator(`.ch-move[aria-describedby="ch-step-${k}"][aria-label="הזיזו למטה"]`)).toBeFocused();
    }
  }
  expect(await ids()).toEqual([0, 1, 2, 3, 4]);
  await go(page, 'בדיקה').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  // the reasons of the two equal angles
  for (let r = 0; r < 2; r += 1) {
    await page.getByRole('radio', { name: 'זוויות מתחלפות בין מקבילים' }).click();
    await go(page, 'בדיקה').click();
    await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
    await go(page, 'המשך').click();
  }
  await expect(page.locator('.ch-count')).toHaveText('חלק 2 מתוך 2');
  await type(page, '70');
  await go(page, 'בדיקה').click();
  await go(page, 'לסיום').click();
  await expect(page.locator('.ch-done .stat-value')).toHaveText('+30');
  await expectNoSidewaysScroll(page);
});

test('frac:c1: "sometimes", then the counterexample 3, 2, 1 typed into its slots is accepted', async ({ page }) => {
  await open(page, '#/challenge/frac:c1', student('7'));
  await expect(page.locator('.ch-claim')).toContainText('השבר גדל');
  await page.getByRole('radio', { name: 'לפעמים' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  await expect(page.getByRole('heading', { name: 'תנו דוגמה' })).toBeVisible();
  // the keypad types into the active slot, and its "next" key moves on: numerator, denominator, what is added
  await type(page, '3');
  await page.getByRole('button', { name: 'לשדה הבא' }).click();
  await type(page, '2');
  await page.getByRole('button', { name: 'לשדה הבא' }).click();
  await type(page, '1');
  await expect(page.locator('#ch-slot-a')).toHaveValue('3');
  await expect(page.locator('#ch-slot-b')).toHaveValue('2');
  await expect(page.locator('#ch-slot-k')).toHaveValue('1');
  await expectNoSidewaysScroll(page);
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  await page.getByRole('radio', { name: 'לשברים חיוביים קטנים מ־1' }).click();
  await go(page, 'בדיקה').click();
  await go(page, 'לסיום').click();
  await expect(page.locator('.ch-done .stat-value')).toHaveText('+30');
});

test('a wrong counterexample gets a second try, then the part goes on with its hint', async ({ page }) => {
  await open(page, '#/challenge/frac:c1', student('7'));
  await page.getByRole('radio', { name: 'תמיד נכון' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
  await page.getByRole('radio', { name: 'אף פעם' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('הנה הפתרון. ממשיכים.');
  await expect(page.getByRole('radio', { name: 'לפעמים' })).toHaveAttribute('aria-checked', 'true');
  await go(page, 'המשך').click();
  for (const name of ['a', 'b', 'k']) await page.locator(`#ch-slot-${name}`).fill('1');
  await page.locator('#ch-slot-a').fill('1'); await page.locator('#ch-slot-b').fill('2');
  await go(page, 'בדיקה').click(); // 1/2 grows to 2/3: not a counterexample
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
  await expect(page.locator('.ch-foot')).toContainText('נסו שבר שהמונה שלו גדול מהמכנה.');
});
