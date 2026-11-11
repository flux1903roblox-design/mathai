// Error reports with no third party (DURABLE-9): what a report holds (scrubbed), the route as a pattern for every screen
// of App.jsx, one report per failure, at most 10 a page, nothing sent without a server, sendBeacon only within the
// keepalive budget, and the reload guard after a part of the app failed to load.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scrub, clean, LIMITS, CLIENT_KINDS } from '@shared/errors.js';
import {
  createMonitor, routePattern, ROUTES, agentClass, frameOf, componentOf, blockedOrigin, FLUSH_EVERY, RELOAD_KEY, RELOAD_GAP,
} from './monitor.js';

const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.81 Mobile Safari/537.36', onLine: true };

/** A page for one monitor: its hash, a session store, a fetch that records, a fake clock and timers. */
function page({ hash = '#/me', nav = ANDROID, server = 'https://api.example.test' } = {}) {
  const sent = []; const beacons = []; const ring = []; const reloads = [];
  const session = new Map();
  let t = Date.parse('2026-11-05T10:00:00Z');
  const win = new EventTarget(); win.location = { hash };
  const doc = new EventTarget();
  const navi = { ...nav, sendBeacon: vi.fn((url, body) => { beacons.push({ url, body: JSON.parse(body) }); return true; }) };
  const m = createMonitor({
    win, nav: navi, now: () => t, release: 'abc1234',
    session: { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => session.set(k, String(v)) },
    fetchFn: async (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return { ok: true }; },
    reload: () => reloads.push(t),
  });
  let left = 60_000;
  const budget = { claim: (n) => { if (n > left) return false; left -= n; return true; }, setLeft: (n) => { left = n; } };
  m.configure({ server: () => server, ring: { add: async (r) => { ring.push(r); } }, budget });
  return { m, win, doc, nav: navi, sent, beacons, ring, reloads, session, budget, tick: (ms) => { t += ms; vi.advanceTimersByTime(ms); } };
}
const settle = () => new Promise((r) => { setTimeout(r, 0); vi.advanceTimersByTime(1); });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('scrubbing', () => {
  it('digit runs, an email, a key and long hex are removed; short numbers stay', () => {
    expect(scrub('student 12345 at 2026-11-05 line 12')).toBe('student # at #-11-05 line 12');
    expect(scrub('no account for noa.cohen+7@example.test, try again')).toBe('no account for @, try again');
    expect(scrub('bad key sk-ant-api03-AbC_d-123 sent')).toBe('bad key … sent');
    expect(scrub(`token ${'a1b2c3d4'.repeat(4)} and ${'f'.repeat(31)}`)).toBe(`token … and ${'f'.repeat(31)}`);
  });
  it('a long message is clipped to 200 characters on one line', () => {
    const long = `x\n${'y '.repeat(300)}`;
    expect(clean(long, LIMITS.message)).toHaveLength(200);
    expect(clean(long, LIMITS.message)).not.toContain('\n');
  });
  it('a report holds the scrubbed message, never the raw one', async () => {
    const p = page();
    const r = p.m.report('error', { name: 'TypeError', message: 'student 4821 of noa@example.test has sk-ant-xyz' });
    expect(r.message).toBe('student # of @ has …');
    await settle();
    expect(JSON.stringify(p.ring)).not.toMatch(/4821|noa@|sk-ant/);
  });
});

