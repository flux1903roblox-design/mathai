// A class student's writes are capped, checked and metered (COUNCIL2-12, COUNCIL2-18). Joining a class needs no account
// and the same database holds billing, so one student token must not be able to fill it: answers and level rows only
// for topics the app teaches (TOPIC_IDS), every level 1-12, a daily budget per student (index.js WRITE_BUDGET: 3,000
// answers, 30 exams, 6,000 level rows) past which the answer is 429 too_many_writes with Retry-After, and the database's
// size kept per day in meters with one owner notice past DB_SIZE_NOTICE_MB (dbsize.js).
// Adapted from the council's probe (engineering/probe/writes.test.mjs): on the old code one token stored 20,000 answers
// across 997 invented topics, 800 level rows at 1e12, and 200 of 200 exams.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TOPIC_IDS } from '../../shared/ai.js';
import { setup, makeClass, bearer, rows, one, setCount } from './helpers.js';
import { WRITE_BUDGET, MAX_LEVEL } from '../src/index.js';
import { meterDbSize, dbSizeNoticeMb, DB_SIZE_NOTICE_MB } from '../src/dbsize.js';
import { purgeCountersSql } from '../src/cron.js';
import { dayOf, daysAgo } from '../src/util.js';
import { flushNotices } from '../src/email.js';

let h;
afterEach(() => { h?.done(); h = null; });

const REAL = TOPIC_IDS.filter((t) => t !== 'other');
let n = 0;
const id = () => (n++).toString(16).padStart(12, '0');
const answer = (topic, extra = {}) => ({ id: id(), topic, level: 2, ok: true, first: true, at: new Date().toISOString(), ...extra });
const post = (s, body) => h.call('POST', '/api/progress', { headers: bearer(s), body });
const exam = (s) => h.call('POST', '/api/exams', { headers: bearer(s), body: { title: 'x'.repeat(80), questions: Array.from({ length: 40 }, () => ({ topic: 'signed', status: 'wrong', skill: 'y'.repeat(60), level: 3 })) } });

test('the probe: 40 posts of invented topics at level 1e9 and levels at 1e12, then 200 exams: nothing invented, no level above 12, exams stop at 30', async () => {
  h = await setup();
  const { students: [s] } = await makeClass(h, { students: ['דנה'] });
  const saved = [];
  for (let r = 0; r < 40; r++) {
    const events = Array.from({ length: 500 }, (_, i) => answer(`junk${(r * 500 + i) % 997}`, { level: 1e9 }));
    // 20 invented topics first, then two real ones: the real ones are still written (filtered before the 20 are cut)
    const levels = Object.fromEntries([
      ...Array.from({ length: 20 }, (_, i) => [`t${r}_${i}`, { level: 1e12, max: 1e12 }]),
      ['signed', { level: 1e12, max: 1e12 }], ['frac', { level: -3, max: 'x' }],
    ]);
    const res = await post(s, { events, levels });
    assert.equal(res.status, 200, `post ${r}`);
    saved.push((await res.json()).saved);
  }
  // every answer is acknowledged, so an old outbox drains, but none of an invented topic is stored
  assert.ok(saved.every((x) => x === 500));
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM attempts').n, 0);
  const lv = rows(h.env, 'SELECT topic, level, max_level FROM levels ORDER BY topic');
  assert.deepEqual(lv.map((r) => ({ ...r })), [{ topic: 'frac', level: 1, max_level: 1 }, { topic: 'signed', level: MAX_LEVEL, max_level: MAX_LEVEL }]);

  const status = {};
  let last;
  for (let i = 0; i < 200; i++) {
    const res = await exam(s);
    status[res.status] = (status[res.status] || 0) + 1;
    if (res.status === 429) last = res; else await res.text();
  }
  assert.deepEqual(status, { 200: WRITE_BUDGET.exams, 429: 200 - WRITE_BUDGET.exams });
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM exams').n, WRITE_BUDGET.exams);
  const body = await last.json();
  assert.equal(body.error, 'too_many_writes');
  assert.ok(body.resetsAt);
  const wait = Number(last.headers.get('Retry-After'));
  assert.ok(wait >= 60 && wait <= 25 * 3600, `Retry-After until midnight: ${wait}`);
});

