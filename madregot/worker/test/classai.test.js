// Student AI by the Ministry of Education's rules (spec TRUST-11), against the in-memory D1: a school class while
// Madregot is not in the catalogue (whatever the teacher clicks, no student AI, nothing sold but a quote), the approved
// path (consent first, then the switch, and per student off), a private group (the teacher's attestation, audited), the
// family device at home, the dashboard's policy, and the owner's CLI. Every name and address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MOE_RULES } from '../../shared/schoolRules.js';
import { cli, schoolGate, moeVars } from '../scripts/owner.mjs';
import { setup, makeClass, bearer, ai, signIn, accountId, insertSub, linkDevice, rows, one, countOf, setCount } from './helpers.js';

let h;
afterEach(() => h?.done());
const KEY = 'attempt-0123456789abcdef';
const classAi = (cls, body) => h.call('POST', '/api/teacher/class/ai', { headers: cls.teacher, body });
const studentAi = (cls, s, off) => h.call('POST', `/api/teacher/students/${s.studentId}/ai`, { headers: cls.teacher, body: { off } });
const status = async (headers) => (await h.call('GET', '/api/ai/status', { headers })).json();
const board = async (cls) => (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
const err = async (res, code, want) => { const b = await res.json(); assert.equal(res.status, code, JSON.stringify(b)); assert.equal(b.error, want); return b; };
const newClass = (body, headers = {}) => h.call('POST', '/api/classes', { body: { className: 'קבוצת תגבור', teacherName: 'רונית', grade: '7', ...body }, headers });
const audits = (action) => rows(h.env, 'SELECT * FROM audit_log WHERE action = ? ORDER BY id', action);

test('a school class while Madregot is not in the catalogue: no student AI whatever the teacher does, and only a quote is sold', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  assert.equal(rows(h.env, 'SELECT * FROM class_settings').length, 0, 'no settings row: a school class, off');
  // the student: 403 class_ai_off for every kind, nothing counted but the refusal; the status says off
  for (const kind of ['explain', 'chat', 'check']) await err(await ai(h, kind, bearer(noa)), 403, 'class_ai_off');
  assert.equal(h.net.log.claude.length, 0, 'Claude was never asked');
  assert.equal(countOf(h.env, `free:s:${noa.studentId}`), 0);
  assert.equal(countOf(h.env, `aioff:c:${cls.code}`), 3, 'the refusals are counted for the owner');
  const st = await status(bearer(noa));
  assert.equal(st.tier, 'class_off'); assert.equal(st.classAi, 'off'); assert.deepEqual(st.kinds, []);
  // the teacher cannot turn it on, with or without consent
  const locked = await err(await classAi(cls, { studentAi: 'on' }), 409, 'class_ai_locked');
  assert.equal(locked.reason, 'not_in_catalogue');
  await err(await classAi(cls, { consent: true, studentAi: 'on' }), 409, 'class_ai_locked');
  assert.equal((await ai(h, 'explain', bearer(noa))).status, 403);
  // the dashboard says why, with the rules' version and the links
  const d = await board(cls);
  assert.deepEqual(d.aiPolicy, {
    students: 'off', canTurnOn: false, reason: 'not_in_catalogue', teacherAi: 'prep', setting: 'school', consentAt: null,
    rulesVersion: '2026-01-20', rulesUrl: MOE_RULES.url, consentFormUrl: MOE_RULES.consentFormUrl, consentPdfUrl: MOE_RULES.consentPdfUrl,
  });
  assert.deepEqual(d.students.map((s) => s.aiOff), [false]);
  // the teacher's own AI (preparing materials) works
  const own = await ai(h, 'explain', cls.teacher);
  assert.equal(own.status, 200); assert.equal(own.headers.get('X-AI-Tier'), 'free');
  // selling: checkout of a class year, a trial and a school licence code are 409; a quote request is open
  const t = await signIn(h, 'teacher@example.test');
  const buy = await h.call('POST', '/api/billing/checkout', { headers: { ...cls.teacher, 'X-Account-Token': t, 'Idempotency-Key': KEY }, body: { plan: 'class_year', seats: 30, adult: true, terms: '2026-11' } });
  assert.equal((await err(buy, 409, 'school_ai_not_approved')).reason, 'not_in_catalogue');
  assert.equal(rows(h.env, 'SELECT * FROM orders').length, 0);
  const req = (wants) => h.call('POST', '/api/teacher/licence/request', { headers: { ...cls.teacher, 'X-Account-Token': t }, body: { wants, school: 'חטיבת הביניים לדוגמה', classes: 1 } });
  await err(await req('trial'), 409, 'school_ai_not_approved');
  assert.equal((await req('quote')).status, 200);
  assert.equal(one(h.env, 'SELECT wants FROM licence_requests').wants, 'quote');
  await err(await h.call('POST', '/api/teacher/licence/claim', { headers: cls.teacher, body: { code: 'ABCD-EFGH-JKMN' } }), 409, 'school_ai_not_approved');
  assert.equal(countOf(h.env, `licclaim:c:${cls.code}`), 0, 'the refusal uses up no try');
  // the same with the switch off (the default before the paid tutor)
  h.env.AI_PAYWALL = 'off';
  await err(await ai(h, 'explain', bearer(noa)), 403, 'class_ai_off');
  assert.equal((await status(bearer(noa))).tier, 'class_off');
  assert.equal((await ai(h, 'explain', cls.teacher)).status, 200);
});

