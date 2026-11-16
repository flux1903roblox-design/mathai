// EXAM-MATERIAL 2: the exam is tomorrow (or today). Before, Exam Rescue asked first for a two-question check of every
// stair, then put a whole lesson, its practice and its mastery check of every stair on one day, and said the day was
// overloaded: two stairs at 15 minutes made 45 minutes. Now the evening is a real evening within the student's minutes:
// for each stair, weakest first, a short card of the stair's rule, a quick check of three questions, practice only where
// the check fails; then the practice exam on all the stairs; what does not fit is listed apart, honestly timed.
import { describe, it, expect } from 'vitest';
import type { LearnState, ExamPlanState } from './types';
import { examPlan, newPlan, recordDiagnostic, recordQuick, seeRule, taskMinutes, QUICK_N, REST_DAY_LINE } from './examRescue';
import { MINUTES, STAGE_MIN } from './recommend';
import { recordMasteryCheck } from './mastery';

const empty = (): LearnState => ({ skills: {}, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {} });
const TODAY = '2026-11-11'; // a Wednesday
const TOMORROW = '2026-11-12';
const now = (h = 18) => `${TODAY}T${String(h).padStart(2, '0')}:00:00.000Z`;
const planOf = (skills: string[], date = TOMORROW, minutes = 15, confidence: 1 | 2 | 3 | 4 = 3): ExamPlanState => newPlan({ grade: '8', date, skills, confidence, minutes }, now(8));
const kinds = (tasks: { kind: string }[]) => tasks.map((t) => t.kind);
const sum = (tasks: { minutes: number }[]) => tasks.reduce((a, t) => a + t.minutes, 0);

