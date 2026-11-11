// What the family lane's review found, end to end on the fake Worker (fakeServer.js keeps the Worker's rules):
//   wipe / unlink   the server's delete fails: "delete all" (POST /api/me/forget, the one path) stops and says why, the
//                   unlink (POST /api/family/devices/leave) says it did not happen; the token and the summaries stay, so
//                   a second try deletes them; then the second try does
//   join note       a solo student with a backup code is told, under the Settings join form and before joining, that
//                   the class's server will keep that code too, and which switch turns it off
//   deleted         a backup stopped on another device with the same code: the backup turns off here and says why once
//   old summaries   /parents for a device whose only summaries are older than the 8 weeks shown: dated, deletable,
//                   never the first-day card (?qa-parent=report-old, and the fake Worker's `kept`)
// Screenshots for the evidence folder with FAMILY_SHOTS=<folder>.
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { open, reportWeek, saved, appReady, expectNoSidewaysScroll, NOW } from './helpers.js';
import { API, fakeServer, livePlan, TOKEN } from './fakeServer.js';
import { derive } from '../src/lib/durable/crypto.js';
import { makeCode } from '../src/lib/durable/code.js';

const FD = `fd1.${'1'.repeat(64)}`;
const DEVICE = { id: 'd000000000000001', label: 'הטאבלט', token: FD };
/** A child's device linked to the family, the notice already seen, the summary on. */
const linked = () => {
  const s = { ...reportWeek(), version: 3 };
  s.state.ai = { mode: 'server', apiUrl: API, key: '', device: '', familyDevice: { token: FD, label: 'הטאבלט', sharingSeen: '2026-11-05T08:00:00.000Z', lastSent: null } };
  s.state.durable = { nudgeCount: 2 };
  return s;
};

