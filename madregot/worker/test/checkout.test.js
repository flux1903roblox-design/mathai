// Checkout: orders priced on the server from vars, idempotent per attempt, refused when it must be. The test provider
// stands in for a payment company.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutUrl } from '../src/billing.js';
import { setup, signIn, accountId, insertSub, makeClass, one, rows } from './helpers.js';

let h;
afterEach(() => h?.done());
const KEY = 'attempt-0123456789abcdef';
const buy = (token, body, { key = KEY, headers = {} } = {}) => h.call('POST', '/api/billing/checkout', {
  headers: { 'X-Account-Token': token, 'Idempotency-Key': key, ...headers }, body: { adult: true, terms: '2026-11', ...body },
});

test('prices come from the vars and VAT is whole agorot; an amount the client sends is ignored', async () => {
  h = await setup({ PRICE_FAMILY_MONTH_AGOROT: '3490' });
  const t = await signIn(h, 'p@example.test');
  const r = await buy(t, { plan: 'family_month', amountAgorot: 1, amount: 1 });
  assert.equal(r.status, 201);
  const { orderId, url } = await r.json();
  assert.equal(url, `https://madregot.example.test/api/billing/test-pay/${orderId}`);
  const o = one(h.env, 'SELECT * FROM orders WHERE id = ?', orderId);
  assert.equal(o.amount_agorot, 3490); assert.equal(o.vat_agorot, Math.round(3490 * 18 / 118)); assert.equal(o.vat_agorot, 532);
  assert.equal(o.status, 'open'); assert.equal(o.mode, 'test'); assert.equal(o.currency, 'ILS');
  assert.equal(Date.parse(o.expires_at) - Date.parse(o.created_at), 2 * 3600_000);
  const plans = await (await h.call('GET', '/api/billing/plans')).json();
  assert.equal(plans.plans[0].amountAgorot, 3490); assert.equal(plans.plans[0].vatAgorot, 532);
  assert.equal(plans.plans[1].vatAgorot, 3798, '₪249 yearly');
  assert.equal(plans.online, true);
  assert.deepEqual(plans.checkoutHosts, ['madregot.example.test']);
});

test('VAT_MODE "exempt" puts no VAT in the order', async () => {
  h = await setup({ VAT_MODE: 'exempt' });
  const t = await signIn(h, 'exempt@example.test');
  const { orderId } = await (await buy(t, { plan: 'family_year' })).json();
  assert.equal(one(h.env, 'SELECT vat_agorot, amount_agorot FROM orders WHERE id = ?', orderId).vat_agorot, 0);
});

test('the same Idempotency-Key returns the same order and url', async () => {
  h = await setup();
  const t = await signIn(h, 'p@example.test');
  const a = await (await buy(t, { plan: 'family_month' })).json();
  const b = await (await buy(t, { plan: 'family_year' })).json();
  assert.deepEqual(a, b);
  assert.equal(rows(h.env, 'SELECT * FROM orders').length, 1);
  const c = await (await buy(t, { plan: 'family_month' }, { key: 'another-attempt-0123456' })).json();
  assert.notEqual(c.orderId, a.orderId);
  assert.equal((await buy(t, { plan: 'family_month' }, { key: 'short' })).status, 400);
});

test('refused: no adult box (400), no terms (400), a live plan (409), a billing hold (403), paywall off (503), manual provider (501)', async () => {
  h = await setup();
  const t = await signIn(h, 'p@example.test');
  const err = async (r, status, code) => { assert.equal(r.status, status); assert.equal((await r.json()).error, code); };
  await err(await buy(t, { plan: 'family_month', adult: false }), 400, 'adult_required');
  await err(await buy(t, { plan: 'family_month', terms: '2020-01' }), 400, 'terms_required');
  await err(await buy(t, { plan: 'gold' }), 422, 'bad_plan');
  const sub = insertSub(h.env, { kind: 'family', account_id: accountId(h.env, 'p@example.test'), status: 'past_due' });
  await err(await buy(t, { plan: 'family_month' }), 409, 'already_subscribed');
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'canceled' WHERE id = ?").run(sub.id);
  assert.equal((await buy(t, { plan: 'family_month' })).status, 201, 'a canceled plan that still runs allows a new checkout');
  h.env.DB.raw.prepare('UPDATE accounts SET billing_hold_at = ?').run(new Date().toISOString());
  await err(await buy(t, { plan: 'family_month' }, { key: 'k-hold-0123456789abc' }), 403, 'billing_hold');
  h.done();
  h = await setup({ AI_PAYWALL: 'off' });
  await err(await buy(await signIn(h, 'p@example.test'), { plan: 'family_month' }), 503, 'paywall_off');
  h.done();
  h = await setup({ BILLING_PROVIDER: 'manual' });
  await err(await buy(await signIn(h, 'p@example.test'), { plan: 'family_month' }), 501, 'checkout_not_configured');
  const plans = await (await h.call('GET', '/api/billing/plans')).json();
  assert.equal(plans.online, false);
  h.done();
  h = await setup({ ALLOW_TEST_BILLING: 'false' });
  await err(await buy(await signIn(h, 'p@example.test'), { plan: 'family_month' }), 501, 'checkout_not_configured');
  await err(await h.call('POST', '/api/billing/checkout', { body: { plan: 'family_month' } }), 401, 'not_account');
});

