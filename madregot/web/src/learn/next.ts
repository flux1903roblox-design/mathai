// One "what next" (CURRICULUM-7): a single ranked plan from all the evidence. The home map's focus and its banner,
// today's mission, Exam Rescue's "today" and the profile's next step are all views of this one list, so two buttons can
// never send the student to two different next things, and every suggestion says why in one sentence.
//
// Bands, highest first (rank = band × 100 + place in the band):
//   1 teacher    the teacher's work not done yet, due within 3 days or past by at most 14, earliest due first (the rows
//                TodayCard lists: lib/classRows.js classRows `show`), each to where its row leads (workRoute)
//   2 exam       an exam in the next two weeks: the diagnostic first, then Exam Rescue's steps for today (none on Shabbat)
//   3 repair     a confirmed misconception that can be offered today
//   4 review     a review that is due
//   5 exam-loss  points lost in a checked exam in the last 45 days, on a stair not recovered since
//   6 floor      the fractions floor check, for a hard stair that leans on fractions when there is no floor evidence;
//     prereq     otherwise the smallest missing prerequisite of a hard stair
//   7 mastery    the stair in progress (its next stage, or its mastery check), then a kept stair's mastery check
//     continue
//   8 new        the next new stair: taught by now in the school calendar first, in school order
//   9 challenge  the first unsolved challenge task of a mastered stair (the most recently mastered first). When the
//                student is strong today (their last 3 mastery checks passed on the first attempt, or every stair of
//                the grade mastered) it moves up into band 5, right after the points lost in an exam: never above an
//                exam step, a repair, a due review or an exam loss
//  10            with nothing else but a challenge: a short review of the earliest mastered stair
//
// planNext is pure: the same context gives the same plan. It never reads the clock or the store: `now`, `day`, the
// school `month` and the class's work with this device's reports come in the context (lib/useLearn.js useNext fills
// them).
// A stair the teacher gave is not suggested again lower down at the same stage (add: the same activity), and the
// teacher's work is never a part of today's mission (learn/mission.ts): it has its own rows above it.
import type { Action, ActionKind, LearnEvent, MissionItem, RescueTask, SkillId, SkillRecord, Stage } from './types';
import { ALL_SKILLS, BRIDGE_SKILLS, STAIRS, ancestorsOf, gradeSkillsOf, isBridgeSkill, parseSkill, prereqsOf, skillId } from './skills';
import { dueReviews, daysBetween, STATE_LABEL } from './mastery';
import { openMisconceptions, canOffer } from './misconceptions';
import { metaOf } from './content/index';
import { examPlan, isShabbatDay } from './examRescue';
import { monthIndex, monthNameOf } from './programme';
import { states, isMissing, smallestMissing, struggling, onPath, stairStage, titleOf, topicTitleOf, routeOf, recoveredSince, RECOVER_RIGHT, MINUTES, STAGE_NAME, STAGE_N, STAGE_MIN } from './recommend';
import { firstOpenChallenge } from './challenges/index';
import type { Context } from './recommend';
// @ts-ignore: plain JS
import { focusLevel } from '@/lib/exam.js';
// @ts-ignore: plain JS
import { isKept, isDone, unitNodes } from '@/lib/path.js';
// @ts-ignore: plain JS
import { PARTS } from '@/lib/lesson.js';
// @ts-ignore: plain JS
import { topicsFor, bridgeTopicsFor } from '@/content/index.js';
// @ts-ignore: plain JS
import { classRows, workBanner } from '@/lib/classRows.js';
import type { ClassAssignment } from './assignments';

