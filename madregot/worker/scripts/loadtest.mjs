#!/usr/bin/env node
// A load test for the Ministry catalogue's technical check ("בדיקת עומסים", spec TEACHER-12 §2): N classes of 30
// students posting their practice, and their teachers loading the board, for a few minutes, against a STAGING Worker
// whose address is given on the command line. Node only (fetch and a small concurrency pool), no dependency. It prints
// p50, p95 and the error rate per kind of request and overall.
//
//   node scripts/loadtest.mjs <staging URL> [--classes 5] [--students 30] [--minutes 5] [--every 20] [--board 30]
//                                           [--concurrency 20] [--keep] [--dry-run]
//
//   --classes      classes to open on staging (at most 10: the Worker opens 10 classes and 300 joins per network a day)
//   --students     students per class (at most 30)
//   --every        seconds between one student's progress posts (5 answers each)
//   --board        seconds between one teacher's dashboard loads (the board itself reloads every 120)
//   --concurrency  requests in flight at most
//   --keep         keep the test classes afterwards (by default each is deleted with its teacher key at the end)
//   --dry-run      print the plan and stop: nothing is sent anywhere
//
// Never against production, three ways: the address must be given; the script refuses the production Worker by name
// (its own <name>.<account>.workers.dev address, the name read from wrangler.toml) and the production host
// (MADREGOT_PRODUCTION_URL, else PUBLIC_URL in wrangler.toml); and before a real run it asks GET /api/health, and goes
// on only when the Worker answers staging: true, which only the staging Worker of wrangler.toml [env.staging] says
// (STAGING = "true"; `npm run staging:deploy` deploys it). A Worker on this computer (wrangler dev on localhost) needs
// no marker. The classes it opens are school classes named "בדיקת עומס", with invented students; the owner copies the
// printed numbers into docs/schools/GEFEN_READINESS.md.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = { classes: 5, students: 30, minutes: 5, every: 20, board: 30, concurrency: 20 };
const LIMITS = { classes: [1, 10], students: [1, 30], minutes: [0.01, 30], every: [1, 600], board: [5, 600], concurrency: [1, 200] };
export const USAGE = 'usage: node scripts/loadtest.mjs <staging URL> [--classes N] [--students N] [--minutes N] [--every S] [--board S] [--concurrency N] [--keep] [--dry-run]';

export class UsageError extends Error {}
const fail = (m) => { throw new UsageError(m); };

