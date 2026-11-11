// The encrypted backup vault (DURABLE-5). The server keeps ciphertext and the SHA-256 of a lookup token, nothing else:
// no address, no device id, no name. The app derives the AES key and the 64-hex lookup token from the restore code on
// the device (PBKDF2); the key and the code never reach the server, so nobody here can open a vault.
//
//   POST /api/vault         X-Vault: <64 hex>, { ifRev: null | n, blob } → 200 { rev, updatedAt }
//        ifRev null creates: 409 vault_conflict { rev } when the vault exists, 503 vault_full when the size meter is full.
//        ifRev n updates by compare-and-swap: 409 vault_conflict { rev } when the vault moved on, 404 vault_gone when it
//        is not there any more because it expired (the app creates it again).
//        Both answer 410 vault_deleted when its owner deleted it (a tombstone, below): the app turns its backup off.
//        A write that carries an X-Family-Device token the server no longer knows (the parent unlinked the device) is
//        401 not_linked with X-AI-Linked: 0, before anything is written: the app then moves to a new code (DURABLE-6).
//        Also 400 bad_vault, 413 too_large (blob over 349,526 characters), 429 too_many_vaults | too_many_tries | slow_down.
//   GET  /api/vault         → 200 { rev, blob, updatedAt } · 404 vault_not_found · 410 vault_deleted · 429 too_many_tries
//   GET  /api/vault/rev     → 200 { rev, updatedAt } · the same errors
//   POST /api/vault/delete  → 200 { deleted: 0 | 1 }, and the tombstone (also when nothing was there to delete)
//   VAULT = "off" answers 503 vault_off (deleting still works: stopping a backup must really delete it). The VAULT_RL
//   binding is checked before any database call (429 slow_down); with no binding the check is skipped.
//
// Caps (atomic, util.js take()), shaped so that a school behind one address is never blocked:
//   vault:miss:<who>    20 lookups that find nothing, a day. <who> is s:<student> or fd:<family device> when the request
//                       carries a valid credential, else n:<net>. Taken before the lookup and given back on a hit (the
//                       PIN pattern), so only misses add up and parallel guesses cannot pass it. Updates and deletes
//                       count too: their answer would otherwise tell whether a vault exists.
//   vault:new:n:<net>   60 creates a day from one network, for requests with no credential
//   vault:new:i:<who>   3 creates a day for one class student or family device (a credential costs nothing to make: a
//                       class needs no sign-in, so one person can hold many)
//   vault:new:in:<net>  600 creates a day from one network by credentialed callers (a school's busiest day of joins)
//   vault:newkb:<net>   20 MiB of new vaults a day from one network, credential or not (counted in KiB)
//   vault:new:all       5,000 creates a day in all
//   vault:w:<id16>      300 writes a day to one vault
// So one network moves the size meter by at most 20 MiB a day, and one student or device by at most 3 blobs.
// The size meter (meters.vault_bytes) changes in the same batch as the vault row, under the same guard, so both apply or
// neither. Creates stop at VAULT_MAX_MB; updates of existing vaults go on. Every night (cron.js) vaults nobody wrote or
// read for 400 days are deleted, the meter is recomputed from SUM(bytes) (a drift becomes an owner notice), and the
// owner hears once a month when the vaults pass 70% of the limit, and again at 90%.
//
// Tombstones (vault_tombstones): "להפסיק את הגיבוי" and "delete everything" delete the vault and keep its id_hash with
// the time, nothing else, for 400 days. Another device with the same code then hears 410 vault_deleted on every route
// and turns its backup off, instead of making the copy again; a typed code that was deleted says so on the Restore
// screen. Only a vault that expired (no tombstone) is made again.
//
// Escrow (DURABLE-6): the restore code, sealed with a Worker secret (AES-GCM under HKDF(VAULT_SECRET, 'escrow-v1'),
// with the owner as additional data), attached to an identity the user already has, so that identity can get the code
// back: a class student by joining again with the PIN, a family by linking a new device.
//   POST /api/vault/escrow         Bearer <student> or X-Family-Device, { code, lookup } → 200 { escrow: 'class' | 'family' }
//        The vault must exist (404 vault_not_found). One escrow per student, one per family device (upserted).
//        Without VAULT_SECRET: 503 server_config (joining and linking go on without escrow); VAULT = "off": 503 vault_off.
//   POST /api/vault/escrow/delete  the same identity, {} → 200 { deleted } (works with no secret and with VAULT off)
// The code itself is never returned to a teacher or a parent, and never logged; only joinClass (the student, after the
// PIN) and a family link that continues from a kept escrow return it, to the device itself. The server cannot check
// that the code opens the vault (that needs the slow PBKDF2 on the device); a wrong pair only harms its own owner.
import {
  nowIso, dayOf, monthOf, json, HttpError, body, sha256, randomToken, netKey, take, key, giveBack, startOfDayIso, CODE_ALPHABET,
} from './util.js';
import { studentFrom, familyDeviceFrom } from './entitle.js';
import { ownerNotice, queueNotices } from './spend.js';

