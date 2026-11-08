import { describe, it, expect } from 'vitest';
import type { LearnState, SkillRecord } from './types';
import { ALL_SKILLS, PREREQS, ancestorsOf, prereqsOf } from './skills';
import { addAttempt, markTaught, masteryState, recordMasteryCheck, recordReview, nextStage, dueReviews, MASTERY_N, REVIEW_DAYS, addDays } from './mastery';
import { addEvidence, addCounter, slipOf, diagnose, discriminating, narrow, startRepair, finishVerify, canOffer, CONFIRM_SCORE } from './misconceptions';
import { nextActions, smallestMissing, isMissing } from './recommend';
import { buildMission, completeMissionItems, missionDone } from './mission';
import { examPlan, newPlan, recordDiagnostic, validInput } from './examRescue';
import { tutorReply } from './tutor';
import { metrics, logEvent } from './analytics';
import { evaluate, seeded } from './expr';
import { contentOf } from './content/index';
import { addSubModel } from './content/signed';

const NOW = '2026-11-08T10:00:00.000Z';
const DAY = '2026-11-08';
const empty = (): LearnState => ({ skills: {}, miscon: {}, exam: null, missions: {}, events: [] });
const ctx = (learn: LearnState, grade: '7' | '8' = '7', extra = {}) => ({ learn, grade, now: NOW, day: DAY, path: {}, progress: {}, ...extra });
const att = (ok: boolean, independent = true, purpose: any = 'practice') => ({ at: NOW, ok, independent, purpose });

describe('expressions', () => {
  it('evaluates what the content uses', () => {
    expect(evaluate('-6 - (-9)')).toBe(3);
    expect(evaluate('−4 − (−7)')).toBe(3);
    expect(evaluate('2^3 + sqrt(16)')).toBe(12);
    expect(evaluate('-2^2')).toBe(-4);
    expect(evaluate('mean(2, 4, 9)')).toBe(5);
    expect(evaluate('median(7, 1, 3, 5)')).toBe(4);
    expect(evaluate('(3 - 1) / 4')).toBe(0.5);
    expect(() => evaluate('alert(1)')).toThrow();
    expect(() => evaluate('2 +')).toThrow();
  });
});

describe('the prerequisite graph', () => {
  it('names only real skills and has no cycle', () => {
    expect(ALL_SKILLS).toHaveLength(33);
    ALL_SKILLS.forEach((id) => {
      expect(PREREQS[id], id).toBeDefined();
      prereqsOf(id).forEach((p) => expect(ALL_SKILLS).toContain(p));
      expect(ancestorsOf(id)).not.toContain(id);
    });
  });
  it('reaches down through several stairs', () => {
    expect(ancestorsOf('line:4')).toEqual(expect.arrayContaining(['line:3', 'signed:3', 'line:2', 'coord:1', 'line:1', 'signed:1']));
  });
});

describe('mastery', () => {
  it('is not awarded for watching or for help', () => {
    let r: SkillRecord | undefined = markTaught(undefined, 'A', NOW);
    r = markTaught(r, 'B', NOW); r = markTaught(r, 'C', NOW);
    expect(masteryState(r, NOW)).toBe('learning');
    r = addAttempt(r, att(true, false, 'guided'));
    expect(masteryState(r, NOW)).toBe('learning');
    r = addAttempt(r, att(true, false));
    expect(masteryState(r, NOW)).toBe('practicing');
  });
  it('needs a check without hints: 4 of 5', () => {
    expect(masteryState(recordMasteryCheck(undefined, 3, MASTERY_N, NOW), NOW)).not.toBe('mastered');
    const r = recordMasteryCheck(undefined, 4, MASTERY_N, NOW);
    expect(masteryState(r, NOW)).toBe('mastered');
    expect(recordMasteryCheck(undefined, 3, 3, NOW).mastered).toBeUndefined(); // too few questions
  });
  it('asks for a review later, and a missed review is not the end', () => {
    const r = recordMasteryCheck(undefined, 5, 5, NOW);
    const later = addDays(NOW, REVIEW_DAYS[0] + 0.1);
    expect(masteryState(r, later)).toBe('needs-review');
    expect(dueReviews({ 'signed:1': r }, later)).toEqual(['signed:1']);
    const passed = recordReview(r, 3, 3, later);
    expect(passed.mastered!.box).toBe(1);
    expect(masteryState(passed, addDays(later, 1))).toBe('mastered');
    const missed = recordReview(r, 1, 3, later);
    expect(missed.mastered!.box).toBe(0);
    expect(masteryState(missed, addDays(later, 0.01))).toBe('needs-review');
  });
  it('says when more help is needed', () => {
    let r: SkillRecord | undefined;
    [false, false, true, false, false].forEach((ok) => { r = addAttempt(r, att(ok)); });
    expect(masteryState(r, NOW)).toBe('needs-support');
  });
  it('walks the stages A to E', () => {
    let r: SkillRecord | undefined;
    expect(nextStage(r)).toBe('A');
    r = markTaught(r, 'A', NOW); expect(nextStage(r)).toBe('B');
    r = markTaught(r, 'B', NOW); r = markTaught(r, 'C', NOW); expect(nextStage(r)).toBe('D');
    for (let i = 0; i < 6; i += 1) r = addAttempt(r, att(true));
    expect(nextStage(r)).toBe('E');
  });
});

