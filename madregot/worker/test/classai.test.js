// The Ministry of Education's AI rules in a class, end to end through the Worker (trust spec TRUST-11 §2-5): who reaches
// the tutor in a school class, the teacher's switches and their audit rows, the per-student switch, a family device in
// a class whose tutor is off, and (TRUST-11 §5) no AI class licence sold where the rule keeps students off. Claude is
// stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MOE_RULES } from '../../shared/schoolRules.js';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, moeApproval, needsPrivateConfirm, InputError } from '../scripts/owner.mjs';
import { setup, ai, makeClass, bearer, signIn, accountId, insertSub, linkDevice, countOf, rows, one, makeEnv } from './helpers.js';

let h;
afterEach(() => h?.done());

const APPROVED = { MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '7' };
const post = (path, headers, body = {}) => h.call('POST', path, { headers, body });
const classAi = (cls, body) => post('/api/teacher/class/ai', cls.teacher, body);
const studentAi = (cls, id, off) => post(`/api/teacher/students/${id}/ai`, cls.teacher, { off });
const dashboard = async (cls) => (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
const status = (headers) => h.call('GET', '/api/ai/status', { headers });
const err = async (r) => (await r.json()).error;
const idOf = (cls, i = 0) => cls.students[i].studentId;
const audits = (action) => rows(h.env, 'SELECT actor, action, target, detail FROM audit_log WHERE action = ? ORDER BY id', action).map((r) => ({ ...r, detail: JSON.parse(r.detail) }));
const events = () => rows(h.env, 'SELECT kind, surface, source FROM safety_events ORDER BY id').map((r) => ({ ...r }));

test('a school class before the catalogue approval: no student reaches the tutor, whatever the teacher clicks', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  assert.equal(rows(h.env, 'SELECT * FROM class_settings').length, 0, 'a new school class has no row: the safe default');
  const chat = await ai(h, 'chat', bearer(cls.students[0]));
  assert.equal(chat.status, 403); assert.equal(await err(chat), 'class_ai_off');
  const st = await status(bearer(cls.students[0]));
  assert.equal(st.status, 403); assert.equal(await err(st), 'class_ai_off');
  await h.ctx.flush();
  assert.deepEqual(events(), [{ kind: 'class_ai_off', surface: 'chat', source: 'server' }], 'one event per refused request, none for the status');
  // the teacher cannot turn it on, with or without the parents' consent
  for (const body of [{ studentAi: 'on' }, { studentAi: 'on', consent: true }]) {
    const r = await classAi(cls, body);
    assert.equal(r.status, 409);
    assert.deepEqual(await r.json(), { error: 'class_ai_locked', message: 'class_ai_locked', reason: 'not_in_catalogue' });
  }
  assert.equal(rows(h.env, 'SELECT * FROM class_settings').length, 0, 'a refused change writes nothing');
  assert.equal(audits('class.ai').length, 0);
  assert.equal((await ai(h, 'explain', bearer(cls.students[0]))).status, 403);
  // the teacher's own preparation is never blocked (the Ministry allows a teacher to prepare materials with it)
  const t = await ai(h, 'chat', cls.teacher);
  assert.equal(t.status, 200); assert.equal(t.headers.get('X-AI-Tier'), 'free');
  assert.equal((await status(cls.teacher)).status, 200);
  // the dashboard says why, with the Ministry's links
  const d = await dashboard(cls);
  assert.deepEqual(d.aiPolicy, {
    students: 'off', canTurnOn: false, reason: 'not_in_catalogue', teacherAi: 'prep', setting: 'school', studentAi: 'off', consentAt: null,
    fromGrade: 7, rulesVersion: '2026-01-20', rulesUrl: MOE_RULES.url, consentFormUrl: MOE_RULES.consentFormUrl, consentPdfUrl: MOE_RULES.consentPdfUrl,
  });
  assert.equal(d.students[0].aiOff, false);
});

test('with the paywall off (today\'s default) the rule holds the same: students refused for every kind, the teacher\'s generate served', async () => {
  h = await setup({ AI_PAYWALL: 'off' });
  const cls = await makeClass(h, { students: ['נועה'] });
  for (const kind of ['explain', 'chat', 'check', 'generate', 'exam']) {
    const r = await ai(h, kind, bearer(cls.students[0]));
    assert.equal(r.status, 403, kind); assert.equal(await err(r), 'class_ai_off', kind);
  }
  assert.equal(countOf(h.env, `s:${idOf(cls)}`), 0, 'nothing counted');
  assert.equal(await err(await status(bearer(cls.students[0]))), 'class_ai_off');
  const t = await ai(h, 'generate', cls.teacher);
  assert.equal(t.status, 200); assert.equal(t.headers.get('X-AI-Tier'), 'open');
  assert.equal((await (await status(cls.teacher)).json()).tier, 'open');
});

