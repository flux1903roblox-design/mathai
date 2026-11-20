// A picture or an object on every teaching step (STUDENT-8): the few steps that may stay without one. Read by two tests
// only (nothing in the app imports it):
//  - learn/visuals.test.ts holds every topic to "every discover step has a fig or a manip", except the steps listed
//    here, and prints the table of all topics;
//  - e2e/teach-all.spec.js finds the drawing of every step on a 320px phone, and none on a step listed here.
// Every topic is drawn (stages 13-17 of the student lane); a new topic or a new step comes with its drawing, or with a
// line here that says why it has none.

/**
 * Steps that may stay without a drawing or an object, `${skill}#${index}` → why (one sentence). At most 5% of a topic's
 * discover steps; each must name a step that really has none.
 */
export const VISUAL_EXEMPT: Record<string, string> = {
  // "על הרשת אפשר לנסות ולתקן. אבל הנקודה (7, 30) בכלל לא נכנסת למסך": the point is chosen not to fit on any plane
  'line:5#4': 'The step is about the point (7, 30), which on purpose does not fit on the grid: that is why b is computed, not drawn.',
};
