// The teacher's side of class licences (spec §5.4, §6.8): the licence card, requests for a trial or a quote, school
// licence codes, the join lock and removing a student. Claude and the email service are stubbed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../scripts/owner.mjs';
import { endOfDayIso } from '../src/util.js';
import {
  setup, ai, makeClass, bearer, signIn, accountId, insertSub, setCount, netOf, rows, one, advanceClock,
} from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const licence = (cls) => h.call('GET', '/api/teacher/licence', { headers: cls.teacher });

test('a locked class refuses new names (403 class_locked) and lets its students back in with their PIN', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  assert.equal((await h.call('POST', '/api/teacher/class/lock', { body: { locked: true } })).status, 401, 'teacher key needed');
  assert.equal((await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: 'yes' } })).status, 400);
  const r = await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: true } });
  assert.deepEqual(await r.json(), { joinLocked: true });
  const fresh = await h.call('POST', `/api/classes/${cls.code}/join`, { body: { name: 'זר', pin: '1111' } });
  assert.equal(fresh.status, 403); assert.equal((await fresh.json()).error, 'class_locked');
  const back = await h.call('POST', `/api/classes/${cls.code}/join`, { body: { name: 'נועה', pin: '1234' } });
  assert.equal(back.status, 200);
  const dash = await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
  assert.equal(dash.joinLocked, true);
  assert.equal((await (await licence(cls)).json()).joinLocked, true);
  await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: false } });
  assert.equal((await h.call('POST', `/api/classes/${cls.code}/join`, { body: { name: 'זר', pin: '1111' } })).status, 200);
  assert.equal((await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json()).joinLocked, false);
  assert.deepEqual(rows(h.env, "SELECT actor, detail FROM audit_log WHERE action = 'class.lock'").map((x) => [x.actor, JSON.parse(x.detail).locked]),
    [[`teacher:${cls.code}`, true], [`teacher:${cls.code}`, false]]);
});

test('removing a student deletes their rows, and their token stops working', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  await h.call('POST', '/api/progress', { headers: bearer(noa), body: { events: [{ topic: 'neg', level: 1, ok: true, first: true, secs: 5 }], levels: { neg: { level: 2, max: 2 } } } });
  await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'neg', question: '3 - 8', answer: '5' } });
  await h.call('POST', '/api/exams', { headers: bearer(noa), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
  await h.call('POST', '/api/progress', { headers: bearer(itai), body: { events: [{ topic: 'neg', level: 1, ok: true, first: true, secs: 5 }] } });
  await setCount(h.env, `pin:${noa.studentId}`, 3);
  // another class's teacher cannot remove her
  const other = await makeClass(h);
  assert.equal((await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: other.teacher, body: {} })).status, 404);
  const r = await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} });
  assert.deepEqual(await r.json(), { ok: true });
  for (const t of ['attempts', 'levels', 'help_requests', 'exams']) {
    assert.equal(rows(h.env, `SELECT * FROM ${t} WHERE student_id = ?`, noa.studentId).length, 0, t);
  }
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage WHERE who = ?', `pin:${noa.studentId}`).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM students WHERE id = ?', noa.studentId).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM attempts WHERE student_id = ?', itai.studentId).length, 1, 'the other student keeps everything');
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(noa), body: { events: [] } })).status, 401, 'the token stops working');
  assert.equal((await ai(h, 'explain', bearer(noa))).headers.get('X-AI-Tier'), 'free', 'no longer a class student');
  const audit = one(h.env, "SELECT * FROM audit_log WHERE action = 'student.remove'");
  assert.equal(audit.target, `student:${noa.studentId}`);
  assert.doesNotMatch(audit.detail, /נועה/, 'no name in the audit log');
  const dash = await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
  assert.deepEqual(dash.students.map((s) => s.name), ['איתי']);
});

