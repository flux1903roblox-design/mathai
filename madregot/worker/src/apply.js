// What one provider event does to our records, decided without touching the database (pure, unit-tested).
// The input is the truth pulled from the provider (never the webhook body) and a snapshot of our rows; the output is a
// list of writes that billing.js applies in one batch, behind the billing_events row (spec §6.4).
//
//   truth = { status: paid|failed|canceled|refunded|chargeback, mode, currency, amountAgorot, orderRef,
//             providerPaymentId, providerSubscriptionId, periodStart, periodEnd, occurredAt, invoiceUrl }
//   ctx   = { mode, now, provider, eventId, graceDays, order, sub, live, liveTrial, liveOther, charge, latestCharge,
//             chargeRefunds, chargebackExists, paymentExists, ids: { sub, payment } }
//   (liveOther: another running plan of the same family or class, for a renewal of an ended plan; chargeRefunds: the
//   refunds already recorded against the charge, so a repeated or second refund report never clashes or double-counts)
import { tzOffsetMinutes } from './util.js';

export const PLAN_MONTHS = { family_month: 1, family_year: 12, class_year: 12, term: 12, trial: 0 };
export const REFUND_DAYS = 14;
const DAY = 864e5;

/**
 * Add calendar months in Asia/Jerusalem, keeping the time of day and clamping the day to the month's last day
 * (31 January + 1 month = 28 or 29 February).
 */
export function addMonths(iso, months) {
  const t = Date.parse(iso);
  const off = tzOffsetMinutes(new Date(t));
  const local = new Date(t + off * 60_000);
  const y = local.getUTCFullYear(); const m = local.getUTCMonth() + months;
  const ty = y + Math.floor(m / 12); const tm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const localMs = Date.UTC(ty, tm, Math.min(local.getUTCDate(), last), local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds());
  let o2 = tzOffsetMinutes(new Date(localMs - off * 60_000));
  o2 = tzOffsetMinutes(new Date(localMs - o2 * 60_000));
  return new Date(localMs - o2 * 60_000).toISOString();
}

const iso = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const maxIso = (...v) => v.filter(Boolean).sort().at(-1) || null;
const minIso = (...v) => v.filter(Boolean).sort()[0] || null;
/** An end date for a plan ending at `at`: never later than its period end, always after its start (a CHECK). */
export const endAt = (sub, at) => maxIso(minIso(sub.current_period_end, at), new Date(Date.parse(sub.current_period_start) + 1000).toISOString());
/** A short reason for billing_events.detail: no address, no long number, at most 200 characters. */
export const cleanDetail = (s) => String(s || '').replace(/@/g, ' at ').replace(/\d{8,}/g, '#').slice(0, 200);

const ownerN = (ctx, what, params) => ({ ref: ctx.eventId, kind: `owner:${what}`, to: null, params });
const audit = (ctx, action, target, detail) => ({ op: 'audit', row: { at: ctx.now, actor: `provider:${ctx.provider}`, action, target, detail: JSON.stringify(detail || {}) } });
const payment = (ctx, truth, { kind = 'charge', amount, status = 'ok', sub, order, periodEnd = null, at, ppid }) => ({
  op: 'payment',
  row: {
    id: ctx.ids.payment, provider: ctx.provider, provider_payment_id: ppid || truth.providerPaymentId || `${ctx.eventId}`, kind,
    subscription_id: sub || null, order_id: order || null, amount_agorot: amount, status, period_end: periodEnd,
    invoice_url: truth.invoiceUrl || null, occurred_at: at, recorded_at: ctx.now,
  },
});
const refundRow = (ctx, { sub, amount, reason, paymentId }) => ({
  op: 'refund', row: { subscription_id: sub, payment_id: paymentId || null, amount_agorot: amount, reason, requested_at: ctx.now },
});
/** The provider must stop charging this plan: the hourly retryCancels tells it (cancel_requested_at, set once). */
const stopCharging = (ctx, id) => ({ op: 'sub.stopCharging', id, now: ctx.now });
/** A charge we keep no access for: recorded as `status`, refunded in full, the owner told. */
function giveBackCharge(ctx, truth, done, { outcome, status, reason, sub, order, amount, at, detail, owner, ops = [], notices = [] }) {
  return done(outcome, detail, {
    subscriptionId: sub,
    ops: [
      payment(ctx, truth, { amount, status, sub, order: order || null, at }),
      refundRow(ctx, { sub, amount, reason, paymentId: ctx.ids.payment }),
      ...ops,
    ],
    notices: [...notices, ownerN(ctx, owner, { subscription: sub, order: order || null, amountAgorot: amount })],
  });
}
/** The key of a refund row: the charge's id, plus the provider's refund id when it gives one (several partial refunds). */
export const refundKey = (charge, truth) => (truth.providerRefundId ? `${charge.provider_payment_id}:r:${truth.providerRefundId}` : charge.provider_payment_id);

