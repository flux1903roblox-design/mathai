// The pilot's numbers (spec TEACHER-11, tests 1-8): scripts/pilot.mjs's SELECTs run against the in-memory database
// with a synthetic class of 10 students over 14 days (test/fixtures/pilotClass.js), and owner.mjs pilot-report end to
// end with a fake wrangler. Nothing is written; the output has no names and no student ids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilotQueries, pilotReport, pilotText, examListSql, weeksOf, schoolDays, median, TOO_FEW, PREPOST_CAVEAT } from '../scripts/pilot.mjs';
import { build, cli, InputError, PILOT_USAGE } from '../scripts/owner.mjs';
import { makeEnv } from './helpers.js';
import { seedPilot, CLASS, FROM, TO, STUDENTS, PRE, POST } from './fixtures/pilotClass.js';

function setup() {
  const env = makeEnv();
  seedPilot(env);
  const rows = (sql) => env.DB.raw.prepare(sql).all();
  const run = (opts = {}) => {
    const qs = pilotQueries({ classCode: CLASS, from: FROM, to: TO, ...opts });
    const results = Object.fromEntries(Object.entries(qs).map(([k, sql]) => [k, rows(sql)]));
    return pilotReport(results, { from: FROM, to: TO, ...opts });
  };
  return { env, rows, run };
}
/** A fake wrangler: SELECTs answered from the database; anything else would be a write, and fails the test. */
function fakeIo(env, extra = {}) {
  const out = []; const err = []; const execs = [];
  return {
    out, err, execs,
    io: {
      env: { MOE_AI_APPROVAL: 'none', ...extra },
      query: async (sql) => env.DB.raw.prepare(sql).get() || null,
      rows: async (sql) => { assert.match(sql.trim(), /^SELECT\b/i); return env.DB.raw.prepare(sql).all(); },
      exec: async (b) => { execs.push(b); env.DB.raw.exec(b.sql); return '[]'; },
      prompt: async () => '',
      log: (...a) => out.push(a.join(' ')),
      error: (...a) => err.push(a.map(String).join(' ')),
    },
  };
}
const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('1. 8 of 10 active in week 1, 6 of those in week 2: was[1] = 0.8, returnRate = 0.75; weeks run Sunday to Saturday', () => {
  const { run } = setup();
  const rep = run();
  assert.deepEqual(rep.range.weeks, [{ w: 1, from: '2026-11-15', to: '2026-11-21' }, { w: 2, from: '2026-11-22', to: '2026-11-28' }]);
  assert.equal(rep.joined, 10); assert.equal(rep.N, 10);
  assert.deepEqual(rep.was[1], { k: 8, n: 10, rate: 0.8 });
  assert.deepEqual(rep.was[2], { k: 7, n: 10, rate: 0.7 }); // s8 came only in week 2
  assert.deepEqual(rep.returnRate, { k: 6, n: 8, rate: 0.75 });
  // N is the consented number when the owner gives it
  const consented = run({ consented: 8 });
  assert.equal(consented.N, 8); assert.equal(consented.was[1].rate, 1);
  // a range that starts on a Tuesday: its first week is Tuesday to Saturday
  assert.deepEqual(weeksOf('2026-11-17', '2026-11-24'), [{ w: 1, from: '2026-11-17', to: '2026-11-21' }, { w: 2, from: '2026-11-22', to: '2026-11-24' }]);
});

