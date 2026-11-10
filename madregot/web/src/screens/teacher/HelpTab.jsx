// "עזרה": the class's help requests from the last week, each with the exercise, what the student wrote, their note
// and the notebook page if they sent one, and the actions "ראיתי", "טופל" and "לפתוח שוב".
import { useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Hand, NotebookPen } from 'lucide-react';
import { teacherApi } from '@/lib/teacher.js';
import { TOPIC } from '@/content/index.js';
import { Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import { fmtDay } from './common.jsx';

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

export default function HelpTab({ cls, data, onChanged }) {
  const markHelp = async (id, action) => {
    try { await teacherApi(`/api/teacher/help/${id}`, { method: 'POST', body: { action } }, cls); onChanged(); } catch (e) { toast.error(e.message); }
  };
  return (
    <ul className="help-list">
      {(data.help || []).length === 0 && <li className="muted">אין בקשות עזרה בשבוע האחרון.</li>}
      {(data.help || []).map((h) => (
        <li key={h.id} className={clsx('help-item', !h.seen_at && !h.done_at && 'unseen', h.done_at && 'done')}>
          <div className="help-item-head"><Hand size={16} aria-hidden="true" /><b>{h.name}</b>{!h.seen_at && !h.done_at && <span className="new-tag">חדש</span>}<span className="muted">{TOPIC[h.topic]?.title}, {fmtDay(h.created_at)}</span></div>
          <p className="help-q"><MathText text={h.question} /></p>
          {h.answer && <p className="muted">מה כתב/ה: <span dir="ltr">{h.answer}</span></p>}
          {h.note && <p><span className="hl">“{h.note}”</span></p>}
          {!!h.has_image && <NotebookPage cls={cls} id={h.id} />}
          <div className="form-actions row">
            {!h.done_at && !h.seen_at && <Button variant="secondary" className="btn-sm" onClick={() => markHelp(h.id, 'seen')}>ראיתי</Button>}
            {!h.done_at ? <Button variant="secondary" className="btn-sm" onClick={() => markHelp(h.id, 'done')}>טופל</Button> : <Button variant="ghost" className="btn-sm" onClick={() => markHelp(h.id, 'reopen')}>לפתוח שוב</Button>}
          </div>
        </li>
      ))}
    </ul>
  );
}
