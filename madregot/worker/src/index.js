// Madregot API: Claude proxy (the key never reaches browsers), class data in D1, and the paid AI tutor
// (entitlement, sign-in by email code, family devices, class licences, checkout and payments, cancellation).
// The owner works through scripts/owner.mjs; there is no HTTP admin.
import Anthropic from '@anthropic-ai/sdk';
import { AI_KINDS, STREAMED, TOPIC_IDS, LITE_MODEL, readResult, splitCare, answerGuard, generateVerified } from '../../shared/ai.js';
import { streamGuard, guardResult, MASK_NOTE } from '../../shared/guard.js';
import { detectDistress, CARE_MARK, CARE_STATIC, scanPersonal, maskPersonal, screenOutput, blockHit, BLOCKED_TEXT, scrubTitle } from '../../shared/safety.js';
import {
  dayOf, nowIso, daysAgo, json, HttpError, body, sha256, randomToken, randomFrom, CODE_ALPHABET, netKey, devKey, take, key, giveBack,
  limitOrThrow, hmacHex,
} from './util.js';
import { startLogin, verifyLogin, signOut } from './account.js';
import { resolve, resolveCare, aiStatus, requireStudent, requireTeacher, paywallOn, identify } from './entitle.js';
import { recordSafety } from './safety.js';
import { recordSpend } from './spend.js';
import { bumpQuality } from './quality.js';
import { DROP_REASONS } from '../../shared/verify.js';
import { emailReady } from './email.js';
import {
  plansView, checkout, orderStatus, webhook, cancel, resume, portal, invoice, testPayPage, testPaySubmit, accountOverview, accountExport, deleteAccount,
  onlineCheckout,
} from './billing.js';
import { currentProvider } from './providers/index.js';
import { linkStart, linkFinish, linkClaim, linkThisDevice, unlinkDevice, leaveFamily } from './family.js';
import { licenceStatus, licenceRequest, licenceClaim, lockClass, removeStudent, joinLocked, pinKeysWhere } from './licence.js';
import { run as runCron } from './cron.js';
import { newClassSetting, newClassStmts, classSettings, aiPolicyView, setClassAi, setStudentAi } from './classai.js';

// ---------- http helpers ----------
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Class-Code, X-Teacher-Key, X-Account-Token, X-Device, X-Family-Device, Idempotency-Key',
    'Access-Control-Expose-Headers': 'X-AI-Tier, X-AI-Group, X-AI-Left, X-AI-Economy, X-AI-Linked',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// Body limits, checked before JSON.parse (413 too_large above them).
const KB = 1024;
const AI_BODY_MAX = { chat: 32 * KB, explain: 32 * KB, generate: 16 * KB, check: 8 * KB * KB, exam: 100 * KB * KB };
const LIMIT = { small: 4 * KB, help: 700 * KB, progress: 256 * KB, exams: 64 * KB };

// ---------- secrets ----------
async function hashPin(pin) {
  const salt = randomToken(8);
  return `${salt}:${await sha256(`${salt}:${pin}`)}`;
}
async function verifyPin(pin, stored) {
  const [salt, h] = String(stored || '').split(':');
  if (!salt || !h) return false;
  return (await sha256(`${salt}:${pin}`)) === h;
}
const classCode = () => randomFrom(CODE_ALPHABET, 6);
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30);

// Personal-code tries (trust spec TRUST-12 §1): 5 an hour from one network and 30 a day in all, per student. Each try is
// taken before the code is compared and given back when it is right, so parallel guesses cannot pass the cap and a
// student who types the right code never uses one up. On a school network a classmate can still cause a one-hour lock
// with a 4-digit code; the teacher's reset (which clears these counters) is the remedy. 30 a day across networks keeps
// guessing 10,000 codes at about half a year on average.
const PIN_NET_HOUR = 5;
const PIN_DAY = 30;


// ---------- AI ----------
/**
 * Follows what a streamed answer has cost so far (message_start, then message_delta), so a stream that is abandoned or
 * breaks part-way is still priced: the input and the output already made are billed all the same. Output tokens are
 * never counted below what was streamed (a rough count of 2 characters a token).
 */
function usageTracker() {
  let seen = null; let chars = 0;
  return {
    event(ev) {
      if (ev?.type === 'message_start') {
        seen = { model: ev.message?.model, usage: { ...(ev.message?.usage || {}) } };
      } else if (ev?.type === 'message_delta') {
        if (seen && ev.usage) for (const [k, v] of Object.entries(ev.usage)) if (v !== null && v !== undefined) seen.usage[k] = v;
      } else if (ev?.type === 'content_block_delta') {
        chars += String(ev.delta?.text || ev.delta?.partial_json || ev.delta?.thinking || '').length;
      }
    },
    /** What was spent so far, as a message priceOf reads; null when Claude was never reached. */
    message() {
      if (!seen) return null;
      return { model: seen.model, usage: { ...seen.usage, output_tokens: Math.max(Number(seen.usage.output_tokens) || 0, Math.ceil(chars / 2)) } };
    },
  };
}

function aiHeaders(r) {
  return {
    'X-AI-Tier': r.tier, 'X-AI-Group': r.group, 'X-AI-Left': String(Math.max(0, r.left)),
    ...(r.economy ? { 'X-AI-Economy': '1' } : {}),
    ...(r.linkedBad ? { 'X-AI-Linked': '0' } : {}),
  };
}

/** The last thing the student typed in a chat: the only free text a child sends the AI (photos rely on the model's flag). */
function lastUser(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m && m.role === 'user' && typeof m.content === 'string') return m.content.slice(0, 4000);
  }
  return '';
}

