// The owner's CLI: input rules, the SQL it builds (run here against the in-memory database, never through wrangler),
// and the licence codes it prints once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build, cli, parseArgs, licenceCode, licenceHash, noteArg, InputError, HELP, reach, reachPlan } from '../scripts/owner.mjs';
import { REACH_NOW, seedReach, seedFamily } from './fixtures/reach-rows.js';
import { endOfDayIso } from '../src/util.js';
import { makeEnv, rows, one } from './helpers.js';

const NOW = '2026-11-10T10:00:00.000Z';
// approval: the Ministry's catalogue approval (MOE_AI_APPROVAL) is given here, so the grants build; the refusal before it
// has its own tests below
const fixed = { now: NOW, id: '0123456789abcdef', code: 'ABCD-EFGH-JKLM', approval: 'approved' };
const run = (env, sql) => env.DB.raw.exec(sql);
function withClass(code = 'ABC234') {
  const env = makeEnv();
  env.DB.raw.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES (?, 'ז׳3', '7', 'רונית', 'x', ?)").run(code, NOW);
  return env;
}

test('grant-class builds the exact SQL plus the audit row, and extends a live licence with MAX', () => {
  const b = build('grant-class', { class: 'abc234', until: '2027-08-31', seats: '35', invoice: 'INV-17', note: 'pilot' }, fixed);
  const until = endOfDayIso('2027-08-31');
  assert.equal(until, '2027-08-31T21:00:00.000Z');
  assert.equal(b.readOnly, false);
  assert.ok(b.sql.includes(`INSERT INTO subscriptions (id, kind, account_id, class_code, plan, status, provider, seats, invoice_ref, current_period_start, current_period_end, note, created_at, updated_at)
  SELECT '0123456789abcdef', 'class', NULL, 'ABC234', 'term', 'active', 'manual', 35, 'INV-17', '${NOW}', '${until}', 'pilot', '${NOW}', '${NOW}'`));
  assert.ok(b.sql.includes(`INSERT INTO audit_log (at, actor, action, target, detail) VALUES ('${NOW}', 'owner:cli', 'licence.grant', 'class:ABC234', '{"plan":"term","until":"${until}","seats":35,"invoice":"INV-17"}');`));
  const env = withClass();
  run(env, b.sql);
  let sub = one(env, 'SELECT * FROM subscriptions');
  assert.equal(sub.current_period_end, until); assert.equal(sub.seats, 35); assert.equal(sub.provider, 'manual');
  // a second, shorter grant never shortens; a longer one extends
  run(env, build('grant-class', { class: 'ABC234', until: '2027-06-30', seats: '35' }, { ...fixed, id: 'ffffffffffffffff' }).sql);
  assert.equal(rows(env, 'SELECT * FROM subscriptions').length, 1);
  assert.equal(one(env, 'SELECT current_period_end FROM subscriptions').current_period_end, until);
  run(env, build('grant-class', { class: 'ABC234', until: '2028-08-31', seats: '40' }, fixed).sql);
  sub = one(env, 'SELECT * FROM subscriptions');
  assert.equal(sub.current_period_end, endOfDayIso('2028-08-31')); assert.equal(sub.seats, 40);
  assert.equal(rows(env, "SELECT * FROM audit_log WHERE actor = 'owner:cli'").length, 3);
  // a class that does not exist gets nothing
  const empty = makeEnv();
  run(empty, b.sql);
  assert.equal(rows(empty, 'SELECT * FROM subscriptions').length, 0);
});

test('grant-class --trial: 14 days, at most 40 seats', () => {
  const b = build('grant-class', { class: 'ABC234', seats: '30', trial: true }, fixed);
  const env = withClass();
  run(env, b.sql);
  const sub = one(env, 'SELECT * FROM subscriptions');
  assert.equal(sub.plan, 'trial'); assert.equal(sub.current_period_end, '2026-11-24T10:00:00.000Z');
  assert.throws(() => build('grant-class', { class: 'ABC234', seats: '41', trial: true }, fixed), InputError);
  assert.throws(() => build('grant-class', { class: 'ABC234', seats: '10', trial: true, until: '2027-01-30' }, fixed), /14 days/);
});

