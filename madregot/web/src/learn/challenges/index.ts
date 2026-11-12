// The challenge track (אתגר, curriculum stage 1, CURRICULUM-6): every task, by id and by the stair it follows, and what
// a student has open and done. A topic's tasks live in their own file (learn/challenges/<topic>.ts).
// A task is open once its `after` stair is mastered (a passed mastery check; a review due later does not close it), and
// a task already solved stays open. The screen at /challenge/:id never blocks: the places that link to it do the gating.
import type { ChallengeRecord, ChallengeTask, SkillId, SkillRecord, TopicId } from '../types';
import { TOPIC_ORDER } from '../skills';
import { firstOpenChallenge as firstOpen } from './open';
import { FRAC_CHALLENGES } from './frac';
import { SIGNED_CHALLENGES } from './signed';
import { COORD_CHALLENGES } from './coord';
import { ANGLES_CHALLENGES } from './angles';
import { EXPR_CHALLENGES } from './expr';
import { EQ_CHALLENGES } from './eq';
import { RATIO_CHALLENGES } from './ratio';
import { PCT_CHALLENGES } from './pct';
import { LINE_CHALLENGES } from './line';
import { PYTH_CHALLENGES } from './pyth';
import { STATS_CHALLENGES } from './stats';
import { SYS_CHALLENGES } from './sys';
// an Arabic topic's tasks in Arabic, when the app is in Arabic (COUNCIL2-34): they come with the Arabic catalogue
import { arabicChallenge } from '@/content/arabic.js';
import { localized } from '@/lib/i18n.js';

/**
 * Every task, in the order of the topics (TOPIC_ORDER), each topic's tasks in their own order. Stage 1 has 36: three
 * per topic, one claim, one error or proof and one real-world (literacy) task each.
 */
const HEBREW: ChallengeTask[] = [
  ...FRAC_CHALLENGES, ...SIGNED_CHALLENGES, ...COORD_CHALLENGES, ...ANGLES_CHALLENGES, ...EXPR_CHALLENGES, ...EQ_CHALLENGES,
  ...RATIO_CHALLENGES, ...PCT_CHALLENGES, ...LINE_CHALLENGES, ...PYTH_CHALLENGES, ...STATS_CHALLENGES, ...SYS_CHALLENGES,
].sort((a, b) => TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic));
const byId = (list: ChallengeTask[]): Record<string, ChallengeTask> => Object.fromEntries(list.map((t) => [t.id, t]));
let BY_ID: Record<string, ChallengeTask> = {};
/** Every task in the language on screen (an Arabic topic's tasks in Arabic on an Arabic device). */
export let CHALLENGES: ChallengeTask[] = localized(() => HEBREW.map((t) => arabicChallenge(t.id) || t), (v) => { CHALLENGES = v; BY_ID = byId(v); });
BY_ID = byId(CHALLENGES);

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
 * The first unsolved task of a mastered stair, for the plan (learn/next.ts, band 9), as a full task: the order is
 * open.ts's, which reads the tasks' meta (the map's first screen loads only that, COUNCIL2-14).
 */
export function firstOpenChallenge(skills: Skills, recs: Records): ChallengeTask | null {
  const m = firstOpen(skills, recs);
  return m ? BY_ID[m.id] || null : null;
}
