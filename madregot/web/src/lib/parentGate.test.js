// The adult step before the parents' area on a child's device (trust spec TRUST-8): the year rule, where it applies, and
// what it keeps (a flag for the tab and a time; never the year).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { adultYearOk, needsAdultStep, adultPassed, setAdultPassed, startWait, waitUntil, ADULT_KEY, WAIT_KEY, WAIT_MS } from './parentGate.js';
import { STORE_KEY } from './store.js';

/** A plain Storage in memory, for node. */
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), dump: () => Object.fromEntries(m) };
}

const NOW = new Date('2026-11-10T12:00:00');
let session; let local;
beforeEach(() => {
  session = memoryStorage(); local = memoryStorage();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', local);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('adultYearOk', () => {
  it('passes 18 to 100 years before this year (2026: from 1926 to 2008)', () => {
    for (const y of [2008, 1926, 1990, '1990', ' 1985 ']) expect(adultYearOk(y, NOW), String(y)).toBe(true);
  });
  it('fails a child, an impossible age and anything that is not a 4-digit year', () => {
    for (const y of [2009, 2013, 1925, 'abcd', 20, '', null, undefined, '19 90', '1990.0', 1990.5, '٢٠٠٠', -1990]) expect(adultYearOk(y, NOW), String(y)).toBe(false);
  });
  it('follows the year of `now`', () => {
    expect(adultYearOk(2009, new Date('2027-01-01T12:00:00'))).toBe(true);
    expect(adultYearOk(1926, new Date('2027-01-01T12:00:00'))).toBe(false);
  });
});

describe('where the step applies', () => {
  it('on /parents and /parents/link of a device with a student profile and no parent signed in', () => {
    expect(needsAdultStep({ mode: 'home', role: 'student', session: null })).toBe(true);
    expect(needsAdultStep({ mode: 'link', role: 'student', session: null })).toBe(true);
  });
  it('never on /cancel, never with a parent signed in, never without a student profile', () => {
    expect(needsAdultStep({ mode: 'cancel', role: 'student', session: null })).toBe(false);
    expect(needsAdultStep({ mode: 'home', role: 'student', session: { token: 't' } })).toBe(false);
    for (const role of [undefined, null, 'teacher']) expect(needsAdultStep({ mode: 'home', role, session: null })).toBe(false);
  });
  it('once passed, not again in this tab: the flag is <STORE_KEY>-adult in sessionStorage', () => {
    expect(ADULT_KEY).toBe(`${STORE_KEY}-adult`);
    expect(adultPassed()).toBe(false);
    setAdultPassed();
    expect(session.getItem(`${STORE_KEY}-adult`)).toBe('1');
    expect(needsAdultStep({ mode: 'home', role: 'student', session: null })).toBe(false);
  });
});

describe('the 10-minute wait after a year that is not an adult\'s', () => {
  it('closes the field for 10 minutes and keeps a time only, never the year', () => {
    const t = NOW.getTime();
    expect(waitUntil(t)).toBe(0);
    startWait(t);
    expect(WAIT_KEY).toBe(`${STORE_KEY}-adult-wait`);
    expect(local.getItem(WAIT_KEY)).toBe(String(t + WAIT_MS));
    expect(waitUntil(t + 1000)).toBe(t + WAIT_MS);
    expect(waitUntil(t + WAIT_MS)).toBe(0);
    for (const v of [...Object.values(local.dump()), ...Object.values(session.dump())]) expect(v).not.toMatch(/^(19|20)\d\d$/);
  });
  it('a clock moved back never closes it for longer than 10 minutes; a broken value closes nothing', () => {
    const t = NOW.getTime();
    local.setItem(WAIT_KEY, String(t + 10 * WAIT_MS));
    expect(waitUntil(t)).toBe(t + WAIT_MS);
    local.setItem(WAIT_KEY, 'soon');
    expect(waitUntil(t)).toBe(0);
  });
  it('blocked storage never throws: the step simply asks again', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    vi.stubGlobal('sessionStorage', broken); vi.stubGlobal('localStorage', broken);
    expect(() => { setAdultPassed(); startWait(); }).not.toThrow();
    expect(adultPassed()).toBe(false);
    expect(waitUntil()).toBe(0);
  });
});
