// The encrypted backup vault (DURABLE-5): create and compare-and-swap update, the caps (identity first, misses taken
// before the lookup and given back on a hit, anonymous and global creates, writes per vault), the VAULT_RL burst filter
// before any database call, the size meter changed in the same batch as the row (exact under parallel requests), the
// 400-day retention counting the last read, the kill switch, health, the night job, and that no table ever holds the
// lookup token or the address a request came from.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { run, dailySummary } from '../src/cron.js';
import { flushNotices } from '../src/email.js';
import { sha256, randomToken, dayOf, jerusalemMidnight } from '../src/util.js';
import {
  BLOB_MAX, MISS_DAILY, NEW_NET_DAILY, forgetVault, vaultNight, maxBytes,
} from '../src/vault.js';
import { setup, rows, one, makeClass, bearer, countOf, netOf, advanceClock, signIn, accountId, linkDevice } from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const IP = '203.0.113.7';
const token = () => randomToken(32); // a 64-hex lookup token, as the app derives it
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** A base64url blob of n characters (what the app's seal() makes; the server never opens it). */
const blobOf = (n, seed = 0) => {
  let s = '';
  for (let i = 0; i < n; i++) s += B64[(i * 7 + seed * 13 + (i >> 3)) % 64];
  return s;
};
const vh = (t, extra = {}) => ({ 'X-Vault': t, ...extra });
const put = (t, body, opts = {}) => h.call('POST', '/api/vault', { body, ...opts, headers: vh(t, opts.headers) });
const get = (t, opts = {}) => h.call('GET', '/api/vault', { ...opts, headers: vh(t, opts.headers) });
const rev = (t, opts = {}) => h.call('GET', '/api/vault/rev', { ...opts, headers: vh(t, opts.headers) });
const del = (t, opts = {}) => h.call('POST', '/api/vault/delete', { body: {}, ...opts, headers: vh(t, opts.headers) });
const meter = () => one(h.env, "SELECT value FROM meters WHERE name = 'vault_bytes'").value;
const sumBytes = () => one(h.env, 'SELECT COALESCE(SUM(bytes), 0) AS n FROM vaults').n;
const night = () => new Date(jerusalemMidnight(dayOf()).ms + 3 * 3600_000 + 10 * 60_000);
/** A small seeded random (the parallel runs are the same every time). */
const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

test('create, then update with the right ifRev: rev 2, the first blob kept as prev_blob, and both reads answer', async () => {
  h = await setup();
  const t = token();
  const a = blobOf(120, 1); const b = blobOf(200, 2);
  const c = await put(t, { ifRev: null, blob: a });
  assert.equal(c.status, 200);
  const cb = await c.json();
  assert.equal(cb.rev, 1); assert.ok(Date.parse(cb.updatedAt));
  const u = await put(t, { ifRev: 1, blob: b });
  assert.equal(u.status, 200);
  assert.equal((await u.json()).rev, 2);
  const row = one(h.env, 'SELECT * FROM vaults');
  assert.equal(row.id_hash, await sha256(t), 'the table holds the SHA-256 of the token, never the token');
  assert.equal(row.blob, b); assert.equal(row.prev_blob, a); assert.equal(row.prev_rev, 1); assert.equal(row.rev, 2);
  assert.equal(row.bytes, a.length + b.length);
  assert.equal(meter(), a.length + b.length);
  assert.doesNotMatch(row.created_at, /#/, 'the one-time stamp is gone at the end of the batch');
  assert.ok(Date.parse(row.created_at));
  const g = await get(t);
  assert.equal(g.status, 200);
  assert.deepEqual(Object.keys(await g.clone().json()).sort(), ['blob', 'rev', 'updatedAt']);
  assert.equal((await g.json()).blob, b);
  const r = await (await rev(t)).json();
  assert.deepEqual(Object.keys(r).sort(), ['rev', 'updatedAt']);
  assert.equal(r.rev, 2);
  // a third write drops the first blob from the meter: new total = new + previous
  const c3 = blobOf(90, 3);
  assert.equal((await put(t, { ifRev: 2, blob: c3 })).status, 200);
  assert.equal(meter(), b.length + c3.length);
  assert.equal(meter(), sumBytes());
});

test('a stale ifRev is 409 with the current rev; a second create with the same id is 409; an update of nothing is 404 vault_gone', async () => {
  h = await setup();
  const t = token();
  await put(t, { ifRev: null, blob: blobOf(100) });
  await put(t, { ifRev: 1, blob: blobOf(100, 1) });
  const stale = await put(t, { ifRev: 1, blob: blobOf(100, 2) });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'vault_conflict', message: 'vault_conflict', rev: 2 });
  const again = await put(t, { ifRev: null, blob: blobOf(100, 3) });
  assert.equal(again.status, 409);
  assert.equal((await again.json()).rev, 2);
  assert.equal(one(h.env, 'SELECT blob FROM vaults').blob, blobOf(100, 1), 'neither conflict wrote anything');
  assert.equal(meter(), sumBytes());
  const gone = await put(token(), { ifRev: 3, blob: blobOf(100) });
  assert.equal(gone.status, 404);
  assert.equal((await gone.json()).error, 'vault_gone');
  assert.equal((await get(token())).status, 404);
  assert.equal((await (await rev(token())).json()).error, 'vault_not_found');
});

