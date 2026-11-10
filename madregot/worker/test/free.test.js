// The free taste (AI_PAYWALL = "on", no plan): 2 short questions a day on the low-cost model, and the shared ceilings
// behind the person's own count. Claude and the email service are stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LITE_NOTE } from '../../shared/ai.js';
import { resetsAt } from '../src/util.js';
import {
  setup, ai, makeClass, bearer, signIn, accountId, insertSub, linkDevice, countOf, rows, claudeReply, claudeDown, devOf, DEVICE,
} from './helpers.js';

let h;
afterEach(() => h?.done());

test('a device gets 2 tutor questions on claude-haiku-5-5: low effort, 1500 tokens, no fallbacks, a short-answer note, chat clipped', async () => {
  h = await setup();
  const long = 'ש'.repeat(900);
  const messages = Array.from({ length: 13 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i} ${long}` }));
  const r1 = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: { messages, context: { question: 'x'.repeat(700) } } });
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('X-AI-Tier'), 'free');
  assert.equal(r1.headers.get('X-AI-Group'), 'tutor');
  assert.equal(r1.headers.get('X-AI-Left'), '1');
  const r2 = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(r2.headers.get('X-AI-Left'), '0');
  for (const p of h.net.log.claude) {
    assert.equal(p.model, 'claude-haiku-5-5');
    assert.equal(p.max_tokens, 1500);
    assert.equal(p.output_config.effort, 'low');
    assert.equal(p.fallbacks, undefined);
    assert.ok(p.system.endsWith(LITE_NOTE));
  }
  const chat = h.net.log.claude[0];
  assert.equal(chat.messages.length, 5, 'of the last 6 messages, from the first student turn');
  assert.equal(chat.messages[0].role, 'user');
  assert.match(chat.messages[0].content, /8 ש/, 'the turns kept are the newest');
  assert.ok(chat.messages.every((m) => m.content.length <= 600 + 400 + 200), 'each message clipped to 600 (the first carries the context)');
  assert.match(chat.messages[0].content, /Exercise on screen: x{400}\n/, 'the question clipped to 400');
});

test('the 3rd question is 429 daily_limit, with resetsAt at the next Jerusalem midnight', async () => {
  h = await setup();
  await ai(h, 'explain', { 'X-Device': DEVICE });
  await ai(h, 'explain', { 'X-Device': DEVICE });
  const r = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(r.status, 429);
  const b = await r.json();
  assert.equal(b.error, 'daily_limit');
  assert.equal(b.tier, 'free'); assert.equal(b.group, 'tutor'); assert.equal(b.limit, 2); assert.equal(b.left, 0);
  assert.equal(b.resetsAt, resetsAt('day'));
  assert.match(b.resetsAt, /^\d{4}-\d{2}-\d{2}T00:00:00\+0[23]:00$/);
  assert.equal(h.net.log.claude.length, 2);
});

test('check, generate and exam are 402 paid_only, count nothing and never call Claude', async () => {
  h = await setup();
  for (const kind of ['check', 'generate', 'exam']) {
    const r = await ai(h, kind, { 'X-Device': DEVICE });
    assert.equal(r.status, 402, kind);
    assert.deepEqual(await r.json(), { error: 'paid_only', message: 'paid_only', kind });
  }
  assert.equal(h.net.log.claude.length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage').length, 0);
});

test('an upstream 500 and a refusal give the question back; the tries guard stops a refusal loop at 6', async () => {
  let mode = 'down';
  h = await setup({}, { claude: (p) => (mode === 'down' ? claudeDown(500) : claudeReply(p, { stop: 'refusal', text: '' })) });
  const r = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(r.status, 502);
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 0, 'given back');
  mode = 'refuse';
  for (let i = 0; i < 5; i++) assert.equal((await ai(h, 'explain', { 'X-Device': DEVICE })).status, 422);
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 0, 'refusals are given back');
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}:tries`), 6, 'tries are never given back');
  const stopped = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(stopped.status, 429);
  assert.equal((await stopped.json()).error, 'daily_limit');
  assert.equal(h.net.log.claude.length, 6);
});

