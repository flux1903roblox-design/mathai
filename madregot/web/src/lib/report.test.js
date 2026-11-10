// The class report's ranges (lib/report.js, spec TEACHER-7 §2): this week from Sunday, two weeks, this month, the school
// year from 1 September (the previous one before September), a range the teacher types, and the range's words.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
beforeEach(() => { vi.stubGlobal('localStorage', fakeStorage()); vi.stubGlobal('sessionStorage', fakeStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });
const load = async () => { vi.resetModules(); return import('./report.js'); };

describe('the ranges of the class report', () => {
  it('this week starts on Sunday; two weeks are 14 days; this month starts on the 1st', async () => {
    const { rangeDays } = await load();
    expect(rangeDays('week', '2026-11-05')).toEqual({ from: '2026-11-01', to: '2026-11-05' }); // a Thursday
    expect(rangeDays('week', '2026-11-01')).toEqual({ from: '2026-11-01', to: '2026-11-01' }); // a Sunday
    expect(rangeDays('week', '2026-11-07')).toEqual({ from: '2026-11-01', to: '2026-11-07' }); // a Saturday
    expect(rangeDays('two', '2026-11-05')).toEqual({ from: '2026-10-23', to: '2026-11-05' });
    expect(rangeDays('nonsense', '2026-11-05')).toEqual({ from: '2026-10-23', to: '2026-11-05' });
    expect(rangeDays('month', '2026-11-05')).toEqual({ from: '2026-11-01', to: '2026-11-05' });
  });
  it('the school year starts on 1 September; before September, the previous one', async () => {
    const { rangeDays, schoolYearStart } = await load();
    expect(rangeDays('year', '2026-11-05')).toEqual({ from: '2026-09-01', to: '2026-11-05' });
    expect(schoolYearStart('2026-09-01')).toBe('2026-09-01');
    expect(schoolYearStart('2026-08-31')).toBe('2025-09-01');
    expect(schoolYearStart('2027-06-20')).toBe('2026-09-01');
  });
  it('a typed range: both days, in order, up to today, 400 days at most', async () => {
    const { customRange } = await load();
    expect(customRange('2026-10-01', '2026-10-31', '2026-11-05')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(customRange('2026-11-05', '2026-11-05', '2026-11-05')).toEqual({ from: '2026-11-05', to: '2026-11-05' });
    expect(customRange('2026-10-31', '2026-10-01', '2026-11-05')).toBe(null);
    expect(customRange('2026-10-01', '2026-11-06', '2026-11-05')).toBe(null);
    expect(customRange('', '2026-11-05', '2026-11-05')).toBe(null);
    expect(customRange('2025-10-02', '2026-11-05', '2026-11-05')).toEqual({ from: '2025-10-02', to: '2026-11-05' }); // 400 days
    expect(customRange('2025-10-01', '2026-11-05', '2026-11-05')).toBe(null); // 401
  });
  it('the range in words: one year written once, two when they differ', async () => {
    const { rangeText } = await load();
    expect(rangeText('2026-11-01', '2026-11-05')).toBe('1.11–5.11.2026');
    expect(rangeText('2025-12-20', '2026-01-04')).toBe('20.12.2025–4.1.2026');
  });
});
