// The teacher's class exam, before it starts (spec TEACHER-5 §4), at /class/exam/:id: what it is (how many
// questions, about how long), how it runs (alone, no hints, one try a question, as a mastery check), and that the
// result goes to the teacher. Its questions come once from the server (GET /api/class/work/:id/exam) and stay on the
// device (classWork.exams), so it also opens offline. "מתחילים" runs it at /class/exam/:id/run (Lesson.jsx, purpose
// 'class'). Calm words: no countdown, no score to reach, no red.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/lib/store.js';
import { fetchExamItems, fetchClassWork, mineOf, dueLine, EXAM_MIN_PER_Q } from '@/lib/classWork.js';
import { Button } from '@/components/ui.jsx';
import { ScreenBar, ScreenFoot, EmptyState, LoadingState } from '@/components/Screen.jsx';
import Mascot from '@/components/Mascot.jsx';

export default function ClassExam() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cw = useApp((s) => s.classWork);
  const box = useApp((s) => s.workOutbox);
  const a = (cw?.assignments || []).find((x) => x.id === id && x.kind === 'exam') || null;
  const cached = cw?.exams?.[id];
  const [state, setState] = useState(cached?.length ? 'ready' : 'loading'); // loading | ready | missing | offline
  useEffect(() => {
    if (cached?.length) { setState('ready'); return undefined; }
    let on = true;
    // the list first when this exam is not in it yet (a link opened before the work was fetched)
    (a ? Promise.resolve() : fetchClassWork({ force: true }))
      .then(() => fetchExamItems(id))
      .then((items) => { if (on) setState(items.length ? 'ready' : 'missing'); }, (e) => { if (on) setState(e?.status === 404 ? 'missing' : 'offline'); });
    return () => { on = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bar = <ScreenBar title="מבחן תרגול מהמורה" back="/quests" backLabel="חזרה למשימות" />;
  if (state === 'loading') return <div className="page pushed cx">{bar}<LoadingState text="טוענים את המבחן…" /></div>;
  if (state !== 'ready') {
    return (
      <div className="page pushed cx">
        {bar}
        <EmptyState mood="encouraging" title={state === 'offline' ? 'אין חיבור כרגע' : 'המבחן לא נמצא'}>
          <p>{state === 'offline' ? 'כדי לפתוח את המבחן בפעם הראשונה צריך חיבור לאינטרנט. אחר כך הוא נשמר במכשיר.' : 'אולי המבחן נמחק. המשימות מהמורה מחכות במסך המשימות.'}</p>
        </EmptyState>
        <ScreenFoot><Link to="/quests" className="btn btn-primary btn-block btn-lg">חזרה למשימות</Link></ScreenFoot>
      </div>
    );
  }
  const items = cw.exams[id];
  const n = items.length;
  const w = a ? mineOf(a, box) : null;
  const done = w?.state === 'done';
  const started = !done && w?.state === 'started';
  return (
    <div className="page pushed cx">
      {bar}
      <section className="cx-card" data-region="content" aria-labelledby="cx-title">
        <Mascot mood="excited" size={112} className="cx-madi" />
        <h1 className="cx-title" id="cx-title">{a?.title || 'מבחן תרגול'}</h1>
        {a && <p className="cx-due">{cw.teacherName ? `מהמורה ${cw.teacherName} · ` : ''}{dueLine(a.dueOn)}</p>}
        {a?.note && <p className="cx-note">“{a.note}”</p>}
        <ul className="cx-lines">
          <li>מבחן תרגול מהמורה: {n === 1 ? 'שאלה אחת' : `${n} שאלות`}, בערך {n * EXAM_MIN_PER_Q} דקות.</li>
          <li>פותרים לבד, בלי רמזים. לכל שאלה יש ניסיון אחד, כמו בבדיקת שליטה. כדאי להחזיק דף טיוטה.</li>
          <li>התוצאה נשלחת למורה.</li>
        </ul>
        {started && <p className="cx-again" role="status">התחלתם את המבחן ולא סיימתם. אם תתחילו שוב, הוא יתחיל מהשאלה הראשונה.</p>}
        {done && <p className="cx-again" role="status">{w.asked ? `כבר סיימתם את המבחן הזה: ${w.right} מתוך ${w.asked}. ` : 'כבר סיימתם את המבחן הזה. '}אפשר לפתור אותו שוב, והמורה רואה את הניסיון הראשון.</p>}
      </section>
      <ScreenFoot>
        <Button className="btn-block btn-lg" onClick={() => navigate(`/class/exam/${id}/run`)} data-region="primary">מתחילים</Button>
        <Link to="/quests" className="foot-link">לא עכשיו</Link>
      </ScreenFoot>
    </div>
  );
}
