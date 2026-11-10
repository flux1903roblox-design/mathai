// The app's sync moments, one scheduler for everything that sends or fetches in the background (DURABLE-5): the class
// outbox (DURABLE-7) now, and later the family summary, the vault and error reports. Each subscribes to the moments it
// needs instead of keeping its own timers and listeners:
//   boot     3 s after the app first painted, when the browser is idle
//   visible  the app is back after 60 s or more out of view (pull only)
//   hidden   the app went out of view (visibilitychange) or the page is going away (pagehide): push
//   tick     every 10 minutes while the app is in view
//   online   the browser is back online
//   lesson   30 s after a lesson or a teaching stage was finished today (days[today].lessons or .stages changed): push
// On `hidden` subscribers run in priority order, lowest first (MOMENT_ORDER), all started at once: a page that is
// closing may not wait for one before the next. A subscriber that sends with keepalive claims its bytes from
// keepaliveBudget before its first await, so the claims follow the same order.
import { useEffect } from 'react';
import { useApp, today } from '../store.js';

export const BOOT_DELAY = 3_000;
export const AWAY_FOR = 60_000;
export const TICK_EVERY = 10 * 60_000;
export const LESSON_DELAY = 30_000;
export const MOMENTS = ['boot', 'visible', 'hidden', 'tick', 'online', 'lesson'];

/** Who goes first on `hidden` (lowest first): the family summary, then the class outbox, then the vault. */
export const MOMENT_ORDER = { family: 10, classOutbox: 20, vault: 30, other: 50 };

// ---------------------------------------------------------------- the keepalive budget
/**
 * The bytes a hidden page may still send with `keepalive`. Browsers allow 64 KiB for all keepalive requests in flight
 * together (Firefox enforces it), so one allocator hands out 60,000 bytes per `hidden` moment, in subscriber order.
 * A request that cannot claim is sent as a normal fetch: it may not finish, and its data is sent again at the next moment.
 */
export const KEEPALIVE_BYTES = 60_000;
const encoder = new TextEncoder();
/** The size of a request body as it goes on the wire: UTF-8 bytes, not characters (Hebrew letters are two bytes each). */
export const bodyBytes = (body) => encoder.encode(typeof body === 'string' ? body : JSON.stringify(body)).length;

let budgetLeft = KEEPALIVE_BYTES;
export const keepaliveBudget = {
  /** Take `bytes` from this hidden moment's budget: true if they fit (and are now taken), false if not (nothing taken). */
  claim(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0 || n > budgetLeft) return false;
    budgetLeft -= n;
    return true;
  },
  left: () => budgetLeft,
  /** A new hidden moment: the earlier keepalive requests have finished or were dropped with their page. */
  reset() { budgetLeft = KEEPALIVE_BYTES; },
};

// ---------------------------------------------------------------- subscribers
const subscribers = new Set();

/**
 * Run `fn(moment)` at the given moments (a name or a list). `priority` orders the subscribers of one moment (lowest
 * first). Returns the function that unsubscribes.
 */
export function onMoment(names, fn, { priority = MOMENT_ORDER.other } = {}) {
  const sub = { names: new Set([].concat(names)), fn, priority };
  subscribers.add(sub);
  return () => { subscribers.delete(sub); };
}

/** Start every subscriber of `name` in priority order; resolves when all have finished. A failure stays inside its own subscriber. */
export function emit(name) {
  if (name === 'hidden') keepaliveBudget.reset();
  const list = [...subscribers].filter((s) => s.names.has(name)).sort((a, b) => a.priority - b.priority);
  const runs = list.map((s) => {
    try { return Promise.resolve(s.fn(name)); } catch (e) { return Promise.reject(e); }
  });
  return Promise.allSettled(runs);
}

// ---------------------------------------------------------------- the triggers
/**
 * Listen for the moments (once per app). `doc`, `win` and `store` are the page's own unless a test passes others.
 * Returns the function that stops listening.
 */
export function startMoments({ doc = globalThis.document, win = globalThis.window, store = useApp } = {}) {
  if (!doc || !win) return () => {};
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const visible = () => doc.visibilityState !== 'hidden';

  // boot: after the first paint, when the browser has nothing more urgent to do
  later(() => {
    if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(() => emit('boot'), { timeout: 2_000 });
    else emit('boot');
  }, BOOT_DELAY);

  // hidden and visible (pagehide too: a closing tab does not always change its visibility first)
  let hiddenAt = visible() ? null : Date.now();
  const goHidden = () => {
    if (hiddenAt !== null) return; // already told: visibilitychange and pagehide both fire when a tab closes
    hiddenAt = Date.now();
    emit('hidden');
  };
  const onVisibility = () => {
    if (!visible()) { goHidden(); return; }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away >= AWAY_FOR) emit('visible');
  };
  const onPageShow = () => { if (visible()) hiddenAt = null; };
  const onOnline = () => emit('online');
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', goHidden);
  win.addEventListener('pageshow', onPageShow);
  win.addEventListener('online', onOnline);

  // tick: every 10 minutes, only while the app is in view
  const tick = setInterval(() => { if (visible()) emit('tick'); }, TICK_EVERY);

  // lesson: 30 s after today's finished lessons or teaching stages changed (one moment for a run of them)
  let lessonTimer = null;
  const doneToday = (s) => { const d = s.days?.[today()]; return `${d?.lessons || 0}:${d?.stages || 0}`; };
  let last = doneToday(store.getState());
  const unsubscribe = store.subscribe((s) => {
    const now = doneToday(s);
    if (now === last) return;
    last = now;
    if (lessonTimer === null) lessonTimer = later(() => { lessonTimer = null; emit('lesson'); }, LESSON_DELAY);
  });

  return () => {
    timers.forEach(clearTimeout); timers.clear();
    clearInterval(tick);
    unsubscribe();
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', goHidden);
    win.removeEventListener('pageshow', onPageShow);
    win.removeEventListener('online', onOnline);
  };
}

/** The app mounts this once (App.jsx): the moments run while the app is open. */
export function useMoments() {
  useEffect(() => startMoments(), []);
}
