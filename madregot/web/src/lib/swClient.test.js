// When an update may reload the app (DURABLE-10, swClient.js): only with a new worker waiting, after 30 minutes or more
// out of view, and never on a lesson, teaching, repair, check or placement route. Registration only in a production
// build with service workers, under the base path; failures go to the error monitor.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { report } from './monitor.js';
import { busyRoute, shouldUpdate, watchUpdates, registerSW, UPDATE_AFTER_HIDDEN_MS } from './swClient.js';

vi.mock('./monitor.js', () => ({ report: vi.fn() }));
beforeEach(() => report.mockClear());

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
  const worker = target({ postMessage: vi.fn((m) => { if (m.type === 'SKIP_WAITING') sw.fire('controllerchange'); }) });
  const reg = target({ waiting: waiting ? worker : null, installing: null, update: vi.fn(async () => {}) });
  const win = { location: { hash, reload: vi.fn() } };
  const stop = watchUpdates(reg, { doc, win, sw, now: () => t, online: () => true });
  const away = (ms) => { doc.visibilityState = 'hidden'; doc.fire('visibilitychange'); t += ms; doc.visibilityState = 'visible'; doc.fire('visibilitychange'); };
  return { doc, sw, worker, reg, win, away, stop };
}

describe('the update rule', () => {
  it('a lesson, a teaching stage, a repair, a check or the placement is busy; the map, Settings and the profile are not', () => {
    for (const h of ['#/lesson/signed/1', '#/lesson/signed/1?part=2', '#/practice/abc', '#/placement', '#/learn/signed/1/A', '#/repair/signed/1/m1',
      '#/rescue/check', '#/rescue/exam', '#/exams/check']) expect(busyRoute(h), h).toBe(true);
    for (const h of ['', '#/', '#/me', '#/settings', '#/learn/signed/1', '#/rescue', '#/quests', '#/topics', '#/assistant']) expect(busyRoute(h), h).toBe(false);
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
    expect(s.worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
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

describe('registerSW', () => {
  const nav = (register) => ({ serviceWorker: { register, addEventListener() {}, removeEventListener() {} } });
  const doc = target({ visibilityState: 'visible' });
  it('only in a production build, with service workers, unless VITE_SW is off', async () => {
    const register = vi.fn(async () => target({ waiting: null, installing: null, update: async () => {} }));
    expect(await registerSW({ env: { PROD: false, BASE_URL: '/' }, nav: nav(register), doc })).toBeNull();
    expect(await registerSW({ env: { PROD: true, VITE_SW: 'off', BASE_URL: '/' }, nav: nav(register), doc })).toBeNull();
    expect(await registerSW({ env: { PROD: true, BASE_URL: '/' }, nav: {}, doc })).toBeNull();
    expect(register).not.toHaveBeenCalled();
    expect(await registerSW({ env: { PROD: true, BASE_URL: '/madregot/' }, nav: nav(register), doc })).toBeTruthy();
    expect(register).toHaveBeenCalledWith('/madregot/sw.js', { scope: '/madregot/' });
  });
  it('a refused registration is reported; a blocked one (no registration) is quietly nothing', async () => {
    expect(await registerSW({ env: { PROD: true, BASE_URL: './' }, nav: nav(async () => { throw new DOMException('no', 'SecurityError'); }), doc })).toBeNull();
    expect(report).toHaveBeenCalledWith('sw', expect.objectContaining({ name: 'register', message: 'register failed (SecurityError)' }));
    report.mockClear();
    expect(await registerSW({ env: { PROD: true, BASE_URL: './' }, nav: nav(async () => undefined), doc })).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });
});
