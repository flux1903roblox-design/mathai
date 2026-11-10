// One student's page on the teacher's board (spec TEACHER-8 §3): a sheet titled with the name, opened from any name on
// the board (מחר, תלמידים, מבחנים, עזרה) and in the class report. Sections: השבוע (the days and minutes, and a strip of
// the last 14 days), מדרגות (where the student stands on each topic of the grade), טעויות שחוזרות (with "לתת תרגול":
// the assign sheet on that stair, for this student only), משימות, בקשות עזרה (leading to the help view, filtered) and
// מבחנים; a section with nothing in it says "אין עדיין". The student's two actions live here: "איפוס קוד אישי" and
// "הסרה מהכיתה" (asked first). Data: GET /api/teacher/students/:id (worker/src/report.js studentDetail).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, UserMinus, Send, Hand, RefreshCw } from 'lucide-react';
import { teacherApi } from '@/lib/teacher.js';
import { topicsFor, TOPIC } from '@/content/index.js';
import { mistakeText } from '@/lib/teacherText.js';
import { workText } from '@/lib/teacherCsv.js';
import { isStair } from '@/lib/assign.js';
import { STATUS } from '@/lib/help.js';
import { dm, weekdayLetter } from '@/lib/workDates.js';
import { Button, ChapterMark, LevelPips, Sheet } from '@/components/ui.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import { MathText } from '@/components/MathText.jsx';
import { QuestionStrip } from '@/screens/teacher/ExamsTab.jsx';
import { fmtDay, Rate } from '@/screens/teacher/common.jsx';

/** "5.11", or "5.11.2025" in another year than `today`'s. */
const dayText = (day, today) => (!day ? '' : day.slice(0, 4) === String(today || '').slice(0, 4) ? dm(day) : `${dm(day)}.${day.slice(0, 4)}`);
const isoDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const times = (n) => (n === 1 ? 'פעם אחת' : `${n} פעמים`);

/** A section of the sheet: a heading and its content, or "אין עדיין". */
function Part({ id, title, empty, children }) {
  return (
    <section className="ss-part" aria-labelledby={id}>
      <h3 id={id} className="ss-h">{title}</h3>
      {empty ? <p className="ss-empty muted">אין עדיין</p> : children}
    </section>
  );
}

/** The last 14 days as small squares, the oldest on the right (Hebrew reading order), today on the left. */
function DayStrip({ days, today }) {
  const active = days.filter((d) => d.n > 0).length;
  const label = active ? `ב־14 הימים האחרונים: ${active === 1 ? 'יום אחד' : `${active} ימים`} עם תרגול` : 'ב־14 הימים האחרונים לא היה תרגול';
  return (
    <div className="ss-strip-wrap">
      <span className="ss-strip" role="img" aria-label={label}>
        {days.map((d) => (
          <i key={d.day} className={d.n >= 10 ? 'lots' : d.n > 0 ? 'some' : ''} title={`${weekdayLetter(d.day)}׳ ${dm(d.day)}: ${d.n ? `${d.n} תרגילים` : 'בלי תרגול'}`} />
        ))}
      </span>
      <span className="ss-strip-ends" aria-hidden="true"><span>{dayText(days[0]?.day, today)}</span><span>היום</span></span>
    </div>
  );
}

/**
 * Props: `cls`; `student` { id, name } (the name is the title while the page loads); `today` (the server's day);
 * `open`, `onOpenChange`; `onAssign(preset)` (the board's assign sheet); `onHelp(id)` (the help view, filtered);
 * `onChanged()` after a PIN reset or a removal.
 */
