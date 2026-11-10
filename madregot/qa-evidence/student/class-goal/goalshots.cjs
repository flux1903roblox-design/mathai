// Screenshots of the class goal (STUDENT-4) against a fake server, for a look: node goalshots.cjs <outDir> [names...]
// Serve the e2e build first: (cd madregot/web && npx vite preview --outDir dist-test --port 4232 --host 127.0.0.1)
const { chromium } = require(require('path').join(__dirname, '../../../web/node_modules/playwright'));
const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(3);
const BASE = 'http://127.0.0.1:4232/';
const API = 'https://api.madregot.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const WEEK = '2026-11-01'; const LAST = '2026-10-25';
const goal = (o = {}) => ({ on: true, week: WEEK, target: 60, have: 23, mine: 4, reached: false, last: { week: LAST, target: 55, have: 61, reached: true, mine: 7 }, ...o });
const base = (extra = {}) => ({ state: { profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's9' }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [],
  ai: { mode: 'server', apiUrl: API, key: '', device: '' }, path: {}, freezes: 0, goalXp: 20, sound: false, gaps: {}, placement: null, nudges: { repairDismissed: null, pbWeek: null, goalSeen: { [LAST]: '2026-10-29' } }, ...extra }, version: 3 });
const teacher = { state: { profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7' }], active: 'K7Q2MD' }, ai: { mode: 'server', apiUrl: API, key: '', device: '' } }, version: 3 };
const shots = [
  { name: 'quests-mid', route: '#/quests', state: base(), g: goal(), card: true },
  { name: 'quests-new-week', route: '#/quests', state: base(), g: goal({ have: 0, mine: 0 }), at: '2026-11-03T10:00:00', card: true },
  { name: 'quests-reached', route: '#/quests', state: base({ nudges: { goalSeen: { [WEEK]: '2026-11-05', [LAST]: '2026-10-29' } } }), g: goal({ have: 64, mine: 9, reached: true, last: null }), card: true, wait: 2500 },
  { name: 'quests-reached-not-mine', route: '#/quests', state: base(), g: goal({ have: 64, mine: 0, reached: true, last: null }), card: true, wait: 2500 },
  { name: 'moment', route: '#/', state: base(), g: goal({ have: 64, mine: 9, reached: true, last: null }), wait: 1500 },
  { name: 'learn-side-desktop', route: '#/', state: base(), g: goal(), viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'teacher-students', route: '#/teacher?tab=students', state: teacher, g: goal(), teacherCard: true },
  { name: 'teacher-head', route: '#/teacher', state: teacher, g: goal() },
  { name: 'qa-mid-solo', route: '#/quests?qa-goal=mid', state: { state: { ...base().state, profile: { role: 'student', name: 'נועה', grade: '7', know: 1 }, ai: { mode: 'server', apiUrl: '', key: '', device: '' } }, version: 3 }, g: null, card: true },
];
(async () => {
  const browser = await chromium.launch();
  for (const s of shots.filter((x) => !only.length || only.includes(x.name))) {
    for (const scheme of s.schemes || ['light', 'dark']) {
      for (const vp of s.viewport ? [{ n: '', v: s.viewport }] : [{ n: '-390', v: { width: 390, height: 844 } }, { n: '-320', v: { width: 320, height: 568 } }]) {
        const ctx = await browser.newContext({ viewport: vp.v, isMobile: s.mobile !== false, hasTouch: s.mobile !== false, deviceScaleFactor: 1, locale: 'he-IL', colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await ctx.newPage();
        await page.clock.setFixedTime(new Date(s.at || '2026-11-05T10:00:00'));
        await page.route(`${API}/**`, async (route) => {
          const req = route.request();
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
          const path = new URL(req.url()).pathname;
          const reply = (code, data) => route.fulfill({ status: code, contentType: 'application/json', headers: CORS, body: JSON.stringify(data) });
          if (path === '/api/class/goal') return reply(200, s.g);
          if (path === '/api/progress') return reply(200, { saved: 0, steps: 0 });
          if (path === '/api/ai/status') return reply(200, { paywall: false, tier: 'open', kinds: ['explain', 'chat'], groups: { all: { left: 40, limit: 40 } }, aiReady: true });
          if (path === '/api/teacher/dashboard') return reply(200, { class: { code: 'K7Q2MD', name: 'ז׳3', grade: '7', teacherName: 'רונית' }, today: '2026-11-05', joinLocked: false, help: [], mistakes: [], exams: [], goal: { on: true, week: WEEK, target: 60, have: 23, reached: false, custom: null }, students: ['יואב', 'דנה', 'עומר'].map((name, i) => ({ id: `s${i}`, name, lastSeen: '2026-11-05T08:00:00Z', lastPractice: '2026-11-05T08:00:00Z', pinReset: false, today: { n: 3, ok: 3, first: 2, minutes: 4 }, week: { n: 10, first: 8, days: 2, minutes: 20 }, levels: {} })) });
          return reply(404, { error: 'not_found' });
        });
        await page.goto(BASE + 'about');
        await page.evaluate((st) => { localStorage.clear(); localStorage.setItem('madregot-debug', '1'); localStorage.setItem('madregot', JSON.stringify(st)); }, s.state);
        await page.goto(BASE + s.route);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(s.wait || 1200);
        if (s.card) { const c = page.locator('.class-goal-card'); if (await c.count()) await c.evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); }
        if (s.teacherCard) { const c = page.locator('.t-goal'); if (await c.count()) await c.evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); }
        await page.screenshot({ path: `${out}/${s.name}${vp.n}-${scheme}.png` });
        await ctx.close();
      }
    }
  }
  await browser.close();
})();
