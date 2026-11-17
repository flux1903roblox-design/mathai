// The waitlist for the store apps (src/waitlist.js): POST /api/waitlist checks every field and the consent, keeps one
// row per address and answers the same whether or not the address was there, never echoes what was sent, drops a
// filled honeypot quietly, counts per network and for everyone, refuses other sites, closes on the launch day and is
// purged by the night job; the owner's command reads counts, exports the addresses and removes one. In-memory D1, every
// address synthetic (example.test); nothing leaves the machine.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setup, rows, one, setCount, netOf, makeEnv, signIn, accountId } from './helpers.js';
import {
  WAITLIST_CAPS, WAITLIST_BODY_MAX, cleanSignup, cleanSource, cleanPlatform, waitlistCutoff, purgeWaitlistSql, launchDay, waitlistClosed,
} from '../src/waitlist.js';
import { purge, purgeRecordsSql } from '../src/cron.js';
import { forgetAccount } from '../src/forget.js';
import { edgeGuard, WRITE_ROUTES } from '../src/edge.js';
import { routePattern } from '../src/errors.js';
import { RETENTION as R } from '../../shared/retention.js';
import { dayOf, startOfDayIso } from '../src/util.js';
import {
  build, cli, waitlistReport, waitlistCsv, WAITLIST_SQL, WAITLIST_EXPORT_SQL, EXPORT_WARNING, launchedVar, HELP,
} from '../scripts/owner.mjs';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const OK = { email: 'Parent.One@Example.test ', role: 'parent', grade: '7', platform: 'ios', consent: true };
const join = (body, opts = {}) => h.call('POST', '/api/waitlist', { body, ...opts });
const listed = () => rows(h.env, 'SELECT email, role, grade, platform, source FROM waitlist ORDER BY id').map((r) => ({ ...r }));
const form = (pairs, opts = {}) => h.call('POST', '/api/waitlist', {
  body: new URLSearchParams(pairs).toString(), ...opts, headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
});

