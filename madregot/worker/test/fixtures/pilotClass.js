// A synthetic class for the pilot's numbers (TEACHER-11): 10 students over the 14 days 15-28 November 2026 (Sunday to
// Saturday, two school weeks), with known activity, two assignments, a class exam before and after, and help requests
// with the teacher's answers. Another class next to it must never be counted. Invented ids and names only.
export const CLASS = 'ABC234';
export const OTHER = 'XYZ789';
export const FROM = '2026-11-15';
export const TO = '2026-11-28';
export const STUDENTS = Array.from({ length: 10 }, (_, i) => `st${i}-7f3a9c2e1d`);
export const A1 = 'aaaaaaaaaaaaaaa1'; // stair signed:2, the whole class, due 19.11
export const A2 = 'aaaaaaaaaaaaaaa2'; // check signed:2, four students, due 24.11
export const PRE = 'bbbbbbbbbbbbbbb1'; // class exam, due 15.11
export const POST = 'bbbbbbbbbbbbbbb2'; // class exam, due 30.11 (after the range: --post still finds it)

/** Days each student practised (five answers of a minute each per day). Week 1: 8 of 10; week 2: 6 of those and s8. */
export const ACTIVE = {
  0: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25'],
  1: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-22', '2026-11-23', '2026-11-24'],
  2: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-22', '2026-11-23', '2026-11-24'],
  3: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-22', '2026-11-23'],
  4: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-22', '2026-11-23'],
  5: ['2026-11-16', '2026-11-17', '2026-11-22'],
  6: ['2026-11-17'],
  7: ['2026-11-19'],
  8: ['2026-11-26'],
  9: [],
};
const EARLY = new Set(['2026-11-15', '2026-11-16', '2026-11-17']);

