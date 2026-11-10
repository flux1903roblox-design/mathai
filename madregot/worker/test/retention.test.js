// Class data retention and class deletion (spec TRUST-7, TRUST-6's shared helper): what the night purge removes and
// keeps, by the periods in shared/retention.js; the class's last day of activity, written once a day; the 400-day guard
// on progress uploads; and the teacher deleting a class, proved by a scan of every table. Claude and the email service
// are stubbed; every name and address is synthetic (example.test).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { RETENTION as R } from '../../shared/retention.js';
import { purge, run, PURGE_BATCH } from '../src/cron.js';
import { keyIn, STUDENT_ROWS, studentWhere } from '../src/forget.js';
import { dayOf, jerusalemMidnight } from '../src/util.js';
import { setup, makeClass, bearer, signIn, insertSub, setCount, rows, one, advanceClock } from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const ago = (days, extraMs = 0) => new Date(Date.now() - days * DAY - extraMs).toISOString();
const HOUR = 3600_000;
const raw = () => h.env.DB.raw;
const IMAGE = `data:image/jpeg;base64,${'A'.repeat(64)}`;

/** Every table in the database, as text, for a search (tables other lanes add are scanned too). */
function tablesText() {
  return rows(h.env, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .map(({ name }) => ({ name, rows: rows(h.env, `SELECT * FROM "${name}"`).map((r) => JSON.stringify(r)) }));
}
/** The tables (and rows) that still mention `needle`, leaving out what `skip(table, rowText)` allows. */
function mentions(needle, skip = () => false) {
  return tablesText().flatMap(({ name, rows: list }) => list.filter((r) => r.includes(needle) && !skip(name, r)).map((r) => `${name}: ${r}`));
}

/** A help request written directly, with its dates. */
function help(studentId, { created, done = null, image = IMAGE }) {
  return Number(raw().prepare('INSERT INTO help_requests (student_id, topic, question, image, created_at, done_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(studentId, 'neg', `q${Math.random()}`, image, created, done).lastInsertRowid);
}
/**
 * Student data in every student table, through the API: progress (attempts, levels), a help request with a page and,
 * with the class's `teacher` headers, a reply on it from each side (help_messages, TEACHER-6), an exam.
 */
async function practise(s, teacher = null) {
  await h.call('POST', '/api/progress', { headers: bearer(s), body: { events: [{ topic: 'neg', level: 1, ok: false, first: false, cat: 'sign', secs: 9 }], levels: { neg: { level: 2, max: 2 } } } });
  await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'neg', question: '3 - 8', answer: '5', image: IMAGE } });
  if (teacher) {
    const id = one(h.env, 'SELECT id FROM help_requests WHERE student_id = ? ORDER BY id DESC', s.studentId).id;
    assert.equal((await h.call('POST', `/api/teacher/help/${id}/reply`, { headers: teacher, body: { body: 'נעבור על זה מחר בכיתה' } })).status, 201);
    assert.equal((await h.call('POST', `/api/help/${id}/reply`, { headers: bearer(s), body: { quick: 'thanks' } })).status, 201);
  }
  await h.call('POST', '/api/exams', { headers: bearer(s), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
}
/** The replies of a student's help requests (they carry the request's id, not the student's). */
const messagesOf = (studentId) => rows(h.env, 'SELECT m.* FROM help_messages m JOIN help_requests r ON r.id = m.help_id WHERE r.student_id = ?', studentId);
const orphanMessages = () => rows(h.env, 'SELECT * FROM help_messages WHERE help_id NOT IN (SELECT id FROM help_requests)');
/**
 * The class's assignments (TEACHER-4) through the API: one for the whole class and one naming each student, and each
 * student's work on both. Every student then has rows in assignment_work and assignment_targets.
 */
async function assignWork(cls) {
  const due = dayOf(new Date(Date.now() + 3 * DAY));
  const make = (body) => h.call('POST', '/api/teacher/assignments', { headers: cls.teacher, body: { kind: 'stair', skill: 'signed:1', dueOn: due, ...body } });
  const ids = [(await (await make({})).json()).assignment.id];
  for (const s of cls.students) ids.push((await (await make({ targets: [s.studentId], note: 'לקראת המבחן' })).json()).assignment.id);
  for (const s of cls.students) {
    for (const id of [ids[0], ids[cls.students.indexOf(s) + 1]]) {
      const r = await h.call('POST', `/api/class/work/${id}`, { headers: bearer(s), body: { state: 'started', stage: 1 } });
      assert.equal(r.status, 200);
    }
  }
  return ids;
}
/** The counters a student and a class have, written for today. */
async function counters(studentIds, code) {
  for (const id of studentIds) for (const who of [`pin:${id}`, `s:${id}`, `s:${id}:tutor`, `free:s:${id}`, `care:s:${id}`, `work:s:${id}`, `helpreply:s:${id}`]) await setCount(h.env, who, 1);
  for (const who of [`t:${code}`, `t:${code}:tutor`, `free:t:${code}`, `free:c:${code}`, `cls:${code}`, `licreq:c:${code}`, `licclaim:c:${code}`, `assign:c:${code}`, `report:c:${code}`]) await setCount(h.env, who, 1);
}
/** Make a student, everything of them, and their class look `days` old. */
function age(code, days) {
  raw().prepare('UPDATE classes SET created_at = ? WHERE code = ?').run(ago(days), code);
  raw().prepare('UPDATE students SET created_at = ?, last_seen = ? WHERE class_code = ?').run(ago(days), ago(days), code);
  raw().prepare('UPDATE class_settings SET last_seen = ? WHERE code = ?').run(dayOf(new Date(Date.now() - days * DAY)), code);
}

test('the retention numbers are the ones the privacy wording promises', () => {
  assert.deepEqual({ ...R }, {
    helpImageAfterDone: 30, helpImageMax: 60, helpAfterDone: 180, helpMax: 365, attempts: 400, exams: 400, assignments: 400, idleStudent: 400, idleClass: 400,
  });
  assert.ok(Object.isFrozen(R));
});

test('notebook pages: 30 days after the request is closed, 60 at most; the request itself 180 days after closing, 365 at most', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  const r = {
    done31: help(id, { created: ago(40), done: ago(R.helpImageAfterDone + 1) }),
    done29: help(id, { created: ago(40), done: ago(R.helpImageAfterDone - 1) }),
    open61: help(id, { created: ago(R.helpImageMax + 1) }),
    open59: help(id, { created: ago(R.helpImageMax - 1) }),
    done181: help(id, { created: ago(200), done: ago(R.helpAfterDone + 1) }),
    done179: help(id, { created: ago(200), done: ago(R.helpAfterDone - 1), image: null }),
    open366: help(id, { created: ago(R.helpMax + 1) }),
    open364: help(id, { created: ago(R.helpMax - 1) }),
  };
  await purge(h.env);
  const left = Object.fromEntries(rows(h.env, 'SELECT id, image IS NOT NULL AS page FROM help_requests').map((x) => [x.id, x.page]));
  assert.equal(left[r.done31], 0, 'a page closed 31 days ago is gone');
  assert.equal(left[r.done29], 1, 'a page closed 29 days ago stays');
  assert.equal(left[r.open61], 0, 'an open request sent 61 days ago loses its page');
  assert.equal(left[r.open59], 1, 'an open request sent 59 days ago keeps it');
  assert.equal(left[r.done181], undefined, 'a request closed 181 days ago is gone');
  assert.equal(left[r.done179], 0, 'a request closed 179 days ago stays (without its page)');
  assert.equal(left[r.open366], undefined, 'an open request sent 366 days ago is gone');
  assert.equal(left[r.open364], 0, 'one sent 364 days ago stays, without its page');
});

test('attempts and exams are kept 400 days; an upload of answers older than that is skipped', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const ev = (days) => ({ topic: 'neg', level: 1, ok: true, first: true, secs: 5, at: ago(days) });
  const res = await (await h.call('POST', '/api/progress', { headers: bearer(noa), body: { events: [ev(R.attempts - 1), ev(R.attempts + 1), ev(2)] } })).json();
  assert.deepEqual(res, { saved: 2 }, 'the 401-day-old answer is not stored again');
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 2);
  raw().prepare('INSERT INTO attempts (student_id, topic, level, ok, first_try, hint, day, at) VALUES (?, ?, 1, 1, 1, 0, ?, ?)')
    .run(noa.studentId, 'neg', '2025-01-01', ago(R.attempts + 1));
  for (const d of [R.exams + 1, R.exams - 1]) {
    raw().prepare("INSERT INTO exams (student_id, title, correct, total, questions, weak, created_at) VALUES (?, 'מבחן', 1, 2, '[]', '[]', ?)").run(noa.studentId, ago(d));
  }
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 3);
  await purge(h.env);
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 2, 'the 399-day-old and the new answer stay');
  assert.equal(rows(h.env, 'SELECT * FROM attempts WHERE at < ?', ago(R.attempts)).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM exams').length, 1, 'the 399-day-old exam stays');
  assert.equal(rows(h.env, 'SELECT * FROM exams WHERE created_at < ?', ago(R.exams)).length, 0);
});

