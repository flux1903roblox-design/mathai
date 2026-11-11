-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The student lane's tables. Unreleased: later stages of the lane add theirs to this same file.
-- If another lane's 0003 is merged first, renumber this file to the next free number.

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
