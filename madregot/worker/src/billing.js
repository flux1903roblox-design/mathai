// Paying for the AI tutor: plans and prices (server-side, from vars), checkout, the provider webhook (a hint that makes
// us pull the truth, applied in one atomic batch behind its billing_events row), cancellation (which stands even when
// the provider is down), resume, refunds, and the parent's account page (overview, export, deletion).
import {
  HttpError, body, json, rawBody, sha256, randomToken, nowIso, dayOf, daysAgo, secretEqual, limitOrThrow, isDay,
} from './util.js';
import { requireAccount, requireRecentCode } from './account.js';
import { requireTeacher, limits, paywallOn, parentOkRequired } from './entitle.js';
import { refuseSchoolSale } from './classai.js';
import { decide, endAt, cleanDetail, recurringPlan } from './apply.js';
import { providerById, currentProvider, webhookProvider } from './providers/index.js';
import { testSignature } from './providers/test.js';
import { noticeStmt, ownerNotice, monthSpendUsd } from './spend.js';
import { flushNotices, escapeHtml, shekels } from './email.js';

const DAY = 864e5;
export const ORDER_TTL_MIN = 120;
/**
 * A one-year plan can be renewed by its payer from this many days before its end (trust spec TRUST-10 §3): the
 * year_ending email goes out 30-45 days ahead, and its link opens the renewal.
 */
export const RENEW_DAYS = 45;
export const CHECKOUT_PER_HOUR = 10;
const LIVE_STRICT = "status IN ('active', 'past_due')";
const RUNNING = "status IN ('active', 'past_due', 'canceled')";
const RUNNING_STATUSES = ['active', 'past_due', 'canceled'];

// ---------------------------------------------------------------- plans and prices
const agorot = (env, name, d) => { const v = Number(env[name]); return Number.isInteger(v) && v > 0 ? v : d; };
export function prices(env) {
  return {
    family_month: agorot(env, 'PRICE_FAMILY_MONTH_AGOROT', 2990),
    family_year: agorot(env, 'PRICE_FAMILY_YEAR_AGOROT', 24900),
    seat: agorot(env, 'PRICE_CLASS_SEAT_YEAR_AGOROT', 4900),
  };
}
export const vatExempt = (env) => String(env.VAT_MODE) === 'exempt';
/** The VAT inside a VAT-included price, in whole agorot (0 for an exempt dealer). */
export const vatOf = (env, amount) => (vatExempt(env) ? 0 : Math.round((amount * 18) / 118));
export const termsVersion = (env) => String(env.TERMS_VERSION || '2026-11');
export const SEATS = { min: 10, max: 45 };
const publicUrl = (env) => String(env.PUBLIC_URL || '').replace(/\/+$/, '');

// ---------------------------------------------------------------- the legal gate (trust spec TRUST-2 §5-6, TRUST-13)
/**
 * The vars the legal pages and the checkout disclosure are filled from. Every one must be set before money can be
 * taken: the business (name, number, kind, address), how to reach it, the payment company's name, the date of the
 * legal texts, and where the database is. DB_JURISDICTION must be "eu", the only place the privacy notice has words
 * for (TRUST-15 step 1), so the notice never names a place the database is not in.
 */
export const LEGAL_VARS = Object.freeze([
  'BUSINESS_NAME', 'BUSINESS_ID', 'BUSINESS_KIND', 'BUSINESS_ADDRESS', 'CONTACT_EMAIL', 'CONTACT_PHONE', 'PAYMENT_PROVIDER_NAME', 'LEGAL_DATE', 'DB_JURISDICTION',
]);
const filled = (env, k) => String(env[k] ?? '').trim();
/**
 * The names of the vars that keep the legal gate closed: each LEGAL_VARS entry that is empty or wrong (LEGAL_DATE not a
 * YYYY-MM-DD day, DB_JURISDICTION not "eu"), and LEGAL_APPROVED unless it names the current TERMS_VERSION. The owner's
 * one action after the lawyer's review is LEGAL_APPROVED = "<TERMS_VERSION>"; a new terms version closes the gate again
 * until it is approved too.
 */
export function legalMissing(env) {
  const out = LEGAL_VARS.filter((k) => !filled(env, k));
  if (filled(env, 'LEGAL_DATE') && !isDay(filled(env, 'LEGAL_DATE'))) out.push('LEGAL_DATE');
  if (filled(env, 'DB_JURISDICTION') && filled(env, 'DB_JURISDICTION') !== 'eu') out.push('DB_JURISDICTION');
  if (filled(env, 'LEGAL_APPROVED') !== termsVersion(env)) out.push('LEGAL_APPROVED');
  return out;
}
/** The lawyer-approved texts are live and every detail they quote is set: online checkout may open. */
export const legalReady = (env) => legalMissing(env).length === 0;

/**
 * Online sign-up opens only when the switch is on, the legal texts are approved (legalReady), and the provider can both
 * take payments and cancel them online.
 */
