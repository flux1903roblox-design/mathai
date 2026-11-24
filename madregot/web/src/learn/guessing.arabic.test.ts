// The guessing measure again, with the app in Arabic (COUNCIL2-34): an Arabic topic's checks and placement, made from
// its Arabic teaching and exercises, cannot be passed by guessing either.
// @ts-ignore: plain JS
import { loadLocale, resetLocaleForTests } from '@/lib/i18n.js';
// @ts-ignore: plain JS
import { ARABIC_TOPICS } from '@/content/arabic.js';

import { it, expect } from 'vitest';

// No topic has its Arabic since the round-3 merge (content/arabic.js): the measure runs again with the first one.
if (ARABIC_TOPICS.length) {
  await loadLocale('ar');
  resetLocaleForTests('ar');
  (globalThis as { __ONLY_TOPICS?: readonly string[] }).__ONLY_TOPICS = ARABIC_TOPICS;
  await import('./guessing.test');
} else {
  it('no topic is taught in Arabic now, so there is no Arabic check to measure', () => expect(ARABIC_TOPICS).toEqual([]));
}
