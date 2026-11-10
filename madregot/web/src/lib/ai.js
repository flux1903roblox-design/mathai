// AI actions. Server mode goes through the Worker (the class's key stays on the
// server). Personal mode calls Claude straight from this device with a key the
// user pasted in Settings; it is meant for one person practising alone.
import { buildRequest, readResult, STREAMED } from '@shared/ai.js';
import { useApp } from './store.js';
import { apiBase, ApiError, errorText } from './api.js';
import { accountHeaders, noteUsage, openPaywall } from './account.js';

export function aiMode() {
  const { ai, profile } = useApp.getState();
  // A personal key is for practising alone; a class always goes through its server.
  if (ai.mode === 'personal' && ai.key && !profile?.classCode) return 'personal';
  return apiBase() ? 'server' : 'none';
}
export const aiReady = () => aiMode() !== 'none';

let clientPromise = null; let clientKey = '';
async function personalClient() {
  const key = useApp.getState().ai.key;
  if (!clientPromise || clientKey !== key) {
    clientKey = key;
    clientPromise = import('@anthropic-ai/sdk').then(({ default: Anthropic }) => new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }));
  }
  return clientPromise;
}

function personalError(e) {
  if (e?.code === 'refusal' || e?.code === 'bad_output') return new ApiError(e.code);
  const s = e?.status;
  if (s === 401 || s === 403) return Object.assign(new ApiError('server_key'), { message: 'מפתח ה־Claude ששמרתם לא תקין. בדקו אותו במסך "אני".' });
  if (s === 429 || s === 529) return new ApiError('busy');
  if (!s) return new ApiError('network');
  return new ApiError('upstream');
}

/**
 * Run an AI action. For 'chat', pass onText to receive the reply as it streams.
 * Resolves to { text } for explain/chat, or the parsed JSON for generate/check.
 */
export async function runAI(kind, input, { onText, signal } = {}) {
  const mode = aiMode();
  if (mode === 'none') throw new ApiError('no_server');

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
    ...accountHeaders(),
  };
  let res;
  try {
    res = await fetch(`${apiBase()}/api/ai/${kind}`, { method: 'POST', headers, signal, body: JSON.stringify({ ...input, stream: !!onText }) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('network');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // the free questions of today are used, or this action is part of the subscription: the app explains, calmly
    if (data.error === 'paid_only' || (data.error === 'daily_limit' && data.tier === 'free')) openPaywall(data.error);
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
