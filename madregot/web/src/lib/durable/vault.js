// The vault on the device (DURABLE-5): the backup code's copy of the progress on the server, sealed here (crypto.js),
// kept in step at the app's sync moments (moments.js). It runs only when the app has a server and the backup is on.
//   boot, tick, online   pull, then push
//   visible              pull only (the app came back after a minute or more away)
//   lesson, hidden       push (on hidden with keepalive when the server is this page's own address and the bytes fit the
//                        hidden moment's budget, after the family summary and the class outbox)
// Pull: GET /api/vault/rev; when the server's rev is not the one this device has, GET /api/vault, open, migrate, and merge forward
// (applyRestored(…, 'vault', { merge: true }), logged as { e: 'merge', m: 'vault' }). Another student's copy is never
// merged: the backup stops with state 'other_student' and Settings explains. When this device adds nothing to the copy
// it pulled, the pull also counts as pushed, so two devices never send each other the same progress back and forth.
// Push: skipped when the SHA-256 of the copy's JSON is the one pushed last; else sealed and POSTed with ifRev (the
// compare-and-swap). 409: pull, merge and push again, at most 3 times (then 'error', reported as vault/conflict_loop).
// 404 vault_gone (expired or deleted elsewhere): created again with the same code, and Settings says so once.
// 429: back to idle until the next moment, never an error shown to the child. No network: 'offline'.
// After a replacing restore was undone (apply.js, backup.forcePush), the next sync reads the server's rev and pushes
// over it without pulling, so the stale copy there cannot be merged back over the undo.
// Every call carries the identity the device already has (api() adds the class Bearer; X-Family-Device is added here),
// so the server counts its caps per student or family device and a school behind one address is never blocked.
import { useEffect } from 'react';
import { useApp, PERSONAL_KEY } from '../store.js';
import { api, ApiError, hasServer, sameOrigin, errorText } from '../api.js';
import { report } from '../monitor.js';
import { keepaliveBudget, bodyBytes, onMoment, MOMENT_ORDER } from './moments.js';
import { snapshotForBackup } from './payload.js';
import { compactForQuota } from './compact.js';
import { migrate, CURRENT_VERSION, BACKUP_DEFAULTS } from './migrations.js';
import { validateState } from './validate.js';
import { applyRestored, restoreCase } from './apply.js';
import { mergeDevices, dataOf } from './merge.js';
import { useDurable } from './useDurable.js';
import { derive, seal, open, sha256Hex, blobBytes, VaultOpenError } from './crypto.js';
import { makeCode, isCode } from './code.js';

/** The largest sealed copy (binary), as the server takes it. */
export const MAX_BLOB_BYTES = 256 * 1024;
/** Pull, merge and push again after a 409 at most this many times. */
export const CONFLICT_LOOPS = 3;
export const VAULT_MOMENTS = ['boot', 'visible', 'lesson', 'hidden', 'tick', 'online'];

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const backupOf = (store) => ({ ...BACKUP_DEFAULTS, ...(isObj(store.getState().backup) ? store.getState().backup : {}) });
const setBackup = (store, patch) => store.setState({ backup: { ...backupOf(store), ...patch } });
/** The JSON of a copy, with its keys in one order (two copies with the same content compare equal). */
const stable = (v) => JSON.stringify(v, (k, x) => (isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((n) => [n, x[n]])) : x));
/** The SHA-256 a push is compared with: of the JSON of what a backup holds (keys in one order, so a reload that only
 *  reorders them sends nothing). */
export const copyHash = (state) => sha256Hex(stable(snapshotForBackup(state)));

/** The headers of a vault call: the lookup token, and the family device's token when this device is linked. */
function vaultHeaders(st, lookup) {
  const h = { 'X-Vault': lookup };
  const fd = st?.ai?.familyDevice?.token;
  if (fd) h['X-Family-Device'] = fd;
  return h;
}
const call = (store, lookup, path, { method = 'GET', body, keepalive = false } = {}) => api(path, { method, body, keepalive, headers: vaultHeaders(store.getState(), lookup) });

