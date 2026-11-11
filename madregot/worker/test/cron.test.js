// The hourly cron jobs of this release: notices, expired orders and plans, cancellation retries, refunds, purge.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { run, endFinished, supportCheckLine, safetySpike, safetyCounts } from '../src/cron.js';
import { flushNotices, MAX_NOTICE_TRIES } from '../src/email.js';
import { setup, signIn, accountId, insertSub, rows, one, advanceClock, linkDevice } from './helpers.js';

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

// ---------------------------------------------------------------- the 03:00 jobs
const { jerusalemMidnight, dayOf: today } = await import('../src/util.js');
/** 03:10 in Jerusalem today: the hour the night jobs run. */
const night = () => new Date(jerusalemMidnight(today()).ms + 3 * 3600_000 + 10 * 60_000);
const { default: testProvider } = await import('../src/providers/test.js');

test('reconciliation extends a renewing plan only from the truth pulled from the provider, or ends it', async () => {
  h = await setup();
  const later = new Date(Date.now() + 29 * DAY).toISOString();
  const sub = (id, o) => insertSub(h.env, { kind: 'family', provider: 'test', provider_subscription_id: id, price_agorot: 2990, start: ago(31 * DAY), ...o });
  const renewed = sub('tsub_renewed', { end: ago(DAY) });
  const waiting = sub('tsub_waiting', { end: ago(DAY) });
  const silent = sub('tsub_silent', { end: ago(5 * DAY) });
  const canceled = sub('tsub_canceled', { end: ago(DAY) });
  const down = sub('tsub_down', { end: ago(5 * DAY) });
  const running = sub('tsub_running', { end: ago(-10 * DAY) });
  const pastDue = sub('tsub_pastdue', { status: 'past_due', end: ago(DAY) });
  const truth = {
    tsub_renewed: { status: 'active', periodEnd: later }, tsub_waiting: { status: 'active', periodEnd: ago(DAY) },
    tsub_canceled: { status: 'canceled', periodEnd: ago(DAY) }, tsub_pastdue: { status: 'active', periodEnd: later },
  };
  const asked = [];
  const real = testProvider.fetchSubscription;
  testProvider.fetchSubscription = async (env, s) => {
    asked.push(s.provider_subscription_id);
    if (s.provider_subscription_id === 'tsub_down') throw new Error('provider unreachable');
    return truth[s.provider_subscription_id] || null;
  };
  let report;
  try { report = await run(h.env, { now: night() }); } finally { testProvider.fetchSubscription = real; }
  assert.deepEqual(report.reconcile, { checked: 6, extended: 2, ended: 2, failed: 1 });
  assert.ok(!asked.includes('tsub_running'), 'a running period is not asked about');
  const st = (s) => ({ ...one(h.env, 'SELECT status, ended_reason, current_period_end FROM subscriptions WHERE id = ?', s.id) });
  assert.deepEqual(st(renewed), { status: 'active', ended_reason: null, current_period_end: later });
  assert.deepEqual(st(pastDue), { status: 'active', ended_reason: null, current_period_end: later });
  assert.equal(st(waiting).status, 'active', 'no renewal yet, still inside the grace days: wait');
  assert.equal(st(waiting).current_period_end, waiting.current_period_end, 'never moved without a pulled truth');
  assert.deepEqual({ ...st(silent) }, { status: 'ended', ended_reason: 'payment_failed', current_period_end: silent.current_period_end });
  assert.equal(st(canceled).ended_reason, 'canceled');
  assert.equal(st(down).status, 'active', 'an unreachable provider is asked again tomorrow');
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'subscription.reconcile' AND actor = 'cron'").length, 4);
  // not outside the 03:00 hour
  assert.equal((await run(h.env, { now: new Date(night().getTime() + 6 * 3600_000) })).reconcile, undefined);

  // a renewal that arrives late brings the plan that ended for want of one back
  const { signedTestEvent } = await import('./helpers.js');
  const ev = await signedTestEvent(h.env, { id: 'ev_late', type: 'paid', subscription: 'tsub_silent', payment: 'pay_late', amountAgorot: 2990, currency: 'ILS', occurredAt: new Date().toISOString() });
  const r = await h.call('POST', `/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, { body: ev.body, headers: ev.headers });
  assert.deepEqual((await r.json()).results, ['applied']);
  assert.equal(st(silent).status, 'active');
  assert.ok(st(silent).current_period_end > new Date().toISOString());
});

test('the one-year plan\'s end-date email is queued once at 30-45 days, the licence-ending email once at 30 days', async () => {
  h = await setup();
  await signIn(h, 'year@example.test'); await signIn(h, 'buyer@example.test'); await signIn(h, 'teacher@example.test');
  const year = accountId(h.env, 'year@example.test');
  const due = insertSub(h.env, { kind: 'family', plan: 'family_year', account_id: year, price_agorot: 24900, provider: 'test', start: ago(320 * DAY), end: ago(-40 * DAY) });
  insertSub(h.env, { kind: 'family', plan: 'family_year', account_id: null, price_agorot: 24900, end: ago(-50 * DAY) });
  insertSub(h.env, { kind: 'family', plan: 'family_year', account_id: null, price_agorot: 24900, status: 'canceled', cancel_at_period_end: 1, end: ago(-40 * DAY) });
  insertSub(h.env, { kind: 'family', plan: 'family_month', account_id: null, price_agorot: 2990, end: ago(-20 * DAY) });
  const bought = insertSub(h.env, { kind: 'class', class_code: 'ABC234', plan: 'class_year', account_id: accountId(h.env, 'buyer@example.test'), end: ago(-25 * DAY) });
  const granted = insertSub(h.env, { kind: 'class', class_code: 'DEF234', plan: 'term', end: ago(-20 * DAY) });
  h.env.DB.raw.prepare("INSERT INTO licence_requests (id, class_code, account_id, wants, school, created_at) VALUES ('r1', 'DEF234', ?, 'quote', 'אורט', ?)")
    .run(accountId(h.env, 'teacher@example.test'), ago(100 * DAY));
  insertSub(h.env, { kind: 'class', class_code: 'GHJ234', plan: 'term', end: ago(-20 * DAY) }); // nobody to tell
  insertSub(h.env, { kind: 'class', class_code: 'KMN234', plan: 'trial', end: ago(-10 * DAY) });
  insertSub(h.env, { kind: 'class', class_code: 'PQR234', plan: 'term', end: ago(-40 * DAY) });
  await run(h.env, { now: night() });
  await run(h.env, { now: night() });
  const kinds = rows(h.env, "SELECT ref, kind, to_account FROM notices WHERE kind LIKE 'year_ending%' OR kind LIKE 'renewal_reminder:%' OR kind LIKE 'licence_ending:%' ORDER BY kind");
  assert.deepEqual(kinds.map((n) => [n.ref, n.kind.split(':')[0]]).sort(), [[bought.id, 'licence_ending'], [granted.id, 'licence_ending'], [due.id, 'year_ending']].sort());
  assert.equal(kinds.find((n) => n.ref === granted.id).to_account, accountId(h.env, 'teacher@example.test'), 'to the teacher who asked');
  const mail = (subject) => h.net.log.email.filter((m) => m.subject.startsWith(subject));
  assert.equal(mail('המנוי לשנה מסתיים ב־').length, 1);
  assert.match(mail('המנוי לשנה מסתיים ב־')[0].text, /₪249\.00 \(כולל מע״מ\): https:\/\/madregot\.example\.test\/parents\?renew=year/);
  assert.match(mail('המנוי לשנה מסתיים ב־')[0].text, /לביטול המנוי: https:\/\/madregot\.example\.test\/cancel/);
  assert.equal(mail('רישיון הכיתה מסתיים ב־').length, 2);
  assert.ok(mail('רישיון הכיתה מסתיים ב־').some((m) => m.to[0] === 'buyer@example.test' && /ABC234/.test(m.text)));
});

test('the night purge removes expired codes and links, idle sessions and devices, old notices, orders, spend and audit rows', async () => {
  h = await setup();
  const db = h.env.DB.raw;
  db.prepare("INSERT INTO accounts (id, email, created_at) VALUES ('a1', 'keep@example.test', 'x')").run();
  const dev = (id, token, created, seen) => db.prepare('INSERT INTO family_devices (id, account_id, token_hash, label, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, 'a1', token, '', created, seen);
  dev('pending_old', null, ago(2 * DAY), today()); dev('pending_new', null, ago(3600_000), today());
  dev('idle', 'h1', ago(500 * DAY), today(new Date(Date.now() - 400 * DAY))); dev('used', 'h2', ago(500 * DAY), today());
  const link = (hash, expires) => db.prepare('INSERT INTO link_codes (code_hash, secret_hash, created_at, expires_at) VALUES (?, ?, ?, ?)').run(hash, 's', ago(DAY), expires);
  link('old', ago(2 * DAY)); link('recent', ago(3600_000));
  const notice = (ref, sent, tries = 0) => db.prepare("INSERT INTO notices (ref, kind, params, created_at, sent_at, tries) VALUES (?, 'welcome', '{}', ?, ?, ?)").run(ref, ago(200 * DAY), sent, tries);
  notice('sent_old', ago(100 * DAY)); notice('sent_new', ago(10 * DAY)); notice('failed_old', null, 6); notice('pending', null, 0);
  const order = (id, status, created) => db.prepare(`INSERT INTO orders (id, plan, amount_agorot, vat_agorot, provider, mode, idempotency_key, status, created_at, expires_at)
    VALUES (?, 'family_month', 2990, 456, 'test', 'test', ?, ?, ?, ?)`).run(id, `key-${id}-0123456789`, status, created, created);
  order('expired_old', 'expired', ago(40 * DAY)); order('expired_new', 'expired', ago(10 * DAY)); order('paid_old', 'paid', ago(400 * DAY));
  db.prepare("INSERT INTO ai_spend (pool, period, nano_usd) VALUES ('all', ?, 1), ('all', ?, 1), ('all', ?, 1), ('all', ?, 1)")
    .run(today(new Date(Date.now() - 500 * DAY)), today(new Date(Date.now() - 500 * DAY)).slice(0, 7), today(), today().slice(0, 7));
  db.prepare("INSERT INTO audit_log (at, actor, action, target) VALUES (?, 'cron', 'x', 'old'), (?, 'cron', 'x', 'new')").run(ago(800 * DAY), ago(DAY));
  await run(h.env, { now: night() });
  const ids = (sql) => rows(h.env, sql).map((r) => Object.values(r)[0]).sort();
  assert.deepEqual(ids('SELECT id FROM family_devices'), ['pending_new', 'used']);
  assert.deepEqual(ids('SELECT code_hash FROM link_codes'), ['recent']);
  assert.deepEqual(ids('SELECT ref FROM notices'), ['pending', 'sent_new']);
  assert.deepEqual(ids('SELECT id FROM orders'), ['expired_new', 'paid_old']);
  assert.deepEqual(ids('SELECT period FROM ai_spend'), [today(), today().slice(0, 7)].sort());
  assert.deepEqual(ids('SELECT target FROM audit_log WHERE actor = \'cron\''), ['new']);
});

test('the daily summary lists yesterday and the invariant violations, only when OWNER_DAILY_SUMMARY is on', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const yesterday = today(new Date(night().getTime() - DAY));
  const db = h.env.DB.raw;
  db.prepare("INSERT INTO ai_spend (pool, period, calls, nano_usd) VALUES ('all', ?1, 900, 25e9), ('free', ?1, 700, 6e9), ('kind:chat', ?1, 1, 1)").run(yesterday);
  const unpaid = insertSub(h.env, { kind: 'family', provider: 'test', start: ago(DAY), end: ago(-29 * DAY) });
  const paid = insertSub(h.env, { kind: 'family', provider: 'test', start: ago(DAY), end: ago(-29 * DAY) });
  db.prepare(`INSERT INTO payments (id, provider, provider_payment_id, kind, subscription_id, amount_agorot, status, period_end, occurred_at, recorded_at)
    VALUES ('p1', 'test', 'tp1', 'charge', ?, 2990, 'ok', ?, ?, ?)`).run(paid.id, paid.current_period_end, ago(DAY), ago(DAY));
  insertSub(h.env, { kind: 'class', class_code: 'ABC234', provider: 'manual', plan: 'term' }); // a grant needs no payment
  db.prepare(`INSERT INTO orders (id, plan, amount_agorot, vat_agorot, provider, mode, idempotency_key, status, created_at, expires_at)
    VALUES ('0123456789abcdef', 'family_month', 2990, 456, 'test', 'test', 'summary-order-0123456789', 'paid', ?, ?)`).run(ago(DAY), ago(DAY));
  db.prepare("INSERT INTO licence_requests (id, class_code, wants, school, created_at) VALUES ('r1', 'ABC234', 'trial', 'אורט', ?)").run(ago(DAY));
  await run(h.env, { now: night() });
  const n = one(h.env, 'SELECT * FROM notices WHERE kind = ?', `owner:summary:${yesterday}`);
  assert.ok(n, 'queued');
  const p = JSON.parse(n.params);
  assert.equal(p.allUsd, 25); assert.equal(p.freeCalls, 700); assert.equal(p.openRequests, 1);
  assert.deepEqual(p.spend.map((x) => x.pool), ['free'], 'pools only, not the totals by kind');
  const mail = h.net.log.email.find((m) => m.subject.startsWith(`[מדרגות] סיכום יומי ${yesterday}`));
  assert.deepEqual(mail.to, ['owner@example.test']);
  // a 5th line once the support numbers are due for a check (shared/safety.js); covered on its own in care.test.js
  assert.match(mail.subject, new RegExp(`${4 + (supportCheckLine(night()) ? 1 : 0)} בעיות`));
  assert.match(mail.text, new RegExp(`מנוי פעיל בלי תשלום שמכסה את היום: ${unpaid.id}`));
  assert.doesNotMatch(mail.text, new RegExp(paid.id));
  assert.match(mail.text, /הזמנה ששולמה בלי מנוי: 0123456789abcdef/);
  assert.match(mail.text, /עברה את 20\$/);
  assert.match(mail.text, /הטעימה בחינם עברה את התקציב היומי/);
  // once a night; never without the switch
  await run(h.env, { now: night() });
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:summary:%'").length, 1);
  h.done();
  h = await setup();
  await run(h.env, { now: night() });
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:summary:%'").length, 0);
});

test('without Resend, notices go to the dev log only on a local Worker, and never with a code', async () => {
  h = await setup({ RESEND_API_KEY: undefined, EMAIL_DEV_LOG: 'true' });
  h.env.DB.raw.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at) VALUES ('d1', 'owner:spend:x', NULL, '{}', ?)").run(ago(0));
  const logged = [];
  const real = console.log;
  console.log = (...a) => logged.push(a.join(' '));
  try {
    assert.deepEqual(await flushNotices(h.env), { sent: 0 }, 'PUBLIC_URL is not on localhost');
    h.env.PUBLIC_URL = 'http://localhost:8787';
    assert.deepEqual(await flushNotices(h.env), { sent: 1 });
  } finally { console.log = real; }
  assert.equal(logged.length, 1); assert.match(logged[0], /^\[dev\] notice owner:spend:x: \[מדרגות\] spend:x$/);
  assert.equal(h.net.log.email.length, 0);
});

test('a renewing family plan stored without the provider\'s subscription id ends after the grace days instead of staying active', async () => {
  h = await setup();
  const asked = [];
  const real = testProvider.fetchSubscription;
  testProvider.fetchSubscription = async (env, s) => { asked.push(s.id); return null; };
  try {
    const gone = insertSub(h.env, { kind: 'family', provider: 'test', provider_subscription_id: null, price_agorot: 2990, start: ago(40 * DAY), end: ago(9 * DAY) });
    const fresh = insertSub(h.env, { kind: 'family', provider: 'test', provider_subscription_id: null, price_agorot: 2990, start: ago(31 * DAY), end: ago(DAY) });
    const report = await run(h.env, { now: night() });
    assert.equal(report.reconcile.ended, 1);
    assert.deepEqual(asked, [], 'there is nothing to ask the provider about');
    assert.equal(one(h.env, 'SELECT ended_reason FROM subscriptions WHERE id = ?', gone.id).ended_reason, 'payment_failed');
    assert.equal(one(h.env, 'SELECT status FROM subscriptions WHERE id = ?', fresh.id).status, 'active', 'still inside the grace days');
  } finally { testProvider.fetchSubscription = real; }
});

// ---------------------------------------------------------------- safety counts and the spike alert (TRUST-4 §4.4)
/** n safety events of a kind on a day (counts only: the table has nothing else). */
const events = (env, day, kind, n, surface = 'chat') => {
  const st = env.DB.raw.prepare("INSERT INTO safety_events (day, kind, surface, source) VALUES (?, ?, ?, 'server')");
  for (let i = 0; i < n; i++) st.run(day, kind, surface);
};
const dayBack = (k) => today(new Date(night().getTime() - k * DAY));

test('the daily summary carries yesterday\'s safety counts, numbers only', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const y = dayBack(1);
  events(h.env, y, 'distress', 2); events(h.env, y, 'pii_masked', 4); events(h.env, y, 'output_blocked', 1); events(h.env, y, 'refusal', 3);
  events(h.env, y, 'user_report', 2); events(h.env, y, 'link_removed', 5); events(h.env, dayBack(2), 'distress', 7);
  assert.deepEqual(await safetyCounts(h.env, y), { distress: 2, pii_masked: 4, output_blocked: 1, refusal: 3, user_report: 2 });
  await run(h.env, { now: night() });
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${y}`).params);
  assert.deepEqual(p.safety, { distress: 2, pii_masked: 4, output_blocked: 1, refusal: 3, user_report: 2 });
  const mail = h.net.log.email.find((m) => m.subject.startsWith(`[מדרגות] סיכום יומי ${y}`));
  assert.match(mail.text, /אירועי בטיחות: מצוקה 2 · פרטים אישיים שהוסתרו 4 · תשובות שנעצרו 1 · סירובים 3 · דיווחים על תשובות 2/);
  // below both rules: no alert
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:safety_spike:%'").length, 0);
});

