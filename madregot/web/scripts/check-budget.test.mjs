// The load-time budget (DURABLE-11, check-budget.mjs) on a fake dist: a gate that fails the build, a missed target
// that only warns, the render-blocking CSS summed over two stylesheets, lazy chunks and the precache.
// Then the student lane's rule (STUDENT-15): a lazyOnly module in a boot file is refused, the same module in a chunk
// loaded on demand is not, and a build without the module map is refused. Then the real files: web/budget.json names
// the lane's lazy-only modules, npm run build runs the check, and the hygiene greps of the UI-library plan stay empty.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { bootFiles, measure, check, matches } from './check-budget.mjs';

let dir;
// random bytes do not compress: a file of n random bytes is about n bytes gzipped
const file = (name, n) => { const b = randomBytes(n); writeFileSync(join(dir, name), b); return gzipSync(b, { level: 9 }).length; };
const sizes = {};
const INDEX = `<!doctype html><html><head>
    <script type="module" crossorigin src="./assets/index-a.js"></script>
    <link rel="modulepreload" crossorigin href="./assets/katex-b.js">
    <link rel="stylesheet" crossorigin href="./assets/katex-c.css">
    <link rel="stylesheet" crossorigin href="./assets/index-d.css">
    <link rel="manifest" href="./manifest.webmanifest">
  </head><body><div id="root"></div></body></html>`;
const BUDGET = { bootJsGzipKB: 330, bootJsTargetKB: 260, cssGzipKB: 42, cssTargetKB: 32, anyChunkGzipKB: 150, precacheMB: 4.5 };

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'budget-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), INDEX);
  sizes.entry = file('assets/index-a.js', 200_000);
  sizes.katex = file('assets/katex-b.js', 80_000);
  sizes.css1 = file('assets/katex-c.css', 8_000);
  sizes.css2 = file('assets/index-d.css', 27_000);
  sizes.lazy = file('assets/Lesson-e.js', 40_000);
  file('assets/signed-f.js', 20_000);
  writeFileSync(join(dir, 'sw.js'), 'self.__PRECACHE = ["assets/index-a.js","assets/katex-b.js","assets/Lesson-e.js","index.html"];\nself.__RELEASE = "t";\n');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('check-budget', () => {
  it('finds the boot files in index.html: the entry, its modulepreloads, every stylesheet', () => {
    const html = '<script type="module" src="/assets/a.js"></script><link rel="modulepreload" href="/assets/b.js"><link rel="stylesheet" href="./assets/c.css"><link rel="icon" href="x.png"><script src="legacy.js"></script>';
    expect(bootFiles(html)).toEqual({ js: ['assets/a.js', 'assets/b.js'], css: ['assets/c.css'] });
  });
  it('sums the render-blocking CSS over both stylesheets, and boot JS over the entry and its preload', () => {
    const m = measure(dir);
    expect(m.bootCss).toBe(sizes.css1 + sizes.css2);
    expect(m.bootJs).toBe(sizes.entry + sizes.katex);
    expect(m.lazy.map((f) => f.file)).toEqual(['assets/Lesson-e.js', 'assets/signed-f.js']);
    expect(m.biggestLazy.gz).toBe(sizes.lazy);
    expect(m.precache).toBe(200_000 + 80_000 + 40_000 + Buffer.byteLength(INDEX));
  });
  it('passes under every gate, and only warns when a target is missed (boot JS about 280 KB, target 260)', () => {
    const r = check(dir, BUDGET);
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/warning boot JS \(gzip\): 28\d\.\d KB misses the target of 260\.0 KB/);
    expect(r.text).not.toMatch(/FAIL/);
    expect(r.text).toMatch(/budget: every gate passes/);
  });
  it('fails over a gate: boot JS, the CSS sum, a lazy chunk, the precache', () => {
    expect(check(dir, { ...BUDGET, bootJsGzipKB: 250 }).text).toMatch(/FAIL boot JS \(gzip\): 28\d\.\d KB is over the gate of 250\.0 KB/);
    // 8 + 27 KB: each sheet alone is under 30 KB, the two together are not
    const css = check(dir, { ...BUDGET, cssGzipKB: 30 });
    expect(css.ok).toBe(false);
    expect(css.text).toMatch(/FAIL render-blocking CSS/);
    expect(check(dir, { ...BUDGET, anyChunkGzipKB: 30 }).text).toMatch(/FAIL largest lazy chunk \(gzip\): assets\/Lesson-e\.js/);
    expect(check(dir, { ...BUDGET, precacheMB: 0.3 }).text).toMatch(/FAIL service worker precache: 0\.32 MB/);
  });
  it('as the build runs it: exit 1 over a gate, 0 with a warning', () => {
    const write = (b) => { const f = join(dir, 'budget.json'); writeFileSync(f, JSON.stringify(b)); return f; };
    const fail = spawnSync(process.execPath, ['scripts/check-budget.mjs', dir, '--budget', write({ ...BUDGET, bootJsGzipKB: 250 })], { encoding: 'utf8' });
    expect(fail.status).toBe(1);
    expect(fail.stdout).toMatch(/OVER THE GATE/);
    const warn = spawnSync(process.execPath, ['scripts/check-budget.mjs', dir, '--budget', write(BUDGET)], { encoding: 'utf8' });
    expect(warn.status).toBe(0);
    expect(warn.stdout).toMatch(/\(target missed\)/);
  });
});


