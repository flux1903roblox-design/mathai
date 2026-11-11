// A class follows its teacher's email (spec TEACHER-1): the account a class is bound to opens it on any device with a
// sign-in instead of the teacher key (requireTeacher in entitle.js accepts either). The key keeps working for the devices
// that have it and for co-teachers, until the owner replaces it here; it is never replaced behind the teacher's back.
//   GET  /api/teacher/classes        (X-Account-Token)                 the account's classes, newest first, at most 20
//   POST /api/teacher/class/owner    (teacher key + X-Account-Token)   bind the class to this account
//   POST /api/teacher/class/rekey    (the owner's session, a fresh code) a new teacher key; the old one stops working
// POST /api/classes binds a new class at once when it comes with a session (createClass in index.js, ownedClassStmts).
// Nothing here stores or returns the email of anyone but the caller.
//
// A late bind: a class opened with the key flow and bound to an email later, by whoever holds its key (the review of the
// teacher lane: a co-teacher who has the key can bind it by mistake). The app offers the bind only on the device that
// opened the class; here, the dashboard tells every device that comes with the key that the class is now bound to an
// email, and when (boundElsewhere, boundAt), and nobody can replace the key for LATE_BIND_HOLD_DAYS after a late bind,
// so a mistaken bind is undone (npm run owner -- unbind-class) before anyone is locked out.
import { HttpError, body, json, nowIso, randomToken, sha256, limitOrThrow } from './util.js';
import { requireTeacher } from './entitle.js';
import { requireAccount, requireRecentCode } from './account.js';
import { teacherDetail } from './licence.js';
import { flushNotices } from './email.js';

const SMALL = 4096;
/** Classes one account may own; the class list returns at most this many. */
export const MAX_OWNED = 20;
/** The class list: 120 an hour per account. */
export const LIST_PER_HOUR = 120;
const first = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).all().then((r) => r.results || []);
const ownedBy = (env, accountId) => first(env, 'SELECT COUNT(*) AS n FROM class_owners WHERE account_id = ?', accountId).then((r) => Number(r?.n || 0));
const ownerOf = (env, code) => first(env, 'SELECT account_id FROM class_owners WHERE class_code = ?', code);
const UNDER_CAP = '(SELECT COUNT(*) FROM class_owners WHERE account_id = ?2) < ?4';
/** Days after a late bind during which the key cannot be replaced (409 rekey_hold). */
export const LATE_BIND_HOLD_DAYS = 7;

/**
 * The class's late bind, or null: { at } when it was bound to an email after it was opened. A class bound when it was
 * made has bound_at equal to created_at (ownedClassStmts writes both from one clock reading).
 */
export async function lateBind(env, code) {
  const row = await first(env, 'SELECT o.bound_at FROM class_owners o JOIN classes c ON c.code = o.class_code WHERE o.class_code = ? AND o.bound_at > c.created_at', code);
  return row ? { at: row.bound_at } : null;
}
/** The end of a late bind's hold on the key (ms), or 0. */
const holdUntil = (late) => (late ? Date.parse(late.at) + LATE_BIND_HOLD_DAYS * 864e5 : 0);
/**
 * What the dashboard says about a late bind. To a device that came with the key: that the class is bound to an email
 * now, and since when (boundElsewhere, boundAt). To the bound account: from when it may replace the key (rekeyFrom,
 * while the hold lasts), so the settings page does not ask for a code it cannot use.
 */
export async function bindingView(env, cls) {
  const late = await lateBind(env, cls.code);
  const until = holdUntil(late);
  return {
    boundElsewhere: cls.via === 'key' && !!late,
    boundAt: cls.via === 'key' && late ? late.at : null,
    rekeyFrom: cls.via === 'account' && Date.now() < until ? new Date(until).toISOString() : null,
  };
}

/**
 * The statements that create a class bound to an account, as one batch: the class row and its owner row, each written
 * only while the account owns fewer than MAX_OWNED classes (both see the same count inside the batch, so either both are
 * written or neither), and the audit row. res[0] changed 0 rows = the cap was reached.
 */
