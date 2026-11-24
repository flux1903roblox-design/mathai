// How long the server keeps a class's data, in the words a teacher reads (spec TEACHER-9 §1.6, trust Appendix E §E.6):
// the list in the class settings and the line under the help list. The numbers come from shared/retention.js, the
// same module the night purge reads, so the words cannot say one thing while the server does another; no number is
// written in a screen. shared/retention.test.js renders these with the real numbers and with others.
import { RETENTION } from '@shared/retention.js';

const WORDS = { 30: 'חודש', 60: 'חודשיים', 180: 'חצי שנה', 365: 'שנה', 730: 'שנתיים' };
/** A number of days as a teacher says it: "חודש", "חצי שנה", "שנה", or "400 יום". */
export const daysText = (days) => WORDS[days] || `${days} יום`;

/** Names joined as a list is said: "א", "א וב", "א, ב וג". */
const joinNames = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ו${names.at(-1)}`);
/** Practice answers, exams and assignments: one sentence for the ones kept as long, in this order. */
function keptText(R) {
  const parts = [['תשובות בתרגול', R.attemptsDays], ['מבחנים', R.examsDays], ['משימות', R.assignmentsDays ?? R.examsDays]];
  const groups = [];
  for (const [name, days] of parts) {
    const g = groups.find((x) => x.days === days);
    if (g) g.names.push(name); else groups.push({ days, names: [name] });
  }
  return groups.map((g) => `${joinNames(g.names)}: ${daysText(g.days)}.`).join(' ');
}

/** The list under "כמה זמן נשמר המידע", one sentence a line. */
export function retentionLines(R = RETENTION) {
  const kept = keptText(R);
  return [
    `דפי מחברת שנשלחו עם בקשת עזרה: ${daysText(R.helpImageAfterDoneDays)} אחרי שסוגרים את הבקשה, ולכל היותר ${daysText(R.helpImageMaxDays)}.`,
    `בקשות עזרה והתשובות עליהן: ${daysText(R.helpAfterDoneDays)} אחרי שסוגרים אותן, ולכל היותר ${daysText(R.helpMaxDays)}.`,
    kept,
    `תלמיד שלא נכנס ${daysText(R.studentIdleDays)} נמחק, עם כל המידע שלו. כיתה שאף אחד לא נכנס אליה ${daysText(R.classIdleDays)} נמחקת.`,
    'במכשירים של התלמידים נשמר התרגול שלהם, וכל תלמיד יכול למחוק אותו בעצמו.',
  ];
}

/** The line under the teacher's help list. */
export const helpRetentionNote = (R = RETENTION) => `דפי מחברת נמחקים ${daysText(R.helpImageAfterDoneDays)} אחרי שסוגרים בקשה, ובקשות נמחקות אחרי ${daysText(R.helpAfterDoneDays)}.`;
