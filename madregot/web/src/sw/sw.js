/* Madregot's service worker (DURABLE-10): after one visit online, the whole app opens and works with no connection.
   Hand-written, no Workbox. The build (web/scripts/vite-plugin-sw.mjs) emits this file as sw.js with two lines put in
   front of it: self.__PRECACHE, the files of this release (relative to this script: index.html, the manifest and the
   icons, every script and stylesheet, and the Rubik Hebrew and Latin and KaTeX woff2 fonts), and self.__RELEASE.
     install   the release's files go into the cache madregot-<release>, all of them or none (a half release would
               break the app offline). The new worker then waits: it never calls skipWaiting by itself, so a student
               is never moved to new code in the middle of anything. The page (lib/swClient.js) asks for it with the
               message SKIP_WAITING, only after 30 minutes away and never on a lesson route, then reloads.
     activate  the caches of other releases are deleted, and the open pages are taken over.
     fetch     only this site's own GET requests. /api/ is never handled (always the network: answers, progress and the
               vault must never come from a cache), and neither is any other address (the class server, the payment
               page). A page load (navigation) asks the network first and falls back to the cached index.html after
               3 seconds or on an error, so a reload with no connection opens the app. /assets/ files have a hash in
               their names and never change: from the cache first. Anything else: the network, else the cache. */
const RELEASE = typeof self.__RELEASE === 'string' && self.__RELEASE ? self.__RELEASE : 'dev';
const PRECACHE = Array.isArray(self.__PRECACHE) ? self.__PRECACHE : [];
const PREFIX = 'madregot-';
const CACHE = `${PREFIX}${RELEASE}`;
const NAV_TIMEOUT_MS = 3000;

/** An address relative to this script (the app may live under a sub-path, e.g. GitHub Pages). */
const here = (path) => new URL(path, self.location.href);
const INDEX = here('index.html').href;
const ASSETS = here('assets/').pathname;
const API_HERE = here('api/').pathname;
const isApi = (url) => url.pathname.startsWith('/api/') || url.pathname.startsWith(API_HERE);
// A module script asks with an Origin header, and a server may answer "Vary: Origin": the kept copy is the same file
// whoever asks, so a lookup ignores Vary (otherwise a lazy screen would miss the cache and fail offline).
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // past the browser's HTTP cache, so a release never keeps a stale copy of a file whose name did not change
    await cache.addAll(PRECACHE.map((p) => new Request(here(p).href, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// The page says when: after 30 minutes away, off a lesson route (lib/swClient.js).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/** A page load: the network first; after 3 s, or with no network, the cached app. */
async function navigation(request) {
  const network = fetch(request);
  const late = new Promise((done) => { setTimeout(() => done(null), NAV_TIMEOUT_MS); });
  const first = await Promise.race([network.catch(() => null), late]);
  if (first) return first;
  const cached = await caches.match(INDEX, MATCH);
  if (cached) return cached;
  return network; // nothing kept yet: wait for the network, or fail as the browser would
}

/** A file with a hash in its name: the cache first; a file not kept yet is kept once it arrives. */
async function cacheFirst(request) {
  const hit = await caches.match(request, MATCH);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

/** Anything else of this site: the network, else the cache. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const hit = await caches.match(request, MATCH);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApi(url)) return;
  if (request.mode === 'navigate') { event.respondWith(navigation(request)); return; }
  if (url.pathname.startsWith(ASSETS)) { event.respondWith(cacheFirst(request)); return; }
  event.respondWith(networkFirst(request));
});

// ---------------------------------------------------------------- push notifications (STUDENT-11)
// STUDENT-11 adds its 'push' and 'notificationclick' handlers here, in this one worker. This item handles no push.
// ---------------------------------------------------------------- end of push notifications
