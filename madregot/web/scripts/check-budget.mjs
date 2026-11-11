// The load budget (STUDENT-15), checked after every `vite build --manifest` (npm run build runs it). It reads
// <dist>/.vite/manifest.json (Vite's) and <dist>/.vite/modules.json (scripts/vite-plugin-budget.mjs) and refuses a build
// that breaks web/budget.json:
//   lazyOnly             modules that must load on demand only (the wardrobe, the Sunday recap, מדי's accessories, the
//                        reminder code, and the libraries kept off student screens). None may be in the first load: the
//                        entry chunk and every chunk it imports statically. A name matches a source file by its base
//                        name (Wardrobe → src/screens/Wardrobe.jsx) or a package by its name (node_modules/cmdk/…).
//   studentBootDeltaKB   the first load's JavaScript, gzipped, may grow by at most this much over studentBootBaselineKB,
//                        measured the same way on a build of the commit the student lane started from
//   chunkMaxKB           no chunk loaded on demand is larger than this, gzipped. The entry chunk is DURABLE-11's to split
//                        (the teaching content per topic); until that lands here it is held by the delta above.
// Then it removes <dist>/.vite, so the two lists are never deployed.
//
// Usage: node scripts/check-budget.mjs [dist] [--keep]      (default dist)
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;
const kb = (bytes) => Math.round((bytes / KB) * 10) / 10;

/** The manifest keys the first load fetches: every entry and, recursively, its static imports. */
export function staticGraph(manifest) {
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    for (const k of manifest[key].imports || []) visit(k);
  };
  for (const [key, c] of Object.entries(manifest)) if (c.isEntry) visit(key);
  return seen;
}

/** Gzipped size of a built file, in bytes (zlib's default level, the same for the baseline and today). */
export const gzipSize = (path) => gzipSync(readFileSync(path)).length;

/** First-load JavaScript and every JavaScript chunk, gzipped, from a build folder with .vite/manifest.json. */
export function measure(dist) {
  const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));
  const boot = staticGraph(manifest);
  const files = new Map(); // file → { gzip, boot }
  for (const [key, c] of Object.entries(manifest)) {
    if (!c.file?.endsWith('.js') || files.has(c.file)) continue;
    files.set(c.file, { gzip: gzipSize(join(dist, c.file)), boot: boot.has(key), entry: !!c.isEntry });
  }
  const bootBytes = [...files.values()].filter((f) => f.boot).reduce((s, f) => s + f.gzip, 0);
  return { bootJsGzipKB: kb(bootBytes), chunks: [...files].map(([file, f]) => ({ file, gzipKB: kb(f.gzip), boot: f.boot, entry: f.entry })) };
}

/** Does a module path (src/screens/Wardrobe.jsx, node_modules/cmdk/dist/index.mjs) match a lazyOnly name? */
export function matches(module, name) {
  if (module.includes(`node_modules/${name}/`)) return true;
  if (module.includes('node_modules/')) return false;
  const base = module.split('/').pop().replace(/\.[^.]+$/, '');
  return base === name;
}

/** lazyOnly modules found in the first load: [{ name, module, chunk }]. */
export function lazyLeaks(modulesMap, bootFiles, names) {
  const out = [];
  for (const [chunk, c] of Object.entries(modulesMap)) {
    if (!bootFiles.has(chunk)) continue;
    for (const module of c.modules) for (const name of names) if (matches(module, name)) out.push({ name, module, chunk });
  }
  return out;
}

/** Every rule of `budget` against the build in `dist`: { problems, report }. */
export function check(dist, budget) {
  const problems = [];
  const m = measure(dist);
  const bootFiles = new Set(m.chunks.filter((c) => c.boot).map((c) => c.file));
  const mapPath = join(dist, '.vite', 'modules.json');
  if (!existsSync(mapPath)) problems.push('.vite/modules.json is missing (vite.config.js must use scripts/vite-plugin-budget.mjs)');
  else {
    for (const l of lazyLeaks(JSON.parse(readFileSync(mapPath, 'utf8')), bootFiles, budget.lazyOnly || [])) {
      problems.push(`${l.name} must load on demand, but ${l.module} is in the first load (${l.chunk})`);
    }
  }
  const base = budget.studentBootBaselineKB;
  const delta = Math.round((m.bootJsGzipKB - base) * 10) / 10;
  if (typeof base === 'number' && typeof budget.studentBootDeltaKB === 'number' && delta > budget.studentBootDeltaKB) {
    problems.push(`first-load JavaScript is ${m.bootJsGzipKB} KB gzipped: ${delta} KB over ${budget.studentBootBaselineCommit || 'the baseline'} (${base} KB), more than the ${budget.studentBootDeltaKB} KB allowed. Move the new code behind lazy().`);
  }
  for (const c of m.chunks) {
    if (!c.entry && typeof budget.chunkMaxKB === 'number' && c.gzipKB > budget.chunkMaxKB) problems.push(`${c.file} is ${c.gzipKB} KB gzipped, over ${budget.chunkMaxKB} KB`);
  }
  const vs = delta >= 0 ? `${delta} KB more than` : `${Math.round(-delta * 10) / 10} KB less than`;
  const largest = Math.max(0, ...m.chunks.filter((c) => !c.boot).map((c) => c.gzipKB));
  const report = `first load ${m.bootJsGzipKB} KB JS gzipped, ${vs} ${budget.studentBootBaselineCommit || 'the baseline'} (at most ${budget.studentBootDeltaKB} KB more allowed); ${m.chunks.length} chunks, the largest loaded on demand ${largest} KB`;
  return { problems, report, measured: m };
}

// node scripts/check-budget.mjs [dist] [--keep]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dist = resolve(args.find((a) => !a.startsWith('--')) || join(WEB, 'dist'));
  if (!existsSync(join(dist, '.vite', 'manifest.json'))) {
    console.error(`check-budget: ${dist}/.vite/manifest.json is missing (build with vite build --manifest)`);
    process.exit(1);
  }
  const budget = JSON.parse(readFileSync(join(WEB, 'budget.json'), 'utf8'));
  const { problems, report } = check(dist, budget);
  if (!args.includes('--keep')) rmSync(join(dist, '.vite'), { recursive: true, force: true });
  if (problems.length) {
    for (const p of problems) console.error(`check-budget: ${p}`);
    process.exit(1);
  }
  console.log(`check-budget: ${report}`);
}
