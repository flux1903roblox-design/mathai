// XP goes through one helper (DURABLE-2): every write adds to this device's entry of xpBy, xp stays their sum, a reset
// clears both and records when, and signing out gives the next student a new device tag. The grep below fails if
// store.js raises the top-level XP any other way.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addXp, sumXp, newTag, TAG } from './xp.js';
import { useApp, today } from '../store.js';

describe('addXp', () => {
  const st = { xp: 30, xpBy: { a1b2c3d4: 20, b2c3d4e5: 10 }, durable: { tag: 'a1b2c3d4' } };
  it('adds to this device only', () => {
    expect(addXp(st, 5)).toEqual({ xp: 35, xpBy: { a1b2c3d4: 25, b2c3d4e5: 10 } });
    expect(st.xpBy.a1b2c3d4).toBe(20); // the state it was given is not changed
  });
  it('a gain that is not a positive number changes nothing', () => {
    for (const n of [0, -3, NaN, undefined, '5']) expect(addXp(st, n)).toEqual({ xp: 30, xpBy: st.xpBy });
  });
  it('a device that never saved gets its tag with its first XP', () => {
    const out = addXp({ xp: 0, xpBy: {}, durable: { tag: null, nudgeCount: 0 } }, 4);
    expect(out.durable.tag).toMatch(TAG);
    expect(out.durable.nudgeCount).toBe(0);
    expect(out).toMatchObject({ xp: 4, xpBy: { [out.durable.tag]: 4 } });
  });
  it('sumXp counts only real entries', () => {
    expect(sumXp({ a: 3, b: 4 })).toBe(7);
    expect(sumXp({ a: 3, b: NaN, c: -2 })).toBe(3);
    expect(sumXp(null)).toBe(0);
    expect(newTag()).toMatch(TAG);
  });
});

describe('the store writes XP only through addXp', () => {
  const src = readFileSync(fileURLToPath(new URL('../store.js', import.meta.url)), 'utf8');
  // every `xp:` key the store writes, outside the per-day counters (`days[d].xp`, always `(cur.xp || 0) + …`)
  const writes = [...src.matchAll(/(?<![.\w])xp:\s*([^,}\n]+)/g)].map((m) => m[1].trim()).filter((v) => !v.startsWith('(cur.xp || 0)'));
  it('no top-level XP is raised from its previous value', () => {
    expect(src).not.toMatch(/(?<![.\w])xp:\s*\(?\s*(?:st|get\(\)|state|prev|s)\.xp\b/);
    expect(src).not.toMatch(/\.xp\s*\+=/);
    expect(src).not.toMatch(/xp:\s*get\(\)\.xp/);
  });
  it('the top-level XP is only ever set to 0 (the empty state and a reset)', () => {
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes.every((v) => /^0\b/.test(v))).toBe(true);
  });
  it('the six XP writes go through addXp', () => {
    // an action's code: from its name to the next action (or comment) at the same indent
    const bodyOf = (name) => { const rest = src.slice(src.indexOf(`      ${name}: (`) + 1); return rest.slice(0, rest.search(/\n {6}(?:\/\*\*|\/\/ |[A-Za-z]+: )/)); };
    for (const name of ['recordAnswer', 'completeCheck', 'completeStage', 'addXP', 'completeLesson', 'completePlacement']) {
      expect(bodyOf(name), name).toMatch(/\.\.\.addXp\((get\(\)|st), |set\(addXp\(get\(\), n\)\)/);
    }
  });
});

describe('XP in the store', () => {
  const TAG1 = 'c0ffee00';
  beforeEach(() => {
    useApp.getState().signOut();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7' }, durable: { ...useApp.getState().durable, tag: TAG1 } });
  });
  const expectCounter = (xp) => {
    const s = useApp.getState();
    expect(s.xp).toBe(xp);
    expect(s.xpBy).toEqual(xp ? { [TAG1]: xp } : {});
  };
  it('every way to earn XP counts it on this device', () => {
    const s = () => useApp.getState();
    s().recordAnswer({ topic: 'signed', level: 1, ok: true, first: true }, 2); expectCounter(2);
    s().completeLesson({ topic: 'signed', level: 1, xp: 10, kind: 'practice' }); expectCounter(12);
    s().completeStage('signed:1', 'A'); expectCounter(22); // STAGE_XP.A, the first time
    s().completeStage('signed:1', 'A'); expectCounter(22); // a stage done again earns nothing
    s().completeCheck({ purpose: 'review', xp: 3 }); expectCounter(25);
    s().addXP(5); expectCounter(30);
    s().completePlacement({ grade: '7', results: {}, xp: 4 }); expectCounter(34);
    expect(s().days[today()].xp).toBe(27); // the day's own XP is counted as before (answers and addXP add to the total only)
  });
  it('a reset clears XP and its counter, and says when', () => {
    useApp.getState().addXP(7);
    useApp.getState().resetProgress();
    expectCounter(0);
    expect(Date.parse(useApp.getState().resetAt)).toBeGreaterThan(Date.now() - 5000);
  });
  it('signing out gives the next student a new device tag, and keeps what belongs to the device', () => {
    useApp.setState({ durable: { ...useApp.getState().durable, persistAsked: '2026-11-01T10:00:00.000Z', nudgeCount: 2 }, backup: { ...useApp.getState().backup, on: true } });
    useApp.getState().addXP(7);
    useApp.getState().signOut();
    const s = useApp.getState();
    expect(s.durable.tag).toMatch(TAG);
    expect(s.durable.tag).not.toBe(TAG1);
    expect(s.durable.persistAsked).toBe('2026-11-01T10:00:00.000Z');
    expect(s.durable.nudgeCount).toBe(0);
    expect(s.backup.on).toBe(false);
    expect(s.xp).toBe(0);
    expect(s.xpBy).toEqual({});
    // a sign-out clears the progress on purpose: a tab still open with the old progress cannot merge it back
    expect(Date.parse(s.resetAt)).toBeGreaterThan(Date.now() - 5000);
  });
});
