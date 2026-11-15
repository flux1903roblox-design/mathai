// Touch targets (STUDENT-9 §1): on the student's main screens every button, link, radio and tab is at least 44×44,
// on the council's phone and the smallest. Links inside running text are exempt (WCAG 2.5.8): they sit in a <p> or a
// list item's text, or carry data-inline. Each screen's sizes are written to targets.json in the test's output, for the
// before/after table in qa-evidence/student/polish/.
import { test, expect } from '@playwright/test';
import { open, openOn, livedIn, student } from './helpers.js';
import { barLabelPairs } from './contrast.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'touch targets are a phone matter'); });

const MIN = 44;

/** Every visible target on the page with its size; text-run links are marked exempt. */
const measure = (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, a[href], summary, [role="radio"], [role="tab"]')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"], [inert]')) continue; // not shown (or only to screen readers)
    const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const inline = el.hasAttribute('data-inline') || !!el.closest('p, li > span');
    out.push({ name, cls: String(el.className || '').split(' ').filter(Boolean).slice(0, 2).join('.'), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, inline });
  }
  return out;
});

async function check(page, screen) {
  await page.evaluate(() => document.fonts.ready);
  const all = await measure(page);
  const info = test.info();
  await info.attach(`targets-${screen}.json`, { body: JSON.stringify({ screen, project: info.project.name, targets: all }, null, 1), contentType: 'application/json' });
  const small = all.filter((t) => !t.inline && (t.w < MIN - 0.5 || t.h < MIN - 0.5));
  expect(small, `${screen}: targets under ${MIN}×${MIN}`).toEqual([]);
  expect(all.filter((t) => !t.inline).length, `${screen}: targets were found`).toBeGreaterThan(2);
}

test('Learn', async ({ page }) => {
  await open(page, '#/', livedIn('7'));
  await expect(page.locator('.learn-top')).toBeVisible();
  await check(page, 'learn');
});

test('Topics', async ({ page }) => {
  await open(page, '#/topics', livedIn('7'));
  await expect(page.locator('.mm-tile').first()).toBeVisible();
  await check(page, 'topics');
});

// PRODUCT2-43: a unit's progress pill on Topics carries its count inside it. Dark ink over the saturated blue fill read
// at 3.4:1 ('3 מתוך 6 מדרגות' ran across the fill's edge). Over the fill the count turns white, so on the fill and on
// the track it reads at 4.5:1 or more, light and dark. Seeded as the council saw it: half of signed (3 of 6 stairs),
// the fill's edge under the count, and a unit just started (a short fill) and one not started (no fill).
test('Topics: the count in a unit\'s progress pill reads at 4.5:1 on the fill and on the track, light and dark', async ({ page }) => {
  const state = livedIn('7');
  state.state.path = { signed: { parts: {}, reviews: 0, jumped: 3 }, coord: { parts: { 1: 2 }, reviews: 0, jumped: 0 } };
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, '#/topics', state);
    await expect(page.locator('.section-card .qbar').first()).toBeVisible();
    const rows = await barLabelPairs(page, '.section-card .qbar');
    await test.info().attach(`pill-contrast-${scheme}.json`, { body: JSON.stringify(rows, null, 1), contentType: 'application/json' });
    // signed has seven stairs since signed:7 (CLASSROOM-5): three of them still put the fill's edge under the count
    expect(rows.find((r) => r.label === '3 מתוך 7 מדרגות')?.crosses, `${scheme}: the half-full pill has its fill's edge under the count`).toBe(true);
    const bad = rows.filter((r) => r.track < 4.5 || (r.fill != null && r.fill < 4.5));
    expect(bad, `${scheme}: counts under 4.5:1 on the track or the fill`).toEqual([]);
  }
});

test('Quests', async ({ page }) => {
  await open(page, '#/quests', livedIn('7'));
  await expect(page.locator('.page-hero-title')).toBeVisible();
  await check(page, 'quests');
});

test('Me', async ({ page }) => {
  await open(page, '#/me', livedIn('7'));
  await expect(page.locator('.profile-name')).toBeVisible();
  await check(page, 'me');
});

test('a lesson, with its tools', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7'));
  await expect(page.locator('#qtext')).toBeVisible();
  await expect(page.locator('.lesson .tool').first()).toBeVisible();
  await check(page, 'lesson');
});

test('a teaching step', async ({ page }) => {
  await open(page, '#/learn/signed/1/A', student('7'));
  await expect(page.locator('.step-player')).toBeVisible();
  await check(page, 'teach');
});

// SK-STUDENT-3: on every typed answer the maths keypad is the control tapped most; its keys (the space of a mixed number
// among them) and the drawing's zoom button are at least 44×44, on the council's lessons, on both phones. The question
// opened is one with a typed answer (a fixed seed whose first exercise is typed).
const typed = (it) => it && !['mc', 'manip'].includes(it.form);
for (const [name, route] of [['signed:4', '#/lesson/signed/4'], ['angles:1', '#/lesson/angles/1'], ['eq:1', '#/lesson/eq/1']]) {
  test(`a typed answer on ${name}: the keypad and the drawing's zoom`, async ({ page }) => {
    const it = await openOn(page, route, student('7'), typed);
    await expect(page.locator('.lesson .keypad')).toBeVisible();
    if (it.fig && it.fig.type !== 'table') await expect(page.locator('.fig-zoom')).toBeVisible();
    await check(page, `lesson-${name.replace(':', '-')}-typed`);
  });
}

test('the multiplication facts: the keypad', async ({ page }) => {
  await open(page, '#/facts', student('7'));
  await expect(page.locator('.lesson .keypad')).toBeVisible();
  await expect(page.getByRole('button', { name: 'רווח, בין השלם לשבר' })).toBeVisible();
  await check(page, 'facts');
});