test('approved for grade 7: on needs consent, then students have it; one student turned off is refused; grade 8 approval keeps grade 7 off', async () => {
  h = await setup({ MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '7' });
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  insertSub(h.env, { kind: 'class', class_code: cls.code, seats: 30 });
  assert.equal((await board(cls)).aiPolicy.reason, 'consent_needed');
  await err(await classAi(cls, { studentAi: 'on' }), 409, 'consent_needed');
  await err(await ai(h, 'explain', bearer(noa)), 403, 'class_ai_off');
  const consent = await (await classAi(cls, { consent: true })).json();
  assert.equal(consent.policy.reason, 'teacher_off');
  assert.ok(consent.policy.consentAt);
  await err(await ai(h, 'explain', bearer(noa)), 403, 'class_ai_off');
  const on = await (await classAi(cls, { studentAi: 'on' })).json();
  assert.deepEqual([on.policy.students, on.policy.reason, on.policy.teacherAi], ['on', 'ok', 'on']);
  const r = await ai(h, 'explain', bearer(noa));
  assert.equal(r.status, 200); assert.equal(r.headers.get('X-AI-Tier'), 'class');
  assert.equal((await status(bearer(noa))).tier, 'class');
  // the teacher turns it off for one student (no consent for him): he is refused, she is not
  assert.deepEqual(await (await studentAi(cls, itai, true)).json(), { aiOff: true });
  await err(await ai(h, 'explain', bearer(itai)), 403, 'class_ai_off');
  assert.equal((await ai(h, 'explain', bearer(noa))).status, 200);
  assert.deepEqual((await board(cls)).students.map((s) => [s.name, s.aiOff]), [['איתי', true], ['נועה', false]]);
  assert.equal((await studentAi(cls, itai, false)).status, 200);
  assert.equal((await ai(h, 'explain', bearer(itai))).status, 200);
  // another class's student, and a bad body
  const other = await makeClass(h, { students: ['זר'] });
  await err(await studentAi(cls, other.students[0], true), 404, 'not_found');
  await err(await h.call('POST', `/api/teacher/students/${noa.studentId}/ai`, { headers: cls.teacher, body: { off: 'yes' } }), 400, 'bad_request');
  // the switch off again; audit rows for every change, never with a name
  assert.equal((await classAi(cls, { studentAi: 'off' })).status, 200);
  await err(await ai(h, 'explain', bearer(noa)), 403, 'class_ai_off');
  assert.deepEqual(audits('class.ai').map((a) => JSON.parse(a.detail)), [{ consent: true }, { studentAi: 'on' }, { studentAi: 'off' }]);
  assert.deepEqual(audits('student.ai').map((a) => [a.target, JSON.parse(a.detail).off]), [[`student:${itai.studentId}`, true], [`student:${itai.studentId}`, false]]);
  assert.doesNotMatch(JSON.stringify(rows(h.env, 'SELECT * FROM audit_log')), /נועה|איתי/);
  // selling is open for an approved grade: a claim gets past the rules to the code itself
  await err(await h.call('POST', '/api/teacher/licence/claim', { headers: cls.teacher, body: { code: 'ABCD-EFGH-JKMN' } }), 400, 'bad_licence_code');
  h.done();
  // the old rule, independent use from grade 8: a grade 7 school class stays off, reason grade
  h = await setup({ MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '8' });
  const seven = await makeClass(h, { students: ['דנה'] });
  assert.equal((await err(await classAi(seven, { consent: true, studentAi: 'on' }), 409, 'class_ai_locked')).reason, 'grade');
  const t = await signIn(h, 'teacher@example.test');
  const trial = await h.call('POST', '/api/teacher/licence/request', { headers: { ...seven.teacher, 'X-Account-Token': t }, body: { wants: 'trial', school: 'חטיבה לדוגמה', classes: 1 } });
  assert.equal((await err(trial, 409, 'school_ai_not_approved')).reason, 'grade');
});

