// A picture or an object on every teaching step (STUDENT-8): which topics are still being drawn, and the few steps that
// may stay without one. Read by two tests only (nothing in the app imports it):
//  - learn/visuals.test.ts holds every topic NOT in PENDING_VISUALS to "every discover step has a fig or a manip", and
//    prints the table of all topics;
//  - learn/figures.test.ts checks that the drawings of those topics agree with their text.
// A content stage that finishes a topic takes it out of PENDING_VISUALS in the same commit (the test fails while a
// finished topic is still listed, so the set never goes stale). The shared figure types landed first; the topics follow.

/** Topics whose teaching steps are not all drawn yet. */
export const PENDING_VISUALS: ReadonlySet<string> = new Set(['stats', 'expr', 'eq', 'sys', 'pyth']);

/**
 * Steps that may stay without a drawing or an object, `${skill}#${index}` → why (one sentence). At most 5% of a topic's
 * discover steps; each must name a step that really has none.
 */
export const VISUAL_EXEMPT: Record<string, string> = {
  // "על הרשת אפשר לנסות ולתקן. אבל הנקודה (7, 30) בכלל לא נכנסת למסך": the point is chosen not to fit on any plane
  'line:5#4': 'The step is about the point (7, 30), which on purpose does not fit on the grid: that is why b is computed, not drawn.',
};
