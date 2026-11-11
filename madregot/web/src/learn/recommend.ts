// What is the most valuable thing to do now? A ranked list of actions, each with the reason in words,
// so the student can always see why something was suggested. Order:
//   exam soon > a confirmed misconception to repair > a review that is due > the smallest missing prerequisite
//   of a stair that is hard right now > continue the stair in progress > a new stair.
// The bridge unit (fractions, skills.ts BRIDGE) is the floor under the grade, not a stair of it: a bridge stair is
// missing only on evidence (never because it was not started), and it is offered as new only when the floor is on.
import type { Action, LearnState, MasteryState, SkillId, Stage } from './types';
import { ALL_SKILLS, BRIDGE_SKILLS, GRADE_OF, gradeSkillsOf, isBridgeSkill, parseSkill, prereqsOf } from './skills';
import { masteryState, nextStage, dueReviews, daysBetween, STATE_LABEL } from './mastery';
import { openMisconceptions, canOffer } from './misconceptions';
import { hasContent, metaOf } from './content/index';
// @ts-ignore: plain JS
import { TOPIC } from '@/content/index.js';
// @ts-ignore: plain JS
import { reachedUpTo, isKept } from '@/lib/path.js';

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

export const MINUTES: Record<Action['kind'], number> = { exam: 5, repair: 3, review: 2, prereq: 4, continue: 4, new: 5, mastery: 3 };

/** The five stages of a stair, as the student sees them. */
export const STAGE_NAME: Record<Stage, string> = { A: 'מבינים את הרעיון', B: 'דוגמה פתורה', C: 'פותרים יחד', D: 'תרגול', E: 'בדיקת שליטה' };
export const STAGE_N: Record<Stage, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
export const STAGE_MIN: Record<Stage, number> = { A: 5, B: 3, C: 4, D: 5, E: 3 };

export const routeOf = {
  journey: (id: SkillId) => { const { topic, level } = parseSkill(id); return `/learn/${topic}/${level}`; },
  check: (id: SkillId, purpose: 'mastery' | 'review') => { const { topic, level } = parseSkill(id); return `/lesson/${topic}/${level}?kind=check&purpose=${purpose}`; },
  repair: (id: SkillId, misc: string) => { const { topic, level } = parseSkill(id); return `/repair/${topic}/${level}/${misc}`; },
  /** Straight into one stage of a stair. */
  stage: (id: SkillId, stage: Stage) => {
    const { topic, level } = parseSkill(id);
    if (stage === 'D') return `/lesson/${topic}/${level}?part=1&from=journey`;
    if (stage === 'E') return `/lesson/${topic}/${level}?kind=check&purpose=mastery`;
    return `/learn/${topic}/${level}/${stage}`;
  },
};

/** The next stage of a stair for this student (a stair without teaching content starts at practice). */
const stageOf = (ctx: Context, id: SkillId): Stage => (hasContent(id) ? nextStage(ctx.learn.skills[id]) : (ctx.learn.skills[id]?.attempts.some((a) => a.purpose === 'practice' && a.ok) ? 'E' : 'D'));

/** The state of every skill now. */
export function states(ctx: Context): Record<SkillId, MasteryState> {
  return Object.fromEntries(ALL_SKILLS.map((id) => [id, masteryState(ctx.learn.skills[id], ctx.now)]));
}

/** Passed on the map already (a finished stair on the path, or the older ladder). */
function onPath(ctx: Context, id: SkillId) {
  const { topic, level } = parseSkill(id);
  try { return level <= reachedUpTo(topic, ctx.path || {}); } catch { return false; }
}

