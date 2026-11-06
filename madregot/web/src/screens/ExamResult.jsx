import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, X, Minus, CircleDashed, Sparkles, Route, PencilRuler } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { STATUS, focusLevel } from '@/lib/exam.js';
import { TOPIC, TOPICS } from '@/content/index.js';
import { aiReady } from '@/lib/ai.js';
import { Box, Button, ChapterMark, Sheet } from '@/components/ui.jsx';
import { Markdown, MathText, Tex } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import AIChat from '@/components/AIChat.jsx';
import { pctTone } from './Exams.jsx';

const ICON = { correct: Check, partial: Minus, wrong: X, missing: CircleDashed };
// A bare answer like -5 or (3, 0) is set as math so the minus stays on the left in RTL text.
const asMath = (s) => (!s || s.includes('$') || /[\u0590-\u05FF]/.test(s) ? s : `$${s}$`);

/** The question as the student saw it: our own item for a practice exam, else the AI's transcription. */
function Prompt({ q }) {
  if (!q.item) return <Markdown className="q-prompt">{q.prompt}</Markdown>;
  const it = q.item;
  return (
    <div className="q-prompt">
      <p><MathText text={it.text} /></p>
      {it.display && <div className="qdisplay small"><Tex tex={it.form === 'mc' ? it.display : `${it.display} = \\,?`} display /></div>}
      <Figure fig={it.fig} />
      {it.form === 'mc' && it.choices && <p className="exam-choices">{it.choices.map((c, k) => <span key={k}>{String.fromCharCode(1488 + k)}. {c.tex ? <Tex tex={c.tex} /> : c.text}</span>)}</p>}
    </div>
  );
}
const topicN = (id) => { const t = TOPIC[id]; return t ? TOPICS.filter((x) => x.grade === t.grade).indexOf(t) + 1 : 0; };

function TopicTag({ id }) {
  const t = TOPIC[id];
  if (!t) return <span className="topic-tag muted">נושא אחר</span>;
  return <span className={`topic-tag ch-${t.color}`}><ChapterMark color={t.color} n={topicN(id)} size="sm" />{t.title}</span>;
}

function QuestionCard({ q, onAsk }) {
  const Icon = ICON[q.status] || CircleDashed; const st = STATUS[q.status] || STATUS.missing;
  const ok = q.status === 'correct';
  return (
    <article className={clsx('q-card', `st-${st.tone}`)} aria-labelledby={`q-${q.number}`}>
      <header className="q-head">
        <span className="ex-num" id={`q-${q.number}`} aria-label={`שאלה ${q.number}`}>{q.number}</span>
        <span className={clsx('status-chip', st.tone)}><Icon size={15} aria-hidden="true" />{st.label}</span>
        <TopicTag id={q.topic} />
      </header>
      <Prompt q={q} />
      <dl className="q-answers">
        <div><dt>התשובה שלכם</dt><dd className={clsx(!ok && q.studentAnswer && 'struck')}>{q.studentAnswer ? <Markdown>{asMath(q.studentAnswer)}</Markdown> : <span className="muted">לא נכתבה תשובה</span>}</dd></div>
        {!ok && <div><dt>התשובה הנכונה</dt><dd className="right-answer"><Markdown>{asMath(q.correctAnswer)}</Markdown></dd></div>}
      </dl>
      <Box tone={ok ? 'ok' : 'attention'} title={ok ? 'יפה' : 'שימו לב'}><Markdown>{q.feedback}</Markdown></Box>
      {q.solution?.length > 0 && (
        <details className="sol">
          <summary>פתרון לדוגמה</summary>
          <ol className="steps">{q.solution.map((s, i) => <li key={i}><Markdown>{s}</Markdown></li>)}</ol>
        </details>
      )}
      <div className="q-actions">
        {TOPIC[q.topic] && <Link className="btn btn-secondary btn-sm" to={`/practice/${q.topic}${q.level ? `?level=${q.level}` : ''}`}><PencilRuler size={16} aria-hidden="true" />תרגול דומה</Link>}
        {aiReady() && <Button variant="ghost" className="btn-sm" onClick={() => onAsk(q)}><Sparkles size={16} aria-hidden="true" />שאלו על השאלה</Button>}
      </div>
    </article>
  );
}

