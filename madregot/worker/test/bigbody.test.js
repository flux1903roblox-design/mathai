// The AI routes refuse before reading a large body (COUNCIL2-11, COUNCIL2-17), adapted from the council's probes
// (engineering/probe/bigbody.test.mjs, engineering-verify/bigbody2.mjs). A photo kind (check, exam) checks its caller
// before the body is read: an anonymous 20 MB exam is answered 402 or 403 and its stream is never pulled. A declared
// length over the kind's cap (exam 12 MiB, check 4 MiB) is 413 with nothing read, and a body without one stops being
// read at the cap. The text kinds keep distress first: a child in distress with no key and no plan still gets the care
// answer. And the edge limiter (src/edge.js) counts only credentials the server checked: 31 requests from one network,
// each with a made-up X-Device, reach 429 at 30. Claude and the limiter are stubs; every body is synthetic bytes.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setup, makeClass, bearer, ai, insertSub, linkDevice, signIn, accountId, rows, countOf } from './helpers.js';
import { AI_BODY_MAX, EXAM_PAGE_MAX, CHECK_IMAGE_MAX, MAX_EXAM_PAGES } from '../../shared/ai.js';
import { CARE_STATIC } from '../../shared/safety.js';
import { rawBody } from '../src/util.js';

let h;
afterEach(() => { h?.done(); h = null; });

const MiB = 1024 * 1024;
const enc = new TextEncoder();

/**
 * A request body made on demand, `mb` megabytes of base64-looking bytes inside an exam's JSON, that records how many
 * times it was pulled. highWaterMark 0: nothing is pulled until someone reads.
 */
function examStream(mb) {
  const head = enc.encode('{"grade":"7","pages":[{"mediaType":"image/jpeg","data":"');
  const tail = enc.encode('"}]}');
  const chunk = new Uint8Array(MiB).fill(65);
  const s = { pulls: 0, bytes: 0 };
  let sent = 0; let phase = 0;
  s.stream = new ReadableStream({
    pull(c) {
      s.pulls += 1;
      const put = (b) => { s.bytes += b.byteLength; c.enqueue(b); };
      if (phase === 0) { put(head); phase = 1; return; }
      if (phase === 1) { if (sent < mb) { put(chunk); sent += 1; return; } put(tail); phase = 2; return; }
      c.close();
    },
  }, { highWaterMark: 0 });
  return s;
}
const post = (kind, { body, headers = {}, ip = '203.0.113.9' }) => h.worker.fetch(new Request(`https://madregot.test/api/ai/${kind}`, {
  method: 'POST', body, duplex: 'half', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
}), h.env, h.ctx);
const counters = () => rows(h.env, 'SELECT who, count FROM ai_usage').length;

test('an anonymous 20 MB exam is refused before its body is read: 402 paid_only with the paywall on, 403 with the shipped parent\'s OK', async () => {
  // the paywall on (the council's probe): an exam is not in the free taste
  h = await setup({ AI_PAYWALL: 'on' });
  let s = examStream(20);
  let r = await post('exam', { body: s.stream });
  assert.equal(r.status, 402);
  assert.equal((await r.json()).error, 'paid_only');
  assert.equal(s.pulls, 0, 'the body stream was never pulled');
  assert.equal(h.net.log.claude.length, 0);
  assert.equal(counters(), 0, 'a refused request counts nothing');
  h.done();

  // the shipped settings: the paywall off and a parent's OK required
  h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: 'required' });
  s = examStream(20);
  r = await post('exam', { body: s.stream, headers: { 'X-Device': 'b'.repeat(32) } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'parent_ok_needed');
  assert.equal(s.pulls, 0);
  // a check too, and a made-up class student token is no credential
  s = examStream(20);
  r = await post('check', { body: s.stream, headers: { Authorization: `Bearer ${'f'.repeat(48)}` } });
  assert.equal(r.status, 403);
  assert.equal(s.pulls, 0);
  // a teacher key that does not match: 401, unread
  const cls = await makeClass(h);
  s = examStream(20);
  r = await post('exam', { body: s.stream, headers: { 'X-Class-Code': cls.code, 'X-Teacher-Key': 'not-the-key' } });
  assert.equal(r.status, 401);
  assert.equal(s.pulls, 0);
  assert.equal(h.net.log.claude.length, 0);
});

