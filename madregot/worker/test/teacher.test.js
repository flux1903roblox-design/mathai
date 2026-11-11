// The teacher's side of a class: the dashboard against D1 (practice today and this week, first-try, mistakes with names,
// help requests and exams), help requests (one per exercise, seen/done/reopen, the notebook page), resetting a PIN
// (DURABLE-12) and the PIN check (TRUST-12), the join lock, removing a student, renaming and deleting a class, and class
// licences (spec §5.4, §6.8): the licence card, requests for a trial or a quote, school licence codes. Claude and the
// email service are stubbed; every name and address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../scripts/owner.mjs';
import { endOfDayIso } from '../src/util.js';
import {
  setup, ai, makeClass, bearer, signIn, accountId, insertSub, setCount, countOf, netOf, rows, one, advanceClock,
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
  for (const who of [`s:${noa.studentId}`, `s:${noa.studentId}:tutor`, `free:s:${noa.studentId}`]) await setCount(h.env, who, 1);
  await setCount(h.env, `s:${itai.studentId}`, 1);
  // another class's teacher cannot remove her
  const other = await makeClass(h);
  assert.equal((await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: other.teacher, body: {} })).status, 404);
  const r = await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} });
  assert.deepEqual(await r.json(), { ok: true });
  for (const t of ['attempts', 'levels', 'help_requests', 'exams']) {
    assert.equal(rows(h.env, `SELECT * FROM ${t} WHERE student_id = ?`, noa.studentId).length, 0, t);
  }
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage WHERE who LIKE ?', `%${noa.studentId}%`).length, 0, 'her PIN and AI counters go too');
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage WHERE who = ?', `s:${itai.studentId}`).length, 1, "his counter stays");
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
  const cls = await makeClass(h, { setting: 'private', students: ['נועה'] });
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
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
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
  h.env.DB.raw.exec(build('grant-school', { classes: '2', seats: '35', until: '2099-08-31', invoice: 'INV-9' }, { code, approval: 'approved' }).sql);
  const a = await makeClass(h, { studentAi: true, students: ['נועה'] });
  const b = await makeClass(h, { setting: 'private' });
  const c = await makeClass(h, { setting: 'private' });
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
  h.env.DB.raw.exec(build('grant-school', { classes: '5', seats: '30', until: '2099-08-31', invoice: 'INV-10' }, { code: 'MNPQ-RSTU-VWXY', approval: 'approved' }).sql);
  advanceClock(61 * DAY);
  assert.equal((await claimL(c, 'MNPQ-RSTU-VWXY')).status, 400);
});

test('a Gefen order\'s code (grant-school --gefen): the class that claims it carries the order in its licence\'s note', async () => {
  h = await setup();
  const code = 'GFNA-BCDE-FGHJ';
  // a Gefen order comes only after the Ministry's catalogue approval (TRUST-11: before it, grant-school refuses)
  h.env.DB.raw.exec(build('grant-school', { classes: '1', seats: '30', until: '2099-08-31', invoice: 'INV-77', gefen: '778899' }, { code, approval: 'approved' }).sql);
  const a = await makeClass(h, { ai: true });
  const r = await h.call('POST', '/api/teacher/licence/claim', { headers: a.teacher, body: { code } });
  assert.equal(r.status, 200);
  const sub = one(h.env, 'SELECT note, invoice_ref FROM subscriptions WHERE class_code = ?', a.code);
  assert.deepEqual({ ...sub }, { note: 'gefen:778899', invoice_ref: 'INV-77' });
  // and the owner's list finds it
  assert.deepEqual(rows(h.env, build('list', { gefen: '778899' }).sql).map((x) => x.class_code), [a.code]);
});

test('licence claims are limited per network (10 an hour) and per class (10 a day)', async () => {
  h = await setup();
  const cls = await makeClass(h, { setting: 'private' });
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
  const cls = await makeClass(h, { studentAi: true, students: ['נועה', 'איתי', 'מאיה'] });
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

// ---------- the dashboard, help requests and the PIN reset (DURABLE-12) ----------
const dashboard = async (cls) => (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
const answer = (topic, { ok = true, first = true, secs = 30, cat, daysBack = 0 } = {}) =>
  ({ topic, level: 1, ok, first, secs, ...(cat ? { cat } : {}), at: new Date(Date.now() - daysBack * DAY).toISOString() });
const send = (s, events, levels) => h.call('POST', '/api/progress', { headers: bearer(s), body: { events, ...(levels ? { levels } : {}) } });
const askHelp = (s, body) => h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 2, answer: '5', ...body } });
const PAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('the dashboard needs its own class\'s teacher key, and shows that class only', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const other = await makeClass(h, { students: ['דנה'] });
  await send(other.students[0], [answer('signed', { cat: 'sign' })]);
  await askHelp(other.students[0], { question: '2 - 9' });
  await h.call('POST', '/api/exams', { headers: bearer(other.students[0]), body: { title: 'מבחן', correct: 1, total: 1, questions: [] } });
  for (const headers of [{}, { 'X-Class-Code': cls.code }, { 'X-Class-Code': cls.code, 'X-Teacher-Key': other.teacherKey }, { 'X-Class-Code': 'NOPE12', 'X-Teacher-Key': cls.teacherKey }]) {
    const r = await h.call('GET', '/api/teacher/dashboard', { headers });
    assert.equal(r.status, 401); assert.equal((await r.json()).error, 'not_teacher');
  }
  const dash = await dashboard(cls);
  assert.equal(dash.class.code, cls.code);
  assert.deepEqual(dash.students.map((s) => s.name), ['נועה']);
  assert.deepEqual([dash.help, dash.exams, dash.mistakes], [[], [], []]);
  assert.doesNotMatch(JSON.stringify(dash), /דנה|2 - 9/, 'nothing from the other class');
});