export default function ExamResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exams, progress, removeExam, profile } = useApp();
  const exam = exams.find((e) => e.id === id);
  const [filter, setFilter] = useState('all');
  const [asking, setAsking] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const weak = useMemo(() => {
    if (!exam) return [];
    const by = {};
    exam.result.questions.forEach((q) => {
      if (q.status === 'correct') return;
      const w = (by[q.topic] ||= { topic: q.topic, lost: 0, n: 0, skills: new Set() });
      w.lost += q.status === 'partial' ? 0.5 : 1; w.n += 1; if (q.skill) w.skills.add(q.skill);
    });
    const reasons = Object.fromEntries((exam.result.weakTopics || []).map((w) => [w.topic, w.reason]));
    return Object.values(by).sort((a, b) => b.lost - a.lost).map((w) => ({ ...w, skills: [...w.skills], reason: reasons[w.topic], level: focusLevel(w.topic, [exam]) }));
  }, [exam]);

  if (!exam) return <div className="page"><p>המבחן לא נמצא.</p><Link to="/exams">לרשימת המבחנים</Link></div>;
  const qs = exam.result.questions;
  const wrong = qs.filter((q) => q.status !== 'correct');
  const shown = filter === 'wrong' ? wrong : qs;

  return (
    <div className="page exam-result">
      <Link to="/exams" className="back-link"><ArrowRight size={18} aria-hidden="true" />מבחנים</Link>
      <header className="result-head">
        <div>
          <h1 className="h-page">{exam.title}</h1>
          <p className="muted">{new Date(exam.at).toLocaleDateString('he-IL')} · {qs.length} שאלות</p>
        </div>
        <div className={`big-score ${pctTone(exam.score.pct)}`}>
          <span className="big-score-num">{exam.score.pct}%</span>
          <span className="big-score-sub">{exam.score.correct} מתוך {exam.score.total}</span>
        </div>
      </header>
      {exam.result.summary && <Markdown className="lead">{exam.result.summary}</Markdown>}

      {weak.length > 0 && (
        <section className="section" aria-labelledby="weak-title">
          <h2 id="weak-title" className="h-section">נושאים לחיזוק</h2>
          <ul className="weak-list">
            {weak.map((w) => {
              const t = TOPIC[w.topic]; const lv = Math.min(t?.levels.length || 1, w.level || progress[w.topic]?.level || 1);
              return (
                <li key={w.topic} className={t ? `ch-${t.color}` : ''}>
                  <div className="weak-main">
                    <TopicTag id={w.topic} />
                    <span className="muted">{w.n === 1 ? 'שאלה אחת עם טעות' : `${w.n} שאלות עם טעות`}{w.skills.length ? ` · ${w.skills.slice(0, 3).join(', ')}` : ''}</span>
                    {w.reason && <Markdown className="weak-reason">{w.reason}</Markdown>}
                  </div>
                  {t && (
                    <div className="row-actions">
                      <Link className="btn btn-primary btn-sm" to={`/practice/${w.topic}?level=${lv}`}>תרגול: {t.levels[lv - 1].title}</Link>
                      {aiReady() && <Link className="btn btn-secondary btn-sm" to={`/assistant?generate=${w.topic}&level=${lv}`}>תרגילים דומים מהעוזר</Link>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" className="btn-block" onClick={() => navigate('/plan')}><Route size={18} aria-hidden="true" />לתוכנית לשיפור</Button>
        </section>
      )}

      <section className="section" aria-labelledby="qs-title">
        <div className="qs-head">
          <h2 id="qs-title" className="h-section">משוב לכל שאלה</h2>
          <div className="segmented small" role="radiogroup" aria-label="אילו שאלות להציג">
            <button type="button" role="radio" aria-checked={filter === 'all'} className={clsx('seg', filter === 'all' && 'on')} onClick={() => setFilter('all')}>הכול ({qs.length})</button>
            <button type="button" role="radio" aria-checked={filter === 'wrong'} className={clsx('seg', filter === 'wrong' && 'on')} onClick={() => setFilter('wrong')}>טעויות ({wrong.length})</button>
          </div>
        </div>
        {shown.length === 0 ? <p className="muted">אין טעויות במבחן הזה.</p> : shown.map((q, i) => <QuestionCard key={`${q.number}-${i}`} q={q} onAsk={setAsking} />)}
      </section>

      {exam.result.nextSteps?.length > 0 && (
        <Box tone="note" title="מה עושים עכשיו">
          <ol className="steps">{exam.result.nextSteps.map((s, i) => <li key={i}><Markdown>{s}</Markdown></li>)}</ol>
        </Box>
      )}

      <p className="footnote">תשובה נכונה בחלקה נספרת כחצי נקודה. המבחן נבדק על ידי העוזר (Claude).{exam.source === 'practice' ? ' התשובות הנכונות נלקחו ממפתח התשובות של האפליקציה.' : ' אם משהו נראה לא נכון, בדקו עם המורה.'}</p>
      <section className="section danger-zone">
        {confirmDel ? (
          <div className="form-actions row"><span>למחוק את הבדיקה הזו מהמכשיר?</span><Button variant="danger" className="btn-sm" onClick={() => { removeExam(exam.id); navigate('/exams'); }}>כן, למחוק</Button><Button variant="ghost" className="btn-sm" onClick={() => setConfirmDel(false)}>ביטול</Button></div>
        ) : <Button variant="danger-outline" className="btn-sm" onClick={() => setConfirmDel(true)}>מחיקת הבדיקה</Button>}
      </section>

      <Sheet open={!!asking} onOpenChange={(o) => !o && setAsking(null)} title={asking ? `שאלה ${asking.number}` : ''}>
        {asking && <AIChat context={{ grade: profile.grade, topic: TOPIC[asking.topic]?.title, question: asking.prompt, correct: asking.correctAnswer, studentAnswer: asking.studentAnswer }} intro="שאלו מה לא ברור בשאלה הזו. העוזר מכיר את השאלה, את מה שכתבתם ואת התשובה הנכונה." />}
      </Sheet>
    </div>
  );
}