export default function StudentSheet({ cls, student, today, open, onOpenChange, onAssign, onHelp, onChanged }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const id = student?.id;
  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try { setD(await teacherApi(`/api/teacher/students/${id}`, {}, cls)); } catch (e) { setError(e.message); }
  }, [cls, id]);
  useEffect(() => { if (open) { setD(null); load(); } }, [open, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = d?.student?.name || student?.name || '';
  const day = today || d?.days14?.at(-1)?.day || '';
  const topics = topicsFor(cls.grade || '7');
  const week = (d?.days14 || []).slice(-7);
  const weekDays = week.filter((x) => x.n > 0).length;
  const weekMin = week.reduce((a, x) => a + x.minutes, 0);
  const weekN = week.reduce((a, x) => a + x.n, 0);

  const resetPin = async () => {
    try {
      await teacherApi(`/api/teacher/students/${id}/reset-pin`, { method: 'POST', body: {} }, cls);
      toast.success(`הקוד האישי של ${name} אופס. בכניסה הבאה ייבחר קוד חדש.`);
      load(); onChanged?.();
    } catch (e) { toast.error(e.message); }
  };
  const remove = async () => {
    setRemoving(false);
    try {
      await teacherApi(`/api/teacher/students/${id}/remove`, { method: 'POST', body: {} }, cls);
      toast(`${name} הוסר/ה מהכיתה`);
      onOpenChange(false); onChanged?.();
    } catch (e) { toast.error(e.message); }
  };
  const practise = (m) => onAssign?.({ kind: 'stair', skill: `${m.topic}:${m.level}`, targets: [id], targetsLabel: `רק ל${name}` });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title={name} className="ss-sheet">
        {!d && !error && <p className="muted" role="status">טוענים…</p>}
        {error && (
          <div className="ss-error" role="alert">
            <p className="form-error">{error}</p>
            <Button variant="secondary" className="btn-sm" onClick={load}><RefreshCw size={16} aria-hidden="true" />לנסות שוב</Button>
          </div>
        )}
        {d && (
          <div className="ss-body">
            <p className="ss-sub">{d.student.joinedOn ? `הצטרף/ה ב־${dayText(d.student.joinedOn, day)}` : ''}{d.student.joinedOn ? ' · ' : ''}תרגול אחרון {fmtDay(d.student.lastPractice)}</p>

            <Part id="ss-week" title="השבוע">
              <p className="ss-line">{weekDays ? `${weekDays === 1 ? 'יום אחד' : `${weekDays} ימים`} עם תרגול · ${weekN} תרגילים · ${weekMin} דקות` : 'השבוע עוד לא היה תרגול.'}</p>
              <DayStrip days={d.days14} today={day} />
            </Part>

            <Part id="ss-levels" title="מדרגות">
              <ul className="ss-list">
                {topics.map((t, i) => {
                  const l = d.levels[t.id];
                  return (
                    <li key={t.id} className="ss-level">
                      <span className="ss-level-name"><ChapterMark color={t.color} n={i + 1} size="sm" />{t.title}</span>
                      {l ? <LevelPips total={t.levels.length} level={l.level} max={l.max} color={t.color} /> : <span className="muted">עוד לא התחיל/ה</span>}
                    </li>
                  );
                })}
              </ul>
            </Part>

            <Part id="ss-mis" title="טעויות שחוזרות" empty={!d.mistakes.length}>
              <ul className="ss-list">
                {d.mistakes.map((m) => {
                  const rowId = `ss-mis-${m.topic}-${m.cat}`;
                  return (
                    <li key={`${m.topic}:${m.cat}`} className="ss-row">
                      <span className="ss-row-main" id={rowId}><b>{TOPIC[m.topic]?.title}</b>: <MathText text={mistakeText(m.topic, m.level, m.cat)} /></span>
                      <span className="muted">{times(m.n)} בחודש האחרון</span>
                      {onAssign && isStair(`${m.topic}:${m.level}`) && (
                        <Button variant="secondary" className="btn-sm ss-act" aria-describedby={rowId} onClick={() => practise(m)}><Send size={16} aria-hidden="true" />לתת תרגול</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Part>

            <Part id="ss-work" title="משימות" empty={!d.work.length}>
              <ul className="ss-list">
                {d.work.map((w) => (
                  <li key={w.assignmentId} className="ss-row">
                    <span className="ss-row-main"><b>{w.title}</b> <span className="muted">עד {dayText(w.dueOn, day)}</span></span>
                    <span><span className="aw-state">{workText(w.kind, { ...w, late: false })}</span>{w.late && <span className="aw-late">באיחור</span>}</span>
                  </li>
                ))}
              </ul>
            </Part>

            <Part id="ss-help" title="בקשות עזרה" empty={!d.help.length}>
              <ul className="ss-list">
                {d.help.map((x) => (
                  <li key={x.id} className="ss-row">
                    <span className="ss-row-main"><MathText text={x.question} /></span>
                    <span className="ss-meta"><span className={`mh-chip mh-${x.status}`}>{STATUS[x.status] || ''}</span><span className="muted">{TOPIC[x.topic]?.title || ''}{TOPIC[x.topic] ? ', ' : ''}{fmtDay(x.createdAt)}</span></span>
                  </li>
                ))}
              </ul>
              {onHelp && <Button variant="secondary" className="btn-sm ss-act" onClick={() => onHelp(id)}><Hand size={16} aria-hidden="true" />לבקשות של {name}</Button>}
            </Part>

            <Part id="ss-exams" title="מבחנים" empty={!d.exams.length}>
              <ul className="ss-list">
                {d.exams.map((e) => (
                  <li key={e.id} className="ss-row">
                    <span className="ss-row-main"><b>{e.title}</b> <span className="muted">{dayText(isoDay(e.at), day)}</span></span>
                    <span className="ss-meta"><Rate value={e.total ? Math.round((100 * e.correct) / e.total) : null} /><span className="muted">{e.correct}/{e.total}</span></span>
                    {e.questions?.length > 0 && <QuestionStrip questions={e.questions} />}
                  </li>
                ))}
              </ul>
            </Part>

            <section className="ss-part ss-actions" aria-label={`פעולות על ${name}`}>
              <div className="set-rows-wrap"><div className="set-rows">
                {d.student.pinReset
                  ? <p className="set-row ss-done">הקוד האישי אופס. בכניסה הבאה ייבחר קוד חדש.</p>
                  : <button type="button" className="set-row" onClick={resetPin}><KeyRound size={18} aria-hidden="true" />איפוס קוד אישי</button>}
                <button type="button" className="set-row danger" onClick={() => setRemoving(true)}><UserMinus size={18} aria-hidden="true" />הסרה מהכיתה</button>
              </div></div>
            </section>
          </div>
        )}
      </Sheet>
      <ConfirmSheet open={removing} onOpenChange={setRemoving} title={`להסיר את ${name} מהכיתה?`} keep="לא להסיר" confirm="כן, להסיר" onConfirm={remove}>
        <p>נמחק את ההתקדמות של {name} מלוח הכיתה, והכניסה לכיתה תיסגר. התרגול שנשמר במכשיר עצמו נשאר. כדי שלא תהיה הצטרפות מחדש באותו שם, נעלו את הכיתה.</p>
      </ConfirmSheet>
    </>
  );
}
