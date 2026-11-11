import { describe, it, expect } from 'vitest';
import type { LearnState, SkillRecord } from './types';
import { TOPIC_ORDER, ALL_SKILLS, PREREQS, STAIRS, ancestorsOf, prereqsOf, gradeSkillsOf, BRIDGE, BRIDGE_SKILLS } from './skills';
// @ts-ignore: plain JS
import { topicsFor, bridgeTopicsFor, rescueTopicsFor } from '@/content/index.js';
import { addAttempt, markTaught, masteryState, recordMasteryCheck, recordReview, nextStage, dueReviews, MASTERY_N, REVIEW_DAYS, addDays } from './mastery';
import { addEvidence, addCounter, slipOf, slipLike, matchesValue, diagnose, discriminating, narrow, startRepair, finishVerify, canOffer, CONFIRM_SCORE } from './misconceptions';
// @ts-ignore: plain JS
import { diagOf } from '@/content/eq.js';
import { nextActions, smallestMissing, isMissing } from './recommend';
import { buildMission, completeMissionItems, missionDone, partialStairNote, todayRoute } from './mission';
import { examPlan, newPlan, recordDiagnostic, validInput } from './examRescue';
import { tutorReply } from './tutor';
import { metrics, logEvent } from './analytics';
import { evaluate, seeded, identical, texToExpr, texRelation, holds } from './expr';
import { contentOf, loadAllContent } from './content/index';
import { addSubModel } from './content/signed';
import { learnAfterAnswer, emptyLearn } from './storeGlue';
import { startLesson, answer, withHelp } from '@/lib/lesson.js';

// the teaching content loads one topic at a time (DURABLE-11): these tests run on all of it, loaded
await loadAllContent();

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
  it('reads variables, and refuses a name it was not given', () => {
    expect(evaluate('3*x+1', { x: 2 })).toBe(7);
    expect(evaluate('2*x - 3*y', { x: 4, y: -1 })).toBe(11);
    expect(evaluate('sqrt(x)', { x: 9 })).toBe(3);
    expect(() => evaluate('3*x+1')).toThrow();
    expect(() => evaluate('3*x+1', { y: 2 })).toThrow();
    expect(() => evaluate('3x')).toThrow(); // no implicit multiplication in written expressions
  });
  it('tells identical expressions from ones that only agree at some values', () => {
    expect(identical('3*(x+4)', '3*x+12')).toBe(true);
    expect(identical('3*(x+4)', '3*x+4')).toBe(false);
    expect(identical('-(x-3)', '-x+3')).toBe(true);
    expect(identical('4 + 3*(n-1)', '3*n+1', ['n'])).toBe(true);
    expect(identical('2*x + 3*y - x', 'x + 3*y', ['x', 'y'])).toBe(true);
    expect(identical('x*x', '2*x')).toBe(false); // equal at 0 and at 2 only
    expect(identical('x^2 - 1', '(x-1)*(x+1)')).toBe(true);
  });
  it('reads the TeX a student sees, with the multiplication school algebra leaves out', () => {
    const at = (tex: string, x: number) => evaluate(texToExpr(tex), { x });
    expect(texToExpr('3x + 5')).toBe('3*x+5');
    expect(at('3x + 5', 2)).toBe(11);
    expect(at('-2(x - 3)', 5)).toBe(-4);
    expect(at('\\frac{x + 1}{3}', 20)).toBe(7);
    expect(at('x : 4', 12)).toBe(3);
    expect(at('x + \\frac{1}{3}x', 3.75)).toBe(5);
    expect(at('3 \\cdot 4x', 1)).toBe(12);
    expect(at('-3 \\cdot (-2x)', 1)).toBe(6);
    expect(at('x(x - 3)', 5)).toBe(10);
    expect(at('(x + 1)(x - 1)', 4)).toBe(15);
    expect(at('3x^2', 2)).toBe(12);
    expect(at('-x^{2} + 6', 2)).toBe(2);
    expect(at('\\left(x - 3\\right)^2', 1)).toBe(4);
    expect(at('2\\frac{1}{2}x', 2)).toBe(5); // a mixed number: 2½ · 2
    expect(at('\\dfrac{3x}{4} \\,-\\, 1', 4)).toBe(2);
    expect(at('5(7 − 2x)', 1)).toBe(25);
    expect(evaluate(texToExpr('2x + 3y'), { x: 1, y: 2 })).toBe(8);
    expect(() => texToExpr('3x + \\alpha')).toThrow();
    expect(() => texToExpr('(3x + 5')).toThrow();
    expect(() => texToExpr('')).toThrow();
  });
  it('checks an equation or an inequality as it is displayed', () => {
    expect(texRelation('3x + 5 = x + 11')).toEqual({ left: '3*x+5', rel: '=', right: 'x+11' });
    expect(holds('3x + 5 = x + 11', { x: 3 })).toBe(true);
    expect(holds('3x + 5 = x + 11', { x: 4 })).toBe(false);
    expect(holds('\\frac{x + 1}{3} = 7', { x: 20 })).toBe(true);
    expect(holds('7 - x = 3', { x: 4 })).toBe(true);
    expect(holds('7 - x = 3', { x: -4 })).toBe(false);
    expect(holds('2x + y = 5', { x: 2, y: 1 })).toBe(true);
    expect(holds('2x > -6', { x: -2 })).toBe(true);
    expect(holds('2x > -6', { x: -3 })).toBe(false);
    expect(holds('2x \\ge -6', { x: -3 })).toBe(true);
    expect(holds('-2x \\le 6', { x: -3 })).toBe(true);
    expect(holds('-2x \\le 6', { x: -4 })).toBe(false);
    expect(holds('x < 4', { x: 4 })).toBe(false);
    expect(holds('x ≤ 4', { x: 4 })).toBe(true);
    expect(() => texRelation('x = 3 = y')).toThrow();
    expect(() => texRelation('3x + 5')).toThrow();
  });
});

