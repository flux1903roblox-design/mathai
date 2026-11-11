// "Delete all" on the server (trust spec TRUST-6 §1): POST /api/me/forget deletes everything of the student, the family
// device and the install that sent it, and a scan of every table (tables other lanes add are scanned too, with no edit
// here) finds no trace of them: not the student's id or name, not the family device's id or token, not the raw install
// id or its devKey. A second student and a second device keep everything. Every name, address and id is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sha256 } from '../src/util.js';
import { FORGET_NET_DAILY, FAMILY_DEVICE_COUNTERS, DEVICE_COUNTERS, STUDENT_COUNTERS } from '../src/forget.js';
import { setup, makeClass, bearer, signIn, accountId, linkDevice, insertSub, setCount, countOf, devOf, netOf, rows, one } from './helpers.js';

let h;
afterEach(() => h?.done());
const NAME = 'תלמידת-בדיקה-7Q';
const INSTALL = 'c0ffee'.repeat(5) + 'c0'; // a raw X-Device id: 32 hex
const OTHER_INSTALL = 'beef01'.repeat(5) + 'be';
const IMAGE = `data:image/jpeg;base64,${'A'.repeat(64)}`;

/** Every row of every table, as text. */
function tablesText() {
  return rows(h.env, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .flatMap(({ name }) => rows(h.env, `SELECT * FROM "${name}"`).map((r) => `${name}: ${JSON.stringify(r)}`));
}
/** The rows that still mention any of `needles`, leaving out what `skip(rowText)` allows. */
const traces = (needles, skip = () => false) => tablesText().filter((r) => needles.some((n) => r.includes(n)) && !skip(r));

/** A class student with data in every student table and every counter a student can have. */
async function busyStudent(cls, s) {
  const events = Array.from({ length: 20 }, (_, i) => ({ topic: 'neg', level: 1, ok: i % 2 === 0, first: i === 0, cat: 'sign', secs: 9 }));
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(s), body: { events, levels: { neg: { level: 2, max: 2 } } } })).status, 200);
  assert.equal((await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'neg', question: '3 - 8', answer: '5', image: IMAGE } })).status, 200);
  assert.equal((await h.call('POST', '/api/help', { headers: bearer(s), body: { kind: 'talk' } })).status, 200);
  assert.equal((await h.call('POST', '/api/exams', { headers: bearer(s), body: { title: 'מבחן', correct: 1, total: 2, questions: [] } })).status, 200);
  // the teacher's AI switch for the student, with its audit row (target student:<id>)
  assert.equal((await h.call('POST', `/api/teacher/students/${s.studentId}/ai`, { headers: cls.teacher, body: { off: true } })).status, 200);
  for (const p of STUDENT_COUNTERS) await setCount(h.env, `${p}${s.studentId}`, 1);
  await setCount(h.env, `pin:${s.studentId}:n0123456789abcdef`, 1);
  await setCount(h.env, `s:${s.studentId}:tutor`, 1);
  // the other lanes' student rows: a reply from each side on the help request (TEACHER-6), an assignment for her by name
  // with her work on it (TEACHER-4), and the restore code the class keeps for her (DURABLE-6; her device token came
  // with the join, student_tokens)
  const helpId = one(h.env, 'SELECT id FROM help_requests WHERE student_id = ? AND question IS NOT NULL ORDER BY id', s.studentId).id;
  assert.equal((await h.call('POST', `/api/teacher/help/${helpId}/reply`, { headers: cls.teacher, body: { body: 'נעבור על זה מחר' } })).status, 201);
  assert.equal((await h.call('POST', `/api/help/${helpId}/reply`, { headers: bearer(s), body: { quick: 'thanks' } })).status, 201);
  const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const a = await h.call('POST', '/api/teacher/assignments', { headers: cls.teacher, body: { kind: 'stair', skill: 'signed:1', dueOn: due, targets: [s.studentId] } });
  assert.equal(a.status, 201);
  const work = await h.call('POST', `/api/class/work/${(await a.json()).assignment.id}`, { headers: bearer(s), body: { state: 'started', stage: 1 } });
  assert.equal(work.status, 200);
  const at = new Date().toISOString();
  h.env.DB.raw.prepare("INSERT INTO vault_escrow (id, vault_id, owner_kind, owner_id, sealed, created_at, updated_at) VALUES (?, ?, 'student', ?, 'sealed', ?, ?)")
    .run(s.studentId.padEnd(16, '0').slice(0, 16), `v${s.studentId}`, s.studentId, at, at);
}
/** A family device with counters, a link code, its device_linked notice and audit rows. */
async function busyFamilyDevice(account, label) {
  const fd = await linkDevice(h.env, account, label);
  const at = new Date().toISOString();
  for (const p of FAMILY_DEVICE_COUNTERS) await setCount(h.env, `${p}${fd.id}`, 1);
  await setCount(h.env, `free:fd:${fd.id}:tries`, 1);
  const db = h.env.DB.raw;
  db.prepare("INSERT INTO link_codes (code_hash, secret_hash, account_id, device_id, created_at, expires_at, claimed_at, collected_at) VALUES (?, 's', ?, ?, ?, ?, ?, ?)")
    .run(`code-${fd.id}`, account, fd.id, at, at, at, at);
  db.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at, sent_at) VALUES (?, 'device_linked:' || ?, ?, '{}', ?, ?)").run(fd.id, fd.id, account, at, at);
  db.prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, 'device.link', ?, '{}')").run(at, `account:${account}`, `device:${fd.id}`);
  // the other lanes' device rows: a day of the parents' report (PARENTS-3) and the restore code the family kept for this
  // device (DURABLE-6: a device that deletes itself takes it along; family.js leaveFamily does the same)
  db.prepare("INSERT INTO family_daily (device_id, day, minutes, questions, updated_at) VALUES (?, ?, 12, 30, ?)").run(fd.id, at.slice(0, 10), at);
  db.prepare("INSERT INTO vault_escrow (id, vault_id, owner_kind, owner_id, device_id, label, sealed, created_at, updated_at) VALUES (?, ?, 'account', ?, ?, ?, 'sealed', ?, ?)")
    .run(randomBytes(8).toString('hex'), `v${randomBytes(8).toString('hex')}`, account, fd.id, label, at, at);
  return fd;
}
/** An install with counters of its own: a free question, a link code it asked for (no device id kept in it), care, a report. */
async function busyInstall(id) {
  const dk = await devOf(h.env, id);
  const r = await h.call('POST', '/api/family/link/start', { headers: { 'X-Device': id }, body: { secret: 'f'.repeat(32) } });
  assert.equal(r.status, 201);
  for (const p of DEVICE_COUNTERS) await setCount(h.env, `${p}${dk}`, 1);
  await setCount(h.env, `free:d:${dk}:tries`, 1);
  return dk;
}
const forget = (headers = {}, ip) => h.call('POST', '/api/me/forget', { headers, body: {}, ip });