test('a signup is kept as cleaned fields only, and the answer is 201 { ok: true } with nothing of what was sent', async () => {
  h = await setup();
  const r = await join({ ...OK, utm_source: 'Instagram', utm_campaign: 'Launch 1!' });
  assert.equal(r.status, 201);
  assert.equal(await r.text(), '{"ok":true}');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.ok(r.headers.get('Access-Control-Allow-Origin'), 'the CORS headers of every answer');
  assert.deepEqual(listed(), [{ email: 'parent.one@example.test', role: 'parent', grade: '7', platform: 'ios', source: 'instagram/launch1' }]);
  const row = one(h.env, 'SELECT * FROM waitlist');
  assert.deepEqual(Object.keys(row).sort(), ['consent_at', 'created_at', 'email', 'grade', 'id', 'platform', 'role', 'source']);
  assert.match(row.consent_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(row.consent_at, row.created_at);
  // no address of the request is anywhere in the database: only the network's keyed hash in a counter
  const all = JSON.stringify(rows(h.env, 'SELECT * FROM ai_usage')) + JSON.stringify(rows(h.env, 'SELECT * FROM waitlist'));
  assert.ok(!all.includes('203.0.113.7'));
  assert.equal(routePattern('/api/waitlist'), '/api/waitlist', 'a server error here is counted under its own pattern');
});

test('every field is checked: email, role, grade and phone; consent is required', async () => {
  h = await setup();
  const bad = [
    [{ ...OK, email: 'not an email' }, 'bad_email'], [{ ...OK, email: '' }, 'bad_email'], [{ ...OK, email: `${'a'.repeat(250)}@example.test` }, 'bad_email'],
    [{ ...OK, role: undefined }, 'bad_role'], [{ ...OK, role: 'admin' }, 'bad_role'],
    [{ ...OK, grade: '9' }, 'bad_grade'], [{ ...OK, grade: 'ז' }, 'bad_grade'],
    [{ ...OK, platform: 'windows' }, 'bad_platform'], [{ ...OK, platform: ['ios', 'ios', 'android'] }, 'bad_platform'],
    [{ ...OK, consent: false }, 'consent_needed'], [{ ...OK, consent: undefined }, 'consent_needed'], [{ ...OK, consent: 'no' }, 'consent_needed'],
  ];
  for (const [body, code] of bad) {
    const r = await join(body);
    assert.equal(r.status, 400, code);
    const out = await r.json();
    assert.equal(out.error, code);
    assert.ok(!JSON.stringify(out).includes('example.test'), 'an error does not echo the address either');
  }
  assert.equal((await join('{not json')).status, 400);
  assert.equal((await join('x'.repeat(WAITLIST_BODY_MAX + 1))).status, 413);
  assert.deepEqual(listed(), [], 'nothing stored by a refused signup');
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'wait:%'").length, 0, 'and none of the limits used');
  // what may be left out: grade and phone (a teacher of both grades, someone who has not decided)
  assert.equal((await join({ email: 'teacher@example.test', role: 'teacher', consent: true })).status, 201);
  assert.equal((await join({ email: 'kid@example.test', role: 'student', grade: 8, platform: '', consent: 'on' })).status, 201);
  assert.deepEqual(listed().slice(-2), [
    { email: 'teacher@example.test', role: 'teacher', grade: null, platform: null, source: null },
    { email: 'kid@example.test', role: 'student', grade: '8', platform: null, source: null },
  ]);
});

test('the helpers: phones, sources and the fields', () => {
  assert.equal(cleanPlatform(['ios', 'android']), 'both');
  assert.equal(cleanPlatform(['android']), 'android');
  assert.equal(cleanPlatform('both'), 'both');
  assert.equal(cleanPlatform(undefined), null);
  assert.equal(cleanSource('IG', ''), 'ig');
  assert.equal(cleanSource('', 'חנוכה'), '-/חנוכה');
  assert.equal(cleanSource('fb ads<script>', 'x@y.test'), 'fbadsscript/xy.test');
  assert.equal(cleanSource('a'.repeat(80), 'b'.repeat(80)).length, 61);
  assert.equal(cleanSource(null, undefined), null);
  assert.deepEqual(cleanSignup({ ...OK, utm_source: 'share' }), { email: 'parent.one@example.test', role: 'parent', grade: '7', platform: 'ios', source: 'share' });
});

test('the same address twice: the same answer, one row, and the first signup unchanged', async () => {
  h = await setup();
  const a = await join(OK);
  const b = await join({ ...OK, email: 'PARENT.ONE@example.test', role: 'teacher', grade: '8', platform: 'android' });
  assert.equal(a.status, b.status);
  assert.equal(await a.text(), await b.text());
  assert.deepEqual([...a.headers.keys()].sort(), [...b.headers.keys()].sort());
  assert.deepEqual(listed(), [{ email: 'parent.one@example.test', role: 'parent', grade: '7', platform: 'ios', source: null }]);
});

test('the honeypot: a filled "website" gets the same 201 and nothing is kept or counted', async () => {
  h = await setup();
  const r = await join({ ...OK, website: 'https://spam.example.test' });
  assert.equal(r.status, 201);
  assert.equal(await r.text(), '{"ok":true}');
  assert.deepEqual(listed(), []);
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'wait:%'").length, 0);
});

test('limits: per network an hour and a day, and for everyone a day (the owner hears once); past one nothing is kept', async () => {
  h = await setup();
  const net = await netOf(h.env);
  for (let i = 0; i < WAITLIST_CAPS.netHour; i++) assert.equal((await join({ ...OK, email: `p${i}@example.test` })).status, 201, `signup ${i}`);
  const over = await join({ ...OK, email: 'late@example.test' });
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error, 'too_many_signups');
  assert.equal(over.headers.get('Retry-After'), '3600');
  assert.equal(listed().length, WAITLIST_CAPS.netHour);
  // another network is not held back by this one
  assert.equal((await join({ ...OK, email: 'other@example.test' }, { ip: '198.51.100.20' })).status, 201);
  // the network's day
  await setCount(h.env, `wait:n:${net}:day`, WAITLIST_CAPS.netDay);
  // as in the next hour: the hour's count starts again, the day's does not
  h.env.DB.raw.prepare('UPDATE ai_usage SET count = 0 WHERE who = ?').run(`wait:n:${net}`);
  assert.equal((await join({ ...OK, email: 'day@example.test' })).status, 429);
  // everyone's day: 429 waitlist_busy, and one notice to the owner however often it trips
  await setCount(h.env, 'wait:all', WAITLIST_CAPS.all);
  for (const ip of ['198.51.100.30', '198.51.100.31']) {
    const r = await join({ ...OK, email: `${ip}@example.test` }, { ip });
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, 'waitlist_busy');
  }
  const notices = rows(h.env, "SELECT kind FROM notices WHERE kind LIKE 'owner:waitlist_cap:%'");
  assert.equal(notices.length, 1);
  assert.deepEqual(WAITLIST_CAPS, { netHour: 10, netDay: 30, all: 2000 });
});

