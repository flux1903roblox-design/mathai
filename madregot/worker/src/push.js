// The opt-in daily reminder by web push (STUDENT-11). Everything here is off unless env.PUSH === 'on'.
//
// The browser subscribes (web/src/lib/push.js) and sends its push address and keys with the hour it chose. The server
// keeps the least it can (table push_subs): the push address, its two keys, the hour, and the days it last saw the app,
// last saw a lesson finished and last sent a reminder. No name, class, account or device id. The browser gets an id and
// a secret once (the secret is stored hashed) and uses them to report "opened" or "learned" and to turn it off.
//
//   GET  /api/push/key                     { key }: the VAPID public key; 404 while the switch is off
//   POST /api/push/subscribe               { endpoint, keys: { p256dh, auth }, slot: 16-20, replaces?: { id, secret } } -> { id, secret }
//   POST /api/push/seen                    { id, secret, day, done } -> { status: 'on' | 'paused' }; 404 when the row is gone
//   POST /api/push/off                     { id, secret }: deletes the row
// Each is limited per network key (the hashed counter of util.js): subscribe and off 20 a day, seen and key 200 a day.
//
// Sending (pushDue) runs in its own cron invocation ('37 * * * *'), never with the billing jobs: on Workers Free a cron
// gets 10 ms of CPU, and each message costs an ECDH key pair, a shared secret, HKDFs and an AES-GCM pass. It sends one
// reminder a day at most, in the hour the student chose (16:00-20:00 Jerusalem), never on Shabbat, Yom Tov, the memorial
// days or Tish'a B'Av, never on their eve (they begin at sundown), and never on a day the student already learned.
// A night step (pushNight, with the 03:00 jobs) backs off when reminders are ignored: from 3 ignored days in a row only
// every other day, from 6 the reminder pauses until the student turns it on again. Rows not used for 45 days are
// deleted (cron.js purgeRecordsSql).
import { dayOf, hourOf, json, HttpError, body, sha256, randomToken, netKey, limitOrThrow, secretEqual } from './util.js';
import { isQuietDay, isQuietEve } from '../../shared/restDays.js';
import { encryptPayload, vapidJwt, vapidAuth, fromB64u, importPublic, parseVapidJwk, publicOfJwk } from './webpush.js';
import { countServer } from './metrics.js';
import { shiftDay } from './goal.js';

export const PUSH_CRON = '37 * * * *';
export const SLOTS = [16, 17, 18, 19, 20];
/** Push services a subscription may point at: the host is one of these or a subdomain of one (a label boundary). */
export const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
/** Requests a network may make in a Jerusalem day. */
export const PUSH_LIMITS = { subscribe: 20, off: 20, seen: 200, key: 200 };
/** Back-off: from this many ignored reminders in a row only on even days of the year; from PAUSE_AT, paused. */
export const BACKOFF = { evenDaysAt: 3, pauseAt: 6 };
/** Rows not seen for this many days are deleted. */
export const PUSH_KEEP_DAYS = 45;
/** Reminders sent per run when PUSH_BATCH is not set (Workers Free). On Workers Paid the owner sets 400. */
export const PUSH_BATCH_DEFAULT = 10;
const ENDPOINT_MAX = 2048;

/** The six texts, one a day in turn (messageFor). Never a name, a number, the plan or a streak. */
export const TEXTS = [
  'חמש דקות של מתמטיקה? מדי מחכה עם תרגיל קצר.',
  'שיעור קצר אחד היום, וזה מספיק.',
  'המשימה של היום מחכה לכם, מתי שנוח.',
  'מדרגה אחת בכל פעם. נמשיך מאיפה שעצרתם?',
  'יש לכם כמה דקות? תרגיל אחד ונראה איך הולך.',
  'מדי הכין לכם משימה קצרה להיום.',
];
export const TITLE = 'מדרגות';

export const pushOn = (env) => String(env.PUSH || 'off') === 'on';

/** 1 for 1 January. */
export function dayOfYear(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5) + 1;
}

/** The day's text, in turn by the day of the year. */
export const messageFor = (day) => TEXTS[dayOfYear(day) % TEXTS.length];

