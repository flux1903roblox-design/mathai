// מציל המבחנים (Exam Rescue): from an exam date and its topics to a day-by-day plan that follows real performance.
// The plan is recomputed from the current evidence every time it is shown, so it updates as the student works.
// No grade is promised: the plan says what is known, what is not yet, and what today is for.
import type { ExamPlanInput, ExamPlanState, LearnState, MasteryState, SkillId } from './types';
import { ALL_SKILLS, ancestorsOf, parseSkill, prereqsOf } from './skills';
import { masteryState, independentAccuracy, daysBetween, checkWaits, REVIEW_DAYS } from './mastery';
import { openMisconceptions } from './misconceptions';
import { titleOf, topicTitleOf, routeOf, STAGE_MIN, MINUTES } from './recommend';
import { hasContent } from './content/index';
// @ts-ignore: plain JS shared with the Worker
import { isRestDay } from '@shared/restDays.js';

/**
 * Where a stair of the exam stands. Two levels of good news, never confused:
 *   mastered  passed a mastery check (5 questions without hints): "שולטים לבד", as everywhere in the app;
 *   ready     answered the first diagnostic right (or practises well): likely ready, not yet mastery.
 */
export type Standing = 'mastered' | 'ready' | 'shaky' | 'gap' | 'untested';
export interface PlanSkill { skill: SkillId; standing: Standing; state: MasteryState; priority: number; why: string }
export interface PlanTask { skill: SkillId | null; kind: 'learn' | 'practice' | 'mastery' | 'review' | 'exam' | 'rule' | 'quick'; title: string; to: string; minutes: number }
/** One day of the plan: its steps and about how many minutes they take. */
export interface PlanDay { day: string; tasks: PlanTask[]; minutes: number }
export interface ExamPlan {
  daysLeft: number; mastered: number; ready: number; total: number; topicsMastered: number; topicsTotal: number;
  skills: PlanSkill[]; days: PlanDay[]; today: PlanTask[]; message: string; diagnosed: boolean;
  /**
   * The evening before the exam, or its morning (EXAM-MATERIAL 2). minutes: what is left for today (on a rest day, for the
   * exam's morning: `rest`); spent: the minutes of the evening's steps already done today; over: spent and what is left
   * go past the minutes chosen; later: the stairs that do not fit, then the practice exam on every stair when tonight's
   * exam covers only tonight's stairs; laterMinutes: their minutes.
   */
  evening?: { later: PlanTask[]; minutes: number; laterMinutes: number; spent: number; over: boolean; rest: boolean };
}

export const DIAG_PER_SKILL = 2;
/** The quick check of the evening before the exam: three questions of one stair, all three right to need no practice. */
export const QUICK_N = 3;
/** About how long one question of a check takes, in seconds: the app's pace (a quick check of 3 in 2 minutes). */
export const PACE_SECS = 40;
/** The most questions a practice exam asks. */
export const EXAM_MAX = 14;
/** How many questions a practice exam over n stairs asks (learn/items.ts checkPlan 'exam'): two a stair, one from six. */
export const examQuestions = (n: number): number => Math.min(EXAM_MAX, n >= 6 ? n : 2 * n);
/** About how long a practice exam over n stairs takes, in minutes: its questions at the app's pace. */
export const examMinutes = (n: number): number => Math.max(1, Math.ceil((examQuestions(n) * PACE_SECS) / 60));

/**
 * A rest day, Shabbat or Yom Tov in Israel (shared/restDays.js, as the streak counts them): the plan puts no work on it,
 * as the store listing promises ("שבת וחגים נשארים חופשיים").
 */
export const isPlanRestDay = (day: string): boolean => isRestDay(day);
/** The line Rescue and the plan's message show on a rest day. */
export const REST_DAY_LINE = 'היום שבת או חג, ואין בו משימות. ממשיכים אחר כך.';

export function validInput(i: Partial<ExamPlanInput>, today: string): string | null {
  if (!i.grade) return 'בחרו כיתה.';
  if (!i.date || i.date < today) return 'בחרו תאריך מבחן מהיום והלאה.';
  if (isRestDay(i.date)) return 'התאריך שבחרתם יוצא בשבת או בחג. כדאי לבדוק שוב את תאריך המבחן.';
  if (!i.skills?.length) return 'בחרו לפחות נושא אחד שיהיה במבחן.';
  if (!i.minutes || i.minutes < 5) return 'כמה דקות ביום יש לכם? לפחות 5.';
  return null;
}

