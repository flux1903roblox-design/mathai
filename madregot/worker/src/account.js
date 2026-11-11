// Parent and teacher accounts: sign-in with a 6-digit code sent by email, no password. Sign-up and sign-in are one flow.
// The only personal data kept is the email address (the payer's), and only once a code was entered: a pending code is
// keyed by HMAC(AUTH_SECRET, email), so an address that never signs in is never stored. A session token is stored
// hashed and sent as X-Account-Token. Sessions are for a parent's or teacher's own browser, never a child's device
// (those get family-device tokens that work for the AI routes only).
import {
  HttpError, body, json, sha256, hmacHex, randomToken, nowIso, addDays, dayOf, safeEqual, netKey, key, take, giveBack,
} from './util.js';
import { sendLoginCode, emailReady } from './email.js';
import { queueNotices, ownerNotice } from './spend.js';

export const CODE_TTL_MIN = 10;
export const CODE_TRIES = 5;
export const RESEND_SECONDS = 60;
export const MAX_SESSIONS = 3;
export const SESSION_IDLE_DAYS = 180;
export const STEP_UP_MINUTES = 10;
// Codes sent a day: 5 to one address from one network, 15 to one address in all (so a stranger on another network
// cannot use up the owner's own sends), 40 from one network (IPv6 counted by its /48), and a global ceiling
// (MAIL_DAILY_CAP, an owner notice when it trips). Wrong codes: 30 a day from one network (VERIFY_FAIL_NET_DAILY),
// never given back, so nobody can burn the tries of the codes sent to someone else's address all day.
export const SEND_CAPS = { pair: 5, email: 15, net: 40, all: 3000 };
export const VERIFY_FAILS_PER_NET = 30;
const capVar = (env, name, d) => { const v = Number(env[name]); return env[name] !== undefined && env[name] !== '' && Number.isInteger(v) && v >= 0 ? v : d; };
export const mailDailyCap = (env) => capVar(env, 'MAIL_DAILY_CAP', SEND_CAPS.all);
const verifyFailsPerNet = (env) => capVar(env, 'VERIFY_FAIL_NET_DAILY', VERIFY_FAILS_PER_NET);

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
/** Trimmed, NFKC, lower-case, at most 254 characters, a plain address. Else 400 bad_email. */
export function cleanEmail(raw) {
  const e = String(raw ?? '').trim().normalize('NFKC').toLowerCase();
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

function authSecret(env) {
  if (!env.AUTH_SECRET) throw new HttpError(503, 'server_config');
  return env.AUTH_SECRET;
}
export const emailHash = (env, email) => hmacHex(authSecret(env), email);
const codeHash = (env, eh, code) => hmacHex(authSecret(env), `${eh}:${code}`);
/** The code may go to the Worker log instead of an email: only with EMAIL_DEV_LOG on a localhost request. */
export function devLogAllowed(req, env) {
  if (String(env.EMAIL_DEV_LOG) !== 'true') return false;
  const host = new URL(req.url).hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** POST /api/account/code: send a code. The same answer whether or not an account exists for the address. */
export async function startLogin(req, env, cors) {
  const b = await body(req);
  const email = cleanEmail(b.email);
  const devLog = devLogAllowed(req, env);
  if (!emailReady(env) && !devLog) throw new HttpError(503, 'email_not_configured');
  const eh = await emailHash(env, email);
  const net = await netKey(req, env, { wide: true });
  const prev = await env.DB.prepare('SELECT sent_at FROM login_codes WHERE email_hash = ?').bind(eh).first();
  const since = prev ? Date.now() - Date.parse(prev.sent_at) : Infinity;
  if (since < RESEND_SECONDS * 1000) {
    throw new HttpError(429, 'wait_to_resend', undefined, { retryAfter: Math.ceil((RESEND_SECONDS * 1000 - since) / 1000) });
  }
  const tooMany = new HttpError(429, 'too_many_codes');
  const r = await take(env, [
    key(`mail:e:${eh}:${net}`, SEND_CAPS.pair, { err: tooMany }),
    key(`mail:e:${eh}`, SEND_CAPS.email, { err: tooMany }),
    key(`mail:n:${net}`, SEND_CAPS.net, { err: tooMany }),
    key('mail:all', mailDailyCap(env), { err: tooMany }),
  ]);
  if (!r.ok) {
    // the global ceiling stops every sign-in today: the owner hears of it at once (once a day)
    if (r.key?.who === 'mail:all') {
      const day = dayOf();
      await queueNotices(env, [ownerNotice(day, `owner:mail_cap:${day}`, { day, cap: mailDailyCap(env) })]);
    }
    throw r.error;
  }
  const code = sixDigits();
  const now = nowIso();
  // a new code replaces the old one and resets its tries
  await env.DB.prepare(
    `INSERT INTO login_codes (email_hash, code_hash, expires_at, tries, sent_at) VALUES (?, ?, ?, 0, ?)
     ON CONFLICT (email_hash) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, tries = 0, sent_at = excluded.sent_at`,
  ).bind(eh, await codeHash(env, eh, code), new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(), now).run();
  try {
    await sendLoginCode(env, email, code, { devLog });
  } catch (e) {
    // nothing was sent: the address may ask again at once (the daily caps still count)
    await env.DB.prepare('DELETE FROM login_codes WHERE email_hash = ? AND sent_at = ?').bind(eh, now).run();
    throw e;
  }
  return json({ sent: true, expiresInMinutes: CODE_TTL_MIN, resendAfter: RESEND_SECONDS }, 200, cors);
}

/** POST /api/account/verify: the code from the email. Returns a new session token (a sign-in always makes a new one). */
export async function verifyLogin(req, env, cors) {
  const b = await body(req);
  const email = cleanEmail(b.email);
  const code = String(b.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'bad_code');
  const eh = await emailHash(env, email);
  const now = nowIso();
  // A network that already sent too many wrong codes today is stopped before it spends a try of anyone's code. The
  // counter is taken first (so parallel guesses cannot pass it) and given back unless a wrong code was entered.
  const fails = key(`verify:n:${await netKey(req, env, { wide: true })}`, verifyFailsPerNet(env), { refundable: true, err: new HttpError(429, 'too_many_tries') });
  const counted = await take(env, [fails]);
  if (!counted.ok) throw counted.error;
  let wrong = false;
  let row;
  try {
    // one statement counts the try, so parallel guesses can never pass 5
    row = await env.DB.prepare(
      'UPDATE login_codes SET tries = tries + 1 WHERE email_hash = ? AND tries < ? AND expires_at > ? RETURNING code_hash, tries',
    ).bind(eh, CODE_TRIES, now).first();
    if (!row) {
      const ex = await env.DB.prepare('SELECT tries, expires_at FROM login_codes WHERE email_hash = ?').bind(eh).first();
      if (ex && ex.expires_at > now && ex.tries >= CODE_TRIES) throw new HttpError(429, 'too_many_tries');
      throw new HttpError(410, 'code_expired');
    }
    if (!safeEqual(await codeHash(env, eh, code), row.code_hash)) {
      wrong = true;
      throw new HttpError(403, 'wrong_code', undefined, { left: Math.max(0, CODE_TRIES - row.tries) });
    }
  } finally {
    if (!wrong) await giveBack(env, [fails]);
  }
  // single use: exactly one request can delete the row
  const del = await env.DB.prepare('DELETE FROM login_codes WHERE email_hash = ? AND code_hash = ?').bind(eh, row.code_hash).run();
  if (Number(del.meta?.changes) !== 1) throw new HttpError(410, 'code_expired');

  await env.DB.prepare('INSERT INTO accounts (id, email, created_at, last_seen) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING')
    .bind(randomToken(8), email, now, dayOf()).run();
  const account = await env.DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
  const token = randomToken(32);
  // a step-up (a new code while signed in) replaces the session that asked for it
  const old = await sessionOf(req, env);
  await env.DB.batch([
    ...(old && old.account_id === account.id ? [env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?').bind(old.token_hash)] : []),
    env.DB.prepare('INSERT INTO account_sessions (token_hash, account_id, created_at, last_seen, verified_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256(token), account.id, now, now, now),
    // keep the newest MAX_SESSIONS sessions
    env.DB.prepare(
      'DELETE FROM account_sessions WHERE account_id = ? AND token_hash NOT IN (SELECT token_hash FROM account_sessions WHERE account_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)',
    ).bind(account.id, account.id, MAX_SESSIONS),
    env.DB.prepare('UPDATE accounts SET last_seen = ? WHERE id = ?').bind(dayOf(), account.id),
  ]);
  return json({ token, email }, 200, cors);
}

async function sessionOf(req, env) {
  const token = String(req.headers.get('X-Account-Token') || '').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.account_id, s.last_seen, s.verified_at, a.email, a.billing_hold_at, a.adult_confirmed_at, a.terms_version, a.report_email_at
     FROM account_sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?`,
  ).bind(hash).first();
  if (!row) return null;
  if (row.last_seen < addDays(nowIso(), -SESSION_IDLE_DAYS)) {
    await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  return row;
}

/** The signed-in account behind this request, or null. last_seen is written at most once an hour. */
export async function accountFrom(req, env) {
  const s = await sessionOf(req, env);
  if (!s) return null;
  const now = nowIso();
  if (s.last_seen < new Date(Date.now() - 3600_000).toISOString()) {
    await env.DB.batch([
      env.DB.prepare('UPDATE account_sessions SET last_seen = ? WHERE token_hash = ?').bind(now, s.token_hash),
      env.DB.prepare('UPDATE accounts SET last_seen = ? WHERE id = ?').bind(dayOf(), s.account_id),
    ]);
  }
  return {
    id: s.account_id, email: s.email, tokenHash: s.token_hash, verifiedAt: s.verified_at,
    billingHoldAt: s.billing_hold_at, adultConfirmedAt: s.adult_confirmed_at, termsVersion: s.terms_version,
    reportEmailAt: s.report_email_at || null,
  };
}

/** Every account route: a valid X-Account-Token, else 401 not_account (a family-device token alone is not enough). */
export async function requireAccount(req, env) {
  const a = await accountFrom(req, env);
  if (!a) throw new HttpError(401, 'not_account');
  return a;
}

/** Account deletion and other irreversible steps need a code entered in the last 10 minutes. */
export function requireRecentCode(account) {
  if (!account.verifiedAt || Date.parse(account.verifiedAt) < Date.now() - STEP_UP_MINUTES * 60_000) {
    throw new HttpError(401, 'reauth_needed');
  }
}

/** POST /api/account/signout {all?}: this session, or every session of the account. */
export async function signOut(req, env, cors) {
  const b = await body(req);
  const a = await accountFrom(req, env);
  if (!a) return json({ ok: true, revoked: 0 }, 200, cors);
  const r = b.all === true
    ? await env.DB.prepare('DELETE FROM account_sessions WHERE account_id = ?').bind(a.id).run()
    : await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?').bind(a.tokenHash).run();
  return json({ ok: true, revoked: Number(r.meta?.changes || 0) }, 200, cors);
}

/** Purge rules for the cron: expired codes and sessions unused for 180 days. */
export const purgeAccountsSql = (env) => [
  env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(nowIso()),
  env.DB.prepare('DELETE FROM account_sessions WHERE last_seen < ?').bind(addDays(nowIso(), -SESSION_IDLE_DAYS)),
];

