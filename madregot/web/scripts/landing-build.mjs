// The landing pages (STUDENT-13): /mivchan/ for parents ("מבחן ביום חמישי?") and /pilot/ for schools. Static pages,
// built from web/landing/ after `vite build` (npm run build runs it), into the same folder:
//   <dist>/mivchan/index.html, <dist>/pilot/index.html
//   <dist>/l/landing.css   the app's Rubik faces + the :root block of tokens.css + the dark block of dark.css + landing.css
//   <dist>/l/count.js      the only script: two reach counts (STUDENT-14), no tracker
//   <dist>/l/*.webp|png    the phone shots and the link previews (made by madregot/store/capture.cjs landing)
//   <dist>/sitemap.xml, <dist>/robots.txt
// Every link back to the app is relative (../#/…), so a copy under a sub-path (/madregot/) works too.
//
// What fills the {{…}} slots, so the pages say what the app and the server really do:
//   TOPICS_7, TOPICS_8   the grade's topic names (src/content topicsFor), GOAL_MINUTES the daily goals (lib/quests GOALS)
//   PRICE_MONTH/_YEAR    LANDING_PRICE_MONTH_AGOROT / LANDING_PRICE_YEAR_AGOROT, else the Worker's
//                        PRICE_FAMILY_*_AGOROT in worker/wrangler.toml, else lib/price.js LIST_PRICES (₪29.90, ₪249)
//   VAT_LINE             LANDING_VAT_MODE, else wrangler.toml VAT_MODE: 'כולל מע״מ' (or 'המחיר סופי' for an exempt dealer)
//   PUBLIC_URL, CONTACT_EMAIL, BUSINESS_NAME   the build env, else wrangler.toml [vars] (the owner fills them once there)
//   API_BASE             where count.js sends: API_BASE in the env, else from VITE_API_URL ('none' → none; unset or '/'
//                        → '' = this Worker; an address → that address)
//   APP_NAME             shared/brand.js
// A slot the owner has not filled yet leaves its part out ({{#NAME}}…{{/NAME}}): no canonical link, link preview or
// sitemap without PUBLIC_URL, no e-mail line without CONTACT_EMAIL. The build says which are missing.
//
// Usage: node scripts/landing-build.mjs [dist]          (default dist)
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME } from '../../shared/brand.js';
import { LIST_PRICES, formatAgorot, vatLine } from '../src/lib/price.js';

export const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LANDING = join(WEB, 'landing');
export const PAGES = ['mivchan', 'pilot'];
/** The images the pages use, made by store/capture.cjs into web/landing/img/ and copied to <dist>/l/. */
export const IMAGES = ['phone-rescue.webp', 'phone-teacher.webp', 'og-mivchan.png', 'og-pilot.png'];

const read = (p) => readFileSync(p, 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
/** CSS on one line: whitespace collapsed, none around { } ; : , (selectors and values stay the same). */
export const minifyCss = (css) => stripComments(css).replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').replace(/;}/g, '}').trim();

/** The two token blocks, as the app has them: the :root of tokens.css and the phone's-dark block of dark.css. */
export function tokenBlocks(tokensCss = read(join(WEB, 'src/styles/tokens.css')), darkCss = read(join(WEB, 'src/styles/dark.css'))) {
  const root = /:root\s*\{[^}]*\}/.exec(stripComments(tokensCss));
  const dark = /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*\}\s*\}/.exec(stripComments(darkCss));
  if (!root || !dark) throw new Error('landing-build: the :root block of tokens.css or the dark block of dark.css was not found');
  return { root: minifyCss(root[0]), dark: minifyCss(dark[0]) };
}

/** A custom property's value in a block ('--paper' → '#ffffff'). */
export const tokenValue = (block, name) => new RegExp(`${name}:([^;}]+)`).exec(block)?.[1].trim() || '';

// the unicode ranges of @fontsource-variable/rubik, for the two parts the app keeps (Hebrew, Latin)
const RANGES = {
  hebrew: 'U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
};
/** @font-face rules for the app's own Rubik files in <dist>/assets (cached already if the app was opened). */
export function fontFaces(dist) {
  const dir = join(dist, 'assets');
  if (!existsSync(dir)) return '';
  const files = readdirSync(dir);
  return Object.entries(RANGES).map(([part, range]) => {
    const f = files.find((n) => new RegExp(`^rubik-${part}-wght-normal-[\\w-]+\\.woff2$`).test(n));
    return f ? `@font-face{font-family:'Rubik Variable';font-style:normal;font-display:swap;font-weight:300 900;src:url(../assets/${f}) format('woff2-variations');unicode-range:${range}}` : '';
  }).join('');
}

