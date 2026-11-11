import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, FileUp, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { runAI, aiReady } from '@/lib/ai.js';
import { api } from '@/lib/api.js';
import { scoreOf, focusLevel, baseEntry } from '@/lib/exam.js';
import { TOPICS, rescueTopicsFor } from '@/content/index.js';
import { MAX_EXAM_PAGES } from '@shared/ai.js';
import { Button, Field, Thinking } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { ScreenBar, ScreenFoot, EmptyState } from '@/components/Screen.jsx';
import { aiAccess, gate, useAIStatus } from '@/lib/account.js';
import ToolLocked from '@/components/ToolLocked.jsx';
import '@/styles/lazy/examCheck.css'; // this screen's own rules, loaded with it (STUDENT-15)

async function imageToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); // colour-ok: a JPEG has no alpha, so the canvas is filled white before the photo
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
const readDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

export default function ExamCheck() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile, practiceExams, progress, exams, wins, addExam, resetPlanBase } = useApp();
  const practice = practiceExams.find((p) => p.id === params.get('practice')) || null;
  const [pages, setPages] = useState([]); // { data, mediaType, name }
  const [title, setTitle] = useState('');
  const [state, setState] = useState({ phase: 'idle' });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  // Closing the tab mid-check would lose the request: ask first.
  useEffect(() => {
    if (state.phase !== 'loading') return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.phase]);

  const add = async (e) => {
    const files = [...(e.target.files || [])]; e.target.value = '';
    const next = [...pages];
    for (const f of files) {
      if (next.length >= MAX_EXAM_PAGES) { toast(`אפשר עד ${MAX_EXAM_PAGES} דפים בבדיקה אחת`); break; }
      try {
        if (f.type === 'application/pdf') {
          if (f.size > 9_000_000) { toast.error('קובץ ה־PDF גדול מדי (עד 9MB).'); continue; }
          next.push({ data: await readDataUrl(f), mediaType: 'application/pdf', name: f.name });
        } else if (f.type.startsWith('image/')) {
          next.push({ data: await imageToJpeg(f), mediaType: 'image/jpeg', name: f.name });
        }
      } catch { toast.error(`לא הצלחנו לקרוא את ${f.name}`); }
    }
    setPages(next);
  };

  const check = async () => {
    if (gate('exam')) return; // the tutor is done for today: the calm sheet says so, nothing is sent
    setState({ phase: 'loading' });
    window.scrollTo?.({ top: 0 });
    try {
      // the grade's topics and those its tests revise from another grade (grade 8 exams use grade 7 algebra), and any
      // topic of the practice exam being checked
      const own = rescueTopicsFor(profile.grade || '7').map((t) => t.id);
      const topics = TOPICS.filter((t) => own.includes(t.id) || practice?.items.some((i) => i.topic === t.id)).map((t) => ({ id: t.id, title: t.title, levels: t.levels.map((l) => l.title) }));
      const result = await runAI('exam', {
        grade: profile.grade || '7', pages: pages.map(({ data, mediaType }) => ({ data, mediaType })), topics,
        key: practice ? practice.items.map((i) => ({ prompt: i.plain, answer: i.answer })) : undefined,
      });
      if (!result.readable || !result.questions?.length) {
        const message = 'לא הצלחנו לקרוא את המבחן. צלמו שוב באור טוב, עם כל הדף בתמונה.';
        if (mounted.current) setState({ phase: 'error', message }); else toast.error(message);
        return;
      }
      // A practice exam's questions came from our generators: their topic and level are known exactly.
      if (practice && result.questions.length === practice.items.length) {
        result.questions = result.questions.map((q, i) => {
          const it = practice.items[i];
          return { ...q, topic: it.topic, level: it.level, correctAnswer: it.answer, item: { text: it.text, display: it.display, fig: it.fig, form: it.form, choices: it.choices } };
        });
      }
      const score = scoreOf(result);
      const exam = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36), at: new Date().toISOString(),
        title: title.trim() || practice?.title || result.title || 'מבחן', source: practice ? 'practice' : 'upload', practiceId: practice?.id || null,
        result, score, levels: Object.fromEntries(Object.entries(progress).map(([k, v]) => [k, v.level])),
      };
      addExam(exam);
      // A new exam restarts the plan's steps for the topics it found weak, at the level where points were lost.
      const weakIds = [...new Set(result.questions.filter((q) => q.status !== 'correct').map((q) => q.topic))].filter((t) => TOPICS.some((x) => x.id === t));
      resetPlanBase(Object.fromEntries(weakIds.map((t) => [t, baseEntry(t, focusLevel(t, [exam, ...exams]) ?? progress[t]?.level ?? 1, wins, exam.at)])));
      if (profile.token) {
        api('/api/exams', { method: 'POST', body: { title: exam.title, correct: score.correct, total: score.total, questions: result.questions.map((q) => ({ topic: q.topic, status: q.status, skill: q.skill, level: q.level })), weakTopics: (result.weakTopics || []).map((w) => w.topic) } }).catch(() => {});
      }
      if (mounted.current) navigate(`/exams/${exam.id}`, { replace: true });
      else toast.success('בדיקת המבחן מוכנה', { action: { label: 'לתוצאות', onClick: () => navigate(`/exams/${exam.id}`) } });
    } catch (e) {
      if (e.limit) { if (mounted.current) setState({ phase: 'idle' }); return; }
      if (mounted.current) setState({ phase: 'error', message: e.message }); else toast.error(e.message);
    }
  };

  const offline = !aiReady();
  // the exam check is the full tutor's: where this device does not have it, say so before any page is photographed
  const status = useAIStatus((x) => x.status);
  const access = aiAccess('exam', status).state;
  const locked = !offline && (access === 'locked' || access === 'economy') ? access : null;
  // A pushed screen (LAYOUT_SPEC E2): the bar with the way back, the pages, and ONE primary pinned at the bottom.
  return (
    <div className="page pushed exam-check">
      <ScreenBar title={practice ? 'בדיקת מבחן תרגול' : 'בדיקת מבחן'} back="/exams" />
      {offline ? (
        <>
          <EmptyState mood="encouraging" title="הבדיקה צריכה את העוזר">
            <p>בגרסה הזו העוזר עוד לא מחובר, אז אי אפשר לבדוק כאן דפים מצולמים.</p>
            <p>{practice ? 'את מבחן התרגול הזה אפשר לבדוק מול מפתח התשובות שבדף המבחן.' : 'מבחן תרגול מודפס אפשר לבדוק מול מפתח התשובות שלו.'}</p>
          </EmptyState>
          <ScreenFoot>
            {practice
              ? <Link to={`/exams/practice/${practice.id}`} className="btn btn-primary btn-block btn-lg" data-region="primary">חזרה למבחן ולמפתח התשובות</Link>
              : <Link to="/exams/new" className="btn btn-primary btn-block btn-lg" data-region="primary">הכנת מבחן תרגול</Link>}
            <Link to="/settings" state={{ focus: 'ai' }} className="foot-link">איך מחברים את העוזר</Link>
          </ScreenFoot>
        </>
      ) : locked ? (
        <>
          <section className="empty-state" data-region="content">
            <ToolLocked kind="exam" state={locked} />
          </section>
          <ScreenFoot>
            {practice
              ? <Link to={`/exams/practice/${practice.id}`} className="btn btn-primary btn-block btn-lg" data-region="primary">חזרה למבחן ולמפתח התשובות</Link>
              : <Link to="/exams/new" className="btn btn-primary btn-block btn-lg" data-region="primary">מבחן תרגול עם מפתח תשובות</Link>}
          </ScreenFoot>
        </>
      ) : state.phase === 'loading' ? (
        <section className="empty-state check-status" aria-live="polite" data-region="content">
          <Mascot mood="thinking" size={120} className="empty-madi" />
          <h2 className="empty-title">העוזר בודק את המבחן</h2>
          <Thinking states={['קורא את הדפים', 'מזהה את השאלות', 'בודק כל תשובה', 'כותב משוב אישי', 'בונה תוכנית לשיפור']} />
          <p className="empty-text">בדיקה של מבחן שלם לוקחת בדרך כלל דקה או שתיים. אפשר להשאיר את המסך פתוח.</p>
        </section>
      ) : (
        <>
          <div className="ob-ask check-ask" data-region="question">
            <p className="ob-bubble">{practice ? `${practice.title}: צלמו את הדפים שפתרתם. התשובות הנכונות כבר אצלי, אז אני רק קורא ומשווה.` : 'צלמו את דפי המבחן, דף אחד בכל צילום, או העלו PDF. אבדוק כל שאלה ואסביר.'}</p>
          </div>
          {/* a failed check says so right under the question, where it is seen without scrolling */}
          {state.phase === 'error' && <p className="form-error check-error" role="alert">{state.message}</p>}
          <section className="section" aria-labelledby="pages-title" data-region="content">
            <h2 id="pages-title" className="set-head">הדפים ({pages.length} מתוך {MAX_EXAM_PAGES})</h2>
            <ul className="page-thumbs">
              {pages.map((p, i) => (
                <li key={`${p.name}-${i}`} className="page-thumb">
                  {p.mediaType === 'application/pdf'
                    ? <span className="pdf-thumb"><FileText size={28} aria-hidden="true" /><span>{p.name}</span></span>
                    : <img src={p.data} alt={`דף ${i + 1}`} width={96} height={128} />}
                  <span className="page-num">{i + 1}</span>
                  <button type="button" className="icon-btn page-remove" aria-label={`הסרת דף ${i + 1}`} onClick={() => setPages(pages.filter((_, k) => k !== i))}><X size={18} /></button>
                </li>
              ))}
              {pages.length < MAX_EXAM_PAGES && (
                <>
                <li>
                  <label className="page-add">
                    <input type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={add} />
                    <Camera size={26} aria-hidden="true" />
                    <span>{pages.length ? 'צילום דף נוסף' : 'צילום דף'}</span>
                  </label>
                </li>
                <li>
                  <label className="page-add">
                    <input type="file" accept="image/*,application/pdf" multiple className="visually-hidden" onChange={add} />
                    <FileUp size={26} aria-hidden="true" />
                    <span>תמונה או PDF</span>
                  </label>
                </li>
                </>
              )}
            </ul>
            <p className="field-hint">לתמונה טובה: אור טוב, הדף שטוח וכולו בתמונה.</p>
          </section>
          {!practice && (
            <Field label="שם המבחן (לא חובה)" id="ex-title">
              <input id="ex-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="למשל: בוחן בפונקציה קווית…" autoComplete="off" name="exam-title" />
            </Field>
          )}
          <ScreenFoot>
            <Button className="btn-block btn-lg" onClick={check} disabled={!pages.length} data-region="primary">{state.phase === 'error' ? 'לבדוק שוב' : 'בדיקת המבחן'}</Button>
          </ScreenFoot>
        </>
      )}
    </div>
  );
}