export function onlineCheckout(env) {
  const p = currentProvider(env);
  return paywallOn(env) && legalReady(env) && !!p && p.capabilities.online && p.capabilities.cancelApi;
}
function checkoutHosts(env) {
  const hosts = String(env.BILLING_CHECKOUT_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  const p = currentProvider(env);
  if (p?.id === 'test' && env.PUBLIC_URL) { try { hosts.push(new URL(env.PUBLIC_URL).host.toLowerCase()); } catch { /* no public url */ } }
  return [...new Set(hosts)];
}

/** GET /api/billing/plans */
export function plansView(env) {
  const pr = prices(env);
  const L = limits(env);
  const p = currentProvider(env);
  return {
    paywall: paywallOn(env), online: onlineCheckout(env), vatMode: vatExempt(env) ? 'exempt' : 'included', vatRate: vatExempt(env) ? 0 : 0.18,
    // a child alone needs a parent's OK for the tutor (trust spec TRUST-9): the parents' page offers the free OK
    parentOk: parentOkRequired(env),
    currency: 'ILS', termsVersion: termsVersion(env), billing: p?.id || null,
    plans: [
      { id: 'family_month', kind: 'family', interval: 'month', amountAgorot: pr.family_month, vatAgorot: vatOf(env, pr.family_month), renews: true },
      // a one-year plan (Consumer Protection Law s.13א, trust spec TRUST-10 §1): it never renews by itself
      { id: 'family_year', kind: 'family', interval: 'year', amountAgorot: pr.family_year, vatAgorot: vatOf(env, pr.family_year), renews: false, termMonths: 12 },
      { id: 'class_year', kind: 'class', interval: 'year', seatAgorot: pr.seat, minSeats: SEATS.min, maxSeats: SEATS.max, renews: false },
    ],
    limits: {
      family: { tutor: L.family.tutor, check: L.family.check, generate: L.family.generate, exam: L.family.exam, examMonthly: L.family.examMonthly, devices: L.family.devices },
      class: { ...L.class.student },
      free: { tutor: L.free.student },
    },
    checkoutHosts: checkoutHosts(env),
    // the details the legal pages and the checkout disclosure quote (TRUST-2 §4-5); the web app fills {{NAME}} from them
    business: {
      name: env.BUSINESS_NAME || '', id: env.BUSINESS_ID || '', kind: env.BUSINESS_KIND || '', address: env.BUSINESS_ADDRESS || '',
      email: env.CONTACT_EMAIL || '', phone: env.CONTACT_PHONE || '', provider: env.PAYMENT_PROVIDER_NAME || '',
    },
    accessibility: {
      name: env.ACCESS_COORD_NAME || '', phone: env.ACCESS_COORD_PHONE || '', email: env.ACCESS_COORD_EMAIL || '',
      date: env.ACCESS_STATEMENT_DATE || '', tested: env.ACCESS_TESTED || '',
    },
    contact: env.CONTACT_EMAIL || '',
    legalDate: env.LEGAL_DATE || '', dbJurisdiction: env.DB_JURISDICTION || '',
    // false until the owner's sign-off (TRUST-13): the legal pages show the draft banner and checkout stays closed
    legalApproved: legalReady(env), legalMissing: legalMissing(env),
  };
}

// ---------------------------------------------------------------- shared queries
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const liveFamilyStrict = (env, accountId) => first(env, `SELECT * FROM subscriptions WHERE kind = 'family' AND account_id = ? AND ${LIVE_STRICT} LIMIT 1`, accountId);
const latestCharge = (env, subId) => first(env, "SELECT * FROM payments WHERE subscription_id = ? AND kind = 'charge' AND status = 'ok' ORDER BY occurred_at DESC LIMIT 1", subId);
const auditStmt = (env, actor, action, target, detail = {}) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(nowIso(), actor, action, target, JSON.stringify(detail));
/** The confirmation number of a cancellation: the same for the same plan and moment of notice. */
export const cancelReference = async (subId, requestedAt) => `C-${(await sha256(`${subId}${requestedAt}`)).slice(0, 4).toUpperCase()}`;

// ---------------------------------------------------------------- checkout
/** POST /api/billing/checkout: an order priced here, then the provider's hosted payment page. */
export async function checkout(req, env, cors) {
  const account = await requireAccount(req, env);
  if (!paywallOn(env)) throw new HttpError(503, 'paywall_off');
  // no money before the lawyer-approved texts are live, for every plan (a school code, licenceClaim, is not gated here)
  if (!legalReady(env)) throw new HttpError(503, 'legal_not_ready');
  const b = await body(req);
  const idem = String(req.headers.get('Idempotency-Key') || '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(idem)) throw new HttpError(400, 'bad_idempotency_key');
  const provider = currentProvider(env);
  // a held account opens no payment page at all, not even for an earlier attempt
  if (account.billingHoldAt) throw new HttpError(403, 'billing_hold');
  if (!provider || !provider.capabilities.online || !provider.capabilities.cancelApi) throw new HttpError(501, 'checkout_not_configured');

  // the same attempt again: the same order and payment page, while that order can still be paid and nothing else is
  // live; a paid or expired order answers 409 order_closed, and the page starts a new attempt with a new key
  const existing = await first(env, 'SELECT * FROM orders WHERE account_id = ? AND idempotency_key = ?', account.id, idem);
  if (existing) {
    if (existing.status !== 'open' || existing.expires_at <= nowIso()) throw new HttpError(409, 'order_closed');
    await refuseLive(env, account, existing.plan, existing.class_code);
    return json({ orderId: existing.id, url: await checkoutUrl(env, provider, existing, account, idem) }, 201, cors);
  }

  const plan = String(b.plan || '');
  if (!['family_month', 'family_year', 'class_year'].includes(plan)) throw new HttpError(422, 'bad_plan');
  let renewal = null;
  if (b.adult !== true) throw new HttpError(400, 'adult_required');
  if (String(b.terms || '') !== termsVersion(env)) throw new HttpError(400, 'terms_required');

  const pr = prices(env);
  let amount; let classCode = null; let seats = null;
  if (plan === 'class_year') {
    const cls = await requireTeacher(req, env);
    // no AI class licence where the Ministry's rules keep student AI off (trust spec TRUST-11 §5): 409 school_ai_not_approved
    await refuseSchoolSale(env, cls);
    seats = Number(b.seats);
    if (!Number.isInteger(seats) || seats < SEATS.min || seats > SEATS.max) throw new HttpError(422, 'bad_plan');
    classCode = cls.code;
    await refuseLive(env, account, plan, classCode);
    amount = seats * pr.seat;
  } else {
    // a one-year plan in its last 45 days: this order renews it (a new consent, TRUST-10 §3)
    renewal = await refuseLive(env, account, plan, null);
    amount = pr[plan];
  }
  await limitOrThrow(env, `checkout:a:${account.id}`, CHECKOUT_PER_HOUR, 429, 'too_many_checkouts', 'hour');

  const now = nowIso();
  const order = {
    id: randomToken(8), account_id: account.id, plan, class_code: classCode, seats, amount_agorot: amount, vat_agorot: vatOf(env, amount),
    provider: provider.id, mode: env.BILLING_MODE === 'test' ? 'test' : 'live', idempotency_key: idem, status: 'open',
    created_at: now, expires_at: new Date(Date.parse(now) + ORDER_TTL_MIN * 60_000).toISOString(),
  };
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE accounts SET adult_confirmed_at = ?, terms_version = ? WHERE id = ?').bind(now, termsVersion(env), account.id),
      env.DB.prepare(
        `INSERT INTO orders (id, account_id, plan, class_code, seats, amount_agorot, vat_agorot, currency, provider, mode, idempotency_key, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ILS', ?, ?, ?, 'open', ?, ?)`,
      ).bind(order.id, order.account_id, plan, classCode, seats, amount, order.vat_agorot, order.provider, order.mode, idem, now, order.expires_at),
      // the plan this order renews and where its paid year ends, written with the order (apply.js renewYear)
      ...(renewal ? [env.DB.prepare('INSERT INTO order_renewals (order_id, subscription_id, prev_start, prev_end) VALUES (?, ?, ?, ?)')
        .bind(order.id, renewal.id, renewal.current_period_start, renewal.current_period_end)] : []),
    ]);
  } catch (e) {
    if (!/UNIQUE/.test(String(e?.message))) throw e;
    const again = await first(env, 'SELECT * FROM orders WHERE account_id = ? AND idempotency_key = ?', account.id, idem);
    if (!again) throw e;
    return json({ orderId: again.id, url: await checkoutUrl(env, provider, again, account, idem) }, 201, cors);
  }
  return json({ orderId: order.id, url: await checkoutUrl(env, provider, order, account, idem) }, 201, cors);
}

/**
 * The one-year plan this checkout may renew (trust spec TRUST-10 §3), or null: an active family_year plan in its last
 * RENEW_DAYS days whose renewal was never taken back (one cooling-off and one pro-rata refund per plan: the second would
 * have nowhere to go). Shared with the account page, so its button and the server agree.
 */
export async function renewable(env, sub, now = nowIso()) {
  if (!sub || sub.kind !== 'family' || sub.plan !== 'family_year' || sub.status !== 'active') return false;
  if (sub.current_period_end <= now || Date.parse(sub.current_period_end) - Date.parse(now) > RENEW_DAYS * DAY) return false;
  return !(await first(env, "SELECT 1 AS x FROM refund_queue WHERE subscription_id = ? AND reason IN ('cooling_off', 'prorata')", sub.id));
}

