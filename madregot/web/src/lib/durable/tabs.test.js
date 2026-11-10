// Two tabs of the app on one device (DURABLE-2): two real stores (the app's own actions, store.js appState), each with
// its own write path, on one in-memory localStorage. A `storage` event is delivered by hand, or not at all (the race:
// a tab saves before the other tab's event has reached it).
import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createDurable } from './storage.js';
import { createDurableStatus } from './useDurable.js';
import { includes, joinSeen, pruneSeen, seenOf, tabAction, listenTabs, SEEN_WINDOW } from './tabs.js';
import { memoryLocalStorage } from './testing.js';
import { appState, persistOptions, today } from '../store.js';
import { emptyLearn } from '@/learn/storeGlue.ts';
import { CURRENT_VERSION } from './migrations.js';

const KEY = 'madregot';
const REV = `${KEY}:rev`;
const tick = () => new Promise((r) => { setTimeout(r, 0); });
const saved = (ls) => JSON.parse(ls.getItem(KEY));
const lesson = { topic: 'signed', level: 1, xp: 10, kind: 'node' }; // a practice lesson on a stair

/** The save both tabs start from: a student at revision 5, written by an earlier page at the current version. */
function seed(ls) {
  const state = {
    profile: { role: 'student', name: 'נועה', grade: '7' }, progress: {}, days: {}, xp: 40, xpBy: { a1b2c3d4: 40 }, resetAt: null,
    path: {}, freezes: 0, goalXp: 20, sound: true, mistakes: {}, lastTopic: null, outbox: [], ai: { mode: 'server' },
    durable: { tag: 'a1b2c3d4' }, backup: { on: false }, helpSent: 0, solveMode: 'answer', exams: [], practiceExams: [],
    planBase: {}, wins: {}, gaps: {}, placement: null, learn: emptyLearn(),
  };
  ls.setItem(KEY, JSON.stringify({ state, version: CURRENT_VERSION, meta: { rev: 5, at: '2026-11-05T08:00:00.000Z', tab: 'seed0000', parent: { rev: 4, tab: 'seed0000' }, keyAt: {}, seen: { seed0000: 5 }, app: 'test' } }));
  ls.setItem(REV, '5 seed0000');
}

/** One tab: its write path and its store. `win`: where its `storage` events arrive. */
function openTab(ls, tab, opts = {}) {
  const win = new EventTarget();
  const d = createDurable({ key: KEY, ls, idb: null, status: createDurableStatus(), tab, release: 'test', ...opts });
  const store = create(persist(appState, persistOptions(d.storage)));
  d.bind(store);
  d.boot({ win, doc: null });
  return { d, store, win, s: () => store.getState(), deliver: () => win.dispatchEvent(Object.assign(new Event('storage'), { key: KEY, newValue: ls.getItem(KEY) })) };
}

