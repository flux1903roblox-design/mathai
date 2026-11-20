// The iPhone app's daily reminder (STUDENT-12 §3, lib/localReminder.js), with a stubbed Capacitor LocalNotifications:
// 60 days ahead minus the quiet days and the eves of quiet days, never more than iOS keeps (64), today's cancelled by a
// finished lesson, the days scheduled again on the next day's first open, and the permission's answers. Then the way
// in: in the VITE_STORE=ios build pushState() answers 'store-ios' first, push.js hands over, and the native shell's
// bridge (window.Capacitor) is what is called.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isQuietDay, isQuietEve } from '@shared/restDays.js';
import { messageFor, TEXTS } from '@shared/reminder.js';

const counted = [];
vi.mock('./metrics.js', () => ({ count: (name) => { counted.push(name); return true; } }));

/** Capacitor's LocalNotifications as the tests need it: permission answers, and what is pending. */
function stubPlugin({ permission = 'prompt', answer = 'granted' } = {}) {
  const pending = new Map();
  const calls = [];
  return {
    pending, calls,
    checkPermissions: vi.fn(async () => ({ display: permission })),
    requestPermissions: vi.fn(async () => { permission = answer; return { display: answer }; }),
    schedule: vi.fn(async ({ notifications }) => { calls.push(['schedule', notifications.length]); for (const n of notifications) pending.set(n.id, n); return { notifications: notifications.map((n) => ({ id: n.id })) }; }),
    cancel: vi.fn(async ({ notifications }) => { calls.push(['cancel', notifications.map((n) => n.id)]); for (const n of notifications) pending.delete(n.id); }),
    getPending: vi.fn(async () => ({ notifications: [...pending.values()].map((n) => ({ id: n.id, title: n.title, body: n.body })) })),
  };
}

const at = (iso) => new Date(iso);
/** Wednesday 11 Nov 2026, 10:00 on the phone's clock. */
const WED = at('2026-11-11T10:00:00');
const day = (d) => d.toLocaleDateString('en-CA');
/** The days the rule keeps, counted the slow way. */
function expectedDays(from, n = 60) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(`${from}T12:00:00`); d.setDate(d.getDate() + i);
    const k = day(d);
    if (!isQuietDay(k) && !isQuietEve(k)) out.push(k);
  }
  return out;
}

let local; let useApp;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(WED);
  counted.length = 0;
  ({ useApp } = await import('./store.js'));
  useApp.setState({ reminder: { on: false, slot: 17, id: null, secret: null, state: null, seenDay: null, doneDay: null } });
  local = await import('./localReminder.js');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); delete globalThis.Capacitor; });

describe('planReminders: which days get a reminder', () => {
  it('60 days from today, without Shabbat, Yom Tov, memorial days, Tish\'a B\'Av and their eves', () => {
    const list = local.planReminders({ from: '2026-11-11', slot: 17, now: WED });
    expect(list.map((n) => n.id)).toEqual(expectedDays('2026-11-11').map((k) => Number(k.replaceAll('-', ''))));
    expect(list.length).toBeLessThanOrEqual(60);
    expect(list.length).toBeLessThan(64);
    // in these 60 days: no Friday (Shabbat's eve) and no Saturday
    for (const n of list) {
      const d = n.schedule.at;
      expect([5, 6]).not.toContain(d.getDay());
      expect(d.getHours()).toBe(17);
      expect(d.getMinutes()).toBe(0);
    }
    // 60 days minus 9 Fridays and 9 Saturdays (11 Nov 2026 to Saturday 9 Jan 2027 has no holiday on the list)
    expect(list).toHaveLength(60 - 9 - 9);
    expect(list[0]).toEqual({ id: 20261111, title: 'מדרגות', body: messageFor('2026-11-11'), schedule: { at: at('2026-11-11T17:00:00'), allowWhileIdle: true } });
    expect(new Set(list.map((n) => n.body))).toEqual(new Set(TEXTS));
  });

  it('skips Yom Tov, its eve, the memorial days and their eves (autumn 2026)', () => {
    const ids = local.planReminders({ from: '2026-09-10', slot: 18, now: at('2026-09-10T08:00:00') }).map((n) => n.id);
    // Rosh Hashana 12-13 Sep (eve 11), Yom Kippur 21 Sep (eve 20), Sukkot 26 Sep (eve 25), Simchat Torah 3 Oct (eve 2),
    // the Swords of Iron memorial day 5 Oct (eve 4)
    for (const k of ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-20', '2026-09-21', '2026-09-25', '2026-09-26', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']) {
      expect(ids, k).not.toContain(Number(k.replaceAll('-', '')));
    }
    expect(ids).toContain(20260910);
    expect(ids).toContain(20260914);
    expect(ids).toEqual(expectedDays('2026-09-10').map((k) => Number(k.replaceAll('-', ''))));
  });

  it('leaves out today when it was learned already, or when the hour has passed; never more than 60 days', () => {
    expect(local.planReminders({ from: '2026-11-11', slot: 17, now: WED, done: '2026-11-11' })[0].id).toBe(20261112);
    expect(local.planReminders({ from: '2026-11-11', slot: 17, now: at('2026-11-11T18:30:00') })[0].id).toBe(20261112);
    expect(local.planReminders({ from: '2026-11-11', slot: 17, now: WED, days: 400 }).length).toBe(60 - 9 - 9);
  });
});

