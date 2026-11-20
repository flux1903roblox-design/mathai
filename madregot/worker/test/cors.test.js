// Who may call the API from another address (STUDENT-12): the iPhone store app's pages load from capacitor://localhost
// and call the API on PUBLIC_URL, so wrangler.toml's ALLOWED_ORIGINS lists it; any other site gets no permission.
// The origins are read from wrangler.toml itself, so the test fails if the line is lost. In-memory D1; nothing leaves.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setup } from './helpers.js';

const toml = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');
const ALLOWED_ORIGINS = /^ALLOWED_ORIGINS\s*=\s*"([^"]*)"/m.exec(toml)[1];

let h;
afterEach(() => h?.done());

const preflight = (origin, path = '/api/ai/explain') => h.call('OPTIONS', path, {
  headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-device' },
});

test('wrangler.toml allows the iPhone app\'s origin, next to the local dev ones', () => {
  assert.deepEqual(ALLOWED_ORIGINS.split(',').map((s) => s.trim()), ['http://localhost:5173', 'http://127.0.0.1:5173', 'capacitor://localhost']);
});

test('a preflight from capacitor://localhost is allowed, for the AI and the other API calls', async () => {
  h = await setup({ ALLOWED_ORIGINS });
  for (const path of ['/api/ai/explain', '/api/ai/status', '/api/progress', '/api/metrics']) {
    const res = await preflight('capacitor://localhost', path);
    assert.equal(res.status, 204, path);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost', path);
    assert.match(res.headers.get('Access-Control-Allow-Methods'), /POST/);
    assert.match(res.headers.get('Access-Control-Allow-Headers'), /X-Device/);
    assert.equal(res.headers.get('Vary'), 'Origin');
  }
  // the answer itself carries the same permission, so the app can read it
  const status = await h.call('GET', '/api/ai/status', { headers: { Origin: 'capacitor://localhost', 'X-Device': 'a'.repeat(32) } });
  assert.equal(status.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
});

test('a preflight from another site is not allowed: the answer never names that site, nor any site at all', async () => {
  h = await setup({ ALLOWED_ORIGINS });
  for (const origin of ['https://evil.example', 'capacitor://localhost.evil.example', 'http://capacitor', 'null']) {
    const res = await preflight(origin);
    const allow = res.headers.get('Access-Control-Allow-Origin');
    assert.notEqual(allow, origin, origin);
    assert.notEqual(allow, '*', origin);
    assert.ok(ALLOWED_ORIGINS.split(',').includes(allow), `${origin} → ${allow}`);
  }
});
