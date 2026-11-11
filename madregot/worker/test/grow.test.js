// Grow, the Israeli payment company (PARENTS-11, src/providers/grow.js), against a stub of its server API (every call is
// multipart form data to <base><method>): checkout, the callback that is never trusted (ids and codes only, the payer's
// details dropped), the truth pulled with our credentials, a repeated or lost callback, the sandbox/live mode check,
// the IP list, approve, cancel by updateDirectDebit, refund, and the monthly plan kept off until Grow enables the cancel.
// The one-year family plan (TRUST-10: it never renews by itself) is sold as one charge on the one-time page, like the
// class licence, with its full and pro-rata refunds (COUNCIL2-30); every error branch of the adapter has a test
// (COUNCIL2-25).
// The fixtures are synthetic: payer "Test Parent", phone 0500000000, parent@example.com.
// A contract test against Grow's real sandbox runs only with GROW_SANDBOX=1 and the four keys in .dev.vars (the owner's
// step 4 in SUBSCRIPTION.md); otherwise it is skipped.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import grow, { growBase, GROW_SANDBOX, GROW_DESCRIPTIONS, call, GrowError } from '../src/providers/grow.js';
import { capsOf } from '../src/providers/index.js';
import { planOnline, onlineCheckout, plansView } from '../src/billing.js';
import { setup, signIn, rows, one, makeClass, stubFetch } from './helpers.js';
import { soldOnline, sellsOnline } from '../../shared/sold.js';
import { processRefundQueue } from '../src/billing.js';
import { devVarValues } from '../scripts/owner.mjs';

let h;
afterEach(() => { h?.done(); h = null; });
const fx = (name) => readFileSync(new URL(`./fixtures/grow/${name}.json`, import.meta.url), 'utf8');
const KEY = 'attempt-0123456789abcdef';
const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
const GROW = {
  BILLING_PROVIDER: 'grow', BILLING_MODE: 'test', ALLOW_TEST_BILLING: 'false', GROW_USER_ID: 'grow-user-test', GROW_PAGE_CODE_ONCE: 'page-once',
  GROW_PAGE_CODE_RECURRING: 'page-dd', GROW_DIRECT_DEBIT_API: 'on', BILLING_CHECKOUT_HOSTS: 'sandbox.meshulam.co.il',
};

/** A stub of Grow's server: each method answers from `answers` (a function or a value); every call's fields are kept. */
function growStub(answers = {}) {
  const calls = [];
  const other = async (url, _body, init) => {
    if (!url.startsWith(GROW_SANDBOX)) throw new Error(`unexpected fetch ${url}`);
    const method = url.slice(GROW_SANDBOX.length);
    assert.ok(init.body instanceof FormData, 'multipart form data');
    const fields = Object.fromEntries(init.body.entries());
    calls.push({ method, fields });
    const a = answers[method];
    const out = typeof a === 'function' ? a(fields, calls) : a;
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out ?? { status: 0, err: 'no stub' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, other };
}
const ok = (data) => ({ status: 1, err: '', data });
/** A stubbed Grow and a Worker with Grow as the provider. */
async function growSetup(answers, over = {}) {
  const stub = growStub(answers);
  h = await setup({ ...GROW, ...over }, { other: stub.other });
  return stub;
}
const buy = (token, plan, body = {}) => h.call('POST', '/api/billing/checkout', {
  headers: { 'X-Account-Token': token, 'Idempotency-Key': KEY }, body: { adult: true, terms: '2026-11', plan, ...body },
});
const callback = (raw, { ip = '3.123.194.128', type = 'application/json' } = {}) => h.call('POST', `/api/billing/webhook/grow/${SECRET}`, { ip, body: raw, headers: { 'Content-Type': type } });
const paid = (orderId, over = {}) => { const j = JSON.parse(fx('callback-paid')); j.data.customFields.cField1 = orderId; Object.assign(j.data, over); return JSON.stringify(j); };
const truthFor = (orderId, over = {}) => { const j = JSON.parse(fx('transaction-info')); j.data.customFields.cField1 = orderId; Object.assign(j.data, over); return j; };

test('createCheckout: one multipart createPaymentProcess, the sum in shekels, cField1 the order, the right page code, no name or phone', async () => {
  const stub = await growSetup({ createPaymentProcess: JSON.parse(fx('create-process')) });
  const t = await signIn(h, 'buyer@example.test');
  const r = await buy(t, 'family_month');
  assert.equal(r.status, 201);
  const { orderId, url } = await r.json();
  assert.equal(url, 'https://sandbox.meshulam.co.il/s/a1b2c3d4');
  const [c] = stub.calls;
  assert.equal(c.method, 'createPaymentProcess');
  assert.deepEqual(c.fields, {
    userId: 'grow-user-test', pageCode: 'page-dd', sum: '29.90', description: GROW_DESCRIPTIONS.family_month,
    successUrl: `https://madregot.example.test/parents?order=${orderId}`, cancelUrl: 'https://madregot.example.test/parents',
    notifyUrl: `https://madregot.example.test/api/billing/webhook/grow/${SECRET}`, cField1: orderId, 'pageField[email]': 'buyer@example.test',
  });
  assert.equal(one(h.env, 'SELECT provider_checkout_id FROM orders WHERE id = ?', orderId).provider_checkout_id, '5100001:f0e1d2c3b4a5968778695a4b3c2d1e0f');
  // a class licence goes through the one-time page
  const cls = await makeClass(h, { setting: 'private' }); // a school class gets no AI class licence before the catalogue approval (TRUST-11)
  const teacher = await signIn(h, 'teacher@example.test');
  const lic = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': teacher, 'Idempotency-Key': 'attempt-class-0123456789', ...cls.teacher }, body: { adult: true, terms: '2026-11', plan: 'class_year', seats: 10 } });
  assert.equal(lic.status, 201);
  assert.equal(stub.calls.at(-1).fields.pageCode, 'page-once');
  assert.equal(stub.calls.at(-1).fields.sum, '490.00');
  assert.equal(stub.calls.at(-1).fields.description, GROW_DESCRIPTIONS.class_year);
  for (const call of stub.calls) for (const k of Object.keys(call.fields)) assert.doesNotMatch(k, /fullName|phone/i);
});

test('a Grow failure on checkout is 502 checkout_unavailable, and nothing about the request is logged', async () => {
  await growSetup({ createPaymentProcess: { status: 0, err: 'userId mismatch grow-user-test' } });
  const logged = []; const err = console.error; console.error = (...a) => logged.push(a.join(' '));
  try {
    const t = await signIn(h, 'buyer@example.test');
    const r = await buy(t, 'family_month');
    assert.equal(r.status, 502);
    assert.equal((await r.json()).error, 'checkout_unavailable');
  } finally { console.error = err; }
  assert.ok(logged.some((l) => l.startsWith('grow: createPaymentProcess failed')));
  assert.ok(logged.every((l) => !l.includes('grow-user-test') && !l.includes('buyer@example.test')));
});

test('parse: one hint of ids and codes; the payer\'s name, phone, email and card never pass; not paid or odd values give none', () => {
  const env = { ...GROW };
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const [hint] = grow.parse(env, paid('0123456789abcdef'), headers);
  assert.equal(hint.eventId, 'grow:7100001:2');
  assert.equal(hint.type, 'paid');
  assert.equal(hint.orderRef, '0123456789abcdef');
  assert.equal(hint.providerPaymentId, '7100001');
  assert.equal(hint.providerSubscriptionId, 'dd:0123456789abcdef', 'a standing order is known by its order');
  const text = JSON.stringify(hint);
  for (const v of ['Test Parent', '0500000000', 'parent@example.com', '4580', 'Visa', '1229', 'fullName', 'payerPhone', 'payerEmail', 'cardSuffix']) assert.ok(!text.includes(v), v);
  assert.deepEqual(grow.parse(env, paid('x', { statusCode: '0' }), headers), [], 'not paid yet: no hint');
  assert.deepEqual(grow.parse(env, paid('x', { transactionId: '71 00' }), headers), [], 'a space: no hint');
  assert.deepEqual(grow.parse(env, paid('x', { transactionToken: 'a"b' }), headers), [], 'a quote: no hint');
  assert.deepEqual(grow.parse(env, paid('x', { transactionId: '7'.repeat(81) }), headers), [], 'too long: no hint');
  // the same callback as form fields (data[...]): the same hint
  const j = JSON.parse(paid('0123456789abcdef'));
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(j.data)) {
    if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) form.set(`data[${k}][${k2}]`, v2);
    else form.set(`data[${k}]`, v);
  }
  const [fromForm] = grow.parse(env, form.toString(), new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' }));
  assert.deepEqual({ ...fromForm, occurredAt: null }, { ...hint, occurredAt: null });
});

