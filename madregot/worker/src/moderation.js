// An optional second reader for free text (COUNCIL2-9), off until the owner turns it on (MODERATION = "on" in
// wrangler.toml). The word lists (shared/distress.js, shared/blocklist.js) stay the first check and do not change; this
// adds a short classification call on the low-cost model, through the same Claude client and the same spend accounting
// as every AI request, for what the lists miss: a child's message in their own words (Hebrew slang, missing letters, or
// Arabic, Russian or English), and a tutor reply that should not reach a child.
//
//   input  (chat, explain, feedback, a help note): a flag sends the request down the care path (src/index.js)
//   output (chat, explain, feedback): a flag replaces the reply with the calm sentence (BLOCKED_TEXT)
//
// It fails open: no key, an error, a timeout or an answer that is not the expected JSON leaves the request exactly as the
// word lists decided. It never stores what was written: the safety log gets the category only (src/safety.js), and the
// text sent is masked first (maskPersonal) and clipped.
import Anthropic from '@anthropic-ai/sdk';
import { maskPersonal } from '../../shared/safety.js';
import { LITE_MODEL } from '../../shared/ai.js';
import { DISTRESS_CATEGORIES } from '../../shared/distress.js';
import { recordSpend } from './spend.js';

/** The kinds whose free text it reads (input) and whose replies it reads (output). */
export const MODERATED_KINDS = Object.freeze(['chat', 'explain', 'feedback']);
/** A flagged message from a child: the care path's own categories. */
export const INPUT_CATEGORIES = DISTRESS_CATEGORIES;
/** A flagged reply: why it may not be shown. */
export const OUTPUT_CATEGORIES = Object.freeze(['sexual', 'violence', 'self_harm', 'hate', 'personal', 'unsafe']);
/** At most this much text is sent, after masking. */
export const MODERATION_CHARS = 2000;
/** The call's own cap: a short JSON answer, with room for the model's thinking. */
export const MODERATION_MAX_TOKENS = 1024;
/** A classification that takes longer than this is skipped (fail open). */
export const MODERATION_TIMEOUT_MS = 8000;

export const moderationOn = (env) => String(env.MODERATION ?? 'off').trim().toLowerCase() === 'on';

const SCHEMA = {
  type: 'object',
  properties: {
    flag: { type: 'boolean' },
    category: { type: 'string', enum: ['none', ...new Set([...INPUT_CATEGORIES, ...OUTPUT_CATEGORIES])] },
  },
  required: ['flag', 'category'],
  additionalProperties: false,
};

const SYSTEM = {
  input: [
    'You screen one message that a child aged 12 to 14 wrote in a maths practice app in Israel. It is usually in Hebrew,',
    'often with slang, missing letters or no punctuation; it may also be in Arabic, Russian or English.',
    'Decide whether an adult should gently offer help. Flag it with one category:',
    '- self_harm: wanting to die, to disappear or not wake up, hurting themselves, suicide.',
    '- abuse: being hit, hurt, touched, threatened or neglected by a parent or another adult.',
    '- danger: being in danger now, running away from home, someone about to hurt them.',
    '- bullying: being hurt, threatened, shamed or left out by other children, at school or online.',
    '- distress: strong despair, feeling worthless, not eating, constant fear or crying.',
    'Do not flag maths, a word problem, a joke or everyday words about a hard exam ("אני אמות מהמבחן הזה"), or ordinary',
    'frustration with an exercise. When unsure between two categories, choose the more serious one.',
    'Answer with the JSON only: {"flag": true or false, "category": one category or "none"}.',
  ].join('\n'),
  output: [
    'You screen one reply that an AI maths tutor wrote to a child aged 12 to 14 in Israel. It is usually in Hebrew.',
    'Flag it when it must not be shown to the child, with one category:',
    '- sexual: sexual content of any kind.',
    '- violence: graphic violence, or encouraging anyone to hurt someone.',
    '- self_harm: methods of self-harm or suicide, or encouraging them.',
    '- hate: insults or hatred against a person or a group.',
    '- personal: asking the child for personal details (an address, a phone number, a full name, a photo of themselves),',
    '  or asking to meet or to talk somewhere else.',
    '- unsafe: anything else not fit for a 12-year-old.',
    'Do not flag maths, explanations, encouragement, or a reply that points the child to a trusted adult or to a support',
    'line such as ער״ן 1201.',
    'Answer with the JSON only: {"flag": true or false, "category": one category or "none"}.',
  ].join('\n'),
};