test('the network cap applies to anonymous devices only: a class student on a busy network is served', async () => {
  h = await setup({ FREE_NET_DAILY: '3' });
  const cls = await makeClass(h, { students: ['נועה'] });
  for (const d of ['b', 'c', 'd']) assert.equal((await ai(h, 'explain', { 'X-Device': d.repeat(32) })).status, 200);
  const r = await ai(h, 'explain', { 'X-Device': 'e'.repeat(32) });
  assert.equal(r.status, 429);
  const b = await r.json();
  assert.equal(b.error, 'shared_limit'); assert.equal(b.scope, 'network');
  assert.equal((await ai(h, 'explain', bearer(cls.students[0]))).status, 200, 'the class student is not counted per network');
  assert.equal((await ai(h, 'explain', { 'X-Device': 'e'.repeat(32) }, { ip: '198.51.100.9' })).status, 200, 'another network');
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env, 'e'.repeat(32))}`), 1, 'the refused question was undone');
});

test('IPv6 addresses in one /64 share the network cap', async () => {
  h = await setup({ FREE_NET_DAILY: '2' });
  assert.equal((await ai(h, 'explain', { 'X-Device': 'b'.repeat(32) }, { ip: '2001:db8:1:2::a' })).status, 200);
  assert.equal((await ai(h, 'explain', { 'X-Device': 'c'.repeat(32) }, { ip: '2001:db8:1:2:abcd::b' })).status, 200);
  assert.equal((await ai(h, 'explain', { 'X-Device': 'd'.repeat(32) }, { ip: '2001:0db8:0001:0002:ffff:1:2:3' })).status, 429);
  assert.equal((await ai(h, 'explain', { 'X-Device': 'd'.repeat(32) }, { ip: '2001:db8:1:3::1' })).status, 200, 'the next /64');
});

test('an unlicensed class past FREE_CLASS_DAILY gets 429 shared_limit {scope: class}', async () => {
  h = await setup({ FREE_CLASS_DAILY: '2' });
  const cls = await makeClass(h, { students: ['א', 'ב', 'ג'] });
  assert.equal((await ai(h, 'explain', bearer(cls.students[0]))).status, 200);
  assert.equal((await ai(h, 'explain', bearer(cls.students[1]))).status, 200);
  const r = await ai(h, 'explain', bearer(cls.students[2]));
  assert.equal(r.status, 429);
  assert.deepEqual([(await r.json()).scope], ['class']);
  const s = await (await h.call('GET', '/api/ai/status', { headers: bearer(cls.students[2]) })).json();
  assert.equal(s.shared, 'class');
});

test('FREE_GLOBAL_DAILY reached: 503 free_paused for free callers; paid callers are not affected', async () => {
  h = await setup({ FREE_GLOBAL_DAILY: '1' });
  assert.equal((await ai(h, 'explain', { 'X-Device': 'b'.repeat(32) })).status, 200);
  const r = await ai(h, 'explain', { 'X-Device': 'c'.repeat(32) });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'free_paused');
  await signIn(h, 'family@example.test');
  insertSub(h.env, { kind: 'family', account_id: accountId(h.env, 'family@example.test') });
  const dev = await linkDevice(h.env, accountId(h.env, 'family@example.test'));
  const paid = await ai(h, 'explain', dev.headers);
  assert.equal(paid.status, 200);
  assert.equal(paid.headers.get('X-AI-Tier'), 'family');
});

test('free spend past FREE_DAILY_BUDGET_USD: 503 free_paused and exactly one owner notice', async () => {
  h = await setup({ FREE_DAILY_BUDGET_USD: '0.000001' });
  assert.equal((await ai(h, 'explain', { 'X-Device': 'b'.repeat(32) })).status, 200);
  await h.ctx.flush();
  for (const d of ['c', 'd']) {
    const r = await ai(h, 'explain', { 'X-Device': d.repeat(32) });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, 'free_paused');
  }
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:free_paused:%'").length, 1);
  const s = await (await h.call('GET', '/api/ai/status', { headers: { 'X-Device': 'c'.repeat(32) } })).json();
  assert.equal(s.shared, 'paused');
});

test('an empty FREE_MODEL still uses claude-haiku-5-5, never CLAUDE_MODEL', async () => {
  h = await setup({ FREE_MODEL: '' });
  await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(h.net.log.claude[0].model, 'claude-haiku-5-5');
});

test('an unlicensed teacher gets 5 free tutor questions', async () => {
  h = await setup();
  const cls = await makeClass(h);
  for (let i = 0; i < 5; i++) assert.equal((await ai(h, 'explain', cls.teacher)).status, 200);
  const r = await ai(h, 'explain', cls.teacher);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).limit, 5);
});

test('X-Account-Token on an AI call gives nothing: a parent session is not a family device', async () => {
  h = await setup();
  const token = await signIn(h, 'parent@example.test');
  insertSub(h.env, { kind: 'family', account_id: accountId(h.env, 'parent@example.test') });
  const r = await ai(h, 'explain', { 'X-Account-Token': token, 'X-Device': DEVICE });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'free');
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 1);
  const s = await (await h.call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.tier, 'free');
  assert.equal(JSON.stringify(s).includes('@'), false, 'no email in the status');
});

test('the status reports the free taste without counting', async () => {
  h = await setup();
  await ai(h, 'chat', { 'X-Device': DEVICE });
  const s = await (await h.call('GET', '/api/ai/status', { headers: { 'X-Device': DEVICE } })).json();
  assert.equal(s.paywall, true); assert.equal(s.tier, 'free');
  assert.deepEqual(s.kinds, ['explain', 'chat']);
  assert.deepEqual(s.groups, { tutor: { left: 1, limit: 2 }, check: null, generate: null, exam: null });
  assert.equal(s.linked, null);
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 1);
});

test('FREE_DEVICE_MINT = "turnstile": only a device minted after a Turnstile check counts as a device', async () => {
  h = await setup({ FREE_DEVICE_MINT: 'turnstile', TURNSTILE_SECRET: 'ts-secret', DEVICE_SECRET: 'device-secret-0123456789' }, {
    other: (url, body) => {
      assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      const ok = new URLSearchParams(body).get('response') === 'good-token';
      return new Response(JSON.stringify({ success: ok, action: 'device', hostname: 'madregot.example.test' }), { headers: { 'Content-Type': 'application/json' } });
    },
  });
  const bot = await h.call('POST', '/api/devices', { body: { turnstile: 'bad' } });
  assert.equal(bot.status, 403); assert.equal((await bot.json()).error, 'bot_check');
  const minted = await h.call('POST', '/api/devices', { body: { turnstile: 'good-token' } });
  assert.equal(minted.status, 201);
  const { device } = await minted.json();
  assert.match(device, /^dv1\.[a-f0-9]{32}\.[a-f0-9]{32}$/);
  await ai(h, 'explain', { 'X-Device': device });
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env, device.split('.')[1])}`), 1);
  await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 0, 'a plain id is not a device here');
  const forged = `dv1.${'1'.repeat(32)}.${'2'.repeat(32)}`;
  await ai(h, 'explain', { 'X-Device': forged });
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env, '1'.repeat(32))}`), 0);
  h.done();
  h = await setup();
  assert.equal((await h.call('POST', '/api/devices', { body: { turnstile: 'x' } })).status, 404, 'no minting while it is off');
});
