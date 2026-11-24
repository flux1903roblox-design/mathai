// PRODUCT2-16: after a failed mastery check, practise again before the check returns. The council's run (learning-verify
// fail.cjs) as a test: pct:4 taught, six right practice answers, a mastery check of 3 out of 5. Before, the plan offered
// the same check at once ("בדיקת שליטה: מציאת השלם — תרגלתם מספיק"), while the result screen said "עוד קצת תרגול,
// ואז מנסים שוב"; a quick retake let a ~60% student pass about half the time.
import { describe, it, expect } from 'vitest';
import type { LearnState, SkillRecord } from './types';
import { planNext, nodeRoute, CHECK_FIRST, CHECK_AGAIN } from './next';
import { nextStage, checkWaits, practiceDone, practiceSinceFail, recordMasteryCheck, PRACTICE_AGAIN, RETRY_PRACTICE } from './mastery';
import { learnAfterAnswer, learnAfterCheck } from './storeGlue';
import { stairStage } from './assignments';
import { examPlan, newPlan, recordDiagnostic } from './examRescue';
import { ctxOf, emptyLearn, masteredRec, pathOf, DAY } from './__fixtures__/learners';
// @ts-ignore: plain JS
import { workRoute } from '@/lib/classWork.js';

const T0 = '2026-11-09T16:00:00.000Z';
const FAIL_AT = '2026-11-10T08:00:00.000Z';
const right = (at: string, n: number, extra: Partial<{ independent: boolean }> = {}) => Array.from({ length: n }, () => ({ at, ok: true, independent: true, purpose: 'practice' as const, ...extra }));

/** pct:4 taught and practised (six right answers), pct:1-3 mastered: the state of the council's run, grade 8. */
function beforeCheck(): LearnState {
  const L = emptyLearn();
  ['pct:1', 'pct:2', 'pct:3'].forEach((s) => { L.skills[s] = masteredRec(T0, 10); });
  L.skills['pct:4'] = { taught: { A: T0, B: T0, C: T0 }, attempts: right(T0, 6) };
  return L;
}
const failed = () => learnAfterCheck(beforeCheck(), { purpose: 'mastery', skill: 'pct:4', right: 3, asked: 5, perSkill: { 'pct:4': { right: 3, asked: 5 } } }, FAIL_AT, DAY);
const ctx = (L: LearnState) => ctxOf(L, { grade: '8', path: pathOf(L.skills, { pct: { parts: { 4: 2 } } }) });
const pct4 = (L: LearnState) => planNext(ctx(L)).items.filter((x) => x.skill === 'pct:4');
/** Answers in a practice lesson, as the store records them. */
const practise = (L: LearnState, n: number, opts: { hint?: boolean; ok?: boolean } = {}) => {
  let out = L;
  for (let i = 0; i < n; i += 1) out = learnAfterAnswer(out, { topic: 'pct', level: 4, ok: opts.ok ?? true, first: true, hint: !!opts.hint, at: `2026-11-10T1${i}:00:00.000Z`, purpose: 'practice', key: `p${i}` });
  return out;
};

