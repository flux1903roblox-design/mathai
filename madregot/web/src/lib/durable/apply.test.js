// Bringing a copy back (DURABLE-4, apply.js): the three cases (an empty device, the same student, another student) and
// undo, on the store's own state and the real quarantine (createDurable over an in-memory IndexedDB).
import { describe, it, expect, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { applyRestored, undoRestore, restoreCase, canUndo, hasProgress, normName, UNDO_DAYS, NO_COPY } from './apply.js';
import { createDurable } from './storage.js';
import { createIdb } from './idb.js';
import { createDurableStatus } from './useDurable.js';
import { snapshotForBackup } from './payload.js';
import { dataOf } from './merge.js';
import { BACKUP_DEFAULTS } from './migrations.js';
import { memoryIdb, memoryLocalStorage } from './testing.js';
import { appState } from '../store.js';
import { emptyLearn } from '@/learn/storeGlue.ts';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const now = () => NOW;

/** This device: a store with `state`, and the quarantine of a write path over an in-memory IndexedDB. */
function device(state = {}, { failPut = false } = {}) {
  const store = createStore(appState);
  store.setState(state);
  const backend = memoryIdb({ failPut });
  const d = createDurable({ key: 'madregot-apply', ls: memoryLocalStorage(), idb: createIdb(backend), status: createDurableStatus(), tab: 'tab00001', release: 'test' });
  return { store, quarantine: d.quarantine, backend, st: () => dataOf(store.getState()) };
}
/** A student's progress, as a backup file holds it. */
const progress = (name, tag, xp, extra = {}) => ({
  profile: { role: 'student', name, grade: '7' }, xp, xpBy: { [tag]: xp }, resetAt: null,
  days: { '2026-11-04': { lessons: 2, xp, q: 10, ok: 8 } },
  path: { signed: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered' } } },
  progress: { signed: { level: 2, max: 2 } }, learn: { ...emptyLearn(), events: [{ t: '2026-11-04T09:00:00.000Z', e: 'answer', s: 'signed:1', ok: true }] },
  sound: true, goalXp: 20, solveMode: 'answer', ...extra,
});
const restoreEvents = (st) => st.learn.events.filter((e) => e.e === 'restore' || e.e === 'merge').map(({ e, m }) => ({ e, m }));

describe('which case', () => {
  it('empty: no profile, or a student with no XP and no days; a teacher with classes has progress', () => {
    expect(hasProgress({ profile: null })).toBe(false);
    expect(hasProgress({ profile: { role: 'student', name: 'נועה' }, xp: 0, days: {} })).toBe(false);
    expect(hasProgress({ profile: { role: 'student', name: 'נועה' }, xp: 0, days: { '2026-11-05': { q: 1 } } })).toBe(true);
    expect(hasProgress({ profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD' }] } })).toBe(true);
  });

  it('same: the same name as people write it, or a device tag both copies count XP for; other: anything else', () => {
    const here = progress('נועה', 'a1b2c3d4', 50);
    expect(restoreCase(here, progress(' נוֹעָה ', 'b2c3d4e5', 10))).toBe('same');
    expect(restoreCase(here, progress('Noa', 'a1b2c3d4', 10))).toBe('same');
    expect(restoreCase(here, progress('יואב', 'b2c3d4e5', 10))).toBe('other');
    expect(restoreCase({ profile: null }, progress('יואב', 'b2c3d4e5', 10))).toBe('empty');
    expect(normName('  Noa‏  Cohen ')).toBe('noa cohen');
  });
});

describe('applyRestored', () => {
  it('an empty device takes the copy whole; its own tutor, tag and backup settings stay; the restore is logged first', async () => {
    const D = device({ ai: { mode: 'server', device: 'dev-here' }, durable: { tag: 'c3d4e5f6' }, backup: { on: false } });
    const copy = progress('נועה', 'a1b2c3d4', 120, { sound: false });
    const r = await applyRestored(copy, 'file', { store: D.store, quarantine: D.quarantine, now });
    expect(r).toEqual({ kind: 'empty', applied: true, undo: false });
    const st = D.st();
    expect(st).toMatchObject({ profile: copy.profile, xp: 120, xpBy: copy.xpBy, days: copy.days, path: copy.path, sound: false });
    expect(st.ai.device).toBe('dev-here');
    expect(st.durable.tag).toBe('c3d4e5f6');
    expect(restoreEvents(st)).toEqual([{ e: 'restore', m: 'file' }]);
    expect(canUndo(st, NOW)).toBe(false);
  });

  it('the same student: merged, nothing lowered, this device\'s settings kept, and no undo offered', async () => {
    const here = progress('נועה', 'a1b2c3d4', 100, { sound: false, days: { '2026-11-05': { lessons: 1, xp: 10 } } });
    const D = device({ ...here, durable: { tag: 'a1b2c3d4' }, backup: { on: true, code: 'example-code' } });
    const copy = progress('נועה', 'b2c3d4e5', 40, { sound: true });
    const r = await applyRestored(copy, 'file', { store: D.store, quarantine: D.quarantine, now, localAt: '2026-11-05T09:00:00.000Z', at: '2026-11-04T09:00:00.000Z' });
    expect(r).toEqual({ kind: 'same', applied: true, undo: false });
    const st = D.st();
    expect(st).toMatchObject({ xp: 140, xpBy: { a1b2c3d4: 100, b2c3d4e5: 40 }, sound: false });
    expect(Object.keys(st.days).sort()).toEqual(['2026-11-04', '2026-11-05']);
    expect(st.backup).toEqual({ on: true, code: 'example-code' }); // the vault link is this device's
    expect(canUndo(st, NOW)).toBe(false);
    expect(await D.quarantine.latest('before-restore')).toBeNull();
    expect(restoreEvents(st)).toEqual([{ e: 'restore', m: 'file' }, { e: 'merge', m: 'file' }]);
  });

  it('the same student after a reset here: the copy the student chose still comes back (a restore lowers nothing)', async () => {
    const D = device({ ...progress('נועה', 'a1b2c3d4', 5), resetAt: '2026-11-05T08:00:00.000Z' });
    await applyRestored(progress('נועה', 'b2c3d4e5', 300), 'file', { store: D.store, quarantine: D.quarantine, now });
    expect(D.st().xp).toBe(305);
  });

  it('another student: nothing happens until the student chooses to replace', async () => {
    const here = progress('נועה', 'a1b2c3d4', 100);
    const D = device(here);
    const before = D.st();
    expect(await applyRestored(progress('יואב', 'b2c3d4e5', 40), 'file', { store: D.store, quarantine: D.quarantine, now })).toEqual({ kind: 'other', applied: false, undo: false });
    expect(D.st()).toEqual(before);
  });

  it('another student, replaced: the progress here is kept aside whole, the vault is let go, undo is offered for 30 days', async () => {
    const here = progress('נועה', 'a1b2c3d4', 100, { outbox: [{ id: 'o1' }], durable: { tag: 'a1b2c3d4', persistAsked: '2026-11-01T10:00:00.000Z' }, backup: { on: true, code: 'example-code', lookup: 'lk' } });
    const D = device(here);
    const sibling = progress('יואב', 'b2c3d4e5', 40);
    const r = await applyRestored(sibling, 'file', { store: D.store, quarantine: D.quarantine, now, replace: true });
    expect(r).toEqual({ kind: 'other', applied: true, undo: true });
    const st = D.st();
    expect(st).toMatchObject({ profile: sibling.profile, xp: 40, xpBy: sibling.xpBy, outbox: [] });
    expect(st.backup.on).toBe(false); // detached: the sibling never reaches the first child's vault
    expect(st.backup.code).toBeNull();
    expect(st.backup.undoUntil).toBe(new Date(NOW.getTime() + UNDO_DAYS * 864e5).toISOString());
    expect(st.durable.tag).not.toBe('a1b2c3d4'); // XP earned here now is the sibling's, counted apart
    expect(st.durable.persistAsked).toBe('2026-11-01T10:00:00.000Z');
    expect(canUndo(st, NOW)).toBe(true);
    expect(canUndo(st, new Date(NOW.getTime() + 31 * 864e5))).toBe(false);
    const kept = await D.quarantine.latest('before-restore');
    expect(JSON.parse(kept.value.raw)).toEqual(JSON.parse(JSON.stringify({ ...dataOf(createStore(appState).getState()), ...here })));
    expect(restoreEvents(st)).toEqual([{ e: 'restore', m: 'file' }]);
  });

  it('undo brings the progress here back whole, its backup settings too, and the vault pushes first next time', async () => {
    const here = progress('נועה', 'a1b2c3d4', 100, { backup: { on: true, code: 'example-code', lookup: 'lk', forcePush: false } });
    const D = device(here);
    const original = D.st();
    await applyRestored(progress('יואב', 'b2c3d4e5', 40), 'file', { store: D.store, quarantine: D.quarantine, now, replace: true });
    expect(await undoRestore({ store: D.store, quarantine: D.quarantine })).toBe(true);
    const st = D.st();
    expect(st).toEqual({ ...original, backup: { ...BACKUP_DEFAULTS, ...original.backup, forcePush: true } });
    expect(st.backup.on).toBe(true);
    expect(canUndo(st, NOW)).toBe(false);
    expect(await D.quarantine.latest('before-restore')).toBeNull(); // used once
  });

  it('undo when the kept copy is gone: nothing changes but the offer to undo', async () => {
    const D = device({ ...progress('יואב', 'b2c3d4e5', 40), backup: { on: false, undoUntil: '2026-12-01T00:00:00.000Z' } });
    expect(await undoRestore({ store: D.store, quarantine: D.quarantine })).toBe(false);
    expect(D.st()).toMatchObject({ xp: 40, profile: { name: 'יואב' } });
    expect(canUndo(D.st(), NOW)).toBe(false);
  });

  it('a device that cannot keep the copy aside does not replace', async () => {
    const D = device(progress('נועה', 'a1b2c3d4', 100), { failPut: true });
    const before = D.st();
    expect(await applyRestored(progress('יואב', 'b2c3d4e5', 40), 'file', { store: D.store, quarantine: D.quarantine, now, replace: true })).toEqual({ kind: 'other', applied: false, undo: false, error: NO_COPY });
    expect(D.st()).toEqual(before);
  });

  it('nothing device-only or secret comes in from a copy, even a hand-made one', async () => {
    const D = device({ ai: { device: 'dev-here' } });
    const copy = { ...progress('נועה', 'a1b2c3d4', 10), ai: { key: 'sk-example' }, backup: { on: true, code: 'theirs' }, profile: { role: 'student', name: 'נועה', token: 'tok', studentId: 's1' } };
    await applyRestored(copy, 'file', { store: D.store, quarantine: D.quarantine, now });
    const st = D.st();
    expect(st.ai).toEqual({ device: 'dev-here' }); // this device's tutor, not the copy's key
    expect(st.backup.on).toBe(false);
    expect(st.profile).toEqual({ role: 'student', name: 'נועה' });
    expect(snapshotForBackup(st).ai).toBeUndefined();
  });

  it('the restore event is logged once per restore, with no content', async () => {
    const D = device();
    const spy = vi.fn();
    D.store.subscribe(spy);
    await applyRestored(progress('נועה', 'a1b2c3d4', 10), 'file', { store: D.store, quarantine: D.quarantine, now });
    expect(spy).toHaveBeenCalledTimes(1); // one change of the store
    expect(D.st().learn.events.at(-1)).toEqual({ t: NOW.toISOString(), e: 'restore', m: 'file' });
  });
});
