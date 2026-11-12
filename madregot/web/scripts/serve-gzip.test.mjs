// scripts/serve-gzip.mjs serves a build as the real host does: the build's own _headers on every file (matched as
// Cloudflare matches them), gzip for text, and never the _headers file itself. The PDF test under the production CSP
// (e2e/pdf-csp.spec.js) and the timing test rely on it.
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { request } from 'node:http';
import { serveGzip, headerRules, headersFor } from './serve-gzip.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADERS = readFileSync(path.join(WEB, 'public', '_headers'), 'utf8');

describe('headerRules and headersFor', () => {
  test('match the way Cloudflare does: /* everywhere, a folder splat, an exact file, a placeholder; repeats joined', () => {
    const rules = headerRules('/*\n  X-A: 1\n/assets/*\n  Cache-Control: immutable\n/sw.js\n  Cache-Control: no-cache\n/u/:id/x\n  X-A: 2\nhttps://other.test/*\n  X-B: 3\n');
    expect(headersFor(rules, '/index.html')).toEqual({ 'x-a': '1' });
    expect(headersFor(rules, '/assets/pdf-abc.js')).toEqual({ 'x-a': '1', 'cache-control': 'immutable' });
    expect(headersFor(rules, '/sw.js')).toEqual({ 'x-a': '1', 'cache-control': 'no-cache' });
    expect(headersFor(rules, '/sw.jsx')).toEqual({ 'x-a': '1' });
    expect(headersFor(rules, '/u/7/x')).toEqual({ 'x-a': '1, 2' });
    expect(headersFor(rules, '/u/7/8/x')).toEqual({ 'x-a': '1' });
  });
});

describe('serveGzip', () => {
  let dir; let server; let port;
  const get = (p, headers = {}) => new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port, path: p, headers }, (res) => {
      const parts = []; res.on('data', (c) => parts.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
    }).on('error', reject).end();
  });
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'madregot-serve-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>מדרגות</title>');
    writeFileSync(path.join(dir, 'assets', 'pdf.worker.min-abc.mjs'), 'export {};');
    writeFileSync(path.join(dir, 'sw.js'), 'self.x = 1;');
    writeFileSync(path.join(dir, '_headers'), HEADERS);
    server = await serveGzip(dir, 0);
    port = server.address().port;
  });
  afterAll(() => { server?.close(); rmSync(dir, { recursive: true, force: true }); });

  test('every file carries the production CSP from _headers, the worker of pdf.js included', async () => {
    const csp = headersFor(headerRules(HEADERS), '/')['content-security-policy'];
    expect(csp).toContain("'wasm-unsafe-eval'");
    for (const p of ['/', '/assets/pdf.worker.min-abc.mjs', '/sw.js']) {
      const res = await get(p);
      expect(res.status, p).toBe(200);
      expect(res.headers['content-security-policy'], p).toBe(csp);
      expect(res.headers['x-content-type-options'], p).toBe('nosniff');
    }
    expect((await get('/assets/pdf.worker.min-abc.mjs')).headers['content-type']).toBe('text/javascript; charset=utf-8');
  });

  test('caching as _headers says, gzip when asked, and the _headers file itself is never served', async () => {
    expect((await get('/assets/pdf.worker.min-abc.mjs')).headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await get('/sw.js')).headers['cache-control']).toBe('no-cache');
    const zipped = await get('/', { 'accept-encoding': 'gzip' });
    expect(zipped.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(zipped.body).toString()).toContain('מדרגות');
    expect((await get('/_headers')).status).toBe(404);
  });
});
