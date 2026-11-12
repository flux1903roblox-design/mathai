// The optional second reader and the adult's alert (COUNCIL2-9). MODERATION = "on" adds a short classification call on
// the free text (a child's message, and the tutor's reply on chat, explain and feedback); SAFETY_ALERTS = "on" tells a
// linked parent or the class teacher, with no text, at most once a day. Both are off by default and fail open. Claude
// and the email service are stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED_TEXT } from '../../shared/safety.js';
import { detectDistress } from '../../shared/distress.js';
import { flushNotices } from '../src/email.js';
import { buildModeration, readModeration, moderatedInput, replyText, MODERATED_KINDS } from '../src/moderation.js';
import { ALERT_TOPIC, alertKind } from '../src/alerts.js';
import { dayOf, monthOf } from '../src/util.js';
import {
  setup, ai, makeClass, bearer, signIn, accountId, insertSub, linkDevice, countOf, rows, one, claudeReply, claudeDown, claudeMessage,
  devOf, systemText, DEVICE, FEEDBACK_INPUT, FEEDBACK_REPLY,
} from './helpers.js';

let h;
afterEach(() => h?.done());

const chat = (content, extra = {}) => ({ messages: [{ role: 'user', content }], context: { question: '3x + 5 = 11', correct: '2' }, ...extra });
const events = () => rows(h.env, 'SELECT kind, category, surface, source FROM safety_events ORDER BY id').map((r) => ({ ...r }));
/** Is this request the classifier's? (its system text, not the tutor's) */
const isMod = (p) => systemText(p).startsWith('You screen one');
const modCalls = () => h.net.log.claude.filter(isMod);
/** The classifier's answer, as the stub gives it. */
const verdict = (p, v) => new Response(JSON.stringify(claudeMessage(p, { text: JSON.stringify(v) })), { status: 200, headers: { 'Content-Type': 'application/json' } });
/** A stub that answers the classifier with `input` / `output` verdicts and the tutor with `reply`. */
const stub = ({ input = { flag: false, category: 'none' }, output = { flag: false, category: 'none' }, reply = 'נחסר 5 משני האגפים.', care = 'תודה שכתבתם. ער״ן 1201.' } = {}) => ({
  claude: (p) => {
    if (isMod(p)) return verdict(p, systemText(p).includes('reply that an AI maths tutor wrote') ? output : input);
    if (systemText(p).includes('Task:') === false && p.max_tokens === 700) return claudeReply(p, { text: `[[care]]\n${care}` });
    return claudeReply(p, { text: reply });
  },
});
// a message no word list reads as distress, in a child's own words (the classifier is what would notice it)
const QUIET = 'כבר לא אכפת לי מכלום, נמאס לי להיות פה';
const SAD = 'אני רוצה למות';

test('the request: the low-cost model, a JSON verdict, the text masked and clipped; a strict reader', () => {
  const p = buildModeration('input', `${'א'.repeat(3000)} 0521234567`, { FREE_MODEL: 'm-free' });
  assert.equal(p.model, 'm-free');
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.ok(p.messages[0].content.length < 2100, 'clipped');
  assert.ok(!buildModeration('input', 'התקשרו 0521234567').messages[0].content.includes('0521234567'), 'masked before it is sent');
  assert.equal(buildModeration('input', 'x', { MODERATION_MODEL: 'm-mod', FREE_MODEL: 'm-free' }).model, 'm-mod');
  assert.match(systemText(buildModeration('input', 'x')), /Hebrew/);
  const msg = (text, stop = 'end_turn') => ({ content: [{ type: 'text', text }], stop_reason: stop });
  assert.deepEqual(readModeration('input', msg('{"flag":true,"category":"self_harm"}')), { flag: true, category: 'self_harm' });
  assert.deepEqual(readModeration('output', msg('{"flag":true,"category":"sexual"}')), { flag: true, category: 'sexual' });
  assert.deepEqual(readModeration('input', msg('{"flag":true,"category":"sexual"}')), { flag: true, category: 'distress' }, 'the nearest of its own list');
  assert.deepEqual(readModeration('input', msg('{"flag":false,"category":"none"}')), { flag: false, category: null });
  for (const bad of ['not json', '{"category":"x"}', '']) assert.equal(readModeration('input', msg(bad)), null, bad);
  assert.equal(readModeration('input', msg('{"flag":true}', 'refusal')), null);
  assert.deepEqual(MODERATED_KINDS, ['chat', 'explain', 'feedback']);
  assert.equal(moderatedInput('explain', { studentAnswer: '2x+3' }), '', 'maths alone is not read');
  assert.equal(moderatedInput('explain', { studentAnswer: 'לא יודע ונמאס לי' }), 'לא יודע ונמאס לי');
  assert.equal(replyText({ summary: 'א', items: [{ note: 'ב' }] }), 'א\nב');
});