test('the dashboard counts today and the last 7 days per student, and lists levels, shared mistakes, exams and the last practice', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי', 'מאיה'] });
  const [noa, itai] = cls.students;
  // today: 3 answers, 2 right, 1 on the first try, 3 minutes; 3 days ago: 1; 10 days ago: 1 (outside the week)
  await send(noa, [
    answer('signed', { secs: 60 }), answer('signed', { first: false, secs: 60 }), answer('signed', { ok: false, first: false, secs: 60, cat: 'sign' }),
    answer('signed', { daysBack: 3, secs: 120 }), answer('signed', { daysBack: 10, secs: 600 }),
  ], { signed: { level: 2, max: 3 } });
  await send(itai, [answer('signed', { ok: false, first: false, cat: 'sign', daysBack: 2 }), answer('coord', { ok: false, first: false, cat: 'axes', daysBack: 2 })]);
  await h.call('POST', '/api/exams', { headers: bearer(noa), body: {
    title: 'מבחן במספרים מכוונים', correct: 1, total: 2, weakTopics: ['signed', 'neg'],
    questions: [{ topic: 'signed', status: 'correct', skill: 'חיסור', level: 2 }, { topic: 'signed', status: 'wrong', skill: 'חיבור', level: 1 }],
  } });
  const dash = await dashboard(cls);
  const by = Object.fromEntries(dash.students.map((s) => [s.name, s]));
  assert.deepEqual(dash.students.map((s) => s.name), ['איתי', 'מאיה', 'נועה'], 'sorted by name');
  assert.deepEqual(by['נועה'].today, { n: 3, ok: 2, first: 1, minutes: 3 });
  assert.deepEqual(by['נועה'].week, { n: 4, first: 2, days: 2, minutes: 5 });
  assert.deepEqual(by['נועה'].levels, { signed: { level: 2, max: 3 } });
  assert.equal(by['נועה'].pinReset, false);
  assert.equal(Date.parse(by['נועה'].lastPractice) > Date.now() - 60_000, true, 'the newest answer');
  assert.deepEqual(by['איתי'].today, { n: 0, ok: 0, first: 0, minutes: 0 });
  assert.equal(by['איתי'].week.days, 1);
  const { today, week, levels, lastPractice } = by['מאיה'];
  assert.deepEqual({ today, week, levels, lastPractice }, { today: { n: 0, ok: 0, first: 0, minutes: 0 },
    week: { n: 0, first: 0, days: 0, minutes: 0 }, levels: {}, lastPractice: null }, 'a student who has not practised yet');
  // the mistake two students share comes first, with their names
  const [shared, ...rest] = dash.mistakes;
  // with the stair it happened on most and the students' ids, so "מחר" can give practice on it (TEACHER-4 §5)
  assert.deepEqual({ ...shared, names: [...shared.names].sort(), ids: [...shared.ids].sort() },
    { topic: 'signed', cat: 'sign', n: 2, students: 2, level: 1, names: ['איתי', 'נועה'].sort(), ids: [noa.studentId, itai.studentId].sort() });
  assert.deepEqual(rest, [{ topic: 'coord', cat: 'axes', n: 1, students: 1, level: 1, names: ['איתי'], ids: [itai.studentId] }]);
  assert.equal(dash.exams.length, 1);
  const [exam] = dash.exams;
  assert.equal(exam.name, 'נועה'); assert.equal(exam.studentId, noa.studentId); assert.equal(exam.correct, 1); assert.equal(exam.total, 2);
  assert.deepEqual(exam.weak, ['signed'], 'an unknown topic is dropped');
  assert.deepEqual(exam.questions.map((q) => q.status), ['correct', 'wrong']);
});

test('a help request needs a class token; the same open question asked again stays one request with the newest note and page', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const anon = await h.call('POST', '/api/help', { body: { question: '3 - 8' } });
  assert.equal(anon.status, 401);
  assert.deepEqual(await (await askHelp(noa, { question: '3 - 8', note: 'לא הבנתי' })).json(), { ok: true });
  assert.deepEqual(await (await askHelp(noa, { question: '3 - 8', note: 'עדיין לא', image: PAGE, answer: '11' })).json(), { ok: true, again: true });
  assert.deepEqual(await (await askHelp(noa, { question: '3 - 8', note: '' })).json(), { ok: true, again: true }, 'an empty note keeps the last one');
  const all = rows(h.env, 'SELECT * FROM help_requests');
  assert.equal(all.length, 1);
  assert.equal(all[0].note, 'עדיין לא'); assert.equal(all[0].image, PAGE); assert.equal(all[0].answer, '5');
  assert.equal(all[0].level, 2); assert.equal(all[0].topic, 'signed');
  // the dashboard says there is a page, without sending it
  const [req] = (await dashboard(cls)).help;
  assert.equal(req.name, 'נועה'); assert.equal(req.question, '3 - 8'); assert.equal(req.has_image, 1);
  assert.equal(req.seen_at, null); assert.equal(req.done_at, null);
  assert.equal('image' in req, false);
  assert.doesNotMatch(JSON.stringify(await dashboard(cls)), /base64/);
});

