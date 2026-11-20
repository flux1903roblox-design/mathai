// The Ministry of Education's AI rules as one pure function (trust spec TRUST-11 §1): every row of the truth table, the
// old rule (independent use from grade ח׳), and the vars the Worker reads it from. The second half is the teacher lane's
// own table test of the same rule (it built TRUST-11 against this module's names as the safety lane wrote them).
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

// ---------------------------------------------------------------- the teacher lane's tests of the same rule
test('the rules cite the January 2026 guidelines, version 20.1.2026, and the parents\' consent form', () => {
  assert.equal(MOE_RULES.version, '2026-01-20');
  assert.equal(MOE_RULES.independentFromGrade, 7);
  assert.deepEqual([...MOE_RULES.teacherOnlyGrades], [5, 6]);
  assert.match(MOE_RULES.source, /ינואר 2026/);
  assert.match(MOE_RULES.url, /^https:\/\/meyda\.education\.gov\.il\/.*Guidelines\.pdf$/);
  assert.match(MOE_RULES.consentFormUrl, /^https:\/\/parents\.education\.gov\.il\//);
  assert.match(MOE_RULES.consentPdfUrl, /parents-consent-form-AI\.pdf$/);
  assert.ok(Object.isFrozen(MOE_RULES));
});

test('the truth table, row by row', () => {
  const rows = [
    // 1. school, not in the catalogue: off whatever the teacher does, consent or not, grade 7 or 8
    ...['7', '8'].flatMap((grade) => [null, AT].flatMap((consentAt) => ['on', 'off'].map((studentAi) => [
      { setting: 'school', grade, consentAt, studentAi }, NONE, policy('off', false, 'not_in_catalogue', 'prep')]))),
    // 2. school, approved, the grade below the approval's
    [{ setting: 'school', grade: '7', consentAt: AT, studentAi: 'on' }, { approval: 'approved', approvedFromGrade: 8 }, policy('off', false, 'grade', 'prep')],
    // 3. school, approved, grade in: no consent yet
    [{ setting: 'school', grade: '7', consentAt: null, studentAi: 'on' }, APPROVED, policy('off', true, 'consent_needed', 'on')],
    [{ setting: 'school', grade: '8', consentAt: null, studentAi: 'off' }, APPROVED, policy('off', true, 'consent_needed', 'on')],
    // 4. school, approved, consent, the teacher's switch off
    [{ setting: 'school', grade: '7', consentAt: AT, studentAi: 'off' }, APPROVED, policy('off', true, 'teacher_off', 'on')],
    // 5. school, approved, consent, switch on
    [{ setting: 'school', grade: '8', consentAt: AT, studentAi: 'on' }, APPROVED, policy('on', true, 'ok', 'on')],
    // 6. private, no consent: whatever the approval and the grade
    ...[NONE, APPROVED, { approval: 'approved', approvedFromGrade: 8 }].map((env) => [{ setting: 'private', grade: '7', consentAt: null, studentAi: 'on' }, env, policy('off', true, 'consent_needed', 'on')]),
    // 7. private, consent: the teacher's switch decides
    [{ setting: 'private', grade: '7', consentAt: AT, studentAi: 'off' }, NONE, policy('off', true, 'teacher_off', 'on')],
    [{ setting: 'private', grade: '7', consentAt: AT, studentAi: 'on' }, NONE, policy('on', true, 'ok', 'on')],
    [{ setting: 'private', grade: '8', consentAt: AT, studentAi: 'on' }, { approval: 'approved', approvedFromGrade: 8 }, policy('on', true, 'ok', 'on')],
  ];
  for (const [cls, env, want] of rows) assert.deepEqual(classAiPolicy(cls, env), want, JSON.stringify({ cls, env }));
});

test('the old rule (independent use from grade 8): grade 7 is off with reason grade, grade 8 follows consent and the switch', () => {
  const old = { approval: 'approved', approvedFromGrade: 8 };
  assert.deepEqual(classAiPolicy({ setting: 'school', grade: '7', consentAt: AT, studentAi: 'on' }, old), policy('off', false, 'grade', 'prep'));
  assert.deepEqual(classAiPolicy({ setting: 'school', grade: '8', consentAt: AT, studentAi: 'on' }, old), policy('on', true, 'ok', 'on'));
  // an approval "from grade 6" cannot open grade 6 or below: the rules' own floor is grade 7
  assert.equal(classAiPolicy({ setting: 'school', grade: '6', consentAt: AT, studentAi: 'on' }, { approval: 'approved', approvedFromGrade: 6 }).reason, 'grade');
});

test('missing or unknown values fail closed', () => {
  assert.deepEqual(classAiPolicy({}, {}), policy('off', false, 'not_in_catalogue', 'prep'), 'no settings row: a school, off');
  assert.equal(classAiPolicy({ setting: 'other', grade: '8', consentAt: AT, studentAi: 'on' }, { approval: 'yes', approvedFromGrade: 7 }).reason, 'not_in_catalogue');
  assert.equal(classAiPolicy({ setting: 'private', grade: '7', consentAt: AT, studentAi: 'yes' }, NONE).reason, 'teacher_off');
  assert.equal(classAiPolicy({ setting: 'school', grade: null, consentAt: AT, studentAi: 'on' }, APPROVED).reason, 'grade');
});

test('a student turned off by the teacher stays off; notSellable; the vars', () => {
  const on = classAiPolicy({ setting: 'private', grade: '7', consentAt: AT, studentAi: 'on' }, NONE);
  assert.equal(studentAiAllowed(on, {}), true);
  assert.equal(studentAiAllowed(on, { aiOff: true }), false);
  assert.equal(studentAiAllowed(classAiPolicy({}, NONE), {}), false);
  assert.deepEqual(POLICY_REASONS.filter((reason) => notSellable({ reason })), ['not_in_catalogue', 'grade']);
  assert.deepEqual(rulesEnv({}), { approval: 'none', approvedFromGrade: 7 });
  assert.deepEqual(rulesEnv({ MOE_AI_APPROVAL: 'none', MOE_AI_FROM_GRADE: '7' }), { approval: 'none', approvedFromGrade: 7 });
  assert.deepEqual(rulesEnv({ MOE_AI_APPROVAL: 'approved', MOE_AI_FROM_GRADE: '8' }), { approval: 'approved', approvedFromGrade: 8 });
  assert.deepEqual(rulesEnv({ MOE_AI_APPROVAL: 'Approved', MOE_AI_FROM_GRADE: 'x' }), { approval: 'none', approvedFromGrade: 7 });
});