describe('the route is a pattern', () => {
  it('values never leave: the screen\'s pattern does', () => {
    expect(routePattern('#/lesson/signed/3')).toBe('/lesson/:topic/:level');
    expect(routePattern('#/lesson/signed/3?part=2')).toBe('/lesson/:topic/:level');
    expect(routePattern('#/learn/coord/2/B')).toBe('/learn/:topic/:level/:stage');
    expect(routePattern('#/exams/check')).toBe('/exams/check');
    expect(routePattern('#/exams/e1f2')).toBe('/exams/:id');
    // the week a child sent a parent rides in the route: an error report carries the pattern only
    expect(routePattern('#/r/1.eyJ2IjoxLCJ3IjoiMjAyNi0xMS0wOCJ9')).toBe('/r/:data');
    expect(routePattern('#/report')).toBe('/report');
    expect(routePattern('#/teacher/class/K7Q2MD')).toBe('/teacher/*');
    expect(routePattern('#/')).toBe('/');
    expect(routePattern('')).toBe('/');
    expect(routePattern('#/no/such/screen/here')).toBe('/other');
  });
  it('every path in App.jsx\'s router table has its pattern (a new screen must be added to ROUTES)', () => {
    const src = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8');
    const paths = [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');
    expect(paths.length).toBeGreaterThan(30);
    for (const p of paths) {
      expect(ROUTES, p).toContain(p);
      const sample = `#${p.replace('/*', '/x').replace(/:\w+/g, 'v1')}`;
      expect(routePattern(sample), p).toBe(p);
    }
  });
  it('a report takes the route of the page it happened on', () => {
    const p = page({ hash: '#/topic/signed' });
    expect(p.m.report('error', { message: 'x' }).route).toBe('/topic/:id');
  });
});

describe('what else a report holds', () => {
  it('a coarse browser class', () => {
    expect(agentClass(ANDROID)).toBe('android-chrome-131');
    expect(agentClass({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' })).toBe('ios-safari-17');
    expect(agentClass({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', maxTouchPoints: 5 })).toBe('ios-safari-18');
    expect(agentClass({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' })).toBe('desktop-chrome');
    expect(agentClass({ userAgent: '' })).toBe('other');
  });
  it('the frame is the first line of our own built code, as file:line:col', () => {
    const stack = 'TypeError: x is undefined\n    at r (https://cdn.example.test/lib.js:1:20)\n    at Me (https://madregot.example.test/assets/Me-B2x9k.js:1:4521)\n    at index-Ab12.js';
    expect(frameOf(stack)).toBe('Me-B2x9k.js:1:4521');
    expect(frameOf('Error\n    at http://localhost:5173/src/screens/Me.jsx:12:9')).toBe('');
    expect(frameOf(undefined)).toBe('');
  });
  it('the nearest component, and a CSP report\'s origin only', () => {
    expect(componentOf('\n    at Me (https://x.test/assets/Me.js:1:2)\n    at Suspense')).toBe('Me');
    expect(componentOf('\n    in Settings\n    in Shell')).toBe('Settings');
    expect(blockedOrigin('https://tracker.example.test/pixel.gif?id=12345&email=a@b.test')).toBe('https://tracker.example.test');
    expect(blockedOrigin('inline')).toBe('inline');
    expect(blockedOrigin('data:image/png;base64,AAAA')).toBe('data');
  });
  it('a kind it does not know is counted as an error; the app never claims "server"', () => {
    const p = page();
    expect(p.m.report('server', { message: 'a' }).kind).toBe('error');
    expect(p.m.report('nonsense', { message: 'b' }).kind).toBe('error');
    expect(CLIENT_KINDS).not.toContain('server');
  });
});

describe('delivery', () => {
  it('one report per failure for the page\'s life, sent once 10 s after the first', async () => {
    const p = page();
    expect(p.m.report('render', { name: 'TypeError@Me', message: 'boom' })).toBeTruthy();
    expect(p.m.report('render', { name: 'TypeError@Me', message: 'boom' })).toBe(null);
    p.m.report('error', { name: 'Error', message: 'other' });
    p.tick(FLUSH_EVERY - 1);
    expect(p.sent).toHaveLength(0);
    p.tick(1);
    expect(p.sent).toHaveLength(1);
    const { url, init, body } = p.sent[0];
    expect(url).toBe('https://api.example.test/api/errors');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toMatch(/^text\/plain/); // no preflight
    expect(init.credentials).toBe('omit');
    expect(body).toEqual({
      v: 1, release: 'abc1234',
      items: [
        { kind: 'render', name: 'TypeError@Me', message: 'boom', frame: '', route: '/me', agent: 'android-chrome-131', n: 1 },
        { kind: 'error', name: 'Error', message: 'other', frame: '', route: '/me', agent: 'android-chrome-131', n: 1 },
      ],
    });
    await settle();
    expect(p.ring.map((r) => r.message)).toEqual(['boom', 'other']);
    expect(p.ring[0]).toMatchObject({ kind: 'render', route: '/me', release: 'abc1234', at: '2026-11-05T10:00:00.000Z' });
  });

  it('at most 10 a page load', () => {
    const p = page();
    for (let i = 0; i < 15; i += 1) p.m.report('error', { message: `failure ${String.fromCharCode(97 + i)}` });
    expect(p.m.made()).toBe(10);
    p.tick(FLUSH_EVERY);
    expect(p.sent[0].body.items).toHaveLength(10);
    expect(new TextEncoder().encode(JSON.stringify(p.sent[0].body)).length).toBeLessThan(8 * 1024);
  });

  it('ten of the longest reports, in Hebrew, still fit the server\'s 8 KB', () => {
    const p = page();
    for (let i = 0; i < 10; i += 1) p.m.report('error', { name: 'א'.repeat(60), message: `${i}${'ש'.repeat(400)}` });
    p.tick(FLUSH_EVERY);
    expect(new TextEncoder().encode(JSON.stringify(p.sent[0].body)).length).toBeLessThan(8 * 1024);
  });

  it('no server: nothing is sent, but the device keeps them', async () => {
    const p = page({ server: '' });
    p.m.report('error', { message: 'kept here' });
    p.tick(FLUSH_EVERY * 3);
    p.m.flush({ hidden: true });
    expect(p.sent).toHaveLength(0);
    expect(p.beacons).toHaveLength(0);
    await settle();
    expect(p.ring.map((r) => r.message)).toEqual(['kept here']);
  });

  it('reports made before the app configured the monitor reach the device then, and the server only if there is one', async () => {
    const ring = []; const sent = [];
    const m = createMonitor({ win: { location: { hash: '#/' } }, nav: ANDROID, fetchFn: async (u, i) => { sent.push(JSON.parse(i.body)); } });
    m.report('storage', { name: 'parse', message: 'the saved progress is not valid JSON' });
    m.configure({ server: () => '', ring: { add: async (r) => { ring.push(r); } } });
    await settle();
    expect(ring).toHaveLength(1);
    vi.advanceTimersByTime(FLUSH_EVERY);
    expect(sent).toHaveLength(0);
  });

  it('hidden: sendBeacon when the keepalive budget has room, a plain fetch when it has not', () => {
    const p = page();
    p.m.report('error', { message: 'first' });
    p.m.flush({ hidden: true });
    expect(p.beacons).toHaveLength(1);
    expect(p.beacons[0].url).toBe('https://api.example.test/api/errors');
    expect(p.sent).toHaveLength(0);
    p.m.report('error', { message: 'second' });
    p.budget.setLeft(10);
    p.m.flush({ hidden: true });
    expect(p.beacons).toHaveLength(1);
    expect(p.sent).toHaveLength(1);
    // the timer that was waiting is gone: nothing is sent twice
    p.tick(FLUSH_EVERY);
    expect(p.sent).toHaveLength(1);
  });

  it('the page\'s own errors: error, unhandledrejection and a blocked request (CSP)', () => {
    const p = page();
    const stop = p.m.listen(p.win, p.doc);
    const err = new TypeError('cannot read x');
    p.win.dispatchEvent(Object.assign(new Event('error'), { error: err, message: `Uncaught ${err}` }));
    p.win.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('a promise failed') }));
    p.doc.dispatchEvent(Object.assign(new Event('securitypolicyviolation'), { effectiveDirective: 'img-src', blockedURI: 'https://pixel.example.test/a.gif?u=12345' }));
    stop();
    p.win.dispatchEvent(Object.assign(new Event('error'), { error: new Error('after stop') }));
    expect(p.m.queued().map((r) => [r.kind, r.name, r.message])).toEqual([
      ['error', 'TypeError', 'cannot read x'],
      ['rejection', 'Error', 'a promise failed'],
      ['csp', 'img-src', 'https://pixel.example.test'],
    ]);
  });
});

describe('a part of the app that failed to load', () => {
  const CHUNK = new TypeError('Failed to fetch dynamically imported module: https://x.test/assets/Me-1.js');

  it('reloads once when online; again only after 60 s', () => {
    const p = page();
    expect(p.m.reportRender(CHUNK, '\n    at Lazy').kind).toBe('chunk');
    expect(p.reloads).toHaveLength(1);
    expect(p.session.get(RELOAD_KEY)).toBeTruthy();
    // the report went out before the reload
    expect(p.beacons).toHaveLength(1);
    expect(p.beacons[0].body.items[0].kind).toBe('chunk');
    // the same page failing again within the minute: the error screen shows instead
    p.tick(RELOAD_GAP - 1);
    expect(p.m.recoverChunk()).toBe(false);
    expect(p.reloads).toHaveLength(1);
    p.tick(1);
    expect(p.m.recoverChunk()).toBe(true);
    expect(p.reloads).toHaveLength(2);
  });

  it('offline: no reload (the error screen shows)', () => {
    const p = page({ nav: { ...ANDROID, onLine: false } });
    p.m.reportError('rejection', CHUNK);
    expect(p.reloads).toHaveLength(0);
    expect(p.m.queued()[0].kind).toBe('chunk');
  });

  it('a render error names the nearest component', () => {
    const p = page();
    expect(p.m.reportRender(new Error('boom'), '\n    at Me (https://x.test/assets/Me.js:1:2)').name).toBe('Error@Me');
    expect(p.reloads).toHaveLength(0);
  });
});
