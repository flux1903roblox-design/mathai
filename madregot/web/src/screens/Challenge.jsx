// A challenge task (אתגר, CURRICULUM-6.4), at /challenge/:id, outside the tab bar like a lesson. The top bar names the
// task and the part ("חלק 2 מתוך 4"); the story and its figure stay pinned above the parts on a tall screen, and fold
// into a "לסיפור" button on a phone under 700px tall. Its parts are solved in order, each with two tries, graded by code.
// The end uses the lesson-complete language, with the XP and מדי. Optional and never shaming: leaving keeps nothing.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { m } from 'motion/react';
import { X, ChevronDown, Zap, Target, Snowflake, Check } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/index.js';
import { MathText } from '@/components/MathText.jsx';
import Figure from '@/components/Figure.jsx';
import Mascot from '@/components/Mascot.jsx';
import Lottie from '@/components/Lottie.jsx';
import { Button } from '@/components/ui.jsx';
// the tasks with their parts: in this screen's own chunk, never in the first load (learn/challenges/all.ts)
import { taskById } from '@/learn/challenges/all.ts';
import { parseSkill } from '@/learn/skills.ts';
import { DUR, enter } from '@/lib/motion.js';
import NumPart from '@/components/challenge/NumPart.jsx';
import McPart from '@/components/challenge/McPart.jsx';
import ClaimPart from '@/components/challenge/ClaimPart.jsx';
import OrderPart from '@/components/challenge/OrderPart.jsx';
import ErrorPart from '@/components/challenge/ErrorPart.jsx';
import ExplainPart from '@/components/challenge/ExplainPart.jsx';

const PART = { num: NumPart, mc: McPart, claim: ClaimPart, order: OrderPart, error: ErrorPart, explain: ExplainPart };
export const DONE_LINE = 'אתגר הושלם. זה לא היה פשוט, והצלחתם.';

/** True while a media query matches (and follows it as the window changes). */
function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query); const f = () => setOn(mq.matches);
    mq.addEventListener?.('change', f); f();
    return () => mq.removeEventListener?.('change', f);
  }, [query]);
  return on;
}

function Story({ task, id }) {
  return (
    <div className="ch-story" id={id}>
      {task.story && <p className="ch-story-text"><MathText text={task.story} /></p>}
      {task.fig && <div className="ch-story-fig"><Figure fig={task.fig} /></div>}
    </div>
  );
}

/** The end: מדי, the line, the XP (the first finish only), what else the day got from it, and the way back. */
function ChallengeDone({ award, onExit }) {
  const pills = [
    award.goalReached && { icon: Target, tone: 'gold', label: 'הגעתם ליעד היומי' },
    award.freezeEarned && { icon: Snowflake, tone: 'brand', label: 'קיבלתם הקפאת רצף' },
    award.questsDone && !award.freezeEarned && { icon: Check, tone: 'good', label: 'סיימתם את המשימות של היום' },
  ].filter(Boolean);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="done-screen ch-done">
      <div className="done-hero">
        <Lottie name="confetti" className="done-confetti" decorative />
        <Mascot mood="achievement" size={120} className="done-madi" />
      </div>
      <m.div className="done-copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={enter(DUR.slow)}>
        <h1 className="done-title">{DONE_LINE}</h1>
        {award.xp > 0 && (
          <div className="stats ch-done-stats">
            <div className="stat stat-gold"><span className="stat-label">XP</span><span className="stat-value"><Zap size={20} aria-hidden="true" /><span>{`+${award.xp}`}</span></span></div>
          </div>
        )}
        {pills.length > 0 && <div className="badges">{pills.map((b) => <span key={b.label} className={`done-earned tone-${b.tone}`}><b.icon size={16} aria-hidden="true" />{b.label}</span>)}</div>}
      </m.div>
      <div className="done-actions" data-region="footer"><Button ref={ref} className="btn-block btn-lg" onClick={onExit}>המשך</Button></div>
    </div>
  );
}

export default function Challenge() {
  const { id } = useParams();
  const task = taskById(id || '');
  const navigate = useNavigate();
  const startChallenge = useApp((s) => s.startChallenge);
  const finishChallenge = useApp((s) => s.finishChallenge);
  const short = useMedia('(max-height: 699px)');
  const [i, setI] = useState(0);
  const [firsts, setFirsts] = useState([]); // the scored parts so far: right on the first try or not
  const [award, setAward] = useState(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const top = useRef(null);
  const main = useRef(null);
  useEffect(() => { if (task) startChallenge(task.id); }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // a new part starts at its top, with the focus on it (a screen reader hears "חלק 2 מתוך 4")
  useEffect(() => { top.current?.focus({ preventScroll: true }); main.current?.scrollTo?.({ top: 0 }); }, [i]);
  if (!task) return <Navigate to="/" replace />;

  const { topic, level } = parseSkill(task.after);
  const exit = () => navigate(TOPIC[topic] ? `/learn/${topic}/${level}` : '/', { replace: true });
  if (award) return <ChallengeDone award={award} onExit={exit} />;

  const part = task.parts[i];
  const P = PART[part.type];
  const last = i === task.parts.length - 1;
  const done = (first) => {
    const f = part.type === 'explain' ? firsts : [...firsts, !!first];
    if (!last) { setFirsts(f); setI(i + 1); return; }
    setAward(finishChallenge(task.id, { firstTry: f.filter(Boolean).length, parts: f.length }));
  };
  const hasStory = !!(task.story || task.fig);
  return (
    <div className={clsx('teach', 'ch-screen', TOPIC[topic] && `ch-${TOPIC[topic].color}`)}>
      <div className={clsx('ch-pin', short && 'short')}>
        <header className="ch-top" data-region="header">
          <button type="button" className="icon-btn ch-x" onClick={exit} aria-label="יציאה מהאתגר"><X size={24} aria-hidden="true" /></button>
          <div className="ch-head">
            <h1 className="ch-title"><MathText text={task.title} /></h1>
            <p className="ch-count" aria-live="polite">{`חלק ${i + 1} מתוך ${task.parts.length}`}</p>
          </div>
        </header>
        {hasStory && (short ? (
          <div className="ch-story-fold">
            <button type="button" className="ch-story-btn" aria-expanded={storyOpen} aria-controls="ch-story" onClick={() => setStoryOpen(!storyOpen)}>
              לסיפור<ChevronDown size={18} aria-hidden="true" className={clsx('ch-chev', storyOpen && 'open')} />
            </button>
            {storyOpen && <Story task={task} id="ch-story" />}
          </div>
        ) : <Story task={task} id="ch-story" />)}
      </div>
      <main className="ch-main" ref={main}>
        <section key={i} ref={top} tabIndex={-1} className="lm ch-part" aria-label={`חלק ${i + 1} מתוך ${task.parts.length}`} data-region="content">
          <P part={part} seed={`${task.id}:${i}`} onDone={done} last={last} />
        </section>
      </main>
    </div>
  );
}