test('a student nobody has seen for 400 days is deleted with all their rows and counters; one seen 399 days ago stays', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  for (const s of cls.students) await practise(s, cls.teacher);
  await assignWork(cls);
  await counters([noa.studentId, itai.studentId], cls.code);
  const noaMessages = messagesOf(noa.studentId).length;
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(R.idleStudent, HOUR), noa.studentId);
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(R.idleStudent - 1), itai.studentId);
  const report = await purge(h.env);
  assert.equal(report.class.students, 1);
  assert.deepEqual(mentions(noa.studentId), [], 'nothing of her is left in any table');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM students WHERE id = ?', itai.studentId).n, 1);
  for (const row of STUDENT_ROWS) assert.ok(rows(h.env, `SELECT * FROM ${row[0]} WHERE ${studentWhere(row, '= ?')}`, itai.studentId).length > 0, `${row[0]} of the other student stays`);
  assert.equal(noaMessages, 2);
  assert.deepEqual(orphanMessages(), [], 'the replies on her requests went with them');
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE ?", `%${itai.studentId}%`).length, 7, 'his counters stay');
  assert.equal(rows(h.env, 'SELECT * FROM assignments WHERE class_code = ?', cls.code).length, 3, "the class's assignments stay");
  assert.ok(one(h.env, 'SELECT * FROM classes WHERE code = ?', cls.code), 'the class stays');
});

