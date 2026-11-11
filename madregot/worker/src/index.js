// Madregot API: Claude proxy (the key never reaches browsers), class data in D1, and the paid AI tutor
// (entitlement, sign-in by email code, family devices, class licences, checkout and payments, cancellation).
// The owner works through scripts/owner.mjs; there is no HTTP admin.
import Anthropic from '@anthropic-ai/sdk';
import { AI_KINDS, STREAMED, TOPIC_IDS, LITE_MODEL, readResult } from '../../shared/ai.js';
import {
  dayOf, nowIso, daysAgo, json, HttpError, body, sha256, randomToken, randomFrom, CODE_ALPHABET, netKey, take, key, giveBack,
  limitOrThrow, hmacHex, cleanName,
} from './util.js';
import { startLogin, verifyLogin, signOut, requireAccount } from './account.js';
import { resolve, aiStatus, requireStudent, requireTeacher, paywallOn } from './entitle.js';
import { recordSpend } from './spend.js';
import { emailReady } from './email.js';
import {
  plansView, checkout, orderStatus, webhook, cancel, resume, portal, invoice, testPayPage, testPaySubmit, accountOverview, accountExport, deleteAccount,
  onlineCheckout,
} from './billing.js';
import { currentProvider } from './providers/index.js';
import { linkStart, linkFinish, linkClaim, linkThisDevice, unlinkDevice, leaveFamily } from './family.js';
import {
  licenceStatus, licenceRequest, licenceClaim, lockClass, removeStudent, joinLocked, renameClass, deleteClass, classSeenStmt,
} from './licence.js';
import { myClasses, bindClass, rekeyClass, ownedClassStmts, checkOwnedCap, bindingView } from './teacherAccount.js';
import {
  listAssignments, createAssignment, getAssignment, updateAssignment, deleteAssignment, classWork, workExam, postWork, classAssignments,
} from './assignments.js';
import { classReport, studentDetail } from './report.js';
import { setClassAi, setStudentAi, classAiView, aiOffIds, newClassSetting, newClassSettingStmts } from './classai.js';
import { teacherReply, studentReply, readHelp, setDigest, helpThreads, markReadStmt } from './help.js';
import { RETENTION } from '../../shared/retention.js';
import { run as runCron } from './cron.js';

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

// Wrong personal-code attempts allowed per student per day; the teacher's reset clears the need.
const PIN_TRIES = 10;

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

