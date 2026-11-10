// Small helpers shared by the Worker's modules: responses, errors, hashing, tokens, dates and daily counters.

export const TZ = 'Asia/Jerusalem';
export const dayOf = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });
export const nowIso = () => new Date().toISOString();
export const daysAgo = (n) => dayOf(new Date(Date.now() - n * 864e5));

export const json = (data, status, cors, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

export class HttpError extends Error {
  constructor(status, code, message, extra) { super(message || code); this.status = status; this.code = code; this.extra = extra; }
}

export async function body(req) {
  try { return await req.json(); } catch { throw new HttpError(400, 'bad_json'); }
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

export const clientIp = (req) => req.headers.get('CF-Connecting-IP') || 'unknown';

/** How many times `who` has counted today. */
export async function usedToday(env, who) {
  const row = await env.DB.prepare('SELECT count FROM ai_usage WHERE who = ? AND day = ?').bind(who, dayOf()).first();
  return row ? row.count : 0;
}

/** Daily counter per identity; returns false once the limit is reached (and then does not count). */
export async function spend(env, who, limit) {
  const day = dayOf();
  const row = await env.DB.prepare('SELECT count FROM ai_usage WHERE who = ? AND day = ?').bind(who, day).first();
  if (row && row.count >= limit) return false;
  await env.DB.prepare(
    'INSERT INTO ai_usage (who, day, count) VALUES (?, ?, 1) ON CONFLICT (who, day) DO UPDATE SET count = count + 1',
  ).bind(who, day).run();
  return true;
}

/** Give back one count (an AI call that failed before any work was done must not use up a free question). */
export async function refund(env, who) {
  await env.DB.prepare('UPDATE ai_usage SET count = MAX(count - 1, 0) WHERE who = ? AND day = ?').bind(who, dayOf()).run();
}
