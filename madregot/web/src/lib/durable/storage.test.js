// The safe write path (DURABLE-1), on an in-memory localStorage with a quota and an in-memory IndexedDB
// (durable/testing.js): one write per tick, a full storage handled without an exception, the copy on the device, the
// quarantine, boot recovery (in time and late), "delete all", and which copy the app starts from.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createDurable, pickStart, pageStorage, isQuotaError } from './storage.js';
import { createIdb } from './idb.js';
import { createDurableStatus } from './useDurable.js';
import { migrate } from './migrations.js';
import { memoryLocalStorage, memoryIdb, heavyYear, settle } from './testing.js';

const KEY = 'madregot-test';
const REV = `${KEY}:rev`;
const env = (state, rev, extra = {}) => JSON.stringify({ state, version: 5, ...(rev == null ? {} : { meta: { rev, at: '2026-11-05T09:00:00.000Z', tab: 'other000', parent: { rev: rev - 1, tab: 'other000' }, keyAt: {}, app: 'test' } }), ...extra });
const tick = () => Promise.resolve();

/** A store saved through a durable instance, as store.js does it. */
function setup({ ls = memoryLocalStorage(), backend = memoryIdb(), initial = {}, tab = 'tab00001', bootWait = 300 } = {}) {
  const status = createDurableStatus();
  const idb = backend ? createIdb(backend) : null;
  const d = createDurable({ key: KEY, version: 5, ls, idb, status, tab, release: 'test', bootWait });
  const useS = create(persist((set, get) => ({
    sound: true, n: 0, big: [], ...initial,
    setSound: (sound) => set({ sound }), bump: () => set({ n: get().n + 1 }), grow: (k) => set({ big: [...get().big, 'x'.repeat(k)] }),
  }), { name: KEY, storage: d.storage, version: 5, migrate: (s) => s }));
  d.bind(useS);
  return { d, useS, ls, backend, idb, status };
}
const saved = (ls) => JSON.parse(ls.getItem(KEY));

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('one write per tick, with its revision', () => {
  it('(1) three set() calls in one tick are one write of the key and one of its revision; rev goes 1, 2', async () => {
    const { useS, ls } = setup();
    const s = useS.getState();
    s.bump(); s.bump(); s.setSound(false);
    expect(ls.writes).toEqual([]); // nothing before the tick ends
    await tick();
    expect(ls.writes).toEqual([KEY, REV]);
    const first = saved(ls);
    expect(first.state).toMatchObject({ n: 2, sound: false });
    expect(first.meta).toMatchObject({ rev: 1, tab: 'tab00001', parent: { rev: 0, tab: null }, app: 'test' });
    expect(Object.keys(first.meta.keyAt).sort()).toEqual(['big', 'n', 'sound']); // the first save stamps every slice
    expect(ls.getItem(REV)).toBe('1 tab00001'); // the stamp: the revision and the tab that saved it
    s.bump();
    await tick();
    expect(ls.writes).toEqual([KEY, REV, KEY, REV]);
    const second = saved(ls);
    expect(second.meta).toMatchObject({ rev: 2, parent: { rev: 1, tab: 'tab00001' } });
    expect(second.meta.keyAt.n > first.meta.keyAt.n || second.meta.keyAt.n === first.meta.keyAt.n).toBe(true);
    expect(second.meta.keyAt.sound).toBe(first.meta.keyAt.sound); // only the slice that changed is stamped again
  });

  it('remembers what it read and what it wrote, the base for a merge between tabs', async () => {
    const ls = memoryLocalStorage();
    ls.setItem(KEY, env({ sound: false, n: 4 }, 3));
    const { d, useS } = setup({ ls });
    expect(d.snapshot()).toMatchObject({ loadedRev: 3, lastWriterTab: 'other000', lastLoaded: { sound: false, n: 4 } });
    useS.getState().bump(); await tick();
    expect(d.snapshot()).toMatchObject({ loadedRev: 4, lastWriterTab: 'tab00001', lastLoaded: { n: 4 }, lastWritten: expect.objectContaining({ n: 5 }) });
    expect(saved(ls).meta.parent).toEqual({ rev: 3, tab: 'other000' });
  });

  it('a write counts past a revision another tab wrote meanwhile, and merges with it instead of replacing it', async () => {
    const { useS, ls } = setup();
    useS.getState().bump(); await tick();
    ls.setItem(KEY, env({ sound: false, n: 40 }, 7)); ls.setItem(REV, '7'); // another tab (an older stamp, with no tab)
    useS.getState().bump(); await tick();
    expect(saved(ls).meta).toMatchObject({ rev: 8, parent: { rev: 7, tab: 'other000' }, seen: { other000: 7, tab00001: 8 } });
    // the other tab's sound change stays; `n` changed on both sides and is not a known counter: the later change wins
    expect(saved(ls).state).toMatchObject({ sound: false, n: 2 });
    expect(useS.getState()).toMatchObject({ sound: false, n: 2 }); // and the page has the merge too
  });
});

