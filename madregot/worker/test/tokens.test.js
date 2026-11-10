// A class student on several devices (DURABLE-6): each join keeps its own token in student_tokens, up to 3 (a 4th join
// signs out the oldest); a PIN reset or the student's removal signs out every device; the token's last_seen is written
// at most once an hour; the night purge drops tokens unused for 400 days and tokens of students who are gone; the
// migration copies the old students.token_hash; and students.token_hash is still written, for a rollback.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setup, makeClass, bearer, rows, one, advanceClock } from './helpers.js';
import { purge } from '../src/cron.js';

let h;
afterEach(() => h?.done());
const sha = (s) => createHash('sha256').update(s).digest('hex');
const DAY = 864e5;
const send = (s) => h.call('POST', '/api/progress', { headers: bearer(s), body: { events: [] } });
const join = (code, name = 'נועה', pin = '1234') => h.call('POST', `/api/classes/${code}/join`, { body: { name, pin } }).then((r) => r.json());
const tokensOf = (id) => rows(h.env, 'SELECT * FROM student_tokens WHERE student_id = ? ORDER BY created_at, rowid', id);

test('two devices join as one student: both stay signed in, with their own tokens', async () => {
  h = await setup();
  const cls = await makeClass(h);
  const a = await join(cls.code);
  const b = await join(cls.code);
  assert.equal(a.studentId, b.studentId);
  assert.notEqual(a.token, b.token);
  assert.equal((await send(a)).status, 200, 'the first device still works');
  assert.equal((await send(b)).status, 200);
  assert.deepEqual(tokensOf(a.studentId).map((t) => t.token_hash), [sha(a.token), sha(b.token)]);
  // students.token_hash is still written (the newest), so an older Worker in a rollback lets the newest device in
  assert.equal(one(h.env, 'SELECT token_hash FROM students WHERE id = ?', a.studentId).token_hash, sha(b.token));
  // the raw tokens are never stored
  assert.ok(!JSON.stringify(rows(h.env, 'SELECT * FROM student_tokens')).includes(a.token));
});

test('a 4th join signs out the oldest device; the three newest keep working', async () => {
  h = await setup();
  const cls = await makeClass(h);
  const d = [];
  for (let i = 0; i < 4; i += 1) { d.push(await join(cls.code)); advanceClock(1000); }
  assert.equal(tokensOf(d[0].studentId).length, 3);
  assert.equal((await send(d[0])).status, 401, 'the oldest is signed out');
  for (const s of d.slice(1)) assert.equal((await send(s)).status, 200);
  // in the same millisecond too: the order of joining decides
  const fast = [];
  for (let i = 0; i < 4; i += 1) fast.push(await join(cls.code, 'איתי'));
  assert.equal((await send(fast[0])).status, 401);
  assert.equal((await send(fast[3])).status, 200);
  assert.equal(tokensOf(fast[0].studentId).length, 3);
  // another student's devices are not touched
  assert.equal(tokensOf(d[0].studentId).length, 3);
});

test('a PIN reset signs out every device (all 401); the next join sets the PIN and signs in again', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['איתי'] });
  const a = await join(cls.code); const b = await join(cls.code); const c = await join(cls.code);
  const other = await makeClass(h);
  // another class's teacher: nothing changes
  assert.equal((await h.call('POST', `/api/teacher/students/${a.studentId}/reset-pin`, { headers: other.teacher, body: {} })).status, 200);
  assert.equal(tokensOf(a.studentId).length, 3);
  assert.equal((await h.call('POST', `/api/teacher/students/${a.studentId}/reset-pin`, { headers: cls.teacher, body: {} })).status, 200);
  for (const s of [a, b, c]) assert.equal((await send(s)).status, 401);
  assert.equal(tokensOf(a.studentId).length, 0);
  assert.equal((await send(cls.students[0])).status, 200, 'a classmate stays signed in');
  const back = await join(cls.code, 'נועה', '5678');
  assert.equal(back.studentId, a.studentId);
  assert.equal((await send(back)).status, 200);
});

