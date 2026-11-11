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

-- ---------- the paid AI tutor (replaces the block committed in 5117e5b, which was never deployed) ----------
-- This file is the reference schema and what the tests load. Real databases change only through worker/migrations/.

-- studentFrom() looks students up by token on every request.
CREATE INDEX IF NOT EXISTS students_token ON students (token_hash);
-- the daily clean-up deletes old counters by day
CREATE INDEX IF NOT EXISTS ai_usage_day ON ai_usage (day);

-- A class closed to new names by its teacher. Students already in the class still sign in with their PIN.
CREATE TABLE IF NOT EXISTS class_locks (
  class_code TEXT PRIMARY KEY,
  locked_at TEXT NOT NULL
);

-- A payer: a parent, or a teacher who buys or asks for a class licence. The email is the only personal detail.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,                         -- 16 hex characters
  email TEXT NOT NULL UNIQUE,                  -- trimmed, NFKC, lower-case
  created_at TEXT NOT NULL,
  last_seen TEXT,                              -- a day (YYYY-MM-DD) is enough
  adult_confirmed_at TEXT,                     -- ticked "18+ and the parent or guardian" at checkout
  terms_version TEXT,                          -- the terms accepted at checkout, e.g. '2026-11'
  billing_hold_at TEXT                         -- set by a chargeback: no new checkout until the owner clears it
);

-- One pending sign-in code per address, keyed by an HMAC so an address that never signs in is never stored.
CREATE TABLE IF NOT EXISTS login_codes (
  email_hash TEXT PRIMARY KEY,                 -- HMAC-SHA256(AUTH_SECRET, email), hex
  code_hash TEXT NOT NULL,                     -- HMAC-SHA256(AUTH_SECRET, email_hash || ':' || code), hex
  expires_at TEXT NOT NULL,                    -- sent_at + 10 minutes
  tries INTEGER NOT NULL DEFAULT 0 CHECK (tries BETWEEN 0 AND 5),
  sent_at TEXT NOT NULL
);

-- A parent's or teacher's signed-in browser. Never a child's device: those get family_devices tokens.
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,                 -- SHA-256 of the 64-hex token sent as X-Account-Token
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,                     -- written at most once an hour; unused for 180 days = signed out
  verified_at TEXT NOT NULL                    -- when the code behind this session was entered (step-up for deletion)
);
CREATE INDEX IF NOT EXISTS account_sessions_account ON account_sessions (account_id);

-- A child's device linked to a family subscription. Its token (X-Family-Device) works for the AI routes only.
CREATE TABLE IF NOT EXISTS family_devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE,                      -- SHA-256 of the token; NULL until the device collects it
  label TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 30),   -- optional, chosen by the parent ('הטאבלט')
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL                      -- YYYY-MM-DD
);
CREATE INDEX IF NOT EXISTS family_devices_account ON family_devices (account_id);

-- A pending link: the child's device shows the code, a signed-in parent claims it, the device collects its token.
CREATE TABLE IF NOT EXISTS link_codes (
  code_hash TEXT PRIMARY KEY,                  -- HMAC-SHA256(AUTH_SECRET, the 6-character code)
  secret_hash TEXT NOT NULL,                   -- SHA-256 of the 32-hex secret only the child's device knows
  device_hint TEXT,                            -- always NULL: nothing read it, so the device is no longer recorded here
  account_id TEXT REFERENCES accounts (id) ON DELETE CASCADE,    -- set on claim
  device_id TEXT REFERENCES family_devices (id) ON DELETE CASCADE, -- the row made on claim
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,                    -- created_at + 60 minutes
  claimed_at TEXT,
  collected_at TEXT                            -- the device took its token; the code is spent
);
CREATE INDEX IF NOT EXISTS link_codes_expires ON link_codes (expires_at);

