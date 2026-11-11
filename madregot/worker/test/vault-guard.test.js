// The vault's guards added after the review of the durable lane:
//   - the size meter cannot be filled by one person: a class student or family device creates at most 3 vaults a day,
//     credentialed creates count per network too, and one network adds at most 20 MiB of new vaults a day;
//   - the owner hears at 90% as well as at 70%;
//   - a vault its owner deleted leaves a tombstone: every route answers 410 vault_deleted, so another device with the
//     same code never makes it again (an expired vault, with no tombstone, still can be), and the tombstone goes after
//     400 days;
//   - a write with a family-device token the server no longer knows (the parent unlinked the device) is 401 not_linked
//     with X-AI-Linked: 0 and writes nothing.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, dayOf, jerusalemMidnight } from '../src/util.js';
import { BLOB_MAX, NEW_ID_DAILY, NEW_NET_KB_DAILY, vaultNight, maxBytes } from '../src/vault.js';
import { flushNotices } from '../src/email.js';
import { setup, rows, one, makeClass, bearer, countOf, netOf, advanceClock, resetClock, signIn, accountId, insertSub, linkDevice } from './helpers.js';

let h;
afterEach(() => { resetClock(); h?.done(); h = null; });
const token = () => randomToken(32);
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const blobOf = (n, seed = 0) => { let s = ''; for (let i = 0; i < n; i++) s += B64[(i * 7 + seed * 13 + (i >> 3)) % 64]; return s; };
const put = (t, body, { headers = {}, ip } = {}) => h.call('POST', '/api/vault', { body, ip, headers: { 'X-Vault': t, ...headers } });
const get = (t, { headers = {}, ip } = {}) => h.call('GET', '/api/vault', { ip, headers: { 'X-Vault': t, ...headers } });
const rev = (t, { headers = {}, ip } = {}) => h.call('GET', '/api/vault/rev', { ip, headers: { 'X-Vault': t, ...headers } });
const del = (t, { headers = {}, ip } = {}) => h.call('POST', '/api/vault/delete', { body: {}, ip, headers: { 'X-Vault': t, ...headers } });
const meter = () => one(h.env, "SELECT value FROM meters WHERE name = 'vault_bytes'").value;
const big = blobOf(BLOB_MAX);

test('one class Bearer cannot move the meter by more than 3 blobs a day; a stranger still makes a backup', async () => {
  h = await setup({ VAULT_SECRET: 'x'.repeat(64) });
  const cls = await makeClass(h, { students: ['תוקף'] });
  const auth = bearer(cls.students[0]);
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await put(token(), { ifRev: null, blob: big }, { headers: auth })).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429, 429, 429, 429]);
  assert.equal(NEW_ID_DAILY, 3);
  assert.equal(meter(), 3 * BLOB_MAX, 'three blobs, no more');
  const refused = await put(token(), { ifRev: null, blob: big }, { headers: auth });
  assert.equal((await refused.json()).error, 'too_many_vaults');
  assert.equal(countOf(h.env, `vault:new:i:s:${cls.students[0].studentId}`), 3, 'refused creates gave their count back');
  // someone else, on another network, with a small backup
  assert.equal((await put(token(), { ifRev: null, blob: blobOf(400) }, { ip: '198.51.100.9' })).status, 200);
  assert.equal((await (await h.call('GET', '/api/health')).json()).vaultFull, false);
  // tomorrow the same student may make a backup again
  advanceClock(864e5);
  assert.equal((await put(token(), { ifRev: null, blob: blobOf(400) }, { headers: auth })).status, 200);
});

test('many students of one self-made class, on one network, add at most 20 MiB of new vaults a day', async () => {
  h = await setup({ VAULT_SECRET: 'x'.repeat(64) });
  const names = Array.from({ length: 22 }, (_, i) => `תלמיד ${i + 1}`);
  const cls = await makeClass(h, { students: names });
  let ok = 0; let refused = 0;
  for (const s of cls.students) {
    for (let i = 0; i < 3; i++) {
      const r = await put(token(), { ifRev: null, blob: big }, { headers: bearer(s) });
      if (r.status === 200) ok++;
      else { assert.equal(r.status, 429); assert.equal((await r.json()).error, 'too_many_vaults'); refused++; }
    }
  }
  const perBlobKb = Math.ceil(BLOB_MAX / 1024);
  assert.equal(ok, Math.floor(NEW_NET_KB_DAILY / perBlobKb), 'the network\'s bytes for the day');
  assert.equal(refused, 66 - ok);
  assert.ok(meter() <= NEW_NET_KB_DAILY * 1024, 'at most 20 MiB from one network');
  assert.ok(meter() < maxBytes(h.env) * 0.15, 'far from the 200 MB limit');
  assert.ok(countOf(h.env, `vault:newkb:${await netOf(h.env)}`) <= NEW_NET_KB_DAILY);
  // another network is not affected
  assert.equal((await put(token(), { ifRev: null, blob: big }, { ip: '198.51.100.20' })).status, 200);
});

