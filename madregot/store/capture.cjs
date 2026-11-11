// Pictures of the real app, for the landing pages (STUDENT-13) and the store listings (STUDENT-12): the no-server build
// (VITE_API_URL=none), driven by Playwright, in light mode. Nothing on a screen is drawn by hand; where a screen needs a
// server (the teacher's board), page.route answers with a synthetic class, as the e2e tests do.
//
//   node madregot/store/capture.cjs landing [--dist <built app>]
//     → madregot/web/landing/img/
//         phone-rescue.webp, phone-teacher.webp   the Exam Rescue plan and the teacher's board in a phone, 1080 wide,
//                                                 at most 70 KB (WebP encoded in the page by Chromium's canvas: no
//                                                 image package)
//         og-mivchan.png, og-pilot.png            the link previews (WhatsApp, Facebook), 1200 × 630
//   node madregot/store/capture.cjs store [--dist <built app>] [--raw <folder>] [--no-frames] [--only <scene>]
//     → the five scenes (SCENES below) at 390 × 844 at 3x, and the home path in dark, as raw-<n>-<scene>.png in --raw
//       (else a temporary folder); then frames.cjs makes the store images in store/apple/ and store/play/
//     → web/public/screens/narrow-1…3.png (1080 × 2340) and wide-1.png (1920 × 1080), the web manifest's screenshots
//     --only <scene> takes that one screen into --raw and stops (to look at it after a screen changes)
//
// It builds the app into a temporary folder unless --dist names a build made with VITE_API_URL=none (e.g. web/dist-test),
// serves it with vite preview on CAPTURE_PORT (default 4238) and stops it at the end. Run it again after a screen it
// shows changes, then npm run build (landing-build copies the files into dist/l/).
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const WEB = path.resolve(__dirname, '../web');
const { chromium } = createRequire(path.join(WEB, 'package.json'))('@playwright/test');
const PORT = Number(process.env.CAPTURE_PORT) || 4238;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = path.join(WEB, 'landing/img');
const MAX_WEBP = 70 * 1024;
// a Thursday, as the e2e tests use; the exam is the Thursday after ("מבחן ביום חמישי?")
const NOW = new Date('2026-11-05T10:00:00+02:00');
const EXAM_DAY = '2026-11-12';
const API = 'https://api.madregot.test'; // answered by page.route only: never a real address

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

/** A saved student, as the app stores it (zustand persist, key 'madregot'). */
const student = (grade, extra = {}) => ({
  state: {
    profile: { role: 'student', name: 'נועה', grade, know: 1 }, progress: {}, days: {}, xp: 0, mistakes: {}, outbox: [],
    ai: { mode: 'server', apiUrl: '', key: '' }, path: {}, freezes: 0, goalXp: 20, sound: false, gaps: {}, placement: null, ...extra,
  },
  version: 1,
});

// ---------- the app, built and served ----------
function build() {
  const given = arg('--dist');
  if (given) return { dir: path.resolve(given), cleanup: () => {} };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'madregot-capture-'));
  const r = spawnSync('npx', ['vite', 'build', '--base', './', '--outDir', dir, '--emptyOutDir'], { cwd: WEB, stdio: 'inherit', env: { ...process.env, VITE_API_URL: 'none' } });
  if (r.status !== 0) throw new Error('vite build failed');
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

async function serve(dir) {
  const child = spawn('npx', ['vite', 'preview', '--outDir', dir, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: WEB, stdio: 'ignore', detached: true });
  const stop = () => { try { process.kill(-child.pid); } catch { /* already gone */ } };
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(BASE)).ok) return stop; } catch { /* not up yet */ }
    await wait(200);
  }
  stop();
  throw new Error(`vite preview did not answer on ${BASE}`);
}

/** A page at a phone's size, with a saved state, a fixed clock and repeatable exercises, on `route`. */
async function open(browser, state, route, { width = 390, height = 844, scale = 3, seed = '5', setup, scheme = 'light', mobile = true } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile, locale: 'he-IL', timezoneId: 'Asia/Jerusalem',
    colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  if (setup) await setup(page);
  await page.goto(BASE);
  // madregot-debug: the exercise on screen is readable (window.__madregotItem), as in the e2e tests
  await page.evaluate(([s, sd]) => {
    localStorage.clear(); localStorage.setItem('madregot-debug', '1'); localStorage.setItem('madregot-seed', sd);
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
  }, [state, seed]);
  await page.goto(`${BASE}#${route}`);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** Entrances and fades at their end, as people see the screen a moment later. */
async function settle(page) {
  await wait(1200);
  await page.evaluate(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch { /* an endless one */ } } });
  await wait(300);
}

