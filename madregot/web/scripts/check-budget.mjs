// After vite build and check-dist (DURABLE-11): what a phone downloads before the first screen, held to web/budget.json.
//   boot JS          the entry script of dist/index.html and every module it modulepreloads
//   render-blocking  every <link rel="stylesheet"> of dist/index.html (KaTeX's sheet included)
//   any lazy chunk   every other script in dist/assets, one at a time (a screen that loads on demand stays small)
//   precache         the files the service worker keeps for offline use (sw.js's list, scripts/vite-plugin-sw.mjs)
// Each file is gzipped at level 9, as a server sends it; the precache is counted as stored (raw bytes).
// KB is 1000 bytes and MB 1,000,000, as in the spec's measurements.
// It prints a table (value, gate, target) and exits 1 when a value is over its gate; a missed target only warns.
// The boot JS gate is a ratchet: each commit that makes boot smaller lowers it to the new value + 5%, never raises it.
// Usage: node scripts/check-budget.mjs [dist] [--budget budget.json]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

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

/** Run the check: { ok, text }. */
export function check(dir, budget) {
  const m = measure(dir);
  const rows = judge(m, budget);
  const over = rows.filter((r) => r.over);
  const missed = rows.filter((r) => !r.over && r.missed);
  const text = [
    report(m, rows), '',
    ...over.map((r) => `FAIL ${r.name}: ${fmt(r.value, r.unit)} is over the gate of ${fmt(r.gate, r.unit)}`),
    ...missed.map((r) => `warning ${r.name}: ${fmt(r.value, r.unit)} misses the target of ${fmt(r.target, r.unit)}`),
    over.length ? '' : 'budget: every gate passes',
  ].join('\n');
  return { ok: !over.length, text, rows, measures: m };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--budget');
  const budgetFile = at >= 0 ? args[at + 1] : join(dirname(fileURLToPath(import.meta.url)), '../budget.json');
  const dir = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1)) || 'dist';
  const { ok, text } = check(dir, JSON.parse(readFileSync(budgetFile, 'utf8')));
  console.log(text);
  if (!ok) process.exit(1);
}
