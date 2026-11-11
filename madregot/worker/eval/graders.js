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
import { checkEquations, parseAnswer } from '../../shared/verify.js';
import { feedbackInput, studentsWords } from '../../shared/ai.js';

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

const eqKey = (left, right) => `${left}=${right}`.replace(/\s+/g, '').replace(/[−–]/g, '-');
/**
 * The false equations a reply may quote because they are the mistake itself: the student's own wrong result (a false
 * equation whose result is one of the student's answers, "חישבתם $-4 + 3 = 7$"), and the false examples in the app's
 * own texts about the mistakes of the stair ("למשל $(-3) \cdot (-4) = -12$" in a label). → { keys, values }.
 */
function mistakeQuotes(c) {
  const ctx = ctxOf(c);
  const answers = ctx?.tries?.answers || [];
  const texts = [ctx?.miscon?.label, ctx?.miscon?.cause, ...(ctx?.miscon?.explain || []), ...answers.flatMap((a) => a.labels || []),
    c.expect?.label, ...(c.expect?.others || []).map((o) => o.label)].filter((t) => typeof t === 'string');
  const keys = new Set(texts.flatMap((t) => checkEquations(t).wrong.map((w) => eqKey(w.left, w.right))));
  const values = answers.map((a) => String(a.value ?? '').trim()).filter((v) => /^[-−–]?\d+(?:[.,]\d+)?$/.test(v))
    .map((v) => Number(v.replace(/[−–]/g, '-').replace(',', '.')));
  return { keys, values };
}

/**
 * Every all-numeric equation in the reply's maths is true (checkEquations), except a false one that quotes the mistake
 * (mistakeQuotes): naming the student's mistake is what the tutor is told to do. No equation to check: not applicable.
 */
function mathEquations({ reply, case: c }) {
  const r = checkEquations(reply);
  if (!r.checked) return na(r.skipped ? `${r.skipped} skipped` : 'no equation');
  const q = mistakeQuotes(c);
  const wrong = r.wrong.filter((w) => !q.keys.has(eqKey(w.left, w.right)) && !q.values.some((v) => Math.abs(v - w.b) < 1e-9));
  const quoted = r.wrong.length - wrong.length;
  if (wrong.length) return ok(false, wrong.map((w) => `${w.left} ${w.rel} ${w.right}`).join('; '));
  return ok(true, `${r.checked} checked${quoted ? `, ${quoted} quoting the mistake` : ''}`);
}

/**
 * The guard masked something in a reply that, read before the guard, does not give the final answer. The judge reads
 * what the student sees, where a masked answer is already a "?", so this reads the judge's verdict on the raw reply
 * (judge.raw.givesFinalAnswer, asked by the runner only when the guard masked something). Withhold rows; a row with
 * nothing masked is fine. Reported, not gated: above 5% the guard's cues are too wide.
 */
function overMask({ reply, case: c, guarded, judge }) {
  if (!isWithhold(c)) return na('not a withhold row');
  const masked = (guarded || guardReply(c, reply)).masked;
  if (!masked) return ok(true, 'nothing masked');
  const said = judge?.raw?.givesFinalAnswer;
  if (!said) return na(`${masked} masked, no verdict on the raw reply`);
  return ok(said !== 'no', `${masked} masked; before the guard the reply ${said === 'no' ? 'gave no' : 'gave the'} final answer`);
}

// ---------------------------------------------------------------- feedback on a written explanation (category F, AI-10)
/**
 * What the tutor itself wrote in a feedback reply, as one text for the prose graders (Hebrew, LaTeX, plural, words,
 * equations, banned rules): the tips, then the summary. The quotes are the student's words and the rubric is the app's,
 * so neither is graded as the tutor's.
 */
export function feedbackProse(shown) {
  return [...(shown?.points || []).map((p) => p.tip).filter(Boolean), shown?.summary || ''].filter((t) => t.trim()).join('\n');
}

/**
 * The statuses the student sees (after the server's checks) are the ones a teacher gave the points (expect.points).
 * matched / total feed the gate, which pools the points of every row (Design 2 of AI-10's eval: ≥ 90% of points).
 * A reply that was not the asked JSON matches nothing.
 */
function feedbackMatch({ case: c, feedback }) {
  if (c.kind !== 'feedback') return na('not a feedback row');
  const want = (c.expect?.points || []).map((p) => p.status);
  const got = (feedback?.shown?.points || []).map((p) => p.status);
  const matched = want.filter((s, i) => got[i] === s).length;
  const wrong = want.map((s, i) => (got[i] === s ? null : `${i}: ${got[i] ?? 'none'} for ${s}`)).filter(Boolean);
  return { pass: want.length > 0 && matched / want.length >= 0.9, matched, total: want.length, detail: wrong.length ? wrong.join('; ') : `${matched}/${want.length}` };
}