test('bad class codes, dates and ids are rejected; quotes and semicolons are stripped from notes', () => {
  for (const cls of ['ABC12', 'ABCDE0', "AB'; DROP", 'abcdeI']) assert.throws(() => build('grant-class', { class: cls, until: '2027-01-01', seats: '10' }, fixed), InputError, cls);
  for (const until of ['2027-13-01', '2027-02-30', '27-01-01', "2027-01-01'", '2020-01-01']) assert.throws(() => build('grant-class', { class: 'ABC234', until, seats: '10' }, fixed), InputError, until);
  for (const id of ['xyz', '0123456789ABCDEF', "0123456789abcde'"]) assert.throws(() => build('end', { id }, fixed), InputError, id);
  assert.throws(() => build('grant-class', { class: 'ABC234', until: '2027-01-01', seats: '61' }, fixed), InputError);
  assert.throws(() => build('grant-family', { email: 'not an email', until: '2027-01-01' }, fixed), InputError);
  assert.throws(() => build('frobnicate', {}, fixed), /unknown command/);
  assert.equal(noteArg("pilot'; DROP TABLE accounts; -- \"x\""), 'pilot DROP TABLE accounts -- x');
  assert.equal(noteArg('בית ספר דוגמה, כיתה ז/3.'), 'בית ספר דוגמה, כיתה ז/3.');
  const b = build('grant-class', { class: 'ABC234', until: '2027-01-01', seats: '10', note: "x'); DELETE FROM classes; --" }, fixed);
  const env = withClass();
  run(env, b.sql);
  assert.equal(rows(env, 'SELECT * FROM classes').length, 1);
  assert.equal(one(env, 'SELECT note FROM subscriptions').note, 'x DELETE FROM classes --');
});

test('a licence code is 12 characters, printed once, stored as SHA-256', () => {
  const code = licenceCode();
  assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  const b = build('grant-school', { classes: '5', seats: '35', until: '2027-08-31', invoice: 'INV-9' }, fixed);
  assert.equal(b.print, 'Licence code (shown once; give it to the school): ABCD-EFGH-JKLM');
  assert.ok(!b.sql.includes('ABCD-EFGH-JKLM') && !b.sql.includes('ABCDEFGHJKLM'), 'the code itself is not stored');
  const env = makeEnv();
  run(env, b.sql);
  const row = one(env, 'SELECT * FROM licence_codes');
  assert.equal(row.code_hash, createHash('sha256').update('ABCDEFGHJKLM').digest('hex'));
  assert.equal(row.code_hash, licenceHash('abcd-efgh-jklm'));
  assert.equal(row.classes_left, 5); assert.equal(row.expires_at, '2027-01-09T10:00:00.000Z');
});

