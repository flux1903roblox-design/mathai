// The placement test's numbers (lib/placement.js re-exports them) and the onboarding's familiarity answers. In a file of
// their own (COUNCIL2-14), so the welcome screen and the board read them without loading the test's code, its items and
// the exercise generators, which come with the test.
import { placementTopicsFor } from '@/content/index.js';

import { localized, t } from '@/lib/i18n.js';
/** Probes per topic. */
export const PER_TOPIC = 2;
/** Questions in one probe: all of them right to pass the level. */
export const PROBE_LEN = 3;
export const PLACEMENT_XP = 10;
/** The most questions the placement test of a grade can ask (every probe of every tested topic to its last question). */
export const placementMax = (grade = '7') => placementTopicsFor(grade).length * PER_TOPIC * PROBE_LEN;
/** How much of the grade's material feels familiar (onboarding answer) → where the first question sits, as a share of the topic. */
export let KNOW = localized(() => ([
  { id: 0, title: t('shell.placementrules.1'), sub: t('shell.placementrules.2'), share: 0 },
  { id: 1, title: t('shell.placementrules.3'), sub: t('shell.placementrules.4'), share: 0.4 },
  { id: 2, title: t('shell.placementrules.5'), sub: t('shell.placementrules.6'), share: 0.6 },
  { id: 3, title: t('shell.placementrules.7'), sub: t('shell.placementrules.8'), share: 0.8 },
]), (v) => { KNOW = v; });

