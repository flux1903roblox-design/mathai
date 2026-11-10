// Student AI in a class, by the Ministry of Education's rules (spec TRUST-11 §2-3, §5): the class's setting (a school
// class, or a private group its teacher attested to), the teacher's switch and the parents' consent, kept in
// class_settings; the students the teacher turned it off for (student_ai_off); and what may be sold to a class. The rule
// itself is shared/schoolRules.js; entitle.js enforces it on every AI request.
//
//   POST /api/teacher/class/ai            {studentAi?: 'on'|'off', consent?: true, setting?: 'school'|'private', privateAttest?}
//   POST /api/teacher/students/:id/ai     {off: boolean}
//
// A class with no class_settings row is a school class, student AI off, no consent. While MOE_AI_APPROVAL is "none" a
// school class cannot turn student AI on (409 class_ai_locked, reason not_in_catalogue), nor buy it (409
// school_ai_not_approved). Every change is audited: class.setting, class.ai, student.ai.
import { HttpError, json, body, nowIso } from './util.js';
import { requireTeacher } from './entitle.js';
import { MOE_RULES, classAiPolicy, moeEnv, NOT_SELLABLE } from '../../shared/schoolRules.js';

const SMALL = 4096;
const SETTINGS = ['school', 'private'];

/** The class's AI settings: { setting, studentAi, consentAt, privateAttestedAt }; no row: a school class, off, no consent. */
export async function classSettings(env, code) {
  const r = await env.DB.prepare('SELECT setting, student_ai, ai_consent_at, private_attested_at FROM class_settings WHERE code = ?').bind(code).first();
  return {
    setting: r?.setting === 'private' ? 'private' : 'school', studentAi: r?.student_ai === 'on' ? 'on' : 'off',
    consentAt: r?.ai_consent_at || null, privateAttestedAt: r?.private_attested_at || null,
  };
}

/** The rule's answer for a class row (its grade) with these settings. */
export const policyOf = (env, cls, s) => classAiPolicy({ setting: s.setting, grade: cls.grade, studentAi: s.studentAi, consentAt: s.consentAt }, moeEnv(env));

/** What the dashboard and POST /api/teacher/class/ai give the teacher's screens. */
export const aiPolicyView = (policy, s) => ({
  ...policy, setting: s.setting, consentAt: s.consentAt,
  rulesVersion: MOE_RULES.version, rulesUrl: MOE_RULES.url, consentFormUrl: MOE_RULES.consentFormUrl, consentPdfUrl: MOE_RULES.consentPdfUrl,
});

/** The class's policy as the dashboard shows it. */
export async function classAiView(env, cls) {
  const s = await classSettings(env, cls.code);
  return aiPolicyView(policyOf(env, cls, s), s);
}

/**
 * Selling within the rules (TRUST-11 §5): a class whose students may not have the AI under the rules (a school class
 * while Madregot is not in the catalogue, or below the approved grade) cannot buy a licence, start a trial or take a
 * school licence code: 409 school_ai_not_approved with the reason. A quote request stays open.
 */
export async function requireSellable(env, cls) {
  const p = policyOf(env, cls, await classSettings(env, cls.code));
  if (NOT_SELLABLE.includes(p.reason)) throw new HttpError(409, 'school_ai_not_approved', undefined, { reason: p.reason });
}

const detailOf = (cls, detail) => JSON.stringify(cls?.via === 'account' ? { ...detail, via: 'account' } : detail);
const audit = (env, cls, action, target, detail, at = nowIso()) => env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
  .bind(at, `teacher:${cls.code}`, action, target, detailOf(cls, detail));
const upsert = (env, code, s) => env.DB.prepare(`INSERT INTO class_settings (code, setting, student_ai, ai_consent_at, private_attested_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (code) DO UPDATE SET setting = excluded.setting, student_ai = excluded.student_ai, ai_consent_at = excluded.ai_consent_at,
    private_attested_at = excluded.private_attested_at`).bind(code, s.setting, s.studentAi, s.consentAt, s.privateAttestedAt);

/**
 * A new class's setting (POST /api/classes {setting?, privateAttest?}): missing is 'school'; 'private' needs
 * privateAttest: true (400 private_attest_required). → 'school' | 'private'.
 */