test('grant-family upserts the account and a term plan; cancel and forget write what the API would', () => {
  const env = makeEnv();
  run(env, build('grant-family', { email: 'Parent@Example.test', until: '2027-01-31' }, fixed).sql);
  const sub = one(env, 'SELECT s.*, a.email FROM subscriptions s JOIN accounts a ON a.id = s.account_id');
  assert.equal(sub.email, 'parent@example.test'); assert.equal(sub.plan, 'term'); assert.equal(sub.kind, 'family');
  run(env, build('cancel', { id: sub.id, mode: 'period_end' }, fixed).sql);
  const c = one(env, 'SELECT * FROM subscriptions');
  assert.equal(c.status, 'canceled'); assert.equal(c.cancel_requested_at, NOW); assert.equal(c.cancel_synced_at, null, 'the cron calls the provider');
  assert.ok(one(env, "SELECT * FROM notices WHERE kind LIKE 'canceled:period_end:%'"));
  assert.throws(() => build('cancel', { id: sub.id, mode: 'later' }, fixed), InputError);
  // the owner's end: ended now, and the provider is told to stop charging (the cron's retry)
  const env2 = makeEnv();
  run(env2, build('grant-family', { email: 'end@example.test', until: '2027-01-31' }, fixed).sql);
  const s2 = one(env2, 'SELECT id FROM subscriptions');
  run(env2, build('end', { id: s2.id }, fixed).sql);
  const e2 = one(env2, 'SELECT status, ended_reason, cancel_requested_at, cancel_at_period_end FROM subscriptions');
  assert.equal(e2.status, 'ended'); assert.equal(e2.ended_reason, 'owner'); assert.equal(e2.cancel_requested_at, NOW); assert.equal(e2.cancel_at_period_end, 1);
  // a class bound to the account loses its owner and stays (it keeps opening with its teacher key)
  env.DB.raw.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES ('ABC234', 'ז׳3', '7', 'רונית', 'x', ?)").run(NOW);
  env.DB.raw.prepare('INSERT INTO class_owners (class_code, account_id, bound_at) VALUES (?, ?, ?)').run('ABC234', sub.account_id, NOW);
  run(env, build('forget', { email: 'parent@example.test' }, fixed).sql);
  assert.equal(rows(env, 'SELECT * FROM accounts').length, 0);
  assert.equal(rows(env, 'SELECT * FROM class_owners').length, 0);
  assert.equal(rows(env, 'SELECT * FROM classes').length, 1);
  const f = one(env, 'SELECT * FROM subscriptions');
  assert.equal(f.account_id, null); assert.equal(f.status, 'ended'); assert.equal(f.ended_reason, 'account_deleted');
});

test('read-only commands are marked read-only; arguments parse as --name value and --flag', () => {
  assert.equal(build('list', { status: 'active' }, fixed).readOnly, true);
  assert.equal(build('events', { outcome: 'mismatch' }, fixed).readOnly, true);
  assert.throws(() => build('events', { outcome: "x' OR 1=1" }, fixed), InputError);
  assert.deepEqual(parseArgs(['grant-class', '--class', 'ABC234', '--trial', '--seats', '10', '--local']), { cmd: 'grant-class', o: { class: 'ABC234', trial: true, seats: '10', local: true } });
});

test('reports lists reported AI answers, read-only, newest first, from a Jerusalem day; never a person', () => {
  const env = makeEnv();
  const ins = env.DB.raw.prepare('INSERT INTO answer_reports (created_at, reason, kind, reply, tier) VALUES (?, ?, ?, ?, ?)');
  ins.run('2026-11-08T21:59:00.000Z', 'other', 'chat', 'לפני', 'free'); // 23:59 on 8 November in Jerusalem
  ins.run('2026-11-08T22:00:00.000Z', 'wrong_math', 'explain', 'מ־9 בנובמבר', 'family');
  ins.run('2026-11-10T09:00:00.000Z', 'not_for_kids', 'check', 'היום', '');
  const b = build('reports', { since: '2026-11-09' }, fixed);
  assert.equal(b.readOnly, true);
  assert.match(b.sql, /^SELECT id, created_at, reason, kind, tier, reply FROM answer_reports WHERE created_at >= '2026-11-08T22:00:00.000Z' ORDER BY created_at DESC LIMIT 200;$/);
  assert.deepEqual(env.DB.raw.prepare(b.sql).all().map((r) => r.reply), ['היום', 'מ־9 בנובמבר']);
  assert.equal(env.DB.raw.prepare(build('reports', {}, fixed).sql).all().length, 3);
  for (const since of ['2026-13-01', "2026-11-09' OR 1=1 --", 'yesterday']) assert.throws(() => build('reports', { since }, fixed), InputError, since);
  assert.match(HELP, /^ {2}reports \[--since D\]/m);
  for (const cmd of ['grant-class', 'grant-school', 'grant-family', 'end', 'cancel', 'refund', 'clear-hold', 'revoke-device', 'forget', 'list', 'requests', 'request-done', 'usage', 'events', 'reports']) {
    assert.match(HELP, new RegExp(`^ {2}${cmd}\\b`, 'm'), `${cmd} is in the help`);
    if (cmd !== 'reports') assert.doesNotThrow(() => { try { build(cmd, {}, fixed); } catch (e) { if (!(e instanceof InputError)) throw e; } }, cmd);
  }
});

