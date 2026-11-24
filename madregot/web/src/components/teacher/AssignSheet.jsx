// A new assignment for the class (spec TEACHER-4 §6): what to do (a stair to learn, its mastery check, a class exam, or
// the repair of one mistake on a stair), which stair (and for a repair, which of its mistakes), by when, for whom, a line
// to the class and the title, then one action, "שליחה לכיתה". After sending, the sheet offers to tell the class (a
// message to copy, a Google Classroom link); it never sends anything by itself.
// It opens from the "משימות" tab, from a repeated mistake on "מחר" (the repair of that mistake, for the students who
// made it: SK-BUYERS-2), from the lessons library, and from a class exam's sheet. "מבחן תרגול" sends one of this class's exams (TEACHER-3), in the
// version the teacher picks (א׳ unless the sheet showed ב׳): its frozen questions go to the server as they are.
import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useApp, today as localToday } from '@/lib/store.js';
import { teacherApi } from '@/lib/teacher.js';
import { classTopicsFor, rowStairs, rowTitle, TOPIC } from '@/content/topics.js';
import { assignTitle, sendWork, shareFor, repairsOf, isRepair } from '@/lib/assign.js';
import { MathText } from '@/components/MathText.jsx';
import ShareWork from './ShareWork.jsx';
import { plusDays, schoolDay, dayLong, dm } from '@/lib/workDates.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { Choice } from './ClassSettingQuestion.jsx';

const KINDS = [
  ['stair', 'ללמוד מדרגה', 'חמשת השלבים, מההסבר ועד בדיקת השליטה'],
  ['check', 'בדיקת שליטה', 'בדיקה קצרה בלי רמזים, בסוף מדרגה'],
  ['exam', 'מבחן תרגול', 'מבחן שהכנתם. נפתר באפליקציה ונבדק מיד'],
  ['repair', 'לתקן טעות', 'הסבר על הטעות עצמה, פעילות ו־3 שאלות'],
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
 * { kind?, skill?, misc?, examId?, version? ('a'|'b'), targets?, targetsLabel? }, `open`, `onOpenChange`,
 * `onSent(assignment)`. `misc` names the mistake a repair is for (kept while the stair has it).
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
  const [kind, setKind] = useState(['check', 'exam', 'repair'].includes(preset.kind) ? preset.kind : 'stair');
  const [skill, setSkill] = useState(preset.skill || '');
  // a repair's mistake: one of the stair's own (another stair's choice does not carry over)
  const [miscPick, setMisc] = useState(preset.misc || '');
  const misc = isRepair(skill, miscPick) ? miscPick : '';
  // the mistake the sheet was opened for comes first, so it shows chosen right under the stair
  const repairs = useMemo(() => {
    const list = repairsOf(skill);
    const at = list.findIndex((m) => m.id === preset.misc);
    return at > 0 ? [list[at], ...list.slice(0, at), ...list.slice(at + 1)] : list;
  }, [skill, preset.misc]);
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

  // the stairs of the class's grade, by topic, then its guest rows with their own stairs (eq:6 and eq:7 for ח׳, FUNC-6);
  // a preset stair outside them (another grade's, from a repeated mistake) brings its whole unit
  const groups = useMemo(() => {
    const list = classTopicsFor(cls.grade || '7');
    const sk = String(preset.skill || ''); const pt = sk.split(':')[0];
    if (!TOPIC[pt] || list.some((t) => rowStairs(t).some((s) => s.id === sk))) return list;
    return [...list.filter((t) => t.id !== pt), TOPIC[pt]];
  }, [cls.grade, preset.skill]);

  const max = plusDays(today, AHEAD);
  const dueOk = /^\d{4}-\d{2}-\d{2}$/.test(due) && due >= today && due <= max;
  const moved = dueOk ? schoolDay(due) : null;
  const ids = students.map((s) => s.id);
  const targets = who === 'all' ? [] : who === 'preset' ? (preset.targets || []).filter((id) => ids.includes(id)) : [...chosen].filter((id) => ids.includes(id));
  const what = kind === 'exam' ? !!examItems?.length : kind === 'repair' ? !!misc : !!skill;
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
        : { kind, skill, ...(kind === 'repair' ? { misc } : {}), title: title.trim() || auto, note: note.trim(), dueOn: due, ...(targets.length ? { targets } : {}) };
      const r = await sendWork(cls, body);
      if (kind === 'exam') updateTeacherExam(exam.id, { assignmentId: r.assignment.id });
      toast.success(r.moved ? `המשימה נשלחה, עד ${dayLong(r.assignment.dueOn)}. התלמידים יראו אותה בראש המשימה של היום.` : 'המשימה נשלחה. התלמידים יראו אותה בראש המשימה של היום.');
      setSent(r.assignment);
      onSent?.(r.assignment);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const n = students.length;
  // one sheet: after sending, the same sheet turns into the "לספר לכיתה?" step ("לספר לתלמידים?" for work given to a
  // group: SK-BUYERS-4)
  if (sent) {
    const share = shareFor(sent, Object.fromEntries(students.map((s) => [s.id, s.name])));
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title={share.title} className="assign-sheet"
        footer={<Button className="btn-block btn-lg" onClick={() => onOpenChange(false)}>סיום</Button>}>
        <ShareStep sent={sent} share={share} />
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
                <optgroup key={t.id} label={rowTitle(t)}>
                  {rowStairs(t).map((s) => <option key={s.id} value={s.id}>{s.level}. {s.title}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
        )}
        {kind === 'repair' && skill && (
          <fieldset className="as-set">
            <legend className="field-label">איזו טעות?</legend>
            {repairs.length === 0 ? <p className="as-note-line">למדרגה הזו עוד אין תיקון טעות. אפשר לבחור מדרגה אחרת.</p> : (
              <div className="as-opts as-miscs">
                {repairs.map((m) => <Choice key={m.id} name={`${uid}-misc`} value={m.id} checked={misc === m.id} onChange={setMisc} title={<MathText text={m.title} />} />)}
              </div>
            )}
          </fieldset>
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

/**
 * "לספר לכיתה?": the assignment's own link, the message for the class's own channel, Classroom's share address and the
 * Moodle activity's fields (ShareWork, COUNCIL2-35). For work given to a group (SK-BUYERS-4), "לספר לתלמידים?": who got
 * it (names for the teacher only), the message worded to them with the same link, and no Classroom post or Moodle
 * activity (both reach the whole class; lib/assign.js shareFor). Nothing is sent from here.
 */
function ShareStep({ sent, share }) {
  return (
    <>
      {/* the end of sending (ux-motion 19): a green mark pops in and its check draws itself; the toast says it in words */}
      <span className="as-sent-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
      <ShareWork a={sent} autoFocus group={share.group} lead={share.group ? share.lead : null} who={share.group && share.names.length > 3 ? share.names : null} />
    </>
  );
}
