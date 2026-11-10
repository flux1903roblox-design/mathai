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

-- Work a teacher gives the class, or chosen students, with a due date (spec TEACHER-4). Dates are YYYY-MM-DD in
-- Jerusalem. Deleted with the class, and by the night purge 400 days after the due date (shared/retention.js).
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,                           -- 16 hex
  class_code TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('stair', 'check', 'exam')),
  skill TEXT CHECK (skill IS NULL OR length(skill) <= 20),       -- '<topic>:<level>' for stair and check
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  exam TEXT CHECK (exam IS NULL OR length(exam) <= 49152),        -- kind 'exam': the frozen questions, JSON
  version TEXT CHECK (version IS NULL OR version IN ('a', 'b')),  -- kind 'exam': which printed version was sent
  for_all INTEGER NOT NULL DEFAULT 1 CHECK (for_all IN (0, 1)),
  starts_on TEXT NOT NULL,                       -- YYYY-MM-DD, Jerusalem
  due_on TEXT NOT NULL,                          -- YYYY-MM-DD, Jerusalem
  created_at TEXT NOT NULL,
  CHECK ((kind = 'exam') = (exam IS NOT NULL)),
  CHECK (kind = 'exam' OR skill IS NOT NULL),
  CHECK (due_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS assignments_class ON assignments (class_code, due_on);
CREATE INDEX IF NOT EXISTS assignments_due ON assignments (due_on);

-- The students an assignment is for, when it is not for the whole class.
CREATE TABLE IF NOT EXISTS assignment_targets (
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  PRIMARY KEY (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS assignment_targets_student ON assignment_targets (student_id);

-- What each student did on it. Results are worked out on the student's device: practice, not a graded test.
CREATE TABLE IF NOT EXISTS assignment_work (
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('started', 'done')),
  stage INTEGER CHECK (stage IS NULL OR stage BETWEEN 0 AND 5),           -- stair: stages done
  right_n INTEGER CHECK (right_n IS NULL OR right_n BETWEEN 0 AND 40),    -- check and exam: first finished try
  asked INTEGER CHECK (asked IS NULL OR asked BETWEEN 1 AND 40),
  passed INTEGER CHECK (passed IS NULL OR passed IN (0, 1)),             -- stair and check: the mastery check passed
  questions TEXT CHECK (questions IS NULL OR length(questions) <= 4096), -- exam: [{"topic","level","status"}]
  tries INTEGER NOT NULL DEFAULT 0 CHECK (tries BETWEEN 0 AND 99),       -- finished tries
  started_at TEXT NOT NULL,
  done_at TEXT,
  done_day TEXT,                                 -- YYYY-MM-DD in Jerusalem (dayOf at the first 'done'): compared with due_on
  updated_at TEXT NOT NULL,
  PRIMARY KEY (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS assignment_work_student ON assignment_work (student_id);
-- New values elsewhere (no table change):
--   audit_log.action  'assignment.create' (detail {kind, skill, targets}) | 'assignment.update' | 'assignment.delete'
--                     (target assignment:<id>)
--   ai_usage.who      assign:c:<class> (assignments made a day)  work:s:<student> (work reports a day)

-- Replies on a help request, from the teacher and the student, a few lines each, about that exercise (spec TEACHER-6).
-- Three a side, plain text with no link, email address or phone number (worker/src/help.js checks), the student only
-- after the teacher. Deleted with the request: by the student's rows (forget.js STUDENT_ROWS, before help_requests) and
-- by the night purge, which removes the messages of a request it deleted (cron.js).
CREATE TABLE IF NOT EXISTS help_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  help_id INTEGER NOT NULL,
  from_role TEXT NOT NULL CHECK (from_role IN ('teacher', 'student')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL,
  read_at TEXT                                   -- when the other side opened it
);
CREATE INDEX IF NOT EXISTS help_messages_help ON help_messages (help_id, id);
-- New values elsewhere (no table change):
--   audit_log.action  'help.reply' (target help:<id>, detail {} : never the text) | 'class.digest' (detail {on})
--   notices.kind      'help_digest:<YYYY-MM-DD>' (ref = the class code, to_account = the owner, params {className, n})
--   ai_usage.who      helpreply:s:<student> (a student's replies a day)  report:c:<class> (hourly: the class report)

-- The students a teacher turned the AI off for (spec TRUST-11 §2): the Ministry's "alternative activity" for a student
-- without a parent's consent, or the teacher's choice. A row means off, in a class whose students otherwise have it.
-- Deleted with the student (forget.js STUDENT_ROWS: teacher removal, class delete, the night purge).
CREATE TABLE IF NOT EXISTS student_ai_off (
  student_id TEXT PRIMARY KEY,
  at TEXT NOT NULL
);
-- New values elsewhere (no table change):
--   class_settings  setting 'private' only with private_attested_at (the teacher said the group is not a school's);
--                   student_ai and ai_consent_at follow shared/schoolRules.js (POST /api/teacher/class/ai)
--   audit_log.action  'class.setting' (detail {setting}) | 'class.ai' (detail {studentAi?, consent?, setting?})
--                     | 'student.ai' (target student:<id>, detail {off})
--   ai_usage.who      aioff:c:<class> (a day: student AI requests refused because the class's AI is off)
