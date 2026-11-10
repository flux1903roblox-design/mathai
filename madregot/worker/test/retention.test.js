// The retention numbers have one home, shared/retention.js: the purge jobs, the privacy page and the teacher's screen
// read them from there, so a number is never written twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETENTION } from '../../shared/retention.js';

test('RETENTION holds the numbers of the trust spec (TRUST-1 §4), and cannot be changed at run time', () => {
  assert.deepEqual({ ...RETENTION }, {
    classIdleDays: 400, attemptsDays: 400, examsDays: 400, helpImageAfterDoneDays: 30, helpImageMaxDays: 60,
    helpAfterDoneDays: 180, helpMaxDays: 365, accountIdleDays: 730, safetyEventsDays: 400, answerReportsDays: 60,
    licenceRequestAfterHandledDays: 730, licenceCodeAfterExpiryDays: 365, taxYears: 7,
  });
  assert.ok(Object.isFrozen(RETENTION));
  assert.throws(() => { 'use strict'; RETENTION.accountIdleDays = 1; }, TypeError);
  for (const [k, v] of Object.entries(RETENTION)) assert.ok(Number.isInteger(v) && v > 0, k);
  assert.ok(RETENTION.helpImageAfterDoneDays <= RETENTION.helpImageMaxDays && RETENTION.helpAfterDoneDays <= RETENTION.helpMaxDays);
});
