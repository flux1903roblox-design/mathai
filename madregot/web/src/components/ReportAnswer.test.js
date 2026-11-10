// "Report this answer" (trust spec TRUST-4 §4.5): only the tutor's own text is sent, clipped, and the button exists only
// where there is a server to send it to.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useApp } from '@/lib/store.js';
import { useAIStatus } from '@/lib/account.js';
import ReportAnswer, { reportBody, sendReport, checkText, examText, generateText, REPORT_MAX } from './ReportAnswer.jsx';

beforeEach(() => {
  useApp.getState().setAI({ mode: 'server', apiUrl: 'https://api.example.test', key: '', device: 'a'.repeat(32), familyDevice: null });
  useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
  useAIStatus.setState({ status: { tier: 'free' } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('ReportAnswer', () => {
  it('is a labelled button where there is a server, and nothing at all in a build without one', () => {
    const out = renderToStaticMarkup(h(ReportAnswer, { kind: 'chat', reply: 'תשובה' }));
    expect(out).toContain('aria-label="דיווח על התשובה"');
    expect(out).toContain('aria-haspopup="dialog"');
    useApp.getState().setAI({ apiUrl: 'none' });
    expect(renderToStaticMarkup(h(ReportAnswer, { kind: 'chat', reply: 'תשובה' }))).toBe('');
  });
  it('is not shown for an unknown surface or an empty reply', () => {
    expect(renderToStaticMarkup(h(ReportAnswer, { kind: 'help', reply: 'x' }))).toBe('');
    expect(renderToStaticMarkup(h(ReportAnswer, { kind: 'chat', reply: '  ' }))).toBe('');
  });
  it('sends the reason, the surface, the tutor\'s reply (at most 4,000 characters) and the tier: nothing else', async () => {
    expect(reportBody({ reason: 'not_nice', kind: 'chat', reply: 'א'.repeat(5000) })).toEqual({ reason: 'not_nice', kind: 'chat', reply: 'א'.repeat(REPORT_MAX), tier: 'free' });
    const calls = [];
    vi.stubGlobal('fetch', async (url, init) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }); });
    useApp.getState().patchProfile({ token: 'stu_token_1' });
    await sendReport({ reason: 'wrong_math', kind: 'explain', reply: 'התשובה היא 7.' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.example.test/api/ai/report');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body)).toEqual({ reason: 'wrong_math', kind: 'explain', reply: 'התשובה היא 7.', tier: 'free' });
    expect(calls[0].init.headers['X-Device']).toBe('a'.repeat(32));
    expect(calls[0].init.headers.Authorization).toBe('Bearer stu_token_1');
  });
  it('the text of a check, an exam question or new exercises is the tutor\'s alone: never what the child wrote', () => {
    const check = checkText({ readable: true, final: 'wrong', steps: [{ text: '3x = 12', ok: true }, { text: 'x = 5', ok: false, comment: '12 : 3 = 4' }], summary: 'כמעט.' });
    expect(check).toBe('final: wrong\n1. ✓ 3x = 12\n2. ✗ x = 5 (12 : 3 = 4)\nכמעט.');
    const q = { number: 2, status: 'wrong', prompt: 'פתרו 2x = 8', studentAnswer: 'נועה כהן: x = 6', correctAnswer: 'x = 4', feedback: 'חילקתם ב־2?', solution: ['2x = 8', 'x = 4'] };
    const exam = examText(q);
    expect(exam).toBe('שאלה 2 (wrong)\nפתרו 2x = 8\nתשובה נכונה: x = 4\nחילקתם ב־2?\n1. 2x = 8\n2. x = 4');
    expect(exam).not.toContain('נועה');
    expect(examText({ ...q, item: { text: 'שאלה מהמפתח' } })).not.toContain('פתרו 2x = 8');
    expect(generateText([{ prompt: '2 + 2', answer: '4', hint: 'חברו', solution: ['2 + 2 = 4'] }])).toBe('1. 2 + 2\nתשובה: 4\nרמז: חברו\n2 + 2 = 4');
    for (const f of [checkText, examText]) expect(f(null)).toBe('');
  });
});