test('counter keys are matched whole: one id is never taken for the start of another', () => {
  const sql = `SELECT who FROM ai_usage WHERE ${keyIn('s:', "SELECT 'ab12'")} ORDER BY who`;
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE ai_usage (who TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (who, day))');
  for (const who of ['s:ab12', 's:ab12:tutor', 's:ab12:check:tries', 's:ab123', 's:ab123:tutor', 'free:s:ab12', 's:ab1', 'solo:n:ab12']) {
    db.prepare("INSERT INTO ai_usage VALUES (?, '2026-11-10', 1)").run(who);
  }
  assert.deepEqual(db.prepare(sql).all().map((r) => r.who), ['s:ab12', 's:ab12:check:tries', 's:ab12:tutor']);
  assert.throws(() => keyIn("s'; DROP TABLE x; --", 'SELECT 1'), /bad counter prefix/);
});

test('a class idle for 400 days with no running licence is deleted from every table; activity or a licence keeps a class', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  // A: owned, locked, rekeyed (a notice and audit rows), students with everything, counters; idle 401 days
  const a = await (await h.call('POST', '/api/classes', { body: { className: 'ז׳1', teacherName: 'רונית', grade: '7' }, headers: { 'X-Account-Token': t } })).json();
  const aTeacher = { 'X-Class-Code': a.code, 'X-Teacher-Key': a.teacherKey };
  const aStudents = [];
  for (const name of ['נועה', 'איתי']) aStudents.push(await (await h.call('POST', `/api/classes/${a.code}/join`, { body: { name, pin: '1234' } })).json());
  for (const s of aStudents) await practise(s, aTeacher);
  await assignWork({ teacher: aTeacher, students: aStudents });
  await counters(aStudents.map((s) => s.studentId), a.code);
  await h.call('POST', '/api/teacher/class/lock', { headers: aTeacher, body: { locked: true } });
  await h.call('GET', '/api/teacher/dashboard', { headers: aTeacher });
  assert.equal((await h.call('POST', '/api/teacher/class/rekey', { headers: { 'X-Class-Code': a.code, 'X-Account-Token': t }, body: {} })).status, 200);
  await h.ctx.flush();
  assert.equal(one(h.env, 'SELECT last_seen FROM class_settings WHERE code = ?', a.code).last_seen, dayOf());
  age(a.code, R.idleClass + 1);
  // B: made long ago, but its teacher looked at it today
  const b = await makeClass(h, { students: ['דנה'] });
  age(b.code, R.idleClass + 1);
  raw().prepare('INSERT INTO class_settings (code, last_seen) VALUES (?, ?)').run(b.code, dayOf());
  // C: made long ago, no row in class_settings, one student seen 10 days ago
  const c = await makeClass(h, { students: ['יואב', 'רוני'] });
  age(c.code, R.idleClass + 1);
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(10), c.students[0].studentId);
  // D: idle, with a licence that still runs; E: idle, its licence ended long ago (the subscription keeps the code)
  const d = await makeClass(h, { students: ['שירה'] });
  age(d.code, R.idleClass + 1);
  insertSub(h.env, { kind: 'class', class_code: d.code, status: 'canceled' });
  const e = await makeClass(h);
  age(e.code, R.idleClass + 1);
  insertSub(h.env, { kind: 'class', class_code: e.code, status: 'ended', start: ago(800), end: ago(500) });
  // F: idle for 399 days only
  const f = await makeClass(h);
  age(f.code, R.idleClass - 1);

  const report = await purge(h.env);
  assert.equal(report.class.classes, 2, 'A and E');
  const codes = rows(h.env, 'SELECT code FROM classes ORDER BY code').map((x) => x.code);
  assert.deepEqual(codes, [b.code, c.code, d.code, f.code].sort());
  assert.deepEqual(mentions(a.code, (table) => ['subscriptions', 'licence_requests'].includes(table)), [], 'nothing of class A is left');
  assert.equal(rows(h.env, 'SELECT * FROM assignments').length, 0, "class A's assignments went with it");
  for (const s of aStudents) assert.deepEqual(mentions(s.studentId), [], `nothing of ${s.name} is left`);
  assert.deepEqual(mentions(e.code, (table) => table === 'subscriptions'), []);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions WHERE class_code = ?', e.code).length, 1, 'the ended licence keeps its row');
  assert.equal(rows(h.env, 'SELECT * FROM students WHERE class_code = ?', c.code).length, 1, 'C: the idle student goes, the class and the active one stay');
  assert.equal(rows(h.env, 'SELECT * FROM students WHERE class_code = ?', b.code).length, 0, 'B: its idle student goes, the class stays');
  assert.equal(rows(h.env, 'SELECT * FROM students WHERE class_code = ?', d.code).length, 0, "D: the licence keeps the class, not an idle student");
  assert.ok(one(h.env, 'SELECT * FROM accounts WHERE email = ?', 'teacher@example.test'), "the teacher's account is not the class's to delete");
});

