// Assignments (spec TEACHER-4) and the students' side of them (TEACHER-5 §1), against the in-memory D1: what a teacher
// may send and what is refused, the caps, the counts by Jerusalem day (late is never a UTC date), targets, a later due
// date, deleting an assignment, a student, a class's work through the dashboard, both teacher credentials, the student
// routes with their monotonic report, and the 400-day purge. Claude and the email service are stubbed; every name and
// address is synthetic (example.test).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { purge } from '../src/cron.js';
import { plusDays, isRestDay, schoolDay, cleanExamItems, ASSIGN } from '../src/assignments.js';
import { dayOf, jerusalemMidnight } from '../src/util.js';
import { RETENTION as R } from '../../shared/retention.js';
import { setup, makeClass, bearer, signIn, setCount, countOf, rows, one, advanceClock } from './helpers.js';

let h;
afterEach(() => h?.done());
const HOUR = 3600_000;
const DAY = 24 * HOUR;
// Thursday 12 November 2026, 10:00 in Jerusalem: Saturday is the 14th
const NOW = Date.parse('2026-11-12T08:00:00Z');
const pin = (ms = NOW) => advanceClock(ms - Date.now());
/** The instant hh:mm in Jerusalem on a YYYY-MM-DD day. */
const at = (day, hh, mm = 0) => jerusalemMidnight(day).ms + hh * HOUR + mm * 60_000;