export const newPlan = (i: ExamPlanInput, at: string): ExamPlanState => ({ ...i, skills: ALL_SKILLS.filter((s) => i.skills.includes(s)), createdAt: at });

/** Record the diagnostic answers of one skill. */
export function recordDiagnostic(plan: ExamPlanState, skill: SkillId, right: number, asked: number, at: string): ExamPlanState {
  const cur = plan.diagnostic?.[skill];
  return { ...plan, diagnostic: { ...(plan.diagnostic || {}), [skill]: { asked: (cur?.asked || 0) + asked, right: (cur?.right || 0) + right, at } } };
}
/** A quick check of one stair (the evening before the exam): kept as its last result, and counted as diagnostic evidence. */
export const recordQuick = (plan: ExamPlanState, skill: SkillId, right: number, asked: number, at: string): ExamPlanState => ({
  ...recordDiagnostic(plan, skill, right, asked, at), quick: { ...(plan.quick || {}), [skill]: { asked, right, at } },
});
/** A stair's rule card was read. */
export const seeRule = (plan: ExamPlanState, skill: SkillId, at: string): ExamPlanState => ({ ...plan, rules: { ...(plan.rules || {}), [skill]: at } });

function standingOf(learn: LearnState, plan: ExamPlanState, id: SkillId, now: string): { standing: Standing; state: MasteryState; why: string } {
  const state = masteryState(learn.skills[id], now);
  const misc = openMisconceptions(learn.miscon).filter((m) => m.skill === id);
  const d = plan.diagnostic?.[id];
  const acc = independentAccuracy(learn.skills[id], 8);
  if (misc.length) return { standing: 'gap', state, why: 'נמצאה טעות שחוזרת על עצמה' };
  if (state === 'mastered') return { standing: 'mastered', state, why: 'עברתם בדיקת שליטה, בלי רמזים' };
  if (state === 'needs-support') return { standing: 'gap', state, why: 'בתרגול האחרון רוב התשובות לא יצאו' };
  if (state === 'needs-review') return { standing: 'shaky', state, why: 'שלטתם בזה, והגיע הזמן לחזור' };
  if (d && d.asked) {
    // the first diagnostic is two questions: a good sign, not mastery
    if (d.right === d.asked && (acc == null || acc >= 0.75)) return { standing: 'ready', state, why: 'ענו נכון על שאלות הבדיקה הראשונה. בדיקת שליטה תאשר' };
    if (d.right * 2 >= d.asked) return { standing: 'shaky', state, why: 'חלק מהבדיקה הראשונה הצליח' };
    return { standing: 'gap', state, why: 'הבדיקה הראשונה לא הצליחה' };
  }
  if (acc != null && acc >= 0.8 && (learn.skills[id]?.attempts.length || 0) >= 5) return { standing: 'ready', state, why: 'מתרגלים בהצלחה. בדיקת שליטה תאשר' };
  return { standing: 'untested', state, why: 'עוד לא בדקנו' };
}

const CHECKS = ['mastery', 'review', 'verify', 'diagnostic', 'exam', 'class', 'floor', 'quick'];
const sum = (tasks: PlanTask[]) => tasks.reduce((a, t) => a + t.minutes, 0);
const SCORE: Record<Standing, number> = { gap: 6, untested: 4, shaky: 2, ready: 1, mastered: 0 };
const toWork = (p: PlanSkill) => p.standing !== 'mastered' && p.standing !== 'ready';

/**
 * The skills in the given order, except that a skill still to work on comes after every chosen prerequisite (direct or
 * through others) that is still to work on too. Stable: the given order decides everything else.
 */
export function prereqsFirst(list: PlanSkill[]): PlanSkill[] {
  const out: PlanSkill[] = []; const placed = new Set<SkillId>();
  const place = (p: PlanSkill) => {
    if (placed.has(p.skill)) return;
    placed.add(p.skill);
    if (toWork(p)) { const anc = ancestorsOf(p.skill); list.filter((q) => toWork(q) && anc.includes(q.skill)).forEach(place); }
    out.push(p);
  };
  list.forEach(place);
  return out;
}

