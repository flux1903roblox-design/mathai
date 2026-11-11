// The go-live check (DURABLE-16, src/readiness.js and `npm run owner -- doctor`): what is missing for each feature the
// owner turned on, the exact command for each, never a secret's value; every secret wrangler.toml names has a rule; and
// /api/health says only whether things are set, as booleans.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readiness, formatReadiness, NOT_CHECKED, RANDOM_SECRETS } from '../src/readiness.js';
import { readToml, devVarNames, unappliedFrom } from '../scripts/owner.mjs';
import { setup } from './helpers.js';

const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const ALWAYS = ['AUTH_SECRET', 'IP_HASH_SECRET', 'ANTHROPIC_API_KEY'];
/** A complete live configuration with the paid tutor on and Grow as the provider. */
const complete = () => ({
  vars: {
    ...readToml(toml).vars, PUBLIC_URL: 'https://madregot.example.test', CONTACT_EMAIL: 'hello@example.test', EMAIL_FROM: 'מדרגות <hello@example.test>',
    AI_PAYWALL: 'on', BILLING_PROVIDER: 'grow', BILLING_MODE: 'live', GROW_API_BASE: 'https://grow.example.test/api/light/server/1.0/',
    BILLING_CHECKOUT_HOSTS: 'pay.example.test', GROW_DIRECT_DEBIT_API: 'on',
  },
  databaseId: '00000000-0000-0000-0000-000000000000',
  secrets: new Set([...ALWAYS, 'RESEND_API_KEY', 'WEBHOOK_PATH_SECRET', 'VAULT_SECRET', 'GROW_USER_ID', 'GROW_PAGE_CODE_ONCE', 'GROW_PAGE_CODE_RECURRING', 'GROW_API_KEY']),
  migrationsApplied: MIGRATIONS, migrationsInRepo: MIGRATIONS, ratelimits: readToml(toml).ratelimits, health: { ok: true },
});
const failing = (r) => r.items.filter((i) => !i.ok && i.required).map((i) => i.id);

test('nothing set: every "always" item fails, each with its command', () => {
  const r = readiness({ migrationsInRepo: MIGRATIONS, migrationsApplied: [] });
  assert.equal(r.ok, false);
  const ids = failing(r);
  for (const id of ['db:id', 'db:migrations', 'secret:AUTH_SECRET', 'secret:IP_HASH_SECRET', 'secret:ANTHROPIC_API_KEY', 'site:url', 'site:contact', 'secret:VAULT_SECRET']) assert.ok(ids.includes(id), id);
  for (const i of r.items.filter((x) => !x.ok)) { assert.ok(i.how.length > 5, i.id); assert.ok(i.area, i.id); }
  assert.equal(r.items.find((i) => i.id === 'secret:AUTH_SECRET').how, 'openssl rand -hex 32 | npx wrangler secret put AUTH_SECRET');
  assert.equal(r.items.find((i) => i.id === 'secret:ANTHROPIC_API_KEY').how, 'npx wrangler secret put ANTHROPIC_API_KEY');
  assert.match(r.items.find((i) => i.id === 'db:migrations').need, /0008_vault_guard\.sql/);
  const text = formatReadiness(r);
  assert.match(text, /^✗ כניסה במייל: חסר AUTH_SECRET/m);
  assert.match(text, /^✗ בסיס הנתונים: /m);
});

test('a complete configuration is ok; the paid tutor on Grow without its recurring page code fails on exactly that', () => {
  const c = complete();
  const r = readiness(c);
  assert.deepEqual(failing(r), []);
  assert.equal(r.ok, true);
  assert.match(formatReadiness(r), /^✓ תשלום: GROW_PAGE_CODE_RECURRING$/m);
  c.secrets.delete('GROW_PAGE_CODE_RECURRING');
  const r2 = readiness(c);
  assert.equal(r2.ok, false);
  assert.deepEqual(failing(r2), ['secret:GROW_PAGE_CODE_RECURRING']);
  assert.match(formatReadiness(r2), /^✗ תשלום: חסר GROW_PAGE_CODE_RECURRING \(מ־Grow\) → npx wrangler secret put GROW_PAGE_CODE_RECURRING$/m);
});

test('rules follow the switches: no email rule without EMAIL_FROM, no payment rules with the paywall off, Grow\'s base only in live mode', () => {
  const c = complete();
  c.vars.EMAIL_FROM = ''; c.secrets.delete('RESEND_API_KEY');
  assert.equal(readiness(c).ok, true, 'email off is a reminder, not a failure');
  assert.equal(readiness(c).items.find((i) => i.id === 'mail:from').required, false);
  c.vars.AI_PAYWALL = 'off'; c.secrets.delete('WEBHOOK_PATH_SECRET'); c.secrets.delete('GROW_USER_ID');
  assert.equal(readiness(c).ok, true);
  assert.ok(!readiness(c).items.some((i) => i.area === 'תשלום'));
  const g = complete(); g.vars.BILLING_MODE = 'test'; g.vars.GROW_API_BASE = '';
  assert.equal(readiness(g).ok, true, 'test mode uses the sandbox base');
  g.vars.BILLING_MODE = 'live';
  assert.deepEqual(failing(readiness(g)), ['pay:grow-base']);
  const b = complete(); b.vars.FAMILY_MONTHLY_BUDGET_USD = '5';
  assert.deepEqual(failing(readiness(b)), ['pay:budget']);
  const v = complete(); v.vars.VAULT = 'off'; v.secrets.delete('VAULT_SECRET');
  assert.equal(readiness(v).ok, true);
  const h = complete(); h.health = null;
  assert.deepEqual(failing(readiness(h)), ['site:health']);
});

