// Two tabs of the app on one device (DURABLE-2). Both save to the same localStorage key, so without care the last
// writer would replace the other tab's progress (the council's probe: tab A turns the sound off, a stale tab B saves
// and the sound is on again). The write path (storage.js) prevents that in two places:
//   - when another tab saves, the browser fires a `storage` event here (listenTabs). If that save already holds
//     everything this tab has, this tab simply reloads it (a fast-forward, nothing is written back). If the two have
//     diverged (both saved from the same copy), this tab merges the two (mergeTabs, merge.js) and saves the merge;
//   - before every save, the write path checks who saved last (the `<key>:rev` stamp). If it is a tab this one has not
//     seen yet (its event has not arrived), the save is merged with what is stored instead of replacing it.
// A three-way merge needs the copy both sides grew from. Every save carries `meta.seen`: for each tab, the last of its
// saves this one includes. A tab keeps its last few loaded and saved copies, and the base is the newest of them that
// the other side's save includes, so each tab's increments are added once.
// Honest limit: localStorage in Chromium is cached per page and kept in step by messages, so tabs can save within the
// same few milliseconds without seeing each other. The next event or save catches that (nothing is lost); with three
// or more tabs racing in the same instant, an additive counter can at worst be counted twice, never lost.

/** How many saves back a tab's entry in `seen` is kept; older saves are taken as included in every later one. */
export const SEEN_WINDOW = 500;
/** At most this many tabs in `seen` (the newest). */
export const SEEN_MAX = 16;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const top = (seen) => Object.values(seen).reduce((t, r) => (Number.isFinite(r) && r > t ? r : t), 0);

/** The tabs a save includes, by its meta: `seen`, or (a save from before `seen` existed) just its own writer. */
export function seenOf(meta) {
  if (!isObj(meta)) return {};
  if (isObj(meta.seen)) {
    const out = {};
    for (const [t, r] of Object.entries(meta.seen)) if (Number.isFinite(r)) out[t] = r;
    return out;
  }
  const rev = Number(meta.rev) || 0;
  return meta.tab && rev > 0 ? { [meta.tab]: rev } : {};
}

/** Does a save that includes `seen` include the save number `rev` by `tab`? A start with no save (rev 0) always is. */
export function includes(seen, tab, rev) {
  if (!(rev > 0) || tab == null) return true;
  if (Number.isFinite(seen?.[tab])) return seen[tab] >= rev;
  // a tab no longer listed was dropped long ago: its saves are in every save since
  return rev <= top(seen || {}) - SEEN_WINDOW;
}

/** Both sides' tabs, each at its later save. */
export function joinSeen(a, b) {
  const out = { ...(a || {}) };
  for (const [t, r] of Object.entries(b || {})) if (!(out[t] >= r)) out[t] = r;
  return out;
}

/** Drop tabs whose last save is far behind, and keep at most SEEN_MAX. */
export function pruneSeen(seen) {
  const t = top(seen);
  const kept = Object.entries(seen).filter(([, r]) => r > t - SEEN_WINDOW).sort((x, y) => y[1] - x[1]).slice(0, SEEN_MAX);
  return Object.fromEntries(kept);
}

/**
 * What to do with what another tab saved (`theirs`: its meta), given this tab's own: `seen` (what this tab's state
 * includes) and `writer` (the save this tab's state is: `{ tab, rev }`).
 *   'ignore'  this tab already has it
 *   'forward' it holds everything this tab has: load it
 *   'merge'   both have something the other lacks
 */
export function tabAction(theirs, { tab, seen, writer }) {
  if (!isObj(theirs)) return 'ignore';
  const rev = Number(theirs.rev) || 0;
  if (theirs.tab === tab || includes(seen, theirs.tab, rev)) return 'ignore';
  if (includes(seenOf(theirs), writer?.tab, writer?.rev || 0)) return 'forward';
  return 'merge';
}

/**
 * Listen for the other tabs' saves of `key`. `onSave(newValue)` runs for each; a removal (another tab deleted
 * everything) passes null. Returns the function that stops listening.
 */
export function listenTabs({ key, onSave, win = globalThis.window }) {
  if (typeof win?.addEventListener !== 'function') return () => {};
  const on = (e) => {
    if (e.key !== key) return;
    try { if (e.storageArea && win.localStorage && e.storageArea !== win.localStorage) return; } catch { return; }
    onSave(e.newValue ?? null);
  };
  win.addEventListener('storage', on);
  return () => win.removeEventListener('storage', on);
}