/** A stair's teaching stages, in order: a lesson on the plan is the ones not yet done. */
const TEACH = ['A', 'B', 'C'] as const;
/**
 * The evening's order (the council's round 3): one stair of each topic, then a second of each, and so on, so a short
 * evening reaches every topic of the exam before it goes deeper into one. The topics go weakest first (the most urgent
 * standing among their stairs: a known mistake, then untested, shaky, ready, mastered), ties in the plan's order; within
 * a topic, the weaker stair first, ties in the plan's order (so a stair another leans on still comes before it). The
 * evening then puts a stair started tonight before the rest (examPlan), so it is finished first.
 */
export function byTopicRounds(list: PlanSkill[]): PlanSkill[] {
  const topics: string[] = []; const by = new Map<string, PlanSkill[]>();
  list.forEach((p) => { const t = parseSkill(p.skill).topic; if (!by.has(t)) { by.set(t, []); topics.push(t); } by.get(t)!.push(p); });
  const need = (t: string) => Math.max(...by.get(t)!.map((p) => SCORE[p.standing]));
  const ranked = [...topics].sort((a, b) => need(b) - need(a) || topics.indexOf(a) - topics.indexOf(b));
  ranked.forEach((t) => { const l = by.get(t)!; by.set(t, [...l].sort((a, b) => SCORE[b.standing] - SCORE[a.standing] || l.indexOf(a) - l.indexOf(b))); });
  const out: PlanSkill[] = [];
  for (let i = 0; out.length < list.length; i += 1) ranked.forEach((t) => { const p = by.get(t)![i]; if (p) out.push(p); });
  return out;
}

/**
 * About how long each step of the plan takes, in minutes (recommend.ts STAGE_MIN): a lesson is a stair's three teaching
 * stages (the plan gives a stair taught in part only the stages left, examPlan tasksOf).
 */
export const taskMinutes = (kind: PlanTask['kind']): number => ({
  learn: STAGE_MIN.A + STAGE_MIN.B + STAGE_MIN.C, practice: STAGE_MIN.D, mastery: STAGE_MIN.E, review: MINUTES.review, exam: MINUTES.exam,
  // the evening before the exam: reading a stair's rule card (its rule, a worked example: 65 to 190 words), and its quick
  // check of QUICK_N questions at the app's pace. (The plan times a practice exam by its stairs: examMinutes.)
  rule: 2, quick: Math.ceil((QUICK_N * PACE_SECS) / 60),
}[kind]);

/**
 * How a stair's steps may share days. 'apart': each on a later day than the one before it, so a lesson, its practice
 * and its check fall on three days and the check asks what stayed overnight; 'check-apart': the practice may share a
 * day, but the check comes on a later day than its lesson; 'together': any (only when the exam is a day or less away).
 */
type Spacing = 'apart' | 'check-apart' | 'together';
/**
 * The day of each step of each stair (chains, in the plan's order), placed day by day from the first, each day up to its
 * room in minutes, no stair starting before the one before it; null when a step does not fit before the exam.
 * A step longer than the student's `minutes` (a 12-minute lesson on a 10-minute day) cannot be cut, so it fills a day of
 * its own: an empty day before the last one takes it alone. That is not a tight plan.
 */
function place(chains: PlanTask[][], room: number[], spacing: Spacing, minutes = Infinity): number[][] | null {
  const used = room.map(() => 0);
  const at: number[][] = chains.map(() => []);
  const next = chains.map(() => 0);
  const earliest = (c: number, i: number) => {
    // the stairs start in the plan's order (a prerequisite still to strengthen before the stairs that lean on it)
    if (i === 0) return c === 0 ? 0 : at[c - 1][0] ?? Infinity;
    const prev = at[c][i - 1];
    if (spacing === 'apart') return prev + 1;
    const lesson = chains[c].findIndex((t) => t.kind === 'learn');
    if (spacing === 'check-apart' && chains[c][i].kind === 'mastery' && lesson >= 0 && lesson < i) return Math.max(prev, at[c][lesson] + 1);
    return prev;
  };
  const fits = (d: number, m: number) => used[d] + m <= room[d] || (used[d] === 0 && m > minutes && d < room.length - 1);
  for (let d = 0; d < room.length; d += 1) {
    for (let moved = true; moved;) {
      moved = false;
      chains.forEach((ch, c) => {
        const i = next[c];
        if (i >= ch.length || earliest(c, i) > d || !fits(d, ch[i].minutes)) return;
        at[c][i] = d; used[d] += ch[i].minutes; next[c] = i + 1; moved = true;
      });
    }
  }
  return next.every((i, c) => i === chains[c].length) ? at : null;
}

