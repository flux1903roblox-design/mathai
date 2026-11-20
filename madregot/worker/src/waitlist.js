// The waitlist for the store apps. The owner advertises the public page /waitlist/ (and its short alias /w/, built by
// web/scripts/landing-build.mjs from web/landing/waitlist.html) and publishes the iPhone and Android apps if enough
// people join. POST /api/waitlist takes one signup, from a parent or a teacher (an adult: students are not asked for an
// email anywhere in the app, so the page tells them to send the link to a parent):
//
//   { email, role: 'parent' | 'teacher', grade?: '7' | '8', platform?: 'ios' | 'android' | 'both',
//     consent: true, utm_source?, utm_campaign?, website? }
//
// as JSON from the page's script, or as a plain form post (application/x-www-form-urlencoded) when the script did not
// run; then the answer is a 303 back to the page (/waitlist/#joined, #closed, #busy or #oops) instead of JSON.
//
// Not before the notice is whole: while CONTACT_EMAIL or BUSINESS_NAME is empty, the privacy notice behind the form
// names no one to write to (who holds the list, how to leave it), so every signup is refused with 503 waitlist_not_ready
// and landing-build puts a "not open yet" note where the form would be (waitlistMissing, both sides).
//
// What is kept is the table `waitlist` and nothing else: the email as account.js cleanEmail leaves it (one row per
// address), role, grade, platform, a short source label from the ad's utm_source/utm_campaign, and when; sent_at and
// tries of the launch email. No name, no network address, no device, no free text. consent is required: the box
// "אפשר לשלוח לי מייל אחד כשהאפליקציה יוצאת לחנויות" is the only use the row has. role says the signup is from an adult
// (and counts the list by audience); grade and phone are counts for the owner.
//
// The same answer for every accepted signup, new or repeated: 201 { ok: true }, and a repeated address changes nothing,
// so nobody can learn from the answer (or its timing: both run the same INSERT … ON CONFLICT DO NOTHING) whether an
// address is on the list. Nothing sent is echoed back. The field `website` is a honeypot, hidden from people: a request
// that fills it gets the same 201 and nothing is stored.
//
// Limits, counted before anything is stored (util.js take, all or nothing): WAITLIST_CAPS.netHour signups an hour and
// netDay a day from one network, an IPv6 address by its /48 (netKey wide: one allocation holds many /64s), keyed by an
// HMAC of it, never the address; past one, 429 too_many_signups and nothing stored. Everyone's signups of the day are
// counted too, but never refused: one script could otherwise close the list to everyone from a few dozen addresses. At
// WAITLIST_CAPS.notice in a day the owner gets one notice (an ad doing well, or a script). In front of them, the edge
// limiter's RL_WRITE binding (edge.js), keyed by the network; it runs inside this handler, so a plain form post it
// refuses goes back to the page too. A request from a page on another origin (its Origin header is not this Worker's
// own address and not in ALLOWED_ORIGINS) is refused with 403: a plain form post needs no CORS preflight, so this is
// what keeps other sites from posting addresses here.
//
// Once WAITLIST_LAUNCHED_AT (YYYY-MM-DD, Jerusalem) is set and that day has come, the list is closed (410
// waitlist_closed), and every row is deleted RETENTION.waitlistAfterLaunchDays after it; a row is deleted
// RETENTION.waitlistMaxDays after its signup in any case (purgeWaitlistSql, run by cron.js purgeRecordsSql).
//
// The launch email (sendLaunch, from the hourly cron): once the list is closed and APP_STORE_URL or PLAY_STORE_URL is
// set, the Worker sends the one email itself, through Resend (email.js, the processor the privacy notice names), one
// message per address: "פרסומת" at the start of the subject (Communications Law s.30A), the business name and address,
// the store links, and a removal link of its own (GET /api/waitlist/leave?w=&t= a page with one button, POST removes the
// row; RFC 8058 one-click headers too). Nothing is sent while any of launchMissing() is empty. The owner reads counts
// with scripts/owner.mjs (waitlist), removes a person who asks (waitlist --remove E; forget --email E too); an account
// deleted with the same email takes its row along (billing.js forgetAccount).
import { HttpError, json, nowIso, netKey, key, take, rawBody, dayOf, isDay, startOfDayIso, hmacHex, safeEqual } from './util.js';
import { cleanEmail } from './account.js';
import { ownerNotice, queueNotices } from './spend.js';
import { edgeGuard } from './edge.js';
import { emailReady, escapeHtml, sendBatch, BATCH_MAX, business } from './email.js';
import { unsubPage } from './report.js';
import { RETENTION } from '../../shared/retention.js';

