// The daily reminder's light half (STUDENT-11): what is known without loading lib/push.js, which loads on demand.
// - reminderDue(state): LessonDone may offer the reminder once, ever: from the third learning day, on a device and a
//   browser that can take it, where the server has one. Whether the server's switch is on is asked by pushState().
// - remindOnOpen(): the first open of a day tells the server (lib/push.js markSeen) while the reminder is on.
import { useApp, today } from './store.js';
import { hasServer } from './api.js';
import { learnDaysTotal } from './streak.js';

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

/** LessonDone's reminder card may come (the server's answer is asked when the screen opens). */
export function reminderDue({ days = {}, nudges = {}, reminder = {} } = {}, w = globalThis, env = import.meta.env) {
  return learnDaysTotal(days || {}) >= REMINDER.fromDays && !nudges?.pushOffered && !reminder?.on
    && hasServer() && !isIosBrowser(w) && pushSupported(w) && swEnabled(env) && w.Notification.permission !== 'denied';
}

/** The first open of a day (and a return after the day changed), while the reminder is on. Never throws. */
export function remindOnOpen() {
  const r = useApp.getState().reminder;
  const d = today();
  if (!r?.on || r.seenDay === d || r.doneDay === d) return;
  import('./push.js').then((m) => m.markSeen()).catch(() => { /* tried again on the next open */ });
}

/** The words the card and Settings show (STUDENT-11). No plan, no price, no streak. */
export const REMINDER_TEXT = {
  cardTitle: 'רוצים תזכורת קטנה?',
  cardBody: 'הודעה אחת ביום, בשעה שתבחרו. לא בשבת ובחגים, ולא ביום שכבר למדתם.',
  on: 'להפעיל',
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
  toastOn: (slot) => `התזכורת תגיע בכל יום ב־${slot}:00`,
  toastOff: 'התזכורות כבויות',
  /** A sample of what arrives (the first of the server's six texts, worker/src/push.js TEXTS). */
  sample: 'חמש דקות של מתמטיקה? מדי מחכה עם תרגיל קצר.',
};
