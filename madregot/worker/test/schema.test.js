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
// The family lane's 0005_vault_guard, renumbered 0008 on the main branch (after 0007_student).
const m8 = read('../migrations/0008_vault_guard.sql');
// Structure only: SQLite keeps the comments inside a CREATE statement, and a comment cannot be migrated without an
// ALTER, so schema.sql may describe a column better than the migration that made it (link_codes.device_hint).
// A table that a migration rebuilt (0010_exam_pass) is stored as SQLite's rename writes it, CREATE TABLE "orders" (…):
// the quotes around its name are the only difference, and are not one of structure.
const objects = (db) => db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()
  .map((r) => `${r.type}:${r.name}:${String(r.sql).replace(/--[^\n]*/g, '').replace(/^CREATE TABLE "(\w+)"/, 'CREATE TABLE $1').replace(/\s+/g, ' ')}`);

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
// A table with a table constraint (students' UNIQUE) gets its added columns inline, after its last column: "last_seen
// TEXT, claim_hash TEXT, claim_expires TEXT," (0009_claim_code), so those plain "name TYPE" columns are taken out too.
const INLINE = ALTERS_BASE.flatMap((m) => [...m.matchAll(/^ALTER TABLE \w+ ADD COLUMN (\w+ \w+);$/gm)].map((x) => x[1]));
const withoutAlters = (sql) => sql.replace(new RegExp(`(?:, (?:${INLINE.join('|')}))+,\n`, 'g'), ',\n').replace(/\n, [^\n]*\);/g, '\n);').split('\n')
  .filter((line) => !(line.startsWith('CREATE ') && ALTERS_BASE.some((m) => m.includes(line)))).join('\n');