test('approved, grade 7: on needs the parents\' consent first; then students may ask; the per-student switch turns one off', async () => {
  h = await setup(APPROVED);
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const noConsent = await classAi(cls, { studentAi: 'on' });
  assert.equal(noConsent.status, 409); assert.equal(await err(noConsent), 'consent_needed');
  assert.equal((await ai(h, 'chat', bearer(cls.students[0]))).status, 403);
  const before = Date.now();
  const r = await classAi(cls, { consent: true, studentAi: 'on' });
  assert.equal(r.status, 200);
  const { policy } = await r.json();
  assert.equal(policy.students, 'on'); assert.equal(policy.reason, 'ok'); assert.equal(policy.studentAi, 'on');
  assert.ok(Date.parse(policy.consentAt) >= before - 1000);
  assert.deepEqual(audits('class.ai').map((a) => a.detail), [{ studentAi: 'on', consent: true }]);
  assert.equal(audits('class.ai')[0].actor, `teacher:${cls.code}`); assert.equal(audits('class.ai')[0].target, `class:${cls.code}`);
  const ok = await ai(h, 'chat', bearer(cls.students[0]));
  assert.equal(ok.status, 200);
  assert.equal((await status(bearer(cls.students[0]))).status, 200);
  // one student without the parents' agreement: the tutor off for them only (the Ministry's "alternative activity")
  const off = await studentAi(cls, idOf(cls, 1), true);
  assert.equal(off.status, 200); assert.deepEqual(await off.json(), { id: idOf(cls, 1), aiOff: true });
  assert.equal((await ai(h, 'chat', bearer(cls.students[1]))).status, 403);
  assert.equal((await ai(h, 'chat', bearer(cls.students[0]))).status, 200);
  assert.deepEqual((await dashboard(cls)).students.map((s) => [s.name, s.aiOff]).sort(), [['איתי', true], ['נועה', false]]);
  assert.deepEqual(audits('student.ai').map((a) => [a.target, a.detail]), [[`student:${idOf(cls, 1)}`, { off: true }]]);
  // on again; the teacher's class switch off turns everyone off, and the consent stays recorded
  await studentAi(cls, idOf(cls, 1), false);
  assert.equal((await ai(h, 'chat', bearer(cls.students[1]))).status, 200);
  const down = await (await classAi(cls, { studentAi: 'off' })).json();
  assert.equal(down.policy.reason, 'teacher_off'); assert.ok(down.policy.consentAt);
  assert.equal((await ai(h, 'chat', bearer(cls.students[0]))).status, 403);
  // a student of another class cannot be switched from here; bad input is refused
  const other = await makeClass(h, { students: ['דנה'] });
  assert.equal((await studentAi(cls, idOf(other), true)).status, 404);
  assert.equal((await post(`/api/teacher/students/${idOf(cls)}/ai`, cls.teacher, { off: 'yes' })).status, 400);
  for (const body of [{}, { studentAi: 'maybe' }, { consent: false }, { setting: 'home' }]) assert.equal((await classAi(cls, body)).status, 400, JSON.stringify(body));
  assert.equal((await post('/api/teacher/class/ai', { 'X-Class-Code': cls.code, 'X-Teacher-Key': 'wrong' }, { studentAi: 'off' })).status, 401);
});

test('approved from grade 8 only (the old rule): a grade 7 school class stays locked with reason grade', async () => {
  h = await setup({ MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '8' });
  const cls = await makeClass(h, { students: ['נועה'] });
  const r = await classAi(cls, { consent: true, studentAi: 'on' });
  assert.equal(r.status, 409); assert.equal((await r.json()).reason, 'grade');
  const d = await dashboard(cls);
  assert.equal(d.aiPolicy.reason, 'grade'); assert.equal(d.aiPolicy.fromGrade, 8);
});

