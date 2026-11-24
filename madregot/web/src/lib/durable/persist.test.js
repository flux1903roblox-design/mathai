// Asking the browser to keep the data (DURABLE-3), with a stubbed navigator.storage: once after the first lesson, never
// by itself on Firefox, the answer kept fresh when the page comes back into view, and "לא ידוע" where a browser cannot say.
import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createDurableStatus } from './useDurable.js';
import { DURABLE_DEFAULTS } from './migrations.js';
import {
  askAfterLesson, askFromSettings, readPersisted, watchPersisted, canAsk, persistedText, isFirefox, PERSISTED_TEXT, PERSIST_TOAST,
} from './persist.js';

const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';

/** A browser whose storage answers `persisted` until persist() is answered with `grant`; it counts the asks. */
function browser({ ua = CHROME, persisted = false, grant = false, storage = true } = {}) {
  const nav = { userAgent: ua, asks: 0 };
  if (storage) {
    let kept = persisted;
    nav.storage = {
      persisted: async () => kept,
      persist: async () => { nav.asks += 1; kept = grant; return grant; },
    };
  }
  return nav;
}
const NOW = new Date('2026-11-05T10:00:00Z');
let store; let status;
const opts = (nav) => ({ nav, store, status, now: () => NOW });

beforeEach(() => {
  store = create(() => ({ durable: { ...DURABLE_DEFAULTS } }));
  status = createDurableStatus();
});

describe('after a finished lesson', () => {
  it('asks once: the first lesson asks and notes when, later lessons and a reload do not ask again', async () => {
    const nav = browser({ grant: false });
    expect(await askAfterLesson(opts(nav))).toBe('refused');
    expect(nav.asks).toBe(1);
    expect(store.getState().durable.persistAsked).toBe(NOW.toISOString());
    expect(status.getState().persisted).toBe(false);
    expect(await askAfterLesson(opts(nav))).toBe('asked-before');
    // a reload: a new page with the same saved durable slice and a fresh status
    status = createDurableStatus();
    expect(await askAfterLesson(opts(nav))).toBe('asked-before');
    expect(nav.asks).toBe(1);
  });

  it('a browser that agrees: the answer shows at once', async () => {
    const nav = browser({ grant: true });
    expect(await askAfterLesson(opts(nav))).toBe('granted');
    expect(status.getState().persisted).toBe(true);
    expect(nav.asks).toBe(1);
  });

  it('a browser that keeps the data already is not asked', async () => {
    const nav = browser({ persisted: true });
    expect(await askAfterLesson(opts(nav))).toBe('kept');
    expect(nav.asks).toBe(0);
    expect(store.getState().durable.persistAsked).toBe(null);
  });

  it('never asks on Firefox by itself (its prompt is left to the Settings button)', async () => {
    const nav = browser({ ua: FIREFOX });
    expect(isFirefox(nav)).toBe(true);
    expect(await askAfterLesson(opts(nav))).toBe('firefox');
    expect(nav.asks).toBe(0);
    expect(store.getState().durable.persistAsked).toBe(null);
    expect(status.getState().persisted).toBe(false);
  });

  it('two result screens at once share one ask', async () => {
    const nav = browser();
    await Promise.all([askAfterLesson(opts(nav)), askAfterLesson(opts(nav))]);
    expect(nav.asks).toBe(1);
  });

  it('no navigator.storage: null, "לא ידוע", and nothing is asked or noted', async () => {
    const nav = browser({ storage: false });
    expect(await askAfterLesson(opts(nav))).toBe('unknown');
    expect(status.getState().persisted).toBe(null);
    expect(persistedText(status.getState().persisted)).toBe('לא ידוע');
    expect(store.getState().durable.persistAsked).toBe(null);
    expect(await askFromSettings(opts(nav))).toBe(null);
  });

  it('a storage that throws reads as "cannot say"', async () => {
    const nav = { userAgent: CHROME, storage: { persisted: async () => { throw new Error('blocked'); } } };
    expect(await readPersisted({ nav, status })).toBe(null);
  });
});

describe('Settings', () => {
  it('the words for each answer', () => {
    expect(persistedText(true)).toBe('כן');
    expect(persistedText(false)).toBe('לא מובטחת');
    expect(persistedText(null)).toBe('לא ידוע');
    expect(PERSISTED_TEXT).toEqual({ yes: 'כן', no: 'לא מובטחת', unknown: 'לא ידוע' });
    expect(PERSIST_TOAST).toEqual({ granted: 'הדפדפן הסכים לשמור את הנתונים.', refused: 'הדפדפן לא הבטיח לשמור. כדאי לשמור גיבוי.' });
  });

  it('the button asks now, on Firefox too, and notes when', async () => {
    const nav = browser({ ua: FIREFOX, grant: true });
    expect(await askFromSettings(opts(nav))).toBe(true);
    expect(nav.asks).toBe(1);
    expect(store.getState().durable.persistAsked).toBe(NOW.toISOString());
    expect(status.getState().persisted).toBe(true);
  });

  it('the button shows while there is no promise; on Firefox only until it was asked once', () => {
    const chrome = browser(); const firefox = browser({ ua: FIREFOX });
    expect(canAsk(false, null, chrome)).toBe(true);
    expect(canAsk(false, '2026-11-01T00:00:00Z', chrome)).toBe(true);
    expect(canAsk(true, null, chrome)).toBe(false);
    expect(canAsk(null, null, chrome)).toBe(false);
    expect(canAsk(false, null, firefox)).toBe(true);
    expect(canAsk(false, '2026-11-01T00:00:00Z', firefox)).toBe(false);
    expect(canAsk(false, null, browser({ storage: false }))).toBe(false);
  });
});

describe('kept fresh', () => {
  it('read on open, and again whenever the page comes back into view', async () => {
    let kept = false;
    const nav = { userAgent: CHROME, storage: { persisted: async () => kept, persist: async () => kept } };
    const doc = new EventTarget(); doc.visibilityState = 'visible';
    const stop = watchPersisted({ nav, doc, status });
    await Promise.resolve(); await Promise.resolve();
    expect(status.getState().persisted).toBe(false);
    // the browser decided meanwhile (Chrome grants by engagement): the app sees it when it is shown again
    kept = true;
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve(); await Promise.resolve();
    expect(status.getState().persisted).toBe(false);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve(); await Promise.resolve();
    expect(status.getState().persisted).toBe(true);
    stop();
    kept = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve(); await Promise.resolve();
    expect(status.getState().persisted).toBe(true);
  });
});