test('every migration, in name order, on an empty database gives the same tables and indexes as schema.sql', () => {
  assert.deepEqual(MIGRATIONS.slice(0, 11).map((m) => m.name), ['0000_base.sql', '0001_paid_tutor.sql', '0002_refund_once.sql', '0003_durable.sql', '0004_safety.sql', '0005_teacher.sql', '0006_parent_report.sql', '0007_student.sql', '0008_vault_guard.sql', '0009_claim_code.sql', '0010_exam_pass.sql']);
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
// The one exception: a migration that must change a CHECK (SQLite cannot alter one) rebuilds the table, named here with
// the tables it rebuilds. Its statements may be only the steps of a rebuild (defer the foreign keys, keep aside the rows
// a cascade would delete, create <t>_new, copy every column, drop <t>, rename <t>_new to <t>, the same indexes, put the
// kept rows back), and the test below runs it on a filled database.
const REBUILDS = { '0010_exam_pass.sql': ['orders', 'subscriptions'] };
const REBUILD_STEP = (tables) => new RegExp(`^(PRAGMA defer_foreign_keys = (on|off)|CREATE TABLE (${tables.join('|')})_new \\(.*\\)|INSERT INTO (${tables.join('|')})_new \\([\\w, ]+\\) SELECT [\\w, ]+ FROM (${tables.join('|')})|DROP TABLE (${tables.join('|')})|ALTER TABLE (${tables.join('|')})_new RENAME TO (${tables.join('|')})|CREATE TABLE (\\w+)_keep AS SELECT [\\w, ]+ FROM \\w+|INSERT INTO (\\w+) \\([\\w, ]+\\) SELECT [\\w, ]+ FROM \\w+_keep|DROP TABLE \\w+_keep)$`);

test('migrations after 0002 only add tables, indexes and columns, and fill only their own new tables: no DROP, no other ALTER, no change to existing rows (a rebuild in REBUILDS aside)', () => {
  for (const m of MIGRATIONS.filter((x) => x.name >= '0003')) {
    if (REBUILDS[m.name]) {
      const code = m.sql.replace(/--[^\n]*/g, '');
      for (const stmt of code.split(';').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
        if (/^CREATE (UNIQUE )?INDEX IF NOT EXISTS /.test(stmt)) continue;
        assert.match(stmt, REBUILD_STEP(REBUILDS[m.name]), `${m.name}: ${stmt.slice(0, 80)}`);
      }
      continue;
    }
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

test('0007_student (the student lane\'s 0003_student): push_subs keeps one row per push address, an hour from 16 to 20 and on or paused only', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of MIGRATIONS.filter((x) => x.name < '0007')) db.exec(m.sql);
  db.exec(m7); db.exec(m7);
  const sub = (id, endpoint, slot = 17, status = 'on') => db.prepare(`INSERT INTO push_subs (id, secret_hash, endpoint, p256dh, auth, slot, status, created_at)
    VALUES (?, 'h', ?, 'k', 'a', ?, ?, '2026-11-10T15:00:00Z')`).run(id, endpoint, slot, status);
  sub('0000000000000001', 'https://fcm.googleapis.com/fcm/send/a');
  assert.throws(() => sub('0000000000000002', 'https://fcm.googleapis.com/fcm/send/a'), /UNIQUE/, 'one row per push address');
  for (const slot of [15, 21]) assert.throws(() => sub(`000000000000003${slot % 10}`, `https://fcm.googleapis.com/fcm/send/s${slot}`, slot), /CHECK/, String(slot));
  assert.throws(() => sub('0000000000000004', 'https://fcm.googleapis.com/fcm/send/b', 17, 'off'), /CHECK/);
  sub('0000000000000005', 'https://fcm.googleapis.com/fcm/send/c', 20, 'paused');
  assert.deepEqual({ ...db.prepare("SELECT status, misses FROM push_subs WHERE id = '0000000000000001'").get() }, { status: 'on', misses: 0 });
});

test('0008_vault_guard (the family lane\'s 0005_vault_guard): the tombstone table runs twice and keeps one row per vault hash', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of MIGRATIONS.filter((x) => x.name < '0008')) db.exec(m.sql);
  db.exec(m8); db.exec(m8);
  db.exec("INSERT INTO vault_tombstones (id_hash, deleted_at) VALUES ('h1', '2026-11-11T00:00:00Z')");
  assert.throws(() => db.exec("INSERT INTO vault_tombstones (id_hash, deleted_at) VALUES ('h1', '2026-11-12T00:00:00Z')"), /UNIQUE/);
});

test('0010_exam_pass on a filled database (in one transaction, as wrangler runs it): every row is kept, every link holds, and exam_pass is a plan', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of MIGRATIONS.filter((x) => x.name < '0010')) db.exec(m.sql);
  const at = '2026-11-01T10:00:00.000Z'; const end = '2027-11-01T10:00:00.000Z';
  // a family with a one-year plan it renewed (an order_renewals row, ON DELETE CASCADE from orders), a monthly plan that
  // ended with a refund, and a class licence: orders, subscriptions, payments, refunds and renewals that point at them
  db.exec(`
    INSERT INTO accounts (id, email, created_at) VALUES ('acc0000000000001', 'parent@example.test', '${at}');
    INSERT INTO orders (id, account_id, plan, amount_agorot, vat_agorot, provider, mode, idempotency_key, status, subscription_id, created_at, expires_at, paid_at)
      VALUES ('ord0000000000001', 'acc0000000000001', 'family_year', 24900, 3798, 'test', 'test', 'key-0000000000000001', 'paid', 'sub0000000000001', '${at}', '${at}', '${at}'),
             ('ord0000000000002', 'acc0000000000001', 'family_year', 24900, 3798, 'test', 'test', 'key-0000000000000002', 'paid', 'sub0000000000001', '${at}', '${at}', '${at}'),
             ('ord0000000000003', 'acc0000000000001', 'family_month', 2990, 456, 'test', 'test', 'key-0000000000000003', 'expired', NULL, '${at}', '${at}', NULL);
    INSERT INTO orders (id, account_id, plan, class_code, seats, amount_agorot, vat_agorot, provider, mode, idempotency_key, status, created_at, expires_at)
      VALUES ('ord0000000000004', 'acc0000000000001', 'class_year', 'ABC123', 10, 49000, 7475, 'test', 'test', 'key-0000000000000004', 'open', '${at}', '${at}');
    INSERT INTO subscriptions (id, kind, account_id, plan, status, provider, price_agorot, current_period_start, current_period_end, refund_until, first_paid_at, created_at, updated_at)
      VALUES ('sub0000000000001', 'family', 'acc0000000000001', 'family_year', 'active', 'test', 24900, '${at}', '${end}', '${at}', '${at}', '${at}', '${at}'),
             ('sub0000000000002', 'family', 'acc0000000000001', 'family_month', 'ended', 'test', 2990, '${at}', '2026-11-02T10:00:00.000Z', NULL, '${at}', '${at}', '${at}');
    INSERT INTO subscriptions (id, kind, class_code, plan, status, provider, seats, current_period_start, current_period_end, created_at, updated_at, note)
      VALUES ('sub0000000000003', 'class', 'ABC123', 'term', 'active', 'manual', 30, '${at}', '${end}', '${at}', '${at}', 'invoice 12');
    INSERT INTO payments (id, provider, provider_payment_id, kind, subscription_id, order_id, amount_agorot, status, occurred_at, recorded_at)
      VALUES ('pay0000000000001', 'test', 'tpay_1', 'charge', 'sub0000000000001', 'ord0000000000001', 24900, 'ok', '${at}', '${at}'),
             ('pay0000000000002', 'test', 'tpay_2', 'charge', 'sub0000000000001', 'ord0000000000002', 24900, 'ok', '${at}', '${at}'),
             ('pay0000000000003', 'test', 'tpay_2', 'refund', 'sub0000000000002', NULL, -2990, 'ok', '${at}', '${at}');
    INSERT INTO refund_queue (subscription_id, payment_id, amount_agorot, reason, requested_at) VALUES ('sub0000000000002', 'pay0000000000001', 2990, 'cooling_off', '${at}');
    INSERT INTO order_renewals (order_id, subscription_id, prev_start, prev_end) VALUES ('ord0000000000002', 'sub0000000000001', '${at}', '${end}');`);
  const TABLES = ['orders', 'subscriptions', 'payments', 'refund_queue', 'order_renewals'];
  const rows = () => Object.fromEntries(TABLES.map((t) => [t, JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all())]));
  const before = rows();
  assert.equal(JSON.parse(before.order_renewals).length, 1);
  db.exec('BEGIN');
  db.exec(MIGRATIONS.find((m) => m.name === '0010_exam_pass.sql').sql);
  db.exec('COMMIT');
  assert.deepEqual(rows(), before, 'every row of the rebuilt tables and of the tables that point at them, as it was');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'every link to orders and subscriptions holds');
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'foreign keys are on again');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE '%\\_new' ESCAPE '\\' OR name LIKE '%\\_keep' ESCAPE '\\'").get().n, 0, 'no table left behind');
  // the new plan is accepted in both tables; any other id still is not; the other constraints still hold
  db.exec(`INSERT INTO orders (id, account_id, plan, amount_agorot, vat_agorot, provider, mode, idempotency_key, status, created_at, expires_at)
    VALUES ('ord0000000000005', 'acc0000000000001', 'exam_pass', 3900, 595, 'test', 'test', 'key-0000000000000005', 'open', '${at}', '${at}')`);
  db.exec(`INSERT INTO subscriptions (id, kind, account_id, plan, status, provider, price_agorot, current_period_start, current_period_end, created_at, updated_at)
    VALUES ('sub0000000000004', 'family', 'acc0000000000001', 'exam_pass', 'ended', 'test', 3900, '${at}', '2026-12-01T10:00:00.000Z', '${at}', '${at}')`);
  assert.throws(() => db.exec(`INSERT INTO orders (id, account_id, plan, amount_agorot, vat_agorot, provider, mode, idempotency_key, status, created_at, expires_at)
    VALUES ('ord0000000000006', 'acc0000000000001', 'week_pass', 900, 137, 'test', 'test', 'key-0000000000000006', 'open', '${at}', '${at}')`), /CHECK/);
  assert.throws(() => db.exec(`INSERT INTO subscriptions (id, kind, account_id, plan, status, provider, current_period_start, current_period_end, created_at, updated_at)
    VALUES ('sub0000000000005', 'family', 'acc0000000000001', 'exam_pass', 'active', 'test', '${at}', '${at}', '${at}', '${at}')`), /CHECK/, 'an end after the start');
  assert.throws(() => db.exec(`INSERT INTO subscriptions (id, kind, account_id, plan, status, provider, current_period_start, current_period_end, created_at, updated_at)
    VALUES ('sub0000000000006', 'family', 'acc0000000000001', 'exam_pass', 'active', 'test', '${at}', '${end}', '${at}', '${at}')`), /UNIQUE/, 'one live family plan per account (the index is back)');
  assert.throws(() => db.exec("DELETE FROM subscriptions WHERE id = 'sub0000000000001'"), /FOREIGN KEY/, 'the payments still point at the plan');
  db.exec("DELETE FROM payments WHERE order_id = 'ord0000000000002'; DELETE FROM orders WHERE id = 'ord0000000000002'");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_renewals').get().n, 0, 'the cascade from orders to its renewal row holds as before');
});

test('the exam pass in the reference schema: both tables take it, and nothing else new', () => {
  const db = new DatabaseSync(':memory:'); db.exec(schema);
  const check = (table) => /plan IN \(([^)]*)\)/.exec(db.prepare(`SELECT sql FROM sqlite_master WHERE name = '${table}'`).get().sql)[1].replace(/'/g, '').split(', ');
  assert.deepEqual(check('orders'), ['family_month', 'family_year', 'exam_pass', 'class_year']);
  assert.deepEqual(check('subscriptions'), ['family_month', 'family_year', 'exam_pass', 'class_year', 'term', 'trial']);
});
