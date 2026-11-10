// Size limits before JSON.parse, and the rate limits that stop guessing and floods (class lookups, joins, locks).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, setCount, netOf, DEVICE } from './helpers.js';

let h;
afterEach(() => h?.done());
const big = (n) => JSON.stringify({ pad: 'x'.repeat(n) });

test('over-size bodies are 413 before JSON.parse: chat 32 KB, generate 16 KB, account 4 KB, webhook 64 KB', async () => {
  h = await setup();
  for (const [path, size] of [['/api/ai/chat', 33 * 1024], ['/api/ai/explain', 33 * 1024], ['/api/ai/generate', 17 * 1024], ['/api/account/code', 5 * 1024],
    ['/api/classes', 5 * 1024], [`/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, 65 * 1024],
    ['/api/family/link/start', 5 * 1024], ['/api/family/link/finish', 5 * 1024], ['/api/family/devices/leave', 5 * 1024]]) {
    const r = await h.call('POST', path, { body: big(size), headers: { 'X-Device': DEVICE } });
    assert.equal(r.status, 413, path);
    assert.equal((await r.json()).error, 'too_large', path);
  }
  // a declared length is enough to refuse without reading
  const r = await h.worker.fetch(new Request('https://madregot.test/api/ai/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(10 * 1024 * 1024), 'CF-Connecting-IP': '203.0.113.7' }, body: '{}',
  }), h.env, h.ctx);
  assert.equal(r.status, 413);
  // within the limit, broken JSON is 400
  const broken = await h.call('POST', '/api/account/code', { body: '{"email":' });
  assert.equal(broken.status, 400); assert.equal((await broken.json()).error, 'bad_json');
  assert.equal(h.net.log.claude.length, 0);
});

test('GET /api/classes/:code is limited per network (500 a day)', async () => {
  h = await setup();
  const cls = await makeClass(h);
  assert.equal((await h.call('GET', `/api/classes/${cls.code}`)).status, 200);
  await setCount(h.env, `classinfo:n:${await netOf(h.env)}`, 500);
  const r = await h.call('GET', `/api/classes/${cls.code}`);
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'too_many_lookups');
  assert.equal((await h.call('GET', `/api/classes/${cls.code}`, { ip: '198.51.100.3' })).status, 200);
});

test('joins and new classes are counted per network under an HMAC, never the address', async () => {
  h = await setup();
  await makeClass(h, { students: ['נועה'] });
  const net = await netOf(h.env);
  const keys = h.env.DB.raw.prepare('SELECT who FROM ai_usage').all().map((r) => r.who);
  assert.ok(keys.includes(`create:n:${net}`)); assert.ok(keys.includes(`join:n:${net}`));
});

test('without IP_HASH_SECRET the routes that count networks answer 503 server_config', async () => {
  h = await setup({ IP_HASH_SECRET: '' });
  const r = await h.call('POST', '/api/classes', { body: { className: 'א', teacherName: 'ב', grade: '7' } });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'server_config');
});

test('a locked class refuses new names (403 class_locked) and lets its students back in with their PIN', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  h.env.DB.raw.prepare('INSERT INTO class_locks (class_code, locked_at) VALUES (?, ?)').run(cls.code, new Date().toISOString());
  const fresh = await h.call('POST', `/api/classes/${cls.code}/join`, { body: { name: 'זר', pin: '1111' } });
  assert.equal(fresh.status, 403); assert.equal((await fresh.json()).error, 'class_locked');
  const back = await h.call('POST', `/api/classes/${cls.code}/join`, { body: { name: 'נועה', pin: '1234' } });
  assert.equal(back.status, 200); assert.equal((await back.json()).returning, true);
});

test('the admin routes are gone', async () => {
  h = await setup({ ADMIN_KEY: 'admin-key-for-tests-0123456789' });
  for (const [m, p] of [['GET', '/api/admin/subscriptions'], ['POST', '/api/admin/grant'], ['POST', '/api/admin/end']]) {
    assert.equal((await h.call(m, p, { headers: { 'X-Admin-Key': 'admin-key-for-tests-0123456789' }, body: m === 'GET' ? undefined : {} })).status, 404, p);
  }
});

test('class codes use the whole alphabet evenly (no modulo bias)', async () => {
  const { randomFrom, CODE_ALPHABET } = await import('../src/util.js');
  const counts = Object.fromEntries([...CODE_ALPHABET].map((c) => [c, 0]));
  for (let i = 0; i < 31_000; i++) counts[randomFrom(CODE_ALPHABET, 1)]++;
  const chi = Object.values(counts).reduce((s, n) => s + (n - 1000) ** 2 / 1000, 0);
  assert.ok(chi < 59.7, `chi2 ${chi}`); // 30 degrees of freedom, p = 0.001
});
