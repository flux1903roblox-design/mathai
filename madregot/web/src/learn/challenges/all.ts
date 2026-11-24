// Every challenge task with its story and parts, for the challenge screen (screens/Challenge.jsx, a lazy chunk) and the
// tests: the first load carries only the meta (index.ts, meta.gen.ts). One list per topic file, in the order of the
// topics (TOPIC_ORDER), as the registry orders them.
import type { ChallengeTask } from '../types';
import { TOPIC_ORDER } from '../skills';
import { FRAC_CHALLENGES } from './frac';
import { SIGNED_CHALLENGES } from './signed';
import { COORD_CHALLENGES } from './coord';
import { ANGLES_CHALLENGES } from './angles';
import { TRANSF_CHALLENGES } from './transf';
import { EXPR_CHALLENGES } from './expr';
import { AREA_CHALLENGES } from './area';
import { SOLID_CHALLENGES } from './solid';
import { DATA_CHALLENGES } from './data';
import { EQ_CHALLENGES } from './eq';
import { RATIO_CHALLENGES } from './ratio';
import { PCT_CHALLENGES } from './pct';
import { FUNC_CHALLENGES } from './func';
import { LINE_CHALLENGES } from './line';
import { PYTH_CHALLENGES } from './pyth';
import { CIRCLE_CHALLENGES } from './circle';
import { STATS_CHALLENGES } from './stats';
import { CONGR_CHALLENGES } from './congr';
import { SIM_CHALLENGES } from './sim';
import { SYS_CHALLENGES } from './sys';
import { PROB_CHALLENGES } from './prob';
import { SPACE_CHALLENGES } from './space';
// an Arabic topic's tasks in Arabic, when the app is in Arabic (COUNCIL2-34): they come with the Arabic catalogue
// @ts-ignore: plain JS
import { arabicChallenge } from '@/content/arabic.js';

export const CHALLENGE_TASKS: ChallengeTask[] = [
  ...FRAC_CHALLENGES, ...SIGNED_CHALLENGES, ...COORD_CHALLENGES, ...ANGLES_CHALLENGES, ...TRANSF_CHALLENGES, ...EXPR_CHALLENGES, ...AREA_CHALLENGES,
  ...SOLID_CHALLENGES, ...DATA_CHALLENGES, ...EQ_CHALLENGES, ...RATIO_CHALLENGES, ...PCT_CHALLENGES, ...FUNC_CHALLENGES, ...LINE_CHALLENGES,
  ...PYTH_CHALLENGES, ...CIRCLE_CHALLENGES, ...STATS_CHALLENGES, ...CONGR_CHALLENGES, ...SIM_CHALLENGES, ...SYS_CHALLENGES, ...PROB_CHALLENGES,
  ...SPACE_CHALLENGES,
].sort((a, b) => TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic));
const BY_ID: Record<string, ChallengeTask> = Object.fromEntries(CHALLENGE_TASKS.map((t) => [t.id, t]));
/** A task with its parts, by id, in the language on screen (an Arabic topic's task in Arabic); null when there is none. */
export const taskById = (id: string): ChallengeTask | null => arabicChallenge(id) || BY_ID[id] || null;