test('a student has at most 10 open help requests; closing one makes room', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  for (let i = 0; i < 10; i++) assert.equal((await askHelp(noa, { question: `שאלה ${i}` })).status, 200);
  const full = await askHelp(noa, { question: 'שאלה 10' });
  assert.equal(full.status, 429); assert.equal((await full.json()).error, 'too_many_open');
  assert.equal((await askHelp(itai, { question: 'שאלה 0' })).status, 200, 'a classmate is not affected');
  const first = one(h.env, 'SELECT id FROM help_requests WHERE student_id = ? ORDER BY id LIMIT 1', noa.studentId).id;
  await h.call('POST', `/api/teacher/help/${first}`, { headers: cls.teacher, body: { action: 'done' } });
  assert.equal((await askHelp(noa, { question: 'שאלה 10' })).status, 200);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM help_requests WHERE student_id = ?', noa.studentId).n, 11);
});

test('the teacher marks help seen, done and open again; another class\'s teacher changes nothing and sees no page', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const other = await makeClass(h);
  const [noa] = cls.students;
  await askHelp(noa, { question: '3 - 8', image: PAGE });
  await askHelp(noa, { question: '4 - 9' });
  const [withPage, plain] = rows(h.env, 'SELECT id FROM help_requests ORDER BY id').map((r) => r.id);
  const act = (id, action, headers = cls.teacher) => h.call('POST', `/api/teacher/help/${id}`, { headers, body: { action } });
  const row = (id) => ({ ...one(h.env, 'SELECT seen_at, done_at FROM help_requests WHERE id = ?', id) });
  assert.equal((await act(withPage, 'seen', {})).status, 401);
  const bad = await act(withPage, 'delete');
  assert.equal(bad.status, 400); assert.equal((await bad.json()).error, 'bad_action');
  // another class's teacher: answered, but nothing changes, and the page stays private
  assert.equal((await act(withPage, 'done', other.teacher)).status, 200);
  assert.deepEqual(row(withPage), { seen_at: null, done_at: null });
  assert.equal((await h.call('GET', `/api/teacher/help/${withPage}/image`, { headers: other.teacher })).status, 404);
  assert.equal((await h.call('GET', `/api/teacher/help/${withPage}/image`)).status, 401);
  // the class's own teacher
  const page = await h.call('GET', `/api/teacher/help/${withPage}/image`, { headers: cls.teacher });
  assert.deepEqual(await page.json(), { image: PAGE });
  const none = await h.call('GET', `/api/teacher/help/${plain}/image`, { headers: cls.teacher });
  assert.equal(none.status, 404); assert.equal((await none.json()).error, 'not_found');
  assert.deepEqual(await (await act(withPage, 'seen')).json(), { ok: true });
  const seen = row(withPage).seen_at;
  assert.ok(seen);
  advanceClock(60_000);
  await act(withPage, 'seen');
  assert.equal(row(withPage).seen_at, seen, 'seen twice keeps the first time');
  await act(withPage, 'done');
  assert.ok(row(withPage).done_at);
  // a closed request does not hold the question: asking again opens a new one
  assert.deepEqual(await (await askHelp(noa, { question: '3 - 8' })).json(), { ok: true });
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM help_requests').n, 3);
  await act(withPage, 'reopen');
  assert.deepEqual(row(withPage), { seen_at: seen, done_at: null });
});

test('the dashboard keeps help closed in the last 7 days and drops older closed help; open help stays however old', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  for (const q of ['פתוחה ישנה', 'נסגרה אתמול', 'נסגרה לפני 8 ימים']) await askHelp(noa, { question: q });
  const set = (q, col, iso) => h.env.DB.raw.prepare(`UPDATE help_requests SET ${col} = ? WHERE question = ?`).run(iso, q);
  set('פתוחה ישנה', 'created_at', new Date(Date.now() - 30 * DAY).toISOString());
  set('נסגרה אתמול', 'done_at', new Date(Date.now() - DAY).toISOString());
  set('נסגרה לפני 8 ימים', 'done_at', new Date(Date.now() - 8 * DAY).toISOString());
  const shown = (await dashboard(cls)).help.map((r) => r.question).sort();
  assert.deepEqual(shown, ['נסגרה אתמול', 'פתוחה ישנה'].sort());
});

test('a PIN reset needs the class\'s own teacher; it ends the old token, clears the tries, and the next join sets a new PIN', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const other = await makeClass(h);
  const [noa, itai] = cls.students;
  const reset = (headers) => h.call('POST', `/api/teacher/students/${noa.studentId}/reset-pin`, { headers, body: {} });
  const join = (pin, name = 'נועה') => h.call('POST', `/api/classes/${cls.code}/join`, { body: { name, pin } });
  await setCount(h.env, `pin:${noa.studentId}`, 4);
  const secrets = () => ({ ...one(h.env, 'SELECT pin_hash, token_hash FROM students WHERE id = ?', noa.studentId) });
  const before = secrets();
  assert.equal((await reset({})).status, 401);
  // another class's teacher: answered, nothing changes
  assert.equal((await reset(other.teacher)).status, 200);
  assert.deepEqual(secrets(), before);
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 4, 'the tries stay');
  assert.equal((await send(noa, [])).status, 200, 'her token still works');
  // the class's own teacher
  assert.deepEqual(await (await reset(cls.teacher)).json(), { ok: true });
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 0);
  assert.equal((await send(noa, [])).status, 401, 'the old token stops working');
  assert.equal((await send(itai, [])).status, 200, 'a classmate keeps her token');
  let dash = await dashboard(cls);
  assert.deepEqual(dash.students.map((s) => [s.name, s.pinReset]), [['איתי', false], ['נועה', true]]);
  // a class closed to new names still lets her back in; the new PIN is set by this join, and the old one stops working
  await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: true } });
  const back = await join('5678');
  assert.equal(back.status, 200);
  const again = await back.json();
  assert.equal(again.studentId, noa.studentId); assert.equal(again.returning, true);
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 0, 'setting a new PIN uses no try');
  assert.equal((await send(again, [])).status, 200, 'the new token works');
  const old = await join('1234');
  assert.equal(old.status, 403); assert.equal((await old.json()).error, 'wrong_pin');
  assert.equal((await join('5678')).status, 200);
  dash = await dashboard(cls);
  assert.equal(dash.students.find((s) => s.name === 'נועה').pinReset, false);
});