test('answers stop at 3,000 a day: the 7th post of 500 is 429, stores nothing and is not acknowledged', async () => {
  assert.equal(WRITE_BUDGET.answers, 3000);
  h = await setup();
  const { students: [s, other] } = await makeClass(h, { students: ['דנה', 'יואב'] });
  for (let r = 0; r < 6; r++) {
    const res = await post(s, { events: Array.from({ length: 500 }, (_, i) => answer(REAL[i % REAL.length], { level: 1e9 })) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).saved, 500);
  }
  const res = await post(s, { events: [answer('signed')], levels: { signed: { level: 3, max: 3 } } });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_writes');
  assert.ok(Number(res.headers.get('Retry-After')) >= 60);
  const att = one(h.env, 'SELECT COUNT(*) AS n, MAX(level) AS top, COUNT(DISTINCT topic) AS topics FROM attempts');
  assert.equal(att.n, 3000);
  assert.equal(att.top, MAX_LEVEL, 'level 1e9 is kept as 12');
  assert.equal(att.topics, REAL.length);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM levels').n, 0, 'the refused post wrote no level either');
  // another student of the class has a budget of their own
  assert.equal((await post(other, { events: [answer('signed')] })).status, 200);
  // a sync with nothing to store (only invented topics) still goes through and is acknowledged
  const junk = await post(s, { events: [answer('junk')] });
  assert.equal(junk.status, 200);
  assert.equal((await junk.json()).saved, 1);
});

test('level rows stop at 6,000 a day; 30 exams; each kind of write has its own count', async () => {
  h = await setup();
  const { students: [s] } = await makeClass(h, { students: ['דנה'] });
  const twelve = Object.fromEntries(REAL.slice(0, 12).map((t) => [t, { level: 2, max: 2 }]));
  await setCount(h.env, `write:s:${s.studentId}:levels`, WRITE_BUDGET.levels - 11);
  assert.equal((await post(s, { levels: twelve })).status, 429, '12 rows do not fit in the 11 left');
  assert.equal((await post(s, { levels: Object.fromEntries(Object.entries(twelve).slice(0, 11)) })).status, 200, '11 do');
  assert.equal((await post(s, { levels: { signed: { level: 2, max: 2 } } })).status, 429);
  // answers and exams are counted apart from the levels
  assert.equal((await post(s, { events: [answer('signed')] })).status, 200);
  assert.equal((await exam(s)).status, 200);
  const counts = Object.fromEntries(rows(h.env, "SELECT who, count FROM ai_usage WHERE who LIKE 'write:%'").map((r) => [r.who.split(':').at(-1), r.count]));
  assert.deepEqual(counts, { levels: WRITE_BUDGET.levels, answers: 1, exams: 1 });
});

test('levels are whole numbers from 1 to 12, and only for topics the app teaches; attempts the same', async () => {
  h = await setup();
  const { students: [s] } = await makeClass(h, { students: ['דנה'] });
  const res = await post(s, {
    events: [answer('signed', { level: 7.9 }), answer('frac', { level: -4 }), answer('eq', { level: 'abc' }), answer('pct', { level: Infinity }), answer('__proto__')],
    levels: { signed: { level: 7.9, max: 99 }, frac: { level: 0, max: null }, constructor: { level: 3, max: 3 }, other: { level: 2, max: 2 } },
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).saved, 5);
  const att = Object.fromEntries(rows(h.env, 'SELECT topic, level FROM attempts').map((r) => [r.topic, r.level]));
  assert.deepEqual(att, { signed: 7, frac: 1, eq: 1, pct: 1 });
  const lv = Object.fromEntries(rows(h.env, 'SELECT topic, level, max_level FROM levels').map((r) => [r.topic, [r.level, r.max_level]]));
  assert.deepEqual(lv, { signed: [7, 12], frac: [1, 1], other: [2, 2] });
});

