// The waitlist for the store apps. The owner advertises the public page /waitlist/ (and its short alias /w/, built by
// web/scripts/landing-build.mjs from web/landing/waitlist.html) and publishes the iPhone and Android apps if enough
// people join. POST /api/waitlist takes one signup:
//
//   { email, role: 'parent' | 'student' | 'teacher', grade?: '7' | '8', platform?: 'ios' | 'android' | 'both',
//     consent: true, utm_source?, utm_campaign?, website? }
//
// as JSON from the page's script, or as a plain form post (application/x-www-form-urlencoded) when the script did not
// run; then the answer is a 303 back to the page (/waitlist/#joined, #closed or #oops) instead of JSON.
//
// What is kept is the table `waitlist` and nothing else: the email as account.js cleanEmail leaves it (one row per
// address), role, grade, platform, a short source label from the ad's utm_source/utm_campaign, and when. No name, no
// network address, no device, no free text. consent is required: the box "אפשר לשלוח לי מייל אחד כשהאפליקציה יוצאת
// לחנויות" is the only use the row has.
//
// The same answer for every accepted signup, new or repeated: 201 { ok: true }, and a repeated address changes nothing,
// so nobody can learn from the answer (or its timing: both run the same INSERT … ON CONFLICT DO NOTHING) whether an
// address is on the list. Nothing sent is echoed back. The field `website` is a honeypot, hidden from people: a request
// that fills it gets the same 201 and nothing is stored.
//
// Limits, counted before anything is stored (util.js take, all or nothing): WAITLIST_CAPS.netHour signups an hour and
// netDay a day from one network (the hashed network key, never the address), and WAITLIST_CAPS.all a day in all (the
// owner gets one notice the day it is reached); past one, 429 and nothing stored. In front of them, the edge limiter's
// RL_WRITE binding (edge.js), keyed by the network. A request from a page on another origin (its Origin header is not
// this Worker's own address and not in ALLOWED_ORIGINS) is refused with 403: a plain form post needs no CORS preflight,
// so this is what keeps other sites from posting addresses here.
//
// Once WAITLIST_LAUNCHED_AT (YYYY-MM-DD, Jerusalem) is set and that day has come, the list is closed (410
// waitlist_closed), and every row is deleted RETENTION.waitlistAfterLaunchDays after it; a row is deleted
// RETENTION.waitlistMaxDays after its signup in any case (purgeWaitlistSql, run by cron.js purgeRecordsSql). The owner
// reads counts and exports the addresses for the launch email with scripts/owner.mjs (waitlist, waitlist --export F)
// and removes a person who asks (waitlist --remove E; forget --email E too); an account deleted with the same email
// takes its row along (billing.js forgetAccount).
import { HttpError, json, nowIso, netKey, key, take, rawBody, dayOf, isDay, startOfDayIso } from './util.js';
import { cleanEmail } from './account.js';
import { ownerNotice, queueNotices } from './spend.js';
import { RETENTION } from '../../shared/retention.js';

export const WAITLIST_ROLES = Object.freeze(['parent', 'student', 'teacher']);
export const WAITLIST_GRADES = Object.freeze(['7', '8']);
export const WAITLIST_PLATFORMS = Object.freeze(['ios', 'android', 'both']);
/** Signups from one network an hour and a day, and from everyone a day. */
export const WAITLIST_CAPS = Object.freeze({ netHour: 10, netDay: 30, all: 2000 });
/** The largest body read: a signup is far smaller. */
export const WAITLIST_BODY_MAX = 2048;
/** Where a plain form post is sent back to (the page's own address on this Worker). */
export const WAITLIST_PAGE = '/waitlist/';
const DAY = 864e5;

/** WAITLIST_LAUNCHED_AT as a YYYY-MM-DD day, or null when it is empty or not a day of the calendar. */
export function launchDay(env) {
  const d = String(env?.WAITLIST_LAUNCHED_AT ?? '').trim();
  return isDay(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d ? d : null;
}
/** Is the list closed (the launch day has come, in Jerusalem)? */
export const waitlistClosed = (env, now = new Date()) => { const d = launchDay(env); return !!d && d <= dayOf(now); };

/**
 * The rows to delete are those made before this instant: all of them once RETENTION.waitlistAfterLaunchDays have passed
 * since the start of the launch day (Jerusalem), else those older than RETENTION.waitlistMaxDays.
 */
export function waitlistCutoff(env, now = new Date()) {
  const d = launchDay(env);
  const done = d ? Date.parse(startOfDayIso(d)) + RETENTION.waitlistAfterLaunchDays * DAY : Infinity;
  return now.getTime() >= done ? now.toISOString() : new Date(now.getTime() - RETENTION.waitlistMaxDays * DAY).toISOString();
}
/** The night purge's statement (cron.js purgeRecordsSql). */
export const purgeWaitlistSql = (env, now = new Date()) => env.DB.prepare('DELETE FROM waitlist WHERE created_at < ?').bind(waitlistCutoff(env, now));

/** One utm value as a short label: NFKC, lower case, letters, digits, '.', '_' and '-' only, at most 30. */
const label = (v) => String(v ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, '').slice(0, 30);
/** utm_source and utm_campaign as one label ('instagram/launch'), or null when both are empty. */
export function cleanSource(source, campaign) {
  const s = label(source); const c = label(campaign);
  if (!s && !c) return null;
  return c ? `${s || '-'}/${c}` : s;
}

const pick = (list, v, code) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v);
  if (!list.includes(s)) throw new HttpError(400, code);
  return s;
};
/** platform as sent: one value, or both phones as a list (the form's two checkboxes) → 'ios' | 'android' | 'both' | null. */
export function cleanPlatform(v) {
  const list = (Array.isArray(v) ? v : [v]).filter((x) => x !== undefined && x !== null && x !== '');
  if (!list.length) return null;
  if (list.length > 2 || !list.every((x) => WAITLIST_PLATFORMS.includes(String(x)))) throw new HttpError(400, 'bad_platform');
  const set = new Set(list.map(String));
  return set.has('both') || (set.has('ios') && set.has('android')) ? 'both' : [...set][0];
}
const ticked = (v) => v === true || ['true', 'on', '1', 'yes'].includes(String(v ?? '').toLowerCase());

