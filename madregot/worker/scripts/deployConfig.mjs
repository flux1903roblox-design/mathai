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
//
// The production deploy (`node scripts/deploy-config.mjs --production`: GitHub Actions > Deploy, npm run
// deploy:production) first writes the live server's own settings, production.json (scripts/production.mjs), into the
// text, then folds. The same check then proves the file means wrangler.toml plus exactly production.json.
//
// A check that only needs such a file for a moment (`owner doctor --production`, `owner set --production`, the owner's
// database commands with --production) writes it with writeCheckFile, under a name of its own, so it never replaces or
// removes the wrangler.deploy.toml that a deploy about to run reads.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { BLANK_VARS, withBlankVars } from '../src/blankVars.js';
import { readWranglerConfig } from './wranglerConfig.mjs';
import { PRODUCTION_FILE, readOverlay, applyOverlay, expectConfig } from './production.mjs';

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
 * With `overlay` (production.json, read by scripts/production.mjs), what wrangler.toml says plus exactly that overlay.
 * → a list of differences, empty when they mean the same.
 */
export function differences(read, sourceFile, deployFile, envs, overlay = null) {
  const found = [];
  for (const env of [undefined, ...envs]) {
    const where = env ? `env ${env}` : 'top level';
    const a = expectConfig(read(sourceFile, env), overlay, env);
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

/**
 * Write wrangler.deploy.toml next to `sourceFile` (wrangler.toml) and check it with `read` (wrangler's reader); with
 * `production`, production.json (next to it, or `productionText`) is written in first. `deployFile`: another path for
 * the file (writeCheckFile's). → { deployFile, folded, sent, overlay }. Throws (with the file removed) when the overlay
 * is refused or the file would mean anything else, so a deploy that follows with --config wrangler.deploy.toml never
 * runs on an old or wrong file.
 */
export function writeDeployFile({ sourceFile, production = false, read = readWranglerConfig, deployFile = path.join(path.dirname(sourceFile), 'wrangler.deploy.toml'), productionText } = {}) {
  const dir = path.dirname(sourceFile);
  rmSync(deployFile, { force: true }); // never a file from an earlier run, whatever happens below
  try {
    const source = readFileSync(sourceFile, 'utf8');
    const overlay = production ? readOverlay(productionText ?? readFileSync(path.join(dir, PRODUCTION_FILE), 'utf8'), source) : null;
    const folded = foldBlankVars(overlay ? applyOverlay(source, overlay) : source);
    writeFileSync(deployFile, folded.text);
    const found = differences(read, sourceFile, deployFile, envNames(source), overlay);
    if (found.length) {
      throw new Error(`wrangler.deploy.toml would not mean what wrangler.toml${overlay ? ' with production.json' : ''} says:\n  ${found.join('\n  ')}`);
    }
    return { deployFile, folded: folded.folded, sent: settingsSent(read, deployFile), overlay };
  } catch (e) {
    rmSync(deployFile, { force: true });
    throw e;
  }
}

/** The names a check's files take next to wrangler.toml (git-ignored: worker/.gitignore). */
export const CHECK_FILE = /^wrangler\.check-[\w-]+(\.source)?\.toml$/;

/**
 * A production deploy file only for a check, from the texts given: `sourceText` (wrangler.toml) and `productionText`
 * (production.json), usually as committed (scripts/production.mjs committedText). Both are written into `dir`, the
 * folder of wrangler.toml, so main, assets and migrations mean the same, as wrangler.check-<tag>.source.toml and
 * wrangler.check-<tag>.toml; never as wrangler.deploy.toml. → writeDeployFile's result, plus `text` (the deploy file's
 * text) and `done()`, which removes both files. Throws, with both removed, as writeDeployFile does.
 */
export function writeCheckFile({ dir, sourceText, productionText, read = readWranglerConfig, tag = `${process.pid}-${randomBytes(4).toString('hex')}` }) {
  const sourceFile = path.join(dir, `wrangler.check-${tag}.source.toml`);
  const deployFile = path.join(dir, `wrangler.check-${tag}.toml`);
  const done = () => { rmSync(deployFile, { force: true }); rmSync(sourceFile, { force: true }); };
  try {
    writeFileSync(sourceFile, String(sourceText));
    const w = writeDeployFile({ sourceFile, production: true, read, deployFile, productionText: String(productionText) });
    return { ...w, sourceFile, text: readFileSync(deployFile, 'utf8'), done };
  } catch (e) {
    done();
    throw e;
  }
}
