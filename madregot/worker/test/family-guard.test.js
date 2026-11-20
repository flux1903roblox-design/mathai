// The family's kept progress (DURABLE-6) moves a child's progress to the child's next device, and is never a way for the
// parent to get the child's restore code (and with it the whole record and every later sync):
//   still linked   restoreFrom on an escrow whose device is linked: 409 escrow_in_use, no code (claim and devices/this)
//   sharing off    the child turned "שיתוף עם ההורים" off: a parent's unlink deletes the escrow, so restoreFrom is 404
//   child left     the device left by itself: its escrow is deleted, restoreFrom is 404
//   kept           sharing on, the parent unlinked it: restoreFrom gives the code to the new device (the existing path)
//   moved away     after the unlink, the old device's next write with its old token is 401 not_linked (vault-guard.test.js)
// Every secret and address here is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setup, one, rows, signIn, accountId, insertSub, linkDevice } from './helpers.js';
import { CODE_ALPHABET } from '../src/util.js';
import { purge } from '../src/cron.js';

let h;
afterEach(() => { h?.done(); h = null; });
const VAULT_SECRET = 'test-vault-secret-0123456789abcdef0123456789abcdef';
const ANY_CODE = /[A-HJ-NP-Z2-9]{16}/;

function newCode() {
  let body = '';
  for (const b of randomBytes(15)) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
  let sum = 0;
  for (let i = 0; i < 15; i += 1) sum += (i + 1) * CODE_ALPHABET.indexOf(body[i]);
  return body + CODE_ALPHABET[sum % CODE_ALPHABET.length];
}
async function parent(email = 'parent@example.test') {
  const token = await signIn(h, email);
  const a = accountId(h.env, email);
  insertSub(h.env, { kind: 'family', account_id: a });
  return { token, a, headers: { 'X-Account-Token': token } };
}
/** A linked tablet with a vault whose code the family keeps: { tablet, code, escrowId }. */
async function tabletWithEscrow(p) {
  const tablet = await linkDevice(h.env, p.a, 'הטאבלט');
  const code = newCode(); const lookup = randomBytes(32).toString('hex');
  assert.equal((await h.call('POST', '/api/vault', { headers: { ...tablet.headers, 'X-Vault': lookup }, body: { ifRev: null, blob: randomBytes(120).toString('base64url') } })).status, 200);
  assert.equal((await h.call('POST', '/api/vault/escrow', { headers: tablet.headers, body: { code, lookup } })).status, 200);
  return { tablet, code, escrowId: one(h.env, 'SELECT id FROM vault_escrow').id };
}
const thisDevice = (p, restoreFrom, device = 'c'.repeat(32)) => h.call('POST', '/api/family/devices/this', {
  headers: { ...p.headers, 'X-Device': device }, body: { label: 'הטלפון שלי', restoreFrom },
});
const startLink = (device) => h.call('POST', '/api/family/link/start', { headers: { 'X-Device': device }, body: { secret: 'b'.repeat(32) } }).then((r) => r.json());
const claim = (p, code, restoreFrom) => h.call('POST', '/api/family/link/claim', { headers: p.headers, body: { code, label: 'חדש', restoreFrom } });
/** No answer, and nothing in the database, carries the code. */
async function noCode(res, code) {
  const text = await res.text();
  assert.doesNotMatch(text, ANY_CODE);
  assert.ok(!text.includes(code));
  return JSON.parse(text);
}

test('still linked: restoreFrom on the escrow of a linked device is 409 escrow_in_use with no code, on devices/this and on claim', async () => {
  h = await setup({ VAULT_SECRET, PARENT_REPORT: 'on' });
  const p = await parent();
  const { code, escrowId } = await tabletWithEscrow(p);
  const r = await thisDevice(p, escrowId);
  assert.equal(r.status, 409);
  assert.equal((await noCode(r, code)).error, 'escrow_in_use');
  assert.equal(rows(h.env, "SELECT * FROM family_devices WHERE label = 'הטלפון שלי'").length, 0, 'no device was linked');
  const s = await startLink('e'.repeat(32));
  const c = await claim(p, s.code, escrowId);
  assert.equal(c.status, 409);
  assert.equal((await noCode(c, code)).error, 'escrow_in_use');
  assert.equal(one(h.env, 'SELECT claimed_at FROM link_codes').claimed_at, null, 'nothing was claimed');
});