describe('a full storage', () => {
  it('(2) 300 KB: the heavy year is made smaller once and saved; learning is untouched', async () => {
    const heavy = migrate(heavyYear().state, 4);
    expect(JSON.stringify(heavy).length).toBeGreaterThan(300_000);
    const { useS, ls, status } = setup({ ls: memoryLocalStorage({ quotaBytes: 300_000 }), initial: heavy });
    expect(() => useS.getState().setSound(false)).not.toThrow();
    await settle();
    expect(status.getState().health).toBe('ok');
    const st = saved(ls).state;
    expect(st.sound).toBe(false);
    expect(st.learn.events).toHaveLength(1500);
    expect(st.learn.events.at(-1)).toEqual(heavy.learn.events.at(-1)); // the newest stay
    expect(st.learn.skills).toEqual(heavy.learn.skills);
    expect(st.days).toEqual(heavy.days);
    expect(st.xpBy).toEqual(heavy.xpBy);
    expect(useS.getState().learn.events).toHaveLength(3000); // the page keeps the whole log meanwhile
  });

  it('(3) 20 KB: the change is saved in the copy on the device, nothing throws, and the next start comes back from it', async () => {
    const ls = memoryLocalStorage({ quotaBytes: 20_000 });
    const backend = memoryIdb();
    const a = setup({ ls, backend });
    a.useS.getState().bump(); await settle();
    expect(a.status.getState().health).toBe('ok');
    expect(() => { a.useS.getState().grow(25_000); a.useS.getState().setSound(false); }).not.toThrow();
    await settle();
    expect(a.status.getState().health).toBe('mirror');
    expect(saved(ls).meta.rev).toBe(1); // localStorage still has the save before
    const copy = backend.stores.mirror.get('current');
    expect(copy.rev).toBe(2);
    expect(JSON.parse(copy.raw).state).toMatchObject({ sound: false, n: 1 });
    // a new page
    const b = setup({ ls, backend });
    expect(b.useS.getState().sound).toBe(true); // what localStorage had
    await b.d.boot({ win: null, doc: null });
    expect(b.useS.getState()).toMatchObject({ sound: false, n: 1 });
    expect(b.useS.getState().big[0]).toHaveLength(25_000);
    expect(b.status.getState()).toMatchObject({ restoredFrom: 'mirror', health: 'mirror', restoreNote: false }); // full: no toast every start
    // room again: the next save goes to localStorage, and health is ok
    ls.quotaBytes = Infinity;
    b.useS.getState().bump(); await settle();
    expect(b.status.getState().health).toBe('ok');
    expect(saved(ls).meta.rev).toBe(3);
  });

  it('(4) 20 KB and an IndexedDB that cannot write: health is full, and still nothing throws', async () => {
    const backend = memoryIdb({ failPut: true });
    const { useS, status } = setup({ ls: memoryLocalStorage({ quotaBytes: 20_000 }), backend });
    expect(() => useS.getState().grow(25_000)).not.toThrow();
    await settle();
    expect(status.getState().health).toBe('full');
    expect(useS.getState().big).toHaveLength(1); // the page goes on with the change in memory
  });

  it('the quota error in every browser\'s words', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ name: 'SecurityError' })).toBe(false);
  });
});

