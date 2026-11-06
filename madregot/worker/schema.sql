-- Madregot D1 schema. Safe to run more than once.
CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  teacher_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  class_code TEXT NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen TEXT,
  UNIQUE (class_code, name)
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  level INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  first_try INTEGER NOT NULL,
  hint INTEGER NOT NULL,
  cat TEXT,
  secs INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_student_day ON attempts (student_id, day);

CREATE TABLE IF NOT EXISTS levels (
  student_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, topic)
);

CREATE TABLE IF NOT EXISTS help_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  topic TEXT,
  level INTEGER,
  question TEXT,
  answer TEXT,
  note TEXT,
  image TEXT, -- optional JPEG data URL of the student's notebook page
  created_at TEXT NOT NULL,
  seen_at TEXT,
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS help_student ON help_requests (student_id);

CREATE TABLE IF NOT EXISTS ai_usage (
  who TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (who, day)
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  title TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  questions TEXT NOT NULL, -- JSON: [{ topic, status, skill }]
  weak TEXT NOT NULL,      -- JSON: [topic ids]
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS exams_student ON exams (student_id);
