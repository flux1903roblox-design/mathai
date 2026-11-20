// One network must not be able to fill the shared database in a day (COUNCIL2-12, COUNCIL2-18; the review's fill
// scripts). The write budgets are counted at four widths (src/writes.js): the student's own, the class's, the network's
// (a whole school on one address) and, far smaller, what the students who joined today may write from one network. A
// class holds 45 names and one network makes 200 new names a day; a help request's notebook page is about 200 KB and has
// its own budget in kilobytes; every student write route feeds the size meter; and a class or network budget that is
// reached tells the owner once that day.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, bearer, rows, one, countOf, netOf, setCount } from './helpers.js';
import { CLASS_MAX_STUDENTS, NEW_NAMES_PER_NET, HELP_IMAGE_MAX } from '../src/caps.js';
import { WRITE_BUDGET, CLASS_WRITE_BUDGET, NET_WRITE_BUDGET, NEW_WRITE_BUDGET, writeScale } from '../src/writes.js';
import { WRITE_ROUTES, edgeGuard } from '../src/edge.js';
import { STUDENT_COUNTERS, CLASS_COUNTERS } from '../src/forget.js';
import { flushNotices } from '../src/email.js';
import { dayOf } from '../src/util.js';

let h;
afterEach(() => { h?.done(); h = null; });

const dbBytes = (env) => one(env, 'SELECT page_count * page_size AS b FROM pragma_page_count(), pragma_page_size()').b;
const errorOf = async (r) => (r.status === 200 ? '200' : `${r.status} ${(await r.json()).error}`);
const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
let seq = 0;
const eid = () => (seq++).toString(16).padStart(12, '0');
const batch = (n = 500) => Array.from({ length: n }, () => ({ id: eid(), topic: 'signed', level: 1, ok: true, first: true, secs: 5, cat: 'x'.repeat(30), at: new Date().toISOString() }));
const page = (n = HELP_IMAGE_MAX) => `data:image/jpeg;base64,${'A'.repeat(n - 'data:image/jpeg;base64,'.length)}`;
const joinAs = (code, name, ip) => h.call('POST', `/api/classes/${code}/join`, { body: { name, pin: '1234' }, ip });
/** Make every student of a class look as if they joined yesterday (the budget for today's new students no longer applies). */
const yesterday = (env, code) => env.DB.raw.prepare('UPDATE students SET created_at = ? WHERE class_code = ?').run(new Date(Date.now() - 30 * 3600e3).toISOString(), code);
const ownerNotices = (env) => rows(env, "SELECT kind, params FROM notices WHERE kind LIKE 'owner:write_cap:%'").map((r) => ({ kind: r.kind, ...JSON.parse(r.params) }));

test('the review\'s help script: 20 made-up students, 12 requests each with a 600 KB picture from one network: the old page is never kept, and the day stops at the budget for new students', async () => {
  h = await setup();
  const before = dbBytes(h.env);
  const cls = await makeClass(h, { students: Array.from({ length: 20 }, (_, i) => `בוט ${i}`) });
  const codes = {};
  for (const s of cls.students) {
    for (let q = 0; q < 12; q++) {
      const r = await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 1, question: `שאלה ${q}`, answer: '1', note: '', image: page(599_900) } });
      tally(codes, await errorOf(r));
    }
  }
  await h.ctx.flush();
  // each student has 10 open requests at most; the students who joined today share 100 requests on this network
  assert.deepEqual(codes, { 200: NEW_WRITE_BUDGET.help, '429 too_many_open': 20, '429 too_many_help': 120 });
  const kept = one(h.env, 'SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(image)), 0) AS bytes FROM help_requests');
  assert.equal(kept.n, NEW_WRITE_BUDGET.help);
  assert.equal(kept.bytes, 0, 'a page over HELP_IMAGE_MAX is left out');
  assert.ok(dbBytes(h.env) - before < 1024 * 1024, 'the 114 MB of the review are under 1 MB now');
  // the owner hears of it, once
  const told = ownerNotices(h.env);
  assert.deepEqual(told.map((t) => [t.kind, t.scope, t.what]), [[`owner:write_cap:new:${dayOf()}`, 'new', 'help']]);
});

