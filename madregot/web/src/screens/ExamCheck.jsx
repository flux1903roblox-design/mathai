import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Camera, FileUp, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { runAI, aiReady } from '@/lib/ai.js';
import { api } from '@/lib/api.js';
import { scoreOf, focusLevel, baseEntry } from '@/lib/exam.js';
import { TOPICS } from '@/content/index.js';
import { MAX_EXAM_PAGES } from '@shared/ai.js';
import { Box, Button, Field, Thinking } from '@/components/ui.jsx';
import PageHero from '@/components/PageHero.jsx';

async function imageToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
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
    setState({ phase: 'loading' });
    requestAnimationFrame(() => document.querySelector('.check-status')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    try {
      const topics = TOPICS.filter((t) => t.grade === (profile.grade || '7') || practice?.items.some((i) => i.topic === t.id)).map((t) => ({ id: t.id, title: t.title, levels: t.levels.map((l) => l.title) }));
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
      if (mounted.current) setState({ phase: 'error', message: e.message }); else toast.error(e.message);
    }
  };

  return (
    <div className="page">
      <Link to="/exams" className="back-link"><ArrowRight size={18} aria-hidden="true" />מבחנים</Link>
      <PageHero tone="sky" art="upload" title="בדיקת מבחן" sub="מצלמים את הדפים או מעלים PDF. העוזר בודק כל שאלה ומסביר." />
      {practice ? (
        <Box tone="note" title="בודקים מבחן תרגול">
          <p>{practice.title}, {practice.items.length} שאלות. התשובות הנכונות שמורות באפליקציה, אז העוזר רק קורא מה כתבתם ומשווה.</p>
        </Box>
      ) : null}

      {!aiReady() && (
        <Box tone="attention" title="העוזר עוד לא מחובר"><p>הבדיקה צריכה את העוזר. חברו אותו במסך "אני".</p></Box>
      )}

      <section className="section" aria-labelledby="pages-title">
        <h2 id="pages-title" className="h-section">הדפים ({pages.length} מתוך {MAX_EXAM_PAGES})</h2>
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
        <p className="field-hint">לתמונה טובה: אור טוב, הדף שטוח וכולו בתמונה, דף אחד בכל צילום.</p>
      </section>

      {!practice && (
        <Field label="שם המבחן (לא חובה)" id="ex-title">
          <input id="ex-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="למשל: בוחן בפונקציה קווית…" autoComplete="off" name="exam-title" />
        </Field>
      )}

      {state.phase !== 'loading' && <Button className="btn-block btn-lg" onClick={check} disabled={!pages.length || !aiReady()}>בדיקת המבחן</Button>}
      {state.phase === 'loading' && (
        <Box tone="ai" title="העוזר בודק" live className="check-status">
          <Thinking states={['קורא את הדפים', 'מזהה את השאלות', 'בודק כל תשובה', 'כותב משוב אישי', 'בונה תוכנית לשיפור']} />
          <p className="muted">בדיקה של מבחן שלם לוקחת בדרך כלל דקה או שתיים. אפשר להשאיר את המסך פתוח.</p>
        </Box>
      )}
      {state.phase === 'error' && <p className="form-error" role="alert">{state.message}</p>}
    </div>
  );
}