describe('after a failed mastery check, practice comes before the check again', () => {
  it('before any check, six right practice answers bring the check, with the first-time reason', () => {
    const items = pct4(beforeCheck());
    expect(items[0]).toMatchObject({ kind: 'mastery', stage: 'E', reason: CHECK_FIRST });
  });

  it('a failed check (3 of 5) sends the plan back to practice, in the result screen\'s words', () => {
    const L = failed();
    expect(L.skills['pct:4']).toMatchObject({ failedChecks: 1, lastFailAt: FAIL_AT });
    expect(nextStage(L.skills['pct:4'])).toBe('D');
    const items = pct4(L);
    expect(items.map((x) => x.kind)).toEqual(['continue']);
    expect(items[0]).toMatchObject({ stage: 'D', title: 'תרגול: מציאת השלם', reason: PRACTICE_AGAIN, to: '/lesson/pct/4' });
    expect(items[0].reason).not.toContain('תרגלתם מספיק');
    expect(planNext(ctx(L)).items.some((x) => x.kind === 'mastery' && x.skill === 'pct:4')).toBe(false);
  });

  it('answers with a hint, or after a first miss, do not bring it back; three right ones alone since the check do', () => {
    let L = failed();
    L = practise(L, 3, { hint: true });
    L = practise(L, 2, { ok: false });
    expect(practiceSinceFail(L.skills['pct:4'])).toBe(0);
    expect(checkWaits(L.skills['pct:4'])).toBe(true);
    L = practise(L, RETRY_PRACTICE - 1);
    expect(pct4(L)[0]).toMatchObject({ kind: 'continue', stage: 'D' });
    L = practise(L, 1);
    expect(checkWaits(L.skills['pct:4'])).toBe(false);
    expect(nextStage(L.skills['pct:4'])).toBe('E');
    // the check returns, and says the student practised again since the last one
    expect(pct4(L)[0]).toMatchObject({ kind: 'mastery', stage: 'E', reason: CHECK_AGAIN, to: '/lesson/pct/4?kind=check&purpose=mastery' });
  });

  it('right answers from before the check do not count again, and a pass clears the wait', () => {
    const rec: SkillRecord = { taught: { A: T0, B: T0, C: T0 }, attempts: right(T0, 30), lastFailAt: FAIL_AT, failedChecks: 2 };
    expect(practiceDone(rec)).toBe(false);
    const passed = recordMasteryCheck({ ...rec, attempts: [...rec.attempts, ...right('2026-11-11T08:00:00.000Z', 3)] }, 5, 5, '2026-11-11T09:00:00.000Z');
    expect(passed.lastFailAt).toBeUndefined();
    expect(passed.mastered).toBeTruthy();
    expect(checkWaits(passed)).toBe(false);
  });

  it('every reader follows: the map card, the teacher\'s stair report, a stair kept from before checks', () => {
    const L = failed();
    // the stair is current on the map: its card's main button is practice
    expect(nodeRoute({ kind: 'node', topic: 'pct', level: 4, state: 'current', parts: 2 }, L.skills['pct:4'])).toBe('/lesson/pct/4');
    // a stair passed over (open) or kept from before checks offers practice before its check again
    const open = nodeRoute({ kind: 'node', topic: 'pct', level: 4, state: 'open', parts: 0 }, L.skills['pct:4']);
    expect(open).toBe('/lesson/pct/4?part=2');
    expect(nodeRoute({ kind: 'node', topic: 'pct', level: 4, state: 'open', parts: 0 }, beforeCheck().skills['pct:4'])).toBe('/lesson/pct/4?kind=check&purpose=mastery');
    // the teacher's report: practice (stage 3 of 5 done), not "practice done"
    expect(stairStage('pct:4', beforeCheck().skills['pct:4'])).toBe(4);
    expect(stairStage('pct:4', L.skills['pct:4'])).toBe(3);
    // kept from before mastery checks, failed once: practice first, then the check with the "practised again" reason
    const kept = emptyLearn();
    kept.skills['signed:1'] = { attempts: [], failedChecks: 1, lastFailAt: FAIL_AT };
    const path = { signed: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept' } } };
    const k1 = planNext(ctxOf(kept, { path })).items.find((x) => x.skill === 'signed:1')!;
    expect(k1).toMatchObject({ kind: 'continue', stage: 'D', reason: PRACTICE_AGAIN, to: '/lesson/signed/1?part=2' });
    kept.skills['signed:1'].attempts = right('2026-11-10T12:00:00.000Z', 3);
    const k2 = planNext(ctxOf(kept, { path })).items.filter((x) => x.skill === 'signed:1');
    expect(k2.find((x) => x.kind === 'mastery')).toMatchObject({ reason: CHECK_AGAIN, to: '/lesson/signed/1?kind=check&purpose=mastery' });
    expect(k2.some((x) => x.reason === PRACTICE_AGAIN)).toBe(false);
  });

  it('a check the teacher assigned stays open: its route is the check, whatever the stair\'s practice says', () => {
    expect(workRoute({ id: 'a1', kind: 'check', skill: 'pct:4' })).toBe('/lesson/pct/4?kind=check&purpose=mastery&assignment=a1');
  });

  it('Exam Rescue: a stair whose first diagnostic went well but whose check failed gets practice before its check', () => {
    const L = failed();
    let plan = newPlan({ grade: '8', date: '2026-11-17', skills: ['pct:4'], confidence: 3, minutes: 20 }, FAIL_AT);
    plan = recordDiagnostic(plan, 'pct:4', 2, 2, FAIL_AT);
    const p = examPlan(plan, L, '2026-11-11T09:00:00.000Z', '2026-11-11');
    const kinds = p.days.flatMap((d) => d.tasks).filter((t) => t.skill === 'pct:4').map((t) => t.kind);
    expect(kinds.slice(0, 2)).toEqual(['practice', 'mastery']);
    // and without the failed check, the ready stair is only confirmed by its check
    const q = examPlan(plan, beforeCheck(), '2026-11-11T09:00:00.000Z', '2026-11-11');
    expect(q.days.flatMap((d) => d.tasks).filter((t) => t.skill === 'pct:4').map((t) => t.kind)[0]).toBe('mastery');
  });
});