/**
 * 409 when the plan would run beside one already live: a family plan that is active or past_due (one that is past
 * its period end and grace days is ended here first, as the nightly reconciliation would end it, so the family can
 * join again at once), or a paid class licence. The one exception (TRUST-10 §3): a yearly checkout for a one-year plan
 * in its last 45 days renews it; that plan is returned, so the order records what it renews. → the plan or null.
 */
async function refuseLive(env, account, plan, classCode) {
  if (plan === 'class_year') {
    const lic = await first(env, `SELECT id FROM subscriptions WHERE kind = 'class' AND class_code = ? AND plan != 'trial' AND ${LIVE_STRICT} LIMIT 1`, classCode);
    if (lic) throw new HttpError(409, 'class_has_licence');
    return null;
  }
  const sub = await liveFamilyStrict(env, account.id);
  if (!sub) return null;
  const now = nowIso();
  if (plan === 'family_year' && (await renewable(env, sub, now))) return sub;
  const graceEnd = new Date(Date.parse(sub.current_period_end) + limits(env).graceDays * DAY).toISOString();
  if (graceEnd > now) throw new HttpError(409, 'already_subscribed');
  await env.DB.batch([
    env.DB.prepare("UPDATE subscriptions SET status = 'ended', ended_reason = 'payment_failed', updated_at = ? WHERE id = ? AND status IN ('active', 'past_due') AND current_period_end <= ?")
      .bind(now, sub.id, new Date(Date.parse(now) - limits(env).graceDays * DAY).toISOString()),
    auditStmt(env, `account:${account.id}`, 'subscription.reconcile', `sub:${sub.id}`, { ended: 'payment_failed', at: 'checkout' }),
  ]);
  return null;
}

export async function checkoutUrl(env, provider, order, account, idempotencyKey) {
  if (!provider) throw new HttpError(501, 'checkout_not_configured');
  const base = publicUrl(env);
  const { url, providerCheckoutId } = await provider.createCheckout(env, {
    // a standing order only for the monthly plan (TRUST-10 §1): the one-year plan and a class licence are one charge.
    // An adapter for a real payment company must honour it: no standing order when recurring is false.
    order, plan: order.plan, recurring: recurringPlan(order.plan), customerEmail: account.email, idempotencyKey,
    returnUrl: `${base}/parents?order=${order.id}`, cancelUrl: `${base}/parents`,
    notifyUrl: `${base}/api/billing/webhook/${provider.id}/${env.WEBHOOK_PATH_SECRET || ''}`,
  });
  let host = '';
  try { host = new URL(url).host.toLowerCase(); } catch { /* not a url */ }
  if (!host || !checkoutHosts(env).includes(host)) throw new HttpError(502, 'bad_checkout_url');
  if (providerCheckoutId) await env.DB.prepare('UPDATE orders SET provider_checkout_id = ? WHERE id = ?').bind(providerCheckoutId, order.id).run();
  return url;
}

/** GET /api/billing/orders/:id: the order's own account only. The return URL is never proof of payment. */
export async function orderStatus(id, req, env, cors) {
  const account = await requireAccount(req, env);
  const o = await first(env, 'SELECT * FROM orders WHERE id = ? AND account_id = ?', String(id), account.id);
  if (!o) throw new HttpError(404, 'not_found');
  const status = o.status === 'open' && o.expires_at < nowIso() ? 'expired' : o.status;
  const sub = o.subscription_id ? await first(env, 'SELECT status, current_period_end FROM subscriptions WHERE id = ?', o.subscription_id) : null;
  return json({ status, plan: o.plan, subscription: sub ? { status: sub.status, periodEnd: sub.current_period_end } : null }, 200, cors);
}

// ---------------------------------------------------------------- webhook: verify, pull the truth, apply once
/** POST /api/billing/webhook/:provider/:pathSecret. Never log the URL of this route: the secret is in the path. */
export async function webhook(providerId, pathSecret, req, env, ctx, cors) {
  const provider = webhookProvider(env, providerId);
  const secret = String(env.WEBHOOK_PATH_SECRET || '');
  if (!provider || !/^[a-f0-9]{32,}$/i.test(secret) || !(await secretEqual(pathSecret, secret))) throw new HttpError(404, 'not_found');
  const raw = await rawBody(req, 64 * 1024);
  await provider.verify(env, req, raw);
  const hints = provider.parse(env, raw, req.headers);
  const results = [];
  for (const hint of hints) {
    const seen = await first(env, 'SELECT outcome FROM billing_events WHERE provider = ? AND event_id = ?', provider.id, hint.eventId);
    if (seen) { results.push('duplicate'); continue; }
    let truth;
    try { truth = await provider.fetchTruth(env, hint); } catch (e) {
      console.error('billing: provider unreachable', provider.id);
      throw new HttpError(503, 'retry_later');
    }
    results.push(await applyTruth(env, provider, hint, truth));
  }
  ctx.waitUntil(flushNotices(env));
  return json({ ok: true, results }, 200, cors);
}

async function loadCtx(env, provider, hint, truth) {
  const order = truth?.orderRef ? await first(env, 'SELECT * FROM orders WHERE id = ?', truth.orderRef) : null;
  let sub = truth?.providerSubscriptionId
    ? await first(env, 'SELECT * FROM subscriptions WHERE provider = ? AND provider_subscription_id = ?', provider.id, truth.providerSubscriptionId) : null;
  const charge = truth?.providerPaymentId
    ? await first(env, "SELECT * FROM payments WHERE provider = ? AND provider_payment_id = ? AND kind = 'charge'", provider.id, truth.providerPaymentId) : null;
  if (!sub && order?.subscription_id) sub = await first(env, 'SELECT * FROM subscriptions WHERE id = ?', order.subscription_id);
  if (!sub && charge?.subscription_id && truth.status !== 'paid') sub = await first(env, 'SELECT * FROM subscriptions WHERE id = ?', charge.subscription_id);
  // refunds already recorded against the charge (their key is the charge's id, or '<charge id>:r:<refund id>')
  const chargeRefunds = charge && truth.status === 'refunded'
    ? await all(env, `SELECT provider_payment_id, amount_agorot FROM payments WHERE provider = ? AND kind = 'refund'
        AND (provider_payment_id = ? OR substr(provider_payment_id, 1, ?) = ?)`, provider.id, charge.provider_payment_id, charge.provider_payment_id.length + 3, `${charge.provider_payment_id}:r:`)
    : [];
  const chargebackExists = charge && truth.status === 'chargeback'
    ? !!(await first(env, "SELECT 1 AS x FROM payments WHERE provider = ? AND provider_payment_id = ? AND kind = 'chargeback'", provider.id, charge.provider_payment_id))
    : false;
  // a renewal of an ended plan: is another plan of the same family or class running now?
  let liveOther = null;
  if (truth?.status === 'paid' && sub && sub.status === 'ended') {
    liveOther = sub.kind === 'family'
      ? (sub.account_id ? await first(env, `SELECT * FROM subscriptions WHERE kind = 'family' AND account_id = ? AND id != ? AND ${LIVE_STRICT} LIMIT 1`, sub.account_id, sub.id) : null)
      : await first(env, `SELECT * FROM subscriptions WHERE kind = 'class' AND class_code = ? AND id != ? AND ${LIVE_STRICT} LIMIT 1`, sub.class_code, sub.id);
  }
  // an order that renews a one-year plan, and that plan (TRUST-10 §3); the renewal behind a refunded charge
  const renewal = order && truth?.status === 'paid' ? await first(env, 'SELECT * FROM order_renewals WHERE order_id = ?', order.id) : null;
  const renewalSub = renewal ? await first(env, 'SELECT * FROM subscriptions WHERE id = ?', renewal.subscription_id) : null;
  const chargeRenewal = charge?.order_id && truth?.status === 'refunded' ? await first(env, 'SELECT * FROM order_renewals WHERE order_id = ?', charge.order_id) : null;
  let live = null; let liveTrial = null;
  if (truth?.status === 'paid' && order) {
    if (order.plan === 'class_year') {
      live = await first(env, `SELECT * FROM subscriptions WHERE kind = 'class' AND class_code = ? AND plan != 'trial' AND ${LIVE_STRICT} LIMIT 1`, order.class_code);
      liveTrial = await first(env, `SELECT * FROM subscriptions WHERE kind = 'class' AND class_code = ? AND plan = 'trial' AND ${LIVE_STRICT} LIMIT 1`, order.class_code);
    } else if (order.account_id) {
      live = await liveFamilyStrict(env, order.account_id);
    }
  }
  return {
    mode: env.BILLING_MODE === 'test' ? 'test' : 'live', now: nowIso(), provider: provider.id, eventId: hint.eventId, graceDays: limits(env).graceDays,
    order, sub, live, liveTrial, liveOther, charge, chargeRefunds, chargebackExists, renewal, renewalSub, chargeRenewal, latestCharge: sub ? await latestCharge(env, sub.id) : null,
    paymentExists: truth?.status === 'paid' && !!charge, ids: { sub: randomToken(8), payment: randomToken(8) },
  };
}

