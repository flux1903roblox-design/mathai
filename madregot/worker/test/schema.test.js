// The reference schema and the migrations that real databases go through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const schema = read('../schema.sql');
// Every migration, in name order, as wrangler applies them. A lane that adds a file needs no change here (apart from the
// name list in the test below).
const MIGRATIONS = readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort()
  .map((name) => ({ name, sql: read(`../migrations/${name}`) }));
const m0 = read('../migrations/0000_base.sql');
const m1 = read('../migrations/0001_paid_tutor.sql');
const m2 = read('../migrations/0002_refund_once.sql');
const m3 = read('../migrations/0003_durable.sql');
// The family lane's 0004_parent_report, renumbered 0006 on the main branch (after 0004_safety and 0005_teacher).
const m6 = read('../migrations/0006_parent_report.sql');
// The student lane's 0003_student, renumbered 0007 on the main branch (after 0006_parent_report).
const m7 = read('../migrations/0007_student.sql');
// Structure only: SQLite keeps the comments inside a CREATE statement, and a comment cannot be migrated without an
// ALTER, so schema.sql may describe a column better than the migration that made it (link_codes.device_hint).
const objects = (db) => db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()
  .map((r) => `${r.type}:${r.name}:${String(r.sql).replace(/--[^\n]*/g, '').replace(/\s+/g, ' ')}`);

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

test('each migration has its own number (two lanes that took the same one must renumber), and nothing else is in the folder', () => {
  const all = readdirSync(new URL('../migrations/', import.meta.url));
  const names = MIGRATIONS.map((m) => m.name);
  assert.deepEqual(all.filter((f) => !names.includes(f)), [], 'only NNNN_name.sql files');
  const numbers = names.map((f) => f.slice(0, 4));
  assert.equal(new Set(numbers).size, numbers.length, `a number is used twice: ${numbers.join(', ')}`);
});

// What a later migration adds to a table of 0000_base: SQLite writes an ALTER's column as ", <coldef>" before the table's
// closing parenthesis (schema.sql says the same), and its new indexes are the same lines in both files.
const ALTERS_BASE = MIGRATIONS.filter((m) => m.name >= '0003' && /^ALTER TABLE /m.test(m.sql)).map((m) => m.sql);
const withoutAlters = (sql) => sql.replace(/\n, [^\n]*\);/g, '\n);').split('\n')
  .filter((line) => !(line.startsWith('CREATE ') && ALTERS_BASE.some((m) => m.includes(line)))).join('\n');

test('every migration, in name order, on an empty database gives the same tables and indexes as schema.sql', () => {
  assert.deepEqual(MIGRATIONS.slice(0, 8).map((m) => m.name), ['0000_base.sql', '0001_paid_tutor.sql', '0002_refund_once.sql', '0003_durable.sql', '0004_safety.sql', '0005_teacher.sql', '0006_parent_report.sql', '0007_student.sql']);
  assert.equal(new Set(MIGRATIONS.map((m) => m.name.slice(0, 4))).size, MIGRATIONS.length, 'each migration number is used once');
  const a = new DatabaseSync(':memory:'); a.exec(schema);
  const b = new DatabaseSync(':memory:'); for (const m of MIGRATIONS) b.exec(m.sql);
  assert.deepEqual(objects(b), objects(a));
  const base = withoutAlters(schema);
  assert.equal(m0.trim(), base.slice(0, m0.length).trim(), '0000_base is the start of schema.sql, word for word (apart from what 0003 adds)');
});

test('0003 on a database that has answers: old rows keep a NULL id, a repeated id for one student is refused', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m0); db.exec(m1); db.exec(m2);
  const add = (student, id) => db.prepare(`INSERT OR IGNORE INTO attempts (student_id, topic, level, ok, first_try, hint, secs, day, at${id === undefined ? '' : ', client_id'})
    VALUES (?, 'neg', 1, 1, 1, 0, 5, '2026-11-09', '2026-11-09T10:00:00Z'${id === undefined ? '' : ', ?'})`).run(...(id === undefined ? [student] : [student, id]));
  add('s1'); add('s1');
  db.exec(m3);
  add('s1', null); add('s1', 'aaaaaaaaaaaa'); add('s1', 'aaaaaaaaaaaa'); add('s2', 'aaaaaaaaaaaa');
  const ids = db.prepare('SELECT student_id, client_id FROM attempts ORDER BY id').all().map((r) => `${r.student_id}:${r.client_id}`);
  assert.deepEqual(ids, ['s1:null', 's1:null', 's1:null', 's1:aaaaaaaaaaaa', 's2:aaaaaaaaaaaa']);
});

