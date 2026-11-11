// Digital Asset Links for the Play Store app (STUDENT-12 §2): /.well-known/assetlinks.json is answered by the Worker
// from ANDROID_PACKAGE and ANDROID_CERT_SHA256, [] while they are empty, as application/json. wrangler.toml must send
// /.well-known/* to the Worker (run_worker_first), or the static files would answer it. In-memory D1; nothing leaves.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setup } from './helpers.js';
import { assetLinks } from '../src/assetlinks.js';

const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');
const A = Array.from({ length: 32 }, (_, i) => (i * 7 + 16).toString(16).toUpperCase().padStart(2, '0')).join(':');
const B = Array.from({ length: 32 }, (_, i) => (255 - i).toString(16).toUpperCase().padStart(2, '0')).join(':');

let h;
afterEach(() => h?.done());

const get = (env, method = 'GET') => setup(env).then((x) => { h = x; return h.call(method, '/.well-known/assetlinks.json'); });

test('wrangler.toml sends /.well-known/* to the Worker and ships the two vars empty', () => {
  const first = /^run_worker_first\s*=\s*\[([^\]]*)\]/m.exec(toml)[1];
  assert.deepEqual(first.split(',').map((s) => s.trim().replace(/"/g, '')), ['/api/*', '/.well-known/*']);
  assert.match(toml, /^ANDROID_PACKAGE = ""$/m);
  assert.match(toml, /^ANDROID_CERT_SHA256 = ""$/m);
});

test('unset: [] as application/json, so no app may open the site', async () => {
  const res = await get({ ANDROID_PACKAGE: '', ANDROID_CERT_SHA256: '' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await res.json(), []);
  // a package with no fingerprint, or fingerprints with no package, is still nothing
  assert.deepEqual(assetLinks({ ANDROID_PACKAGE: 'il.example.madregot' }), []);
  assert.deepEqual(assetLinks({ ANDROID_CERT_SHA256: A }), []);
});

test('set: one statement for the app with both fingerprints (the Play signing key and the upload key)', async () => {
  const res = await get({ ANDROID_PACKAGE: 'il.example.madregot', ANDROID_CERT_SHA256: `${A}, ${B.toLowerCase()}` });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/json');
  assert.match(res.headers.get('Cache-Control'), /max-age=3600/);
  assert.deepEqual(await res.json(), [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: 'il.example.madregot', sha256_cert_fingerprints: [A, B] },
  }]);
});

test('a trailing slash and HEAD are answered too; other methods and paths under /.well-known/ are not found', async () => {
  const env = { ANDROID_PACKAGE: 'il.example.madregot', ANDROID_CERT_SHA256: A };
  h = await setup(env);
  assert.equal((await h.call('GET', '/.well-known/assetlinks.json/')).status, 200);
  assert.equal((await h.call('HEAD', '/.well-known/assetlinks.json')).status, 200);
  assert.equal((await h.call('POST', '/.well-known/assetlinks.json', { body: {} })).status, 404);
  assert.equal((await h.call('GET', '/.well-known/security.txt')).status, 404);
});

test('a mistyped fingerprint is left out and the others stay; a bad package id gives []', () => {
  const warn = console.warn;
  const seen = [];
  console.warn = (m) => seen.push(m);
  try {
    const [s] = assetLinks({ ANDROID_PACKAGE: 'il.example.madregot', ANDROID_CERT_SHA256: `${A},AB:CD,${A.replace(/:/g, '')}` });
    assert.deepEqual(s.target.sha256_cert_fingerprints, [A]);
    assert.deepEqual(assetLinks({ ANDROID_PACKAGE: 'il.example.madregot', ANDROID_CERT_SHA256: 'AB:CD' }), []);
    assert.deepEqual(assetLinks({ ANDROID_PACKAGE: 'madregot', ANDROID_CERT_SHA256: A }), []);
    assert.deepEqual(assetLinks({ ANDROID_PACKAGE: 'il.example.<script>', ANDROID_CERT_SHA256: A }), []);
  } finally {
    console.warn = warn;
  }
  assert.ok(seen.some((m) => /fingerprint/.test(m)) && seen.some((m) => /package/.test(m)), seen.join(' | '));
});