const SUB_COLS = ['id', 'kind', 'account_id', 'class_code', 'plan', 'status', 'provider', 'provider_subscription_id', 'price_agorot', 'seats', 'invoice_ref',
  'current_period_start', 'current_period_end', 'cancel_at_period_end', 'cancel_requested_at', 'ended_reason', 'first_paid_at', 'refund_until', 'last_event_at',
  'note', 'created_at', 'updated_at'];
const PAY_COLS = ['id', 'provider', 'provider_payment_id', 'kind', 'subscription_id', 'order_id', 'amount_agorot', 'status', 'period_end', 'invoice_url', 'occurred_at', 'recorded_at'];
const insert = (env, table, cols, row) => env.DB.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...cols.map((c) => row[c] ?? null));

/** The SQL for one write that decide() asked for. */
function opStmt(env, op) {
  switch (op.op) {
    case 'sub.insert': return insert(env, 'subscriptions', SUB_COLS, op.row);
    // stop: the plan ends for good (a refund, a chargeback), so the provider is told to stop charging (retryCancels)
    case 'sub.end': return env.DB.prepare(
      `UPDATE subscriptions SET status = 'ended', ended_reason = ?1, current_period_end = ?2, updated_at = ?3,
       cancel_requested_at = CASE WHEN ?5 THEN COALESCE(cancel_requested_at, ?3) ELSE cancel_requested_at END,
       cancel_at_period_end = CASE WHEN ?5 THEN 1 ELSE cancel_at_period_end END WHERE id = ?4 AND status != 'ended'`,
    ).bind(op.reason, op.end, op.now, op.id, op.stop ? 1 : 0);
    case 'sub.stopCharging': return env.DB.prepare(
      'UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, ?), cancel_at_period_end = 1, updated_at = ? WHERE id = ?',
    ).bind(op.now, op.now, op.id);
    case 'sub.renew': return env.DB.prepare(
      `UPDATE subscriptions SET current_period_start = CASE WHEN ?1 > current_period_end THEN ?2 ELSE current_period_start END,
       current_period_end = MAX(current_period_end, ?1), status = CASE WHEN ?3 THEN 'active' ELSE status END,
       ended_reason = CASE WHEN ?3 THEN NULL ELSE ended_reason END, last_event_at = MAX(COALESCE(last_event_at, ''), ?4), updated_at = ?5 WHERE id = ?6`,
    ).bind(op.newEnd, op.newStart, op.activate ? 1 : 0, op.lastEventAt, op.now, op.id);
    // a one-year plan renewed by its payer (TRUST-10 §3): the next year from where this one ends, active again
    case 'sub.extendYear': return env.DB.prepare(
      `UPDATE subscriptions SET current_period_start = ?1, current_period_end = ?2, price_agorot = ?3, refund_until = ?4, status = 'active',
       cancel_at_period_end = 0, cancel_requested_at = NULL, cancel_synced_at = NULL, ended_reason = NULL,
       last_event_at = MAX(COALESCE(last_event_at, ''), ?5), updated_at = ?6 WHERE id = ?7 AND current_period_end = ?1`,
    ).bind(op.prevEnd, op.newEnd, op.price, op.refundUntil, op.lastEventAt, op.now, op.id);
    // a renewal taken back before its year started: the year paid before, still active, its refund window used
    case 'sub.unrenew': return env.DB.prepare(
      'UPDATE subscriptions SET current_period_start = ?, current_period_end = ?, refund_until = NULL, updated_at = ? WHERE id = ? AND current_period_start = ? AND status != \'ended\'',
    ).bind(op.start, op.end, op.now, op.id, op.renewedStart);
    case 'sub.pastDue': return env.DB.prepare(
      "UPDATE subscriptions SET status = CASE WHEN status = 'active' THEN 'past_due' ELSE status END, last_event_at = MAX(COALESCE(last_event_at, ''), ?), updated_at = ? WHERE id = ?",
    ).bind(op.lastEventAt, nowIso(), op.id);
    case 'sub.providerCancel': return env.DB.prepare(
      `UPDATE subscriptions SET cancel_at_period_end = 1, status = CASE WHEN status IN ('active', 'past_due') THEN 'canceled' ELSE status END,
       cancel_requested_at = COALESCE(cancel_requested_at, ?), cancel_synced_at = COALESCE(cancel_synced_at, ?), updated_at = ? WHERE id = ?`,
    ).bind(op.at, op.now, op.now, op.id);
    case 'order.paid': return env.DB.prepare(
      "UPDATE orders SET status = 'paid', subscription_id = COALESCE(?, subscription_id), paid_at = COALESCE(paid_at, ?) WHERE id = ? AND status != 'paid'",
    ).bind(op.subscriptionId, op.at, op.id);
    case 'payment': return insert(env, 'payments', PAY_COLS, op.row);
    case 'refund': return env.DB.prepare('INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at) VALUES (?, ?, ?, ?, ?)')
      .bind(op.row.subscription_id, op.row.payment_id, op.row.amount_agorot, op.row.reason, op.row.requested_at);
    case 'hold': return env.DB.prepare('UPDATE accounts SET billing_hold_at = COALESCE(billing_hold_at, ?) WHERE id = ?').bind(op.at, op.accountId);
    case 'audit': return env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
      .bind(op.row.at, op.row.actor, op.row.action, op.row.target, op.row.detail);
    default: throw new Error(`unknown write ${op.op}`);
  }
}

