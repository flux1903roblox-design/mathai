// Registers the service worker (src/sw/sw.js, built by scripts/vite-plugin-sw.mjs) and moves to a new release only
// at a calm moment (DURABLE-10). A new release waits in the background; the app reloads into it only when all of
// these hold: a new worker is waiting, the app has just come back after at least 30 minutes out of sight, and the
// screen is not one where a reload would interrupt (a lesson, a teaching stage, a repair, a check, placement, or a
// screen with typed text or a photo on the way). Then SKIP_WAITING is posted, and once the new worker controls the
// page it reloads, once. Progress is saved as it happens, so the reload loses nothing. Every return to view after a
// minute or more asks the server whether there is a new release (an app left open for days never navigates: hash
// routes). A registration, install or update that fails is reported to the error monitor (kind 'sw'), never shown.
// (The student lane's client, with the family lane's update checks and failure reports merged in.)
import { report } from './monitor.js';

/** How long the app must have been out of view before an update may reload it. */
export const HIDDEN_LONG_MS = 30 * 60 * 1000;
export const UPDATE_AFTER_HIDDEN_MS = HIDDEN_LONG_MS;
/** How long out of view before a return asks for a new release. */
export const CHECK_AFTER_HIDDEN_MS = 60_000;

// Hash routes (App.jsx) where a reload would cut something off: lessons (/lesson, /practice, /placement, the Exam
// Rescue check and exam), a teaching stage (/learn/:topic/:level/:stage), a repair, an exam photo or a new practice
// exam on the way, a question to the tutor being typed (the teacher's tutor too), the parents' forms, a backup code
// being typed (/restore), and the teacher's class settings form.
const BUSY = [
  /^\/(lesson|practice|placement|repair)(\/|\?|$)/,
  /^\/rescue\/(check|exam)(\/|\?|$)/,
  /^\/learn\/[^/?]+\/[^/?]+\/[^/?]+/,
  /^\/exams\/(check|new)(\/|\?|$)/,
  /^\/(assistant|parents|cancel)(\/|\?|$)/,
  // the family lane's restore screen: a backup code being typed (DURABLE-5)
  /^\/restore(\/|\?|$)/,
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

/** The route the app shows: its hash without '#' ('/' when there is none). */
export const routeOf = (hash) => (hash || '').replace(/^#/, '') || '/';
/** The same rule for a location.hash ('#/lesson/signed/1?part=2'). */
export const busyRoute = (hash) => isBusyRoute(routeOf(hash));

/**
 * The update rule: a waiting worker, back after ≥ 30 minutes out of sight, and a calm screen. Takes the time away as
 * hiddenMs (or hiddenFor) and the screen as a route (or a location.hash).
 */
export function shouldUpdate({ waiting, hiddenMs, hiddenFor, route, hash }) {
  const away = hiddenMs ?? hiddenFor ?? 0;
  return !!waiting && away >= HIDDEN_LONG_MS && !isBusyRoute(route ?? routeOf(hash));
}

const fail = (name, e) => report('sw', { name, message: `${name} failed${e?.name ? ` (${e.name})` : ''}` });

/**
 * Watch a registration: the update rule above on every return to view, an update check after a minute away, and the
 * install of each new worker (one that becomes redundant before it was installed failed to install). `doc`, `win`,
 * `sw` (navigator.serviceWorker), `now` and `online` are for tests. Returns a function that stops watching.
 */
export function watchUpdates(reg, {
  win = globalThis.window, doc = win?.document, sw = win?.navigator?.serviceWorker, now = () => Date.now(),
  online = () => globalThis.navigator?.onLine !== false,
} = {}) {
  let hiddenAt = null;
  let applying = false;
  let reloading = false;
  const check = () => {
    if (!online()) return;
    try { Promise.resolve(reg.update()).catch((e) => fail('update', e)); } catch (e) { fail('update', e); }
  };
  const apply = () => {
    const waiting = reg.waiting;
    if (!waiting || applying) return;
    applying = true;
    // reload only for the takeover asked for here (the first install's clients.claim() changes the controller too)
    sw?.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; win.location.reload(); } }, { once: true });
    waiting.postMessage('SKIP_WAITING');
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') { hiddenAt = now(); return; }
    if (hiddenAt == null) return;
    const hiddenMs = now() - hiddenAt;
    hiddenAt = null;
    if (shouldUpdate({ waiting: reg.waiting, hiddenMs, route: routeOf(win.location.hash) })) { apply(); return; }
    if (hiddenMs >= CHECK_AFTER_HIDDEN_MS) check();
  };
  const onFound = () => {
    const w = reg.installing;
    if (!w) return;
    let installed = false;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' || w.state === 'activating' || w.state === 'activated') installed = true;
      else if (w.state === 'redundant' && !installed) fail('install');
    });
  };
  doc.addEventListener('visibilitychange', onVisibility);
  reg.addEventListener?.('updatefound', onFound);
  onFound(); // a worker that was already installing when the watch began
  return () => { doc.removeEventListener?.('visibilitychange', onVisibility); reg.removeEventListener?.('updatefound', onFound); };
}

/**
 * Register the worker now and watch it. Resolves the registration, or null when there is none (a build or a browser
 * without it, VITE_SW=off, or a browser that blocks it, as the end-to-end tests do); a refused registration is
 * reported. registerSW below calls it once the page has loaded.
 */
export async function registerNow({ env = import.meta.env, nav = globalThis.navigator, ...rest } = {}) {
  if (!env.PROD || env.VITE_SW === 'off' || !nav?.serviceWorker) return null;
  const base = env.BASE_URL || '/';
  let reg;
  try {
    reg = await nav.serviceWorker.register(`${base}sw.js`, { scope: base });
  } catch (e) {
    fail('register', e);
    return null;
  }
  if (!reg) return null;
  watchUpdates(reg, { sw: nav.serviceWorker, ...rest });
  return reg;
}

/**
 * Register the worker in a production build, in a browser that has service workers, unless VITE_SW=off (a build
 * that must not keep files, such as the store apps). The scope is the app's folder (BASE_URL), so a copy under a
 * sub-path keeps its own worker. Main.jsx calls it once; the registration waits for the page to finish loading, so the
 * files kept for offline use never compete with the first screen. Returns whether it will register. The arguments
 * exist for the unit tests.
 */
export function registerSW({ env = import.meta.env, win = typeof window === 'undefined' ? undefined : window, now = () => Date.now() } = {}) {
  const nav = win?.navigator;
  if (!env.PROD || env.VITE_SW === 'off' || !nav || !('serviceWorker' in nav)) return false;
  const start = () => { registerNow({ env, nav, win, now }); };
  if (win.document.readyState === 'complete') start();
  else win.addEventListener('load', start, { once: true });
  return true;
}
