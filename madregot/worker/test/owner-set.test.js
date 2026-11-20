// `node scripts/owner.mjs set NAME=value …` (scripts/setVars.mjs): the owner's settings go into wrangler.toml's top-level
// [vars] without hand-editing. Here: only that table's line changes (never [env.staging.vars]), comments and Windows
// line ends survive, bad names and values are refused with nothing written, the file still reads with wrangler's own
// reader, and the two settings the live server lacked (PUBLIC_URL, CONTACT_EMAIL) clear the go-live check's required list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePairs, checkValue, setVars, SetError } from '../scripts/setVars.mjs';
import { cli, runWrangler } from '../scripts/owner.mjs';
import { wranglerVersion } from '../scripts/wranglerConfig.mjs';
import { readWranglerConfig, deployParts } from '../scripts/wranglerConfig.mjs';
import { readiness } from '../src/readiness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(here, '..', 'wrangler.toml'), 'utf8').replace(/\r\n/g, '\n');
// as setup leaves it: the database id and the EU jurisdiction written in
const AFTER_SETUP = SOURCE.replace('REPLACE_WITH_DATABASE_ID', '00000000-0000-4000-8000-000000000000').replace(/^DB_JURISDICTION = ""$/m, 'DB_JURISDICTION = "eu"');
const URL_ = 'https://madregot-api.example.workers.dev';
const MAIL = 'owner@example.test';

/** The value of NAME in a table of the text, as written. */
const valueIn = (text, table, name) => {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `[${table}]`);
  const end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
  const line = lines.slice(start + 1, end < 0 ? undefined : end).find((l) => l.startsWith(`${name} = `));
  return line && /"([^"]*)"/.exec(line)[1];
};

test('set writes the line in the top-level [vars] only, and leaves every other line as it was', () => {
  const { text, changed } = setVars(AFTER_SETUP, parsePairs([`PUBLIC_URL=${URL_}/`, `CONTACT_EMAIL=${MAIL}`]));
  assert.equal(valueIn(text, 'vars', 'PUBLIC_URL'), URL_, 'the trailing / is dropped');
  assert.equal(valueIn(text, 'vars', 'CONTACT_EMAIL'), MAIL);
  assert.equal(valueIn(text, 'env.staging.vars', 'PUBLIC_URL'), '', 'staging keeps its own');
  assert.deepEqual(changed.map((c) => c.name), ['PUBLIC_URL', 'CONTACT_EMAIL']);
  const a = AFTER_SETUP.split('\n');
  const b = text.split('\n');
  assert.equal(b.length, a.length);
  assert.deepEqual(a.map((l, i) => (l === b[i] ? null : i)).filter((i) => i !== null).length, 2, 'exactly two lines differ');
});

test('set keeps a line\'s comment and the file\'s Windows line ends', () => {
  const crlf = '[vars]\r\nPUBLIC_URL = ""  # the address\r\nA = "1"\r\n[env.staging.vars]\r\nPUBLIC_URL = ""\r\n';
  const { text } = setVars(crlf, [['PUBLIC_URL', URL_]]);
  assert.equal(text, `[vars]\r\nPUBLIC_URL = "${URL_}"  # the address\r\nA = "1"\r\n[env.staging.vars]\r\nPUBLIC_URL = ""\r\n`);
});

test('set refuses what would break the file or mislead, and names what is wrong', () => {
  const bad = [
    [['NOT_A_SETTING=1'], /not a setting in \[vars\]/],
    [['public_url=x'], /not NAME=value/],
    [['PUBLIC_URL'], /not NAME=value/],
    [['PUBLIC_URL=http://madregot.example'], /https address/],
    [['PUBLIC_URL=https://madregot.example/app'], /no path/],
    [['CONTACT_EMAIL=not-an-email'], /email address/],
    [['LEGAL_DATE=17.11.2026'], /YYYY-MM-DD/],
    [['BUSINESS_NAME=say "hi"'], /quote/],
    [['BUSINESS_NAME=a\\b'], /backslash/],
    [['DB_JURISDICTION=eu'], /written by setup/],
    [[`BUSINESS_NAME=${'x'.repeat(301)}`], /longer than 300/],
  ];
  for (const [args, why] of bad) {
    assert.throws(() => setVars(AFTER_SETUP, parsePairs(args)), (e) => e instanceof SetError && why.test(e.message), args[0]);
  }
  assert.throws(() => parsePairs([]), /usage/);
  // Hebrew and spaces are plain text; an empty value clears a setting
  assert.equal(checkValue('BUSINESS_NAME', ' מדרגות בע״מ '), 'מדרגות בע״מ');
  assert.equal(valueIn(setVars(AFTER_SETUP, [['AI_PAYWALL', '']]).text, 'vars', 'AI_PAYWALL'), '');
});

