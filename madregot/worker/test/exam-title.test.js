// A class exam's saved title (trust spec TRUST-5 §6): the AI is told to name the subject only, and the server keeps no
// ID, phone or long number in it whatever the device sends. Every name and number here is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, makeClass, bearer, one } from './helpers.js';

let h;
afterEach(() => h?.done());

const save = async (st, title) => {
  const r = await h.call('POST', '/api/exams', { headers: bearer(st), body: { title, correct: 3, total: 5, questions: [], weakTopics: [] } });
  assert.equal(r.status, 200);
  return one(h.env, 'SELECT title FROM exams ORDER BY id DESC LIMIT 1').title;
};

test('a stored exam title keeps no ID number, phone or run of 7 digits', async () => {
  h = await setup();
  const cls = await makeClass(h, { students: ['נועה'] });
  const st = cls.students[0];
  const t = await save(st, 'מבחן של נועה כהן ת״ז 123456782');
  assert.doesNotMatch(t, /\d{9}/);
  assert.equal(t, 'מבחן של נועה כהן ת״ז [ת״ז]');
  assert.equal(await save(st, 'מבחן בשברים 052-1234567'), 'מבחן בשברים [טלפון]');
  assert.equal(await save(st, 'מבחן 123456789 ו־1234567'), 'מבחן # ו־#', 'long numbers with no ID word');
  assert.equal(await save(st, 'מבחן בגאומטריה 2026'), 'מבחן בגאומטריה 2026', 'a year stays');
  assert.equal(await save(st, ''), 'מבחן');
  assert.equal(await save(st, '   '), 'מבחן');
  const long = await save(st, `${'א'.repeat(78)} 123456782`);
  assert.ok(long.length <= 80);
  assert.doesNotMatch(long, /\d{7}/, 'scrubbed before it is cut, so no part of a number survives');
  // what the teacher sees is the same title
  const dash = await (await h.call('GET', '/api/teacher/dashboard', { headers: cls.teacher })).json();
  for (const e of dash.exams) assert.doesNotMatch(e.title, /\d{7,}/);
});
