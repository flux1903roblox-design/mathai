// The daily reminder's ties to the rest of the app, made at the integration of the student lane (STUDENT-11):
// - "delete all" (lib/wipe.js, TRUST-6) turns the reminder off on the server through lib/push.js, and clears this
//   browser's copy of its id and secret (IndexedDB madregot-push) and its push subscription on every path;
// - every finished item that makes today a learning day tells the reminder's server once, so no reminder comes that
//   day: a lesson, a check, a teaching stage (the lane's), and also the multiplication facts and a finished challenge
//   (the curriculum lane's, which count for the day like a lesson).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { idbRecord, idbNames } from './durable/testing.js';

const markDone = vi.fn(async () => true);
vi.mock('./push.js', () => ({ markDone, disable: vi.fn(async () => {}) }));

const { useApp, today } = await import('./store.js');
const { wipeReminder, clearReminderDevice } = await import('./reminder.js');
const { clearDevice } = await import('./wipe.js');

const ON = { on: true, slot: 18, id: 'a'.repeat(16), secret: 'b'.repeat(32), state: 'on', seenDay: null, doneDay: null };
const flush = () => new Promise((r) => { setTimeout(r, 0); });

/**
 * A browser with a push subscription and a real IndexedDB (fake-indexeddb) that holds the reminder's database, as
 * lib/push.js leaves it, and another database of the app's that must stay.
 */
async function fakeWindow() {
  const calls = { unsubscribed: 0 };
  const sub = { unsubscribe: async () => { calls.unsubscribed += 1; return true; } };
  const indexedDB = new IDBFactory();
  await idbRecord(indexedDB, 'madregot-push', 'sub', 'current', { id: 'a'.repeat(16), secret: 'b'.repeat(32), slot: 18, key: 'BKEY', api: 'https://api.example.test' });
  await idbRecord(indexedDB, 'other-app-db', 'kv', 'k', 1);
  const w = { navigator: { serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => sub } }) } }, indexedDB };
  return { w, calls, names: () => idbNames(indexedDB) };
}

describe('delete all and the daily reminder', () => {
  beforeEach(() => { useApp.setState({ reminder: { ...ON } }); });

  it('the server step turns the reminder off through lib/push.js, quietly, only while it is on, and never stops the wipe', async () => {
    const disable = vi.fn(async () => {});
    await wipeReminder(async () => ({ disable }));
    expect(disable).toHaveBeenCalledWith({ quiet: true });
    useApp.setState({ reminder: { ...ON, on: false } });
    await wipeReminder(async () => ({ disable }));
    expect(disable).toHaveBeenCalledTimes(1);
    useApp.setState({ reminder: { ...ON } });
    await expect(wipeReminder(async () => ({ disable: async () => { throw new Error('offline'); } }))).resolves.toBeUndefined();
  });

  it('on the device: the push subscription is dropped and the madregot-push database deleted', async () => {
    const { w, calls, names } = await fakeWindow();
    expect((await names()).sort()).toEqual(['madregot-push', 'other-app-db']);
    await clearReminderDevice(w);
    expect(calls).toEqual({ unsubscribed: 1 });
    expect(await names()).toEqual(['other-app-db']); // really deleted, and only that one
    // a browser with neither: nothing to do, nothing thrown
    await expect(clearReminderDevice({})).resolves.toBeUndefined();
  });

  it('is registered with lib/wipe.js: clearing the device deletes the reminder\'s database on every path', async () => {
    const { w, names } = await fakeWindow();
    const was = globalThis.indexedDB;
    globalThis.indexedDB = w.indexedDB;
    try { await clearDevice(); } finally { globalThis.indexedDB = was; }
    expect(await names()).not.toContain('madregot-push');
  });
});

describe('a learning day tells the reminder once', () => {
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState({ reminder: { ...ON }, goalXp: 20, freezes: 0 });
    markDone.mockClear();
  });

  it('the multiplication facts (a lesson of the day on no stair)', async () => {
    useApp.getState().completeLesson({ kind: 'facts', xp: 10 });
    await flush();
    expect(markDone).toHaveBeenCalledTimes(1);
  });

  it('a finished challenge (it counts for the day like a lesson)', async () => {
    useApp.getState().startChallenge('pct:c1');
    useApp.getState().finishChallenge('pct:c1', { firstTry: 2, parts: 3 });
    await flush();
    expect(markDone).toHaveBeenCalledTimes(1);
  });

  it('nothing while the reminder is off, or once today was told', async () => {
    useApp.setState({ reminder: { ...ON, on: false } });
    useApp.getState().completeLesson({ kind: 'facts', xp: 10 });
    useApp.setState({ reminder: { ...ON, doneDay: today() } });
    useApp.getState().completeLesson({ kind: 'facts', xp: 10 });
    await flush();
    expect(markDone).not.toHaveBeenCalled();
  });
});
