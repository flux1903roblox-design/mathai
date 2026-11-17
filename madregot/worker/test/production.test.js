// The live server's own settings (worker/production.json, scripts/production.mjs) and the production deploy built on
// them: `node scripts/deploy-config.mjs --production` (wrangler.toml plus exactly production.json, folded for the free
// plan, proved with wrangler's own reader), `npm run owner -- set --production` (the same checks as `set`, into
// production.json), `doctor --production` (the go-live check of the live server's settings), the build's environment
// (scripts/production-env.mjs) and the smoke check after a deploy (scripts/smoke.mjs). Nothing reaches the network,
// Cloudflare or git: wrangler's command line, fetch and git are stubs; the files are copies in a temporary folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTION_FILE, OverlayError, EMAIL_IN, readOverlay, applyOverlay, setProductionVars, productionEnv, uncommitted, topD1Bindings,
} from '../scripts/production.mjs';
import { foldBlankVars, envNames, differences, writeDeployFile, FREE_PLAN_SETTINGS, SECRETS_ROOM } from '../scripts/deployConfig.mjs';
import { readWranglerConfig } from '../scripts/wranglerConfig.mjs';
import { topVars } from '../scripts/setVars.mjs';
import { cli, doctor, productionHow } from '../scripts/owner.mjs';
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
const overlayWith = (patch) => JSON.stringify({ ...JSON.parse(PROD_TEXT), ...patch }, null, 2);
const varsWith = (vars) => overlayWith({ vars: { ...JSON.parse(PROD_TEXT).vars, ...vars } });

test('the committed production.json: the live database in the EU, an https address, and the template keeps its placeholders', () => {
  const o = readOverlay(COMMITTED, SOURCE);
  assert.deepEqual(o.d1, { DB: LIVE_DB });
  assert.equal(o.vars.DB_JURISDICTION, 'eu', 'the privacy notice says the database is in the EU');
  assert.match(o.vars.PUBLIC_URL, /^https:\/\/[^\s/]+$/);
  assert.equal(o.account_id, '', 'the workflow takes CLOUDFLARE_ACCOUNT_ID or the token\'s one account');
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
    assert.equal(top.account_id, undefined, 'no account_id: CLOUDFLARE_ACCOUNT_ID or the token\'s one account');
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
  assert.equal(pkg['deploy:production'], 'node scripts/deploy-config.mjs --production && wrangler deploy --config wrangler.deploy.toml');
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
    assert.equal(await cli(['set', '--production', 'OPEN_DAILY_BUDGET_USD=3', 'MOE_AI_FROM_GRADE=8'], io), 0, out.join('\n'));
    assert.match(out.join('\n'), /^OPEN_DAILY_BUDGET_USD = "3" \(was "2"\)$/m);
    assert.match(out.join('\n'), /^MOE_AI_FROM_GRADE = "8" \(was "7"\)$/m, 'a name production.json did not have yet: from the template');
    assert.match(out.join('\n'), /Commit it; then on GitHub: Actions › Deploy › Run workflow/);
    assert.match(out.join('\n'), /npm run deploy:production/);
    assert.equal(readFileSync(f.sourceFile, 'utf8'), tomlBefore, 'wrangler.toml is not touched');
    assert.equal(existsSync(f.deployFile), false, 'the deploy file written to check it is removed again');
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

test('doctor --production: the live server\'s settings, and wrangler asked about the deploy file\'s database and Worker', async () => {
  const f = folder();
  try {
    const ran = [];
    const fetched = [];
    const deps = (secrets) => ({
      list: () => MIGRATIONS,
      exec: (args) => {
        ran.push(args);
        if (args[0] === 'secret') return JSON.stringify(secrets.map((name) => ({ name, type: 'secret_text' })));
        return 'No migrations to apply';
      },
      fetch: async (url) => { fetched.push(url); return new Response(JSON.stringify({ ok: true, ai: true, auth: true, netKeys: true, escrow: true, webhookPath: true, edge: true, vault: 'on' })); },
    });
    const live = ['ANTHROPIC_API_KEY', 'AUTH_SECRET', 'IP_HASH_SECRET', 'VAULT_SECRET', 'WEBHOOK_PATH_SECRET'];
    const r = await doctor({ production: true, toml: f.sourceFile }, deps(live));
    for (const args of ran) assert.deepEqual(args.slice(-2), ['--config', f.deployFile], args.join(' '));
    assert.equal(ran.length, 2, 'the secrets\' names and the migrations');
    assert.equal(existsSync(f.deployFile), false, 'the deploy file was only for those two questions');
    assert.ok(ran.some((a) => a[0] === 'd1' && a.includes('--remote')));
    assert.deepEqual(fetched, [`${LIVE.PUBLIC_URL}/api/health`], 'the live address, from production.json');
    assert.match(r.out, /^✓ בסיס הנתונים: database_id$/m, 'the live database id, not the template\'s placeholder');
    assert.match(r.out, /^✓ בסיס הנתונים: DB_JURISDICTION = "eu"$/m);
    assert.match(r.out, /^✓ כתובת האתר: PUBLIC_URL$/m);
    // CONTACT_EMAIL stays empty (the owner's choice): the one required line, and its hint is a secret, never production.json
    assert.equal(r.code, 1);
    assert.match(r.out, /^✗ כתובת האתר: חסר CONTACT_EMAIL.*→ npx wrangler secret put CONTACT_EMAIL/m);
    assert.deepEqual(r.out.split('\n').filter((l) => l.startsWith('✗')).length, 1, r.out);
    assert.match(r.out, /set --production/);
    assert.doesNotMatch(r.out, /worker\/wrangler\.toml: [A-Z]/, 'every hint says production.json or a secret');
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
  } finally { f.done(); }
  assert.match((await doctor({ production: true, local: true })).out, /לא יחד עם --local/);
  assert.equal(productionHow('worker/wrangler.toml: LEGAL_APPROVED = "2026-11-11"  (ואז npm run build --prefix ../web ו־npm run deploy)'),
    'npm run owner -- set --production LEGAL_APPROVED=2026-11-11  (ואז commit ו־Actions › Deploy)');
});

test('the production build gets production.json\'s values in its environment, through npm\'s own file when npm runs it', () => {
  const overlay = readOverlay(PROD_TEXT, SOURCE);
  const env = productionEnv(overlay, { PATH: '/bin', PUBLIC_URL: 'https://stale.example' });
  assert.equal(env.PUBLIC_URL, LIVE.PUBLIC_URL, 'production.json wins over the environment');
  assert.equal(env.PATH, '/bin');
  assert.equal(env.OPEN_DAILY_BUDGET_USD, '2');
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
