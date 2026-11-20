// The live server's own settings (worker/production.json, scripts/production.mjs) and the production deploy built on
// them: `node scripts/deploy-config.mjs --production` (wrangler.toml plus exactly production.json, folded for the free
// plan, proved with wrangler's own reader), `npm run owner -- set --production` (the same checks as `set`, into
// production.json), `doctor --production` (the go-live check of the live server's settings, as committed), the owner's
// database commands with --production, the build's environment (scripts/production-env.mjs) and the smoke check after a
// deploy (scripts/smoke.mjs). Nothing reaches the network or Cloudflare: wrangler's command line and fetch are stubs; the
// files are copies in a temporary folder, and git is a stub too, except in one test that commits in a throwaway repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTION_FILE, OverlayError, EMAIL_IN, readOverlay, applyOverlay, setProductionVars, productionEnv, uncommitted, topD1Bindings, committedText,
} from '../scripts/production.mjs';
import { foldBlankVars, envNames, differences, writeDeployFile, writeCheckFile, CHECK_FILE, FREE_PLAN_SETTINGS, SECRETS_ROOM } from '../scripts/deployConfig.mjs';
import { readWranglerConfig } from '../scripts/wranglerConfig.mjs';
import { topVars, parsePairs } from '../scripts/setVars.mjs';
import { cli, doctor, productionHow, productionConfig, d1Args, HELP } from '../scripts/owner.mjs';
import { commandLine } from '../scripts/production-env.mjs';
import { smoke } from '../scripts/smoke.mjs';
import { withBlankVars, BLANK_VARS } from '../src/blankVars.js';
import { RANDOM_SECRETS } from '../src/readiness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(here, '..');
const SOURCE = readFileSync(path.join(WORKER, 'wrangler.toml'), 'utf8').replace(/\r\n/g, '\n');
const COMMITTED = readFileSync(path.join(WORKER, PRODUCTION_FILE), 'utf8');
const MIGRATIONS = readdirSync(path.join(WORKER, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
// The behaviour below is tested on this copy of the live settings, not on the committed file, so a settings change that
// is a commit (a new budget, an address with the domain) never has to touch a test. The committed file is checked for
// what must stay true of it (the first two tests).
const LIVE = {
  PUBLIC_URL: 'https://madregot-api.flux1903roblox.workers.dev',
  DB_JURISDICTION: 'eu',
  OPEN_DAILY_BUDGET_USD: '2',
  OPEN_INFLIGHT_USD: '1',
  OPEN_ACCOUNT_DAILY_USD: '1',
  OPEN_CLASS_DAILY_USD: '1',
};
// the live D1 database, made in the EU (TRUST-15): a deploy that names another one would serve no one's progress
const LIVE_DB = '8a87312e-0ad6-4ab5-8531-cdd52ece39ed';
const PROD_TEXT = `${JSON.stringify({ account_id: '', d1: { DB: LIVE_DB }, vars: LIVE }, null, 2)}\n`;

/** A temporary worker folder: wrangler.toml, production.json and a link to src (wrangler's reader checks main). */
function folder({ toml = SOURCE, production = PROD_TEXT } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'production-'));
  symlinkSync(path.join(WORKER, 'src'), path.join(dir, 'src'), 'junction');
  const sourceFile = path.join(dir, 'wrangler.toml');
  const prodFile = path.join(dir, PRODUCTION_FILE);
  writeFileSync(sourceFile, toml);
  if (production !== null) writeFileSync(prodFile, production);
  return { dir, sourceFile, prodFile, deployFile: path.join(dir, 'wrangler.deploy.toml'), done: () => rmSync(dir, { recursive: true, force: true }) };
}
/** The check files (writeCheckFile) left in a folder: none, once a check is done. */
const checkFiles = (dir) => readdirSync(dir).filter((f) => CHECK_FILE.test(f));
/**
 * A stub of git for wrangler.toml's folder: `show HEAD:./<file>` gives `committed[file]` (else the file on disk, as if
 * committed), `status --porcelain` gives `status`.
 */
