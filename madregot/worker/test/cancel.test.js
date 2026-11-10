// Cancellation: the payer's notice takes effect here and now, even when the provider is down; refunds in the cooling-off
// window and pro rata; resume. The test provider stands in for a payment company.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { retryCancels, processRefundQueue, cancelReference } from '../src/billing.js';
import { setup, signIn, accountId, insertSub, signedTestEvent, rows, one, advanceClock } from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
let n = 0;

/** A family plan bought through checkout and the test provider, paid `ago` ms ago. */
async function bought({ plan = 'family_month', ago = 0, email = `c${n++}@example.test` } = {}) {
  const token = await signIn(h, email);
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': `cancel-test-${n++}-0123456` }, body: { plan, adult: true, terms: '2026-11' } });
  const { orderId } = await r.json();
  const amount = plan === 'family_year' ? 24900 : 2990;
  const s = await signedTestEvent(h.env, { id: `ev${n++}`, type: 'paid', order: orderId, payment: `pay_${orderId}`, subscription: `sub_${orderId}`, amountAgorot: amount, currency: 'ILS', occurredAt: new Date(Date.now() - ago).toISOString() });
  assert.equal((await h.call('POST', `/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, { body: s.body, headers: s.headers })).status, 200);
  const sub = one(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', accountId(h.env, email));
  return { token, sub, email };
}
const cancel = (b, mode, token = b.token) => h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token }, body: { subscriptionId: b.sub.id, mode } });
const cancelNotices = () => rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'canceled:%'");

test('period_end: records the notice once, tells the provider once with cancel:<id>, keeps access to the end, one email with a reference', async () => {
  const calls = [];
  h = await setup();
  const { default: testProvider } = await import('../src/providers/test.js');
  const realCancel = testProvider.cancel;
  testProvider.cancel = async (env, sub, opts) => { calls.push(opts.idempotencyKey); return realCancel(env, sub, opts); };
  try {
    const b = await bought();
    const r = await cancel(b, 'period_end');
    assert.equal(r.status, 200);
    const ans = await r.json();
    const sub = one(h.env, 'SELECT * FROM subscriptions WHERE id = ?', b.sub.id);
    assert.deepEqual(ans, { ok: true, status: 'canceled', endsAt: b.sub.current_period_end, refundAgorot: 0, refundManual: false, synced: true, reference: await cancelReference(b.sub.id, sub.cancel_requested_at) });
    assert.match(ans.reference, /^C-[0-9A-F]{4}$/);
    assert.ok(sub.cancel_requested_at && sub.cancel_synced_at);
    assert.equal(sub.cancel_at_period_end, 1);
    assert.deepEqual(calls, [`cancel:${b.sub.id}`]);
    await h.ctx.flush();
    const mail = h.net.log.email.find((m) => m.subject.startsWith('אישור ביטול המנוי'));
    assert.ok(mail, 'a confirmation email');
    assert.ok(mail.subject.includes(ans.reference));
    assert.match(mail.text, /לא יהיו חיובים נוספים/);
    assert.match(mail.text, /\/cancel/);
    // a repeat changes nothing and returns the same answer
    const again = await (await cancel(b, 'period_end')).json();
    assert.deepEqual(again, ans);
    assert.equal(one(h.env, 'SELECT cancel_requested_at FROM subscriptions WHERE id = ?', b.sub.id).cancel_requested_at, sub.cancel_requested_at);
    assert.deepEqual(calls, [`cancel:${b.sub.id}`], 'the provider is not called again');
    assert.equal(cancelNotices().length, 1);
  } finally { testProvider.cancel = realCancel; }
});

test('the provider cancel fails: the cancellation stands (synced false), the cron retries, the owner hears after 24 h', async () => {
  h = await setup({ TEST_PROVIDER_FAIL: 'cancel' });
  const b = await bought();
  const ans = await (await cancel(b, 'period_end')).json();
  assert.equal(ans.status, 'canceled'); assert.equal(ans.synced, false);
  let sub = one(h.env, 'SELECT * FROM subscriptions WHERE id = ?', b.sub.id);
  assert.ok(sub.cancel_requested_at); assert.equal(sub.cancel_synced_at, null);
  assert.ok(one(h.env, "SELECT * FROM audit_log WHERE action = 'subscription.cancel_sync'"), 'the failed call is recorded');
  assert.equal(cancelNotices().length, 1, 'the payer still gets the confirmation');
  await retryCancels(h.env);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:unsynced_cancel'").length, 0, 'not before 24 hours');
  advanceClock(25 * 3600_000);
  await retryCancels(h.env);
  await retryCancels(h.env);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:unsynced_cancel'").length, 1);
  h.env.TEST_PROVIDER_FAIL = '';
  assert.deepEqual(await retryCancels(h.env), { tried: 1, synced: 1 });
  sub = one(h.env, 'SELECT * FROM subscriptions WHERE id = ?', b.sub.id);
  assert.ok(sub.cancel_synced_at);
});

test('refund_now inside 14 days refunds in full and ends access now; after refund_until it is 409 refund_window_closed', async () => {
  h = await setup();
  const b = await bought({ ago: 2 * DAY });
  const ans = await (await cancel(b, 'refund_now')).json();
  assert.equal(ans.status, 'ended'); assert.equal(ans.refundAgorot, 2990); assert.equal(ans.refundManual, false);
  assert.ok(Date.parse(ans.endsAt) <= Date.now() + 1000);
  const sub = one(h.env, 'SELECT * FROM subscriptions WHERE id = ?', b.sub.id);
  assert.equal(sub.ended_reason, 'refunded');
  const q = one(h.env, 'SELECT * FROM refund_queue');
  assert.equal(q.reason, 'cooling_off'); assert.equal(q.amount_agorot, 2990); assert.ok(q.done_at, 'refunded through the provider at once');
  assert.deepEqual(await (await cancel(b, 'refund_now')).json(), ans, 'a repeat returns the same answer');
  assert.equal(rows(h.env, 'SELECT * FROM refund_queue').length, 1);

  const late = await bought({ ago: 15 * DAY });
  const r = await cancel(late, 'refund_now');
  assert.equal(r.status, 409); assert.equal((await r.json()).error, 'refund_window_closed');
  assert.equal(one(h.env, 'SELECT status FROM subscriptions WHERE id = ?', late.sub.id).status, 'active', 'nothing changed');
});

test('prorata (yearly plans only) = floor(price x unused days / period days)', async () => {
  h = await setup();
  const monthly = await bought({ ago: 20 * DAY });
  const no = await cancel(monthly, 'prorata');
  assert.equal(no.status, 409); assert.equal((await no.json()).error, 'prorata_not_offered');
  const early = await bought({ plan: 'family_year', ago: 2 * DAY });
  assert.equal((await cancel(early, 'prorata')).status, 409, 'not inside the 14 days (a full refund is offered there)');
  const y = await bought({ plan: 'family_year', ago: 100 * DAY });
  const sub = one(h.env, 'SELECT * FROM subscriptions WHERE id = ?', y.sub.id);
  const unused = Math.floor((Date.parse(sub.current_period_end) - Date.now()) / DAY);
  const total = Math.round((Date.parse(sub.current_period_end) - Date.parse(sub.current_period_start)) / DAY);
  const ans = await (await cancel(y, 'prorata')).json();
  assert.equal(ans.refundAgorot, Math.floor(24900 * unused / total));
  assert.ok(ans.refundAgorot > 17000 && ans.refundAgorot < 19000, String(ans.refundAgorot));
  assert.equal(ans.status, 'ended');
  assert.equal(one(h.env, "SELECT amount_agorot FROM refund_queue WHERE reason = 'prorata'").amount_agorot, ans.refundAgorot);
});

test('a provider without a refund API queues a manual refund and says it takes 14 days at most', async () => {
  h = await setup();
  await signIn(h, 'manual@example.test');
  const a = accountId(h.env, 'manual@example.test');
  const token = await signIn(h, 'manual@example.test');
  const sub = insertSub(h.env, { kind: 'family', account_id: a, provider: 'manual', price_agorot: 2990, refund_until: new Date(Date.now() + 5 * DAY).toISOString() });
  h.env.DB.raw.prepare(`INSERT INTO payments (id, provider, provider_payment_id, kind, subscription_id, amount_agorot, status, occurred_at, recorded_at)
    VALUES ('pm1', 'manual', 'inv-1', 'charge', ?, 2990, 'ok', ?, ?)`).run(sub.id, new Date().toISOString(), new Date().toISOString());
  const ans = await (await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token }, body: { subscriptionId: sub.id, mode: 'refund_now' } })).json();
  assert.equal(ans.refundManual, true); assert.equal(ans.synced, true); assert.equal(ans.refundAgorot, 2990);
  const q = one(h.env, 'SELECT * FROM refund_queue');
  assert.equal(q.manual, 1); assert.equal(q.done_at, null);
  assert.ok(one(h.env, "SELECT * FROM notices WHERE kind = 'owner:manual_refund'"));
  await h.ctx.flush();
  const mail = h.net.log.email.find((m) => m.subject.startsWith('אישור ביטול'));
  assert.match(mail.text, /תוך 14 ימים לכל היותר/);
});

test('a refund the provider keeps failing becomes manual after 3 tries, with one owner notice', async () => {
  h = await setup({ TEST_PROVIDER_FAIL: 'refund' });
  const b = await bought({ ago: DAY });
  const ans = await (await cancel(b, 'refund_now')).json();
  assert.equal(ans.status, 'ended');
  assert.equal(one(h.env, 'SELECT tries FROM refund_queue').tries, 1);
  await processRefundQueue(h.env);
  await processRefundQueue(h.env);
  const q = one(h.env, 'SELECT * FROM refund_queue');
  assert.equal(q.tries, 3); assert.equal(q.manual, 1);
  await processRefundQueue(h.env);
  assert.equal(one(h.env, 'SELECT tries FROM refund_queue').tries, 3, 'a manual row is left to the owner');
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:manual_refund'").length, 1);
});

test('resume before the end clears the cancellation where the provider can resume; otherwise 409 not_resumable', async () => {
  h = await setup();
  const b = await bought();
  await cancel(b, 'period_end');
  const r = await h.call('POST', '/api/billing/resume', { headers: { 'X-Account-Token': b.token }, body: { subscriptionId: b.sub.id } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, status: 'active', renewsAt: b.sub.current_period_end });
  const sub = one(h.env, 'SELECT * FROM subscriptions WHERE id = ?', b.sub.id);
  assert.equal(sub.cancel_requested_at, null); assert.equal(sub.cancel_at_period_end, 0);
  const again = await h.call('POST', '/api/billing/resume', { headers: { 'X-Account-Token': b.token }, body: { subscriptionId: b.sub.id } });
  assert.equal(again.status, 409); assert.equal((await again.json()).error, 'not_resumable');
  await cancel(b, 'period_end');
  assert.equal(cancelNotices().length, 2, 'a second cancellation after a resume is confirmed again');
  const ended = await bought({ ago: DAY });
  await cancel(ended, 'refund_now');
  assert.equal((await h.call('POST', '/api/billing/resume', { headers: { 'X-Account-Token': ended.token }, body: { subscriptionId: ended.sub.id } })).status, 409);
});

test("another account's subscription is 404", async () => {
  h = await setup();
  const b = await bought();
  const stranger = await signIn(h, 'stranger@example.test');
  const r = await cancel(b, 'period_end', stranger);
  assert.equal(r.status, 404); assert.equal((await r.json()).error, 'no_subscription');
  assert.equal(one(h.env, 'SELECT status FROM subscriptions WHERE id = ?', b.sub.id).status, 'active');
});

test('online checkout stays closed when the provider has no cancel API', async () => {
  h = await setup();
  const { default: testProvider } = await import('../src/providers/test.js');
  const caps = testProvider.capabilities;
  testProvider.capabilities = { ...caps, cancelApi: false };
  try {
    const plans = await (await h.call('GET', '/api/billing/plans')).json();
    assert.equal(plans.online, false);
    const token = await signIn(h, 'nocancel@example.test');
    const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': 'no-cancel-api-012345' }, body: { plan: 'family_month', adult: true, terms: '2026-11' } });
    assert.equal(r.status, 501);
  } finally { testProvider.capabilities = caps; }
});

test('cancel requests at the same moment (two tabs, a retry) cancel once and refund once, and all get the same answer', async () => {
  h = await setup();
  const b = await bought();
  const answers = await Promise.all([cancel(b, 'refund_now'), cancel(b, 'refund_now'), cancel(b, 'refund_now')]);
  assert.deepEqual(answers.map((r) => r.status), [200, 200, 200]);
  const bodies = await Promise.all(answers.map((r) => r.json()));
  assert.equal(new Set(bodies.map((x) => x.reference)).size, 1, 'one reference');
  assert.ok(bodies.every((x) => x.refundAgorot === 2990 && x.status === 'ended'));
  const q = rows(h.env, 'SELECT amount_agorot, reason, done_at FROM refund_queue');
  assert.equal(q.length, 1, 'one refund of ₪29.90, not two or three');
  assert.equal(q[0].amount_agorot, 2990);
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'refund'").length, 1, 'the provider refunded once');
  assert.equal(cancelNotices().length, 1);
  // yearly, pro rata
  const y = await bought({ plan: 'family_year', ago: 30 * DAY });
  await Promise.all([cancel(y, 'prorata'), cancel(y, 'prorata'), cancel(y, 'prorata')]);
  assert.equal(rows(h.env, "SELECT * FROM refund_queue WHERE reason = 'prorata'").length, 1);
  // at the period end: one notice, one moment of notice
  const m = await bought();
  const pe = await Promise.all([cancel(m, 'period_end'), cancel(m, 'period_end')]);
  const pb = await Promise.all(pe.map((r) => r.json()));
  assert.equal(pb[0].reference, pb[1].reference);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE ref = ? AND kind LIKE 'canceled:%'", m.sub.id).length, 1);
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'subscription.cancel' AND target = ?", `sub:${m.sub.id}`).length, 1);
});