const create = (cls, body, headers = cls.teacher) => h.call('POST', '/api/teacher/assignments', { headers, body });
const stair = (over = {}) => ({ kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', dueOn: '2026-11-17', ...over });
const listOf = async (cls, headers = cls.teacher) => (await (await h.call('GET', '/api/teacher/assignments', { headers })).json());
const detail = (cls, id, headers = cls.teacher) => h.call('GET', `/api/teacher/assignments/${id}`, { headers });
const update = (cls, id, body, headers = cls.teacher) => h.call('POST', `/api/teacher/assignments/${id}`, { headers, body });
const remove = (cls, id, headers = cls.teacher) => h.call('POST', `/api/teacher/assignments/${id}/delete`, { headers, body: {} });
const work = (s, id, body) => h.call('POST', `/api/class/work/${id}`, { headers: bearer(s), body });
const classWork = async (s) => (await h.call('GET', '/api/class/work', { headers: bearer(s) })).json();
async function made(res, status = 201) {
  const b = await res.json();
  assert.equal(res.status, status, JSON.stringify(b));
  return b;
}
async function refused(res, status, error, field) {
  const b = await res.json();
  assert.equal(res.status, status, JSON.stringify(b));
  assert.equal(b.error, error);
  if (field !== undefined) assert.equal(b.field, field);
  return b;
}

// ten frozen questions as the app makes them, every form, in the order the server keeps the fields
const ITEMS = [
  { topic: 'signed', level: 1, key: 'as:3:-8', text: 'חשבו:', display: '3 + (-8)', form: 'num', answer: -5, answerText: '-5', solution: ['3 + (-8) = 3 - 8', '= -5'], hint: 'סימנים שונים: מחסרים.' },
  { topic: 'signed', level: 2, key: 'cmp:-3:-5', text: 'מה גדול יותר?', display: null, form: 'mc', answer: 0, choices: [{ tex: '-3' }, { tex: '-5' }, { text: 'שווים' }] },
  { topic: 'coord', level: 1, key: 'pt:2:-3', text: 'מה הנקודה?', form: 'pt', answer: [2, -3], fig: { kind: 'grid', points: [[2, -3]] }, label: 'B' },
  { topic: 'line', level: 5, key: 'eq:2:-1', text: 'מה משוואת הישר?', form: 'line', answer: { m: 2, b: -1 }, levelTitle: 'משוואת ישר' },
  // a Pythagoras length that is not whole: right within half a tenth of exact (√50)
  { topic: 'pyth', level: 1, key: 'hyp:5:5', text: 'מצאו את היתר.', display: 'a=5,\\ b=5,\\ c=?', form: 'num', answer: 7.07, exact: Math.sqrt(50), label: 'c', unit: 'ס״מ' },
  // an expression in n: the letter goes with it
  { topic: 'expr', level: 3, key: 'lin:2:3', text: 'כתבו ביטוי לכלל.', form: 'lin', answer: { k: 2, c: 3 }, var: 'n' },
  { topic: 'eq', level: 1, key: 'x+4=9', text: 'פתרו:', display: 'x + 4 = 9', form: 'num', answer: 5 },
  { topic: 'sys', level: 2, key: 'sys:1:2', text: 'פתרו את המערכת.', form: 'pt', answer: [1, 2], label: '(x, y)' },
  { topic: 'stats', level: 1, key: 'mean:4', text: 'מה הממוצע?', display: '2, 4, 6', form: 'num', answer: 4 },
  { topic: 'angles', level: 2, key: 'sup:70', text: 'כמה מעלות?', form: 'num', answer: 110, fig: { kind: 'angle', a: 70 }, unit: '°' },
];

test('the calendar: Jerusalem days, Saturday moves to Sunday', () => {
  assert.equal(plusDays('2026-11-12', 120), '2027-03-12');
  assert.equal(plusDays('2026-12-31', 1), '2027-01-01');
  assert.equal(isRestDay('2026-11-14'), true);
  assert.equal(isRestDay('2026-11-13'), false);
  assert.deepEqual(schoolDay('2026-11-14'), { day: '2026-11-15', moved: true });
  assert.deepEqual(schoolDay('2026-11-16'), { day: '2026-11-16', moved: false });
});

test('1. create: a stair for all, bad skills and dates, Saturday moves, targets from another class, exam items', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב', 'נועה'] });
  const other = await makeClass(h, { students: ['זר'] });
  const r = await made(await create(cls, stair({ note: '  לקראת המבחן\u0007 ביום חמישי  ' })));
  assert.equal(r.moved, false);
  assert.match(r.assignment.id, /^[a-f0-9]{16}$/);
  assert.deepEqual({ ...r.assignment, id: 0, createdAt: 0 }, {
    id: 0, kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', note: 'לקראת המבחן ביום חמישי', startsOn: '2026-11-12',
    dueOn: '2026-11-17', forAll: true, targets: [], createdAt: 0, hasExam: false, examCount: null, version: null,
    counts: { assigned: 3, notStarted: 3, started: 0, done: 0, late: 0 },
  });
  const l = await listOf(cls);
  assert.equal(l.today, '2026-11-12');
  assert.deepEqual(l.assignments.map((a) => [a.id, a.counts.assigned, a.counts.notStarted]), [[r.assignment.id, 3, 3]]);
  assert.deepEqual((await listOf(other)).assignments, [], "another class's list");
  // the audit row: what was given, never to whom by name
  assert.deepEqual({ ...one(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'assignment.create'") }, {
    actor: `teacher:${cls.code}`, target: `assignment:${r.assignment.id}`, detail: '{"kind":"stair","skill":"signed:1","targets":0}',
  });
  // the skill: a stair the app has
  for (const skill of ['xx:1', 'signed:13', 'signed:0', 'other:1', 'SIGNED:1', 'signed', 'signed:1:2', '']) {
    await refused(await create(cls, stair({ skill })), 400, 'bad_assignment', 'skill');
  }
  // the algebra lane's topics are stairs too
  await made(await create(cls, stair({ skill: 'eq:3', kind: 'check' })));
  await refused(await create(cls, stair({ kind: 'homework' })), 400, 'bad_assignment', 'kind');
  // the due date: today to today + 120
  await refused(await create(cls, stair({ dueOn: '2026-11-11' })), 400, 'bad_assignment', 'dueOn');
  await refused(await create(cls, stair({ dueOn: '2027-03-13' })), 400, 'bad_assignment', 'dueOn');
  await refused(await create(cls, stair({ dueOn: '17/11/2026' })), 400, 'bad_assignment', 'dueOn');
  await made(await create(cls, stair({ dueOn: '2026-11-12' })));
  await made(await create(cls, stair({ dueOn: '2027-03-12' })));
  await refused(await create(cls, stair({ startsOn: '2026-11-18' })), 400, 'bad_assignment', 'dueOn');
  await refused(await create(cls, stair({ startsOn: '2026-11-11' })), 400, 'bad_assignment', 'startsOn');
  // a Saturday is moved to Sunday, and the reply says so
  const sat = await made(await create(cls, stair({ dueOn: '2026-11-14' })));
  assert.equal(sat.moved, true);
  assert.equal(sat.assignment.dueOn, '2026-11-15');
  // the title: cleaned, or the stair when none is given
  const plain = await made(await create(cls, stair({ title: '\n\t ', note: 'x'.repeat(250) })));
  assert.equal(plain.assignment.title, 'signed:1');
  assert.equal(plain.assignment.note.length, 200);
  // targets: students of this class only
  await refused(await create(cls, stair({ targets: [other.students[0].studentId] })), 400, 'bad_assignment', 'targets');
  await refused(await create(cls, stair({ targets: [cls.students[0].studentId, other.students[0].studentId] })), 400, 'bad_assignment', 'targets');
  await refused(await create(cls, stair({ targets: 'all' })), 400, 'bad_assignment', 'targets');
  await refused(await create(cls, stair({ targets: Array.from({ length: 46 }, (_, i) => i.toString(16).padStart(16, '0')) })), 400, 'bad_assignment', 'targets');
  assert.equal((await made(await create(cls, stair({ targets: [] })))).assignment.forAll, true, 'an empty list is the whole class');
});

test('1. a class exam: 1..14 items with the app\'s fields only; exact and var are kept; a wrong item or a big exam is refused', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const exam = (items, version = 'b', over = {}) => ({ kind: 'exam', title: 'מבחן תרגול: שבוע 3', dueOn: '2026-11-19', exam: { items, version }, ...over });
  const r = await made(await create(cls, exam(ITEMS)));
  assert.deepEqual([r.assignment.hasExam, r.assignment.examCount, r.assignment.version, r.assignment.skill], [true, 10, 'b', null]);
  const d = await (await detail(cls, r.assignment.id)).json();
  assert.equal(JSON.stringify(d.exam.items), JSON.stringify(ITEMS), 'byte for byte');
  assert.equal(d.exam.items[4].exact, Math.sqrt(50));
  assert.equal(d.exam.items[5].var, 'n');
  // the list never carries the questions
  assert.ok(!('exam' in (await listOf(cls)).assignments[0]));
  // fields the app does not read are dropped
  const extra = await made(await create(cls, exam([{ ...ITEMS[0], cats: { 5: 'sign' }, secret: 'x' }])));
  assert.deepEqual((await (await detail(cls, extra.assignment.id)).json()).exam.items, [ITEMS[0]]);
  // the version defaults to א׳
  assert.equal((await made(await create(cls, exam([ITEMS[0]], null)))).assignment.version, 'a');
  await refused(await create(cls, exam([ITEMS[0]], 'c')), 400, 'bad_assignment', 'version');
  // how many, and each item
  await refused(await create(cls, exam([])), 400, 'bad_assignment', 'exam');
  await refused(await create(cls, exam(Array.from({ length: 15 }, () => ITEMS[0]))), 400, 'bad_assignment', 'exam');
  await refused(await create(cls, { kind: 'exam', dueOn: '2026-11-19' }), 400, 'bad_assignment', 'exam');
  const wrong = [
    { ...ITEMS[0], form: 'manip' },
    { ...ITEMS[0], topic: 'other' },
    { ...ITEMS[0], level: 13 },
    { ...ITEMS[0], key: '' },
    { ...ITEMS[0], text: 'x'.repeat(601) },
    { ...ITEMS[0], answer: '5' },
    { ...ITEMS[0], exact: '7.07' },
    { ...ITEMS[5], answer: { k: 2 } },
    { ...ITEMS[5], answer: { k: 2, c: '3' } },
    { ...ITEMS[5], answer: { k: 2, c: 3, x: 1 } },
    { ...ITEMS[5], var: 'nn' },
    { ...ITEMS[0], var: 'n' },
    { ...ITEMS[1], answer: 3 },
    { ...ITEMS[1], choices: [{ tex: '-3' }] },
    { ...ITEMS[1], choices: [{ tex: '-3' }, { html: '<b>' }] },
    { ...ITEMS[2], answer: [2] },
    { ...ITEMS[3], answer: { m: 2, b: null } },
    { ...ITEMS[0], solution: Array.from({ length: 9 }, () => 'צעד') },
    { ...ITEMS[0], fig: { big: 'x'.repeat(2100) } },
    { ...ITEMS[0], unit: 'x'.repeat(31) },
  ];
  for (const it of wrong) {
    const b = await refused(await create(cls, exam([ITEMS[0], it])), 400, 'bad_assignment', 'exam');
    assert.equal(b.index, 1, JSON.stringify(it));
  }
  // a whole exam above 48 KB (the body itself is allowed up to 64 KB)
  const big = Array.from({ length: 14 }, (_, i) => ({ ...ITEMS[0], key: `k${i}`, text: 'x'.repeat(600), display: 'd'.repeat(400), solution: Array.from({ length: 8 }, () => 'y'.repeat(300)), hint: 'z'.repeat(300) }));
  const size = JSON.stringify(exam(big)).length;
  assert.ok(size > ASSIGN.examBytes && size < 64 * 1024, `the body is ${size} bytes`);
  await refused(await create(cls, exam(big)), 413, 'too_large');
  assert.throws(() => cleanExamItems(big), (e) => e.status === 413);
  assert.equal(rows(h.env, 'SELECT * FROM assignments').length, 3, 'nothing refused was kept');
});

test('2. caps: 20 open assignments in a class, 30 made in a day', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const ids = [];
  for (let i = 0; i < 20; i++) ids.push((await made(await create(cls, stair({ title: `משימה ${i + 1}` })))).assignment.id);
  await refused(await create(cls, stair()), 409, 'too_many_open');
  assert.equal(countOf(h.env, `assign:c:${cls.code}`), 20, 'a refused one is not counted');
  // assignments due more than 14 days ago are not open
  h.env.DB.raw.prepare('UPDATE assignments SET starts_on = ?, due_on = ? WHERE id = ?').run('2026-10-01', '2026-10-28', ids[0]);
  await made(await create(cls, stair()));
  await refused(await create(cls, stair()), 409, 'too_many_open');
  for (const id of ids.slice(1, 11)) assert.equal((await remove(cls, id)).status, 200);
  for (let i = 0; i < 9; i++) await made(await create(cls, stair()));
  assert.equal(countOf(h.env, `assign:c:${cls.code}`), 30);
  await refused(await create(cls, stair()), 429, 'too_many_assignments');
  // the next day, more
  pin(NOW + DAY);
  await made(await create(cls, stair({ dueOn: '2026-11-18' })));
});