test('the night purge runs in batches of 2000 rows, goes on until done, and reports its counts', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  const ins = raw().prepare('INSERT INTO attempts (student_id, topic, level, ok, first_try, hint, day, at) VALUES (?, ?, 1, 1, 1, 0, ?, ?)');
  raw().exec('BEGIN');
  for (let i = 0; i < PURGE_BATCH + 500; i++) ins.run(id, 'neg', '2025-01-01', ago(R.attempts + 2, i));
  ins.run(id, 'neg', dayOf(), ago(1));
  raw().exec('COMMIT');
  help(id, { created: ago(R.helpImageMax + 1) });
  const night = new Date(jerusalemMidnight(dayOf()).ms + 3 * HOUR + 10 * 60_000);
  const report = await run(h.env, { now: night });
  assert.equal(report.purge.class.attempts, PURGE_BATCH + 500);
  assert.equal(report.purge.class.helpImages, 1);
  assert.deepEqual(Object.keys(report.purge.class).sort(), ['assignments', 'attempts', 'classes', 'exams', 'help', 'helpImages', 'helpMessages', 'students']);
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 1);
});

test("the class's last day of activity is written once a day, by the dashboard and by each kind of student activity", async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const changed = [];
  const batch = h.env.DB.batch;
  h.env.DB.batch = async (list) => {
    const out = await batch(list);
    list.forEach((st, i) => { if (st.sql.includes('INSERT INTO class_settings')) changed.push(out[i].meta.changes); });
    return out;
  };
  const progress = () => h.call('POST', '/api/progress', { headers: bearer(noa), body: { events: [{ topic: 'neg', level: 1, ok: true, first: true, secs: 5 }] } });
  assert.equal(rows(h.env, 'SELECT * FROM class_settings').length, 0, 'a new class has no row');
  await progress(); await progress();
  assert.deepEqual(changed, [1, 0], 'two uploads on one day write one row');
  assert.deepEqual({ ...one(h.env, 'SELECT * FROM class_settings WHERE code = ?', cls.code) }, {
    code: cls.code, setting: 'school', student_ai: 'off', ai_consent_at: null, private_attested_at: null, last_seen: dayOf(),
  });
  await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'neg', question: '3 - 8', answer: '5' } });
  await h.call('POST', '/api/exams', { headers: bearer(noa), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
  assert.deepEqual(changed, [1, 0, 0, 0]);
  advanceClock(DAY);
  await h.call('POST', '/api/exams', { headers: bearer(noa), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
  assert.deepEqual(changed, [1, 0, 0, 0, 1], 'the next day, once more');
  assert.equal(one(h.env, 'SELECT last_seen FROM class_settings').last_seen, dayOf());
  raw().prepare('UPDATE class_settings SET last_seen = ?').run('2025-01-01');
  await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher });
  assert.equal(one(h.env, 'SELECT last_seen FROM class_settings').last_seen, dayOf(), "the teacher's dashboard counts too");
});

