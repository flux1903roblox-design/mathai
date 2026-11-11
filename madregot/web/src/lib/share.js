// "הסיכום השבועי" sent to a parent with no account (PARENTS-2). The week travels in the link's # fragment, which no
// browser sends to any server (nor in a Referer), so the report never reaches us. The child's first name may be in the
// message text the child sends from their own phone, and is never in the link.
//
// WeekShare v1, what the link carries. Keys are whitelisted and ASCII only (ids and numbers), so btoa is safe:
//   { v: 1, w: '2026-11-08' (a Sunday), e: '2026-11-14' (w + 6),
//     dd: [1,1,0,1,1,0,2]   per day Sun..Sat: 0 none, 1 practised, 2 rest day, 3 not yet (a day after the one it was sent)
//     m, q, ls, st, rv, sr  the week's minutes, questions, lessons and checks, teaching stages, reviews, streak
//     sk, ma                stairs worked on and stairs that passed a mastery check, newest first, at most 12 each
//     fx?                   [[skill, mistake, 'o' | 'd']], at most 8: left out when the child unticks the repairs
//     ex? }                 an exam ahead: { d, n mastered of its stairs, of }
// Ranges are per week (a day's rows are capped by the engine, learn/report.ts): m ≤ 4200, q ≤ 14000, ls/st/rv ≤ 1400.
// decodeShare returns null on any deviation, so /r never renders a guess. The link is not tamper-proof (a child could
// edit it as they could edit a note), and the /r page says the child made and sent it.
import { weekDays, weekStart, isSaturday, stairName, he, withPrefix } from '@/learn/report.ts';

export const SHARE_V = 1;
export const SHARE_PREFIX = '1.';
/** The longest wa.me address WhatsApp is given (text and link, URL-encoded); the link itself is never cut. */
export const WA_MAX = 4096;
const MAX_STAIRS = 12;
const MAX_FIXES = 8;
const KEYS = ['v', 'w', 'e', 'dd', 'm', 'q', 'ls', 'st', 'rv', 'sr', 'sk', 'ma', 'fx', 'ex'];
const REQUIRED = ['v', 'w', 'e', 'dd', 'm', 'q', 'ls', 'st', 'rv', 'sr', 'sk', 'ma'];
const LIMITS = { m: 4200, q: 14000, ls: 1400, st: 1400, rv: 1400, sr: 3650 };
export const SKILL_RE = /^[a-z]{2,8}:\d{1,2}$/;
export const MISTAKE_RE = /^[a-z0-9-]{1,30}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

/** A real calendar day 'YYYY-MM-DD' (2026-02-30 is not one). */
export const isDay = (s) => typeof s === 'string' && DAY_RE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const isPlain = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;

// ------------------------------------------------------------------ the week → the link

/** A day of the strip as one digit: practised wins; then a day after the sending day; then a rest day. */
const dayCode = (day) => (day.on ? 1 : day.future ? 3 : day.rest ? 2 : 0);

/** The week's list in the order the report shows it, newest first (the order of first appearance, reversed). */
export const newestFirst = (list) => [...(list || [])].reverse();

/** The repairs as the link carries them: the open ones first (the newest snapshot), then those resolved this week. */
export function fixesOf(week) {
  const open = (week.open || []).map(([s, m]) => [s, m, 'o']);
  const done = (week.fixed || []).map(([s, m]) => [s, m, 'd']);
  return [...open, ...done].slice(0, MAX_FIXES);
}

/** The WeekShare object of a week report (learn/report.ts WeekReport). */
export function shareOf(week, { includeFixes = true } = {}) {
  const share = {
    v: SHARE_V,
    w: week.start,
    e: week.end,
    dd: week.days.map(dayCode),
    m: Math.min(LIMITS.m, week.minutes),
    q: Math.min(LIMITS.q, week.questions),
    ls: Math.min(LIMITS.ls, week.lessons),
    st: Math.min(LIMITS.st, week.stages),
    rv: Math.min(LIMITS.rv, week.reviews),
    sr: Math.min(LIMITS.sr, week.streak),
    sk: newestFirst(week.worked).slice(0, MAX_STAIRS),
    ma: newestFirst(week.mastered).slice(0, MAX_STAIRS),
  };
  const fx = fixesOf(week);
  if (includeFixes && fx.length) share.fx = fx;
  if (week.exam) share.ex = { d: week.exam.d, n: week.exam.n, of: week.exam.of };
  return share;
}

