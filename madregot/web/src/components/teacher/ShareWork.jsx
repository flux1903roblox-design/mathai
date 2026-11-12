// One assignment's way to the class (COUNCIL2-35): its own link (#/a/<id>), which opens the stair, the check or the exam
// on a class student's phone and lets anyone else join the class first; a message to copy into the class's channel;
// Google Classroom's share address (no Google script, no key and no account here); and the three fields of a Moodle
// URL activity, to copy. Nothing in any of them names a student. Used by the "לספר לכיתה?" step after sending and by
// the assignment's own sheet.
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Link2 } from 'lucide-react';
import { classMessage, classroomLink, moodleActivity, publicUrl, workLink } from '@/lib/assign.js';
import { copyText } from '@/lib/clipboard.js';

export const SHARE_WORK = {
  lead: 'הקישור פותח את המשימה אצל כל תלמיד בכיתה, ומי שעוד לא בכיתה מצטרף בדרך. אין בו ובהודעה שמות של תלמידים.',
  leadNoLink: 'אפשר לשלוח לתלמידים הודעה בערוץ של הכיתה. אין בה שמות של תלמידים.',
  copyMsg: 'העתקת הודעה לתלמידים',
  classroom: 'שיתוף ב־Google Classroom',
  copyLink: 'העתקת הקישור',
  moodle: 'פרטים לפעילות קישור ב־Moodle',
  moodleLead: 'ב־Moodle מוסיפים פעילות מסוג "קישור לאתר" (URL), ומדביקים בה את שלושת השדות.',
  copyMoodle: 'העתקת הפרטים ל־Moodle',
};

/** Props: `a` ({ id, title, dueOn }), `autoFocus` (the step that replaces a form starts on its first action). */
export default function ShareWork({ a, autoFocus = false }) {
  const uid = useId();
  const first = useRef(null);
  useEffect(() => { if (autoFocus) first.current?.focus({ preventScroll: true }); }, [autoFocus]);
  const [moodleOpen, setMoodleOpen] = useState(false);
  const link = workLink(a.id, publicUrl());
  const msg = classMessage(a, link);
  const words = classMessage(a, '');
  const lead = link ? msg.slice(0, msg.length - link.length).trimEnd() : words;
  const moodle = link ? moodleActivity(a, link) : null;
  const copy = async (text, done) => toast(await copyText(text) ? done : 'ההעתקה לא הצליחה. אפשר לסמן את הטקסט ולהעתיק אותו.');

  return (
    <div className="as-share">
      <p className="as-share-lead">{link ? SHARE_WORK.lead : SHARE_WORK.leadNoLink}</p>
      {/* the address is set left to right inside the Hebrew line, so its slashes stay where they belong */}
      <blockquote className="as-msg" data-testid="work-message">{lead}{link && <> <bdi dir="ltr">{link}</bdi></>}</blockquote>
      <button ref={first} type="button" className="btn btn-secondary btn-block" onClick={() => copy(msg, 'ההודעה הועתקה')}><Copy size={18} aria-hidden="true" />{SHARE_WORK.copyMsg}</button>
      {link && (
        <>
          <a className="btn btn-secondary btn-block" href={classroomLink(link, a.title)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} aria-hidden="true" />{SHARE_WORK.classroom}
          </a>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => copy(link, 'הקישור הועתק')}><Link2 size={18} aria-hidden="true" />{SHARE_WORK.copyLink}</button>
          <button type="button" className="btn btn-ghost btn-block as-moodle-toggle" aria-expanded={moodleOpen} aria-controls={`${uid}-moodle`} onClick={() => setMoodleOpen((o) => !o)}>
            {SHARE_WORK.moodle}
          </button>
          {moodleOpen && (
            <div id={`${uid}-moodle`} className="as-moodle" role="region" aria-label={SHARE_WORK.moodle}>
              <p className="as-moodle-lead">{SHARE_WORK.moodleLead}</p>
              <dl className="as-fields">
                <div><dt>שם</dt><dd>{moodle.name}</dd></div>
                <div><dt>כתובת</dt><dd><bdi dir="ltr">{moodle.url}</bdi></dd></div>
                <div><dt>תיאור</dt><dd>{moodle.description}</dd></div>
              </dl>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => copy(moodle.text, 'הפרטים הועתקו')}><Copy size={18} aria-hidden="true" />{SHARE_WORK.copyMoodle}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