export type NextKind = ActionKind;
/** Where a suggestion comes from: the class's teacher, Exam Rescue's plan, the learning engine, a checked exam, or the challenge track. */
export type NextSource = 'teacher' | 'rescue' | 'engine' | 'exam-check' | 'challenge';
export interface NextItem extends Action {
  kind: NextKind;
  source: NextSource;
  /** The exam's date, for a step of the exam band; the due day, for the teacher's work. */
  due?: string;
  /** band × 100 + place inside the band: stable, and lower comes first. */
  rank: number;
}
/** One question of a checked exam, as the photo check and the practice exams store it (store.exams[i].result). */
export interface ExamQuestion { topic?: string; level?: number | string | null; status?: string; skill?: string }
/** A checked exam (store.exams): when it was checked, and its questions. */
export interface CheckedExam { id?: string; at: string; title?: string; result?: { questions?: ExamQuestion[] } | null }
export interface NextContext extends Context {
  /** The checked exams, newest first (store.exams). */
  exams?: CheckedExam[];
  /** The school month of `day`: September 0 … June 9 (programme.ts schoolMonth). */
  month: number;
  /**
   * In a class: the teacher's assignments with this device's reports (classWork.assignments, each `mine` merged with
   * the workOutbox report by mergeWork: lib/classRows.js classAssignments). None outside a class.
   */
  classWork?: ClassAssignment[];
}
export interface NextPlan {
  items: NextItem[];
  top: NextItem | null;
  /** Exam Rescue's steps for today (or its diagnostic when the plan has none yet); empty on Shabbat or with no exam. */
  examToday: NextItem[];
  /** Today is Shabbat: the exam plan puts no work on it. */
  restDay: boolean;
}

export const BAND = { teacher: 1, exam: 2, repair: 3, review: 4, 'exam-loss': 5, floor: 6, prereq: 6, mastery: 7, continue: 7, new: 8, challenge: 9, last: 10 } as const;
/** An exam this close puts its steps first. */
export const EXAM_SOON_DAYS = 14;
/** Points lost in a checked exam are worth working on for this long. */
export const EXAM_LOSS_DAYS = 45;
/** Independent right answers on a stair after the exam that count as recovered (recommend.ts: the floor check uses it too). */
export { RECOVER_RIGHT };
/** Mastery checks in a row passed on the first attempt that make a student strong today. */
export const STRONG_CHECKS = 3;

const STEP_REASON = 'זה הצעד של היום בתוכנית ההכנה.';
const examReason = (left: number) => (left === 0 ? `המבחן היום. ${STEP_REASON}` : left === 1 ? `המבחן מחר. ${STEP_REASON}` : `המבחן בעוד ${left} ימים. ${STEP_REASON}`);
/** The stage a Rescue step is (practice is stage D, a mastery check stage E); a lesson or a review names none. */
const TASK_STAGE: Partial<Record<RescueTask, Stage>> = { practice: 'D', mastery: 'E' };
const dayMonth = (iso: string) => { const d = new Date(iso); return `${d.getDate()}.${d.getMonth() + 1}`; };

/** Exam Rescue's steps for today, as plan items: what Rescue shows under "today", in its order. */
function examTodayOf(ctx: NextContext, restDay: boolean): NextItem[] {
  const exam = ctx.learn.exam;
  if (!exam || restDay) return [];
  // days counted as the home card counts them: from today to the exam's date
  const left = Math.max(0, Math.round(daysBetween(`${ctx.day}T00:00:00`, `${exam.date}T00:00:00`)));
  const base = { kind: 'exam' as const, source: 'rescue' as const, due: exam.date, reason: examReason(left), minutes: MINUTES.exam };
  const plan = examPlan(exam, ctx.learn, ctx.now, ctx.day);
  if (!plan.diagnosed) return [{ ...base, skill: '', task: 'diagnostic', title: 'בדיקה קצרה לפני התוכנית', to: '/rescue/check', rank: BAND.exam * 100 }];
  return plan.today.map((t, i) => {
    const stage = TASK_STAGE[t.kind];
    return { ...base, skill: t.skill || '', task: t.kind, ...(stage ? { stage } : {}), title: t.title, to: t.to, rank: BAND.exam * 100 + i };
  });
}

