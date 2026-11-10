// Small helpers shared by the Worker's modules: responses, errors, size-limited bodies, hashing, tokens, the
// Asia/Jerusalem calendar, network keys and the atomic usage counters.

export const TZ = 'Asia/Jerusalem';
/** YYYY-MM-DD in Jerusalem. */
export const dayOf = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });
/** YYYY-MM in Jerusalem. */
export const monthOf = (d = new Date()) => dayOf(d).slice(0, 7);
/** YYYY-MM-DDTHH in Jerusalem (hourly counters). */
export const hourOf = (d = new Date()) => {
  const h = d.toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
  return `${dayOf(d)}T${h.padStart(2, '0')}`;
};
export const nowIso = () => new Date().toISOString();
export const daysAgo = (n) => dayOf(new Date(Date.now() - n * 864e5));
export const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString();

/** Minutes east of UTC in Jerusalem at an instant. */
export function tzOffsetMinutes(date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || 'GMT';
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}
const pad = (n) => String(n).padStart(2, '0');
/** The instant 00:00 in Jerusalem on a YYYY-MM-DD day, as { iso (UTC), local (with offset) }. */
export function jerusalemMidnight(day) {
  const [y, m, d] = day.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  let off = tzOffsetMinutes(new Date(utc));
  off = tzOffsetMinutes(new Date(utc - off * 60_000));
  const t = utc - off * 60_000;
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return { iso: new Date(t).toISOString(), local: `${day}T00:00:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`, ms: t };
}
/** The day after a YYYY-MM-DD day. */
export function nextDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** When a counter of this period starts again: the next Jerusalem midnight, or the 1st of next month. ISO with offset. */
export function resetsAt(period = 'day', now = new Date()) {
  if (period === 'month') {
    const [y, m] = monthOf(now).split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    return jerusalemMidnight(next).local;
  }
  return jerusalemMidnight(nextDay(dayOf(now))).local;
}
/** A YYYY-MM-DD date that means "the end of that day in Jerusalem", as an ISO instant (the next midnight). */
export const endOfDayIso = (day) => jerusalemMidnight(nextDay(day)).iso;
/** A YYYY-MM-DD date that means "the start of that day in Jerusalem". */
export const startOfDayIso = (day) => jerusalemMidnight(day).iso;
/** A name as people type it (a class, a teacher, a student): one space between words, at most 30 characters. */
export const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30);
export const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const json = (data, status, cors, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
});

export class HttpError extends Error {
  constructor(status, code, message, extra, headers) {
    super(message || code); this.status = status; this.code = code; this.extra = extra; this.headers = headers;
  }
}

/** Read the raw body, at most `max` bytes: the declared length first, then a capped read. Else 413 too_large. */
export async function rawBody(req, max) {
  const declared = Number(req.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > max) throw new HttpError(413, 'too_large');
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch { /* the body is dropped either way */ } throw new HttpError(413, 'too_large'); }
    chunks.push(value);
  }
  const all = new Uint8Array(size); let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(all);
}

/** A JSON body of at most `max` bytes (default 4 KB), checked before JSON.parse. */
export async function body(req, max = 4096) {
  const raw = await rawBody(req, max);
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch { throw new HttpError(400, 'bad_json'); }
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
export async function hmacHex(secret, text, algo = 'SHA-256') {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: algo }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}
export function randomToken(bytes = 24) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}
/** Equal-time comparison of two strings (hex digests, keys). */
export function safeEqual(a, b) {
  const x = String(a ?? ''); const y = String(b ?? '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}
/** Compare two secrets by their SHA-256 digests, so neither the length nor the content leaks through timing. */
export async function secretEqual(a, b) {
  return safeEqual(await sha256(String(a ?? '')), await sha256(String(b ?? '')));
}

// Class codes, link codes and licence codes: no 0/O, 1/I/L. 31 symbols.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** n symbols from an alphabet, uniformly (rejection sampling: no modulo bias). */
export function randomFrom(alphabet, n) {
  const cap = 256 - (256 % alphabet.length);
  const out = [];
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) {
      if (b < cap && out.length < n) out.push(alphabet[b % alphabet.length]);
    }
  }
  return out.join('');
}

/**
 * The network part of an address: a whole IPv4 address, or the first `v6Groups` hextets of an IPv6 address (expanded):
 * 4 is its /64 (one home or phone), 3 its /48 (a whole allocation, for the sign-in mail counters).
 */