/** The fixed care reply, with no AI call: JSON, or for a streamed chat the same text followed by the care marker. */
function careStaticReply(kind, input, cors, headers) {
  if (kind === 'chat' && input.stream) {
    return new Response(`${CARE_STATIC}\n${CARE_MARK}`, { headers: { ...cors, ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return json({ text: CARE_STATIC, care: true }, 200, cors, headers);
}

/** What a child typed that this request sends to the AI for the first time: the newest chat message, or a typed answer. */
function childText(kind, input) {
  // the answers the student typed, as the app's context carries them (ai spec AI-1), or as an older app sent them
  const typed = Array.isArray(input?.ctx?.tries?.answers) ? input.ctx.tries.answers.map((a) => a?.value) : [];
  if (kind === 'chat') return [lastUser(input.messages), input.context?.studentAnswer, ...typed];
  if (kind === 'explain') return [input.studentAnswer, ...typed];
  // the question typed next to a photo of the student's own work
  if (kind === 'check') return [input.question, ...typed];
  return [];
}

const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };

/**
 * Screen every string of a JSON reply (trust spec TRUST-4 §4.2). → { data, blocked, linksRemoved }. `care`: a care
 * result is never checked against the blocklist; its links still are.
 */
function screenJson(data, opts) {
  let blocked = false; let linksRemoved = 0;
  const walk = (v) => {
    if (typeof v === 'string') {
      const s = screenOutput(v, opts);
      if (s.blocked) blocked = true;
      linksRemoved += s.linksRemoved;
      return s.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(data);
  return { data: out, blocked, linksRemoved };
}

// The streamed reply is screened as it goes: the last, unfinished word is held back (a word is judged whole), and only
// the new text is checked, from the start of the word where the last check stopped.
const WORD_CHAR = /[\p{L}\p{N}_'"]/u;
const HOLD_MAX = 60; // a "word" longer than this is not held back any longer
const OVERLAP = 40; // longer than any blocklist term, so a term across two checks is still seen whole
function stableEnd(text) {
  let i = text.length;
  while (i > 0 && WORD_CHAR.test(text[i - 1]) && text.length - i < HOLD_MAX) i -= 1;
  return i;
}
function wordStart(text, i) {
  let j = Math.max(0, i);
  while (j > 0 && WORD_CHAR.test(text[j - 1])) j -= 1;
  return j;
}

async function handleAI(kind, req, env, ctx, cors) {
  if (!AI_KINDS.includes(kind)) throw new HttpError(404, 'not_found');
  // Distress first (trust spec TRUST-3 §3.4): the body is read and checked before anything can refuse, so a child who
  // writes that they are in distress gets an answer even when the server has no AI key, the day's questions are used
  // up, or the plan does not cover the AI. That answer is never counted against a question.
  const input = await body(req, AI_BODY_MAX[kind]);
  const hit = detectDistress(kind === 'chat' ? lastUser(input.messages) : '');
  if (!hit.flag && !env.ANTHROPIC_API_KEY) throw new HttpError(503, 'ai_not_configured');
  const r = hit.flag ? await resolveCare(req, env, kind, input) : await resolve(req, env, kind, input);
  const careTier = r.tier === 'care';
  if (hit.flag) recordSafety(env, { kind: 'distress', category: hit.category, surface: kind, source: 'regex', tier: r.static ? 'static' : 'care' }, ctx);
  // a care answer says nothing about the person's questions (no X-AI-Tier or X-AI-Left), so the screen's count stays
  const headers = careTier ? (r.linkedBad ? { 'X-AI-Linked': '0' } : {}) : aiHeaders(r);
  if (r.static) return careStaticReply(kind, input, cors, headers);
  // Personal details were masked in the request itself (shared/ai.js); here they are only counted, one event per kind
  // of detail, with nothing of the text (trust spec TRUST-4 §4.1).
  const pii = scanPersonal(childText(kind, input));
  if (pii.length) recordSafety(env, pii.map((category) => ({ kind: 'pii_masked', category, surface: kind, source: 'regex', tier: r.tier })), ctx);
  const screen = { hosts: [hostOf(env.PUBLIC_URL)].filter(Boolean) };
  const event = (k) => recordSafety(env, { kind: k, surface: kind, source: 'server', tier: r.tier }, ctx);
  let returned = false;
  // a call where Claude did no work gives the person's question back (never the shared or tries counters)
  const giveBackOnce = async () => { if (!returned) { returned = true; await giveBack(env, r.refund); } };
  // the question was given back: the count the screen shows says so
  const leftBack = () => {
    if (headers['X-AI-Left'] !== undefined) headers['X-AI-Left'] = String(Math.min(r.limit ?? Infinity, Math.max(0, r.left) + 1));
  };
  // only the model noticed: the reply is a care reply, and the question it took is given back
  const modelCare = async () => {
    if (careTier) return;
    await giveBackOnce();
    recordSafety(env, { kind: 'distress', surface: kind, source: 'model', tier: r.tier }, ctx);
  };
  const record = (message) => recordSpend(env, { pool: r.pool, kind, message }).catch((e) => console.error('spend', e?.message));
  // The final-answer guard (ai spec AI-3 Design 3): on for chat, explain and check while the app's context says WITHHOLD
  // and carries the answer. A care reply is never guarded.
  let guard = { on: false, forms: null };
  if (!careTier) { try { guard = answerGuard(kind, input); } catch { /* a context that cannot be read guards nothing */ } }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });

  if (kind === 'chat' && input.stream) {
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    let aborted = false;
    let wrote = false;
    const write = (text) => { if (!text) return undefined; wrote = true; return writer.write(enc.encode(text)).catch(() => { aborted = true; }); };
    // The start of the reply is held back until it has 9 characters or a line, so a care line the model puts first
    // ([[care]]) is taken out before anything reaches the screen, and sent as a marker at the end instead. Then, in
    // this order (trust spec TRUST-4 §4.2): a care reply goes out as it comes; any other reply is checked against the
    // blocklist before each piece is sent, and on a hit the stream stops and ends with [[blocked]]. Then the final-answer
    // guard (ai spec AI-3): what passed the blocklist goes out a sentence at a time with a leaked answer masked, and the
    // reply ends with MASK_NOTE when anything was. A care reply skips both.
    let care = careTier; let held = ''; let decided = false;
    let acc = ''; let sent = 0; let checked = 0; let blocked = false;
    const g = guard.on && guard.forms ? streamGuard(guard.forms) : null;
    const guarded = (piece) => (care || !g ? piece : g.push(piece));
    const guardEnd = async () => {
      if (care || !g) return;
      await write(g.end());
      if (g.masked) { await write(`\n\n${MASK_NOTE}`); bumpQuality(env, ctx, kind, 'answer_masked'); }
    };
    const pass = async (final) => {
      if (blocked) return;
      const end = care || final ? acc.length : stableEnd(acc);
      if (end <= sent) return;
      if (!care) {
        const from = wordStart(acc, checked - OVERLAP);
        if (blockHit(acc.slice(from, end))) { blocked = true; return; }
        checked = end;
      }
      const piece = acc.slice(sent, end); sent = end;
      await write(guarded(piece));
    };
    const settle = async () => {
      if (decided) return;
      decided = true;
      const lead = splitCare(held); held = '';
      if (lead.care) care = true;
      acc += lead.text;
      await pass(false);
    };
    const out = async (text) => {
      if (decided) { acc += text; return pass(false); }
      held += text;
      const lead = held.replace(/^\s+/, '');
      if (lead.length > CARE_MARK.length || lead.includes('\n')) await settle();
    };
    // a care request that failed or was declined still answers the child: the fixed reply, never an error
    const careFallback = async () => { if (!wrote) await write(CARE_STATIC); await write(`\n${CARE_MARK}`); };
    // a reply that was not fit to show: nothing more of it goes out, the question is given back, and the app shows a
    // calm sentence in its place
    let endedBlocked = false;
    const endBlocked = async () => {
      if (endedBlocked) return;
      endedBlocked = true;
      await giveBackOnce(); event('output_blocked'); await write('\n[[blocked]]');
    };
    const pump = (async () => {
      let stream;
      let recorded = false;
      const usage = usageTracker();
      try {
        stream = client.beta.messages.stream(r.params);
        for await (const ev of stream) {
          usage.event(ev);
          if (aborted || blocked) { stream.abort(); break; }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') await out(ev.delta.text);
          if (blocked) { stream.abort(); break; }
        }
        if (blocked) await endBlocked();
        else if (!aborted) {
          await settle();
          await pass(true);
          if (blocked) {
            await endBlocked();
          } else {
            const final = await stream.finalMessage();
            recorded = true;
            await record(final);
            // the links were sent as written; the app shows any it may not open as plain text (SafeLink)
            if (screenOutput(acc, { ...screen, care: true }).linksRemoved) event('link_removed');
            // nothing visible came back (a reply that stopped on max_tokens after only thinking): not a reply
            const empty = !acc.trim() && final.stop_reason !== 'refusal';
            if (careTier) {
              if (final.stop_reason === 'refusal') { event('refusal'); await careFallback(); }
              else if (empty) await careFallback();
              else await write(`\n${CARE_MARK}`);
            } else if (empty && !care) {
              // the question is given back, and the app says the tutor could not answer (ai spec AI-3 Design 3)
              await giveBackOnce();
              bumpQuality(env, ctx, kind, 'empty_stream');
              await write('\n[[error:bad_output]]');
            } else {
              await guardEnd();
              if (care) { await modelCare(); await write(`\n${CARE_MARK}`); }
              // the model's own boundary (trust spec TRUST-4 §4.3): counted, with no text
              if (final.stop_reason === 'refusal') { event('refusal'); await giveBackOnce(); await write('\n[[refusal]]'); }
            }
          }
        }
      } catch (e) {
        // stopping a blocked stream can end it with an error of its own: the reply still ends as blocked
        if (blocked && !aborted) await endBlocked();
        else if (!aborted) {
          console.error('chat stream', e?.status, e?.message);
          await settle();
          await pass(true);
          if (blocked) await endBlocked();
          else if (careTier) await careFallback();
          else {
            await guardEnd();
            await giveBackOnce();
            await write(`\n[[error:${aiErrorCode(e)}]]`);
          }
        }
      } finally {
        // the reader left, or the stream broke or was stopped: what Claude already did is still priced
        const partial = recorded ? null : usage.message();
        if (partial) await record(partial);
        try { await writer.close(); } catch { /* the client went away */ }
      }
    })();
    ctx.waitUntil(pump);
    return new Response(readable, { headers: { ...cors, ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  if (kind === 'generate') return generateReply({ env, ctx, cors, headers, r, input, client, record, event, giveBackOnce, leftBack, screen });

  let message;
  const usage = usageTracker();
  try {
    // Long outputs (a whole exam) stream so the request never times out; we wait for the final message.
    if (STREAMED(kind)) {
      const stream = client.beta.messages.stream(r.params);
      stream.on('streamEvent', (ev) => usage.event(ev));
      message = await stream.finalMessage();
    } else {
      message = await client.beta.messages.create(r.params);
    }
  } catch (e) {
    const code = aiErrorCode(e);
    // a stream that broke part-way was billed for what it did
    const partial = usage.message();
    if (partial) ctx.waitUntil(record(partial));
    console.error('ai', kind, code, e?.status, e?.message);
    if (careTier) return careStaticReply(kind, input, cors, headers);
    await giveBackOnce();
    throw new HttpError(code === 'busy' ? 429 : 502, code, undefined, undefined, headers);
  }
  ctx.waitUntil(record(message));
  let result;
  try {
    result = readResult(kind, message);
  } catch (e) {
    if (e?.code === 'refusal') event('refusal'); // the model's own boundary (trust spec TRUST-4 §4.3): counted, with no text
    if (careTier) return careStaticReply(kind, input, cors, headers);
    const code = e?.code === 'refusal' || e?.code === 'bad_output' ? e.code : 'bad_output';
    await giveBackOnce();
    throw new HttpError(code === 'refusal' ? 422 : 502, code, undefined, undefined, headers);
  }
  // Every reply is screened before the child sees it (trust spec TRUST-4 §4.2). A care reply (the care path, or one the
  // model marked) is never checked against the blocklist; its links are.
  const isCare = careTier || result?.care === true;
  const checkedOut = screenJson(result, { ...screen, care: isCare });
  if (checkedOut.blocked) {
    await giveBackOnce();
    event('output_blocked');
    // a text reply becomes a calm sentence; a structured result (a check, an exam, exercises) cannot be shown in part
    if (kind === 'explain' || kind === 'chat') { leftBack(); return json({ text: BLOCKED_TEXT, blocked: true }, 200, cors, headers); }
    leftBack();
    throw new HttpError(502, 'bad_output', undefined, undefined, headers);
  }
  if (checkedOut.linksRemoved) event('link_removed');
  result = checkedOut.data;
  if (careTier) return json({ ...result, care: true }, 200, cors, headers);
  // The final-answer guard on a whole reply (ai spec AI-3 Design 3): a leaked answer masked in explain and chat (with
  // MASK_NOTE), and a check withheld (comments and summary masked, no mark on the line with the final value). It runs
  // after the blocklist, on what the child would see; a care reply is never touched.
  if (guard.on) {
    const out = guardResult(kind, result, guard);
    result = out.result;
    if (out.masked) bumpQuality(env, ctx, kind, 'answer_masked');
  }
  if (result?.care === true) {
    await modelCare();
    leftBack();
  }
  return json(result, 200, cors, headers);
}
/**
 * New exercises (ai spec AI-4 Design 6): the app's seeds are rewritten by the main model, the new stories are solved
 * blind by the low-cost model (BLIND_MODEL, else FREE_MODEL), and code decides what may be shown (generateVerified,
 * shared/ai.js; the same path the personal key and the evaluation run). Every message is priced as it comes, both on the
 * caller's pool under 'generate'. Each drop reason is counted in ai_quality with how many stories it dropped, and a blind
 * solve that failed twice as blind_skipped. When no story passed, the question is given back and the reply says so
 * ({ items: [], dropped, fallback: true }): the app then shows its own exercises.
 */
async function generateReply({ env, ctx, cors, headers, r, input, client, record, event, giveBackOnce, leftBack, screen }) {
  const call = async (params) => {
    const message = await client.beta.messages.create(params);
    ctx.waitUntil(record(message));
    return message;
  };
  let out;
  try {
    out = await generateVerified(call, r.input ?? input, { model: r.params.model, blindModel: env.BLIND_MODEL || env.FREE_MODEL || LITE_MODEL });
  } catch (e) {
    const code = aiErrorCode(e);
    if (code === 'refusal') event('refusal'); // the model's own boundary (trust spec TRUST-4 §4.3): counted, with no text
    console.error('ai', 'generate', code, e?.status, e?.message);
    await giveBackOnce();
    throw new HttpError(code === 'refusal' ? 422 : code === 'busy' ? 429 : 502, code, undefined, undefined, headers);
  }
  for (const reason of DROP_REASONS) bumpQuality(env, ctx, 'generate', `gen_${reason}`, out.dropped[reason] || 0);
  if (out.blind === 'skipped') bumpQuality(env, ctx, 'generate', 'blind_skipped');
  const result = { items: out.items, dropped: out.dropped, fallback: out.fallback };
  if (out.fallback) {
    bumpQuality(env, ctx, 'generate', 'gen_all_failed');
    await giveBackOnce();
    leftBack();
    return json(result, 200, cors, headers);
  }
  // screened like every reply (trust spec TRUST-4 §4.2): exercises cannot be shown in part
  const checkedOut = screenJson(result, { ...screen, care: false });
  if (checkedOut.blocked) {
    await giveBackOnce();
    event('output_blocked');
    leftBack();
    throw new HttpError(502, 'bad_output', undefined, undefined, headers);
  }
  if (checkedOut.linksRemoved) event('link_removed');
  return json(checkedOut.data, 200, cors, headers);
}

// ---------- a child reports an AI answer (trust spec TRUST-4 §4.5) ----------
const REPORT_REASONS = Object.freeze(['wrong_math', 'not_nice', 'not_for_kids', 'other']);
const REPORT_KINDS = Object.freeze(['chat', 'explain', 'check', 'exam', 'generate']);
const REPORT_TIERS = ['free', 'family', 'class', 'teacher', 'trial', 'legacy', 'open', 'care', 'personal'];
const REPORT_MAX = 4000;
// 10 a day from one child or device, and a ceiling for a whole network (a school shares one), so the table cannot be
// filled by inventing device ids
const REPORTS_PER_DAY = 10;
const REPORTS_PER_NET = 100;

/**
 * POST /api/ai/report { reason, kind, reply, tier? }: the tutor's answer a child marked as wrong or not fit for them.
 * Only the reply is kept: masked here (maskPersonal) and clipped to 4,000 characters. Nothing else in the body is read,
 * so a child's own message is never stored even if a client sent it, and the row says nothing about who reported it.
 * A user_report safety event counts it (no text). The owner reads them with npm run owner -- reports.
 */
async function reportAnswer(req, env, ctx, cors) {
  const b = await body(req, 16 * KB);
  const reason = String(b.reason || ''); const kind = String(b.kind || '');
  const raw = typeof b.reply === 'string' ? b.reply : '';
  if (!REPORT_REASONS.includes(reason) || !REPORT_KINDS.includes(kind) || !raw.trim()) throw new HttpError(400, 'bad_request');
  const tier = REPORT_TIERS.includes(b.tier) ? b.tier : '';
  // masked before it is clipped, so a phone number cut at the edge is never kept in part
  const reply = maskPersonal(raw.slice(0, 2 * REPORT_MAX)).text.slice(0, REPORT_MAX);
  const id = await identify(req, env);
  const net = await netKey(req, env);
  const who = id.student ? `s:${id.student.id}`
    : id.fam ? `fd:${id.fam.device_id}`
      : id.teacher ? `t:${id.teacher.code}`
        : id.device ? `d:${await devKey(env, id.device)}`
          : `x:${net}`;
  const err = new HttpError(429, 'too_many_reports');
  const r = await take(env, [key(`report:${who}`, REPORTS_PER_DAY, { err }), key(`report:n:${net}`, REPORTS_PER_NET, { err })]);
  if (!r.ok) throw r.error;
  await env.DB.prepare('INSERT INTO answer_reports (created_at, reason, kind, reply, tier) VALUES (?, ?, ?, ?, ?)')
    .bind(nowIso(), reason, kind, reply, tier).run();
  recordSafety(env, { kind: 'user_report', category: reason, surface: kind, source: 'client', tier }, ctx);
  return json({ ok: true }, 200, cors);
}

function aiErrorCode(e) {
  if (e?.code === 'refusal' || e?.code === 'bad_output') return e.code;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'server_key';
  if (e instanceof Anthropic.RateLimitError) return 'busy';
  if (e instanceof Anthropic.BadRequestError) return 'bad_request';
  if (e instanceof Anthropic.APIError && e.status >= 500) return 'upstream';
  return 'upstream';
}

// ---------- devices (only with FREE_DEVICE_MINT = "turnstile") ----------
async function mintDevice(req, env, cors) {
  if (String(env.FREE_DEVICE_MINT || 'off') !== 'turnstile' || !env.TURNSTILE_SECRET || !env.DEVICE_SECRET) throw new HttpError(404, 'not_found');
  const b = await body(req, LIMIT.small);
  const net = await netKey(req, env);
  await limitOrThrow(env, `mint:n:${net}`, 300, 429, 'too_many_devices');
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(b.turnstile || '').slice(0, 2048) });
  const ip = req.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  let ok = false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const v = await res.json();
    const host = (() => { try { return new URL(env.PUBLIC_URL).hostname; } catch { return ''; } })();
    ok = v.success === true && v.action === 'device' && (!host || v.hostname === host);
  } catch { ok = false; }
  if (!ok) throw new HttpError(403, 'bot_check');
  const id = randomToken(16);
  return json({ device: `dv1.${id}.${(await hmacHex(env.DEVICE_SECRET, `device:${id}`)).slice(0, 32)}` }, 201, cors);
}

// ---------- classes ----------
async function createClass(req, env, cors) {
  const b = await body(req, LIMIT.small);
  const name = cleanName(b.className); const teacherName = cleanName(b.teacherName);
  const grade = b.grade === '8' ? '8' : '7';
  if (!name || !teacherName) throw new HttpError(400, 'missing_fields');
  // where the class learns (trust spec TRUST-11 §3): a school (the default) or a private group its teacher attests to
  const setting = newClassSetting(b);
  await limitOrThrow(env, `create:n:${await netKey(req, env)}`, 10, 429, 'too_many_classes');
  const teacherKey = randomToken(12);
  for (let i = 0; i < 5; i++) {
    const code = classCode();
    const now = nowIso();
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(code, name, grade, teacherName, await sha256(teacherKey), now),
        ...newClassStmts(env, code, setting, now),
      ]);
      return json({ code, teacherKey, className: name, grade, teacherName, setting }, 200, cors);
    } catch (e) { if (!String(e?.message).includes('UNIQUE')) throw e; }
  }
  throw new HttpError(500, 'code_collision');
}

async function classInfo(code, req, env, cors) {
  // a whole school shares one network, so this is generous; it stops guessing class codes
  await limitOrThrow(env, `classinfo:n:${await netKey(req, env)}`, 500, 429, 'too_many_lookups');
  const cls = await env.DB.prepare('SELECT name, grade, teacher_name FROM classes WHERE code = ?').bind(code.toUpperCase()).first();
  if (!cls) throw new HttpError(404, 'no_class');
  return json({ className: cls.name, grade: cls.grade, teacherName: cls.teacher_name }, 200, cors);
}

async function joinClass(code, req, env, cors) {
  const b = await body(req, LIMIT.small);
  const name = cleanName(b.name); const pin = String(b.pin || '');
  if (!name) throw new HttpError(400, 'missing_name');
  if (!/^\d{4}$/.test(pin)) throw new HttpError(400, 'bad_pin');
  // A whole school can share one network, so this cap is generous; PIN guessing is capped per student below.
  const net = await netKey(req, env);
  await limitOrThrow(env, `join:n:${net}`, 300, 429, 'too_many_joins');
  const cls = await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(code.toUpperCase()).first();
  if (!cls) throw new HttpError(404, 'no_class');
  const token = randomToken();
  const existing = await env.DB.prepare('SELECT * FROM students WHERE class_code = ? AND name = ?').bind(cls.code, name).first();
  // a class its teacher closed to new names still lets its students back in with their PIN
  if (!existing && (await joinLocked(env, cls.code))) throw new HttpError(403, 'class_locked');
  let id;
  if (existing) {
    // An empty pin_hash means the teacher reset it: the next join sets a new PIN.
    if (existing.pin_hash) {
      const err = new HttpError(429, 'too_many_pin');
      const tries = [
        key(`pin:${existing.id}:${net}`, PIN_NET_HOUR, { period: 'hour', refundable: true, err }),
        key(`pin:${existing.id}`, PIN_DAY, { refundable: true, err }),
      ];
      const r = await take(env, tries);
      if (!r.ok) throw r.error;
      if (!(await verifyPin(pin, existing.pin_hash))) throw new HttpError(403, 'wrong_pin');
      await giveBack(env, tries); // the right code costs no try
    }
    id = existing.id;
    await env.DB.prepare('UPDATE students SET token_hash = ?, pin_hash = ?, last_seen = ? WHERE id = ?')
      .bind(await sha256(token), existing.pin_hash || (await hashPin(pin)), nowIso(), id).run();
  } else {
    id = randomToken(8);
    await env.DB.prepare('INSERT INTO students (id, class_code, name, pin_hash, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, cls.code, name, await hashPin(pin), await sha256(token), nowIso(), nowIso()).run();
  }
  return json({ studentId: id, token, name, className: cls.name, grade: cls.grade, classCode: cls.code, returning: !!existing }, 200, cors);
}

// ---------- student data ----------
async function saveProgress(req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, LIMIT.progress);
  const events = (Array.isArray(b.events) ? b.events : []).slice(0, 300);
  const now = Date.now();
  const stmts = [];
  for (const e of events) {
    const at = Math.min(Number(new Date(e.at)) || now, now);
    stmts.push(env.DB.prepare(
      'INSERT INTO attempts (student_id, topic, level, ok, first_try, hint, cat, secs, day, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(s.id, String(e.topic).slice(0, 20), Number(e.level) || 1, e.ok ? 1 : 0, e.first ? 1 : 0, e.hint ? 1 : 0,
      e.cat ? String(e.cat).slice(0, 30) : null, Math.min(Math.max(Number(e.secs) || 0, 0), 600), dayOf(new Date(at)), new Date(at).toISOString()));
  }
  for (const [topic, v] of Object.entries(b.levels || {}).slice(0, 20)) {
    stmts.push(env.DB.prepare(
      'INSERT INTO levels (student_id, topic, level, max_level, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (student_id, topic) DO UPDATE SET level = excluded.level, max_level = MAX(levels.max_level, excluded.max_level), updated_at = excluded.updated_at',
    ).bind(s.id, String(topic).slice(0, 20), Number(v.level) || 1, Number(v.max) || 1, nowIso()));
  }
  stmts.push(env.DB.prepare('UPDATE students SET last_seen = ? WHERE id = ?').bind(nowIso(), s.id));
  await env.DB.batch(stmts);
  return json({ saved: events.length }, 200, cors);
}

/** The title a class exam is kept under: no name-like ID, phone or long number (trust spec TRUST-5 §6). */
const examTitle = (t) => scrubTitle(String(t || '').trim() || 'מבחן').slice(0, 80);

async function saveExam(req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, LIMIT.exams);
  const qs = (Array.isArray(b.questions) ? b.questions : []).slice(0, 40).map((q) => ({
    topic: TOPIC_IDS.includes(q.topic) ? q.topic : 'other', status: ['correct', 'partial', 'wrong', 'missing'].includes(q.status) ? q.status : 'missing', skill: String(q.skill || '').slice(0, 60),
    level: Number.isInteger(q.level) && q.level > 0 && q.level <= 12 ? q.level : 0,
  }));
  const weak = (Array.isArray(b.weakTopics) ? b.weakTopics : []).filter((t) => TOPIC_IDS.includes(t)).slice(0, 6);
  await env.DB.prepare('INSERT INTO exams (student_id, title, correct, total, questions, weak, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(s.id, examTitle(b.title), Number(b.correct) || 0, Number(b.total) || qs.length, JSON.stringify(qs), JSON.stringify(weak), nowIso()).run();
  return json({ ok: true }, 200, cors);
}

/**
 * POST /api/help: a class student asks the teacher. Either help with an exercise ({ topic, level, question, answer,
 * note?, image? }) or, with { kind: 'talk' } and no text, "I want the teacher to talk with me" (trust spec TRUST-3
 * §3.5): stored with an empty question and note and help_meta.kind = 'talk', one open at a time, and never refused for
 * the number of open requests. A note that reads as distress is checked here again (the device's own check is never
 * trusted) and marks the request help_meta.care = 1, so the teacher sees "כדאי לבדוק מה שלום התלמיד/ה". The note is
 * the child's own message to their teacher; the safety log keeps only a count.
 */
async function askHelp(req, env, ctx, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, LIMIT.help);
  if (b.kind === 'talk') {
    const talking = await env.DB.prepare(`SELECT h.id FROM help_requests h JOIN help_meta m ON m.help_id = h.id
      WHERE h.student_id = ? AND h.done_at IS NULL AND m.kind = 'talk' LIMIT 1`).bind(s.id).first();
    if (talking) return json({ ok: true, again: true }, 200, cors);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO help_requests (student_id, topic, level, question, answer, note, image, created_at) VALUES (?, \'\', NULL, \'\', \'\', \'\', NULL, ?)').bind(s.id, nowIso()),
      env.DB.prepare('INSERT INTO help_meta (help_id, kind, care) SELECT MAX(id), \'talk\', 0 FROM help_requests WHERE student_id = ?').bind(s.id),
    ]);
    return json({ ok: true }, 200, cors);
  }
  const note = String(b.note || '').slice(0, 300);
  const hit = detectDistress(note);
  // a note that reads as distress always reaches the teacher, however many requests are open
  const open = hit.flag ? null : await env.DB.prepare('SELECT COUNT(*) AS n FROM help_requests WHERE student_id = ? AND done_at IS NULL').bind(s.id).first();
  if (open && open.n >= 10) throw new HttpError(429, 'too_many_open');
  if (hit.flag) recordSafety(env, { kind: 'distress', category: hit.category, surface: 'help_note', source: 'regex' }, ctx);
  // Optional notebook page: a JPEG data URL of the student's working, kept small.
  const image = typeof b.image === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.image) && b.image.length <= 600_000 ? b.image : null;
  // The same exercise asked again while its request is still open: one request, with the newest note and page (a
  // talk request, with its empty question, is never one of them).
  const question = String(b.question || '').slice(0, 600);
  const same = await env.DB.prepare(`SELECT id FROM help_requests WHERE student_id = ? AND done_at IS NULL AND question = ?
    AND id NOT IN (SELECT help_id FROM help_meta WHERE kind = 'talk') LIMIT 1`).bind(s.id, question).first();
  if (same) {
    await env.DB.batch([
      env.DB.prepare('UPDATE help_requests SET note = CASE WHEN ? <> \'\' THEN ? ELSE note END, image = COALESCE(?, image), answer = ? WHERE id = ?')
        .bind(note, note, image, String(b.answer || '').slice(0, 100), same.id),
      // once a note read as distress, the request stays marked for the teacher
      ...(hit.flag ? [env.DB.prepare('INSERT INTO help_meta (help_id, kind, care) VALUES (?, \'help\', 1) ON CONFLICT (help_id) DO UPDATE SET care = 1').bind(same.id)] : []),
    ]);
    return json({ ok: true, again: true }, 200, cors);
  }
  await env.DB.batch([
    env.DB.prepare('INSERT INTO help_requests (student_id, topic, level, question, answer, note, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, String(b.topic || '').slice(0, 20), Number(b.level) || null, question, String(b.answer || '').slice(0, 100), note, image, nowIso()),
    ...(hit.flag ? [env.DB.prepare('INSERT INTO help_meta (help_id, kind, care) SELECT MAX(id), \'help\', 1 FROM help_requests WHERE student_id = ?').bind(s.id)] : []),
  ]);
  return json({ ok: true }, 200, cors);
}

