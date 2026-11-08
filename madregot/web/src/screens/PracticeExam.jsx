import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Printer, ClipboardCheck, Check } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { aiReady } from '@/lib/ai.js';
import { makePracticeExam, weakTopics } from '@/lib/exam.js';
import { TOPIC, topicsFor } from '@/content/index.js';
import { Button, ChapterMark } from '@/components/ui.jsx';
import { MathText, Tex } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import PageHero from '@/components/PageHero.jsx';

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

  const create = () => {
    const items = makePracticeExam(picked, count, progress);
    const pe = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), at: new Date().toISOString(), title: `מבחן תרגול: ${picked.map((id) => TOPIC[id].title).join(', ')}`, items };
    addPracticeExam(pe);
    navigate(`/exams/practice/${pe.id}`, { replace: true });
  };

  return (
    <div className="page">
      <Link to="/exams" className="back-link"><ArrowRight size={18} aria-hidden="true" />מבחנים</Link>
      <PageHero tone="fuchsia" art="study" title="מבחן תרגול" sub="בוחרים נושאים, מדפיסים או פותרים על דף, ובסוף מצלמים לבדיקה. השאלות מותאמות למדרגה שלכם." />
      <fieldset className="fieldset">
        <legend>נושאים</legend>
        <div className="pick-list">
          {list.map((t, i) => (
            <button key={t.id} type="button" role="checkbox" aria-checked={picked.includes(t.id)} className={clsx('pick', `ch-${t.color}`, picked.includes(t.id) && 'on')} onClick={() => toggle(t.id)}>
              <ChapterMark color={t.color} n={i + 1} size="sm" />
              <span>{t.title}</span>
              {picked.includes(t.id) && <Check size={18} aria-hidden="true" className="pick-check" />}
            </button>
          ))}
        </div>
        {fromWeak.length > 0 && !fromLink.length && <p className="field-hint">סימנו מראש את הנושאים שבהם היו טעויות.</p>}
      </fieldset>
      <div className="field"><span className="field-label" id="pe-count">כמה שאלות</span>
        <div className="segmented" role="radiogroup" aria-labelledby="pe-count">
          {[6, 10].map((n) => <button key={n} type="button" role="radio" aria-checked={count === n} className={clsx('seg', count === n && 'on')} onClick={() => setCount(n)}>{n} שאלות</button>)}
        </div>
      </div>
      <Button className="btn-block btn-lg" onClick={create} disabled={!picked.length}>הכנת המבחן</Button>
    </div>
  );
}

/** The printable sheet: questions, figures and room to write. The key stays folded away. */
/** One line of the answer key: the choice letter and its maths, or the value left to right. */
function KeyAnswer({ it }) {
  if (it.form === 'mc' && it.choices) {
    const k = it.choices.findIndex((c) => (c.text || c.tex) === it.answer);
    const c = it.choices[k];
    return <span>{k >= 0 && `${String.fromCharCode(1488 + k)}. `}{c?.tex ? <Tex tex={c.tex} /> : (c?.text ?? it.answer)}</span>;
  }
  return <bdi dir="ltr" className="mathline">{String(it.answer).replace(/-/g, '\u2212')}</bdi>;
}

export function PracticeSheet() {
  const { id } = useParams();
  const { profile, practiceExams } = useApp();
  const pe = practiceExams.find((p) => p.id === id);
  if (!pe) return <div className="page"><p>המבחן לא נמצא.</p><Link to="/exams">לרשימת המבחנים</Link></div>;
  const openKey = () => { const d = document.getElementById('answer-key'); if (d) { d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } };
  return (
    <div className="page print-page">
      <div className="no-print stack">
        <Link to="/exams" className="back-link"><ArrowRight size={18} aria-hidden="true" />מבחנים</Link>
        <div className="form-actions row">
          <Button variant="secondary" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />הדפסה</Button>
          {aiReady()
            ? <Link to={`/exams/check?practice=${pe.id}`} className="btn btn-primary"><ClipboardCheck size={18} aria-hidden="true" />סיימתי, לבדיקה</Link>
            : <Button onClick={openKey}><ClipboardCheck size={18} aria-hidden="true" />סיימתי, למפתח התשובות</Button>}
        </div>
        <p className="muted">{aiReady() ? 'פותרים על דף או במחברת, עם הדרך. בסוף מצלמים את הדפים לבדיקה.' : 'פותרים על דף או במחברת, עם הדרך. בסוף בודקים מול מפתח התשובות שבתחתית העמוד.'}</p>
      </div>
      <article className="exam-sheet">
        <header className="exam-sheet-head">
          <h1 className="h-page">{pe.title}</h1>
          <p className="exam-sheet-meta"><span>שם: {profile.name}</span><span>תאריך: ________</span><span>{pe.items.length} שאלות</span></p>
        </header>
        <ol className="exam-qs">
          {pe.items.map((it, i) => (
            <li key={it.key} className="exam-q">
              <p className="qtext"><span className="ex-num">{i + 1}</span><MathText text={it.text} /></p>
              {it.display && <div className="qdisplay small"><Tex tex={it.form === 'mc' ? it.display : `${it.display} = \\,?`} display /></div>}
              <Figure fig={it.fig} />
              {it.form === 'mc' && <p className="exam-choices">{it.choices.map((c, k) => <span key={k}>{String.fromCharCode(1488 + k)}. {c.tex ? <Tex tex={c.tex} /> : c.text}</span>)}</p>}
              <div className="exam-work" aria-hidden="true" />
              <p className="exam-answer-line">תשובה: <span className="blank" /></p>
            </li>
          ))}
        </ol>
      </article>
      <details className="sol no-print" id="answer-key">
        <summary>מפתח תשובות (למורה או להורה)</summary>
        <ol className="steps answer-key">{pe.items.map((it) => <li key={it.key}><KeyAnswer it={it} /></li>)}</ol>
      </details>
    </div>
  );
}