-- A checkout, priced on the server. The client sends a plan id, never an amount.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                         -- 16 hex; our reference at the provider
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  plan TEXT NOT NULL CHECK (plan IN ('family_month', 'family_year', 'class_year')),
  class_code TEXT,                             -- class_year only, checked with the teacher key when the order is made
  seats INTEGER CHECK (seats IS NULL OR seats BETWEEN 10 AND 45),  -- class_year only: the price is seats x the seat price
  amount_agorot INTEGER NOT NULL CHECK (amount_agorot > 0),   -- VAT included, copied from the price var
  vat_agorot INTEGER NOT NULL CHECK (vat_agorot >= 0 AND vat_agorot < amount_agorot),
  currency TEXT NOT NULL DEFAULT 'ILS' CHECK (currency = 'ILS'),
  provider TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  provider_checkout_id TEXT,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 64),
  status TEXT NOT NULL CHECK (status IN ('open', 'paid', 'expired')),
  subscription_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,                    -- created_at + 2 hours
  paid_at TEXT,
  UNIQUE (account_id, idempotency_key),
  CHECK ((plan = 'class_year') = (class_code IS NOT NULL AND seats IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS orders_open ON orders (status, expires_at);

-- A family subscription (one parent account, up to 3 linked devices) or a class licence (one class code).
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('family', 'class')),
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,  -- family: the payer; class: the buyer, or NULL for an invoice grant
  class_code TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('family_month', 'family_year', 'class_year', 'term', 'trial')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'ended')),
  provider TEXT NOT NULL,                      -- 'manual' | 'test' | the chosen provider
  provider_subscription_id TEXT,               -- recurring plans at the provider
  price_agorot INTEGER CHECK (price_agorot IS NULL OR price_agorot > 0),  -- per period, VAT included; NULL for grants
  seats INTEGER CHECK (seats IS NULL OR seats BETWEEN 1 AND 60),         -- class licences
  invoice_ref TEXT CHECK (invoice_ref IS NULL OR length(invoice_ref) <= 40),
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  cancel_requested_at TEXT,                    -- the moment the payer gave notice: the legal time of cancellation, set once
  cancel_synced_at TEXT,                       -- the provider confirmed it will not charge again
  first_paid_at TEXT,
  refund_until TEXT,                           -- full refund on request until then (first payment + 14 days)
  ended_reason TEXT CHECK (ended_reason IS NULL OR ended_reason IN ('canceled', 'refunded', 'payment_failed', 'chargeback', 'owner', 'account_deleted', 'expired')),
  last_event_at TEXT,                          -- occurred_at of the newest provider event applied
  note TEXT CHECK (note IS NULL OR length(note) <= 120),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((kind = 'family' AND class_code IS NULL) OR (kind = 'class' AND class_code IS NOT NULL AND seats IS NOT NULL)),
  CHECK (current_period_end > current_period_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub ON subscriptions (provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
-- never two renewing plans for one family, or two running licences for one class
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_live_family ON subscriptions (account_id) WHERE kind = 'family' AND status IN ('active', 'past_due');
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_live_class ON subscriptions (class_code) WHERE kind = 'class' AND status IN ('active', 'past_due');
CREATE INDEX IF NOT EXISTS subscriptions_account ON subscriptions (account_id, kind, status);
CREATE INDEX IF NOT EXISTS subscriptions_class ON subscriptions (class_code, status);
CREATE INDEX IF NOT EXISTS subscriptions_due ON subscriptions (status, current_period_end);
CREATE INDEX IF NOT EXISTS subscriptions_cancel_unsynced ON subscriptions (cancel_requested_at) WHERE cancel_requested_at IS NOT NULL AND cancel_synced_at IS NULL;

-- Money that moved, in integer agorot. No card numbers, tokens, names or phones.
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('charge', 'refund', 'chargeback')),
  subscription_id TEXT REFERENCES subscriptions (id),
  order_id TEXT REFERENCES orders (id),
  amount_agorot INTEGER NOT NULL,              -- a charge > 0; a refund or chargeback < 0
  currency TEXT NOT NULL DEFAULT 'ILS' CHECK (currency = 'ILS'),
  status TEXT NOT NULL CHECK (status IN ('ok', 'duplicate', 'after_cancel')),  -- duplicate / after_cancel: refunded automatically
  period_end TEXT,
  invoice_url TEXT,                            -- the provider's tax invoice or receipt
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  CHECK ((kind = 'charge') = (amount_agorot > 0)),
  UNIQUE (provider, provider_payment_id, kind)
);
CREATE INDEX IF NOT EXISTS payments_subscription ON payments (subscription_id, occurred_at);