test('the owner hears at 90% of VAULT_MAX_MB as well as at 70%, once a month each', async () => {
  h = await setup({ VAULT_MAX_MB: '1.1' });
  const ips = ['198.51.100.1', '198.51.100.2', '198.51.100.3'];
  for (const ip of ips) assert.equal((await put(token(), { ifRev: null, blob: big }, { ip })).status, 200);
  const kinds = () => rows(h.env, "SELECT kind FROM notices WHERE kind LIKE 'owner:vault:%' ORDER BY kind").map((r) => r.kind);
  assert.deepEqual(kinds(), ['owner:vault:70', 'owner:vault:90'], '3 × 341 KiB of 1.1 MiB is past 90%');
  await vaultNight(h.env, new Date(jerusalemMidnight(dayOf()).ms + 3 * 3600_000));
  assert.deepEqual(kinds(), ['owner:vault:70', 'owner:vault:90'], 'the night adds no second notice this month');
  await flushNotices(h.env);
  const mail = h.net.log.email.find((m) => m.subject.includes('90%'));
  assert.ok(mail, 'the 90% email was sent');
  assert.match(mail.text, /VAULT_MAX_MB/);
  assert.match(mail.text, /קרוב לגבול/);
});

test('a deleted vault stays deleted: the other device with the same code hears 410 vault_deleted on every route', async () => {
  h = await setup();
  const t = token();
  assert.equal((await put(t, { ifRev: null, blob: blobOf(300) }, { ip: '198.51.100.1' })).status, 200); // device A
  assert.equal((await put(t, { ifRev: 1, blob: blobOf(310, 1) }, { ip: '198.51.100.2' })).status, 200); // device B, same code
  assert.deepEqual(await (await del(t, { ip: '198.51.100.1' })).json(), { deleted: 1 }); // A: "להפסיק את הגיבוי"
  assert.equal(meter(), 0);
  for (const r of [
    await put(t, { ifRev: 2, blob: blobOf(320, 2) }, { ip: '198.51.100.2' }), // B's next push
    await put(t, { ifRev: null, blob: blobOf(320, 2) }, { ip: '198.51.100.2' }), // what an app that treats it as expired would do
    await get(t, { ip: '198.51.100.3' }), // a fresh phone with the code
    await rev(t, { ip: '198.51.100.2' }),
  ]) {
    assert.equal(r.status, 410);
    assert.equal((await r.json()).error, 'vault_deleted');
  }
  assert.equal(rows(h.env, 'SELECT * FROM vaults').length, 0, 'never made again');
  const stone = rows(h.env, 'SELECT * FROM vault_tombstones');
  assert.equal(stone.length, 1);
  assert.deepEqual(Object.keys(stone[0]).sort(), ['deleted_at', 'id_hash'], 'the hash and the time, nothing else');
  assert.notEqual(stone[0].id_hash, t, 'never the lookup token');
});

test('an expired vault (no tombstone) is made again; a tombstone goes after 400 days', async () => {
  h = await setup();
  const old = token();
  await put(old, { ifRev: null, blob: blobOf(200) });
  const gone = token();
  await put(gone, { ifRev: null, blob: blobOf(200) });
  await del(gone);
  advanceClock(401 * 864e5);
  await vaultNight(h.env, new Date());
  assert.equal(rows(h.env, 'SELECT * FROM vaults').length, 0, 'the unused vault expired');
  assert.equal(rows(h.env, 'SELECT * FROM vault_tombstones').length, 0, 'the tombstone is gone after 400 days');
  const r = await put(old, { ifRev: 1, blob: blobOf(210) });
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, 'vault_gone', 'expired: the app makes it again');
  assert.equal((await put(old, { ifRev: null, blob: blobOf(210) })).status, 200);
});

test('a write with a family token the server no longer knows is 401 not_linked (X-AI-Linked: 0) and writes nothing; reads still work', async () => {
  h = await setup({ PARENT_REPORT: 'on' });
  await signIn(h, 'parent@example.test');
  const a = accountId(h.env, 'parent@example.test');
  insertSub(h.env, { kind: 'family', account_id: a });
  const tablet = await linkDevice(h.env, a);
  const t = token();
  assert.equal((await put(t, { ifRev: null, blob: blobOf(300) }, { headers: tablet.headers })).status, 200);
  h.env.DB.raw.prepare('DELETE FROM family_devices WHERE id = ?').run(tablet.id); // the parent unlinked it
  for (const body of [{ ifRev: 1, blob: blobOf(320, 1) }, { ifRev: null, blob: blobOf(320, 1) }]) {
    const r = await put(body.ifRev ? t : token(), body, { headers: tablet.headers });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('X-AI-Linked'), '0');
    assert.equal((await r.json()).error, 'not_linked');
  }
  assert.equal(one(h.env, 'SELECT rev FROM vaults').rev, 1, 'nothing was written');
  assert.equal(rows(h.env, 'SELECT * FROM vaults').length, 1);
  assert.equal((await rev(t, { headers: tablet.headers })).status, 200, 'a read is harmless');
  // without the stale token, the same device writes as anyone else
  assert.equal((await put(t, { ifRev: 1, blob: blobOf(320, 1) })).status, 200);
});
