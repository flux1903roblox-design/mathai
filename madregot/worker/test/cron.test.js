// The hourly cron jobs of this release: notices, expired orders and plans, cancellation retries, refunds, purge.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { run, endFinished } from '../src/cron.js';
import { flushNotices, MAX_NOTICE_TRIES } from '../src/email.js';
import { setup, signIn, accountId, insertSub, rows, one, advanceClock } from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const ago = (ms) => new Date(Date.now() - ms).toISOString();

test('pending notices are sent, and a failing send is retried up to 6 times', async () => {
  let fail = true;
  h = await setup({}, { resend: () => (fail ? new Response('{}', { status: 500 }) : new Response('{"id":"x"}', { status: 200 })) });
  h.env.DB.raw.prepare("INSERT INTO accounts (id, email, created_at) VALUES ('acc1', 'n@example.test', 'x')").run();
  const id = accountId(h.env, 'n@example.test');
  h.env.DB.raw.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at) VALUES ('s1', 'welcome', ?, ?, ?)").run(id, JSON.stringify({ plan: 'family_month', priceAgorot: 2990, periodEnd: ago(-30 * DAY) }), ago(0));
  h.env.DB.raw.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at) VALUES ('2026-11-10', 'owner:spend:2026-11-10', NULL, '{\"usd\":21}', ?)").run(ago(0));
  for (let i = 0; i < MAX_NOTICE_TRIES + 2; i++) await flushNotices(h.env);
  assert.deepEqual(rows(h.env, 'SELECT tries FROM notices ORDER BY ref').map((r) => r.tries), [6, 6]);
  fail = false;
  h.env.DB.raw.prepare('UPDATE notices SET tries = 2').run();
  await flushNotices(h.env);
  assert.equal(rows(h.env, 'SELECT * FROM notices WHERE sent_at IS NULL').length, 0);
  const welcome = h.net.log.email.filter((m) => m.subject === 'המנוי לעוזר החכם של מדרגות פעיל').at(-1);
  assert.deepEqual(welcome.to, ['n@example.test']);
  assert.match(welcome.text, /₪29\.90 לחודש, כולל מע״מ\. מתחדש אוטומטית עד שמבטלים/);
  assert.match(welcome.text, /ב־14 הימים הראשונים מקבלים החזר מלא/);
  const owner = h.net.log.email.filter((m) => m.subject.startsWith('[מדרגות]')).at(-1);
  assert.deepEqual(owner.to, ['owner@example.test']);
});

test('open orders expire after 2 hours; past_due ends after the grace; finished terms, trials and canceled plans end', async () => {
  h = await setup();
  const token = await signIn(h, 'o@example.test');
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': 'cron-order-0123456789' }, body: { plan: 'family_month', adult: true, terms: '2026-11' } });
  assert.equal(r.status, 201);
  const a = accountId(h.env, 'o@example.test');
  const old = { start: ago(60 * DAY) };
  const pd = insertSub(h.env, { kind: 'family', account_id: a, status: 'past_due', ...old, end: ago(4 * DAY) });
  const pdGrace = insertSub(h.env, { kind: 'class', class_code: 'ABC234', status: 'past_due', ...old, end: ago(DAY) });
  const term = insertSub(h.env, { kind: 'class', class_code: 'XYZ234', plan: 'term', ...old, end: ago(1000) });
  const canceled = insertSub(h.env, { kind: 'class', class_code: 'QQQ234', plan: 'term', status: 'canceled', ...old, end: ago(1000) });
  const renewing = insertSub(h.env, { kind: 'class', class_code: 'RRR234', plan: 'trial', ...old, end: ago(-DAY) });
  advanceClock(2 * 3600_000 + 1000);
  const report = await run(h.env);
  assert.equal(report.endFinished, 3);
  assert.equal(one(h.env, 'SELECT status FROM orders').status, 'expired');
  const status = (s) => ({ ...one(h.env, 'SELECT status, ended_reason FROM subscriptions WHERE id = ?', s.id) });
  assert.deepEqual(status(pd), { status: 'ended', ended_reason: 'payment_failed' });
  assert.equal(status(pdGrace).status, 'past_due', 'still inside the grace days');
  assert.deepEqual(status(term), { status: 'ended', ended_reason: 'expired' });
  assert.deepEqual(status(canceled), { status: 'ended', ended_reason: 'canceled' });
  assert.equal(status(renewing).status, 'active');
  assert.equal(await endFinished(h.env), 0, 'nothing twice');
});

test('the cron retries cancellations the provider did not confirm and processes the refund queue', async () => {
  h = await setup();
  await signIn(h, 'r@example.test');
  const a = accountId(h.env, 'r@example.test');
  const sub = insertSub(h.env, { kind: 'family', account_id: a, provider: 'test', status: 'canceled', cancel_requested_at: ago(1000), cancel_at_period_end: 1 });
  h.env.DB.raw.prepare(`INSERT INTO payments (id, provider, provider_payment_id, kind, subscription_id, amount_agorot, status, occurred_at, recorded_at)
    VALUES ('p1', 'test', 'tp1', 'charge', ?, 2990, 'ok', ?, ?)`).run(sub.id, ago(DAY), ago(DAY));
  h.env.DB.raw.prepare("INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at) VALUES (?, 'p1', 2990, 'owner', ?)").run(sub.id, ago(0));
  const report = await run(h.env);
  assert.deepEqual(report.retryCancels, { tried: 1, synced: 1 });
  assert.ok(one(h.env, 'SELECT cancel_synced_at FROM subscriptions').cancel_synced_at);
  assert.ok(one(h.env, 'SELECT done_at FROM refund_queue').done_at);
});

test('at 03:00 in Jerusalem the purge removes expired codes, idle sessions and old daily counters, and keeps monthly ones', async () => {
  h = await setup();
  const ins = (who, day) => h.env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, 1)').run(who, day);
  ins('s:old', '2020-01-01'); ins('fam:a:exam', '2026-10');
  h.env.DB.raw.prepare("INSERT INTO login_codes (email_hash, code_hash, expires_at, sent_at) VALUES ('e', 'c', ?, 'x')").run(ago(DAY));
  h.env.DB.raw.prepare("INSERT INTO accounts (id, email, created_at) VALUES ('a1', 'idle@example.test', 'x')").run();
  h.env.DB.raw.prepare("INSERT INTO account_sessions (token_hash, account_id, created_at, last_seen, verified_at) VALUES ('t', 'a1', 'x', ?, 'x')").run(ago(181 * DAY));
  await run(h.env, { now: new Date('2026-11-10T12:00:00Z') });
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage').length, 2, 'not at noon');
  await run(h.env, { now: new Date('2026-11-10T01:10:00Z') });
  assert.deepEqual(rows(h.env, 'SELECT who FROM ai_usage').map((r) => r.who), ['fam:a:exam']);
  assert.equal(rows(h.env, 'SELECT * FROM login_codes').length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM account_sessions').length, 0);
});
