// How the tutor's answers fared, as counts only (ai spec AI-3 Design 6): a reply whose final answer the guard masked, a
// streamed reply that came back empty, and (with AI-4) the generated exercises code dropped. One row per Jerusalem day,
// kind and reason, with a count: no person, device, pool or text, so a row can never point to anyone or hold what was
// written. The owner's daily summary reads yesterday's counts (cron.js); rows go after QUALITY_KEEP_DAYS.
import { dayOf } from './util.js';

export const QUALITY_KINDS = Object.freeze(['explain', 'chat', 'check', 'generate']);
export const QUALITY_REASONS = Object.freeze([
  'answer_masked', 'empty_stream',
  // generated exercises (AI-4): stories dropped by a code check (one row per reason, n the stories; gen_kept: a story
  // written under a seed's drawing, or a "kept" one that changed the wording), a request where every story was dropped,
  // and a blind solve that failed twice
  'gen_kept', 'gen_latex', 'gen_numbers', 'gen_leak', 'gen_solution', 'gen_equations', 'gen_blind', 'gen_all_failed', 'blind_skipped',
]);
export const GEN_DROPPED = Object.freeze(['gen_kept', 'gen_latex', 'gen_numbers', 'gen_leak', 'gen_solution', 'gen_equations', 'gen_blind']);
export const QUALITY_KEEP_DAYS = 400;

const UPSERT = 'INSERT INTO ai_quality (day, kind, reason, n) VALUES (?, ?, ?, ?) ON CONFLICT (day, kind, reason) DO UPDATE SET n = n + excluded.n';

/**
 * Count an event (n of them: the stories one request dropped for one reason). It is written after the reply
 * (ctx.waitUntil) and never throws: a counter must never cost a child an answer. An unknown kind or reason, or an n that
 * is not a whole number above 0, is not written.
 */
export function bumpQuality(env, ctx, kind, reason, n = 1) {
  if (!QUALITY_KINDS.includes(kind) || !QUALITY_REASONS.includes(reason) || !env?.DB || !Number.isInteger(n) || n < 1) return;
  try {
    const write = Promise.resolve()
      .then(() => env.DB.prepare(UPSERT).bind(dayOf(), kind, reason, n).run())
      .catch((e) => console.error('quality', e?.message));
    if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(write);
  } catch (e) {
    console.error('quality', e?.message);
  }
}

/** A day's counts for the owner's summary: { masked, emptyStreams, genDropped, genAllFailed }, each a number. */
export async function qualityCounts(env, day) {
  const rows = (await env.DB.prepare('SELECT reason, SUM(n) AS n FROM ai_quality WHERE day = ? GROUP BY reason').bind(day).all()).results || [];
  const n = (reasons) => rows.filter((r) => reasons.includes(r.reason)).reduce((sum, r) => sum + Number(r.n || 0), 0);
  return { masked: n(['answer_masked']), emptyStreams: n(['empty_stream']), genDropped: n(GEN_DROPPED), genAllFailed: n(['gen_all_failed']) };
}
