// The Ministry of Education's AI rules in a class, end to end through the Worker (trust spec TRUST-11 §2-5): who reaches
// the tutor in a school class, the teacher's switches and their audit rows, the per-student switch, a family device in
// a class whose tutor is off, and (TRUST-11 §5) no AI class licence sold where the rule keeps students off. Claude is
// stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MOE_RULES } from '../../shared/schoolRules.js';
import { setup, ai, makeClass, bearer, signIn, accountId, insertSub, linkDevice, countOf, rows, one } from './helpers.js';

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