// ---------------------------------------------------------------- the PIN check (trust spec TRUST-12 §1)
const join = (code, pin, ip, name = 'נועה') => h.call('POST', `/api/classes/${code}/join`, { body: { name, pin }, ip });
const pinRows = (id) => rows(h.env, "SELECT who, day, count FROM ai_usage WHERE who = 'pin:' || ? OR who LIKE 'pin:' || ? || ':%' ORDER BY who", id, id);

test('a PIN is tried 5 times an hour from one network: a classmate there locks it for an hour at most, never elsewhere', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  const A = '198.51.100.10'; const B = '203.0.113.99';
  for (let i = 0; i < 5; i++) assert.equal((await join(cls.code, '9999', A)).status, 403, `wrong ${i + 1}`);
  const sixth = await join(cls.code, '9999', A);
  assert.equal(sixth.status, 429); assert.equal((await sixth.json()).error, 'too_many_pin');
  assert.equal((await join(cls.code, '1234', A)).status, 429, 'that network waits an hour, even with the right code');
  // her own phone on another network: the right code works, and costs no try
  const home = await join(cls.code, '1234', B);
  assert.equal(home.status, 200); assert.equal((await home.json()).returning, true);
  const [netA, netB] = [await netOf(h.env, A), await netOf(h.env, B)];
  assert.equal(countOf(h.env, `pin:${id}`), 5, 'the day counts the 5 wrong tries only');
  assert.equal(countOf(h.env, `pin:${id}:${netB}`), 0, 'the right code gave its try back');
  assert.equal(countOf(h.env, `pin:${id}:${netA}`), 5);
  assert.ok(pinRows(id).every((r) => !r.who.includes(A) && !r.who.includes(B)), 'networks are counted by their key, never the address');
  assert.match(pinRows(id).find((r) => r.who === `pin:${id}:${netA}`).day, /^\d{4}-\d{2}-\d{2}T\d{2}$/, 'an hourly key');
  // an hour later network A may try again
  advanceClock(3600e3);
  assert.equal((await join(cls.code, '9999', A)).status, 403);
  assert.equal((await join(cls.code, '1234', A)).status, 200);
});

test('30 wrong PINs a day in all: from a 7th network the next try is 429, and the teacher\'s reset clears every PIN counter', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  for (let n = 1; n <= 6; n++) for (let i = 0; i < 5; i++) assert.equal((await join(cls.code, '9999', `198.51.100.${n}`)).status, 403, `net ${n} try ${i + 1}`);
  const seventh = await join(cls.code, '1234', '198.51.100.7');
  assert.equal(seventh.status, 429); assert.equal((await seventh.json()).error, 'too_many_pin');
  assert.equal(countOf(h.env, `pin:${id}`), 30);
  assert.equal(pinRows(id).filter((r) => r.count > 0).length, 7, 'the day key and 6 network keys');
  assert.equal(countOf(h.env, `pin:${id}:${await netOf(h.env, '198.51.100.7')}`), 0, 'the refused try took nothing');
  const reset = await h.call('POST', `/api/teacher/students/${id}/reset-pin`, { headers: cls.teacher, body: {} });
  assert.equal(reset.status, 200);
  assert.equal(pinRows(id).length, 0, 'every pin:<id> and pin:<id>:<net> key is gone');
  // the next join sets a new code, from anywhere
  assert.equal((await join(cls.code, '4321', '198.51.100.1')).status, 200);
  assert.equal((await join(cls.code, '4321', '198.51.100.7')).status, 200);
});

test('the PIN check is atomic: 12 wrong codes at once from one network are 5 tries and 7 refusals', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  const res = await Promise.all(Array.from({ length: 12 }, () => join(cls.code, '9999', '198.51.100.20')));
  const st = res.map((r) => r.status).sort();
  assert.deepEqual(st, [...Array(5).fill(403), ...Array(7).fill(429)]);
  assert.equal(countOf(h.env, `pin:${id}`), 5);
});

test('removing a student removes every PIN counter of theirs, and no one else\'s', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  await join(cls.code, '9999', '198.51.100.1'); await join(cls.code, '9999', '198.51.100.2');
  await join(cls.code, '9999', '198.51.100.1', 'איתי');
  assert.equal(pinRows(noa.studentId).length, 3);
  assert.equal((await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  assert.equal(pinRows(noa.studentId).length, 0);
  assert.equal(pinRows(itai.studentId).length, 2, 'the classmate keeps his');
});

// ---------------------------------------------------------------- the dashboard and help, against D1
// A fixed "now": Thursday 12 November 2026, 10:00 in Jerusalem (UTC+2). The week is 6 to 12 November.
const NOW = Date.parse('2026-11-12T08:00:00Z');
const pinClock = () => advanceClock(NOW - Date.now());
const ev = (topic, at, { ok = true, first = ok, cat = null, secs = 30 } = {}) => ({ topic, level: 1, ok, first, hint: false, cat, secs, at });
const dashboardOf = async (cls) => (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
const progress = (s, body) => h.call('POST', '/api/progress', { headers: bearer(s), body });
// (a help request on stair 1; the DURABLE-12 tests above use askHelp, on stair 2, and the same PAGE)
const askHelpL1 = (s, body) => h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 1, answer: '5', ...body } });

