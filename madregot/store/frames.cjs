// App Store frames: one benefit each, the real Madregot screen in a phone that runs off the bottom edge.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const FONTS = path.resolve(__dirname, '../web/node_modules/@fontsource-variable');
const FRAMES = [
  ['1-numberline', 'מזיזים את המתמטיקה בידיים', 'גוררים, רואים מה קורה, ובודקים.', '#1a8fd6', '#e2f2fc'],
  ['2-map', 'עולם לכל נושא', 'מפה של מדרגות, מכפור ואש ועד פירמידות.', '#5b4ff0', '#ecebff'],
  ['3-hint', 'רמז שמצויר על התרגיל', 'מדי מראה איפה לחפש, בלי לגלות את התשובה.', '#0d8597', '#ddf3f5'],
  ['4-climb', 'מדרגה אחרי מדרגה', 'כל שיעור מעלה את מדי עוד צעד.', '#c0349f', '#fbe6f5'],
  ['5-topics', 'שישה נושאים, 33 מדרגות', 'כיתות ז׳ וח׳, כמה דקות ביום.', '#5b4ff0', '#ecebff'],
];
const html = (img, title, sub, c, tint) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: Fredoka; src: url(file://${FONTS}/fredoka/files/fredoka-hebrew-wght-normal.woff2) format('woff2'); font-weight: 300 700; unicode-range: U+0590-05FF, U+FB1D-FB4F; }
@font-face { font-family: Fredoka; src: url(file://${FONTS}/fredoka/files/fredoka-latin-wght-normal.woff2) format('woff2'); font-weight: 300 700; }
@font-face { font-family: Rubik; src: url(file://${FONTS}/rubik/files/rubik-hebrew-wght-normal.woff2) format('woff2'); font-weight: 300 900; unicode-range: U+0590-05FF, U+FB1D-FB4F; }
@font-face { font-family: Rubik; src: url(file://${FONTS}/rubik/files/rubik-latin-wght-normal.woff2) format('woff2'); font-weight: 300 900; }
html, body { margin: 0; width: 430px; height: 932px; overflow: hidden; }
body { background: linear-gradient(180deg, ${tint} 0%, #fff 78%); font-family: Rubik, sans-serif; color: #24253a; position: relative; }
.copy { position: absolute; top: 64px; inset-inline: 32px; text-align: center; }
h1 { margin: 0; font-family: Fredoka, sans-serif; font-weight: 700; font-size: 40px; line-height: 1.12; color: ${c}; text-wrap: balance; }
p { margin: 14px 0 0; font-size: 19px; line-height: 1.45; color: #5f6178; }
.phone { position: absolute; left: 50%; transform: translateX(-50%); top: 250px; width: 336px; height: 728px; border-radius: 52px; background: #24253a; padding: 10px; box-sizing: border-box; box-shadow: 0 30px 60px -30px rgba(36, 37, 58, 0.45); }
.screen { width: 100%; height: 100%; border-radius: 42px; overflow: hidden; background: #fff; }
.screen img { display: block; width: 100%; height: auto; }
</style></head><body><div class="copy"><h1>${title}</h1><p>${sub}</p></div><div class="phone"><div class="screen"><img src="file://${path.resolve(img)}"></div></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  const p = await c.newPage();
  for (const [n, title, sub, col, tint] of FRAMES) {
    const f = path.join(require('os').tmpdir(), `madregot-frame-${n}.html`); fs.writeFileSync(f, html(`raw-${n}.png`, title, sub, col, tint)); // a working file, outside the repository
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: `store-${n}.png` });
  }
  await b.close(); console.log('framed');
})();
