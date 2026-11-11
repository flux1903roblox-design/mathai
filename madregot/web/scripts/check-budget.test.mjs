// The load budget gate (STUDENT-15), on a fake build folder: the first load is the entry and its static imports only;
// a lazyOnly module there is refused, the same module in a chunk loaded on demand is not; the first load may grow by
// studentBootDeltaKB over the baseline and no more; a chunk loaded on demand may not pass chunkMaxKB. Then the real
// files: web/budget.json names the lane's lazy-only modules, npm run build runs the check, and the hygiene greps of the
// UI-library plan stay empty in src/.
import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { check, staticGraph, matches, gzipSize } from './check-budget.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
let dirs = [];
afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs = []; });

/**
 * A build folder: `chunks` maps a file to { kb (incompressible bytes, so gzip ≈ size), entry, imports, dynamic, modules }.
 * The manifest is keyed by the file's source, as Vite's is.
 */
function fakeDist(chunks) {
  const dist = mkdtempSync(join(tmpdir(), 'budget-'));
  dirs.push(dist);
  mkdirSync(join(dist, 'assets'));
  mkdirSync(join(dist, '.vite'));
  const key = (file) => `src/${file.replace(/^assets\//, '').replace(/-\w+\.js$/, '')}.jsx`;
  const manifest = {};
  const modules = {};
  for (const [file, c] of Object.entries(chunks)) {
    writeFileSync(join(dist, file), randomBytes(Math.round(c.kb * 1024)));
    manifest[c.entry ? 'index.html' : key(file)] = {
      file, isEntry: !!c.entry, isDynamicEntry: !c.entry && !c.shared,
      imports: (c.imports || []).map(key), dynamicImports: (c.dynamic || []).map(key),
    };
    modules[file] = { isEntry: !!c.entry, imports: c.imports || [], dynamicImports: c.dynamic || [], modules: c.modules || [] };
  }
  writeFileSync(join(dist, '.vite', 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(dist, '.vite', 'modules.json'), JSON.stringify(modules));
  return dist;
}
const BUDGET = { studentBootBaselineCommit: '5618298', studentBootBaselineKB: 100, studentBootDeltaKB: 6, chunkMaxKB: 150, lazyOnly: ['Wardrobe', 'push', 'cmdk', 'Accessories'] };
const app = (extra = {}) => ({
  'assets/index-a1.js': { kb: 90, entry: true, imports: ['assets/vendor-b2.js'], dynamic: ['assets/Wardrobe-c3.js'], modules: ['src/main.jsx', 'src/lib/store.js', 'src/components/ui.jsx'] },
  'assets/vendor-b2.js': { kb: 12, shared: true, modules: ['node_modules/react/index.js'] },
  'assets/Wardrobe-c3.js': { kb: 5, modules: ['src/screens/Wardrobe.jsx', 'src/components/mascot/Accessories.jsx'] },
  ...extra,
});

describe('check-budget', () => {
  it('the first load is the entry and its static imports, not what it loads on demand', () => {
    const dist = fakeDist(app());
    const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));
    expect([...staticGraph(manifest)].sort()).toEqual(['index.html', 'src/vendor.jsx']);
    const { problems, measured } = check(dist, BUDGET);
    expect(problems).toEqual([]);
    const boot = gzipSize(join(dist, 'assets/index-a1.js')) + gzipSize(join(dist, 'assets/vendor-b2.js'));
    expect(measured.bootJsGzipKB).toBeCloseTo(boot / 1024, 1);
  });

  it('refuses a lazyOnly module in the first load, wherever it was bundled', () => {
    const dist = fakeDist(app({
      'assets/vendor-b2.js': { kb: 12, shared: true, modules: ['node_modules/react/index.js', 'src/lib/push.js', 'node_modules/cmdk/dist/index.mjs'] },
    }));
    const { problems } = check(dist, BUDGET);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^push must load on demand, but src\/lib\/push\.js is in the first load \(assets\/vendor-b2\.js\)/);
    expect(problems[1]).toMatch(/^cmdk must load on demand, but node_modules\/cmdk\/dist\/index\.mjs/);
  });

  it('a name matches a file by its base name or a package by its name, nothing looser', () => {
    expect(matches('src/lib/push.js', 'push')).toBe(true);
    expect(matches('src/lib/pushState.js', 'push')).toBe(false);
    expect(matches('src/components/learn/ReminderCard.jsx', 'push')).toBe(false);
    expect(matches('node_modules/cmdk/dist/index.mjs', 'cmdk')).toBe(true);
    expect(matches('node_modules/some-lib/push.js', 'push')).toBe(false);
    expect(matches('src/screens/Wardrobe.jsx', 'Wardrobe')).toBe(true);
  });

  it('allows the first load to grow by studentBootDeltaKB, and refuses more', () => {
    // baseline 100 KB: 90 + 12 is about 102 (fine); 90 + 18 is about 108 (over by 2)
    expect(check(fakeDist(app()), BUDGET).problems).toEqual([]);
    const { problems } = check(fakeDist(app({ 'assets/vendor-b2.js': { kb: 18, shared: true, modules: [] } })), BUDGET);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/first-load JavaScript is 10[78]\.\d KB gzipped: [78]\.\d KB over 5618298 \(100 KB\), more than the 6 KB allowed/);
  });

  it('refuses a chunk loaded on demand over chunkMaxKB (the entry is DURABLE-11\'s to split)', () => {
    const dist = fakeDist(app({ 'assets/Wardrobe-c3.js': { kb: 160, modules: ['src/screens/Wardrobe.jsx'] } }));
    const { problems } = check(dist, { ...BUDGET, studentBootBaselineKB: 1000 });
    expect(problems).toEqual([expect.stringMatching(/^assets\/Wardrobe-c3\.js is 16\d\.\d KB gzipped, over 150 KB$/)]);
    expect(check(fakeDist(app({ 'assets/index-a1.js': { kb: 400, entry: true, imports: ['assets/vendor-b2.js'], modules: [] } })), { ...BUDGET, studentBootBaselineKB: 1000 }).problems).toEqual([]);
  });

  it('measures the first load\'s CSS (the entry\'s and its static imports\' stylesheets), and refuses growth over studentCssDeltaKB', () => {
    const withCss = (bootKb, lazyKb) => {
      const dist = fakeDist(app());
      const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));
      writeFileSync(join(dist, 'assets/index-a1.css'), randomBytes(Math.round(bootKb * 1024)));
      writeFileSync(join(dist, 'assets/Wardrobe-c3.css'), randomBytes(Math.round(lazyKb * 1024)));
      manifest['index.html'].css = ['assets/index-a1.css'];
      manifest['src/Wardrobe.jsx'].css = ['assets/Wardrobe-c3.css'];
      writeFileSync(join(dist, '.vite', 'manifest.json'), JSON.stringify(manifest));
      return dist;
    };
    const CSS = { ...BUDGET, studentCssBaselineKB: 40, studentCssDeltaKB: 0 };
    // 39 KB first, and a screen's own 20 KB that loads with it: under the baseline
    const ok = check(withCss(39, 20), CSS);
    expect(ok.problems).toEqual([]);
    expect(ok.measured.bootCss).toEqual(['assets/index-a1.css']);
    expect(ok.measured.bootCssGzipKB).toBeGreaterThan(38.9);
    expect(ok.measured.bootCssGzipKB).toBeLessThan(39.2);
    expect(ok.report).toMatch(/and 39(\.\d)? KB CSS \([\d.]+ KB less than 40 KB, at most 0 KB more allowed\)/);
    // the same 20 KB put in the first load instead: refused
    const over = check(withCss(44, 1), CSS);
    expect(over.problems).toEqual([expect.stringMatching(/^first-load CSS is 44(\.\d)? KB gzipped: 4(\.\d)? KB over 5618298 \(40 KB\), more than the 0 KB allowed/)]);
    // a budget with no CSS baseline checks no CSS
    expect(check(withCss(44, 1), BUDGET).problems).toEqual([]);
  });

  it('refuses a build without the module map', () => {
    const dist = fakeDist(app());
    rmSync(join(dist, '.vite', 'modules.json'));
    expect(check(dist, BUDGET).problems).toEqual(['.vite/modules.json is missing (vite.config.js must use scripts/vite-plugin-budget.mjs)']);
  });
});

