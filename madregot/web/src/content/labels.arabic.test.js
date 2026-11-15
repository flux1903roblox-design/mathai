// The label properties again, with the app in Arabic (COUNCIL2-34): every Arabic topic's generators (the Arabic twins
// of its files) give each mistake the label its answer shows, exactly as the Hebrew ones do.
import { loadLocale, resetLocaleForTests } from '@/lib/i18n.js';
import { ARABIC_TOPICS } from './arabic.js';

import { it, expect } from 'vitest';

// No topic has its Arabic since the round-3 merge (content/arabic.js): the labels run again with the first one.
if (ARABIC_TOPICS.length) {
  await loadLocale('ar');
  resetLocaleForTests('ar');
  globalThis.__ONLY_TOPICS = ARABIC_TOPICS;
  await import('./labels.test.js');
} else {
  it('no topic is taught in Arabic now, so there are no Arabic labels to check', () => expect(ARABIC_TOPICS).toEqual([]));
}