test('a private group: the attestation is required and audited; consent then on gives the students the AI', async () => {
  h = await setup();
  await err(await newClass({ setting: 'private' }), 400, 'private_attest_required');
  await err(await newClass({ setting: 'private', privateAttest: 'yes' }), 400, 'private_attest_required');
  await err(await newClass({ setting: 'club' }), 400, 'bad_request');
  assert.equal(rows(h.env, 'SELECT * FROM classes').length, 0, 'no class was made');
  const made = await (await newClass({ setting: 'private', privateAttest: true })).json();
  assert.equal(made.setting, 'private');
  const row = one(h.env, 'SELECT * FROM class_settings WHERE code = ?', made.code);
  assert.equal(row.setting, 'private'); assert.ok(row.private_attested_at); assert.equal(row.student_ai, 'off'); assert.equal(row.ai_consent_at, null);
  assert.deepEqual(audits('class.setting').map((a) => [a.actor, a.target, JSON.parse(a.detail)]), [[`teacher:${made.code}`, `class:${made.code}`, { setting: 'private' }]]);
  // with an account: the audit row says so
  const t = await signIn(h, 'teacher@example.test');
  const owned = await (await newClass({ setting: 'private', privateAttest: true }, { 'X-Account-Token': t })).json();
  assert.equal(owned.owned, true);
  assert.deepEqual(JSON.parse(audits('class.setting')[1].detail), { setting: 'private', via: 'account' });
  // a school class (the default) has no row
  const school = await (await newClass({})).json();
  assert.equal(school.setting, 'school');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_settings WHERE code = ?', school.code).n, 0);
  // consent, then on: the student asks
  const teacher = { 'X-Class-Code': made.code, 'X-Teacher-Key': made.teacherKey };
  const s = await (await h.call('POST', `/api/classes/${made.code}/join`, { body: { name: 'גל', pin: '1234' } })).json();
  await err(await ai(h, 'explain', bearer(s)), 403, 'class_ai_off');
  await err(await h.call('POST', '/api/teacher/class/ai', { headers: teacher, body: { studentAi: 'on' } }), 409, 'consent_needed');
  const on = await (await h.call('POST', '/api/teacher/class/ai', { headers: teacher, body: { consent: true, studentAi: 'on' } })).json();
  assert.equal(on.policy.reason, 'ok');
  assert.equal((await ai(h, 'explain', bearer(s))).status, 200);
});

test('changing the setting: private needs the attestation, and a change starts over (switch off, consent asked again)', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'], ai: true });
  const [noa] = cls.students;
  assert.equal((await ai(h, 'explain', bearer(noa))).status, 200);
  // to school: off at once (not in the catalogue), the consent and the switch cleared
  const school = await (await classAi(cls, { setting: 'school' })).json();
  assert.deepEqual([school.policy.setting, school.policy.reason, school.policy.consentAt], ['school', 'not_in_catalogue', null]);
  await err(await ai(h, 'explain', bearer(noa)), 403, 'class_ai_off');
  assert.deepEqual({ ...one(h.env, 'SELECT setting, student_ai, ai_consent_at, private_attested_at FROM class_settings WHERE code = ?', cls.code) },
    { setting: 'school', student_ai: 'off', ai_consent_at: null, private_attested_at: null });
  // back to private: the attestation again; then consent and the switch again
  await err(await classAi(cls, { setting: 'private' }), 400, 'private_attest_required');
  const back = await (await classAi(cls, { setting: 'private', privateAttest: true })).json();
  assert.deepEqual([back.policy.setting, back.policy.reason], ['private', 'consent_needed']);
  await err(await ai(h, 'explain', bearer(noa)), 403, 'class_ai_off');
  assert.ok(one(h.env, 'SELECT private_attested_at FROM class_settings WHERE code = ?', cls.code).private_attested_at);
  // audited: the helper's consent and switch, then the two changes (the refused one wrote nothing)
  assert.deepEqual(audits('class.ai').map((a) => JSON.parse(a.detail)), [{ consent: true, studentAi: 'on' }, { setting: 'school' }, { setting: 'private' }]);
  await err(await classAi(cls, {}), 400, 'bad_request');
  await err(await classAi(cls, { studentAi: 'maybe' }), 400, 'bad_request');
  await err(await classAi(cls, { consent: false }), 400, 'bad_request');
  assert.equal((await h.call('POST', '/api/teacher/class/ai', { body: { studentAi: 'off' } })).status, 401);
});