export function ipPrefix(ip, v6Groups = 4) {
  const a = String(ip || '').trim().toLowerCase();
  if (!a.includes(':')) return a || 'unknown';
  let [head, tail = ''] = a.split('::');
  if (!a.includes('::')) { head = a; tail = ''; }
  const h = head ? head.split(':') : [];
  let t = tail ? tail.split(':') : [];
  // an embedded IPv4 tail (::ffff:1.2.3.4) counts as two groups
  if (t.length && t.at(-1).includes('.')) t = [...t.slice(0, -1), '0', '0'];
  const groups = a.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, v6Groups).map((g) => g.padStart(4, '0')).join(':');
}

/**
 * The key a network is counted under: an HMAC of its prefix, never the address itself. 503 without IP_HASH_SECRET.
 * `wide`: an IPv6 address counts by its /48, not its /64 (one IPv6 allocation holds many /64s, so a /64 key is cheap
 * to multiply). Used for the sign-in counters, whose global cap must not be exhausted from one allocation.
 */
export async function netKey(req, env, { wide = false } = {}) {
  if (!env.IP_HASH_SECRET) throw new HttpError(503, 'server_config');
  const prefix = ipPrefix(req.headers.get('CF-Connecting-IP'), wide ? 3 : 4);
  return (await hmacHex(env.IP_HASH_SECRET, `net:${prefix}`)).slice(0, 16);
}

/**
 * The key an install (its X-Device id) is counted under: the first 16 hex of an HMAC of the id, never the id itself (an
 * install id is an online identifier, so personal data). Same secret and same 503 as netKey; the 'dev:' prefix keeps the
 * two key spaces apart.
 */
export async function devKey(env, id) {
  if (!env.IP_HASH_SECRET) throw new HttpError(503, 'server_config');
  return (await hmacHex(env.IP_HASH_SECRET, `dev:${id}`)).slice(0, 16);
}

// ---------------------------------------------------------------- usage counters (table ai_usage)
/**
 * One counter of a request: { who, day, limit, n = 1, refundable, err }. `day` is YYYY-MM-DD (daily), YYYY-MM
 * (monthly) or YYYY-MM-DDTHH (hourly). refundable: given back when Claude did no work (person and group keys only).
 * err: the HttpError to throw when this key is the one that is full.
 */
export function key(who, limit, { n = 1, refundable = false, err, period = 'day', now = new Date() } = {}) {
  const day = period === 'month' ? monthOf(now) : period === 'hour' ? hourOf(now) : dayOf(now);
  return { who, day, limit: Math.max(0, Math.floor(Number(limit) || 0)), n, refundable, err, period };
}
const dec = (env, k) => env.DB.prepare('UPDATE ai_usage SET count = MAX(count - ?, 0) WHERE who = ? AND day = ?').bind(k.n, k.who, k.day);

/** One request's counters, all or nothing. Returns { ok, counts } or { ok: false, error, key }. */
export async function take(env, keys) {
  const list = keys.filter(Boolean);
  const over = list.find((k) => k.n > k.limit);
  if (over) return { ok: false, error: over.err, key: over };
  if (!list.length) return { ok: true, counts: [] };
  const res = await env.DB.batch(list.map((k) => env.DB.prepare(
    `INSERT INTO ai_usage (who, day, count) VALUES (?1, ?2, ?3)
     ON CONFLICT (who, day) DO UPDATE SET count = count + excluded.count WHERE ai_usage.count + excluded.count <= ?4
     RETURNING count`,
  ).bind(k.who, k.day, k.n, k.limit)));
  const bad = list.findIndex((k, i) => !res[i]?.results?.length);
  if (bad < 0) return { ok: true, counts: res.map((r) => r.results[0].count) };
  const done = list.filter((k, i) => res[i]?.results?.length);
  if (done.length) await env.DB.batch(done.map((k) => dec(env, k)));
  return { ok: false, error: list[bad].err, key: list[bad] };
}

/** Give back the refundable keys of a request (Claude did no work). Network, class, global and tries keys stay. */
export async function giveBack(env, keys) {
  const list = (keys || []).filter((k) => k && k.refundable);
  if (list.length) await env.DB.batch(list.map((k) => dec(env, k)));
}

/** The current counts of some keys, without counting. */
export async function peek(env, keys) {
  const list = keys.filter(Boolean);
  if (!list.length) return [];
  const rows = (await env.DB.prepare(
    `SELECT who, day, count FROM ai_usage WHERE who IN (${list.map(() => '?').join(',')}) AND day IN (${list.map(() => '?').join(',')})`,
  ).bind(...list.map((k) => k.who), ...list.map((k) => k.day)).all()).results || [];
  return list.map((k) => rows.find((r) => r.who === k.who && r.day === k.day)?.count || 0);
}

/** A plain rate limit: one counter; throws its error when full. */
export async function limitOrThrow(env, who, limit, status, code, period = 'day') {
  const r = await take(env, [key(who, limit, { period, err: new HttpError(status, code) })]);
  if (!r.ok) throw r.error;
  return r.counts[0];
}
