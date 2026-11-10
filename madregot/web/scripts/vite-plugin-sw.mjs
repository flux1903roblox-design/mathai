// Builds the service worker (src/sw/sw.js) into dist/sw.js (DURABLE-10). Above the hand-written code it puts:
//   self.__PRECACHE  the files the worker keeps for offline use, relative to sw.js
//   self.__RELEASE   a name made from the content of those files (VITE_RELEASE overrides it), so any change to the
//                    app makes a new release and the worker's update check finds it
// The worker only runs in a production build; lib/swClient.js registers it.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Which built file the worker keeps (the path is relative to the build folder, with forward slashes):
 * index.html, the manifest, the icons and theme-boot.js; every script and style sheet under assets/; the woff2 fonts
 * of Rubik's Hebrew and Latin parts and of KaTeX. Not source maps, not the .ttf/.woff copies (browsers take the
 * woff2), not Rubik's Arabic, Cyrillic or Latin-extended parts (the app never shows them), not other public files
 * (store screenshots, _headers).
 */
export function precacheFilter(file) {
  if (/^(index\.html|manifest\.webmanifest|theme-boot\.js)$/.test(file)) return true;
  if (/^icons\/[\w-]+\.png$/.test(file)) return true;
  if (!file.startsWith('assets/') || file.endsWith('.map')) return false;
  if (/\.(js|css)$/.test(file)) return true;
  const font = /^assets\/([^/]+)\.woff2$/.exec(file);
  if (!font) return false;
  return /^KaTeX_/.test(font[1]) || /^rubik-(hebrew|latin)-wght-/.test(font[1]);
}

function* walk(dir, root = dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p, root);
    else yield relative(root, p).split(sep).join('/');
  }
}

export default function serviceWorker({ src = 'src/sw/sw.js' } = {}) {
  let config;
  return {
    name: 'madregot-sw',
    apply: 'build',
    enforce: 'post', // after Vite's own plugins, so index.html and the CSS files are already in the bundle
    configResolved(c) { config = c; },
    generateBundle(_, bundle) {
      const content = new Map();
      for (const [name, out] of Object.entries(bundle)) content.set(name, out.type === 'chunk' ? out.code : out.source);
      if (config.publicDir) for (const name of walk(config.publicDir)) content.set(name, readFileSync(join(config.publicDir, name)));
      const files = [...content.keys()].filter(precacheFilter).sort();
      const code = readFileSync(join(config.root, src), 'utf8');
      const hash = createHash('sha256').update(code);
      let bytes = 0;
      for (const f of files) { const c = content.get(f); hash.update(f).update(c); bytes += typeof c === 'string' ? Buffer.byteLength(c) : c.length; }
      const release = process.env.VITE_RELEASE || hash.digest('hex').slice(0, 12);
      const head = `self.__PRECACHE = ${JSON.stringify(files)};\nself.__RELEASE = ${JSON.stringify(release)};\n`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: head + code });
      config.logger.info(`sw.js: release ${release}, ${files.length} files kept for offline use (${(bytes / 1048576).toFixed(2)} MB)`);
    },
  };
}