test('every secret wrangler.toml names has a rule (or a stated reason not to check it)', () => {
  const comment = toml.split('\n').filter((l) => /^#\s+[A-Z][A-Z0-9_]{3,}\b/.test(l)).flatMap((l) => l.match(/\b[A-Z][A-Z0-9_]{3,}\b/g).filter((n) => /SECRET|KEY|JWK|GROW_|_ID$/.test(n)));
  const named = new Set(comment.filter((n) => !['ON', 'TURNSTILE'].includes(n)));
  // every rule turned on at once: the secrets the rules check
  const all = readiness({ ...complete(), vars: { ...complete().vars, FREE_DEVICE_MINT: 'turnstile', PUSH: 'on' }, secrets: new Set() });
  const checked = new Set(all.items.filter((i) => i.id.startsWith('secret:')).map((i) => i.id.slice('secret:'.length)));
  for (const name of named) assert.ok(checked.has(name) || NOT_CHECKED[name], `wrangler.toml names ${name}, but no rule in readiness.js checks it`);
  for (const name of RANDOM_SECRETS) assert.ok(checked.has(name), name);
  assert.ok(named.has('GROW_PAGE_CODE_RECURRING') && named.has('VAULT_SECRET') && named.has('VAPID_PRIVATE_JWK'));
});

test('the daily reminder (STUDENT-11): nothing while PUSH is off; with it on, the private key, the public key and a subject Apple accepts', () => {
  assert.ok(!readiness(complete()).items.some((i) => i.area === 'תזכורת יומית'), 'PUSH is off in wrangler.toml');
  const c = complete(); c.vars.PUSH = 'on'; c.vars.VAPID_PUBLIC_KEY = ''; c.vars.VAPID_SUBJECT = 'hello@example.test';
  assert.deepEqual(failing(readiness(c)), ['secret:VAPID_PRIVATE_JWK', 'push:public-key', 'push:subject']);
  assert.match(formatReadiness(readiness(c)), /^✗ תזכורת יומית: חסר VAPID_PRIVATE_JWK \(המפתח הפרטי של התזכורות\) → npm run push:keys/m);
  c.secrets.add('VAPID_PRIVATE_JWK'); c.vars.VAPID_PUBLIC_KEY = 'BPub'; c.vars.VAPID_SUBJECT = 'mailto:hello@example.test';
  assert.equal(readiness(c).ok, true);
  c.vars.VAPID_SUBJECT = 'https://madregot.example.test';
  assert.equal(readiness(c).ok, true);
});

test('wrangler.toml as the doctor reads it: the vars, the database id and the edge bindings', () => {
  const t = readToml(toml);
  assert.equal(t.databaseId, 'REPLACE_WITH_DATABASE_ID');
  assert.deepEqual(t.ratelimits.sort(), ['RL_AI', 'RL_AUTH', 'VAULT_RL']);
  assert.equal(t.vars.BILLING_PROVIDER, 'manual');
  assert.equal(t.vars.FAMILY_MONTHLY_BUDGET_USD, '4');
  assert.deepEqual(devVarNames('AUTH_SECRET=abc\n# note\nVAULT_SECRET="x=y"\n  RESEND_API_KEY = re_123\n'), ['AUTH_SECRET', 'VAULT_SECRET', 'RESEND_API_KEY']);
  assert.deepEqual(unappliedFrom('Migrations to be applied:\n│ 0008_vault_guard.sql │', MIGRATIONS), ['0008_vault_guard.sql']);
  assert.deepEqual(unappliedFrom('✅ No migrations to apply!', MIGRATIONS), []);
});

test('/api/health says whether things are set, as booleans, never a value', async () => {
  const h = await setup({ RESEND_API_KEY: 're_test_secret_value', WEBHOOK_PATH_SECRET: 'f'.repeat(64), GROW_USER_ID: 'grow-user-1', GROW_PAGE_CODE_ONCE: 'p1', GROW_PAGE_CODE_RECURRING: 'p2' });
  try {
    const body = await (await h.call('GET', '/api/health')).json();
    for (const k of ['resend', 'webhookPath', 'grow', 'edge', 'escrow', 'netKeys', 'auth', 'ai', 'email']) assert.equal(typeof body[k], 'boolean', k);
    assert.equal(body.resend, true); assert.equal(body.webhookPath, true); assert.equal(body.grow, true); assert.equal(body.edge, false);
    const text = JSON.stringify(body);
    for (const v of ['re_test_secret_value', 'f'.repeat(64), 'grow-user-1']) assert.ok(!text.includes(v), v);
  } finally { h.done(); }
});