/** Who may join: adults only (a parent or a teacher). The app never asks a student for an email. */
export const WAITLIST_ROLES = Object.freeze(['parent', 'teacher']);
export const WAITLIST_GRADES = Object.freeze(['7', '8']);
export const WAITLIST_PLATFORMS = Object.freeze(['ios', 'android', 'both']);
/**
 * Signups from one network (an IPv6 /48) an hour and a day; and the day's count of everyone's at which the owner hears
 * of it once (never a refusal). A class shares one school address and Israeli carriers put many phones behind one IPv4
 * address, so a network's caps are wide; the edge limiter (60 a minute) is there for floods.
 */
export const WAITLIST_CAPS = Object.freeze({ netHour: 60, netDay: 300, notice: 2000 });
/** The settings without which the list takes no signup: who holds the list and where to write to leave it. */
export const WAITLIST_NEEDS = Object.freeze(['CONTACT_EMAIL', 'BUSINESS_NAME']);
/** The largest body read: a signup is far smaller. */
export const WAITLIST_BODY_MAX = 2048;
/** Where a plain form post is sent back to (the page's own address on this Worker). */
export const WAITLIST_PAGE = '/waitlist/';
const DAY = 864e5;
const isEmailish = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '').trim());

/** The WAITLIST_NEEDS that are empty (CONTACT_EMAIL must also look like an address): [] when the list may open. */
export function waitlistMissing(env) {
  return WAITLIST_NEEDS.filter((name) => (name === 'CONTACT_EMAIL' ? !isEmailish(env?.[name]) : !String(env?.[name] ?? '').trim()));
}

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
/**
 * Where a refused plain form post lands: #closed after the launch; #busy when trying again later can work (a limit, the
 * list not open yet, a fault of ours); #oops when something in the form itself was refused.
 */
export function formPart(e) {
  if (e instanceof HttpError && e.code === 'waitlist_closed') return 'closed';
  if (!(e instanceof HttpError) || e.status === 429 || e.status >= 500) return 'busy';
  return 'oops';
}

/** POST /api/waitlist. */
export async function joinWaitlist(req, env, cors) {
  const form = isForm(req);
  try {
    await signup(req, env, form);
    return form ? backTo('joined', cors) : json({ ok: true }, 201, cors);
  } catch (e) {
    if (!form) throw e;
    if (!(e instanceof HttpError)) console.error('waitlist', e?.message || e);
    return backTo(formPart(e), cors);
  }
}

async function signup(req, env, form) {
  // the edge limiter first (index.js routes this path before its own edgeGuard, so a refused form post comes back here)
  await edgeGuard('POST', '/api/waitlist', req, env);
  if (!originAllowed(req, env)) throw new HttpError(403, 'bad_origin');
  if (waitlistClosed(env)) throw new HttpError(410, 'waitlist_closed');
  if (waitlistMissing(env).length) throw new HttpError(503, 'waitlist_not_ready');
  const b = fields(await rawBody(req, WAITLIST_BODY_MAX), form);
  // the honeypot: people never see the field, so whatever fills it is not a person. Same answer, nothing kept.
  if (String(b.website ?? '').trim()) return;
  const s = cleanSignup(b);
  const net = await netKey(req, env, { wide: true });
  const tooMany = new HttpError(429, 'too_many_signups', undefined, undefined, { 'Retry-After': '3600' });
  const r = await take(env, [
    key(`wait:n:${net}`, WAITLIST_CAPS.netHour, { period: 'hour', err: tooMany }),
    key(`wait:n:${net}:day`, WAITLIST_CAPS.netDay, { err: tooMany }),
    // everyone's day: counted, never refused (no limit a count can reach)
    key('wait:all', Number.MAX_SAFE_INTEGER),
  ]);
  if (!r.ok) throw r.error;
  // the owner hears once, the signup that reaches the day's notice count (an ad doing well, or a script)
  if (r.counts[2] === WAITLIST_CAPS.notice) {
    const day = dayOf();
    await queueNotices(env, [ownerNotice(day, `owner:waitlist_many:${day}`, { day, signups: WAITLIST_CAPS.notice })]);
  }
  const now = nowIso();
  await env.DB.prepare(`INSERT INTO waitlist (email, role, grade, platform, source, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (email) DO NOTHING`).bind(s.email, s.role, s.grade, s.platform, s.source, now, now).run();
}

