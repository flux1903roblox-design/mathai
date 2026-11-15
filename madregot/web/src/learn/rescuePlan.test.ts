// PRODUCT2-17 and SK-LEARN-3: Exam Rescue spaces a stair's work over days, budgets real minutes, and rests on Shabbat and
// Yom Tov. The council's run (learning-verify rescue.ts) as a test: before, a 20-minute plan for two stairs put a lesson,
// its practice and its check on one day at 5 minutes a task, left later days empty, and worked on the seventh day of Pesach.
import { describe, it, expect } from 'vitest';
import type { LearnState } from './types';
import { examPlan, newPlan, recordDiagnostic, validInput, taskMinutes, schedule, REST_DAY_LINE } from './examRescue';
import type { ExamPlan, PlanTask } from './examRescue';
import { STAGE_MIN, MINUTES } from './recommend';
import { ALL_SKILLS } from './skills';
import { seeded } from './expr';
// @ts-ignore: plain JS shared with the Worker
import { isRestDay } from '@shared/restDays.js';

const empty = (): LearnState => ({ skills: {}, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {} });
/** A plan for these stairs, every one a gap after the short diagnostic (0 of 2): the most work there can be. */
function planFor(skills: string[], date: string, minutes: number, today: string): ExamPlan {
  let plan = newPlan({ grade: '8', date, skills, confidence: 3, minutes }, `${today}T08:00:00.000Z`);
  skills.forEach((s) => { plan = recordDiagnostic(plan, s, 0, 2, `${today}T08:00:00.000Z`); });
  return examPlan(plan, empty(), `${today}T09:00:00.000Z`, today);
}
const dayOf = (p: ExamPlan, skill: string, kind: string) => p.days.findIndex((d) => d.tasks.some((t) => t.skill === skill && t.kind === kind));
/** The first steps (lesson, practice, check) still to place after day i. */
const workAfter = (p: ExamPlan, i: number) => p.days.slice(i + 1).some((d) => d.tasks.some((t) => ['learn', 'practice', 'mastery'].includes(t.kind)));

