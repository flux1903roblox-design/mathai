// Request shapes the Worker sends to Claude, and how replies are read back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequest, buildCare, readResult, splitCare, STREAMED, AI_KINDS, FREE_KINDS, MAX_EXAM_PAGES, CARE_NOTE, LITE_MODEL,
} from '../../shared/ai.js';
import { safetyPrompt } from '../../shared/safety.js';
import { systemText } from './helpers.js';

const page = { data: 'data:image/jpeg;base64,/9j/4AAQ', mediaType: 'image/jpeg' };
const pdf = { data: 'data:application/pdf;base64,JVBERi0x', mediaType: 'application/pdf' };
const msg = (text, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text }] });

test('every kind builds a request with the fallback beta, caching and an effort level', () => {
  const inputs = {
    explain: { question: '3 - 8', correct: '-5', studentAnswer: '5' },
    chat: { question: '3 - 8', messages: [{ role: 'user', content: 'איך מתחילים?' }] },
    generate: { topic: 'מספרים מכוונים', level: 'חיבור', count: 3 },
    check: { image: page.data },
    exam: { pages: [page] },
  };
  for (const kind of AI_KINDS) {
    const r = buildRequest(kind, { grade: '8', ...inputs[kind] });
    assert.ok(r.betas.includes('server-side-fallback-2026-07-01'), kind);
    assert.equal(r.fallbacks, 'default');
    assert.equal(r.cache_control.type, 'ephemeral');
    assert.ok(['low', 'medium', 'high'].includes(r.output_config.effort), kind);
  }
});

test('an exam sends images and PDFs as blocks, the key, and each topic with its levels', () => {
  const r = buildRequest('exam', {
    grade: '8', pages: [page, pdf],
    topics: [{ id: 'line', title: 'פונקציה קווית', levels: ['טבלת ערכים', 'מה אומרים m ו־b'] }],
    key: [{ prompt: 'מה השיפוע?', answer: '3' }],
  });
  const content = r.messages[0].content;
  assert.deepEqual(content.map((c) => c.type), ['image', 'document', 'text']);
  assert.equal(content[1].source.media_type, 'application/pdf');
  const text = content[2].text;
  assert.match(text, /Answer key \(authoritative\)/);
  assert.match(text, /1\. מה השיפוע\? → 3/);
  assert.match(text, /line = פונקציה קווית; levels: 1 טבלת ערכים, 2 מה אומרים m ו־b/);
  assert.equal(r.output_config.format.type, 'json_schema');
  assert.ok(r.output_config.format.schema.properties.questions.items.required.includes('level'));
  assert.equal(r.output_config.effort, 'high');
  assert.ok(STREAMED('exam') && !STREAMED('explain'));
});

test('an exam needs pages and caps them', () => {
  assert.throws(() => buildRequest('exam', { pages: [] }));
  const r = buildRequest('exam', { pages: Array(MAX_EXAM_PAGES + 3).fill(page) });
  assert.equal(r.messages[0].content.filter((c) => c.type === 'image').length, MAX_EXAM_PAGES);
});

test('exam replies keep only real questions and sane levels', () => {
  const data = readResult('exam', msg(JSON.stringify({
    readable: true, title: 'בוחן', summary: '', weakTopics: [], nextSteps: [],
    questions: [
      { number: '1', prompt: 'א', status: 'wrong', topic: 'line', level: 6 },
      { number: '2', prompt: 'ב', status: 'correct', topic: 'line', level: 99 },
      { number: '3', prompt: '', status: 'correct', topic: 'line', level: 1 },
      { number: '4', prompt: 'ד', status: 'partial', topic: 'pyth', level: 1.5 },
    ],
  })));
  assert.deepEqual(data.questions.map((q) => q.level), [6, 0, 0]);
});

test('refusals and broken JSON surface as error codes', () => {
  assert.throws(() => readResult('explain', msg('', 'refusal')), (e) => e.code === 'refusal');
  assert.throws(() => readResult('exam', msg('{not json')), (e) => e.code === 'bad_output');
  assert.deepEqual(readResult('explain', msg('הסבר')), { text: 'הסבר' });
});