test('end to end: paid callback → the truth pulled → the plan active → approveTransaction once; the same callback again changes nothing', async () => {
  let orderId;
  const stub = await growSetup({
    createPaymentProcess: JSON.parse(fx('create-process')),
    getTransactionInfo: () => truthFor(orderId),
    approveTransaction: ok({}),
  });
  const t = await signIn(h, 'buyer@example.test');
  orderId = (await (await buy(t, 'family_month')).json()).orderId;
  const r = await callback(paid(orderId));
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).results, ['applied']);
  const sub = one(h.env, "SELECT * FROM subscriptions WHERE provider = 'grow'");
  assert.equal(sub.status, 'active'); assert.equal(sub.plan, 'family_month');
  assert.equal(sub.provider_subscription_id, `dd:${orderId}`);
  assert.equal(one(h.env, 'SELECT provider_payment_id, amount_agorot FROM payments').provider_payment_id, '7100001');
  const approves = stub.calls.filter((c) => c.method === 'approveTransaction');
  assert.equal(approves.length, 1);
  assert.equal(approves[0].fields.pageCode, 'page-dd');
  assert.equal(approves[0].fields.transactionId, '7100001');
  assert.ok(!JSON.stringify(approves[0].fields).includes('Test Parent'));
  assert.equal(stub.calls.find((c) => c.method === 'getTransactionInfo').fields.transactionId, '7100001');
  // the same callback again
  const again = await callback(paid(orderId));
  assert.deepEqual((await again.json()).results, ['duplicate']);
  assert.equal(stub.calls.filter((c) => c.method === 'approveTransaction').length, 1, 'no second approve');
  // nothing stored holds a token, an address or the payer
  const stored = JSON.stringify([rows(h.env, 'SELECT * FROM billing_events'), rows(h.env, 'SELECT * FROM payments'), rows(h.env, 'SELECT * FROM audit_log')]);
  for (const v of ['a1b2c3d4e5f60718293a4b5c6d7e8f90', 'Test Parent', '0500000000', 'parent@example.com', '4580', '@']) assert.ok(!stored.includes(v), v);
});

