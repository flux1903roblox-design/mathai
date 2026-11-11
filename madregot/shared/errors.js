// Error reports (DURABLE-9), shared by the app (web/src/lib/monitor.js) and the Worker (worker/src/errors.js): which
// kinds there are, how long each field may be, and the scrubbing. The Worker repeats the scrubbing on what arrives, so
// a report that skipped it (an old app, or not the app at all) is cleaned the same way before it is counted.
//   - runs of 3 or more digits become "#" (ids, times, amounts, phone numbers);
//   - an email address becomes "@";
//   - an Anthropic key and any run of 32 or more hex characters (tokens, hashes) become "…".

/** Every kind a report can have. 'server' is the Worker's own (an unhandled exception); the app never sends it. */
export const ERROR_KINDS = Object.freeze(['error', 'rejection', 'render', 'chunk', 'storage', 'vault', 'sw', 'csp', 'server']);
export const CLIENT_KINDS = Object.freeze(ERROR_KINDS.filter((k) => k !== 'server'));
/** The longest each field is kept (the client_errors table checks the same lengths). */
export const LIMITS = Object.freeze({ name: 40, message: 200, frame: 120, route: 60, agent: 30, release: 20 });
/** At most this many reports a page load, and in one request. */
export const MAX_ITEMS = 10;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// written so the bundle never holds the key prefix as one piece (web/scripts/check-dist.mjs refuses a build that does)
const KEY = /sk-an[t]-[A-Za-z0-9_-]*/g;
const HEX = /[0-9a-fA-F]{32,}/g;
const DIGITS = /\d{3,}/g;

/** The text with what could identify someone or unlock something replaced. Emails and keys go before their digits do. */
export function scrub(text) {
  return String(text ?? '').replace(EMAIL, '@').replace(KEY, '…').replace(HEX, '…').replace(DIGITS, '#');
}

/** Scrubbed, on one line, and at most `max` characters. */
export function clean(text, max) {
  return scrub(text).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** A report's own key: the same failure in the same place is one line, however often it happens. */
export const fingerprintText = (r) => `${r.kind}|${r.name}|${r.message}|${r.frame}`;
