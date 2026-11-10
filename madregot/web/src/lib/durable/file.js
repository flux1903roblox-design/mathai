// A backup file anyone can keep (DURABLE-4): the student's progress as one JSON file, with no server and no account.
// Saving shares the file where the browser can (a phone's share sheet: send it to a parent, keep it in Files) and
// downloads it everywhere else. Restoring reads a file back: it must be small enough, be JSON, say it is a Madregot
// backup, and come out of the migrations sound (validateState); anything else is refused whole with a plain message,
// so a broken or foreign file is never half applied. What a file holds is payload.js's.
//   file = { app: 'madregot', kind: 'backup', v: 1, at, schema, release, state }
import { snapshotForBackup } from './payload.js';
import { migrate, CURRENT_VERSION } from './migrations.js';
import { validateState } from './validate.js';
import { RELEASE } from './storage.js';
import { PERSONAL_KEY } from '../store.js';

/** The largest file read (a heavy year is about half a megabyte). */
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
export const SHARE_TITLE = 'גיבוי מדרגות';
export const SHARE_TEXT = 'קובץ הגיבוי של מדרגות. שמרו אותו. כדי לשחזר: מדרגות ← הגדרות ← שמירת ההתקדמות ← לשחזר מקובץ.';
/** Why a file was refused, in the words the student sees. */
export const FILE_ERRORS = {
  size: 'הקובץ גדול מדי.',
  foreign: 'הקובץ הזה לא נראה כמו גיבוי של מדרגות.',
  broken: 'הקובץ פגום, ואי אפשר לשחזר ממנו. נסו קובץ אחר.',
};

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** The local date as YYYY-MM-DD (as the store keys its days). */
const dayOf = (d) => d.toLocaleDateString('en-CA');

/** madregot-<name, or גיבוי>-<YYYY-MM-DD>.json, with nothing a file system refuses. */
export function backupName(state, now = new Date()) {
  const raw = typeof state?.profile?.name === 'string' ? state.profile.name : '';
  const name = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-').slice(0, 30);
  return `madregot-${name || 'גיבוי'}-${dayOf(now)}.json`;
}

/** The file's text. */
export function backupJson(state, { now = new Date(), release = RELEASE } = {}) {
  return JSON.stringify({ app: 'madregot', kind: 'backup', v: 1, at: now.toISOString(), schema: CURRENT_VERSION, release, state: snapshotForBackup(state) });
}

/** Save through an <a download> (parent.js exportData does the same). */
function download(blob, name, doc) {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url; a.download = name;
  doc.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Save the backup file: through the share sheet where the browser can share files, else as a download. Resolves
 * 'shared', 'downloaded' or 'cancelled' (the student closed the share sheet). Call it straight from the tap: sharing
 * needs the tap's user activation.
 */
export async function exportBackup(state, { nav = globalThis.navigator, doc = globalThis.document, now = new Date() } = {}) {
  const name = backupName(state, now);
  const text = backupJson(state, { now });
  const file = new File([text], name, { type: 'application/json' });
  let canShare = false;
  try { canShare = typeof nav?.share === 'function' && typeof nav?.canShare === 'function' && nav.canShare({ files: [file] }); } catch { canShare = false; }
  if (canShare) {
    try {
      await nav.share({ files: [file], title: SHARE_TITLE, text: SHARE_TEXT });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // the share sheet could not open (no user activation left, or a policy): the download still works
    }
  }
  download(file, name, doc);
  return 'downloaded';
}

const refuse = (reason) => ({ ok: false, reason, message: FILE_ERRORS[reason] });

/**
 * Read a backup file (a File or Blob). `{ ok: true, state, at, release }`, with the state brought up to this version and
 * without anything device-only, or `{ ok: false, reason: 'size' | 'foreign' | 'broken', message }`.
 */
export async function importBackup(file) {
  if (!file || typeof file.size !== 'number') return refuse('broken');
  if (file.size > BACKUP_MAX_BYTES) return refuse('size');
  let data;
  try { data = JSON.parse(await file.text()); } catch { return refuse('broken'); }
  if (!isObj(data) || data.app !== 'madregot' || data.kind !== 'backup') return refuse('foreign');
  if (!isObj(data.state)) return refuse('broken');
  let state;
  try {
    state = snapshotForBackup(migrate(data.state, Number.isFinite(data.schema) ? data.schema : 0, { personal: PERSONAL_KEY }));
  } catch { return refuse('broken'); }
  if (validateState(state).length) return refuse('broken');
  return { ok: true, state, at: typeof data.at === 'string' ? data.at : null, release: typeof data.release === 'string' ? data.release : null };
}
