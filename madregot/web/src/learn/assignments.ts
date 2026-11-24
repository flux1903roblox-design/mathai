// Class work on the student's device (spec TEACHER-5 §3): how far a stair the teacher gave has come, from the learning
// record alone, and how two reports of the same work combine. Pure: no store, no React, no network.
//
// The server keeps each student's work with monotonic rules (worker/src/assignments.js postWork): once done it stays
// done, the stage and "passed" only go up, the first finished result is the one kept. mergeWork applies the same rules
// on the device, so a report waiting offline, the server's copy and a newer report combine the same way everywhere.
import type { LearnState, SkillRecord } from './types';
import { hasContent } from './content/index';
import { nextStage, practiceDone } from './mastery';
import { STAGE_N, routeOf } from './recommend';

export type WorkState = 'started' | 'done';
export interface WorkReport {
  state: WorkState | null;
  stage?: number | null;
  right?: number | null;
  asked?: number | null;
  passed?: boolean | null;
  questions?: { topic: string; level: number; status: string }[] | null;
  /** When it was done (kept on the device; the server sets its own). */
  doneAt?: string | null;
}
export interface ClassAssignment {
  /** A repair (SK-BUYERS-2) is one mistake on one stair: `misc` names it (one of the stair's own misconceptions). */
  id: string; kind: 'stair' | 'check' | 'exam' | 'repair'; skill: string | null; misc?: string | null; title: string; note: string;
  startsOn: string; dueOn: string; createdAt?: string; hasExam?: boolean; examCount?: number | null;
  mine: WorkReport | null;
}

/** Right practice answers that finish stage D (as Journey and the mission count it). */
export const PRACTICE_DONE = 6;

/**
 * Stages of a stair done, 0..5: 5 once mastered; with teaching content, the stage before the next one (A done → 1,
 * …, practice done → 4); a stair without teaching content (practice and check only) is 4 with enough right practice,
 * 1 with any practice, else 0. (Without that rule nextStage would say 'A' there forever.)
 */
export function stairStage(skill: string, rec: SkillRecord | undefined): number {
  if (rec?.mastered) return 5;
  if (hasContent(skill)) {
    if (!rec || !rec.taught?.A) return 0;
    return STAGE_N[nextStage(rec)] - 1;
  }
  const practice = (rec?.attempts || []).filter((a) => a.purpose === 'practice');
  // (after a failed mastery check, the practice since it: mastery.ts practiceDone)
  if (practiceDone(rec, PRACTICE_DONE)) return 4;
  return practice.length ? 1 : 0;
}

/** The device's own day of a moment ('YYYY-MM-DD'), to compare with a Jerusalem day the teacher chose. */
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

/**
 * What a repair the teacher gave reports (SK-BUYERS-2), from the learning record: { state }, or null while nothing was
 * done. Done when that mistake's repair check on that stair passed since the work started (the 'repair-done' event
 * with ok, which finishVerify gives only for 3 right of 3 with the mistake not showing again); started when its repair
 * was opened since then, or its check finished without passing. Mastery of the stair is not the repair.
 */
function repairFromLearn(a: ClassAssignment, learn: LearnState): WorkReport | null {
  if (!a.skill || !a.misc) return null;
  const mine = learn.events.filter((e) => e.s === a.skill && e.m === a.misc && dayOf(e.t) >= a.startsOn);
  if (mine.some((e) => e.e === 'repair-done' && e.ok)) return { state: 'done' };
  return mine.some((e) => e.e === 'repair-start' || e.e === 'repair-done') ? { state: 'started' } : null;
}

/**
 * What a stair assignment reports, from the learning record: { state, stage, passed }, or null while nothing was done.
 * Done only by work since the assignment started (SK-BUYERS-1): its mastery check finished since then (a finished
 * check, not a single answer of one), or, for a stair the student had mastered, a review check passed or a mistake on
 * it resolved by its verification since then. Mastery from before stays a fact (`passed`: the teacher's "עבר/ה בעבר"),
 * never this work done: a student who passed in October and slips in November gets the practice and shows as not done.
 * Started: a stage is done, or anything was answered on the stair since it started.
 * A repair the teacher gave reports from its own events (repairFromLearn). Checks and class exams report their own
 * events (Lesson.jsx), so this returns null for them.
 */
