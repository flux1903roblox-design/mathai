import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, ImageUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { runAI, aiReady } from '@/lib/ai.js';
import { api } from '@/lib/api.js';
import { scoreOf } from '@/lib/exam.js';
import { gradeExam } from '@/lib/examGrade.js';
import { TOPICS, rescueTopicsFor, rowStairs } from '@/content/index.js';
import { MAX_EXAM_PAGES } from '@shared/ai.js';
import { Button, Field, Thinking } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { ScreenBar, ScreenFoot, EmptyState } from '@/components/Screen.jsx';
import { aiAccess, gate, useAIStatus } from '@/lib/account.js';
import ToolLocked from '@/components/ToolLocked.jsx';
import SupportCard from '@/components/SupportCard.jsx';
import { scrubTitle } from '@shared/safety.js';
import { usePhotoWarn } from '@/components/PhotoWarn.jsx';
import PhotoPrep, { EXAM_HEADER } from '@/components/PhotoPrep.jsx';
import '@/styles/lazy/examCheck.css'; // this screen's own rules, loaded with it (STUDENT-15)

/**
 * What the request says about the pages' preparation (trust spec TRUST-5 §2): whether any top band was cut and how many
 * boxes were blacked out, in all. The server counts it, with nothing of the pages.
 */
const prepOf = (pages) => ({ crop: pages.some((p) => p.prep?.crop), boxes: pages.reduce((n, p) => n + (p.prep?.boxes || 0), 0) });
// No PDF is sent any more: every page passes PhotoPrep, and a PDF cannot (trust spec TRUST-5 §3).
const PDF_TOAST = 'אי אפשר לבדוק כאן קובץ PDF. אפשר לצלם את הדפים במקום.';

