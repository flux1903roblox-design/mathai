// The class goal of the week (STUDENT-4): steps sent with the progress sync, the per-student daily and weekly caps, the
// two-day window for late steps (no backdating into past days or weeks), the weekly
// target fixed at its first read, the student's and the teacher's views, Jerusalem week boundaries in winter and
// summer, retention and removal. In-memory D1; nothing leaves the machine.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, bearer, rows, one } from './helpers.js';
import { goalFor, teacherGoal, weekOf, shiftDay, autoTarget, GOAL, stepStatements, firstStepDay } from '../src/goal.js';
import { purgeRecordsSql } from '../src/cron.js';
import { dayOf } from '../src/util.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const uuid = () => crypto.randomUUID();
const step = (pts = 1, at = new Date().toISOString(), sid = uuid()) => ({ sid, pts, at });
const many = (n, pts = 1, at) => Array.from({ length: n }, () => step(pts, at));
const sync = (s, steps, events = []) => h.call('POST', '/api/progress', { headers: bearer(s), body: { events, steps } });
const read = async (s) => { const r = await h.call('GET', '/api/class/goal', { headers: bearer(s) }); assert.equal(r.status, 200); return r.json(); };
const who = (cls, s) => ({ id: s.studentId, class_code: cls.code });
const thisWeek = () => weekOf(dayOf());
/** Noon UTC on a day: the same date in Jerusalem, summer or winter. */
const noon = (day) => `${day}T10:00:00.000Z`;
/** Students written straight into the database (for classes too big to join one by one). */
function addStudents(env, code, n, prefix = 'x') {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = `${prefix}${String(i).padStart(7, '0')}`;
    env.DB.raw.prepare("INSERT INTO students (id, class_code, name, pin_hash, token_hash, created_at) VALUES (?, ?, ?, 'p', ?, 'x')").run(id, code, `תלמיד ${prefix}${i}`, `t-${id}`);
    ids.push(id);
  }
  return ids;
}
/** A sync as the server would take it at `now` (an ISO time): the steps' statements, run; returns how many counted. */
async function syncAt(cls, s, steps, now) {
  const stmts = stepStatements(h.env, who(cls, s), steps, Date.parse(now));
  const res = stmts.length ? await h.env.DB.batch(stmts) : [];
  return res.reduce((n, r) => n + Number(r?.meta?.changes || 0), 0);
}
/** A step written straight into the database: one synced in its own week, long ago. */
const addStep = (env, id, code, day, pts = 1) => env.DB.raw.prepare('INSERT INTO class_steps (sid, student_id, class_code, day, pts, at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uuid(), id, code, day, pts, noon(day));

test('weekOf, shiftDay and the automatic size', () => {
  assert.equal(weekOf('2026-11-08'), '2026-11-08', 'a Sunday is its own week');
  assert.equal(weekOf('2026-11-14'), '2026-11-08', 'Saturday closes the week');
  assert.equal(weekOf('2026-11-10'), '2026-11-08');
  assert.equal(weekOf('2026-03-01'), '2026-03-01');
  assert.equal(weekOf('2027-01-01'), '2026-12-27', 'across a new year');
  assert.equal(shiftDay('2026-03-27', 2), '2026-03-29', 'calendar days, whatever the clock change');
  assert.equal(autoTarget(3), 15, '3 active: 4 x 3 = 12, up to 15');
  assert.equal(autoTarget(0), 10);
  assert.equal(autoTarget(2), 10, '2 students: 8, at least 10');
  assert.equal(autoTarget(120), 400, 'at most 400');
});

test('1. the same step id sent twice (a retry, a second tab) is one row', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const s = step(1);
  const r = await sync(noa, [s, s]);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { saved: 0, steps: 1 });
  assert.deepEqual(await (await sync(noa, [s])).json(), { saved: 0, steps: 0 }, 'a retry counts nothing');
  assert.equal(rows(h.env, 'SELECT * FROM class_steps').length, 1);
  const row = one(h.env, 'SELECT * FROM class_steps');
  assert.equal(row.student_id, noa.studentId); assert.equal(row.class_code, cls.code); assert.equal(row.day, dayOf()); assert.equal(row.pts, 1);
  // the answers in the same sync are saved as before
  const withEvents = await sync(noa, [step(3)], [{ topic: 'neg', level: 1, ok: true, first: true, secs: 5 }]);
  assert.deepEqual(await withEvents.json(), { saved: 1, steps: 1 });
  assert.equal(rows(h.env, 'SELECT * FROM attempts').length, 1);
  assert.equal((await read(noa)).mine, 4);
});

