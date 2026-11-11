// The reference schema and the migrations that real databases go through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const schema = read('../schema.sql');
const m0 = read('../migrations/0000_base.sql');
const m1 = read('../migrations/0001_paid_tutor.sql');
const m2 = read('../migrations/0002_refund_once.sql');
const m3 = read('../migrations/0003_student.sql');
const objects = (db) => db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()
  .map((r) => `${r.type}:${r.name}:${String(r.sql).replace(/\s+/g, ' ')}`);

// The block committed in 5117e5b (never deployed), as it would sit in a database that had it applied.
const OLD_BLOCK = `
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, last_seen TEXT);
CREATE TABLE IF NOT EXISTS login_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, sent_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS account_sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, created_at TEXT NOT NULL, last_seen TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, kind TEXT NOT NULL, account_id TEXT, class_code TEXT, status TEXT NOT NULL, provider TEXT NOT NULL,
  provider_ref TEXT, current_period_end TEXT NOT NULL, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, note TEXT);
CREATE TABLE IF NOT EXISTS billing_events (provider TEXT NOT NULL, event_id TEXT NOT NULL, received_at TEXT NOT NULL, kind TEXT, PRIMARY KEY (provider, event_id));`;

test('schema.sql runs twice without error', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec(schema);
  assert.ok(objects(db).length > 30);
});

test('migrations 0000 to 0003 on an empty database give the same tables and indexes as schema.sql', () => {
  const a = new DatabaseSync(':memory:'); a.exec(schema);
  const b = new DatabaseSync(':memory:'); b.exec(m0); b.exec(m1); b.exec(m2); b.exec(m3);
  assert.deepEqual(objects(b), objects(a));
  assert.equal(m0.trim(), schema.slice(0, m0.length).trim(), '0000_base is the start of schema.sql, word for word');
});

test('migration 0001 drops the never-deployed tables and deletes raw-IP counters only', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m0); db.exec(OLD_BLOCK);
  db.prepare("INSERT INTO accounts (id, email, created_at) VALUES ('a1', 'old@example.test', '2026-11-01')").run();
  const keep = ['create:n:0011223344556677', 'join:n:0011223344556677', 's:abc', 't:ABCDEF', 'pin:abc', 'free:d:ffff'];
  const drop = ['ip:203.0.113.7', 'code-ip:203.0.113.7', 'free-ip:203.0.113.7', 'free:ip:203.0.113.7', 'admin-fail:203.0.113.7', 'create:203.0.113.7', 'join:203.0.113.7'];
  for (const who of [...keep, ...drop]) db.prepare("INSERT INTO ai_usage (who, day, count) VALUES (?, '2026-11-09', 3)").run(who);
  db.exec(m1);
  assert.deepEqual(db.prepare('SELECT who FROM ai_usage ORDER BY who').all().map((r) => r.who), [...keep].sort());
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0, 'the old accounts table was dropped');
  const cols = db.prepare('PRAGMA table_info(login_codes)').all().map((c) => c.name);
  assert.ok(cols.includes('email_hash') && !cols.includes('email'), 'login_codes has the new shape');
  db.exec(m1);
});