test('MODERATION off (the default): no classifier call, the word list alone decides', async () => {
  h = await setup({}, stub({ input: { flag: true, category: 'self_harm' }, output: { flag: true, category: 'sexual' } }));
  assert.equal(detectDistress(QUIET).flag, false, 'the word list does not read this one');
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(QUIET) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).care, undefined);
  await h.ctx.flush();
  assert.equal(modCalls().length, 0);
  assert.deepEqual(events(), []);
});

test('MODERATION on: a message the classifier flags takes the care path, gives the question back, and logs the category only', async () => {
  h = await setup({ MODERATION: 'on' }, stub({ input: { flag: true, category: 'self_harm' } }));
  const dev = await devOf(h.env);
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(QUIET) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: 'תודה שכתבתם. ער״ן 1201.', care: true });
  await h.ctx.flush();
  assert.equal(modCalls().length, 1);
  assert.equal(modCalls()[0].messages[0].content, `<text>\n${QUIET}\n</text>`);
  assert.equal(countOf(h.env, `free:d:${dev}`), 0, 'the question it took is given back');
  assert.equal(countOf(h.env, `care:d:${dev}`), 1);
  assert.deepEqual(events(), [{ kind: 'distress', category: 'self_harm', surface: 'chat', source: 'model' }]);
  assert.ok(!JSON.stringify(rows(h.env, 'SELECT * FROM safety_events')).includes('נמאס'), 'no text in the log');
  // the classification is priced like any AI answer, under its own kind
  assert.equal(one(h.env, "SELECT calls FROM ai_spend WHERE pool = 'kind:moderation' AND period = ?", monthOf())?.calls, 1);
});

test('MODERATION on: a reply the classifier flags becomes the calm sentence, and the question is given back', async () => {
  h = await setup({ MODERATION: 'on' }, stub({ output: { flag: true, category: 'sexual' }, reply: 'תשובה שלא מתאימה' }));
  const dev = await devOf(h.env);
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('איך פותרים את זה?') });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { text: BLOCKED_TEXT, blocked: true });
  await h.ctx.flush();
  assert.equal(modCalls().length, 2, 'the message, then the reply');
  assert.equal(countOf(h.env, `free:d:${dev}`), 0);
  assert.deepEqual(events(), [{ kind: 'output_blocked', category: 'sexual', surface: 'chat', source: 'model' }]);
  // explain too
  const e = await ai(h, 'explain', { 'X-Device': DEVICE });
  assert.deepEqual(await e.json(), { text: BLOCKED_TEXT, blocked: true });
});

test('MODERATION on: a streamed reply is held and read first; a flagged one never reaches the screen', async () => {
  h = await setup({ MODERATION: 'on' }, stub({ output: { flag: true, category: 'violence' }, reply: 'משהו שלא יוצא החוצה' }));
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('איך פותרים את זה?', { stream: true }) });
  const text = await r.text();
  assert.ok(!text.includes('משהו'), 'nothing of the reply was sent');
  assert.match(text, /\[\[blocked\]\]\s*$/);
  await h.ctx.flush();
  assert.deepEqual(events().map((e) => [e.kind, e.category, e.source]), [['output_blocked', 'violence', 'model']]);
});

test('MODERATION on: a clean reply goes out whole, the stream unchanged; feedback is read as well', async () => {
  h = await setup({ MODERATION: 'on' }, stub());
  const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat('איך פותרים את זה?', { stream: true }) });
  assert.equal(await r.text(), 'נחסר 5 משני האגפים.');
  await h.ctx.flush();
  assert.equal(modCalls().length, 2);
  assert.deepEqual(events(), []);
});

test('it fails open: a classifier that errs or answers nonsense leaves the request as the word list decided', async () => {
  for (const broken of [(p) => claudeDown(500), (p) => claudeReply(p, { text: 'not json' })]) {
    h?.done();
    h = await setup({ MODERATION: 'on' }, { claude: (p) => (isMod(p) ? broken(p) : claudeReply(p, { text: 'נחסר 5 משני האגפים.' })) });
    const r = await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat(QUIET) });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { text: 'נחסר 5 משני האגפים.' });
    await h.ctx.flush();
    assert.deepEqual(events(), []);
  }
});

