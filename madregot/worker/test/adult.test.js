// An adult behind any class that turns on student AI (COUNCIL2-2, COUNCIL2-5, and the trust skeptic's two add-ons), with
// Claude stubbed and every name and address synthetic (example.test).
//   1. The skeptic's repro (council2/trust-verify/bypass.test.mjs): a child with no email opens a class with a teacher
//      key, marks it a private group, attests the parents' consent, turns student AI on and joins as a student. Now the
//      consent and the switch are 403 adult_needed, nothing is written, the student's chat is class_ai_off and Claude is
//      never called, with the paywall on and off.
//   2. An email alone proves no age: a teacher sign-in without "I am over 18, a teacher or a tutor" still gets
//      parent_ok_needed and adult_needed; with it (stored as accounts.adult_confirmed_at, on the sign-in or the bind) the
//      tutor answers and student AI can be turned on.
//   3. teacherAi 'prep' is enforced: in a school class before the Ministry's approval the teacher's tutor prepares
//      materials (explain, chat, generate) and refuses checking students' work (check, exam, feedback) with 403 prep_only.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, ai, signIn, makeClass, bearer, rows, one, insertSub, accountId, DEVICE, FEEDBACK_INPUT } from './helpers.js';

let h;
afterEach(() => h?.done());

const chat = { messages: [{ role: 'user', content: 'איך פותרים?' }], context: { question: '3x + 5 = 11', correct: '2' } };
const required = (over = {}) => setup({ AI_PARENT_OK: 'required', ...over });
const err = async (r) => (await r.json()).error;
const classAi = (headers, body) => h.call('POST', '/api/teacher/class/ai', { headers, body });
const dashboard = async (headers) => (await h.call('GET', '/api/teacher/dashboard', { headers })).json();
const settingsOf = (code) => one(h.env, 'SELECT setting, student_ai, ai_consent_at FROM class_settings WHERE code = ?', code);
const aiAudits = () => rows(h.env, "SELECT * FROM audit_log WHERE action = 'class.ai'");

/** A private group opened with names only (a teacher key, no email): the skeptic's first steps. */
async function keyOnlyGroup() {
  const r = await h.call('POST', '/api/classes', { body: { className: 'הקבוצה שלי', teacherName: 'המורה כהן', grade: '7', setting: 'private', privateAttest: true } });
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.equal(c.owned, undefined); assert.equal(c.setting, 'private');
  return { code: c.code, teacher: { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey } };
}

for (const paywall of ['on', 'off']) {
  test(`the skeptic's repro (paywall ${paywall}): a key-only private group cannot turn student AI on; its student's chat is refused and Claude is never called`, async () => {
    h = await required({ AI_PAYWALL: paywall });
    // a child alone is refused
    assert.equal(await err(await ai(h, 'chat', { 'X-Device': DEVICE }, { body: chat })), 'parent_ok_needed');
    const g = await keyOnlyGroup();
    assert.equal(settingsOf(g.code).student_ai, 'off', 'a new private group starts with student AI off');
    // the consent, the switch, and both together: 403 adult_needed, and nothing is written
    for (const body of [{ consent: true }, { studentAi: 'on' }, { consent: true, studentAi: 'on' }, { setting: 'school', consent: true }]) {
      const r = await classAi(g.teacher, body);
      assert.equal(r.status, body.studentAi && !body.consent ? 409 : 403, JSON.stringify(body));
      assert.equal(await err(r), body.studentAi && !body.consent ? 'consent_needed' : 'adult_needed', JSON.stringify(body));
    }
    assert.deepEqual({ ...settingsOf(g.code) }, { setting: 'private', student_ai: 'off', ai_consent_at: null });
    assert.equal(aiAudits().length, 0);
    // the dashboard says so before anything is tried
    assert.equal((await dashboard(g.teacher)).aiPolicy.adultNeeded, true);
    // the child joins their own group as a student: no tutor
    const s = await (await h.call('POST', `/api/classes/${g.code}/join`, { body: { name: 'נועה', pin: '1234' }, headers: { 'X-Device': DEVICE } })).json();
    const r = await ai(h, 'chat', { ...bearer(s), 'X-Device': DEVICE }, { body: chat });
    assert.equal(r.status, 403); assert.equal(await err(r), 'class_ai_off');
    // and the key alone gives its teacher no tutor either
    assert.equal(await err(await ai(h, 'chat', g.teacher, { body: chat })), 'parent_ok_needed');
    assert.equal(h.net.log.claude.length, 0, 'Claude is never called');
    assert.equal(rows(h.env, 'SELECT * FROM class_owners').length, 0);
  });
}