test('a private group: the teacher attests it when making the class (audited), then consent and on, before any approval', async () => {
  h = await setup();
  const body = { className: 'חוג', teacherName: 'רונית', grade: '7' };
  const missing = await h.call('POST', '/api/classes', { body: { ...body, setting: 'private' } });
  assert.equal(missing.status, 400); assert.equal(await err(missing), 'private_attest_required');
  assert.equal(rows(h.env, 'SELECT * FROM classes').length, 0, 'nothing was made');
  assert.equal((await h.call('POST', '/api/classes', { body: { ...body, setting: 'club' } })).status, 400);
  const r = await h.call('POST', '/api/classes', { body: { ...body, setting: 'private', privateAttest: true } });
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.equal(c.setting, 'private');
  const row = one(h.env, 'SELECT * FROM class_settings WHERE code = ?', c.code);
  assert.equal(row.setting, 'private'); assert.equal(row.student_ai, 'off'); assert.equal(row.ai_consent_at, null);
  assert.ok(row.private_attested_at);
  assert.deepEqual(audits('class.setting'), [{ actor: `teacher:${c.code}`, action: 'class.setting', target: `class:${c.code}`, detail: { setting: 'private', attested: true } }]);
  const teacher = { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey };
  const s = await (await h.call('POST', `/api/classes/${c.code}/join`, { body: { name: 'נועה', pin: '1234' } })).json();
  const cls = { code: c.code, teacher, students: [s] };
  assert.equal((await ai(h, 'chat', bearer(s))).status, 403, 'no consent yet');
  assert.equal(await err(await classAi(cls, { studentAi: 'on' })), 'consent_needed');
  assert.equal((await classAi(cls, { consent: true })).status, 200);
  const on = await classAi(cls, { studentAi: 'on' });
  assert.equal((await on.json()).policy.students, 'on');
  assert.equal((await ai(h, 'chat', bearer(s))).status, 200);
  // a school class made with no setting is a school class
  const school = await (await h.call('POST', '/api/classes', { body })).json();
  assert.equal(school.setting, 'school');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_settings WHERE code = ?', school.code).n, 0);
});

test('a change of setting needs the same attestation and starts again from student AI off with no consent', async () => {
  h = await setup();
  const cls = await makeClass(h, { studentAi: true, students: ['נועה'] });
  assert.equal((await ai(h, 'chat', bearer(cls.students[0]))).status, 200);
  const school = await classAi(cls, { setting: 'school' });
  assert.equal(school.status, 200);
  const p = (await school.json()).policy;
  assert.deepEqual([p.setting, p.studentAi, p.consentAt, p.reason], ['school', 'off', null, 'not_in_catalogue']);
  assert.equal(one(h.env, 'SELECT private_attested_at FROM class_settings WHERE code = ?', cls.code).private_attested_at, null);
  assert.equal((await ai(h, 'chat', bearer(cls.students[0]))).status, 403);
  const back = await classAi(cls, { setting: 'private' });
  assert.equal(back.status, 400); assert.equal(await err(back), 'private_attest_required');
  const priv = await classAi(cls, { setting: 'private', privateAttest: true, consent: true, studentAi: 'on' });
  assert.equal(priv.status, 200);
  assert.equal((await priv.json()).policy.students, 'on');
  assert.deepEqual(audits('class.setting').map((a) => a.detail), [{ setting: 'school', attested: false }, { setting: 'private', attested: true }]);
  assert.equal((await ai(h, 'chat', bearer(cls.students[0]))).status, 200);
});

test('a family device in a class whose tutor is off: the family\'s request (tier family), and no class counter moves', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  insertSub(h.env, { kind: 'class', class_code: cls.code }); // even a class licence does not open the tutor to its students here
  await signIn(h, 'home@example.test');
  const a = accountId(h.env, 'home@example.test');
  insertSub(h.env, { kind: 'family', account_id: a });
  const fd = await linkDevice(h.env, a);
  const id = idOf(cls);
  const headers = { ...bearer(cls.students[0]), ...fd.headers };
  const r = await ai(h, 'explain', headers);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'family');
  assert.equal(countOf(h.env, `fam:${a}:tutor`), 1);
  const st = await (await status(headers)).json();
  assert.equal(st.tier, 'family');
  const classKeys = rows(h.env, "SELECT who FROM ai_usage WHERE who LIKE 'cls:%' OR who LIKE 's:%' OR who LIKE 'free:c:%' OR who LIKE 'free:s:%' OR who LIKE '%' || ? || '%'", cls.code)
    .concat(rows(h.env, "SELECT who FROM ai_usage WHERE who LIKE '%' || ? || '%'", id));
  assert.deepEqual(classKeys, [], 'nothing counted for the class or the class student');
  // the same student without the family link is refused
  assert.equal((await ai(h, 'explain', bearer(cls.students[0]))).status, 403);
  // with no live family plan, the linked device gets its own free taste, still not the class's
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'ended' WHERE kind = 'family'").run();
  const free = await ai(h, 'chat', headers);
  assert.equal(free.status, 200); assert.equal(free.headers.get('X-AI-Tier'), 'free');
  assert.equal(countOf(h.env, `free:fd:${fd.id}`), 1);
  assert.equal(countOf(h.env, `free:c:${cls.code}`), 0);
  assert.equal(countOf(h.env, `free:s:${id}`), 0);
});

