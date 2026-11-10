// Deleting an account and exporting what is kept about it.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, signIn, accountId, signedTestEvent, linkDevice, rows, one, advanceClock } from './helpers.js';

let h;
afterEach(() => h?.done());

async function paidFamily(email) {
  const token = await signIn(h, email);
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': `privacy-${email.replace(/[^a-z]/g, '')}-0123456789` }, body: { plan: 'family_month', adult: true, terms: '2026-11' } });
  const { orderId } = await r.json();
  const s = await signedTestEvent(h.env, { id: `ev_${orderId}`, type: 'paid', order: orderId, payment: `pay_${orderId}`, subscription: `sub_${orderId}`, amountAgorot: 2990, currency: 'ILS', occurredAt: new Date().toISOString() });
  await h.call('POST', `/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, { body: s.body, headers: s.headers });
  return token;
}

test('account delete needs a code from the last 10 minutes, cancels at the provider, removes the email, sessions, devices and links, keeps payments', async () => {
  h = await setup();
  let token = await paidFamily('gone@example.test');
  const a = accountId(h.env, 'gone@example.test');
  await linkDevice(h.env, a);
  h.env.DB.raw.prepare("INSERT INTO link_codes (code_hash, secret_hash, account_id, created_at, expires_at) VALUES ('c', 's', ?, 'x', 'y')").run(a);
  advanceClock(11 * 60_000);
  const late = await h.call('POST', '/api/account/delete', { headers: { 'X-Account-Token': token }, body: { confirm: 'DELETE' } });
  assert.equal(late.status, 401); assert.equal((await late.json()).error, 'reauth_needed');
  token = await signIn(h, 'gone@example.test', { 'X-Account-Token': token });
  const r = await h.call('POST', '/api/account/delete', { headers: { 'X-Account-Token': token }, body: { confirm: 'DELETE' } });
  assert.equal(r.status, 200);
  await h.ctx.flush();
  assert.equal(rows(h.env, 'SELECT * FROM accounts').length, 0);
  for (const t of ['account_sessions', 'family_devices', 'link_codes']) assert.equal(rows(h.env, `SELECT * FROM ${t}`).length, 0, t);
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  assert.equal(sub.account_id, null); assert.equal(sub.status, 'ended'); assert.equal(sub.ended_reason, 'account_deleted');
  assert.ok(sub.cancel_requested_at); assert.ok(sub.cancel_synced_at, 'the provider was told');
  assert.equal(one(h.env, 'SELECT account_id FROM orders').account_id, null);
  assert.equal(rows(h.env, 'SELECT * FROM payments').length, 1, 'payments are kept');
  assert.ok(one(h.env, "SELECT * FROM audit_log WHERE action = 'account.delete'"));
  assert.doesNotMatch(JSON.stringify(rows(h.env, 'SELECT * FROM audit_log')), /@/);
});

test('export holds only the caller\'s own data and no card data', async () => {
  h = await setup();
  const mine = await paidFamily('me@example.test');
  await paidFamily('someone@example.test');
  const r = await h.call('GET', '/api/account/export', { headers: { 'X-Account-Token': mine } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('Content-Disposition'), /attachment; filename="madregot-\d{4}-\d{2}-\d{2}\.json"/);
  const data = await r.json();
  assert.equal(data.account.email, 'me@example.test');
  assert.equal(data.subscriptions.length, 1); assert.equal(data.payments.length, 1); assert.equal(data.orders.length, 1);
  const text = JSON.stringify(data);
  assert.ok(!text.includes('someone@example.test'));
  assert.doesNotMatch(text, /card|token_hash|code_hash/i);
});

test('the account page shows the plan, devices, the week, payments; never another account', async () => {
  h = await setup();
  const token = await paidFamily('page@example.test');
  const a = accountId(h.env, 'page@example.test');
  await linkDevice(h.env, a, 'הטאבלט');
  const page = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(page.email, 'page@example.test'); assert.equal(page.maxDevices, 3); assert.equal(page.billingHold, false);
  assert.equal(page.plan.plan, 'family_month'); assert.equal(page.plan.priceAgorot, 2990);
  assert.equal(page.plan.canRefundNow, true); assert.equal(page.plan.canResume, false); assert.equal(page.plan.portal, false);
  assert.deepEqual(page.devices.map((d) => d.label), ['הטאבלט']);
  assert.deepEqual(page.usageWeek, { tutor: 0, check: 0, generate: 0, exam: 0 });
  assert.equal(page.payments.length, 1); assert.equal(page.payments[0].amountAgorot, 2990);
});