describe('the exam tomorrow: an evening within the student\'s minutes (EXAM-MATERIAL 2)', () => {
  it('no separate check first: each stair has its rule card and a quick check of three, then the practice exam', () => {
    const p = examPlan(planOf(['pct:4', 'pct:5']), empty(), now(), TODAY);
    expect(p.daysLeft).toBe(1);
    expect(p.diagnosed).toBe(true);
    expect(QUICK_N).toBe(3);
    expect(kinds(p.today)).toEqual(['rule', 'quick', 'rule', 'quick', 'exam']);
    expect(p.today.map((t) => t.to)).toEqual(['/rescue/rule/pct/4', '/rescue/check?skill=pct:4', '/rescue/rule/pct/5', '/rescue/check?skill=pct:5', '/rescue/exam']);
    expect(p.today.map((t) => t.title)).toEqual(['נזכרים בכלל: מציאת השלם', 'בדיקה מהירה: מציאת השלם', 'נזכרים בכלל: הגדלה והקטנה באחוזים', 'בדיקה מהירה: הגדלה והקטנה באחוזים', 'מבחן תרגול על כל הנושאים']);
    // within the 15 minutes chosen, nothing said to be overloaded; the minutes are honest: the rule 1, the check 2, the exam 5
    expect([taskMinutes('rule'), taskMinutes('quick')]).toEqual([1, 2]);
    expect(sum(p.today)).toBe(1 + 2 + 1 + 2 + MINUTES.exam);
    expect(p.evening!.minutes).toBe(sum(p.today));
    expect(sum(p.today)).toBeLessThanOrEqual(15);
    expect(p.message).toContain('המבחן מחר');
    expect(p.message).not.toContain('עמוס');
    // one stop, today's; the plan never asks for a whole lesson the night before
    expect(p.days.map((d) => d.day)).toEqual([TODAY]);
    expect(p.today.some((t) => t.kind === 'learn' || t.kind === 'mastery')).toBe(false);
  });

  it('the weakest stair first: a known mistake before an untested stair, before one that passed its check, before a mastered one', () => {
    // four stairs of four topics, none leaning on another, so the order is their standing alone
    const learn = empty();
    // passed this morning: still mastered tonight (a day later it is due for a review, and counts as shaky)
    learn.skills['circle:1'] = recordMasteryCheck(undefined, 5, 5, now(8));
    learn.miscon['pct:2|whole'] = { skill: 'pct:2', id: 'whole', score: 2.5, seen: [], state: 'confirmed', at: '2026-11-10T10:00:00.000Z' } as never;
    let plan = planOf(['circle:1', 'stats:3', 'line:4', 'pct:2'], TOMORROW, 30);
    plan = recordDiagnostic(plan, 'stats:3', 2, 2, now(9));
    const p = examPlan(plan, learn, now(), TODAY);
    const order = [...new Set(p.today.filter((t) => t.skill).map((t) => t.skill))];
    expect(order).toEqual(['pct:2', 'line:4', 'stats:3', 'circle:1']);
    // a stair another one leans on comes before it, as on every other day of the plan
    const chain = examPlan(planOf(['line:5', 'line:4'], TOMORROW, 30), empty(), now(), TODAY);
    expect([...new Set(chain.today.filter((t) => t.skill).map((t) => t.skill))]).toEqual(['line:4', 'line:5']);
  });

  it('practice appears right after a failed quick check, and goes once it is done; a passed check needs none', () => {
    let plan = planOf(['pct:4', 'pct:5'], TOMORROW, 20);
    plan = seeRule(plan, 'pct:4', now(17));
    plan = recordQuick(plan, 'pct:4', 1, 3, now(17));
    plan = seeRule(plan, 'pct:5', now(17));
    plan = recordQuick(plan, 'pct:5', 3, 3, now(17));
    const learn = empty();
    let p = examPlan(plan, learn, now(), TODAY);
    expect(kinds(p.today)).toEqual(['practice', 'exam']);
    expect(p.today[0]).toMatchObject({ skill: 'pct:4', to: '/lesson/pct/4', minutes: STAGE_MIN.D, title: 'מתרגלים: מציאת השלם' });
    learn.events.push({ t: `${TODAY}T18:30:00.000Z`, e: 'lesson-done', s: 'pct:4', p: 'practice', ok: true });
    p = examPlan(plan, learn, now(19), TODAY);
    expect(kinds(p.today)).toEqual(['exam']);
    // and once the practice exam is done tonight, nothing is left for today
    learn.events.push({ t: `${TODAY}T19:10:00.000Z`, e: 'rescue-exam-done', n: 0.8 });
    p = examPlan(plan, learn, now(20), TODAY);
    expect(p.today).toEqual([]);
    expect(p.evening!.minutes).toBe(0);
    expect(p.message).toContain('עשיתם את כל מה שתכננו');
  });

  it('within the minutes: whole stairs while they fit beside the practice exam, the rest listed apart and timed', () => {
    const skills = ['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5', 'eq:6'];
    const p = examPlan(planOf(skills, TOMORROW, 10), empty(), now(), TODAY);
    // 10 minutes: two stairs (3 minutes each) and the practice exam (5) do not fit, one stair does: 3 + 5 = 8
    expect(sum(p.today)).toBeLessThanOrEqual(10);
    expect(kinds(p.today)).toEqual(['rule', 'quick', 'exam']);
    const later = p.evening!.later;
    expect(later.length).toBe(10);
    expect(p.evening!.laterMinutes).toBe(sum(later));
    expect(p.evening!.laterMinutes).toBe(5 * 3);
    // every step is one of the exam's stairs: nothing the exam does not cover
    [...p.today, ...later].forEach((t) => { if (t.skill) expect(skills).toContain(t.skill); });
    // 30 minutes: all six stairs fit (18) with the exam (5)
    const q = examPlan(planOf(skills, TOMORROW, 30), empty(), now(), TODAY);
    expect(q.evening!.later).toEqual([]);
    expect(sum(q.today)).toBe(6 * 3 + 5);
  });

  it('the exam today: the same steps before it, and the message says so', () => {
    const p = examPlan(planOf(['pct:4'], TODAY), empty(), `${TODAY}T06:30:00.000Z`, TODAY);
    expect(p.daysLeft).toBe(0);
    expect(kinds(p.today)).toEqual(['rule', 'quick', 'exam']);
    expect(p.message).toContain('המבחן היום');
    // what was done last night counts this morning
    let plan = planOf(['pct:4'], TOMORROW);
    plan = seeRule(plan, 'pct:4', now(17));
    plan = recordQuick(plan, 'pct:4', 3, 3, now(17));
    const morning = examPlan(plan, empty(), `${TOMORROW}T06:00:00.000Z`, TOMORROW);
    expect(kinds(morning.today)).toEqual(['exam']);
    // a rule seen days before the evening is seen again
    let old = newPlan({ grade: '8', date: TOMORROW, skills: ['pct:4'], confidence: 3, minutes: 15 }, '2026-11-01T08:00:00.000Z');
    old = seeRule(old, 'pct:4', '2026-11-02T10:00:00.000Z');
    expect(kinds(examPlan(old, empty(), now(), TODAY).today)).toEqual(['rule', 'quick', 'exam']);
  });

  it('on Shabbat with the exam on Sunday: nothing today, the steps wait for the morning of the exam', () => {
    const p = examPlan(newPlan({ grade: '8', date: '2026-11-15', skills: ['pct:4'], confidence: 3, minutes: 15 }, '2026-11-14T08:00:00.000Z'), empty(), '2026-11-14T10:00:00.000Z', '2026-11-14');
    expect(p.today).toEqual([]);
    expect(p.message).toContain(REST_DAY_LINE);
    expect(p.days.map((d) => d.day)).toEqual(['2026-11-15']);
    expect(kinds(p.days[0].tasks)).toEqual(['rule', 'quick', 'exam']);
  });

  it('more days to go: the plan is as before (lessons spread over days, the short check first)', () => {
    const p = examPlan(planOf(['pct:4', 'pct:5'], '2026-11-17'), empty(), now(), TODAY);
    expect(p.evening).toBeUndefined();
    expect(p.diagnosed).toBe(false);
  });
});