test('2. a step worth 5, a bad id or a missing student is ignored; a future time is clamped; at most 50 a sync', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const future = new Date(Date.now() + 3 * DAY).toISOString();
  const r = await sync(noa, [step(5), step(0), step('1'), step(2), { sid: 'not-a-uuid', pts: 1 }, { sid: uuid().toUpperCase(), pts: 1 }, { pts: 1 }, null, 'x', step(1, future)]);
  assert.deepEqual(await r.json(), { saved: 0, steps: 1 });
  const row = one(h.env, 'SELECT * FROM class_steps');
  assert.equal(row.day, dayOf(), 'the future step lands today');
  assert.ok(Date.parse(row.at) <= Date.now());
  // a step with no time, or a broken one, is now
  await sync(noa, [{ sid: uuid(), pts: 1 }, { sid: uuid(), pts: 1, at: 'yesterday' }]);
  assert.equal(rows(h.env, 'SELECT * FROM class_steps WHERE day = ?', dayOf()).length, 3);
  // only the first 50 steps of a sync are read: 50 that are not steps, then 10 good ones, count nothing
  const padded = [...Array.from({ length: GOAL.maxItems }, () => step(5)), ...many(10, 1)];
  assert.deepEqual(await (await sync(noa, padded)).json(), { saved: 0, steps: 0 });
  assert.deepEqual(await (await sync(noa, padded.slice(GOAL.maxItems))).json(), { saved: 0, steps: 10 }, 'the same 10 alone count');
  assert.equal((await h.call('POST', '/api/progress', { body: { steps: [step(1)] } })).status, 401, 'a class token is needed');
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(noa), body: { steps: 'many' } })).status, 200, 'steps that are not a list are ignored');
});

test('3. the target is automatic from active students, and fixed at the week\'s first read', async () => {
  h = await setup();
  const week = thisWeek();
  // five students, three of them with a step in the 14 days before this week: 3 x 4 = 12 -> 15
  const a = await makeClass(h, { students: ['א', 'ב', 'ג', 'ד', 'ה'] });
  for (const [i, s] of a.students.slice(0, 3).entries()) addStep(h.env, s.studentId, a.code, shiftDay(week, -(i * 5 + 1)));
  // a step 15 days before the week is too old to make anyone active
  addStep(h.env, a.students[3].studentId, a.code, shiftDay(week, -15));
  const g = await read(a.students[4]);
  assert.equal(g.target, 15);
  assert.equal(g.week, week); assert.equal(g.have, 0); assert.equal(g.mine, 0); assert.equal(g.reached, false);
  // students who join mid-week do not move it
  for (const name of ['ו', 'ז', 'ח', 'ט']) await h.call('POST', `/api/classes/${a.code}/join`, { body: { name, pin: '1234' } });
  addStudents(h.env, a.code, 30);
  assert.equal((await read(a.students[0])).target, 15, 'fixed for the week');
  assert.equal(one(h.env, 'SELECT target FROM class_goal_weeks WHERE class_code = ? AND week = ?', a.code, week).target, 15);
  // next week looks at its own 14 days before: two of the three steps are in them (2 active: 8 -> 10)
  assert.equal((await goalFor(h.env, who(a, a.students[0]), new Date(Date.now() + 7 * DAY))).target, 10);

  // nobody active: the size of the class. 2 students: 8 -> 10
  const b = await makeClass(h, { students: ['נועה', 'איתי'] });
  assert.equal((await read(b.students[0])).target, 10);
  // 120 active: 480 -> 400
  const c = await makeClass(h);
  for (const id of addStudents(h.env, c.code, 120, 'c')) addStep(h.env, id, c.code, shiftDay(week, -2));
  const [first] = addStudents(h.env, c.code, 1, 'z');
  assert.equal((await goalFor(h.env, { id: first, class_code: c.code })).target, 400);
});

