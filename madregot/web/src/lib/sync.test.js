// A class student's answers reach the class server and leave the outbox only once acknowledged (DURABLE-7).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp, OUTBOX_MAX } from './store.js';
import { syncNow, sameOrigin, SYNC_BATCH } from './api.js';
import { keepaliveBudget, bodyBytes } from './durable/moments.js';

const API = 'https://api.madregot.test';
let calls; let answer;

/** A fake class server: `answer(body, n)` gives the reply to the n-th request (default: every answer saved). */
function server() {
  calls = [];
  answer = (body) => ({ saved: body.events.length });
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, keepalive: !!init.keepalive, headers: init.headers, bytes: new TextEncoder().encode(init.body).length });
    const r = await answer(body, calls.length);
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body ?? r), { status: r.status || 200 });
  }));
}

const event = (n) => ({ topic: 'neg', level: 1, ok: n % 2 === 0, first: true, hint: false, secs: 5, at: '2026-11-05T10:00:00.000Z', purpose: 'practice', key: `k${n}`, cands: ['x'] });
const record = (k) => { for (let i = 0; i < k; i += 1) useApp.getState().recordAnswer(event(i), 0); };
const outbox = () => useApp.getState().outbox;
const sent = () => calls.flatMap((c) => c.body.events.map((e) => e.id));

