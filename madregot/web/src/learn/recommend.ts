// The engine's building blocks: what a skill's state is, what is missing, which stage of a stair comes next, the routes
// that start each activity, and the words for them. The ranked "what next" itself is learn/next.ts (planNext); the
// old nextActions below is a thin wrapper over it, kept for one release.
// The bridge unit (fractions, skills.ts BRIDGE) is the floor under the grade, not a stair of it: a bridge stair is
// missing only on evidence (never because it was not started), and it is offered as new only when the floor is on.
import type { Action, LearnState, MasteryState, SkillId, SkillRecord, Stage } from './types';
import { ALL_SKILLS, GRADE_OF, isBridgeSkill, parseSkill, prereqsOf } from './skills';
import { masteryState, nextStage } from './mastery';
import { openMisconceptions } from './misconceptions';
import { hasContent } from './content/index';
import { planNext } from './next';
import { schoolMonth } from './programme';
// @ts-ignore: plain JS
import { TOPIC } from '@/content/index.js';
// @ts-ignore: plain JS
import { reachedUpTo } from '@/lib/path.js';

export interface Context {
  learn: LearnState;
  grade: '7' | '8';
  /** The map's progress (path and the older ladder), so stairs passed before Madregot 2.0 count as known. */
  path?: Record<string, unknown>;
  progress?: Record<string, unknown>;
  now: string;
  day: string;
}

export const titleOf = (id: SkillId): string => { const { topic, level } = parseSkill(id); return TOPIC[topic]?.levels[level - 1]?.title || id; };
export const topicTitleOf = (id: SkillId): string => TOPIC[parseSkill(id).topic]?.title || '';
const stairName = (id: SkillId) => `${topicTitleOf(id)}: ${titleOf(id)}`;

/** About how long each kind takes. A challenge item carries its own task's minutes (4 to 10); 6 is only the typical one. */
export const MINUTES: Record<Action['kind'], number> = { exam: 5, repair: 3, review: 2, 'exam-loss': 4, floor: 3, prereq: 4, continue: 4, new: 5, mastery: 3, challenge: 6 };

/** The five stages of a stair, as the student sees them. */
export const STAGE_NAME: Record<Stage, string> = { A: 'מבינים את הרעיון', B: 'דוגמה פתורה', C: 'פותרים יחד', D: 'תרגול', E: 'בדיקת שליטה' };
export const STAGE_N: Record<Stage, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
export const STAGE_MIN: Record<Stage, number> = { A: 5, B: 3, C: 4, D: 5, E: 3 };

export const routeOf = {
  journey: (id: SkillId) => { const { topic, level } = parseSkill(id); return `/learn/${topic}/${level}`; },
  check: (id: SkillId, purpose: 'mastery' | 'review') => { const { topic, level } = parseSkill(id); return `/lesson/${topic}/${level}?kind=check&purpose=${purpose}`; },
  repair: (id: SkillId, misc: string) => { const { topic, level } = parseSkill(id); return `/repair/${topic}/${level}/${misc}`; },
  /**
   * Straight into one stage of a stair. Practice (D) names no part: the lesson takes the next one from the map, so the
   * map's own button and every suggestion open the very same route.
   */
  stage: (id: SkillId, stage: Stage) => {
    const { topic, level } = parseSkill(id);
    if (stage === 'D') return `/lesson/${topic}/${level}`;
    if (stage === 'E') return `/lesson/${topic}/${level}?kind=check&purpose=mastery`;
    return `/learn/${topic}/${level}/${stage}`;
  },
};

/** The next stage of a stair for this student (a stair without teaching content starts at practice). */
export const stairStage = (id: SkillId, rec: SkillRecord | undefined): Stage => (hasContent(id) ? nextStage(rec) : (rec?.attempts.some((a) => a.purpose === 'practice' && a.ok) ? 'E' : 'D'));
export const stageOf = (ctx: Context, id: SkillId): Stage => stairStage(id, ctx.learn.skills[id]);

/** The state of every skill now. */
export function states(ctx: Context): Record<SkillId, MasteryState> {
  return Object.fromEntries(ALL_SKILLS.map((id) => [id, masteryState(ctx.learn.skills[id], ctx.now)]));
}

