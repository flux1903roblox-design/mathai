// A returning student's 4-digit PIN (POST /api/classes/:code/join): 10 wrong tries a day per student, counted before
// the PIN is compared, so guesses sent all at once cannot all be compared (DURABLE-8). The right PIN gives its try back;
// the teacher's reset clears the count.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, countOf } from './helpers.js';

let h;
afterEach(() => h?.done());

const join = (cls, pin, name = 'נועה') => h.call('POST', `/api/classes/${cls.code}/join`, { body: { name, pin } });
const errorOf = async (r) => (r.status === 200 ? 'ok' : (await r.json()).error);
const tally = (list) => list.reduce((o, x) => ({ ...o, [x]: (o[x] || 0) + 1 }), {});

test('50 wrong PINs at once: exactly 10 are compared (wrong_pin), 40 are refused (too_many_pin); the right PIN waits for the reset', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const guesses = Array.from({ length: 50 }, (_, i) => String(1000 + i * 7));
  assert.ok(!guesses.includes('1234'));
  const answers = await Promise.all(guesses.map(async (pin) => errorOf(await join(cls, pin))));
  assert.deepEqual(tally(answers), { wrong_pin: 10, too_many_pin: 40 });
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 10);

  const right = await join(cls, '1234');
  assert.equal(right.status, 429, 'the right PIN is not compared once the tries are used up');
  assert.equal((await right.json()).error, 'too_many_pin');
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 10, 'a refused try does not count');

  const reset = await h.call('POST', `/api/teacher/students/${noa.studentId}/reset-pin`, { headers: cls.teacher, body: {} });
  assert.equal(reset.status, 200);
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 0, 'the reset clears the count');
  const back = await join(cls, '1234');
  assert.equal(back.status, 200);
  assert.equal((await back.json()).returning, true);
});

test('5 wrong PINs and then the right one: 200, and only the 5 wrong tries stay counted', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  for (const pin of ['0000', '1111', '2222', '3333', '4444']) {
    const r = await join(cls, pin);
    assert.equal(r.status, 403); assert.equal((await r.json()).error, 'wrong_pin');
  }
  const r = await join(cls, '1234');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).studentId, noa.studentId);
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 5, 'the right PIN gave its try back');
});

test('the right PIN 5 times at once: 5 x 200, and the count is back at 0', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const [noa] = cls.students;
  const answers = await Promise.all(Array.from({ length: 5 }, async () => (await join(cls, '1234')).status));
  assert.deepEqual(answers, [200, 200, 200, 200, 200]);
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 0);
});

test('one student\'s wrong tries do not touch a classmate\'s, and a first join never counts a try', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה', 'איתי'] });
  const [noa, itai] = cls.students;
  await Promise.all(Array.from({ length: 12 }, () => join(cls, '9999')));
  assert.equal(countOf(h.env, `pin:${noa.studentId}`), 10);
  assert.equal(countOf(h.env, `pin:${itai.studentId}`), 0);
  assert.equal((await join(cls, '1234', 'איתי')).status, 200);
  const fresh = await join(cls, '5555', 'חדש');
  assert.equal(fresh.status, 200);
  assert.equal(countOf(h.env, `pin:${(await fresh.json()).studentId}`), 0);
});
