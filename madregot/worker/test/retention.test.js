// Class data retention and class deletion (trust spec TRUST-7, TRUST-6 §1's shared helper): what the night purge removes
// and keeps, by the periods in shared/retention.js; the class's last day of activity, written once a day; the 400-day
// guard on progress uploads; the teacher removing a student or deleting a class, proved by a scan of every table. The
// retention numbers have one home, shared/retention.js: the purge jobs, the privacy page and the teacher's screen read
// them from there, so a number is never written twice. Claude and the email service are stubbed; every name and
// address is synthetic (example.test).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { RETENTION } from '../../shared/retention.js';
import { QUALITY_KEEP_DAYS } from '../src/quality.js';
import { CODE_TTL_MIN, SESSION_IDLE_DAYS } from '../src/account.js';
import { purge, run, PURGE_BATCH } from '../src/cron.js';
import { keyIn, STUDENT_ROWS, STUDENT_COUNTERS, CLASS_COUNTERS } from '../src/forget.js';
import { dayOf, jerusalemMidnight } from '../src/util.js';
import { setup, makeClass, bearer, insertSub, setCount, rows, one, advanceClock } from './helpers.js';

const R = RETENTION;
let h;
afterEach(() => h?.done());
const DAY = 864e5;
const HOUR = 3600_000;
const ago = (days, extraMs = 0) => new Date(Date.now() - days * DAY - extraMs).toISOString();
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
 * Student data in every student table, through the API: progress (attempts, levels), a help request with a page, a
 * "talk with me" request (its help_meta row, TRUST-3), an exam; and the teacher's AI switch for the student
 * (student_ai_off, TRUST-11) with its audit row (student.ai, target student:<id>), written directly.
 */
