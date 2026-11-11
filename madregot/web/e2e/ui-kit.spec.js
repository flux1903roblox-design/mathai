// The shared UI pieces on this lane's screens (STUDENT-15): Segmented (Settings) and Choices (the wardrobe) are Base UI
// radio groups, one Tab stop each, whose arrow keys follow Hebrew reading order because App.jsx sets the direction once
// (B1); the toasts' region is called "הודעות" and the toasts take the app's tokens in both themes (SO1, SO2).
// The clock is fixed on Thursday 5 November 2026 (helpers.js NOW).
import { test, expect } from '@playwright/test';
import { open, student, saved } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(info.project.name !== 'phone', 'keyboard and toasts, on the phone'); });

/** Whether the focused element is inside `locator`. */
const focusInside = (locator) => locator.evaluate((el) => el.contains(document.activeElement));

test('Settings › מראה is one Tab stop; ArrowLeft goes to the next option on the left and chooses it, ArrowRight goes back', async ({ page }) => {
  await open(page, '#/settings', student('7'));
  const group = page.getByRole('radiogroup', { name: 'מראה' });
  const radios = group.getByRole('radio');
  await expect(radios).toHaveText(['כמו במכשיר', 'בהיר', 'כהה']);
  // right to left: each next option sits to the left of the one before
  const xs = await radios.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  expect(xs[0]).toBeGreaterThan(xs[1]);
  expect(xs[1]).toBeGreaterThan(xs[2]);
  // one Tab stop: only the chosen option is in the tab order
  expect(await radios.evaluateAll((els) => els.map((e) => e.tabIndex))).toEqual([0, -1, -1]);
  const system = group.getByRole('radio', { name: 'כמו במכשיר' });
  await system.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await focusInside(group)).toBe(false);
  await page.keyboard.press('Tab');
  await expect(system).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await focusInside(group)).toBe(false);
  // the arrows move and choose, in reading order
  await system.focus();
  await page.keyboard.press('ArrowLeft');
  const light = group.getByRole('radio', { name: 'בהיר' });
  await expect(light).toBeFocused();
  await expect(light).toHaveAttribute('aria-checked', 'true');
  await expect(light).toHaveClass(/\bseg\b.*\bon\b|\bon\b.*\bseg\b/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect((await saved(page)).prefs.theme).toBe('light');
  await page.keyboard.press('ArrowLeft');
  await expect(group.getByRole('radio', { name: 'כהה' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('ArrowRight');
  await expect(light).toBeFocused();
  await expect(light).toHaveAttribute('aria-checked', 'true');
  // the chosen option is now the group's Tab stop
  expect(await radios.evaluateAll((els) => els.map((e) => e.tabIndex))).toEqual([-1, 0, -1]);
  // every option is a 44px target
  for (const r of await radios.all()) expect((await r.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test('Settings › צלילים: two options on the same Segmented, chosen by a tap or by Space', async ({ page }) => {
  await open(page, '#/settings', student('7', { sound: true }));
  const group = page.getByRole('radiogroup', { name: 'צלילים' });
  await expect(group.getByRole('radio', { name: 'פועלים' })).toHaveAttribute('aria-checked', 'true');
  await group.getByRole('radio', { name: 'כבויים' }).click();
  await expect(group.getByRole('radio', { name: 'כבויים' })).toHaveAttribute('aria-checked', 'true');
  expect((await saved(page)).sound).toBe(false);
  await group.getByRole('radio', { name: 'כבויים' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(group.getByRole('radio', { name: 'פועלים' })).toHaveAttribute('aria-checked', 'true');
  expect((await saved(page)).sound).toBe(true);
});

test('the wardrobe: each group is one Tab stop, and ArrowLeft moves to the next card on the left', async ({ page }) => {
  const done = (levels) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) });
  await open(page, '#/me/madi', student('7', { path: { angles: done([1, 2, 3]), stats: done([1, 2, 3, 4, 5, 6, 7, 8]) }, look: { color: 'sky', head: null, face: null, neck: null, body: null, earned: ['petrol'], seen: ['petrol', 'fuchsia'] } }));
  const colours = page.getByRole('radiogroup', { name: 'צבע' });
  const head = page.getByRole('radiogroup', { name: 'על הראש' });
  const blue = colours.getByRole('radio', { name: 'כחול', exact: true });
  await expect(colours.getByRole('radio')).toHaveCount(6);
  // only the chosen colour is in the tab order, locked ones included
  const stops = await colours.getByRole('radio').evaluateAll((els) => els.filter((e) => e.tabIndex === 0).length);
  expect(stops).toBe(1);
  await blue.focus();
  await page.keyboard.press('Tab');
  // the next Tab stop is the next group's chosen card ("בלי"), not another colour
  expect(await focusInside(colours)).toBe(false);
  await expect(head.getByRole('radio', { name: /^בלי/ })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(blue).toBeFocused();
  // right to left: ArrowLeft reaches the next card, which sits to the left (a locked one is focused, never chosen)
  await page.keyboard.press('ArrowLeft');
  const gold = colours.getByRole('radio', { name: /^זהב/ });
  await expect(gold).toBeFocused();
  expect((await gold.boundingBox()).x).toBeLessThan((await blue.boundingBox()).x);
  await expect(gold).toHaveAttribute('aria-disabled', 'true');
  await expect(blue).toHaveAttribute('aria-checked', 'true');
  expect((await saved(page)).look.color).toBe('sky');
});

test('toasts: a region called "הודעות", in the app\'s font, radius and colours, in light and in dark', async ({ page }) => {
  await open(page, '#/settings', student('7', { xp: 40, days: { '2026-11-04': { lessons: 1, xp: 40, q: 8, ok: 7 } } }));
  await expect(page.getByRole('region', { name: 'הודעות' })).toHaveCount(1);
  const reset = async () => {
    await page.getByRole('button', { name: 'איפוס ההתקדמות' }).click();
    await page.getByRole('button', { name: 'כן, לאפס' }).click();
    const t = page.locator('[data-sonner-toast]').filter({ hasText: 'ההתקדמות אופסה' });
    await expect(t).toBeVisible();
    return t;
  };
  const look = (t) => t.evaluate((el) => {
    const cs = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    return { radius: cs.borderTopLeftRadius, font: cs.fontFamily, bg: cs.backgroundColor, ink: cs.color, surface: root.getPropertyValue('--surface').trim() };
  });
  const hex = (rgb) => `#${rgb.match(/\d+/g).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  let t = await reset();
  let l = await look(t);
  expect(l.radius).toBe('16px');
  expect(l.font).toMatch(/Rubik/);
  expect(hex(l.bg)).toBe(l.surface.toLowerCase());
  await page.screenshot({ path: test.info().outputPath('toast-light.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  t = await reset();
  l = await look(t);
  expect(hex(l.bg)).toBe(l.surface.toLowerCase());
  expect(hex(l.bg)).not.toBe('#ffffff');
  expect(l.radius).toBe('16px');
});
