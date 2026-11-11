// The teacher's account as a credential (spec TEACHER-1): a class bound to an email opens with a sign-in on any device,
// the key keeps working until the owner replaces it (with a fresh code, and an email), the AI counts a teacher who comes
// with the account like one who comes with the key, and deleting the account unbinds the classes. Claude and the email
// service are stubbed; every name and address is synthetic (example.test).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { hourOf } from '../src/util.js';
import { setup, ai, makeClass, signIn, accountId, insertSub, rows, one, advanceClock, DEVICE, devOf } from './helpers.js';

let h;
afterEach(() => h?.done());
const BODY = { className: 'ז׳3', teacherName: 'רונית', grade: '7' };
const acct = (token) => ({ 'X-Account-Token': token });
const owner = (code, token) => ({ 'X-Class-Code': code, 'X-Account-Token': token });
const dash = (headers) => h.call('GET', '/api/teacher/dashboard', { headers });
const errorOf = async (res) => (await res.json()).error;
const plain = (list) => list.map((r) => ({ ...r }));
/** A class made with a signed-in account (bound at once). */
async function ownedClass(token, { className = 'ז׳3', ip } = {}) {
  const r = await h.call('POST', '/api/classes', { body: { ...BODY, className }, headers: acct(token), ip });
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}

test('1. a class made by a signed-in teacher is bound at once (owned: true); without a session nothing is bound', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const c = await ownedClass(t);
  assert.equal(c.owned, true);
  assert.match(c.teacherKey, /^[a-f0-9]{24}$/, 'the key is still made, for co-teachers');
  const row = one(h.env, 'SELECT * FROM class_owners WHERE class_code = ?', c.code);
  assert.equal(row.account_id, accountId(h.env, 'teacher@example.test'));
  assert.equal(row.help_digest, 0);
  assert.deepEqual(plain(rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'class.owner'")),
    [{ actor: `teacher:${c.code}`, target: `class:${c.code}`, detail: '{"via":"account"}' }]);
  const unbound = await (await h.call('POST', '/api/classes', { body: BODY })).json();
  assert.equal(unbound.owned, undefined);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_owners WHERE class_code = ?', unbound.code).n, 0);
});

test('2. the dashboard opens with the class code and the owner\'s session; another account, an unbound class and an ended session do not', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const other = await signIn(h, 'other@example.test');
  const c = await ownedClass(t);
  const ok = await dash(owner(c.code, t));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).class.code, c.code);
  const stranger = await dash(owner(c.code, other));
  assert.equal(stranger.status, 401); assert.equal(await errorOf(stranger), 'not_teacher');
  const unbound = await makeClass(h);
  const r = await dash(owner(unbound.code, t));
  assert.equal(r.status, 401); assert.equal(await errorOf(r), 'not_teacher');
  // a session that has ended: the page is told to sign in again
  const ended = await dash(owner(c.code, 'f'.repeat(64)));
  assert.equal(ended.status, 401); assert.equal(await errorOf(ended), 'not_account');
  await h.call('POST', '/api/account/signout', { headers: acct(t), body: {} });
  assert.equal(await errorOf(await dash(owner(c.code, t))), 'not_account');
  // nothing at all, or a code alone
  assert.equal(await errorOf(await dash({ 'X-Class-Code': c.code })), 'not_teacher');
});