async function practise(s) {
  await h.call('POST', '/api/progress', { headers: bearer(s), body: { events: [{ topic: 'neg', level: 1, ok: false, first: false, cat: 'sign', secs: 9 }], levels: { neg: { level: 2, max: 2 } } } });
  await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'neg', question: '3 - 8', answer: '5', image: IMAGE } });
  await h.call('POST', '/api/help', { headers: bearer(s), body: { kind: 'talk' } });
  await h.call('POST', '/api/exams', { headers: bearer(s), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
  raw().prepare('INSERT OR IGNORE INTO student_ai_off (student_id, at) VALUES (?, ?)').run(s.studentId, new Date().toISOString());
  raw().prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?, 'teacher:' || class_code, 'student.ai', 'student:' || id, '{"off":true}'
    FROM students WHERE id = ?`).run(new Date().toISOString(), s.studentId);
}
/** help_meta rows whose help request is gone (none may be left behind). */
const orphanMeta = () => rows(h.env, 'SELECT * FROM help_meta WHERE help_id NOT IN (SELECT id FROM help_requests)');
/** The counters a student and a class have (every prefix forget.js lists, and longer keys), written for today. */
const STUDENT_KEYS = (id) => [`pin:${id}`, `pin:${id}:n0123456789abcdef`, `s:${id}`, `s:${id}:tutor`, `free:s:${id}`, `care:s:${id}`, `report:s:${id}`];
const CLASS_KEYS = (code) => [`t:${code}`, `t:${code}:tutor`, `free:t:${code}`, `free:c:${code}`, `cls:${code}`, `care:t:${code}`, `report:t:${code}`, `licreq:c:${code}`, `licclaim:c:${code}`];
async function counters(studentIds, code) {
  for (const id of studentIds) for (const who of STUDENT_KEYS(id)) await setCount(h.env, who, 1);
  for (const who of CLASS_KEYS(code)) await setCount(h.env, who, 1);
}
/** Make a class, its students and their activity look `days` old. */
function age(code, days) {
  raw().prepare('UPDATE classes SET created_at = ? WHERE code = ?').run(ago(days), code);
  raw().prepare('UPDATE students SET created_at = ?, last_seen = ? WHERE class_code = ?').run(ago(days), ago(days), code);
  raw().prepare('UPDATE class_settings SET last_seen = ? WHERE code = ?').run(dayOf(new Date(Date.now() - days * DAY)), code);
}

test('RETENTION holds the numbers of the trust spec (TRUST-1 §4, TRUST-7), and cannot be changed at run time', () => {
  assert.deepEqual({ ...R }, {
    classIdleDays: 400, studentIdleDays: 400, attemptsDays: 400, examsDays: 400, helpImageAfterDoneDays: 30, helpImageMaxDays: 60,
    helpAfterDoneDays: 180, helpMaxDays: 365, accountIdleDays: 730, safetyEventsDays: 400, answerReportsDays: 60,
    licenceRequestAfterHandledDays: 730, licenceCodeAfterExpiryDays: 365, taxYears: 7,
  });
  assert.ok(Object.isFrozen(R));
  assert.throws(() => { 'use strict'; R.accountIdleDays = 1; }, TypeError);
  for (const [k, v] of Object.entries(R)) assert.ok(Number.isInteger(v) && v > 0, k);
  assert.ok(R.helpImageAfterDoneDays <= R.helpImageMaxDays && R.helpAfterDoneDays <= R.helpMaxDays);
});

test('notebook pages: 30 days after the request is closed, 60 at most; the request itself 180 days after closing, 365 at most', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  const r = {
    done31: help(id, { created: ago(40), done: ago(R.helpImageAfterDoneDays + 1) }),
    done29: help(id, { created: ago(40), done: ago(R.helpImageAfterDoneDays - 1) }),
    open61: help(id, { created: ago(R.helpImageMaxDays + 1) }),
    open59: help(id, { created: ago(R.helpImageMaxDays - 1) }),
    done181: help(id, { created: ago(200), done: ago(R.helpAfterDoneDays + 1) }),
    done179: help(id, { created: ago(200), done: ago(R.helpAfterDoneDays - 1), image: null }),
    open366: help(id, { created: ago(R.helpMaxDays + 1) }),
    open364: help(id, { created: ago(R.helpMaxDays - 1) }),
  };
  // the teacher's care mark on a request (TRUST-3) goes with it
  raw().prepare("INSERT INTO help_meta (help_id, kind, care) VALUES (?, 'help', 1)").run(r.done181);
  raw().prepare("INSERT INTO help_meta (help_id, kind, care) VALUES (?, 'help', 1)").run(r.done179);
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
  assert.deepEqual(orphanMeta(), [], 'the gone request took its help_meta row');
  assert.deepEqual(rows(h.env, 'SELECT help_id FROM help_meta').map((x) => x.help_id), [r.done179]);
});

test('attempts and exams are kept 400 days; an uploaded answer older than that is not stored again', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const ev = (days) => ({ topic: 'neg', level: 1, ok: true, first: true, secs: 5, at: ago(days) });
  const res = await (await h.call('POST', '/api/progress', { headers: bearer(noa), body: { events: [ev(R.attemptsDays - 1), ev(R.attemptsDays + 1), ev(2)] } })).json();
  // every answer sent is acknowledged (the app lets go of it), but the 401-day-old one is not stored
  assert.deepEqual(res, { saved: 3 });
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 2);
  assert.equal(rows(h.env, 'SELECT * FROM attempts WHERE at < ?', ago(R.attemptsDays)).length, 0);
  raw().prepare('INSERT INTO attempts (student_id, topic, level, ok, first_try, hint, day, at) VALUES (?, ?, 1, 1, 1, 0, ?, ?)')
    .run(noa.studentId, 'neg', '2025-01-01', ago(R.attemptsDays + 1));
  for (const d of [R.examsDays + 1, R.examsDays - 1]) {
    raw().prepare("INSERT INTO exams (student_id, title, correct, total, questions, weak, created_at) VALUES (?, 'מבחן', 1, 2, '[]', '[]', ?)").run(noa.studentId, ago(d));
  }
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 3);
  await purge(h.env);
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 2, 'the 399-day-old and the new answer stay');
  assert.equal(rows(h.env, 'SELECT * FROM attempts WHERE at < ?', ago(R.attemptsDays)).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM exams').length, 1, 'the 399-day-old exam stays');
  assert.equal(rows(h.env, 'SELECT * FROM exams WHERE created_at < ?', ago(R.examsDays)).length, 0);
});

test('a student nobody has seen for 400 days is deleted with all their rows and counters; one seen 399 days ago stays', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  for (const s of cls.students) await practise(s);
  await counters([noa.studentId, itai.studentId], cls.code);
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(R.studentIdleDays, HOUR), noa.studentId);
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(R.studentIdleDays - 1), itai.studentId);
  const report = await purge(h.env);
  assert.equal(report.class.students, 1);
  assert.deepEqual(mentions(noa.studentId), [], 'nothing of her is left in any table');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM students WHERE id = ?', itai.studentId).n, 1);
  for (const [t, col, via] of STUDENT_ROWS) {
    const where = via === 'help' ? `${col} IN (SELECT id FROM help_requests WHERE student_id = ?)` : via === 'tag' ? `${col} = 'student:' || ?` : `${col} = ?`;
    assert.ok(rows(h.env, `SELECT * FROM ${t} WHERE ${where}`, itai.studentId).length > 0, `${t} of the other student stays`);
  }
  assert.deepEqual(orphanMeta(), [], 'her help_meta rows went with her help requests');
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage WHERE who LIKE ?', `%${itai.studentId}%`).length, STUDENT_KEYS(itai.studentId).length, 'his counters stay');
  assert.ok(one(h.env, 'SELECT * FROM classes WHERE code = ?', cls.code), 'the class stays');
});

test('the teacher removing a student leaves no row with the student in any table, counters included (TRUST-6 §1)', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  for (const s of cls.students) await practise(s);
  await counters([noa.studentId, itai.studentId], cls.code);
  const r = await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} });
  assert.equal(r.status, 200);
  // the teacher's own audit row names the id it removed; nothing else does
  assert.deepEqual(mentions(noa.studentId, (table, row) => table === 'audit_log' && row.includes('"student.remove"')), []);
  assert.deepEqual(orphanMeta(), []);
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage WHERE who LIKE ?', `%${itai.studentId}%`).length, STUDENT_KEYS(itai.studentId).length);
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(noa), body: { events: [] } })).status, 401, 'her token stops working');
});

test('counter keys are matched whole: one id is never taken for the start of another; every prefix is a counter forget.js deletes', () => {
  const sql = `SELECT who FROM ai_usage WHERE ${keyIn('s:', "SELECT 'ab12'")} ORDER BY who`;
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE ai_usage (who TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (who, day))');
  for (const who of ['s:ab12', 's:ab12:tutor', 's:ab12:check:tries', 's:ab123', 's:ab123:tutor', 'free:s:ab12', 's:ab1', 'solo:n:ab12']) {
    db.prepare("INSERT INTO ai_usage VALUES (?, '2026-11-10', 1)").run(who);
  }
  assert.deepEqual(db.prepare(sql).all().map((r) => r.who), ['s:ab12', 's:ab12:check:tries', 's:ab12:tutor']);
  assert.throws(() => keyIn("s'; DROP TABLE x; --", 'SELECT 1'), /bad counter prefix/);
  const prefixOf = (key, list) => list.some((p) => key.startsWith(p));
  for (const k of STUDENT_KEYS('ab12')) assert.ok(prefixOf(k, STUDENT_COUNTERS), k);
  for (const k of CLASS_KEYS('ABC234')) assert.ok(prefixOf(k, CLASS_COUNTERS), k);
});

test('a class idle for 400 days with no running licence is deleted from every table; activity or a licence keeps a class', async () => {
  h = await setup();
  // A: locked, settings, students with everything, counters, the teacher's dashboard; idle 401 days
  const a = await makeClass(h, { students: ['נועה', 'איתי'], setting: 'private' });
  for (const s of a.students) await practise(s);
  await counters(a.students.map((s) => s.studentId), a.code);
  await h.call('POST', '/api/teacher/class/lock', { headers: a.teacher, body: { locked: true } });
  await h.call('GET', '/api/teacher/dashboard', { headers: a.teacher });
  assert.equal(one(h.env, 'SELECT last_seen FROM class_settings WHERE code = ?', a.code).last_seen, dayOf());
  age(a.code, R.classIdleDays + 1);
  // B: made long ago, but its teacher looked at it today
  const b = await makeClass(h, { students: ['דנה'] });
  age(b.code, R.classIdleDays + 1);
  raw().prepare('INSERT INTO class_settings (code, last_seen) VALUES (?, ?)').run(b.code, dayOf());
  // C: made long ago, no row in class_settings, one student seen 10 days ago
  const c = await makeClass(h, { students: ['יואב', 'רוני'] });
  age(c.code, R.classIdleDays + 1);
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(10), c.students[0].studentId);
  // D: idle, with a licence that still runs; E: idle, its licence ended long ago (the subscription keeps the code)
  const d = await makeClass(h, { students: ['שירה'] });
  age(d.code, R.classIdleDays + 1);
  insertSub(h.env, { kind: 'class', class_code: d.code, status: 'canceled' });
  const e = await makeClass(h);
  age(e.code, R.classIdleDays + 1);
  insertSub(h.env, { kind: 'class', class_code: e.code, status: 'ended', start: ago(800), end: ago(500) });
  // F: idle for 399 days only
  const f = await makeClass(h);
  age(f.code, R.classIdleDays - 1);

  const report = await purge(h.env);
  assert.equal(report.class.classes, 2, 'A and E');
  const codes = rows(h.env, 'SELECT code FROM classes ORDER BY code').map((x) => x.code);
  assert.deepEqual(codes, [b.code, c.code, d.code, f.code].sort());
  assert.deepEqual(mentions(a.code, (table) => ['subscriptions', 'licence_requests'].includes(table)), [], 'nothing of class A is left');
  for (const s of a.students) assert.deepEqual(mentions(s.studentId), [], `nothing of ${s.name} is left`);
  assert.deepEqual(orphanMeta(), [], 'no help_meta row is left without its request');
  assert.deepEqual(mentions(e.code, (table) => table === 'subscriptions'), []);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions WHERE class_code = ?', e.code).length, 1, 'the ended licence keeps its row');
  assert.equal(rows(h.env, 'SELECT * FROM students WHERE class_code = ?', c.code).length, 1, 'C: the idle student goes, the class and the active one stay');
  assert.equal(rows(h.env, 'SELECT * FROM students WHERE class_code = ?', b.code).length, 0, 'B: its idle student goes, the class stays');
  assert.equal(rows(h.env, 'SELECT * FROM students WHERE class_code = ?', d.code).length, 0, 'D: the licence keeps the class, not an idle student');
});

test('the night purge runs in batches of 2000 rows, goes on until done, and reports its counts', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  const ins = raw().prepare('INSERT INTO attempts (student_id, topic, level, ok, first_try, hint, day, at) VALUES (?, ?, 1, 1, 1, 0, ?, ?)');
  raw().exec('BEGIN');
  for (let i = 0; i < PURGE_BATCH + 500; i++) ins.run(id, 'neg', '2025-01-01', ago(R.attemptsDays + 2, i));
  ins.run(id, 'neg', dayOf(), ago(1));
  raw().exec('COMMIT');
  help(id, { created: ago(R.helpImageMaxDays + 1) });
  const night = new Date(jerusalemMidnight(dayOf()).ms + 3 * HOUR + 10 * 60_000);
  const report = await run(h.env, { now: night });
  assert.equal(report.purge.class.attempts, PURGE_BATCH + 500);
  assert.equal(report.purge.class.helpImages, 1);
  assert.deepEqual(Object.keys(report.purge.class).sort(), ['attempts', 'classes', 'exams', 'help', 'helpImages', 'students']);
  assert.equal(typeof report.purge.rows, 'number');
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
  assert.equal(rows(h.env, 'SELECT * FROM class_settings').length, 0, 'a new school class has no row');
  await progress(); await progress();
  assert.deepEqual(changed, [1, 0], 'two uploads on one day write one row');
  assert.deepEqual({ ...one(h.env, 'SELECT * FROM class_settings WHERE code = ?', cls.code) }, {
    code: cls.code, setting: 'school', student_ai: 'off', ai_consent_at: null, private_attested_at: null, last_seen: dayOf(),
  }, "the Ministry's safe default stays (TRUST-11): a school class, student AI off");
  await h.call('POST', '/api/help', { headers: bearer(noa), body: { topic: 'neg', question: '3 - 8', answer: '5' } });
  await h.call('POST', '/api/help', { headers: bearer(noa), body: { kind: 'talk' } });
  await h.call('POST', '/api/exams', { headers: bearer(noa), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
  assert.deepEqual(changed, [1, 0, 0, 0, 0]);
  advanceClock(DAY);
  await h.call('POST', '/api/exams', { headers: bearer(noa), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
  assert.deepEqual(changed, [1, 0, 0, 0, 0, 1], 'the next day, once more');
  assert.equal(one(h.env, 'SELECT last_seen FROM class_settings').last_seen, dayOf());
  raw().prepare('UPDATE class_settings SET last_seen = ?').run('2025-01-01');
  await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher });
  assert.equal(one(h.env, 'SELECT last_seen FROM class_settings').last_seen, dayOf(), "the teacher's dashboard counts too");
  // a private group's choices are kept when its day is written
  const p = await makeClass(h, { studentAi: true, students: ['דנה'] });
  await h.call('POST', '/api/progress', { headers: bearer(p.students[0]), body: { events: [] } });
  assert.deepEqual({ ...one(h.env, 'SELECT setting, student_ai, last_seen FROM class_settings WHERE code = ?', p.code) }, { setting: 'private', student_ai: 'on', last_seen: dayOf() });
});

test('deleting a class: confirm needed, not while a licence runs, then every table is free of its students and its code', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי', 'מיה'], setting: 'private' });
  const other = await makeClass(h, { students: ['דנה'] });
  for (const s of [...cls.students, ...other.students]) await practise(s);
  await counters(cls.students.map((s) => s.studentId), cls.code);
  await counters(other.students.map((s) => s.studentId), other.code);
  await h.call('POST', '/api/teacher/class/lock', { headers: cls.teacher, body: { locked: true } });
  await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher });
  // one student removed earlier: her audit row names her id
  const mia = cls.students[2];
  await h.call('POST', `/api/teacher/students/${mia.studentId}/remove`, { headers: cls.teacher, body: {} });
  const del = (body, headers = cls.teacher) => h.call('POST', '/api/teacher/class/delete', { headers, body });
  assert.equal((await del({ confirm: 'DELETE' }, {})).status, 401, 'the teacher key is needed');
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
  assert.deepEqual(orphanMeta(), [], 'no help_meta row is left without its request');
  assert.deepEqual(mentions(cls.code, (table, row) => table === 'subscriptions' || (table === 'audit_log' && row.includes('"class.delete"'))), []);
  const audit = rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'class.delete'").map((x) => ({ ...x }));
  assert.deepEqual(audit, [{ actor: `teacher:${cls.code}`, target: `class:${cls.code}`, detail: '{"students":2}' }]);
  assert.equal((await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).status, 401, 'the key opens nothing any more');
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(cls.students[0]), body: { events: [] } })).status, 401, "the students' tokens stop working");
  assert.equal((await h.call('GET', `/api/classes/${cls.code}`)).status, 404, 'the code is free again');
});

test('the other class keeps everything when one class is deleted', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const other = await makeClass(h, { students: ['דנה'] });
  for (const s of [...cls.students, ...other.students]) await practise(s);
  await counters(other.students.map((s) => s.studentId), other.code);
  const count = () => tablesText().map(({ name, rows: list }) => [name, list.filter((x) => x.includes(other.code) || x.includes(other.students[0].studentId)).length]);
  const before = count();
  assert.equal((await h.call('POST', '/api/teacher/class/delete', { headers: cls.teacher, body: { confirm: 'DELETE' } })).status, 200);
  assert.deepEqual(count(), before);
  assert.equal((await h.call('GET', '/api/teacher/dashboard', { headers: other.teacher })).status, 200);
});

// The privacy page (web/src/content/legal/privacy.md, trust spec Appendix A) quotes these periods to parents and
// teachers. Each sentence is built here from the number the purge uses, so a change in shared/retention.js (or in a
// constant below) fails this test until the page says the same (TRUST-7: "the same numbers in the code, the privacy
// page and the teacher screen").
test('the privacy page quotes the purge\'s own numbers', () => {
  const page = readFileSync(new URL('../../web/src/content/legal/privacy.md', import.meta.url), 'utf8');
  const retention = page.split(/^## /m).find((s) => s.includes('{#retention}'));
  assert.ok(retention, 'privacy.md has its retention section');
  // the four numbers the spec names, as they appear
  for (const n of ['400 יום', '30 יום', '60 יום', '180 יום']) assert.ok(retention.includes(n), n);
  const sentences = [
    `תשובות בתרגול של תלמיד בכיתה, וסיכומי מבחנים: ${R.attemptsDays} יום.`,
    `תלמיד שלא נכנס ${R.studentIdleDays} יום: נמחק, עם כל המידע עליו.`,
    `כיתה שלא הייתה בה פעילות ${R.classIdleDays} יום ואין לה רישיון פעיל: נמחקת, עם כל המידע עליה.`,
    `דף מחברת שנשלח למורה: ${R.helpImageAfterDoneDays} יום אחרי שהמורה סוגר את הבקשה, ולכל היותר ${R.helpImageMaxDays} יום.`,
    `הבקשה עצמה: ${R.helpAfterDoneDays} יום אחרי שנסגרה, ולכל היותר ${R.helpMaxDays} יום.`,
    `ספירות של איך העוזר ענה, ועלות העוזר לכל חשבון או כיתה: ${QUALITY_KEEP_DAYS} יום.`,
    `קוד כניסה במייל: ${CODE_TTL_MIN} דקות. כניסה לחשבון שלא השתמשו בה ${SESSION_IDLE_DAYS} יום: נמחקת.`,
    `חשבון של הורה או מורה שלא נכנסו אליו ${R.accountIdleDays} יום (שנתיים)`,
    `בקשה לרישיון כיתה: ${R.licenceRequestAfterHandledDays} יום אחרי שטיפלנו בה.`,
    `ספירות בטיחות: ${R.safetyEventsDays} יום. תשובה של העוזר שדווחה: ${R.answerReportsDays} יום.`,
  ];
  for (const t of sentences) assert.ok(retention.includes(t), `privacy.md says: ${t}`);
  // the money records: the end of the 7th calendar year after the tax year
  assert.equal(R.taxYears, 7);
  assert.ok(retention.includes('עד סוף השנה השביעית אחרי שנת המס'), 'the tax period as the purge counts it');
  assert.equal(R.accountIdleDays, 730, '"שנתיים" beside the number');
  assert.equal(R.examsDays, R.attemptsDays, 'answers and exam summaries share one sentence');
});
