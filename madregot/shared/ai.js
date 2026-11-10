// Claude requests for Madregot, shared by the Cloudflare Worker (server mode)
// and the browser (personal-key mode). Each builder returns the params for
// client.beta.messages.create / .stream from @anthropic-ai/sdk.

import { safetyPrompt, CARE_MARK, maskPersonal } from './safety.js';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
// Server-side refusal fallback: a declined request is re-run on Anthropic's
// recommended model for that refusal category instead of coming back empty.
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const AI_KINDS = ['explain', 'chat', 'generate', 'check', 'exam'];
// Topic ids the exam check maps each question to, so the app can recommend practice.
export const TOPIC_IDS = ['signed', 'coord', 'angles', 'line', 'pyth', 'stats', 'expr', 'eq', 'sys', 'other'];
export const MAX_EXAM_PAGES = 8;

const TUTOR_BODY = `You are the math tutor inside "Madregot", a daily practice app for Israeli middle-school students in grades 7 and 8 (ages 12-14).
Always answer in Hebrew, in plain words a 13-year-old understands, addressing the student in the plural or gender-neutral form ("נסו", "שימו לב").
Write every mathematical expression in LaTeX between single dollar signs, for example $-3 + 5 = 2$, so it renders left to right inside Hebrew text. Use $$...$$ only for one central line.
Keep answers short: at most about 120 words unless the task below asks for more. Use numbered steps when you show a method.
If the student asks about something that is neither mathematics nor their safety, say kindly in one sentence that you are here for maths, and offer to continue with the exercise.
Never say a built-in answer is wrong: the app checks built-in exercises with exact code, and the correct answer you receive is authoritative.`;
// The safety block comes first in every kind and every shape, the personal-key path included (trust spec TRUST-3). Any
// later prompt change keeps it first.
const TUTOR = `${safetyPrompt()}\n\n${TUTOR_BODY}`;

// What a photographed page may show and the tutor never copies (trust spec TRUST-5 §5).
const PERSONAL_RULE = "If the pages show a person's name, ID number, class, school or any other identifying detail, never copy it into your answer: write [פרטים אישיים] instead.";

const TASKS = {
  explain: `Task: the student answered an exercise incorrectly. Explain the specific mistake: compare their answer with the correct one, name the misconception that most likely produced their number, then show the correct method in 2-4 short steps. Do not lecture and do not repeat the whole topic.`,
  chat: `Task: the student is working on the exercise described in the context and asks you questions about it. Guide them toward the answer. If they have not tried yet, give the next step rather than the final answer; if they ask for the final answer after trying, you may give it with the method.`,
  generate: `Task: write new practice exercises for the topic and level given. Each exercise must have exactly one numeric answer (an integer, a terminating decimal, or a fraction a/b). When the level's exercises ask for an expression (writing, collecting like terms, opening brackets, simplifying), ask instead for one number of the result: the coefficient of x, the constant term, or the expression's value at a given x. When they ask for a pair or a range (a system of two equations, an inequality), ask instead for one number: one unknown of the solution, or the smallest or largest whole number that solves the inequality. Solve each exercise yourself and double-check the answer before writing it. Match the difficulty of the level. Hints must not reveal the answer. Solutions list 2-5 short steps.`,
  exam: `Task: the student uploaded a practice exam they completed (photos of the pages, or a PDF). Check it like a careful teacher.
For every question on the pages: transcribe the question, the student's final answer and the key line of their working; decide whether it is correct, partially correct, wrong, or not answered.
If an answer key is provided, it is authoritative: compare the student's answer with it and never re-grade against your own solution. Without a key, solve each question yourself carefully and check your result before grading.
Feedback must be personal: name the specific mistake in this student's working and why it happened, not only the right answer. For a correct answer, say briefly what was done well.
Give a model solution in short steps for every question. Map each question to one topic id from the list and to the number of the level in that topic's list that it practises (0 if none fits), and name the skill in a few Hebrew words.
Finally list the weak topics (only where the student lost points) with the reason, and 3 to 5 concrete next steps.
${PERSONAL_RULE} The exam title must name the subject only, never a person.`,
  check: `Task: the student photographed their handwritten work. First transcribe what you can read. Then check each step in order: mark each as correct or not, and for the first wrong step say exactly what went wrong. Do not redo the whole exercise for them; point to the step to fix. If the photo is unreadable, say what is missing (light, focus, the whole page).
${PERSONAL_RULE}`,
};

const GENERATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['prompt', 'answer', 'hint', 'solution'],
        properties: {
          prompt: { type: 'string', description: 'The exercise in Hebrew, math in $...$' },
          answer: { type: 'string', description: 'The exact numeric answer: integer, decimal or a/b' },
          hint: { type: 'string' },
          solution: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

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

function contextBlock(ctx = {}, { questionChars = 800 } = {}) {
  const lines = [];
  if (ctx.grade) lines.push(`Grade: ${ctx.grade === '8' ? '8 (ח׳)' : '7 (ז׳)'}`);
  if (ctx.topic) lines.push(`Topic: ${clip(ctx.topic, 120)}`);
  if (ctx.level) lines.push(`Level: ${clip(ctx.level, 120)}`);
  if (ctx.question) lines.push(`Exercise on screen: ${clip(ctx.question, questionChars)}`);
  if (ctx.correct != null && ctx.correct !== '') lines.push(`Correct answer (authoritative): ${clip(ctx.correct, 200)}`);
  if (ctx.studentAnswer) lines.push(`Student's answer: ${own(ctx.studentAnswer, 200)}`);
  if (ctx.attempts) lines.push(`Attempts so far: ${Number(ctx.attempts) || 0}`);
  return lines.join('\n');
}

const base = (model, effort, maxTokens) => ({
  model: model || DEFAULT_MODEL,
  max_tokens: maxTokens,
  betas: [FALLBACK_BETA],
  fallbacks: 'default',
  cache_control: { type: 'ephemeral' },
  output_config: { effort },
});

// Which AI kinds share a daily limit (a "group"), and what each kind weighs against a class-wide cap.
export const KIND_GROUP = { explain: 'tutor', chat: 'tutor', check: 'check', generate: 'generate', exam: 'exam' };
export const AI_UNITS = { explain: 1, chat: 1, check: 4, generate: 3, exam: 20 };
export const AI_GROUPS = ['tutor', 'check', 'generate', 'exam'];
// The free taste covers only the short kinds.
export const FREE_KINDS = ['explain', 'chat'];
// The model for the free taste and for economy mode when FREE_MODEL is empty. Never the main model.
export const LITE_MODEL = 'claude-haiku-5-5';
export const LITE_MAX_TOKENS = 1500;
export const ECONOMY_MAX_TOKENS = 2500;
export const LITE_NOTE = 'This student has only a few questions to the tutor today. Answer completely in one reply of at most 100 words, and do not end with a question the student has to answer.';

/** The low-cost model family has no server-side refusal fallback, so its requests carry neither the fallback beta nor `fallbacks`. */
export function supportsFallback(model) { return !/^claude-haiku/.test(String(model || DEFAULT_MODEL)); }
function dropFallback(params) {
  delete params.fallbacks;
  params.betas = (params.betas || []).filter((b) => b !== FALLBACK_BETA);
  return params;
}

/**
 * Build the request params for one AI action. Throws on invalid input.
 * shape: 'full' (every kind, the main model), 'lite' (the free taste: explain and chat only, a low-cost model, one
 * short answer) or 'economy' (a paid pool over its monthly budget: explain and chat on the low-cost model, shorter).
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
    ...(short ? { maxMessages: 6, messageChars: 600, questionChars: 400, fromUser: true } : {}),
  });
  params.max_tokens = short ? LITE_MAX_TOKENS : ECONOMY_MAX_TOKENS;
  params.output_config = { ...params.output_config, effort: 'low' };
  if (short) params.system = `${params.system}\n\n${LITE_NOTE}`;
  return supportsFallback(params.model) ? params : dropFallback(params);
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
    const said = [input.studentAnswer, input.note].filter((x) => typeof x === 'string' && x.trim()).map((x) => own(x, 2000)).join('\n');
    if (!said) throw new Error('care needs a student message');
    history = [{ role: 'user', content: said }];
  }
  const params = {
    ...base(model, 'low', CARE_MAX_TOKENS),
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

function buildFull(kind, input = {}, { model, maxMessages = 12, messageChars = 2000, questionChars = 800, fromUser = false } = {}) {
  const system = `${TUTOR}\n\n${TASKS[kind] || ''}`;
  const cb = (ctx) => contextBlock(ctx, { questionChars });
  if (kind === 'explain') {
    return {
      ...base(model, 'medium', 4000),
      system,
      messages: [{ role: 'user', content: `${cb(input)}\n\nExplain my mistake.` }],
    };
  }
  if (kind === 'chat') {
    const history = (Array.isArray(input.messages) ? input.messages : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-maxMessages)
      .map((m) => ({ role: m.role, content: own(m.content, messageChars) }));
    // a shortened chat starts from a student turn, so the exercise context still leads it
    if (fromUser) while (history.length > 1 && history[0].role !== 'user') history.shift();
    if (!history.length || history[0].role !== 'user') throw new Error('chat needs a user message first');
    const ctx = cb(input.context);
    if (ctx) history[0] = { role: 'user', content: `${ctx}\n\n${history[0].content}` };
    return { ...base(model, 'low', 4000), system, messages: history };
  }
  if (kind === 'generate') {
    const count = Math.min(Math.max(Number(input.count) || 5, 1), 8);
    return {
      ...base(model, 'high', 16000),
      system,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: GENERATE_SCHEMA } },
      messages: [{
        role: 'user',
        content: `${contextBlock(input)}\n\nWrite ${count} new exercises for this topic and level.${input.examples ? `\nExamples of exercises at this level:\n${clip(input.examples, 1200)}` : ''}`,
      }],
    };
  }
  if (kind === 'check') {
    const data = String(input.image || '').replace(/^data:[^,]+,/, '');
    const media = /^image\/(png|jpeg|webp|gif)$/.test(input.mediaType) ? input.mediaType : 'image/jpeg';
    if (!data) throw new Error('check needs an image');
    if (data.length > 7_000_000) throw new Error('image too large');
    return {
      ...base(model, 'high', 16000),
      system,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: CHECK_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data } },
          { type: 'text', text: `${contextBlock(input)}\n\nCheck my handwritten work in the photo.` },
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
      system,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: EXAM_SCHEMA } },
      messages: [{
        role: 'user',
        content: [...blocks, { type: 'text', text: `${contextBlock(input)}${topics}${key}\n\nCheck my exam: ${pages.length} page(s) above.` }],
      }],
    };
  }
  throw new Error(`unknown AI action: ${kind}`);
}

/** Turn a Claude message into the app's result shape. */
export function readResult(kind, message) {
  if (!message) throw new Error('empty response');
  if (message.stop_reason === 'refusal') {
    const err = new Error('refusal');
    err.code = 'refusal';
    throw err;
  }
  const text = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (kind === 'generate' || kind === 'check' || kind === 'exam') {
    let data;
    try { data = JSON.parse(text); } catch { const e = new Error('bad json'); e.code = 'bad_output'; throw e; }
    if (kind === 'generate') {
      data.questions = (data.questions || []).filter((q) => q && q.prompt && q.answer).slice(0, 8);
    }
    if (kind === 'exam') {
      data.questions = (data.questions || []).filter((q) => q && q.prompt)
        .map((q) => ({ ...q, level: Number.isInteger(q.level) && q.level > 0 && q.level <= 12 ? q.level : 0 }));
    }
    if (kind === 'check' || kind === 'exam') data.care = data.care === true;
    return data;
  }
  const { text: said, care } = splitCare(text);
  if (!said.trim()) { const e = new Error('empty text'); e.code = 'bad_output'; throw e; }
  return care ? { text: said, care: true } : { text: said };
}

/** Exams and other long outputs are streamed so a long check never hits an HTTP timeout. */
export const STREAMED = (kind) => kind === 'exam';
