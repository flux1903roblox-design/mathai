// A class student's answers reach the class server once each (DURABLE-7): up to 500 per request, a retried batch is
// stored once (each answer carries a 12-hex id), an answer older than 400 days is acknowledged but not stored, an
// answer from an older app (no id) is stored as before, and a malformed id refuses the request.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, bearer, rows, one } from './helpers.js';

let h;
afterEach(() => h?.done());

const hex12 = (n) => n.toString(16).padStart(12, '0');
const answer = (n, over = {}) => ({ id: hex12(n), topic: 'neg', level: 2, ok: n % 3 !== 0, first: n % 2 === 0, hint: false, cat: n % 3 ? null : 'sign', secs: 7, at: new Date(Date.now() - 60_000).toISOString(), ...over });
const send = (s, events, levels) => h.call('POST', '/api/progress', { headers: bearer(s), body: { events, ...(levels ? { levels } : {}) } });
const count = (s) => one(h.env, 'SELECT COUNT(*) AS n FROM attempts WHERE student_id = ?', s.studentId).n;

async function student() {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  return cls.students;
}

test('500 answers give 500 rows; the same 500 again give still 500 rows and saved: 500', async () => {
  const [noa] = await student();
  const events = Array.from({ length: 500 }, (_, i) => answer(i + 1));
  const first = await send(noa, events, { neg: { level: 2, max: 3 } });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { saved: 500 });
  assert.equal(count(noa), 500);
  const again = await send(noa, events);
  assert.deepEqual(await again.json(), { saved: 500 }, 'a retried batch is acknowledged in full');
  assert.equal(count(noa), 500, 'and stored once');
  // the rows are the answers, in order, with their ids
  const stored = rows(h.env, 'SELECT client_id, topic, level, ok, first_try, hint, cat, secs FROM attempts WHERE student_id = ? ORDER BY id', noa.studentId);
  assert.deepEqual(stored.slice(0, 3).map((r) => ({ ...r })), [
    { client_id: hex12(1), topic: 'neg', level: 2, ok: 1, first_try: 0, hint: 0, cat: null, secs: 7 },
    { client_id: hex12(2), topic: 'neg', level: 2, ok: 1, first_try: 1, hint: 0, cat: null, secs: 7 },
    { client_id: hex12(3), topic: 'neg', level: 2, ok: 0, first_try: 0, hint: 0, cat: 'sign', secs: 7 },
  ]);
  assert.equal(stored.at(-1).client_id, hex12(500));
  assert.deepEqual({ ...one(h.env, 'SELECT level, max_level FROM levels WHERE student_id = ?', noa.studentId) }, { level: 2, max_level: 3 });
});

test('half a batch already stored (a page closed mid-request): the rest is added, nothing twice', async () => {
  const [noa] = await student();
  const events = Array.from({ length: 300 }, (_, i) => answer(i + 1));
  await send(noa, events.slice(0, 120));
  const r = await send(noa, events);
  assert.deepEqual(await r.json(), { saved: 300 });
  assert.equal(count(noa), 300);
  assert.equal(one(h.env, 'SELECT COUNT(DISTINCT client_id) AS n FROM attempts WHERE student_id = ?', noa.studentId).n, 300);
});

test('501 answers: the first 500 are stored and saved: 500 (the app sends the last one again)', async () => {
  const [noa] = await student();
  const events = Array.from({ length: 501 }, (_, i) => answer(i + 1));
  const r = await send(noa, events);
  assert.deepEqual(await r.json(), { saved: 500 });
  assert.equal(count(noa), 500);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM attempts WHERE client_id = ?', hex12(501)).n, 0);
});

test('an answer from an older app (no id) is stored, every time it is sent', async () => {
  const [noa] = await student();
  const { id, ...old } = answer(1);
  assert.deepEqual(await (await send(noa, [old, answer(2)])).json(), { saved: 2 });
  assert.equal(count(noa), 2);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM attempts WHERE student_id = ? AND client_id IS NULL', noa.studentId).n, 1);
  await send(noa, [old]);
  assert.equal(count(noa), 3, 'without an id there is nothing to tell a retry apart');
});