test('pictures of the size the app sends: a student keeps 11 a day (3 MB), new students of one network 23 (6 MB), then requests go without their page', async () => {
  h = await setup({ DB_SIZE_NOTICE_MB: '1' });
  const cls = await makeClass(h, { students: ['א', 'ב', 'ג'] });
  const ask = (s, q, image = page()) => h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', level: 1, question: q, answer: '1', note: '', image } });
  const kb = Math.ceil(HELP_IMAGE_MAX / 1024);
  const own = Math.floor(WRITE_BUDGET.helpKb / kb);
  // the teacher closes each request, so the 10 open requests are never the reason
  const close = () => h.env.DB.raw.prepare('UPDATE help_requests SET done_at = ? WHERE done_at IS NULL').run(new Date().toISOString());
  const [a, b, c] = cls.students;
  for (let i = 0; i < own; i++) { assert.deepEqual(await (await ask(a, `a${i}`)).json(), { ok: true }, `picture ${i + 1}`); close(); }
  assert.deepEqual(await (await ask(a, 'a-more')).json(), { ok: true, noImage: true }, 'her own 3 MB are used: the request is kept, its page is not');
  assert.equal(countOf(h.env, `write:s:${a.studentId}:helpKb`), own * kb);
  close();
  // the students who joined today share NEW_WRITE_BUDGET.helpKb on this network
  const fresh = Math.floor(NEW_WRITE_BUDGET.helpKb / kb);
  let kept = own;
  for (const s of [b, c]) for (let i = 0; i < own && kept < fresh; i++) { assert.deepEqual(await (await ask(s, `q${kept}`)).json(), { ok: true }); kept += 1; close(); }
  assert.equal(kept, fresh);
  assert.deepEqual(await (await ask(c, 'over')).json(), { ok: true, noImage: true });
  await h.ctx.flush();
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM help_requests WHERE image IS NOT NULL').n, fresh);
  assert.equal(countOf(h.env, `write:new:${await netOf(h.env)}:helpKb`), fresh * kb);
  assert.deepEqual(ownerNotices(h.env).map((t) => [t.scope, t.what]), [['new', 'helpKb']]);
  // help requests feed the size meter (they did not before): the day's size is kept and the owner's notice is queued
  assert.ok(one(h.env, 'SELECT value FROM meters WHERE name = ?', `db_size:${dayOf()}`).value > 5 * 1024 * 1024);
  assert.equal(rows(h.env, "SELECT kind FROM notices WHERE kind LIKE 'owner:db_size:%'").length, 1);
  await flushNotices(h.env);
  const mail = h.net.log.email.find((m) => /הרבה כתיבות/.test(m.subject));
  assert.ok(mail, 'the write-cap notice is an email in Hebrew');
  assert.match(mail.text, /WRITE_BUDGET_SCALE/);
});

test('a note that reads as distress is never refused for a budget: past it, it reaches the teacher without a page', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [s] = cls.students;
  await setCount(h.env, `write:s:${s.studentId}:help`, WRITE_BUDGET.help);
  const plain = await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', question: '3 - 8', answer: '5', note: 'לא הבנתי' } });
  assert.equal(plain.status, 429);
  const refused = await plain.json();
  assert.equal(refused.error, 'too_many_help');
  assert.ok(refused.resetsAt && Number(plain.headers.get('Retry-After')) >= 60);
  const r = await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'signed', question: '3 - 8', answer: '5', note: 'אני רוצה למות', image: page() } });
  assert.equal(r.status, 200);
  const row = one(h.env, 'SELECT h.note, h.image, m.care FROM help_requests h JOIN help_meta m ON m.help_id = h.id WHERE h.student_id = ?', s.studentId);
  assert.deepEqual({ ...row }, { note: 'אני רוצה למות', image: null, care: 1 });
  // a second one joins the same request: no new row
  await h.call('POST', '/api/help', { headers: bearer(s), body: { topic: 'eq', question: 'x + 1 = 2', answer: '', note: 'בא לי למות' } });
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM help_requests WHERE student_id = ?', s.studentId).n, 1);
  assert.equal(one(h.env, 'SELECT note FROM help_requests WHERE student_id = ?', s.studentId).note, 'בא לי למות');
});

