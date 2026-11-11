// The challenge track (אתגר, curriculum stage 1, CURRICULUM-6): every task, by id and by the stair it follows, and what
// a student has open and done. A topic's tasks live in their own file (learn/challenges/<topic>.ts) and load on demand,
// one file per topic, so the first download does not grow with every task (DURABLE-11):
// - meta.gen.ts (generated from the topic files by scripts/gen-challenge-meta.mjs, small, always there): each task's
//   id, topic, stair, kind, title, minutes and mistake. CHALLENGES, challengeById and everything below read it: the
//   plan, the stair page, the check's end, the topics screen and the medals need nothing more.
// - ensureChallenge(id) brings the task's topic file; loadedChallenge(id) is the whole task (parts, story, figure)
//   once it has. The task's screen waits for it with React's use() (screens/Challenge.jsx).
// A task is open once its `after` stair is mastered (a passed mastery check; a review due later does not close it), and
// a task already solved stays open. The screen at /challenge/:id never blocks: the places that link to it do the gating.
import type { ChallengeMeta, ChallengeRecord, ChallengeTask, SkillId, SkillRecord, TopicId } from '../types';
import { ALL_SKILLS } from '../skills';
import { CHALLENGE_META } from './meta.gen';

/** Every task, in the order of the topics (TOPIC_ORDER), each topic's tasks in their own order. */
export const CHALLENGES: ChallengeMeta[] = CHALLENGE_META;
const BY_ID: Record<string, ChallengeMeta> = Object.fromEntries(CHALLENGES.map((t) => [t.id, t]));

export const challengeById = (id: string): ChallengeMeta | null => BY_ID[id] || null;
/** The tasks that open once this stair is mastered. */
export const challengesAfter = (skill: SkillId): ChallengeMeta[] => CHALLENGES.filter((t) => t.after === skill);
export const challengesOf = (topic: TopicId): ChallengeMeta[] => CHALLENGES.filter((t) => t.topic === topic);
/** The topics that have tasks, in TOPIC_ORDER. */
export const CHALLENGE_TOPICS: TopicId[] = [...new Set(CHALLENGES.map((t) => t.topic))];

// ------------------------------------------------------------------ the whole tasks, one topic file at a time

/** A topic with tasks adds its case here (learn/challenges.test.ts fails for a topic of the meta that does not load). */
function importTopic(topic: string): Promise<ChallengeTask[]> {
  switch (topic) {
    case 'frac': return import('./frac').then((m) => m.FRAC_CHALLENGES);
    case 'signed': return import('./signed').then((m) => m.SIGNED_CHALLENGES);
    case 'coord': return import('./coord').then((m) => m.COORD_CHALLENGES);
    case 'angles': return import('./angles').then((m) => m.ANGLES_CHALLENGES);
    case 'expr': return import('./expr').then((m) => m.EXPR_CHALLENGES);
    case 'eq': return import('./eq').then((m) => m.EQ_CHALLENGES);
    case 'ratio': return import('./ratio').then((m) => m.RATIO_CHALLENGES);
    case 'pct': return import('./pct').then((m) => m.PCT_CHALLENGES);
    case 'line': return import('./line').then((m) => m.LINE_CHALLENGES);
    case 'pyth': return import('./pyth').then((m) => m.PYTH_CHALLENGES);
    case 'stats': return import('./stats').then((m) => m.STATS_CHALLENGES);
    case 'sys': return import('./sys').then((m) => m.SYS_CHALLENGES);
    default: return Promise.resolve([]);
  }
}

const full: Record<string, ChallengeTask> = {};
// React's use() reads a promise's `status`: a promise marked 'fulfilled' gives its value at once, without suspending
// (the same rule as learn/content/index.ts ensureTopics).
type Marked = Promise<void> & { status?: 'pending' | 'fulfilled' | 'rejected'; value?: undefined; reason?: unknown };
const READY: Marked = Object.assign(Promise.resolve(), { status: 'fulfilled' as const, value: undefined });
const waiting = new Map<string, Marked>();
const loaded = new Set<string>();