test('class_year needs the class teacher key and 10 to 45 seats; the amount is seats x the seat price', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const cls = await makeClass(h);
  const bad = await buy(t, { plan: 'class_year', seats: 30 }, { headers: { 'X-Class-Code': cls.code, 'X-Teacher-Key': 'nope' } });
  assert.equal(bad.status, 401); assert.equal((await bad.json()).error, 'not_teacher');
  assert.equal((await buy(t, { plan: 'class_year', seats: 9 }, { headers: cls.teacher })).status, 422);
  assert.equal((await buy(t, { plan: 'class_year', seats: 46 }, { headers: cls.teacher })).status, 422);
  const ok = await buy(t, { plan: 'class_year', seats: 32 }, { headers: cls.teacher });
  assert.equal(ok.status, 201);
  const o = one(h.env, 'SELECT * FROM orders WHERE id = ?', (await ok.json()).orderId);
  assert.equal(o.amount_agorot, 32 * 4900); assert.equal(o.seats, 32); assert.equal(o.class_code, cls.code);
  assert.ok(Number.isInteger(o.vat_agorot));
  insertSub(h.env, { kind: 'class', class_code: cls.code });
  const has = await buy(t, { plan: 'class_year', seats: 32 }, { headers: cls.teacher, key: 'k-class-2-0123456789' });
  assert.equal(has.status, 409); assert.equal((await has.json()).error, 'class_has_licence');
});

test('a provider url outside BILLING_CHECKOUT_HOSTS is 502 bad_checkout_url', async () => {
  h = await setup({ BILLING_CHECKOUT_HOSTS: 'pay.example.test' });
  const evil = { id: 'x', createCheckout: async () => ({ url: 'https://elsewhere.example.test/pay' }) };
  const good = { id: 'x', createCheckout: async () => ({ url: 'https://pay.example.test/s/1' }) };
  const order = { id: '0123456789abcdef', plan: 'family_month' };
  await assert.rejects(checkoutUrl(h.env, evil, order, { email: 'p@example.test' }, KEY), (e) => e.status === 502 && e.code === 'bad_checkout_url');
  await assert.rejects(checkoutUrl(h.env, { id: 'x', createCheckout: async () => ({ url: 'javascript:alert(1)' }) }, order, {}, KEY), (e) => e.code === 'bad_checkout_url');
  assert.equal(await checkoutUrl(h.env, good, order, {}, KEY), 'https://pay.example.test/s/1');
});

test('the adult confirmation and the terms version are stored with the account', async () => {
  h = await setup();
  const t = await signIn(h, 'p@example.test');
  await buy(t, { plan: 'family_month' });
  const a = one(h.env, 'SELECT adult_confirmed_at, terms_version FROM accounts');
  assert.ok(a.adult_confirmed_at); assert.equal(a.terms_version, '2026-11');
});

test('an order is visible to its own account only', async () => {
  h = await setup();
  const t = await signIn(h, 'p@example.test');
  const { orderId } = await (await buy(t, { plan: 'family_month' })).json();
  const mine = await (await h.call('GET', `/api/billing/orders/${orderId}`, { headers: { 'X-Account-Token': t } })).json();
  assert.deepEqual(mine, { status: 'open', plan: 'family_month', subscription: null });
  const stranger = await signIn(h, 'other@example.test');
  assert.equal((await h.call('GET', `/api/billing/orders/${orderId}`, { headers: { 'X-Account-Token': stranger } })).status, 404);
});
