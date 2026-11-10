// Class work on the student's device (spec TEACHER-5 §3): how far a stair the teacher gave has come, from the learning
// record alone, and how two reports of the same work combine. Pure: no store, no React, no network.
//
// The server keeps each student's work with monotonic rules (worker/src/assignments.js postWork): once done it stays
// done, the stage and "passed" only go up, the first finished result is the one kept. mergeWork applies the same rules
// on the device, so a report waiting offline, the server's copy and a newer report combine the same way everywhere.
import type { LearnState, SkillRecord } from './types';
import { hasContent } from './content/index';
import { nextStage } from './mastery';
import { STAGE_N } from './recommend';

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
  id: string; kind: 'stair' | 'check' | 'exam'; skill: string | null; title: string; note: string;
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
  if (practice.filter((a) => a.ok).length >= PRACTICE_DONE) return 4;
  return practice.length ? 1 : 0;
}

/** The device's own day of a moment ('YYYY-MM-DD'), to compare with a Jerusalem day the teacher chose. */
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

/**
 * What a stair assignment reports, from the learning record: { state, stage, passed }, or null while nothing was done.
 * Done: the stair is mastered, or its mastery check was finished since the assignment started (a finished check, not a
 * single answer of one). Started: a stage is done, or anything was answered on the stair since it started.
 * Checks and class exams report their own events (Lesson.jsx), so this returns null for them.
 */
export function workFromLearn(a: ClassAssignment, learn: LearnState): WorkReport | null {
  if (a.kind !== 'stair' || !a.skill) return null;
  const rec = learn.skills[a.skill];
  const stage = stairStage(a.skill, rec);
  const passed = !!rec?.mastered;
  const since = (t: string) => dayOf(t) >= a.startsOn;
  const checked = learn.events.some((e) => e.e === 'check-done' && e.p === 'mastery' && e.s === a.skill && since(e.t));
  const tried = (rec?.attempts || []).some((x) => since(x.at));
  const state: WorkState | null = passed || checked ? 'done' : stage > 0 || tried ? 'started' : null;
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
