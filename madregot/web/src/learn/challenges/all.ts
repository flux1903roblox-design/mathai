// Every challenge task with its story and parts, for the challenge screen (screens/Challenge.jsx, a lazy chunk) and the
// tests: the first load carries only the meta (index.ts, meta.gen.ts). One list per topic file, in the order of the
// topics (TOPIC_ORDER), as the registry orders them.
import type { ChallengeTask } from '../types';
import { TOPIC_ORDER } from '../skills';
import { FRAC_CHALLENGES } from './frac';
import { SIGNED_CHALLENGES } from './signed';
import { COORD_CHALLENGES } from './coord';
import { ANGLES_CHALLENGES } from './angles';
import { EXPR_CHALLENGES } from './expr';
import { DATA_CHALLENGES } from './data';
import { EQ_CHALLENGES } from './eq';
import { RATIO_CHALLENGES } from './ratio';
import { PCT_CHALLENGES } from './pct';
import { LINE_CHALLENGES } from './line';
import { PYTH_CHALLENGES } from './pyth';
import { STATS_CHALLENGES } from './stats';
import { SYS_CHALLENGES } from './sys';
import { PROB_CHALLENGES } from './prob';

export const CHALLENGE_TASKS: ChallengeTask[] = [
  ...FRAC_CHALLENGES, ...SIGNED_CHALLENGES, ...COORD_CHALLENGES, ...ANGLES_CHALLENGES, ...EXPR_CHALLENGES, ...DATA_CHALLENGES, ...EQ_CHALLENGES,
  ...RATIO_CHALLENGES, ...PCT_CHALLENGES, ...LINE_CHALLENGES, ...PYTH_CHALLENGES, ...STATS_CHALLENGES, ...SYS_CHALLENGES, ...PROB_CHALLENGES,
].sort((a, b) => TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic));
const BY_ID: Record<string, ChallengeTask> = Object.fromEntries(CHALLENGE_TASKS.map((t) => [t.id, t]));
/** A task with its parts, by id; null when there is none. */
export const taskById = (id: string): ChallengeTask | null => BY_ID[id] || null;
