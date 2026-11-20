// Light and dark (STUDENT-2 §6): applyTheme sets or removes data-theme, paints the browser bar, keeps the mirror that
// public/theme-boot.js reads before the first paint, and tells the code that paints colours itself.
// The unit tests run in node, so the page is a small stand-in.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { applyTheme, themeName, THEME_KEY, THEME_EVENT } from './theme.js';

function fakePage({ dark = false } = {}) {
  const attrs = {};
  const dataset = new Proxy({}, {
    get: (_, k) => attrs[`data-${String(k)}`],
    set: (_, k, v) => { attrs[`data-${String(k)}`] = String(v); return true; },
  });
  const html = { dataset, setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: (k) => { delete attrs[k]; }, hasAttribute: (k) => k in attrs, getAttribute: (k) => attrs[k] ?? null };
  const meta = (media) => { const a = { media, content: '#ffffff' }; return { getAttribute: (k) => a[k] ?? null, setAttribute: (k, v) => { a[k] = v; }, get content() { return a.content; } }; };
  const metas = [meta('(prefers-color-scheme: light)'), meta('(prefers-color-scheme: dark)')];
  const store = new Map();
  const events = [];
  return {
    attrs, metas, store, events,
    document: { documentElement: html, querySelectorAll: (sel) => (sel === 'meta[name="theme-color"]' ? metas : []), querySelector: () => null },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    window: { dispatchEvent: (e) => events.push(e.type), matchMedia: (q) => ({ matches: dark && /dark/.test(q) }) },
  };
}

let page;
const use = (p) => { page = p; vi.stubGlobal('document', p.document); vi.stubGlobal('localStorage', p.localStorage); vi.stubGlobal('window', p.window); };
beforeEach(() => use(fakePage()));
afterEach(() => vi.unstubAllGlobals());

describe('applyTheme', () => {
  it('"כהה" sets data-theme, paints both bars dark, keeps the mirror and tells the page', () => {
    applyTheme('dark');
    expect(page.attrs['data-theme']).toBe('dark');
    expect(page.metas.map((m) => m.content)).toEqual(['#0f1115', '#0f1115']);
    expect(page.store.get(THEME_KEY)).toBe('dark');
    expect(page.events).toEqual([THEME_EVENT]);
  });

  it('"בהיר" sets data-theme and paints both bars white', () => {
    applyTheme('light');
    expect(page.attrs['data-theme']).toBe('light');
    expect(page.metas.map((m) => m.content)).toEqual(['#ffffff', '#ffffff']);
    expect(page.store.get(THEME_KEY)).toBe('light');
  });

  it('"כמו במכשיר" removes data-theme and the mirror, and gives each bar its own scheme', () => {
    applyTheme('dark');
    applyTheme('system');
    expect('data-theme' in page.attrs).toBe(false);
    expect(page.store.has(THEME_KEY)).toBe(false);
    expect(page.metas.map((m) => m.content)).toEqual(['#ffffff', '#0f1115']);
  });

  it('treats anything unknown as the phone\'s setting', () => {
    applyTheme('neon');
    expect('data-theme' in page.attrs).toBe(false);
  });

  it('still applies the choice when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    expect(() => applyTheme('dark')).not.toThrow();
    expect(page.attrs['data-theme']).toBe('dark');
  });

  it('the mirror key is the store key plus -theme', () => expect(THEME_KEY).toBe('madregot-theme'));
});

describe('themeName', () => {
  it('follows the phone without a choice, and the choice when there is one', () => {
    use(fakePage({ dark: true }));
    expect(themeName()).toBe('dark');
    applyTheme('light');
    expect(themeName()).toBe('light');
    use(fakePage({ dark: false }));
    expect(themeName()).toBe('light');
    applyTheme('dark');
    expect(themeName()).toBe('dark');
  });
});

describe('public/theme-boot.js (before the first paint)', () => {
  const src = readFileSync(new URL('../../public/theme-boot.js', import.meta.url), 'utf8');
  const boot = ({ key = '%VITE_STORE_KEY%', saved = {}, blocked = false } = {}) => {
    const attrs = {};
    const ctx = {
      document: { querySelector: () => ({ content: key }), documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } },
      localStorage: { getItem: (k) => { if (blocked) throw new Error('blocked'); return saved[k] ?? null; } },
    };
    runInNewContext(src, ctx);
    return attrs['data-theme'];
  };

  it('applies an explicit choice from the default key when Vite left the placeholder', () => {
    expect(boot({ saved: { 'madregot-theme': 'dark' } })).toBe('dark');
    expect(boot({ key: '', saved: { 'madregot-theme': 'light' } })).toBe('light');
  });
  it('reads a staging copy\'s own key', () => {
    expect(boot({ key: 'madregot-staging', saved: { 'madregot-staging-theme': 'dark', 'madregot-theme': 'light' } })).toBe('dark');
  });
  it('does nothing for the phone\'s setting, a strange value or blocked storage', () => {
    expect(boot()).toBeUndefined();
    expect(boot({ saved: { 'madregot-theme': 'neon' } })).toBeUndefined();
    expect(boot({ blocked: true })).toBeUndefined();
  });
  it('stays small', () => expect(Buffer.byteLength(src)).toBeLessThan(1024));
});
