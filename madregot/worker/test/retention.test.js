// Class data retention and class deletion (trust spec TRUST-7, TRUST-6 §1's shared helper): what the night purge removes
// and keeps, by the periods in shared/retention.js; the class's last day of activity, written once a day; the 400-day
// guard on progress uploads; the teacher removing a student or deleting a class, proved by a scan of every table.
// Claude and the email service are stubbed; every name and address is synthetic (example.test).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RETENTION as R } from '../../shared/retention.js';
import { CODE_TTL_MIN } from '../src/account.js';
import {
  purge, run, PURGE_BATCH, purgeCountersSql, purgeAccountsSql, purgeFamilySql, purgeRecordsSql, purgeSafetySql, purgeReportSql,
  purgeIdentitySql, purgeClassSteps, purgeLongTermSql, idleAccounts, taxCutoffIso, ACCOUNT_PURGE_LIMIT,
} from '../src/cron.js';
import { purgeVaultsSql } from '../src/vault.js';
import { keyIn, STUDENT_ROWS, studentWhere, STUDENT_COUNTERS, CLASS_COUNTERS } from '../src/forget.js';
import { dayOf, monthOf, jerusalemMidnight } from '../src/util.js';
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
 * Student data in every student table, through the API: progress (attempts, levels, a class-goal step: class_steps,
 * STUDENT-4), a help request with a page and,
 * with the class's `teacher` headers, a reply on it from each side (help_messages, TEACHER-6), a "talk with me" request
 * (its help_meta row, TRUST-3), an exam; and the teacher's AI switch for the student (student_ai_off, TRUST-11): through
 * the API with the teacher's headers (its student.ai audit row names the student), else written directly; and the
 * restore code the class kept (vault_escrow, DURABLE-6).
 */
