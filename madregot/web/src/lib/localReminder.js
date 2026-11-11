// The iPhone app's daily reminder (STUDENT-12 §3): local notifications on the phone itself, so it needs no server and no
// push keys. Only the VITE_STORE=ios build loads it: lib/push.js pushState() answers 'store-ios' there, and push.js's
// enable, disable, markDone and markSeen hand over to this file.
// - The reminder is scheduled at the chosen hour (16:00-20:00, the phone's clock) on each of the next 60 days. iOS keeps
//   at most 64 pending notifications for an app, so 60 is the ceiling and nothing schedules more.
// - The same rules as the web push (worker/src/push.js): never on Shabbat, Yom Tov, the memorial days or Tish'a B'Av
//   (shared/restDays.js isQuietDay), never on their eve (isQuietEve: they begin at sundown, and every hour here is after
//   noon), and not on a day the student already learned (markDone cancels today's). The text is the server's text for
//   that day (shared/reminder.js).
// - Every first open of a day schedules the 60 days again from today (markSeen), so a student who keeps opening the app
//   always has 60 days ahead, and one who stops gets none after 60 days.
// Each notification's id is its day as a number (2026-11-11 → 20261111), so today's is found without a list.
// `plugin` is Capacitor's LocalNotifications (lib/native.js); the unit tests pass a stub with the same five calls.
import { useApp, today } from './store.js';
import { count } from './metrics.js';
import { nativePlugin } from './native.js';
import { isQuietDay, isQuietEve } from '@shared/restDays.js';
import { TITLE, messageFor } from '@shared/reminder.js';

/** Days scheduled ahead, today included. iOS keeps at most 64 pending notifications an app. */
export const DAYS_AHEAD = 60;

const local = () => nativePlugin('LocalNotifications');
const reminder = () => useApp.getState().reminder || {};
const setReminder = (patch) => useApp.getState().setReminder(patch);

/** A YYYY-MM-DD day moved by n days (calendar arithmetic, no time zone). */
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** The notification id of a day: 2026-11-11 → 20261111. */
export const idOf = (day) => Number(day.replaceAll('-', ''));
/** One of ours (a day's id), and not some other notification. */
export const isOurs = (id) => Number.isInteger(id) && id >= 20000101 && id <= 20991231;
/** The hour on a day, on the phone's clock. */
const atHour = (day, slot) => new Date(`${day}T${String(slot).padStart(2, '0')}:00:00`);

/**
 * The notifications for the days from `from` on: `days` calendar days, without the quiet days and their eves, without
 * `done` (a day already learned), and without any time already past `now`.
 */
export function planReminders({ from, slot, done = null, now = new Date(), days = DAYS_AHEAD }) {
  const out = [];
  for (let i = 0; i < Math.min(days, DAYS_AHEAD); i += 1) {
    const day = addDays(from, i);
    if (isQuietDay(day) || isQuietEve(day) || day === done) continue;
    const at = atHour(day, slot);
    if (at <= now) continue;
    out.push({ id: idOf(day), title: TITLE, body: messageFor(day), schedule: { at, allowWhileIdle: true } });
  }
  return out;
}

/** What Settings and LessonDone show: 'unsupported-app' (no native shell), 'denied-app', 'on' or 'ready'. */
export async function localState({ plugin = local() } = {}) {
  if (!plugin) return 'unsupported-app';
  let perm;
  try { perm = (await plugin.checkPermissions())?.display; } catch { return 'unsupported-app'; }
  if (perm === 'denied') return 'denied-app';
  return reminder().on ? 'on' : 'ready';
}

/** Cancel every pending reminder of ours. Never throws. */
async function cancelAll(plugin) {
  try {
    const pending = (await plugin.getPending())?.notifications || [];
    const ours = pending.map((n) => Number(n.id)).filter(isOurs);
    if (ours.length) await plugin.cancel({ notifications: ours.map((id) => ({ id })) });
  } catch { /* nothing pending */ }
}

/** Schedule the next 60 days again (the reminder must be on). Returns how many are pending now. */
export async function reschedule({ plugin = local(), now = new Date() } = {}) {
  const r = reminder();
  if (!plugin || !r.on) return 0;
  const day = today(now);
  await cancelAll(plugin);
  const list = planReminders({ from: day, slot: r.slot, done: r.doneDay, now });
  if (list.length) await plugin.schedule({ notifications: list });
  setReminder({ seenDay: day });
  return list.length;
}

/**
 * Turn it on (or move it to another hour), from a tap: iOS asks the student first. Returns { ok: true }, or
 * { ok: false, state } ('denied-app': notifications are off for the app in the phone's settings; 'ready': not now).
 */
export async function enable(slot, { plugin = local(), now = new Date() } = {}) {
  if (!plugin) return { ok: false, state: 'unsupported-app' };
  const perm = (await plugin.requestPermissions())?.display;
  if (perm !== 'granted') return { ok: false, state: perm === 'denied' ? 'denied-app' : 'ready' };
  const first = !reminder().on;
  setReminder({ on: true, slot: Number(slot), id: null, secret: null, state: 'on', doneDay: first ? null : reminder().doneDay ?? null });
  await reschedule({ plugin, now });
  if (first) count('push_on');
  return { ok: true };
}

/** Turn it off: nothing stays pending. { quiet: true } (deleting everything, signing out) counts nothing. */
export async function disable({ quiet = false, plugin = local() } = {}) {
  if (plugin) await cancelAll(plugin);
  const was = reminder().on;
  setReminder({ on: false, id: null, secret: null, state: null, seenDay: null, doneDay: null });
  if (was && !quiet) count('push_off');
}

/** A lesson, a check or a teaching stage was finished: no reminder today. Returns true when today's was cancelled. */
export async function markDone({ plugin = local(), now = new Date() } = {}) {
  const r = reminder();
  const day = today(now);
  if (!r.on || r.doneDay === day) return false;
  setReminder({ doneDay: day });
  if (!plugin) return false;
  try { await plugin.cancel({ notifications: [{ id: idOf(day) }] }); return true; } catch { return false; }
}

/** The first open of a day: schedule the 60 days from today again. */
export async function markSeen({ plugin = local(), now = new Date() } = {}) {
  const r = reminder();
  if (!r.on || r.seenDay === today(now)) return false;
  return (await reschedule({ plugin, now })) >= 0;
}