test('3a. one student adds at most 30 points and 6 three-point steps in a Jerusalem day', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי', 'דנה'] });
  const [noa, itai, dana] = cls.students;
  const r = await sync(noa, many(40, 1));
  assert.deepEqual(await r.json(), { saved: 0, steps: 30 }, '40 one-point steps: 30 count, the rest are dropped without an error');
  assert.equal(one(h.env, 'SELECT SUM(pts) AS n FROM class_steps WHERE student_id = ?', noa.studentId).n, 30);
  assert.equal((await (await sync(noa, many(1, 1))).json()).steps, 0, 'the day is full');
  assert.deepEqual(await (await sync(itai, many(8, 3))).json(), { saved: 0, steps: 6 }, '8 three-point steps: 6 count');
  assert.equal(one(h.env, 'SELECT SUM(pts) AS n FROM class_steps WHERE student_id = ?', itai.studentId).n, 18);
  assert.equal((await (await sync(itai, many(20, 1))).json()).steps, 12, 'then ones up to 30 points');
  // a resent batch counts nothing and uses none of the cap
  const batch = many(5, 3);
  assert.equal((await (await sync(dana, batch)).json()).steps, 5);
  assert.equal((await (await sync(dana, [...batch, step(3)])).json()).steps, 1, 'the sixth three-point step still counts after a retry');
  assert.equal((await read(noa)).have, 30 + 30 + 18, 'this week: 30 + 30 + 18');
});

test('3b. the day cap is per day, and one student adds at most 60 points in a week', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  // Tuesday 10 Nov 2026 at noon in Jerusalem: Sunday and Monday are still open, Tuesday is today
  const tue = '2026-11-10T10:00:00.000Z';
  assert.equal(await syncAt(cls, noa, many(30, 1, noon('2026-11-10')), tue), 30, 'today: 30');
  assert.equal(await syncAt(cls, noa, many(20, 1, noon('2026-11-09')), tue), 20, 'yesterday is a day of its own');
  assert.equal(await syncAt(cls, noa, many(20, 1, noon('2026-11-08')), tue), 10, 'Sunday: only up to the week\'s 60');
  assert.equal(await syncAt(cls, noa, many(2, 3, noon('2026-11-11')), '2026-11-11T10:00:00.000Z'), 0, 'Wednesday: the week is full');
  const g = await goalFor(h.env, who(cls, noa), new Date('2026-11-11T10:00:00.000Z'));
  assert.equal(g.mine, GOAL.weekPts); assert.equal(g.have, 60);
  // another student has a week of their own, and a new week starts from nothing
  assert.equal(await syncAt(cls, itai, many(5, 3, noon('2026-11-11')), '2026-11-11T10:00:00.000Z'), 5);
  assert.equal(await syncAt(cls, noa, many(3, 1, noon('2026-11-15')), '2026-11-15T10:00:00.000Z'), 3, 'next Sunday counts again');
});

