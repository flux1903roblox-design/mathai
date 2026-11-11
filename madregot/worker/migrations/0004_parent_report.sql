-- The parent progress report (SUBSCRIPTION.md, "דוח להורים"). Run once with the others: npm run db:migrate
-- Two switches per device: the child's (on the device) and the parent's (on /parents). A summary is stored only while both are on.
ALTER TABLE family_devices ADD COLUMN share_child INTEGER NOT NULL DEFAULT 1 CHECK (share_child IN (0, 1));
ALTER TABLE family_devices ADD COLUMN share_parent INTEGER NOT NULL DEFAULT 1 CHECK (share_parent IN (0, 1));
ALTER TABLE family_devices ADD COLUMN share_at TEXT;
ALTER TABLE family_devices ADD COLUMN summary_sent_at TEXT;
ALTER TABLE accounts ADD COLUMN report_email_at TEXT;

-- One small row per linked device and day. Codes and counts only: no names, no Hebrew, no answers.
CREATE TABLE IF NOT EXISTS family_daily (
  device_id TEXT NOT NULL REFERENCES family_devices (id) ON DELETE CASCADE,
  day TEXT NOT NULL,                                   -- YYYY-MM-DD, the device's day
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 600),
  questions INTEGER NOT NULL DEFAULT 0 CHECK (questions BETWEEN 0 AND 2000),
  lessons INTEGER NOT NULL DEFAULT 0 CHECK (lessons BETWEEN 0 AND 200),
  stages INTEGER NOT NULL DEFAULT 0 CHECK (stages BETWEEN 0 AND 200),
  reviews INTEGER NOT NULL DEFAULT 0 CHECK (reviews BETWEEN 0 AND 200),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak BETWEEN 0 AND 3650),
  worked TEXT NOT NULL DEFAULT '[]' CHECK (length(worked) <= 200),       -- JSON skill ids
  mastered TEXT NOT NULL DEFAULT '[]' CHECK (length(mastered) <= 200),   -- JSON skill ids
  fixes TEXT NOT NULL DEFAULT '[]' CHECK (length(fixes) <= 400),         -- JSON [[skill, id, 'o'|'d']]
  exam TEXT CHECK (exam IS NULL OR length(exam) <= 60),                  -- JSON {d, n, of}
  updated_at TEXT NOT NULL,
  PRIMARY KEY (device_id, day)
);
CREATE INDEX IF NOT EXISTS family_daily_day ON family_daily (day);