test('deleting a class: confirm needed, not while a licence runs, then every table is free of its students and its code', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי', 'מיה'] });
  const other = await makeClass(h, { students: ['דנה'] });
  for (const s of cls.students) await practise(s, cls.teacher);
  for (const s of other.students) await practise(s, other.teacher);
  await assignWork(cls); await assignWork(other);
  await counters(cls.students.map((s) => s.studentId), cls.code);
  await counters(other.students.map((s) => s.studentId), other.code);
  await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: true } });
  await h.call('POST', '/api/teacher/class/rename', { headers: cls.teacher, body: { className: 'ז׳4' } });
  await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher });
  // one student removed earlier: her audit row names her id
  const mia = cls.students[2];
  await h.call('POST', `/api/teacher/students/${mia.studentId}/remove`, { headers: cls.teacher, body: {} });
  const del = (body, headers = cls.teacher) => h.call('POST', '/api/teacher/class/delete', { headers, body });
  assert.equal((await del({}, {})).status, 401, 'the teacher key is needed');
  const noConfirm = await del({});
  assert.equal(noConfirm.status, 400); assert.equal((await noConfirm.json()).error, 'confirm_required');
  assert.equal((await del({ confirm: 'delete' })).status, 400, 'the word exactly');
  assert.equal((await del({ confirm: 'DELETE' }, { 'X-Class-Code': cls.code, 'X-Teacher-Key': other.teacherKey })).status, 401, "another class's key");
  assert.ok(one(h.env, 'SELECT * FROM classes WHERE code = ?', cls.code));
  const sub = insertSub(h.env, { kind: 'class', class_code: cls.code, plan: 'trial' });
  const busy = await del({ confirm: 'DELETE' });
  assert.equal(busy.status, 409); assert.equal((await busy.json()).error, 'class_has_licence');
  raw().prepare("UPDATE subscriptions SET status = 'ended' WHERE id = ?").run(sub.id);
  const r = await del({ confirm: 'DELETE' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, students: 2 });
  for (const s of cls.students) assert.deepEqual(mentions(s.studentId), [], `nothing of ${s.name} is left`);
  assert.deepEqual(orphanMessages(), [], 'the replies on their help requests went with them');
  assert.equal(messagesOf(other.students[0].studentId).length, 2, "the other class's replies stay");
  for (const t of ['assignments', 'assignment_targets', 'assignment_work']) {
    assert.equal(rows(h.env, `SELECT * FROM ${t} WHERE ${t === 'assignments' ? 'class_code' : 'assignment_id IN (SELECT id FROM assignments WHERE class_code = ?)'} ${t === 'assignments' ? '= ?' : ''}`, cls.code).length, 0, `${t} of the class`);
  }
  assert.equal(rows(h.env, 'SELECT * FROM assignments WHERE class_code = ?', other.code).length, 2, "the other class's assignments stay");
  assert.deepEqual(mentions(cls.code, (table, row) => table === 'subscriptions' || (table === 'audit_log' && row.includes('"class.delete"'))), []);
  const audit = rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'class.delete'").map((x) => ({ ...x }));
  assert.deepEqual(audit.find((x) => x.target === `class:${cls.code}`), { actor: `teacher:${cls.code}`, target: `class:${cls.code}`, detail: '{"students":2}' });
  assert.equal((await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).status, 401, 'the key opens nothing any more');
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(cls.students[0]), body: { events: [] } })).status, 401, "the students' tokens stop working");
  assert.equal((await h.call('GET', `/api/classes/${cls.code}`)).status, 404, 'the code is free again');
});

test('the other class keeps everything when one class is deleted', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const other = await makeClass(h, { students: ['דנה'] });
  for (const s of cls.students) await practise(s, cls.teacher);
  for (const s of other.students) await practise(s, other.teacher);
  await assignWork(cls); await assignWork(other);
  await counters(other.students.map((s) => s.studentId), other.code);
  const theirMessages = messagesOf(other.students[0].studentId).length;
  const before = tablesText().map(({ name, rows: list }) => [name, list.filter((x) => x.includes(other.code) || x.includes(other.students[0].studentId)).length]);
  assert.equal((await h.call('POST', '/api/teacher/class/delete', { headers: cls.teacher, body: { confirm: 'DELETE' } })).status, 200);
  const after = tablesText().map(({ name, rows: list }) => [name, list.filter((x) => x.includes(other.code) || x.includes(other.students[0].studentId)).length]);
  assert.deepEqual(after, before);
  assert.equal(messagesOf(other.students[0].studentId).length, theirMessages, 'the other class keeps the replies on its help requests');
  assert.equal(rows(h.env, 'SELECT * FROM help_messages').length, theirMessages, 'and only those are left');
  assert.equal((await h.call('GET', '/api/teacher/dashboard', { headers: other.teacher })).status, 200);
});
