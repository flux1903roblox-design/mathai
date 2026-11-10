import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, X, Minus, CircleDashed, Sparkles, Route, PencilRuler, ChevronLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { STATUS, focusLevel } from '@/lib/exam.js';
import { TOPIC, topicsFor, displayTex } from '@/content/index.js';
import { aiReady } from '@/lib/ai.js';
import { Box, Button, ChapterMark, Sheet } from '@/components/ui.jsx';
import { Markdown, MathText, Tex } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import AIChat from '@/components/AIChat.jsx';
import Mascot from '@/components/Mascot.jsx';
import { ScreenBar, ScreenFoot, EmptyState, ConfirmSheet } from '@/components/Screen.jsx';
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
      {it.display && <div className="qdisplay small"><Tex tex={displayTex(it)} display /></div>}
      <Figure fig={it.fig} />
      {it.form === 'mc' && it.choices && <p className="exam-choices">{it.choices.map((c, k) => <span key={k}>{String.fromCharCode(1488 + k)}. {c.tex ? <Tex tex={c.tex} /> : c.text}</span>)}</p>}
    </div>
  );
}
/** A unit's number among its grade's own units; 0 for the fractions floor, which has none. */
const topicN = (id) => { const t = TOPIC[id]; return t ? topicsFor(t.grade).indexOf(t) + 1 : 0; };

