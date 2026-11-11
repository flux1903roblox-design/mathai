// The offline service worker (DURABLE-10): which built files it keeps (the Vite plugin's filter and the sw.js it
// emits), and its rules for each kind of request, run in a small stand-in for the browser's worker scope.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import serviceWorker, { precacheFilter } from '../../scripts/vite-plugin-sw.mjs';
import { fakeIndexedDB } from '../lib/testing/fakeIdb.js';

const CODE = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');

describe('precacheFilter: the files kept for offline use', () => {
  it('keeps the app shell, every script and style sheet, the Hebrew and Latin Rubik and the KaTeX woff2', () => {
    const keep = [
      'index.html', 'manifest.webmanifest', 'theme-boot.js', 'icons/192.png', 'icons/maskable-512.png',
      'assets/index-x.js', 'assets/Me-D5MhGM0a.js', 'assets/index-8s0fa8eF.css', 'assets/katex-BCx1q_2Y.css',
      'assets/rubik-hebrew-wght-normal-BIkpbuMU.woff2', 'assets/rubik-latin-wght-normal-CnQIisVs.woff2',
      'assets/KaTeX_Main-Regular-B22Nviop.woff2', 'assets/KaTeX_Math-Italic-t53AETM-.woff2',
    ];
    for (const f of keep) expect(precacheFilter(f), f).toBe(true);
  });
  it('drops source maps, .ttf and .woff copies, the other Rubik subsets and other public files', () => {
    const drop = [
      'assets/index-x.js.map', 'assets/index-x.css.map', 'assets/KaTeX_Main-Regular-ypZvNtVU.ttf', 'assets/KaTeX_Main-Regular-Dr94JaBh.woff',
      'assets/rubik-arabic-wght-normal-CGnJ-sf6.woff2', 'assets/rubik-cyrillic-wght-normal-DveCct9I.woff2',
      'assets/rubik-cyrillic-ext-wght-normal-BjodpZir.woff2', 'assets/rubik-latin-ext-wght-normal-OacczzuJ.woff2',
      '_headers', 'sw.js', 'screens/narrow-1.png', 'stats.html', 'assets/photo-abc.png',
    ];
    for (const f of drop) expect(precacheFilter(f), f).toBe(false);
  });
});

describe('the Vite plugin', () => {
  function run({ release } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'sw-plugin-'));
    mkdirSync(join(root, 'src/sw'), { recursive: true });
    writeFileSync(join(root, 'src/sw/sw.js'), '// worker code\n');
    mkdirSync(join(root, 'public/icons'), { recursive: true });
    writeFileSync(join(root, 'public/manifest.webmanifest'), '{}');
    writeFileSync(join(root, 'public/icons/192.png'), 'png');
    writeFileSync(join(root, 'public/_headers'), '/*');
    const plugin = serviceWorker();
    plugin.configResolved({ root, publicDir: join(root, 'public'), logger: { info: () => {} } });
    const bundle = {
      'index.html': { type: 'asset', source: '<html>' },
      'assets/index-a.js': { type: 'chunk', code: 'app()' },
      'assets/index-a.js.map': { type: 'asset', source: '{}' },
      'assets/rubik-arabic-wght-normal-x.woff2': { type: 'asset', source: new Uint8Array([1]) },
    };
    const emitted = [];
    const before = process.env.VITE_RELEASE;
    if (release) process.env.VITE_RELEASE = release; else delete process.env.VITE_RELEASE;
    try { plugin.generateBundle.call({ emitFile: (f) => emitted.push(f) }, {}, bundle); } finally {
      if (before === undefined) delete process.env.VITE_RELEASE; else process.env.VITE_RELEASE = before;
    }
    return emitted;
  }

  it('emits sw.js with the sorted list of kept files and a release name above the worker code', () => {
    const [sw] = run();
    expect(sw.fileName).toBe('sw.js');
    const list = JSON.parse(/self\.__PRECACHE = (\[.*\]);/.exec(sw.source)[1]);
    expect(list).toEqual(['assets/index-a.js', 'icons/192.png', 'index.html', 'manifest.webmanifest']);
    expect(sw.source).toMatch(/self\.__RELEASE = "[0-9a-f]{12}";/);
    expect(sw.source.endsWith('// worker code\n')).toBe(true);
  });
  it('the release name follows the content, and VITE_RELEASE overrides it', () => {
    expect(run()[0].source).toBe(run()[0].source);
    expect(run({ release: 'r-2026-11-10' })[0].source).toContain('self.__RELEASE = "r-2026-11-10";');
  });
});