beforeEach(() => {
  server();
  vi.stubGlobal('location', { origin: 'https://app.madregot.test' });
  keepaliveBudget.reset();
  useApp.setState({
    profile: { role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', token: 'stu_token_1', studentId: 's1' },
    outbox: [], progress: { neg: { level: 2, max: 2 } }, days: {},
    ai: { ...useApp.getState().ai, apiUrl: API },
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the outbox', () => {
  it('each answer of a class student gets its own 12-hex id; at most 1,000 wait, the oldest give way', () => {
    record(3);
    const ids = outbox().map((e) => e.id);
    expect(ids.every((id) => /^[a-f0-9]{12}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(3);
    // only what the server stores is kept for it (an older save's full answers are trimmed when sent)
    expect(Object.keys(outbox()[0]).sort()).toEqual(['at', 'cat', 'first', 'hint', 'id', 'level', 'ok', 'secs', 'topic']);
    useApp.setState({ outbox: Array.from({ length: OUTBOX_MAX }, (_, i) => ({ ...event(i), id: i.toString(16).padStart(12, '0') })) });
    record(1);
    expect(outbox()).toHaveLength(1000);
    expect(outbox()[0].id).toBe('000000000001');
  });
  it('a student who is not in a class queues nothing; leaving the class empties the outbox', () => {
    record(2);
    useApp.getState().leaveClass();
    expect(outbox()).toEqual([]);
    record(2);
    expect(outbox()).toEqual([]);
  });
  it('ackOutbox removes only the ids given', () => {
    record(4);
    const [a, , c] = outbox().map((e) => e.id);
    useApp.getState().ackOutbox([a, c, 'ffffffffffff']);
    expect(outbox().map((e) => e.id)).not.toContain(a);
    expect(outbox()).toHaveLength(2);
  });
});

describe('syncNow', () => {
  it('700 answers go in batches of 300, 300 and 100, in order, and the outbox is empty', async () => {
    record(700);
    const order = outbox().map((e) => e.id);
    await syncNow();
    expect(calls.map((c) => c.body.events.length)).toEqual([300, 300, 100]);
    expect(sent()).toEqual(order);
    expect(outbox()).toEqual([]);
    expect(calls.every((c) => c.url === `${API}/api/progress` && c.headers.Authorization === 'Bearer stu_token_1')).toBe(true);
    expect(calls[0].body.levels).toEqual({ neg: { level: 2, max: 2 } });
    expect(SYNC_BATCH).toBe(300);
  });

  it('sends only what the server stores of an answer', async () => {
    record(1);
    await syncNow();
    expect(Object.keys(calls[0].body.events[0]).sort()).toEqual(['at', 'first', 'hint', 'id', 'level', 'ok', 'secs', 'topic']);
  });

  it('the server saved 120 of 300: 180 stay queued, and they are the ones after the first 120', async () => {
    record(300);
    const order = outbox().map((e) => e.id);
    answer = () => ({ saved: 120 });
    await syncNow();
    expect(calls).toHaveLength(1);
    expect(outbox().map((e) => e.id)).toEqual(order.slice(120));
  });

  it('a reply without a count, or a larger count, acknowledges nothing more than was sent', async () => {
    record(10);
    answer = () => ({ ok: true });
    await syncNow();
    expect(outbox()).toHaveLength(10);
    answer = () => ({ saved: 9999 });
    await syncNow();
    expect(outbox()).toEqual([]);
  });

  it('an answer given while the request is on its way stays queued', async () => {
    record(5);
    const first = outbox().map((e) => e.id);
    let release;
    // the first request is slow; the next one (the late answer, sent in the same run) finds no network
    answer = (body, n) => (n === 1 ? new Promise((r) => { release = () => r({ saved: body.events.length }); }) : new TypeError('Failed to fetch'));
    const run = syncNow();
    expect(calls).toHaveLength(1);
    record(1);
    const late = outbox().at(-1).id;
    await syncNow(); // a second sync while the first runs sends nothing (the guard)
    expect(calls).toHaveLength(1);
    release();
    await run;
    expect(calls.map((c) => c.body.events.map((e) => e.id))).toEqual([first, [late]]);
    expect(outbox().map((e) => e.id)).toEqual([late]);
  });

  it('a network error keeps everything; the next sync sends it', async () => {
    record(350);
    answer = () => new TypeError('Failed to fetch');
    await syncNow();
    expect(outbox()).toHaveLength(350);
    answer = (body) => ({ saved: body.events.length });
    await syncNow();
    expect(outbox()).toEqual([]);
  });

  it('a server error keeps everything; a refused class token is forgotten and the answers wait', async () => {
    record(3);
    answer = () => ({ status: 500, body: { error: 'server_error' } });
    await syncNow();
    expect(outbox()).toHaveLength(3);
    answer = () => ({ status: 401, body: { error: 'not_signed_in' } });
    await syncNow();
    expect(useApp.getState().profile.token).toBeNull();
    expect(outbox()).toHaveLength(3);
    calls.length = 0;
    await syncNow();
    expect(calls).toHaveLength(0);
  });

  it('answers saved before they had ids get one, and are acknowledged like the rest', async () => {
    useApp.setState({ outbox: [event(1), event(2)] });
    await syncNow();
    expect(sent().every((id) => /^[a-f0-9]{12}$/.test(id))).toBe(true);
    expect(outbox()).toEqual([]);
  });

  it('nothing queued: no request, unless the levels are asked for (just after joining)', async () => {
    await syncNow();
    expect(calls).toHaveLength(0);
    await syncNow({ levels: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ events: [], levels: { neg: { level: 2, max: 2 } } });
  });

  it('stops after 5 requests (1,500 answers); the rest wait for the next moment', async () => {
    useApp.setState({ outbox: Array.from({ length: 1000 }, (_, i) => ({ ...event(i), id: i.toString(16).padStart(12, '0') })) });
    answer = (body) => ({ saved: Math.min(body.events.length, 150) });
    await syncNow();
    expect(calls).toHaveLength(1); // a short count ends the run
    expect(outbox()).toHaveLength(850);
  });
});

describe('keepalive', () => {
  it('hidden, the same address and a body that fits: keepalive, and the bytes are taken from the budget', async () => {
    vi.stubGlobal('location', { origin: API });
    expect(sameOrigin()).toBe(true);
    record(20);
    await syncNow({ hidden: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].keepalive).toBe(true);
    expect(keepaliveBudget.left()).toBe(60_000 - calls[0].bytes);
    expect(calls[0].bytes).toBe(bodyBytes(calls[0].body));
  });

  it('not hidden: never keepalive', async () => {
    vi.stubGlobal('location', { origin: API });
    record(20);
    await syncNow();
    expect(calls[0].keepalive).toBe(false);
    expect(keepaliveBudget.left()).toBe(60_000);
  });

  it('another address (the class server is cross-origin): no keepalive and nothing taken', async () => {
    expect(sameOrigin()).toBe(false);
    record(20);
    await syncNow({ hidden: true });
    expect(calls[0].keepalive).toBe(false);
    expect(keepaliveBudget.left()).toBe(60_000);
  });

  it('a batch that does not fit what is left of the budget goes as a normal request; later batches may still fit', async () => {
    vi.stubGlobal('location', { origin: API });
    record(301);
    expect(keepaliveBudget.claim(60_000 - 2_000)).toBe(true); // the family summary and others took most of it
    await syncNow({ hidden: true });
    expect(calls.map((c) => c.keepalive)).toEqual([false, true]);
    expect(calls[0].bytes).toBeGreaterThan(2_000);
    expect(calls[1].bytes).toBeLessThan(2_000);
  });

  it('bytes, not characters: a body with Hebrew is measured in UTF-8 bytes', async () => {
    vi.stubGlobal('location', { origin: API });
    useApp.setState({ progress: { 'שבר': { level: 1, max: 1 } } });
    record(1);
    await syncNow({ hidden: true });
    const text = JSON.stringify(calls[0].body);
    expect(calls[0].bytes).toBe(text.length + 3); // three Hebrew letters
    expect(keepaliveBudget.left()).toBe(60_000 - calls[0].bytes);
  });

  it('no server address: not the same origin', () => {
    useApp.setState({ ai: { ...useApp.getState().ai, apiUrl: 'none' } });
    expect(sameOrigin()).toBe(false);
  });
});