// ---------------------------------------------------------------- the sealed copy
/**
 * The sealed copy of `snap` (a snapshotForBackup): `{ blob }`, or `{ tooBig: true }` when it is over 256 KiB even after
 * compactForQuota (then the app offers the backup file instead).
 */
export async function sealCopy(snap, key, { now = new Date(), rev = null } = {}) {
  const make = (state) => seal({ v: 1, at: now.toISOString(), schema: CURRENT_VERSION, rev, state }, key);
  let blob = await make(snap);
  if (blobBytes(blob) > MAX_BLOB_BYTES) blob = await make(snapshotForBackup(compactForQuota(snap)));
  return blobBytes(blob) > MAX_BLOB_BYTES ? { tooBig: true } : { blob };
}

/** Open a sealed copy: `{ state, at, rev }`, the state brought up to this version and sound; else a VaultOpenError. */
export async function openCopy(blob, key) {
  const p = await open(blob, key);
  if (!isObj(p) || p.v !== 1 || !isObj(p.state)) throw new VaultOpenError('not a backup');
  let state;
  try {
    state = snapshotForBackup(migrate(p.state, Number.isFinite(p.schema) ? p.schema : 0, { personal: PERSONAL_KEY }));
  } catch { throw new VaultOpenError('broken'); }
  if (validateState(state).length) throw new VaultOpenError('broken');
  return { state, at: typeof p.at === 'string' ? p.at : null, rev: Number.isFinite(p.rev) ? p.rev : null };
}

/** Would merging this device into `remote` change it? (false: this device adds nothing the copy does not have) */
function addsSomething(local, remote, { localAt, remoteAt }) {
  const merged = mergeDevices(remote, local, { localAt: remoteAt, remoteAt: localAt });
  return stable(snapshotForBackup(merged)) !== stable(snapshotForBackup(remote));
}

// ---------------------------------------------------------------- the sync engine
/** Pull: 'same' | 'merged' | 'gone' | 'other_student'. */
async function pull(ctx) {
  const { store, lookup, key } = ctx;
  const b = backupOf(store);
  let r;
  try { r = await call(store, lookup, '/api/vault/rev'); } catch (e) {
    if (e?.code !== 'vault_not_found') throw e;
    ctx.gone = true;
    setBackup(store, { rev: null });
    return 'gone';
  }
  // the same rev: nothing new. Any other (newer, or lower: the copy was made again from another device) is read.
  if (b.rev != null && r.rev === b.rev) return 'same';
  const full = await call(store, lookup, '/api/vault');
  const remote = await openCopy(full.blob, key);
  const local = dataOf(store.getState());
  if (restoreCase(local, remote.state) === 'other') {
    setBackup(store, { state: 'other_student' });
    report('vault', { name: 'other_student', message: 'the vault holds another student\'s progress: not merged' });
    return 'other_student';
  }
  const quiet = !addsSomething(local, remote.state, { localAt: useDurable.getState().savedAt, remoteAt: remote.at });
  await applyRestored(remote.state, 'vault', { merge: true, at: remote.at, store });
  const patch = { rev: full.rev };
  // nothing here that the copy lacks: what was pulled counts as pushed (the merge's own log line stays on this device
  // until there is something new to send)
  if (quiet) patch.hash = await copyHash(store.getState());
  setBackup(store, patch);
  return 'merged';
}

