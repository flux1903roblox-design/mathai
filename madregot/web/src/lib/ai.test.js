// The end of a streamed tutor reply (trust spec TRUST-3 §3.3): markers are never shown, not even half-arrived, and a
// care marker comes back as { care: true } so the screen can show the support card.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { useAIStatus, closeLimitSheet } from './account.js';
import { BLOCKED_TEXT } from '@shared/safety.js';
import { runAI, streamView, streamEnd } from './ai.js';

beforeEach(() => {
  useApp.getState().setAI({ mode: 'server', apiUrl: 'https://api.example.test', key: '', familyDevice: null, pendingLink: null });
  useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
  useAIStatus.setState({ status: null, ended: false });
  closeLimitSheet();
});
afterEach(() => { vi.unstubAllGlobals(); });

/** A fetch that answers with a text body sent in these pieces. */
function streaming(pieces, headers = {}) {
  return vi.fn(async () => new Response(new ReadableStream({
    start(c) { const enc = new TextEncoder(); for (const p of pieces) c.enqueue(enc.encode(p)); c.close(); },
  }), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } }));
}

describe('streamView: what a reply that is still arriving shows', () => {
  it('hides a care line at the start, whole or in part', () => {
    expect(streamView('[')).toBe('');
    expect(streamView('[[ca')).toBe('');
    expect(streamView('[[care]]')).toBe('');
    expect(streamView('[[care]]\nאני')).toBe('אני');
  });
  it('hides markers at the end, whole or in part, any number of them', () => {
    expect(streamView('אני כאן\n[[ca')).toBe('אני כאן');
    expect(streamView('אני כאן\n[[care]]')).toBe('אני כאן');
    expect(streamView('אני כאן\n[[care]]\n[[refu')).toBe('אני כאן');
    expect(streamView('אני כאן\n[[care]]\n[[blocked]]')).toBe('אני כאן');
    expect(streamView('אני כאן\n[[error:upstream]]')).toBe('אני כאן');
    expect(streamView('אני כאן\n[')).toBe('אני כאן\n[', 'one bracket is not yet a marker');
  });
  it('leaves an ordinary reply alone', () => {
    expect(streamView('נסו לחסר $3$ משני האגפים.')).toBe('נסו לחסר $3$ משני האגפים.');
  });
});

describe('streamEnd: the finished reply', () => {
  it('reads every trailing marker; care comes back as care: true', () => {
    expect(streamEnd('אני כאן\n[[care]]')).toEqual({ text: 'אני כאן', care: true });
    expect(streamEnd('אני כאן\n[[care]]\n[[blocked]]')).toEqual({ text: 'אני כאן', care: true });
    expect(streamEnd('[[care]]\nאני כאן')).toEqual({ text: 'אני כאן', care: true });
    expect(streamEnd('הסבר.')).toEqual({ text: 'הסבר.', care: false });
  });
  it('a care line the model put on a later line is taken out and the reply is care (the trust review)', () => {
    expect(streamEnd('שמח שכתבת.\n[[care]]\nאפשר להתקשר לער״ן 1201.')).toEqual({ text: 'שמח שכתבת.\nאפשר להתקשר לער״ן 1201.', care: true });
    expect(streamView('שמח שכתבת.\n[[care]]\nאפשר')).toBe('שמח שכתבת.\nאפשר');
    expect(streamView('שמח שכתבת.\n[[ca')).toBe('שמח שכתבת.');
  });
  it('throws only for a refusal or an error marker', () => {
    expect(() => streamEnd('\n[[refusal]]')).toThrow(expect.objectContaining({ code: 'refusal' }));
    expect(() => streamEnd('חלק\n[[care]]\n[[error:upstream]]')).toThrow(expect.objectContaining({ code: 'upstream' }));
    expect(() => streamEnd('חלק\n[[blocked]]')).not.toThrow();
  });
  it('a reply the server stopped becomes the calm sentence, never a red error (trust spec TRUST-4 §4.2)', () => {
    expect(streamEnd('נסו לחסר \n[[blocked]]')).toEqual({ text: BLOCKED_TEXT, care: false, blocked: true });
    expect(streamEnd('\n[[blocked]]')).toEqual({ text: BLOCKED_TEXT, care: false, blocked: true });
    expect(BLOCKED_TEXT).toBe('לא הצלחתי לענות על זה כמו שצריך. אפשר לנסח את השאלה אחרת?');
  });
});

