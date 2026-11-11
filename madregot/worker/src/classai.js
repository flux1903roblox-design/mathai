// The Ministry of Education's AI rules for one class, on the server (trust spec TRUST-11 §2-5). The rule itself is
// shared/schoolRules.js; this file reads and writes a class's choices (class_settings, student_ai_off), answers the
// teacher's switches, and keeps AI class licences from being sold where the rule does not allow student AI.
//
//   POST /api/classes                  { setting?: 'school'|'private', privateAttest? }  (createClass in index.js)
//   POST /api/teacher/class/ai         { studentAi?: 'on'|'off', consent?: true, setting?, privateAttest? } → { policy }
//   POST /api/teacher/students/:id/ai  { off: boolean } → { id, aiOff }
//
// A class with no class_settings row is a school class with student AI off and no consent: the safe default, and what
// every class is until its teacher says otherwise. Every change is audited (class.setting, class.ai, student.ai) with
// no personal data in the detail; a change the teacher made signed in with the class's email (not the key) also says
// via: 'account' (the teacher lane's detail). The teacher lane's screens (ClassAICard, the setting question, the student
// sheet's switch, LicenceCard) and its demo class read these shapes.
import { MOE_RULES, classAiPolicy, rulesEnv, notSellable } from '../../shared/schoolRules.js';
import { HttpError, body, json, nowIso } from './util.js';
import { requireTeacher } from './entitle.js';

const SMALL = 4096;
/** The audit detail, with via: 'account' when the teacher came in with the class's email session (requireTeacher's via). */
const detailOf = (via, detail) => (via === 'account' ? { ...detail, via: 'account' } : detail);
const audit = (env, code, action, target, detail, at = nowIso(), via = null) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(at, `teacher:${code}`, action, target, JSON.stringify(detailOf(via, detail)));

/** A class's choices as the rule reads them (the safe default when it has no row). */
export async function classSettings(env, code) {
  const row = await env.DB.prepare('SELECT setting, student_ai, ai_consent_at, private_attested_at FROM class_settings WHERE code = ?').bind(code).first();
  return {
    setting: row?.setting === 'private' ? 'private' : 'school',
    studentAi: row?.student_ai === 'on' ? 'on' : 'off',
    consentAt: row?.ai_consent_at || null,
    privateAttestedAt: row?.private_attested_at || null,
  };
}

/** The rule's answer for a class (cls: its classes row, for the grade) and its choices. */
export const policyOf = (env, cls, s) => classAiPolicy({ setting: s.setting, grade: cls.grade, studentAi: s.studentAi, consentAt: s.consentAt }, rulesEnv(env));

/**
 * What the teacher's screens show about student AI (the dashboard's aiPolicy): the rule's answer, the class's choices,
 * the first grade the catalogue approval covers, and the Ministry's guidelines and parent consent form.
 */
export function aiPolicyView(env, cls, s) {
  return {
    ...policyOf(env, cls, s),
    setting: s.setting, studentAi: s.studentAi, consentAt: s.consentAt,
    fromGrade: Math.max(MOE_RULES.independentFromGrade, rulesEnv(env).approvedFromGrade),
    rulesVersion: MOE_RULES.version, rulesUrl: MOE_RULES.url,
    consentFormUrl: MOE_RULES.consentFormUrl, consentPdfUrl: MOE_RULES.consentPdfUrl,
  };
}

/**
 * The setting a new class asks for (POST /api/classes): 'school' when none is given. A private group needs its
 * teacher's attestation that it is not part of a school (400 private_attest_required otherwise).
 */
export function newClassSetting(b = {}) {
  const setting = b.setting === undefined || b.setting === null || b.setting === '' ? 'school' : String(b.setting);
  if (setting !== 'school' && setting !== 'private') throw new HttpError(400, 'bad_request');
  if (setting === 'private' && b.privateAttest !== true) throw new HttpError(400, 'private_attest_required');
  return setting;
}

/**
 * What a new class writes beside its classes row, in the same batch after it: nothing for a school class (no row is the
 * default), else the attested private row and its audit. Both are written only if the class row was (the teacher lane's
 * guard: with a session the owned-class cap can stop the class row when two are made at once, and then nothing of the
 * class is left). `opts` is { now, via } (via 'account' when made with an email session), or the time alone.
 */
