// Madregot's service worker (DURABLE-10): after one visit online, the whole app opens and works with no internet.
// Hand-written on purpose, with no library: every rule is in this file. scripts/vite-plugin-sw.mjs builds it into
// dist/sw.js and puts two lines above this code: self.__PRECACHE (the files to keep, relative to this file) and
// self.__RELEASE (a name that changes whenever any of those files changes).
//
// install   keep every file of this release in the cache madregot-<release>. There is no skipWaiting here: a new
//           worker waits, and the page asks it to take over only at a calm moment (lib/swClient.js)
// activate  delete this copy's caches of other releases, then take control of the open pages
// fetch     a page:       the network first (3 s), else the saved index.html (the app routes by the hash)
//           /assets/…:    the saved file first (names carry a hash, so a file never changes)
//           /api/…:       never touched: always the network, never saved
//           anything else (the manifest, icons, theme-boot.js): the network, else the saved copy
/* eslint-env serviceworker */

const RELEASE = self.__RELEASE || 'dev';
const CACHE = `madregot-${RELEASE}`;
const PRECACHE = self.__PRECACHE || [];
const SCOPE = self.registration.scope; // the app's folder: https://<host>/ or https://<user>.github.io/<repo>/
const INDEX = new URL('index.html', self.location).href;
const PAGE_WAIT_MS = 3000;
// A server may answer with "Vary: Origin" (module scripts are requested with an Origin header, the precache without
// one), which would make a kept file look like a miss. The kept files are the same for every request, so it is ignored.
const SAVED = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // hashed files may come from the HTTP cache the page has just filled; the others are checked with the server
    await cache.addAll(PRECACHE.map((path) => new Request(new URL(path, self.location), { cache: path.startsWith('assets/') ? 'default' : 'no-cache' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // caches belong to the whole site, so only this copy's own are deleted (a staging copy under another folder of
    // the same site keeps its own): an old release of this copy is recognised by its saved index.html
    for (const name of await caches.keys()) {
      if (name === CACHE || !name.startsWith('madregot-')) continue;
      const cache = await caches.open(name);
      if (await cache.match(INDEX, SAVED)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// The page sends this only when no lesson is open (lib/swClient.js); the page then reloads into the new release.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  const path = url.pathname.slice(new URL(SCOPE).pathname.length); // relative to the app's folder
  if (url.pathname.startsWith('/api/') || path.startsWith('api/')) return; // the server's answers: network only
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (path.startsWith('assets/')) event.respondWith(savedFirst(request));
  else event.respondWith(networkFirst(request));
});

/** A page: the network if it answers within 3 s, else the saved app. */
async function page(request) {
  const net = fetch(request);
  try {
    const res = await Promise.race([net, new Promise((_, no) => { setTimeout(() => no(new Error('slow')), PAGE_WAIT_MS); })]);
    if (res.status < 500) return res;
  } catch { /* offline or too slow: the saved app below */ }
  const saved = await caches.match(INDEX, { ...SAVED, cacheName: CACHE });
  return saved || net; // nothing saved yet (the very first visit): whatever the network says
}

/** A hashed file: the saved copy, else the network (a file of a newer release, saved until the next release). */
async function savedFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, SAVED);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone()); // same-site only: other sites never reach this worker's rules
  return res;
}

/** Anything else: the network, else the saved copy. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const hit = await caches.match(request, { ...SAVED, cacheName: CACHE });
    if (hit) return hit;
    throw err;
  }
}

// push handlers (STUDENT-11)
// The opt-in daily reminder adds its 'push' and 'notificationclick' listeners here. Nothing above handles push.
