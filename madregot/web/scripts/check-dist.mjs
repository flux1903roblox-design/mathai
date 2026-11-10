// After `vite build`: refuse a build that carries a secret, or (unless VITE_ALLOW_PERSONAL_KEY=1) the Claude SDK that
// only the personal-key mode needs. Every text file is scanned, the service worker (sw.js) too, and sw.js must be
// sound (DURABLE-10): its precache list comes first, names only files the build has, and holds no source map, no
// .ttf or .woff and nothing under api/. Usage: node scripts/check-dist.mjs <dist folder>
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

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

const problems = [];
for (const f of files(dir)) {
  const text = readFileSync(f, 'utf8');
  for (const [re, what] of [...SECRETS, ...(personal ? [] : SDK)]) if (re.test(text)) problems.push(`${relative(dir, f)}: ${what}`);
}

// the service worker: written by scripts/vite-plugin-sw.mjs
const sw = join(dir, 'sw.js');
if (!existsSync(sw)) problems.push('sw.js: missing (the app would not work offline)');
else {
  const m = /^self\.__PRECACHE = (\[.*\]);\nself\.__RELEASE = (".*");\n/.exec(readFileSync(sw, 'utf8'));
  let list = null;
  try { list = m && JSON.parse(m[1]); } catch { list = null; }
  if (!Array.isArray(list) || !list.length) problems.push('sw.js: no precache list at its top');
  else {
    if (!list.includes('index.html')) problems.push('sw.js: index.html is not precached');
    for (const p of list) {
      if (/\.(map|ttf|woff)$/i.test(p) || /(^|\/)api\//.test(p)) problems.push(`sw.js: must not precache ${p}`);
      else if (!existsSync(join(dir, p))) problems.push(`sw.js: precaches ${p}, which the build does not have`);
    }
  }
}
if (problems.length) {
  console.error(`check-dist: the build in ${dir} must not ship:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-dist: ${dir} is clean${personal ? ' (personal-key mode compiled in)' : ''}.`);
