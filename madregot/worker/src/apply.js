// What one provider event does to our records, decided without touching the database (pure, unit-tested).
// The input is the truth pulled from the provider (never the webhook body) and a snapshot of our rows; the output is a
// list of writes that billing.js applies in one batch, behind the billing_events row (spec §6.4).
//
//   truth = { status: paid|failed|canceled|refunded|chargeback, mode, currency, amountAgorot, orderRef,
//             providerPaymentId, providerSubscriptionId, periodStart, periodEnd, occurredAt, invoiceUrl }
//   ctx   = { mode, now, provider, eventId, graceDays, order, sub, live, liveTrial, charge, latestCharge,
//             paymentExists, ids: { sub, payment } }
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
const payment = (ctx, truth, { kind = 'charge', amount, status = 'ok', sub, order, periodEnd = null, at }) => ({
  op: 'payment',
  row: {
    id: ctx.ids.payment, provider: ctx.provider, provider_payment_id: truth.providerPaymentId || `${ctx.eventId}`, kind,
    subscription_id: sub || null, order_id: order || null, amount_agorot: amount, status, period_end: periodEnd,
    invoice_url: truth.invoiceUrl || null, occurred_at: at, recorded_at: ctx.now,
  },
});
const refundRow = (ctx, { sub, amount, reason, paymentId }) => ({
  op: 'refund', row: { subscription_id: sub, payment_id: paymentId || null, amount_agorot: amount, reason, requested_at: ctx.now },
});

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
    const refunded = Math.min(Math.abs(amount), charge.amount_agorot);
    const full = refunded >= charge.amount_agorot && (!ctx.latestCharge || ctx.latestCharge.id === charge.id);
    const ops = [payment(ctx, truth, { kind: 'refund', amount: -refunded, sub: charge.subscription_id, order: charge.order_id, at })];
    if (full && target && target.status !== 'ended') ops.push({ op: 'sub.end', id: target.id, reason: 'refunded', end: endAt(target, at), now: ctx.now });
    ops.push(audit(ctx, 'refund', `sub:${charge.subscription_id}`, { amountAgorot: refunded }));
    return done('applied', full ? 'full refund' : 'partial refund', {
      subscriptionId: charge.subscription_id, amount: -refunded, ops,
      notices: target ? [{ ref: target.id, kind: `refunded:${charge.id}`, to: target.account_id, params: { amountAgorot: refunded } }] : [],
    });
  }

  if (truth.status === 'chargeback') {
    const charge = ctx.charge;
    const target = sub || null;
    if (!charge && !target) return done('unknown', 'no such charge');
    const ops = [];
    if (charge) ops.push(payment(ctx, truth, { kind: 'chargeback', amount: -Math.min(Math.abs(amount) || charge.amount_agorot, charge.amount_agorot), sub: charge.subscription_id, order: charge.order_id, at }));
    if (target && target.status !== 'ended') ops.push({ op: 'sub.end', id: target.id, reason: 'chargeback', end: endAt(target, ctx.now), now: ctx.now });
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
  const family = order.plan !== 'class_year';
  const row = {
    id: ctx.ids.sub, kind: family ? 'family' : 'class', account_id: order.account_id || null, class_code: family ? null : order.class_code,
    plan: order.plan, status: 'active', provider: ctx.provider,
    provider_subscription_id: family ? (truth.providerSubscriptionId || null) : null,
    price_agorot: order.amount_agorot, seats: family ? null : order.seats, invoice_ref: null,
    current_period_start: start, current_period_end: end > start ? end : addMonths(start, months || 1),
    first_paid_at: at, refund_until: new Date(Date.parse(at) + REFUND_DAYS * DAY).toISOString(), last_event_at: at,
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
  if (sub.cancel_requested_at && at > sub.cancel_requested_at) {
    return done('after_cancel', 'charged after the cancellation', {
      ops: [
        payment(ctx, truth, { amount, status: 'after_cancel', sub: sub.id, at }),
        refundRow(ctx, { sub: sub.id, amount, reason: 'after_cancel', paymentId: ctx.ids.payment }),
      ],
      notices: [{ ref: sub.id, kind: `refunded:${ctx.ids.payment}`, to: sub.account_id, params: { amountAgorot: amount, reason: 'החיוב היה אחרי הביטול.' } }],
    });
  }
  const months = PLAN_MONTHS[sub.plan] || 1;
  const candidate = iso(truth.periodEnd) || addMonths(maxIso(sub.current_period_end, at), months);
  const newEnd = maxIso(sub.current_period_end, candidate);
  const extended = newEnd > sub.current_period_end;
  const newer = !sub.last_event_at || at >= sub.last_event_at;
  const activate = newer && (sub.status === 'past_due' || (sub.status === 'ended' && sub.ended_reason === 'payment_failed'));
  return done('applied', 'renewal', {
    ops: [
      payment(ctx, truth, { amount, sub: sub.id, periodEnd: newEnd, at }),
      { op: 'sub.renew', id: sub.id, newEnd, newStart: extended ? (iso(truth.periodStart) || sub.current_period_end) : sub.current_period_start, activate, lastEventAt: maxIso(sub.last_event_at, at), now: ctx.now },
    ],
  });
}
