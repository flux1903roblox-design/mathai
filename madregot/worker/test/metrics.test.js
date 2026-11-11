// Reach numbers with no tracker (STUDENT-14): POST /api/metrics counts a name on the list for the Jerusalem day and
// answers 204 whatever happens; the network's daily limit; what the table can hold; the server's own count of a class
// reaching its goal; retention; and the reach block of the owner's daily summary. In-memory D1; nothing leaves the machine.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, bearer, rows, one, setCount, netOf, request } from './helpers.js';
import { METRIC_NAMES, SERVER_METRICS, METRICS_PER_NET, metricName, countStmt } from '../src/metrics.js';
import { purgeRecordsSql, dailySummary } from '../src/cron.js';
import { flushNotices } from '../src/email.js';
import { dayOf } from '../src/util.js';
import { REACH_GROUPS } from '../scripts/owner.mjs';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const send = (body, opts = {}) => h.call('POST', '/api/metrics', { body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, ...opts });
const plain = (list) => list.map((r) => ({ ...r }));
const count = (name, day = dayOf()) => one(h.env, 'SELECT n FROM metrics_daily WHERE day = ? AND name = ?', day, name)?.n ?? 0;

test('the names are the spec\'s list; the server adds its own; the owner\'s table shows each once', () => {
  assert.deepEqual(METRIC_NAMES, [
    'landing_view_mivchan', 'landing_view_pilot', 'landing_cta_mivchan', 'landing_cta_pilot', 'welcome_from_landing',
    'install_offer', 'install_accept', 'installed', 'push_offer', 'push_on', 'push_off', 'push_open',
    'store_open_play', 'store_open_ios', 'recap_open', 'wardrobe_open']);
  assert.deepEqual(SERVER_METRICS, ['class_goal_reached']);
  const shown = REACH_GROUPS.flatMap(([, names]) => names);
  assert.deepEqual([...shown].sort(), [...METRIC_NAMES, ...SERVER_METRICS].sort());
  assert.equal(new Set(shown).size, shown.length);
  assert.equal(METRICS_PER_NET, 300);
});

test('a body is a plain name or { n }; anything else is no name', () => {
  assert.equal(metricName('install_offer'), 'install_offer');
  assert.equal(metricName(' installed\n'), 'installed');
  assert.equal(metricName('{"n":"wardrobe_open"}'), 'wardrobe_open');
  for (const bad of ['', 'nope', 'class_goal_reached', '{"n":"class_goal_reached"}', '{"n":5}', '{"name":"installed"}', '{bad json', '["installed"]', 'installed;DROP', null, undefined]) {
    assert.equal(metricName(bad), null, String(bad));
  }
});

test('an unknown name: 204 and nothing stored; a known name twice: n = 2', async () => {
  h = await setup();
  for (const body of ['nope', '{"n":"nope"}', 'class_goal_reached', '', 'x'.repeat(5000)]) {
    const r = await send(body);
    assert.equal(r.status, 204, body.slice(0, 20));
    assert.equal(await r.text(), '');
  }
  assert.equal(rows(h.env, 'SELECT * FROM metrics_daily').length, 0);
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'metric:%'").length, 0, 'a name off the list uses none of the limit');
  assert.equal((await send('install_offer')).status, 204);
  assert.equal((await send(JSON.stringify({ n: 'install_offer' }), { headers: { 'Content-Type': 'application/json' } })).status, 204);
  assert.equal(count('install_offer'), 2);
  assert.deepEqual(plain(rows(h.env, 'SELECT day, name, n FROM metrics_daily')), [{ day: dayOf(), name: 'install_offer', n: 2 }]);
  // a page on another address can send it too (a beacon is a simple POST; the answer is never read)
  const r = await h.call('POST', '/api/metrics', { body: 'installed', headers: { 'Content-Type': 'text/plain', Origin: 'https://elsewhere.example.test' } });
  assert.equal(r.status, 204);
  assert.equal(count('installed'), 1);
});

test('the day is the Jerusalem day, in winter and in summer', async () => {
  h = await setup();
  const at = (iso, name = 'installed') => countStmt(h.env, name, new Date(iso)).run();
  await at('2026-11-09T21:59:59Z'); // 23:59:59 in Jerusalem (UTC+2)
  await at('2026-11-09T22:00:00Z'); // 00:00 on the 10th
  await at('2026-11-10T21:30:00Z');
  await at('2026-07-01T20:59:59Z'); // 23:59:59 in Jerusalem (UTC+3)
  await at('2026-07-01T21:00:00Z'); // 00:00 on 2 July
  assert.deepEqual(plain(rows(h.env, 'SELECT day, n FROM metrics_daily ORDER BY day')), [
    { day: '2026-07-01', n: 1 }, { day: '2026-07-02', n: 1 }, { day: '2026-11-09', n: 1 }, { day: '2026-11-10', n: 2 }]);
});

test(`a network adds at most ${METRICS_PER_NET} counts a day: past it, 204 and no increment; another network still counts`, async () => {
  h = await setup();
  await setCount(h.env, `metric:n:${await netOf(h.env)}`, METRICS_PER_NET - 1);
  assert.equal((await send('wardrobe_open')).status, 204);
  assert.equal(count('wardrobe_open'), 1, 'the 300th is counted');
  const over = await send('wardrobe_open');
  assert.equal(over.status, 204);
  assert.equal(count('wardrobe_open'), 1, 'the 301st is not');
  assert.equal((await send('wardrobe_open', { ip: '198.51.100.9' })).status, 204);
  assert.equal(count('wardrobe_open'), 2);
  // the counter is the hashed network key, never the address
  const keys = rows(h.env, "SELECT who FROM ai_usage WHERE who LIKE 'metric:%'").map((r) => r.who);
  assert.equal(keys.length, 2);
  for (const k of keys) assert.match(k, /^metric:n:[0-9a-f]{16}$/);
});