export function workFromLearn(a: ClassAssignment, learn: LearnState): WorkReport | null {
  if (a.kind === 'repair') return repairFromLearn(a, learn);
  if (a.kind !== 'stair' || !a.skill) return null;
  const rec = learn.skills[a.skill];
  const stage = stairStage(a.skill, rec);
  const passed = !!rec?.mastered;
  const since = (t: string) => dayOf(t) >= a.startsOn;
  const mine = learn.events.filter((e) => e.s === a.skill && since(e.t));
  const checked = mine.some((e) => e.e === 'check-done' && e.p === 'mastery');
  const kept = passed && mine.some((e) => (e.e === 'check-done' && e.p === 'review' && e.ok) || (e.e === 'repair-done' && e.ok));
  const tried = (rec?.attempts || []).some((x) => since(x.at));
  const state: WorkState | null = checked || kept ? 'done' : stage > 0 || tried ? 'started' : null;
  return state ? { state, stage, passed } : null;
}

const RANK: Record<string, number> = { started: 1, done: 2 };
const max = (x?: number | null, y?: number | null) => (x == null ? (y ?? null) : y == null ? x : Math.max(x, y));

/**
 * Two reports of the same work, combined as the server combines them: done stays done; stage and passed only go up;
 * the first finished result (right, asked, questions) is kept. `a` is the older one. Fields neither has stay out.
 */
export function mergeWork(a: WorkReport | null | undefined, b: WorkReport | null | undefined): WorkReport | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const out: WorkReport = { state: (RANK[b.state || ''] || 0) > (RANK[a.state || ''] || 0) ? b.state : a.state };
  const stage = max(a.stage, b.stage);
  if (stage != null) out.stage = stage;
  const passed = a.passed == null ? b.passed : b.passed == null ? a.passed : a.passed || b.passed;
  if (passed != null) out.passed = passed;
  const first = a.state === 'done' ? a : b.state === 'done' ? b : null;
  if (first) {
    if (first.right != null) out.right = first.right;
    if (first.asked != null) out.asked = first.asked;
    if (first.questions != null) out.questions = first.questions;
  }
  const doneAt = a.doneAt || b.doneAt;
  if (doneAt) out.doneAt = doneAt;
  return out;
}

/** Would this report change anything the server (or the waiting report) already has? */
export function adds(have: WorkReport | null | undefined, report: WorkReport | null | undefined): boolean {
  if (!report?.state) return false;
  const m = mergeWork(have, report)!;
  return m.state !== (have?.state ?? null) || (m.stage ?? null) !== (have?.stage ?? null) || (m.passed ?? null) !== (have?.passed ?? null);
}

/**
 * A stair the student had passed before the teacher gave it, and not done since (SK-BUYERS-1): only its mastery check
 * again (or a review check passed) finishes it, never practice, so that check is where it leads.
 */
export const recheckDue = (a: Pick<ClassAssignment, 'kind'>, w: WorkReport | null | undefined): boolean => a.kind === 'stair' && !!w?.passed && w.state !== 'done';

/**
 * Where the teacher's work opens: a class exam's start, the mastery check counted for it, the repair of that mistake
 * (the same route planNext's repair band gives it, SK-BUYERS-2), the stair's page with its banner, or, for a stair
 * passed before and not done since (recheckDue, from the work as this device knows it, `w`), its mastery check. Each
 * names the assignment, so what the student does there reports to it.
 */
export function workRoute(a: Pick<ClassAssignment, 'id' | 'kind' | 'skill' | 'misc'>, w?: WorkReport | null): string {
  if (a.kind === 'exam') return `/class/exam/${a.id}`;
  if (a.kind === 'check' || recheckDue(a, w)) return `${routeOf.check(a.skill!, 'mastery')}&assignment=${a.id}`;
  if (a.kind === 'repair') return `${routeOf.repair(a.skill!, encodeURIComponent(a.misc || ''))}?assignment=${a.id}`;
  return `${routeOf.journey(a.skill!)}?assignment=${a.id}`;
}