test('Grow unreachable while pulling the truth: 503, nothing written; the retry then activates the plan', async () => {
  let orderId; let down = true;
  await growSetup({
    createPaymentProcess: JSON.parse(fx('create-process')),
    getTransactionInfo: () => (down ? new Response('oops', { status: 500 }) : truthFor(orderId)),
    approveTransaction: ok({}),
  });
  const t = await signIn(h, 'buyer@example.test');
  orderId = (await (await buy(t, 'family_month')).json()).orderId;
  const r = await callback(paid(orderId));
  assert.equal(r.status, 503);
  assert.equal(rows(h.env, 'SELECT * FROM billing_events').length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions').length, 0);
  down = false;
  assert.equal((await callback(paid(orderId))).status, 200);
  assert.equal(one(h.env, 'SELECT status FROM subscriptions').status, 'active');
});

test('a live truth while BILLING_MODE is "test" (a live base) grants nothing: test_mode', async () => {
  let orderId;
  const live = 'https://grow.example.test/api/light/server/1.0/';
  const calls = [];
  h = await setup({ ...GROW, GROW_API_BASE: live, BILLING_CHECKOUT_HOSTS: 'grow.example.test' }, {
    other: async (url, _b, init) => {
      const method = url.slice(live.length); calls.push(method);
      const body = method === 'createPaymentProcess' ? { status: 1, data: { processId: 1, processToken: 'x', url: 'https://grow.example.test/p/1' } } : truthFor(orderId);
      return new Response(JSON.stringify(body), { status: 200 });
    },
  });
  assert.equal(growBase(h.env), live);
  const t = await signIn(h, 'buyer@example.test');
  orderId = (await (await buy(t, 'family_month')).json()).orderId;
  const r = await callback(paid(orderId));
  assert.deepEqual((await r.json()).results, ['test_mode']);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions').length, 0);
});

test('WEBHOOK_ALLOWED_IPS: a callback from another address is 401 and writes nothing', async () => {
  await growSetup({}, { WEBHOOK_ALLOWED_IPS: '3.123.194.128' });
  const r = await callback(paid('0123456789abcdef'), { ip: '198.51.100.66' });
  assert.equal(r.status, 401);
  assert.equal(rows(h.env, 'SELECT * FROM billing_events').length, 0);
});

test('cancel: updateDirectDebit with the standing order\'s first charge and changeStatus 2; refund: refundTransaction with "29.90"', async () => {
  let orderId;
  const stub = await growSetup({
    createPaymentProcess: JSON.parse(fx('create-process')),
    getTransactionInfo: () => truthFor(orderId),
    approveTransaction: ok({}),
    updateDirectDebit: ok({}),
    refundTransaction: ok({ refundTransactionId: 7200001 }),
  });
  const t = await signIn(h, 'buyer@example.test');
  orderId = (await (await buy(t, 'family_month')).json()).orderId;
  await callback(paid(orderId));
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  // within 14 days: a full refund, and the standing order stops
  const c = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': t }, body: { subscriptionId: sub.id, mode: 'refund_now' } });
  assert.equal(c.status, 200, await c.clone().text());
  const dd = stub.calls.find((x) => x.method === 'updateDirectDebit');
  assert.deepEqual(dd.fields, { userId: 'grow-user-test', transactionId: '7100001', transactionToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', asmachta: '0123456', changeStatus: '2' });
  assert.ok(one(h.env, 'SELECT cancel_synced_at FROM subscriptions').cancel_synced_at, 'the cancel reached Grow');
  await h.ctx.flush?.();
  const { processRefundQueue } = await import('../src/billing.js');
  await processRefundQueue(h.env);
  const rf = stub.calls.find((x) => x.method === 'refundTransaction');
  assert.ok(rf, 'refundTransaction called');
  assert.equal(rf.fields.refundSum, '29.90');
  assert.equal(rf.fields.transactionId, '7100001');
  assert.ok(one(h.env, 'SELECT done_at FROM refund_queue').done_at);
});

test('GROW_DIRECT_DEBIT_API "off": the monthly plan is not sold online and the plans say so; the one-year plans still are', async () => {
  const stub = await growSetup({ createPaymentProcess: JSON.parse(fx('create-process')) }, { GROW_DIRECT_DEBIT_API: 'off' });
  assert.equal(capsOf(h.env, grow).cancelApi, false);
  assert.equal(planOnline(h.env, 'family_month'), false);
  // the one-year family plan never renews by itself (TRUST-10): one charge, no standing order to stop, so it needs no
  // permission from Grow (COUNCIL2-30; before, no family plan could be bought online with Grow)
  assert.equal(planOnline(h.env, 'family_year'), true);
  assert.equal(planOnline(h.env, 'class_year'), true);
  assert.equal(onlineCheckout(h.env), true);
  const plans = plansView(h.env);
  assert.equal(plans.online, true, 'the yearly plan on /parents');
  // the exam pass is one charge too (COUNCIL2-33): sold through Grow with no permission, on the one-time page
  assert.deepEqual(plans.plans.map((p) => [p.id, p.online]), [['family_month', false], ['family_year', true], ['exam_pass', true], ['class_year', true]]);
  const t = await signIn(h, 'buyer@example.test');
  const r = await buy(t, 'family_month');
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error, 'checkout_not_configured');
  assert.equal(stub.calls.length, 0, 'Grow is not asked for a page');
  const y = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': t, 'Idempotency-Key': 'attempt-year-0123456789ab' }, body: { adult: true, terms: '2026-11', plan: 'family_year' } });
  assert.equal(y.status, 201);
  assert.equal(stub.calls.at(-1).fields.pageCode, 'page-once');
  // with the permission: the monthly plan is sold
  h.env.GROW_DIRECT_DEBIT_API = 'on';
  assert.equal(planOnline(h.env, 'family_month'), true);
  assert.equal(plansView(h.env).online, true);
});

test('the provider is off without its keys or, in live mode, without GROW_API_BASE (never a guessed live address)', () => {
  assert.equal(grow.enabled({ ...GROW }), true);
  assert.equal(grow.enabled({ ...GROW, GROW_USER_ID: '' }), false);
  assert.equal(grow.enabled({ ...GROW, BILLING_MODE: 'live' }), false);
  assert.equal(grow.enabled({ ...GROW, BILLING_MODE: 'live', GROW_API_BASE: 'https://grow.example.test/api/' }), true);
  assert.equal(growBase({ GROW_API_BASE: 'http://grow.example.test/' }), null, 'never plain http');
  assert.equal(growBase({ BILLING_MODE: 'test' }), GROW_SANDBOX);
});

test('the welcome email says Grow sends the receipt', async () => {
  const { renderNotice, RECEIPT_BY_GROW } = await import('../src/email.js');
  const m = renderNotice({ BILLING_PROVIDER: 'grow', PUBLIC_URL: 'https://madregot.example.test' }, { kind: 'welcome', params: JSON.stringify({ plan: 'family_month', priceAgorot: 2990, periodEnd: '2026-12-11T10:00:00Z' }) });
  assert.ok(m.lines.includes(RECEIPT_BY_GROW));
  assert.equal(RECEIPT_BY_GROW, 'הקבלה נשלחת אליכם במייל מ־Grow, חברת הסליקה.');
  const other = renderNotice({ BILLING_PROVIDER: 'test' }, { kind: 'welcome', params: JSON.stringify({ plan: 'family_month', priceAgorot: 2990, periodEnd: '2026-12-11T10:00:00Z' }) });
  assert.ok(!other.lines.includes(RECEIPT_BY_GROW));
});

// ---- the one-year family plan through Grow (COUNCIL2-30): one charge, no standing order
const YEAR_KEY = 'attempt-year-0123456789ab';
const buyYear = (token) => h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': YEAR_KEY }, body: { adult: true, terms: '2026-11', plan: 'family_year' } });
/** A regular (one-time) payment of the yearly plan: paymentType 2, ₪249, the order in cField1. */
const yearPaid = (orderId) => paid(orderId, { paymentType: '2', sum: '249.00', description: GROW_DESCRIPTIONS.family_year });
const yearTruth = (orderId) => truthFor(orderId, { paymentType: '2', sum: '249.00' });
/** A Grow that sells and refunds the yearly plan; `refund` answers refundTransaction. */
async function yearSetup({ refund = ok({ refundTransactionId: 7200002 }), ...over } = {}) {
  let orderId;
  const stub = await growSetup({
    createPaymentProcess: JSON.parse(fx('create-process')),
    getTransactionInfo: () => yearTruth(orderId),
    approveTransaction: ok({}),
    refundTransaction: refund,
  }, { GROW_DIRECT_DEBIT_API: 'off', ...over });
  const t = await signIn(h, 'buyer@example.test');
  const r = await buyYear(t);
  assert.equal(r.status, 201, await r.clone().text());
  orderId = (await r.json()).orderId;
  return { stub, t, orderId: () => orderId };
}

test('the one rule of what is sold online (shared/sold.js): Grow sells the one-year plans always and the monthly one with the permission', () => {
  const pass = { PRICE_EXAM_PASS_AGOROT: '3900' };
  assert.deepEqual(soldOnline({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'off', ...pass }),
    { family_month: false, family_year: true, exam_pass: true, class_year: true, family: true, recurring: false });
  assert.deepEqual(soldOnline({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'on', ...pass }),
    { family_month: true, family_year: true, exam_pass: true, class_year: true, family: true, recurring: true });
  assert.deepEqual(soldOnline({ BILLING_PROVIDER: 'manual', ...pass }), { family_month: false, family_year: false, exam_pass: false, class_year: false, family: false, recurring: false });
  // the exam pass has no price until the owner sets one (COUNCIL2-33): with none, no provider sells it
  for (const v of [undefined, '', '0', '-100', '39.90', 'abc']) {
    assert.equal(sellsOnline({ BILLING_PROVIDER: 'test', PRICE_EXAM_PASS_AGOROT: v }, 'exam_pass'), false, `price ${v}`);
  }
  assert.equal(sellsOnline({ BILLING_PROVIDER: 'test', PRICE_EXAM_PASS_AGOROT: ' 3900 ' }, 'exam_pass'), true);
  assert.deepEqual(soldOnline({}), soldOnline({ BILLING_PROVIDER: 'manual' }), 'no provider set: the manual one');
  assert.equal(soldOnline({ BILLING_PROVIDER: 'test' }).recurring, true);
  assert.equal(sellsOnline({ BILLING_PROVIDER: 'grow' }, 'family_year'), true);
  assert.equal(sellsOnline({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: ' ON ' }, 'family_month'), true);
  assert.equal(sellsOnline({ BILLING_PROVIDER: 'grow' }, 'term'), false, 'an unknown plan sells nothing');
  assert.equal(sellsOnline({ BILLING_PROVIDER: 'stripe' }, 'family_year'), false, 'an unknown provider sells nothing');
  // the adapter and the Worker read the same rule
  for (const dd of ['on', 'off']) for (const plan of ['family_month', 'family_year', 'exam_pass', 'class_year']) {
    assert.equal(grow.planOnline({ GROW_DIRECT_DEBIT_API: dd, ...pass }, plan), sellsOnline({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: dd, ...pass }, plan), `${plan} ${dd}`);
  }
});

test('the one-year plan end to end: the one-time page for ₪249, a paid callback with no standing order, a year, approve on the one-time page', async () => {
  const { stub, orderId } = await yearSetup();
  const create = stub.calls.find((c) => c.method === 'createPaymentProcess');
  assert.equal(create.fields.pageCode, 'page-once');
  assert.equal(create.fields.sum, '249.00');
  assert.equal(create.fields.description, GROW_DESCRIPTIONS.family_year);
  assert.equal(create.fields.cField1, orderId());
  const r = await callback(yearPaid(orderId()));
  assert.deepEqual((await r.json()).results, ['applied']);
  const sub = one(h.env, "SELECT * FROM subscriptions WHERE provider = 'grow'");
  assert.equal(sub.plan, 'family_year'); assert.equal(sub.status, 'active');
  assert.equal(sub.provider_subscription_id, null, 'one charge: no standing order at Grow');
  const days = (Date.parse(sub.current_period_end) - Date.parse(sub.current_period_start)) / 864e5;
  assert.ok(days >= 365 && days <= 366, `a year (${days} days)`);
  assert.equal(one(h.env, 'SELECT amount_agorot FROM payments').amount_agorot, 24900);
  const approve = stub.calls.find((c) => c.method === 'approveTransaction');
  assert.equal(approve.fields.pageCode, 'page-once');
  // a cancellation at the end of the year has nothing to stop at Grow, and is synced at once
  const c = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': (await signIn(h, 'buyer@example.test')) }, body: { subscriptionId: sub.id, mode: 'period_end' } });
  assert.equal(c.status, 200, await c.clone().text());
  assert.equal((await c.json()).synced, true);
  assert.equal(stub.calls.filter((x) => x.method === 'updateDirectDebit').length, 0);
});

test('the one-year plan within its 14 days: refund_now gives all ₪249 back through refundTransaction, and nothing is asked of the direct debit', async () => {
  const { stub, t, orderId } = await yearSetup();
  await callback(yearPaid(orderId()));
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  const c = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': t }, body: { subscriptionId: sub.id, mode: 'refund_now' } });
  assert.equal(c.status, 200, await c.clone().text());
  const answer = await c.json();
  assert.equal(answer.refundAgorot, 24900); assert.equal(answer.refundManual, false); assert.equal(answer.synced, true);
  await processRefundQueue(h.env);
  const rf = stub.calls.filter((x) => x.method === 'refundTransaction');
  assert.equal(rf.length, 1);
  assert.deepEqual(rf[0].fields, { userId: 'grow-user-test', transactionId: '7100001', transactionToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', refundSum: '249.00' });
  const q = one(h.env, 'SELECT * FROM refund_queue');
  assert.ok(q.done_at); assert.equal(q.reason, 'cooling_off'); assert.match(q.result, /refunded 7200002/);
  assert.equal(one(h.env, 'SELECT status, ended_reason FROM subscriptions').ended_reason, 'refunded');
  assert.equal(stub.calls.filter((x) => x.method === 'updateDirectDebit').length, 0);
});

test('the one-year plan after its 14 days: prorata gives back the unused days through refundTransaction; refund_now is closed', async () => {
  const { stub, t, orderId } = await yearSetup();
  await callback(yearPaid(orderId()));
  await h.ctx.flush(); // the welcome email went out (it starts the 14 days, email.js welcomeSent)
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  // 100 days into the year: the 14 days are over, 265 and a half days are left
  const now = Date.now(); const day = 864e5;
  const start = new Date(now - 100 * day).toISOString(); const end = new Date(now + 265.5 * day).toISOString();
  await h.env.DB.prepare('UPDATE subscriptions SET current_period_start = ?, current_period_end = ?, refund_until = ? WHERE id = ?')
    .bind(start, end, new Date(now - 86 * day).toISOString(), sub.id).run();
  const closed = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': t }, body: { subscriptionId: sub.id, mode: 'refund_now' } });
  assert.equal(closed.status, 409);
  assert.equal((await closed.json()).error, 'refund_window_closed');
  const c = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': t }, body: { subscriptionId: sub.id, mode: 'prorata' } });
  assert.equal(c.status, 200, await c.clone().text());
  const expected = Math.floor(24900 * 265 / Math.round((Date.parse(end) - Date.parse(start)) / day));
  assert.equal((await c.json()).refundAgorot, expected);
  await processRefundQueue(h.env);
  const rf = stub.calls.find((x) => x.method === 'refundTransaction');
  assert.equal(rf.fields.refundSum, (expected / 100).toFixed(2));
  assert.equal(one(h.env, 'SELECT reason FROM refund_queue').reason, 'prorata');
  assert.ok(one(h.env, 'SELECT done_at FROM refund_queue').done_at);
});

test('a refund Grow will not make by API goes to the owner at once; one Grow cannot be reached for is tried 3 times, then goes to the owner', async () => {
  // Grow refuses this method (Bit, an old charge): a manual refund, and the owner is told
  let ctx = await yearSetup({ refund: { status: 0, err: 'refund not allowed for this transaction' } });
  await callback(yearPaid(ctx.orderId()));
  let sub = one(h.env, 'SELECT * FROM subscriptions');
  await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': ctx.t }, body: { subscriptionId: sub.id, mode: 'refund_now' } });
  await processRefundQueue(h.env);
  let q = one(h.env, 'SELECT * FROM refund_queue');
  assert.equal(q.manual, 1); assert.equal(q.done_at, null); assert.equal(q.result, 'provider asks for a manual refund');
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:manual_refund'").length, 1);
  h.done(); h = null;
  // Grow does not answer: the row waits for the next hourly pass, and after the third failure goes to the owner
  ctx = await yearSetup({ refund: () => new Response('<html>busy</html>', { status: 502 }) });
  await callback(yearPaid(ctx.orderId()));
  sub = one(h.env, 'SELECT * FROM subscriptions');
  await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': ctx.t }, body: { subscriptionId: sub.id, mode: 'refund_now' } });
  q = one(h.env, 'SELECT * FROM refund_queue');
  assert.equal(q.tries, 1); assert.equal(q.result, 'failed'); assert.equal(q.manual, 0);
  await processRefundQueue(h.env);
  assert.equal(one(h.env, 'SELECT tries FROM refund_queue').tries, 2);
  await processRefundQueue(h.env);
  q = one(h.env, 'SELECT * FROM refund_queue');
  assert.equal(q.tries, 3); assert.equal(q.manual, 1); assert.equal(q.result, 'failed 3 times');
  await processRefundQueue(h.env);
  assert.equal(ctx.stub.calls.filter((x) => x.method === 'refundTransaction').length, 3, 'a manual row is not tried again');
});

// ---- every error branch of a server call and of the adapter (COUNCIL2-25)
/** call() against a stubbed fetch, outside the Worker. */
async function callWith(answer, env = { ...GROW }) {
  const net = stubFetch({ other: async () => (typeof answer === 'function' ? answer() : answer) });
  const logged = []; const err = console.error; console.error = (...a) => logged.push(a.join(' '));
  try { return { value: await call(env, 'getTransactionInfo', { transactionId: '7100001' }), logged }; } catch (e) { return { error: e, logged }; } finally { console.error = err; net.restore(); }
}

test('call(): a network error, an answer that is not JSON, a status other than 1 and missing keys are each a GrowError naming only the method', async () => {
  const net = await callWith(() => { throw new TypeError('fetch failed: connect ECONNREFUSED sandbox.meshulam.co.il'); });
  assert.ok(net.error instanceof GrowError); assert.equal(net.error.message, 'grow: getTransactionInfo failed');
  assert.deepEqual(net.logged, ['grow: getTransactionInfo failed no answer']);
  const html = await callWith(new Response('<html>Bad gateway</html>', { status: 502 }));
  assert.equal(html.error.message, 'grow: getTransactionInfo failed');
  assert.deepEqual(html.logged, ['grow: getTransactionInfo failed 502']);
  const refused = await callWith(new Response(JSON.stringify({ status: 0, err: 'transactionId not found' }), { status: 200 }));
  assert.equal(refused.error.message, 'grow: getTransactionInfo failed (transactionId not found)');
  assert.deepEqual(refused.logged, ['grow: getTransactionInfo failed 200'], 'Grow\'s own words are never logged');
  const nostatus = await callWith(new Response(JSON.stringify({ data: { statusCode: 2 } }), { status: 200 }));
  assert.ok(nostatus.error instanceof GrowError, 'no status: not a success');
  const nodata = await callWith(new Response(JSON.stringify({ status: 1 }), { status: 200 }));
  assert.deepEqual(nodata.value, {}, 'success with no data: an empty object');
  for (const env of [{ ...GROW, GROW_USER_ID: '' }, { ...GROW, BILLING_MODE: 'live' }]) {
    const off = await callWith(() => assert.fail('no request without the keys'), env);
    assert.equal(off.error.message, 'grow: getTransactionInfo failed (not configured)');
  }
  // the long text Grow sends is cut short in the error
  const long = await callWith(new Response(JSON.stringify({ status: 0, err: 'x'.repeat(200) }), { status: 200 }));
  assert.equal(long.error.message, `grow: getTransactionInfo failed (${'x'.repeat(60)})`);
});

test('checkout: no page code or a plan Grow does not sell is 501 with no call; a page with no address is 502 bad_checkout_url', async () => {
  const stub = await growSetup({ createPaymentProcess: ok({ processId: 1, processToken: 'x' }) }, { GROW_PAGE_CODE_RECURRING: '' });
  const t = await signIn(h, 'buyer@example.test');
  const r = await buy(t, 'family_month');
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error, 'checkout_not_configured');
  assert.equal(stub.calls.length, 0);
  await assert.rejects(grow.createCheckout({ ...GROW, GROW_DIRECT_DEBIT_API: 'off' }, { order: { id: 'o', amount_agorot: 2990 }, plan: 'family_month' }), { status: 501 });
  // Grow answers success but leaves out the page: no address to send the payer to
  const y = await buyYear(t);
  assert.equal(y.status, 502);
  assert.equal((await y.json()).error, 'bad_checkout_url');
  assert.equal(stub.calls.length, 1);
});

test('fetchTruth: a callback with no transaction is read by its process (from the hint or from the order), and an unknown code is no truth', async () => {
  let orderId;
  const stub = await growSetup({
    createPaymentProcess: JSON.parse(fx('create-process')),
    getPaymentProcessInfo: (f) => (f.processToken ? truthFor(orderId, { paymentType: '2', sum: '249.00' }) : { status: 0, err: 'token' }),
    getTransactionInfo: () => yearTruth(orderId),
    approveTransaction: ok({}),
  }, { GROW_DIRECT_DEBIT_API: 'off' });
  const t = await signIn(h, 'buyer@example.test');
  orderId = (await (await buyYear(t)).json()).orderId;
  // the hint carries the process and its token
  let truth = await grow.fetchTruth(h.env, { providerPaymentId: null, process: { id: '5100001', token: 'f0e1d2c3b4a5968778695a4b3c2d1e0f' }, orderRef: orderId });
  assert.equal(truth.status, 'paid'); assert.equal(truth.orderRef, orderId); assert.equal(truth.amountAgorot, 24900);
  assert.equal(truth.mode, 'test'); assert.equal(truth.providerSubscriptionId, null);
  assert.equal(truth.occurredAt, '2026-11-11T10:00:00.000Z', 'Grow\'s dd/mm/yy at noon in Jerusalem');
  assert.deepEqual(stub.calls.at(-1).fields, { userId: 'grow-user-test', processId: '5100001', processToken: 'f0e1d2c3b4a5968778695a4b3c2d1e0f' });
  // only the order: its process is the checkout's (orders.provider_checkout_id)
  truth = await grow.fetchTruth(h.env, { providerPaymentId: null, process: null, orderRef: orderId });
  assert.equal(truth.status, 'paid');
  // nothing to look up: not settled
  assert.equal(await grow.fetchTruth(h.env, { providerPaymentId: null, process: null, orderRef: 'unknown-order' }), null);
  // a code that is neither paid, refunded, canceled nor failed (0, not paid yet): no truth, try later
  h.done();
  await growSetup({ getTransactionInfo: () => truthFor('o', { statusCode: '0' }) });
  assert.equal(await grow.fetchTruth(h.env, { providerPaymentId: '7100001' }), null);
});

test('callbacks: a form callback with no data, odd values or no ids gives no hint; a refused or unknown code gives none; a refund and a failure do', () => {
  const env = { ...GROW };
  const json = new Headers({ 'Content-Type': 'application/json' });
  const form = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' });
  assert.deepEqual(grow.parse(env, '', form), []);
  assert.deepEqual(grow.parse(env, 'not json at all {', json), []);
  assert.deepEqual(grow.parse(env, 'null', json), []);
  assert.deepEqual(grow.parse(env, 'weird[key]=1&data[statusCode]=2', form), [], 'no ids: no hint');
  assert.deepEqual(grow.parse(env, paid('x', { sum: '12,90' }), json), [], 'a sum that is not a number: no hint');
  assert.deepEqual(grow.parse(env, paid('x', { transactionId: '', processId: '' }), json), [], 'neither a transaction nor a process');
  assert.deepEqual(grow.parse(env, paid('x', { statusCode: '7' }), json), [], 'an unknown code');
  const refund = grow.parse(env, paid('x', { statusCode: '6' }), json)[0];
  assert.equal(refund.type, 'refunded'); assert.equal(refund.eventId, 'grow:7100001:6');
  assert.equal(grow.parse(env, paid('x', { statusCode: '9' }), json)[0].type, 'failed');
  // a process alone (no transaction yet): the hint keeps the process to look it up, and no acknowledgement
  const proc = grow.parse(env, paid('x', { transactionId: '', transactionToken: '' }), json)[0];
  assert.equal(proc.providerPaymentId, null); assert.deepEqual(proc.process, { id: '5100001', token: 'f0e1d2c3b4a5968778695a4b3c2d1e0f' }); assert.equal(proc.ack, null);
  // a one-time payment (paymentType 2) is no standing order; a bare JSON body without the data wrapper is read too
  const once = grow.parse(env, JSON.stringify(JSON.parse(paid('0123456789abcdef', { paymentType: '2' })).data), json)[0];
  assert.equal(once.providerSubscriptionId, null); assert.equal(once.orderRef, '0123456789abcdef');
  // form fields with no "data[...]" wrapper
  const flat = grow.parse(env, 'statusCode=2&transactionId=7100009&processId=5100009&cField1=abc', form)[0];
  assert.equal(flat.providerPaymentId, '7100009'); assert.equal(flat.orderRef, 'abc');
});

test('the callback\'s address list: an allowed address passes, any other is 401, and with no list every address passes (the path secret guards)', async () => {
  await growSetup({}, { WEBHOOK_ALLOWED_IPS: '3.123.194.128, 3.123.194.129' });
  const req = (ip) => new Request('https://madregot.test/x', { headers: { 'CF-Connecting-IP': ip } });
  await assert.doesNotReject(grow.verify(h.env, req('3.123.194.129')));
  await assert.rejects(grow.verify(h.env, req('198.51.100.66')), { status: 401 });
  await assert.rejects(grow.verify(h.env, new Request('https://madregot.test/x')), { status: 401 }, 'no address at all');
  await assert.doesNotReject(grow.verify({ ...GROW, WEBHOOK_ALLOWED_IPS: '' }, req('198.51.100.66')));
});

test('approve, cancel and refund when there is nothing to do or Grow says no', async () => {
  const stub = await growSetup({
    getTransactionInfo: () => truthFor('o'),
    approveTransaction: ok({}),
    updateDirectDebit: { status: 0, err: 'not allowed' },
    refundTransaction: { status: 0, err: 'server error' },
  });
  // no transaction to approve: no call
  await grow.acknowledge(h.env, { ack: null });
  await grow.acknowledge(h.env, null);
  assert.equal(stub.calls.length, 0);
  // a one-time plan has nothing to stop; a standing order needs the permission and its first charge
  assert.deepEqual(await grow.cancel(h.env, { id: 's1', provider_subscription_id: null }), { synced: true });
  await assert.rejects(grow.cancel({ ...h.env, GROW_DIRECT_DEBIT_API: 'off' }, { id: 's1', provider_subscription_id: 'dd:o' }), /updateDirectDebit failed \(not enabled\)/);
  await assert.rejects(grow.cancel(h.env, { id: 'no-such-sub', provider_subscription_id: 'dd:o' }), /updateDirectDebit failed \(no charge\)/);
  assert.equal(stub.calls.length, 0, 'nothing reached Grow');
  assert.deepEqual(await grow.resume(), { synced: false });
  assert.equal(await grow.fetchSubscription(), null);
  assert.equal(grow.portalUrl(), null);
  // a refund with no Grow charge behind it is the owner's; a failure that is not "cannot refund" is retried (thrown)
  assert.deepEqual(await grow.refund(h.env, null, { amountAgorot: 100 }), { refunded: false, manual: true });
  assert.deepEqual(await grow.refund(h.env, { provider_payment_id: '' }, { amountAgorot: 100 }), { refunded: false, manual: true });
  await assert.rejects(grow.refund(h.env, { provider_payment_id: '7100001' }, { amountAgorot: 100 }), /refundTransaction failed \(server error\)/);
  // a refund Grow made with no refund id of its own is keyed by the charge
  h.done();
  await growSetup({ getTransactionInfo: () => truthFor('o'), refundTransaction: ok({}) });
  assert.deepEqual(await grow.refund(h.env, { provider_payment_id: '7100001' }, { amountAgorot: 2990 }), { refunded: true, manual: false, providerRefundId: '7100001:r' });
  assert.deepEqual(capsOf({ ...GROW, GROW_DIRECT_DEBIT_API: 'off' }, grow), { ...grow.capabilities, cancelApi: false });
});

test('the truth from a sparse answer keeps the hint\'s ids, a four-digit year and no date at all; the API key goes with every call', async () => {
  const stub = await growSetup({
    getTransactionInfo: (f) => (f.transactionId === '7100002'
      ? ok({ statusCode: '2', sum: 'n/a', paymentDate: '1/2/2027' })
      : ok({ statusCode: '6', transactionId: '7100003', paymentType: '1' })),
  }, { GROW_API_KEY: 'grow-key-test' });
  const sparse = await grow.fetchTruth(h.env, { providerPaymentId: '7100002', orderRef: 'order-from-hint', providerSubscriptionId: null });
  assert.equal(sparse.status, 'paid');
  assert.equal(sparse.orderRef, 'order-from-hint', 'no cField1 in the answer: the hint\'s order');
  assert.equal(sparse.providerPaymentId, '7100002');
  assert.equal(sparse.amountAgorot, 0, 'a sum that is not a number counts as nothing');
  assert.equal(sparse.occurredAt, '2027-02-01T10:00:00.000Z');
  const before = Date.now();
  const refund = await grow.fetchTruth(h.env, { providerPaymentId: '7100003', orderRef: null, providerSubscriptionId: 'dd:o1' });
  assert.equal(refund.status, 'refunded'); assert.equal(refund.orderRef, null);
  assert.equal(refund.providerSubscriptionId, 'dd:o1', 'a standing order with no order in the answer: the hint\'s');
  assert.ok(Date.parse(refund.occurredAt) >= before, 'no payment date: now');
  for (const c of stub.calls) assert.equal(c.fields.apiKey, 'grow-key-test');
  // without GROW_DIRECT_DEBIT_API at all, the monthly plan is not sold and nothing can be stopped
  assert.equal(grow.planOnline({}, 'family_month'), false);
  assert.equal(capsOf({}, grow).cancelApi, false);
});

test('callbacks: no headers at all, and a form with two fields of one group, are read as JSON and as one object', () => {
  const env = { ...GROW };
  const [hint] = grow.parse(env, paid('0123456789abcdef'));
  assert.equal(hint.orderRef, '0123456789abcdef');
  const form = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' });
  const body = 'data[statusCode]=2&data[transactionId]=7100004&data[customFields][cField1]=ord4&data[customFields][cField2]=x&data[customFields]=flat';
  const [h4] = grow.parse(env, body, form);
  assert.equal(h4.orderRef, null, 'a group overwritten by a plain value has no order');
  const [h5] = grow.parse(env, 'data[statusCode]=2&data[transactionId]=7100005&data[customFields][cField2]=x&data[customFields][cField1]=ord5', form);
  assert.equal(h5.orderRef, 'ord5');
  assert.equal(h5.process, null, 'no process in the callback');
  assert.deepEqual(h5.ack, { transactionId: '7100005', transactionToken: '', processId: '', processToken: '', sum: '', paymentType: '', transactionTypeId: '', asmachta: '' });
});

// ---- the owner's contract test against Grow's real sandbox (step 4 in SUBSCRIPTION.md): skipped unless asked for
const devVarsPath = new URL('../.dev.vars', import.meta.url);
const sandbox = process.env.GROW_SANDBOX === '1' && existsSync(devVarsPath) ? devVarValues(readFileSync(devVarsPath, 'utf8')) : null;
test('contract: a real sandbox createPaymentProcess gives an https page on a host in BILLING_CHECKOUT_HOSTS, and the process is not paid', { skip: !sandbox?.GROW_USER_ID && 'GROW_SANDBOX=1 and the Grow keys in .dev.vars' }, async () => {
  const { call } = await import('../src/providers/grow.js');
  const env = { ...sandbox, BILLING_MODE: 'test', GROW_API_BASE: '' };
  const data = await call(env, 'createPaymentProcess', { sum: '1.00', description: 'contract test', cField1: 'contract', successUrl: 'https://madregot.example.test/parents', cancelUrl: 'https://madregot.example.test/parents', notifyUrl: 'https://madregot.example.test/x' }, { pageCode: env.GROW_PAGE_CODE_ONCE });
  const url = new URL(String(data.url));
  assert.equal(url.protocol, 'https:');
  const hosts = String(sandbox.BILLING_CHECKOUT_HOSTS || '').split(',').map((s) => s.trim());
  assert.ok(hosts.includes(url.host), `set BILLING_CHECKOUT_HOSTS = "${url.host}"`);
  const info = await call(env, 'getPaymentProcessInfo', { processId: data.processId, processToken: data.processToken });
  assert.equal(Number(info.statusCode), 0);
});