describe('the budget as configured', () => {
  const budget = JSON.parse(readFileSync(join(WEB, 'budget.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));

  it('names the lane\'s lazy-only modules, the baseline commit and the 6 KB share', () => {
    expect(budget.lazyOnly).toEqual(['Wardrobe', 'RecapSheet', 'Accessories', 'push', 'canvas-confetti', 'recharts', 'cmdk']);
    expect(budget).toMatchObject({ studentBootBaselineCommit: '5618298', studentBootDeltaKB: 6, chunkMaxKB: 150 });
    expect(budget.studentBootBaselineKB).toBeGreaterThan(0);
    // STUDENT-15: no net CSS growth over the same commit's first load (48.1 KB gzipped, KaTeX's stylesheet included)
    expect(budget).toMatchObject({ studentCssBaselineKB: 48.1, studentCssDeltaKB: 0 });
  });

  it('npm run build makes the manifest and runs the check', () => {
    expect(pkg.scripts.build).toMatch(/^vite build --manifest && .*node scripts\/check-budget\.mjs dist$/);
    expect(readFileSync(join(WEB, 'vite.config.js'), 'utf8')).toMatch(/budgetMap\(\)/);
  });

  it('the hygiene greps stay empty in src/: no Tailwind, no motion.div (m.* only), no locales= on NumberFlow', () => {
    const files = [];
    const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?|css)$/.test(n)) files.push(p); } };
    walk(join(WEB, 'src'));
    const hits = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const re of [/tailwind/i, /\bmotion\.(div|span|li|p|button)\b/, /locales=/]) if (re.test(text)) hits.push(`${f.slice(WEB.length)}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});