/** The stair a lost exam question is on: its own level when readable, else the level the exam lost most points at. */
function stairOf(q: ExamQuestion, exam: CheckedExam): SkillId | null {
  const topic = q.topic;
  if (!topic || !Object.prototype.hasOwnProperty.call(STAIRS, topic)) return null;
  const lv = Number(q.level);
  const level = Number.isInteger(lv) && lv >= 1 && lv <= STAIRS[topic as keyof typeof STAIRS] ? lv : focusLevel(topic, [exam]);
  return level ? skillId(topic, level) : null;
}

/**
 * Stairs that lost points in a checked exam of the last 45 days and are not recovered, newest exam first. A newer exam
 * that got a stair right settles the older losses on it.
 */
export function examLosses(ctx: NextContext): { skill: SkillId; exam: CheckedExam }[] {
  const now = Date.parse(ctx.now);
  const exams = (ctx.exams || [])
    .filter((e) => e?.at && Date.parse(e.at) <= now && daysBetween(e.at, ctx.now) <= EXAM_LOSS_DAYS)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const seen = new Set<SkillId>();
  const out: { skill: SkillId; exam: CheckedExam }[] = [];
  exams.forEach((ex) => {
    const lost = new Set<SkillId>(); const asked = new Set<SkillId>();
    (ex.result?.questions || []).forEach((q) => {
      const id = stairOf(q, ex);
      if (!id) return;
      asked.add(id);
      if (q.status !== 'correct') lost.add(id);
    });
    ALL_SKILLS.filter((id) => asked.has(id) && !seen.has(id)).forEach((id) => {
      seen.add(id);
      if (lost.has(id) && !recoveredSince(ctx.learn.skills[id], ex.at)) out.push({ skill: id, exam: ex });
    });
  });
  return out;
}

/**
 * Strong today: every stair of the grade is mastered, or the last STRONG_CHECKS mastery checks (the analytics log's
 * 'check-done' events of purpose 'mastery') all passed, each on its stair's first attempt (no failed mastery check on
 * that stair before it). Then a challenge is worth more than the next new stair.
 */
export function strongToday(ctx: Pick<NextContext, 'learn' | 'grade'>): boolean {
  if (gradeSkillsOf(ctx.grade).every((id) => !!ctx.learn.skills[id]?.mastered)) return true;
  const checks = (ctx.learn.events || []).filter((e: LearnEvent) => e.e === 'check-done' && e.p === 'mastery' && !!e.s);
  if (checks.length < STRONG_CHECKS) return false;
  return checks.slice(-STRONG_CHECKS).every((e) => e.ok && !checks.slice(0, checks.indexOf(e)).some((x) => x.s === e.s && !x.ok));
}

/** Why a challenge: the stair is named as the app names stairs ("במדרגה "…""), so every title reads well after ב. */
export const challengeReason = (after: SkillId) => `עברתם את בדיקת השליטה במדרגה "${titleOf(after)}". רוצים משהו קשה יותר?`;

/**
 * "The stair X leans on Y." A stair's title can be any noun phrase, feminine or plural (מציאת השלם, חלוקה ביחס,
 * שברים ועשרוניים מכוונים), so the sentence is built on the noun "המדרגה" and the title is quoted, as challengeReason does.
 */
export const leansOn = (id: SkillId, what: string) => `המדרגה "${titleOf(id)}" נשענת על ${what}.`;

/** One row of lib/classRows.js classRows: the assignment with this device's report, where it leads and its minutes. */
interface TeacherRow { a: ClassAssignment; done: boolean; minutes: number; to: string }
/** The kinds that are a stage of a stair: one the teacher's work names at that stage is not suggested again. */
const TEACHER_COVERS: NextKind[] = ['continue', 'new', 'prereq', 'mastery', 'exam-loss'];

/** Is a stair taught by now in the student's grade (the Ministry's school calendar)? */
const taughtByNow = (ctx: NextContext, id: SkillId) => { const m = monthIndex(id, ctx.grade); return m != null && m <= ctx.month; };

