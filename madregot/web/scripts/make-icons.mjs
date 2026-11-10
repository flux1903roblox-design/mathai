// Makes the app icons (DURABLE-3) from the SVG favicon in index.html, so there is one drawing of the mark. Run it once
// after the favicon changes, and commit the PNGs: node scripts/make-icons.mjs
// It renders with the Chromium that Playwright already has (a dev dependency); it never downloads a browser.
//   icons/192.png, icons/512.png   the favicon as it is (a blue circle on a transparent square), for Android and desktop
//   icons/maskable-512.png         full bleed on #1A5CF5, the mark inside the central 80% (the safe zone a launcher may
//                                  crop to a circle or a rounded square)
//   icons/180.png                  the iPhone Home Screen icon (apple-touch-icon): full bleed as well, because iOS draws
//                                  transparent corners black and rounds the corners itself; the mark drawn a little
//                                  larger, as Home Screen icons are
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const web = fileURLToPath(new URL('..', import.meta.url));
const BRAND = '#1A5CF5';

/** The favicon's SVG, read from its data URL in index.html. */
export function faviconSvg(html = readFileSync(`${web}index.html`, 'utf8')) {
  const m = html.match(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)"/);
  if (!m) throw new Error('index.html has no SVG favicon');
  return decodeURIComponent(m[1]);
}

/** The page that draws one icon: `size` px square; `bleed`: the brand colour fills it, the mark at `scale` of it. */
function page(svg, size, { bleed = false, scale = 1 } = {}) {
  const inner = Math.round(size * scale);
  const sized = svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `);
  return `<!doctype html><html><head><style>
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${bleed ? BRAND : 'transparent'}; }
    body { position: relative; overflow: hidden; }
    svg { display: block; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
  </style></head><body>${sized}</body></html>`;
}

export const ICONS = [
  { file: '192.png', size: 192 },
  { file: '512.png', size: 512 },
  // the circle of the mark is 30/32 of the square; inside an 80% safe zone the stairs stay well inside the crop
  { file: 'maskable-512.png', size: 512, bleed: true, scale: 0.8 },
  { file: '180.png', size: 180, bleed: true, scale: 1.15 },
];

async function main() {
  const svg = faviconSvg();
  const out = `${web}public/icons/`;
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const icon of ICONS) {
      const p = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
      await p.setContent(page(svg, icon.size, icon));
      const png = await p.screenshot({ omitBackground: !icon.bleed, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
      writeFileSync(`${out}${icon.file}`, png);
      await p.close();
      console.log(`icons/${icon.file} ${icon.size}x${icon.size}`);
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
