// A child's device joins a family plan the way a TV joins a streaming account (spec §3.3):
//
//   1. the child's device makes a secret and asks for a code       POST /api/family/link/start   {secret}      (X-Device)
//   2. a signed-in parent claims the code                          POST /api/family/link/claim   {code, label, purpose, consent} (X-Account-Token)
//   3. the child's device collects its token, exactly once         POST /api/family/link/finish  {code, secret}
//
// The token (X-Family-Device: fd1.<64 hex>) works for the AI routes, the daily summary for the parents
// (/api/family/summary*, report.js) and the device's own escrow (/api/vault/escrow*, and it names the device for the
// vault's caps), and for nothing in the account; the parent's session never reaches the child's device. On the parent's own phone there is a shortcut: POST /api/family/devices/this makes a token for the device the
// parent is holding and deletes the session that asked, so nothing on that device can change the plan afterwards.
// A family has at most 3 devices. The parent unlinks a device from the parents page; a device can leave by itself.
// Every link is emailed to the parent. Only hashes of codes, secrets and tokens are stored.
//
// A link has a purpose (trust spec TRUST-9 §3). 'plan' needs a live family plan (402 needs_subscription without one).
// 'consent' is the parent's free, one-time OK for the tutor on this child's device: no plan, but `consent: true` (the
// parent ticked "I am the parent or guardian, and I approve"), else 400 consent_required. With no purpose given it is
// 'plan' when the account has a live plan and 'consent' when it has none. Either way the device row is the same: it
// gets the free taste (free:fd:<id>) until the account has a plan, and then the plan's limits with no new link. The
// purpose goes into the audit row and picks the email (a consent email carries the AI and privacy summary).
//
// Escrow (DURABLE-6): each linked device can keep its backup code with the account (vault.js). Unlinking or leaving
// keeps that escrow in the account (device_id NULL: "התקדמות שמורה"), in the same batch, before the device row goes.
// The device's daily summaries (PARENTS-3, family_daily) are deleted in that batch too: after the escrow is detached and
// before the device row, explicitly, although the foreign key would cascade.
// Linking a new device can continue from one: claim (or devices/this) with restoreFrom: <escrow id> of this account;
// the finish that hands over the token also points the escrow at the new device and returns vault: { code }.
// GET /api/family/vaults lists the account's escrows (never the code); POST /api/family/vaults/:id/delete deletes one.
import {
  HttpError, body, json, sha256, hmacHex, randomToken, randomFrom, CODE_ALPHABET, nowIso, dayOf, netKey, devKey, key, take, limitOrThrow, safeEqual,
} from './util.js';
import { requireAccount } from './account.js';
import { deviceFrom, liveFamily, limits } from './entitle.js';
import { flushNotices } from './email.js';
import { deviceEscrowCode } from './vault.js';

export const LINK_TTL_MIN = 60;
/** Once claimed, the child's device has at least this long to collect its token. */
export const COLLECT_MIN = 15;
export const LINK_LIMITS = { device: 10, net: 200, pollCode: 400, pollNet: 5000, claim: 20 };
const SMALL = 4096;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

const publicBase = (req, env) => String(env.PUBLIC_URL || '').replace(/\/+$/, '') || new URL(req.url).origin;
/** A code as typed: upper case, spaces and dashes dropped. null unless it is 6 symbols of the code alphabet. */
export function normCode(v) {
  const c = String(v ?? '').toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(c) ? c : null;
}
/** A device label chosen by the parent: plain text, at most 30 characters. */
export const cleanLabel = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
function linkHash(env, code) {
  if (!env.AUTH_SECRET) throw new HttpError(503, 'server_config');
  return hmacHex(env.AUTH_SECRET, code);
}
const newDeviceToken = () => `fd1.${randomToken(32)}`;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];

// A device counts against the limit once it holds a token, or while a claimed code for it can still be collected.
const IN_USE = `d.account_id = ?1 AND (d.token_hash IS NOT NULL OR EXISTS (
  SELECT 1 FROM link_codes l WHERE l.device_id = d.id AND l.collected_at IS NULL AND l.expires_at > ?2))`;