test('the live-plan indexes, CHECKs and the billing_events key hold', () => {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  db.exec("INSERT INTO accounts (id, email, created_at) VALUES ('a1', 'p@example.test', '2026-11-01')");
  const sub = (id, status) => db.prepare(`INSERT INTO subscriptions (id, kind, account_id, plan, status, provider, current_period_start, current_period_end, created_at, updated_at)
    VALUES (?, 'family', 'a1', 'family_month', ?, 'test', '2026-11-01', '2026-12-01', '2026-11-01', '2026-11-01')`).run(id, status);
  sub('s1', 'active');
  assert.throws(() => sub('s2', 'past_due'), /UNIQUE/, 'a second live family plan is refused');
  sub('s3', 'canceled');
  assert.throws(() => db.prepare(`INSERT INTO orders (id, account_id, plan, class_code, amount_agorot, vat_agorot, provider, mode, idempotency_key, status, created_at, expires_at)
    VALUES ('o1', 'a1', 'class_year', 'ABCDEF', 4900, 747, 'test', 'test', 'kkkkkkkkkkkkkkkk', 'open', 'x', 'y')`).run(), /CHECK/, 'class_year needs seats');
  db.exec("INSERT INTO billing_events (provider, event_id, type, outcome, received_at) VALUES ('test', 'e1', 'paid', 'applied', 'x')");
  assert.throws(() => db.exec("BEGIN; INSERT INTO billing_events (provider, event_id, type, outcome, received_at) VALUES ('test', 'e1', 'paid', 'applied', 'x'); COMMIT;"), /UNIQUE/);
  db.exec('ROLLBACK');
  const refund = (reason) => db.prepare("INSERT INTO refund_queue (subscription_id, amount_agorot, reason, requested_at) VALUES ('s1', 100, ?, 'x')").run(reason);
  refund('cooling_off');
  assert.throws(() => refund('cooling_off'), /UNIQUE/, 'one cooling-off refund per plan');
  refund('after_cancel'); refund('after_cancel');
  db.exec("INSERT INTO account_sessions (token_hash, account_id, created_at, last_seen, verified_at) VALUES ('t', 'a1', 'x', 'x', 'x')");
  db.exec('PRAGMA foreign_keys = ON');
  db.exec("DELETE FROM accounts WHERE id = 'a1'");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 0, 'sessions go with the account');
});

test('0003_student: the class goal tables run twice, keep one row per step id and only 1 or 3 points', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m0); db.exec(m1); db.exec(m2); db.exec(m3); db.exec(m3);
  const step = (sid, pts) => db.prepare("INSERT INTO class_steps (sid, student_id, class_code, day, pts, at) VALUES (?, 's1', 'ABCDEF', '2026-11-08', ?, 'x')").run(sid, pts);
  step('11111111-1111-4111-8111-111111111111', 1);
  assert.throws(() => step('11111111-1111-4111-8111-111111111111', 3), /UNIQUE/, 'one row per step id');
  assert.throws(() => step('22222222-2222-4222-8222-222222222222', 2), /CHECK/, 'a step is worth 1 or 3');
  db.exec("INSERT INTO class_goal_weeks (class_code, week, target) VALUES ('ABCDEF', '2026-11-08', 15)");
  assert.throws(() => db.exec("INSERT INTO class_goal_weeks (class_code, week, target) VALUES ('ABCDEF', '2026-11-08', 20)"), /UNIQUE/, 'one target per class and week');
  db.exec("INSERT INTO class_goal_settings (class_code, updated_at) VALUES ('ABCDEF', 'x')");
  assert.equal(db.prepare('SELECT on_flag, target FROM class_goal_settings').get().on_flag, 1, 'on by default, automatic size');
});

test('0003_student: push_subs keeps one row per push address, an hour from 16 to 20 and on or paused only', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m0); db.exec(m1); db.exec(m2); db.exec(m3); db.exec(m3);
  const sub = (id, endpoint, slot = 17, status = 'on') => db.prepare(`INSERT INTO push_subs (id, secret_hash, endpoint, p256dh, auth, slot, status, created_at)
    VALUES (?, 'h', ?, 'k', 'a', ?, ?, '2026-11-10T15:00:00Z')`).run(id, endpoint, slot, status);
  sub('0000000000000001', 'https://fcm.googleapis.com/fcm/send/a');
  assert.throws(() => sub('0000000000000002', 'https://fcm.googleapis.com/fcm/send/a'), /UNIQUE/, 'one row per push address');
  for (const slot of [15, 21]) assert.throws(() => sub(`000000000000003${slot % 10}`, `https://fcm.googleapis.com/fcm/send/s${slot}`, slot), /CHECK/, String(slot));
  assert.throws(() => sub('0000000000000004', 'https://fcm.googleapis.com/fcm/send/b', 17, 'off'), /CHECK/);
  sub('0000000000000005', 'https://fcm.googleapis.com/fcm/send/c', 20, 'paused');
  assert.deepEqual({ ...db.prepare("SELECT status, misses FROM push_subs WHERE id = '0000000000000001'").get() }, { status: 'on', misses: 0 });
});
