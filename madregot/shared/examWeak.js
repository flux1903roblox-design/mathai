// The topics to strengthen after an exam (PRODUCT2-31), from its questions alone: the teacher's "מבחנים" tab lists
// them for a class exam solved in the app as it lists the AI's for an exam checked from a photo. The Worker's dashboard
// (worker/src/index.js) and the demo class (web/src/lib/teacherDemo.js) both use this one rule, so they cannot disagree.
// Plain JS with no imports; the Worker imports it as ../../shared/examWeak.js.

/** At most this many topics, as a photo-checked exam keeps (worker/src/index.js POST /api/exams). */
export const WEAK_MAX = 6;

/**
 * The topics with a question that was not right (wrong, partial or missing), the most missed first; a tie keeps the
 * order in which the exam first asked them. `questions`: [{ topic, status }].
 * @param {{ topic?: string, status?: string }[]} questions
 * @param {number} [max]
 * @returns {string[]}
 */
export function examWeak(questions, max = WEAK_MAX) {
  const missed = new Map();
  for (const q of Array.isArray(questions) ? questions : []) {
    if (!q || typeof q.topic !== 'string' || !q.topic || q.status === 'correct') continue;
    missed.set(q.topic, (missed.get(q.topic) || 0) + 1);
  }
  // Map keeps the order of first appearance, and sort is stable
  return [...missed.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic).slice(0, max);
}
