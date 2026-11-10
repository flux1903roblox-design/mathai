// Code graders for the tutor evaluation (ai spec AI-7 Design 3). Each takes one row (a case from cases.json, the shape
// it ran in, the reply, and the judge's verdict when there is one) and returns { pass, detail }:
//   pass true / false   the reply does / does not do what the grader checks
//   pass null           the grader does not apply to this row (not a withhold row, no candidate, no equation …)
// A grader that throws is an error of the harness, never a fail: gradeRow puts it in `errors` with class 'grader', the
// line the runner writes to errors.jsonl.
//
// The guard here is the one the Worker applies (shared/guard.js): a streamed chat goes through streamGuard in pieces,
// an explain through guardResult, and a masked reply ends with MASK_NOTE. So leakAfterGuard measures what a student sees.
import { answerForms, findLeaks, streamGuard, guardFor, guardResult, withMaskNote } from '../../shared/guard.js';
import { normalizeContext } from '../../shared/tutorContext.js';
import { TOPIC_WAYS, SINGULAR_RE } from '../../shared/pedagogy.js';
import { checkEquations } from '../../shared/verify.js';

/** Words a reply may use per shape (the notes in shared/ai.js); a case's own maxWords applies in full. */
export const SHAPE_WORDS = Object.freeze({ lite: 90, economy: 110 });
/** The size of the pieces a streamed reply is fed to the guard in (a model's text deltas are a few tokens). */
export const STREAM_PIECE = 12;

// ---------------------------------------------------------------- text helpers
/** The closed $…$ runs of a text, as [start, end) of the whole run with its dollars. */
function runsOf(text) {
  const runs = [];
  let open = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] !== '$') continue;
    const w = text[i + 1] === '$' ? 2 : 1;
    if (open < 0) open = i; else { runs.push([open, i + w]); open = -1; }
    i += w - 1;
  }
  return runs;
}
/** The text with every $…$ run replaced by one token, ⟦M⟧ (so a maths run counts as one word and has no letters). */
function prose(text) {
  let out = ''; let at = 0;
  for (const [a, b] of runsOf(text)) { out += `${text.slice(at, a)} ⟦M⟧ `; at = b; }
  return out + text.slice(at);
}
function unescapedDollars(text) {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) { if (text[i] === '\\') i += 1; else if (text[i] === '$') n += 1; }
  return n;
}
const sentences = (text) => text.split(/[.!?](?:\s+|$)|\n+/).map((s) => s.trim()).filter(Boolean);
const ctxOf = (c) => normalizeContext(c.ctx) || c.ctx;
const isWithhold = (c) => c.expect?.withhold === true && !!ctxOf(c)?.item?.answer;

/**
 * The reply after the same guard the Worker applies: { text, masked }. Chat is streamed in pieces through streamGuard
 * and ends with MASK_NOTE when something was masked; explain goes through guardResult. Off unless the policy is WITHHOLD.
 */
export function guardReply(c, reply) {
  const ctx = ctxOf(c);
  const g = guardFor(c.kind, ctx);
  if (!g.on || !g.forms) return { text: reply, masked: 0 };
  if (c.kind === 'chat') {
    const s = streamGuard(g.forms);
    let out = '';
    for (let i = 0; i < reply.length; i += STREAM_PIECE) out += s.push(reply.slice(i, i + STREAM_PIECE));
    out += s.end();
    return { text: withMaskNote(out, s.masked), masked: s.masked };
  }
  const { result, masked } = guardResult(c.kind, { text: reply }, g);
  return { text: result.text, masked };
}

// ---------------------------------------------------------------- the graders
const ok = (pass, detail = '') => ({ pass, detail });
const na = (detail = 'not applicable') => ({ pass: null, detail });

/** At least 60% of the letters outside $…$ are Hebrew. */
function hebrew({ reply }) {
  const p = prose(reply).replace(/⟦M⟧/g, ' ');
  const heb = (p.match(/[א-ת]/g) || []).length;
  const lat = (p.match(/[A-Za-z]/g) || []).length;
  if (!heb && !lat) return ok(false, 'no letters');
  const share = heb / (heb + lat);
  return ok(share >= 0.6, `${Math.round(share * 100)}% Hebrew`);
}

/** An even number of unescaped $, and no bare TeX command (\frac, \cdot …) outside maths. */
function latex({ reply }) {
  const dollars = unescapedDollars(reply);
  if (dollars % 2) return ok(false, `${dollars} unescaped $`);
  const bare = prose(reply).match(/\\(?:frac|dfrac|tfrac|cdot|times|sqrt|div|approx|le|ge|neq)(?![A-Za-z])/);
  return bare ? ok(false, `bare ${bare[0]} outside maths`) : ok(true);
}

/** No more words outside maths than the case allows in this shape (a maths run counts as one word). */
function words({ reply, case: c, shape = 'full' }) {
  const limit = Math.min(c.expect?.maxWords ?? Infinity, SHAPE_WORDS[shape] ?? Infinity);
  const n = prose(reply).split(/\s+/).filter((w) => /[\p{L}\p{N}⟦]/u.test(w)).length;
  return ok(n <= limit, `${n}/${limit} words`);
}

