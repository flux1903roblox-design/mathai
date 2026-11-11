// "Delete all" (trust spec TRUST-6 §2): one action removes every byte the app wrote on this device, and, first, every
// row the server keeps for this student, family device and install (POST /api/me/forget). The server goes first: if
// it fails, nothing on the device is touched, and the screen says why (Settings.jsx). Then the steps other parts of
// the app registered (onWipe: a backup on the server, a database in the browser, push), and the parent's session here
// and on the server (parent.js forgetParentHere). Then every key of this app in localStorage and sessionStorage, the
// in-memory store (replaced, not merged), its saved copy, and a reload, which drops every other store held in memory.
import { useApp, STORE_KEY, empty } from './store.js';
import { api, hasServer } from './api.js';
import { emptyLearn } from '@/learn/storeGlue.ts';
import { RETENTION } from '@shared/retention.js';

const steps = new Map();
/**
 * A step of "delete all" that another part of the app owns, e.g. onWipe('vault', deleteVault). It runs after the
 * server's own delete and before anything on the device is removed; if it throws, the wipe stops there. Returns a
 * function that takes the step away again.
 */
export function onWipe(name, fn) {
  steps.set(name, fn);
  return () => { if (steps.get(name) === fn) steps.delete(name); };
}

/** What the server needs to find this device's data: the student's token, the family-device token, the install id. */
export function forgetHeaders(st = useApp.getState()) {
  return {
    ...(st.profile?.token ? { Authorization: `Bearer ${st.profile.token}` } : {}),
    ...(st.ai?.familyDevice?.token ? { 'X-Family-Device': st.ai.familyDevice.token } : {}),
    ...(st.ai?.device ? { 'X-Device': st.ai.device } : {}),
  };
}

/** Is this one of the app's keys? The saved state and every key beside it (madregot-…, <STORE_KEY>-…). */
const ours = (k) => typeof k === 'string' && (k.startsWith(STORE_KEY) || k.startsWith('madregot'));
function storages() {
  const out = [];
  for (const name of ['localStorage', 'sessionStorage']) {
    try { const s = globalThis[name]; if (s) out.push(s); } catch { /* blocked: nothing kept there */ }
  }
  return out;
}
/** Every key of the app, in both storages (for tests and the e2e check). */
export function appKeys() {
  return storages().flatMap((s) => {
    try { return Array.from({ length: s.length }, (_, i) => s.key(i)).filter(ours); } catch { return []; }
  });
}

/**
 * Everything on the device, after the server part: the app's keys in both storages, the store replaced by an empty
 * one (its actions kept, every other field gone), the saved copy, and nothing written again for the rest of this
 * page: the reload that follows starts from nothing.
 */
export function clearDevice() {
  for (const s of storages()) {
    let keys = [];
    try { keys = Array.from({ length: s.length }, (_, i) => s.key(i)).filter(ours); } catch { /* blocked */ }
    for (const k of keys) { try { s.removeItem(k); } catch { /* already gone */ } }
  }
  const actions = Object.fromEntries(Object.entries(useApp.getState()).filter(([, v]) => typeof v === 'function'));
  useApp.setState({ ...actions, ...empty, learn: emptyLearn(), ai: { ...empty.ai } }, true);
  useApp.persist.clearStorage();
  useApp.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
}

/** The start page after a wipe; Welcome reads ?wiped (1: the device and the server, device: this device only). */
function reload(what) {
  window.location.replace(`${import.meta.env.BASE_URL || '/'}?wiped=${what}`);
}

async function forgetParent() {
  try { const { forgetParentHere } = await import('./parent.js'); await forgetParentHere(); } catch { /* nothing kept */ }
}

/**
 * "מחיקת כל הנתונים". With a server: POST /api/me/forget (throws: the caller says so, and nothing here was touched),
 * the registered steps (one that throws stops the wipe the same way), and the parent's session. Then the device, and
 * the start page. Returns only if it threw.
 */
export async function wipeEverything() {
  const server = hasServer();
  if (server) {
    await api('/api/me/forget', { method: 'POST', body: {}, auth: false, headers: forgetHeaders() });
    for (const fn of steps.values()) await fn();
  }
  await forgetParent();
  clearDevice();
  reload(server ? '1' : 'device');
}

/**
 * "למחוק רק מהמכשיר", after the server could not be reached and the second confirm: the registered steps are tried
 * (one that fails is skipped: what it kept on the server stays, as the sheet said), then the device, as above.
 */
export async function wipeDeviceOnly() {
  for (const fn of steps.values()) { try { await fn(); } catch { /* the server part stays, as the sheet said */ } }
  await forgetParent();
  clearDevice();
  reload('device');
}

// ---------------------------------------------------------------- the words of the sheet (Settings.jsx)
/**
 * What "delete all" will delete, in the words of Appendix E §E.5: a student in a class (the device and the class
 * server), a device alone with a server (the device and the install id the server knows), a teacher (the device only:
 * the classes on the server are deleted from the dashboard), and a copy with no server. A device linked to the parents'
 * account adds that it is unlinked and that the parents get an email.
 */
export function wipeText({ profile, ai, server, tier }) {
  if (profile?.role === 'teacher') {
    return 'נמחק מהמכשיר הזה את הכיתות ואת מפתחות המורה. המידע של הכיתות בשרת נשאר: כדי למחוק אותו, מוחקים כל כיתה בלוח המורה לפני כן. אי אפשר לבטל.';
  }
  if (!server) return 'נמחק את כל מה שנשמר במכשיר הזה: השם, ההתקדמות, הטעויות שזוהו, תוכנית המבחן, המבחנים והמספרים. אי אפשר לבטל.';
  const linked = !ai?.familyDevice?.token ? ''
    : tier === 'family' ? ' המכשיר גם ינותק מהמנוי המשפחתי, וההורים יקבלו על זה מייל.'
      : ' המכשיר גם ינותק מהחשבון של ההורים, וההורים יקבלו על זה מייל.';
  if (profile?.token) {
    return `נמחק את כל מה שנשמר במכשיר הזה, וגם את מה שנשמר עליכם בשרת של הכיתה: השם, ההתקדמות, הבקשות למורה והמבחנים. המורה כבר לא יראה אתכם ברשימה.${linked} אי אפשר לבטל.`;
  }
  return `נמחק את כל מה שנשמר במכשיר הזה: השם, ההתקדמות, הטעויות שזוהו, תוכנית המבחן, המבחנים והמספרים, וגם את מספר המכשיר שהשרת מכיר.${linked} אי אפשר לבטל.`;
}
export const WIPE_FAILED = 'לא הצלחנו למחוק מהשרת, ולכן עוד לא מחקנו כלום. בדקו את החיבור לאינטרנט ונסו שוב.';
/** The second question before deleting from the device only: what stays on the server, and until when. */
export function deviceOnlyText({ profile, ai }) {
  if (profile?.token) return `המידע בשרת של הכיתה יישאר עד שהמורה ימחק אותו, או עד שיימחק מעצמו אחרי ${RETENTION.studentIdleDays} יום.`;
  return `מה שהשרת יודע על המכשיר הזה יימחק מעצמו בתוך כמה שבועות.${ai?.familyDevice?.token ? ' ההורים יכולים לנתק את המכשיר בעמוד ההורים.' : ''}`;
}