test('a class whose tutor is off and a server with no AI key refuse a photo with the body unread', async () => {
  h = await setup({ AI_PAYWALL: 'off' });
  const cls = await makeClass(h, { students: ['נועה'] }); // a school class: student AI off until the catalogue approval
  let s = examStream(5);
  let r = await post('check', { body: s.stream, headers: bearer(cls.students[0]) });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'class_ai_off');
  assert.equal(s.pulls, 0);
  h.env.ANTHROPIC_API_KEY = '';
  s = examStream(5);
  r = await post('exam', { body: s.stream, headers: cls.teacher });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'ai_not_configured');
  assert.equal(s.pulls, 0);
});

test('a Content-Length over the kind\'s cap is 413 too_large with nothing read, even for a caller who may ask', async () => {
  h = await setup({ AI_PAYWALL: 'off' });
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  for (const [kind, headers] of [['exam', cls.teacher], ['check', bearer(cls.students[0])], ['chat', {}], ['explain', {}]]) {
    const s = examStream(1);
    const r = await post(kind, { body: s.stream, headers: { ...headers, 'Content-Length': String(AI_BODY_MAX[kind] + 1) } });
    assert.equal(r.status, 413, kind);
    assert.equal((await r.json()).error, 'too_large');
    assert.equal(s.pulls, 0, `${kind}: nothing read`);
  }
  assert.equal(h.net.log.claude.length, 0);
  assert.equal(countOf(h.env, `t:${cls.code}`), 0);
});

test('the caps: exam about 12 MB and check about 4 MB; a body with no length stops being read at the cap', async () => {
  assert.equal(AI_BODY_MAX.exam, 12 * MiB);
  assert.equal(AI_BODY_MAX.check, 4 * MiB);
  assert.equal(AI_BODY_MAX.chat, 32 * 1024);
  h = await setup({ AI_PAYWALL: 'off' });
  // a private group: its teacher may check work (a school class's teacher prepares materials only: prep_only)
  const cls = await makeClass(h, { setting: 'private' });
  // an entitled teacher, 30 MB with no Content-Length: refused once the bytes pass 12 MiB, the rest never pulled
  const s = examStream(30);
  const r = await post('exam', { body: s.stream, headers: cls.teacher });
  assert.equal(r.status, 413);
  assert.ok(s.bytes <= AI_BODY_MAX.exam + 2 * MiB, `read ${s.bytes} bytes`);
  assert.ok(s.pulls <= 15, `pulled ${s.pulls} times`);
  assert.equal(countOf(h.env, `t:${cls.code}`), 0, 'nothing counted');
  // rawBody alone: one buffer, the declared length's size, decoded once
  const text = JSON.stringify({ a: 'שלום', b: 'x'.repeat(1000) });
  assert.equal(await rawBody(new Request('https://x.test/', { method: 'POST', body: text }), 4096), text);
  await assert.rejects(rawBody(new Request('https://x.test/', { method: 'POST', body: 'x'.repeat(5000) }), 4096), (e) => e.status === 413);
});

