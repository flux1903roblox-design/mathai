// A lesson's numbers (lib/lesson.js re-exports them): how long each kind of lesson is, how many lessons complete a node,
// and the XP of each step. In a file of their own, so the map, the path and the store read them without loading the
// lesson's code, its items and the exercise generators, which come with the lesson (the boot split, QA_DURABLE.md).
export const LESSON_LEN = 8;
export const REVIEW_LEN = 10;
/** Multiplication facts practice (/facts): eight facts, practice rules (hints, a second try, a miss comes back). */
export const FACTS_LEN = 8;
export const JUMP_LEN = 5;
export const JUMP_MISTAKES = 1; // a jump test allows one mistake
export const PARTS = 2; // lessons that complete a node on the path
export const REDO_MAX = 2;
/** XP for finishing a teaching stage the first time (A understand, B worked examples, C solve together): about the
 * same per minute as a practice lesson, so a first session spent learning reaches the daily goal. */
export const STAGE_XP = { A: 10, B: 5, C: 10 };
export const XP = { lesson: 10, review: 15, jump: 10, perfect: 5, fix: 2, mastery: 15, recall: 5, verify: 5, diagnostic: 5, exam: 10 }; // fix: each mistake corrected at the end of a lesson
export const COMBO_MARKS = [5, 10];
