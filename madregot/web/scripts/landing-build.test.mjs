// The landing pages (STUDENT-13), as `npm run build` makes them: every slot filled, the app's own tokens, the real
// prices and topics, small enough for a phone on a slow line, and readable by a screen reader.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { topicsFor } from '@/content/index.js';
import { GOALS } from '@/lib/quests.js';
import { LIST_PRICES, formatAgorot, vatLine } from '@/lib/price.js';
import { APP_NAME } from '../../shared/brand.js';
import { WEB, IMAGES, buildLanding, imageSize, wranglerVars, repoCode, renderClaims, render, isolateLtr, saleVars, priceLine, passLine } from './landing-build.mjs';
import { soldOnline } from '../../shared/sold.js';
import { CLAIMS, CLAIM, claimStatus, claimData } from '@/content/claims.js';
import { codeWith, MERGED } from '@/lib/testing/claimCode.js';

// an owner's build that sells both family plans online (Grow, with the permission to stop a standing order)
const ENV = {
  PUBLIC_URL: 'https://madregot.example.test/', CONTACT_EMAIL: 'hello@example.test', BUSINESS_NAME: 'מדרגות & שות׳ <בע״מ>',
  API_BASE: 'https://api.example.test', VITE_API_URL: 'none', BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'on',
};
const read = (...p) => readFileSync(join(...p), 'utf8');
const escHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** What appData() hands buildLanding, with the real claims module (the tests' fixture app keeps the rest small). */
const DATA = await claimData();
const claimsApp = { status: claimStatus, all: CLAIMS.map((c) => c.id), data: DATA };
const smallApp = () => ({ topics: { 7: ['א'], 8: ['ב'] }, minutes: [5, 10], madi: { small: '<svg></svg>', big: '<svg></svg>' }, price: { LIST_PRICES, formatAgorot, vatLine }, claims: claimsApp });
/** The claim ids a template names: {{CLAIM id}}, {{#CLAIM id}} and {{CLAIMS id …}}. */
const namedIn = (tpl) => [...tpl.matchAll(/\{\{#?CLAIMS? ([\w -]+)\}\}/g)].flatMap((m) => m[1].trim().split(/\s+/));
/** The product names the public pages never use (STUDENT-17: comparisons stay in docs/POSITIONING.md). */
const RIVALS = [/libri/i, /ליברי/, /vimi/i, /וימי/, /chatgpt/i, /gemini/i, /photomath/i, /matific/i, /מטיפיק/, /go ?math/i, /mathins/i, /kedmathic/i, /khan/i];
/** --name: value pairs of a CSS block, comments out and spaces normalised, in order. */
const decls = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;}]+)/g)].map((m) => [m[1], m[2].replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim()]);
const fakeDist = () => {
  const dist = mkdtempSync(join(tmpdir(), 'landing-'));
  mkdirSync(join(dist, 'assets'));
  // the app's Rubik files, as vite names them
  writeFileSync(join(dist, 'assets', 'rubik-hebrew-wght-normal-AbC123.woff2'), 'x');
  writeFileSync(join(dist, 'assets', 'rubik-latin-wght-normal-dEf456.woff2'), 'x');
  return dist;
};

let dist;
let page;
beforeAll(() => {
  dist = fakeDist();
  // the real command, as npm run build runs it (it reads the topics and מדי from the app through Vite)
  execFileSync(process.execPath, ['scripts/landing-build.mjs', dist], { cwd: WEB, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...ENV }, stdio: 'pipe' });
  page = { mivchan: read(dist, 'mivchan/index.html'), pilot: read(dist, 'pilot/index.html') };
}, 60_000);
afterAll(() => { if (dist) rmSync(dist, { recursive: true, force: true }); });

