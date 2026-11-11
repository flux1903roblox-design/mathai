// wrangler.toml as wrangler reads it at deploy (COUNCIL2-10, COUNCIL2-16). The installed wrangler's own config reader
// (scripts/wranglerConfig.mjs, unstable_readConfig) loads the file twice, for the top level and for env "staging": the
// file must parse (a var defined twice in [vars] made it invalid TOML, and setup.sh, deploy.ps1, `npm run deploy` and
// db:migrate all read it), the D1 binding and the three edge limiters must be there, and every [vars] name the Worker
// reads must be written out in [env.staging.vars] too, since wrangler carries no vars into an environment. Nothing runs
// wrangler's command line or reaches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readWranglerConfig, wranglerVersion, deployParts } from '../scripts/wranglerConfig.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'wrangler.toml');
const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'));

/**
 * [vars] that are deliberately absent from [env.staging.vars], each with the reason. Anything else the Worker reads must
 * be written out there.
 */
const TOP_LEVEL_ONLY = {
  ANDROID_PACKAGE: 'the Play Store app opens the production address only; on staging /.well-known/assetlinks.json answers []',
  ANDROID_CERT_SHA256: 'the same: the app\'s signing keys belong to the production address',
  VAPID_PUBLIC_KEY: 'PUSH is "off" on staging (no VAPID_PRIVATE_JWK there), so the reminder keys are never read',
  VAPID_SUBJECT: 'the same: no reminders on staging',
  PUSH_BATCH: 'the same: no reminders on staging',
  DB_JURISDICTION: 'setup.ps1 and setup.sh set the one DB_JURISDICTION = "" line, in [vars], with the production database\'s id; staging\'s is added by hand once madregot-staging exists in the EU (absent reads as "", so its checkout stays closed)',
};

/** The Worker's own code: worker/src and the shared modules it imports, without tests. */
function workerSource() {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.js$/.test(e.name) && !/\.test\.js$/.test(e.name)) files.push(p);
    }
  };
  walk(path.join(here, '..', 'src'));
  walk(path.join(here, '..', '..', 'shared'));
  return files.map((f) => readFileSync(f, 'utf8')).join('\n');
}

test('the installed wrangler is the pinned one, and its reader parses wrangler.toml (no key defined twice)', () => {
  assert.equal(wranglerVersion(), pkg.devDependencies.wrangler);
  // on b347414 this threw: 'Invalid TOML document: trying to redefine an already defined table or value'
  const top = readWranglerConfig(FILE);
  assert.equal(top.name, 'madregot-api');
  assert.equal(top.main && path.basename(top.main), 'index.js');
  assert.ok(Object.keys(top.vars).length > 50, 'the [vars] table was read');
  for (const [k, v] of Object.entries(top.vars)) assert.equal(typeof v, 'string', `${k} is a quoted string, as env.${k} is read`);
  // the one name that was written twice is there once, empty
  assert.equal(top.vars.PAYMENT_PROVIDER_NAME, '');
  const text = readFileSync(FILE, 'utf8');
  const head = text.slice(0, text.indexOf('\n[env.staging]'));
  assert.equal((head.match(/^PAYMENT_PROVIDER_NAME\s*=/gm) || []).length, 1);
});

test('the top level has the D1 binding and the VAULT_RL, RL_AUTH and RL_AI edge limiters', () => {
  const top = readWranglerConfig(FILE);
  const db = top.d1_databases.find((d) => d.binding === 'DB');
  assert.ok(db, 'the DB binding');
  assert.equal(db.database_name, 'madregot');
  assert.equal(db.migrations_dir, 'migrations');
  const rl = Object.fromEntries(top.ratelimits.map((r) => [r.name, r]));
  for (const name of ['VAULT_RL', 'RL_AUTH', 'RL_AI']) {
    assert.ok(rl[name], name);
    assert.ok(rl[name].simple.limit > 0 && rl[name].simple.period > 0, `${name} has a limit`);
  }
  assert.equal(rl.RL_AUTH.simple.limit, 20);
  assert.equal(rl.RL_AI.simple.limit, 30);
  // what the doctor reads of it (scripts/owner.mjs)
  const parts = deployParts(top);
  assert.equal(parts.databaseId, 'REPLACE_WITH_DATABASE_ID');
  assert.deepEqual(parts.ratelimits.sort(), ['RL_AI', 'RL_AUTH', 'VAULT_RL']);
  assert.equal(parts.vars.BILLING_PROVIDER, 'manual');
});

test('env "staging" parses, has its own database, and writes out every var the Worker reads', () => {
  const top = readWranglerConfig(FILE);
  const staging = readWranglerConfig(FILE, 'staging');
  assert.equal(staging.name, 'madregot-api-staging');
  assert.equal(staging.vars.STAGING, 'true', 'scripts/loadtest.mjs runs only against a Worker that says staging');
  const db = staging.d1_databases.find((d) => d.binding === 'DB');
  assert.ok(db, 'the staging DB binding');
  assert.equal(db.database_name, 'madregot-staging');
  assert.notEqual(db.database_id, top.d1_databases[0].database_id);

  const src = workerSource();
  const read = Object.keys(top.vars).filter((name) => new RegExp(`\\b${name}\\b`).test(src));
  assert.ok(read.length > 50, 'the Worker reads its vars');
  const missing = read.filter((name) => !(name in staging.vars) && !(name in TOP_LEVEL_ONLY));
  assert.deepEqual(missing, [], `vars the Worker reads that [env.staging.vars] does not have (wrangler does not carry vars into an environment): ${missing.join(', ')}`);
  // the list of exceptions stays true: each is a top-level var, not on staging, with a reason
  for (const [name, why] of Object.entries(TOP_LEVEL_ONLY)) {
    assert.ok(name in top.vars, `${name} is a top-level var`);
    assert.ok(!(name in staging.vars), `${name} is on staging: take it off TOP_LEVEL_ONLY`);
    assert.ok(why.length > 20, name);
  }
  // staging differs from production only where its comment says so
  assert.equal(staging.vars.PUSH, 'off');
  assert.equal(staging.vars.AI_PARENT_OK, top.vars.AI_PARENT_OK);
  assert.equal(staging.vars.MOE_AI_APPROVAL, top.vars.MOE_AI_APPROVAL);
});
