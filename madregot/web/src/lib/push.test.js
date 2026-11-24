// The daily reminder on the page (STUDENT-11, lib/push.js and lib/reminder.js), with a stubbed browser: Notification,
// the service worker's push manager, IndexedDB and fetch (a fake server at api.example.test). Every branch of
// pushState(), enable(17) from a click, a new hour with `replaces`, disable(), markDone() once a day, a pause and a
// reminder the server no longer has, and the store's own call after a finished teaching stage. IndexedDB is a real one
// (fake-indexeddb, a new IDBFactory for each test), read and written here through transactions of the test's own.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { idbRecord } from './durable/testing.js';

const counted = [];
vi.mock('./metrics.js', () => ({ count: (name) => { counted.push(name); return true; } }));

const API = 'https://api.example.test';
const KEY = Buffer.from(Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : i))).toString('base64url');
const PROD = { PROD: true };

/** A browser with push: Notification, a service worker whose push manager subscribes, and what it was asked. */
function browser({ permission = 'default', answer = 'granted', ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/130', standalone = false, push = true, existing = null } = {}) {
  const sub = (endpoint) => ({
    endpoint,
    options: { applicationServerKey: Uint8Array.from(Buffer.from(KEY, 'base64url')).buffer },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'BP256dh-from-the-browser', auth: 'auth-from-the-browser' } }),
    unsubscribe: vi.fn(async () => true),
  });
  let current = existing ? sub(existing) : null;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => { current = sub('https://fcm.googleapis.com/fcm/send/synthetic-1'); return current; }),
  };
  const reg = { pushManager };
  const w = {
    navigator: { userAgent: ua, platform: 'Linux armv8l', maxTouchPoints: 5, standalone, serviceWorker: { ready: Promise.resolve(reg), getRegistration: async () => reg } },
    matchMedia: (q) => ({ matches: standalone && q === '(display-mode: standalone)' }),
    Notification: { permission, requestPermission: vi.fn(async () => { w.Notification.permission = answer; return answer; }) },
    ...(push ? { PushManager: function PushManager() {} } : {}),
  };
  w.sub = () => current;
  return { w, pushManager };
}

/** The server: the key (or 404), subscribe, seen and off, each request kept. */
function server({ key = 200, seen = () => ({ status: 'on' }) } = {}) {
  const calls = [];
  let n = 0;
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const path = String(url).replace(API, '');
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, body });
    const res = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (path === '/api/push/key') return key === 'down' ? Promise.reject(new TypeError('offline')) : key === 200 ? res(200, { key: KEY }) : res(key, { error: 'not_found' });
    if (path === '/api/push/subscribe') { n += 1; return res(200, { id: String(n).padStart(16, 'a'), secret: String(n).padStart(32, 'b') }); }
    if (path === '/api/push/seen') { const s = seen(body); return typeof s === 'number' ? res(s, { error: 'no_push' }) : res(200, s); }
    if (path === '/api/push/off') return res(200, { ok: true });
    return res(404, { error: 'not_found' });
  });
  return calls;
}

let push; let reminder; let useApp; let idb;
beforeEach(async () => {
  vi.resetModules();
  counted.length = 0;
  idb = new IDBFactory();
  globalThis.indexedDB = idb;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-10T14:00:00'));
  ({ useApp } = await import('./store.js'));
  useApp.getState().setAI({ apiUrl: API });
  push = await import('./push.js');
  reminder = await import('./reminder.js');
});
afterEach(() => { vi.useRealTimers(); delete globalThis.indexedDB; });

const state = () => useApp.getState().reminder;
/** The record the service worker reads: IndexedDB madregot-push / sub / current. */
const saved = () => idbRecord(idb, 'madregot-push', 'sub', 'current');