const PARENT = TOKEN(9);
/** The parent's own phone: no profile, the app pointed at the fake server, the parent signed in (as report.spec.js does). */
async function openParent(page, route = '#/parents') {
  const phone = { version: 3, state: { ...reportWeek().state, profile: null, ai: { mode: 'server', apiUrl: API, key: '', device: '' } } };
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  await page.evaluate(async ([s, t]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot', JSON.stringify(s));
    localStorage.setItem('madregot-parent', JSON.stringify({ token: t, email: 'parent@example.test' }));
    await new Promise((done) => { const r = indexedDB.deleteDatabase('madregot-durable'); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
  }, [phone, PARENT]);
  await page.goto(`./${route}`);
  await page.reload();
  await appReady(page);
}

async function shot(page, name) {
  const dir = process.env.FAMILY_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png` });
}

test.describe('the leave the server did not hear', () => {
  // On the main branch "delete all" is the trust lane's one path (lib/wipe.js, TRUST-6): POST /api/me/forget deletes the
  // family device with its summaries and its kept code in one server call (worker forget.js familyDeviceDeleteStmts),
  // so the family lane's separate leave step is that call here, and its failure is that call's failure.
  test('"מחיקת כל הנתונים": the server\'s delete fails, nothing is deleted and the sheet says why; the second try deletes the summaries', async ({ page, baseURL }) => {
    const { st } = await fakeServer(page.context(), { report: true, plan: livePlan(), devices: [{ ...DEVICE }], failForget: true }, baseURL);
    await open(page, '#/', linked());
    await expect.poll(() => Object.keys(st.summaries[DEVICE.id] || {}).length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    const sheet = page.getByRole('dialog', { name: 'למחוק הכול?' });
    await expect(sheet).toContainText('גם הסיכומים שנשלחו להורים מהמכשיר הזה יימחקו.');
    await sheet.getByRole('button', { name: 'כן, למחוק הכול' }).click();
    await expect(sheet.getByRole('alert')).toHaveText('לא הצלחנו למחוק מהשרת, ולכן עוד לא מחקנו כלום. בדקו את החיבור לאינטרנט ונסו שוב.');
    await shot(page, 'wipe-leave-failed');
    const kept = await saved(page);
    expect(kept.ai.familyDevice?.token).toBe(FD);
    expect(kept.profile.name).toBeTruthy();
    expect(Object.keys(st.summaries[DEVICE.id] || {}).length).toBeGreaterThan(0);
    expect(st.devices.some((d) => d.id === DEVICE.id)).toBe(true);
    // the connection is back: the sheet's "לנסות שוב" finishes the job
    st.failForget = false;
    await sheet.getByRole('button', { name: 'לנסות שוב' }).click();
    await expect.poll(() => st.devices.some((d) => d.id === DEVICE.id)).toBe(false);
    expect(st.forgets.at(-1)['x-family-device']).toBe(FD);
    expect(st.summaries[DEVICE.id]).toBeUndefined();
    // the wipe reloads to the start page (lib/wipe.js: ?wiped=1)
    await page.waitForURL(/[?&]wiped=1/);
    await appReady(page);
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
  });

  test('"ניתוק המכשיר מהמנוי": the leave fails, the device stays linked and the toast says so', async ({ page, baseURL }) => {
    const { st } = await fakeServer(page.context(), { report: true, plan: livePlan(), devices: [{ ...DEVICE }] }, baseURL);
    await page.context().route('**/api/family/devices/leave', (route) => route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'server_busy' }) }));
    await open(page, '#/', linked());
    await expect.poll(() => Object.keys(st.summaries[DEVICE.id] || {}).length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.evaluate(() => { window.location.hash = '#/settings'; });
    await page.getByRole('button', { name: 'ניתוק המכשיר מהמנוי' }).click();
    await page.getByRole('dialog', { name: 'לנתק את המכשיר מהמנוי?' }).getByRole('button', { name: 'כן, לנתק' }).click();
    await expect(page.getByText('לא הצלחנו לנתק את המכשיר, אז הוא עדיין מחובר והסיכומים לא נמחקו. נסו שוב כשיש חיבור.')).toBeVisible();
    await expect(page.getByText('המכשיר נותק מהמנוי')).toHaveCount(0);
    expect((await saved(page)).ai.familyDevice?.token).toBe(FD);
    expect(Object.keys(st.summaries[DEVICE.id] || {}).length).toBeGreaterThan(0);
  });
});

test('joining a class from Settings says, before the join, that the class will keep the backup code too', async ({ page, baseURL }) => {
  await fakeServer(page.context(), {}, baseURL);
  const code = makeCode();
  const { lookup } = await derive(code);
  const s = { ...reportWeek(), version: 3 };
  s.state.ai = { mode: 'server', apiUrl: API, key: '', device: '' };
  s.state.backup = { on: true, code, lookup, rev: 1, at: '2026-11-05T09:00:00.000Z', hash: null, escrow: null, state: 'idle' };
  await open(page, '#/settings', s);
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'הצטרפות לכיתה' }) });
  await expect(form.locator('.join-copy-note')).toHaveText('עותק של ההתקדמות נשמר גם בשרת, כדי שתוכלו להמשיך מכל מכשיר עם הקוד האישי. קוד הגיבוי שכבר יש לכם יישמר גם בשרת הכיתה, כך שהשרת יוכל לפתוח את העותק הזה. אפשר לכבות את זה במתג "שמירת עותק בשרת הכיתה".');
  await form.scrollIntoViewIfNeeded();
  await expectNoSidewaysScroll(page);
  await shot(page, 'settings-join-note');
  // without a backup code, only the class sentence
  await open(page, '#/settings', { ...s, state: { ...s.state, backup: { on: false } } });
  await expect(page.locator('.join-copy-note')).toHaveText('עותק של ההתקדמות נשמר גם בשרת, כדי שתוכלו להמשיך מכל מכשיר עם הקוד האישי.');
});

test('a backup stopped on another device turns off here and says so once; it is never made again', async ({ page, baseURL }) => {
  const { st, log } = await fakeServer(page.context(), {}, baseURL);
  const code = makeCode();
  const { lookup } = await derive(code);
  st.tombstones.add(lookup); // device A stopped it
  const s = { ...reportWeek(), version: 3 };
  s.state.ai = { mode: 'server', apiUrl: API, key: '', device: '' };
  s.state.backup = { on: true, code, lookup, rev: 3, at: '2026-11-05T09:00:00.000Z', hash: null, escrow: null, state: 'idle' };
  await open(page, '#/settings#save', s);
  const note = page.locator('.save-backup-note');
  await expect(note).toContainText('הגיבוי נמחק ממכשיר אחר, אז הוא כבוי גם כאן. ההתקדמות במכשיר הזה נשארת. אפשר ליצור קוד גיבוי חדש.', { timeout: 15_000 });
  expect(st.vaults[lookup]).toBeUndefined();
  expect(log.filter((r) => r.path === '/api/vault' && r.method === 'POST' && r.body?.ifRev === null)).toHaveLength(0);
  expect((await saved(page)).backup).toMatchObject({ on: false, code: null, note: 'deleted' });
  await note.scrollIntoViewIfNeeded();
  await shot(page, 'settings-backup-deleted');
  await note.getByRole('button', { name: 'הבנתי' }).click();
  await expect(note).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ליצור קוד גיבוי' })).toBeVisible();
});

test.describe('/parents: summaries older than the 8 weeks shown', () => {
  test('the QA state: dated, deletable, never "עוד אין סיכום"', async ({ page }) => {
    await open(page, '#/parents?qa-parent=report-old');
    const card = page.locator('.report-device');
    await expect(card.locator('.report-older')).toHaveText(/^ב־8 השבועות האחרונים לא הגיע סיכום מהמכשיר הזה\. הסיכום האחרון: \d{1,2}\.\d{1,2}\.$/);
    await expect(card.getByRole('button', { name: 'מחיקת ההיסטוריה של המכשיר' })).toBeVisible();
    await expect(page.getByText('עוד אין סיכום')).toHaveCount(0);
    await expectNoSidewaysScroll(page);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'parents-report-old');
  });

  test('the fake Worker\'s kept count: rows the page did not ask for still give the delete row, and deleting empties it', async ({ page, baseURL }) => {
    const { st, log } = await fakeServer(page.context(), { report: true, plan: livePlan(), devices: [{ ...DEVICE, lastSync: '2026-09-06T18:00:00Z' }] }, baseURL);
    st.sessions.add(PARENT);
    // only rows 60 and 70 days old: GET /api/family/summary?days=56 gives none of them back (the fake Worker windows the
    // rows as the Worker does), `kept` counts them
    const row = (d) => ({ v: 1, d, m: 5, q: 4, ls: 1, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 1, ex: null });
    st.summaries[DEVICE.id] = { '2026-08-27': row('2026-08-27'), '2026-09-06': row('2026-09-06') };
    await openParent(page);
    const card = page.locator('.report-device');
    await expect(card.locator('.report-older')).toHaveText('ב־8 השבועות האחרונים לא הגיע סיכום מהמכשיר הזה. הסיכום האחרון: 6.9.');
    await expect(page.getByText('עוד אין סיכום')).toHaveCount(0);
    await card.getByRole('button', { name: 'מחיקת ההיסטוריה של המכשיר' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'כן, למחוק' }).click();
    await expect.poll(() => log.filter((r) => r.path.endsWith('/history/delete')).length).toBe(1);
    await expect(card.getByRole('button', { name: 'מחיקת ההיסטוריה של המכשיר' })).toHaveCount(0);
    await expect(card.locator('.report-none-kept')).toHaveText('אין כרגע סיכומים שמורים מהמכשיר הזה. הסיכום הבא יגיע אחרי התרגול הבא במכשיר.');
  });
});

test('/parents offers to continue only from progress kept from an unlinked device, never from a linked one', async ({ page }) => {
  await open(page, '#/parents?qa-parent=active');
  await page.getByRole('button', { name: 'חיבור מכשיר נוסף' }).click();
  const form = page.locator('form.parents-link');
  await expect(form.getByText('להמשיך מההתקדמות של:')).toBeVisible();
  // the QA family keeps two: the linked tablet's own (not offered) and an older phone's in the account (offered)
  await expect(form.getByRole('radio')).toHaveText([/הטלפון הקודם/, 'להתחיל מחדש']);
  await expect(form.getByRole('radio', { name: /הטאבלט/ })).toHaveCount(0);
  await form.scrollIntoViewIfNeeded();
  await shot(page, 'parents-continue-kept-only');
});

test('/parents offers only the plans the payment company can sell online here (Grow before it may stop a standing order)', async ({ page, baseURL }) => {
  const { st } = await fakeServer(page.context(), { planOnline: { family_month: false } }, baseURL);
  st.sessions.add(PARENT);
  await openParent(page);
  const plans = page.getByRole('radiogroup', { name: 'מסלול' });
  await expect(plans.getByRole('radio')).toHaveCount(1);
  await expect(plans.getByRole('radio', { name: /שנתי/ })).toHaveAttribute('aria-checked', 'true');
  await expect(plans.getByRole('radio', { name: /חודשי/ })).toHaveCount(0);
  // neither family plan online: the page says joining online is not open yet
  st.planOnline = { family_month: false, family_year: false };
  await page.reload(); await appReady(page);
  await expect(page.getByText(/ההצטרפות באתר עוד לא פתוחה/)).toBeVisible();
});

