// A class practice exam, built in two minutes (spec TEACHER-3 §3), at /teacher/exam/new: a question flow (the Flow
// grammar of PracticeExam.jsx). Which stairs (by topic, with "כל היחידה"; ?skills=a,b preselects), how many questions,
// one version or two. "הכנת המבחן" draws the questions from the app's own generators (lib/exam.js makeClassExam),
// keeps the exam on this device (teacherExams) and opens its sheet. Under the stairs, "מבחנים להדפסה" lists the exams
// made here, to print again.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ChevronLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { makeClassExam, classExamTitle, CLASS_EXAM_LENGTHS } from '@/lib/exam.js';
import { TOPIC, topicsFor } from '@/content/index.js';
import { ALL_SKILLS, parseSkill, skillId } from '@/learn/skills.ts';
import { dm } from '@/lib/workDates.js';
import { Button, ChapterMark } from '@/components/ui.jsx';
import { Flow } from '@/components/Screen.jsx';

const LENGTH_TIME = { 6: 'כ־20 דקות', 10: 'כ־35 דקות', 14: 'כ־45 דקות, שיעור שלם' };
const ASK = ['על אילו מדרגות יהיה המבחן?', 'כמה שאלות?', 'גרסה אחת או שתיים?'];

/** The stair's own title: "השוואת מספרים". */
export const stairTitle = (skill) => { const { topic, level } = parseSkill(skill); return TOPIC[topic]?.levels[level - 1]?.title || skill; };
/** The note for a stair that could not be printed. */
export const skippedNote = (skill) => `המדרגה "${stairTitle(skill)}" לא נכנסה למבחן: התרגילים בה הם גרירה על המסך, ואי אפשר להדפיס אותם.`;
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
const order = (skills) => [...skills].sort((a, b) => ALL_SKILLS.indexOf(a) - ALL_SKILLS.indexOf(b));

/** A checkbox row (a pressable row with a tick, the onboarding grammar). */
function Pick({ on, onClick, children, label, className }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} className={clsx('ob-opt', className, on && 'on')} onClick={onClick}>
      <span className="ob-opt-text">{children}</span>
      <span className="ob-check" aria-hidden="true">{on && <Check size={18} strokeWidth={3} />}</span>
    </button>
  );
}

