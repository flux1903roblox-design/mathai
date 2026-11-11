// Help both ways (spec TEACHER-6) against the in-memory D1: the teacher's reply and its limits, what the student sees in
// GET /api/class/work and their answers, the contact guard both ways, the dashboard's threads, deleting a student and
// the night purge, and the daily email with counts only. Claude and the email service are stubbed; every name and
// address is synthetic (example.test). (TRUST-3's distress check on a student's reply is not in this lane's code yet.)
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { hasContact, HELP, helpDigest } from '../src/help.js';
import { run, purge } from '../src/cron.js';
import { jerusalemMidnight } from '../src/util.js';
import { setup, makeClass, bearer, signIn, accountId, setCount, rows, one, advanceClock } from './helpers.js';
import { RETENTION as R } from '../../shared/retention.js';

let h;
afterEach(() => h?.done());
const HOUR = 3600_000;
const DAY = 24 * HOUR;
// Thursday 12 November 2026, 10:00 in Jerusalem
const NOW = Date.parse('2026-11-12T08:00:00Z');
const pin = (ms = NOW) => advanceClock(ms - Date.now());
/** The instant hh:mm in Jerusalem on a YYYY-MM-DD day. */
const at = (day, hh, mm = 0) => jerusalemMidnight(day).ms + hh * HOUR + mm * 60_000;

