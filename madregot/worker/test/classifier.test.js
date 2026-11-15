// The optional second reader and the adult's alert (COUNCIL2-9). MODERATION = "on" adds a short classification call on
// the free text (a child's message, and the tutor's reply on chat, explain and feedback); SAFETY_ALERTS = "on" tells a
// linked parent or the class teacher, with no text, at most once a day. Both are off by default and fail open. Claude
// and the email service are stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED_TEXT } from '../../shared/safety.js';
import { detectDistress, distressDetail } from '../../shared/distress.js';
import { flushNotices } from '../src/email.js';
import { buildModeration, readModeration, moderatedInput, replyText, MODERATED_KINDS } from '../src/moderation.js';
import { ALERT_TOPIC, alertKind, alertWorthy } from '../src/alerts.js';
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
  // a class whose students may use the tutor: only their notes are read (a school class's never are, below)
  const cls = await makeClass(h, { students: ['נועה'], studentAi: true });
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

// ---------------------------------------------------------------- who is told, and about what (the review of COUNCIL2-9)
const alerts = () => ({
  parent: rows(h.env, "SELECT to_account FROM notices WHERE kind LIKE 'safety_alert:%'").length,
  teacher: rows(h.env, 'SELECT id FROM help_requests WHERE topic = ?', ALERT_TOPIC).length,
});
/** A device a parent linked, with a family plan. */
async function familyDevice(email = 'parent@example.test') {
  await signIn(h, email);
  const a = accountId(h.env, email);
  insertSub(h.env, { kind: 'family', account_id: a });
  return linkDevice(h.env, a);
}
const HOME_AND_HARM = ['אבא שלי מרביץ לי כל יום ואני רוצה למות', 'אני פוחדת מאבא שלי ויש לי מחשבות אובדניות', 'קשה לי בבית ואני רוצה להתאבד', 'ابوي بيضربني وبدي اموت'];
const MATHS = ['כמה קומות צריך לקפוץ מקומה -2 לקומה 5?', 'באיזו נקודה אני חותכת?', 'כמה שניות לוקח לכדור ליפול מהגג?'];
const NOT_SURE = ['בא לי למות מהמבחן הזה', 'אני חותכת', 'אני לא שווה כלום', 'בא לי להיעלם', 'מתחשק לי לחתוך'];

test('SAFETY_ALERTS on: a child who writes that a parent hits them and that they want to die: that parent is never emailed', async () => {
  h = await setup({ SAFETY_ALERTS: 'on', EMAIL_FROM: 'מדרגות <noreply@example.test>' }, stub());
  const d = await familyDevice();
  for (const text of HOME_AND_HARM) {
    const detail = distressDetail(text);
    assert.equal(detail.home, true, text); assert.equal(detail.sure, true, text);
    const r = await ai(h, 'chat', d.headers, { body: chat(text) });
    assert.equal((await r.json()).care, true, text);
  }
  await h.ctx.flush();
  assert.deepEqual(alerts(), { parent: 0, teacher: 0 }, 'a child with no class: nobody the app can tell');
  await flushNotices(h.env);
  assert.equal(h.net.log.email.filter((m) => String(m.subject).includes('מה שלום')).length, 0);
  // the same child, with no word about home: the parent is told, as before
  await ai(h, 'chat', d.headers, { body: chat(SAD) });
  await h.ctx.flush();
  assert.deepEqual(alerts(), { parent: 1, teacher: 0 });
});

test('SAFETY_ALERTS on: a class student on a family device who writes about home: the teacher is told, not the parent', async () => {
  h = await setup({ SAFETY_ALERTS: 'on' }, stub());
  const d = await familyDevice();
  const cls = await makeClass(h, { students: ['נועה'], studentAi: true });
  const both = { ...bearer(cls.students[0]), ...d.headers };
  const r = await ai(h, 'chat', both, { body: chat(HOME_AND_HARM[0]) });
  assert.equal((await r.json()).care, true);
  await h.ctx.flush();
  assert.deepEqual(alerts(), { parent: 0, teacher: 1 });
  const row = one(h.env, 'SELECT note, question FROM help_requests WHERE topic = ?', ALERT_TOPIC);
  assert.deepEqual({ ...row }, { note: '', question: '' }, 'no text');
});