describe('Exam Rescue spaces the work in real minutes', () => {
  it('the minutes come from the stages: a lesson is its three teaching stages', () => {
    expect(taskMinutes('learn')).toBe(STAGE_MIN.A + STAGE_MIN.B + STAGE_MIN.C);
    expect(taskMinutes('learn')).toBe(12);
    expect([taskMinutes('practice'), taskMinutes('mastery'), taskMinutes('review'), taskMinutes('exam')]).toEqual([STAGE_MIN.D, STAGE_MIN.E, MINUTES.review, MINUTES.exam]);
    expect([taskMinutes('practice'), taskMinutes('mastery'), taskMinutes('review'), taskMinutes('exam')]).toEqual([5, 3, 2, 5]);
  });

  it('the council\'s case: two stairs, 20 minutes, exam on Tuesday 17.11', () => {
    const p = planFor(['pct:4', 'pct:5'], '2026-11-17', 20, '2026-11-11');
    // no day holds a stair's lesson and its check, and every stair's lesson, practice and check are on three days
    ['pct:4', 'pct:5'].forEach((s) => {
      const [l, pr, c] = ['learn', 'practice', 'mastery'].map((k) => dayOf(p, s, k));
      expect(l, s).toBeGreaterThanOrEqual(0);
      expect(l < pr && pr < c, `${s}: ${l} ${pr} ${c}`).toBe(true);
    });
    p.days.forEach((d, i) => {
      // no day over the student's 20 minutes, and its minutes are its steps'
      expect(d.minutes, d.day).toBeLessThanOrEqual(20);
      expect(d.minutes).toBe(d.tasks.reduce((a, t) => a + t.minutes, 0));
      // no day in the middle is empty while work remains
      if (workAfter(p, i)) expect(d.tasks.length, d.day).toBeGreaterThan(0);
    });
    // Saturday is not a day of the plan; the practice exam closes the last day, and a day not needed for first steps
    // has short reviews
    expect(p.days.map((d) => d.day)).not.toContain('2026-11-14');
    expect(p.days.at(-1)!.day).toBe('2026-11-16');
    expect(p.days.at(-1)!.tasks.at(-1)!.kind).toBe('exam');
    expect(p.days.flatMap((d) => d.tasks).filter((t) => t.kind === 'review').length).toBeGreaterThan(0);
    expect(p.message).not.toContain('עמוס');
  });

  it('a check never shares a day with its lesson, in any plan whose exam is more than a day away', () => {
    const rnd = seeded(17);
    for (let n = 0; n < 80; n += 1) {
      const skills = ALL_SKILLS.filter(() => rnd() < 0.25).slice(0, 8);
      if (!skills.length) continue;
      const date = new Date('2026-11-11T12:00:00'); date.setDate(date.getDate() + 2 + Math.floor(rnd() * 12));
      const day = date.toLocaleDateString('en-CA');
      if (isRestDay(day)) continue;
      const minutes = [10, 15, 20, 30][Math.floor(rnd() * 4)];
      const p = planFor(skills, day, minutes, '2026-11-11');
      const tight = p.message.includes('עמוס');
      skills.forEach((s) => {
        const l = dayOf(p, s, 'learn'); const pr = dayOf(p, s, 'practice'); const c = dayOf(p, s, 'mastery');
        expect(l >= 0 && pr >= l && c > l, `${s} ${day} ${minutes}: ${l} ${pr} ${c}`).toBe(true);
      });
      p.days.forEach((d) => {
        expect(isRestDay(d.day), d.day).toBe(false);
        // over the minutes only when the plan says it is tight, or for one step longer than the minutes, alone on its day
        const alone = d.tasks.length === 1 && d.tasks[0].minutes > minutes;
        if (!tight && !alone) expect(d.minutes, `${day} ${minutes} ${d.day}`).toBeLessThanOrEqual(minutes);
      });
    }
  });

  it('a tight plan goes over the minutes as little as fits, and says so', () => {
    // four stairs in 15 minutes a day over four school days: 80 minutes of work for 60
    const p = planFor(['pct:3', 'pct:4', 'pct:5', 'line:2'], '2026-11-17', 15, '2026-11-11');
    expect(p.message).toContain('יש יותר עבודה מזמן, אז כל יום עמוס קצת יותר.');
    expect(Math.max(...p.days.map((d) => d.minutes))).toBeLessThanOrEqual(20);
    // and the exam tomorrow: everything today, each stair still in order
    const q = planFor(['pct:4', 'pct:5'], '2026-11-12', 15, '2026-11-11');
    expect(q.days.map((d) => d.day)).toEqual(['2026-11-11']);
    expect(q.today.map((t) => t.kind)).toEqual(['learn', 'practice', 'mastery', 'learn', 'practice', 'mastery', 'exam']);
  });

  it('10 minutes a day, the first choice, with three weeks: lesson, practice and check on three days, and no tight line', () => {
    // the review's run: one stair (signed:1) from 12.11 to an exam on 3.12. Before, the 12-minute lesson did not fit a
    // 10-minute day, so the plan raised the cap with the practice and the check on one day and said it was overloaded.
    for (const skills of [['signed:1'], ['signed:1', 'signed:2']]) {
      const p = planFor(skills, '2026-12-03', 10, '2026-11-12');
      expect(p.message, skills.join()).not.toContain('עמוס');
      skills.forEach((s) => {
        const [l, pr, c] = ['learn', 'practice', 'mastery'].map((k) => dayOf(p, s, k));
        expect(l >= 0 && l < pr && pr < c, `${s}: ${l} ${pr} ${c}`).toBe(true);
      });
      // a day over the 10 minutes holds one step only: a lesson longer than the minutes, which fills its day
      p.days.filter((d) => d.minutes > 10).forEach((d) => expect(d.tasks.map((t) => t.kind), d.day).toEqual(['learn']));
    }
    // and at 15 minutes it stays as it was: three days in a row, nothing over
    const q = planFor(['signed:1'], '2026-12-03', 15, '2026-11-12');
    expect(q.message).not.toContain('עמוס');
    expect(['learn', 'practice', 'mastery'].map((k) => dayOf(q, 'signed:1', k))).toEqual([0, 1, 2]);
    expect(Math.max(...q.days.map((d) => d.minutes))).toBeLessThanOrEqual(15);
  });

  it('when the cap must rise, three separate days are tried first at each cap', () => {
    // 5 minutes a day over three days, the last keeping 5 for the practice exam: the lesson fills day 1, the practice
    // day 2, and at 8 minutes a day the check fits the last day beside the exam. Before, the cap rose to 12 (the lesson's
    // length) and the practice and the check shared day 2.
    const t = (kind: PlanTask['kind']): PlanTask => ({ skill: 'x:1', kind, title: kind, to: '/', minutes: taskMinutes(kind) });
    const { at, cap } = schedule([[t('learn'), t('practice'), t('mastery')]], 3, 5, 5);
    expect(at[0]).toEqual([0, 1, 2]);
    expect(cap).toBe(8);
  });

  it('schedule places the steps of each stair in order, and never starts a stair before the one before it', () => {
    const t = (kind: PlanTask['kind']): PlanTask => ({ skill: 'x:1', kind, title: kind, to: '/', minutes: taskMinutes(kind) });
    const chain = () => [t('learn'), t('practice'), t('mastery')];
    const { at, cap } = schedule([chain(), chain()], 5, 20, 5);
    expect(cap).toBe(20);
    expect(at[0]).toEqual([0, 1, 2]);
    expect(at[1][0]).toBeGreaterThanOrEqual(at[0][0]);
    expect(at[1][0] < at[1][1] && at[1][1] < at[1][2]).toBe(true);
  });
});

describe('Exam Rescue rests on Shabbat and on Yom Tov (SK-LEARN-3)', () => {
  it('an exam the day after the seventh day of Pesach: nothing on Yom Tov, nothing on Shabbat', () => {
    const p = planFor(['pct:4', 'pct:5', 'ratio:3'], '2027-04-29', 15, '2027-04-19');
    const days = p.days.map((d) => d.day);
    // 22.4 is the first day of Pesach, 24.4 is Shabbat, 28.4 is the seventh day of Pesach
    ['2027-04-22', '2027-04-24', '2027-04-28'].forEach((d) => expect(days, d).not.toContain(d));
    days.forEach((d) => expect(isRestDay(d), d).toBe(false));
    expect(p.days.at(-1)!.day).toBe('2027-04-27');
  });
  it('planned on Yom Tov: no tasks today, and the line says Shabbat or a holiday', () => {
    const p = planFor(['pct:4'], '2027-04-26', 15, '2027-04-22');
    expect(p.today).toEqual([]);
    expect(p.message).toContain(REST_DAY_LINE);
    expect(REST_DAY_LINE).toContain('שבת או חג');
  });
  it('an exam date on Yom Tov gets a calm word to check the date', () => {
    const input = { grade: '8' as const, skills: ['pct:4'], minutes: 15, confidence: 3 as const };
    expect(validInput({ ...input, date: '2027-04-28' }, '2027-04-19')).toBe('התאריך שבחרתם יוצא בשבת או בחג. כדאי לבדוק שוב את תאריך המבחן.');
    expect(validInput({ ...input, date: '2027-04-27' }, '2027-04-19')).toBeNull();
  });
});
