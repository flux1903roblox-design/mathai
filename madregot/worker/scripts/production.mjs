// The live server's own settings: worker/production.json, committed next to wrangler.toml. wrangler.toml stays the
// template every owner starts from (database_id "REPLACE_WITH_DATABASE_ID", DB_JURISDICTION ""; setup.ps1 and setup.sh
// write those two into a copy on the owner's computer). production.json holds only what the live Worker has that the
// template does not, so a production deploy (GitHub Actions > Deploy, or `npm run deploy:production`) never reads a
// value that lives only on someone's computer:
//
//   { "account_id": "",                          the Cloudflare account; empty: the CLOUDFLARE_ACCOUNT_ID the deploy is given
//     "d1":   { "DB": "<database id>" },          a D1 binding wrangler.toml's top level lists → its database_id
//     "vars": { "PUBLIC_URL": "https://…", … } }  names wrangler.toml's top-level [vars] lists → their values
//
// Applied to wrangler.toml's text before the empty vars are folded (scripts/deployConfig.mjs), so a var set here is sent
// as itself and leaves BLANK_VARS. A name or binding the template does not list is refused, and so is anything that is
// not plain text: the values pass the same checks as `npm run owner -- set` (scripts/setVars.mjs). The file is in git
// and the repository can be public, so it never holds a key, a token or an email address: secrets stay in Cloudflare
// (npx wrangler secret put). [env.staging] is never touched. Changes: `npm run owner -- set --production NAME=value`,
// then a commit, so every change to the live server's settings is a commit anyone can read back.
import { execFileSync } from 'node:child_process';
import { SetError, checkValue, setVars, topVars } from './setVars.mjs';

export const PRODUCTION_FILE = 'production.json';
/** What is wrong with production.json, in one sentence (a SetError, so `set --production` prints it as `set` does). */
export class OverlayError extends SetError {}

const KEYS = ['$comment', 'account_id', 'd1', 'vars'];
const ACCOUNT_ID = /^[0-9a-f]{32}$/i;
const DATABASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An email address anywhere in a value (a mailto: subject, "Name <a@b.c>", a plain address). */
export const EMAIL_IN = /[^\s@"<>:]+@[^\s@"<>]+\.[^\s@"<>]+/;
/**
 * The [vars] that hold an email address. For the live server such an address is a Cloudflare secret of the same name
 * (the var stays empty here and in wrangler.toml, is sent in BLANK_VARS, and src/blankVars.js keeps the secret's value).
 */
export const EMAIL_NAME = /EMAIL|^VAPID_SUBJECT$/;
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * A value as production.json may hold it: the checks of `set` (scripts/setVars.mjs), DB_JURISDICTION only "eu" or "",
 * and no email address. → the value, or a SetError.
 */
export function checkProductionValue(name, value) {
  if (typeof value !== 'string') throw new SetError(`${name} must be text in quotes, e.g. "${value}"`);
  if (EMAIL_IN.test(value)) {
    throw new SetError(`${name}: production.json is in git, and the repository can be public, so it never holds an email address. `
      + `The live server reads one from a Cloudflare secret of the same name instead: npx wrangler secret put ${name}`);
  }
  return checkValue(name, value, { overlay: true });
}

/** The bindings of wrangler.toml's top-level [[d1_databases]] tables (an environment's own are not read). */
export function topD1Bindings(text) {
  const out = [];
  let table = '';
  for (const line of String(text).split(/\r?\n/)) {
    const header = /^\s*(\[\[?)\s*([^\]\s]+)\s*\]\]?\s*(#.*)?$/.exec(line);
    if (header) { table = header[1] === '[[' ? `[[${header[2]}]]` : header[2]; continue; }
    const b = table === '[[d1_databases]]' && /^\s*binding\s*=\s*"([^"]*)"/.exec(line);
    if (b) out.push(b[1]);
  }
  return out;
}

/**
 * production.json's text, checked against wrangler.toml's text: → { account_id, d1: { binding: id }, vars: { NAME: v } }.
 * Throws OverlayError saying what is wrong (and where to put a secret).
 */
