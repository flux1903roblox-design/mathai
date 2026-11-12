// The copy on the device (DURABLE-1, idb.js) on a real IndexedDB: fake-indexeddb, a full implementation of the
// standard in memory, a new one for each test (testing.js realIdb). The three stores, each call of the backend, the
// mirror, the quarantine's limits, the error ring, a failed open, another page that deletes or upgrades the database,
// and destroy().
import { describe, it, expect, afterEach, vi } from 'vitest';
import { KEEP_ERRORS, KEEP_QUARANTINE, DB_VERSION } from './idb.js';
import { realIdb, idbNames, settle } from './testing.js';

const made = [];
const real = (o) => { const r = realIdb(o); made.push(r); return r; };
afterEach(() => { made.splice(0).forEach((r) => r.restore()); vi.useRealTimers(); });

/** The database as another page sees it: its version and its object stores. */
function look(factory, name) {
  return new Promise((resolve, reject) => {
    const req = factory.open(name);
    req.onsuccess = () => { const db = req.result; const v = { version: db.version, stores: [...db.objectStoreNames].sort() }; db.close(); resolve(v); };
    req.onerror = () => reject(req.error);
  });
}
const NOW = '2026-11-05T10:00:00.000Z';
const daysAgo = (n) => new Date(Date.parse(NOW) - n * 864e5).toISOString();

describe('the database', () => {
  it('is made on first use, at version 1, with mirror, quarantine and errors', async () => {
    const r = real();
    expect(await idbNames(r.factory)).toEqual([]);
    expect(await r.idb.readMirror()).toBeNull();
    expect(await idbNames(r.factory)).toEqual([r.name]);
    expect(await look(r.factory, r.name)).toEqual({ version: DB_VERSION, stores: ['errors', 'mirror', 'quarantine'] });
  });

  it('get, put, add, delete and entries do what they say, and a second connection sees the same data', async () => {
    const { backend, another } = real();
    expect(await backend.put('mirror', { raw: '{}', rev: 1, at: NOW }, 'current')).toBe('current');
    expect(await backend.get('mirror', 'current')).toEqual({ raw: '{}', rev: 1, at: NOW });
    const k1 = await backend.add('errors', { n: 1 }); const k2 = await backend.add('errors', { n: 2 });
    expect(k2).toBeGreaterThan(k1);
    expect(await backend.entries('errors')).toEqual([{ key: k1, value: { n: 1 } }, { key: k2, value: { n: 2 } }]);
    await backend.delete('errors', k1);
    expect(await another().entries('errors')).toEqual([{ key: k2, value: { n: 2 } }]);
    expect(await another().get('mirror', 'missing')).toBeUndefined();
  });

  it('readMirror: the copy when it is one, null for a record that is not (and writeMirror stores { raw, rev, at })', async () => {
    const { idb, backend } = real();
    await idb.writeMirror('{"state":{}}', 4, NOW);
    expect(await idb.readMirror()).toEqual({ raw: '{"state":{}}', rev: 4, at: NOW });
    for (const bad of [{ raw: 5 }, 'just text', { rev: 3 }, null]) {
      await backend.put('mirror', bad, 'current');
      expect(await idb.readMirror(), JSON.stringify(bad)).toBeNull();
    }
    await idb.deleteMirror();
    expect(await backend.get('mirror', 'current')).toBeUndefined();
  });
});

describe('the quarantine and the error ring', () => {
  it('quarantine keeps the record as it was, with its reason, version and time', async () => {
    const { idb } = real();
    expect(await idb.quarantine('{"state":', 'parse', undefined, NOW)).toBe(true);
    expect(await idb.listQuarantine()).toEqual([{ key: 1, value: { raw: '{"state":', reason: 'parse', version: null, at: NOW } }]);
    await idb.dropQuarantine(1);
    expect(await idb.listQuarantine()).toEqual([]);
  });

  it(`keeps the newest ${KEEP_QUARANTINE} records, and none older than 30 days`, async () => {
    const { idb, backend } = real();
    for (const [i, age] of [40, 31, 20, 10, 6, 5, 4, 3].entries()) await backend.add('quarantine', { raw: `r${i}`, reason: 'parse', at: daysAgo(age) });
    await idb.pruneQuarantine(NOW);
    expect((await idb.listQuarantine()).map((r) => r.value.raw)).toEqual(['r3', 'r4', 'r5', 'r6', 'r7']);
    // a 30-day cut alone: two young records and one old one
    const b = real();
    for (const [i, age] of [45, 2, 1].entries()) await b.backend.add('quarantine', { raw: `s${i}`, reason: 'parse', at: daysAgo(age) });
    await b.idb.pruneQuarantine(NOW);
    expect((await b.idb.listQuarantine()).map((r) => r.value.raw)).toEqual(['s1', 's2']);
    // and every new record prunes as it is kept
    for (let i = 0; i < 7; i += 1) await b.idb.quarantine(`t${i}`, 'parse', null, NOW);
    expect((await b.idb.listQuarantine()).map((r) => r.value.raw)).toEqual(['t2', 't3', 't4', 't5', 't6']);
  });

  it(`the error ring keeps the newest ${KEEP_ERRORS}, oldest first`, async () => {
    const { idb } = real();
    for (let i = 0; i < 23; i += 1) expect(await idb.addError({ n: i })).toBe(true);
    expect((await idb.listErrors()).map((e) => e.n)).toEqual(Array.from({ length: KEEP_ERRORS }, (_, i) => i + 3));
  });

  it('a write that fails: quarantine and addError answer false, writeMirror rejects, and nothing throws', async () => {
    const r = real();
    r.failPut();
    expect(await r.idb.quarantine('x', 'parse', null, NOW)).toBe(false);
    expect(await r.idb.addError({ n: 1 })).toBe(false);
    await expect(r.idb.writeMirror('{}', 1, NOW)).rejects.toThrow();
    r.restore();
    expect(await r.idb.listQuarantine()).toEqual([]);
    expect(await r.idb.listErrors()).toEqual([]);
  });
});