export const VAULT_KEEP_DAYS = 400;
export const BLOB_MIN = 40;
export const BLOB_MAX = 349_526; // base64url of 256 KiB
export const BODY_MAX = 350 * 1024; // the largest blob and its JSON around it
export const MISS_DAILY = 20;
export const NEW_NET_DAILY = 60;
export const NEW_ALL_DAILY = 5000;
export const NEW_ID_DAILY = 3;
export const NEW_ID_NET_DAILY = 600;
export const NEW_NET_KB_DAILY = 20 * 1024;
export const WRITES_DAILY = 300;
export const DEFAULT_MAX_MB = 200;
export const NOTICE_SHARE = 0.7;
export const NOTICE_SHARES = [0.7, 0.9];
const MiB = 1024 * 1024;
const DAY = 864e5;
const TOKEN = /^[0-9a-f]{64}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;

/** The kill switch: anything but "off" is on. */
export const vaultOn = (env) => String(env.VAULT ?? 'on').trim().toLowerCase() !== 'off';
/** VAULT_MAX_MB in bytes (MiB). Raise it only on Workers Paid: the same database holds billing. */
export function maxBytes(env) {
  const mb = Number(env.VAULT_MAX_MB);
  return Math.floor((Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_MB) * MiB);
}

/** The lookup token from X-Vault (64 hex), or null. */
function lookupOf(req) {
  const t = String(req.headers.get('X-Vault') || '').trim().toLowerCase();
  return TOKEN.test(t) ? t : null;
}
/** The credential a request presents (not yet checked): a class student's Bearer token or a family device's token. */
function credentialOf(req) {
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return bearer || String(req.headers.get('X-Family-Device') || '').trim() || null;
}

/**
 * Workers Rate Limiting (VAULT_RL): a burst filter that writes nothing to the database, counted by Cloudflare per
 * location and approximate. Keyed by the presented credential (hashed) or else the network, before any database call.
 * The exact limits are the daily counters below.
 */
async function flood(req, env) {
  if (typeof env.VAULT_RL?.limit !== 'function') return;
  const cred = credentialOf(req);
  const k = cred ? `c:${(await sha256(`vault-rl:${cred}`)).slice(0, 32)}` : `n:${await netKey(req, env)}`;
  const { success } = await env.VAULT_RL.limit({ key: k });
  if (!success) throw new HttpError(429, 'slow_down');
}

/** What every vault route checks first: the switch, the header, the burst filter. Returns the vault's id (its hash). */
async function opening(req, env, { evenOff = false } = {}) {
  if (!evenOff && !vaultOn(env)) throw new HttpError(503, 'vault_off');
  const lookup = lookupOf(req);
  if (!lookup) throw new HttpError(400, 'bad_vault');
  await flood(req, env);
  return sha256(lookup);
}

/** Whom the caps count: a valid class student or family device, else the network. */
async function whoOf(req, env) {
  const net = await netKey(req, env);
  const s = await studentFrom(req, env);
  if (s) return { key: `s:${s.id}`, net, anonymous: false };
  const fd = req.headers.get('X-Family-Device');
  if (fd) {
    const d = await familyDeviceFrom(env, fd);
    if (d) return { key: `fd:${d.device_id}`, net, anonymous: false };
    return { key: `n:${net}`, net, anonymous: true, staleFamily: true };
  }
  return { key: `n:${net}`, net, anonymous: true };
}
const missKey = (who) => key(`vault:miss:${who.key}`, MISS_DAILY, { refundable: true, err: new HttpError(429, 'too_many_tries') });
const writeKey = (id) => key(`vault:w:${id.slice(0, 16)}`, WRITES_DAILY, { err: new HttpError(429, 'slow_down') });
const revOf = (env, id) => env.DB.prepare('SELECT rev FROM vaults WHERE id_hash = ?').bind(id).first();
const conflict = (rev) => new HttpError(409, 'vault_conflict', undefined, { rev });
const deletedErr = () => new HttpError(410, 'vault_deleted');
const tombstoned = async (env, id) => !!(await env.DB.prepare('SELECT 1 AS x FROM vault_tombstones WHERE id_hash = ?').bind(id).first());

