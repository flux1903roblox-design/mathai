// How the saving is going on this device (DURABLE-1), for the screens that say so: a plain store, never saved itself.
//   health        'ok'      the last change is saved in the browser's storage
//                 'mirror'  the browser's storage is full, but the change is saved in the copy on the device (IndexedDB)
//                 'full'    nothing could save the last change
//                 'memory'  this browser lets nothing be saved: the progress lasts until the page is closed
//   savedAt       when the last change was saved (ISO)
//   restoredFrom  where this page's progress came back from, if it did ('mirror': the copy on the device)
//   restoreNote   say so to the student, once: false when the copy is newer only because the storage is full
//   persisted     the browser's answer to navigator.storage.persisted() (DURABLE-3, durable/persist.js): true (it keeps
//                 the data even when the device fills up), false (no promise), null (this browser cannot say)
import { create } from 'zustand';

export const createDurableStatus = () => create(() => ({ health: 'ok', savedAt: null, restoredFrom: null, restoreNote: false, persisted: null }));

export const useDurable = createDurableStatus();

/** A reload would keep the progress: it is saved in the browser's storage or in the copy on the device. */
export const savedHealth = (health) => health === 'ok' || health === 'mirror';