describe('turning it on, a finished lesson, the next open, turning it off', () => {
  it('enable(17) asks iOS, schedules the days, and counts push_on once', async () => {
    const p = stubPlugin();
    expect(await local.localState({ plugin: p })).toBe('ready');
    expect(await local.enable(17, { plugin: p })).toEqual({ ok: true });
    expect(p.requestPermissions).toHaveBeenCalledTimes(1);
    expect([...p.pending.keys()]).toEqual(expectedDays('2026-11-11').map((k) => Number(k.replaceAll('-', ''))));
    expect(useApp.getState().reminder).toMatchObject({ on: true, slot: 17, state: 'on', seenDay: '2026-11-11', id: null, secret: null });
    expect(await local.localState({ plugin: p })).toBe('on');
    expect(counted).toEqual(['push_on']);
    // a new hour: the same days at 19:00, and nothing counted again
    expect(await local.enable(19, { plugin: p })).toEqual({ ok: true });
    expect(p.pending.get(20261111).schedule.at).toEqual(at('2026-11-11T19:00:00'));
    expect(p.pending.size).toBe(60 - 9 - 9);
    expect(counted).toEqual(['push_on']);
  });

  it('a finished lesson cancels today\'s reminder, once a day', async () => {
    const p = stubPlugin();
    await local.enable(17, { plugin: p });
    expect(await local.markDone({ plugin: p })).toBe(true);
    expect(p.pending.has(20261111)).toBe(false);
    expect(p.pending.has(20261112)).toBe(true);
    expect(useApp.getState().reminder.doneDay).toBe('2026-11-11');
    expect(await local.markDone({ plugin: p })).toBe(false); // a second lesson: nothing more to do
    // opening the app again the same day does not bring today's back
    expect(await local.markSeen({ plugin: p })).toBe(false);
    expect(p.pending.has(20261111)).toBe(false);
  });

  it('the next day\'s first open schedules 60 days from that day', async () => {
    const p = stubPlugin();
    await local.enable(17, { plugin: p });
    await local.markDone({ plugin: p });
    vi.setSystemTime(at('2026-11-12T09:00:00'));
    expect(await local.markSeen({ plugin: p })).toBe(true);
    expect([...p.pending.keys()].sort()).toEqual(expectedDays('2026-11-12').map((k) => Number(k.replaceAll('-', ''))));
    expect(useApp.getState().reminder.seenDay).toBe('2026-11-12');
  });

  it('"not now" and a refusal: nothing is scheduled, and the line says where to turn it on', async () => {
    const later = stubPlugin({ answer: 'prompt' });
    expect(await local.enable(17, { plugin: later })).toEqual({ ok: false, state: 'ready' });
    const no = stubPlugin({ answer: 'denied' });
    expect(await local.enable(17, { plugin: no })).toEqual({ ok: false, state: 'denied-app' });
    expect(no.schedule).not.toHaveBeenCalled();
    expect(useApp.getState().reminder.on).toBe(false);
    expect(await local.localState({ plugin: stubPlugin({ permission: 'denied' }) })).toBe('denied-app');
    expect(counted).toEqual([]);
  });

  it('disable() leaves nothing pending of ours, keeps other notifications, and counts push_off', async () => {
    const p = stubPlugin();
    await local.enable(17, { plugin: p });
    p.pending.set(7, { id: 7, title: 'other' });
    await local.disable({ plugin: p });
    expect([...p.pending.keys()]).toEqual([7]);
    expect(useApp.getState().reminder).toMatchObject({ on: false, seenDay: null, doneDay: null });
    expect(counted).toEqual(['push_on', 'push_off']);
    await local.enable(17, { plugin: p });
    await local.disable({ plugin: p, quiet: true });
    expect(counted).toEqual(['push_on', 'push_off', 'push_on']); // the quiet one counts nothing
  });

  it('with no native shell (a browser) it says so and schedules nothing', async () => {
    expect(await local.localState({ plugin: null })).toBe('unsupported-app');
    expect(await local.enable(17, { plugin: null })).toEqual({ ok: false, state: 'unsupported-app' });
  });
});