test('sharing off: the child turned sharing off, the parent unlinks the tablet: the escrow is deleted, restoreFrom is 404', async () => {
  h = await setup({ VAULT_SECRET, PARENT_REPORT: 'on' });
  const p = await parent();
  const { tablet, code, escrowId } = await tabletWithEscrow(p);
  assert.equal((await h.call('POST', '/api/family/summary/sharing', { headers: tablet.headers, body: { on: false } })).status, 200);
  // still linked: 409, as above
  assert.equal((await thisDevice(p, escrowId)).status, 409);
  assert.equal((await h.call('POST', `/api/family/devices/${tablet.id}/unlink`, { headers: p.headers, body: {} })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 0, 'not kept for the parent');
  const list = await (await h.call('GET', '/api/family/vaults', { headers: p.headers })).json();
  assert.deepEqual(list.vaults, []);
  const r = await thisDevice(p, escrowId);
  assert.equal(r.status, 404);
  assert.equal((await noCode(r, code)).error, 'escrow_not_found');
});

test('child left: the device leaves the family by itself, its escrow is deleted, restoreFrom is 404', async () => {
  h = await setup({ VAULT_SECRET, PARENT_REPORT: 'on' });
  const p = await parent();
  const { tablet, code, escrowId } = await tabletWithEscrow(p);
  assert.equal((await h.call('POST', '/api/family/devices/leave', { headers: tablet.headers, body: {} })).status, 200);
  assert.equal(rows(h.env, 'SELECT * FROM vault_escrow').length, 0);
  assert.equal(rows(h.env, 'SELECT * FROM vaults').length, 1, 'the child\'s own backup stays');
  const r = await thisDevice(p, escrowId);
  assert.equal(r.status, 404);
  assert.equal((await noCode(r, code)).error, 'escrow_not_found');
  const s = await startLink('e'.repeat(32));
  assert.equal((await claim(p, s.code, escrowId)).status, 404);
});

test('kept: sharing on and the parent unlinked the tablet: a new device continues from it and gets the code', async () => {
  h = await setup({ VAULT_SECRET, PARENT_REPORT: 'on' });
  const p = await parent();
  const { tablet, code, escrowId } = await tabletWithEscrow(p);
  assert.equal((await h.call('POST', `/api/family/devices/${tablet.id}/unlink`, { headers: p.headers, body: {} })).status, 200);
  assert.equal(one(h.env, 'SELECT device_id FROM vault_escrow').device_id, null);
  const r = await thisDevice(p, escrowId);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).vault, { code });
});

test('the purge of an unused device keeps its escrow only while the child shared', async () => {
  h = await setup({ VAULT_SECRET, PARENT_REPORT: 'on' });
  const p = await parent();
  const on = await linkDevice(h.env, p.a, 'משתף');
  const off = await linkDevice(h.env, p.a, 'לא משתף');
  for (const d of [on, off]) {
    const lookup = randomBytes(32).toString('hex');
    await h.call('POST', '/api/vault', { headers: { ...d.headers, 'X-Vault': lookup }, body: { ifRev: null, blob: randomBytes(120).toString('base64url') } });
    await h.call('POST', '/api/vault/escrow', { headers: d.headers, body: { code: newCode(), lookup } });
  }
  h.env.DB.raw.prepare('UPDATE family_devices SET share_child = 0 WHERE id = ?').run(off.id);
  h.env.DB.raw.prepare("UPDATE family_devices SET last_seen = '2024-01-01'").run();
  await purge(h.env);
  assert.equal(rows(h.env, 'SELECT * FROM family_devices').length, 0);
  assert.deepEqual(rows(h.env, 'SELECT label, device_id FROM vault_escrow').map((r) => ({ ...r })), [{ label: 'משתף', device_id: null }]);
});
