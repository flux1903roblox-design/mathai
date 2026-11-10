// Moderation in and out (trust spec TRUST-4 §4.1-4.3): personal details never reach the AI, every reply is screened
// before a child sees it, and the safety log keeps counts only. Claude is stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED_TEXT } from '../../shared/safety.js';
import { setup, ai, rows, countOf, devOf, claudeReply, claudeMessage, DEVICE } from './helpers.js';

let h;
afterEach(() => h?.done());

const events = () => rows(h.env, 'SELECT * FROM safety_events ORDER BY id').map((r) => ({ ...r }));
const free = async () => countOf(h.env, `free:d:${await devOf(h.env)}`);
const chat = (content, extra = {}) => ({ messages: [{ role: 'user', content }], context: { question: '3x + 5 = 11' }, ...extra });
/** A streamed Claude reply cut into these text pieces. */
function sse(params, pieces, { stop = 'end_turn' } = {}) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const m = claudeMessage(params, { text: '' });
  return new Response([
    ev('message_start', { message: { ...m, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ...pieces.map((text) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 20 } }),
    ev('message_stop', {}),
  ].join(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

test('a phone, an email and an ID a child types never reach Claude; the log counts each kind once, with no digits', async () => {
  h = await setup();
  const said = 'תתקשרו אליי 052-1234567 או noa@example.test, ת״ז 123456782. איך פותרים?';
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(said) });
  assert.equal(r.status, 200);
  const sent = JSON.stringify(h.net.log.claude.at(-1));
  assert.ok(sent.includes('[טלפון]') && sent.includes('[מייל]') && sent.includes('[ת״ז]'));
  for (const raw of ['052-1234567', '1234567', 'noa@example.test', '123456782']) assert.ok(!sent.includes(raw), raw);
  await h.ctx.flush();
  const ev = events();
  assert.deepEqual(ev.map((e) => [e.kind, e.category, e.surface, e.source, e.tier]),
    [['pii_masked', 'email', 'chat', 'regex', 'free'], ['pii_masked', 'phone', 'chat', 'regex', 'free'], ['pii_masked', 'id', 'chat', 'regex', 'free']]);
  for (const e of ev) for (const [col, v] of Object.entries(e)) if (col !== 'id' && col !== 'day') assert.doesNotMatch(String(v), /\d/, `${col} holds no digits`);
  // a typed answer in explain is masked and counted too; the earlier messages of a chat are masked but not counted again
  await ai(h, 'explain', { 'X-Device': DEVICE }, { body: { question: '3 - 8', correct: '-5', studentAnswer: '0521234567' } });
  assert.ok(JSON.stringify(h.net.log.claude.at(-1)).includes("Student's answer: [טלפון]"));
  await h.ctx.flush();
  assert.equal(events().filter((e) => e.surface === 'explain' && e.category === 'phone').length, 1);
});

test('a reply with a blocklist word is never shown: 200 with the calm sentence, blocked: true, and the question given back', async () => {
  h = await setup({}, { claude: (p) => claudeReply(p, { text: 'זה סקס, לא מתמטיקה.' }) });
  const r = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: BLOCKED_TEXT, blocked: true });
  assert.equal(await free(), 0, 'the question is back');
  assert.equal(r.headers.get('X-AI-Left'), '2', 'and the count on screen says so');
  await h.ctx.flush();
  assert.deepEqual(events().map((e) => [e.kind, e.surface, e.source, e.tier]), [['output_blocked', 'explain', 'server', 'free']]);
});

test('a streamed reply is stopped at a blocklist word: no piece of it goes out, the stream ends with [[blocked]]', async () => {
  // the word arrives split across two pieces, and the text before it is sent
  h = await setup({}, { claude: (p) => sse(p, ['נסו לחסר שלוש ', 'משני האגפים. זה ממש פו', 'רנו וזה לא ', 'בסדר בכלל.']) });
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('מה עושים?', { stream: true }) });
  const text = await r.text();
  await h.ctx.flush();
  assert.ok(text.endsWith('\n[[blocked]]'), text);
  assert.ok(!text.includes('פו'), 'not even the start of the word');
  assert.ok(text.startsWith('נסו לחסר שלוש משני האגפים.'), text);
  assert.equal(await free(), 0, 'the question is back');
  assert.deepEqual(events().map((e) => e.kind), ['output_blocked']);
});