/** Apply one truth in one batch whose first statement is the billing_events row. Returns the outcome. */
export async function applyTruth(env, provider, hint, truth) {
  for (let attempt = 0; ; attempt++) {
    const c = await loadCtx(env, provider, hint, truth);
    const d = decide(truth, c);
    for (const n of d.notices) {
      if (n.kind.startsWith('canceled:') && !n.params.reference) n.params.reference = await cancelReference(n.ref, n.params.requestedAt);
    }
    const event = env.DB.prepare(
      'INSERT INTO billing_events (provider, event_id, type, outcome, subscription_id, amount_agorot, detail, occurred_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(provider.id, hint.eventId, String(hint.type || truth?.status || 'unknown').slice(0, 20), d.outcome, d.subscriptionId, d.amount, cleanDetail(d.detail),
      truth?.occurredAt || hint.occurredAt || null, nowIso());
    try {
      await env.DB.batch([event, ...d.ops.map((op) => opStmt(env, op)), ...d.notices.map((n) => noticeStmt(env, n))]);
    } catch (e) {
      const msg = String(e?.message || '');
      if (/UNIQUE/.test(msg) && /billing_events/.test(msg)) return 'duplicate';
      if (/UNIQUE/.test(msg) && attempt === 0) continue; // the state moved under us: read it again and decide once more
      throw e;
    }
    if (d.acknowledge) { try { await provider.acknowledge(env, truth); } catch { console.error('billing: acknowledge failed', provider.id); } }
    return d.outcome;
  }
}

// ---------------------------------------------------------------- the test provider's payment page
const testPayAllowed = (env) => String(env.BILLING_PROVIDER) === 'test' && !!providerById(env, 'test');
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

/** GET /api/billing/test-pay/:orderId: a fake hosted payment page with two buttons (test mode only). */
export async function testPayPage(orderId, env) {
  if (!testPayAllowed(env)) throw new HttpError(404, 'not_found');
  const o = await first(env, 'SELECT * FROM orders WHERE id = ?', String(orderId));
  if (!o) throw new HttpError(404, 'not_found');
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>תשלום לבדיקה</title></head><body style="font-family:Rubik,Arial,sans-serif;max-width:28rem;margin:2rem auto;padding:0 16px;color:#14161a;background:#fff">
<h1 style="font-size:1.4rem">תשלום לבדיקה</h1>
<p>זה דף תשלום מדומה של סביבת הבדיקה. שום כרטיס לא מחויב.</p>
<p>הזמנה ${escapeHtml(o.id)} · ${escapeHtml(shekels(o.amount_agorot))}</p>
<form method="post"><button name="result" value="paid" style="font-size:1rem;padding:.75rem 1.25rem">תשלום מוצלח</button>
<button name="result" value="failed" style="font-size:1rem;padding:.75rem 1.25rem">תשלום שנכשל</button></form></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': PAGE_CSP, 'X-Content-Type-Options': 'nosniff' } });
}

/** POST /api/billing/test-pay/:orderId {result}: sign a test event, run it through the webhook in-process, go back. */
export async function testPaySubmit(orderId, req, env, ctx) {
  if (!testPayAllowed(env)) throw new HttpError(404, 'not_found');
  const raw = await rawBody(req, 4096);
  let result = '';
  if (/json/.test(req.headers.get('Content-Type') || '')) { try { result = JSON.parse(raw).result; } catch { /* below */ } } else result = new URLSearchParams(raw).get('result');
  if (!['paid', 'failed'].includes(result)) throw new HttpError(400, 'bad_result');
  const o = await first(env, 'SELECT * FROM orders WHERE id = ?', String(orderId));
  if (!o) throw new HttpError(404, 'not_found');
  if (o.status === 'open') {
    const event = {
      id: `tev_${randomToken(8)}`, type: result, order: o.id, payment: `tpay_${o.id}${result === 'failed' ? `_${randomToken(4)}` : ''}`,
      // a standing order only where the checkout asked for one (TRUST-10 §1: the monthly plan)
      subscription: String(o.provider_checkout_id || '').startsWith('tco_') && recurringPlan(o.plan) ? `tsub_${o.id}` : undefined,
      amountAgorot: o.amount_agorot, currency: 'ILS', occurredAt: nowIso(),
    };
    const rawEvent = JSON.stringify(event);
    const at = Math.floor(Date.now() / 1000);
    const hook = new Request(`${publicUrl(env) || 'https://localhost'}/api/billing/webhook/test/x`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Signature': await testSignature(env.TEST_WEBHOOK_SECRET || '', at, rawEvent) }, body: rawEvent,
    });
    await webhook('test', env.WEBHOOK_PATH_SECRET, hook, env, ctx, {});
  }
  return new Response(null, { status: 303, headers: { Location: `${publicUrl(env)}/parents?order=${o.id}`, 'Cache-Control': 'no-store' } });
}

// ---------------------------------------------------------------- cancel, resume, refunds
/** POST /api/billing/cancel {subscriptionId, mode}: the payer's notice takes effect here and now, whatever the provider says. */
export async function cancel(req, env, ctx, cors) {
  const account = await requireAccount(req, env);
  const b = await body(req);
  const mode = String(b.mode || 'period_end');
  if (!['period_end', 'refund_now', 'prorata'].includes(mode)) throw new HttpError(400, 'bad_mode');
  const sub = await first(env, 'SELECT * FROM subscriptions WHERE id = ? AND account_id = ?', String(b.subscriptionId || ''), account.id);
  if (!sub) throw new HttpError(404, 'no_subscription');
  const answer = await cancelSubscription(env, ctx, sub, mode, { actor: `account:${account.id}` });
  return json(answer, 200, cors);
}

async function cancelAnswer(env, sub) {
  const provider = providerById(env, sub.provider);
  const refunds = await first(env, "SELECT COALESCE(SUM(amount_agorot), 0) AS n FROM refund_queue WHERE subscription_id = ? AND reason IN ('cooling_off', 'prorata')", sub.id);
  return {
    ok: true, status: sub.status, endsAt: sub.current_period_end, refundAgorot: Number(refunds?.n || 0),
    refundManual: !provider?.capabilities.refundApi, synced: !!sub.cancel_synced_at,
    reference: await cancelReference(sub.id, sub.cancel_requested_at),
  };
}

