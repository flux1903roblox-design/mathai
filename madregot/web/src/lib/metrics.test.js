// count() (STUDENT-14): a beacon with the plain name to the server's /api/metrics, only where there is a server, and
// never an error. Every count('…') in the app uses a name the server accepts (worker/src/metrics.js METRIC_NAMES).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useApp } from './store.js';
import { count } from './metrics.js';
import { METRIC_NAMES } from '../../../worker/src/metrics.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const beacon = vi.fn(() => true);

beforeEach(() => {
  beacon.mockClear();
  vi.stubGlobal('navigator', { sendBeacon: beacon });
  vi.stubGlobal('window', { location: { origin: 'https://madregot.example.test' } });
});
afterEach(() => { vi.unstubAllGlobals(); useApp.getState().setAI({ apiUrl: '' }); });

describe('count', () => {
  it('sends the plain name to the server, and nothing else', () => {
    useApp.getState().setAI({ apiUrl: 'https://api.example.test/' });
    expect(count('install_offer')).toBe(true);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon).toHaveBeenCalledWith('https://api.example.test/api/metrics', 'install_offer');
  });

  it('does nothing with no server', () => {
    useApp.getState().setAI({ apiUrl: 'none' });
    expect(count('install_offer')).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
  });

  it('does nothing where the browser has no beacon, and never throws', () => {
    useApp.getState().setAI({ apiUrl: 'https://api.example.test' });
    vi.stubGlobal('navigator', {});
    expect(count('installed')).toBe(false);
    vi.stubGlobal('navigator', { sendBeacon: () => { throw new Error('blocked'); } });
    expect(count('installed')).toBe(false);
  });

  it('every count(…) in the app names a metric the server accepts', () => {
    const src = path.resolve(here, '..');
    const files = [];
    const walk = (d) => readdirSync(d).forEach((f) => { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f)) files.push(p); });
    walk(src);
    const used = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\bcount\('([a-z_]+)'\)/g)].map((m) => m[1]));
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) expect(METRIC_NAMES, name).toContain(name);
  });
});
