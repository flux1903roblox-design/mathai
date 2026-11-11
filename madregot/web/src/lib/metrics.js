// Reach counts (STUDENT-14): count('install_offer') adds 1 to that name's count for the day on the server, and nothing
// else is sent: no id, no name, no page. A beacon (navigator.sendBeacon) carries the name as plain text, so it never
// waits, never holds up leaving a page and needs no answer. With no server (VITE_API_URL=none, the e2e build, a copy
// that keeps everything on the device) it does nothing. The names the server accepts are worker/src/metrics.js
// METRIC_NAMES; any other name is dropped there.
import { apiBase } from './api.js';

/** Count one step by name. Returns true when a beacon was queued. Never throws. */
export function count(name) {
  try {
    const base = apiBase();
    if (!base || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
    return navigator.sendBeacon(`${base}/api/metrics`, String(name));
  } catch {
    return false;
  }
}
