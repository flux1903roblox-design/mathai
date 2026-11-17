// .github/workflows/deploy.yml, read as text (no YAML package in the repository): the production deploy runs only when
// someone starts it (workflow_dispatch), one at a time, with read-only repository access. Two jobs: checks is ci.yml
// itself (workflow_call) on the commit being deployed, so the deploy passes exactly the merge gate (web, worker and e2e,
// the phone flows and the contract tests included); deploy needs it, runs in the protected environment "production", and
// is the only job that sees the Cloudflare token, only in the steps that talk to Cloudflare. In it the build with its
// gates runs before the deploy file, the migrations and the deploy (--strict, so wrangler never answers its own
// conflict questions), and a smoke check of the live address comes last. Every step is one of the repository's own
// scripts. The actions and Node are pinned as ci.yml pins them.
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
const CI_LINES = CI.split('\n');

/** The lines under a top-level key (`on`, `concurrency`, …), up to the next top-level key. */
function block(key, lines = LINES) {
  const at = lines.findIndex((l) => l.startsWith(`${key}:`));
  assert.ok(at >= 0, `deploy.yml has ${key}:`);
  const end = lines.findIndex((l, i) => i > at && /^[A-Za-z]/.test(l));
  return lines.slice(at, end < 0 ? undefined : end).filter((l) => l.trim() && !l.trim().startsWith('#')).join('\n');
}
/** The lines of one job (`  name:` up to the next job), comments left out. */
function job(name, lines = LINES) {
  const at = lines.findIndex((l) => l === `  ${name}:`);
  assert.ok(at >= 0, `a job ${name}`);
  const end = lines.findIndex((l, i) => i > at && (/^ {2}[a-z][\w-]*:\s*$/.test(l) || /^[A-Za-z]/.test(l)));
  return lines.slice(at, end < 0 ? undefined : end).filter((l) => l.trim() && !l.trim().startsWith('#')).join('\n');
}
/** The steps of the deploy job, each as its text from its "- " line to the next. */
function steps() {
  const at = LINES.findIndex((l) => /^ {4}steps:\s*$/.test(l));
  assert.ok(at >= 0, 'the deploy job has steps');
  assert.equal(LINES.filter((l) => /^ {4}steps:\s*$/.test(l)).length, 1, 'only the deploy job has steps of its own');
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

test('deploy.yml is plain YAML: no tabs, two-space indents, two jobs: checks, then deploy', () => {
  assert.doesNotMatch(TEXT, /\t/);
  for (const l of LINES) if (l.trim() && !l.trim().startsWith('#')) assert.equal((/^ */.exec(l)[0].length) % 2, 0, l);
  assert.match(TEXT, /^name: Deploy$/m, 'Actions › Deploy');
  const jobs = LINES.slice(LINES.indexOf('jobs:') + 1).filter((l) => /^ {2}[a-z][\w-]*:\s*$/.test(l)).map((l) => l.trim().slice(0, -1));
  assert.deepEqual(jobs, ['checks', 'deploy']);
});

test('checks is ci.yml itself on the commit being deployed: web, worker and e2e, with no secret', () => {
  assert.equal(job('checks'), '  checks:\n    uses: ./.github/workflows/ci.yml\n    with:\n      ref: ${{ inputs.ref || github.sha }}', 'no secrets: and no secrets: inherit');
  assert.match(job('deploy'), /^ {4}needs: \[checks\]$/m, 'the deploy waits for all three');
  // ci.yml can be called, with the commit to check, and checks out that commit in every job
  assert.match(CI, /^ {2}workflow_call:\n {4}inputs:\n {6}ref:\n(?: {8}.*\n)*? {8}type: string$/m);
  assert.match(CI, /^ {2}push:\n {4}branches: \[main\]\n {2}pull_request: \{\}$/m, 'the merge gate itself is unchanged');
  const ciJobs = CI_LINES.slice(CI_LINES.indexOf('jobs:') + 1).filter((l) => /^ {2}[a-z][\w-]*:\s*$/.test(l)).map((l) => l.trim().slice(0, -1));
  assert.deepEqual(ciJobs, ['web', 'worker', 'e2e']);
  for (const name of ciJobs) {
    const j = job(name, CI_LINES);
    assert.match(j, /- uses: actions\/checkout@v\d+\n {8}with:\n {10}ref: \$\{\{ inputs\.ref \}\}/, `${name} checks out the commit it was given`);
  }
  assert.equal((CI.match(/uses: actions\/checkout@/g) || []).length, ciJobs.length);
  // what the deploy now waits for, beyond the unit tests: the full-depth labels, the phone flows, the contract tests
  // against the real Worker, the Arabic projects and the dark-mode axe scan
  assert.match(job('web', CI_LINES), /LABELS_DISTINCT: '2000'/);
  assert.match(job('web', CI_LINES), /- run: npm run build$/m);
  assert.match(job('worker', CI_LINES), /- run: npm run typecheck\n {6}- run: npm test$/m);
  const e2e = job('e2e', CI_LINES);
  assert.match(e2e, /--project=phone --project=contract --project=arabic --project=arabic-small --grep-invert @perf/);
  assert.match(e2e, /--project=phone-dark a11y\.spec\.js/);
  // the suite outgrows one runner's 40 minutes: four shards side by side, every one of them run before a deploy
  assert.match(e2e, /^ {6}fail-fast: false\n {6}matrix:\n {8}shard: \[1, 2, 3, 4\]$/m);
  assert.equal((e2e.match(/--shard=\$\{\{ matrix\.shard \}\}\/4/g) || []).length, 2, 'both playwright runs are sharded');
  assert.match(e2e, /^ {4}needs: \[web\]$/m);
  // a deploy's checks never share a concurrency group with a push to the same branch (each would cancel the other)
  assert.match(CI, /^concurrency:\n {2}group: ci-\$\{\{ github\.event_name \}\}-\$\{\{ github\.ref \}\}$/m);
  assert.doesNotMatch(CI, /secrets\./, 'ci.yml uses no secret');
});

test('it runs by hand (workflow_dispatch) and on a push to the app\'s branch only, never on a pull request or a schedule', () => {
  const on = block('on');
  assert.match(on, /^on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}ref:\n/);
  assert.match(on, /^ {8}default: claude\/software-improvement-92s9ze$/m);
  assert.match(on, /^ {8}type: string$/m);
  // the owner chose automatic publishing: a push to the app's branch (and only that branch) deploys the pushed commit
  assert.match(on, /^ {2}push:\n {4}branches: \[claude\/software-improvement-92s9ze\]\n {4}paths: \['madregot\/\*\*', '\.github\/workflows\/\*\*'\]$/m);
  for (const trigger of ['pull_request', 'pull_request_target', 'schedule', 'workflow_run', 'repository_dispatch', 'release', 'workflow_call']) {
    assert.doesNotMatch(on, new RegExp(`^\\s+${trigger}:`, 'm'), trigger);
  }
  assert.equal(on.split('\n').filter((l) => /^ {2}\S/.test(l)).length, 2, 'two triggers');
  // every place that names the commit takes the hand-run ref, or the pushed commit
  assert.doesNotMatch(TEXT, /\$\{\{ inputs\.ref \}\}/);
  assert.ok((TEXT.match(/\$\{\{ inputs\.ref \|\| github\.sha \}\}/g) || []).length >= 3);
});

