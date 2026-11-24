// The family challenge (PRODUCT2-39): safe pull with no strangers. A parent picks one small goal for a week on /parents
// (screens/parents/ChallengeCard.jsx) and sends it to the child as a link; the child opens it on their own device,
// accepts it (screens/FamilyOffer.jsx, store.js acceptChallenge) and sees it on the missions tab; its progress shows in
// the child's weekly summary and in what the parent reads (the /r link carries it as `fc`, lib/share.js; the synced
// report counts it from the device's own rows, screens/parents/FamilyReport.jsx).
//
// Like the weekly summary's /r link, the challenge travels in the link's # fragment, which no browser sends to a server:
// it works with no server and on the free tier, and nothing about it reaches us. The link carries a goal and a week and
// nothing else: no name and no free text, so a link from anyone can only ever offer "4 days of practice this week", and
// the child may decline it or let it go at any time.
//
// ChallengeLink v1: '1.' + base64url(JSON { v: 1, w: the week's Sunday 'YYYY-MM-DD', k: 'd' | 's', n }), where k 'd'
// counts practice days and 's' stages (a finished lesson, check or teaching stage: lib/streak.js weekTotals), and
// [k, n] is one of GOALS. decodeChallenge returns null on any deviation.
import { isRestDay } from '@shared/restDays.js';
import { weekStart, weekDays } from '@shared/week.js';
import { GOALS, KEEP_WEEKS, isDay, isGoal, keepWeeks } from './familyGoals.js';

// the goals, the check and the weeks kept are in lib/familyGoals.js, which the store reads in the first load
export { GOALS, KEEP_WEEKS, isGoal, keepWeeks };

export const CHALLENGE_V = 1;
export const CHALLENGE_PREFIX = '1.';
/**
 * Words the challenge never uses with a child (no countdown, no loss, no rush): the tests read every line against it.
 */
export const PRESSURE = /פספס|תפספסו|איבד|תאבדו|נשבר|נכשל|מהרו|נשאר(ו|ה)? רק|עוד \d+ ימים|לפני שייגמר|ייגמר|הזדמנות אחרונה/;

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const DAY_MS = 864e5;
const shift = (day, n) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10); };
/** 'YYYY-MM-DD' → '8.11'. */
export const dm = (day) => { const [, m, d] = String(day).split('-').map(Number); return `${d}.${m}`; };

/** '4 ימי תרגול' or '5 שלבים'. */
export const goalText = ({ k, n }) => (k === 'd' ? `${n} ימי תרגול` : `${n} שלבים`);
/** What one unit of the goal is, said once under it. */
export const unitHint = (k) => (k === 'd' ? 'יום תרגול הוא יום עם שיעור, שלב לימוד או בדיקה.' : 'שלב הוא שלב לימוד, שיעור או בדיקה.');

/** The week a goal picked on `today` is for: this week from Sunday to Wednesday, the next one from Thursday. */
export function challengeWeek(today) {
  const start = weekStart(today);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  return dow <= 3 ? start : shift(start, 7);
}

/**
 * The goals offered on `today`: a goal of days only when its week still has that many school days (from today, rest days
 * left out), so a parent is never offered a goal the child cannot meet; goals of stages always.
 */
export function goalsFor(today) {
  const w = challengeWeek(today);
  const left = weekDays(w).filter((d) => d >= today && !isRestDay(d)).length;
  return GOALS.filter((g) => g.k !== 'd' || g.n <= left);
}

// ------------------------------------------------------------------ the link

const toB64url = (ascii) => btoa(ascii).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

/** The link's payload: '1.' + base64url(JSON) of { v, w, k, n }. */
export function encodeChallenge({ w, k, n }) {
  return CHALLENGE_PREFIX + toB64url(JSON.stringify({ v: CHALLENGE_V, w, k, n }));
}

/** { w, k, n } from a payload, or null on any deviation (prefix, base64, JSON, a key, the week, the goal). */
export function decodeChallenge(s) {
  if (typeof s !== 'string' || !s.startsWith(CHALLENGE_PREFIX)) return null;
  const body = s.slice(CHALLENGE_PREFIX.length);
  if (!body || body.length > 200 || !B64URL_RE.test(body)) return null;
  let o;
  try { o = JSON.parse(fromB64url(body)); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const keys = Object.keys(o).sort().join(',');
  if (keys !== 'k,n,v,w' || o.v !== CHALLENGE_V || !isDay(o.w) || weekStart(o.w) !== o.w || !isGoal(o.k, o.n)) return null;
  return { w: o.w, k: o.k, n: o.n };
}

/** The whole link: the app's address and #/f/<payload>. */
export const challengeLink = (payload, base) => `${base}#/f/${payload}`;

/** The message the parent sends: the goal, its week, and the link, last and whole. No price, no name. */
export function challengeText({ w, k, n }, link) {
  return [
    `אתגר משפחתי במדרגות לשבוע ${dm(w)}–${dm(shift(w, 6))}: ${goalText({ k, n })}.`,
    'פותחים את הקישור בטלפון שבו מתרגלים, ומקבלים את האתגר:',
    link,
  ].join('\n');
}

// ------------------------------------------------------------------ progress

/**
 * How a challenge is going, from a week's own totals ({ days, stages }: lib/streak.js weekTotals, or a week report's
 * activeDays and lessons + stages): { have, n, done }.
 */
export function challengeProgress({ k, n }, totals) {
  const have = k === 'd' ? totals?.days || 0 : totals?.stages || 0;
  return { have, n, done: have >= n };
}

/** A week report's totals in the same two numbers (learn/report.ts WeekReport). */
export const reportTotals = (week) => ({ days: week?.activeDays || 0, stages: (week?.lessons || 0) + (week?.stages || 0) });

/** The accepted challenge for the week that starts on `week` ({ k, n } or null), from the store's family slice. */
export function challengeFor(family, week) {
  const c = family?.challenges?.[week];
  return c && isGoal(c.k, c.n) ? { k: c.k, n: c.n } : null;
}

/** A week report with its challenge, when there is one ({ ...week, challenge: { k, n } }). */
export const withChallenge = (week, ch) => (ch && isGoal(ch.k, ch.n) ? { ...week, challenge: { k: ch.k, n: ch.n } } : week);

/**
 * The challenge the missions tab shows on `today`: this week's, or else the next week's (accepted on a Thursday for the
 * week ahead), as { w, k, n, upcoming }; null when there is none. A challenge whose week ended is not shown.
 */
export function currentChallenge(family, today) {
  const w = weekStart(today);
  const now = challengeFor(family, w);
  if (now) return { w, ...now, upcoming: false };
  const next = shift(w, 7);
  const later = challengeFor(family, next);
  return later ? { w: next, ...later, upcoming: true } : null;
}