test('the dashboard of a 3-student class: today, the week by Jerusalem days, first-try, mistakes with names, help and exams', async () => {
  h = await setup();
  pinClock();
  const cls = await makeClass(h, { students: ['דנה', 'יואב', 'נועה'] });
  const [dana, yoav, noa] = cls.students;
  // דנה: four today (one wrong with a mistake; one sent with a future time counts as now), two on Tuesday
  assert.equal((await progress(dana, { events: [
    ev('signed', '2026-11-12T07:00:00Z'), ev('signed', '2026-11-12T07:01:00Z'),
    ev('signed', '2026-11-12T07:05:00Z', { ok: false, cat: 'sign' }), ev('signed', '2026-11-20T00:00:00Z'),
    ev('signed', '2026-11-10T15:00:00Z'), ev('signed', '2026-11-10T15:02:00Z', { first: false }),
  ], levels: { signed: { level: 2, max: 3 } } })).status, 200);
  // a later sync with a lower stair keeps the highest stair reached
  await progress(dana, { events: [], levels: { signed: { level: 1, max: 1 } } });
  // יואב: three on Monday, one just after midnight on 6 November in Jerusalem (in the week), one just before it (not)
  await progress(yoav, { events: [
    ev('signed', '2026-11-09T12:00:00Z'), ev('signed', '2026-11-09T12:01:00Z', { ok: false, cat: 'sign' }),
    ev('signed', '2026-11-09T12:02:00Z', { ok: false, cat: 'order' }),
    ev('coord', '2026-11-05T22:30:00Z'), ev('signed', '2026-11-05T21:30:00Z', { ok: false, cat: 'sign' }),
  ], levels: { signed: { level: 1, max: 1 }, coord: { level: 2, max: 2 } } });
  // נועה: once, ten days ago
  await progress(noa, { events: [ev('signed', '2026-11-02T12:00:00Z', { ok: false, cat: 'sign' })] });
  // another class practises the same mistake today: none of it shows here
  const other = await makeClass(h, { students: ['זר'] });
  await progress(other.students[0], { events: [ev('signed', '2026-11-12T07:00:00Z', { ok: false, cat: 'sign' })] });
  // help: דנה first, then יואב with a notebook page
  advanceClock(60_000); await askHelpL1(dana, { question: '3 - 8', note: 'לא הבנתי' });
  advanceClock(60_000); await askHelpL1(yoav, { question: '-2 + 7', image: PAGE });
  await h.call('POST', '/api/help', { headers: bearer(other.students[0]), body: { topic: 'signed', question: '1 - 9' } });
  // an exam checked in the app; unknown topics and statuses are cleaned, weak topics filtered
  assert.equal((await h.call('POST', '/api/exams', { headers: bearer(noa), body: {
    title: 'מבחן בשברים', correct: 3, total: 5, weakTopics: ['signed', 'bogus'],
    questions: [{ topic: 'signed', status: 'correct', skill: 'חיבור', level: 2 }, { topic: 'bogus', status: 'weird', skill: 'x'.repeat(100), level: 99 }],
  } })).status, 200);

  const d = await dashboardOf(cls);
  assert.equal(d.today, '2026-11-12');
  assert.deepEqual(d.class, { code: cls.code, name: 'ז׳3', grade: '7', teacherName: 'רונית' });
  assert.equal(d.joinLocked, false);
  assert.deepEqual(d.students.map((s) => s.name), ['דנה', 'יואב', 'נועה'], 'by name, this class only');
  const [sd, sy, sn] = d.students;
  assert.deepEqual(sd.today, { n: 4, ok: 3, first: 3, minutes: 2 });
  assert.deepEqual(sd.week, { n: 6, first: 4, days: 2, minutes: 3 });
  assert.deepEqual(sd.levels, { signed: { level: 1, max: 3 } });
  assert.match(sd.lastPractice, /^2026-11-12T08:0/, 'the future time was stored as now');
  assert.equal(sd.pinReset, false);
  assert.deepEqual(sy.today, { n: 0, ok: 0, first: 0, minutes: 0 });
  assert.deepEqual(sy.week, { n: 4, first: 2, days: 2, minutes: 2 }, '6 November in Jerusalem is in the week, 5 November is not');
  assert.equal(sy.lastPractice, '2026-11-09T12:02:00.000Z');
  assert.deepEqual(sy.levels, { signed: { level: 1, max: 1 }, coord: { level: 2, max: 2 } });
  assert.deepEqual(sn.week, { n: 0, first: 0, days: 0, minutes: 0 });
  assert.equal(sn.lastPractice, '2026-11-02T12:00:00.000Z');
  // first-try this week, as the board's tile computes it: (4 + 2 + 0) of (6 + 4 + 0)
  const sum = (k) => d.students.reduce((a, s) => a + s.week[k], 0);
  assert.equal(Math.round((100 * sum('first')) / sum('n')), 60);
  // mistakes this week: most students first, with their names; נועה's is too old, the other class's is not here
  // each on its stair (TEACHER-16), with the students' ids (TEACHER-4 §5: "give practice on this")
  assert.deepEqual(d.mistakes.map((m) => ({ ...m, ids: [...m.ids].sort(), names: [...m.names].sort() })), [
    { topic: 'signed', cat: 'sign', n: 2, students: 2, level: 1, ids: [dana.studentId, yoav.studentId].sort(), names: ['דנה', 'יואב'] },
    { topic: 'signed', cat: 'order', n: 1, students: 1, level: 1, ids: [yoav.studentId], names: ['יואב'] },
  ]);
  assert.deepEqual(d.assignments, [], 'no assignments yet');
  // help: newest first, names, the page as a flag only (never the image itself)
  assert.deepEqual(d.help.map((x) => [x.name, x.question, x.note, x.has_image, x.seen_at, x.done_at]), [
    ['יואב', '-2 + 7', '', 1, null, null],
    ['דנה', '3 - 8', 'לא הבנתי', 0, null, null],
  ]);
  assert.ok(!('image' in d.help[0]));
  assert.equal(d.exams.length, 1);
  const { at, id, ...exam } = d.exams[0];
  assert.ok(id && at.startsWith('2026-11-12'));
  assert.deepEqual(exam, {
    studentId: noa.studentId, name: 'נועה', title: 'מבחן בשברים', correct: 3, total: 5, weak: ['signed'],
    questions: [{ topic: 'signed', status: 'correct', skill: 'חיבור', level: 2 }, { topic: 'other', status: 'missing', skill: 'x'.repeat(60), level: 0 }],
  });
  assert.doesNotMatch(JSON.stringify(d), /זר|1 - 9/, 'nothing from the other class');
  assert.equal((await h.call('GET', '/api/teacher/dashboard')).status, 401);
  assert.equal((await h.call('GET', '/api/teacher/dashboard', { headers: { ...cls.teacher, 'X-Teacher-Key': other.teacherKey } })).status, 401, 'another class\'s key');
});