/**
 * The days of the plan's steps over n days of `minutes` each, the last keeping room for the practice exam. Within the
 * student's minutes: each step on its own day if that fits, else the practice beside its lesson or its check (a step
 * longer than the minutes fills a day of its own, see place). Only when neither fits (the plan is tight) does a day hold
 * more than the minutes chosen, as little more as fits, and at each such cap three separate days are tried first again;
 * only with one day before the exam may a check share the day of its lesson. `cap` is the most minutes a day then holds:
 * above `minutes` only when the plan is tight.
 */
export function schedule(chains: PlanTask[][], n: number, minutes: number, examMinutes: number): { at: number[][]; cap: number } {
  const room = (cap: number) => Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.max(0, cap - examMinutes) : cap));
  const spaced: Spacing[] = ['apart', 'check-apart'];
  for (const spacing of spaced) { const at = place(chains, room(minutes), spacing, minutes); if (at) return { at, cap: minutes }; }
  const total = chains.flat().reduce((a, t) => a + t.minutes, 0) + examMinutes;
  for (let cap = n === 1 ? minutes : minutes + 1; cap <= total + examMinutes + 60; cap += 1) {
    for (const spacing of n === 1 ? ['together' as Spacing] : spaced) { const at = place(chains, room(cap), spacing, minutes); if (at) return { at, cap }; }
  }
  // (cannot happen: with the whole plan's minutes a day, everything fits in two days)
  return { at: chains.map((ch) => ch.map(() => 0)), cap: total };
}

