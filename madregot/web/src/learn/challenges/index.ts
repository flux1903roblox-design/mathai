// The challenge track (אתגר, curriculum stage 1, CURRICULUM-6): every task, by id and by the stair it follows. A topic's
// tasks live in their own file (learn/challenges/<topic>.ts); stage 1 starts with six complete exemplars and fills the
// rest of the three tasks per topic later (CURRICULUM-6.5).
import type { ChallengeTask, SkillId, TopicId } from '../types';
import { PCT_CHALLENGES } from './pct';
import { FRAC_CHALLENGES } from './frac';
import { RATIO_CHALLENGES } from './ratio';
import { ANGLES_CHALLENGES } from './angles';
import { PYTH_CHALLENGES } from './pyth';
import { STATS_CHALLENGES } from './stats';

export const CHALLENGES: ChallengeTask[] = [...FRAC_CHALLENGES, ...ANGLES_CHALLENGES, ...RATIO_CHALLENGES, ...PCT_CHALLENGES, ...PYTH_CHALLENGES, ...STATS_CHALLENGES];
const BY_ID: Record<string, ChallengeTask> = Object.fromEntries(CHALLENGES.map((t) => [t.id, t]));

export const challengeById = (id: string): ChallengeTask | null => BY_ID[id] || null;
/** The tasks that open once this stair is mastered. */
export const challengesAfter = (skill: SkillId): ChallengeTask[] => CHALLENGES.filter((t) => t.after === skill);
export const challengesOf = (topic: TopicId): ChallengeTask[] => CHALLENGES.filter((t) => t.topic === topic);
