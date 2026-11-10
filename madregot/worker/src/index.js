// Madregot API: Claude proxy (the key never reaches browsers) + class data in D1 + the paid AI subscription.
import Anthropic from '@anthropic-ai/sdk';
import { AI_KINDS, STREAMED, TOPIC_IDS, buildRequest, readResult } from '../../shared/ai.js';
import { dayOf, nowIso, daysAgo, json, HttpError, body, sha256, randomToken, spend, refund, usedToday as usedOf, clientIp } from './util.js';
import { startLogin, verifyLogin, accountFrom, signOut, deleteAccount } from './account.js';
import { entitlement, aiStatus, checkout, webhook, cancel, adminGrant, adminEnd, adminList, activeFamilySub } from './billing.js';

// ---------- http helpers ----------
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Class-Code, X-Teacher-Key, X-Account-Token, X-Device',
    'Access-Control-Expose-Headers': 'X-AI-Tier, X-AI-Left',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

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
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function classCode() {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return [...r].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30);

// ---------- identity ----------
async function studentFrom(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT s.id, s.name, s.class_code, c.grade FROM students s JOIN classes c ON c.code = s.class_code WHERE s.token_hash = ?',
  ).bind(await sha256(token)).first();
  return row || null;
}
async function requireStudent(req, env) {
  const s = await studentFrom(req, env);
  if (!s) throw new HttpError(401, 'not_signed_in');
  return s;
}
async function requireTeacher(req, env) {
  const code = String(req.headers.get('X-Class-Code') || '').toUpperCase();
  const key = req.headers.get('X-Teacher-Key') || '';
  if (!code || !key) throw new HttpError(401, 'not_teacher');
  const cls = await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(code).first();
  if (!cls || cls.teacher_key_hash !== (await sha256(key))) throw new HttpError(401, 'not_teacher');
  return cls;
}
/** Everyone this request speaks for: a class student, a teacher, a signed-in parent account (any may be null). */
async function callerOf(req, env) {
  const [student, account] = await Promise.all([studentFrom(req, env), accountFrom(req, env)]);
  const teacher = req.headers.get('X-Teacher-Key') ? await requireTeacher(req, env) : null;
  return { student, teacher, account };
}

// Wrong personal-code attempts allowed per student per day; the teacher's reset clears the need.
const PIN_TRIES = 10;

