// Size limits before JSON.parse, and the rate limits that stop guessing and floods (class lookups, joins, locks).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, makeClass, setCount, netOf, DEVICE, ai, countOf, devOf, rows, claudeReply, signIn, accountId, insertSub, linkDevice,
  FEEDBACK_INPUT, FEEDBACK_REPLY, bearer,
} from './helpers.js';

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

test('a help request keeps a notebook page of up to 600,000 characters; a larger page in a body under 700 KB arrives without it; over 700 KB is 413', async () => {
  const { bearer, one } = await import('./helpers.js');
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const page = (n) => `data:image/jpeg;base64,${'A'.repeat(n - 'data:image/jpeg;base64,'.length)}`;
  const ask = (image, question) => h.call('POST', '/api/help', { headers: bearer(cls.students[0]), body: { topic: 'signed', level: 1, question, answer: '5', note: 'לא הבנתי', image } });
  assert.equal((await ask(page(600_000), 'q1')).status, 200);
  assert.equal(one(h.env, "SELECT length(image) AS n FROM help_requests WHERE question = 'q1'").n, 600_000);
  assert.equal((await ask(page(650_000), 'q2')).status, 200);
  assert.equal(one(h.env, "SELECT image FROM help_requests WHERE question = 'q2'").image, null, 'the question arrives, the page is dropped');
  assert.equal((await ask(page(720_000), 'q3')).status, 413, 'the app never sends this: it shrinks the page first (lib/fitImage.js)');
});

// ---------------------------------------------------------------- feedback on a written explanation (ai spec AI-10)
test('feedback: one tutor question, given back when the reply is not the asked JSON; its body limit is 8,000 bytes', async () => {
  let mode = 'ok';
  h = await setup({}, { claude: (p) => claudeReply(p, mode === 'ok' ? {} : { text: '{"points": oops' }) });
  const dev = await devOf(h.env);
  const r = await ai(h, 'feedback', { 'X-Device': DEVICE });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Group'), 'tutor'); assert.equal(r.headers.get('X-AI-Left'), '1');
  const body = await r.json();
  assert.deepEqual(body.points, FEEDBACK_REPLY.points, 'the stub\'s quotes are the student\'s words, so they stay');
  assert.equal(body.summary, FEEDBACK_REPLY.summary); assert.equal(body.care, false);
  assert.equal(countOf(h.env, `free:d:${dev}`), 1, 'one of the free taste\'s 2 tutor questions');
  // the free taste sends it on the low-cost model, at high effort with 4,000 tokens
  const sent = h.net.log.claude.at(-1);
  assert.equal(sent.model, h.env.FREE_MODEL || 'claude-haiku-5-5'); assert.equal(sent.max_tokens, 4000); assert.equal(sent.output_config.effort, 'high');
  mode = 'broken';
  const bad = await ai(h, 'feedback', { 'X-Device': DEVICE });
  assert.equal(bad.status, 502); assert.equal((await bad.json()).error, 'bad_output');
  assert.equal(countOf(h.env, `free:d:${dev}`), 1, 'the broken reply\'s question was given back');
  // a body over 8,000 bytes is refused before it is read
  const big = await ai(h, 'feedback', { 'X-Device': DEVICE }, { body: { ...FEEDBACK_INPUT, text: 'א'.repeat(5000) } });
  assert.equal(big.status, 413);
  // a request with no rubric is 400 and counts nothing
  const none = await ai(h, 'feedback', { 'X-Device': DEVICE }, { body: { ...FEEDBACK_INPUT, rubric: [] } });
  assert.equal(none.status, 400); assert.equal((await none.json()).error, 'bad_input');
  assert.equal(countOf(h.env, `free:d:${dev}`), 1);
});

test('feedback on a family plan: one unit of the tutor group on the paid model; a class student\'s one unit of the class cap', async () => {
  h = await setup();
  await signIn(h, 'fam@example.test');
  const a = accountId(h.env, 'fam@example.test');
  insertSub(h.env, { kind: 'family', account_id: a });
  const d = await linkDevice(h.env, a);
  const r = await ai(h, 'feedback', d.headers);
  assert.equal(r.status, 200); assert.equal(r.headers.get('X-AI-Tier'), 'family'); assert.equal(r.headers.get('X-AI-Group'), 'tutor');
  assert.equal(countOf(h.env, `fam:${a}:tutor`), 1);
  const sent = h.net.log.claude.at(-1);
  assert.equal(sent.model, h.env.CLAUDE_MODEL); assert.equal(sent.max_tokens, 3000); assert.equal(sent.output_config.effort, 'low');
  // the student's explanation was masked before it left; the safety log counts it, with no text
  const pii = await ai(h, 'feedback', d.headers, { body: { ...FEEDBACK_INPUT, text: `${FEEDBACK_INPUT.text} תתקשרו 050-1234567` } });
  assert.equal(pii.status, 200);
  assert.ok(!JSON.stringify(h.net.log.claude.at(-1)).includes('050-1234567'));
  await h.ctx.flush();
  assert.deepEqual(rows(h.env, "SELECT kind, category, surface FROM safety_events WHERE kind = 'pii_masked'").map((x) => ({ ...x })), [{ kind: 'pii_masked', category: 'phone', surface: 'feedback' }]);
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  insertSub(h.env, { kind: 'class', class_code: cls.code });
  const s = cls.students[0];
  const before = countOf(h.env, `cls:${cls.code}`);
  const sr = await ai(h, 'feedback', bearer(s));
  assert.equal(sr.status, 200); assert.equal(sr.headers.get('X-AI-Group'), 'tutor');
  assert.equal(countOf(h.env, `cls:${cls.code}`) - before, 1, 'one unit, as explain and chat');
  assert.equal(countOf(h.env, `s:${s.studentId}:tutor`), 1);
});