// ---- the student lane's lazyOnly rule (STUDENT-15)
const WEB = fileURLToPath(new URL('..', import.meta.url));
let dists = [];
afterEach(() => { for (const d of dists) rmSync(d, { recursive: true, force: true }); dists = []; });

/** A build: the entry (with its static import modulepreloaded), a chunk loaded on demand, and the module map. */
function lazyDist(vendorModules = ['node_modules/react/index.js'], { map = true } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'budget-lazy-'));
  dists.push(d);
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'index.html'), '<script type="module" src="./assets/index-a1.js"></script><link rel="modulepreload" href="./assets/vendor-b2.js">');
  for (const f of ['index-a1.js', 'vendor-b2.js', 'Wardrobe-c3.js']) writeFileSync(join(d, 'assets', f), randomBytes(2000));
  if (map) {
    mkdirSync(join(d, '.vite'));
    writeFileSync(join(d, '.vite', 'modules.json'), JSON.stringify({
      'assets/index-a1.js': { isEntry: true, imports: ['assets/vendor-b2.js'], dynamicImports: ['assets/Wardrobe-c3.js'], modules: ['src/main.jsx', 'src/lib/store.js'] },
      'assets/vendor-b2.js': { isEntry: false, imports: [], dynamicImports: [], modules: vendorModules },
      'assets/Wardrobe-c3.js': { isEntry: false, imports: [], dynamicImports: [], modules: ['src/screens/Wardrobe.jsx', 'src/components/mascot/Accessories.jsx'] },
    }));
  }
  return d;
}
const LAZY = { ...BUDGET, bootJsGzipKB: 1000, lazyOnly: ['Wardrobe', 'push', 'cmdk', 'Accessories'] };

describe('check-budget: modules that must load on demand (STUDENT-15)', () => {
  it('passes when every lazyOnly module is in a chunk loaded on demand', () => {
    const r = check(lazyDist(), LAZY);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/the 4 lazy-only modules load on demand/);
  });

  it('refuses a lazyOnly module in a boot file, wherever it was bundled', () => {
    const r = check(lazyDist(['node_modules/react/index.js', 'src/lib/push.js', 'node_modules/cmdk/dist/index.mjs']), LAZY);
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(2);
    expect(r.problems[0]).toMatch(/^push must load on demand, but src\/lib\/push\.js is in the first load \(assets\/vendor-b2\.js\)/);
    expect(r.problems[1]).toMatch(/^cmdk must load on demand, but node_modules\/cmdk\/dist\/index\.mjs/);
    expect(r.text).toMatch(/FAIL push must load on demand/);
  });

  it('a name matches a file by its base name or a package by its name, nothing looser', () => {
    expect(matches('src/lib/push.js', 'push')).toBe(true);
    expect(matches('src/lib/pushState.js', 'push')).toBe(false);
    expect(matches('src/components/learn/ReminderCard.jsx', 'push')).toBe(false);
    expect(matches('node_modules/cmdk/dist/index.mjs', 'cmdk')).toBe(true);
    expect(matches('node_modules/some-lib/push.js', 'push')).toBe(false);
    expect(matches('src/screens/Wardrobe.jsx', 'Wardrobe')).toBe(true);
  });

  it('refuses a build without the module map, and the command removes .vite after the check', () => {
    expect(check(lazyDist(undefined, { map: false }), LAZY).problems).toEqual(['.vite/modules.json is missing (vite.config.js must use scripts/vite-plugin-budget.mjs)']);
    const d = lazyDist();
    const f = join(d, 'budget.json');
    writeFileSync(f, JSON.stringify(LAZY));
    const run = spawnSync(process.execPath, ['scripts/check-budget.mjs', d, '--budget', f], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(existsSync(join(d, '.vite'))).toBe(false);
  });
});

describe('the budget as configured', () => {
  const budget = JSON.parse(readFileSync(join(WEB, 'budget.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));

  it('names the lazy-only modules (the student lane\'s, and the demo class of FOLLOWUP-23), beside the load-time gates', () => {
    expect(budget.lazyOnly).toEqual(['Wardrobe', 'RecapSheet', 'Accessories', 'push', 'canvas-confetti', 'recharts', 'cmdk', 'demo', 'DemoAsk']);
    for (const k of ['bootJsGzipKB', 'cssGzipKB', 'anyChunkGzipKB', 'precacheMB']) expect(typeof budget[k], k).toBe('number');
  });

  it('npm run build writes the module map and runs the check last', () => {
    expect(pkg.scripts.build).toMatch(/vite build && .*node scripts\/check-budget\.mjs dist$/);
    expect(readFileSync(join(WEB, 'vite.config.js'), 'utf8')).toMatch(/budgetMap\(\)/);
  });

  it('the hygiene greps stay empty in src/: no Tailwind, no motion.div (m.* only), no locales= on NumberFlow', () => {
    const files = [];
    const walk = (dd) => { for (const n of readdirSync(dd)) { const p = join(dd, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?|css)$/.test(n)) files.push(p); } };
    walk(join(WEB, 'src'));
    const hits = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const re of [/tailwind/i, /\bmotion\.(div|span|li|p|button)\b/, /locales=/]) if (re.test(text)) hits.push(`${f.slice(WEB.length)}: ${re}`);
    }
    expect(hits).toEqual([]);
  });
});