test('the Ministry\'s rules (TRUST-11): run as a process, grant-school and grant-class stop before wrangler with exit 1', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = new URL('../scripts/owner.mjs', import.meta.url).pathname;
  const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, MOE_AI_APPROVAL: 'none', ...env }, timeout: 20_000 });
  const school = run(['grant-school', '--classes', '2', '--seats', '30', '--until', '2099-08-31', '--invoice', 'INV-1', '--local']);
  assert.equal(school.status, 1);
  assert.match(school.stderr, /refused: a school licence code is for school classes/);
  assert.doesNotMatch(school.stdout + school.stderr, /wrangler|done/i);
  const noNote = run(['grant-school', '--classes', '2', '--seats', '30', '--until', '2099-08-31', '--invoice', 'INV-1', '--private-ok', '--local']);
  assert.equal(noNote.status, 1);
  assert.match(noNote.stderr, /--note/);
  // a bad argument is refused the same way, before any database read
  const bad = run(['grant-class', '--class', 'nope', '--until', '2099-08-31', '--seats', '30', '--local']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /bad class code/);
});

test('with --private-ok the audit row of a grant records privateOk and the note', () => {
  const c = build('grant-class', { class: 'ABC234', until: '2027-08-31', seats: '20', 'private-ok': true, note: 'מרכז תגבור פרטי' }, fixed);
  assert.ok(c.sql.includes('"privateOk":true,"note":"מרכז תגבור פרטי"'));
  const s = build('grant-school', { classes: '2', seats: '20', until: '2027-08-31', invoice: 'INV-3', 'private-ok': true, note: 'רשת חוגים' }, fixed);
  assert.ok(s.sql.includes('"privateOk":true,"note":"רשת חוגים"'));
  assert.ok(!build('grant-class', { class: 'ABC234', until: '2027-08-31', seats: '20' }, fixed).sql.includes('privateOk'));
});

// ---------------------------------------------------------------- a Gefen order (TEACHER-12 §2)
/** cli() with a fake wrangler: the environment's approval, and what would have been written. */
function gefenIo(env, approval) {
  const out = []; const err = []; const execs = [];
  return {
    out, err, execs,
    io: {
      env: { MOE_AI_APPROVAL: approval }, query: async () => null, rows: async () => [],
      exec: async (b) => { execs.push(b); env.DB.raw.exec(b.sql); return '[]'; },
      prompt: async () => { throw new Error('a Gefen grant never asks'); },
      log: (...a) => out.push(a.join(' ')), error: (...a) => err.push(a.map(String).join(' ')),
    },
  };
}
const GEFEN_ARGS = ['grant-school', '--classes', '3', '--seats', '30', '--until', '2099-08-31', '--invoice', 'INV-7', '--gefen', '778899', '--local'];

