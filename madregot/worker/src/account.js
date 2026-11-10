// Parent and teacher accounts: sign-in with a 6-digit code sent by email, no password.
// The only personal data kept is the email address (the payer's). A session token is stored hashed; the device keeps
// the token and sends it as X-Account-Token. A family account works on up to MAX_DEVICES devices at once (the oldest
// session is signed out), and its AI questions share one daily limit, so a subscription cannot quietly serve a whole class.
import { HttpError, body, json, sha256, randomToken, nowIso, spend, clientIp, safeEqual } from './util.js';
import { sendLoginCode } from './email.js';

export const CODE_TTL_MIN = 10;
export const CODE_TRIES = 5;
export const RESEND_SECONDS = 60;
export const MAX_DEVICES = 3;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
export function cleanEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new HttpError(400, 'bad_email');
  return e;
}

/** A uniformly random 6-digit code (rejection sampling avoids modulo bias). */
export function sixDigits() {
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < 4_294_000_000) return String(buf[0] % 1_000_000).padStart(6, '0');
  }
}

export async function startLogin(req, env, cors) {
  const b = await body(req);
  const email = cleanEmail(b.email);
  const ip = clientIp(req);
  // generous per address (a school can share one), tight per email
  if (!(await spend(env, `code-ip:${ip}`, 60))) throw new HttpError(429, 'too_many_codes');
  const prev = await env.DB.prepare('SELECT sent_at FROM login_codes WHERE email = ?').bind(email).first();
  if (prev && Date.now() - Date.parse(prev.sent_at) < RESEND_SECONDS * 1000) {
    const wait = Math.ceil((RESEND_SECONDS * 1000 - (Date.now() - Date.parse(prev.sent_at))) / 1000);
    throw new HttpError(429, 'wait_to_resend', undefined, { retryAfter: wait });
  }
  if (!(await spend(env, `code-mail:${await sha256(email)}`, 8))) throw new HttpError(429, 'too_many_codes');
  const code = sixDigits();
  const salt = randomToken(8);
  const expires = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
  await env.DB.prepare(
    'INSERT INTO login_codes (email, code_hash, expires_at, tries, sent_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, tries = 0, sent_at = excluded.sent_at',
  ).bind(email, `${salt}:${await sha256(`${salt}:${email}:${code}`)}`, expires, nowIso()).run();
  await sendLoginCode(env, email, code);
  // the same answer whether or not an account exists for this address
  return json({ sent: true, expiresInMinutes: CODE_TTL_MIN }, 200, cors);
}

export async function verifyLogin(req, env, cors) {
  const b = await body(req);
  const email = cleanEmail(b.email);
  const code = String(b.code || '').replace(/\D/g, '');
  if (code.length !== 6) throw new HttpError(400, 'bad_code');
  const row = await env.DB.prepare('SELECT * FROM login_codes WHERE email = ?').bind(email).first();
  if (!row || Date.parse(row.expires_at) < Date.now()) {
    if (row) await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
    throw new HttpError(400, 'code_expired');
  }
  // the row stays (locked) until a new code replaces it, so the one-minute wait before a new code still applies
  if (row.tries >= CODE_TRIES) throw new HttpError(429, 'too_many_tries');
  const [salt, h] = String(row.code_hash).split(':');
  if (!safeEqual(await sha256(`${salt}:${email}:${code}`), h)) {
    await env.DB.prepare('UPDATE login_codes SET tries = tries + 1 WHERE email = ?').bind(email).run();
    throw new HttpError(403, 'wrong_code', undefined, { left: Math.max(0, CODE_TRIES - row.tries - 1) });
  }
  await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();

  let account = await env.DB.prepare('SELECT id, email FROM accounts WHERE email = ?').bind(email).first();
  if (!account) {
    account = { id: randomToken(8), email };
    await env.DB.prepare('INSERT INTO accounts (id, email, created_at, last_seen) VALUES (?, ?, ?, ?)').bind(account.id, email, nowIso(), nowIso()).run();
  }
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO account_sessions (token_hash, account_id, created_at, last_seen) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), account.id, nowIso(), nowIso()).run();
  // keep the newest MAX_DEVICES sessions
  await env.DB.prepare(
    'DELETE FROM account_sessions WHERE account_id = ? AND token_hash NOT IN (SELECT token_hash FROM account_sessions WHERE account_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)',
  ).bind(account.id, account.id, MAX_DEVICES).run();
  return json({ token, email }, 200, cors);
}

/** The signed-in account behind this request, or null. */
export async function accountFrom(req, env) {
  const token = String(req.headers.get('X-Account-Token') || '').trim();
  if (!token || token.length > 128) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare(
    'SELECT a.id, a.email FROM account_sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?',
  ).bind(hash).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE account_sessions SET last_seen = ? WHERE token_hash = ?').bind(nowIso(), hash).run();
  return row;
}

export async function requireAccount(req, env) {
  const a = await accountFrom(req, env);
  if (!a) throw new HttpError(401, 'not_signed_in');
  return a;
}

export async function signOut(req, env, cors) {
  const token = String(req.headers.get('X-Account-Token') || '').trim();
  if (token) await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, cors);
}

/** Delete the account and everything tied to it. A running paid subscription must be cancelled first. */
export async function deleteAccount(req, env, cors, { activeFamilySub }) {
  const a = await requireAccount(req, env);
  const sub = await activeFamilySub(env, a.id);
  if (sub && sub.provider !== 'manual' && !sub.cancel_at_period_end) throw new HttpError(409, 'cancel_first');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM account_sessions WHERE account_id = ?').bind(a.id),
    env.DB.prepare('UPDATE subscriptions SET account_id = NULL, status = CASE WHEN status = \'active\' THEN \'ended\' ELSE status END, updated_at = ? WHERE account_id = ?').bind(nowIso(), a.id),
    env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(a.id),
  ]);
  return json({ ok: true }, 200, cors);
}
