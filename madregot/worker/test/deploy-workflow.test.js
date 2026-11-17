// .github/workflows/deploy.yml, read as text (no YAML package in the repository): the production deploy runs only when
// someone starts it (workflow_dispatch), one at a time, with read-only repository access; the Cloudflare token reaches
// only the steps that talk to Cloudflare; every gate (type checks, Worker tests, web unit tests, the build with its
// gates) runs before the deploy file, the migrations and the deploy, in that order, and a smoke check of the live address
// comes last. Every step is one of the repository's own scripts. The actions and Node are pinned as ci.yml pins them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', '..', '..');
const TEXT = readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const CI = readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
const LINES = TEXT.split('\n');

/** The lines under a top-level key (`on`, `concurrency`, …), up to the next top-level key. */
function block(key, lines = LINES) {
  const at = lines.findIndex((l) => l.startsWith(`${key}:`));
  assert.ok(at >= 0, `deploy.yml has ${key}:`);
  const end = lines.findIndex((l, i) => i > at && /^[A-Za-z]/.test(l));
  return lines.slice(at, end < 0 ? undefined : end).filter((l) => l.trim() && !l.trim().startsWith('#')).join('\n');
}
/** The steps of the one job, each as its text from its "- " line to the next. */
function steps() {
  const at = LINES.findIndex((l) => /^ {4}steps:\s*$/.test(l));
  assert.ok(at >= 0, 'one job with steps');
  const out = [];
  for (const l of LINES.slice(at + 1)) {
    if (/^ {6}- /.test(l)) { out.push([l]); continue; }
    if (!l.trim() || /^ {6}#/.test(l)) continue;
    if (/^ {0,5}\S/.test(l)) break;
    out.at(-1).push(l);
  }
  return out.map((s) => s.join('\n'));
}
const STEPS = steps();
const stepWith = (re) => {
  const i = STEPS.findIndex((s) => re.test(s));
  assert.ok(i >= 0, `a step matches ${re}`);
  return i;
};

test('deploy.yml is plain YAML: no tabs, two-space indents, one job', () => {
  assert.doesNotMatch(TEXT, /\t/);
  for (const l of LINES) if (l.trim() && !l.trim().startsWith('#')) assert.equal((/^ */.exec(l)[0].length) % 2, 0, l);
  assert.match(TEXT, /^name: Deploy$/m, 'Actions › Deploy');
  assert.equal(LINES.filter((l) => /^ {2}[a-z][\w-]*:\s*$/.test(l) && LINES.indexOf(l) > LINES.indexOf('jobs:')).length, 1, 'one job');
});

test('it runs only when someone starts it: workflow_dispatch with the branch to deploy, never on a push', () => {
  const on = block('on');
  assert.match(on, /^on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}ref:\n/);
  assert.match(on, /^ {8}default: claude\/software-improvement-92s9ze$/m);
  assert.match(on, /^ {8}type: string$/m);
  for (const trigger of ['push', 'pull_request', 'pull_request_target', 'schedule', 'workflow_run', 'repository_dispatch', 'release', 'workflow_call']) {
    assert.doesNotMatch(on, new RegExp(`^\\s+${trigger}:`, 'm'), trigger);
  }
  assert.equal(on.split('\n').filter((l) => /^ {2}\S/.test(l)).length, 1, 'one trigger');
});

test('one deploy at a time, never cancelled halfway, with read-only access to the repository', () => {
  assert.match(block('concurrency'), /^concurrency:\n {2}group: deploy-production\n {2}cancel-in-progress: false$/);
  assert.equal(block('permissions'), 'permissions:\n  contents: read');
  assert.match(TEXT, /^ {4}timeout-minutes: \d+$/m);
});

