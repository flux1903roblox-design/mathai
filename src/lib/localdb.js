// Local replacement for the Base44 SDK: localStorage entities + local auth + Ollama as the LLM.
// Everything stays in this browser; no cloud API is called except Ollama on localhost.

const OLLAMA_URL = localStorage.getItem('mathai_ollama_url') || 'http://localhost:11434';
export const OLLAMA_MODEL = localStorage.getItem('mathai_ollama_model') || 'gemma3:27b';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// --- entities (API shape matches the Base44 SDK calls used in the pages) ---
function entity(name) {
  const key = 'mathai_entity_' + name;
  const all = () => read(key, []);
  return {
    async filter(where = {}, sort, limit) {
      let rows = all().filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      if (sort) {
        const desc = sort.startsWith('-');
        const f = desc ? sort.slice(1) : sort;
        rows.sort((a, b) => ((a[f] ?? '') > (b[f] ?? '') ? 1 : -1) * (desc ? -1 : 1));
      }
      return limit ? rows.slice(0, limit) : rows;
    },
    async get(id) { return all().find((r) => r.id === id) || null; },
    async create(data) {
      const me = read('mathai_current_user', null);
      const rec = { id: uid(), created_date: new Date().toISOString(), created_by_id: me?.id || null, ...data };
      try { write(key, [...all(), rec]); }
      catch { // ponytail: localStorage quota â€” drop the embedded photo, keep the text
        rec.image_url = null;
        try { write(key, [...all(), rec]); } catch { /* full â€” skip persisting */ }
      }
      return rec;
    },
    async update(id, patch) {
      const rows = all().map((r) => (r.id === id ? { ...r, ...patch, updated_date: new Date().toISOString() } : r));
      write(key, rows);
      return rows.find((r) => r.id === id);
    },
    async delete(id) { write(key, all().filter((r) => r.id !== id)); return {}; },
  };
}

// --- auth (fully local; the OTP/reset flows are accepted without email) ---
const USERS_KEY = 'mathai_users';
const CUR_KEY = 'mathai_current_user';

const auth = {
  async isAuthenticated() { return !!read(CUR_KEY, null); },
  async me() { return read(CUR_KEY, null); },
  async updateMe(patch) {
    const me = read(CUR_KEY, null);
    if (!me) throw new Error('×œ× ×ž×—×•×‘×¨');
    const next = { ...me, ...patch };
    write(CUR_KEY, next);
    write(USERS_KEY, read(USERS_KEY, []).map((u) => (u.id === me.id ? { ...u, ...patch } : u)));
    return next;
  },
  async register({ email, password }) {
    const users = read(USERS_KEY, []);
    if (users.some((u) => u.email === email)) throw new Error('×ž×©×ª×ž×© ×¢× ×”×ž×™×™×œ ×”×–×” ×›×‘×¨ ×§×™×™×');
    users.push({ id: uid(), email, password, full_name: email.split('@')[0], actions_remaining: 5, subscription_plan: 'free' });
    write(USERS_KEY, users);
  },
  async verifyOtp({ email }) { // local mode: any code verifies
    const u = read(USERS_KEY, []).find((x) => x.email === email);
    if (!u) throw new Error('×ž×©×ª×ž×© ×œ× × ×ž×¦×');
    write(CUR_KEY, u);
    return { access_token: 'local' };
  },
  async resendOtp() {},
  setToken() {},
  async loginViaEmailPassword(email, password) {
    const u = read(USERS_KEY, []).find((x) => x.email === email && x.password === password);
    if (!u) throw new Error('××™×ž×™×™×œ ××• ×¡×™×¡×ž×” ×©×’×•×™×™×');
    write(CUR_KEY, u);
    return u;
  },
  loginWithProvider(provider, returnTo) { // no real OAuth locally: instant local account
    const users = read(USERS_KEY, []);
    let u = users.find((x) => x.provider === provider);
    if (!u) {
      u = { id: uid(), email: provider + '@local', provider, full_name: '×ª×œ×ž×™×“', actions_remaining: 5, subscription_plan: 'free' };
      write(USERS_KEY, [...users, u]);
    }
    write(CUR_KEY, u);
    window.location.href = returnTo || import.meta.env.BASE_URL;
  },
  async resetPasswordRequest() {}, // local mode: nothing to email
  async resetPassword() { throw new Error('×‘××¤×œ×™×§×¦×™×” ×ž×§×•×ž×™×ª ××™×Ÿ ××™×¤×•×¡ ×¡×™×¡×ž×” â€” ×”×™×¨×©× ×ž×—×“×©'); },
  async logout() { localStorage.removeItem(CUR_KEY); },
};