test('20 parallel updates with the same ifRev: exactly one 200, the rest 409 with the new rev', async () => {
  h = await setup();
  const t = token();
  await put(t, { ifRev: null, blob: blobOf(500) });
  const res = await Promise.all(Array.from({ length: 20 }, (_, i) => put(t, { ifRev: 1, blob: blobOf(500 + i, i) })));
  const codes = res.map((r) => r.status);
  assert.equal(codes.filter((c) => c === 200).length, 1, codes.join(','));
  assert.equal(codes.filter((c) => c === 409).length, 19, codes.join(','));
  for (const r of res.filter((x) => x.status === 409)) assert.equal((await r.json()).rev, 2);
  assert.equal(one(h.env, 'SELECT rev FROM vaults').rev, 2);
  assert.equal(meter(), sumBytes());
});

test('10 parallel creates of one new vault: one 200, nine 409, and the meter counts it once', async () => {
  for (let round = 0; round < 5; round++) {
    h = await setup();
    const t = token();
    const res = await Promise.all(Array.from({ length: 10 }, (_, i) => put(t, { ifRev: null, blob: blobOf(1000 + i, i) }, { ip: `192.0.2.${i}` })));
    const codes = res.map((r) => r.status);
    assert.equal(codes.filter((c) => c === 200).length, 1, codes.join(','));
    assert.equal(codes.filter((c) => c === 409).length, 9, codes.join(','));
    assert.equal(meter(), sumBytes());
    h.done(); h = null;
  }
});

test('50 parallel GETs with wrong tokens from one network: at most 20 lookups reach the table, the rest are 429', async () => {
  h = await setup();
  let lookups = 0;
  const prepare = h.env.DB.prepare;
  h.env.DB.prepare = (sql) => { if (/^\s*SELECT\b[\s\S]*\bFROM vaults\b/.test(sql)) lookups++; return prepare(sql); };
  const res = await Promise.all(Array.from({ length: 50 }, (_, i) => (i % 2 ? get : rev)(token())));
  h.env.DB.prepare = prepare;
  const codes = res.map((r) => r.status);
  assert.ok(lookups <= MISS_DAILY, `lookups ${lookups}`);
  assert.equal(codes.filter((c) => c === 404).length, lookups);
  assert.equal(codes.filter((c) => c === 429).length, 50 - lookups);
  for (const r of res.filter((x) => x.status === 429)) assert.equal((await r.json()).error, 'too_many_tries');
  assert.equal(countOf(h.env, `vault:miss:n:${await netOf(h.env, IP)}`), MISS_DAILY);
  // with no tries left, even a right token is refused today (the try is taken before the lookup)
  const t = token();
  h.env.DB.raw.prepare("INSERT INTO vaults (id_hash, rev, blob, bytes, created_at, updated_at) VALUES (?, 1, ?, 50, 'x', 'x')").run(await sha256(t), blobOf(50));
  assert.equal((await rev(t)).status, 429);
});