test('3. binding a class: key and session bind it; again for the same account is 200; another account is 409 owned_by_other', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const other = await signIn(h, 'other@example.test');
  const c = await makeClass(h);
  const bind = (headers) => h.call('POST', '/api/teacher/class/owner', { headers, body: {} });
  assert.equal(await errorOf(await bind(c.teacher)), 'not_account', 'a session is needed');
  assert.equal(await errorOf(await bind({ 'X-Class-Code': c.code, 'X-Teacher-Key': 'b'.repeat(24), ...acct(t) })), 'not_teacher', 'and the key');
  const r = await bind({ ...c.teacher, ...acct(t) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { owner: 'you', email: 'teacher@example.test' });
  assert.equal(one(h.env, 'SELECT account_id FROM class_owners WHERE class_code = ?', c.code).account_id, accountId(h.env, 'teacher@example.test'));
  const again = await bind({ ...c.teacher, ...acct(t) });
  assert.equal(again.status, 200);
  assert.deepEqual(await again.json(), { owner: 'you', email: 'teacher@example.test' });
  const taken = await bind({ ...c.teacher, ...acct(other) });
  assert.equal(taken.status, 409); assert.equal(await errorOf(taken), 'owned_by_other');
  assert.equal(one(h.env, 'SELECT account_id FROM class_owners WHERE class_code = ?', c.code).account_id, accountId(h.env, 'teacher@example.test'));
  // one audit row, with the key as the credential (no "via"), never the email
  assert.deepEqual(plain(rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'class.owner'")),
    [{ actor: `teacher:${c.code}`, target: `class:${c.code}`, detail: '{}' }]);
  // now the session alone opens it
  assert.equal((await dash(owner(c.code, t))).status, 200);
});

test('4. the class list: only this account\'s classes, newest first, with their student counts; 120 an hour', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const other = await signIn(h, 'other@example.test');
  const older = await makeClass(h, { students: ['נועה', 'יואב'] });
  await h.call('POST', '/api/teacher/class/owner', { headers: { ...older.teacher, ...acct(t) }, body: {} });
  advanceClock(60_000);
  const newer = await ownedClass(t, { className: 'ח׳1' });
  await ownedClass(other, { className: 'ז׳5' });
  await makeClass(h); // unbound
  assert.equal(await errorOf(await h.call('GET', '/api/teacher/classes')), 'not_account');
  const r = await h.call('GET', '/api/teacher/classes', { headers: acct(t) });
  assert.equal(r.status, 200);
  const { classes } = await r.json();
  assert.deepEqual(classes.map((c) => [c.code, c.name, c.grade, c.teacherName, c.students]),
    [[newer.code, 'ח׳1', '7', 'רונית', 0], [older.code, 'ז׳3', '7', 'רונית', 2]]);
  for (const c of classes) {
    assert.match(c.createdAt, /^\d{4}-\d\d-\d\dT/); assert.match(c.boundAt, /^\d{4}-\d\d-\d\dT/);
    assert.deepEqual(Object.keys(c).sort(), ['boundAt', 'code', 'createdAt', 'grade', 'name', 'students', 'teacherName']);
  }
  h.env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, 120) ON CONFLICT (who, day) DO UPDATE SET count = 120').run(`tclasses:a:${accountId(h.env, 'teacher@example.test')}`, hourOf());
  const many = await h.call('GET', '/api/teacher/classes', { headers: acct(t) });
  assert.equal(many.status, 429); assert.equal(await errorOf(many), 'too_many_lists');
  assert.equal((await h.call('GET', '/api/teacher/classes', { headers: acct(other) })).status, 200, 'counted per account');
});

test('5. a new teacher key: only the owner, only with a fresh code; the old key stops, the email keeps working, an email goes out', async () => {
  h = await setup();
  let t = await signIn(h, 'teacher@example.test');
  const other = await signIn(h, 'other@example.test');
  const c = await ownedClass(t);
  const oldKey = { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey };
  const rekey = (headers) => h.call('POST', '/api/teacher/class/rekey', { headers, body: {} });
  assert.equal(await errorOf(await rekey(oldKey)), 'not_account', 'the key alone cannot replace itself');
  const notMine = await rekey(owner(c.code, other));
  assert.equal(notMine.status, 403); assert.equal(await errorOf(notMine), 'not_owner');
  advanceClock(11 * 60_000);
  const stale = await rekey(owner(c.code, t));
  assert.equal(stale.status, 401); assert.equal(await errorOf(stale), 'reauth_needed');
  assert.equal((await dash(oldKey)).status, 200, 'nothing changed');
  // a fresh code (a step-up replaces the session)
  t = await signIn(h, 'teacher@example.test', acct(t));
  const r = await rekey(owner(c.code, t));
  assert.equal(r.status, 200);
  const { teacherKey } = await r.json();
  assert.match(teacherKey, /^[a-f0-9]{24}$/); assert.notEqual(teacherKey, c.teacherKey);
  const old = await dash(oldKey);
  assert.equal(old.status, 401); assert.equal(await errorOf(old), 'not_teacher');
  assert.equal((await dash(owner(c.code, t))).status, 200, 'the email still opens it');
  assert.equal((await dash({ 'X-Class-Code': c.code, 'X-Teacher-Key': teacherKey })).status, 200, 'the new key opens it');
  assert.deepEqual(plain(rows(h.env, "SELECT actor, target, detail FROM audit_log WHERE action = 'class.rekey'")),
    [{ actor: `teacher:${c.code}`, target: `class:${c.code}`, detail: '{"via":"account"}' }]);
  const notice = one(h.env, "SELECT * FROM notices WHERE kind LIKE 'class_rekeyed:%'");
  assert.equal(notice.ref, c.code);
  assert.equal(notice.to_account, accountId(h.env, 'teacher@example.test'));
  assert.match(notice.kind, /^class_rekeyed:\d{4}-\d\d-\d\dT\d\d:\d\d$/);
  assert.deepEqual(JSON.parse(notice.params), { className: 'ז׳3', code: c.code });
  await h.ctx.flush();
  const mail = h.net.log.email.find((m) => m.subject === 'מפתח המורה של הכיתה ז׳3 הוחלף');
  assert.ok(mail, 'the owner is told');
  assert.deepEqual(mail.to, ['teacher@example.test']);
  assert.ok(mail.text.includes(`נוצר מפתח מורה חדש לכיתה ז׳3 (${c.code}). מי שנכנס ללוח עם המייל לא צריך לעשות כלום.`));
  assert.ok(!mail.text.includes(teacherKey), 'the key is never in the email');
  // a second one in the same minute makes a new key but no second email
  assert.equal((await rekey(owner(c.code, t))).status, 200);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'class_rekeyed:%'").length, 1);
});

