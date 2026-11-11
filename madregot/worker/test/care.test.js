// The care path (trust spec TRUST-3 §3.3-3.4, §3.6): a chat message that reads as distress is answered warmly, is never
// counted against a question, never refused and never paywalled, and cannot be used as a free maths channel. Claude is
// stubbed; every address is synthetic. A class whose tutor is off (TRUST-11), and a child alone with no parent's OK
// (TRUST-9), get the fixed reply with no AI call.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CARE_NOTE } from '../../shared/ai.js';
import { safetyPrompt, CARE_STATIC, SUPPORT } from '../../shared/safety.js';
import { dailySummary, supportCheckLine, SUPPORT_CHECK_DAYS } from '../src/cron.js';
import { flushNotices } from '../src/email.js';
import { dayOf } from '../src/util.js';
import {
  setup, ai, makeClass, bearer, signIn, accountId, insertSub, linkDevice, setCount, countOf, rows, one, claudeReply, claudeDown,
  claudeMessage, devOf, netOf, systemText, DEVICE, FEEDBACK_INPUT, FEEDBACK_REPLY,
} from './helpers.js';

let h;
afterEach(() => h?.done());

const SAD = 'אני רוצה למות';
const chat = (content, extra = {}) => ({ messages: [{ role: 'user', content }], context: { question: '3x + 5 = 11', correct: '2' }, ...extra });
const events = () => rows(h.env, 'SELECT kind, category, surface, source, tier FROM safety_events ORDER BY id').map((r) => ({ ...r }));
/** A streamed Claude reply cut into several text pieces, the way a real stream arrives. */
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

test('a free device with no questions left writes "אני רוצה למות": a care reply, nothing counted, a care-only request', async () => {
  h = await setup({}, { claude: (p) => claudeReply(p, { text: '[[care]]\nתודה שכתבתם. ער״ן 1201.' }) });
  const dev = await devOf(h.env);
  await setCount(h.env, `free:d:${dev}`, 2);
  await setCount(h.env, `free:d:${dev}:tries`, 2);
  const before = rows(h.env, "SELECT who, count FROM ai_usage WHERE who LIKE 'free:%' ORDER BY who");
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: 'תודה שכתבתם. ער״ן 1201.', care: true });
  assert.equal(r.headers.get('X-AI-Tier'), null, 'a care reply says nothing about the person\'s questions');
  assert.equal(r.headers.get('X-AI-Left'), null);
  await h.ctx.flush();
  assert.deepEqual(rows(h.env, "SELECT who, count FROM ai_usage WHERE who LIKE 'free:%' ORDER BY who"), before, 'no free: counter moved');
  assert.equal(countOf(h.env, `care:d:${dev}`), 1);
  assert.equal(countOf(h.env, `care:n:${await netOf(h.env)}`), 1);
  assert.equal(countOf(h.env, 'care:all'), 1);
  assert.equal(rows(h.env, `SELECT * FROM ai_usage WHERE who LIKE '%${DEVICE}%'`).length, 0, 'the raw device id is never a key');
  // the request Claude got: the safety block and the no-maths line, the student's words, and nothing of the exercise
  const sent = h.net.log.claude.at(-1);
  assert.equal(systemText(sent), `${safetyPrompt()}\n\n${CARE_NOTE}`);
  assert.ok(!systemText(sent).includes('Task:'), 'no maths task');
  assert.equal(sent.max_tokens, 700);
  assert.equal(sent.output_config.effort, 'low');
  assert.equal(sent.model, h.env.CLAUDE_MODEL);
  assert.deepEqual(sent.messages, [{ role: 'user', content: SAD }]);
  assert.ok(!JSON.stringify(sent).includes('3x + 5 = 11'), 'the exercise on screen is not sent');
  // booked under the care pool; a distress event with no text
  assert.equal(one(h.env, "SELECT calls FROM ai_spend WHERE pool = 'care' AND period = ?", dayOf())?.calls, 1);
  assert.deepEqual(events(), [{ kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'care' }]);
});