test('the largest exam the app sends (8 pages at EXAM_PAGE_MAX) is read and checked; one page over it is 400', async () => {
  // MAX_EXAM_PAGES pages of the most PhotoPrep sends fit under the cap with room for the rest of the request
  assert.ok(MAX_EXAM_PAGES * EXAM_PAGE_MAX + 512 * 1024 <= AI_BODY_MAX.exam);
  assert.ok(CHECK_IMAGE_MAX + 512 * 1024 <= AI_BODY_MAX.check);
  h = await setup({ AI_PAYWALL: 'off' });
  const cls = await makeClass(h, { setting: 'private' }); // a private group's teacher may check an exam (not prep_only)
  const page = `data:image/jpeg;base64,${'A'.repeat(EXAM_PAGE_MAX - 'data:image/jpeg;base64,'.length)}`;
  const topics = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, title: 'נושא לבדיקה', levels: Array.from({ length: 12 }, () => 'מדרגה בנושא') }));
  const key = Array.from({ length: 30 }, () => ({ prompt: 'חשבו: 3 - (-5)', answer: '8' }));
  const body = JSON.stringify({ grade: '8', pages: Array.from({ length: MAX_EXAM_PAGES }, () => ({ data: page, mediaType: 'image/jpeg' })), topics, key, prep: { crop: true, boxes: 4 } });
  assert.ok(Buffer.byteLength(body) <= AI_BODY_MAX.exam, `${Buffer.byteLength(body)} bytes`);
  const r = await post('exam', { body, headers: { ...cls.teacher, 'Content-Length': String(Buffer.byteLength(body)) } });
  assert.equal(r.status, 200);
  assert.equal(h.net.log.claude.length, 1);
  assert.equal(h.net.log.claude[0].messages[0].content.filter((b) => b.type === 'image').length, MAX_EXAM_PAGES);
  // a page over the limit is not a page the app makes
  const big = `data:image/jpeg;base64,${'A'.repeat(EXAM_PAGE_MAX + 10)}`;
  const over = await ai(h, 'exam', cls.teacher, { body: { grade: '7', pages: [{ data: big, mediaType: 'image/jpeg' }] } });
  assert.equal(over.status, 400);
  assert.equal((await over.json()).error, 'bad_input');
});

test('a photo kind for a paying family: the caller passes before the read, and the count is taken only after it', async () => {
  h = await setup({ AI_PAYWALL: 'on' });
  const token = await signIn(h, 'parent@example.test');
  assert.ok(token);
  const account = accountId(h.env, 'parent@example.test');
  insertSub(h.env, { kind: 'family', account_id: account });
  const dev = await linkDevice(h.env, account);
  const r = await ai(h, 'exam', dev.headers);
  assert.equal(r.status, 200);
  const taken = rows(h.env, 'SELECT who, day, count FROM ai_usage ORDER BY who, day').map((x) => ({ ...x }));
  assert.ok(taken.some((x) => x.who === `fam:${account}:exam` && x.count === 1), JSON.stringify(taken));
  // a body that cannot be read as JSON after the pre-check passed: 400, and nothing more counted
  const bad = await post('exam', { body: '{"pages": [', headers: dev.headers });
  assert.equal(bad.status, 400);
  assert.deepEqual(rows(h.env, 'SELECT who, day, count FROM ai_usage ORDER BY who, day').map((x) => ({ ...x })), taken);
});