test('2. medians on a known distribution, and first try on the stairs given: the first three school days against the last three', () => {
  const { run } = setup();
  const rep = run();
  assert.equal(median([1, 1, 2, 3, 3, 4, 4, 5]), 3); assert.equal(median([3, 1, 2]), 2); assert.equal(median([]), null);
  assert.deepEqual(rep.daysMedian[1], { median: 3, n: 8 }); // 1,1,2,3,3,4,4,5
  assert.deepEqual(rep.daysMedian[2], { median: 2, n: 7 }); // 1,1,2,2,3,3,4
  assert.deepEqual(rep.minutesMedian[1], { median: 15, n: 8 }); // 5,5,10,15,15,20,20,28
  assert.deepEqual(rep.minutesMedian[2], { median: 10, n: 7 });
  assert.deepEqual(schoolDays(FROM, TO), ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']);
  const { early, late } = rep.firstTryEarlyLate;
  // early: 5 + 6 + 7 students on 15-17.11, five answers each, 2 right first; the angles practice is not a stair given
  assert.deepEqual(early, { from: '2026-11-15', to: '2026-11-17', k: 36, n: 90, rate: 0.4 });
  assert.deepEqual(late, { from: '2026-11-24', to: '2026-11-26', k: 20, n: 25, rate: 0.8 });
});

test('3. assignDone counts late work as not on time; checkPass is passed ÷ done for stairs and checks', () => {
  const { run } = setup();
  const rep = run();
  const per = Object.fromEntries(rep.assignDone.per.map((a) => [a.title, a]));
  assert.deepEqual(Object.keys(per), ['מבחן פתיחה', 'מספרים מכוונים, מדרגה 2', 'בדיקת שליטה: מדרגה 2']); // by due date; the exam due 30.11 is outside
  assert.equal(per['מספרים מכוונים, מדרגה 2'].assigned, 10); assert.equal(per['מספרים מכוונים, מדרגה 2'].done, 8); assert.equal(per['מספרים מכוונים, מדרגה 2'].onTime, 6);
  // the check went to four students: the work of one it was not given is not counted
  assert.equal(per['בדיקת שליטה: מדרגה 2'].assigned, 4); assert.equal(per['בדיקת שליטה: מדרגה 2'].onTime, 3); assert.equal(per['בדיקת שליטה: מדרגה 2'].rate, null);
  assert.equal(per['מבחן פתיחה'].onTime, 8);
  assert.deepEqual({ k: rep.assignDone.k, n: rep.assignDone.n, rate: rep.assignDone.rate }, { k: 17, n: 24, rate: 0.7083 });
  assert.deepEqual(rep.checkPass, { k: 9, n: 12, rate: 0.75 });
});

test('4. prePost pairs only the students with both exams; the mean difference matches a hand computation; the caveat is printed', () => {
  const { run } = setup();
  const rep = run({ pre: PRE, post: POST });
  const p = rep.prePost;
  // pairs s0-s5: before .5 .6 .4 .7 .3 .5, after .7 .6 .6 .8 .6 .4
  assert.equal(p.n, 6); assert.equal(p.onlyBefore, 2); assert.equal(p.onlyAfter, 1);
  close(p.before, 3.0 / 6); close(p.after, 3.7 / 6);
  close(p.meanDiff, (0.2 + 0 + 0.2 + 0.1 + 0.3 - 0.1) / 6);
  assert.deepEqual(p.improved, { k: 4, n: 6, rate: 0.6667 });
  assert.equal(p.caveat, PREPOST_CAVEAT);
  const text = pilotText(rep, CLASS);
  assert.match(text, /מבחן לפני ואחרי: לפני 50%, אחרי 62%, הפרש ממוצע \+12 נקודות אחוז, השתפרו 67% \(4 מתוך 6\)/);
  assert.ok(text.includes(PREPOST_CAVEAT));
  assert.equal(run().prePost, null); // without --pre and --post there is no such line
});

test('5. reply24h and replyMedianH from the help requests: only the teacher\'s messages count, in the Jerusalem range', () => {
  const { run } = setup();
  const rep = run();
  assert.deepEqual(rep.helpPerStudent, { requests: 6, n: 10, perStudent: 0.6 });
  assert.deepEqual(rep.reply24h, { k: 3, n: 6, rate: 0.5 }); // 2 h, 5 h, 1 h; 30 h is not within a day; two never
  assert.deepEqual(rep.replyMedianH, { median: 3.5, n: 4 }); // 1, 2, 5, 30
});

test('6. a percentage on fewer than five says "מעט מדי נתונים", in the JSON and in the table', () => {
  const { rows } = setup();
  const qs = pilotQueries({ classCode: CLASS, from: FROM, to: TO, pre: PRE, post: POST });
  const results = Object.fromEntries(Object.entries(qs).map(([k, sql]) => [k, rows(sql)]));
  // only three students: every share has n < 5
  const few = new Set(STUDENTS.slice(0, 3));
  results.students = results.students.filter((x) => few.has(x.s));
  const rep = pilotReport(results, { from: FROM, to: TO, pre: PRE, post: POST });
  assert.deepEqual(rep.was[1], { k: 3, n: 3, rate: null, tooFew: true });
  assert.equal(rep.returnRate.rate, null); assert.equal(rep.prePost.before, null); assert.equal(rep.prePost.tooFew, true);
  const text = pilotText(rep, CLASS);
  assert.match(text, /פעילים בשבוע 1 \(15\.11\.2026–21\.11\.2026\): מעט מדי נתונים \(n=3\)/);
  assert.match(text, /מבחן לפני ואחרי: מעט מדי נתונים \(n=3\)/);
  assert.ok(!/\d+% \(\d מתוך [1-4]\)/.test(text), 'no percentage on fewer than five');
  assert.ok(text.includes(TOO_FEW));
});

test('7. pilot-report --json, end to end: read-only, and the JSON has no name key and no student id anywhere', async () => {
  const { env, run } = setup();
  const { io, out, err, execs } = fakeIo(env);
  const code = await cli(['pilot-report', '--class', CLASS.toLowerCase(), '--from', FROM, '--to', TO, '--pre', PRE, '--post', POST, '--json', '--local'], io);
  assert.equal(code, 0, err.join('\n'));
  assert.equal(execs.length, 0, 'nothing is written: no audit row');
  const json = JSON.parse(out.join('\n'));
  assert.deepEqual(json, JSON.parse(JSON.stringify(run({ pre: PRE, post: POST }))));
  const names = ['תלמיד', 'תלמידה מכיתה אחרת'];
  const scan = (v, where = '$') => {
    if (Array.isArray(v)) return v.forEach((x, i) => scan(x, `${where}[${i}]`));
    if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => { assert.notEqual(k.toLowerCase(), 'name', `${where}.${k}`); assert.ok(!/^(id|s|student|students|studentid|student_id)$/i.test(k), `${where}.${k}`); scan(x, `${where}.${k}`); });
    const s = String(v);
    for (const id of [...STUDENTS, 'other-student-1']) assert.ok(!s.includes(id), `${where} has a student id`);
    for (const n of names) assert.ok(!s.includes(n), `${where} has a name`);
    return undefined;
  };
  scan(json);
  // the table, as the owner reads it
  const { io: io2, out: out2 } = fakeIo(env);
  assert.equal(await cli(['pilot-report', '--class', CLASS, '--from', FROM, '--to', TO, '--consented', '9', '--local'], io2), 0);
  const text = out2.join('\n');
  assert.match(text, /^דוח פיילוט, כיתה ABC234: 15\.11\.2026–28\.11\.2026/);
  assert.match(text, /N = 9 \(אישרו השתתפות\)/);
  assert.match(text, /חזרו בשבוע 2: 75% \(6 מתוך 8\)/);
  for (const id of STUDENTS) assert.ok(!text.includes(id));
});