test('a family device that used its whole day still gets a care reply, on care:fd:<device>, never paywalled', async () => {
  h = await setup();
  await signIn(h, 'fam@example.test');
  const a = accountId(h.env, 'fam@example.test');
  insertSub(h.env, { kind: 'family', account_id: a });
  const d = await linkDevice(h.env, a);
  await setCount(h.env, `fam:${a}:tutor`, 30);
  const r = await ai(h, 'chat', d.headers, { body: chat('אבא שלי מרביץ לי') });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).care, true);
  assert.equal(countOf(h.env, `care:fd:${d.id}`), 1);
  assert.equal(countOf(h.env, `fam:${a}:tutor`), 30);
  // and a device with no plan at all, asking a kind it may never use, is still not refused
  const anon = await ai(h, 'chat', { 'X-Device': 'b'.repeat(32) }, { body: chat('אין לי עם מי לדבר') });
  assert.equal(anon.status, 200);
});

test('the 6th care message from one device in a day gets the fixed reply, with no Claude call', async () => {
  h = await setup();
  const dev = await devOf(h.env);
  for (let i = 0; i < 5; i++) assert.equal((await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) })).status, 200);
  const calls = h.net.log.claude.length;
  assert.equal(calls, 5);
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.text, CARE_STATIC);
  assert.equal(b.care, true);
  assert.equal(h.net.log.claude.length, calls, 'no Claude call');
  assert.equal(countOf(h.env, `care:d:${dev}`), 5);
  await h.ctx.flush();
  assert.equal(events().at(-1).tier, 'static');
  assert.equal(events().length, 6, 'every distress message is logged, with no text');
  // streamed: the same text in one piece, then the care marker
  const s = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD, { stream: true }) });
  assert.equal(s.status, 200);
  assert.equal(await s.text(), `${CARE_STATIC}\n[[care]]`);
  assert.equal(h.net.log.claude.length, calls);
});

test('the network cap (30) and the global cap (1,000) also lead to the fixed reply', async () => {
  h = await setup();
  await setCount(h.env, `care:n:${await netOf(h.env)}`, 30);
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal((await r.json()).text, CARE_STATIC);
  const other = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD), ip: '198.51.100.9' });
  assert.notEqual((await other.json()).text, CARE_STATIC, 'another network is served');
  await setCount(h.env, 'care:all', 1000);
  const all = await ai(h, 'chat', { 'X-Device': 'c'.repeat(32) }, { body: chat(SAD), ip: '198.51.100.10' });
  assert.equal((await all.json()).text, CARE_STATIC);
  assert.equal(h.net.log.claude.length, 1);
  // the owner can move the caps with AI_LIMITS
  h.done();
  h = await setup({ AI_LIMITS: JSON.stringify({ care: { person: 1 } }) });
  await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal((await (await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) })).json()).text, CARE_STATIC);
});

test('with no Claude key on the server, a distress chat gets the fixed reply (not 503); any other chat is 503', async () => {
  h = await setup({ ANTHROPIC_API_KEY: '' });
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: CARE_STATIC, care: true });
  const s = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD, { stream: true }) });
  assert.equal(await s.text(), `${CARE_STATIC}\n[[care]]`);
  const plain = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('מה זה שבר?') });
  assert.equal(plain.status, 503);
  assert.equal((await plain.json()).error, 'ai_not_configured');
  assert.equal(h.net.log.claude.length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage').length, 0, 'nothing counted');
  await h.ctx.flush();
  assert.equal(events().length, 2);
});

test('a caller that cannot be read (a wrong teacher key, no hashing secret) still gets the fixed reply, never an error', async () => {
  h = await setup();
  const r = await ai(h, 'chat', { 'X-Class-Code': 'ZZZ999', 'X-Teacher-Key': 'wrong' }, { body: chat(SAD) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).text, CARE_STATIC);
  h.done();
  h = await setup({ IP_HASH_SECRET: '' });
  const n = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal(n.status, 200);
  assert.equal((await n.json()).text, CARE_STATIC);
  assert.equal(h.net.log.claude.length, 0);
});

