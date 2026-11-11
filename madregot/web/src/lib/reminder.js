// The daily reminder's light half (STUDENT-11): what is known without loading lib/push.js, which loads on demand.
// - reminderDue(state): LessonDone may offer the reminder once, ever: from the third learning day, on a device and a
//   browser that can take it, where the server has one. Whether the server's switch is on is asked by pushState().
// - remindOnOpen(): the first open of a day tells the server (lib/push.js markSeen) while the reminder is on; in the
//   iPhone app it schedules the next 60 days of local reminders again (lib/localReminder.js).
import { useApp, today } from './store.js';
import { hasServer } from './api.js';
import { onWipe, onClearDevice } from './wipe.js';
import { learnDaysTotal } from './streak.js';
import { isNativeApp } from './native.js';
import { TEXTS } from '@shared/reminder.js';

/** The offer comes from this many learning days (days with a finished lesson, stage or check). */
export const REMINDER = { fromDays: 3 };
/** The hours a student can choose (Jerusalem time on the server). */
export const SLOTS = [16, 17, 18, 19, 20];
export const DEFAULT_SLOT = 17;

/** iPhone or iPad Safari in a tab: push works there only for an app added to the Home Screen (iOS 16.4+). */
export function isIosBrowser(w = globalThis) {
  const nav = w?.navigator || {};
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (!ios) return false;
  let standalone = nav.standalone === true;
  try { standalone = standalone || !!w.matchMedia?.('(display-mode: standalone)')?.matches; } catch { /* no media queries */ }
  return !standalone;
}

/** The browser has what web push needs. */
export const pushSupported = (w = globalThis) => !!(w?.navigator && 'serviceWorker' in w.navigator && w.PushManager && w.Notification);

/** The build registers the service worker (lib/swClient.js): production, and not VITE_SW=off (the store apps). */
export const swEnabled = (env = import.meta.env) => !!env.PROD && env.VITE_SW !== 'off';

/**
 * LessonDone's reminder card may come (the server's answer, or the iPhone app's permission, is asked when the screen
 * opens). In the iPhone app (VITE_STORE=ios) the reminder is a local notification: it needs the native shell, not a
 * server, a service worker or web push.
 */
export function reminderDue({ days = {}, nudges = {}, reminder = {} } = {}, w = globalThis, env = import.meta.env) {
  if (learnDaysTotal(days || {}) < REMINDER.fromDays || nudges?.pushOffered || reminder?.on) return false;
  if (env.VITE_STORE === 'ios') return isNativeApp(w);
  return hasServer() && !isIosBrowser(w) && pushSupported(w) && swEnabled(env) && w.Notification.permission !== 'denied';
}

/** The first open of a day (and a return after the day changed), while the reminder is on. Never throws. */
export function remindOnOpen() {
  const r = useApp.getState().reminder;
  const d = today();
  if (!r?.on || r.seenDay === d || r.doneDay === d) return;
  import('./push.js').then((m) => m.markSeen()).catch(() => { /* tried again on the next open */ });
}

/**
 * "Delete all" (lib/wipe.js, trust spec TRUST-6): the reminder goes with the device's data. Its row on the server has
 * no student, device or account in it, so the server's own delete cannot find it: lib/push.js disable() deletes it
 * with the id and secret the browser was given, unsubscribes the browser and forgets them (in the iPhone app it
 * cancels the local reminders). A failure never stops the wipe: an unused row is deleted after 45 days anyway.
 */
export async function wipeReminder(load = () => import('./push.js')) {
  if (!useApp.getState().reminder?.on) return;
  try { await (await load()).disable({ quiet: true }); } catch { /* the row expires on the server */ }
}

/**
 * On every path of "delete all", "only this device" too: the browser's copy of the id and secret (IndexedDB
 * madregot-push, read by the service worker) and the browser's push subscription, so no reminder comes to a wiped
 * device (the push service then tells the server the address is gone, and its row is deleted). Never throws.
 */
export async function clearReminderDevice(w = globalThis) {
  try {
    const reg = await w.navigator?.serviceWorker?.getRegistration?.();
    const sub = await reg?.pushManager?.getSubscription?.();
    await sub?.unsubscribe?.();
  } catch { /* nothing to drop */ }
  await new Promise((done) => {
    try {
      const r = w.indexedDB?.deleteDatabase('madregot-push');
      if (!r) { done(); return; }
      r.onsuccess = done; r.onerror = done; r.onblocked = done;
    } catch { done(); }
  });
}

onWipe('push', () => wipeReminder());
onClearDevice('push', () => clearReminderDevice());

/** The words the card and Settings show (STUDENT-11). No plan, no price, no streak. */
export const REMINDER_TEXT = {
  cardTitle: 'רוצים תזכורת קטנה?',
  cardBody: 'הודעה אחת ביום, בשעה שתבחרו. לא בשבת ובחגים, ולא ביום שכבר למדתם.',
  on: 'להפעיל',
  /** The turn-on button once it worked (it says so itself: no toast after it). */
  doneOn: 'התזכורת פועלת',
  no: 'לא, תודה',
  title: 'תזכורת יומית',
  optOn: 'פועלת',
  optOff: 'כבויה',
  slotLabel: 'באיזו שעה?',
  hint: 'הודעה אחת ביום לכל היותר. לא נשלחת בשבת ובחגים, בימי הזיכרון ובתשעה באב, לא אחרי 12:00 בערב שלהם, ולא ביום שכבר למדתם בו.',
  paused: 'עצרנו את התזכורות כי הן לא עזרו בימים האחרונים. אפשר להפעיל אותן שוב מתי שתרצו.',
  denied: 'הדפדפן חוסם התראות מהאתר הזה. אפשר לאפשר אותן בהגדרות הדפדפן, ואז לחזור לכאן.',
  unsupported: 'הדפדפן הזה לא תומך בתזכורות.',
  noServer: 'בגרסה הזו אין תזכורות.',
  ios: 'באייפון התזכורות עובדות אחרי שמוסיפים את מדרגות למסך הבית.',
  /** The iPhone app (local notifications): the app's notifications are off in the phone's settings. */
  deniedApp: 'ההתראות של מדרגות כבויות בהגדרות של האייפון. אפשר להפעיל אותן שם, ואז לחזור לכאן.',
  toastOn: (slot) => `התזכורת תגיע בכל יום ב־${slot}:00`,
  toastOff: 'התזכורות כבויות',
  /** A sample of what arrives (the first of the six texts, shared/reminder.js TEXTS). */
  sample: TEXTS[0],
};