test('removing a student removes their AI switch too', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  await studentAi(cls, idOf(cls), true);
  assert.equal(rows(h.env, 'SELECT * FROM student_ai_off').length, 1);
  assert.equal((await post(`/api/teacher/students/${idOf(cls)}/remove`, cls.teacher)).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM student_ai_off').length, 0);
});

// ---------------------------------------------------------------- selling within the rules (TRUST-11 §5)
const KEY = 'class-ai-0123456789abcdef';
const buy = (token, cls, key = KEY) => h.call('POST', '/api/billing/checkout', {
  headers: { 'X-Account-Token': token, 'Idempotency-Key': key, ...cls.teacher }, body: { plan: 'class_year', seats: 30, adult: true, terms: '2026-11' },
});
const request = (token, cls, wants) => h.call('POST', '/api/teacher/licence/request', {
  headers: { ...cls.teacher, 'X-Account-Token': token }, body: { wants, school: 'בית ספר דוגמה', classes: 1 },
});
const claim = (cls, code) => h.call('POST', '/api/teacher/licence/claim', { headers: cls.teacher, body: { code } });
const CODE = 'ABCD-EFGH-JKMN';
const schoolCode = () => h.env.DB.raw.exec(build('grant-school', { classes: '3', seats: '30', until: '2099-08-31', invoice: 'INV-1' }, { code: CODE, approval: 'approved' }).sql);

test('a school class before the approval: no class_year checkout, no trial, no licence code; a quote request stays open', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const token = await signIn(h, 'teacher@example.test');
  const r = await buy(token, cls);
  assert.equal(r.status, 409);
  assert.deepEqual(await r.json(), { error: 'school_ai_not_approved', message: 'school_ai_not_approved', reason: 'not_in_catalogue' });
  assert.equal(rows(h.env, 'SELECT * FROM orders').length, 0, 'no order, no payment page');
  const trial = await request(token, cls, 'trial');
  assert.equal(trial.status, 409); assert.equal(await err(trial), 'school_ai_not_approved');
  const quote = await request(token, cls, 'quote');
  assert.equal(quote.status, 200);
  assert.deepEqual(rows(h.env, 'SELECT wants FROM licence_requests').map((x) => x.wants), ['quote']);
  await h.ctx.flush();
  const mail = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] בקשה להצעת מחיר'));
  assert.match(mail.text, /עד האישור בקטלוג של משרד החינוך העוזר החכם כבוי לתלמידים בכיתות של בית ספר/);
  schoolCode();
  const c = await claim(cls, CODE);
  assert.equal(c.status, 409); assert.equal(await err(c), 'school_ai_not_approved');
  assert.equal(one(h.env, 'SELECT classes_left FROM licence_codes').classes_left, 3, 'the code keeps its places');
  assert.equal(rows(h.env, "SELECT * FROM subscriptions WHERE kind = 'class'").length, 0);
});

test('approved: a grade the approval covers may buy (consent comes after); a grade it does not cover may not', async () => {
  h = await setup(APPROVED);
  const cls = await makeClass(h);
  const token = await signIn(h, 'teacher@example.test');
  assert.equal((await buy(token, cls)).status, 201);
  h.done();
  h = await setup({ MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '8' });
  const seven = await makeClass(h);
  const t2 = await signIn(h, 'teacher@example.test');
  const r = await buy(t2, seven);
  assert.equal(r.status, 409); assert.equal((await r.json()).reason, 'grade');
  assert.equal((await request(t2, seven, 'trial')).status, 409);
  schoolCode();
  assert.equal((await claim(seven, CODE)).status, 409);
});

