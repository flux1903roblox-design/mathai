// The daily reminder's VAPID key pair (STUDENT-11), made with WebCrypto: npm run push:keys
// Prints the public key (base64url, 65 bytes: wrangler.toml VAPID_PUBLIC_KEY) and the private key as a JWK (the secret
// VAPID_PRIVATE_JWK: npx wrangler secret put VAPID_PRIVATE_JWK, then paste it). Writes nothing to disk: copy both now.
// Making a new pair later ends every reminder already turned on (each browser subscribed with the old public key).
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { b64u } from '../src/webpush.js';

/** A fresh P-256 pair: { publicKey (base64url), jwk ({ kty, crv, d, x, y }) }. */
export async function makeVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const { kty, crv, d, x, y } = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64u(raw), jwk: { kty, crv, d, x, y } };
}

async function main() {
  const { publicKey, jwk } = await makeVapidKeys();
  console.log([
    'VAPID_PUBLIC_KEY (wrangler.toml [vars]):',
    publicKey,
    '',
    'VAPID_PRIVATE_JWK (npx wrangler secret put VAPID_PRIVATE_JWK, then paste this line; keep it nowhere else):',
    JSON.stringify(jwk),
    '',
    'Then in wrangler.toml: VAPID_SUBJECT = "mailto:<CONTACT_EMAIL>", PUSH = "on", and deploy.',
  ].join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