test('MODERATION on: a help note to the teacher that the classifier flags is marked for the teacher, with the category only', async () => {
  h = await setup({ MODERATION: 'on' }, stub({ input: { flag: true, category: 'bullying' } }));
  const cls = await makeClass(h, { students: ['נועה'] });
  const s = cls.students[0];
  const r = await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 1, question: '3 - 5', answer: '2', note: 'אף אחד לא רוצה לשבת לידי בהפסקה' } });
  assert.equal(r.status, 200);
  await h.ctx.flush();
  assert.equal(one(h.env, 'SELECT m.care FROM help_meta m JOIN help_requests h ON h.id = m.help_id WHERE h.student_id = ?', s.studentId)?.care, 1);
  assert.deepEqual(events(), [{ kind: 'distress', category: 'bullying', surface: 'help_note', source: 'model' }]);
});

test('SAFETY_ALERTS on: a linked parent gets one email a day that says something came up, never what was written', async () => {
  h = await setup({ SAFETY_ALERTS: 'on', EMAIL_FROM: 'מדרגות <noreply@example.test>' }, stub());
  await signIn(h, 'fam@example.test');
  const a = accountId(h.env, 'fam@example.test');
  insertSub(h.env, { kind: 'family', account_id: a });
  const d = await linkDevice(h.env, a);
  for (let i = 0; i < 2; i++) {
    const r = await ai(h, 'chat', d.headers, { body: chat(SAD) });
    assert.equal((await r.json()).care, true);
  }
  await h.ctx.flush();
  const sent = rows(h.env, 'SELECT ref, kind, to_account, params FROM notices WHERE kind LIKE ?', 'safety_alert:%');
  assert.deepEqual(sent.map((n) => ({ ...n })), [{ ref: `fd:${d.id}`, kind: alertKind(dayOf()), to_account: a, params: '{}' }], 'once a day, no text');
  const before = h.net.log.email.length;
  await flushNotices(h.env);
  const mail = h.net.log.email.slice(before).find((m) => String(m.subject).includes('מה שלום'));
  assert.ok(mail, 'the email went out');
  assert.deepEqual(mail.to, ['fam@example.test']);
  assert.ok(!mail.text.includes(SAD) && !mail.text.includes('למות'), 'nothing the child wrote');
  assert.match(mail.text, /1201/);
});

test('SAFETY_ALERTS on: a class student\'s teacher sees one marked request a day on the help board, with no text', async () => {
  h = await setup({ SAFETY_ALERTS: 'on' }, stub());
  const cls = await makeClass(h, { students: ['נועה'] });
  const s = cls.students[0];
  for (let i = 0; i < 2; i++) await ai(h, 'chat', bearer(s), { body: chat(SAD) });
  await h.ctx.flush();
  const req = rows(h.env, 'SELECT h.topic, h.question, h.note, h.answer, h.image, m.kind, m.care FROM help_requests h JOIN help_meta m ON m.help_id = h.id WHERE h.student_id = ?', s.studentId);
  assert.deepEqual(req.map((x) => ({ ...x })), [{ topic: ALERT_TOPIC, question: '', note: '', answer: '', image: null, kind: 'help', care: 1 }]);
  assert.equal(countOf(h.env, `alert:s:${s.studentId}`), 1);
  // the student's own list of requests does not show it, and a student cannot send a request that looks like one
  const work = await (await h.call('GET', '/api/class/work', { headers: bearer(s) })).json();
  assert.equal((work.help || []).filter((x) => x.topic === ALERT_TOPIC).length, 0);
  const fake = await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: ALERT_TOPIC, level: 1, question: '', answer: '', note: '' } });
  assert.equal(fake.status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM help_requests WHERE topic = ?', ALERT_TOPIC).length, 1, 'still only the server\'s');
});

test('SAFETY_ALERTS off (the default): nobody is told; a flag from the classifier also alerts when it is on', async () => {
  h = await setup({}, stub());
  const cls = await makeClass(h, { students: ['נועה'] });
  await ai(h, 'chat', bearer(cls.students[0]), { body: chat(SAD) });
  await h.ctx.flush();
  assert.equal(rows(h.env, 'SELECT * FROM help_requests').length, 0);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'safety_alert:%'").length, 0);
  h.done();
  // both on: the classifier's self-harm flag alerts, and its own call is priced
  h = await setup({ MODERATION: 'on', SAFETY_ALERTS: 'on' }, stub({ input: { flag: true, category: 'self_harm' } }));
  // a class whose students may ask the tutor: the classifier reads only a request that was allowed
  const c2 = await makeClass(h, { students: ['נועה'], studentAi: true });
  await ai(h, 'chat', bearer(c2.students[0]), { body: chat(QUIET) });
  await h.ctx.flush();
  assert.equal(rows(h.env, 'SELECT * FROM help_requests WHERE topic = ?', ALERT_TOPIC).length, 1);
  assert.equal(one(h.env, "SELECT calls FROM ai_spend WHERE pool = 'kind:moderation' AND period = ?", monthOf())?.calls, 1);
});
