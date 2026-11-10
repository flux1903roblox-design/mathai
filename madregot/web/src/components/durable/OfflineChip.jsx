// No connection (DURABLE-10). The service worker keeps the whole app usable offline, so the student only needs to know
// that practice goes on and is kept: one calm line at the top of Learn and the assistant while the browser says it is
// offline (role="status"). Answers wait in the class outbox and the backup waits for the connection (moments.js
// 'online'). The screens that cannot work without it (/restore, the parents' area) say so with NEED_ONLINE.
import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

export const OFFLINE_TEXT = 'אין אינטרנט כרגע. אפשר להמשיך לתרגל, והכול יישמר.';
/** /restore and the parents' area, offline. */
export const NEED_ONLINE = 'כדי להמשיך צריך חיבור לאינטרנט.';

const subscribe = (cb) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
};
/** Is the browser online (navigator.onLine, kept up to date by the online and offline events)? */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);

export default function OfflineChip() {
  if (useOnline()) return null;
  return (
    <p className="offline-chip" role="status">
      <WifiOff size={18} aria-hidden="true" />
      <span>{OFFLINE_TEXT}</span>
    </p>
  );
}

/** The line for a screen that needs the connection, while there is none (null when online). */
export function NeedOnline({ className = '' }) {
  if (useOnline()) return null;
  return <p className={`offline-chip offline-need ${className}`} role="status"><WifiOff size={18} aria-hidden="true" /><span>{NEED_ONLINE}</span></p>;
}
