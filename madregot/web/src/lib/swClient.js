// Registers the service worker (src/sw/sw.js, built by scripts/vite-plugin-sw.mjs) and moves to a new release only
// at a calm moment (DURABLE-10). A new release waits in the background; the app reloads into it only when all of
// these hold: a new worker is waiting, the app has just come back after at least 30 minutes out of sight, and the
// screen is not one where a reload would interrupt (a lesson, a teaching stage, a repair, a check, placement, or a
// screen with typed text or a photo on the way). Progress is saved as it happens, so the reload loses nothing.

export const HIDDEN_LONG_MS = 30 * 60 * 1000;

// Hash routes (App.jsx) where a reload would cut something off: lessons (/lesson, /practice, /placement, the Exam
// Rescue check and exam), a teaching stage (/learn/:topic/:level/:stage), a repair, an exam photo or a new practice
// exam on the way, a question to the tutor being typed (the teacher's tutor too), the parents' forms, and the
// teacher's class settings form.
const BUSY = [
  /^\/(lesson|practice|placement|repair)(\/|\?|$)/,
  /^\/rescue\/(check|exam)(\/|\?|$)/,
  /^\/learn\/[^/?]+\/[^/?]+\/[^/?]+/,
  /^\/exams\/(check|new)(\/|\?|$)/,
  /^\/(assistant|parents|cancel)(\/|\?|$)/,
  /^\/teacher\/(assistant|settings)(\/|\?|$)/,
  // the teacher lane's later screens: a class exam being built (TEACHER-3), and a class exam a student is solving (TEACHER-5)
  /^\/teacher\/exam\/new(\/|\?|$)/,
  /^\/class\/exam\/[^/?]+\/run(\/|\?|$)/,
];

/** Whether a reload on this route (the hash path, e.g. '/lesson/signed/1') would interrupt the student. */
export function isBusyRoute(route) {
  const r = String(route || '/');
  return BUSY.some((re) => re.test(r));
}

/** The update rule: a waiting worker, back after ≥ 30 minutes out of sight, and a calm screen. */
export function shouldUpdate({ waiting, hiddenMs, route }) {
  return !!waiting && hiddenMs >= HIDDEN_LONG_MS && !isBusyRoute(route);
}

/** The route the app shows: its hash without '#' ('/' when there is none). */
export const routeOf = (hash) => (hash || '').replace(/^#/, '') || '/';

/**
 * Register the worker in a production build, in a browser that has service workers, unless VITE_SW=off (a build
 * that must not keep files, such as the store apps). The scope is the app's folder (BASE_URL), so a copy under a
 * sub-path keeps its own worker. The arguments exist for the unit tests.
 */
export function registerSW({ env = import.meta.env, win = typeof window === 'undefined' ? undefined : window, now = () => Date.now() } = {}) {
  const nav = win?.navigator;
  if (!env.PROD || env.VITE_SW === 'off' || !nav || !('serviceWorker' in nav)) return false;
  const base = env.BASE_URL || '/';
  const start = () => {
    nav.serviceWorker.register(`${base}sw.js`, { scope: base }).then((reg) => watch(reg, { win, nav, now })).catch(() => { /* the app works without it */ });
  };
  // after the page has loaded, so the files kept for offline use never compete with the first screen
  if (win.document.readyState === 'complete') start();
  else win.addEventListener('load', start, { once: true });
  return true;
}

function watch(reg, { win, nav, now }) {
  let hiddenAt = null;
  let reloading = false;
  win.document.addEventListener('visibilitychange', () => {
    if (win.document.visibilityState === 'hidden') { hiddenAt = now(); return; }
    if (hiddenAt === null) return;
    const hiddenMs = now() - hiddenAt;
    hiddenAt = null;
    if (shouldUpdate({ waiting: reg.waiting, hiddenMs, route: routeOf(win.location.hash) })) {
      // reload only for the takeover asked for here (the first install's clients.claim() changes the controller too)
      nav.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; win.location.reload(); } });
      reg.waiting.postMessage('SKIP_WAITING');
    } else if (hiddenMs >= HIDDEN_LONG_MS) {
      // an app left open for days never navigates (hash routes): look for a new release, kept waiting for next time
      reg.update().catch(() => {});
    }
  });
}