test('actions and Node pinned as ci.yml pins them', () => {
  const uses = [...TEXT.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 2);
  const ciUses = new Map([...CI.matchAll(/uses: ([^@\s]+)@(\S+)/g)].map((m) => [m[1], m[2]]));
  for (const u of uses) {
    assert.match(u, /^[\w-]+\/[\w-]+@v\d+$/, `${u}: an action by major version`);
    const [name, version] = u.split('@');
    if (ciUses.has(name)) assert.equal(version, ciUses.get(name), `${name} as in ci.yml`);
  }
  const nodes = (t) => [...t.matchAll(/node-version: '(\d+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(nodes(TEXT))], [...new Set(nodes(CI))]);
  assert.match(STEPS[stepWith(/setup-node/)], /cache: npm/);
  // the checkout is the requested ref, with HEAD~1 for the build's budget ratchet
  const checkout = STEPS[stepWith(/actions\/checkout/)];
  assert.match(checkout, /ref: \$\{\{ inputs\.ref \}\}/);
  assert.match(checkout, /fetch-depth: 2/);
});

test('the gates run before anything reaches Cloudflare, in this order, and the smoke check comes last', () => {
  const order = [
    /- run: npm ci$/m,
    /- run: npm run typecheck$/m,
    /- run: npm test$/m,
    /- run: npx tsc -p tsconfig\.json --noEmit$/m,
    /- run: npx vitest run --maxWorkers=2$/m,
    /- run: npm run build:production$/m,
    /- run: node scripts\/deploy-config\.mjs --production$/m,
    /run: npx wrangler d1 migrations apply madregot --remote --config wrangler\.deploy\.toml$/m,
    /run: npx wrangler deploy --config wrangler\.deploy\.toml$/m,
    /run: node scripts\/smoke\.mjs --production$/m,
  ];
  const at = order.map(stepWith);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `in order: ${at.join(', ')}`);
  // the web steps run in web, the rest in worker (the job's default)
  for (const re of [/npx tsc/, /npx vitest/]) assert.match(STEPS[stepWith(re)], /working-directory: madregot\/web/);
  assert.match(TEXT, /defaults:\n {6}run:\n {8}working-directory: madregot\/worker/);
  assert.equal(STEPS.filter((s) => /- run: npm ci$/m.test(s)).length, 2, 'both packages installed');
  // wrangler only ever deploys or migrates through the checked deploy file
  for (const s of STEPS.filter((x) => /wrangler (deploy|d1)/.test(x))) assert.match(s, /--config wrangler\.deploy\.toml/);
  // the step summary is after the smoke check, and the smoke check is not allowed to fail quietly
  assert.doesNotMatch(TEXT, /continue-on-error/);
  assert.doesNotMatch(TEXT, /if: always\(\)/);
});

test('the Cloudflare token: from the repository secret, checked first, and only in the steps that talk to Cloudflare', () => {
  const token = /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/;
  const account = /CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_ID \}\}/;
  const withToken = STEPS.map((s, i) => (/secrets\./.test(s) ? i : -1)).filter((i) => i >= 0);
  const cloudflare = [stepWith(/Cloudflare token is set/), stepWith(/wrangler d1 migrations/), stepWith(/wrangler deploy/)];
  assert.deepEqual(withToken, cloudflare, 'no test or build step sees the token');
  for (const i of cloudflare) assert.match(STEPS[i], token);
  for (const i of cloudflare.slice(1)) assert.match(STEPS[i], account);
  assert.equal((TEXT.match(/secrets\.[A-Z_]+/g) || []).filter((s) => s !== 'secrets.CLOUDFLARE_API_TOKEN').length, 0, 'no other secret');
  // checked right after the checkout, before twenty minutes of tests
  const check = STEPS[cloudflare[0]];
  assert.equal(cloudflare[0], stepWith(/actions\/checkout/) + 1);
  assert.match(check, /if \[ -z "\$CLOUDFLARE_API_TOKEN" \]; then/);
  assert.match(check, /exit 1/);
  // no metrics, for every step
  assert.match(TEXT, /^ {4}env:\n {6}WRANGLER_SEND_METRICS: 'false'$/m);
  // the header documents both
  assert.match(TEXT, /^# .*secret {3}CLOUDFLARE_API_TOKEN/m);
  assert.match(TEXT, /^# .*variable CLOUDFLARE_ACCOUNT_ID {2}optional/m);
});

test('no ${{ }} inside a shell line (the ref is passed as an environment variable), and every step is the repository\'s own', () => {
  for (const s of STEPS) {
    const run = /run: (\|\n[\s\S]*|.*)$/m.exec(s)?.[1] || '';
    assert.doesNotMatch(run, /\$\{\{/, s);
  }
  assert.match(STEPS[stepWith(/Summary/)], /env:\n {10}REF: \$\{\{ inputs\.ref \}\}/);
  // npm run X: a script of the package it runs in; node scripts/X: a file there
  const pkg = (dir) => JSON.parse(readFileSync(path.join(ROOT, 'madregot', dir, 'package.json'), 'utf8')).scripts;
  for (const s of STEPS) {
    const dir = /working-directory: madregot\/(\w+)/.exec(s)?.[1] || 'worker';
    for (const m of s.matchAll(/npm run ([\w:-]+)/g)) assert.ok(m[1] in pkg(dir), `${dir}: npm run ${m[1]}`);
    for (const m of s.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)) assert.ok(existsSync(path.join(ROOT, 'madregot', dir, m[1])), `${dir}/${m[1]}`);
  }
});