describe('the topic list the tutor and the exam check use', () => {
  it('names every topic of the app, the algebra ones included, and "other"', async () => {
    // @ts-ignore: plain JS shared with the Worker
    const { TOPIC_IDS } = await import('@shared/ai.js');
    expect([...TOPIC_IDS].sort()).toEqual([...TOPIC_ORDER, 'other'].sort());
  });
});

describe('grade 8 in school order (percent after ratio, before linear functions)', () => {
  it('puts pct after ratio and before line, and keeps the first-day test at 18 questions', async () => {
    expect(TOPIC_ORDER.indexOf('pct')).toBe(TOPIC_ORDER.indexOf('ratio') + 1);
    expect(TOPIC_ORDER.indexOf('pct')).toBeLessThan(TOPIC_ORDER.indexOf('line'));
    expect(TOPIC_ORDER).toEqual(['frac', 'signed', 'coord', 'angles', 'expr', 'eq', 'ratio', 'pct', 'line', 'pyth', 'stats', 'sys']);
    // @ts-ignore: plain JS
    const { placementMax } = await import('@/lib/placement.js');
    // @ts-ignore: plain JS
    const { topicsFor, placementTopicsFor, rescueTopicsFor } = await import('@/content/index.js');
    // ratio and pct are on the map of ח׳ but not in the first-day test (placement: false): 3 topics × 2 probes × 3
    expect(topicsFor('8').map((t: { id: string }) => t.id).slice(0, 3)).toEqual(['ratio', 'pct', 'line']);
    expect(placementTopicsFor('8').map((t: { id: string }) => t.id)).not.toContain('pct');
    expect(placementMax('8')).toBe(18);
    // ז׳ meets percents in relative frequency: Exam Rescue offers the unit to ז׳ too
    expect(rescueTopicsFor('7').map((t: { id: string }) => t.id)).toContain('pct');
  });
});

