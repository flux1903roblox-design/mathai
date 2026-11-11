// Error reports with no third party (DURABLE-9). When something breaks on a phone, the app counts it on its own server,
// so the owner sees it the next morning; no tracker, no device id, no name, no address of the page beyond its route.
// Installed before anything else (main.jsx imports it first), it hears:
//   - the window's `error` and `unhandledrejection` events;
//   - ErrorBoundary.componentDidCatch (components/Screen.jsx): kind 'render', with the nearest component's name;
//   - a part of the app that could not be loaded (a new release replaced it): kind 'chunk', and the page is loaded again
//     once (when online, and not within 60 s of the last such reload); otherwise the error screen shows;
//   - the safe write path (durable/storage.js): kind 'storage' (quota, parse, mirror);
//   - `securitypolicyviolation`: kind 'csp', with only the blocked directive and the blocked address's origin;
//   - the vault and the service worker report through the same report() when they exist.
// A record is { kind, name, message, frame, route, agent, n: 1 }, scrubbed (@shared/errors.js): the message clipped to
// 200 characters, digit runs, emails, keys and long hex removed; the frame is the first line of our own /assets/*.js
// as file:line:col; the route is the screen's pattern from App.jsx's router table (/lesson/:topic/:level), never its
// values; the agent is a coarse browser class (ios-safari-17, android-chrome-131, desktop-chrome, other).
// Each failure is reported once per page (by fingerprint), at most 10 a page load. Every record goes to the errors ring
// on the device (durable/idb.js), which "מידע לתמיכה" in Settings reads, with or without a server. With a server (and
// unless the build has VITE_MONITOR=off) they are sent in one request 10 s after the first, or at once when the page is
// hidden, with sendBeacon when the hidden moment's keepalive budget has room (durable/moments.js). A text/plain body
// needs no CORS preflight; the Worker reads the JSON from it (worker/src/errors.js).
// This module imports nothing of the app (the store and the write path import it), so main.jsx hands it the server
// address, the errors ring and the keepalive budget with configure().
import { CLIENT_KINDS, LIMITS, MAX_ITEMS, clean, fingerprintText } from '@shared/errors.js';

export const FLUSH_EVERY = 10_000;
/** sessionStorage: when the page was last reloaded after a part of the app failed to load. */
export const RELOAD_KEY = 'madregot-reloaded';
export const RELOAD_GAP = 60_000;
export const CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
/** The build: the commit it was made from (vite.config.js), or 'dev'. */
export const RELEASE = String(import.meta.env?.VITE_RELEASE || 'dev').slice(0, LIMITS.release);

/**
 * The app's screens as patterns: every path in App.jsx's router table (monitor.test.js fails when one is missing).
 * '/teacher/*' covers the teacher's own screens. '/r/:data' keeps a shared week out of an error report: only the
 * pattern is sent, never the link's data.
 */
export const ROUTES = Object.freeze([
  '/', '/parents', '/parents/link', '/parents/info', '/cancel', '/terms', '/privacy', '/accessibility', '/safety', '/restore', '/r/:data', '/r',
  '/teacher/*', '/subscription', '/quests', '/topics', '/topic/:id', '/assistant', '/me', '/settings', '/settings/advanced', '/report',
  '/exams', '/exams/check', '/exams/new', '/exams/practice/:id', '/exams/:id', '/plan', '/learn/:topic/:level', '/mission', '/rescue', '/lesson/:topic/:level', '/practice/:id',
  '/placement', '/learn/:topic/:level/:stage', '/repair/:topic/:level/:misc', '/rescue/check', '/rescue/exam',
  // the curriculum lane's programme page, the school lane's teacher screens and a class exam (any other /teacher path
  // is '/teacher/*')
  '/programme', '/teacher', '/teacher/lessons', '/teacher/assistant', '/teacher/settings', '/teacher/exam/new', '/teacher/exam/:id',
  '/teacher/report', '/teacher/guide/:doc?', '/class/exam/:id', '/class/exam/:id/run',
]);

