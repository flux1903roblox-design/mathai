// The deploy fits Cloudflare's free Workers plan (64 settings per Worker, text vars and secrets together) and means what
// wrangler.toml says. scripts/deploy-config.mjs (its functions: scripts/deployConfig.mjs) writes wrangler.deploy.toml
// with each vars table's empty ones folded into one var, BLANK_VARS; src/blankVars.js gives them back as "" in both
// handlers. Here: the folding, the check that refuses a deploy file that means anything else (with wrangler's own reader),
// the count for the file as shipped and as setup leaves it, and the Worker answering the same with the folded env as with
// the empty vars written out. Nothing reaches the network or Cloudflare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { foldBlankVars, envNames, differences, settingsSent, FREE_PLAN_SETTINGS, SECRETS_ROOM } from '../scripts/deployConfig.mjs';
import { readWranglerConfig } from '../scripts/wranglerConfig.mjs';
import { withBlankVars, BLANK_VARS } from '../src/blankVars.js';
import worker from '../src/index.js';
import { makeEnv, makeCtx, request } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// read with LF line ends, as a Windows checkout may hold the file with CRLF (foldBlankVars reads either)
const SOURCE = readFileSync(path.join(here, '..', 'wrangler.toml'), 'utf8').replace(/\r\n/g, '\n');
// what setup.ps1 / setup.sh leave: the database id and the EU jurisdiction written in
const AFTER_SETUP = SOURCE.replace('REPLACE_WITH_DATABASE_ID', '00000000-0000-4000-8000-000000000000').replace(/^DB_JURISDICTION = ""$/m, 'DB_JURISDICTION = "eu"');