test('3. counts by Jerusalem day: done, started, not started; late after the due day, never by a UTC date', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב', 'נועה'] });
  const [dana, yoav, noa] = cls.students;
  const a = (await made(await create(cls, stair({ dueOn: '2026-11-16' })))).assignment;
  assert.equal((await work(dana, a.id, { state: 'done', stage: 5, passed: true })).status, 200);
  assert.equal((await work(yoav, a.id, { state: 'started', stage: 2 })).status, 200);
  let c = (await listOf(cls)).assignments[0].counts;
  assert.deepEqual(c, { assigned: 3, notStarted: 1, started: 1, done: 1, late: 0 });
  // 23:30 in Jerusalem on the due day (21:30 UTC): on time
  pin(at('2026-11-16', 23, 30));
  assert.equal((await work(yoav, a.id, { state: 'done', stage: 5, passed: false })).status, 200);
  assert.equal(one(h.env, 'SELECT done_day FROM assignment_work WHERE student_id = ?', yoav.studentId).done_day, '2026-11-16');
  c = (await listOf(cls)).assignments[0].counts;
  assert.deepEqual(c, { assigned: 3, notStarted: 1, started: 0, done: 2, late: 0 });
  // 00:30 in Jerusalem the next day is still the 16th in UTC (22:30): late all the same
  pin(at('2026-11-17', 0, 30));
  assert.equal(new Date().toISOString().slice(0, 10), '2026-11-16');
  assert.equal((await work(noa, a.id, { state: 'done', stage: 5, passed: true })).status, 200);
  assert.equal(one(h.env, 'SELECT done_day FROM assignment_work WHERE student_id = ?', noa.studentId).done_day, '2026-11-17');
  c = (await listOf(cls)).assignments[0].counts;
  assert.deepEqual(c, { assigned: 3, notStarted: 0, started: 0, done: 3, late: 1 });
  const d = await (await detail(cls, a.id)).json();
  assert.deepEqual(d.work.map((w) => [w.name, w.state, w.late]), [['דנה', 'done', false], ['יואב', 'done', false], ['נועה', 'done', true]]);
});

