// The waitlist for the store apps (src/waitlist.js): POST /api/waitlist takes no signup until the privacy notice names
// who holds the list and where to write (CONTACT_EMAIL, BUSINESS_NAME), takes parents and teachers only, checks every
// field and the consent, keeps one row per address and answers the same whether or not the address was there, never
// echoes what was sent, drops a filled honeypot quietly, counts per network (an IPv6 /48) and counts everyone without
// refusing, refuses other sites, closes on the launch day and is purged by the night job; the Worker sends the one
// launch email itself (s.30A: "פרסומת", the advertiser, a removal link) and the link removes the row; the owner's command
// reads counts, exports the record and removes one. In-memory D1, every address synthetic (example.test); Resend is a
// stub; nothing leaves the machine.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setup, rows, one, setCount, netOf, makeEnv, signIn, accountId } from './helpers.js';
import {
  WAITLIST_CAPS, WAITLIST_BODY_MAX, cleanSignup, cleanSource, cleanPlatform, waitlistCutoff, purgeWaitlistSql, launchDay, waitlistClosed,
  waitlistMissing, WAITLIST_NEEDS, formPart, launchMissing, sendLaunch, launchMessage, leaveToken, leaveUrl, storeLinks, ltrHtml, LAUNCH_TEXT,
  LEAVE_TEXT, LAUNCH_MAX_TRIES, WAITLIST_ROLES,
} from '../src/waitlist.js';
import { run } from '../src/cron.js';
import { HttpError, netKey, hourOf } from '../src/util.js';
import { business } from '../src/email.js';
import { readiness } from '../src/readiness.js';
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
/** A network's count for this hour (setCount sets a day's). */
const setHour = (env, who, n) => env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, ?) ON CONFLICT (who, day) DO UPDATE SET count = excluded.count')
  .run(who, hourOf(), n);
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
  assert.deepEqual(Object.keys(row).sort(), ['consent_at', 'created_at', 'email', 'grade', 'id', 'platform', 'role', 'sent_at', 'source', 'tries']);
  assert.equal(row.sent_at, null);
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
    // students are not asked for an email anywhere in the app: the page sends them to a parent
    [{ ...OK, role: 'student' }, 'bad_role'],
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
  assert.equal((await join({ email: 'mum@example.test', role: 'parent', grade: 8, platform: '', consent: 'on' })).status, 201);
  assert.deepEqual(listed().slice(-2), [
    { email: 'teacher@example.test', role: 'teacher', grade: null, platform: null, source: null },
    { email: 'mum@example.test', role: 'parent', grade: '8', platform: null, source: null },
  ]);
  assert.deepEqual(WAITLIST_ROLES, ['parent', 'teacher']);
  // and the database itself keeps no other role
  assert.throws(() => h.env.DB.raw.prepare("INSERT INTO waitlist (email, role, consent_at, created_at) VALUES ('s@example.test', 'student', 'x', 'x')").run(), /CHECK/);
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

test('limits: per network (an IPv6 /48) an hour and a day; everyone\'s day is counted, never refused, and the owner hears once', async () => {
  h = await setup();
  const net = await netOf(h.env);
  // an hour's worth from one network, then the next one is refused and nothing is kept
  setHour(h.env, `wait:n:${net}`, WAITLIST_CAPS.netHour - 1);
  assert.equal((await join({ ...OK, email: 'last@example.test' })).status, 201);
  const over = await join({ ...OK, email: 'late@example.test' });
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error, 'too_many_signups');
  assert.equal(over.headers.get('Retry-After'), '3600');
  assert.deepEqual(listed().map((x) => x.email), ['last@example.test']);
  // another network is not held back by this one
  assert.equal((await join({ ...OK, email: 'other@example.test' }, { ip: '198.51.100.20' })).status, 201);
  // the network's day
  await setCount(h.env, `wait:n:${net}:day`, WAITLIST_CAPS.netDay);
  // as in the next hour: the hour's count starts again, the day's does not
  h.env.DB.raw.prepare('UPDATE ai_usage SET count = 0 WHERE who = ?').run(`wait:n:${net}`);
  assert.equal((await join({ ...OK, email: 'day@example.test' })).status, 429);
  // everyone's day: far past the notice count, still taken; the owner hears once, at the count
  await setCount(h.env, 'wait:all', WAITLIST_CAPS.notice - 1);
  for (const ip of ['198.51.100.30', '198.51.100.31', '198.51.100.32']) {
    assert.equal((await join({ ...OK, email: `${ip}@example.test` }, { ip })).status, 201, ip);
  }
  await setCount(h.env, 'wait:all', WAITLIST_CAPS.notice * 5);
  assert.equal((await join({ ...OK, email: 'busy-day@example.test' }, { ip: '198.51.100.33' })).status, 201);
  const notices = rows(h.env, "SELECT kind, params FROM notices WHERE kind LIKE 'owner:waitlist_many:%'");
  assert.equal(notices.length, 1);
  assert.deepEqual(JSON.parse(notices[0].params), { day: dayOf(), signups: WAITLIST_CAPS.notice });
  assert.deepEqual(WAITLIST_CAPS, { netHour: 60, netDay: 300, notice: 2000 });
});