// ---------- the landing pages ----------
const at = '2026-11-04T16:00:00.000Z';
/** A grade 7 student with a test next Thursday, after the short check: some stairs ready, one shaky, one a gap. */
const rescueStudent = () => ({ ...student('7', {
  days: { '2026-11-04': { lessons: 1, xp: 15, q: 10, ok: 7 } },
  learn: {
    skills: {}, events: [], missions: {}, miscon: {},
    exam: {
      grade: '7', date: EXAM_DAY, skills: ['signed:1', 'signed:2', 'signed:3', 'coord:1', 'coord:2'], confidence: 2, minutes: 15, createdAt: at,
      diagnostic: {
        'signed:1': { asked: 2, right: 2, at }, 'signed:2': { asked: 2, right: 1, at }, 'signed:3': { asked: 2, right: 0, at },
        'coord:1': { asked: 2, right: 2, at }, 'coord:2': { asked: 2, right: 1, at },
      },
    },
  },
}), version: 4 }); // version 4: the store keeps learn as it is (an older version rebuilds it)

// a synthetic class: first names only, as the app keeps them
const NAMES = ['נועה', 'יואב', 'דנה', 'עומר', 'מאיה', 'איתי', 'שירה', 'אורי', 'תמר', 'רועי', 'ליה', 'אלון', 'יעל', 'נדב', 'הילה', 'עידו', 'רוני', 'גיא', 'אביגיל', 'עמית', 'שקד', 'אריאל', 'טל', 'ניר'];
const ago = (n) => new Date(NOW.getTime() - n * 864e5).toISOString();
const teacherBoard = () => ({
  class: { code: 'K7Q2MD', name: 'ז׳3', grade: '7', teacherName: 'רונית' }, today: '2026-11-05', joinLocked: false, help: [], exams: [],
  goal: { on: true, week: '2026-11-01', target: 100, have: 64, reached: false, custom: null },
  mistakes: [
    { topic: 'signed', cat: 'minus-minus', students: 7, names: ['יואב', 'דנה', 'איתי', 'תמר', 'אלון', 'הילה', 'גיא'] },
    { topic: 'signed', cat: 'neg-compare', students: 4, names: ['מאיה', 'אורי', 'רוני', 'שקד'] },
    { topic: 'coord', cat: 'swap', students: 3, names: ['עומר', 'ליה', 'טל'] },
  ],
  students: NAMES.map((name, i) => {
    const idle = i % 8 === 7;
    return {
      id: `s${i}`, name, lastSeen: ago(idle ? 5 : i % 3), lastPractice: ago(idle ? 5 : i % 3), pinReset: false,
      today: { n: i % 3 === 0 && !idle ? 8 : 0, ok: 6, first: 5, minutes: 9 },
      week: { n: idle ? 0 : 14 + (i % 5) * 3, first: idle ? 0 : 10 + (i % 4) * 2, days: idle ? 0 : 2 + (i % 3), minutes: 35 }, levels: {},
    };
  }),
});
const teacher = () => ({
  ...student('7', {
    profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'tkey-demo', className: 'ז׳3', grade: '7' }], active: 'K7Q2MD' },
    ai: { mode: 'server', apiUrl: API, key: '' },
  }),
  version: 4, // as saved by this version of the app: an older one would lose the server's address
});
async function fakeServer(page) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const p = new URL(req.url()).pathname;
    const reply = (data) => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(data) });
    if (p === '/api/teacher/dashboard') return reply(teacherBoard());
    if (p === '/api/ai/status') return reply({ paywall: false, tier: 'open', kinds: [], groups: {}, aiReady: true });
    return route.fulfill({ status: 204, headers: cors });
  });
}

/** PNG bytes → WebP bytes, encoded by the page's own canvas, at the best quality that fits `max` bytes. */
async function toWebp(page, png, max = MAX_WEBP) {
  const b64 = await page.evaluate(async ([src, limit]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    for (let q = 0.9; q >= 0.3; q -= 0.04) {
      const url = c.toDataURL('image/webp', q);
      if (!url.startsWith('data:image/webp')) throw new Error('this browser cannot encode WebP');
      const out = url.slice(url.indexOf(',') + 1);
      if (out.length * 0.75 <= limit) return out;
    }
    throw new Error('the picture does not fit in the size limit');
  }, [png.toString('base64'), max]);
  return Buffer.from(b64, 'base64');
}