test('an answer 401 days old is not stored but counts as saved; one 399 days old is stored', async () => {
  const [noa] = await student();
  const day = 864e5;
  const old = answer(1, { at: new Date(Date.now() - 401 * day).toISOString() });
  const kept = answer(2, { at: new Date(Date.now() - 399 * day).toISOString() });
  assert.deepEqual(await (await send(noa, [old])).json(), { saved: 1 });
  assert.equal(count(noa), 0);
  assert.deepEqual(await (await send(noa, [old, kept])).json(), { saved: 2 });
  assert.equal(count(noa), 1);
  assert.equal(one(h.env, 'SELECT client_id FROM attempts WHERE student_id = ?', noa.studentId).client_id, hex12(2));
});

test('a malformed id refuses the whole request with 400 bad_input; nothing is stored', async () => {
  const [noa] = await student();
  for (const id of ['ABCDEF012345', 'abc', 'aaaaaaaaaaaaa', 'g00000000000', '', 12]) {
    const r = await send(noa, [answer(1), answer(2, { id })]);
    assert.equal(r.status, 400, `id ${JSON.stringify(id)}`);
    assert.equal((await r.json()).error, 'bad_input');
  }
  assert.equal(count(noa), 0);
  // null is "no id", as from an older app
  assert.equal((await send(noa, [answer(3, { id: null })])).status, 200);
  assert.equal(count(noa), 1);
});

test('two students may send the same id: each keeps their own answer', async () => {
  const [noa, itai] = await student();
  await send(noa, [answer(1)]);
  await send(itai, [answer(1)]);
  assert.equal(count(noa), 1);
  assert.equal(count(itai), 1);
});

test('junk in the body (not an event, a broken level, a level out of range) never stops the real answers', async () => {
  const [noa] = await student();
  const r = await send(noa, [null, 'x', answer(1, { level: 'Infinity' }), answer(2, { level: -3 })], { neg: null, frac: { level: 2, max: 2 } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { saved: 4 });
  assert.deepEqual(rows(h.env, 'SELECT level FROM attempts WHERE student_id = ? ORDER BY id', noa.studentId).map((x) => x.level), [1, 1]);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM levels WHERE student_id = ?', noa.studentId).n, 1);
});

test('every unit and every guest stair the app sends is kept: twenty units, then eq:6, eq:7 and func:1 under their own ids', async () => {
  // the app sends each unit's { level, max } and then each guest stair it touched (web/src/lib/path.js guestStairLevels):
  // 1 practised, 2 mastered; the teacher's guest row reads them (content/index.js rowLevel). With the later stages'
  // units, more than twenty entries arrive, and the guest stairs come last, so none may be cut
  const [noa] = await student();
  const units = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`t${i}`, { level: 1, max: 1 }]));
  const levels = { ...units, 'eq:6': { level: 2, max: 2 }, 'eq:7': { level: 1, max: 1 }, 'func:1': { level: 1, max: 1 } };
  assert.equal((await send(noa, [], levels)).status, 200);
  const kept = Object.fromEntries(rows(h.env, 'SELECT topic, level, max_level FROM levels WHERE student_id = ?', noa.studentId).map((r) => [r.topic, [r.level, r.max_level]]));
  assert.equal(Object.keys(kept).length, 23);
  assert.deepEqual([kept['eq:6'], kept['eq:7'], kept['func:1']], [[2, 2], [1, 1], [1, 1]]);
  // a stair mastered and then reopened by a failed check: practised now, its highest kept
  await send(noa, [], { 'eq:6': { level: 1, max: 1 } });
  assert.deepEqual({ ...one(h.env, "SELECT level, max_level FROM levels WHERE student_id = ? AND topic = 'eq:6'", noa.studentId) }, { level: 1, max_level: 2 });
  // and no more than forty entries are read from one request
  const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`u${i}`, { level: 1, max: 1 }]));
  await send(noa, [], many);
  assert.equal(one(h.env, "SELECT COUNT(*) AS n FROM levels WHERE student_id = ? AND topic LIKE 'u%'", noa.studentId).n, 40);
});

test('without a class token nothing is stored', async () => {
  await student();
  const r = await h.call('POST', '/api/progress', { body: { events: [answer(1)] } });
  assert.equal(r.status, 401);
  assert.equal(one(h.env, 'SELECT COUNT(*) AS n FROM attempts').n, 0);
});