describe('misconceptions', () => {
  it('needs evidence from two different questions to confirm', () => {
    let m = addEvidence({}, 'signed:1', 'minus-minus', 1, 'q1', NOW);
    expect(m['signed:1|minus-minus'].state).toBe('suspected');
    m = addEvidence(m, 'signed:1', 'minus-minus', 1, 'q1', NOW); // the same question again
    expect(m['signed:1|minus-minus'].score).toBe(1);
    m = addEvidence(m, 'signed:1', 'minus-minus', 1, 'q2', NOW);
    expect(m['signed:1|minus-minus'].score).toBeGreaterThanOrEqual(CONFIRM_SCORE);
    expect(m['signed:1|minus-minus'].state).toBe('confirmed');
  });
  it('drops a suspicion that right answers contradict', () => {
    let m = addEvidence({}, 'signed:1', 'sign', 0.5, 'q1', NOW);
    m = addCounter(m, 'signed:1', 'sign', 0.5);
    expect(m['signed:1|sign']).toBeUndefined();
  });
  it('tells a slip from a misconception', () => {
    expect(slipOf(12, 13)).toBe('off-by-one');
    expect(slipOf(21, 12)).toBe('swapped-digits');
    expect(slipOf(-13, 13)).toBeNull(); // a sign is about signs
    expect(slipOf(2, 13)).toBeNull();
  });
  it('splits the evidence when two misconceptions explain one answer, and finds a question that tells them apart', () => {
    // −4 − (−7): "minus-minus", "abs-add" and "direction" all predict −11
    const d = diagnose(addSubModel, { a: -4, b: -7, s: -1 }, -11);
    expect(d.kind).toBe('misconception');
    const ids = ['abs-add', 'direction', 'minus-minus'];
    if (d.kind === 'misconception') { expect(d.ambiguous).toBe(true); expect(d.candidates.map((c) => c.id).sort()).toEqual(ids); expect(d.candidates[0].conf).toBeCloseTo(1 / 3); }
    // no one question separates all three ("minus-minus" and "direction" agree wherever the first applies),
    // so the engine narrows: whatever the student answers, at most two questions leave one candidate
    const rnd = seeded(3);
    const p1 = discriminating(addSubModel, ids, rnd, 4000)!;
    expect(p1).not.toBeNull();
    const ans1 = addSubModel.answer(p1);
    const outcomes = [...new Set(ids.map((id) => addSubModel.bugs[id](p1) ?? ans1))];
    expect(outcomes.length).toBeGreaterThanOrEqual(2);
    outcomes.forEach((u) => {
      const left = narrow(addSubModel, ids, p1, u);
      expect(left.length).toBeLessThan(ids.length);
      if (left.length > 1) {
        const p2 = discriminating(addSubModel, left, rnd, 4000)!;
        const ans2 = addSubModel.answer(p2);
        expect(new Set(left.map((id) => addSubModel.bugs[id](p2) ?? ans2)).size).toBe(left.length);
      }
    });
  });
  it('matches a prediction that is not whole when the student rounded it to tenths', () => {
    const model = { params: () => ({ a: 6, b: 8 }), text: () => '', answer: (q: any) => Math.sqrt(q.a ** 2 + q.b ** 2), bugs: { 'no-root': (q: any) => q.a ** 2 + q.b ** 2, half: (q: any) => Math.sqrt(q.a ** 2 + q.b ** 2) / 3 }, solution: () => [''], hint: () => '' };
    const d = diagnose(model as any, { a: 6, b: 8 }, 3.3); // 10/3 = 3.333…, typed as 3.3
    expect(d.kind).toBe('misconception');
    if (d.kind === 'misconception') expect(d.candidates[0].id).toBe('half');
  });
  it('a slip and an unknown answer are not misconceptions', () => {
    expect(diagnose(addSubModel, { a: 9, b: -7, s: -1 }, 15).kind).toBe('slip'); // 16 expected
    expect(diagnose(addSubModel, { a: 9, b: -7, s: -1 }, 40).kind).toBe('unknown');
  });
  it('resolves after a verification, and does not loop forever', () => {
    let m = addEvidence(addEvidence({}, 'signed:1', 'sign', 1, 'a', NOW), 'signed:1', 'sign', 1, 'b', NOW);
    m = startRepair(m, 'signed:1', 'sign', DAY, NOW);
    expect(m['signed:1|sign'].state).toBe('repairing');
    const failed = finishVerify(m, 'signed:1', 'sign', 1, 1, NOW);
    expect(failed['signed:1|sign'].state).toBe('confirmed');
    const twice = finishVerify(startRepair(failed, 'signed:1', 'sign', DAY, NOW), 'signed:1', 'sign', 0, 2, NOW);
    expect(canOffer(twice['signed:1|sign'], DAY)).toBe(false);
    const ok = finishVerify(m, 'signed:1', 'sign', 3, 0, NOW);
    expect(ok['signed:1|sign'].state).toBe('resolved');
  });
});

