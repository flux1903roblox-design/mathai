// The real screens behind the store frames, at iPhone 6.7" resolution (430 x 932 at 3x = 1290 x 2796).
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8950/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
const st = (g, extra = {}) => ({ state: { profile: { role: 'student', name: 'נועה', grade: g, know: 1 }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [], ai: { mode: 'server', apiUrl: '', key: '' }, path: {}, freezes: 0, goalXp: 20, sound: false, gaps: {}, placement: null, ...extra }, version: 1 });
const lived = () => { const days = {}; [0, 1, 2, 3].forEach((n) => { days[day(n)] = { lessons: 2, xp: 30, q: 16, ok: 14 }; }); return st('7', { days, xp: 260, freezes: 1, lastTopic: 'signed', path: { signed: { parts: { 1: 2, 2: 2, 3: 1 } } } }); };
async function open(b, s, route, seed = '5') {
  const c = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'he-IL' });
  const p = await c.newPage();
  await p.goto(BASE); await p.evaluate(([x, sd]) => { localStorage.clear(); localStorage.setItem('madregot-seed', sd); if (x) localStorage.setItem('madregot', JSON.stringify(x)); }, [s, seed]);
  await p.goto(BASE + '#' + route); await p.reload(); await wait(1300);
  return p;
}
async function onKind(b, g, route, want) {
  for (let sd = 1; sd <= 40; sd++) { const p = await open(b, st(g), route, String(sd)); const it = await p.evaluate(() => window.__madregotItem); if (it && want(it)) return p; await p.context().close(); }
  throw new Error('not reached ' + route);
}
(async () => {
  const b = await chromium.launch();
  // 1. the number line, moved by hand
  let p = await onKind(b, '7', '/lesson/signed/1?part=1', (it) => it.manip?.kind === 'numberline');
  await p.evaluate(() => window.__madregotSolve(true)); await wait(600);
  await p.screenshot({ path: 'raw-1-numberline.png' }); await p.context().close();
  // 2. the map, at the first world
  p = await open(b, lived(), '/');
  await p.locator('.unit').first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64)); await wait(800);
  await p.screenshot({ path: 'raw-2-map.png' }); await p.context().close();
  // 3. a hint drawn on the triangle
  p = await onKind(b, '7', '/lesson/angles/3?part=1', (it) => it.manip?.kind === 'triangle');
  await p.getByRole('button', { name: 'רמז', exact: true }).click(); await wait(800);
  await p.screenshot({ path: 'raw-3-hint.png' }); await p.context().close();
  // 4. the climb at the end of a lesson that finished a stair
  p = await open(b, st('7', { path: { coord: { parts: { 1: 2, 2: 1 } } } }), '/lesson/coord/2?part=2', '99');
  for (let k = 0; k < 24 && !(await p.locator('.done-screen').count()); k++) {
    const it = await p.evaluate(() => window.__madregotItem);
    if (it.form === 'manip') await p.evaluate(() => window.__madregotSolve(true));
    else if (it.form === 'mc') await p.locator('.choice').nth(it.answer).click();
    else { const names = it.form === 'pt' ? ['x', 'y'] : it.form === 'line' ? ['m', 'b'] : ['v']; const vals = it.form === 'pt' ? it.answer : it.form === 'line' ? [it.answer.m, it.answer.b] : [it.answer]; for (let j = 0; j < names.length; j++) await p.locator('#slot-' + names[j]).fill(String(vals[j])); }
    await p.getByRole('button', { name: 'בדיקה', exact: true }).first().click(); await wait(250);
    await p.locator('section.fb .fb-actions .btn').click(); await wait(350);
    if (await p.locator('.combo-pop').count()) { await p.locator('.combo-pop').click(); await wait(250); }
  }
  await wait(2600); await p.screenshot({ path: 'raw-4-climb.png' }); await p.context().close();
  // 5. the topics, each with its world
  p = await open(b, lived(), '/topics'); await wait(500);
  await p.screenshot({ path: 'raw-5-topics.png' }); await p.context().close();
  await b.close(); console.log('captured');
})();
