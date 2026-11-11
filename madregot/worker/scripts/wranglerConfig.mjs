// wrangler.toml as wrangler itself reads it (COUNCIL2-10, COUNCIL2-16): the installed wrangler's own config reader, so a
// file wrangler would refuse at deploy (invalid TOML, a key defined twice in one table, a binding it cannot read) is
// refused here too. test/config.test.js and `npm run owner -- doctor` both read the file this way; neither runs wrangler's
// command line, logs in or reaches the network.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let wrangler = null;

/**
 * The config of `file` (the top level, or the environment `env`, e.g. 'staging'), as wrangler normalises it. Throws
 * wrangler's own error when the file cannot be read (its first line says why, e.g. 'Invalid TOML document: trying to
 * redefine an already defined table or value'). Wrangler's warnings are not printed.
 */
export function readWranglerConfig(file, env) {
  wrangler ??= require('wrangler');
  return wrangler.unstable_readConfig({ config: file, ...(env ? { env } : {}) }, { hideWarnings: true });
}

/** The installed wrangler's version (package.json pins it). */
export const wranglerVersion = () => require('wrangler/package.json').version;

/**
 * The parts the go-live check reads (src/readiness.js): the vars as strings, the D1 database id of the DB binding and the
 * names of the rate-limit bindings.
 */
export function deployParts(config) {
  const vars = Object.fromEntries(Object.entries(config?.vars || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  const db = (config?.d1_databases || []).find((d) => d.binding === 'DB');
  return { vars, databaseId: db?.database_id || '', ratelimits: (config?.ratelimits || []).map((r) => r.name) };
}

/** The first line of a reader's error, for a one-line printout. */
export const configErrorLine = (e) => String(e?.message || e || 'unknown error').split('\n').map((l) => l.trim()).find(Boolean) || 'unknown error';