async function practise(s, teacher = null) {
  // with a class-goal step (STUDENT-4: class_steps)
  await h.call('POST', '/api/progress', { headers: bearer(s), body: { events: [{ topic: 'neg', level: 1, ok: false, first: false, cat: 'sign', secs: 9 }], levels: { neg: { level: 2, max: 2 } },
    steps: [{ sid: randomUUID(), pts: 1 }] } });
  await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'neg', question: '3 - 8', answer: '5', image: IMAGE } });
  if (teacher) {
    const id = one(h.env, 'SELECT id FROM help_requests WHERE student_id = ? ORDER BY id DESC', s.studentId).id;
    assert.equal((await h.call('POST', `/api/teacher/help/${id}/reply`, { headers: teacher, body: { body: 'נעבור על זה מחר בכיתה' } })).status, 201);
    assert.equal((await h.call('POST', `/api/help/${id}/reply`, { headers: bearer(s), body: { quick: 'thanks' } })).status, 201);
  }
  await h.call('POST', '/api/help', { headers: bearer(s), body: { kind: 'talk' } });
  await h.call('POST', '/api/exams', { headers: bearer(s), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } });
  // the teacher turns the AI off for the student (TRUST-11: student_ai_off)
  if (teacher) assert.equal((await h.call('POST', `/api/teacher/students/${s.studentId}/ai`, { headers: teacher, body: { off: true } })).status, 200);
  else {
    // ... or written directly, with its audit row (student.ai, target student:<id>)
    raw().prepare('INSERT OR IGNORE INTO student_ai_off (student_id, at) VALUES (?, ?)').run(s.studentId, new Date().toISOString());
    raw().prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?, 'teacher:' || class_code, 'student.ai', 'student:' || id, '{"off":true}'
      FROM students WHERE id = ?`).run(new Date().toISOString(), s.studentId);
  }
  // the restore code the class keeps for the student (DURABLE-6, vault_escrow), written directly: its route needs
  // VAULT_SECRET and a vault (escrow.test.js). The student's device token (student_tokens) came with the join.
  raw().prepare("INSERT OR IGNORE INTO vault_escrow (id, vault_id, owner_kind, owner_id, sealed, created_at, updated_at) VALUES (?, ?, 'student', ?, 'sealed', ?, ?)")
    .run(s.studentId.padEnd(16, '0').slice(0, 16), `v${s.studentId}`, s.studentId, new Date().toISOString(), new Date().toISOString());
}
/** help_meta rows whose help request is gone (none may be left behind). */
const orphanMeta = () => rows(h.env, 'SELECT * FROM help_meta WHERE help_id NOT IN (SELECT id FROM help_requests)');
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
/** The counters a student and a class have (every prefix forget.js lists, and longer keys), written for today. */
const STUDENT_KEYS = (id) => [`pin:${id}`, `pin:${id}:n0123456789abcdef`, `s:${id}`, `s:${id}:tutor`, `free:s:${id}`, `care:s:${id}`, `report:s:${id}`,
  `work:s:${id}`, `helpreply:s:${id}`, `vault:miss:s:${id}`, `escrow:s:${id}`];
const CLASS_KEYS = (code) => [`t:${code}`, `t:${code}:tutor`, `free:t:${code}`, `free:c:${code}`, `cls:${code}`, `care:t:${code}`, `report:t:${code}`,
  `licreq:c:${code}`, `licclaim:c:${code}`, `assign:c:${code}`, `report:c:${code}`, `aioff:c:${code}`];
async function counters(studentIds, code) {
  for (const id of studentIds) for (const who of STUDENT_KEYS(id)) await setCount(h.env, who, 1);
  for (const who of CLASS_KEYS(code)) await setCount(h.env, who, 1);
}
/** Make a student, everything of them, and their class look `days` old. */
function age(code, days) {
  raw().prepare('UPDATE classes SET created_at = ? WHERE code = ?').run(ago(days), code);
  raw().prepare('UPDATE students SET created_at = ?, last_seen = ? WHERE class_code = ?').run(ago(days), ago(days), code);
  raw().prepare('UPDATE class_settings SET last_seen = ? WHERE code = ?').run(dayOf(new Date(Date.now() - days * DAY)), code);
}

// The retention numbers have one home, shared/retention.js: the purge jobs, the privacy page and the teacher's screen
// read them from there, so a number is never written twice.
test('RETENTION holds the numbers of the trust spec (TRUST-1 §4, TRUST-7), the teacher spec (TEACHER-4) and the other lanes (FOLLOWUP-24), and cannot be changed at run time', () => {
  assert.deepEqual({ ...R }, {
    classIdleDays: 400, studentIdleDays: 400, attemptsDays: 400, examsDays: 400, assignmentsDays: 400, helpImageAfterDoneDays: 30,
    helpImageMaxDays: 60, helpAfterDoneDays: 180, helpMaxDays: 365, accountIdleDays: 730, safetyEventsDays: 400, answerReportsDays: 60,
    licenceRequestAfterHandledDays: 730, licenceCodeAfterExpiryDays: 365, taxYears: 7,
    // spec §6.9 and the student lane's tables
    noticesDays: 90, unpaidOrderDays: 30, auditLogDays: 730, billingEventsDays: 2557, aiUsageDays: 35, aiUsageMonths: 13, aiQualityDays: 400,
    aiSpendDays: 400, classStepsDays: 120, classGoalWeeksDays: 400, metricsDays: 400,
    // the family and durable lanes and the daily reminder, which used to keep their own constants beside their routes
    clientErrorsDays: 30, familyDailyDays: 90, vaultIdleDays: 400, studentTokenIdleDays: 400, familyDeviceIdleDays: 365, familyLinkDays: 1,
    sessionIdleDays: 180, pushIdleDays: 45,
  });
  assert.ok(Object.isFrozen(R));
  assert.throws(() => { 'use strict'; R.accountIdleDays = 1; }, TypeError);
  for (const [k, v] of Object.entries(R)) assert.ok(Number.isInteger(v) && v > 0, k);
  assert.ok(R.helpImageAfterDoneDays <= R.helpImageMaxDays && R.helpAfterDoneDays <= R.helpMaxDays);
});

// Every purge binds the cutoff its RETENTION key gives, and nothing else (FOLLOWUP-24): the builders run against a
// database that only records what they prepare, at a fixed moment, and every date, day or month a statement is bound
// to is matched to the period it comes from. A period written into a purge by hand (or a key read for the wrong table)
// fails here, and so does a new purge statement with a date this list does not explain.
test('every purge statement deletes before the cutoff its RETENTION period gives', async () => {
  const NOW = new Date('2030-06-15T10:00:00Z'); // 13:00 in Jerusalem: a day's cut never moves with summer time
  const t = NOW.getTime();
  const iso = (days) => new Date(t - days * DAY).toISOString();
  const day = (days) => dayOf(new Date(t - days * DAY));
  const month = (days) => monthOf(new Date(t - days * DAY));
  const [y, m] = monthOf(NOW).split('-').map(Number);
  const usageMonth = monthOf(new Date(Date.UTC(y, m - 1 - R.aiUsageMonths, 15)));
  const prepared = [];
  const stmt = (sql) => {
    const s = { sql: sql.replace(/\s+/g, ' '), args: [], bind: (...a) => { s.args = a; return s; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) };
    prepared.push(s);
    return s;
  };
  const env = { DB: { prepare: stmt, batch: async (list) => list.map(() => ({ results: [], meta: { changes: 0 } })) } };
  const builders = {
    purgeCountersSql: () => purgeCountersSql(env, NOW), purgeAccountsSql: () => purgeAccountsSql(env, NOW), purgeFamilySql: () => purgeFamilySql(env, NOW),
    purgeRecordsSql: () => purgeRecordsSql(env, NOW), purgeSafetySql: () => purgeSafetySql(env, NOW), purgeReportSql: () => purgeReportSql(env, NOW),
    purgeIdentitySql: () => purgeIdentitySql(env, NOW), purgeVaultsSql: () => purgeVaultsSql(env, NOW), purgeClassSteps: () => purgeClassSteps(env, NOW),
    purgeLongTermSql: () => purgeLongTermSql(env, NOW), idleAccounts: () => idleAccounts(env, NOW),
  };
  // [builder, what the statement says, the dates it is bound to]
  const CUTOFFS = [
    ['purgeCountersSql', /ai_usage WHERE length\(day\) >= 10/, [day(R.aiUsageDays)]],
    ['purgeCountersSql', /ai_usage WHERE length\(day\) = 7/, [usageMonth]],
    ['purgeCountersSql', /FROM ai_quality/, [day(R.aiQualityDays)]],
    ['purgeAccountsSql', /FROM login_codes WHERE expires_at/, [NOW.toISOString()]], // at its expiry: no period
    ['purgeAccountsSql', /FROM account_sessions/, [iso(R.sessionIdleDays)]],
    ['purgeFamilySql', /FROM link_codes/, [iso(R.familyLinkDays)]],
    ['purgeFamilySql', /token_hash IS NULL AND created_at/, [iso(R.familyLinkDays)]],
    ['purgeFamilySql', /token_hash IS NOT NULL AND last_seen/, [day(R.familyDeviceIdleDays)]],
    ['purgeRecordsSql', /FROM notices/, [iso(R.noticesDays)]],
    ['purgeRecordsSql', /FROM orders WHERE status = 'expired'/, [iso(R.unpaidOrderDays)]],
    ['purgeRecordsSql', /FROM ai_spend/, [day(R.aiSpendDays), month(R.aiSpendDays)]],
    ['purgeRecordsSql', /FROM audit_log/, [iso(R.auditLogDays)]],
    ['purgeRecordsSql', /FROM billing_events/, [iso(R.billingEventsDays)]],
    ['purgeRecordsSql', /FROM client_errors/, [day(R.clientErrorsDays)]],
    ['purgeRecordsSql', /FROM class_steps/, [day(R.classStepsDays)]],
    ['purgeRecordsSql', /FROM class_goal_weeks/, [day(R.classGoalWeeksDays)]],
    ['purgeRecordsSql', /FROM metrics_daily/, [day(R.metricsDays)]],
    ['purgeRecordsSql', /FROM push_subs/, [day(R.pushIdleDays)]],
    ['purgeSafetySql', /FROM safety_events/, [day(R.safetyEventsDays)]],
    ['purgeSafetySql', /FROM answer_reports/, [iso(R.answerReportsDays)]],
    // the last familyDailyDays Jerusalem days are kept, today included: the cut is the day familyDailyDays − 1 back
    ['purgeReportSql', /FROM family_daily WHERE day/, [day(R.familyDailyDays - 1)]],
    ['purgeIdentitySql', /FROM student_tokens WHERE last_seen/, [iso(R.studentTokenIdleDays)]],
    ['purgeVaultsSql', /vaults WHERE updated_at/, [iso(R.vaultIdleDays)]],
    ['purgeVaultsSql', /FROM vault_tombstones/, [iso(R.vaultIdleDays)]],
    ['purgeClassSteps', /UPDATE help_requests SET image = NULL/, [iso(R.helpImageAfterDoneDays), iso(R.helpImageMaxDays)]],
    ['purgeClassSteps', /DELETE FROM help_requests WHERE id IN/, [iso(R.helpAfterDoneDays), iso(R.helpMaxDays)]],
    ['purgeClassSteps', /FROM attempts WHERE at/, [iso(R.attemptsDays)]],
    ['purgeClassSteps', /FROM exams WHERE created_at/, [iso(R.examsDays)]],
    ['purgeClassSteps', /a\.due_on < \?/, [day(R.assignmentsDays)]],
    ['purgeClassSteps', /SELECT id FROM students WHERE last_seen < \?1/, [iso(R.studentIdleDays)]],
    ['purgeClassSteps', /SELECT c\.code FROM classes c/, [day(R.classIdleDays), iso(R.classIdleDays)]],
    ['purgeLongTermSql', /FROM licence_codes/, [iso(R.licenceCodeAfterExpiryDays)]],
    ['purgeLongTermSql', /FROM licence_requests/, [iso(R.licenceRequestAfterHandledDays)]],
    ['purgeLongTermSql', /refund_queue|payments|orders|subscriptions|order_renewals/, [taxCutoffIso(NOW)]],
    ['idleAccounts', /FROM accounts a/, [day(R.accountIdleDays), day(R.classIdleDays), iso(R.classIdleDays)]],
  ];
  const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}(-\d{2}(T[\d:.]+Z)?)?$/.test(v);
  const unexplained = [];
  for (const [name, build] of Object.entries(builders)) {
    prepared.length = 0;
    await build();
    const mine = CUTOFFS.filter(([b]) => b === name);
    for (const [, re] of mine) assert.ok(prepared.some((s) => re.test(s.sql)), `${name}: no statement matches ${re}`);
    for (const s of prepared) {
      const dates = s.args.filter(isDate);
      if (!dates.length) continue;
      // a statement can say more than one rule's words (a student's rows under the idle-students select): the dates
      // must be exactly one of those rules' dates
      const rules = mine.filter(([, re]) => re.test(s.sql));
      if (!rules.length) { unexplained.push(`${name}: ${s.sql.slice(0, 90)} ${dates}`); continue; }
      assert.ok(rules.some(([, , want]) => JSON.stringify(want) === JSON.stringify(dates)),
        `${name}: ${s.sql.slice(0, 120)} is bound to ${dates}, not to ${rules.map(([, , want]) => want.join(' ')).join(' | ')}`);
    }
  }
  assert.deepEqual(unexplained, [], 'a purge bound to a date no RETENTION period explains');
  // the cutoffs are those periods: one day more or less would be another date
  assert.notEqual(day(R.classStepsDays), day(R.classStepsDays + 1));
  assert.ok(ACCOUNT_PURGE_LIMIT > 0);
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
  // every answer sent is acknowledged (DURABLE-7: the app's outbox lets go of it), but the 401-day-old one is not stored
  assert.deepEqual(res, { saved: 3 }, 'the 401-day-old answer is acknowledged, not stored again');
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
  for (const s of cls.students) await practise(s, cls.teacher);
  await assignWork(cls);
  await counters([noa.studentId, itai.studentId], cls.code);
  const noaMessages = messagesOf(noa.studentId).length;
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(R.studentIdleDays, HOUR), noa.studentId);
  raw().prepare('UPDATE students SET last_seen = ? WHERE id = ?').run(ago(R.studentIdleDays - 1), itai.studentId);
  const report = await purge(h.env);
  assert.equal(report.class.students, 1);
  assert.deepEqual(mentions(noa.studentId), [], 'nothing of her is left in any table');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM students WHERE id = ?', itai.studentId).n, 1);
  for (const row of STUDENT_ROWS) assert.ok(rows(h.env, `SELECT * FROM ${row[0]} WHERE ${studentWhere(row, '= ?')}`, itai.studentId).length > 0, `${row[0]} of the other student stays`);
  assert.deepEqual(orphanMeta(), [], 'her help_meta rows went with her help requests');
  assert.equal(noaMessages, 2);
  assert.deepEqual(orphanMessages(), [], 'the replies on her requests went with them');
  assert.equal(rows(h.env, 'SELECT * FROM ai_usage WHERE who LIKE ?', `%${itai.studentId}%`).length, STUDENT_KEYS(itai.studentId).length, 'his counters stay');
  assert.equal(rows(h.env, 'SELECT * FROM assignments WHERE class_code = ?', cls.code).length, 3, "the class's assignments stay");
  assert.ok(one(h.env, 'SELECT * FROM classes WHERE code = ?', cls.code), 'the class stays');
});

test('the teacher removing a student leaves no row with the student in any table, counters included (TRUST-6 §1)', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  for (const s of cls.students) await practise(s, cls.teacher);
  await assignWork(cls);
  await counters([noa.studentId, itai.studentId], cls.code);
  const r = await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} });
  assert.equal(r.status, 200);
  // the teacher's own audit row names the id it removed; nothing else does
  assert.deepEqual(mentions(noa.studentId, (table, row) => table === 'audit_log' && row.includes('"student.remove"')), []);
  assert.deepEqual(orphanMeta(), []);
  assert.deepEqual(orphanMessages(), []);
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
  for (const p of STUDENT_COUNTERS) assert.ok(STUDENT_KEYS('ab12').some((k) => k.startsWith(p)), `the test writes a ${p} counter`);
  for (const p of CLASS_COUNTERS) assert.ok(CLASS_KEYS('ABC234').some((k) => k.startsWith(p)), `the test writes a ${p} counter`);
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
  // the class goal (STUDENT-4): the teacher's size (class_goal_settings); the dashboard fixes the week (class_goal_weeks)
  assert.equal((await h.call('POST', '/api/teacher/class/goal', { headers: aTeacher, body: { on: true, target: 20 } })).status, 200);
  await h.call('GET', '/api/teacher/dashboard', { headers: aTeacher });
  assert.equal(rows(h.env, 'SELECT * FROM class_goal_weeks WHERE class_code = ?', a.code).length, 1);
  assert.equal((await h.call('POST', '/api/teacher/class/rekey', { headers: { 'X-Class-Code': a.code, 'X-Account-Token': t }, body: {} })).status, 200);
  await h.ctx.flush();
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
  assert.equal(rows(h.env, 'SELECT * FROM assignments').length, 0, "class A's assignments went with it");
  for (const s of aStudents) assert.deepEqual(mentions(s.studentId), [], `nothing of ${s.name} is left`);
  assert.deepEqual(orphanMeta(), [], 'no help_meta row is left without its request');
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
  for (let i = 0; i < PURGE_BATCH + 500; i++) ins.run(id, 'neg', '2025-01-01', ago(R.attemptsDays + 2, i));
  ins.run(id, 'neg', dayOf(), ago(1));
  raw().exec('COMMIT');
  help(id, { created: ago(R.helpImageMaxDays + 1) });
  const night = new Date(jerusalemMidnight(dayOf()).ms + 3 * HOUR + 10 * 60_000);
  const report = await run(h.env, { now: night });
  assert.equal(report.purge.class.attempts, PURGE_BATCH + 500);
  assert.equal(report.purge.class.helpImages, 1);
  assert.deepEqual(Object.keys(report.purge.class).sort(), ['assignments', 'attempts', 'classes', 'exams', 'help', 'helpImages', 'helpMessages', 'students']);
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
    `ספירת השאלות לעוזר והקודים של מכשירים ורשתות: ${R.aiUsageDays} יום (ספירה חודשית: ${R.aiUsageMonths} חודשים).`,
    `ספירות של איך העוזר ענה, ועלות העוזר לכל חשבון או כיתה: ${R.aiQualityDays} יום.`,
    `קוד כניסה במייל: ${CODE_TTL_MIN} דקות. כניסה לחשבון שלא השתמשו בה ${R.sessionIdleDays} יום: נמחקת. מכשיר מחובר שלא היה בשימוש שנה: מנותק ונמחק.`,
    `חשבון של הורה או מורה שלא נכנסו אליו ${R.accountIdleDays} יום (שנתיים)`,
    `בקשה לרישיון כיתה: ${R.licenceRequestAfterHandledDays} יום אחרי שטיפלנו בה.`,
    `ספירות בטיחות: ${R.safetyEventsDays} יום. תשובה של העוזר שדווחה: ${R.answerReportsDays} יום.`,
    `הזמנה שלא שולמה: ${R.unpaidOrderDays} יום.`,
    `יומן הפעולות על כסף ועל גישה: ${R.auditLogDays} יום. מיילים שנשלחו: ${R.noticesDays} יום אחרי השליחה.`,
    `הצעדים של מטרת הכיתה: ${R.classStepsDays} יום, וגם כשהמורה מסיר תלמיד מהכיתה. הספירות היומיות בלי זיהוי: ${R.metricsDays} יום.`,
    `נמחק אחרי ${R.vaultIdleDays} יום שבהם לא עודכן ולא נפתח.`,
    `הסימון נמחק אחרי ${R.vaultIdleDays} יום.`,
  ];
  for (const t of sentences) assert.ok(retention.includes(t), `privacy.md says: ${t}`);
  // the money records: the end of the 7th calendar year after the tax year
  assert.equal(R.taxYears, 7);
  assert.ok(retention.includes('עד סוף השנה השביעית אחרי שנת המס'), 'the tax period as the purge counts it');
  assert.equal(R.accountIdleDays, 730, '"שנתיים" beside the number');
  assert.equal(R.examsDays, R.attemptsDays, 'answers and exam summaries share one sentence');
  assert.equal(R.aiSpendDays, R.aiQualityDays, 'the tutor\'s quality counts and its cost share one sentence');
  assert.equal(R.familyDeviceIdleDays, 365, '"שנה" for a linked device nobody used');
});