describe('idb(): the one record the service worker reads (madregot-push / sub / current)', () => {
  it('reads nothing, writes, reads it back, deletes, through the database a real IndexedDB keeps', async () => {
    const rec = { id: 'a'.repeat(16), secret: 'b'.repeat(32), slot: 17, key: KEY, api: API };
    expect(await push.idb()).toBeNull();
    expect(await push.idb(rec)).toBe(true);
    expect(await push.idb()).toEqual(rec);
    expect(await saved()).toEqual(rec); // the same record, read by another connection
    expect(await push.idb(null)).toBe(true);
    expect(await push.idb()).toBeNull();
    expect((await idb.databases()).map((d) => d.name)).toEqual(['madregot-push']);
  });
  it('never throws: no IndexedDB, or one that refuses to open, answers null', async () => {
    delete globalThis.indexedDB;
    expect(await push.idb({ id: 'x' })).toBeNull();
    globalThis.indexedDB = { open: () => { throw new DOMException('IndexedDB is blocked', 'SecurityError'); } };
    expect(await push.idb()).toBeNull();
  });
});

describe('pushState()', () => {
  it('no-server: a build or a setting with no server', async () => {
    useApp.getState().setAI({ apiUrl: 'none' });
    expect(await push.pushState({ env: PROD, w: browser().w })).toBe('no-server');
  });
  it('ios-install: iPhone Safari in a tab; the Home Screen app is a browser like any other', async () => {
    server();
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1';
    expect(await push.pushState({ env: PROD, w: browser({ ua: iphone, push: false }).w })).toBe('ios-install');
    expect(await push.pushState({ env: PROD, w: browser({ ua: iphone, standalone: true }).w })).toBe('ready');
    // an iPad that says it is a Mac
    const ipad = browser({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.1 Safari/605.1.15', push: false }).w;
    ipad.navigator.platform = 'MacIntel';
    expect(await push.pushState({ env: PROD, w: ipad })).toBe('ios-install');
  });
  it('unsupported: no PushManager, or a build without the service worker (dev, the store apps)', async () => {
    server();
    expect(await push.pushState({ env: PROD, w: browser({ push: false }).w })).toBe('unsupported');
    expect(await push.pushState({ env: { PROD: false }, w: browser().w })).toBe('unsupported');
    expect(await push.pushState({ env: { PROD: true, VITE_SW: 'off' }, w: browser().w })).toBe('unsupported');
  });
  it('denied: the browser blocks notifications from the site', async () => {
    server();
    expect(await push.pushState({ env: PROD, w: browser({ permission: 'denied' }).w })).toBe('denied');
  });
  it('off-server: the server answers 404 (its switch is off); offline: it did not answer', async () => {
    server({ key: 404 });
    expect(await push.pushState({ env: PROD, w: browser().w })).toBe('off-server');
    push._forgetKey();
    server({ key: 'down' });
    expect(await push.pushState({ env: PROD, w: browser().w })).toBe('offline');
  });
  it('ready: the key came; on: a reminder is on (no need to ask the server)', async () => {
    const calls = server();
    expect(await push.pushState({ env: PROD, w: browser().w })).toBe('ready');
    expect(calls.map((c) => c.path)).toEqual(['/api/push/key']);
    useApp.getState().setReminder({ on: true, id: 'a'.repeat(16), secret: 'b'.repeat(32) });
    expect(await push.pushState({ env: PROD, w: browser({ permission: 'granted' }).w })).toBe('on');
  });
});

describe('enable(slot), disable()', () => {
  it('enable(17) asks the browser, subscribes with the server\'s key, posts the subscription and keeps the id twice', async () => {
    const calls = server();
    const { w, pushManager } = browser();
    expect(await push.enable(17, { w })).toEqual({ ok: true });
    expect(w.Notification.requestPermission).toHaveBeenCalledTimes(1);
    const opts = pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect([...opts.applicationServerKey]).toEqual([...Buffer.from(KEY, 'base64url')]);
    const sub = calls.find((c) => c.path === '/api/push/subscribe');
    expect(sub.body).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-1', keys: { p256dh: 'BP256dh-from-the-browser', auth: 'auth-from-the-browser' }, slot: '17' });
    expect(state()).toMatchObject({ on: true, slot: 17, id: 'aaaaaaaaaaaaaaa1', secret: 'b'.repeat(31) + '1', state: 'on' });
    expect(await saved()).toEqual({ id: 'aaaaaaaaaaaaaaa1', secret: 'b'.repeat(31) + '1', slot: 17, key: KEY, api: API });
    expect(counted).toEqual(['push_on']);
  });

  it('a new hour subscribes again with replaces (the same browser subscription), and counts no second push_on', async () => {
    const calls = server();
    const { w, pushManager } = browser();
    await push.enable(17, { w });
    await push.enable(19, { w });
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.path === '/api/push/subscribe')[1].body).toMatchObject({ slot: '19', replaces: { id: 'aaaaaaaaaaaaaaa1', secret: 'b'.repeat(31) + '1' } });
    expect(state()).toMatchObject({ on: true, slot: 19, id: 'aaaaaaaaaaaaaaa2' });
    expect((await saved()).slot).toBe(19);
    expect(counted).toEqual(['push_on']);
  });

  it('when the person says no, nothing is sent and the state says why', async () => {
    const calls = server();
    expect(await push.enable(17, { w: browser({ answer: 'denied' }).w })).toEqual({ ok: false, state: 'denied' });
    expect(await push.enable(17, { w: browser({ answer: 'default' }).w })).toEqual({ ok: false, state: 'ready' });
    expect(calls.filter((c) => c.path === '/api/push/subscribe')).toEqual([]);
    expect(state().on).toBe(false);
  });

  it('disable() deletes the row on the server, drops the subscription and the id, and counts push_off', async () => {
    const calls = server();
    const { w } = browser();
    await push.enable(18, { w });
    const sub = w.sub();
    await push.disable({ w });
    expect(calls.at(-1)).toEqual({ path: '/api/push/off', body: { id: 'aaaaaaaaaaaaaaa1', secret: 'b'.repeat(31) + '1' } });
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(await saved()).toBeUndefined();
    expect(state()).toMatchObject({ on: false, id: null, secret: null, state: null, slot: 18 });
    expect(counted).toEqual(['push_on', 'push_off']);
    // quiet (deleting everything): no count
    await push.enable(18, { w });
    await push.disable({ quiet: true, w });
    expect(counted).toEqual(['push_on', 'push_off', 'push_on']);
  });
});