describe('landing-build', () => {
  it('writes the two pages, their files, the sitemap and robots.txt', () => {
    for (const f of ['mivchan/index.html', 'pilot/index.html', 'l/landing.css', 'l/count.js', 'robots.txt', 'sitemap.xml', ...IMAGES.map((i) => `l/${i}`)]) {
      expect(existsSync(join(dist, f)), f).toBe(true);
    }
    expect(read(dist, 'sitemap.xml')).toContain('<loc>https://madregot.example.test/mivchan/</loc>');
    expect(read(dist, 'sitemap.xml')).toContain('<loc>https://madregot.example.test/pilot/</loc>');
    expect(read(dist, 'robots.txt')).toContain('Sitemap: https://madregot.example.test/sitemap.xml');
  });

  it('leaves no slot unfilled', () => {
    for (const f of ['mivchan/index.html', 'pilot/index.html', 'l/landing.css', 'l/count.js', 'sitemap.xml']) expect(read(dist, f), f).not.toContain('{{');
  });

  it('copies the app\'s token blocks as they are (tokens.css :root, dark.css under the phone\'s dark setting)', () => {
    const css = read(dist, 'l/landing.css');
    const root = /:root\{[^}]*\}/.exec(css)[0];
    expect(css).toMatch(/@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{[^}]*\}\}/);
    const dark = /:root:not\(\[data-theme="light"\]\)\{[^}]*\}/.exec(css)[0];
    const srcRoot = /:root\s*\{[^}]*\}/.exec(read(WEB, 'src/styles/tokens.css').replace(/\/\*[\s\S]*?\*\//g, ''))[0];
    const srcDark = /:root:not\(\[data-theme="light"\]\)\s*\{[^}]*\}/.exec(read(WEB, 'src/styles/dark.css').replace(/\/\*[\s\S]*?\*\//g, ''))[0];
    expect(decls(root)).toEqual(decls(srcRoot));
    expect(decls(dark)).toEqual(decls(srcDark));
    expect(decls(root).length).toBeGreaterThan(80);
    // the app's own Rubik files, never a copy
    expect(css).toContain("url(../assets/rubik-hebrew-wght-normal-AbC123.woff2)");
    expect(css).toContain("url(../assets/rubik-latin-wght-normal-dEf456.woff2)");
    // landing.css's own rules use tokens only: no colour written by hand
    expect(read(WEB, 'landing/landing.css').replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b/i);
  });

  it('states the prices of lib/price.js, which are the Worker\'s own defaults, on the parents\' page only', () => {
    const billing = read(WEB, '../worker/src/billing.js');
    expect(billing).toContain(`'PRICE_FAMILY_MONTH_AGOROT', ${LIST_PRICES.month})`);
    expect(billing).toContain(`'PRICE_FAMILY_YEAR_AGOROT', ${LIST_PRICES.year})`);
    const toml = wranglerVars(read(WEB, '../worker/wrangler.toml'));
    expect(Number(toml.PRICE_FAMILY_MONTH_AGOROT)).toBe(LIST_PRICES.month);
    expect(Number(toml.PRICE_FAMILY_YEAR_AGOROT)).toBe(LIST_PRICES.year);
    expect(page.mivchan).toContain(`${formatAgorot(LIST_PRICES.month)} לחודש או ${formatAgorot(LIST_PRICES.year)} לשנה, כולל מע״מ. בלי התחייבות, מבטלים באתר.`);
    expect(formatAgorot(LIST_PRICES.month)).toBe('₪29.90');
    expect(formatAgorot(LIST_PRICES.year)).toBe('₪249');
    expect(page.pilot).not.toContain('₪');
    expect(page.pilot).not.toMatch(/מנוי|לחודש|לשנה/);
  });

  it('prices only the family plans sold online (COUNCIL2-30): Grow before the direct debit permission, the year alone and no "מבטלים באתר"; manual, none', async () => {
    const built = async (env) => {
      const other = fakeDist();
      try {
        const { warn, claims } = await buildLanding(other, { env: { ...ENV, ...env }, app: smallApp() });
        return { html: read(other, 'mivchan/index.html'), warn, cancel: claims.find((c) => c.id === 'cancel-web') };
      } finally { rmSync(other, { recursive: true, force: true }); }
    };
    const year = formatAgorot(LIST_PRICES.year); const month = formatAgorot(LIST_PRICES.month);
    // Grow with GROW_DIRECT_DEBIT_API "off": the one-year plan is sold (one charge), the monthly one is not
    const once = await built({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'off' });
    expect(once.html).toContain(`<p class="price">${year} לשנה, כולל מע״מ. לשנה אחת, לא מתחדש מעצמו.</p>`);
    expect(once.html).not.toContain(month);
    expect(once.html).not.toContain('לחודש');
    expect(once.html).not.toContain('מבטלים באתר');
    expect(once.cancel).toMatchObject({ visible: false, why: 'not in this deployment: a plan that renews, sold online' });
    // the manual provider sells nothing online: no price at all, and the build says so
    const manual = await built({ BILLING_PROVIDER: 'manual' });
    expect(manual.html).not.toContain('class="price"');
    expect(manual.html).not.toContain('₪');
    expect(manual.html).not.toContain('מבטלים באתר');
    expect(manual.warn).toContain('no family plan is sold online with BILLING_PROVIDER "manual": the parents\' page shows no price');
    // the settings come from the build env first, then wrangler.toml (the owner's [vars])
    const toml = wranglerVars(read(WEB, '../worker/wrangler.toml'));
    expect(saleVars({}, toml)).toEqual({ BILLING_PROVIDER: toml.BILLING_PROVIDER || 'manual', GROW_DIRECT_DEBIT_API: toml.GROW_DIRECT_DEBIT_API || 'off', PRICE_EXAM_PASS_AGOROT: toml.PRICE_EXAM_PASS_AGOROT || '' });
    expect(saleVars({ BILLING_PROVIDER: 'grow' }, { BILLING_PROVIDER: 'manual', GROW_DIRECT_DEBIT_API: 'on' })).toEqual({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'on', PRICE_EXAM_PASS_AGOROT: '' });
    // the sentence for each case
    const fmt = { month, year, vat: 'כולל מע״מ' };
    expect(priceLine(soldOnline({ BILLING_PROVIDER: 'test' }), fmt)).toBe(`${month} לחודש או ${year} לשנה, כולל מע״מ.`);
    expect(priceLine({ family_month: true, family_year: false }, fmt)).toBe(`${month} לחודש, כולל מע״מ.`);
    expect(priceLine(soldOnline({ BILLING_PROVIDER: 'manual' }), fmt)).toBe('');
  });

  it('prints the exam pass from the same rule (COUNCIL2-33): only once the owner set its price, sold through Grow as one charge, never with the manual provider', async () => {
    const built = async (env) => {
      const other = fakeDist();
      try { return read((await buildLanding(other, { env: { ...ENV, ...env }, app: smallApp() }), other), 'mivchan/index.html'); } finally { rmSync(other, { recursive: true, force: true }); }
    };
    const toml = wranglerVars(read(WEB, '../worker/wrangler.toml'));
    // The price is the owner's decision: the repository ships none (the review: a placeholder of ₪39 was on the public
    // page as a real price). With none, the real build says nothing about the pass, and nothing sells it.
    expect(toml.PRICE_EXAM_PASS_AGOROT).toBe('');
    expect(page.mivchan).not.toContain('חבילה ל־30 יום');
    expect(page.mivchan).not.toContain('₪39');
    expect(passLine(soldOnline({ BILLING_PROVIDER: 'grow' }), { pass: '₪39', vat: 'כולל מע״מ' })).toBe('');
    // the same in both tables (the owner sets both at once: the readiness check names the step)
    const staging = /^\[env\.staging\.vars\]$([\s\S]*?)(?=^\[)/m.exec(read(WEB, '../worker/wrangler.toml'))[1];
    expect(staging).toContain('PRICE_EXAM_PASS_AGOROT = ""');

    // once a price is set (here the build's own, as the owner's [vars] would give it): the line, at that price
    const line = (price) => `<p class="price">לפני מבחן: חבילה ל־30 יום ב־${price}, כולל מע״מ. תשלום אחד, לא מתחדשת מעצמה.</p>`;
    expect(await built({ LANDING_PRICE_PASS_AGOROT: '3900' })).toContain(line('₪39'));
    expect(await built({ LANDING_PRICE_PASS_AGOROT: '4490' })).toContain(line('₪44.90'));
    // Grow at launch (no direct debit): the year and the pass, both one charge; and no "מבטלים באתר"
    const launch = await built({ BILLING_PROVIDER: 'grow', GROW_DIRECT_DEBIT_API: 'off', LANDING_PRICE_PASS_AGOROT: '3900' });
    expect(launch).toContain(line('₪39'));
    expect(launch).toContain(`${formatAgorot(LIST_PRICES.year)} לשנה, כולל מע״מ. לשנה אחת, לא מתחדש מעצמו.`);
    expect(launch).not.toContain('מבטלים באתר');
    // the manual provider sells nothing, with a price or without
    expect(await built({ BILLING_PROVIDER: 'manual', LANDING_PRICE_PASS_AGOROT: '3900' })).not.toContain('חבילה ל־30 יום');
    expect(passLine(soldOnline({ BILLING_PROVIDER: 'grow', PRICE_EXAM_PASS_AGOROT: '3900' }), { pass: '₪39', vat: 'המחיר סופי' }))
      .toBe('לפני מבחן: חבילה ל־30 יום ב־₪39, המחיר סופי. תשלום אחד, לא מתחדשת מעצמה.');
  });

  it('lists the topics the app has, from topicsFor, and the daily goals from GOALS', () => {
    expect(page.mivchan).toContain(`<b>כיתה ז׳:</b> ${topicsFor('7').map((t) => t.title).join(', ')}.`);
    expect(page.mivchan).toContain(`<b>כיתה ח׳:</b> ${topicsFor('8').map((t) => t.title).join(', ')}.`);
    const mins = GOALS.map((g) => g.mins);
    expect(page.mivchan).toContain(`הילד בוחר יעד: ${mins.slice(0, -1).join(', ')} או ${mins.at(-1)} דקות.`);
  });

  it('weighs at most 30 KB a page without images, with landing.css at most 8 KB as written and count.js under 400 B', () => {
    const css = statSync(join(dist, 'l/landing.css')).size;
    const js = statSync(join(dist, 'l/count.js')).size;
    for (const p of ['mivchan', 'pilot']) expect(statSync(join(dist, p, 'index.html')).size + css + js, p).toBeLessThanOrEqual(30 * 1024);
    expect(statSync(join(WEB, 'landing/landing.css')).size).toBeLessThanOrEqual(8 * 1024);
    expect(js).toBeLessThan(400);
    for (const img of ['phone-rescue.webp', 'phone-teacher.webp']) expect(statSync(join(dist, 'l', img)).size, img).toBeLessThanOrEqual(70 * 1024);
  });

  it('is Hebrew, right to left, with one h1, landmarks, a skip link, and every image described and sized', () => {
    for (const [name, html] of Object.entries(page)) {
      expect(html, name).toMatch(/<html lang="he" dir="rtl" data-page="(mivchan|pilot)">/);
      expect(html.match(/<h1\b/g), name).toHaveLength(1);
      for (const tag of ['<header', '<main id="main"', '<footer', '<nav aria-label=']) expect(html, `${name} ${tag}`).toContain(tag);
      expect(html).toMatch(/<a class="skip" href="#main">/);
      const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      expect(imgs.length, name).toBeGreaterThan(0);
      for (const img of imgs) {
        expect(img).toMatch(/\salt="[^"]{12,}"/);
        const file = /src="\.\.\/l\/([^"]+)"/.exec(img)[1];
        const size = imageSize(readFileSync(join(dist, 'l', file)));
        expect(img).toContain(`width="${size.width}" height="${size.height}"`);
      }
      // a theme colour for each scheme, from the tokens
      expect(html).toContain('<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">');
      expect(html).toContain('<meta name="theme-color" content="#0f1115" media="(prefers-color-scheme: dark)">');
    }
  });

  it('fills the owner\'s values (escaped), the meta, the link preview and the canonical address', () => {
    expect(page.mivchan).toContain('<title>מבחן במתמטיקה ביום חמישי? · מדרגות</title>');
    expect(page.pilot).toContain('<title>פיילוט לכיתה · מדרגות</title>');
    expect(page.mivchan).toContain('<link rel="canonical" href="https://madregot.example.test/mivchan/">');
    expect(page.pilot).toContain('<link rel="canonical" href="https://madregot.example.test/pilot/">');
    expect(page.mivchan).toContain('<meta property="og:image" content="https://madregot.example.test/l/og-mivchan.png">');
    expect(page.pilot).toContain('<meta property="og:image" content="https://madregot.example.test/l/og-pilot.png">');
    for (const html of Object.values(page)) {
      expect(html).toMatch(/<meta name="description" content="[^"]{40,}">/);
      expect(html).toContain('<a href="mailto:hello@example.test" dir="ltr">hello@example.test</a>');
      expect(html).toContain('<span>מדרגות &amp; שות׳ &lt;בע״מ&gt;</span>');
      expect(html).not.toContain('<בע״מ>');
    }
    expect(APP_NAME).toBe('מדרגות');
  });

  it('links back into the app relatively, so a copy under a sub-path works, with the deep links Welcome reads', () => {
    expect(page.mivchan).toContain('href="../#/?next=/rescue&amp;src=mivchan" data-cta');
    expect(page.pilot).toContain('href="../#/?start=teacher&amp;src=pilot" data-cta');
    expect(page.mivchan).toContain('href="../#/parents"');
    for (const html of Object.values(page)) {
      for (const p of ['terms', 'privacy', 'accessibility']) expect(html).toContain(`href="../#/${p}"`);
      const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1]);
      for (const h of hrefs) expect(h, h).toMatch(/^(\.\.\/|#main$|mailto:|https:\/\/madregot\.example\.test\/(mivchan|pilot)\/$)/);
      expect(html.match(/<script\b[^>]*>/g)).toEqual(['<script src="../l/count.js" defer>']); // the only script
    }
  });

  it('count.js sends to the Worker named at build time, and nothing with no server', async () => {
    expect(read(dist, 'l/count.js')).toContain('var A="https://api.example.test"');
    const other = fakeDist();
    try {
      const app = smallApp();
      const { warn } = await buildLanding(other, { env: { VITE_API_URL: 'none', PUBLIC_URL: '', CONTACT_EMAIL: '', BUSINESS_NAME: '' }, app });
      expect(read(other, 'l/count.js')).toContain('var A="none"');
      // without the owner's values the parts that need them are left out, and the build says so
      const html = read(other, 'mivchan/index.html');
      expect(html).not.toContain('{{');
      expect(html).not.toMatch(/canonical|og:image|og:url|mailto:/);
      expect(existsSync(join(other, 'sitemap.xml'))).toBe(false);
      expect(read(other, 'robots.txt')).not.toContain('Sitemap');
      expect(warn.join('\n')).toMatch(/PUBLIC_URL[\s\S]*CONTACT_EMAIL[\s\S]*BUSINESS_NAME/);
      // the Worker serves the pages itself: same address
      await buildLanding(other, { env: { PUBLIC_URL: '' }, app });
      expect(read(other, 'l/count.js')).toContain('var A=""');
    } finally { rmSync(other, { recursive: true, force: true }); }
  });

  it('says about the product only the claims the code backs, each in its own words (STUDENT-17)', () => {
    const toml = wranglerVars(read(WEB, '../worker/wrangler.toml'));
    // the sale settings as the build read them (the build env first)
    const status = Object.fromEntries(claimStatus({ code: repoCode(), data: { ...DATA, vars: { ...toml, ...saleVars(ENV, toml) } } }).map((c) => [c.id, c]));
    for (const name of ['mivchan', 'pilot']) {
      const ids = namedIn(read(WEB, 'landing', `${name}.html`));
      expect(ids.length, name).toBeGreaterThan(3);
      for (const id of ids) {
        expect(status[id], `${name}: ${id}`).toBeTruthy();
        if (status[id].visible) expect(page[name], `${name} shows ${id}`).toContain(escHtml(status[id].text));
        else {
          expect(page[name], `${name} hides ${id}`).not.toContain(escHtml(CLAIM[id].he || CLAIM[id].en).split('{{')[0]);
          for (const mark of CLAIM[id].marks || []) expect(page[name], `${name}: "${mark}" (${id} is hidden)`).not.toContain(mark);
        }
      }
    }
    // the features the reviewers found promised with nothing behind them on the lane's branch: on the integrated branch
    // their code is here, so their claims are shown (and the loop above checked each page says them in their words)
    for (const id of ['assign-due', 'class-report', 'pilot-kit', 'class-delete', 'pilot-report', 'demo-class', 'weekly-share']) expect(status[id].visible, id).toBe(true);
    expect(page.mivchan).toContain(escHtml(status['weekly-share'].text));
    // and what this branch does have is there
    expect(page.pilot).toContain('לוח &quot;מה לחזור מחר&quot; לפי הטעויות של הכיתה.');
    expect(page.pilot).toContain('אפשר להסיר תלמיד מהכיתה בכל רגע');
    expect(page.mivchan).toMatch(/המערכת מזהה \d+ טעויות נפוצות בשמן/);
  });

  it('no template writes a feature by hand: a claim\'s words and marks come only through its slot', () => {
    for (const name of ['mivchan', 'pilot']) {
      const tpl = read(WEB, 'landing', `${name}.html`);
      for (const c of CLAIMS) {
        const words = (c.he || c.en).split('{{')[0];
        expect(tpl, `${name}: the words of ${c.id}`).not.toContain(words.length > 12 ? words : '\u0000');
        for (const mark of c.marks || []) expect(tpl, `${name}: "${mark}" belongs to ${c.id}`).not.toContain(mark);
      }
    }
  });

  it('names no rival product on the public pages', () => {
    for (const [name, html] of Object.entries(page)) for (const re of RIVALS) expect(html, `${name} ${re}`).not.toMatch(re);
    for (const c of CLAIMS) for (const re of RIVALS) expect(c.he || c.en, c.id).not.toMatch(re);
  });

  it('after the merge the waiting lines appear by themselves; an app that lost a feature stops the build', async () => {
    const other = fakeDist();
    try {
      const { claims } = await buildLanding(other, { env: { ...ENV }, app: smallApp(), code: codeWith(MERGED) });
      // (the programme's coverage is computed on the integrated branch: only the teachers' line before assignments hides)
      expect(claims.filter((c) => !c.visible).map((c) => c.id).sort()).toEqual(['teachers']);
      const pilot = read(other, 'pilot/index.html');
      for (const id of ['assign-due', 'class-report', 'pilot-kit', 'principal-form', 'class-delete', 'pilot-report', 'school-ai-off']) {
        expect(pilot, id).toContain(escHtml(CLAIM[id].he));
      }
      expect(pilot).toContain('href="../#/?start=demo&amp;src=pilot" data-cta>לראות כיתה לדוגמה</a>');
      expect(pilot).toMatch(/<h2 id="h-measure">מה בודקים בפיילוט<\/h2>/);
      expect(pilot).toMatch(/<h2 id="h-ai">העוזר החכם<\/h2>/);
      const mivchan = read(other, 'mivchan/index.html');
      for (const id of ['weekly-share', 'chatbot', 'tutor-knows']) expect(mivchan, id).toContain(escHtml(CLAIM[id].he));
      // the app without its teacher's board: the build stops rather than hide what the pages are about
      await expect(buildLanding(other, { env: { ...ENV }, app: smallApp(), code: codeWith({}, { drop: ['web/src/screens/Teacher.jsx'] }) }))
        .rejects.toThrow(/no longer backs what the pages say: tomorrow-board/);
    } finally { rmSync(other, { recursive: true, force: true }); }
  });

  it('renderClaims: a hidden claim leaves no empty item, paragraph or double space, and an unknown id stops the build', () => {
    const tpl = '<ul class="ticks">\n      {{CLAIMS a b}}\n    </ul>\n<p>אחת. {{CLAIM b}} שתיים.</p>\n<p>{{CLAIM b}}</p>\n{{#CLAIM b}}<section>ב</section>{{/CLAIM}}\n<ul class="ticks">\n<li>{{CLAIM b}}</li>\n</ul>';
    const out = renderClaims(tpl, { shown: { a: 'א & ב' }, known: ['a', 'b'] });
    expect(out).toBe('<ul class="ticks">\n      <li>א &amp; ב</li>\n    </ul>\n<p>אחת. שתיים.</p>\n\n');
    expect(() => renderClaims('{{CLAIM nope}}', { shown: {}, known: ['a'] })).toThrow(/no claim "nope"/);
  });

  it('reads image sizes from PNG and WebP headers', () => {
    for (const f of readdirSync(join(WEB, 'landing/img'))) {
      const s = imageSize(readFileSync(join(WEB, 'landing/img', f)));
      expect(s, f).not.toBeNull();
      if (f.startsWith('og-')) expect(s, f).toEqual({ width: 1200, height: 630 });
      // the waitlist page's are a whole phone around the app at 390 × 844 shot at 2x (store/capture.cjs waitlist)
      else expect(s.width, f).toBe(WAITLIST_PHONES.includes(f) ? 720 : 1080);
    }
  });
});