/** "KEY = \"value\"" lines of worker/wrangler.toml (the top [vars] table; later tables are not read). */
export function wranglerVars(text) {
  const out = {};
  if (!text) return out;
  const vars = /^\[vars\]\s*$([\s\S]*?)(?=^\[)/m.exec(text)?.[1] || '';
  for (const m of vars.matchAll(/^([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/gm)) out[m[1]] = m[2];
  return out;
}

const isUrl = (s) => /^https?:\/\/[^\s"'<>]+$/.test(s);
const isEmail = (s) => /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+$/.test(s);
const agorot = (...vals) => vals.map(Number).find((v) => Number.isInteger(v) && v > 0);
/** 'א, ב, ג או ד'. */
const orList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} או ${xs[xs.length - 1]}`);

/**
 * The values of the slots, from the build env, then wrangler.toml, then the defaults. `app` is appData() (topics,
 * goal minutes, Madi); `warn` collects what the owner has not filled in.
 */
export function landingVars(env, toml, app, tokens) {
  const warn = [];
  const pick = (name) => String(env[name] ?? toml[name] ?? '').trim();
  let publicUrl = pick('PUBLIC_URL').replace(/\/+$/, '');
  if (publicUrl && !isUrl(publicUrl)) { warn.push(`PUBLIC_URL "${publicUrl}" is not an http(s) address`); publicUrl = ''; }
  if (!publicUrl) warn.push('PUBLIC_URL is empty: no canonical link, link preview or sitemap');
  let email = pick('CONTACT_EMAIL');
  if (email && !isEmail(email)) { warn.push(`CONTACT_EMAIL "${email}" is not an e-mail address`); email = ''; }
  if (!email) warn.push('CONTACT_EMAIL is empty: the pages show no e-mail');
  const business = pick('BUSINESS_NAME');
  if (!business) warn.push('BUSINESS_NAME is empty: the footer shows no business name');
  // count.js: '' = the Worker that serves these pages, 'none' = no server, else the Worker's address
  const viteApi = String(env.VITE_API_URL ?? '').trim();
  let api = env.API_BASE !== undefined ? String(env.API_BASE).trim() : viteApi === 'none' ? 'none' : viteApi === '/' ? '' : viteApi;
  api = api.replace(/\/+$/, '');
  if (api && api !== 'none' && !isUrl(api)) { warn.push(`API_BASE "${api}" is not an address: nothing is counted`); api = 'none'; }
  const month = agorot(env.LANDING_PRICE_MONTH_AGOROT, toml.PRICE_FAMILY_MONTH_AGOROT, LIST_PRICES.month);
  const year = agorot(env.LANDING_PRICE_YEAR_AGOROT, toml.PRICE_FAMILY_YEAR_AGOROT, LIST_PRICES.year);
  return {
    vars: {
      APP_NAME, PUBLIC_URL: publicUrl, CONTACT_EMAIL: email, BUSINESS_NAME: business,
      PRICE_MONTH: formatAgorot(month), PRICE_YEAR: formatAgorot(year), VAT_LINE: vatLine(pick('LANDING_VAT_MODE') || toml.VAT_MODE || 'included'),
      TOPICS_7: app.topics['7'].join(', '), TOPICS_8: app.topics['8'].join(', '), GOAL_MINUTES: orList(app.minutes.map(String)),
      THEME_LIGHT: tokenValue(tokens.root, '--paper'), THEME_DARK: tokenValue(tokens.dark, '--paper'),
    },
    api, warn,
  };
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** The size of a PNG or WebP file: { width, height }, or null. */
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const b = buf.subarray(21, 25);
      return { width: 1 + (b[0] | ((b[1] & 0x3f) << 8)), height: 1 + ((b[1] >> 6) | (b[2] << 2) | ((b[3] & 0x0f) << 10)) };
    }
  }
  return null;
}

/** Fill a page: {{#NAME}}…{{/NAME}} kept only when NAME has a value, {{IMG file}} the image's src and size, {{NAME}}. */
export function render(tpl, vars, { images = {}, madi = {} } = {}) {
  let out = tpl.replace(/\{\{#([A-Z_0-9]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, name, body) => (vars[name] ? body : ''));
  out = out.replace(/\{\{IMG ([\w.-]+)\}\}/g, (_, file) => {
    const s = images[file];
    if (!s) throw new Error(`landing-build: ${file} is missing from web/landing/img (run: node madregot/store/capture.cjs landing)`);
    return `src="../l/${file}" width="${s.width}" height="${s.height}"`;
  });
  out = out.replace(/\{\{MADI_SMALL\}\}/g, madi.small || '').replace(/\{\{MADI\}\}/g, madi.big || '');
  out = out.replace(/\{\{([A-Z_0-9]+)\}\}/g, (m, name) => (name in vars ? esc(vars[name]) : m));
  out = out.replace(/<p>\s*<\/p>/g, '');
  const left = /\{\{[^}]*\}\}/.exec(out);
  if (left) throw new Error(`landing-build: ${left[0]} has no value`);
  return out;
}

/** count.js without its comments, on one line, with the Worker's address in it. */
export function buildCount(src, api) {
  const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  return `${code.replace(/\s+/g, ' ').replace(/\s*([{}();,=|!+&])\s*/g, '$1').trim()}\n`
    .replace('"{{API_BASE}}"', JSON.stringify(api));
}

/**
 * What the pages read from the app's own code, through Vite (the content is TypeScript behind the @ alias): the topic
 * names per grade, the daily goal minutes, and מדי drawn by the app's Mascot (one small, one large).
 */
export async function appData() {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: WEB, configFile: join(WEB, 'vite.config.js'), appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const content = await server.ssrLoadModule('/src/content/index.js');
    const { GOALS } = await server.ssrLoadModule('/src/lib/quests.js');
    const { default: Mascot } = await server.ssrLoadModule('/src/components/Mascot.jsx');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    // React's generated ids («R0») become plain ones, distinct for the two drawings on a page
    const madi = (mood, size, id) => renderToStaticMarkup(createElement(Mascot, { mood, size })).replace(/«[^»]*»/g, `-${id}`);
    return {
      topics: { 7: content.topicsFor('7').map((t) => t.title), 8: content.topicsFor('8').map((t) => t.title) },
      minutes: GOALS.map((g) => g.mins),
      madi: { small: madi('idle', 36, 's'), big: madi('happy', 96, 'b') },
    };
  } finally {
    await server.close();
  }
}

/** Build the pages into `dist`. Returns { files, warn }. `app` defaults to appData(). */
export async function buildLanding(dist, { env = process.env, app, src = LANDING } = {}) {
  const tomlPath = join(WEB, '..', 'worker', 'wrangler.toml');
  const toml = wranglerVars(existsSync(tomlPath) ? read(tomlPath) : '');
  const data = app || await appData();
  const tokens = tokenBlocks();
  const { vars, api, warn } = landingVars(env, toml, data, tokens);
  const files = [];
  const write = (rel, text) => { const p = join(dist, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); files.push(rel); };

  const images = {};
  for (const f of IMAGES) {
    const from = join(src, 'img', f);
    if (!existsSync(from)) continue;
    const buf = readFileSync(from);
    images[f] = imageSize(buf);
    mkdirSync(join(dist, 'l'), { recursive: true });
    copyFileSync(from, join(dist, 'l', f));
    files.push(`l/${f}`);
  }
  write('l/landing.css', `${fontFaces(dist)}${tokens.root}${tokens.dark}\n${minifyCss(read(join(src, 'landing.css')))}\n`);
  write('l/count.js', buildCount(read(join(src, 'count.js')), api));
  for (const page of PAGES) write(`${page}/index.html`, render(read(join(src, `${page}.html`)), vars, { images, madi: data.madi }));
  const base = vars.PUBLIC_URL;
  write('robots.txt', `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
  if (base) {
    write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((p) => `  <url><loc>${esc(`${base}/${p}/`)}</loc></url>\n`).join('')}</urlset>\n`);
  }
  return { files, warn };
}

// node scripts/landing-build.mjs [dist]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] || join(WEB, 'dist'));
  buildLanding(dist).then(({ files, warn }) => {
    for (const w of warn) console.warn(`landing-build: ${w} (set it in worker/wrangler.toml [vars] or the build env)`);
    console.log(`landing-build: ${files.length} files in ${dist} (/mivchan/, /pilot/, /l/, robots.txt${files.includes('sitemap.xml') ? ', sitemap.xml' : ''})`);
  }).catch((e) => { console.error(e.message || e); process.exit(1); });
}
