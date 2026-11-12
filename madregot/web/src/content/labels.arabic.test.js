// The label properties again, with the app in Arabic (COUNCIL2-34): every Arabic topic's generators (the Arabic twins
// of its files) give each mistake the label its answer shows, exactly as the Hebrew ones do.
import { loadLocale, resetLocaleForTests } from '@/lib/i18n.js';
import { ARABIC_TOPICS } from './arabic.js';

await loadLocale('ar');
resetLocaleForTests('ar');
globalThis.__ONLY_TOPICS = ARABIC_TOPICS;
await import('./labels.test.js');
