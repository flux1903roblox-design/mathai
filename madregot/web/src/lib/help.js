// Help both ways (spec TEACHER-6), on both sides of the class: the words of a request's status, the teacher's quick
// replies, the calls (worker/src/help.js), and what the student's device keeps of it (classWork.help from GET
// /api/class/work, classWork.noticed: the replies already announced). Replies stay about the exercise: three a side,
// no links, phone numbers or email addresses (the server checks), the student answers only after the teacher.
import { useApp } from './store.js';
import { api } from './api.js';
import { teacherApi } from './teacher.js';

/** Messages a side may write on one request, and their lengths. */
export const SIDE_MAX = 3;
export const TEACHER_MAX = 500;
export const STUDENT_MAX = 300;
/** The status chips a student sees (no gendered verb: the app does not know the teacher's gender). */
export const STATUS = { sent: 'נשלחה', seen: 'נקראה', answered: 'יש תשובה', done: 'טופלה' };
/** The teacher's quick replies: they fill the box, they do not send. */
export const QUICK_REPLIES = ['נעבור על זה מחר בכיתה', 'נסו שוב, והתחילו מהשלב הראשון בדרך', 'כתבו לי איפה בדיוק נתקעתם'];
export const REPLY_NOTE = 'בתשובות אין קישורים, מספרי טלפון או כתובות מייל, והן נשארות באפליקציה. הן נמחקות יחד עם הבקשה.';

const fromSide = (h, side) => (h?.messages || []).filter((m) => m.from === side);
/** How many messages a side wrote on a request. */
export const sideCount = (h, side) => fromSide(h, side).length;
/** The last message of a request's thread, or null. */
export const lastMessage = (h) => (h?.messages?.length ? h.messages[h.messages.length - 1] : null);

// ---------------------------------------------------------------- the teacher's side (dashboard help rows)
/** An open request waiting for the teacher: no reply yet, or the student wrote last. */
export const waitsForTeacher = (h) => !h.done_at && (!fromSide(h, 'teacher').length || lastMessage(h)?.from === 'student');
/** The teacher's reply: 201 {message}; 409 reply_limit, 400 reply_has_contact or bad_reply. */
export const sendTeacherReply = (cls, id, text) => teacherApi(`/api/teacher/help/${id}/reply`, { method: 'POST', body: { body: text } }, cls);

// ---------------------------------------------------------------- the student's side
/** The teacher's messages this student has not opened yet: [{ help, message }]. */
export const unreadReplies = (cw) => (cw?.help || []).flatMap((h) => fromSide(h, 'teacher').filter((m) => !m.read).map((message) => ({ help: h, message })));
/** Is there a reply from the teacher the student has not read (the missions tab's dot)? */
export const hasUnreadReply = (cw) => unreadReplies(cw).length > 0;
/** Unread replies not announced yet (the notice comes once per message). */
export const toAnnounce = (cw) => unreadReplies(cw).filter(({ message }) => !cw?.noticed?.[message.id]);
/** The student answers a reply, never starts a chat: the last message is the teacher's, and the student has room. */
export const canAnswer = (h) => lastMessage(h)?.from === 'teacher' && sideCount(h, 'student') < SIDE_MAX;

/** Change one of the student's requests on this device. */
function patchHelp(id, fn) {
  const cw = useApp.getState().classWork;
  useApp.setState({ classWork: { ...cw, help: (cw.help || []).map((h) => (h.id === id ? fn(h) : h)) } });
}
/** The notice for these messages was shown: it does not come again. */
export function markNoticed(ids) {
  const cw = useApp.getState().classWork;
  useApp.setState({ classWork: { ...cw, noticed: { ...(cw.noticed || {}), ...Object.fromEntries(ids.map((id) => [id, true])) } } });
}
const readTeacher = (h) => ({ ...h, messages: (h.messages || []).map((m) => (m.from === 'teacher' ? { ...m, read: true } : m)) });

/** The student opened the thread: the teacher's messages are read here at once, and on the server (POST /read). */
export async function openThread(h) {
  if (!fromSide(h, 'teacher').some((m) => !m.read)) return;
  patchHelp(h.id, readTeacher);
  try { await api(`/api/help/${h.id}/read`, { method: 'POST', body: {} }); } catch { /* read again next time it opens */ }
}

/**
 * The student's answer: quick 'thanks' ("תודה, הבנתי"), or 'still' with what is still unclear (it reopens a request the
 * teacher closed). The thread on this device takes the message and the status the server gives back.
 */
export async function sendStudentReply(h, { quick, text }) {
  const body = { quick, ...(text ? { body: text } : {}) };
  const r = await api(`/api/help/${h.id}/reply`, { method: 'POST', body });
  patchHelp(h.id, (x) => ({ ...readTeacher(x), status: r.status || x.status, messages: [...(x.messages || []), r.message] }));
  return r;
}

/** The reply notice's toast id: opening a thread takes it away. */
export const HELP_NOTICE = 'help-reply';

/** A screen the student is working in (a lesson, a stage, practice, a check, a repair, a class exam): no notice there. */
export const focusedRoute = (pathname) => /^\/(lesson|practice|placement|repair)(\/|$)/.test(pathname)
  || /^\/learn\/[^/]+\/[^/]+\/[^/]+/.test(pathname) || /^\/class\/exam\/[^/]+\/run$/.test(pathname);

/** "היום, 14:05", "אתמול, 9:12" or "3.11, 10:00" (the device's own clock and time zone). */
export function whenText(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x) => x.toLocaleDateString('en-CA');
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (day(d) === day(now)) return `היום, ${time}`;
  if (day(d) === day(yesterday)) return `אתמול, ${time}`;
  return `${d.getDate()}.${d.getMonth() + 1}, ${time}`;
}
