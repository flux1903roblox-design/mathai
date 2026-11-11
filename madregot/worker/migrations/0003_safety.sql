-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The trust lane's one migration (trust spec §0.3): new side tables and indexes only, never an ALTER TABLE on an
-- existing table, so schema.sql carries the same text and still runs twice. Until this file is deployed, the lane's
-- later tables are added here too.

-- Safety events: counts with no content (trust spec TRUST-4 §4.4). A row says what happened, on which surface and how it
-- was noticed, on a Jerusalem day with no time of day. There is no student, device, account, class or text column, so a
-- row can never point to a person or hold what anyone wrote. Written by recordSafety (src/safety.js); kept for
-- RETENTION.safetyEventsDays (shared/retention.js).
CREATE TABLE IF NOT EXISTS safety_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,                                   -- YYYY-MM-DD Jerusalem; no time of day
  kind TEXT NOT NULL CHECK (kind IN ('distress','pii_masked','output_blocked','link_removed','refusal','user_report','class_ai_off','parent_ok_needed','photo_redacted')),
  category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 20),
  surface TEXT NOT NULL CHECK (surface IN ('chat','explain','check','exam','generate','feedback','help_note','photo')),
  source TEXT NOT NULL CHECK (source IN ('regex','model','client','server')),
  tier TEXT NOT NULL DEFAULT '' CHECK (length(tier) <= 10)
);
CREATE INDEX IF NOT EXISTS safety_events_day ON safety_events (day);

-- What a help request is (trust spec TRUST-3), beside help_requests: kind 'help' (a question about an exercise) or 'talk'
-- (the child asked the teacher to talk, with no text), and care = 1 when the note the child chose to send reads as
-- distress. A request with no row here is kind 'help', care 0. The row goes with its request.
CREATE TABLE IF NOT EXISTS help_meta (
  help_id INTEGER PRIMARY KEY REFERENCES help_requests (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'help' CHECK (kind IN ('help','talk')),
  care INTEGER NOT NULL DEFAULT 0 CHECK (care IN (0,1))
);

-- An AI answer a child reported (trust spec TRUST-4 §4.5): why, on which surface, and the tutor's own text only, with
-- personal details masked on the server and at most 4,000 characters. Never the child's message, never who sent it.
-- Written by POST /api/ai/report (at most 10 a day from one child or device); read with npm run owner -- reports;
-- kept for RETENTION.answerReportsDays (shared/retention.js).
CREATE TABLE IF NOT EXISTS answer_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('wrong_math','not_nice','not_for_kids','other')),
  kind TEXT NOT NULL CHECK (kind IN ('chat','explain','check','exam','generate','feedback')),
  reply TEXT NOT NULL CHECK (length(reply) <= 4000),
  tier TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS answer_reports_created ON answer_reports (created_at);

-- The Ministry of Education's AI rules per class (trust spec TRUST-11 §2; shared/schoolRules.js is the rule). The same
-- table as the teacher lane's TRUST-7 class_settings, word for word, so either lane can land first. A class with no row
-- is: school, student AI off, no consent, last_seen = its created_at. setting 'private' needs the teacher's attestation
-- (private_attested_at); ai_consent_at is when the teacher said the parents agreed. Written by POST /api/classes and
-- POST /api/teacher/class/ai (src/classai.js), each change audited as class.setting or class.ai.
CREATE TABLE IF NOT EXISTS class_settings (
  code TEXT PRIMARY KEY,
  setting TEXT NOT NULL DEFAULT 'school' CHECK (setting IN ('school','private')),
  student_ai TEXT NOT NULL DEFAULT 'off' CHECK (student_ai IN ('on','off')),
  ai_consent_at TEXT,
  private_attested_at TEXT,               -- TRUST-11: the teacher said the group is not part of a school
  last_seen TEXT                           -- YYYY-MM-DD: the teacher's dashboard or any student activity, written at most daily
);

-- One class student whose tutor the teacher turned off (TRUST-11 §3, the Ministry's "alternative activity" for a student
-- without the parents' consent): the student keeps all practice without AI. No row: the class's switch decides. Deleted
-- with the student.
CREATE TABLE IF NOT EXISTS student_ai_off (student_id TEXT PRIMARY KEY, at TEXT NOT NULL);

-- How the tutor's answers fared (ai spec AI-3 Design 6): counts only, one row per Jerusalem day, kind and reason. A reply
-- whose final answer the guard masked (answer_masked), a streamed reply that came back empty (empty_stream), and the
-- generated exercises code dropped (gen_*, AI-4). No person, device, pool or text column. Written by bumpQuality
-- (src/quality.js) with an upsert; read by the owner's daily summary; kept 400 days (cron.js purgeCountersSql).
CREATE TABLE IF NOT EXISTS ai_quality (
  day TEXT NOT NULL,                                   -- YYYY-MM-DD Jerusalem
  kind TEXT NOT NULL CHECK (kind IN ('explain','chat','check','generate')),
  reason TEXT NOT NULL CHECK (reason IN ('answer_masked','empty_stream','gen_kept','gen_latex','gen_numbers','gen_leak','gen_solution','gen_equations','gen_blind','gen_all_failed','blind_skipped')),
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, reason)
);

-- An order that renews a one-year plan (trust spec TRUST-10 §3): a renewal is a new consent, so it is an order of its
-- own, and this row says which plan it renews and the year that plan was paid for (prev_start, prev_end). Written in
-- the same batch as the order. On payment the plan runs to prev_end + 12 months; a cooling-off refund of the renewal
-- puts the plan back to prev_start-prev_end, still active. Goes with its order (an expired order is purged after 30 days).
CREATE TABLE IF NOT EXISTS order_renewals (
  order_id TEXT PRIMARY KEY REFERENCES orders (id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES subscriptions (id),
  prev_start TEXT NOT NULL,
  prev_end TEXT NOT NULL
);
