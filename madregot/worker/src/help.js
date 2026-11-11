// Help both ways (spec TEACHER-6): the teacher replies to a help request in a few words, the student sees where it
// stands and answers. It stays about the exercise and is not a chat: three messages a side, the student answers only
// after the teacher has written, plain text with no link, email address or phone number in either direction (checked
// here), seen only by that teacher and that student, and deleted with the request (forget.js STUDENT_ROWS, the night
// purge in cron.js). The existing askHelp, updateHelp and helpImage stay in index.js.
//
//   POST /api/teacher/help/:id/reply   {body}            the teacher (requireTeacher): 201 {message}
//   POST /api/help/:id/reply           {body?, quick?}   the student, own request only: 201 {message, status}
//   POST /api/help/:id/read            {}                the student opened the thread: the teacher's messages are read
//   POST /api/teacher/class/digest     {on}              the class's owner (account): one email a day with a count
//
// helpThreads() feeds the dashboard's help rows and myHelp() the student's GET /api/class/work; helpDigest() is the
// cron step at 16:00 in Jerusalem.
import { HttpError, json, body, nowIso, dayOf, hourOf, limitOrThrow } from './util.js';
import { requireTeacher, requireStudent } from './entitle.js';
import { requireAccount } from './account.js';
import { teacherDetail, classSeenStmt } from './licence.js';
import { cleanNote } from './assignments.js';
import { hasContact } from '../../shared/contact.js';

export const HELP = Object.freeze({
  /** Messages per side on one request. */
  perSide: 3,
  /** Longest message: the teacher's, the student's. */
  teacherMax: 500,
  studentMax: 300,
  /** Student messages a day (ai_usage helpreply:s:<id>). */
  studentPerDay: 30,
  /** Messages shown with a request on the board (three a side). */
  shown: 6,
  /** The student's own requests in GET /api/class/work: this many days back, at most this many. */
  studentDays: 30,
  studentList: 20,
});
/** The student's two quick answers. */
export const QUICK = Object.freeze({ thanks: 'תודה, הבנתי', still: 'עדיין לא ברור לי' });

const SMALL = 4096;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];

// ---------------------------------------------------------------- the contact guard
// shared/contact.js, the same function the demo class uses: a link, an email address (also spelled out), a handle or a
// phone number however it is written (other separators, full-width or Arabic-Indic digits); maths passes.
export { hasContact };

/**
 * A message as it is kept: trimmed, without control characters (line breaks stay), 1..max characters; else 400
 * bad_reply. With a link, an email address or a phone number: 400 reply_has_contact.
 */
export function cleanReply(text, max) {
  const s = cleanNote(text, max + 1);
  if (!s || s.length > max) throw new HttpError(400, 'bad_reply');
  if (hasContact(s)) throw new HttpError(400, 'reply_has_contact');
  return s;
}

// ---------------------------------------------------------------- reading threads
const view = (m) => ({ id: m.id, from: m.from_role, body: m.body, at: m.created_at, read: !!m.read_at });
/** The status a student sees: done, else answered (the teacher wrote), else seen, else sent. */
const statusOf = (h, msgs) => (h.done_at ? 'done' : msgs.some((m) => m.from_role === 'teacher') ? 'answered' : h.seen_at ? 'seen' : 'sent');

/**
 * The threads of the help requests a SELECT of ids finds (`sel`, bound to `args`): { [helpId]: { messages,
 * unreadFromStudent } }, the messages oldest first, at most six.
 */
export async function helpThreads(env, sel, args) {
  const list = await all(env, `SELECT id, help_id, from_role, body, created_at, read_at FROM help_messages WHERE help_id IN (${sel}) ORDER BY help_id, id`, ...args);
  const out = {};
  for (const m of list) {
    const t = (out[m.help_id] ||= { messages: [], unreadFromStudent: 0 });
    if (t.messages.length < HELP.shown) t.messages.push(view(m));
    if (m.from_role === 'student' && !m.read_at) t.unreadFromStudent += 1;
  }
  return out;
}

/**
 * The student's own requests of the last 30 days for GET /api/class/work, newest first, at most 20: { id, topic, level,
 * question, createdAt, status, messages }. Never the notebook page.
 */
export async function myHelp(env, studentId) {
  const since = new Date(Date.now() - HELP.studentDays * 864e5).toISOString();
  const rows = await all(env, `SELECT id, topic, level, question, created_at, seen_at, done_at FROM help_requests
    WHERE student_id = ? AND created_at >= ? ORDER BY created_at DESC, id DESC LIMIT ${HELP.studentList}`, studentId, since);
  if (!rows.length) return [];
  const msgs = await all(env, `SELECT id, help_id, from_role, body, created_at, read_at FROM help_messages
    WHERE help_id IN (SELECT id FROM help_requests WHERE student_id = ? AND created_at >= ?) ORDER BY help_id, id`, studentId, since);
  return rows.map((h) => {
    const mine = msgs.filter((m) => m.help_id === h.id);
    return { id: h.id, topic: h.topic, level: h.level, question: h.question, createdAt: h.created_at, status: statusOf(h, mine), messages: mine.map(view) };
  });
}

