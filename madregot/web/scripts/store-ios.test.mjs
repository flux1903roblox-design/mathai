// The iPhone app's Capacitor project (STUDENT-12 §3): store/ios holds the shell's settings, the pinned packages, the
// privacy manifest and make.sh, which writes the project outside the repository. make.sh --config-only is run for real
// here (no build, no download, no Xcode); the rest needs a Mac and is the owner's (store/ios/README.md).
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME } from '../../shared/brand.js';

const IOS = fileURLToPath(new URL('../../store/ios/', import.meta.url));
const WEB = fileURLToPath(new URL('../', import.meta.url));
const read = (f) => readFileSync(join(IOS, f), 'utf8');
const config = JSON.parse(read('capacitor.config.json'));
const pkg = JSON.parse(read('package.json'));

const run = promisify(execFile);
async function make(env, args = ['--config-only']) {
  const dir = mkdtempSync(join(tmpdir(), 'ios-'));
  try {
    const { stdout } = await run('bash', [join(IOS, 'make.sh'), ...args], { env: { PATH: process.env.PATH, HOME: dir, IOS_DIR: join(dir, 'ios-app'), ...env }, encoding: 'utf8' });
    return { out: stdout, config: JSON.parse(readFileSync(join(dir, 'ios-app', 'capacitor.config.json'), 'utf8')), pkg: JSON.parse(readFileSync(join(dir, 'ios-app', 'package.json'), 'utf8')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
async function fails(env, args) {
  try { await make(env, args); } catch (e) { return String(e.stderr); }
  throw new Error('make.sh did not refuse');
}

describe('store/ios', () => {
  it('has the shell\'s settings, the packages, the privacy manifest, make.sh and the owner\'s steps', () => {
    for (const f of ['capacitor.config.json', 'package.json', 'PrivacyInfo.xcprivacy', 'make.sh', 'README.md']) expect(existsSync(join(IOS, f)), f).toBe(true);
    expect(config).toEqual({ appId: '<IOS_BUNDLE_ID>', appName: '<APP_NAME>', webDir: 'www', loggingBehavior: 'none', ios: { contentInset: 'always', scheme: 'capacitor' } });
  });

  it('pins every Capacitor package to an exact version, the same major, with the plugins the app calls', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).sort()).toEqual(['@capacitor/app', '@capacitor/cli', '@capacitor/core', '@capacitor/haptics', '@capacitor/ios', '@capacitor/local-notifications']);
    for (const [name, v] of Object.entries(all)) expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
    expect(new Set(Object.values(all).map((v) => v.split('.')[0]))).toEqual(new Set(['8']));
    expect(all['@capacitor/core']).toBe(all['@capacitor/ios']);
    expect(all['@capacitor/core']).toBe(all['@capacitor/cli']);
  });

  it('keeps Capacitor out of the web app: no package in web/package.json, no import in web/src', () => {
    const web = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));
    expect(Object.keys({ ...web.dependencies, ...web.devDependencies }).filter((n) => n.startsWith('@capacitor/'))).toEqual([]);
    const native = readFileSync(join(WEB, 'src/lib/native.js'), 'utf8');
    expect(native).not.toMatch(/from ['"]@capacitor/);
    // the methods the web app calls are the plugins' own (Capacitor's LocalNotifications and Haptics)
    expect(native).toMatch(/LocalNotifications: \['checkPermissions', 'requestPermissions', 'schedule', 'cancel', 'getPending'\]/);
    expect(native).toMatch(/Haptics: \['impact', 'notification'\]/);
  });

  it('PrivacyInfo.xcprivacy declares no tracking, no tracking domains and nothing collected', () => {
    const plist = read('PrivacyInfo.xcprivacy');
    expect(plist).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    expect(plist).toMatch(/<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/);
    expect(plist).toMatch(/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/);
    expect(plist).toMatch(/<key>NSPrivacyAccessedAPITypes<\/key>\s*<array\/>/);
    expect(plist.trim().startsWith('<?xml')).toBe(true);
  });

  it('make.sh builds the iPhone build from the web folder, syncs it, and makes the app iPhone-only', () => {
    const sh = read('make.sh');
    expect(sh).toMatch(/VITE_STORE=ios VITE_API_URL="\$\{PUBLIC_URL%\/\}" VITE_STORE_CLASS_AI="\$\{VITE_STORE_CLASS_AI:-\}" npx vite build --base \.\/ --outDir "\$IOS_DIR\/www"/);
    expect(sh).toMatch(/npx cap add ios/);
    expect(sh).toMatch(/npx cap sync ios/);
    expect(sh).toMatch(/PrivacyInfo\.xcprivacy" ios\/App\/App\/PrivacyInfo\.xcprivacy/);
    expect(sh).toMatch(/TARGETED_DEVICE_FAMILY = 1;/);
    expect(sh).toMatch(/ITSAppUsesNonExemptEncryption bool false/);
  });

  it('make.sh --config-only fills the bundle id and the name, outside the repository', async () => {
    const { out, config: filled, pkg: copied } = await make({ IOS_BUNDLE_ID: 'il.example.madregot', PUBLIC_URL: 'https://madregot.example.test' });
    expect(filled).toEqual({ ...config, appId: 'il.example.madregot', appName: APP_NAME });
    expect(copied).toEqual(pkg);
    expect(out).toContain('il.example.madregot');
  }, 30_000);

  it('VITE_STORE_CLASS_AI (FOLLOWUP-44): on by default, 0 turns class AI off in the build and says so; anything else is refused', async () => {
    const env = { IOS_BUNDLE_ID: 'il.example.madregot', PUBLIC_URL: 'https://madregot.example.test' };
    expect((await make(env)).out).toContain('class AI in this build: on');
    expect((await make({ ...env, VITE_STORE_CLASS_AI: '1' })).out).toContain('class AI in this build: on');
    expect((await make({ ...env, VITE_STORE_CLASS_AI: '0' })).out).toContain('class AI in this build: off (VITE_STORE_CLASS_AI=0: the free taste only)');
    expect(await fails({ ...env, VITE_STORE_CLASS_AI: 'no' })).toMatch(/VITE_STORE_CLASS_AI is 0/);
    // the owner's one line is in the README's build step
    expect(read('README.md')).toContain('VITE_STORE_CLASS_AI=0 IOS_BUNDLE_ID=il.example.madregot PUBLIC_URL=https://madregot.example bash madregot/store/ios/make.sh');
  }, 30_000);

  it('make.sh refuses a bad bundle id, a plain-http address, missing settings and a folder inside the repository', async () => {
    expect(await fails({ IOS_BUNDLE_ID: 'madregot', PUBLIC_URL: 'https://madregot.example.test' })).toMatch(/not a bundle id/);
    expect(await fails({ IOS_BUNDLE_ID: 'il.example.madregot', PUBLIC_URL: 'http://madregot.example.test' })).toMatch(/must be https/);
    expect(await fails({ PUBLIC_URL: 'https://madregot.example.test' })).toMatch(/IOS_BUNDLE_ID/);
    expect(await fails({ IOS_BUNDLE_ID: 'il.example.madregot', PUBLIC_URL: 'https://madregot.example.test', IOS_DIR: join(IOS, 'out') })).toMatch(/inside the repository/);
  }, 30_000);
});