/** Passed on the map already (a finished stair on the path, or the older ladder). */
export function onPath(ctx: Context, id: SkillId) {
  const { topic, level } = parseSkill(id);
  try { return level <= reachedUpTo(topic, ctx.path || {}); } catch { return false; }
}

/** Independent right answers on a stair after a missed check (an exam, a diagnostic, the floor check) that count as recovered. */
export const RECOVER_RIGHT = 3;
const after = (iso: string | undefined, t: number) => !!iso && Date.parse(iso) > t;

/**
 * Recovered since `at`: a mastery check or a review passed after it, or RECOVER_RIGHT independent right answers after it.
 * Old evidence that a stair is weak counts only while nothing newer says otherwise.
 */
export function recoveredSince(rec: SkillRecord | undefined, at: string | undefined): boolean {
  if (!rec || !at) return false;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  if (rec.mastered && after(rec.mastered.at, t)) return true;
  if (rec.mastered?.lastReview?.ok && after(rec.mastered.lastReview.at, t)) return true;
  return rec.attempts.filter((a) => a.ok && a.independent && after(a.at, t)).length >= RECOVER_RIGHT;
}

/** Fewer than half right in a short check, and nothing since that says the stair is back. */
const missedSince = (x: { asked: number; right: number } | undefined, at: string | undefined, rec: SkillRecord | undefined) => !!x && x.asked > 0 && x.right * 2 < x.asked && !recoveredSince(rec, at);

/** Does the evidence say this skill is missing? Only evidence counts: no data about an earlier grade is not a gap. */
export function isMissing(ctx: Context, id: SkillId, st = states(ctx)): boolean {
  const s = st[id];
  const rec = ctx.learn.skills[id];
  if (s === 'needs-support') return true;
  if (s === 'needs-review' && rec?.mastered?.lastReview?.ok === false) return true;
  if (openMisconceptions(ctx.learn.miscon).some((m) => m.skill === id && m.state === 'confirmed')) return true;
  // Exam Rescue's diagnostic, and the floor check of the fractions stairs: fewer than half right counts until the stair
  // is mastered, reviewed or answered right on its own since (a floor check is not offered twice, so without this one
  // early miss would block every unit above that stair for good)
  const diag = ctx.learn.exam?.diagnostic?.[id];
  if (missedSince(diag, diag?.at, rec)) return true;
  if (missedSince(ctx.learn.floor?.results?.[id], ctx.learn.floor?.at, rec)) return true;
  // in the student's own grade, a stair never started and not passed on the map is not known yet (a bridge stair is
  // below the grade: not having started it says nothing)
  return GRADE_OF[parseSkill(id).topic] === ctx.grade && !isBridgeSkill(id) && s === 'not-started' && !onPath(ctx, id);
}

/** The smallest missing prerequisite under a skill: follow missing prerequisites down to one whose own prerequisites are in place. */
export function smallestMissing(ctx: Context, id: SkillId, st = states(ctx)): SkillId | null {
  const seen = new Set<SkillId>();
  let cur: SkillId | null = null;
  let frontier = prereqsOf(id).filter((p) => isMissing(ctx, p, st));
  while (frontier.length) {
    const p = frontier[0];
    if (seen.has(p)) break;
    seen.add(p); cur = p;
    frontier = prereqsOf(p).filter((q) => isMissing(ctx, q, st));
  }
  return cur;
}

/** Is the stair hard right now (so a prerequisite is worth a look)? */
export function struggling(ctx: Context, id: SkillId, s: MasteryState) {
  return s === 'needs-support' || (ctx.learn.skills[id]?.failedChecks || 0) >= 2;
}

/**
 * The ranked actions, as before CURRICULUM-7: now a thin wrapper over planNext (learn/next.ts), kept for one release.
 * The school month comes from the context's day; checked exams are not part of this older context.
 */
export function nextActions(ctx: Context): Action[] {
  return planNext({ ...ctx, month: schoolMonth(ctx.day), exams: [] }).items;
}

export { stairName };