test('SAFETY_ALERTS on: maths questions alert nobody, and neither does a word that is also maths or slang', async () => {
  h = await setup({ SAFETY_ALERTS: 'on' }, stub());
  const d = await familyDevice();
  const cls = await makeClass(h, { students: ['נועה'], studentAi: true });
  for (const text of MATHS) {
    assert.equal(detectDistress(text).flag, false, text);
    const r = await ai(h, 'chat', d.headers, { body: chat(text) });
    assert.equal((await r.json()).care, undefined, `${text}: a maths answer`);
  }
  for (const text of NOT_SURE) {
    const detail = distressDetail(text);
    assert.equal(detail.flag, true, text); assert.equal(detail.sure, false, text);
    assert.equal(alertWorthy({ flag: true, category: detail.category, source: 'regex' }, detail), false, text);
    const fam = await ai(h, 'chat', d.headers, { body: chat(text) });
    assert.equal((await fam.json()).care, true, `${text}: the child still gets the care answer`);
    await ai(h, 'chat', bearer(cls.students[0]), { body: chat(text) });
  }
  await h.ctx.flush();
  assert.deepEqual(alerts(), { parent: 0, teacher: 0 });
  assert.deepEqual(events().map((e) => e.kind), Array(2 * NOT_SURE.length).fill('distress'), 'counted in the safety log all the same');
  // other categories never alert, whatever they say
  assert.equal(alertWorthy({ flag: true, category: 'abuse' }, distressDetail('אבא שלי מרביץ לי')), false);
  assert.equal(alertWorthy({ flag: true, category: 'self_harm', source: 'model' }, distressDetail(QUIET)), true, 'the classifier\'s own reading');
  assert.equal(alertWorthy({ flag: false, category: null }, distressDetail(SAD)), false);
});

test('SAFETY_ALERTS and MODERATION on: a message only the classifier flags that names home goes to the teacher, never to the parent', async () => {
  const text = 'אמא שלי אומרת שאני סתם נטל על כולם, כבר לא אכפת לי מכלום';
  h = await setup({ MODERATION: 'on', SAFETY_ALERTS: 'on' }, stub({ input: { flag: true, category: 'self_harm' } }));
  assert.equal(detectDistress(text).flag, false, 'the word list does not read this one');
  assert.equal(distressDetail(text).home, true, 'but it names home');
  const d = await familyDevice();
  await ai(h, 'chat', d.headers, { body: chat(text) });
  await h.ctx.flush();
  assert.deepEqual(alerts(), { parent: 0, teacher: 0 });
});

// ---------------------------------------------------------------- the second reader and a school class's notes
const NOTE = 'המורה, קשה לי בבית בזמן האחרון ואני לא מצליחה להתרכז. גם אחותי רותי חולה';
const askNote = (s, extra = {}) => h.call('POST', '/api/help', { headers: { ...bearer(s), ...extra }, body: { topic: 'signed', level: 1, question: '3 - 8', answer: '5', note: NOTE } });

test('MODERATION on: the note of a school-class student (tutor off, no consent) is never sent to Claude; the word list alone decides', async () => {
  h = await setup({ MODERATION: 'on', AI_PARENT_OK: 'required', AI_PAYWALL: 'off' }, stub({ input: { flag: true, category: 'distress' } }));
  const cls = await makeClass(h, { students: ['נועה'] }); // a school class: no class_settings row, student AI off
  const [s] = cls.students;
  assert.equal((await ai(h, 'chat', bearer(s))).status, 403, 'the tutor itself refuses this student');
  assert.equal(detectDistress(NOTE).flag, false);
  assert.equal((await askNote(s)).status, 200);
  await h.ctx.flush();
  assert.equal(h.net.log.claude.length, 0, 'nothing the child wrote went to the AI company');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM help_meta WHERE care = 1').n, 0);
  // a note the word list reads is still marked for the teacher, with no call
  assert.equal((await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', question: '4 - 9', answer: '', note: 'עושים עליי חרם' } })).status, 200);
  await h.ctx.flush();
  assert.equal(h.net.log.claude.length, 0);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM help_meta WHERE care = 1').n, 1);
  // the same student after the teacher turned the AI off for her in a class that has it on: still not read
  const on = await makeClass(h, { students: ['דנה'], studentAi: true });
  h.env.DB.raw.prepare('INSERT INTO student_ai_off (student_id, at) VALUES (?, ?)').run(on.students[0].studentId, new Date().toISOString());
  assert.equal((await askNote(on.students[0])).status, 200);
  await h.ctx.flush();
  assert.equal(h.net.log.claude.length, 0);
});

test('MODERATION on: a note is read when the tutor is on for the student, or on a device a parent linked', async () => {
  h = await setup({ MODERATION: 'on' }, stub({ input: { flag: true, category: 'distress' } }));
  const on = await makeClass(h, { students: ['דנה'], studentAi: true });
  assert.equal((await askNote(on.students[0])).status, 200);
  await h.ctx.flush();
  assert.equal(modCalls().length, 1);
  assert.equal(one(h.env, 'SELECT m.care FROM help_meta m JOIN help_requests r ON r.id = m.help_id WHERE r.student_id = ?', on.students[0].studentId).care, 1);
  // a school-class student on a family device: the parent chose the tutor for this device
  const d = await familyDevice('home@example.test');
  const school = await makeClass(h, { students: ['נועה'] });
  assert.equal((await askNote(school.students[0], d.headers)).status, 200);
  await h.ctx.flush();
  assert.equal(modCalls().length, 2);
  // a made-up family header is no pass
  assert.equal((await h.call('POST', '/api/help', { headers: { ...bearer(school.students[0]), 'X-Family-Device': `fd1.${'0'.repeat(64)}` }, body: { topic: 'eq', question: 'x', answer: '', note: NOTE } })).status, 200);
  await h.ctx.flush();
  assert.equal(modCalls().length, 2);
});
