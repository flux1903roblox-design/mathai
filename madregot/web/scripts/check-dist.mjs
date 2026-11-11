// After `vite build`: refuse a build that carries a secret, or (unless VITE_ALLOW_PERSONAL_KEY=1) the Claude SDK that
// only the personal-key mode needs. Every text file is scanned, the service worker (sw.js) and the landing pages
// included. Also refuse a build that names an analytics, advertising or tag-manager host (TRACKERS): the pages say
// "בלי פרסומות ובלי מעקב" (STUDENT-17, web/src/content/claims.js 'no-ads'), and this is what keeps it true. And refuse
// a build whose service worker is missing or lists a file the build does not have (its install would fail, and the
// app would not open offline). Usage: node scripts/check-dist.mjs <dist folder>
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const dir = process.argv[2] || 'dist';
const personal = process.env.VITE_ALLOW_PERSONAL_KEY === '1';
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

/** Every problem with the build in `dir`: [text]. */
export function checkDist(dir, { personal = false } = {}) {
  const problems = [];
  for (const f of files(dir)) {
    const text = readFileSync(f, 'utf8');
    for (const [re, what] of [...SECRETS, ...(personal ? [] : SDK)]) if (re.test(text)) problems.push(`${relative(dir, f)}: ${what}`);
    const tracker = trackerIn(text);
    if (tracker) problems.push(`${relative(dir, f)}: an analytics or ads host (${tracker})`);
  }
  // the offline service worker (DURABLE-10): present, and every file it keeps is in the build
  const sw = join(dir, 'sw.js');
  if (!existsSync(sw)) problems.push('sw.js: missing (scripts/vite-plugin-sw.mjs builds it)');
  else {
    const list = /self\.__PRECACHE = (\[.*\]);/.exec(readFileSync(sw, 'utf8'));
    if (!list) problems.push('sw.js: no self.__PRECACHE list');
    else for (const f of JSON.parse(list[1])) if (!existsSync(join(dir, f))) problems.push(`sw.js: keeps ${f}, which the build does not have`);
  }
  return problems;
}

// node scripts/check-dist.mjs <dist>
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkDist(dir, { personal });
  if (problems.length) {
    console.error(`check-dist: the build in ${dir} must not ship:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`check-dist: ${dir} is clean${personal ? ' (personal-key mode compiled in)' : ''}.`);
}
