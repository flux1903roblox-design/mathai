// A returning student's 4-digit PIN (POST /api/classes/:code/join): each try is taken before the PIN is compared, so
// guesses sent all at once cannot all be compared (DURABLE-8). The tries are counted per student and per network only
// (COUNCIL2-25): 5 an hour and 15 a day from one network, with no count across networks, so a stranger on another
// network can never lock the real student out (TRUST-12 §1; teacher.test.js covers more of the networks). The right PIN
// gives its tries back; the teacher's reset clears the count and issues a one-time claim code (claim.test.js).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, countOf, netOf, rows, advanceClock, resetClock } from './helpers.js';

let h;
afterEach(() => { h?.done(); resetClock(); });

const SCHOOL = '203.0.113.7'; // the default network of h.call
const join = (cls, pin, { name = 'נועה', ip = SCHOOL, claim } = {}) => h.call('POST', `/api/classes/${cls.code}/join`, { body: { name, pin, ...(claim ? { claim } : {}) }, ip });
const errorOf = async (r) => (r.status === 200 ? 'ok' : (await r.json()).error);
const tally = (list) => list.reduce((o, x) => ({ ...o, [x]: (o[x] || 0) + 1 }), {});
const pinKeys = (env, id) => rows(env, "SELECT who, day, count FROM ai_usage WHERE who = 'pin:' || ? OR who LIKE 'pin:' || ? || ':%' ORDER BY who, day", id, id);

test('50 wrong PINs at once from one network: exactly 5 are compared (wrong_pin), 45 are refused (too_many_pin); the reset lets her back in with the teacher\'s code', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const net = await netOf(h.env, SCHOOL);
  const guesses = Array.from({ length: 50 }, (_, i) => String(1000 + i * 7));
  assert.ok(!guesses.includes('1234'));
  const answers = await Promise.all(guesses.map(async (pin) => errorOf(await join(cls, pin))));
  assert.deepEqual(tally(answers), { wrong_pin: 5, too_many_pin: 45 });
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}`), 5, 'the network\'s hour');
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}:day`), 5, 'the network\'s day');
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 0, 'no count across networks');

  const right = await join(cls, '1234');
  assert.equal(right.status, 429, 'that network waits; the right PIN is not compared once its tries are used up');
  assert.equal((await right.json()).error, 'too_many_pin');
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}`), 5, 'a refused try does not count');

  const reset = await h.call('POST', `/api/teacher/students/${noa.studentId}/reset-pin`, { headers: cls.teacher, body: {} });
  assert.equal(reset.status, 200);
  const { claimCode } = await reset.json();
  assert.equal(pinKeys(h.env, noa.studentId).length, 0, 'the reset clears every count');
  const back = await join(cls, '1234', { claim: claimCode });
  assert.equal(back.status, 200);
  assert.equal((await back.json()).returning, true);
});

test('a stranger\'s wrong PINs from other networks never lock the real student out (no day count across networks)', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  // a stranger tries from 8 networks, each until it is stopped: 5 an hour, then again an hour later, to the network's day
  for (let hour = 0; hour < 4; hour++) {
    for (let n = 1; n <= 8; n++) {
      const st = await Promise.all(Array.from({ length: 6 }, () => join(cls, '9999', { ip: `198.51.100.${n}` }).then((r) => r.status)));
      assert.ok(st.every((s) => s === 403 || s === 429), `hour ${hour}, net ${n}`);
    }
    advanceClock(3600e3);
  }
  const wrong = rows(h.env, "SELECT SUM(count) AS n FROM ai_usage WHERE who LIKE 'pin:' || ? || ':%:day'", id)[0].n;
  assert.equal(wrong, 8 * 15, 'each network stopped at its 15 a day');
  // her own phone at home and the school's network: the right PIN works at once, and costs no try
  for (const ip of [SCHOOL, '192.0.2.44']) {
    const r = await join(cls, '1234', { ip });
    assert.equal(r.status, 200, ip);
    assert.equal((await r.json()).studentId, id);
  }
  assert.equal(countOf(h.env, `pin:${id}:${await netOf(h.env, SCHOOL)}:day`), 0, 'the right PIN gave its try back');
});

test('one network gets 15 wrong PINs a day: after three hours of 5, the next hour is still refused there, and only there', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const id = cls.students[0].studentId;
  const A = '198.51.100.10';
  for (let hour = 0; hour < 3; hour++) {
    for (let i = 0; i < 5; i++) assert.equal((await join(cls, '9999', { ip: A })).status, 403, `hour ${hour} try ${i + 1}`);
    assert.equal((await join(cls, '9999', { ip: A })).status, 429, `hour ${hour}: the hour is full`);
    advanceClock(3600e3);
  }
  const fourth = await join(cls, '1234', { ip: A });
  assert.equal(fourth.status, 429, 'a new hour, but the network\'s day is full: even the right PIN waits there');
  assert.equal((await fourth.json()).error, 'too_many_pin');
  const netA = await netOf(h.env, A);
  assert.equal(countOf(h.env, `pin:${id}:${netA}:day`), 15);
  assert.match(pinKeys(h.env, id).find((r) => r.who === `pin:${id}:${netA}:day`).day, /^\d{4}-\d{2}-\d{2}$/, 'a daily key');
  assert.equal((await join(cls, '1234', { ip: '203.0.113.99' })).status, 200, 'another network: in');
  // the next day network A may try again
  advanceClock(24 * 3600e3);
  assert.equal((await join(cls, '1234', { ip: A })).status, 200);
});

test('4 wrong PINs and then the right one: 200, and only the 4 wrong tries stay counted', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const net = await netOf(h.env, SCHOOL);
  for (const pin of ['0000', '1111', '2222', '3333']) {
    const r = await join(cls, pin);
    assert.equal(r.status, 403); assert.equal((await r.json()).error, 'wrong_pin');
  }
  const r = await join(cls, '1234');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).studentId, noa.studentId);
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}`), 4, 'the right PIN gave its try back');
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}:day`), 4);
});

test('the right PIN 5 times at once: 5 x 200, and the count is back at 0', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const answers = await Promise.all(Array.from({ length: 5 }, async () => (await join(cls, '1234')).status));
  assert.deepEqual(answers, [200, 200, 200, 200, 200]);
  assert.ok(pinKeys(h.env, noa.studentId).every((r) => r.count === 0));
});

test('one student\'s wrong tries do not touch a classmate\'s, and a first join never counts a try', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  const net = await netOf(h.env, SCHOOL);
  await Promise.all(Array.from({ length: 12 }, () => join(cls, '9999')));
  assert.equal(countOf(h.env, `pin:${noa.studentId}:${net}`), 5);
  assert.equal(pinKeys(h.env, itai.studentId).length, 0);
  assert.equal((await join(cls, '1234', { name: 'איתי' })).status, 200);
  const fresh = await join(cls, '5555', { name: 'חדש' });
  assert.equal(fresh.status, 200);
  assert.equal(pinKeys(h.env, (await fresh.json()).studentId).length, 0);
});