export function planNext(ctx: NextContext): NextPlan {
  const st = states(ctx);
  const items: NextItem[] = [];
  const place: Record<number, number> = {};
  /**
   * Add a suggestion to its band, unless the same one (or the very same activity) is already higher up: the same kind,
   * stair, stage, misconception and assignment, the same route, or a stage of a stair the teacher's work already names
   * (the teacher's stair or check at that very stage).
   */
  const add = (band: number, source: NextSource, a: Action & { due?: string }) => {
    if (items.some((x) => (x.kind === a.kind && x.skill === a.skill && x.stage === a.stage && x.misc === a.misc && x.assignment === a.assignment) || x.to === a.to
      || (x.kind === 'teacher' && !!x.skill && x.skill === a.skill && !!a.stage && x.stage === a.stage && TEACHER_COVERS.includes(a.kind)))) return;
    const n = place[band] || 0; place[band] = n + 1;
    items.push({ ...a, source, rank: band * 100 + n });
  };
  const own = gradeSkillsOf(ctx.grade);
  // with the floor switched on, the bridge stairs come first; otherwise only one already in progress is continued
  const floorOn = !!ctx.learn.floor?.on;
  const gradeSkills = floorOn ? [...BRIDGE_SKILLS, ...own] : own;
  const restDay = isShabbatDay(ctx.day);

  // 1. the teacher's work: what TodayCard's rows show and is not done, in their order (earliest due first, then the
  // order it was given), to where each row leads. A stair names the stage it is at, a mastery check stage E.
  classRows({ assignments: ctx.classWork || [] }, {}, ctx.day).show.filter((r: TeacherRow) => !r.done).forEach((r: TeacherRow) => {
    const { a } = r;
    const skill = a.kind === 'exam' ? '' : a.skill || '';
    const stage: Stage | undefined = a.kind === 'check' ? 'E' : a.kind === 'stair' && skill ? stairStage(skill, ctx.learn.skills[skill]) : undefined;
    add(BAND.teacher, 'teacher', { kind: 'teacher', skill, ...(stage ? { stage } : {}), assignment: a.id, due: a.dueOn, title: a.title, reason: `${workBanner(a.dueOn, ctx.day)}.`, minutes: r.minutes, to: r.to });
  });

  // 2. an exam in the next two weeks: Exam Rescue's steps for today, in its order (teaching before checking)
  const examToday = examTodayOf(ctx, restDay);
  const exam = ctx.learn.exam;
  if (exam && exam.date >= ctx.day && Math.round(daysBetween(`${ctx.day}T00:00:00`, `${exam.date}T00:00:00`)) <= EXAM_SOON_DAYS) {
    examToday.forEach(({ source, rank, ...a }) => add(BAND.exam, source, a));
  }
  // a stair the exam plan works on today is not suggested again as a prerequisite, a stage or a new stair below it
  const examStairs = new Set(items.filter((x) => x.kind === 'exam' && x.skill).map((x) => x.skill));
  const learnAdd = (band: number, a: Action) => { if (!examStairs.has(a.skill)) add(band, 'engine', a); };

  // 3. a confirmed misconception (not offered too often, not after it failed twice)
  openMisconceptions(ctx.learn.miscon).forEach((m) => {
    if (m.state !== 'confirmed' || !canOffer(m, ctx.day)) return;
    const def = metaOf(m.skill)?.misconceptions.find((x) => x.id === m.id);
    if (!def) return;
    add(BAND.repair, 'engine', { kind: 'repair', skill: m.skill, misc: m.id, title: `תיקון: ${def.title}`, reason: `ראינו את זה ב־${m.seen.length} שאלות ב${titleOf(m.skill)}. נראה את זה אחרת, ואז נבדוק.`, minutes: MINUTES.repair, to: routeOf.repair(m.skill, m.id) });
  });

  // 4. reviews that are due
  dueReviews(ctx.learn.skills, ctx.now).forEach((id) => {
    const r = ctx.learn.skills[id].mastered!;
    const ago = Math.max(1, Math.round(daysBetween(r.lastReview?.at || r.at, ctx.now)));
    add(BAND.review, 'engine', { kind: 'review', skill: id, title: `בדיקת זיכרון: ${titleOf(id)}`, reason: r.lastReview && !r.lastReview.ok ? 'בבדיקה הקודמת זה עוד לא נשאר. שלוש שאלות קצרות.' : `שלטתם בזה לפני ${ago} ${ago === 1 ? 'יום' : 'ימים'}. שלוש שאלות כדי לוודא שזה נשאר.`, minutes: MINUTES.review, to: routeOf.check(id, 'review') });
  });

  // 5. points lost in a checked exam: a short practice on the stair, then its check
  examLosses(ctx).forEach(({ skill: id, exam: ex }) => {
    const { topic, level } = parseSkill(id);
    const sg = stairStage(id, ctx.learn.skills[id]);
    // practice done (the mastery check is next, or the stair is mastered or done on the map): its second practice part
    const practiced = sg === 'E' || st[id] === 'mastered' || st[id] === 'needs-review' || isDone(ctx.path || {}, topic, level);
    add(BAND['exam-loss'], 'exam-check', { kind: 'exam-loss', skill: id, ...(practiced ? {} : { stage: sg }), title: `מהמבחן: ${titleOf(id)}`, reason: `במבחן מ־${dayMonth(ex.at)} ירדו כאן נקודות. תרגול קצר ואז בדיקה.`, minutes: MINUTES['exam-loss'], to: practiced ? `/lesson/${topic}/${level}?part=${PARTS}` : routeOf.stage(id, sg) });
  });

  // 9. a challenge task of a mastered stair: at the bottom, or, for a student strong today, right after band 5
  const task = firstOpenChallenge(ctx.learn.skills, ctx.learn.challenges);
  const strong = !!task && strongToday(ctx);
  const challenge = task && { kind: 'challenge' as const, skill: task.after, challengeId: task.id, title: `אתגר: ${task.title}`, reason: challengeReason(task.after), minutes: task.minutes, to: `/challenge/${task.id}` };
  if (challenge && strong) add(BAND['exam-loss'], 'challenge', challenge);

  // 6. a stair that is hard right now: its smallest missing prerequisite, or, when nothing below it is known to be
  // missing but it leans on fractions and there is no floor evidence yet, the short floor check
  let floorOffered = false;
  gradeSkills.forEach((id) => {
    if (!struggling(ctx, id, st[id])) return;
    const p = smallestMissing(ctx, id, st);
    if (p) {
      const sg = stairStage(p, ctx.learn.skills[p]);
      learnAdd(BAND.prereq, { kind: 'prereq', skill: p, stage: sg, title: `קודם, ${titleOf(p)}: ${STAGE_NAME[sg]}`, reason: leansOn(id, `"${titleOf(p)}"`) + ` שלב ${STAGE_N[sg]} מתוך 5 שם יעזור לחזור לזה.`, minutes: STAGE_MIN[sg], to: routeOf.stage(p, sg) });
    } else if (!floorOffered && (ctx.learn.floor ?? null) === null && ancestorsOf(id).some(isBridgeSkill)) {
      floorOffered = true;
      add(BAND.floor, 'engine', { kind: 'floor', skill: id, title: 'בדיקה קצרה של יסודות', reason: leansOn(id, 'יסודות השברים') + ' שש שאלות יראו אם כדאי לחזק אותם קודם.', minutes: MINUTES.floor, to: '/floor' });
    }
  });

  // 7. the stair in progress: the next stage of its journey (or the mastery check)
  const inProgress = [...(floorOn ? [] : BRIDGE_SKILLS), ...gradeSkills].filter((id) => ['learning', 'practicing', 'needs-support'].includes(st[id]));
  inProgress.forEach((id) => {
    const stage = stairStage(id, ctx.learn.skills[id]);
    if (stage === 'E') learnAdd(BAND.mastery, { kind: 'mastery', skill: id, stage, title: `בדיקת שליטה: ${titleOf(id)}`, reason: 'תרגלתם מספיק. חמש שאלות בלי רמזים יראו אם אתם שולטים בזה לבד.', minutes: MINUTES.mastery, to: routeOf.check(id, 'mastery') });
    else learnAdd(BAND.continue, { kind: 'continue', skill: id, stage, title: `${STAGE_NAME[stage]}: ${titleOf(id)}`, reason: `שלב ${STAGE_N[stage]} מתוך 5 במדרגה. ${STATE_LABEL[st[id]]}.`, minutes: STAGE_MIN[stage], to: routeOf.stage(id, stage) });
  });
  // and a stair done before mastery checks existed: it stays done, and its mastery check is offered
  const kept = own.find((id) => { const { topic, level } = parseSkill(id); return st[id] !== 'mastered' && st[id] !== 'needs-review' && isKept(ctx.path || {}, topic, level); });
  if (kept) learnAdd(BAND.mastery, { kind: 'mastery', skill: kept, stage: 'E', title: `בדיקת שליטה: ${titleOf(kept)}`, reason: 'המדרגה הושלמה לפני שהיו בדיקות שליטה. חמש שאלות בלי רמזים יראו שזה נשאר.', minutes: MINUTES.mastery, to: routeOf.check(kept, 'mastery') });

  // 8. the next new stair. A candidate is the first stair of its unit not started and not passed on the map (so the
  // engine never skips ahead inside a unit the map climbs in order), with its prerequisites in place. The bridge
  // stairs come first while the floor is on; then stairs the school calendar has taught by now, in school order;
  // then the rest, in the same order.
  const fresh = (id: SkillId) => st[id] === 'not-started' && !onPath(ctx, id);
  const firstOfUnit = (id: SkillId) => { const { topic, level } = parseSkill(id); for (let l = 1; l < level; l += 1) if (fresh(skillId(topic, l))) return false; return true; };
  const ready = (id: SkillId) => fresh(id) && firstOfUnit(id) && prereqsOf(id).every((p) => !isMissing(ctx, p, st));
  const candidates = [...(floorOn ? BRIDGE_SKILLS : []), ...own.filter((id) => taughtByNow(ctx, id)), ...own.filter((id) => !taughtByNow(ctx, id))];
  const next = candidates.find((id) => ready(id) && !examStairs.has(id));
  if (next) {
    const sg = stairStage(next, ctx.learn.skills[next]);
    // a bridge stair the student never touched is not named as something they have: it is only absent from the evidence
    const have = prereqsOf(next).filter((p) => !isBridgeSkill(p) || st[p] !== 'not-started');
    const why = have.length ? `מה שצריך בשבילה כבר אצלכם (${have.map(titleOf).join(', ')}).` : `המדרגה הבאה ב${topicTitleOf(next)}.`;
    const when = !isBridgeSkill(next) && taughtByNow(ctx, next) ? ` לפי תוכנית הלימודים, זה נלמד בכיתה ב${monthNameOf(monthIndex(next, ctx.grade)!)}.` : '';
    learnAdd(BAND.new, { kind: 'new', skill: next, stage: sg, title: `${STAGE_NAME[sg]}: ${titleOf(next)}`, reason: `מדרגה חדשה, שלב ${STAGE_N[sg]} מתוך 5. ${why}${when}`, minutes: STAGE_MIN[sg], to: routeOf.stage(next, sg) });
  }

  if (challenge && !strong) add(BAND.challenge, 'challenge', challenge);

  // 10. when nothing is left but a challenge (everything in the grade mastered): the earliest mastered stair, for a
  // stronger memory, after the challenge
  if (!items.some((x) => x.kind !== 'challenge')) {
    const any = own.find((id) => st[id] === 'mastered');
    if (any) add(BAND.last, 'engine', { kind: 'review', skill: any, title: `חיזוק: ${titleOf(any)}`, reason: 'כל המדרגות פתוחות. חזרה קצרה שומרת את מה שלמדתם.', minutes: MINUTES.review, to: routeOf.check(any, 'review') });
  }

  items.sort((a, b) => a.rank - b.rank);
  return { items, top: items[0] || null, examToday, restDay };
}

