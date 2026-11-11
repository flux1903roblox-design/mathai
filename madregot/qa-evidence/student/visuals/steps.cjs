// Teaching steps with the new figures, in the app: node steps.cjs <out> [names]. It needs a build with sample figures on
// five steps (the content stages add the real ones), served by vite preview on port 4232; the samples were put in the
// content for that build only and taken out again, so nothing of them is committed.
const { chromium } = require('/home/user/mathai-student/madregot/web/node_modules/playwright');
const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(3);
const BASE = 'http://127.0.0.1:4232/';
const student = (grade) => ({ state: { profile: { role: 'student', name: 'נועה', grade, know: 1 }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [], ai: { mode: 'server', apiUrl: '', key: '' }, path: {}, freezes: 0, goalXp: 50, sound: false, gaps: {}, placement: null }, version: 1 });
// [name, route, grade, step index]
const SHOTS = [
  ['signed1-0-numline', '#/learn/signed/1/A', '7', 0],
  ['line1-0-machine', '#/learn/line/1/A', '8', 0],
  ['line1-1-machine-ask', '#/learn/line/1/A', '8', 1],
  ['coord1-2-points', '#/learn/coord/1/A', '7', 2],
  ['stats1-say-dots', '#/learn/stats/1/A', '8', 'כשהנתונים מונחים'],
  ['eq1-0-scale', '#/learn/eq/1/A', '7', 0],
];
async function goTo(page, want) {
  for (let i = 0; i < 25; i += 1) {
    await page.waitForFunction(() => !!window.__madregotStep);
    const st = await page.evaluate(() => window.__madregotStep);
    const idx = Number(await page.locator('.sp-progress').getAttribute('aria-valuenow'));
    if (typeof want === 'number' ? idx === want : st.text.includes(want)) return;
    if (st.kind === 'explore') { await page.waitForFunction(() => window.__madregotSolveStep?.forStep === window.__madregotStep); await page.evaluate(() => window.__madregotSolveStep()); await page.locator('.lm-check').click(); }
    if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
    await page.locator('.sp-next').click();
    await page.waitForFunction((a) => document.querySelector('.sp-progress')?.getAttribute('aria-valuenow') !== a, String(idx));
  }
}
(async () => {
  const browser = await chromium.launch();
  for (const [name, route, grade, want] of SHOTS.filter((s) => !only.length || only.includes(s[0]))) {
    for (const scheme of ['light', 'dark']) {
      for (const [w, h] of [[390, 844], [320, 568]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'he-IL', colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await ctx.newPage();
        await page.goto(BASE);
        await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('madregot-debug', '1'); localStorage.setItem('madregot-seed', '424242'); localStorage.setItem('madregot', JSON.stringify(s)); }, student(grade));
        await page.goto(BASE + route); await page.reload();
        await page.locator('.step-player').waitFor();
        await goTo(page, want);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${out}/${name}-${scheme}-${w}.png` });
        if (name === 'eq1-0-scale' && scheme === 'light') {
          // before: the say layout as it was (the canvas pushed down, 120px high)
          await page.addStyleTag({ content: '.lm-card.sp-say > .lm-canvas.big:has(.lm-fig) { margin-top: auto !important; min-height: 120px !important; }' });
          await page.waitForTimeout(100);
          await page.screenshot({ path: `${out}/${name}-before-${scheme}-${w}.png` });
        }
        await ctx.close();
      }
    }
  }
  // the numline drawing itself in: frames with motion on
  if (!only.length || only.includes('anim')) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'he-IL', reducedMotion: 'no-preference', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('madregot', JSON.stringify(s)); }, student('7'));
    await page.goto(BASE + '#/learn/signed/1/A'); await page.reload();
    const fig = page.locator('.lm-canvas');
    await fig.waitFor();
    const t0 = Date.now();
    for (const t of [150, 520, 760, 1200]) { await page.waitForTimeout(Math.max(0, t - (Date.now() - t0))); await fig.screenshot({ path: `${out}/anim-numline-${t}ms.png`, animations: 'allow' }); }
    await ctx.close();
  }
  await browser.close();
})();