test('the school case: 40 students behind one address each find their vault, then 10 devices with no class too', async () => {
  h = await setup();
  const names = Array.from({ length: 40 }, (_, i) => `תלמיד ${i + 1}`);
  const cls = await makeClass(h, { students: names });
  const tokens = names.map(() => token());
  for (let i = 0; i < 40; i++) assert.equal((await put(tokens[i], { ifRev: null, blob: blobOf(80, i) }, { headers: bearer(cls.students[i]) })).status, 200);
  const res = await Promise.all(tokens.map((t, i) => rev(t, { headers: bearer(cls.students[i]) })));
  assert.deepEqual(res.map((r) => r.status), Array(40).fill(200));
  // counted per student, and every hit was given back
  for (const s of cls.students.slice(0, 3)) assert.equal(countOf(h.env, `vault:miss:s:${s.studentId}`), 0);
  assert.equal(countOf(h.env, `vault:miss:n:${await netOf(h.env, IP)}`), 0);
  const solo = Array.from({ length: 10 }, () => token());
  for (const [i, t] of solo.entries()) await put(t, { ifRev: null, blob: blobOf(60, i) });
  const more = await Promise.all(solo.map((t) => rev(t)));
  assert.deepEqual(more.map((r) => r.status), Array(10).fill(200));
  // a student's wrong codes are their own: they never use up the network's tries
  for (let i = 0; i < MISS_DAILY; i++) assert.equal((await rev(token(), { headers: bearer(cls.students[0]) })).status, 404);
  assert.equal((await rev(token(), { headers: bearer(cls.students[0]) })).status, 429);
  assert.equal((await rev(solo[0])).status, 200, 'the network still has its tries');
  assert.equal((await rev(tokens[1], { headers: bearer(cls.students[1]) })).status, 200, 'and so does the next student');
});

test('a family device is counted as itself; an invalid credential counts as the network', async () => {
  h = await setup();
  await signIn(h, 'parent@example.test');
  const dev = await linkDevice(h.env, accountId(h.env, 'parent@example.test'));
  assert.equal((await rev(token(), { headers: dev.headers })).status, 404);
  assert.equal(countOf(h.env, `vault:miss:fd:${dev.id}`), 1);
  assert.equal((await rev(token(), { headers: { Authorization: 'Bearer nope' } })).status, 404);
  assert.equal(countOf(h.env, `vault:miss:n:${await netOf(h.env, IP)}`), 1);
});

test('61 anonymous creates from one network: the 61st is 429 too_many_vaults; a create with a student\'s Bearer is not', async () => {
  h = await setup();
  for (let i = 0; i < NEW_NET_DAILY; i++) assert.equal((await put(token(), { ifRev: null, blob: blobOf(50, i) })).status, 200, `create ${i + 1}`);
  const over = await put(token(), { ifRev: null, blob: blobOf(50) });
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error, 'too_many_vaults');
  assert.equal(rows(h.env, 'SELECT id_hash FROM vaults').length, NEW_NET_DAILY);
  const cls = await makeClass(h, { students: ['דנה'] });
  assert.equal((await put(token(), { ifRev: null, blob: blobOf(50) }, { headers: bearer(cls.students[0]) })).status, 200);
  // updates of the network's vaults go on
  const t = token();
  assert.equal((await put(t, { ifRev: null, blob: blobOf(50) }, { ip: '198.51.100.9' })).status, 200);
  assert.equal((await put(t, { ifRev: 1, blob: blobOf(51) })).status, 200);
  // a refused create (it exists) gives its create counter back
  const before = countOf(h.env, 'vault:new:all');
  assert.equal((await put(t, { ifRev: null, blob: blobOf(52) }, { ip: '198.51.100.10' })).status, 409);
  assert.equal(countOf(h.env, 'vault:new:all'), before);
});

