// The Ministry's programme and the app's coverage of it, bound to the stairs this build has (ALL_SKILLS).
// The data and the arithmetic live in madregot/shared (plain JS the Worker shares); this file only binds them.
import { PROGRAMME, ROADMAP_NEXT } from '@shared/programme.js';
import { coverage, notYet, monthIndex, schoolMonth, coverageSentence, monthsText, hoursText, inSchoolOrder, GRADE_NAME } from '@shared/coverage.js';
import { ALL_SKILLS } from './skills';

export type Grade = '7' | '8';

/** How much of a grade's programme the app teaches today, unit by unit (hours, state, stairs, missing parts). */
export const coverageOf = (grade: Grade) => coverage(grade, ALL_SKILLS);

/** What a grade's programme has that the app does not teach yet, in a few Hebrew words per part. */
export const notYetOf = (grade: Grade): string[] => notYet(grade, ALL_SKILLS);

export { PROGRAMME, ROADMAP_NEXT, monthIndex, schoolMonth, coverageSentence, monthsText, hoursText, inSchoolOrder, GRADE_NAME };