export function ownedClassStmts(env, { code, name, grade, teacherName, keyHash, now }, accountId) {
  return [
    env.DB.prepare(`INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at)
      SELECT ?1, ?5, ?6, ?7, ?8, ?3 WHERE ${UNDER_CAP}`).bind(code, accountId, now, MAX_OWNED, name, grade, teacherName, keyHash),
    env.DB.prepare(`INSERT INTO class_owners (class_code, account_id, bound_at)
      SELECT ?1, ?2, ?3 WHERE ${UNDER_CAP} AND EXISTS (SELECT 1 FROM classes WHERE code = ?1)`).bind(code, accountId, now, MAX_OWNED),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail)
      SELECT ?3, 'teacher:' || ?1, 'class.owner', 'class:' || ?1, '{"via":"account"}' WHERE EXISTS (SELECT 1 FROM class_owners WHERE class_code = ?1 AND account_id = ?2)`)
      .bind(code, accountId, now),
  ];
}
/** Refuse before anything is written when the account already owns MAX_OWNED classes. */
export async function checkOwnedCap(env, accountId) {
  if ((await ownedBy(env, accountId)) >= MAX_OWNED) throw new HttpError(409, 'too_many_classes_owned');
}

/** GET /api/teacher/classes: the classes bound to the signed-in account, newest first, with their student counts. */
export async function myClasses(req, env, cors) {
  const a = await requireAccount(req, env);
  await limitOrThrow(env, `tclasses:a:${a.id}`, LIST_PER_HOUR, 429, 'too_many_lists', 'hour');
  const rows = await all(env, `SELECT c.code, c.name, c.grade, c.teacher_name, c.created_at, o.bound_at,
      (SELECT COUNT(*) FROM students s WHERE s.class_code = c.code) AS students
    FROM class_owners o JOIN classes c ON c.code = o.class_code WHERE o.account_id = ?
    ORDER BY c.created_at DESC, c.code LIMIT ?`, a.id, MAX_OWNED);
  return json({
    classes: rows.map((r) => ({
      code: r.code, name: r.name, grade: r.grade, teacherName: r.teacher_name, students: Number(r.students || 0), createdAt: r.created_at, boundAt: r.bound_at,
    })),
  }, 200, cors);
}

/**
 * POST /api/teacher/class/owner {}: the teacher (key) binds the class to the signed-in account. Again for the same
 * account: 200 as before. 409 owned_by_other when another account has it; 409 too_many_classes_owned at MAX_OWNED.
 */
export async function bindClass(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const a = await requireAccount(req, env);
  await body(req, SMALL);
  const mine = json({ owner: 'you', email: a.email }, 200, cors);
  const owner = await ownerOf(env, cls.code);
  if (owner) {
    if (owner.account_id === a.id) return mine;
    throw new HttpError(409, 'owned_by_other');
  }
  await checkOwnedCap(env, a.id);
  const now = nowIso();
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT INTO class_owners (class_code, account_id, bound_at)
      SELECT ?1, ?2, ?3 WHERE ${UNDER_CAP} AND NOT EXISTS (SELECT 1 FROM class_owners WHERE class_code = ?1)`).bind(cls.code, a.id, now, MAX_OWNED),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail)
      SELECT ?3, 'teacher:' || ?1, 'class.owner', 'class:' || ?1, ?4 WHERE EXISTS (SELECT 1 FROM class_owners WHERE class_code = ?1 AND account_id = ?2 AND bound_at = ?3)`)
      .bind(cls.code, a.id, now, teacherDetail(cls)),
  ]);
  if (Number(res[0].meta?.changes) !== 1) {
    // two requests at once: the class went to whoever was first, or the account reached the cap meanwhile
    const now2 = await ownerOf(env, cls.code);
    if (now2?.account_id === a.id) return mine;
    throw new HttpError(409, now2 ? 'owned_by_other' : 'too_many_classes_owned');
  }
  return mine;
}

/**
 * POST /api/teacher/class/rekey {}: the owner (account session only, with a code entered in the last 10 minutes) makes a
 * new teacher key; not within LATE_BIND_HOLD_DAYS of a late bind (409 rekey_hold {until}). The old key stops working
 * everywhere; signing in with the email keeps working. The owner gets an email (one per minute at most). Returns the new
 * key, shown once.
 */
export async function rekeyClass(req, env, ctx, cors) {
  const a = await requireAccount(req, env);
  await body(req, SMALL);
  const code = String(req.headers.get('X-Class-Code') || '').toUpperCase().slice(0, 12);
  const cls = code ? await first(env, 'SELECT c.code, c.name FROM classes c JOIN class_owners o ON o.class_code = c.code WHERE c.code = ? AND o.account_id = ?', code, a.id) : null;
  if (!cls) throw new HttpError(403, 'not_owner');
  // a late bind holds the key for LATE_BIND_HOLD_DAYS: the teacher who opened the class keeps her way in meanwhile
  const until = holdUntil(await lateBind(env, cls.code));
  if (Date.now() < until) throw new HttpError(409, 'rekey_hold', undefined, { until: new Date(until).toISOString() });
  requireRecentCode(a);
  const teacherKey = randomToken(12);
  const now = nowIso();
  const owned = 'EXISTS (SELECT 1 FROM class_owners WHERE class_code = ?2 AND account_id = ?3)';
  const res = await env.DB.batch([
    env.DB.prepare(`UPDATE classes SET teacher_key_hash = ?1 WHERE code = ?2 AND ${owned}`).bind(await sha256(teacherKey), cls.code, a.id),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?1, 'teacher:' || ?2, 'class.rekey', 'class:' || ?2, '{"via":"account"}' WHERE ${owned}`)
      .bind(now, cls.code, a.id),
    env.DB.prepare(`INSERT OR IGNORE INTO notices (ref, kind, to_account, params, created_at) SELECT ?2, ?4, ?3, ?5, ?1 WHERE ${owned}`)
      .bind(now, cls.code, a.id, `class_rekeyed:${now.slice(0, 16)}`, JSON.stringify({ className: cls.name, code: cls.code })),
  ]);
  if (Number(res[0].meta?.changes) !== 1) throw new HttpError(403, 'not_owner');
  ctx?.waitUntil?.(flushNotices(env));
  return json({ teacherKey }, 200, cors);
}
