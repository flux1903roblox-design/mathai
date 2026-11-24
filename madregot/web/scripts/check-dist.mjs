// After `vite build`: refuse a build that carries a secret, or (unless VITE_ALLOW_PERSONAL_KEY=1) the Claude SDK that
// only the personal-key mode needs, or whose _headers lost a security header (scripts/headers.mjs: CSP with
// frame-ancestors 'none', nosniff, Referrer-Policy, Permissions-Policy). Every text file is scanned, the service worker
// (sw.js) and the landing pages included. Also refuse a build that names an analytics, advertising or tag-manager host
// (TRACKERS): the pages say "בלי פרסומות ובלי מעקב" (STUDENT-17, web/src/content/claims.js 'no-ads'), and this is what
// keeps it true. And refuse a build whose service worker is missing or unsound (DURABLE-10): its precache list must
// come first, hold index.html, name only files the build has (its install would fail, and the app would not open
// offline), and hold no source map, no .ttf or .woff and nothing under api/. And refuse a build made without
// VITE_ARABIC=on (the default) that holds an Arabic file, keeps one for offline use, or whose page says it has Arabic:
// only the shell is in Arabic (no topic since the round-3 merge), so no default build may be able to fetch it
// (lib/i18n.js, docs/ARABIC.md). And refuse a build made without VITE_QA_HOOKS=flag that holds the test hooks' device
// switch ('madregot-debug', lib/qa.js): with it, a student who sets the flag reads the answer of every exercise on
// screen, in a mastery check or a class exam too (window.__madregotItem, <html data-qa-item>).
// Usage: node scripts/check-dist.mjs <dist folder>
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { headerProblems } from './headers.mjs';

/** Hosts of analytics, advertising, tag managers and session recorders: none may appear in any built file. */
export const TRACKERS = [
  'google-analytics.com', 'googletagmanager.com', 'googleadservices.com', 'googlesyndication.com', 'doubleclick.net',
  'analytics.google.com', 'stats.g.doubleclick.net', 'facebook.net', 'connect.facebook.net', 'facebook.com/tr',
  'hotjar.com', 'hotjar.io', 'segment.io', 'segment.com/analytics', 'cdn.segment.com', 'mixpanel.com', 'amplitude.com',
  'clarity.ms', 'fullstory.com', 'heap.io', 'heapanalytics.com', 'posthog.com', 'plausible.io', 'tiktok.com/i18n/pixel',
  'analytics.tiktok.com', 'snap.licdn.com', 'static.ads-twitter.com', 'bat.bing.com', 'sentry.io', 'logrocket.com',
];
const TRACKER_RE = new RegExp(`(^|[^a-z0-9-])(${TRACKERS.map((h) => h.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})`, 'i');
/** The tracker host a text names, or null. */
export const trackerIn = (text) => TRACKER_RE.exec(String(text))?.[2] || null;

const SECRETS = [
  [/sk-ant-/, 'an Anthropic API key (sk-ant-)'],
  [/(?<![A-Za-z0-9_])re_[A-Za-z0-9]{16,}/, 'a Resend API key (re_…)'],
  [/whsec_[A-Za-z0-9+/]{16,}/, 'a webhook signing secret (whsec_…)'],
  [/pdl_(live|sdbx)_/, 'a Paddle API key (pdl_…)'],
];
const SDK = [
  [/dangerouslyAllowBrowser/, 'the Claude SDK for the browser (personal-key mode)'],
  [/api\.anthropic\.com/, 'the Claude API address (personal-key mode)'],
];
const TEXT = /\.(js|mjs|cjs|css|html|json|map|txt|svg|webmanifest)$|^_headers$|^_redirects$/;

function* files(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (TEXT.test(name)) yield p;
  }
}

/** An Arabic file of the build: a catalogue or content chunk (<name>.ar-<hash>.js), or Rubik's Arabic part. */
export const ARABIC_FILE = /\.ar-[\w-]+\.js$|rubik-arabic/;

function* allFiles(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* allFiles(p);
    else yield p;
  }
}

/**
 * What a build made without VITE_ARABIC=on must not have: an Arabic chunk, an Arabic file kept for offline use, the
 * Arabic catalogue's words in any script, or a page that says the build has Arabic. Rubik's Arabic part is in every
 * build (the font package brings it, and a browser fetches it only for Arabic letters): it must only stay out of the
 * files kept for offline use.
 */
