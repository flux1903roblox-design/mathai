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

-- ---------- the paid AI tutor (accounts, sign-in codes, subscriptions) ----------
-- A parent or teacher account. The email address is the only personal data kept: it receives the sign-in code.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen TEXT
);

-- One pending 6-digit code per address, stored hashed with a salt; it expires and allows a few tries.
CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL
);

-- A signed-in device. Only the token's hash is kept; an account keeps its newest few devices.
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessions_account ON account_sessions (account_id);

-- A family subscription (one parent account) or a class licence (one class code).
-- status: active | past_due (the provider is retrying a payment) | canceled (stops renewing; runs to
-- current_period_end) | ended. provider: manual (granted by the owner) or the payment provider's name.
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  account_id TEXT,
  class_code TEXT,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS subscriptions_account ON subscriptions (account_id);
CREATE INDEX IF NOT EXISTS subscriptions_class ON subscriptions (class_code);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_ref ON subscriptions (provider, provider_ref) WHERE provider_ref IS NOT NULL;

-- Every payment-provider event applied, so a repeated webhook never applies twice.
CREATE TABLE IF NOT EXISTS billing_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  kind TEXT,
  PRIMARY KEY (provider, event_id)
);