test('a care request that fails or is declined still answers with the fixed reply, never an error', async () => {
  let mode = 'down';
  h = await setup({}, { claude: (p) => (mode === 'down' ? claudeDown(500) : claudeReply(p, { stop: 'refusal', text: '' })) });
  const down = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal(down.status, 200);
  assert.deepEqual(await down.json(), { text: CARE_STATIC, care: true });
  mode = 'refuse';
  const refused = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal(refused.status, 200);
  assert.equal((await refused.json()).text, CARE_STATIC);
  const streamed = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD, { stream: true }) });
  const text = await streamed.text();
  assert.equal(text, `${CARE_STATIC}\n[[care]]`);
  assert.ok(!text.includes('[[refusal]]') && !text.includes('[[error'));
  mode = 'down';
  const broken = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD, { stream: true }) });
  assert.equal(await broken.text(), `${CARE_STATIC}\n[[care]]`);
});

test('only the last student message is checked: an earlier one does not turn a maths question into a care request', async () => {
  h = await setup();
  const body = { messages: [{ role: 'user', content: SAD }, { role: 'assistant', content: 'תודה שכתבתם.' }, { role: 'user', content: 'מה זה שבר?' }] };
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body });
  assert.equal(r.headers.get('X-AI-Tier'), 'free');
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 1, 'counted as usual');
  // a distress phrase in front of a maths question goes the care way: the system prompt forbids maths in that reply
  await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(`${SAD}. תפתרו לי 3x + 5 = 11`) });
  assert.ok(systemText(h.net.log.claude.at(-1)).endsWith(CARE_NOTE));
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 1);
});

test('a challenge explanation sent for feedback that reads as distress takes the care path: no rubric check, nothing counted (AI-10)', async () => {
  h = await setup({}, { claude: (p) => claudeReply(p, { text: '[[care]]\nתודה שכתבתם. ער״ן 1201.' }) });
  const dev = await devOf(h.env);
  await setCount(h.env, `free:d:${dev}`, 2); // the free taste is used up today: a distressed child is still answered
  const r = await ai(h, 'feedback', { 'X-Device': DEVICE }, { body: { ...FEEDBACK_INPUT, text: `${SAD}. ציירתי מלבן.` } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: 'תודה שכתבתם. ער״ן 1201.', care: true });
  assert.equal(r.headers.get('X-AI-Tier'), null);
  assert.equal(countOf(h.env, `free:d:${dev}`), 2, 'nothing counted');
  assert.equal(countOf(h.env, `care:d:${dev}`), 1);
  // the care-only request: the safety block and the no-maths line, the child's words, nothing of the task or the rubric
  const sent = h.net.log.claude.at(-1);
  assert.equal(systemText(sent), `${safetyPrompt()}\n\n${CARE_NOTE}`);
  assert.equal(sent.output_config.format, undefined, 'no rubric schema');
  assert.ok(sent.messages[0].content.includes(SAD));
  assert.ok(!JSON.stringify(sent).includes(FEEDBACK_INPUT.rubric[0]) && !JSON.stringify(sent).includes('Model answer'));
  await h.ctx.flush();
  assert.deepEqual(events(), [{ kind: 'distress', category: 'self_harm', surface: 'feedback', source: 'regex', tier: 'care' }]);
  // with no Claude key on the server, the fixed reply, never 503
  h.done();
  h = await setup({ ANTHROPIC_API_KEY: '' });
  const fixed = await ai(h, 'feedback', { 'X-Device': DEVICE }, { body: { ...FEEDBACK_INPUT, text: SAD } });
  assert.equal(fixed.status, 200);
  assert.deepEqual(await fixed.json(), { text: CARE_STATIC, care: true });
  assert.equal((await ai(h, 'feedback', { 'X-Device': DEVICE })).status, 503, 'any other explanation is 503 ai_not_configured');
});