test('TEACHER-16: one id on two stairs is two rows, each with its stair and its own students, on the board, the report and the student page', async () => {
  h = await setup();
  pinClock();
  const cls = await makeClass(h, { students: ['דנה', 'יואב', 'נועה'] });
  const [dana, yoav, noa] = cls.students;
  const wrong = (level, cat, at) => ({ ...ev('signed', at, { ok: false, cat }), level });
  // 'sign' at signed:1 (דנה, יואב) and at signed:3 (דנה twice, נועה); 'direction' at signed:1 (יואב)
  await progress(dana, { events: [wrong(1, 'sign', '2026-11-12T07:00:00Z'), wrong(3, 'sign', '2026-11-12T07:01:00Z'), wrong(3, 'sign', '2026-11-12T07:02:00Z')] });
  await progress(yoav, { events: [wrong(1, 'sign', '2026-11-11T07:00:00Z'), wrong(1, 'direction', '2026-11-11T07:01:00Z')] });
  await progress(noa, { events: [wrong(3, 'sign', '2026-11-10T07:00:00Z')] });
  const d = await dashboardOf(cls);
  const ids = (...s) => s.map((x) => x.studentId).sort();
  assert.deepEqual(d.mistakes.map((m) => ({ ...m, ids: [...m.ids].sort() })), [
    { topic: 'signed', level: 3, cat: 'sign', n: 3, students: 2, ids: ids(dana, noa), names: ['דנה', 'נועה'] },
    { topic: 'signed', level: 1, cat: 'sign', n: 2, students: 2, ids: ids(dana, yoav), names: ['דנה', 'יואב'] },
    { topic: 'signed', level: 1, cat: 'direction', n: 1, students: 1, ids: ids(yoav), names: ['יואב'] },
  ]);
  // the report has the same rows (names only), and each student's own mistakes per stair
  const r = await (await h.call('GET', '/api/teacher/report?from=2026-11-06&to=2026-11-12', { headers: cls.teacher })).json();
  assert.deepEqual(r.mistakes, d.mistakes.map(({ ids: _, ...m }) => m));
  assert.deepEqual(r.students.find((s) => s.name === 'דנה').topMistakes, [
    { topic: 'signed', cat: 'sign', level: 3, n: 2 }, { topic: 'signed', cat: 'sign', level: 1, n: 1 },
  ]);
  const page = await (await h.call('GET', `/api/teacher/students/${dana.studentId}`, { headers: cls.teacher })).json();
  assert.deepEqual(page.mistakes.map((m) => [m.topic, m.level, m.cat, m.n]), [['signed', 3, 'sign', 2], ['signed', 1, 'sign', 1]]);
});

test('asking for help twice on one exercise gives one request with the newest note and page; a done one opens a new request', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['דנה'] });
  const [dana] = cls.students;
  assert.deepEqual(await (await askHelpL1(dana, { question: '3 - 8', note: 'לא הבנתי', answer: '5' })).json(), { ok: true });
  // again, without a note: the first note stays; the page and the latest answer arrive
  assert.deepEqual(await (await askHelpL1(dana, { question: '3 - 8', note: '', answer: '11', image: PAGE })).json(), { ok: true, again: true });
  let all = rows(h.env, 'SELECT * FROM help_requests WHERE student_id = ?', dana.studentId);
  assert.equal(all.length, 1);
  assert.equal(all[0].note, 'לא הבנתי'); assert.equal(all[0].answer, '11'); assert.equal(all[0].image, PAGE);
  // again, with a new note and no page: the newest note, and the page is kept
  await askHelpL1(dana, { question: '3 - 8', note: 'עדיין לא' });
  all = rows(h.env, 'SELECT * FROM help_requests WHERE student_id = ?', dana.studentId);
  assert.equal(all.length, 1); assert.equal(all[0].note, 'עדיין לא'); assert.equal(all[0].image, PAGE);
  // another exercise is another request
  await askHelpL1(dana, { question: '-4 - 4' });
  assert.equal(rows(h.env, 'SELECT * FROM help_requests WHERE student_id = ?', dana.studentId).length, 2);
  // once the teacher marks it done, the same exercise opens a new request
  await h.call('POST', `/api/teacher/help/${all[0].id}`, { headers: cls.teacher, body: { action: 'done' } });
  assert.deepEqual(await (await askHelpL1(dana, { question: '3 - 8' })).json(), { ok: true });
  assert.equal(rows(h.env, "SELECT * FROM help_requests WHERE student_id = ? AND question = '3 - 8'", dana.studentId).length, 2);
  // at most 10 open requests per student
  for (let i = 0; i < 8; i += 1) assert.equal((await askHelpL1(dana, { question: `q${i}` })).status, 200);
  const r = await askHelpL1(dana, { question: 'one more' });
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'too_many_open');
  assert.equal((await h.call('POST', '/api/help', { body: { question: '3 - 8' } })).status, 401, 'students only');
});