// ------------------------------------------------------------------ the views: one selector per surface
// Pure, so the "one next" test checks exactly what the screens show without rendering them.

/** The kinds that are a stair of the map: the map focuses them, and no banner repeats them. */
export const STAIR_KINDS: NextKind[] = ['continue', 'mastery', 'new', 'prereq'];
const unitOf = (it: Pick<Action, 'skill'>) => parseSkill(it.skill).topic as string;

/** The units the home map draws: the grade's own, and above them the fractions floor while it is on. */
export function mapTopics(grade: '7' | '8', floorOn: boolean): { id: string; bridge?: boolean }[] {
  return [...(floorOn ? bridgeTopicsFor(grade) : []), ...topicsFor(grade)];
}

/** Is the item a stair of the map now shown? (Otherwise the home shows it in the banner above the path.) */
export const onMap = (it: Action | null | undefined, topicIds: string[]) => !!it && STAIR_KINDS.includes(it.kind) && topicIds.includes(unitOf(it));

/** TodayCard's primary button: the mission's first unfinished item. */
export const missionNext = <T extends MissionItem>(items: T[]): T | null => items.find((i) => !i.done) || null;

/** The board chip "{n} דברים לחזק": misconceptions to repair and points lost in an exam. */
export const toStrengthen = (items: Action[]) => items.filter((i) => i.kind === 'repair' || i.kind === 'exam-loss').length;