test('feedback whose reply the model marked care gives the question back and keeps the help lines whole', async () => {
  const help = 'תודה שכתבתם. מה שאתם מרגישים חשוב, וזה לא באשמתכם. ספרו היום למבוגר שאתם סומכים עליו: הורה, היועצת או מורה. ער״ן: חיוג 1201 בכל שעה, בלי לומר שם. בסכנה מיידית: משטרה 100, מד״א 101.';
  h = await setup({}, { claude: (p) => claudeReply(p, { text: JSON.stringify({ ...FEEDBACK_REPLY, summary: help, care: true }) }) });
  const dev = await devOf(h.env);
  const r = await ai(h, 'feedback', { 'X-Device': DEVICE }, { body: { ...FEEDBACK_INPUT, text: 'אף אחד לא שם לב אליי. ציירתי מלבן.' } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.care, true); assert.equal(body.summary, help, 'never clipped');
  assert.equal(r.headers.get('X-AI-Left'), '2');
  assert.equal(countOf(h.env, `free:d:${dev}`), 0, 'given back');
  await h.ctx.flush();
  assert.deepEqual(events(), [{ kind: 'distress', category: '', surface: 'feedback', source: 'model', tier: 'free' }]);
});

test('a normal chat whose reply the model marked [[care]] gives the question back', async () => {
  h = await setup({}, { claude: (p) => claudeReply(p, { text: '[[care]]\nאני כאן. ער״ן 1201.' }) });
  const dev = await devOf(h.env);
  await setCount(h.env, `free:d:${dev}`, 1);
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('לא בא לי כלום היום') });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: 'אני כאן. ער״ן 1201.', care: true });
  assert.equal(r.headers.get('X-AI-Tier'), 'free');
  assert.equal(r.headers.get('X-AI-Left'), '1', 'the screen shows the question as not used');
  assert.equal(countOf(h.env, `free:d:${dev}`), 1, 'back to what it was before the call');
  assert.equal(countOf(h.env, `free:d:${dev}:tries`), 1, 'the tries guard still counts, so this is no endless back door');
  await h.ctx.flush();
  assert.deepEqual(events(), [{ kind: 'distress', category: '', surface: 'chat', source: 'model', tier: 'free' }]);
  assert.equal(rows(h.env, "SELECT * FROM ai_spend WHERE pool = 'free'").length, 2, 'what Claude did is still priced');
});

test('a streamed chat whose model starts with [[care]] never begins with the marker and ends with \\n[[care]]', async () => {
  h = await setup({}, { claude: (p) => sse(p, ['[[ca', 're]]', '\nאני', ' כאן. ', 'ער״ן 1201.']) });
  const dev = await devOf(h.env);
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('לא בא לי כלום היום', { stream: true }) });
  const text = await r.text();
  assert.equal(text, 'אני כאן. ער״ן 1201.\n[[care]]');
  await h.ctx.flush();
  assert.equal(countOf(h.env, `free:d:${dev}`), 0, 'the question is given back');
  assert.equal(events().at(-1).source, 'model');
});

test('a streamed reply that does not start with the marker is passed on whole, short or long', async () => {
  h = await setup({}, { claude: (p) => sse(p, ['נ', 'סו ', 'לחסר ', '3 משני ', 'האגפים.']) });
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('איך מתחילים?', { stream: true }) });
  assert.equal(await r.text(), 'נסו לחסר 3 משני האגפים.');
  h.done();
  h = await setup({}, { claude: (p) => sse(p, ['כן']) });
  const short = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('נכון?', { stream: true }) });
  assert.equal(await short.text(), 'כן', 'a reply shorter than the hold-back is still sent');
  await h.ctx.flush();
  assert.equal(countOf(h.env, `free:d:${await devOf(h.env)}`), 1, 'counted as usual');
});

test('a streamed care request ends with the care marker even when the model did not write it', async () => {
  h = await setup({}, { claude: (p) => sse(p, ['תודה ', 'שכתבתם.']) });
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('כל יום צוחקים עליי', { stream: true }) });
  assert.equal(await r.text(), 'תודה שכתבתם.\n[[care]]');
  await h.ctx.flush();
  assert.equal(events()[0].category, 'bullying');
});