test('IPv6: one /48 is one network, however many /64s it sends from (the edge limiter keys it the same way)', async () => {
  h = await setup();
  // two /64s of 2001:db8:77::/48 share the day; a third address of another /48 does not
  const wide = await netKey(new Request('https://madregot.test/', { headers: { 'CF-Connecting-IP': '2001:db8:77:1::1' } }), h.env, { wide: true });
  await setCount(h.env, `wait:n:${wide}:day`, WAITLIST_CAPS.netDay - 1);
  assert.equal((await join({ ...OK, email: 'a64@example.test' }, { ip: '2001:db8:77:2::1' })).status, 201);
  const r = await join({ ...OK, email: 'b64@example.test' }, { ip: '2001:db8:77:3::1' });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'too_many_signups');
  assert.equal((await join({ ...OK, email: 'c48@example.test' }, { ip: '2001:db8:78:1::1' })).status, 201);
  // and the reviewer's case: 3 signups from each of 40 /64s of one /48 reach the day's cap, not 120
  h.env.DB.raw.prepare("DELETE FROM ai_usage WHERE who LIKE 'wait:%'").run();
  let ok = 0;
  for (let n = 0; n < 40; n++) for (let i = 0; i < 3; i++) {
    if ((await join({ ...OK, email: `v${n}-${i}@victim.example` }, { ip: `2001:db8:77:${n.toString(16)}::1` })).status === 201) ok++;
  }
  assert.equal(ok, WAITLIST_CAPS.netHour, 'the hour\'s cap of the one /48');
});

