// Test helpers: a D1-compatible database in memory (node:sqlite, same SQL as Cloudflare D1), the Worker's env, requests,
// and a fetch stub that answers Claude and the email service so nothing leaves the machine and nothing is billed.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export function memoryD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(path.join(here, '..', 'schema.sql'), 'utf8'));
  const norm = (row) => (row === undefined ? null : row);
  const statement = (sql) => {
    let args = [];
    const s = {
      bind: (...a) => { args = a.map((v) => (v === undefined ? null : v)); return s; },
      first: async () => norm(db.prepare(sql).get(...args)),
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    };
    return s;
  };
  return { prepare: statement, batch: async (list) => { const out = []; for (const st of list) out.push(await st.run()); return out; }, raw: db };
}

export function makeEnv(over = {}) {
  return {
    DB: memoryD1(),
    ANTHROPIC_API_KEY: 'test-key',
    CLAUDE_MODEL: 'claude-opus-5-5',
    FREE_MODEL: 'claude-haiku-5-5',
    AI_DAILY_LIMIT: '40',
    TEACHER_DAILY_LIMIT: '200',
    FREE_DAILY_LIMIT: '2',
    FREE_IP_DAILY: '80',
    ALLOW_SOLO_AI: 'true',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    BILLING_PROVIDER: 'manual',
    RESEND_API_KEY: 'resend-test',
    EMAIL_FROM: 'מדרגות <no-reply@example.test>',
    ADMIN_KEY: 'admin-key-for-tests-0123456789',
    ...over,
  };
}

export const ctx = { waitUntil: (p) => p };

export function request(method, pathname, { body, headers = {}, ip = '203.0.113.7' } = {}) {
  return new Request(`https://madregot.test${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/**
 * Replace global fetch: Claude answers with a short text (or what `claude` returns), the email service records the
 * message. Returns the log of calls and a restore function.
 */
export function stubFetch({ claude, resend, other } = {}) {
  const real = globalThis.fetch;
  const log = { claude: [], email: [] };
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const bodyText = init.body ?? (typeof input !== 'string' ? await input.text() : undefined);
    if (url.startsWith('https://api.resend.com/')) {
      const msg = JSON.parse(bodyText);
      log.email.push(msg);
      if (resend) return resend(msg);
      return new Response(JSON.stringify({ id: `em_${log.email.length}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('api.anthropic.com')) {
      const params = JSON.parse(bodyText);
      log.claude.push(params);
      if (claude) return claude(params);
      return new Response(JSON.stringify({
        id: 'msg_test', type: 'message', role: 'assistant', model: params.model,
        content: [{ type: 'text', text: 'הסבר קצר.' }], stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (other) return other(url, bodyText, init);
    throw new Error(`unexpected fetch in test: ${url}`);
  };
  return { log, restore: () => { globalThis.fetch = real; } };
}

export const codeFromEmail = (msg) => (String(msg.text).match(/(\d{6})/) || [])[1];