test('a private group buys as before: checkout, a trial request, a licence code', async () => {
  h = await setup();
  const cls = await makeClass(h, { setting: 'private' });
  const token = await signIn(h, 'teacher@example.test');
  assert.equal((await buy(token, cls)).status, 201);
  assert.equal((await request(token, cls, 'trial')).status, 200);
  await h.ctx.flush();
  const mail = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] בקשה לניסיון'));
  assert.match(mail.text, new RegExp(`grant-class --class ${cls.code} --seats 30 --trial --private-ok --note`));
  schoolCode();
  assert.equal((await claim(cls, CODE)).status, 200);
});

// ---------------------------------------------------------------- no personal data from teachers (TRUST-11 §7)
test('a teacher\'s free text is masked before it reaches the AI, as a child\'s is; the pictures are untouched', async () => {
  h = await setup({ AI_PAYWALL: 'off' });
  const cls = await makeClass(h);
  const said = 'תרגילים לנועה, הטלפון של אמא 052-1234567, noa@example.test';
  const r = await ai(h, 'generate', cls.teacher, { body: { topic: said, level: 'ת"ז 000000018', count: 3, examples: said } });
  assert.equal(r.status, 200);
  const sent = JSON.stringify(h.net.log.claude.at(-1).messages);
  assert.doesNotMatch(sent, /052-?1234567|noa@example\.test|000000018/);
  assert.match(sent, /\[טלפון\]/); assert.match(sent, /\[מייל\]/);
  const image = 'data:image/jpeg;base64,/9j/0521234567';
  const check = await ai(h, 'check', cls.teacher, { body: { image, mediaType: 'image/jpeg', question: 'של דנה, 052-7654321' } });
  assert.equal(check.status, 200);
  const params = h.net.log.claude.at(-1);
  assert.equal(params.messages[0].content[0].source.data, '/9j/0521234567', 'the picture is sent as it is');
  assert.doesNotMatch(params.messages[0].content[1].text, /7654321/);
  // a child's photo check question goes as before (the chat and typed answers are masked for everyone: TRUST-4)
  const st = await makeClass(h, { studentAi: true, students: ['נועה'] });
  await ai(h, 'chat', bearer(st.students[0]), { body: { messages: [{ role: 'user', content: 'המייל שלי noa@example.test' }] } });
  assert.doesNotMatch(JSON.stringify(h.net.log.claude.at(-1).messages), /noa@example\.test/);
});

// ---------------------------------------------------------------- the owner's CLI (TRUST-11 §5)
const NOW = '2026-11-10T10:00:00.000Z';
test('owner CLI: grant-class and grant-school refuse while MOE_AI_APPROVAL is not "approved", unless a private group is confirmed', () => {
  const grantClass = { class: 'ABC234', until: '2027-08-31', seats: '30' };
  const grantSchool = { classes: '2', seats: '30', until: '2027-08-31', invoice: 'INV-3' };
  for (const [cmd, o] of [['grant-class', grantClass], ['grant-class', { ...grantClass, trial: true, until: undefined }], ['grant-school', grantSchool]]) {
    assert.throws(() => build(cmd, o, { now: NOW, approval: 'none' }), /refused: student AI in school classes waits for the Ministry's catalogue approval/, cmd);
    assert.throws(() => build(cmd, { ...o, 'private-ok': true }, { now: NOW, approval: 'none', confirmed: 'private' }), /needs --note/, cmd);
    assert.throws(() => build(cmd, { ...o, 'private-ok': true, note: true }, { now: NOW, approval: 'none', confirmed: 'private' }), /needs --note/, cmd);
    assert.throws(() => build(cmd, { ...o, 'private-ok': true, note: 'חוג' }, { now: NOW, approval: 'none', confirmed: 'yes' }), /not confirmed/, cmd);
    assert.ok(build(cmd, o, { now: NOW, approval: 'approved' }).sql, `${cmd} after the approval`);
    assert.equal(needsPrivateConfirm(cmd, { 'private-ok': true }, 'none'), true);
    assert.equal(needsPrivateConfirm(cmd, { 'private-ok': true }, 'approved'), false);
  }
  assert.equal(needsPrivateConfirm('grant-family', { 'private-ok': true }, 'none'), false);
  assert.ok(build('grant-family', { email: 'p@example.test', until: '2027-01-31' }, { now: NOW, approval: 'none' }).sql, 'a family plan is not a class licence');
  // a confirmed private group: granted, with the note on the licence and privateOk in the audit row
  const env = makeEnv();
  env.DB.raw.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES ('ABC234', 'חוג', '7', 'רונית', 'x', ?)").run(NOW);
  const b = build('grant-class', { ...grantClass, 'private-ok': true, note: 'חוג מתמטיקה פרטי' }, { now: NOW, id: '0123456789abcdef', approval: 'none', confirmed: 'private' });
  assert.match(b.print, /private group/);
  env.DB.raw.exec(b.sql);
  assert.equal(one(env, 'SELECT note FROM subscriptions').note, 'חוג מתמטיקה פרטי');
  assert.equal(JSON.parse(one(env, "SELECT detail FROM audit_log WHERE action = 'licence.grant'").detail).privateOk, true);
  const s = build('grant-school', { ...grantSchool, 'private-ok': true, note: 'רשת חוגים' }, { now: NOW, code: 'ABCD-EFGH-JKLM', approval: 'none', confirmed: 'private' });
  assert.match(s.print, /give it to the private group\): ABCD-EFGH-JKLM/);
});

