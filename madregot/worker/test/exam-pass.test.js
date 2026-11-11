// The exam pass (COUNCIL2-29, COUNCIL2-33): the family plan for 30 days, sold as one charge. It never renews: no
// standing order is asked for, nothing is charged again, and it ends 30 days after the payment. It gives what the family
// plan gives (linked devices, the full tutor, the parents' report). Its price is the owner's decision
// (PRICE_EXAM_PASS_AGOROT): unset, nothing sells it. Cancelling follows the terms of the plans paid once: the whole
// price back in the first 14 days, then the unused days. The test provider stands in for a payment company, and Grow's
// server is a stub; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { plansView, planOnline, prices, onlineCheckout } from '../src/billing.js';
import { decide, planEnd } from '../src/apply.js';
import { endFinished, reconcile, ENDS_AT_END } from '../src/cron.js';
import { renderNotice } from '../src/email.js';
import { setup, signIn, accountId, signedTestEvent, one, rows, advanceClock, linkDevice, ai } from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const PASS = 3900;
const iso = (ms) => new Date(ms).toISOString();
let n = 0;

async function checkout(token, plan = 'exam_pass', key = `exam-pass-test-${n++}-abcdefgh`) {
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': key }, body: { plan, adult: true, terms: '2026-11' } });
  return { status: r.status, body: await r.json() };
}
async function event(ev) {
  const s = await signedTestEvent(h.env, { currency: 'ILS', ...ev });
  const r = await h.call('POST', `/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, { body: s.body, headers: s.headers });
  assert.equal(r.status, 200);
  return (await r.json()).results;
}
/** A parent who bought the pass through the test payment page. → { token, a, sub, orderId } */
async function bought(email = 'pass@example.test') {
  const token = await signIn(h, email);
  const { status, body } = await checkout(token);
  assert.equal(status, 201, JSON.stringify(body));
  const paid = await h.call('POST', `/api/billing/test-pay/${body.orderId}`, { body: { result: 'paid' } });
  assert.equal(paid.status, 303);
  await h.ctx.flush();
  const a = accountId(h.env, email);
  return { token, a, orderId: body.orderId, sub: one(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', a) };
}
const account = async (token) => (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
const cancel = async (token, subscriptionId, mode) => {
  const r = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token }, body: { subscriptionId, mode } });
  return { status: r.status, body: await r.json() };
};

// ---------------------------------------------------------------- what is sold, and at what price
test('plans: the exam pass is a family plan of 30 days, one charge, never renewed, at the price the owner set', async () => {
  h = await setup();
  const p = plansView(h.env);
  assert.deepEqual(p.plans.find((x) => x.id === 'exam_pass'),
    { id: 'exam_pass', kind: 'family', interval: 'once', amountAgorot: PASS, vatAgorot: 595, renews: false, termDays: 30, online: true });
  assert.equal(p.online, true);
  assert.equal(prices(h.env).exam_pass, PASS);
  const served = await (await h.call('GET', '/api/billing/plans')).json();
  assert.equal(served.plans.find((x) => x.id === 'exam_pass').online, true);
  // an exempt dealer charges no VAT on it either
  assert.equal(plansView({ ...h.env, VAT_MODE: 'exempt' }).plans.find((x) => x.id === 'exam_pass').vatAgorot, 0);
});

test('no price set (the owner has not decided): the pass is listed with no price, sold nowhere, and checkout refuses it', async () => {
  h = await setup({ PRICE_EXAM_PASS_AGOROT: '' });
  const pass = plansView(h.env).plans.find((x) => x.id === 'exam_pass');
  assert.deepEqual([pass.amountAgorot, pass.vatAgorot, pass.online], [null, null, false]);
  assert.equal(planOnline(h.env, 'exam_pass'), false);
  assert.equal(onlineCheckout(h.env), true, 'the other plans still sell');
  const token = await signIn(h, 'noprice@example.test');
  const r = await checkout(token);
  assert.deepEqual([r.status, r.body.error], [501, 'checkout_not_configured']);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM orders').n, 0);
});

test('every gate of the other plans holds for the pass: the paywall, the legal texts, the provider, a family plan already live', async () => {
  h = await setup({ AI_PAYWALL: 'off' });
  assert.equal(planOnline(h.env, 'exam_pass'), false);
  h.done();
  h = await setup({ LEGAL_APPROVED: '' });
  assert.equal(planOnline(h.env, 'exam_pass'), false);
  h.done();
  h = await setup({ BILLING_PROVIDER: 'manual' });
  assert.equal(planOnline(h.env, 'exam_pass'), false, 'the manual provider sells nothing online');
  h.done();
  // a family with a monthly plan cannot add a pass beside it (one family plan at a time), nor a second pass
  h = await setup();
  const { token } = await bought('twice@example.test');
  assert.deepEqual([(await checkout(token)).status, (await checkout(token, 'family_month')).status], [409, 409]);
});

// ---------------------------------------------------------------- bought: 30 days of the family plan, one charge
test('bought: one charge with no standing order, 30 days from the payment, the family plan on linked devices, the report on /parents', async () => {
  h = await setup();
  const { default: provider } = await import('../src/providers/test.js');
  const real = provider.createCheckout;
  const asked = [];
  provider.createCheckout = async (env, args) => { asked.push([args.plan, args.recurring, args.order.amount_agorot]); return real.call(provider, env, args); };
  let b;
  try { b = await bought(); } finally { provider.createCheckout = real; }
  assert.deepEqual(asked, [['exam_pass', false, PASS]], 'one charge: the provider is not asked for a standing order');
  const { sub } = b;
  assert.equal(sub.plan, 'exam_pass');
  assert.equal(sub.kind, 'family');
  assert.equal(sub.status, 'active');
  assert.equal(sub.provider_subscription_id, null, 'no standing order is kept');
  assert.equal(sub.price_agorot, PASS);
  assert.equal(Date.parse(sub.current_period_end) - Date.parse(sub.current_period_start), 30 * DAY, 'exactly 30 days');
  // 14 days to cancel with the whole price back, from the later of the payment and the confirmation email (email.js)
  const window = Date.parse(sub.refund_until) - Date.parse(sub.first_paid_at);
  assert.ok(window >= 14 * DAY && window < 14 * DAY + 60_000, String(window));
  assert.deepEqual(rows(h.env, "SELECT kind, amount_agorot, period_end FROM payments WHERE subscription_id = ?", sub.id).map((x) => ({ ...x })),
    [{ kind: 'charge', amount_agorot: PASS, period_end: sub.current_period_end }]);
  // the order's welcome email: what was bought, until when, and that it does not renew
  const welcome = one(h.env, "SELECT * FROM notices WHERE ref = ? AND kind = 'welcome'", sub.id);
  const mail = renderNotice(h.env, welcome);
  assert.equal(mail.subject, 'חבילת המבחן של מדרגות פעילה');
  assert.match(mail.lines.join('\n'), /חבילת מבחן ל־30 יום: ₪39\.00, כולל מע״מ\. תשלום אחד, בלי חידוש אוטומטי\. בתוקף עד /);
  // the parent's page: the pass, its end, no renewal, a whole refund now
  const acct = await account(b.token);
  assert.equal(acct.plan.plan, 'exam_pass');
  assert.equal(acct.plan.renews, false);
  assert.equal(acct.plan.canRefundNow, true);
  assert.equal(acct.plan.canRenew, false);
  assert.equal(acct.plan.renewFrom, null);
  // the family plan's tutor on a linked device, and the device's summary for the parents' report
  const dev = await linkDevice(h.env, b.a);
  const r = await ai(h, 'explain', { ...dev.headers, 'X-Device': 'f'.repeat(32) });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'family');
  const acct2 = await account(b.token);
  assert.equal(acct2.devices[0].sharing === 'no_plan', false, 'the report counts the pass as a plan');
});

test('it never renews: no charge comes again, a second charge on the order goes back, and it ends after 30 days', async () => {
  h = await setup();
  const { a, sub, orderId } = await bought();
  // a provider that charged the order again anyway: a second payment for the same thing, refunded
  assert.deepEqual(await event({ id: `ev_${n++}`, type: 'paid', order: orderId, payment: `again_${orderId}`, amountAgorot: PASS, occurredAt: iso(Date.now()) }), ['duplicate_payment']);
  assert.equal(one(h.env, "SELECT reason FROM refund_queue WHERE subscription_id = ? AND reason = 'duplicate'", sub.id).reason, 'duplicate');
  // the nightly reconcile asks the provider only about plans that renew: the pass is not one of them
  advanceClock(31 * DAY);
  assert.equal((await reconcile(h.env)).checked, 0);
  // the night after its end, it ends; nothing is charged, and the tutor goes back to the free taste
  assert.ok(ENDS_AT_END.includes('exam_pass'));
  assert.equal(await endFinished(h.env), 1);
  assert.deepEqual({ ...one(h.env, 'SELECT status, ended_reason FROM subscriptions WHERE id = ?', sub.id) }, { status: 'ended', ended_reason: 'expired' });
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM payments WHERE subscription_id = ? AND kind = 'charge' AND status = 'ok'", sub.id).n, 1);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', a).length, 1);
});

test('the day the pass ends, the family can buy another at once (it ends at checkout, as the night would end it)', async () => {
  h = await setup();
  const { token, sub } = await bought('again@example.test');
  advanceClock(29 * DAY);
  assert.equal((await checkout(token)).status, 409, 'still running: one family plan at a time');
  advanceClock(1 * DAY + 60_000);
  const next = await checkout(token);
  assert.equal(next.status, 201, JSON.stringify(next.body));
  assert.deepEqual({ ...one(h.env, 'SELECT status, ended_reason FROM subscriptions WHERE id = ?', sub.id) }, { status: 'ended', ended_reason: 'expired' });
  assert.ok(one(h.env, "SELECT 1 AS x FROM audit_log WHERE action = 'subscription.reconcile' AND target = ? AND detail LIKE '%checkout%'", `sub:${sub.id}`));
});

// ---------------------------------------------------------------- cancelling (terms.md "ביטול והחזר")
test('cancelled within the 14 days: the whole price back through the provider, the pass ends at once', async () => {
  h = await setup();
  const { token, sub } = await bought('cool@example.test');
  advanceClock(5 * DAY);
  const r = await cancel(token, sub.id, 'refund_now');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, 'ended');
  assert.equal(r.body.refundAgorot, PASS);
  assert.equal(r.body.refundManual, false);
  const q = one(h.env, 'SELECT * FROM refund_queue WHERE subscription_id = ?', sub.id);
  assert.deepEqual([q.reason, q.amount_agorot, !!q.done_at], ['cooling_off', PASS, true], 'refunded by the provider at once');
  assert.deepEqual({ ...one(h.env, 'SELECT status, ended_reason FROM subscriptions WHERE id = ?', sub.id) }, { status: 'ended', ended_reason: 'refunded' });
  // the provider's report of that refund changes nothing more
  const charge = one(h.env, "SELECT provider_payment_id FROM payments WHERE subscription_id = ? AND kind = 'charge'", sub.id);
  assert.deepEqual(await event({ id: `ev_${n++}`, type: 'refunded', payment: charge.provider_payment_id, refund: `tref_refund:${q.id}`, amountAgorot: PASS, occurredAt: iso(Date.now()) }), ['applied']);
  assert.equal(one(h.env, 'SELECT status FROM subscriptions WHERE id = ?', sub.id).status, 'ended');
  // a cancellation email with the refund
  const notice = rows(h.env, "SELECT kind FROM notices WHERE ref = ? AND kind LIKE 'canceled:refund_now:%'", sub.id);
  assert.equal(notice.length, 1);
});

test('after the 14 days: the unused days back (pro rata), never the whole price; on its last day nothing is left to give back', async () => {
  h = await setup();
  const { token, sub } = await bought('late@example.test');
  advanceClock(20 * DAY);
  assert.deepEqual([(await cancel(token, sub.id, 'refund_now')).status, (await cancel(token, sub.id, 'refund_now')).body.error], [409, 'refund_window_closed']);
  const view = (await account(token)).plan;
  assert.equal(view.canRefundNow, false);
  assert.equal(view.canProrata, true);
  assert.equal(view.prorataAgorot, Math.floor(PASS * 9 / 30), 'the 9 whole days left of 30');
  const r = await cancel(token, sub.id, 'prorata');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.refundAgorot, Math.floor(PASS * 9 / 30));
  assert.deepEqual({ ...one(h.env, 'SELECT reason, amount_agorot FROM refund_queue WHERE subscription_id = ?', sub.id) }, { reason: 'prorata', amount_agorot: Math.floor(PASS * 9 / 30) });
  assert.deepEqual({ ...one(h.env, 'SELECT status, ended_reason FROM subscriptions WHERE id = ?', sub.id) }, { status: 'ended', ended_reason: 'canceled' });
  h.done();
  // the last day: under a whole day left, so no refund is offered
  h = await setup();
  const last = await bought('lastday@example.test');
  advanceClock(29.5 * DAY);
  const v = (await account(last.token)).plan;
  assert.deepEqual([v.canProrata, v.prorataAgorot], [true, 0]);
});

// ---------------------------------------------------------------- the end date, and Grow
test('the end: 30 days from the payment (not a calendar month), and the provider\'s own period when it gives one', () => {
  assert.equal(planEnd('exam_pass', '2027-01-31T10:00:00.000Z'), '2027-03-02T10:00:00.000Z');
  assert.equal(planEnd('exam_pass', '2027-03-20T22:30:00.000Z'), '2027-04-19T22:30:00.000Z', 'across the clock change: 30 × 24 hours');
  assert.equal(planEnd('family_month', '2027-01-31T10:00:00.000Z'), '2027-02-28T10:00:00.000Z', 'the monthly plan stays a calendar month');
  const ctx = {
    mode: 'test', now: '2027-01-31T10:00:00.000Z', provider: 'test', eventId: 'e1', graceDays: 3, ids: { sub: 's1', payment: 'p1' },
    order: { id: 'o1', plan: 'exam_pass', status: 'open', amount_agorot: PASS, account_id: 'a1' },
  };
  const truth = { status: 'paid', mode: 'test', currency: 'ILS', amountAgorot: PASS, orderRef: 'o1', providerPaymentId: 'pp1', providerSubscriptionId: 'tsub_x', occurredAt: '2027-01-31T10:00:00.000Z' };
  const d = decide(truth, ctx);
  const row = d.ops.find((o) => o.op === 'sub.insert').row;
  assert.deepEqual([row.plan, row.kind, row.current_period_end, row.provider_subscription_id], ['exam_pass', 'family', '2027-03-02T10:00:00.000Z', null],
    'a standing order the provider reports anyway is not kept for a pass');
});

test('Grow sells the pass on its one-time page with no permission for standing orders', async () => {
  const pages = [];
  h = await setup({
    BILLING_PROVIDER: 'grow', BILLING_MODE: 'test', GROW_USER_ID: 'grow-user', GROW_PAGE_CODE_ONCE: 'page-once', GROW_PAGE_CODE_RECURRING: 'page-rec',
    GROW_DIRECT_DEBIT_API: 'off', BILLING_CHECKOUT_HOSTS: 'sandbox.meshulam.co.il',
  }, {
    other: async (url, f) => {
      if (!String(url).includes('meshulam')) return null;
      pages.push({ method: String(url).split('/').at(-1), pageCode: f.get('pageCode'), sum: f.get('sum'), description: f.get('description'), cField1: f.get('cField1') });
      return new Response(JSON.stringify({ status: 1, err: '', data: { url: 'https://sandbox.meshulam.co.il/s/abc', processId: '123', processToken: 'tok' } }), { headers: { 'Content-Type': 'application/json' } });
    },
  });
  assert.equal(planOnline(h.env, 'exam_pass'), true);
  assert.equal(planOnline(h.env, 'family_month'), false);
  const token = await signIn(h, 'grow-pass@example.test');
  const r = await checkout(token);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual(pages, [{ method: 'createPaymentProcess', pageCode: 'page-once', sum: '39.00', description: 'מדרגות · חבילת מבחן ל־30 יום', cField1: r.body.orderId }]);
});
