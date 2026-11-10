// The test provider: a rehearsal of the whole payment flow with no payment company. It loads only when
// ALLOW_TEST_BILLING = "true" and BILLING_MODE = "test", and every truth it reports has mode 'test', so it can never
// grant anything in live mode. Its checkout page is GET /api/billing/test-pay/:orderId on this Worker; its events are
// signed: X-Test-Signature: t=<unix>,v1=<hex HMAC-SHA256(TEST_WEBHOOK_SECRET, t + '.' + raw body)>, within 300 s.
// TEST_PROVIDER_FAIL = "cancel,refund,truth" makes those calls fail (for tests of the retry paths).
import { HttpError, hmacHex, safeEqual } from '../util.js';

const fails = (env, what) => String(env.TEST_PROVIDER_FAIL || '').split(',').map((s) => s.trim()).includes(what);
const TYPES = ['paid', 'failed', 'canceled', 'refunded', 'chargeback'];

export const testSignature = async (secret, at, raw) => `t=${at},v1=${await hmacHex(secret, `${at}.${raw}`)}`;

export default {
  id: 'test',
  capabilities: { online: true, cancelApi: true, refundApi: true, resumeApi: true, portal: false, signedWebhooks: true },
  enabled: (env) => String(env.ALLOW_TEST_BILLING) === 'true' && String(env.BILLING_MODE) === 'test',

  async createCheckout(env, { order }) {
    return { url: `${String(env.PUBLIC_URL || '').replace(/\/+$/, '')}/api/billing/test-pay/${order.id}`, providerCheckoutId: `tco_${order.id}` };
  },

  async verify(env, req, raw) {
    const secrets = [env.TEST_WEBHOOK_SECRET, env.TEST_WEBHOOK_SECRET_OLD].filter(Boolean);
    const m = String(req.headers.get('X-Test-Signature') || '').match(/^t=(\d{1,12}),v1=([a-f0-9]{64})$/);
    if (!secrets.length || !m) throw new HttpError(401, 'bad_signature');
    if (Math.abs(Date.now() / 1000 - Number(m[1])) > 300) throw new HttpError(401, 'bad_signature');
    for (const s of secrets) if (safeEqual(await hmacHex(s, `${m[1]}.${raw}`), m[2])) return;
    throw new HttpError(401, 'bad_signature');
  },

  parse(env, raw) {
    let data;
    try { data = JSON.parse(raw); } catch { throw new HttpError(400, 'bad_json'); }
    return (Array.isArray(data) ? data : [data]).slice(0, 20)
      .filter((e) => e && typeof e.id === 'string' && TYPES.includes(e.type))
      .map((e) => ({
        eventId: e.id.slice(0, 80), type: e.type, providerPaymentId: e.payment ? String(e.payment).slice(0, 80) : null,
        providerSubscriptionId: e.subscription ? String(e.subscription).slice(0, 80) : null, orderRef: e.order ? String(e.order).slice(0, 40) : null,
        occurredAt: e.occurredAt || null, event: e,
      }));
  },

  // The signed test event is the truth; its mode is always 'test'.
  async fetchTruth(env, hint) {
    if (fails(env, 'truth')) throw new Error('test provider unreachable');
    const e = hint.event || {};
    return {
      status: hint.type, mode: 'test', currency: e.currency || 'ILS', amountAgorot: Number(e.amountAgorot) || 0,
      orderRef: hint.orderRef, providerPaymentId: hint.providerPaymentId, providerSubscriptionId: hint.providerSubscriptionId,
      periodStart: e.periodStart || null, periodEnd: e.periodEnd || null, occurredAt: e.occurredAt || new Date().toISOString(),
      invoiceUrl: e.invoiceUrl || null,
    };
  },
  async acknowledge() {},
  async cancel(env) { if (fails(env, 'cancel')) throw new Error('test provider cancel failed'); return { synced: true }; },
  async resume(env) { if (fails(env, 'resume')) throw new Error('test provider resume failed'); return { synced: true }; },
  async refund(env, payment, { idempotencyKey }) {
    if (fails(env, 'refund')) throw new Error('test provider refund failed');
    return { refunded: true, manual: false, providerRefundId: `tref_${idempotencyKey}` };
  },
  async fetchSubscription() { return null; },
  portalUrl() { return null; },
};