test('delete all removes the student, the family device and the install from every table; the others keep everything', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: [NAME, 'איתי', 'מיה'], setting: 'private' });
  const [me, other, third] = cls.students;
  for (const s of cls.students) await busyStudent(cls, s);
  await signIn(h, 'parent@example.test');
  const account = accountId(h.env, 'parent@example.test');
  insertSub(h.env, { kind: 'family', account_id: account, provider: 'test' });
  const fd = await busyFamilyDevice(account, 'הטאבלט');
  const otherFd = await busyFamilyDevice(account, 'הטלפון');
  const dk = await busyInstall(INSTALL);
  const otherDk = await busyInstall(OTHER_INSTALL);
  const fdToken = fd.headers['X-Family-Device'];
  const needles = [me.studentId, NAME, fd.id, fdToken, await sha256(fdToken), INSTALL, dk];
  assert.ok(traces(needles).length > 30, 'seeded everywhere first');
  const before = { other: traces([other.studentId]).length, otherFd: traces([otherFd.id]).length, otherDk: traces([otherDk]).length };

  const r = await forget({ ...bearer(me), ...fd.headers, 'X-Device': INSTALL });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, student: true, familyDevice: true, device: true });
  await h.ctx.flush();

  assert.deepEqual(traces(needles), [], 'no table mentions the student, the family device or the install');
  assert.deepEqual(rows(h.env, "SELECT label FROM vault_escrow WHERE owner_kind = 'account' AND owner_id = ?", account).map((r) => r.label), ['הטלפון'],
    "the device's kept code went with it; the other device's stays");
  // what the delete wrote: an audit row that names no student, and the parent's notice, which names no device id
  const audit = one(h.env, "SELECT * FROM audit_log WHERE action = 'student.self_delete'");
  assert.deepEqual({ actor: audit.actor, target: audit.target, detail: audit.detail }, { actor: 'student', target: `class:${cls.code}`, detail: '{}' });
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'device.self_delete' AND target = ?", `account:${account}`).length, 1);
  const notice = one(h.env, "SELECT * FROM notices WHERE kind LIKE 'device_unlinked:%'");
  assert.equal(notice.to_account, account);
  assert.deepEqual(JSON.parse(notice.params), { label: 'הטאבלט', plan: true });
  const mail = h.net.log.email.find((m) => m.subject === 'מכשיר נותק מהמנוי');
  assert.ok(mail, 'the parent is told');
  assert.deepEqual(mail.to, ['parent@example.test']);
  assert.match(mail.text, /המכשיר \(הטאבלט\) נותק מהמנוי, והמידע שלו נמחק מהשרת לבקשת מי שהשתמש בו\./);

  // the others keep every row and counter
  assert.equal(traces([other.studentId]).length, before.other, 'the second student is intact');
  assert.equal(traces([otherFd.id]).length, before.otherFd, 'the second family device is intact');
  assert.equal(traces([otherDk]).length, before.otherDk, 'the second install is intact');
  assert.equal(countOf(h.env, `free:fd:${otherFd.id}`), 1);
  assert.ok(one(h.env, 'SELECT * FROM accounts WHERE id = ?', account), "the parent's account stays: it is the parent's");
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', account).length, 1, 'and so does the plan');
  // her token, the device's token and its plan no longer work
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(me), body: { events: [] } })).status, 401);
  assert.equal((await h.call('GET', '/api/ai/status', { headers: fd.headers })).headers.get('X-AI-Linked'), '0');

  // a second call finds nothing
  assert.deepEqual(await (await forget({ ...bearer(me), ...fd.headers, 'X-Device': INSTALL })).json(), { ok: true, student: false, familyDevice: false, device: false });

  // the teacher removing a student leaves no row with her either, but the teacher's own student.remove row (licence.js)
  const removed = await h.call('POST', `/api/teacher/students/${third.studentId}/remove`, { headers: cls.teacher, body: {} });
  assert.equal(removed.status, 200);
  assert.deepEqual(traces([third.studentId], (row) => row.startsWith('audit_log: ') && row.includes('"action":"student.remove"')), []);
  assert.equal(traces([other.studentId]).length, before.other, 'and the second student is still intact');
});