// ---------- teacher ----------
async function dashboard(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const today = dayOf(); const weekStart = daysAgo(6);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results || []);
  const [students, todayRows, weekRows, levelRows, catRows, catStudents, help, lastRows, examRows, locked, aiOffRows, aiSettings] = await Promise.all([
    q('SELECT id, name, last_seen, created_at, pin_hash = \'\' AS pin_reset FROM students WHERE class_code = ? ORDER BY name', cls.code),
    q(`SELECT a.student_id, COUNT(*) AS n, SUM(a.ok) AS ok, SUM(a.first_try) AS first, SUM(a.secs) AS secs
       FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? AND a.day = ? GROUP BY a.student_id`, cls.code, today),
    q(`SELECT a.student_id, COUNT(*) AS n, SUM(a.first_try) AS first, COUNT(DISTINCT a.day) AS days, SUM(a.secs) AS secs
       FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? AND a.day >= ? GROUP BY a.student_id`, cls.code, weekStart),
    q('SELECT l.student_id, l.topic, l.level, l.max_level FROM levels l JOIN students s ON s.id = l.student_id WHERE s.class_code = ?', cls.code),
    q(`SELECT a.topic, a.cat, COUNT(*) AS n, COUNT(DISTINCT a.student_id) AS students
       FROM attempts a JOIN students s ON s.id = a.student_id
       WHERE s.class_code = ? AND a.day >= ? AND a.cat IS NOT NULL GROUP BY a.topic, a.cat ORDER BY students DESC, n DESC LIMIT 12`, cls.code, weekStart),
    q(`SELECT DISTINCT a.topic, a.cat, s.name FROM attempts a JOIN students s ON s.id = a.student_id
       WHERE s.class_code = ? AND a.day >= ? AND a.cat IS NOT NULL`, cls.code, weekStart),
    // kind 'help' or 'talk' and care 0/1 (trust spec TRUST-3 §3.5): a request with no help_meta row is a plain 'help', care 0
    q(`SELECT h.id, h.topic, h.level, h.question, h.answer, h.note, h.image IS NOT NULL AS has_image, h.created_at, h.seen_at, h.done_at, s.name,
       COALESCE(m.kind, 'help') AS kind, COALESCE(m.care, 0) AS care
       FROM help_requests h JOIN students s ON s.id = h.student_id LEFT JOIN help_meta m ON m.help_id = h.id
       WHERE s.class_code = ? AND (h.done_at IS NULL OR h.done_at >= ?) ORDER BY h.created_at DESC LIMIT 100`, cls.code, daysAgo(7)),
    q('SELECT a.student_id, MAX(a.at) AS last FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? GROUP BY a.student_id', cls.code),
    q('SELECT e.id, e.student_id, e.title, e.correct, e.total, e.questions, e.weak, e.created_at, s.name FROM exams e JOIN students s ON s.id = e.student_id WHERE s.class_code = ? ORDER BY e.created_at DESC LIMIT 200', cls.code),
    joinLocked(env, cls.code),
    // the Ministry's AI rules for this class (trust spec TRUST-11 §3): the class's switch and each student's own
    q('SELECT so.student_id FROM student_ai_off so JOIN students s ON s.id = so.student_id WHERE s.class_code = ?', cls.code),
    classSettings(env, cls.code),
  ]);
  const aiOff = new Set(aiOffRows.map((r) => r.student_id));
  const by = (rows) => Object.fromEntries(rows.map((r) => [r.student_id, r]));
  const t = by(todayRows); const w = by(weekRows); const lastPractice = by(lastRows);
  const lv = {};
  for (const r of levelRows) (lv[r.student_id] ||= {})[r.topic] = { level: r.level, max: r.max_level };
  return json({
    class: { code: cls.code, name: cls.name, grade: cls.grade, teacherName: cls.teacher_name },
    today,
    joinLocked: locked,
    aiPolicy: aiPolicyView(env, cls, aiSettings),
    students: students.map((s) => ({
      id: s.id, name: s.name, lastSeen: s.last_seen, lastPractice: lastPractice[s.id]?.last || null, pinReset: !!s.pin_reset, aiOff: aiOff.has(s.id),
      today: t[s.id] ? { n: t[s.id].n, ok: t[s.id].ok, first: t[s.id].first, minutes: Math.round((t[s.id].secs || 0) / 60) } : { n: 0, ok: 0, first: 0, minutes: 0 },
      week: w[s.id] ? { n: w[s.id].n, first: w[s.id].first, days: w[s.id].days, minutes: Math.round((w[s.id].secs || 0) / 60) } : { n: 0, first: 0, days: 0, minutes: 0 },
      levels: lv[s.id] || {},
    })),
    exams: examRows.map((e) => ({ id: e.id, studentId: e.student_id, name: e.name, title: e.title, correct: e.correct, total: e.total, weak: JSON.parse(e.weak || '[]'), questions: JSON.parse(e.questions || '[]'), at: e.created_at })),
    mistakes: catRows.map((r) => ({ ...r, names: catStudents.filter((c) => c.topic === r.topic && c.cat === r.cat).map((c) => c.name) })),
    help,
  }, 200, cors);
}

