// "המשימה שלי להיום": about five minutes, chosen from the ranked actions and fixed for the day once made
// (so it does not change under the student's feet). Mixed on purpose: something to strengthen and something new.
import type { Action, LearnState, MissionItem, Stage } from './types';
import { STAGE_NAME, STAGE_N, titleOf } from './recommend';

export const MISSION_MINUTES = 5;
export const MISSION_MAX = 3;

const STRENGTHEN: Action['kind'][] = ['repair', 'review', 'prereq', 'exam'];

/** Choose today's mission from the ranked actions: the most valuable one, then one of the other kind, up to ~5 minutes. */
export function buildMission(actions: Action[]): MissionItem[] {
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
  return out.map((a) => ({ ...a }));
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
 *  - Exam Rescue work (the diagnostic, the practice exam) completes the exam item.
 * Items saved before stages existed (no `stage`) are completed by any learning on their stair.
 */
export interface Done { skill: string; kind: Action['kind']; stage?: Stage; misc?: string }
function completes(it: MissionItem, done: Done): boolean {
  if (it.kind === 'exam') return done.kind === 'exam' || (done.skill === it.skill && (done.kind === 'continue' || done.kind === 'mastery'));
  if (it.skill !== done.skill) return false;
  switch (it.kind) {
    case 'repair': return done.kind === 'repair' && done.misc === it.misc;
    case 'review': return done.kind === 'review';
    case 'mastery': return done.kind === 'mastery';
    default: // new, continue, prereq
      if (done.kind === 'mastery') return true;
      return done.kind === 'continue' && (!it.stage || done.stage === it.stage);
  }
}
export function completeMissionItems(items: MissionItem[], done: Done, at: string): MissionItem[] {
  return items.map((it) => (!it.done && completes(it, done) ? { ...it, done: at } : it));
}

/** When the mission is done but a stair in it is not: say exactly which stage was done, and that the stair goes on. */
export function partialStairNote(items: MissionItem[]): string | null {
  const parts = items.filter((i) => i.done && i.stage && i.stage !== 'E' && i.kind !== 'mastery');
  if (!parts.length) return null;
  const done = parts.map((i) => `במדרגה "${titleOf(i.skill)}" סיימתם את שלב ${STAGE_N[i.stage!]} מתוך 5 (${STAGE_NAME[i.stage!]}).`).join(' ');
  return `${done} המדרגה עצמה עוד לא הושלמה: השלבים הבאים מחכים בדף שלה.`;
}

export const missionDone = (items: MissionItem[]) => items.length > 0 && items.every((i) => i.done);
export const missionMinutes = (items: MissionItem[]) => items.reduce((t, i) => t + i.minutes, 0);
