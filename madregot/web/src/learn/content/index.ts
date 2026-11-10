// The content registry: every stair's teaching journey, keyed by skill id ('signed:1' ... 'stats:5').
// A stair that has no entry yet is not taught (the journey screen says so honestly) and keeps its practice.
import type { StairContent, SkillId, TopicId } from '../types';
import { SIGNED, CATS_SIGNED } from './signed';
import { COORD, CATS_COORD } from './coord';
import { ANGLES, CATS_ANGLES } from './angles';
import { EXPR, CATS_EXPR } from './expr';
import { EQ, CATS_EQ } from './eq';
import { LINE1, CATS_LINE1 } from './line1';
import { LINE2, CATS_LINE2 } from './line2';
import { PYTH, CATS_PYTH } from './pyth';
import { STATS, CATS_STATS } from './stats';
import { SYS, CATS_SYS } from './sys';
import { FRAC, CATS_FRAC } from './frac';

const ALL: StairContent[] = [...FRAC, ...SIGNED, ...COORD, ...ANGLES, ...EXPR, ...EQ, ...LINE1, ...LINE2, ...PYTH, ...STATS, ...SYS];

export const CONTENT: Record<SkillId, StairContent> = Object.fromEntries(ALL.map((c) => [c.skill, c]));
export const contentOf = (skill: SkillId): StairContent | null => CONTENT[skill] || null;
export const hasContent = (skill: SkillId) => !!CONTENT[skill];

/** Misconception names new in 2.0, by topic: merged into each topic's cats (content/index.js). */
export const NEW_CATS: Record<TopicId, Record<string, string>> = {
  frac: CATS_FRAC, signed: CATS_SIGNED, coord: CATS_COORD, angles: CATS_ANGLES, expr: CATS_EXPR, eq: CATS_EQ, line: { ...CATS_LINE1, ...CATS_LINE2 }, pyth: CATS_PYTH, stats: CATS_STATS, sys: CATS_SYS,
};
