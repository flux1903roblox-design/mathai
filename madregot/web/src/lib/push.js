// The opt-in daily reminder by web push (STUDENT-11), the page's half. Loaded on demand (ReminderCard, Settings, and
// after learning when the reminder is on): it never weighs on the first screen. The server's half is worker/src/push.js.
//
// pushState()    what the device can do now: 'store-ios' (the iPhone app: local reminders, lib/localReminder.js, and
//                no web push at all) | 'no-server' | 'off-server' (the server's switch is off) | 'unsupported' |
//                'ios-install' (iPhone or iPad Safari: reminders need the app on the Home Screen) | 'denied' (the
//                browser blocks notifications from this site) | 'ready' | 'on' | 'offline' (the server did not answer)
// enable(slot)   from a click: ask the browser, subscribe with the server's key, send the subscription with the hour
//                (16-20); a reminder already on is replaced (a new hour). The id and secret go to the store and to
//                IndexedDB madregot-push, where the service worker reads them (sw.js pushsubscriptionchange)
// disable()      tell the server to delete the row, unsubscribe, forget the id
// markDone()     a lesson, a check or a teaching stage was finished: tell the server once a day, so no reminder comes
// markSeen()     the app was opened today (once a day): the server keeps the row 45 days from the last open
// reminderState() what the screens show: pushState(), with the iPhone app's answer filled in by lib/localReminder.js
//                ('unsupported-app' | 'denied-app' | 'ready' | 'on')
// In the iPhone app (VITE_STORE=ios) enable, disable, markDone and markSeen are lib/localReminder.js's, loaded here.
// The store keeps reminder: { on, slot, id, secret, state ('on' | 'paused' | null), seenDay, doneDay }.
import { api, apiBase, hasServer, ApiError } from './api.js';
import { useApp, today } from './store.js';
import { count } from './metrics.js';
import { isIosBrowser, pushSupported, swEnabled } from './reminder.js';

const DB = 'madregot-push';
let keyCache = null; // the server's public key, fetched once a page

/** IndexedDB madregot-push / sub / current: read (no value), write (a value) or delete (null). Never throws. */
export function idb(value) {
  return new Promise((resolve) => {
    let req;
    try { req = globalThis.indexedDB.open(DB, 1); } catch { resolve(null); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('sub');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('sub', value === undefined ? 'readonly' : 'readwrite');
        const store = tx.objectStore('sub');
        const r = value === undefined ? store.get('current') : value === null ? store.delete('current') : store.put(value, 'current');
        tx.oncomplete = () => { db.close(); resolve(value === undefined ? r.result || null : true); };
        tx.onerror = () => { db.close(); resolve(null); };
      } catch { db.close(); resolve(null); }
    };
  });
}

const b64uBytes = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const setReminder = (patch) => useApp.getState().setReminder(patch);
const reminder = () => useApp.getState().reminder || {};

/** The server's public key, or null with the reason: 'off-server' (404) or 'offline'. */
async function serverKey() {
  if (keyCache) return { key: keyCache };
  try {
    const { key } = await api('/api/push/key', { auth: false });
    keyCache = key;
    return { key };
  } catch (e) {
    return { reason: e.status === 404 ? 'off-server' : 'offline' };
  }
}

/** The iPhone store app: reminders are local notifications there (STUDENT-12 §3). */
export const storeIos = (env = import.meta.env) => env.VITE_STORE === 'ios';
const localReminder = () => import('./localReminder.js');

/** What the reminder can do on this device now (see the top of this file). `env` and `w` are for the unit tests. */
export async function pushState({ env = import.meta.env, w = globalThis } = {}) {
  if (storeIos(env)) return 'store-ios';
  if (!hasServer()) return 'no-server';
  if (isIosBrowser(w)) return 'ios-install';
  if (!pushSupported(w) || !swEnabled(env)) return 'unsupported';
  if (w.Notification.permission === 'denied') return 'denied';
  const r = reminder();
  if (r.on && r.id) return 'on';
  const k = await serverKey();
  return k.key ? 'ready' : k.reason;
}

/** What Settings and LessonDone show: pushState(), or in the iPhone app the local reminder's state. */
export async function reminderState(opts = {}) {
  const s = await pushState(opts);
  return s === 'store-ios' ? (await localReminder()).localState() : s;
}

