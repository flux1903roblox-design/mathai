// The service worker on the page (DURABLE-10, src/sw/sw.js). Registered only in a production build, where the browser
// has service workers, and unless VITE_SW=off, under the app's own base path (BASE_URL: '/' on the Worker, a sub-path
// on GitHub Pages). A new release's worker waits (it never takes over by itself). It is let in only when all hold:
//   - a new worker is waiting;
//   - the app comes back into view after 30 minutes or more out of view (the student had left);
//   - the screen is not a lesson, a teaching stage, a repair, a check or the placement (an update never reloads a
//     student in the middle of one; the progress is saved, so a reload anywhere else loses nothing).
// Then SKIP_WAITING is posted, and once the new worker controls the page it reloads, once. Every return to view after
// a minute or more asks the server whether there is a new release (the browser also asks on each page load).
// A registration, install or update that fails is reported to the error monitor (kind 'sw'), never shown.
import { report } from './monitor.js';

/** How long the app must have been out of view before an update may reload it. */
export const UPDATE_AFTER_HIDDEN_MS = 30 * 60_000;
/** How long out of view before a return asks for a new release. */
const CHECK_AFTER_HIDDEN_MS = 60_000;

/** Routes where an update never reloads: a lesson, practice, the placement, a teaching stage, a repair, a check. */
const BUSY = [
  /^\/lesson\//, /^\/practice\//, /^\/placement(\/|$)/, /^\/learn\/[^/]+\/[^/]+\/[^/]+/, /^\/repair\//,
  /^\/rescue\/(check|exam)(\/|$)/, /^\/exams\/check(\/|$)/,
];
/** The path of a hash route ('#/lesson/signed/1?part=2' → '/lesson/signed/1'). */
const pathOf = (hash) => String(hash ?? '').replace(/^#/, '').split(/[?#]/)[0] || '/';
/** Is the student in the middle of something on this route (`hash`: location.hash)? */
export const busyRoute = (hash) => BUSY.some((re) => re.test(pathOf(hash)));

/** May the waiting worker take over now? */
export const shouldUpdate = ({ waiting, hiddenFor, hash }) => !!waiting && hiddenFor >= UPDATE_AFTER_HIDDEN_MS && !busyRoute(hash);

const fail = (name, e) => report('sw', { name, message: `${name} failed${e?.name ? ` (${e.name})` : ''}` });

/**
 * Watch a registration: the update rule above on every return to view, and the install of each new worker (one that
 * becomes redundant before it was installed failed to install). `doc`, `win`, `sw` (navigator.serviceWorker) and
 * `now` are for tests. Resolves nothing; returns a function that stops watching.
 */
export function watchUpdates(reg, { doc = globalThis.document, win = globalThis.window, sw = globalThis.navigator?.serviceWorker, now = () => Date.now(), online = () => globalThis.navigator?.onLine !== false } = {}) {
  let hiddenAt = null;
  let applying = false;
  const check = () => {
    if (!online()) return;
    try { Promise.resolve(reg.update()).catch((e) => fail('update', e)); } catch (e) { fail('update', e); }
  };
  const apply = () => {
    const waiting = reg.waiting;
    if (!waiting || applying) return;
    applying = true;
    sw?.addEventListener('controllerchange', () => win.location.reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') { hiddenAt = now(); return; }
    if (hiddenAt == null) return;
    const hiddenFor = now() - hiddenAt;
    hiddenAt = null;
    if (shouldUpdate({ waiting: reg.waiting, hiddenFor, hash: win.location.hash })) { apply(); return; }
    if (hiddenFor >= CHECK_AFTER_HIDDEN_MS) check();
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
  reg.addEventListener('updatefound', onFound);
  onFound(); // a worker that was already installing when the watch began
  return () => { doc.removeEventListener('visibilitychange', onVisibility); reg.removeEventListener('updatefound', onFound); };
}

/**
 * Register the worker (main.jsx calls this once). Resolves the registration, or null when there is none (a build or a
 * browser without it, VITE_SW=off, or a browser that blocks it, as the end-to-end tests do).
 */
export async function registerSW({ env = import.meta.env, nav = globalThis.navigator, ...rest } = {}) {
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
