// EXAM-MATERIAL 2: the exam is tomorrow (or today). Before, Exam Rescue asked first for a two-question check of every
// stair, then put a whole lesson, its practice and its mastery check of every stair on one day, and said the day was
// overloaded: two stairs at 15 minutes made 45 minutes. Now the evening is a real evening within the student's minutes:
// for each stair, weakest first, a short card of the stair's rule, a quick check of three questions, practice only where
// the check fails; then the practice exam on all the stairs; what does not fit is listed apart, honestly timed.
import { describe, it, expect } from 'vitest';
import type { LearnState, ExamPlanState } from './types';
import { examPlan, newPlan, recordDiagnostic, recordQuick, seeRule, taskMinutes, examMinutes, examQuestions, QUICK_N, PACE_SECS, REST_DAY_LINE } from './examRescue';
import { STAGE_MIN } from './recommend';
import { recordMasteryCheck } from './mastery';
import { checkPlan } from './items';
import { learnAfterCheck } from './storeGlue';

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
    // within the 15 minutes chosen, nothing said to be overloaded; the minutes are honest: the rule card 2, the check of
    // three questions 2, the exam by its questions (4 questions for 2 stairs: 3 minutes)
    expect([taskMinutes('rule'), taskMinutes('quick')]).toEqual([2, 2]);
    expect(sum(p.today)).toBe(2 + 2 + 2 + 2 + examMinutes(2));
    expect(p.today.at(-1)!.minutes).toBe(3);
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
    // 10 minutes: one stair (4 minutes) and an exam on it (2 questions, 2 minutes) fit; a second stair and an exam on
    // two (3 minutes) would make 11
    expect(sum(p.today)).toBeLessThanOrEqual(10);
    expect(kinds(p.today)).toEqual(['rule', 'quick', 'exam']);
    expect(p.today[2]).toMatchObject({ to: '/rescue/exam?skills=eq:1', title: 'מבחן תרגול על מה שעברנו הערב', minutes: examMinutes(1) });
    const later = p.evening!.later;
    // five stairs' rule and check, then the exam on every stair
    expect(later.length).toBe(11);
    expect(later.at(-1)).toMatchObject({ kind: 'exam', to: '/rescue/exam', minutes: examMinutes(6) });
    expect(p.evening!.laterMinutes).toBe(sum(later));
    expect(p.evening!.laterMinutes).toBe(5 * 4 + examMinutes(6));
    // every step is one of the exam's stairs: nothing the exam does not cover
    [...p.today, ...later].forEach((t) => { if (t.skill) expect(skills).toContain(t.skill); });
    // 30 minutes: all six stairs fit (24) with the exam on all of them (6 questions, 4 minutes)
    const q = examPlan(planOf(skills, TOMORROW, 30), empty(), now(), TODAY);
    expect(q.evening!.later).toEqual([]);
    expect(sum(q.today)).toBe(6 * 4 + examMinutes(6));
    expect(q.today.at(-1)!.to).toBe('/rescue/exam');
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

