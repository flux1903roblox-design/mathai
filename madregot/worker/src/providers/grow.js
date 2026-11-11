// Grow (formerly Meshulam), the Israeli payment company (PARENTS-11): a hosted Hebrew payment page (card, Bit, Apple Pay,
// Google Pay), standing orders (הוראת קבע) for the monthly plan, refunds, and a receipt or tax invoice that Grow emails to
// the payer for every charge. BILLING_PROVIDER = "grow" turns it on; the owner's steps are in SUBSCRIPTION.md ("Grow").
//
// Nothing in Grow's callback is trusted. The callback is unsigned and carries the payer's name, phone, email and card
// digits: parse() keeps only ids and codes (clipped, [A-Za-z0-9:_-] only) and drops the rest before anything is stored or
// logged; fetchTruth() then pulls the state from Grow with our own credentials (getTransactionInfo, else
// getPaymentProcessInfo). A lost or repeated callback changes nothing (billing.js skips a seen eventId; the truth decides).
// No call ever logs a body or a field: only "grow: <method> failed" and Grow's status.
//
// Server calls: POST multipart/form-data to <base><method>, base = GROW_API_BASE (the live base the owner copies from
// Grow's "live environment" page, ending with /), or, only when BILLING_MODE = "test", the sandbox below. Every call
// carries userId (GROW_USER_ID) and, when Grow issued one, apiKey (GROW_API_KEY). The answer is { status, err, data }:
// status 1 is success.
//   createPaymentProcess  pageCode (GROW_PAGE_CODE_RECURRING for the monthly plan, GROW_PAGE_CODE_ONCE otherwise), sum,
//                         description, successUrl, cancelUrl, notifyUrl, cField1 (our order id), pageField[email] (Grow
//                         sends its receipt there). No name or phone is sent: Grow's page asks the payer. The standing
//                         order's period is the recurring page's own setting at Grow (monthly, no end).
//   approveTransaction    after a paid callback, with the transaction's ids and codes (never the payer's details). Grow
//                         processes the payment even when this call fails, so a failure is only logged (billing.js).
//   getTransactionInfo    transactionId → statusCode, sum, paymentDate, paymentType, transactionToken, asmachta, cField1
//   getPaymentProcessInfo processId, processToken → the same, for a callback without a transaction
//   refundTransaction     transactionId, transactionToken, refundSum
//   updateDirectDebit     transactionId, transactionToken, asmachta of the standing order's first charge, changeStatus 2
//                         (canceled). Grow enables it on request: GROW_DIRECT_DEBIT_API = "on" once it has; until then the
//                         monthly plan is not sold online (a cancel must be able to stop the standing order).
// The field names come from Grow's reference (developers.grow.business). The parts the owner's sandbox run proves
// before live keys (SUBSCRIPTION.md "Grow", step 4): the recurring page's period, and the callback of a monthly renewal
// carrying cField1, which is how a renewal finds its plan (providerSubscriptionId 'dd:<order id>').
//
// Codes: statusCode 0 not paid, 2 paid, 4 canceled before transmission, 6 refund, 9 denied; paymentType 1 standing
// order, 2 regular, 4 instalments.
import { HttpError } from '../util.js';

export const GROW_SANDBOX = 'https://sandbox.meshulam.co.il/api/light/server/1.0/';
export const GROW_DESCRIPTIONS = {
  family_month: 'מדרגות · מנוי משפחתי חודשי',
  family_year: 'מדרגות · מנוי משפחתי לשנה',
  class_year: 'מדרגות · רישיון כיתה לשנה',
};
const STATUS = { 2: 'paid', 6: 'refunded', 4: 'canceled', 9: 'failed' };
const SAFE = /^[A-Za-z0-9:_-]*$/;
const SUM = /^\d{1,7}(\.\d{1,2})?$/;
const CLIP = 80;