test('a photo check the model marked care gives the question back; a class student\'s care keys are per student', async () => {
  h = await setup({}, {
    claude: (p) => claudeReply(p, { text: JSON.stringify({ readable: true, transcript: '', steps: [], final: 'unknown', summary: 'אני כאן.', care: true }) }),
  });
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  insertSub(h.env, { kind: 'class', class_code: cls.code });
  const st = cls.students[0];
  const r = await ai(h, 'check', bearer(st));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).care, true);
  const id = one(h.env, 'SELECT id FROM students WHERE class_code = ?', cls.code).id;
  assert.equal(countOf(h.env, `s:${id}:check`), 0, 'given back');
  assert.equal(countOf(h.env, `s:${id}:check:tries`), 1);
  await h.ctx.flush();
  assert.deepEqual(events(), [{ kind: 'distress', category: '', surface: 'check', source: 'model', tier: 'class' }]);
  await ai(h, 'chat', bearer(st), { body: chat('אני שונאת את עצמי') });
  assert.equal(countOf(h.env, `care:s:${id}`), 1);
});

test('with the paywall off, a distress chat takes the care path and the open counter does not move', async () => {
  h = await setup({ AI_PAYWALL: 'off' });
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  const id = one(h.env, 'SELECT id FROM students WHERE class_code = ?', cls.code).id;
  const r = await ai(h, 'chat', bearer(cls.students[0]), { body: chat(SAD) });
  assert.equal((await r.json()).care, true);
  assert.equal(countOf(h.env, `s:${id}`), 0);
  assert.equal(countOf(h.env, `care:s:${id}`), 1);
});

test('a class whose tutor is off (a school class before the catalogue approval): the fixed reply, no AI call, a distress event', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = one(h.env, 'SELECT id FROM students WHERE class_code = ?', cls.code).id;
  // a maths question is refused calmly...
  const maths = await ai(h, 'chat', bearer(cls.students[0]));
  assert.equal(maths.status, 403); assert.equal((await maths.json()).error, 'class_ai_off');
  // ...a message that reads as distress is never refused: the fixed reply, as JSON and as a stream
  const r = await ai(h, 'chat', bearer(cls.students[0]), { body: chat(SAD) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: CARE_STATIC, care: true });
  const s = await ai(h, 'chat', bearer(cls.students[0]), { body: chat(SAD, { stream: true }) });
  assert.equal(await s.text(), `${CARE_STATIC}\n[[care]]`);
  assert.equal(h.net.log.claude.length, 0, 'no AI call');
  assert.equal(countOf(h.env, `care:s:${id}`), 0, 'no care key: the reply is the fixed one');
  await h.ctx.flush();
  assert.deepEqual(events(), [
    { kind: 'class_ai_off', category: '', surface: 'chat', source: 'server', tier: '' },
    { kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'static' },
    { kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'static' },
  ]);
});

test('with the parent\'s OK required: a child alone gets the fixed reply, no AI call; a device a parent approved for free gets a care reply', async () => {
  h = await setup({ AI_PARENT_OK: 'required' });
  // no parent's OK: a maths question is refused calmly, a message that reads as distress gets the fixed reply at once
  const maths = await ai(h, 'chat', { 'X-Device': DEVICE });
  assert.equal(maths.status, 403); assert.equal((await maths.json()).error, 'parent_ok_needed');
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: CARE_STATIC, care: true });
  const s = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(SAD, { stream: true }) });
  assert.equal(await s.text(), `${CARE_STATIC}\n[[care]]`);
  assert.equal(h.net.log.claude.length, 0, 'what the child wrote is not sent to the AI company');
  assert.equal(countOf(h.env, `care:d:${await devOf(h.env)}`), 0, 'no care key: the reply is the fixed one');
  // a parent approved this device for free (purpose 'consent'): it has used both free questions today, and still gets
  // a care reply, on care:fd:<device>, with no free counter moved
  const email = 'ok@example.test';
  const token = await signIn(h, email);
  const t = await h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': token, 'X-Device': DEVICE }, body: { purpose: 'consent', consent: true } });
  assert.equal(t.status, 200);
  const fd = { 'X-Family-Device': (await t.json()).deviceToken, 'X-Device': DEVICE };
  const dev = one(h.env, 'SELECT id FROM family_devices WHERE account_id = ?', accountId(h.env, email)).id;
  await setCount(h.env, `free:fd:${dev}`, 2); await setCount(h.env, `free:fd:${dev}:tries`, 2);
  const c = await ai(h, 'chat', fd, { body: chat(SAD) });
  assert.equal(c.status, 200);
  assert.equal((await c.json()).care, true);
  assert.equal(h.net.log.claude.length, 1);
  assert.equal(countOf(h.env, `care:fd:${dev}`), 1);
  assert.equal(countOf(h.env, `free:fd:${dev}`), 2, 'no question used');
  await h.ctx.flush();
  assert.deepEqual(events(), [
    { kind: 'parent_ok_needed', category: '', surface: 'chat', source: 'server', tier: '' },
    { kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'static' },
    { kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'static' },
    { kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'care' },
  ]);
});

