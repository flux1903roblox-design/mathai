// Walk every teaching step (Stage A) of the given topics and screenshot each one: node walk.cjs <out> <w> <h> <scheme> topic:levels...
// e.g. node walk.cjs out 320 568 light signed:1-5 coord:1-5
const { chromium } = require('/home/user/mathai-student/madregot/web/node_modules/playwright');
const fs = require('fs');
const [out, W, H, scheme, ...which] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:4232/';
const GRADE = { signed: '7', coord: '7', angles: '7', expr: '7', eq: '7', line: '8', pyth: '8', stats: '8', sys: '8' };
const student = (grade) => ({ state: { profile: { role: 'student', name: 'נועה', grade, know: 1 }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [], ai: { mode: 'server', apiUrl: '', key: '' }, path: {}, freezes: 0, goalXp: 50, sound: false, gaps: {}, placement: null }, version: 1 });
(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const w of which) {
    const [topic, range] = w.split(':'); const [a, b] = range.split('-').map(Number);
    for (let level = a; level <= (b || a); level += 1) {
      const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'he-IL', colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(BASE);
      await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('madregot-debug', '1'); localStorage.setItem('madregot-seed', '424242'); localStorage.setItem('madregot', JSON.stringify(s)); }, student(GRADE[topic]));
      await page.goto(`${BASE}#/learn/${topic}/${level}/A`); await page.reload();
      await page.locator('.step-player').waitFor();
      for (let i = 0; i < 20; i += 1) {
        await page.waitForFunction(() => !!window.__madregotStep);
        const st = await page.evaluate(() => window.__madregotStep);
        const idx = Number(await page.locator('.sp-progress').getAttribute('aria-valuenow'));
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const vis = page.locator('.sp-step [data-region="visual"]').last();
        const hgt = (await vis.count()) ? (await vis.boundingBox())?.height : 0;
        const label = (await page.locator('.sp-step [data-region="visual"] [role="img"]').count()) ? await page.locator('.sp-step [data-region="visual"] [role="img"]').first().getAttribute('aria-label') : '';
        const over = await page.evaluate(() => document.scrollingElement.scrollWidth - document.documentElement.clientWidth);
        report.push(`${topic}:${level}#${idx}\t${st.kind}\t${Math.round(hgt)}\t${over > 0 ? `OVERFLOW ${over}` : ''}\t${label}`);
        await page.screenshot({ path: `${out}/${topic}${level}-${String(idx).padStart(2, '0')}.png` });
        if (st.kind === 'explore') { await page.waitForFunction(() => window.__madregotSolveStep?.forStep === window.__madregotStep); await page.evaluate(() => window.__madregotSolveStep()); await page.locator('.lm-check').click(); }
        if (st.kind === 'predict') { await page.locator('.ls-choice').nth(st.answer).click(); await page.locator('.lm-check').click(); }
        const next = page.locator('.sp-next');
        const last = (await next.textContent()).includes('לדוגמה');
        if (last) break;
        await next.dispatchEvent('click');
        await page.waitForFunction((a) => document.querySelector('.sp-progress')?.getAttribute('aria-valuenow') !== a, String(idx));
      }
      if (errors.length) report.push(`ERRORS ${topic}:${level} ${errors.join(' | ')}`);
      await ctx.close();
    }
  }
  fs.writeFileSync(`${out}/report.tsv`, report.join('\n') + '\n');
  await browser.close();
})();