const FRAME_W = 1080;
const FRAME_H = 1520;
/**
 * A phone around the top of a screen, running off the bottom edge, on a transparent ground: 1080 × 1520. The screen
 * is the app at 390 px wide (3x), so about 560 px of the app show.
 */
const phoneHtml = (shot) => `<!doctype html><html><head><style>
html, body { margin: 0; width: ${FRAME_W}px; height: ${FRAME_H}px; background: transparent; overflow: hidden; }
.phone { position: absolute; left: 24px; right: 24px; top: 24px; bottom: -80px; border-radius: 132px; background: #14161a; padding: 30px; box-shadow: 0 0 0 4px #3a404c; }
.screen { width: 100%; height: 100%; border-radius: 104px; overflow: hidden; background: #fff; }
.screen img { display: block; width: 100%; height: auto; }
</style></head><body><div class="phone"><div class="screen"><img src="data:image/png;base64,${shot.toString('base64')}"></div></div></body></html>`;

async function phoneShot(browser, shot) {
  const ctx = await browser.newContext({ viewport: { width: FRAME_W, height: FRAME_H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(phoneHtml(shot));
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const png = await page.screenshot({ omitBackground: true });
  const webp = await toWebp(page, png);
  await ctx.close();
  return webp;
}

/** @font-face rules for the app's Rubik files in a build, as file:// addresses (the preview pages are local files). */
function rubikFaces(dist) {
  const dir = path.join(dist, 'assets');
  return fs.readdirSync(dir).filter((f) => /^rubik-(hebrew|latin)-wght-normal-.*\.woff2$/.test(f))
    .map((f) => `@font-face { font-family: 'Rubik Variable'; font-weight: 300 900; src: url(file://${path.join(dir, f)}) format('woff2'); }`).join('\n');
}

/** The link preview: the page's question on the right, the phone on the left, in the app's colours and font. */
const ogHtml = (shot, title, line, fonts, name) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
${fonts}
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body { background: #eaf1ff; font-family: 'Rubik Variable', sans-serif; color: #14161a; position: relative; }
.copy { position: absolute; top: 0; bottom: 0; right: 72px; width: 600px; display: flex; flex-direction: column; justify-content: center; gap: 24px; }
.brand { font-size: 34px; font-weight: 700; color: #1a5cf5; }
h1 { margin: 0; font-size: 64px; line-height: 1.12; font-weight: 800; letter-spacing: -0.01em; text-wrap: balance; }
p { margin: 0; font-size: 30px; line-height: 1.35; color: #565b66; }
.phone { position: absolute; left: 96px; top: 64px; width: 360px; height: 640px; border-radius: 52px; background: #14161a; padding: 12px; box-shadow: 0 0 0 2px #3a404c; }
.screen { width: 100%; height: 100%; border-radius: 42px; overflow: hidden; background: #fff; }
.screen img { display: block; width: 100%; height: auto; }
</style></head><body><div class="copy"><span class="brand">${name}</span><h1>${title}</h1><p>${line}</p></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${shot.toString('base64')}"></div></div></body></html>`;

async function ogShot(browser, shot, title, line, dist) {
  const { APP_NAME } = await import(pathToFileURL(path.resolve(__dirname, '../shared/brand.js')).href);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const file = path.join(os.tmpdir(), `madregot-og-${process.pid}.html`); // a local file, so the fonts load from the build
  fs.writeFileSync(file, ogHtml(shot, title, line, rubikFaces(dist), APP_NAME));
  await page.goto(`file://${file}`);
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
  const png = await page.screenshot();
  fs.rmSync(file, { force: true });
  await ctx.close();
  return png;
}

async function landing(browser, dist) {
  fs.mkdirSync(OUT, { recursive: true });
  // 1. Exam Rescue: the plan for next Thursday's test, after the short check
  let page = await open(browser, rescueStudent(), '/rescue');
  await page.locator('.rescue-plan .readiness').waitFor();
  await settle(page);
  const rescue = await page.screenshot();
  await page.context().close();
  // 2. the teacher's board: the "מחר" view of a synthetic class
  page = await open(browser, teacher(), '/teacher', { setup: fakeServer });
  await page.locator('.t-kpis').waitFor();
  await settle(page);
  const board = await page.screenshot();
  await page.context().close();

  const files = {
    'phone-rescue.webp': await phoneShot(browser, rescue),
    'phone-teacher.webp': await phoneShot(browser, board),
    'og-mivchan.png': await ogShot(browser, rescue, 'מבחן במתמטיקה ביום חמישי?', 'תוכנית חזרה לימים שנשארו, תרגול שנבדק במקום והסבר לכל טעות. כיתות ז׳ וח׳.', dist),
    'og-pilot.png': await ogShot(browser, board, 'פיילוט של שבועיים בכיתה אחת. חינם.', 'התלמידים מתרגלים בבית, ואתם רואים כל בוקר מה כדאי לחזור עליו.', dist),
  };
  for (const [name, buf] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(`${path.join(OUT, name)}  ${(buf.length / 1024).toFixed(1)} KB`);
  }
}

// ---------- the store screens (STUDENT-12 §5; frames.cjs puts them in frames) ----------
// Five scenes, the same in every set, in the order of the listing (frames.cjs FRAMES has the headlines):
//   1 mistake    a coordinates exercise answered with x and y swapped: "עוד לא" and "מה כנראה קרה"
//   2 numberline the number line, the marker moved +5 by hand
//   3 map        the home path, each unit in its own colour
//   4 rescue     the Exam Rescue plan for next Thursday's test
//   5 wardrobe   מדי's wardrobe, with colours and accessories earned from what was learned
const daysAgo = (n) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
const mastered = (levels) => ({ parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) });
/** A grade 7 student two weeks in: signed numbers mastered, coordinates half way, angles started; four days in a row. */
const lived = () => {
  const days = {};
  [0, 1, 2, 3, 6, 7, 8].forEach((n) => { days[daysAgo(n)] = { lessons: 2, xp: 30, q: 16, ok: 14 }; });
  return student('7', {
    days, xp: 420, freezes: 1, lastTopic: 'coord',
    path: { signed: mastered([1, 2, 3, 4, 5]), coord: { parts: { 1: 2, 2: 2, 3: 1 }, reviews: 0, jumped: 0, done: { 1: 'mastered', 2: 'mastered' } } },
  });
};
/** מדי dressed: two units mastered (two colours), two half units (two accessories), violet on and a crown. */
const dressed = () => student('7', {
  path: { signed: mastered([1, 2, 3, 4, 5]), angles: mastered([1, 2, 3]), stats: mastered([1, 2, 3, 4, 5]) },
  look: { color: 'fuchsia', head: 'protractor-crown', face: null, neck: null, body: null, earned: ['sky', 'fuchsia'], seen: ['sky', 'fuchsia', 'protractor-crown', 'bars-pin'], earnedAt: {} },
});

const KEY_NAME = { '-': 'מינוס', '/': 'שבר', '.': 'נקודה עשרונית' };
async function typeOn(page, value) {
  for (const ch of String(value)) await page.getByRole('button', { name: KEY_NAME[ch] || ch, exact: true }).click();
}
/** The lesson on a seed whose first exercise is the one wanted (exercises are drawn at random; seeds repeat). */
async function lessonOn(browser, route, want, view) {
  for (let sd = 1; sd <= 60; sd += 1) {
    const p = await open(browser, student('7'), route, { ...view, seed: String(sd) });
    await p.waitForFunction(() => !!window.__madregotItem, null, { timeout: 15000 });
    const it = await p.evaluate(() => window.__madregotItem);
    if (it && want(it)) return { page: p, it };
    await p.context().close();
  }
  throw new Error(`no seed opens ${route} on the exercise wanted`);
}

const SCENES = {
  async mistake(browser, view) {
    // "read the point": the student types y for x and x for y
    const { page, it } = await lessonOn(browser, '/lesson/coord/1', (x) => x.form === 'pt' && /^cp1:/.test(x.key) && x.answer[0] !== x.answer[1] && x.answer[0] > 0 && x.answer[1] < 0, view);
    for (const [slot, v] of [['x', it.answer[1]], ['y', it.answer[0]]]) { await page.locator(`#slot-${slot}`).click(); await typeOn(page, v); }
    await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
    await page.locator('section.fb-retry').getByText('מה כנראה קרה', { exact: false }).waitFor();
    return page;
  },
  async numberline(browser, view) {
    const { page } = await lessonOn(browser, '/lesson/signed/1', (x) => x.manip?.kind === 'numberline' && x.answer - x.manip.from === 5, view);
    await page.evaluate(() => window.__madregotSolve(true));
    await wait(700);
    return page;
  },
  async map(browser, view) {
    const page = await open(browser, lived(), '/', view);
    await page.locator('.unit').nth(1).waitFor();
    // the second unit's banner near the top, the first unit's last stops above it
    await page.locator('.unit').nth(1).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3));
    await wait(600);
    return page;
  },
  async rescue(browser, view) {
    const page = await open(browser, rescueStudent(), '/rescue', view);
    await page.locator('.rescue-plan .readiness').waitFor();
    return page;
  },
  async wardrobe(browser, view) {
    const page = await open(browser, dressed(), '/me/madi', view);
    await page.getByRole('radiogroup', { name: 'צבע' }).waitFor();
    return page;
  },
};

/** One scene as a PNG at a size: { width, height } in CSS pixels at `scale`, light unless scheme is 'dark'. */
async function shoot(browser, name, view) {
  const page = await SCENES[name](browser, view);
  await settle(page);
  const png = await page.screenshot();
  await page.context().close();
  return png;
}

const PHONE = { width: 390, height: 844, scale: 3 }; // the screen inside the store frames
const NARROW = { width: 360, height: 780, scale: 3 }; // the web manifest's screenshots: 1080 × 2340
const WIDE = { width: 1280, height: 720, scale: 1.5, mobile: false }; // 1920 × 1080, the map on a computer
const PUBLIC_SCREENS = path.join(WEB, 'public/screens');

async function storeScreens(browser, raw) {
  fs.mkdirSync(raw, { recursive: true });
  const only = arg('--only'); // one scene again, in the phone size only (to check it after a screen changes)
  if (only) {
    fs.writeFileSync(path.join(raw, `raw-${only}.png`), await shoot(browser, only, { ...PHONE, scheme: arg('--scheme') || 'light' }));
    return false;
  }
  const order = ['mistake', 'numberline', 'map', 'rescue', 'wardrobe'];
  for (const [i, name] of order.entries()) {
    fs.writeFileSync(path.join(raw, `raw-${i + 1}-${name}.png`), await shoot(browser, name, PHONE));
    console.log(`raw-${i + 1}-${name}.png`);
  }
  fs.writeFileSync(path.join(raw, 'raw-3-map-dark.png'), await shoot(browser, 'map', { ...PHONE, scheme: 'dark' }));
  // the web manifest's screenshots (STUDENT-10): the bare screens, no frame, as the install sheet shows them
  fs.mkdirSync(PUBLIC_SCREENS, { recursive: true });
  const manifest = [['narrow-1.png', 'numberline', NARROW], ['narrow-2.png', 'mistake', NARROW], ['narrow-3.png', 'map', NARROW], ['wide-1.png', 'map', WIDE]];
  for (const [file, name, view] of manifest) {
    fs.writeFileSync(path.join(PUBLIC_SCREENS, file), await shoot(browser, name, view));
    console.log(path.join(PUBLIC_SCREENS, file));
  }
  return true;
}

(async () => {
  const mode = process.argv[2];
  if (!['landing', 'store'].includes(mode)) {
    console.error('usage: node madregot/store/capture.cjs landing|store [--dist <a build made with VITE_API_URL=none>] [--raw <folder>] [--no-frames]');
    process.exit(2);
  }
  const { dir, cleanup } = build();
  let stop = () => {};
  let browser;
  try {
    stop = await serve(dir);
    browser = await chromium.launch();
    if (mode === 'landing') await landing(browser, dir);
    else {
      // the bare screens go to --raw (kept) or a temporary folder; frames.cjs makes the store images from them
      const raw = arg('--raw') ? path.resolve(arg('--raw')) : fs.mkdtempSync(path.join(os.tmpdir(), 'madregot-raw-'));
      try {
        const all = await storeScreens(browser, raw);
        if (all && !process.argv.includes('--no-frames')) await require('./frames.cjs').makeFrames(browser, raw, dir);
      } finally {
        if (!arg('--raw')) fs.rmSync(raw, { recursive: true, force: true });
      }
    }
    console.log('captured');
  } finally {
    await browser?.close();
    stop();
    cleanup();
  }
})().catch((e) => { console.error(e); process.exit(1); });
