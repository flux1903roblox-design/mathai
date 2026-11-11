// The programme page (/programme, CURRICULUM-1): unit by unit, what Madregot teaches of the Ministry's programme.
// The sentence and the rows are checked against the module that computes them (imported here, never typed), on both
// phones; it opens on a device with no profile; the ways in (the topics screen, the parents' area, the teacher's tools)
// lead to it. The child's path does not (PRODUCT2-41).
import { test, expect } from '@playwright/test';
import { open, student, livedIn, expectNoSidewaysScroll } from './helpers.js';
import { coverage, coverageSentence } from '../../shared/coverage.js';
import { PROGRAMME } from '../../shared/programme.js';
import { ALL_SKILLS } from '../src/learn/skills.ts';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the programme page runs on both phones'); });

const units = (grade) => PROGRAMME.units.filter((u) => u.grade === grade);
const sentence = (grade) => coverageSentence(grade, coverage(grade, ALL_SKILLS));
const STATE_WORD = { yes: 'יש', part: 'חלקי', no: 'עוד לא' };

for (const grade of ['7', '8']) {
  test(`grade ${grade}: the computed sentence, one row per unit, every state in words, nothing sideways`, async ({ page }) => {
    await open(page, `#/programme?grade=${grade}`);
    await expect(page.getByRole('heading', { level: 1, name: 'מה לומדים במדרגות' })).toBeVisible();
    await expect(page.locator('.prog-sub')).toHaveText(`לפי תוכנית הלימודים של משרד החינוך לשנת ${PROGRAMME.year}`);
    await expect(page.getByRole('radio', { name: grade === '7' ? 'כיתה ז׳' : 'כיתה ח׳' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.prog-cover')).toHaveText(sentence(grade));
    const rows = page.locator('ol.prog-units > li');
    await expect(rows).toHaveCount(units(grade).length);
    // every Ministry title is there once, and its state is a word (the same word the computation gives)
    const cov = coverage(grade, ALL_SKILLS);
    for (const u of cov.units) {
      const row = rows.filter({ has: page.getByRole('heading', { name: u.title, exact: true }) });
      await expect(row, u.id).toHaveCount(1);
      await expect(row.locator('.prog-chip'), u.id).toHaveText(`במדרגות: ${STATE_WORD[u.state]}`);
    }
    // the source of this grade, and the hours line
    await expect(page.getByRole('link', { name: /פריסת ההוראה של משרד החינוך/ })).toHaveAttribute('href', PROGRAMME.sources[grade]);
    await expect(page.getByText('השעות הן ההמלצה של המשרד; בכיתה זה יכול להשתנות.')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.locator('.prog-foot').scrollIntoViewIfNeeded();
    await expectNoSidewaysScroll(page);
  });
}

test('opens on a device with no profile: no welcome, the stairs as plain words, back to the start', async ({ page }) => {
  await open(page, '#/programme');
  await expect(page.locator('.prog-cover')).toHaveText(sentence('7'));
  await expect(page.locator('.wordmark')).toHaveCount(0);
  // the topic guides need a student profile: the stairs are named, but nothing links to a route that is not there
  await expect(page.locator('.prog-topic-name').first()).toBeVisible();
  await expect(page.locator('a.prog-topic-name')).toHaveCount(0);
  await expect(page.locator('a[href*="#/topic/"]')).toHaveCount(0);
  // the other grade, by the switch: the sentence and the address follow
  await page.getByRole('radio', { name: 'כיתה ח׳' }).click();
  await expect(page.locator('.prog-cover')).toHaveText(sentence('8'));
  await expect(page).toHaveURL(/#\/programme\?grade=8$/);
  await expect(page.locator('ol.prog-units > li')).toHaveCount(units('8').length);
  // opened directly, back goes to the start (a device with no profile meets the welcome there)
  await page.getByRole('button', { name: 'חזרה' }).click();
  await expect(page.locator('.wordmark')).toBeVisible();
});

test('a student reaches it from the topics, not from the path; the topic guides are links', async ({ page }) => {
  await open(page, '#/', livedIn('7'));
  // the end of the path is the child's: every topic and how far each is; the Ministry's programme is not on it (PRODUCT2-41)
  const topics = page.getByRole('link', { name: 'כל הנושאים והמצב בכל אחד' });
  await topics.scrollIntoViewIfNeeded();
  await expect(page.locator('.path-end a')).toHaveCount(1);
  await expect(page.locator('.learn')).not.toContainText('תוכנית משרד החינוך');
  await expectNoSidewaysScroll(page);
  await topics.click();
  await page.getByRole('link', { name: 'כל תוכנית הלימודים' }).click();
  await expect(page).toHaveURL(/#\/programme\?grade=7$/);
  await expect(page.locator('.prog-cover')).toHaveText(sentence('7'));
  // a student's device: each topic's guide is one link, and it opens
  const guide = page.locator('a.prog-topic-name', { hasText: 'מערכת צירים' }).first();
  await expect(guide).toHaveAttribute('href', '#/topic/coord');
  const box = await guide.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  // back returns to the topics
  await page.getByRole('button', { name: 'חזרה' }).click();
  await expect(page).toHaveURL(/#\/topics$/);
});

test('a grade 8 student lands on ח׳; the topics screen and the parents area lead here too', async ({ page }) => {
  await open(page, '#/programme', student('8'));
  await expect(page.getByRole('radio', { name: 'כיתה ח׳' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.prog-cover')).toHaveText(sentence('8'));
  await page.goto('./#/topics');
  await page.getByRole('link', { name: 'כל תוכנית הלימודים' }).click();
  await expect(page).toHaveURL(/#\/programme\?grade=8$/);
  await expect(page.locator('.prog-cover')).toHaveText(sentence('8'));
  await page.goto('./#/parents');
  await page.getByRole('link', { name: 'מה לומדים במדרגות, לפי תוכנית משרד החינוך' }).click();
  await expect(page).toHaveURL(/#\/programme$/);
  await expect(page.locator('.prog-cover')).toHaveText(sentence('8'));
});