describe('markDone(), markSeen()', () => {
  const on = async () => { server(); await push.enable(17, { w: browser().w }); };
  const seenCalls = () => globalThis.fetch.mock.calls.filter(([u]) => String(u).endsWith('/api/push/seen')).map(([, i]) => JSON.parse(i.body));

  it('markDone() posts seen { done: true } once a day; the next day again', async () => {
    await on();
    expect(await push.markDone()).toBe(true);
    expect(await push.markDone()).toBe(false);
    expect(await push.markSeen()).toBe(false); // a day already told as learned is also seen
    expect(seenCalls()).toEqual([{ id: 'aaaaaaaaaaaaaaa1', secret: 'b'.repeat(31) + '1', day: '2026-11-10', done: true }]);
    vi.setSystemTime(new Date('2026-11-11T09:00:00'));
    expect(await push.markSeen()).toBe(true);
    expect(await push.markSeen()).toBe(false);
    expect(await push.markDone()).toBe(true);
    expect(seenCalls().slice(1).map((b) => [b.day, b.done])).toEqual([['2026-11-11', false], ['2026-11-11', true]]);
  });

  it('nothing is posted while the reminder is off', async () => {
    const calls = server();
    expect(await push.markDone()).toBe(false);
    expect(await push.markSeen()).toBe(false);
    expect(calls).toEqual([]);
  });

  it('the server paused it: the row is deleted, the reminder is off, and Settings can say why', async () => {
    await on();
    server({ seen: () => ({ status: 'paused' }) });
    await push.markDone();
    expect(state()).toMatchObject({ on: false, id: null, state: 'paused' });
    expect(globalThis.fetch.mock.calls.at(-1)[0]).toBe(`${API}/api/push/off`);
    expect(counted).toEqual(['push_on']);
  });

  it('a reminder the server no longer has (404) is forgotten; a network failure is tried again next time', async () => {
    await on();
    server({ seen: () => 503 });
    expect(await push.markDone()).toBe(false);
    expect(state()).toMatchObject({ on: true, doneDay: null });
    server({ seen: () => 404 });
    await push.markDone();
    expect(state()).toMatchObject({ on: false, id: null, state: null });
  });

  it('the id the service worker kept (after pushsubscriptionchange) wins over the store\'s', async () => {
    await on();
    const rec = await saved();
    await idbRecord(idb, 'madregot-push', 'sub', 'current', { ...rec, id: 'c'.repeat(16), secret: 'd'.repeat(32) });
    await push.markDone();
    expect(seenCalls().at(-1)).toMatchObject({ id: 'c'.repeat(16), secret: 'd'.repeat(32) });
    expect(state()).toMatchObject({ id: 'c'.repeat(16), secret: 'd'.repeat(32) });
  });

  it('a finished teaching stage tells the server through the store, once that day', async () => {
    await on();
    useApp.getState().completeStage('signed:1', 'A');
    await vi.waitFor(() => expect(seenCalls()).toHaveLength(1));
    expect(seenCalls()[0]).toMatchObject({ day: '2026-11-10', done: true });
    useApp.getState().completeStage('signed:1', 'B');
    await new Promise((r) => setTimeout(r, 20));
    expect(seenCalls()).toHaveLength(1);
  });
});

