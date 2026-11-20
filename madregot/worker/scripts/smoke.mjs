// After a production deploy (GitHub Actions > Deploy, the last step): the live server answers.
//   GET /api/health   200 with ok: true, and not the staging Worker (staging: true)
//   GET /             200, the app's page (HTML with its #root)
//   GET /waitlist     reported only: 200 once the waitlist page is in the app, 404 before; anything else (5xx, no answer) fails
// A failed check is tried again (6 tries, 10 seconds apart): a new version can take a few seconds to reach every location.
//
//   node scripts/smoke.mjs --production      the address in production.json (PUBLIC_URL)
//   node scripts/smoke.mjs https://…         any address
//
// Reads only; sends no credential. Exit 1 when a check fails.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WORKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleepFor = (ms) => new Promise((r) => setTimeout(r, ms));

/** The checks, in order: { path, judge(status, contentType, body) → '' when right, else what is wrong }. */
export const CHECKS = [
  {
    path: '/api/health',
    judge: (status, type, body) => {
      if (status !== 200) return `answered ${status}`;
      let j;
      try { j = JSON.parse(body); } catch { return 'did not answer JSON'; }
      if (j?.ok !== true) return 'did not say ok: true';
      if (j?.staging === true) return 'is the staging Worker';
      return '';
    },
  },
  {
    path: '/',
    judge: (status, type, body) => {
      if (status !== 200) return `answered ${status}`;
      if (!/text\/html/i.test(type)) return `answered ${type || 'no content type'}, not HTML`;
      if (!/id="root"/.test(body)) return 'is not the app\'s page (no #root)';
      return '';
    },
  },
  {
    path: '/waitlist',
    judge: (status) => (status === 200 || status === 404 ? '' : `answered ${status}`),
  },
];

/**
 * Run the checks against `base`. → { ok, lines }. `fetch`, `sleep`, `tries` and `wait` are for tests.
 */
export async function smoke(base, { fetch = globalThis.fetch, sleep = sleepFor, tries = 6, wait = 10_000 } = {}) {
  const root = String(base || '').replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+$/.test(root)) return { ok: false, lines: [`✗ not an https address with no path: "${base}"`] };
  const lines = [];
  let ok = true;
  for (const check of CHECKS) {
    let why = '';
    let status = 0;
    for (let i = 1; i <= tries; i++) {
      try {
        const res = await fetch(`${root}${check.path}`, { headers: { 'user-agent': 'madregot-smoke' }, signal: AbortSignal.timeout(15_000) });
        status = res.status;
        why = check.judge(res.status, res.headers.get('content-type') || '', await res.text());
      } catch (e) {
        status = 0;
        why = `no answer (${e?.name === 'TimeoutError' ? 'timed out' : e?.message || e})`;
      }
      if (!why) break;
      if (i < tries) await sleep(wait);
    }
    if (why) ok = false;
    const note = check.path === '/waitlist' && status === 404 ? ' (no waitlist page in this build yet)' : '';
    lines.push(`${why ? '✗' : '✓'} GET ${check.path}: ${why || `${status}${note}`}`);
  }
  return { ok, lines };
}

async function main(argv) {
  let base = argv.find((a) => !a.startsWith('--'));
  if (argv.includes('--production')) {
    try { base = JSON.parse(readFileSync(path.join(WORKER, 'production.json'), 'utf8')).vars?.PUBLIC_URL; } catch (e) {
      console.error(`smoke: could not read PUBLIC_URL from production.json: ${e.message}`);
      return 1;
    }
  }
  if (!base) { console.error('usage: node scripts/smoke.mjs --production | https://…'); return 1; }
  const r = await smoke(base);
  console.log(`smoke: ${base}\n${r.lines.join('\n')}`);
  return r.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