test('the command writes the file, wrangler still reads it, and a refusal writes nothing', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'owner-set-'));
  try {
    symlinkSync(path.join(here, '..', 'src'), path.join(dir, 'src'), 'junction');
    const file = path.join(dir, 'wrangler.toml');
    writeFileSync(file, AFTER_SETUP);
    const out = [];
    const io = { tomlFile: file, log: (s) => out.push(s), error: (s) => out.push(`ERR ${s}`) };
    assert.equal(await cli(['set', `PUBLIC_URL=${URL_}`, `CONTACT_EMAIL=${MAIL}`], io), 0);
    assert.match(out.join('\n'), /PUBLIC_URL = "https:\/\/madregot-api\.example\.workers\.dev"/);
    assert.match(out.join('\n'), /npm run build --prefix \.\.\/web\n\s+npm run deploy/, 'the app is rebuilt first: its pages read these values');
    const { vars } = readWranglerConfig(file);
    assert.equal(vars.PUBLIC_URL, URL_);
    assert.equal(vars.CONTACT_EMAIL, MAIL);
    assert.equal(readWranglerConfig(file, 'staging').vars.PUBLIC_URL, '');
    // again: nothing to change
    out.length = 0;
    assert.equal(await cli(['set', `PUBLIC_URL=${URL_}`], io), 0);
    assert.match(out.join('\n'), /nothing changed/);
    // refused: the file is untouched
    const before = readFileSync(file, 'utf8');
    out.length = 0;
    assert.equal(await cli(['set', 'CONTACT_EMAIL=nope', `PUBLIC_URL=${URL_}x/`], io), 1);
    assert.match(out.join('\n'), /^ERR CONTACT_EMAIL must be an email address/m);
    assert.equal(readFileSync(file, 'utf8'), before);
    // a file wrangler would not read after writing is put back as it was
    out.length = 0;
    const io2 = { ...io, readConfig: () => { throw new Error('Invalid TOML document\nmore'); } };
    assert.equal(await cli(['set', 'BUSINESS_NAME=x'], io2), 1);
    assert.match(out.join('\n'), /left as it was: Invalid TOML document/);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('with PUBLIC_URL and CONTACT_EMAIL set, the go-live check has nothing required left for a server set up like the owner\'s', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'owner-set-'));
  try {
    symlinkSync(path.join(here, '..', 'src'), path.join(dir, 'src'), 'junction');
    const file = path.join(dir, 'wrangler.toml');
    const facts = (text) => {
      writeFileSync(file, text);
      const parts = deployParts(readWranglerConfig(file));
      const inRepo = ['0000_base.sql'];
      // the live server's answer as it was after setup (booleans only), and the secrets setup made
      const health = { ok: true, ai: true, auth: true, netKeys: true, escrow: true, webhookPath: true, edge: true, vault: 'on' };
      return readiness({ ...parts, secrets: ['ANTHROPIC_API_KEY', 'AUTH_SECRET', 'IP_HASH_SECRET', 'VAULT_SECRET', 'WEBHOOK_PATH_SECRET'],
        migrationsApplied: inRepo, migrationsInRepo: inRepo, health, local: false });
    };
    const missing = (r) => r.items.filter((i) => !i.ok && i.required).map((i) => i.id);
    assert.deepEqual(missing(facts(AFTER_SETUP)).sort(), ['site:contact', 'site:url']);
    assert.deepEqual(missing(facts(setVars(AFTER_SETUP, [['PUBLIC_URL', URL_], ['CONTACT_EMAIL', MAIL]]).text)), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the owner script runs wrangler with this Node and no npx, so it works where npx is a .cmd file (Windows)', () => {
  const src = readFileSync(path.join(here, '..', 'scripts', 'owner.mjs'), 'utf8');
  assert.doesNotMatch(src, /execFileSync\(\s*'npx'/, 'execFileSync cannot start npx.cmd without a shell on Windows');
  // no PATH at all, as on a Windows machine where only npx.cmd exists: wrangler still answers
  const out = runWrangler(['--version'], { encoding: 'utf8', env: { ...process.env, PATH: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, new RegExp(wranglerVersion().replace(/\./g, '\\.')));
});
