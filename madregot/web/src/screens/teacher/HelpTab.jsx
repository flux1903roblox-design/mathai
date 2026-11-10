// "עזרה": the class's help requests from the last week, each with the exercise, what the student wrote, their note, the
// notebook page if they sent one, the thread of replies (TEACHER-6 §3), a reply box (three quick replies that fill it,
// 500 characters, three replies a request) and the actions "ראיתי", "טופל" and "לפתוח שוב". Filters: the open requests,
// those waiting for the teacher's answer (no reply yet, or the student wrote last), or all of them. From a student's
// page (TEACHER-8), ?student=<id> shows only that student's requests, all of them, until "לכל הבקשות"; a name opens the
// student's page.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Hand, NotebookPen, Send } from 'lucide-react';
import { teacherApi } from '@/lib/teacher.js';
import { QUICK_REPLIES, TEACHER_MAX, SIDE_MAX, REPLY_NOTE, sideCount, waitsForTeacher, sendTeacherReply, whenText } from '@/lib/help.js';
import { TOPIC } from '@/content/index.js';
import { Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import { helpRetentionNote } from '@/content/retention.js';
import { fmtDay, StudentName } from './common.jsx';

const FILTERS = [['open', 'פתוחות'], ['waiting', 'מחכות לתשובה שלכם'], ['all', 'הכול']];
const PICK = { open: (h) => !h.done_at, waiting: waitsForTeacher, all: () => true };

function NotebookPage({ cls, id }) {
  const [src, setSrc] = useState(null); const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  if (src) {
    return (
      <button type="button" className={clsx('help-page-btn', big && 'big')} onClick={() => setBig(!big)} aria-expanded={big} aria-label={big ? 'הקטנת הדף' : 'הגדלת הדף מהמחברת'}>
        <img className="help-page" src={src} alt="הדף מהמחברת של התלמיד" />
      </button>
    );
  }
  return (
    <Button variant="secondary" className="btn-sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try { const r = await teacherApi(`/api/teacher/help/${id}/image`, {}, cls); setSrc(r.image); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
    }}><NotebookPen size={16} aria-hidden="true" />{busy ? 'טוענים…' : 'הדף מהמחברת'}</Button>
  );
}

