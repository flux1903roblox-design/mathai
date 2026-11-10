// Class work on the student's device (learn/assignments.ts): the stage of an assigned stair, the report the learning
// record gives, and how two reports combine (the server's monotonic rules).
import { describe, it, expect } from 'vitest';
import { stairStage, workFromLearn, mergeWork, adds, type ClassAssignment } from './assignments';
import { emptyLearn } from './storeGlue';
import type { Attempt, SkillRecord } from './types';

const at = '2026-11-05T09:00:00.000Z';
const practice = (n: number, ok = true): Attempt[] => Array.from({ length: n }, () => ({ at, ok, independent: true, purpose: 'practice' }));
const taught = (...stages: ('A' | 'B' | 'C')[]) => Object.fromEntries(stages.map((s) => [s, at]));
const stair = (over: Partial<ClassAssignment> = {}): ClassAssignment => ({ id: 'a000000000000001', kind: 'stair', skill: 'signed:1', title: 'x', note: '', startsOn: '2026-11-05', dueOn: '2026-11-12', mine: null, ...over });

describe('stairStage', () => {
  it('counts the stages of a stair with teaching content', () => {
    expect(stairStage('signed:1', undefined)).toBe(0);
    expect(stairStage('signed:1', { attempts: practice(3) })).toBe(0); // practice without the explanation is not a stage of the journey
    expect(stairStage('signed:1', { attempts: [], taught: taught('A') })).toBe(1);
    expect(stairStage('signed:1', { attempts: [], taught: taught('A', 'B') })).toBe(2);
    expect(stairStage('signed:1', { attempts: [], taught: taught('A', 'B', 'C') })).toBe(3);
    expect(stairStage('signed:1', { attempts: practice(5), taught: taught('A', 'B', 'C') })).toBe(3);
    expect(stairStage('signed:1', { attempts: practice(6), taught: taught('A', 'B', 'C') })).toBe(4);
    expect(stairStage('signed:1', { attempts: [], mastered: { at, box: 0, due: at } })).toBe(5);
  });
  it('a stair without teaching content: any practice is 1, six right answers are 4', () => {
    expect(stairStage('signed:9', undefined)).toBe(0);
    expect(stairStage('signed:9', { attempts: practice(1, false) })).toBe(1);
    expect(stairStage('signed:9', { attempts: practice(5) })).toBe(1);
    expect(stairStage('signed:9', { attempts: practice(6) })).toBe(4);
    expect(stairStage('signed:9', { attempts: [], mastered: { at, box: 0, due: at } })).toBe(5);
  });
});

describe('workFromLearn', () => {
  const withRec = (rec: SkillRecord, events: any[] = []) => ({ ...emptyLearn(), skills: { 'signed:1': rec }, events });
  it('nothing done is no report; a stage done is started', () => {
    expect(workFromLearn(stair(), emptyLearn())).toBeNull();
    expect(workFromLearn(stair(), withRec({ attempts: [], taught: taught('A') }))).toEqual({ state: 'started', stage: 1, passed: false });
  });
  it('an answer on the stair since the assignment started is started, even at stage 0; an older one is not', () => {
    expect(workFromLearn(stair(), withRec({ attempts: practice(1) }))).toEqual({ state: 'started', stage: 0, passed: false });
    expect(workFromLearn(stair({ startsOn: '2026-11-06' }), withRec({ attempts: practice(1) }))).toBeNull();
  });
  it('mastered is done and passed; a finished mastery check since the start is done, not passed', () => {
    expect(workFromLearn(stair(), withRec({ attempts: [], taught: taught('A', 'B', 'C'), mastered: { at, box: 0, due: at } }))).toEqual({ state: 'done', stage: 5, passed: true });
    const failed = withRec({ attempts: practice(6), taught: taught('A', 'B', 'C'), failedChecks: 1 }, [{ t: at, e: 'check-done', s: 'signed:1', p: 'mastery', ok: false }]);
    expect(workFromLearn(stair(), failed)).toEqual({ state: 'done', stage: 4, passed: false });
    // a check finished before the assignment started is not this assignment's
    expect(workFromLearn(stair({ startsOn: '2026-11-06' }), failed)).toEqual({ state: 'started', stage: 4, passed: false });
    // one answer of a check left half-way is not a finished check
    const half = withRec({ attempts: [{ at, ok: true, independent: true, purpose: 'mastery' }], taught: taught('A') });
    expect(workFromLearn(stair(), half)).toEqual({ state: 'started', stage: 1, passed: false });
  });
  it('a check reports its own events, so the record gives nothing for it', () => {
    expect(workFromLearn(stair({ kind: 'check' }), withRec({ attempts: [], mastered: { at, box: 0, due: at } }))).toBeNull();
  });
});

describe('mergeWork (the server\'s rules)', () => {
  it('never lowers the state, the stage or passed', () => {
    expect(mergeWork({ state: 'done', stage: 4, passed: true }, { state: 'started', stage: 2, passed: false })).toEqual({ state: 'done', stage: 4, passed: true });
    expect(mergeWork({ state: 'started', stage: 1, passed: false }, { state: 'started', stage: 3, passed: false })).toEqual({ state: 'started', stage: 3, passed: false });
    expect(mergeWork({ state: 'started', stage: 4 }, { state: 'done', stage: 5, passed: true })).toEqual({ state: 'done', stage: 5, passed: true });
  });
  it('keeps the first finished result', () => {
    const first = { state: 'done' as const, right: 3, asked: 5, passed: false };
    expect(mergeWork(first, { state: 'done', right: 5, asked: 5, passed: true })).toEqual({ state: 'done', right: 3, asked: 5, passed: true });
    expect(mergeWork({ state: 'started' }, first)).toEqual({ state: 'done', right: 3, asked: 5, passed: false });
  });
  it('with nothing on one side it is the other; fields neither has stay out', () => {
    expect(mergeWork(null, { state: 'started' })).toEqual({ state: 'started' });
    expect(mergeWork({ state: 'started' }, undefined)).toEqual({ state: 'started' });
    expect(mergeWork(null, null)).toBeNull();
    expect(mergeWork({ state: 'started', stage: null, right: null }, { state: 'started' })).toEqual({ state: 'started' });
  });
  it('adds: only a report that would change the state, the stage or passed is sent', () => {
    expect(adds(null, { state: 'started', stage: 1, passed: false })).toBe(true);
    expect(adds({ state: 'started', stage: 1, passed: false }, { state: 'started', stage: 1, passed: false })).toBe(false);
    expect(adds({ state: 'started', stage: 1, passed: false }, { state: 'started', stage: 2, passed: false })).toBe(true);
    expect(adds({ state: 'done', stage: 5, passed: true }, { state: 'started', stage: 3, passed: false })).toBe(false);
    expect(adds({ state: 'started' }, null)).toBe(false);
  });
});