test('help requests: seen keeps its first time, done, reopen; another class cannot touch them; done ones leave the board after 7 days', async () => {
  h = await setup();
  pinClock();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  await askHelpL1(dana, { question: '3 - 8' });
  await askHelpL1(yoav, { question: '-2 + 7' });
  const [a, b] = rows(h.env, 'SELECT id FROM help_requests ORDER BY id').map((r) => r.id);
  const mark = (id, action, headers = cls.teacher) => h.call('POST', `/api/teacher/help/${id}`, { headers, body: { action } });
  const row = (id) => ({ ...one(h.env, 'SELECT seen_at, done_at FROM help_requests WHERE id = ?', id) });
  assert.deepEqual(await (await mark(a, 'seen')).json(), { ok: true });
  const seen = row(a).seen_at;
  assert.match(seen, /^2026-11-12T08:/);
  advanceClock(60 * 60_000);
  await mark(a, 'seen');
  assert.equal(row(a).seen_at, seen, 'seen twice keeps the first time');
  await mark(a, 'done');
  assert.match(row(a).done_at, /^2026-11-12T09:/);
  await mark(a, 'reopen');
  assert.deepEqual(row(a), { seen_at: seen, done_at: null }, 'reopened, still seen');
  assert.equal((await mark(a, 'delete')).status, 400);
  assert.equal((await mark(a, 'done', {})).status, 401);
  // another class's teacher: the answer is the same, and nothing changes
  const other = await makeClass(h);
  assert.equal((await mark(b, 'done', other.teacher)).status, 200);
  assert.deepEqual(row(b), { seen_at: null, done_at: null });
  // a done request stays on the board for 7 days; an open one stays however old it is
  await mark(a, 'done');
  advanceClock(6 * DAY);
  assert.deepEqual((await dashboardOf(cls)).help.map((x) => x.id).sort(), [a, b].sort());
  advanceClock(2 * DAY);
  assert.deepEqual((await dashboardOf(cls)).help.map((x) => x.id), [b]);
});

test('the notebook page: only for its own class (another class gets 404), 404 without a page, never in the dashboard', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['דנה'] });
  const other = await makeClass(h, { students: ['זר'] });
  await askHelpL1(cls.students[0], { question: '3 - 8', image: PAGE });
  await askHelpL1(cls.students[0], { question: '-4 - 4' });
  await askHelpL1(other.students[0], { question: '1 - 9', image: PAGE });
  const id = (q) => one(h.env, 'SELECT id FROM help_requests WHERE question = ?', q).id;
  const image = (helpId, headers = cls.teacher) => h.call('GET', `/api/teacher/help/${helpId}/image`, { headers });
  assert.deepEqual(await (await image(id('3 - 8'))).json(), { image: PAGE });
  const none = await image(id('-4 - 4'));
  assert.equal(none.status, 404); assert.equal((await none.json()).error, 'not_found');
  assert.equal((await image(id('3 - 8'), other.teacher)).status, 404, 'another class\'s teacher');
  assert.equal((await image(id('1 - 9'))).status, 404, 'a page from another class');
  assert.equal((await image(999999)).status, 404);
  assert.equal((await image(id('3 - 8'), {})).status, 401);
  assert.doesNotMatch(JSON.stringify(await dashboardOf(cls)), /base64/);
});

test('resetting a PIN: the old token and the old PIN stop working, the wrong-PIN count clears, the student chooses a new PIN, even in a locked class', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  const join = (name, pin) => h.call('POST', `/api/classes/${cls.code}/join`, { body: { name, pin } });
  // three wrong PINs today
  for (let i = 0; i < 3; i += 1) assert.equal((await join('דנה', '0000')).status, 403);
  assert.equal(one(h.env, 'SELECT count FROM ai_usage WHERE who = ?', `pin:${dana.studentId}`).count, 3);
  // another class's teacher: the answer is the same, and nothing changes
  const other = await makeClass(h);
  assert.deepEqual(await (await h.call('POST', `/api/teacher/students/${dana.studentId}/reset-pin`, { headers: other.teacher, body: {} })).json(), { ok: true });
  assert.equal((await progress(dana, { events: [] })).status, 200, 'still signed in');
  assert.equal((await dashboardOf(cls)).students[0].pinReset, false);
  assert.equal((await h.call('POST', `/api/teacher/students/${dana.studentId}/reset-pin`, { body: {} })).status, 401);
  // the teacher locks the class, then resets
  await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: true } });
  assert.deepEqual(await (await h.call('POST', `/api/teacher/students/${dana.studentId}/reset-pin`, { headers: cls.teacher, body: {} })).json(), { ok: true });
  assert.equal((await progress(dana, { events: [] })).status, 401, 'the old token stops working');
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage WHERE who = ?', `pin:${dana.studentId}`).length, 0, 'the wrong-PIN count is cleared');
  const d = await dashboardOf(cls);
  assert.deepEqual(d.students.map((s) => [s.name, s.pinReset]), [['דנה', true], ['יואב', false]]);
  // she comes back under her name with a new PIN (the lock is for new names only)
  const back = await join('דנה', '5678');
  assert.equal(back.status, 200);
  const again = await back.json();
  assert.equal(again.studentId, dana.studentId); assert.equal(again.returning, true);
  assert.equal((await progress(again, { events: [] })).status, 200);
  assert.equal((await dashboardOf(cls)).students[0].pinReset, false);
  assert.equal((await join('דנה', '1234')).status, 403, 'the old PIN is wrong now');
  assert.equal((await join('דנה', '5678')).status, 200);
  assert.equal((await progress(yoav, { events: [] })).status, 200, 'the other student is not touched');
});

