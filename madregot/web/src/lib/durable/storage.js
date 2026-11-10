// The safe write path for the student's progress (DURABLE-1): the storage zustand's persist middleware saves through.
// The progress stays one localStorage key in zustand's `{ state, version }` format (the browser tests read it as it
// is), with a `meta` block beside it:
//   meta = { rev, at, tab, parent: { rev, tab }, keyAt: { [top-level key]: when this device last changed it }, app }
// and the revision alone under `<key>:rev`. What it adds:
//   - one write per tick: several set() calls in one tick are saved once (a microtask), and a pending write is saved at
//     once when the page is hidden or closed;
//   - a full storage never breaks the app: the save is made smaller once (compact.js), then kept in the copy on the
//     device (IndexedDB, idb.js) instead; only when that fails too does the app say that nothing is saved;
//   - saved data that cannot be read (not JSON, or written by a newer build) is kept in quarantine before anything
//     else happens, and the copy on the device brings the progress back;
//   - "delete all" deletes the copy and the quarantine too (durableWipe).
// Two tabs of the same app: each write records the revision it was based on (meta.parent) and counts past a revision
// another tab wrote meanwhile; when that happens the last writer wins, as it always has.
import { compactForQuota } from './compact.js';
import { createIdb, browserBackend } from './idb.js';
import { useDurable } from './useDurable.js';
import { CURRENT_VERSION } from './migrations.js';
import { randomHex } from '../random.js';

/** The saved-state key (a staging copy on the same address keeps its own); the parent session lives beside it. */
export const STORE_KEY = import.meta.env.VITE_STORE_KEY || 'madregot';
/** The build that wrote a save: the git commit it was built from (vite.config.js), or 'dev'. */
/* global __RELEASE__ */
export const RELEASE = typeof __RELEASE__ === 'string' && __RELEASE__ ? __RELEASE__ : 'dev';
/** How long the first screen waits for the copy on the device before it shows what localStorage has. */
export const BOOT_WAIT = 300;
/** The copy is written this long after the last save (and at once when the page is hidden or closed). */
export const MIRROR_DELAY = 1000;

/** A full storage, in the words each browser uses for it. */
export const isQuotaError = (e) => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

/** The page's localStorage, or null when the browser lets nothing be saved. A full one is still used (it can be read). */
export function pageStorage() {
  let s;
  try { s = globalThis.localStorage; s.getItem('__t'); } catch { return null; }
  if (!s) return null;
  try { s.setItem('__t', '1'); s.removeItem('__t'); } catch (e) { if (!isQuotaError(e)) return null; }
  return s;
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A saved value read as zustand's envelope, or null when it is not one. */
function envelope(raw) {
  if (typeof raw !== 'string') return null;
  let v;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!isObj(v) || !isObj(v.state) || typeof v.version !== 'number') return null;
  return v;
}

/**
 * Which copy the app starts from: the key (localStorage) as it was read first, or the copy on the device.
 * - the copy, when the key is missing or cannot be read;
 * - the key, when it has no `meta`: an older build (or a test) wrote it, after any copy this build made;
 * - otherwise the one with the higher revision (the key when they are equal).
 * `key`: { kind: 'missing' | 'corrupt' | 'ok', rev, meta }; `mirror`: { rev } or null.
 */
export function pickStart(key, mirror) {
  if (!mirror) return 'key';
  if (key.kind === 'missing' || key.kind === 'corrupt') return 'mirror';
  if (!key.meta) return 'key';
  return mirror.rev > key.rev ? 'mirror' : 'key';
}

/**
 * The write path for one key. `ls`: a Storage, or null (nothing can be saved: memory only); `idb`: createIdb(…) or null;
 * `status`: the zustand store that shows health (useDurable). The rest is for tests.
 */
