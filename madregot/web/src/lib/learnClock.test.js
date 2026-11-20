// The learning clock (PARENTS-1), with fake timers: it counts only on learning screens, only while the page is visible
// and the student did something in the last 90 s, writes at most once a minute (and at once on a route change or when
// the page is hidden), and the store caps a day at 4 hours without making the day active.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createLearnClock, LEARN_ROUTE, TICK_MS, IDLE_MS, FLUSH_MS } from './learnClock.js';
import { appState, LEARN_SECS_MAX } from './store.js';
import { isActiveDay, streakOf } from './days.js';

const DAY = '2026-11-05';
let visible; let writes; let clock; let day;
const total = () => writes.reduce((a, w) => a + w.secs, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T10:00:00'));
  visible = true; writes = []; day = DAY;
  clock = createLearnClock({ add: (d, secs) => writes.push({ d, secs }), visible: () => visible, today: () => day });
});
afterEach(() => { clock.stop(); vi.useRealTimers(); });

/** Move the clock, with a tap every `every` ms (null: no input at all). */
function pass(ms, every = 30_000) {
  for (let t = 0; t < ms; t += 1000) {
    if (every && t % every === 0) clock.input();
    vi.advanceTimersByTime(1000);
  }
}

describe('the learning clock', () => {
  it('the routes it counts on', () => {
    for (const p of ['/lesson/signed/1', '/practice/abc', '/placement', '/repair/signed/1/sign', '/rescue/check', '/rescue/exam', '/learn/signed/1/A', '/learn/eq/3/C']) expect(LEARN_ROUTE.test(p), p).toBe(true);
    for (const p of ['/', '/me', '/settings', '/learn/signed/1', '/rescue', '/quests', '/exams', '/topic/signed', '/mission']) expect(LEARN_ROUTE.test(p), p).toBe(false);
  });

  it('counts on a lesson, not on the map; a route change writes what was counted', () => {
    clock.route('/');
    clock.start();
    pass(30_000);
    clock.route('/lesson/signed/1');
    expect(writes).toEqual([]); // nothing counted on the map
    pass(40_000);
    clock.route('/');
    expect(writes).toEqual([{ d: DAY, secs: 40 }]);
    pass(60_000);
    clock.route('/learn/signed/1/A');
    expect(total()).toBe(40);
  });

  it('stops after 90 s with no input, and starts again with the next tap', () => {
    clock.route('/lesson/signed/1');
    clock.start();
    clock.input();
    pass(5 * 60_000, null); // five minutes with no tap at all
    clock.hidden();
    expect(total()).toBe(IDLE_MS / 1000);
    writes = [];
    clock.input();
    pass(20_000, 10_000);
    clock.hidden();
    expect(total()).toBe(20);
  });

  it('counts nothing while the page is hidden', () => {
    clock.route('/lesson/signed/1');
    clock.start();
    pass(20_000);
    visible = false;
    clock.hidden();
    expect(total()).toBe(20);
    pass(120_000);
    clock.hidden();
    expect(total()).toBe(20);
    visible = true;
    pass(10_000);
    clock.hidden();
    expect(total()).toBe(30);
  });

  it('writes at most once a minute while it counts (ticks every 5 s in memory)', () => {
    clock.route('/lesson/signed/1');
    clock.start();
    pass(FLUSH_MS - TICK_MS);
    expect(writes).toEqual([]);
    expect(clock.pending).toBe(55);
    pass(TICK_MS);
    expect(writes).toEqual([{ d: DAY, secs: 60 }]);
    pass(5 * FLUSH_MS);
    expect(writes.length).toBe(6);
    expect(writes.every((w) => w.secs === 60)).toBe(true);
  });

  it('time before midnight belongs to that day', () => {
    clock.route('/lesson/signed/1');
    clock.start();
    pass(20_000);
    day = '2026-11-06';
    pass(10_000);
    clock.hidden();
    expect(writes).toEqual([{ d: DAY, secs: 20 }, { d: '2026-11-06', secs: 10 }]);
  });

  it('stop writes what is left', () => {
    clock.route('/learn/signed/1/B');
    clock.start();
    pass(15_000);
    clock.stop();
    expect(writes).toEqual([{ d: DAY, secs: 15 }]);
  });
});

describe('addLearnTime in the store', () => {
  const store = () => createStore(appState);

  it('adds to days[d].tsecs, at most 4 hours a day, and never makes the day active', () => {
    const s = store();
    s.getState().addLearnTime(DAY, 600);
    s.getState().addLearnTime(DAY, 60.9);
    expect(s.getState().days[DAY]).toEqual({ tsecs: 660 });
    expect(isActiveDay(s.getState().days[DAY])).toBe(false);
    expect(streakOf(s.getState().days, DAY)).toBe(0);
    s.getState().addLearnTime(DAY, 99_999);
    expect(s.getState().days[DAY].tsecs).toBe(LEARN_SECS_MAX);
    expect(LEARN_SECS_MAX).toBe(14_400);
  });

  it('keeps the day\'s other counters, and ignores nothing to add', () => {
    const s = store();
    s.setState({ days: { [DAY]: { q: 3, ok: 2, secs: 40, lessons: 1 } } });
    const before = s.getState().days;
    s.getState().addLearnTime(DAY, 0);
    s.getState().addLearnTime(DAY, -5);
    expect(s.getState().days).toBe(before);
    s.getState().addLearnTime(DAY, 30);
    expect(s.getState().days[DAY]).toEqual({ q: 3, ok: 2, secs: 40, lessons: 1, tsecs: 30 });
  });
});

describe('streakOf(days, from)', () => {
  const days = { '2026-11-02': { lessons: 1 }, '2026-11-03': { lessons: 1 }, '2026-11-05': { stages: 1 } };
  it('from today by default, as before', () => {
    expect(streakOf(days)).toBe(1); // today is the 5th: the 4th breaks it
  });
  it('from a past day', () => {
    expect(streakOf(days, '2026-11-03')).toBe(2);
    expect(streakOf(days, '2026-11-04')).toBe(2); // nothing on the 4th itself: the day before ends the chain
    expect(streakOf(days, '2026-11-01')).toBe(0);
  });
});