/**
 * The owner's notice when the vaults pass `share` of VAULT_MAX_MB (0.7, then 0.9), each queued once a month (in the
 * create batch and every night): kinds owner:vault:70 and owner:vault:90.
 */
export function noticeStmt(env, now = new Date(), share = NOTICE_SHARE) {
  const max = maxBytes(env);
  const pct = Math.round(share * 100);
  return env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
    SELECT ?1, ?5, NULL, json_object('mb', round(value / 1048576.0, 1), 'maxMb', ?2, 'pct', ?6), ?3
    FROM meters WHERE name = 'vault_bytes' AND value >= ?4`).bind(monthOf(now), Math.round((max / MiB) * 10) / 10, now.toISOString(), Math.floor(max * share), `owner:vault:${pct}`, pct);
}
const noticeStmts = (env, now) => NOTICE_SHARES.map((x) => noticeStmt(env, now, x));

// ---------------------------------------------------------------- reading
/** GET /api/vault and GET /api/vault/rev. read_at is written at most once a day (retention counts the last read). */
export async function getVault(req, env, cors, { blob = false } = {}) {
  const id = await opening(req, env);
  const miss = missKey(await whoOf(req, env));
  const t = await take(env, [miss]);
  if (!t.ok) throw t.error;
  const row = await env.DB.prepare(`SELECT rev, updated_at, read_at${blob ? ', blob' : ''} FROM vaults WHERE id_hash = ?`).bind(id).first();
  // a deleted vault says so (still a miss: only a holder of the code can ask); an expired one is simply not found
  if (!row) throw (await tombstoned(env, id)) ? deletedErr() : new HttpError(404, 'vault_not_found');
  await giveBack(env, [miss]);
  const today = startOfDayIso(dayOf());
  if (!row.read_at || row.read_at < today) {
    await env.DB.prepare('UPDATE vaults SET read_at = ? WHERE id_hash = ? AND (read_at IS NULL OR read_at < ?)').bind(nowIso(), id, today).run();
  }
  return json(blob ? { rev: row.rev, blob: row.blob, updatedAt: row.updated_at } : { rev: row.rev, updatedAt: row.updated_at }, 200, cors);
}

// ---------------------------------------------------------------- writing
/** POST /api/vault: create (ifRev null) or compare-and-swap update (ifRev n). The blob is always a bound parameter. */
export async function putVault(req, env, cors) {
  const id = await opening(req, env);
  const b = await body(req, BODY_MAX);
  const { blob, ifRev } = b;
  if (typeof blob === 'string' && blob.length > BLOB_MAX) throw new HttpError(413, 'too_large');
  if (typeof blob !== 'string' || blob.length < BLOB_MIN || !B64URL.test(blob)) throw new HttpError(400, 'bad_vault');
  if (!(ifRev === null || (Number.isInteger(ifRev) && ifRev >= 1))) throw new HttpError(400, 'bad_vault');
  const who = await whoOf(req, env);
  // the family let go of this device (the parent unlinked it): nothing is written with its old identity, so the copy the
  // family keeps stops receiving its progress; the app forgets the token and moves to a new code (DURABLE-6)
  if (who.staleFamily) throw new HttpError(401, 'not_linked', undefined, undefined, { 'X-AI-Linked': '0' });
  return ifRev === null ? create(env, cors, id, blob, who) : update(env, cors, id, blob, ifRev, who);
}

async function create(env, cors, id, blob, who) {
  const tooMany = new HttpError(429, 'too_many_vaults');
  const keys = [
    who.anonymous ? key(`vault:new:n:${who.net}`, NEW_NET_DAILY, { refundable: true, err: tooMany }) : null,
    // a credential is cheap to make (a class needs no sign-in): each one, and all of them on one network, are capped too
    who.anonymous ? null : key(`vault:new:i:${who.key}`, NEW_ID_DAILY, { refundable: true, err: tooMany }),
    who.anonymous ? null : key(`vault:new:in:${who.net}`, NEW_ID_NET_DAILY, { refundable: true, err: tooMany }),
    // the bytes one network adds to the size meter in a day, whoever asks
    key(`vault:newkb:${who.net}`, NEW_NET_KB_DAILY, { n: Math.ceil(blob.length / 1024), refundable: true, err: tooMany }),
    // the day's creates in all: beyond it the server cannot take new backups today (the app offers the file instead)
    key('vault:new:all', NEW_ALL_DAILY, { refundable: true, err: new HttpError(503, 'vault_full') }),
    writeKey(id),
  ];
  const t = await take(env, keys);
  if (!t.ok) throw t.error;
  const now = new Date();
  const at = now.toISOString();
  // created_at holds a one-time stamp until the end of the batch, so the meter's guard matches only the row this batch
  // inserted (never a row another request created in the same millisecond)
  const stamp = `${at}#${randomToken(8)}`;
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO vaults (id_hash, rev, blob, bytes, created_at, updated_at)
      SELECT ?1, 1, ?2, length(?2), ?3, ?4 WHERE (SELECT value FROM meters WHERE name = 'vault_bytes') + length(?2) <= ?5
        AND NOT EXISTS (SELECT 1 FROM vault_tombstones WHERE id_hash = ?1)
      ON CONFLICT DO NOTHING RETURNING rev`).bind(id, blob, stamp, at, maxBytes(env)),
    env.DB.prepare(`UPDATE meters SET value = value + (SELECT bytes FROM vaults WHERE id_hash = ?1 AND created_at = ?2 AND rev = 1)
      WHERE name = 'vault_bytes' AND EXISTS (SELECT 1 FROM vaults WHERE id_hash = ?1 AND created_at = ?2 AND rev = 1)`).bind(id, stamp),
    env.DB.prepare('UPDATE vaults SET created_at = ?2 WHERE id_hash = ?1 AND created_at = ?3').bind(id, at, stamp),
    ...noticeStmts(env, now),
  ]);
  if (res[0].results?.length) return json({ rev: 1, updatedAt: at }, 200, cors);
  // nothing was created: the create counters are given back (the day's writes to this vault stay counted)
  await giveBack(env, keys);
  const row = await revOf(env, id);
  if (row) throw conflict(row.rev);
  if (await tombstoned(env, id)) throw deletedErr();
  throw new HttpError(503, 'vault_full');
}

async function update(env, cors, id, blob, ifRev, who) {
  const miss = missKey(who);
  const t = await take(env, [miss, writeKey(id)]);
  if (!t.ok) throw t.error;
  const at = nowIso();
  // The meter first, under the CAS statement's own condition: the new total minus the old one is the new blob minus the
  // prev_blob that is dropped. Then the compare-and-swap; in UPDATE … SET, `blob` on the right is the old value.
  const res = await env.DB.batch([
    env.DB.prepare(`UPDATE meters SET value = value + ?1 - COALESCE((SELECT length(prev_blob) FROM vaults WHERE id_hash = ?2 AND rev = ?3), 0)
      WHERE name = 'vault_bytes' AND EXISTS (SELECT 1 FROM vaults WHERE id_hash = ?2 AND rev = ?3)`).bind(blob.length, id, ifRev),
    env.DB.prepare(`UPDATE vaults SET prev_blob = blob, prev_rev = rev, blob = ?1, rev = rev + 1, bytes = length(?1) + length(blob), updated_at = ?2
      WHERE id_hash = ?3 AND rev = ?4 RETURNING rev`).bind(blob, at, id, ifRev),
  ]);
  const done = res[1].results?.[0];
  if (done) {
    await giveBack(env, [miss]);
    return json({ rev: done.rev, updatedAt: at }, 200, cors);
  }
  const row = await revOf(env, id);
  if (!row) throw (await tombstoned(env, id)) ? deletedErr() : new HttpError(404, 'vault_gone');
  await giveBack(env, [miss]);
  throw conflict(row.rev);
}

// ---------------------------------------------------------------- deleting
/**
 * The statements that delete one vault at its owner's request, take its bytes off the meter, drop its escrows and leave
 * its tombstone (so another device with the code turns its backup off instead of making it again), for one batch.
 */
export const deleteStmts = (env, id) => [
  env.DB.prepare("UPDATE meters SET value = value - COALESCE((SELECT bytes FROM vaults WHERE id_hash = ?), 0) WHERE name = 'vault_bytes'").bind(id),
  env.DB.prepare('DELETE FROM vaults WHERE id_hash = ?').bind(id),
  env.DB.prepare('DELETE FROM vault_escrow WHERE vault_id = ?').bind(id),
  env.DB.prepare('INSERT INTO vault_tombstones (id_hash, deleted_at) VALUES (?1, ?2) ON CONFLICT (id_hash) DO UPDATE SET deleted_at = excluded.deleted_at').bind(id, nowIso()),
];

/** POST /api/vault/delete ("להפסיק את הגיבוי"). Works with VAULT = "off" too. */
export async function deleteVault(req, env, cors) {
  const id = await opening(req, env, { evenOff: true });
  await body(req);
  const miss = missKey(await whoOf(req, env));
  const t = await take(env, [miss]);
  if (!t.ok) throw t.error;
  const res = await env.DB.batch(deleteStmts(env, id));
  const deleted = Number(res[1]?.meta?.changes || 0) > 0;
  if (deleted) await giveBack(env, [miss]);
  return json({ deleted: deleted ? 1 : 0 }, 200, cors);
}

/**
 * For TRUST-6's "delete everything" (POST /api/me/forget, not on this branch yet): the statements that delete the
 * vault named by the request's X-Vault header and its meter bytes, ready to go into that route's one batch. No header
 * (or a malformed one) gives no statements.
 */
export async function forgetVault(env, req) {
  const lookup = lookupOf(req);
  return lookup ? deleteStmts(env, await sha256(lookup)) : [];
}

// ---------------------------------------------------------------- the night job, health and the summary
/**
 * Retention: a vault goes when MAX(updated_at, COALESCE(read_at, updated_at)) is more than 400 days ago, written here
 * as updated_at < cutoff AND (read_at IS NULL OR read_at < cutoff), the same condition in a form the index can use.
 * Its bytes leave the meter in the same batch.
 */
export function purgeVaultsSql(env, now = new Date()) {
  const cutoff = new Date(now.getTime() - VAULT_KEEP_DAYS * DAY).toISOString();
  const stale = 'updated_at < ?1 AND (read_at IS NULL OR read_at < ?1)';
  return [
    env.DB.prepare(`UPDATE meters SET value = value - COALESCE((SELECT SUM(bytes) FROM vaults WHERE ${stale}), 0) WHERE name = 'vault_bytes'`).bind(cutoff),
    env.DB.prepare(`DELETE FROM vaults WHERE ${stale}`).bind(cutoff),
    // an escrow of a vault that is gone opens nothing any more
    env.DB.prepare('DELETE FROM vault_escrow WHERE vault_id NOT IN (SELECT id_hash FROM vaults)'),
    // a tombstone is kept as long as a vault would be
    env.DB.prepare('DELETE FROM vault_tombstones WHERE deleted_at < ?').bind(cutoff),
  ];
}

/**
 * The night's vault work (cron.js, 03:00 Jerusalem): purge, then recompute the meter from SUM(bytes) in one batch
 * (a drift becomes the owner notice owner:vault_drift:<day>), then the 70% and 90% notices.
 */
export async function vaultNight(env, now = new Date()) {
  const purged = Number((await env.DB.batch(purgeVaultsSql(env, now)))[1]?.meta?.changes || 0);
  const r = await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO meters (name, value) VALUES ('vault_bytes', 0)"),
    env.DB.prepare("SELECT value FROM meters WHERE name = 'vault_bytes'"),
    env.DB.prepare('SELECT COALESCE(SUM(bytes), 0) AS n FROM vaults'),
    env.DB.prepare("UPDATE meters SET value = (SELECT COALESCE(SUM(bytes), 0) FROM vaults) WHERE name = 'vault_bytes'"),
  ]);
  const was = Number(r[1].results?.[0]?.value || 0);
  const sum = Number(r[2].results?.[0]?.n || 0);
  const day = dayOf(now);
  if (was !== sum) await queueNotices(env, [ownerNotice(day, `owner:vault_drift:${day}`, { day, was, now: sum })]);
  await env.DB.batch(noticeStmts(env, now));
  return { purged, drift: sum - was };
}

/** For /api/health: true when the largest backup would no longer fit under VAULT_MAX_MB (never the meter's value). */
export async function vaultFull(env) {
  try {
    const r = await env.DB.prepare("SELECT value FROM meters WHERE name = 'vault_bytes'").first();
    return !r || Number(r.value) + BLOB_MAX > maxBytes(env);
  } catch { return null; }
}

/** The owner's daily summary: how many vaults, their size in MB, and how many were created on the day. */
export async function vaultStats(env, startIso, endIso) {
  try {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b,
      COALESCE(SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END), 0) AS fresh FROM vaults`).bind(startIso, endIso).first();
    return { count: Number(r?.n || 0), mb: Math.round((Number(r?.b || 0) / MiB) * 10) / 10, newYesterday: Number(r?.fresh || 0) };
  } catch { return null; }
}

