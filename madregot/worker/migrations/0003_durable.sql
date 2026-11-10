-- Run with the others: npm run db:migrate (wrangler applies each migration once).
-- The durable-progress lane's one migration: later items of the lane add to this file until it is deployed.
-- DURABLE-7: each answer a class student's app sends carries its own 12-hex id, so a batch sent twice (a retry, a page
-- closed mid-request) is stored once. Answers from older apps have no id (NULL) and are stored as before.
ALTER TABLE attempts ADD COLUMN client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS attempts_client ON attempts (student_id, client_id) WHERE client_id IS NOT NULL;

-- DURABLE-9: the app's error reports, counted per day and fingerprint, with no per-user trail: no device id, no address,
-- no name, no route values (a route is its pattern). fp = the first 16 hex of SHA-256(kind|name|message|frame). Kept 30
-- days (cron.js). The Worker's own unhandled exceptions are kind 'server'.
CREATE TABLE IF NOT EXISTS client_errors (
  day TEXT NOT NULL,                                     -- YYYY-MM-DD, Jerusalem
  fp TEXT NOT NULL CHECK (length(fp) = 16),
  release TEXT NOT NULL CHECK (length(release) <= 20),
  kind TEXT NOT NULL CHECK (kind IN ('error', 'rejection', 'render', 'chunk', 'storage', 'vault', 'sw', 'csp', 'server')),
  name TEXT NOT NULL CHECK (length(name) <= 40),
  message TEXT NOT NULL CHECK (length(message) <= 200),
  frame TEXT NOT NULL CHECK (length(frame) <= 120),
  route TEXT NOT NULL CHECK (length(route) <= 60),
  agent TEXT NOT NULL CHECK (length(agent) <= 30),
  count INTEGER NOT NULL DEFAULT 1,
  first_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  PRIMARY KEY (day, fp, release, agent, route)
);

-- DURABLE-5: the encrypted backup vault. The server keeps ciphertext and the SHA-256 of a lookup token that the app
-- derives from the restore code; never the token, the code, the key, an address, a device id or a name. A vault nobody
-- wrote or read for 400 days is deleted (cron.js). meters.vault_bytes is the size breaker: it changes in the same batch
-- as the vault row (vault.js) and is recomputed from SUM(bytes) every night.
CREATE TABLE IF NOT EXISTS vaults (
  id_hash TEXT PRIMARY KEY,                 -- SHA-256 hex of the 64-hex lookup token
  rev INTEGER NOT NULL CHECK (rev >= 1),
  blob TEXT NOT NULL CHECK (length(blob) BETWEEN 40 AND 349526),   -- base64url(0x01 | iv | AES-GCM(gzip(JSON))), at most 256 KiB binary
  prev_rev INTEGER,
  prev_blob TEXT CHECK (prev_blob IS NULL OR length(prev_blob) <= 349526),   -- the version before, kept for undo
  bytes INTEGER NOT NULL,                   -- length(blob) + length(prev_blob)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  read_at TEXT                              -- the last day a device read it (retention counts the later of the two)
);
CREATE INDEX IF NOT EXISTS vaults_updated ON vaults (updated_at);
CREATE TABLE IF NOT EXISTS meters (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO meters (name, value) VALUES ('vault_bytes', 0);

-- DURABLE-6: escrow. The restore code of a vault, sealed with a Worker secret (AES-GCM under HKDF(VAULT_SECRET,
-- 'escrow-v1')), attached to an identity the user already has: a class student (owner_kind 'student') or a family
-- account and the device that syncs it (owner_kind 'account'; device_id NULL = kept in the account after an unlink).
-- While an escrow exists the operator could open that vault; a vault with no escrow stays readable only with its code.
-- Deleted with the student, the account, the vault, or the student's own switch; the night job sweeps orphans.
CREATE TABLE IF NOT EXISTS vault_escrow (
  id TEXT PRIMARY KEY,                        -- 16 hex
  vault_id TEXT NOT NULL,                     -- vaults.id_hash (no FK: a vault can be recreated with the same id)
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('student', 'account')),
  owner_id TEXT NOT NULL,                     -- students.id | accounts.id
  device_id TEXT,                             -- family_devices.id now syncing it; NULL = kept in the account
  label TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 30),   -- the device label when escrowed (parent-chosen)
  sealed TEXT NOT NULL CHECK (length(sealed) <= 200),           -- the restore code, AES-GCM under HKDF(VAULT_SECRET)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS vault_escrow_student ON vault_escrow (owner_id) WHERE owner_kind = 'student';
CREATE UNIQUE INDEX IF NOT EXISTS vault_escrow_device ON vault_escrow (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vault_escrow_owner ON vault_escrow (owner_kind, owner_id);
CREATE INDEX IF NOT EXISTS vault_escrow_vault ON vault_escrow (vault_id);

-- DURABLE-6: a class student stays signed in on up to 3 devices. Each join adds a token and drops all but the newest 3;
-- a PIN reset or the student's removal drops them all; a token unused for 400 days is purged at night. The old
-- students.token_hash is still written (an older Worker in a rollback reads it) but no longer read.
CREATE TABLE IF NOT EXISTS student_tokens (
  token_hash TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS student_tokens_student ON student_tokens (student_id);
INSERT OR IGNORE INTO student_tokens (token_hash, student_id, created_at, last_seen)
  SELECT token_hash, id, created_at, COALESCE(last_seen, created_at) FROM students WHERE token_hash <> '';

-- DURABLE-6: a parent linking a new device can continue from a kept escrow: set on claim, used on finish.
ALTER TABLE link_codes ADD COLUMN restore_escrow TEXT;
