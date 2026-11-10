// Learning analytics, on this device only. Minimal events (what happened, on which stair, right or not),
// no names, no free text, nothing sent anywhere. Time in the app is not treated as learning.
// The outcome metrics follow the brief's definitions and say how many cases they rest on: below MIN_N a
// metric is shown as "not enough data yet", never as a number.
import type { LearnEvent, LearnState } from './types';
import { resolutionRate } from './misconceptions';
import { daysBetween } from './mastery';

export const MAX_EVENTS = 3000;
export const MIN_N = 3;
/**
 * Events about the saved data, not about learning (lib/durable: a merge of two tabs or devices, a restore). They have
 * no content, and no metric counts them: a day with only a merge is not an active day.
 */
export const NOT_LEARNING = new Set(['merge', 'restore']);

export function logEvent(events: LearnEvent[], e: Omit<LearnEvent, 't'>, at: string): LearnEvent[] {
  return [...events, { t: at, ...e }].slice(-MAX_EVENTS);
}

export interface Rate { n: number; value: number | null }
const rate = (hit: number, n: number): Rate => ({ n, value: n >= MIN_N ? hit / n : null });

export interface Metrics {
  lessonsStarted: number; lessonsDone: number;
  masteredNow: number;
  independent: Rate; assisted: Rate;
  /** Improvement from a skill's first diagnostic to a later independent check (average, in percentage points / 100). */
  masteryGain: Rate;
  /** Misconceptions confirmed that are now resolved. */
  misconResolution: Rate;
  reviews: Rate;
  /** Mastered skills still answered right at a review 7 days or more after mastery. */
  retained7: Rate;
  activeDays: number;
  returned: { d1: boolean; d7: boolean; d30: boolean };
  examPrep: { created: number; diagnosed: number; practiceExams: number };
  adoption: Record<string, number>;
}

const day = (iso: string) => iso.slice(0, 10);

export function metrics(learn: LearnState, now: string): Metrics {
  const ev = learn.events.filter((x) => !NOT_LEARNING.has(x.e));
  const count = (e: string) => ev.filter((x) => x.e === e).length;
  const attempts = Object.values(learn.skills).flatMap((r) => r.attempts);
  const ind = attempts.filter((a) => a.independent && a.purpose !== 'guided');
  const asst = attempts.filter((a) => !a.independent);

  // gain: first diagnostic accuracy vs the last independent check (mastery or review) after it, per skill
  const gains: number[] = [];
  const bySkill = new Map<string, LearnEvent[]>();
  ev.filter((x) => x.s && (x.e === 'check-done')).forEach((x) => bySkill.set(x.s!, [...(bySkill.get(x.s!) || []), x]));
  bySkill.forEach((list) => {
    const first = list.find((x) => x.p === 'diagnostic');
    const later = [...list].reverse().find((x) => x.p !== 'diagnostic' && first && x.t > first.t);
    if (first && later && first.n != null && later.n != null) gains.push(later.n - first.n);
  });

  const rr = resolutionRate(learn.miscon);
  const reviews = ev.filter((x) => x.e === 'check-done' && x.p === 'review');
  const late = reviews.filter((x) => (x.d ?? 0) >= 7);
  const days = [...new Set(ev.map((x) => day(x.t)))].sort();
  const first = days[0];
  const after = (k: number) => !!first && days.some((d) => daysBetween(`${first}T00:00:00`, `${d}T00:00:00`) >= k);
  const adoption: Record<string, number> = {};
  ['teach-start', 'example-done', 'together-done', 'mission-start', 'mission-done', 'rescue-created', 'tutor', 'repair-start', 'repair-done'].forEach((e) => { adoption[e] = count(e); });

  return {
    lessonsStarted: count('lesson-start'), lessonsDone: count('lesson-done'),
    masteredNow: Object.values(learn.skills).filter((r) => r.mastered && new Date(now) < new Date(r.mastered.due) && r.mastered.lastReview?.ok !== false).length,
    independent: rate(ind.filter((a) => a.ok).length, ind.length),
    assisted: rate(asst.filter((a) => a.ok).length, asst.length),
    masteryGain: { n: gains.length, value: gains.length >= MIN_N ? gains.reduce((t, g) => t + g, 0) / gains.length : null },
    misconResolution: rate(rr.resolved, rr.total),
    reviews: rate(reviews.filter((x) => x.ok).length, reviews.length),
    retained7: rate(late.filter((x) => x.ok).length, late.length),
    activeDays: days.length,
    returned: { d1: after(1), d7: after(7), d30: after(30) },
    examPrep: { created: count('rescue-created'), diagnosed: ev.filter((x) => x.e === 'check-done' && x.p === 'diagnostic').length, practiceExams: count('rescue-exam-done') },
    adoption,
  };
}
