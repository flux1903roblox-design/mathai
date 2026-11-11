// The teacher's side of a class: the dashboard against D1 (practice today and this week, first-try, mistakes with names,
// help requests and exams), help requests (one per exercise, seen/done/reopen, the notebook page), resetting a PIN, the
// join lock and removing a student, and class licences (spec §5.4, §6.8): the licence card, requests for a trial or a
// quote, school licence codes. Claude and the email service are stubbed; every name and address is synthetic.
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
  const cls = await makeClass(h, { ai: true, students: ['נועה'] });
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
  const cls = await makeClass(h, { ai: true, students: ['נועה'] });
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
  const a = await makeClass(h, { ai: true, students: ['נועה'] });
  const b = await makeClass(h, { ai: true });
  const c = await makeClass(h, { ai: true });
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

test('a Gefen order\'s code (grant-school --gefen): the class that claims it carries the order in its licence\'s note', async () => {
  h = await setup();
  const code = 'GFNA-BCDE-FGHJ';
  h.env.DB.raw.exec(build('grant-school', { classes: '1', seats: '30', until: '2099-08-31', invoice: 'INV-77', gefen: '778899' }, { code }).sql);
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
  const cls = await makeClass(h, { ai: true });
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
  const cls = await makeClass(h, { ai: true, students: ['נועה', 'איתי', 'מאיה'] });
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

// ---------------------------------------------------------------- the dashboard and help, against D1
// A fixed "now": Thursday 12 November 2026, 10:00 in Jerusalem (UTC+2). The week is 6 to 12 November.
const NOW = Date.parse('2026-11-12T08:00:00Z');
const pinClock = () => advanceClock(NOW - Date.now());
const ev = (topic, at, { ok = true, first = ok, cat = null, secs = 30 } = {}) => ({ topic, level: 1, ok, first, hint: false, cat, secs, at });
const dashboardOf = async (cls) => (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
const progress = (s, body) => h.call('POST', '/api/progress', { headers: bearer(s), body });
const askHelp = (s, body) => h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 1, answer: '5', ...body } });
const PAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

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
  advanceClock(60_000); await askHelp(dana, { question: '3 - 8', note: 'לא הבנתי' });
  advanceClock(60_000); await askHelp(yoav, { question: '-2 + 7', image: PAGE });
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
  assert.deepEqual(await (await askHelp(dana, { question: '3 - 8', note: 'לא הבנתי', answer: '5' })).json(), { ok: true });
  // again, without a note: the first note stays; the page and the latest answer arrive
  assert.deepEqual(await (await askHelp(dana, { question: '3 - 8', note: '', answer: '11', image: PAGE })).json(), { ok: true, again: true });
  let all = rows(h.env, 'SELECT * FROM help_requests WHERE student_id = ?', dana.studentId);
  assert.equal(all.length, 1);
  assert.equal(all[0].note, 'לא הבנתי'); assert.equal(all[0].answer, '11'); assert.equal(all[0].image, PAGE);
  // again, with a new note and no page: the newest note, and the page is kept
  await askHelp(dana, { question: '3 - 8', note: 'עדיין לא' });
  all = rows(h.env, 'SELECT * FROM help_requests WHERE student_id = ?', dana.studentId);
  assert.equal(all.length, 1); assert.equal(all[0].note, 'עדיין לא'); assert.equal(all[0].image, PAGE);
  // another exercise is another request
  await askHelp(dana, { question: '-4 - 4' });
  assert.equal(rows(h.env, 'SELECT * FROM help_requests WHERE student_id = ?', dana.studentId).length, 2);
  // once the teacher marks it done, the same exercise opens a new request
  await h.call('POST', `/api/teacher/help/${all[0].id}`, { headers: cls.teacher, body: { action: 'done' } });
  assert.deepEqual(await (await askHelp(dana, { question: '3 - 8' })).json(), { ok: true });
  assert.equal(rows(h.env, "SELECT * FROM help_requests WHERE student_id = ? AND question = '3 - 8'", dana.studentId).length, 2);
  // at most 10 open requests per student
  for (let i = 0; i < 8; i += 1) assert.equal((await askHelp(dana, { question: `q${i}` })).status, 200);
  const r = await askHelp(dana, { question: 'one more' });
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'too_many_open');
  assert.equal((await h.call('POST', '/api/help', { body: { question: '3 - 8' } })).status, 401, 'students only');
});

test('help requests: seen keeps its first time, done, reopen; another class cannot touch them; done ones leave the board after 7 days', async () => {
  h = await setup();
  pinClock();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  await askHelp(dana, { question: '3 - 8' });
  await askHelp(yoav, { question: '-2 + 7' });
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
  await askHelp(cls.students[0], { question: '3 - 8', image: PAGE });
  await askHelp(cls.students[0], { question: '-4 - 4' });
  await askHelp(other.students[0], { question: '1 - 9', image: PAGE });
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
