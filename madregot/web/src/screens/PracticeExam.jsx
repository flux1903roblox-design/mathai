import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Printer, Check } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { hasTool, useAIStatus } from '@/lib/account.js';
import { makePracticeExam, weakTopics } from '@/lib/exam.js';
import { TOPIC, topicsFor, displayTex, ensureGens } from '@/content/index.js';
import { Button, ChapterMark } from '@/components/ui.jsx';
import { MathText, Tex } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import { ScreenBar, ScreenFoot, EmptyState, Flow } from '@/components/Screen.jsx';
import '@/styles/lazy/practiceExam.css'; // this screen's own rules, loaded with it (STUDENT-15)

/** Pick topics and a length; the exam is drawn from the generators with an exact answer key. */
export function NewPracticeExam() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile, progress, exams, mistakes, addPracticeExam } = useApp();
  const list = topicsFor(profile.grade || '7');
  const fromLink = (params.get('topics') || '').split(',').filter((id) => TOPIC[id]);
  const fromWeak = weakTopics({ exams, mistakes }).map((w) => w.topic).filter((id) => list.some((t) => t.id === id));
  const [picked, setPicked] = useState(fromLink.length ? fromLink : fromWeak.length ? fromWeak.slice(0, 2) : [list[0].id]);
  const [count, setCount] = useState(6);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // the topics' exercise generators load on demand (the boot split): fetched while the topics are chosen, and waited
  // for before the exam is drawn ("הכנת המבחן" stays off for that moment)
  useEffect(() => { ensureGens(list.map((t) => t.id)).catch(() => {}); }, [profile.grade]); // eslint-disable-line react-hooks/exhaustive-deps
  const [making, setMaking] = useState(false);
  const create = async () => {
    if (making) return;
    setMaking(true);
    try { await ensureGens(picked); } catch { setMaking(false); return; }
    const items = makePracticeExam(picked, count, progress);
    const pe = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), at: new Date().toISOString(), title: `מבחן תרגול: ${picked.map((id) => TOPIC[id].title).join(', ')}`, items };
    addPracticeExam(pe);
    navigate(`/exams/practice/${pe.id}`, { replace: true });
  };

  const [step, setStep] = useState(0);
  // A question flow (LAYOUT_SPEC E3), like the Exam Rescue details: one question per screen, "המשך" at the bottom.
  return (
    <Flow className="practice-flow" label="מבחן תרגול" step={step} steps={2} onBack={() => (step ? setStep(0) : navigate('/exams'))}
      ask={step === 0 ? 'על אילו נושאים יהיה המבחן?' : 'כמה שאלות במבחן?'} mood={step === 0 ? 'excited' : 'idle'}
      onSubmit={() => (step === 0 ? picked.length && setStep(1) : create())}
      foot={<Button type="submit" className="btn-block btn-lg" disabled={!picked.length || making} data-region="primary">{step === 0 ? 'המשך' : 'הכנת המבחן'}</Button>}>
      {step === 0 ? (
        <div className="ob-opts" role="group" aria-labelledby="flow-q" data-region="answers">
          {list.map((t, i) => {
            const on = picked.includes(t.id);
            return (
              <button key={t.id} type="button" role="checkbox" aria-checked={on} className={clsx('ob-opt', `ch-${t.color}`, on && 'on')} onClick={() => toggle(t.id)}>
                <span className="ob-opt-glyph"><ChapterMark color={t.color} n={i + 1} size="sm" /></span>
                <span className="ob-opt-text"><b>{t.title}</b></span>
                <span className="ob-check" aria-hidden="true">{on && <Check size={18} strokeWidth={3} />}</span>
              </button>
            );
          })}
          {fromWeak.length > 0 && !fromLink.length && <p className="field-hint">סימנתי מראש את הנושאים שבהם היו טעויות.</p>}
        </div>
      ) : (
        <div className="ob-opts" role="radiogroup" aria-labelledby="flow-q" data-region="answers">
          {[[6, 'כ־20 דקות'], [10, 'כ־35 דקות']].map(([n, t]) => (
            <button key={n} type="button" role="radio" aria-checked={count === n} className={clsx('ob-opt', count === n && 'on')} onClick={() => setCount(n)}>
              <span className="ob-opt-text"><b>{n} שאלות</b><span>{t}</span></span>
            </button>
          ))}
          <p className="field-hint">השאלות מותאמות למדרגה שלכם בכל נושא. פותרים על דף, ובסוף בודקים.</p>
        </div>
      )}
    </Flow>
  );
}

/**
 * One line of the answer key: the choice letter and its maths, or the value left to right (and its unit). A practice
 * exam keeps the answer as text; a class exam keeps the raw answer (a choice's index) and its text (`answerText`).
 */
