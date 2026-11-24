// The shared sync moments and the keepalive budget (DURABLE-5's scheduler, first used by the class outbox, DURABLE-7).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp, today } from '../store.js';
import {
  startMoments, onMoment, emit, keepaliveBudget, bodyBytes, MOMENT_ORDER, KEEPALIVE_BYTES, BOOT_DELAY, LESSON_DELAY, TICK_EVERY, AWAY_FOR,
} from './moments.js';

/** A page: a document whose visibility a test sets, and a window; both dispatch events like the browser's. */
function page() {
  const doc = new EventTarget(); doc.visibilityState = 'visible';
  const win = new EventTarget();
  const show = (state) => { doc.visibilityState = state; doc.dispatchEvent(new Event('visibilitychange')); };
  return { doc, win, show };
}

let stop; let unsubs;
const seen = [];
const listen = (names, opts) => { unsubs.push(onMoment(names, (m) => { seen.push(m); }, opts)); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T10:00:00'));
  seen.length = 0; unsubs = []; stop = () => {};
  keepaliveBudget.reset();
  useApp.setState({ days: {} });
});
afterEach(() => { stop(); unsubs.forEach((u) => u()); vi.useRealTimers(); });

describe('the keepalive budget', () => {
  it('gives 60,000 bytes per hidden moment, in claims that fit', () => {
    expect(KEEPALIVE_BYTES).toBe(60_000);
    expect(keepaliveBudget.claim(8_000)).toBe(true); // the family summary
    expect(keepaliveBudget.claim(50_000)).toBe(true); // a class batch
    expect(keepaliveBudget.left()).toBe(2_000);
    expect(keepaliveBudget.claim(2_001)).toBe(false); // the vault does not fit: sent as a normal fetch
    expect(keepaliveBudget.left()).toBe(2_000); // a refused claim takes nothing
    expect(keepaliveBudget.claim(2_000)).toBe(true);
    expect(keepaliveBudget.claim(1)).toBe(false);
  });
  it('refuses nonsense sizes', () => {
    for (const n of [-1, NaN, Infinity, undefined, 60_001]) expect(keepaliveBudget.claim(n)).toBe(false);
    expect(keepaliveBudget.left()).toBe(60_000);
  });
  it('starts again at the next hidden moment, not before', async () => {
    expect(keepaliveBudget.claim(59_000)).toBe(true);
    await emit('tick'); await emit('online'); await emit('boot');
    expect(keepaliveBudget.left()).toBe(1_000);
    await emit('hidden');
    expect(keepaliveBudget.left()).toBe(60_000);
  });
  it('measures bytes, not characters: ASCII is one byte a character, Hebrew two, an emoji four', () => {
    expect(bodyBytes('abc')).toBe(3);
    expect(bodyBytes('שלום')).toBe(8);
    expect('שלום'.length).toBe(4);
    expect(bodyBytes('🙂')).toBe(4);
    const body = { events: [{ topic: 'neg', cat: 'סימן' }] };
    expect(bodyBytes(body)).toBe(JSON.stringify(body).length + 4); // four Hebrew letters, one extra byte each
    expect(bodyBytes(body)).toBe(new TextEncoder().encode(JSON.stringify(body)).length);
  });
});