test('the review\'s answers script: a class holds 45 names; the day stops at the budget for new students, then at the class\'s, then at the network\'s', async () => {
  h = await setup();
  const before = dbBytes(h.env);
  const cls = await makeClass(h);
  const students = [];
  const joined = {};
  for (let i = 0; i < 60; i++) {
    const r = await joinAs(cls.code, `בוט ${i}`);
    tally(joined, await errorOf(r.clone()));
    if (r.status === 200) students.push(await r.json());
  }
  assert.deepEqual(joined, { 200: CLASS_MAX_STUDENTS, '403 class_full': 60 - CLASS_MAX_STUDENTS });
  assert.equal(countOf(h.env, `newname:n:${await netOf(h.env)}`), CLASS_MAX_STUDENTS, 'a refused name is not counted');
  // a student of the class still comes back with their PIN when it is full
  assert.equal((await joinAs(cls.code, 'בוט 3')).status, 200);
  const post = (s) => h.call('POST', '/api/progress', { headers: bearer(s), body: { events: batch() } });
  const codes = {};
  for (const s of students) for (let b = 0; b < 2; b++) tally(codes, await errorOf(await post(s)));
  await h.ctx.flush();
  // 45 students x 2 batches of 500 = 45,000 asked; the students who joined today share 20,000 on this network
  assert.deepEqual(codes, { 200: NEW_WRITE_BUDGET.answers / 500, '429 too_many_writes': 90 - NEW_WRITE_BUDGET.answers / 500 });
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM attempts').n, NEW_WRITE_BUDGET.answers);
  assert.ok(dbBytes(h.env) - before < 8 * 1024 * 1024, 'under 8 MB, where the review wrote 41.7 MB (and could write 208 MB)');
  const refused = await post(students[0]);
  const body = await refused.json();
  assert.equal(body.scope, 'new');
  assert.ok(Number(refused.headers.get('Retry-After')) >= 60);
  assert.equal(countOf(h.env, `write:s:${students[0].studentId}:answers`), 1000, 'a refused batch is not counted against the student');

  // the next day they are no longer new: the class's own budget is what stops the class
  yesterday(h.env, cls.code);
  await setCount(h.env, `write:c:${cls.code}:answers`, CLASS_WRITE_BUDGET.answers - 500);
  assert.equal((await post(students[20])).status, 200);
  const overClass = await post(students[21]);
  assert.equal(overClass.status, 429);
  assert.equal((await overClass.json()).scope, 'class');
  // another class on the same network still writes, until the network's budget
  const other = await makeClass(h, { students: ['דנה'] });
  yesterday(h.env, other.code);
  assert.equal((await post(other.students[0])).status, 200);
  await setCount(h.env, `write:n:${await netOf(h.env)}:answers`, NET_WRITE_BUDGET.answers - 499);
  const overNet = await post(other.students[0]);
  assert.equal(overNet.status, 429);
  assert.equal((await overNet.json()).scope, 'network');
  // ... and a class on another network is not touched by it
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(other.students[0]), body: { events: batch(10) }, ip: '198.51.100.77' })).status, 200);
  await h.ctx.flush();
  const told = ownerNotices(h.env);
  assert.deepEqual(told.map((t) => t.scope).sort(), ['class', 'network', 'new']);
  assert.equal(told.find((t) => t.scope === 'class').class, cls.code, 'the class is named (a code names no one)');
  assert.equal(told.find((t) => t.scope === 'network').class, undefined);
  assert.ok(!JSON.stringify(told).includes(students[0].studentId));
});

test('one network makes 200 new names a day, in all its classes; an IPv6 /48 is one network for names and for new classes', async () => {
  h = await setup();
  const cls = await makeClass(h);
  const net = await netOf(h.env);
  await setCount(h.env, `newname:n:${net}`, NEW_NAMES_PER_NET - 1);
  assert.equal((await joinAs(cls.code, 'אחרון')).status, 200);
  const over = await joinAs(cls.code, 'עוד אחד');
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error, 'too_many_joins');
  assert.equal((await joinAs(cls.code, 'אחרון')).status, 200, 'a returning student is not a new name');
  assert.equal((await joinAs(cls.code, 'מרשת אחרת', '198.51.100.9')).status, 200);
  // IPv6: every /64 of one /48 counts as the same network
  const a = await joinAs(cls.code, 'שש', '2001:db8:77:1::1'); const b = await joinAs(cls.code, 'שבע', '2001:db8:77:ffff::9');
  assert.deepEqual([a.status, b.status], [200, 200]);
  const wide = rows(h.env, "SELECT who, count FROM ai_usage WHERE who LIKE 'newname:n:%' AND count = 2");
  assert.equal(wide.length, 1, 'two /64s, one counter');
  // new classes too: 10 a day for the whole /48
  const made = {};
  for (let i = 0; i < 12; i++) {
    const r = await h.call('POST', '/api/classes', { body: { className: `כ${i}`, teacherName: 'מ', grade: '7' }, ip: `2001:db8:88:${i.toString(16)}::1` });
    tally(made, await errorOf(r));
  }
  assert.deepEqual(made, { 200: 10, '429 too_many_classes': 2 });
});

