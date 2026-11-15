// מציל המבחנים (Exam Rescue): from an exam date and its topics to a day-by-day plan that follows real performance.
// The plan is recomputed from the current evidence every time it is shown, so it updates as the student works.
// No grade is promised: the plan says what is known, what is not yet, and what today is for.
import type { ExamPlanInput, ExamPlanState, LearnState, MasteryState, SkillId } from './types';
import { ALL_SKILLS, ancestorsOf, parseSkill, prereqsOf } from './skills';
import { masteryState, independentAccuracy, daysBetween, checkWaits, REVIEW_DAYS } from './mastery';
import { openMisconceptions } from './misconceptions';
import { titleOf, topicTitleOf, routeOf, STAGE_MIN, MINUTES } from './recommend';
// @ts-ignore: plain JS shared with the Worker
import { isRestDay } from '@shared/restDays.js';

/**
 * Where a stair of the exam stands. Two levels of good news, never confused:
 *   mastered  passed a mastery check (5 questions without hints): "שולטים לבד", as everywhere in the app;
 *   ready     answered the first diagnostic right (or practises well): likely ready, not yet mastery.
 */
export type Standing = 'mastered' | 'ready' | 'shaky' | 'gap' | 'untested';
export interface PlanSkill { skill: SkillId; standing: Standing; state: MasteryState; priority: number; why: string }
export interface PlanTask { skill: SkillId | null; kind: 'learn' | 'practice' | 'mastery' | 'review' | 'exam'; title: string; to: string; minutes: number }
/** One day of the plan: its steps and about how many minutes they take. */
export interface PlanDay { day: string; tasks: PlanTask[]; minutes: number }
export interface ExamPlan {
  daysLeft: number; mastered: number; ready: number; total: number; topicsMastered: number; topicsTotal: number;
  skills: PlanSkill[]; days: PlanDay[]; today: PlanTask[]; message: string; diagnosed: boolean;
}

export const DIAG_PER_SKILL = 2;

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

/** About how long each step of the plan takes, in minutes (recommend.ts STAGE_MIN): a lesson is a stair's three teaching stages. */
export const taskMinutes = (kind: PlanTask['kind']): number => ({
  learn: STAGE_MIN.A + STAGE_MIN.B + STAGE_MIN.C, practice: STAGE_MIN.D, mastery: STAGE_MIN.E, review: MINUTES.review, exam: MINUTES.exam,
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
  const tasksOf = (p: PlanSkill): PlanTask[] => {
    const t = titleOf(p.skill); const { topic, level } = parseSkill(p.skill);
    const lesson = task(p.skill, 'learn', `לומדים: ${t}`, routeOf.journey(p.skill));
    const practice = (part: number, word: string) => task(p.skill, 'practice', `${word}: ${t}`, `/lesson/${topic}/${level}?part=${part}`);
    const check = task(p.skill, 'mastery', `בדיקת שליטה: ${t}`, routeOf.check(p.skill, 'mastery'));
    if (p.standing === 'gap' || p.standing === 'untested') return [lesson, practice(1, 'מתרגלים'), check];
    if (p.standing === 'shaky') return [practice(2, 'מחזקים'), check];
    // a good first diagnostic is confirmed by the mastery check, not assumed; after a failed check, practice comes first
    // (mastery.ts checkWaits: the check returns after fresh right answers)
    if (p.standing === 'ready') return checkWaits(learn.skills[p.skill]) ? [practice(2, 'מחזקים'), check] : [check];
    return [task(p.skill, 'review', `חזרה קצרה: ${t}`, routeOf.check(p.skill, 'review'))];
  };

  // Each stair's steps, in the plan's order: the stairs to work on, then the checks of the ready ones and the reviews
  // of the mastered ones. The practice exam closes the last day.
  const chains = [...order.filter(toWork), ...order.filter((p) => p.standing === 'ready'), ...order.filter((p) => p.standing === 'mastered')].map(tasksOf);
  const finale = task(null, 'exam', 'מבחן תרגול על כל הנושאים', '/rescue/exam');
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

  const mastered = skills.filter((s) => s.standing === 'mastered').length;
  const ready = skills.filter((s) => s.standing === 'ready').length;
  const n = skills.length;
  const topics = [...new Set(chosen.map((id) => parseSkill(id).topic))];
  const topicsMastered = topics.filter((t) => skills.filter((s) => parseSkill(s.skill).topic === t).every((s) => s.standing === 'mastered')).length;
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
  return { daysLeft, mastered, ready, total: n, topicsMastered, topicsTotal: topics.length, skills: order, days: shown, today: days.find((d) => d.day === today)?.tasks || [], message, diagnosed };
}

/** The skills of a topic in the student's grade (for the topic picker). */
export const skillsOfTopic = (topic: string) => ALL_SKILLS.filter((s) => parseSkill(s).topic === topic);
export { topicTitleOf, prereqsOf };