/** Push: 'pushed' | 'unchanged' | 'conflict' | 'too_big'. */
async function push(ctx) {
  const { store, lookup, key } = ctx;
  const b = backupOf(store);
  const snap = snapshotForBackup(store.getState());
  const hash = await sha256Hex(stable(snap));
  if (hash === b.hash && b.rev != null) return 'unchanged';
  const sealed = await sealCopy(snap, key, { now: ctx.now(), rev: b.rev });
  if (sealed.tooBig) {
    setBackup(store, { state: 'too_big' });
    report('vault', { name: 'too_big', message: 'the sealed copy is over 256 KiB after compacting' });
    return 'too_big';
  }
  const body = { ifRev: b.rev ?? null, blob: sealed.blob };
  const keepalive = ctx.hidden && sameOrigin() && keepaliveBudget.claim(bodyBytes(body));
  try {
    const r = await call(store, lookup, '/api/vault', { method: 'POST', body, keepalive });
    setBackup(store, { rev: r.rev, hash, at: r.updatedAt || ctx.now().toISOString(), state: 'idle', ...(ctx.gone ? { note: 'recreated' } : {}) });
    ctx.gone = false;
    return 'pushed';
  } catch (e) {
    if (e?.code === 'vault_conflict') return 'conflict';
    if (e?.code === 'vault_gone' && !ctx.gone) {
      // expired, or deleted from another device: made again with the same code
      ctx.gone = true;
      setBackup(store, { rev: null, state: 'gone' });
      return push(ctx);
    }
    throw e;
  }
}

async function pushLoop(ctx) {
  for (let i = 0; ; i += 1) {
    const r = await push(ctx);
    // nothing new to send is a sync that went well too (it may follow an offline or a failed moment)
    if (r === 'unchanged') setBackup(ctx.store, { state: 'idle' });
    if (r !== 'conflict') return r;
    if (i >= CONFLICT_LOOPS) break;
    const p = await pull(ctx);
    if (p === 'other_student') return p;
  }
  setBackup(ctx.store, { state: 'error' });
  report('vault', { name: 'conflict_loop', message: `still in conflict after ${CONFLICT_LOOPS} merges` });
  return 'error';
}

/** What went wrong, as the backup's state (and a report when it is a real failure). */
function failed(store, e) {
  if (e?.code === 'network') { setBackup(store, { state: 'offline' }); return 'offline'; }
  // the server asks to slow down (or this network is out of tries today): quietly, until the next moment
  if (e?.status === 429) { setBackup(store, { state: 'idle' }); return 'idle'; }
  if (e?.code === 'vault_off' || e?.code === 'vault_full') { setBackup(store, { state: 'unavailable' }); return 'unavailable'; }
  setBackup(store, { state: 'error' });
  if (e instanceof VaultOpenError) report('vault', { name: 'open', message: 'the vault could not be opened with this code' });
  else report('vault', { name: e?.code || e?.name || 'Error', message: e instanceof ApiError ? `vault sync failed (${e.status || 'no status'})` : String(e?.message || e) });
  return 'error';
}

async function runSync(moment, store, { online, now }) {
  const b = backupOf(store);
  if (!hasServer() || !b.on || !isCode(b.code)) return 'off';
  // another student's copy: nothing is merged or pushed until the student chooses (Settings)
  if (b.state === 'other_student') return 'other_student';
  if (!online()) { setBackup(store, { state: 'offline' }); return 'offline'; }
  try {
    const { key, lookup } = await derive(b.code);
    const ctx = { store, key, lookup, now, hidden: moment === 'hidden', gone: false };
    if (b.forcePush) {
      // the undo of a replacing restore: push over the server's copy without pulling it
      let rev = null;
      try { rev = (await call(store, lookup, '/api/vault/rev')).rev; } catch (e) { if (e?.code !== 'vault_not_found') throw e; }
      setBackup(store, { rev, hash: null, forcePush: false });
      return await pushLoop(ctx);
    }
    if (moment !== 'lesson' && moment !== 'hidden') {
      const p = await pull(ctx);
      if (p === 'other_student') return p;
    }
    if (moment === 'visible') {
      setBackup(store, { state: 'idle' });
      return 'pulled';
    }
    return await pushLoop(ctx);
  } catch (e) {
    return failed(store, e);
  }
}

