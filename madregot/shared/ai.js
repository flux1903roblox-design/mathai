// Claude requests for Madregot, shared by the Cloudflare Worker (server mode)
// and the browser (personal-key mode). Each builder returns the params for
// client.beta.messages.create / .stream from @anthropic-ai/sdk.

import { safetyPrompt, CARE_MARK, maskPersonal } from './safety.js';
import { normalizeContext, legacyToV2, renderContext, CTX_BUDGET } from './tutorContext.js';
import { stableSystem } from './pedagogy.js';
import { guardFor } from './guard.js';
import { TOPIC_NAMES } from './stairs.js';
import { finishRewrite } from './verify.js';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
// Server-side refusal fallback: a declined request is re-run on Anthropic's
// recommended model for that refusal category instead of coming back empty.
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const AI_KINDS = ['explain', 'chat', 'generate', 'check', 'exam', 'feedback'];
// Topic ids the exam check maps each question to, so the app can recommend practice: every topic the app teaches
// (shared/stairs.js, one list for the app, the Worker and the prompt), and 'other'.
export const TOPIC_IDS = Object.freeze([...Object.keys(TOPIC_NAMES), 'other']);
export const MAX_EXAM_PAGES = 8;

// The stable first block of every tutor request (ai spec AI-2, AI-5, AI-6): the safety block first (trust spec TRUST-3),
// then the tutor, the pedagogy, the stair map and the topic ways (shared/pedagogy.js). The same bytes for every kind,
// shape, context and user on a model, so it is the prompt-cache prefix (cache_control on this block).
export { stableSystem };

// What a photographed page may show and the tutor never copies (trust spec TRUST-5 §5).
const PERSONAL_RULE = "If the pages show a person's name, ID number, class, school or any other identifying detail, never copy it into your answer: write [פרטים אישיים] instead.";

const TASKS = {
  // Appendix C.1
  explain: `Task: the student answered the exercise in the app context incorrectly and asked why. In this order:
1. One sentence that says what went wrong, as the app diagnosed it (pedagogy rule 1), using the app's own wording for the mistake.
2. One or two sentences on why this mistake is natural and what the right idea is, from the stair's own explanation of it.
3. The right way in 2-4 short numbered steps that follow the app's worked solution.
Do not repeat the whole topic, and do not repeat word for word the line the app already showed. Follow the final-answer policy: under REVEAL you may end at the answer; under WITHHOLD leave the last result as "?".`,
  // Appendix C.2
  chat: `Task: the student is working on the exercise in the app context (or, in HOMEWORK, on a question of their own) and asks you about it. Follow the final-answer policy in the app context exactly.
- WITHHOLD: the student has not seen the answer yet. Never write the final answer in any form (a number, a fraction, a point, an expression, the chosen option), and never write the last computation with its result. Give the next step only, or a question that leads to it, or a smaller example with different numbers. If the student asks for the answer, says they tried, or insists, give a stronger hint: the next step written out, with its result if it is not the last step. Then remind them kindly that after a second try the app shows the full solution. If they suggest an answer, do not confirm it or reject it; tell them to type it in the answer box, where the app checks it.
- REVEAL: the answer is already on the student's screen. Use it, and explain how to get there.
- HOMEWORK: the question is the student's own and the app does not know its answer. Lead step by step and leave the last computation to the student. If they give their own final answer, check it (by substituting back, or by redoing the step) and say whether it is right; if it is not, show the first step that went wrong. If after two hints they are still stuck, show a complete worked example with different numbers, and let them solve their own.`,
  // Appendix C.4: the app makes the numbers and the answer (the seeds); the tutor only writes the words around them
  generate: `Task: rewrite practice exercises in new words. Each seed below is an exercise the app made: its text, and its answer, which the app computed. For each seed write one new exercise that asks exactly the same question about exactly the same numbers, in a different everyday Israeli context or wording for ages 12-14 (a class trip, a basketball league, a bank account, the level of the Kinneret, a bike ride, prices at the shuk).
Rules:
- Keep every number of the seed, unchanged, in your text. A negative number may be said in words ("6 מעלות מתחת לאפס").
- Do not add a number the solver needs that is not in the seed. Ask for the same quantity, so the seed's answer stays the answer. Keep the units. One question only.
- Hint: points to the first step and never contains the answer.
- Solution: 2-5 short steps in the words of your story. Every equation you write must be true. The last step ends with the seed's answer written in maths exactly as given, with its sign, for example "$= -6$", even when the story says it in words ("6 מעלות מתחת לאפס").
- A seed marked [drawing] comes with a drawing the student sees: keep its wording exactly, set "kept" to true, and write only the hint and the solution.
- If any other seed cannot be put in a story without changing it, keep its wording and set "kept" to true.`,
  exam: `Task: the student uploaded a practice exam they completed (photos of the pages, or a PDF). Check it like a careful teacher.
For every question on the pages: transcribe the question, the student's final answer and the key line of their working; decide whether it is correct, partially correct, wrong, or not answered.
If an answer key is provided, it is authoritative: compare the student's answer with it and never re-grade against your own solution. Without a key, solve each question yourself carefully and check your result before grading.
Feedback must be personal: name the specific mistake in this student's working and why it happened, not only the right answer. For a correct answer, say briefly what was done well.
Give a model solution in short steps for every question. Map each question to one topic id from the list and to the number of the level in that topic's list that it practises (0 if none fits), and name the skill in a few Hebrew words.
Finally list the weak topics (only where the student lost points) with the reason, and 3 to 5 concrete next steps.
${PERSONAL_RULE} The exam title must name the subject only, never a person.`,
  // Appendix C.8 (ai spec AI-10): which rubric points the student's own words already cover; never a rewrite, never a score
  feedback: `Task: the student wrote their own explanation for a challenge question in the app context. You get the rubric points a good explanation covers, and the app's model answer for your reference only. For each rubric point, say whether the student's own words already cover it ("yes"), cover part of it ("partly") or not yet ("no"). For "yes" and "partly", copy the student's exact words that do it into "quote". For "partly" and "no", give one short hint (at most 20 words, plural) that points to what is missing without writing the sentence for them. Never rewrite the student's explanation, never quote or paraphrase the model answer, and never give a score. The summary is one or two honest sentences: what is already good, and what to add.`,
  check: `Task: the student photographed their handwritten work. First transcribe what you can read. Then check each step in order: mark each as correct or not, and for the first wrong step say exactly what went wrong. Do not redo the whole exercise for them; point to the step to fix. If the photo is unreadable, say what is missing (light, focus, the whole page).
${PERSONAL_RULE}
If the final-answer policy in the app context is WITHHOLD, judge each step that leads to the result, but never write the final value in a comment or the summary, never say whether the final value is right, and set "final" to "unknown": the student types the answer in the app, which checks it. (The app does not show your mark on the line that states the final value.)`,
};

