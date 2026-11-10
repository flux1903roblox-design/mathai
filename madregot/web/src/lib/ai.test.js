// The end of a streamed tutor reply (trust spec TRUST-3 §3.3): markers are never shown, not even half-arrived, and a
// care marker comes back as { care: true } so the screen can show the support card.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { useAIStatus, closeLimitSheet } from './account.js';
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
  it('throws only for a refusal or an error marker', () => {
    expect(() => streamEnd('\n[[refusal]]')).toThrow(expect.objectContaining({ code: 'refusal' }));
    expect(() => streamEnd('חלק\n[[care]]\n[[error:upstream]]')).toThrow(expect.objectContaining({ code: 'upstream' }));
    expect(() => streamEnd('חלק\n[[blocked]]')).not.toThrow();
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