// ---------------------------------------------------------------- escrow (DURABLE-6)
export const ESCROW_DAILY = 30; // escrow writes a day per student or family device
export const SEALED_MAX = 200;
const enc = new TextEncoder();
const CODE16 = new RegExp(`^[${CODE_ALPHABET}]{16}$`);
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function unb64url(text) {
  const s = atob(String(text).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(text).length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** A restore code as the app makes it: 16 symbols of the class-code alphabet, the last one Σ (i+1)·v_i mod 31 of the others. */
export function codeOk(code) {
  if (typeof code !== 'string' || !CODE16.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) sum += (i + 1) * CODE_ALPHABET.indexOf(code[i]);
  return CODE_ALPHABET[sum % CODE_ALPHABET.length] === code[15];
}

const keys = new Map();
/** The escrow key: HKDF-SHA-256 of VAULT_SECRET with the info 'escrow-v1' (no salt), as an AES-256-GCM key. */
function escrowKey(env) {
  const secret = env.VAULT_SECRET;
  if (!secret) throw new HttpError(503, 'server_config');
  if (!keys.has(secret)) {
    keys.set(secret, (async () => {
      const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('escrow-v1') }, base,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    })());
  }
  return keys.get(secret);
}
/** The additional data: a sealed code opens only in its own owner's row. */
const aadOf = (kind, owner) => enc.encode(`escrow-v1|${kind}|${owner}`);

/** Seal a restore code for one owner: base64url(0x01 | iv | AES-GCM(code)), 60 characters. */
export async function sealCode(env, code, kind, owner) {
  const k = await escrowKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(kind, owner) }, k, enc.encode(code)));
  const out = new Uint8Array(13 + ct.length);
  out[0] = 1; out.set(iv, 1); out.set(ct, 13);
  return b64url(out);
}
/** The code a sealed escrow holds, or null (no secret, another secret, another owner, or damaged). */
export async function unsealCode(env, sealed, kind, owner) {
  if (!env.VAULT_SECRET || typeof sealed !== 'string') return null;
  try {
    const bytes = unb64url(sealed);
    if (bytes[0] !== 1 || bytes.length <= 13) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(1, 13), additionalData: aadOf(kind, owner) }, await escrowKey(env), bytes.subarray(13));
    const code = new TextDecoder().decode(plain);
    return codeOk(code) ? code : null;
  } catch { return null; }
}

