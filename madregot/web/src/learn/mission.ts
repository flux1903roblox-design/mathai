// "המשימה שלי להיום": about five minutes, chosen from the ranked actions and fixed for the day once made
// (so it does not change under the student's feet). Mixed on purpose: something to strengthen and something new.
import type { Action, LearnState, MissionItem } from './types';

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

/** Mark the items a finished activity completes (the same kind on the same skill, or any activity on its skill for "continue"). */
export function completeMissionItems(items: MissionItem[], done: { skill: string; kind?: Action['kind']; misc?: string }, at: string): MissionItem[] {
  return items.map((it) => {
    if (it.done || it.skill !== done.skill) return it;
    if (it.misc && done.misc && it.misc !== done.misc) return it;
    if (done.kind && it.kind !== done.kind && !(it.kind === 'continue' || it.kind === 'new' || it.kind === 'prereq' || it.kind === 'exam')) return it;
    return { ...it, done: at };
  });
}

export const missionDone = (items: MissionItem[]) => items.length > 0 && items.every((i) => i.done);
export const missionMinutes = (items: MissionItem[]) => items.reduce((t, i) => t + i.minutes, 0);
