// The Play Store app's Bubblewrap file (STUDENT-12 §2): store/android/twa-manifest.json is a template that make.sh
// fills. It starts as a store app (?src=play), keeps notifications, falls back to a Custom Tab, carries the web
// manifest's shortcuts, and its signing key is never in the repository. make.sh --manifest-only is run for real here
// (no download, no key, no build).
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME } from '../../shared/brand.js';

const STORE = fileURLToPath(new URL('../../store/android/', import.meta.url));
const template = JSON.parse(readFileSync(join(STORE, 'twa-manifest.json'), 'utf8'));
const web = JSON.parse(readFileSync(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), 'utf8'));

const run = promisify(execFile);
/** make.sh run for real (asynchronously, so the test worker stays responsive), in a folder of its own. */
async function make(env, args = ['--manifest-only']) {
  const dir = mkdtempSync(join(tmpdir(), 'twa-'));
  try {
    const { stdout } = await run('bash', [join(STORE, 'make.sh'), ...args], {
      env: { PATH: process.env.PATH, HOME: dir, TWA_DIR: join(dir, 'twa'), KEYSTORE: join(dir, 'keys', 'upload.keystore'), ...env }, encoding: 'utf8',
    });
    return { out: stdout, manifest: JSON.parse(readFileSync(join(dir, 'twa', 'twa-manifest.json'), 'utf8')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
async function fails(env) {
  try { await make(env); } catch (e) { return String(e.stderr); }
  throw new Error('make.sh did not refuse');
}

describe('store/android/twa-manifest.json', () => {
  it('opens the site as the Play Store app, with notifications and a Custom Tab fallback', () => {
    expect(template).toMatchObject({
      packageId: '<ANDROID_PACKAGE>', host: '<PUBLIC_HOST>', name: '<APP_NAME>', launcherName: '<APP_NAME>',
      startUrl: '/#/?src=play', enableNotifications: true, fallbackType: 'customtabs', display: 'standalone',
      themeColor: '#FFFFFF', backgroundColor: '#FFFFFF',
      iconUrl: 'https://<PUBLIC_HOST>/icons/512.png', maskableIconUrl: 'https://<PUBLIC_HOST>/icons/maskable-512.png',
      webManifestUrl: 'https://<PUBLIC_HOST>/manifest.webmanifest',
    });
    // nothing to sell in the app: Play Billing stays off
    expect(template.features).toEqual({});
  });

  it('carries the web manifest\'s three shortcuts, each also marked as the store app', () => {
    expect(template.shortcuts.length).toBe(web.shortcuts.length);
    template.shortcuts.forEach((s, i) => {
      const w = web.shortcuts[i];
      expect(s.name).toBe(w.name);
      // the web manifest's ./#/… address on the site, with src=play (a shortcut can be the first launch)
      const [path, query] = w.url.replace(/^\.\//, '/').split('?');
      expect(s.url).toBe(`https://<PUBLIC_HOST>${path}?${query ? `${query}&` : ''}src=play`);
      expect(s.chosenIconUrl).toBe(`https://<PUBLIC_HOST>/${w.icons[0].src}`);
    });
  });

  it('keeps the signing key outside: the template names no path, make.sh fills one', () => {
    expect(template.signingKey).toEqual({ path: '<KEYSTORE>', alias: 'upload' });
  });
});

describe('store/android/make.sh --manifest-only', () => {
  it('fills the package, the host, the name, the version and the key path, and leaves no placeholder', async () => {
    const { manifest, out } = await make({ ANDROID_PACKAGE: 'il.example.madregot', PUBLIC_URL: 'https://madregot.example.test/', ANDROID_VERSION_CODE: '7', ANDROID_VERSION_NAME: '1.2.0' });
    expect(out).toMatch(/il\.example\.madregot, madregot\.example\.test, version 1\.2\.0 \/ 7/);
    expect(manifest).toMatchObject({
      packageId: 'il.example.madregot', host: 'madregot.example.test', name: APP_NAME, launcherName: APP_NAME,
      startUrl: '/#/?src=play', appVersionCode: 7, appVersion: '1.2.0', iconUrl: 'https://madregot.example.test/icons/512.png',
    });
    expect(manifest.signingKey.path).toMatch(/keys\/upload\.keystore$/);
    expect(manifest.shortcuts[0].url).toBe('https://madregot.example.test/#/?go=today&src=play');
    expect(JSON.stringify(manifest)).not.toMatch(/<[A-Z_]+>/);
  });

  it('refuses an address that is not https at the site root, a package that is not one, and a key inside the repository', async () => {
    const ok = { ANDROID_PACKAGE: 'il.example.madregot', PUBLIC_URL: 'https://madregot.example.test' };
    expect(await fails({ ...ok, PUBLIC_URL: 'http://madregot.example.test' })).toMatch(/https/);
    expect(await fails({ ...ok, PUBLIC_URL: 'https://madregot.example.test/app/' })).toMatch(/site root/);
    expect(await fails({ ...ok, ANDROID_PACKAGE: 'Madregot' })).toMatch(/not a package id/);
    expect(await fails({ ...ok, ANDROID_VERSION_CODE: '0' })).toMatch(/ANDROID_VERSION_CODE/);
    expect(await fails({ ...ok, KEYSTORE: join(STORE, 'upload.keystore') })).toMatch(/inside the repository/);
    expect(await fails({ PUBLIC_URL: ok.PUBLIC_URL })).toMatch(/ANDROID_PACKAGE/);
  });
});
