// "הבקשות שלי למורה" (spec TEACHER-6 §4): the student's help requests of the last 30 days, on the missions screen under
// the teacher's work, each with the exercise, where it stands ("נשלחה", "נקראה", "יש תשובה", "טופלה") and the day.
// Tapping one opens its thread in a sheet (opening it marks the teacher's messages read). After a reply from the teacher
// the student answers "תודה, הבנתי" or "עדיין לא ברור לי" (with a few words, 300 characters at most): an answer, never
// a chat. `openId`: a request to open at once (the reply notice's "לקריאה").
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { MessageCircleQuestion, ChevronLeft, Check, HelpCircle } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { STATUS, STUDENT_MAX, SIDE_MAX, HELP_NOTICE, canAnswer, sideCount, openThread, sendStudentReply, whenText } from '@/lib/help.js';
import { dm } from '@/lib/workDates.js';
import { Button, Sheet } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';

const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA');

/** One message as a bubble: the teacher's on one side, the student's on the other. */
function Bubble({ m, teacherName }) {
  const teacher = m.from === 'teacher';
  return (
    <li className={clsx('hb', teacher ? 'hb-them' : 'hb-me')}>
      <span className="hb-who">{teacher ? (teacherName ? `המורה ${teacherName}` : 'המורה') : 'אני'} · {whenText(m.at)}</span>
      <p className="hb-text">{m.body}</p>
    </li>
  );
}

/** The thread of one request, and the student's two answers. */
function Thread({ h, teacherName, onClose }) {
  const [still, setStill] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const full = sideCount(h, 'student') >= SIDE_MAX;
  const send = async (quick) => {
    setBusy(true);
    try {
      await sendStudentReply(h, { quick, text: quick === 'still' ? text.trim() : '' });
      toast.success('שלחנו למורה.');
      setStill(false); setText('');
      if (quick === 'thanks') onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="mh-thread">
      <div className="mh-ex">
        <span className="mh-ex-label">התרגיל</span>
        <p className="mh-ex-q"><MathText text={h.question} /></p>
        <span className={clsx('mh-chip', `mh-${h.status}`)}>{STATUS[h.status]}</span>
      </div>
      {h.messages.length > 0 ? (
        <ol className="hb-list" aria-label="ההודעות על הבקשה">
          {h.messages.map((m) => <Bubble key={m.id} m={m} teacherName={teacherName} />)}
        </ol>
      ) : (
        <p className="mh-wait">{h.status === 'done' ? 'הבקשה טופלה. אם עדיין משהו לא ברור, אפשר לשאול בכיתה.' : 'הבקשה מחכה אצל המורה. כשתגיע תשובה, היא תופיע כאן.'}</p>
      )}
      {canAnswer(h) && !still && (
        <div className="mh-answers">
          <Button className="btn-block" onClick={() => send('thanks')} disabled={busy}><Check size={18} aria-hidden="true" />תודה, הבנתי</Button>
          <Button variant="secondary" className="btn-block" onClick={() => setStill(true)} disabled={busy}><HelpCircle size={18} aria-hidden="true" />עדיין לא ברור לי</Button>
        </div>
      )}
      {canAnswer(h) && still && (
        <form className="mh-still" onSubmit={(e) => { e.preventDefault(); if (!busy) send('still'); }}>
          <label htmlFor="mh-text" className="field-label">מה עדיין לא ברור?</label>
          <textarea id="mh-text" className="input" rows={3} maxLength={STUDENT_MAX} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="mh-count" />
          <span id="mh-count" className="mh-count" aria-live="polite">{text.length}/{STUDENT_MAX}</span>
          <Button type="submit" className="btn-block" disabled={busy}>{busy ? 'שולחים…' : 'שליחה למורה'}</Button>
        </form>
      )}
      {full && <p className="mh-limit">על בקשה אחת אפשר לכתוב עד 3 פעמים. את השאר כדאי לשאול בכיתה.</p>}
    </div>
  );
}

export default function MyHelp({ openId = null, onOpened }) {
  const help = useApp((s) => s.classWork?.help) || [];
  const teacherName = useApp((s) => s.classWork?.teacherName || s.profile?.teacherName || '');
  const [open, setOpen] = useState(null);
  const shown = help.find((h) => h.id === open) || null;
  const show = (h) => { toast.dismiss(HELP_NOTICE); setOpen(h.id); openThread(h); };
  // the reply notice's "לקריאה" opens its request here
  useEffect(() => {
    if (openId == null) return;
    const h = help.find((x) => x.id === openId);
    if (h) show(h);
    onOpened?.();
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!help.length) return null;
  return (
    <section className="card mh-card" aria-labelledby="mh-h">
      <h2 id="mh-h" className="card-title"><MessageCircleQuestion size={22} aria-hidden="true" className="brand-icon" />הבקשות שלי למורה</h2>
      <ul className="mh-list">
        {help.map((h) => {
          const unread = h.messages.some((m) => m.from === 'teacher' && !m.read);
          return (
            <li key={h.id}>
              <button type="button" className={clsx('mh-row', unread && 'unread')} onClick={() => show(h)}>
                <span className="mh-row-main">
                  <span className="mh-row-q"><MathText text={h.question} /></span>
                  <span className="mh-row-meta">
                    <span className={clsx('mh-chip', `mh-${h.status}`)}>{STATUS[h.status]}</span>
                    <span className="mh-day">{dm(localDay(h.createdAt))}</span>
                    {unread && <span className="visually-hidden">, תשובה חדשה</span>}
                  </span>
                </span>
                {unread && <i className="mh-dot" aria-hidden="true" />}
                <ChevronLeft size={20} aria-hidden="true" className="chev" />
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet open={!!shown} onOpenChange={(o) => { if (!o) setOpen(null); }} title="הבקשה שלי">
        {shown && <Thread key={shown.id} h={shown} teacherName={teacherName} onClose={() => setOpen(null)} />}
      </Sheet>
    </section>
  );
}
