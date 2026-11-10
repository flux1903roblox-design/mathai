-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The teacher and school lane (one file for the lane until it is deployed; renumber it if another lane's migration
-- lands with this number first). Only new tables, never an ALTER.
--
-- A class follows its teacher's email: the account that may open it with a sign-in instead of the teacher key.
-- At most 20 classes per account. The key keeps working beside it (co-teachers, devices without email) until the owner
-- replaces it. Deleting the account deletes these rows (the code does it; the foreign key only documents it).
CREATE TABLE IF NOT EXISTS class_owners (
  class_code TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  bound_at TEXT NOT NULL,
  help_digest INTEGER NOT NULL DEFAULT 0 CHECK (help_digest IN (0, 1))   -- TEACHER-6: one email a day, counts only
);
CREATE INDEX IF NOT EXISTS class_owners_account ON class_owners (account_id);
-- New values elsewhere (no table change):
--   audit_log.action  'class.owner' (a class bound to an account) | 'class.rekey' (the owner made a new teacher key);
--                     a teacher action taken with the account credential adds {"via":"account"} to detail
--   notices.kind      'class_rekeyed:<YYYY-MM-DDTHH:mm>' (ref = the class code, to_account = the owner)
--   ai_usage.who      tclasses:a:<account> (hourly: the owner's class list)
--   audit_log.action  'class.rename' | 'class.delete' (target class:<code>, detail {"students": n})

-- Per-class settings and activity (spec TRUST-7 §1; the trust lane's TRUST-11 fills setting, student_ai and the consent
-- fields). A class with no row is: school, student AI off, no consent, last_seen = its created_at.
CREATE TABLE IF NOT EXISTS class_settings (
  code TEXT PRIMARY KEY,
  setting TEXT NOT NULL DEFAULT 'school' CHECK (setting IN ('school','private')),
  student_ai TEXT NOT NULL DEFAULT 'off' CHECK (student_ai IN ('on','off')),
  ai_consent_at TEXT,
  private_attested_at TEXT,               -- TRUST-11: the teacher said the group is not part of a school
  last_seen TEXT                           -- YYYY-MM-DD: the teacher's dashboard or any student activity, written at most daily
);
-- What the night purge looks up by date (shared/retention.js holds the periods).
CREATE INDEX IF NOT EXISTS help_done ON help_requests (done_at);
CREATE INDEX IF NOT EXISTS help_created ON help_requests (created_at);
CREATE INDEX IF NOT EXISTS attempts_at ON attempts (at);
CREATE INDEX IF NOT EXISTS exams_created ON exams (created_at);
CREATE INDEX IF NOT EXISTS students_last_seen ON students (last_seen);
