// Error reports (DURABLE-9): POST /api/errors counts what the app sends per day and fingerprint, scrubbed again here,
// with the network and global caps; the Worker's own unhandled exceptions are counted under the route's pattern (the
// webhook's secret never stored); 30 days kept; yesterday's top 5 in the owner's daily summary, and a notice when there
// were many. No column ever holds the address the reports came from.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { run } from '../src/cron.js';
import { routePattern, errorsOf, NET_DAILY } from '../src/errors.js';
import { dayOf, jerusalemMidnight } from '../src/util.js';
import { setup, rows, one, signedTestEvent, countOf, netOf } from './helpers.js';
import { build, formatTable, wranglerRows } from '../scripts/owner.mjs';

let h;
afterEach(() => h?.done());
const IP = '203.0.113.7';
const item = (over = {}) => ({ kind: 'render', name: 'TypeError@Me', message: 'cannot read x', frame: 'Me-B2x9k.js:1:4521', route: '/me', agent: 'android-chrome-131', n: 1, ...over });
const send = (body, opts = {}) => h.call('POST', '/api/errors', { body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, ip: IP, ...opts });
const batch = (items, release = 'abc1234') => ({ v: 1, release, items });
const DAY = 864e5;
const night = () => new Date(jerusalemMidnight(dayOf()).ms + 3 * 3600_000 + 10 * 60_000);

test('a batch is counted per day and fingerprint: the same failure again adds to its row', async () => {
  h = await setup();
  assert.equal((await send(batch([item(), item({ message: 'another one' })]))).status, 202);
  assert.equal((await send(batch([item()]))).status, 202);
  // the same failure on another browser class is its own row; the body is read from text/plain
  assert.equal((await send(JSON.stringify(batch([item({ agent: 'ios-safari-17' })])))).status, 202);
  const all = rows(h.env, 'SELECT * FROM client_errors ORDER BY count DESC, agent');
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((r) => [r.message, r.agent, r.count]), [['cannot read x', 'android-chrome-131', 2], ['another one', 'android-chrome-131', 1], ['cannot read x', 'ios-safari-17', 1]]);
  const r = all[0];
  assert.equal(r.day, dayOf()); assert.equal(r.release, 'abc1234'); assert.equal(r.kind, 'render'); assert.equal(r.route, '/me');
  assert.equal(r.frame, 'Me-B2x9k.js:1:4521'); assert.match(r.fp, /^[0-9a-f]{16}$/);
  assert.ok(r.first_at <= r.last_at);
});

test('an unknown kind is refused whole (400), as is a kind only the Worker uses, a bad shape, and more than 8 KB', async () => {
  h = await setup();
  for (const kind of ['nonsense', 'server', undefined]) {
    const res = await send(batch([item(), item({ kind })]));
    assert.equal(res.status, 400, String(kind));
    assert.equal((await res.json()).error, 'unknown_kind');
  }
  for (const body of [{ v: 2, items: [item()] }, { v: 1, items: [] }, { v: 1, items: Array.from({ length: 11 }, (_, i) => item({ message: `m${i}` })) }, 'not json']) {
    assert.equal((await send(body)).status, 400);
  }
  assert.equal((await send(batch([item({ message: 'x'.repeat(9000) })]))).status, 413);
  assert.equal(rows(h.env, 'SELECT * FROM client_errors').length, 0);
});

test('the server scrubs and clips again: long messages, digits, emails, keys, hex, bad frames, routes and agents', async () => {
  h = await setup();
  const raw = item({
    name: `Error${'N'.repeat(80)}`,
    message: `student 48213 of noa.cohen@example.test sent sk-ant-api03-SECRET with token ${'ab12'.repeat(10)} ${'y'.repeat(400)}`,
    frame: 'https://evil.example.test/x.js?q=12345:1:2', route: '/lesson/signed/123', agent: 'Mozilla/5.0 (iPhone 12345)',
  });
  assert.equal((await send(batch([raw], 'v1.2.3<script>'))).status, 202);
  const r = one(h.env, 'SELECT * FROM client_errors');
  assert.equal(r.message.length, 200);
  assert.ok(r.message.startsWith('student # of @ sent … with token … y'), r.message);
  assert.doesNotMatch(JSON.stringify(r), /48213|noa\.cohen|SECRET|ab12ab12|sk-ant/);
  assert.equal(r.name.length, 40);
  assert.equal(r.frame, '');
  assert.equal(r.route, '/other'); // a route with a value in it is not a pattern
  assert.equal(r.agent, 'other');
  assert.equal(r.release, 'unknown');
});