// The waitlist page for the store apps (/waitlist/ and /w/, worker/src/waitlist.js): built with the others, from the
// same tokens and claims, its form posting to the Worker the build names, small, readable by a screen reader, and true.
const WAITLIST_PHONES = ['phone-paste.webp', 'phone-mistake.webp', 'phone-madi.webp'];
describe('landing-build: the waitlist page', () => {
  let wl;
  beforeAll(() => { wl = read(dist, 'waitlist/index.html'); });

  it('writes /waitlist/, the same page at /w/, its style and its script; the sitemap names /waitlist/ only', () => {
    for (const f of ['waitlist/index.html', 'w/index.html', 'l/waitlist.css', 'l/waitlist.js', ...WAITLIST_PHONES.map((i) => `l/${i}`), 'l/og-waitlist.png']) {
      expect(existsSync(join(dist, f)), f).toBe(true);
    }
    expect(read(dist, 'w/index.html')).toBe(wl);
    expect(wl).toContain('<link rel="canonical" href="https://madregot.example.test/waitlist/">');
    expect(wl).toContain('<meta property="og:image" content="https://madregot.example.test/l/og-waitlist.png">');
    expect(read(dist, 'sitemap.xml')).toContain('<loc>https://madregot.example.test/waitlist/</loc>');
    expect(read(dist, 'sitemap.xml')).not.toContain('/w/');
    expect(wl).toMatch(/<html lang="he" dir="rtl" data-page="waitlist">/);
  });

  it('posts to the Worker the build names: JSON from its script, a plain form without it; nowhere with no server', async () => {
    expect(wl).toContain('<form class="wl-form" id="wl-form" action="https://api.example.test/api/waitlist" method="post" data-api="https://api.example.test"');
    const other = fakeDist();
    try {
      // the Worker serves the page itself: the same address
      const owner = { CONTACT_EMAIL: ENV.CONTACT_EMAIL, BUSINESS_NAME: ENV.BUSINESS_NAME };
      await buildLanding(other, { env: { ...owner, PUBLIC_URL: '' }, app: smallApp() });
      expect(read(other, 'waitlist/index.html')).toContain('action="../api/waitlist" method="post" data-api=""');
      // no server: the script says so, and a plain post goes nowhere
      const { warn } = await buildLanding(other, { env: { ...owner, VITE_API_URL: 'none', PUBLIC_URL: '' }, app: smallApp() });
      expect(read(other, 'waitlist/index.html')).toContain('action="#unavailable" method="post" data-api="none"');
      expect(warn.join('\n')).toMatch(/waitlist page cannot take signups/);
    } finally { rmSync(other, { recursive: true, force: true }); }
  });

  it('is small: the page, both style files and both scripts at most 48 KB as written, its own style at most 9 KB, each phone at most 60 KB', () => {
    const size = (f) => statSync(join(dist, f)).size;
    expect(size('waitlist/index.html') + size('l/landing.css') + size('l/waitlist.css') + size('l/count.js') + size('l/waitlist.js')).toBeLessThanOrEqual(48 * 1024);
    expect(statSync(join(WEB, 'landing/waitlist.css')).size).toBeLessThanOrEqual(9 * 1024);
    for (const img of WAITLIST_PHONES) expect(size(`l/${img}`), img).toBeLessThanOrEqual(60 * 1024);
    // its script keeps no comment lines, and loads nothing from anywhere
    const js = read(dist, 'l/waitlist.js');
    expect(js).not.toMatch(/^\s*\/\//m);
    expect(js).not.toMatch(/https?:\/\//);
  });

  it('is Hebrew, right to left, with one h1, landmarks, a skip link, a label for every field, and every picture described and sized', () => {
    expect(wl.match(/<h1\b/g)).toHaveLength(1);
    for (const tag of ['<header', '<main id="main"', '<footer', '<nav aria-label=', '<a class="skip" href="#main">']) expect(wl, tag).toContain(tag);
    expect(wl.match(/<script\b[^>]*>/g)).toEqual(['<script src="../l/count.js" defer>', '<script src="../l/waitlist.js" defer>']);
    // each field has its label: the email by for=, the chips and the box inside theirs, the honeypot too
    expect(wl).toContain('<label for="wl-email">המייל שלכם</label>');
    for (const input of wl.match(/<input\b[^>]*>/g)) {
      if (/type="hidden"/.test(input)) continue;
      const at = wl.indexOf(input);
      const id = /\sid="([^"]+)"/.exec(input)?.[1];
      const labelled = (id && wl.includes(`for="${id}"`)) || wl.lastIndexOf('<label', at) > wl.lastIndexOf('</label>', at);
      expect(labelled, input).toBe(true);
    }
    // the required ones, for a plain post: the email, who is asking and the consent
    for (const name of ['email', 'consent']) expect(wl).toMatch(new RegExp(`name="${name}"[^>]*required`));
    expect(wl).toMatch(/name="role" value="parent" required/);
    // who is asking: a parent or a teacher (students are not asked for an email anywhere: they send the link to a parent)
    expect([...wl.matchAll(/name="role" value="(\w+)"/g)].map((m) => m[1])).toEqual(['parent', 'teacher']);
    expect(wl).not.toMatch(/תלמיד\/ה|מתחת לגיל/);
    expect(wl).toContain('תלמידים? <span class="wl-kids-say">שלחו את הקישור להורה.</span>');
    // nothing before the form leaves the page: the way into the browser app is under its button
    expect(wl.indexOf('href="../#/?src=waitlist"')).toBeGreaterThan(wl.indexOf('class="btn wl-submit"'));
    const imgs = wl.match(/<img\b[^>]*>/g);
    expect(imgs).toHaveLength(3);
    for (const img of imgs) {
      expect(img).toMatch(/\salt="[^"]{40,}"/);
      const file = /src="\.\.\/l\/([^"]+)"/.exec(img)[1];
      const s = imageSize(readFileSync(join(dist, 'l', file)));
      expect(img).toContain(`width="${s.width}" height="${s.height}"`);
      expect(img).toContain('loading="lazy"');
    }
    // every Latin word and number in the Hebrew text is isolated left to right (attributes and the head aside)
    const text = wl.slice(wl.indexOf('<body>')).replace(/<[^>]*>/g, (tag) => (tag.startsWith('<bdi') || tag === '</bdi>' ? tag : ' '));
    const outside = text.replace(/<bdi dir="ltr">[^<]*<\/bdi>/g, ' ').replace(/[\w.-]+@[\w.-]+/g, ' ').replace(/&(\w+|#\d+);/g, ' ');
    expect(outside.match(/[A-Za-z]{2,}|\d+/g) || [], 'Latin or digits outside <bdi dir="ltr">').toEqual([]);
  });

  it('says about the product only claims the code backs, in their words, and no count, countdown or promise of results', () => {
    const toml = wranglerVars(read(WEB, '../worker/wrangler.toml'));
    const status = Object.fromEntries(claimStatus({ code: repoCode(), data: { ...DATA, vars: { ...toml, ...saleVars(ENV, toml) } } }).map((c) => [c.id, c]));
    const tpl = read(WEB, 'landing', 'waitlist.html');
    const ids = namedIn(tpl);
    expect(ids.sort()).toEqual(['coverage', 'graded-by-code', 'lesson-drawings', 'madi-rewards', 'mistakes', 'no-ads', 'no-hearts', 'paste-plan', 'rest']);
    // (each number and Latin word of a claim isolated left to right: the text without the <bdi> tags is the claim's)
    const plain = wl.replace(/<bdi dir="ltr">([^<]*)<\/bdi>/g, '$1');
    for (const id of ids) {
      expect(status[id].visible, id).toBe(true);
      expect(plain, id).toContain(escHtml(status[id].text));
    }
    expect(wl).toMatch(/<bdi dir="ltr">\d+<\/bdi> טעויות נפוצות/);
    for (const c of CLAIMS) {
      const words = (c.he || c.en).split('{{')[0];
      expect(tpl, `the words of ${c.id}`).not.toContain(words.length > 12 ? words : '\u0000');
      for (const mark of c.marks || []) expect(tpl, `"${mark}" belongs to ${c.id}`).not.toContain(mark);
    }
    for (const re of [...RIVALS, /נרשמו כבר/, /כבר \d+/, /נשארו/, /רק עוד/, /מוגבל/, /מבטיח|מובטח|ציון גבוה|משפר את הציון/]) expect(wl, String(re)).not.toMatch(re);
  });
});