// ---------------------------------------------------------------- generated exercises (ai spec AI-4)
/** The rewrite's reply (Design 3): one exercise per seed, by the seed's index. Never an answer: the seed has the app's. */
export const REWRITE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['seed', 'prompt', 'hint', 'solution', 'kept'],
        properties: {
          seed: { type: 'integer', description: 'The index of the seed this exercise rewrites' },
          prompt: { type: 'string', description: 'The new exercise in Hebrew, maths in $...$' },
          hint: { type: 'string', description: 'Points to the first step; never contains the answer' },
          solution: { type: 'array', items: { type: 'string' }, description: '2-5 short steps; the last ends with the answer' },
          kept: { type: 'boolean', description: 'true if the seed could not be put in a new story and its wording was kept' },
        },
      },
    },
  },
});
/** The rewrite on the main model (AI-6 table): medium effort; thinking counts toward the cap, so 8,000 leaves room. */
export const REWRITE_EFFORT = 'medium';
export const REWRITE_MAX_TOKENS = 8000;
/** Seeds a request may carry: count 3 or 5, plus 2 spares (Design 2). */
export const MAX_SEEDS = 8;

/**
 * The seeds of a generate request as the app sent them ({ i, text, answer, round, fig }): each with a whole index used
 * once, a text and an answer; anything else is left out. Throws when none is left: an older app that sent no seeds is
 * answered 400 bad_input and nothing is counted.
 */
export function seedsOf(input = {}) {
  const seen = new Set();
  const seeds = [];
  for (const s of Array.isArray(input.seeds) ? input.seeds.slice(0, MAX_SEEDS) : []) {
    if (!s || !Number.isInteger(s.i) || s.i < 0 || seen.has(s.i)) continue;
    const text = clip(s.text, 600).trim(); const answer = clip(s.answer, 40).trim();
    if (!text || !answer) continue;
    seen.add(s.i);
    seeds.push({ i: s.i, text, answer, round: s.round === true, fig: s.fig === true });
  }
  if (!seeds.length) throw new Error('generate needs the app\'s seeds');
  return seeds;
}

// ---------------------------------------------------------------- the blind solve of generated exercises (AI-4)
/** Appendix C.7: the blind solve's system text. It sees only the stories, never the seeds or their answers. */
export const BLIND_SYSTEM = 'Solve each exercise on your own. Answer with the final answer only: an integer, a decimal, a fraction a/b, or a point (x, y). If an exercise can be read in more than one way, or is missing information, answer "unclear".';
export const BLIND_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['answers'],
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['seed', 'answer'],
        properties: {
          seed: { type: 'integer', description: 'The number of the exercise' },
          answer: { type: 'string', description: 'The final answer only: "-3", "2.5", "3/4", "(2, -1)", or "unclear"' },
        },
      },
    },
  },
});
// strict instruction following on the low-cost model, with room for the thinking it does by default (AI-6 table)
export const BLIND_EFFORT = 'high';
export const BLIND_MAX_TOKENS = 6000;

/**
 * The blind solve (ai spec AI-4 Design 4): the stories the rewrite wrote, numbered by their seed, and nothing else: no
 * seed, no answer, no solution, no context. A story that kept the app's own wording (kept) is not sent: it has no new
 * wording to check. model: BLIND_MODEL, else the low-cost model. Throws when there is no story to solve.
 */
