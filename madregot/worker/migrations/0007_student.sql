-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The student lane's tables. Unreleased: later stages of the lane add theirs to this same file.
-- (The student lane wrote it as 0003_student.sql; renumbered 0007 on the main branch, after 0003_durable, 0004_safety,
-- 0005_teacher and 0006_parent_report. Nothing had applied it yet.)

-- The class goal of the week (STUDENT-4). A "step" is a finished lesson, teaching stage, check or placement (1 point),
-- or a passed mastery check (3 points). Only what the shared total needs: who, which class, which Jerusalem day, how
-- many points. No topic, no answer, no name. Kept 120 days (cron purge); removing a student deletes theirs.
CREATE TABLE IF NOT EXISTS class_steps (
  sid TEXT PRIMARY KEY,                        -- minted on the device (a UUID), so a retry or a second tab counts once
  student_id TEXT NOT NULL,
  class_code TEXT NOT NULL,
  day TEXT NOT NULL,                           -- YYYY-MM-DD in Jerusalem
  pts INTEGER NOT NULL CHECK (pts IN (1, 3)),
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS class_steps_week ON class_steps (class_code, day);
CREATE INDEX IF NOT EXISTS class_steps_student ON class_steps (student_id, day);
-- The week's target, fixed at the week's first read so it never moves mid-week; reached_at is set once. Kept 400 days.
CREATE TABLE IF NOT EXISTS class_goal_weeks (
  class_code TEXT NOT NULL,
  week TEXT NOT NULL,                          -- the Sunday the week starts on (Jerusalem)
  target INTEGER NOT NULL,
  reached_at TEXT,
  PRIMARY KEY (class_code, week)
);
-- The teacher's choice: on or off, and a fixed size (10-400) or NULL for automatic (4 steps per active student).
CREATE TABLE IF NOT EXISTS class_goal_settings (
  class_code TEXT PRIMARY KEY,
  on_flag INTEGER NOT NULL DEFAULT 1,
  target INTEGER,
  updated_at TEXT NOT NULL
);

-- Reach numbers with no tracker (STUDENT-14): how many times a named step happened on a Jerusalem day (an install
-- offered, a landing page seen), and nothing else. No device, address, user agent, account, class or student: the
-- three columns below are the whole table. Kept 400 days (cron purge).
CREATE TABLE IF NOT EXISTS metrics_daily (
  day TEXT NOT NULL,                           -- YYYY-MM-DD in Jerusalem
  name TEXT NOT NULL,                          -- one of metrics.js METRIC_NAMES or SERVER_METRICS
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);

-- The opt-in daily reminder (STUDENT-11): a browser's push address and keys, the hour chosen (16-20, Jerusalem), and
-- three days: when the app was last opened, when a lesson was last finished, when a reminder was last sent. No name,
-- class, account or device id. The id and secret were given to the browser once; only the secret's hash is kept.
-- misses counts reminders ignored in a row (the night step in push.js); 'paused' sends nothing until it is turned on
-- again. Deleted when it is turned off, when the push service says it is gone, or 45 days after the app was last opened.
CREATE TABLE IF NOT EXISTS push_subs (
  id TEXT PRIMARY KEY,                         -- 16 hex, given to the browser
  secret_hash TEXT NOT NULL,                   -- sha256 of the 32-hex secret given to the browser once
  endpoint TEXT NOT NULL UNIQUE,               -- https on an allowed push service (push.js pushEndpointOk)
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 16 AND 20),
  status TEXT NOT NULL DEFAULT 'on' CHECK (status IN ('on', 'paused')),
  created_at TEXT NOT NULL,
  last_seen_day TEXT,                          -- YYYY-MM-DD in Jerusalem
  last_done_day TEXT,
  last_sent_day TEXT,
  misses INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_subs_slot ON push_subs (slot, status);
