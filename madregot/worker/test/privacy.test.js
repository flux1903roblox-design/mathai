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

test('an invoice opens for its payer only: a redirect, or its address as JSON for the parents page', async () => {
  h = await setup();
  const mine = await paidFamily('inv@example.test');
  const other = await paidFamily('other@example.test');
  const pay = one(h.env, "SELECT p.id FROM payments p JOIN subscriptions s ON s.id = p.subscription_id JOIN accounts a ON a.id = s.account_id WHERE a.email = 'inv@example.test'");
  h.env.DB.raw.prepare('UPDATE payments SET invoice_url = ? WHERE id = ?').run('https://pay.example.test/invoice/17', pay.id);
  const asJson = await h.call('GET', `/api/billing/payments/${pay.id}/invoice`, { headers: { 'X-Account-Token': mine, Accept: 'application/json' } });
  assert.equal(asJson.status, 200);
  assert.deepEqual(await asJson.json(), { url: 'https://pay.example.test/invoice/17' });
  const redirect = await h.call('GET', `/api/billing/payments/${pay.id}/invoice`, { headers: { 'X-Account-Token': mine } });
  assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('Location'), 'https://pay.example.test/invoice/17');
  const theirs = await h.call('GET', `/api/billing/payments/${pay.id}/invoice`, { headers: { 'X-Account-Token': other, Accept: 'application/json' } });
  assert.equal(theirs.status, 404);
});

test('the account page lists a claimed device that has yet to collect its token as pending, and says until when a failed payment keeps access', async () => {
  h = await setup();
  const token = await paidFamily('pending@example.test');
  const a = accountId(h.env, 'pending@example.test');
  // the child's device shows a code; the parent claims it; the device has not collected its token yet
  const start = await (await h.call('POST', '/api/family/link/start', { headers: { 'X-Device': 'd'.repeat(32) }, body: { secret: 'e'.repeat(32) } })).json();
  const claim = await h.call('POST', '/api/family/link/claim', { headers: { 'X-Account-Token': token }, body: { code: start.code, label: 'הטאבלט' } });
  assert.equal(claim.status, 200);
  let page = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.deepEqual(page.devices.map((d) => [d.label, !!d.pending]), [['הטאבלט', true]]);
  // collected: linked
  const fin = await h.call('POST', '/api/family/link/finish', { body: { code: start.code, secret: 'e'.repeat(32) } });
  assert.equal(fin.status, 200);
  page = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.deepEqual(page.devices.map((d) => [d.label, !!d.pending]), [['הטאבלט', false]]);
  // a failed payment: the tutor keeps working for the grace days after the period end
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'past_due' WHERE account_id = ?").run(a);
  page = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(Date.parse(page.plan.accessUntil) - Date.parse(page.plan.periodEnd), 3 * 864e5);
});

test('a class licence bought by card shows on its buyer\'s page with its end, its refund options and its receipts', async () => {
  const { makeClass } = await import('./helpers.js');
  h = await setup();
  const cls = await makeClass(h);
  const token = await signIn(h, 'teacher@example.test');
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': 'class-licence-0123456789', ...cls.teacher }, body: { plan: 'class_year', seats: 12, adult: true, terms: '2026-11' } });
  const { orderId } = await r.json();
  const s = await signedTestEvent(h.env, { id: 'ev_class', type: 'paid', order: orderId, payment: 'pay_class', amountAgorot: 12 * 4900, currency: 'ILS', occurredAt: new Date().toISOString(), invoiceUrl: 'https://pay.example.test/inv/1' });
  await h.call('POST', `/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, { body: s.body, headers: s.headers });
  const page = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(page.plan, null, 'no family plan');
  assert.equal(page.classes.length, 1);
  const c = page.classes[0];
  assert.equal(c.classCode, cls.code); assert.equal(c.status, 'active');
  assert.equal(c.plan.kind, 'class'); assert.equal(c.plan.seats, 12); assert.equal(c.plan.priceAgorot, 12 * 4900);
  assert.equal(c.plan.canRefundNow, true, 'a 14-day refund applies');
  const receipt = page.payments.find((p) => p.subscriptionId === c.plan.id);
  assert.ok(receipt && receipt.hasInvoice);
  assert.equal(receipt.planKind, 'class');
  // the buyer cancels with the full refund; the class is back on the free taste
  const cancel = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token }, body: { subscriptionId: c.plan.id, mode: 'refund_now' } });
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json()).refundAgorot, 12 * 4900);
  const after = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(after.classes[0].status, 'ended'); assert.equal(after.classes[0].plan, undefined);
});