// The review of EXAM-MATERIAL 2 (after 2437420): the exam's minutes are its questions'; the practice exam never asks a
// stair before its rule card; the minutes done tonight count; and Saturday night before a Sunday exam has a plan.
describe('the evening, honestly timed and in order (EXAM-MATERIAL 2 review)', () => {
  it('a practice exam\'s minutes are its questions at the app\'s pace, for any number of stairs', () => {
    const all = ['signed:1', 'signed:2', 'signed:3', 'signed:4', 'signed:5', 'signed:6', 'signed:7', 'expr:1', 'expr:2', 'expr:3', 'expr:4', 'expr:5', 'eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5', 'eq:6', 'eq:7', 'pct:1'];
    let seed = 3;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let n = 1; n <= all.length; n += 1) {
      const asked = checkPlan({ purpose: 'exam', skills: all.slice(0, n) }, rnd).length;
      expect(asked, `${n} stairs`).toBe(examQuestions(n));
      expect(examMinutes(n), `${n} stairs`).toBe(Math.ceil((asked * PACE_SECS) / 60));
    }
    // 5 stairs: 10 questions, 7 minutes; 12 stairs: 12 questions, 8 minutes (it was "5 minutes" for both)
    expect([examQuestions(5), examMinutes(5), examQuestions(12), examMinutes(12)]).toEqual([10, 7, 12, 8]);
    // a quick check is three questions at the same pace
    expect(taskMinutes('quick')).toBe(Math.ceil((QUICK_N * PACE_SECS) / 60));
  });

  it('when stairs wait apart, tonight\'s exam asks only tonight\'s stairs, each after its rule card; the exam on all of them closes the rest', () => {
    const skills = ['signed:1', 'signed:2', 'signed:3', 'signed:4', 'signed:5', 'signed:6', 'signed:7', 'expr:1', 'expr:2', 'expr:3', 'expr:4', 'expr:5'];
    const plan = newPlan({ grade: '7', date: TOMORROW, skills, confidence: 3, minutes: 15 }, now(8));
    const p = examPlan(plan, empty(), now(), TODAY);
    const exam = p.today.find((t) => t.kind === 'exam')!;
    expect(exam.to.startsWith('/rescue/exam?skills=')).toBe(true);
    const asked = exam.to.split('=')[1].split(',');
    // every stair the exam asks had its rule card and its check earlier in tonight's list
    asked.forEach((s) => {
      const at = p.today.indexOf(exam);
      expect(p.today.findIndex((t) => t.skill === s && t.kind === 'rule'), s).toBeGreaterThanOrEqual(0);
      expect(p.today.findIndex((t) => t.skill === s && t.kind === 'rule'), s).toBeLessThan(at);
      expect(p.today.findIndex((t) => t.skill === s && t.kind === 'quick'), s).toBeLessThan(at);
    });
    // and it asks nothing else
    expect(new Set(asked)).toEqual(new Set(p.today.filter((t) => t.skill).map((t) => t.skill)));
    expect(exam.minutes).toBe(examMinutes(asked.length));
    // the stairs that wait come before the exam on all of them, at the end of the waiting list
    const later = p.evening!.later;
    expect(later.at(-1)).toMatchObject({ kind: 'exam', to: '/rescue/exam', title: 'מבחן תרגול על כל הנושאים', minutes: examMinutes(12) });
    expect(later.filter((t) => t.kind === 'exam')).toHaveLength(1);
    // within the minutes, honestly: the exam counted by its questions
    expect(sum(p.today)).toBeLessThanOrEqual(15);
    expect(p.evening!.over).toBe(false);
  });

  it('walking the evening step by step: the minutes done count, a waiting stair never comes back, and going past the minutes is said', () => {
    const skills = ['pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5'];
    for (const failEvery of [0, 2]) {
      let plan = planOf(skills, TOMORROW, 15);
      const learn = empty();
      let clock = Date.parse(`${TODAY}T16:00:00.000Z`);
      const at = () => new Date(clock).toISOString();
      const first = examPlan(plan, learn, at(), TODAY);
      const waiting = new Set(first.evening!.later.filter((t) => t.skill).map((t) => t.skill));
      let n = 0;
      for (let guard = 0; guard < 40; guard += 1) {
        const p = examPlan(plan, learn, at(), TODAY);
        const ev = p.evening!;
        // never silent: either within the minutes, or the plan says it is over them
        expect(ev.spent + ev.minutes <= plan.minutes || ev.over, `step ${guard}`).toBe(true);
        expect(ev.over).toBe(ev.spent + ev.minutes > plan.minutes);
        // a stair that did not fit at the start never joins tonight's list by itself
        p.today.forEach((t) => { if (t.skill) expect(waiting.has(t.skill), `${t.skill} came back`).toBe(false); });
        const t = p.today[0];
        if (!t) break;
        clock += t.minutes * 60e3;
        if (t.kind === 'rule') plan = seeRule(plan, t.skill!, at());
        else if (t.kind === 'quick') { n += 1; plan = recordQuick(plan, t.skill!, failEvery && n % failEvery === 0 ? 1 : 3, 3, at()); }
        else if (t.kind === 'practice') learn.events.push({ t: at(), e: 'lesson-done', s: t.skill!, p: 'practice', ok: true });
        else if (t.kind === 'exam') learn.events.push({ t: at(), e: 'rescue-exam-done', n: 0.8, k: t.to.includes('skills=') ? t.to.split('=')[1].split(',').length : skills.length, ...(t.to.includes('skills=') ? { p: 'part' } : {}) });
      }
      const end = examPlan(plan, learn, at(), TODAY);
      expect(end.today).toEqual([]);
      // all checks right: the evening took what it said, within the 15 minutes; a failed check adds practice, and the
      // time it took is what the plan counted
      if (!failEvery) expect(end.evening!.spent).toBeLessThanOrEqual(15);
      expect(end.evening!.spent).toBe((clock - Date.parse(`${TODAY}T16:00:00.000Z`)) / 60e3);
      expect(end.message).toContain('עשיתם את כל מה שתכננו להיום');
    }
  });

  it('Saturday night before a Sunday exam: the steps are listed for after Shabbat or the morning, timed, and nothing is said to be done', () => {
    const plan = newPlan({ grade: '7', date: '2026-11-08', skills: ['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5'], confidence: 3, minutes: 15 }, '2026-11-06T08:00:00.000Z');
    const p = examPlan(plan, empty(), '2026-11-07T18:30:00.000Z', '2026-11-07');
    expect(p.today).toEqual([]);
    expect(p.evening!.rest).toBe(true);
    expect(p.evening!.spent).toBe(0);
    expect(p.days).toHaveLength(1);
    expect(p.days[0].day).toBe('2026-11-08');
    expect(kinds(p.days[0].tasks).slice(0, 2)).toEqual(['rule', 'quick']);
    expect(p.days[0].tasks.at(-1)!.kind).toBe('exam');
    // done after Shabbat or in the morning: the exam's name says no "הערב"
    expect(p.days[0].tasks.at(-1)!.title).toBe('מבחן תרגול על מה שעברנו');
    expect(p.evening!.minutes).toBe(sum(p.days[0].tasks));
    expect(p.evening!.minutes).toBeLessThanOrEqual(15);
    // the rest-day line once, and no "done"
    expect(p.message.split(REST_DAY_LINE)).toHaveLength(2);
    expect(p.message).not.toContain('עשיתם');
  });

  it('a practice exam over some of the plan\'s stairs is logged as part of it, with how many stairs it asked', () => {
    const exam = planOf(['pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5']);
    const base = { ...empty(), exam };
    const part = learnAfterCheck(base, { purpose: 'exam', skills: ['pct:1', 'pct:2'], right: 3, asked: 4, perSkill: {} }, now(19), TODAY);
    expect(part.events.at(-1)).toMatchObject({ e: 'rescue-exam-done', k: 2, p: 'part' });
    const all = learnAfterCheck(base, { purpose: 'exam', skills: exam.skills, right: 8, asked: 10, perSkill: {} }, now(19), TODAY);
    expect(all.events.at(-1)).toMatchObject({ e: 'rescue-exam-done', k: 5 });
    expect(all.events.at(-1)!.p).toBeUndefined();
  });
});