test('one deploy at a time, never cancelled halfway, with read-only access, in the protected environment "production"', () => {
  assert.match(block('concurrency'), /^concurrency:\n {2}group: deploy-production\n {2}cancel-in-progress: false$/);
  assert.equal(block('permissions'), 'permissions:\n  contents: read');
  assert.match(job('deploy'), /^ {4}timeout-minutes: \d+$/m);
  // the token is an environment secret: only a run from a branch the environment allows (and, if set, approved by its
  // reviewer) reaches it, never ci.yml on a pull request or a workflow pushed to another branch
  assert.match(job('deploy'), /^ {4}environment: production$/m);
  assert.equal((TEXT.match(/^ +environment:/gm) || []).length, 1, 'one job in the environment');
});

test('actions and Node pinned as ci.yml pins them', () => {
  const uses = [...TEXT.matchAll(/uses: (\S+)/g)].map((m) => m[1]).filter((u) => !u.startsWith('./'));
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
  assert.match(checkout, /ref: \$\{\{ inputs\.ref \|\| github\.sha \}\}/);
  assert.match(checkout, /fetch-depth: 2/);
});

test('in the deploy job the build and its gates come before anything reaches Cloudflare, and the smoke check comes last', () => {
  const order = [
    /- run: npm ci$/m,
    /- run: npm run build:production$/m,
    /- run: node scripts\/deploy-config\.mjs --production$/m,
    /run: npx wrangler d1 migrations apply madregot --remote --config wrangler\.deploy\.toml$/m,
    /run: npx wrangler deploy --strict --config wrangler\.deploy\.toml$/m,
    /run: node scripts\/smoke\.mjs --production$/m,
  ];
  const at = order.map(stepWith);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `in order: ${at.join(', ')}`);
  assert.match(TEXT, /defaults:\n {6}run:\n {8}working-directory: madregot\/worker/);
  assert.equal(STEPS.filter((s) => /- run: npm ci$/m.test(s)).length, 2, 'both packages installed');
  assert.match(STEPS[STEPS.findIndex((s) => /- run: npm ci$/m.test(s)) + 1], /working-directory: madregot\/web/);
  // wrangler only ever deploys or migrates through the checked deploy file
  for (const s of STEPS.filter((x) => /wrangler (deploy|d1)/.test(x))) assert.match(s, /--config wrangler\.deploy\.toml/);
  // --strict: in CI wrangler would answer its own "Would you like to continue?" (a Worker changed in the dashboard, a
  // [vars] name that would replace a secret) with yes; with it, the deploy stops. The deploy from a computer too.
  for (const s of STEPS.filter((x) => /wrangler deploy/.test(x))) assert.match(s, /wrangler deploy --strict /);
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'madregot', 'worker', 'package.json'), 'utf8')).scripts;
  assert.match(pkg['deploy:production'], /&& wrangler deploy --strict --config wrangler\.deploy\.toml$/);
  // the step summary is after the smoke check, and the smoke check is not allowed to fail quietly
  assert.doesNotMatch(TEXT, /continue-on-error/);
  assert.doesNotMatch(TEXT, /if: always\(\)/);
});

