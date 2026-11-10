// decide() and the month arithmetic, without a database: one case per row of the spec's §6.4 table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, decide, cleanDetail } from '../src/apply.js';

test('addMonths: 31 January + 1 = the end of February; leap years; Jerusalem day boundaries', () => {
  // 31 Jan 10:00 Jerusalem (UTC+2) → 28 Feb 10:00
  assert.equal(addMonths('2027-01-31T08:00:00.000Z', 1), '2027-02-28T08:00:00.000Z');
  assert.equal(addMonths('2028-01-31T08:00:00.000Z', 1), '2028-02-29T08:00:00.000Z', 'leap year');
  assert.equal(addMonths('2026-11-10T08:00:00.000Z', 12), '2027-11-10T08:00:00.000Z');
  // 31 Oct 00:30 in Jerusalem is still 30 Oct in UTC; the month is counted on the Jerusalem date (31 Oct → 30 Nov)
  assert.equal(addMonths('2026-10-30T22:30:00.000Z', 1), '2026-11-29T22:30:00.000Z');
  // summer time to winter time keeps the local time of day (10:00 IDT → 10:00 IST)
  assert.equal(addMonths('2026-09-15T07:00:00.000Z', 2), '2026-11-15T08:00:00.000Z');
  assert.equal(addMonths('2026-12-31T08:00:00.000Z', 2), '2027-02-28T08:00:00.000Z');
});

const NOW = '2026-11-10T10:00:00.000Z';
const ctx = (over = {}) => ({
  mode: 'test', now: NOW, provider: 'test', eventId: 'ev1', graceDays: 3, order: null, sub: null, live: null, liveTrial: null,
  charge: null, latestCharge: null, paymentExists: false, ids: { sub: 'sub_new', payment: 'pay_new' }, ...over,
});
const truth = (over = {}) => ({ status: 'paid', mode: 'test', currency: 'ILS', amountAgorot: 2990, orderRef: 'o1', providerPaymentId: 'p1', providerSubscriptionId: 'ps1', occurredAt: NOW, ...over });
const order = (over = {}) => ({ id: 'o1', account_id: 'a1', plan: 'family_month', amount_agorot: 2990, status: 'open', class_code: null, seats: null, ...over });
const sub = (over = {}) => ({
  id: 's1', account_id: 'a1', plan: 'family_month', status: 'active', price_agorot: 2990, current_period_start: '2026-10-10T10:00:00.000Z',
  current_period_end: '2026-11-10T10:00:00.000Z', last_event_at: '2026-10-10T10:00:00.000Z', cancel_requested_at: null, ended_reason: null, ...over,
});
const ops = (d) => d.ops.map((o) => o.op);

test('decide: any truth in another mode is test_mode, an event row only and an owner notice', () => {
  const d = decide(truth({ mode: 'live' }), ctx({ order: order() }));
  assert.equal(d.outcome, 'test_mode'); assert.deepEqual(d.ops, []); assert.equal(d.notices[0].kind, 'owner:test_mode');
});

test('decide: a currency other than ILS is a mismatch', () => {
  const d = decide(truth({ currency: 'USD' }), ctx({ order: order() }));
  assert.equal(d.outcome, 'mismatch'); assert.deepEqual(d.ops, []);
});

test('decide: paid, the amount differs from the order: mismatch, owner notice, no grant', () => {
  const d = decide(truth({ amountAgorot: 100 }), ctx({ order: order() }));
  assert.equal(d.outcome, 'mismatch'); assert.deepEqual(d.ops, []); assert.equal(d.detail, 'amount 100≠2990');
  assert.equal(d.notices[0].kind, 'owner:mismatch');
});

test('decide: paid while the family already has a live plan: duplicate_payment, refund queued, owner notice', () => {
  const d = decide(truth(), ctx({ order: order(), live: sub() }));
  assert.equal(d.outcome, 'duplicate_payment');
  assert.deepEqual(ops(d), ['payment', 'refund', 'order.paid']);
  assert.equal(d.ops[0].row.status, 'duplicate'); assert.equal(d.ops[1].row.reason, 'duplicate'); assert.equal(d.ops[1].row.payment_id, 'pay_new');
  assert.equal(d.notices[0].kind, 'owner:duplicate_payment');
});

test('decide: paid, the order found and the amount matching: a new plan with the period, refund window and welcome', () => {
  const d = decide(truth(), ctx({ order: order() }));
  assert.equal(d.outcome, 'applied'); assert.equal(d.acknowledge, true);
  assert.deepEqual(ops(d), ['sub.insert', 'order.paid', 'payment', 'audit']);
  const row = d.ops[0].row;
  assert.equal(row.current_period_end, '2026-12-10T10:00:00.000Z'); assert.equal(row.refund_until, '2026-11-24T10:00:00.000Z');
  assert.equal(row.price_agorot, 2990); assert.equal(row.first_paid_at, NOW); assert.equal(row.provider_subscription_id, 'ps1');
  assert.equal(d.notices[0].kind, 'welcome');
  const withPeriod = decide(truth({ periodStart: NOW, periodEnd: '2026-12-11T00:00:00.000Z' }), ctx({ order: order() }));
  assert.equal(withPeriod.ops[0].row.current_period_end, '2026-12-11T00:00:00.000Z', 'the period from the truth wins');
  const cls = decide(truth({ amountAgorot: 49000 }), ctx({ order: order({ plan: 'class_year', class_code: 'ABCDEF', seats: 10, amount_agorot: 49000 }), liveTrial: sub({ id: 'tr', plan: 'trial' }) }));
  assert.deepEqual(ops(cls), ['sub.end', 'sub.insert', 'order.paid', 'payment', 'audit']);
  assert.equal(cls.ops[1].row.kind, 'class'); assert.equal(cls.ops[1].row.provider_subscription_id, null);
  assert.equal(cls.ops[1].row.current_period_end, '2027-11-10T10:00:00.000Z');
});