export function buildBlind(items, { model } = {}) {
  const stories = (Array.isArray(items) ? items : [])
    .filter((it) => it && Number.isInteger(it.seed) && !it.kept && typeof it.prompt === 'string' && it.prompt.trim())
    .map((it) => `${it.seed}. ${clip(it.prompt, 800).replace(/\s+/g, ' ').trim()}`);
  if (!stories.length) throw new Error('the blind solve needs at least one story');
  const params = {
    model: model || LITE_MODEL,
    max_tokens: BLIND_MAX_TOKENS,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: BLIND_SYSTEM,
    output_config: { effort: BLIND_EFFORT, format: { type: 'json_schema', schema: BLIND_SCHEMA } },
    messages: [{ role: 'user', content: `Exercises:\n${stories.join('\n')}\n\nGive the answer to each exercise, by its number.` }],
  };
  return supportsFallback(params.model) ? params : dropFallback(params);
}

const CARE_FIELD = 'true if the page, the notes or the question show the student is in distress or danger';

const EXAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'title', 'questions', 'summary', 'weakTopics', 'nextSteps', 'care'],
  properties: {
    readable: { type: 'boolean' },
    care: { type: 'boolean', description: CARE_FIELD },
    title: { type: 'string', description: 'A short name for the exam, from the pages: the subject only. Never copy a name, ID number, class or school into it; write [פרטים אישיים] instead.' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'prompt', 'studentAnswer', 'status', 'correctAnswer', 'feedback', 'solution', 'topic', 'level', 'skill'],
        properties: {
          number: { type: 'string' },
          prompt: { type: 'string', description: 'The question, math in $...$' },
          studentAnswer: { type: 'string', description: 'What the student wrote as the final answer, math in $...$; empty if none' },
          status: { type: 'string', enum: ['correct', 'partial', 'wrong', 'missing'] },
          correctAnswer: { type: 'string', description: 'The correct final answer, math in $...$' },
          feedback: { type: 'string', description: 'Personal feedback on this student\'s answer' },
          solution: { type: 'array', items: { type: 'string' }, description: 'Model solution steps, math in $...$' },
          topic: { type: 'string', enum: TOPIC_IDS },
          level: { type: 'integer', description: "The level number in that topic's level list that this question practises; 0 if none fits" },
          skill: { type: 'string', description: 'The skill in a few Hebrew words' },
        },
      },
    },
    summary: { type: 'string' },
    weakTopics: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['topic', 'reason'],
        properties: { topic: { type: 'string', enum: TOPIC_IDS }, reason: { type: 'string' } },
      },
    },
    nextSteps: { type: 'array', items: { type: 'string' } },
  },
};

const CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'transcript', 'steps', 'final', 'summary', 'care'],
  properties: {
    readable: { type: 'boolean' },
    care: { type: 'boolean', description: CARE_FIELD },
    transcript: { type: 'string', description: 'What is written, math in $...$' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'ok', 'comment'],
        properties: {
          text: { type: 'string', description: 'The step as written, math in $...$' },
          ok: { type: 'boolean' },
          comment: { type: 'string', description: 'Empty when the step is fine' },
        },
      },
    },
    final: { type: 'string', enum: ['correct', 'wrong', 'unfinished', 'unknown'] },
    summary: { type: 'string', description: 'One or two sentences for the student' },
  },
};

const clip = (s, n) => String(s ?? '').slice(0, n);
/** Text a child wrote, as it goes to the AI: personal details masked first, then clipped (trust spec TRUST-4 §4.1). */
const own = (s, n) => clip(maskPersonal(s).text, n);

// ---------------------------------------------------------------- feedback on a written explanation (ai spec AI-10)
/** What a feedback request may carry (Design 2): 1-6 rubric points of at most 200 characters, a model answer of 600, and
 * the student's own explanation of 1,200. */
export const FEEDBACK_RUBRIC_MAX = 6;
export const FEEDBACK_RUBRIC_CHARS = 200;
export const FEEDBACK_SAMPLE_CHARS = 600;
export const FEEDBACK_TEXT_CHARS = 1200;
/** Design 5: the paid model at low effort (a short, structured reply); lite and economy use the shape table (high, 4,000). */
export const FEEDBACK_EFFORT = 'low';
export const FEEDBACK_MAX_TOKENS = 3000;
/** Design 4: a tip of at most 20 words, a summary of 40, and a tip that repeats more than 8 words of the model answer in a
 * row is dropped (a rewrite in disguise). */
export const FEEDBACK_TIP_WORDS = 20;
export const FEEDBACK_SUMMARY_WORDS = 40;
export const FEEDBACK_COPY_WORDS = 8;
export const FEEDBACK_STATUSES = Object.freeze(['yes', 'partly', 'no']);

/**
 * The reply (Design 3): per rubric point, whether the student's own words cover it, their words that do, and one short
 * tip; then a summary, never a score. `care` is the safety block's JSON flag (trust spec TRUST-3: "In a JSON answer, set
 * care to true"), as in the check and exam schemas: without it a strict schema would leave the model no way to say so.
 */
export const FEEDBACK_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['points', 'summary', 'care'],
  properties: {
    points: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['i', 'status', 'quote', 'tip'],
        properties: {
          i: { type: 'integer', description: 'The rubric point index, from 0' },
          status: { type: 'string', enum: [...FEEDBACK_STATUSES] },
          quote: { type: 'string', description: 'The exact words of the student that cover this point, copied; empty when status is no' },
          tip: { type: 'string', description: 'For partly or no: one short hint in Hebrew, plural, at most 20 words, that does not write the sentence for them; empty for yes' },
        },
      },
    },
    summary: { type: 'string', description: 'One or two short Hebrew sentences, plural, honest and specific; no score' },
    care: { type: 'boolean', description: 'true if the explanation shows the student is in distress or danger' },
  },
});

