import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startLesson, answer, next, resultOf, progressOf, planLevels, LESSON_LEN, REVIEW_LEN, PARTS, XP } from './lesson.js';
import { unitNodes, recordOnPath, doneUpTo, nextNode } from './path.js';
import { questsFor, questProgress } from './quests.js';
import { useApp, streakOf, today, dayBefore } from './store.js';
import { TOPIC, topicsFor } from '@/content/index.js';

const right = (s) => s.item.answer;
const wrongOf = (s) => (s.item.form === 'mc' ? (s.item.answer + 1) % s.item.choices.length : s.item.form === 'pt' ? [999, 999] : s.item.form === 'line' ? { m: 999, b: 999 } : 99999);
const run = (s, plan) => { // plan: per answer, true = right, false = wrong
  let st = s;
  for (const ok of plan) {
    st = answer(st, ok ? right(st) : wrongOf(st)).s;
    if (st.phase !== 'retry') st = next(st);
    if (st.finished) break;
  }
  return st;
};

describe('lesson', () => {
  it('a clean lesson is 8 exercises, all first try, with the perfect bonus', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 1 });
    expect(s.total).toBe(LESSON_LEN);
    s = run(s, Array(LESSON_LEN).fill(true));
    expect(s.finished).toBe(true);
    expect(progressOf(s)).toBe(1);
    const r = resultOf(s);
    expect(r).toMatchObject({ accuracy: 100, perfect: true, xp: XP.lesson + XP.perfect, bestCombo: LESSON_LEN });
  });
  it('wrong once gives a retry with a hint; wrong twice reveals and brings a similar exercise back at the end', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 2 });
    let r = answer(s, wrongOf(s)); s = r.s;
    expect(r.result.retry).toBe(true); expect(s.phase).toBe('retry'); expect(s.hint).toBe(true);
    r = answer(s, wrongOf(s)); s = r.s;
    expect(r.result.reveal).toBe(true); expect(s.redo).toHaveLength(1); expect(progressOf(s)).toBe(0);
    s = next(s);
    s = run(s, Array(LESSON_LEN - 1).fill(true));
    expect(s.finished).toBe(false); // the missed exercise is still owed
    expect(s.redoing).toBe(true); expect(s.item.redo).toBe(true);
    s = run(s, [true]);
    expect(s.finished).toBe(true);
    const res = resultOf(s);
    expect(res.perfect).toBe(false); expect(res.xp).toBe(XP.lesson + XP.fix); expect(res.accuracy).toBe(Math.round((100 * (LESSON_LEN - 1)) / LESSON_LEN));
  });
  it('a combo of 5 first-try answers is marked once', () => {
    let s = startLesson({ kind: 'node', topic: 'coord', level: 1 }); const marks = [];
    for (let i = 0; i < 6; i++) { const r = answer(s, right(s)); if (r.result.comboMark) marks.push(r.result.comboMark); s = next(r.s); }
    expect(marks).toEqual([5]);
  });
  it('the second lesson of a node mixes in earlier levels; a review spreads over all levels reached', () => {
    const two = planLevels({ kind: 'node', topic: 'line', level: 5, part: 2 });
    expect(two.filter((l) => l < 5).length).toBe(2);
    const rev = planLevels({ kind: 'review', topic: 'line', level: 8, max: 8 });
    expect(rev).toHaveLength(REVIEW_LEN); expect(new Set(rev).size).toBe(8);
  });
  it('a jump test fails on the second mistake', () => {
    let s = startLesson({ kind: 'jump', topic: 'pyth', level: 3 });
    s = run(s, [false, true, false]);
    expect(s.finished).toBe(true); expect(resultOf(s).passed).toBe(false); expect(resultOf(s).xp).toBe(0);
  });
});