const gitStub = (dir, committed = {}, status = '') => (args) => {
  if (args[0] === 'show') {
    const file = args[1].replace(/^HEAD:\.\//, '');
    return committed[file] ?? readFileSync(path.join(dir, file), 'utf8');
  }
  if (args[0] === 'status') return status;
  throw new Error(`unexpected git ${args.join(' ')}`);
};
const overlayWith = (patch) => JSON.stringify({ ...JSON.parse(PROD_TEXT), ...patch }, null, 2);
const varsWith = (vars) => overlayWith({ vars: { ...JSON.parse(PROD_TEXT).vars, ...vars } });

test('the committed production.json: the live database in the EU, an https address, and the template keeps its placeholders', () => {
  const o = readOverlay(COMMITTED, SOURCE);
  assert.deepEqual(o.d1, { DB: LIVE_DB });
  assert.equal(o.vars.DB_JURISDICTION, 'eu', 'the privacy notice says the database is in the EU');
  assert.match(o.vars.PUBLIC_URL, /^https:\/\/[^\s/]+$/);
  assert.equal(o.account_id, '', 'the workflow takes CLOUDFLARE_ACCOUNT_ID (the production environment\'s variable)');
  // the template every other owner (and setup.ps1, setup.sh, test/legal.test.js) relies on is unchanged
  assert.match(SOURCE, /^database_id = "REPLACE_WITH_DATABASE_ID"$/m);
  assert.match(SOURCE, /^DB_JURISDICTION = ""$/m);
  assert.equal(topVars(SOURCE).PUBLIC_URL, '');
  // the committed file deploys: wrangler.toml plus exactly it, read back with wrangler's own reader
  const f = folder({ production: COMMITTED });
  try { assert.doesNotThrow(() => writeDeployFile({ sourceFile: f.sourceFile, production: true })); } finally { f.done(); }
});

test('the committed production.json holds no secret-looking name, no key-looking value and no email address', () => {
  const o = JSON.parse(COMMITTED);
  const names = [...Object.keys(o), ...Object.keys(o.vars), ...Object.keys(o.d1)];
  // every secret wrangler.toml names in its secrets comment, the ones setup makes, and anything that looks like one
  const secretsComment = SOURCE.slice(SOURCE.indexOf('# Secrets (never in this file'), SOURCE.indexOf('\n[observability]'));
  const secretNames = [...secretsComment.matchAll(/^#\s{2,}([A-Z][A-Z0-9_]+)\s/gm)].map((m) => m[1]);
  assert.ok(secretNames.includes('ANTHROPIC_API_KEY') && secretNames.includes('VAULT_SECRET'), 'the secrets comment was read');
  for (const name of names) {
    assert.doesNotMatch(name, /SECRET|TOKEN|PASSW|PRIVATE|API_?KEY|JWK|CREDENTIAL/i, name);
    assert.ok(!secretNames.includes(name) && !RANDOM_SECRETS.includes(name), `${name} is a secret`);
  }
  assert.doesNotMatch(COMMITTED, EMAIL_IN, 'no email address');
  assert.doesNotMatch(COMMITTED, /@/, 'no @ at all');
  assert.doesNotMatch(COMMITTED, /sk-ant-|whsec_|\bre_[A-Za-z0-9]{8,}|-----BEGIN|[0-9a-f]{40,}/i, 'no key');
  // and the reader refuses one, whatever its name
  assert.throws(() => readOverlay(varsWith({ CONTACT_EMAIL: 'owner@example.test' }), SOURCE), (e) => e instanceof OverlayError && /never holds an email address.*wrangler secret put CONTACT_EMAIL/.test(e.message));
  assert.throws(() => readOverlay(varsWith({ VAPID_SUBJECT: 'mailto:owner@example.test' }), SOURCE), /never holds an email address/);
  assert.throws(() => readOverlay(varsWith({ ANTHROPIC_API_KEY: 'x' }), SOURCE), /not a setting in \[vars\].*secret never goes here: npx wrangler secret put ANTHROPIC_API_KEY/);
});

test('the reader refuses what the template does not list, and anything that is not plain text', () => {
  const bad = [
    [varsWith({ NOT_A_SETTING: '1' }), /NOT_A_SETTING is not a setting in \[vars\]/],
    [varsWith({ STAGING: 'true' }), /STAGING is not a setting in \[vars\]/, 'a staging-only var'],
    [varsWith({ OPEN_DAILY_BUDGET_USD: 2 }), /must be text in quotes/],
    [varsWith({ PUBLIC_URL: 'http://madregot.example' }), /https address/],
    [varsWith({ PUBLIC_URL: 'https://madregot.example/app' }), /no path/],
    [varsWith({ DB_JURISDICTION: 'us' }), /DB_JURISDICTION may only be "eu"/],
    [varsWith({ BUSINESS_NAME: 'say "hi"' }), /quote/],
    [overlayWith({ d1: { DB_OTHER: LIVE_DB } }), /d1 "DB_OTHER" is not a D1 binding of wrangler\.toml \(it has DB\)/],
    [overlayWith({ d1: { DB: 'REPLACE_WITH_DATABASE_ID' } }), /database id as wrangler d1 create prints it/],
    [overlayWith({ account_id: 'not-an-account' }), /account_id is a Cloudflare account id/],
    [overlayWith({ routes: [] }), /unknown key "routes"/],
    [overlayWith({ vars: [] }), /vars must be an object/],
    ['{ "vars": ', /not valid JSON/],
    ['[]', /must be one object/],
  ];
  for (const [text, why, what] of bad) assert.throws(() => readOverlay(text, SOURCE), (e) => e instanceof OverlayError && why.test(e.message), what || String(why));
  assert.deepEqual(topD1Bindings(SOURCE), ['DB'], 'staging\'s own binding is not a top-level one');
});

test('--production: the deploy file is wrangler.toml plus exactly production.json, read back with wrangler\'s own reader', () => {
  const f = folder();
  try {
    const w = writeDeployFile({ sourceFile: f.sourceFile, production: true });
    assert.equal(w.deployFile, f.deployFile);
    const top = readWranglerConfig(f.deployFile);
    const vars = withBlankVars({ ...top.vars });
    const template = readWranglerConfig(f.sourceFile);
    assert.deepEqual(vars, { ...template.vars, ...LIVE }, 'every var is the template\'s, except production.json\'s');
    assert.equal(top.d1_databases.find((d) => d.binding === 'DB').database_id, LIVE_DB);
    assert.equal(top.account_id, undefined, 'no account_id: CLOUDFLARE_ACCOUNT_ID');
    // staging is never touched
    const staging = readWranglerConfig(f.deployFile, 'staging');
    const stagingTemplate = readWranglerConfig(f.sourceFile, 'staging');
    assert.deepEqual(withBlankVars({ ...staging.vars }), { ...stagingTemplate.vars });
    assert.equal(staging.d1_databases[0].database_id, 'REPLACE_WITH_STAGING_DATABASE_ID');
    assert.equal(staging.vars.PUBLIC_URL, undefined, 'staging\'s empty PUBLIC_URL is still folded');
    // the check proves it, and refuses the same file against the template alone
    assert.deepEqual(differences(readWranglerConfig, f.sourceFile, f.deployFile, envNames(SOURCE), w.overlay), []);
    const without = differences(readWranglerConfig, f.sourceFile, f.deployFile, envNames(SOURCE));
    assert.match(without.join('\n'), /top level: vars differ \(PUBLIC_URL, OPEN_DAILY_BUDGET_USD, OPEN_ACCOUNT_DAILY_USD, OPEN_CLASS_DAILY_USD, OPEN_INFLIGHT_USD, DB_JURISDICTION\)/);
    assert.match(without.join('\n'), /top level: d1_databases differs/);
  } finally { f.done(); }
});

test('--production: a var production.json sets leaves BLANK_VARS, and the deploy still fits the free plan', () => {
  const plain = foldBlankVars(SOURCE).folded.vars;
  const f = folder();
  try {
    const w = writeDeployFile({ sourceFile: f.sourceFile, production: true });
    const nowSet = Object.keys(LIVE).filter((n) => topVars(SOURCE)[n] === '');
    assert.deepEqual(nowSet.sort(), ['DB_JURISDICTION', 'PUBLIC_URL'], 'the two that were empty in the template');
    assert.deepEqual(w.folded.vars, plain.filter((n) => !nowSet.includes(n)), 'BLANK_VARS shrinks by exactly those');
    const line = readFileSync(f.deployFile, 'utf8').split('\n').find((l) => l.startsWith(`${BLANK_VARS} = `));
    for (const n of nowSet) assert.ok(!line.split('"')[1].split(',').includes(n), `${n} is not folded`);
    const plainSent = Object.keys(readWranglerConfig(f.sourceFile).vars).length - plain.length + 1;
    assert.equal(w.sent, plainSent + nowSet.length, 'each var set there is sent as itself');
    assert.ok(w.sent + SECRETS_ROOM <= FREE_PLAN_SETTINGS, `${w.sent} vars + ${SECRETS_ROOM} secrets must fit in ${FREE_PLAN_SETTINGS}`);
  } finally { f.done(); }
});

test('--production: a name the template does not list is refused and no deploy file is left', () => {
  for (const [text, why] of [
    [varsWith({ NOT_A_SETTING: '1' }), /NOT_A_SETTING is not a setting/],
    [overlayWith({ d1: { DB2: LIVE_DB } }), /d1 "DB2" is not a D1 binding/],
  ]) {
    const f = folder({ production: text });
    try {
      writeFileSync(f.deployFile, 'an old file');
      assert.throws(() => writeDeployFile({ sourceFile: f.sourceFile, production: true }), why);
      assert.equal(existsSync(f.deployFile), false, 'never a file from an earlier run');
    } finally { f.done(); }
  }
  // no production.json at all: refused too
  const f = folder({ production: null });
  try { assert.throws(() => writeDeployFile({ sourceFile: f.sourceFile, production: true }), /ENOENT|no such file/); } finally { f.done(); }
});

test('--production: the check refuses a deploy file that is not wrangler.toml plus exactly production.json', () => {
  const overlay = readOverlay(PROD_TEXT, SOURCE);
  const good = foldBlankVars(applyOverlay(SOURCE, overlay)).text;
  const cases = [
    [good.replace(/^OPEN_INFLIGHT_USD = "1"$/m, 'OPEN_INFLIGHT_USD = "20"'), /top level: vars differ \(OPEN_INFLIGHT_USD\)/, 'a production value lost'],
    [good.replace(/^AI_PAYWALL = "off"$/m, 'AI_PAYWALL = "on"'), /top level: vars differ \(AI_PAYWALL\)/, 'a value that is in neither file'],
    [good.replace(LIVE_DB, '00000000-0000-4000-8000-000000000000'), /top level: d1_databases differs/, 'another database'],
    [good.replace('name = "madregot-api"', 'name = "madregot-api"\naccount_id = "0123456789abcdef0123456789abcdef"'), /top level: account_id differs/, 'an account production.json does not name'],
    [foldBlankVars(SOURCE).text, /top level: vars differ/, 'the plain file, without the overlay'],
  ];
  for (const [text, why, what] of cases) {
    const f = folder();
    try {
      writeFileSync(f.deployFile, text);
      const found = differences(readWranglerConfig, f.sourceFile, f.deployFile, envNames(SOURCE), overlay);
      assert.match(found.join('\n'), why, what);
    } finally { f.done(); }
  }
});

test('--production: an account_id in production.json is written once at the top and carried into staging', () => {
  const id = '0123456789abcdef0123456789abcdef';
  const f = folder({ production: overlayWith({ account_id: id }) });
  try {
    const w = writeDeployFile({ sourceFile: f.sourceFile, production: true });
    const text = readFileSync(f.deployFile, 'utf8');
    assert.equal((text.match(/^account_id = /gm) || []).length, 1);
    assert.match(text, /^name = "madregot-api"\naccount_id = "0123456789abcdef0123456789abcdef"$/m);
    assert.equal(readWranglerConfig(f.deployFile).account_id, id);
    assert.equal(readWranglerConfig(f.deployFile, 'staging').account_id, id);
    assert.equal(w.overlay.account_id, id);
  } finally { f.done(); }
  // a template that already names an account: one place only
  assert.throws(() => applyOverlay(SOURCE.replace('name = "madregot-api"', `name = "madregot-api"\naccount_id = "${id}"`), { vars: {}, d1: {}, account_id: id }), /already sets account_id/);
});

test('the plain path is as it was: wrangler.toml alone, whatever production.json says', () => {
  const f = folder({ production: varsWith({ AI_PAYWALL: 'on' }) });
  try {
    const w = writeDeployFile({ sourceFile: f.sourceFile });
    assert.equal(readFileSync(f.deployFile, 'utf8'), foldBlankVars(SOURCE).text, 'byte for byte the plain fold');
    assert.equal(w.overlay, null);
    assert.equal(readWranglerConfig(f.deployFile).d1_databases[0].database_id, 'REPLACE_WITH_DATABASE_ID');
  } finally { f.done(); }
  // and the npm scripts: the plain ones unchanged, the production ones read the deploy file
  const pkg = JSON.parse(readFileSync(path.join(WORKER, 'package.json'), 'utf8')).scripts;
  assert.equal(pkg.deploy, 'node scripts/deploy-config.mjs && wrangler deploy --config wrangler.deploy.toml');
  assert.equal(pkg['db:migrate'], 'wrangler d1 migrations apply madregot --remote');
  assert.equal(pkg['deploy:production'], 'node scripts/deploy-config.mjs --production && wrangler deploy --strict --config wrangler.deploy.toml');
  assert.equal(pkg['db:migrate:production'], 'node scripts/deploy-config.mjs --production && wrangler d1 migrations apply madregot --remote --config wrangler.deploy.toml');
  assert.equal(pkg['build:production'], 'node scripts/production-env.mjs npm run build --prefix ../web');
});

test('Windows line ends: the overlay keeps them, and the deploy file still means the same', () => {
  const crlf = SOURCE.replace(/\n/g, '\r\n');
  const out = applyOverlay(crlf, readOverlay(PROD_TEXT, crlf));
  assert.ok(!/[^\r]\n/.test(out), 'every line ends with CRLF');
  assert.match(out, /^PUBLIC_URL = "https:\/\/madregot-api\.flux1903roblox\.workers\.dev"\r$/m);
  const f = folder({ toml: crlf });
  try { assert.doesNotThrow(() => writeDeployFile({ sourceFile: f.sourceFile, production: true })); } finally { f.done(); }
});

test('a production deploy reads committed files only: git status decides, and no answer from git is a refusal', () => {
  const seen = [];
  assert.equal(uncommitted('/w', ['wrangler.toml', PRODUCTION_FILE], (args) => { seen.push(args); return ''; }), null);
  assert.deepEqual(seen[0], ['status', '--porcelain', '--', 'wrangler.toml', 'production.json']);
  const dirty = uncommitted('/w', ['wrangler.toml', PRODUCTION_FILE], () => ' M madregot/worker/wrangler.toml\n');
  assert.match(dirty, /wrangler\.toml and production\.json have changes that are not committed:\n {3}M madregot\/worker\/wrangler\.toml/);
  assert.match(uncommitted('/w', ['wrangler.toml'], () => { throw new Error('fatal: not a git repository\nmore'); }), /git could not say whether wrangler\.toml are committed \(fatal: not a git repository\)/);
  // the command checks before it writes anything (scripts/deploy-config.mjs)
  const src = readFileSync(path.join(WORKER, 'scripts', 'deploy-config.mjs'), 'utf8');
  assert.ok(src.indexOf("uncommitted(dir, ['wrangler.toml', PRODUCTION_FILE])") < src.indexOf('writeDeployFile({'), 'git is asked first');
});

test('set --production writes production.json only, with the same checks, and a refusal writes nothing', async () => {
  const f = folder();
  try {
    const out = [];
    const io = { tomlFile: f.sourceFile, log: (s) => out.push(s), error: (s) => out.push(`ERR ${s}`) };
    const tomlBefore = readFileSync(f.sourceFile, 'utf8');
    // a deploy file a deploy is about to read: the check never replaces or removes it
    writeFileSync(f.deployFile, 'a pending deploy');
    assert.equal(await cli(['set', '--production', 'OPEN_DAILY_BUDGET_USD=3', 'MOE_AI_FROM_GRADE=8'], io), 0, out.join('\n'));
    assert.match(out.join('\n'), /^OPEN_DAILY_BUDGET_USD = "3" \(was "2"\)$/m);
    assert.match(out.join('\n'), /^MOE_AI_FROM_GRADE = "8" \(was "7"\)$/m, 'a name production.json did not have yet: from the template');
    assert.match(out.join('\n'), /Commit it; then on GitHub: Actions › Deploy › Run workflow/);
    assert.match(out.join('\n'), /npm run deploy:production/);
    assert.equal(readFileSync(f.sourceFile, 'utf8'), tomlBefore, 'wrangler.toml is not touched');
    assert.equal(readFileSync(f.deployFile, 'utf8'), 'a pending deploy', 'wrangler.deploy.toml is not touched');
    assert.deepEqual(checkFiles(f.dir), [], 'the check file written to check it is removed again');
    const o = JSON.parse(readFileSync(f.prodFile, 'utf8'));
    assert.deepEqual(o.vars, { ...LIVE, OPEN_DAILY_BUDGET_USD: '3', MOE_AI_FROM_GRADE: '8' });
    assert.deepEqual(Object.keys(o), Object.keys(JSON.parse(PROD_TEXT)), 'the other keys and their order are kept');
    assert.equal(o.d1.DB, LIVE_DB);
    assert.match(readFileSync(f.prodFile, 'utf8'), /\n {4}"MOE_AI_FROM_GRADE": "8"\n {2}\}\n\}\n$/, 'two-space JSON with a final line end, as committed');
    // again: nothing to change
    out.length = 0;
    assert.equal(await cli(['set', 'OPEN_DAILY_BUDGET_USD=3', '--production'], io), 0);
    assert.match(out.join('\n'), /production\.json already has these values: nothing changed/);
    // refused: the file is untouched
    const before = readFileSync(f.prodFile, 'utf8');
    for (const [arg, why] of [
      ['CONTACT_EMAIL=owner@example.test', /never holds an email address.*npx wrangler secret put CONTACT_EMAIL/],
      ['DB_JURISDICTION=eu', /written by setup/],
      ['NOT_A_SETTING=1', /not a setting in \[vars\]/],
      ['PUBLIC_URL=http://madregot.example', /https address/],
      ['AUTH_SECRET=abc', /not a setting in \[vars\]/],
    ]) {
      out.length = 0;
      assert.equal(await cli(['set', '--production', arg], io), 1, arg);
      assert.match(out.join('\n'), why, arg);
      assert.equal(readFileSync(f.prodFile, 'utf8'), before, arg);
    }
    out.length = 0;
    assert.equal(await cli(['set', '--production'], io), 1);
    assert.match(out.join('\n'), /usage/);
    // a deploy file that would not be right puts production.json back as it was
    out.length = 0;
    const io2 = { ...io, checkProduction: () => { throw new Error('wrangler.deploy.toml would not mean what wrangler.toml with production.json says:\n  more'); } };
    assert.equal(await cli(['set', '--production', 'OPEN_CLASS_DAILY_USD=2'], io2), 1);
    assert.match(out.join('\n'), /left as it was: wrangler\.deploy\.toml would not mean/);
    assert.equal(readFileSync(f.prodFile, 'utf8'), before);
    // the real check, refusing: production.json put back, no check file left, the pending deploy file still there
    out.length = 0;
    const io3 = { ...io, readConfig: () => { throw new Error('Invalid TOML document: refused'); } };
    assert.equal(await cli(['set', '--production', 'OPEN_CLASS_DAILY_USD=2'], io3), 1);
    assert.match(out.join('\n'), /left as it was: Invalid TOML document: refused/);
    assert.equal(readFileSync(f.prodFile, 'utf8'), before);
    assert.deepEqual(checkFiles(f.dir), []);
    assert.equal(readFileSync(f.deployFile, 'utf8'), 'a pending deploy');
  } finally { f.done(); }
  // the plain set still writes wrangler.toml and never production.json
  const g = folder();
  try {
    const io = { tomlFile: g.sourceFile, log: () => {}, error: () => {} };
    assert.equal(await cli(['set', 'OPEN_DAILY_BUDGET_USD=9'], io), 0);
    assert.equal(topVars(readFileSync(g.sourceFile, 'utf8')).OPEN_DAILY_BUDGET_USD, '9');
    assert.equal(readFileSync(g.prodFile, 'utf8'), PROD_TEXT);
  } finally { g.done(); }
  assert.deepEqual(setProductionVars(PROD_TEXT, SOURCE, [['PUBLIC_URL', `${LIVE.PUBLIC_URL}/`]]).changed, [], 'a trailing / is dropped, as by set');
});

test('doctor --production: the live server\'s settings as committed, and wrangler asked about a check file\'s database and Worker', async () => {
  const f = folder();
  try {
    const ran = [];
    const fetched = [];
    let configSeen = null;
    const deps = (secrets, git = gitStub(f.dir)) => ({
      list: () => MIGRATIONS,
      git,
      exec: (args) => {
        ran.push(args);
        // the file wrangler is pointed at: a check file next to wrangler.toml, there while wrangler runs
        configSeen = args.at(-1);
        assert.ok(existsSync(configSeen), 'the check file is there while wrangler reads it');
        if (args[0] === 'secret') return JSON.stringify(secrets.map((name) => ({ name, type: 'secret_text' })));
        return 'No migrations to apply';
      },
      fetch: async (url) => { fetched.push(url); return new Response(JSON.stringify({ ok: true, ai: true, auth: true, netKeys: true, escrow: true, webhookPath: true, edge: true, vault: 'on' })); },
    });
    const live = ['ANTHROPIC_API_KEY', 'AUTH_SECRET', 'IP_HASH_SECRET', 'VAULT_SECRET', 'WEBHOOK_PATH_SECRET'];
    // a deploy about to run reads wrangler.deploy.toml: the doctor never replaces or removes it
    writeFileSync(f.deployFile, 'a pending deploy');
    const r = await doctor({ production: true, toml: f.sourceFile }, deps(live));
    for (const args of ran) assert.deepEqual(args.slice(-2), ['--config', configSeen], args.join(' '));
    assert.equal(path.dirname(configSeen), f.dir, 'next to wrangler.toml, so main, assets and migrations mean the same');
    assert.match(path.basename(configSeen), CHECK_FILE);
    assert.equal(ran.length, 2, 'the secrets\' names and the migrations');
    assert.deepEqual(checkFiles(f.dir), [], 'the check file was only for those two questions');
    assert.equal(readFileSync(f.deployFile, 'utf8'), 'a pending deploy', 'wrangler.deploy.toml is not touched');
    assert.ok(ran.some((a) => a[0] === 'd1' && a.includes('--remote')));
    assert.deepEqual(fetched, [`${LIVE.PUBLIC_URL}/api/health`], 'the live address, from production.json');
    assert.match(r.out, /^✓ בסיס הנתונים: database_id$/m, 'the live database id, not the template\'s placeholder');
    assert.match(r.out, /^✓ בסיס הנתונים: DB_JURISDICTION = "eu"$/m);
    assert.match(r.out, /^✓ כתובת האתר: PUBLIC_URL$/m);
    assert.match(r.out, /כמו שהם ב־commit האחרון במחשב הזה/);
    assert.doesNotMatch(r.out, /לא נבדק מה שלא נכנס ל־commit/, 'nothing uncommitted');
    // CONTACT_EMAIL stays empty (the owner's choice): the one required line, and its hint is a secret, never production.json
    assert.equal(r.code, 1);
    assert.match(r.out, /^✗ כתובת האתר: חסר CONTACT_EMAIL.*→ npx wrangler secret put CONTACT_EMAIL/m);
    assert.deepEqual(r.out.split('\n').filter((l) => l.startsWith('✗')).length, 1, r.out);
    assert.match(r.out, /set --production/);
    assert.doesNotMatch(r.out, /worker\/wrangler\.toml: [A-Z]/, 'every hint says production.json or a secret');
    // the legal details (a reminder while the paywall is off): one set --production with each NAME=value its own word,
    // which `set` reads as it is, and the email address apart, as a secret
    const legal = r.out.split('\n').find((l) => l.startsWith('! משפט ואישורים: חסרים פרטים'));
    assert.ok(legal, r.out);
    const cmd = /→ npm run owner -- set --production ([^;]+); npx wrangler secret put CONTACT_EMAIL \(/.exec(legal);
    assert.ok(cmd, legal);
    const words = cmd[1].trim().split(/\s+/);
    const pairs = parsePairs(words);
    assert.deepEqual(pairs.map(([n]) => n), ['BUSINESS_NAME', 'BUSINESS_ID', 'BUSINESS_KIND', 'BUSINESS_ADDRESS', 'CONTACT_PHONE', 'PAYMENT_PROVIDER_NAME', 'LEGAL_DATE']);
    assert.ok(pairs.every(([, v]) => !/[,"=]/.test(v)), cmd[1]);
    assert.doesNotMatch(cmd[1], /EMAIL/, 'set --production refuses an email address');
    // with the address set as a secret of the same name, the live server has it
    const done = await doctor({ production: true, toml: f.sourceFile }, deps([...live, 'CONTACT_EMAIL']));
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /CONTACT_EMAIL: מוגדר בשרת כסוד בשם הזה/);
    assert.doesNotMatch(done.out, /set-as-secret/, 'the stand-in value is never printed');
    // a broken production.json is the one failing line, and no wrangler command runs
    writeFileSync(f.prodFile, varsWith({ NOT_A_SETTING: '1' }));
    ran.length = 0;
    const broken = await doctor({ production: true, toml: f.sourceFile }, deps(live));
    assert.equal(broken.code, 1);
    assert.match(broken.out, /^✗ קובץ ההגדרות: .*: production\.json: NOT_A_SETTING is not a setting in \[vars\]/m);
    assert.doesNotMatch(broken.out, /production\.json: production\.json/);
    assert.deepEqual(ran, []);
    assert.deepEqual(checkFiles(f.dir), []);
    // no git (or no commit): refused, nothing read from the files on disk
    const noGit = await doctor({ production: true, toml: f.sourceFile }, deps(live, () => { throw Object.assign(new Error('Command failed'), { stderr: 'fatal: not a git repository\n' }); }));
    assert.equal(noGit.code, 1);
    assert.match(noGit.out, /^✗ קובץ ההגדרות: .*git could not give wrangler\.toml as committed \(fatal: not a git repository\)/m);
  } finally { f.done(); }
  assert.match((await doctor({ production: true, local: true })).out, /לא יחד עם --local/);
});

test('doctor --production reads the committed files: a value only on this computer never counts (and is named)', async () => {
  // this computer's copy, as setup and a local edit leave it: the address, the legal approval and the live database id
  // all set; the commit has the template, where none of them is
  const local = SOURCE
    .replace(/^CONTACT_EMAIL = ""$/m, 'CONTACT_EMAIL = "owner@example.invalid"')
    .replace(/^LEGAL_APPROVED = ""$/m, 'LEGAL_APPROVED = "2026-11-11"')
    .replace('REPLACE_WITH_DATABASE_ID', LIVE_DB);
  assert.notEqual(local, SOURCE);
  const f = folder({ toml: local });
  try {
    const git = gitStub(f.dir, { 'wrangler.toml': SOURCE }, ' M madregot/worker/wrangler.toml\n');
    const deps = {
      list: () => MIGRATIONS,
      git,
      exec: (args) => (args[0] === 'secret' ? JSON.stringify(['ANTHROPIC_API_KEY', 'AUTH_SECRET', 'IP_HASH_SECRET', 'VAULT_SECRET', 'WEBHOOK_PATH_SECRET'].map((name) => ({ name }))) : 'No migrations to apply'),
      fetch: async () => new Response(JSON.stringify({ ok: true, ai: true, auth: true, netKeys: true, escrow: true, webhookPath: true, edge: true, vault: 'on' })),
    };
    const r = await doctor({ production: true, toml: f.sourceFile }, deps);
    assert.notEqual(r.code, 0, 'a dirty wrangler.toml never gives exit 0');
    assert.doesNotMatch(r.out, /הכול מוכן/);
    assert.match(r.out, /^✗ כתובת האתר: חסר CONTACT_EMAIL/m, 'the committed template has no address');
    assert.doesNotMatch(r.out, /^✓ .*LEGAL_APPROVED/m, 'nor the legal approval');
    assert.match(r.out, /\(לא נבדק מה שלא נכנס ל־commit: M madregot\/worker\/wrangler\.toml\. הפרסום לא שולח את זה\)/);
    assert.equal(readFileSync(f.sourceFile, 'utf8'), local, 'this computer\'s copy is left as it is');
    assert.deepEqual(checkFiles(f.dir), []);
    // the same tree with the values committed: then they count
    const committed = await doctor({ production: true, toml: f.sourceFile }, { ...deps, git: gitStub(f.dir) });
    assert.match(committed.out, /^✓ כתובת האתר: CONTACT_EMAIL$/m);
  } finally { f.done(); }
});

test('productionHow: one setting, several, an address, a value with a space, the staging tables', () => {
  assert.equal(productionHow('worker/wrangler.toml: LEGAL_APPROVED = "2026-11-11"  (ואז npm run build --prefix ../web ו־npm run deploy)'),
    'npm run owner -- set --production LEGAL_APPROVED=2026-11-11  (ואז commit ו־Actions › Deploy)');
  assert.equal(productionHow('worker/wrangler.toml: A_ONE = "1", CONTACT_EMAIL = "…", B_TWO = "x y", OWNER_EMAIL = "…"'),
    'npm run owner -- set --production A_ONE=1 B_TWO="x y"; npx wrangler secret put CONTACT_EMAIL ו־npx wrangler secret put OWNER_EMAIL (כתובת מייל לא נכנסת ל־production.json, שנמצא ב־git)');
  assert.equal(productionHow('worker/wrangler.toml: VAPID_SUBJECT = "mailto:…"'), 'npx wrangler secret put VAPID_SUBJECT (כתובת מייל לא נכנסת ל־production.json, שנמצא ב־git)');
  assert.equal(productionHow('worker/wrangler.toml: PRICE_EXAM_PASS_AGOROT = "…" ב־[vars] וב־[env.staging.vars]  (x)'), 'npm run owner -- set --production PRICE_EXAM_PASS_AGOROT=…  (x)');
  assert.equal(productionHow('worker/wrangler.toml: BILLING_CHECKOUT_HOSTS = "<הכתובת שהבדיקה מדפיסה>"'), 'npm run owner -- set --production BILLING_CHECKOUT_HOSTS="<הכתובת שהבדיקה מדפיסה>"', 'a shell would read < as a redirect');
  // each pair of a hint is a word `set` reads, once the shell has taken the quotes off
  const words = ['A_ONE=1', 'B_TWO=x y'];
  assert.deepEqual(parsePairs(words), [['A_ONE', '1'], ['B_TWO', 'x y']]);
});

test('the owner\'s database commands with --production: wrangler gets a check file of the committed live settings, removed after', async () => {
  // d1Args: the check file goes to wrangler as --config, before the command's own arguments
  assert.deepEqual(d1Args({}, ['--command', 'SELECT 1']), ['d1', 'execute', 'madregot', '--remote', '--command', 'SELECT 1', '--json']);
  assert.deepEqual(d1Args({ wranglerConfig: '/w/wrangler.check-1.toml' }, ['--command', 'SELECT 1']),
    ['d1', 'execute', 'madregot', '--remote', '--config', '/w/wrangler.check-1.toml', '--command', 'SELECT 1', '--json']);
  assert.match(HELP, /--production: the live server's database/);
  const seen = [];
  let made = 0;
  let removed = 0;
  const out = [];
  const io = {
    env: {},
    productionConfig: () => { made++; return { deployFile: '/w/wrangler.check-1.toml', text: 'MOE_AI_APPROVAL = "approved"\nMOE_AI_FROM_GRADE = "7"\n', done: () => { removed++; } }; },
    query: async (sql, o) => { seen.push(['query', o.wranglerConfig]); return { code: 'ABC234', grade: '7', setting: 'school' }; },
    rows: async (sql, o) => { seen.push(['rows', o.wranglerConfig]); return []; },
    statements: async (sqls, o) => { seen.push(['statements', o.wranglerConfig]); return sqls.map(() => []); },
    exec: async (b, o) => { seen.push(['exec', o.wranglerConfig]); return '[]'; },
    prompt: async () => '',
    log: (...a) => out.push(a.join(' ')),
    error: (...a) => out.push(`ERR ${a.join(' ')}`),
  };
  assert.equal(await cli(['list', '--production'], io), 0, out.join('\n'));
  assert.equal(await cli(['reach', '--production'], io), 0, out.join('\n'));
  // the Ministry's rules are read from the live settings (here "approved"), not this computer's wrangler.toml ("none")
  assert.equal(await cli(['grant-class', '--class', 'ABC234', '--until', '2027-08-31', '--seats', '30', '--production'], io), 0, out.join('\n'));
  assert.ok(seen.length >= 3 && seen.every(([, c]) => c === '/w/wrangler.check-1.toml'), JSON.stringify(seen));
  assert.equal(made, 3);
  assert.equal(removed, 3, 'removed after each command');
  // a refused command removes it too; --local with --production is refused before anything is made
  assert.equal(await cli(['grant-class', '--class', 'bad', '--production'], io), 1);
  assert.equal(removed, made);
  out.length = 0;
  assert.equal(await cli(['list', '--production', '--local'], io), 1);
  assert.match(out.join('\n'), /not together with --local/);
  assert.equal(made, 4);
  // no git: refused, nothing run
  seen.length = 0;
  out.length = 0;
  assert.equal(await cli(['list', '--production'], { ...io, productionConfig: () => { throw new Error('git could not give wrangler.toml as committed (fatal: not a git repository)'); } }), 1);
  assert.match(out.join('\n'), /--production: git could not give wrangler\.toml as committed/);
  assert.deepEqual(seen, []);
  // without --production nothing is made, and wrangler gets no --config
  seen.length = 0;
  assert.equal(await cli(['list'], io), 0);
  assert.deepEqual(seen, [['exec', undefined]]);
  assert.equal(made, 4);
});

test('productionConfig: the committed wrangler.toml and production.json from real git, whatever this computer\'s copies say', () => {
  const f = folder();
  try {
    const git = (args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: f.dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git(['init', '-q']);
    git(['add', 'wrangler.toml', PRODUCTION_FILE]);
    git(['commit', '-q', '-m', 'synthetic']);
    // edited after the commit: another database and another budget
    writeFileSync(f.sourceFile, SOURCE.replace('REPLACE_WITH_DATABASE_ID', '00000000-0000-4000-8000-000000000000'));
    writeFileSync(f.prodFile, varsWith({ OPEN_DAILY_BUDGET_USD: '9' }));
    writeFileSync(f.deployFile, 'a pending deploy');
    assert.equal(committedText(f.dir, 'wrangler.toml'), SOURCE);
    assert.match(uncommitted(f.dir, ['wrangler.toml', PRODUCTION_FILE]), /M wrangler\.toml\n {3}M production\.json|M production\.json\n {3}M wrangler\.toml/);
    const c = productionConfig(f.dir);
    try {
      const top = readWranglerConfig(c.deployFile);
      assert.equal(top.d1_databases.find((d) => d.binding === 'DB').database_id, LIVE_DB, 'the committed production.json\'s database');
      assert.equal(withBlankVars({ ...top.vars }).OPEN_DAILY_BUDGET_USD, LIVE.OPEN_DAILY_BUDGET_USD, 'the committed budget');
      assert.equal(c.text, readFileSync(c.deployFile, 'utf8'));
      assert.equal(checkFiles(f.dir).length, 2, 'the check file and the committed wrangler.toml it was made from');
    } finally { c.done(); }
    assert.deepEqual(checkFiles(f.dir), []);
    assert.equal(readFileSync(f.deployFile, 'utf8'), 'a pending deploy');
    assert.throws(() => committedText(f.dir, 'not-there.json'), /git could not give not-there\.json as committed \(fatal: /);
    // check files are git-ignored in the worker folder
    const ignore = readFileSync(path.join(WORKER, '.gitignore'), 'utf8').split('\n');
    assert.ok(ignore.includes('wrangler.check-*.toml') && ignore.includes('wrangler.deploy.toml'));
    assert.ok(CHECK_FILE.test('wrangler.check-12-ab.toml') && CHECK_FILE.test('wrangler.check-12-ab.source.toml') && !CHECK_FILE.test('wrangler.deploy.toml'));
  } finally { f.done(); }
  // a check that would not be right leaves nothing behind
  const g = folder();
  try {
    assert.throws(() => writeCheckFile({ dir: g.dir, sourceText: SOURCE, productionText: varsWith({ NOT_A_SETTING: '1' }) }), /NOT_A_SETTING is not a setting/);
    assert.deepEqual(checkFiles(g.dir), []);
  } finally { g.done(); }
});

test('the production build gets production.json\'s values in its environment, through npm\'s own file when npm runs it', () => {
  const overlay = readOverlay(PROD_TEXT, SOURCE);
  const env = productionEnv(overlay, { PATH: '/bin', PUBLIC_URL: 'https://stale.example' });
  assert.equal(env.PUBLIC_URL, LIVE.PUBLIC_URL, 'production.json wins over the environment');
  assert.equal(env.PATH, '/bin');
  assert.equal(env.OPEN_DAILY_BUDGET_USD, '2');
  // the contact address is never in production.json: CONTACT_EMAIL from the environment (deploy.yml: the production
  // environment's variable) reaches the landing pages as it is and the teacher screens as VITE_CONTACT_EMAIL
  assert.equal(env.VITE_CONTACT_EMAIL, undefined, 'none given, none made up');
  assert.equal(env.CONTACT_EMAIL, undefined);
  const withContact = productionEnv(overlay, { CONTACT_EMAIL: ' hello@example.invalid ' });
  assert.equal(withContact.VITE_CONTACT_EMAIL, 'hello@example.invalid');
  assert.equal(withContact.CONTACT_EMAIL, ' hello@example.invalid ', 'the landing build trims it itself');
  assert.equal(productionEnv(overlay, { CONTACT_EMAIL: 'a@example.invalid', VITE_CONTACT_EMAIL: 'b@example.invalid' }).VITE_CONTACT_EMAIL, 'b@example.invalid', 'one given already is kept');
  assert.equal(productionEnv(overlay, { CONTACT_EMAIL: '' }).VITE_CONTACT_EMAIL, undefined, 'an empty variable (not set in the environment) adds nothing');
  assert.deepEqual(commandLine(['npm', 'run', 'build', '--prefix', '../web'], { npm_execpath: '/usr/lib/node_modules/npm/bin/npm-cli.js' }, 'win32'),
    { file: process.execPath, args: ['/usr/lib/node_modules/npm/bin/npm-cli.js', 'run', 'build', '--prefix', '../web'], shell: false });
  assert.deepEqual(commandLine(['npm', 'run', 'build'], {}, 'linux'), { file: 'npm', args: ['run', 'build'], shell: false });
  assert.equal(commandLine(['npm', 'run', 'build'], {}, 'win32').shell, true, 'npm.cmd needs a shell on Windows');
});

test('smoke: /api/health must say ok, / must be the app; /waitlist may be 404; a failure is tried again, then fails', async () => {
  const site = (routes) => async (url) => {
    const p = new URL(url).pathname;
    const r = typeof routes[p] === 'function' ? routes[p]() : routes[p];
    if (!r) return new Response('not found', { status: 404 });
    return new Response(r.body, { status: r.status ?? 200, headers: { 'content-type': r.type ?? 'text/html' } });
  };
  const HEALTH = { body: JSON.stringify({ ok: true, staging: false }), type: 'application/json' };
  const APP = { body: '<!doctype html><div id="root"></div>' };
  const fast = { tries: 3, wait: 0, sleep: async () => {} };
  const good = await smoke(`${LIVE.PUBLIC_URL}/`, { ...fast, fetch: site({ '/api/health': HEALTH, '/': APP }) });
  assert.equal(good.ok, true, good.lines.join('\n'));
  assert.deepEqual(good.lines, ['✓ GET /api/health: 200', '✓ GET /: 200', '✓ GET /waitlist: 404 (no waitlist page in this build yet)']);
  assert.equal((await smoke(LIVE.PUBLIC_URL, { ...fast, fetch: site({ '/api/health': HEALTH, '/': APP, '/waitlist': APP }) })).lines[2], '✓ GET /waitlist: 200');
  let calls = 0;
  const flaky = await smoke(LIVE.PUBLIC_URL, { ...fast, fetch: site({ '/api/health': () => (++calls < 3 ? { status: 503, body: '' } : HEALTH), '/': APP }) });
  assert.equal(flaky.ok, true, 'a new version reaching every location: tried again');
  assert.equal(calls, 3);
  const bad = [
    [{ '/api/health': { body: JSON.stringify({ ok: false }), type: 'application/json' }, '/': APP }, /✗ GET \/api\/health: did not say ok: true/],
    [{ '/api/health': { body: JSON.stringify({ ok: true, staging: true }), type: 'application/json' }, '/': APP }, /is the staging Worker/],
    [{ '/api/health': HEALTH }, /✗ GET \/: answered 404/],
    [{ '/api/health': HEALTH, '/': { body: '{}', type: 'application/json' } }, /✗ GET \/: answered application\/json, not HTML/],
    [{ '/api/health': HEALTH, '/': APP, '/waitlist': { status: 500, body: '' } }, /✗ GET \/waitlist: answered 500/],
  ];
  for (const [routes, why] of bad) {
    const r = await smoke(LIVE.PUBLIC_URL, { ...fast, fetch: site(routes) });
    assert.equal(r.ok, false, String(why));
    assert.match(r.lines.join('\n'), why);
  }
  const down = await smoke(LIVE.PUBLIC_URL, { ...fast, fetch: async () => { throw new Error('getaddrinfo ENOTFOUND'); } });
  assert.match(down.lines[0], /✗ GET \/api\/health: no answer \(getaddrinfo ENOTFOUND\)/);
  assert.equal((await smoke('http://madregot.example', fast)).ok, false);
});
