// A child's device joins a family plan the way a TV joins a streaming account (spec §3.3):
//
//   1. the child's device makes a secret and asks for a code       POST /api/family/link/start   {secret}      (X-Device)
//   2. a signed-in parent with a live family plan claims the code  POST /api/family/link/claim   {code, label} (X-Account-Token)
//   3. the child's device collects its token, exactly once         POST /api/family/link/finish  {code, secret}
//
// The token (X-Family-Device: fd1.<64 hex>) works for the AI routes only; the parent's session never reaches the child's
// device. On the parent's own phone there is a shortcut: POST /api/family/devices/this makes a token for the device the
// parent is holding and deletes the session that asked, so nothing on that device can change the plan afterwards.
// A family has at most 3 devices. The parent unlinks a device from the parents page; a device can leave by itself.
// Every link is emailed to the parent. Only hashes of codes, secrets and tokens are stored.
import {
  HttpError, body, json, sha256, hmacHex, randomToken, randomFrom, CODE_ALPHABET, nowIso, dayOf, netKey, key, take, limitOrThrow, safeEqual,
} from './util.js';
import { requireAccount } from './account.js';
import { deviceFrom, liveFamily, limits } from './entitle.js';
import { flushNotices } from './email.js';

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
const linkedNoticeStmt = (env, { id, accountId, label, at }) => env.DB.prepare(
  `INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at)
   SELECT ?1, 'device_linked:' || ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM family_devices WHERE id = ?1)`,
).bind(id, accountId, JSON.stringify({ label, at }), at);
const linkedAuditStmt = (env, { id, accountId, at, how }) => env.DB.prepare(
  `INSERT INTO audit_log (at, actor, action, target, detail)
   SELECT ?1, ?2, 'device.link', ?3, ?4 WHERE EXISTS (SELECT 1 FROM family_devices WHERE id = ?5)`,
).bind(at, `account:${accountId}`, `device:${id}`, JSON.stringify({ how }), id);

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
  const r = await take(env, [key(`link:d:${device}`, LINK_LIMITS.device, { err: tooMany }), key(`link:n:${net}`, LINK_LIMITS.net, { err: tooMany })]);
  if (!r.ok) throw r.error;
  const now = nowIso();
  const expiresAt = new Date(Date.parse(now) + LINK_TTL_MIN * 60_000).toISOString();
  const [secretHash, hint] = [await sha256(secret), await sha256(device)];
  for (let i = 0; i < 5; i++) {
    const code = randomFrom(CODE_ALPHABET, 6);
    try {
      await env.DB.prepare('INSERT INTO link_codes (code_hash, secret_hash, device_hint, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(await linkHash(env, code), secretHash, hint, now, expiresAt).run();
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
  const res = await env.DB.batch([
    env.DB.prepare('UPDATE link_codes SET collected_at = ? WHERE code_hash = ? AND collected_at IS NULL AND claimed_at IS NOT NULL AND expires_at > ? RETURNING device_id')
      .bind(now, ch, now),
    env.DB.prepare(`UPDATE family_devices SET token_hash = ?, last_seen = ? WHERE id = ? AND token_hash IS NULL
      AND EXISTS (SELECT 1 FROM link_codes WHERE code_hash = ? AND collected_at = ?)`).bind(await sha256(token), dayOf(), row.device_id, ch, now),
  ]);
  if (res[0].results?.length !== 1 || Number(res[1].meta?.changes) !== 1) throw new HttpError(410, 'link_expired');
  const dev = await first(env, 'SELECT label FROM family_devices WHERE id = ?', row.device_id);
  return json({ deviceToken: token, label: dev?.label || '' }, 200, cors);
}

/** POST /api/family/devices/leave {} with X-Family-Device: the device unlinks itself (also before "delete all data"). */
export async function leaveFamily(req, env, cors) {
  await body(req, SMALL);
  const token = String(req.headers.get('X-Family-Device') || '');
  if (!/^fd1\.[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'need_device');
  const dev = await first(env, 'SELECT id, account_id FROM family_devices WHERE token_hash = ?', await sha256(token));
  if (dev) {
    await env.DB.batch([
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

/** POST /api/family/link/claim {code, label?}: a signed-in parent with a live family plan claims a child's code. */
export async function linkClaim(req, env, ctx, cors) {
  const a = await requireAccount(req, env);
  const b = await body(req, SMALL);
  await limitOrThrow(env, `claim:a:${a.id}`, LINK_LIMITS.claim, 429, 'too_many_links');
  await requireLivePlan(env, a.id);
  const code = normCode(b.code);
  if (!code) throw new HttpError(404, 'link_not_found');
  const ch = await linkHash(env, code);
  const label = cleanLabel(b.label);
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
    env.DB.prepare(`UPDATE link_codes SET account_id = ?, device_id = ?, claimed_at = ?, expires_at = MAX(expires_at, ?)
      WHERE code_hash = ? AND claimed_at IS NULL AND EXISTS (SELECT 1 FROM family_devices WHERE id = ?)`).bind(a.id, id, now, collectBy, ch, id),
    linkedNoticeStmt(env, { id, accountId: a.id, label, at: now }),
    linkedAuditStmt(env, { id, accountId: a.id, at: now, how: 'code' }),
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
 * POST /api/family/devices/this {label?} with X-Account-Token and X-Device: the parent is holding the child's device.
 * Returns the device token and deletes the session that asked, so the parent's sign-in does not stay on the child's device.
 */
export async function linkThisDevice(req, env, ctx, cors) {
  const a = await requireAccount(req, env);
  const b = await body(req, SMALL);
  if (!(await deviceFrom(req, env))) throw new HttpError(400, 'need_device');
  await limitOrThrow(env, `claim:a:${a.id}`, LINK_LIMITS.claim, 429, 'too_many_links');
  await requireLivePlan(env, a.id);
  const label = cleanLabel(b.label);
  const now = nowIso();
  const max = limits(env).family.devices;
  if ((await devicesInUse(env, a.id, now)) >= max) throw await deviceLimitError(env, a.id);
  const id = randomToken(8);
  const token = newDeviceToken();
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO family_devices (id, account_id, token_hash, label, created_at, last_seen)
      SELECT ?3, ?1, ?4, ?5, ?2, ?6 WHERE (SELECT COUNT(*) FROM family_devices d WHERE ${IN_USE}) < ?7`)
      .bind(a.id, now, id, await sha256(token), label, dayOf(), max),
    env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ? AND EXISTS (SELECT 1 FROM family_devices WHERE id = ?)').bind(a.tokenHash, id),
    linkedNoticeStmt(env, { id, accountId: a.id, label, at: now }),
    linkedAuditStmt(env, { id, accountId: a.id, at: now, how: 'this_device' }),
  ]);
  if (Number(res[0].meta?.changes) !== 1) throw await deviceLimitError(env, a.id);
  ctx?.waitUntil?.(flushNotices(env));
  return json({ deviceToken: token, label }, 200, cors);
}

/** POST /api/family/devices/:id/unlink {}: the parent unlinks one of the family's devices. */
export async function unlinkDevice(id, req, env, cors) {
  const a = await requireAccount(req, env);
  await body(req, SMALL);
  const dev = await first(env, 'SELECT id FROM family_devices WHERE id = ? AND account_id = ?', String(id), a.id);
  if (!dev) throw new HttpError(404, 'not_found');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM family_devices WHERE id = ? AND account_id = ?').bind(dev.id, a.id),
    env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
      .bind(nowIso(), `account:${a.id}`, 'device.unlink', `device:${dev.id}`, JSON.stringify({ by: 'parent' })),
  ]);
  return json({ ok: true }, 200, cors);
}

/** Night-time purge: link codes a day past their expiry, devices that never collected a token, devices unused for a year. */
export function purgeFamilySql(env, now = new Date()) {
  const dayAgo = new Date(now.getTime() - 864e5).toISOString();
  const yearAgo = dayOf(new Date(now.getTime() - 365 * 864e5));
  return [
    env.DB.prepare('DELETE FROM link_codes WHERE expires_at < ?').bind(dayAgo),
    env.DB.prepare('DELETE FROM family_devices WHERE token_hash IS NULL AND created_at < ?').bind(dayAgo),
    env.DB.prepare('DELETE FROM family_devices WHERE token_hash IS NOT NULL AND last_seen < ?').bind(yearAgo),
  ];
}