export function KeyAnswer({ it }) {
  if (it.form === 'mc' && it.choices) {
    const k = Number.isInteger(it.answer) ? it.answer : it.choices.findIndex((c) => (c.text || c.tex) === it.answer);
    const c = it.choices[k];
    return <span>{k >= 0 && `${String.fromCharCode(1488 + k)}. `}{c?.tex ? <Tex tex={c.tex} /> : (c?.text ?? it.answerText ?? it.answer)}</span>;
  }
  const text = String(it.answerText ?? it.answer);
  // Hebrew words stay in the line's own direction; numbers and expressions are set left to right
  if (/[\u0590-\u05FF]/.test(text)) return <span>{text}</span>;
  return <><bdi dir="ltr" className="mathline">{text.replace(/-/g, '\u2212')}</bdi>{it.answerText != null && it.unit ? ` ${it.unit}` : ''}</>;
}

/**
 * One question of a printed exam: its number, the words and the maths, the drawing, the choices, room to work and the
 * answer line. The student's practice sheet and the teacher's class exam print the same way.
 */
export function ExamQuestion({ it, n, className, as: Tag = 'li' }) {
  return (
    <Tag className={clsx('exam-q', it.fig && 'has-fig', className)}>
      <p className="qtext"><span className="ex-num">{n}</span><MathText text={it.text} /></p>
      {it.display && <div className="qdisplay small"><Tex tex={displayTex(it)} display /></div>}
      <Figure fig={it.fig} />
      {it.form === 'mc' && <p className="exam-choices">{it.choices.map((c, k) => <span key={k}>{String.fromCharCode(1488 + k)}. {c.tex ? <Tex tex={c.tex} /> : c.text}</span>)}</p>}
      <div className="exam-work" aria-hidden="true" />
      <p className="exam-answer-line">תשובה: <span className="blank" /></p>
    </Tag>
  );
}

/** The printable sheet: questions, figures and room to write. The key stays folded away. */
export function PracticeSheet() {
  const { id } = useParams();
  const { profile, practiceExams } = useApp();
  const pe = practiceExams.find((p) => p.id === id);
  const status = useAIStatus((x) => x.status); // the exam check is offered only where this device has it
  if (!pe) return <div className="page pushed"><ScreenBar title="מבחן תרגול" back="/exams" /><EmptyState mood="encouraging" title="המבחן לא נמצא"><p>אולי הוא נמחק. אפשר להכין מבחן חדש.</p></EmptyState><ScreenFoot><Link to="/exams/new" className="btn btn-primary btn-block btn-lg">מבחן תרגול חדש</Link></ScreenFoot></div>;
  const openKey = () => { const d = document.getElementById('answer-key'); if (d) { d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } };
  const ai = hasTool('exam', status);
  // A pushed screen (LAYOUT_SPEC E2): the bar (with printing at its end), the sheet, ONE primary pinned at the bottom.
  return (
    <div className="page pushed print-page">
      <ScreenBar title="מבחן תרגול" back="/exams" className="no-print" end={<button type="button" className="icon-btn" onClick={() => window.print()} aria-label="הדפסה"><Printer size={22} aria-hidden="true" /></button>} />
      <p className="muted no-print sheet-note">{ai ? 'פותרים על דף או במחברת, עם הדרך. בסוף מצלמים את הדפים לבדיקה.' : 'פותרים על דף או במחברת, עם הדרך. בסוף בודקים מול מפתח התשובות שבתחתית העמוד.'}</p>
      <article className="exam-sheet" data-region="content">
        <header className="exam-sheet-head">
          <h1 className="h-page">{pe.title}</h1>
          <p className="exam-sheet-meta"><span>שם: {profile.name}</span><span>תאריך: ________</span><span>{pe.items.length} שאלות</span></p>
        </header>
        <ol className="exam-qs">
          {pe.items.map((it, i) => <ExamQuestion key={it.key} it={it} n={i + 1} />)}
        </ol>
      </article>
      <details className="sol no-print" id="answer-key">
        <summary>מפתח תשובות (למורה או להורה)</summary>
        <ol className="steps answer-key">{pe.items.map((it) => <li key={it.key}><KeyAnswer it={it} /></li>)}</ol>
      </details>
      <ScreenFoot className="no-print">
        {ai
          ? <Link to={`/exams/check?practice=${pe.id}`} className="btn btn-primary btn-block btn-lg" data-region="primary">סיימתי, לבדיקה</Link>
          : <Button className="btn-block btn-lg" onClick={openKey} data-region="primary">סיימתי, למפתח התשובות</Button>}
      </ScreenFoot>
    </div>
  );
}
