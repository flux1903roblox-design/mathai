// The edge rate limit (DURABLE-16, src/edge.js) with a stub of Cloudflare's binding: sign-in, verify, class lookup,
// join and new devices count per network (IPv6 by its /48); the AI routes per caller, so two devices behind one school
// address are counted apart; over the limit is 429 slow_down with Retry-After: 60; with no binding nothing is checked
// and the D1 counters (counters.test.js) still hold.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { edgeLimit, AUTH_ROUTES } from '../src/edge.js';
import { setup } from './helpers.js';

let h;
afterEach(() => { h?.done(); h = null; });

/** A stand-in for the Workers Rate Limiting binding: allows `n` per key, records every key it was asked about. */
function stubLimiter(n) {
  const seen = new Map();
  return {
    seen,
    async limit({ key }) { const c = (seen.get(key) || 0) + 1; seen.set(key, c); return { success: c <= n }; },
  };
}
const verify = (ip) => h.call('POST', '/api/account/verify', { ip, body: { email: 'parent@example.test', code: '000000' } });

test('a stub that allows 2: the third verify from one network is 429 slow_down with Retry-After: 60; another network still passes', async () => {
  const RL_AUTH = stubLimiter(2);
  h = await setup({ RL_AUTH });
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await verify('198.51.100.7')).status);
  assert.notEqual(codes[0], 429); assert.notEqual(codes[1], 429);
  const third = await verify('198.51.100.7');
  assert.equal(third.status, 429);
  assert.equal(third.headers.get('Retry-After'), '60');
  assert.equal((await third.json()).error, 'slow_down');
  assert.notEqual((await verify('203.0.113.50')).status, 429, 'another network');
  // the key is the network's HMAC, never the address
  for (const k of RL_AUTH.seen.keys()) { assert.match(k, /^n:[0-9a-f]{16}$/); assert.ok(!k.includes('198.51')); }
});

test('an IPv6 allocation counts by its /48: two /64s of one /48 share the limit', async () => {
  const RL_AUTH = stubLimiter(1);
  h = await setup({ RL_AUTH });
  assert.notEqual((await h.call('POST', '/api/account/code', { ip: '2001:db8:aa:1::5', body: { email: 'a@example.test' } })).status, 429);
  assert.equal((await h.call('POST', '/api/account/code', { ip: '2001:db8:aa:2::5', body: { email: 'b@example.test' } })).status, 429);
});

test('every guarded route goes through RL_AUTH: code, verify, class lookup, join, new devices; other routes do not', async () => {
  const RL_AUTH = stubLimiter(0);
  h = await setup({ RL_AUTH });
  const calls = [
    ['POST', '/api/account/code', { email: 'p@example.test' }], ['POST', '/api/account/verify', { email: 'p@example.test', code: '1' }],
    ['GET', '/api/classes/ABC234'], ['POST', '/api/classes/ABC234/join', { name: 'נועה', pin: '1234' }], ['POST', '/api/devices', {}],
  ];
  for (const [m, p, body] of calls) assert.equal((await h.call(m, p, { body })).status, 429, `${m} ${p}`);
  assert.equal(AUTH_ROUTES.length, calls.length);
  assert.notEqual((await h.call('GET', '/api/health')).status, 429);
  assert.notEqual((await h.call('POST', '/api/classes', { body: { className: 'ז׳3', teacherName: 'רונית', grade: '7' } })).status, 429);
});

test('the AI limiter keys by caller: two devices behind one school network are limited apart; no credential counts the network', async () => {
  const RL_AI = stubLimiter(1);
  h = await setup({ RL_AI });
  const ask = (device) => h.call('POST', '/api/ai/explain', { ip: '192.0.2.10', headers: device ? { 'X-Device': device } : {}, body: { question: '1+1' } });
  assert.notEqual((await ask('a'.repeat(32))).status, 429);
  assert.notEqual((await ask('b'.repeat(32))).status, 429, 'another device on the same network');
  const again = await ask('a'.repeat(32));
  assert.equal(again.status, 429);
  assert.equal((await again.json()).error, 'slow_down');
  const keys = [...RL_AI.seen.keys()];
  assert.equal(keys.length, 2);
  for (const k of keys) { assert.match(k, /^c:[0-9a-f]{32}$/); assert.ok(!k.includes('aaaa')); }
  assert.notEqual((await ask(null)).status, 429);
  assert.ok([...RL_AI.seen.keys()].some((k) => /^n:[0-9a-f]{16}$/.test(k)), 'no credential: the network');
});

test('no binding: 50 requests pass the edge, and only the D1 caps apply', async () => {
  h = await setup();
  const res = [];
  for (let i = 0; i < 50; i++) res.push(await h.call('GET', '/api/classes/ABC234'));
  // no edge answer (it alone sends Retry-After: 60); whatever came back is the handler's own (no such class, or its cap)
  assert.ok(res.every((r) => r.headers.get('Retry-After') !== '60'));
  assert.ok(res.some((r) => r.status === 404), 'the handler answered');
  await edgeLimit(undefined, 'x');
  await edgeLimit({}, 'x');
});

test('edgeLimit: the binding\'s own answer decides', async () => {
  await edgeLimit({ limit: async () => ({ success: true }) }, 'k');
  await assert.rejects(edgeLimit({ limit: async () => ({ success: false }) }, 'k'), (e) => e.status === 429 && e.code === 'slow_down' && e.headers['Retry-After'] === '60');
});
