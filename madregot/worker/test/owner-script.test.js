// The owner's CLI: input rules, the SQL it builds (run here against the in-memory database, never through wrangler),
// and the licence codes it prints once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build, parseArgs, licenceCode, licenceHash, noteArg, InputError } from '../scripts/owner.mjs';
import { endOfDayIso } from '../src/util.js';
import { makeEnv, rows, one } from './helpers.js';

const NOW = '2026-11-10T10:00:00.000Z';
const fixed = { now: NOW, id: '0123456789abcdef', code: 'ABCD-EFGH-JKLM' };
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
  run(env, build('forget', { email: 'parent@example.test' }, fixed).sql);
  assert.equal(rows(env, 'SELECT * FROM accounts').length, 0);
  const f = one(env, 'SELECT * FROM subscriptions');
  assert.equal(f.account_id, null); assert.equal(f.status, 'ended'); assert.equal(f.ended_reason, 'account_deleted');
});

test('read-only commands are marked read-only; arguments parse as --name value and --flag', () => {
  assert.equal(build('list', { status: 'active' }, fixed).readOnly, true);
  assert.equal(build('events', { outcome: 'mismatch' }, fixed).readOnly, true);
  assert.throws(() => build('events', { outcome: "x' OR 1=1" }, fixed), InputError);
  assert.deepEqual(parseArgs(['grant-class', '--class', 'ABC234', '--trial', '--seats', '10', '--local']), { cmd: 'grant-class', o: { class: 'ABC234', trial: true, seats: '10', local: true } });
});
