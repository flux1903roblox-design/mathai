// `node scripts/owner.mjs set NAME=value …`: the owner writes a setting into wrangler.toml without opening the file.
// Each value goes on the line that already names it in the top-level [vars] table (the production Worker's; a staging
// table is never touched), keeping the line's comment and the file's line ends. Only names [vars] already lists are
// accepted, and only plain one-line text (no quote, backslash or line break, at most 300 characters). Names whose
// format the app relies on are checked: PUBLIC_URL an https address with no path (a trailing / is dropped), the email
// names an address, the date names YYYY-MM-DD. DB_JURISDICTION is refused: setup writes it when it creates the database,
// and it must say where the database really is. Nothing is deployed here; `npm run deploy` sends the file to Cloudflare.
// `set --production NAME=value …` writes the same checked values into production.json instead (scripts/production.mjs),
// the live server's settings, which a GitHub Actions deploy reads.
//
// NAME=value pairs need no -- flags, so the command reads the same through npm, node, PowerShell or a Unix shell.

const REFUSED = {
  DB_JURISDICTION: 'DB_JURISDICTION is written by setup when it creates the database, and must say where the database really is',
};

const EMAIL = /^[^\s@"<>]+@[^\s@"<>]+\.[^\s@"<>]+$/;
const FORMATS = {
  PUBLIC_URL: [/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/, 'an https address with no path, e.g. https://madregot-api.example.workers.dev'],
  CONTACT_EMAIL: [EMAIL, 'an email address'],
  OWNER_EMAIL: [EMAIL, 'an email address'],
  ACCESS_COORD_EMAIL: [EMAIL, 'an email address'],
  LEGAL_DATE: [/^\d{4}-\d{2}-\d{2}$/, 'a date written YYYY-MM-DD'],
  ACCESS_STATEMENT_DATE: [/^\d{4}-\d{2}-\d{2}$/, 'a date written YYYY-MM-DD'],
  // the day the store apps came out: the waitlist closes, and is deleted 30 days later (src/waitlist.js)
  WAITLIST_LAUNCHED_AT: [/^\d{4}-\d{2}-\d{2}$/, 'a date written YYYY-MM-DD'],
  // the store pages the waitlist's launch email links to (src/waitlist.js storeLinks)
  APP_STORE_URL: [/^https:\/\/apps\.apple\.com\/[^\s"'<>]+$/, 'the app\'s App Store address, https://apps.apple.com/…'],
  PLAY_STORE_URL: [/^https:\/\/play\.google\.com\/[^\s"'<>]+$/, 'the app\'s Google Play address, https://play.google.com/…'],
};

export class SetError extends Error {}

/** NAME=value arguments as [[name, value]], in order. A name given twice keeps its last value. */
export function parsePairs(args) {
  if (!args.length) throw new SetError('usage: node scripts/owner.mjs set NAME=value [NAME=value …]');
  const pairs = new Map();
  for (const a of args) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/s.exec(String(a));
    if (!m) throw new SetError(`not NAME=value: ${a}`);
    pairs.set(m[1], m[2].trim());
  }
  return [...pairs];
}

/**
 * The value as it will be written, or a SetError saying what is wrong with it. `overlay`: the check of a value already in
 * production.json (scripts/production.mjs), where DB_JURISDICTION is the live database's own fact and may only say "eu".
 */
export function checkValue(name, value, { overlay = false } = {}) {
  if (REFUSED[name] && !overlay) throw new SetError(`${name} cannot be set here: ${REFUSED[name]}`);
  if (overlay && name === 'DB_JURISDICTION' && !/^(eu)?$/.test(String(value).trim())) throw new SetError('DB_JURISDICTION may only be "eu" (the database was created with --jurisdiction=eu) or empty');
  let v = String(value).trim();
  if (/["\\]/.test(v) || /[\u0000-\u001f\u007f]/.test(v)) throw new SetError(`${name}: the value may not hold a quote, a backslash or a line break`);
  if (v.length > 300) throw new SetError(`${name}: the value is longer than 300 characters`);
  if (name === 'PUBLIC_URL') v = v.replace(/\/+$/, '');
  const f = FORMATS[name];
  if (f && v !== '' && !f[0].test(v)) throw new SetError(`${name} must be ${f[1]}`);
  return v;
}

/** The NAME = "value" lines of wrangler.toml's top-level [vars] table, as { NAME: value } (other tables are not read). */
export function topVars(text) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*\[vars\]\s*(#.*)?$/.test(l));
  if (start < 0) return {};
  const out = {};
  for (let i = start + 1; i < lines.length && !/^\s*\[/.test(lines[i]); i++) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*"([^"\\]*)"\s*(#.*)?$/.exec(lines[i]);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * `text` (wrangler.toml) with each [name, value] written on its line in the top-level [vars] table.
 * → { text, changed: [{ name, from, to }] }. Throws SetError for a name the table does not list as a string.
 * `check(name, value)` is the value's check (default checkValue; the production overlay passes its own).
 */
export function setVars(text, pairs, { check = checkValue } = {}) {
  const src = String(text);
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  // the top-level [vars] table: from its header to the next table header
  const start = lines.findIndex((l) => /^\s*\[vars\]\s*(#.*)?$/.test(l));
  if (start < 0) throw new SetError('wrangler.toml has no [vars] table');
  let end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
  if (end < 0) end = lines.length;
  const changed = [];
  for (const [name, raw] of pairs) {
    const value = check(name, raw);
    const re = new RegExp(`^(\\s*${name}\\s*=\\s*)"([^"\\\\]*)"(\\s*(#.*)?)$`);
    const at = lines.findIndex((l, i) => i > start && i < end && re.test(l));
    if (at < 0) throw new SetError(`${name} is not a setting in [vars] of wrangler.toml (check the spelling)`);
    const m = re.exec(lines[at]);
    lines[at] = `${m[1]}"${value}"${m[3]}`;
    if (m[2] !== value) changed.push({ name, from: m[2], to: value });
  }
  return { text: lines.join(eol), changed };
}
