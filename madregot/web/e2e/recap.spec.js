// The Sunday recap (STUDENT-6, FOLLOWUP-38) on the two phones. Last week (Sunday 8 to Shabbat 14 November 2026) has three
// days with learning, a stair that passed its mastery check, a mistake fixed and a piece Madi earned; the clock is
// Sunday 15 November. The card shows on Learn; its sheet has the week's numbers, and they are /report's numbers for
// "השבוע שעבר" (one engine, learn/report.ts weekLocal); "לשלוח להורים" opens the parents' share sheet (PARENTS-2) with a
// WhatsApp link; closed once, the card does not come back; on a Wednesday, or after an empty week, there is none.
// Screenshots of the card and the sheet, light and dark, with RECAP_SHOTS=<folder> (qa-evidence/student/recap/).
// Synthetic data only.
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { student, appReady, screenReady, saved, expectNoSidewaysScroll, expectUsable, DURABLE_DB } from './helpers.js';
import { API, CORS } from './fakeServer.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the recap is checked on the two phones'); });

const WA = 'https://wa.me/?text=';
const SUNDAY = '2026-11-15T10:00:00';
const at = (day, hh = 15) => `${day}T${String(hh).padStart(2, '0')}:00:00.000Z`;
const ev = (t, e, extra = {}) => ({ t, e, ...extra });

/**
 * A ז׳ student whose last week had three days of learning (8, 10 and 12 November), a mastery check passed on signed:1,
 * a repair done, and the thermometer scarf earned on Thursday; the week before had two steps, so 8 steps is a new best.
 * Saved at the current version (6): no migration step runs.
 */
function recapStudent({ empty = false } = {}) {
  const days = empty ? { '2026-11-15': { lessons: 1, q: 6, secs: 240 } } : {
    '2026-11-03': { lessons: 2, q: 12, ok: 10, secs: 420, xp: 25 },
    '2026-11-08': { lessons: 1, q: 8, ok: 7, secs: 300, xp: 15 },
    '2026-11-10': { lessons: 2, stages: 1, mp: 1, q: 16, ok: 14, secs: 600, xp: 30 },
    '2026-11-12': { stages: 2, q: 4, ok: 4, secs: 120, xp: 10 },
  };
  const events = empty ? [] : [
    ev(at('2026-11-08'), 'lesson-done', { s: 'signed:1', p: 'practice', ok: true }),
    ev(at('2026-11-10', 14), 'check-done', { s: 'signed:1', p: 'mastery', ok: true }),
    ev(at('2026-11-10', 15), 'repair-done', { s: 'signed:1', m: 'minus-minus', ok: true }),
    ev(at('2026-11-12'), 'stage-A', { s: 'signed:2' }),
  ];
  return {
    ...student('7', {
      days, xp: 80,
      learn: {
        skills: empty ? {} : { 'signed:1': { attempts: [], mastered: { at: at('2026-11-10', 14), box: 0, due: '2026-11-24T00:00:00.000Z' } } },
        miscon: {}, exam: null, missions: {}, events, floor: null, challenges: {},
      },
      look: { color: 'sky', head: null, face: null, neck: null, body: null, earned: empty ? [] : ['thermo-scarf'], seen: empty ? [] : ['thermo-scarf'], earnedAt: empty ? {} : { 'thermo-scarf': '2026-11-12' } },
      // the app knows its server, so the recap's reach count (a beacon) can be seen
      ai: { mode: 'server', apiUrl: API, key: '', introSeen: true },
      // the backup question was already asked twice (DURABLE-5): it does not open over the card
      durable: { nudgeCount: 2 },
    }),
    version: 6,
  };
}

/** Every call to the fake API: the reach counts by name, anything else answered empty. */
async function fakeApi(page) {
  const counts = [];
  await page.route(`${API}/**`, (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (path === '/api/metrics') { counts.push(req.postData()); return route.fulfill({ status: 204, headers: CORS }); }
    if (path === '/api/ai/status') return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ paywall: false, tier: 'open', kinds: [], groups: { all: { left: 40, limit: 40 } }, aiReady: true }) });
    return route.fulfill({ status: 404, contentType: 'application/json', headers: CORS, body: '{"error":"not_found"}' });
  });
  return counts;
}