test('the owner\'s summary shows the care pool, and reminds to check the support numbers once they are 330 days old', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const now = new Date();
  const yesterday = dayOf(new Date(now.getTime() - 864e5));
  h.env.DB.raw.prepare("INSERT INTO ai_spend (pool, period, calls, nano_usd) VALUES ('care', ?, 7, 12e7)").run(yesterday);
  await dailySummary(h.env, now);
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${yesterday}`).params);
  assert.equal(p.careCalls, 7);
  assert.equal(p.careUsd, 0.12);
  await flushNotices(h.env);
  assert.match(h.net.log.email.at(-1).text, /תשובות תמיכה \(care\): 7 · \$0\.12/);
  // the reminder
  const checked = Date.parse(`${SUPPORT.checked}T00:00:00Z`);
  assert.equal(SUPPORT_CHECK_DAYS, 330);
  assert.equal(supportCheckLine(new Date(checked + 330 * 864e5)), null);
  const line = supportCheckLine(new Date(checked + 331 * 864e5));
  assert.equal(line, `מספרי העזרה בעוזר החכם נבדקו לאחרונה ב־${SUPPORT.checked}. כדאי לבדוק שהם עדיין נכונים (shared/safety.js).`);
  const late = new Date(checked + 400 * 864e5);
  await dailySummary(h.env, late);
  const lateDay = dayOf(new Date(late.getTime() - 864e5));
  const lp = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${lateDay}`).params);
  assert.ok(lp.violations.includes(line));
});

// ---------------------------------------------------------------- the teacher, chosen by the child (§3.5)
const helpOf = async (cls) => (await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json()).help;

test('a help note that reads as distress is checked again on the server and marks the request care = 1 for the teacher', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  // the device's own check is never trusted: the server reads the note itself
  let r = await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'signed', level: 1, question: '3 - 8', answer: '5', note: 'אבא שלי מרביץ לי', care: false } });
  assert.deepEqual(await r.json(), { ok: true });
  r = await h.call('POST', '/api/help', { headers: bearer(itai), body: { topic: 'signed', level: 1, question: '3 - 8', answer: '5', note: 'לא הבנתי את הסימן', care: true } });
  assert.deepEqual(await r.json(), { ok: true });
  await h.ctx.flush();
  const help = await helpOf(cls);
  const byName = Object.fromEntries(help.map((x) => [x.name, x]));
  assert.equal(byName['נועה'].care, 1); assert.equal(byName['נועה'].kind, 'help');
  assert.equal(byName['נועה'].note, 'אבא שלי מרביץ לי', 'the note the child chose to send reaches the teacher');
  assert.equal(byName['איתי'].care, 0, 'a client flag alone marks nothing'); assert.equal(byName['איתי'].kind, 'help');
  assert.equal(rows(h.env, 'SELECT * FROM help_meta').length, 1, 'a plain request needs no help_meta row');
  // the safety log keeps a count only: no note, no student
  assert.deepEqual(events(), [{ kind: 'distress', category: 'abuse', surface: 'help_note', source: 'regex', tier: '' }]);
  // the same exercise asked again with a distress note: still one request, now marked
  await h.call('POST', '/api/help', { headers: bearer(itai), body: { topic: 'signed', level: 1, question: '3 - 8', answer: '5', note: 'אני כל הזמן בוכה' } });
  const again = (await helpOf(cls)).filter((x) => x.name === 'איתי');
  assert.equal(again.length, 1); assert.equal(again[0].care, 1); assert.equal(again[0].note, 'אני כל הזמן בוכה');
  // and a calmer note on that request later does not unmark it
  await h.call('POST', '/api/help', { headers: bearer(itai), body: { topic: 'signed', level: 1, question: '3 - 8', answer: '5', note: 'עכשיו הבנתי חלק' } });
  assert.equal((await helpOf(cls)).find((x) => x.name === 'איתי').care, 1);
});