test('a spike in blocked or reported answers alerts the owner once, with the counts only, also without the daily summary', async () => {
  h = await setup();
  const y = dayBack(1);
  events(h.env, y, 'output_blocked', 6); events(h.env, y, 'user_report', 3);
  assert.deepEqual(await safetySpike(h.env, night()), { day: y, alert: false }, '9 is not yet a spike');
  events(h.env, y, 'user_report', 1);
  await run(h.env, { now: night() });
  const n = one(h.env, 'SELECT * FROM notices WHERE kind = ?', `owner:safety_spike:${y}`);
  assert.ok(n, 'queued');
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:summary:%'").length, 0, 'the summary is off');
  const mail = h.net.log.email.find((m) => m.subject === '[מדרגות] קפיצה באירועי בטיחות');
  assert.deepEqual(mail.to, ['owner@example.test']);
  assert.match(mail.text, new RegExp(`ביום ${y} היו יותר אירועי בטיחות מהרגיל`));
  assert.match(mail.text, /תשובות שנעצרו 6 · סירובים 0 · דיווחים על תשובות 4/);
  // once a day, however often the night runs
  await run(h.env, { now: night() });
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:safety_spike:%'").length, 1);
});

test('distress alerts at max(3, 3 × its 14-day average): one event on a quiet day never does', async () => {
  h = await setup();
  const y = dayBack(1);
  events(h.env, y, 'distress', 2);
  assert.equal((await safetySpike(h.env, night())).alert, false, 'the floor of 3 when the average is 0');
  events(h.env, y, 'distress', 1);
  assert.equal((await safetySpike(h.env, night())).alert, true, '3 on a quiet fortnight');
  h.done();
  // a busier fortnight raises the bar: 28 in 14 days is 2 a day, so 6 is needed
  h = await setup();
  for (let k = 2; k <= 15; k++) events(h.env, dayBack(k), 'distress', 2);
  events(h.env, dayBack(16), 'distress', 50); // older than the 14 days: not counted
  events(h.env, y, 'distress', 5);
  assert.equal((await safetySpike(h.env, night())).alert, false, '5 is under 3 × 2');
  events(h.env, y, 'distress', 1);
  assert.equal((await safetySpike(h.env, night())).alert, true, '6 is 3 × 2');
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:safety_spike:${y}`).params);
  assert.deepEqual(p, { distress: 6, pii_masked: 0, output_blocked: 0, refusal: 0, user_report: 0, distressAvg: 2, reported: false, distressHigh: true });
});

test('the spike counts networks, not rows: one network that writes 20 distress events is one (the trust review)', async () => {
  h = await setup();
  const y = dayBack(1);
  const counter = h.env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, ?)');
  // what recordSafety leaves for a script on one network: 20 rows and one counter
  events(h.env, y, 'distress', 20);
  counter.run('evt:distress:n:aaaa', y, 20);
  events(h.env, y, 'user_report', 20); counter.run('evt:user_report:n:aaaa', y, 20);
  assert.deepEqual(await safetySpike(h.env, night()), { day: y, alert: false }, 'one network is not a spike');
  // three networks are
  counter.run('evt:distress:n:bbbb', y, 1); counter.run('evt:distress:n:cccc', y, 1);
  assert.equal((await safetySpike(h.env, night())).alert, true);
});

// ---------------------------------------------------------------- the tutor's quality counts (ai spec AI-3 Design 6)
test('the daily summary carries yesterday\'s quality counts; the purge keeps them 400 days', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const y = dayBack(1);
  const put = (day, kind, reason, n) => h.env.DB.raw.prepare('INSERT INTO ai_quality (day, kind, reason, n) VALUES (?, ?, ?, ?)').run(day, kind, reason, n);
  put(y, 'chat', 'answer_masked', 3); put(y, 'explain', 'answer_masked', 2); put(y, 'check', 'answer_masked', 1);
  put(y, 'chat', 'empty_stream', 4);
  put(y, 'generate', 'gen_numbers', 5); put(y, 'generate', 'gen_blind', 1); put(y, 'generate', 'gen_all_failed', 2);
  put(dayBack(2), 'chat', 'answer_masked', 9);
  put(dayBack(401), 'chat', 'answer_masked', 1); put(dayBack(399), 'chat', 'answer_masked', 1);
  await run(h.env, { now: night() });
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${y}`).params);
  assert.deepEqual(p.quality, { masked: 6, emptyStreams: 4, genDropped: 6, genAllFailed: 2 });
  const mail = h.net.log.email.find((m) => m.subject.startsWith(`[מדרגות] סיכום יומי ${y}`));
  assert.match(mail.text, /איכות העוזר: תשובות סופיות שהוסתרו 6 · תשובות ריקות 4 · תרגילים שנפסלו 6 · בקשות תרגילים שנכשלו 2/);
  const days = rows(h.env, 'SELECT DISTINCT day FROM ai_quality ORDER BY day').map((r) => r.day);
  assert.ok(!days.includes(dayBack(401)), 'older than 400 days: gone');
  assert.ok(days.includes(dayBack(399)) && days.includes(y));
});

