// The learning clock (PARENTS-1): minutes on learning screens for the parent's report, kept in days[d].tsecs.
// It counts while (a) the page is visible, (b) the route is a learning screen (LEARN_ROUTE: a lesson, practice, the
// placement test, a repair, an Exam Rescue check or exam, a teaching stage) and (c) the last pointerdown, keydown or
// touchstart was at most 90 s ago. It ticks every 5 s in memory and writes to the store at most once a minute, on a
// route change, and when the page is hidden, so it never rewrites the saved state on every tick. The store caps a day at
// 4 hours (addLearnTime). The time is never called learning, and it never makes a day active (lib/days.js isActiveDay).
// Two tabs add their time (only a visible tab counts); two devices take the larger (lib/durable/merge.js).
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from './store.js';
import { today as localToday } from './days.js';

export const LEARN_ROUTE = /^\/(lesson|practice|placement|repair|rescue\/(check|exam)|learn\/[^/]+\/[^/]+\/[A-E])/;
export const TICK_MS = 5000;
export const IDLE_MS = 90_000;
export const FLUSH_MS = 60_000;
const INPUTS = ['pointerdown', 'keydown', 'touchstart'];

/**
 * The clock without React or the DOM, for the hook below and the tests. `add(day, secs)` receives the counted time;
 * `visible()` says whether the page is visible; `now()` and `today()` are the clock.
 */
export function createLearnClock({ add, visible = () => true, now = () => Date.now(), today = () => localToday() }) {
  let path = '';
  let lastInput = -Infinity;
  let lastFlush = now();
  let pending = 0;
  let pendingDay = null;
  let timer = null;

  const counting = () => visible() && LEARN_ROUTE.test(path) && now() - lastInput <= IDLE_MS;
  /** Hand the counted seconds to the store (`force`: a route change or the page hidden). */
  const flush = (force = false) => {
    if (!force && now() - lastFlush < FLUSH_MS) return;
    lastFlush = now();
    if (pending > 0 && pendingDay) add(pendingDay, pending);
    pending = 0; pendingDay = null;
  };
  const tick = () => {
    if (!counting()) { flush(); return; }
    const day = today();
    if (pendingDay && pendingDay !== day) flush(true); // the seconds before midnight belong to that day
    pendingDay = day;
    pending += TICK_MS / 1000;
    flush();
  };
  return {
    /** The route changed: what was counted on the last screen is written, then this one is watched. */
    route(next) { if (next !== path) { flush(true); path = next || ''; } },
    /** A pointer, key or touch: the student is there. */
    input() { lastInput = now(); },
    /** The page was hidden: write at once. */
    hidden() { flush(true); },
    start() { if (!timer) { lastInput = now(); timer = setInterval(tick, TICK_MS); } },
    stop() { if (timer) { clearInterval(timer); timer = null; } flush(true); },
    tick,
    flush,
    get pending() { return pending; },
  };
}

/** Mounted once for a student (App.jsx Root): counts time on learning screens into days[d].tsecs. */
export function useLearnClock() {
  const { pathname } = useLocation();
  const clock = useRef(null);
  if (!clock.current) {
    clock.current = createLearnClock({
      // a student's time only: after a sign-out the last flush must not reach the next profile on this device
      add: (day, secs) => { const st = useApp.getState(); if (st.profile?.role === 'student') st.addLearnTime(day, secs); },
      visible: () => typeof document === 'undefined' || document.visibilityState === 'visible',
    });
  }
  useEffect(() => {
    const c = clock.current;
    const onInput = () => c.input();
    const onVisibility = () => { if (document.visibilityState === 'hidden') c.hidden(); else c.input(); };
    const onHide = () => c.hidden();
    INPUTS.forEach((t) => window.addEventListener(t, onInput, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    c.start();
    return () => {
      INPUTS.forEach((t) => window.removeEventListener(t, onInput, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      c.stop();
    };
  }, []);
  useEffect(() => { clock.current.route(pathname); }, [pathname]);
}
