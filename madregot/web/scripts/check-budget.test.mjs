// The load-time budget (DURABLE-11, check-budget.mjs) on a fake dist: a gate that fails the build, a missed target
// that only warns, the render-blocking CSS summed over two stylesheets, lazy chunks and the precache.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { bootFiles, measure, check } from './check-budget.mjs';

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