describe('when the database cannot be used', () => {
  it('a failed open is tried again on the next call', async () => {
    const r = real();
    r.failOpen();
    expect(await r.idb.readMirror()).toBeNull(); // reads answer null
    expect(await r.idb.listErrors()).toEqual([]);
    await expect(r.idb.writeMirror('{}', 1, NOW)).rejects.toThrow('IndexedDB is blocked'); // writes reject
    expect(await idbNames(r.factory)).toEqual([]);
    r.restore();
    await r.idb.writeMirror('{}', 2, NOW);
    expect(await r.idb.readMirror()).toMatchObject({ rev: 2 });
  });

  it('another page deletes the database ("delete all" in another tab): this one stops, and writes nothing back', async () => {
    const r = real();
    await r.idb.writeMirror('{"n":1}', 1, NOW);
    // the other tab's delete is not blocked: this connection closes when it is asked to
    await new Promise((resolve, reject) => {
      const req = r.factory.deleteDatabase(r.name);
      req.onsuccess = resolve; req.onerror = reject; req.onblocked = () => reject(new Error('blocked'));
    });
    expect(await idbNames(r.factory)).toEqual([]);
    await expect(r.idb.writeMirror('{"n":2}', 2, NOW)).rejects.toThrow('closed');
    await expect(r.backend.add('errors', { n: 1 })).rejects.toThrow('closed');
    expect(await r.idb.quarantine('x', 'parse', null, NOW)).toBe(false);
    expect(await r.idb.addError({ n: 1 })).toBe(false);
    expect(await r.idb.readMirror()).toBeNull();
    await settle(20);
    expect(await idbNames(r.factory)).toEqual([]); // not made again by a late write
  });

  it('another page upgrades the database: this one lets it, then stops; the newer page keeps what it found', async () => {
    const r = real();
    await r.idb.writeMirror('{"n":1}', 1, NOW);
    const newer = await new Promise((resolve, reject) => {
      const req = r.factory.open(r.name, DB_VERSION + 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('later'); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
    expect([...newer.objectStoreNames].sort()).toEqual(['errors', 'later', 'mirror', 'quarantine']);
    await expect(r.idb.writeMirror('{"n":2}', 2, NOW)).rejects.toThrow('closed');
    const v = await new Promise((resolve) => { const g = newer.transaction('mirror').objectStore('mirror').get('current'); g.onsuccess = () => resolve(g.result); });
    expect(v).toEqual({ raw: '{"n":1}', rev: 1, at: NOW });
    newer.close();
  });
});

describe('destroy()', () => {
  it('deletes the database at once, without waiting for its 3-second limit', async () => {
    const r = real();
    await r.idb.writeMirror('{}', 1, NOW);
    await r.idb.addError({ n: 1 });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); // fake-indexeddb runs on setImmediate
    await r.idb.destroy(); // the 3 s timer is never advanced: only the delete itself can end this
    expect(await idbNames(r.factory)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0); // and its timer is cleared
    await expect(r.idb.writeMirror('{}', 2, NOW)).rejects.toThrow('closed');
    expect(await idbNames(r.factory)).toEqual([]);
  });

  it('a database never opened is deleted too, and another page that keeps it open holds destroy() 3 seconds at most', async () => {
    const r = real();
    await r.another().put('mirror', { raw: '{}', rev: 1, at: NOW }, 'current'); // written by an earlier page
    await r.idb.destroy();
    expect(await idbNames(r.factory)).toEqual([]);
    // a page that does not close when asked (no versionchange handler)
    const s = real();
    await s.idb.writeMirror('{}', 1, NOW);
    const stubborn = await new Promise((resolve) => { const req = s.factory.open(s.name); req.onsuccess = () => resolve(req.result); });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let done = false;
    const p = s.idb.destroy().then(() => { done = true; });
    for (let i = 0; i < 20; i += 1) await new Promise((res) => { setImmediate(res); });
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(done).toBe(true);
    stubborn.close();
  });
});
