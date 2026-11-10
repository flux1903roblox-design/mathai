// מציל המבחנים (Exam Rescue): from an exam date and its topics to a day-by-day plan that follows real performance.
// The plan is recomputed from the current evidence every time it is shown, so it updates as the student works.
// No grade is promised: the plan says what is known, what is not yet, and what today is for.
import type { ExamPlanInput, ExamPlanState, LearnState, MasteryState, SkillId } from './types';
import { ALL_SKILLS, ancestorsOf, parseSkill, prereqsOf } from './skills';
import { masteryState, independentAccuracy, daysBetween } from './mastery';
import { openMisconceptions } from './misconceptions';
import { titleOf, topicTitleOf, routeOf } from './recommend';

/**
 * Where a stair of the exam stands. Two levels of good news, never confused:
 *   mastered  passed a mastery check (5 questions without hints): "שולטים לבד", as everywhere in the app;
 *   ready     answered the first diagnostic right (or practises well): likely ready, not yet mastery.
 */
export type Standing = 'mastered' | 'ready' | 'shaky' | 'gap' | 'untested';
export interface PlanSkill { skill: SkillId; standing: Standing; state: MasteryState; priority: number; why: string }
export interface PlanTask { skill: SkillId | null; kind: 'learn' | 'practice' | 'mastery' | 'review' | 'exam'; title: string; to: string }
export interface PlanDay { day: string; tasks: PlanTask[] }
export interface ExamPlan {
  daysLeft: number; mastered: number; ready: number; total: number; topicsMastered: number; topicsTotal: number;
  skills: PlanSkill[]; days: PlanDay[]; today: PlanTask[]; message: string; diagnosed: boolean;
}

export const DIAG_PER_SKILL = 2;

/** Shabbat: the streak never breaks on it (lib/store.js), and the plan puts no work on it. */
export const isShabbatDay = (day: string) => new Date(`${day}T12:00:00`).getDay() === 6;

export function validInput(i: Partial<ExamPlanInput>, today: string): string | null {
  if (!i.grade) return 'בחרו כיתה.';
  if (!i.date || i.date < today) return 'בחרו תאריך מבחן מהיום והלאה.';
  if (isShabbatDay(i.date)) return 'התאריך שבחרתם יוצא בשבת. בדקו את תאריך המבחן.';
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

  const tasksOf = (p: PlanSkill): PlanTask[] => {
    const t = titleOf(p.skill);
    if (p.standing === 'gap' || p.standing === 'untested') return [
      { skill: p.skill, kind: 'learn', title: `לומדים: ${t}`, to: routeOf.journey(p.skill) },
      { skill: p.skill, kind: 'practice', title: `מתרגלים: ${t}`, to: `/lesson/${parseSkill(p.skill).topic}/${parseSkill(p.skill).level}?part=1` },
      { skill: p.skill, kind: 'mastery', title: `בדיקת שליטה: ${t}`, to: routeOf.check(p.skill, 'mastery') },
    ];
    if (p.standing === 'shaky') return [
      { skill: p.skill, kind: 'practice', title: `מחזקים: ${t}`, to: `/lesson/${parseSkill(p.skill).topic}/${parseSkill(p.skill).level}?part=2` },
      { skill: p.skill, kind: 'mastery', title: `בדיקת שליטה: ${t}`, to: routeOf.check(p.skill, 'mastery') },
    ];
    // a good first diagnostic is confirmed by the mastery check, not assumed
    if (p.standing === 'ready') return [{ skill: p.skill, kind: 'mastery', title: `בדיקת שליטה: ${t}`, to: routeOf.check(p.skill, 'mastery') }];
    return [{ skill: p.skill, kind: 'review', title: `חזרה קצרה: ${t}`, to: routeOf.check(p.skill, 'review') }];
  };

  const queue = order.filter(toWork).flatMap(tasksOf);
  const finale: PlanTask[] = [{ skill: null, kind: 'exam', title: 'מבחן תרגול על כל הנושאים', to: '/rescue/exam' }];
  const confirmAndReview = [...order.filter((p) => p.standing === 'ready'), ...order.filter((p) => p.standing === 'mastered')].flatMap(tasksOf);
  const perDay = Math.max(1, Math.floor(plan.minutes / 5));
  const all = [...queue, ...confirmAndReview];
  // the days from today to the day before the exam (with 0 days left, today), without Shabbat
  const workDays: string[] = [];
  for (let d = 0; d < Math.max(1, daysLeft); d += 1) {
    const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() + d);
    const key = date.toLocaleDateString('en-CA');
    if (!isShabbatDay(key)) workDays.push(key);
  }
  // only Shabbat is left before the exam: what there is to do waits for the morning of the exam day
  if (!workDays.length) workDays.push(plan.date);
  const days: PlanDay[] = workDays.map((day) => ({ day, tasks: [] }));
  // How many tasks each day takes. The last day keeps room for the practice exam. More work than room is spread
  // evenly, the earlier days a little fuller. Tasks are dealt out in order, so a stair's lesson, practice and
  // mastery check never change places: a mastery check is never planned before the lesson that teaches it.
  const room = days.map((_, i) => (i === days.length - 1 ? Math.max(0, perDay - 1) : perDay));
  const capacity = room.reduce((a, b) => a + b, 0);
  const overflow = Math.max(0, all.length - capacity);
  let left = all.length;
  const counts = overflow
    ? days.map((_, i) => Math.floor(all.length / days.length) + (i < all.length % days.length ? 1 : 0))
    : room.map((r) => { const c = Math.min(r, left); left -= c; return c; });
  let k = 0;
  days.forEach((d, i) => { d.tasks.push(...all.slice(k, k + counts[i])); k += counts[i]; });
  days[days.length - 1].tasks.push(...finale);

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
  const restDay = isShabbatDay(today) && daysLeft > 0 ? ' היום שבת, ואין בו משימות. ממשיכים אחריה.' : '';
  const message = diagnosed ? `${when}${have ? ` ${have}` : ''} ${restDay ? restDay.trim() : today_}${tight}` : `${when} נתחיל בבדיקה קצרה, ${DIAG_PER_SKILL} שאלות לכל מדרגה, כדי לדעת על מה לעבוד.`;
  return { daysLeft, mastered, ready, total: n, topicsMastered, topicsTotal: topics.length, skills: order, days, today: days.find((d) => d.day === today)?.tasks || [], message, diagnosed };
}

/** The skills of a topic in the student's grade (for the topic picker). */
export const skillsOfTopic = (topic: string) => ALL_SKILLS.filter((s) => parseSkill(s).topic === topic);
export { topicTitleOf, prereqsOf };
