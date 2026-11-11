// The install offer (STUDENT-10), on a stubbed window: the browser's event is kept and offered once, store apps and an
// installed app are told apart (a Play Store launch counts only while standalone), and the automatic offer's timing.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const counted = [];
vi.mock('./metrics.js', () => ({ count: (name) => { counted.push(name); return true; } }));

/** A window with just what install.js reads: events, the address, storage, display mode and the referrer. */
function fakeWindow({ search = '', hash = '#/', referrer = '', standalone = false, storage = {} } = {}) {
  const w = new EventTarget();
  const store = new Map(Object.entries(storage));
  w.location = { search, hash };
  w.document = { referrer };
  w.navigator = {};
  w.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  w.matchMedia = (q) => ({ matches: standalone && q === '(display-mode: standalone)' });
  w.store = store;
  return w;
}
/** The event Chrome fires, with a prompt() that records being called and the choice the person makes. */
function promptEvent(outcome = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompted = 0;
  e.prompt = () => { e.prompted += 1; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return e;
}

let mod;
beforeEach(async () => { vi.resetModules(); counted.length = 0; mod = await import('./install.js'); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('the browser\'s install prompt', () => {
  it('is kept when the browser fires it, and canOffer() becomes true', () => {
    const w = fakeWindow();
    mod.initInstall(w);
    expect(mod.canOffer()).toBe(false);
    const e = promptEvent();
    w.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true); // the browser's own banner waits for the app's moment
    expect(mod.canOffer()).toBe(true);
  });

  it('offer() shows it once and resolves the person\'s choice', async () => {
    const w = fakeWindow();
    mod.initInstall(w);
    const e = promptEvent('accepted');
    w.dispatchEvent(e);
    expect(await mod.offer()).toBe('accepted');
    expect(e.prompted).toBe(1);
    expect(counted).toEqual(['install_accept']);
    expect(mod.canOffer()).toBe(false);
    expect(await mod.offer()).toBe('unavailable'); // a prompt is used once
    w.dispatchEvent(promptEvent('dismissed'));
    expect(await mod.offer()).toBe('dismissed');
    expect(counted).toEqual(['install_accept']);
  });

  it('a prompt that fails is unavailable, and nothing is counted', async () => {
    const w = fakeWindow();
    mod.initInstall(w);
    const e = promptEvent();
    e.prompt = () => Promise.reject(new Error('not allowed'));
    w.dispatchEvent(e);
    expect(await mod.offer()).toBe('unavailable');
    expect(counted).toEqual([]);
  });

  it('after an install: the prompt is gone, it is counted, and the app says so', () => {
    const w = fakeWindow();
    const onInstalled = vi.fn();
    mod.initInstall(w, { onInstalled });
    w.dispatchEvent(promptEvent());
    w.dispatchEvent(new Event('appinstalled'));
    expect(mod.canOffer()).toBe(false);
    expect(counted).toEqual(['installed']);
    expect(onInstalled).toHaveBeenCalledTimes(1);
  });

  it('a shortcut tapped while the app is open moves it to the shortcut\'s screen', () => {
    const w = fakeWindow({ hash: '#/' });
    let consumer;
    w.launchQueue = { setConsumer: (f) => { consumer = f; } };
    mod.initInstall(w);
    consumer({ targetURL: 'https://madregot.example.test/#/quests' });
    expect(w.location.hash).toBe('#/quests');
    consumer({ targetURL: 'https://madregot.example.test/' }); // the app's own start: stay
    expect(w.location.hash).toBe('#/quests');
  });
});

describe('store apps and installed apps', () => {
  it('an android-app:// referrer is a store app', () => {
    expect(mod.isStoreApp(fakeWindow({ referrer: 'android-app://il.example.madregot/' }))).toBe(true);
    expect(mod.isStoreApp(fakeWindow({ referrer: 'https://www.google.com/' }))).toBe(false);
  });

  it('?src=play is remembered, and counts while standalone only', () => {
    const tab = fakeWindow({ search: '?src=play' });
    mod.initInstall(tab);
    expect(tab.store.get(mod.SRC_KEY)).toBe('play');
    expect(mod.SRC_KEY).toBe('madregot-src');
    expect(mod.isStoreApp(tab)).toBe(false); // the ordinary Chrome tab on the same phone shares the note
    const twa = fakeWindow({ standalone: true, storage: { [mod.SRC_KEY]: 'play' } });
    expect(mod.isStoreApp(twa)).toBe(true);
    // after the # as well (a link into a screen)
    const hashed = fakeWindow({ hash: '#/quests?src=play' });
    mod.initInstall(hashed);
    expect(hashed.store.get(mod.SRC_KEY)).toBe('play');
    // an installed web app with no note is installed, not a store app
    expect(mod.isStoreApp(fakeWindow({ standalone: true }))).toBe(false);
    expect(mod.isStandalone(fakeWindow({ standalone: true }))).toBe(true);
  });

  it('the iOS store build is a store app wherever it runs', () => {
    vi.stubEnv('VITE_STORE', 'ios');
    expect(mod.isStoreApp(fakeWindow())).toBe(true);
  });

  it('iPhone\'s Home Screen app is standalone through navigator.standalone', () => {
    const w = fakeWindow();
    w.navigator.standalone = true;
    expect(mod.isStandalone(w)).toBe(true);
  });
});

describe('when LessonDone offers it', () => {
  const learned = (n, end = 11) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-11-${String(end - i).padStart(2, '0')}`, { lessons: 1 }]));
  const DAY = '2026-11-11';
  let w;
  beforeEach(() => { w = fakeWindow(); mod.initInstall(w); w.dispatchEvent(promptEvent()); });

  it('not on the first learning day; from the second', () => {
    expect(mod.installDue({ days: learned(1), nudges: {} }, DAY, w)).toBe(false);
    expect(mod.installDue({ days: learned(2), nudges: {} }, DAY, w)).toBe(true);
    expect(mod.installDue({ days: { '2026-11-10': { q: 3, ok: 2, lessons: 0 }, '2026-11-11': { lessons: 1 } }, nudges: {} }, DAY, w)).toBe(false); // answers alone are no learning day
  });

  it('at most twice, and not within 30 days of the last offer', () => {
    const days = learned(5);
    expect(mod.installDue({ days, nudges: { installOffers: 1, installDismissedAt: '2026-10-13' } }, DAY, w)).toBe(false); // 29 days
    expect(mod.installDue({ days, nudges: { installOffers: 1, installDismissedAt: '2026-10-12' } }, DAY, w)).toBe(true); // 30 days
    expect(mod.installDue({ days, nudges: { installOffers: 2, installDismissedAt: '2026-01-01' } }, DAY, w)).toBe(false);
    expect(mod.installDue({ days, nudges: undefined }, DAY, w)).toBe(true); // an old save without the note
  });

  it('never without the browser\'s prompt, in a store app or in the installed app', async () => {
    const days = learned(3);
    expect(mod.installDue({ days, nudges: {} }, DAY, fakeWindow({ referrer: 'android-app://il.example.madregot/' }))).toBe(false);
    expect(mod.installDue({ days, nudges: {} }, DAY, fakeWindow({ standalone: true }))).toBe(false);
    await mod.offer();
    expect(mod.installDue({ days, nudges: {} }, DAY, w)).toBe(false);
  });
});