test('each header is optional: the student alone, the install alone, nothing; bad tokens delete nothing', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: [NAME] });
  const [me] = cls.students;
  await busyStudent(cls, me);
  const dk = await busyInstall(INSTALL);
  assert.deepEqual(await (await forget()).json(), { ok: true, student: false, familyDevice: false, device: false });
  assert.deepEqual(await (await forget({ Authorization: 'Bearer nope', 'X-Family-Device': `fd1.${'0'.repeat(64)}`, 'X-Device': 'not-an-id' })).json(),
    { ok: true, student: false, familyDevice: false, device: false });
  assert.equal(traces([me.studentId]).length > 0 && traces([dk]).length > 0, true, 'nothing was deleted');
  assert.deepEqual(await (await forget({ 'X-Device': INSTALL })).json(), { ok: true, student: false, familyDevice: false, device: true });
  assert.deepEqual(traces([dk, INSTALL]), []);
  assert.ok(traces([me.studentId]).length > 0, 'the student was not named, so she stays');
  assert.deepEqual(await (await forget(bearer(me))).json(), { ok: true, student: true, familyDevice: false, device: false });
  assert.deepEqual(traces([me.studentId, NAME]), []);
  assert.ok(one(h.env, 'SELECT * FROM classes WHERE code = ?', cls.code), 'the class itself stays: it is the teacher\'s');
});

test('a family device on the free OK only: the email says the account, not the plan; never with a teacher key', async () => {
  h = await setup();
  await signIn(h, 'ok@example.test');
  const account = accountId(h.env, 'ok@example.test');
  const fd = await busyFamilyDevice(account, '');
  const r = await forget({ ...fd.headers, 'X-Teacher-Key': 'ignored', 'X-Class-Code': 'ABC234' });
  assert.deepEqual(await r.json(), { ok: true, student: false, familyDevice: true, device: false });
  await h.ctx.flush();
  const mail = h.net.log.email.find((m) => m.subject === 'מכשיר נותק מהחשבון');
  assert.ok(mail);
  assert.match(mail.text, /אחד המכשירים נותק מהחשבון שלכם במדרגות, והמידע שלו נמחק מהשרת/);
  assert.doesNotMatch(mail.text, /לביטול המנוי/, 'not a billing email');
  assert.deepEqual(traces([fd.id]), []);
});

test(`delete all is limited to ${FORGET_NET_DAILY} a day from one network`, async () => {
  h = await setup();
  await setCount(h.env, `forget:n:${await netOf(h.env)}`, FORGET_NET_DAILY);
  const r = await forget({ 'X-Device': INSTALL });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'too_many_requests');
  assert.equal((await forget({ 'X-Device': INSTALL }, '198.51.100.9')).status, 200, 'another network is not affected');
});
