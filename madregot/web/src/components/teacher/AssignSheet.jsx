// A new assignment for the class (spec TEACHER-4 §6): what to do (a stair to learn, or its mastery check), which stair,
// by when, for whom, a line to the class and the title, then one action, "שליחה לכיתה". After sending, the sheet offers
// to tell the class (a message to copy, a Google Classroom link); it never sends anything by itself.
// It opens from the "משימות" tab, from a repeated mistake on "מחר" (that stair, for the students who made it), from
// the lessons library, and from a class exam's sheet. "מבחן תרגול" sends one of this class's exams (TEACHER-3), in the
// version the teacher picks (א׳ unless the sheet showed ב׳): its frozen questions go to the server as they are.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Copy, ExternalLink } from 'lucide-react';
import { useApp, today as localToday } from '@/lib/store.js';
import { teacherApi } from '@/lib/teacher.js';
import { topicsFor, TOPIC } from '@/content/index.js';
import { assignTitle, sendWork, classMessage, classroomLink, publicUrl } from '@/lib/assign.js';
import { plusDays, schoolDay, dayLong, dm } from '@/lib/workDates.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { Choice } from './ClassSettingQuestion.jsx';

const KINDS = [
  ['stair', 'ללמוד מדרגה', 'חמשת השלבים, מההסבר ועד בדיקת השליטה'],
  ['check', 'בדיקת שליטה', 'בדיקה קצרה בלי רמזים, בסוף מדרגה'],
  ['exam', 'מבחן תרגול', 'מבחן שהכנתם. נפתר באפליקציה ונבדק מיד'],
];
const VERSION = { a: 'א', b: 'ב' };
const DUE = [['1', 'מחר', 1], ['3', 'בעוד 3 ימים', 3], ['7', 'בעוד שבוע', 7]];
const AHEAD = 120;


/** The class's students for "למי?": the board's list, or the dashboard's when the sheet opens elsewhere (the library). */
function useRoster(cls, given, open) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (given || !open || loaded) return undefined;
    let on = true;
    teacherApi('/api/teacher/dashboard', {}, cls).then((d) => { if (on) setLoaded({ students: d.students || [], today: d.today }); }, (e) => { if (on) { toast.error(e.message); setLoaded({ students: [], today: null, failed: true }); } });
    return () => { on = false; };
  }, [cls, given, open, loaded]);
  return given ? { students: given, today: null, ready: true } : { ...(loaded || { students: [], today: null }), ready: !!loaded && !loaded.failed };
}

/**
 * Props: `cls`, `students` (the board's list; omitted, the sheet loads it), `today` (the server's day), `preset`
 * { kind?, skill?, examId?, version? ('a'|'b'), targets?, targetsLabel? }, `open`, `onOpenChange`, `onSent(assignment)`.
 */
