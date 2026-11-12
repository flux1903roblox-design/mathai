// The challenge track (אתגר, curriculum stage 1, CURRICULUM-6): every task, by id and by the stair it follows, and what
// a student has open and done. A topic's tasks live in their own file (learn/challenges/<topic>.ts).
// A task is open once its `after` stair is mastered (a passed mastery check; a review due later does not close it), and
// a task already solved stays open. The screen at /challenge/:id never blocks: the places that link to it do the gating.
import type { ChallengeRecord, ChallengeTask, SkillId, SkillRecord, TopicId } from '../types';
import { ALL_SKILLS, TOPIC_ORDER } from '../skills';
import { FRAC_CHALLENGES } from './frac';
import { SIGNED_CHALLENGES } from './signed';
import { COORD_CHALLENGES } from './coord';
import { ANGLES_CHALLENGES } from './angles';
import { EXPR_CHALLENGES } from './expr';
import { EQ_CHALLENGES } from './eq';
import { RATIO_CHALLENGES } from './ratio';
import { PCT_CHALLENGES } from './pct';
import { FUNC_CHALLENGES } from './func';
import { LINE_CHALLENGES } from './line';
import { PYTH_CHALLENGES } from './pyth';
import { STATS_CHALLENGES } from './stats';
import { SYS_CHALLENGES } from './sys';

/**
 * Every task, in the order of the topics (TOPIC_ORDER), each topic's tasks in their own order. Stage 1 had 36: three
 * per topic, one claim, one error or proof and one real-world (literacy) task each; later stages add their own (the
 * functions unit's three, stage5.md FUNC-7).
 */
export const CHALLENGES: ChallengeTask[] = [
  ...FRAC_CHALLENGES, ...SIGNED_CHALLENGES, ...COORD_CHALLENGES, ...ANGLES_CHALLENGES, ...EXPR_CHALLENGES, ...EQ_CHALLENGES,
  ...RATIO_CHALLENGES, ...PCT_CHALLENGES, ...FUNC_CHALLENGES, ...LINE_CHALLENGES, ...PYTH_CHALLENGES, ...STATS_CHALLENGES, ...SYS_CHALLENGES,
].sort((a, b) => TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic));
const BY_ID: Record<string, ChallengeTask> = Object.fromEntries(CHALLENGES.map((t) => [t.id, t]));

export const challengeById = (id: string): ChallengeTask | null => BY_ID[id] || null;
/** The tasks that open once this stair is mastered. */
export const challengesAfter = (skill: SkillId): ChallengeTask[] => CHALLENGES.filter((t) => t.after === skill);
export const challengesOf = (topic: TopicId): ChallengeTask[] => CHALLENGES.filter((t) => t.topic === topic);

type Skills = Record<SkillId, SkillRecord>;
type Records = Record<string, ChallengeRecord> | undefined | null;

/** Solved: the task was finished once (its record has doneAt). */
export const isSolved = (t: ChallengeTask, recs: Records) => !!recs?.[t.id]?.doneAt;
/** Open: its stair is mastered, or it was already solved. */
export const isOpen = (t: ChallengeTask, skills: Skills, recs: Records) => !!skills[t.after]?.mastered || isSolved(t, recs);
/** How many tasks are solved, in all. */
export const solvedCount = (recs: Records) => CHALLENGES.filter((t) => isSolved(t, recs)).length;

/** A topic's tasks as Topics counts them: how many are open, how many of those are solved, and the next one to try. */
export function topicChallenges(topic: TopicId, skills: Skills, recs: Records): { open: number; done: number; next: ChallengeTask | null } {
  const open = challengesOf(topic).filter((t) => isOpen(t, skills, recs));
  return { open: open.length, done: open.filter((t) => isSolved(t, recs)).length, next: open.find((t) => !isSolved(t, recs)) || null };
}

/** The task to offer after this stair: its first one not solved yet (null when it has none, or all are solved). */
export const nextAfter = (skill: SkillId, recs: Records): ChallengeTask | null => challengesAfter(skill).find((t) => !isSolved(t, recs)) || null;

/**
 * The first unsolved task of a mastered stair, for the plan (learn/next.ts, band 9): the stair mastered most recently
 * first (the check the student just passed is the one the suggestion names), then in school order (ALL_SKILLS), then
 * in the topic's own order.
 */
export function firstOpenChallenge(skills: Skills, recs: Records): ChallengeTask | null {
  const at = (t: ChallengeTask) => Date.parse(skills[t.after]?.mastered?.at || '') || 0;
  const open = CHALLENGES.filter((t) => !!skills[t.after]?.mastered && !isSolved(t, recs));
  open.sort((a, b) => at(b) - at(a) || ALL_SKILLS.indexOf(a.after) - ALL_SKILLS.indexOf(b.after) || CHALLENGES.indexOf(a) - CHALLENGES.indexOf(b));
  return open[0] || null;
}
