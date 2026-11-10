// The usage counters: take() is atomic and all-or-nothing, giveBack() returns only what a person used, and the
// nightly purge keeps monthly rows.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { key, take, giveBack, dayOf, monthOf, HttpError } from '../src/util.js';
import { purgeCountersSql } from '../src/cron.js';
import { makeEnv, setup, ai, countOf, rows, DEVICE } from './helpers.js';

let h;
afterEach(() => h?.done());
const err = new HttpError(429, 'daily_limit');

test('take() admits exactly the limit under 20 parallel requests', async () => {
  const env = makeEnv();
  const results = await Promise.all(Array.from({ length: 20 }, () => take(env, [key('p', 7, { refundable: true, err }), key('all', 100, { err })])));
  assert.equal(results.filter((r) => r.ok).length, 7);
  assert.equal(countOf(env, 'p'), 7);
  assert.equal(countOf(env, 'all'), 7, 'refused requests left nothing behind');
});

test('20 parallel free questions from one device: exactly the daily limit is served', async () => {
  h = await setup({ FREE_DAILY_LIMIT: '5' });
  const res = await Promise.all(Array.from({ length: 20 }, () => ai(h, 'explain', { 'X-Device': DEVICE })));
  assert.equal(res.filter((r) => r.status === 200).length, 5);
  assert.equal(res.filter((r) => r.status === 429).length, 15);
  assert.equal(h.net.log.claude.length, 5);
});

test('take() is all or nothing: a full shared key undoes the person key', async () => {
  const env = makeEnv();
  const shared = new HttpError(429, 'shared_limit');
  assert.ok((await take(env, [key('net', 1, { err: shared })])).ok);
  const r = await take(env, [key('person', 2, { refundable: true, err }), key('net', 1, { err: shared })]);
  assert.equal(r.ok, false);
  assert.equal(r.error, shared);
  assert.equal(countOf(env, 'person'), 0);
  assert.equal(countOf(env, 'net'), 1);
});

test('giveBack() returns person keys only, never network, class, global or tries keys', async () => {
  const env = makeEnv();
  const keys = [
    key('free:d:x', 2, { refundable: true }), key('free:d:x:tries', 6), key('free:n:abc', 80), key('free:c:ABCDEF', 80), key('free:all', 3000),
  ];
  assert.ok((await take(env, keys)).ok);
  await giveBack(env, keys);
  assert.deepEqual(keys.map((k) => countOf(env, k.who)), [0, 1, 1, 1, 1]);
  await giveBack(env, keys);
  assert.equal(countOf(env, 'free:d:x'), 0, 'never below zero');
});

test('a unit weight larger than the limit is refused without writing', async () => {
  const env = makeEnv();
  const r = await take(env, [key('s:1:check', 3, { refundable: true }), key('cls:ABCDEF', 3, { n: 4, err })]);
  assert.equal(r.ok, false);
  assert.equal(r.error, err);
  assert.equal(rows(env, 'SELECT * FROM ai_usage').length, 0);
});

test('monthly and hourly keys are separate rows from the daily ones', async () => {
  const env = makeEnv();
  await take(env, [key('fam:a:exam', 2), key('fam:a:exam', 10, { period: 'month' }), key('checkout:a:x', 10, { period: 'hour' })]);
  const days = rows(env, 'SELECT day FROM ai_usage ORDER BY length(day)').map((r) => r.day);
  assert.deepEqual(days.map((d) => d.length), [7, 10, 13]);
  assert.equal(days[0], monthOf());
  assert.equal(days[1], dayOf());
});

test('the daily purge deletes old daily and hourly rows and keeps the YYYY-MM monthly rows', async () => {
  const env = makeEnv();
  const ins = (who, day) => env.DB.raw.prepare('INSERT INTO ai_usage (who, day, count) VALUES (?, ?, 1)').run(who, day);
  const old = dayOf(new Date(Date.now() - 40 * 864e5));
  ins('s:old', old); ins('h:old', `${old}T05`); ins('s:new', dayOf());
  ins('fam:a:exam', monthOf()); ins('fam:a:exam', monthOf(new Date(Date.now() - 200 * 864e5)));
  ins('fam:b:exam', '2020-01');
  await env.DB.batch(purgeCountersSql(env));
  const left = rows(env, 'SELECT who, day FROM ai_usage ORDER BY who, day').map((r) => `${r.who}@${r.day}`);
  assert.deepEqual(left, [`fam:a:exam@${monthOf(new Date(Date.now() - 200 * 864e5))}`, `fam:a:exam@${monthOf()}`, `s:new@${dayOf()}`].sort());
});
