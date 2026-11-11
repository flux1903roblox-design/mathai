// The vault's cryptography (DURABLE-5), WebCrypto only (Node 22 has the same API, so the tests run it as it is).
//   derive(code)  PBKDF2-SHA-256, 100,000 iterations, salt "madregot-vault-v1", 512 bits: bytes 0-31 become the AES-256-GCM
//                 key (a CryptoKey that cannot be exported), bytes 32-63 the lookup token (64 hex, sent as X-Vault; the
//                 server keeps only its SHA-256). Slow on purpose, so a copy of the database cannot be searched cheaply;
//                 the real protection is the code's 74 bits, which is why one fixed salt is enough. Once per code in a
//                 session (it takes 0.1-0.3 s on a mid phone).
//   seal(payload, key)  JSON, gzip (CompressionStream), AES-GCM with a random 12-byte IV and the additional data
//                 "madregot-vault-v1": base64url(0x01 | iv | ciphertext). open(blob, key) reverses it; any failure is a
//                 VaultOpenError. The key and the code never leave the device.

export const VAULT_SALT = 'madregot-vault-v1';
export const VAULT_AAD = 'madregot-vault-v1';
export const ITERATIONS = 100_000;
const VERSION = 1;
const IV_BYTES = 12;

/** The backup was found but could not be opened: a wrong code, a damaged copy, or a format this app does not know. */
export class VaultOpenError extends Error {
  constructor(message = 'the vault could not be opened') { super(message); this.name = 'VaultOpenError'; }
}

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of a text, as 64 hex. */
export async function sha256Hex(text) {
  return hex(new Uint8Array(await subtle().digest('SHA-256', enc.encode(text))));
}

const cache = new Map();
/** The AES key and the lookup token of a code, `{ key, lookup }`, made once per code in this session. */
export function derive(code) {
  const c = String(code);
  if (!cache.has(c)) {
    const made = (async () => {
      const base = await subtle().importKey('raw', enc.encode(c), 'PBKDF2', false, ['deriveBits']);
      const bits = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(VAULT_SALT), iterations: ITERATIONS }, base, 512));
      const key = await subtle().importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      const lookup = hex(bits.slice(32));
      bits.fill(0);
      return { key, lookup };
    })();
    made.catch(() => cache.delete(c));
    cache.set(c, made);
  }
  return cache.get(c);
}
/** Forget the derived keys (tests, and when a backup is stopped). */
export const forgetDerived = () => cache.clear();

/** All of a stream's bytes. */
async function drain(readable) {
  const reader = readable.getReader();
  const parts = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); size += value.byteLength;
  }
  const out = new Uint8Array(size); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}
const through = (bytes, transform) => drain(new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }).pipeThrough(transform));
export const gzip = (bytes) => through(bytes, new CompressionStream('gzip'));
export const gunzip = (bytes) => through(bytes, new DecompressionStream('gzip'));

/** base64url without padding, in chunks (a 256 KiB copy is too big for one String.fromCharCode call). */
export function toBase64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64url(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text)) throw new VaultOpenError('not base64url');
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

/** The size in bytes of the binary a blob holds (what the 256 KiB limit counts). */
export const blobBytes = (blob) => Math.floor((String(blob).length * 3) / 4);

/** Seal a payload with the key: base64url(0x01 | iv | AES-GCM(gzip(JSON))). `aad` is for tests. */
export async function seal(payload, key, { aad = VAULT_AAD } = {}) {
  const packed = await gzip(enc.encode(JSON.stringify(payload)));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, packed));
  const out = new Uint8Array(1 + IV_BYTES + ct.length);
  out[0] = VERSION; out.set(iv, 1); out.set(ct, 1 + IV_BYTES);
  return toBase64url(out);
}

/** Open a sealed blob: the payload, or a VaultOpenError whatever went wrong. */
export async function open(blob, key, { aad = VAULT_AAD } = {}) {
  try {
    const bytes = fromBase64url(blob);
    if (bytes.length <= 1 + IV_BYTES || bytes[0] !== VERSION) throw new VaultOpenError('unknown format');
    const plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: bytes.subarray(1, 1 + IV_BYTES), additionalData: enc.encode(aad) }, key, bytes.subarray(1 + IV_BYTES)));
    return JSON.parse(new TextDecoder().decode(await gunzip(plain)));
  } catch (e) {
    throw e instanceof VaultOpenError ? e : new VaultOpenError();
  }
}