/** The statement that marks one side's messages on a request as read by the other side. */
export const markReadStmt = (env, helpId, from) => env.DB.prepare('UPDATE help_messages SET read_at = ? WHERE help_id = ? AND from_role = ? AND read_at IS NULL')
  .bind(nowIso(), Number(helpId), from);

// ---------------------------------------------------------------- the teacher's reply
/**
 * POST /api/teacher/help/:id/reply {body}: 1..500 characters, no contact details; at most 3 from the teacher (409
 * reply_limit, checked again inside the insert). The request counts as seen and the student's messages as read. Audit
 * help.reply with no text in it. → 201 {message}.
 */
export async function teacherReply(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, SMALL);
  const h = await first(env, 'SELECT h.id FROM help_requests h JOIN students s ON s.id = h.student_id WHERE h.id = ? AND s.class_code = ?', Number(id), cls.code);
  if (!h) throw new HttpError(404, 'not_found');
  const text = cleanReply(b.body, HELP.teacherMax);
  const now = nowIso();
  const under = `(SELECT COUNT(*) FROM help_messages WHERE help_id = ?1 AND from_role = 'teacher') < ${HELP.perSide}`;
  const [ins] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO help_messages (help_id, from_role, body, created_at) SELECT ?1, 'teacher', ?2, ?3 WHERE ${under} RETURNING id`).bind(h.id, text, now),
    env.DB.prepare('UPDATE help_requests SET seen_at = COALESCE(seen_at, ?) WHERE id = ?').bind(now, h.id),
    markReadStmt(env, h.id, 'student'),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?1, ?2, 'help.reply', ?3, ?4
      WHERE EXISTS (SELECT 1 FROM help_messages WHERE help_id = ?5 AND created_at = ?1 AND from_role = 'teacher')`)
      .bind(now, `teacher:${cls.code}`, `help:${h.id}`, teacherDetail(cls), h.id),
  ]);
  const made = ins?.results?.[0];
  if (!made) throw new HttpError(409, 'reply_limit');
  return json({ message: { id: made.id, from: 'teacher', body: text, at: now, read: false } }, 201, cors);
}

// ---------------------------------------------------------------- the student's side
async function ownRequest(env, s, id) {
  const h = await first(env, 'SELECT id, seen_at, done_at FROM help_requests WHERE id = ? AND student_id = ?', Number(id), s.id);
  if (!h) throw new HttpError(404, 'not_found');
  return h;
}

/**
 * POST /api/help/:id/reply {body?, quick?: 'thanks'|'still'}: the student answers the teacher on their own request.
 * 'thanks' is "תודה, הבנתי"; 'still' is the text (or "עדיין לא ברור לי") and reopens a request the teacher closed. Only
 * after the teacher has written (409 no_reply_yet), at most 3 (409 reply_limit), 300 characters, no contact details,
 * 30 a day. The teacher's messages count as read. → 201 {message, status}.
 */
