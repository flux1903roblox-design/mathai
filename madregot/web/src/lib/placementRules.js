// The placement test's numbers (lib/placement.js re-exports them) and the onboarding's familiarity answers. In a file of
// their own, so the welcome screen and the board read them without loading the test's code, its items and the exercise
// generators, which come with the test (the boot split, QA_DURABLE.md).
import { placementTopicsFor } from '@/content/topics.js';

/** Probes per topic. */
export const PER_TOPIC = 2;
/** Questions in one probe: all of them right to pass the level. */
export const PROBE_LEN = 3;
export const PLACEMENT_XP = 10;
/** The most questions the placement test of a grade can ask (every probe of every tested topic to its last question). */
export const placementMax = (grade = '7') => placementTopicsFor(grade).length * PER_TOPIC * PROBE_LEN;
/** How much of the grade's material feels familiar (onboarding answer) → where the first question sits, as a share of the topic. */
export const KNOW = [
  { id: 0, title: 'הכול חדש לי', sub: 'מתחילים מהמדרגה הראשונה', share: 0 },
  { id: 1, title: 'קצת מוכר', sub: 'למדנו חלק מהנושאים', share: 0.4 },
  { id: 2, title: 'רוב החומר מוכר', sub: 'צריך בעיקר תרגול', share: 0.6 },
  { id: 3, title: 'הכול מוכר', sub: 'רוצים אתגר', share: 0.8 },
];
