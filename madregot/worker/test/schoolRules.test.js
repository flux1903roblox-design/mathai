// The Ministry of Education's AI rules as one pure function (trust spec TRUST-11 §1): every row of the truth table, the
// old rule (independent use from grade ח׳), and the vars the Worker reads it from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOE_RULES, classAiPolicy, studentAiAllowed, rulesEnv, notSellable, POLICY_REASONS } from '../../shared/schoolRules.js';

const NONE = { approval: 'none', approvedFromGrade: 7 };
const APPROVED = { approval: 'approved', approvedFromGrade: 7 };
const AT = '2026-11-10T08:00:00.000Z';
const policy = (students, canTurnOn, reason, teacherAi) => ({ students, canTurnOn, reason, teacherAi });

test('the rules carry their version and source: the guidelines PDF of January 2026', () => {
  assert.equal(MOE_RULES.version, '2026-01-20');
  assert.match(MOE_RULES.source, /ינואר 2026/);
  assert.equal(MOE_RULES.url, 'https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/AI/Guidelines.pdf');
  assert.equal(MOE_RULES.independentFromGrade, 7);
  assert.deepEqual([...MOE_RULES.teacherOnlyGrades], [5, 6]);
  assert.match(MOE_RULES.consentFormUrl, /^https:\/\/parents\.education\.gov\.il\//);
  assert.match(MOE_RULES.consentPdfUrl, /parents-consent-form-AI\.pdf$/);
  assert.ok(Object.isFrozen(MOE_RULES) && Object.isFrozen(MOE_RULES.teacherOnlyGrades));
});

test('row 1: a school class before the catalogue approval: off whatever the teacher chose, and the teacher only prepares', () => {
  for (const grade of ['7', '8']) {
    for (const consentAt of [null, AT]) {
      for (const studentAi of ['on', 'off']) {
        assert.deepEqual(classAiPolicy({ setting: 'school', grade, studentAi, consentAt }, NONE), policy('off', false, 'not_in_catalogue', 'prep'), `${grade} ${consentAt} ${studentAi}`);
      }
    }
  }
});

test('row 2: approved, but the class is below the grade the approval covers', () => {
  for (const studentAi of ['on', 'off']) {
    assert.deepEqual(classAiPolicy({ setting: 'school', grade: '7', studentAi, consentAt: AT }, { approval: 'approved', approvedFromGrade: 8 }), policy('off', false, 'grade', 'prep'));
  }
});

test('row 3: approved and the grade is covered, no consent yet: off, and the teacher can turn it on after the attestation', () => {
  for (const grade of ['7', '8']) {
    for (const studentAi of ['on', 'off']) {
      assert.deepEqual(classAiPolicy({ setting: 'school', grade, studentAi, consentAt: null }, APPROVED), policy('off', true, 'consent_needed', 'on'));
    }
  }
});

test('row 4: approved, covered, consent recorded, the teacher keeps it off', () => {
  assert.deepEqual(classAiPolicy({ setting: 'school', grade: '8', studentAi: 'off', consentAt: AT }, APPROVED), policy('off', true, 'teacher_off', 'on'));
});

test('row 5: approved, covered, consent recorded and the teacher turned it on: students may use it', () => {
  assert.deepEqual(classAiPolicy({ setting: 'school', grade: '7', studentAi: 'on', consentAt: AT }, APPROVED), policy('on', true, 'ok', 'on'));
});

test('row 6: a private group with no consent yet, whatever the approval: off until the parents agree', () => {
  for (const env of [NONE, APPROVED, { approval: 'approved', approvedFromGrade: 8 }]) {
    for (const studentAi of ['on', 'off']) {
      assert.deepEqual(classAiPolicy({ setting: 'private', grade: '7', studentAi, consentAt: null }, env), policy('off', true, 'consent_needed', 'on'));
    }
  }
});

test('row 7: a private group with consent: the teacher\'s switch decides, before any approval', () => {
  for (const env of [NONE, APPROVED]) {
    assert.deepEqual(classAiPolicy({ setting: 'private', grade: '7', studentAi: 'off', consentAt: AT }, env), policy('off', true, 'teacher_off', 'on'));
    assert.deepEqual(classAiPolicy({ setting: 'private', grade: '7', studentAi: 'on', consentAt: AT }, env), policy('on', true, 'ok', 'on'));
  }
});

test('the old rule (independent use from grade ח׳): grade 7 stays off with reason grade, grade 8 goes on', () => {
  const old = { approval: 'approved', approvedFromGrade: 8 };
  assert.equal(classAiPolicy({ setting: 'school', grade: '7', studentAi: 'on', consentAt: AT }, old).reason, 'grade');
  assert.equal(classAiPolicy({ setting: 'school', grade: '7', studentAi: 'on', consentAt: AT }, old).students, 'off');
  assert.deepEqual(classAiPolicy({ setting: 'school', grade: '8', studentAi: 'on', consentAt: AT }, old), policy('on', true, 'ok', 'on'));
  // an approval can never reach below the rule's own floor of grade ז׳
  assert.equal(classAiPolicy({ setting: 'school', grade: '6', studentAi: 'on', consentAt: AT }, { approval: 'approved', approvedFromGrade: 5 }).reason, 'grade');
});

test('anything missing reads as the safe default: a school class, student AI off, no approval', () => {
  assert.deepEqual(classAiPolicy(), policy('off', false, 'not_in_catalogue', 'prep'));
  assert.deepEqual(classAiPolicy({ grade: '7', studentAi: 'on', consentAt: AT }, {}), policy('off', false, 'not_in_catalogue', 'prep'));
  assert.deepEqual(classAiPolicy({ setting: 'anything', grade: '7', studentAi: 'on', consentAt: AT }, APPROVED), policy('on', true, 'ok', 'on'), 'only "private" is private');
  assert.equal(classAiPolicy({ setting: 'school', grade: 'x', studentAi: 'on', consentAt: AT }, APPROVED).reason, 'grade');
  const seen = new Set();
  for (const setting of ['school', 'private']) for (const env of [NONE, APPROVED, { approval: 'approved', approvedFromGrade: 8 }]) {
    for (const consentAt of [null, AT]) for (const studentAi of ['on', 'off']) seen.add(classAiPolicy({ setting, grade: '7', studentAi, consentAt }, env).reason);
  }
  assert.deepEqual([...seen].sort(), [...POLICY_REASONS].sort(), 'every reason is reachable and listed');
});

test('a student may use the tutor only when the class is on and their own switch is not off', () => {
  const on = policy('on', true, 'ok', 'on');
  assert.equal(studentAiAllowed(on, {}), true);
  assert.equal(studentAiAllowed(on, { aiOff: false }), true);
  assert.equal(studentAiAllowed(on, { aiOff: true }), false);
  assert.equal(studentAiAllowed(policy('off', true, 'teacher_off', 'on'), {}), false);
  assert.equal(studentAiAllowed(undefined, {}), false);
});

test('no AI class licence is sold while the rule keeps students off: not in the catalogue, or a grade it does not cover', () => {
  assert.equal(notSellable(classAiPolicy({ setting: 'school', grade: '7' }, NONE)), true);
  assert.equal(notSellable(classAiPolicy({ setting: 'school', grade: '7' }, { approval: 'approved', approvedFromGrade: 8 })), true);
  assert.equal(notSellable(classAiPolicy({ setting: 'school', grade: '7' }, APPROVED)), false, 'consent comes after the purchase');
  assert.equal(notSellable(classAiPolicy({ setting: 'private', grade: '7' }, NONE)), false);
});

test('the vars: only "approved" approves; the first grade defaults to the rule\'s 7', () => {
  assert.deepEqual(rulesEnv({}), { approval: 'none', approvedFromGrade: 7 });
  assert.deepEqual(rulesEnv({ MOE_AI_APPROVAL: 'none', MOE_AI_FROM_GRADE: '7' }), { approval: 'none', approvedFromGrade: 7 });
  assert.deepEqual(rulesEnv({ MOE_AI_APPROVAL: ' approved ', MOE_AI_FROM_GRADE: '8' }), { approval: 'approved', approvedFromGrade: 8 });
  assert.equal(rulesEnv({ MOE_AI_APPROVAL: 'yes' }).approval, 'none');
  assert.equal(rulesEnv({ MOE_AI_APPROVAL: 'Approved' }).approval, 'none', 'exact value only');
  assert.equal(rulesEnv({ MOE_AI_FROM_GRADE: 'ח' }).approvedFromGrade, 7);
});
