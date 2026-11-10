// The service worker's precache list (DURABLE-10, vite-plugin-sw.mjs): what a release keeps for the app to work offline,
// and the sw.js the build emits (the list and the release in front of the hand-written worker).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import swPlugin, { precacheFilter, precacheList, workerSource, SW_SOURCE } from './vite-plugin-sw.mjs';

describe('the precache filter', () => {
  it('keeps the page, the manifest, the icons, every script and stylesheet, and the fonts the app shows', () => {
    for (const f of ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-maskable-512.png', 'assets/index-x.js',
      'assets/Settings-B_itlKvE.js', 'assets/index-DMjAjd1t.css', 'assets/katex-BCx1q_2Y.css', 'assets/rubik-hebrew-wght-normal-BIkpbuMU.woff2',
      'assets/rubik-latin-wght-normal-CnQIisVs.woff2', 'assets/KaTeX_Main-Regular-B22Nviop.woff2', 'assets/KaTeX_AMS-Regular-BQhdFMY1.woff2']) {
      expect(precacheFilter(f), f).toBe(true);
    }
  });
  it('drops source maps, .ttf and .woff, the subsets the app never shows, and what is not the app', () => {
    for (const f of ['assets/index-x.js.map', 'assets/KaTeX_Main-Regular-x.ttf', 'assets/KaTeX_Main-Regular-x.woff',
      'assets/rubik-arabic-wght-normal-CGnJ-sf6.woff2', 'assets/rubik-cyrillic-wght-normal-DveCct9I.woff2',
      'assets/rubik-cyrillic-ext-wght-normal-BjodpZir.woff2', 'assets/rubik-latin-ext-wght-normal-OacczzuJ.woff2', '_headers', 'sw.js',
      'api/health', 'assets/sub/x.js', 'notes.txt']) {
      expect(precacheFilter(f), f).toBe(false);
    }
  });
  it('the list: each file once, sorted, with Windows separators made plain', () => {
    expect(precacheList(['assets\\b.js', 'index.html', 'assets/b.js', './manifest.webmanifest', 'assets/a.css', 'x.map']))
      .toEqual(['assets/a.css', 'assets/b.js', 'index.html', 'manifest.webmanifest']);
  });
});

describe('sw.js', () => {
  it('starts with the list and the release, then the hand-written worker', () => {
    const src = workerSource({ list: ['index.html', 'assets/a.js'], release: 'abc1234' });
    expect(src.split('\n').slice(0, 2)).toEqual(['self.__PRECACHE = ["index.html","assets/a.js"];', 'self.__RELEASE = "abc1234";']);
    expect(src.endsWith(readFileSync(SW_SOURCE, 'utf8'))).toBe(true);
  });
  it('the worker never handles the API, never skips waiting by itself, and leaves the push section to STUDENT-11', () => {
    const sw = readFileSync(SW_SOURCE, 'utf8');
    expect(sw).toMatch(/isApi\(url\)\) return;/);
    // skipWaiting only in answer to the page's message
    expect(sw.match(/skipWaiting\(\)/g)).toHaveLength(1);
    expect(sw).toMatch(/SKIP_WAITING'\) self\.skipWaiting\(\)/);
    expect(sw).toContain('push notifications (STUDENT-11)');
    expect(sw).not.toMatch(/addEventListener\('push'/);
  });
  it('the plugin emits sw.js from the bundle and the public folder, and refuses a bundle with no index.html', () => {
    const plugin = swPlugin({ release: 'r1' });
    plugin.configResolved({ publicDir: new URL('../public', import.meta.url).pathname });
    const emitted = [];
    const ctx = { emitFile: (f) => emitted.push(f), error: (m) => { throw new Error(m); } };
    plugin.generateBundle.call(ctx, {}, { 'index.html': {}, 'assets/index-a.js': {}, 'assets/index-a.js.map': {}, 'assets/rubik-arabic-wght-normal-x.woff2': {} });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe('sw.js');
    const list = JSON.parse(/^self\.__PRECACHE = (.*);\n/.exec(emitted[0].source)[1]);
    expect(list).toContain('index.html');
    expect(list).toContain('assets/index-a.js');
    expect(list).toContain('manifest.webmanifest');
    expect(list.some((f) => f.startsWith('icons/'))).toBe(true);
    expect(list).not.toContain('assets/index-a.js.map');
    expect(list).not.toContain('_headers');
    expect(emitted[0].source).toContain('self.__RELEASE = "r1";');
    expect(() => plugin.generateBundle.call(ctx, {}, { 'assets/a.js': {} })).toThrow(/index\.html/);
  });
});
