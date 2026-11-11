// A small static server that compresses, for the timing test (DURABLE-11, e2e/perf.spec.js): vite preview sends
// files uncompressed, which made the council's slow-phone timing look worse than a real host. Text files go out gzipped
// (level 9, once per file), with the headers web/public/_headers gives the real host: hashed /assets/ files immutable,
// sw.js and the page always checked again.
// Usage: node scripts/serve-gzip.mjs <dir> <port>    (ports 4202-4209 on the shared test machine)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};
const COMPRESS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map']);

export function serveGzip(dir, port, host = '127.0.0.1') {
  const root = normalize(dir);
  const gzipped = new Map();
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(root, path));
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
      const ext = extname(file);
      const headers = {
        'content-type': TYPES[ext] || 'application/octet-stream',
        'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        vary: 'accept-encoding',
      };
      let body = await readFile(file);
      if (COMPRESS.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
        if (!gzipped.has(file)) gzipped.set(file, gzipSync(body, { level: 9 }));
        body = gzipped.get(file);
        headers['content-encoding'] = 'gzip';
      }
      headers['content-length'] = body.length;
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(500).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir = 'dist', port = '4204'] = process.argv.slice(2);
  await serveGzip(dir, Number(port));
  console.log(`serving ${dir} gzipped on http://127.0.0.1:${port}/`);
}