export default function AssignSheet({ cls, students: given, today: serverToday, preset = {}, open, onOpenChange, onSent }) {
  const roster = useRoster(cls, given, open);
  const students = roster.students;
  const today = serverToday || roster.today || localToday();
  const uid = useId();
  // this class's exams on this device, newest first (TEACHER-3)
  const allExams = useApp((st) => st.teacherExams);
  const exams = useMemo(() => (allExams || []).filter((e) => e.classCode === cls.code), [allExams, cls.code]);
  const updateTeacherExam = useApp((st) => st.updateTeacherExam);
  const [kind, setKind] = useState(['check', 'exam'].includes(preset.kind) ? preset.kind : 'stair');
  const [skill, setSkill] = useState(preset.skill || '');
  const [examId, setExamId] = useState(() => (exams.some((e) => e.id === preset.examId) ? preset.examId : exams[0]?.id || ''));
  const [version, setVersion] = useState(preset.version === 'b' ? 'b' : 'a');
  const exam = exams.find((e) => e.id === examId) || null;
  const examItems = exam ? (exam.versions[version === 'b' ? 1 : 0] || exam.versions[0]).items : null;
  const [due, setDue] = useState(() => plusDays(today, 7));
  const [who, setWho] = useState(preset.targets?.length ? 'preset' : 'all');
  const [chosen, setChosen] = useState(() => new Set(preset.targets || []));
  const [note, setNote] = useState('');
  const titleOf = (k, sk, ex) => (k === 'exam' ? (ex?.title || '').slice(0, 80) : assignTitle(k, sk));
  const [title, setTitle] = useState(() => titleOf(kind, preset.skill, exam));
  const [titleTouched, setTitleTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // the assignment as the server made it: the "לספר לכיתה?" step

  // the automatic title follows the kind and the stair until the teacher writes their own
  useEffect(() => { if (!titleTouched) setTitle(titleOf(kind, skill, exam)); }, [kind, skill, exam?.id, exam?.title, titleTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  // the stairs of the class's grade, by topic (and the preset's topic when it is another grade's)
  const groups = useMemo(() => {
    const list = topicsFor(cls.grade || '7');
    const pt = String(preset.skill || '').split(':')[0];
    return TOPIC[pt] && !list.some((t) => t.id === pt) ? [...list, TOPIC[pt]] : list;
  }, [cls.grade, preset.skill]);

  const max = plusDays(today, AHEAD);
  const dueOk = /^\d{4}-\d{2}-\d{2}$/.test(due) && due >= today && due <= max;
  const moved = dueOk ? schoolDay(due) : null;
  const ids = students.map((s) => s.id);
  const targets = who === 'all' ? [] : who === 'preset' ? (preset.targets || []).filter((id) => ids.includes(id)) : [...chosen].filter((id) => ids.includes(id));
  const what = kind === 'exam' ? !!examItems?.length : !!skill;
  const ready = what && dueOk && (who === 'all' ? students.length > 0 : targets.length > 0) && roster.ready;

  const toggle = (id) => setChosen((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const submit = async (e) => {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      const auto = titleOf(kind, skill, exam) || 'מבחן תרגול';
      const body = kind === 'exam'
        ? { kind, title: title.trim() || auto, note: note.trim(), dueOn: due, exam: { items: examItems, version }, ...(targets.length ? { targets } : {}) }
        : { kind, skill, title: title.trim() || auto, note: note.trim(), dueOn: due, ...(targets.length ? { targets } : {}) };
      const r = await sendWork(cls, body);
      if (kind === 'exam') updateTeacherExam(exam.id, { assignmentId: r.assignment.id });
      toast.success(r.moved ? `המשימה נשלחה, עד ${dayLong(r.assignment.dueOn)}. התלמידים יראו אותה בראש המשימה של היום.` : 'המשימה נשלחה. התלמידים יראו אותה בראש המשימה של היום.');
      setSent(r.assignment);
      onSent?.(r.assignment);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const n = students.length;
  // one sheet: after sending, the same sheet turns into the "לספר לכיתה?" step
  if (sent) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="לספר לכיתה?" className="assign-sheet"
        footer={<Button className="btn-block btn-lg" onClick={() => onOpenChange(false)}>סיום</Button>}>
        <ShareStep sent={sent} />
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`משימה לכיתה ${cls.className || ''}`.trim()} className="assign-sheet"
      footer={<Button type="submit" form={`${uid}-form`} className="btn-block btn-lg" disabled={!ready || busy}>{busy ? 'שולחים…' : 'שליחה לכיתה'}</Button>}>
      <form id={`${uid}-form`} className="assign-form" onSubmit={submit} noValidate>
        <fieldset className="as-set">
          <legend className="field-label">מה עושים?</legend>
          <div className="as-opts">
            {KINDS.map(([v, t, sub]) => <Choice key={v} name={`${uid}-kind`} value={v} checked={kind === v} onChange={setKind} title={t} sub={sub} />)}
          </div>
        </fieldset>

        {kind !== 'exam' && (
          <Field label="איזו מדרגה?" id={`${uid}-stair`}>
            <select id={`${uid}-stair`} className="input input-lg as-select" value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="" disabled>בחרו מדרגה</option>
              {groups.map((t) => (
                <optgroup key={t.id} label={t.title}>
                  {t.levels.map((l, i) => <option key={l.title} value={`${t.id}:${i + 1}`}>{i + 1}. {l.title}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
        )}
        {kind === 'exam' && (
          <fieldset className="as-set">
            <legend className="field-label">איזה מבחן?</legend>
            {exams.length === 0 ? (
              <p className="as-note-line as-no-exam">עוד אין מבחן לכיתה הזו. <Link to="/teacher/exam/new" className="as-link">להכנת מבחן</Link></p>
            ) : (
              <div className="as-opts">
                {exams.map((e) => (
                  <Choice key={e.id} name={`${uid}-exam`} value={e.id} checked={examId === e.id} onChange={setExamId} title={e.title}
                    sub={`${e.versions[0].items.length} שאלות · ${e.versions.length > 1 ? 'שתי גרסאות' : 'גרסה אחת'} · ${dm(e.at.slice(0, 10))}`} />
                ))}
              </div>
            )}
            {exam?.versions.length > 1 && (
              <div className="as-chips as-versions" role="radiogroup" aria-label="איזו גרסה תישלח">
                {['a', 'b'].map((v) => (
                  <label key={v} className={clsx('as-chip', version === v && 'on')}>
                    <input type="radio" className="as-radio" name={`${uid}-version`} value={v} checked={version === v} onChange={() => setVersion(v)} />
                    גרסה {VERSION[v]}׳
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        <fieldset className="as-set">
          <legend className="field-label">עד מתי?</legend>
          <div className="as-chips">
            {DUE.map(([v, label, days]) => {
              const day = plusDays(today, days);
              return (
                <label key={v} className={clsx('as-chip', due === day && 'on')}>
                  <input type="radio" className="as-radio" name={`${uid}-due`} value={v} checked={due === day} onChange={() => setDue(day)} />
                  {label}
                </label>
              );
            })}
          </div>
          <div className="field as-date">
            <label htmlFor={`${uid}-date`} className="field-label as-sub-label">תאריך אחר</label>
            <input id={`${uid}-date`} type="date" className="input input-lg" min={today} max={max} value={due} onChange={(e) => setDue(e.target.value)} aria-describedby={`${uid}-due-note`} />
          </div>
          <p id={`${uid}-due-note`} className={clsx('as-note-line', moved?.moved && 'as-hint')} aria-live="polite">
            {!dueOk ? `אפשר לבחור תאריך מהיום ועד ${AHEAD} יום קדימה.`
              : moved.moved ? `התאריך יוצא בשבת או בחג, ולכן המועד יהיה ב${dayLong(moved.day)}.`
                : `עד ${dayLong(due)}.`}
          </p>
        </fieldset>

        <fieldset className="as-set">
          <legend className="field-label">למי?</legend>
          <div className="as-opts">
            <Choice name={`${uid}-who`} value="all" checked={who === 'all'} onChange={setWho} title={`לכל הכיתה (${n})`} />
            {preset.targets?.length > 0 && (
              <Choice name={`${uid}-who`} value="preset" checked={who === 'preset'} onChange={setWho} title={preset.targetsLabel || `לתלמידים שבחרתי (${preset.targets.length})`}
                sub={students.filter((s) => preset.targets.includes(s.id)).map((s) => s.name).join(', ')} />
            )}
            <Choice name={`${uid}-who`} value="chosen" checked={who === 'chosen'} onChange={setWho} title="לתלמידים שבחרתי" />
          </div>
          {who === 'chosen' && (
            <div className="as-students" role="group" aria-label="התלמידים שיקבלו את המשימה">
              {students.map((s) => (
                <label key={s.id} className="check-row as-student">
                  <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} />
                  <span>{s.name}</span>
                </label>
              ))}
              <p className="as-note-line" aria-live="polite">{targets.length === 0 ? 'עוד לא נבחרו תלמידים.' : targets.length === 1 ? 'נבחר תלמיד אחד.' : `נבחרו ${targets.length} תלמידים.`}</p>
            </div>
          )}
        </fieldset>

        <Field label="מילה לכיתה (לא חובה)" id={`${uid}-note`}>
          <textarea id={`${uid}-note`} className="input as-text" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: לקראת המבחן ביום חמישי" />
        </Field>
        <Field label="כותרת" id={`${uid}-title`}>
          <input id={`${uid}-title`} className="input" maxLength={80} value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
        </Field>
      </form>
    </Sheet>
  );
}

/** "לספר לכיתה?": the message for the class's own channel, to copy, and the Classroom link. Nothing is sent from here. */
function ShareStep({ sent }) {
  const first = useRef(null);
  // the step replaces the form under the keyboard's focus: it starts on its first action
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, []);
  const url = publicUrl();
  const msg = classMessage(sent, url);
  const words = classMessage(sent, '');
  const link = classroomLink(url);
  const copyMsg = () => {
    const done = () => toast.success('ההודעה הועתקה');
    const failed = () => toast('לא הצלחנו להעתיק. אפשר לסמן את ההודעה ולהעתיק אותה.');
    try { navigator.clipboard.writeText(msg).then(done, failed); } catch { failed(); }
  };
  return (
    <div className="as-share">
      <p className="as-share-lead">אפשר לשלוח לתלמידים הודעה בערוץ של הכיתה. אין בה שמות של תלמידים.</p>
      {/* the address is set left to right inside the Hebrew line, so its slashes stay where they belong */}
      <blockquote className="as-msg">{words}{url && <> <bdi dir="ltr">{url}</bdi></>}</blockquote>
      <button ref={first} type="button" className="btn btn-secondary btn-block" onClick={copyMsg}><Copy size={18} aria-hidden="true" />העתקת הודעה לתלמידים</button>
      {link && <a className="btn btn-secondary btn-block" href={link} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} aria-hidden="true" />שיתוף ב־Google Classroom</a>}
    </div>
  );
}