test('the Cloudflare token: the environment\'s secret, checked first with the account, and only in the steps that talk to Cloudflare', () => {
  const token = /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/;
  const account = /CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_ID \}\}/;
  const withToken = STEPS.map((s, i) => (/secrets\./.test(s) ? i : -1)).filter((i) => i >= 0);
  const cloudflare = [stepWith(/Cloudflare token and account are set/), stepWith(/wrangler d1 migrations/), stepWith(/wrangler deploy/)];
  assert.deepEqual(withToken, cloudflare, 'no test or build step sees the token');
  for (const i of cloudflare) assert.match(STEPS[i], token);
  for (const i of cloudflare.slice(1)) assert.match(STEPS[i], account);
  assert.equal((TEXT.match(/secrets\.[A-Z_]+/g) || []).filter((s) => s !== 'secrets.CLOUDFLARE_API_TOKEN').length, 0, 'no other secret');
  // checked right after the checkout: the token, and the account (the variable, or account_id in production.json), so
  // wrangler never has to list the token's accounts
  const check = STEPS[cloudflare[0]];
  assert.equal(cloudflare[0], stepWith(/actions\/checkout/) + 1);
  assert.match(check, account);
  assert.match(check, /if \[ -z "\$CLOUDFLARE_API_TOKEN" \]; then/);
  assert.match(check, /if \[ -z "\$CLOUDFLARE_ACCOUNT_ID" \] && ! grep -Eq '"account_id": \*"\[0-9a-fA-F\]\{32\}"' production\.json; then/);
  assert.equal((check.match(/exit 1/g) || []).length, 2);
  assert.match(check, /Settings > Environments > production/);
  // no metrics, for every step
  assert.match(TEXT, /^ {4}env:\n {6}WRANGLER_SEND_METRICS: 'false'$/m);
  // the header documents them: a custom token for one account with no User permission (on an authentication error
  // wrangler prints what /user and /accounts say about the token: with none, no email address reaches the log)
  assert.match(TEXT, /^# .*Settings › Environments › production/m);
  assert.match(TEXT, /^# .*secret {3}CLOUDFLARE_API_TOKEN {3}a custom Cloudflare API token for this one account: Account › Workers Scripts › Edit and$/m);
  assert.match(TEXT, /^# .*Account › D1 › Edit, no User and no Zone permissions$/m);
  assert.match(TEXT, /^# .*variable CLOUDFLARE_ACCOUNT_ID {2}required/m);
  assert.doesNotMatch(TEXT, /Edit Cloudflare Workers/, 'not the broad template');
  // the contact address: a variable of the environment, only in the build's environment, never a secret or a shell line
  const withContact = STEPS.map((s, i) => (/vars\.CONTACT_EMAIL/.test(s) ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(withContact, [stepWith(/- run: npm run build:production$/m)]);
  assert.match(STEPS[withContact[0]], /env:\n {10}CONTACT_EMAIL: \$\{\{ vars\.CONTACT_EMAIL \}\}/);
});

test('no ${{ }} inside a shell line (the ref is passed as an environment variable), and every step is the repository\'s own', () => {
  for (const s of STEPS) {
    const run = /run: (\|\n[\s\S]*|.*)$/m.exec(s)?.[1] || '';
    assert.doesNotMatch(run, /\$\{\{/, s);
  }
  assert.match(STEPS[stepWith(/Summary/)], /env:\n {10}REF: \$\{\{ inputs\.ref \|\| github\.sha \}\}/);
  // npm run X: a script of the package it runs in; node scripts/X: a file there
  const pkg = (dir) => JSON.parse(readFileSync(path.join(ROOT, 'madregot', dir, 'package.json'), 'utf8')).scripts;
  for (const s of STEPS) {
    const dir = /working-directory: madregot\/(\w+)/.exec(s)?.[1] || 'worker';
    for (const m of s.matchAll(/npm run ([\w:-]+)/g)) assert.ok(m[1] in pkg(dir), `${dir}: npm run ${m[1]}`);
    for (const m of s.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)) assert.ok(existsSync(path.join(ROOT, 'madregot', dir, m[1])), `${dir}/${m[1]}`);
  }
});
