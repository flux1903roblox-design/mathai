// COUNCIL2-21: the Worker's money, vault and storage code is type-checked (`npm run typecheck`, CI's worker job), with
// the TypeScript of ../web/node_modules and the local typedefs of src/types.js. This pins the files and the wiring, so
// none of them can leave the check unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CHECKED = ['src/util.js', 'src/entitle.js', 'src/billing.js', 'src/vault.js'];

test('the money, vault and storage files are marked for the check and listed in tsconfig.json', () => {
  const cfg = JSON.parse(read('tsconfig.json'));
  assert.equal(cfg.compilerOptions.strict, true);
  assert.equal(cfg.compilerOptions.checkJs, false, 'only the marked files are checked, not every module they import');
  for (const f of CHECKED) {
    assert.equal(read(f).split('\n')[0], '// @ts-check', f);
    assert.ok(cfg.include.includes(f), `${f} is in tsconfig.json`);
  }
  assert.ok(cfg.include.includes('src/types.js'));
});

test('the typedefs file runs nothing', () => {
  const code = read('src/types.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
  assert.equal(code, 'export {};');
});

test('npm run typecheck uses the web app\'s TypeScript, and CI runs it in the worker job', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.typecheck, 'node ../web/node_modules/typescript/bin/tsc -p tsconfig.json');
  const ci = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const worker = ci.slice(ci.indexOf('\n  worker:'), ci.indexOf('\n  e2e:'));
  assert.match(worker, /npm run typecheck/);
  assert.match(worker, /working-directory: madregot\/web/, 'the web packages (TypeScript) are installed in the worker job');
});