/**
 * A feedback request's own fields as the tutor gets them: { rubric, sample, text }. The rubric and the model answer are
 * the app's (clipped); the explanation is the student's own words: personal details masked, then clipped (trust spec
 * TRUST-4 §4.1). Throws on a rubric that is not 1-6 non-empty strings (its indices are the screen's lines) and on an
 * empty explanation. readResult reads the same fields, so a quote is checked against exactly what the tutor saw.
 */
export function feedbackInput(input = {}) {
  const raw = input.rubric;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > FEEDBACK_RUBRIC_MAX) throw new Error(`feedback needs 1-${FEEDBACK_RUBRIC_MAX} rubric points`);
  const rubric = raw.map((r) => (typeof r === 'string' ? clip(r.replace(/\s+/g, ' ').trim(), FEEDBACK_RUBRIC_CHARS) : ''));
  if (rubric.some((r) => !r)) throw new Error('every rubric point needs its text');
  const sample = typeof input.sample === 'string' ? clip(input.sample.trim(), FEEDBACK_SAMPLE_CHARS) : '';
  const text = typeof input.text === 'string' ? own(input.text, FEEDBACK_TEXT_CHARS).trim() : '';
  if (!text) throw new Error('feedback needs the student\'s explanation');
  return { rubric, sample, text };
}

