const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Loader2, Check, X, Trophy, RotateCcw, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getTopics } from '@/lib/curriculum';
import { generateExam } from '@/lib/llm';
import { consumeAction, getActions, isPro } from '@/lib/mathActions';

import PaywallGate from '@/components/PaywallGate';

export default function ExamBuilder() {
  const { user, checkUserAuth } = useAuth();
  const topics = getTopics(user?.grade, user?.track);
  const [selected, setSelected] = useState([]);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [graded, setGraded] = useState(null);

  const blocked = !isPro(user) && getActions(user) <= 0;

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const build = async () => {
    if (!selected.length || blocked) return;
    setLoading(true);
    try {
      await consumeAction(user);
      await checkUserAuth();
      const topicLabels = selected.map((id) => topics.find((t) => t.id === id)?.label || id);
      const qs = await generateExam({ topics: topicLabels, count, user });
      if (!qs?.length) throw new Error('empty');
      setExam({ title: `מבחן אמריקאי · ${topicLabels.join(', ')}`, topics: topicLabels, questions: qs, num_questions: qs.length });
      setAnswers({});
      setGraded(null);
      db.entities.Exam.create({
        title: `מבחן אמריקאי · ${topicLabels.join(', ')}`,
        topics: topicLabels,
        num_questions: qs.length,
        questions: qs,
        status: 'draft',
      }).catch(() => {});
    } catch {
      setLoading(false);
      alert('יצירת המבחן נכשלה. נסה שוב.');
    }
  };

  const grade = () => {
    let score = 0;
    const sheet = exam.questions.map((q, i) => {
      const ua = answers[i] || '';
      const correct = String(ua).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
      if (correct) score++;
      return { ...q, userAnswer: ua, correct };
    });
    setGraded({ score, total: exam.questions.length, sheet });
    db.entities.Exam.update(exam.id || undefined, { score, status: 'completed' }).catch(() => {});
  };

  const restart = () => { setExam(null); setSelected([]); setGraded(null); setAnswers({}); };

  if (blocked) return (
    <div className="space-y-5">
      <Header />
      <PaywallGate reason="אזלו לך הפעולות החינמיות — שדרג ל-Pro לבניית מבחנים ללא הגבלה" />
    </div>
  );

  return (
    <div className="space-y-5">
      <Header />

      {!exam && !graded && (
        <>
          <div>
            <div className="text-sm font-bold mb-2">נושאי המבחן</div>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <button key={t.id} onClick={() => toggle(t.id)}
                  className={`rounded-full px-3.5 py-2 text-sm border transition ${selected.includes(t.id) ? 'border-transparent bg-gradient-to-l from-amber-400/25 to-violet-500/15 ring-glow' : 'border-white/10 glass hover:bg-white/[0.06]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-bold mb-2">מספר שאלות</div>
            <div className="flex gap-2">
              {[10, 20, 30].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold border transition ${count === n ? 'border-transparent bg-white/10 ring-glow' : 'border-white/10 glass'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={build} disabled={!selected.length || loading} className="w-full bg-gradient-to-l from-amber-400 to-violet-500 text-white font-bold py-3.5 rounded-xl btn-glow disabled:opacity-40 flex items-center justify-center gap-2 transition">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> בונה מבחן…</> : <><ClipboardList className="w-4 h-4" /> בנה מבחן אמריקאי</>}
          </button>
        </>
      )}

      {exam && !graded && (
        <>
          <div className="text-sm text-muted-foreground">{exam.title} · {exam.questions.length} שאלות</div>
          <div className="space-y-3">
            {exam.questions.map((q, i) => (
              <div key={i} className="card-base p-4">
                <div className="text-xs text-violet-300 mb-1.5">שאלה {i + 1} · {q.topic}</div>
                <div className="text-[15px] leading-relaxed mb-3">{q.question}</div>
                <input
                  value={answers[i] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  dir="rtl"
                  placeholder="הפתרון שלך…"
                  className="w-full glass rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500/40 text-sm"
                />
              </div>
            ))}
          </div>
          <button onClick={grade} className="w-full bg-gradient-to-l from-amber-400 to-violet-500 text-white font-bold py-3.5 rounded-xl btn-glow flex items-center justify-center gap-2 transition">
            בדוק את המבחן
          </button>
        </>
      )}

      {graded && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="card-base p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center mx-auto mb-4 btn-glow">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-extrabold gradient-text">{graded.score}/{graded.total}</div>
            <div className="text-sm text-muted-foreground mt-1">ציון המבחן</div>
          </div>
          <div className="space-y-2">
            {graded.sheet.map((r, i) => (
              <div key={i} className="card-base p-3.5 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${r.correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {r.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{r.question}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {r.userAnswer ? <span>התשובה שלך: {r.userAnswer} · </span> : 'לא ענית · '}
                    נכון: <span className="text-emerald-400">{r.answer}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={restart} className="w-full glass rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition">
            <RotateCcw className="w-4 h-4" /> מבחן נוסף
          </button>
        </motion.div>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center btn-glow">
        <ClipboardList className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-extrabold">בניית מבחן</h1>
        <p className="text-xs text-muted-foreground">מבחן אמריקאי בסגנון בגרות</p>
      </div>
    </header>
  );
}