// ---------------------------------------------------------------- long-term records and idle accounts (TRUST-1 §4)
const { RETENTION } = await import('../../shared/retention.js');
const { ACCOUNT_PURGE_LIMIT, taxCutoffIso, idleAccounts } = await import('../src/cron.js');

test('an account idle for the retention period with nothing live is deleted through forgetAccount; a plan, an open request or an active class keeps it', async () => {
  h = await setup();
  const db = h.env.DB.raw;
  const now = night();
  const back = (k) => today(new Date(now.getTime() - k * DAY));
  const idle = RETENTION.accountIdleDays + 1;
  const acc = (id, days) => db.prepare('INSERT INTO accounts (id, email, created_at, last_seen) VALUES (?, ?, ?, ?)').run(id, `${id}@example.test`, ago(3000 * DAY), back(days));
  const request = (id, account, code, handled) => db.prepare("INSERT INTO licence_requests (id, class_code, account_id, wants, school, created_at, handled_at) VALUES (?, ?, ?, 'quote', 'אורט', ?, ?)")
    .run(id, code, account, ago(900 * DAY), handled);
  const cls = (code, created) => db.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES (?, 'ז1', '7', 'המורה כהן', 'h', ?)").run(code, created);
  acc('gone', idle);
  acc('recent', RETENTION.accountIdleDays - 1);
  acc('canceled', idle); insertSub(h.env, { kind: 'family', account_id: 'canceled', status: 'canceled', start: ago(20 * DAY), end: ago(-10 * DAY) });
  acc('ended', idle); const ended = insertSub(h.env, { kind: 'family', account_id: 'ended', status: 'ended', start: ago(800 * DAY), end: ago(770 * DAY) });
  acc('asking', idle); request('r_open', 'asking', 'ASK234', null);
  acc('handled', idle); request('r_handled', 'handled', 'HND234', ago(10 * DAY));
  // a teacher whose class still has a student who practised this week
  acc('teacher', idle); cls('TCH234', ago(900 * DAY)); insertSub(h.env, { kind: 'class', class_code: 'TCH234', account_id: 'teacher', status: 'ended', start: ago(800 * DAY), end: ago(500 * DAY) });
  db.prepare("INSERT INTO students (id, class_code, name, pin_hash, token_hash, created_at, last_seen) VALUES ('st1', 'TCH234', 'נועה', 'p', 't', ?, ?)").run(ago(900 * DAY), back(3));
  // a teacher who asked about a class nobody has used for longer than the class retention
  acc('oldTeacher', idle); cls('OLD234', ago(900 * DAY)); request('r_old', 'oldTeacher', 'OLD234', ago(100 * DAY));
  const fd = await linkDevice(h.env, 'gone');
  db.prepare("INSERT INTO account_sessions (token_hash, account_id, created_at, last_seen, verified_at) VALUES ('sess', 'gone', 'x', ?, 'x')").run(ago(DAY));

  assert.deepEqual((await idleAccounts(h.env, now)).sort(), ['ended', 'gone', 'handled', 'oldTeacher']);
  const report = await run(h.env, { now });
  assert.equal(report.purge.longTerm.accounts, 4);
  assert.deepEqual(rows(h.env, 'SELECT id FROM accounts ORDER BY id').map((r) => r.id), ['asking', 'canceled', 'recent', 'teacher']);
  // forgetAccount's own work: the device, the session and the handled request go; the ended plan stays without the account
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM family_devices WHERE id = ?', fd.id).n, 0);
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM account_sessions WHERE token_hash = 'sess'").n, 0);
  assert.deepEqual(rows(h.env, 'SELECT id FROM licence_requests ORDER BY id').map((r) => r.id), ['r_open']);
  assert.equal(one(h.env, 'SELECT account_id FROM subscriptions WHERE id = ?', ended.id).account_id, null);
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'account.delete' AND actor = 'cron'").length, 4);
  assert.equal(rows(h.env, "SELECT * FROM accounts WHERE email LIKE 'gone@%'").length, 0);
});