// Text as a quote is matched: spaces collapsed, no $, one kind of quotation mark and of dash, Latin in lower case. Each
// kept character remembers where it was, so a match is cut from the student's own text.
const QUOTE_MARKS = /["״“”„«»]/; const APOSTROPHES = /['׳‘’`]/; const DASHES = /[־‐‑–—−]/;
function matchable(s) {
  let out = ''; const at = [];
  for (let i = 0; i < s.length; i += 1) {
    let ch = s[i];
    if (ch === '$') continue;
    if (/\s/.test(ch)) { if (!out || out.endsWith(' ')) continue; ch = ' '; }
    else if (QUOTE_MARKS.test(ch)) ch = '"';
    else if (APOSTROPHES.test(ch)) ch = "'";
    else if (DASHES.test(ch)) ch = '-';
    else ch = ch.toLowerCase();
    out += ch; at.push(i);
  }
  return { out, at };
}
// what a quote may carry around the student's words: quotation marks, an ellipsis, a closing full stop
const QUOTE_EDGE = /^[\s"'״׳“”„«»‘’…]+|[\s"'״׳“”„«»‘’….,;:!?]+$/g;

/**
 * The student's own words for a quote (Design 4): the stretch of `text` the quote copies, matched after whitespace (and
 * the quotation marks, dashes and $ a model may change) are normalised, cut from the student's text so the screen can
 * highlight it. '' when the quote is not in the text, or is too short to point at anything.
 */
export function studentsWords(text, quote) {
  const q = matchable(String(quote ?? '').replace(QUOTE_EDGE, '')).out.trim();
  if ((q.match(/[\p{L}\p{N}]/gu) || []).length < 2) return '';
  const t = matchable(String(text ?? ''));
  const k = t.out.indexOf(q);
  if (k < 0) return '';
  return String(text).slice(t.at[k], t.at[k + q.length - 1] + 1);
}

const wordsOf = (s) => String(s ?? '').replace(/\$/g, ' ').split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()).filter(Boolean);
/** Does `a` repeat more than `n` words of `b` in a row (the same words, in order, punctuation and $ aside)? */
export function copiesRun(a, b, n = FEEDBACK_COPY_WORDS) {
  const x = wordsOf(a); const y = wordsOf(b);
  if (x.length <= n || y.length <= n) return false;
  const runs = new Set();
  for (let i = 0; i + n < y.length; i += 1) runs.add(y.slice(i, i + n + 1).join(' '));
  for (let i = 0; i + n < x.length; i += 1) if (runs.has(x.slice(i, i + n + 1).join(' '))) return true;
  return false;
}

/** At most n words, cut at a word and never inside $…$, with "…" when anything was cut. */
export function clipWords(s, n) {
  const words = String(s ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return words.join(' ');
  let out = words.slice(0, n).join(' ');
  if ((out.match(/(^|[^\\])\$/g) || []).length % 2) out = out.slice(0, out.lastIndexOf('$')).trim();
  return `${out.replace(/[\s,;:–-]+$/, '')}…`;
}

/**
 * The feedback reply as the student may see it (Design 4): one entry per rubric point, in order (a missing one is "no",
 * an extra or repeated one is dropped); a quote that is not the student's own words blanked (and none on "no"); a tip
 * only on "partly" and "no", at most 20 words, and dropped when it repeats the model answer; the summary at most 40
 * words. A care reply keeps its summary whole: it carries the help lines. → { points, summary, care }.
 */
function readFeedback(data, input) {
  if (!data || !Array.isArray(data.points) || typeof data.summary !== 'string') throw Object.assign(new Error('not a feedback reply'), { code: 'bad_output' });
  const { rubric, sample, text } = feedbackInput(input);
  const byIndex = new Map();
  for (const p of data.points) {
    if (!p || !Number.isInteger(p.i) || p.i < 0 || p.i >= rubric.length || byIndex.has(p.i) || !FEEDBACK_STATUSES.includes(p.status)) continue;
    byIndex.set(p.i, p);
  }
  const points = rubric.map((_, i) => {
    const p = byIndex.get(i);
    if (!p) return { i, status: 'no', quote: '', tip: '' };
    const quote = p.status === 'no' ? '' : studentsWords(text, p.quote);
    const tip = p.status === 'yes' || typeof p.tip !== 'string' || (sample && copiesRun(p.tip, sample)) ? '' : clipWords(p.tip, FEEDBACK_TIP_WORDS);
    return { i, status: p.status, quote, tip };
  });
  const care = data.care === true;
  return { points, summary: care ? data.summary.trim() : clipWords(data.summary, FEEDBACK_SUMMARY_WORDS), care };
}

/** The grade line that leads the exam and generate requests ('' with no grade): those kinds keep their own inputs. */
export function gradeLine(grade) {
  return grade ? `Grade: ${grade === '8' ? '8 (ח׳)' : '7 (ז׳)'}` : '';
}

/**
 * What the app knows for explain, chat and check (ai spec AI-1): the version-2 context the screens send as input.ctx,
 * else the old flat fields (for chat, input.context) read as one. → { ctx, v2 }.
 */
export function tutorContext(kind, input = {}) {
  const v2 = normalizeContext(input.ctx);
  return { ctx: v2 ?? legacyToV2(input, kind), v2: !!v2 };
}

/**
 * The final-answer guard for a request (ai spec AI-3 Design 3): on for chat, explain and check when the app's context
 * (version 2, or the old flat fields read the same conservative way) says WITHHOLD and carries the answer. → { on, forms }
 * for guardResult and streamGuard (shared/guard.js). The Worker and the personal-key path both use it.
 */
export function answerGuard(kind, input = {}) {
  if (kind !== 'chat' && kind !== 'explain' && kind !== 'check') return { on: false, forms: null };
  return guardFor(kind, tutorContext(kind, input).ctx);
}

// No top-level cache_control here: every kind caches system[0] (systemBlocks), the bytes every request shares. Only a
// conversation adds the top-level mark (AUTO_CACHE), which caches its growing history for the next turn; on explain,
// check, generate and exam the last block is unique, so auto-caching only paid the write price (ai spec AI-6 §4).
const base = (model, effort, maxTokens) => ({
  model: model || DEFAULT_MODEL,
  max_tokens: maxTokens,
  betas: [FALLBACK_BETA],
  fallbacks: 'default',
  output_config: { effort },
});
const AUTO_CACHE = { cache_control: { type: 'ephemeral' } };

// Which AI kinds share a daily limit (a "group"), and what each kind weighs against a class-wide cap.
export const KIND_GROUP = { explain: 'tutor', chat: 'tutor', check: 'check', generate: 'generate', exam: 'exam', feedback: 'tutor' };
export const AI_UNITS = { explain: 1, chat: 1, check: 4, generate: 3, exam: 20, feedback: 1 };
export const AI_GROUPS = ['tutor', 'check', 'generate', 'exam'];
// The free taste covers only the short kinds: the tutor's group (feedback on a written explanation is one of its
// questions, ai spec AI-10).
export const FREE_KINDS = ['explain', 'chat', 'feedback'];
// The model for the free taste and for economy mode when FREE_MODEL is empty. Never the main model.
export const LITE_MODEL = 'claude-haiku-5-5';
// Effort and max_tokens per kind and shape (ai spec AI-6 §2). The low-cost model runs the free taste and economy mode at
// effort high, the vendor's level for strict instruction following: the rules (the app's diagnosis, the stair's way, the
// final-answer policy) are the product. It thinks by default and thinking counts toward max_tokens, so the cap leaves room
// for it; the notes below keep the visible reply short. AI-9's evaluation run may move these, one line each.
export const LITE_EFFORT = 'high';
/** Paid chat's effort: the guide's starting point for chat, with the guard behind it. The evaluation sweeps 'medium'. */
export const CHAT_EFFORT = 'low';
export const LITE_MAX_TOKENS = 4000;
export const ECONOMY_MAX_TOKENS = 4000;
/** The free taste's note (Appendix C.5): a reply that stands on its own, never a whole answer handed over. */
export const LITE_NOTE = 'This student has only a few questions to the tutor today, so this reply must stand on its own: at most 90 words, no question they need to answer back to you, and end with what to do now ("עכשיו נסו …"). Every rule above still holds: the app\'s diagnosis, the stair\'s way, and the final-answer policy.';
/** Economy mode's note (Appendix C.6): shorter, nothing else changes. */
export const ECONOMY_NOTE = 'Keep this reply to at most 110 words. Every rule above still holds.';

/** The low-cost model family has no server-side refusal fallback, so its requests carry neither the fallback beta nor `fallbacks`. */
export function supportsFallback(model) { return !/^claude-haiku/.test(String(model || DEFAULT_MODEL)); }
function dropFallback(params) {
  delete params.fallbacks;
  const betas = (params.betas || []).filter((b) => b !== FALLBACK_BETA);
  if (betas.length) params.betas = betas; else delete params.betas;
  return params;
}

/**
 * Build the request params for one AI action. Throws on invalid input.
 * shape: 'full' (every kind, the main model), 'lite' (the free taste: the tutor's kinds only, FREE_KINDS, a low-cost
 * model, one short answer) or 'economy' (a paid pool over its monthly budget: the same kinds on the low-cost model,
 * shorter).
 * `lite: true` is kept as an alias of shape 'lite'.
 */
export function buildRequest(kind, input = {}, { model, shape, lite = false } = {}) {
  const sh = shape || (lite ? 'lite' : 'full');
  if (sh === 'full') {
    const params = buildFull(kind, input, { model });
    return supportsFallback(params.model) ? params : dropFallback(params);
  }
  if (sh !== 'lite' && sh !== 'economy') throw new Error(`unknown request shape: ${sh}`);
  if (!FREE_KINDS.includes(kind)) throw new Error(`${kind} has no ${sh} form`);
  const short = sh === 'lite';
  const params = buildFull(kind, input, {
    model: model || LITE_MODEL,
    shape: sh,
    ...(short ? { maxMessages: 6, messageChars: 600, fromUser: true } : {}),
  });
  params.max_tokens = short ? LITE_MAX_TOKENS : ECONOMY_MAX_TOKENS;
  params.output_config = { ...params.output_config, effort: LITE_EFFORT };
  return supportsFallback(params.model) ? params : dropFallback(params);
}

// The note a shape adds to the task block (ai spec AI-6 §1). It only shortens: system[0] is the same bytes in every shape.
const SHAPE_NOTE = { full: '', lite: LITE_NOTE, economy: ECONOMY_NOTE };

/**
 * The system prompt as blocks (ai spec AI-1 §2, AI-6 §4): [0] the stable block (safety, then the tutor), the cache
 * breakpoint, the same bytes for every request; [1] the task for this kind, with the shape's note; [2] the app's context
 * for explain, chat and check. The context is in the system prompt, never in the student's turn, so nothing a student
 * types can pose as the app.
 */
function systemBlocks(kind, shape, context) {
  const note = SHAPE_NOTE[shape] || '';
  return [
    { type: 'text', text: stableSystem(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: note ? `${TASKS[kind]}\n\n${note}` : TASKS[kind] },
    ...(context ? [{ type: 'text', text: context }] : []),
  ];
}

// ---------------------------------------------------------------- the care-only request
export const CARE_NOTE = "This reply is only about the student's wellbeing. Do not do any mathematics in this reply.";
export const CARE_MAX_TOKENS = 700;
export const CARE_MESSAGES = 4;

/**
 * The request for a message that reads as distress (trust spec TRUST-3 §3.4): the safety block and a "no mathematics"
 * line, the last 4 chat messages (or the explain fields), 700 tokens, low effort, no output format. It carries no
 * exercise context, so a distress phrase in front of a maths question cannot be used as a free maths channel.
 */
export function buildCare(input = {}, { model } = {}) {
  let history = (Array.isArray(input.messages) ? input.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-CARE_MESSAGES)
    .map((m) => ({ role: m.role, content: own(m.content, 2000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length) {
    // an explain's typed answer, a help note, or a challenge explanation sent for feedback (ai spec AI-10)
    const said = [input.studentAnswer, input.note, input.text].filter((x) => typeof x === 'string' && x.trim()).map((x) => own(x, 2000)).join('\n');
    if (!said) throw new Error('care needs a student message');
    history = [{ role: 'user', content: said }];
  }
  const params = {
    ...base(model, 'low', CARE_MAX_TOKENS),
    ...AUTO_CACHE, // a conversation, like chat
    system: `${safetyPrompt()}\n\n${CARE_NOTE}`,
    messages: history,
  };
  return supportsFallback(params.model) ? params : dropFallback(params);
}

const CARE_LEAD = new RegExp(`^\\s*${CARE_MARK.replace(/[[\]]/g, '\\$&')}[ \\t]*\\r?\\n?`);
/** A reply that starts with the care line: the line is removed and the reply is marked care. */
export function splitCare(text) {
  const m = String(text ?? '').match(CARE_LEAD);
  return m ? { text: String(text).slice(m[0].length), care: true } : { text: String(text ?? ''), care: false };
}

function buildFull(kind, input = {}, { model, shape = 'full', maxMessages = 12, messageChars = 2000, fromUser = false } = {}) {
  if (!TASKS[kind]) throw new Error(`unknown AI action: ${kind}`);
  const budget = CTX_BUDGET[shape] ?? CTX_BUDGET.full;
  const appContext = () => {
    const t = tutorContext(kind, input);
    return { ...t, text: renderContext(t.ctx, { budget }) };
  };
  if (kind === 'explain') {
    const { text } = appContext();
    return {
      ...base(model, 'medium', 4000),
      system: systemBlocks(kind, shape, text),
      messages: [{ role: 'user', content: 'Explain my mistake.' }],
    };
  }
  if (kind === 'chat') {
    const history = (Array.isArray(input.messages) ? input.messages : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-maxMessages)
      .map((m) => ({ role: m.role, content: own(m.content, messageChars) }));
    // a shortened chat still starts from a student turn
    if (fromUser) while (history.length > 1 && history[0].role !== 'user') history.shift();
    if (!history.length || history[0].role !== 'user') throw new Error('chat needs a user message first');
    // only the student's own words: the app's context is the system block, never spliced into their turn
    // the one kind with the top-level mark: the next turn reads this turn's history from the cache
    return { ...base(model, CHAT_EFFORT, 4000), ...AUTO_CACHE, system: systemBlocks(kind, shape, appContext().text), messages: history };
  }
  if (kind === 'generate') {
    // the seeds are the app's exercises with the answers it computed (Design 1-3): the tutor rewrites their words only
    const seeds = seedsOf(input);
    const stair = input.stair || input.level;
    const head = [gradeLine(input.grade), input.topic && `Topic: ${clip(input.topic, 120)}`, stair && `Stair: ${clip(stair, 120)}`].filter(Boolean).join('\n');
    const lines = seeds.map((sd) => `${sd.i}. ${sd.text.replace(/\s+/g, ' ')} → ${sd.answer}${sd.fig ? ' [drawing]' : ''}`);
    return {
      ...base(model, REWRITE_EFFORT, REWRITE_MAX_TOKENS),
      system: systemBlocks(kind, shape),
      output_config: { effort: REWRITE_EFFORT, format: { type: 'json_schema', schema: REWRITE_SCHEMA } },
      messages: [{
        role: 'user',
        content: `${head ? `${head}\n\n` : ''}Seeds:\n${lines.join('\n')}\n\nWrite ${seeds.length} exercises, one per seed.`,
      }],
    };
  }
  if (kind === 'feedback') {
    // Design 2 and 5: the app's context (surface 'challenge') in the system block; the rubric, the model answer and the
    // student's masked explanation in the turn
    const { rubric, sample, text } = feedbackInput(input);
    const { v2, text: context } = appContext();
    if (!v2) throw new Error('feedback needs the app context');
    const turn = [
      'Rubric:', ...rubric.map((r, i) => `${i}. ${r}`),
      ...(sample ? ['Model answer (for you only, never quote it):', sample] : []),
      'The student\'s explanation:', `«${text}»`,
    ].join('\n');
    return {
      ...base(model, FEEDBACK_EFFORT, FEEDBACK_MAX_TOKENS),
      system: systemBlocks(kind, shape, context),
      output_config: { effort: FEEDBACK_EFFORT, format: { type: 'json_schema', schema: FEEDBACK_SCHEMA } },
      messages: [{ role: 'user', content: turn }],
    };
  }
  if (kind === 'check') {
    const data = String(input.image || '').replace(/^data:[^,]+,/, '');
    const media = /^image\/(png|jpeg|webp|gif)$/.test(input.mediaType) ? input.mediaType : 'image/jpeg';
    if (!data) throw new Error('check needs an image');
    if (data.length > 7_000_000) throw new Error('image too large');
    const { text, ctx, v2 } = appContext();
    // the question typed next to the photo is the student's own words (masked, in their turn); an older lesson sent the
    // exercise on screen in the same field, which the app context already carries
    const asked = v2 || !ctx.item ? own(input.question, 300).trim() : '';
    return {
      ...base(model, 'high', 16000),
      system: systemBlocks(kind, shape, text),
      output_config: { effort: 'high', format: { type: 'json_schema', schema: CHECK_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data } },
          { type: 'text', text: `${asked ? `My question: ${asked}\n\n` : ''}Check my handwritten work in the photo.` },
        ],
      }],
    };
  }
  if (kind === 'exam') {
    const pages = (Array.isArray(input.pages) ? input.pages : []).slice(0, MAX_EXAM_PAGES);
    if (!pages.length) throw new Error('exam needs at least one page');
    const blocks = pages.map((pg) => {
      const data = String(pg.data || '').replace(/^data:[^,]+,/, '');
      if (!data || data.length > 12_000_000) throw new Error('page missing or too large');
      if (pg.mediaType === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
      const media = /^image\/(png|jpeg|webp|gif)$/.test(pg.mediaType) ? pg.mediaType : 'image/jpeg';
      return { type: 'image', source: { type: 'base64', media_type: media, data } };
    });
    const key = Array.isArray(input.key) && input.key.length
      ? `\n\nAnswer key (authoritative), in question order:\n${input.key.slice(0, 30).map((k, i) => `${i + 1}. ${clip(k.prompt, 300)} → ${clip(k.answer, 80)}`).join('\n')}`
      : '';
    const topics = Array.isArray(input.topics)
      ? `\nTopics (id = title; levels in order):\n${input.topics.slice(0, 12).map((t) => `${t.id} = ${clip(t.title, 60)}${Array.isArray(t.levels) ? `; levels: ${t.levels.slice(0, 12).map((l, i) => `${i + 1} ${clip(l, 50)}`).join(', ')}` : ''}`).join('\n')}\nother = anything else (level 0).`
      : '';
    return {
      ...base(model, 'high', 32000),
      system: systemBlocks(kind, shape),
      output_config: { effort: 'high', format: { type: 'json_schema', schema: EXAM_SCHEMA } },
      messages: [{
        role: 'user',
        content: [...blocks, { type: 'text', text: `${gradeLine(input.grade)}${topics}${key}\n\nCheck my exam: ${pages.length} page(s) above.` }],
      }],
    };
  }
  throw new Error(`unknown AI action: ${kind}`);
}

/**
 * Turn a Claude message into the app's result shape. `input` is the request's input: feedback checks its reply against
 * the rubric, the model answer and the student's own text (Design 4).
 */
export function readResult(kind, message, input = {}) {
  if (!message) throw new Error('empty response');
  if (message.stop_reason === 'refusal') {
    const err = new Error('refusal');
    err.code = 'refusal';
    throw err;
  }
  const text = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (kind === 'generate' || kind === 'check' || kind === 'exam' || kind === 'feedback') {
    let data;
    try { data = JSON.parse(text); } catch { const e = new Error('bad json'); e.code = 'bad_output'; throw e; }
    if (kind === 'feedback') return readFeedback(data, input);
    // the rewrite's exercises, as written: code decides which may be shown (generateVerified, shared/verify.js)
    if (kind === 'generate') data.items = (Array.isArray(data.items) ? data.items : []).filter((it) => it && typeof it === 'object').slice(0, MAX_SEEDS * 2);
    if (kind === 'exam') {
      data.questions = (data.questions || []).filter((q) => q && q.prompt)
        .map((q) => ({ ...q, level: Number.isInteger(q.level) && q.level > 0 && q.level <= 12 ? q.level : 0 }));
    }
    if (kind === 'check' || kind === 'exam') data.care = data.care === true;
    return data;
  }
  const { text: said, care } = splitCare(text);
  // nothing visible is not a reply: also a reply cut off by max_tokens after only thinking (ai spec AI-6 §3), so the
  // Worker gives the question back
  if (!said.trim()) { const e = new Error('empty text'); e.code = 'bad_output'; throw e; }
  return care ? { text: said, care: true } : { text: said };
}

/** The blind solve's reply → { answers: [{ seed, answer }] }. Throws on a refusal or a reply that is not that JSON. */
export function readBlind(message) {
  if (!message) throw new Error('empty response');
  if (message.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { code: 'refusal' });
  const text = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  let data;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error('bad json'), { code: 'bad_output' }); }
  if (!Array.isArray(data?.answers)) throw Object.assign(new Error('no answers'), { code: 'bad_output' });
  return { answers: data.answers.filter((a) => a && Number.isInteger(a.seed)).map((a) => ({ seed: a.seed, answer: String(a.answer ?? '') })) };
}

/**
 * Generated exercises, end to end (ai spec AI-4 Design 6): the one path the Worker, the personal-key mode and the
 * evaluation all run, so they cannot drift apart.
 *   1. the rewrite (the main model writes a story, a hint and a solution around each of the app's seeds);
 *   2. the blind solve of the new stories on the low-cost model, which never sees a seed or an answer; an error or a
 *      refusal is tried once more, and then the stories go on without it (blind 'skipped': code checks 1-4 still apply);
 *   3. finishRewrite (shared/verify.js): the code checks; only what passes may be shown, in seed order.
 * call(params) sends one request and resolves to the Claude message (it throws on an API error; the caller records what
 * each message cost). An error, a refusal or unreadable JSON on the rewrite is thrown, with code 'refusal' or
 * 'bad_output' where it has one. → { items, dropped, blind: 'ok' | 'skipped' | 'none', blindAnswers, messages, fallback }:
 * blind 'none' when there was no new story to solve (every seed kept its wording), blindAnswers the blind solve's answers
 * (null when it did not run), fallback true when no exercise passed.
 */
export async function generateVerified(call, input = {}, { model, blindModel } = {}) {
  const seeds = seedsOf(input);
  const messages = [];
  const rewrite = await call(buildRequest('generate', input, { model }));
  messages.push(rewrite);
  const data = readResult('generate', rewrite);
  // what the blind solve reads: the first exercise per seed of this request, as finishRewrite checks it; a story under a
  // seed's drawing is dropped anyway (kept), so it is not sent
  const bySeed = new Map(seeds.map((sd) => [sd.i, sd]));
  const used = new Set();
  const stories = data.items.filter((it) => {
    if (!Number.isInteger(it.seed) || !bySeed.has(it.seed) || used.has(it.seed)) return false;
    used.add(it.seed);
    return !bySeed.get(it.seed).fig;
  });
  let blindParams = null;
  try { blindParams = buildBlind(stories, { model: blindModel }); } catch { /* no new story: nothing to solve */ }
  let blind = null;
  for (let attempt = 1; blindParams && !blind && attempt <= 2; attempt += 1) {
    try {
      const m = await call(blindParams);
      messages.push(m);
      blind = readBlind(m);
    } catch { /* an error or a refusal: once more, then without it */ }
  }
  const { items, dropped } = finishRewrite(seeds, data, blind);
  return { items, dropped, blind: !blindParams ? 'none' : blind ? 'ok' : 'skipped', blindAnswers: blind?.answers ?? null, messages, fallback: items.length === 0 };
}

/** Exams and other long outputs are streamed so a long check never hits an HTTP timeout. */
export const STREAMED = (kind) => kind === 'exam';