test('6. the AI: a teacher with the class code and the owner\'s session gets the teacher\'s tier; the session alone never gives the family plan', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const a = accountId(h.env, 'teacher@example.test');
  const c = await ownedClass(t);
  const free = await ai(h, 'explain', { ...owner(c.code, t), 'X-Device': DEVICE });
  assert.equal(free.status, 200); assert.equal(free.headers.get('X-AI-Tier'), 'free');
  assert.equal(one(h.env, 'SELECT SUM(count) AS n FROM ai_usage WHERE who = ?', `free:t:${c.code}`).n, 1, 'counted as the class teacher, not the device');
  insertSub(h.env, { kind: 'class', class_code: c.code, seats: 30 });
  const paid = await ai(h, 'explain', owner(c.code, t));
  assert.equal(paid.status, 200); assert.equal(paid.headers.get('X-AI-Tier'), 'teacher');
  const st = await (await h.call('GET', '/api/ai/status', { headers: owner(c.code, t) })).json();
  assert.equal(st.tier, 'teacher');
  // another account's session with this class code is refused, not counted as anyone
  const other = await signIn(h, 'other@example.test');
  const bad = await ai(h, 'explain', { ...owner(c.code, other), 'X-Device': DEVICE });
  assert.equal(bad.status, 401); assert.equal(await errorOf(bad), 'not_teacher');
  // a family plan on the account: the session without a class code is a device on the free taste
  insertSub(h.env, { kind: 'family', account_id: a });
  const alone = await ai(h, 'explain', { ...acct(t), 'X-Device': DEVICE });
  assert.equal(alone.status, 200); assert.equal(alone.headers.get('X-AI-Tier'), 'free');
  assert.equal(one(h.env, 'SELECT SUM(count) AS n FROM ai_usage WHERE who = ?', `free:d:${await devOf(h.env)}`).n, 1, 'the hashed device key (TRUST-1)');
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM ai_usage WHERE who LIKE 'fam:%'").n, 0);
});

test('7. deleting the account unbinds its classes (they still open with the key); the export lists them first', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const c = await ownedClass(t);
  assert.equal((await (await h.call('GET', '/api/account', { headers: acct(t) })).json()).ownedClasses, 1, 'the deletion sheet can say so');
  const exp = await h.call('GET', '/api/account/export', { headers: acct(t) });
  assert.equal(exp.status, 200);
  const data = await exp.json();
  assert.equal(data.classes.length, 1);
  assert.equal(data.classes[0].code, c.code); assert.equal(data.classes[0].name, 'ז׳3'); assert.match(data.classes[0].boundAt, /^\d{4}-/);
  assert.deepEqual(Object.keys(data.classes[0]).sort(), ['boundAt', 'code', 'name']);
  const del = await h.call('POST', '/api/account/delete', { headers: acct(t), body: { confirm: 'DELETE' } });
  assert.equal(del.status, 200);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_owners').n, 0);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM classes WHERE code = ?', c.code).n, 1, 'the class stays');
  assert.equal((await dash({ 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey })).status, 200, 'and opens with its key');
});

