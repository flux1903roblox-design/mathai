// The teacher's one-time claim code after a PIN reset (COUNCIL2-25). Before it, anyone who knew a reset student's name
// could join under it, set the PIN and receive the restore code the class kept (DURABLE-6). Now the reset answers a
// 6-character code (shown to the teacher once, stored only as a salted hash, 7 days, usable once); a join to the reset
// student without it is 403 claim_code_needed, and with a wrong, expired, used or replaced code 403 claim_code_bad.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setup, makeClass, bearer, rows, one, countOf, netOf, advanceClock, resetClock } from './helpers.js';
import { CODE_ALPHABET } from '../src/util.js';
import { RETENTION } from '../../shared/retention.js';
import { purgeClass } from '../src/cron.js';

let h;
afterEach(() => { h?.done(); resetClock(); });

const VAULT_SECRET = 'test-vault-secret-0123456789abcdef0123456789abcdef';
const join = (cls, body, ip) => h.call('POST', `/api/classes/${cls.code}/join`, { body: { name: 'נועה', pin: '5678', ...body }, ip });
const reset = (cls, id) => h.call('POST', `/api/teacher/students/${id}/reset-pin`, { headers: cls.teacher, body: {} });
const errorOf = async (r) => (r.status === 200 ? 'ok' : (await r.json()).error);
const progress = (s) => h.call('POST', '/api/progress', { headers: bearer(s), body: { events: [] } });

/** A restore code as the app makes it (escrow.test.js): 15 symbols and a check symbol. */
function restoreCode() {
  let body = '';
  for (const b of randomBytes(15)) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
  let sum = 0;
  for (let i = 0; i < 15; i += 1) sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
  return body + CODE_ALPHABET[sum % CODE_ALPHABET.length];
}
/** Noa, in a class, with a backup the class keeps the code of (DURABLE-6). */
async function noaWithKeptCode() {
  h = await setup({ VAULT_SECRET });
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa] = cls.students;
  const code = restoreCode(); const lookup = randomBytes(32).toString('hex');
  assert.equal((await h.call('POST', '/api/vault', { headers: { ...bearer(noa), 'X-Vault': lookup }, body: { ifRev: null, blob: randomBytes(90).toString('base64url') } })).status, 200);
  assert.equal((await h.call('POST', '/api/vault/escrow', { headers: bearer(noa), body: { code, lookup } })).status, 200);
  return { cls, noa, kept: code };
}

test('the reset answers a 6-character code, once; only its salted hash is stored, with a 7-day end', async () => {
  const { cls, noa } = await noaWithKeptCode();
  const r = await reset(cls, noa.studentId);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.deepEqual(Object.keys(b).sort(), ['claimCode', 'claimExpires', 'ok']);
  assert.match(b.claimCode, new RegExp(`^[${CODE_ALPHABET}]{6}$`));
  const days = (Date.parse(b.claimExpires) - Date.now()) / 864e5;
  assert.ok(days > RETENTION.claimCodeDays - 0.01 && days <= RETENTION.claimCodeDays, `${days} days`);
  const row = one(h.env, 'SELECT pin_hash, claim_hash, claim_expires FROM students WHERE id = ?', noa.studentId);
  assert.equal(row.pin_hash, '');
  assert.equal(row.claim_expires, b.claimExpires);
  assert.match(row.claim_hash, /^[a-f0-9]+:[a-f0-9]{64}$/, 'a salted hash');
  assert.ok(!JSON.stringify(rows(h.env, 'SELECT * FROM students')).includes(b.claimCode), 'the code itself is never stored');
  // another class's teacher: nothing changes, and no code
  const other = await makeClass(h);
  assert.deepEqual(await (await reset(other, noa.studentId)).json(), { ok: true });
  assert.equal(one(h.env, 'SELECT claim_expires FROM students WHERE id = ?', noa.studentId).claim_expires, b.claimExpires);
});