/** Does the evidence say this skill is missing? Only evidence counts: no data about an earlier grade is not a gap. */
export function isMissing(ctx: Context, id: SkillId, st = states(ctx)): boolean {
  const s = st[id];
  if (s === 'needs-support') return true;
  if (s === 'needs-review' && ctx.learn.skills[id]?.mastered?.lastReview?.ok === false) return true;
  if (openMisconceptions(ctx.learn.miscon).some((m) => m.skill === id && m.state === 'confirmed')) return true;
  const diag = ctx.learn.exam?.diagnostic?.[id];
  if (diag && diag.asked > 0 && diag.right * 2 < diag.asked) return true;
  // the floor check: fewer than half right on a fractions stair
  const floor = ctx.learn.floor?.results?.[id];
  if (floor && floor.asked > 0 && floor.right * 2 < floor.asked) return true;
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
function struggling(ctx: Context, id: SkillId, s: MasteryState) {
  return s === 'needs-support' || (ctx.learn.skills[id]?.failedChecks || 0) >= 2;
}

export function nextActions(ctx: Context): Action[] {
  const st = states(ctx);
  const out: Action[] = [];
  const add = (a: Action) => { if (!out.some((x) => x.kind === a.kind && x.skill === a.skill && x.misc === a.misc)) out.push(a); };
  const own = gradeSkillsOf(ctx.grade);
  // with the floor switched on, the bridge stairs come first; otherwise only one already in progress is continued
  const floorOn = !!ctx.learn.floor?.on;
  const gradeSkills = floorOn ? [...BRIDGE_SKILLS, ...own] : own;

  // 1. an exam in the next two weeks
  const exam = ctx.learn.exam;
  if (exam) {
    // days counted the same way as Exam Rescue: from today to the exam's date
    const left = Math.max(0, Math.round(daysBetween(`${ctx.day}T00:00:00`, `${exam.date}T00:00:00`)));
    if (exam.date >= ctx.day && left <= 14) {
      const focus = exam.skills.find((id) => st[id] !== 'mastered') || exam.skills[0];
      if (focus) add({ kind: 'exam', skill: focus, title: `הכנה למבחן: ${titleOf(focus)}`, reason: left === 0 ? 'המבחן היום. הצעד הבא בתוכנית ההכנה מחכה.' : `המבחן בעוד ${left === 1 ? 'יום אחד' : `${left} ימים`}. הצעד הבא בתוכנית ההכנה מחכה.`, minutes: MINUTES.exam, to: '/rescue' });
    }
  }

  // 2. a confirmed misconception (not offered too often, not after it failed twice)
  openMisconceptions(ctx.learn.miscon).forEach((m) => {
    if (m.state !== 'confirmed' || !canOffer(m, ctx.day)) return;
    const def = metaOf(m.skill)?.misconceptions.find((x) => x.id === m.id);
    if (!def) return;
    add({ kind: 'repair', skill: m.skill, misc: m.id, title: `תיקון: ${def.title}`, reason: `ראינו את זה ב־${m.seen.length} שאלות ב${titleOf(m.skill)}. נראה את זה אחרת, ואז נבדוק.`, minutes: MINUTES.repair, to: routeOf.repair(m.skill, m.id) });
  });

  // 3. reviews that are due
  dueReviews(ctx.learn.skills, ctx.now).forEach((id) => {
    const r = ctx.learn.skills[id].mastered!;
    const ago = Math.max(1, Math.round(daysBetween(r.lastReview?.at || r.at, ctx.now)));
    add({ kind: 'review', skill: id, title: `בדיקת זיכרון: ${titleOf(id)}`, reason: r.lastReview && !r.lastReview.ok ? 'בבדיקה הקודמת זה עוד לא נשאר. שלוש שאלות קצרות.' : `שלטתם בזה לפני ${ago} ${ago === 1 ? 'יום' : 'ימים'}. שלוש שאלות כדי לוודא שזה נשאר.`, minutes: MINUTES.review, to: routeOf.check(id, 'review') });
  });

  // 4. a stair that is hard right now: its smallest missing prerequisite
  gradeSkills.forEach((id) => {
    if (!struggling(ctx, id, st[id])) return;
    const p = smallestMissing(ctx, id, st);
    if (p) { const sg = stageOf(ctx, p); add({ kind: 'prereq', skill: p, stage: sg, title: `קודם, ${titleOf(p)}: ${STAGE_NAME[sg]}`, reason: `${titleOf(id)} נשען על ${titleOf(p)}. שלב ${STAGE_N[sg]} מתוך 5 שם יעזור לחזור לזה.`, minutes: STAGE_MIN[sg], to: routeOf.stage(p, sg) }); }
  });

  // 5. the stair in progress: the next stage of its journey (or the mastery check)
  const inProgress = [...(floorOn ? [] : BRIDGE_SKILLS), ...gradeSkills].filter((id) => ['learning', 'practicing', 'needs-support'].includes(st[id]));
  inProgress.forEach((id) => {
    const stage = stageOf(ctx, id);
    if (stage === 'E') add({ kind: 'mastery', skill: id, stage, title: `בדיקת שליטה: ${titleOf(id)}`, reason: 'תרגלתם מספיק. חמש שאלות בלי רמזים יראו אם אתם שולטים בזה לבד.', minutes: MINUTES.mastery, to: routeOf.check(id, 'mastery') });
    else add({ kind: 'continue', skill: id, stage, title: `${STAGE_NAME[stage]}: ${titleOf(id)}`, reason: `שלב ${STAGE_N[stage]} מתוך 5 במדרגה. ${STATE_LABEL[st[id]]}.`, minutes: STAGE_MIN[stage], to: routeOf.stage(id, stage) });
  });

  // 6. the next new stair: the first not started in the grade whose prerequisites are in place
  const fresh = gradeSkills.find((id) => st[id] === 'not-started' && !onPath(ctx, id) && prereqsOf(id).every((p) => !isMissing(ctx, p, st)));
  if (fresh) {
    const sg = stageOf(ctx, fresh);
    const why = prereqsOf(fresh).length ? `מה שצריך בשבילה כבר אצלכם (${prereqsOf(fresh).map(titleOf).join(', ')}).` : `המדרגה הבאה ב${topicTitleOf(fresh)}.`;
    add({ kind: 'new', skill: fresh, stage: sg, title: `${STAGE_NAME[sg]}: ${titleOf(fresh)}`, reason: `מדרגה חדשה, שלב ${STAGE_N[sg]} מתוך 5. ${why}`, minutes: STAGE_MIN[sg], to: routeOf.stage(fresh, sg) });
  }
  // 7. a stair done before mastery checks existed: it stays done, and its mastery check is offered
  const kept = own.find((id) => { const { topic, level } = parseSkill(id); return st[id] !== 'mastered' && st[id] !== 'needs-review' && isKept(ctx.path || {}, topic, level); });
  if (kept) add({ kind: 'mastery', skill: kept, stage: 'E', title: `בדיקת שליטה: ${titleOf(kept)}`, reason: 'המדרגה הושלמה לפני שהיו בדיקות שליטה. חמש שאלות בלי רמזים יראו שזה נשאר.', minutes: MINUTES.mastery, to: routeOf.check(kept, 'mastery') });
  // when everything in the grade is mastered: the earliest mastered stair, for a stronger memory
  if (!out.length) {
    const any = own.find((id) => st[id] === 'mastered');
    if (any) add({ kind: 'review', skill: any, title: `חיזוק: ${titleOf(any)}`, reason: 'כל המדרגות פתוחות. חזרה קצרה שומרת את מה שלמדתם.', minutes: MINUTES.review, to: routeOf.check(any, 'review') });
  }
  return out;
}

export { stairName };
