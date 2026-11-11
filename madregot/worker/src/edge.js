// The edge rate limit (DURABLE-16): Cloudflare's Workers Rate Limiting bindings in front of sign-in, class lookup and
// join, device minting and the AI routes. A burst filter, not a quota: Cloudflare counts per location and approximately
// (developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), so it writes nothing to the database and never
// replaces the D1 counters (util.js take(), the source of truth), which run after it unchanged.
//
//   RL_AUTH  20 a minute per network (IPv6 by its /48), per location:
//            POST /api/account/code, POST /api/account/verify, GET /api/classes/:code, POST /api/classes/:code/join,
//            POST /api/devices
//   RL_AI    30 a minute per caller, per location: POST /api/ai/*. The caller is the credential the request presents
//            (a class student's Bearer, a family device's token or the device id), hashed; the network only for a
//            request with none. So two devices behind one school address are counted apart.
// Over the limit: 429 slow_down with Retry-After: 60. With no binding (tests, `wrangler dev` without it) nothing is checked.
import { HttpError, netKey, sha256 } from './util.js';

/** Ask the binding for one more request under `key`; throws 429 slow_down when it says no. */
export async function edgeLimit(binding, key) {
  if (typeof binding?.limit !== 'function') return;
  const { success } = await binding.limit({ key });
  if (!success) throw new HttpError(429, 'slow_down', undefined, undefined, { 'Retry-After': '60' });
}

/** The routes RL_AUTH guards, as [method, pattern]. */
export const AUTH_ROUTES = [
  ['POST', /^\/api\/account\/code$/],
  ['POST', /^\/api\/account\/verify$/],
  ['GET', /^\/api\/classes\/[A-Za-z0-9]{6}$/],
  ['POST', /^\/api\/classes\/[A-Za-z0-9]{6}\/join$/],
  ['POST', /^\/api\/devices$/],
];
const AI_ROUTE = /^\/api\/ai\/\w+$/;

/** The caller of an AI request, as a key that holds no credential: a hash of what it presents, else its network. */
async function callerKey(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const cred = (auth.startsWith('Bearer ') ? auth.slice(7).trim() : '')
    || String(req.headers.get('X-Family-Device') || '').trim()
    || String(req.headers.get('X-Device') || '').trim();
  return cred ? `c:${(await sha256(`edge-ai:${cred}`)).slice(0, 32)}` : `n:${await netKey(req, env)}`;
}

/** Before the handler of a guarded route (route() in index.js): the edge limit for it, if any. */
export async function edgeGuard(method, path, req, env) {
  if (AUTH_ROUTES.some(([m, re]) => m === method && re.test(path))) {
    if (typeof env.RL_AUTH?.limit !== 'function') return;
    return edgeLimit(env.RL_AUTH, `n:${await netKey(req, env, { wide: true })}`);
  }
  if (method === 'POST' && AI_ROUTE.test(path)) {
    if (typeof env.RL_AI?.limit !== 'function') return;
    return edgeLimit(env.RL_AI, await callerKey(req, env));
  }
}
