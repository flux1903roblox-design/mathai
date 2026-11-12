// The report engine (PARENTS-1): one pure module that every report surface renders through: the child's weekly
// summary, the /r link, /parents and the Sunday email (the Worker uses shared/week.js, re-exported here). No React and
// no store: it takes plain slices (days, learn) and a clock.
//
// A DaySummary is the single wire shape, a strict whitelist of codes and counts (no name, no free text, no answers):
//   v   1
//   d   the device's local day, 'YYYY-MM-DD'
//   m   minutes on learning screens, floor(max(tsecs, secs) / 60), at most 600: tsecs is the learning clock
//       (lib/learnClock.js), secs the answer time; a day before the clock (or the day it ships) still shows its answers
//   q   questions answered (days[d].q)                  ls  lessons and checks finished (days[d].lessons)
//   st  teaching stages finished (days[d].stages)        rv  review checks passed that day
//   sk  stairs worked on that day (newest first, ≤ 12)   ma  stairs that passed a mastery check that day (≤ 12)
//   fx  mistakes [skill, id, state]: 'o' open (confirmed or being repaired, the top 5 by score) only on today's own
//       summary, since a past day cannot know what was open then; 'd' resolved by a repair that day (≤ 3)
//   sr  the streak at the end of that day                ex  an exam ahead: { d, n mastered of its stairs, of }
// Every number has an honest source: mastery only from passed mastery checks (never practice), repairs only from the
// misconception engine, time only as time on learning screens (never called learning).
import type { LearnEvent, LearnState, SkillId } from './types';
import { openMisconceptions } from './misconceptions';
import { masteryState } from './mastery';
import { metaOf } from './content/index';
import { TOPIC } from '@/content/topics.js';
import { streakOf } from '@/lib/days.js';
import { weekStart, weekDays, weekFrom, isSaturday } from '@shared/week.js';
import { stairName as sharedStairName } from '@shared/stairs.js';
import { texToPlain } from '@shared/plain.js';

export { weekStart, weekDays, weekFrom, isSaturday };

export const REPORT_V = 1;
export type FixState = 'o' | 'd';
export interface ExamAhead { d: string; n: number; of: number }
export interface DaySummary {
  v: 1;
  d: string;
  m: number;
  q: number;
  ls: number;
  st: number;
  sk: string[];
  ma: string[];
  rv: number;
  fx: [string, string, FixState][];
  sr: number;
  ex?: ExamAhead | null;
}
export interface WeekDay { d: string; on: boolean; rest: boolean; future: boolean; m: number }
export interface WeekReport {
  start: string; end: string;
  days: WeekDay[];
  activeDays: number; minutes: number; questions: number; lessons: number; stages: number; reviews: number;
  worked: string[]; mastered: string[];
  open: [string, string][];
  openAt: string | null;
  fixed: [string, string][];
  streak: number;
  exam: ExamAhead | null;
  empty: boolean;
}
/** The keys a DaySummary may have, and nothing else (the whitelist test reads it). */
export const SUMMARY_KEYS = ['v', 'd', 'm', 'q', 'ls', 'st', 'sk', 'ma', 'rv', 'fx', 'sr', 'ex'] as const;

/** One saved day, as the store keeps it (lib/store.js). */
export interface DayRec { q?: number; secs?: number; tsecs?: number; lessons?: number; stages?: number; [field: string]: unknown }
export interface ReportInput { days: Record<string, DayRec>; learn: LearnState }
/** today: the device's day; now: an ISO time (mastery's review dates are compared with it). */
export interface ReportClock { today: string; now: string }

export const MAX_MINUTES = 600;
const MAX_STAIRS = 12;
const MAX_OPEN = 5;
const MAX_FIXED = 3;
/** The events that say a stair was worked on. */
const WORK_EVENTS = new Set(['answer', 'stage-A', 'stage-B', 'stage-C', 'lesson-done', 'check-done', 'repair-start', 'repair-done']);

/**
 * The local day of an event time. Event times are UTC ISO strings: an answer at 01:30 in Israel is on the day after
 * its UTC date, so the day is the device's own, as store.js today() writes it (never analytics.ts's UTC slice).
 */
export const localDay = (t: string): string => new Date(t).toLocaleDateString('en-CA');

const count = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);
const add = (list: string[], s: string | undefined) => { if (s && !list.includes(s)) list.push(s); };