test('decide: a renewal with another amount is a mismatch', () => {
  const d = decide(truth({ orderRef: null, amountAgorot: 1990 }), ctx({ sub: sub() }));
  assert.equal(d.outcome, 'mismatch'); assert.deepEqual(d.ops, []);
});

test('decide: a renewal charged after the cancellation: after_cancel, refund queued, the cancellation kept', () => {
  const d = decide(truth({ orderRef: null }), ctx({ sub: sub({ status: 'canceled', cancel_requested_at: '2026-11-01T00:00:00.000Z' }) }));
  assert.equal(d.outcome, 'after_cancel');
  assert.deepEqual(ops(d), ['payment', 'refund']);
  assert.equal(d.ops[0].row.status, 'after_cancel'); assert.equal(d.ops[1].row.reason, 'after_cancel');
  assert.match(d.notices[0].kind, /^refunded:/);
});

test('decide: a renewal: payment ok, the period extended with MAX, active only when not older than the last event', () => {
  const d = decide(truth({ orderRef: null }), ctx({ sub: sub({ status: 'past_due' }) }));
  assert.equal(d.outcome, 'applied');
  const renew = d.ops.find((o) => o.op === 'sub.renew');
  assert.equal(renew.newEnd, '2026-12-10T10:00:00.000Z'); assert.equal(renew.activate, true);
  const older = decide(truth({ orderRef: null, occurredAt: '2026-10-01T00:00:00.000Z' }), ctx({ sub: sub({ status: 'past_due' }) }));
  const r2 = older.ops.find((o) => o.op === 'sub.renew');
  assert.equal(r2.activate, false, 'an older charge does not flip the status');
  assert.ok(r2.newEnd >= sub().current_period_end, 'never moves the end back');
});

test('decide: failed older than the last event is ignored_old; otherwise past_due and one notice for the period', () => {
  assert.equal(decide(truth({ status: 'failed', occurredAt: '2026-10-01T00:00:00.000Z' }), ctx({ sub: sub() })).outcome, 'ignored_old');
  const d = decide(truth({ status: 'failed' }), ctx({ sub: sub() }));
  assert.equal(d.outcome, 'applied'); assert.deepEqual(ops(d), ['sub.pastDue']);
  assert.equal(d.notices[0].kind, 'payment_failed:2026-11-10T10:00:00.000Z');
  assert.equal(d.notices[0].params.until, '2026-11-13T10:00:00.000Z', 'the grace days');
});

test('decide: canceled at the provider: cancel at the period end and keep the first moment of notice', () => {
  const d = decide(truth({ status: 'canceled' }), ctx({ sub: sub() }));
  assert.equal(d.outcome, 'applied'); assert.deepEqual(ops(d), ['sub.providerCancel', 'audit']);
  assert.match(d.notices[0].kind, /^canceled:/);
  const known = decide(truth({ status: 'canceled' }), ctx({ sub: sub({ cancel_requested_at: '2026-11-01T00:00:00.000Z' }) }));
  assert.deepEqual(known.notices, [], 'already confirmed when the payer cancelled here');
});

test('decide: refunded: a negative payment never more than the charge; a full refund of the latest charge ends the plan', () => {
  const charge = { id: 'c1', amount_agorot: 2990, subscription_id: 's1', order_id: 'o1' };
  const d = decide(truth({ status: 'refunded', amountAgorot: 99999 }), ctx({ sub: sub(), charge, latestCharge: charge }));
  assert.equal(d.outcome, 'applied');
  assert.equal(d.ops[0].row.amount_agorot, -2990); assert.equal(d.ops[0].row.kind, 'refund');
  const end = d.ops.find((o) => o.op === 'sub.end');
  assert.equal(end.reason, 'refunded'); assert.equal(end.end, NOW);
  const partial = decide(truth({ status: 'refunded', amountAgorot: 1000 }), ctx({ sub: sub(), charge, latestCharge: charge }));
  assert.equal(partial.ops.find((o) => o.op === 'sub.end'), undefined);
  assert.equal(decide(truth({ status: 'refunded' }), ctx({ sub: sub() })).outcome, 'unknown', 'no such charge');
});

test('decide: chargeback: a negative payment, the plan ended and the account on hold', () => {
  const charge = { id: 'c1', amount_agorot: 2990, subscription_id: 's1', order_id: 'o1' };
  const d = decide(truth({ status: 'chargeback' }), ctx({ sub: sub(), charge }));
  assert.deepEqual(ops(d), ['payment', 'sub.end', 'hold', 'audit']);
  assert.equal(d.ops[0].row.kind, 'chargeback'); assert.equal(d.ops[1].reason, 'chargeback'); assert.equal(d.ops[2].accountId, 'a1');
});

test('decide: no order and no subscription is unknown; an unknown transaction is unknown', () => {
  assert.equal(decide(truth({ orderRef: null }), ctx()).outcome, 'unknown');
  assert.equal(decide(null, ctx()).outcome, 'unknown');
  assert.equal(decide(truth(), ctx({ order: order(), paymentExists: true })).outcome, 'ignored_old');
});

test('cleanDetail keeps no address and no long number', () => {
  assert.equal(cleanDetail('from a@b.c paid 123456789012'), 'from a at b.c paid #');
  assert.equal(cleanDetail('x'.repeat(300)).length, 200);
});
