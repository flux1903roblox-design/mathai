// Grow, the Israeli payment company (PARENTS-11, src/providers/grow.js), against a stub of its server API (every call is
// multipart form data to <base><method>): checkout, the callback that is never trusted (ids and codes only, the payer's
// details dropped), the truth pulled with our credentials, a repeated or lost callback, the sandbox/live mode check,
// the IP list, approve, cancel by updateDirectDebit, refund, and the monthly plan kept off until Grow enables the cancel.
// The fixtures are synthetic: payer "Test Parent", phone 0500000000, parent@example.com.
// A contract test against Grow's real sandbox runs only with GROW_SANDBOX=1 and the four keys in .dev.vars (the owner's
// step 4 in SUBSCRIPTION.md); otherwise it is skipped.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import grow, { growBase, GROW_SANDBOX, GROW_DESCRIPTIONS } from '../src/providers/grow.js';
import { capsOf } from '../src/providers/index.js';
import { planOnline, onlineCheckout, plansView } from '../src/billing.js';
import { setup, signIn, rows, one, makeClass } from './helpers.js';
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

test('GROW_DIRECT_DEBIT_API "off": the monthly plan is not sold online and the plans say so; the class licence still is', async () => {
  await growSetup({ createPaymentProcess: JSON.parse(fx('create-process')) }, { GROW_DIRECT_DEBIT_API: 'off' });
  assert.equal(capsOf(h.env, grow).cancelApi, false);
  assert.equal(planOnline(h.env, 'family_month'), false);
  assert.equal(planOnline(h.env, 'family_year'), false, 'the renewing yearly plan waits for the one-year plan (TRUST-10)');
  assert.equal(planOnline(h.env, 'class_year'), true);
  assert.equal(onlineCheckout(h.env), true);
  const plans = plansView(h.env);
  assert.equal(plans.online, false, 'no family plan on /parents');
  assert.deepEqual(plans.plans.map((p) => [p.id, p.online]), [['family_month', false], ['family_year', false], ['class_year', true]]);
  const t = await signIn(h, 'buyer@example.test');
  const r = await buy(t, 'family_month');
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error, 'checkout_not_configured');
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