test('the meter is exact after 60 random creates, updates, deletes and over-limit creates run in parallel', async () => {
  for (const seed of [7, 99, 2026]) {
    h = await setup({ VAULT_MAX_MB: '1' });
    const rand = rng(seed);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    const known = Array.from({ length: 8 }, () => token());
    for (const [i, t] of known.entries()) assert.equal((await put(t, { ifRev: null, blob: blobOf(40_000, i) }, { ip: `198.51.100.${i}` })).status, 200);
    const ops = Array.from({ length: 60 }, (_, i) => {
      const r = rand();
      const ip = `192.0.2.${i}`;
      const size = 40 + Math.floor(rand() * 90_000);
      if (r < 0.3) return () => put(token(), { ifRev: null, blob: blobOf(size, i) }, { ip }); // new, some over the limit
      if (r < 0.4) return () => put(pick(known), { ifRev: null, blob: blobOf(size, i) }, { ip }); // exists: 409
      if (r < 0.7) return () => put(pick(known), { ifRev: 1 + Math.floor(rand() * 3), blob: blobOf(size, i) }, { ip }); // CAS, often stale
      if (r < 0.85) return () => del(pick(known), { ip });
      return () => put(token(), { ifRev: 2, blob: blobOf(size, i) }, { ip }); // gone
    });
    const res = await Promise.all(ops.map((f) => f()));
    const codes = new Set(res.map((r) => r.status));
    assert.ok(codes.has(200) && codes.has(409), [...codes].join(','));
    // 410: a known vault deleted by one op is tombstoned for the creates and updates that come after it
    assert.ok([...codes].every((c) => [200, 404, 409, 410, 503].includes(c)), [...codes].join(','));
    assert.equal(meter(), sumBytes(), `seed ${seed}`);
    for (const row of rows(h.env, 'SELECT blob, prev_blob, bytes, created_at FROM vaults')) {
      assert.equal(row.bytes, row.blob.length + (row.prev_blob?.length || 0));
      assert.doesNotMatch(row.created_at, /#/);
    }
    h.done(); h = null;
  }
});

test('the meter blocks new vaults at VAULT_MAX_MB with 503 vault_full; existing vaults still update', async () => {
  h = await setup({ VAULT_MAX_MB: '0.2' });
  const max = maxBytes(h.env);
  assert.equal(max, Math.floor(0.2 * 1024 * 1024));
  const a = token(); const b = token();
  assert.equal((await put(a, { ifRev: null, blob: blobOf(100_000) })).status, 200);
  assert.equal((await put(b, { ifRev: null, blob: blobOf(100_000, 1) })).status, 200);
  const full = await put(token(), { ifRev: null, blob: blobOf(40_000) });
  assert.equal(full.status, 503);
  assert.equal((await full.json()).error, 'vault_full');
  assert.equal(countOf(h.env, 'vault:new:all'), 2, 'the refused create gave its counter back');
  assert.equal((await put(a, { ifRev: 1, blob: blobOf(100_000, 2) })).status, 200, 'an update is never blocked by the meter');
  assert.ok(meter() > max);
  assert.equal(meter(), sumBytes());
  const health = await (await h.call('GET', '/api/health')).json();
  assert.equal(health.vault, 'on'); assert.equal(health.vaultFull, true);
  assert.doesNotMatch(JSON.stringify(health), new RegExp(String(meter())), 'never the meter value');
  // the owner hears it once a month at 70%
  const n = rows(h.env, "SELECT * FROM notices WHERE kind = 'owner:vault:70'");
  assert.equal(n.length, 1);
  assert.equal(JSON.parse(n[0].params).maxMb, 0.2);
  await flushNotices(h.env);
  assert.match(h.net.log.email.find((m) => m.subject.includes('70%')).text, /VAULT_MAX_MB/);
});

test('health: vault on and not full by default; VAULT="off" answers 503 vault_off, except for deleting', async () => {
  h = await setup();
  const hl = await (await h.call('GET', '/api/health')).json();
  assert.equal(hl.vault, 'on'); assert.equal(hl.vaultFull, false);
  const t = token();
  await put(t, { ifRev: null, blob: blobOf(100) });
  h.env.VAULT = 'off';
  for (const r of [await put(token(), { ifRev: null, blob: blobOf(100) }), await put(t, { ifRev: 1, blob: blobOf(100) }), await get(t), await rev(t)]) {
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, 'vault_off');
  }
  assert.equal((await (await h.call('GET', '/api/health')).json()).vault, 'off');
  assert.deepEqual(await (await del(t)).json(), { deleted: 1 }, 'stopping a backup really deletes it, even with the switch off');
});

test('the blob is bounded: 349,526 characters are stored (bound, not inlined), one more is 413; a bad shape is 400', async () => {
  h = await setup();
  const t = token();
  const big = blobOf(BLOB_MAX, 5);
  const ok = await put(t, { ifRev: null, blob: big });
  assert.equal(ok.status, 200);
  assert.equal((await (await get(t)).json()).blob, big);
  assert.equal(one(h.env, 'SELECT length(blob) AS n FROM vaults').n, BLOB_MAX);
  const over = await put(token(), { ifRev: null, blob: blobOf(BLOB_MAX + 1) });
  assert.equal(over.status, 413);
  assert.equal((await over.json()).error, 'too_large');
  assert.equal((await put(token(), { ifRev: null, blob: blobOf(500_000) })).status, 413, 'a body over the limit is refused before it is parsed');
  const bad = [
    [token(), { ifRev: null, blob: blobOf(39) }],
    [token(), { ifRev: null, blob: `${blobOf(60)}+/=` }],
    [token(), { ifRev: null, blob: 12345 }],
    [token(), { ifRev: 0, blob: blobOf(60) }],
    [token(), { ifRev: '1', blob: blobOf(60) }],
    [token(), { blob: blobOf(60) }],
    ['abc', { ifRev: null, blob: blobOf(60) }],
    [`${token()}0`, { ifRev: null, blob: blobOf(60) }],
  ];
  for (const [tk, b] of bad) {
    const r = await put(tk, b);
    assert.equal(r.status, 400, JSON.stringify(b).slice(0, 60));
    assert.equal((await r.json()).error, 'bad_vault');
  }
  assert.equal((await h.call('GET', '/api/vault')).status, 400, 'no X-Vault');
  assert.equal(rows(h.env, 'SELECT * FROM vaults').length, 1);
});

