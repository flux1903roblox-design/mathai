// After vite build and check-dist (DURABLE-11): what a phone downloads before the first screen, held to web/budget.json.
//   boot JS          the entry script of dist/index.html and every module it modulepreloads
//   render-blocking  every <link rel="stylesheet"> of dist/index.html (KaTeX's sheet included)
//   any lazy chunk   every other script in dist/assets, one at a time (a screen that loads on demand stays small)
//   precache         the files the service worker keeps for offline use (sw.js's list, scripts/vite-plugin-sw.mjs)
// Each file is gzipped at level 9, as a server sends it; the precache is counted as stored (raw bytes).
// KB is 1000 bytes and MB 1,000,000, as in the spec's measurements.
// It prints a table (value, gate, target) and exits 1 when a value is over its gate; a missed target only warns.
// The gates are a ratchet, enforced here (COUNCIL2-20): bootJsGzipKB, cssGzipKB, anyChunkGzipKB and precacheMB may never
// be higher than in this budget.json as it was at HEAD~1 (git show HEAD~1:<the file>), nor than in the committed HEAD
// (a raise not yet committed); a gate may not be removed either. A commit may lower a gate (to the new value + 5% once
// the first load got smaller), never raise it: a bigger first load is made smaller instead. With no commit before HEAD to
// compare with (no git, or a clone of depth 1) it warns, and fails when CI is set: CI checks out two commits
// (.github/workflows/ci.yml, fetch-depth: 2).
//
// And the student lane's rule (STUDENT-15): the modules in budget.json's lazyOnly (the wardrobe, the Sunday recap, מדי's
// accessories, the reminder code, and the libraries kept off student screens) must load on demand only. None may be in
// a boot file: the entry script or anything it modulepreloads, which is every chunk it imports statically. A name
// matches a source file by its base name (Wardrobe → src/screens/Wardrobe.jsx) or a package by its name
// (node_modules/cmdk/…). Vite names only each chunk's entry module, so a module bundled into another chunk is found
// through <dist>/.vite/modules.json (scripts/vite-plugin-budget.mjs). The command removes <dist>/.vite afterwards
// (unless --keep), so that list is never deployed.
// Usage: node scripts/check-budget.mjs [dist] [--budget budget.json] [--keep]
import { readFileSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const attr = (tag, name) => (new RegExp(`\\b${name}="([^"]*)"`).exec(tag) || [])[1];
const local = (href) => decodeURIComponent(String(href).replace(/^(\.\/|\/)+/, '').split(/[?#]/)[0]);

/** The files dist/index.html makes the browser fetch before the first screen: the boot scripts and the stylesheets. */
export function bootFiles(html) {
  const js = []; const css = [];
  for (const tag of html.match(/<(script|link)\b[^>]*>/gi) || []) {
    if (/^<script/i.test(tag) && attr(tag, 'type') === 'module' && attr(tag, 'src')) js.push(local(attr(tag, 'src')));
    else if (/^<link/i.test(tag) && attr(tag, 'rel') === 'modulepreload' && attr(tag, 'href')) js.push(local(attr(tag, 'href')));
    else if (/^<link/i.test(tag) && attr(tag, 'rel') === 'stylesheet' && attr(tag, 'href')) css.push(local(attr(tag, 'href')));
  }
  return { js: [...new Set(js)], css: [...new Set(css)] };
}

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

/** Every number the budget looks at, in bytes. */
export function measure(dir) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const boot = bootFiles(html);
  const js = boot.js.map((f) => ({ file: f, gz: gz(join(dir, f)) }));
  const css = boot.css.map((f) => ({ file: f, gz: gz(join(dir, f)) }));
  const assets = existsSync(join(dir, 'assets')) ? readdirSync(join(dir, 'assets')).filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`) : [];
  const lazy = assets.filter((f) => !boot.js.includes(f)).map((f) => ({ file: f, gz: gz(join(dir, f)) })).sort((a, b) => b.gz - a.gz);
  let precache = null;
  const sw = join(dir, 'sw.js');
  if (existsSync(sw)) {
    const m = /^self\.__PRECACHE = (\[.*\]);/m.exec(readFileSync(sw, 'utf8'));
    if (m) precache = JSON.parse(m[1]).reduce((n, f) => n + (existsSync(join(dir, f)) ? statSync(join(dir, f)).size : 0), 0);
  }
  return {
    js, css, lazy,
    bootJs: js.reduce((n, f) => n + f.gz, 0),
    bootCss: css.reduce((n, f) => n + f.gz, 0),
    biggestLazy: lazy[0] || null,
    precache,
  };
}

/** Does a module path (src/screens/Wardrobe.jsx, node_modules/cmdk/dist/index.mjs) match a lazyOnly name? */
export function matches(module, name) {
  if (module.includes(`node_modules/${name}/`)) return true;
  if (module.includes('node_modules/')) return false;
  const base = module.split('/').pop().replace(/\.[^.]+$/, '');
  return base === name;
}

/** lazyOnly modules found in a boot file: [{ name, module, chunk }]. `modulesMap` is .vite/modules.json. */
export function lazyLeaks(modulesMap, bootFiles, names) {
  const out = [];
  for (const [chunk, c] of Object.entries(modulesMap)) {
    if (!bootFiles.has(chunk)) continue;
    for (const module of c.modules) for (const name of names) if (matches(module, name)) out.push({ name, module, chunk });
  }
  return out;
}

/** The lazyOnly rule (STUDENT-15) on a build: one line per problem, [] when every listed module loads on demand. */
export function lazyProblems(dir, m, names = []) {
  if (!names.length) return [];
  const mapPath = join(dir, '.vite', 'modules.json');
  if (!existsSync(mapPath)) return ['.vite/modules.json is missing (vite.config.js must use scripts/vite-plugin-budget.mjs)'];
  const boot = new Set(m.js.map((f) => f.file));
  return lazyLeaks(JSON.parse(readFileSync(mapPath, 'utf8')), boot, names)
    .map((l) => `${l.name} must load on demand, but ${l.module} is in the first load (${l.chunk})`);
}

/** The checks: { name, value, gate, target, unit, over, missed } for each, from the measures and the budget. */
export function judge(m, budget) {
  const rows = [
    { name: 'boot JS (gzip)', value: m.bootJs / 1000, gate: budget.bootJsGzipKB, target: budget.bootJsTargetKB, unit: 'KB' },
    { name: 'render-blocking CSS (gzip)', value: m.bootCss / 1000, gate: budget.cssGzipKB, target: budget.cssTargetKB, unit: 'KB' },
    { name: `largest lazy chunk (gzip)${m.biggestLazy ? `: ${m.biggestLazy.file}` : ''}`, value: (m.biggestLazy?.gz || 0) / 1000, gate: budget.anyChunkGzipKB, target: null, unit: 'KB' },
  ];
  if (m.precache != null) rows.push({ name: 'service worker precache', value: m.precache / 1e6, gate: budget.precacheMB, target: null, unit: 'MB' });
  return rows.map((r) => ({ ...r, over: r.gate != null && r.value > r.gate, missed: r.target != null && r.value > r.target }));
}

const fmt = (v, unit) => (v == null ? '-' : `${unit === 'MB' ? v.toFixed(2) : v.toFixed(1)} ${unit}`);

export function report(m, rows) {
  const lines = [];
  const w = Math.max(...rows.map((r) => r.name.length), 28);
  lines.push(`${'budget'.padEnd(w)}  ${'value'.padStart(10)}  ${'gate'.padStart(10)}  ${'target'.padStart(10)}`);
  for (const r of rows) {
    const mark = r.over ? '  OVER THE GATE' : r.missed ? '  (target missed)' : '';
    lines.push(`${r.name.padEnd(w)}  ${fmt(r.value, r.unit).padStart(10)}  ${fmt(r.gate, r.unit).padStart(10)}  ${fmt(r.target, r.unit).padStart(10)}${mark}`);
  }
  lines.push('', 'boot files:', ...[...m.js, ...m.css].map((f) => `  ${f.file}  ${(f.gz / 1000).toFixed(1)} KB`));
  return lines.join('\n');
}

/** Run the check: { ok, text, rows, measures, problems } (problems: the lazyOnly rule's). */
export function check(dir, budget) {
  const m = measure(dir);
  const rows = judge(m, budget);
  const over = rows.filter((r) => r.over);
  const missed = rows.filter((r) => !r.over && r.missed);
  const problems = lazyProblems(dir, m, budget.lazyOnly || []);
  const text = [
    report(m, rows), '',
    ...over.map((r) => `FAIL ${r.name}: ${fmt(r.value, r.unit)} is over the gate of ${fmt(r.gate, r.unit)}`),
    ...problems.map((p) => `FAIL ${p}`),
    ...missed.map((r) => `warning ${r.name}: ${fmt(r.value, r.unit)} misses the target of ${fmt(r.target, r.unit)}`),
    over.length || problems.length ? '' : `budget: every gate passes${budget.lazyOnly?.length ? `, and the ${budget.lazyOnly.length} lazy-only modules load on demand` : ''}`,
  ].join('\n');
  return { ok: !over.length && !problems.length, text, rows, measures: m, problems };
}

// ---------------------------------------------------------------- the ratchet (COUNCIL2-20)
/** The gates that may only go down. */
export const RATCHET = ['bootJsGzipKB', 'cssGzipKB', 'anyChunkGzipKB', 'precacheMB'];

/**
 * The ratchet against one earlier budget: one line per gate that is higher than it was at `ref`, or was there and is
 * gone. [] when every gate is the same or lower.
 */
export function ratchet(budget, before, ref = 'HEAD~1') {
  const out = [];
  for (const k of RATCHET) {
    const was = before?.[k];
    if (typeof was !== 'number') continue; // a new gate has nothing to be compared with
    const now = budget?.[k];
    if (typeof now !== 'number') out.push(`${k} was ${was} at ${ref} and is gone: a gate may be lowered, never removed`);
    else if (now > was + 1e-9) out.push(`${k} is ${now}, higher than ${was} at ${ref}: a gate only goes down (make the first load smaller instead)`);
  }
  return out;
}

/**
 * budget.json as it was at a commit, read with git from the file's own folder: { budget } | { noCommit } (the commit
 * is not there: no git, not a repository, or a shallow clone) | { noFile } (the commit is there, the file was not yet).
 */
export function budgetAt(budgetFile, ref) {
  const cwd = dirname(resolve(budgetFile));
  const git = (...a) => spawnSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  if (commit.error || commit.status !== 0) return { noCommit: true };
  const show = git('show', `${ref}:./${basename(budgetFile)}`);
  if (show.status !== 0) return { noFile: true };
  try { return { budget: JSON.parse(show.stdout) }; } catch { return { noFile: true }; }
}

const ciOn = (env) => !!env.CI && !/^(0|false)$/i.test(String(env.CI).trim());

/**
 * The ratchet on a budget file: { ok, lines }. Compared with the file at HEAD~1 and at HEAD. With no HEAD~1, a warning,
 * or a failure when CI is set.
 */
export function ratchetCheck(budgetFile, budget, env = process.env) {
  const lines = []; let ok = true;
  const before = budgetAt(budgetFile, 'HEAD~1');
  if (before.noCommit) {
    if (ciOn(env)) { ok = false; lines.push('FAIL ratchet: no commit before HEAD to compare the gates with (CI must check out two commits: fetch-depth: 2)'); }
    else lines.push('warning ratchet: no commit before HEAD to compare the gates with (no git history here), so a raised gate was not checked');
  } else if (before.budget) {
    for (const p of ratchet(budget, before.budget, 'HEAD~1')) { ok = false; lines.push(`FAIL ratchet: ${p}`); }
  }
  const head = budgetAt(budgetFile, 'HEAD');
  if (head.budget) for (const p of ratchet(budget, head.budget, 'HEAD')) { ok = false; lines.push(`FAIL ratchet: ${p}`); }
  if (ok && !lines.length) lines.push(`ratchet: no gate is higher than at HEAD~1${head.budget ? ' or HEAD' : ''}`);
  return { ok, lines: [...new Set(lines)] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--budget');
  const budgetFile = at >= 0 ? args[at + 1] : join(dirname(fileURLToPath(import.meta.url)), '../budget.json');
  const dir = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1)) || 'dist';
  const budget = JSON.parse(readFileSync(budgetFile, 'utf8'));
  const { ok, text } = check(dir, budget);
  const r = ratchetCheck(budgetFile, budget);
  if (!args.includes('--keep')) rmSync(join(dir, '.vite'), { recursive: true, force: true });
  console.log(`${text}\n${r.lines.join('\n')}`);
  if (!ok || !r.ok) process.exit(1);
}
