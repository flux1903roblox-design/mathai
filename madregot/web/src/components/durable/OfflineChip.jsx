import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

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
      {!online && <p className="offline-chip"><WifiOff size={18} aria-hidden="true" />אין אינטרנט כרגע. אפשר להמשיך לתרגל, והכול יישמר.</p>}
    </div>
  );
}
