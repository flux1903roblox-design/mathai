// The edge rate limit (DURABLE-16): Cloudflare's Workers Rate Limiting bindings in front of sign-in, class lookup and
// join, device minting, the AI routes and a class student's writes. A burst filter, not a quota: Cloudflare counts per
// location and approximately (developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), so it writes nothing
// to the database and never replaces the D1 counters (util.js take(), the source of truth), which run after it unchanged.
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
//   RL_WRITE 60 a minute per class student, per location (COUNCIL2-18): POST /api/progress, /api/exams, /api/help,
//            /api/help/:id/reply and /api/class/work/:id. The key is the student's Bearer once it is found in
//            student_tokens, hashed; a token that does not check (the handler then answers 401) counts against its
//            network. The app sends a batch every 5 answers, so a student stays far below it; the exact daily budgets
//            are the handlers' (writes.js: the student's, the class's and the network's).
//            The same binding guards POST /api/waitlist (waitlist.js), keyed by the network (IPv6 by its /48, as the
//            handler's own daily counts are) under a key of its own ('w:n:<net>'), so the public signups never share a
//            student's count. The handler calls edgeGuard itself (index.js routes it first), so a plain form post it
//            refuses still goes back to the page.
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
/** The waitlist's signups (waitlist.js): RL_WRITE, by network. */
export const WAITLIST_ROUTE = /^\/api\/waitlist$/;
/**
 * The routes RL_WRITE guards (POST): a class student's answers, levels and exams, their help requests and replies to the
 * teacher, and their reports on an assignment.
 */
export const WRITE_ROUTES = [/^\/api\/progress$/, /^\/api\/exams$/, /^\/api\/help$/, /^\/api\/help\/\d+\/reply$/, /^\/api\/class\/work\/[a-f0-9]{16}$/];

const found = async (env, sql, ...args) => !!(await env.DB.prepare(sql).bind(...args).first());

/**
 * The credential of an AI request that the server can vouch for, as a string that names it ('s:<token>', 'f:<token>',
 * 't:<class>', 'd:<id>'), or null when there is none: a header that is missing, malformed or not found counts for nothing.
 */
export async function verifiedCaller(req, env) {
  const bearer = await checkedStudent(req, env);
  if (bearer) return `s:${bearer}`;
  const fd = String(req.headers.get('X-Family-Device') || '').trim();
  if (/^fd1\.[a-f0-9]{64}$/.test(fd) && await found(env, 'SELECT 1 AS x FROM family_devices WHERE token_hash = ?', await sha256(fd))) return `f:${fd}`;
  if (req.headers.get('X-Class-Code') && (req.headers.get('X-Teacher-Key') || req.headers.get('X-Account-Token'))) {
    try { return `t:${(await requireTeacher(req, env)).code}`; } catch { /* a wrong pair is no credential */ }
  }
  const signed = String(req.headers.get('X-Device') || '').match(/^dv1\.([a-f0-9]{32})\.([a-f0-9]{32})$/);
  if (signed && env.DEVICE_SECRET && safeEqual((await hmacHex(env.DEVICE_SECRET, `device:${signed[1]}`)).slice(0, 32), signed[2])) return `d:${signed[1]}`;
  return null;
}

/** A class student's Bearer token, when student_tokens has it; else null. */
async function checkedStudent(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return bearer && bearer.length <= 128 && await found(env, 'SELECT 1 AS x FROM student_tokens WHERE token_hash = ?', await sha256(bearer)) ? bearer : null;
}

/** The writer of a progress or exam request: a hash of a checked student token, else its network. */
async function writerKey(req, env) {
  const bearer = await checkedStudent(req, env);
  return bearer ? `s:${(await sha256(`edge-write:${bearer}`)).slice(0, 32)}` : `n:${await netKey(req, env)}`;
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
  if (method === 'POST' && WAITLIST_ROUTE.test(path)) {
    if (typeof env.RL_WRITE?.limit !== 'function') return;
    return edgeLimit(env.RL_WRITE, `w:n:${await netKey(req, env, { wide: true })}`);
  }
  if (method === 'POST' && WRITE_ROUTES.some((re) => re.test(path))) {
    if (typeof env.RL_WRITE?.limit !== 'function') return;
    return edgeLimit(env.RL_WRITE, await writerKey(req, env));
  }
}
