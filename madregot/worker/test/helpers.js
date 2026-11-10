// Test helpers: a D1-compatible database in memory (node:sqlite, same SQL as Cloudflare D1), the Worker's env, requests,
// a clock that can move, signed test-provider events, and a fetch stub that answers Claude and the email service so
// nothing leaves the machine and nothing is billed. Every address is synthetic (example.test).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hmacHex } from '../src/util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const schemaSql = () => readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');

const returnsRows = (sql) => /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);

/** A D1 look-alike. batch() runs inside BEGIN/COMMIT (ROLLBACK on error) like D1, and returns {results, meta} per statement. */
export function memoryD1(sql = schemaSql()) {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  const norm = (row) => (row === undefined ? null : row);
  const exec = (st) => {
    const prepared = db.prepare(st.sql);
    if (returnsRows(st.sql)) {
      const rows = prepared.all(...st.args);
      return { results: rows, meta: { changes: rows.length } };
    }
    const r = prepared.run(...st.args);
    return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  };
  const statement = (sql) => {
    const s = {
      sql, args: [],
      bind: (...a) => { s.args = a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)); return s; },
      first: async () => norm(db.prepare(sql).get(...s.args)),
      all: async () => ({ results: db.prepare(sql).all(...s.args) }),
      run: async () => exec(s),
    };
    return s;
  };
  const d1 = {
    prepare: statement,
    batch: async (list) => {
      // synchronous between BEGIN and COMMIT, so a batch is atomic even when requests run in parallel
      db.exec('BEGIN');
      try {
        const out = list.map(exec);
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    raw: db,
  };
  return d1;
}

export const SECRETS = {
  AUTH_SECRET: 'test-auth-secret-0123456789abcdef',
  IP_HASH_SECRET: 'test-ip-secret-0123456789abcdef',
  WEBHOOK_PATH_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef',
  TEST_WEBHOOK_SECRET: 'test-webhook-secret-0123456789',
};

export function makeEnv(over = {}) {
  return {
    DB: memoryD1(),
    ANTHROPIC_API_KEY: 'test-key',
    AI_PAYWALL: 'on',
    CLAUDE_MODEL: 'claude-sonnet-5-5',
    FREE_MODEL: 'claude-haiku-5-5',
    AI_DAILY_LIMIT: '40',
    TEACHER_DAILY_LIMIT: '200',
    SOLO_DAILY_LIMIT: '20',
    FREE_DAILY_LIMIT: '2',
    ALLOW_SOLO_AI: 'true',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    PUBLIC_URL: 'https://madregot.example.test',
    OWNER_EMAIL: 'owner@example.test',
    CONTACT_EMAIL: 'hello@example.test',
    BILLING_PROVIDER: 'test',
    BILLING_MODE: 'test',
    ALLOW_TEST_BILLING: 'true',
    PRICE_FAMILY_MONTH_AGOROT: '2990',
    PRICE_FAMILY_YEAR_AGOROT: '24900',
    PRICE_CLASS_SEAT_YEAR_AGOROT: '4900',
    VAT_MODE: 'included',
    TERMS_VERSION: '2026-11',
    RESEND_API_KEY: 'resend-test',
    EMAIL_FROM: 'מדרגות <no-reply@example.test>',
    ...SECRETS,
    ...over,
  };
}

/** A ctx whose waitUntil work can be awaited by the test (ctx.flush()). */
export function makeCtx() {
  const pending = [];
  return {
    waitUntil: (p) => { pending.push(Promise.resolve(p).catch((e) => console.error('waitUntil', e))); },
    flush: async () => { while (pending.length) await pending.shift(); },
  };
}
export const ctx = makeCtx();

export function request(method, pathname, { body, headers = {}, ip = '203.0.113.7', host = 'madregot.test' } = {}) {
  return new Request(`https://${host}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** A Claude message as the API returns it. */
export function claudeMessage(params, { text = 'הסבר קצר.', stop = 'end_turn', usage = { input_tokens: 10, output_tokens: 5 }, model } = {}) {
  return {
    id: 'msg_test', type: 'message', role: 'assistant', model: model || params.model,
    content: [{ type: 'text', text }], stop_reason: stop, stop_sequence: null, usage,
  };
}
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Replace global fetch: Claude answers with a short text (or what `claude` returns), the email service records the
 * message. Returns the log of calls and a restore function.
 */
export function stubFetch({ claude, resend, other } = {}) {
  const real = globalThis.fetch;
  const log = { claude: [], email: [], other: [] };
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const bodyText = init.body ?? (typeof input !== 'string' ? await input.text() : undefined);
    if (url.startsWith('https://api.resend.com/')) {
      const msg = JSON.parse(bodyText);
      log.email.push(msg);
      if (resend) return resend(msg);
      return jsonResponse({ id: `em_${log.email.length}` });
    }
    if (url.includes('api.anthropic.com')) {
      const params = JSON.parse(bodyText);
      log.claude.push(params);
      if (claude) {
        const r = await claude(params, log.claude.length);
        return r instanceof Response ? r : jsonResponse(r);
      }
      return jsonResponse(claudeMessage(params));
    }
    log.other.push({ url, body: bodyText });
    if (other) return other(url, bodyText, init);
    throw new Error(`unexpected fetch in test: ${url}`);
  };
  return { log, restore: () => { globalThis.fetch = real; } };
}
export const claudeError = (status = 500) => jsonResponse({ type: 'error', error: { type: 'api_error', message: 'boom' } }, status);

export const codeFromEmail = (msg) => (String(msg.text).match(/(\d{6})/) || [])[1];

/** A test-provider event signed as the test provider expects: { body, headers }. */
export async function signedTestEvent(env, event, { secret = env.TEST_WEBHOOK_SECRET, at = Math.floor(Date.now() / 1000) } = {}) {
  const raw = JSON.stringify(event);
  return { body: raw, headers: { 'X-Test-Signature': `t=${at},v1=${await hmacHex(secret, `${at}.${raw}`)}` } };
}

// ---------------------------------------------------------------- a clock that can move forward
const RealDate = globalThis.Date;
let offset = 0;
class ShiftedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
  static now() { return RealDate.now() + offset; }
}
/** Move "now" forward for the Worker's code (Date.now() and new Date()). */
export function advanceClock(ms) { offset += ms; globalThis.Date = ShiftedDate; }
export function resetClock() { offset = 0; globalThis.Date = RealDate; }

// ---------------------------------------------------------------- database fixtures
export const rows = (env, sql, ...args) => env.DB.raw.prepare(sql).all(...args);
export const one = (env, sql, ...args) => env.DB.raw.prepare(sql).get(...args);

// ---------------------------------------------------------------- a whole Worker under test
/** A streamed Claude reply (server-sent events) for client.messages.stream. */
export function sseResponse(message) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const text = message.content.map((b) => b.text || '').join('');
  const body = [
    ev('message_start', { message: { ...message, content: [], stop_reason: null, usage: { ...message.usage, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: message.usage.output_tokens } }),
    ev('message_stop', {}),
  ].join('');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** Claude's default answers: text for explain and chat, JSON for the structured kinds, streamed when asked. */
export function claudeReply(params, opts = {}) {
  const structured = params.output_config?.format;
  const text = opts.text ?? (structured ? JSON.stringify({ questions: [], readable: true, transcript: '', steps: [], final: 'unknown', summary: '', title: '', weakTopics: [], nextSteps: [] }) : 'הסבר קצר.');
  const message = claudeMessage(params, { ...opts, text });
  return params.stream ? sseResponse(message) : jsonResponse(message);
}
/** An upstream failure the SDK does not retry (so tests stay fast). */
export const claudeDown = (status = 500) => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }),
  { status, headers: { 'Content-Type': 'application/json', 'x-should-retry': 'false' } });

export async function setup(over = {}, fetchOpts = {}) {
  const { default: worker } = await import('../src/index.js');
  const env = makeEnv(over);
  const c = makeCtx();
  const net = stubFetch({ claude: (p) => claudeReply(p), ...fetchOpts });
  const call = (method, pathname, opts) => worker.fetch(request(method, pathname, opts), env, c);
  return { env, ctx: c, net, call, worker, done: () => { net.restore(); resetClock(); } };
}

export const INPUT = {
  explain: { question: '3 - 8', correct: '-5', studentAnswer: '5' },
  chat: { messages: [{ role: 'user', content: 'איך מתחילים?' }], context: { question: '3 - 8' } },
  generate: { topic: 'מספרים מכוונים', level: 'חיבור', count: 3 },
  check: { image: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' },
  exam: { pages: [{ data: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' }] },
};
export const DEVICE = 'a'.repeat(32);
export const ai = (h, kind, headers = {}, { ip, body } = {}) => h.call('POST', `/api/ai/${kind}`, { headers, ip, body: body ?? INPUT[kind] });

/** Sign in by email code; returns the session token. */
export async function signIn(h, email, headers = {}) {
  h.env.DB.raw.prepare('DELETE FROM login_codes').run();
  const sent = await h.call('POST', '/api/account/code', { body: { email } });
  if (sent.status !== 200) throw new Error(`code: ${sent.status} ${await sent.text()}`);
  const code = codeFromEmail(h.net.log.email.at(-1));
  const res = await h.call('POST', '/api/account/verify', { body: { email, code }, headers });
  if (res.status !== 200) throw new Error(`verify: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}
export const accountId = (env, email) => one(env, 'SELECT id FROM accounts WHERE email = ?', email)?.id;

/**
 * A class made through the API (createdAt can be moved back), with students joined by name. A new class is a school
 * class, and its students cannot reach the tutor until the Ministry's catalogue approval (trust spec TRUST-11).
 * `studentAi: true` makes it a private group whose teacher attested it and recorded the parents' consent, with student
 * AI on (written straight to class_settings: no audit row), for tests about limits and tiers. `setting: 'private'`
 * makes it a private group only. classai.test.js covers the rule itself.
 */
export async function makeClass(h, { students = [], createdAt, studentAi = false, setting = studentAi ? 'private' : 'school' } = {}) {
  const c = await (await h.call('POST', '/api/classes', { body: { className: 'ז׳3', teacherName: 'רונית', grade: '7' } })).json();
  if (createdAt) h.env.DB.raw.prepare('UPDATE classes SET created_at = ? WHERE code = ?').run(createdAt, c.code);
  if (setting === 'private') {
    const at = new Date().toISOString();
    h.env.DB.raw.prepare('INSERT INTO class_settings (code, setting, student_ai, ai_consent_at, private_attested_at) VALUES (?, ?, ?, ?, ?)')
      .run(c.code, 'private', studentAi ? 'on' : 'off', studentAi ? at : null, at);
  }
  const tokens = [];
  for (const name of students) {
    const s = await (await h.call('POST', `/api/classes/${c.code}/join`, { body: { name, pin: '1234' } })).json();
    tokens.push(s);
  }
  return { code: c.code, teacherKey: c.teacherKey, students: tokens, teacher: { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey } };
}
export const bearer = (s) => ({ Authorization: `Bearer ${s.token}` });

let seq = 0;
const hex16 = () => (Date.now().toString(16) + (seq++).toString(16).padStart(4, '0') + 'abcdef0123456789').slice(0, 16);
/** A subscription row written directly (for entitlement tests). */
export function insertSub(env, s = {}) {
  const now = Date.now();
  const row = {
    id: s.id || hex16(), kind: s.kind || 'family', account_id: s.account_id ?? null, class_code: s.class_code ?? null,
    plan: s.plan || (s.kind === 'class' ? 'term' : 'family_month'), status: s.status || 'active', provider: s.provider || 'manual',
    provider_subscription_id: s.provider_subscription_id ?? null, price_agorot: s.price_agorot ?? null, seats: s.seats ?? (s.kind === 'class' ? 30 : null),
    current_period_start: s.start || new Date(now - 864e5).toISOString(), current_period_end: s.end || new Date(now + 30 * 864e5).toISOString(),
    cancel_at_period_end: s.cancel_at_period_end ?? 0, cancel_requested_at: s.cancel_requested_at ?? null, cancel_synced_at: s.cancel_synced_at ?? null,
    first_paid_at: s.first_paid_at ?? null, refund_until: s.refund_until ?? null, last_event_at: s.last_event_at ?? null,
    created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
  };
  const cols = Object.keys(row);
  env.DB.raw.prepare(`INSERT INTO subscriptions (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map((c) => row[c]));
  return row;
}
/** A child's device linked to an account: returns its X-Family-Device header. */
export async function linkDevice(env, account, label = 'הטאבלט') {
  const token = `fd1.${hex16()}${hex16()}${hex16()}${hex16()}`;
  const id = hex16();
  const { sha256 } = await import('../src/util.js');
  env.DB.raw.prepare('INSERT INTO family_devices (id, account_id, token_hash, label, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, account, await sha256(token), label, new Date().toISOString(), '2026-01-01');
  return { id, headers: { 'X-Family-Device': token } };
}
/** A count already used today (or this month) for a counter. */
export async function setCount(env, who, count, period = 'day') {
  const { dayOf, monthOf } = await import('../src/util.js');
  env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, ?) ON CONFLICT (who, day) DO UPDATE SET count = excluded.count')
    .run(who, period === 'month' ? monthOf() : dayOf(), count);
}
export const countOf = (env, who) => env.DB.raw.prepare('SELECT COALESCE(SUM(count), 0) AS n FROM ai_usage WHERE who = ?').get(who).n;
/** Spend already recorded for a pool (USD). */
export async function setSpend(env, pool, usd, period = 'day') {
  const { dayOf, monthOf } = await import('../src/util.js');
  env.DB.raw.prepare('INSERT INTO ai_spend (pool, period, nano_usd) VALUES (?, ?, ?) ON CONFLICT (pool, period) DO UPDATE SET nano_usd = excluded.nano_usd')
    .run(pool, period === 'month' ? monthOf() : dayOf(), Math.round(usd * 1e9));
}
export async function netOf(env, ip = '203.0.113.7') {
  const { ipPrefix } = await import('../src/util.js');
  return (await hmacHex(env.IP_HASH_SECRET, `net:${ipPrefix(ip)}`)).slice(0, 16);
}
/** The counter key of an install id (X-Device), as devKey makes it: 16 hex, never the id itself. */
export async function devOf(env, id = DEVICE) {
  return (await hmacHex(env.IP_HASH_SECRET, `dev:${id}`)).slice(0, 16);
}

/**
 * The whole system prompt of a Claude request as one text, whether `system` is a string or a list of text blocks
 * (joined by blank lines, as the blocks are written). Tests that read the prompt use this, so they keep working when the
 * prompt moves from one string to blocks.
 */
export function systemText(params) {
  const sys = params?.system;
  if (typeof sys === 'string') return sys;
  if (Array.isArray(sys)) return sys.map((b) => (typeof b === 'string' ? b : String(b?.text ?? ''))).filter(Boolean).join('\n\n');
  return '';
}