test('3. not done when the due day is over counts as late; the detail lists not started, started, then done', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב', 'נועה'] });
  const [dana, yoav] = cls.students;
  const a = (await made(await create(cls, stair({ kind: 'check', dueOn: '2026-11-13' })))).assignment;
  await work(dana, a.id, { state: 'done', right: 4, asked: 5, passed: true });
  await work(yoav, a.id, { state: 'started' });
  pin(at('2026-11-15', 9));
  const c = (await listOf(cls)).assignments[0].counts;
  assert.deepEqual(c, { assigned: 3, notStarted: 1, started: 1, done: 1, late: 2 });
  const d = await (await detail(cls, a.id)).json();
  assert.equal(d.exam, null);
  assert.deepEqual(d.work.map((w) => [w.name, w.state, w.late, w.right, w.asked, w.passed, w.tries]), [
    ['נועה', 'none', true, null, null, null, 0],
    ['יואב', 'started', true, null, null, null, 0],
    ['דנה', 'done', false, 4, 5, true, 1],
  ]);
  assert.ok(d.work[2].doneAt && d.work[1].startedAt && d.work[0].startedAt === null);
});

test('4. targets: an assignment for 2 of 3 students is not the third\'s, and counts 2', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב', 'נועה'] });
  const [dana, yoav, noa] = cls.students;
  const a = (await made(await create(cls, stair({ targets: [dana.studentId, yoav.studentId, dana.studentId] })))).assignment;
  assert.equal(a.forAll, false);
  assert.deepEqual(a.targets, [dana.studentId, yoav.studentId].sort());
  assert.equal(a.counts.assigned, 2);
  assert.deepEqual((await classWork(dana)).assignments.map((x) => x.id), [a.id]);
  assert.deepEqual((await classWork(noa)).assignments, []);
  await refused(await work(noa, a.id, { state: 'started' }), 404, 'not_found');
  await refused(await h.call('GET', `/api/class/work/${a.id}/exam`, { headers: bearer(noa) }), 404, 'not_found');
  const d = await (await detail(cls, a.id)).json();
  assert.deepEqual(d.work.map((w) => w.name).sort(), ['דנה', 'יואב']);
  // a named student who leaves the class is no longer counted
  assert.equal((await h.call('POST', `/api/teacher/students/${yoav.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  const after = (await listOf(cls)).assignments[0];
  assert.deepEqual([after.counts.assigned, after.targets], [1, [dana.studentId]]);
});

test('5. update: a later due date, a note and a title; late recomputes for a student who finishes before the new date', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const [dana] = cls.students;
  const a = (await made(await create(cls, stair({ dueOn: '2026-11-13' })))).assignment;
  pin(at('2026-11-16', 9));
  assert.equal((await listOf(cls)).assignments[0].counts.late, 1, 'past the due day and not done');
  // a past date, too far, or a Saturday that moves
  await refused(await update(cls, a.id, { dueOn: '2026-11-15' }), 400, 'bad_assignment', 'dueOn');
  await refused(await update(cls, a.id, { dueOn: plusDays('2026-11-16', 121) }), 400, 'bad_assignment', 'dueOn');
  await refused(await update(cls, a.id, { title: '  ' }), 400, 'bad_assignment', 'title');
  const r = await made(await update(cls, a.id, { dueOn: '2026-11-21', note: 'עוד יומיים', title: 'חיבור וחיסור' }), 200);
  assert.equal(r.moved, true);
  assert.deepEqual([r.assignment.dueOn, r.assignment.note, r.assignment.title, r.assignment.counts.late], ['2026-11-22', 'עוד יומיים', 'חיבור וחיסור', 0]);
  await work(dana, a.id, { state: 'done', stage: 5, passed: true });
  const d = await (await detail(cls, a.id)).json();
  assert.equal(d.work[0].late, false);
  assert.equal((await listOf(cls)).assignments[0].counts.late, 0);
  assert.deepEqual(rows(h.env, "SELECT detail FROM audit_log WHERE action = 'assignment.update'").map((x) => x.detail), ['{"fields":["due_on","note","title"]}']);
});

test('6. delete: the assignment, its targets and its work go in one batch; another class\'s teacher gets 404', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const other = await makeClass(h, { students: ['זר'] });
  const [dana] = cls.students;
  const a = (await made(await create(cls, stair({ targets: [dana.studentId] })))).assignment;
  const keep = (await made(await create(cls, stair()))).assignment;
  await work(dana, a.id, { state: 'started', stage: 1 });
  await work(dana, keep.id, { state: 'started', stage: 1 });
  // another class's teacher: nothing to see, change or delete
  await refused(await detail(cls, a.id, other.teacher), 404, 'not_found');
  await refused(await update(cls, a.id, { note: 'x' }, other.teacher), 404, 'not_found');
  await refused(await remove(cls, a.id, other.teacher), 404, 'not_found');
  await refused(await detail(cls, 'f'.repeat(16)), 404, 'not_found');
  assert.equal((await h.call('GET', '/api/teacher/assignments', { headers: {} })).status, 401);
  assert.equal((await remove(cls, a.id)).status, 200);
  assert.deepEqual(rows(h.env, 'SELECT * FROM assignments WHERE id = ?', a.id), []);
  assert.deepEqual(rows(h.env, 'SELECT * FROM assignment_targets WHERE assignment_id = ?', a.id), []);
  assert.deepEqual(rows(h.env, 'SELECT * FROM assignment_work WHERE assignment_id = ?', a.id), []);
  assert.equal(rows(h.env, 'SELECT * FROM assignment_work WHERE assignment_id = ?', keep.id).length, 1, 'the other assignment keeps its work');
  await refused(await remove(cls, a.id), 404, 'not_found');
  await refused(await work(dana, a.id, { state: 'done', stage: 5 }), 404, 'not_found');
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'assignment.delete'").n, 1);
});

test('7. removing a student deletes their work and targets; the class\'s assignments stay', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  const a = (await made(await create(cls, stair({ targets: [dana.studentId, yoav.studentId] })))).assignment;
  await work(dana, a.id, { state: 'started', stage: 2 });
  await work(yoav, a.id, { state: 'started', stage: 1 });
  await setCount(h.env, `work:s:${dana.studentId}`, 3);
  assert.equal((await h.call('POST', `/api/teacher/students/${dana.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  for (const t of ['assignment_work', 'assignment_targets']) assert.deepEqual(rows(h.env, `SELECT * FROM ${t} WHERE student_id = ?`, dana.studentId), [], t);
  assert.equal(countOf(h.env, `work:s:${dana.studentId}`), 0, 'her report counter goes too');
  assert.equal(rows(h.env, 'SELECT * FROM assignment_work WHERE student_id = ?', yoav.studentId).length, 1);
  assert.equal(rows(h.env, 'SELECT * FROM assignments').length, 1);
});

test('8. the dashboard: open assignments with counts, mistakes with ids and their stair, class exams with the other exams', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [dana, yoav] = cls.students;
  const ev = (level, cat) => ({ topic: 'signed', level, ok: false, first: false, cat, secs: 20, at: new Date().toISOString() });
  await h.call('POST', '/api/progress', { headers: bearer(dana), body: { events: [ev(3, 'sign'), ev(3, 'sign'), ev(1, 'sign')] } });
  await h.call('POST', '/api/progress', { headers: bearer(yoav), body: { events: [ev(1, 'sign')] } });
  const ex = (await made(await create(cls, { kind: 'exam', title: 'מבחן תרגול: שבוע 3', dueOn: '2026-11-19', exam: { items: ITEMS.slice(0, 3), version: 'a' } }))).assignment;
  const st = (await made(await create(cls, stair()))).assignment;
  // an assignment due long ago is not open
  const old = (await made(await create(cls, stair()))).assignment;
  h.env.DB.raw.prepare('UPDATE assignments SET starts_on = ?, due_on = ? WHERE id = ?').run('2026-10-01', '2026-11-04', old.id);
  const questions = [{ topic: 'signed', level: 1, status: 'correct' }, { topic: 'signed', level: 2, status: 'wrong' }, { topic: 'coord', level: 1, status: 'correct' }];
  assert.equal((await work(dana, ex.id, { state: 'done', right: 2, asked: 3, questions })).status, 200);
  await h.call('POST', '/api/exams', { headers: bearer(yoav), body: { title: 'מבחן מהכיתה', correct: 1, total: 2, questions: [] } });
  const d = await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
  assert.equal(d.mistakes[0].cat, 'sign');
  assert.deepEqual([...d.mistakes[0].ids].sort(), [dana.studentId, yoav.studentId].sort());
  assert.ok(Number.isInteger(d.mistakes[0].level));
  assert.equal(d.mistakes[0].level, 1, 'level 1: three answers against two at level 3');
  assert.deepEqual(d.assignments.map((a) => a.id), [st.id, ex.id], 'open ones, soonest first');
  assert.deepEqual(d.assignments[1].counts, { assigned: 2, notStarted: 1, started: 0, done: 1, late: 0 });
  const mine = d.exams.find((e) => String(e.id).startsWith('a:'));
  assert.deepEqual(mine, {
    id: `a:${ex.id}:${dana.studentId}`, studentId: dana.studentId, name: 'דנה', title: 'מבחן תרגול: שבוע 3', correct: 2, total: 3,
    weak: [], questions, at: mine.at, assignmentId: ex.id,
  });
  // the shape the board's "weak topics in exams" reads: questions[].topic and .status
  for (const q of mine.questions) assert.ok(typeof q.topic === 'string' && ['correct', 'partial', 'wrong', 'missing'].includes(q.status));
  assert.equal(d.exams.length, 2, 'the exam checked in the app is still there');
});

test('9. both credentials: the owner\'s session opens the same routes as the key, and the audit says so', async () => {
  h = await setup(); pin();
  const t = await signIn(h, 'teacher@example.test');
  const c = await (await h.call('POST', '/api/classes', { body: { className: 'ז׳1', teacherName: 'רונית', grade: '7' }, headers: { 'X-Account-Token': t } })).json();
  const s = await (await h.call('POST', `/api/classes/${c.code}/join`, { body: { name: 'דנה', pin: '1234' } })).json();
  const session = { 'X-Class-Code': c.code, 'X-Account-Token': t };
  const key = { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey };
  const cls = { code: c.code, teacher: session };
  const a = (await made(await create(cls, stair({ targets: [s.studentId] })))).assignment;
  assert.equal((await listOf(cls)).assignments.length, 1);
  assert.equal((await listOf(cls, key)).assignments.length, 1, 'the key sees the same');
  assert.equal((await detail(cls, a.id)).status, 200);
  assert.equal((await update(cls, a.id, { note: 'מחר' })).status, 200);
  assert.equal((await remove(cls, a.id)).status, 200);
  assert.deepEqual(rows(h.env, "SELECT action, detail FROM audit_log WHERE action LIKE 'assignment.%' ORDER BY id").map((r) => [r.action, JSON.parse(r.detail).via]),
    [['assignment.create', 'account'], ['assignment.update', 'account'], ['assignment.delete', 'account']]);
  // another email's session opens nothing
  const stranger = await signIn(h, 'other@example.test');
  assert.equal((await h.call('GET', '/api/teacher/assignments', { headers: { 'X-Class-Code': c.code, 'X-Account-Token': stranger } })).status, 401);
});

test('student: the list has only this student\'s started assignments of their own class, not done first, with the teacher\'s name', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const other = await makeClass(h, { students: ['זר'] });
  const [dana, yoav] = cls.students;
  const later = (await made(await create(cls, stair({ dueOn: '2026-11-19', title: 'שבוע הבא' })))).assignment;
  const soon = (await made(await create(cls, stair({ kind: 'check', dueOn: '2026-11-13', title: 'מחר' })))).assignment;
  const done = (await made(await create(cls, stair({ dueOn: '2026-11-12', title: 'היום' })))).assignment;
  await made(await create(cls, stair({ startsOn: '2026-11-15', dueOn: '2026-11-16', title: 'עוד לא' })));
  await made(await create(cls, stair({ targets: [yoav.studentId], title: 'ליואב' })));
  await made(await create(other, stair({ title: 'כיתה אחרת' })));
  await work(dana, done.id, { state: 'done', stage: 5, passed: true });
  const w = await classWork(dana);
  assert.deepEqual([w.today, w.teacherName, w.help], ['2026-11-12', 'רונית', []]);
  assert.deepEqual(w.assignments.map((a) => a.title), ['מחר', 'שבוע הבא', 'היום']);
  assert.deepEqual(w.assignments[0], {
    id: soon.id, kind: 'check', skill: 'signed:1', title: 'מחר', note: '', startsOn: '2026-11-12', dueOn: '2026-11-13', hasExam: false, examCount: null, mine: null,
  });
  assert.deepEqual({ ...w.assignments[2].mine, doneAt: 0 }, { state: 'done', stage: 5, right: null, asked: null, passed: true, doneAt: 0 });
  assert.equal(later.id, w.assignments[1].id);
  // the one that starts on Sunday shows from Sunday
  pin(at('2026-11-15', 8));
  assert.ok((await classWork(dana)).assignments.some((a) => a.title === 'עוד לא'));
  // done ones drop off 14 days after their due date; not done ones stay 30 days
  pin(at('2026-11-27', 8));
  assert.deepEqual((await classWork(dana)).assignments.map((a) => a.title).sort(), ['מחר', 'עוד לא', 'שבוע הבא'].sort());
  pin(at('2026-12-14', 8));
  assert.deepEqual((await classWork(dana)).assignments.map((a) => a.title).sort(), ['עוד לא', 'שבוע הבא'].sort());
  assert.equal((await h.call('GET', '/api/class/work')).status, 401);
});

test('student: the report never goes backwards; the first finished result is kept and every finished try counted', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const [dana] = cls.students;
  const s = (await made(await create(cls, stair()))).assignment;
  const c = (await made(await create(cls, stair({ kind: 'check' })))).assignment;
  const e = (await made(await create(cls, { kind: 'exam', dueOn: '2026-11-19', exam: { items: ITEMS.slice(0, 2) } }))).assignment;
  const mine = async (res) => (await made(res, 200)).mine;
  // a stair: the stage only goes up, done stays done
  assert.deepEqual(await mine(await work(dana, s.id, { state: 'started', stage: 3 })), { state: 'started', stage: 3, right: null, asked: null, passed: null, doneAt: null });
  assert.equal((await mine(await work(dana, s.id, { state: 'started', stage: 1 }))).stage, 3);
  const d1 = await mine(await work(dana, s.id, { state: 'done', stage: 5, passed: false }));
  assert.deepEqual({ ...d1, doneAt: !!d1.doneAt }, { state: 'done', stage: 5, right: null, asked: null, passed: false, doneAt: true });
  const d2 = await mine(await work(dana, s.id, { state: 'started', stage: 2, passed: true }));
  assert.deepEqual([d2.state, d2.stage, d2.passed, d2.doneAt], ['done', 5, true, d1.doneAt], 'done stays done; passed goes up; done_at is set once');
  // a check: the first finished result is the one kept
  await work(dana, c.id, { state: 'started' });
  const first = await mine(await work(dana, c.id, { state: 'done', right: 3, asked: 5, passed: false }));
  pin(NOW + HOUR);
  const again = await mine(await work(dana, c.id, { state: 'done', right: 5, asked: 5, passed: true }));
  assert.deepEqual([again.right, again.asked, again.passed, again.doneAt], [3, 5, true, first.doneAt]);
  const row = one(h.env, 'SELECT tries, started_at, done_day FROM assignment_work WHERE assignment_id = ?', c.id);
  assert.deepEqual([row.tries, row.done_day], [2, '2026-11-12']);
  // an exam: its questions, with the first result
  const q = [{ topic: 'signed', level: 1, status: 'correct' }, { topic: 'signed', level: 2, status: 'wrong' }];
  assert.equal((await mine(await work(dana, e.id, { state: 'done', right: 1, asked: 2, questions: q }))).right, 1);
  await work(dana, e.id, { state: 'done', right: 2, asked: 2, questions: q.map((x) => ({ ...x, status: 'correct' })) });
  assert.deepEqual(JSON.parse(one(h.env, 'SELECT questions FROM assignment_work WHERE assignment_id = ?', e.id).questions), q);
  // the same report twice changes nothing but the count of tries
  assert.equal(one(h.env, 'SELECT tries FROM assignment_work WHERE assignment_id = ?', e.id).tries, 2);
});

