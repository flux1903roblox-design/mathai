// Escrow (DURABLE-6): the restore code kept for a class student or a family device, sealed with VAULT_SECRET.
//   class   a rejoin with the right PIN gets the code back (a wrong PIN gets nothing), also after the teacher's PIN reset;
//           the student's removal deletes the escrow and every token; the night sweep removes orphans
//   family  an escrow per device; the parent's unlink keeps it in the account (leaving deletes it, family-guard.test.js);
//           a new device linked with restoreFrom gets the
//           code and the escrow moves to it; another account's escrow is 404; GET /api/family/vaults and its delete;
//           account deletion and export
//   never   the code in GET /api/account, /api/account/export, /api/family/vaults or /api/teacher/dashboard, or in the
//           table itself; without VAULT_SECRET escrow is 503 server_config while joining and linking still work
// Every secret here is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setup, makeClass, bearer, rows, one, signIn, accountId, insertSub, linkDevice } from './helpers.js';
import { CODE_ALPHABET } from '../src/util.js';
import { codeOk, sealCode, unsealCode, vaultNight } from '../src/vault.js';
import { purge } from '../src/cron.js';
import { forgetAccount } from '../src/billing.js';

let h;
afterEach(() => h?.done());
const VAULT_SECRET = 'test-vault-secret-0123456789abcdef0123456789abcdef';
const DEVICE = 'd'.repeat(32);
const LINK_SECRET = 'b'.repeat(32);
const ANY_CODE = /[A-HJ-NP-Z2-9]{16}/;

/** A restore code as the app makes it: 15 random symbols and the check symbol. */
function newCode() {
  let body = '';
  for (const b of randomBytes(15)) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
  let sum = 0;
  for (let i = 0; i < 15; i += 1) sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
  return body + CODE_ALPHABET[sum % CODE_ALPHABET.length];
}
const lookupOf = () => randomBytes(32).toString('hex');
const blob = () => randomBytes(120).toString('base64url');

/** A vault made with these headers (the device's identity), and its escrow: { code, lookup }. */
async function vaultWithEscrow(headers) {
  const code = newCode(); const lookup = lookupOf();
  const v = await h.call('POST', '/api/vault', { headers: { ...headers, 'X-Vault': lookup }, body: { ifRev: null, blob: blob() } });
  assert.equal(v.status, 200);
  const e = await h.call('POST', '/api/vault/escrow', { headers, body: { code, lookup } });
  return { code, lookup, res: e, body: await e.json() };
}
const join = (code, name = 'נועה', pin = '1234') => h.call('POST', `/api/classes/${code}/join`, { body: { name, pin } });

// ---- the family's link flow
const start = (device = DEVICE) => h.call('POST', '/api/family/link/start', { headers: { 'X-Device': device }, body: { secret: LINK_SECRET } }).then((r) => r.json());
const claim = (token, code, extra = {}) => h.call('POST', '/api/family/link/claim', { headers: { 'X-Account-Token': token }, body: { code, label: 'הטלפון החדש', ...extra } });
const finish = (code) => h.call('POST', '/api/family/link/finish', { body: { code, secret: LINK_SECRET } });
async function parent(email = 'parent@example.test') {
  const token = await signIn(h, email);
  const a = accountId(h.env, email);
  insertSub(h.env, { kind: 'family', account_id: a });
  return { token, a, headers: { 'X-Account-Token': token } };
}

test('the code check is the app\'s; a sealed code is short, opens only for its owner and only with its secret', async () => {
  const code = newCode();
  assert.equal(codeOk(code), true);
  assert.equal(codeOk(code.slice(0, 15) + (code[15] === 'A' ? 'B' : 'A')), false);
  assert.equal(codeOk(code.toLowerCase()), false);
  const env = { VAULT_SECRET };
  const sealed = await sealCode(env, code, 'student', 's1');
  assert.ok(sealed.length <= 200);
  assert.ok(!sealed.includes(code));
  assert.equal(await unsealCode(env, sealed, 'student', 's1'), code);
  assert.equal(await unsealCode(env, sealed, 'student', 's2'), null, 'copied to another owner: it does not open');
  assert.equal(await unsealCode({ VAULT_SECRET: `${VAULT_SECRET}x` }, sealed, 'student', 's1'), null, 'another secret');
  assert.equal(await unsealCode({}, sealed, 'student', 's1'), null, 'no secret');
  // 45 bytes are exactly 60 characters, so the last one is all tag: another letter there is a damaged seal
  assert.equal(sealed.length, 60);
  assert.equal(await unsealCode(env, sealed.slice(0, -1) + (sealed.at(-1) === 'A' ? 'B' : 'A'), 'student', 's1'), null, 'damaged');
});

