import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Navigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { X, Lightbulb, Volume2, VolumeX, Flame, Zap, Target, Trophy, Hand } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getLesson, courseOf, lessonAfter } from '@/lessons';
import { completeLesson } from '@/lib/progress';
import { sfx, soundOn, setSoundOn } from '@/lib/sound';
import MathMarkdown from '@/components/MathMarkdown';
import FeedbackSheet, { AskTutor } from '@/components/learn/FeedbackSheet';

const XP_FIRST_TRY = 10;
const XP_RETRY = 5;
const XP_EXPLORE = 5;
const XP_FINISH = 20;

export default function Lesson() {
  const { lessonId } = useParams();
  const lesson = getLesson(lessonId);
  if (!lesson) return <Navigate to="/learn" replace />;
  return <LessonPlayer key={lesson.id} lesson={lesson} />;
}

function LessonPlayer({ lesson }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const course = courseOf(lesson.id);
  const { steps } = lesson;
  const checkCount = steps.filter((s) => s.kind === 'check').length;

  const [i, setI] = useState(0);
  const [values, setValues] = useState(() => steps.map((s) => s.init));
  const [status, setStatus] = useState(null); // null | 'correct' | 'wrong' | 'revealed'
  const [message, setMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const [gain, setGain] = useState(0);
  const [stats, setStats] = useState({ xp: 0, firstTry: 0, combo: 0, best: 0 });
  const [result, setResult] = useState(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [muted, setMuted] = useState(() => !soundOn());

  const step = steps[i];
  const value = values[i];
  const Widget = step.widget;
  const locked = status === 'correct' || status === 'revealed';
  const ready = step.ready ? step.ready(value) : true;

  const setValue = (v) => {
    setValues((vs) => vs.map((x, j) => (j === i ? v : x)));
    if (status === 'wrong') setStatus(null); // trying again by just fixing it
  };

  const finish = (extraXp = 0) => {
    const xp = stats.xp + extraXp + XP_FINISH;
    const accuracy = checkCount ? Math.round((stats.firstTry / checkCount) * 100) : 100;
    const r = completeLesson(user?.id, lesson.id, { xp, accuracy });
    setResult({ xp, accuracy, streak: r.streak, streakUp: r.streak > r.streakBefore, best: stats.best });
    sfx.complete();
    const burst = (x) => confetti({ particleCount: 90, spread: 70, startVelocity: 45, origin: { x, y: 0.7 }, disableForReducedMotion: true, colors: ['#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#34d399'] });
    burst(0.2);
    setTimeout(() => burst(0.8), 180);
  };

  const advance = (extraXp = 0) => {
    if (i + 1 >= steps.length) return finish(extraXp);
    if (extraXp) setStats((s) => ({ ...s, xp: s.xp + extraXp }));
    setI(i + 1);
    setStatus(null);
    setMessage('');
    setAttempts(0);
    setHintOpen(false);
    setGain(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const check = () => {
    if (!ready || status) return;
    if (step.kind !== 'check') return advance(XP_EXPLORE);
    const r = step.check(value);
    if (r === true) {
      const g = attempts === 0 ? XP_FIRST_TRY : XP_RETRY;
      setGain(g);
      setStatus('correct');
      setStats((s) => ({ xp: s.xp + g, firstTry: s.firstTry + (attempts === 0 ? 1 : 0), combo: s.combo + 1, best: Math.max(s.best, s.combo + 1) }));
      sfx.correct();
    } else {
      setMessage(r?.msg || 'עוד לא. נסה שוב!');
      setStatus('wrong');
      setAttempts((a) => a + 1);
      setStats((s) => ({ ...s, combo: 0 }));
      sfx.wrong();
    }
  };

  const reveal = () => {
    if (step.solve) setValues((vs) => vs.map((x, j) => (j === i ? step.solve(x) : x)));
    setGain(0);
    setStatus('revealed');
  };

  // Enter = the main action, Esc = exit (Brilliant-style keyboard flow)
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (result) return;
    if (e.key === 'Escape') { setExitOpen((o) => !o); return; }
    if (e.key !== 'Enter' || exitOpen) return;
    if (e.target.closest?.('button, a')) return;
    e.preventDefault();
    if (status === 'correct' || status === 'revealed') advance();
    else if (status === 'wrong') setStatus(null);
    else check();
  };
  useEffect(() => {
    const h = (e) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const toggleSound = () => { setSoundOn(muted); setMuted(!muted); };
  const exit = () => (i > 0 && !result ? setExitOpen(true) : navigate('/learn'));

  if (result) return <Finished lesson={lesson} course={course} result={result} user={user} />;

  const filled = (j) => j < i || (j === i && locked);

  return (
    <div className="min-h-screen flex flex-col">
      {/* top bar: exit · segmented progress · combo · sound */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={exit} aria-label="יציאה מהשיעור" className="w-9 h-9 rounded-xl grid place-items-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={i + (locked ? 1 : 0)}>
            {steps.map((_, j) => (
              <div key={j} className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-l ${course.gradient}`}
                  initial={false}
                  animate={{ width: filled(j) ? '100%' : j === i ? '18%' : '0%' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                />
              </div>
            ))}
          </div>
          <AnimatePresence>
            {stats.combo >= 3 && (
              <motion.div
                key={stats.combo}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                className="flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-400/40 text-orange-300 text-xs font-extrabold px-2 py-1"
                title="תשובות נכונות ברצף"
              >
                <Flame className="w-3.5 h-3.5 fill-orange-400" /> {stats.combo}
              </motion.div>
            )}
          </AnimatePresence>
          <button type="button" onClick={toggleSound} aria-label={muted ? 'הפעל צלילים' : 'השתק צלילים'} className="w-9 h-9 rounded-xl grid place-items-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-6 pb-48">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <div>
              <div className={`text-xs font-bold ${course.text} flex items-center gap-2`}>
                <span>{lesson.title}</span>
                <span className="text-muted-foreground font-medium">· שלב {i + 1} מתוך {steps.length}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display mt-1.5">{step.title}</h1>
            </div>

            <div className="math-prose text-[16px] sm:text-[17px] leading-relaxed text-foreground/90">
              <MathMarkdown>{step.text}</MathMarkdown>
            </div>

            <AnimatePresence>
              {hintOpen && step.hint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 flex gap-2.5">
                    <Lightbulb className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                    <div className="math-prose text-[15px] text-amber-50/90 [&_p]:mb-0"><MathMarkdown>{step.hint}</MathMarkdown></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {Widget && <Widget value={value} onChange={setValue} locked={locked} config={step.config} result={status} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* bottom action bar ↔ feedback sheet */}
      <AnimatePresence>
        {status ? (
          <FeedbackSheet
            key={`sheet-${i}-${status}-${attempts}`}
            status={status}
            message={message}
            explain={step.explain}
            xp={status === 'correct' ? gain : 0}
            canReveal={attempts >= 2 && !!step.solve}
            onContinue={() => advance()}
            onRetry={() => setStatus(null)}
            onReveal={reveal}
            tutor={<AskTutor lessonTitle={lesson.title} step={step} message={message} />}
          />
        ) : (
          <motion.div
            key="bar"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-0 inset-x-0 z-30 bg-background/85 backdrop-blur-xl border-t border-white/10"
          >
            <div className="max-w-2xl mx-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {step.kind === 'explore' && !ready && (
                <div className="text-center text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1.5">
                  <Hand className="w-3.5 h-3.5" /> נסה את זה בעצמך כדי להמשיך
                </div>
              )}
              <div className="flex gap-2.5">
                {step.hint && !hintOpen && step.kind === 'check' && (
                  <button type="button" onClick={() => setHintOpen(true)} className="btn-chunky chunky-ghost px-4 py-3.5 flex items-center gap-1.5 text-[15px]">
                    <Lightbulb className="w-4 h-4 text-amber-300" /> רמז
                  </button>
                )}
                <button type="button" onClick={check} disabled={!ready} className="btn-chunky chunky-primary flex-1 py-3.5 text-lg">
                  {step.kind === 'check' ? 'בדיקה' : 'המשך'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* exit confirmation */}
      <AnimatePresence>
        {exitOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={() => setExitOpen(false)}>
            <motion.div
              initial={{ scale: 0.92, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-title"
              className="card-base bg-popover p-6 w-full max-w-sm text-center"
            >
              <div className="text-4xl mb-2">🥺</div>
              <h2 id="exit-title" className="text-lg font-extrabold">לצאת באמצע?</h2>
              <p className="text-sm text-muted-foreground mt-1">ההתקדמות בשיעור הזה לא תישמר. עוד {steps.length - i} שלבים וסיימת!</p>
              <div className="mt-5 space-y-2.5">
                <button type="button" autoFocus onClick={() => setExitOpen(false)} className="btn-chunky chunky-primary w-full py-3">להמשיך ללמוד</button>
                <button type="button" onClick={() => navigate('/learn')} className="w-full py-2.5 text-sm font-semibold text-rose-300 hover:text-rose-200">יציאה מהשיעור</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

function Finished({ lesson, course, result, user }) {
  const xp = useCountUp(result.xp);
  const acc = useCountUp(result.accuracy);
  const next = lessonAfter(user, lesson.id);
  const cards = [
    { icon: Zap, label: 'XP', value: `+${xp}`, cls: 'text-amber-300 bg-amber-400/10 border-amber-400/30' },
    { icon: Target, label: 'דיוק', value: `${acc}%`, cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' },
    { icon: Flame, label: 'ימי רצף', value: result.streak, cls: 'text-orange-300 bg-orange-400/10 border-orange-400/30' },
  ];
  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="relative w-40 h-40 mx-auto">
          <div className="absolute inset-0 rounded-full animate-spin-slow opacity-50 blur-md" style={{ background: `conic-gradient(from 0deg, transparent, ${course.hex}, transparent 30%, ${course.hex}, transparent 60%, ${course.hex}, transparent 90%)` }} />
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className={`absolute inset-5 rounded-full bg-gradient-to-br ${course.gradient} grid place-items-center btn-chunky`}
            style={{ '--chunk': course.chunk }}
          >
            <Trophy className="w-14 h-14 text-white drop-shadow" />
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h1 className="text-3xl font-display">השיעור הושלם!</h1>
          <p className="text-muted-foreground mt-1">{lesson.title} · {result.accuracy >= 90 ? 'ביצוע מושלם 🌟' : result.accuracy >= 60 ? 'עבודה טובה 💪' : 'כל ניסיון מחזק את המוח 🧠'}</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-2.5">
          {cards.map((c, j) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35 + j * 0.1, type: 'spring', stiffness: 300, damping: 22 }}
              className={`rounded-2xl border p-3 ${c.cls}`}
            >
              <c.icon className="w-5 h-5 mx-auto" />
              <div dir="ltr" className="text-2xl font-extrabold tabular-nums mt-1">{c.value}</div>
              <div className="text-[11px] font-bold opacity-80">{c.label}</div>
            </motion.div>
          ))}
        </div>

        {result.streakUp && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.75 }} className="rounded-2xl bg-gradient-to-l from-orange-500/20 to-rose-500/20 border border-orange-400/30 px-4 py-3 font-bold text-orange-200">
            🔥 {result.streak === 1 ? 'התחלת רצף חדש! חזור מחר כדי להמשיך אותו' : `הרצף שלך עלה ל-${result.streak} ימים!`}
          </motion.div>
        )}
        {result.best >= 3 && (
          <div className="text-sm text-muted-foreground">הרצף הכי ארוך שלך בשיעור: <span className="font-bold text-foreground">{result.best} תשובות נכונות ברצף</span></div>
        )}

        <div className="space-y-2.5 pt-2">
          {next && (
            <Link to={`/learn/${next.id}`} className="btn-chunky chunky-primary w-full py-3.5 text-lg block">
              לשיעור הבא: {next.title}
            </Link>
          )}
          <Link to="/learn" className={`btn-chunky ${next ? 'chunky-ghost' : 'chunky-primary'} w-full py-3.5 block`}>
            חזרה למסלול
          </Link>
        </div>
      </div>
    </main>
  );
}
