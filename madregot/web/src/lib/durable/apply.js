// Bringing a copy of the progress back onto this device (DURABLE-4): one rule for every restore (the backup file now;
// the vault, the class and the family later), so there is one rule to trust.
//   empty  this device has no progress (no profile, or no XP and no days): the copy replaces it. Nothing was here.
//   same   the copy is the same student's (the same name, or a device tag both copies count XP for): the two are
//          merged with mergeDevices. Nothing is lowered, so there is nothing to undo.
//   other  another student's copy (a sibling's file): never merged, so two children's progress is not mixed. It
//          replaces the progress here only after the student says so ("להחליף"); before that the progress here is
//          kept in quarantine ('before-restore') and can be brought back for 30 days ("לבטל את השחזור האחרון").
//          A device that backed up to the vault is detached from it (its backup settings travel with the quarantined
//          copy and the backup goes off), so the sibling's progress never reaches the first child's vault. Undo brings
//          the old backup settings back and marks the next vault sync to push first (backup.forcePush, read by the
//          vault from DURABLE-5), so a stale copy in the vault cannot be merged back over the undo.
// Every restore is logged first among the learning events, with no content: { e: 'restore', m: source }.
import { useApp } from '../store.js';
import { mergeDevices, noteMerge, dataOf } from './merge.js';
import { snapshotForBackup } from './payload.js';
import { BACKUP_DEFAULTS } from './migrations.js';
import { newTag } from './xp.js';
import { durableQuarantine } from './storage.js';
import { useDurable } from './useDurable.js';
import { logEvent } from '@/learn/analytics.ts';

/** How long a replacing restore can be undone. */
export const UNDO_DAYS = 30;
export const RESTORE_TOAST = 'ההתקדמות חזרה. ממשיכים מאיפה שעצרתם.';
export const UNDO_TOAST = 'השחזור בוטל. חזרנו למה שהיה לפני.';
/** The progress here could not be kept aside, so it was not replaced. */
export const NO_COPY = 'לא הצלחנו לשמור עותק של ההתקדמות שכאן, ולכן לא החלפנו אותה.';
/** The copy kept before the restore is gone (the browser cleared it): there is nothing to go back to. */
export const NO_UNDO = 'אי אפשר לבטל: העותק של מה שהיה לפני לא נמצא במכשיר.';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A name as people write it: no niqqud, one space, no direction marks, any letter case. */
export const normName = (s) => (typeof s === 'string' ? s.normalize('NFKC').replace(/[֑-ׇ‎‏]/g, '').replace(/\s+/g, ' ').trim().toLowerCase() : '');

/** Is there progress on this device: a teacher's classes, or a student's XP or days. */
export function hasProgress(st) {
  if (!isObj(st?.profile)) return false;
  if (st.profile.role === 'teacher') return Array.isArray(st.profile.classes) && st.profile.classes.length > 0;
  return (Number(st.xp) || 0) > 0 || (isObj(st.days) && Object.keys(st.days).length > 0);
}

/** 'empty' | 'same' | 'other': what restoring `incoming` here would do (see the top of this file). */
export function restoreCase(local, incoming) {
  if (!hasProgress(local)) return 'empty';
  const a = normName(local.profile?.name); const b = normName(incoming?.profile?.name);
  if (a && a === b) return 'same';
  const tags = new Set(Object.keys(isObj(local.xpBy) ? local.xpBy : {}));
  if (Object.keys(isObj(incoming?.xpBy) ? incoming.xpBy : {}).some((t) => tags.has(t))) return 'same';
  return 'other';
}

const withEvent = (st, e, at) => (isObj(st.learn) && Array.isArray(st.learn.events) ? { ...st, learn: { ...st.learn, events: logEvent(st.learn.events, e, at) } } : st);
const later = (a, b) => ((typeof a === 'string' ? a : '') >= (typeof b === 'string' ? b : '') ? a ?? null : b ?? null);

/**
 * Restore `incoming` (a backup state, e.g. importBackup(file).state) from `source` ('file', later 'vault' | 'class' |
 * 'family'). `at`: when the copy was made. 'other' replaces only with `replace: true` (the student chose "להחליף").
 * Resolves `{ kind, applied, undo, error? }`. The rest is for tests.
 */
export async function applyRestored(incoming, source, {
  at = null, replace = false, store = useApp, quarantine = durableQuarantine, now = () => new Date(), localAt = useDurable.getState().savedAt,
} = {}) {
  const when = now();
  const stamp = when.toISOString();
  const local = dataOf(store.getState());
  const copy = snapshotForBackup(incoming);
  const kind = restoreCase(local, copy);
  const restoreEvent = { e: 'restore', m: source };
  // what never comes from a copy: this device's tutor, outbox, tag, save prompts and backup settings
  const device = { ai: local.ai, outbox: local.outbox, durable: local.durable, backup: local.backup };

  if (kind === 'empty') {
    store.setState(withEvent({ ...copy, ...device }, restoreEvent, stamp));
    return { kind, applied: true, undo: false };
  }
  if (kind === 'same') {
    // a restore the student asked for brings the copy's progress in even after a reset here (or there): nothing lowered
    const resetAt = later(local.resetAt, copy.resetAt);
    let merged = mergeDevices(withEvent({ ...local, resetAt }, restoreEvent, stamp), { ...copy, resetAt }, { localAt, remoteAt: at });
    merged = noteMerge(merged, source, stamp);
    store.setState(merged);
    return { kind, applied: true, undo: false };
  }
  if (!replace) return { kind, applied: false, undo: false };
  // another student's progress: the progress here is kept aside first, whole (its backup settings with it)
  const kept = await quarantine.keep(JSON.stringify(local), 'before-restore');
  if (!kept) return { kind, applied: false, undo: false, error: NO_COPY };
  const undoUntil = new Date(when.getTime() + UNDO_DAYS * 864e5).toISOString();
  store.setState(withEvent({
    ...copy,
    ai: local.ai,
    outbox: [], // the class answers waiting here are the other student's: they wait in the kept copy
    durable: { ...local.durable, tag: newTag() }, // this device now earns XP for another student: a new counter
    backup: { ...BACKUP_DEFAULTS, undoUntil }, // detached from the vault
  }, restoreEvent, stamp));
  return { kind, applied: true, undo: true };
}

/** Can the last replacing restore still be undone? */
export const canUndo = (st, now = new Date()) => Date.parse(st?.backup?.undoUntil) > now.getTime();

/**
 * "לבטל את השחזור האחרון": the progress kept before the last replacing restore comes back whole, its backup settings
 * included, and the next vault sync pushes before it pulls. Resolves true, or false when the kept copy is gone (then
 * the offer to undo goes too).
 */
export async function undoRestore({ store = useApp, quarantine = durableQuarantine } = {}) {
  const rec = await quarantine.latest('before-restore');
  let st = null;
  try { st = rec ? JSON.parse(rec.value.raw) : null; } catch { st = null; }
  if (!isObj(st)) {
    const b = store.getState().backup;
    store.setState({ backup: { ...BACKUP_DEFAULTS, ...(isObj(b) ? b : {}), undoUntil: null } });
    return false;
  }
  store.setState({ ...st, backup: { ...BACKUP_DEFAULTS, ...(isObj(st.backup) ? st.backup : {}), forcePush: true } });
  await quarantine.drop(rec.key);
  return true;
}