describe('recommendations', () => {
  it('starts a new grade-7 student at the first stair, with a reason', () => {
    const a = nextActions(ctx(empty()));
    expect(a[0]).toMatchObject({ kind: 'new', skill: 'signed:1', to: '/learn/signed/1' });
    expect(a[0].reason).toBeTruthy();
  });
  it('puts a confirmed misconception first, then a due review', () => {
    const learn = empty();
    learn.miscon = addEvidence(addEvidence({}, 'signed:1', 'minus-minus', 1, 'a', NOW), 'signed:1', 'minus-minus', 1, 'b', NOW);
    learn.skills['coord:1'] = recordMasteryCheck(undefined, 5, 5, addDays(NOW, -3));
    const a = nextActions(ctx(learn));
    expect(a[0]).toMatchObject({ kind: 'repair', skill: 'signed:1', misc: 'minus-minus', to: '/repair/signed/1/minus-minus' });
    expect(a[1]).toMatchObject({ kind: 'review', skill: 'coord:1' });
  });
  it('sends a struggling student to the smallest missing prerequisite', () => {
    const learn = empty();
    // line:4 is hard; line:3 and signed:3 are known on the map, but coord:1 has a confirmed gap under line:3
    [false, false, false, false].forEach((ok) => { learn.skills['line:4'] = addAttempt(learn.skills['line:4'], att(ok)); });
    learn.skills['line:3'] = { attempts: [att(false), att(false), att(false), att(false)] };
    learn.skills['coord:1'] = { attempts: [att(false), att(false), att(false), att(true)] };
    const c = ctx(learn, '8');
    expect(isMissing(c, 'line:3')).toBe(true);
    expect(smallestMissing(c, 'line:4')).toBe('coord:1');
    expect(nextActions(c).find((x) => x.kind === 'prereq')).toMatchObject({ skill: 'coord:1' });
  });
  it('counts stairs already passed on the map as known', () => {
    const c = ctx(empty(), '7', { path: { signed: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0 } } });
    expect(nextActions(c)[0]).toMatchObject({ kind: 'new', skill: 'signed:3' });
  });
});

describe('the daily mission', () => {
  it('is short, mixed and completes', () => {
    const learn = empty();
    learn.skills['coord:1'] = recordMasteryCheck(undefined, 5, 5, addDays(NOW, -3));
    const items = buildMission(nextActions(ctx(learn)));
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items.some((i) => i.kind === 'review')).toBe(true);
    expect(items.some((i) => i.kind === 'new' || i.kind === 'continue')).toBe(true);
    let done = completeMissionItems(items, { skill: 'coord:1', kind: 'review' }, NOW);
    expect(done.find((i) => i.skill === 'coord:1')!.done).toBe(NOW);
    // a repair does not complete learning a new stair on the same skill
    const fresh = items.find((i) => i.kind === 'new')!;
    expect(completeMissionItems(items, { skill: fresh.skill, kind: 'repair', misc: 'x' }, NOW).find((i) => i.kind === 'new')!.done).toBeUndefined();
    items.forEach((i) => { done = completeMissionItems(done, { skill: i.skill, kind: i.kind }, NOW); });
    expect(missionDone(done)).toBe(true);
  });
});

