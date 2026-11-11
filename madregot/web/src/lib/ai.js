// AI actions. Server mode goes through the Worker (the key stays on the server); the device sends its own id and,
// when linked to a family plan, its AI-only token: never the parent's session. A personal key (calling Claude from
// this device) exists only in builds made with VITE_ALLOW_PERSONAL_KEY=1, the copies without a server.
import { buildRequest, readResult, STREAMED } from '@shared/ai.js';
import { useApp } from './store.js';
import { apiBase, ApiError, errorText } from './api.js';
import { aiHeaders, aiMode, aiReady, noteUsage, noteLimit, openLimitSheet, LIMIT_ERRORS, useAIStatus } from './account.js';
import { qaActive, qaReply } from './qaFixtures.js';
import { needsConsent, askConsent } from './aiConsent.js';

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

/** The tutor said "not now": remember it, open the calm sheet, and give the caller an error it shows quietly. */
function limited(kind, data, status, onMadi) {
  noteLimit(data, kind);
  const tier = data.tier || useAIStatus.getState().status?.tier || null;
  openLimitSheet({ reason: data.error, tier, scope: data.scope || null, onMadi });
  return Object.assign(new ApiError(data.error, status, data), { limit: true });
}

/**
 * Run an AI action. For 'chat', pass onText to receive the reply as it streams. onMadi: what the calm sheet's
 * "לשאול את מדי" does when the tutor says no for today (the opener's own way to Madi).
 * Resolves to { text } for explain/chat, or the parsed JSON for generate/check/exam.
 */
export async function runAI(kind, input, { onText, signal, onMadi } = {}) {
  const mode = aiMode();
  if (mode === 'none') throw new ApiError('no_server');
  // a store build asks before the first request on this device (STUDENT-12): "לא עכשיו" sends nothing, and the screen
  // goes quietly back to where it was (callers treat .limit as "already said")
  if (needsConsent() && !(await askConsent())) throw Object.assign(new ApiError('no_consent'), { limit: true });

  if (qaActive()) {
    try {
      const r = qaReply(kind);
      onText?.(r.text);
      return r;
    } catch (e) { throw limited(kind, e.qa || { error: 'upstream' }, 429, onMadi); }
  }

  if (mode === 'personal') {
    const client = await personalClient();
    const params = buildRequest(kind, input);
    try {
      if (kind === 'chat' && onText) {
        const stream = client.beta.messages.stream(params, { signal });
        let acc = '';
        stream.on('text', (t) => { acc += t; onText(acc); });
        const final = await stream.finalMessage();
        return readResult(kind, final);
      }
      if (STREAMED(kind)) return readResult(kind, await client.beta.messages.stream(params, { signal }).finalMessage());
      return readResult(kind, await client.beta.messages.create(params, { signal }));
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
    if (LIMIT_ERRORS.includes(data.error)) throw limited(kind, data, res.status, onMadi);
    throw new ApiError(data.error || 'upstream', res.status, data);
  }
  noteUsage(res);
  if (kind === 'chat' && onText && res.body) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
      const clean = acc.replace(/\n?\[\[(refusal|error:[a-z_]+)\]\]\s*$/, '');
      onText(clean);
    }
    const tail = acc.match(/\[\[(refusal|error:([a-z_]+))\]\]\s*$/);
    if (tail) throw new ApiError(tail[1] === 'refusal' ? 'refusal' : tail[2]);
    return { text: acc };
  }
  return res.json();
}

export { errorText };
