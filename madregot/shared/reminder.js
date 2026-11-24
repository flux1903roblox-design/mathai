// The daily reminder's words (STUDENT-11, STUDENT-12), in one place: the Worker's web push (worker/src/push.js) and the
// iPhone app's local notifications (web/src/lib/localReminder.js) send the same text on the same day.
// Plain JavaScript with one import, so the web app, the Worker and the tests can all read it.
import { APP_NAME } from './brand.js';

/** The six texts, one a day in turn (messageFor). Never a name, a number, the plan or a streak. */
export const TEXTS = [
  'חמש דקות של מתמטיקה? מדי מחכה עם תרגיל קצר.',
  'שיעור קצר אחד היום, וזה מספיק.',
  'המשימה של היום מחכה לכם, מתי שנוח.',
  'מדרגה אחת בכל פעם. נמשיך מאיפה שעצרתם?',
  'יש לכם כמה דקות? תרגיל אחד ונראה איך הולך.',
  'מדי הכין לכם משימה קצרה להיום.',
];
/** The notification's title: the app's name. */
export const TITLE = APP_NAME;

/** 1 for 1 January (a YYYY-MM-DD day). */
export function dayOfYear(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5) + 1;
}

/** The day's text, in turn by the day of the year. */
export const messageFor = (day) => TEXTS[dayOfYear(day) % TEXTS.length];