test('a page on another site may not post here (a form post needs no preflight); this Worker\'s own page and ALLOWED_ORIGINS may', async () => {
  h = await setup();
  const r = await join(OK, { headers: { Origin: 'https://evil.example.test' } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'bad_origin');
  assert.equal((await join({ ...OK, email: 'a@example.test' }, { headers: { Origin: 'null' } })).status, 403);
  assert.equal((await join({ ...OK, email: 'b@example.test' }, { headers: { Origin: 'https://madregot.test' } })).status, 201);
  assert.equal((await join({ ...OK, email: 'c@example.test' }, { headers: { Origin: 'http://localhost:5173' } })).status, 201);
  assert.deepEqual(listed().map((x) => x.email), ['b@example.test', 'c@example.test']);
});

test('a plain form post (no script on the page): 303 back to the page, at "joined", "oops" or "closed"', async () => {
  h = await setup();
  const ok = await form([['email', 'form@example.test'], ['role', 'student'], ['grade', '8'], ['platform', 'ios'], ['platform', 'android'], ['consent', 'on'], ['website', '']], { headers: { Origin: 'https://madregot.test' } });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('Location'), '/waitlist/#joined');
  assert.equal(await ok.text(), '');
  assert.deepEqual(listed(), [{ email: 'form@example.test', role: 'student', grade: '8', platform: 'both', source: null }]);
  const noConsent = await form([['email', 'x@example.test'], ['role', 'parent']]);
  assert.equal(noConsent.status, 303);
  assert.equal(noConsent.headers.get('Location'), '/waitlist/#oops');
  const elsewhere = await form([['email', 'y@example.test'], ['role', 'parent'], ['consent', 'on']], { headers: { Origin: 'https://evil.example.test' } });
  assert.equal(elsewhere.headers.get('Location'), '/waitlist/#oops');
  assert.equal(listed().length, 1);
  h.env.WAITLIST_LAUNCHED_AT = dayOf();
  const closed = await form([['email', 'z@example.test'], ['role', 'parent'], ['consent', 'on']]);
  assert.equal(closed.headers.get('Location'), '/waitlist/#closed');
});

