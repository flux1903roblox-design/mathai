// The Ministry of Education's rules for generative AI in schools, as one pure function (spec TRUST-11 §1). The Worker
// decides with it (worker/src/classai.js, entitle.js, the licence and checkout gates, scripts/owner.mjs) and the app's
// pages quote it, so the rule has one source. No network, no database, no clock.
//
// The source: "הנחיות שימוש בכלי בינה מלאכותית יוצרת במערכת החינוך", January 2026 (its version log: 20.1.2026, "הורדת גיל
// שימוש עצמאי בכלים מאושרים מכיתה ח' לכיתה ז'"). From grade 7 students may use approved tools on their own, under the
// teacher's general guidance; grades 5-6 only through the teacher; only tools listed in the educational catalogue; a
// parent's consent first (§4.4), and without it the teacher gives an alternative activity; never a name, an ID number
// or a grade in an AI tool (§5.1). Teachers may use other tools to prepare materials, not in front of the class (§4.2).

export const MOE_RULES = Object.freeze({
  version: '2026-01-20',
  source: 'הנחיות שימוש בכלי בינה מלאכותית יוצרת במערכת החינוך, ינואר 2026, §4.2-4.4',
  url: 'https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/AI/Guidelines.pdf',
  /** ז׳ and up: independent use of approved tools, under the teacher's general guidance. */
  independentFromGrade: 7,
  /** ה׳-ו׳: the teacher operates the tool, with no student identity. */
  teacherOnlyGrades: Object.freeze([5, 6]),
  /** The Ministry's parent consent for AI tools: the parents' portal (needs a parent login) and the printable form. */
  consentFormUrl: 'https://parents.education.gov.il/prhnet/contact-us/confirmations/ai',
  consentPdfUrl: 'https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/AI/parents-consent-form-AI.pdf',
});

/**
 * The owner's switch, read from the Worker's vars: MOE_AI_APPROVAL ("none" until Madregot is in the catalogue, then
 * "approved"; anything else counts as "none") and MOE_AI_FROM_GRADE (the grade the approval starts at; never below the
 * rules' own independentFromGrade).
 */
export function moeEnv(vars = {}) {
  const approval = String(vars.MOE_AI_APPROVAL ?? 'none').trim() === 'approved' ? 'approved' : 'none';
  const n = Number(vars.MOE_AI_FROM_GRADE);
  return { approval, approvedFromGrade: Number.isInteger(n) && n > 0 ? n : MOE_RULES.independentFromGrade };
}

/**
 * What a class's students may do with the AI.
 *   cls = { setting: 'school'|'private', grade: '7'|'8', studentAi: 'on'|'off', consentAt: iso|null }
 *   env = { approval: 'none'|'approved', approvedFromGrade: number }
 *   → { students: 'on'|'off', canTurnOn, reason: 'ok'|'not_in_catalogue'|'grade'|'consent_needed'|'teacher_off', teacherAi: 'prep'|'on' }
 *
 *   setting  approval  grade ≥ from  consent  switch → students  canTurnOn  reason            teacherAi
 *   school   none      any           any      any       off       false      not_in_catalogue  prep
 *   school   approved  no            any      any       off       false      grade             prep
 *   school   approved  yes           none     any       off       true       consent_needed    on
 *   school   approved  yes           given    off       off       true       teacher_off       on
 *   school   approved  yes           given    on        on        true       ok                on
 *   private  any       any           none     any       off       true       consent_needed    on
 *   private  any       any           given    off/on    off/on    true       teacher_off/ok    on
 *
 * Anything missing or unknown fails closed: a setting that is not 'private' is a school, a switch that is not 'on' is
 * off, an approval that is not 'approved' is none. teacherAi 'prep': the teacher may use the AI to prepare materials,
 * never shown to the class.
 */
export function classAiPolicy(cls = {}, env = {}) {
  const school = cls.setting !== 'private';
  const approved = env.approval === 'approved';
  const from = Math.max(Number(env.approvedFromGrade) || MOE_RULES.independentFromGrade, MOE_RULES.independentFromGrade);
  const grade = Number(cls.grade);
  const consent = !!cls.consentAt;
  const on = cls.studentAi === 'on';
  if (school && !approved) return { students: 'off', canTurnOn: false, reason: 'not_in_catalogue', teacherAi: 'prep' };
  if (school && !(Number.isFinite(grade) && grade >= from)) return { students: 'off', canTurnOn: false, reason: 'grade', teacherAi: 'prep' };
  if (!consent) return { students: 'off', canTurnOn: true, reason: 'consent_needed', teacherAi: 'on' };
  if (!on) return { students: 'off', canTurnOn: true, reason: 'teacher_off', teacherAi: 'on' };
  return { students: 'on', canTurnOn: true, reason: 'ok', teacherAi: 'on' };
}

/** May this student use the AI in this class: the class's students are on, and the teacher did not turn it off for them. */
export const studentAiAllowed = (policy, student = {}) => policy?.students === 'on' && !student.aiOff;

/** The reasons a school cannot buy student AI yet (the licence, trial, claim and checkout gates). */
export const NOT_SELLABLE = Object.freeze(['not_in_catalogue', 'grade']);
