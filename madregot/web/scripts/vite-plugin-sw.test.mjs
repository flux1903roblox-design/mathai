// The service worker's precache list (DURABLE-10, vite-plugin-sw.mjs): what a release keeps for the app to work offline,
// and the sw.js the build emits (the list and the release in front of the hand-written worker).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import swPlugin, { precacheFilter, precacheList, workerSource, SW_SOURCE, KATEX_UNUSED, KATEX_UNUSED_COMMANDS } from './vite-plugin-sw.mjs';

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

// The lane's review: the precache was 4.86 MB against its 4.79 MB gate. KaTeX ships five families for \mathcal, \mathfrak,
// \mathsf, \mathscr and \mathtt, nine woff2 files (about 94 KB) that the app's maths never uses; they are no longer kept
// up front, and the families the maths is set in still are.
describe('KaTeX\'s families the app never shows are not kept up front', () => {
  const UNUSED = ['KaTeX_Caligraphic-Bold-Dq_IR9rO', 'KaTeX_Caligraphic-Regular-Di6jR-x-', 'KaTeX_Fraktur-Bold-CL6g_b3V', 'KaTeX_Fraktur-Regular-CTYiF6lA',
    'KaTeX_SansSerif-Bold-D1sUS0GD', 'KaTeX_SansSerif-Italic-C3H0VqGB', 'KaTeX_SansSerif-Regular-DDBCnlJ7', 'KaTeX_Script-Regular-D3wIWfF6', 'KaTeX_Typewriter-Regular-CO6r4hn1'];
  const USED = ['KaTeX_AMS-Regular-BQhdFMY1', 'KaTeX_Main-Regular-B22Nviop', 'KaTeX_Main-Bold-Cx986IdX', 'KaTeX_Main-Italic-NWA7e6Wa', 'KaTeX_Main-BoldItalic-DxDJ3AOS',
    'KaTeX_Math-Italic-t53AETM-', 'KaTeX_Math-BoldItalic-CZnvNsCZ', 'KaTeX_Size1-Regular-mCD8mA8B', 'KaTeX_Size2-Regular-Dy4dx90m', 'KaTeX_Size3-Regular-6QyBe7l8', 'KaTeX_Size4-Regular-Dl5lxZxV'];
  it('the nine files of the five families are left out; Main, Math, AMS and the four sizes are kept', () => {
    for (const f of UNUSED) expect(precacheFilter(`assets/${f}.woff2`), f).toBe(false);
    for (const f of USED) expect(precacheFilter(`assets/${f}.woff2`), f).toBe(true);
    expect(precacheList([...UNUSED, ...USED].map((f) => `assets/${f}.woff2`))).toEqual(USED.map((f) => `assets/${f}.woff2`).sort());
    // a script is never taken for a font, whatever its name
    expect(precacheFilter('assets/KaTeX_Script-Regular-x.js')).toBe(true);
    expect(KATEX_UNUSED.test('KaTeX_Size1-Regular-x')).toBe(false);
  });
  it('nothing the app writes asks for one of them: no \\mathcal, \\mathfrak, \\mathsf, \\mathscr, \\mathtt or their text forms', () => {
    const roots = [fileURLToPath(new URL('../src', import.meta.url)), fileURLToPath(new URL('../../shared', import.meta.url))];
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); } else if (/\.(js|jsx|ts|md|json)$/.test(name)) files.push(p);
      }
    };
    roots.forEach(walk);
    expect(files.length).toBeGreaterThan(300);
    const asking = files.filter((p) => KATEX_UNUSED_COMMANDS.test(readFileSync(p, 'utf8')));
    expect(asking).toEqual([]);
    // the search finds one where there is one, in a source file's own spelling too
    for (const s of ['\\mathcal{A}', "'\\\\mathtt{x}'", '\\textsf{a}', '\\frak g']) expect(KATEX_UNUSED_COMMANDS.test(s), s).toBe(true);
    for (const s of ['\\frac{1}{2}', '\\mathbb{R}', '\\text{a}', '\\calc', '\\cdot']) expect(KATEX_UNUSED_COMMANDS.test(s), s).toBe(false);
  });
});

describe('sw.js', () => {
  it('starts with the list and the release, then the hand-written worker', () => {
    const src = workerSource({ list: ['index.html', 'assets/a.js'], release: 'abc1234' });
    expect(src.split('\n').slice(0, 2)).toEqual(['self.__PRECACHE = ["index.html","assets/a.js"];', 'self.__RELEASE = "abc1234";']);
    expect(src.endsWith(readFileSync(SW_SOURCE, 'utf8'))).toBe(true);
  });
  it('the worker never handles the API, never skips waiting by itself, and its push handlers are in STUDENT-11\'s section', () => {
    // (one worker: the student lane's src/sw/sw.js, whose API rule is this line; src/sw/sw.test.js runs it)
    const sw = readFileSync(SW_SOURCE, 'utf8');
    expect(sw).toMatch(/if \(url\.pathname\.startsWith\('\/api\/'\) \|\| path\.startsWith\('api\/'\)\) return;/);
    // skipWaiting only in answer to the page's message
    expect(sw.match(/skipWaiting\(\)/g)).toHaveLength(1);
    expect(sw).toMatch(/SKIP_WAITING'\) self\.skipWaiting\(\)/);
    expect(sw).toContain('push handlers (STUDENT-11)');
    // the daily reminder (STUDENT-11) filled that section: every push listener comes after its marker (src/sw/sw.test.js
    // runs them)
    const marker = sw.indexOf('push handlers (STUDENT-11)');
    for (const ev of ['push', 'notificationclick', 'pushsubscriptionchange']) {
      const at = sw.indexOf(`addEventListener('${ev}'`);
      expect(at, ev).toBeGreaterThan(marker);
    }
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