test(`idle accounts go ${ACCOUNT_PURGE_LIMIT} a night at the most, the oldest first`, async () => {
  h = await setup();
  const db = h.env.DB.raw;
  const now = night();
  const n = ACCOUNT_PURGE_LIMIT + 2;
  for (let i = 0; i < n; i++) {
    db.prepare('INSERT INTO accounts (id, email, created_at, last_seen) VALUES (?, ?, ?, ?)')
      .run(`a${String(i).padStart(3, '0')}`, `a${i}@example.test`, ago(3000 * DAY), today(new Date(now.getTime() - (RETENTION.accountIdleDays + 1 + n - i) * DAY)));
  }
  assert.equal((await run(h.env, { now })).purge.longTerm.accounts, ACCOUNT_PURGE_LIMIT);
  assert.deepEqual(rows(h.env, 'SELECT id FROM accounts ORDER BY id').map((r) => r.id), [`a${String(n - 2).padStart(3, '0')}`, `a${String(n - 1).padStart(3, '0')}`], 'the two most recent wait for the next night');
  assert.equal((await run(h.env, { now })).purge.longTerm.accounts, 2);
  assert.equal(rows(h.env, 'SELECT * FROM accounts').length, 0);
});

test('money records stay to the end of the 7th year after their tax year (clock at 2035-03-01), children before parents; licence records by their periods', async () => {
  h = await setup();
  advanceClock(Date.parse('2035-03-01T01:10:00Z') - Date.now()); // 03:10 in Jerusalem: the night jobs run
  const now = new Date();
  const db = h.env.DB.raw;
  const gone = 2035 - RETENTION.taxYears - 1; // 2027: its 7 years ended on 31 Dec 2034
  const kept = gone + 1; // 2028: kept until the end of 2035
  assert.equal(taxCutoffIso(now), `${gone}-12-31T22:00:00.000Z`, '1 Jan 2028 at midnight in Jerusalem');
  const sub = (id, updated, status = 'ended') => { insertSub(h.env, { id, kind: 'family', status, start: `${gone}-01-01T00:00:00.000Z`, end: `${gone}-02-01T00:00:00.000Z` }); db.prepare('UPDATE subscriptions SET updated_at = ? WHERE id = ?').run(updated, id); };
  const pay = (id, subId, at, { kind = 'charge', amount = 2990, order = null } = {}) => db.prepare(`INSERT INTO payments (id, provider, provider_payment_id, kind, subscription_id, order_id,
    amount_agorot, status, occurred_at, recorded_at) VALUES (?, 'test', ?, ?, ?, ?, ?, 'ok', ?, ?)`).run(id, `t${id}`, kind, subId, order, amount, at, at);
  const order = (id, subId, at, status = 'paid') => db.prepare(`INSERT INTO orders (id, plan, amount_agorot, vat_agorot, provider, mode, idempotency_key, status,
    subscription_id, created_at, expires_at, paid_at) VALUES (?, 'family_month', 2990, 456, 'test', 'test', ?, ?, ?, ?, ?, ?)`).run(id, `key-${id}-0123456789`, status, subId, at, at, status === 'paid' ? at : null);
  const refund = (subId, paymentId, done, requested = `${gone}-06-10T09:00:00.000Z`) => db.prepare(`INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at, done_at)
    VALUES (?, ?, 100, 'owner', ?, ?)`).run(subId, paymentId, requested, done);
  // a plan of 2027, paid, partly refunded in 2027: everything of it goes
  sub('s_old', `${gone}-07-01T10:00:00.000Z`);
  order('o_old', 's_old', `${gone}-06-01T10:00:00.000Z`);
  pay('p_old', 's_old', `${gone}-06-01T10:00:00.000Z`, { order: 'o_old' });
  pay('p_old_refund', 's_old', `${gone}-06-20T10:00:00.000Z`, { kind: 'refund', amount: -100 });
  refund('s_old', 'p_old', `${gone}-06-20T10:00:00.000Z`);
  // a renewal order paid in 2027 with its order_renewals row, for a plan that ended in 2027 with no payment left
  sub('s_ren', `${gone}-09-01T10:00:00.000Z`);
  order('o_ren', 's_ren', `${gone}-08-01T10:00:00.000Z`);
  db.prepare('INSERT INTO order_renewals (order_id, subscription_id, prev_start, prev_end) VALUES (?, ?, ?, ?)').run('o_ren', 's_ren', `${gone}-01-01T00:00:00.000Z`, `${gone}-02-01T00:00:00.000Z`);
  // a plan that ended in 2027 but was paid in 2028 (and at 01:30 on 1 Jan 2028 in Jerusalem): kept with its payments
  sub('s_kept', `${gone}-08-01T10:00:00.000Z`);
  pay('p_kept', 's_kept', `${kept}-01-15T10:00:00.000Z`);
  pay('p_edge', 's_kept', `${gone}-12-31T23:30:00.000Z`);
  // a 2027 payment whose refund was done in 2028: the refund is kept, so its payment is too
  sub('s_late', `${gone}-11-01T10:00:00.000Z`);
  pay('p_late', 's_late', `${gone}-11-01T10:00:00.000Z`);
  refund('s_late', 'p_late', `${kept}-02-01T10:00:00.000Z`);
  // a refund the owner never did: open work, kept
  sub('s_open', `${gone}-03-01T10:00:00.000Z`);
  refund('s_open', null, null);
  // a plan of 2027 that still runs is never touched
  sub('s_running', `${gone}-03-01T10:00:00.000Z`, 'active');
  // licence codes after their expiry, licence requests after they were handled
  const back = (d) => new Date(now.getTime() - d * DAY).toISOString();
  const code = (hash, expires) => db.prepare("INSERT INTO licence_codes (code_hash, seats, classes_left, until, created_at, expires_at) VALUES (?, 30, 1, '2034-09-01', ?, ?)").run(hash, expires, expires);
  code('c_gone', back(RETENTION.licenceCodeAfterExpiryDays + 1)); code('c_kept', back(RETENTION.licenceCodeAfterExpiryDays - 1));
  const req = (id, handled) => db.prepare("INSERT INTO licence_requests (id, class_code, wants, school, created_at, handled_at) VALUES (?, 'ABC234', 'quote', 'אורט', ?, ?)").run(id, back(3000), handled);
  req('r_gone', back(RETENTION.licenceRequestAfterHandledDays + 1)); req('r_kept', back(RETENTION.licenceRequestAfterHandledDays - 1)); req('r_open', null);

  const report = await run(h.env, { now });
  assert.deepEqual(report.purge.longTerm, { refunds: 1, payments: 2, orderRenewals: 1, orders: 2, subscriptions: 2, licenceCodes: 1, licenceRequests: 1, accounts: 0 });
  const ids = (sql) => rows(h.env, sql).map((r) => Object.values(r)[0]).sort();
  assert.deepEqual(ids('SELECT id FROM payments'), ['p_edge', 'p_kept', 'p_late']);
  assert.deepEqual(ids('SELECT id FROM subscriptions'), ['s_kept', 's_late', 's_open', 's_running']);
  assert.deepEqual(ids('SELECT payment_id FROM refund_queue'), [null, 'p_late']);
  assert.deepEqual(ids('SELECT id FROM orders'), []);
  assert.deepEqual(ids('SELECT order_id FROM order_renewals'), []);
  assert.deepEqual(ids('SELECT code_hash FROM licence_codes'), ['c_kept']);
  assert.deepEqual(ids('SELECT id FROM licence_requests'), ['r_kept', 'r_open']);
  // a year later, 2028 has had its 7 years too
  advanceClock(366 * DAY);
  await run(h.env, { now: new Date() });
  assert.deepEqual(ids('SELECT id FROM payments'), [], 'p_late goes once its refund (done in 2028) went');
  assert.deepEqual(ids('SELECT id FROM subscriptions'), ['s_open', 's_running']);
});
