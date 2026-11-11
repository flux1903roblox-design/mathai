// The class goal of the week on the student's side (STUDENT-4): GET /api/class/goal, asked when a card that shows it
// mounts and when the app comes back to the screen. The last answer is kept in memory for the cards, and in the store's
// classGoals (8 weeks, saved) for the wardrobe's class scarf and the Sunday recap.
// Nothing is asked for a student with no class or a build with no server; a class whose teacher turned the goal off
// answers { on: false }, and then no card shows at all.
import { useEffect, useSyncExternalStore } from 'react';
import { useApp } from './store.js';
import { api, hasServer, syncNow } from './api.js';
import { weekStart, dayBefore, today } from './streak.js';
import { qaGoal, qaGoalView } from './qaFixtures.js';

let mem = null; // { token, goal } – the last answer and whose it is
let loading = null;
let loadedAt = 0;
const FRESH_MS = 15_000;
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

/**
 * Ask the server for this week's goal (the device's new steps are sent first, so the student's own share counts them).
 * A failure keeps the last answer. `force`: ask even if the last answer is only seconds old.
 */
export function loadClassGoal({ force = false } = {}) {
  const token = useApp.getState().profile?.token;
  if (!token || !hasServer()) return Promise.resolve(null);
  if (loading) return loading;
  if (!force && mem?.token === token && Date.now() - loadedAt < FRESH_MS) return Promise.resolve(mem.goal);
  loading = (async () => {
    try {
      await syncNow();
      const goal = await api('/api/class/goal');
      if (useApp.getState().profile?.token !== token) return null;
      mem = { token, goal }; loadedAt = Date.now();
      useApp.getState().setClassGoal(goal);
      emit();
      return goal;
    } catch {
      return mem?.token === token ? mem.goal : null;
    } finally { loading = null; }
  })();
  return loading;
}

/** For tests: forget the last answer. */
export function resetClassGoal() { mem = null; loading = null; loadedAt = 0; emit(); }

/**
 * This week's class goal for the screen, or null when there is none to show (no class, no server, the goal is off, or
 * the first answer has not come yet). A staging copy can show a fixed state with ?qa-goal=mid|reached|off.
 */
export function useClassGoal() {
  const token = useApp((s) => s.profile?.token);
  const qa = qaGoal();
  const goal = useSyncExternalStore(subscribe, () => (mem && mem.token === token ? mem.goal : null));
  useEffect(() => {
    if (qa || !token) return undefined;
    loadClassGoal();
    const onShow = () => { if (document.visibilityState === 'visible') loadClassGoal({ force: true }); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [token, qa]);
  if (qa) {
    const week = weekStart(today());
    const g = qaGoalView(week, weekStart(dayBefore(week)));
    return g?.on ? g : null;
  }
  if (!token || !hasServer()) return null;
  return goal?.on ? goal : null;
}

/** Days from the week's Sunday to today (0 on Sunday): the line about last week shows Sunday to Tuesday. */
export function dayOfWeek(week, day = today()) {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${week}T12:00:00Z`)) / 864e5);
}
