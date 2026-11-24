// The daily reminder's crypto (STUDENT-11, src/webpush.js): the RFC 8291 §5 example byte for byte, a round trip with
// fresh keys, the VAPID token of RFC 8292 checked with WebCrypto's own verify, and the key script (push-keys.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptPayload, vapidJwt, vapidAuth, b64u, fromB64u, parseVapidJwk, publicOfJwk, RECORD_SIZE, VAPID_TTL_S } from '../src/webpush.js';
import { makeVapidKeys } from '../scripts/push-keys.mjs';
import { makeSubscription, rfcKeys, decryptBody } from './fixtures/push.js';

// RFC 8291 §5 and Appendix A (rfc-editor.org/rfc/rfc8291.txt)
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  // the 86-octet header (salt, rs 4096, idlen 65, as_public), then the ciphertext of Appendix A
  header: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

test('RFC 8291 §5: the example message encrypts to the RFC\'s body, byte for byte', async () => {
  const { asKeyPair, ua } = await rfcKeys(RFC);
  const out = await encryptPayload({ p256dh: RFC.uaPublic, auth: RFC.auth }, RFC.plaintext, { salt: fromB64u(RFC.salt), asKeyPair });
  assert.equal(b64u(out), RFC.body);
  assert.deepEqual([...out], [...fromB64u(RFC.body)]);
  // its two parts as Appendix A shows them
  assert.equal(b64u(out.slice(0, 86)), RFC.header);
  assert.equal(b64u(out.slice(86)), RFC.ciphertext);
  // and the receiver reads it back with its own private key
  const back = await decryptBody(out, ua);
  assert.equal(back.text, RFC.plaintext);
  assert.equal(back.rs, 4096);
  assert.equal(back.idlen, 65);
});

test('fresh keys every message: a new salt and key pair each time, and the subscriber reads it', async () => {
  const sub = await makeSubscription();
  const text = JSON.stringify({ web_push: 8030, notification: { title: 'מדרגות', body: 'שיעור קצר אחד היום, וזה מספיק.' } });
  const a = await encryptPayload(sub, text);
  const b = await encryptPayload(sub, text);
  assert.notDeepEqual([...a.slice(0, 16)], [...b.slice(0, 16)], 'a new salt');
  assert.notDeepEqual([...a.slice(21, 86)], [...b.slice(21, 86)], 'a new sender key');
  assert.equal(a[21], 4);
  assert.equal(new DataView(a.buffer).getUint32(16), RECORD_SIZE);
  assert.equal(a.length, 86 + new TextEncoder().encode(text).length + 1 + 16, 'one record: header, text, delimiter, tag');
  assert.equal((await sub.decrypt(a)).text, text);
  assert.equal((await sub.decrypt(b)).text, text);
  // a subscription's keys of the wrong size are refused before any crypto
  await assert.rejects(encryptPayload({ p256dh: sub.p256dh.slice(0, 40), auth: sub.auth }, 'x'), /bad_keys/);
  await assert.rejects(encryptPayload({ p256dh: sub.p256dh, auth: 'AAAA' }, 'x'), /bad_keys/);
  await assert.rejects(encryptPayload(sub, 'x'.repeat(4096)), /too_large/);
});

test('base64url both ways; anything that is not base64url is refused', () => {
  for (const n of [0, 1, 2, 3, 16, 65]) {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    const s = b64u(bytes);
    assert.doesNotMatch(s, /[+/=]/);
    assert.deepEqual([...fromB64u(s)], [...bytes]);
  }
  assert.deepEqual([...fromB64u('AQID')], [1, 2, 3]);
  assert.deepEqual([...fromB64u('AQ==')], [1], 'padding is allowed');
  for (const bad of ['a+b/', 'AQ=A', 'A', '<script>', 'AQID AQID', null, undefined, 5, {}]) assert.equal(fromB64u(bad), null, String(bad));
});

const verifyJwt = async (jwt, publicKey) => {
  const [h, c, s] = jwt.split('.');
  const key = await crypto.subtle.importKey('raw', fromB64u(publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64u(s), new TextEncoder().encode(`${h}.${c}`));
};
const part = (jwt, i) => JSON.parse(new TextDecoder().decode(fromB64u(jwt.split('.')[i])));

test('RFC 8292 VAPID: an ES256 JWT { aud, exp ≤ 12 h, sub } that verifies with the public key', async () => {
  const { publicKey, jwk } = await makeVapidKeys();
  const env = { VAPID_PRIVATE_JWK: JSON.stringify(jwk), VAPID_PUBLIC_KEY: publicKey, VAPID_SUBJECT: 'mailto:hello@example.test' };
  const now = new Date('2026-11-10T15:37:00Z');
  const jwt = await vapidJwt(env, 'https://fcm.googleapis.com', now);
  assert.match(jwt, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(part(jwt, 0), { typ: 'JWT', alg: 'ES256' });
  assert.equal(new TextDecoder().decode(fromB64u(jwt.split('.')[0])), '{"typ":"JWT","alg":"ES256"}');
  const claims = part(jwt, 1);
  assert.deepEqual(claims, { aud: 'https://fcm.googleapis.com', exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: 'mailto:hello@example.test' });
  assert.ok(claims.exp - now.getTime() / 1000 <= 12 * 3600 && VAPID_TTL_S === 12 * 3600);
  assert.equal(fromB64u(jwt.split('.')[2]).length, 64, 'r || s, as JWS ES256 wants');
  assert.equal(await verifyJwt(jwt, publicKey), true);
  // another key does not verify it, and a changed claim breaks the signature
  const other = await makeVapidKeys();
  assert.equal(await verifyJwt(jwt, other.publicKey), false);
  const [h, , s] = jwt.split('.');
  const forged = `${h}.${b64u(new TextEncoder().encode(JSON.stringify({ ...claims, aud: 'https://evil.example' })))}.${s}`;
  assert.equal(await verifyJwt(forged, publicKey), false);
  assert.equal(vapidAuth(jwt, publicKey), `vapid t=${jwt}, k=${publicKey}`);
  await assert.rejects(vapidJwt({ ...env, VAPID_PRIVATE_JWK: '' }, 'https://fcm.googleapis.com', now), /vapid_key/);
});

test('push-keys.mjs: a P-256 pair whose JWK and public key belong together, printed and never written', async () => {
  const { publicKey, jwk } = await makeVapidKeys();
  assert.equal(fromB64u(publicKey).length, 65);
  assert.equal(fromB64u(publicKey)[0], 4);
  assert.deepEqual(Object.keys(jwk).sort(), ['crv', 'd', 'kty', 'x', 'y']);
  assert.deepEqual(parseVapidJwk(JSON.stringify(jwk)), jwk);
  assert.equal(publicOfJwk(jwk), publicKey);
  assert.equal(parseVapidJwk('{"kty":"RSA"}'), null);
  assert.equal(parseVapidJwk('not json'), null);
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'push-keys.mjs');
  const dir = mkdtempSync(path.join(tmpdir(), 'push-keys-'));
  try {
    const out = execFileSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
    const lines = out.split('\n');
    const pub = lines[lines.indexOf('VAPID_PUBLIC_KEY (wrangler.toml [vars]):') + 1];
    const priv = JSON.parse(lines.find((l) => l.startsWith('{')));
    assert.equal(fromB64u(pub).length, 65);
    assert.equal(publicOfJwk(priv), pub, 'the printed pair belongs together');
    assert.deepEqual(readdirSync(dir), [], 'nothing was written');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