const toB64url = (ascii) => btoa(ascii).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

/** The link's payload: '1.' + base64url(JSON) of the week's WeekShare. */
export function encodeShare(week, { includeFixes = true } = {}) {
  return SHARE_PREFIX + toB64url(JSON.stringify(shareOf(week, { includeFixes })));
}

/** The whole link: the app's address and #/r/<payload>, never with a name. `base` is the app's address. */
export function shareLink(payload, base) {
  return `${base}#/r/${payload}`;
}

/** The address of this copy of the app (its base path, without the # route or a query such as a QA state). */
export function appBase() {
  return new URL(import.meta.env.BASE_URL || './', window.location.href.split('#')[0]).href;
}

// ------------------------------------------------------------------ the link → the week

const skills = (v) => Array.isArray(v) && v.length <= MAX_STAIRS && v.every((s) => typeof s === 'string' && SKILL_RE.test(s)) && new Set(v).size === v.length;
const fix = (f) => Array.isArray(f) && f.length === 3 && typeof f[0] === 'string' && SKILL_RE.test(f[0]) && typeof f[1] === 'string' && MISTAKE_RE.test(f[1]) && (f[2] === 'o' || f[2] === 'd');
const exam = (x) => isPlain(x) && Object.keys(x).length === 3 && isDay(x.d) && isInt(x.of, 1, 60) && isInt(x.n, 0, x.of);

/** Is this object exactly a WeekShare v1: the whitelisted keys, each in its range? */
export function validShare(o) {
  if (!isPlain(o)) return false;
  const keys = Object.keys(o);
  if (keys.some((k) => !KEYS.includes(k)) || REQUIRED.some((k) => !Object.hasOwn(o, k))) return false;
  if (o.v !== SHARE_V || !isDay(o.w) || !isDay(o.e) || weekStart(o.w) !== o.w || weekDays(o.w)[6] !== o.e) return false;
  if (!Array.isArray(o.dd) || o.dd.length !== 7 || !o.dd.every((x) => isInt(x, 0, 3))) return false;
  if (!Object.entries(LIMITS).every(([k, hi]) => isInt(o[k], 0, hi))) return false;
  if (!skills(o.sk) || !skills(o.ma)) return false;
  if (Object.hasOwn(o, 'fx') && !(Array.isArray(o.fx) && o.fx.length <= MAX_FIXES && o.fx.every(fix))) return false;
  if (Object.hasOwn(o, 'ex') && !exam(o.ex)) return false;
  return true;
}

/** The WeekShare in a payload, or null on any deviation (prefix, base64, JSON, a key or a range). */
export function decodeShare(s) {
  if (typeof s !== 'string' || !s.startsWith(SHARE_PREFIX)) return null;
  const body = s.slice(SHARE_PREFIX.length);
  if (!body || body.length > 4000 || !B64URL_RE.test(body)) return null;
  let o;
  try { o = JSON.parse(fromB64url(body)); } catch { return null; }
  return validShare(o) ? o : null;
}

/**
 * A decoded share as a week report, for the one renderer (components/report/ReportView.jsx). The link carries no
 * per-day minutes. Its repairs are as of the day it was sent: the last day of the strip that is not "not yet".
 * `isRest` marks a rest day the child had not reached yet (a Shabbat after the sending day).
 */
