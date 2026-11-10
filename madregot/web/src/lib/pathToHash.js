// Payment return pages, QR codes and email links are plain paths (https://<domain>/parents?order=…), which the Worker
// already answers with the app. The app routes by the hash, so before anything else starts, a plain path of the
// parents' area becomes the same route in the hash: /parents/link?c=K7M4QX → <base>#/parents/link?c=K7M4QX.
// Imported first in main.jsx, before historySeed.js and the router.

const PATHS = ['/parents/link', '/parents/info', '/parents', '/cancel', '/terms', '/privacy', '/accessibility'];

/**
 * The URL a plain path should become, or null to leave it alone. `pathname` may carry a base path (a copy of the app
 * at /madregot/); only its end is matched. An existing hash always wins.
 */
export function hashFor({ pathname, search = '', hash = '' }) {
  if (hash && hash !== '#' && hash !== '#/') return null;
  const path = String(pathname || '').replace(/\/+$/, '');
  const hit = PATHS.find((p) => path === p || path.endsWith(p));
  if (!hit) return null;
  const base = path.slice(0, path.length - hit.length) || '';
  return `${base}/#${hit}${search || ''}`;
}

try {
  if (typeof window !== 'undefined') {
    const to = hashFor(window.location);
    if (to) window.history.replaceState(null, '', to);
  }
} catch { /* history not available: the app opens at its start */ }