test('the network cap: 100 items a day from one network, then 202 and dropped; another network still counts', async () => {
  h = await setup();
  for (let i = 0; i < NET_DAILY / 10; i += 1) {
    const res = await send(batch(Array.from({ length: 10 }, (_, k) => item({ message: `failure ${String.fromCharCode(97 + i)}${String.fromCharCode(97 + k)}` }))));
    assert.equal(res.status, 202);
  }
  assert.equal(one(h.env, 'SELECT SUM(count) AS n FROM client_errors').n, 100);
  const over = await send(batch([item({ message: 'one too many' })]));
  assert.equal(over.status, 202);
  assert.equal((await over.json()).dropped, 1);
  assert.equal(one(h.env, 'SELECT SUM(count) AS n FROM client_errors').n, 100);
  assert.equal(await countOf(h.env, `err:n:${await netOf(h.env, IP)}`), 100);
  assert.equal((await send(batch([item({ message: 'from school' })]), { ip: '198.51.100.20' })).status, 202);
  assert.equal(one(h.env, 'SELECT SUM(count) AS n FROM client_errors').n, 101);
  assert.equal(await countOf(h.env, 'err:all'), 101);
});

test('no column holds the address the reports came from', async () => {
  h = await setup();
  await send(batch([item(), item({ kind: 'csp', name: 'img-src', message: 'https://pixel.example.test', frame: '' })]));
  for (const table of ['client_errors', 'ai_usage']) {
    for (const r of rows(h.env, `SELECT * FROM ${table}`)) assert.doesNotMatch(JSON.stringify(r), /203\.0\.113|203_0_113/, table);
  }
});

test('an unhandled exception on the webhook path is counted under its pattern, never with the secret', async () => {
  h = await setup();
  const secret = h.env.WEBHOOK_PATH_SECRET;
  // the database fails in the middle of the webhook, with the path in its message
  const prepare = h.env.DB.prepare;
  h.env.DB.prepare = (sql) => { if (sql.includes('FROM billing_events')) throw new TypeError(`db gone for /api/billing/webhook/test/${secret}`); return prepare(sql); };
  const ev = await signedTestEvent(h.env, { id: 'ev_1', type: 'paid', subscription: 'tsub_1', payment: 'pay_1', amountAgorot: 2990, currency: 'ILS', occurredAt: new Date().toISOString() });
  const res = await h.call('POST', `/api/billing/webhook/test/${secret}`, { body: ev.body, headers: ev.headers });
  assert.equal(res.status, 500);
  await h.ctx.flush();
  h.env.DB.prepare = prepare;
  const r = one(h.env, 'SELECT * FROM client_errors');
  assert.equal(r.kind, 'server');
  assert.equal(r.route, '/api/billing/webhook/:provider/:secret');
  assert.equal(r.name, 'TypeError');
  assert.equal(r.agent, 'worker');
  for (const x of rows(h.env, 'SELECT * FROM client_errors')) assert.ok(!JSON.stringify(x).includes(secret));
  assert.ok(!JSON.stringify(rows(h.env, 'SELECT * FROM ai_usage')).includes(secret));
});

