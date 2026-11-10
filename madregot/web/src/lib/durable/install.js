// The iPhone Home Screen guide (DURABLE-3): when to offer it. Safari may delete a site's data after seven days of Safari
// use without it; an app added to the Home Screen is not deleted that way, but it keeps its data apart from Safari, so
// the guide first makes sure the progress can travel (InstallSheet).
//   - Settings › שמירת ההתקדמות always has the row "להוסיף למסך הבית" on an iPhone or iPad in the browser;
//   - Learn shows one quiet card from the 3rd day the student learned, when there is progress and the guide was not
//     offered in the last 30 days (durable.installHintAt). Never in a lesson.
import { isActiveDay } from '../store.js';

export const HINT_DAYS = 30;
export const CARD_FROM_DAY = 3;

/** An iPhone, iPod or iPad (an iPad asks for the desktop site: a Mac user agent with a touch screen). */
export function isIos(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || '');
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && Number(nav?.maxTouchPoints) > 1);
}

/** The app was opened from the Home Screen (its own window), not in the browser. */
export function isStandalone({ win = globalThis.window, nav = globalThis.navigator } = {}) {
  try { if (win?.matchMedia?.('(display-mode: standalone)')?.matches) return true; } catch { /* no matchMedia */ }
  return nav?.standalone === true;
}

/** The guide applies here: iOS, in the browser. */
export const guideHere = ({ win = globalThis.window, nav = globalThis.navigator } = {}) => isIos(nav) && !isStandalone({ win, nav });

/** The days the student learned on (a finished lesson, check or teaching stage). */
export const activeDays = (days) => Object.values(days && typeof days === 'object' ? days : {}).filter(isActiveDay).length;
export const hasProgress = (st) => activeDays(st?.days) > 0 || (Number(st?.xp) || 0) > 0;

/** The guide was offered less than 30 days ago. */
export function hintedRecently(installHintAt, now = new Date()) {
  const t = Date.parse(installHintAt);
  return Number.isFinite(t) && now.getTime() - t < HINT_DAYS * 864e5;
}

/** Learn's card: an iPhone in the browser, a student with progress since the 3rd day they learned, not offered lately. */
export function showLearnCard(st, { win = globalThis.window, nav = globalThis.navigator, now = new Date() } = {}) {
  return st?.profile?.role === 'student' && guideHere({ win, nav }) && hasProgress(st)
    && activeDays(st.days) >= CARD_FROM_DAY && !hintedRecently(st.durable?.installHintAt, now);
}