test('the size meter: the day\'s largest size_after is kept; past DB_SIZE_NOTICE_MB the owner gets exactly one notice a day', async () => {
  h = await setup({ DB_SIZE_NOTICE_MB: '0.01' });
  const { students: [s] } = await makeClass(h, { students: ['דנה'] });
  assert.equal((await post(s, { events: [answer('signed')] })).status, 200);
  await h.ctx.flush();
  const day = dayOf();
  const kept = one(h.env, 'SELECT value FROM meters WHERE name = ?', `db_size:${day}`).value;
  const real = Number(h.env.DB.raw.prepare('PRAGMA page_count').get().page_count) * Number(h.env.DB.raw.prepare('PRAGMA page_size').get().page_size);
  assert.ok(kept > 10_000 && kept <= real, `${kept} bytes`);
  for (let i = 0; i < 3; i++) { assert.equal((await post(s, { events: Array.from({ length: 300 }, () => answer('eq')) })).status, 200); await h.ctx.flush(); }
  assert.equal((await exam(s)).status, 200);
  await h.ctx.flush();
  assert.ok(one(h.env, 'SELECT value FROM meters WHERE name = ?', `db_size:${day}`).value >= kept, 'the largest of the day');
  const notices = rows(h.env, "SELECT ref, kind, params FROM notices WHERE kind LIKE 'owner:db_size:%'");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, `owner:db_size:${day}`);
  const p = JSON.parse(notices[0].params);
  assert.equal(p.noticeMb, 0.01); assert.ok(p.mb > 0);
  // the owner's email says it in Hebrew, with the number and what to do
  await flushNotices(h.env);
  const mail = h.net.log.email.find((m) => /בסיס הנתונים הגיע/.test(m.subject));
  assert.ok(mail, 'the notice was sent');
  assert.match(mail.text, /DB_SIZE_NOTICE_MB/);
});

test('the size meter at the shipped 400 MB: the row, no notice; a smaller reading never lowers it; old days are purged with the counters', async () => {
  h = await setup();
  assert.equal(dbSizeNoticeMb(h.env), DB_SIZE_NOTICE_MB);
  assert.equal(dbSizeNoticeMb({ DB_SIZE_NOTICE_MB: 'abc' }), DB_SIZE_NOTICE_MB);
  assert.equal(dbSizeNoticeMb({ DB_SIZE_NOTICE_MB: '8000' }), 8000);
  const now = new Date();
  await meterDbSize(h.env, [{ meta: { size_after: 5_000_000 } }, { meta: { size_after: 7_000_000 } }], now);
  await meterDbSize(h.env, [{ meta: { size_after: 6_000_000 } }], now);
  await meterDbSize(h.env, [{ meta: {} }, null], now);
  assert.equal(one(h.env, 'SELECT value FROM meters WHERE name = ?', `db_size:${dayOf(now)}`).value, 7_000_000);
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM notices WHERE kind LIKE 'owner:db_size:%'").n, 0);
  // a day over the line queues its own notice; the next day starts again
  await meterDbSize(h.env, [{ meta: { size_after: 500 * 1024 * 1024 } }], now);
  await meterDbSize(h.env, [{ meta: { size_after: 501 * 1024 * 1024 } }], now);
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM notices WHERE kind LIKE 'owner:db_size:%'").n, 1);
  h.env.DB.raw.prepare('INSERT INTO meters (name, value) VALUES (?, 1)').run(`db_size:${daysAgo(36)}`);
  h.env.DB.raw.prepare('INSERT INTO meters (name, value) VALUES (?, 1)').run(`db_size:${daysAgo(34)}`);
  await h.env.DB.batch(purgeCountersSql(h.env));
  const names = rows(h.env, 'SELECT name FROM meters ORDER BY name').map((r) => r.name);
  assert.deepEqual(names, [`db_size:${daysAgo(34)}`, `db_size:${dayOf(now)}`, 'vault_bytes'], 'the vault meter stays');
});

test('the write budget counters go with the student: the teacher removing them deletes write:s:<id>:*', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['דנה', 'יואב'] });
  const [s, other] = cls.students;
  for (const x of cls.students) { assert.equal((await post(x, { events: [answer('signed')] })).status, 200); assert.equal((await exam(x)).status, 200); }
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'write:s:%'").length, 4);
  assert.equal((await h.call('POST', `/api/teacher/students/${s.studentId}/remove`, { headers: cls.teacher, body: {} })).status, 200);
  assert.deepEqual(rows(h.env, "SELECT who FROM ai_usage WHERE who LIKE 'write:s:%' ORDER BY who").map((r) => r.who), [`write:s:${other.studentId}:answers`, `write:s:${other.studentId}:exams`]);
});
