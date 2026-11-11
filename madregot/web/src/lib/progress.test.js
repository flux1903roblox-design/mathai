// The first session gives something back, and the counters move from the first stage:
//  - a finished teaching stage (A understand, B worked examples, C solve together) earns XP the first time, counts
//    for the day's goal and keeps the streak like a lesson, and is recorded as learning, never as mastery;
//  - a stair's five stages, a unit's stages and the board's words move from that first stage, with no row of zeros.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useApp, streakOf, today, dayBefore, isActiveDay } from './store.js';
import { STAGE_XP, PARTS } from './lesson.js';
import { stagesDone, unitProgress, unitCountText, stairProgress, STAIR_STAGES, unitNodes, addedStairNote } from './path.js';
import { questProgress, questsFor, QUESTS } from './quests.js';

const dayAfter = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); };
import { gradeTiles, tilesSummary } from '@/components/learn/MasteryMap.jsx';

const S = 'signed:1';

// the first stair of the course, and an algebra stair added later: the same rules
describe.each([['signed:1'], ['expr:1']])('a finished teaching stage is a real step of the day (%s)', (S) => {
  const [topic, lv] = S.split(':'); const level = Number(lv);
  beforeEach(() => { useApp.getState().resetProgress(); useApp.setState({ goalXp: 20, freezes: 0 }); });

  it('the first time, each stage earns its XP, towards the day and in total', () => {
    const a = useApp.getState().completeStage(S, 'A');
    expect(a).toMatchObject({ xp: STAGE_XP.A, first: true, streakExtended: true, streak: 1, goalReached: false });
    const b = useApp.getState().completeStage(S, 'B');
    expect(b).toMatchObject({ xp: STAGE_XP.B, first: true, streakExtended: false });
    const c = useApp.getState().completeStage(S, 'C');
    expect(c.xp).toBe(STAGE_XP.C);
    const st = useApp.getState();
    const total = STAGE_XP.A + STAGE_XP.B + STAGE_XP.C;
    expect(st.xp).toBe(total);
    expect(st.days[today()]).toMatchObject({ xp: total, stages: 3 });
    // the three stages of a first session (about 12 minutes) reach the usual daily goal of 20 XP
    expect(total).toBeGreaterThanOrEqual(20);
    expect(c.goalReached).toBe(true);
  });

  it('a stage done again earns no more XP (it still counts as learning that day)', () => {
    useApp.getState().completeStage(S, 'A');
    const again = useApp.getState().completeStage(S, 'A');
    expect(again).toMatchObject({ xp: 0, first: false });
    expect(useApp.getState().xp).toBe(STAGE_XP.A);
    expect(useApp.getState().days[today()].stages).toBe(2);
  });

  it('it is learning, never mastery: the stage is marked taught and nothing is mastered', () => {
    useApp.getState().completeStage(S, 'A');
    const rec = useApp.getState().learn.skills[S];
    expect(rec.taught.A).toBeTruthy();
    expect(rec.mastered).toBeUndefined();
    expect(useApp.getState().path[topic]?.done?.[level]).toBeUndefined();
  });

  it('a day with only a teaching stage keeps the streak, like a day with a lesson', () => {
    const y = dayBefore(today());
    useApp.setState({ days: { [y]: { lessons: 1, xp: 10 } } });
    expect(streakOf(useApp.getState().days)).toBe(1);
    const a = useApp.getState().completeStage(S, 'A');
    expect(a.streakExtended).toBe(true);
    expect(a.streak).toBe(2);
    expect(isActiveDay({ stages: 1 })).toBe(true);
    // and a lesson later the same day does not extend it a second time
    const r = useApp.getState().completeLesson({ kind: 'node', topic, level, part: 1, xp: 10, passed: true });
    expect(r.streakExtended).toBe(false);
    expect(r.streak).toBe(2);
  });

  it("when a stage's XP finishes the day's quests, the quest reward (a streak freeze) is given then", () => {
    // a day whose three quests include the XP one
    let key = '2026-11-02';
    while (!questsFor(key).includes('xp')) key = dayAfter(key);
    vi.useFakeTimers(); vi.setSystemTime(new Date(`${key}T12:00:00`));
    try {
      expect(today()).toBe(key);
      // every other quest of the day is done; the XP quest is one stage short
      const day = { lessons: 5, combo: 10, perfect: 1, ok: 30, missionDone: 1, xp: QUESTS.xp.target - STAGE_XP.A };
      useApp.setState({ days: { [key]: day }, freezes: 0 });
      expect(questProgress(key, day).every((q) => q.done)).toBe(false);
      const a = useApp.getState().completeStage(S, 'A');
      expect(a).toMatchObject({ questsDone: true, freezeEarned: true });
      expect(useApp.getState().freezes).toBe(1);
      expect(useApp.getState().days[key].questsRewarded).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});

describe('counters that move from the first stage', () => {
  it("a stair's stages: each teaching stage, practice once its lessons are done, the mastery check", () => {
    expect(stagesDone(undefined, 0)).toBe(0);
    expect(stagesDone({ attempts: [], taught: { A: 'x' } }, 0)).toBe(1);
    expect(stagesDone({ attempts: [], taught: { A: 'x', B: 'x', C: 'x' } }, 1)).toBe(3);
    expect(stagesDone({ attempts: [], taught: { A: 'x', B: 'x', C: 'x' } }, PARTS)).toBe(4);
    expect(stagesDone({ attempts: [], taught: { A: 'x', B: 'x', C: 'x' }, mastered: { at: 'x', box: 0, due: 'x' } }, PARTS)).toBe(5);
    // a stair done before mastery checks existed counts whole
    expect(stagesDone(undefined, 0, true)).toBe(STAIR_STAGES);
    // the ring and the count agree once a stage is whole
    expect(stairProgress({ attempts: [], taught: { A: 'x' } }, 0)).toBeCloseTo(1 / 5);
  });

  it('a unit says its size first, then stages, then stairs, and never "0 מתוך"', () => {
    // signed numbers: six stairs since signed:6 (signed fractions and decimals)
    const fresh = unitProgress('signed', {}, {});
    expect(unitCountText(fresh)).toBe('6 מדרגות');
    const started = unitProgress('signed', {}, { [S]: { attempts: [], taught: { A: 'x' } } });
    expect(started).toMatchObject({ stages: 1, of: 30, done: 0 });
    expect(unitCountText(started)).toBe('1 מתוך 30 שלבים');
    const mastered = unitProgress('signed', { signed: { parts: { 1: PARTS }, done: { 1: 'mastered' } } }, { [S]: { attempts: [], taught: { A: 'x', B: 'x', C: 'x' }, mastered: { at: 'x', box: 0, due: 'x' } } });
    expect(mastered).toMatchObject({ done: 1, stages: 5 });
    expect(unitCountText(mastered)).toBe('1 מתוך 6 מדרגות');
    for (const p of [fresh, started, mastered]) expect(unitCountText(p)).not.toMatch(/^0 /);
    // an algebra unit the same way
    expect(unitCountText(unitProgress('eq', {}, {}))).toBe('5 מדרגות');
    expect(unitCountText(unitProgress('eq', {}, { 'eq:1': { attempts: [], taught: { A: 'x', B: 'x' } } }))).toBe('2 מתוך 25 שלבים');
    expect(unitCountText(unitProgress('sys', { sys: { parts: { 1: PARTS }, done: { 1: 'mastered' } } }, { 'sys:1': { attempts: [], taught: { A: 'x', B: 'x', C: 'x' }, mastered: { at: 'x', box: 0, due: 'x' } } }))).toBe('1 מתוך 5 מדרגות');
  });

  it("the board's line says what the tiles show, and has no row of zeros", () => {
    const now = '2026-11-05T10:00:00.000Z';
    const fresh = tilesSummary(gradeTiles('7', {}, {}, now));
    expect(fresh).not.toMatch(/\b0\b/);
    const after = tilesSummary(gradeTiles('7', { [S]: { attempts: [], taught: { A: now } } }, {}, now));
    expect(after).toBe('מדרגה אחת בדרך לשליטה');
    const two = tilesSummary(gradeTiles('7', { [S]: { attempts: [], taught: { A: now } }, 'signed:2': { attempts: [], taught: { A: now } } }, {}, now));
    expect(two).toBe('2 מדרגות בדרך לשליטה');
    // the grade's tiles include its algebra stairs, and they move the same way
    expect(gradeTiles('7', {}, {}, now).map((r) => r.t.id)).toEqual(expect.arrayContaining(['expr', 'eq']));
    expect(tilesSummary(gradeTiles('7', { 'eq:2': { attempts: [], taught: { A: now } } }, {}, now))).toBe('מדרגה אחת בדרך לשליטה');
  });
});

describe('a stair added to a unit after it was climbed (signed:6)', () => {
  const five = { 1: 'mastered', 2: 'mastered', 3: 'kept', 4: 'mastered', 5: 'mastered' };
  it('keeps the five stairs as they were, makes the new one current, and its card says so', () => {
    const path = { signed: { parts: { 5: 2 }, reviews: 1, jumped: 0, done: five } };
    const nodes = unitNodes('signed', path);
    expect(nodes.slice(0, 5).map((n) => n.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(nodes[5]).toMatchObject({ level: 6, state: 'current', title: 'שברים ועשרוניים מכוונים' });
    // the unit review waits for the new stair
    expect(nodes[6]).toMatchObject({ kind: 'review', state: 'locked' });
    expect(addedStairNote(nodes[5], path)).toBe('נוספה מדרגה חדשה ליחידה: שברים ועשרוניים מכוונים.');
    // no other card says it
    nodes.filter((n) => n !== nodes[5]).forEach((n) => expect(addedStairNote(n, path)).toBeNull());
  });
  it('says nothing while the stair before it is not done, or once the new stair is done', () => {
    const open = { signed: { parts: {}, reviews: 0, jumped: 5, done: { 1: 'mastered' } } };
    expect(unitNodes('signed', open)[5].state).toBe('current');
    expect(addedStairNote(unitNodes('signed', open)[5], open)).toBeNull();
    const all = { signed: { parts: {}, reviews: 1, jumped: 0, done: { ...five, 6: 'mastered' } } };
    expect(addedStairNote(unitNodes('signed', all)[5], all)).toBeNull();
  });
  it('statistics (stats:6-8, curriculum stage 3): the first new stair is current after the five, and its card names all three', () => {
    const path = { stats: { parts: {}, reviews: 1, jumped: 0, done: { 1: 'mastered', 2: 'mastered', 3: 'mastered', 4: 'mastered', 5: 'mastered' } } };
    const nodes = unitNodes('stats', path);
    expect(nodes.slice(5, 9).map((n) => [n.level, n.state])).toEqual([[6, 'current'], [7, 'locked'], [8, 'locked'], [8, 'locked']]);
    expect(nodes[8]).toMatchObject({ kind: 'review', state: 'locked' });
    expect(addedStairNote(nodes[5], path)).toBe('נוספו ליחידה שלוש מדרגות חדשות: טווח, שני מקורות מידע, ואינטרפולציה ואקסטרפולציה.');
    nodes.filter((n) => n !== nodes[5]).forEach((n) => expect(addedStairNote(n, path)).toBeNull());
  });
});