// An added column is the one change allowed on an existing table: nullable (0003_durable's attempts.client_id,
// link_codes.restore_escrow), or NOT NULL with a constant default and a CHECK (0006_parent_report's share switches).
// schema.sql mirrors it the way SQLite writes it, and withoutAlters above keeps 0000_base word for word. Rows may only
// go INTO a table the same migration creates (0003_durable's meter row and the student_tokens copy of students'
// tokens): no existing row is changed or deleted.
test('migrations after 0002 only add tables, indexes and columns, and fill only their own new tables: no DROP, no other ALTER, no change to existing rows', () => {
  for (const m of MIGRATIONS.filter((x) => x.name >= '0003')) {
    const code = m.sql.replace(/--[^\n]*/g, '');
    const made = [...code.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((x) => x[1]);
    for (const stmt of code.split(';').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
      const into = /^INSERT OR IGNORE INTO (\w+) /.exec(stmt);
      if (into) { assert.ok(made.includes(into[1]), `${m.name}: rows only into a table it creates: ${stmt.slice(0, 60)}`); continue; }
      assert.match(stmt, /^(CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS |ALTER TABLE \w+ ADD COLUMN \w+ \w+( NOT NULL DEFAULT -?\w+)?( CHECK \(\w+ IN \([^()]*\)\))?$)/, `${m.name}: ${stmt.slice(0, 60)}`);
    }
  }
});

test('safety_events can hold no person and no text: no student, device, account, class or text column, and no free-form value', () => {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  const cols = db.prepare('PRAGMA table_info(safety_events)').all().map((c) => c.name);
  assert.deepEqual(cols, ['id', 'day', 'kind', 'category', 'surface', 'source', 'tier']);
  for (const c of cols) assert.doesNotMatch(c, /student|device|account|class|text/i, c);
  const add = (over = {}) => {
    const r = { day: '2026-11-10', kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'free', ...over };
    db.prepare('INSERT INTO safety_events (day, kind, category, surface, source, tier) VALUES (?, ?, ?, ?, ?, ?)').run(r.day, r.kind, r.category, r.surface, r.source, r.tier);
  };
  add();
  assert.throws(() => add({ kind: 'note' }), /CHECK/);
  assert.throws(() => add({ surface: 'anywhere' }), /CHECK/);
  assert.throws(() => add({ source: 'teacher' }), /CHECK/);
  assert.throws(() => add({ category: 'x'.repeat(21) }), /CHECK/, 'a category is a short label, never a sentence');
  assert.throws(() => add({ tier: 'x'.repeat(11) }), /CHECK/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM safety_events').get().n, 1);
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'safety_events_day'").get(), 'the day index');
});

test('ai_quality can hold no person and no text: a day, a kind, a reason and a count, each from a fixed list', () => {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  const cols = db.prepare('PRAGMA table_info(ai_quality)').all().map((c) => c.name);
  assert.deepEqual(cols, ['day', 'kind', 'reason', 'n']);
  const add = (over = {}) => {
    const r = { day: '2026-11-10', kind: 'chat', reason: 'answer_masked', ...over };
    db.prepare('INSERT INTO ai_quality (day, kind, reason, n) VALUES (?, ?, ?, 1) ON CONFLICT (day, kind, reason) DO UPDATE SET n = n + 1').run(r.day, r.kind, r.reason);
  };
  add(); add();
  assert.equal(db.prepare('SELECT n FROM ai_quality').get().n, 2, 'one row per day, kind and reason, counted up');
  assert.throws(() => add({ kind: 'exam' }), /CHECK/);
  assert.throws(() => add({ reason: 'התשובה היא 8' }), /CHECK/, 'a reason is a label, never text');
});

test('help_meta: a kind and a care flag per help request, nothing else, and it goes with its request', () => {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  assert.deepEqual(db.prepare('PRAGMA table_info(help_meta)').all().map((c) => c.name), ['help_id', 'kind', 'care']);
  db.exec('PRAGMA foreign_keys = ON'); // as on D1
  db.exec("INSERT INTO help_requests (student_id, question, created_at) VALUES ('s1', '', '2026-11-10T08:00:00Z')");
  const id = db.prepare('SELECT id FROM help_requests').get().id;
  db.prepare('INSERT INTO help_meta (help_id) VALUES (?)').run(id);
  assert.deepEqual({ ...db.prepare('SELECT kind, care FROM help_meta').get() }, { kind: 'help', care: 0 }, 'the defaults');
  assert.throws(() => db.prepare("UPDATE help_meta SET kind = 'chat'").run(), /CHECK/);
  assert.throws(() => db.prepare('UPDATE help_meta SET care = 2').run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO help_meta (help_id, kind) VALUES (999, 'talk')").run(), /FOREIGN KEY/, 'no row for a request that does not exist');
  db.prepare('DELETE FROM help_requests WHERE id = ?').run(id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM help_meta').get().n, 0, 'deleting the request deletes its row');
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

test('0003 adds the vault tables: the meter starts at 0 once, and a blob is 40 to 349,526 characters', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m0); db.exec(m1); db.exec(m2); db.exec(m3);
  db.exec(m3.split('\n').filter((l) => l.startsWith('INSERT OR IGNORE INTO meters')).join('\n'));
  assert.deepEqual(db.prepare('SELECT name, value FROM meters').all().map((r) => ({ ...r })), [{ name: 'vault_bytes', value: 0 }]);
  const put = (id, n) => db.prepare("INSERT INTO vaults (id_hash, rev, blob, bytes, created_at, updated_at) VALUES (?, 1, ?, ?, 'x', 'x')").run(id, 'A'.repeat(n), n);
  put('a', 349_526); put('b', 40);
  assert.throws(() => put('c', 349_527), /CHECK/);
  assert.throws(() => put('d', 39), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO vaults (id_hash, rev, blob, bytes, created_at, updated_at) VALUES ('e', 0, ?, 40, 'x', 'x')").run('A'.repeat(40)), /CHECK/);
});

test('0006 on a database with linked devices: both switches start on, and the CHECKs keep the summary rows to codes and counts', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of MIGRATIONS.filter((x) => x.name < '0006')) db.exec(m.sql);
  db.exec("INSERT INTO accounts (id, email, created_at) VALUES ('a1', 'p@example.test', '2026-11-01')");
  db.exec("INSERT INTO family_devices (id, account_id, token_hash, label, created_at, last_seen) VALUES ('d1', 'a1', 'h', 'x', '2026-11-01', '2026-11-01')");
  db.exec(m6);
  assert.deepEqual({ ...db.prepare('SELECT share_child, share_parent, share_at, summary_sent_at FROM family_devices').get() },
    { share_child: 1, share_parent: 1, share_at: null, summary_sent_at: null });
  assert.equal(db.prepare('SELECT report_email_at FROM accounts').get().report_email_at, null);
  const day = (over = {}) => {
    const r = { minutes: 10, questions: 5, worked: '[]', fixes: '[]', exam: null, ...over };
    db.prepare(`INSERT OR REPLACE INTO family_daily (device_id, day, minutes, questions, worked, fixes, exam, updated_at)
      VALUES ('d1', '2026-11-09', ?, ?, ?, ?, ?, 'x')`).run(r.minutes, r.questions, r.worked, r.fixes, r.exam);
  };
  day(); day({ minutes: 600, questions: 2000 });
  assert.throws(() => day({ minutes: 601 }), /CHECK/);
  assert.throws(() => day({ questions: -1 }), /CHECK/);
  assert.throws(() => day({ worked: `[${'"x",'.repeat(60)}"x"]` }), /CHECK/);
  assert.throws(() => day({ fixes: 'x'.repeat(401) }), /CHECK/);
  assert.throws(() => day({ exam: 'x'.repeat(61) }), /CHECK/);
  assert.throws(() => db.exec("UPDATE family_devices SET share_child = 2"), /CHECK/);
  assert.throws(() => db.exec("UPDATE family_devices SET share_parent = -1"), /CHECK/);
  // a row belongs to a device: the cascade removes it with the device (the code also deletes it first, explicitly)
  db.exec('PRAGMA foreign_keys = ON');
  assert.throws(() => db.exec("INSERT INTO family_daily (device_id, day, updated_at) VALUES ('nobody', '2026-11-09', 'x')"), /FOREIGN KEY/);
  db.exec("DELETE FROM family_devices WHERE id = 'd1'");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM family_daily').get().n, 0);
});

test('0007_student (the student lane\'s 0003_student): the class goal tables run twice, keep one row per step id and only 1 or 3 points', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of MIGRATIONS.filter((x) => x.name < '0007')) db.exec(m.sql);
  db.exec(m7); db.exec(m7);
  const step = (sid, pts) => db.prepare("INSERT INTO class_steps (sid, student_id, class_code, day, pts, at) VALUES (?, 's1', 'ABCDEF', '2026-11-08', ?, 'x')").run(sid, pts);
  step('11111111-1111-4111-8111-111111111111', 1);
  assert.throws(() => step('11111111-1111-4111-8111-111111111111', 3), /UNIQUE/, 'one row per step id');
  assert.throws(() => step('22222222-2222-4222-8222-222222222222', 2), /CHECK/, 'a step is worth 1 or 3');
  db.exec("INSERT INTO class_goal_weeks (class_code, week, target) VALUES ('ABCDEF', '2026-11-08', 15)");
  assert.throws(() => db.exec("INSERT INTO class_goal_weeks (class_code, week, target) VALUES ('ABCDEF', '2026-11-08', 20)"), /UNIQUE/, 'one target per class and week');
  db.exec("INSERT INTO class_goal_settings (class_code, updated_at) VALUES ('ABCDEF', 'x')");
  assert.equal(db.prepare('SELECT on_flag, target FROM class_goal_settings').get().on_flag, 1, 'on by default, automatic size');
});