const ask = async (s, question = '3 - 8') => {
  assert.equal((await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 1, question, answer: '5', note: 'לא הבנתי' } })).status, 200);
  return one(h.env, 'SELECT id FROM help_requests WHERE student_id = ? AND question = ? ORDER BY id DESC', s.studentId, question).id;
};
const teacherSays = (cls, id, text, headers = cls.teacher) => h.call('POST', `/api/teacher/help/${id}/reply`, { headers, body: { body: text } });
const studentSays = (s, id, body) => h.call('POST', `/api/help/${id}/reply`, { headers: bearer(s), body });
const work = async (s) => (await h.call('GET', '/api/class/work', { headers: bearer(s) })).json();
const dashboardOf = async (cls) => (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
async function refused(res, status, error) {
  const b = await res.json();
  assert.equal(res.status, status, JSON.stringify(b));
  if (error) assert.equal(b.error, error);
}

test('1. the teacher replies: 201, three at most (409 reply_limit), 1..500 characters, only in their class, audited without the text', async () => {
  h = await setup();
  pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const id = await ask(cls.students[0]);
  const res = await teacherSays(cls, id, '  נעבור על זה מחר בכיתה  ');
  assert.equal(res.status, 201);
  const { message } = await res.json();
  assert.deepEqual({ ...message, id: undefined }, { id: undefined, from: 'teacher', body: 'נעבור על זה מחר בכיתה', at: message.at, read: false });
  assert.ok(Number.isInteger(message.id));
  assert.ok(one(h.env, 'SELECT seen_at FROM help_requests WHERE id = ?', id).seen_at, 'a reply counts as seen');
  assert.equal((await teacherSays(cls, id, 'x'.repeat(500))).status, 201, '500 characters');
  assert.equal((await teacherSays(cls, id, 'שלב 2: מחברים את המספרים')).status, 201);
  await refused(await teacherSays(cls, id, 'עוד אחת'), 409, 'reply_limit');
  const other = await ask(cls.students[0], '-2 + 7');
  await refused(await teacherSays(cls, other, ''), 400, 'bad_reply');
  await refused(await teacherSays(cls, other, '   \n  '), 400, 'bad_reply');
  await refused(await teacherSays(cls, other, 'x'.repeat(501)), 400, 'bad_reply');
  // another class's teacher: their key does not open this class, and with their own class the request is not found
  const stranger = await makeClass(h, { students: ['זר'] });
  await refused(await teacherSays(stranger, id, 'שלום'), 404, 'not_found');
  await refused(await teacherSays(cls, id, 'שלום', { ...cls.teacher, 'X-Teacher-Key': stranger.teacherKey }), 401);
  assert.equal(rows(h.env, 'SELECT * FROM help_messages WHERE help_id = ?', id).length, 3);
  const audit = rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'help.reply'");
  assert.equal(audit.length, 3, 'one audit row per reply sent, none for the refused ones');
  assert.deepEqual({ ...audit[0] }, { actor: `teacher:${cls.code}`, target: `help:${id}`, detail: '{}' });
  assert.doesNotMatch(JSON.stringify(rows(h.env, 'SELECT * FROM audit_log')), /נעבור על זה/);
});

test('2. the student sees the status and the reply in GET /api/class/work; /read marks it read; another student\'s request is 404', async () => {
  h = await setup();
  pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  const id = await ask(dana);
  let mine = (await work(dana)).help;
  assert.equal(mine.length, 1);
  assert.deepEqual({ ...mine[0], createdAt: undefined }, { id, topic: 'signed', level: 1, question: '3 - 8', createdAt: undefined, status: 'sent', messages: [] });
  assert.ok(!('image' in mine[0]) && !('note' in mine[0]));
  assert.deepEqual((await work(yoav)).help, [], 'only their own requests');
  await h.call('POST', `/api/teacher/help/${id}`, { headers: cls.teacher, body: { action: 'seen' } });
  assert.equal((await work(dana)).help[0].status, 'seen');
  await teacherSays(cls, id, 'נסו שוב, והתחילו מהשלב הראשון בדרך');
  mine = (await work(dana)).help;
  assert.equal(mine[0].status, 'answered');
  assert.deepEqual(mine[0].messages.map((m) => [m.from, m.body, m.read]), [['teacher', 'נסו שוב, והתחילו מהשלב הראשון בדרך', false]]);
  assert.equal((await h.call('POST', `/api/help/${id}/read`, { headers: bearer(dana), body: {} })).status, 200);
  assert.ok(one(h.env, 'SELECT read_at FROM help_messages WHERE help_id = ?', id).read_at);
  assert.equal((await work(dana)).help[0].messages[0].read, true);
  await refused(await h.call('POST', `/api/help/${id}/read`, { headers: bearer(yoav), body: {} }), 404, 'not_found');
  await refused(await studentSays(yoav, id, { quick: 'thanks' }), 404, 'not_found');
  await h.call('POST', `/api/teacher/help/${id}`, { headers: cls.teacher, body: { action: 'done' } });
  assert.equal((await work(dana)).help[0].status, 'done');
  // a request older than 30 days is no longer listed
  h.env.DB.raw.prepare('UPDATE help_requests SET created_at = ? WHERE id = ?').run(new Date(Date.now() - (HELP.studentDays + 1) * DAY).toISOString(), id);
  assert.deepEqual((await work(dana)).help, []);
});

test('3. the student answers only after the teacher, three at most; "still" reopens a done request, "thanks" does not; 30 a day', async () => {
  h = await setup();
  pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const [dana] = cls.students;
  const id = await ask(dana);
  await refused(await studentSays(dana, id, { quick: 'thanks' }), 409, 'no_reply_yet');
  await refused(await studentSays(dana, id, { body: 'שלום' }), 409, 'no_reply_yet');
  await teacherSays(cls, id, 'כתבו לי איפה בדיוק נתקעתם');
  await h.call('POST', `/api/teacher/help/${id}`, { headers: cls.teacher, body: { action: 'done' } });
  const thanks = await studentSays(dana, id, { quick: 'thanks' });
  assert.equal(thanks.status, 201);
  const t = await thanks.json();
  assert.equal(t.message.body, 'תודה, הבנתי');
  assert.equal(t.status, 'done', '"thanks" leaves it done');
  assert.ok(one(h.env, 'SELECT read_at FROM help_messages WHERE help_id = ? AND from_role = ?', id, 'teacher').read_at, 'answering reads the reply');
  await refused(await studentSays(dana, id, { quick: 'other' }), 400, 'bad_reply');
  await refused(await studentSays(dana, id, { body: 'x'.repeat(301) }), 400, 'bad_reply');
  const still = await studentSays(dana, id, { quick: 'still', body: 'לא הבנתי למה המינוס נשאר' });
  assert.equal(still.status, 201);
  assert.deepEqual((await still.json()).status, 'answered');
  assert.equal(one(h.env, 'SELECT done_at FROM help_requests WHERE id = ?', id).done_at, null, '"still" reopens it');
  assert.equal(one(h.env, 'SELECT body FROM help_messages WHERE help_id = ? ORDER BY id DESC', id).body, 'לא הבנתי למה המינוס נשאר');
  const plain = await studentSays(dana, id, { quick: 'still' });
  assert.equal((await plain.json()).message.body, 'עדיין לא ברור לי');
  await refused(await studentSays(dana, id, { quick: 'thanks' }), 409, 'reply_limit');
  assert.deepEqual(rows(h.env, 'SELECT from_role FROM help_messages WHERE help_id = ? ORDER BY id', id).map((r) => r.from_role), ['teacher', 'student', 'student', 'student']);
  // 30 answers a day per student
  await setCount(h.env, `helpreply:s:${dana.studentId}`, HELP.studentPerDay);
  const next = await ask(dana, '-2 + 7');
  await teacherSays(cls, next, 'נעבור על זה מחר בכיתה');
  await refused(await studentSays(dana, next, { quick: 'thanks' }), 429, 'slow_down');
});

test('4a. the contact guard, both ways: links, www, emails and phone numbers are refused; maths and steps pass', async () => {
  for (const bad of ['https://x.test', 'כנסו ל-www.x.test', 'כתבו לי a@b.test', 'התקשרו 050-123 4567', 'ראו example.co.il', 'http://example.test/a', 'טלפון: 03.123.4567', '(050) 1234567']) {
    assert.equal(hasContact(bad), true, bad);
  }
  for (const ok of ['פתרו את 3 + 4', 'שלב 2', 'x = 3.5 ו־y = 2.25', '−12 + 7 = −5', 'המכנה הוא 12, המונה 7', 'בשאלה 1234 + 5678', 'נעבור על זה מחר בכיתה']) {
    assert.equal(hasContact(ok), false, ok);
  }
  // the same number written another way is the same number (the review of the teacher lane): other separators, a
  // letter between the groups, full-width and Arabic-Indic digits, a handle, an address spelled out, a spaced domain
  for (const bad of ['050_123_4567', '050*123*4567', '050+123+4567', '050,123,45,67', '050ש123ש4567', '０５０１２３４５６７', '٠٥٠١٢٣٤٥٦٧',
    '۰۵۰-۱۲۳-۴۵۶۷', '050\u200b123\u200b4567', 'dana at gmail dot com', 'dana [at] gmail', 'dana@gmail', 'תכתבי לי לאינסטגרם @dana_k12', 'instagram . com/dana',
    'gmail (dot) com', 'ｗｗｗ．x．test', 'dana שטרודל gmail נקודה com']) {
    assert.equal(hasContact(bad), true, bad);
  }
  // and maths still passes: operators with spaces around them, lists, dates, decimals and thousands
  for (const ok of ['3 + 4 = 7', '(-3)·(-4)', '(-3)·(-4) = 12', '2.5 + 3.75 = 6.25', '125 · 8 = 1000', '0.25 + 0.75 = 1', 'שאלות 1, 2, 3, 4, 5, 6, 7',
    'עד 12.11.2026', 'נתראה ב־1/9/26', 'מיליון זה 1,000,000', '3x + 2 = 11', '1/2 + 3/4 = 5/4', '-3 - (-8) = 5', '(-12) · (-25) = 300', 'נקודה A היא (3, 4)',
    'look at the line', 'השיפוע הוא 2, ונקודת החיתוך היא 5']) {
    assert.equal(hasContact(ok), false, ok);
  }
  h = await setup();
  pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const [dana] = cls.students;
  const id = await ask(dana);
  for (const bad of ['https://x.test', 'www.x.test', 'a@b.test', '050-123 4567', 'תתקשרי אליי 050_123_4567']) await refused(await teacherSays(cls, id, bad), 400, 'reply_has_contact');
  assert.equal((await teacherSays(cls, id, 'פתרו את 3 + 4')).status, 201);
  for (const bad of ['https://x.test', 'www.x.test', 'a@b.test', '050-123 4567', 'המספר שלי ０５０１２３４５６７', 'תכתבי לי לאינסטגרם @dana_k12']) {
    await refused(await studentSays(dana, id, { quick: 'still', body: bad }), 400, 'reply_has_contact');
  }
  assert.equal((await studentSays(dana, id, { quick: 'still', body: 'שלב 2' })).status, 201);
  assert.doesNotMatch(JSON.stringify(rows(h.env, 'SELECT body FROM help_messages')), /x\.test|@|4567|５|dana/);
});

test('4. the dashboard\'s help rows carry their thread oldest first and count the student\'s unread messages', async () => {
  h = await setup();
  pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  const a = await ask(dana);
  advanceClock(60_000);
  const b = await ask(yoav, '-2 + 7');
  await teacherSays(cls, a, 'נסו שוב, והתחילו מהשלב הראשון בדרך');
  advanceClock(60_000);
  await studentSays(dana, a, { quick: 'still', body: 'עדיין לא הבנתי את השלב השני' });
  advanceClock(60_000);
  await teacherSays(cls, a, 'נעבור על זה מחר בכיתה');
  advanceClock(60_000);
  await studentSays(dana, a, { quick: 'thanks' });
  const d = await dashboardOf(cls);
  const rowA = d.help.find((x) => x.id === a);
  assert.deepEqual(rowA.messages.map((m) => [m.from, m.body]), [
    ['teacher', 'נסו שוב, והתחילו מהשלב הראשון בדרך'], ['student', 'עדיין לא הבנתי את השלב השני'],
    ['teacher', 'נעבור על זה מחר בכיתה'], ['student', 'תודה, הבנתי'],
  ]);
  assert.equal(rowA.unreadFromStudent, 1, 'the reply read the first one; the last waits');
  assert.deepEqual(d.help.find((x) => x.id === b).messages, []);
  assert.equal(d.help.find((x) => x.id === b).unreadFromStudent, 0);
  assert.equal(d.helpDigest, null, 'the key opens the class: no email setting here');
  // the teacher opening it ("ראיתי") reads the student's messages
  await h.call('POST', `/api/teacher/help/${a}`, { headers: cls.teacher, body: { action: 'seen' } });
  assert.equal((await dashboardOf(cls)).help.find((x) => x.id === a).unreadFromStudent, 0);
  // another class's dashboard has none of it
  const stranger = await makeClass(h, { students: ['זר'] });
  assert.doesNotMatch(JSON.stringify(await dashboardOf(stranger)), /השלב השני|נעבור על זה/);
});

test('5. deleting a student deletes the replies on their requests; the night purge deletes the replies of a purged request', async () => {
  h = await setup();
  pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  const a = await ask(dana);
  const b = await ask(yoav);
  for (const id of [a, b]) await teacherSays(cls, id, 'נעבור על זה מחר בכיתה');
  await studentSays(dana, a, { quick: 'thanks' });
  assert.equal((await h.call('POST', `/api/teacher/students/${dana.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  assert.deepEqual(rows(h.env, 'SELECT help_id FROM help_messages').map((r) => r.help_id), [b], "only יואב's thread is left");
  // יואב's request is closed 181 days ago: the purge takes it and its reply
  h.env.DB.raw.prepare('UPDATE help_requests SET done_at = ? WHERE id = ?').run(new Date(Date.now() - (R.helpAfterDoneDays + 1) * DAY).toISOString(), b);
  const report = await purge(h.env);
  assert.equal(report.class.help, 1);
  assert.equal(report.class.helpMessages, 1);
  assert.deepEqual(rows(h.env, 'SELECT * FROM help_messages'), []);
  // a reply whose request went some other way goes the same night
  h.env.DB.raw.prepare("INSERT INTO help_messages (help_id, from_role, body, created_at) VALUES (999, 'teacher', 'x', ?)").run(new Date().toISOString());
  assert.equal((await purge(h.env)).class.helpMessages, 1);
});

test('6. the daily email: owner only, at 16:00 in Jerusalem, a count and the class name only, once an hour, none on Saturday', async () => {
  h = await setup();
  pin(at('2026-11-12', 9));
  const token = await signIn(h, 'teacher@example.test');
  const made = await (await h.call('POST', '/api/classes', { body: { className: 'ז׳3', teacherName: 'רונית', grade: '7' }, headers: { 'X-Account-Token': token } })).json();
  const owner = { 'X-Class-Code': made.code, 'X-Account-Token': token };
  const key = { 'X-Class-Code': made.code, 'X-Teacher-Key': made.teacherKey };
  const students = [];
  for (const name of ['דנה', 'יואב']) students.push(await (await h.call('POST', `/api/classes/${made.code}/join`, { body: { name, pin: '1234' } })).json());
  const digest = (headers, on) => h.call('POST', '/api/teacher/class/digest', { headers, body: { on } });
  const notices = () => rows(h.env, "SELECT ref, kind, to_account, params FROM notices WHERE kind LIKE 'help_digest:%' ORDER BY kind").map((r) => ({ ...r }));
  await refused(await digest(key, true), 401);
  await refused(await digest({ ...key, 'X-Account-Token': await signIn(h, 'other@example.test') }, true), 403, 'not_owner');
  await refused(await digest(owner, 'yes'), 400, 'bad_request');
  // off by default: two requests and the 16:00 run send nothing
  await ask(students[0]); await ask(students[1]);
  await run(h.env, { now: new Date(at('2026-11-12', 16, 7)) });
  assert.deepEqual(notices(), []);
  assert.equal((await (await h.call('GET', '/api/teacher/dashboard', { headers: owner })).json()).helpDigest, false);
  const on = await digest(owner, true);
  assert.equal(on.status, 200);
  assert.deepEqual(await on.json(), { helpDigest: true });
  assert.equal((await (await h.call('GET', '/api/teacher/dashboard', { headers: owner })).json()).helpDigest, true);
  assert.equal(one(h.env, "SELECT detail FROM audit_log WHERE action = 'class.digest'").detail, '{"on":true,"via":"account"}');
  // Thursday 16:07: two new requests → one notice with the count and the class's name, nothing else
  const report = await run(h.env, { now: new Date(at('2026-11-12', 16, 7)) });
  assert.deepEqual(report.helpDigest, { queued: 1 });
  let list = notices();
  assert.deepEqual(list, [{ ref: made.code, kind: 'help_digest:2026-11-12', to_account: accountId(h.env, 'teacher@example.test'), params: JSON.stringify({ className: 'ז׳3', n: 2 }) }]);
  assert.doesNotMatch(list[0].params, /דנה|יואב|3 - 8/);
  const sent = h.net.log.email.find((m) => /בקשות עזרה חדשות/.test(m.subject));
  assert.equal(sent.subject, '2 בקשות עזרה חדשות בכיתה ז׳3');
  assert.match(sent.text, /השמות והתרגילים נמצאים רק בלוח/);
  assert.match(sent.text, /https:\/\/madregot\.example\.test\/#\/teacher\?tab=help/);
  assert.doesNotMatch(sent.text + sent.html, /דנה|יואב|3 - 8|לא הבנתי/);
  // again in the same hour: still one; other hours: none
  await run(h.env, { now: new Date(at('2026-11-12', 16, 40)) });
  await run(h.env, { now: new Date(at('2026-11-12', 17, 7)) });
  assert.equal(notices().length, 1);
  // Friday: nothing new → none
  pin(at('2026-11-13', 9));
  assert.deepEqual(await helpDigest(h.env, new Date(at('2026-11-13', 16, 7))), { queued: 0 });
  // a request on Friday evening and one on Saturday; Saturday's 16:00 sends nothing; Sunday's counts both
  pin(at('2026-11-13', 18));
  await ask(students[0], '-2 + 7');
  pin(at('2026-11-14', 11));
  await ask(students[1], '5 - 9');
  await run(h.env, { now: new Date(at('2026-11-14', 16, 7)) });
  assert.equal(notices().length, 1, 'none on Saturday');
  pin(at('2026-11-15', 9));
  await run(h.env, { now: new Date(at('2026-11-15', 16, 7)) });
  list = notices();
  assert.equal(list.length, 2);
  assert.deepEqual(JSON.parse(list[1].params), { className: 'ז׳3', n: 2 });
  assert.equal(h.net.log.email.filter((m) => /עזרה חדש/.test(m.subject)).at(-1).subject, '2 בקשות עזרה חדשות בכיתה ז׳3');
  // a student's new answer on an open request counts as new; one new request: the subject in the singular
  const open = one(h.env, 'SELECT id FROM help_requests WHERE question = ?', '5 - 9').id;
  await h.call('POST', `/api/teacher/help/${open}/reply`, { headers: owner, body: { body: 'כתבו לי איפה בדיוק נתקעתם' } });
  pin(at('2026-11-16', 10));
  await studentSays(students[1], open, { quick: 'still', body: 'בשלב השני' });
  await run(h.env, { now: new Date(at('2026-11-16', 16, 7)) });
  assert.deepEqual(JSON.parse(notices()[2].params), { className: 'ז׳3', n: 1 });
  assert.equal(h.net.log.email.filter((m) => /עזרה חדש/.test(m.subject)).at(-1).subject, 'בקשת עזרה חדשה בכיתה ז׳3');
  // off: nothing the next day
  assert.equal((await digest(owner, false)).status, 200);
  pin(at('2026-11-17', 10));
  await ask(students[0], '1 - 9');
  await run(h.env, { now: new Date(at('2026-11-17', 16, 7)) });
  assert.equal(notices().length, 3);
});
