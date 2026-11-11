// "המשימה שלי להיום": about five minutes, chosen from the ranked plan (learn/next.ts planNext().items) and fixed for the
// day once made (so it does not change under the student's feet). Mixed on purpose: something to strengthen and
// something new. Its first item is the plan's top, so the mission's button and the home's next step agree. The
// teacher's work (band 1) is never a part: it has its own rows above the mission (ClassWork), and TodayCard's button
// starts it while it is the plan's top.
import type { Action, LearnState, MissionItem, Stage } from './types';
import { STAGE_NAME, STAGE_N, routeOf, titleOf } from './recommend';

export const MISSION_MINUTES = 5;
export const MISSION_MAX = 3;

const STRENGTHEN: Action['kind'][] = ['repair', 'review', 'prereq', 'exam', 'exam-loss', 'floor'];

/** Choose today's mission from the ranked plan: the most valuable item, then one of the other kind, up to ~5 minutes. */
export function buildMission(plan: Action[]): MissionItem[] {
  const actions = plan.filter((a) => a.kind !== 'teacher');
  if (!actions.length) return [];
  const out: MissionItem[] = [actions[0]];
  let minutes = actions[0].minutes;
  const firstStrengthens = STRENGTHEN.includes(actions[0].kind);
  // then the best action of the other kind (strengthen ↔ move forward)
  const other = actions.find((a) => a !== actions[0] && STRENGTHEN.includes(a.kind) !== firstStrengthens);
  if (other) { out.push(other); minutes += other.minutes; }
  for (const a of actions) {
    if (out.length >= MISSION_MAX || minutes >= MISSION_MINUTES) break;
    if (out.includes(a) || out.some((x) => x.skill === a.skill && x.kind === a.kind)) continue;
    out.push(a); minutes += a.minutes;
  }
  // a mission item keeps what the mission needs (a challenge's task id included), not the plan's ranking fields
  return out.map(({ source, rank, due, ...a }: Action & { source?: unknown; rank?: unknown; due?: unknown }) => ({ ...a }));
}

/** Today's mission: the saved one, or a new one. */
export function missionFor(learn: LearnState, day: string, actions: Action[]): { items: MissionItem[]; fresh: boolean } {
  const saved = learn.missions[day];
  if (saved?.items.length) return { items: saved.items, fresh: false };
  return { items: buildMission(actions), fresh: true };
}

/**
 * What a finished activity completes: only the item it really did.
 *  - a learning item names one stage of a stair (A–D): it is done when that stage is (a mastery check also counts);
 *  - a mastery check completes its own item; a review only a review; a repair only that misconception's repair;
 *  - an Exam Rescue step is done by that step: its diagnostic and its practice exam by Rescue work (Done.kind 'exam'),
 *    a lesson by learning on its stair, practice by practice (or the check), a mastery check by the check, a review by
 *    a review or the check. A Rescue item saved before steps were named (no `task`) is done by any Rescue work, or by
 *    learning on its stair;
 *  - points lost in an exam ('exam-loss') are done by practice, a review or a mastery check on that stair (or by the
 *    teaching stage the item itself names);
 *  - the floor check item by the floor check (Done.kind 'floor', on no stair);
 *  - a challenge item by finishing that very task (Done.kind 'challenge' with its challengeId), never by work on its
 *    stair, and a challenge never completes a learning item.
 * Items saved before stages existed (no `stage`) are completed by any learning on their stair.
 */
export interface Done {
  /** The stair; none for an activity on no stair (the floor check). For a challenge, the stair it follows. */
  skill?: string;
  kind: Action['kind']; stage?: Stage; misc?: string;
  /** A finished challenge: which task. */
  challengeId?: string;
}
const practice = (done: Done) => done.kind === 'continue' && (!done.stage || done.stage === 'D');
function completesRescue(it: MissionItem, done: Done): boolean {
  if (!it.task) return done.kind === 'exam' || (done.skill === it.skill && (done.kind === 'continue' || done.kind === 'mastery'));
  if (it.task === 'diagnostic' || it.task === 'exam') return done.kind === 'exam';
  if (done.skill !== it.skill) return false;
  switch (it.task) {
    case 'learn': return done.kind === 'continue' || done.kind === 'mastery';
    case 'practice': return practice(done) || done.kind === 'mastery';
    case 'mastery': return done.kind === 'mastery';
    default: return done.kind === 'review' || done.kind === 'mastery'; // review
  }
}
function completes(it: MissionItem, done: Done): boolean {
  if (it.kind === 'exam') return completesRescue(it, done);
  if (it.kind === 'floor') return done.kind === 'floor';
  if (it.kind === 'challenge') return done.kind === 'challenge' && !!it.challengeId && done.challengeId === it.challengeId;
  if (done.kind === 'challenge') return false;
  if (it.skill !== done.skill) return false;
  switch (it.kind) {
    case 'repair': return done.kind === 'repair' && done.misc === it.misc;
    case 'review': return done.kind === 'review';
    case 'mastery': return done.kind === 'mastery';
    case 'exam-loss': return done.kind === 'review' || done.kind === 'mastery' || practice(done) || (done.kind === 'continue' && !!it.stage && done.stage === it.stage);
    default: // new, continue, prereq
      if (done.kind === 'mastery') return true;
      return done.kind === 'continue' && (!it.stage || done.stage === it.stage);
  }
}
export function completeMissionItems(items: MissionItem[], done: Done, at: string): MissionItem[] {
  return items.map((it) => (!it.done && completes(it, done) ? { ...it, done: at } : it));
}

/** The kinds that are a stage of learning a stair (an Exam Rescue step or a check is not). */
const LEARNING: Action['kind'][] = ['new', 'continue', 'prereq', 'exam-loss'];

/** When the mission is done but a stair in it is not: say exactly which stage was done, and that the stair goes on. */
export function partialStairNote(items: MissionItem[]): string | null {
  const parts = items.filter((i) => i.done && i.stage && i.stage !== 'E' && LEARNING.includes(i.kind));
  if (!parts.length) return null;
  const done = parts.map((i) => `במדרגה "${titleOf(i.skill)}" סיימתם את שלב ${STAGE_N[i.stage!]} מתוך 5 (${STAGE_NAME[i.stage!]}).`).join(' ');
  return `${done} המדרגה עצמה עוד לא הושלמה: השלבים הבאים מחכים בדף שלה.`;
}

export const missionDone = (items: MissionItem[]) => items.length > 0 && items.every((i) => i.done);

/**
 * Where "today's lesson" leads (the installed app's shortcut, ./#/?go=today, STUDENT-10): where TodayCard's button
 * goes, the mission's next part; an item saved without its route gets it from routeOf. With nothing left to do, the
 * missions tab, where the day's card says so.
 */
export function todayRoute(items: MissionItem[]): string {
  const next = items.find((i) => !i.done);
  if (!next) return '/quests';
  return next.to || (next.stage ? routeOf.stage(next.skill, next.stage) : routeOf.journey(next.skill));
}
export const missionMinutes = (items: MissionItem[]) => items.reduce((t, i) => t + i.minutes, 0);
