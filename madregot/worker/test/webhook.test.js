// The payment webhook: a path secret, a signature, a pull of the truth, and one atomic apply batch per event behind its
// billing_events row. The test provider's signed events stand in for a payment company.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyTruth } from '../src/billing.js';
import testProvider from '../src/providers/test.js';
import { setup, signIn, accountId, signedTestEvent, rows, one, makeClass } from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
let n = 0;
const iso = (ms) => new Date(Date.now() + ms).toISOString();

async function order(email = 'p@example.test', plan = 'family_month', key = `attempt-${'x'.repeat(10)}-${n++}`) {
  const token = await signIn(h, email);
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': key }, body: { plan, adult: true, terms: '2026-11' } });
  assert.equal(r.status, 201);
  return { token, id: (await r.json()).orderId, account: accountId(h.env, email) };
}
const hook = (body, headers = {}, { secret = h.env.WEBHOOK_PATH_SECRET, provider = 'test' } = {}) => h.call('POST', `/api/billing/webhook/${provider}/${secret}`, { body, headers });
async function send(event, opts = {}) {
  const s = await signedTestEvent(h.env, event, opts);
  const r = await hook(s.body, s.headers);
  return { status: r.status, body: await r.json() };
}
const paid = (o, extra = {}) => ({ id: `ev_${n++}`, type: 'paid', order: o.id, payment: `pay_${o.id}`, subscription: `sub_${o.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0), ...extra });
const count = (table) => one(h.env, `SELECT COUNT(*) AS c FROM ${table}`).c;

test('an unknown provider or a wrong path secret is 404 and writes nothing', async () => {
  h = await setup();
  const o = await order();
  const s = await signedTestEvent(h.env, paid(o));
  assert.equal((await hook(s.body, s.headers, { provider: 'stripe' })).status, 404);
  assert.equal((await hook(s.body, s.headers, { provider: 'manual' })).status, 404, 'a provider that is not in use');
  assert.equal((await hook(s.body, s.headers, { secret: 'f'.repeat(48) })).status, 404);
  assert.equal(count('billing_events'), 0); assert.equal(count('subscriptions'), 0);
  h.done();
  h = await setup({ WEBHOOK_PATH_SECRET: 'short' });
  const s2 = await signedTestEvent(h.env, { id: 'x', type: 'paid' });
  assert.equal((await hook(s2.body, s2.headers, { secret: 'short' })).status, 404, 'a path secret under 32 hex is never accepted');
});

test('a bad signature or a timestamp older than 5 minutes is 401 and writes nothing; the old secret works while rotating', async () => {
  h = await setup({ TEST_WEBHOOK_SECRET_OLD: 'the-previous-secret-0123456789' });
  const o = await order();
  const bad = await send(paid(o), { secret: 'wrong-secret-0123456789' });
  assert.equal(bad.status, 401); assert.equal(bad.body.error, 'bad_signature');
  const stale = await send(paid(o), { at: Math.floor(Date.now() / 1000) - 301 });
  assert.equal(stale.status, 401);
  const raw = JSON.stringify(paid(o));
  assert.equal((await hook(raw, {})).status, 401, 'unsigned');
  assert.equal(count('billing_events'), 0);
  const rotated = await send(paid(o), { secret: 'the-previous-secret-0123456789' });
  assert.equal(rotated.status, 200); assert.deepEqual(rotated.body.results, ['applied']);
});

test('a body over 64 KB is 413', async () => {
  h = await setup();
  const r = await hook(JSON.stringify({ id: 'big', pad: 'x'.repeat(65 * 1024) }), {});
  assert.equal(r.status, 413);
});

test('a paid order: one subscription, the order paid, one payment, a welcome notice', async () => {
  h = await setup();
  const o = await order();
  const r = await send(paid(o, { periodEnd: iso(31 * DAY) }));
  assert.deepEqual(r.body, { ok: true, results: ['applied'] });
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  assert.equal(sub.account_id, o.account); assert.equal(sub.plan, 'family_month'); assert.equal(sub.status, 'active');
  assert.equal(sub.price_agorot, 2990); assert.equal(sub.provider_subscription_id, `sub_${o.id}`);
  assert.equal(Date.parse(sub.refund_until) - Date.parse(sub.first_paid_at), 14 * DAY);
  assert.equal(one(h.env, 'SELECT status, subscription_id FROM orders').subscription_id, sub.id);
  assert.equal(count('payments'), 1);
  assert.ok(one(h.env, "SELECT * FROM notices WHERE kind = 'welcome'"));
  const poll = await (await h.call('GET', `/api/billing/orders/${o.id}`, { headers: { 'X-Account-Token': o.token } })).json();
  assert.equal(poll.status, 'paid'); assert.equal(poll.subscription.status, 'active');
});

test('a hint whose pulled truth says failed grants nothing', async () => {
  h = await setup();
  const o = await order();
  const hint = { eventId: 'ev_hint', type: 'paid', orderRef: o.id };
  const outcome = await applyTruth(h.env, testProvider, hint, { status: 'failed', mode: 'test', currency: 'ILS', amountAgorot: 2990, orderRef: o.id, occurredAt: iso(0) });
  assert.equal(outcome, 'applied');
  assert.equal(count('subscriptions'), 0); assert.equal(count('payments'), 0);
  assert.equal(one(h.env, 'SELECT status FROM orders').status, 'open');
});

test('an amount, currency or mode mismatch is recorded with an owner notice and never grants', async () => {
  h = await setup();
  const o = await order();
  assert.deepEqual((await send(paid(o, { amountAgorot: 2490 }))).body.results, ['mismatch']);
  assert.deepEqual((await send(paid(o, { currency: 'USD' }))).body.results, ['mismatch']);
  const outcome = await applyTruth(h.env, testProvider, { eventId: 'ev_live', type: 'paid' },
    { status: 'paid', mode: 'live', currency: 'ILS', amountAgorot: 2990, orderRef: o.id, occurredAt: iso(0) });
  assert.equal(outcome, 'test_mode');
  assert.equal(count('subscriptions'), 0); assert.equal(count('payments'), 0);
  assert.deepEqual(rows(h.env, 'SELECT outcome FROM billing_events ORDER BY received_at').map((r) => r.outcome).sort(), ['mismatch', 'mismatch', 'test_mode']);
  assert.ok(one(h.env, "SELECT detail FROM billing_events WHERE detail LIKE 'amount%'").detail.includes('2490≠2990'));
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind IN ('owner:mismatch', 'owner:test_mode')").length, 3);
});

test('an unknown order is outcome unknown, 200', async () => {
  h = await setup();
  const r = await send({ id: 'ev_u', type: 'paid', order: 'ffffffffffffffff', payment: 'p_u', amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0) });
  assert.equal(r.status, 200); assert.deepEqual(r.body.results, ['unknown']);
  assert.equal(count('subscriptions'), 0);
});

test('the same event twice, one after another and at the same time, gives one payment and one period', async () => {
  h = await setup();
  const o = await order();
  const ev = paid(o);
  const s = await signedTestEvent(h.env, ev);
  const results = await Promise.all([hook(s.body, s.headers), hook(s.body, s.headers), hook(s.body, s.headers)]);
  assert.ok(results.every((r) => r.status === 200));
  const again = await (await hook(s.body, s.headers)).json();
  assert.deepEqual(again.results, ['duplicate']);
  assert.equal(count('subscriptions'), 1); assert.equal(count('payments'), 1); assert.equal(count('billing_events'), 1);
  // the same payment reported under another event id is not counted again
  assert.deepEqual((await send({ ...ev, id: 'ev_other' })).body.results, ['ignored_old']);
  assert.equal(count('payments'), 1);
});

test('a renewal extends with MAX(); an older event after a newer one is ignored_old and never moves dates back', async () => {
  h = await setup();
  const o = await order();
  await send(paid(o, { occurredAt: iso(-10 * DAY), periodEnd: iso(20 * DAY) }));
  const r1 = await send(paid(o, { id: 'ren1', payment: 'pay_r1', order: undefined, occurredAt: iso(-1000), periodEnd: iso(50 * DAY) }));
  assert.deepEqual(r1.body.results, ['applied']);
  const end1 = one(h.env, 'SELECT current_period_end FROM subscriptions').current_period_end;
  assert.equal(end1, new Date(Date.parse(end1)).toISOString());
  assert.ok(Date.parse(end1) > Date.now() + 49 * DAY);
  const old = await send({ id: 'oldfail', type: 'failed', subscription: `sub_${o.id}`, payment: 'pay_f', amountAgorot: 2990, currency: 'ILS', occurredAt: iso(-5 * DAY) });
  assert.deepEqual(old.body.results, ['ignored_old']);
  const late = await send(paid(o, { id: 'ren0', payment: 'pay_r0', order: undefined, occurredAt: iso(-4 * DAY), periodEnd: iso(30 * DAY) }));
  assert.deepEqual(late.body.results, ['applied']);
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  assert.equal(sub.current_period_end, end1, 'dates never move back');
  assert.equal(sub.status, 'active');
  assert.equal(count('payments'), 3);
});

test('a failure inside the apply batch leaves no billing_events row, so the retry applies it', async () => {
  h = await setup();
  const o = await order();
  const s = await signedTestEvent(h.env, paid(o));
  const real = h.env.DB.batch;
  let broken = true;
  h.env.DB.batch = async (list) => {
    if (broken && list.some((st) => /INSERT INTO billing_events/.test(st.sql))) {
      broken = false;
      return real([...list, h.env.DB.prepare('INSERT INTO no_such_table VALUES (1)')]);
    }
    return real(list);
  };
  const first = await hook(s.body, s.headers);
  assert.equal(first.status, 500);
  assert.equal(count('billing_events'), 0); assert.equal(count('subscriptions'), 0); assert.equal(count('payments'), 0);
  const retry = await (await hook(s.body, s.headers)).json();
  assert.deepEqual(retry.results, ['applied']);
  assert.equal(count('subscriptions'), 1);
});

test('the provider unreachable during the pull is 503 and writes nothing', async () => {
  h = await setup({ TEST_PROVIDER_FAIL: 'truth' });
  const o = await order();
  const r = await send(paid(o));
  assert.equal(r.status, 503); assert.equal(r.body.error, 'retry_later');
  assert.equal(count('billing_events'), 0); assert.equal(count('subscriptions'), 0);
});

test('a second family payment while one is live: payment duplicate, refund queued, owner notice', async () => {
  h = await setup();
  const a = await order('dup@example.test');
  const b = await order('dup@example.test');
  await send(paid(a));
  const r = await send(paid(b));
  assert.deepEqual(r.body.results, ['duplicate_payment']);
  assert.equal(count('subscriptions'), 1);
  const p = one(h.env, `SELECT * FROM payments WHERE order_id = '${b.id}'`);
  assert.equal(p.status, 'duplicate');
  const q = one(h.env, 'SELECT * FROM refund_queue');
  assert.equal(q.reason, 'duplicate'); assert.equal(q.amount_agorot, 2990); assert.equal(q.payment_id, p.id);
  assert.ok(one(h.env, "SELECT * FROM notices WHERE kind = 'owner:duplicate_payment'"));
});

test('a renewal charged after cancel_requested_at: after_cancel, refund queued, the cancellation is kept', async () => {
  h = await setup();
  const o = await order();
  await send(paid(o, { occurredAt: iso(-20 * DAY) }));
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  const c = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': o.token }, body: { subscriptionId: sub.id, mode: 'period_end' } });
  assert.equal(c.status, 200);
  const r = await send(paid(o, { id: 'ren_after', payment: 'pay_after', order: undefined, occurredAt: iso(1000) }));
  assert.deepEqual(r.body.results, ['after_cancel']);
  const s2 = one(h.env, 'SELECT * FROM subscriptions');
  assert.equal(s2.status, 'canceled'); assert.equal(s2.current_period_end, sub.current_period_end);
  assert.equal(one(h.env, "SELECT * FROM payments WHERE provider_payment_id = 'pay_after'").status, 'after_cancel');
  assert.equal(one(h.env, "SELECT * FROM refund_queue WHERE reason = 'after_cancel'").amount_agorot, 2990);
  assert.ok(one(h.env, "SELECT * FROM notices WHERE kind LIKE 'refunded:%'"));
});

test('failed: past_due and one email; a full refund ends the plan now; a chargeback ends it and puts the account on hold', async () => {
  h = await setup();
  const o = await order();
  await send(paid(o, { occurredAt: iso(-3 * DAY) }));
  const f = { id: 'f1', type: 'failed', subscription: `sub_${o.id}`, payment: 'pay_f1', amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0) };
  assert.deepEqual((await send(f)).body.results, ['applied']);
  await send({ ...f, id: 'f2', occurredAt: iso(1000) });
  assert.equal(one(h.env, 'SELECT status FROM subscriptions').status, 'past_due');
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'payment_failed:%'").length, 1, 'one email per period');
  const ref = await send({ id: 'r1', type: 'refunded', payment: `pay_${o.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(2000) });
  assert.deepEqual(ref.body.results, ['applied']);
  const ended = one(h.env, 'SELECT * FROM subscriptions');
  assert.equal(ended.status, 'ended'); assert.equal(ended.ended_reason, 'refunded');
  assert.ok(Date.parse(ended.current_period_end) <= Date.now() + 3000);
  assert.equal(one(h.env, "SELECT amount_agorot FROM payments WHERE kind = 'refund'").amount_agorot, -2990);

  const o2 = await order('cb@example.test');
  await send(paid(o2, { occurredAt: iso(-1000) }));
  const cb = await send({ id: 'cb1', type: 'chargeback', payment: `pay_${o2.id}`, subscription: `sub_${o2.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0) });
  assert.deepEqual(cb.body.results, ['applied']);
  const s = one(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', o2.account);
  assert.equal(s.status, 'ended'); assert.equal(s.ended_reason, 'chargeback');
  assert.ok(one(h.env, 'SELECT billing_hold_at FROM accounts WHERE id = ?', o2.account).billing_hold_at);
  assert.ok(one(h.env, "SELECT * FROM notices WHERE kind = 'owner:chargeback'"));
  const blocked = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': o2.token, 'Idempotency-Key': 'after-chargeback-0001' }, body: { plan: 'family_month', adult: true, terms: '2026-11' } });
  assert.equal(blocked.status, 403);
});

test('a paid class licence replaces a running trial of the same class', async () => {
  h = await setup();
  const cls = await makeClass(h);
  const { insertSub } = await import('./helpers.js');
  insertSub(h.env, { kind: 'class', class_code: cls.code, plan: 'trial', seats: 10 });
  const token = await signIn(h, 't@example.test');
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': 'class-buy-0123456789', ...cls.teacher }, body: { plan: 'class_year', seats: 20, adult: true, terms: '2026-11' } });
  assert.equal(r.status, 201);
  const { orderId } = await r.json();
  const res = await send({ id: 'cl1', type: 'paid', order: orderId, payment: 'pay_cl1', amountAgorot: 20 * 4900, currency: 'ILS', occurredAt: iso(0) });
  assert.deepEqual(res.body.results, ['applied']);
  const subs = rows(h.env, 'SELECT plan, status, seats, provider_subscription_id FROM subscriptions ORDER BY created_at');
  assert.deepEqual(subs.map((s) => [s.plan, s.status]).sort(), [['class_year', 'active'], ['trial', 'ended']]);
  assert.equal(subs.find((s) => s.plan === 'class_year').provider_subscription_id, null, 'a class licence does not renew');
});

test('billing_events.detail never holds an address or a long number', async () => {
  h = await setup();
  const o = await order();
  await send(paid(o, { amountAgorot: 123456789 }));
  await send({ id: 'weird@example.test', type: 'refunded', payment: '1234567890123', amountAgorot: 5, currency: 'ILS', occurredAt: iso(0) });
  await send(paid(o));
  for (const { detail } of rows(h.env, 'SELECT detail FROM billing_events')) {
    assert.doesNotMatch(detail, /@/); assert.doesNotMatch(detail, /\d{8,}/);
  }
});