async function handleAI(kind, req, env, ctx, cors) {
  if (!AI_KINDS.includes(kind)) throw new HttpError(404, 'not_found');
  if (!env.ANTHROPIC_API_KEY) throw new HttpError(503, 'ai_not_configured');
  const input = await body(req, AI_BODY_MAX[kind]);
  const r = await resolve(req, env, kind, input);
  const headers = aiHeaders(r);
  let returned = false;
  // a call where Claude did no work gives the person's question back (never the shared or tries counters)
  const giveBackOnce = async () => { if (!returned) { returned = true; await giveBack(env, r.refund); } };
  const record = (message) => recordSpend(env, { pool: r.pool, kind, message }).catch((e) => console.error('spend', e?.message));
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });

  if (kind === 'chat' && input.stream) {
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    let aborted = false;
    const write = (text) => writer.write(enc.encode(text)).catch(() => { aborted = true; });
    const pump = (async () => {
      let stream;
      let recorded = false;
      const usage = usageTracker();
      try {
        stream = client.beta.messages.stream(r.params);
        for await (const ev of stream) {
          usage.event(ev);
          if (aborted) { stream.abort(); break; }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') await write(ev.delta.text);
        }
        if (!aborted) {
          const final = await stream.finalMessage();
          recorded = true;
          await record(final);
          if (final.stop_reason === 'refusal') { await giveBackOnce(); await write('\n[[refusal]]'); }
        }
      } catch (e) {
        if (!aborted) {
          console.error('chat stream', e?.status, e?.message);
          await giveBackOnce();
          await write(`\n[[error:${aiErrorCode(e)}]]`);
        }
      } finally {
        // the reader left, or the stream broke: what Claude already did is still priced
        const partial = recorded ? null : usage.message();
        if (partial) await record(partial);
        try { await writer.close(); } catch { /* the client went away */ }
      }
    })();
    ctx.waitUntil(pump);
    return new Response(readable, { headers: { ...cors, ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

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
    await giveBackOnce();
    console.error('ai', kind, code, e?.status, e?.message);
    throw new HttpError(code === 'busy' ? 429 : 502, code, undefined, undefined, headers);
  }
  ctx.waitUntil(record(message));
  try {
    return json(readResult(kind, message), 200, cors, headers);
  } catch (e) {
    const code = e?.code === 'refusal' || e?.code === 'bad_output' ? e.code : 'bad_output';
    await giveBackOnce();
    throw new HttpError(code === 'refusal' ? 422 : 502, code, undefined, undefined, headers);
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
/**
 * POST /api/classes {className, teacherName, grade, setting?, privateAttest?}: a new class and its teacher key (shown
 * once). With a session (X-Account-Token) the class is bound to that account in the same batch and the answer says
 * owned: true; a session that is sent but not valid is 401 not_account, never a class left unbound by mistake.
 * setting (TRUST-11): missing is 'school' (student AI off by the Ministry's rules); 'private' needs privateAttest: true
 * (400 private_attest_required), and stores the attestation with an audit row.
 */
async function createClass(req, env, cors) {
  const b = await body(req, LIMIT.small);
  const name = cleanName(b.className); const teacherName = cleanName(b.teacherName);
  const grade = b.grade === '8' ? '8' : '7';
  if (!name || !teacherName) throw new HttpError(400, 'missing_fields');
  const setting = newClassSetting(b);
  const account = String(req.headers.get('X-Account-Token') || '').trim() ? await requireAccount(req, env) : null;
  if (account) await checkOwnedCap(env, account.id);
  await limitOrThrow(env, `create:n:${await netKey(req, env)}`, 10, 429, 'too_many_classes');
  const teacherKey = randomToken(12);
  const keyHash = await sha256(teacherKey);
  for (let i = 0; i < 5; i++) {
    const code = classCode();
    const now = nowIso();
    try {
      if (account) {
        const res = await env.DB.batch([
          ...ownedClassStmts(env, { code, name, grade, teacherName, keyHash, now }, account.id),
          ...newClassSettingStmts(env, code, setting, { now, via: 'account' }),
        ]);
        if (Number(res[0].meta?.changes) !== 1) throw new HttpError(409, 'too_many_classes_owned');
      } else {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(code, name, grade, teacherName, keyHash, now),
          ...newClassSettingStmts(env, code, setting, { now }),
        ]);
      }
      return json({ code, teacherKey, className: name, grade, teacherName, setting, ...(account ? { owned: true } : {}) }, 200, cors);
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
  await limitOrThrow(env, `join:n:${await netKey(req, env)}`, 300, 429, 'too_many_joins');
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
      const tries = await env.DB.prepare('SELECT count FROM ai_usage WHERE who = ? AND day = ?').bind(`pin:${existing.id}`, dayOf()).first();
      if (tries && tries.count >= PIN_TRIES) throw new HttpError(429, 'too_many_pin');
      if (!(await verifyPin(pin, existing.pin_hash))) { await take(env, [key(`pin:${existing.id}`, PIN_TRIES)]); throw new HttpError(403, 'wrong_pin'); }
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
/**
 * POST /api/progress {events, levels}: the student's answers and stairs. An answer older than the attempts' retention
 * (400 days) is skipped, so an old outbox cannot bring back what the night purge removed.
 */
async function saveProgress(req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, LIMIT.progress);
  const events = (Array.isArray(b.events) ? b.events : []).slice(0, 300);
  const now = Date.now();
  const oldest = now - RETENTION.attempts * 864e5;
  const stmts = [];
  let saved = 0;
  for (const e of events) {
    const at = Math.min(Number(new Date(e.at)) || now, now);
    if (at < oldest) continue;
    saved++;
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
  stmts.push(classSeenStmt(env, s.class_code));
  await env.DB.batch(stmts);
  return json({ saved }, 200, cors);
}

async function saveExam(req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, LIMIT.exams);
  const qs = (Array.isArray(b.questions) ? b.questions : []).slice(0, 40).map((q) => ({
    topic: TOPIC_IDS.includes(q.topic) ? q.topic : 'other', status: ['correct', 'partial', 'wrong', 'missing'].includes(q.status) ? q.status : 'missing', skill: String(q.skill || '').slice(0, 60),
    level: Number.isInteger(q.level) && q.level > 0 && q.level <= 12 ? q.level : 0,
  }));
  const weak = (Array.isArray(b.weakTopics) ? b.weakTopics : []).filter((t) => TOPIC_IDS.includes(t)).slice(0, 6);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO exams (student_id, title, correct, total, questions, weak, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, String(b.title || 'מבחן').slice(0, 80), Number(b.correct) || 0, Number(b.total) || qs.length, JSON.stringify(qs), JSON.stringify(weak), nowIso()),
    classSeenStmt(env, s.class_code),
  ]);
  return json({ ok: true }, 200, cors);
}

async function askHelp(req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, LIMIT.help);
  const open = await env.DB.prepare('SELECT COUNT(*) AS n FROM help_requests WHERE student_id = ? AND done_at IS NULL').bind(s.id).first();
  if (open && open.n >= 10) throw new HttpError(429, 'too_many_open');
  // Optional notebook page: a JPEG data URL of the student's working, kept small.
  const image = typeof b.image === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.image) && b.image.length <= 600_000 ? b.image : null;
  // The same exercise asked again while its request is still open: one request, with the newest note and page.
  const question = String(b.question || '').slice(0, 600);
  const same = await env.DB.prepare('SELECT id FROM help_requests WHERE student_id = ? AND done_at IS NULL AND question = ? LIMIT 1').bind(s.id, question).first();
  if (same) {
    const note = String(b.note || '').slice(0, 300);
    await env.DB.batch([
      env.DB.prepare('UPDATE help_requests SET note = CASE WHEN ? <> \'\' THEN ? ELSE note END, image = COALESCE(?, image), answer = ? WHERE id = ?')
        .bind(note, note, image, String(b.answer || '').slice(0, 100), same.id),
      classSeenStmt(env, s.class_code),
    ]);
    return json({ ok: true, again: true }, 200, cors);
  }
  await env.DB.batch([
    env.DB.prepare('INSERT INTO help_requests (student_id, topic, level, question, answer, note, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, String(b.topic || '').slice(0, 20), Number(b.level) || null, String(b.question || '').slice(0, 600),
        String(b.answer || '').slice(0, 100), String(b.note || '').slice(0, 300), image, nowIso()),
    classSeenStmt(env, s.class_code),
  ]);
  return json({ ok: true }, 200, cors);
}

