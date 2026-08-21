const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PencilRuler, Loader2, Check, X, RotateCcw, Trophy, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getTopics } from '@/lib/curriculum';
import { generatePractice } from '@/lib/llm';
import { consumeAction, getActions, isPro } from '@/lib/mathActions';

import PaywallGate from '@/components/PaywallGate';

const norm = (s) => String(s || '').replace(/[^\d.,\-/a-zA-Zα-ω]/gi, '').toLowerCase();

export default function Practice() {
  const { user, checkUserAuth } = useAuth();
  const topics = getTopics(user?.grade, user?.track);
  const [selected, setSelected] = useState([]);
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(null);

  const blocked = !isPro(user) && getActions(user) <= 0;

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const start = async () => {
    if (!selected.length || blocked) return;
    setLoading(true);
    try {
      await consumeAction(user);
      await checkUserAuth();
      const topicLabels = selected.map((id) => topics.find((t) => t.id === id)?.label || id);
      const qs = await generatePractice({ topics: topicLabels, count, user });
      if (!qs?.length) throw new Error('empty');
      setQuestions(qs);
      setCurrent(0);
      setResults([]);
      setAnswer('');
      setDone(null);
      db.entities.PracticeSession.create({
        topic: topicLabels[0],
        topics: topicLabels,
        questions: qs,
        total: qs.length,
      }).catch(() => {});
    } catch {
      setLoading(false);
      alert('יצירת התרגול נכשלה. נסה שוב.');
    }
  };

  const submit = () => {
    const q = questions[current];
    const correct = norm(answer) === norm(q.answer);
    const r = { ...q, userAnswer: answer, correct };
    setResults((p) => [...p, r]);
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
      setAnswer('');
    } else {
      const score = [...results, r].filter((x) => x.correct).length;
      setDone({ score, total: questions.length });
    }
  };

  const restart = () => {
    setQuestions(null);
    setSelected([]);
    setResults([]);
    setDone(null);
  };

  if (blocked) return (
    <div className="space-y-5">
      <Header />
      <PaywallGate reason="אזלו לך הפעולות החינמיות — שדרג ל-Pro לתרגול ללא הגבלה" />
    </div>
  );

  return (
    <div className="space-y-5">
      <Header />

      {!questions && !done && (
        <>
          <div>
            <div className="text-sm font-bold mb-2">בחר נושאים לתרגול</div>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`rounded-full px-3.5 py-2 text-sm border transition ${
                    selected.includes(t.id) ? 'border-transparent bg-gradient-to-l from-violet-500/25 to-cyan-400/15 ring-glow' : 'border-white/10 glass hover:bg-white/[0.06]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold mb-2">מספר שאלות</div>
            <div className="flex gap-2">
              {[5, 10, 15].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold border transition ${count === n ? 'border-transparent bg-white/10 ring-glow' : 'border-white/10 glass'}`}>
                  {n} שאלות
                </button>
              ))}
            </div>
          </div>

          <button onClick={start} disabled={!selected.length || loading} className="w-full bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold py-3.5 rounded-xl btn-glow disabled:opacity-40 flex items-center justify-center gap-2 transition">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> יוצר תרגול…</> : <><PencilRuler className="w-4 h-4" /> התחל תרגול</>}
          </button>
        </>
      )}

      {questions && !done && (
        <motion.div key={current} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>שאלה {current + 1} מתוך {questions.length}</span>
            <span>{questions[current].topic}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-l from-violet-500 to-cyan-400 transition-all" style={{ width: `${((current) / questions.length) * 100}%` }} />
          </div>
          <div className="card-base p-5">
            <div className="text-[15px] leading-relaxed">{questions[current].question}</div>
          </div>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            dir="rtl"
            placeholder="הקלד את התשובה שלך…"
            className="w-full glass rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-violet-500/50 text-[15px]"
          />
          <button onClick={submit} disabled={!answer.trim()} className="w-full bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold py-3.5 rounded-xl btn-glow disabled:opacity-40 flex items-center justify-center gap-2 transition">
            {current + 1 < questions.length ? 'שאלה הבאה' : 'סיום תרגול'}
          </button>
        </motion.div>
      )}

      {done && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="card-base p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center mx-auto mb-4 btn-glow">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-extrabold gradient-text">{done.score}/{done.total}</div>
            <div className="text-sm text-muted-foreground mt-1">תשובות נכונות</div>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="card-base p-3.5 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${r.correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {r.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{r.question}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    התשובה שלך: <span className={r.correct ? 'text-emerald-400' : 'text-red-400'}>{r.userAnswer || '—'}</span>
                    {!r.correct && <> · נכון: <span className="text-emerald-400">{r.answer}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={restart} className="w-full glass rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition">
            <RotateCcw className="w-4 h-4" /> תרגול נוסף
          </button>
        </motion.div>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 grid place-items-center btn-glow">
        <PencilRuler className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-display">תרגול חכם</h1>
        <p className="text-xs text-muted-foreground">תרגולים מותאמים לרמה ולנושאים שלך</p>
      </div>
    </header>
  );
}