/** Fill the database (node:sqlite under the memoryD1 look-alike). */
export function seedPilot(env) {
  const db = env.DB.raw;
  const at = '2026-11-01T08:00:00.000Z';
  const cls = db.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES (?, 'ז׳3', '7', 'מורה', 'x', ?)");
  cls.run(CLASS, at); cls.run(OTHER, at);
  const stu = db.prepare("INSERT INTO students (id, class_code, name, pin_hash, token_hash, created_at) VALUES (?, ?, ?, 'x', 'x', ?)");
  STUDENTS.forEach((id, i) => stu.run(id, CLASS, `תלמיד ${i} ב.`, at));
  stu.run('other-student-1', OTHER, 'תלמידה מכיתה אחרת', at);
  const att = db.prepare('INSERT INTO attempts (student_id, topic, level, ok, first_try, hint, cat, secs, day, at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)');
  STUDENTS.forEach((id, i) => {
    for (const day of ACTIVE[i]) {
      // the stair the class was given: right first time 2 of 5 in the first three school days, 4 of 5 later
      for (let k = 0; k < 5; k++) { const first = k < (EARLY.has(day) ? 2 : 4) ? 1 : 0; att.run(id, 'signed', 2, first, first, 60, day, `${day}T10:00:00.000Z`); }
    }
  });
  // practice on a stair nobody was given: in the activity, never in the first-try numbers
  for (let k = 0; k < 3; k++) att.run(STUDENTS[0], 'angles', 1, 0, 0, 60, '2026-11-15', '2026-11-15T11:00:00.000Z');
  // outside the range, and another class's student: never counted
  att.run(STUDENTS[9], 'signed', 2, 1, 1, 60, '2026-11-14', '2026-11-14T10:00:00.000Z');
  att.run('other-student-1', 'signed', 2, 1, 1, 60, '2026-11-16', '2026-11-16T10:00:00.000Z');

  const asg = db.prepare(`INSERT INTO assignments (id, class_code, kind, skill, title, exam, version, for_all, starts_on, due_on, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const exam = JSON.stringify([{ topic: 'signed', level: 3 }, { topic: 'coord', level: 1 }]);
  asg.run(A1, CLASS, 'stair', 'signed:2', 'מספרים מכוונים, מדרגה 2', null, null, 1, '2026-11-15', '2026-11-19', '2026-11-15T07:00:00.000Z');
  asg.run(A2, CLASS, 'check', 'signed:2', 'בדיקת שליטה: מדרגה 2', null, null, 0, '2026-11-22', '2026-11-24', '2026-11-22T07:00:00.000Z');
  asg.run(PRE, CLASS, 'exam', null, 'מבחן פתיחה', exam, 'a', 1, '2026-11-15', '2026-11-15', '2026-11-14T07:00:00.000Z');
  asg.run(POST, CLASS, 'exam', null, 'מבחן סיום', exam, 'b', 1, '2026-11-26', '2026-11-30', '2026-11-26T07:00:00.000Z');
  asg.run('cccccccccccccccc', OTHER, 'exam', null, 'מבחן של כיתה אחרת', exam, 'a', 1, '2026-11-15', '2026-11-20', '2026-11-15T07:00:00.000Z');
  const tgt = db.prepare('INSERT INTO assignment_targets (assignment_id, student_id) VALUES (?, ?)');
  for (const i of [0, 1, 2, 3]) tgt.run(A2, STUDENTS[i]);
  const work = db.prepare(`INSERT INTO assignment_work (assignment_id, student_id, state, passed, right_n, asked, tries, started_at, done_at, done_day, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`);
  const done = (a, i, day, { passed = null, right = null, asked = null } = {}) => work.run(a, STUDENTS[i], 'done', passed, right, asked, `${day}T08:00:00.000Z`, `${day}T09:00:00.000Z`, day, `${day}T09:00:00.000Z`);
  // A1: six on time (one not passed), two late, two not done
  for (const i of [0, 1, 2, 3, 4]) done(A1, i, '2026-11-18', { passed: 1 });
  done(A1, 5, '2026-11-19', { passed: 0 });
  done(A1, 6, '2026-11-20', { passed: 1 }); done(A1, 7, '2026-11-20', { passed: 0 });
  work.run(A1, STUDENTS[8], 'started', null, null, null, '2026-11-16T08:00:00.000Z', null, null, '2026-11-16T08:00:00.000Z');
  // A2 (s0-s3): three on time, one late; s4 was not given it
  done(A2, 0, '2026-11-23', { passed: 1, right: 5, asked: 5 }); done(A2, 1, '2026-11-24', { passed: 1, right: 5, asked: 5 });
  done(A2, 2, '2026-11-24', { passed: 0, right: 3, asked: 5 }); done(A2, 3, '2026-11-25', { passed: 1, right: 5, asked: 5 });
  done(A2, 4, '2026-11-24', { passed: 1, right: 5, asked: 5 });
  // the exams: before s0-s7, after s0-s5 and s8 (paired: s0-s5)
  [5, 6, 4, 7, 3, 5, 8, 2].forEach((right, i) => done(PRE, i, '2026-11-15', { right, asked: 10 }));
  [[0, 7], [1, 6], [2, 6], [3, 8], [4, 6], [5, 4], [8, 9]].forEach(([i, right]) => done(POST, i, '2026-11-27', { right, asked: 10 }));

  const help = db.prepare("INSERT INTO help_requests (id, student_id, topic, level, question, created_at) VALUES (?, ?, 'signed', 2, 'q', ?)");
  const msg = db.prepare('INSERT INTO help_messages (help_id, from_role, body, created_at) VALUES (?, ?, ?, ?)');
  const ask = (id, i, created, replyH = null) => {
    help.run(id, STUDENTS[i], created);
    if (replyH !== null) msg.run(id, 'teacher', 'בואו נעבור על זה מחר.', new Date(Date.parse(created) + replyH * 36e5).toISOString());
  };
  ask(1, 0, '2026-11-16T08:00:00.000Z', 2);
  msg.run(1, 'student', 'עדיין לא ברור לי', '2026-11-16T09:00:00.000Z'); // a student's line is not an answer
  ask(2, 1, '2026-11-17T08:00:00.000Z', 5);
  ask(3, 2, '2026-11-18T08:00:00.000Z', 30);
  ask(4, 3, '2026-11-23T08:00:00.000Z', 1);
  ask(5, 4, '2026-11-24T08:00:00.000Z');
  ask(6, 5, '2026-11-14T22:30:00.000Z'); // 00:30 on 15.11 in Jerusalem: in the range
  ask(7, 6, '2026-11-14T21:30:00.000Z', 1); // 23:30 on 14.11 in Jerusalem: before it
  ask(8, 0, '2026-11-29T10:00:00.000Z', 1); // after it
}
