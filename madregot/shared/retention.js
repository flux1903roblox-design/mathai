// How long Madregot keeps each kind of data (trust spec TRUST-1 §4 and TRUST-7, teacher spec TEACHER-4 and TEACHER-9,
// and the periods the family, durable and student lanes set beside their routes, FOLLOWUP-24). One source for every
// purge of the Worker's night job (worker/src/cron.js and the purge builders it names: errors.js, report.js, vault.js,
// push.js, family.js, account.js), the 400-day guard on progress uploads (worker/src/index.js saveProgress), the
// privacy notice's numbers (web/src/content/legal/privacy.md, pinned by worker/test/retention.test.js and
// notice.test.js), the data map's retention texts (worker/datamap.json, which names each key it quotes) and the words
// the teacher and the parents read (web/src/content/retention.js, the family report's copy), so no number is written
// twice and the code and the copy cannot drift apart. worker/test/retention.test.js runs every purge and checks that
// each cutoff it binds is the one named here. Days unless the name says months or years. The privacy notice (and the
// lawyer, TRUST-13) must agree with these numbers. The device keeps its own practice; nothing here touches it.
export const RETENTION = Object.freeze({
  classIdleDays: 400, // a class with no activity (teacher or student) for this long and no running licence is deleted
  studentIdleDays: 400, // a class student nobody has seen for this long is deleted with everything they have on the server
  attemptsDays: 400, // a class student's practice answers on the server; older ones are not accepted from a device either
  examsDays: 400, // exam results kept for the class, counted from the upload
  assignmentsDays: 400, // a teacher's assignment, with what each student did on it, counted from its due date (TEACHER-4)
  helpImageAfterDoneDays: 30, // a help request's notebook page, after the teacher closes the request
  helpImageMaxDays: 60, // ... and at most this long after it was sent, closed or not
  helpAfterDoneDays: 180, // a help request itself, after the teacher closes it
  helpMaxDays: 365, // ... and at most this long after it was sent
  accountIdleDays: 730, // a parent or teacher account with no sign-in and nothing live
  safetyEventsDays: 400, // safety_events rows (counts only: no person, no text)
  answerReportsDays: 60, // a reported AI answer (the tutor's text only)
  licenceRequestAfterHandledDays: 730, // a class licence request, after the owner handled it
  licenceCodeAfterExpiryDays: 365, // a licence code, after it expired
  taxYears: 7, // money records: kept to the end of the 7th calendar year after their tax year
  // the rest of the night purge (cron.js purgeRecordsSql, purgeCountersSql, spec §6.9, STUDENT-4, STUDENT-14)
  noticesDays: 90, // an email notice, after it was sent (or gave up after its tries)
  unpaidOrderDays: 30, // an order that expired unpaid, after it was made
  auditLogDays: 730, // the audit log of actions on money and access
  billingEventsDays: 7 * 365 + 2, // a payment company's event, after it arrived (7 years)
  aiUsageDays: 35, // daily and hourly counters (the tutor's questions, the codes of devices and networks)
  aiUsageMonths: 13, // monthly counters
  aiQualityDays: 400, // the tutor's quality counts (ai_quality, AI-3)
  aiSpendDays: 400, // what the tutor cost, per pool and day or month (ai_spend)
  classStepsDays: 120, // a class student's step toward the class goal (class_steps, STUDENT-4)
  classGoalWeeksDays: 400, // a class goal's week (class_goal_weeks, STUDENT-4)
  metricsDays: 400, // reach counts with no identity (metrics_daily, STUDENT-14)
  // the family and durable lanes (DURABLE-5, DURABLE-6, DURABLE-9, PARENTS-3) and the daily reminder (STUDENT-11)
  clientErrorsDays: 30, // the app's error reports (client_errors), counted from their day
  familyDailyDays: 90, // a linked device's daily summary for the parents (family_daily): the last 90 days, today included
  vaultIdleDays: 400, // an encrypted backup with no write and no read; a deleted backup's tombstone as long
  studentTokenIdleDays: 400, // a class student's device token nobody used
  familyDeviceIdleDays: 365, // a family device nobody used: unlinked and deleted
  familyLinkDays: 1, // a family link code after it expired, and a device row that never collected its token
  sessionIdleDays: 180, // a parent's or teacher's sign-in nobody used (it stops working, and goes)
  pushIdleDays: 45, // a daily reminder whose app was not opened (or, never opened, after it was made)
});
