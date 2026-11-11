// The demo class (spec TEACHER-15 §1): built the same way every time, 24 invented students with a first name and one
// letter, 3 assignments, 4 help requests and 6 finished class exams; every group of "מחר" and every reason of "כדאי
// לבדוק איתם" has content; and demoApi answers each teacher route in the Worker's shapes (the fields the Worker's
// handlers return: worker/src/index.js dashboard, report.js, assignments.js, help.js, classai.js, licence.js).
import { describe, it, expect } from 'vitest';
import { demoState, demoApi, mulberry32, DEMO_NAMES } from './teacherDemo.js';
import { attentionList, openHelpBy } from '@/learn/attention';
import { classAiPolicy } from '@shared/schoolRules.js';

const DAY = '2026-11-05'; // a Thursday
const keys = (o) => Object.keys(o).sort();
const call = (st, method, path, body) => demoApi(st, method, path, body);
const get = (st, path) => { const r = call(st, 'GET', path); expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body; };

const SHAPES = {
  dashboard: ['aiPolicy', 'assignments', 'boundAt', 'boundElsewhere', 'class', 'exams', 'help', 'helpDigest', 'joinLocked', 'mistakes', 'rekeyFrom', 'students', 'today'],
  cls: ['code', 'grade', 'name', 'teacherName'],
  student: ['aiOff', 'id', 'joinedOn', 'lastPractice', 'lastSeen', 'late', 'levels', 'name', 'pinReset', 'today', 'week'],
  today: ['first', 'minutes', 'n', 'ok'],
  week: ['days', 'first', 'minutes', 'n'],
  exam: ['assignmentId', 'at', 'correct', 'id', 'name', 'questions', 'studentId', 'title', 'total', 'weak'],
  boardMistake: ['cat', 'ids', 'level', 'n', 'names', 'students', 'topic'],
  assignment: ['counts', 'createdAt', 'dueOn', 'examCount', 'forAll', 'hasExam', 'id', 'kind', 'note', 'skill', 'startsOn', 'targets', 'title', 'version'],
  counts: ['assigned', 'done', 'late', 'notStarted', 'started'],
  help: ['answer', 'care', 'created_at', 'done_at', 'has_image', 'id', 'kind', 'level', 'messages', 'name', 'note', 'question', 'seen_at', 'studentId', 'topic', 'unreadFromStudent'],
  message: ['at', 'body', 'from', 'id', 'read'],
  aiPolicy: ['canTurnOn', 'consentAt', 'consentFormUrl', 'consentPdfUrl', 'fromGrade', 'reason', 'rulesUrl', 'rulesVersion', 'setting', 'studentAi', 'students', 'teacherAi'],
  report: ['assignments', 'class', 'from', 'generatedAt', 'mistakes', 'students', 'to', 'today'],
  reportClass: ['grade', 'name', 'teacherName'],
  reportStudent: ['activeDays', 'correct', 'exercises', 'firstTry', 'hinted', 'joinedOn', 'lastPractice', 'levels', 'minutes', 'name', 'topMistakes'],
  topMistake: ['cat', 'level', 'n', 'topic'],
  reportAssignment: ['dueOn', 'kind', 'skill', 'title', 'work'],
  reportWork: ['asked', 'late', 'passed', 'right', 'stage', 'state', 'tries'],
  reportMistake: ['cat', 'level', 'n', 'names', 'students', 'topic'],
  page: ['days14', 'exams', 'help', 'levels', 'mistakes', 'student', 'work'],
  pageStudent: ['aiOff', 'id', 'joinedOn', 'lastPractice', 'name', 'pinReset'],
  pageDay: ['day', 'first', 'minutes', 'n'],
  pageMistake: ['cat', 'lastAt', 'level', 'n', 'topic'],
  pageWork: ['asked', 'assignmentId', 'dueOn', 'kind', 'late', 'passed', 'right', 'stage', 'state', 'title'],
  pageHelp: ['createdAt', 'id', 'question', 'status', 'topic'],
  pageExam: ['at', 'correct', 'id', 'questions', 'title', 'total'],
  detail: ['assignment', 'exam', 'work'],
  detailWork: ['asked', 'doneAt', 'late', 'name', 'passed', 'questions', 'right', 'stage', 'startedAt', 'state', 'studentId', 'tries'],
  licence: ['aiWeek', 'joinLocked', 'legacyUntil', 'offer', 'request', 'seats', 'status', 'students', 'until'],
};

