// Registering the offline worker and the safe update rule (DURABLE-10): a new release is applied only when a worker
// is waiting, the app comes back after ≥ 30 minutes out of sight, and no lesson or similar screen is open.
import { describe, it, expect, vi } from 'vitest';
import { isBusyRoute, shouldUpdate, routeOf, registerSW, HIDDEN_LONG_MS } from './swClient.js';

describe('the update rule', () => {
  it('never reloads inside a lesson, a teaching stage, a repair, a check or placement', () => {
    for (const r of ['/lesson/signed/1', '/lesson/signed/3?kind=check', '/practice/abc', '/placement', '/learn/signed/1/A',
      '/learn/eq/2/C', '/repair/signed/1/sub-neg', '/rescue/check', '/rescue/exam', '/exams/check', '/exams/new', '/assistant', '/parents/link?c=K7M4QX',
      '/teacher/assistant', '/teacher/settings']) {
      expect(isBusyRoute(r), r).toBe(true);
      expect(shouldUpdate({ waiting: {}, hiddenMs: 2 * HIDDEN_LONG_MS, route: r }), r).toBe(false);
    }
  });
  it('reloads on a calm screen after 30 minutes out of sight, when a new worker waits', () => {
    for (const r of ['/', '/quests', '/topics', '/topic/signed', '/learn/signed/1', '/me', '/settings', '/rescue', '/exams', '/exams/abc', '/teacher', '/teacher/lessons']) {
      expect(isBusyRoute(r), r).toBe(false);
      expect(shouldUpdate({ waiting: {}, hiddenMs: HIDDEN_LONG_MS, route: r }), r).toBe(true);
    }
  });
  it('not before 30 minutes, and not without a waiting worker', () => {
    expect(shouldUpdate({ waiting: {}, hiddenMs: HIDDEN_LONG_MS - 1, route: '/' })).toBe(false);
    expect(shouldUpdate({ waiting: null, hiddenMs: 10 * HIDDEN_LONG_MS, route: '/' })).toBe(false);
  });
  it('reads the route from the hash', () => {
    expect(routeOf('#/lesson/signed/1')).toBe('/lesson/signed/1');
    expect(routeOf('')).toBe('/');
    expect(routeOf('#')).toBe('/');
  });
});

/** A page with a service worker container, a clock and visibility the test controls. */
function fakePage({ ready = 'complete' } = {}) {
  const docOn = {}; const winOn = {}; const swOn = {};
  let clock = 0;
  const reg = { waiting: null, update: vi.fn(async () => {}) };
  const win = {
    location: { hash: '#/', reload: vi.fn() },
    document: { readyState: ready, visibilityState: 'visible', addEventListener: (t, f) => { docOn[t] = f; } },
    addEventListener: (t, f) => { winOn[t] = f; },
    navigator: { serviceWorker: { register: vi.fn(async () => reg), addEventListener: (t, f) => { swOn[t] = f; } } },
  };
  const hide = () => { win.document.visibilityState = 'hidden'; docOn.visibilitychange(); };
  const show = () => { win.document.visibilityState = 'visible'; docOn.visibilitychange(); };
  return { win, reg, winOn, swOn, hide, show, now: () => clock, pass: (ms) => { clock += ms; } };
}
const PROD = { PROD: true, BASE_URL: '/madregot/' };
const settle = () => new Promise((r) => { setTimeout(r, 0); });

describe('registerSW', () => {
  it('registers only in a production build with service workers, unless VITE_SW=off', () => {
    const p = fakePage();
    expect(registerSW({ env: { PROD: false, BASE_URL: '/' }, win: p.win })).toBe(false);
    expect(registerSW({ env: { ...PROD, VITE_SW: 'off' }, win: p.win })).toBe(false);
    const noSW = fakePage(); delete noSW.win.navigator.serviceWorker;
    expect(registerSW({ env: PROD, win: noSW.win })).toBe(false);
    expect(p.win.navigator.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('registers sw.js in the app folder, with that folder as its scope, once the page has loaded', () => {
    const p = fakePage({ ready: 'loading' });
    expect(registerSW({ env: PROD, win: p.win })).toBe(true);
    expect(p.win.navigator.serviceWorker.register).not.toHaveBeenCalled();
    p.winOn.load();
    expect(p.win.navigator.serviceWorker.register).toHaveBeenCalledWith('/madregot/sw.js', { scope: '/madregot/' });
  });

  it('after 30 minutes away on the map, asks the waiting worker to take over and reloads when it has', async () => {
    const p = fakePage();
    registerSW({ env: PROD, win: p.win, now: p.now });
    await settle();
    // the first install takes control of the page too: that never reloads
    p.swOn.controllerchange?.();
    expect(p.win.location.reload).not.toHaveBeenCalled();
    const waiting = { postMessage: vi.fn() };
    p.reg.waiting = waiting;
    p.hide(); p.pass(HIDDEN_LONG_MS); p.show();
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
    expect(p.win.location.reload).not.toHaveBeenCalled();
    p.swOn.controllerchange();
    p.swOn.controllerchange();
    expect(p.win.location.reload).toHaveBeenCalledTimes(1);
  });

  it('in a lesson, or back after a short while, it waits (and looks for a new release after a long absence)', async () => {
    const p = fakePage();
    registerSW({ env: PROD, win: p.win, now: p.now });
    await settle();
    const waiting = { postMessage: vi.fn() };
    p.reg.waiting = waiting;
    p.hide(); p.pass(HIDDEN_LONG_MS - 1000); p.show();
    p.win.location.hash = '#/lesson/signed/1';
    p.hide(); p.pass(3 * HIDDEN_LONG_MS); p.show();
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(p.reg.update).toHaveBeenCalledTimes(1);
    expect(p.win.location.reload).not.toHaveBeenCalled();
  });
});