async function updateHelp(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, LIMIT.small);
  const col = b.action === 'done' ? 'done_at' : b.action === 'seen' ? 'seen_at' : null;
  const sql = b.action === 'reopen'
    ? 'UPDATE help_requests SET done_at = NULL WHERE id = ? AND student_id IN (SELECT id FROM students WHERE class_code = ?)'
    : col ? `UPDATE help_requests SET ${col} = COALESCE(${col}, ?) WHERE id = ? AND student_id IN (SELECT id FROM students WHERE class_code = ?)` : null;
  if (!sql) throw new HttpError(400, 'bad_action');
  const args = b.action === 'reopen' ? [Number(id), cls.code] : [nowIso(), Number(id), cls.code];
  await env.DB.prepare(sql).bind(...args).run();
  return json({ ok: true }, 200, cors);
}

async function helpImage(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const row = await env.DB.prepare('SELECT h.image FROM help_requests h JOIN students s ON s.id = h.student_id WHERE h.id = ? AND s.class_code = ?')
    .bind(Number(id), cls.code).first();
  if (!row?.image) throw new HttpError(404, 'not_found');
  return json({ image: row.image }, 200, cors);
}

async function resetPin(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const r = await env.DB.prepare('UPDATE students SET pin_hash = \'\', token_hash = ? WHERE id = ? AND class_code = ?')
    .bind(await sha256(randomToken()), id, cls.code).run();
  // A reset also clears every wrong-code count (each network's and the day's), so the student can choose a new code now.
  if (r.meta?.changes) await env.DB.prepare(`DELETE FROM ai_usage WHERE ${pinKeysWhere}`).bind(id).run();
  return json({ ok: true }, 200, cors);
}