describe('data that cannot be used is kept in quarantine', () => {
  it('(5) a broken key: the start comes from the copy, and the broken bytes are kept as they were', async () => {
    const ls = memoryLocalStorage(); const backend = memoryIdb();
    const a = setup({ ls, backend });
    a.useS.getState().setSound(false); a.useS.getState().bump(); await tick();
    a.d.flushNow(); await settle();
    ls.setItem(KEY, '{"state":');
    const b = setup({ ls, backend });
    expect(b.useS.getState().sound).toBe(true); // nothing readable in localStorage
    await b.d.boot({ win: null, doc: null });
    expect(b.useS.getState()).toMatchObject({ sound: false, n: 1 });
    expect(b.status.getState()).toMatchObject({ restoredFrom: 'mirror', restoreNote: true, health: 'ok' });
    expect(saved(ls).state.sound).toBe(false); // written back
    const q = await b.idb.listQuarantine();
    expect(q.map((r) => r.value)).toEqual([expect.objectContaining({ raw: '{"state":', reason: 'parse', version: null })]);
  });

  it('(6) a save from a newer version is quarantined before the first write', async () => {
    const ls = memoryLocalStorage(); const backend = memoryIdb();
    const raw = env({ sound: false, n: 3, zzz: 1 }, 4).replace('"version":5', '"version":9');
    ls.setItem(KEY, raw); ls.writes.length = 0;
    const order = [];
    const add = backend.add; backend.add = (...a) => { order.push('quarantine'); return add(...a); };
    const set = ls.setItem; ls.setItem = (k, v) => { order.push(`write ${k}`); return set(k, v); };
    const { useS, idb } = setup({ ls, backend });
    expect(useS.getState()).toMatchObject({ sound: false, n: 3, zzz: 1 }); // the fields are kept
    await settle();
    expect(order[0]).toBe('quarantine');
    expect(order).toContain(`write ${KEY}`); // zustand saves the migrated state
    expect((await idb.listQuarantine()).map((r) => r.value)).toEqual([expect.objectContaining({ raw, reason: 'future-version', version: 9 })]);
  });

  it('the same broken bytes are kept once, and only the newest 5 records for 30 days', async () => {
    const backend = memoryIdb(); const idb = createIdb(backend);
    const days = (n) => new Date(Date.parse('2026-11-05T10:00:00.000Z') - n * 864e5).toISOString();
    for (const [i, age] of [40, 20, 10, 6, 5, 4, 3].entries()) await backend.add('quarantine', { raw: `r${i}`, reason: 'parse', at: days(age) });
    await idb.pruneQuarantine('2026-11-05T10:00:00.000Z');
    expect((await idb.listQuarantine()).map((r) => r.value.raw)).toEqual(['r2', 'r3', 'r4', 'r5', 'r6']);
    const ls = memoryLocalStorage(); ls.setItem(KEY, 'not json');
    const a = setup({ ls, backend: memoryIdb() });
    a.useS.persist.rehydrate(); a.useS.persist.rehydrate();
    await settle();
    expect(await a.idb.listQuarantine()).toHaveLength(1);
  });

  it('the error log keeps the last 20', async () => {
    const idb = createIdb(memoryIdb());
    for (let i = 0; i < 23; i += 1) await idb.addError({ n: i });
    expect((await idb.listErrors()).map((e) => e.n)).toEqual(Array.from({ length: 20 }, (_, i) => i + 3));
  });
});

describe('a browser that lets nothing be saved', () => {
  it('(7) blocked localStorage: health is memory, and the app works in memory', async () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ blocked: true }));
    expect(pageStorage()).toBeNull();
    const { useS, status } = setup({ ls: null });
    expect(status.getState().health).toBe('memory');
    useS.getState().setSound(false); useS.getState().bump();
    await settle();
    expect(useS.getState()).toMatchObject({ sound: false, n: 1 });
    expect(status.getState().health).toBe('memory');
  });
  it('a full localStorage is still used: it can be read', () => {
    const full = memoryLocalStorage({ quotaBytes: 0 });
    vi.stubGlobal('localStorage', full);
    expect(pageStorage()).toBe(full);
  });
});

