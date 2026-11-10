// How long Madregot keeps each kind of data (trust spec TRUST-1 §4 and TRUST-7, teacher spec TEACHER-4 and TEACHER-9).
// One source for the Worker's purge jobs (worker/src/cron.js), the 400-day guard on progress uploads (worker/src/index.js
// saveProgress), the privacy page and the words the teacher reads in the class settings and under the help list
// (web/src/content/retention.js), so no number is written twice and the code and the copy cannot drift apart. Days
// unless the name says years. The privacy notice (and the lawyer, TRUST-13) must agree with these numbers. The device
// keeps its own practice; nothing here touches it.
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
});