test('until CONTACT_EMAIL and BUSINESS_NAME are set, no signup is taken: 503 waitlist_not_ready, nothing stored or counted', async () => {
  assert.deepEqual(WAITLIST_NEEDS, ['CONTACT_EMAIL', 'BUSINESS_NAME']);
  for (const over of [{ CONTACT_EMAIL: '' }, { BUSINESS_NAME: '' }, { CONTACT_EMAIL: ' ', BUSINESS_NAME: '' }, { CONTACT_EMAIL: 'not-an-address' }]) {
    h = await setup(over);
    assert.ok(waitlistMissing(h.env).length, JSON.stringify(over));
    const r = await join(OK);
    assert.equal(r.status, 503, JSON.stringify(over));
    assert.equal((await r.json()).error, 'waitlist_not_ready');
    const f = await form([['email', 'form@example.test'], ['role', 'parent'], ['consent', 'on']]);
    assert.equal(f.headers.get('Location'), '/waitlist/#busy');
    assert.deepEqual(listed(), []);
    assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'wait:%'").length, 0);
    h.done(); h = null;
  }
  // as the deploy sends empty settings (folded into BLANK_VARS, read back as "")
  h = await setup({ CONTACT_EMAIL: undefined, BLANK_VARS: 'CONTACT_EMAIL' });
  assert.equal((await join(OK)).status, 503);
  h.done();
  h = await setup();
  assert.deepEqual(waitlistMissing(h.env), []);
  assert.equal((await join(OK)).status, 201);
  // the owner's go-live check says so, by name, with the command (not required to go live; required to advertise)
  const item = (vars) => readiness({ vars, secrets: [], databaseId: 'x' }).items.find((i) => i.id === 'site:waitlist');
  assert.equal(item({ CONTACT_EMAIL: 'a@example.test', BUSINESS_NAME: 'עסק' }).ok, true);
  const bad = item({ CONTACT_EMAIL: 'a@example.test' });
  assert.equal(bad.ok, false);
  assert.equal(bad.required, false);
  assert.match(bad.need, /BUSINESS_NAME/);
  assert.match(bad.how, /npm run owner -- set CONTACT_EMAIL=.*BUSINESS_NAME=/);
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

test('a plain form post (no script on the page): 303 back to the page, at "joined", "oops", "busy" or "closed"', async () => {
  h = await setup();
  const ok = await form([['email', 'form@example.test'], ['role', 'teacher'], ['grade', '8'], ['platform', 'ios'], ['platform', 'android'], ['consent', 'on'], ['website', '']], { headers: { Origin: 'https://madregot.test' } });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('Location'), '/waitlist/#joined');
  assert.equal(await ok.text(), '');
  assert.deepEqual(listed(), [{ email: 'form@example.test', role: 'teacher', grade: '8', platform: 'both', source: null }]);
  // a limit is not the form's fault: "busy", try again later (a school's or a carrier's shared address)
  setHour(h.env, `wait:n:${await netOf(h.env)}`, WAITLIST_CAPS.netHour);
  const busy = await form([['email', 'late@example.test'], ['role', 'parent'], ['consent', 'on']]);
  assert.equal(busy.headers.get('Location'), '/waitlist/#busy');
  h.env.DB.raw.prepare("DELETE FROM ai_usage WHERE who LIKE 'wait:%'").run();
  // the edge limiter's refusal too: it runs inside the handler, so the form post still comes back to the page
  const edge = { ...h.env, RL_WRITE: { limit: async () => ({ success: false }) } };
  const { default: worker } = await import('../src/index.js');
  const r = await worker.fetch(new Request('https://madregot.test/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '203.0.113.7' }, body: 'email=e%40example.test&role=parent&consent=on' }), edge, h.ctx);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('Location'), '/waitlist/#busy');
  // as JSON, the edge's own answer
  const j = await worker.fetch(new Request('https://madregot.test/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' }, body: JSON.stringify(OK) }), edge, h.ctx);
  assert.equal(j.status, 429);
  assert.equal((await j.json()).error, 'slow_down');
  assert.deepEqual([formPart(new HttpError(400, 'bad_email')), formPart(new HttpError(403, 'bad_origin')), formPart(new HttpError(429, 'slow_down')),
    formPart(new HttpError(503, 'waitlist_not_ready')), formPart(new Error('boom')), formPart(new HttpError(410, 'waitlist_closed'))], ['oops', 'oops', 'busy', 'busy', 'busy', 'closed']);
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

// ---------------------------------------------------------------- the launch email and its removal link
const LAUNCHED = { WAITLIST_LAUNCHED_AT: '2027-03-01', APP_STORE_URL: 'https://apps.apple.com/il/app/madregot/id000', PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=test.madregot' };
const AFTER = new Date('2027-03-01T10:00:00Z');
const addRows = (env, n, from = 0) => {
  const add = env.DB.raw.prepare("INSERT INTO waitlist (email, role, consent_at, created_at) VALUES (?, 'parent', '2027-01-01T00:00:00Z', '2027-01-01T00:00:00Z')");
  for (let i = from; i < from + n; i++) add.run(`p${i}@example.test`);
};
const sentMail = () => h.net.log.email.flat();

test('the launch email waits for every setting it needs, and goes nowhere before the launch day', async () => {
  h = await setup(LAUNCHED);
  addRows(h.env, 2);
  assert.deepEqual(launchMissing(h.env, AFTER), []);
  assert.deepEqual(launchMissing(h.env, new Date('2027-02-28T10:00:00Z')), ['WAITLIST_LAUNCHED_AT']);
  for (const [over, name] of [[{ APP_STORE_URL: '', PLAY_STORE_URL: 'http://play.google.com/x' }, 'APP_STORE_URL or PLAY_STORE_URL'], [{ EMAIL_FROM: '' }, 'RESEND_API_KEY and EMAIL_FROM'],
    [{ RESEND_API_KEY: '' }, 'RESEND_API_KEY and EMAIL_FROM'], [{ AUTH_SECRET: '' }, 'AUTH_SECRET'], [{ PUBLIC_URL: 'http://x.test' }, 'PUBLIC_URL'],
    [{ BUSINESS_NAME: '' }, 'BUSINESS_NAME'], [{ BUSINESS_ADDRESS: '' }, 'BUSINESS_ADDRESS'], [{ CONTACT_EMAIL: '' }, 'CONTACT_EMAIL']]) {
    const env = { ...h.env, ...over };
    assert.deepEqual(launchMissing(env, AFTER), [name], JSON.stringify(over));
    assert.deepEqual(await sendLaunch(env, { now: AFTER }), { sent: 0, failed: 0, waiting: [name] });
  }
  assert.equal(sentMail().length, 0);
  assert.deepEqual(storeLinks({ APP_STORE_URL: 'https://apps.apple.com/a', PLAY_STORE_URL: 'javascript:alert(1)' }).map((l) => l.phone), ['iPhone']);
});

test('the launch email: one message per address through Resend, "פרסומת" first, the advertiser, the store links and a removal link of its own', async () => {
  h = await setup(LAUNCHED);
  addRows(h.env, 3);
  assert.deepEqual(await sendLaunch(h.env, { now: AFTER }), { sent: 3, failed: 0, waiting: [] });
  const msgs = sentMail();
  assert.equal(msgs.length, 3);
  assert.deepEqual(msgs.map((m) => m.to), [['p0@example.test'], ['p1@example.test'], ['p2@example.test']], 'one address a message: nobody sees another');
  const [m] = msgs;
  assert.match(m.subject, /^פרסומת: /, 's.30A(e)(1): the word at the start of the subject');
  assert.equal(m.subject, 'פרסומת: מדרגות יצאה ל־iPhone ול־Android');
  assert.equal(m.from, h.env.EMAIL_FROM);
  assert.equal(m.reply_to, 'hello@example.test', 'a reply reaches the owner (a way to refuse)');
  const id = one(h.env, "SELECT id FROM waitlist WHERE email = 'p0@example.test'").id;
  const leave = `https://madregot.example.test/api/waitlist/leave?w=${id}&t=${await leaveToken(h.env, id, 'p0@example.test')}`;
  assert.equal(await leaveUrl(h.env, { id, email: 'p0@example.test' }), leave);
  for (const part of [LAUNCHED.APP_STORE_URL, LAUNCHED.PLAY_STORE_URL, leave, business(h.env), h.env.BUSINESS_ADDRESS, LAUNCH_TEXT.once, LAUNCH_TEXT.leave]) {
    assert.ok(m.text.includes(part), `text has ${part}`);
  }
  assert.ok(m.html.includes(leave.replace('&', '&amp;')));
  assert.ok(m.html.includes(LAUNCHED.PLAY_STORE_URL.replace('&', '&amp;')));
  assert.equal(m.headers['List-Unsubscribe'], `<${leave}>`);
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  // every Latin word and number in the Hebrew of the HTML part is isolated left to right
  assert.match(m.html, /<bdi dir="ltr">iPhone<\/bdi>/);
  assert.match(m.html, new RegExp(`<bdi dir="ltr">${R.waitlistAfterLaunchDays}</bdi> יום`));
  for (const other of msgs.slice(1)) assert.ok(!other.text.includes(leave), 'each its own link');
  // sent once: the next hour sends nothing again
  assert.ok(rows(h.env, 'SELECT sent_at FROM waitlist').every((r) => r.sent_at === AFTER.toISOString()));
  assert.deepEqual(await sendLaunch(h.env, { now: AFTER }), { sent: 0, failed: 0, waiting: [] });
  assert.equal(sentMail().length, 3);
  // the cron runs it every hour, after the other emails
  addRows(h.env, 1, 10);
  const report = await run(h.env, { now: AFTER });
  assert.deepEqual(report.waitlistLaunch, { sent: 1, failed: 0, waiting: [] });
  // one store only: its line alone
  const ios = launchMessage({ ...h.env, PLAY_STORE_URL: '' }, { to: 'x@example.test', leave });
  assert.equal(ios.subject, 'פרסומת: מדרגות יצאה ל־iPhone');
  assert.ok(!ios.text.includes('Google Play'));
  assert.equal(ltrHtml('ב־30 יום "מבחן" & iPhone'), 'ב־<bdi dir="ltr">30</bdi> יום &quot;מבחן&quot; &amp; <bdi dir="ltr">iPhone</bdi>');
});

test('the launch email: 50 to a call, at most a run\'s worth an hour, and a failed call counts a try and waits for the next hour', async () => {
  let down = true;
  h = await setup(LAUNCHED, { resend: () => (down ? new Response('quota', { status: 429 }) : new Response('{"id":"em"}', { status: 200, headers: { 'Content-Type': 'application/json' } })) });
  addRows(h.env, 120);
  assert.deepEqual(await sendLaunch(h.env, { now: AFTER }), { sent: 0, failed: 50, waiting: [] });
  assert.equal(h.net.log.email.length, 1, 'stopped after the failed call');
  assert.equal(h.net.log.email[0].length, 50);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM waitlist WHERE tries = 1').n, 50);
  down = false;
  assert.deepEqual(await sendLaunch(h.env, { now: AFTER }), { sent: 100, failed: 0, waiting: [] });
  assert.deepEqual(await sendLaunch(h.env, { now: AFTER }), { sent: 20, failed: 0, waiting: [] });
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM waitlist WHERE sent_at IS NULL').n, 0);
  // an address that failed a day of hours is left out
  addRows(h.env, 1, 500);
  h.env.DB.raw.prepare("UPDATE waitlist SET tries = ? WHERE email = 'p500@example.test'").run(LAUNCH_MAX_TRIES);
  assert.deepEqual(await sendLaunch(h.env, { now: AFTER }), { sent: 0, failed: 0, waiting: [] });
});

test('the removal link: GET asks and changes nothing; POST (the button or one-click) removes the row; a wrong token removes nothing', async () => {
  h = await setup(LAUNCHED);
  addRows(h.env, 2);
  const [a, b] = rows(h.env, 'SELECT id, email FROM waitlist ORDER BY id');
  const path = async (r) => new URL(await leaveUrl(h.env, r)).pathname + new URL(await leaveUrl(h.env, r)).search;
  const ask = await h.call('GET', await path(a));
  assert.equal(ask.status, 200);
  const page = await ask.text();
  assert.ok(page.includes(LEAVE_TEXT.askTitle) && page.includes('<form method="post">'));
  assert.equal(ask.headers.get('Cache-Control'), 'no-store');
  assert.equal(listed().length, 2, 'a mail scanner opening the link removes nothing');
  // a token of another row, or none: nothing removed
  const wrong = `/api/waitlist/leave?w=${a.id}&t=${await leaveToken(h.env, b.id, b.email)}`;
  assert.equal((await h.call('POST', wrong, { body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status, 400);
  assert.equal((await h.call('GET', `/api/waitlist/leave?w=${a.id}`)).status, 400);
  assert.equal(listed().length, 2);
  // one-click, as a mail program sends it
  const done = await h.call('POST', await path(a), { body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(done.status, 200);
  assert.ok((await done.text()).includes(LEAVE_TEXT.doneTitle));
  assert.deepEqual(listed().map((x) => x.email), [b.email]);
  const audit = rows(h.env, "SELECT * FROM audit_log WHERE action = 'waitlist.remove'");
  assert.equal(audit.length, 1);
  assert.doesNotMatch(JSON.stringify(audit), /@/);
  // again: the same page, nothing more to do
  assert.equal((await h.call('POST', await path(a))).status, 200);
  assert.equal((await h.call('GET', await path(a))).status, 200);
  assert.equal(routePattern('/api/waitlist/leave'), '/api/waitlist/leave');
});

// ---------------------------------------------------------------- the owner's command
const seed = (db) => {
  const add = db.prepare('INSERT INTO waitlist (email, role, grade, platform, source, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  add.run('a@example.test', 'parent', '7', 'ios', 'instagram/launch', '2026-11-16T08:00:00.000Z', '2026-11-16T08:00:00.000Z');
  add.run('b@example.test', 'parent', '8', 'both', 'instagram/launch', '2026-11-16T22:30:00.000Z', '2026-11-16T22:30:00.000Z'); // 00:30 on 17 Nov in Jerusalem
  add.run('c@example.test', 'teacher', '7', 'android', 'share', '2026-11-17T10:00:00.000Z', '2026-11-17T10:00:00.000Z');
  add.run('-dash+1@example.test', 'teacher', null, null, null, '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z');
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
  const table = lines.slice(lines.indexOf('Who, by phone') + 1, lines.indexOf('Who, by phone') + 6);
  assert.deepEqual(table, [
    'who      n  iPhone  Android  both  not said',
    '-------  -  ------  -------  ----  --------',
    'parent   2  1       0        1     0',
    'teacher  2  0       1        0     1',
    'all      4  1       1        1     1',
  ]);
  assert.match(report, /Grade: 7 \(ז׳\) 2, 8 \(ח׳\) 1, not said 1/);
  assert.match(report, /Phone in all: iPhone 2, Android 2/);
  assert.match(report, /Source \(utm_source\/utm_campaign\): instagram\/launch 2, \(none\) 1, share 1/);
  assert.match(waitlistReport([], { launched: '2027-03-01' }), /Closed: WAITLIST_LAUNCHED_AT is 2027-03-01\. Every address is deleted on 2027-03-31/);
  assert.match(waitlistReport([{ role: 'parent', created_at: '2027-02-01T00:00:00Z', sent_at: '2027-03-01T08:00:00Z' }, { role: 'teacher', created_at: '2027-02-01T00:00:00Z', sent_at: null }],
    { launched: '2027-03-01' }), /Launch email: sent to 1 of 2/);
  assert.match(report, /The launch email: the Worker sends it itself/);
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
      'email,role,grade,platform,created_at,consent_at,sent_at',
      // an address that starts with - is an address: written as it is (a quote mark before it would be another one)
      '-dash+1@example.test,teacher,,,2026-10-01T10:00:00.000Z,2026-10-01T10:00:00.000Z,',
      'a@example.test,parent,7,ios,2026-11-16T08:00:00.000Z,2026-11-16T08:00:00.000Z,',
      'b@example.test,parent,8,both,2026-11-16T22:30:00.000Z,2026-11-16T22:30:00.000Z,',
      'c@example.test,teacher,7,android,2026-11-17T10:00:00.000Z,2026-11-17T10:00:00.000Z,',
    ]);
    // the other columns keep the formula guard
    assert.match(waitlistCsv([{ email: '=1+2@example.test', role: '=SUM(A1)', created_at: '+x' }]), /^email,.*\n=1\+2@example\.test,'=SUM\(A1\),,,'\+x,,\n$/);
    if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.match(out.join('\n'), /4 addresses written to /);
    assert.ok(out.includes(EXPORT_WARNING));
    assert.match(EXPORT_WARNING, /personal data[\s\S]*sent by the Worker[\s\S]*delete it/);
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
  assert.deepEqual(env.DB.raw.prepare('SELECT email FROM waitlist ORDER BY id').all().map((r) => r.email), ['b@example.test', 'c@example.test', '-dash+1@example.test']);
  const audit = env.DB.raw.prepare("SELECT * FROM audit_log WHERE action = 'waitlist.remove'").all();
  assert.equal(audit.length, 1);
  assert.doesNotMatch(JSON.stringify(audit), /@/);
  assert.throws(() => build('waitlist-remove', { remove: 'nope' }, fixed), /bad email/);
  env.DB.raw.exec(build('forget', { email: 'b@example.test' }, fixed).sql);
  assert.deepEqual(env.DB.raw.prepare('SELECT email FROM waitlist ORDER BY id').all().map((r) => r.email), ['c@example.test', '-dash+1@example.test']);
  // through the command line: it writes through wrangler's file path, like every change
  const ran = []; const out = [];
  const io = { env: {}, exec: async (x) => { ran.push(x); env.DB.raw.exec(x.sql); return ''; }, log: (...a) => out.push(a.join(' ')), error: (...a) => out.push(a.join(' ')) };
  assert.equal(await cli(['waitlist', '--remove', 'c@example.test', '--local'], io), 0, out.join('\n'));
  assert.equal(ran.length, 1);
  assert.match(out.join('\n'), /not any more/);
  assert.equal(await cli(['waitlist', '--remove', 'x@example.test', '--export', 'f.csv'], io), 1);
});
