// A child's voice (PRODUCT2-41, the council's painful moment #3), on both phones: a mission's reason and a wrong guess
// show two short lines and "עוד" (a button with aria-expanded) for the rest; מדי stands beside every first question;
// Settings keeps the browser's storage and the support details in a section for adults; and flat inline maths in a
// sentence is set in the sentence's font. Pictures for the proof go to VOICE_SHOTS when it names a folder.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { open, student, livedIn, expectNoSidewaysScroll } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the phone sizes'); });

const shot = async (page, name) => {
  const dir = process.env.VOICE_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/s14-${name}-${test.info().project.name}.png` });
};
/** How many lines a box's text takes (its height over its line height). */
const lines = (loc) => loc.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));

test('a mission\'s reason is two short lines; "עוד" opens the rest and folds it again, by keyboard too', async ({ page }) => {
  await open(page, '#/quests', student('7'));
  const why = page.locator('.today-row .today-why').first();
  await expect(why).toBeVisible();
  await expect(why).not.toContainText('לפי תוכנית הלימודים');
  expect(await lines(why)).toBeLessThanOrEqual(2);
  const more = why.getByRole('button', { name: 'עוד' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expectNoSidewaysScroll(page);
  await shot(page, 'quests');
  await more.focus();
  await page.keyboard.press('Enter');
  const less = why.getByRole('button', { name: 'פחות' });
  await expect(less).toHaveAttribute('aria-expanded', 'true');
  await expect(why).toContainText('בבית הספר לומדים את זה');
  await expect(page).toHaveURL(/#\/quests$/); // the button is not the row's link
  await less.click();
  await expect(why.getByRole('button', { name: 'עוד' })).toHaveAttribute('aria-expanded', 'false');
});

test('a wrong guess gets two short lines and "עוד", not a paragraph', async ({ page }) => {
  await open(page, '#/learn/signed/2/A', student('7'));
  await expect(page.locator('.step-player')).toBeVisible();
  // through the stage to its first prediction
  for (let i = 0; i < 20; i += 1) {
    await expect.poll(() => page.evaluate(() => window.__madregotStep)).toBeTruthy();
    const st = await page.evaluate(() => window.__madregotStep);
    if (st.kind === 'predict' && st.wrongWhy) {
      const wrong = Number(Object.keys(st.wrongWhy)[0]);
      await page.locator('.ls-choice').nth(wrong).click();
      await page.locator('.lm-check').click();
      break;
    }
    if (st.kind === 'explore') {
      if (st.manip.kind === 'numberline') {
        const d = st.answer - st.manip.start;
        for (let k = 0; k < Math.abs(d); k += 1) await page.getByRole('button', { name: d > 0 ? 'הסמן ימינה' : 'הסמן שמאלה' }).first().click();
      }
      await page.locator('.lm-check').click();
    }
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    await page.locator('.sp-next').click();
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  const say = page.locator('.lm-actions.has-warm .bl-why-text .more-text');
  await expect(say).toBeVisible();
  expect(await lines(say)).toBeLessThanOrEqual(2);
  await expect(say.getByRole('button', { name: 'עוד' })).toHaveAttribute('aria-expanded', 'false');
  await expectNoSidewaysScroll(page);
  await shot(page, 'wrong-guess');
  await say.getByRole('button', { name: 'עוד' }).click();
  await expect(say.getByRole('button', { name: 'פחות' })).toHaveAttribute('aria-expanded', 'true');
  expect(await lines(say)).toBeGreaterThan(2);
  await shot(page, 'wrong-guess-open');
});

test('מדי stands beside every first question, and the question is next to him', async ({ page }) => {
  await open(page, '#/');
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  const check = async (name) => {
    const ask = page.locator('.ob-ask-madi');
    const madi = ask.locator('svg.mascot');
    await expect(madi).toBeVisible();
    const m = await madi.boundingBox(); const q = await ask.locator('.ob-bubble').boundingBox();
    expect(m.width).toBeLessThanOrEqual(64);
    expect(m.y + m.height > q.y && m.y < q.y + q.height, `${name}: מדי is beside the question`).toBe(true);
    expect(m.x >= q.x + q.width - 1 || m.x + m.width <= q.x + 1, `${name}: מדי does not cover the question`).toBe(true);
    await expectNoSidewaysScroll(page);
  };
  await check('name');
  await shot(page, 'onboarding-name');
  await page.fill('#w-name', 'נועה');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await check('grade');
  await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await check('know');
  await shot(page, 'onboarding-know');
  await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await check('goal');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await check('start');
});

test('Settings: the student\'s own settings first; saving, backup and support details in the section for adults', async ({ page }) => {
  await open(page, '#/settings', livedIn('7'));
  await expect(page.getByRole('heading', { name: 'הגדרות' })).toBeVisible();
  const adults = page.locator('section.set-adults');
  await expect(adults.getByRole('heading', { level: 2, name: 'להורים ולמבוגרים' })).toBeVisible();
  const top = (loc) => loc.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const at = await top(adults);
  for (const t of ['שמירה קבועה בדפדפן', 'מידע לתמיכה']) expect(await top(page.getByText(t).first()), t).toBeGreaterThan(at);
  for (const t of ['הפרטים שלי', 'מראה', 'צלילים']) expect(await top(page.getByRole('heading', { name: t })), t).toBeLessThan(at);
  await expect(adults.getByRole('heading', { level: 3, name: 'שמירת ההתקדמות' })).toBeVisible();
  await expect(adults.getByRole('button', { name: 'לשמור קובץ גיבוי' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await shot(page, 'settings-top');
  await adults.scrollIntoViewIfNeeded();
  await shot(page, 'settings-adults');
  // the storage banner's "מה עושים" still lands on the saving
  await page.goto('./#/settings#save');
  await expect(page.locator('#save-title')).toBeFocused();
});

test('flat inline maths in a sentence is in the sentence\'s font; a fraction keeps KaTeX', async ({ page }) => {
  await open(page, '#/topic/eq', student('7'));
  const flat = page.locator('.mt-ui .katex').first();
  await expect(flat).toBeVisible();
  const font = await flat.evaluate((el) => {
    const letter = el.querySelector('.mathnormal');
    return { box: getComputedStyle(el).fontFamily, letter: letter && getComputedStyle(letter).fontFamily, style: letter && getComputedStyle(letter).fontStyle };
  });
  expect(font.box).toMatch(/Rubik/);
  if (font.letter) { expect(font.letter).toMatch(/Rubik/); expect(font.style).toBe('normal'); }
  const frac = page.locator('.mt-inline:not(.mt-ui) .katex .mfrac').first();
  if (await frac.count()) expect(await frac.evaluate((el) => getComputedStyle(el.closest('.katex')).fontFamily)).toMatch(/KaTeX/);
});
