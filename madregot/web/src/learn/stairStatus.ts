// A stair's state as its label says it, on every screen that names one: the stair page (Journey.jsx), the map's stops
// (Learn.jsx), the board's tiles (MasteryMap.jsx), the profile's counts (Me.jsx, ProgressSummary.jsx), a backup's
// preview (RestorePreview.jsx) and the tutor's context (tutorContext.js). One selector over mastery.ts's state, read as
// it is: the engine and its review policy do not change. It tells apart what one engine state holds:
//  - a lesson left in the middle: a saved place inside a teaching stage (SkillRecord.pos, kept as the student goes,
//    Teach.jsx) is a started stair. The engine counts finished stages and answers, so a first stage left at its fourth
//    step is "not-started" there; the label says "באמצע שיעור", and the lesson goes on from that place.
//  - a stair done on the map before mastery checks existed (path done 'kept') with no answers on record: practised, as
//    the board's tiles have always read it.
//  - "needs-review" is two things, told apart as recommend.ts isMissing tells them: a memory check that came due (the
//    stair is still learned, the check only confirms it stayed) and a memory check that was missed (worth strengthening).
import type { MasteryState, SkillId, SkillRecord } from './types';
import { masteryState } from './mastery';
import { skillId } from './skills';
import { topicsFor } from '@/content/topics.js';
import { isDone } from '@/lib/path.js';
import { localized, t } from '@/lib/i18n.js';

export type StairStatus = 'not-started' | 'in-lesson' | 'learning' | 'practicing' | 'needs-support' | 'mastered' | 'review-due' | 'review-missed';

const TEACHING = ['A', 'B', 'C'] as const;
/**
 * A saved place inside a teaching stage not finished yet: a lesson left in the middle, which goes on from there. (A
 * finished stage opened again and left keeps its place too, but the stair has already gone past it.)
 */
export const savedPlace = (rec: SkillRecord | undefined): boolean => TEACHING.some((k) => !rec?.taught?.[k] && (rec?.pos?.[k] || 0) > 0);

/** A stair's status now. `done`: the stair is done on the path (lib/path.js isDone). */
export function stairStatus(rec: SkillRecord | undefined, now: string, done = false): StairStatus {
  const st = masteryState(rec, now);
  if (st === 'needs-review') return rec?.mastered?.lastReview?.ok === false ? 'review-missed' : 'review-due';
  if (st === 'mastered' || st === 'practicing' || st === 'needs-support') return st;
  if (savedPlace(rec)) return 'in-lesson';
  if (st === 'learning') return st;
  return done ? 'practicing' : 'not-started';
}

export let STATUS_LABEL: Record<StairStatus, string> = localized(() => ({
  'not-started': t('shell.mastery.5'),
  'in-lesson': t('shell.mastery.inLesson'),
  learning: t('shell.mastery.6'),
  practicing: t('shell.mastery.8'),
  'needs-support': t('shell.mastery.7'),
  mastered: t('shell.mastery.9'),
  'review-due': t('shell.mastery.reviewDue'),
  'review-missed': t('shell.mastery.reviewMissed'),
}), (v) => { STATUS_LABEL = v; });

/** The colour each status is drawn in: its engine state's (the ms-* rules of journey.css and topics.css). */
export const STATUS_TONE: Record<StairStatus, MasteryState> = {
  'not-started': 'not-started', 'in-lesson': 'learning', learning: 'learning', practicing: 'practicing',
  'needs-support': 'needs-support', mastered: 'mastered', 'review-due': 'needs-review', 'review-missed': 'needs-review',
};

/**
 * Stairs counted by status. learned: mastered alone, a memory check that came due included (passing the mastery check
 * is not undone by the calendar); onWay: started and not mastered yet; due: waiting for a memory check (counted in
 * learned too); strengthen: a memory check missed, or most answers lately not right (needs-support).
 */
export interface StairCounts { learned: number; onWay: number; due: number; strengthen: number; of: number }
export function countStatuses(list: StairStatus[]): StairCounts {
  const n = (...s: StairStatus[]) => list.filter((x) => s.includes(x)).length;
  return { learned: n('mastered', 'review-due'), onWay: n('in-lesson', 'learning', 'practicing'), due: n('review-due'), strengthen: n('review-missed', 'needs-support'), of: list.length };
}

/** Every stair of a grade with its status now, in the grade's order. */
export function gradeStatuses(grade: string, skills: Record<SkillId, SkillRecord>, path: unknown, now: string): { id: SkillId; status: StairStatus }[] {
  return topicsFor(grade).flatMap((tp: { id: string; levels: unknown[] }) => tp.levels.map((_, i) => {
    const id = skillId(tp.id, i + 1);
    return { id, status: stairStatus(skills?.[id], now, isDone(path, tp.id, i + 1)) };
  }));
}

/** A grade's stairs counted (the profile, its summary and a backup's preview count the same way). */
export const gradeCounts = (grade: string, skills: Record<SkillId, SkillRecord>, path: unknown, now: string): StairCounts => countStatuses(gradeStatuses(grade, skills, path, now).map((x) => x.status));
