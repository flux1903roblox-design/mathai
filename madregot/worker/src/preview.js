// The link preview of the parents' summary link (COUNCIL2-36, PARENTS-2). The child's week travels in the link's #
// fragment, which a browser never sends to a server, so the Worker cannot know whose week a link holds and says nothing
// about it: GET /r answers the app's own page with Open Graph tags that are the same for every link (a title, one line
// and the picture /l/og-report.png, 1200 × 630), and the app then opens the week from the fragment on the phone. The
// query string, cookies and headers of the request are never read into the page. WhatsApp, Telegram and the like show
// the card; the page itself is the app. Without PUBLIC_URL (an og:image must be a whole address) or without the assets
// binding the page is answered as it is, with no preview: the owner's one step is to set PUBLIC_URL (wrangler.toml).
import { APP_NAME } from '../../shared/brand.js';

/** What every summary link's card says. */
export const REPORT_PREVIEW = Object.freeze({
  title: `${APP_NAME}: סיכום השבוע מהתרגול`,
  description: 'מה תרגלו השבוע, אילו מדרגות הושלמו ומה כדאי לחזור עליו. הסיכום נפתח בטלפון שקיבל את הקישור.',
  image: '/l/og-report.png',
  imageAlt: `${APP_NAME}: סיכום שבוע של תרגול מתמטיקה`,
  width: 1200,
  height: 630,
});

/**
 * The app's own security headers (web/public/_headers, `/*`): the page answered here is the app, so it keeps them
 * whether or not the assets binding adds them (test/preview.test.js keeps the two in step).
 */
export const PAGE_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The site's own address, from PUBLIC_URL: an http(s) origin and path with no trailing slash, or '' when it is not set
 * or is not one.
 * @param {{ PUBLIC_URL?: string }} env
 */
export function publicBase(env) {
  const raw = String(env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol) && !u.search && !u.hash ? raw : '';
  } catch { return ''; }
}

/**
 * The tags for the summary link's card, or '' without a public address.
 * @param {{ PUBLIC_URL?: string }} env
 */
export function previewTags(env) {
  const base = publicBase(env);
  if (!base) return '';
  const p = REPORT_PREVIEW;
  return [
    '<meta name="robots" content="noindex">',
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${esc(APP_NAME)}">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.description)}">`,
    `<meta property="og:url" content="${esc(`${base}/r`)}">`,
    `<meta property="og:image" content="${esc(`${base}${p.image}`)}">`,
    `<meta property="og:image:width" content="${p.width}">`,
    `<meta property="og:image:height" content="${p.height}">`,
    `<meta property="og:image:alt" content="${esc(p.imageAlt)}">`,
    `<meta property="og:locale" content="he_IL">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n    ');
}

/**
 * GET or HEAD /r: the app's page (index.html, through the assets binding) with the card's tags in its <head>. 404 with
 * no assets binding (a local run with no built app).
 * @param {Request} req
 * @param {{ PUBLIC_URL?: string, ASSETS?: { fetch(req: Request): Promise<Response> } }} env
 */
export async function reportPreview(req, env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  // the app's page as the assets serve it: nothing of the request but its address's origin goes with it
  const page = await env.ASSETS.fetch(new Request(new URL('/', req.url), { method: 'GET', headers: { Accept: 'text/html' } }));
  const tags = previewTags(env);
  const type = page.headers.get('Content-Type') || '';
  const html = page.ok && /text\/html/i.test(type) ? await page.text() : null;
  const headers = new Headers(page.headers);
  for (const [k, v] of Object.entries(PAGE_HEADERS)) headers.set(k, v);
  headers.delete('Content-Length');
  headers.delete('Set-Cookie');
  // the same page for every link: a short cache, and never one keyed on anything but the address
  headers.set('Cache-Control', 'public, max-age=300');
  if (html === null) return new Response(req.method === 'HEAD' ? null : page.body, { status: page.status, headers });
  const out = tags && html.includes('</head>') ? html.replace('</head>', `    ${tags}\n  </head>`) : html;
  return new Response(req.method === 'HEAD' ? null : out, { status: 200, headers });
}
