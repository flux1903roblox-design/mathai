// Builds the service worker (src/sw/sw.js) into dist/sw.js (DURABLE-10). Above the hand-written code it puts:
//   self.__PRECACHE  the files the worker keeps for offline use, relative to sw.js
//   self.__RELEASE   a name made from the content of those files (VITE_RELEASE overrides it, and the plugin's `release`
//                    option overrides both), so any change to the app makes a new release and the worker's update check
//                    finds it
// The worker only runs in a production build; lib/swClient.js registers it. It runs last (enforce: 'post'), after Vite
// has emitted index.html and the CSS, and refuses a bundle with no index.html (the app would not open offline).
// (The student lane's plugin, with the family lane's exports and checks merged in: precacheList, workerSource, SW_SOURCE.)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The hand-written worker. */
export const SW_SOURCE = fileURLToPath(new URL('../src/sw/sw.js', import.meta.url));

/** A path relative to the build folder, with forward slashes and no leading './'. */
const plain = (file) => String(file).replace(/\\/g, '/').replace(/^\.?\//, '');

/**
 * Which built file the worker keeps (the path is relative to the build folder):
 * index.html, the manifest, the icons and theme-boot.js; every script and style sheet directly under assets/; the woff2
 * fonts of Rubik's Hebrew and Latin parts and of KaTeX. Not source maps, not the .ttf/.woff copies (browsers take the
 * woff2), not Rubik's Arabic, Cyrillic or Latin-extended parts (the app never shows them), not other public files
 * (store screenshots, _headers).
 */
export function precacheFilter(file) {
  const f = plain(file);
  if (/\.map$/i.test(f)) return false;
  if (/^(index\.html|manifest\.webmanifest|theme-boot\.js)$/.test(f)) return true;
  if (/^icons\/[\w-]+\.(png|svg|ico|webp)$/i.test(f)) return true;
  const name = /^assets\/([^/]+)$/.exec(f)?.[1];
  if (!name) return false;
  if (/\.(js|css)$/.test(name)) return true;
  const font = /^(.+)\.woff2$/.exec(name);
  if (!font) return false;
  return /^KaTeX_/.test(font[1]) || /^rubik-(hebrew|latin)-wght-/.test(font[1]);
}

/** The precache list: kept files, once each, in one order (so two builds of the same files make the same worker). */
export const precacheList = (files) => [...new Set(files.map(plain).filter(precacheFilter))].sort();

/** sw.js as it is served: the two lines, then the worker. */
export function workerSource({ list, release, source = readFileSync(SW_SOURCE, 'utf8') }) {
  return `self.__PRECACHE = ${JSON.stringify(list)};\nself.__RELEASE = ${JSON.stringify(String(release))};\n${source}`;
}

function* walk(dir, root = dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p, root);
    else yield relative(root, p).split(sep).join('/');
  }
}

export default function serviceWorker({ src = 'src/sw/sw.js', release: fixedRelease } = {}) {
  let config;
  return {
    name: 'madregot-sw',
    apply: 'build',
    enforce: 'post', // after Vite's own plugins, so index.html and the CSS files are already in the bundle
    configResolved(c) { config = c; },
    generateBundle(_, bundle) {
      const content = new Map();
      for (const [name, out] of Object.entries(bundle)) content.set(plain(name), (out?.type === 'chunk' ? out.code : out?.source) ?? '');
      if (config.publicDir && existsSync(config.publicDir)) {
        for (const name of walk(config.publicDir)) content.set(name, readFileSync(join(config.publicDir, name)));
      }
      const files = precacheList([...content.keys()]);
      if (!files.includes('index.html')) {
        const msg = 'sw: index.html is not in the bundle, so the app would not open offline';
        if (this.error) this.error(msg); else throw new Error(msg);
      }
      const code = readFileSync(config.root ? join(config.root, src) : SW_SOURCE, 'utf8');
      const hash = createHash('sha256').update(code);
      let bytes = 0;
      for (const f of files) { const c = content.get(f); hash.update(f).update(c); bytes += typeof c === 'string' ? Buffer.byteLength(c) : c.length; }
      const release = fixedRelease || process.env.VITE_RELEASE || hash.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: workerSource({ list: files, release, source: code }) });
      config.logger?.info(`sw.js: release ${release}, ${files.length} files kept for offline use (${(bytes / 1048576).toFixed(2)} MB)`);
    },
  };
}