export function readOverlay(jsonText, templateText) {
  let o;
  try { o = JSON.parse(String(jsonText)); } catch (e) { throw new OverlayError(`production.json is not valid JSON: ${e.message}`); }
  if (!isObject(o)) throw new OverlayError('production.json must be one object: { "account_id": "", "d1": {…}, "vars": {…} }');
  for (const k of Object.keys(o)) {
    if (!KEYS.includes(k)) throw new OverlayError(`production.json: unknown key "${k}" (it holds account_id, d1 and vars)`);
  }
  const account = o.account_id ?? '';
  if (typeof account !== 'string' || (account !== '' && !ACCOUNT_ID.test(account))) {
    throw new OverlayError('production.json: account_id is a Cloudflare account id (32 letters and digits), or "" to take CLOUDFLARE_ACCOUNT_ID');
  }
  for (const k of ['d1', 'vars']) if (o[k] !== undefined && !isObject(o[k])) throw new OverlayError(`production.json: ${k} must be an object`);
  const bindings = topD1Bindings(templateText);
  const d1 = {};
  for (const [binding, id] of Object.entries(o.d1 || {})) {
    if (!bindings.includes(binding)) throw new OverlayError(`production.json: d1 "${binding}" is not a D1 binding of wrangler.toml (it has ${bindings.join(', ') || 'none'})`);
    if (typeof id !== 'string' || !DATABASE_ID.test(id)) throw new OverlayError(`production.json: d1 "${binding}" must be a database id as wrangler d1 create prints it`);
    d1[binding] = id;
  }
  const template = topVars(templateText);
  const vars = {};
  for (const [name, value] of Object.entries(o.vars || {})) {
    if (!(name in template)) {
      throw new OverlayError(`production.json: ${name} is not a setting in [vars] of wrangler.toml (check the spelling; a secret never goes here: npx wrangler secret put ${name})`);
    }
    try { vars[name] = checkProductionValue(name, value); } catch (e) { throw new OverlayError(`production.json: ${e.message}`); }
  }
  return { account_id: account, d1, vars };
}

/** The index of the database_id line in the top-level [[d1_databases]] table whose binding is `binding`. */
function databaseIdLine(lines, binding) {
  let block = null;
  const found = () => (block && block.binding === binding ? block.idAt : undefined);
  for (let i = 0; i < lines.length; i++) {
    const header = /^\s*(\[\[?)\s*([^\]\s]+)\s*\]\]?\s*(#.*)?$/.exec(lines[i]);
    if (header) {
      if (found() !== undefined) return found();
      block = header[1] === '[[' && header[2] === 'd1_databases' ? {} : null;
      continue;
    }
    if (!block) continue;
    const b = /^\s*binding\s*=\s*"([^"]*)"/.exec(lines[i]);
    if (b) block.binding = b[1];
    if (/^\s*database_id\s*=/.test(lines[i])) block.idAt = i;
  }
  return found();
}

/**
 * wrangler.toml's text with the overlay written in: each var on its line of the top-level [vars] table, each D1
 * binding's database_id in its top-level [[d1_databases]] table, and account_id (when set) as the first top-level key
 * after name. Line ends and comments are kept. Throws OverlayError when the template has no such line.
 */
export function applyOverlay(templateText, overlay) {
  let text;
  try {
    text = setVars(templateText, Object.entries(overlay.vars || {}), { check: checkProductionValue }).text;
  } catch (e) { throw new OverlayError(`production.json: ${e.message}`); }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  for (const [binding, id] of Object.entries(overlay.d1 || {})) {
    const at = databaseIdLine(lines, binding);
    const m = at === undefined ? null : /^(\s*database_id\s*=\s*)"[^"]*"(\s*(#.*)?)$/.exec(lines[at]);
    if (!m) throw new OverlayError(`production.json: wrangler.toml has no database_id = "…" line for the D1 binding "${binding}"`);
    lines[at] = `${m[1]}"${id}"${m[2]}`;
  }
  if (overlay.account_id) {
    const firstTable = lines.findIndex((l) => /^\s*\[/.test(l));
    const top = firstTable < 0 ? lines : lines.slice(0, firstTable);
    if (top.some((l) => /^\s*account_id\s*=/.test(l))) throw new OverlayError('production.json: wrangler.toml already sets account_id; set it in one place only');
    const nameAt = top.findIndex((l) => /^\s*name\s*=/.test(l));
    if (nameAt < 0) throw new OverlayError('production.json: wrangler.toml has no top-level name line to put account_id after');
    lines.splice(nameAt + 1, 0, `account_id = "${overlay.account_id}"`);
  }
  return lines.join(eol);
}