// ---------------------------------------------------------------- the launch email (Communications Law s.30A)
/** The store settings the launch email links to: https addresses only. */
export const STORE_LINKS = Object.freeze([['APP_STORE_URL', 'iPhone', 'App Store'], ['PLAY_STORE_URL', 'Android', 'Google Play']]);
const httpsUrl = (v) => { const t = String(v ?? '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(t) ? t : ''; };
/** The store links that are set: [{ url, phone, store }]. */
export const storeLinks = (env) => STORE_LINKS.map(([name, phone, store]) => ({ url: httpsUrl(env?.[name]), phone, store })).filter((l) => l.url);
/** Messages sent in one cron run (two of Resend's batch calls); a failed call stops the run, and the next hour goes on. */
export const LAUNCH_PER_RUN = 100;
/** Hourly tries of one address before it is left out (a day of them: a quota that ran out comes back). */
export const LAUNCH_MAX_TRIES = 24;

/**
 * What the launch email still needs, by setting name: [] when it may go. The list closed (WAITLIST_LAUNCHED_AT has come),
 * a store link, Resend (RESEND_API_KEY, EMAIL_FROM), AUTH_SECRET (the removal tokens), PUBLIC_URL over https (the removal
 * link) and the advertiser's details the law asks for in the message: BUSINESS_NAME, BUSINESS_ADDRESS, CONTACT_EMAIL.
 */
export function launchMissing(env, now = new Date()) {
  const out = [];
  if (!waitlistClosed(env, now)) out.push('WAITLIST_LAUNCHED_AT');
  if (!storeLinks(env).length) out.push('APP_STORE_URL or PLAY_STORE_URL');
  if (!emailReady(env)) out.push('RESEND_API_KEY and EMAIL_FROM');
  if (!env?.AUTH_SECRET) out.push('AUTH_SECRET');
  if (!httpsUrl(env?.PUBLIC_URL)) out.push('PUBLIC_URL');
  for (const name of ['BUSINESS_NAME', 'BUSINESS_ADDRESS']) if (!String(env?.[name] ?? '').trim()) out.push(name);
  if (!isEmailish(env?.CONTACT_EMAIL)) out.push('CONTACT_EMAIL');
  return out;
}

/** The removal token of a row: HMAC(AUTH_SECRET, 'waitlist-leave:v1:<id>:<email>'), 32 hex characters. */
export const leaveToken = async (env, id, email) => (await hmacHex(env.AUTH_SECRET, `waitlist-leave:v1:${id}:${email}`)).slice(0, 32);
export const leaveUrl = async (env, row) => `${httpsUrl(env.PUBLIC_URL).replace(/\/+$/, '')}/api/waitlist/leave?w=${row.id}&t=${await leaveToken(env, row.id, row.email)}`;

/** Hebrew text as HTML: each run of digits or Latin letters (and an address) isolated left to right, the rest escaped. */
export function ltrHtml(text) {
  const RUN = /https?:\/\/\S+|[\w.+-]+@[\w.-]+\.\w+|\d[\d,.]*%?|[A-Za-z]+(?:[ -][A-Za-z]+)*/g;
  let out = ''; let at = 0;
  for (const m of String(text).matchAll(RUN)) {
    out += escapeHtml(text.slice(at, m.index)) + `<bdi dir="ltr">${escapeHtml(m[0])}</bdi>`;
    at = m.index + m[0].length;
  }
  return out + escapeHtml(String(text).slice(at));
}

export const LAUNCH_TEXT = {
  // s.30A(e)(1): the word "פרסומת" at the start of the subject (the lawyer may answer otherwise: SUBSCRIPTION.md)
  subject: (links) => `פרסומת: מדרגות יצאה ל־${links.map((l) => l.phone).join(' ול־')}`,
  hello: 'שלום,',
  why: 'נרשמתם לרשימת ההמתנה של מדרגות, וביקשתם מייל אחד כשהאפליקציה יוצאת לחנויות. היא יצאה:',
  link: (l) => `ל־${l.phone} (${l.store}):`,
  once: `זה המייל היחיד מהרשימה. הכתובת שלכם תימחק מהרשימה בתוך ${RETENTION.waitlistAfterLaunchDays} יום.`,
  leave: 'לא רוצים לקבל מאיתנו מיילים? להסרה מהרשימה עכשיו:',
  reply: (contact) => `אפשר גם לכתוב לנו ל־${contact} ולבקש להסיר את הכתובת.`,
};

/**
 * One address's launch email: the text and HTML parts, and the RFC 8058 headers. The footer is the advertiser's name,
 * id, address and contact (email.js business, s.30A(e)(1)(b)).
 */
export function launchMessage(env, { to, leave, links = storeLinks(env) }) {
  const foot = business(env);
  const T = LAUNCH_TEXT;
  const text = [T.hello, '', T.why, ...links.map((l) => `${T.link(l)} ${l.url}`), '', T.once, '', `${T.leave} ${leave}`, T.reply(env.CONTACT_EMAIL), '', foot].join('\n');
  const a = (href, label) => `<a href="${escapeHtml(href)}" dir="ltr" style="color:#1246c4">${escapeHtml(label)}</a>`;
  const P = 'margin:0 0 10px'; const FOOT = 'margin:0 0 6px;font-size:14px;line-height:21px;color:#565b66';
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#14161a">
<p style="${P}">${ltrHtml(T.hello)}</p>
<p style="${P}">${ltrHtml(T.why)}</p>
${links.map((l) => `<p style="${P}">${ltrHtml(T.link(l))} ${a(l.url, l.url)}</p>`).join('\n')}
<p style="${P}">${ltrHtml(T.once)}</p>
<p style="${FOOT}">${ltrHtml(T.leave)} ${a(leave, 'להסרה')}</p>
<p style="${FOOT}">${ltrHtml(T.reply(env.CONTACT_EMAIL))}</p>
<p style="${FOOT}">${foot.split(' · ').map((x) => `<span style="white-space:nowrap">${ltrHtml(x)}</span>`).join(' · ')}</p>
</div>`;
  return {
    to, subject: T.subject(links), text, html,
    headers: { 'List-Unsubscribe': `<${leave}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

/**
 * The hourly cron's step: once launchMissing(env) is empty, the launch email to up to LAUNCH_PER_RUN addresses not sent
 * yet, through Resend's batch call; each sent row gets sent_at, a failed call a try on each of its rows and the end of
 * this run. Returns { sent, failed, waiting } (waiting: why nothing is sent, the missing settings).
 */
export async function sendLaunch(env, { now = new Date(), limit = LAUNCH_PER_RUN } = {}) {
  const missing = launchMissing(env, now);
  if (missing.length) return { sent: 0, failed: 0, waiting: missing };
  const rows = (await env.DB.prepare('SELECT id, email FROM waitlist WHERE sent_at IS NULL AND tries < ? ORDER BY id LIMIT ?')
    .bind(LAUNCH_MAX_TRIES, limit).all()).results || [];
  const links = storeLinks(env);
  let sent = 0; let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH_MAX) {
    const group = rows.slice(i, i + BATCH_MAX);
    const ids = JSON.stringify(group.map((r) => r.id));
    const msgs = await Promise.all(group.map(async (r) => launchMessage(env, { to: r.email, leave: await leaveUrl(env, r), links })));
    try {
      await sendBatch(env, msgs);
    } catch {
      await env.DB.prepare('UPDATE waitlist SET tries = tries + 1 WHERE id IN (SELECT value FROM json_each(?))').bind(ids).run();
      failed += group.length;
      break;
    }
    await env.DB.prepare('UPDATE waitlist SET sent_at = ? WHERE id IN (SELECT value FROM json_each(?))').bind(now.toISOString(), ids).run();
    sent += group.length;
  }
  return { sent, failed, waiting: [] };
}

// ---------------------------------------------------------------- the removal link (RFC 8058)
/** Removal pages a network may open a day. */
export const LEAVE_DAILY = 200;
export const LEAVE_TEXT = {
  askTitle: 'להסיר את הכתובת מרשימת ההמתנה?',
  askText: 'אחרי שתלחצו, הכתובת שלכם תימחק מהרשימה ולא יגיעו ממנה עוד מיילים.',
  button: 'כן, להסיר',
  doneTitle: 'הכתובת הוסרה מהרשימה',
  done: 'לא יגיעו עוד מיילים מרשימת ההמתנה של מדרגות.',
  badTitle: 'הקישור לא תקין',
  bad: 'אפשר לכתוב לנו ולבקש להסיר את הכתובת.',
  busyTitle: 'יותר מדי בקשות',
  busy: 'היו היום יותר מדי בקשות מהרשת הזאת. אפשר לנסות שוב מחר.',
  home: 'לאתר של מדרגות',
};
const leavePage = (env, status, opts) => unsubPage(env, status, { button: LEAVE_TEXT.button, home: '/', homeLabel: LEAVE_TEXT.home, ...opts });
async function leaveLimit(req, env) {
  return (await take(env, [key(`wleave:n:${await netKey(req, env)}`, LEAVE_DAILY, { err: new HttpError(429, 'slow_down') })])).ok;
}
/** The link's row, checked in equal time: { id } when the token is right (the row may be gone since), else null. */
async function leaveWho(req, env) {
  const q = new URL(req.url).searchParams;
  const id = String(q.get('w') || ''); const tok = String(q.get('t') || '');
  if (!env.AUTH_SECRET || !/^\d{1,15}$/.test(id) || !/^[a-f0-9]{32}$/.test(tok)) return null;
  const row = await env.DB.prepare('SELECT id, email FROM waitlist WHERE id = ?').bind(Number(id)).first();
  // a row already removed: the link did its work (the same page as a removal, nothing to find)
  if (!row) return { id: Number(id), gone: true };
  return safeEqual(await leaveToken(env, row.id, row.email), tok) ? { id: row.id } : null;
}
/** GET /api/waitlist/leave?w=&t=: the question and one button. It changes nothing (mail scanners open links). */
export async function leaveGet(req, env) {
  if (!(await leaveLimit(req, env))) return leavePage(env, 429, { title: LEAVE_TEXT.busyTitle, text: LEAVE_TEXT.busy });
  const who = await leaveWho(req, env);
  if (!who) return leavePage(env, 400, { title: LEAVE_TEXT.badTitle, text: LEAVE_TEXT.bad });
  if (who.gone) return leavePage(env, 200, { title: LEAVE_TEXT.doneTitle, text: LEAVE_TEXT.done });
  return leavePage(env, 200, { title: LEAVE_TEXT.askTitle, text: LEAVE_TEXT.askText, form: true });
}
/**
 * POST /api/waitlist/leave?w=&t=: the button, or a mail program's one-click request (RFC 8058). The body is read and
 * ignored: the token in the URL decides. The row is deleted; the audit row names no address.
 */
export async function leavePost(req, env) {
  await rawBody(req, 4096);
  if (!(await leaveLimit(req, env))) return leavePage(env, 429, { title: LEAVE_TEXT.busyTitle, text: LEAVE_TEXT.busy });
  const who = await leaveWho(req, env);
  if (!who) return leavePage(env, 400, { title: LEAVE_TEXT.badTitle, text: LEAVE_TEXT.bad });
  if (!who.gone) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM waitlist WHERE id = ?').bind(who.id),
      env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)').bind(nowIso(), 'waitlist:leave', 'waitlist.remove', 'waitlist', JSON.stringify({ via: 'email' })),
    ]);
  }
  return leavePage(env, 200, { title: LEAVE_TEXT.doneTitle, text: LEAVE_TEXT.done });
}