const devicesInUse = (env, accountId, now) => first(env, `SELECT COUNT(*) AS n FROM family_devices d WHERE ${IN_USE}`, accountId, now).then((r) => Number(r?.n || 0));
/** 409 device_limit with every device that counts, so the parent can choose one to unlink (pending: claimed, not yet collected). */
async function deviceLimitError(env, accountId) {
  const devices = (await all(env, `SELECT d.id, d.label, d.created_at, d.last_seen, d.token_hash IS NULL AS pending FROM family_devices d
    WHERE ${IN_USE} ORDER BY d.created_at`, accountId, nowIso()))
    .map((d) => ({ id: d.id, label: d.label, linkedAt: d.created_at, lastSeen: d.last_seen, ...(d.pending ? { pending: true } : {}) }));
  return new HttpError(409, 'device_limit', undefined, { devices, maxDevices: limits(env).family.devices });
}

// The notice and audit rows of a new device, written only when the device row exists (the same batch inserts it).
const linkedNoticeStmt = (env, { id, accountId, label, at, purpose }) => env.DB.prepare(
  `INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
   SELECT ?1, 'device_linked:' || ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM family_devices WHERE id = ?1)`,
).bind(id, accountId, JSON.stringify({ label, at, purpose }), at);
const linkedAuditStmt = (env, { id, accountId, at, how, purpose }) => env.DB.prepare(
  `INSERT INTO audit_log (at, actor, action, target, detail)
   SELECT ?1, ?2, 'device.link', ?3, ?4 WHERE EXISTS (SELECT 1 FROM family_devices WHERE id = ?5)`,
).bind(at, `account:${accountId}`, `device:${id}`, JSON.stringify({ how, purpose }), id);

// ---------------------------------------------------------------- the child's device
/** POST /api/family/link/start {secret}: a 6-character code for the parent, valid 60 minutes. 10 a day per device, 200 per network. */
export async function linkStart(req, env, cors) {
  const b = await body(req, SMALL);
  const device = await deviceFrom(req, env);
  if (!device) throw new HttpError(400, 'need_device');
  const secret = String(b.secret ?? '');
  if (!/^[a-f0-9]{32}$/.test(secret)) throw new HttpError(400, 'bad_secret');
  if (!env.AUTH_SECRET) throw new HttpError(503, 'server_config');
  const net = await netKey(req, env);
  const tooMany = new HttpError(429, 'too_many_links');
  const r = await take(env, [key(`link:d:${await devKey(env, device)}`, LINK_LIMITS.device, { err: tooMany }), key(`link:n:${net}`, LINK_LIMITS.net, { err: tooMany })]);
  if (!r.ok) throw r.error;
  const now = nowIso();
  const expiresAt = new Date(Date.parse(now) + LINK_TTL_MIN * 60_000).toISOString();
  const secretHash = await sha256(secret);
  for (let i = 0; i < 5; i++) {
    const code = randomFrom(CODE_ALPHABET, 6);
    try {
      await env.DB.prepare('INSERT INTO link_codes (code_hash, secret_hash, device_hint, created_at, expires_at) VALUES (?, ?, NULL, ?, ?)')
        .bind(await linkHash(env, code), secretHash, now, expiresAt).run();
      return json({ code, expiresAt, url: `${publicBase(req, env)}/parents/link?c=${code}` }, 201, cors);
    } catch (e) { if (!/UNIQUE|PRIMARY KEY/.test(String(e?.message))) throw e; }
  }
  throw new HttpError(500, 'code_collision');
}

/**
 * POST /api/family/link/finish {code, secret}: the child's device asks whether the parent claimed its code. Once claimed,
 * the token is made here and returned exactly once. 400 polls per code and 5000 per network a day.
 */
