// Brackets in Hebrew hug the words they hold, in Chromium too. With tabular figures set on the whole page (tokens.css,
// body), Rubik's wide tabular brackets stood apart from their words in every Hebrew line: Exam Rescue's topics read
// "פונקציה קווית ( כל הנושא )" and its last button "לבניית התוכנית ( 12 מדרגות )", the brackets seeming to face out
// (e2e/bidi.js says why). Here, on a 360 px phone, in light and dark: the brackets of the found topics and of that
// button are read from the screen's pixels (facing in, Rubik's own, close to the words), and the page has no bracket in
// right-to-left text set with tabular figures. The first test plants the fault on the app's own page, so both checks
// are shown to find it.
import { test, expect } from '@playwright/test';
import { NOW, open, student } from './helpers.js';
import { rtlBracketsWithTabularFigures, expectNoTabularBrackets, bracketShapes, expectBracketsFaceIn } from './bidi.js';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'Chromium\'s drawing, on one phone'); });
// 360 px wide, as the phone the fault was seen on; two device pixels per CSS pixel, so a 16 px bracket is 32 pixels tall
test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });

const LABEL = 'יחס וקנה מידה (כל הנושא)';

test('the checks find brackets set with tabular figures: a Hebrew label, planted on the app\'s page', async ({ page }) => {
  await open(page, '#/');
  await page.evaluate((text) => {
    for (const [id, dir, words, style] of [
      ['planted-tabular', 'rtl', text, 'font-variant-numeric: tabular-nums'], ['planted-plain', 'rtl', text, 'font-variant-numeric: normal'],
      ['planted-ltr', 'ltr', 'f(x) = (2, 3)', 'font-variant-numeric: normal'],
    ]) {
      const p = document.createElement('p');
      p.id = id; p.dir = dir; p.textContent = words;
      p.setAttribute('style', `${style}; font-size: 16px; margin: 8px; background: #fff; color: #000`);
      document.body.prepend(p);
    }
  }, LABEL);
  await page.evaluate(() => document.fonts.ready);
  const found = await rtlBracketsWithTabularFigures(page);
  expect(found, 'the planted paragraph is found, and only it').toEqual([{ text: LABEL, where: 'p#planted-tabular' }]);
  // drawn with tabular figures: Rubik's 0.6 em tabular brackets, each far from the words it holds ("( כל הנושא )")
  const tabular = await bracketShapes(page.locator('#planted-tabular'));
  expect(tabular.map((s) => [s.char, s.inner]), 'in a Hebrew line the words lie left of "(" and right of ")"').toEqual([['(', 'left'], [')', 'right']]);
  for (const s of tabular) {
    expect(s.advance, 'the tabular bracket\'s width').toBeGreaterThan(0.55);
    expect(s.gapIn, 'the blank between the bracket and its words').toBeGreaterThan(0.15);
  }
  // without them, and in left-to-right text, the brackets pass
  await expectBracketsFaceIn(page.locator('#planted-plain'), 'the same label without tabular figures');
  await expectBracketsFaceIn(page.locator('#planted-ltr'), 'a left-to-right line');
});

for (const scheme of ['light', 'dark']) {
  test(`Exam Rescue: the found topics and the plan button, brackets facing in (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, '#/rescue', student('7'));
    const tomorrow = new Date(NOW); tomorrow.setDate(tomorrow.getDate() + 1);
    await page.locator('#exam-date').fill(tomorrow.toLocaleDateString('en-CA'));
    await page.getByRole('button', { name: /^המשך/ }).click();
    await page.getByRole('button', { name: 'להדביק או לכתוב את ההודעה' }).click();
    await page.getByRole('textbox', { name: 'ההודעה מהמורה או רשימת הנושאים' }).fill('המבחן מחר על משוואות ועל מספרים מכוונים.');
    await page.getByRole('button', { name: 'מה יש במבחן?' }).click();
    await expect(page.locator('.material-found-line')).toBeVisible();
    // every topic found, and those folded under "עוד נושאים"
    await page.getByRole('button', { name: 'עוד נושאים' }).click();
    const topics = page.locator('.rescue-topic .topic-row span');
    await expect(topics.filter({ hasText: 'משוואות (כל הנושא)' })).toHaveCount(1);
    await expect(topics.filter({ hasText: 'מספרים מכוונים (כל הנושא)' })).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    await expectNoTabularBrackets(page, 'the found topics');
    for (const name of ['משוואות (כל הנושא)', 'מספרים מכוונים (כל הנושא)', 'יחס וקנה מידה (כל הנושא)']) {
      const row = topics.filter({ hasText: name });
      if (await row.count()) await expectBracketsFaceIn(row.first(), name);
    }
    // on to the plan: its button carries the number of stairs in brackets
    await page.getByRole('button', { name: /^המשך/ }).click();
    await page.getByRole('button', { name: /^המשך/ }).click();
    const build = page.getByRole('button', { name: /^לבניית התוכנית \(\d+ מדרגות\)$/ });
    await expect(build).toBeVisible();
    await expectNoTabularBrackets(page, 'the last question');
    await expectBracketsFaceIn(build, 'the plan button');
  });
}
