// The load test for the catalogue's technical check (TEACHER-12 §2, worker/scripts/loadtest.mjs): its dry run prints
// the plan and sends nothing, it refuses production and a missing address, and a short run against a fake Worker keeps
// to its pool, counts errors and percentiles, and deletes its test classes. Nothing here touches a network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { main, parse, plan, percentile, summarize, USAGE } from '../scripts/loadtest.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/loadtest.mjs', import.meta.url));
const STAGING = 'https://staging.example.test';
const noNetwork = () => { throw new Error('a dry run must not use the network'); };

test('--dry-run prints the plan and calls no fetch, in the process and as a module', async () => {
  const lines = [];
  const out = await main([STAGING, '--dry-run'], { fetch: noNetwork, log: (s) => lines.push(s), env: {}, toml: '' });
  assert.equal(out, null);
  const text = lines.join('\n');
  assert.match(text, /^Load test plan \(dry run: nothing is sent\)/);
  assert.match(text, /target: https:\/\/staging\.example\.test/);
  assert.match(text, /5 classes × 30 students: 5 POST \/api\/classes, 150 POST \/api\/classes\/:code\/join/);
  assert.match(text, /POST \/api\/progress every 20 s \(5 answers\): about 2250 requests/);
  assert.match(text, /GET \/api\/teacher\/dashboard every 30 s: about 50 requests/);
  assert.match(text, /p50, p95 and the error rate/);
  assert.deepEqual(plan({ classes: 10, students: 30, minutes: 5, every: 20, board: 30 }), { setup: { classes: 10, joins: 300 }, progress: 4500, dashboard: 100 });
  const proc = spawnSync(process.execPath, [SCRIPT, STAGING, '--classes', '10', '--dry-run'], { encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 20_000 });
  assert.equal(proc.status, 0, proc.stderr);
  assert.match(proc.stdout, /10 classes × 30 students/);
});

test('it needs a staging address, and refuses production and bad options', () => {
  assert.throws(() => parse([], {}, ''), (e) => e.message.includes(USAGE));
  assert.throws(() => parse(['ftp://x.example.test'], {}, ''), /not an http/);
  assert.throws(() => parse(['https://app.example.test/', '--dry-run'], { MADREGOT_PRODUCTION_URL: 'https://app.example.test' }, ''), /refused: app\.example\.test is the production address/);
  assert.throws(() => parse(['https://app.example.test'], {}, 'PUBLIC_URL = "https://app.example.test"'), /production/);
  assert.throws(() => parse([STAGING, '--classes', '11'], {}, ''), /--classes must be from 1 to 10/);
  assert.throws(() => parse([STAGING, '--students', '31'], {}, ''), /--students/);
  assert.throws(() => parse([STAGING, '--nope', '1'], {}, ''), /unknown option/);
  assert.deepEqual(parse([`${STAGING}/`, '--minutes', '0.5', '--keep'], {}, '').opts.minutes, 0.5);
  const proc = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH }, timeout: 20_000 });
  assert.equal(proc.status, 1);
  assert.match(proc.stderr, /the staging address is required/);
});

test('a short run against a fake Worker: the pool\'s limit, p50/p95, the error rate, and the classes deleted', async () => {
  const calls = []; let inflight = 0; let most = 0; let clock = 0; let n = 0;
  const fake = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers || {} });
    inflight++; most = Math.max(most, inflight);
    await new Promise((r) => setImmediate(r));
    inflight--;
    clock += 10;
    const p = new URL(url).pathname;
    const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (p === '/api/classes') return reply(200, { code: `LT${calls.length}`, teacherKey: `key-${calls.length}` });
    if (p.endsWith('/join')) return reply(200, { token: `tok-${calls.length}` });
    if (p === '/api/progress') { n++; return n % 10 === 0 ? reply(500, { error: 'boom' }) : reply(200, { saved: 5 }); }
    return reply(200, {});
  };
  const sum = await main([STAGING, '--classes', '2', '--students', '5', '--minutes', '0.05', '--every', '1', '--board', '6', '--concurrency', '3'],
    { fetch: fake, log: () => {}, now: () => clock, wait: async () => {}, random: () => 0, env: {}, toml: '' });
  assert.ok(calls.every((c) => c.url.startsWith(`${STAGING}/api/`)), 'only the staging address');
  assert.ok(most <= 3, `at most 3 in flight (saw ${most})`);
  // 2 classes × 5 students × 3 posts (0, 1 s, 2 s within 3 s), and 2 boards × 1 load
  assert.equal(sum.progress.n, 30); assert.equal(sum.dashboard.n, 2); assert.equal(sum.all.n, 32);
  assert.equal(sum.progress.errorRate, 0.1); assert.equal(sum.dashboard.errorRate, 0);
  assert.equal(typeof sum.all.p50, 'number'); assert.ok(sum.all.p95 >= sum.all.p50);
  const deletes = calls.filter((c) => c.url.endsWith('/api/teacher/class/delete'));
  assert.equal(deletes.length, 2);
  assert.ok(deletes.every((d) => d.headers['X-Teacher-Key'] && d.headers['X-Class-Code']));
  assert.ok(calls.filter((c) => c.url.endsWith('/api/progress')).every((c) => /^Bearer tok-/.test(c.headers.Authorization)));
});

test('percentiles are nearest-rank; the summary groups by kind', () => {
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(xs, 50), 50); assert.equal(percentile(xs, 95), 95); assert.equal(percentile([], 50), null); assert.equal(percentile([7], 95), 7);
  const s = summarize([{ kind: 'a', ms: 10, ok: true }, { kind: 'a', ms: 30, ok: false }, { kind: 'b', ms: 20, ok: true }]);
  assert.deepEqual(s.a, { n: 2, p50: 10, p95: 30, errorRate: 0.5 });
  assert.deepEqual(s.all, { n: 3, p50: 20, p95: 30, errorRate: 1 / 3 });
});
