// The store images (STUDENT-12 §5), from the bare screens capture.cjs takes of the real app (no server, QA hooks,
// light mode). One benefit per frame, the headline above and the real screen in a phone that runs off the bottom edge,
// in the app's own colours (tokens.css; dark.css for the dark frame) and font (Rubik):
//
//   apple/iphone-6.9-<n>-<scene>.jpg   App Store, iPhone 6.9": 1320 × 2868, JPEG (no alpha), frames 1-5
//   apple/icon-1024.png                App Store icon: 1024 × 1024, the full square, no alpha
//   play/phone-<n>-<scene>.png         Play phone screenshots: 1080 × 1920 (long side under twice the short), frames 1-5
//   play/phone-dark-3-map.png          the home path in dark mode, for the Play gallery
//   play/feature-graphic.png           Play feature graphic: 1024 × 500, no alpha
//   play/icon-512.png                  Play icon: 512 × 512, the full square, no alpha
//
// capture.cjs store runs this after the screens (node madregot/store/capture.cjs store); on its own, with screens already
// taken: node madregot/store/frames.cjs <folder with raw-*.png>. The headlines are the listing's (README.md); the topic
// count is store/counts.json's, which the app's programme writes (as the listing's topic lines do).
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const WEB = path.resolve(__dirname, '../web');
// The counts are the app's own, written by `npm run programme:md` (web/scripts/programme-md.mjs): never typed here.
const COUNTS = require('./counts.json');
const OUT = { apple: path.join(__dirname, 'apple'), play: path.join(__dirname, 'play') };
const FONTS = path.join(WEB, 'node_modules/@fontsource-variable/rubik/files');

/** The five frames, in the listing's order. {{TOPIC_COUNT}} is the number of topics the app teaches. */
const FRAMES = [
  { n: 1, scene: 'mistake', title: 'טעות? מדי מראה מה כנראה קרה', line: 'ונותן עוד ניסיון, בלי לגלות את התשובה' },
  { n: 2, scene: 'numberline', title: 'מזיזים את המתמטיקה בידיים', line: 'ציר מספרים, מערכת צירים, זוויות' },
  { n: 3, scene: 'map', title: 'יחידה לכל נושא', line: '{{TOPIC_COUNT}} נושאים לכיתות ז׳ וח׳' },
  { n: 4, scene: 'rescue', title: 'מבחן ביום חמישי? יש תוכנית', line: 'חזרה לפי הימים שנשארו, ושבת חופשית' },
  { n: 5, scene: 'wardrobe', title: 'המדי שלכם', line: 'צבעים ואביזרים מכל מה שלמדתם' },
];

/**
 * Two layouts, in CSS pixels at 3x: the App Store's tall phone (440 × 956 → 1320 × 2868) and Play's 9:16
 * (360 × 640 → 1080 × 1920). `phone` is the width of the phone, `gap` the space between the words and the phone, which
 * starts under them at the same height in every frame of a set, and runs off the bottom.
 */