test('what a key-only teacher may still do: turn student AI off and move the class (the AI stays off)', async () => {
  h = await required();
  const g = await keyOnlyGroup();
  assert.equal((await classAi(g.teacher, { studentAi: 'off' })).status, 200);
  const moved = await classAi(g.teacher, { setting: 'school' });
  assert.equal(moved.status, 200);
  const { policy } = await moved.json();
  assert.equal(policy.setting, 'school'); assert.equal(policy.students, 'off'); assert.equal(policy.adultNeeded, true);
  const back = await classAi(g.teacher, { setting: 'private', privateAttest: true });
  assert.equal(back.status, 200);
  assert.equal(settingsOf(g.code).student_ai, 'off');
});

test('a teacher sign-in without the declaration is no adult: parent_ok_needed and adult_needed; with it the tutor answers and student AI turns on', async () => {
  h = await required();
  // a child with their own email signs in as a teacher and opens a private group bound to it
  const token = await signIn(h, 'kid@example.test');
  assert.equal(one(h.env, 'SELECT adult_confirmed_at FROM accounts').adult_confirmed_at, null, 'no declaration, nothing stored');
  const c = await (await h.call('POST', '/api/classes', { headers: { 'X-Account-Token': token }, body: { className: 'שלי', teacherName: 'המורה', grade: '7', setting: 'private', privateAttest: true } })).json();
  assert.equal(c.owned, true);
  const bySession = { 'X-Class-Code': c.code, 'X-Account-Token': token };
  const byKey = { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey };
  for (const who of [bySession, byKey]) {
    const t = await ai(h, 'chat', who, { body: chat });
    assert.equal(t.status, 403); assert.equal(await err(t), 'parent_ok_needed');
    assert.equal(await err(await classAi(who, { consent: true, studentAi: 'on' })), 'adult_needed');
  }
  assert.equal((await dashboard(bySession)).aiPolicy.adultNeeded, true);
  assert.equal(h.net.log.claude.length, 0);

  // the teacher's sign-in with "I am over 18, a teacher or a tutor" (sent only when ticked): stored on the account
  const adult = await signIn(h, 'teacher@example.test', {}, { adultTeacher: true });
  const at = one(h.env, 'SELECT adult_confirmed_at FROM accounts WHERE email = ?', 'teacher@example.test').adult_confirmed_at;
  assert.match(at, /^\d{4}-\d{2}-\d{2}T/);
  const o = await (await h.call('POST', '/api/classes', { headers: { 'X-Account-Token': adult }, body: { className: 'ז׳1', teacherName: 'רונית', grade: '7', setting: 'private', privateAttest: true } })).json();
  const teacher = { 'X-Class-Code': o.code, 'X-Account-Token': adult };
  const t = await ai(h, 'chat', teacher, { body: chat });
  assert.equal(t.status, 200, 'the tutor answers');
  assert.equal(h.net.log.claude.length, 1);
  assert.equal((await dashboard(teacher)).aiPolicy.adultNeeded, false);
  const on = await classAi(teacher, { consent: true, studentAi: 'on' });
  assert.equal(on.status, 200);
  assert.equal((await on.json()).policy.students, 'on');
  // a co-teacher with the class's key: an adult is behind the class now
  assert.equal((await classAi({ 'X-Class-Code': o.code, 'X-Teacher-Key': o.teacherKey }, { studentAi: 'on' })).status, 200);
  const s = await (await h.call('POST', `/api/classes/${o.code}/join`, { body: { name: 'יואב', pin: '1234' } })).json();
  assert.equal((await ai(h, 'chat', bearer(s), { body: chat })).status, 200, 'its student reaches the tutor');
  // the declaration is the account's own data: it is in the account's export
  const exp = await (await h.call('GET', '/api/account/export', { headers: { 'X-Account-Token': adult } })).json();
  assert.equal(exp.account.adult_confirmed_at, at);
});