test('8. an account owns at most 20 classes: the 21st bind and a 21st new class are 409 too_many_classes_owned', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const codes = [];
  for (let i = 0; i < 21; i++) {
    // classes are made at most 10 a day per network: each one from its own address
    const r = await (await h.call('POST', '/api/classes', { body: BODY, ip: `198.51.100.${i + 1}` })).json();
    codes.push({ code: r.code, key: r.teacherKey });
  }
  const bind = (c) => h.call('POST', '/api/teacher/class/owner', { headers: { 'X-Class-Code': c.code, 'X-Teacher-Key': c.key, ...acct(t) }, body: {} });
  for (const c of codes.slice(0, 20)) assert.equal((await bind(c)).status, 200);
  const last = await bind(codes[20]);
  assert.equal(last.status, 409); assert.equal(await errorOf(last), 'too_many_classes_owned');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_owners').n, 20);
  const before = one(h.env, 'SELECT COUNT(*) AS n FROM classes').n;
  const made = await h.call('POST', '/api/classes', { body: BODY, headers: acct(t), ip: '198.51.100.99' });
  assert.equal(made.status, 409); assert.equal(await errorOf(made), 'too_many_classes_owned');
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM classes').n, before, 'no class is left behind unbound');
  assert.equal((await h.call('GET', '/api/teacher/classes', { headers: acct(t) }).then((r) => r.json())).classes.length, 20);
});

test('9. the key is checked first and a valid key wins; a wrong key falls back to the owner\'s session; a stranger gets 401', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const other = await signIn(h, 'other@example.test');
  const c = await ownedClass(t);
  const key = { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey };
  const wrong = { 'X-Class-Code': c.code, 'X-Teacher-Key': '0'.repeat(24) };
  assert.equal((await dash({ ...key, ...acct(other) })).status, 200, 'the key wins over a purchaser\'s session');
  assert.equal((await dash({ ...wrong, ...acct(t) })).status, 200, 'the owner\'s session');
  const no = await dash({ ...wrong, ...acct(other) });
  assert.equal(no.status, 401); assert.equal(await errorOf(no), 'not_teacher');
  assert.equal(await errorOf(await dash({ ...wrong, ...acct('f'.repeat(64)) })), 'not_teacher', 'a wrong key and an ended session');
  // the audit says which credential opened the class (never the email)
  await h.call('POST', '/api/teacher/class/lock', { headers: { ...key, ...acct(other) }, body: { locked: true } });
  await h.call('POST', '/api/teacher/class/lock', { headers: { ...wrong, ...acct(t) }, body: { locked: false } });
  assert.deepEqual(rows(h.env, "SELECT actor, detail FROM audit_log WHERE action = 'class.lock' ORDER BY id").map((r) => [r.actor, JSON.parse(r.detail)]),
    [[`teacher:${c.code}`, { locked: true }], [`teacher:${c.code}`, { locked: false, via: 'account' }]]);
  assert.ok(!rows(h.env, 'SELECT detail FROM audit_log').some((r) => r.detail.includes('@')));
});

test('10. a new class with a session that is not valid is 401 not_account, and no class is made', async () => {
  h = await setup();
  for (const token of ['f'.repeat(64), 'not-a-token']) {
    const r = await h.call('POST', '/api/classes', { body: BODY, headers: acct(token) });
    assert.equal(r.status, 401); assert.equal(await errorOf(r), 'not_account');
  }
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM classes').n, 0);
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM ai_usage WHERE who LIKE 'create:%'").n, 0, 'the refused request used none of the network\'s daily classes');
});