/** Decide what one pulled truth does. Returns { outcome, detail, subscriptionId, amount, ops[], notices[], acknowledge }. */
export function decide(truth, ctx) {
  const out = { outcome: 'unknown', detail: '', subscriptionId: ctx.sub?.id || null, amount: truth ? Number(truth.amountAgorot) || null : null, ops: [], notices: [], acknowledge: false };
  const done = (outcome, detail = '', more = {}) => ({ ...out, ...more, outcome, detail: cleanDetail(detail) });
  if (!truth) return done('unknown', 'no such transaction at the provider');
  if (truth.mode !== ctx.mode) return done('test_mode', `mode ${truth.mode} in ${ctx.mode}`, { notices: [ownerN(ctx, 'test_mode', { mode: truth.mode })] });
  if (truth.currency !== 'ILS') return done('mismatch', `currency ${String(truth.currency).slice(0, 8)}`, { notices: [ownerN(ctx, 'mismatch', { currency: String(truth.currency).slice(0, 8) })] });
  const at = iso(truth.occurredAt) || ctx.now;
  const amount = Math.round(Number(truth.amountAgorot) || 0);
  const { order, sub } = ctx;

  if (truth.status === 'paid') {
    if (ctx.paymentExists) return done('ignored_old', 'payment already recorded');
    if (order && order.status !== 'paid') return firstPayment(truth, ctx, order, at, amount, done);
    // a further charge for an order that was already paid: a class licence never renews, and a charge from another
    // standing order is not this plan's renewal, so it is a second payment for the same thing and goes back
    if (order && sub && (order.plan === 'class_year' || (truth.providerSubscriptionId || null) !== (sub.provider_subscription_id || null))) {
      if (amount !== order.amount_agorot) {
        return done('mismatch', `amount ${amount}≠${order.amount_agorot}`, { notices: [ownerN(ctx, 'mismatch', { order: order.id, amountAgorot: amount, expected: order.amount_agorot })] });
      }
      return giveBackCharge(ctx, truth, done, { outcome: 'duplicate_payment', status: 'duplicate', reason: 'duplicate', sub: sub.id, order: order.id, amount, at, detail: 'order already paid', owner: 'duplicate_payment' });
    }
    if (sub) return renewal(truth, ctx, sub, at, amount, done);
    if (order && ctx.live) {
      // another payment for an order that was already paid: give it back
      return done('duplicate_payment', 'order already paid', {
        subscriptionId: ctx.live.id,
        ops: [payment(ctx, truth, { amount, status: 'duplicate', sub: ctx.live.id, order: order.id, at }), refundRow(ctx, { sub: ctx.live.id, amount, reason: 'duplicate', paymentId: ctx.ids.payment })],
        notices: [ownerN(ctx, 'duplicate_payment', { order: order.id, amountAgorot: amount })],
      });
    }
    return done('unknown', 'no order and no subscription');
  }

  if (truth.status === 'failed') {
    if (!sub) return order ? done('applied', 'checkout payment failed') : done('unknown', 'no subscription');
    if (sub.last_event_at && at < sub.last_event_at) return done('ignored_old', 'older than the last event');
    const until = new Date(Date.parse(sub.current_period_end) + (ctx.graceDays || 0) * DAY).toISOString();
    return done('applied', 'payment failed', {
      ops: [{ op: 'sub.pastDue', id: sub.id, lastEventAt: maxIso(sub.last_event_at, at) }],
      notices: sub.status === 'active' || sub.status === 'past_due'
        ? [{ ref: sub.id, kind: `payment_failed:${sub.current_period_end}`, to: sub.account_id, params: { until } }] : [],
    });
  }

  if (truth.status === 'canceled') {
    if (!sub) return done('unknown', 'no subscription');
    const requestedAt = sub.cancel_requested_at || at;
    return done('applied', 'canceled at the provider', {
      ops: [{ op: 'sub.providerCancel', id: sub.id, at, now: ctx.now }, audit(ctx, 'subscription.cancel', `sub:${sub.id}`, { by: 'provider' })],
      notices: sub.cancel_requested_at ? [] : [{ ref: sub.id, kind: `canceled:${requestedAt}`, to: sub.account_id, params: { requestedAt, endsAt: sub.current_period_end, refundAgorot: 0, reference: null } }],
    });
  }

  if (truth.status === 'refunded') {
    const charge = ctx.charge;
    if (!charge) return done('unknown', 'no such charge');
    const target = sub || null;
    // Providers often report one refund more than once (created, then succeeded). A refund already recorded under its
    // key is a repeat; without a refund id from the provider, one refund per charge is recorded, and a second report
    // with another amount is left to the owner.
    const keyOf = refundKey(charge, truth);
    const before = ctx.chargeRefunds || [];
    if (before.some((r) => r.provider_payment_id === keyOf)) {
      const same = before.some((r) => r.provider_payment_id === keyOf && Math.abs(r.amount_agorot) === Math.abs(amount));
      return done('ignored_old', 'refund already recorded', { notices: same ? [] : [ownerN(ctx, 'refund_unmatched', { charge: charge.id, amountAgorot: Math.abs(amount) })] });
    }
    const refundedBefore = before.reduce((n, r) => n + Math.abs(r.amount_agorot), 0);
    const left = charge.amount_agorot - refundedBefore;
    const refunded = Math.min(Math.abs(amount), left);
    if (refunded <= 0) return done('ignored_old', 'nothing left to refund', { notices: [ownerN(ctx, 'refund_unmatched', { charge: charge.id, amountAgorot: Math.abs(amount) })] });
    const full = refundedBefore + refunded >= charge.amount_agorot && (!ctx.latestCharge || ctx.latestCharge.id === charge.id);
    const ops = [payment(ctx, truth, { kind: 'refund', amount: -refunded, sub: charge.subscription_id, order: charge.order_id, at, ppid: keyOf })];
    // a plan refunded in full ends, and the provider is told to stop its standing order
    if (full && target && target.status !== 'ended') ops.push({ op: 'sub.end', id: target.id, reason: 'refunded', end: endAt(target, at), now: ctx.now, stop: true });
    ops.push(audit(ctx, 'refund', `sub:${charge.subscription_id}`, { amountAgorot: refunded }));
    return done('applied', full ? 'full refund' : 'partial refund', {
      subscriptionId: charge.subscription_id, amount: -refunded, ops,
      notices: target?.account_id ? [{ ref: target.id, kind: `refunded:${ctx.ids.payment}`, to: target.account_id, params: { amountAgorot: refunded } }] : [],
    });
  }

  if (truth.status === 'chargeback') {
    const charge = ctx.charge;
    const target = sub || null;
    if (!charge && !target) return done('unknown', 'no such charge');
    // a dispute is reported more than once (opened, closed): the first report did everything
    if (charge && ctx.chargebackExists) return done('ignored_old', 'chargeback already recorded');
    const ops = [];
    if (charge) ops.push(payment(ctx, truth, { kind: 'chargeback', amount: -Math.min(Math.abs(amount) || charge.amount_agorot, charge.amount_agorot), sub: charge.subscription_id, order: charge.order_id, at }));
    if (target && target.status !== 'ended') ops.push({ op: 'sub.end', id: target.id, reason: 'chargeback', end: endAt(target, ctx.now), now: ctx.now, stop: true });
    if (target?.account_id) ops.push({ op: 'hold', accountId: target.account_id, at: ctx.now });
    ops.push(audit(ctx, 'subscription.chargeback', `sub:${target?.id || charge.subscription_id}`, {}));
    return done('applied', 'chargeback', { subscriptionId: target?.id || charge?.subscription_id || null, ops, notices: [ownerN(ctx, 'chargeback', { subscription: target?.id || null })] });
  }
  return done('unknown', `type ${String(truth.status).slice(0, 20)}`);
}

