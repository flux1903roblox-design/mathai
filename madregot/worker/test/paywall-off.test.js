// AI_PAYWALL = "off" (the default): the limits from before the paid tutor, exactly. Claude is stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, ai, makeClass, bearer, setCount, countOf, netOf, rows, DEVICE } from './helpers.js';

let h;
afterEach(() => h?.done());
const off = (over = {}) => setup({ AI_PAYWALL: undefined, ...over });

test('off: a student gets 40 actions a day of every kind, all on CLAUDE_MODEL', async () => {
  h = await off();
  const cls = await makeClass(h, { students: ['נועה'] });
  const s = bearer(cls.students[0]);
  const kinds = ['explain', 'chat', 'generate', 'check', 'exam'];
  for (let i = 0; i < 40; i++) {
    const r = await ai(h, kinds[i % 5], s);
    assert.equal(r.status, 200, `call ${i + 1}`);
    assert.equal(r.headers.get('X-AI-Tier'), 'open');
    assert.equal(r.headers.get('X-AI-Left'), String(39 - i));
  }
  const over = await ai(h, 'explain', s);
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error, 'daily_limit');
  assert.equal(h.net.log.claude.length, 40);
  assert.ok(h.net.log.claude.every((p) => p.model === 'claude-opus-5-5'));
  assert.equal(countOf(h.env, `s:${cls.students[0].studentId}`), 40);
});

test('off: a teacher gets 200 a day (TEACHER_DAILY_LIMIT, default 200)', async () => {
  h = await off({ TEACHER_DAILY_LIMIT: undefined });
  const cls = await makeClass(h);
  await setCount(h.env, `t:${cls.code}`, 199);
  const r = await ai(h, 'generate', cls.teacher);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Left'), '0');
  assert.equal((await ai(h, 'explain', cls.teacher)).status, 429);
  const wrong = await ai(h, 'explain', { ...cls.teacher, 'X-Teacher-Key': 'nope' });
  assert.equal(wrong.status, 401, 'a wrong teacher key is refused, not counted as solo');
});

test('off: students without a class share 20 a day per network; ALLOW_SOLO_AI=false refuses', async () => {
  h = await off();
  for (let i = 0; i < 20; i++) {
    const r = await ai(h, 'explain', { 'X-Device': String(i).padStart(32, 'b') });
    assert.equal(r.status, 200, `device ${i}`);
  }
  assert.equal((await ai(h, 'check', { 'X-Device': 'c'.repeat(32) })).status, 429, 'the 21st on the network');
  assert.equal((await ai(h, 'check', { 'X-Device': 'c'.repeat(32) }, { ip: '198.51.100.9' })).status, 200, 'another network');
  assert.equal(countOf(h.env, `solo:n:${await netOf(h.env)}`), 20);
  h.done();
  h = await off({ ALLOW_SOLO_AI: 'false' });
  const r = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'solo_ai_off');
});

test('off: no ai_usage key contains a raw IPv4 or IPv6 address', async () => {
  h = await off();
  await ai(h, 'explain', {}, { ip: '203.0.113.77' });
  await ai(h, 'explain', {}, { ip: '2001:db8:4:5::99' });
  await makeClass(h, { students: ['דנה'] });
  await h.call('GET', '/api/classes/ABCDEF', { ip: '203.0.113.77' });
  const keys = rows(h.env, 'SELECT who FROM ai_usage').map((r) => r.who);
  assert.ok(keys.length >= 4, keys.join(','));
  for (const k of keys) {
    assert.doesNotMatch(k, /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, k);
    assert.doesNotMatch(k, /2001:db8|::/i, k);
  }
});

test('off: the status endpoint reports the open tier and what is left, counting nothing', async () => {
  h = await off();
  const cls = await makeClass(h, { students: ['נועה'] });
  await ai(h, 'explain', bearer(cls.students[0]));
  const s = await (await h.call('GET', '/api/ai/status', { headers: bearer(cls.students[0]) })).json();
  assert.deepEqual(s, { paywall: false, tier: 'open', kinds: ['explain', 'chat', 'generate', 'check', 'exam'], groups: { all: { left: 39, limit: 40 } }, aiReady: true });
  assert.equal(countOf(h.env, `s:${cls.students[0].studentId}`), 1);
});

test('off: checkout answers 503 paywall_off, while sign-in still works for rehearsals', async () => {
  h = await off();
  const { signIn } = await import('./helpers.js');
  const token = await signIn(h, 'rehearse@example.test');
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': 'k'.repeat(20) }, body: { plan: 'family_month', adult: true, terms: '2026-11' } });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'paywall_off');
});
