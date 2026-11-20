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
import { TRACKERS, trackerIn, checkDist, arabicProblems, qaHookProblems } from './check-dist.mjs';

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

  it('refuses a default build (no VITE_ARABIC=on) that could fetch anything Arabic: a chunk, the catalogue in a script, a kept file, or a page that says it has Arabic', async () => {
    const meta = (v) => `<!doctype html><meta name="madregot-arabic" content="${v}" /><script type="module" src="./assets/index.js"></script>`;
    expect(arabicProblems(fixture({ 'index.html': meta('off') }))).toEqual([]);
    // an Arabic chunk, as the bundler names the catalogue and the content twins
    const chunk = await cli(fixture({ 'assets/shell.ar-BxY12z.js': 'export default {}' }));
    expect(chunk.code).toBe(1);
    expect(chunk.out).toMatch(/assets\/shell\.ar-BxY12z\.js: an Arabic file in a build made without VITE_ARABIC=on/);
    // the Arabic catalogue bundled into another script
    expect(arabicProblems(fixture({ 'assets/index.js': 'const x = {"shell.welcome.1":"رياضيات نفهمها. ونتقدّم فيها."}' })).join('\n')).toMatch(/assets\/index\.js: holds the Arabic catalogue/);
    // a page that says "on"
    expect(arabicProblems(fixture({ 'index.html': meta('on') })).join('\n')).toMatch(/index\.html: says Arabic is "on" in a build made with VITE_ARABIC off/);
    // Rubik's Arabic part kept for offline use (it is in every build's assets; it must not be on the list)
    const kept = fixture({ 'assets/rubik-arabic-wght-normal-x.woff2': 'font' });
    writeFileSync(join(kept, 'sw.js'), 'self.__PRECACHE = ["index.html", "assets/rubik-arabic-wght-normal-x.woff2"];\n');
    expect(arabicProblems(kept).join('\n')).toMatch(/sw\.js: keeps the Arabic file assets\/rubik-arabic-wght-normal-x\.woff2/);
    expect(arabicProblems(fixture({ 'assets/rubik-arabic-wght-normal-x.woff2': 'font' }))).toEqual([]);
    // a build made with the flag on may have all of it, and must say so
    const on = fixture({ 'index.html': meta('on'), 'assets/shell.ar-BxY12z.js': 'export default {"a":"رياضيات نفهمها"}' });
    expect(arabicProblems(on, { arabic: true })).toEqual([]);
    expect(arabicProblems(fixture({ 'index.html': meta('off') }), { arabic: true }).join('\n')).toMatch(/says Arabic is "off" in a build made with VITE_ARABIC on/);
    const cliOn = await run(process.execPath, [SCRIPT, on], { env: { PATH: process.env.PATH, VITE_ARABIC: 'on' } });
    expect(cliOn.stdout).toMatch(/is clean \(Arabic compiled in: VITE_ARABIC=on\)/);
  });

  it('refuses a build that a student could switch to show the answers (madregot-debug), unless it is a test build', async () => {
    // the gate as the build that shipped until now compiled it (lib/qa.js read the device's flag in every build)
    const leaky = { 'assets/Lesson-x.js': 'u.useEffect(()=>{let r=!1;try{r=r||!!localStorage.getItem("madregot-debug")}catch{}if(!r)return;window.__madregotItem=l})' };
    const cli1 = await cli(fixture(leaky));
    expect(cli1.code).toBe(1);
    expect(cli1.out).toMatch(/assets\/Lesson-x\.js: the test hooks' switch \(madregot-debug\)/);
    // the gate as a build that ships compiles it now: off, with nothing to turn it on
    expect(qaHookProblems(fixture({ 'assets/index.js': 'function s1(){return!1}' }))).toEqual([]);
    // the staging copy (VITE_QA_HOOKS=1) has its hooks on without a switch, so it holds none either
    expect(qaHookProblems(fixture(leaky), { qa: '1' })).toHaveLength(1);
    // a test build (VITE_QA_HOOKS=flag: the e2e builds) keeps the switch, and says so
    expect(qaHookProblems(fixture(leaky), { qa: 'flag' })).toEqual([]);
    const cliFlag = await run(process.execPath, [SCRIPT, fixture(leaky)], { env: { PATH: process.env.PATH, VITE_QA_HOOKS: 'flag' } });
    expect(cliFlag.stdout).toMatch(/is clean.*\(a test build: VITE_QA_HOOKS=flag\)/);
  });

  it('still refuses a secret and a service worker that keeps a missing file', () => {
    const secret = checkDist(fixture({ 'assets/a.js': 'const k = "sk-ant-api03-abc"' }));
    expect(secret.join('\n')).toMatch(/an Anthropic API key/);
    const dist = fixture();
    writeFileSync(join(dist, 'sw.js'), 'self.__PRECACHE = ["index.html", "gone.js"];\n');
    expect(checkDist(dist).join('\n')).toMatch(/sw\.js: keeps gone\.js/);
  });
});
