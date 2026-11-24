// The Hebrew words of Settings and the parts only it shows (COUNCIL2-34): they come with those screens, which load on
// demand, not with the first download. Arabic has them in settings.ar.json, fetched with the rest of Arabic
// (lib/i18n.js loadLocale). Every module that uses a settings.* key imports this file first.
import { addMessages } from '@/lib/i18n.js';
import SETTINGS_HE from './settings.he.json';

addMessages('he', SETTINGS_HE);