/** The pattern of a hash route ('#/lesson/signed/3?part=2' → '/lesson/:topic/:level'); '/other' when none fits. */
export function routePattern(hash) {
  const path = String(hash ?? '').replace(/^#/, '').split(/[?#]/)[0] || '/';
  const segs = path.split('/').filter(Boolean);
  let best = null; let bestLiterals = -1;
  for (const r of ROUTES) {
    const rs = r.split('/').filter(Boolean);
    let fits; let literals;
    if (rs.at(-1) === '*') {
      const head = rs.slice(0, -1);
      fits = segs.length >= head.length && head.every((s, i) => s === segs[i]);
      literals = head.length - 0.5; // '/teacher' itself is '/teacher', not '/teacher/*'
    } else {
      fits = rs.length === segs.length && rs.every((s, i) => s.startsWith(':') || s === segs[i]);
      literals = rs.filter((s) => !s.startsWith(':')).length;
    }
    // '/exams/check' before '/exams/:id': the pattern with more fixed parts wins
    if (fits && literals > bestLiterals) { best = r; bestLiterals = literals; }
  }
  return best || '/other';
}

/** A coarse class of browser: the system, the browser and (on phones) its major version. Nothing finer. */
export function agentClass(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || '');
  const v = (re) => ua.match(re)?.[1] || '';
  const tag = (s, ver) => (ver ? `${s}-${ver}` : s);
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && Number(nav?.maxTouchPoints) > 1)) {
    const browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : 'safari';
    return tag(`ios-${browser}`, v(/OS (\d+)[_.]\d/) || v(/Version\/(\d+)/));
  }
  if (/Android/.test(ua)) {
    if (/SamsungBrowser\//.test(ua)) return tag('android-samsung', v(/SamsungBrowser\/(\d+)/));
    if (/Firefox\//.test(ua)) return tag('android-firefox', v(/Firefox\/(\d+)/));
    if (/Chrome\//.test(ua)) return tag('android-chrome', v(/Chrome\/(\d+)/));
    return 'android-other';
  }
  if (/Edg\//.test(ua)) return 'desktop-edge';
  if (/Firefox\//.test(ua)) return 'desktop-firefox';
  if (/Chrome\//.test(ua)) return 'desktop-chrome';
  if (/Safari\//.test(ua)) return 'desktop-safari';
  return 'other';
}

const FRAME = /^[\w.-]{1,90}\.js:\d{1,7}:\d{1,7}$/;
/** The first line of a stack that is our own built code (/assets/*.js), as file:line:col; '' when there is none. */
export function frameOf(stack) {
  const m = String(stack || '').match(/\/assets\/([\w.-]+\.js)(?:\?[^\s:)]*)?:(\d+):(\d+)/);
  const f = m ? `${m[1]}:${m[2]}:${m[3]}` : '';
  return FRAME.test(f) ? f.slice(0, LIMITS.frame) : '';
}

/** The nearest component in React's component stack ("at Me (…)" or "in Me"); '' when there is none. */
export function componentOf(componentStack) {
  const m = String(componentStack || '').match(/(?:^|\n)\s*(?:at|in) ([A-Za-z_$][\w$]*)/);
  return m ? m[1] : '';
}

/** The blocked address of a CSP report: only its origin, or the keyword ('inline', 'eval', 'data', 'blob'). */
export function blockedOrigin(uri) {
  const s = String(uri || '');
  if (!s || /^(inline|eval|wasm-eval|trusted-types-sink)$/.test(s)) return s || 'inline';
  try { const u = new URL(s); return u.protocol === 'data:' || u.protocol === 'blob:' ? u.protocol.slice(0, -1) : u.origin; } catch { return 'other'; }
}

/** name, message and frame from anything thrown. */
function fromThrown(e) {
  if (e && typeof e === 'object' && ('message' in e || 'stack' in e)) return { name: e.name || 'Error', message: e.message, frame: frameOf(e.stack) };
  return { name: e === null ? 'null' : typeof e, message: String(e) };
}

/**
 * A monitor. The app has one (below); tests make their own with a fake page. Everything is optional:
 * `win`, `doc`, `nav` and `session` (sessionStorage) are the page's; `fetchFn`; `now` in ms; `reload`.
 */
export function createMonitor({
  win = globalThis.window, nav = globalThis.navigator, session, fetchFn = (...a) => globalThis.fetch(...a),
  now = () => Date.now(), reload = () => globalThis.location?.reload(), release = RELEASE, setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  const seen = new Set();
  let made = 0;
  const queue = [];
  const early = []; // records made before configure(): they reach the ring then
  let timer = null;
  let cfg = { server: () => '', ring: null, budget: null };
  const sessionStore = () => { try { return session ?? globalThis.sessionStorage ?? null; } catch { return null; } };
  const base = () => { try { return String(cfg.server() || '').replace(/\/+$/, ''); } catch { return ''; } };

  function toRing(rec) {
    if (cfg.ring) Promise.resolve().then(() => cfg.ring.add(rec)).catch(() => {});
    else early.push(rec);
  }

  /**
   * Report one failure: `kind` (one of CLIENT_KINDS) and { name, message, frame, route }. Scrubbed, once per
   * fingerprint, at most 10 a page. Returns the record, or null when it was a repeat or over the cap.
   */
  function report(kind, fields = {}) {
    const k = CLIENT_KINDS.includes(kind) ? kind : 'error';
    const frame = FRAME.test(String(fields.frame || '')) ? fields.frame : '';
    const rec = {
      kind: k,
      name: clean(fields.name || k, LIMITS.name) || k,
      message: clean(fields.message, LIMITS.message),
      frame,
      route: fields.route ?? routePattern(win?.location?.hash),
      agent: agentClass(nav).slice(0, LIMITS.agent),
      n: 1,
    };
    const fp = fingerprintText(rec);
    if (seen.has(fp) || made >= MAX_ITEMS) return null;
    seen.add(fp); made += 1;
    toRing({ kind: rec.kind, name: rec.name, message: rec.message, route: rec.route, release, at: new Date(now()).toISOString() });
    queue.push(rec);
    if (base()) schedule();
    return rec;
  }

  /** Something thrown: kind 'chunk' when a part of the app could not be loaded (and then the reload guard). */
  function reportError(kind, e, extra = {}) {
    const f = { ...fromThrown(e), ...extra };
    if (CHUNK_RE.test(String(f.message || ''))) {
      const rec = report('chunk', f);
      recoverChunk();
      return rec;
    }
    return report(kind, f);
  }

  /** ErrorBoundary.componentDidCatch: the error and the nearest component (its name joins the error's). */
  function reportRender(e, componentStack) {
    const c = componentOf(componentStack);
    const f = fromThrown(e);
    return reportError('render', e, { name: c ? `${f.name}@${c}` : f.name });
  }

  /**
   * A part of the app failed to load: load the page again once, when online and the last such reload was more than
   * 60 s ago. Without sessionStorage it never reloads (it could not tell a loop). Returns true when it reloads.
   */
  function recoverChunk() {
    if (nav?.onLine === false) return false;
    const s = sessionStore();
    if (!s) return false;
    let last = 0;
    try { last = Number(s.getItem(RELOAD_KEY)) || 0; } catch { return false; }
    if (now() - last < RELOAD_GAP) return false;
    try { s.setItem(RELOAD_KEY, String(now())); } catch { return false; }
    flush({ hidden: true });
    reload();
    return true;
  }

  function schedule() {
    if (timer === null) timer = setTimer(() => { timer = null; flush(); }, FLUSH_EVERY);
  }

  /**
   * Send what is queued (at most 10). `hidden`: the page is going away, so sendBeacon is used when the keepalive
   * budget has room; otherwise (and when the beacon is refused) a plain fetch. A failed send is not retried.
   */
  function flush({ hidden = false } = {}) {
    if (timer !== null) { clearTimer(timer); timer = null; }
    const b = base();
    if (!b) { queue.length = 0; return false; }
    if (!queue.length) return false;
    const items = queue.splice(0, MAX_ITEMS);
    const body = JSON.stringify({ v: 1, release, items });
    const url = `${b}/api/errors`;
    if (hidden && typeof nav?.sendBeacon === 'function' && cfg.budget?.claim(new TextEncoder().encode(body).length)) {
      try { if (nav.sendBeacon(url, body)) return true; } catch { /* sent below */ }
    }
    try {
      Promise.resolve(fetchFn(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, credentials: 'omit' })).catch(() => {});
    } catch { /* nothing to do */ }
    return true;
  }

  /**
   * The app's side: `server()` the server's address ('' for none: nothing is sent), `ring` ({ add(record) }: the errors
   * kept on the device), `budget` (the keepalive budget of the hidden moment).
   */
  function configure({ server = () => '', ring = null, budget = null } = {}) {
    cfg = { server, ring, budget };
    if (ring) for (const r of early.splice(0)) toRing(r);
    if (!base()) queue.length = 0;
    else if (queue.length) schedule();
  }

  /** Hear the page's own errors. Returns the function that stops. */
  function listen(w = win, d = globalThis.document) {
    const onError = (e) => {
      const err = e?.error;
      const frame = frameOf(err?.stack) || frameOf(e?.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '');
      reportError('error', err ?? { name: 'Error', message: e?.message }, { message: err?.message || e?.message, frame });
    };
    const onRejection = (e) => reportError('rejection', e?.reason);
    const onPreload = (e) => reportError('chunk', e?.payload ?? { name: 'Error', message: 'Failed to fetch dynamically imported module' });
    const onCsp = (e) => report('csp', { name: e?.effectiveDirective || e?.violatedDirective || 'csp', message: blockedOrigin(e?.blockedURI), frame: '' });
    w?.addEventListener?.('error', onError);
    w?.addEventListener?.('unhandledrejection', onRejection);
    w?.addEventListener?.('vite:preloadError', onPreload);
    d?.addEventListener?.('securitypolicyviolation', onCsp);
    return () => {
      w?.removeEventListener?.('error', onError);
      w?.removeEventListener?.('unhandledrejection', onRejection);
      w?.removeEventListener?.('vite:preloadError', onPreload);
      d?.removeEventListener?.('securitypolicyviolation', onCsp);
    };
  }

  return { report, reportError, reportRender, recoverChunk, flush, configure, listen, queued: () => queue.slice(), made: () => made };
}

/** The app's monitor: it hears the page from the moment this module is loaded (main.jsx loads it first). */
export const monitor = createMonitor();
if (typeof window !== 'undefined' && typeof document !== 'undefined') monitor.listen(window, document);
/** Report a failure (for the parts of the app that see one): see createMonitor's report(). */
export const report = (kind, fields) => monitor.report(kind, fields);