test('the budgets: the class and network ones scale with WRITE_BUDGET_SCALE, the student\'s and the new students\' do not; every counter goes with its student or class', async () => {
  assert.equal(writeScale({}), 1);
  assert.equal(writeScale({ WRITE_BUDGET_SCALE: '3' }), 3);
  for (const bad of ['0', '-2', '1.5', 'abc', '21', '']) assert.equal(writeScale({ WRITE_BUDGET_SCALE: bad }), 1, bad);
  for (const what of Object.keys(CLASS_WRITE_BUDGET)) {
    assert.ok(WRITE_BUDGET[what] < CLASS_WRITE_BUDGET[what] && CLASS_WRITE_BUDGET[what] < NET_WRITE_BUDGET[what], what);
    assert.ok(NEW_WRITE_BUDGET[what] < NET_WRITE_BUDGET[what], what);
  }
  assert.ok(STUDENT_COUNTERS.includes('write:s:') && CLASS_COUNTERS.includes('write:c:'));
  h = await setup({ WRITE_BUDGET_SCALE: '2' });
  const cls = await makeClass(h, { students: ['דנה'] });
  yesterday(h.env, cls.code);
  await setCount(h.env, `write:c:${cls.code}:answers`, CLASS_WRITE_BUDGET.answers);
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(cls.students[0]), body: { events: batch(5) } })).status, 200, 'twice the class budget');
  await setCount(h.env, `write:c:${cls.code}:answers`, 2 * CLASS_WRITE_BUDGET.answers);
  assert.equal((await h.call('POST', '/api/progress', { headers: bearer(cls.students[0]), body: { events: batch(5) } })).status, 429);
  // deleting the class takes its write counters
  await h.call('POST', '/api/exams', { headers: bearer(cls.students[0]), body: { title: 'מבחן', questions: [] } });
  assert.ok(countOf(h.env, `write:c:${cls.code}:exams`) > 0);
  assert.equal((await h.call('POST', '/api/teacher/class/delete', { headers: cls.teacher, body: { confirm: 'DELETE' } })).status, 200);
  assert.equal(rows(h.env, "SELECT who FROM ai_usage WHERE who LIKE 'write:c:%' OR who LIKE 'write:s:%'").length, 0);
});

test('the edge limiter guards every student write route, and no other', async () => {
  const guarded = ['/api/progress', '/api/exams', '/api/help', '/api/help/12/reply', '/api/class/work/0123456789abcdef'];
  const open = ['/api/help/12/read', '/api/class/work', '/api/class/work/0123456789abcdef/exam', '/api/teacher/help/12/reply', '/api/helpx'];
  for (const p of guarded) assert.ok(WRITE_ROUTES.some((re) => re.test(p)), p);
  for (const p of open) assert.ok(!WRITE_ROUTES.some((re) => re.test(p)), p);
  h = await setup();
  const keys = [];
  const env = { ...h.env, RL_WRITE: { limit: async ({ key }) => { keys.push(key); return { success: keys.length <= 2 }; } } };
  const req = (path) => new Request(`https://madregot.test${path}`, { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.7' } });
  await edgeGuard('POST', '/api/help', req('/api/help'), env);
  await edgeGuard('POST', '/api/help/3/reply', req('/api/help/3/reply'), env);
  await assert.rejects(() => edgeGuard('POST', '/api/class/work/0123456789abcdef', req('/api/class/work/0123456789abcdef'), env), (e) => e.status === 429 && e.code === 'slow_down');
  assert.equal(keys.length, 3);
  assert.ok(keys.every((k) => k.startsWith('n:')), 'a request with no checked token counts against its network');
});