test('3c. a backdated step counts only on the last two days and never in a past week (no burst fills the goal)', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  assert.equal(firstStepDay(Date.parse('2026-11-11T10:00:00.000Z')), '2026-11-09', 'Wednesday: Monday on');
  assert.equal(firstStepDay(Date.parse('2026-11-09T10:00:00.000Z')), '2026-11-08', 'Monday: Sunday on, not last week');
  assert.equal(firstStepDay(Date.parse('2026-11-08T10:00:00.000Z')), '2026-11-08', 'Sunday: Sunday only');
  // Saturday 14 Nov: a script sends 30 steps for every day since last Sunday, and for the week before
  const sat = '2026-11-14T10:00:00.000Z';
  const burst = [];
  for (let d = -13; d <= 0; d++) burst.push(...many(30, 1, noon(shiftDay('2026-11-14', d))));
  let counted = 0;
  for (let i = 0; i < burst.length; i += GOAL.maxItems) counted += await syncAt(cls, noa, burst.slice(i, i + GOAL.maxItems), sat);
  assert.equal(counted, GOAL.weekPts, 'Thursday to Saturday are open, and the week holds 60');
  const days = rows(h.env, 'SELECT DISTINCT day FROM class_steps WHERE student_id = ? ORDER BY day', noa.studentId).map((r) => r.day);
  assert.deepEqual(days, ['2026-11-12', '2026-11-13'], 'nothing before Thursday; Saturday found the week already full');
  const g = await goalFor(h.env, who(cls, itai), new Date(sat));
  assert.equal(g.have, 60, 'a classmate sees at most 60 from one student');
  assert.ok(g.have < 30 * 7);
  // last week's total (what the class scarf reads) cannot be raised from the new week
  const before = await goalFor(h.env, who(cls, noa), new Date('2026-11-07T10:00:00.000Z'));
  assert.equal(await syncAt(cls, itai, many(10, 1, noon('2026-11-07')), '2026-11-08T08:00:00.000Z'), 0, 'Sunday morning: Saturday\'s steps are last week\'s');
  assert.equal((await goalFor(h.env, who(cls, noa), new Date('2026-11-08T10:00:00.000Z'))).last.have, before.have);
  // the same through the real sync, today: steps older than two days count nothing
  const old = many(10, 1, noon(shiftDay(dayOf(), -3)));
  assert.equal((await (await sync(itai, old)).json()).steps, 0);
});

test('4. a teacher\'s size applies from next week, or at once when this week has no steps yet', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa] = cls.students;
  const set = (body, headers = cls.teacher) => h.call('POST', '/api/teacher/class/goal', { headers, body });
  assert.equal((await set({ on: true, target: 50 }, {})).status, 401, 'teacher key needed');
  for (const bad of [{ target: 50 }, { on: 'yes', target: 50 }, { on: true, target: 5 }, { on: true, target: 401 }, { on: true, target: 12.5 }, { on: true, target: '50' }]) {
    assert.equal((await set(bad)).status, 400, JSON.stringify(bad));
  }
  // this week has no steps: the new size applies at once
  assert.equal((await read(noa)).target, 10);
  let r = await set({ on: true, target: 40 });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).goal, { on: true, week: thisWeek(), target: 40, have: 0, reached: false, custom: 40 });
  assert.equal((await read(noa)).target, 40);
  // a week under way keeps its target; the next week takes the new one
  await sync(noa, [step(1)]);
  r = await set({ on: true, target: 60 });
  assert.equal((await r.json()).goal.target, 40, 'this week keeps 40');
  assert.equal((await read(noa)).target, 40);
  assert.equal((await goalFor(h.env, who(cls, noa), new Date(Date.now() + 7 * DAY))).target, 60, 'next week: 60');
  // back to automatic (null), from the week after
  await set({ on: true, target: null });
  assert.equal(one(h.env, 'SELECT target FROM class_goal_settings WHERE class_code = ?', cls.code).target, null);
  assert.equal((await goalFor(h.env, who(cls, noa), new Date(Date.now() + 14 * DAY))).target, 10);
  const audit = rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'class.goal'");
  assert.equal(audit.length, 3);
  assert.deepEqual(JSON.parse(audit[2].detail), { on: true, target: null });
  assert.equal(audit[0].actor, `teacher:${cls.code}`);
});