describe('leaving the page', () => {
  it('(8) pagehide (or hidden) saves a pending write at once, and the copy without waiting a second', async () => {
    const { d, useS, ls, backend } = setup();
    const win = new EventTarget(); const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    await d.boot({ win, doc });
    useS.getState().setSound(false);
    win.dispatchEvent(new Event('pagehide'));
    expect(saved(ls).state.sound).toBe(false); // synchronously
    await settle();
    expect(JSON.parse(backend.stores.mirror.get('current').raw).state.sound).toBe(false);
    useS.getState().bump();
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    expect(saved(ls).state.n).toBe(1);
    await tick();
    expect(ls.writes.filter((k) => k === KEY)).toHaveLength(2); // the microtask did not save it twice
  });

  it('the copy follows a second after the last save', async () => {
    vi.useFakeTimers();
    const { useS, backend } = setup();
    useS.getState().setSound(false); await tick();
    await vi.advanceTimersByTimeAsync(900);
    expect(backend.stores.mirror.get('current')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(backend.stores.mirror.get('current').rev).toBe(1);
  });

  it('(9) removeItem clears the key, its revision and the copy, and a set() queued just before is not written', async () => {
    const { d, useS, ls, backend } = setup();
    useS.getState().setSound(false); await tick(); d.flushNow(); await settle();
    expect(backend.stores.mirror.get('current')).toBeTruthy();
    useS.getState().bump();
    useS.persist.clearStorage();
    await settle(1100);
    expect(ls.getItem(KEY)).toBeNull();
    expect(ls.getItem(REV)).toBeNull();
    expect(backend.stores.mirror.get('current')).toBeUndefined();
  });

  it('(10) "delete all" right after a set(): the key is gone, the database is deleted, and nothing is written again', async () => {
    const { d, useS, ls, backend } = setup();
    useS.getState().bump(); await tick(); d.flushNow(); await settle();
    useS.getState().setSound(false);
    await d.wipe();
    await settle(1100);
    expect(ls.getItem(KEY)).toBeNull();
    expect(ls.getItem(REV)).toBeNull();
    expect(backend.destroyed).toBe(true);
    useS.getState().bump(); d.flushNow(); await settle();
    expect(ls.getItem(KEY)).toBeNull();
    expect(backend.stores.mirror.size).toBe(0);
  });
});

describe('starting the app: the key or the copy', () => {
  it('which copy wins', () => {
    const mirror = { rev: 5 };
    expect(pickStart({ kind: 'ok', rev: 3, meta: { rev: 3 } }, null)).toBe('key');
    expect(pickStart({ kind: 'missing', rev: 0, meta: null }, mirror)).toBe('mirror');
    expect(pickStart({ kind: 'corrupt', rev: 0, meta: null }, mirror)).toBe('mirror');
    expect(pickStart({ kind: 'ok', rev: 0, meta: null }, { rev: 9 })).toBe('key'); // an older build or a test wrote it last
    expect(pickStart({ kind: 'ok', rev: 3, meta: { rev: 3 } }, mirror)).toBe('mirror');
    expect(pickStart({ kind: 'ok', rev: 5, meta: { rev: 5 } }, mirror)).toBe('key');
    expect(pickStart({ kind: 'ok', rev: 6, meta: { rev: 6 } }, mirror)).toBe('key');
  });

  it('a key without meta wins over a newer-looking copy, and the copy is rewritten from it', async () => {
    const ls = memoryLocalStorage(); const backend = memoryIdb();
    backend.stores.mirror.set('current', { raw: env({ sound: false, n: 9 }, 7), rev: 7 });
    const seed = env({ sound: true, n: 2 }, null);
    ls.setItem(KEY, seed);
    const { d, useS, status } = setup({ ls, backend });
    await d.boot({ win: null, doc: null });
    await settle();
    expect(useS.getState()).toMatchObject({ sound: true, n: 2 });
    expect(status.getState().restoredFrom).toBeNull();
    expect(backend.stores.mirror.get('current')).toMatchObject({ raw: seed, rev: 0 });
  });

  it('a copy older than the key is brought up to it', async () => {
    const ls = memoryLocalStorage(); const backend = memoryIdb();
    backend.stores.mirror.set('current', { raw: env({ n: 1 }, 2), rev: 2 });
    ls.setItem(KEY, env({ n: 4 }, 6));
    const { d } = setup({ ls, backend });
    await d.boot({ win: null, doc: null }); await settle();
    expect(backend.stores.mirror.get('current').rev).toBe(6);
  });

  it('(11) a copy that answers after 400 ms and is newer replaces the state in place', async () => {
    const ls = memoryLocalStorage(); const backend = memoryIdb();
    ls.setItem(KEY, env({ sound: true, n: 1 }, 3)); ls.setItem(REV, '3');
    backend.stores.mirror.set('current', { raw: env({ sound: false, n: 5 }, 5), rev: 5 });
    backend.delay = 400;
    const { d, useS, status } = setup({ ls, backend });
    const t0 = Date.now();
    await d.boot({ win: null, doc: null });
    expect(Date.now() - t0).toBeLessThan(390); // the first screen did not wait for it
    expect(useS.getState()).toMatchObject({ sound: true, n: 1 });
    expect(status.getState().restoredFrom).toBeNull();
    await settle(250);
    expect(useS.getState()).toMatchObject({ sound: false, n: 5 });
    expect(typeof useS.getState().bump).toBe('function'); // the store keeps its actions
    expect(status.getState()).toMatchObject({ restoredFrom: 'mirror', restoreNote: true, health: 'ok' });
    expect(saved(ls).state.n).toBe(5);
    useS.getState().bump(); await tick();
    expect(saved(ls).meta.rev).toBe(6);
  });

  it('a key that was missing at the start loses to a late copy, even after a first change on the empty state', async () => {
    const ls = memoryLocalStorage(); const backend = memoryIdb({ delay: 400 });
    backend.stores.mirror.set('current', { raw: env({ sound: false, n: 5 }, 5), rev: 5 });
    const { d, useS, status } = setup({ ls, backend });
    await d.boot({ win: null, doc: null });
    useS.getState().bump(); await tick();
    expect(saved(ls).state.n).toBe(1);
    await settle(250);
    expect(useS.getState().n).toBe(5);
    expect(saved(ls).state.n).toBe(5);
    expect(status.getState().restoreNote).toBe(true);
  });

  it('a save waiting for the late copy does not write over it once the copy is restored', async () => {
    const ls = memoryLocalStorage(); const backend = memoryIdb({ delay: 400 });
    backend.stores.mirror.set('current', { raw: env({ sound: false, n: 5 }, 5), rev: 5 });
    ls.setItem(KEY, '{"state":');
    const { d, useS, status } = setup({ ls, backend });
    await d.boot({ win: null, doc: null });
    ls.quotaBytes = 0; // full: this save can only go to the copy, which waits for boot's read
    useS.getState().bump(); await tick();
    await settle(1000);
    expect(useS.getState().n).toBe(5);
    expect(JSON.parse(backend.stores.mirror.get('current').raw).state.n).toBe(5);
    expect(status.getState()).toMatchObject({ restoredFrom: 'mirror', health: 'mirror' });
  });

  it('no copy at all: the key is used, and nothing is said', async () => {
    const ls = memoryLocalStorage();
    ls.setItem(KEY, env({ n: 2 }, 1));
    const { d, useS, status, backend } = setup({ ls });
    await d.boot({ win: null, doc: null }); await settle();
    expect(useS.getState().n).toBe(2);
    expect(status.getState().restoredFrom).toBeNull();
    expect(backend.stores.mirror.get('current').rev).toBe(1); // and the first copy is made
  });
});