function firstPayment(truth, ctx, order, at, amount, done) {
  if (amount !== order.amount_agorot) {
    return done('mismatch', `amount ${amount}≠${order.amount_agorot}`, { notices: [ownerN(ctx, 'mismatch', { order: order.id, amountAgorot: amount, expected: order.amount_agorot })] });
  }
  const family = order.plan !== 'class_year';
  if (family && !order.account_id) {
    // The account was deleted before its order was paid: nobody can use or cancel a plan with no account. The charge
    // is kept on an ended plan (so a later charge from the same standing order is refunded too), refunded in full,
    // and the provider is told to stop charging.
    const end = new Date(Date.parse(at) + 1000).toISOString();
    const row = {
      id: ctx.ids.sub, kind: 'family', account_id: null, class_code: null, plan: order.plan, status: 'ended', provider: ctx.provider,
      provider_subscription_id: truth.providerSubscriptionId || null, price_agorot: order.amount_agorot, seats: null, invoice_ref: null,
      current_period_start: at, current_period_end: end, cancel_at_period_end: 1, cancel_requested_at: ctx.now, ended_reason: 'account_deleted',
      first_paid_at: at, refund_until: null, last_event_at: at, note: null, created_at: ctx.now, updated_at: ctx.now,
    };
    const d = giveBackCharge(ctx, truth, done, {
      outcome: 'after_cancel', status: 'after_cancel', reason: 'after_cancel', sub: row.id, order: order.id, amount, at,
      detail: 'paid after the account was deleted', owner: 'orphan_payment',
      ops: [{ op: 'order.paid', id: order.id, subscriptionId: row.id, at }],
    });
    return { ...d, ops: [{ op: 'sub.insert', row }, ...d.ops] };
  }
  if (ctx.live) {
    return done('duplicate_payment', 'a plan is already live', {
      subscriptionId: ctx.live.id,
      ops: [
        payment(ctx, truth, { amount, status: 'duplicate', sub: ctx.live.id, order: order.id, at }),
        refundRow(ctx, { sub: ctx.live.id, amount, reason: 'duplicate', paymentId: ctx.ids.payment }),
        { op: 'order.paid', id: order.id, subscriptionId: null, at },
      ],
      notices: [ownerN(ctx, 'duplicate_payment', { order: order.id, amountAgorot: amount })],
    });
  }
  const months = PLAN_MONTHS[order.plan] || 1;
  const start = iso(truth.periodStart) || at;
  const end = iso(truth.periodEnd) || addMonths(at, months);
  const row = {
    id: ctx.ids.sub, kind: family ? 'family' : 'class', account_id: order.account_id || null, class_code: family ? null : order.class_code,
    plan: order.plan, status: 'active', provider: ctx.provider,
    provider_subscription_id: family ? (truth.providerSubscriptionId || null) : null,
    price_agorot: order.amount_agorot, seats: family ? null : order.seats, invoice_ref: null,
    current_period_start: start, current_period_end: end > start ? end : addMonths(start, months || 1),
    cancel_at_period_end: 0, cancel_requested_at: null, ended_reason: null, first_paid_at: at, refund_until: new Date(Date.parse(at) + REFUND_DAYS * DAY).toISOString(), last_event_at: at,
    note: null, created_at: ctx.now, updated_at: ctx.now,
  };
  const ops = [];
  // a paid class licence replaces a running trial of the same class
  if (!family && ctx.liveTrial) ops.push({ op: 'sub.end', id: ctx.liveTrial.id, reason: 'expired', end: endAt(ctx.liveTrial, ctx.now), now: ctx.now });
  ops.push(
    { op: 'sub.insert', row },
    { op: 'order.paid', id: order.id, subscriptionId: row.id, at },
    payment(ctx, truth, { amount, sub: row.id, order: order.id, periodEnd: row.current_period_end, at }),
    audit(ctx, family ? 'subscription.start' : 'licence.grant', family ? `sub:${row.id}` : `class:${row.class_code}`, { plan: order.plan, amountAgorot: amount }),
  );
  return done('applied', `start ${order.plan}`, {
    subscriptionId: row.id, ops, acknowledge: true,
    notices: order.account_id ? [{ ref: row.id, kind: 'welcome', to: order.account_id, params: { plan: order.plan, priceAgorot: amount, periodEnd: row.current_period_end } }] : [],
  });
}

