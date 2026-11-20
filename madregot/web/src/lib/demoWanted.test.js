// What the first load knows of the demo class (FOLLOWUP-23, lib/demoWanted.js): the demo's own code (lib/demo.js) is
// imported only when this tab is inside the demo or the address asks for it; on every other open it is never fetched.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
const at = (hash = '', search = '') => ({ hash, search, origin: 'https://madregot.example.test', pathname: '/' });
beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.stubGlobal('sessionStorage', fakeStorage());
  vi.stubGlobal('window', { location: at('#/') });
});
afterEach(() => { vi.unstubAllGlobals(); });
const load = async () => { vi.resetModules(); return import('./demoWanted.js'); };

describe('demoWanted: is the demo asked for before the first screen?', () => {
  it('not on an ordinary open', async () => {
    const { demoWanted, readDemo } = await load();
    expect(readDemo()).toBeNull();
    expect(demoWanted()).toBe(false);
  });

  it('a reload inside the demo: this tab\'s record says so', async () => {
    const { demoWanted, DEMO_KEY } = await load();
    sessionStorage.setItem(DEMO_KEY, JSON.stringify({ on: true, hadProfile: false }));
    expect(DEMO_KEY).toBe('madregot-demo');
    expect(demoWanted()).toBe(true);
  });

  it('a record that is off, or not JSON, asks for nothing', async () => {
    const { demoWanted, DEMO_KEY } = await load();
    sessionStorage.setItem(DEMO_KEY, JSON.stringify({ on: false }));
    expect(demoWanted()).toBe(false);
    sessionStorage.setItem(DEMO_KEY, '{oops');
    expect(demoWanted()).toBe(false);
  });

  it('the address asks for it: after the # or in the query, and &tab=1 opens it in this tab', async () => {
    const { askedForDemo, demoWanted } = await load();
    expect(askedForDemo(at('#/?start=demo'))).toEqual({ tab: false });
    expect(askedForDemo(at('#/?start=demo&tab=1'))).toEqual({ tab: true });
    expect(askedForDemo(at('#/', '?start=demo'))).toEqual({ tab: false });
    expect(askedForDemo(at('#/?start=teacher'))).toBeNull();
    window.location = at('#/?start=demo');
    expect(demoWanted()).toBe(true);
  });

  it('?qa-teacher=demo counts only where the test hooks are on', async () => {
    const { askedForDemo } = await load();
    expect(askedForDemo(at('#/?qa-teacher=demo'))).toBeNull(); // window.location is still #/: no hook, no flag
    window.location = at('#/?qa-teacher=demo');
    expect(askedForDemo(window.location)).toBeNull();
    localStorage.setItem('madregot-debug', '1');
    expect(askedForDemo(window.location)).toEqual({ tab: false });
  });

  it('the address of the demo, for a new tab', async () => {
    const { demoUrl } = await load();
    expect(demoUrl()).toBe('https://madregot.example.test/#/?start=demo');
    expect(demoUrl({ tab: true })).toBe('https://madregot.example.test/#/?start=demo&tab=1');
  });

  it('the ask sheet starts closed and never asked; lib/demo.js re-exports the same store', async () => {
    const wanted = await load();
    expect(wanted.useDemoAsk.getState()).toEqual({ open: false, asked: false });
    const demo = await import('./demo.js');
    expect(demo.useDemoAsk).toBe(wanted.useDemoAsk);
    expect(demo.readDemo).toBe(wanted.readDemo);
  });
});