/** Open a route at a time of our choosing, with a saved state (helpers.open fixes Thursday 5 November). */
async function openAt(page, route, state, when) {
  await page.clock.setFixedTime(new Date(when));
  await page.goto('./');
  await page.evaluate(async ([s, db]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
    await new Promise((done) => { const r = indexedDB.deleteDatabase(db); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
  }, [state, DURABLE_DB]);
  await page.goto(`./${route}`);
  await page.reload();
  await appReady(page);
  await screenReady(page, route);
}

/** Light and dark pictures for the evidence folder (RECAP_SHOTS=<folder>); nothing is compared. */
async function shots(page, name) {
  const dir = process.env.RECAP_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await expectNoSidewaysScroll(page);
  await page.waitForTimeout(400); // a sheet's entrance ends
  const project = test.info().project.name;
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
    await page.screenshot({ path: `${dir}/${name}-${scheme}-${project}.png` });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

const recapTile = (sheet, label) => sheet.locator('.recap-tiles .kpi').filter({ hasText: label }).locator('.kpi-num');
const reportTile = (page, label) => page.locator('.report-tiles .kpi').filter({ hasText: label }).locator('.kpi-num');

test('Sunday after a week with learning: the card, the sheet, the parents\' share, and /report\'s numbers for the same week', async ({ page }) => {
  const counts = await fakeApi(page);
  await openAt(page, '#/', recapStudent(), SUNDAY);
  const card = page.locator('.recap-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: 'איך היה השבוע שעבר?' })).toBeVisible();
  await expect(card).toContainText('ימים, צעדים ומה שלמדתם. לוקח חצי דקה.');
  const look = card.getByRole('button', { name: 'לראות' });
  await expectUsable(page, look, 'the card\'s button');
  for (const b of [look, card.locator('.recap-card-close')]) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  // above the path: before the first unit
  expect(await page.evaluate(() => { const c = document.querySelector('.recap-card'); const u = document.querySelector('.unit'); return !!(c.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING); })).toBe(true);
  await shots(page, 'recap-card');

  await look.click();
  const sheet = page.getByRole('dialog', { name: 'השבוע שעבר, 8.11–14.11' });
  await expect(sheet).toBeVisible();
  await expect.poll(() => counts).toContain('recap_open');
  await expect(sheet.locator('.recap-week .week-day')).toHaveCount(7);
  await expect(sheet.locator('.recap-week .week-day.on')).toHaveCount(3);
  await expect(sheet.locator('.recap-week .week-day.rest')).toHaveCount(1); // Shabbat
  await expect(recapTile(sheet, 'ימי לימוד')).toHaveText('3');
  await expect(recapTile(sheet, 'צעדים')).toHaveText('8'); // 1 + (2 + 1 + 2 for the passed check) + 2
  await expect(recapTile(sheet, 'מדרגות בשליטה')).toHaveText('1');
  await expect(sheet.locator('.recap-mastered')).toHaveText('מדרגות חדשות בשליטה: מספרים מכוונים: חיבור וחיסור');
  await expect(sheet.locator('.recap-fixed')).toHaveText(/^טעויות שתיקנתם: \S/);
  await expect(sheet.locator('.recap-best')).toHaveText('שיא שבועי חדש: 8 צעדים!');
  await expect(sheet.locator('.recap-class')).toHaveCount(0); // no class
  // the sheet is about last week, and on a Sunday "השבוע" would be the week just begun (FOLLOWUP-38)
  await expect(sheet.locator('.recap-earned')).toHaveText('בשבוע שעבר מדי קיבל: צעיף מדחום.');
  await expect(sheet.locator('.recap-earned g[data-item="thermo-scarf"]')).toHaveCount(1); // Madi wears it
  await expect(sheet).not.toContainText(/₪|מחיר|תשלום|מנוי/); // nothing about prices on a child's screen
  const fixedName = (await sheet.locator('.recap-fixed').textContent()).replace('טעויות שתיקנתם: ', '');
  await shots(page, 'recap-sheet');

  // "לשלוח להורים": the parents' share sheet for that week, with its WhatsApp link
  await sheet.locator('.recap-actions').getByRole('button', { name: 'לשלוח להורים' }).click();
  const share = page.getByRole('dialog', { name: 'לשלוח להורים' });
  await expect(share).toBeVisible();
  await expect(sheet).toHaveCount(0);
  const wa = share.locator('a.share-wa');
  await expect(wa).toHaveAttribute('href', new RegExp(`^${WA.replace(/[.?/]/g, '\\$&')}`));
  expect(decodeURIComponent((await wa.getAttribute('href')).slice(WA.length))).toContain('8.11');
  await shots(page, 'recap-share');
  await page.keyboard.press('Escape');
  await expect(share).toHaveCount(0);

  // closed once: the week is marked on this device, and the card does not come back, not even after a reload
  expect((await saved(page)).nudges.recapWeek).toBe('2026-11-08');
  await expect(card).toHaveCount(0);
  await page.reload();
  await appReady(page);
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.recap-card')).toHaveCount(0);

  // /report for "השבוע שעבר" shows the same days, the same stair and the same mistake
  await page.goto('./#/report');
  await screenReady(page, '#/report');
  await page.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(reportTile(page, 'ימי תרגול')).toHaveText('3');
  await expect(page.locator('.report-mastered li')).toHaveText(['מספרים מכוונים: חיבור וחיסור']);
  await expect(page.locator('.report-fix-name')).toHaveText([fixedName]);
});

test('closing the card itself marks the week too, and the sheet\'s "סגירה" does the same', async ({ page }) => {
  await fakeApi(page);
  await openAt(page, '#/', recapStudent(), '2026-11-16T09:00:00'); // Monday
  await page.locator('.recap-card-close').click();
  await expect(page.locator('.recap-card')).toHaveCount(0);
  expect((await saved(page)).nudges.recapWeek).toBe('2026-11-08');

  await openAt(page, '#/', recapStudent(), '2026-11-17T18:00:00'); // Tuesday evening, a fresh device
  await page.locator('.recap-card').getByRole('button', { name: 'לראות' }).click();
  const sheet = page.getByRole('dialog', { name: 'השבוע שעבר, 8.11–14.11' });
  await sheet.locator('.recap-actions').getByRole('button', { name: 'סגירה' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.recap-card')).toHaveCount(0);
  expect((await saved(page)).nudges.recapWeek).toBe('2026-11-08');
});

test('Wednesday: no card, and after an empty week no card on Sunday either', async ({ page }) => {
  await fakeApi(page);
  await openAt(page, '#/', recapStudent(), '2026-11-18T10:00:00');
  await expect(page.locator('.unit').first()).toBeVisible();
  await page.waitForTimeout(300); // the engine would have loaded by now
  await expect(page.locator('.recap-card')).toHaveCount(0);

  await openAt(page, '#/', recapStudent({ empty: true }), SUNDAY);
  await expect(page.locator('.unit').first()).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('.recap-card')).toHaveCount(0);
});