/** A temporary copy of the worker folder's config pair: wrangler resolves main and assets next to the file. */
function pair(sourceText, deployText) {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-config-'));
  // the reader checks that main exists; a link to src keeps the relative paths what they are in the real folder (a
  // junction on Windows, where a plain symlink needs administrator rights; elsewhere the type is ignored)
  symlinkSync(path.join(here, '..', 'src'), path.join(dir, 'src'), 'junction');
  const sourceFile = path.join(dir, 'wrangler.toml');
  const deployFile = path.join(dir, 'wrangler.deploy.toml');
  writeFileSync(sourceFile, sourceText);
  writeFileSync(deployFile, deployText);
  return { dir, sourceFile, deployFile, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('folding: each vars table sends its empty ones as one BLANK_VARS line, and nothing else changes', () => {
  const { text, folded } = foldBlankVars(SOURCE);
  const emptyLines = SOURCE.split('\n').filter((l) => /^[A-Z0-9_]+ = ""$/.test(l));
  assert.ok(emptyLines.length > 20, 'wrangler.toml has its empty vars');
  assert.equal(folded.vars.length + (folded['env.staging.vars']?.length || 0), emptyLines.length, 'every empty var line is folded');
  assert.equal((text.match(new RegExp(`^${BLANK_VARS} = `, 'gm')) || []).length, 2, 'one line in [vars], one in [env.staging.vars]');
  // the rest of the file, line for line
  const keep = (t) => t.split('\n').filter((l) => !/^[A-Z0-9_]+ = ""$/.test(l) && !l.startsWith(`${BLANK_VARS} =`));
  assert.deepEqual(keep(text), keep(SOURCE));
  assert.ok(folded.vars.includes('PUBLIC_URL') && folded.vars.includes('DB_JURISDICTION'));
  assert.deepEqual(envNames(SOURCE), ['staging']);
});

test('folding: a file with no empty var is left as it is; a file that sets BLANK_VARS itself is refused', () => {
  const plain = 'name = "x"\nmain = "src/index.js"\n\n[vars]\nA = "1"\n';
  assert.equal(foldBlankVars(plain).text, plain);
  assert.throws(() => foldBlankVars('[vars]\nBLANK_VARS = "A"\nA = ""\n'), /sets BLANK_VARS itself/);
  // a var that only holds spaces, a comment after the value, Windows line ends: still read the TOML way
  const { folded } = foldBlankVars('[vars]\r\nA = ""  # later\r\nB = " "\r\n[observability]\r\nC = ""\r\n');
  assert.deepEqual(folded, { vars: ['A'] }, 'only "" in a vars table is folded');
});

test('the deploy file means what wrangler.toml says, read with wrangler\'s own reader, as shipped and after setup', () => {
  for (const source of [SOURCE, AFTER_SETUP]) {
    const p = pair(source, foldBlankVars(source).text);
    try {
      assert.deepEqual(differences(readWranglerConfig, p.sourceFile, p.deployFile, envNames(source)), []);
    } finally { p.done(); }
  }
});

test('the check refuses a deploy file that means anything else', () => {
  const good = foldBlankVars(AFTER_SETUP).text;
  const cases = [
    [good.replace(/^AI_PAYWALL = "[^"]*"$/m, 'AI_PAYWALL = "on"'), /top level: vars differ \(AI_PAYWALL\)/],
    [good.replace(/^BLANK_VARS = "PUBLIC_URL,/m, 'BLANK_VARS = "'), /top level: vars differ \(PUBLIC_URL\)/],
    [good.replace('name = "madregot-api"', 'name = "madregot-other"'), /top level: name differs/],
    [good.replace(/^compatibility_date = .*$/m, 'compatibility_date = "2026-01-01"'), /compatibility_date differs/],
  ];
  for (const [text, why] of cases) {
    const p = pair(AFTER_SETUP, text);
    try {
      const found = differences(readWranglerConfig, p.sourceFile, p.deployFile, envNames(AFTER_SETUP));
      assert.match(found.join('\n'), why);
    } finally { p.done(); }
  }
});

test(`the production Worker gets few enough settings for the free plan's ${FREE_PLAN_SETTINGS}, with room for the secrets`, () => {
  for (const source of [SOURCE, AFTER_SETUP]) {
    const p = pair(source, foldBlankVars(source).text);
    try {
      const sent = settingsSent(readWranglerConfig, p.deployFile);
      const before = Object.keys(readWranglerConfig(p.sourceFile).vars).length;
      assert.ok(before > FREE_PLAN_SETTINGS, `wrangler.toml alone has ${before}: this is why the folding exists`);
      assert.ok(sent + SECRETS_ROOM <= FREE_PLAN_SETTINGS, `${sent} vars + ${SECRETS_ROOM} secrets must fit in ${FREE_PLAN_SETTINGS}`);
    } finally { p.done(); }
  }
});

test('withBlankVars: the folded names read "" again, a value of their own wins, and without BLANK_VARS nothing changes', () => {
  const plain = { A: '1' };
  assert.equal(withBlankVars(plain), plain, 'no BLANK_VARS: the same object');
  assert.equal(withBlankVars(undefined), undefined);
  const env = { [BLANK_VARS]: 'PUBLIC_URL, EMAIL_FROM,,SECRET_SET', SECRET_SET: 'kept', A: '1' };
  const out = withBlankVars(env);
  assert.deepEqual(out, { PUBLIC_URL: '', EMAIL_FROM: '', SECRET_SET: 'kept', A: '1' });
  assert.equal(BLANK_VARS in out, false);
  assert.equal(withBlankVars(env), out, 'one restored env per env object, so caches keyed on env keep working');
  assert.equal(env.PUBLIC_URL, undefined, 'the runtime\'s own object is not changed');
});

test('the Worker answers the same with the folded env as with the empty vars written out', async () => {
  const { vars } = readWranglerConfig(path.join(here, '..', 'wrangler.toml'));
  const blanks = Object.keys(vars).filter((k) => vars[k] === '');
  const routes = [['GET', '/api/health'], ['GET', '/api/billing/plans'], ['GET', '/api/ai/status'], ['GET', '/api/push/key'], ['GET', '/api/account']];
  for (const [method, url] of routes) {
    const answers = [];
    for (const folded of [false, true]) {
      // wrangler.toml's vars over the test env: the empty ones either written out or folded the deploy's way
      const base = makeEnv({ ...vars });
      const env = folded ? { ...Object.fromEntries(Object.entries(base).filter(([k]) => !blanks.includes(k))), [BLANK_VARS]: blanks.join(',') } : base;
      const res = await worker.fetch(request(method, url), env, makeCtx());
      answers.push([res.status, await res.text()]);
    }
    assert.deepEqual(answers[1], answers[0], `${method} ${url}`);
  }
});