// --- AI: shared cloud proxy (Cloudflare Worker holding the Groq key server-side) by default;
// a personal key from Settings overrides it; local Ollama is the last fallback. ---
export const SHARED_AI_URL = 'https://mathai-ai.flux1903roblox.workers.dev'; // filled in by setup-cloud.ps1 after the worker is deployed

export const aiConfig = {
  get() { return read('mathai_ai', { apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', model: 'meta-llama/llama-4-scout-17b-16e-instruct' }); },
  set(cfg) { write('mathai_ai', cfg); },
};

function parseLLMText(text, response_json_schema) {
  if (!response_json_schema) return text;
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/); // model wrapped the JSON in prose or fences
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  throw new Error('×”×ž×•×“×œ ×”×—×–×™×¨ ×ª×©×•×‘×” ×œ× ×ª×§×™× ×”, × ×¡×” ×©×•×‘');
}

async function invokeCloud({ prompt, file_urls, response_json_schema }, cfg) {
  const content = file_urls?.length
    ? [{ type: 'text', text: prompt }, ...file_urls.map((u) => ({ type: 'image_url', image_url: { url: u } }))]
    : prompt;
  const body = {
    model: cfg.model || 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    temperature: 0.2,
    ...(response_json_schema ? { response_format: { type: 'json_object' } } : {}),
  };
  const res = await fetch((cfg.baseUrl || 'https://api.groq.com/openai/v1') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: 'Bearer ' + cfg.apiKey } : {}), // shared proxy needs no client key
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('×ž×¤×ª×— ×”-API ×œ× ×ª×§×™×Ÿ â€” ×‘×“×•×§ ××•×ª×• ×‘×”×’×“×¨×•×ª');
    if (res.status === 429) throw new Error('×—×¨×’×ª ×ž×ž×›×¡×ª ×”×©×™×ž×•×© ×”×—×™× ×ž×™×ª â€” × ×¡×” ×©×•×‘ ×‘×¢×•×“ ×¨×’×¢');
    throw new Error('×©×’×™××ª ×©×¨×ª AI (' + res.status + ') â€” × ×¡×” ×©×•×‘');
  }
  const data = await res.json();
  return parseLLMText(data.choices?.[0]?.message?.content ?? '', response_json_schema);
}

async function invokeOllama({ prompt, file_urls, response_json_schema }) {
  const images = (file_urls || []).map((u) => (u || '').split(',')[1]).filter(Boolean); // data URLs â†’ raw base64
  const body = {
    model: OLLAMA_MODEL,
    stream: false,
    messages: [{ role: 'user', content: prompt, ...(images.length ? { images } : {}) }],
    options: { temperature: 0.2 },
    ...(response_json_schema ? { format: response_json_schema } : {}),
  };
  let res;
  try {
    res = await fetch(OLLAMA_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('××™×Ÿ ×ž× ×•×¢ AI ×ž×•×’×“×¨ â€” ×”×–×Ÿ ×ž×¤×ª×— Groq ×—×™× ×ž×™ ×‘×”×’×“×¨×•×ª, ××• ×”×¤×¢×œ Ollama ×ž×§×•×ž×™');
  }
  if (!res.ok) throw new Error('×©×’×™××ª Ollama ' + res.status + ' â€” ×•×“× ×©×”×ž×•×“×œ ' + OLLAMA_MODEL + ' ×ž×•×ª×§×Ÿ (ollama pull ' + OLLAMA_MODEL + ')');
  const data = await res.json();
  return parseLLMText(data.message?.content ?? '', response_json_schema);
}

async function InvokeLLM(opts) {
  const cfg = aiConfig.get();
  if (cfg.apiKey) return invokeCloud(opts, cfg);
  if (SHARED_AI_URL) return invokeCloud(opts, { baseUrl: SHARED_AI_URL, apiKey: '', model: cfg.model });
  return invokeOllama(opts);
}

function UploadFile({ file }) { // no server: keep the image as a data URL
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ file_url: r.result });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export const db = {
  auth,
  entities: new Proxy({}, { get: (_, name) => entity(name) }),
  integrations: { Core: { InvokeLLM, UploadFile } },
};

globalThis.__B44_DB__ = db;
export default db;