test('the join lock is per class: locking one class leaves another open', async () => {
  h = await setup();
  const a = await makeClass(h, { students: ['דנה'] });
  const b = await makeClass(h);
  await h.call('POST', '/api/teacher/class/lock', { headers: a.teacher, body: { locked: true } });
  assert.equal((await h.call('POST', `/api/classes/${a.code}/join`, { body: { name: 'יואב', pin: '1111' } })).status, 403);
  assert.equal((await h.call('POST', `/api/classes/${b.code}/join`, { body: { name: 'יואב', pin: '1111' } })).status, 200);
  assert.equal((await dashboardOf(b)).joinLocked, false);
  // locking twice and unlocking twice are both fine
  assert.equal((await h.call('POST', '/api/teacher/class/lock', { headers: a.teacher, body: { locked: true } })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM class_locks WHERE class_code = ?', a.code).length, 1);
  await h.call('POST', '/api/teacher/class/lock', { headers: a.teacher, body: { locked: false } });
  assert.equal((await h.call('POST', '/api/teacher/class/lock', { headers: a.teacher, body: { locked: false } })).status, 200);
  assert.equal((await h.call('POST', `/api/classes/${a.code}/join`, { body: { name: 'יואב', pin: '1111' } })).status, 200);
  assert.deepEqual(rows(h.env, "SELECT action FROM audit_log WHERE action = 'class.lock'").length, 4, 'every change is audited');
});

test('renaming a class: the teacher only, a cleaned name, an audit row without the name; an empty name is 400', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const other = await makeClass(h);
  const rename = (className, headers = cls.teacher) => h.call('POST', '/api/teacher/class/rename', { headers, body: { className } });
  const r = await rename('  ז׳3   מתמטיקה  מורחבת ');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, className: 'ז׳3 מתמטיקה מורחבת' });
  assert.equal((await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json()).class.name, 'ז׳3 מתמטיקה מורחבת');
  assert.equal((await (await h.call('GET', `/api/classes/${cls.code}`)).json()).className, 'ז׳3 מתמטיקה מורחבת', 'students joining see the new name');
  const audit = rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'class.rename'").map((x) => ({ ...x }));
  assert.deepEqual(audit, [{ actor: `teacher:${cls.code}`, target: `class:${cls.code}`, detail: '{}' }]);
  const empty = await rename('   ');
  assert.equal(empty.status, 400); assert.equal((await empty.json()).error, 'missing_fields');
  const notMine = await rename('שלי', { 'X-Class-Code': cls.code, 'X-Teacher-Key': other.teacherKey });
  assert.equal(notMine.status, 401); assert.equal((await notMine.json()).error, 'not_teacher');
  assert.equal(one(h.env, 'SELECT name FROM classes WHERE code = ?', cls.code).name, 'ז׳3 מתמטיקה מורחבת');
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'class.rename'").length, 1);
});

test('deleting a class bound to an email: the key alone is 403 not_owner, an older sign-in 401 reauth_needed, a fresh code deletes it', async () => {
  h = await setup();
  let t = await signIn(h, 'teacher@example.test');
  const stranger = await signIn(h, 'other@example.test');
  const c = await (await h.call('POST', '/api/classes', { body: { className: 'ז׳3', teacherName: 'רונית', grade: '7' }, headers: { 'X-Account-Token': t } })).json();
  assert.equal(c.owned, true);
  await h.call('POST', `/api/classes/${c.code}/join`, { body: { name: 'נועה', pin: '1234' } });
  const key = { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey };
  const del = (headers) => h.call('POST', '/api/teacher/class/delete', { headers, body: { confirm: 'DELETE' } });
  const errorOf = async (res) => [res.status, (await res.json()).error];
  assert.deepEqual(await errorOf(await del(key)), [403, 'not_owner'], 'a co-teacher with the key');
  assert.deepEqual(await errorOf(await del({ ...key, 'X-Account-Token': stranger })), [403, 'not_owner'], 'the key with another account');
  advanceClock(11 * 60_000);
  assert.deepEqual(await errorOf(await del({ 'X-Class-Code': c.code, 'X-Account-Token': t })), [401, 'reauth_needed'], 'a sign-in older than 10 minutes');
  assert.ok(one(h.env, 'SELECT * FROM classes WHERE code = ?', c.code), 'nothing was deleted');
  t = await signIn(h, 'teacher@example.test', { 'X-Account-Token': t });
  const r = await del({ 'X-Class-Code': c.code, 'X-Account-Token': t });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, students: 1 });
  assert.equal(rows(h.env, 'SELECT * FROM classes WHERE code = ?', c.code).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM class_owners WHERE class_code = ?', c.code).length, 0);
  assert.deepEqual(rows(h.env, "SELECT detail FROM audit_log WHERE action = 'class.delete'").map((x) => JSON.parse(x.detail)), [{ students: 1, via: 'account' }]);
  assert.equal((await (await h.call('GET', '/api/teacher/classes', { headers: { 'X-Account-Token': t } })).json()).classes.length, 0, "gone from the teacher's list");
});
