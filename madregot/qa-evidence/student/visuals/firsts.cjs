// The first teaching step of every stair of the given topics, light and dark at 390x844, and the council's before/after
// (signed:1#0 at 390x664, 3x): node firsts.cjs <out> topic:n...
const { chromium } = require('/home/user/mathai-student/madregot/web/node_modules/playwright');
const fs = require('fs');
const [out, ...which] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:4232/';
const GRADE = { signed: '7', coord: '7', angles: '7', expr: '7', eq: '7', line: '8', pyth: '8', stats: '8', sys: '8' };
const student = (grade) => ({ state: { profile: { role: 'student', name: 'נועה', grade, know: 1 }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [], ai: { mode: 'server', apiUrl: '', key: '' }, path: {}, freezes: 0, goalXp: 50, sound: false, gaps: {}, placement: null }, version: 1 });
async function shoot(browser, route, grade, file, { w = 390, h = 844, scheme = 'light', dsf = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: dsf, locale: 'he-IL', colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('madregot', JSON.stringify(s)); }, student(grade));
  await page.goto(BASE + route); await page.reload();
  await page.locator('.step-player').waitFor();
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(350);
  await page.screenshot({ path: file });
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  for (const w of which) {
    const [topic, n] = w.split(':');
    for (let level = 1; level <= Number(n); level += 1) {
      for (const scheme of ['light', 'dark']) await shoot(browser, `#/learn/${topic}/${level}/A`, GRADE[topic], `${out}/${topic}${level}-first-${scheme}.png`, { scheme });
    }
  }
  if (which.some((w) => w.startsWith('signed'))) await shoot(browser, '#/learn/signed/1/A', '7', `${out}/council-after-signed1-0.png`, { w: 390, h: 664, dsf: 3 });
  await browser.close();
})();
