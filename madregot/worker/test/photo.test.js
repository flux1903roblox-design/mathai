// Exam and notebook photos on the server (trust spec TRUST-5 §2, §3). Every page passes the step that crops and blacks
// out on the device, and a PDF cannot pass it, so the server refuses a PDF before anything else: no Claude call, nothing
// counted. How the photos were prepared (input.prep) is counted as a safety event, with nothing of the pages. Claude is
// stubbed; every picture here is a few synthetic bytes.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, ai, makeClass, rows, countOf } from './helpers.js';

let h;
afterEach(() => h?.done());
const off = () => setup({ AI_PAYWALL: undefined });

const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';
const PDF = 'JVBERi0xLjcKJcfsj6IKMSAwIG9iago='; // "%PDF-1.7 …" in base64
const exam = (pages, extra = {}) => ({ body: { pages, grade: '7', ...extra } });

test('an exam with a PDF page is refused with 400 pdf_not_allowed: no Claude call, nothing counted', async () => {
  h = await off();
  const cls = await makeClass(h);
  const cases = [
    [{ data: `data:application/pdf;base64,${PDF}`, mediaType: 'application/pdf' }],
    [{ data: JPEG, mediaType: 'image/jpeg' }, { data: PDF, mediaType: 'application/pdf' }], // one PDF among images
    [{ data: `data:application/pdf;base64,${PDF}`, mediaType: 'image/jpeg' }], // a PDF that says it is a picture
    [{ data: PDF, mediaType: 'image/jpeg' }], // the bytes alone
    [{ data: `data:image/jpeg;base64,${PDF}`, mediaType: 'image/jpeg' }],
  ];
  for (const pages of cases) {
    const r = await ai(h, 'exam', cls.teacher, exam(pages));
    assert.equal(r.status, 400, JSON.stringify(pages.map((p) => p.mediaType)));
    assert.equal((await r.json()).error, 'pdf_not_allowed');
  }
  const check = await ai(h, 'check', cls.teacher, { body: { image: `data:application/pdf;base64,${PDF}`, mediaType: 'application/pdf' } });
  assert.equal(check.status, 400);
  assert.equal((await check.json()).error, 'pdf_not_allowed');
  assert.equal(h.net.log.claude.length, 0, 'Claude never saw a PDF');
  assert.equal(countOf(h.env, `t:${cls.code}`), 0, 'and no question was taken');
  // the same exam as pictures goes through
  const ok = await ai(h, 'exam', cls.teacher, exam([{ data: JPEG, mediaType: 'image/jpeg' }]));
  assert.equal(ok.status, 200);
  assert.equal(h.net.log.claude.length, 1);
  assert.equal(countOf(h.env, `t:${cls.code}`), 1, 'the counter the refusals left alone');
  assert.ok(h.net.log.claude[0].messages[0].content.every((b) => b.type !== 'document'), 'no document block');
});

test('input.prep is counted as photo_redacted (crop, black or none), from the client, with nothing of the pages', async () => {
  h = await off();
  const cls = await makeClass(h);
  const events = () => rows(h.env, "SELECT kind, category, surface, source, tier FROM safety_events WHERE kind = 'photo_redacted' ORDER BY id").map((x) => ({ ...x }));
  const page = { data: JPEG, mediaType: 'image/jpeg' };
  assert.equal((await ai(h, 'exam', cls.teacher, exam([page, page], { prep: { crop: true, boxes: 3 } }))).status, 200);
  await h.ctx.flush();
  assert.deepEqual(events(), [
    { kind: 'photo_redacted', category: 'crop', surface: 'exam', source: 'client', tier: 'open' },
    { kind: 'photo_redacted', category: 'black', surface: 'exam', source: 'client', tier: 'open' },
  ]);
  assert.equal((await ai(h, 'check', cls.teacher, { body: { image: JPEG, mediaType: 'image/jpeg', prep: { crop: false, boxes: 0 } } })).status, 200);
  assert.equal((await ai(h, 'check', cls.teacher, { body: { image: JPEG, mediaType: 'image/jpeg', prep: { crop: false, boxes: 1 } } })).status, 200);
  // anything else in prep is not a count: it reads as nothing done
  assert.equal((await ai(h, 'check', cls.teacher, { body: { image: JPEG, mediaType: 'image/jpeg', prep: { crop: 'yes', boxes: '2', name: 'נועה' } } })).status, 200);
  // no prep (an older app): no event
  assert.equal((await ai(h, 'check', cls.teacher, { body: { image: JPEG, mediaType: 'image/jpeg' } })).status, 200);
  // prep on another kind is ignored
  assert.equal((await ai(h, 'explain', cls.teacher, { body: { question: '3 - 8', correct: '-5', prep: { crop: true, boxes: 1 } } })).status, 200);
  await h.ctx.flush();
  assert.deepEqual(events().slice(2).map((e) => [e.category, e.surface]), [['none', 'check'], ['black', 'check'], ['none', 'check']]);
  // the request Claude gets carries the pictures and nothing about how they were prepared
  for (const p of h.net.log.claude) assert.doesNotMatch(JSON.stringify(p.messages), /"prep"|"boxes"|"crop"/);
});