export function weekFromShare(o, isRest = isSaturday) {
  const days = weekDays(o.w);
  const fx = o.fx || [];
  const sent = o.dd.reduce((at, x, i) => (x !== 3 ? i : at), -1);
  return {
    start: o.w,
    end: o.e,
    days: days.map((d, i) => ({ d, on: o.dd[i] === 1, rest: o.dd[i] === 2 || (o.dd[i] === 3 && !!isRest(d)), future: o.dd[i] === 3, m: 0 })),
    activeDays: o.dd.filter((x) => x === 1).length,
    minutes: o.m, questions: o.q, lessons: o.ls, stages: o.st, reviews: o.rv,
    // the report shows its lists newest first; a WeekReport keeps them in the order they first appeared
    worked: newestFirst(o.sk),
    mastered: newestFirst(o.ma),
    open: fx.filter((f) => f[2] === 'o').map((f) => [f[0], f[1]]),
    openAt: sent >= 0 ? days[sent] : null,
    fixed: fx.filter((f) => f[2] === 'd').map((f) => [f[0], f[1]]),
    streak: o.sr,
    exam: o.ex ? { ...o.ex } : null,
    empty: !(o.q > 0 || o.ls > 0 || o.st > 0 || o.m > 0),
  };
}

// ------------------------------------------------------------------ the message the child sends

/** 'YYYY-MM-DD' → '8.11' (day.month, as dates are written in Israel). */
export const dm = (day) => { const [, m, d] = String(day).split('-').map(Number); return `${d}.${m}`; };

/** The wa.me address of a message (what the WhatsApp button opens). */
export const waHref = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Up to `max` names, then ' ועוד k'. */
function names(list, max) {
  const shown = list.slice(0, Math.max(0, max)).map((s) => stairName(s));
  const more = list.length - shown.length;
  if (!shown.length) return more > 0 ? he.stairs(more) : '';
  return `${shown.join(', ')}${more > 0 ? ` ועוד ${more}` : ''}`;
}

function compose(week, { name, link, includeFixes }, worked, mastered) {
  const n = week.activeDays; const m = week.minutes; const k = week.mastered.length;
  const title = name ? `הסיכום השבועי של ${name} במדרגות` : 'הסיכום השבועי שלי במדרגות';
  const lines = [`${title} (${dm(week.start)}–${dm(week.end)}):`];
  if (n > 0) lines.push(`• תרגלתי ${he.days(n)}${m > 0 ? `, בערך ${he.minutes(m)}` : ''}`);
  else lines.push(m > 0 ? `• תרגלתי השבוע בערך ${he.minutes(m)}` : '• התחלתי לתרגל השבוע');
  lines.push(k > 0 ? `• עברתי בדיקת שליטה ${withPrefix('ב', he.stairs(k))}: ${names(newestFirst(week.mastered), mastered)}` : '• השבוע עוד לא הייתה בדיקת שליטה');
  if (week.worked.length) lines.push(`• תרגלתי: ${names(newestFirst(week.worked), worked)}`);
  const o = week.open.length;
  if (includeFixes && o > 0) lines.push(`• בתיקון עכשיו: ${o === 1 ? 'טעות אחת שחוזרת' : `${he.mistakes(o)} שחוזרות`}`);
  if (week.streak > 0) lines.push(`• רצף: ${he.days(week.streak)}`);
  lines.push(`לסיכום המלא: ${link}`);
  return lines.join('\n');
}

// the "תרגלתי" line first gives up its third name; a longer message gives up mastered names too, never the link
const FITS = [[3, Infinity], [2, Infinity], [2, 6], [2, 3], [1, 1], [0, 0]];

/**
 * The message the child sends, in the first person (Hebrew first-person past is the same for a girl and a boy).
 * `name` (the profile's) appears only here, and only in the first line; `link` goes last, whole. The wa.me address of
 * the message stays within WA_MAX: when it would not, fewer stair names are listed.
 */
export function shareText(week, { name = '', link, includeFixes = true } = {}) {
  const who = String(name || '').replace(/\s+/g, ' ').trim();
  let text = '';
  for (const [worked, mastered] of FITS) {
    text = compose(week, { name: who, link, includeFixes }, worked, mastered);
    if (waHref(text).length <= WA_MAX) return text;
  }
  return text;
}