describe('runAI chat over a stream', () => {
  it('never shows "[[" while a care reply arrives in pieces, and returns care: true', async () => {
    vi.stubGlobal('fetch', streaming(['[[ca', 're]]\nאני כאן', '…', '\n[[ca', 're]]']));
    const shown = [];
    const r = await runAI('chat', { messages: [{ role: 'user', content: 'היי' }] }, { onText: (t) => shown.push(t) });
    expect(r).toEqual({ text: 'אני כאן…', care: true });
    expect(shown.length).toBeGreaterThan(0);
    for (const t of shown) expect(t).not.toContain('[');
    expect(shown.at(-1)).toBe('אני כאן…');
  });
  it('a plain reply is care: false; a refusal marker throws', async () => {
    vi.stubGlobal('fetch', streaming(['נסו ', 'שוב.']));
    expect(await runAI('chat', { messages: [] }, { onText: () => {} })).toEqual({ text: 'נסו שוב.', care: false });
    vi.stubGlobal('fetch', streaming(['\n[[refusal]]']));
    await expect(runAI('chat', { messages: [] }, { onText: () => {} })).rejects.toMatchObject({ code: 'refusal' });
  });
  it('a stopped stream resolves to the calm sentence; a blocked JSON reply passes through as it is', async () => {
    vi.stubGlobal('fetch', streaming(['נסו ', 'לחסר ', '\n[[blocked]]']));
    expect(await runAI('chat', { messages: [] }, { onText: () => {} })).toEqual({ text: BLOCKED_TEXT, care: false, blocked: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: BLOCKED_TEXT, blocked: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    expect(await runAI('explain', {})).toEqual({ text: BLOCKED_TEXT, blocked: true, care: false });
  });
  it('a care reply leaves the question count on screen as it was (the server sends no X-AI-Tier)', async () => {
    useAIStatus.setState({ status: { paywall: true, tier: 'free', kinds: ['explain', 'chat'], groups: { tutor: { left: 0, limit: 2 } } } });
    vi.stubGlobal('fetch', streaming(['תודה שכתבתם.', '\n[[care]]']));
    await runAI('chat', { messages: [] }, { onText: () => {} });
    expect(useAIStatus.getState().status.groups.tutor).toEqual({ left: 0, limit: 2 });
    expect(useAIStatus.getState().status.tier).toBe('free');
  });
});

describe('runAI without a stream', () => {
  it('passes care through from the JSON, and says care: false when it is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'תודה שכתבתם.', care: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    expect(await runAI('explain', { question: '1+1' })).toEqual({ text: 'תודה שכתבתם.', care: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'הסבר' }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    expect(await runAI('explain', { question: '1+1' })).toEqual({ text: 'הסבר', care: false });
  });
});

// The audit (stage 4): nothing limited how long the tutor waits. A phone that loses its connection in the middle of a
// request can leave fetch waiting with no error, and the server's call to Claude waits up to the SDK's 10 minutes (and
// tries twice more), so the child saw "thinking" with no word of what happened. Chat, explain and feedback now stop
// waiting and say so in Hebrew; the photo checks and exams, which take minutes by nature, are not limited here.
describe('runAI when the server does not answer', () => {
  /** A fetch that never answers, and fails as a real fetch does when its signal is aborted. */
  const hanging = () => vi.fn((url, init = {}) => new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }));
  /** A fetch whose streamed reply starts and then stops coming, without closing. */
  const stalled = (first) => vi.fn(async () => new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(first)); },
  }), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  /** Where a promise stands after the fake clock moved: pending, or what it settled with. */
  const watch = (p) => { const w = { state: 'pending' }; p.then((v) => { w.state = 'resolved'; w.value = v; }, (e) => { w.state = 'rejected'; w.error = e; }); return w; };
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a chat, an explanation and feedback stop waiting and say so in Hebrew, and not in the first minute', async () => {
    for (const [kind, opts] of [['chat', { onText: () => {} }], ['explain', {}], ['feedback', {}]]) {
      vi.stubGlobal('fetch', hanging());
      const w = watch(runAI(kind, { messages: [{ role: 'user', content: 'איך מתחילים?' }] }, opts));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(w.state, `${kind} after a minute`).toBe('pending');
      await vi.advanceTimersByTimeAsync(4 * 60_000);
      expect(w.state, `${kind} after five minutes`).toBe('rejected');
      expect(w.error.code).toBe('timeout');
      expect(w.error.message).toMatch(/העוזר לא ענה/);
      expect(w.error.message).toMatch(/נסו שוב/);
    }
  });
  it('a streamed chat that stops coming in the middle stops waiting too, with the same words', async () => {
    vi.stubGlobal('fetch', stalled('נתחיל '));
    const shown = [];
    const w = watch(runAI('chat', { messages: [{ role: 'user', content: 'איך מתחילים?' }] }, { onText: (t) => shown.push(t) }));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(shown).toContain('נתחיל ');
    expect(w.state).toBe('rejected');
    expect(w.error.code).toBe('timeout');
  });
  it('closing the chat is still an abort, not a timeout; a photo check is not limited here', async () => {
    vi.stubGlobal('fetch', hanging());
    const ctrl = new AbortController();
    const w = watch(runAI('chat', { messages: [{ role: 'user', content: 'היי' }] }, { onText: () => {}, signal: ctrl.signal }));
    ctrl.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(w.state).toBe('rejected');
    expect(w.error.name).toBe('AbortError');
    const check = watch(runAI('check', { image: 'x' }));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(check.state).toBe('pending');
  });
});