export class GrowError extends Error {
  constructor(method, err) { super(`grow: ${method} failed${err ? ` (${String(err).slice(0, 60)})` : ''}`); this.method = method; }
}

/** The API base: GROW_API_BASE (https, ending with /), else the sandbox in test mode only. null: Grow is off. */
export function growBase(env) {
  const set = String(env.GROW_API_BASE || '').trim();
  if (set) return /^https:\/\/\S+\/$/.test(set) ? set : null;
  return String(env.BILLING_MODE) === 'test' ? GROW_SANDBOX : null;
}
/** Whether the base is Grow's sandbox (a truth from it has mode 'test'). */
const isSandbox = (env) => /sandbox/i.test(growBase(env) || '');

/** One server call: multipart form, 10 seconds at most; the data, or a GrowError (never with the request in it). */
export async function call(env, method, fields = {}, { pageCode } = {}) {
  const base = growBase(env);
  if (!base || !env.GROW_USER_ID) throw new GrowError(method, 'not configured');
  const form = new FormData();
  form.set('userId', String(env.GROW_USER_ID));
  if (pageCode) form.set('pageCode', String(pageCode));
  if (env.GROW_API_KEY) form.set('apiKey', String(env.GROW_API_KEY));
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.set(k, String(v));
  let res; let body;
  try {
    res = await fetch(`${base}${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(10_000) });
    body = await res.json();
  } catch {
    console.error(`grow: ${method} failed`, res?.status || 'no answer');
    throw new GrowError(method);
  }
  if (Number(body?.status) !== 1) {
    console.error(`grow: ${method} failed`, res.status);
    throw new GrowError(method, body?.err);
  }
  return body.data || {};
}

/** A value from Grow kept only when it is short and plain (ids, tokens, codes); else undefined. */
const clean = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v);
  return s.length <= CLIP && SAFE.test(s) ? s : undefined;
};
/** Grow's callback body (JSON { status, err, data } or form fields data[...]) as one flat object of its data. */
function callbackData(raw, headers) {
  const type = String(headers?.get?.('Content-Type') || '');
  if (!type.includes('json')) {
    const p = new URLSearchParams(raw);
    if ([...p.keys()].length) {
      const d = {};
      for (const [k, v] of p) {
        const m = /^data\[([A-Za-z0-9_]+)\](?:\[([A-Za-z0-9_]+)\])?$/.exec(k) || /^([A-Za-z0-9_]+)$/.exec(k);
        if (!m) continue;
        if (m[2]) { d[m[1]] = d[m[1]] && typeof d[m[1]] === 'object' ? d[m[1]] : {}; d[m[1]][m[2]] = v; } else d[m[1]] = v;
      }
      return d;
    }
  }
  try {
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? (j.data && typeof j.data === 'object' ? j.data : j) : {};
  } catch { return {}; }
}
const orderOf = (d) => (d.customFields && typeof d.customFields === 'object' ? d.customFields.cField1 : undefined) ?? d.cField1;
/** A standing order is known by the order it was made for: every monthly charge of it carries that order's cField1. */
const standingOrderId = (d, orderRef) => (Number(d.paymentType) === 1 && orderRef ? `dd:${orderRef}` : null);
/** Grow's dd/mm/yy (Jerusalem) as an ISO time at noon there, or null. */
function paymentDate(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(v || '').trim());
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const t = Date.UTC(y, Number(m[2]) - 1, Number(m[1]), 10);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Whether the monthly plan can be sold: Grow must have enabled updateDirectDebit (a cancel stops the standing order). */
const directDebit = (env) => String(env.GROW_DIRECT_DEBIT_API || 'off').trim().toLowerCase() === 'on';
/** The plans that are a standing order (the rest are one charge). */
export const RECURRING_PLANS = ['family_month'];

const grow = {
  id: 'grow',
  capabilities: { online: true, cancelApi: false, refundApi: true, resumeApi: false, portal: false, signedWebhooks: false },
  /** The capabilities for this deployment: cancelApi only once Grow enabled updateDirectDebit. */
  capabilitiesOf(env) { return { ...grow.capabilities, cancelApi: directDebit(env) }; },
  /**
   * Plans sold online here: the class licence (one charge, it never renews) always; the monthly plan (a standing order)
   * once Grow enabled updateDirectDebit. The yearly family plan stays off here: the family lane wrote this adapter when
   * that plan still renewed. On the main branch it is TRUST-10's one-year plan that never renews (one charge, like the
   * class licence); selling it through Grow, with its renewal and the /parents line for one-time plans, is a follow-up.
   */
  planOnline(env, plan) { return plan === 'class_year' || (plan === 'family_month' && directDebit(env)); },
  enabled: (env) => !!(env.GROW_USER_ID && env.GROW_PAGE_CODE_ONCE && growBase(env)),

  async createCheckout(env, { order, plan, customerEmail, returnUrl, cancelUrl, notifyUrl }) {
    const recurring = RECURRING_PLANS.includes(plan);
    const pageCode = recurring ? env.GROW_PAGE_CODE_RECURRING : env.GROW_PAGE_CODE_ONCE;
    if (!pageCode || !grow.planOnline(env, plan)) throw new HttpError(501, 'checkout_not_configured');
    let data;
    try {
      data = await call(env, 'createPaymentProcess', {
        sum: (order.amount_agorot / 100).toFixed(2),
        description: GROW_DESCRIPTIONS[plan] || 'מדרגות',
        successUrl: returnUrl, cancelUrl, notifyUrl,
        cField1: order.id,
        'pageField[email]': customerEmail,
      }, { pageCode });
    } catch (e) {
      if (e instanceof GrowError) throw new HttpError(502, 'checkout_unavailable');
      throw e;
    }
    return { url: String(data.url || ''), providerCheckoutId: `${data.processId}:${data.processToken}` };
  },

  /** The path secret is checked already. With WEBHOOK_ALLOWED_IPS set, the callback must come from one of them. */
  async verify(env, req) {
    const allowed = String(env.WEBHOOK_ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(String(req.headers.get('CF-Connecting-IP') || ''))) throw new HttpError(401, 'bad_signature');
  },

  /** At most one hint, of ids and codes only: the payer's name, phone, email and card never pass this function. */
  parse(env, raw, headers) {
    const d = callbackData(raw, headers);
    const type = STATUS[Number(d.statusCode)];
    if (!type) return [];
    const ids = {
      transactionId: clean(d.transactionId), transactionToken: clean(d.transactionToken), processId: clean(d.processId),
      processToken: clean(d.processToken), order: clean(orderOf(d)), asmachta: clean(d.asmachta),
      sum: d.sum === undefined || d.sum === null || d.sum === '' ? null : SUM.test(String(d.sum)) ? String(d.sum) : undefined,
      paymentType: clean(d.paymentType), transactionTypeId: clean(d.transactionTypeId), statusCode: clean(d.statusCode),
    };
    if (Object.values(ids).some((v) => v === undefined)) return [];
    if (!ids.transactionId && !ids.processId) return [];
    const sub = standingOrderId(d, ids.order);
    return [{
      eventId: `grow:${ids.transactionId || ids.processId}:${ids.statusCode}`,
      type,
      providerPaymentId: ids.transactionId,
      providerSubscriptionId: sub,
      orderRef: ids.order,
      process: ids.processId ? { id: ids.processId, token: ids.processToken || '' } : null,
      ack: ids.transactionId ? {
        transactionId: ids.transactionId, transactionToken: ids.transactionToken || '', processId: ids.processId || '', processToken: ids.processToken || '',
        sum: ids.sum || '', paymentType: ids.paymentType || '', transactionTypeId: ids.transactionTypeId || '', asmachta: ids.asmachta || '',
      } : null,
      occurredAt: new Date().toISOString(),
    }];
  },

  /** The state of the payment as Grow says it now (null: not settled yet, try later is the decision of apply.js). */
  async fetchTruth(env, hint) {
    let d;
    if (hint.providerPaymentId) d = await call(env, 'getTransactionInfo', { transactionId: hint.providerPaymentId });
    else {
      let p = hint.process;
      if (!p?.token && hint.orderRef) {
        const o = await env.DB.prepare('SELECT provider_checkout_id FROM orders WHERE id = ?').bind(hint.orderRef).first();
        const [id, token] = String(o?.provider_checkout_id || '').split(':');
        if (id) p = { id, token: token || '' };
      }
      if (!p?.id) return null;
      d = await call(env, 'getPaymentProcessInfo', { processId: p.id, processToken: p.token });
    }
    const status = STATUS[Number(d.statusCode)];
    if (!status) return null;
    const orderRef = clean(orderOf(d)) || hint.orderRef || null;
    return {
      status,
      mode: isSandbox(env) ? 'test' : 'live',
      currency: 'ILS',
      amountAgorot: Math.round(Number(d.sum) * 100) || 0,
      orderRef,
      providerPaymentId: clean(d.transactionId) || hint.providerPaymentId || null,
      providerSubscriptionId: standingOrderId(d, orderRef) || hint.providerSubscriptionId || null,
      providerRefundId: null,
      occurredAt: paymentDate(d.paymentDate) || new Date().toISOString(),
      periodStart: null,
      periodEnd: null,
      invoiceUrl: null,
      // for acknowledge() only: billing.js strips it before anything is stored
      ack: hint.ack || null,
    };
  },

  async acknowledge(env, truth) {
    if (!truth?.ack?.transactionId) return;
    const pageCode = truth.providerSubscriptionId ? env.GROW_PAGE_CODE_RECURRING : env.GROW_PAGE_CODE_ONCE;
    await call(env, 'approveTransaction', truth.ack, { pageCode });
  },

  /** Stop the standing order at Grow: its first charge, looked up here, then updateDirectDebit with changeStatus 2. */
  async cancel(env, sub) {
    if (!sub?.provider_subscription_id) return { synced: true }; // a one-time plan: nothing renews
    if (!directDebit(env)) throw new GrowError('updateDirectDebit', 'not enabled');
    const firstCharge = await env.DB.prepare("SELECT provider_payment_id FROM payments WHERE subscription_id = ? AND kind = 'charge' AND provider = 'grow' ORDER BY occurred_at LIMIT 1")
      .bind(sub.id).first();
    if (!firstCharge) throw new GrowError('updateDirectDebit', 'no charge');
    const t = await call(env, 'getTransactionInfo', { transactionId: firstCharge.provider_payment_id });
    await call(env, 'updateDirectDebit', {
      transactionId: firstCharge.provider_payment_id, transactionToken: t.transactionToken, asmachta: t.asmachta, changeStatus: 2,
    });
    return { synced: true };
  },
  async resume() { return { synced: false }; },

  /** A refund of one charge (Bit too); a method Grow will not refund by API goes to the owner. */
  async refund(env, payment, { amountAgorot }) {
    if (!payment?.provider_payment_id) return { refunded: false, manual: true };
    const t = await call(env, 'getTransactionInfo', { transactionId: payment.provider_payment_id });
    let data;
    try {
      data = await call(env, 'refundTransaction', { transactionId: payment.provider_payment_id, transactionToken: t.transactionToken, refundSum: (amountAgorot / 100).toFixed(2) });
    } catch (e) {
      if (e instanceof GrowError && /refund/i.test(e.message) && /not|cannot|לא/i.test(e.message)) return { refunded: false, manual: true };
      throw e;
    }
    return { refunded: true, manual: false, providerRefundId: data.refundTransactionId ? String(data.refundTransactionId) : `${payment.provider_payment_id}:r` };
  },
  async fetchSubscription() { return null; },
  portalUrl() { return null; },
};

export default grow;
