// The class report (spec TEACHER-7 §1) against the in-memory D1: the same numbers as the board's week, a range that
// leaves out the days outside it, the 400-day cap, assignments with each student's work keyed by row (never an id), the
// class's repeated mistakes, another class seeing only its own, and 60 reports an hour. Every name is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { reportRange, REPORT } from '../src/classReport.js';
import { hourOf } from '../src/util.js';
import { setup, makeClass, bearer, advanceClock, rows } from './helpers.js';

let h;
afterEach(() => h?.done());
// Thursday 12 November 2026, 10:00 in Jerusalem (UTC+2): the board's week is 6 to 12 November
const NOW = Date.parse('2026-11-12T08:00:00Z');
const pinClock = () => advanceClock(NOW - Date.now());
const ev = (topic, at, { ok = true, first = ok, cat = null, secs = 30, hint = false, level = 1 } = {}) => ({ topic, level, ok, first, hint, cat, secs, at });
const progress = (s, body) => h.call('POST', '/api/progress', { headers: bearer(s), body });
const report = (cls, q = '', headers = cls.teacher) => h.call('GET', `/api/teacher/report${q}`, { headers });
const reportOf = async (cls, q = '') => {
  const res = await report(cls, q);
  const b = await res.json();
  assert.equal(res.status, 200, JSON.stringify(b));
  return b;
};
const dashboardOf = async (cls) => (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();

/** Every key anywhere in a JSON value. */
function keysOf(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
}

/** A class of three with practice this week, last week and long ago, and a mistake made by two of them. */
async function practisedClass() {
  pinClock();
  const cls = await makeClass(h, { students: ['נועה', 'דנה', 'יואב'] });
  const [noa, dana, yoav] = cls.students;
  // דנה: four today (one wrong, one with a hint), two on Tuesday, one on 1 November (outside the week)
  await progress(dana, { events: [
    ev('signed', '2026-11-12T07:00:00Z'), ev('signed', '2026-11-12T07:01:00Z', { hint: true, first: false }),
    ev('signed', '2026-11-12T07:05:00Z', { ok: false, cat: 'sign', secs: 90 }), ev('signed', '2026-11-12T07:06:00Z'),
    ev('signed', '2026-11-10T15:00:00Z'), ev('signed', '2026-11-10T15:02:00Z', { first: false }),
    ev('coord', '2026-11-01T09:00:00Z', { ok: false, cat: 'swap', level: 2 }),
  ], levels: { signed: { level: 2, max: 3 } } });
  // יואב: three on Monday (two mistakes), one just after midnight on 6 November in Jerusalem (in the week) and one
  // just before it (not)
  await progress(yoav, { events: [
    ev('signed', '2026-11-09T12:00:00Z'), ev('signed', '2026-11-09T12:01:00Z', { ok: false, cat: 'sign' }),
    ev('signed', '2026-11-09T12:02:00Z', { ok: false, cat: 'order', level: 2 }),
    ev('coord', '2026-11-05T22:30:00Z'), ev('signed', '2026-11-05T21:30:00Z', { ok: false, cat: 'sign' }),
  ], levels: { signed: { level: 1, max: 1 }, coord: { level: 2, max: 2 } } });
  // נועה: once, on 2 November
  await progress(noa, { events: [ev('signed', '2026-11-02T12:00:00Z', { ok: false, cat: 'sign' })] });
  return { cls, dana, yoav, noa };
}

test('the report of this week has the board\'s numbers, by name, with the stairs, mistakes and last practice', async () => {
  h = await setup();
  const { cls } = await practisedClass();
  const d = await dashboardOf(cls);
  const r = await reportOf(cls, '?from=2026-11-06&to=2026-11-12');
  assert.equal(r.from, '2026-11-06');
  assert.equal(r.to, '2026-11-12');
  assert.equal(r.today, '2026-11-12');
  assert.match(r.generatedAt, /^2026-11-12T08:0/);
  assert.deepEqual(r.class, { name: 'ז׳3', grade: '7', teacherName: 'רונית' });
  assert.deepEqual(r.students.map((s) => s.name), ['דנה', 'יואב', 'נועה'], 'ordered by name');
  // the same week as the board, student by student
  for (const s of r.students) {
    const b = d.students.find((x) => x.name === s.name);
    assert.deepEqual({ exercises: s.exercises, firstTry: s.firstTry, activeDays: s.activeDays, minutes: s.minutes }, {
      exercises: b.week.n, firstTry: b.week.first, activeDays: b.week.days, minutes: b.week.minutes,
    }, s.name);
    assert.equal(s.lastPractice, b.lastPractice, `${s.name}: the last practice`);
    assert.deepEqual(s.levels, b.levels);
  }
  const [dana, yoav, noa] = r.students;
  assert.deepEqual(
    { activeDays: dana.activeDays, exercises: dana.exercises, firstTry: dana.firstTry, correct: dana.correct, hinted: dana.hinted, minutes: dana.minutes },
    { activeDays: 2, exercises: 6, firstTry: 3, correct: 5, hinted: 1, minutes: 4 },
  );
  assert.equal(dana.joinedOn, '2026-11-12');
  assert.deepEqual(dana.topMistakes, [{ topic: 'signed', cat: 'sign', level: 1, n: 1 }], 'the coord mistake of 1 November is outside');
  // one row per stair and mistake; a tie in the stairs' order
  assert.deepEqual(yoav.topMistakes, [{ topic: 'signed', cat: 'sign', level: 1, n: 1 }, { topic: 'signed', cat: 'order', level: 2, n: 1 }]);
  assert.deepEqual({ exercises: noa.exercises, activeDays: noa.activeDays, firstTry: noa.firstTry, topMistakes: noa.topMistakes }, { exercises: 0, activeDays: 0, firstTry: 0, topMistakes: [] });
  assert.equal(noa.lastPractice, '2026-11-02T12:00:00.000Z');
  // the class's mistakes: the board's rows, with names only
  assert.deepEqual(r.mistakes, d.mistakes.map(({ ids, ...m }) => m));
  assert.deepEqual(r.mistakes[0], { topic: 'signed', cat: 'sign', level: 1, n: 2, students: 2, names: ['דנה', 'יואב'] });
  assert.deepEqual(r.assignments, []);
});

test('a range leaves out the days outside it; a later "to" is today; no range is the last 14 days', async () => {
  h = await setup();
  const { cls } = await practisedClass();
  // Tuesday 10 November only: דנה's two answers, nobody else
  const tue = await reportOf(cls, '?from=2026-11-10&to=2026-11-10');
  assert.deepEqual(tue.students.map((s) => [s.name, s.exercises, s.activeDays]), [['דנה', 2, 1], ['יואב', 0, 0], ['נועה', 0, 0]]);
  assert.equal(tue.students[0].lastPractice, '2026-11-10T15:02:00.000Z', 'the last practice up to the range\'s end');
  assert.equal(tue.students[1].lastPractice, '2026-11-09T12:02:00.000Z');
  assert.deepEqual(tue.mistakes, []);
  // the first week of November: נועה's and דנה's old answers, and יואב's of 5 November
  const early = await reportOf(cls, '?from=2026-11-01&to=2026-11-05');
  assert.deepEqual(early.students.map((s) => [s.name, s.exercises]), [['דנה', 1], ['יואב', 1], ['נועה', 1]]);
  assert.deepEqual(early.students[0].topMistakes, [{ topic: 'coord', cat: 'swap', level: 2, n: 1 }]);
  assert.deepEqual(early.mistakes.map((m) => [m.topic, m.cat, m.students]), [['signed', 'sign', 2], ['coord', 'swap', 1]]);
  // a "to" after today is today; no range: the 14 days that end today
  const ahead = await reportOf(cls, '?from=2026-11-06&to=2027-01-01');
  assert.equal(ahead.to, '2026-11-12');
  const plain = await reportOf(cls);
  assert.deepEqual([plain.from, plain.to], ['2026-10-30', '2026-11-12']);
  assert.deepEqual(plain.students.map((s) => s.exercises), [7, 5, 1]);
  // only "to": the 14 days that end then
  assert.deepEqual(Object.values(reportRange(new URLSearchParams('to=2026-11-05'), '2026-11-12')), ['2026-10-23', '2026-11-05']);
});

test('a range of 401 days is cut to its last 400; a bad day or a reversed range is 400 bad_range', async () => {
  h = await setup();
  pinClock();
  const cls = await makeClass(h, { students: ['דנה'] });
  // 7 October 2025 to 11 November 2026, both ends counted, is 401 days: the last 400 are given
  const r = await reportOf(cls, '?from=2025-10-07&to=2026-11-11');
  assert.deepEqual([r.from, r.to], ['2025-10-08', '2026-11-11']);
  assert.equal((Date.parse(r.to) - Date.parse(r.from)) / 864e5 + 1, REPORT.maxDays);
  const exact = await reportOf(cls, '?from=2025-10-08&to=2026-11-11');
  assert.equal(exact.from, '2025-10-08', '400 days are kept whole');
  assert.equal((await reportOf(cls, '?from=2026-11-12&to=2026-11-12')).from, '2026-11-12', 'one day is a range');
  for (const q of ['?from=2026-11-13&to=2026-11-12', '?from=12.11.2026', '?to=2026-13-40', '?from=2026-11-05&to=yesterday']) {
    const res = await report(cls, q);
    assert.equal(res.status, 400, q);
    assert.equal((await res.json()).error, 'bad_range');
  }
});

test('assignments in the range carry each student\'s work by row, never an id; another class sees only its own', async () => {
  h = await setup();
  const { cls, dana, yoav } = await practisedClass();
  const make = async (body) => (await (await h.call('POST', '/api/teacher/assignments', { headers: cls.teacher, body })).json()).assignment;
  // for all, due today; a check for יואב only, due next Monday (open in the range); one starting next week (not in it)
  const all = await make({ kind: 'stair', skill: 'signed:1', title: 'חיבור וחיסור', dueOn: '2026-11-12' });
  const mine = await make({ kind: 'check', skill: 'signed:2', title: '=HYPERLINK("x")', dueOn: '2026-11-16', targets: [yoav.studentId] });
  await make({ kind: 'stair', skill: 'coord:1', title: 'בשבוע הבא', startsOn: '2026-11-15', dueOn: '2026-11-19' });
  const work = (s, id, body) => h.call('POST', `/api/class/work/${id}`, { headers: bearer(s), body });
  assert.equal((await work(dana, all.id, { state: 'done', stage: 5, passed: true })).status, 200);
  assert.equal((await work(yoav, all.id, { state: 'started', stage: 2 })).status, 200);
  assert.equal((await work(yoav, mine.id, { state: 'done', right: 4, asked: 5, passed: true })).status, 200);

  const r = await reportOf(cls, '?from=2026-11-06&to=2026-11-12');
  assert.deepEqual(r.assignments.map((a) => [a.title, a.kind, a.skill, a.dueOn]), [
    ['חיבור וחיסור', 'stair', 'signed:1', '2026-11-12'],
    ['=HYPERLINK("x")', 'check', 'signed:2', '2026-11-16'],
  ]);
  const [stair, check] = r.assignments;
  // rows: 0 דנה, 1 יואב, 2 נועה
  assert.deepEqual(stair.work, {
    0: { state: 'done', stage: 5, right: null, asked: null, passed: true, tries: 1, late: false },
    1: { state: 'started', stage: 2, right: null, asked: null, passed: null, tries: 0, late: false },
    2: { state: 'none', stage: null, right: null, asked: null, passed: null, tries: 0, late: false },
  });
  assert.deepEqual(check.work, { 1: { state: 'done', stage: null, right: 4, asked: 5, passed: true, tries: 1, late: false } }, 'only the student it was for');
  // the next day: the stair's date has passed for those who did not finish it
  advanceClock(24 * 3600_000);
  const later = await reportOf(cls, '?from=2026-11-06&to=2026-11-13');
  assert.deepEqual(Object.values(later.assignments[0].work).map((w) => w.late), [false, true, true]);

  // no id anywhere: no student id, no assignment id, not even as a value
  const keys = keysOf(later);
  assert.ok(!keys.has('id') && !keys.has('studentId') && !keys.has('ids') && !keys.has('code'), [...keys].join(','));
  const text = JSON.stringify(later);
  for (const s of cls.students) assert.ok(!text.includes(s.studentId), 'a student id');
  for (const a of [all, mine]) assert.ok(!text.includes(a.id), 'an assignment id');
  assert.ok(!text.includes(cls.code), 'the class code');

  // another class: its own teacher sees its own students only; its key does not open this class
  const other = await makeClass(h, { students: ['זר'] });
  await progress(other.students[0], { events: [ev('signed', '2026-11-12T07:00:00Z', { ok: false, cat: 'sign' })] });
  const theirs = await reportOf(other);
  assert.deepEqual(theirs.students.map((s) => s.name), ['זר']);
  assert.deepEqual(theirs.assignments, []);
  assert.doesNotMatch(JSON.stringify(theirs), /דנה|יואב|נועה|חיבור וחיסור/);
  assert.doesNotMatch(JSON.stringify(await reportOf(cls, '?from=2026-11-06')), /זר/);
  assert.equal((await report(cls, '', { ...cls.teacher, 'X-Teacher-Key': other.teacherKey })).status, 401);
  assert.equal((await h.call('GET', '/api/teacher/report')).status, 401);
});

test('60 reports an hour per class (429 too_many_class_reports); the next hour opens again; another class has its own', async () => {
  h = await setup();
  pinClock();
  const cls = await makeClass(h, { students: ['דנה'] });
  const other = await makeClass(h, { students: ['זר'] });
  h.env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, ?)').run(`report:c:${cls.code}`, hourOf(), REPORT.perHour - 1);
  assert.equal((await report(cls)).status, 200);
  const res = await report(cls);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_class_reports');
  assert.equal((await report(other)).status, 200);
  advanceClock(3600_000);
  assert.equal((await report(cls)).status, 200);
  // deleting the class takes its report counter with it (forget.js CLASS_COUNTERS)
  assert.ok(rows(h.env, 'SELECT who FROM ai_usage WHERE who = ?', `report:c:${cls.code}`).length > 0);
  assert.equal((await h.call('POST', '/api/teacher/class/delete', { headers: cls.teacher, body: { confirm: 'DELETE' } })).status, 200);
  assert.equal(rows(h.env, 'SELECT who FROM ai_usage WHERE who = ?', `report:c:${cls.code}`).length, 0);
});