test('a distress note always reaches the teacher, even past the 10 open requests a student may have', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  for (let i = 0; i < 10; i++) await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'signed', question: `שאלה ${i}`, answer: '1' } });
  assert.equal((await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'signed', question: 'עוד שאלה', answer: '1' } })).status, 429);
  const r = await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'signed', question: 'עוד שאלה', answer: '1', note: 'אני רוצה למות' } });
  assert.equal(r.status, 200);
  assert.equal((await helpOf(cls)).filter((x) => x.care === 1).length, 1);
});

test('"ask the teacher to talk with me": an empty question and note, kind talk, one open at a time, nothing of the chat sent', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  // a student with 10 open requests may still ask for a talk
  for (let i = 0; i < 10; i++) await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'signed', question: `שאלה ${i}`, answer: '1' } });
  let r = await h.call('POST', '/api/help', { headers: bearer(noa), body: { kind: 'talk', note: 'מה שכתבתי לעוזר', question: 'x' } });
  assert.deepEqual(await r.json(), { ok: true });
  const id = one(h.env, 'SELECT id FROM students WHERE class_code = ?', cls.code).id;
  const talk = one(h.env, "SELECT h.question, h.note, h.answer, h.topic, h.image, m.kind, m.care FROM help_requests h JOIN help_meta m ON m.help_id = h.id WHERE h.student_id = ? AND m.kind = 'talk'", id);
  assert.deepEqual({ ...talk }, { question: '', note: '', answer: '', topic: '', image: null, kind: 'talk', care: 0 }, 'no text is stored, whatever the body says');
  // asked again while it is open: still one
  r = await h.call('POST', '/api/help', { headers: bearer(noa), body: { kind: 'talk' } });
  assert.deepEqual(await r.json(), { ok: true, again: true });
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM help_meta WHERE kind = 'talk'").n, 1);
  // the dashboard says what kind each request is
  const help = await helpOf(cls);
  assert.equal(help.length, 11);
  assert.ok(help.every((x) => 'kind' in x && 'care' in x));
  assert.deepEqual(help.filter((x) => x.kind === 'talk').map((x) => [x.name, x.question, x.care]), [['נועה', '', 0]]);
  // a plain request with an empty question is never merged into the talk request
  await h.call('POST', '/api/help', { headers: bearer(noa), body: { kind: 'help', question: '' } }).catch(() => {});
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM help_meta WHERE kind = 'talk'").n, 1);
  // a talk request needs a class student
  assert.equal((await h.call('POST', '/api/help', { body: { kind: 'talk' } })).status, 401);
});

test('removing a student removes the help_meta rows of their requests too', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  await h.call('POST', '/api/help', { headers: bearer(noa), body: { kind: 'talk' } });
  await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'signed', question: '3 - 8', answer: '5', note: 'מאיימים עליי' } });
  await h.call('POST', '/api/help', { headers: bearer(itai), body: { kind: 'talk' } });
  assert.equal(rows(h.env, 'SELECT * FROM help_meta').length, 3);
  const r = await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} });
  assert.equal(r.status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM help_meta').length, 1, 'only איתי\'s talk request is left');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM help_meta WHERE help_id NOT IN (SELECT id FROM help_requests)').n, 0, 'no orphans');
});
