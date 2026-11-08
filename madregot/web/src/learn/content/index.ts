// The content registry: every stair's teaching journey, keyed by skill id ('signed:1' ... 'stats:5').
// A stair that has no entry yet is not taught (the journey screen says so honestly) and keeps its practice.
import type { StairContent, SkillId } from '../types';
import { SIGNED } from './signed';

const ALL: StairContent[] = [...SIGNED];

export const CONTENT: Record<SkillId, StairContent> = Object.fromEntries(ALL.map((c) => [c.skill, c]));
export const contentOf = (skill: SkillId): StairContent | null => CONTENT[skill] || null;
export const hasContent = (skill: SkillId) => !!CONTENT[skill];