export default function ExamCheck() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile, practiceExams, progress, addExam } = useApp();
  const practice = practiceExams.find((p) => p.id === params.get('practice')) || null;
  const [pages, setPages] = useState([]); // { data, mediaType, name, prep }
  // pictures waiting for PhotoPrep, the first one open: { id, file }
  const [queue, setQueue] = useState([]);
  const queued = useRef(0);
  const camRef = useRef(null);
  const pickRef = useRef(null);
  const lastInput = useRef(null);
  const { ask, warn: photoWarn } = usePhotoWarn();
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

  // the warning first (once a session), then the camera or the picker; the input remembered for "צילום מחדש"
  const openInput = (el) => { lastInput.current = el; ask(el); };
  const add = (e) => {
    const files = [...(e.target.files || [])]; e.target.value = '';
    let room = MAX_EXAM_PAGES - pages.length - queue.length;
    const next = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) { toast.error(f.type === 'application/pdf' ? PDF_TOAST : `לא הצלחנו לקרוא את ${f.name}`); continue; }
      if (room <= 0) { toast(`אפשר עד ${MAX_EXAM_PAGES} דפים בבדיקה אחת`); break; }
      room -= 1; queued.current += 1;
      next.push({ id: queued.current, file: f });
    }
    if (next.length) setQueue((q) => [...q, ...next]);
  };
  const current = queue[0] || null;
  const shift = () => setQueue((q) => q.slice(1));
  const prepDone = ({ data, prep }) => {
    setPages((list) => [...list, { data, mediaType: 'image/jpeg', name: current.file.name, prep }]);
    shift();
  };

  const check = async () => {
    // the tutor is done for today (the calm sheet says so), or this is the first AI action here (the introduction
    // opens, and the check runs after it): nothing is sent yet
    if (gate('exam', { then: check })) return;
    setState({ phase: 'loading' });
    window.scrollTo?.({ top: 0 });
    try {
      // the grade's topics and those its tests revise from another grade (grade 8 exams use grade 7 algebra), and any
      // topic of the practice exam being checked. A guest row (FUNC-6: ז׳'s "מבוא לפונקציות") lists only its own
      // stairs, each with its own number, so a ז׳ exam's graph question is read as func:1 and never a ח׳ stair
      const rows = Object.fromEntries(rescueTopicsFor(profile.grade || '7').map((t) => [t.id, t]));
      const inPractice = (t) => !!practice?.items.some((i) => i.topic === t.id);
      const topics = TOPICS.filter((t) => rows[t.id] || inPractice(t)).map((t) => ({
        id: t.id, title: t.title,
        levels: rows[t.id]?.only && !inPractice(t) ? rowStairs(rows[t.id]).map((s) => ({ n: s.level, title: s.title })) : t.levels.map((l) => l.title),
      }));
      const result = await runAI('exam', {
        grade: profile.grade || '7', pages: pages.map(({ data, mediaType }) => ({ data, mediaType })), topics, prep: prepOf(pages),
        key: practice ? practice.items.map((i) => ({ prompt: i.plain, answer: i.answer })) : undefined,
      });
      if (!result.readable || !result.questions?.length) {
        // the tutor stopped the maths because the pages worry it: the support card, never "try again"
        if (result.care) { if (mounted.current) setState({ phase: 'care' }); return; }
        const message = 'לא הצלחנו לקרוא את המבחן. צלמו שוב באור טוב, עם כל הדף בתמונה.';
        if (mounted.current) setState({ phase: 'error', message }); else toast.error(message);
        return;
      }
      // A practice exam's questions came from our generators: their topic, level and answer are known exactly, and code
      // decides each one right or wrong against the key (ai spec AI-8); the model only read the handwriting. When the
      // model found another number of questions, or the exam was uploaded without a key, every question keeps the
      // model's grade and says so (graded 'ai').
      result.questions = gradeExam(result.questions, practice, (q, it) => ({
        ...q, topic: it.topic, level: it.level, correctAnswer: it.answer, item: { text: it.text, display: it.display, fig: it.fig, form: it.form, choices: it.choices },
      }));
      const score = scoreOf(result);
      const exam = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36), at: new Date().toISOString(),
        // the subject, never a person: no ID, phone or long number is kept (trust spec TRUST-5 §6; the server does the same)
        title: scrubTitle(title.trim() || practice?.title || result.title || 'מבחן'), source: practice ? 'practice' : 'upload', practiceId: practice?.id || null,
        result, score, levels: Object.fromEntries(Object.entries(progress).map(([k, v]) => [k, v.level])),
      };
      // the stairs where it lost points become the plan's exam-loss items (learn/next.ts), until they are recovered
      addExam(exam);
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
  const locked = !offline && ['locked', 'economy', 'class_off'].includes(access) ? access : null;
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
            <p className="ob-bubble">{practice ? `${practice.title}: צלמו את הדפים שפתרתם. התשובות הנכונות כבר אצלי, אז אני רק קורא ומשווה.` : 'צלמו את דפי המבחן, דף אחד בכל צילום. אבדוק כל שאלה ואסביר.'}</p>
          </div>
          {/* a failed check says so right under the question, where it is seen without scrolling */}
          {state.phase === 'error' && <p className="form-error check-error" role="alert">{state.message}</p>}
          {state.phase === 'care' && <SupportCard variant="after-message" className="exam-support" />}
          <section className="section" aria-labelledby="pages-title" data-region="content">
            <h2 id="pages-title" className="set-head">הדפים ({pages.length} מתוך {MAX_EXAM_PAGES})</h2>
            <ul className="page-thumbs">
              {pages.map((p, i) => (
                <li key={`${p.name}-${i}`} className="page-thumb">
                  <img src={p.data} alt={`דף ${i + 1}`} width={96} height={128} />
                  <span className="page-num">{i + 1}</span>
                  <button type="button" className="icon-btn page-remove" aria-label={`הסרת דף ${i + 1}`} onClick={() => setPages(pages.filter((_, k) => k !== i))}><X size={18} /></button>
                </li>
              ))}
              {pages.length < MAX_EXAM_PAGES && (
                <>
                <li>
                  <button type="button" className="page-add" onClick={() => openInput(camRef.current)}>
                    <Camera size={26} aria-hidden="true" />
                    <span>{pages.length ? 'צילום דף נוסף' : 'צילום דף'}</span>
                  </button>
                </li>
                <li>
                  <button type="button" className="page-add" onClick={() => openInput(pickRef.current)}>
                    <ImageUp size={26} aria-hidden="true" />
                    <span>בחירת תמונה</span>
                  </button>
                </li>
                </>
              )}
            </ul>
            {/* images only: a PDF could not pass the step that hides personal details */}
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={add} />
            <input ref={pickRef} type="file" accept="image/*" multiple className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={add} />
            <p className="field-hint">לתמונה טובה: אור טוב, הדף שטוח וכולו בתמונה. בלי שם ובלי תעודת זהות.</p>
          </section>
          {!practice && (
            <Field label="שם המבחן (לא חובה)" id="ex-title">
              <input id="ex-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="למשל: בוחן בפונקציה קווית…" autoComplete="off" name="exam-title" />
            </Field>
          )}
          <ScreenFoot>
            <Button className="btn-block btn-lg" onClick={check} disabled={!pages.length} data-region="primary">{state.phase === 'error' ? 'לבדוק שוב' : 'בדיקת המבחן'}</Button>
          </ScreenFoot>
          {photoWarn}
          {/* every page passes here before it joins the list: the first page of an exam loses its top band by default */}
          <PhotoPrep file={current?.file || null} crop={pages.length === 0 ? EXAM_HEADER : 0} onDone={prepDone}
            onRetake={() => { shift(); ask(lastInput.current); }} onCancel={shift}
            onError={() => { toast.error(`לא הצלחנו לקרוא את ${current?.file.name || 'התמונה'}`); shift(); }} />
        </>
      )}
    </div>
  );
}