export async function studentReply(id, req, env, cors) {
  const s = await requireStudent(req, env);
  const b = await body(req, SMALL);
  const h = await ownRequest(env, s, id);
  const quick = b.quick == null ? null : String(b.quick);
  if (quick && !QUICK[quick]) throw new HttpError(400, 'bad_reply');
  let text;
  if (quick === 'thanks') text = QUICK.thanks;
  else if (quick === 'still' && (b.body == null || String(b.body).trim() === '')) text = QUICK.still;
  else text = cleanReply(b.body, HELP.studentMax);
  const counts = await first(env, `SELECT COALESCE(SUM(from_role = 'teacher'), 0) AS t, COALESCE(SUM(from_role = 'student'), 0) AS s
    FROM help_messages WHERE help_id = ?`, h.id);
  if (!Number(counts.t)) throw new HttpError(409, 'no_reply_yet');
  if (Number(counts.s) >= HELP.perSide) throw new HttpError(409, 'reply_limit');
  await limitOrThrow(env, `helpreply:s:${s.id}`, HELP.studentPerDay, 429, 'slow_down');
  const now = nowIso();
  const under = `EXISTS (SELECT 1 FROM help_messages WHERE help_id = ?1 AND from_role = 'teacher')
    AND (SELECT COUNT(*) FROM help_messages WHERE help_id = ?1 AND from_role = 'student') < ${HELP.perSide}`;
  const [ins] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO help_messages (help_id, from_role, body, created_at) SELECT ?1, 'student', ?2, ?3 WHERE ${under} RETURNING id`).bind(h.id, text, now),
    markReadStmt(env, h.id, 'teacher'),
    // "עדיין לא ברור לי" opens the request again for the teacher
    ...(quick === 'still' ? [env.DB.prepare('UPDATE help_requests SET done_at = NULL WHERE id = ? AND student_id = ?').bind(h.id, s.id)] : []),
    env.DB.prepare('UPDATE students SET last_seen = ? WHERE id = ?').bind(now, s.id),
    classSeenStmt(env, s.class_code),
  ]);
  const made = ins?.results?.[0];
  if (!made) throw new HttpError(409, 'reply_limit');
  const after = await ownRequest(env, s, h.id);
  return json({ message: { id: made.id, from: 'student', body: text, at: now, read: false }, status: after.done_at ? 'done' : 'answered' }, 201, cors);
}

/** POST /api/help/:id/read {}: the student opened the thread; the teacher's messages on it are read. → {ok}. */
export async function readHelp(id, req, env, cors) {
  const s = await requireStudent(req, env);
  await body(req, SMALL);
  const h = await ownRequest(env, s, id);
  await markReadStmt(env, h.id, 'teacher').run();
  return json({ ok: true }, 200, cors);
}

// ---------------------------------------------------------------- the daily email to the teacher
/**
 * POST /api/teacher/class/digest {on}: the class's owner (X-Class-Code with the session of the account it is bound to;
 * a key alone is 403 not_owner) turns the daily help email on or off. Audit class.digest. → {helpDigest}.
 */
export async function setDigest(req, env, cors) {
  const a = await requireAccount(req, env);
  const b = await body(req, SMALL);
  if (typeof b.on !== 'boolean') throw new HttpError(400, 'bad_request');
  const code = String(req.headers.get('X-Class-Code') || '').toUpperCase().slice(0, 12);
  const own = code ? await first(env, 'SELECT class_code FROM class_owners WHERE class_code = ? AND account_id = ?', code, a.id) : null;
  if (!own) throw new HttpError(403, 'not_owner');
  await env.DB.batch([
    env.DB.prepare('UPDATE class_owners SET help_digest = ? WHERE class_code = ? AND account_id = ?').bind(b.on ? 1 : 0, code, a.id),
    env.DB.prepare("INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, 'class.digest', ?, ?)")
      .bind(nowIso(), `teacher:${code}`, `class:${code}`, JSON.stringify({ on: b.on, via: 'account' })),
  ]);
  return json({ helpDigest: b.on }, 200, cors);
}

/**
 * A day with no school email: Saturday, until the student lane's shared/restDays.js lands (then its isRestDay, and its
 * eve after 13:00, replace this). The Jerusalem weekday of `now`.
 */
export const digestRestDay = (now) => new Date(`${dayOf(now)}T12:00:00Z`).getUTCDay() === 6;

/**
 * The cron step of the 16:00 hour in Jerusalem: for every class whose owner turned the email on, the open requests
 * that are new since the last digest of that class (made after it, or with a student message after it; with no digest
 * yet, the last 24 hours) are counted, and one notice is queued: ref = the class code, kind = help_digest:<day>,
 * to_account = the owner, params {className, n} and nothing else. None on a rest day: the next working day's counts
 * everything since the last one. The (ref, kind) key makes a second run in the hour a no-op.
 */
export async function helpDigest(env, now = new Date()) {
  if (digestRestDay(now)) return { queued: 0, rest: true };
  const day = dayOf(now);
  const nowStr = now.toISOString();
  const dayAgo = new Date(now.getTime() - 864e5).toISOString();
  const owners = await all(env, `SELECT o.class_code, o.account_id, c.name,
      COALESCE((SELECT MAX(n.created_at) FROM notices n WHERE n.ref = o.class_code AND n.kind LIKE 'help_digest:%'), ?1) AS since
    FROM class_owners o JOIN classes c ON c.code = o.class_code WHERE o.help_digest = 1`, dayAgo);
  let queued = 0;
  for (const o of owners) {
    const row = await first(env, `SELECT COUNT(*) AS n FROM help_requests h JOIN students s ON s.id = h.student_id
      WHERE s.class_code = ?1 AND h.done_at IS NULL AND (h.created_at > ?2
        OR EXISTS (SELECT 1 FROM help_messages m WHERE m.help_id = h.id AND m.from_role = 'student' AND m.created_at > ?2))`, o.class_code, o.since);
    const n = Number(row?.n || 0);
    if (!n) continue;
    const r = await env.DB.prepare('INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(o.class_code, `help_digest:${day}`, o.account_id, JSON.stringify({ className: o.name, n }), nowStr).run();
    queued += Number(r.meta?.changes || 0);
  }
  return { queued };
}

/** Is `now` in the 16:00 hour in Jerusalem (the digest's hour)? */
export const digestHour = (now = new Date()) => hourOf(now).endsWith('T16');