test('delete removes the vault and lowers the meter; forgetVault gives the same statements for one batch (escrows included)', async () => {
  h = await setup();
  const a = token(); const b = token();
  await put(a, { ifRev: null, blob: blobOf(300) });
  await put(a, { ifRev: 1, blob: blobOf(400) });
  await put(b, { ifRev: null, blob: blobOf(250) });
  assert.equal(meter(), 950);
  assert.deepEqual(await (await del(a)).json(), { deleted: 1 });
  assert.equal(meter(), 250);
  assert.deepEqual(await (await del(a)).json(), { deleted: 0 });
  assert.equal((await rev(a)).status, 410, 'deleted by its owner: the tombstone says so');
  assert.equal(countOf(h.env, `vault:miss:n:${await netOf(h.env, IP)}`), 2, 'a delete that finds nothing is a miss');
  // TRUST-6's "delete everything" puts these into its one batch
  const req = new Request('https://madregot.test/api/me/forget', { method: 'POST', headers: { 'X-Vault': b } });
  const stmts = await forgetVault(h.env, req);
  assert.equal(stmts.length, 4, 'the meter, the vault, its escrows (escrow.test.js) and its tombstone');
  await h.env.DB.batch(stmts);
  assert.equal(rows(h.env, 'SELECT * FROM vaults').length, 0);
  assert.equal(meter(), 0);
  assert.deepEqual(await forgetVault(h.env, new Request('https://madregot.test/x', { method: 'POST' })), []);
  assert.deepEqual(await forgetVault(h.env, new Request('https://madregot.test/x', { method: 'POST', headers: { 'X-Vault': 'nope' } })), []);
});

test('read_at is written by both reads at most once a day, and retention counts it: 399 days kept, 401 deleted', async () => {
  h = await setup();
  const t = token();
  await put(t, { ifRev: null, blob: blobOf(100) });
  let writes = 0;
  const prepare = h.env.DB.prepare;
  h.env.DB.prepare = (sql) => { if (/^\s*UPDATE vaults SET read_at/.test(sql)) writes++; return prepare(sql); };
  await get(t); await rev(t); await get(t); await rev(t);
  assert.equal(writes, 1, 'once today');
  const first = one(h.env, 'SELECT read_at FROM vaults').read_at;
  assert.ok(first);
  advanceClock(DAY);
  await rev(t); await rev(t);
  assert.equal(writes, 2, 'once again the next day');
  assert.ok(one(h.env, 'SELECT read_at FROM vaults').read_at > first);
  h.env.DB.prepare = prepare;

  // the purge, with the clock where it is now
  const now = new Date();
  const ago = (d) => new Date(now.getTime() - d * DAY).toISOString();
  const mk = async (updated, read) => {
    const k = token();
    await put(k, { ifRev: null, blob: blobOf(1000) });
    h.env.DB.raw.prepare('UPDATE vaults SET updated_at = ?, read_at = ? WHERE id_hash = ?').run(updated, read, await sha256(k));
    return sha256(k);
  };
  const kept = await mk(ago(399), null);
  const gone = await mk(ago(401), null);
  const readLately = await mk(ago(700), ago(10));
  const readLongAgo = await mk(ago(700), ago(401));
  const r = await vaultNight(h.env, now);
  assert.equal(r.purged, 2);
  const left = rows(h.env, 'SELECT id_hash FROM vaults').map((x) => x.id_hash);
  assert.ok(left.includes(kept) && left.includes(readLately));
  assert.ok(!left.includes(gone) && !left.includes(readLongAgo));
  assert.equal(meter(), sumBytes());
  assert.equal(r.drift, 0, 'the purge took the bytes off the meter itself');
});

