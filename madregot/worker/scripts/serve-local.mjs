#!/usr/bin/env node
// The Worker on this machine, for the contract tests (COUNCIL2-22): its own fetch handler (src/index.js) over HTTP, on a
// database in memory (node:sqlite, built from worker/migrations/ in order, as `wrangler d1 migrations apply` builds a
// real one), with the test vars and the stubs of test/helpers.js: Claude answers with a short text (JSON for the
// structured kinds), the email service only records the message, and the payment provider is the built-in test one
// (BILLING_PROVIDER = "test": its checkout page is this Worker's /api/billing/test-pay/:id). No .dev.vars, no key and
// no secret is read: every value is synthetic, and nothing leaves the machine (a fetch to any other address throws).
//
// It can also serve the built app (--app <dist>) the way the deployed Worker does: the same address for the pages and
// /api, so the app talks to it with no CORS, as in production (the app is built with VITE_API_URL="/").
//
// Each test gets a database of its own: a path that starts with /t/<tenant>/ is that tenant's Worker (its own env and
// database, made on its first request); anything else is the tenant "default". The app is pointed at a tenant by its
// saved server address (ai.apiUrl = http://127.0.0.1:<port>/t/<tenant>), and that tenant's PUBLIC_URL is the same
// base, so the test payment page and its way back stay in the tenant too.
//
// Test-only routes, never part of the Worker: /t/<tenant>/__contract/sql (POST {sql, args}: a SELECT on the tenant's
// database), /__contract/emails (what the email stub recorded for the tenant) and /__contract/escrows (the kept
// restore codes, unsealed with the tenant's test VAULT_SECRET). They exist only in this script, which listens on
// 127.0.0.1 only.
//
//   node scripts/serve-local.mjs [--port 4423] [--app ../web/dist-contract] [--origin http://127.0.0.1:4424]
//
// Ports 4422-4429 are this lane's (the e2e preview uses E2E_PORT); 4423 is the default. web/e2e/playwright.config.js
// starts it for the 'contract' project (web/e2e/contract.js is the tests' side).
import http from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEnv, memoryD1, stubFetch, claudeReply } from '../test/helpers.js';
import { unsealCode } from '../src/vault.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const PORT = Number(arg('port', process.env.CONTRACT_PORT || 4423));
const APP = arg('app', '');
const ORIGINS = [`http://127.0.0.1:${PORT}`, ...String(arg('origin', '')).split(',').filter(Boolean)];
if (!(PORT >= 1024 && PORT < 65536)) throw new Error(`bad port ${PORT}`);

/** The database a real one gets: every migration, in name order (test/schema.test.js keeps this equal to schema.sql). */
export function migratedSql() {
  const dir = path.join(here, '..', 'migrations');
  return readdirSync(dir).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort().map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n');
}
const SQL = migratedSql();

/**
 * What Claude says: the fake server's own canned answers (web/e2e/fakeServer.js), so a test reads the same words against
 * either backend. A chat (streamed) gets the chat's, an explanation the explanation's; structured kinds get
 * test/helpers.js claudeReply's JSON.
 */
export const CHAT_TEXT = 'כדי לחבר מספרים עם סימנים שונים, מחסרים ושמים את הסימן של הגדול.';
export const EXPLAIN_TEXT = 'הסבר קצר מהעוזר.';
/** Test values only: the escrow key's secret, as the Worker's own tests use one. */
const VAULT_SECRET = 'test-vault-secret-0123456789abcdef0123456789abcdef';

// ---------------------------------------------------------------- tenants
const current = new AsyncLocalStorage();
const tenants = new Map();
function tenantOf(id) {
  if (!tenants.has(id)) {
    const base = id === 'default' ? `http://127.0.0.1:${PORT}` : `http://127.0.0.1:${PORT}/t/${id}`;
    const env = makeEnv({ DB: memoryD1(SQL), PUBLIC_URL: base, ALLOWED_ORIGINS: ORIGINS.join(','), VAULT_SECRET });
    tenants.set(id, { env, emails: [], ctx: { waitUntil: (p) => { Promise.resolve(p).catch((e) => console.error(`[${id}] waitUntil`, e)); }, passThroughOnException() {} } });
  }
  return tenants.get(id);
}

// Claude and the email service, for every tenant: the email is kept with the tenant whose request sent it.
stubFetch({
  claude: (p) => claudeReply(p, p.output_config?.format ? {} : { text: p.stream ? CHAT_TEXT : EXPLAIN_TEXT }),
  resend: (msg) => {
    const t = current.getStore();
    if (t) t.emails.push({ to: msg.to, subject: msg.subject, text: msg.text });
    return new Response(JSON.stringify({ id: `em_${Date.now()}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});

const { default: worker } = await import('../src/index.js');

// ---------------------------------------------------------------- the app's files (like the Worker's assets)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.xml': 'application/xml' };
function serveApp(res, pathname) {
  if (!APP) { res.writeHead(404); res.end('no app'); return; }
  const root = path.resolve(APP);
  let file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const index = path.join(file, 'index.html');
    // a page of the app (/parents?order=…, the payment's way back): its index.html, as the Worker serves it
    file = existsSync(index) ? index : path.extname(pathname) ? '' : path.join(root, 'index.html');
  }
  if (!file || !existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
}

// ---------------------------------------------------------------- the test-only routes
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(data)); };
async function control(res, t, route, body) {
  if (route === 'sql') {
    const { sql, args = [] } = JSON.parse(body || '{}');
    if (!/^\s*SELECT\b/i.test(String(sql))) return send(res, 400, { error: 'select only' });
    return send(res, 200, { rows: t.env.DB.raw.prepare(sql).all(...args) });
  }
  if (route === 'emails') return send(res, 200, { emails: t.emails });
  if (route === 'escrows') {
    const rows = t.env.DB.raw.prepare('SELECT * FROM vault_escrow').all();
    const out = [];
    for (const r of rows) out.push({ ...r, code: await unsealCode(t.env, r.sealed, r.owner_kind, r.owner_id) });
    return send(res, 200, { escrows: out });
  }
  return send(res, 404, { error: 'not_found' });
}

// ---------------------------------------------------------------- the server
const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    let id = 'default'; let pathname = url.pathname;
    const m = pathname.match(/^\/t\/([a-z0-9-]{1,64})(\/.*)?$/);
    if (m) { id = m[1]; pathname = m[2] || '/'; }
    const t = tenantOf(id);
    const body = await readBody(req);
    if (pathname.startsWith('/__contract/')) return await control(res, t, pathname.slice('/__contract/'.length), body.toString('utf8'));
    if (!pathname.startsWith('/api/') && pathname !== '/api') return serveApp(res, pathname);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v != null && k !== 'host') headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    // the address Cloudflare would give (this machine), so the per-network caps count as they would
    if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', '127.0.0.1');
    const request = new Request(`${t.env.PUBLIC_URL.replace(/\/t\/[^/]+$/, '')}${pathname}${url.search}`, {
      method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });
    const response = await current.run(t, () => worker.fetch(request, t.env, t.ctx));
    const out = {};
    response.headers.forEach((v, k) => { out[k] = v; });
    res.writeHead(response.status, out);
    if (!response.body) { res.end(); return; }
    // streamed replies (the chat) go out as they come
    const reader = response.body.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value); }
    res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'serve_local', message: String(e?.message || e) });
    else res.end();
  }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`the Worker on http://127.0.0.1:${PORT} (database from ${readdirSync(path.join(here, '..', 'migrations')).length} migrations${APP ? `, app from ${APP}` : ''})`);
});