test('the launch day closes the list (410), and from 30 days after it the night purge deletes every row', async () => {
  h = await setup({ WAITLIST_LAUNCHED_AT: '2099-01-01' });
  assert.equal(launchDay(h.env), '2099-01-01');
  assert.equal(waitlistClosed(h.env), false, 'a day still to come keeps the list open');
  assert.equal((await join(OK)).status, 201);
  for (const v of ['', 'soon', '2026-02-30']) assert.equal(launchDay({ WAITLIST_LAUNCHED_AT: v }), null, v);
  h.env.WAITLIST_LAUNCHED_AT = dayOf();
  const r = await join({ ...OK, email: 'after@example.test' });
  assert.equal(r.status, 410);
  assert.equal((await r.json()).error, 'waitlist_closed');
  assert.equal(listed().length, 1);
  // the purge's cutoff: a year back while not launched; everything once 30 days have passed since the launch day began
  const launched = '2030-03-01';
  const start = Date.parse(startOfDayIso(launched));
  const before = new Date(start + (R.waitlistAfterLaunchDays * DAY) - 60_000);
  const after = new Date(start + (R.waitlistAfterLaunchDays * DAY));
  assert.equal(waitlistCutoff({}, after), new Date(after.getTime() - R.waitlistMaxDays * DAY).toISOString());
  assert.equal(waitlistCutoff({ WAITLIST_LAUNCHED_AT: launched }, before), new Date(before.getTime() - R.waitlistMaxDays * DAY).toISOString());
  assert.equal(waitlistCutoff({ WAITLIST_LAUNCHED_AT: launched }, after), after.toISOString());
  const prepared = [];
  const env = { WAITLIST_LAUNCHED_AT: launched, DB: { prepare: (sql) => { const s = { sql, bind: (...a) => { s.args = a; prepared.push(s); return s; } }; return s; } } };
  purgeWaitlistSql(env, after);
  assert.deepEqual(prepared.map((s) => [s.sql, s.args]), [['DELETE FROM waitlist WHERE created_at < ?', [after.toISOString()]]]);
  // the night job's batch carries it
  prepared.length = 0;
  purgeRecordsSql(env, after);
  assert.deepEqual(prepared.filter((s) => /waitlist/.test(s.sql)).map((s) => s.args), [[after.toISOString()]]);
});

test('retention on a real database: 365 days after the signup, or every row 30 days after the launch day', async () => {
  h = await setup();
  const add = (email, daysAgo) => h.env.DB.raw.prepare("INSERT INTO waitlist (email, role, consent_at, created_at) VALUES (?, 'parent', ?, ?)")
    .run(email, new Date(Date.now() - daysAgo * DAY).toISOString(), new Date(Date.now() - daysAgo * DAY).toISOString());
  add('old@example.test', R.waitlistMaxDays + 1);
  add('year@example.test', R.waitlistMaxDays - 1);
  add('new@example.test', 2);
  await purge(h.env);
  assert.deepEqual(listed().map((x) => x.email), ['year@example.test', 'new@example.test']);
  // launched 29 days ago: kept; 31 days ago: all gone
  h.env.WAITLIST_LAUNCHED_AT = dayOf(new Date(Date.now() - 29 * DAY));
  await purge(h.env);
  assert.equal(listed().length, 2);
  h.env.WAITLIST_LAUNCHED_AT = dayOf(new Date(Date.now() - (R.waitlistAfterLaunchDays + 1) * DAY));
  await purge(h.env);
  assert.deepEqual(listed(), []);
});

test('an account deleted with the same email takes its waitlist row with it; another address stays', async () => {
  h = await setup();
  await join({ ...OK, email: 'same@example.test' });
  await join({ ...OK, email: 'stays@example.test' });
  await signIn(h, 'same@example.test');
  await forgetAccount(h.env, accountId(h.env, 'same@example.test'), { actor: 'test' });
  assert.deepEqual(listed().map((x) => x.email), ['stays@example.test']);
});

test('the edge limiter: the waitlist has its own key on RL_WRITE, by network, and is not a student write route', async () => {
  h = await setup();
  assert.ok(!WRITE_ROUTES.some((re) => re.test('/api/waitlist')));
  const keys = [];
  const env = { ...h.env, RL_WRITE: { limit: async ({ key }) => { keys.push(key); return { success: keys.length <= 1 }; } } };
  const req = () => new Request('https://madregot.test/api/waitlist', { method: 'POST', headers: { 'CF-Connecting-IP': '2001:db8:1:2:3::9' } });
  await edgeGuard('POST', '/api/waitlist', req(), env);
  await assert.rejects(() => edgeGuard('POST', '/api/waitlist', req(), env), (e) => e.status === 429 && e.code === 'slow_down');
  assert.equal(keys.length, 2);
  assert.match(keys[0], /^w:n:[a-f0-9]{16}$/);
  // without the binding (tests, wrangler dev) nothing is checked
  await edgeGuard('POST', '/api/waitlist', req(), h.env);
});

