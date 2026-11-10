// The paid tutor end to end through the Worker, as the owner rehearses it on a preview Worker with the test provider:
// the free taste, a parent's sign-in by email code, checkout, the test payment page, the plan on a linked device,
// cancellation with a refund, and the emails. Claude, the email service and the payment company are stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, ai, signIn, rows, one, DEVICE } from './helpers.js';

let h;
afterEach(() => h?.done());

test('free taste, sign in, pay on the test page, the family plan on a linked device, cancel with a full refund', async () => {
  h = await setup();
  // the child's device on the free taste
  await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal((await ai(h, 'check', { 'X-Device': DEVICE })).status, 402);

  // the parent signs in and pays
  const token = await signIn(h, 'parent@example.test');
  const plans = await (await h.call('GET', '/api/billing/plans')).json();
  assert.equal(plans.online, true);
  const co = await h.call('POST', '/api/billing/checkout', {
    headers: { 'X-Account-Token': token, 'Idempotency-Key': 'rehearsal-attempt-0001' }, body: { plan: 'family_month', adult: true, terms: plans.termsVersion },
  });
  assert.equal(co.status, 201);
  const { orderId, url } = await co.json();
  assert.ok(plans.checkoutHosts.includes(new URL(url).host));
  const page = await h.call('GET', new URL(url).pathname);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.match(await page.text(), /תשלום לבדיקה/);
  const pay = await h.worker.fetch(new Request(`https://madregot.test${new URL(url).pathname}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '203.0.113.7' }, body: 'result=paid',
  }), h.env, h.ctx);
  assert.equal(pay.status, 303);
  assert.equal(pay.headers.get('Location'), `https://madregot.example.test/parents?order=${orderId}`);
  const poll = await (await h.call('GET', `/api/billing/orders/${orderId}`, { headers: { 'X-Account-Token': token } })).json();
  assert.equal(poll.status, 'paid'); assert.equal(poll.subscription.status, 'active');

  // the child's device shows a code, the parent claims it on their own phone, the device collects its token
  const secret = 'b'.repeat(32);
  const shown = await (await h.call('POST', '/api/family/link/start', { headers: { 'X-Device': DEVICE }, body: { secret } })).json();
  assert.equal((await h.call('POST', '/api/family/link/finish', { body: { code: shown.code, secret } })).status, 202);
  const claimed = await h.call('POST', '/api/family/link/claim', { headers: { 'X-Account-Token': token }, body: { code: shown.code, label: 'הטאבלט' } });
  assert.equal(claimed.status, 200);
  const collected = await (await h.call('POST', '/api/family/link/finish', { body: { code: shown.code, secret } })).json();
  const dev = { headers: { 'X-Family-Device': collected.deviceToken } };
  // the child's device, linked to the plan, has the full tutor on the main model
  const r = await ai(h, 'check', { ...dev.headers, 'X-Device': DEVICE });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'family');
  assert.equal(h.net.log.claude.at(-1).model, 'claude-opus-5-5');

  // cancel within 14 days: a full refund, the tutor closes at once
  const page2 = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(page2.plan.canRefundNow, true);
  const c = await (await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token }, body: { subscriptionId: page2.plan.id, mode: 'refund_now' } })).json();
  assert.equal(c.status, 'ended'); assert.equal(c.refundAgorot, 2990); assert.equal(c.synced, true);
  const after = await ai(h, 'explain', { ...dev.headers, 'X-Device': DEVICE });
  assert.equal(after.headers.get('X-AI-Tier'), 'free');
  await h.ctx.flush();
  const subjects = h.net.log.email.map((m) => m.subject);
  assert.ok(subjects.includes('המנוי לעוזר החכם של מדרגות פעיל'));
  assert.ok(subjects.includes('מכשיר חדש חובר למנוי'));
  assert.ok(subjects.some((s) => s.startsWith(`אישור ביטול המנוי · ${c.reference}`)));
  assert.equal(one(h.env, 'SELECT done_at IS NOT NULL AS done FROM refund_queue').done, 1);
  assert.deepEqual(rows(h.env, 'SELECT outcome FROM billing_events').map((x) => x.outcome), ['applied']);
});

test('a failed test payment grants nothing and the order stays open for another try', async () => {
  h = await setup();
  const token = await signIn(h, 'p@example.test');
  const { orderId } = await (await h.call('POST', '/api/billing/checkout', {
    headers: { 'X-Account-Token': token, 'Idempotency-Key': 'rehearsal-attempt-0002' }, body: { plan: 'family_year', adult: true, terms: '2026-11' },
  })).json();
  const r = await h.call('POST', `/api/billing/test-pay/${orderId}`, { body: { result: 'failed' } });
  assert.equal(r.status, 303);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions').length, 0);
  assert.equal(one(h.env, 'SELECT status FROM orders').status, 'open');
});

test('the test payment page exists only with the test provider in test mode', async () => {
  h = await setup({ ALLOW_TEST_BILLING: 'false' });
  assert.equal((await h.call('GET', '/api/billing/test-pay/0123456789abcdef')).status, 404);
  h.done();
  h = await setup({ BILLING_MODE: 'live' });
  assert.equal((await h.call('GET', '/api/billing/test-pay/0123456789abcdef')).status, 404);
  const health = await (await h.call('GET', '/api/health')).json();
  assert.equal(health.billing, 'none', 'the test provider never loads in live mode');
  assert.equal(health.checkout, false);
});

test('health reports the switches and no secrets', async () => {
  h = await setup();
  const r = await (await h.call('GET', '/api/health')).json();
  assert.deepEqual(Object.keys(r).sort(), ['ai', 'billing', 'checkout', 'deviceMint', 'email', 'freeModel', 'mode', 'model', 'ok', 'paywall', 'soloAI', 'turnstileSiteKey'].sort());
  assert.equal(r.paywall, true); assert.equal(r.billing, 'test'); assert.equal(r.mode, 'test'); assert.equal(r.deviceMint, 'off');
  assert.doesNotMatch(JSON.stringify(r), /secret|resend-test|test-key/);
});