/** The thread under the exercise: the teacher's bubbles ("אתם") and the student's ("{name}"). */
function Thread({ h }) {
  if (!h.messages?.length) return null;
  return (
    <ol className="hb-list t-hb" aria-label={`ההודעות עם ${h.name}`}>
      {h.messages.map((m) => (
        <li key={m.id} className={clsx('hb', m.from === 'teacher' ? 'hb-me' : 'hb-them', m.from === 'student' && !m.read && 'unread')}>
          <span className="hb-who">{m.from === 'teacher' ? 'אתם' : h.name} · {whenText(m.at)}</span>
          <p className="hb-text">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** The reply box: three quick replies fill it (they do not send), a counter, "שליחה"; gone after three replies. */
function ReplyBox({ cls, h, onSent }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const id = `hr-${h.id}`;
  if (sideCount(h, 'teacher') >= SIDE_MAX) return <p className="hr-limit">על בקשה אחת אפשר לכתוב עד 3 תשובות. את השאר כדאי להמשיך בכיתה.</p>;
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await sendTeacherReply(cls, h.id, text.trim());
      toast.success(`התשובה נשלחה ל${h.name}.`);
      setText('');
      onSent();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="hr-form" onSubmit={send}>
      <label htmlFor={id} className="field-label">תשובה ל{h.name}</label>
      <div className="hr-chips" role="group" aria-label="תשובות מהירות">
        {QUICK_REPLIES.map((q) => <button key={q} type="button" className="hr-chip" onClick={() => setText(q)}>{q}</button>)}
      </div>
      <textarea id={id} className="input hr-text" rows={2} maxLength={TEACHER_MAX} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={`כמה מילים על התרגיל. התשובה תופיע אצל ${h.name} באפליקציה.`} aria-describedby={`${id}-n`} />
      <div className="hr-row">
        <span id={`${id}-n`} className="hr-count">{text.length}/{TEACHER_MAX}</span>
        <Button type="submit" className="btn-sm hr-send" disabled={!text.trim() || busy}><Send size={16} aria-hidden="true" />{busy ? 'שולחים…' : 'שליחה'}</Button>
      </div>
    </form>
  );
}

export default function HelpTab({ cls, data, onChanged, onStudent }) {
  const [params, setParams] = useSearchParams();
  const only = params.get('student');
  const who = only ? (data.students || []).find((s) => s.id === only) : null;
  const [filter, setFilter] = useState(only ? 'all' : 'open');
  const everyone = data.help || [];
  const all = who ? everyone.filter((h) => h.studentId === who.id) : everyone;
  const list = all.filter(PICK[filter]);
  const clearStudent = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('student'); return n; }, { replace: true });
  const markHelp = async (id, action) => {
    try { await teacherApi(`/api/teacher/help/${id}`, { method: 'POST', body: { action } }, cls); onChanged(); } catch (e) { toast.error(e.message); }
  };
  const count = (f) => all.filter(PICK[f]).length;
  return (
    <>
      {who && (
        <div className="hf-who" role="status">
          <span>הבקשות של <b>{who.name}</b> בשבוע האחרון</span>
          <button type="button" className="link-btn" onClick={clearStudent}>לכל הבקשות</button>
        </div>
      )}
      <fieldset className="as-set hf-filters">
        <legend className="visually-hidden">אילו בקשות להציג</legend>
        <div className="as-chips">
          {FILTERS.map(([id, label]) => (
            <label key={id} className={clsx('as-chip', filter === id && 'on')}>
              <input type="radio" className="as-radio" name="help-filter" value={id} checked={filter === id} onChange={() => setFilter(id)} />
              {label}{id !== 'all' && count(id) > 0 ? ` (${count(id)})` : ''}
            </label>
          ))}
        </div>
      </fieldset>
      <ul className="help-list">
        {list.length === 0 && (
          <li className="muted">{all.length === 0 ? (who ? `ל${who.name} אין בקשות עזרה בשבוע האחרון.` : 'אין בקשות עזרה בשבוע האחרון.') : filter === 'waiting' ? 'אין בקשות שמחכות לתשובה שלכם.' : 'אין בקשות פתוחות.'}</li>
        )}
        {list.map((h) => {
          const fresh = !h.done_at && (!h.seen_at || h.unreadFromStudent > 0);
          return (
            <li key={h.id} className={clsx('help-item', fresh && 'unseen', h.done_at && 'done')}>
              <div className="help-item-head"><Hand size={16} aria-hidden="true" /><StudentName id={h.studentId} name={h.name} onOpen={onStudent} />{fresh && <span className="new-tag">{h.seen_at ? 'תשובה חדשה' : 'חדש'}</span>}<span className="muted">{TOPIC[h.topic]?.title}, {fmtDay(h.created_at)}</span></div>
              <p className="help-q"><MathText text={h.question} /></p>
              {h.answer && <p className="muted">מה כתב/ה: <span dir="ltr">{h.answer}</span></p>}
              {h.note && <p><span className="hl">“{h.note}”</span></p>}
              {!!h.has_image && <NotebookPage cls={cls} id={h.id} />}
              <Thread h={h} />
              {!h.done_at && <ReplyBox cls={cls} h={h} onSent={onChanged} />}
              <div className="form-actions row">
                {!h.done_at && !h.seen_at && <Button variant="secondary" className="btn-sm" onClick={() => markHelp(h.id, 'seen')}>ראיתי</Button>}
                {!h.done_at ? <Button variant="secondary" className="btn-sm" onClick={() => markHelp(h.id, 'done')}>טופל</Button> : <Button variant="ghost" className="btn-sm" onClick={() => markHelp(h.id, 'reopen')}>לפתוח שוב</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      {/* how replies behave, and how long the pages and the requests stay (shared/retention.js) */}
      <p className="footnote t-help-note">{REPLY_NOTE}</p>
      <p className="footnote t-help-note">{helpRetentionNote()}</p>
    </>
  );
}