describe('the moments', () => {
  it('hidden runs the family summary, then the class outbox, then the vault, whatever order they subscribed in', async () => {
    const order = [];
    const claimer = (who, bytes) => () => { order.push(`${who}:${keepaliveBudget.claim(bytes)}`); };
    unsubs.push(onMoment('hidden', claimer('vault', 30_000), { priority: MOMENT_ORDER.vault }));
    unsubs.push(onMoment(['hidden', 'tick'], claimer('class', 40_000), { priority: MOMENT_ORDER.classOutbox }));
    unsubs.push(onMoment('hidden', claimer('family', 8_000), { priority: MOMENT_ORDER.family }));
    await emit('hidden');
    // the summary and the class batch fit; the vault's 30,000 does not fit the 12,000 left
    expect(order).toEqual(['family:true', 'class:true', 'vault:false']);
  });

  it('a subscriber that fails does not stop the others', async () => {
    unsubs.push(onMoment('hidden', () => { throw new Error('boom'); }, { priority: 1 }));
    unsubs.push(onMoment('hidden', async () => { throw new Error('later boom'); }, { priority: 2 }));
    listen('hidden', { priority: 3 });
    const out = await emit('hidden');
    expect(out.map((r) => r.status)).toEqual(['rejected', 'rejected', 'fulfilled']);
    expect(seen).toEqual(['hidden']);
  });

  it('unsubscribing stops the calls', async () => {
    const off = onMoment('tick', () => seen.push('tick'));
    await emit('tick'); off(); await emit('tick');
    expect(seen).toEqual(['tick']);
  });

  it('boot comes 3 s after the start, when the browser is idle', () => {
    const p = page(); const idle = [];
    p.win.requestIdleCallback = (fn) => { idle.push(fn); };
    listen('boot');
    stop = startMoments({ doc: p.doc, win: p.win });
    vi.advanceTimersByTime(BOOT_DELAY - 1);
    expect(idle).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([]);
    idle[0]();
    expect(seen).toEqual(['boot']);
  });

  it('hidden on visibilitychange and on pagehide, once for both; visible only after 60 s away', () => {
    const p = page();
    listen(['hidden', 'visible']);
    stop = startMoments({ doc: p.doc, win: p.win });
    p.show('hidden'); p.win.dispatchEvent(new Event('pagehide'));
    expect(seen).toEqual(['hidden']);
    vi.advanceTimersByTime(AWAY_FOR - 1_000);
    p.show('visible');
    expect(seen).toEqual(['hidden']); // back after 59 s: nothing to pull
    p.win.dispatchEvent(new Event('pagehide')); // a tab closed while in view
    expect(seen).toEqual(['hidden', 'hidden']);
    p.win.dispatchEvent(new Event('pageshow')); // restored from the back-forward cache
    p.show('hidden');
    vi.advanceTimersByTime(AWAY_FOR);
    p.show('visible');
    expect(seen).toEqual(['hidden', 'hidden', 'hidden', 'visible']);
  });

  it('tick every 10 minutes, only while in view; online when the browser is back online', () => {
    const p = page();
    listen(['tick', 'online']);
    stop = startMoments({ doc: p.doc, win: p.win });
    vi.advanceTimersByTime(TICK_EVERY);
    expect(seen).toEqual(['tick']);
    p.show('hidden');
    vi.advanceTimersByTime(TICK_EVERY * 2);
    expect(seen).toEqual(['tick']);
    p.win.dispatchEvent(new Event('online'));
    expect(seen).toEqual(['tick', 'online']);
  });

  it('lesson: 30 s after a lesson or a teaching stage is finished today, once for a run of them', () => {
    const p = page();
    listen('lesson');
    stop = startMoments({ doc: p.doc, win: p.win });
    const d = today();
    useApp.setState({ days: { [d]: { q: 8, lessons: 0 } } }); // answers alone are not a lesson
    vi.advanceTimersByTime(LESSON_DELAY * 2);
    expect(seen).toEqual([]);
    useApp.setState({ days: { [d]: { q: 8, lessons: 1 } } });
    vi.advanceTimersByTime(LESSON_DELAY - 10_000);
    useApp.setState({ days: { [d]: { q: 8, lessons: 1, stages: 1 } } });
    vi.advanceTimersByTime(9_999);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(['lesson']);
    vi.advanceTimersByTime(LESSON_DELAY * 3);
    expect(seen).toEqual(['lesson']); // one moment for both
    useApp.setState({ days: { [d]: { q: 16, lessons: 2, stages: 1 } } });
    vi.advanceTimersByTime(LESSON_DELAY);
    expect(seen).toEqual(['lesson', 'lesson']);
  });

  it('stopping removes every listener and timer', () => {
    const p = page();
    listen(['boot', 'hidden', 'tick', 'online', 'lesson']);
    startMoments({ doc: p.doc, win: p.win })();
    p.show('hidden'); p.win.dispatchEvent(new Event('online'));
    useApp.setState({ days: { [today()]: { lessons: 1 } } });
    vi.advanceTimersByTime(TICK_EVERY * 2);
    expect(seen).toEqual([]);
  });
});
