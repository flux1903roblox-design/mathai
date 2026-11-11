// No connection (DURABLE-10). The service worker keeps the whole app usable offline, so the student only needs to know
// that practice goes on and is kept: one calm line at the top of Learn and the assistant while the browser says it is
// offline. Answers wait in the class outbox and the backup waits for the connection (moments.js 'online'). The screens
// that cannot work without it (/restore, the parents' area) say so with NeedOnline.
import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

export const OFFLINE_TEXT = 'אין אינטרנט כרגע. אפשר להמשיך לתרגל, והכול יישמר.';
/** /restore and the parents' area, offline. */
export const NEED_ONLINE = 'כדי להמשיך צריך חיבור לאינטרנט.';

// Whether the browser says it is online; follows the 'online' and 'offline' events.
const subscribe = (fn) => {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => { window.removeEventListener('online', fn); window.removeEventListener('offline', fn); };
};
const onlineNow = () => navigator.onLine !== false;
export const useOnline = () => useSyncExternalStore(subscribe, onlineNow, () => true);

/**
 * A calm line at the top of Learn and the assistant while there is no internet (DURABLE-10). The status region is
 * always in the page and only its text appears, so a screen reader announces the change.
 */
export default function OfflineChip() {
  const online = useOnline();
  return (
    <div role="status" className="offline-slot">
      {!online && <p className="offline-chip"><WifiOff size={18} aria-hidden="true" />{OFFLINE_TEXT}</p>}
    </div>
  );
}

/** The line for a screen that needs the connection, while there is none (null when online). */
export function NeedOnline({ className = '' }) {
  if (useOnline()) return null;
  return <p className={`offline-chip offline-need ${className}`} role="status"><WifiOff size={18} aria-hidden="true" /><span>{NEED_ONLINE}</span></p>;
}