/**
 * Resolves once the topic file of this task (or of this topic, 'pct:') has loaded. A topic still loading gives the
 * same promise and a topic loaded gives one marked as settled, so the screen can always pass it to use(): it suspends
 * only while a file really loads. A file that failed to load (offline before it was ever kept) can be asked for again.
 */
export function ensureChallenge(id: string): Promise<void> {
  const topic = id.split(':')[0];
  if (loaded.has(topic)) return READY;
  let p = waiting.get(topic);
  if (!p) {
    const q: Marked = importTopic(topic).then((list) => {
      for (const t of list) full[t.id] = t;
      loaded.add(topic);
    });
    q.status = 'pending';
    q.then(
      () => { q.status = 'fulfilled'; q.value = undefined; waiting.delete(topic); },
      (e) => { q.status = 'rejected'; q.reason = e; if (waiting.get(topic) === q) waiting.delete(topic); },
    );
    waiting.set(topic, q);
    p = q;
  }
  return p;
}
/** The whole task (its parts, story and figure), once its topic file has loaded; null before that, and for no task. */
export const loadedChallenge = (id: string): ChallengeTask | null => full[id] || null;
/** Every task whole, every topic loaded, in the order of CHALLENGES (tests, and tools that need them all). */
export async function loadAllChallenges(): Promise<ChallengeTask[]> {
  await Promise.all(CHALLENGE_TOPICS.map((tp) => ensureChallenge(`${tp}:`)));
  return CHALLENGES.map((t) => full[t.id]).filter(Boolean);
}

// ------------------------------------------------------------------ what a student has open and done

type Skills = Record<SkillId, SkillRecord>;
type Records = Record<string, ChallengeRecord> | undefined | null;
type Task = Pick<ChallengeMeta, 'id' | 'after'>;

/** Solved: the task was finished once (its record has doneAt). */
export const isSolved = (t: Task, recs: Records) => !!recs?.[t.id]?.doneAt;
/** Open: its stair is mastered, or it was already solved. */
export const isOpen = (t: Task, skills: Skills, recs: Records) => !!skills[t.after]?.mastered || isSolved(t, recs);
/** How many tasks are solved, in all. */
export const solvedCount = (recs: Records) => CHALLENGES.filter((t) => isSolved(t, recs)).length;

/** A topic's tasks as Topics counts them: how many are open, how many of those are solved, and the next one to try. */
export function topicChallenges(topic: TopicId, skills: Skills, recs: Records): { open: number; done: number; next: ChallengeMeta | null } {
  const open = challengesOf(topic).filter((t) => isOpen(t, skills, recs));
  return { open: open.length, done: open.filter((t) => isSolved(t, recs)).length, next: open.find((t) => !isSolved(t, recs)) || null };
}

/** The task to offer after this stair: its first one not solved yet (null when it has none, or all are solved). */
export const nextAfter = (skill: SkillId, recs: Records): ChallengeMeta | null => challengesAfter(skill).find((t) => !isSolved(t, recs)) || null;

/**
 * The first unsolved task of a mastered stair, for the plan (learn/next.ts, band 9): the stair mastered most recently
 * first (the check the student just passed is the one the suggestion names), then in school order (ALL_SKILLS), then
 * in the topic's own order.
 */
export function firstOpenChallenge(skills: Skills, recs: Records): ChallengeMeta | null {
  const at = (t: ChallengeMeta) => Date.parse(skills[t.after]?.mastered?.at || '') || 0;
  const open = CHALLENGES.filter((t) => !!skills[t.after]?.mastered && !isSolved(t, recs));
  open.sort((a, b) => at(b) - at(a) || ALL_SKILLS.indexOf(a.after) - ALL_SKILLS.indexOf(b.after) || CHALLENGES.indexOf(a) - CHALLENGES.indexOf(b));
  return open[0] || null;
}
