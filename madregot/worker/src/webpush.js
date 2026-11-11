// Web push crypto with WebCrypto only (no package), for the daily reminder (STUDENT-11, push.js).
//
// encryptPayload: the message body, encrypted for one subscription as RFC 8291 says (Message Encryption for Web Push):
//   ECDH on P-256 between a fresh key pair of ours and the browser's p256dh key, HKDF with the browser's 16-byte auth
//   secret, then the aes128gcm content coding of RFC 8188 in a single record (salt, record size, our public key, and
//   AES-128-GCM over the text and the 0x02 padding delimiter).
// vapidJwt: the application server's identity for the push service (RFC 8292, VAPID): an ES256 JWT with aud (the push
//   service's origin), exp (at most 12 hours ahead) and sub (VAPID_SUBJECT), signed with VAPID_PRIVATE_JWK.
// Both are covered by test vectors and a WebCrypto verify in test/webpush.test.js.

const te = new TextEncoder();
const subtle = () => crypto.subtle;

/** Bytes to base64url without padding. */
export function b64u(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url (padding allowed) to bytes; null for anything else. */
export function fromB64u(text) {
  if (typeof text !== 'string') return null;
  const raw = text;
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(raw)) return null;
  const s = raw.replace(/=+$/, '');
  if (s.length % 4 === 1) return null;
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

/** HKDF-SHA-256 (RFC 5869): `length` bytes from salt, input keying material and info. */
async function hkdf(salt, ikm, info, length) {
  const key = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** A browser's P-256 public key (65 bytes, 0x04 x y) as an ECDH key; throws when the point is not on the curve. */
export const importPublic = (raw) => subtle().importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, []);

/** RFC 8188 record size: one record always holds a reminder (RFC 8291 §4 allows 4096 bytes of body at most). */
export const RECORD_SIZE = 4096;

/**
 * Encrypt a message for one subscription: { p256dh, auth } as the browser gave them (base64url). Returns the request
 * body (Uint8Array): the 86-byte aes128gcm header, then the ciphertext and its tag. `salt` and `asKeyPair` (an ECDH
 * key pair whose public key is extractable) are for the RFC's test vector; normally both are fresh for every message.
 */
export async function encryptPayload({ p256dh, auth }, plaintext, { salt, asKeyPair } = {}) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  if (uaPublic?.length !== 65 || uaPublic[0] !== 4 || authSecret?.length !== 16) throw new Error('bad_keys');
  const s = salt || crypto.getRandomValues(new Uint8Array(16));
  const pair = asKeyPair || await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  const ecdh = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: await importPublic(uaPublic) }, pair.privateKey, 256));
  // RFC 8291 §3.3: combine the shared secret with the auth secret
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  // RFC 8188 §2.2-2.3: the content encryption key and the nonce (one record: sequence number 0)
  const cek = await hkdf(s, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const text = typeof plaintext === 'string' ? te.encode(plaintext) : new Uint8Array(plaintext);
  if (text.length + 1 + 16 > RECORD_SIZE) throw new Error('too_large');
  const key = await subtle().importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, concat(text, Uint8Array.of(2))));
  const header = new Uint8Array(21);
  header.set(s, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  return concat(header, asPublic, sealed);
}

/** The private VAPID key's fields (a JWK as push-keys.mjs prints it), or null. */
export function parseVapidJwk(text) {
  try {
    const j = typeof text === 'string' ? JSON.parse(text) : text;
    if (!j || j.kty !== 'EC' || j.crv !== 'P-256' || !j.d || !j.x || !j.y) return null;
    return { kty: 'EC', crv: 'P-256', d: j.d, x: j.x, y: j.y };
  } catch { return null; }
}

/** The public key (base64url, 65 bytes) that belongs to a private JWK. */
export function publicOfJwk(jwk) {
  const x = fromB64u(jwk?.x); const y = fromB64u(jwk?.y);
  return x?.length === 32 && y?.length === 32 ? b64u(concat(Uint8Array.of(4), x, y)) : null;
}

/** The longest a VAPID token lives (RFC 8292 §2: at most 24 hours; push services prefer less). */
export const VAPID_TTL_S = 12 * 3600;

/**
 * An ES256 JWT for one push service origin (RFC 8292 §2): header {"typ":"JWT","alg":"ES256"}, claims { aud, exp, sub }.
 * `audience` is the origin of the endpoint (https://fcm.googleapis.com). One per origin per run is enough.
 */
export async function vapidJwt(env, audience, now = new Date()) {
  const jwk = parseVapidJwk(env.VAPID_PRIVATE_JWK);
  if (!jwk) throw new Error('vapid_key');
  const header = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(te.encode(JSON.stringify({ aud: audience, exp: Math.floor(now.getTime() / 1000) + VAPID_TTL_S, sub: env.VAPID_SUBJECT })));
  const key = await subtle().importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto's ECDSA signature is r || s (64 bytes), which is what JWS ES256 uses
  const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64u(sig)}`;
}

/** The Authorization header of a push request (RFC 8292 §3). */
export const vapidAuth = (jwt, publicKey) => `vapid t=${jwt}, k=${publicKey}`;