// ---------------------------------------------------------------- the owner's command
const seed = (db) => {
  const add = db.prepare('INSERT INTO waitlist (email, role, grade, platform, source, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  add.run('a@example.test', 'parent', '7', 'ios', 'instagram/launch', '2026-11-16T08:00:00.000Z', '2026-11-16T08:00:00.000Z');
  add.run('b@example.test', 'parent', '8', 'both', 'instagram/launch', '2026-11-16T22:30:00.000Z', '2026-11-16T22:30:00.000Z'); // 00:30 on 17 Nov in Jerusalem
  add.run('c@example.test', 'student', '7', 'android', 'share', '2026-11-17T10:00:00.000Z', '2026-11-17T10:00:00.000Z');
  add.run('=cmd@example.test', 'teacher', null, null, null, '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z');
};

test('owner waitlist: counts by day, role and phone, grade and source, and never an address', async () => {
  const env = makeEnv();
  seed(env.DB.raw);
  const out = []; const ran = [];
  const io = {
    env: {}, rows: async (sql) => { ran.push(sql); return env.DB.raw.prepare(sql).all(); },
    exec: async () => { throw new Error('the counts never write'); }, log: (...a) => out.push(a.join(' ')), error: (...a) => out.push(a.join(' ')),
  };
  assert.equal(await cli(['waitlist', '--local'], io), 0, out.join('\n'));
  assert.deepEqual(ran, [WAITLIST_SQL]);
  assert.doesNotMatch(WAITLIST_SQL, /email/);
  const text = out.join('\n');
  assert.doesNotMatch(text, /@/, 'no address is printed');
  const report = waitlistReport(env.DB.raw.prepare(WAITLIST_SQL).all(), { now: new Date('2026-11-17T12:00:00Z'), days: 28 });
  assert.match(report, /^Waitlist for the store apps: 4 addresses/);
  assert.match(report, /Open \(WAITLIST_LAUNCHED_AT is empty\)\. Each address is deleted 365 days after it joined/);
  const lines = report.split('\n');
  const at = lines.indexOf('Joined by day, 2026-10-21 to 2026-11-17: 3 in all');
  assert.deepEqual(lines.slice(at + 1, at + 3), ['  2026-11-16      1', '  2026-11-17      2'], 'Jerusalem days: 00:30 on the 17th is the 17th');
  const table = lines.slice(lines.indexOf('Who, by phone') + 1, lines.indexOf('Who, by phone') + 7);
  assert.deepEqual(table, [
    'who      n  iPhone  Android  both  not said',
    '-------  -  ------  -------  ----  --------',
    'parent   2  1       0        1     0',
    'student  1  0       1        0     0',
    'teacher  1  0       0        0     1',
    'all      4  1       1        1     1',
  ]);
  assert.match(report, /Grade: 7 \(ז׳\) 2, 8 \(ח׳\) 1, not said 1/);
  assert.match(report, /Phone in all: iPhone 2, Android 2/);
  assert.match(report, /Source \(utm_source\/utm_campaign\): instagram\/launch 2, \(none\) 1, share 1/);
  assert.match(waitlistReport([], { launched: '2027-03-01' }), /Closed: WAITLIST_LAUNCHED_AT is 2027-03-01\. Every address is deleted on 2027-03-31/);
  assert.equal(launchedVar({ WAITLIST_LAUNCHED_AT: '2027-03-01' }), '2027-03-01');
  assert.equal(launchedVar({}, 'WAITLIST_LAUNCHED_AT = ""\n'), '');
  for (const line of ['waitlist [--days 28]', 'waitlist --export F', 'waitlist --remove E']) assert.ok(HELP.includes(`  ${line}`), line);
});

test('owner waitlist --export: the CSV for the launch email, to a new file only its owner can read, with the warning', async () => {
  const env = makeEnv();
  seed(env.DB.raw);
  const dir = mkdtempSync(path.join(tmpdir(), 'waitlist-export-'));
  try {
    const file = path.join(dir, 'launch.csv');
    const out = [];
    const io = { env: {}, rows: async (sql) => env.DB.raw.prepare(sql).all(), log: (...a) => out.push(a.join(' ')), error: (...a) => out.push(a.join(' ')) };
    assert.equal(await cli(['waitlist', '--export', file, '--local'], io), 0, out.join('\n'));
    const csv = readFileSync(file, 'utf8');
    assert.equal(csv, waitlistCsv(env.DB.raw.prepare(WAITLIST_EXPORT_SQL).all()));
    assert.deepEqual(csv.trim().split('\n'), [
      'email,role,grade,platform,created_at',
      "'=cmd@example.test,teacher,,,2026-10-01T10:00:00.000Z", // a cell a spreadsheet would run as a formula is not one
      'a@example.test,parent,7,ios,2026-11-16T08:00:00.000Z',
      'b@example.test,parent,8,both,2026-11-16T22:30:00.000Z',
      'c@example.test,student,7,android,2026-11-17T10:00:00.000Z',
    ]);
    if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.match(out.join('\n'), /4 addresses written to /);
    assert.ok(out.includes(EXPORT_WARNING));
    assert.match(EXPORT_WARNING, /personal data[\s\S]*delete it/);
    // never over an existing file
    writeFileSync(path.join(dir, 'old.csv'), 'keep');
    const again = [];
    assert.equal(await cli(['waitlist', '--export', path.join(dir, 'old.csv')], { ...io, log: (...a) => again.push(a.join(' ')), error: (...a) => again.push(a.join(' ')) }), 1);
    assert.match(again.join('\n'), /already exists/);
    assert.equal(readFileSync(path.join(dir, 'old.csv'), 'utf8'), 'keep');
    assert.equal(await cli(['waitlist', '--export'], io), 1, 'a file name is needed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('owner waitlist --remove and forget: the address goes, the audit row names no address', async () => {
  const env = makeEnv();
  seed(env.DB.raw);
  const fixed = { now: '2026-11-17T12:00:00.000Z' };
  const b = build('waitlist-remove', { remove: ' A@Example.test' }, fixed);
  assert.equal(b.readOnly, false);
  env.DB.raw.exec(b.sql);
  assert.deepEqual(env.DB.raw.prepare('SELECT email FROM waitlist ORDER BY id').all().map((r) => r.email), ['b@example.test', 'c@example.test', '=cmd@example.test']);
  const audit = env.DB.raw.prepare("SELECT * FROM audit_log WHERE action = 'waitlist.remove'").all();
  assert.equal(audit.length, 1);
  assert.doesNotMatch(JSON.stringify(audit), /@/);
  assert.throws(() => build('waitlist-remove', { remove: 'nope' }, fixed), /bad email/);
  env.DB.raw.exec(build('forget', { email: 'b@example.test' }, fixed).sql);
  assert.deepEqual(env.DB.raw.prepare('SELECT email FROM waitlist ORDER BY id').all().map((r) => r.email), ['c@example.test', '=cmd@example.test']);
  // through the command line: it writes through wrangler's file path, like every change
  const ran = []; const out = [];
  const io = { env: {}, exec: async (x) => { ran.push(x); env.DB.raw.exec(x.sql); return ''; }, log: (...a) => out.push(a.join(' ')), error: (...a) => out.push(a.join(' ')) };
  assert.equal(await cli(['waitlist', '--remove', 'c@example.test', '--local'], io), 0, out.join('\n'));
  assert.equal(ran.length, 1);
  assert.match(out.join('\n'), /not any more/);
  assert.equal(await cli(['waitlist', '--remove', 'x@example.test', '--export', 'f.csv'], io), 1);
});