/** The restore code kept for a class student whose vault still exists, or null (joinClass gives it back after the PIN). */
export async function studentEscrowCode(env, studentId) {
  if (!env.VAULT_SECRET) return null;
  const row = await env.DB.prepare(`SELECT e.sealed FROM vault_escrow e JOIN vaults v ON v.id_hash = e.vault_id
    WHERE e.owner_kind = 'student' AND e.owner_id = ?`).bind(studentId).first();
  return row ? unsealCode(env, row.sealed, 'student', studentId) : null;
}
/** The restore code of the escrow a family device syncs now (after a link that continued from it), or null. */
export async function deviceEscrowCode(env, deviceId) {
  if (!env.VAULT_SECRET) return null;
  const row = await env.DB.prepare(`SELECT e.sealed, e.owner_id FROM vault_escrow e JOIN vaults v ON v.id_hash = e.vault_id
    WHERE e.owner_kind = 'account' AND e.device_id = ?`).bind(deviceId).first();
  return row ? unsealCode(env, row.sealed, 'account', row.owner_id) : null;
}

/** Whose escrow a request asks about: a class student (Bearer) or a linked family device (X-Family-Device); else 401. */
async function escrowOwner(req, env) {
  const s = await studentFrom(req, env);
  if (s) return { kind: 'student', owner: s.id, device: null, label: '', who: `s:${s.id}` };
  const fd = req.headers.get('X-Family-Device');
  const d = fd ? await familyDeviceFrom(env, fd) : null;
  if (d) return { kind: 'account', owner: d.account_id, device: d.device_id, label: String(d.label || '').slice(0, 30), who: `fd:${d.device_id}` };
  throw new HttpError(401, 'not_signed_in');
}

