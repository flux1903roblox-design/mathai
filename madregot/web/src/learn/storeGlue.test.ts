// The learning model's side of the store for the floor (curriculum stage 1, CURRICULUM-3): the floor check writes
// learn.floor, and a multiplication fact changes nothing in the learning record.
import { describe, it, expect } from 'vitest';
import { emptyLearn, learnAfterAnswer, learnAfterCheck, type CheckResult } from './storeGlue';

const AT = '2026-11-05T10:00:00.000Z';
const floorResult = (perSkill: CheckResult['perSkill']): CheckResult => {
  const vals = Object.values(perSkill);
  return { purpose: 'floor', right: vals.reduce((a, x) => a + x.right, 0), asked: vals.reduce((a, x) => a + x.asked, 0), perSkill };
};
const all = (fracRight: Record<string, number>, factsRight = 2) => floorResult({
  ...Object.fromEntries(['frac:1', 'frac:2', 'frac:3', 'frac:4'].map((s) => [s, { asked: 1, right: fracRight[s] ?? 1 }])),
  'facts:0': { asked: 2, right: factsRight },
});

describe('a fresh learning record', () => {
  it('has no floor record and no challenges yet', () => {
    expect(emptyLearn()).toMatchObject({ floor: null, challenges: {} });
  });
});

describe('learnAfterCheck: the floor check', () => {
  it('writes what each fractions stair showed and the facts, and a missed fractions question switches the unit on', () => {
    const L = learnAfterCheck(emptyLearn(), all({ 'frac:3': 0 }), AT, '2026-11-05');
    expect(L.floor).toEqual({
      at: AT, on: true,
      results: { 'frac:1': { asked: 1, right: 1 }, 'frac:2': { asked: 1, right: 1 }, 'frac:3': { asked: 1, right: 0 }, 'frac:4': { asked: 1, right: 1 } },
      facts: { asked: 2, right: 2 },
    });
    expect(L.events.filter((e) => e.e === 'check-done' && e.p === 'floor').map((e) => e.s).sort()).toEqual(['frac:1', 'frac:2', 'frac:3', 'frac:4']);
    expect(L.events.find((e) => e.e === 'floor-done')).toMatchObject({ ok: false });
  });
  it('nothing missed leaves the unit off the map', () => {
    const L = learnAfterCheck(emptyLearn(), all({}), AT, '2026-11-05');
    expect(L.floor?.on).toBe(false);
    expect(L.events.find((e) => e.e === 'floor-done')).toMatchObject({ ok: true, n: 1 });
  });
  it('missed facts alone do not put the fractions unit on the map, and are kept', () => {
    const L = learnAfterCheck(emptyLearn(), all({}, 1), AT, '2026-11-05');
    expect(L.floor).toMatchObject({ on: false, facts: { asked: 2, right: 1 } });
  });
  it('a unit already on stays on after a check with nothing missed (only the student hides it)', () => {
    const before = learnAfterCheck(emptyLearn(), all({ 'frac:1': 0 }), AT, '2026-11-05');
    const after = learnAfterCheck(before, all({}), '2026-11-06T10:00:00.000Z', '2026-11-06');
    expect(after.floor).toMatchObject({ on: true, at: '2026-11-06T10:00:00.000Z', results: { 'frac:1': { asked: 1, right: 1 } } });
  });
  it('a unit hidden by the student comes back when a later check misses a fractions question', () => {
    const hidden = { ...emptyLearn(), floor: { at: AT, on: false, results: { 'frac:2': { asked: 1, right: 0 } }, facts: { asked: 2, right: 2 } } };
    expect(learnAfterCheck(hidden, all({}), AT, '2026-11-05').floor?.on).toBe(false);
    expect(learnAfterCheck(hidden, all({ 'frac:4': 0 }), AT, '2026-11-05').floor?.on).toBe(true);
  });
  it('a save from before the floor existed (no field at all) is read as no record', () => {
    const { floor: _none, challenges: _c, ...old } = emptyLearn();
    const L = learnAfterCheck(old, all({ 'frac:2': 0 }), AT, '2026-11-05');
    expect(L.floor?.on).toBe(true);
    // another check leaves the floor as it was
    const M = learnAfterCheck(old, { purpose: 'mastery', skill: 'signed:1', right: 5, asked: 5, perSkill: {} }, AT, '2026-11-05');
    expect(M.floor).toBeNull();
  });
});

describe('learnAfterAnswer: a multiplication fact', () => {
  it('changes nothing in the learning record, right or wrong, in a check or in practice', () => {
    const L = emptyLearn();
    for (const ok of [true, false]) {
      for (const purpose of ['diagnostic', 'practice'] as const) {
        expect(learnAfterAnswer(L, { topic: 'facts', level: 0, ok, first: true, purpose, key: 'facts:7:8:mul', at: AT })).toBe(L);
      }
    }
  });
  it('a fractions question of the floor check is diagnostic evidence on its stair, and a wrong answer names its misconception', () => {
    const L = learnAfterAnswer(emptyLearn(), { topic: 'frac', level: 3, ok: false, first: true, purpose: 'diagnostic', key: 'frac:3:diag:x', at: AT, cands: [{ id: 'add-across', conf: 1 }] });
    expect(L.skills['frac:3'].attempts).toEqual([{ at: AT, ok: false, independent: true, purpose: 'diagnostic' }]);
    expect(L.miscon['frac:3|add-across']).toMatchObject({ skill: 'frac:3', id: 'add-across', state: 'suspected' });
  });
});
