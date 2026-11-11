// The install offer on Android and desktop (STUDENT-10). Chrome and Edge fire beforeinstallprompt when the app can be
// installed; it is kept here, and the app asks at a moment of value (LessonDone's last stage, from the second learning
// day, at most twice, 30 days apart) or when the student asks (Settings). Store apps and an app already installed
// never offer it. iPhone has no such event: nothing here shows there.
// - initInstall(window) runs once from main.jsx: it keeps the event, notes appinstalled (a toast, and the count),
//   remembers a launch from the Play Store app (?src=play), and follows a shortcut tapped while the app is open.
// - <STORE_KEY>-src = 'play' is that note. A Trusted Web Activity shares Chrome's storage for the address, so the note
//   counts only while the page also runs standalone: the same phone's ordinary Chrome tab is never a store app.
import { useSyncExternalStore } from 'react';
import { count } from './metrics.js';
import { daysBetween, learnDaysTotal } from './streak.js';

export const SRC_KEY = `${import.meta.env.VITE_STORE_KEY || 'madregot'}-src`;
/** The toast after an install (main.jsx shows it). */
export const INSTALLED_TEXT = 'מדרגות הותקנה. אפשר לפתוח אותה ממסך הבית.';
/** The automatic offer: from this many learning days, at most this many times, this many days apart. */
export const INSTALL = { fromDays: 2, offers: 2, apart: 30 };

let deferred = null; // the browser's install prompt, until it is used
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const win = () => (typeof window === 'undefined' ? null : window);

/** The page runs as an installed app (or a store app's window). */
export function isStandalone(w = win()) {
  try { return !!(w?.matchMedia?.('(display-mode: standalone)')?.matches || w?.navigator?.standalone === true); } catch { return false; }
}

/** The iOS store build (VITE_STORE), a Play Store app (its referrer, or ?src=play seen before and standalone now). */
export function isStoreApp(w = win()) {
  if (import.meta.env.VITE_STORE) return true;
  try {
    if (String(w?.document?.referrer || '').startsWith('android-app://')) return true;
    return w?.localStorage?.getItem(SRC_KEY) === 'play' && isStandalone(w);
  } catch { return false; }
}

/** The browser offered an install that has not been used yet. */
export const canOffer = () => !!deferred;

/** Show the browser's install prompt: 'accepted' | 'dismissed' | 'unavailable'. A prompt can be shown once. */
export async function offer() {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  emit();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    if (choice?.outcome !== 'accepted') return 'dismissed';
    count('install_accept');
    return 'accepted';
  } catch { return 'unavailable'; }
}

/** { canOffer } that follows the browser's event, for a screen. */
export function useInstall() {
  const can = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, canOffer, () => false);
  return { canOffer: can, offer };
}

/**
 * LessonDone's last stage offers the install when all hold: the browser can, this is no store app and not installed,
 * at least 2 learning days, fewer than 2 offers, and none in the last 30 days (nudges.installDismissedAt is the day the
 * last offer was shown: an offer not taken is set aside from that day).
 */
export function installDue({ days = {}, nudges = {} } = {}, day, w = win()) {
  const n = nudges || {};
  return canOffer() && !isStoreApp(w) && !isStandalone(w)
    && learnDaysTotal(days || {}) >= INSTALL.fromDays
    && (n.installOffers || 0) < INSTALL.offers
    && (!n.installDismissedAt || daysBetween(n.installDismissedAt, day) >= INSTALL.apart);
}

/** ?src=play in the address (before or after the #): a launch from the Play Store app. */
function noteSource(w) {
  const src = (q) => new URLSearchParams(q || '').get('src');
  if (src(w.location.search) === 'play' || src(w.location.hash.split('?')[1]) === 'play') {
    try { w.localStorage.setItem(SRC_KEY, 'play'); } catch { /* storage blocked: the referrer still tells */ }
  }
}

/** Once, at start. onInstalled: what to show after an install (main.jsx: a toast). */
export function initInstall(w = win(), { onInstalled } = {}) {
  if (!w?.addEventListener) return;
  noteSource(w);
  w.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  w.addEventListener('appinstalled', () => { deferred = null; emit(); count('installed'); onInstalled?.(); });
  // the manifest's launch_handler focuses an open app instead of starting another: a shortcut's address arrives here
  w.launchQueue?.setConsumer?.((params) => {
    try {
      const { hash } = new URL(params.targetURL);
      if (hash && hash !== w.location.hash) w.location.hash = hash;
    } catch { /* no address: stay where the app is */ }
  });
}