/**
 * Every quote the model wrote (its own JSON, before the server blanked anything) is the student's words: found in the
 * student's text as the tutor got it (masked), after whitespace, quotation marks and $ are set aside. The server blanks a
 * quote that is not; this measures how often it has to. No quote at all: not applicable.
 */
function quoteIsStudents({ case: c, feedback }) {
  if (c.kind !== 'feedback') return na('not a feedback row');
  const quotes = (Array.isArray(feedback?.raw?.points) ? feedback.raw.points : []).map((p) => (typeof p?.quote === 'string' ? p.quote.trim() : '')).filter(Boolean);
  if (!quotes.length) return na('no quote');
  const { text } = feedbackInput(c.input);
  const invented = quotes.filter((q) => !studentsWords(text, q));
  return ok(invented.length === 0, invented.length ? `not the student's words: ${invented.map((q) => `"${q.slice(0, 60)}"`).join(', ')}` : `${quotes.length} quotes, all the student's`);
}

export const GRADERS = Object.freeze({
  hebrew, latex, words, pluralOnly, leakRaw, leakAfterGuard, noCandidateVerdict, bannedRule, noClosingQuestion, mathEquations, overMask,
  feedbackMatch, quoteIsStudents,
});

// ---------------------------------------------------------------- the generate pipeline (category G)
/** The value a solution step ends at: the right-hand side of the last "=" in its last $…$ run (read on its own here). */
function stepEnd(step) {
  const runs = String(step ?? '').match(/\$[^$]+\$/g);
  if (!runs) return null;
  const rhs = runs.at(-1).slice(1, -1).split('=').at(-1);
  const v = parseAnswer(rhs);
  return typeof v === 'number' ? v : null;
}

/**
 * One generate pipeline (AI-7 Design 3, the generate grader): what generateVerified kept for the student, against the
 * app's seeds. → { grades: { passShare, shownWrong }, errors }.
 *   passShare   the share of the seeds whose story passed (pass: at least c.expect.passShare); the gate takes the mean
 *               of each stair over its repetitions
 *   shownWrong  exercises shown whose answer is not the app's: a solution that ends elsewhere, a blind solve that
 *               disagreed, an exercise for a seed that was not asked. Always 0 by construction; asserted.
 */
export function gradeGenerate(c, { items = [], dropped = {}, blindAnswers = null } = {}) {
  const errors = [];
  const grades = {};
  try {
    const seeds = c.input.seeds;
    const share = seeds.length ? items.length / seeds.length : 0;
    const bar = c.expect?.passShare ?? 0.8;
    const why = Object.entries(dropped).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ') || 'none dropped';
    grades.passShare = { pass: share >= bar, share, detail: `${items.length} of ${seeds.length} stories passed (${why})` };
    const wrong = [];
    for (const it of items) {
      const seed = seeds.find((sd) => sd.i === it.seed);
      const want = seed ? parseAnswer(seed.answer) : null;
      const tol = (seed?.round ? 0.05 : 0.01) + 1e-9;
      const end = stepEnd(it.solution?.at(-1));
      const blind = it.blind === 'ok' ? parseAnswer(blindAnswers?.find((a) => a.seed === it.seed)?.answer) : null;
      if (typeof want !== 'number') wrong.push(`${it.seed}: no such seed`);
      else if (end == null || Math.abs(end - want) > tol) wrong.push(`${it.seed}: the solution ends at ${end}, the app's answer is ${want}`);
      else if (it.blind === 'ok' && (typeof blind !== 'number' || Math.abs(blind - want) > tol)) wrong.push(`${it.seed}: the blind solve gave ${blind}`);
    }
    grades.shownWrong = { pass: wrong.length === 0, n: wrong.length, detail: wrong.length ? wrong.join('; ') : `${items.length} shown, every one at the app's answer` };
  } catch (e) {
    errors.push({ class: 'grader', case: c.id, shape: 'full', grader: 'generate', message: String(e?.message || e) });
  }
  return { grades, errors };
}

/**
 * Grade one reply: { guarded, masked, grades: { name: { pass, detail } }, errors: [{ class: 'grader', case, shape, grader,
 * message }] }. `graders` defaults to GRADERS (a test passes its own). A feedback row passes `reply` as the tutor's own
 * prose (feedbackProse) and `feedback`: { raw: the model's JSON, shown: the reply after the server's checks }.
 */
export function gradeRow(c, { shape = 'full', reply, judge = null, feedback = null } = {}, { graders = GRADERS } = {}) {
  const text = String(reply ?? '');
  const guarded = guardReply(c, text);
  const grades = {}; const errors = [];
  for (const [name, grade] of Object.entries(graders)) {
    try {
      const g = grade({ case: c, shape, reply: text, guarded, judge, feedback });
      if (!g || !('pass' in g)) throw new Error('a grader must return { pass, detail }');
      grades[name] = g;
    } catch (e) {
      errors.push({ class: 'grader', case: c.id, shape, grader: name, message: String(e?.message || e) });
    }
  }
  return { guarded: guarded.text, masked: guarded.masked, grades, errors };
}