test('a streamed reply whose last word is blocked, and one with no blocked word, short or long', async () => {
  h = await setup({}, { claude: (p) => sse(p, ['כל הכבוד, ', 'fuck']) });
  let text = await (await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('שאלה', { stream: true }) })).text();
  assert.equal(text, 'כל הכבוד, \n[[blocked]]');
  h.done();
  const long = 'נסו לחסר $3$ משני האגפים, ואז לחלק ב־$2$. '.repeat(60);
  h = await setup({}, { claude: (p) => sse(p, long.match(/.{1,7}/gs)) });
  text = await (await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('שאלה', { stream: true }) })).text();
  assert.equal(text, long, 'a clean reply arrives whole, word by word');
  h.done();
  h = await setup({}, { claude: (p) => sse(p, ['זינוק', ' של sextant מכפלה']) });
  text = await (await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('שאלה', { stream: true }) })).text();
  assert.equal(text, 'זינוק של sextant מכפלה');
});

test('a care reply is never blocklisted, streamed or not; its links are still screened', async () => {
  const words = 'מה שקרה, אונס או כל פגיעה, אף פעם לא באשמתכם. [עוד](https://evil.example) ער״ן: [וואטסאפ](https://wa.me/972528451201)';
  h = await setup({}, { claude: (p) => claudeReply(p, { text: `[[care]]\n${words}` }) });
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('מישהו נגע בי') });
  const body = await r.json();
  assert.equal(body.care, true);
  assert.ok(body.text.includes('אונס'));
  assert.ok(!body.text.includes('evil.example') && body.text.includes('עוד'));
  assert.ok(body.text.includes('https://wa.me/972528451201'));
  await h.ctx.flush();
  assert.deepEqual(events().map((e) => e.kind).sort(), ['distress', 'link_removed']);
  h.done();
  h = await setup({}, { claude: (p) => sse(p, ['[[care]]\nמה שקרה, ', 'אונס או כל פגיעה, ', 'לא באשמתכם.']) });
  const text = await (await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('מישהו נגע בי', { stream: true }) })).text();
  assert.equal(text, 'מה שקרה, אונס או כל פגיעה, לא באשמתכם.\n[[care]]');
});

test('links in an ordinary reply keep only their text; the owner sees a count, never the address', async () => {
  h = await setup({}, { claude: (p) => claudeReply(p, { text: 'פתרון מלא [כאן](https://evil.example/answers) ובאתר https://gov.il.evil.example/x.' }) });
  const r = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.deepEqual(await r.json(), { text: 'פתרון מלא כאן ובאתר .' });
  await h.ctx.flush();
  assert.deepEqual(events().map((e) => [e.kind, e.category]), [['link_removed', '']]);
  assert.ok(!JSON.stringify(events()).includes('evil'));
});

test('a structured reply is screened string by string: a blocked word anywhere is 502 bad_output, and the question is back', async () => {
  const check = { readable: true, transcript: 'x = 3', steps: [{ text: 'x = 3', ok: true, comment: '' }], final: 'correct', summary: 'יופי. [עוד](https://evil.example)' };
  h = await setup({ AI_PAYWALL: 'off' }, { claude: (p) => claudeReply(p, { text: JSON.stringify(check) }) });
  let r = await ai(h, 'check', { 'X-Device': DEVICE });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).summary, 'יופי. עוד');
  h.done();
  const bad = { ...check, steps: [{ text: 'x = 3', ok: false, comment: 'what the fuck' }] };
  h = await setup({}, { claude: (p) => claudeReply(p, { text: JSON.stringify(bad) }) });
  const { makeClass, insertSub, bearer, one } = await import('./helpers.js');
  const cls = await makeClass(h, { students: ['נועה'] });
  insertSub(h.env, { kind: 'class', class_code: cls.code });
  r = await ai(h, 'check', bearer(cls.students[0]));
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error, 'bad_output');
  const id = one(h.env, 'SELECT id FROM students WHERE class_code = ?', cls.code).id;
  assert.equal(countOf(h.env, `s:${id}:check`), 0, 'the question is back');
  await h.ctx.flush();
  assert.deepEqual(events().map((e) => [e.kind, e.surface]), [['output_blocked', 'check']]);
});

test('a refusal is counted with no text, streamed or not', async () => {
  h = await setup({}, { claude: (p) => claudeReply(p, { text: '', stop: 'refusal' }) });
  assert.equal((await ai(h, 'explain', { 'X-Device': DEVICE })).status, 422);
  await h.ctx.flush();
  assert.deepEqual(events().map((e) => [e.kind, e.surface, e.source]), [['refusal', 'explain', 'server']]);
  h.done();
  h = await setup({}, { claude: (p) => sse(p, ['לא'], { stop: 'refusal' }) });
  const text = await (await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('שאלה', { stream: true }) })).text();
  assert.ok(text.endsWith('[[refusal]]'));
  await h.ctx.flush();
  assert.deepEqual(events().map((e) => [e.kind, e.surface, e.category]), [['refusal', 'chat', '']]);
});
