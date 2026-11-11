// The security headers a Ministry catalogue technical check expects (spec TEACHER-12 §2) already ship in
// public/_headers; this holds them there, and proves scripts/check-dist.mjs refuses a build whose _headers lost one
// (its command line exits 1 on the problems distProblems returns).
import { describe, test, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_HEADERS, parseHeaders, headerProblems } from '../scripts/headers.mjs';
import { distProblems } from '../scripts/check-dist.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(path.join(WEB, 'public', '_headers'), 'utf8');

describe('public/_headers', () => {
  test('carries the CSP with frame-ancestors \'none\', nosniff, Referrer-Policy and Permissions-Policy on every page', () => {
    const all = parseHeaders(SOURCE)['/*'];
    expect(all).toBeTruthy();
    expect(all['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(all['content-security-policy']).toContain("object-src 'none'");
    expect(all['x-content-type-options']).toBe('nosniff');
    expect(all['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(all['permissions-policy']).toMatch(/microphone=\(\)/);
    expect(headerProblems(SOURCE)).toEqual([]);
    expect(Object.keys(REQUIRED_HEADERS)).toEqual(['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']);
  });

  test('a missing header or a CSP without frame-ancestors \'none\' is named', () => {
    const without = (name) => SOURCE.split('\n').filter((l) => !l.trim().toLowerCase().startsWith(`${name.toLowerCase()}:`)).join('\n');
    expect(headerProblems(without('X-Content-Type-Options'))).toEqual(['X-Content-Type-Options is missing']);
    expect(headerProblems(without('Permissions-Policy'))).toEqual(['Permissions-Policy is missing']);
    expect(headerProblems(SOURCE.replace("frame-ancestors 'none'", "frame-ancestors 'self'"))).toEqual(["Content-Security-Policy lacks frame-ancestors 'none'"]);
    expect(headerProblems('')).toEqual(['no "/*" block']);
  });
});

describe('scripts/check-dist.mjs', () => {
  /** A copy of what a build ships from public/ (vite copies the folder as it is), plus a page. */
  function distCopy(headers) {
    const dir = mkdtempSync(path.join(tmpdir(), 'madregot-dist-'));
    cpSync(path.join(WEB, 'public'), dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>מדרגות</title>');
    if (headers === null) rmSync(path.join(dir, '_headers'));
    else writeFileSync(path.join(dir, '_headers'), headers);
    return dir;
  }

  test('passes a build with the headers, and fails one whose _headers lacks X-Content-Type-Options, or has none', () => {
    const good = distCopy(SOURCE);
    const noSniff = distCopy(SOURCE.split('\n').filter((l) => !/X-Content-Type-Options/i.test(l)).join('\n'));
    const none = distCopy(null);
    try {
      expect(distProblems(good)).toEqual([]);
      expect(distProblems(noSniff)).toEqual(['_headers: X-Content-Type-Options is missing']);
      expect(distProblems(none)).toEqual(['_headers: missing (the security headers)']);
      // the rules it had before stay: a secret in a file is named too
      writeFileSync(path.join(good, 'leak.js'), 'const k = "sk-ant-abc";');
      expect(distProblems(good)).toEqual(['leak.js: an Anthropic API key (sk-ant-)']);
    } finally {
      for (const d of [good, noSniff, none]) rmSync(d, { recursive: true, force: true });
    }
  });
});
