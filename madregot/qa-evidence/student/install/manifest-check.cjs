// What Chrome itself says about the manifest (the DevTools > Application > Manifest panel reads the same):
// Page.getAppManifest (parse errors and warnings) and Page.getInstallabilityErrors.
// Usage, with a build served (from madregot/web: npx vite build && npx vite preview --port 4232):
//   node ../qa-evidence/student/install/manifest-check.cjs http://127.0.0.1:4232/ > ../qa-evidence/student/install/manifest-check.txt
const { chromium } = require(require('path').resolve(__dirname, '../../../web/node_modules/playwright'));
const BASE = process.argv[2] || 'http://127.0.0.1:4232/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(page);
  const m = await cdp.send('Page.getAppManifest');
  const inst = await cdp.send('Page.getInstallabilityErrors');
  const parsed = m.manifest || m.parsed || null;
  console.log('manifest url:', m.url.replace(BASE, './'));
  console.log('parse errors and warnings:', m.errors.length ? JSON.stringify(m.errors, null, 1) : 'none');
  console.log('installability errors:', inst.installabilityErrors.length ? JSON.stringify(inst.installabilityErrors, null, 1) : 'none');
  if (parsed) console.log('parsed by Chrome:', JSON.stringify({ id: parsed.id, startUrl: parsed.startUrl, scope: parsed.scope, display: parsed.display, launchHandler: parsed.launchHandler, shortcuts: parsed.shortcuts?.map((s) => ({ name: s.name, url: s.url })) }, null, 1).replaceAll(BASE, './'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