test('the night job runs in the 03:00 hour, recomputes a drifted meter and tells the owner; the summary counts the vaults', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const t = token();
  await put(t, { ifRev: null, blob: blobOf(2000) });
  await put(token(), { ifRev: null, blob: blobOf(1000) });
  h.env.DB.raw.prepare("UPDATE meters SET value = 12345 WHERE name = 'vault_bytes'").run();
  const report = await run(h.env, { now: night() });
  assert.deepEqual(report.vaults, { purged: 0, drift: 3000 - 12345 });
  assert.equal(meter(), 3000);
  const day = dayOf(night());
  const n = one(h.env, 'SELECT * FROM notices WHERE kind = ?', `owner:vault_drift:${day}`);
  assert.deepEqual(JSON.parse(n.params), { day, was: 12345, now: 3000 });
  const mail = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] מונה הגיבויים תוקן'));
  assert.ok(mail);
  // tomorrow night's summary covers today, when both vaults were created
  const s = await dailySummary(h.env, new Date(Date.now() + DAY));
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${s.day}`).params);
  assert.deepEqual(p.vaults, { count: 2, mb: 0, newYesterday: 2 });
  await flushNotices(h.env);
  assert.match(h.net.log.email.find((m) => m.subject.includes(`סיכום יומי ${s.day}`)).text, /גיבויים מוצפנים: 2 \(0 MB\) · חדשים: 2/);
  // not in other hours
  h.env.DB.raw.prepare("UPDATE meters SET value = 1 WHERE name = 'vault_bytes'").run();
  const noon = new Date(night().getTime() + 9 * 3600_000);
  assert.equal((await run(h.env, { now: noon })).vaults, undefined);
  assert.equal(meter(), 1);
});

test('VAULT_RL: with no binding the routes work; a refusing binding answers 429 slow_down before any database call', async () => {
  h = await setup();
  const t = token();
  assert.equal((await put(t, { ifRev: null, blob: blobOf(100) })).status, 200);
  const keys = [];
  let refuse = true;
  h.env.VAULT_RL = { limit: async ({ key }) => { keys.push(key); return { success: !refuse }; } };
  let calls = 0;
  const { prepare, batch } = h.env.DB;
  h.env.DB.prepare = (sql) => { calls++; return prepare(sql); };
  h.env.DB.batch = (l) => { calls++; return batch(l); };
  const cls = { Authorization: `Bearer ${'ab'.repeat(24)}` };
  for (const r of [await put(t, { ifRev: 1, blob: blobOf(100) }), await get(t), await rev(t, { headers: cls }), await del(t)]) {
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, 'slow_down');
  }
  assert.equal(calls, 0, 'nothing reached the database');
  assert.equal(keys.length, 4);
  const net = await netOf(h.env, IP);
  assert.deepEqual(keys.filter((k) => k.startsWith('n:')), [`n:${net}`, `n:${net}`, `n:${net}`]);
  assert.match(keys[2], /^c:[0-9a-f]{32}$/, 'a credential gets its own bucket (a school is not one bucket)');
  refuse = false;
  assert.equal((await rev(t)).status, 200);
  h.env.DB.prepare = prepare; h.env.DB.batch = batch;
});

test('CORS allows the X-Vault header; no table holds the lookup token or the address a request came from', async () => {
  h = await setup();
  const pre = await h.call('OPTIONS', '/api/vault', { headers: { Origin: 'http://localhost:5173' } });
  assert.match(pre.headers.get('Access-Control-Allow-Headers'), /\bX-Vault\b/);
  const cls = await makeClass(h, { students: ['נועה'] });
  const t = token(); const u = token();
  await put(t, { ifRev: null, blob: blobOf(200) });
  await put(t, { ifRev: 1, blob: blobOf(220) });
  await put(u, { ifRev: null, blob: blobOf(200) }, { headers: bearer(cls.students[0]) });
  await get(t); await rev(u, { headers: bearer(cls.students[0]) }); await rev(token()); await del(token());
  const db = h.env.DB.raw;
  const found = [];
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    for (const row of db.prepare(`SELECT * FROM "${name}"`).all()) {
      const text = JSON.stringify(row);
      for (const needle of [t, u, IP]) if (text.includes(needle)) found.push(`${name}: ${needle.slice(0, 12)}`);
    }
  }
  assert.deepEqual(found, []);
  assert.ok(rows(h.env, 'SELECT * FROM vaults').length === 2);
});