-- Every provider event, once. The primary key is the first statement of each apply batch, so a repeat aborts it.
CREATE TABLE IF NOT EXISTS billing_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,                      -- the provider's event id; without one, SHA-256(payment id || ':' || status)
  type TEXT NOT NULL,                          -- paid | failed | canceled | refunded | chargeback
  outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'duplicate_payment', 'after_cancel', 'ignored_old', 'unknown', 'mismatch', 'test_mode')),
  subscription_id TEXT,
  amount_agorot INTEGER,
  detail TEXT NOT NULL DEFAULT '' CHECK (length(detail) <= 200),  -- a reason only: never a payload, name, phone or card data
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  PRIMARY KEY (provider, event_id)
);

-- Refunds to make: automatic ones the provider API does, and the ones the owner must do by hand.
CREATE TABLE IF NOT EXISTS refund_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id TEXT NOT NULL REFERENCES subscriptions (id),
  payment_id TEXT REFERENCES payments (id),    -- the charge to refund
  amount_agorot INTEGER NOT NULL CHECK (amount_agorot > 0),
  reason TEXT NOT NULL CHECK (reason IN ('cooling_off', 'prorata', 'duplicate', 'after_cancel', 'owner')),
  requested_at TEXT NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  manual INTEGER NOT NULL DEFAULT 0,           -- 1: the provider has no refund API; the owner refunds in its dashboard
  done_at TEXT,
  result TEXT NOT NULL DEFAULT '' CHECK (length(result) <= 200)
);
CREATE INDEX IF NOT EXISTS refund_queue_open ON refund_queue (done_at, requested_at);
-- At most one cooling-off and one pro-rata refund per plan, whatever two cancel requests do at the same moment
-- (added by migration 0002).
CREATE UNIQUE INDEX IF NOT EXISTS refund_queue_once ON refund_queue (subscription_id, reason) WHERE reason IN ('cooling_off', 'prorata');

-- An outbox of service emails: written in the same batch as the change it reports, sent after, retried by the cron.
CREATE TABLE IF NOT EXISTS notices (
  ref TEXT NOT NULL,                           -- a subscription, account, device or request id
  kind TEXT NOT NULL,                          -- 'welcome' | 'canceled' | 'refunded' | 'payment_failed:<period_end>' | 'renewal_reminder:<period_end>'
                                               -- | 'device_linked:<device>' | 'licence_ending:<until>' | 'owner:<what>' ...
  to_account TEXT,                             -- the recipient; NULL = the owner (OWNER_EMAIL)
  params TEXT NOT NULL DEFAULT '{}',           -- template values (dates, amounts, labels); never a code or card data
  created_at TEXT NOT NULL,
  sent_at TEXT,
  tries INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ref, kind)
);
CREATE INDEX IF NOT EXISTS notices_pending ON notices (created_at) WHERE sent_at IS NULL;

-- A teacher's request for a class trial or a school quote (the owner answers by email and grants with npm run owner).
CREATE TABLE IF NOT EXISTS licence_requests (
  id TEXT PRIMARY KEY,
  class_code TEXT NOT NULL,
  account_id TEXT REFERENCES accounts (id) ON DELETE CASCADE,   -- the teacher's verified email
  wants TEXT NOT NULL CHECK (wants IN ('trial', 'quote')),
  school TEXT NOT NULL CHECK (length(school) BETWEEN 1 AND 80),
  classes INTEGER NOT NULL DEFAULT 1 CHECK (classes BETWEEN 1 AND 30),
  students INTEGER CHECK (students IS NULL OR students BETWEEN 1 AND 45),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  created_at TEXT NOT NULL,
  handled_at TEXT
);
CREATE INDEX IF NOT EXISTS licence_requests_open ON licence_requests (handled_at, created_at);
CREATE INDEX IF NOT EXISTS licence_requests_class ON licence_requests (class_code, wants);

-- A school licence paid by invoice: one code, shown once to the owner, that teachers enter to attach their classes.
CREATE TABLE IF NOT EXISTS licence_codes (
  code_hash TEXT PRIMARY KEY,                  -- SHA-256 of the 12-character code
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 60),         -- per class
  classes_left INTEGER NOT NULL CHECK (classes_left >= 0),
  until TEXT NOT NULL,                         -- the licences end on this date
  invoice_ref TEXT CHECK (invoice_ref IS NULL OR length(invoice_ref) <= 40),
  note TEXT CHECK (note IS NULL OR length(note) <= 120),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL                     -- the code itself: created_at + 60 days
);