export function arabicProblems(dir, { arabic = false } = {}) {
  const problems = [];
  const index = join(dir, 'index.html');
  const meta = existsSync(index) ? /<meta name="madregot-arabic" content="([^"]*)"/.exec(readFileSync(index, 'utf8'))?.[1] : undefined;
  if (meta !== undefined && meta !== (arabic ? 'on' : 'off')) problems.push(`index.html: says Arabic is "${meta}" in a build made with VITE_ARABIC ${arabic ? 'on' : 'off'}`);
  if (arabic) return problems;
  for (const f of allFiles(dir)) {
    const rel = relative(dir, f);
    if (/\.ar-[\w-]+\.js$/.test(rel)) problems.push(`${rel}: an Arabic file in a build made without VITE_ARABIC=on`);
    // the first words of the Arabic catalogue (locales/shell.ar.json): in no script of a build without Arabic
    else if (/\.js$/.test(rel) && readFileSync(f, 'utf8').includes('رياضيات نفهمها')) problems.push(`${rel}: holds the Arabic catalogue in a build made without VITE_ARABIC=on`);
  }
  const sw = join(dir, 'sw.js');
  if (existsSync(sw)) {
    let list = [];
    try { list = JSON.parse(/^self\.__PRECACHE = (\[.*\]);\n/.exec(readFileSync(sw, 'utf8'))?.[1] || '[]'); } catch { list = []; }
    for (const f of list) if (ARABIC_FILE.test(f)) problems.push(`sw.js: keeps the Arabic file ${f} in a build made without VITE_ARABIC=on`);
  }
  return problems;
}

/**
 * The test hooks hand out the exercise on screen with its answer (lib/qa.js). A build that ships folds their gate to
 * "off" and holds no way to turn them on from the device: no script or page may name the switch 'madregot-debug'. Only a
 * test build (VITE_QA_HOOKS=flag: the e2e builds, store/capture.cjs) keeps it; the staging copy (VITE_QA_HOOKS=1) has
 * the hooks on without it.
 */
export function qaHookProblems(dir, { qa = '' } = {}) {
  if (qa === 'flag') return [];
  const problems = [];
  for (const f of allFiles(dir)) {
    if (!/\.(js|mjs|html)$/.test(f)) continue;
    if (readFileSync(f, 'utf8').includes('madregot-debug')) problems.push(`${relative(dir, f)}: the test hooks' switch (madregot-debug), which would let a student read the answers, in a build made without VITE_QA_HOOKS=flag`);
  }
  return problems;
}

/**
 * What a build in `dir` must not ship: [] when it is clean. `arabic`: the build was made with VITE_ARABIC=on. `qa`: the
 * build's VITE_QA_HOOKS ('flag' only for a test build).
 */
export function distProblems(dir, { personal = false, arabic = false, qa = '' } = {}) {
  const problems = [...arabicProblems(dir, { arabic }), ...qaHookProblems(dir, { qa })];
  for (const f of files(dir)) {
    const text = readFileSync(f, 'utf8');
    for (const [re, what] of [...SECRETS, ...(personal ? [] : SDK)]) if (re.test(text)) problems.push(`${relative(dir, f)}: ${what}`);
    const tracker = trackerIn(text);
    if (tracker) problems.push(`${relative(dir, f)}: an analytics or ads host (${tracker})`);
  }
  // the security headers: vite copies public/_headers into every build
  const headersFile = join(dir, '_headers');
  if (!existsSync(headersFile)) problems.push('_headers: missing (the security headers)');
  else for (const p of headerProblems(readFileSync(headersFile, 'utf8'))) problems.push(`_headers: ${p}`);
  // the offline service worker (DURABLE-10): present, its list at its top with index.html in it, no source map, .ttf,
  // .woff or api/ file in it, and every file it keeps is in the build
  const sw = join(dir, 'sw.js');
  if (!existsSync(sw)) problems.push('sw.js: missing (scripts/vite-plugin-sw.mjs builds it)');
  else {
    const m = /^self\.__PRECACHE = (\[.*\]);\n/.exec(readFileSync(sw, 'utf8'));
    let list = null;
    try { list = m && JSON.parse(m[1]); } catch { list = null; }
    if (!Array.isArray(list) || !list.length) problems.push('sw.js: no self.__PRECACHE list at its top');
    else {
      if (!list.includes('index.html')) problems.push('sw.js: index.html is not precached');
      for (const f of list) {
        if (/\.(map|ttf|woff)$/i.test(f) || /(^|\/)api\//.test(f)) problems.push(`sw.js: must not precache ${f}`);
        else if (!existsSync(join(dir, f))) problems.push(`sw.js: keeps ${f}, which the build does not have`);
      }
    }
  }
  return problems;
}
/** The student lane's name for the same check (scripts/check-dist.test.mjs). */
export const checkDist = distProblems;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = process.argv[2] || 'dist';
  const personal = process.env.VITE_ALLOW_PERSONAL_KEY === '1';
  // the same environment the build ran in (npm run build): with VITE_ARABIC=on the build has Arabic, and may
  const arabic = process.env.VITE_ARABIC === 'on';
  // and with VITE_QA_HOOKS=flag it is a test build, whose hooks wait for the device's flag (lib/qa.js)
  const qa = process.env.VITE_QA_HOOKS || '';
  const problems = distProblems(dir, { personal, arabic, qa });
  if (problems.length) {
    console.error(`check-dist: the build in ${dir} must not ship:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`check-dist: ${dir} is clean${personal ? ' (personal-key mode compiled in)' : ''}${arabic ? ' (Arabic compiled in: VITE_ARABIC=on)' : ', with no Arabic in it'}${qa === 'flag' ? ' (a test build: VITE_QA_HOOKS=flag)' : ''}.`);
}