test('a student in a class with the AI off, on a device a parent linked: the family plan answers, as at home; no class counter moves', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  await signIn(h, 'parent@example.test');
  const a = accountId(h.env, 'parent@example.test');
  insertSub(h.env, { kind: 'family', account_id: a });
  const dev = await linkDevice(h.env, a);
  const both = { ...bearer(noa), ...dev.headers };
  const r = await ai(h, 'explain', both);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'family');
  assert.equal(countOf(h.env, `fam:${a}:tutor`), 1);
  assert.equal(rows(h.env, 'SELECT who FROM ai_usage WHERE who LIKE ? OR who LIKE ? OR who LIKE ?', `%${cls.code}%`, `s:${noa.studentId}%`, `free:s:${noa.studentId}%`).length, 0, 'no class or student counter');
  const st = await status(both);
  assert.equal(st.tier, 'family');
  // a linked device whose plan ended: the free taste of that device, still not the class's
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'ended', current_period_start = ?, current_period_end = ? WHERE account_id = ?")
    .run(new Date(Date.now() - 864e5 * 60).toISOString(), new Date(Date.now() - 864e5 * 30).toISOString(), a);
  const free = await ai(h, 'explain', both);
  assert.equal(free.status, 200); assert.equal(free.headers.get('X-AI-Tier'), 'free');
  assert.equal(countOf(h.env, `free:fd:${dev.id}`), 1);
  assert.equal(countOf(h.env, `free:c:${cls.code}`), 0);
  // without the device the student is refused
  await err(await ai(h, 'explain', bearer(noa)), 403, 'class_ai_off');
});

