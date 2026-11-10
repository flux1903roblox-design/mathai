// The Ministry of Education's rules for generative AI in schools, as one pure function (trust spec TRUST-11 §1). The
// Worker uses it to decide whether a class student may reach the AI tutor, whether a teacher may turn the tutor on for
// the class, and whether an AI class licence may be sold; the landing page reads its AI line from here too, so the rule
// has one source.
//
// What the January 2026 guidelines say (version log 20.1.2026, §4.2-4.4): from grade ז׳ students may use approved AI
// tools on their own, under the teacher's general guidance; in grades ה׳-ו׳ only the teacher operates the tool; a tool
// is approved when it is in the Ministry's educational catalogue; parents' consent is needed from grade ד׳, and without
// it the teacher gives the student another activity; nothing identifying goes into the tool (§5.1). Madregot is not in
// the catalogue yet: the owner flips MOE_AI_APPROVAL to "approved" when it is (TRUST-14).
//
// A private group (lessons at home, a club, extra tuition outside any school) is not a school setting: its teacher
// attests to that, and the parents' consent is still needed before students use the tutor.

export const MOE_RULES = Object.freeze({
  version: '2026-01-20',
  source: 'הנחיות שימוש בכלי בינה מלאכותית יוצרת במערכת החינוך, ינואר 2026, §4.2-4.4',
  url: 'https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/AI/Guidelines.pdf',
  independentFromGrade: 7, // ז׳ and up: independent use of approved tools, under the teacher's general guidance
  teacherOnlyGrades: Object.freeze([5, 6]), // teacher-operated, no student identity
  // the Ministry's parent consent form for AI tools: on the parents' portal (needs a parent's login), and to print
  consentFormUrl: 'https://parents.education.gov.il/prhnet/contact-us/confirmations/ai',
  consentPdfUrl: 'https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/AI/parents-consent-form-AI.pdf',
});

/** Why student AI is on or off in a class: the order the checks run in. */
export const POLICY_REASONS = Object.freeze(['not_in_catalogue', 'grade', 'consent_needed', 'teacher_off', 'ok']);

/**
 * The approval in force, from the Worker's vars: MOE_AI_APPROVAL ("approved" once Madregot is in the catalogue; anything
 * else, or nothing, is "none") and MOE_AI_FROM_GRADE (the first grade the approval covers; never below the rule's 7).
 */
export function rulesEnv(vars = {}) {
  const from = Number.parseInt(String(vars.MOE_AI_FROM_GRADE ?? ''), 10);
  return {
    approval: String(vars.MOE_AI_APPROVAL ?? '').trim() === 'approved' ? 'approved' : 'none',
    approvedFromGrade: Number.isInteger(from) ? from : MOE_RULES.independentFromGrade,
  };
}

/**
 * Student AI in one class.
 *   cls = { setting: 'school'|'private', grade: '7'|'8', studentAi: 'on'|'off', consentAt: iso|null }
 *   env = { approval: 'none'|'approved', approvedFromGrade: number }
 * → { students: 'on'|'off', canTurnOn: boolean, reason, teacherAi: 'prep'|'on' }
 *
 * Anything missing reads as the safe default: a school class, student AI off, no consent, no approval.
 * `canTurnOn` is true when the teacher may turn student AI on (after the consent attestation, when it is missing).
 * `teacherAi: 'prep'` means the teacher may use the tutor only to prepare materials (allowed for tools outside the
 * catalogue, §4.2 "דגשים למורים"), never shown to the class.
 */
export function classAiPolicy(cls = {}, env = {}) {
  const school = cls?.setting !== 'private';
  if (school) {
    if (env?.approval !== 'approved') return { students: 'off', canTurnOn: false, reason: 'not_in_catalogue', teacherAi: 'prep' };
    const from = Math.max(MOE_RULES.independentFromGrade, Number.isFinite(Number(env.approvedFromGrade)) ? Number(env.approvedFromGrade) : 0);
    if (!(Number(cls?.grade) >= from)) return { students: 'off', canTurnOn: false, reason: 'grade', teacherAi: 'prep' };
  }
  if (!cls?.consentAt) return { students: 'off', canTurnOn: true, reason: 'consent_needed', teacherAi: 'on' };
  if (cls?.studentAi !== 'on') return { students: 'off', canTurnOn: true, reason: 'teacher_off', teacherAi: 'on' };
  return { students: 'on', canTurnOn: true, reason: 'ok', teacherAi: 'on' };
}

/** May this student reach the tutor in their class? Only when the class's student AI is on and theirs is not off. */
export const studentAiAllowed = (policy, student) => policy?.students === 'on' && !student?.aiOff;

/** The policy reasons under which no AI class licence may be sold to the class (TRUST-11 §5). */
export const notSellable = (policy) => policy?.reason === 'not_in_catalogue' || policy?.reason === 'grade';
