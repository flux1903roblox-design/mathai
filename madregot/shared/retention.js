// How long Madregot keeps each kind of data (trust spec TRUST-1 §4 and TRUST-7). One source for the Worker's purge
// jobs, the privacy page and the teacher's "how long we keep it" screen, so no number is written twice. Days unless the
// name says years. The privacy notice (and the lawyer, TRUST-13) must agree with these numbers.
export const RETENTION = Object.freeze({
  classIdleDays: 400, // a class with no activity for this long is deleted with its students' records
  attemptsDays: 400, // a class student's practice answers on the server
  examsDays: 400, // exam results kept for the class
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