function TopicTag({ id, mark = false }) {
  const t = TOPIC[id];
  if (!t) return <span className="topic-tag muted">נושא אחר</span>;
  return <span className={`topic-tag ch-${t.color}`}>{mark && topicN(id) > 0 && <ChapterMark color={t.color} n={topicN(id)} size="sm" />}{t.title}</span>;
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
      <div className="q-compare">
        <span className="q-compare-lab">כתבתם</span>
        {q.studentAnswer
          ? <span className={clsx('q-mine', !ok && 'struck')}><Markdown inline>{asMath(q.studentAnswer)}</Markdown></span>
          : <span className="muted">לא נכתבה תשובה</span>}
        {!ok && <><span className="q-compare-lab">נכון</span><span className="q-right"><Markdown inline>{asMath(q.correctAnswer)}</Markdown></span></>}
      </div>
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
  const [params, setParams] = useSearchParams();
  const filter = params.get('show') === 'wrong' ? 'wrong' : 'all';
  const setFilter = (f) => setParams(f === 'wrong' ? { show: 'wrong' } : {}, { replace: true });
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

  if (!exam) return <div className="page pushed"><ScreenBar title="תוצאות המבחן" back="/exams" /><EmptyState mood="encouraging" title="המבחן לא נמצא"><p>אולי הבדיקה נמחקה מהמכשיר.</p></EmptyState><ScreenFoot><Link to="/exams" className="btn btn-primary btn-block btn-lg">לרשימת המבחנים</Link></ScreenFoot></div>;
  const qs = exam.result.questions;
  const wrong = qs.filter((q) => q.status !== 'correct');
  const shown = filter === 'wrong' ? wrong : qs;
  const tone = pctTone(exam.score.pct);
  const lvOf = (w) => Math.min(TOPIC[w.topic]?.levels.length || 1, w.level || progress[w.topic]?.level || 1);
  const first = weak.find((w) => TOPIC[w.topic]);

  // Duolingo's result screen (LAYOUT_SPEC A5/E4): מדי and the title in the middle, the score as tiles, then the
  // review (what to strengthen as plain rows, the feedback per question), and ONE primary pinned at the bottom:
  // practising the weakest topic. The rows open their own practice; nothing else on the screen is a primary.
  return (
    <div className="page pushed exam-result">
      <ScreenBar title="תוצאות המבחן" back="/exams" />
      <section className="result-hero" data-region="content">
        <Mascot mood={tone === 'high' ? 'achievement' : tone === 'mid' ? 'happy' : 'encouraging'} size={112} />
        <h2 className="result-title">{exam.title}</h2>
        <p className="result-sub">{qs.length} שאלות · נבדק ב־{new Date(exam.at).toLocaleDateString('he-IL')}</p>
      </section>
      <div className="stats result-stats" data-region="answers">
        <div className={clsx('stat', tone === 'high' ? 'stat-good' : tone === 'mid' ? 'stat-gold' : 'stat-bad')}>
          <span className="stat-label">ציון</span>
          <span className="stat-value"><bdi dir="ltr">{exam.score.pct}%</bdi></span>
        </div>
        <div className="stat stat-brand">
          <span className="stat-label">נכונות</span>
          <span className="stat-value" aria-label={`${exam.score.correct} נכונות מתוך ${exam.score.total}`}><Check size={20} aria-hidden="true" /><bdi dir="ltr">{exam.score.correct}/{exam.score.total}</bdi></span>
        </div>
        <div className="stat stat-sky">
          <span className="stat-label">לחיזוק</span>
          <span className="stat-value"><Route size={20} aria-hidden="true" />{weak.length}</span>
        </div>
      </div>
      {exam.result.summary && <div className="result-say"><Markdown>{exam.result.summary}</Markdown></div>}

      {weak.length > 0 && (
        <section className="section" aria-labelledby="weak-title">
          <h2 id="weak-title" className="set-head">מה לחזק</h2>
          <ul className="hub-rows">
            {weak.map((w) => {
              const t = TOPIC[w.topic]; const lv = lvOf(w);
              const body = (
                <>
                  <span className="hub-row-text">
                    <span className="hub-row-title"><TopicTag id={w.topic} mark />{t && <span className="weak-level">{t.levels[lv - 1].title}</span>}</span>
                    <span className="hub-row-desc">{w.n === 1 ? 'שאלה אחת עם טעות' : `${w.n} שאלות עם טעות`}{w.skills.length ? `: ${w.skills.slice(0, 3).join(', ')}` : ''}</span>
                    {w.reason && <Markdown className="weak-reason">{w.reason}</Markdown>}
                  </span>
                  {t && <ChevronLeft className="chev" size={20} aria-hidden="true" />}
                </>
              );
              return <li key={w.topic}>{t ? <Link className={clsx('hub-row', 'weak-row', `ch-${t.color}`)} to={`/practice/${w.topic}?level=${lv}&from=plan`} aria-label={`תרגול: ${t.title}, ${t.levels[lv - 1].title}`}>{body}</Link> : <div className="hub-row weak-row">{body}</div>}</li>;
            })}
            <li><Link to="/plan" className="hub-row"><span className="hub-row-icon" aria-hidden="true"><Route size={22} /></span><span className="hub-row-text"><span className="hub-row-title">התוכנית לשיפור</span><span className="hub-row-desc">כל הצעדים, לפי הסדר</span></span><ChevronLeft className="chev" size={20} aria-hidden="true" /></Link></li>
          </ul>
        </section>
      )}

      <section className="section" aria-labelledby="qs-title">
        <div className="qs-head">
          <h2 id="qs-title" className="set-head">משוב לכל שאלה</h2>
          <div className="segmented small" role="radiogroup" aria-label="אילו שאלות להציג">
            <button type="button" role="radio" aria-checked={filter === 'all'} className={clsx('seg', filter === 'all' && 'on')} onClick={() => setFilter('all')}>הכול ({qs.length})</button>
            <button type="button" role="radio" aria-checked={filter === 'wrong'} className={clsx('seg', filter === 'wrong' && 'on')} onClick={() => setFilter('wrong')}>טעויות ({wrong.length})</button>
          </div>
        </div>
        {shown.length === 0 ? <p className="hub-empty">אין טעויות במבחן הזה.</p> : shown.map((q, i) => <QuestionCard key={`${q.number}-${i}`} q={q} onAsk={setAsking} />)}
      </section>

      {exam.result.nextSteps?.length > 0 && (
        <section className="section" aria-labelledby="next-title">
          <h2 id="next-title" className="set-head">מה עושים עכשיו</h2>
          <ol className="steps result-next">{exam.result.nextSteps.map((s, i) => <li key={i}><Markdown>{s}</Markdown></li>)}</ol>
        </section>
      )}

      <p className="footnote">תשובה נכונה בחלקה נספרת כחצי נקודה. המבחן נבדק על ידי העוזר (Claude).{exam.source === 'practice' ? ' התשובות הנכונות נלקחו ממפתח התשובות של האפליקציה.' : ' אם משהו נראה לא נכון, בדקו עם המורה.'}</p>
      <section className="section set-group">
        <div className="set-rows-wrap"><div className="set-rows"><button type="button" className="set-row danger" onClick={() => setConfirmDel(true)}>מחיקת הבדיקה</button></div></div>
      </section>
      <ConfirmSheet open={confirmDel} onOpenChange={setConfirmDel} title="למחוק את הבדיקה?" keep="להשאיר" confirm="כן, למחוק" onConfirm={() => { removeExam(exam.id); navigate('/exams'); }}>
        <p>הבדיקה של "{exam.title}" תימחק מהמכשיר. מה שתרגלתם נשאר.</p>
      </ConfirmSheet>

      <ScreenFoot>
        {first
          ? <Link className="btn btn-primary btn-block btn-lg" to={`/practice/${first.topic}?level=${lvOf(first)}&from=plan`} data-region="primary"><PencilRuler size={18} aria-hidden="true" />תרגול: {TOPIC[first.topic].levels[lvOf(first) - 1].title}</Link>
          : <Link className="btn btn-primary btn-block btn-lg" to="/" data-region="primary">להמשיך במסלול</Link>}
      </ScreenFoot>

      <Sheet open={!!asking} onOpenChange={(o) => !o && setAsking(null)} title={asking ? `שאלה ${asking.number}` : ''}>
        {asking && <AIChat context={{ grade: profile.grade, topic: TOPIC[asking.topic]?.title, question: asking.prompt, correct: asking.correctAnswer, studentAnswer: asking.studentAnswer }} intro="שאלו מה לא ברור בשאלה הזו. אני מכיר את השאלה, את מה שכתבתם ואת התשובה הנכונה." />}
      </Sheet>
    </div>
  );
}