test('grant-school --gefen: approved, the code\'s note is gefen:778899 (a class that claims it carries it: teacher.test.js)', async () => {
  const env = makeEnv();
  const { io, out, err, execs } = gefenIo(env, 'approved');
  assert.equal(await cli(GEFEN_ARGS, io), 0, err.join('\n'));
  assert.equal(execs.length, 1);
  assert.match(execs[0].sql, /VALUES \('[0-9a-f]{64}', 30, 3, '2099-08-31T21:00:00\.000Z', 'INV-7', 'gefen:778899', /);
  assert.ok(execs[0].sql.includes('"gefen":"778899"'), 'the audit row names the order');
  const row = one(env, 'SELECT note, invoice_ref, classes_left FROM licence_codes');
  assert.deepEqual({ ...row }, { note: 'gefen:778899', invoice_ref: 'INV-7', classes_left: 3 });
  assert.match(out.at(-1), /^Licence code \(shown once; give it to the school\): /);
  // build() alone: the same note
  const b = build('grant-school', { classes: '2', seats: '20', until: '2027-08-31', invoice: 'INV-8', gefen: 'GF-2027-15' }, fixed);
  assert.ok(b.sql.includes("'INV-8', 'gefen:GF-2027-15'"));
});

test('grant-school --gefen while MOE_AI_APPROVAL is "none": refused as any school code, nothing written', async () => {
  const env = makeEnv();
  const { io, err, execs } = gefenIo(env, 'none');
  assert.equal(await cli(GEFEN_ARGS, io), 1);
  assert.match(err.join('\n'), /refused: a school licence code is for school classes/);
  assert.equal(execs.length, 0);
  assert.equal(rows(env, 'SELECT * FROM licence_codes').length, 0);
});

test('a bad Gefen reference, or --gefen with --note or --private-ok, is refused before anything is asked or written', async () => {
  for (const [approval, extra, re] of [
    ['approved', ['--gefen', '778 899;'], /bad Gefen order reference: 778 899;/],
    ['none', ['--gefen', "778899'; DROP"], /bad Gefen order reference/],
    ['approved', ['--gefen', 'x'.repeat(41)], /at most 40/],
    ['approved', ['--gefen'], /bad Gefen order reference/],
    ['approved', ['--gefen', '778899', '--note', 'pilot'], /--gefen or --note, not both/],
    ['none', ['--gefen', '778899', '--private-ok', '--note', 'x'], /--gefen or --note|does not go with --private-ok/],
  ]) {
    const env = makeEnv();
    const { io, err, execs } = gefenIo(env, approval);
    const args = ['grant-school', '--classes', '2', '--seats', '30', '--until', '2099-08-31', '--invoice', 'INV-1', ...extra, '--local'];
    assert.equal(await cli(args, io), 1, extra.join(' '));
    assert.match(err.join('\n'), re, extra.join(' '));
    assert.equal(execs.length, 0);
  }
  assert.throws(() => build('grant-school', { classes: '2', seats: '30', until: '2099-08-31', invoice: 'INV-1', gefen: '778 899;' }, fixed), InputError);
});

test('list --gefen shows the classes of Gefen orders; list --gefen <ref> one order', () => {
  const all = build('list', { gefen: true }, fixed);
  assert.equal(all.readOnly, true);
  assert.ok(all.sql.includes("WHERE s.note LIKE 'gefen:%'"));
  const one778 = build('list', { gefen: '778899', status: 'active' }, fixed);
  assert.ok(one778.sql.includes("WHERE s.status = 'active' AND s.note = 'gefen:778899'"));
  assert.throws(() => build('list', { gefen: "7'; --" }, fixed), InputError);
  // against the database: a class that redeemed a Gefen code, one granted by hand
  const env = withClass();
  env.DB.raw.prepare("INSERT INTO classes (code, name, grade, teacher_name, teacher_key_hash, created_at) VALUES ('DEF567', 'ח׳1', '8', 'נועם', 'x', ?)").run(NOW);
  const sub = env.DB.raw.prepare(`INSERT INTO subscriptions (id, kind, account_id, class_code, plan, status, provider, seats, invoice_ref, current_period_start, current_period_end, note, created_at, updated_at)
    VALUES (?, 'class', NULL, ?, 'term', 'active', 'manual', 30, ?, ?, '2099-08-31T21:00:00.000Z', ?, ?, ?)`);
  sub.run('1111111111111111', 'ABC234', 'INV-7', NOW, 'gefen:778899', NOW, NOW);
  sub.run('2222222222222222', 'DEF567', 'INV-9', NOW, 'pilot', NOW, NOW);
  assert.deepEqual(rows(env, all.sql).map((r) => [r.class_code, r.note, r.invoice_ref]), [['ABC234', 'gefen:778899', 'INV-7']]);
  assert.deepEqual(rows(env, build('list', { gefen: '123' }, fixed).sql), []);
  assert.equal(rows(env, build('list', {}, fixed).sql).length, 2);
});

test('unbind-class: a mistaken bind is undone by support; the class keeps opening with its key, and the audit row says so', () => {
  const env = withClass();
  env.DB.raw.prepare("INSERT INTO accounts (id, email, created_at) VALUES ('acc1', 'coteacher@example.test', ?)").run(NOW);
  env.DB.raw.prepare('INSERT INTO class_owners (class_code, account_id, bound_at) VALUES (?, ?, ?)').run('ABC234', 'acc1', NOW);
  const b = build('unbind-class', { class: 'abc234' }, fixed);
  assert.equal(b.readOnly, false);
  run(env, b.sql);
  assert.equal(rows(env, 'SELECT * FROM class_owners').length, 0);
  assert.equal(rows(env, 'SELECT * FROM classes').length, 1, 'the class stays');
  assert.deepEqual({ ...one(env, "SELECT actor, action, target, detail FROM audit_log WHERE action = 'class.unbind'") },
    { actor: 'owner:cli', action: 'class.unbind', target: 'class:ABC234', detail: '{"by":"owner"}' });
  assert.throws(() => build('unbind-class', { class: 'nope' }, fixed), InputError);
});

test('the owner\'s revoke-device and forget delete the devices\' daily summaries first (PARENTS-3), also with the FK cascade off', () => {
  const env = makeEnv();
  env.DB.raw.exec('PRAGMA foreign_keys = OFF');
  run(env, build('grant-family', { email: 'rows@example.test', until: '2027-01-31' }, fixed).sql);
  const a = one(env, 'SELECT id FROM accounts').id;
  const dev = (id) => env.DB.raw.prepare("INSERT INTO family_devices (id, account_id, token_hash, label, created_at, last_seen) VALUES (?, ?, ?, '', ?, '2026-11-10')").run(id, a, `h${id}`, NOW);
  const day = (id) => env.DB.raw.prepare("INSERT INTO family_daily (device_id, day, updated_at) VALUES (?, '2026-11-10', 'x')").run(id);
  dev('aaaaaaaaaaaaaaaa'); dev('bbbbbbbbbbbbbbbb'); day('aaaaaaaaaaaaaaaa'); day('bbbbbbbbbbbbbbbb');
  const revoke = build('revoke-device', { id: 'aaaaaaaaaaaaaaaa' }, fixed).sql;
  assert.ok(revoke.indexOf('DELETE FROM family_daily') < revoke.indexOf('DELETE FROM family_devices'));
  run(env, revoke);
  assert.deepEqual(rows(env, 'SELECT device_id FROM family_daily').map((r) => r.device_id), ['bbbbbbbbbbbbbbbb']);
  run(env, build('forget', { email: 'rows@example.test' }, fixed).sql);
  assert.equal(rows(env, 'SELECT * FROM family_daily').length, 0);
  assert.equal(rows(env, 'SELECT * FROM family_devices').length, 0);
});

// ---------------------------------------------------------------- reach (STUDENT-14)
const REACH_EXPECTED = `Reach, 2026-10-11 to 2026-11-10 (Jerusalem days; a week starts on Sunday; * this week so far)
Counts of steps only: no person, device or address is behind any number.

week of                                10-11   10-18   10-25   11-01  11-08*   total
Landing pages
  landing_view_mivchan                    71      52      47      66      25     261
  landing_cta_mivchan                      9      12      10      15       6      52
  landing_view_pilot                       0       8       0      11       0      19
  landing_cta_pilot                        0       0       0       2       0       2
  welcome_from_landing                     7      10       9      13       5      44
Install
  install_offer                            6       9       8      12       3      38
  install_accept                           2       4       3       6       0      15
  installed                                2       4       3       5       1      15
  accepted per offer                     33%     44%     38%     50%      0%     39%
Reminders
  push_offer                               0       0       0       0       0       0
  push_on                                  0       0       0       0       0       0
  push_off                                 0       0       0       0       0       0
  push_open                                0       0       0       0       0       0
Store apps
  store_open_play                          0       0       0       0       0       0
  store_open_ios                           0       0       0       0       0       0
In the app
  wardrobe_open                           21      30      26      34       8     119
  recap_open                               0       0       0       0       0       0
Classes
  class_goal_reached                       0       0       1       2       0       3
  students who learned (class_steps)       3       5       6       8       3       8
Families
  (no family_daily table on this database yet)

Kept: metrics_daily 400 days, class_steps 120 days. A student is counted once a week however much they learned.`;

test('reach on synthetic rows prints the weekly table (snapshot); family_daily is read only where it exists', () => {
  const env = makeEnv();
  const db = env.DB.raw;
  // on the main branch schema.sql has the parents lane's family_daily (0006_parent_report): a database without that
  // migration yet is one without the table
  db.exec('DROP TABLE family_daily');
  seedReach(db);
  const ran = [];
  const query = (stmts) => { ran.push(...stmts); return stmts.map((s) => db.prepare(s).all()); };
  assert.equal(reach({ days: '28' }, query, new Date(REACH_NOW)), REACH_EXPECTED);
  assert.ok(!ran.some((s) => s.includes('FROM family_daily')), 'no statement names a table that is not there');
  // every statement reads counts only: no column that names a person comes back
  for (const s of ran) for (const row of db.prepare(s).all()) assert.deepEqual(Object.keys(row).filter((k) => !['week', 'name', 'n'].includes(k)), [], s);
  // with the parents lane's table: its devices that learned, per week and in all
  seedFamily(db);
  const withFamily = reach({}, query, new Date(REACH_NOW));
  assert.equal(withFamily, REACH_EXPECTED.replace('  (no family_daily table on this database yet)', '  linked devices that learned              1       2       0       3       1       3'));
});

test('reach --days: whole weeks from the Sunday before, 1 to 400 days', () => {
  const now = new Date(REACH_NOW);
  assert.deepEqual(reachPlan({ days: '1' }, now).weeks, ['2026-11-08']);
  assert.deepEqual(reachPlan({ days: '3' }, now).weeks, ['2026-11-08'], 'Sunday to Tuesday');
  assert.deepEqual(reachPlan({ days: '4' }, now).weeks, ['2026-11-01', '2026-11-08']);
  assert.equal(reachPlan({}, now).days, 28);
  assert.equal(reachPlan({ days: '400' }, now).weeks.length, 58);
  for (const days of ['0', '401', '7.5', "7'; DROP TABLE metrics_daily; --"]) assert.throws(() => reachPlan({ days }, now), InputError, days);
  assert.deepEqual(parseArgs(['reach', '--days', '14', '--local']), { cmd: 'reach', o: { days: '14', local: true } });
});

test('cli reach: the statements run read-only through the io (never a file), and the table is printed', async () => {
  const env = makeEnv();
  const db = env.DB.raw;
  seedReach(db);
  const out = []; const ran = [];
  const io = {
    env: {}, statements: async (sqls) => { ran.push(...sqls); return sqls.map((x) => db.prepare(x).all()); },
    exec: async () => { throw new Error('reach never writes'); },
    log: (...a) => out.push(a.join(' ')), error: (...a) => out.push(a.join(' ')),
  };
  assert.equal(await cli(['reach', '--days', '28', '--local'], io), 0, out.join('\n'));
  assert.match(out[0], /^Reach, /);
  assert.match(out[0], /students who learned \(class_steps\)/);
  assert.match(out[0], /linked devices that learned/, 'family_daily is on the main branch schema');
  assert.ok(ran.every((x) => /^SELECT /.test(x)));
  assert.match(HELP, /^ {2}reach \[--days 28\]/m);
});