test('5. a goal the teacher turned off answers { on: false }, and comes back when turned on', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  await sync(noa, [step(1)]);
  await h.call('POST', '/api/teacher/class/goal', { headers: cls.teacher, body: { on: false, target: null } });
  assert.deepEqual(await read(noa), { on: false });
  const dash = await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
  assert.deepEqual(dash.goal, { on: false, week: thisWeek(), target: null, have: 1, reached: false, custom: null });
  // steps still count while it is off, so turning it back on mid-week loses nothing
  await sync(noa, [step(3)]);
  await h.call('POST', '/api/teacher/class/goal', { headers: cls.teacher, body: { on: true, target: null } });
  const g = await read(noa);
  assert.equal(g.on, true); assert.equal(g.have, 4); assert.equal(g.mine, 4);
});

test('6. a student sees the class total and their own share, never another student\'s id, name or share', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי', 'דנה'] });
  const [noa, itai, dana] = cls.students;
  const week = thisWeek();
  // last week (synced back then), read once by someone, so it has a target
  for (let i = 0; i < 5; i++) addStep(h.env, itai.studentId, cls.code, shiftDay(week, -3));
  for (let i = 0; i < 2; i++) addStep(h.env, noa.studentId, cls.code, shiftDay(week, -2));
  await goalFor(h.env, who(cls, dana), new Date(Date.parse(noon(shiftDay(week, -1)))));
  await sync(noa, [step(3), step(1)]);
  await sync(itai, many(6, 1));
  await sync(dana, many(2, 3));
  const g = await read(noa);
  assert.deepEqual(Object.keys(g).sort(), ['have', 'last', 'mine', 'on', 'reached', 'target', 'week']);
  assert.deepEqual(Object.keys(g.last).sort(), ['have', 'mine', 'reached', 'target', 'week']);
  assert.equal(g.have, 16); assert.equal(g.mine, 4); assert.equal(g.week, week);
  // last week's target was fixed by its own first read: nobody active before it, so the class size (3: 12 -> 15)
  assert.deepEqual(g.last, { week: shiftDay(week, -7), target: 15, have: 7, reached: false, mine: 2 });
  const text = JSON.stringify(g);
  for (const s of [itai, dana]) { assert.ok(!text.includes(s.studentId)); assert.ok(!text.includes(s.name)); }
  assert.ok(!text.includes(noa.studentId) && !text.includes(noa.name), 'not even their own id or name');
  // a week nobody read before has no last
  const fresh = await makeClass(h, { students: ['רון'] });
  assert.equal((await read(fresh.students[0])).last, null);
  assert.equal((await h.call('GET', '/api/class/goal')).status, 401, 'a class token is needed');
  // the teacher sees the total only
  const dash = await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
  assert.deepEqual(dash.goal, { on: true, week, target: g.target, have: 16, reached: g.have >= g.target, custom: null });
});

test('7. reached_at is set once, and a reached week stays reached', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  const week = thisWeek();
  assert.equal((await read(noa)).target, 10);
  await sync(noa, many(4, 1));
  let g = await read(noa);
  assert.equal(g.reached, false);
  assert.equal(one(h.env, 'SELECT reached_at FROM class_goal_weeks WHERE class_code = ? AND week = ?', cls.code, week).reached_at, null);
  await sync(itai, many(2, 3));
  g = await read(itai);
  assert.equal(g.have, 10); assert.equal(g.reached, true);
  const at = one(h.env, 'SELECT reached_at FROM class_goal_weeks WHERE class_code = ? AND week = ?', cls.code, week).reached_at;
  assert.ok(at);
  await sync(noa, many(3, 1));
  await read(noa);
  await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher });
  assert.equal(one(h.env, 'SELECT reached_at FROM class_goal_weeks WHERE class_code = ? AND week = ?', cls.code, week).reached_at, at, 'set once');
  // a student who leaves takes their steps; the class keeps the goal it reached
  await h.call('POST', `/api/teacher/students/${itai.studentId}/remove`, { headers: cls.teacher, body: {} });
  g = await read(noa);
  assert.equal(g.have, 7); assert.equal(g.reached, true);
});