/** The id and secret: IndexedDB first (the service worker may have replaced them), then the store. */
async function current() {
  const rec = await idb();
  const r = reminder();
  if (rec?.id && rec.id !== r.id) setReminder({ id: rec.id, secret: rec.secret });
  return rec?.id ? rec : (r.id ? { id: r.id, secret: r.secret } : null);
}

/**
 * Turn the reminder on (or move it to another hour). Call it straight from the click: the browser asks for permission
 * only from a person's own tap. Returns { ok: true } or { ok: false, state } ('denied': the browser blocks; 'ready':
 * the person closed the browser's question), and throws the server's error (ApiError) for the caller to show.
 */
export async function enable(slot, { w = globalThis } = {}) {
  if (storeIos()) return (await localReminder()).enable(slot);
  const permission = await w.Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, state: permission === 'denied' ? 'denied' : 'ready' };
  const k = await serverKey();
  if (!k.key) throw new ApiError(k.reason === 'offline' ? 'network' : 'not_found');
  const reg = await w.navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const keyBytes = b64uBytes(k.key);
  // a subscription made with another key (the owner made new keys) cannot be reused
  const old = sub?.options?.applicationServerKey;
  if (sub && old && String(new Uint8Array(old)) !== String(keyBytes)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
  const { endpoint, keys } = sub.toJSON();
  const prev = await current();
  const { id, secret } = await api('/api/push/subscribe', {
    method: 'POST', auth: false,
    body: { endpoint, keys, slot: String(slot), ...(prev?.id ? { replaces: { id: prev.id, secret: prev.secret } } : {}) },
  });
  const first = !reminder().on;
  setReminder({ on: true, slot: Number(slot), id, secret, state: 'on', seenDay: today(), doneDay: null });
  await idb({ id, secret, slot: Number(slot), key: k.key, api: apiBase() });
  if (first) count('push_on');
  return { ok: true };
}

/**
 * Turn it off: the server deletes the row, the browser drops the subscription, the device forgets the id.
 * { quiet: true } (deleting everything, signing out) counts nothing; { state: 'paused' } keeps the pause line.
 */
export async function disable({ quiet = false, state = null, w = globalThis } = {}) {
  if (storeIos()) return (await localReminder()).disable({ quiet });
  const prev = await current();
  if (prev?.id) await api('/api/push/off', { method: 'POST', auth: false, body: { id: prev.id, secret: prev.secret } }).catch(() => {});
  try {
    const reg = await w.navigator?.serviceWorker?.getRegistration?.();
    const sub = await reg?.pushManager?.getSubscription();
    await sub?.unsubscribe();
  } catch { /* nothing to drop */ }
  await idb(null);
  const was = reminder().on;
  setReminder({ on: false, id: null, secret: null, state, seenDay: null, doneDay: null });
  if (was && !quiet) count('push_off');
}

/** Tell the server about today once (seen, or done). The reminder's row is gone (404): forget it; paused: say so. */
async function seen(done) {
  const r = reminder();
  const day = today();
  if (!r.on || (done ? r.doneDay === day : (r.seenDay === day || r.doneDay === day))) return false;
  const prev = await current();
  if (!prev?.id) return false;
  const mark = done ? { doneDay: day, seenDay: day } : { seenDay: day };
  setReminder(mark); // before the request: two finished lessons at once send one
  try {
    const res = await api('/api/push/seen', { method: 'POST', auth: false, body: { id: prev.id, secret: prev.secret, day, done } });
    if (res?.status === 'paused') await disable({ quiet: true, state: 'paused' });
    return true;
  } catch (e) {
    if (e.status === 404) await disable({ quiet: true });
    else setReminder({ doneDay: r.doneDay ?? null, seenDay: r.seenDay ?? null }); // not reached: try again next time
    return false;
  }
}
export const markDone = async () => (storeIos() ? (await localReminder()).markDone() : seen(true));
export const markSeen = async () => (storeIos() ? (await localReminder()).markSeen() : seen(false));

/** For the unit tests: forget the key fetched in this page. */
export const _forgetKey = () => { keyCache = null; };
