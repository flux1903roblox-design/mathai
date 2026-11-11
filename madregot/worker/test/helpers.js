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
    // The parent's OK before a child alone uses the tutor (trust spec TRUST-9) is "required" in wrangler.toml and in
    // the code when the var is unset. Tests about tiers, limits, moderation and care of a device alone run with its
    // rollback value; parentok.test.js and care.test.js test "required" (and the unset default) themselves.
    AI_PARENT_OK: 'off',
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
    // the legal gate (trust spec TRUST-2 §5): every detail set and the current terms approved, so checkout is open;
    // legal.test.js closes it var by var. Synthetic details only.
    BUSINESS_NAME: 'מדרגות בדיקה',
    BUSINESS_ID: '000000000',
    BUSINESS_KIND: 'עוסק מורשה',
    BUSINESS_ADDRESS: 'רחוב הבדיקה 1, תל אביב',
    CONTACT_PHONE: '03-0000000',
    PAYMENT_PROVIDER_NAME: 'ספק בדיקה',
    LEGAL_DATE: '2026-11-01',
    DB_JURISDICTION: 'eu',
    LEGAL_APPROVED: '2026-11',
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

/** The seeds of a rewrite request, read back from its user turn ("{i}. {text} → {answer}", " [drawing]" after a drawn one). */
export function seedsSent(params) {
  const turn = String(params?.messages?.[0]?.content ?? '');
  const block = turn.split('Seeds:\n')[1]?.split('\n\n')[0] ?? '';
  return block.split('\n').map((line) => line.match(/^(\d+)\. (.*) → (.*?)( \[drawing\])?$/)).filter(Boolean)
    .map((m) => ({ i: Number(m[1]), text: m[2], answer: m[3], fig: !!m[4] }));
}
/** A rewrite that keeps every seed's wording (kept), with a solution that ends at the seed's answer: it passes every check. */
export const keptRewrite = (params) => ({
  items: seedsSent(params).map((sd) => ({ seed: sd.i, prompt: sd.text, hint: 'מתחילים מהמספר הראשון.', solution: ['מחשבים לפי הסדר.', `התוצאה: $= ${sd.answer}$`], kept: true })),
});
const schemaOf = (params) => params.output_config?.format?.schema?.properties || {};

/** Claude's default answers: text for explain and chat, JSON for the structured kinds, streamed when asked. */
export function claudeReply(params, opts = {}) {
  const structured = params.output_config?.format;
  const shape = schemaOf(params);
  const json = shape.items ? keptRewrite(params) : shape.answers ? { answers: [] } : shape.points ? FEEDBACK_REPLY
    : { questions: [], readable: true, transcript: '', steps: [], final: 'unknown', summary: '', title: '', weakTopics: [], nextSteps: [] };
  const text = opts.text ?? (structured ? JSON.stringify(json) : 'הסבר קצר.');
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

/** Seeds as the app sends them for new exercises (ai spec AI-4): its own exercises and the answers it computed. */
export const GEN_SEEDS = Object.freeze([{ i: 0, text: 'חשבו: 3 - (-5)', answer: '8', round: false, fig: false }, { i: 1, text: 'בתל אביב 20 מעלות, ובפסגת החרמון -8 מעלות. בכמה מעלות חם יותר בתל אביב?', answer: '28', round: false, fig: false }, { i: 2, text: 'חשבו: -8 - (-7)', answer: '-1', round: false, fig: false }, { i: 3, text: 'מעלית יצאה מקומה -2 (בחניון) ועלתה 7 קומות. באיזו קומה היא עכשיו?', answer: '5', round: false, fig: false }, { i: 4, text: 'חשבו: -12 + (-1)', answer: '-13', round: false, fig: false }]);
/**
 * A finished challenge (ai spec AI-10): the app's context for it, and a feedback request on a written explanation.
 * Synthetic: the task, rubric and model answer are written for the tests; the "student" text is invented.
 */
export const FEEDBACK_CTX = Object.freeze({
  v: 2, surface: 'challenge', grade: '7', skill: 'expr:4', topicId: 'expr', topic: 'ביטויים אלגבריים', stair: 'חוק הפילוג',
  item: { text: 'הסבירו למה $3(x + 4) = 3x + 12$.', answerFrom: 'app' },
  policy: { answer: 'reveal', why: 'A finished challenge: the model answer and the rubric are on the screen.' },
});
export const FEEDBACK_INPUT = Object.freeze({
  ctx: FEEDBACK_CTX,
  rubric: ['הסברתי בעזרת שטח של מלבן', 'אמרתי למה כל איבר בסוגריים נכפל ב־$3$'],
  sample: 'מלבן ברוחב $3$ ובאורך $x + 4$ מתחלק לשני מלבנים: אחד בשטח $3x$ ואחד בשטח $3 \\cdot 4 = 12$. השטח של כל המלבן הוא סכום השטחים של שני החלקים, ולכן $3(x + 4) = 3x + 12$.',
  text: 'ציירתי מלבן שהרוחב שלו 3 והאורך שלו x ועוד 4. חילקתי אותו לשני חלקים, ויצא 3x ועוד 12.',
});

/** Claude's feedback on FEEDBACK_INPUT (ai spec AI-10): point 0 covered in the student's words, point 1 partly, with a tip. */
export const FEEDBACK_REPLY = Object.freeze({
  points: [
    { i: 0, status: 'yes', quote: 'ציירתי מלבן שהרוחב שלו 3 והאורך שלו x ועוד 4', tip: '' },
    { i: 1, status: 'partly', quote: 'ויצא 3x ועוד 12', tip: 'כתבו מה קורה לכל אחד מהחלקים בסוגריים, ולמה.' },
  ],
  summary: 'המלבן מסביר את הרעיון יפה. חסר משפט שאומר למה גם ה־4 נכפל ב־3.',
  care: false,
});

export const INPUT = {
  explain: { question: '3 - 8', correct: '-5', studentAnswer: '5' },
  chat: { messages: [{ role: 'user', content: 'איך מתחילים?' }], context: { question: '3 - 8' } },
  generate: { grade: '7', skill: 'signed:1', topic: 'מספרים מכוונים', stair: 'חיבור וחיסור', count: 3, seeds: GEN_SEEDS },
  check: { image: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' },
  exam: { pages: [{ data: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' }] },
  feedback: FEEDBACK_INPUT,
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
 * makes it a private group only. `ai: true` (the teacher lane's) does what `studentAi: true` does through the API: the
 * private setting with its attestation when the class is made, then POST /api/teacher/class/ai with the consent and
 * the switch on, so its audit rows are there too. classai.test.js covers the rule itself.
 */
export async function makeClass(h, { students = [], createdAt, studentAi = false, setting = studentAi ? 'private' : 'school', ai = false } = {}) {
  const extra = ai ? { setting: 'private', privateAttest: true } : {};
  const c = await (await h.call('POST', '/api/classes', { body: { className: 'ז׳3', teacherName: 'רונית', grade: '7', ...extra } })).json();
  if (createdAt) h.env.DB.raw.prepare('UPDATE classes SET created_at = ? WHERE code = ?').run(createdAt, c.code);
  if (ai) {
    const on = await h.call('POST', '/api/teacher/class/ai', { headers: { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey }, body: { consent: true, studentAi: 'on' } });
    if (on.status !== 200) throw new Error(`class ai: ${on.status} ${await on.text()}`);
  } else if (setting === 'private') {
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