export function createDurable({
  key, version = CURRENT_VERSION, ls, idb = null, status = useDurable, release = RELEASE,
  now = () => new Date(), tab = randomHex(4), bootWait = BOOT_WAIT, mirrorDelay = MIRROR_DELAY,
}) {
  const REV = `${key}:rev`;
  const memory = ls ? null : new Map();
  let store = null; // the zustand store saved here (bind), for a restore from the copy
  let pending = null; // the value zustand asked to save, waiting for this tick's flush
  let scheduled = false;
  let wiped = false; // after "delete all", nothing is written again for the rest of the page's life
  let applying = false; // a restore is being applied: memory and storage already agree
  let override = null; // what getItem reads instead of the key while a restore is applied
  let first = null; // what the first read of the key found: { kind, rev, meta, raw }
  let loadedRev = 0; // the revision this tab's state is based on
  let lastWriterTab = null;
  let lastLoaded = null; // the state as last read (the base for a merge between tabs)
  let lastWritten = null; // the state as this tab last saved it
  let keyAt = {};
  let lastRaw = null; let lastRev = 0; // the newest saved JSON, for the copy
  let mirrored = null; // the JSON the copy holds
  let mirrorTimer = null;
  let bootRead = null; let bootDone = !idb; // writes to the copy wait until boot has read it
  const quarantined = new Set();

  const setStatus = (patch) => status.setState(patch);
  const iso = () => now().toISOString();
  const readRaw = () => { try { return ls ? ls.getItem(key) : memory.get(key) ?? null; } catch { return null; } };
  const readRev = () => { try { const n = Number(ls ? ls.getItem(REV) : memory.get(REV)); return Number.isFinite(n) && n > 0 ? n : 0; } catch { return 0; } };
  const keep = (raw, reason, v) => {
    if (!idb || quarantined.has(raw)) return;
    quarantined.add(raw);
    idb.quarantine(raw, reason, v, iso()).catch(() => {});
  };
  if (!ls) setStatus({ health: 'memory' });

  // ------------------------------------------------------------------ reading
  function getItem() {
    const raw = override ?? readRaw();
    const env = envelope(raw);
    if (!first) {
      const m = isObj(env?.meta) ? env.meta : null;
      first = { kind: raw == null ? 'missing' : env ? 'ok' : 'corrupt', rev: Number(m?.rev) || 0, meta: m, raw };
    }
    if (raw == null) return null;
    if (!env) { keep(raw, 'parse', null); return null; }
    // written by a newer build: kept as it was before this build migrates (and later saves) it
    if (env.version > version) keep(raw, 'future-version', env.version);
    const meta = isObj(env.meta) ? env.meta : null;
    loadedRev = Math.max(loadedRev, Number(meta?.rev) || 0);
    lastWriterTab = meta?.tab ?? null;
    keyAt = isObj(meta?.keyAt) ? { ...meta.keyAt } : {};
    lastLoaded = env.state; lastWritten = env.state;
    return { state: env.state, version: env.version };
  }

  // ------------------------------------------------------------------ writing
  function setItem(_name, value) {
    if (wiped) return;
    if (applying) { pending = null; return; }
    pending = value;
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  }

  /** Save what is pending now. Never throws: a full or broken storage shows in `health`. */
  function flush() {
    scheduled = false;
    const value = pending; pending = null;
    if (!value || wiped) return;
    const at = iso();
    const { state } = value;
    // another tab may have written since this one loaded (storedRev > loadedRev): its revision is counted past, and
    // the last writer wins
    const rev = Math.max(readRev(), loadedRev) + 1;
    const nextKeyAt = { ...keyAt };
    for (const [k, v] of Object.entries(state)) if (typeof v !== 'function' && (!lastWritten || lastWritten[k] !== v)) nextKeyAt[k] = at;
    const meta = { rev, at, tab, parent: { rev: loadedRev, tab: lastWriterTab }, keyAt: nextKeyAt, app: release };
    let raw = JSON.stringify({ state, version: value.version, meta });
    let ok = put(raw, rev);
    if (ok === 'quota') { raw = JSON.stringify({ state: compactForQuota(state), version: value.version, meta }); ok = put(raw, rev); }
    keyAt = nextKeyAt; loadedRev = rev; lastWriterTab = tab; lastWritten = state;
    lastRaw = raw; lastRev = rev;
    if (!ls) { setStatus({ health: 'memory', savedAt: at }); return; }
    if (ok === true) { setStatus({ health: 'ok', savedAt: at }); scheduleMirror(); return; }
    // localStorage could not take it: the copy on the device, at once
    clearTimeout(mirrorTimer); mirrorTimer = null;
    mirrorNow().then((saved) => { if (lastRev === rev && !wiped) setStatus(saved ? { health: 'mirror', savedAt: at } : { health: 'full' }); });
  }

  /** Write the key, then its revision: true, or 'quota' / 'error'. */
  function put(raw, rev) {
    if (!ls) { memory.set(key, raw); memory.set(REV, String(rev)); return true; }
    try { ls.setItem(key, raw); } catch (e) { return isQuotaError(e) ? 'quota' : 'error'; }
    try { ls.setItem(REV, String(rev)); } catch { /* a few bytes: without it the next write still counts on from this tab */ }
    return true;
  }

  function scheduleMirror() {
    if (!idb || wiped) return;
    clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(() => { mirrorTimer = null; mirrorNow(); }, mirrorDelay);
  }

  /** Bring the copy up to the newest save. Resolves true when the copy holds it. */
  async function mirrorNow() {
    if (!idb || wiped) return false;
    // never write over the copy before boot has read it (and maybe started from it: then that is the newest save)
    if (!bootDone) await bootRead;
    if (wiped) return false;
    if (!lastRaw || lastRaw === mirrored) return !!lastRaw;
    const raw = lastRaw; const rev = lastRev;
    try { await idb.writeMirror(raw, rev, iso()); } catch { return false; }
    if (lastRaw === raw) mirrored = raw;
    return true;
  }

  /** The page is being hidden or closed: save what is pending, and the copy, now. */
  function flushNow() {
    if (pending) flush();
    if (mirrorTimer) { clearTimeout(mirrorTimer); mirrorTimer = null; }
    mirrorNow();
  }

  function removeItem() {
    pending = null;
    clearTimeout(mirrorTimer); mirrorTimer = null;
    lastRaw = null; mirrored = null;
    try { if (ls) { ls.removeItem(key); ls.removeItem(REV); } else { memory.delete(key); memory.delete(REV); } } catch { /* blocked */ }
    idb?.deleteMirror().catch(() => {});
  }

  // ------------------------------------------------------------------ boot
  /** Start from the copy on the device: write it back to the key if there is room, and load it into the store. */
  function restore(mirror, env) {
    pending = null;
    let wroteBack = false;
    const rev = Math.max(mirror.rev, readRev());
    if (ls) {
      try { ls.setItem(key, mirror.raw); ls.setItem(REV, String(rev)); wroteBack = true; } catch { /* still full */ }
    }
    override = mirror.raw;
    applying = true;
    try { store?.persist.rehydrate(); } finally { applying = false; override = null; }
    loadedRev = Math.max(loadedRev, rev);
    lastRaw = mirror.raw; lastRev = mirror.rev; mirrored = mirror.raw;
    // a key that was lost or broken is news worth a word; a copy that is newer only because storage is full is not
    const noted = first.kind !== 'ok' || wroteBack;
    setStatus({ restoredFrom: 'mirror', restoreNote: noted, health: wroteBack ? 'ok' : 'mirror', savedAt: env.meta?.at ?? null });
  }

  /** Compare the copy with what the key held at the start, and start from the newer one. */
  function decide(m) {
    if (wiped || !first) return;
    const env = m ? envelope(m.raw) : null;
    const mirror = env ? { raw: m.raw, rev: Number(m.rev) || Number(env.meta?.rev) || 0 } : null;
    if (pickStart(first, mirror) === 'mirror') { restore(mirror, env); return; }
    // the key is the newest: the copy is brought up to it (a key without meta has revision 0)
    if (first.kind === 'ok' && (!mirror || !first.meta || mirror.rev < first.rev) && !lastRaw) {
      lastRaw = first.raw; lastRev = first.rev;
      mirrorNow();
    }
  }

  /**
   * Before the first screen: read the copy on the device (at most BOOT_WAIT ms) and start from the newer one; a copy
   * that answers later is applied when it arrives. Old quarantine records go. Listens for the page being hidden.
   */
  async function boot({ win = globalThis.window, doc = globalThis.document } = {}) {
    if (typeof doc?.addEventListener === 'function') doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') flushNow(); });
    if (typeof win?.addEventListener === 'function') win.addEventListener('pagehide', flushNow);
    if (!ls || !idb || wiped) { bootDone = true; return; }
    if (!first) getItem(); // the store reads the key when it is created; a store not bound yet reads it here
    bootRead = idb.readMirror().then((m) => m, () => null).finally(() => { bootDone = true; });
    const TIMEOUT = Symbol('timeout');
    let timer;
    const won = await Promise.race([bootRead, new Promise((r) => { timer = setTimeout(() => r(TIMEOUT), bootWait); })]);
    clearTimeout(timer);
    if (won === TIMEOUT) bootRead.then(decide);
    else decide(won);
    bootRead.then(() => idb.pruneQuarantine(iso())).catch(() => {});
  }

  /** "Delete all": the key, its revision, the copy and the quarantine go, and nothing is written again on this page. */
  async function wipe() {
    wiped = true; pending = null;
    clearTimeout(mirrorTimer); mirrorTimer = null;
    try { if (ls) { ls.removeItem(key); ls.removeItem(REV); } else memory.clear(); } catch { /* blocked */ }
    try { await idb?.destroy(); } catch { /* nothing to delete */ }
  }

  return {
    storage: { getItem, setItem, removeItem },
    bind(s) { store = s; },
    boot,
    wipe,
    flushNow,
    /** What this tab last read and last wrote, and the revision it is based on: the base of a merge between tabs. */
    snapshot: () => ({ loadedRev, lastWriterTab, lastLoaded, lastWritten }),
  };
}

// ------------------------------------------------------------------ the app's own
const durable = createDurable({ key: STORE_KEY, ls: pageStorage(), idb: createIdb(browserBackend(`${STORE_KEY}-durable`)) });
/** The storage for zustand's persist (store.js). */
export const durableStorage = durable.storage;
/** store.js hands its store over, so a restore from the copy can load into it. */
export const bindDurableStore = (s) => durable.bind(s);
/** Awaited in main.jsx before the first render. Never rejects. */
export const durableBoot = () => durable.boot().catch(() => {});
/** "Delete all" (Settings): after it, the page must be reloaded. */
export const durableWipe = () => durable.wipe();