let running = null;
/**
 * One sync at a time: a moment that comes while one runs is left to it. `moment`: which moment (see the top of this
 * file). Resolves with what happened: 'off' | 'offline' | 'pulled' | 'pushed' | 'unchanged' | 'too_big' |
 * 'other_student' | 'idle' | 'unavailable' | 'error'. `store`, `online` and `now` are for tests.
 */
export function syncVault({ moment = 'manual', store = useApp, online = () => globalThis.navigator?.onLine !== false, now = () => new Date() } = {}) {
  if (running) return running;
  running = runSync(moment, store, { online, now }).finally(() => { running = null; });
  return running;
}

/** The app mounts this once (App.jsx): while the backup is on, the vault keeps in step at the sync moments. */
export function useVaultSync() {
  const on = useApp((s) => !!s.backup?.on);
  useEffect(() => {
    if (!on || !hasServer()) return undefined;
    return onMoment(VAULT_MOMENTS, (m) => syncVault({ moment: m }), { priority: MOMENT_ORDER.vault });
  }, [on]);
}

// ---------------------------------------------------------------- turning it on and off
/**
 * "ליצור קוד גיבוי": a new code, its keys, the first copy pushed (ifRev null), and the backup on. Resolves the code;
 * rejects with an ApiError ('vault_too_big' when even the compacted copy is too big, or the server's code).
 */
export async function createBackup({ store = useApp, now = () => new Date() } = {}) {
  if (!hasServer()) throw new ApiError('no_server');
  const before = backupOf(store);
  for (let attempt = 0; ; attempt += 1) {
    const code = makeCode();
    const { key, lookup } = await derive(code);
    const snap = snapshotForBackup(store.getState());
    const hash = await sha256Hex(stable(snap));
    const sealed = await sealCopy(snap, key, { now: now() });
    if (sealed.tooBig) {
      report('vault', { name: 'too_big', message: 'the first sealed copy is over 256 KiB after compacting' });
      throw new ApiError('vault_too_big');
    }
    try {
      const r = await call(store, lookup, '/api/vault', { method: 'POST', body: { ifRev: null, blob: sealed.blob } });
      store.setState({ backup: { ...BACKUP_DEFAULTS, undoUntil: before.undoUntil, on: true, code, lookup, rev: r.rev, hash, at: r.updatedAt || now().toISOString(), state: 'idle', note: null } });
      return code;
    } catch (e) {
      // a code that is taken already (one chance in 2^74): another one
      if (e?.code === 'vault_conflict' && attempt === 0) continue;
      throw e;
    }
  }
}

/** "להפסיק את הגיבוי": the copy on the server is deleted, and the backup goes back to off. Rejects when the server could not be reached. */
export async function stopBackup({ store = useApp } = {}) {
  const b = backupOf(store);
  if (b.on && isCode(b.code) && hasServer()) {
    const { lookup } = await derive(b.code);
    await call(store, lookup, '/api/vault/delete', { method: 'POST', body: {} });
  }
  store.setState({ backup: { ...BACKUP_DEFAULTS, undoUntil: b.undoUntil } });
}

// ---------------------------------------------------------------- restoring from a code (the Restore screen)
/**
 * The vault a typed code opens: `{ code, lookup, rev, updatedAt, state, at }`, the state brought up to this version.
 * `code` has passed normalise() already, so a typing mistake never reaches the network. Rejects with the server's
 * ApiError (vault_not_found, too_many_tries, slow_down, network…) or a VaultOpenError (found, but this code does not
 * open it). Nothing on the device changes here.
 */
export async function findVault(code, { store = useApp } = {}) {
  if (!hasServer()) throw new ApiError('no_server');
  const { key, lookup } = await derive(code);
  const r = await call(store, lookup, '/api/vault');
  const copy = await openCopy(r.blob, key);
  return { code, lookup, rev: r.rev, updatedAt: r.updatedAt || null, state: copy.state, at: copy.at };
}