test('a failure to count a server error is swallowed: the answer is still the 500', async () => {
  h = await setup();
  const prepare = h.env.DB.prepare;
  h.env.DB.prepare = (sql) => { if (/billing_events|ai_usage|client_errors/.test(sql)) throw new Error('db down'); return prepare(sql); };
  const ev = await signedTestEvent(h.env, { id: 'ev_2', type: 'paid', subscription: 'tsub_2', payment: 'pay_2', amountAgorot: 2990, currency: 'ILS', occurredAt: new Date().toISOString() });
  const res = await h.call('POST', `/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, { body: ev.body, headers: ev.headers });
  assert.equal(res.status, 500);
  await h.ctx.flush();
  h.env.DB.prepare = prepare;
  assert.equal(rows(h.env, 'SELECT * FROM client_errors').length, 0);
});

test('every route of the Worker has its pattern; anything else is /api/other', () => {
  const src = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const literal = [...src.matchAll(/p === '(\/api\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(literal.length > 25);
  // and the routes with values in them: each regex route of index.js maps to a pattern
  for (const p of ['/api/ai/explain', '/api/billing/orders/0123456789abcdef', '/api/billing/payments/0123456789abcdef/invoice', '/api/billing/test-pay/0123456789abcdef',
    '/api/family/devices/0123456789abcdef/unlink', '/api/family/devices/0123456789abcdef/sharing', '/api/family/devices/0123456789abcdef/history/delete', '/api/classes/K7Q2MD', '/api/teacher/help/12', '/api/teacher/help/12/image', '/api/teacher/students/ab12/remove']) {
    assert.notEqual(routePattern(p), '/api/other', p);
    assert.doesNotMatch(routePattern(p), /\d|K7Q2MD/, p);
  }
  for (const p of literal) assert.equal(routePattern(p), p, p);
  assert.equal(routePattern('/api/classes/K7Q2MD/join'), '/api/classes/:code/join');
  assert.equal(routePattern('/api/teacher/students/0a1b/reset-pin'), '/api/teacher/students/:id/reset-pin');
  assert.equal(routePattern('/api/ai/chat'), '/api/ai/:kind');
  assert.equal(routePattern('/api/secret/12345'), '/api/other');
  assert.equal(routePattern('/'), '/api/other');
});

test('the night purge keeps 30 days of reports and deletes older ones', async () => {
  h = await setup();
  const now = night();
  const ins = (day) => h.env.DB.raw.prepare(`INSERT INTO client_errors (day, fp, release, kind, name, message, frame, route, agent, count, first_at, last_at)
    VALUES (?, '0123456789abcdef', 'abc1234', 'error', 'Error', 'x', '', '/me', 'other', 1, ?, ?)`).run(day, now.toISOString(), now.toISOString());
  const back = (d) => dayOf(new Date(now.getTime() - d * DAY));
  ins(back(30)); ins(back(31)); ins(back(45)); ins(back(0));
  await run(h.env, { now });
  assert.deepEqual(rows(h.env, 'SELECT day FROM client_errors ORDER BY day').map((r) => r.day), [back(30), back(0)]);
});

test('the daily summary lists yesterday\'s total and top 5; many errors queue an owner notice', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const now = night();
  const yesterday = dayOf(new Date(now.getTime() - DAY));
  const add = (fp, message, count, route = '/me', agent = 'other') => h.env.DB.raw.prepare(`INSERT INTO client_errors (day, fp, release, kind, name, message, frame, route, agent, count, first_at, last_at)
    VALUES (?, ?, 'abc1234', 'render', 'Error', ?, '', ?, ?, ?, ?, ?)`).run(yesterday, fp, message, route, agent, count, now.toISOString(), now.toISOString());
  add('aaaaaaaaaaaaaaaa', 'first', 40); add('aaaaaaaaaaaaaaaa', 'first', 30, '/me', 'ios-safari-17');
  add('bbbbbbbbbbbbbbbb', 'second', 50); add('cccccccccccccccc', 'third', 20); add('dddddddddddddddd', 'fourth', 10);
  add('eeeeeeeeeeeeeeee', 'fifth', 5); add('ffffffffffffffff', 'sixth', 1);
  const e = await errorsOf(h.env, yesterday);
  assert.equal(e.total, 156);
  assert.deepEqual(e.top.map((x) => [x.message, x.count]), [['first', 70], ['second', 50], ['third', 20], ['fourth', 10], ['fifth', 5]]);
  assert.deepEqual(Object.keys(e.top[0]).sort(), ['count', 'kind', 'message', 'release', 'route']);
  await run(h.env, { now });
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${yesterday}`).params);
  assert.equal(p.errors.total, 156);
  assert.equal(p.errors.top.length, 5);
  const mail = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] סיכום יומי'));
  assert.match(mail.text, /תקלות באפליקציה: 156/);
  assert.match(mail.text, /- 70 × render \/me abc1234: first/);
  // 156 reports and at most 70 of one: no separate notice
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:errors:%'").length, 0);
  // one failure over 100: the owner hears it that night, once
  add('9999999999999999', 'storm', 101, '/lesson/:topic/:level');
  await run(h.env, { now });
  await run(h.env, { now });
  const n = rows(h.env, 'SELECT * FROM notices WHERE kind = ?', `owner:errors:${yesterday}`);
  assert.equal(n.length, 1);
  const alert = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] הרבה תקלות באפליקציה'));
  assert.ok(alert, 'sent');
  assert.match(alert.text, /npm run owner -- errors/);
});

test('npm run owner -- errors [--days 7]: the reports of the last days as a table, most frequent first', async () => {
  h = await setup();
  await send(batch([item(), item({ message: 'another one' })]));
  await send(batch([item()]));
  const now = new Date().toISOString();
  const b = build('errors', {}, { now });
  assert.equal(b.readOnly, true);
  assert.ok(b.sql.includes(`day >= '${dayOf(new Date(Date.parse(now) - 6 * DAY))}'`));
  assert.ok(build('errors', { days: '1' }, { now }).sql.includes(`day >= '${dayOf(new Date(now))}'`));
  assert.throws(() => build('errors', { days: '31' }, { now }));
  assert.throws(() => build('errors', { days: "7'; DROP" }, { now }));
  const out = h.env.DB.raw.prepare(b.sql).all();
  assert.deepEqual(out.map((r) => [r.count, r.message]), [[2, 'cannot read x'], [1, 'another one']]);
  // as the CLI prints it from wrangler's JSON
  const text = formatTable(wranglerRows(JSON.stringify([{ results: out, success: true }])), b.table);
  const lines = text.split('\n');
  assert.match(lines[0], /^count\s+kind\s+route\s+release\s+agents\s+name\s+message/);
  assert.match(lines[2], /^2\s+render\s+\/me\s+abc1234\s+1\s+TypeError@Me\s+cannot read x/);
  assert.equal(formatTable([], b.table), '(nothing)');
});
