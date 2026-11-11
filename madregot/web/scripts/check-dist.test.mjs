// The build check (scripts/check-dist.mjs), on fixture builds: a clean one passes; one that names an analytics, ads or
// tag-manager host anywhere (a script, a page, the landing pages) is refused, which is what keeps the pages' "בלי
// פרסומות ובלי מעקב" true (STUDENT-17); a secret or a broken service worker list is refused as before.
import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRACKERS, trackerIn, checkDist } from './check-dist.mjs';

const SCRIPT = fileURLToPath(new URL('./check-dist.mjs', import.meta.url));
// the app's own security headers (check-dist also refuses a build whose _headers lost one: scripts/headers.mjs)
const HEADERS = readFileSync(fileURLToPath(new URL('../public/_headers', import.meta.url)), 'utf8');
const run = promisify(execFile);
let dirs = [];
afterEach(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); dirs = []; });

/** A small build: a page, a script, the landing page and a service worker that keeps them. `extra`: more files. */
function fixture(extra = {}) {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  dirs.push(dist);
  const files = {
    'index.html': '<!doctype html><script type="module" src="./assets/index.js"></script>',
    'assets/index.js': 'fetch("/api/metrics");console.log("מדרגות")',
    'mivchan/index.html': '<!doctype html><p>בלי פרסומות ובלי מעקב.</p>',
    _headers: HEADERS,
    ...extra,
  };
  // the list at the worker's top, as the plugin writes it (check-dist reads it there)
  files['sw.js'] = `self.__PRECACHE = ${JSON.stringify(['index.html', 'assets/index.js'])};\n`;
  for (const [f, text] of Object.entries(files)) { mkdirSync(join(dist, f, '..'), { recursive: true }); writeFileSync(join(dist, f), text); }
  return dist;
}
async function cli(dist) {
  try { const { stdout } = await run(process.execPath, [SCRIPT, dist], { env: { PATH: process.env.PATH } }); return { code: 0, out: stdout }; } catch (e) { return { code: e.code, out: String(e.stderr) }; }
}

describe('check-dist', () => {
  it('passes a clean build', async () => {
    const r = await cli(fixture());
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/is clean/);
  });

  it('refuses a build that loads an analytics or tag-manager script, in the app or on a landing page', async () => {
    const app = await cli(fixture({ 'assets/vendor.js': 'var s=document.createElement("script");s.src="https://www.googletagmanager.com/gtag/js?id=G-X"' }));
    expect(app.code).toBe(1);
    expect(app.out).toMatch(/assets\/vendor\.js: an analytics or ads host \(googletagmanager\.com\)/);
    const page = await cli(fixture({ 'pilot/index.html': '<img src="https://www.facebook.com/tr?id=1&ev=PageView">' }));
    expect(page.code).toBe(1);
    expect(page.out).toMatch(/pilot\/index\.html: an analytics or ads host \(facebook\.com\/tr\)/);
  });

  it('knows the common trackers, and does not mistake a longer name for one', () => {
    for (const host of ['google-analytics.com', 'googletagmanager.com', 'doubleclick.net', 'connect.facebook.net', 'hotjar.com', 'segment.io', 'mixpanel.com', 'amplitude.com', 'clarity.ms']) {
      expect(TRACKERS, host).toContain(host);
      expect(trackerIn(`https://${host}/x.js`), host).toBe(host);
    }
    expect(trackerIn('https://www.clarity.ms/tag/abc')).toBe('clarity.ms');
    expect(trackerIn('notgoogle-analytics.com and madregot.example.test')).toBeNull();
    expect(trackerIn('the word amplitude in a lesson')).toBeNull();
  });

  it('still refuses a secret and a service worker that keeps a missing file', () => {
    const secret = checkDist(fixture({ 'assets/a.js': 'const k = "sk-ant-api03-abc"' }));
    expect(secret.join('\n')).toMatch(/an Anthropic API key/);
    const dist = fixture();
    writeFileSync(join(dist, 'sw.js'), 'self.__PRECACHE = ["index.html", "gone.js"];\n');
    expect(checkDist(dist).join('\n')).toMatch(/sw\.js: keeps gone\.js/);
  });
});
