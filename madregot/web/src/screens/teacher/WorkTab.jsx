// "משימות": the work given to the class (spec TEACHER-4 §6). Open assignments by due date, the soonest first, then the
// past ones folded under "משימות קודמות". Each row: the title, the kind, the due date, a bar of how many finished, and
// chips for those on the way, those who have not started and, for the teacher only, those late. A row opens its
// detail (AssignmentSheet). "משימה חדשה" in the tab's header (and in the empty state) opens the assign sheet.
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, Plus } from 'lucide-react';
import { listWork, KIND_LABEL } from '@/lib/assign.js';
import { dueShort } from '@/lib/workDates.js';
import { today as localToday } from '@/lib/store.js';
import { Button } from '@/components/ui.jsx';
import { Bar } from '@/components/ds.jsx';
import { EmptyState } from '@/components/Screen.jsx';
import AssignmentSheet from '@/components/teacher/AssignmentSheet.jsx';

function Row({ a, onOpen }) {
  const c = a.counts;
  const chips = [
    c.started > 0 && ['on', `${c.started} בדרך`],
    c.notStarted > 0 && ['todo', c.notStarted === 1 ? 'תלמיד אחד עוד לא התחיל' : `${c.notStarted} עוד לא התחילו`],
    c.late > 0 && ['late', `${c.late} באיחור`],
  ].filter(Boolean);
  return (
    <li>
      <button type="button" className="tw-row" onClick={() => onOpen(a.id)}>
        <span className="tw-main">
          <span className="tw-title">{a.title}</span>
          <span className="tw-meta">{KIND_LABEL[a.kind] || ''} · {dueShort(a.dueOn)}{a.forAll ? '' : c.assigned === 1 ? ' · לתלמיד אחד' : ` · ל־${c.assigned} תלמידים`}</span>
          <Bar value={c.done} max={Math.max(1, c.assigned)} text={`${c.done}/${c.assigned} סיימו`} label={`${a.title}: ${c.done} מתוך ${c.assigned} סיימו`} tone="brand" />
          {chips.length > 0 && <span className="tw-chips">{chips.map(([tone, text]) => <span key={tone} className={`tw-chip tw-chip-${tone}`}>{text}</span>)}</span>}
        </span>
        <ChevronLeft size={20} aria-hidden="true" className="chev" />
      </button>
    </li>
  );
}

/** Props: `cls`, `today` (the server's day), `version` (bumped when an assignment is sent), `onNew()`, `onChanged()`. */
export default function WorkTab({ cls, today: serverToday, version, onNew, onChanged }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState(serverToday || localToday());
  const [openId, setOpenId] = useState(null);
  const [past, setPast] = useState(false);
  const load = useCallback(async () => {
    try { const r = await listWork(cls); setList(r.assignments || []); if (r.today) setDay(r.today); setError(''); } catch (e) { setError(e.message); }
  }, [cls]);
  useEffect(() => { load(); }, [load, version]);
  const changed = () => { load(); onChanged?.(); };

  const open = (list || []).filter((a) => a.dueOn >= day).sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.createdAt < b.createdAt ? -1 : 1));
  const done = (list || []).filter((a) => a.dueOn < day);
  return (
    <section className="tw" aria-labelledby="tw-title">
      <div className="tw-head">
        <h2 id="tw-title" className="set-head tw-h">המשימות של הכיתה</h2>
        <Button variant="secondary" className="btn-sm tw-new" onClick={onNew}><Plus size={18} aria-hidden="true" />משימה חדשה</Button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!list && !error && <p className="muted" role="status">טוענים את המשימות…</p>}
      {list && list.length === 0 && (
        <EmptyState mood="idle" title="עוד אין משימות">
          <p>אפשר לתת לכיתה מדרגה ללמוד או בדיקת שליטה, עם תאריך הגשה.</p>
          <Button className="btn-lg" onClick={onNew}><Plus size={18} aria-hidden="true" />משימה חדשה</Button>
        </EmptyState>
      )}
      {list && list.length > 0 && (
        <>
          {open.length === 0 ? <p className="muted tw-none">אין משימות פתוחות. אפשר לתת משימה חדשה.</p> : (
            <ul className="tw-list" aria-label="משימות פתוחות">{open.map((a) => <Row key={a.id} a={a} onOpen={setOpenId} />)}</ul>
          )}
          {done.length > 0 && (
            <div className="tw-past">
              <button type="button" className="tw-fold" aria-expanded={past} aria-controls="tw-past-list" onClick={() => setPast(!past)}>
                משימות קודמות ({done.length})<ChevronDown size={20} aria-hidden="true" className={past ? 'tw-fold-open' : ''} />
              </button>
              {past && <ul id="tw-past-list" className="tw-list" aria-label="משימות קודמות">{done.map((a) => <Row key={a.id} a={a} onOpen={setOpenId} />)}</ul>}
            </div>
          )}
        </>
      )}
      <AssignmentSheet cls={cls} id={openId} today={day} onOpenChange={(o) => { if (!o) setOpenId(null); }} onChanged={changed} />
    </section>
  );
}