-- What Claude really cost, from each response's usage, per pool and period.
CREATE TABLE IF NOT EXISTS ai_spend (
  pool TEXT NOT NULL,                          -- 'fam:<account>' | 'cls:<code>' | 'free' | 'trial' | 'legacy' | 'open' | 'care' | 'all' | 'kind:<kind>'
  period TEXT NOT NULL,                        -- 'YYYY-MM-DD' or 'YYYY-MM' (Asia/Jerusalem)
  calls INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_tokens INTEGER NOT NULL DEFAULT 0,     -- cache reads + writes
  nano_usd INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pool, period)
);

-- Who changed money or access, and when. No personal data in detail.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,                         -- 'owner:cli' | 'account:<id>' | 'teacher:<code>' | 'provider:<name>' | 'cron'
  action TEXT NOT NULL,                        -- 'licence.grant' | 'licence.end' | 'licence.claim' | 'subscription.cancel' | 'refund'
                                               -- | 'device.link' | 'device.unlink' | 'student.remove' | 'class.lock' | 'account.delete'
  target TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_target ON audit_log (target);

-- ai_usage (unchanged table) key formats. <net> = the first 16 hex of HMAC-SHA256(IP_HASH_SECRET, 'net:' + the IPv4
-- address or the IPv6 /64 prefix); a raw address is never stored. <dev> = the first 16 hex of
-- HMAC-SHA256(IP_HASH_SECRET, 'dev:' + the install's X-Device id) (devKey in src/util.js); a raw device id is never
-- stored. day = YYYY-MM-DD (Asia/Jerusalem); monthly keys use YYYY-MM, hourly keys YYYY-MM-DDTHH.
--   paywall off:  s:<student>  t:<class>  solo:n:<net>
--   free taste:   free:s:<student> | free:fd:<family device> | free:t:<class> | free:d:<dev> | free:x:<net>        (person)
--                 free:n:<net> (anonymous only)  free:c:<class>  free:all                                          (shared)
--   paid:         <subject>:<group> with subject fam:<account> | s:<student> | t:<class>  and group tutor|check|generate|exam;
--                 fam:<account>:exam (YYYY-MM);  cls:<class> (units);  <subject>:<group>:tries (never given back)
--   legacy:       s:<student> | t:<class> (calls) and cls:<class> (units)
--   care:         care:<s:<student> | fd:<family device> | t:<class> | d:<dev> | x:<net>> (5)  care:n:<net> (30)  care:all (1,000):
--                 a chat message that reads as distress (trust spec TRUST-3); never given back, never a question
--   pin:          pin:<student>:<net> (hourly, 5)  pin:<student> (30): taken before the PIN is compared, given back when
--                 it is right (trust spec TRUST-12 §1); the teacher's reset and removal delete them
--   report:       report:<s:<student> | fd:<family device> | t:<class> | d:<dev> | x:<net>> (10)  report:n:<net> (100):
--                 a reported AI answer (trust spec TRUST-4 §4.5)
--   other:        mail:e:<email_hash> mail:n:<net> mail:all  create:n:<net>  join:n:<net>  classinfo:n:<net>
--                 link:d:<dev>  link:n:<net>  linkpoll:<code_hash[0:16]>  linkpoll:n:<net>  claim:a:<account>
--                 checkout:a:<account> (hourly)  licreq:c:<class>  licclaim:n:<net> (hourly)  licclaim:c:<class>  mint:n:<net>

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

-- Indexes for the class data's retention (trust spec TRUST-7 §1): the night purge finds old notebook pages, help
-- requests, attempts and exams, and idle students, by these columns instead of reading every row (cron.js purgeClassSql).
CREATE INDEX IF NOT EXISTS help_done ON help_requests (done_at);
CREATE INDEX IF NOT EXISTS help_created ON help_requests (created_at);
CREATE INDEX IF NOT EXISTS attempts_at ON attempts (at);
CREATE INDEX IF NOT EXISTS exams_created ON exams (created_at);
CREATE INDEX IF NOT EXISTS students_last_seen ON students (last_seen);
