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
  const cls = await makeClass(h, { ai: true });
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

// ---------------------------------------------------------------- charges and refunds that must never be lost or doubled
const classOrder = async (cls, seats = 20) => {
  const token = await signIn(h, 't@example.test');
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': `class-buy-${n++}-0123456789`, ...cls.teacher }, body: { plan: 'class_year', seats, adult: true, terms: '2026-11' } });
  assert.equal(r.status, 201);
  return { token, id: (await r.json()).orderId, amount: seats * 4900 };
};

test('a second charge for a paid class licence order is a duplicate: refunded, the owner told, the licence not extended', async () => {
  h = await setup();
  const cls = await makeClass(h, { ai: true });
  const o = await classOrder(cls);
  assert.deepEqual((await send({ id: 'c1', type: 'paid', order: o.id, payment: 'pay_c1', amountAgorot: o.amount, currency: 'ILS', occurredAt: iso(0) })).body.results, ['applied']);
  const end1 = one(h.env, 'SELECT current_period_end FROM subscriptions').current_period_end;
  const again = await send({ id: 'c2', type: 'paid', order: o.id, payment: 'pay_c2', amountAgorot: o.amount, currency: 'ILS', occurredAt: iso(60_000) });
  assert.deepEqual(again.body.results, ['duplicate_payment']);
  assert.equal(one(h.env, 'SELECT current_period_end FROM subscriptions').current_period_end, end1, 'not a second year');
  assert.equal(one(h.env, "SELECT status FROM payments WHERE provider_payment_id = 'pay_c2'").status, 'duplicate');
  assert.deepEqual(rows(h.env, 'SELECT amount_agorot, reason FROM refund_queue').map((r) => ({ ...r })), [{ amount_agorot: o.amount, reason: 'duplicate' }]);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:duplicate_payment'").length, 1);
});

test('a family order paid again from another standing order is a duplicate; its own renewal is still a renewal', async () => {
  h = await setup();
  const o = await order('twice@example.test');
  await send(paid(o, { occurredAt: iso(-1000) }));
  const other = await send(paid(o, { payment: 'pay_other', subscription: 'sub_other', occurredAt: iso(0) }));
  assert.deepEqual(other.body.results, ['duplicate_payment']);
  const renewal = await send(paid(o, { payment: 'pay_renewal', occurredAt: iso(28 * DAY) }));
  assert.deepEqual(renewal.body.results, ['applied'], 'the same standing order with the order reference is a renewal');
  assert.equal(one(h.env, "SELECT status FROM payments WHERE provider_payment_id = 'pay_renewal'").status, 'ok');
});

