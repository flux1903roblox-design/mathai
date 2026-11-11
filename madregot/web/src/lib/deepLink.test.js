// Links from the landing pages (STUDENT-13): only allowed places, the teacher's way in by start=teacher or its alias,
// and one welcome_from_landing count per load for the two pages' sources.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { deepLink, countFromLanding, resetLandingCount, NEXT_ALLOWED } from './deepLink.js';

describe('deepLink', () => {
  it('reads the parents\' page link', () => {
    expect(deepLink('?next=/rescue&src=mivchan')).toEqual({ next: '/rescue', teacher: false, src: 'mivchan' });
  });

  it('reads the schools\' page link, and role=teacher as the same', () => {
    expect(deepLink('?start=teacher&src=pilot')).toEqual({ next: null, teacher: true, src: 'pilot' });
    expect(deepLink('?role=teacher')).toEqual({ next: null, teacher: true, src: null });
    expect(deepLink('?next=/teacher')).toEqual({ next: null, teacher: true, src: null });
  });

  it('takes only the allowed places and sources', () => {
    for (const next of NEXT_ALLOWED.filter((n) => n !== '/teacher')) expect(deepLink(`?next=${next}`).next).toBe(next);
    for (const bad of ['https://evil.example', '//evil.example', '/settings', '/rescue/check', 'rescue', '/parents/../x', '']) {
      expect(deepLink(`?next=${encodeURIComponent(bad)}`).next).toBeNull();
    }
    expect(deepLink('?src=ads').src).toBeNull();
    expect(deepLink('?start=demo').teacher).toBe(false);
    expect(deepLink('')).toEqual({ next: null, teacher: false, src: null });
    expect(deepLink(undefined)).toEqual({ next: null, teacher: false, src: null });
  });
});

describe('countFromLanding', () => {
  const beacon = vi.fn(() => true);
  beforeEach(() => {
    resetLandingCount();
    beacon.mockClear();
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    useApp.getState().setAI({ apiUrl: 'https://api.example.test' });
  });
  afterEach(() => { vi.unstubAllGlobals(); useApp.getState().setAI({ apiUrl: '' }); });

  it('counts welcome_from_landing once per load, and only for the two pages', () => {
    expect(countFromLanding(deepLink('?next=/rescue'))).toBe(false);
    expect(countFromLanding(deepLink('?next=/rescue&src=mivchan'))).toBe(true);
    expect(countFromLanding(deepLink('?start=teacher&src=pilot'))).toBe(false);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon).toHaveBeenCalledWith('https://api.example.test/api/metrics', 'welcome_from_landing');
  });
});