/** The writes of a cancellation (§6.6), then the provider call and refund attempt after the commit. */
export async function cancelSubscription(env, ctx, sub, mode, { actor, inline = true } = {}) {
  // a repeat changes nothing and returns the same answer
  if (sub.cancel_requested_at && (mode === 'period_end' || sub.status === 'ended')) return cancelAnswer(env, sub);
  if (sub.status === 'ended') throw new HttpError(404, 'no_subscription');
  const now = nowIso();
  const requestedAt = sub.cancel_requested_at || now;
  let status = ['active', 'past_due'].includes(sub.status) ? 'canceled' : sub.status;
  let endsAt = sub.current_period_end; let endedReason = null; let refund = null;
  const charge = await latestCharge(env, sub.id);
  // The latest charge renewed a one-year plan whose new year has not started (trust spec TRUST-10 §3): giving that
  // money back takes the new year back, and the year paid before runs to its end with the plan still active.
  const undo = mode !== 'period_end' ? await renewalToUndo(env, sub, charge, now) : null;
  if (mode === 'refund_now') {
    if (!sub.refund_until || now >= sub.refund_until || !charge) throw new HttpError(409, 'refund_window_closed');
    if (undo) { status = sub.status; endsAt = undo.prev_end; } else { status = 'ended'; endedReason = 'refunded'; endsAt = endAt(sub, now); }
    refund = { amount: charge.amount_agorot, reason: 'cooling_off' };
  } else if (mode === 'prorata') {
    if (!['family_year', 'class_year'].includes(sub.plan) || !sub.refund_until || now < sub.refund_until || !charge) throw new HttpError(409, 'prorata_not_offered');
    if (undo) {
      // none of the renewed year was used: all of it comes back, and the year before runs on
      status = sub.status; endsAt = undo.prev_end;
      refund = { amount: charge.amount_agorot, reason: 'prorata' };
    } else {
      const amount = prorataOf(sub);
      status = 'ended'; endedReason = 'canceled'; endsAt = endAt(sub, now);
      if (amount > 0) refund = { amount, reason: 'prorata' };
    }
  }
  const reference = await cancelReference(sub.id, requestedAt);
  // Two requests at once (two tabs, two devices, a retry after a timeout) must not both cancel: the UPDATE runs only
  // while the plan is still in the state this request read, and every other write of the batch runs only when that
  // UPDATE did (it checks the row the UPDATE wrote). The loser gets the winner's answer. A partial unique index on
  // refund_queue is the last guard against a second cooling-off or pro-rata refund.
  const refundMode = mode !== 'period_end';
  const won = undo
    ? ['SELECT 1 FROM subscriptions WHERE id = ? AND current_period_end = ? AND updated_at = ?', [sub.id, undo.prev_end, now]]
    : refundMode
      ? ["SELECT 1 FROM subscriptions WHERE id = ? AND status = 'ended' AND ended_reason = ? AND updated_at = ?", [sub.id, endedReason, now]]
      : ['SELECT 1 FROM subscriptions WHERE id = ? AND cancel_requested_at = ?', [sub.id, now]];
  const stmts = [
    undo
      // the renewal taken back: the year paid before, still active; its refund window is used (one per plan)
      ? env.DB.prepare(`UPDATE subscriptions SET current_period_start = ?, current_period_end = ?, refund_until = NULL, updated_at = ?
          WHERE id = ? AND current_period_start = ? AND status != 'ended' RETURNING id`).bind(undo.prev_start, undo.prev_end, now, sub.id, undo.prev_end)
      : env.DB.prepare(
        `UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, ?), cancel_at_period_end = 1, status = ?, ended_reason = COALESCE(?, ended_reason),
         current_period_end = ?, updated_at = ? WHERE id = ? AND status != 'ended' ${refundMode ? '' : 'AND cancel_requested_at IS NULL'} RETURNING id`,
      ).bind(now, status, endedReason, endsAt, now, sub.id),
    // right after the UPDATE, changes() is what it changed: 1 for the request that won, even within the same millisecond
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?, ?, '${undo ? 'subscription.unrenew' : 'subscription.cancel'}', ?, ? WHERE changes() = 1`)
      .bind(now, actor, `sub:${sub.id}`, JSON.stringify({ mode, refundAgorot: refund?.amount || 0 })),
    refund && env.DB.prepare(`INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at)
      SELECT ?, ?, ?, ?, ? WHERE EXISTS (${won[0]}) RETURNING id`).bind(sub.id, charge?.id || null, refund.amount, refund.reason, now, ...won[1]),
    sub.account_id && env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (${won[0]})`)
      .bind(sub.id, `canceled:${mode}:${requestedAt}`, sub.account_id, JSON.stringify({ requestedAt, endsAt, refundAgorot: refund?.amount || 0, reference, ...(undo ? { renewal: true } : {}) }), now, ...won[1]),
  ].filter(Boolean);
  let res;
  try {
    res = await env.DB.batch(stmts);
  } catch (e) {
    if (!/UNIQUE/.test(String(e?.message))) throw e;
    res = null; // a second refund for the same plan: the other request won
  }
  if (!res || !res[0]?.results?.length) return cancelAnswer(env, await first(env, 'SELECT * FROM subscriptions WHERE id = ?', sub.id));
  const refundId = refund ? res[2]?.results?.[0]?.id : null;
  let synced = false;
  if (inline) {
    // a renewal taken back stops nothing at the provider: a one-year plan has no standing order
    synced = undo ? true : await syncCancel(env, { ...sub, cancel_requested_at: requestedAt }, actor);
    if (refundId) await processRefund(env, await first(env, 'SELECT * FROM refund_queue WHERE id = ?', refundId));
    ctx?.waitUntil?.(flushNotices(env));
  }
  const provider = providerById(env, sub.provider);
  return { ok: true, status, endsAt, refundAgorot: refund?.amount || 0, refundManual: !provider?.capabilities.refundApi, synced, reference };
}

/**
 * The renewal a refund would take back (TRUST-10 §3): the order_renewals row of the plan's latest charge, while the
 * plan still carries that renewal (its period starts at the old end) and the renewed year has not started. Else null.
 */
async function renewalToUndo(env, sub, charge, now) {
  if (!charge?.order_id || sub.plan !== 'family_year') return null;
  const r = await first(env, 'SELECT * FROM order_renewals WHERE order_id = ? AND subscription_id = ?', charge.order_id, sub.id);
  return r && sub.current_period_start === r.prev_end && now < r.prev_end ? r : null;
}

/** The unused share of a plan's price, from now (or from its start, for a year that has not started) to its end. */
function prorataOf(sub, at = Date.now()) {
  const start = Date.parse(sub.current_period_start); const end = Date.parse(sub.current_period_end);
  const unused = Math.max(0, Math.floor((end - Math.max(at, start)) / DAY)); const total = Math.max(1, Math.round((end - start) / DAY));
  return Math.min(sub.price_agorot || 0, Math.floor((sub.price_agorot || 0) * unused / total));
}

/** Tell the provider to stop charging. A failure leaves cancel_synced_at empty for the hourly retry and is recorded. */
export async function syncCancel(env, sub, actor = 'cron') {
  const provider = providerById(env, sub.provider);
  try {
    if (!provider) throw new Error('provider not available');
    await provider.cancel(env, sub, { idempotencyKey: `cancel:${sub.id}` });
    await env.DB.prepare('UPDATE subscriptions SET cancel_synced_at = COALESCE(cancel_synced_at, ?) WHERE id = ?').bind(nowIso(), sub.id).run();
    return true;
  } catch {
    const notices = Date.parse(sub.cancel_requested_at) < Date.now() - DAY
      ? [noticeStmt(env, ownerNotice(sub.id, 'owner:unsynced_cancel', { subscription: sub.id, since: sub.cancel_requested_at }))] : [];
    await env.DB.batch([auditStmt(env, actor, 'subscription.cancel_sync', `sub:${sub.id}`, { ok: false }), ...notices]);
    return false;
  }
}

/** The hourly retry of cancellations the provider has not confirmed. */
export async function retryCancels(env, { limit = 50 } = {}) {
  const list = await all(env, 'SELECT * FROM subscriptions WHERE cancel_requested_at IS NOT NULL AND cancel_synced_at IS NULL ORDER BY cancel_requested_at LIMIT ?', limit);
  let synced = 0;
  for (const sub of list) if (await syncCancel(env, sub)) synced++;
  return { tried: list.length, synced };
}