test('no code, a wrong code, an expired code and a reused code are all refused; the right code joins and returns the kept code once', async () => {
  const { cls, noa, kept } = await noaWithKeptCode();
  const { claimCode } = await (await reset(cls, noa.studentId)).json();
  const net = await netOf(h.env, '203.0.113.7');

  // someone who knows only her name: no code, no account, no restore code; no try is used
  const bare = await join(cls, {});
  assert.equal(bare.status, 403);
  const bareBody = await bare.json();
  assert.equal(bareBody.error, 'claim_code_needed');
  assert.equal(bareBody.vault, undefined);
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}`), 0, 'asking for the code costs no try');
  // a wrong code: refused, and it uses a try of this network
  assert.equal(await errorOf(await join(cls, { claim: 'AAAAAA' })), 'claim_code_bad');
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}`), 1);
  assert.equal(one(h.env, 'SELECT pin_hash FROM students WHERE id = ?', noa.studentId).pin_hash, '', 'still waiting for her');

  // the right code (typed in lower case, with a space): in, as herself, with the kept code; the PIN is the new one
  const r = await join(cls, { claim: `${claimCode.slice(0, 3).toLowerCase()} ${claimCode.slice(3)}` });
  assert.equal(r.status, 200);
  const back = await r.json();
  assert.equal(back.studentId, noa.studentId); assert.equal(back.returning, true);
  assert.deepEqual(back.vault, { code: kept });
  assert.equal((await progress(back)).status, 200, 'her new token works');
  assert.equal((await progress(noa)).status, 401, 'the old one does not');
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}`), 1, 'the right code gave its try back');
  const row = one(h.env, 'SELECT pin_hash, claim_hash, claim_expires FROM students WHERE id = ?', noa.studentId);
  assert.notEqual(row.pin_hash, ''); assert.equal(row.claim_hash, null); assert.equal(row.claim_expires, null);

  // the same code again, by someone else with another PIN: the account has a PIN now, so it is a wrong PIN, and no code
  const reused = await join(cls, { claim: claimCode, pin: '1111' });
  assert.equal(reused.status, 403);
  const reusedBody = await reused.json();
  assert.equal(reusedBody.error, 'wrong_pin'); assert.equal(reusedBody.vault, undefined);
  // her own PIN keeps working
  assert.equal((await join(cls, {})).status, 200);
  const d = await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
  assert.equal(d.students.find((s) => s.id === noa.studentId).pinReset, false);
});

test('a code past its 7 days is refused, and a second reset replaces the first code', async () => {
  const { cls, noa } = await noaWithKeptCode();
  const first = (await (await reset(cls, noa.studentId)).json()).claimCode;
  advanceClock((RETENTION.claimCodeDays * 24 + 1) * 3600e3);
  assert.equal(await errorOf(await join(cls, { claim: first })), 'claim_code_bad', 'expired');
  // the teacher gives a new code: the old one stays refused, the new one works
  const second = (await (await reset(cls, noa.studentId)).json()).claimCode;
  assert.notEqual(second, first);
  assert.equal(await errorOf(await join(cls, { claim: first })), 'claim_code_bad', 'replaced');
  const r = await join(cls, { claim: second });
  assert.equal(r.status, 200);
  assert.ok((await r.json()).vault?.code, 'the kept code comes back with the claim');
});

test('the right code sent twice at once: exactly one join claims it, the other is refused and gets nothing', async () => {
  const { cls, noa } = await noaWithKeptCode();
  const { claimCode } = await (await reset(cls, noa.studentId)).json();
  const [a, b] = await Promise.all([join(cls, { claim: claimCode, pin: '1111' }), join(cls, { claim: claimCode, pin: '2222' })]);
  const answers = [await a.json(), await b.json()];
  const won = answers.filter((x) => x.studentId);
  assert.equal(won.length, 1, JSON.stringify(answers.map((x) => x.error || 'ok')));
  assert.equal(answers.find((x) => !x.studentId).error, 'claim_code_bad');
  assert.ok(won[0].vault?.code);
  assert.equal(rows(h.env, 'SELECT * FROM student_tokens WHERE student_id = ?', noa.studentId).length, 1, 'one device signed in');
  const pin = won[0] === answers[0] ? '1111' : '2222';
  assert.equal((await join(cls, { pin })).status, 200, 'the PIN of the join that won');
});

test('guessing the code is capped per network like the PIN, and a stranger\'s guesses do not stop the student elsewhere', async () => {
  const { cls, noa } = await noaWithKeptCode();
  const { claimCode } = await (await reset(cls, noa.studentId)).json();
  const stranger = '198.51.100.66';
  const st = await Promise.all(Array.from({ length: 12 }, () => join(cls, { claim: 'ZZZZZZ' }, stranger).then(errorOf)));
  assert.deepEqual(st.sort(), [...Array(5).fill('claim_code_bad'), ...Array(7).fill('too_many_pin')]);
  assert.equal(await errorOf(await join(cls, { claim: claimCode }, stranger)), 'too_many_pin', 'that network waits, even with the right code');
  assert.equal((await join(cls, { claim: claimCode }, '192.0.2.10')).status, 200, 'the student at home is not locked out');
});

test('a student reset before claim codes existed (no code stored) waits for the teacher to give one', async () => {
  const { cls, noa } = await noaWithKeptCode();
  h.env.DB.raw.prepare("UPDATE students SET pin_hash = '', claim_hash = NULL, claim_expires = NULL WHERE id = ?").run(noa.studentId);
  assert.equal(await errorOf(await join(cls, {})), 'claim_code_needed');
  assert.equal(await errorOf(await join(cls, { claim: 'ABCDEF' })), 'claim_code_bad');
  const { claimCode } = await (await reset(cls, noa.studentId)).json();
  assert.equal((await join(cls, { claim: claimCode })).status, 200);
});

test('the night purge clears a claim code past its end, and leaves a live one', async () => {
  const { cls, noa } = await noaWithKeptCode();
  const [, itai] = cls.students;
  await reset(cls, noa.studentId);
  advanceClock((RETENTION.claimCodeDays * 24 + 1) * 3600e3);
  await reset(cls, itai.studentId);
  await purgeClass(h.env);
  assert.deepEqual({ ...one(h.env, 'SELECT claim_hash, claim_expires FROM students WHERE id = ?', noa.studentId) }, { claim_hash: null, claim_expires: null });
  assert.ok(one(h.env, 'SELECT claim_hash FROM students WHERE id = ?', itai.studentId).claim_hash, 'Itai\'s code is still live');
});