describe('the prerequisite graph', () => {
  it('names only real skills and has no cycle', () => {
    // every unit of TOPIC_ORDER, each with its number of stairs (62 at stage 1's end; each content stage adds its own)
    expect(Object.keys(STAIRS).sort()).toEqual([...TOPIC_ORDER].sort());
    expect(ALL_SKILLS).toHaveLength(TOPIC_ORDER.reduce((n, t) => n + STAIRS[t], 0));
    expect(new Set(ALL_SKILLS).size).toBe(ALL_SKILLS.length);
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

describe('the bridge unit (fractions): the floor under the grade, never a stair of it', () => {
  it('is in no grade\'s own list, and topicsFor shows no bridge unit', () => {
    expect([...BRIDGE]).toEqual(['frac']);
    expect(BRIDGE_SKILLS).toEqual(['frac:1', 'frac:2', 'frac:3', 'frac:4']);
    for (const g of ['7', '8'] as const) {
      expect(gradeSkillsOf(g).some((id) => id.startsWith('frac:'))).toBe(false);
      expect((topicsFor(g) as { bridge?: boolean }[]).some((t) => t.bridge)).toBe(false);
      expect((rescueTopicsFor(g) as { bridge?: boolean }[]).some((t) => t.bridge)).toBe(false);
      expect((bridgeTopicsFor(g) as { id: string }[]).map((t) => t.id)).toEqual(['frac']);
    }
    expect(topicsFor('7')[0].id).toBe('signed');
    expect(gradeSkillsOf('7')[0]).toBe('signed:1');
    // its stairs come first in the catalogue, so ALL_SKILLS stays in prerequisite order
    expect(ALL_SKILLS.slice(0, 4)).toEqual(['frac:1', 'frac:2', 'frac:3', 'frac:4']);
  });
  it('a fractions stair is not missing for a grade 7 student with no evidence', () => {
    expect(isMissing(ctx(empty(), '7'), 'frac:1')).toBe(false);
    expect(isMissing(ctx(empty(), '8'), 'frac:2')).toBe(false);
    // a grade 8 slope stair that leans on frac:1 is not held back by it
    const learn = empty();
    learn.skills['line:4'] = { attempts: [att(false), att(false), att(false), att(false)] };
    expect(smallestMissing(ctx(learn, '8'), 'line:4')).not.toBe('frac:1');
  });
  it('is missing after a failed floor check, a failed one only', () => {
    const floor = (right: number) => ({ ...empty(), floor: { at: NOW, on: true, results: { 'frac:1': { asked: 2, right }, 'frac:2': { asked: 2, right: 2 } }, facts: { asked: 2, right: 2 } } });
    expect(isMissing(ctx(floor(0)), 'frac:1')).toBe(true);
    expect(isMissing(ctx(floor(1)), 'frac:1')).toBe(false); // half right is not "fewer than half"
    expect(isMissing(ctx(floor(0)), 'frac:2')).toBe(false);
    // and a hard grade 8 stair then points at it as its smallest missing prerequisite
    const learn = floor(0) as LearnState;
    learn.skills['stats:3'] = { attempts: [att(false), att(false), att(false), att(false)] };
    learn.skills['frac:2'] = { attempts: [att(false), att(false), att(false), att(false)] };
    const pre = nextActions(ctx(learn, '8')).find((a) => a.kind === 'prereq');
    expect(pre?.skill.startsWith('frac:')).toBe(true);
  });
  it('is never offered as new unless the floor is on', () => {
    for (const g of ['7', '8'] as const) {
      expect(nextActions(ctx(empty(), g)).some((a) => a.skill.startsWith('frac:'))).toBe(false);
      const off = { ...empty(), floor: { at: NOW, on: false, results: { 'frac:1': { asked: 1, right: 0 } }, facts: { asked: 2, right: 2 } } };
      expect(nextActions(ctx(off, g)).some((a) => a.kind === 'new' && a.skill.startsWith('frac:'))).toBe(false);
    }
    const on = { ...empty(), floor: { at: NOW, on: true, results: {}, facts: { asked: 2, right: 2 } } };
    expect(nextActions(ctx(on, '7')).find((a) => a.kind === 'new')).toMatchObject({ skill: 'frac:1' });
    expect(nextActions(ctx(on, '8')).find((a) => a.kind === 'new')).toMatchObject({ skill: 'frac:1' });
  });
  it('a stair already started is continued, floor or not', () => {
    const learn = empty();
    learn.skills['frac:1'] = { attempts: [att(true)], taught: { A: NOW } };
    expect(nextActions(ctx(learn, '7')).find((a) => a.skill === 'frac:1')).toMatchObject({ kind: 'continue' });
  });
  it('an edge into a bridge stair counts on evidence only: equations are still new for grade 7 with no fraction evidence', () => {
    expect(PREREQS['eq:1']).toContain('frac:4');
    // every grade 7 unit before equations passed on the map; nothing at all is known about fractions
    const path = Object.fromEntries((['signed', 'coord', 'angles', 'expr'] as const).map((t) => [t, { parts: {}, reviews: 0, jumped: STAIRS[t] }]));
    const fresh = nextActions(ctx(empty(), '7', { path })).find((a) => a.kind === 'new');
    expect(fresh).toMatchObject({ skill: 'eq:1' });
    // and the reason does not claim the fractions stair as something the student already has
    expect(fresh!.reason).not.toContain('כפל וחילוק שברים');
    // a failed floor check on frac:4 holds equations back, and points at it
    const failed = { ...empty(), floor: { at: NOW, on: true, results: { 'frac:4': { asked: 1, right: 0 } }, facts: { asked: 2, right: 2 } } };
    expect(nextActions(ctx(failed, '7', { path })).some((a) => a.kind === 'new' && a.skill === 'eq:1')).toBe(false);
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
  it('matches a prediction that is not whole only by its rounding, the same way in practice and in the models', () => {
    // 4.5 is matched by 4.5 itself; 4.45 is near it but is not 4.5 rounded
    expect(matchesValue(4.5, 4.5)).toBe(true);
    expect(matchesValue(4.5, 4.45)).toBe(false);
    expect(matchesValue(0.48, 0.43)).toBe(false); // eq:3 transfer, gym fees: was named
    expect(matchesValue(56.25, 56.2)).toBe(false); // sys:1, 56.25 rounds to 56.3: was named
    expect(matchesValue(56.25, 56.3)).toBe(true);
    // halves away from zero, as at school: x : 4 = −3 moved over as a division is −0.75, typed −0.8
    expect(matchesValue(-0.75, -0.8)).toBe(true);
    expect(matchesValue(-0.75, -0.7)).toBe(false);
    expect(diagOf(-12, { 'move-no-flip': -0.75 })(-0.8)).toBe('move-no-flip');
    // a root is kept exact: 32 and 32.02 both match √1025
    expect(matchesValue(Math.sqrt(1025), 32)).toBe(true);
    expect(matchesValue(Math.sqrt(1025), 32.02)).toBe(true);
    // the practice generators read a number near a prediction the same way
    expect(diagOf(12, { m: 0.48 })(0.43)).toBe(null);
    expect(diagOf(60, { m: 56.25 })(56.2)).toBe(null);
  });
  it('never names a slip through a rounded prediction', () => {
    // sys:1 practice: +5%, now 441, before 420; the percent of the new price predicts 418.95, and 419 is one off 420
    expect(slipOf(419, 420)).toBe('off-by-one');
    expect(matchesValue(418.95, 419, 420)).toBe(false);
    expect(diagOf(420, { 'pct-of-new': 418.95 })(419)).toBe(null);
    expect(diagOf(420, { 'pct-of-new': 418.95 })(418.95)).toBe('pct-of-new');
    // sys:4 tickets: partial-dist predicts 16 − 40/39 = 14.97…; 15 is one off the answer 14, 14.97 is the prediction
    expect(diagOf(14, { 'partial-dist': 16 - 40 / 39 })(15)).toBe(null);
    expect(diagOf(14, { 'partial-dist': 16 - 40 / 39 })(14.97)).toBe('partial-dist');
    expect(slipLike(16 - 40 / 39, 14)).toBe(true);
    // the diagnostic models: a draw whose prediction rounds to a slip is never asked, and if it were, it names nothing
    const rnd = seeded(41);
    for (const skill of ['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5', 'expr:1', 'expr:2', 'expr:3', 'expr:4', 'expr:5', 'sys:1', 'sys:2', 'sys:3', 'sys:4', 'sys:5']) {
      const c = contentOf(skill)!;
      for (const m of [c.diag, c.transfer].filter(Boolean)) {
        for (let i = 0; i < 400; i += 1) {
          const p = m!.params(rnd); const ans = m!.answer(p);
          Object.entries(m!.bugs).forEach(([id, f]) => {
            const v = f(p); if (v == null || !Number.isFinite(v) || Math.abs(v - ans) < 1e-9) return;
            expect(slipLike(v, ans), `${skill} ${id}: ${v} for ${ans}`).toBe(false);
            [Math.round(v), ans + 1, ans - 1].filter((u) => slipOf(u, ans)).forEach((u) => {
              const d = diagnose(m!, p, u);
              expect(d.kind === 'misconception' && d.candidates.some((x) => x.id === id && !(Math.abs(v - u) < 1e-9)), `${skill} ${id}: ${u} named`).toBe(false);
            });
          });
        }
      }
    }
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
    expect(a[0]).toMatchObject({ kind: 'new', skill: 'signed:1', stage: 'A', to: '/learn/signed/1/A' });
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
    // done before mastery checks existed (kept), or passed over by the placement test
    const kept = ctx(empty(), '7', { path: { signed: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept' } } } });
    expect(nextActions(kept).find((a) => a.kind === 'new')).toMatchObject({ skill: 'signed:3' });
    expect(nextActions(ctx(empty(), '7', { path: { signed: { parts: {}, reviews: 0, jumped: 2 } } }))[0]).toMatchObject({ kind: 'new', skill: 'signed:3' });
    // and a stair kept green is offered its mastery check, before anything new (the stair in progress's band)
    expect(nextActions(kept)[0]).toMatchObject({ kind: 'mastery', skill: 'signed:1', to: '/lesson/signed/1?kind=check&purpose=mastery' });
  });
});

describe('the daily mission', () => {
  it('names the one stage of a new stair it asks for, and is done only when that stage is (reviewer P2)', () => {
    const items = buildMission(nextActions(ctx(empty())));
    const first = items[0];
    expect(first).toMatchObject({ kind: 'new', skill: 'signed:1', stage: 'A', to: '/learn/signed/1/A' });
    expect(first.title).toBe('מבינים את הרעיון: חיבור וחיסור');
    expect(first.reason).toContain('שלב 1 מתוך 5');
    // another stage, or practice, does not complete it; its own stage does
    expect(completeMissionItems(items, { skill: 'signed:1', kind: 'continue', stage: 'B' }, NOW)[0].done).toBeUndefined();
    const done = completeMissionItems(items, { skill: 'signed:1', kind: 'continue', stage: 'A' }, NOW);
    expect(done[0].done).toBe(NOW);
    // and the completion message says the stair goes on
    expect(partialStairNote(done)).toBe('במדרגה "חיבור וחיסור" סיימתם את שלב 1 מתוך 5 (מבינים את הרעיון). המדרגה עצמה עוד לא הושלמה: השלבים הבאים מחכים בדף שלה.');
  });
  it('continues a stair at its next stage, by name', () => {
    const learn = empty();
    learn.skills['signed:1'] = markTaught(markTaught(undefined, 'A', NOW), 'B', NOW);
    const a = nextActions(ctx(learn)).find((x) => x.skill === 'signed:1')!;
    expect(a).toMatchObject({ kind: 'continue', stage: 'C', title: 'פותרים יחד: חיבור וחיסור', to: '/learn/signed/1/C' });
  });
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
    items.forEach((i) => { done = completeMissionItems(done, { skill: i.skill, kind: i.kind === 'new' ? 'continue' : i.kind, stage: i.stage }, NOW); });
    expect(missionDone(done)).toBe(true);
  });
  it('"today\'s lesson" (the app\'s shortcut, STUDENT-10) opens where the mission\'s button does', () => {
    const items = buildMission(nextActions(ctx(empty())));
    expect(todayRoute(items)).toBe('/learn/signed/1/A');
    // the next part not done yet
    const two = [{ ...items[0], done: NOW }, { ...items[0], kind: 'continue' as const, stage: 'B' as const, to: '/learn/signed/1/B' }];
    expect(todayRoute(two)).toBe('/learn/signed/1/B');
    // an item saved without its route gets it from routeOf
    expect(todayRoute([{ ...items[0], to: '' }])).toBe('/learn/signed/1/A');
    // practice names no part (the curriculum lane's one route for a stair's practice: the map's button and the plan's)
    expect(todayRoute([{ ...items[0], to: '', stage: 'D' }])).toBe('/lesson/signed/1');
    expect(todayRoute([{ ...items[0], to: '', stage: undefined }])).toBe('/learn/signed/1');
    // nothing left (or no mission): the missions tab, where the day's card is
    expect(todayRoute(two.map((i) => ({ ...i, done: NOW })))).toBe('/quests');
    expect(todayRoute([])).toBe('/quests');
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
    // two right diagnostic answers: a good first check, never "mastered" (reviewer P1)
    expect(p.skills.find((s) => s.skill === 'signed:1')!.standing).toBe('ready');
    expect(p.mastered).toBe(0);
    expect(p.ready).toBe(1);
    expect(p.message).toContain('ב־1 מתוך 3 המדרגות עברתם את הבדיקה הראשונה');
    expect(p.message).not.toContain('שולטים');
    // and it is confirmed by a mastery check, not assumed with a review
    expect(p.days.flatMap((d) => d.tasks).find((t) => t.skill === 'signed:1')!.kind).toBe('mastery');
    expect(p.days).toHaveLength(3);
    expect(p.days[2].tasks.at(-1)!.kind).toBe('exam');
  });
  it('updates with real performance', () => {
    let plan = newPlan(input, NOW);
    ['signed:1', 'signed:3', 'coord:1'].forEach((s) => { plan = recordDiagnostic(plan, s, 0, 2, NOW); });
    const learn = empty();
    learn.skills['signed:3'] = recordMasteryCheck(undefined, 5, 5, NOW);
    const p = examPlan(plan, learn, NOW, DAY);
    expect(p.skills.find((s) => s.skill === 'signed:3')!.standing).toBe('mastered');
    expect(p.mastered).toBe(1);
    expect(p.message).toContain('שולטים לבד ב־1 מתוך 3');
  });
  it('says "mastered" only for a passed mastery check, even when every diagnostic answer was right', () => {
    let plan = newPlan({ ...input, skills: ['signed:1', 'signed:2'] }, NOW);
    plan = recordDiagnostic(plan, 'signed:1', 2, 2, NOW);
    plan = recordDiagnostic(plan, 'signed:2', 2, 2, NOW);
    const p = examPlan(plan, empty(), NOW, DAY);
    expect(p.skills.map((s) => s.standing)).toEqual(['ready', 'ready']);
    expect(p.message).toBe('יש לכם עוד 3 ימים למבחן. ב־2 מתוך 2 המדרגות עברתם את הבדיקה הראשונה: כנראה מוכנים, ובדיקת שליטה קצרה תאשר. היום: בדיקת שליטה קצרה בכל מדרגה כזאת, ובסוף מבחן תרגול.');
  });
  it('counts the days to the exam the same way on the home mission and in Exam Rescue', () => {
    const learn = empty();
    learn.exam = newPlan(input, NOW); // the exam is on 2026-11-11, today is 2026-11-08
    const action = nextActions(ctx(learn)).find((a) => a.kind === 'exam')!;
    expect(action.reason).toContain('המבחן בעוד 3 ימים');
    expect(examPlan(learn.exam, learn, NOW, DAY).message).toContain('עוד 3 ימים למבחן');
  });
  // the council's run: exam on Sunday 15.11, 15 minutes a day, five coordinate stairs, all of them gaps, today Tuesday 10.11
  const rescueOf = (skills: string[], date: string, minutes: number, today: string) => {
    let plan = newPlan({ grade: '7', date, skills, confidence: 1, minutes }, `${today}T08:00:00.000Z`);
    skills.forEach((sk) => { plan = recordDiagnostic(plan, sk, 0, 2, `${today}T08:00:00.000Z`); });
    return examPlan(plan, empty(), `${today}T09:00:00.000Z`, today);
  };
  /** Where each task sits: [day index, place in the day]. */
  const placeOf = (p: ReturnType<typeof examPlan>, skill: string, kind: string) => {
    for (let d = 0; d < p.days.length; d += 1) { const i = p.days[d].tasks.findIndex((t) => t.skill === skill && t.kind === kind); if (i >= 0) return [d, i]; }
    return null;
  };
  const before = (a: number[] | null, b: number[] | null) => !!a && !!b && (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]));
  it('never plans a mastery check before the lesson that teaches it', () => {
    const coord = ['coord:1', 'coord:2', 'coord:3', 'coord:4', 'coord:5'];
    const p = rescueOf(coord, '2026-11-15', 15, '2026-11-10');
    coord.forEach((sk) => {
      expect(before(placeOf(p, sk, 'learn'), placeOf(p, sk, 'practice')), `${sk}: practice before the lesson`).toBe(true);
      expect(before(placeOf(p, sk, 'practice'), placeOf(p, sk, 'mastery')), `${sk}: mastery check before practice`).toBe(true);
    });
    // and for any exam: a few random plans, short and long, with little time and with a lot
    const rnd = seeded(5);
    for (let n = 0; n < 60; n += 1) {
      const skills = ALL_SKILLS.filter(() => rnd() < 0.3).slice(0, 12);
      if (!skills.length) continue;
      const date = new Date('2026-11-10T12:00:00'); date.setDate(date.getDate() + 1 + Math.floor(rnd() * 12));
      const day = date.toLocaleDateString('en-CA');
      if (new Date(`${day}T12:00:00`).getDay() === 6) continue;
      const q = rescueOf(skills, day, [5, 10, 15, 30][Math.floor(rnd() * 4)], '2026-11-10');
      skills.forEach((sk) => {
        const m = placeOf(q, sk, 'mastery'); const l = placeOf(q, sk, 'learn');
        if (m && l) expect(before(l, m), `${sk} ${day}: mastery check before the lesson`).toBe(true);
      });
      expect(q.days.flatMap((d) => d.tasks).filter((t) => t.kind !== 'exam')).toHaveLength(skills.length * 3);
    }
  });
  it('puts no task on Shabbat, as the streak never asks for one', () => {
    const coord = ['coord:1', 'coord:2', 'coord:3', 'coord:4', 'coord:5'];
    const p = rescueOf(coord, '2026-11-15', 15, '2026-11-10');
    expect(p.days.map((d) => d.day)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']); // Saturday 14.11 is not a work day
    p.days.forEach((d) => expect(new Date(`${d.day}T12:00:00`).getDay(), d.day).not.toBe(6));
    // everything is still planned, and the practice exam closes the last day before the exam
    expect(p.days.flatMap((d) => d.tasks).filter((t) => t.kind !== 'exam')).toHaveLength(15);
    expect(p.days.at(-1)!.tasks.at(-1)!.kind).toBe('exam');
    // planned on Shabbat itself: today has no tasks, and the plan says so calmly
    const sat = rescueOf(['signed:1'], '2026-11-17', 15, '2026-11-14');
    expect(sat.today).toEqual([]);
    expect(sat.days[0].day).toBe('2026-11-15');
    expect(sat.message).toContain('היום שבת');
    // a Sunday exam planned on Shabbat: the work waits for the morning of the exam, never for Shabbat
    const sun = rescueOf(['signed:1'], '2026-11-15', 15, '2026-11-14');
    expect(sun.days.map((d) => d.day)).toEqual(['2026-11-15']);
    // an exam on Shabbat is a typo in the date
    expect(validInput({ ...input, date: '2026-11-14' }, DAY)).toContain('שבת');
  });
  it('plans the algebra stairs in order, around Shabbat, for a grade 8 exam that revises grade 7 equations', () => {
    // a grade 8 test on systems, revising equations: eq:2 and eq:4 (grade 7, offered to grade 8) and sys:1, all gaps
    const skills = ['sys:1', 'eq:4', 'eq:2'];
    let plan = newPlan({ grade: '8', date: '2026-11-16', skills, confidence: 1, minutes: 15 }, '2026-11-10T08:00:00.000Z');
    skills.forEach((sk) => { plan = recordDiagnostic(plan, sk, 0, 2, '2026-11-10T08:00:00.000Z'); });
    const p = examPlan(plan, empty(), '2026-11-10T09:00:00.000Z', '2026-11-10');
    // the stair a later one leans on comes first: eq:2 before eq:4 before sys:1
    expect(p.skills.map((s) => s.skill)).toEqual(['eq:2', 'eq:4', 'sys:1']);
    const first = (sk: string) => placeOf(p, sk, 'learn');
    expect(before(first('eq:2'), first('eq:4'))).toBe(true);
    expect(before(first('eq:4'), first('sys:1'))).toBe(true);
    skills.forEach((sk) => {
      expect(before(placeOf(p, sk, 'learn'), placeOf(p, sk, 'practice')), `${sk}: practice before the lesson`).toBe(true);
      expect(before(placeOf(p, sk, 'practice'), placeOf(p, sk, 'mastery')), `${sk}: mastery check before practice`).toBe(true);
    });
    // no task on Saturday 14.11, and the practice exam closes the last day
    p.days.forEach((d) => expect(new Date(`${d.day}T12:00:00`).getDay(), d.day).not.toBe(6));
    expect(p.days.map((d) => d.day)).not.toContain('2026-11-14');
    expect(p.days.at(-1)!.tasks.at(-1)!.kind).toBe('exam');
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
  it('events about the saved data (a merge, a restore) and unknown ones count as no learning day', () => {
    const learn = empty();
    let ev = logEvent([], { e: 'check-done', s: 'signed:1', p: 'mastery', n: 1, ok: true }, '2026-11-01T10:00:00.000Z');
    ev = logEvent(ev, { e: 'merge', m: 'tab' }, '2026-11-20T10:00:00.000Z');
    ev = logEvent(ev, { e: 'restore', m: 'file' }, '2026-12-20T10:00:00.000Z');
    learn.events = ev;
    const m = metrics(learn, NOW);
    expect(m.activeDays).toBe(1);
    expect(m.returned).toEqual({ d1: false, d7: false, d30: false });
    expect(Object.values(m.adoption).every((n) => n === 0)).toBe(true);
    expect(m.lessonsDone).toBe(0);
  });
});

describe('help from the tutor is not independent evidence (ai spec AI-3 Design 4)', () => {
  it('a right first answer after asking the tutor is recorded with independent: false', () => {
    const s: any = withHelp(startLesson({ kind: 'node', topic: 'signed', level: 1 }));
    const { result }: any = answer(s, s.item.answer);
    expect(result.event.hint).toBe(true);
    const learn = learnAfterAnswer(emptyLearn(), result.event);
    const rec = learn.skills[`signed:${result.event.level}`];
    expect(rec.attempts.at(-1)).toMatchObject({ ok: true, independent: false, purpose: 'practice' });
    // the same answer without help is independent
    const alone: any = startLesson({ kind: 'node', topic: 'signed', level: 1 });
    const own = (answer(alone, alone.item.answer) as any).result.event;
    expect(learnAfterAnswer(emptyLearn(), own).skills[`signed:${own.level}`].attempts.at(-1)?.independent).toBe(true);
  });
});