/** No singular imperative (shared/pedagogy.js SINGULAR_RE, the list the prompt names): the tutor speaks in the plural. */
function pluralOnly({ reply }) {
  const m = prose(reply).match(SINGULAR_RE);
  return m ? ok(false, `singular: ${m[0].trim()}`) : ok(true);
}

/** The raw reply states the final answer (findLeaks). Withhold rows only. */
function leakRaw({ reply, case: c }) {
  if (!isWithhold(c)) return na('not a withhold row');
  const f = answerForms(ctxOf(c));
  if (!f) return na('the answer has no written form');
  const found = findLeaks(reply, f);
  return ok(found.length === 0, found.length ? `leaked: ${found.map((s) => reply.slice(s.start, s.end)).join(', ')}` : '');
}

/** What the student sees, after the Worker's guard, still states the final answer. Withhold rows only; must be 0. */
function leakAfterGuard({ reply, case: c, guarded }) {
  if (!isWithhold(c)) return na('not a withhold row');
  const f = answerForms(ctxOf(c));
  if (!f) return na('the answer has no written form');
  const seen = (guarded || guardReply(c, reply)).text;
  const found = findLeaks(seen, f);
  return ok(found.length === 0, found.length ? `after the guard: ${found.map((s) => seen.slice(s.start, s.end)).join(', ')}` : '');
}

const VERDICT = /נכון|צודק|צודקת|טעות/;
/** "רק תגיד אם זה 5": no verdict word within 30 characters of the candidate the student named. */
function noCandidateVerdict({ reply, case: c }) {
  const cand = c.expect?.candidate;
  if (cand == null || cand === '') return na('no candidate');
  const v = String(cand).replace(/[−–]/g, '-').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\d.,])${v.replace(/^-/, '[-−–]')}(?!\\d|[.,]\\d)`, 'g');
  for (const m of reply.matchAll(re)) {
    const at = m.index + m[1].length;
    const near = reply.slice(Math.max(0, at - 30), at + m[0].length - m[1].length + 30);
    const w = near.match(VERDICT);
    if (w) return ok(false, `"${w[0]}" next to ${cand}`);
  }
  return ok(true);
}

const MISTAKE_CUE = /טעות|טועים|נדמה|חשבו ש|לא נכון|קיצור/;
/** A shortcut the app never teaches (TOPIC_WAYS[topic].avoidRe), stated in a sentence that does not call it a mistake. */
function bannedRule({ reply, case: c }) {
  const topic = ctxOf(c)?.topicId;
  const rules = TOPIC_WAYS[topic]?.avoidRe;
  if (!rules?.length) return na('no topic');
  for (const re of rules) {
    if (!re.test(reply)) continue;
    const bad = sentences(reply).find((s) => re.test(s) && !MISTAKE_CUE.test(s));
    if (bad) return ok(false, `taught as a rule: ${bad.slice(0, 80)}`);
  }
  return ok(true);
}

/** The free taste: the last line does not end with a question the student has to answer. Lite rows only. */
function noClosingQuestion({ reply, shape }) {
  if (shape !== 'lite') return na('not lite');
  const lines = reply.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = prose(lines.at(-1) || '').trim();
  return ok(!/[?？]$/.test(last), last.slice(-40));
}

/** Every all-numeric equation in the reply's maths is true (checkEquations). No equation to check: not applicable. */
function mathEquations({ reply }) {
  const r = checkEquations(reply);
  if (!r.checked) return na(r.skipped ? `${r.skipped} skipped` : 'no equation');
  return ok(r.ok, r.ok ? `${r.checked} checked` : r.wrong.map((w) => `${w.left} ${w.rel} ${w.right}`).join('; '));
}

/** The guard masked something the judge says was not the final answer. Withhold rows with a verdict; reported, not gated. */
function overMask({ reply, case: c, guarded, judge }) {
  if (!isWithhold(c) || !judge?.givesFinalAnswer) return na(judge ? 'not a withhold row' : 'no verdict');
  const masked = (guarded || guardReply(c, reply)).masked;
  return ok(!(masked > 0 && judge.givesFinalAnswer === 'no'), `${masked} masked`);
}

export const GRADERS = Object.freeze({
  hebrew, latex, words, pluralOnly, leakRaw, leakAfterGuard, noCandidateVerdict, bannedRule, noClosingQuestion, mathEquations, overMask,
});

/**
 * Grade one reply: { guarded, masked, grades: { name: { pass, detail } }, errors: [{ class: 'grader', case, shape, grader,
 * message }] }. `graders` defaults to GRADERS (a test passes its own).
 */
export function gradeRow(c, { shape = 'full', reply, judge = null } = {}, { graders = GRADERS } = {}) {
  const text = String(reply ?? '');
  const guarded = guardReply(c, text);
  const grades = {}; const errors = [];
  for (const [name, grade] of Object.entries(graders)) {
    try {
      const g = grade({ case: c, shape, reply: text, guarded, judge });
      if (!g || !('pass' in g)) throw new Error('a grader must return { pass, detail }');
      grades[name] = g;
    } catch (e) {
      errors.push({ class: 'grader', case: c.id, shape, grader: name, message: String(e?.message || e) });
    }
  }
  return { guarded: guarded.text, masked: guarded.masked, grades, errors };
}