/** The exams made on this device, newest first: each opens its sheet. */
function SavedExams({ exams, classes }) {
  const name = (code) => classes.find((c) => c.code === code)?.className;
  return (
    <section className="xn-saved" aria-labelledby="xn-saved-h">
      <h2 id="xn-saved-h" className="set-head">מבחנים להדפסה</h2>
      {exams.length === 0 ? <p className="muted xn-saved-empty">עוד לא הכנתם מבחן. מבחן תרגול מוכן בשתי דקות, עם מפתח תשובות.</p> : (
        <ul className="tw-list">
          {exams.map((e) => (
            <li key={e.id}>
              <Link className="tw-row" to={`/teacher/exam/${e.id}`}>
                <span className="tw-main">
                  <span className="tw-title">{e.title}</span>
                  <span className="tw-meta">
                    {e.versions[0].items.length} שאלות · {e.versions.length === 2 ? 'שתי גרסאות' : 'גרסה אחת'} · {dm(e.at.slice(0, 10))}
                    {classes.length > 1 && name(e.classCode) ? ` · כיתה ${name(e.classCode)}` : ''}
                  </span>
                </span>
                <ChevronLeft size={20} aria-hidden="true" className="chev" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ExamNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const profile = useApp((s) => s.profile);
  const exams = useApp((s) => s.teacherExams) || [];
  const addTeacherExam = useApp((s) => s.addTeacherExam);
  const cls = profile.classes?.find((c) => c.code === profile.active) || profile.classes?.[0];
  const grade = cls?.grade || profile.grade || '7';
  const fromLink = (params.get('skills') || '').split(',').filter((s) => ALL_SKILLS.includes(s));
  // the class's topics, and a preselected stair's topic when it is another grade's
  const topics = useMemo(() => {
    const list = topicsFor(grade);
    const extra = [...new Set(fromLink.map((s) => parseSkill(s).topic))].filter((t) => !list.some((x) => x.id === t)).map((t) => TOPIC[t]);
    return [...list, ...extra];
  }, [grade, params]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState(() => new Set(fromLink));
  const [count, setCount] = useState(10);
  const [two, setTwo] = useState(true);
  const [step, setStep] = useState(0);
  const [note, setNote] = useState([]); // stairs that could not be printed (when none could)

  const stairsOf = (t) => t.levels.map((_, i) => skillId(t.id, i + 1));
  const toggle = (skill) => setPicked((cur) => { const n = new Set(cur); if (n.has(skill)) n.delete(skill); else n.add(skill); return n; });
  const toggleAll = (t) => setPicked((cur) => {
    const all = stairsOf(t); const n = new Set(cur);
    if (all.every((s) => n.has(s))) all.forEach((s) => n.delete(s)); else all.forEach((s) => n.add(s));
    return n;
  });

  const create = () => {
    const skills = order([...picked]);
    const a = makeClassExam(skills, count);
    if (!a.items.length) { setNote(a.skipped); setStep(0); return; }
    const versions = [{ label: 'א', items: a.items }];
    if (two) versions.push({ label: 'ב', items: makeClassExam(skills, count, { avoid: a.items.map((x) => x.key) }).items });
    const te = { id: newId(), classCode: cls?.code || null, at: new Date().toISOString(), title: classExamTitle(skills), skills, count, versions, skipped: a.skipped, assignmentId: null };
    addTeacherExam(te);
    navigate(`/teacher/exam/${te.id}`);
  };

  const n = picked.size;
  const submit = () => { if (step === 0) { if (n) setStep(1); } else if (step === 1) setStep(2); else create(); };
  return (
    <Flow className="practice-flow xn" label="מבחן תרגול לכיתה" step={step} steps={3} onBack={() => (step ? setStep(step - 1) : navigate('/teacher'))}
      ask={ASK[step]} mood={step === 0 ? 'excited' : 'idle'} onSubmit={submit}
      foot={<Button type="submit" className="btn-block btn-lg" disabled={!n} data-region="primary">{step === 2 ? 'הכנת המבחן' : 'המשך'}</Button>}>
      {step === 0 && (
        <div className="xn-step" data-region="answers">
          {note.length > 0 && <div className="xn-notes" role="status">{note.map((s) => <p key={s} className="as-hint">{skippedNote(s)}</p>)}</div>}
          {topics.map((t, i) => {
            const all = stairsOf(t); const on = all.filter((s) => picked.has(s)).length;
            return (
              <section key={t.id} className="xn-topic" aria-labelledby={`xn-${t.id}`}>
                <div className="xn-topic-head">
                  <h2 id={`xn-${t.id}`} className="xn-topic-title"><ChapterMark color={t.color} n={i + 1} size="sm" />{t.title}</h2>
                  <button type="button" role="checkbox" aria-checked={on === all.length ? 'true' : on ? 'mixed' : 'false'} aria-label={`כל היחידה: ${t.title}`}
                    className={clsx('as-chip', 'xn-all', on === all.length && 'on')} onClick={() => toggleAll(t)}>כל היחידה</button>
                </div>
                <div className="ob-opts xn-stairs" role="group" aria-labelledby={`xn-${t.id}`}>
                  {t.levels.map((l, j) => {
                    const skill = skillId(t.id, j + 1);
                    return <Pick key={skill} className="xn-stair" on={picked.has(skill)} onClick={() => toggle(skill)}><b><span className="xn-n">{j + 1}.</span> {l.title}</b></Pick>;
                  })}
                </div>
              </section>
            );
          })}
          <p className="field-hint xn-count" aria-live="polite">{n === 0 ? 'עוד לא נבחרו מדרגות.' : n === 1 ? 'נבחרה מדרגה אחת.' : `נבחרו ${n} מדרגות.`}</p>
          <SavedExams exams={exams} classes={profile.classes || []} />
        </div>
      )}
      {step === 1 && (
        <div className="ob-opts" role="radiogroup" aria-labelledby="flow-q" data-region="answers">
          {CLASS_EXAM_LENGTHS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={count === c} className={clsx('ob-opt', count === c && 'on')} onClick={() => setCount(c)}>
              <span className="ob-opt-text"><b>{c} שאלות</b><span>{LENGTH_TIME[c]}</span></span>
            </button>
          ))}
          {n > count
            ? <p className="field-hint">{`בחרתם ${n} מדרגות. במבחן של ${count} שאלות ייכנסו ${count} הראשונות מהן.`}</p>
            : <p className="field-hint">השאלות מתחלקות בין המדרגות שבחרתם, כל אחת ברמה של המדרגה.</p>}
        </div>
      )}
      {step === 2 && (
        <div className="ob-opts" role="radiogroup" aria-labelledby="flow-q" data-region="answers">
          <button type="button" role="radio" aria-checked={!two} className={clsx('ob-opt', !two && 'on')} onClick={() => setTwo(false)}>
            <span className="ob-opt-text"><b>גרסה אחת</b></span>
          </button>
          <button type="button" role="radio" aria-checked={two} className={clsx('ob-opt', two && 'on')} onClick={() => setTwo(true)}>
            <span className="ob-opt-text"><b>שתי גרסאות, א׳ ו־ב׳</b><span>אותן מדרגות עם מספרים אחרים, כך ששכנים לשולחן לא פותרים את אותו מבחן.</span></span>
          </button>
        </div>
      )}
    </Flow>
  );
}
