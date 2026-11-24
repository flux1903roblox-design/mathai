// A finished challenge's XP (CURRICULUM-6.2), on its own so the store (in the first load) can give it without the
// grading code and the number reading it uses (grade.ts and content/util.js load with the challenge screen).
export const XP_BASE = 20;
export const XP_PER_FIRST_TRY = 5;
export const XP_MAX = 40;

/** The XP of a finished task: 20, plus 5 per part right on the first try, at most 40. */
export const challengeXP = (firstTry: number) => Math.min(XP_MAX, XP_BASE + XP_PER_FIRST_TRY * Math.max(0, firstTry));