// ---------- router ----------
function health(env) {
  const provider = currentProvider(env);
  return {
    ok: true, ai: !!env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || null, freeModel: env.FREE_MODEL || LITE_MODEL,
    soloAI: String(env.ALLOW_SOLO_AI) !== 'false', paywall: paywallOn(env), email: emailReady(env), checkout: onlineCheckout(env),
    billing: provider?.id || 'none', mode: env.BILLING_MODE === 'test' ? 'test' : 'live',
    deviceMint: String(env.FREE_DEVICE_MINT || 'off') === 'turnstile' ? 'turnstile' : 'off', turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    // whether the secrets that classes, sign-in and network counters need are set (never their values)
    netKeys: !!env.IP_HASH_SECRET, auth: !!env.AUTH_SECRET,
  };
}

async function route(req, env, ctx, cors) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '');
  const M = req.method;
  let m;
  if (M === 'GET' && p === '/api/health') return json(health(env), 200, cors);
  // child side: AI
  if (M === 'GET' && p === '/api/ai/status') {
    const s = await aiStatus(req, env);
    return json(s.body, 200, cors, s.headers);
  }
  if (M === 'POST' && p === '/api/ai/report') return reportAnswer(req, env, ctx, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/ai\/(\w+)$/))) return handleAI(m[1], req, env, ctx, cors);
  if (M === 'POST' && p === '/api/devices') return mintDevice(req, env, cors);
  // parent and teacher accounts
  if (M === 'POST' && p === '/api/account/code') return startLogin(req, env, cors);
  if (M === 'POST' && p === '/api/account/verify') return verifyLogin(req, env, cors);
  if (M === 'POST' && p === '/api/account/signout') return signOut(req, env, cors);
  if (M === 'GET' && p === '/api/account') return accountOverview(req, env, cors);
  if (M === 'GET' && p === '/api/account/export') return accountExport(req, env, cors);
  if (M === 'POST' && p === '/api/account/delete') return deleteAccount(req, env, ctx, cors);
  // billing
  if (M === 'GET' && p === '/api/billing/plans') return json(plansView(env), 200, cors);
  if (M === 'POST' && p === '/api/billing/checkout') return checkout(req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/billing\/orders\/([a-f0-9]{16})$/))) return orderStatus(m[1], req, env, cors);
  if (M === 'POST' && p === '/api/billing/cancel') return cancel(req, env, ctx, cors);
  if (M === 'POST' && p === '/api/billing/resume') return resume(req, env, cors);
  if (M === 'GET' && p === '/api/billing/portal') return portal(req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/billing\/payments\/([a-f0-9]{16})\/invoice$/))) return invoice(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/billing\/webhook\/([a-z]{2,20})\/([A-Za-z0-9]{1,128})$/))) return webhook(m[1], m[2], req, env, ctx, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/billing\/test-pay\/([a-f0-9]{16})$/))) return testPayPage(m[1], env);
  if (M === 'POST' && (m = p.match(/^\/api\/billing\/test-pay\/([a-f0-9]{16})$/))) return testPaySubmit(m[1], req, env, ctx);
  // family devices: the child's device starts a link and collects its token; the parent claims it (spec §3.3)
  if (M === 'POST' && p === '/api/family/link/start') return linkStart(req, env, cors);
  if (M === 'POST' && p === '/api/family/link/finish') return linkFinish(req, env, cors);
  if (M === 'POST' && p === '/api/family/link/claim') return linkClaim(req, env, ctx, cors);
  if (M === 'POST' && p === '/api/family/devices/this') return linkThisDevice(req, env, ctx, cors);
  if (M === 'POST' && p === '/api/family/devices/leave') return leaveFamily(req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/family\/devices\/([a-f0-9]{16})\/unlink$/))) return unlinkDevice(m[1], req, env, cors);
  // classes and students
  if (M === 'POST' && p === '/api/classes') return createClass(req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/classes\/([A-Za-z0-9]{6})$/))) return classInfo(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/classes\/([A-Za-z0-9]{6})\/join$/))) return joinClass(m[1], req, env, cors);
  if (M === 'POST' && p === '/api/progress') return saveProgress(req, env, cors);
  if (M === 'POST' && p === '/api/help') return askHelp(req, env, ctx, cors);
  if (M === 'POST' && p === '/api/exams') return saveExam(req, env, cors);
  // teacher
  if (M === 'GET' && p === '/api/teacher/dashboard') return dashboard(req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/help\/(\d+)$/))) return updateHelp(m[1], req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/teacher\/help\/(\d+)\/image$/))) return helpImage(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]+)\/reset-pin$/))) return resetPin(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]+)\/remove$/))) return removeStudent(m[1], req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/lock') return lockClass(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/ai') return setClassAi(req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]+)\/ai$/))) return setStudentAi(m[1], req, env, cors);
  if (M === 'GET' && p === '/api/teacher/licence') return licenceStatus(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/licence/request') return licenceRequest(req, env, ctx, cors);
  if (M === 'POST' && p === '/api/teacher/licence/claim') return licenceClaim(req, env, cors);
  return json({ error: 'not_found' }, 404, cors);
}

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      return await route(req, env, ctx, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message, ...(e.extra || {}) }, e.status, cors, e.headers || {});
      // never log the request URL: the webhook route carries a secret in its path
      console.error('unhandled', e?.message);
      return json({ error: 'server_error' }, 500, cors);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(env, { now: new Date(event?.scheduledTime || Date.now()) }));
  },
};