describe('Exam Rescue', () => {
  const input = { grade: '7' as const, date: '2026-11-11', skills: ['signed:1', 'signed:3', 'coord:1'], confidence: 2 as const, minutes: 15 };
  it('checks the input', () => {
    expect(validInput({ ...input, skills: [] }, DAY)).toBeTruthy();
    expect(validInput({ ...input, date: '2026-11-01' }, DAY)).toBeTruthy();
    expect(validInput(input, DAY)).toBeNull();
  });
  it('starts with a short diagnostic, then plans from what it found', () => {
    let plan = newPlan(input, NOW);
    const before = examPlan(plan, empty(), NOW, DAY);
    expect(before.diagnosed).toBe(false);
    expect(before.message).toContain('3 ימים');
    plan = recordDiagnostic(plan, 'signed:1', 2, 2, NOW);
    plan = recordDiagnostic(plan, 'signed:3', 0, 2, NOW);
    plan = recordDiagnostic(plan, 'coord:1', 1, 2, NOW);
    const p = examPlan(plan, empty(), NOW, DAY);
    expect(p.diagnosed).toBe(true);
    expect(p.skills[0].skill).toBe('signed:3'); // the gap first
    expect(p.skills.find((s) => s.skill === 'signed:1')!.standing).toBe('strong');
    expect(p.days).toHaveLength(3);
    expect(p.days[2].tasks.at(-1)!.kind).toBe('exam');
    expect(p.message).toMatch(/כבר שולטים ב־1 מתוך 3/);
  });
  it('updates with real performance', () => {
    let plan = newPlan(input, NOW);
    ['signed:1', 'signed:3', 'coord:1'].forEach((s) => { plan = recordDiagnostic(plan, s, 0, 2, NOW); });
    const learn = empty();
    learn.skills['signed:3'] = recordMasteryCheck(undefined, 5, 5, NOW);
    const p = examPlan(plan, learn, NOW, DAY);
    expect(p.skills.find((s) => s.skill === 'signed:3')!.standing).toBe('strong');
    expect(p.strong).toBe(1);
  });
  it('puts everything into today when the exam is today', () => {
    const p = examPlan(newPlan({ ...input, date: DAY }, NOW), empty(), NOW, DAY);
    expect(p.daysLeft).toBe(0);
    expect(p.days).toHaveLength(1);
    expect(p.message).toContain('היום');
  });
});

describe('the tutor without a model', () => {
  const c = contentOf('signed:1')!;
  const item = { solution: ['$-4 - (-7) = -4 + 7$', 'סימנים שונים: $7 - 4 = 3$', 'התשובה: $3$'] };
  it('answers every intent from the content', () => {
    (['lost', 'other', 'why', 'example', 'mistake', 'together'] as const).forEach((i) => expect(tutorReply(i, { content: c, item }).say.length).toBeGreaterThan(0));
  });
  it('gives another way when asked again', () => {
    expect(tutorReply('other', { content: c, asked: { other: 0 } }).say[0]).not.toBe(tutorReply('other', { content: c, asked: { other: 1 } }).say[0]);
  });
  it('never hands over the last step when solving together', () => {
    const r = tutorReply('together', { content: c, item });
    expect(r.action?.kind).toBe('steps');
    if (r.action?.kind === 'steps') expect(r.action.steps).not.toContain('התשובה: $3$');
  });
  it('explains a diagnosed mistake, asks for more evidence when it is ambiguous, and does not guess', () => {
    expect(tutorReply('mistake', { content: c, wrong: { cat: 'minus-minus' } }).action).toMatchObject({ kind: 'remedy', misc: 'minus-minus' });
    const amb = tutorReply('mistake', { content: c, wrong: { diagnosis: { kind: 'misconception', ambiguous: true, candidates: [{ id: 'minus-minus', conf: 0.5 }, { id: 'abs-add', conf: 0.5 }] } } });
    expect(amb.say[0]).toContain('שאלה אחת נוספת');
    expect(tutorReply('mistake', { content: c, item, wrong: { diagnosis: { kind: 'unknown' } } }).say[0]).toContain('לא אנחש');
  });
});

describe('analytics', () => {
  it('does not report a metric on too little data', () => {
    const learn = empty();
    learn.events = logEvent([], { e: 'check-done', s: 'signed:1', p: 'diagnostic', n: 0.5 }, NOW);
    expect(metrics(learn, NOW).masteryGain.value).toBeNull();
  });
  it('measures independent mastery gain from a diagnostic to a later check', () => {
    const learn = empty();
    let ev = learn.events;
    ['signed:1', 'signed:3', 'coord:1'].forEach((s, i) => {
      ev = logEvent(ev, { e: 'check-done', s, p: 'diagnostic', n: 0.5 }, `2026-11-0${i + 1}T10:00:00.000Z`);
      ev = logEvent(ev, { e: 'check-done', s, p: 'mastery', n: 1 }, `2026-11-0${i + 5}T10:00:00.000Z`);
    });
    learn.events = ev;
    const m = metrics(learn, NOW);
    expect(m.masteryGain.value).toBeCloseTo(0.5);
    expect(m.activeDays).toBe(6);
    expect(m.returned.d1).toBe(true);
    expect(m.returned.d30).toBe(false);
  });
});
