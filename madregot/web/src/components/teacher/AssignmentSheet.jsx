// One assignment, for the teacher (spec TEACHER-4 §6-7): how far each student got (a row per student: name, state,
// result, and a quiet "באיחור" for the teacher only; a class exam's result has a square per question), a later due
// date, printing a class exam again, and deleting it after asking. The results were worked out on the students'
// devices: practice, not a test for a grade, and the footnote says so.
import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, Trash2, Printer } from 'lucide-react';
import { workDetail, changeWork, deleteWork, workStatus, KIND_LABEL } from '@/lib/assign.js';
import { plusDays, schoolDay, dayLong, dueShort } from '@/lib/workDates.js';
import { today as localToday } from '@/lib/store.js';
import { Button, Sheet } from '@/components/ui.jsx';
import { Bar } from '@/components/ds.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import { QuestionStrip } from '@/screens/teacher/ExamsTab.jsx';

const AHEAD = 120;

/** The extension form: a new date (today at the earliest, never before the current one), the rest-day line, save. */
function Extend({ a, today, onSave, busy }) {
  const uid = useId();
  const min = a.dueOn >= today ? plusDays(a.dueOn, 1) : today;
  const max = plusDays(today, AHEAD);
  const [due, setDue] = useState(min);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(due) && due >= min && due <= max;
  const moved = ok ? schoolDay(due) : null;
  return (
    <form className="aw-extend" onSubmit={(e) => { e.preventDefault(); if (ok) onSave(due); }}>
      <div className="field">
        <label htmlFor={`${uid}-due`} className="field-label">מועד חדש</label>
        <input id={`${uid}-due`} type="date" className="input input-lg" min={min} max={max} value={due} onChange={(e) => setDue(e.target.value)} aria-describedby={`${uid}-note`} />
      </div>
      <p id={`${uid}-note`} className={moved?.moved ? 'as-note-line as-hint' : 'as-note-line'} aria-live="polite">
        {!ok ? `אפשר לבחור תאריך מ${dayLong(min)} ועד ${AHEAD} יום קדימה.` : moved.moved ? `התאריך יוצא בשבת או בחג, ולכן המועד יהיה ב${dayLong(moved.day)}.` : `עד ${dayLong(due)}.`}
      </p>
      <Button type="submit" variant="secondary" className="btn-block" disabled={!ok || busy}>{busy ? 'שומרים…' : 'שמירת המועד'}</Button>
    </form>
  );
}

/** Props: `cls`, `id` (null: closed), `today` (the server's day), `onOpenChange`, `onChanged()` (the lists reload). */
export default function AssignmentSheet({ cls, id, today: serverToday, onOpenChange, onChanged }) {
  const today = serverToday || localToday();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [extending, setExtending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const open = !!id;

  const load = useCallback(async () => {
    if (!id) return;
    try { setData(await workDetail(cls, id)); setError(''); } catch (e) { setError(e.message); }
  }, [cls, id]);
  useEffect(() => { setData(null); setError(''); setExtending(false); setConfirm(false); load(); }, [load]);

  const extend = async (dueOn) => {
    setBusy(true);
    try {
      const r = await changeWork(cls, id, { dueOn });
      toast.success(`המועד הוארך ל${dayLong(r.assignment.dueOn)}.`);
      setExtending(false); await load(); onChanged?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setConfirm(false); setBusy(true);
    try {
      await deleteWork(cls, id);
      toast('המשימה נמחקה.');
      onOpenChange(false); onChanged?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const a = data?.assignment;
  const c = a?.counts;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={a?.title || 'המשימה'} className="assign-sheet aw-sheet" wide>
      {!data && !error && <p className="muted aw-loading" role="status">טוענים את המשימה…</p>}
      {error && !data && <p className="form-error" role="alert">{error}</p>}
      {a && (
        <div className="aw-body">
          <p className="aw-meta"><span>{KIND_LABEL[a.kind] || ''}</span><span aria-hidden="true">·</span><span>{dueShort(a.dueOn)}</span><span aria-hidden="true">·</span><span>{a.forAll ? 'לכל הכיתה' : c.assigned === 1 ? 'לתלמיד אחד' : `ל־${c.assigned} תלמידים`}</span></p>
          {a.note && <p className="aw-note">“{a.note}”</p>}
          <Bar value={c.done} max={Math.max(1, c.assigned)} text={`${c.done}/${c.assigned} סיימו`} label={`${a.title}: ${c.done} מתוך ${c.assigned} סיימו`} tone="brand" />
          <div className="table-wrap aw-table-wrap" tabIndex={0} role="region" aria-label="מה כל תלמיד עשה">
            <table className="t-table aw-table">
              <thead><tr><th scope="col">שם</th><th scope="col">מצב</th><th scope="col">תוצאה</th></tr></thead>
              <tbody>
                {data.work.map((w) => {
                  const s = workStatus(a.kind, w);
                  return (
                    <tr key={w.studentId} className={`aw-${w.state}`}>
                      <th scope="row">{w.name}</th>
                      <td><span className="aw-state">{s.state}</span>{w.late && <span className="aw-late">באיחור</span>}</td>
                      <td>{s.result}{a.kind === 'exam' && w.state === 'done' && w.questions?.length > 0 && <> <QuestionStrip questions={w.questions} /></>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="footnote aw-foot">התוצאות נבדקות במכשיר של התלמיד. זה תרגול, לא מבחן לציון.</p>

          {extending ? <Extend a={a} today={today} onSave={extend} busy={busy} /> : null}
          <div className="set-rows-wrap aw-actions"><div className="set-rows">
            {!extending && <button type="button" className="set-row" onClick={() => setExtending(true)}><CalendarClock size={18} aria-hidden="true" />הארכת המועד</button>}
            {a.kind === 'exam' && a.hasExam && <Link className="set-row" to={`/teacher/exam/a:${a.id}`}><Printer size={18} aria-hidden="true" />הדפסת המבחן</Link>}
            <button type="button" className="set-row t-quiet-row" onClick={() => setConfirm(true)} disabled={busy}><Trash2 size={18} aria-hidden="true" />מחיקת המשימה</button>
          </div></div>
        </div>
      )}
      <ConfirmSheet open={confirm} onOpenChange={setConfirm} title="למחוק את המשימה?" keep="לא למחוק" confirm="כן, למחוק" onConfirm={remove}>
        <p>המשימה תיעלם אצל התלמידים, ומה שכבר עשו בה לא יופיע כאן. ההתקדמות שלהם בשיעורים עצמם נשארת.</p>
      </ConfirmSheet>
    </Sheet>
  );
}