describe('two tabs on one device', () => {
  it('(a) A turns the sound off; its event reaches B; B earns XP → the save has the sound off and the XP', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const A = openTab(ls, 'tabaaaaa'); const B = openTab(ls, 'tabbbbbb');
    A.s().setSound(false); await tick();
    const writes = ls.writes.length;
    B.deliver();
    expect(ls.writes.length).toBe(writes); // a fast-forward loads A's save and writes nothing back
    expect(B.s().sound).toBe(false);
    B.s().addXP(7); await tick();
    expect(saved(ls).state).toMatchObject({ sound: false, xp: 47, xpBy: { a1b2c3d4: 47 } });
    expect(saved(ls).meta).toMatchObject({ rev: 7, tab: 'tabbbbbb', parent: { rev: 6, tab: 'tabaaaaa' } });
    expect(saved(ls).state.learn.events.filter((e) => e.e === 'merge')).toEqual([]); // nothing had to be merged
  });

  it('(b) the race: A turns the sound off and saves; stale B finishes a lesson and saves → the sound stays off, and B\'s lesson and XP are saved', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const A = openTab(ls, 'tabaaaaa'); const B = openTab(ls, 'tabbbbbb');
    A.s().setSound(false); await tick();
    B.s().completeLesson(lesson); await tick(); // A's event has not reached B
    const st = saved(ls).state;
    expect(st).toMatchObject({ sound: false, xp: 50, xpBy: { a1b2c3d4: 50 } });
    expect(st.days[today()].lessons).toBe(1);
    expect(saved(ls).meta).toMatchObject({ rev: 7, tab: 'tabbbbbb', parent: { rev: 6, tab: 'tabaaaaa' }, seen: { seed0000: 5, tabaaaaa: 6, tabbbbbb: 7 } });
    expect(B.s().sound).toBe(false); // the merge is on B's screen too
    expect(st.learn.events.at(-1)).toMatchObject({ e: 'merge', m: 'tab' });
    // A's event about B's save arrives: B's save holds everything A has, so A loads it
    const writes = ls.writes.length;
    A.deliver();
    expect(ls.writes.length).toBe(writes);
    expect(A.s()).toMatchObject({ sound: false, xp: 50 });
  });

  it('(c) the race: A and B each finish a lesson → two lessons today, and the XP of both', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const A = openTab(ls, 'tabaaaaa'); const B = openTab(ls, 'tabbbbbb');
    A.s().completeLesson(lesson); await tick();
    B.s().completeLesson({ ...lesson, xp: 12 }); await tick();
    const st = saved(ls).state;
    expect(st.days[today()]).toMatchObject({ lessons: 2, xp: 22 });
    expect(st).toMatchObject({ xp: 62, xpBy: { a1b2c3d4: 62 } });
    expect(st.path.signed.parts[1]).toBe(2);
  });

  it('(d) A joins a class; stale B changes the solve mode → the save keeps A\'s class and B\'s solve mode', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const A = openTab(ls, 'tabaaaaa'); const B = openTab(ls, 'tabbbbbb');
    const joined = { role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'tok-example', studentId: 'st1' };
    A.s().setProfile(joined); await tick();
    B.s().setSolveMode('notebook'); await tick();
    expect(saved(ls).state).toMatchObject({ profile: joined, solveMode: 'notebook' });
    expect(B.s().profile).toEqual(joined);
  });

  it('(e) diverged: both save revision 6 from 5 and B\'s lands last; B\'s event reaches A → A merges and saves revision 7 with both', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const A = openTab(ls, 'tabaaaaa'); const B = openTab(ls, 'tabbbbbb');
    const before = { key: ls.getItem(KEY), rev: ls.getItem(REV) };
    A.s().completeLesson(lesson); await tick();
    expect(saved(ls).meta).toMatchObject({ rev: 6, tab: 'tabaaaaa' });
    // the race: B's page had not seen A's save when it saved
    ls.setItem(KEY, before.key); ls.setItem(REV, before.rev);
    B.s().setSound(false); await tick();
    expect(saved(ls).meta).toMatchObject({ rev: 6, tab: 'tabbbbbb', parent: { rev: 5, tab: 'seed0000' } });
    expect(saved(ls).state.xp).toBe(40); // A's lesson is not in the save now
    A.deliver();
    const st = saved(ls);
    expect(st.meta).toMatchObject({ rev: 7, tab: 'tabaaaaa', parent: { rev: 6, tab: 'tabbbbbb' } });
    expect(st.state).toMatchObject({ sound: false, xp: 50 });
    expect(st.state.days[today()].lessons).toBe(1);
    expect(A.s()).toMatchObject({ sound: false, xp: 50 });
    // and B's event about A's merge: B loads it, writes nothing
    const writes = ls.writes.length;
    B.deliver();
    expect(ls.writes.length).toBe(writes);
    expect(B.s()).toMatchObject({ sound: false, xp: 50 });
    expect(B.s().days[today()].lessons).toBe(1);
  });

  it('a late event: B merged A\'s save and saved twice more before A heard of it → A loads it, nothing counted twice', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const A = openTab(ls, 'tabaaaaa'); const B = openTab(ls, 'tabbbbbb');
    A.s().completeLesson(lesson); await tick(); // 6 by A
    B.s().completeLesson(lesson); await tick(); // 7 by B, merged with A's 6
    B.s().addXP(3); await tick(); // 8 by B
    A.deliver();
    expect(A.s()).toMatchObject({ xp: 63 });
    expect(A.s().days[today()].lessons).toBe(2);
    A.s().addXP(1); await tick();
    expect(saved(ls).state).toMatchObject({ xp: 64 });
    expect(saved(ls).state.days[today()].lessons).toBe(2);
  });

  it('three tabs saving in turn, each without the others\' events, lose nothing', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const tabs = ['tabaaaaa', 'tabbbbbb', 'tabcccccc'.slice(0, 8)].map((t) => openTab(ls, t));
    for (let round = 0; round < 3; round += 1) for (const T of tabs) { T.s().completeLesson(lesson); await tick(); }
    const st = saved(ls).state;
    expect(st.xp).toBe(40 + 9 * 10);
    expect(st.days[today()].lessons).toBe(9);
  });

  it('"delete all" in another tab: this tab stops saving, and starts again', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const onRemoved = vi.fn();
    const B = openTab(ls, 'tabbbbbb', { onRemoved });
    ls.removeItem(KEY); ls.removeItem(REV); // tab A's "delete all"
    B.win.dispatchEvent(Object.assign(new Event('storage'), { key: KEY, newValue: null }));
    expect(onRemoved).toHaveBeenCalledOnce();
    B.s().completeLesson(lesson); await tick();
    expect(ls.getItem(KEY)).toBeNull(); // the progress is not written back
  });

  it('events for other keys, and a save of its own, are ignored', async () => {
    const ls = memoryLocalStorage(); seed(ls);
    const A = openTab(ls, 'tabaaaaa');
    const spy = vi.spyOn(A.store.persist, 'rehydrate');
    A.win.dispatchEvent(Object.assign(new Event('storage'), { key: 'other', newValue: '{}' }));
    A.s().setSound(false); await tick();
    A.deliver();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('which saves a save includes (tabs.js)', () => {
  it('seen: a save includes its own tab\'s earlier saves and the ones listed; a tab dropped long ago is included', () => {
    const seen = { a: 10, b: 4 };
    expect(includes(seen, 'a', 10)).toBe(true);
    expect(includes(seen, 'a', 11)).toBe(false);
    expect(includes(seen, 'c', 9)).toBe(false); // a tab not listed and recent: not included
    expect(includes({ a: 1000 }, 'c', 1000 - SEEN_WINDOW)).toBe(true); // far behind: dropped, so included
    expect(includes(seen, null, 0)).toBe(true); // the start, before any save
    expect(seenOf({ rev: 3, tab: 'x' })).toEqual({ x: 3 }); // a save from before `seen`
    expect(joinSeen({ a: 2, b: 5 }, { a: 4 })).toEqual({ a: 4, b: 5 });
    expect(pruneSeen({ a: 1000, b: 1000 - SEEN_WINDOW, c: 999 })).toEqual({ a: 1000, c: 999 });
  });

  it('what to do with another tab\'s save', () => {
    const me = { tab: 'a', seen: { s: 5, a: 6 }, writer: { tab: 'a', rev: 6 } };
    expect(tabAction({ tab: 'a', rev: 6 }, me)).toBe('ignore'); // its own
    expect(tabAction({ tab: 's', rev: 5 }, me)).toBe('ignore'); // older than what it has
    expect(tabAction({ tab: 'b', rev: 7, seen: { s: 5, a: 6, b: 7 } }, me)).toBe('forward');
    expect(tabAction({ tab: 'b', rev: 6, seen: { s: 5, b: 6 } }, me)).toBe('merge');
  });

  it('listenTabs passes only this key\'s saves on, and stops when asked', () => {
    const win = new EventTarget(); const onSave = vi.fn();
    const stop = listenTabs({ key: KEY, onSave, win });
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'x', newValue: '1' }));
    win.dispatchEvent(Object.assign(new Event('storage'), { key: KEY, newValue: 'v' }));
    stop();
    win.dispatchEvent(Object.assign(new Event('storage'), { key: KEY, newValue: 'w' }));
    expect(onSave.mock.calls).toEqual([['v']]);
  });
});
