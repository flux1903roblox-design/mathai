// A browser's side of web push, for the tests (STUDENT-11): a subscription with its own P-256 key pair and auth secret,
// which can decrypt what the Worker sends (RFC 8291 + RFC 8188, the receiver's half), and a fake push service.
// Every push address is synthetic; nothing leaves the machine.
import { b64u, fromB64u } from '../../src/webpush.js';

const te = new TextEncoder();
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** Decrypt an aes128gcm body with the receiver's private key (an ECDH CryptoKey), its public key and auth secret. */
export async function decryptBody(body, { privateKey, uaPublic, authSecret }) {
  const b = new Uint8Array(body);
  const salt = b.slice(0, 16);
  const rs = new DataView(b.buffer, b.byteOffset).getUint32(16);
  const idlen = b[20];
  const asPublic = b.slice(21, 21 + idlen);
  const sealed = b.slice(21 + idlen);
  const as = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: as }, privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, sealed));
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  if (plain[end] !== 2) throw new Error('bad padding delimiter');
  return { text: new TextDecoder().decode(plain.slice(0, end)), rs, idlen, asPublic };
}

/** A browser's subscription keys: { p256dh, auth } as PushSubscription.toJSON() gives them, and decrypt(body). */
export async function makeSubscription() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return {
    p256dh: b64u(uaPublic), auth: b64u(authSecret),
    decrypt: (body) => decryptBody(body, { privateKey: pair.privateKey, uaPublic, authSecret }),
  };
}

/** The RFC 8291 §5 example's keys (receiver and sender) as WebCrypto keys. */
export async function rfcKeys(v) {
  const asPub = fromB64u(v.asPublic);
  const jwk = (d, pub) => ({ kty: 'EC', crv: 'P-256', d, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33)) });
  const ecdh = { name: 'ECDH', namedCurve: 'P-256' };
  return {
    asKeyPair: {
      privateKey: await crypto.subtle.importKey('jwk', jwk(v.asPrivate, asPub), ecdh, false, ['deriveBits']),
      publicKey: await crypto.subtle.importKey('raw', asPub, ecdh, true, []),
    },
    ua: {
      privateKey: await crypto.subtle.importKey('jwk', jwk(v.uaPrivate, fromB64u(v.uaPublic)), ecdh, false, ['deriveBits']),
      uaPublic: fromB64u(v.uaPublic), authSecret: fromB64u(v.auth),
    },
  };
}
