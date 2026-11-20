// The local Worker for the contract tests (COUNCIL2-22, scripts/serve-local.mjs): it answers with the Worker's own
// handler on a database built from the migrations, keeps each tenant's database apart, records the sign-in email
// instead of sending it, never reaches the network, and its test-only routes read but never write.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 4428; // this lane's range is 4422-4429; the e2e contract project uses 4423
const base = `http://127.0.0.1:${PORT}`;
let child;

before(async () => {
  child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/serve-local.mjs', import.meta.url)), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('serve-local did not start');
});
after(() => { child?.kill(); });

const post = (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('the Worker\'s own answers, on a database from the migrations, with the test vars (test billing, vault on)', async () => {
  const health = await (await fetch(`${base}/t/h1/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.billing, 'test');
  assert.equal(health.vault, 'on');
  assert.equal(health.escrow, true);
  // every table of schema.sql is there (the migrations made them)
  const tables = (await (await post('/t/h1/__contract/sql', { sql: "SELECT name FROM sqlite_master WHERE type = 'table'" })).json()).rows.map((r) => r.name);
  for (const t of ['classes', 'students', 'attempts', 'vaults', 'vault_escrow', 'vault_tombstones', 'accounts', 'orders', 'subscriptions']) assert.ok(tables.includes(t), t);
});

test('each tenant has its own database', async () => {
  const c = await (await post('/t/ta/api/classes', { className: 'ז׳3', teacherName: 'רונית', grade: '7' })).json();
  assert.match(c.code, /^[A-HJ-KMNP-Z2-9]{6}$/);
  const inA = (await (await post('/t/ta/__contract/sql', { sql: 'SELECT code FROM classes' })).json()).rows;
  const inB = (await (await post('/t/tb/__contract/sql', { sql: 'SELECT code FROM classes' })).json()).rows;
  assert.deepEqual(inA, [{ code: c.code }]);
  assert.deepEqual(inB, []);
  // the class is the Worker's: a student joins it with the Worker's own rules
  const s = await post(`/t/ta/api/classes/${c.code}/join`, { name: 'נועה', pin: '1234' });
  assert.equal(s.status, 200);
  assert.equal((await post(`/t/tb/api/classes/${c.code}/join`, { name: 'נועה', pin: '1234' })).status, 404);
});

test('the sign-in email is recorded for its tenant, never sent; the code in it signs in', async () => {
  assert.equal((await post('/t/tm/api/account/code', { email: 'parent@example.test' })).status, 200);
  const { emails } = await (await fetch(`${base}/t/tm/__contract/emails`)).json();
  assert.equal(emails.length, 1);
  assert.deepEqual([].concat(emails[0].to), ['parent@example.test']);
  const code = String(emails[0].text).match(/(\d{6})/)[1];
  const v = await post('/t/tm/api/account/verify', { email: 'parent@example.test', code });
  assert.equal(v.status, 200);
  assert.ok((await v.json()).token);
  assert.deepEqual((await (await fetch(`${base}/t/other/__contract/emails`)).json()).emails, []);
});

test('the test-only routes only read', async () => {
  const r = await post('/t/tw/__contract/sql', { sql: 'DELETE FROM classes' });
  assert.equal(r.status, 400);
  assert.equal((await fetch(`${base}/t/tw/__contract/nothing`)).status, 404);
});
