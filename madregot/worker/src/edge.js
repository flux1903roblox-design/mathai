// The edge rate limit (DURABLE-16): Cloudflare's Workers Rate Limiting bindings in front of sign-in, class lookup and
// join, device minting and the AI routes. A burst filter, not a quota: Cloudflare counts per location and approximately
// (developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), so it writes nothing to the database and never
// replaces the D1 counters (util.js take(), the source of truth), which run after it unchanged.
//
//   RL_AUTH  20 a minute per network (IPv6 by its /48), per location:
//            POST /api/account/code, POST /api/account/verify, GET /api/classes/:code, POST /api/classes/:code/join,
//            POST /api/devices
//   RL_AI    30 a minute per caller, per location: POST /api/ai/*. The caller is a credential the server has checked
//            (COUNCIL2-11): a class student's Bearer found in student_tokens, a family device's token found in
//            family_devices, a teacher's class code with its key (or the session the class is bound to), or a device id
//            minted by POST /api/devices (its signature checks with DEVICE_SECRET), hashed. Anything else counts against
//            the network: no credential, or one that does not check, so a made-up X-Device on every request buys no
//            fresh limit. Two class students behind one school address are still counted apart.
// Over the limit: 429 slow_down with Retry-After: 60. With no binding (tests, `wrangler dev` without it) nothing is checked.
import { HttpError, netKey, sha256, hmacHex, safeEqual } from './util.js';
import { requireTeacher } from './entitle.js';

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

const found = async (env, sql, ...args) => !!(await env.DB.prepare(sql).bind(...args).first());

/**
 * The credential of an AI request that the server can vouch for, as a string that names it ('s:<token>', 'f:<token>',
 * 't:<class>', 'd:<id>'), or null when there is none: a header that is missing, malformed or not found counts for nothing.
 */
export async function verifiedCaller(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (bearer && bearer.length <= 128 && await found(env, 'SELECT 1 AS x FROM student_tokens WHERE token_hash = ?', await sha256(bearer))) return `s:${bearer}`;
  const fd = String(req.headers.get('X-Family-Device') || '').trim();
  if (/^fd1\.[a-f0-9]{64}$/.test(fd) && await found(env, 'SELECT 1 AS x FROM family_devices WHERE token_hash = ?', await sha256(fd))) return `f:${fd}`;
  if (req.headers.get('X-Class-Code') && (req.headers.get('X-Teacher-Key') || req.headers.get('X-Account-Token'))) {
    try { return `t:${(await requireTeacher(req, env)).code}`; } catch { /* a wrong pair is no credential */ }
  }
  const signed = String(req.headers.get('X-Device') || '').match(/^dv1\.([a-f0-9]{32})\.([a-f0-9]{32})$/);
  if (signed && env.DEVICE_SECRET && safeEqual((await hmacHex(env.DEVICE_SECRET, `device:${signed[1]}`)).slice(0, 32), signed[2])) return `d:${signed[1]}`;
  return null;
}

/** The caller of an AI request, as a key that holds no credential: a hash of a checked one, else its network. */
async function callerKey(req, env) {
  const cred = await verifiedCaller(req, env);
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