export async function linkFinish(req, env, cors) {
  const b = await body(req, SMALL);
  const code = normCode(b.code);
  const secret = String(b.secret ?? '');
  const net = await netKey(req, env);
  const ch = code ? await linkHash(env, code) : null;
  const slow = new HttpError(429, 'slow_down');
  const r = await take(env, [
    ch && key(`linkpoll:${ch.slice(0, 16)}`, LINK_LIMITS.pollCode, { err: slow }),
    key(`linkpoll:n:${net}`, LINK_LIMITS.pollNet, { err: slow }),
  ]);
  if (!r.ok) throw r.error;
  if (!ch || !/^[a-f0-9]{32}$/.test(secret)) throw new HttpError(404, 'link_not_found');
  const row = await first(env, 'SELECT * FROM link_codes WHERE code_hash = ?', ch);
  // a wrong secret looks exactly like a code that does not exist
  if (!row || !safeEqual(row.secret_hash, await sha256(secret))) throw new HttpError(404, 'link_not_found');
  const now = nowIso();
  if (row.collected_at || row.expires_at <= now) throw new HttpError(410, 'link_expired');
  if (!row.claimed_at || !row.device_id) return json({ state: 'waiting' }, 202, cors);

  const token = newDeviceToken();
  const tokenHash = await sha256(token);
  const res = await env.DB.batch([
    env.DB.prepare('UPDATE link_codes SET collected_at = ? WHERE code_hash = ? AND collected_at IS NULL AND claimed_at IS NOT NULL AND expires_at > ? RETURNING device_id')
      .bind(now, ch, now),
    env.DB.prepare(`UPDATE family_devices SET token_hash = ?, last_seen = ? WHERE id = ? AND token_hash IS NULL
      AND EXISTS (SELECT 1 FROM link_codes WHERE code_hash = ? AND collected_at = ?)`).bind(tokenHash, dayOf(), row.device_id, ch, now),
    // the parent chose to continue from kept progress: that escrow now belongs to this device (only once the token is handed over)
    moveEscrowStmt(env, { escrowId: row.restore_escrow, accountId: row.account_id, deviceId: row.device_id, tokenHash, at: now }),
  ]);
  if (res[0].results?.length !== 1 || Number(res[1].meta?.changes) !== 1) throw new HttpError(410, 'link_expired');
  const dev = await first(env, 'SELECT label FROM family_devices WHERE id = ?', row.device_id);
  const kept = row.restore_escrow ? await deviceEscrowCode(env, row.device_id) : null;
  return json({ deviceToken: token, label: dev?.label || '', ...(kept ? { vault: { code: kept } } : {}) }, 200, cors);
}

/**
 * Point an escrow of this account at a device that has just received its token (in the same batch as the token):
 * nothing when there is no escrow to move, it is not this account's, or the token was not handed over.
 */
function moveEscrowStmt(env, { escrowId, accountId, deviceId, tokenHash, at }) {
  return env.DB.prepare(`UPDATE vault_escrow SET device_id = ?1, updated_at = ?2
    WHERE id = ?3 AND owner_kind = 'account' AND owner_id = ?4 AND EXISTS (SELECT 1 FROM family_devices WHERE id = ?1 AND account_id = ?4 AND token_hash = ?5)`)
    .bind(deviceId, at, escrowId ?? '', accountId ?? '', tokenHash);
}

/** restoreFrom on a claim: an escrow id of this account (404 escrow_not_found otherwise), or null when none was asked for. */
async function restoreFromOf(env, b, accountId) {
  if (b.restoreFrom == null || b.restoreFrom === '') return null;
  const id = String(b.restoreFrom);
  const ok = /^[a-f0-9]{16}$/.test(id)
    && await first(env, "SELECT id FROM vault_escrow WHERE id = ? AND owner_kind = 'account' AND owner_id = ?", id, accountId);
  if (!ok) throw new HttpError(404, 'escrow_not_found');
  return id;
}