/** A signup's fields, checked: { email, role, grade, platform, source }. Throws 400 with what is wrong. */
export function cleanSignup(b) {
  const email = cleanEmail(b.email);
  const role = pick(WAITLIST_ROLES, b.role, 'bad_role');
  if (!role) throw new HttpError(400, 'bad_role');
  const grade = pick(WAITLIST_GRADES, b.grade === undefined || b.grade === null ? b.grade : String(b.grade), 'bad_grade');
  const platform = cleanPlatform(b.platform);
  if (!ticked(b.consent)) throw new HttpError(400, 'consent_needed');
  return { email, role, grade, platform, source: cleanSource(b.utm_source, b.utm_campaign) };
}

/** Is the request from this Worker's own page, an allowed origin, or no page at all (no Origin header)? */
export function originAllowed(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  if (origin === new URL(req.url).origin) return true;
  return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(origin);
}

const isForm = (req) => /^application\/x-www-form-urlencoded\b/i.test(req.headers.get('Content-Type') || '');
/** The body as fields: a JSON object, or a form's fields (a repeated field, such as two phones, as a list). */
function fields(raw, form) {
  if (form) {
    const p = new URLSearchParams(raw);
    const out = {};
    for (const k of new Set(p.keys())) { const all = p.getAll(k); out[k] = all.length > 1 ? all : all[0]; }
    return out;
  }
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { throw new HttpError(400, 'bad_json'); }
}

/** A plain form post goes back to the page, at the part that says what happened. */
const backTo = (part, cors) => new Response(null, { status: 303, headers: { ...cors, Location: `${WAITLIST_PAGE}#${part}`, 'Cache-Control': 'no-store' } });

/** POST /api/waitlist. */
export async function joinWaitlist(req, env, cors) {
  const form = isForm(req);
  try {
    await signup(req, env, form);
    return form ? backTo('joined', cors) : json({ ok: true }, 201, cors);
  } catch (e) {
    if (!form || !(e instanceof HttpError)) throw e;
    return backTo(e.code === 'waitlist_closed' ? 'closed' : 'oops', cors);
  }
}

async function signup(req, env, form) {
  if (!originAllowed(req, env)) throw new HttpError(403, 'bad_origin');
  if (waitlistClosed(env)) throw new HttpError(410, 'waitlist_closed');
  const b = fields(await rawBody(req, WAITLIST_BODY_MAX), form);
  // the honeypot: people never see the field, so whatever fills it is not a person. Same answer, nothing kept.
  if (String(b.website ?? '').trim()) return;
  const s = cleanSignup(b);
  const net = await netKey(req, env);
  const tooMany = new HttpError(429, 'too_many_signups', undefined, undefined, { 'Retry-After': '3600' });
  const r = await take(env, [
    key(`wait:n:${net}`, WAITLIST_CAPS.netHour, { period: 'hour', err: tooMany }),
    key(`wait:n:${net}:day`, WAITLIST_CAPS.netDay, { err: tooMany }),
    key('wait:all', WAITLIST_CAPS.all, { err: new HttpError(429, 'waitlist_busy', undefined, undefined, { 'Retry-After': '3600' }) }),
  ]);
  if (!r.ok) {
    // the day's ceiling for everyone: the owner hears of it once that day (an ad doing well, or a script)
    if (r.key?.who === 'wait:all') {
      const day = dayOf();
      await queueNotices(env, [ownerNotice(day, `owner:waitlist_cap:${day}`, { day, cap: WAITLIST_CAPS.all })]);
    }
    throw r.error;
  }
  const now = nowIso();
  await env.DB.prepare(`INSERT INTO waitlist (email, role, grade, platform, source, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (email) DO NOTHING`).bind(s.email, s.role, s.grade, s.platform, s.source, now, now).run();
}