test('8. week boundaries follow Jerusalem: Saturday 23:30 is the old week, Sunday 00:10 the new one, winter and summer', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const me = who(cls, noa);
  const cases = [
    // winter (UTC+2): Saturday 7 Nov 2026 23:30 and Sunday 8 Nov 00:10
    { sat: '2026-11-07T21:30:00.000Z', sun: '2026-11-07T22:10:00.000Z', satDay: '2026-11-07', sunDay: '2026-11-08' },
    // summer (UTC+3): Saturday 13 Jun 2026 23:30 and Sunday 14 Jun 00:10
    { sat: '2026-06-13T20:30:00.000Z', sun: '2026-06-13T21:10:00.000Z', satDay: '2026-06-13', sunDay: '2026-06-14' },
    // the night summer time ends (Sunday 25 Oct 2026, 02:00 -> 01:00): still UTC+3 at midnight
    { sat: '2026-10-24T20:30:00.000Z', sun: '2026-10-24T21:10:00.000Z', satDay: '2026-10-24', sunDay: '2026-10-25' },
    // the weekend summer time starts (Friday 27 Mar 2026): back to UTC+3 by Saturday night
    { sat: '2026-03-28T20:30:00.000Z', sun: '2026-03-28T21:10:00.000Z', satDay: '2026-03-28', sunDay: '2026-03-29' },
  ];
  for (const c of cases) {
    // each step synced as it happens (a step from a week that has ended no longer counts)
    assert.equal(await syncAt(cls, noa, [step(1, c.sat)], c.sat), 1);
    assert.equal(await syncAt(cls, noa, [step(3, c.sun)], c.sun), 1);
    assert.equal(one(h.env, 'SELECT day FROM class_steps WHERE at = ?', c.sat).day, c.satDay);
    assert.equal(one(h.env, 'SELECT day FROM class_steps WHERE at = ?', c.sun).day, c.sunDay);
    assert.equal(weekOf(c.sunDay), c.sunDay, 'Sunday starts a week');
    // read just before and just after midnight
    const before = await goalFor(h.env, me, new Date(Date.parse(c.sat) + 10 * 60_000));
    const after = await goalFor(h.env, me, new Date(Date.parse(c.sun) + 10 * 60_000));
    assert.equal(before.week, shiftDay(c.sunDay, -7)); assert.equal(before.have, 1, `${c.satDay}: the Saturday step only`);
    assert.equal(after.week, c.sunDay); assert.equal(after.have, 3, `${c.sunDay}: the Sunday step only`);
    assert.deepEqual(after.last, { week: before.week, target: before.target, have: 1, reached: false, mine: 1 });
  }
});

test('9. the nightly purge drops steps after 120 days and weeks after 400; removing a student removes their steps', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  const today = dayOf();
  addStep(h.env, noa.studentId, cls.code, shiftDay(today, -121));
  addStep(h.env, noa.studentId, cls.code, shiftDay(today, -119));
  await sync(noa, [step(1)]);
  await sync(itai, [step(1)]);
  h.env.DB.raw.prepare('INSERT INTO class_goal_weeks (class_code, week, target) VALUES (?, ?, 10), (?, ?, 10)')
    .run(cls.code, weekOf(shiftDay(today, -402)), cls.code, weekOf(shiftDay(today, -390)));
  await h.env.DB.batch(purgeRecordsSql(h.env));
  assert.deepEqual(rows(h.env, 'SELECT day FROM class_steps WHERE student_id = ? ORDER BY day', noa.studentId).map((r) => r.day), [shiftDay(today, -119), today]);
  assert.deepEqual(rows(h.env, 'SELECT week FROM class_goal_weeks').map((r) => r.week), [weekOf(shiftDay(today, -390))]);
  const r = await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} });
  assert.equal(r.status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM class_steps WHERE student_id = ?', noa.studentId).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM class_steps WHERE student_id = ?', itai.studentId).length, 1, 'the other student keeps theirs');
  assert.equal((await teacherGoal(h.env, cls.code)).have, 1);
});
