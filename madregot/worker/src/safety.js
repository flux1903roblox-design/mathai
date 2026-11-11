// Safety events: counts with no content (trust spec TRUST-4 §4.4). A row says what kind of thing happened, on which
// surface, how it was noticed and on which tier, on a Jerusalem day with no time of day. It never says who, on which
// device or in which class, and never holds anything anyone wrote: the table has no column for it, and this writer
// keeps only values from the fixed lists below (a category or tier is a short lower-case label, else it is dropped).
import { dayOf, key, take, netKey } from './util.js';

export const SAFETY_KINDS = Object.freeze(['distress', 'pii_masked', 'output_blocked', 'link_removed', 'refusal', 'user_report',
  'class_ai_off', 'parent_ok_needed', 'photo_redacted']);
export const SAFETY_SURFACES = Object.freeze(['chat', 'explain', 'check', 'exam', 'generate', 'feedback', 'help_note', 'photo']);
export const SAFETY_SOURCES = Object.freeze(['regex', 'model', 'client', 'server']);
/** Rows one request may write; more is a bug in the caller, not something to store. */
export const MAX_SAFETY_ROWS = 20;
/**
 * Rows of one kind one network may write in a day (the trust review: one script could fill the table and set off the
 * owner's spike alert). Past it the rows are dropped; what the request does is never changed. The counter
 * evt:<kind>:n:<network> also tells how many networks wrote a kind on a day (cron.js safetySpike reads it).
 */
export const EVENTS_PER_NET = 20;
/** The counter of a kind's events from one network, in ai_usage. */
export const eventKey = (kind, net) => `evt:${kind}:n:${net}`;
/** The request's network key for recordSafety's cap, as a promise that never rejects (null when it cannot be read). */
export const eventNet = (req, env) => netKey(req, env).catch(() => null);

const INSERT = 'INSERT INTO safety_events (day, kind, category, surface, source, tier) VALUES (?, ?, ?, ?, ?, ?)';
const label = (v, max) => {
  const s = String(v ?? '');
  return new RegExp(`^[a-z][a-z0-9_]{0,${max - 1}}$`).test(s) ? s : '';
};

/** A row as it will be stored, or null when its kind, surface or source is not one of the fixed values. */
export function safetyRow(row, day = dayOf()) {
  if (!row || typeof row !== 'object') return null;
  const { kind, surface, source } = row;
  if (!SAFETY_KINDS.includes(kind) || !SAFETY_SURFACES.includes(surface) || !SAFETY_SOURCES.includes(source)) return null;
  return { day, kind, category: label(row.category, 20), surface, source, tier: label(row.tier, 10) };
}

/**
 * Record safety events: { kind, surface, source, category?, tier? }, one or a list, in one batch. Never throws and never
 * rejects: a request is never failed or slowed by its safety log (pass ctx and the write runs under ctx.waitUntil).
 * `net` (the request's network key, netKey in util.js; a promise of it is fine): each kind is capped at EVENTS_PER_NET
 * rows a day from that network, and rows past the cap are dropped. Resolves to the number of rows written (0 when
 * nothing valid was given, all were over the cap, or the write failed).
 */
export function recordSafety(env, rows, ctx, { net } = {}) {
  const netP = Promise.resolve(net).catch(() => null); // a network that cannot be read caps nothing
  const done = (async () => {
    try {
      const day = dayOf();
      let list = (Array.isArray(rows) ? rows : [rows]).slice(0, MAX_SAFETY_ROWS).map((r) => safetyRow(r, day)).filter(Boolean);
      if (!list.length) return 0;
      const n = await netP;
      if (n) {
        const kinds = [...new Set(list.map((r) => r.kind))];
        const over = new Set();
        for (const k of kinds) {
          const r = await take(env, [key(eventKey(k, n), EVENTS_PER_NET, { n: list.filter((x) => x.kind === k).length })]);
          if (!r.ok) over.add(k);
        }
        list = list.filter((r) => !over.has(r.kind));
        if (!list.length) return 0;
      }
      await env.DB.batch(list.map((r) => env.DB.prepare(INSERT).bind(r.day, r.kind, r.category, r.surface, r.source, r.tier)));
      return list.length;
    } catch {
      console.error('safety_events: not recorded'); // no detail: the log must not carry anything from the request
      return 0;
    }
  })();
  try { ctx?.waitUntil?.(done); } catch { /* the write still runs; the caller is never failed */ }
  return done;
}