/**
 * After a restore from a code: this device keeps that code and syncs with its vault from now on (the code it had
 * before, if any, is let go without deleting anything). `rev` is the rev of the copy that was restored; the hash is
 * unknown here, so the sync that starts at once (no need to wait for a moment) sends what this device now holds: the
 * restore's own line, and with a merge the progress that was only here.
 */
export function adoptCode({ code, lookup, rev }, { store = useApp, now = () => new Date(), sync = true } = {}) {
  const b = backupOf(store);
  store.setState({ backup: { ...BACKUP_DEFAULTS, undoUntil: b.undoUntil, on: true, code, lookup, rev: rev ?? null, at: now().toISOString(), hash: null, state: 'idle', note: null } });
  return sync ? syncVault({ moment: 'manual', store, now }) : Promise.resolve('off');
}

/** This device lets go of the code without deleting anything on the server (another student's copy stays theirs). */
export function detachBackup({ store = useApp } = {}) {
  const b = backupOf(store);
  store.setState({ backup: { ...BACKUP_DEFAULTS, undoUntil: b.undoUntil } });
}

/** The one-time note in Settings is seen. */
export const clearBackupNote = ({ store = useApp } = {}) => setBackup(store, { note: null });

// ---------------------------------------------------------------- what Settings says
export const BACKUP_TEXT = {
  off: 'כבוי',
  offline: 'פועל · מחכה לאינטרנט',
  tooBig: 'הגיבוי גדול מדי. שמרו קובץ במקום.',
  retry: 'פועל · ננסה לעדכן שוב בקרוב',
  paused: 'מושהה',
  recreated: 'הגיבוי בשרת נמחק או פג, ויצרנו אותו מחדש עם אותו קוד.',
  otherStudent: 'בגיבוי של הקוד הזה יש התקדמות של מישהו אחר, אז לא איחדנו אותה עם מה שיש כאן. אפשר להפסיק את הגיבוי וליצור קוד חדש.',
};

/** The words for a vault call that failed: the vault's own where a code means something else on other screens. */
export function vaultErrorText(e) {
  if (e instanceof VaultOpenError) return errorText('vault_open');
  const code = e?.code;
  if (code === 'too_many_tries') return errorText('vault_tries');
  if (code === 'too_large') return errorText('vault_too_big');
  return errorText(code);
}

/**
 * "עכשיו" within a minute, then "לפני דקה", "לפני 3 דקות", "לפני שעה", "לפני שעתיים", "לפני 5 שעות", "אתמול", "לפני
 * יומיים", "לפני 4 ימים". Written out here: browsers' relative-time formats for Hebrew differ (one writes "(2)").
 */
export function agoText(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  const n = (unit) => Math.floor(s / unit);
  if (s < 60) return 'עכשיו';
  if (s < 3600) return n(60) === 1 ? 'לפני דקה' : `לפני ${n(60)} דקות`;
  if (s < 86400) return n(3600) === 1 ? 'לפני שעה' : n(3600) === 2 ? 'לפני שעתיים' : `לפני ${n(3600)} שעות`;
  return n(86400) === 1 ? 'אתמול' : n(86400) === 2 ? 'לפני יומיים' : `לפני ${n(86400)} ימים`;
}

/** The backup row's words (Settings › שמירת ההתקדמות, and מידע לתמיכה). */
export function backupText(backup, now = Date.now()) {
  if (!backup?.on) return BACKUP_TEXT.off;
  switch (backup.state) {
    case 'offline': return BACKUP_TEXT.offline;
    case 'too_big': return BACKUP_TEXT.tooBig;
    case 'other_student': return BACKUP_TEXT.paused;
    case 'error': case 'unavailable': return BACKUP_TEXT.retry;
    default: return backup.at ? `פועל · עודכן ${agoText(backup.at, now)}` : 'פועל';
  }
}