test('student: reports that do not fit their assignment are refused; 200 a day', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const [dana] = cls.students;
  const s = (await made(await create(cls, stair()))).assignment;
  const c = (await made(await create(cls, stair({ kind: 'check' })))).assignment;
  const e = (await made(await create(cls, { kind: 'exam', dueOn: '2026-11-19', exam: { items: ITEMS.slice(0, 2) } }))).assignment;
  const no = (id, body, field) => refused(work(dana, id, body), 400, 'bad_work', field);
  const q = [{ topic: 'signed', level: 1, status: 'correct' }];
  await refused(await work(dana, s.id, { state: 'finished' }), 400, 'bad_work', 'state');
  await refused(await work(dana, s.id, { state: 'done', questions: q }), 400, 'bad_work', 'questions');
  await refused(await work(dana, s.id, { state: 'done', right: 1, asked: 1 }), 400, 'bad_work', 'right');
  await refused(await work(dana, s.id, { state: 'started', stage: 6 }), 400, 'bad_work', 'stage');
  await refused(await work(dana, s.id, { state: 'started', stage: 2.5 }), 400, 'bad_work', 'stage');
  await refused(await work(dana, s.id, { state: 'done', passed: 'yes' }), 400, 'bad_work', 'passed');
  await refused(await work(dana, c.id, { state: 'done', stage: 5, right: 1, asked: 5 }), 400, 'bad_work', 'stage');
  await refused(await work(dana, c.id, { state: 'done' }), 400, 'bad_work', 'right');
  await refused(await work(dana, c.id, { state: 'started', right: 1, asked: 5 }), 400, 'bad_work', 'right');
  await refused(await work(dana, c.id, { state: 'done', right: 6, asked: 5 }), 400, 'bad_work', 'right');
  await refused(await work(dana, c.id, { state: 'done', right: 1, asked: 41 }), 400, 'bad_work', 'asked');
  await refused(await work(dana, c.id, { state: 'done', right: 0, asked: 0 }), 400, 'bad_work', 'asked');
  await refused(await work(dana, e.id, { state: 'done', right: 1, asked: 2, passed: true }), 400, 'bad_work', 'passed');
  await refused(await work(dana, e.id, { state: 'done', right: 1, asked: 2, questions: [{ topic: 'bogus', level: 1, status: 'correct' }] }), 400, 'bad_work', 'questions');
  await refused(await work(dana, e.id, { state: 'done', right: 1, asked: 2, questions: [{ topic: 'signed', level: 1, status: 'great' }] }), 400, 'bad_work', 'questions');
  await refused(await work(dana, e.id, { state: 'done', right: 1, asked: 2, questions: Array.from({ length: 41 }, () => q[0]) }), 400, 'bad_work', 'questions');
  assert.equal(rows(h.env, 'SELECT * FROM assignment_work').length, 0, 'nothing refused was kept');
  await refused(await work(dana, 'a'.repeat(16), { state: 'started' }), 404, 'not_found');
  assert.equal((await h.call('POST', `/api/class/work/${s.id}`, { body: { state: 'started' } })).status, 401);
  // the exam's questions: only for a student it is assigned to, and only for an exam
  const items = await h.call('GET', `/api/class/work/${e.id}/exam`, { headers: bearer(dana) });
  assert.equal(items.status, 200);
  assert.equal(JSON.stringify((await items.json()).items), JSON.stringify(ITEMS.slice(0, 2)));
  await refused(await h.call('GET', `/api/class/work/${s.id}/exam`, { headers: bearer(dana) }), 404, 'not_found');
  // 200 reports a day
  await setCount(h.env, `work:s:${dana.studentId}`, ASSIGN.workPerDay);
  await refused(await work(dana, s.id, { state: 'started', stage: 1 }), 429, 'slow_down');
  pin(NOW + DAY);
  assert.equal((await work(dana, s.id, { state: 'started', stage: 1 })).status, 200);
});