test('the teacher\'s own AI is never gated; deleting the class or the student takes their rows and the refusal counter', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'], ai: true });
  const [noa, itai] = cls.students;
  assert.equal((await studentAi(cls, itai, true)).status, 200);
  await err(await ai(h, 'explain', bearer(itai)), 403, 'class_ai_off');
  assert.equal(countOf(h.env, `aioff:c:${cls.code}`), 1);
  assert.equal((await h.call('POST', `/api/teacher/students/${itai.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM student_ai_off').length, 0, 'removing the student removes the row');
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'student.ai'").length, 0);
  assert.equal((await studentAi(cls, noa, true)).status, 200);
  assert.equal((await h.call('POST', '/api/teacher/class/delete', { headers: cls.teacher, body: { confirm: 'DELETE' } })).status, 200);
  for (const t of ['student_ai_off', 'class_settings']) assert.equal(rows(h.env, `SELECT * FROM ${t}`).length, 0, t);
  assert.equal(countOf(h.env, `aioff:c:${cls.code}`), 0);
});

// ---------------------------------------------------------------- the owner's CLI (scripts/owner.mjs)
/** The CLI against the in-memory database: reads and writes go to it, the typed answer is given. */
function io(env, { typed = '', vars = { MOE_AI_APPROVAL: 'none', MOE_AI_FROM_GRADE: '7' } } = {}) {
  const out = { logs: [], errors: [], asked: 0, ran: 0 };
  return Object.assign(out, {
    env: vars,
    query: async (sql) => env.DB.raw.prepare(sql.replace(/;\s*$/, '')).get() || null,
    exec: async (b) => { out.ran += 1; env.DB.raw.exec(b.sql); return ''; },
    prompt: async () => { out.asked += 1; return typed; },
    log: (...a) => out.logs.push(a.join(' ')),
    error: (...a) => out.errors.push(a.join(' ')),
  });
}
const GRANT = ['--until', '2099-08-31', '--seats', '30'];
const SCHOOL = ['grant-school', '--classes', '3', '--seats', '30', '--until', '2099-08-31', '--invoice', 'INV-7'];

test('owner CLI: grant-class and grant-school refuse a school class and a school code while not approved, unless --private-ok', async () => {
  h = await setup();
  const school = await makeClass(h);
  const priv = await makeClass(h, { ai: true });
  // grant-class on a school class: exit 1, nothing written, no prompt
  let x = io(h.env);
  assert.equal(await cli(['grant-class', '--class', school.code, ...GRANT, '--local'], x), 1);
  assert.equal(x.ran, 0); assert.equal(x.asked, 0);
  assert.match(x.errors[0], /refused: the class is a school class.*catalogue.*--private-ok/);
  // --private-ok without a note: still 1; with a note but not typing "private": 1
  assert.equal(await cli(['grant-class', '--class', school.code, ...GRANT, '--private-ok'], (x = io(h.env))), 1);
  assert.match(x.errors[0], /--note/);
  assert.equal(await cli(['grant-class', '--class', school.code, ...GRANT, '--private-ok', '--note', 'תגבור פרטי'], (x = io(h.env, { typed: 'yes' }))), 1);
  assert.equal(x.asked, 1); assert.equal(x.ran, 0);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions').length, 0);
  // typed: granted, with privateOk and the note in the audit row
  assert.equal(await cli(['grant-class', '--class', school.code, ...GRANT, '--private-ok', '--note', 'תגבור פרטי'], (x = io(h.env, { typed: ' private ' }))), 0);
  assert.equal(x.ran, 1);
  const grant = JSON.parse(one(h.env, "SELECT detail FROM audit_log WHERE action = 'licence.grant' AND target = ?", `class:${school.code}`).detail);
  assert.deepEqual([grant.privateOk, grant.note], [true, 'תגבור פרטי']);
  // a private group needs no flag; an unknown class is refused
  assert.equal(await cli(['grant-class', '--class', priv.code, ...GRANT], (x = io(h.env))), 0);
  assert.equal(x.asked, 0);
  assert.equal(await cli(['grant-class', '--class', 'ZZZ234', ...GRANT], (x = io(h.env))), 1);
  assert.match(x.errors[0], /no class/);
  // grant-school: refused while not approved; --private-ok with a note and the typed word lets it through
  assert.equal(await cli(SCHOOL, (x = io(h.env))), 1);
  assert.equal(rows(h.env, 'SELECT * FROM licence_codes').length, 0);
  assert.equal(await cli([...SCHOOL, '--private-ok', '--note', 'מרכז למידה פרטי'], (x = io(h.env, { typed: 'private' }))), 0);
  assert.equal(rows(h.env, 'SELECT * FROM licence_codes').length, 1);
  assert.match(x.logs.at(-1), /Licence code/);
  // once approved: both go through with no flag (grade 7 from 7)
  const approved = { MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '7' };
  const other = await makeClass(h);
  assert.equal(await cli(['grant-class', '--class', other.code, ...GRANT], (x = io(h.env, { vars: approved }))), 0);
  assert.equal(await cli(SCHOOL, (x = io(h.env, { vars: approved }))), 0);
  // approved from grade 8: a grade 7 school class is refused, reason grade
  const third = await makeClass(h);
  assert.equal(await cli(['grant-class', '--class', third.code, ...GRANT], (x = io(h.env, { vars: { MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '8' } }))), 1);
  assert.match(x.errors[0], /below the approved grade/);
});

test('owner CLI: the approval comes from the environment, else wrangler.toml; the gate as a pure function', () => {
  assert.deepEqual(moeVars({}, 'MOE_AI_APPROVAL = "approved"\nMOE_AI_FROM_GRADE = "8"\n'), { approval: 'approved', approvedFromGrade: 8 });
  assert.deepEqual(moeVars({ MOE_AI_APPROVAL: 'none' }, 'MOE_AI_APPROVAL = "approved"\n'), { approval: 'none', approvedFromGrade: 7 });
  assert.deepEqual(moeVars({}, ''), { approval: 'none', approvedFromGrade: 7 });
  assert.deepEqual(moeVars({}), { approval: 'none', approvedFromGrade: 7 }, 'the repository\'s wrangler.toml says none');
  const none = { approval: 'none', approvedFromGrade: 7 };
  assert.equal(schoolGate('list', {}, { moe: none }), null);
  assert.equal(schoolGate('grant-class', { class: 'ABC234' }, { moe: none, cls: { setting: 'private', grade: '7' } }), null);
  assert.equal(schoolGate('grant-class', { class: 'ABC234', 'private-ok': true, note: 'x' }, { moe: none, cls: { setting: 'school', grade: '7' } }), 'confirm');
  assert.throws(() => schoolGate('grant-school', {}, { moe: none }), /refused/);
});