const LAYOUT = {
  apple: { w: 440, h: 956, copyTop: 76, title: 40, line: 21, phone: 340, gap: 44, bezel: 11, radius: 56 },
  play: { w: 360, h: 640, copyTop: 36, title: 30, line: 17, phone: 262, gap: 26, bezel: 9, radius: 44 },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fontFaces = () => ['hebrew', 'latin'].map((part) => `@font-face { font-family: 'Rubik Variable'; font-weight: 300 900;
  src: url(${pathToFileURL(path.join(FONTS, `rubik-${part}-wght-normal.woff2`)).href}) format('woff2'); }`).join('\n');

/** The colours a frame uses, read from the app's tokens: light (tokens.css :root) or dark (dark.css). */
async function palette() {
  const { tokenBlocks, tokenValue } = await import(pathToFileURL(path.join(WEB, 'scripts/landing-build.mjs')).href);
  const { root, dark } = tokenBlocks();
  const pick = (block) => ({
    ground: tokenValue(block, '--brand-tint'), ink: tokenValue(block, '--ink'), ink2: tokenValue(block, '--ink-2'),
    brand: tokenValue(block, '--brand-ink'), paper: tokenValue(block, '--paper'), rule: tokenValue(block, '--rule-strong'),
  });
  const light = pick(root);
  const night = pick(dark);
  return { light: { ...light, bezel: light.ink }, dark: { ...night, ground: night.paper, bezel: '#000000' } };
}

const frameHtml = (shot, f, L, c) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
${fontFaces()}
html, body { margin: 0; width: ${L.w}px; height: ${L.h}px; overflow: hidden; }
body { background: ${c.ground}; font-family: 'Rubik Variable', sans-serif; color: ${c.ink}; display: flex; flex-direction: column; align-items: center; }
/* room for two lines of headline and one under it, the words centred in it: every phone in a set starts at one height */
.copy { flex: none; margin-top: ${L.copyTop}px; padding-inline: 28px; text-align: center; box-sizing: border-box;
  height: ${Math.round(L.title * 1.15 * 2 + L.line * 0.6 + L.line * 1.4)}px; display: flex; flex-direction: column; justify-content: center; }
h1 { margin: 0; font-size: ${L.title}px; line-height: 1.15; font-weight: 800; letter-spacing: -0.01em; text-wrap: balance; }
p { margin: ${Math.round(L.line * 0.6)}px 0 0; font-size: ${L.line}px; line-height: 1.4; color: ${c.ink2}; text-wrap: balance; }
.phone { flex: none; margin-top: ${L.gap}px; width: ${L.phone}px; height: ${L.h}px; box-sizing: border-box; padding: ${L.bezel}px; border-radius: ${L.radius}px; background: ${c.bezel}; box-shadow: 0 0 0 2px ${c.rule}; }
.screen { width: 100%; height: 100%; border-radius: ${L.radius - L.bezel}px; overflow: hidden; background: ${c.paper}; }
.screen img { display: block; width: 100%; height: auto; }
</style></head><body><div class="copy"><h1>${esc(f.title)}</h1><p>${esc(f.line)}</p></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${shot.toString('base64')}" alt=""></div></div></body></html>`;

/** Play's feature graphic: the name and one line on the right, the home path in a phone on the left. */
const featureHtml = (shot, name, line, c) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
${fontFaces()}
html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
body { background: ${c.ground}; font-family: 'Rubik Variable', sans-serif; color: ${c.ink}; position: relative; }
.copy { position: absolute; top: 0; bottom: 0; right: 80px; width: 520px; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
.name { margin: 0; font-size: 84px; line-height: 1; font-weight: 800; color: ${c.brand}; }
p { margin: 0; font-size: 34px; line-height: 1.3; color: ${c.ink2}; text-wrap: balance; }
.phone { position: absolute; left: 110px; top: 56px; width: 270px; height: 560px; box-sizing: border-box; padding: 9px;
  border-radius: 44px; background: ${c.bezel}; box-shadow: 0 0 0 2px ${c.rule}; }
.screen { width: 100%; height: 100%; border-radius: 35px; overflow: hidden; background: ${c.paper}; }
.screen img { display: block; width: 100%; height: auto; }
</style></head><body><div class="copy"><h1 class="name">${esc(name)}</h1><p>${esc(line)}</p></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${shot.toString('base64')}" alt=""></div></div></body></html>`;

async function render(browser, html, { w, h, scale, file, type = 'png' }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.setContent(html);
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
  // an opaque page: Chromium writes an RGB PNG (no alpha channel), and a JPEG has none
  await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 90 } : {}) });
  await ctx.close();
  console.log(`${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

/** All the store images from the screens in `raw` (capture.cjs names them raw-<n>-<scene>.png and raw-3-map-dark.png). */
async function makeFrames(browser, raw) {
  const { APP_NAME } = await import(pathToFileURL(path.resolve(__dirname, '../shared/brand.js')).href);
  const count = COUNTS.topics;
  const colours = await palette();
  for (const dir of Object.values(OUT)) fs.mkdirSync(dir, { recursive: true });
  const shot = (name) => fs.readFileSync(path.join(raw, name));
  for (const f of FRAMES) {
    const frame = { ...f, line: f.line.replace('{{TOPIC_COUNT}}', String(count)) };
    const img = shot(`raw-${f.n}-${f.scene}.png`);
    const A = LAYOUT.apple;
    await render(browser, frameHtml(img, frame, A, colours.light), { w: A.w, h: A.h, scale: 3, type: 'jpeg', file: path.join(OUT.apple, `iphone-6.9-${f.n}-${f.scene}.jpg`) });
    const P = LAYOUT.play;
    await render(browser, frameHtml(img, frame, P, colours.light), { w: P.w, h: P.h, scale: 3, file: path.join(OUT.play, `phone-${f.n}-${f.scene}.png`) });
    if (f.scene === 'map') {
      await render(browser, frameHtml(shot('raw-3-map-dark.png'), frame, P, colours.dark), { w: P.w, h: P.h, scale: 3, file: path.join(OUT.play, 'phone-dark-3-map.png') });
    }
  }
  await render(browser, featureHtml(shot('raw-3-map.png'), APP_NAME, 'תרגול מתמטיקה לכיתות ז׳ וח׳', colours.light), { w: 1024, h: 500, scale: 1, file: path.join(OUT.play, 'feature-graphic.png') });
  // the icons: make-icons.mjs's full square (the Home Screen icon's drawing), opaque
  const { ART, renderIcon } = await import(pathToFileURL(path.join(WEB, 'scripts/make-icons.mjs')).href);
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await renderIcon(page, ART.SQUARE, 1024, path.join(OUT.apple, 'icon-1024.png'), { transparent: false });
  await renderIcon(page, ART.SQUARE, 512, path.join(OUT.play, 'icon-512.png'), { transparent: false });
  await page.close();
  console.log('framed');
}

module.exports = { makeFrames, FRAMES, LAYOUT };

// node madregot/store/frames.cjs <folder with the raw screens>
if (require.main === module) {
  const raw = process.argv[2];
  if (!raw) { console.error('usage: node madregot/store/frames.cjs <folder with raw-*.png from capture.cjs store --raw>'); process.exit(2); }
  const { chromium } = createRequire(path.join(WEB, 'package.json'))('@playwright/test');
  (async () => {
    const browser = await chromium.launch();
    try { await makeFrames(browser, path.resolve(raw)); } finally { await browser.close(); }
  })().catch((e) => { console.error(e); process.exit(1); });
}
