// Cloudflare's free Workers plan takes at most 64 settings per Worker, text vars and secrets together (Workers Paid: 128).
// wrangler.toml lists more than that, and about half of them are empty until the owner fills them in. The deploy config
// (scripts/deploy-config.mjs) therefore sends each vars table's empty ones as a single var, BLANK_VARS = "NAME,NAME,…".
// Both handlers in index.js call withBlankVars first, so every one of those names reads "" again, as wrangler.toml says,
// and no other code has to know about the folding.

export const BLANK_VARS = 'BLANK_VARS';

// one restored env per env object the runtime hands in (it reuses the same object across requests), so a cache keyed on
// env (dbsize.js) keeps working
const restored = new WeakMap();

/**
 * `env` with each name listed in env.BLANK_VARS set to "" (a name that has a value of its own, e.g. a secret, keeps it)
 * and BLANK_VARS itself removed. Without BLANK_VARS (tests, `wrangler dev`, a plain `wrangler deploy`) → `env` itself.
 */
export function withBlankVars(env) {
  if (!env || typeof env[BLANK_VARS] !== 'string') return env;
  const hit = restored.get(env);
  if (hit) return hit;
  const out = { ...env };
  delete out[BLANK_VARS];
  for (const name of env[BLANK_VARS].split(',').map((s) => s.trim()).filter(Boolean)) {
    if (out[name] === undefined) out[name] = '';
  }
  restored.set(env, out);
  return out;
}
