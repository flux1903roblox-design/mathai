// When the app asks, once in a while, whether to keep a backup (DURABLE-5, components/durable/BackupNudge.jsx). It asks
// only when all of these hold:
//   - the app has a server (the backup code needs one; without it the backup file is in Settings);
//   - no backup code and no copy kept for the student by the class or the family (backup.escrow);
//   - the student learned on 2 different days (a lesson, a check or a teaching stage finished);
//   - the screen is a calm one: the map, the missions, the topics or "אני". Never a lesson, a teaching stage, a repair,
//     a check, Settings or a screen of its own (restore, parents);
//   - it asked fewer than 2 times, and not in the last 14 days (durable.nudgeCount, durable.nudgeAt).
// Asking counts when the sheet opens, so a reload does not ask again.
import { activeDays } from './install.js';

export const NUDGE_FROM_DAYS = 2;
export const NUDGE_MAX = 2;
export const NUDGE_GAP_DAYS = 14;
/** The screens the question may open on: the tabs where nothing is in progress. */
const CALM = /^\/(quests|topics|me)?$/;

/** May the question open on this screen? */
export const calmRoute = (pathname) => CALM.test(String(pathname ?? ''));

/** Should the app ask now? `st`: the app's state; `server`: hasServer(). */
export function shouldNudge(st, { pathname, server, now = new Date() }) {
  if (!server || st?.profile?.role !== 'student') return false;
  if (st.backup?.on || st.backup?.escrow) return false;
  if (activeDays(st.days) < NUDGE_FROM_DAYS) return false;
  if (!calmRoute(pathname)) return false;
  const count = Number(st.durable?.nudgeCount) || 0;
  if (count >= NUDGE_MAX) return false;
  const at = Date.parse(st.durable?.nudgeAt);
  return !(Number.isFinite(at) && now.getTime() - at < NUDGE_GAP_DAYS * 864e5);
}

/** The question opened now: counted, with its time. */
export const noteNudge = (store, now = new Date()) => store.setState((s) => ({
  durable: { ...s.durable, nudgeCount: (Number(s.durable?.nudgeCount) || 0) + 1, nudgeAt: now.toISOString() },
}));
