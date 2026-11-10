// The tutor's subscription, end to end against a fake server (no Worker, no Claude, no email, no payment company):
// the free taste counts down and then explains itself, actions that need the subscription say so, the lesson does
// not spend a free question on its own, a parent signs in with an emailed code, joins, and cancels online.
import { test, expect } from '@playwright/test';
import { open, student, answer, proceed } from './helpers.js';

const API = 'https://api.madregot.test';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-AI-Tier, X-AI-Left',
};

/** A fake Worker with the subscription's endpoints. `s` is its state; the test can read `log`. */
function fakeServer(page, s = {}) {
  const st = { tier: 'free', used: 0, free: 2, paid: 40, signedIn: false, plan: null, online: true, price: '29 ₪ לחודש', contact: 'hello@madregot.test', ...s };
  const log = [];
  const status = () => ({
    tier: st.tier, limit: st.tier === 'paid' ? st.paid : st.free, used: st.used, left: Math.max(0, (st.tier === 'paid' ? st.paid : st.free) - st.used),
    kinds: st.tier === 'free' ? ['explain', 'chat'] : null, signedIn: st.signedIn, email: st.signedIn ? 'parent@example.test' : null, plan: st.plan,
    offer: { daily: { free: st.free, paid: st.paid, teacher: 200 }, family: { price: st.price, online: st.online }, school: { contact: st.contact } }, aiReady: true,
  });
  const reply = (route, code, data, headers = {}) => route.fulfill({ status: code, contentType: 'application/json', headers: { ...CORS, ...headers }, body: JSON.stringify(data) });
  return page.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.push({ path, body, headers: req.headers() });
    if (path === '/api/ai/status') return reply(route, 200, status());
    if (path.startsWith('/api/ai/')) {
      const kind = path.split('/').pop();
      if (st.tier === 'free' && !['explain', 'chat'].includes(kind)) return reply(route, 402, { error: 'paid_only' });
      const limit = st.tier === 'paid' ? st.paid : st.free;
      if (st.used >= limit) return reply(route, 429, { error: 'daily_limit', tier: st.tier, limit });
      st.used += 1;
      const h = { 'X-AI-Tier': st.tier, 'X-AI-Left': String(limit - st.used) };
      if (kind === 'chat') return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: { ...CORS, ...h }, body: 'כדי לחבר מספרים עם סימנים שונים, מחסרים ושמים את הסימן של הגדול.' });
      return reply(route, 200, { text: 'הסבר קצר מהעוזר.' }, h);
    }
    if (path === '/api/account/code') return reply(route, 200, { sent: true, expiresInMinutes: 10 });
    if (path === '/api/account/verify') {
      if (body.code !== '123456') return reply(route, 403, { error: 'wrong_code', left: 4 });
      st.signedIn = true;
      return reply(route, 200, { token: 'tok_test_0123456789', email: body.email });
    }
    if (path === '/api/billing/checkout') return reply(route, 200, { url: 'https://pay.example.test/checkout?ref=acc1' });
    if (path === '/api/billing/cancel') {
      st.plan = { ...st.plan, status: 'canceled', cancelAtPeriodEnd: true };
      return reply(route, 200, { ok: true, endsAt: st.plan.endsAt });
    }
    if (path === '/api/account/signout') { st.signedIn = false; return reply(route, 200, { ok: true }); }
    if (path === '/api/account/delete') { st.signedIn = false; st.plan = null; st.tier = 'free'; return reply(route, 200, { ok: true }); }
    return reply(route, 404, { error: 'not_found' });
  }).then(() => ({ st, log }));
}

/** A student practising alone, with the app pointed at the fake server. */
const solo = (extra = {}) => student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '', account: null }, ...extra });