// ---------- AI ----------
async function handleAI(kind, req, env, ctx, cors) {
  if (!AI_KINDS.includes(kind)) throw new HttpError(404, 'not_found');
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'ai_not_configured');
  const input = await body(req);
  const ent = await entitlement(req, env, await callerOf(req, env));
  if (ent.tier === 'free') {
    if (ent.anonymous && String(env.ALLOW_SOLO_AI) === 'false') throw new HttpError(403, 'solo_ai_off');
    if (!ent.kinds.includes(kind)) throw new HttpError(402, 'paid_only', undefined, { tier: 'free' });
  }
  let params;
  try { params = buildRequest(kind, input, { model: ent.model, lite: ent.tier === 'free' }); } catch (e) { throw new HttpError(400, 'bad_input', e.message); }
  if (!(await spend(env, ent.who, ent.limit))) throw new HttpError(429, 'daily_limit', undefined, { tier: ent.tier, limit: ent.limit });
  if (ent.ipKey && !(await spend(env, ent.ipKey, ent.ipLimit))) { await refund(env, ent.who); throw new HttpError(429, 'daily_limit', undefined, { tier: ent.tier, limit: ent.limit }); }
  const left = Math.max(0, ent.limit - (await usedOf(env, ent.who)));
  const tierHeaders = { 'X-AI-Tier': ent.tier, 'X-AI-Left': String(left) };
  // a call that fails before Claude did any work gives the question back
  const giveBack = async () => { await refund(env, ent.who); if (ent.ipKey) await refund(env, ent.ipKey); };
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });

  if (kind === 'chat' && input.stream) {
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const pump = (async () => {
      try {
        const stream = client.beta.messages.stream(params);
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') await writer.write(enc.encode(ev.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') await writer.write(enc.encode('\n[[refusal]]'));
      } catch (e) {
        console.error('chat stream', e?.status, e?.message);
        await giveBack();
        await writer.write(enc.encode(`\n[[error:${aiErrorCode(e)}]]`));
      } finally {
        await writer.close();
      }
    })();
    ctx.waitUntil(pump);
    return new Response(readable, { headers: { ...cors, ...tierHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  try {
    // Long outputs (a whole exam) stream so the request never times out; we wait for the final message.
    const message = STREAMED(kind) ? await client.beta.messages.stream(params).finalMessage() : await client.beta.messages.create(params);
    return json(readResult(kind, message), 200, cors, tierHeaders);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const code = aiErrorCode(e);
    if (code !== 'refusal') await giveBack();
    console.error('ai', kind, code, e?.status, e?.message);
    throw new HttpError(code === 'refusal' ? 422 : code === 'busy' ? 429 : 502, code);
  }
}
function aiErrorCode(e) {
  if (e?.code === 'refusal' || e?.code === 'bad_output') return e.code;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'server_key';
  if (e instanceof Anthropic.RateLimitError) return 'busy';
  if (e instanceof Anthropic.BadRequestError) return 'bad_request';
  if (e instanceof Anthropic.APIError && e.status >= 500) return 'upstream';
  return 'upstream';
}

// ---------- classes ----------
async function createClass(req, env, cors) {
  const b = await body(req);
  const name = cleanName(b.className); const teacherName = cleanName(b.teacherName);
  const grade = b.grade === '8' ? '8' : '7';
  if (!name || !teacherName) throw new HttpError(400, 'missing_fields');
  if (!(await spend(env, `create:${clientIp(req)}`, 10))) throw new HttpError(429, 'too_many_classes');
  const teacherKey = randomToken(12);
  for (let i = 0; i < 5; i++) {
    const code = classCode();
    try {
      await env.DB.prepare('INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(code, name, grade, teacherName, await sha256(teacherKey), nowIso()).run();
      return json({ code, teacherKey, className: name, grade, teacherName }, 200, cors);
    } catch (e) { if (!String(e?.message).includes('UNIQUE')) throw e; }
  }
  throw new HttpError(500, 'code_collision');
}

async function classInfo(code, env, cors) {
  const cls = await env.DB.prepare('SELECT name, grade, teacher_name FROM classes WHERE code = ?').bind(code.toUpperCase()).first();
  if (!cls) throw new HttpError(404, 'no_class');
  return json({ className: cls.name, grade: cls.grade, teacherName: cls.teacher_name }, 200, cors);
}

async function joinClass(code, req, env, cors) {
  const b = await body(req);
  const name = cleanName(b.name); const pin = String(b.pin || '');
  if (!name) throw new HttpError(400, 'missing_name');
  if (!/^\d{4}$/.test(pin)) throw new HttpError(400, 'bad_pin');
  // A whole school can share one address, so this cap is generous; PIN guessing is capped per student below.
  if (!(await spend(env, `join:${clientIp(req)}`, 300))) throw new HttpError(429, 'too_many_joins');
  const cls = await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(code.toUpperCase()).first();
  if (!cls) throw new HttpError(404, 'no_class');
  const token = randomToken();
  const existing = await env.DB.prepare('SELECT * FROM students WHERE class_code = ? AND name = ?').bind(cls.code, name).first();
  let id;
  if (existing) {
    // An empty pin_hash means the teacher reset it: the next join sets a new PIN.
    if (existing.pin_hash) {
      const tries = await env.DB.prepare('SELECT count FROM ai_usage WHERE who = ? AND day = ?').bind(`pin:${existing.id}`, dayOf()).first();
      if (tries && tries.count >= PIN_TRIES) throw new HttpError(429, 'too_many_pin');
      if (!(await verifyPin(pin, existing.pin_hash))) { await spend(env, `pin:${existing.id}`, PIN_TRIES); throw new HttpError(403, 'wrong_pin'); }
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
  const b = await body(req);
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

async function saveExam(req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req);
  const qs = (Array.isArray(b.questions) ? b.questions : []).slice(0, 40).map((q) => ({
    topic: TOPIC_IDS.includes(q.topic) ? q.topic : 'other', status: ['correct', 'partial', 'wrong', 'missing'].includes(q.status) ? q.status : 'missing', skill: String(q.skill || '').slice(0, 60),
    level: Number.isInteger(q.level) && q.level > 0 && q.level <= 12 ? q.level : 0,
  }));
  const weak = (Array.isArray(b.weakTopics) ? b.weakTopics : []).filter((t) => TOPIC_IDS.includes(t)).slice(0, 6);
  await env.DB.prepare('INSERT INTO exams (student_id, title, correct, total, questions, weak, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(s.id, String(b.title || 'מבחן').slice(0, 80), Number(b.correct) || 0, Number(b.total) || qs.length, JSON.stringify(qs), JSON.stringify(weak), nowIso()).run();
  return json({ ok: true }, 200, cors);
}

async function askHelp(req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req);
  const open = await env.DB.prepare('SELECT COUNT(*) AS n FROM help_requests WHERE student_id = ? AND done_at IS NULL').bind(s.id).first();
  if (open && open.n >= 10) throw new HttpError(429, 'too_many_open');
  // Optional notebook page: a JPEG data URL of the student's working, kept small.
  const image = typeof b.image === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.image) && b.image.length <= 600_000 ? b.image : null;
  // The same exercise asked again while its request is still open: one request, with the newest note and page.
  const question = String(b.question || '').slice(0, 600);
  const same = await env.DB.prepare('SELECT id FROM help_requests WHERE student_id = ? AND done_at IS NULL AND question = ? LIMIT 1').bind(s.id, question).first();
  if (same) {
    const note = String(b.note || '').slice(0, 300);
    await env.DB.prepare('UPDATE help_requests SET note = CASE WHEN ? <> \'\' THEN ? ELSE note END, image = COALESCE(?, image), answer = ? WHERE id = ?')
      .bind(note, note, image, String(b.answer || '').slice(0, 100), same.id).run();
    return json({ ok: true, again: true }, 200, cors);
  }
  await env.DB.prepare('INSERT INTO help_requests (student_id, topic, level, question, answer, note, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(s.id, String(b.topic || '').slice(0, 20), Number(b.level) || null, String(b.question || '').slice(0, 600),
      String(b.answer || '').slice(0, 100), String(b.note || '').slice(0, 300), image, nowIso()).run();
  return json({ ok: true }, 200, cors);
}

// ---------- teacher ----------
async function dashboard(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const today = dayOf(); const weekStart = daysAgo(6);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results || []);
  const [students, todayRows, weekRows, levelRows, catRows, catStudents, help, lastRows, examRows] = await Promise.all([
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
    q(`SELECT h.id, h.topic, h.level, h.question, h.answer, h.note, h.image IS NOT NULL AS has_image, h.created_at, h.seen_at, h.done_at, s.name
       FROM help_requests h JOIN students s ON s.id = h.student_id
       WHERE s.class_code = ? AND (h.done_at IS NULL OR h.done_at >= ?) ORDER BY h.created_at DESC LIMIT 100`, cls.code, daysAgo(7)),
    q('SELECT a.student_id, MAX(a.at) AS last FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? GROUP BY a.student_id', cls.code),
    q('SELECT e.id, e.student_id, e.title, e.correct, e.total, e.questions, e.weak, e.created_at, s.name FROM exams e JOIN students s ON s.id = e.student_id WHERE s.class_code = ? ORDER BY e.created_at DESC LIMIT 200', cls.code),
  ]);
  const by = (rows) => Object.fromEntries(rows.map((r) => [r.student_id, r]));
  const t = by(todayRows); const w = by(weekRows); const lastPractice = by(lastRows);
  const lv = {};
  for (const r of levelRows) (lv[r.student_id] ||= {})[r.topic] = { level: r.level, max: r.max_level };
  return json({
    class: { code: cls.code, name: cls.name, grade: cls.grade, teacherName: cls.teacher_name },
    today,
    students: students.map((s) => ({
      id: s.id, name: s.name, lastSeen: s.last_seen, lastPractice: lastPractice[s.id]?.last || null, pinReset: !!s.pin_reset,
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
  const b = await body(req);
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
  // A reset also clears today's wrong-code count, so the student can choose a new code right away.
  if (r.meta?.changes) await env.DB.prepare('DELETE FROM ai_usage WHERE who = ?').bind(`pin:${id}`).run();
  return json({ ok: true }, 200, cors);
}

// ---------- router ----------
export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '');
    let m;
    try {
      if (req.method === 'GET' && p === '/api/health') {
        return json({ ok: true, ai: !!env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || null, soloAI: String(env.ALLOW_SOLO_AI) !== 'false', billing: env.BILLING_PROVIDER || 'manual' }, 200, cors);
      }
      if (req.method === 'GET' && p === '/api/ai/status') return await aiStatus(req, env, cors, await callerOf(req, env));
      if (req.method === 'POST' && p === '/api/account/code') return await startLogin(req, env, cors);
      if (req.method === 'POST' && p === '/api/account/verify') return await verifyLogin(req, env, cors);
      if (req.method === 'POST' && p === '/api/account/signout') return await signOut(req, env, cors);
      if (req.method === 'POST' && p === '/api/account/delete') return await deleteAccount(req, env, cors, { activeFamilySub });
      if (req.method === 'POST' && p === '/api/billing/checkout') return await checkout(req, env, cors);
      if (req.method === 'POST' && p === '/api/billing/cancel') return await cancel(req, env, cors);
      if (req.method === 'POST' && (m = p.match(/^\/api\/billing\/webhook\/([a-z]+)$/))) return await webhook(m[1], req, env, cors);
      if (req.method === 'GET' && p === '/api/admin/subscriptions') return await adminList(req, env, cors);
      if (req.method === 'POST' && p === '/api/admin/grant') return await adminGrant(req, env, cors);
      if (req.method === 'POST' && p === '/api/admin/end') return await adminEnd(req, env, cors);
      if (req.method === 'POST' && (m = p.match(/^\/api\/ai\/(\w+)$/))) return await handleAI(m[1], req, env, ctx, cors);
      if (req.method === 'POST' && p === '/api/classes') return await createClass(req, env, cors);
      if (req.method === 'GET' && (m = p.match(/^\/api\/classes\/([A-Za-z0-9]{6})$/))) return await classInfo(m[1], env, cors);
      if (req.method === 'POST' && (m = p.match(/^\/api\/classes\/([A-Za-z0-9]{6})\/join$/))) return await joinClass(m[1], req, env, cors);
      if (req.method === 'POST' && p === '/api/progress') return await saveProgress(req, env, cors);
      if (req.method === 'POST' && p === '/api/help') return await askHelp(req, env, cors);
      if (req.method === 'POST' && p === '/api/exams') return await saveExam(req, env, cors);
      if (req.method === 'GET' && p === '/api/teacher/dashboard') return await dashboard(req, env, cors);
      if (req.method === 'POST' && (m = p.match(/^\/api\/teacher\/help\/(\d+)$/))) return await updateHelp(m[1], req, env, cors);
      if (req.method === 'GET' && (m = p.match(/^\/api\/teacher\/help\/(\d+)\/image$/))) return await helpImage(m[1], req, env, cors);
      if (req.method === 'POST' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]+)\/reset-pin$/))) return await resetPin(m[1], req, env, cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message, ...(e.extra || {}) }, e.status, cors);
      console.error('unhandled', e?.stack || e);
      return json({ error: 'server_error' }, 500, cors);
    }
  },
};
