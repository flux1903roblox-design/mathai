// A returning student's 4-digit PIN (POST /api/classes/:code/join): each try is taken before the PIN is compared, so
// guesses sent all at once cannot all be compared (DURABLE-8). The tries are counted per student and per network
// (COUNCIL2-25): 5 an hour and 15 a day from one network, an IPv6 network being its /48. The student's day also counts
// every wrong PIN from anywhere (30): past it a network the student never signed in from needs the teacher's one-time
// code, while a device that holds the student's token and a network the student signed in from are still compared, so
// a stranger can neither guess the PIN from many networks nor lock the real student out (TRUST-12 §1; teacher.test.js
// covers more of the networks). The right PIN gives its tries back; the teacher's reset clears the count and issues a
// one-time claim code (claim.test.js).
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
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 5, 'the student\'s day, from every network together');

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

test('a stranger\'s wrong PINs from other networks never lock the real student out, and stop at 30 a day for the student', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students; const id = noa.studentId;
  // a stranger tries from 8 networks, each until it is stopped: 5 an hour, then again an hour later
  const seen = {};
  for (let hour = 0; hour < 4; hour++) {
    for (let n = 1; n <= 8; n++) {
      const st = await Promise.all(Array.from({ length: 6 }, () => join(cls, '9999', { ip: `198.51.100.${n}` }).then(errorOf)));
      for (const e of st) seen[e] = (seen[e] || 0) + 1;
    }
    advanceClock(3600e3);
  }
  assert.equal(seen.wrong_pin, 30, 'exactly 30 PINs were compared that day, on all 8 networks together');
  assert.equal(seen.ok, undefined);
  assert.ok(seen.claim_code_needed > 0 && seen.wrong_pin + seen.claim_code_needed + (seen.too_many_pin || 0) === 4 * 8 * 6);
  assert.equal(countOf(h.env, `pin:${id}`), 30);
  // the school's network (she signed in there) and her own phone at home (it holds her token): the right PIN works at
  // once, and costs no try
  const school = await join(cls, '1234');
  assert.equal(school.status, 200);
  assert.equal((await school.json()).studentId, id);
  const home = await h.call('POST', `/api/classes/${cls.code}/join`, { body: { name: 'נועה', pin: '1234' }, ip: '192.0.2.44', headers: { Authorization: `Bearer ${noa.token}` } });
  assert.equal(home.status, 200);
  assert.equal(countOf(h.env, `pin:${id}:${await netOf(h.env, SCHOOL)}:day`), 0, 'the right PIN gave its try back');
  assert.equal(countOf(h.env, `pin:${id}`), 30, '... and added nothing to her day');
  // a wrong PIN from her own network is still compared (and counted): 403, never the teacher's code
  assert.equal(await errorOf(await join(cls, '0000')), 'wrong_pin');
  // the next day the count starts again
  advanceClock(24 * 3600e3);
  assert.equal((await join(cls, '1234', { ip: '198.51.100.1' })).status, 200);
});

test('one IPv6 allocation (a /48) is one network for PIN tries: 5 an hour for all its /64s together, and the attack of 1,479 networks stops at 5', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: [] });
  const SECRET = '7391';
  const victim = await (await join(cls, SECRET, { ip: '192.0.2.200' })).json();
  let compared = 0; let cracked = false; const codes = {};
  for (let n = 0; n < 300 && !cracked; n++) { // /64s inside 2001:db8:aa::/48, five guesses each
    for (let i = 0; i < 5; i++) {
      const r = await join(cls, String(n * 5 + i).padStart(4, '0'), { ip: `2001:db8:aa:${n.toString(16)}::1` });
      const e = await errorOf(r);
      codes[e] = (codes[e] || 0) + 1;
      if (e === 'wrong_pin') compared += 1;
      if (e === 'ok') cracked = true;
    }
  }
  assert.equal(cracked, false);
  assert.equal(compared, 5, 'the whole /48 got 5 comparisons this hour');
  assert.deepEqual(codes, { wrong_pin: 5, too_many_pin: 1495 });
  assert.equal(pinKeys(h.env, victim.studentId).length, 3, 'one hour key, one day key, and her day');
  // many allocations: each /48 gets its 5, and the student's day stops them all at 30
  let more = 0;
  for (let a = 1; a <= 40; a++) for (let i = 0; i < 5; i++) if (await errorOf(await join(cls, '0000', { ip: `2001:db8:${a.toString(16)}::1` })) === 'wrong_pin') more += 1;
  assert.equal(more, 25, '5 + 25 = 30 wrong PINs that day, from anywhere');
  assert.equal(countOf(h.env, `pin:${victim.studentId}`), 30);
  assert.equal(await errorOf(await join(cls, SECRET, { ip: '2001:db8:999::1' })), 'claim_code_needed', 'an unknown network is not compared any more');
  assert.equal((await join(cls, SECRET, { ip: '192.0.2.200' })).status, 200, 'the network she joined from is');
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
