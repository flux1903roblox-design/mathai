// Payment return pages, QR codes and email links are plain paths (https://<domain>/parents?order=…), which the Worker
// already answers with the app. The programme page (/programme?grade=8) is linked the same way from the store text. The app routes by the hash, so before anything else starts, a plain path of the
// parents' area becomes the same route in the hash: /parents/link?c=K7M4QX → <base>#/parents/link?c=K7M4QX.
// A section of a legal page linked from an email keeps its anchor after the route: /terms#cancel → <base>/#/terms#cancel
// (the page scrolls to it, trust spec TRUST-2 §3).
// Imported first in main.jsx, before historySeed.js and the router.

const PATHS = ['/parents/link', '/parents/info', '/parents', '/cancel', '/terms', '/privacy', '/accessibility', '/safety', '/programme'];

/**
 * The URL a plain path should become, or null to leave it alone. `pathname` may carry a base path (a copy of the app
 * at /madregot/); only its end is matched. An existing route in the hash (#/…) always wins; any other hash is an
 * anchor in the page and is kept after the route.
 */
export function hashFor({ pathname, search = '', hash = '' }) {
  const h = String(hash || '');
  if (h.startsWith('#/') && h !== '#/') return null;
  const anchor = h.length > 1 && !h.startsWith('#/') ? h : '';
  const path = String(pathname || '').replace(/\/+$/, '');
  const hit = PATHS.find((p) => path === p || path.endsWith(p));
  if (!hit) return null;
  const base = path.slice(0, path.length - hit.length) || '';
  return `${base}/#${hit}${search || ''}${anchor}`;
}

try {
  if (typeof window !== 'undefined') {
    const to = hashFor(window.location);
    if (to) window.history.replaceState(null, '', to);
  }
} catch { /* history not available: the app opens at its start */ }