// Finding of the waitlist review: no form while the privacy notice behind it names no one (CONTACT_EMAIL, BUSINESS_NAME
// empty: the production Worker's state when the page was first built), and claims with " and & isolated whole.
describe('landing-build: the waitlist before the owner has set CONTACT_EMAIL and BUSINESS_NAME', () => {
  for (const [name, env] of [['CONTACT_EMAIL', { CONTACT_EMAIL: '' }], ['BUSINESS_NAME', { BUSINESS_NAME: '' }], ['both', { CONTACT_EMAIL: '', BUSINESS_NAME: '' }]]) {
    it(`without ${name}: a "not open yet" note where the form would be, no way to join, and the build says why`, async () => {
      const other = fakeDist();
      try {
        // the template's own wrangler.toml leaves both empty: only the env given here fills them
        const { warn } = await buildLanding(other, { env: { ...ENV, ...env }, app: smallApp() });
        const html = read(other, 'waitlist/index.html');
        expect(html).not.toContain('<form');
        expect(html).not.toMatch(/name="email"|data-join|href="#join"/);
        expect(html).toContain('<h2 id="h-join">הרשימה תיפתח בקרוב</h2>');
        expect(html).toMatch(/<a class="btn" href="\.\.\/#\/\?src=waitlist" data-cta>לתרגל בדפדפן<\/a>/);
        expect(html).not.toMatch(/\{\{/);
        expect(read(other, 'w/index.html')).toBe(html);
        expect(warn.join('\n')).toMatch(/waitlist page shows "not open yet" instead of its form until .*(CONTACT_EMAIL|BUSINESS_NAME).*do not advertise it before \(npm run owner -- set CONTACT_EMAIL=/);
      } finally { rmSync(other, { recursive: true, force: true }); }
    });
  }

  it('with both: the form, and no note', () => {
    const wl = read(dist, 'waitlist/index.html');
    expect(wl).toContain('<form class="wl-form" id="wl-form"');
    expect(wl).not.toContain('הרשימה תיפתח בקרוב');
  });

  it('isolates a claim\'s numbers and Latin words without cutting an entity (gershayim as ", and &)', () => {
    const out = renderClaims('<p>{{CLAIM x}}</p>', { shown: { x: 'המורה כתב "מבחן" על פרק 3 & סיכום ב־iPhone' }, known: ['x'] }, { isolate: true });
    expect(out).toBe('<p>המורה כתב &quot;מבחן&quot; על פרק <bdi dir="ltr">3</bdi> &amp; סיכום ב־<bdi dir="ltr">iPhone</bdi></p>');
    // markup in a claim stays text: escaped, its letters isolated like any other
    expect(isolateLtr('<b>1</b>')).toBe('&lt;<bdi dir="ltr">b</bdi>&gt;<bdi dir="ltr">1</bdi>&lt;/<bdi dir="ltr">b</bdi>&gt;');
  });

  it('a part inside a kept part is filled too', () => {
    expect(render('{{#A}}a{{#B}}b{{/B}}{{#C}}c{{/C}}{{/A}}', { A: '1', B: '1', C: '' })).toBe('ab');
  });
});