describe('the iPhone build: push.js hands over, through the shell\'s bridge', () => {
  /** The bridge Capacitor's iOS shell puts in the page: nativePromise(plugin, method, options). */
  function bridge(plugin) {
    const asked = [];
    globalThis.Capacitor = {
      isNativePlatform: () => true,
      nativePromise: vi.fn(async (name, method, options) => { asked.push([name, method]); return name === 'LocalNotifications' ? plugin[method](options) : undefined; }),
    };
    return asked;
  }

  it('pushState() is "store-ios" first, and reminderState() is the phone\'s answer', async () => {
    vi.stubEnv('VITE_STORE', 'ios');
    const p = stubPlugin();
    bridge(p);
    const push = await import('./push.js');
    expect(await push.pushState()).toBe('store-ios');
    expect(await push.reminderState()).toBe('ready');
    vi.stubEnv('VITE_STORE', '');
    expect(await push.pushState()).not.toBe('store-ios');
  });

  it('enable, markDone and disable reach LocalNotifications through Capacitor.nativePromise', async () => {
    vi.stubEnv('VITE_STORE', 'ios');
    const p = stubPlugin();
    const asked = bridge(p);
    const push = await import('./push.js');
    expect(await push.enable(18)).toEqual({ ok: true });
    expect(asked).toEqual(expect.arrayContaining([['LocalNotifications', 'requestPermissions'], ['LocalNotifications', 'schedule']]));
    expect(p.pending.get(20261111).schedule.at).toEqual(at('2026-11-11T18:00:00'));
    expect(await push.markDone()).toBe(true);
    expect(p.pending.has(20261111)).toBe(false);
    await push.disable();
    expect(p.pending.size).toBe(0);
  });

  it('LessonDone may offer it in the iPhone app from the third learning day, with no server and no web push', async () => {
    vi.stubEnv('VITE_STORE', 'ios');
    const { reminderDue } = await import('./reminder.js');
    const days = { '2026-11-09': { lessons: 1 }, '2026-11-10': { lessons: 1 }, '2026-11-11': { lessons: 1 } };
    const env = { VITE_STORE: 'ios', PROD: true };
    expect(reminderDue({ days, nudges: {}, reminder: {} }, globalThis, env)).toBe(false); // no shell: a browser
    bridge(stubPlugin());
    expect(reminderDue({ days, nudges: {}, reminder: {} }, globalThis, env)).toBe(true);
    expect(reminderDue({ days, nudges: { pushOffered: true }, reminder: {} }, globalThis, env)).toBe(false);
    expect(reminderDue({ days: { '2026-11-11': { lessons: 1 } }, nudges: {}, reminder: {} }, globalThis, env)).toBe(false);
  });
});