function renewal(truth, ctx, sub, at, amount, done) {
  if (amount !== sub.price_agorot) {
    return done('mismatch', `amount ${amount}≠${sub.price_agorot}`, { notices: [ownerN(ctx, 'mismatch', { subscription: sub.id, amountAgorot: amount, expected: sub.price_agorot })] });
  }
  const parentNotice = (reason) => (sub.account_id ? [{ ref: sub.id, kind: `refunded:${ctx.ids.payment}`, to: sub.account_id, params: { amountAgorot: amount, reason } }] : []);
  if (sub.cancel_requested_at && at > sub.cancel_requested_at) {
    return giveBackCharge(ctx, truth, done, {
      outcome: 'after_cancel', status: 'after_cancel', reason: 'after_cancel', sub: sub.id, amount, at,
      detail: 'charged after the cancellation', owner: 'after_cancel', notices: parentNotice('החיוב היה אחרי הביטול.'),
    });
  }
  // A plan that ended for any reason but a failed payment (a refund, a chargeback, the owner, a deleted account, the
  // provider) never comes back by a charge: the charge is refunded, and the provider is told to stop charging.
  if (sub.status === 'ended' && sub.ended_reason !== 'payment_failed') {
    return giveBackCharge(ctx, truth, done, {
      outcome: 'after_cancel', status: 'after_cancel', reason: 'after_cancel', sub: sub.id, amount, at,
      detail: `charged after the plan ended (${String(sub.ended_reason || '').slice(0, 20)})`, owner: 'after_cancel',
      ops: [stopCharging(ctx, sub.id)], notices: parentNotice('החיוב היה אחרי שהמנוי הסתיים.'),
    });
  }
  const months = PLAN_MONTHS[sub.plan] || 1;
  const candidate = iso(truth.periodEnd) || addMonths(maxIso(sub.current_period_end, at), months);
  const newEnd = maxIso(sub.current_period_end, candidate);
  const extended = newEnd > sub.current_period_end;
  const newer = !sub.last_event_at || at >= sub.last_event_at;
  const activate = newer && (sub.status === 'past_due' || (sub.status === 'ended' && sub.ended_reason === 'payment_failed'));
  // A late charge on a plan that ended for a failed payment, after the family (or class) took a new plan: two plans
  // cannot both run, so the late charge is a second payment. It goes back, and its standing order is stopped.
  if (activate && sub.status === 'ended' && ctx.liveOther && ctx.liveOther.id !== sub.id) {
    return giveBackCharge(ctx, truth, done, {
      outcome: 'duplicate_payment', status: 'duplicate', reason: 'duplicate', sub: sub.id, amount, at,
      detail: 'late charge on an ended plan; a newer plan is live', owner: 'duplicate_payment', ops: [stopCharging(ctx, sub.id)],
    });
  }
  return done('applied', 'renewal', {
    ops: [
      payment(ctx, truth, { amount, sub: sub.id, periodEnd: newEnd, at }),
      { op: 'sub.renew', id: sub.id, newEnd, newStart: extended ? (iso(truth.periodStart) || sub.current_period_end) : sub.current_period_start, activate, lastEventAt: maxIso(sub.last_event_at, at), now: ctx.now },
    ],
  });
}