/** POST /api/vault/escrow { code, lookup }: keep this vault's code for the student or the family device (upsert). */
export async function putEscrow(req, env, cors) {
  if (!vaultOn(env)) throw new HttpError(503, 'vault_off');
  if (!env.VAULT_SECRET) throw new HttpError(503, 'server_config');
  const b = await body(req);
  const code = String(b.code ?? '');
  const lookup = String(b.lookup ?? '').trim().toLowerCase();
  if (!codeOk(code) || !TOKEN.test(lookup)) throw new HttpError(400, 'bad_vault');
  const o = await escrowOwner(req, env);
  const t = await take(env, [key(`escrow:${o.who}`, ESCROW_DAILY, { err: new HttpError(429, 'slow_down') })]);
  if (!t.ok) throw t.error;
  const vaultId = await sha256(lookup);
  if (!(await env.DB.prepare('SELECT 1 AS ok FROM vaults WHERE id_hash = ?').bind(vaultId).first())) throw new HttpError(404, 'vault_not_found');
  const sealed = await sealCode(env, code, o.kind, o.owner);
  const now = nowIso();
  if (o.kind === 'student') {
    await env.DB.prepare(`INSERT INTO vault_escrow (id, vault_id, owner_kind, owner_id, device_id, label, sealed, created_at, updated_at)
      VALUES (?1, ?2, 'student', ?3, NULL, '', ?4, ?5, ?5)
      ON CONFLICT (owner_id) WHERE owner_kind = 'student' DO UPDATE SET vault_id = excluded.vault_id, sealed = excluded.sealed, updated_at = excluded.updated_at`)
      .bind(randomToken(8), vaultId, o.owner, sealed, now).run();
  } else {
    await env.DB.prepare(`INSERT INTO vault_escrow (id, vault_id, owner_kind, owner_id, device_id, label, sealed, created_at, updated_at)
      VALUES (?1, ?2, 'account', ?3, ?4, ?5, ?6, ?7, ?7)
      ON CONFLICT (device_id) WHERE device_id IS NOT NULL DO UPDATE SET vault_id = excluded.vault_id, sealed = excluded.sealed,
        label = excluded.label, updated_at = excluded.updated_at WHERE vault_escrow.owner_id = excluded.owner_id`)
      .bind(randomToken(8), vaultId, o.owner, o.device, o.label, sealed, now).run();
  }
  return json({ escrow: o.kind === 'student' ? 'class' : 'family' }, 200, cors);
}