test.describe('the tutor subscription', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone and tablet layouts');

  test('the free taste: two questions, then a calm sheet that points to the plan', async ({ page }) => {
    const { log } = await fakeServer(page);
    await open(page, '#/assistant', solo());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך מחברים 3 ועוד מינוס 5?'); await draft.press('Enter');
    await expect(page.getByText('נשארה היום שאלה חינם אחת.')).toBeVisible();
    await draft.fill('ועוד שאלה'); await draft.press('Enter');
    await expect(page.getByText('השאלות החינמיות של היום נגמרו. מחר יש עוד.')).toBeVisible();
    await draft.fill('ושאלה שלישית'); await draft.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'השאלות החינמיות של היום נגמרו' });
    await expect(sheet).toBeVisible();
    // every call carried this device's id (the server counts the free questions per device)
    const devices = new Set(log.filter((r) => r.path.startsWith('/api/ai/')).map((r) => r.headers['x-device']));
    expect(devices.size).toBe(1); expect([...devices][0]).toMatch(/^[a-f0-9]{32}$/);
    await sheet.getByRole('button', { name: 'פרטים על המנוי, להורים' }).click();
    await expect(page.getByRole('heading', { name: 'העוזר והמנוי' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'העוזר בחינם' })).toBeVisible();
  });

  test('an action of the subscription says so before anything is sent', async ({ page }) => {
    const { log } = await fakeServer(page);
    await open(page, '#/assistant', solo());
    const tool = page.getByRole('button', { name: /תרגילים חדשים/ });
    await expect(tool).toContainText('במנוי');
    await tool.click();
    await expect(page.getByRole('dialog', { name: 'זה חלק מהמנוי' })).toBeVisible();
    await page.getByRole('button', { name: 'להמשיך לתרגל' }).click();
    await expect(page.getByRole('dialog', { name: 'זה חלק מהמנוי' })).toBeHidden();
    expect(log.filter((r) => r.path === '/api/ai/generate')).toHaveLength(0);
  });

  test('the exam check says it is part of the plan before any page is photographed', async ({ page }) => {
    await fakeServer(page);
    await open(page, '#/exams/check', solo());
    await expect(page.getByRole('heading', { name: 'בדיקת מבחן כלולה במנוי' })).toBeVisible();
    await page.getByRole('link', { name: 'פרטים על המנוי, להורים' }).click();
    await expect(page.getByRole('heading', { name: 'העוזר והמנוי' })).toBeVisible();
  });

  test('with a plan the tools carry no mark and open', async ({ page }) => {
    await fakeServer(page, { tier: 'paid', signedIn: true, plan: { kind: 'family', status: 'active', endsAt: '2026-12-05T10:00:00Z', cancelAtPeriodEnd: false, provider: 'generic' } });
    await open(page, '#/assistant', solo({ ai: { mode: 'server', apiUrl: API, key: '', device: '', account: { token: 'tok_test_0123456789', email: 'parent@example.test' } } }));
    const tool = page.getByRole('button', { name: /תרגילים חדשים/ });
    await expect(tool).not.toContainText('במנוי');
    await tool.click();
    await expect(page.getByRole('button', { name: 'כתיבת תרגילים' })).toBeVisible();
  });

  test('on the free taste a lesson does not spend a question by itself; on a plan it does', async ({ page }) => {
    const { st, log } = await fakeServer(page);
    await open(page, '#/lesson/signed/1', solo());
    await answer(page, false);
    await expect(page.locator('section.fb-retry')).toBeVisible();
    await proceed(page);
    await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'למה טעיתי?' })).toBeVisible();
    await expect(page.locator('.ai-left')).toContainText('נשארו היום 2 שאלות חינם.');
    expect(log.filter((r) => r.path === '/api/ai/explain')).toHaveLength(0);
    await page.getByRole('button', { name: 'למה טעיתי?' }).click();
    await expect(page.getByText('הסבר קצר מהעוזר.')).toBeVisible();
    expect(st.used).toBe(1);
  });

  test('with a family plan the lesson explains a second miss without being asked', async ({ page }) => {
    const { log } = await fakeServer(page, { tier: 'paid', signedIn: true, plan: { kind: 'family', status: 'active', endsAt: '2026-12-05T10:00:00Z', cancelAtPeriodEnd: false, provider: 'generic' } });
    await open(page, '#/lesson/signed/1', solo({ ai: { mode: 'server', apiUrl: API, key: '', device: '', account: { token: 'tok_test_0123456789', email: 'parent@example.test' } } }));
    await answer(page, false);
    await expect(page.locator('section.fb-retry')).toBeVisible();
    await proceed(page);
    await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    await expect(page.getByText('הסבר קצר מהעוזר.')).toBeVisible();
    expect(log.filter((r) => r.path === '/api/ai/explain')).toHaveLength(1);
    expect(log.find((r) => r.path === '/api/ai/explain').headers['x-account-token']).toBe('tok_test_0123456789');
  });

  test('a parent signs in with an emailed code and goes to payment', async ({ page }) => {
    await fakeServer(page);
    await page.route('https://pay.example.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>payment page</p>' }));
    await open(page, '#/subscription', solo());
    await expect(page.getByRole('heading', { name: 'העוזר בחינם' })).toBeVisible();
    await expect(page.getByRole('row', { name: /מחיר/ })).toContainText('29 ₪ לחודש');
    await page.getByLabel('כתובת המייל שלכם').fill('parent@example.test');
    await page.getByRole('button', { name: 'שליחת קוד' }).click();
    await expect(page.getByRole('button', { name: /קוד חדש בעוד \d+ שניות/ })).toBeDisabled();
    await page.getByLabel('הקוד מהמייל').fill('111111');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByRole('alert')).toContainText('נשארו עוד 4 ניסיונות');
    await page.getByLabel('הקוד מהמייל').fill('123456');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByText('מחוברים בתור')).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.ai.account);
    expect(saved).toEqual({ token: 'tok_test_0123456789', email: 'parent@example.test' });
    await page.getByRole('button', { name: 'הצטרפות למנוי המשפחתי' }).click();
    await page.waitForURL('https://pay.example.test/**');
  });

  test('a plan is cancelled online and runs to the end of the period', async ({ page }) => {
    await fakeServer(page, { tier: 'paid', signedIn: true, used: 3, plan: { kind: 'family', status: 'active', endsAt: '2026-12-05T10:00:00Z', cancelAtPeriodEnd: false, provider: 'generic' } });
    await open(page, '#/subscription', solo({ ai: { mode: 'server', apiUrl: API, key: '', device: '', account: { token: 'tok_test_0123456789', email: 'parent@example.test' } } }));
    await expect(page.getByRole('heading', { name: 'המנוי המשפחתי פעיל' })).toBeVisible();
    await expect(page.getByText('מתחדש ב־5 בדצמבר 2026.')).toBeVisible();
    await page.getByRole('button', { name: 'ביטול המנוי' }).click();
    const sheet = page.getByRole('dialog', { name: 'לבטל את המנוי?' });
    await sheet.getByRole('button', { name: 'כן, לבטל' }).click();
    await expect(page.getByText('המנוי בוטל, והעוזר פתוח עד 5 בדצמבר 2026.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ביטול המנוי' })).toHaveCount(0);
  });

  test('settings shows the plan row only when there is a server', async ({ page }) => {
    await fakeServer(page);
    await open(page, '#/settings', solo());
    await page.getByRole('link', { name: /שאלות חינם ביום. פרטים על המנוי/ }).click();
    await expect(page.getByRole('heading', { name: 'העוזר והמנוי' })).toBeVisible();
    await open(page, '#/settings', student());
    await expect(page.getByRole('heading', { name: 'מנוי לעוזר' })).toHaveCount(0);
  });

  test('without a server the page says there is no plan in this version', async ({ page }) => {
    await open(page, '#/subscription', student());
    await expect(page.getByRole('heading', { name: 'בגרסה הזו אין מנוי' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'מה כלול' })).toBeVisible();
  });
});
