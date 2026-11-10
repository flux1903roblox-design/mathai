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
  const { resetsAt } = await import('../src/util.js');
  assert.deepEqual(s, { paywall: false, tier: 'open', kinds: ['explain', 'chat', 'generate', 'check', 'exam'], groups: { all: { left: 39, limit: 40 } }, resetsAt: resetsAt('day'), aiReady: true });
  assert.match(s.resetsAt, /T00:00:00\+0[23]:00$/, 'the next midnight in Jerusalem: a screen left open asks again then');
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

test('off (a rollback while families still pay): a device of a live family plan keeps its own key, even with ALLOW_SOLO_AI=false', async () => {
  const { insertSub, linkDevice } = await import('./helpers.js');
  h = await off({ ALLOW_SOLO_AI: 'false' });
  const acc = 'fam0000000000001';
  h.env.DB.raw.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)').run(acc, 'payer@example.test', new Date().toISOString());
  insertSub(h.env, { kind: 'family', account_id: acc, plan: 'family_month', provider: 'test', price_agorot: 2990 });
  const dev = await linkDevice(h.env, acc);
  const r = await ai(h, 'explain', { ...dev.headers, 'X-Device': DEVICE });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'open');
  assert.equal(r.headers.get('X-AI-Left'), '39', 'the student limit, not the network\'s solo 20');
  assert.equal(countOf(h.env, `fam:${acc}`), 1);
  assert.equal(h.net.log.claude.at(-1).model, 'claude-opus-5-5');
  const st = await (await h.call('GET', '/api/ai/status', { headers: dev.headers })).json();
  assert.deepEqual(st.groups.all, { left: 39, limit: 40 });
  // a device whose family plan ended is a solo device again (refused here, as ALLOW_SOLO_AI is false)
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'ended', ended_reason = 'canceled'").run();
  const after = await ai(h, 'explain', dev.headers);
  assert.equal(after.status, 403); assert.equal((await after.json()).error, 'solo_ai_off');
});