test('class: a rejoin with the right PIN gets the code back; a wrong PIN gets nothing; a new name gets nothing', async () => {
  h = await setup({ VAULT_SECRET });
  const health = await (await h.call('GET', '/api/health')).text();
  assert.equal(JSON.parse(health).escrow, true);
  assert.ok(!health.includes(VAULT_SECRET));
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  const e = await vaultWithEscrow(bearer(noa));
  assert.equal(e.res.status, 200);
  assert.deepEqual(e.body, { escrow: 'class' });
  const row = one(h.env, 'SELECT * FROM vault_escrow');
  assert.equal(row.owner_kind, 'student'); assert.equal(row.owner_id, noa.studentId); assert.equal(row.device_id, null);
  assert.ok(!JSON.stringify(rows(h.env, 'SELECT * FROM vault_escrow')).includes(e.code), 'the table never holds the code');
  // a new phone: class code, name and PIN
  const back = await (await join(cls.code)).json();
  assert.equal(back.returning, true);
  assert.deepEqual(back.vault, { code: e.code });
  const wrong = await join(cls.code, 'נועה', '9999');
  assert.equal(wrong.status, 403);
  assert.doesNotMatch(await wrong.text(), ANY_CODE);
  const itaiBack = await (await join(cls.code, 'איתי')).json();
  assert.equal(itaiBack.vault, undefined, 'no escrow: no code');
  assert.equal((await (await join(cls.code, 'רוני')).json()).vault, undefined, 'a new student');
  // one escrow per student: a new code replaces the old one
  const again = await vaultWithEscrow(bearer(itai));
  assert.equal(again.res.status, 200);
  const replaced = await vaultWithEscrow(bearer(noa));
  assert.equal(rows(h.env, "SELECT * FROM vault_escrow WHERE owner_kind = 'student' AND owner_id = ?", noa.studentId).length, 1);
  assert.deepEqual((await (await join(cls.code)).json()).vault, { code: replaced.code });
});