// ---------- teacher ----------
async function dashboard(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const today = dayOf(); const weekStart = daysAgo(6);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args).all().then((r) => r.results || []);
  const [students, todayRows, weekRows, levelRows, catRows, catStudents, help, lastRows, examRows, locked, , assignments, classExams, threads, owner, lateRows, aiPolicy, aiOff, binding] = await Promise.all([
    q('SELECT id, name, last_seen, created_at, pin_hash = \'\' AS pin_reset FROM students WHERE class_code = ? ORDER BY name', cls.code),
    q(`SELECT a.student_id, COUNT(*) AS n, SUM(a.ok) AS ok, SUM(a.first_try) AS first, SUM(a.secs) AS secs
       FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? AND a.day = ? GROUP BY a.student_id`, cls.code, today),
    q(`SELECT a.student_id, COUNT(*) AS n, SUM(a.first_try) AS first, COUNT(DISTINCT a.day) AS days, SUM(a.secs) AS secs
       FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? AND a.day >= ? GROUP BY a.student_id`, cls.code, weekStart),
    q('SELECT l.student_id, l.topic, l.level, l.max_level FROM levels l JOIN students s ON s.id = l.student_id WHERE s.class_code = ?', cls.code),
    // each repeated mistake on its stair (TEACHER-16): one id means different things on different stairs ('sign' is a
    // negative length on coord:3), so the row is the stair's, with the words the student saw there, and "מחר" gives
    // practice on that stair to the students who made it there (TEACHER-4 §5)
    q(`SELECT a.topic, a.level, a.cat, COUNT(*) AS n, COUNT(DISTINCT a.student_id) AS students
       FROM attempts a JOIN students s ON s.id = a.student_id
       WHERE s.class_code = ? AND a.day >= ? AND a.cat IS NOT NULL GROUP BY a.topic, a.level, a.cat
       ORDER BY students DESC, n DESC, a.topic, a.level, a.cat LIMIT 12`, cls.code, weekStart),
    q(`SELECT DISTINCT a.topic, a.level, a.cat, s.id, s.name FROM attempts a JOIN students s ON s.id = a.student_id
       WHERE s.class_code = ? AND a.day >= ? AND a.cat IS NOT NULL ORDER BY s.name, s.id`, cls.code, weekStart),
    q(`SELECT h.id, h.topic, h.level, h.question, h.answer, h.note, h.image IS NOT NULL AS has_image, h.created_at, h.seen_at, h.done_at, s.name, s.id AS studentId
       FROM help_requests h JOIN students s ON s.id = h.student_id
       WHERE s.class_code = ? AND (h.done_at IS NULL OR h.done_at >= ?) ORDER BY h.created_at DESC LIMIT 100`, cls.code, daysAgo(7)),
    q('SELECT a.student_id, MAX(a.at) AS last FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_code = ? GROUP BY a.student_id', cls.code),
    q('SELECT e.id, e.student_id, e.title, e.correct, e.total, e.questions, e.weak, e.created_at, s.name FROM exams e JOIN students s ON s.id = e.student_id WHERE s.class_code = ? ORDER BY e.created_at DESC LIMIT 200', cls.code),
    joinLocked(env, cls.code),
    classSeenStmt(env, cls.code).run(),
    // the open assignments with their counts (due in the last 7 days or later, soonest first), and the class exams done
    // in the app, shown with the other exams (TEACHER-4 §5)
    classAssignments(env, cls.code, { open: 7, limit: 10 }),
    q(`SELECT w.assignment_id, w.student_id, s.name, a.title, w.right_n, w.asked, w.questions, w.done_at
       FROM assignment_work w JOIN assignments a ON a.id = w.assignment_id JOIN students s ON s.id = w.student_id
       WHERE a.class_code = ? AND a.kind = 'exam' AND w.state = 'done' AND s.class_code = a.class_code
       ORDER BY w.done_at DESC LIMIT 200`, cls.code),
    // the replies on the help requests above (TEACHER-6): one query for all of them
    helpThreads(env, `SELECT h.id FROM help_requests h JOIN students s ON s.id = h.student_id
      WHERE s.class_code = ?1 AND (h.done_at IS NULL OR h.done_at >= ?2)`, [cls.code, daysAgo(7)]),
    // the daily help email: only the owner, signed in, sees (and changes) it
    cls.via === 'account' ? env.DB.prepare('SELECT help_digest FROM class_owners WHERE class_code = ? AND account_id = ?').bind(cls.code, cls.accountId).first() : null,
    // each student's work that is behind (TEACHER-8, the attention list): given to them, due before today and at most 30
    // days ago (the work a student still sees), and not finished
    q(`SELECT s.id AS student_id, COUNT(*) AS late FROM assignments a JOIN students s ON s.class_code = a.class_code
       LEFT JOIN assignment_work w ON w.assignment_id = a.id AND w.student_id = s.id
       WHERE a.class_code = ?1 AND a.due_on < ?2 AND a.due_on >= ?3 AND (w.state IS NULL OR w.state != 'done')
         AND (a.for_all = 1 OR EXISTS (SELECT 1 FROM assignment_targets t WHERE t.assignment_id = a.id AND t.student_id = s.id))
       GROUP BY s.id`, cls.code, today, daysAgo(30)),
    // student AI by the Ministry's rules (TRUST-11): the class's policy and the students the teacher turned it off for
    classAiView(env, cls),
    aiOffIds(env, cls.code),
    // a class bound to an email after it was opened, told to the devices that come with the key (teacherAccount.js)
    bindingView(env, cls),
  ]);
  const by = (rows) => Object.fromEntries(rows.map((r) => [r.student_id, r]));
  const t = by(todayRows); const w = by(weekRows); const lastPractice = by(lastRows); const late = by(lateRows);
  const lv = {};
  for (const r of levelRows) (lv[r.student_id] ||= {})[r.topic] = { level: r.level, max: r.max_level };
  return json({
    class: { code: cls.code, name: cls.name, grade: cls.grade, teacherName: cls.teacher_name },
    today,
    joinLocked: locked,
    students: students.map((s) => ({
      id: s.id, name: s.name, lastSeen: s.last_seen, lastPractice: lastPractice[s.id]?.last || null, pinReset: !!s.pin_reset,
      joinedOn: s.created_at ? dayOf(new Date(s.created_at)) : null, late: Number(late[s.id]?.late || 0), aiOff: aiOff.has(s.id),
      today: t[s.id] ? { n: t[s.id].n, ok: t[s.id].ok, first: t[s.id].first, minutes: Math.round((t[s.id].secs || 0) / 60) } : { n: 0, ok: 0, first: 0, minutes: 0 },
      week: w[s.id] ? { n: w[s.id].n, first: w[s.id].first, days: w[s.id].days, minutes: Math.round((w[s.id].secs || 0) / 60) } : { n: 0, first: 0, days: 0, minutes: 0 },
      levels: lv[s.id] || {},
    })),
    exams: [
      ...examRows.map((e) => ({ id: e.id, studentId: e.student_id, name: e.name, title: e.title, correct: e.correct, total: e.total, weak: JSON.parse(e.weak || '[]'), questions: JSON.parse(e.questions || '[]'), at: e.created_at })),
      ...classExams.map((w) => ({
        id: `a:${w.assignment_id}:${w.student_id}`, studentId: w.student_id, name: w.name, title: w.title, correct: w.right_n, total: w.asked,
        weak: [], questions: JSON.parse(w.questions || '[]'), at: w.done_at, assignmentId: w.assignment_id,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 200),
    mistakes: catRows.map((r) => {
      const who = catStudents.filter((c) => c.topic === r.topic && c.level === r.level && c.cat === r.cat);
      return { topic: r.topic, level: Number(r.level), cat: r.cat, n: r.n, students: r.students, ids: who.map((c) => c.id), names: who.map((c) => c.name) };
    }),
    assignments,
    help: help.map((x) => ({ ...x, messages: threads[x.id]?.messages || [], unreadFromStudent: threads[x.id]?.unreadFromStudent || 0 })),
    helpDigest: owner ? !!owner.help_digest : null,
    aiPolicy,
    ...binding,
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
  const res = await env.DB.prepare(sql).bind(...args).run();
  // the teacher looked at the request: the student's replies on it are read (TEACHER-6)
  if (res.meta?.changes) await markReadStmt(env, id, 'student').run();
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
function health(env) {
  const provider = currentProvider(env);
  return {
    ok: true, ai: !!env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || null, freeModel: env.FREE_MODEL || LITE_MODEL,
    soloAI: String(env.ALLOW_SOLO_AI) !== 'false', paywall: paywallOn(env), email: emailReady(env), checkout: onlineCheckout(env),
    billing: provider?.id || 'none', mode: env.BILLING_MODE === 'test' ? 'test' : 'live',
    deviceMint: String(env.FREE_DEVICE_MINT || 'off') === 'turnstile' ? 'turnstile' : 'off', turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    // whether the secrets that classes, sign-in and network counters need are set (never their values)
    netKeys: !!env.IP_HASH_SECRET, auth: !!env.AUTH_SECRET,
    // the staging Worker (wrangler.toml [env.staging]): the load test runs only against a Worker that says so
    staging: env.STAGING === 'true',
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
  if (M === 'POST' && p === '/api/help') return askHelp(req, env, cors);
  // the student's side of a help request's thread (help.js)
  if (M === 'POST' && (m = p.match(/^\/api\/help\/(\d+)\/reply$/))) return studentReply(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/help\/(\d+)\/read$/))) return readHelp(m[1], req, env, cors);
  if (M === 'POST' && p === '/api/exams') return saveExam(req, env, cors);
  // the teacher's assignments, as the student sees them (assignments.js)
  if (M === 'GET' && p === '/api/class/work') return classWork(req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/class\/work\/([a-f0-9]{16})\/exam$/))) return workExam(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/class\/work\/([a-f0-9]{16})$/))) return postWork(m[1], req, env, cors);
  // teacher
  if (M === 'GET' && p === '/api/teacher/dashboard') return dashboard(req, env, cors);
  if (M === 'GET' && p === '/api/teacher/report') return classReport(req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/help\/(\d+)$/))) return updateHelp(m[1], req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/teacher\/help\/(\d+)\/image$/))) return helpImage(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/help\/(\d+)\/reply$/))) return teacherReply(m[1], req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/digest') return setDigest(req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]{1,32})$/))) return studentDetail(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]+)\/reset-pin$/))) return resetPin(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]+)\/remove$/))) return removeStudent(m[1], req, env, cors);
  // student AI by the Ministry's rules (classai.js, TRUST-11)
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/students\/([a-f0-9]+)\/ai$/))) return setStudentAi(m[1], req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/ai') return setClassAi(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/lock') return lockClass(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/rename') return renameClass(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/delete') return deleteClass(req, env, cors);
  if (M === 'GET' && p === '/api/teacher/assignments') return listAssignments(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/assignments') return createAssignment(req, env, cors);
  if (M === 'GET' && (m = p.match(/^\/api\/teacher\/assignments\/([a-f0-9]{16})$/))) return getAssignment(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/assignments\/([a-f0-9]{16})$/))) return updateAssignment(m[1], req, env, cors);
  if (M === 'POST' && (m = p.match(/^\/api\/teacher\/assignments\/([a-f0-9]{16})\/delete$/))) return deleteAssignment(m[1], req, env, cors);
  if (M === 'GET' && p === '/api/teacher/licence') return licenceStatus(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/licence/request') return licenceRequest(req, env, ctx, cors);
  if (M === 'POST' && p === '/api/teacher/licence/claim') return licenceClaim(req, env, cors);
  // the teacher's account: the classes follow the email (teacherAccount.js)
  if (M === 'GET' && p === '/api/teacher/classes') return myClasses(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/owner') return bindClass(req, env, cors);
  if (M === 'POST' && p === '/api/teacher/class/rekey') return rekeyClass(req, env, ctx, cors);
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
