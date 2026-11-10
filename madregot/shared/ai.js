// Claude requests for Madregot, shared by the Cloudflare Worker (server mode)
// and the browser (personal-key mode). Each builder returns the params for
// client.beta.messages.create / .stream from @anthropic-ai/sdk.

export const DEFAULT_MODEL = 'claude-opus-5-5';
// Server-side refusal fallback: a declined request is re-run on Anthropic's
// recommended model for that refusal category instead of coming back empty.
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const AI_KINDS = ['explain', 'chat', 'generate', 'check', 'exam'];
// Topic ids the exam check maps each question to, so the app can recommend practice.
export const TOPIC_IDS = ['signed', 'coord', 'angles', 'line', 'pyth', 'stats', 'expr', 'other'];
export const MAX_EXAM_PAGES = 8;

const TUTOR = `You are the math tutor inside "Madregot", a daily practice app for Israeli middle-school students in grades 7 and 8 (ages 12-14).
Always answer in Hebrew, in plain words a 13-year-old understands, addressing the student in the plural or gender-neutral form ("נסו", "שימו לב").
Write every mathematical expression in LaTeX between single dollar signs, for example $-3 + 5 = 2$, so it renders left to right inside Hebrew text. Use $$...$$ only for one central line.
Keep answers short: at most about 120 words unless the task below asks for more. Use numbered steps when you show a method.
Stay on mathematics. If the student asks about something else, say briefly that you only help with math and return to the exercise.
Never say a built-in answer is wrong: the app checks built-in exercises with exact code, and the correct answer you receive is authoritative.`;

const TASKS = {
  explain: `Task: the student answered an exercise incorrectly. Explain the specific mistake: compare their answer with the correct one, name the misconception that most likely produced their number, then show the correct method in 2-4 short steps. Do not lecture and do not repeat the whole topic.`,
  chat: `Task: the student is working on the exercise described in the context and asks you questions about it. Guide them toward the answer. If they have not tried yet, give the next step rather than the final answer; if they ask for the final answer after trying, you may give it with the method.`,
  generate: `Task: write new practice exercises for the topic and level given. Each exercise must have exactly one numeric answer (an integer, a terminating decimal, or a fraction a/b). When the level's exercises ask for an expression (writing, collecting like terms, opening brackets, simplifying), ask instead for one number of the result: the coefficient of x, the constant term, or the expression's value at a given x. Solve each exercise yourself and double-check the answer before writing it. Match the difficulty of the level. Hints must not reveal the answer. Solutions list 2-5 short steps.`,
  exam: `Task: the student uploaded a practice exam they completed (photos of the pages, or a PDF). Check it like a careful teacher.
For every question on the pages: transcribe the question, the student's final answer and the key line of their working; decide whether it is correct, partially correct, wrong, or not answered.
If an answer key is provided, it is authoritative: compare the student's answer with it and never re-grade against your own solution. Without a key, solve each question yourself carefully and check your result before grading.
Feedback must be personal: name the specific mistake in this student's working and why it happened, not only the right answer. For a correct answer, say briefly what was done well.
Give a model solution in short steps for every question. Map each question to one topic id from the list and to the number of the level in that topic's list that it practises (0 if none fits), and name the skill in a few Hebrew words.
Finally list the weak topics (only where the student lost points) with the reason, and 3 to 5 concrete next steps.`,
  check: `Task: the student photographed their handwritten work. First transcribe what you can read. Then check each step in order: mark each as correct or not, and for the first wrong step say exactly what went wrong. Do not redo the whole exercise for them; point to the step to fix. If the photo is unreadable, say what is missing (light, focus, the whole page).`,
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

const EXAM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'title', 'questions', 'summary', 'weakTopics', 'nextSteps'],
  properties: {
    readable: { type: 'boolean' },
    title: { type: 'string', description: 'A short name for the exam, from the pages' },
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
  required: ['readable', 'transcript', 'steps', 'final', 'summary'],
  properties: {
    readable: { type: 'boolean' },
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

function contextBlock(ctx = {}) {
  const lines = [];
  if (ctx.grade) lines.push(`Grade: ${ctx.grade === '8' ? '8 (ח׳)' : '7 (ז׳)'}`);
  if (ctx.topic) lines.push(`Topic: ${clip(ctx.topic, 120)}`);
  if (ctx.level) lines.push(`Level: ${clip(ctx.level, 120)}`);
  if (ctx.question) lines.push(`Exercise on screen: ${clip(ctx.question, 800)}`);
  if (ctx.correct != null && ctx.correct !== '') lines.push(`Correct answer (authoritative): ${clip(ctx.correct, 200)}`);
  if (ctx.studentAnswer) lines.push(`Student's answer: ${clip(ctx.studentAnswer, 200)}`);
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

/** Free-taste requests (lite): a short answer from a low-cost model. Haiku has no server-side refusal fallback, so its
 *  requests carry neither the fallback beta nor `fallbacks`. */
export const LITE_MAX_TOKENS = 1500;
const supportsFallback = (model) => !/^claude-haiku/.test(String(model || DEFAULT_MODEL));
function liteify(params) {
  const out = { ...params, max_tokens: Math.min(params.max_tokens, LITE_MAX_TOKENS), output_config: { ...params.output_config, effort: 'low' } };
  if (!supportsFallback(out.model)) { delete out.fallbacks; out.betas = (out.betas || []).filter((b) => b !== FALLBACK_BETA); }
  return out;
}

/** Build the request params for one AI action. Throws on invalid input. lite: the free taste (short, low cost). */
export function buildRequest(kind, input = {}, { model, lite = false } = {}) {
  if (lite && kind === 'chat' && Array.isArray(input.messages)) {
    // a free chat keeps the last few turns, starting from a student turn, so the exercise context still leads it
    const recent = input.messages.slice(-6);
    while (recent.length > 1 && recent[0]?.role !== 'user') recent.shift();
    input = { ...input, messages: recent };
  }
  const params = buildFull(kind, input, { model });
  if (lite) return liteify(params);
  if (!supportsFallback(params.model)) { delete params.fallbacks; params.betas = (params.betas || []).filter((b) => b !== FALLBACK_BETA); }
  return params;
}

function buildFull(kind, input = {}, { model } = {}) {
  const system = `${TUTOR}\n\n${TASKS[kind] || ''}`;
  if (kind === 'explain') {
    return {
      ...base(model, 'medium', 4000),
      system,
      messages: [{ role: 'user', content: `${contextBlock(input)}\n\nExplain my mistake.` }],
    };
  }
  if (kind === 'chat') {
    const history = (Array.isArray(input.messages) ? input.messages : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: clip(m.content, 2000) }));
    if (!history.length || history[0].role !== 'user') throw new Error('chat needs a user message first');
    const ctx = contextBlock(input.context);
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
    return data;
  }
  if (!text.trim()) { const e = new Error('empty text'); e.code = 'bad_output'; throw e; }
  return { text };
}

/** Exams and other long outputs are streamed so a long check never hits an HTTP timeout. */
export const STREAMED = (kind) => kind === 'exam';