describe('demoState: one class, the same every time', () => {
  it('is deterministic, and Math.random is left as it was', () => {
    const random = Math.random;
    expect(demoState(7, DAY)).toEqual(demoState(7, DAY));
    expect(Math.random).toBe(random);
    expect(demoState(8, DAY)).not.toEqual(demoState(7, DAY));
    const r1 = mulberry32(7); const r2 = mulberry32(7);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
  it('DEMO01, ז׳3 (דוגמה), grade 7: 24 students, 3 assignments (a stair, a check, a class exam), 4 help requests', () => {
    const st = demoState(7, DAY);
    expect(st.cls).toEqual({ code: 'DEMO01', name: 'ז׳3 (דוגמה)', grade: '7', teacherName: 'מורה לדוגמה' });
    expect(st.students).toHaveLength(24);
    expect(st.assignments.map((a) => a.kind)).toEqual(['stair', 'check', 'exam']);
    expect(st.assignments[2].exam).toHaveLength(6);
    expect(st.assignments[2].exam.every((it) => ['signed'].includes(it.topic) && [1, 2].includes(it.level))).toBe(true);
    expect(st.help).toHaveLength(4);
    // one answered and closed; one where the student wrote "עדיין לא ברור לי" after the teacher; two new
    const thread = (id) => st.messages.filter((m) => m.helpId === id).map((m) => `${m.from}:${m.body.slice(0, 16)}`);
    expect(st.help.filter((h) => h.doneAt).length).toBe(1);
    expect(thread(9002).at(-1)).toBe('student:עדיין לא ברור לי');
    expect(st.help.filter((h) => !h.seenAt)).toHaveLength(2);
  });
  it('the names are a first name and one letter with a dot: never a real-looking full name', () => {
    expect(new Set(DEMO_NAMES).size).toBe(24);
    for (const n of DEMO_NAMES) expect(n).toMatch(/^[א-ת]+ [א-ת]\.$/);
  });
});

describe('the board has content in every group', () => {
  const st = demoState(7, DAY);
  const d = get(st, '/api/teacher/dashboard');
  it('the overview tiles, the repeated mistakes, the help and six finished class exams', () => {
    expect(d.students.filter((s) => s.today.n > 0).length).toBeGreaterThan(3);
    expect(d.students.filter((s) => s.week.n > 0).length).toBeGreaterThan(15);
    expect(d.mistakes.length).toBeGreaterThan(3);
    expect(d.mistakes[0].students).toBeGreaterThan(3);
    // one row per stair and mistake, as the Worker groups them (TEACHER-16)
    const keys = d.mistakes.map((m) => `${m.topic}:${m.level}:${m.cat}`);
    expect(new Set(keys).size).toBe(keys.length);
    const weekStart = new Date(Date.parse(`${DAY}T12:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10);
    const rows = st.attempts.filter((r) => r.cat && r.day >= weekStart);
    for (const m of d.mistakes) {
      const mine = rows.filter((r) => r.topic === m.topic && r.level === m.level && r.cat === m.cat);
      expect(m.n).toBe(mine.length);
      expect([...m.ids].sort()).toEqual([...new Set(mine.map((r) => r.sid))].sort());
    }
    expect(d.help.filter((h) => !h.done_at)).toHaveLength(3);
    expect(d.exams).toHaveLength(6);
    expect(d.assignments).toHaveLength(3);
    expect(d.assignments.find((a) => a.kind === 'stair').counts.late).toBeGreaterThan(3);
  });
  it('"כדאי לבדוק איתם" has every reason (idle, never started, low, help, late) and more than six students', () => {
    const helpBy = openHelpBy(d.help);
    const { all, more } = attentionList(d.students.map((s) => ({ ...s, openHelp: helpBy[s.id] || 0 })), d.today);
    const kinds = new Set(all.flatMap((a) => a.reasons.map((r) => r.kind)));
    expect([...kinds].sort()).toEqual(['help', 'idle', 'late', 'low']);
    expect(all.some((a) => a.reasons.some((r) => r.kind === 'idle' && r.never))).toBe(true);
    expect(more).toBeGreaterThan(0);
  });
  it('the class is a school class while Madregot is not in the catalogue: student AI off, no switch', () => {
    expect(d.aiPolicy).toMatchObject({ ...classAiPolicy({ setting: 'school', grade: '7' }, { approval: 'none' }), setting: 'school', consentAt: null });
    expect(d.aiPolicy.reason).toBe('not_in_catalogue');
  });
});

describe('demoApi answers in the Worker\'s shapes', () => {
  it('GET /api/teacher/dashboard', () => {
    const d = get(demoState(7, DAY), '/api/teacher/dashboard');
    expect(keys(d)).toEqual(SHAPES.dashboard);
    expect(keys(d.class)).toEqual(SHAPES.cls);
    expect(d.today).toBe(DAY);
    expect(d.students.map((s) => s.name)).toEqual([...d.students.map((s) => s.name)].sort());
    for (const s of d.students) { expect(keys(s)).toEqual(SHAPES.student); expect(keys(s.today)).toEqual(SHAPES.today); expect(keys(s.week)).toEqual(SHAPES.week); }
    for (const e of d.exams) expect(keys(e)).toEqual(SHAPES.exam);
    for (const m of d.mistakes) { expect(keys(m)).toEqual(SHAPES.boardMistake); expect(m.ids).toHaveLength(m.students); expect(Number.isInteger(m.level)).toBe(true); }
    for (const a of d.assignments) { expect(keys(a)).toEqual(SHAPES.assignment); expect(keys(a.counts)).toEqual(SHAPES.counts); }
    for (const h of d.help) { expect(keys(h)).toEqual(SHAPES.help); expect([0, 1]).toContain(h.has_image); h.messages.forEach((m) => expect(keys(m)).toEqual(SHAPES.message)); }
    expect(keys(d.aiPolicy)).toEqual(SHAPES.aiPolicy);
    expect(d.helpDigest).toBeNull();
  });
  it('GET /api/teacher/report (the default 14 days, a range, a bad range)', () => {
    const st = demoState(7, DAY);
    const r = get(st, '/api/teacher/report');
    expect(keys(r)).toEqual(SHAPES.report);
    expect([r.from, r.to]).toEqual(['2026-10-23', DAY]);
    expect(keys(r.class)).toEqual(SHAPES.reportClass);
    expect(r.students).toHaveLength(24);
    for (const s of r.students) { expect(keys(s)).toEqual(SHAPES.reportStudent); s.topMistakes.forEach((m) => expect(keys(m)).toEqual(SHAPES.topMistake)); }
    expect(r.students.reduce((t, s) => t + s.exercises, 0)).toBeGreaterThan(300);
    for (const a of r.assignments) { expect(keys(a)).toEqual(SHAPES.reportAssignment); Object.values(a.work).forEach((w) => expect(keys(w)).toEqual(SHAPES.reportWork)); }
    for (const m of r.mistakes) expect(keys(m)).toEqual(SHAPES.reportMistake);
    expect(JSON.stringify(r)).not.toMatch(/de0000/); // no student id anywhere in the report
    const week = get(st, `/api/teacher/report?from=2026-11-01&to=${DAY}`);
    expect([week.from, week.to]).toEqual(['2026-11-01', DAY]);
    expect(call(st, 'GET', '/api/teacher/report?from=2026-11-09&to=2026-11-01')).toEqual({ status: 400, body: { error: 'bad_range' } });
  });
  it('GET /api/teacher/students/:id, and 404 for a student not in the class', () => {
    const st = demoState(7, DAY);
    const id = st.students[2].id;
    const p = get(st, `/api/teacher/students/${id}`);
    expect(keys(p)).toEqual(SHAPES.page);
    expect(keys(p.student)).toEqual(SHAPES.pageStudent);
    expect(p.days14).toHaveLength(14);
    expect(p.days14.at(-1).day).toBe(DAY);
    p.days14.forEach((x) => expect(keys(x)).toEqual(SHAPES.pageDay));
    p.mistakes.forEach((x) => expect(keys(x)).toEqual(SHAPES.pageMistake));
    p.work.forEach((x) => expect(keys(x)).toEqual(SHAPES.pageWork));
    p.help.forEach((x) => expect(keys(x)).toEqual(SHAPES.pageHelp));
    p.exams.forEach((x) => expect(keys(x)).toEqual(SHAPES.pageExam));
    expect(p.help.map((x) => x.status)).toEqual(['done']);
    expect(call(st, 'GET', '/api/teacher/students/ffff0000')).toEqual({ status: 404, body: { error: 'not_found' } });
  });
  it('assignments: the list, one with a row per student, a new one (a Saturday moves to Sunday), a later date, delete', () => {
    const st = demoState(7, DAY);
    const list = get(st, '/api/teacher/assignments');
    expect(keys(list)).toEqual(['assignments', 'today']);
    // the latest due first (a tie: the newest first): on this Thursday the check's Saturday moved to Sunday, the exam's day
    expect(list.assignments.map((a) => [a.kind, a.dueOn])).toEqual([['check', '2026-11-08'], ['exam', '2026-11-08'], ['stair', '2026-11-02']]);
    const exam = list.assignments.find((a) => a.kind === 'exam');
    const one = get(st, `/api/teacher/assignments/${exam.id}`);
    expect(keys(one)).toEqual(SHAPES.detail);
    expect(one.exam.items).toHaveLength(6);
    expect(one.work).toHaveLength(24);
    one.work.forEach((w) => expect(keys(w)).toEqual(SHAPES.detailWork));
    expect(one.work.filter((w) => w.state === 'done')).toHaveLength(6);
    expect(one.work.at(-1).state).toBe('done'); // not started first, then started, then done
    const made = call(st, 'POST', '/api/teacher/assignments', { kind: 'stair', skill: 'coord:2', title: 'מערכת צירים: רביעים', dueOn: '2026-11-07', targets: [st.students[0].id] });
    expect(made.status).toBe(201);
    expect(keys(made.body)).toEqual(['assignment', 'moved']);
    expect(made.body.moved).toBe(true);
    expect(made.body.assignment).toMatchObject({ dueOn: '2026-11-08', forAll: false, targets: [st.students[0].id], counts: { assigned: 1, notStarted: 1, started: 0, done: 0, late: 0 } });
    expect(get(st, '/api/teacher/assignments').assignments).toHaveLength(4);
    expect(get(st, '/api/teacher/dashboard').assignments.map((a) => a.id)).toContain(made.body.assignment.id);
    expect(call(st, 'POST', '/api/teacher/assignments', { kind: 'stair', skill: 'nope:1', dueOn: '2026-11-07' })).toEqual({ status: 400, body: { error: 'bad_assignment', field: 'skill' } });
    expect(call(st, 'POST', '/api/teacher/assignments', { kind: 'stair', skill: 'signed:1', dueOn: '2026-10-01' }).body.field).toBe('dueOn');
    const later = call(st, 'POST', `/api/teacher/assignments/${made.body.assignment.id}`, { dueOn: '2026-11-12' });
    expect(later.body.assignment.dueOn).toBe('2026-11-12');
    expect(call(st, 'POST', `/api/teacher/assignments/${made.body.assignment.id}/delete`, {})).toEqual({ status: 200, body: { ok: true } });
    expect(get(st, '/api/teacher/assignments').assignments).toHaveLength(3);
  });
  it('help: a reply (with the contact guard and the limit of three), seen, done and open again', () => {
    const st = demoState(7, DAY);
    const r = call(st, 'POST', '/api/teacher/help/9003/reply', { body: 'הנקודה ב־x שלילי ו־y חיובי: הרביע השני.' });
    expect(r.status).toBe(201);
    expect(keys(r.body)).toEqual(['message']);
    expect(keys(r.body.message)).toEqual(SHAPES.message);
    const row = get(st, '/api/teacher/dashboard').help.find((h) => h.id === 9003);
    expect(row.messages.at(-1).from).toBe('teacher');
    expect(row.seen_at).toBeTruthy();
    expect(call(st, 'POST', '/api/teacher/help/9003/reply', { body: 'כתבו לי ל־teacher@example.test' }).body.error).toBe('reply_has_contact');
    // the Worker's guard (shared/contact.js): a phone number with other separators, full-width digits, a handle
    for (const bad of ['תתקשרי אליי 050_123_4567', 'המספר שלי ０５０１２３４５６７', 'באינסטגרם @dana_k12']) {
      expect(call(st, 'POST', '/api/teacher/help/9003/reply', { body: bad }).body.error).toBe('reply_has_contact');
    }
    call(st, 'POST', '/api/teacher/help/9003/reply', { body: 'עוד הסבר' });
    call(st, 'POST', '/api/teacher/help/9003/reply', { body: 'ועוד אחד' });
    expect(call(st, 'POST', '/api/teacher/help/9003/reply', { body: 'רביעי' })).toEqual({ status: 409, body: { error: 'reply_limit' } });
    expect(call(st, 'POST', '/api/teacher/help/9002', { action: 'done' })).toEqual({ status: 200, body: { ok: true } });
    expect(get(st, '/api/teacher/dashboard').help.find((h) => h.id === 9002).unreadFromStudent).toBe(0);
    call(st, 'POST', '/api/teacher/help/9002', { action: 'reopen' });
    expect(get(st, '/api/teacher/dashboard').help.find((h) => h.id === 9002).done_at).toBeNull();
    expect(call(st, 'POST', '/api/teacher/help/9002', { action: 'archive' }).status).toBe(400);
  });
  it('the class: lock, rename, student AI by the rules, per student, PIN, removal; delete and keys refused; the licence is none', () => {
    const st = demoState(7, DAY);
    expect(get(st, '/api/teacher/licence')).toMatchObject({ status: 'none' });
    expect(keys(get(st, '/api/teacher/licence'))).toEqual(SHAPES.licence);
    expect(call(st, 'POST', '/api/teacher/class/lock', { locked: true }).body).toEqual({ joinLocked: true });
    expect(call(st, 'POST', '/api/teacher/class/rename', { className: '  ז׳3   מורחבת ' }).body).toEqual({ ok: true, className: 'ז׳3 מורחבת' });
    expect(call(st, 'POST', '/api/teacher/class/ai', { studentAi: 'on' })).toEqual({ status: 409, body: { error: 'class_ai_locked', reason: 'not_in_catalogue' } });
    expect(call(st, 'POST', '/api/teacher/class/ai', { setting: 'private' }).body.error).toBe('private_attest_required');
    const priv = call(st, 'POST', '/api/teacher/class/ai', { setting: 'private', privateAttest: true });
    expect(keys(priv.body)).toEqual(['policy']);
    expect(priv.body.policy).toMatchObject({ setting: 'private', reason: 'consent_needed' });
    const on = call(st, 'POST', '/api/teacher/class/ai', { consent: true, studentAi: 'on' });
    expect(on.body.policy).toMatchObject({ students: 'on', reason: 'ok' });
    const id = st.students[0].id;
    expect(call(st, 'POST', `/api/teacher/students/${id}/ai`, { off: true }).body).toEqual({ id, aiOff: true });
    expect(get(st, `/api/teacher/students/${id}`).student.aiOff).toBe(true);
    expect(call(st, 'POST', `/api/teacher/students/${id}/reset-pin`, {}).body).toEqual({ ok: true });
    expect(call(st, 'POST', `/api/teacher/students/${id}/remove`, {}).body).toEqual({ ok: true });
    expect(get(st, '/api/teacher/dashboard').students).toHaveLength(23);
    for (const p of ['/api/teacher/class/delete', '/api/teacher/class/rekey', '/api/teacher/class/owner']) expect(call(st, 'POST', p, { confirm: 'DELETE' })).toEqual({ status: 403, body: { error: 'demo_readonly' } });
    expect(call(st, 'GET', '/api/teacher/nothing-here')).toEqual({ status: 404, body: { error: 'not_found' } });
    expect(call(st, 'GET', '/api/teacher/help/9001/image').status).toBe(404);
  });
});