test('8. pilot-report without --class exits 1 with the usage line; --list is a SELECT over this class\'s exams only', async () => {
  assert.throws(() => build('pilot-report', {}), (e) => e instanceof InputError && e.message === PILOT_USAGE);
  assert.throws(() => build('pilot-report', { class: true, list: true }), /usage: npm run owner -- pilot-report/);
  assert.throws(() => build('pilot-report', { class: CLASS }), /usage/);
  assert.throws(() => build('pilot-report', { class: CLASS, from: '2026-11-28', to: '2026-11-15' }), /on or before/);
  assert.throws(() => build('pilot-report', { class: CLASS, from: '2026-02-30', to: '2026-03-02' }), /bad date/);
  assert.throws(() => build('pilot-report', { class: CLASS, from: FROM, to: TO, pre: PRE }), /go together/);
  assert.throws(() => build('pilot-report', { class: CLASS, from: FROM, to: TO, pre: "x'); DROP", post: POST }), InputError);
  const { env } = setup();
  const { io, err, out, execs } = fakeIo(env);
  assert.equal(await cli(['pilot-report', '--from', FROM, '--to', TO], io), 1);
  assert.equal(err[0], PILOT_USAGE);
  const b = build('pilot-report', { class: 'abc234', list: true });
  assert.equal(b.readOnly, true);
  assert.match(b.sql, /^SELECT /);
  assert.ok(b.sql.includes("FROM assignments x WHERE x.class_code = 'ABC234' AND x.kind = 'exam'"));
  assert.equal(b.sql, examListSql(CLASS));
  assert.deepEqual(env.DB.raw.prepare(b.sql).all().map((r) => [r.id, r.title, r.version, r.due_on, r.done]),
    [[PRE, 'מבחן פתיחה', 'a', '2026-11-15', 8], [POST, 'מבחן סיום', 'b', '2026-11-30', 7]]);
  assert.equal(await cli(['pilot-report', '--class', CLASS, '--list', '--local'], io), 0);
  assert.match(out.at(-1), new RegExp(`${PRE}\\s+א׳\\s+15\\.11\\.2026\\s+8\\s+מבחן פתיחה`));
  assert.equal(execs.length, 0);
  // every query is a SELECT
  for (const sql of Object.values(pilotQueries({ classCode: CLASS, from: FROM, to: TO, pre: PRE, post: POST }))) assert.match(sql, /^SELECT /);
});
