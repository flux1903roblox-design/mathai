// When the iPhone Home Screen guide is offered (DURABLE-3): iOS in the browser only, Learn's card from the 3rd day the
// student learned, and not again for 30 days.
import { describe, it, expect } from 'vitest';
import { isIos, isStandalone, guideHere, activeDays, hasProgress, hintedRecently, showLearnCard } from './install.js';

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 };
const IPAD = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', maxTouchPoints: 5 };
const MAC = { userAgent: IPAD.userAgent, maxTouchPoints: 0 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36', maxTouchPoints: 5 };
const browserWin = { matchMedia: () => ({ matches: false }) };
const appWin = { matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) };
const NOW = new Date('2026-11-05T10:00:00Z');
const day = (lessons = 1) => ({ lessons, q: 8, ok: 7, xp: 15 });
const st = (n, extra = {}) => ({
  profile: { role: 'student', name: 'נועה', grade: '7' },
  days: Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-11-0${i + 1}`, day()])),
  xp: n * 15, durable: { installHintAt: null }, ...extra,
});

describe('where the guide applies', () => {
  it('an iPhone or an iPad in the browser; not a Mac, not Android, not the Home Screen app', () => {
    expect(isIos(IPHONE)).toBe(true);
    expect(isIos(IPAD)).toBe(true);
    expect(isIos(MAC)).toBe(false);
    expect(isIos(ANDROID)).toBe(false);
    expect(isStandalone({ win: appWin, nav: IPHONE })).toBe(true);
    expect(isStandalone({ win: browserWin, nav: { ...IPHONE, standalone: true } })).toBe(true);
    expect(guideHere({ win: browserWin, nav: IPHONE })).toBe(true);
    expect(guideHere({ win: appWin, nav: IPHONE })).toBe(false);
    expect(guideHere({ win: browserWin, nav: ANDROID })).toBe(false);
  });
});

describe('Learn\'s card', () => {
  const on = { win: browserWin, nav: IPHONE, now: NOW };
  it('from the 3rd day the student learned', () => {
    expect(showLearnCard(st(2), on)).toBe(false);
    expect(showLearnCard(st(3), on)).toBe(true);
    // days with answers but no finished lesson in this version do not count
    expect(activeDays({ a: { lessons: 0, q: 5 }, b: day(), c: { stages: 1 } })).toBe(2);
  });
  it('needs progress, an iPhone in the browser and a student', () => {
    expect(hasProgress({ days: {}, xp: 0 })).toBe(false);
    expect(hasProgress({ days: {}, xp: 5 })).toBe(true);
    expect(showLearnCard(st(3), { ...on, win: appWin })).toBe(false);
    expect(showLearnCard(st(3), { ...on, nav: ANDROID })).toBe(false);
    expect(showLearnCard(st(3, { profile: { role: 'teacher', name: 'רונית', classes: [] } }), on)).toBe(false);
  });
  it('not again for 30 days after it was offered', () => {
    const at = (d) => new Date(NOW.getTime() - d * 864e5).toISOString();
    expect(hintedRecently(at(29), NOW)).toBe(true);
    expect(hintedRecently(at(30), NOW)).toBe(false);
    expect(hintedRecently(null, NOW)).toBe(false);
    expect(showLearnCard(st(3, { durable: { installHintAt: at(1) } }), on)).toBe(false);
    expect(showLearnCard(st(3, { durable: { installHintAt: at(31) } }), on)).toBe(true);
  });
});
