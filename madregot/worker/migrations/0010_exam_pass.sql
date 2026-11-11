-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- COUNCIL2-33: the exam pass, a plan of its own (plan 'exam_pass': the family plan for 30 days, one charge, never
-- renewed). orders.plan and subscriptions.plan are checked against a list of plan ids, and SQLite cannot change a
-- CHECK, so the two tables are rebuilt with 'exam_pass' added to the list and nothing else changed: the same columns in
-- the same order, the same constraints, every row copied with its values, then the same indexes.
--
-- How (SQLite's "making other kinds of table schema changes", in the form Cloudflare's D1 documents for migrations):
-- foreign keys are deferred for the transaction wrangler runs this file in, each table is created under a new name,
-- filled from the old one, the old one dropped and the new one renamed. Other tables point at these two by name
-- (payments, refund_queue, order_renewals), and the ids do not change, so every such link holds again once the rename is
-- done (test/schema.test.js runs this file on a filled database and checks PRAGMA foreign_key_check is empty).
-- One catch: order_renewals.order_id is ON DELETE CASCADE, and dropping orders deletes its rows first, so they are kept
-- aside in order_renewals_keep and put back after the rename.
PRAGMA defer_foreign_keys = on;

CREATE TABLE order_renewals_keep AS SELECT order_id, subscription_id, prev_start, prev_end FROM order_renewals;

CREATE TABLE orders_new (
  id TEXT PRIMARY KEY,                         -- 16 hex; our reference at the provider
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  plan TEXT NOT NULL CHECK (plan IN ('family_month', 'family_year', 'exam_pass', 'class_year')),  -- exam_pass added by migration 0010
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
INSERT INTO orders_new (id, account_id, plan, class_code, seats, amount_agorot, vat_agorot, currency, provider, mode, provider_checkout_id, idempotency_key, status, subscription_id, created_at, expires_at, paid_at)
  SELECT id, account_id, plan, class_code, seats, amount_agorot, vat_agorot, currency, provider, mode, provider_checkout_id, idempotency_key, status, subscription_id, created_at, expires_at, paid_at FROM orders;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
CREATE INDEX IF NOT EXISTS orders_open ON orders (status, expires_at);

INSERT INTO order_renewals (order_id, subscription_id, prev_start, prev_end)
  SELECT order_id, subscription_id, prev_start, prev_end FROM order_renewals_keep;
DROP TABLE order_renewals_keep;

CREATE TABLE subscriptions_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('family', 'class')),
  account_id TEXT REFERENCES accounts (id) ON DELETE SET NULL,  -- family: the payer; class: the buyer, or NULL for an invoice grant
  class_code TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('family_month', 'family_year', 'exam_pass', 'class_year', 'term', 'trial')),  -- exam_pass: 0010
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
INSERT INTO subscriptions_new (id, kind, account_id, class_code, plan, status, provider, provider_subscription_id, price_agorot, seats, invoice_ref, current_period_start, current_period_end, cancel_at_period_end, cancel_requested_at, cancel_synced_at, first_paid_at, refund_until, ended_reason, last_event_at, note, created_at, updated_at)
  SELECT id, kind, account_id, class_code, plan, status, provider, provider_subscription_id, price_agorot, seats, invoice_ref, current_period_start, current_period_end, cancel_at_period_end, cancel_requested_at, cancel_synced_at, first_paid_at, refund_until, ended_reason, last_event_at, note, created_at, updated_at FROM subscriptions;
DROP TABLE subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub ON subscriptions (provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_live_family ON subscriptions (account_id) WHERE kind = 'family' AND status IN ('active', 'past_due');
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_live_class ON subscriptions (class_code) WHERE kind = 'class' AND status IN ('active', 'past_due');
CREATE INDEX IF NOT EXISTS subscriptions_account ON subscriptions (account_id, kind, status);
CREATE INDEX IF NOT EXISTS subscriptions_class ON subscriptions (class_code, status);
CREATE INDEX IF NOT EXISTS subscriptions_due ON subscriptions (status, current_period_end);
CREATE INDEX IF NOT EXISTS subscriptions_cancel_unsynced ON subscriptions (cancel_requested_at) WHERE cancel_requested_at IS NOT NULL AND cancel_synced_at IS NULL;

PRAGMA defer_foreign_keys = off;