/** POST /api/family/devices/leave {} with X-Family-Device: the device unlinks itself (also before "delete all data"). */
export async function leaveFamily(req, env, cors) {
  await body(req, SMALL);
  const token = String(req.headers.get('X-Family-Device') || '');
  if (!/^fd1\.[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'need_device');
  const dev = await first(env, 'SELECT id, account_id FROM family_devices WHERE token_hash = ?', await sha256(token));
  if (dev) {
    await env.DB.batch([
      // the device's escrow stays with the account ("התקדמות שמורה"), before the device row goes
      env.DB.prepare('UPDATE vault_escrow SET device_id = NULL WHERE device_id = ?').bind(dev.id),
      // its daily summaries for the parents go with it (PARENTS-3)
      env.DB.prepare('DELETE FROM family_daily WHERE device_id = ?').bind(dev.id),
      env.DB.prepare('DELETE FROM family_devices WHERE id = ?').bind(dev.id),
      env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
        .bind(nowIso(), `device:${dev.id}`, 'device.unlink', `device:${dev.id}`, JSON.stringify({ by: 'device' })),
    ]);
  }
  // the same answer for a device that had already left
  return json({ ok: true }, 200, cors);
}

// ---------------------------------------------------------------- the parent (X-Account-Token)
async function requireLivePlan(env, accountId) {
  if (!(await liveFamily(env, accountId))) throw new HttpError(402, 'needs_subscription');
}
export const LINK_PURPOSES = Object.freeze(['plan', 'consent']);
/**
 * Why this device is being linked (TRUST-9 §3): 'plan' (needs a live plan) or 'consent' (needs the parent's tick).
 * With no purpose, 'plan' when the account has a live plan, else 'consent'.
 */
async function linkPurpose(env, accountId, b) {
  const purpose = LINK_PURPOSES.includes(b.purpose) ? b.purpose : (await liveFamily(env, accountId)) ? 'plan' : 'consent';
  if (purpose === 'plan') await requireLivePlan(env, accountId);
  else if (b.consent !== true) throw new HttpError(400, 'consent_required');
  return purpose;
}

/**
 * POST /api/family/link/claim {code, label?, purpose?, consent?}: a signed-in parent claims a child's code, for the
 * family plan or as the free one-time OK for the tutor (see linkPurpose).
 */
export async function linkClaim(req, env, ctx, cors) {
  const a = await requireAccount(req, env);
  const b = await body(req, SMALL);
  await limitOrThrow(env, `claim:a:${a.id}`, LINK_LIMITS.claim, 429, 'too_many_links');
  const purpose = await linkPurpose(env, a.id, b);
  const code = normCode(b.code);
  if (!code) throw new HttpError(404, 'link_not_found');
  const ch = await linkHash(env, code);
  const label = cleanLabel(b.label);
  const restore = await restoreFromOf(env, b, a.id);
  const now = nowIso();
  const row = await first(env, 'SELECT * FROM link_codes WHERE code_hash = ?', ch);
  if (!row) throw new HttpError(404, 'link_not_found');
  const claimed = async (r) => {
    // the same parent again (a refreshed page): the same answer
    if (r.account_id === a.id && r.device_id) {
      const d = await first(env, 'SELECT id, label FROM family_devices WHERE id = ?', r.device_id);
      if (d) return json({ ok: true, device: { id: d.id, label: d.label } }, 200, cors);
    }
    throw new HttpError(409, 'link_used');
  };
  if (row.claimed_at) return claimed(row);
  if (row.expires_at <= now) throw new HttpError(410, 'link_expired');
  const max = limits(env).family.devices;
  if ((await devicesInUse(env, a.id, now)) >= max) throw await deviceLimitError(env, a.id);

  const id = randomToken(8);
  const collectBy = new Date(Date.now() + COLLECT_MIN * 60_000).toISOString();
  const res = await env.DB.batch([
    // all four are conditional, so two claims at once (of one code, or of two codes against the last free place) never both win
    env.DB.prepare(`INSERT INTO family_devices (id, account_id, token_hash, label, created_at, last_seen)
      SELECT ?3, ?1, NULL, ?4, ?2, ?5 WHERE EXISTS (SELECT 1 FROM link_codes WHERE code_hash = ?6 AND claimed_at IS NULL AND expires_at > ?2)
      AND (SELECT COUNT(*) FROM family_devices d WHERE ${IN_USE}) < ?7`).bind(a.id, now, id, label, dayOf(), ch, max),
    env.DB.prepare(`UPDATE link_codes SET account_id = ?, device_id = ?, claimed_at = ?, expires_at = MAX(expires_at, ?), restore_escrow = ?
      WHERE code_hash = ? AND claimed_at IS NULL AND EXISTS (SELECT 1 FROM family_devices WHERE id = ?)`).bind(a.id, id, now, collectBy, restore, ch, id),
    linkedNoticeStmt(env, { id, accountId: a.id, label, at: now, purpose }),
    linkedAuditStmt(env, { id, accountId: a.id, at: now, how: 'code', purpose }),
  ]);
  if (Number(res[0].meta?.changes) !== 1) {
    const again = await first(env, 'SELECT * FROM link_codes WHERE code_hash = ?', ch);
    if (!again) throw new HttpError(404, 'link_not_found');
    if (again.claimed_at) return claimed(again);
    if (again.expires_at <= nowIso()) throw new HttpError(410, 'link_expired');
    throw await deviceLimitError(env, a.id);
  }
  ctx?.waitUntil?.(flushNotices(env));
  return json({ ok: true, device: { id, label } }, 200, cors);
}

/**
 * POST /api/family/devices/this {label?, purpose?, consent?} with X-Account-Token and X-Device: the parent is holding
 * the child's device, for the plan or as the free OK (see linkPurpose). Returns the device token and deletes the session
 * that asked, so the parent's sign-in does not stay on the child's device.
 */
export async function linkThisDevice(req, env, ctx, cors) {
  const a = await requireAccount(req, env);
  const b = await body(req, SMALL);
  if (!(await deviceFrom(req, env))) throw new HttpError(400, 'need_device');
  await limitOrThrow(env, `claim:a:${a.id}`, LINK_LIMITS.claim, 429, 'too_many_links');
  const purpose = await linkPurpose(env, a.id, b);
  const label = cleanLabel(b.label);
  const restore = await restoreFromOf(env, b, a.id);
  const now = nowIso();
  const max = limits(env).family.devices;
  if ((await devicesInUse(env, a.id, now)) >= max) throw await deviceLimitError(env, a.id);
  const id = randomToken(8);
  const token = newDeviceToken();
  const tokenHash = await sha256(token);
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO family_devices (id, account_id, token_hash, label, created_at, last_seen)
      SELECT ?3, ?1, ?4, ?5, ?2, ?6 WHERE (SELECT COUNT(*) FROM family_devices d WHERE ${IN_USE}) < ?7`)
      .bind(a.id, now, id, tokenHash, label, dayOf(), max),
    env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ? AND EXISTS (SELECT 1 FROM family_devices WHERE id = ?)').bind(a.tokenHash, id),
    linkedNoticeStmt(env, { id, accountId: a.id, label, at: now, purpose }),
    linkedAuditStmt(env, { id, accountId: a.id, at: now, how: 'this_device', purpose }),
    // continuing from kept progress: the escrow moves to this device with its token
    moveEscrowStmt(env, { escrowId: restore, accountId: a.id, deviceId: id, tokenHash, at: now }),
  ]);
  if (Number(res[0].meta?.changes) !== 1) throw await deviceLimitError(env, a.id);
  ctx?.waitUntil?.(flushNotices(env));
  const kept = restore ? await deviceEscrowCode(env, id) : null;
  return json({ deviceToken: token, label, ...(kept ? { vault: { code: kept } } : {}) }, 200, cors);
}

/** POST /api/family/devices/:id/unlink {}: the parent unlinks one of the family's devices. */
export async function unlinkDevice(id, req, env, cors) {
  const a = await requireAccount(req, env);
  await body(req, SMALL);
  const dev = await first(env, 'SELECT id FROM family_devices WHERE id = ? AND account_id = ?', String(id), a.id);
  if (!dev) throw new HttpError(404, 'not_found');
  await env.DB.batch([
    // the device's escrow stays with the account ("התקדמות שמורה"), before the device row goes
    env.DB.prepare('UPDATE vault_escrow SET device_id = NULL WHERE device_id = ?').bind(dev.id),
    // its daily summaries for the parents go with it (PARENTS-3)
    env.DB.prepare('DELETE FROM family_daily WHERE device_id = ?').bind(dev.id),
    env.DB.prepare('DELETE FROM family_devices WHERE id = ? AND account_id = ?').bind(dev.id, a.id),
    env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
      .bind(nowIso(), `account:${a.id}`, 'device.unlink', `device:${dev.id}`, JSON.stringify({ by: 'parent' })),
  ]);
  return json({ ok: true }, 200, cors);
}

/**
 * Night-time purge: link codes a day past their expiry, devices that never collected a token, devices unused for a year.
 * A deleted device's escrow stays with the account (device_id NULL), as on an unlink. Its daily summaries go with it:
 * purge() runs report.js purgeReportSql after this in the same batch, whose orphan sweep removes them (so does the FK).
 */
export function purgeFamilySql(env, now = new Date()) {
  const dayAgo = new Date(now.getTime() - 864e5).toISOString();
  const yearAgo = dayOf(new Date(now.getTime() - 365 * 864e5));
  const never = 'token_hash IS NULL AND created_at < ?';
  const unused = 'token_hash IS NOT NULL AND last_seen < ?';
  return [
    env.DB.prepare('DELETE FROM link_codes WHERE expires_at < ?').bind(dayAgo),
    env.DB.prepare(`UPDATE vault_escrow SET device_id = NULL WHERE device_id IN (SELECT id FROM family_devices WHERE ${never})`).bind(dayAgo),
    env.DB.prepare(`DELETE FROM family_devices WHERE ${never}`).bind(dayAgo),
    env.DB.prepare(`UPDATE vault_escrow SET device_id = NULL WHERE device_id IN (SELECT id FROM family_devices WHERE ${unused})`).bind(yearAgo),
    env.DB.prepare(`DELETE FROM family_devices WHERE ${unused}`).bind(yearAgo),
  ];
}

// ---------------------------------------------------------------- the progress kept for the family (DURABLE-6)
/**
 * GET /api/family/vaults: the account's escrows whose vault is still there: { vaults: [{ id, label, device, updatedAt }] }
 * (device: the linked device syncing it, or null when it is kept in the account). Never the code or the vault's content.
 */
export async function familyVaults(req, env, cors) {
  const a = await requireAccount(req, env);
  const rows = await all(env, `SELECT e.id, e.label, e.device_id, d.label AS device_label, v.updated_at FROM vault_escrow e
    JOIN vaults v ON v.id_hash = e.vault_id LEFT JOIN family_devices d ON d.id = e.device_id AND d.account_id = e.owner_id
    WHERE e.owner_kind = 'account' AND e.owner_id = ? ORDER BY v.updated_at DESC`, a.id);
  return json({
    vaults: rows.map((r) => ({ id: r.id, label: r.label, device: r.device_id && r.device_label != null ? { id: r.device_id, label: r.device_label } : null, updatedAt: r.updated_at })),
  }, 200, cors);
}

/** POST /api/family/vaults/:id/delete {}: the parent deletes one kept escrow (the device itself is not affected). */
export async function deleteFamilyVault(id, req, env, cors) {
  const a = await requireAccount(req, env);
  await body(req, SMALL);
  const e = await first(env, "SELECT id FROM vault_escrow WHERE id = ? AND owner_kind = 'account' AND owner_id = ?", String(id), a.id);
  if (!e) throw new HttpError(404, 'not_found');
  await env.DB.batch([
    env.DB.prepare("DELETE FROM vault_escrow WHERE id = ? AND owner_kind = 'account' AND owner_id = ?").bind(e.id, a.id),
    env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
      .bind(nowIso(), `account:${a.id}`, 'escrow.delete', `escrow:${e.id}`, JSON.stringify({ by: 'parent' })),
  ]);
  return json({ ok: true }, 200, cors);
}