// ---------------------------------------------------------------- the worker's rules, in a stand-in worker scope
const SCOPE = 'https://app.example.test/madregot/';
const ok = (body, init) => new Response(body, { status: 200, ...init });

function worker({ precache = ['index.html', 'assets/index-a.js', 'manifest.webmanifest'], release = 'r1', net, stores = new Map(), self: more = {}, scope: globals = {} } = {}) {
  const on = {};
  const cacheOf = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    const key = (r) => (typeof r === 'string' ? r : r.url);
    return {
      addAll: async (reqs) => { for (const r of reqs) m.set(r.url, await net(r)); },
      // like a browser's cache: an answer that says "Vary" is not found for another kind of request, unless the
      // match ignores Vary (a module script carries an Origin header, the precache request does not)
      match: async (r, opts) => { const res = m.get(key(r)); return res && (opts?.ignoreVary || !res.headers.get('vary')) ? res.clone() : undefined; },
      put: async (r, res) => { m.set(key(r), res); },
      keys: async () => [...m.keys()].map((url) => ({ url })),
    };
  };
  const caches = {
    open: async (name) => cacheOf(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (r, { cacheName, ...opts }) => (stores.has(cacheName) ? cacheOf(cacheName).match(r, opts) : undefined),
  };
  const self = {
    __PRECACHE: precache, __RELEASE: release, registration: { scope: SCOPE }, location: new URL('sw.js', SCOPE),
    addEventListener: (type, fn) => { on[type] = fn; }, clients: { claim: vi.fn(async () => {}) }, skipWaiting: vi.fn(),
    ...more,
  };
  runInNewContext(CODE, { self, caches, fetch: (r, init) => net(r, init), Request, Response, URL, setTimeout, Promise, atob, JSON, Uint8Array, String, ...globals });
  const lifecycle = async (type) => { let p; on[type]({ waitUntil: (x) => { p = x; } }); await p; };
  /** The worker's answer to a request, or 'browser' when it leaves the request to the browser. */
  const request = async (url, mode = 'cors', method = 'GET') => {
    let answer = 'browser';
    on.fetch({ request: { url: new URL(url, SCOPE).href, mode, method }, respondWith: (p) => { answer = p; } });
    return answer === 'browser' ? answer : (await answer);
  };
  return { on, self, stores, lifecycle, request };
}

