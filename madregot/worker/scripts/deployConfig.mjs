// wrangler.deploy.toml, the config every deploy uses (npm run deploy, setup.ps1, setup.sh, deploy.ps1): the functions.
// scripts/deploy-config.mjs is the command that writes it; test/deploy-config.test.js tests these.
//
// Cloudflare's free Workers plan takes at most 64 settings per Worker, text vars and secrets together (Workers Paid: 128),
// and refuses the deploy otherwise. wrangler.toml lists more vars than that, about half of them empty until the owner
// fills them in. The deploy file is wrangler.toml with one change: in each vars table the empty ones are left out and
// listed instead in a single var, BLANK_VARS = "NAME,NAME,…". The Worker gives each of them back as "" before any code
// reads env (src/blankVars.js), so it runs exactly as wrangler.toml says.
//
// The file sits next to wrangler.toml, so every relative path in it (main, assets, migrations) means the same; it is
// git-ignored and rewritten on each deploy, so wrangler.toml stays the one file to edit. Both files are read back with
// wrangler's own reader and nothing is written if anything other than that one change differs.
import { isDeepStrictEqual } from 'node:util';
import { BLANK_VARS, withBlankVars } from '../src/blankVars.js';

export const FREE_PLAN_SETTINGS = 64;
// the secrets setup makes or asks for: AUTH_SECRET, IP_HASH_SECRET, WEBHOOK_PATH_SECRET, VAULT_SECRET, ANTHROPIC_API_KEY,
// RESEND_API_KEY, and Grow's four once payments are on
export const SECRETS_ROOM = 10;

const isVarsTable = (t) => t === 'vars' || /^env\.[A-Za-z0-9_-]+\.vars$/.test(t);

/**
 * wrangler.toml's text with the empty vars of each vars table folded into one BLANK_VARS line right under the table's
 * header. → { text, folded: { 'vars': [names], 'env.staging.vars': [names] } }. A table with no empty var is left as it is.
 */
export function foldBlankVars(text) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  const folded = {};
  const headerAt = {};
  let table = '';
  for (const line of lines) {
    const header = /^\s*(\[\[?)\s*([^\]\s]+)\s*\]\]?\s*(#.*)?$/.exec(line);
    if (header) {
      table = header[1] === '[[' ? `[[${header[2]}]]` : header[2];
      out.push(line);
      if (isVarsTable(table)) headerAt[table] = out.length - 1;
      continue;
    }
    if (isVarsTable(table)) {
      if (new RegExp(`^\\s*${BLANK_VARS}\\s*=`).test(line)) throw new Error(`wrangler.toml sets ${BLANK_VARS} itself; that name is the deploy's own`);
      const blank = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*""\s*(#.*)?$/.exec(line);
      if (blank) { (folded[table] ||= []).push(blank[1]); continue; }
    }
    out.push(line);
  }
  // bottom-up, so the indexes above each insertion stay right
  for (const [t, at] of Object.entries(headerAt).sort((a, b) => b[1] - a[1])) {
    if (folded[t]?.length) out.splice(at + 1, 0, `${BLANK_VARS} = "${folded[t].join(',')}"`);
  }
  return { text: out.join('\n'), folded };
}

/** The environments wrangler.toml defines ([env.<name>] or [env.<name>.…] tables). */
export const envNames = (text) => [...new Set([...String(text).matchAll(/^\s*\[\[?\s*env\.([A-Za-z0-9_-]+)[.\]]/gm)].map((m) => m[1]))];

const PATH_KEYS = ['configPath', 'userConfigPath'];
const strip = (config) => Object.fromEntries(Object.entries(config).filter(([k]) => !PATH_KEYS.includes(k) && k !== 'vars'));

/**
 * Read both files with `read` (wrangler's reader) at the top level and in each environment, and check that the deploy
 * file means the same: its vars, once withBlankVars restores them, equal wrangler.toml's, and everything else is equal.
 * → a list of differences, empty when they mean the same.
 */
export function differences(read, sourceFile, deployFile, envs) {
  const found = [];
  for (const env of [undefined, ...envs]) {
    const where = env ? `env ${env}` : 'top level';
    const a = read(sourceFile, env);
    const b = read(deployFile, env);
    const restored = withBlankVars({ ...(b.vars || {}) });
    if (!isDeepStrictEqual({ ...(a.vars || {}) }, restored)) {
      const keys = new Set([...Object.keys(a.vars || {}), ...Object.keys(restored)]);
      const diff = [...keys].filter((k) => !isDeepStrictEqual(a.vars?.[k], restored[k]));
      found.push(`${where}: vars differ (${diff.join(', ')})`);
    }
    const sa = strip(a);
    const sb = strip(b);
    for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
      if (!isDeepStrictEqual(sa[k], sb[k])) found.push(`${where}: ${k} differs`);
    }
  }
  return found;
}

/** How many vars Cloudflare gets for the top level (the production Worker) from the deploy file's text. */
export function settingsSent(read, deployFile) {
  return Object.keys(read(deployFile).vars || {}).length;
}