test('a licence request needs the teacher key and an account; one open per kind per class; the owner email is HTML-escaped', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const token = await signIn(h, 'teacher@example.test');
  const req = (headers, body) => h.call('POST', '/api/teacher/licence/request', { headers, body });
  const body = { wants: 'quote', school: '<b>אורט</b> & "גבעה"', classes: 3, students: 32, note: 'שלום <script>alert(1)</script>' };
  assert.equal((await req({ 'X-Account-Token': token }, body)).status, 401, 'no teacher key');
  const noAccount = await req(cls.teacher, body);
  assert.equal(noAccount.status, 401); assert.equal((await noAccount.json()).error, 'not_account');
  const both = { ...cls.teacher, 'X-Account-Token': token };
  assert.equal((await req(both, { ...body, wants: 'gift' })).status, 400);
  assert.equal((await req(both, { ...body, school: '   ' })).status, 400);
  assert.equal((await req(both, { ...body, classes: 31 })).status, 400);
  assert.equal((await req(both, { ...body, students: 46 })).status, 400);
  const ok = await req(both, body);
  assert.deepEqual(await ok.json(), { ok: true });
  const again = await req(both, body);
  assert.equal(again.status, 409); assert.equal((await again.json()).error, 'request_open');
  assert.equal((await req(both, { ...body, wants: 'trial' })).status, 200, 'another kind is its own request');
  const row = one(h.env, "SELECT * FROM licence_requests WHERE wants = 'quote'");
  assert.equal(row.class_code, cls.code); assert.equal(row.account_id, accountId(h.env, 'teacher@example.test'));
  assert.equal(row.classes, 3); assert.equal(row.students, 32);
  // the notice holds no address; the owner's email has it, escaped like every other value
  assert.doesNotMatch(one(h.env, "SELECT params FROM notices WHERE kind = 'owner:licence_request' AND ref = ?", row.id).params, /@/);
  await h.ctx.flush();
  const mail = h.net.log.email.filter((m) => m.subject.startsWith('[מדרגות] בקשה'));
  assert.equal(mail.length, 2);
  assert.deepEqual(mail[0].to, ['owner@example.test']);
  const quote = mail.find((m) => m.subject === `[מדרגות] בקשה להצעת מחיר לכיתה ${cls.code}`);
  assert.ok(quote);
  assert.match(quote.html, /&lt;b&gt;אורט&lt;\/b&gt; &amp; &quot;גבעה&quot;/);
  assert.match(quote.html, /&lt;script&gt;/);
  assert.doesNotMatch(quote.html, /<script>|<b>/);
  assert.match(quote.text, /מייל המורה: teacher@example\.test/);
  assert.match(quote.text, /כמה כיתות: 3/);
  assert.match(quote.text, new RegExp(`קוד הכיתה: ${cls.code}`));
  const status = await (await licence(cls)).json();
  assert.equal(status.request.wants, 'trial');
  // 5 a day per class
  await setCount(h.env, `licreq:c:${cls.code}`, 5);
  h.env.DB.raw.prepare('UPDATE licence_requests SET handled_at = ?').run(new Date().toISOString());
  assert.equal((await req(both, body)).status, 429);
});

test('a trial request never grants anything by itself', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const token = await signIn(h, 'teacher@example.test');
  await h.call('POST', '/api/teacher/licence/request', { headers: { ...cls.teacher, 'X-Account-Token': token }, body: { wants: 'trial', school: 'אורט', classes: 1 } });
  await h.ctx.flush();
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions').length, 0);
  assert.equal((await (await licence(cls)).json()).status, 'none');
  assert.equal((await ai(h, 'check', bearer(cls.students[0]))).status, 402);
  const mail = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] בקשה לניסיון'));
  assert.match(mail.text, /ניסיון לא נפתח לבד/);
  assert.match(mail.text, new RegExp(`grant-class --class ${cls.code} --seats 30 --trial`));
});

test('a school licence code attaches a class once, uses up one place, and expires after 60 days', async () => {
  h = await setup();
  const code = 'ABCD-EFGH-JKMN';
  h.env.DB.raw.exec(build('grant-school', { classes: '2', seats: '35', until: '2099-08-31', invoice: 'INV-9' }, { code }).sql);
  const a = await makeClass(h, { students: ['נועה'] });
  const b = await makeClass(h);
  const c = await makeClass(h);
  const claimL = (cls, value) => h.call('POST', '/api/teacher/licence/claim', { headers: cls.teacher, body: { code: value } });
  assert.equal((await h.call('POST', '/api/teacher/licence/claim', { body: { code } })).status, 401);
  const bad = await claimL(a, 'ABCD-EFGH-JKMP');
  assert.equal(bad.status, 400); assert.equal((await bad.json()).error, 'bad_licence_code');
  assert.equal((await claimL(a, 'nonsense')).status, 400);
  const r = await claimL(a, ' abcd efgh jkmn ');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, until: endOfDayIso('2099-08-31'), seats: 35 });
  const sub = one(h.env, 'SELECT * FROM subscriptions WHERE class_code = ?', a.code);
  assert.equal(sub.plan, 'term'); assert.equal(sub.provider, 'manual'); assert.equal(sub.seats, 35); assert.equal(sub.invoice_ref, 'INV-9');
  assert.equal(one(h.env, 'SELECT classes_left FROM licence_codes').classes_left, 1);
  const twice = await claimL(a, code);
  assert.equal(twice.status, 409); assert.equal((await twice.json()).error, 'class_has_licence');
  assert.equal(one(h.env, 'SELECT classes_left FROM licence_codes').classes_left, 1, 'nothing used up by the refusal');
  // the licence is live for the students at once
  const s = await ai(h, 'check', bearer(a.students[0]));
  assert.equal(s.status, 200); assert.equal(s.headers.get('X-AI-Tier'), 'class');
  // a class with a running trial: the code replaces the trial
  insertSub(h.env, { kind: 'class', class_code: b.code, plan: 'trial', seats: 20, end: new Date(Date.now() + 10 * DAY).toISOString() });
  assert.equal((await claimL(b, code)).status, 200);
  assert.deepEqual(rows(h.env, 'SELECT plan, status FROM subscriptions WHERE class_code = ? ORDER BY created_at, plan DESC', b.code).map((x) => `${x.plan}:${x.status}`).sort(),
    ['term:active', 'trial:ended']);
  // every place is used
  assert.equal(one(h.env, 'SELECT classes_left FROM licence_codes').classes_left, 0);
  assert.equal((await claimL(c, code)).status, 400);
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'licence.claim'").length, 2);
  // a fresh code expires after 60 days
  h.env.DB.raw.exec(build('grant-school', { classes: '5', seats: '30', until: '2099-08-31', invoice: 'INV-10' }, { code: 'MNPQ-RSTU-VWXY' }).sql);
  advanceClock(61 * DAY);
  assert.equal((await claimL(c, 'MNPQ-RSTU-VWXY')).status, 400);
});