/** One day of a child's learning as the wire shape (see the top of this file). */
export function daySummary(input: ReportInput, day: string, ctx: ReportClock): DaySummary {
  const rec: DayRec = input.days?.[day] || {};
  const events: LearnEvent[] = (input.learn?.events || []).filter((e) => e && typeof e.t === 'string' && localDay(e.t) === day);
  const newestFirst = [...events].reverse();

  const sk: string[] = [];
  const ma: string[] = [];
  const fixed: [string, string, FixState][] = [];
  let rv = 0;
  for (const e of newestFirst) {
    if (WORK_EVENTS.has(e.e)) add(sk, e.s);
    if (e.e === 'check-done' && e.p === 'mastery' && e.ok) add(ma, e.s);
    if (e.e === 'check-done' && e.p === 'review' && e.ok) rv += 1;
    if (e.e === 'repair-done' && e.ok && e.s && e.m && !fixed.some((f) => f[0] === e.s && f[1] === e.m)) fixed.push([e.s, e.m, 'd']);
  }
  const open: [string, string, FixState][] = day === ctx.today
    ? openMisconceptions(input.learn?.miscon || {}).slice(0, MAX_OPEN).map((r) => [r.skill, r.id, 'o'])
    : [];
  const exam = input.learn?.exam;
  const ex: ExamAhead | null = exam && typeof exam.date === 'string' && exam.date >= ctx.today && Array.isArray(exam.skills)
    ? { d: exam.date, n: exam.skills.filter((s) => masteryState(input.learn.skills?.[s], ctx.now) === 'mastered').length, of: exam.skills.length }
    : null;
  return {
    v: REPORT_V,
    d: day,
    m: Math.min(MAX_MINUTES, Math.floor(Math.max(count(rec.tsecs, Infinity), count(rec.secs, Infinity)) / 60)),
    q: count(rec.q, 2000),
    ls: count(rec.lessons, 200),
    st: count(rec.stages, 200),
    sk: sk.slice(0, MAX_STAIRS),
    ma: ma.slice(0, MAX_STAIRS),
    rv: Math.min(200, rv),
    fx: [...open, ...fixed.slice(0, MAX_FIXED)],
    sr: Math.min(3650, streakOf(input.days || {}, day)),
    ex,
  };
}

/**
 * The week of `start` from this device's own saved days: weekFrom over daySummary of each day of the week up to today.
 * `isRest` as in weekFrom (Saturday by default).
 */
export function weekLocal(input: ReportInput, start: string, ctx: ReportClock, isRest?: (day: string) => boolean): WeekReport {
  const rows = weekDays(start).filter((d) => d <= ctx.today).map((d) => daySummary(input, d, ctx));
  return weekFrom(rows, start, ctx.today, isRest) as WeekReport;
}

/** A stair from another version of the app (an id this one does not know): shown, and still counted. */
export const UNKNOWN_STAIR = 'מדרגה מגרסה אחרת של האפליקציה';
/** A mistake whose name this version does not know. */
export const UNKNOWN_MISTAKE = 'טעות שחוזרת';

/** A stair's full name, 'מספרים מכוונים: חיבור וחיסור' (shared/stairs.js), or UNKNOWN_STAIR. */
export const stairName = (skill: SkillId): string => sharedStairName(skill) ?? UNKNOWN_STAIR;

/**
 * A mistake's name in plain text (no TeX: the report has no KaTeX), from the content meta (synchronous, so /r and the
 * email never need a topic's teaching file), else the topic's older generator names, else UNKNOWN_MISTAKE.
 */
export function misconName(skill: SkillId, id: string, opts?: { isolate?: boolean }): string {
  const own = metaOf(skill)?.misconceptions.find((m) => m.id === id)?.title;
  if (own) return texToPlain(own, opts);
  const topic = String(skill).split(':')[0];
  const cat: string | undefined = TOPIC[topic]?.cats?.[id];
  return cat ? texToPlain(cat, opts) : UNKNOWN_MISTAKE;
}

// ------------------------------------------------------------------ Hebrew numbers

const plural = (one: string, two: string, many: (n: number) => string) => (n: number) => (n === 1 ? one : n === 2 ? two : many(n));
/** Hebrew counts as people say them: 'יום אחד', 'יומיים', '3 ימים'. */
export const he = {
  days: plural('יום אחד', 'יומיים', (n) => `${n} ימים`),
  minutes: plural('דקה אחת', 'שתי דקות', (n) => `${n} דקות`),
  stairs: plural('מדרגה אחת', 'שתי מדרגות', (n) => `${n} מדרגות`),
  mistakes: plural('טעות אחת', 'שתי טעויות', (n) => `${n} טעויות`),
  /** The line on the profile's card. */
  practiceWeek: (n: number) => (n <= 0 ? 'השבוע עוד לא היה תרגול' : n === 1 ? 'יום תרגול אחד השבוע' : n === 2 ? 'יומיים של תרגול השבוע' : `${n} ימי תרגול השבוע`),
};

/**
 * A one-letter prefix (ב, מ, ל) on a phrase: joined with a maqaf before a digit or a Latin letter ('ב־3 מדרגות'),
 * straight onto a Hebrew word ('בשתי מדרגות').
 */
export function withPrefix(p: 'ב' | 'מ' | 'ל', s: string): string {
  const text = String(s);
  return /^[֐-׿]/.test(text) ? `${p}${text}` : `${p}־${text}`;
}