describe('sw.js', () => {
  const online = vi.fn(async (r) => ok(`net:${new URL(r.url).pathname}`));

  it('install keeps every listed file in madregot-<release> and does not take over on its own', async () => {
    const w = worker({ net: online });
    await w.lifecycle('install');
    expect([...w.stores.keys()]).toEqual(['madregot-r1']);
    expect([...w.stores.get('madregot-r1').keys()]).toEqual([`${SCOPE}index.html`, `${SCOPE}assets/index-a.js`, `${SCOPE}manifest.webmanifest`]);
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    w.on.message({ data: 'SKIP_WAITING' });
    expect(w.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('activate deletes this copy\'s older releases only, then takes control', async () => {
    const stores = new Map([
      ['madregot-r0', new Map([[`${SCOPE}index.html`, ok('old')]])],
      ['madregot-other', new Map([['https://app.example.test/staging/index.html', ok('staging')]])],
      ['someone-else', new Map([[`${SCOPE}index.html`, ok('x')]])],
    ]);
    const w = worker({ net: online, stores });
    await w.lifecycle('install');
    await w.lifecycle('activate');
    expect([...stores.keys()].sort()).toEqual(['madregot-other', 'madregot-r1', 'someone-else']);
    expect(w.self.clients.claim).toHaveBeenCalled();
  });

  it('a page comes from the network when it answers, else the saved index.html', async () => {
    let up = true;
    const net = vi.fn(async (r) => { if (!up) throw new TypeError('offline'); return ok(`net:${new URL(r.url).pathname}`); });
    const w = worker({ net });
    await w.lifecycle('install');
    expect(await (await w.request('./?src=play', 'navigate')).text()).toBe('net:/madregot/');
    up = false;
    expect(await (await w.request('./', 'navigate')).text()).toBe('net:/madregot/index.html');
    expect(await (await w.request('./parents/link', 'navigate')).text()).toBe('net:/madregot/index.html');
  });

  it('a page waits at most 3 s for a slow network, then opens the saved app', async () => {
    vi.useFakeTimers();
    try {
      let slow = false;
      const net = (r) => (slow ? new Promise(() => {}) : Promise.resolve(ok(`net:${new URL(r.url).pathname}`)));
      const w = worker({ net });
      await w.lifecycle('install');
      slow = true;
      const pending = w.request('./', 'navigate');
      await vi.advanceTimersByTimeAsync(3000);
      expect(await (await pending).text()).toBe('net:/madregot/index.html');
    } finally { vi.useRealTimers(); }
  });

  it('a server error on a page falls back to the saved app', async () => {
    let broken = false;
    const net = async (r) => (broken ? new Response('down', { status: 503 }) : ok(`net:${new URL(r.url).pathname}`));
    const w = worker({ net });
    await w.lifecycle('install');
    broken = true;
    expect(await (await w.request('./', 'navigate')).text()).toBe('net:/madregot/index.html');
  });

  it('/assets/ files come from the cache first, even when the server said "Vary: Origin"; a file not kept yet is fetched once and kept', async () => {
    const net = vi.fn(async (r) => ok(`net:${new URL(r.url).pathname}`, { headers: { Vary: 'Origin' } }));
    const w = worker({ net });
    await w.lifecycle('install');
    net.mockClear();
    expect(await (await w.request('assets/index-a.js')).text()).toBe('net:/madregot/assets/index-a.js');
    expect(net).not.toHaveBeenCalled();
    await w.request('assets/Me-new.js');
    await w.request('assets/Me-new.js');
    expect(net).toHaveBeenCalledTimes(1);
  });

  it('/api/ is never handled, nor other sites, other folders or anything but GET', async () => {
    const w = worker({ net: online });
    await w.lifecycle('install');
    expect(await w.request('https://app.example.test/api/ai/status')).toBe('browser');
    expect(await w.request('api/sync')).toBe('browser');
    expect(await w.request('https://api.example.test/x')).toBe('browser');
    expect(await w.request('https://app.example.test/other/index.html')).toBe('browser');
    expect(await w.request('assets/index-a.js', 'cors', 'POST')).toBe('browser');
  });

  it('anything else: the network first, the saved copy when offline', async () => {
    let up = true;
    const net = async (r) => { if (!up) throw new TypeError('offline'); return ok(`fresh:${new URL(r.url).pathname}`); };
    const w = worker({ net });
    await w.lifecycle('install');
    expect(await (await w.request('manifest.webmanifest')).text()).toBe('fresh:/madregot/manifest.webmanifest');
    up = false;
    expect(await (await w.request('manifest.webmanifest')).text()).toBe('fresh:/madregot/manifest.webmanifest');
    await expect(w.request('icons/none.png')).rejects.toThrow('offline');
  });

});

// ---------------------------------------------------------------- the daily reminder (STUDENT-11)
describe('sw.js: the daily reminder', () => {
  const TODAY = `${SCOPE}#/?go=today&src=push`;
  /** A worker with notifications, windows and a push manager to watch, and IndexedDB madregot-push. */
  function pushWorker({ windows = [], record, net = vi.fn(async () => new Response(null, { status: 204 })) } = {}) {
    const idb = fakeIndexedDB();
    if (record) idb.dbs.set('madregot-push', new Map([['sub', new Map([['current', record]])]]));
    const registration = {
      scope: SCOPE,
      showNotification: vi.fn(async () => {}),
      pushManager: { subscribe: vi.fn(async () => ({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', keys: { p256dh: 'BNEW', auth: 'ANEW' } }) })) },
    };
    const clients = { claim: vi.fn(), matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => {}) };
    const w = worker({ net, self: { registration, clients }, scope: { indexedDB: idb } });
    /** Fire an event that waits (push, notificationclick, pushsubscriptionchange) and wait for it. */
    const fire = async (type, data) => { let p; w.on[type]({ ...data, waitUntil: (x) => { p = x; } }); await p; };
    return { ...w, idb, registration, clients, fire, net };
  }
  const pushData = (obj) => ({ data: { json: () => (typeof obj === 'string' ? JSON.parse(obj) : obj) } });

  it('a declarative message is shown right to left, in Hebrew, titled מדרגות, with the address to open', async () => {
    const w = pushWorker();
    await w.fire('push', pushData({ web_push: 8030, notification: { title: 'מדרגות', body: 'שיעור קצר אחד היום, וזה מספיק.', lang: 'he', dir: 'rtl', navigate: TODAY, tag: 'daily', silent: false } }));
    expect(w.registration.showNotification).toHaveBeenCalledWith('מדרגות', {
      body: 'שיעור קצר אחד היום, וזה מספיק.', lang: 'he', dir: 'rtl', icon: 'icons/192.png', badge: 'icons/badge-96.png', tag: 'daily', data: { url: TODAY },
    });
  });

  it('any other shape still shows a calm notification; an address on another site opens today\'s lesson here', async () => {
    const w = pushWorker();
    await w.fire('push', pushData({ title: 'מדרגות', body: 'טקסט', navigate: 'https://evil.example.test/' }));
    await w.fire('push', { data: { json: () => { throw new SyntaxError('not json'); } } });
    await w.fire('push', {});
    const calls = w.registration.showNotification.mock.calls;
    expect(calls.map(([title, o]) => [title, o.body, o.dir, o.data.url])).toEqual([
      ['מדרגות', 'טקסט', 'rtl', TODAY], ['מדרגות', '', 'rtl', TODAY], ['מדרגות', '', 'rtl', TODAY]]);
  });

  it('a tap brings the open app forward on today\'s lesson, and counts push_open with the page\'s server address', async () => {
    const win = { url: `${SCOPE}#/me`, focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) };
    const w = pushWorker({ windows: [{ url: 'https://other.example.test/', focus: vi.fn() }, win], record: { id: 'a'.repeat(16), secret: 'b'.repeat(32), slot: 17, key: 'BKEY', api: 'https://api.example.test' } });
    const close = vi.fn();
    await w.fire('notificationclick', { notification: { close, data: { url: TODAY } } });
    expect(close).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith(TODAY);
    expect(w.clients.openWindow).not.toHaveBeenCalled();
    const [url, init] = w.net.mock.calls.at(-1);
    expect(url).toBe('https://api.example.test/api/metrics');
    expect(init).toMatchObject({ method: 'POST', body: 'push_open' });
  });

  it('with no window open, a tap opens the app there', async () => {
    const w = pushWorker();
    await w.fire('notificationclick', { notification: { close: vi.fn(), data: { url: TODAY } } });
    expect(w.clients.openWindow).toHaveBeenCalledWith(TODAY);
    expect(w.net.mock.calls.at(-1)[0]).toBe('https://app.example.test/api/metrics');
  });

  it('a replaced subscription is sent again with replaces, and the new id and secret are kept for the page', async () => {
    const record = { id: 'a'.repeat(16), secret: 'b'.repeat(32), slot: 18, key: 'BPkey_-A', api: 'https://api.example.test' };
    const net = vi.fn(async () => new Response(JSON.stringify({ id: 'c'.repeat(16), secret: 'd'.repeat(32) }), { status: 200 }));
    const w = pushWorker({ record, net });
    await w.fire('pushsubscriptionchange', {});
    const opts = w.registration.pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect([...opts.applicationServerKey]).toEqual([...Buffer.from('BPkey_-A', 'base64url')]);
    const [url, init] = net.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/push/subscribe');
    expect(JSON.parse(init.body)).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', keys: { p256dh: 'BNEW', auth: 'ANEW' }, slot: '18', replaces: { id: record.id, secret: record.secret } });
    expect(w.idb.peek('madregot-push', 'sub', 'current')).toEqual({ ...record, id: 'c'.repeat(16), secret: 'd'.repeat(32) });
  });

  it('with no reminder kept on the device, a replaced subscription is left alone', async () => {
    const w = pushWorker();
    await w.fire('pushsubscriptionchange', {});
    expect(w.registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(w.net).not.toHaveBeenCalled();
  });
});
