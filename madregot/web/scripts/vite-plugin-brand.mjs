// The product's name from one place, shared/brand.js APP_NAME (STUDENT-12): index.html and public/manifest.webmanifest
// say %APP_NAME%, and this fills it in: index.html as it is served or built, the manifest as the dev server serves it
// and in the build's copy (Vite copies public/ before the bundle is written). The landing pages
// (scripts/landing-build.mjs) and the store listing read the same constant, so a rename is one line in brand.js.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_NAME } from '../../shared/brand.js';

export const fillBrand = (text) => String(text).replaceAll('%APP_NAME%', APP_NAME);
const MANIFEST = 'manifest.webmanifest';

export default function brand() {
  let config;
  return {
    name: 'madregot-brand',
    configResolved(c) { config = c; },
    // before Vite's own %ENV% pass, which would warn about a name it does not know
    transformIndexHtml: { order: 'pre', handler: fillBrand },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!config.publicDir || !String(req.url || '').split('?')[0].endsWith(`/${MANIFEST}`)) return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(fillBrand(readFileSync(join(config.publicDir, MANIFEST), 'utf8')));
        return undefined;
      });
    },
    writeBundle(options) {
      const file = join(options.dir || config.build.outDir, MANIFEST);
      if (existsSync(file)) writeFileSync(file, fillBrand(readFileSync(file, 'utf8')));
    },
  };
}