/** The plan, from the exam's skills and the evidence so far. */
export function examPlan(plan: ExamPlanState, learn: LearnState, now: string, today: string): ExamPlan {
  const daysLeft = Math.max(0, Math.ceil(daysBetween(`${today}T00:00:00`, `${plan.date}T00:00:00`)));
  const chosen = plan.skills;
  // prerequisites that are a gap come first: a chosen skill that others in the exam lean on weighs more
  const skills: PlanSkill[] = chosen.map((id) => {
    const s = standingOf(learn, plan, id, now);
    const leanedOn = chosen.filter((o) => o !== id && ancestorsOf(o).includes(id)).length;
    const lowConfidence = plan.confidence <= 2 ? 0.5 : 0;
    return { skill: id, ...s, priority: SCORE[s.standing] + leanedOn + (s.standing === 'mastered' ? 0 : lowConfidence) };
  });
  // order: by priority, then a stable pass that puts every chosen prerequisite still to work on (not mastered, not
  // ready) before the stairs that lean on it: a stair's lesson never comes before strengthening what it uses
  const byPriority = [...skills].sort((a, b) => b.priority - a.priority || ALL_SKILLS.indexOf(a.skill) - ALL_SKILLS.indexOf(b.skill));
  const order = prereqsFirst(byPriority);
  const diagnosed = chosen.every((id) => (plan.diagnostic?.[id]?.asked || 0) > 0);

  const task = (skill: SkillId | null, kind: PlanTask['kind'], title: string, to: string): PlanTask => ({ skill, kind, title, to, minutes: taskMinutes(kind) });
  // the practice exam on every stair, timed by its questions (examMinutes), not by a flat estimate
  const finale = { ...task(null, 'exam', 'מבחן תרגול על כל הנושאים', '/rescue/exam'), minutes: examMinutes(chosen.length) };
  const mastered = skills.filter((s) => s.standing === 'mastered').length;
  const ready = skills.filter((s) => s.standing === 'ready').length;
  const topics = [...new Set(chosen.map((id) => parseSkill(id).topic))];
  const topicsMastered = topics.filter((t) => skills.filter((s) => parseSkill(s.skill).topic === t).every((s) => s.standing === 'mastered')).length;
  const counts = { daysLeft, mastered, ready, total: skills.length, topicsMastered, topicsTotal: topics.length, skills: order };

  if (daysLeft <= 1) {
    // EXAM-MATERIAL 2: the evening before the exam (or its morning). For each stair, weakest first: its rule card, a quick
    // check of QUICK_N questions, practice only where the check failed; then a practice exam. What was done since the day
    // before the exam counts as done; the minutes of what was done TODAY count against the minutes chosen, so the list
    // does not grow back as the evening goes on. A stair already started tonight stays tonight's; others join while they
    // fit beside the exam, whole; the rest wait apart ("אם יש עוד זמן"). Teach before test: when stairs wait apart,
    // tonight's practice exam asks only tonight's stairs, and the exam on every stair closes the waiting list. On Shabbat
    // or Yom Tov the steps wait for the exam's morning.
    const since = new Date(new Date(`${plan.date}T12:00:00`).getTime() - 864e5).toLocaleDateString('en-CA');
    const fresh = (at?: string) => !!at && at.slice(0, 10) >= since;
    const onToday = (at?: string) => !!at && new Date(at).toLocaleDateString('en-CA') === today;
    // a practice lesson finished after the check (a check also logs 'lesson-done', with its purpose)
    const practiceAfter = (s: SkillId, at: string) => learn.events.filter((x) => x.e === 'lesson-done' && x.s === s && x.t > at && !CHECKS.includes(String(x.p)));
    const RULE = taskMinutes('rule'); const QUICK = taskMinutes('quick'); const PRACTICE = taskMinutes('practice');
    // one stair of each topic before a second of any (byTopicRounds): 15 minutes reach two topics, 30 every topic
    const stairs = byTopicRounds(order).map((p) => {
      const t = titleOf(p.skill); const { topic, level } = parseSkill(p.skill);
      const ruleAt = plan.rules?.[p.skill]; const ruled = fresh(ruleAt);
      const q = plan.quick?.[p.skill]; const checked = !!q && fresh(q.at);
      const practised = checked && q.right < q.asked ? practiceAfter(p.skill, q.at) : [];
      const steps = [
        ...(ruled ? [] : [task(p.skill, 'rule', `נזכרים בכלל: ${t}`, `/rescue/rule/${topic}/${level}`)]),
        ...(!checked ? [task(p.skill, 'quick', `בדיקה מהירה: ${t}`, `/rescue/check?skill=${p.skill}`)]
          : q.right < q.asked && !practised.length ? [task(p.skill, 'practice', `מתרגלים: ${t}`, routeOf.stage(p.skill, 'D'))] : []),
      ];
      const spent = (ruled && onToday(ruleAt) ? RULE : 0) + (checked && onToday(q.at) ? QUICK : 0) + (practised.some((x) => onToday(x.t)) ? PRACTICE : 0);
      return { skill: p.skill, steps, started: ruled || checked, spent };
    });
    const exams = learn.events.filter((x) => x.e === 'rescue-exam-done' && x.t.slice(0, 10) >= since);
    const fullDone = exams.some((x) => x.p !== 'part');
    const partDone = exams.some((x) => x.p === 'part');
    const spent = stairs.reduce((a, x) => a + x.spent, 0) + exams.filter((x) => onToday(x.t)).reduce((a, x) => a + examMinutes(x.k || chosen.length), 0);
    // tonight's stairs: those started tonight, then whole stairs in the plan's order while they fit beside the exam
    const tonight = new Set(stairs.filter((x) => x.started).map((x) => x.skill));
    const left: PlanTask[] = []; const later: PlanTask[] = [];
    // once tonight's exam is done, tonight's list is closed: what waits keeps waiting
    let spill = partDone || fullDone;
    // a stair started tonight is finished first (its practice after a shaky quick check), then the rest in order
    [...stairs.filter((x) => x.started), ...stairs.filter((x) => !x.started)].forEach((x) => {
      if (!x.steps.length) return;
      if (x.started) { left.push(...x.steps); return; }
      const exam = fullDone || partDone ? 0 : examMinutes(tonight.size + 1);
      if (!spill && (!tonight.size || spent + sum(left) + sum(x.steps) + exam <= plan.minutes)) { left.push(...x.steps); tonight.add(x.skill); } else { spill = true; later.push(...x.steps); }
    });
    if (!fullDone) {
      if (!later.length) left.push(finale);
      else {
        // teach before test: tonight's exam asks tonight's stairs only; the exam on every stair waits with the rest
        const ids = chosen.filter((id) => tonight.has(id));
        // (on a rest day the steps wait for after it or the morning: no "הערב")
        const when = isRestDay(today) && daysLeft > 0 ? '' : daysLeft ? ' הערב' : ' הבוקר';
        if (!partDone && ids.length) left.push({ ...task(null, 'exam', `מבחן תרגול על מה שעברנו${when}`, `/rescue/exam?skills=${ids.join(',')}`), minutes: examMinutes(ids.length) });
        later.push(finale);
      }
    }
    const rest = isRestDay(today) && daysLeft > 0;
    const evening = `המבחן ${daysLeft ? 'מחר' : 'היום'}.`;
    const message = rest ? `${evening} ${REST_DAY_LINE}` : !left.length ? `${evening} עשיתם את כל מה שתכננו${spent ? ' להיום' : ''}.`
      : `${evening} ${daysLeft ? 'הערב' : 'לפני המבחן'}: כלל קצר ובדיקה מהירה לכל מדרגה, תרגול רק איפה שצריך, ובסוף מבחן תרגול.`;
    const minutes = sum(left);
    return {
      ...counts, days: [{ day: rest ? plan.date : today, tasks: left, minutes }], today: rest ? [] : left, message, diagnosed: true,
      evening: { later, minutes, laterMinutes: sum(later), spent: rest ? 0 : spent, over: (rest ? 0 : spent) + minutes > plan.minutes, rest },
    };
  }
  const tasksOf = (p: PlanSkill): PlanTask[] => {
    const t = titleOf(p.skill); const { topic, level } = parseSkill(p.skill);
    // the teaching stages still to do: a stair already taught (A–C done) is not taught again, and a stair taught in part
    // has a lesson as long as what is left of it (its button, the stair's page, opens at the next stage: mastery.ts
    // nextStage). A stair without teaching content has no lesson at all (recommend.ts stairStage).
    const taught = learn.skills[p.skill]?.taught || {};
    const left = hasContent(p.skill) ? TEACH.filter((st) => !taught[st]) : [];
    const lesson = left.length ? [{ ...task(p.skill, 'learn', `לומדים: ${t}`, routeOf.journey(p.skill)), minutes: left.reduce((a, st) => a + STAGE_MIN[st], 0) }] : [];
    const practice = (part: number, word: string) => task(p.skill, 'practice', `${word}: ${t}`, `/lesson/${topic}/${level}?part=${part}`);
    const check = task(p.skill, 'mastery', `בדיקת שליטה: ${t}`, routeOf.check(p.skill, 'mastery'));
    if (p.standing === 'gap' || p.standing === 'untested') return [...lesson, practice(1, 'מתרגלים'), check];
    if (p.standing === 'shaky') return [practice(2, 'מחזקים'), check];
    // a good first diagnostic is confirmed by the mastery check, not assumed; after a failed check, practice comes first
    // (mastery.ts checkWaits: the check returns after fresh right answers)
    if (p.standing === 'ready') return checkWaits(learn.skills[p.skill]) ? [practice(2, 'מחזקים'), check] : [check];
    return [task(p.skill, 'review', `חזרה קצרה: ${t}`, routeOf.check(p.skill, 'review'))];
  };

  // Each stair's steps, in the plan's order: the stairs to work on, then the checks of the ready ones and the reviews
  // of the mastered ones. The practice exam closes the last day.
  const chains = [...order.filter(toWork), ...order.filter((p) => p.standing === 'ready'), ...order.filter((p) => p.standing === 'mastered')].map(tasksOf);
  // the days from today to the day before the exam (with 0 days left, today), without Shabbat and Yom Tov
  const workDays: string[] = [];
  for (let d = 0; d < Math.max(1, daysLeft); d += 1) {
    const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() + d);
    const key = date.toLocaleDateString('en-CA');
    if (!isRestDay(key)) workDays.push(key);
  }
  // only rest days are left before the exam: what there is to do waits for the morning of the exam day
  if (!workDays.length) workDays.push(plan.date);
  const { at, cap } = schedule(chains, workDays.length, plan.minutes, finale.minutes);
  const days: PlanDay[] = workDays.map((day) => ({ day, tasks: [], minutes: 0 }));
  chains.forEach((ch, c) => ch.forEach((t, i) => days[at[c][i]].tasks.push(t)));
  // Days with no first step of any stair: short reviews of the stairs already checked, spaced as the app spaces its
  // reviews (mastery.ts REVIEW_DAYS: a day after the check, then three days, then seven), two at most a day, within
  // the student's minutes. A day of the plan left empty is a rest from it.
  const free = days.map((d) => !d.tasks.length);
  const touched = chains.map((ch, c) => ({ last: ch[ch.length - 1], day: at[c][ch.length - 1], n: 0 })).filter((x) => x.last.skill);
  days.forEach((d, i) => {
    if (!free[i]) return;
    let left = (i === days.length - 1 ? plan.minutes - finale.minutes : plan.minutes);
    [...touched].sort((x, y) => x.day - y.day).forEach((x) => {
      const r = taskMinutes('review');
      if (d.tasks.length >= 2 || left < r || daysBetween(`${workDays[x.day]}T12:00:00`, `${d.day}T12:00:00`) < REVIEW_DAYS[Math.min(x.n, REVIEW_DAYS.length - 1)]) return;
      d.tasks.push(task(x.last.skill, 'review', `חזרה קצרה: ${titleOf(x.last.skill!)}`, routeOf.check(x.last.skill!, 'review')));
      x.day = i; x.n += 1; left -= r;
    });
  });
  days[days.length - 1].tasks.push(finale);
  days.forEach((d) => { d.minutes = d.tasks.reduce((a, t) => a + t.minutes, 0); });
  // a day the plan leaves free (nothing new, no review due) is not shown as a stop of its own; today always is
  const shown = days.filter((d) => d.tasks.length || d.day === today);
  const overflow = cap > plan.minutes ? 1 : 0;

  const n = skills.length;
  const focus = order.filter(toWork).slice(0, 2).map((p) => titleOf(p.skill));
  const when = daysLeft === 0 ? 'המבחן היום.' : daysLeft === 1 ? 'המבחן מחר.' : `יש לכם עוד ${daysLeft} ימים למבחן.`;
  // two different things, said with two different words: mastered (a mastery check) and ready (a good first diagnostic)
  const have = [
    mastered ? `שולטים לבד ב־${mastered} מתוך ${n} המדרגות במבחן.` : '',
    ready ? `${mastered ? `ב־${ready} מדרגות נוספות` : `ב־${ready} מתוך ${n} המדרגות`} עברתם את הבדיקה הראשונה: כנראה מוכנים, ובדיקת שליטה קצרה תאשר.` : '',
  ].filter(Boolean).join(' ');
  const today_ = focus.length ? `היום מתמקדים ב${focus.join(' וב')}.` : ready ? 'היום: בדיקת שליטה קצרה בכל מדרגה כזאת, ובסוף מבחן תרגול.' : 'היום חזרה קצרה ומבחן תרגול.';
  const tight = overflow > 0 ? ' יש יותר עבודה מזמן, אז כל יום עמוס קצת יותר.' : '';
  const restDay = isRestDay(today) && daysLeft > 0 ? ` ${REST_DAY_LINE}` : '';
  const message = diagnosed ? `${when}${have ? ` ${have}` : ''} ${restDay ? restDay.trim() : today_}${tight}` : `${when} נתחיל בבדיקה קצרה, ${DIAG_PER_SKILL} שאלות לכל מדרגה, כדי לדעת על מה לעבוד.`;
  return { ...counts, days: shown, today: days.find((d) => d.day === today)?.tasks || [], message, diagnosed };
}

/** The skills of a topic in the student's grade (for the topic picker). */
export const skillsOfTopic = (topic: string) => ALL_SKILLS.filter((s) => parseSkill(s).topic === topic);
export { topicTitleOf, prereqsOf };
