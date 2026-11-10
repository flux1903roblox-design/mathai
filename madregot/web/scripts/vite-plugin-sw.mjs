// The service worker's build step (DURABLE-10): after the bundle is made, web/src/sw/sw.js is emitted as sw.js with the
// release's precache list and the release name put in front of it:
//   self.__PRECACHE = [ 'assets/index-….js', …, 'icons/icon-192.png', 'index.html', 'manifest.webmanifest' ];
//   self.__RELEASE = '<VITE_RELEASE>';
// The list is every emitted script and stylesheet, index.html, the manifest and the icons (from public/), and the woff2
// fonts the app shows: Rubik's Hebrew and Latin subsets and KaTeX's. Never a source map, a .ttf or .woff (the browser
// takes the woff2), Rubik's Arabic, Cyrillic or Latin Extended subsets, or _headers. It runs last (enforce: 'post'),
// after Vite has emitted index.html and the CSS.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SW_SOURCE = fileURLToPath(new URL('../src/sw/sw.js', import.meta.url));

const RUBIK_KEEP = /^rubik-(hebrew|latin)-wght-/i;

/** Does the worker keep this file (a path relative to the build folder, with forward slashes)? */
export function precacheFilter(file) {
  const f = String(file).replace(/\\/g, '/').replace(/^\.?\//, '');
  if (/\.map$/i.test(f)) return false;
  if (f === 'index.html' || f === 'manifest.webmanifest') return true;
  if (f.startsWith('icons/')) return /\.(png|svg|ico|webp)$/i.test(f);
  if (!f.startsWith('assets/')) return false;
  const name = f.slice('assets/'.length);
  if (name.includes('/')) return false;
  if (/\.(js|css)$/i.test(name)) return true;
  if (/\.woff2$/i.test(name)) return RUBIK_KEEP.test(name) || /^KaTeX_/.test(name);
  return false;
}

/** The precache list: kept files, once each, in one order (so two builds of the same files make the same worker). */
export const precacheList = (files) => [...new Set(files.map((f) => String(f).replace(/\\/g, '/').replace(/^\.?\//, '')).filter(precacheFilter))].sort();

/** The files of a folder, relative to it. */
function filesIn(dir) {
  if (!dir || !existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p); else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out;
}

/** sw.js as it is served: the two lines, then the worker. */
export function workerSource({ list, release, source = readFileSync(SW_SOURCE, 'utf8') }) {
  return `self.__PRECACHE = ${JSON.stringify(list)};\nself.__RELEASE = ${JSON.stringify(String(release))};\n${source}`;
}

export default function swPlugin({ release = 'dev' } = {}) {
  let publicDir = null;
  return {
    name: 'madregot-sw',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { publicDir = config.publicDir || null; },
    generateBundle(_options, bundle) {
      const list = precacheList([...Object.keys(bundle), ...filesIn(publicDir)]);
      if (!list.includes('index.html')) this.error('sw: index.html is not in the bundle, so the app would not open offline');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: workerSource({ list, release }) });
    },
  };
}