export function newClassStmts(env, code, setting, opts = {}) {
  if (setting !== 'private') return [];
  const { now = nowIso(), via = null } = typeof opts === 'string' ? { now: opts } : opts;
  const made = 'EXISTS (SELECT 1 FROM classes WHERE code = ?1)';
  return [
    env.DB.prepare(`INSERT INTO class_settings (code, setting, student_ai, ai_consent_at, private_attested_at) SELECT ?1, 'private', 'off', NULL, ?2 WHERE ${made}
      ON CONFLICT (code) DO UPDATE SET setting = 'private', student_ai = 'off', ai_consent_at = NULL, private_attested_at = excluded.private_attested_at`).bind(code, now),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?2, 'teacher:' || ?1, 'class.setting', 'class:' || ?1, ?3 WHERE ${made}`)
      .bind(code, now, JSON.stringify(detailOf(via, { setting: 'private', attested: true }))),
  ];
}

/**
 * POST /api/teacher/class/ai { studentAi?: 'on'|'off', consent?: true, setting?: 'school'|'private', privateAttest? }.
 * consent: true records that the parents agreed (now). studentAi 'on' where the rule cannot allow it → 409
 * class_ai_locked { reason }; with no consent recorded → 409 consent_needed. A change of setting needs the same
 * attestation as a new class, and starts the class again from student AI off with no consent: the teacher confirms the
 * parents' consent under the new setting's terms. Nothing is written when the request is refused. → { policy }.
 */
export async function setClassAi(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, SMALL);
  const { studentAi, consent, setting } = b;
  if (studentAi !== undefined && studentAi !== 'on' && studentAi !== 'off') throw new HttpError(400, 'bad_request');
  if (consent !== undefined && consent !== true) throw new HttpError(400, 'bad_request');
  if (setting !== undefined && setting !== 'school' && setting !== 'private') throw new HttpError(400, 'bad_request');
  if (studentAi === undefined && consent === undefined && setting === undefined) throw new HttpError(400, 'bad_request');
  const now = nowIso();
  const cur = await classSettings(env, cls.code);
  const next = { ...cur };
  const moved = setting !== undefined && setting !== cur.setting;
  if (moved) {
    if (setting === 'private' && b.privateAttest !== true) throw new HttpError(400, 'private_attest_required');
    Object.assign(next, { setting, privateAttestedAt: setting === 'private' ? now : null, studentAi: 'off', consentAt: null });
  }
  if (consent === true) next.consentAt = now;
  if (studentAi === 'on') {
    const p = policyOf(env, cls, next);
    if (!p.canTurnOn) throw new HttpError(409, 'class_ai_locked', undefined, { reason: p.reason });
    if (!next.consentAt) throw new HttpError(409, 'consent_needed');
    next.studentAi = 'on';
  } else if (studentAi === 'off') next.studentAi = 'off';
  const target = `class:${cls.code}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO class_settings (code, setting, student_ai, ai_consent_at, private_attested_at) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT (code) DO UPDATE SET setting = ?2, student_ai = ?3, ai_consent_at = ?4, private_attested_at = ?5`)
      .bind(cls.code, next.setting, next.studentAi, next.consentAt, next.privateAttestedAt),
    ...(moved ? [audit(env, cls.code, 'class.setting', target, { setting, attested: setting === 'private' }, now, cls.via)] : []),
    ...(studentAi !== undefined || consent !== undefined ? [audit(env, cls.code, 'class.ai', target, { studentAi: studentAi ?? null, consent: consent === true }, now, cls.via)] : []),
  ]);
  return json({ policy: aiPolicyView(env, cls, next) }, 200, cors);
}

/**
 * POST /api/teacher/students/:id/ai { off }: the tutor off (or on again) for one student of the class, the Ministry's
 * "alternative activity" for a student whose parents did not agree. The student keeps everything that is not AI.
 */
export async function setStudentAi(id, req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, SMALL);
  if (typeof b.off !== 'boolean') throw new HttpError(400, 'bad_request');
  const st = await env.DB.prepare('SELECT id FROM students WHERE id = ? AND class_code = ?').bind(String(id), cls.code).first();
  if (!st) throw new HttpError(404, 'not_found');
  const now = nowIso();
  await env.DB.batch([
    b.off
      ? env.DB.prepare('INSERT OR IGNORE INTO student_ai_off (student_id, at) VALUES (?, ?)').bind(st.id, now)
      : env.DB.prepare('DELETE FROM student_ai_off WHERE student_id = ?').bind(st.id),
    audit(env, cls.code, 'student.ai', `student:${st.id}`, { off: b.off }, now, cls.via),
  ]);
  return json({ id: st.id, aiOff: b.off }, 200, cors);
}

/**
 * No AI class licence (a paid class year, a trial, a school licence code) for a class where the rule keeps student AI
 * off whatever the teacher does: a school class before the catalogue approval, or a grade the approval does not cover
 * (TRUST-11 §5). → 409 school_ai_not_approved { reason }. A quote request stays open.
 */
export async function refuseSchoolSale(env, cls) {
  const p = policyOf(env, cls, await classSettings(env, cls.code));
  if (notSellable(p)) throw new HttpError(409, 'school_ai_not_approved', undefined, { reason: p.reason });
}