test('class: the teacher\'s PIN reset keeps the escrow, and the join that sets the new PIN gets the code', async () => {
  h = await setup({ VAULT_SECRET });
  const cls = await makeClass(h, { students: ['נועה'] });
  const e = await vaultWithEscrow(bearer(cls.students[0]));
  assert.equal((await h.call('POST', `/api/teacher/students/${cls.students[0].studentId}/reset-pin`, { headers: cls.teacher, body: {} })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 1);
  const back = await (await join(cls.code, 'נועה', '4321')).json();
  assert.deepEqual(back.vault, { code: e.code });
});

test('class: removing the student deletes the escrow and every token in the same batch', async () => {
  h = await setup({ VAULT_SECRET });
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  await join(cls.code); // a second device
  await vaultWithEscrow(bearer(noa)); await vaultWithEscrow(bearer(itai));
  assert.equal((await h.call('POST', `/api/teacher/students/${noa.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow WHERE owner_id = ?', noa.studentId).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM student_tokens WHERE student_id = ?', noa.studentId).length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 1, 'the classmate\'s escrow stays');
  // the vault itself stays (only the device's own code opens it now) and expires with retention
  assert.equal(rows(h.env, 'SELECT * FROM vaults').length, 2);
});

test('the night sweep removes escrows and tokens whose student (or account) is gone, and escrows whose vault is gone', async () => {
  h = await setup({ VAULT_SECRET });
  const cls = await makeClass(h, { students: ['נועה', 'איתי', 'רוני'] });
  const [noa, itai, roni] = cls.students;
  await vaultWithEscrow(bearer(noa)); await vaultWithEscrow(bearer(itai));
  const kept = await vaultWithEscrow(bearer(roni));
  // a deletion path that forgot them: the student row is gone
  h.env.DB.raw.prepare('DELETE FROM students WHERE id = ?').run(noa.studentId);
  // an account escrow whose account is gone
  h.env.DB.raw.prepare(`INSERT INTO vault_escrow (id, vault_id, owner_kind, owner_id, device_id, label, sealed, created_at, updated_at)
    VALUES ('00000000000000aa', 'x', 'account', 'gone-account', NULL, '', 's', '2026-01-01', '2026-01-01')`).run();
  await purge(h.env);
  assert.deepEqual(rows(h.env, 'SELECT owner_id FROM vault_escrow ORDER BY owner_id').map((r) => r.owner_id), [itai.studentId, roni.studentId].sort());
  assert.equal(rows(h.env, 'SELECT * FROM student_tokens WHERE student_id = ?', noa.studentId).length, 0);
  // the vault itself was deleted ("להפסיק את הגיבוי"): its escrow goes in the same batch
  assert.equal((await h.call('POST', '/api/vault/delete', { headers: { ...bearer(roni), 'X-Vault': kept.lookup }, body: {} })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow WHERE owner_id = ?', roni.studentId).length, 0);
  // a vault gone some other way (expired): the night's vault purge sweeps its escrow, and a join returns no code meanwhile
  h.env.DB.raw.prepare('DELETE FROM vaults').run();
  assert.equal((await (await join(cls.code, 'איתי')).json()).vault, undefined);
  await vaultNight(h.env);
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 0);
});

test('escrow asks for a vault that exists, a sound code and an identity; the student\'s switch deletes it', async () => {
  h = await setup({ VAULT_SECRET });
  const cls = await makeClass(h, { students: ['נועה'] });
  const s = cls.students[0];
  const post = (body, headers = bearer(s)) => h.call('POST', '/api/vault/escrow', { headers, body });
  const r404 = await post({ code: newCode(), lookup: lookupOf() });
  assert.equal(r404.status, 404); assert.equal((await r404.json()).error, 'vault_not_found');
  const e = await vaultWithEscrow(bearer(s));
  const bad = e.code.slice(0, 15) + (e.code[15] === 'A' ? 'B' : 'A');
  assert.equal((await post({ code: bad, lookup: e.lookup })).status, 400);
  assert.equal((await post({ code: e.code, lookup: 'nope' })).status, 400);
  assert.equal((await post({ code: e.code, lookup: e.lookup }, {})).status, 401);
  const del = await h.call('POST', '/api/vault/escrow/delete', { headers: bearer(s), body: {} });
  assert.deepEqual(await del.json(), { deleted: 1 });
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 0);
  assert.equal((await (await join(cls.code)).json()).vault, undefined);
  // with the vault switched off: no new escrow, but deleting still works
  h.env.VAULT = 'off';
  assert.equal((await post({ code: e.code, lookup: e.lookup })).status, 503);
  assert.equal((await h.call('POST', '/api/vault/escrow/delete', { headers: bearer(s), body: {} })).status, 200);
});

test('family: an escrow per device; unlink keeps it in the account; a new device linked with restoreFrom gets the code', async () => {
  h = await setup({ VAULT_SECRET });
  const p = await parent();
  const old = await linkDevice(h.env, p.a, 'הטאבלט');
  const e = await vaultWithEscrow(old.headers);
  assert.deepEqual(e.body, { escrow: 'family' });
  const row = one(h.env, 'SELECT * FROM vault_escrow');
  assert.equal(row.owner_kind, 'account'); assert.equal(row.owner_id, p.a); assert.equal(row.device_id, old.id); assert.equal(row.label, 'הטאבלט');
  // listed for the parent with its device, never with the code
  const list = async () => (await h.call('GET', '/api/family/vaults', { headers: p.headers })).json();
  let l = await list();
  assert.equal(l.vaults.length, 1);
  assert.deepEqual(l.vaults[0], { id: row.id, label: 'הטאבלט', device: { id: old.id, label: 'הטאבלט' }, updatedAt: one(h.env, 'SELECT updated_at FROM vaults').updated_at });
  // the parent unlinks the tablet: the escrow stays, kept in the account
  assert.equal((await h.call('POST', `/api/family/devices/${old.id}/unlink`, { headers: p.headers, body: {} })).status, 200);
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow').device_id, null);
  l = await list();
  assert.equal(l.vaults[0].device, null);
  // a new phone: the parent claims its code and continues from the tablet's progress
  const s = await start();
  const c = await claim(p.token, s.code, { restoreFrom: row.id });
  assert.equal(c.status, 200);
  const newId = (await c.json()).device.id;
  assert.equal(one(h.env, 'SELECT restore_escrow FROM link_codes').restore_escrow, row.id);
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow').device_id, null, 'not before the phone has its token');
  const f = await finish(s.code);
  assert.equal(f.status, 200);
  const fb = await f.json();
  assert.deepEqual(fb.vault, { code: e.code });
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow').device_id, newId);
  assert.deepEqual((await list()).vaults[0].device, { id: newId, label: 'הטלפון החדש' });
  // a link that does not continue from anything gets no code
  const s2 = await start('e'.repeat(32));
  await claim(p.token, s2.code);
  assert.equal((await (await finish(s2.code)).json()).vault, undefined);
});

test('family: another account\'s escrow is 404 on claim and on devices/this; devices/this with restoreFrom moves it and returns the code', async () => {
  h = await setup({ VAULT_SECRET });
  const p = await parent();
  const other = await parent('other@example.test');
  const theirs = await linkDevice(h.env, other.a, 'של אחרים');
  await vaultWithEscrow(theirs.headers);
  const theirId = one(h.env, 'SELECT id FROM vault_escrow WHERE owner_id = ?', other.a).id;
  const s = await start();
  const c = await claim(p.token, s.code, { restoreFrom: theirId });
  assert.equal(c.status, 404); assert.equal((await c.json()).error, 'escrow_not_found');
  assert.equal((await claim(p.token, s.code, { restoreFrom: 'not-an-id' })).status, 404);
  assert.equal(one(h.env, 'SELECT claimed_at FROM link_codes').claimed_at, null, 'nothing was claimed');
  // this parent's own kept escrow, on the device the parent is holding
  const mine = await linkDevice(h.env, p.a, 'הישן');
  const e = await vaultWithEscrow(mine.headers);
  const mineId = one(h.env, 'SELECT id FROM vault_escrow WHERE owner_id = ?', p.a).id;
  await h.call('POST', `/api/family/devices/${mine.id}/unlink`, { headers: p.headers, body: {} });
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow WHERE id = ?', mineId).device_id, null, 'the parent\'s unlink keeps it in the account');
  const thisDev = (token, restoreFrom) => h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': token, 'X-Device': 'c'.repeat(32) }, body: { label: 'כאן', restoreFrom } });
  assert.equal((await thisDev(p.token, theirId)).status, 404);
  const t = await thisDev(p.token, mineId);
  assert.equal(t.status, 200);
  const tb = await t.json();
  assert.deepEqual(tb.vault, { code: e.code });
  const dev = one(h.env, "SELECT id FROM family_devices WHERE label = 'כאן'");
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow WHERE id = ?', mineId).device_id, dev.id);
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow WHERE id = ?', theirId).device_id, theirs.id, 'the other family\'s escrow is untouched');
});

test('family: the parent deletes kept progress; account deletion deletes every escrow; the export lists them without the code', async () => {
  h = await setup({ VAULT_SECRET });
  const p = await parent();
  const other = await parent('other@example.test');
  const d1 = await linkDevice(h.env, p.a, 'הטאבלט');
  const d2 = await linkDevice(h.env, p.a, 'הטלפון');
  const e1 = await vaultWithEscrow(d1.headers);
  await vaultWithEscrow(d2.headers);
  const ids = rows(h.env, 'SELECT id, device_id FROM vault_escrow ORDER BY created_at').map((r) => r.id);
  // the export: which, for which device, when; never the code
  const ex = await h.call('GET', '/api/account/export', { headers: p.headers });
  const text = await ex.text();
  const data = JSON.parse(text);
  assert.equal(data.vaults.length, 2);
  assert.deepEqual(Object.keys(data.vaults[0]).sort(), ['createdAt', 'deviceId', 'id', 'label', 'updatedAt']);
  assert.doesNotMatch(text, ANY_CODE);
  assert.ok(!text.includes(e1.code));
  // deleting one: another account cannot, the parent can; the device itself is not affected
  assert.equal((await h.call('POST', `/api/family/vaults/${ids[0]}/delete`, { headers: other.headers, body: {} })).status, 404);
  assert.deepEqual(await (await h.call('POST', `/api/family/vaults/${ids[0]}/delete`, { headers: p.headers, body: {} })).json(), { ok: true });
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 1);
  assert.ok(one(h.env, 'SELECT * FROM family_devices WHERE id = ?', d1.id));
  assert.ok(one(h.env, "SELECT * FROM audit_log WHERE action = 'escrow.delete'"));
  // the account goes: every escrow of it goes in the same batch
  await forgetAccount(h.env, p.a, { actor: 'test' });
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 0);
});

test('the code never reaches a parent or a teacher: /api/account, /api/account/export, /api/family/vaults, /api/teacher/dashboard', async () => {
  h = await setup({ VAULT_SECRET });
  const p = await parent();
  const d = await linkDevice(h.env, p.a, 'הטאבלט');
  const fam = await vaultWithEscrow(d.headers);
  const cls = await makeClass(h, { students: ['נועה'] });
  const stu = await vaultWithEscrow(bearer(cls.students[0]));
  const bodies = [
    await (await h.call('GET', '/api/account', { headers: p.headers })).text(),
    await (await h.call('GET', '/api/account/export', { headers: p.headers })).text(),
    await (await h.call('GET', '/api/family/vaults', { headers: p.headers })).text(),
    await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).text(),
  ];
  for (const b of bodies) {
    assert.doesNotMatch(b, ANY_CODE);
    for (const c of [fam.code, stu.code]) assert.ok(!b.includes(c));
    for (const r of rows(h.env, 'SELECT sealed FROM vault_escrow')) assert.ok(!b.includes(r.sealed), 'nor the sealed code');
  }
});

test('without VAULT_SECRET: escrow is 503 server_config, and joining and linking still work (with no code)', async () => {
  h = await setup();
  assert.equal((await (await h.call('GET', '/api/health')).json()).escrow, false, 'health says so (never the value)');
  const cls = await makeClass(h, { students: ['נועה'] });
  const s = cls.students[0];
  const lookup = lookupOf();
  assert.equal((await h.call('POST', '/api/vault', { headers: { ...bearer(s), 'X-Vault': lookup }, body: { ifRev: null, blob: blob() } })).status, 200);
  const r = await h.call('POST', '/api/vault/escrow', { headers: bearer(s), body: { code: newCode(), lookup } });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'server_config');
  const back = await join(cls.code);
  assert.equal(back.status, 200);
  assert.equal((await back.json()).vault, undefined);
  // an escrow made while the secret was there opens nothing once it is gone (a join still works)
  h.env.VAULT_SECRET = VAULT_SECRET;
  await h.call('POST', '/api/vault/escrow', { headers: bearer(s), body: { code: newCode(), lookup } });
  delete h.env.VAULT_SECRET;
  const again = await join(cls.code);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).vault, undefined);
  // linking a family device, with and without restoreFrom
  const p = await parent();
  const st = await start();
  assert.equal((await claim(p.token, st.code)).status, 200);
  const f = await finish(st.code);
  assert.equal(f.status, 200);
  assert.match((await f.json()).deviceToken, /^fd1\./);
});

test('the night purge of a family device keeps its escrow in the account', async () => {
  h = await setup({ VAULT_SECRET });
  const p = await parent();
  const d = await linkDevice(h.env, p.a, 'הטאבלט'); // last seen 2026-01-01
  await vaultWithEscrow(d.headers);
  h.env.DB.raw.prepare('UPDATE family_devices SET last_seen = ? WHERE id = ?').run('2020-01-01', d.id);
  await purge(h.env);
  assert.equal(one(h.env, 'SELECT * FROM family_devices WHERE id = ?', d.id) ?? null, null, 'the device is purged');
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow').device_id, null);
});