test('a removed student: every token goes in the same batch', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['איתי'] });
  const a = await join(cls.code); await join(cls.code);
  assert.equal((await h.call('POST', `/api/teacher/students/${a.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  assert.equal(tokensOf(a.studentId).length, 0);
  assert.equal((await send(a)).status, 401);
  assert.equal(rows(h.env, 'SELECT * FROM student_tokens').length, 1, 'the classmate\'s token stays');
});

test('a token\'s last_seen is written at most once an hour', async () => {
  h = await setup();
  const cls = await makeClass(h);
  const a = await join(cls.code);
  const seen = () => one(h.env, 'SELECT last_seen FROM student_tokens WHERE token_hash = ?', sha(a.token)).last_seen;
  const first = seen();
  let writes = 0;
  const prepare = h.env.DB.prepare;
  h.env.DB.prepare = (sql) => { if (/UPDATE student_tokens SET last_seen/.test(sql)) writes += 1; return prepare(sql); };
  advanceClock(10 * 60_000);
  for (let i = 0; i < 5; i += 1) await send(a);
  assert.equal(writes, 0, 'within the hour: no write');
  assert.equal(seen(), first);
  advanceClock(61 * 60_000);
  await send(a); await send(a);
  assert.equal(writes, 1, 'past the hour: one write');
  assert.ok(seen() > first);
  h.env.DB.prepare = prepare;
});

test('the night purge drops tokens unused for 400 days, and tokens of students who are gone', async () => {
  h = await setup();
  const cls = await makeClass(h);
  const a = await join(cls.code); const b = await join(cls.code, 'איתי');
  const old = new Date(Date.now() - 401 * DAY).toISOString();
  const recent = new Date(Date.now() - 399 * DAY).toISOString();
  h.env.DB.raw.prepare('UPDATE student_tokens SET last_seen = ? WHERE token_hash = ?').run(old, sha(a.token));
  h.env.DB.raw.prepare('UPDATE student_tokens SET last_seen = ? WHERE token_hash = ?').run(recent, sha(b.token));
  // a deletion path that forgot the tokens: the student row is gone, a token is left
  h.env.DB.raw.prepare("INSERT INTO student_tokens (token_hash, student_id, created_at, last_seen) VALUES ('f'||hex(randomblob(31)), 'gone00000000aaaa', ?, ?)")
    .run(new Date().toISOString(), new Date().toISOString());
  await purge(h.env);
  assert.deepEqual(rows(h.env, 'SELECT token_hash FROM student_tokens').map((r) => r.token_hash), [sha(b.token)]);
  assert.equal((await send(a)).status, 401);
  assert.equal((await send(b)).status, 200);
});

test('the migration copies the old students.token_hash, so devices signed in before it stay signed in', async () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const db = new DatabaseSync(':memory:');
  for (const m of ['0000_base', '0001_paid_tutor', '0002_refund_once']) db.exec(read(`../migrations/${m}.sql`));
  db.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES ('K7Q2MD', 'ז׳3', '7', 'רונית', 'x', '2026-09-01T08:00:00Z')").run();
  db.prepare("INSERT INTO students (id, class_code, name, pin_hash, token_hash, created_at, last_seen) VALUES ('s1', 'K7Q2MD', 'נועה', 'p', ?, '2026-09-02T08:00:00Z', '2026-11-01T08:00:00Z')").run(sha('old-token'));
  db.prepare("INSERT INTO students (id, class_code, name, pin_hash, token_hash, created_at, last_seen) VALUES ('s2', 'K7Q2MD', 'איתי', 'p', ?, '2026-09-03T08:00:00Z', NULL)").run(sha('other'));
  db.exec(read('../migrations/0003_durable.sql'));
  assert.deepEqual(db.prepare('SELECT token_hash, student_id, created_at, last_seen FROM student_tokens ORDER BY student_id').all().map((r) => ({ ...r })), [
    { token_hash: sha('old-token'), student_id: 's1', created_at: '2026-09-02T08:00:00Z', last_seen: '2026-11-01T08:00:00Z' },
    { token_hash: sha('other'), student_id: 's2', created_at: '2026-09-03T08:00:00Z', last_seen: '2026-09-03T08:00:00Z' },
  ]);
  const cols = db.prepare('PRAGMA table_info(link_codes)').all().map((c) => c.name);
  assert.ok(cols.includes('restore_escrow'));
});
