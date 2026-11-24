// Whose questions these are: the learner's grade, for the few kinds of question a stair asks only in one grade. Unit 8.3
// completes the angles between parallel lines in ח׳ (angles written with x, the converse, a helper line through a point
// between the lines: content/angleItems.js), on angles:4, which ז׳ learns in September to November, months before its
// equations (unit 7.8, March). lib/store.js sets the grade from the profile; with none set (a test, a guest, a teacher
// with no class grade) every kind is drawn. Plain JS with no imports, so the first load carries only these few lines.
let grade = null;

/** The learner's grade from the profile: '7', '8', or null when it is not known. */
export function setLearnerGrade(g) { grade = g === '7' || g === '8' ? g : null; }

/** The learner's grade, or null. */
export const learnerGrade = () => grade;

/** May a question of ח׳'s continuation of a ז׳ unit be drawn? Yes, unless the learner is known to be in ז׳. */
export const grade8Kinds = () => grade !== '7';

/** The stairs whose teaching has the continuation's steps too, shown where grade8Kinds() is (learn/content/angles.ts). */
export const GRADE8_TEACHING = Object.freeze(['angles:4']);
