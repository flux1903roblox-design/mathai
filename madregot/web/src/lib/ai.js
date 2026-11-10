// AI actions. Server mode goes through the Worker (the key stays on the server); the device sends its own id and,
// when linked to a family plan, its AI-only token: never the parent's session. A personal key (calling Claude from
// this device) exists only in builds made with VITE_ALLOW_PERSONAL_KEY=1: the owner's own local testing, never a public
// build (trust spec TRUST-4 §4.8).
import { buildRequest, readResult, splitCare, STREAMED } from '@shared/ai.js';
import { CARE_MARK, BLOCKED_TEXT } from '@shared/safety.js';
import { useApp } from './store.js';
import { apiBase, ApiError, errorText } from './api.js';
import { aiHeaders, aiMode, aiReady, noteUsage, noteLimit, openLimitSheet, LIMIT_ERRORS, useAIStatus } from './account.js';
import { qaActive, qaReply } from './qaFixtures.js';

export { aiMode, aiReady };

let clientPromise = null; let clientKey = '';
async function personalClient() {
  const key = useApp.getState().ai.key;
  if (import.meta.env.VITE_ALLOW_PERSONAL_KEY === '1') {
    if (!clientPromise || clientKey !== key) {
      clientKey = key;
      clientPromise = import('@anthropic-ai/sdk').then(({ default: Anthropic }) => new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }));
    }
    return clientPromise;
  }
  throw new ApiError('no_server');
}

function personalError(e) {
  if (e?.code === 'refusal' || e?.code === 'bad_output') return new ApiError(e.code);
  const s = e?.status;
  if (s === 401 || s === 403) return Object.assign(new ApiError('server_key'), { message: 'מפתח ה־Claude ששמרתם לא תקין. בדקו אותו בהגדרות, בחלק "מתקדם".' });
  if (s === 429 || s === 529) return new ApiError('busy');
  if (!s) return new ApiError('network');
  return new ApiError('upstream');
}

// ---------------------------------------------------------------- the markers at the end of a streamed reply
// The server ends a streamed chat with markers: [[care]] (show the support card), [[blocked]], [[refusal]] or
// [[error:<code>]], any number of them. They are never shown, not even half-arrived ("[[ca"), and a care line the
// model put first (the personal key) is hidden too.
const TAIL = /(?:\n?\[\[(?:refusal|care|blocked|error:[a-z_]+)\]\])+\s*$/;
const PARTIAL = /\n?\[\[[a-z:_]*\]?$/;

/** What a reply that is still arriving shows: no marker, whole or in part. */
export function streamView(acc) {
  const lead = String(acc).replace(/^\s+/, '');
  if (lead && CARE_MARK.startsWith(lead)) return '';
  return splitCare(acc).text.replace(PARTIAL, '').replace(TAIL, '');
}

/**
 * The finished reply: { text, care }. Throws the error a refusal or [[error:<code>]] marker carries. A reply the server
 * stopped ([[blocked]]: it was not fit to show) becomes the calm sentence, with blocked: true; never a red error.
 */
export function streamEnd(acc) {
  const lead = splitCare(acc);
  const tail = (lead.text.match(TAIL) || [''])[0];
  const marks = [...tail.matchAll(/\[\[(refusal|care|blocked|error:([a-z_]+))\]\]/g)];
  const err = marks.find((m) => m[1] === 'refusal' || m[2]);
  if (err) throw new ApiError(err[1] === 'refusal' ? 'refusal' : err[2]);
  const care = lead.care || marks.some((m) => m[1] === 'care');
  // (the server never stops a care reply; were both ever there, the care reply is what a child in distress needs)
  if (!care && marks.some((m) => m[1] === 'blocked')) return { text: BLOCKED_TEXT, care: false, blocked: true };
  return { text: lead.text.slice(0, lead.text.length - tail.length), care };
}

/**
 * The tutor said "not now": remember it, open the calm sheet, and give the caller an error it shows quietly. `quiet`
 * (a message that reads as distress, already answered by the support card on screen): no sheet, nothing remembered;
 * the server's care path never says "not now", so only an older server could.
 */
function limited(kind, data, status, onMadi, quiet = false) {
  if (quiet) return Object.assign(new ApiError(data.error, status, data), { limit: true });
  noteLimit(data, kind);
  const tier = data.tier || useAIStatus.getState().status?.tier || null;
  openLimitSheet({ reason: data.error, tier, scope: data.scope || null, onMadi });
  return Object.assign(new ApiError(data.error, status, data), { limit: true });
}

/**
 * Run an AI action. For 'chat', pass onText to receive the reply as it streams. onMadi: what the calm sheet's
 * "לשאול את מדי" does when the tutor says no for today (the opener's own way to Madi). quiet: never open the limit
 * sheet (a message that reads as distress: the support card is already on screen, and no paywall or limit may follow).
 * Resolves to { text, care } for explain/chat, or the parsed JSON for generate/check/exam (with care for check/exam;
 * care: true means the reply is about the student's wellbeing, and the screen shows the support card).
 */
export async function runAI(kind, input, { onText, signal, onMadi, quiet = false } = {}) {
  const mode = aiMode();
  if (mode === 'none') throw new ApiError('no_server');

  if (qaActive()) {
    try {
      const r = qaReply(kind);
      onText?.(r.text);
      return r;
    } catch (e) { throw limited(kind, e.qa || { error: 'upstream' }, 429, onMadi, quiet); }
  }

  if (mode === 'personal') {
    const client = await personalClient();
    const params = buildRequest(kind, input);
    try {
      if (kind === 'chat' && onText) {
        const stream = client.beta.messages.stream(params, { signal });
        let acc = '';
        stream.on('text', (t) => { acc += t; onText(streamView(acc)); });
        const final = await stream.finalMessage();
        return withCare(readResult(kind, final));
      }
      if (STREAMED(kind)) return withCare(readResult(kind, await client.beta.messages.stream(params, { signal }).finalMessage()));
      return withCare(readResult(kind, await client.beta.messages.create(params, { signal })));
    } catch (e) {
      if (e?.name === 'AbortError' || e?.constructor?.name === 'APIUserAbortError') throw e;
      throw personalError(e);
    }
  }

  const st = useApp.getState();
  const token = st.profile?.token;
  const teacherCls = st.profile?.role === 'teacher' ? st.profile.classes?.find((c) => c.code === st.profile.active) : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(teacherCls ? { 'X-Class-Code': teacherCls.code, 'X-Teacher-Key': teacherCls.key } : {}),
    ...aiHeaders(),
  };
  let res;
  try {
    res = await fetch(`${apiBase()}/api/ai/${kind}`, { method: 'POST', headers, signal, body: JSON.stringify({ ...input, stream: !!onText }) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('network');
  }
  if (!res.ok) {
    noteUsage(res); // X-AI-Linked: 0 still tells this device its family link is gone
    const data = await res.json().catch(() => ({}));
    if (LIMIT_ERRORS.includes(data.error)) throw limited(kind, data, res.status, onMadi, quiet);
    throw new ApiError(data.error || 'upstream', res.status, data);
  }
  noteUsage(res);
  if (kind === 'chat' && onText && res.body) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
      onText(streamView(acc));
    }
    acc += dec.decode();
    return streamEnd(acc);
  }
  return withCare(await res.json());
}

/** Every AI result says whether it is a care reply: care is true or false, never missing. */
function withCare(r) {
  return r && typeof r === 'object' ? { ...r, care: r.care === true } : r;
}

export { errorText };
