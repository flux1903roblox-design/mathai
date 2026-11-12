// The teacher's side of class work (spec TEACHER-4 §6-7): the calls, the automatic title, the words for each student's
// result, and telling the class (COUNCIL2-35): each assignment's own link, a message to copy, Google Classroom's share
// address and the fields of a Moodle URL activity. Results are worked out on the student's device: practice, not a
// graded test.
import { teacherApi } from './teacher.js';
import { TOPIC } from '@/content/index.js';
import { weekdayName, dm } from './workDates.js';

/** The kinds a teacher gives: a stair to learn, a mastery check, and a class exam made with the exam builder. */
export const ASSIGN_KINDS = ['stair', 'check', 'exam'];
/** The kind as the teacher's rows name it. */
export const KIND_LABEL = { stair: 'מדרגה', check: 'בדיקת שליטה', exam: 'מבחן' };

const stairOf = (skill) => {
  const [topic, l] = String(skill || '').split(':');
  const t = TOPIC[topic]; const level = Number(l);
  return t && t.levels[level - 1] ? { t, level, title: t.levels[level - 1].title } : null;
};
/** A stair the app has ('<topic>:<level>'). */
export const isStair = (skill) => !!stairOf(skill);

/** The automatic title: "מספרים מכוונים: חיבור וחיסור" or "בדיקת שליטה: חיבור וחיסור" (at most 80 characters). */
export function assignTitle(kind, skill) {
  const s = stairOf(skill);
  if (!s) return '';
  return (kind === 'check' ? `בדיקת שליטה: ${s.title}` : `${s.t.title}: ${s.title}`).slice(0, 80);
}

// ---------------------------------------------------------------- the calls (worker/src/assignments.js)
export const listWork = (cls) => teacherApi('/api/teacher/assignments', {}, cls);
export const sendWork = (cls, body) => teacherApi('/api/teacher/assignments', { method: 'POST', body }, cls);
export const workDetail = (cls, id) => teacherApi(`/api/teacher/assignments/${id}`, {}, cls);
export const changeWork = (cls, id, patch) => teacherApi(`/api/teacher/assignments/${id}`, { method: 'POST', body: patch }, cls);
export const deleteWork = (cls, id) => teacherApi(`/api/teacher/assignments/${id}/delete`, { method: 'POST', body: {} }, cls);

// ---------------------------------------------------------------- one student's result (§7)
/**
 * The two cells of a student's row: { state, result }. A stair: "הושלם" with "שולט/ת" or "עוד לא שולט/ת"; "בדרך" with
 * "שלב n מתוך 5"; a check: "הושלם" with "4/5 · עבר/ה" (the first finished try, marked when there were more).
 */
export function workStatus(kind, w) {
  if (!w || w.state === 'none' || !w.state) return { state: 'עוד לא התחיל/ה', result: '–' };
  if (kind === 'stair') {
    if (w.state === 'done') return { state: 'הושלם', result: w.passed ? 'שולט/ת' : 'עוד לא שולט/ת' };
    return { state: 'בדרך', result: `שלב ${w.stage || 0} מתוך 5` };
  }
  if (w.state !== 'done') return { state: 'התחיל/ה', result: '–' };
  const first = w.tries > 1 ? ' (ניסיון ראשון)' : '';
  if (kind === 'check') return { state: 'הושלם', result: `${w.right}/${w.asked} · ${w.passed ? 'עבר/ה' : 'עוד לא'}${first}` };
  return { state: 'הושלם', result: `${w.right}/${w.asked}${first}` };
}

// ---------------------------------------------------------------- telling the class (COUNCIL2-35)
/**
 * The app's own address, for the class message and the links: right wherever the Worker serves the app. '' on a
 * development copy (localhost), whose address means nothing on a student's phone.
 */
export function publicUrl(loc = globalThis.location, dev = import.meta.env.DEV) {
  if (!loc || dev || !/^https?:$/.test(loc.protocol) || loc.hostname === 'localhost' || loc.hostname.endsWith('.localhost')) return '';
  return `${loc.origin}${loc.pathname}`;
}
/** An assignment's id as the server makes it (16 random hex): the only thing a shared link carries. */
export const isWorkId = (id) => /^[a-f0-9]{16}$/.test(String(id ?? ''));
/**
 * The link that opens one assignment for a student of the class (COUNCIL2-35): the app's address and #/a/<id>. On a
 * student's phone in the class it opens the stair, the check or the exam with ?assignment=<id>; anyone else joins the
 * class first (screens/AssignmentOpen.jsx). The id names the assignment only: no class code, no name, no result.
 */
export const workLink = (id, url = publicUrl()) => (url && isWorkId(id) ? `${url}#/a/${id}` : '');
/**
 * Google's documented share-to-Classroom address for a link: a plain link, with no Google script on the page, no key
 * and no account here. The teacher picks the class and posts it as an assignment or a material in Classroom.
 */
export const classroomLink = (link, title = '') => (link
  ? `https://classroom.google.com/share?url=${encodeURIComponent(link)}${title ? `&title=${encodeURIComponent(title)}` : ''}`
  : '');

const dueWords = (dueOn) => `עד יום ${weekdayName(dueOn)} ${dm(dueOn)}`;
/**
 * The message a teacher copies to the class's own channel (Mashov, WhatsApp, Teams): the title, the day and the link.
 * No student's name in it. With no link (a development copy) it says where the work waits in the app.
 */
export function classMessage({ title, dueOn }, link = '') {
  if (!link) return `משימה חדשה במדרגות: ${title}, ${dueWords(dueOn)}. פותחים את האפליקציה, והמשימה מחכה בראש "המשימה שלי להיום".`;
  return `משימה חדשה במדרגות: ${title}, ${dueWords(dueOn)}. פותחים את הקישור, והמשימה נפתחת. ${link}`;
}
/**
 * The three fields of a Moodle "URL" activity (קישור לאתר): its name, the address and the description, and the three as
 * one text to copy. The description says how a student who is not in the class yet gets in. No student's name.
 */
export function moodleActivity({ title, dueOn }, link) {
  const name = `${title} · מדרגות`;
  const description = `משימה במדרגות, ${dueWords(dueOn)}. פותחים את הקישור. מי שעוד לא בכיתה במדרגות מצטרף/ת עם השם וקוד אישי של 4 ספרות, והמשימה נפתחת.`;
  return { name, url: link, description, text: `שם: ${name}\nכתובת: ${link}\nתיאור: ${description}` };
}