// ---------------------------------------------------------------- one student's page (TEACHER-8 §1)
const detail = (cls, id, headers = cls.teacher) => h.call('GET', `/api/teacher/students/${id}`, { headers });
const detailOf = async (cls, id) => {
  const res = await detail(cls, id);
  const b = await res.json();
  assert.equal(res.status, 200, JSON.stringify(b));
  return b;
};

test('a student\'s page: 14 day rows with the empty days as zeros, the stairs, the last 30 days\' mistakes, last practice', async () => {
  h = await setup();
  const { cls, dana, yoav, noa } = await practisedClass();
  const d = await detailOf(cls, dana.studentId);
  assert.deepEqual(d.student, { id: dana.studentId, name: 'דנה', joinedOn: '2026-11-12', lastPractice: '2026-11-12T07:06:00.000Z', pinReset: false, aiOff: false });
  assert.equal(d.days14.length, 14);
  assert.deepEqual([d.days14[0].day, d.days14.at(-1).day], ['2026-10-30', '2026-11-12'], 'oldest first, ending today');
  const byDay = Object.fromEntries(d.days14.map((x) => [x.day, x]));
  assert.deepEqual(byDay['2026-11-12'], { day: '2026-11-12', n: 4, first: 2, minutes: 3 });
  assert.deepEqual(byDay['2026-11-10'], { day: '2026-11-10', n: 2, first: 1, minutes: 1 });
  assert.deepEqual(byDay['2026-11-01'], { day: '2026-11-01', n: 1, first: 0, minutes: 1 });
  assert.deepEqual(byDay['2026-11-11'], { day: '2026-11-11', n: 0, first: 0, minutes: 0 }, 'a day with no practice');
  assert.equal(d.days14.filter((x) => x.n > 0).length, 3);
  assert.deepEqual(d.levels, { signed: { level: 2, max: 3 } });
  assert.deepEqual(d.mistakes, [
    { topic: 'signed', cat: 'sign', level: 1, n: 1, lastAt: '2026-11-12T07:05:00.000Z' },
    { topic: 'coord', cat: 'swap', level: 2, n: 1, lastAt: '2026-11-01T09:00:00.000Z' },
  ]);
  assert.deepEqual([d.work, d.help, d.exams], [[], [], []]);
  // יואב: his two mistakes on 9 November and the one of 5 November (all in 30 days); one row per stair
  const y = await detailOf(cls, yoav.studentId);
  assert.deepEqual(y.mistakes.map((m) => [m.cat, m.level, m.n]), [['sign', 1, 2], ['order', 2, 1]]);
  // never practised: no last practice, every day zero
  const fresh = await makeClass(h, { students: ['רוני'] });
  const r = await detailOf(fresh, fresh.students[0].studentId);
  assert.equal(r.student.lastPractice, null);
  assert.ok(r.days14.every((x) => x.n === 0 && x.minutes === 0));
  // 30 days later, the mistakes have aged out and the strip is empty; the stairs stay
  advanceClock(31 * 864e5);
  const later = await detailOf(cls, noa.studentId);
  assert.deepEqual(later.mistakes, []);
  assert.ok(later.days14.every((x) => x.n === 0));
  assert.equal(later.student.lastPractice, '2026-11-02T12:00:00.000Z');
});