test('owner CLI: MOE_AI_APPROVAL comes from the environment, else from wrangler.toml with the spec\'s pattern', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'moe-'));
  try {
    const toml = path.join(dir, 'wrangler.toml');
    writeFileSync(toml, '[vars]\nMOE_AI_APPROVAL = "approved"\n');
    assert.equal(moeApproval({}, toml), 'approved');
    assert.equal(moeApproval({ MOE_AI_APPROVAL: 'none' }, toml), 'none', 'the environment first');
    writeFileSync(toml, '[vars]\n# MOE_AI_APPROVAL = "approved"\nMOE_AI_APPROVAL = "none"\n');
    assert.equal(moeApproval({}, toml), 'none');
    assert.equal(moeApproval({}, path.join(dir, 'missing.toml')), 'none', 'no file: the safe default');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(moeApproval({}), 'none', 'the repository\'s wrangler.toml says none');
});

test('owner CLI exit codes: refused grants exit 1 and never reach wrangler', () => {
  const script = fileURLToPath(new URL('../scripts/owner.mjs', import.meta.url));
  const dir = mkdtempSync(path.join(tmpdir(), 'owner-'));
  try {
    // a stand-in npx that leaves a mark: no refused command may run it (and --local keeps any slip off the real database)
    const mark = path.join(dir, 'ran');
    writeFileSync(path.join(dir, 'npx'), `#!/bin/sh\necho "$@" > "${mark}"\nexit 3\n`);
    chmodSync(path.join(dir, 'npx'), 0o755);
    const env = { ...process.env, PATH: dir };
    delete env.MOE_AI_APPROVAL;
    const run = (args, { input = '', extra = {} } = {}) => spawnSync(process.execPath, [script, ...args, '--local'], { env: { ...env, ...extra }, input, encoding: 'utf8' });
    const cls = ['grant-class', '--class', 'ABC234', '--until', '2027-08-31', '--seats', '30'];
    const school = ['grant-school', '--classes', '2', '--seats', '30', '--until', '2027-08-31', '--invoice', 'INV-3'];
    for (const args of [cls, school]) {
      const r = run(args); // the approval read from wrangler.toml: "none"
      assert.equal(r.status, 1, `${args[0]}: ${r.stderr}`); assert.match(r.stderr, /refused: student AI in school classes/);
      const env1 = run(args, { extra: { MOE_AI_APPROVAL: 'none' } });
      assert.equal(env1.status, 1);
      const noNote = run([...args, '--private-ok']);
      assert.equal(noNote.status, 1); assert.match(noNote.stderr, /needs --note/);
      const wrong = run([...args, '--private-ok', '--note', 'חוג'], { input: 'school\n' });
      assert.equal(wrong.status, 1); assert.match(wrong.stderr, /not confirmed/);
      const none = run([...args, '--private-ok', '--note', 'חוג']); // no answer at all
      assert.equal(none.status, 1);
    }
    assert.equal(existsSync(mark), false, 'wrangler was never run');
    assert.equal(run(['help']).status, 0);
    // "private" typed: the command goes on to the database step (here the stand-in, which fails, so the exit is 1)
    const ok = run([...cls, '--private-ok', '--note', 'חוג'], { input: 'private\n' });
    assert.equal(ok.status, 1);
    assert.match(readFileSync(mark, 'utf8'), /^wrangler d1 execute madregot --local --file /);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
