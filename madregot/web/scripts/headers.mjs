// The security headers every page of the app must carry (spec TEACHER-12 §2: the Ministry catalogue's technical check),
// read from a Cloudflare `_headers` file. public/_headers ships them; src/headers.test.js holds the source to them, and
// scripts/check-dist.mjs refuses a build whose dist/_headers lost one, so a later edit cannot drop one silently.

/** name → what the value must contain ('' : present and not empty). Checked on the "/*" block. */
export const REQUIRED_HEADERS = Object.freeze({
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': '',
  'Permissions-Policy': '',
});

/** A `_headers` file → { "<path>": { "<lower-case name>": value } }. */
export function parseHeaders(text) {
  const blocks = {};
  let cur = null;
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { cur = raw.trim(); blocks[cur] = blocks[cur] || {}; continue; }
    const m = /^\s+([A-Za-z0-9-]+)\s*:\s*(.*)$/.exec(raw);
    if (cur && m) blocks[cur][m[1].toLowerCase()] = m[2].trim();
  }
  return blocks;
}

/** What is missing from the "/*" block of a `_headers` file: [] when every required header is there. */
export function headerProblems(text) {
  const all = parseHeaders(text)['/*'];
  if (!all) return ['no "/*" block'];
  return Object.entries(REQUIRED_HEADERS).flatMap(([name, must]) => {
    const v = all[name.toLowerCase()];
    if (!v) return [`${name} is missing`];
    if (must && !v.includes(must)) return [`${name} lacks ${must}`];
    return [];
  });
}
