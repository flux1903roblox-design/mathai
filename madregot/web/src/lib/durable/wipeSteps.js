// The durable lane's parts of "delete all" (lib/wipe.js, trust spec TRUST-6 §2), registered instead of edited in:
//   - the backup on the server (DURABLE-5): with the backup code on, the vault is deleted after the server's own delete
//     and before anything on the device; when it cannot be, the wipe stops there and the sheet says why, in the vault's
//     words (Settings.jsx WipeSheet shows `wipeText`);
//   - the copy in the browser's database and the quarantine (DURABLE-1): deleted with the device's keys on every path,
//     "only this device" too, so a reload cannot bring the progress back (durable/storage.js durableWipe).
// Imported for its effect by main.jsx and Settings.jsx.
import { onWipe, onClearDevice } from '../wipe.js';
import { useApp } from '../store.js';
import { durableWipe } from './storage.js';
import { stopBackup, vaultErrorText } from './vault.js';

/** The delete sheet's line about the backup code, while it is on (DURABLE-5). */
export const WIPE_VAULT = 'גם הגיבוי המוצפן בשרת יימחק, וקוד הגיבוי יפסיק לעבוד.';
/** The same, when the class or the family keeps the code (DURABLE-6): that copy is not called "מוצפן". */
export const WIPE_KEPT = 'גם הגיבוי בשרת יימחק, וקוד הגיבוי יפסיק לעבוד.';
/** The backup on the server could not be deleted, so nothing on the device was (the reason follows). */
export const WIPE_VAULT_FAILED = 'לא הצלחנו למחוק את הגיבוי בשרת, ולכן עוד לא מחקנו כלום מהמכשיר.';

/** The vault step: nothing without the backup code; a failure carries the sheet's words. */
export async function wipeVault({ store = useApp } = {}) {
  if (!store.getState().backup?.on) return;
  try {
    await stopBackup({ store });
  } catch (e) {
    throw Object.assign(new Error('vault_delete_failed'), { cause: e, wipeText: `${WIPE_VAULT_FAILED} ${vaultErrorText(e)}` });
  }
}

onWipe('vault', () => wipeVault());
onClearDevice('durable', () => durableWipe());
