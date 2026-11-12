// When the app asks, once in a while, whether to keep a backup (DURABLE-5, components/durable/BackupNudge.jsx). Since
// COUNCIL2-24 a solo student's backup is on by default (vault.js defaultBackup), so this is the reminder for the rest:
// a backup that was stopped, one that could not start, and students from before the default. It keeps reminding, 14
// days apart, until a backup or an install exists (it used to stop after two asks). It asks only when all of these hold:
//   - the app has a server (the backup code needs one; without it the backup file is in Settings);
//   - no backup code and no copy kept for the student by the class or the family (backup.escrow);
//   - the app is not installed: not opened from the Home Screen (its own window) and not the store app, where the
//     browser does not clear the data on its own;
//   - the student learned on 2 different days (a lesson, a check or a teaching stage finished);
//   - the screen is a calm one: the map, the missions, the topics or "אני". Never a lesson, a teaching stage, a repair,
//     a check, Settings or a screen of its own (restore, parents);
//   - it did not ask in the last 14 days (durable.nudgeAt; durable.nudgeCount counts the asks, and no longer limits them).
// Asking counts when the sheet opens, so a reload does not ask again.
import { activeDays, isStandalone } from './install.js';
import { isNativeApp } from '../native.js';

export const NUDGE_FROM_DAYS = 2;
export const NUDGE_GAP_DAYS = 14;
/** The screens the question may open on: the tabs where nothing is in progress. */
const CALM = /^\/(quests|topics|me)?$/;

/** May the question open on this screen? */
export const calmRoute = (pathname) => CALM.test(String(pathname ?? ''));

/** The app is installed here: opened from the Home Screen in its own window, or the store app. */
export const installedHere = () => isStandalone() || isNativeApp();

/**
 * Should the app ask now? `st`: the app's state; `server`: hasServer(); `installed`: installedHere() (the caller reads
 * it, so a test can say either).
 */
export function shouldNudge(st, { pathname, server, installed = false, now = new Date() }) {
  if (!server || st?.profile?.role !== 'student') return false;
  if (st.backup?.on || st.backup?.escrow || installed) return false;
  if (activeDays(st.days) < NUDGE_FROM_DAYS) return false;
  if (!calmRoute(pathname)) return false;
  const at = Date.parse(st.durable?.nudgeAt);
  return !(Number.isFinite(at) && now.getTime() - at < NUDGE_GAP_DAYS * 864e5);
}

/** The question opened now: counted, with its time. */
export const noteNudge = (store, now = new Date()) => store.setState((s) => ({
  durable: { ...s.durable, nudgeCount: (Number(s.durable?.nudgeCount) || 0) + 1, nudgeAt: now.toISOString() },
}));