test('licence claims are limited per network (10 an hour) and per class (10 a day)', async () => {
  h = await setup();
  const cls = await makeClass(h);
  const claimL = (ip) => h.call('POST', '/api/teacher/licence/claim', { headers: cls.teacher, body: { code: 'ABCD-EFGH-JKMN' }, ip });
  await setCount(h.env, `licclaim:c:${cls.code}`, 10);
  assert.equal((await claimL()).status, 429);
  await setCount(h.env, `licclaim:c:${cls.code}`, 0);
  const { hourOf } = await import('../src/util.js');
  h.env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, 10) ON CONFLICT (who, day) DO UPDATE SET count = 10')
    .run(`licclaim:n:${await netOf(h.env)}`, hourOf());
  assert.equal((await claimL()).status, 429);
  assert.equal((await claimL('198.51.100.40')).status, 400, 'another network gets an answer');
});

test('the licence card reports the status, seats, students and the class total only', async () => {
  h = await setup({ BILLING_START: '2099-01-01', LEGACY_CLASS_AI_UNTIL: '2099-01-31' });
  const cls = await makeClass(h, { students: ['נועה', 'איתי', 'מאיה'] });
  let card = await (await licence(cls)).json();
  assert.equal(card.status, 'legacy', 'a class made before BILLING_START');
  assert.equal(card.legacyUntil, '2099-01-31');
  assert.deepEqual(card.offer, { seatYearAgorot: 4900, minSeats: 10, vatMode: 'included', online: true });
  // the class total of AI questions this week, from every kind of counter; family plans are never counted here
  const [noa, itai] = cls.students;
  await ai(h, 'explain', bearer(noa)); await ai(h, 'chat', bearer(itai)); await ai(h, 'generate', cls.teacher);
  await setCount(h.env, `free:s:${noa.studentId}`, 2);
  await setCount(h.env, 'fam:someone:tutor', 9);
  await setCount(h.env, `s:${noa.studentId}:tutor:tries`, 5);
  card = await (await licence(cls)).json();
  assert.equal(card.students, 3); assert.equal(card.aiWeek, 5);
  assert.deepEqual(Object.keys(card).sort(), ['aiWeek', 'joinLocked', 'legacyUntil', 'offer', 'request', 'seats', 'status', 'students', 'until']);
  assert.doesNotMatch(JSON.stringify(card), /נועה|איתי|@|fam:/, 'no names, no per-student data, no family plans');
  // an active licence; then one ending within 30 days; a trial; an ended licence
  const lic = insertSub(h.env, { kind: 'class', class_code: cls.code, plan: 'term', seats: 35, end: new Date(Date.now() + 200 * DAY).toISOString() });
  card = await (await licence(cls)).json();
  assert.equal(card.status, 'active'); assert.equal(card.seats, 35); assert.equal(card.until, lic.current_period_end); assert.equal(card.legacyUntil, null);
  h.env.DB.raw.prepare('UPDATE subscriptions SET current_period_end = ? WHERE id = ?').run(new Date(Date.now() + 20 * DAY).toISOString(), lic.id);
  assert.equal((await (await licence(cls)).json()).status, 'ending');
  h.env.DB.raw.prepare("UPDATE subscriptions SET plan = 'trial' WHERE id = ?").run(lic.id);
  assert.equal((await (await licence(cls)).json()).status, 'trial');
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'ended', current_period_end = ? WHERE id = ?").run(new Date(Date.now() - DAY).toISOString(), lic.id);
  h.done();
  h = await setup();
  const fresh = await makeClass(h);
  insertSub(h.env, { kind: 'class', class_code: fresh.code, plan: 'term', status: 'ended', start: new Date(Date.now() - 400 * DAY).toISOString(), end: new Date(Date.now() - DAY).toISOString() });
  card = await (await licence(fresh)).json();
  assert.equal(card.status, 'ended'); assert.ok(card.until); assert.equal(card.seats, null);
  const none = await makeClass(h);
  card = await (await licence(none)).json();
  assert.equal(card.status, 'none'); assert.equal(card.until, null); assert.equal(card.request, null); assert.equal(card.students, 0);
  assert.equal((await h.call('GET', '/api/teacher/licence')).status, 401);
});