export interface MapNode { kind: 'node' | 'review'; topic: string; level: number; state: 'done' | 'open' | 'current' | 'locked'; parts: number }

/**
 * The route of a stair card's own main button: the next stage of the current stair; the mastery check of a stair passed
 * over (open) or kept from before checks; none for a mastered or a locked stair (their buttons are secondary).
 */
export function nodeRoute(node: MapNode, rec: SkillRecord | undefined): string | null {
  if (node.kind !== 'node') return null;
  const id = skillId(node.topic, node.level);
  if (node.state === 'current') return routeOf.stage(id, stairStage(id, rec));
  if (node.state === 'open' || (node.state === 'done' && !rec?.mastered)) return routeOf.check(id, 'mastery');
  return null;
}

/**
 * The map's focus. The unit: the one a lesson came back from, else top's when top is a stair of the map, else the
 * unit practised last, else the grade's first. The node: top's stair when the focus is top's unit on a fresh open,
 * else the unit's current node. `next` is set when the focused node is top's stair: its card's main button is top.
 */
export function mapFocus({ from, top, lastTopic, topicIds, firstId, path }: { from?: string | null; top: NextItem | null; lastTopic?: string | null; topicIds: string[]; firstId?: string | null; path: Record<string, unknown> }): { topic: string | null; node: MapNode | null; key: string | null; next: NextItem | null } {
  const topUnit = top && onMap(top, topicIds) ? unitOf(top) : null;
  const topic = [from, topUnit, lastTopic].find((id) => !!id && topicIds.includes(id)) || firstId || null;
  if (!topic) return { topic: null, node: null, key: null, next: null };
  const nodes = unitNodes(topic, path) as MapNode[];
  const isTop = !from && topUnit === topic;
  const node = (isTop ? nodes.find((n) => n.kind === 'node' && n.level === parseSkill(top!.skill).level) : nodes.find((n) => n.state === 'current')) || null;
  return { topic, node, key: node ? `${topic}:${node.kind}:${node.level}` : null, next: isTop ? top : null };
}

/** The main button of the focused card: top's route when the node is top's stair, else the card's own. */
export const cardRoute = (node: MapNode, rec: SkillRecord | undefined, next: NextItem | null) => (next ? next.to : nodeRoute(node, rec));
