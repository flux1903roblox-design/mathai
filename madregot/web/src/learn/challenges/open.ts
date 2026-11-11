// The challenge to offer next (learn/next.ts, band 9), read from the tasks' generated meta (meta.gen.ts: id, stair,
// title, minutes), so the map's first screen does not load every task's parts (COUNCIL2-14). learn/challenges/index.ts
// gives the full task for the same id.
import type { ChallengeRecord, SkillId, SkillRecord } from '../types';
import { ALL_SKILLS } from '../skills';
import { CHALLENGE_META, type ChallengeMeta } from './meta.gen';

type Skills = Record<SkillId, SkillRecord>;
type Records = Record<string, ChallengeRecord> | undefined | null;

/**
 * The first unsolved task of a mastered stair, for the plan (learn/next.ts, band 9): the stair mastered most recently
 * first (the check the student just passed is the one the suggestion names), then in school order (ALL_SKILLS), then
 * in the topic's own order (the order of CHALLENGES, which the meta keeps).
 */
export function firstOpenChallenge(skills: Skills, recs: Records): ChallengeMeta | null {
  const at = (t: ChallengeMeta) => Date.parse(skills[t.after]?.mastered?.at || '') || 0;
  const open = CHALLENGE_META.filter((t) => !!skills[t.after]?.mastered && !recs?.[t.id]?.doneAt);
  open.sort((a, b) => at(b) - at(a) || ALL_SKILLS.indexOf(a.after) - ALL_SKILLS.indexOf(b.after) || CHALLENGE_META.indexOf(a) - CHALLENGE_META.indexOf(b));
  return open[0] || null;
}
