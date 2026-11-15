// COUNCIL2-21: the code where a student's progress can be lost is type-checked (`npm run typecheck`, CI's web job:
// npx tsc -p tsconfig.json). This pins which files: every module of lib/durable (but the tests and testing.js, the
// tests' helpers), store.js and api.js starts with `// @ts-check` and is in tsconfig.json's include, so a new durable
// module cannot stay out of the check unnoticed, and none can drop its pragma.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const checked = [
  ...readdirSync(new URL('src/lib/durable/', root))
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'testing.js')
    .map((f) => `src/lib/durable/${f}`),
  'src/lib/store.js',
  'src/lib/api.js',
];

describe('the type check of the durable layer, the store and the API client', () => {
  it('covers every durable module, the store and the API client', () => {
    expect(checked.length).toBeGreaterThan(20);
    for (const f of checked) expect(read(f).split('\n')[0], f).toBe('// @ts-check');
  });

  it('lists them in tsconfig.json, strict, and leaves the tests out', () => {
    const cfg = JSON.parse(read('tsconfig.json'));
    expect(cfg.compilerOptions.strict).toBe(true);
    expect(cfg.include).toEqual(expect.arrayContaining(['src/lib/durable/*.js', 'src/lib/store.js', 'src/lib/api.js']));
    expect(cfg.exclude).toEqual(expect.arrayContaining(['src/**/*.test.js', 'src/lib/durable/testing.js']));
  });

  it('runs in CI before the unit tests', () => {
    const ci = readFileSync(new URL('../../.github/workflows/ci.yml', root), 'utf8');
    expect(ci).toMatch(/npx tsc -p tsconfig\.json --noEmit/);
    expect(JSON.parse(read('package.json')).scripts.typecheck).toBe('tsc -p tsconfig.json');
  });
});