/** POST /api/vault/escrow/delete {}: the student's switch "שמירת עותק בשרת הכיתה" off, or a family device's own escrow. */
export async function deleteEscrow(req, env, cors) {
  await body(req);
  const o = await escrowOwner(req, env);
  const r = o.kind === 'student'
    ? await env.DB.prepare("DELETE FROM vault_escrow WHERE owner_kind = 'student' AND owner_id = ?").bind(o.owner).run()
    : await env.DB.prepare("DELETE FROM vault_escrow WHERE owner_kind = 'account' AND owner_id = ? AND device_id = ?").bind(o.owner, o.device).run();
  return json({ deleted: Number(r.meta?.changes || 0) }, 200, cors);
}

/**
 * The night's sweep of identities (cron.js purge): student tokens unused for 400 days, and tokens and escrows whose
 * student or account is gone (a backstop for any deletion path that forgot them).
 */
export function purgeIdentitySql(env, now = new Date()) {
  const cutoff = new Date(now.getTime() - VAULT_KEEP_DAYS * DAY).toISOString();
  return [
    env.DB.prepare('DELETE FROM student_tokens WHERE last_seen < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM student_tokens WHERE student_id NOT IN (SELECT id FROM students)'),
    env.DB.prepare("DELETE FROM vault_escrow WHERE owner_kind = 'student' AND owner_id NOT IN (SELECT id FROM students)"),
    env.DB.prepare("DELETE FROM vault_escrow WHERE owner_kind = 'account' AND owner_id NOT IN (SELECT id FROM accounts)"),
  ];
}
