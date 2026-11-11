// STUDENT-1: every unit has its own colour and emblem, on the path and on every screen of the unit, and two calm
// drawings from its topic beside its path (hidden on the smallest phones so the path is not crowded).
import { test, expect } from '@playwright/test';
import { open, student, livedIn, answer, proceedToNext, expectNoSidewaysScroll } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the unit identity is checked on the two phones'); });

const bg = (loc) => loc.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));

for (const grade of ['7', '8']) {
  test(`grade ${grade}: each unit's banner has its own colour and its emblem, and its drawings sit beside the path`, async ({ page }, info) => {
    await open(page, '#/', livedIn(grade));
    const heads = page.locator('.unit .unit-head');
    await expect(heads.first()).toBeVisible();
    const n = await heads.count();
    expect(n, 'the grade has several units').toBeGreaterThan(3);
    const colours = await bg(heads);
    // a unit's colour is never its neighbour's (content.test.js checks the same on the content). There are five colour
    // families: grade 7's five units have one each, and grade 8, six units since the curriculum lane added ratio and
    // pct, uses one twice, never side by side (pct and sys are both petrol).
    for (let i = 1; i < n; i += 1) expect(colours[i], `banners ${i} and ${i + 1}: ${colours.join(' | ')}`).not.toBe(colours[i - 1]);
    expect(new Set(colours).size, `banner colours: ${colours.join(' | ')}`).toBe(Math.min(n, 5));
    for (let i = 0; i < n; i += 1) await expect(heads.nth(i).locator('.emblem svg'), `banner ${i + 1} has its emblem`).toHaveCount(1);
    // the emblem is decoration: the banner's name is the unit's name
    await expect(heads.first().locator('.emblem')).toHaveAttribute('aria-hidden', 'true');

    const units = page.locator('section.unit');
    const small = info.project.name === 'phone-small';
    for (let i = 0; i < n; i += 1) {
      const art = units.nth(i).locator('.path-art');
      await expect(art, `unit ${i + 1}: two drawings beside the path`).toHaveCount(2);
      await expect(art.locator('svg')).toHaveCount(2);
      for (let k = 0; k < 2; k += 1) {
        if (small) await expect(art.nth(k), 'hidden on a 320px phone').toBeHidden();
        else {
          await expect(art.nth(k)).toHaveAttribute('aria-hidden', 'true');
          expect(await art.nth(k).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
        }
      }
    }
    if (!small) {
      // a drawing never covers a stop: every stop's centre is still the stop itself
      const covered = await page.locator('.path .node').evaluateAll((nodes) => nodes.filter((el) => {
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(hit && (el === hit || el.contains(hit)));
      }).length);
      expect(covered, 'stops covered by something').toBe(0);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoSidewaysScroll(page);
  });
}

test('the unit\'s colour and emblem follow it to its guide, its stair page and the topics list', async ({ page }) => {
  await open(page, '#/', livedIn('7'));
  const pathColour = await page.locator('section.unit.ch-violet .unit-head').evaluate((el) => getComputedStyle(el).backgroundColor);

  await open(page, '#/topic/eq', livedIn('7'));
  const guide = page.locator('.guide-banner');
  await expect(guide.locator('.emblem svg')).toHaveCount(1);
  expect(await guide.evaluate((el) => getComputedStyle(el).backgroundColor), 'the guide banner is the unit\'s colour').toBe(pathColour);
  await expectNoSidewaysScroll(page);

  await open(page, '#/learn/eq/1', livedIn('7'));
  const head = page.locator('.journey-head');
  await expect(head.locator('.emblem svg')).toHaveCount(1);
  const top = await head.evaluate((el) => { const s = getComputedStyle(el); return { w: s.borderTopWidth, c: s.borderTopColor }; });
  expect(top).toEqual({ w: '6px', c: pathColour });
  await expectNoSidewaysScroll(page);

  await open(page, '#/topics', livedIn('7'));
  const cards = page.locator('.section-card');
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  for (let i = 0; i < count; i += 1) await expect(cards.nth(i).locator('.emblem svg')).toHaveCount(1);
  await expectNoSidewaysScroll(page);
});

test('a finished unit: the trophy sits in a ring of the unit\'s colour', async ({ page }) => {
  // every stair of the coordinates unit done, its review not yet passed: passing it finishes the unit
  await open(page, '#/lesson/coord/5?kind=review', student('7', { path: { coord: { parts: {}, reviews: 0, jumped: 5 } } }));
  for (let k = 0; k < 16 && !(await page.locator('.done-screen').count()); k += 1) await proceedToNext(page, await answer(page, true));
  const trophy = page.locator('.done-screen .done-trophy');
  await expect(trophy).toBeVisible();
  const ring = await trophy.evaluate((el) => getComputedStyle(el).boxShadow);
  const unit = await page.locator('.done-screen').evaluate((el) => { const p = document.createElement('i'); p.style.color = 'var(--c)'; el.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
  expect(ring, 'the ring is the unit\'s colour').toContain(unit);
  expect(unit).not.toBe('rgb(26, 92, 245)');
});