/**
 * What wrangler's reader should give for the deploy file, from what it gives for wrangler.toml (`config`, at the top level
 * or in environment `env`): the overlay's vars and D1 ids at the top level, and account_id everywhere (wrangler carries it
 * into each environment). No overlay → the config itself.
 */
export function expectConfig(config, overlay, env) {
  if (!overlay) return config;
  const out = { ...config };
  if (overlay.account_id) out.account_id = overlay.account_id;
  if (env) return out;
  out.vars = { ...(config.vars || {}), ...(overlay.vars || {}) };
  // wrangler's reader makes objects with no prototype; a changed copy keeps the same one, so a deep compare sees only data
  const like = (o, extra) => Object.assign(Object.create(Object.getPrototypeOf(o)), o, extra);
  out.d1_databases = (config.d1_databases || []).map((d) => (d.binding in (overlay.d1 || {}) ? like(d, { database_id: overlay.d1[d.binding] }) : d));
  return out;
}

/**
 * production.json's text with each [name, value] written into vars (same checks as `set`, plus the email rule), keeping
 * its other keys and order: → { text, changed: [{ name, from, to }] }, `from` being the live value before (the
 * overlay's, else the template's). Throws SetError.
 */
export function setProductionVars(jsonText, templateText, pairs) {
  let o;
  try { o = JSON.parse(String(jsonText)); } catch (e) { throw new SetError(`production.json is not valid JSON: ${e.message}`); }
  if (!isObject(o)) throw new SetError('production.json must be one object');
  const template = topVars(templateText);
  const vars = isObject(o.vars) ? { ...o.vars } : {};
  const changed = [];
  for (const [name, raw] of pairs) {
    if (!(name in template)) throw new SetError(`${name} is not a setting in [vars] of wrangler.toml (check the spelling)`);
    const value = checkProductionValue(name, checkValue(name, raw));
    const from = name in vars ? String(vars[name]) : template[name];
    vars[name] = value;
    if (from !== value) changed.push({ name, from, to: value });
  }
  const text = `${JSON.stringify({ ...o, vars }, null, 2)}\n`;
  readOverlay(text, templateText);
  return { text, changed };
}

/**
 * production.json's vars, as the environment of a production build (scripts/production-env.mjs). The contact address is
 * never in production.json: CONTACT_EMAIL from the environment, when set, also becomes VITE_CONTACT_EMAIL (the teacher
 * screens read only that name) unless that is set already.
 */
export function productionEnv(overlay, env = process.env) {
  const out = { ...env, ...overlay.vars };
  const contact = String(env.CONTACT_EMAIL ?? '').trim();
  if (contact && !String(env.VITE_CONTACT_EMAIL ?? '').trim()) out.VITE_CONTACT_EMAIL = contact;
  return out;
}

/** git, run in `dir`: `run(args)` → its output. The tests pass a stub of this shape instead. */
export const gitIn = (dir) => (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 << 20 });
/** The first line git (or anything run) said when it failed. */
const firstLine = (e) => String(e?.stderr || e?.message || e).trim().split('\n')[0];

/**
 * Whether git says `files` (in `dir`) have changes that are not committed: null when they have none, else a sentence
 * that names them. A production deploy reads only committed settings, so a value edited on one computer cannot reach the
 * live server by accident. `run(args)` runs git and returns its output (tests pass a stub); when git cannot answer, the
 * answer is a refusal too.
 */
export function uncommitted(dir, files, run = gitIn(dir)) {
  let out;
  try { out = run(['status', '--porcelain', '--', ...files]); } catch (e) {
    return `git could not say whether ${files.join(' and ')} are committed (${firstLine(e)})`;
  }
  const lines = String(out).split('\n').map((l) => l.trimEnd()).filter(Boolean);
  return lines.length ? `${files.join(' and ')} have changes that are not committed:\n  ${lines.join('\n  ')}` : null;
}

/**
 * `file` (in `dir`) as this computer's last commit (HEAD) has it: what a production deploy of that commit reads, whatever
 * the copy on disk says. setup.ps1 and setup.sh write the owner's own database id into wrangler.toml, and a value edited
 * there never reaches the live server, so a check of the live server reads this text, never the file. Throws when git
 * cannot give it (no git, no commit, a file git does not have).
 */
export function committedText(dir, file, run = gitIn(dir)) {
  try { return String(run(['show', `HEAD:./${file}`])); } catch (e) {
    throw new Error(`git could not give ${file} as committed (${firstLine(e)}); a check of the live server reads only committed files`);
  }
}