test('11. a new private class with a session: bound to the account with its attested setting; at the cap no setting row is left behind', async () => {
  h = await setup();
  const t = await signIn(h, 'teacher@example.test');
  const a = accountId(h.env, 'teacher@example.test');
  const PRIVATE = { ...BODY, setting: 'private', privateAttest: true };
  const r = await h.call('POST', '/api/classes', { body: PRIVATE, headers: acct(t) });
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.equal(c.owned, true); assert.equal(c.setting, 'private');
  assert.equal(one(h.env, 'SELECT account_id FROM class_owners WHERE class_code = ?', c.code).account_id, a);
  assert.equal(one(h.env, 'SELECT setting FROM class_settings WHERE code = ?', c.code).setting, 'private');
  // 19 owned now (written directly); two private classes at once: one is made, the other is refused, and nothing of
  // the refused one is written (its setting row and audit row are written only if its class row was: classai.js newClassStmts)
  const raw = h.env.DB.raw;
  for (let i = 0; i < 18; i++) {
    const code = `ZZ${String(i).padStart(4, '0')}`;
    raw.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES (?, 'x', '7', 'y', 'h', '2026-11-01T08:00:00.000Z')").run(code);
    raw.prepare("INSERT INTO class_owners (class_code, account_id, bound_at) VALUES (?, ?, '2026-11-01T08:00:00.000Z')").run(code, a);
  }
  const both = await Promise.all([1, 2].map((n) => h.call('POST', '/api/classes', { body: PRIVATE, headers: acct(t), ip: `198.51.100.${n}` })));
  assert.deepEqual(both.map((x) => x.status).sort(), [200, 409]);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_owners WHERE account_id = ?', a).n, 20);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM class_settings WHERE code NOT IN (SELECT code FROM classes)').n, 0);
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'class.setting' AND substr(target, 7) NOT IN (SELECT code FROM classes)").n, 0);
});

test('12. a class bound with its key after it was opened: key devices are told when, no new key for 7 days, and the owner can undo it', async () => {
  h = await setup();
  const DAY = 864e5;
  const rekey = (headers) => h.call('POST', '/api/teacher/class/rekey', { headers, body: {} });
  // teacher A opens the class with the key flow and gives the key to a co-teacher, as the settings page invites
  const c = await makeClass(h);
  const before = await (await dash(c.teacher)).json();
  assert.deepEqual([before.boundElsewhere, before.boundAt], [false, null], 'an unbound class');
  advanceClock(60_000);
  // co-teacher B presses "לקשר למייל שלי" on a device that has only the key
  let tB = await signIn(h, 'coteacher@example.test');
  assert.equal((await h.call('POST', '/api/teacher/class/owner', { headers: { ...c.teacher, ...acct(tB) }, body: {} })).status, 200);
  const boundAt = one(h.env, 'SELECT bound_at FROM class_owners WHERE class_code = ?', c.code).bound_at;
  // every device that opens it with the key is told it is now bound to an email, and when
  const keyView = await (await dash(c.teacher)).json();
  assert.deepEqual([keyView.boundElsewhere, keyView.boundAt], [true, boundAt]);
  // the account it is bound to is not told "elsewhere"
  const ownerView = await (await dash(owner(c.code, tB))).json();
  assert.deepEqual([ownerView.boundElsewhere, ownerView.boundAt], [false, null]);
  assert.equal(ownerView.rekeyFrom, new Date(Date.parse(boundAt) + 7 * DAY).toISOString(), 'the owner sees from when a new key can be made');
  assert.equal(keyView.rekeyFrom, null);
  // for 7 days nobody can replace the key, so a mistaken bind is undone before anyone is locked out
  const held = await rekey(owner(c.code, tB));
  assert.equal(held.status, 409);
  const hb = await held.json();
  assert.equal(hb.error, 'rekey_hold');
  assert.equal(hb.until, new Date(Date.parse(boundAt) + 7 * DAY).toISOString());
  assert.equal((await dash(c.teacher)).status, 200, 'the creator\'s key still opens the class');
  assert.equal(rows(h.env, "SELECT * FROM audit_log WHERE action = 'class.rekey'").length, 0);
  advanceClock(7 * DAY - 120_000);
  tB = await signIn(h, 'coteacher@example.test', acct(tB));
  assert.equal(await errorOf(await rekey(owner(c.code, tB))), 'rekey_hold', 'still inside the 7 days');
  advanceClock(120_000);
  tB = await signIn(h, 'coteacher@example.test', acct(tB));
  assert.equal((await rekey(owner(c.code, tB))).status, 200, 'after 7 days the owner can');
  assert.equal((await (await dash(owner(c.code, tB))).json()).rekeyFrom, null);
  // a class bound when it was made (with a session) has no hold and tells key devices nothing new
  const tA = await signIn(h, 'creator@example.test');
  const made = await ownedClass(tA);
  const k = { 'X-Class-Code': made.code, 'X-Teacher-Key': made.teacherKey };
  const v = await (await dash(k)).json();
  assert.deepEqual([v.boundElsewhere, v.boundAt, v.rekeyFrom], [false, null, null]);
  assert.equal((await (await dash(owner(made.code, tA))).json()).rekeyFrom, null);
  assert.equal((await rekey(owner(made.code, tA))).status, 200);
});