/** The request for one text: the low-cost model unless MODERATION_MODEL names another, effort low, a JSON answer. */
export function buildModeration(role, text, env = {}) {
  if (role !== 'input' && role !== 'output') throw new Error(`unknown role: ${role}`);
  const body = maskPersonal(String(text ?? '')).text.slice(0, MODERATION_CHARS);
  return {
    model: env.MODERATION_MODEL || env.FREE_MODEL || LITE_MODEL,
    max_tokens: MODERATION_MAX_TOKENS,
    system: [{ type: 'text', text: SYSTEM[role] }],
    messages: [{ role: 'user', content: `<text>\n${body}\n</text>` }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
  };
}

/** The answer, read strictly: { flag, category } with a category of the role's list, else null (not read). */
export function readModeration(role, message) {
  try {
    if (!message || message.stop_reason === 'refusal') return null;
    const text = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const data = JSON.parse(text);
    if (typeof data?.flag !== 'boolean') return null;
    if (!data.flag) return { flag: false, category: null };
    const list = role === 'input' ? INPUT_CATEGORIES : OUTPUT_CATEGORIES;
    // a flag with a category of the other list still counts, as the nearest of this one
    const category = list.includes(data.category) ? data.category : role === 'input' ? 'distress' : 'unsafe';
    return { flag: true, category };
  } catch {
    return null;
  }
}

/**
 * Classify one text. → { flag, category, read } and never throws: `read` is false when the call was off, skipped or
 * failed, and then `flag` is false (the word lists decide alone). The call is priced into `pool` like any AI answer
 * (kind 'moderation'), under ctx.waitUntil when given; with `track`, the pricing also joins the request's pending writes
 * (so its dollar hold is released after it).
 */
export async function moderate(env, { role, text, pool = 'care', client = null, ctx = null, track = null } = {}) {
  const none = { flag: false, category: null, read: false };
  if (!moderationOn(env) || !env.ANTHROPIC_API_KEY) return none;
  if (!String(text ?? '').trim()) return none;
  let message;
  try {
    const c = client || new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });
    message = await c.beta.messages.create(buildModeration(role, text, env), { timeout: MODERATION_TIMEOUT_MS, maxRetries: 0 });
  } catch {
    console.error('moderation: not read'); // nothing from the request in the log
    return none;
  }
  const priced = recordSpend(env, { pool: pool || 'care', kind: 'moderation', message }).catch(() => console.error('spend: moderation'));
  if (ctx) ctx.waitUntil(priced);
  if (track) track.pending.push(priced);
  if (!ctx && !track) await priced;
  const r = readModeration(role, message);
  return r ? { ...r, read: true } : none;
}

/** The free text of a request for the input check: the newest chat message, a typed answer with words, an explanation. */
export function moderatedInput(kind, input = {}) {
  if (kind === 'chat') {
    const list = Array.isArray(input.messages) ? input.messages : [];
    for (let i = list.length - 1; i >= 0; i--) if (list[i]?.role === 'user' && typeof list[i].content === 'string') return list[i].content;
    return '';
  }
  if (kind === 'feedback') return typeof input.text === 'string' ? input.text : '';
  if (kind === 'explain') {
    const typed = Array.isArray(input?.ctx?.tries?.answers) ? input.ctx.tries.answers.map((a) => a?.value) : [];
    // a number or an expression is maths: only words are read
    return [input.studentAnswer, ...typed].filter((v) => typeof v === 'string' && /\p{L}{2,}/u.test(v.replace(/[a-z]\b/gi, ''))).join('\n');
  }
  return '';
}

/** Every string of a reply (a text, or a structured reply such as feedback's), for the output check. */
export function replyText(result) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(result);
  return out.join('\n').slice(0, 4 * MODERATION_CHARS);
}