test('the night purge deletes an assignment 400 days after its due date, with its work and targets; 399 days stays', async () => {
  h = await setup(); pin();
  const cls = await makeClass(h, { students: ['דנה'] });
  const [dana] = cls.students;
  const oldA = (await made(await create(cls, stair({ targets: [dana.studentId] })))).assignment;
  const keep = (await made(await create(cls, stair({ targets: [dana.studentId] })))).assignment;
  await work(dana, oldA.id, { state: 'done', stage: 5, passed: true });
  await work(dana, keep.id, { state: 'started', stage: 1 });
  const dayAgo = (n) => dayOf(new Date(Date.now() - n * DAY));
  h.env.DB.raw.prepare('UPDATE assignments SET starts_on = ?, due_on = ? WHERE id = ?').run(dayAgo(R.assignments + 5), dayAgo(R.assignments + 1), oldA.id);
  h.env.DB.raw.prepare('UPDATE assignments SET starts_on = ?, due_on = ? WHERE id = ?').run(dayAgo(R.assignments + 5), dayAgo(R.assignments - 1), keep.id);
  const report = await purge(h.env);
  assert.equal(report.class.assignments, 1);
  assert.deepEqual(rows(h.env, 'SELECT id FROM assignments').map((r) => r.id), [keep.id]);
  for (const t of ['assignment_work', 'assignment_targets']) assert.deepEqual(rows(h.env, `SELECT assignment_id FROM ${t}`).map((r) => r.assignment_id), [keep.id], t);
});