/** The reminder as the push message carries it: the declarative format (RFC 8030 + Safari 18.4), read by sw.js too. */
export function payloadFor(env, day) {
  const base = String(env.PUBLIC_URL || '').replace(/\/+$/, '');
  return JSON.stringify({
    web_push: 8030,
    notification: { title: TITLE, body: messageFor(day), lang: 'he', dir: 'rtl', navigate: `${base}/#/?go=today&src=push`, tag: 'daily', silent: false },
  });
}

/** A push address on an allowed push service: https, no port, no user, and the host on a label boundary. */
export function pushEndpointOk(endpoint) {
  const s = String(endpoint ?? '');
  if (!s || s.length > ENDPOINT_MAX) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  if (u.protocol !== 'https:' || u.port !== '' || u.username || u.password) return false;
  // the address as written, not only as parsed: an explicit port (even :443) is refused too
  if (!/^https:\/\/[^/?#:@]+(?:[/?#]|$)/i.test(s)) return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The browser's keys: p256dh a P-256 point (65 bytes, 0x04, on the curve), auth 16 bytes. */
export async function keysOk(keys) {
  const p = fromB64u(keys?.p256dh);
  const a = fromB64u(keys?.auth);
  if (p?.length !== 65 || p[0] !== 4 || a?.length !== 16) return false;
  try { await importPublic(p); return true; } catch { return false; }
}

/** What sending needs, checked before anything is sent (a wrong key would make every push service refuse, and a
 *  refusal deletes the row): the switch, a public key that matches the private one, a subject Apple accepts, the
 *  app's https address. Returns null when all is well, else what is missing. */
export function pushConfigError(env) {
  if (!pushOn(env)) return 'off';
  const pub = fromB64u(env.VAPID_PUBLIC_KEY);
  if (pub?.length !== 65 || pub[0] !== 4) return 'VAPID_PUBLIC_KEY';
  const jwk = parseVapidJwk(env.VAPID_PRIVATE_JWK);
  if (!jwk || publicOfJwk(jwk) !== String(env.VAPID_PUBLIC_KEY).replace(/=+$/, '')) return 'VAPID_PRIVATE_JWK';
  if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(String(env.VAPID_SUBJECT || ''))) return 'VAPID_SUBJECT';
  if (!/^https:\/\/\S+$/.test(String(env.PUBLIC_URL || ''))) return 'PUBLIC_URL';
  return null;
}

const notFound = () => new HttpError(404, 'not_found');
const slotOf = (v) => {
  const n = typeof v === 'string' && /^\d{2}$/.test(v) ? Number(v) : v;
  return SLOTS.includes(n) ? n : null;
};
const limit = async (req, env, kind) => limitOrThrow(env, `push:${kind}:${await netKey(req, env)}`, PUSH_LIMITS[kind], 429, 'too_many_push');

/** The row an id and secret open, or null. */
async function rowOf(env, b) {
  const id = String(b?.id ?? '');
  if (!/^[0-9a-f]{16}$/.test(id) || !/^[0-9a-f]{32}$/.test(String(b?.secret ?? ''))) return null;
  const row = await env.DB.prepare('SELECT id, secret_hash, status FROM push_subs WHERE id = ?').bind(id).first();
  return row && await secretEqual(await sha256(String(b.secret)), row.secret_hash) ? row : null;
}

/** GET /api/push/key */
export async function pushKey(req, env, cors) {
  if (!pushOn(env) || fromB64u(env.VAPID_PUBLIC_KEY)?.length !== 65) throw notFound();
  await limit(req, env, 'key');
  return json({ key: String(env.VAPID_PUBLIC_KEY).replace(/=+$/, '') }, 200, cors);
}

/** POST /api/push/subscribe */
export async function pushSubscribe(req, env, cors) {
  if (!pushOn(env)) throw notFound();
  const b = await body(req, 4096);
  if (!pushEndpointOk(b.endpoint)) throw new HttpError(400, 'bad_endpoint');
  if (!await keysOk(b.keys)) throw new HttpError(400, 'bad_keys');
  const slot = slotOf(b.slot);
  if (!slot) throw new HttpError(400, 'bad_slot');
  await limit(req, env, 'subscribe');
  const old = b.replaces ? await rowOf(env, b.replaces) : null;
  const id = randomToken(8);
  const secret = randomToken(16);
  const now = new Date();
  await env.DB.batch([
    ...(old ? [env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(old.id)] : []),
    // the same push address again (a slot change, or a device that lost its id): the new row takes its place
    env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(b.endpoint),
    env.DB.prepare(`INSERT INTO push_subs (id, secret_hash, endpoint, p256dh, auth, slot, status, created_at, last_seen_day, misses)
      VALUES (?, ?, ?, ?, ?, ?, 'on', ?, ?, 0)`).bind(id, await sha256(secret), b.endpoint, b.keys.p256dh, b.keys.auth, slot, now.toISOString(), dayOf(now)),
  ]);
  return json({ id, secret }, 200, cors);
}

/**
 * POST /api/push/seen: the app was opened (done: false) or a lesson was finished (done: true). `day` is the device's
 * day; it is used when it is the server's Jerusalem today or yesterday (a lesson finished just before midnight and sent
 * just after), else today. The days only move forward. Answers the row's status, so the app can show a pause.
 */
export async function pushSeen(req, env, cors) {
  if (!pushOn(env)) throw notFound();
  const b = await body(req, 1024);
  await limit(req, env, 'seen');
  const row = await rowOf(env, b);
  if (!row) throw new HttpError(404, 'no_push');
  const today = dayOf();
  const day = [today, shiftDay(today, -1)].includes(b.day) ? b.day : today;
  await env.DB.prepare(`UPDATE push_subs SET last_seen_day = MAX(COALESCE(last_seen_day, ''), ?1),
    last_done_day = CASE WHEN ?2 THEN MAX(COALESCE(last_done_day, ''), ?1) ELSE last_done_day END WHERE id = ?3`)
    .bind(day, b.done === true ? 1 : 0, row.id).run();
  return json({ status: row.status }, 200, cors);
}

/** POST /api/push/off */
export async function pushOff(req, env, cors) {
  if (!pushOn(env)) throw notFound();
  const b = await body(req, 1024);
  await limit(req, env, 'off');
  const row = await rowOf(env, b);
  if (row) await env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(row.id).run();
  return json({ ok: true }, 200, cors);
}

/** The reminder must not go out on this Jerusalem day and hour (outside 16-20, a quiet day, or a quiet day's eve). */
export function quietNow(now) {
  const H = Number(hourOf(now).slice(-2));
  const today = dayOf(now);
  if (H < 16 || H > 20) return 'hour';
  // memorial days begin at sundown, so their eve is quiet from noon (always true in 16-20; kept as the rule says)
  if (isQuietDay(today) || (isQuietEve(today) && H >= 12)) return 'quiet';
  return null;
}

const batchSize = (env) => {
  const n = Math.floor(Number(env.PUSH_BATCH));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : PUSH_BATCH_DEFAULT;
};

/**
 * Send the reminders due this hour (the '37 * * * *' cron). Returns what it did:
 * { sent, gone, rejected, failed, deferred } or { skipped: reason }.
 */
export async function pushDue(env, now = new Date()) {
  if (!pushOn(env)) return { skipped: 'off' };
  const quiet = quietNow(now);
  if (quiet) return { skipped: quiet };
  const bad = pushConfigError(env);
  if (bad) { console.error('push config', bad); return { skipped: 'config', missing: bad }; }
  const H = Number(hourOf(now).slice(-2));
  const today = dayOf(now);
  const even = dayOfYear(today) % 2 === 0;
  const where = `slot = ?1 AND status = 'on' AND (last_done_day IS NULL OR last_done_day < ?2)
    AND (last_sent_day IS NULL OR last_sent_day < ?2) AND (misses < ?3 OR ?4)`;
  const args = [H, today, BACKOFF.evenDaysAt, even ? 1 : 0];
  const due = Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM push_subs WHERE ${where}`).bind(...args).first())?.n || 0);
  if (!due) return { sent: 0, gone: 0, rejected: 0, failed: 0, deferred: 0 };
  // the oldest send first, so that when a slot outgrows the batch the same students do not miss out every day
  const list = (await env.DB.prepare(`SELECT id, endpoint, p256dh, auth FROM push_subs WHERE ${where}
    ORDER BY last_sent_day NULLS FIRST, id LIMIT ?5`).bind(...args, batchSize(env)).all()).results || [];
  const payload = payloadFor(env, today);
  const pub = String(env.VAPID_PUBLIC_KEY).replace(/=+$/, '');
  const jwts = new Map(); // one signed token per push service origin per run
  const out = { sent: 0, gone: 0, rejected: 0, failed: 0, deferred: Math.max(0, due - list.length) };
  const writes = [];
  for (const row of list) {
    let status = 0;
    try {
      const origin = new URL(row.endpoint).origin;
      if (!jwts.has(origin)) jwts.set(origin, await vapidJwt(env, origin, now));
      const res = await fetch(row.endpoint, {
        method: 'POST',
        headers: {
          TTL: '7200', Urgency: 'normal', Topic: 'daily', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
          Authorization: vapidAuth(jwts.get(origin), pub),
        },
        body: await encryptPayload(row, payload),
      });
      status = res.status;
    } catch (e) { console.error('push send', e?.message); }
    if (status >= 200 && status < 300) {
      out.sent++;
      writes.push(env.DB.prepare('UPDATE push_subs SET last_sent_day = ? WHERE id = ?').bind(today, row.id));
    } else if (status === 404 || status === 410) {
      out.gone++; // the browser dropped the subscription
      writes.push(env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(row.id));
    } else if (status >= 400 && status < 500 && status !== 429) {
      out.rejected++; // the push service will never take this one
      writes.push(env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(row.id));
    } else {
      out.failed++; // 429, 5xx or no answer: kept, tried again the next day
    }
  }
  if (writes.length) await env.DB.batch(writes);
  for (const [name, n] of [['push_sent', out.sent], ['push_rejected', out.rejected], ['push_failed', out.failed], ['push_deferred', out.deferred]]) {
    if (n) await countServer(env, name, now, n);
  }
  return out;
}

/**
 * The night step (03:00 Jerusalem, before any send of the day): a reminder sent yesterday on a day with no lesson is
 * one more miss in a row; a lesson yesterday (or since) sets the count back to 0; 6 in a row pause the reminder.
 */
export async function pushNight(env, now = new Date()) {
  const y = shiftDay(dayOf(now), -1);
  const r = await env.DB.batch([
    env.DB.prepare(`UPDATE push_subs SET misses = misses + 1 WHERE last_sent_day = ?1
      AND (last_done_day IS NULL OR last_done_day < ?1)`).bind(y),
    env.DB.prepare('UPDATE push_subs SET misses = 0 WHERE last_done_day >= ? AND misses > 0').bind(y),
    env.DB.prepare("UPDATE push_subs SET status = 'paused' WHERE status = 'on' AND misses >= ?").bind(BACKOFF.pauseAt),
  ]);
  const paused = Number(r[2]?.meta?.changes || 0);
  if (paused) await countServer(env, 'push_paused', now, paused);
  return { missed: Number(r[0]?.meta?.changes || 0), reset: Number(r[1]?.meta?.changes || 0), paused };
}

/** Retention: a row whose app has not been opened for 45 days (or never, 45 days after it was made). */
export const purgePushSql = (env, now = new Date()) => env.DB.prepare(
  'DELETE FROM push_subs WHERE COALESCE(last_seen_day, substr(created_at, 1, 10)) < ?',
).bind(dayOf(new Date(now.getTime() - PUSH_KEEP_DAYS * 864e5)));

/** The reminders now on and paused, and those whose student learned in the 7 days up to `day` (the owner's summary). */
export async function pushReach(env, day) {
  const r = await env.DB.prepare(`SELECT
      SUM(CASE WHEN status = 'on' THEN 1 ELSE 0 END) AS on_n,
      SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_n,
      SUM(CASE WHEN last_done_day > ? THEN 1 ELSE 0 END) AS learned7
    FROM push_subs`).bind(shiftDay(day, -7)).first();
  return { on: Number(r?.on_n || 0), paused: Number(r?.paused_n || 0), learned7: Number(r?.learned7 || 0) };
}