test('the declaration given later, with the bind: a signed-in teacher without it ticks it and the class opens', async () => {
  h = await required();
  const g = await keyOnlyGroup();
  const token = await signIn(h, 'teacher@example.test');
  const bind = (body) => h.call('POST', '/api/teacher/class/owner', { headers: { ...g.teacher, 'X-Account-Token': token }, body });
  assert.deepEqual(await (await bind({})).json(), { owner: 'you', email: 'teacher@example.test', adult: false });
  assert.equal(await err(await classAi(g.teacher, { consent: true, studentAi: 'on' })), 'adult_needed');
  assert.equal((await bind({ adultTeacher: 'yes' })).status, 400, 'only true or false');
  assert.deepEqual(await (await bind({ adultTeacher: true })).json(), { owner: 'you', email: 'teacher@example.test', adult: true });
  assert.equal((await classAi(g.teacher, { consent: true, studentAi: 'on' })).status, 200);
  assert.equal(aiAudits().length, 1);
  // a sign-in later without the tick does not take the declaration back
  await signIn(h, 'teacher@example.test');
  assert.ok(one(h.env, 'SELECT adult_confirmed_at FROM accounts').adult_confirmed_at);
});

test('a signed-in teacher who has not declared may declare when opening a class; a key-only class cannot carry it', async () => {
  h = await required();
  const token = await signIn(h, 'teacher@example.test');
  const body = { className: 'ז׳1', teacherName: 'רונית', grade: '7', setting: 'private', privateAttest: true };
  const plain = await (await h.call('POST', '/api/classes', { headers: { 'X-Account-Token': token }, body })).json();
  assert.equal(plain.adult, false);
  const c = await (await h.call('POST', '/api/classes', { headers: { 'X-Account-Token': token }, body: { ...body, className: 'ז׳2', adultTeacher: true } })).json();
  assert.equal(c.owned, true); assert.equal(c.adult, true);
  const teacher = { 'X-Class-Code': c.code, 'X-Account-Token': token };
  assert.equal((await classAi(teacher, { consent: true, studentAi: 'on' })).status, 200);
  assert.equal((await ai(h, 'chat', teacher, { body: chat })).status, 200);
  // the first class is the same account's: an adult is behind it now too
  assert.equal((await classAi({ 'X-Class-Code': plain.code, 'X-Account-Token': token }, { consent: true })).status, 200);
  // no session: nothing to store the declaration on, so it changes nothing
  const k = await (await h.call('POST', '/api/classes', { ip: '198.51.100.9', body: { ...body, adultTeacher: true } })).json();
  assert.equal(k.adult, undefined);
  assert.equal(await err(await classAi({ 'X-Class-Code': k.code, 'X-Teacher-Key': k.teacherKey }, { consent: true })), 'adult_needed');
  assert.equal((await h.call('POST', '/api/classes', { body: { ...body, adultTeacher: 'yes' } })).status, 400);
});

test('verify: adultTeacher must be true or false, and the answer says whether the account holder declared 18+', async () => {
  h = await required();
  h.env.DB.raw.prepare('DELETE FROM login_codes').run();
  await h.call('POST', '/api/account/code', { body: { email: 'a@example.test' } });
  const r = await h.call('POST', '/api/account/verify', { body: { email: 'a@example.test', code: '000000', adultTeacher: 1 } });
  assert.equal(r.status, 400); assert.equal(await err(r), 'bad_request');
  const t = await signIn(h, 'b@example.test', {}, { adultTeacher: false });
  assert.ok(t);
  assert.equal(one(h.env, 'SELECT adult_confirmed_at FROM accounts WHERE email = ?', 'b@example.test').adult_confirmed_at, null);
});

