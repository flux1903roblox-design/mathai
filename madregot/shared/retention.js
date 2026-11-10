// How long the server keeps a class's data, in days (spec TRUST-7). One place for the numbers: the night purge
// (worker/src/cron.js purgeClassSql), the 400-day guard on progress uploads (worker/src/index.js saveProgress), and the
// words the teacher reads in the class settings and under the help list (web/src/content/retention.js) all read them
// from here, so the code and the copy cannot drift apart. The device keeps its own practice; nothing here touches it.
export const RETENTION = Object.freeze({
  /** A notebook page sent with a help request: this many days after the request is closed, */
  helpImageAfterDone: 30,
  /** and this many days after it was sent at the most, closed or not. */
  helpImageMax: 60,
  /** A help request (and what was written on it): this many days after it is closed, */
  helpAfterDone: 180,
  /** and this many days after it was sent at the most. */
  helpMax: 365,
  /** Practice answers (attempts), counted from the answer. Older ones are not accepted from a device either. */
  attempts: 400,
  /** Exam results, counted from the upload. */
  exams: 400,
  /** An assignment, with what each student did on it, counted from its due date (spec TEACHER-4). */
  assignments: 400,
  /** A student nobody has seen for this many days is deleted with everything they have on the server. */
  idleStudent: 400,
  /** A class with no activity (teacher or student) for this many days and no running licence is deleted. */
  idleClass: 400,
});