// ---------------------------------------------------------------- safety first (trust spec TRUST-3 §3.2-3.4)
const INPUTS = {
  explain: { question: '3 - 8', correct: '-5', studentAnswer: '5' },
  chat: { question: '3 - 8', messages: [{ role: 'user', content: 'איך מתחילים?' }] },
  generate: { topic: 'מספרים מכוונים', level: 'חיבור', count: 3 },
  check: { image: page.data },
  exam: { pages: [page] },
};
const SAFETY_PARTS = ['1201', '052-845-1201', '08:00–02:00', '055-957-1399', '105', '100', '101', '[[care]]'];
/** Every request the tutor can send: each kind in each shape it has, and the care request. */
function everyRequest() {
  const out = [];
  for (const kind of AI_KINDS) {
    out.push([`${kind}/full`, buildRequest(kind, INPUTS[kind])]);
    out.push([`${kind}/full main`, buildRequest(kind, INPUTS[kind], { model: 'claude-opus-5-5', shape: 'full' })]);
    if (FREE_KINDS.includes(kind)) {
      out.push([`${kind}/lite`, buildRequest(kind, INPUTS[kind], { shape: 'lite' })]);
      out.push([`${kind}/economy`, buildRequest(kind, INPUTS[kind], { shape: 'economy' })]);
    }
  }
  out.push(['care', buildCare(INPUTS.chat)]);
  return out;
}

test('every kind and every shape, and the care request, start with the safety block and carry every support number', () => {
  const block = safetyPrompt();
  const seen = everyRequest();
  assert.equal(seen.length, 5 * 2 + 2 * 2 + 1);
  for (const [name, params] of seen) {
    const sys = systemText(params);
    assert.ok(sys.startsWith(block), `${name}: the safety block comes first`);
    for (const part of SAFETY_PARTS) assert.ok(sys.includes(part), `${name}: ${part}`);
    assert.ok(!/only help with math/.test(sys), `${name}: no longer deflects everything that is not maths`);
  }
  // the old deflecting line is replaced by one that leaves room for safety
  assert.match(systemText(buildRequest('chat', INPUTS.chat)), /neither mathematics nor their safety, say kindly in one sentence that you are here for maths/);
});

test('a leading [[care]] line is removed and the reply is marked care; elsewhere it is left alone', () => {
  assert.deepEqual(readResult('chat', { content: [{ type: 'text', text: '[[care]]\nאני כאן…' }] }), { text: 'אני כאן…', care: true });
  assert.deepEqual(readResult('explain', msg('  [[care]]\r\nתודה שכתבתם.')), { text: 'תודה שכתבתם.', care: true });
  assert.deepEqual(readResult('chat', msg('הסבר [[care]]')), { text: 'הסבר [[care]]' });
  assert.throws(() => readResult('chat', msg('[[care]]\n  ')), (e) => e.code === 'bad_output', 'a care line with nothing after it');
  assert.deepEqual(splitCare('[[care]] שלום'), { text: 'שלום', care: true });
  assert.deepEqual(splitCare('שלום'), { text: 'שלום', care: false });
});

test('the check and exam schemas require a care boolean, and their replies always carry one', () => {
  for (const kind of ['check', 'exam']) {
    const schema = buildRequest(kind, INPUTS[kind]).output_config.format.schema;
    assert.ok(schema.required.includes('care'), kind);
    assert.equal(schema.properties.care.type, 'boolean', kind);
    assert.equal(schema.additionalProperties, false);
  }
  assert.ok(!buildRequest('generate', INPUTS.generate).output_config.format.schema.required.includes('care'));
  const check = { readable: true, transcript: '', steps: [], final: 'unknown', summary: '' };
  assert.equal(readResult('check', msg(JSON.stringify({ ...check, care: true }))).care, true);
  assert.equal(readResult('check', msg(JSON.stringify(check))).care, false, 'missing reads as false');
  assert.equal(readResult('exam', msg(JSON.stringify({ readable: true, title: '', questions: [], summary: '', weakTopics: [], nextSteps: [], care: 'yes' }))).care, false);
});