test('a licence in force is an adult behind the class: its key-only teacher may turn student AI on', async () => {
  h = await required();
  const g = await keyOnlyGroup();
  assert.equal(await err(await classAi(g.teacher, { consent: true, studentAi: 'on' })), 'adult_needed');
  insertSub(h.env, { kind: 'class', class_code: g.code });
  assert.equal((await classAi(g.teacher, { consent: true, studentAi: 'on' })).status, 200);
});

test('with AI_PARENT_OK "off" (the one-variable rollback) a key-only teacher may turn student AI on, as before', async () => {
  h = await setup({ AI_PARENT_OK: 'off' });
  const g = await keyOnlyGroup();
  const r = await classAi(g.teacher, { consent: true, studentAi: 'on' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).policy.adultNeeded, false);
});

// ---------------------------------------------------------------- teacherAi 'prep' (the trust skeptic's second add-on)
const IMAGE = 'data:image/jpeg;base64,/9j/4AAQ';
const BODY = {
  check: { image: IMAGE, mediaType: 'image/jpeg' },
  exam: { grade: '7', pages: [{ data: IMAGE, mediaType: 'image/jpeg' }] },
  feedback: FEEDBACK_INPUT,
};

test('prep_only: in a school class before the approval the teacher prepares materials; checking students\' work is refused, before Claude', async () => {
  h = await setup({ AI_PAYWALL: 'off' }); // the tests' default AI_PARENT_OK is off: the key is enough to reach the tutor
  const school = await makeClass(h);
  for (const kind of ['explain', 'chat', 'generate']) assert.equal((await ai(h, kind, school.teacher)).status, 200, kind);
  const before = h.net.log.claude.length;
  for (const kind of ['check', 'exam', 'feedback']) {
    const r = await ai(h, kind, school.teacher, { body: BODY[kind] });
    assert.equal(r.status, 403, kind);
    const b = await r.json();
    assert.equal(b.error, 'prep_only'); assert.deepEqual(b.kinds, ['explain', 'chat', 'generate']);
  }
  assert.equal(h.net.log.claude.length, before, 'no call for a refused kind');
  // the status offers only what it would serve
  const st = await (await h.call('GET', '/api/ai/status', { headers: school.teacher })).json();
  assert.equal(st.prepOnly, true);
  assert.deepEqual(st.kinds, ['explain', 'chat', 'generate']);
  // a private group's teacher checks work as before; so does a school class's once the Ministry approves Madregot
  const group = await makeClass(h, { setting: 'private' });
  assert.equal((await ai(h, 'check', group.teacher, { body: BODY.check })).status, 200);
  assert.equal((await (await h.call('GET', '/api/ai/status', { headers: group.teacher })).json()).prepOnly, undefined);
  h.env.MOE_AI_APPROVAL = 'approved';
  assert.equal((await ai(h, 'check', school.teacher, { body: BODY.check })).status, 200);
  // a grade below the approval is 'prep' again
  h.env.MOE_AI_FROM_GRADE = '8';
  assert.equal(await err(await ai(h, 'exam', school.teacher, { body: BODY.exam })), 'prep_only');
});

test('prep_only with the paywall on: an adult teacher of a school class with a licence still cannot check students\' work there', async () => {
  h = await required({ AI_PAYWALL: 'on' });
  const token = await signIn(h, 'teacher@example.test', {}, { adultTeacher: true });
  const c = await (await h.call('POST', '/api/classes', { headers: { 'X-Account-Token': token }, body: { className: 'ז׳1', teacherName: 'רונית', grade: '7' } })).json();
  insertSub(h.env, { kind: 'class', class_code: c.code, account_id: accountId(h.env, 'teacher@example.test') });
  const teacher = { 'X-Class-Code': c.code, 'X-Account-Token': token };
  assert.equal((await ai(h, 'generate', teacher)).status, 200);
  assert.equal(await err(await ai(h, 'check', teacher, { body: BODY.check })), 'prep_only');
});