const readToml = (toml) => toml ?? (() => { try { return readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8'); } catch { return ''; } })();
/** The production host this script must never load: MADREGOT_PRODUCTION_URL, else wrangler.toml's PUBLIC_URL. */
export function productionHost(env = process.env, toml = null) {
  const text = readToml(toml);
  const url = env.MADREGOT_PRODUCTION_URL || (text.match(/^PUBLIC_URL\s*=\s*"(.*)"/m) || [])[1] || '';
  try { return url ? new URL(url).host : ''; } catch { return ''; }
}
/** The production Worker's name: the top-level `name` of wrangler.toml (its workers.dev address starts with it). */
export function workerName(toml = null) {
  return ((readToml(toml).match(/^name\s*=\s*"([^"]+)"/m) || [])[1] || 'madregot-api').toLowerCase();
}
/** The staging Worker's name: `name` under [env.staging] (wrangler's default is <name>-staging). */
export function stagingName(toml = null) {
  const text = readToml(toml);
  const section = (text.split(/^\[env\.staging\]\s*$/m)[1] || '').split(/^\[/m)[0];
  return ((section.match(/^name\s*=\s*"([^"]+)"/m) || [])[1] || `${workerName(text)}-staging`).toLowerCase();
}
/** An address on this computer (wrangler dev): it needs no staging marker. */
export const isLocal = (u) => ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);

/** The command line → { url, opts }. */
export function parse(argv, env = process.env, toml = null) {
  const opts = { ...DEFAULTS, keep: false, dryRun: false };
  let url = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--keep') opts.keep = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) {
      const name = a.slice(2);
      if (!(name in LIMITS)) fail(`unknown option ${a}. ${USAGE}`);
      const n = Number(argv[++i]);
      const [lo, hi] = LIMITS[name];
      if (!Number.isFinite(n) || n < lo || n > hi || (name !== 'minutes' && !Number.isInteger(n))) fail(`--${name} must be from ${lo} to ${hi}`);
      opts[name] = n;
    } else if (!url) url = a;
    else fail(`unexpected argument ${a}. ${USAGE}`);
  }
  if (!url) fail(`the staging address is required. ${USAGE}`);
  let u;
  try { u = new URL(url); } catch { fail(`not an address: ${url}`); }
  if (!/^https?:$/.test(u.protocol)) fail(`not an http(s) address: ${url}`);
  const prod = productionHost(env, toml);
  if (prod && u.host === prod) fail(`refused: ${u.host} is the production address. The load test runs on staging only.`);
  const name = workerName(toml);
  if (/\.workers\.dev$/i.test(u.hostname) && u.hostname.toLowerCase().split('.')[0] === name) {
    fail(`refused: ${u.host} is the production Worker (${name}). The load test runs on staging only: ${stagingName(toml)}.<account>.workers.dev (npm run staging:deploy).`);
  }
  return { url: u.origin + u.pathname.replace(/\/+$/, ''), opts };
}

/** What the run will send, as numbers. */
export function plan({ classes, students, minutes, every, board }) {
  const secs = minutes * 60;
  return {
    setup: { classes, joins: classes * students },
    progress: Math.round(classes * students * (secs / every)),
    dashboard: Math.round(classes * (secs / board)),
  };
}

export function planText(url, opts) {
  const p = plan(opts);
  return [
    `Load test plan${opts.dryRun ? ' (dry run: nothing is sent)' : ''}`,
    `  target: ${url}`,
    `  setup: ${opts.classes} classes × ${opts.students} students: ${p.setup.classes} POST /api/classes, ${p.setup.joins} POST /api/classes/:code/join`,
    `  run: ${opts.minutes} minutes, at most ${opts.concurrency} requests at a time`,
    `    each student: POST /api/progress every ${opts.every} s (5 answers): about ${p.progress} requests`,
    `    each teacher: GET /api/teacher/dashboard every ${opts.board} s: about ${p.dashboard} requests`,
    `  cleanup: ${opts.keep ? 'none (--keep): the test classes stay' : `${opts.classes} POST /api/teacher/class/delete`}`,
    '  prints: p50, p95 and the error rate, per kind of request and overall',
    `  first: GET /api/health must answer staging: true${isLocal(new URL(url)) ? ' (not asked: a Worker on this computer)' : ''}`,
  ].join('\n');
}

/** The nearest-rank percentile of sorted numbers. */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}
/** [{kind, ms, ok}] → per kind and overall: { n, p50, p95, errorRate }. */
export function summarize(samples) {
  const group = (xs) => {
    const ms = xs.map((x) => x.ms).sort((a, b) => a - b);
    return { n: xs.length, p50: percentile(ms, 50), p95: percentile(ms, 95), errorRate: xs.length ? xs.filter((x) => !x.ok).length / xs.length : 0 };
  };
  const kinds = [...new Set(samples.map((x) => x.kind))];
  return { ...Object.fromEntries(kinds.map((k) => [k, group(samples.filter((x) => x.kind === k))])), all: group(samples) };
}
export function summaryText(sum) {
  const row = (k, s) => `${k.padEnd(10)} n=${String(s.n).padEnd(6)} p50=${s.p50 ?? '–'} ms  p95=${s.p95 ?? '–'} ms  errors=${(s.errorRate * 100).toFixed(2)}%`;
  return Object.entries(sum).map(([k, s]) => row(k, s)).join('\n');
}

/** A pool: run(fn) waits for a free slot, then starts fn; idle() resolves when nothing is running. */
export function pool(size) {
  let active = 0; const waiting = []; const idle = [];
  const next = () => {
    if (active === 0 && !waiting.length) idle.splice(0).forEach((r) => r());
    while (active < size && waiting.length) { active++; waiting.shift()(); }
  };
  return {
    run: (fn) => new Promise((resolve) => {
      waiting.push(() => Promise.resolve().then(fn).finally(() => { active--; next(); resolve(); }));
      next();
    }),
    idle: () => new Promise((r) => { if (active === 0 && !waiting.length) r(); else idle.push(r); }),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const answers = (at) => Array.from({ length: 5 }, (_, i) => ({ topic: 'signed', level: 1 + (i % 3), ok: i % 4 !== 0, first: i % 3 !== 0, hint: false, secs: 20, at }));

/**
 * The whole run. io: { fetch, log, now, sleep, random } (tests pass their own). Returns the summary, or null on a dry
 * run (which never calls fetch).
 */
export async function main(argv, io = {}) {
  const { fetch: f = globalThis.fetch, log = console.log, now = () => performance.now(), wait = sleep, random = Math.random, env = process.env, toml = null } = io;
  const { url, opts } = parse(argv, env, toml);
  log(planText(url, opts));
  if (opts.dryRun) return null;

  // the target must say it is the staging Worker before anything is written to it
  if (!isLocal(new URL(url))) {
    let h = null;
    try {
      const res = await f(`${url}/api/health`, { headers: { Accept: 'application/json' } });
      h = await res.json().catch(() => null);
    } catch (e) { fail(`could not ask ${url}/api/health (${e?.message || e}). Nothing was sent.`); }
    if (h?.staging !== true) fail(`refused: ${url} is not a staging Worker (GET /api/health has no "staging": true). Deploy staging with npm run staging:deploy and use its address.`);
  }

  const samples = [];
  const call = async (kind, pathname, init = {}) => {
    const t0 = now();
    try {
      const res = await f(`${url}${pathname}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } });
      const body = await res.json().catch(() => ({}));
      samples.push({ kind, ms: Math.round(now() - t0), ok: res.ok });
      return res.ok ? body : null;
    } catch {
      samples.push({ kind, ms: Math.round(now() - t0), ok: false });
      return null;
    }
  };

  // setup: the classes and their students (not counted in the run's numbers)
  const classes = [];
  for (let c = 0; c < opts.classes; c++) {
    const cls = await call('setup', '/api/classes', { method: 'POST', body: JSON.stringify({ className: `בדיקת עומס ${c + 1}`, teacherName: 'בודק עומס', grade: '7' }) });
    if (!cls?.code) { log(`could not open class ${c + 1}: stopping`); break; }
    const students = [];
    for (let s = 0; s < opts.students; s++) {
      const j = await call('setup', `/api/classes/${cls.code}/join`, { method: 'POST', body: JSON.stringify({ name: `תלמיד ${s + 1} ב.`, pin: '2468' }) });
      if (j?.token) students.push(j.token);
    }
    classes.push({ code: cls.code, key: cls.teacherKey, students });
  }
  log(`setup: ${classes.length} classes, ${classes.reduce((a, c) => a + c.students.length, 0)} students`);

  // the run: every request at its time, at most `concurrency` in flight
  const end = opts.minutes * 60_000;
  const jobs = [];
  for (const cls of classes) {
    for (const token of cls.students) {
      for (let t = random() * opts.every * 1000; t < end; t += opts.every * 1000) jobs.push({ t, kind: 'progress', path: '/api/progress', init: { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ events: answers(new Date().toISOString()), levels: {} }) } });
    }
    for (let t = random() * opts.board * 1000; t < end; t += opts.board * 1000) jobs.push({ t, kind: 'dashboard', path: '/api/teacher/dashboard', init: { headers: { 'X-Class-Code': cls.code, 'X-Teacher-Key': cls.key } } });
  }
  jobs.sort((a, b) => a.t - b.t);
  const p = pool(opts.concurrency);
  const start = now();
  for (const j of jobs) {
    const due = j.t - (now() - start);
    if (due > 0) await wait(due);
    p.run(() => call(j.kind, j.path, j.init)); // not awaited: the pool holds it until a slot is free
  }
  await p.idle();

  // cleanup: each test class deleted with its key, unless --keep
  if (!opts.keep) for (const cls of classes) await call('cleanup', '/api/teacher/class/delete', { method: 'POST', headers: { 'X-Class-Code': cls.code, 'X-Teacher-Key': cls.key }, body: JSON.stringify({ confirm: 'DELETE' }) });
  else log(`kept: ${classes.map((c) => c.code).join(', ')}`);

  const sum = summarize(samples.filter((x) => x.kind === 'progress' || x.kind === 'dashboard'));
  log(summaryText(sum));
  return sum;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(() => { process.exitCode = 0; }, (e) => {
    console.error(e instanceof UsageError ? e.message : e);
    process.exitCode = 1;
  });
}