describe('path', () => {
  it('opens nodes in order and closes the unit with a review', () => {
    let path = {};
    let nodes = unitNodes('stats', path, {});
    expect(nodes.map((n) => n.state)).toEqual(['current', 'locked', 'locked', 'locked', 'locked', 'locked']);
    for (let i = 0; i < PARTS; i++) path = recordOnPath(path, { kind: 'node', topic: 'stats', level: 1, passed: true }).path;
    nodes = unitNodes('stats', path, {});
    expect(nodes[0].state).toBe('done'); expect(nodes[1].state).toBe('current');
    const jump = recordOnPath(path, { kind: 'jump', topic: 'stats', level: 5, passed: true });
    expect(doneUpTo('stats', jump.path, {})).toBe(4);
  });
  it('keeps levels climbed before the path existed', () => {
    expect(doneUpTo('signed', {}, { signed: { level: 3, max: 3 } })).toBe(2);
    expect(nextNode(topicsFor('7'), {}, { signed: { level: 3, max: 3 } })).toMatchObject({ topic: 'signed', level: 3 });
  });
});

describe('quests', () => {
  it('three quests a day, the first about lessons, the same for everyone on that date', () => {
    const q = questsFor('2026-11-06');
    expect(q).toHaveLength(3); expect(q[0]).toBe('lessons'); expect(new Set(q).size).toBe(3);
    expect(questsFor('2026-11-06')).toEqual(q);
    expect(questProgress('2026-11-06', { lessons: 2 })[0].done).toBe(true);
  });
});

describe('store: lessons, streak and freezes', () => {
  beforeEach(() => { useApp.getState().resetProgress(); useApp.setState({ goalXp: 20 }); });
  it('a finished lesson adds XP, counts for the streak, and a second lesson completes the node', () => {
    const r = { kind: 'node', topic: 'signed', level: 1, part: 1, xp: 15, perfect: true, passed: true, bestCombo: 8 };
    const a = useApp.getState().completeLesson(r);
    expect(a).toMatchObject({ streakExtended: true, streak: 1, nodeDone: false });
    const b = useApp.getState().completeLesson({ ...r, part: 2 });
    expect(b).toMatchObject({ streakExtended: false, nodeDone: true, goalReached: true });
    const st = useApp.getState();
    expect(st.xp).toBe(30); expect(st.progress.signed).toEqual({ level: 2, max: 2 });
    expect(st.days[today()]).toMatchObject({ lessons: 2, xp: 30, perfect: 2, combo: 8 });
  });
  it('a freeze saves the streak over one missed day', () => {
    // On a fixed Thursday, so the missed day (Wednesday) is never a Shabbat, which would not count as missed.
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-05T12:00:00'));
    const y2 = dayBefore(dayBefore(today())); const y3 = dayBefore(y2);
    useApp.setState({ days: { [y3]: { lessons: 1 }, [y2]: { lessons: 1 } }, freezes: 1 });
    expect(streakOf(useApp.getState().days)).toBe(0); // yesterday was missed
    expect(useApp.getState().settleStreak()).toBe(1);
    expect(streakOf(useApp.getState().days)).toBe(2);
    expect(useApp.getState().freezes).toBe(0);
    vi.useRealTimers();
  });
});

describe('streak rules', () => {
  it('Shabbat is passed over, a fixed mistake earns XP', () => {
    // Find the most recent Saturday before today and build Thu-Fri-(Sat off)-Sun... up to yesterday.
    const keys = []; let k = dayBefore(today());
    for (let i = 0; i < 10; i++) { keys.push(k); k = dayBefore(k); }
    const days = Object.fromEntries(keys.filter((key) => new Date(`${key}T12:00:00`).getDay() !== 6).map((key) => [key, { lessons: 1 }]));
    expect(streakOf(days)).toBe(Object.keys(days).length);
    let s = startLesson({ kind: 'node', topic: 'signed', level: 1 });
    s = run(s, [false, false, ...Array(LESSON_LEN - 1).fill(true), true]);
    expect(s.finished).toBe(true);
    expect(resultOf(s)).toMatchObject({ fixed: 1, xp: XP.lesson + XP.fix });
  });
});