test('without the network key\'s secret nothing is counted, and the answer is still 204', async () => {
  h = await setup({ IP_HASH_SECRET: '' });
  const r = await send('installed');
  assert.equal(r.status, 204);
  assert.equal(rows(h.env, 'SELECT * FROM metrics_daily').length, 0);
});

test('the table can hold a day, a name and a number, and nothing that could tell who', async () => {
  h = await setup();
  const cols = h.env.DB.raw.prepare('PRAGMA table_info(metrics_daily)').all().map((c) => ({ name: c.name, type: c.type, pk: c.pk }));
  assert.deepEqual(cols, [{ name: 'day', type: 'TEXT', pk: 1 }, { name: 'name', type: 'TEXT', pk: 2 }, { name: 'n', type: 'INTEGER', pk: 0 }]);
  for (const c of cols) assert.doesNotMatch(c.name, /ip|addr|agent|ua|id|device|account|student|class|email|token|cookie|user/i, c.name);
  // a request with every identifying header stores none of it
  await h.call('POST', '/api/metrics', { body: 'installed', ip: '203.0.113.99', headers: { 'Content-Type': 'text/plain', 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) test-agent', Cookie: 'sid=abc', 'X-Device': 'a'.repeat(32), Authorization: 'Bearer secret-token' } });
  const dump = JSON.stringify(rows(h.env, 'SELECT * FROM metrics_daily'));
  for (const s of ['203.0.113', 'test-agent', 'Android', 'sid=abc', 'aaaa', 'secret-token']) assert.ok(!dump.includes(s), s);
});

test('the server counts a class reaching its week\'s goal once, however often the goal is read', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  h.env.DB.raw.prepare('INSERT INTO class_goal_settings (class_code, on_flag, target, updated_at) VALUES (?, 1, 10, ?)').run(cls.code, new Date().toISOString());
  const steps = (n) => Array.from({ length: n }, () => ({ sid: crypto.randomUUID(), pts: 1, at: new Date().toISOString() }));
  await h.call('POST', '/api/progress', { headers: bearer(noa), body: { events: [], steps: steps(9) } });
  await h.call('GET', '/api/class/goal', { headers: bearer(noa) });
  assert.equal(count('class_goal_reached'), 0, 'not reached yet');
  await h.call('POST', '/api/progress', { headers: bearer(itai), body: { events: [], steps: steps(1) } });
  for (const s of [itai, noa, itai]) assert.equal((await (await h.call('GET', '/api/class/goal', { headers: bearer(s) })).json()).reached, true);
  await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher });
  assert.equal(count('class_goal_reached'), 1);
  // a page cannot add it
  await send('class_goal_reached');
  assert.equal(count('class_goal_reached'), 1);
});

test('counts are kept 400 days', async () => {
  h = await setup();
  const t = Date.now();
  const ins = h.env.DB.raw.prepare('INSERT INTO metrics_daily (day, name, n) VALUES (?, ?, 3)');
  ins.run(dayOf(new Date(t - 401 * DAY)), 'installed');
  ins.run(dayOf(new Date(t - 399 * DAY)), 'installed');
  ins.run(dayOf(), 'installed');
  await h.env.DB.batch(purgeRecordsSql(h.env, new Date(t)));
  assert.deepEqual(rows(h.env, 'SELECT day FROM metrics_daily ORDER BY day').map((r) => r.day), [dayOf(new Date(t - 399 * DAY)), dayOf()]);
});

test('the owner\'s daily summary has a reach block: yesterday\'s counts and the class students of the week', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const now = new Date();
  const yesterday = dayOf(new Date(now.getTime() - DAY));
  const ins = h.env.DB.raw.prepare('INSERT INTO metrics_daily (day, name, n) VALUES (?, ?, ?)');
  ins.run(yesterday, 'install_offer', 3); ins.run(yesterday, 'installed', 1); ins.run(dayOf(now), 'install_offer', 50);
  const step = h.env.DB.raw.prepare("INSERT INTO class_steps (sid, student_id, class_code, day, pts, at) VALUES (?, ?, 'ABC234', ?, 1, 'x')");
  step.run(crypto.randomUUID(), 's1', yesterday); step.run(crypto.randomUUID(), 's1', yesterday); step.run(crypto.randomUUID(), 's2', dayOf(new Date(now.getTime() - 6 * DAY)));
  step.run(crypto.randomUUID(), 's3', dayOf(new Date(now.getTime() - 9 * DAY)));
  await dailySummary(h.env, now);
  const p = JSON.parse(one(h.env, 'SELECT params FROM notices WHERE kind = ?', `owner:summary:${yesterday}`).params);
  assert.deepEqual(p.reach, { counts: { install_offer: 3, installed: 1 }, classStudents7: 2 });
  await flushNotices(h.env);
  const mail = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] סיכום יומי'));
  assert.match(mail.text, /הגעה \(ספירות בלי זיהוי\):\ninstall_offer 3 · installed 1\nתלמידי כיתות שלמדו ב־7 הימים האחרונים: 2/);
});

test('a request with no body or a broken stream is still 204', async () => {
  h = await setup();
  const res = await h.worker.fetch(request('POST', '/api/metrics', {}), h.env, h.ctx);
  assert.equal(res.status, 204);
  assert.equal(rows(h.env, 'SELECT * FROM metrics_daily').length, 0);
});