export const REFUND_TRIES = 3;
/** One refund: through the provider's API, or marked manual (with an owner notice) when there is none or it keeps failing. */
export async function processRefund(env, row) {
  if (!row || row.done_at || row.manual) return;
  const sub = await first(env, 'SELECT * FROM subscriptions WHERE id = ?', row.subscription_id);
  const provider = sub ? providerById(env, sub.provider) : null;
  const manual = async (why) => env.DB.batch([
    env.DB.prepare('UPDATE refund_queue SET manual = 1, result = ? WHERE id = ?').bind(why, row.id),
    noticeStmt(env, ownerNotice(`refund:${row.id}`, 'owner:manual_refund', { subscription: row.subscription_id, amountAgorot: row.amount_agorot, reason: row.reason })),
  ]);
  if (!provider || !provider.capabilities.refundApi) return manual('no refund api');
  const payment = row.payment_id ? await first(env, 'SELECT * FROM payments WHERE id = ?', row.payment_id) : null;
  try {
    const r = await provider.refund(env, payment, { amountAgorot: row.amount_agorot, idempotencyKey: `refund:${row.id}` });
    if (!r?.refunded || r.manual) return manual('provider asks for a manual refund');
    await env.DB.batch([
      env.DB.prepare('UPDATE refund_queue SET done_at = ?, result = ? WHERE id = ?').bind(nowIso(), cleanDetail(`refunded ${r.providerRefundId || ''}`), row.id),
      auditStmt(env, `provider:${provider.id}`, 'refund', `sub:${row.subscription_id}`, { amountAgorot: row.amount_agorot, reason: row.reason }),
    ]);
  } catch {
    const tries = row.tries + 1;
    await env.DB.prepare('UPDATE refund_queue SET tries = ?, result = ? WHERE id = ?').bind(tries, 'failed', row.id).run();
    if (tries >= REFUND_TRIES) await manual('failed 3 times');
  }
}
/** The hourly pass over the refund queue. */
export async function processRefundQueue(env, { limit = 50 } = {}) {
  const list = await all(env, 'SELECT * FROM refund_queue WHERE done_at IS NULL AND manual = 0 ORDER BY requested_at LIMIT ?', limit);
  for (const row of list) await processRefund(env, row);
  return { tried: list.length };
}

/** POST /api/billing/resume {subscriptionId}: undo a cancellation before the period ends, where the provider allows it. */
export async function resume(req, env, cors) {
  const account = await requireAccount(req, env);
  const b = await body(req);
  const sub = await first(env, 'SELECT * FROM subscriptions WHERE id = ? AND account_id = ?', String(b.subscriptionId || ''), account.id);
  if (!sub) throw new HttpError(404, 'no_subscription');
  const provider = providerById(env, sub.provider);
  const ok = sub.status === 'canceled' && sub.cancel_at_period_end && nowIso() < sub.current_period_end && !sub.ended_reason && provider?.capabilities.resumeApi;
  if (!ok) throw new HttpError(409, 'not_resumable');
  try { await provider.resume(env, sub); } catch { throw new HttpError(409, 'not_resumable'); }
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE subscriptions SET cancel_at_period_end = 0, status = 'active', cancel_requested_at = NULL, cancel_synced_at = NULL, updated_at = ? WHERE id = ? AND status = 'canceled'")
        .bind(nowIso(), sub.id),
      auditStmt(env, `account:${account.id}`, 'subscription.resume', `sub:${sub.id}`),
    ]);
  } catch (e) {
    if (/UNIQUE/.test(String(e?.message))) throw new HttpError(409, 'not_resumable'); // a newer plan is already live
    throw e;
  }
  return json({ ok: true, status: 'active', renewsAt: sub.current_period_end }, 200, cors);
}

/** GET /api/billing/portal: the provider's page for updating the card, where there is one. */
export async function portal(req, env, cors) {
  const account = await requireAccount(req, env);
  const sub = await first(env, `SELECT * FROM subscriptions WHERE kind = 'family' AND account_id = ? AND ${RUNNING} ORDER BY current_period_end DESC LIMIT 1`, account.id);
  const url = sub ? providerById(env, sub.provider)?.portalUrl(env, sub) : null;
  if (!url) throw new HttpError(404, 'no_portal');
  return json({ url }, 200, cors);
}

/**
 * GET /api/billing/payments/:id/invoice: the provider's tax invoice, for the payer only. A redirect; or, when the caller
 * asks for JSON (the parents page, which sends its session in a header a plain link cannot carry), { url }.
 */
