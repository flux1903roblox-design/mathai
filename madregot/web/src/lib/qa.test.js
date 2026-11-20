// The test hooks' gate (lib/qa.js): they hand out the exercise on screen WITH ITS ANSWER, so only the builds made for
// testing may turn them on. A build that ships (no VITE_QA_HOOKS) never does, whatever the device keeps: a student who
// types localStorage.setItem('madregot-debug', '1') in the public app must not read the answers of a mastery check, a
// class exam or a practice exam. The staging copy (VITE_QA_HOOKS=1) is always on; the test builds (VITE_QA_HOOKS=flag)
// and the dev server wait for the flag, as the e2e tests set it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { qaOn } from './qa.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
/** The build the gate runs in: VITE_QA_HOOKS as given ('' = not set) and the dev server or a built app. */
function build(mode, { dev = false } = {}) {
  vi.stubEnv('VITE_QA_HOOKS', mode);
  vi.stubEnv('DEV', dev);
  vi.stubEnv('PROD', !dev);
}
beforeEach(() => { vi.stubGlobal('localStorage', fakeStorage()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('qaOn: which builds may expose the answers', () => {
  it('a build that ships (no VITE_QA_HOOKS): never, even with the debug flag set on the device', () => {
    build('');
    expect(qaOn()).toBe(false);
    localStorage.setItem('madregot-debug', '1');
    expect(qaOn()).toBe(false);
    // a value the build does not know is a build that ships
    build('0');
    expect(qaOn()).toBe(false);
    build('true');
    expect(qaOn()).toBe(false);
  });

  it('the staging copy (VITE_QA_HOOKS=1): always, with or without the flag', () => {
    build('1');
    expect(qaOn()).toBe(true);
    localStorage.setItem('madregot-debug', '1');
    expect(qaOn()).toBe(true);
  });

  it('the test builds (VITE_QA_HOOKS=flag) and the dev server: only once the flag is set, as the e2e tests do', () => {
    for (const [mode, dev] of [['flag', false], ['', true]]) {
      vi.stubGlobal('localStorage', fakeStorage());
      build(mode, { dev });
      expect(qaOn(), `${mode || 'dev'} without the flag`).toBe(false);
      localStorage.setItem('madregot-debug', '1');
      expect(qaOn(), `${mode || 'dev'} with the flag`).toBe(true);
    }
  });

  it('storage that throws (blocked) reads as off', () => {
    build('flag');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(qaOn()).toBe(false);
  });
});

describe('one gate', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = (dir) => readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(js|jsx|ts|tsx|mjs)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });

  it('no file but lib/qa.js reads the debug flag or VITE_QA_HOOKS: every hook asks qaOn()', () => {
    const readers = files(SRC)
      .filter((p) => /madregot-debug|VITE_QA_HOOKS/.test(readFileSync(p, 'utf8').replace(/^\s*\/\/.*$/gm, '')))
      .map((p) => path.relative(SRC, p).split(path.sep).join('/'));
    expect(readers).toEqual(['lib/qa.js']);
  });
});
