// What a teacher can pass on without passing on a class (COUNCIL2-36): the demo class for a colleague, and the class's
// week against its own goal. Nothing here carries a student's name, a teacher's name, the class's name or code, or any
// one student's numbers: the colleague gets the demo class (synthetic, on their own device), and the goal card is the
// class total only, as the students see it.
import { publicUrl } from './assign.js';
import { APP_NAME } from '@shared/brand.js';

/** The demo class (TEACHER-15) on the app's own address: it opens the board of a made-up class, with no sign-up. */
export const demoLink = (url = publicUrl()) => (url ? `${url}#/?start=demo` : '');

/** The message to a colleague: what the app is, and the demo class's link. No class data in it. */
export function colleagueText(link = demoLink()) {
  const lead = `מצאתי את ${APP_NAME}: תרגול מתמטיקה לכיתות ז׳ וח׳ לפי תוכנית משרד החינוך, עם לוח למורה שמראה מה כדאי לחזור עליו מחר.`;
  return link ? `${lead} אפשר להציץ בכיתה לדוגמה, בלי הרשמה ובלי פרטים של תלמידים: ${link}` : lead;
}

/**
 * The class's week against its own goal, for a card the teacher shares with the class's parents or the school: the
 * total and the target only (teacherGoal on the Worker gives nothing else). null when the goal is off or not there.
 * { have, target, reached, pct, text }; `link`: the app's address, added at the end of the text when there is one.
 */
export function goalShare(goal, link = publicUrl()) {
  if (!goal?.on || !(goal.target > 0)) return null;
  const have = Math.max(0, Math.floor(Number(goal.have) || 0));
  const target = Math.floor(goal.target);
  const reached = !!goal.reached || have >= target;
  const pct = Math.min(100, Math.round((have / target) * 100));
  const lead = reached
    ? `השבוע הכיתה שלנו הגיעה במדרגות למטרה שהציבה לעצמה: ${have} צעדים מתוך ${target}.`
    : `השבוע הכיתה שלנו במדרגות: ${have} צעדים מתוך ${target}, במטרה שהציבה לעצמה.`;
  const how = 'כל שיעור, שלב לימוד או בדיקה שמסיימים הם צעד של הכיתה כולה.';
  return { have, target, reached, pct, text: link ? `${lead} ${how} ${link}` : `${lead} ${how}` };
}