test('distress beside a check\'s photo is read after the photo and still gets the care answer, with no photo sent and nothing counted', async () => {
  h = await setup({ AI_PAYWALL: 'off' });
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  const r = await ai(h, 'check', bearer(cls.students[0]), { body: { image: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg', question: 'אני רוצה למות' } });
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.care, true);
  assert.equal(out.readable, false, 'the check screens read it as a care result');
  assert.equal(out.summary, out.text);
  assert.equal(h.net.log.claude.length, 1);
  const sent = JSON.stringify(h.net.log.claude[0]);
  assert.ok(!sent.includes('/9j/4AAQ'), 'the photo never goes into a care request');
  assert.equal(countOf(h.env, `s:${cls.students[0].id}`), 0, 'not counted against a question');
  // with no AI reply possible (the care keys full), the fixed reply in the same shape
  h.env.DB.raw.prepare("UPDATE ai_usage SET count = 100000 WHERE who = 'care:all'").run();
  const fixed = await (await ai(h, 'check', bearer(cls.students[0]), { body: { image: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg', question: 'אני רוצה למות' } })).json();
  assert.deepEqual(fixed, { text: CARE_STATIC, care: true, readable: false, summary: CARE_STATIC });
});

test('distress in a chat with no AI key and no plan is still answered with care (the text kinds keep distress first)', async () => {
  h = await setup({ AI_PAYWALL: 'on', ANTHROPIC_API_KEY: '' });
  const r = await ai(h, 'chat', { 'X-Device': 'c'.repeat(32) }, { body: { messages: [{ role: 'user', content: 'אני רוצה למות' }] } });
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.care, true);
  assert.equal(out.text, CARE_STATIC);
  assert.equal(h.net.log.claude.length, 0);
  // the same with the shipped parent's OK required and no parent's OK given
  h.done();
  h = await setup({ AI_PAYWALL: 'off', AI_PARENT_OK: 'required' });
  const again = await ai(h, 'chat', { 'X-Device': 'd'.repeat(32) }, { body: { messages: [{ role: 'user', content: 'אני רוצה למות' }] } });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).care, true);
});

/** A stand-in for the Workers Rate Limiting binding: allows `n` per key, records every key it was asked about. */
function stubLimiter(n) {
  const seen = new Map();
  return { seen, async limit({ key }) { const c = (seen.get(key) || 0) + 1; seen.set(key, c); return { success: c <= n }; } };
}

test('RL_AI: 31 requests from one network, each with a random X-Device, reach 429 at the 31st (a made-up credential counts the network)', async () => {
  const RL_AI = stubLimiter(30);
  h = await setup({ RL_AI, AI_PAYWALL: 'on' });
  const codes = [];
  for (let i = 0; i < 31; i++) {
    const s = examStream(0);
    codes.push((await post('exam', { body: s.stream, ip: '198.51.100.20', headers: { 'X-Device': randomBytes(16).toString('hex') } })).status);
  }
  assert.ok(codes.slice(0, 30).every((c) => c !== 429), codes.join(','));
  assert.equal(codes[30], 429);
  assert.deepEqual([...RL_AI.seen.keys()].length, 1, 'one key: the network');
  assert.match([...RL_AI.seen.keys()][0], /^n:[0-9a-f]{16}$/);
  // the same with made-up family-device and student tokens
  for (const headers of [{ 'X-Family-Device': `fd1.${'0'.repeat(64)}` }, { Authorization: `Bearer ${'e'.repeat(48)}` }, { 'X-Device': `dv1.${'1'.repeat(32)}.${'2'.repeat(32)}` }]) {
    const r = await ai(h, 'explain', headers, { ip: '198.51.100.20' });
    assert.equal(r.status, 429, JSON.stringify(headers));
  }
  // another network is not affected
  assert.notEqual((await ai(h, 'explain', { 'X-Device': randomBytes(16).toString('hex') }, { ip: '203.0.113.77' })).status, 429);
});

test('RL_AI: checked credentials are counted apart: two class students, a linked family device, a teacher and a minted device on one network', async () => {
  const RL_AI = stubLimiter(1);
  h = await setup({ RL_AI, AI_PAYWALL: 'off', DEVICE_SECRET: 'test-device-secret-0123456789' });
  const cls = await makeClass(h, { studentAi: true, students: ['נועה', 'איתי'] });
  const account = 'acct-edge-test';
  h.env.DB.raw.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?, ?, ?)').run(account, 'edge@example.test', new Date().toISOString());
  const fam = await linkDevice(h.env, account);
  const { hmacHex } = await import('../src/util.js');
  const id = '3'.repeat(32);
  const minted = `dv1.${id}.${(await hmacHex('test-device-secret-0123456789', `device:${id}`)).slice(0, 32)}`;
  const callers = [bearer(cls.students[0]), bearer(cls.students[1]), fam.headers, cls.teacher, { 'X-Device': minted }];
  const ip = '192.0.2.10';
  for (const c of callers) assert.notEqual((await ai(h, 'explain', c, { ip })).status, 429, JSON.stringify(Object.keys(c)));
  // each has its own key, none of them the network's, and none holds the credential itself
  const keys = [...RL_AI.seen.keys()];
  assert.equal(keys.length, callers.length);
  for (const k of keys) { assert.match(k, /^c:[0-9a-f]{32}$/); assert.ok(!k.includes(cls.students[0].token.slice(0, 12))); }
  // a second request from the first student is over its own limit; a request with no credential uses the network's
  assert.equal((await ai(h, 'explain', bearer(cls.students[0]), { ip })).status, 429);
  assert.notEqual((await ai(h, 'explain', {}, { ip })).status, 429);
  assert.equal([...RL_AI.seen.keys()].filter((k) => k.startsWith('n:')).length, 1);
});
