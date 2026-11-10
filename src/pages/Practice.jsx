const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { PencilRuler, Loader2, Check, X, RotateCcw, Trophy, Flame, Zap, Eye } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getTopics } from '@/lib/curriculum';
import { generatePractice } from '@/lib/llm';
import { consumeAction, getActions, isPro } from '@/lib/mathActions';
import { answersMatch } from '@/lib/answers';
import { addXP } from '@/lib/progress';
import { sfx } from '@/lib/sound';
import MathMarkdown from '@/components/MathMarkdown';
import FeedbackSheet from '@/components/learn/FeedbackSheet';

import PaywallGate from '@/components/PaywallGate';

const XP_FIRST_TRY = 10;
const XP_RETRY = 5;

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
  const [status, setStatus] = useState(null); // null | 'correct' | 'wrong' | 'revealed'
  const [attempts, setAttempts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [gain, setGain] = useState(0);

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
      setStatus(null);
      setAttempts(0);
      setCombo(0);
      setXp(0);
      db.entities.PracticeSession.create({
        topic: topicLabels[0],
        topics: topicLabels,
        questions: qs,
        total: qs.length,
      }).catch(() => {});
    } catch {
      alert('יצירת התרגול נכשלה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const q = questions?.[current];

  const markCorrect = () => {
    const g = attempts === 0 ? XP_FIRST_TRY : XP_RETRY;
    setGain(g);
    setXp((x) => x + g);
    setCombo((c) => c + 1);
    setStatus('correct');
    addXP(user?.id, g); // practice counts toward the daily goal and streak too
    sfx.correct();
  };

  // Immediate feedback per question (instead of only at the end).
  const check = () => {
    if (!answer.trim() || status) return;
    if (answersMatch(answer, q.answer)) return markCorrect();
    setStatus('wrong');
    setAttempts((a) => a + 1);
    setCombo(0);
    sfx.wrong();
  };

  const next = () => {
    const r = { ...q, userAnswer: answer, correct: status === 'correct' };
    const all = [...results, r];
    setResults(all);
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
      setAnswer('');
      setStatus(null);
      setAttempts(0);
      return;
    }
    const score = all.filter((x) => x.correct).length;
    setDone({ score, total: questions.length });
    if (score / questions.length >= 0.7) {
      sfx.complete();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true, colors: ['#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#34d399'] });
    }
  };

  const restart = () => {
    setQuestions(null);
    setSelected([]);
    setResults([]);
    setDone(null);
    setStatus(null);
  };

  if (blocked && !questions) return (
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
                  className={`rounded-full px-3.5 py-2 text-sm border transition pressable ${
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
                <button key={n} onClick={() => setCount(n)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold border transition pressable ${count === n ? 'border-transparent bg-white/10 ring-glow' : 'border-white/10 glass'}`}>
                  {n} שאלות
                </button>
              ))}
            </div>
          </div>

          <button onClick={start} disabled={!selected.length || loading} className="w-full btn-chunky chunky-primary py-3.5 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> יוצר תרגול…</> : <><PencilRuler className="w-4 h-4" /> התחל תרגול</>}
          </button>
        </>
      )}

      {questions && !done && (
        <div className="space-y-4 pb-40">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-1">
              {questions.map((_, j) => (
                <div key={j} className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                  j < results.length ? (results[j].correct ? 'bg-emerald-400' : 'bg-rose-400/80') : j === current ? 'bg-violet-400/60' : 'bg-white/10'
                }`} />
              ))}
            </div>
            <AnimatePresence>
              {combo >= 2 && (
                <motion.div key={combo} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
                  className="flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-400/40 text-orange-300 text-xs font-extrabold px-2 py-1">
                  <Flame className="w-3.5 h-3.5 fill-orange-400" /> {combo}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div key={current} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>שאלה {current + 1} מתוך {questions.length}</span>
              <span>{q.topic}</span>
            </div>
            <div className="card-base p-5">
              <div className="math-prose text-[16px] leading-relaxed [&_p]:mb-1"><MathMarkdown>{q.question}</MathMarkdown></div>
            </div>
            <input
              value={answer}
              onChange={(e) => { setAnswer(e.target.value); if (status === 'wrong') setStatus(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!status) check(); } }}
              disabled={status === 'correct' || status === 'revealed'}
              dir="rtl"
              placeholder="הקלד את התשובה שלך…"
              className={`w-full rounded-xl px-4 py-3.5 outline-none border-2 text-[16px] transition ${
                status === 'correct' ? 'border-emerald-400/70 bg-emerald-400/10' : status === 'wrong' ? 'border-rose-400/70 bg-rose-400/10 animate-shake' : 'glass border-white/10 focus:border-violet-400/70'
              }`}
            />
            {!status && (
              <button onClick={check} disabled={!answer.trim()} className="w-full btn-chunky chunky-primary py-3.5 text-lg">
                בדיקה
              </button>
            )}
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {questions && !done && status && (
          <FeedbackSheet
            key={`${current}-${status}-${attempts}`}
            status={status}
            message="לא בדיוק. נסה שוב — או לחץ ״הראה לי״ כדי לראות את הפתרון."
            explain={`${status === 'revealed' ? `**התשובה:** ${q.answer}\n\n` : ''}${q.explanation || ''}`}
            xp={status === 'correct' ? gain : 0}
            canReveal
            onContinue={next}
            onRetry={() => setStatus(null)}
            onReveal={() => setStatus('revealed')}
            tutor={
              <button type="button" onClick={markCorrect} className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-100/80 hover:text-white transition">
                <Check className="w-4 h-4" /> התשובה שלי נכונה (נכתבה אחרת)
              </button>
            }
          />
        )}
      </AnimatePresence>

      {done && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="card-base p-8 text-center">
            <motion.div initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center mx-auto mb-4 btn-glow">
              <Trophy className="w-8 h-8 text-white" />
            </motion.div>
            <div dir="ltr" className="text-3xl font-extrabold gradient-text">{done.score}/{done.total}</div>
            <div className="text-sm text-muted-foreground mt-1">תשובות נכונות</div>
            {xp > 0 && (
              <div className="inline-flex items-center gap-1 mt-3 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-sm font-extrabold px-3 py-1">
                <Zap className="w-4 h-4" /> <bdi dir="ltr">+{xp}</bdi> XP
              </div>
            )}
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="card-base p-3.5 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${r.correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {r.correct ? <Check className="w-4 h-4" /> : r.userAnswer ? <X className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm math-prose [&_p]:m-0"><MathMarkdown>{r.question}</MathMarkdown></div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    התשובה שלך: <span className={r.correct ? 'text-emerald-400' : 'text-red-400'}>{r.userAnswer || '—'}</span>
                    {!r.correct && <> · נכון: <span className="text-emerald-400">{r.answer}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={restart} className="w-full btn-chunky chunky-ghost py-3.5 flex items-center justify-center gap-2">
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