export async function invoice(id, req, env, cors = {}) {
  const account = await requireAccount(req, env);
  const p = await first(env, 'SELECT p.invoice_url FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE p.id = ? AND s.account_id = ?', String(id), account.id);
  if (!p?.invoice_url || !/^https:\/\//.test(p.invoice_url)) throw new HttpError(404, 'not_found');
  if (/application\/json/.test(req.headers.get('Accept') || '')) return json({ url: p.invoice_url }, 200, { ...cors, 'Cache-Control': 'no-store' });
  return new Response(null, { status: 302, headers: { Location: p.invoice_url, 'Cache-Control': 'no-store' } });
}

// ---------------------------------------------------------------- the parent's account page
function planView(env, sub, charge, economy, { canRenew = false, undo = null } = {}) {
  if (!sub) return null;
  const now = nowIso();
  const provider = providerById(env, sub.provider);
  const running = ['active', 'past_due', 'canceled'].includes(sub.status);
  const canProrata = running && ['family_year', 'class_year'].includes(sub.plan) && !!sub.refund_until && now >= sub.refund_until && !!charge;
  // a renewal not yet started comes back whole, as cancelSubscription does
  const prorataAgorot = canProrata ? (undo ? charge.amount_agorot : prorataOf(sub)) : null;
  // until when the tutor works on the child's devices: a failed payment keeps it for the grace days after the period
  const accessUntil = sub.status === 'past_due'
    ? new Date(Date.parse(sub.current_period_end) + limits(env).graceDays * DAY).toISOString() : sub.current_period_end;
  return {
    id: sub.id, kind: sub.kind, plan: sub.plan, status: sub.status, priceAgorot: sub.price_agorot, periodEnd: sub.current_period_end, accessUntil,
    ...(sub.kind === 'class' ? { classCode: sub.class_code, seats: sub.seats } : {}),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end, cancelRequestedAt: sub.cancel_requested_at, refundUntil: sub.refund_until,
    canRefundNow: running && !!sub.refund_until && now < sub.refund_until && !!charge,
    canProrata, prorataAgorot,
    // a one-year plan (TRUST-10): whether it renews by itself (only the monthly plan does), whether its payer can renew
    // it now (its last 45 days), and, when the latest payment renewed it, the end that a refund of it goes back to
    renews: recurringPlan(sub.plan), canRenew, renewFrom: sub.plan === 'family_year' ? new Date(Date.parse(sub.current_period_end) - RENEW_DAYS * DAY).toISOString() : null,
    ...(undo ? { renewalUndoEnd: undo.prev_end } : {}),
    canResume: sub.status === 'canceled' && !!sub.cancel_at_period_end && now < sub.current_period_end && !sub.ended_reason && !!provider?.capabilities.resumeApi,
    portal: !!provider?.portalUrl(env, sub), economy,
  };
}

/** GET /api/account: the signed-in parent's or teacher's own page. A family-device token gets 401 not_account. */
export async function accountOverview(req, env, cors) {
  const a = await requireAccount(req, env);
  const L = limits(env);
  const live = await first(env, `SELECT * FROM subscriptions WHERE kind = 'family' AND account_id = ? AND ${RUNNING} ORDER BY current_period_end DESC LIMIT 1`, a.id);
  const charge = live ? await latestCharge(env, live.id) : null;
  const yearly = live ? { canRenew: await renewable(env, live), undo: await renewalToUndo(env, live, charge, nowIso()) } : {};
  const economy = live ? (await monthSpendUsd(env, `fam:${a.id}`)) >= L.budgets.familyMonthlyUsd : false;
  // linked devices, and devices whose code the parent claimed while the child's device has yet to collect its token
  const devices = await all(env, `SELECT d.id, d.label, d.created_at, d.last_seen, d.token_hash IS NULL AS pending FROM family_devices d
    WHERE d.account_id = ?1 AND (d.token_hash IS NOT NULL OR EXISTS (SELECT 1 FROM link_codes l WHERE l.device_id = d.id AND l.collected_at IS NULL AND l.expires_at > ?2))
    ORDER BY d.created_at`, a.id, nowIso());
  const usage = await all(env, `SELECT who, SUM(count) AS n FROM ai_usage WHERE who IN (?, ?, ?, ?) AND length(day) = 10 AND day >= ? GROUP BY who`,
    `fam:${a.id}:tutor`, `fam:${a.id}:check`, `fam:${a.id}:generate`, `fam:${a.id}:exam`, daysAgo(6));
  const used = (g) => Number(usage.find((u) => u.who === `fam:${a.id}:${g}`)?.n || 0);
  const payments = await all(env, `SELECT p.id, p.subscription_id, s.kind AS plan_kind, p.occurred_at, p.amount_agorot, p.kind, p.invoice_url FROM payments p JOIN subscriptions s ON s.id = p.subscription_id
    WHERE s.account_id = ? ORDER BY p.occurred_at DESC LIMIT 48`, a.id);
  // class licences this account bought by card: each with its end, its refund options and its own receipts
  const classes = await all(env, "SELECT * FROM subscriptions WHERE kind = 'class' AND account_id = ? ORDER BY current_period_end DESC LIMIT 20", a.id);
  const classViews = [];
  for (const c of classes) {
    const view = { classCode: c.class_code, status: c.status, until: c.current_period_end };
    if (RUNNING_STATUSES.includes(c.status)) view.plan = planView(env, c, await latestCharge(env, c.id), false);
    classViews.push(view);
  }
  return json({
    email: a.email, billingHold: !!a.billingHoldAt, maxDevices: L.family.devices,
    plan: planView(env, live, charge, economy, yearly),
    devices: devices.map((d) => ({ id: d.id, label: d.label, linkedAt: d.created_at, lastSeen: d.last_seen, ...(d.pending ? { pending: true } : {}) })),
    usageWeek: { tutor: used('tutor'), check: used('check'), generate: used('generate'), exam: used('exam') },
    payments: payments.map((p) => ({ id: p.id, subscriptionId: p.subscription_id, planKind: p.plan_kind, at: p.occurred_at, amountAgorot: p.amount_agorot, kind: p.kind, hasInvoice: !!p.invoice_url })),
    classes: classViews,
  }, 200, cors);
}

/** GET /api/account/export: everything kept about the caller, as a file. No card data exists to export. */
export async function accountExport(req, env, cors) {
  const a = await requireAccount(req, env);
  const acc = await first(env, 'SELECT email, created_at, last_seen, adult_confirmed_at, terms_version, billing_hold_at FROM accounts WHERE id = ?', a.id);
  const subs = await all(env, `SELECT id, kind, class_code, plan, status, provider, price_agorot, seats, current_period_start, current_period_end, cancel_requested_at,
    first_paid_at, refund_until, ended_reason, created_at FROM subscriptions WHERE account_id = ?`, a.id);
  const data = {
    exportedAt: nowIso(), account: acc,
    devices: await all(env, 'SELECT id, label, created_at, last_seen FROM family_devices WHERE account_id = ?', a.id),
    subscriptions: subs,
    payments: await all(env, `SELECT p.id, p.kind, p.amount_agorot, p.currency, p.status, p.occurred_at, p.period_end FROM payments p JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.account_id = ?`, a.id),
    orders: await all(env, 'SELECT id, plan, class_code, seats, amount_agorot, status, created_at, paid_at FROM orders WHERE account_id = ?', a.id),
  };
  return json(data, 200, cors, { 'Content-Disposition': `attachment; filename="madregot-${dayOf()}.json"` });
}

/**
 * POST /api/account/delete {confirm: "DELETE"}: needs a code entered in the last 10 minutes. Ends any family plan now
 * (the provider is told; the hourly retry finishes it if it is down), deletes the sessions, devices, links, requests and
 * the account; subscriptions and orders lose the account id; payments are kept for the tax records.
 */
export async function deleteAccount(req, env, ctx, cors) {
  const a = await requireAccount(req, env);
  requireRecentCode(a);
  const b = await body(req);
  if (b.confirm !== 'DELETE') throw new HttpError(400, 'confirm_required');
  await forgetAccount(env, a.id, { actor: `account:${a.id}` });
  ctx?.waitUntil?.(retryCancels(env));
  return json({ ok: true }, 200, cors);
}

/** The writes of an account deletion (shared with the owner CLI's forget). Provider calls happen after, by retryCancels. */
export async function forgetAccount(env, accountId, { actor }) {
  const now = nowIso();
  const subs = await all(env, `SELECT * FROM subscriptions WHERE kind = 'family' AND account_id = ? AND ${RUNNING}`, accountId);
  await env.DB.batch([
    ...subs.map((s) => env.DB.prepare(
      `UPDATE subscriptions SET cancel_requested_at = COALESCE(cancel_requested_at, ?), cancel_at_period_end = 1, status = 'ended', ended_reason = 'account_deleted',
       current_period_end = ?, updated_at = ? WHERE id = ?`,
    ).bind(now, endAt(s, now), now, s.id)),
    env.DB.prepare('DELETE FROM account_sessions WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM link_codes WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM family_devices WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM class_owners WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM licence_requests WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM notices WHERE to_account = ? AND sent_at IS NULL').bind(accountId),
    env.DB.prepare('UPDATE subscriptions SET account_id = NULL, updated_at = ? WHERE account_id = ?').bind(now, accountId),
    // an order still open can no longer start a plan: a late payment for it is refunded (apply.js)
    env.DB.prepare("UPDATE orders SET status = CASE WHEN status = 'open' THEN 'expired' ELSE status END, account_id = NULL WHERE account_id = ?").bind(accountId),
    env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId),
    auditStmt(env, actor, 'account.delete', `account:${accountId}`, { endedPlans: subs.length }),
  ]);
  return { endedPlans: subs.length };
}