test('a renewal charge on a plan ended by a full refund, a chargeback or the owner is refunded, and the provider is told to stop', async () => {
  const { build } = await import('../scripts/owner.mjs');
  const { retryCancels } = await import('../src/billing.js');
  h = await setup();
  // a full refund from the provider
  const o = await order('refunded@example.test');
  await send(paid(o, { occurredAt: iso(-3 * DAY) }));
  assert.deepEqual((await send({ id: 'r1', type: 'refunded', payment: `pay_${o.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0) })).body.results, ['applied']);
  const s1 = one(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', o.account);
  assert.equal(s1.status, 'ended'); assert.ok(s1.cancel_requested_at, 'the standing order is to be cancelled');
  const ren = await send(paid(o, { id: 'ren1', payment: 'pay_ren1', order: undefined, occurredAt: iso(28 * DAY) }));
  assert.deepEqual(ren.body.results, ['after_cancel']);
  assert.equal(one(h.env, "SELECT status FROM payments WHERE provider_payment_id = 'pay_ren1'").status, 'after_cancel');
  // a chargeback
  const o2 = await order('cb@example.test');
  await send(paid(o2, { occurredAt: iso(-3 * DAY) }));
  await send({ id: 'cb', type: 'chargeback', payment: `pay_${o2.id}`, subscription: `sub_${o2.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0) });
  assert.ok(one(h.env, 'SELECT cancel_requested_at FROM subscriptions WHERE account_id = ?', o2.account).cancel_requested_at);
  assert.deepEqual((await send(paid(o2, { id: 'ren_cb', payment: 'pay_ren_cb', order: undefined, occurredAt: iso(28 * DAY) }))).body.results, ['after_cancel']);
  // the owner's end command (the SQL the CLI runs)
  const o3 = await order('end@example.test');
  await send(paid(o3, { occurredAt: iso(-3 * DAY) }));
  const s3 = one(h.env, 'SELECT id FROM subscriptions WHERE account_id = ?', o3.account);
  h.env.DB.raw.exec(build('end', { id: s3.id }).sql);
  assert.ok(one(h.env, 'SELECT cancel_requested_at FROM subscriptions WHERE id = ?', s3.id).cancel_requested_at);
  assert.deepEqual((await send(paid(o3, { id: 'ren_end', payment: 'pay_ren_end', order: undefined, occurredAt: iso(28 * DAY) }))).body.results, ['after_cancel']);
  // three refunds queued, three parent notices, owner notices; and the hourly retry cancels the three standing orders
  assert.deepEqual(rows(h.env, 'SELECT reason, amount_agorot FROM refund_queue ORDER BY id').map((r) => r.reason), ['after_cancel', 'after_cancel', 'after_cancel']);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:after_cancel'").length, 3);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'refunded:%' AND to_account IS NOT NULL").length >= 3, true);
  await retryCancels(h.env);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions WHERE cancel_requested_at IS NOT NULL AND cancel_synced_at IS NULL').length, 0);
  // the children stay on the free taste
  const { linkDevice } = await import('./helpers.js');
  const dev = await linkDevice(h.env, o.account);
  assert.equal((await (await h.call('GET', '/api/ai/status', { headers: dev.headers })).json()).tier, 'free');
});

test('a late charge of a plan that ended for a failed payment, after the family joined again, is a refunded duplicate (not a 500)', async () => {
  const { endFinished } = await import('../src/cron.js');
  h = await setup();
  const o = await order('late@example.test');
  await send(paid(o, { occurredAt: iso(-40 * DAY), periodEnd: iso(-10 * DAY) }));
  const old = one(h.env, 'SELECT * FROM subscriptions');
  await send({ id: 'f1', type: 'failed', subscription: `sub_${o.id}`, payment: 'pay_f1', amountAgorot: 2990, currency: 'ILS', occurredAt: iso(-10 * DAY) });
  await endFinished(h.env);
  assert.equal(one(h.env, 'SELECT ended_reason FROM subscriptions WHERE id = ?', old.id).ended_reason, 'payment_failed');
  const o2 = await order('late@example.test');
  await send(paid(o2, { occurredAt: iso(-1000) }));
  const late = await send(paid(o, { id: 'late1', payment: 'pay_late1', order: undefined, occurredAt: iso(0) }));
  assert.equal(late.status, 200);
  assert.deepEqual(late.body.results, ['duplicate_payment']);
  assert.equal(one(h.env, "SELECT status FROM payments WHERE provider_payment_id = 'pay_late1'").status, 'duplicate');
  assert.deepEqual(rows(h.env, 'SELECT subscription_id, reason, amount_agorot FROM refund_queue').map((r) => ({ ...r })), [{ subscription_id: old.id, reason: 'duplicate', amount_agorot: 2990 }]);
  const now = one(h.env, 'SELECT status, cancel_requested_at FROM subscriptions WHERE id = ?', old.id);
  assert.equal(now.status, 'ended'); assert.ok(now.cancel_requested_at, 'its standing order is stopped');
  assert.equal(rows(h.env, "SELECT * FROM subscriptions WHERE status = 'active'").length, 1);
});

test('one refund or dispute reported twice is recorded once; partial refunds with their own ids add up and end the plan when full', async () => {
  h = await setup();
  const o = await order('two@example.test');
  await send(paid(o, { occurredAt: iso(-3 * DAY) }));
  const a = await send({ id: 'refund.created', type: 'refunded', payment: `pay_${o.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0) });
  const b = await send({ id: 'refund.succeeded', type: 'refunded', payment: `pay_${o.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(1000) });
  assert.deepEqual([a.status, b.status], [200, 200]);
  assert.deepEqual(b.body.results, ['ignored_old']);
  assert.equal(rows(h.env, "SELECT * FROM payments WHERE kind = 'refund'").length, 1);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:refund_unmatched'").length, 0, 'the same amount: a plain repeat');
  // a dispute opened, then closed
  const o2 = await order('cb2@example.test');
  await send(paid(o2, { occurredAt: iso(-3 * DAY) }));
  const c1 = await send({ id: 'dispute.created', type: 'chargeback', payment: `pay_${o2.id}`, subscription: `sub_${o2.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(0) });
  const c2 = await send({ id: 'dispute.closed', type: 'chargeback', payment: `pay_${o2.id}`, subscription: `sub_${o2.id}`, amountAgorot: 2990, currency: 'ILS', occurredAt: iso(1000) });
  assert.deepEqual([c1.status, c2.status], [200, 200]);
  assert.deepEqual(c2.body.results, ['ignored_old']);
  assert.equal(rows(h.env, "SELECT * FROM payments WHERE kind = 'chargeback'").length, 1);
  // two partial refunds of a yearly plan, each with the provider's refund id
  const y = await order('year@example.test', 'family_year');
  await send(paid(y, { amountAgorot: 24900, occurredAt: iso(-30 * DAY) }));
  assert.deepEqual((await send({ id: 'rf1', type: 'refunded', payment: `pay_${y.id}`, refund: 'r_1', amountAgorot: 5000, currency: 'ILS', occurredAt: iso(-1000) })).body.results, ['applied']);
  assert.equal(one(h.env, 'SELECT status FROM subscriptions WHERE account_id = ?', y.account).status, 'active', 'partly refunded: still running');
  assert.deepEqual((await send({ id: 'rf1b', type: 'refunded', payment: `pay_${y.id}`, refund: 'r_1', amountAgorot: 5000, currency: 'ILS', occurredAt: iso(-500) })).body.results, ['ignored_old']);
  assert.deepEqual((await send({ id: 'rf2', type: 'refunded', payment: `pay_${y.id}`, refund: 'r_2', amountAgorot: 19900, currency: 'ILS', occurredAt: iso(0) })).body.results, ['applied']);
  assert.deepEqual(rows(h.env, "SELECT amount_agorot FROM payments WHERE kind = 'refund' AND provider_payment_id LIKE ?", `pay_${y.id}%`).map((r) => r.amount_agorot).sort(), [-19900, -5000]);
  assert.equal(one(h.env, 'SELECT status, ended_reason FROM subscriptions WHERE account_id = ?', y.account).ended_reason, 'refunded', 'refunded in full: ended');
  assert.deepEqual((await send({ id: 'rf3', type: 'refunded', payment: `pay_${y.id}`, refund: 'r_3', amountAgorot: 100, currency: 'ILS', occurredAt: iso(1000) })).body.results, ['ignored_old'], 'nothing left to refund');
  // a second report without a refund id and with another amount: recorded once, and the owner looks
  const z = await order('z@example.test');
  await send(paid(z, { occurredAt: iso(-3 * DAY) }));
  await send({ id: 'rz1', type: 'refunded', payment: `pay_${z.id}`, amountAgorot: 1000, currency: 'ILS', occurredAt: iso(0) });
  assert.deepEqual((await send({ id: 'rz2', type: 'refunded', payment: `pay_${z.id}`, amountAgorot: 1990, currency: 'ILS', occurredAt: iso(1000) })).body.results, ['ignored_old']);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:refund_unmatched' AND ref = 'rz2'").length, 1);
  assert.equal(rows(h.env, "SELECT * FROM payments WHERE kind = 'refund' AND provider_payment_id = ?", `pay_${z.id}`).length, 1);
});

test('a payment that arrives after the account was deleted starts no plan: it is refunded and its standing order stopped', async () => {
  const { forgetAccount } = await import('../src/billing.js');
  h = await setup();
  const o = await order('gone@example.test');
  await forgetAccount(h.env, o.account, { actor: 'test' });
  assert.equal(one(h.env, 'SELECT status, account_id FROM orders WHERE id = ?', o.id).status, 'expired');
  const r = await send(paid(o));
  assert.deepEqual(r.body.results, ['after_cancel']);
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  assert.equal(sub.status, 'ended'); assert.equal(sub.account_id, null); assert.equal(sub.ended_reason, 'account_deleted');
  assert.ok(sub.cancel_requested_at);
  assert.equal(one(h.env, 'SELECT status FROM payments').status, 'after_cancel');
  assert.equal(rows(h.env, "SELECT * FROM refund_queue WHERE reason = 'after_cancel'").length, 1);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:orphan_payment'").length, 1);
  assert.equal(one(h.env, 'SELECT status, subscription_id FROM orders WHERE id = ?', o.id).subscription_id, sub.id);
  // the next charge of the same standing order is refunded too
  assert.deepEqual((await send(paid(o, { id: 'ren_orphan', payment: 'pay_ren_orphan', order: undefined, occurredAt: iso(30 * DAY) }))).body.results, ['after_cancel']);
  assert.equal(rows(h.env, 'SELECT * FROM refund_queue').length, 2);
});