test('the care request: safety block and the no-maths line, the last 4 messages from a student turn, 700 tokens, low effort, no format', () => {
  const messages = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `הודעה ${i}` }));
  const p = buildCare({ messages, context: { question: '3 - 8', correct: '-5' } }, { model: 'claude-sonnet-5-5' });
  assert.equal(systemText(p), `${safetyPrompt()}\n\n${CARE_NOTE}`);
  assert.equal(p.max_tokens, 700);
  assert.equal(p.output_config.effort, 'low');
  assert.equal(p.output_config.format, undefined);
  assert.equal(p.tools, undefined);
  assert.ok(p.messages.length <= 4);
  assert.equal(p.messages[0].role, 'user');
  assert.deepEqual(p.messages.map((m) => m.content), ['הודעה 6', 'הודעה 7', 'הודעה 8']);
  assert.ok(!JSON.stringify(p.messages).includes('3 - 8'), 'no exercise context: the care reply is not a maths channel');
  assert.equal(p.model, 'claude-sonnet-5-5');
  assert.equal(buildCare({ messages: messages.slice(0, 4) }).messages.length, 4);
  assert.equal(buildCare({ messages: messages.slice(0, 5) }).messages.length, 3, 'starts from a student turn');
  assert.equal(buildCare({ messages: [{ role: 'user', content: 'אני רוצה למות' }] }, { model: LITE_MODEL }).fallbacks, undefined, 'the low-cost model has no fallback');
  assert.deepEqual(buildCare({ studentAnswer: 'בא לי להיעלם' }).messages, [{ role: 'user', content: 'בא לי להיעלם' }]);
  assert.throws(() => buildCare({ messages: [] }));
});

// ---------------------------------------------------------------- personal details (trust spec TRUST-4 §4.1, TRUST-5 §5)
test('every chat message and a typed answer are masked before they are clipped, in every shape and in the care request', () => {
  const phone = 'אפשר להתקשר אליי 052-1234567 או לכתוב ל־noa@example.test';
  const chat = { messages: [{ role: 'user', content: phone }, { role: 'assistant', content: 'תודה' }, { role: 'user', content: 'ת״ז 123456782' }], context: { question: '3 - 8' } };
  for (const shape of ['full', 'lite', 'economy']) {
    const sent = JSON.stringify(buildRequest('chat', chat, { shape }).messages);
    assert.ok(!/052-1234567|noa@example\.test|123456782/.test(sent), shape);
    assert.ok(sent.includes('[טלפון]') && sent.includes('[מייל]') && sent.includes('[ת״ז]'), shape);
    const explain = JSON.stringify(buildRequest('explain', { question: '3 - 8', correct: '-5', studentAnswer: '0521234567' }, { shape }).messages);
    assert.ok(!explain.includes('0521234567') && explain.includes("Student's answer: [טלפון]"), shape);
  }
  // masked first, then clipped: a number at the clip edge is never cut into a part that escapes the mask
  const long = `${'א'.repeat(590)} 052-1234567`;
  assert.ok(!JSON.stringify(buildRequest('chat', { messages: [{ role: 'user', content: long }] }, { shape: 'lite' }).messages).includes('052'));
  assert.ok(JSON.stringify(buildCare({ messages: [{ role: 'user', content: `אני מפחדת ${phone}` }] }).messages).includes('[טלפון]'));
  // maths stays as it is
  assert.equal(buildRequest('chat', { messages: [{ role: 'user', content: 'כמה זה 123456782 + 1?' }] }).messages[0].content, 'כמה זה 123456782 + 1?');
});

test('the exam and check prompts, and the exam title, say never to copy a name or ID: write [פרטים אישיים]', () => {
  for (const kind of ['exam', 'check']) {
    const sys = systemText(buildRequest(kind, INPUTS[kind]));
    assert.match(sys, /never copy it into your answer: write \[פרטים אישיים\] instead/, kind);
  }
  assert.match(systemText(buildRequest('exam', INPUTS.exam)), /The exam title must name the subject only, never a person\./);
  assert.ok(!systemText(buildRequest('chat', INPUTS.chat)).includes('[פרטים אישיים]'), 'only the photo kinds');
  const title = buildRequest('exam', INPUTS.exam).output_config.format.schema.properties.title.description;
  assert.match(title, /the subject only/); assert.match(title, /\[פרטים אישיים\]/);
});
