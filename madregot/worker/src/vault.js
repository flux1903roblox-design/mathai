// The encrypted backup vault (DURABLE-5). The server keeps ciphertext and the SHA-256 of a lookup token, nothing else:
// no address, no device id, no name. The app derives the AES key and the 64-hex lookup token from the restore code on
// the device (PBKDF2); the key and the code never reach the server, so nobody here can open a vault.
//
//   POST /api/vault         X-Vault: <64 hex>, { ifRev: null | n, blob } → 200 { rev, updatedAt }
//        ifRev null creates: 409 vault_conflict { rev } when the vault exists, 503 vault_full when the size meter is full.
//        ifRev n updates by compare-and-swap: 409 vault_conflict { rev } when the vault moved on, 404 vault_gone when it
//        is not there any more (expired or deleted elsewhere: the app creates it again).
//        Also 400 bad_vault, 413 too_large (blob over 349,526 characters), 429 too_many_vaults | too_many_tries | slow_down.
//   GET  /api/vault         → 200 { rev, blob, updatedAt } · 404 vault_not_found · 429 too_many_tries
//   GET  /api/vault/rev     → 200 { rev, updatedAt } · the same errors
//   POST /api/vault/delete  → 200 { deleted: 0 | 1 }
//   VAULT = "off" answers 503 vault_off (deleting still works: stopping a backup must really delete it). The VAULT_RL
//   binding is checked before any database call (429 slow_down); with no binding the check is skipped.
//
// Caps (atomic, util.js take()), shaped so that a school behind one address is never blocked:
//   vault:miss:<who>    20 lookups that find nothing, a day. <who> is s:<student> or fd:<family device> when the request
//                       carries a valid credential, else n:<net>. Taken before the lookup and given back on a hit (the
//                       PIN pattern), so only misses add up and parallel guesses cannot pass it. Updates and deletes
//                       count too: their answer would otherwise tell whether a vault exists.
//   vault:new:n:<net>   60 creates a day from one network, for requests with no credential
//   vault:new:all       5,000 creates a day in all
//   vault:w:<id16>      300 writes a day to one vault
// The size meter (meters.vault_bytes) changes in the same batch as the vault row, under the same guard, so both apply or
// neither. Creates stop at VAULT_MAX_MB; updates of existing vaults go on. Every night (cron.js) vaults nobody wrote or
// read for 400 days are deleted, the meter is recomputed from SUM(bytes) (a drift becomes an owner notice), and the
// owner hears once a month when the vaults pass 70% of the limit.
import { nowIso, dayOf, monthOf, json, HttpError, body, sha256, randomToken, netKey, take, key, giveBack, startOfDayIso } from './util.js';
import { studentFrom, familyDeviceFrom } from './entitle.js';
import { ownerNotice, queueNotices } from './spend.js';

export const VAULT_KEEP_DAYS = 400;
export const BLOB_MIN = 40;
export const BLOB_MAX = 349_526; // base64url of 256 KiB
export const BODY_MAX = 350 * 1024; // the largest blob and its JSON around it
export const MISS_DAILY = 20;
export const NEW_NET_DAILY = 60;
export const NEW_ALL_DAILY = 5000;
export const WRITES_DAILY = 300;
export const DEFAULT_MAX_MB = 200;
export const NOTICE_SHARE = 0.7;
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
  const s = await studentFrom(req, env);
  if (s) return { key: `s:${s.id}`, anonymous: false };
  const fd = req.headers.get('X-Family-Device');
  if (fd) {
    const d = await familyDeviceFrom(env, fd);
    if (d) return { key: `fd:${d.device_id}`, anonymous: false };
  }
  const net = await netKey(req, env);
  return { key: `n:${net}`, net, anonymous: true };
}
const missKey = (who) => key(`vault:miss:${who.key}`, MISS_DAILY, { refundable: true, err: new HttpError(429, 'too_many_tries') });
const writeKey = (id) => key(`vault:w:${id.slice(0, 16)}`, WRITES_DAILY, { err: new HttpError(429, 'slow_down') });
const revOf = (env, id) => env.DB.prepare('SELECT rev FROM vaults WHERE id_hash = ?').bind(id).first();
const conflict = (rev) => new HttpError(409, 'vault_conflict', undefined, { rev });

/** The owner's notice at 70% of VAULT_MAX_MB, queued once a month (in the create batch and every night). */
export function noticeStmt70(env, now = new Date()) {
  const max = maxBytes(env);
  return env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
    SELECT ?1, 'owner:vault:70', NULL, json_object('mb', round(value / 1048576.0, 1), 'maxMb', ?2), ?3
    FROM meters WHERE name = 'vault_bytes' AND value >= ?4`).bind(monthOf(now), Math.round((max / MiB) * 10) / 10, now.toISOString(), Math.floor(max * NOTICE_SHARE));
}

// ---------------------------------------------------------------- reading
/** GET /api/vault and GET /api/vault/rev. read_at is written at most once a day (retention counts the last read). */
export async function getVault(req, env, cors, { blob = false } = {}) {
  const id = await opening(req, env);
  const miss = missKey(await whoOf(req, env));
  const t = await take(env, [miss]);
  if (!t.ok) throw t.error;
  const row = await env.DB.prepare(`SELECT rev, updated_at, read_at${blob ? ', blob' : ''} FROM vaults WHERE id_hash = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'vault_not_found');
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
  return ifRev === null ? create(env, cors, id, blob, who) : update(env, cors, id, blob, ifRev, who);
}

async function create(env, cors, id, blob, who) {
  const keys = [
    who.anonymous ? key(`vault:new:n:${who.net}`, NEW_NET_DAILY, { refundable: true, err: new HttpError(429, 'too_many_vaults') }) : null,
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
      ON CONFLICT DO NOTHING RETURNING rev`).bind(id, blob, stamp, at, maxBytes(env)),
    env.DB.prepare(`UPDATE meters SET value = value + (SELECT bytes FROM vaults WHERE id_hash = ?1 AND created_at = ?2 AND rev = 1)
      WHERE name = 'vault_bytes' AND EXISTS (SELECT 1 FROM vaults WHERE id_hash = ?1 AND created_at = ?2 AND rev = 1)`).bind(id, stamp),
    env.DB.prepare('UPDATE vaults SET created_at = ?2 WHERE id_hash = ?1 AND created_at = ?3').bind(id, at, stamp),
    noticeStmt70(env, now),
  ]);
  if (res[0].results?.length) return json({ rev: 1, updatedAt: at }, 200, cors);
  // nothing was created: the create counters are given back (the day's writes to this vault stay counted)
  await giveBack(env, keys);
  const row = await revOf(env, id);
  if (row) throw conflict(row.rev);
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
  if (!row) throw new HttpError(404, 'vault_gone');
  await giveBack(env, [miss]);
  throw conflict(row.rev);
}

// ---------------------------------------------------------------- deleting
/** The statements that delete one vault and take its bytes off the meter, for one batch. */
export const deleteStmts = (env, id) => [
  env.DB.prepare("UPDATE meters SET value = value - COALESCE((SELECT bytes FROM vaults WHERE id_hash = ?), 0) WHERE name = 'vault_bytes'").bind(id),
  env.DB.prepare('DELETE FROM vaults WHERE id_hash = ?').bind(id),
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
  ];
}

/**
 * The night's vault work (cron.js, 03:00 Jerusalem): purge, then recompute the meter from SUM(bytes) in one batch
 * (a drift becomes the owner notice owner:vault_drift:<day>), then the 70% notice.
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
  await noticeStmt70(env, now).run();
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