describe('reminderDue(): the card after a lesson, by the quick rules', () => {
  const days = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-11-0${i + 1}`, { lessons: 1 }]));
  it('from the third learning day, once ever, while off, where the browser can', () => {
    const { w } = browser();
    expect(reminder.reminderDue({ days: days(3), nudges: {}, reminder: {} }, w, PROD)).toBe(true);
    expect(reminder.reminderDue({ days: days(2), nudges: {}, reminder: {} }, w, PROD)).toBe(false);
    expect(reminder.reminderDue({ days: days(5), nudges: { pushOffered: true }, reminder: {} }, w, PROD)).toBe(false);
    expect(reminder.reminderDue({ days: days(5), nudges: {}, reminder: { on: true } }, w, PROD)).toBe(false);
    expect(reminder.reminderDue({ days: days(5) }, browser({ permission: 'denied' }).w, PROD)).toBe(false);
    expect(reminder.reminderDue({ days: days(5) }, browser({ push: false }).w, PROD)).toBe(false);
    expect(reminder.reminderDue({ days: days(5) }, w, { PROD: false })).toBe(false);
    const iphone = browser({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1' }).w;
    expect(reminder.reminderDue({ days: days(5) }, iphone, PROD)).toBe(false);
    useApp.getState().setAI({ apiUrl: 'none' });
    expect(reminder.reminderDue({ days: days(5) }, w, PROD)).toBe(false);
  });
  it('the words: no plan, no price, no streak; the hours are 16 to 20', () => {
    const all = Object.values(reminder.REMINDER_TEXT).map((t) => (typeof t === 'function' ? t(17) : t)).join(' ');
    for (const banned of ['₪', 'מנוי', 'רצף', 'מחיר', 'פרימיום']) expect(all).not.toContain(banned);
    expect(reminder.REMINDER_TEXT.toastOn(17)).toBe('התזכורת תגיע בכל יום ב־17:00');
    expect(reminder.SLOTS).toEqual([16, 17, 18, 19, 20]);
  });
});