test('a student\'s page opens only that class\'s student: 404 for another class\'s, an unknown id, and 401 without the key', async () => {
  h = await setup();
  const { cls, dana } = await practisedClass();
  const other = await makeClass(h, { students: ['זר'] });
  for (const [c, id] of [[cls, other.students[0].studentId], [other, dana.studentId], [cls, 'abcdef0123456789']]) {
    const res = await detail(c, id);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'not_found');
  }
  assert.equal((await detail(cls, dana.studentId, { ...cls.teacher, 'X-Teacher-Key': other.teacherKey })).status, 401);
  assert.equal((await h.call('GET', `/api/teacher/students/${dana.studentId}`)).status, 401);
  // a PIN reset shows on the page
  await h.call('POST', `/api/teacher/students/${dana.studentId}/reset-pin`, { headers: cls.teacher, body: {} });
  assert.equal((await detailOf(cls, dana.studentId)).student.pinReset, true);
});

test('a student\'s page: the work given to that student (late as in the report), their help with its status, their exams', async () => {
  h = await setup();
  const { cls, dana, yoav } = await practisedClass();
  const make = async (body) => (await (await h.call('POST', '/api/teacher/assignments', { headers: cls.teacher, body })).json()).assignment;
  const all = await make({ kind: 'stair', skill: 'signed:1', title: 'חיבור וחיסור', dueOn: '2026-11-12' });
  const forYoav = await make({ kind: 'check', skill: 'signed:2', title: 'בדיקה ליואב', dueOn: '2026-11-16', targets: [yoav.studentId] });
  const work = (s, id, body) => h.call('POST', `/api/class/work/${id}`, { headers: bearer(s), body });
  assert.equal((await work(dana, all.id, { state: 'done', stage: 5, passed: true })).status, 200);
  assert.equal((await work(yoav, forYoav.id, { state: 'done', right: 4, asked: 5, passed: true })).status, 200);
  // help: דנה asks twice; the teacher answers one; the other is closed
  const ask = (s, question) => h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 1, question, answer: '5', note: 'לא הבנתי' } });
  await ask(dana, '3 - 8'); await ask(dana, '-2 - 4'); await ask(yoav, '7 - 9');
  const ids = rows(h.env, 'SELECT h.id, h.question FROM help_requests h ORDER BY h.id').map((r) => r.id);
  assert.equal((await h.call('POST', `/api/teacher/help/${ids[0]}/reply`, { headers: cls.teacher, body: { body: 'מתחילים מ־3 והולכים 8 שמאלה.' } })).status, 201);
  assert.equal((await h.call('POST', `/api/teacher/help/${ids[1]}`, { headers: cls.teacher, body: { action: 'done' } })).status, 200);
  // an exam checked in the app
  assert.equal((await h.call('POST', '/api/exams', { headers: bearer(dana), body: { title: 'מבחן במספרים מכוונים', correct: 7, total: 10, questions: [{ topic: 'signed', status: 'correct', level: 1 }, { topic: 'signed', status: 'wrong', level: 2 }] } })).status, 200);

  const d = await detailOf(cls, dana.studentId);
  assert.deepEqual(d.work, [{ assignmentId: all.id, title: 'חיבור וחיסור', kind: 'stair', dueOn: '2026-11-12', state: 'done', stage: 5, right: null, asked: null, passed: true, late: false }]);
  assert.deepEqual(d.help.map((x) => [x.question, x.status]), [['-2 - 4', 'done'], ['3 - 8', 'answered']]);
  assert.deepEqual(Object.keys(d.help[0]).sort(), ['createdAt', 'id', 'question', 'status', 'topic']);
  assert.deepEqual(d.exams.map((e) => [e.title, e.correct, e.total, e.questions.length]), [['מבחן במספרים מכוונים', 7, 10, 2]]);
  const y = await detailOf(cls, yoav.studentId);
  assert.deepEqual(y.work.map((w) => [w.title, w.state, w.late]), [['בדיקה ליואב', 'done', false], ['חיבור וחיסור', 'none', false]]);
  assert.deepEqual(y.help.map((x) => [x.question, x.status]), [['7 - 9', 'sent']]);
  assert.deepEqual(y.exams, []);
  // the next day the class's stair is late for יואב, who did not start it; and the board counts it for the attention list
  advanceClock(864e5);
  const next = await detailOf(cls, yoav.studentId);
  assert.deepEqual(next.work.find((w) => w.assignmentId === all.id).late, true);
  const board = await dashboardOf(cls);
  assert.deepEqual(board.students.map((s) => [s.name, s.late]), [['דנה', 0], ['יואב', 1], ['נועה', 1]]);
  assert.ok(board.students.every((s) => s.joinedOn === '2026-11-12'));
  assert.deepEqual(board.help.map((x) => x.studentId).sort(), [dana.studentId, dana.studentId, yoav.studentId].sort(), 'help rows say whose they are');
});
