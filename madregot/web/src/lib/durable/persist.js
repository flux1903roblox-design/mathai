// Asking the browser to keep the data (DURABLE-3). A browser may delete a site's data when the device fills up, and
// Safari on an iPhone after seven days of Safari use without the site; `navigator.storage.persist()` asks it not to.
//   - When: right after the first finished lesson (LessonDone, CheckDone), if the browser has not promised already and
//     this device was never asked (durable.persistAsked). Chrome answers by engagement and installation, Safari 17+ by
//     its own rules (a Home Screen app is kept), and neither shows the student anything.
//   - Firefox shows a permission prompt for it, so there it is asked only from the Settings button, when the person
//     taps it.
//   - The answer is shown as it is (WebKit can answer false): useDurable.persisted is read again on every app open and
//     every time the page comes back into view. A browser with no navigator.storage says "לא ידוע".
import { useApp } from '../store.js';
import { useDurable } from './useDurable.js';

/** The words Settings shows for the answer. */
export const PERSISTED_TEXT = { yes: 'כן', no: 'לא מובטחת', unknown: 'לא ידוע' };
export const persistedText = (p) => (p === true ? PERSISTED_TEXT.yes : p === false ? PERSISTED_TEXT.no : PERSISTED_TEXT.unknown);
/** After the Settings button: what the browser said. */
export const PERSIST_TOAST = { granted: 'הדפדפן הסכים לשמור את הנתונים.', refused: 'הדפדפן לא הבטיח לשמור. כדאי לשמור גיבוי.' };

/** Firefox asks the person with a prompt (the others decide alone). */
export const isFirefox = (nav = globalThis.navigator) => String(nav?.userAgent || '').includes('Firefox/');
const canPersist = (nav) => typeof nav?.storage?.persist === 'function';

/**
 * The browser's answer now, kept in useDurable.persisted: true (it keeps the data), false (no promise), or null when it
 * cannot say (no navigator.storage, or the call failed).
 */
export async function readPersisted({ nav = globalThis.navigator, status = useDurable } = {}) {
  let p = null;
  try { if (typeof nav?.storage?.persisted === 'function') p = (await nav.storage.persisted()) === true; } catch { p = null; }
  status.setState({ persisted: p });
  return p;
}

/** Ask, and note that this device was asked. Resolves the browser's answer (false when the call fails). */
async function request({ nav, store, status, now }) {
  let granted = false;
  try { granted = (await nav.storage.persist()) === true; } catch { granted = false; }
  store.setState({ durable: { ...store.getState().durable, persistAsked: now().toISOString() } });
  status.setState({ persisted: granted });
  return granted;
}

/**
 * After a finished lesson. Resolves what happened: 'kept' (the browser keeps the data already), 'unknown' (it cannot
 * say), 'asked-before', 'firefox' (left to the Settings button), 'granted' or 'refused' (it was asked now). Two calls at
 * once (two result screens, or React's double effects in development) share one ask.
 */
let asking = null;
export function askAfterLesson(opts = {}) {
  if (!asking) asking = askOnce(opts).finally(() => { asking = null; });
  return asking;
}
async function askOnce({ nav = globalThis.navigator, store = useApp, status = useDurable, now = () => new Date() }) {
  const p = await readPersisted({ nav, status });
  if (p === true) return 'kept';
  if (p === null || !canPersist(nav)) return 'unknown';
  if (store.getState().durable?.persistAsked) return 'asked-before';
  if (isFirefox(nav)) return 'firefox';
  return (await request({ nav, store, status, now })) ? 'granted' : 'refused';
}

/**
 * The Settings button "לבקש מהדפדפן לשמור": ask now, straight from the tap (Firefox's prompt needs it). Resolves the
 * answer, or null when this browser cannot be asked.
 */
export function askFromSettings({ nav = globalThis.navigator, store = useApp, status = useDurable, now = () => new Date() } = {}) {
  if (!canPersist(nav)) return Promise.resolve(null);
  return request({ nav, store, status, now });
}

/**
 * Settings offers the button while the browser has not promised; on Firefox only until it was asked once (its prompt
 * remembers the answer, and asking again would only nag).
 */
export const canAsk = (persisted, persistAsked, nav = globalThis.navigator) => persisted === false && canPersist(nav) && !(isFirefox(nav) && !!persistAsked);

/** Keep useDurable.persisted fresh: now, and every time the page comes back into view. Returns the function that stops. */
export function watchPersisted({ nav = globalThis.navigator, doc = globalThis.document, status = useDurable } = {}) {
  readPersisted({ nav, status });
  if (typeof doc?.addEventListener !== 'function') return () => {};
  const onShow = () => { if (doc.visibilityState === 'visible') readPersisted({ nav, status }); };
  doc.addEventListener('visibilitychange', onShow);
  return () => doc.removeEventListener('visibilitychange', onShow);
}
