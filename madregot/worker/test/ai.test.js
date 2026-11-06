// Request shapes the Worker sends to Claude, and how replies are read back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, readResult, STREAMED, AI_KINDS, MAX_EXAM_PAGES } from '../../shared/ai.js';

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
