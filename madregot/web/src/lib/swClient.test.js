// Registering the offline worker and the safe update rule (DURABLE-10): a new release is applied only when a worker
// is waiting, the app comes back after ≥ 30 minutes out of sight, and no lesson or similar screen is open. Registration
// only in a production build with service workers, under the base path; failures go to the error monitor. (The student
// lane's tests, then the family lane's.)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { report } from './monitor.js';
import {
  isBusyRoute, shouldUpdate, routeOf, registerSW, HIDDEN_LONG_MS, busyRoute, watchUpdates, registerNow, UPDATE_AFTER_HIDDEN_MS,
} from './swClient.js';

vi.mock('./monitor.js', () => ({ report: vi.fn() }));
beforeEach(() => report.mockClear());

describe('the update rule', () => {
  it('never reloads inside a lesson, a teaching stage, a repair, a check or placement', () => {
    for (const r of ['/lesson/signed/1', '/lesson/signed/3?kind=check', '/practice/abc', '/placement', '/learn/signed/1/A',
      '/learn/eq/2/C', '/repair/signed/1/sub-neg', '/rescue/check', '/rescue/exam', '/exams/check', '/exams/new', '/assistant', '/parents/link?c=K7M4QX',
      '/teacher/assistant', '/teacher/settings', '/teacher/exam/new', '/class/exam/0123456789abcdef/run', '/restore']) {
      expect(isBusyRoute(r), r).toBe(true);
      expect(shouldUpdate({ waiting: {}, hiddenMs: 2 * HIDDEN_LONG_MS, route: r }), r).toBe(false);
    }
  });
  it('reloads on a calm screen after 30 minutes out of sight, when a new worker waits', () => {
    for (const r of ['/', '/quests', '/topics', '/topic/signed', '/learn/signed/1', '/me', '/settings', '/rescue', '/exams', '/exams/abc', '/teacher', '/teacher/lessons', '/teacher/report', '/class/exam/0123456789abcdef']) {
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

  it('in a lesson, or back after a short while, it waits (and looks for a new release after each absence of a minute or more)', async () => {
    const p = fakePage();
    registerSW({ env: PROD, win: p.win, now: p.now });
    await settle();
    const waiting = { postMessage: vi.fn() };
    p.reg.waiting = waiting;
    p.hide(); p.pass(HIDDEN_LONG_MS - 1000); p.show();
    p.win.location.hash = '#/lesson/signed/1';
    p.hide(); p.pass(3 * HIDDEN_LONG_MS); p.show();
    expect(waiting.postMessage).not.toHaveBeenCalled();
    // both absences were a minute or more (the family lane's check: CHECK_AFTER_HIDDEN_MS)
    expect(p.reg.update).toHaveBeenCalledTimes(2);
    expect(p.win.location.reload).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- the family lane's tests (DURABLE-10): watchUpdates,
// failures reported to the error monitor, registerNow
/** Something with addEventListener and dispatch (a document, a registration, a worker, navigator.serviceWorker). */
function target(extra = {}) {
  const on = {};
  return {
    ...extra,
    addEventListener: (t, f, o) => { (on[t] ||= []).push({ f, once: !!o?.once }); },
    removeEventListener: (t, f) => { on[t] = (on[t] || []).filter((x) => x.f !== f); },
    fire(t) { for (const x of [...(on[t] || [])]) { if (x.once) this.removeEventListener(t, x.f); x.f(); } },
  };
}
function setup({ hash = '#/', waiting = true } = {}) {
  let t = 0;
  const doc = target({ visibilityState: 'visible' });
  const sw = target();
  const worker = target({ postMessage: vi.fn((m) => { if (m === 'SKIP_WAITING') sw.fire('controllerchange'); }) });
  const reg = target({ waiting: waiting ? worker : null, installing: null, update: vi.fn(async () => {}) });
  const win = { location: { hash, reload: vi.fn() } };
  const stop = watchUpdates(reg, { doc, win, sw, now: () => t, online: () => true });
  const away = (ms) => { doc.visibilityState = 'hidden'; doc.fire('visibilitychange'); t += ms; doc.visibilityState = 'visible'; doc.fire('visibilitychange'); };
  return { doc, sw, worker, reg, win, away, stop };
}

describe('the update rule, from location.hash (family lane)', () => {
  it('a lesson, a teaching stage, a repair, a check or the placement is busy; the map, Settings and the profile are not', () => {
    for (const h of ['#/lesson/signed/1', '#/lesson/signed/1?part=2', '#/practice/abc', '#/placement', '#/learn/signed/1/A', '#/repair/signed/1/m1',
      '#/rescue/check', '#/rescue/exam', '#/exams/check',
      // the student lane's rule also keeps the assistant (a question being typed) from reloading
      '#/assistant']) expect(busyRoute(h), h).toBe(true);
    for (const h of ['', '#/', '#/me', '#/settings', '#/learn/signed/1', '#/rescue', '#/quests', '#/topics']) expect(busyRoute(h), h).toBe(false);
  });
  it('needs a waiting worker and 30 minutes away', () => {
    expect(shouldUpdate({ waiting: {}, hiddenFor: UPDATE_AFTER_HIDDEN_MS, hash: '#/' })).toBe(true);
    expect(shouldUpdate({ waiting: {}, hiddenFor: UPDATE_AFTER_HIDDEN_MS - 1, hash: '#/' })).toBe(false);
    expect(shouldUpdate({ waiting: null, hiddenFor: 2 * UPDATE_AFTER_HIDDEN_MS, hash: '#/' })).toBe(false);
    expect(shouldUpdate({ waiting: {}, hiddenFor: 2 * UPDATE_AFTER_HIDDEN_MS, hash: '#/lesson/signed/1' })).toBe(false);
  });
});

describe('watchUpdates', () => {
  it('on the map after 30 minutes away: SKIP_WAITING, then one reload once the new worker controls the page', () => {
    const s = setup({ hash: '#/' });
    s.away(30 * 60_000);
    expect(s.worker.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
    expect(s.win.location.reload).toHaveBeenCalledTimes(1);
    s.away(31 * 60_000); // no second reload from the same page
    expect(s.worker.postMessage).toHaveBeenCalledTimes(1);
  });
  it('in a lesson: never a reload, however long away; a short time away: none either, and no update check', () => {
    const lesson = setup({ hash: '#/lesson/signed/1' });
    lesson.away(3 * 60 * 60_000);
    expect(lesson.worker.postMessage).not.toHaveBeenCalled();
    expect(lesson.win.location.reload).not.toHaveBeenCalled();
    expect(lesson.reg.update).toHaveBeenCalledTimes(1); // it still asks for a new release, for later
    const brief = setup({ hash: '#/' });
    brief.away(29 * 60_000);
    expect(brief.win.location.reload).not.toHaveBeenCalled();
    brief.away(30_000);
    expect(brief.reg.update).toHaveBeenCalledTimes(1); // only the 29 minutes asked; 30 seconds did not
  });
  it('no waiting worker: back after an hour asks the server for one, and reloads nothing', () => {
    const s = setup({ waiting: false });
    s.away(60 * 60_000);
    expect(s.reg.update).toHaveBeenCalledTimes(1);
    expect(s.win.location.reload).not.toHaveBeenCalled();
  });
  it('a new worker that never installs is reported (kind sw); one that installs is not', () => {
    const s = setup();
    const bad = target({ state: 'installing' });
    s.reg.installing = bad; s.reg.fire('updatefound');
    bad.state = 'redundant'; bad.fire('statechange');
    expect(report).toHaveBeenCalledWith('sw', expect.objectContaining({ name: 'install' }));
    report.mockClear();
    const good = target({ state: 'installing' });
    s.reg.installing = good; s.reg.fire('updatefound');
    good.state = 'installed'; good.fire('statechange');
    good.state = 'redundant'; good.fire('statechange'); // replaced later by a newer one: not a failure
    expect(report).not.toHaveBeenCalled();
  });
  it('an update check that fails while online is reported', async () => {
    const s = setup({ waiting: false });
    s.reg.update.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TypeError' }));
    s.away(2 * 60_000);
    await Promise.resolve(); await Promise.resolve();
    expect(report).toHaveBeenCalledWith('sw', expect.objectContaining({ name: 'update' }));
  });
});

describe('registerNow (what registerSW runs once the page has loaded)', () => {
  const nav = (register) => ({ serviceWorker: { register, addEventListener() {}, removeEventListener() {} } });
  const doc = target({ visibilityState: 'visible' });
  it('only in a production build, with service workers, unless VITE_SW is off', async () => {
    const register = vi.fn(async () => target({ waiting: null, installing: null, update: async () => {} }));
    expect(await registerNow({ env: { PROD: false, BASE_URL: '/' }, nav: nav(register), doc })).toBeNull();
    expect(await registerNow({ env: { PROD: true, VITE_SW: 'off', BASE_URL: '/' }, nav: nav(register), doc })).toBeNull();
    expect(await registerNow({ env: { PROD: true, BASE_URL: '/' }, nav: {}, doc })).toBeNull();
    expect(register).not.toHaveBeenCalled();
    expect(await registerNow({ env: { PROD: true, BASE_URL: '/madregot/' }, nav: nav(register), doc })).toBeTruthy();
    expect(register).toHaveBeenCalledWith('/madregot/sw.js', { scope: '/madregot/' });
  });
  it('a refused registration is reported; a blocked one (no registration) is quietly nothing', async () => {
    expect(await registerNow({ env: { PROD: true, BASE_URL: './' }, nav: nav(async () => { throw new DOMException('no', 'SecurityError'); }), doc })).toBeNull();
    expect(report).toHaveBeenCalledWith('sw', expect.objectContaining({ name: 'register', message: 'register failed (SecurityError)' }));
    report.mockClear();
    expect(await registerNow({ env: { PROD: true, BASE_URL: './' }, nav: nav(async () => undefined), doc })).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });
});