export function newClassSetting(b) {
  const setting = b.setting === undefined || b.setting === null || b.setting === '' ? 'school' : String(b.setting);
  if (!SETTINGS.includes(setting)) throw new HttpError(400, 'bad_request');
  if (setting === 'private' && b.privateAttest !== true) throw new HttpError(400, 'private_attest_required');
  return setting;
}
/**
 * The statements that record a new private group, for the batch that makes the class (its settings row and the audit
 * row, written only if the class row was): none for a school class.
 */
export function newClassSettingStmts(env, code, setting, { now = nowIso(), via = null } = {}) {
  if (setting !== 'private') return [];
  const made = 'EXISTS (SELECT 1 FROM classes WHERE code = ?1)';
  return [
    env.DB.prepare(`INSERT INTO class_settings (code, setting, student_ai, ai_consent_at, private_attested_at) SELECT ?1, 'private', 'off', NULL, ?2 WHERE ${made}
      ON CONFLICT (code) DO UPDATE SET setting = 'private', student_ai = 'off', ai_consent_at = NULL, private_attested_at = excluded.private_attested_at`).bind(code, now),
    env.DB.prepare(`INSERT INTO audit_log (at, actor, action, target, detail) SELECT ?2, 'teacher:' || ?1, 'class.setting', 'class:' || ?1, ?3 WHERE ${made}`)
      .bind(code, now, detailOf({ via }, { setting: 'private' })),
  ];
}

/**
 * POST /api/teacher/class/ai {studentAi?, consent?, setting?, privateAttest?} (requireTeacher):
 *   setting   a change of setting follows the same rule as a new class ('private' needs privateAttest: true, else 400
 *             private_attest_required) and starts over: the switch off, no consent (the consent asked differs);
 *   consent   true: the parents' consent is recorded now;
 *   studentAi 'on' needs the rule to allow it (409 class_ai_locked {reason}) and a consent (409 consent_needed); 'off'
 *             is always allowed.
 * Applied together, in that order. Audit class.ai with the fields sent. → {policy} (the dashboard's aiPolicy).
 */
export async function setClassAi(req, env, cors) {
  const cls = await requireTeacher(req, env);
  const b = await body(req, SMALL);
  const has = (k) => b[k] !== undefined;
  if (!has('studentAi') && !has('consent') && !has('setting')) throw new HttpError(400, 'bad_request');
  if (has('studentAi') && !['on', 'off'].includes(b.studentAi)) throw new HttpError(400, 'bad_request');
  if (has('consent') && b.consent !== true) throw new HttpError(400, 'bad_request');
  if (has('setting') && !SETTINGS.includes(b.setting)) throw new HttpError(400, 'bad_request');
  const now = nowIso();
  const cur = await classSettings(env, cls.code);
  let next = { ...cur };
  if (has('setting') && b.setting !== cur.setting) {
    if (b.setting === 'private' && b.privateAttest !== true) throw new HttpError(400, 'private_attest_required');
    next = { setting: b.setting, studentAi: 'off', consentAt: null, privateAttestedAt: b.setting === 'private' ? now : null };
  }
  if (b.consent === true) next.consentAt = now;
  if (b.studentAi === 'on') {
    const p = policyOf(env, cls, next);
    if (!p.canTurnOn) throw new HttpError(409, 'class_ai_locked', undefined, { reason: p.reason });
    if (!next.consentAt) throw new HttpError(409, 'consent_needed');
    next.studentAi = 'on';
  } else if (b.studentAi === 'off') next.studentAi = 'off';
  const detail = Object.fromEntries(['studentAi', 'consent', 'setting'].filter(has).map((k) => [k, b[k]]));
  await env.DB.batch([upsert(env, cls.code, next), audit(env, cls, 'class.ai', `class:${cls.code}`, detail, now)]);
  return json({ policy: aiPolicyView(policyOf(env, cls, next), next) }, 200, cors);
}

/**
 * POST /api/teacher/students/:id/ai {off} (requireTeacher): the AI off (or on again) for one student of the class, the
 * Ministry's alternative activity for a student without a parent's consent. 404 for a student of another class. Audit
 * student.ai. → {aiOff}.
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
    audit(env, cls, 'student.ai', `student:${st.id}`, { off: b.off }, now),
  ]);
  return json({ aiOff: b.off }, 200, cors);
}

/** The students of a class the teacher turned the AI off for: a Set of ids. */
export async function aiOffIds(env, code) {
  const r = await env.DB.prepare('SELECT so.student_id FROM student_ai_off so JOIN students s ON s.id = so.student_id WHERE s.class_code = ?').bind(code).all();
  return new Set((r.results || []).map((x) => x.student_id));
}
