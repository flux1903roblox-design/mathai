import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Zap, Snowflake, Star, Check, Lock, Trophy, BookOpen, ChevronDown, ArrowUp, ArrowDown, Route } from 'lucide-react';
import { useApp, streakOf, today } from '@/lib/store.js';
import { questProgress } from '@/lib/quests.js';
import { topicsFor, TOPIC } from '@/content/index.js';
import { unitNodes } from '@/lib/path.js';
import { PARTS, JUMP_LEN, REVIEW_LEN, LESSON_LEN } from '@/lib/lesson.js';
import { usePlan } from '@/lib/usePlan.js';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';

// The path winds gently: each node sits a little to one side of the one before.
const SWING = [0, 52, 78, 52, 0, -52, -78, -52];

function NodeCard({ n, t, onStart }) {
  const top = t.levels.length;
  if (n.kind === 'review') {
    return (
      <div className="node-card" role="group" aria-label={n.title}>
        <p className="node-card-title">חזרה על כל היחידה</p>
        <p className="node-card-sub">{n.state === 'locked' ? 'נפתחת אחרי שמסיימים את כל המדרגות ביחידה.' : `${REVIEW_LEN} תרגילים מכל המדרגות, מעורבבים.`}</p>
        {n.state !== 'locked' && <Button className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${top}?kind=review`)}>{n.state === 'done' ? 'עוד חזרה' : 'התחלה'}</Button>}
      </div>
    );
  }
  return (
    <div className="node-card" role="group" aria-label={n.title}>
      <p className="node-card-title">{n.title}</p>
      {n.state === 'current' && <p className="node-card-sub">שיעור {Math.min(n.parts + 1, PARTS)} מתוך {PARTS}, {LESSON_LEN} תרגילים</p>}
      {n.state === 'done' && <p className="node-card-sub">הושלם. אפשר לחזור ולתרגל.</p>}
      {n.state === 'locked' && <p className="node-card-sub">יודעים כבר? מבחן קצר של {JUMP_LEN} תרגילים, טעות אחת מותרת, פותח את כל הדרך עד לכאן.</p>}
      {n.state === 'current' && <Button className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${n.level}?part=${Math.min(n.parts + 1, PARTS)}`)}>{n.parts ? 'המשך' : 'התחלה'}</Button>}
      {n.state === 'done' && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${n.level}?part=${PARTS}`)}>תרגול חוזר</Button>}
      {n.state === 'locked' && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${n.level}?kind=jump`)}>מבחן קפיצה</Button>}
    </div>
  );
}

function Unit({ t, n, nodes, open, setOpen, onStart, currentRef, focusKey }) {
  const done = nodes.filter((x) => x.kind === 'node' && x.state === 'done').length;
  const total = t.levels.length;
  return (
    <section className={clsx('unit', `ch-${t.color}`)} aria-labelledby={`unit-${t.id}`}>
      <header className="unit-head">
        <div className="unit-head-text">
          <h2 id={`unit-${t.id}`} className="unit-title"><span className="unit-num" aria-hidden="true">{n}</span>{t.title}</h2>
          <p className="unit-desc">{t.desc}</p>
        </div>
        <span className="unit-count" aria-label={`${done} מתוך ${total} מדרגות הושלמו`}><bdi dir="ltr">{done}/{total}</bdi></span>
        <Link to={`/topic/${t.id}`} className="unit-guide" aria-label={`תזכורת מהשיעור: ${t.title}`}><BookOpen size={22} aria-hidden="true" /><span>תזכורת</span></Link>
      </header>
      <ol className="path">
        {nodes.map((node, i) => {
          const key = `${t.id}:${node.kind}:${node.level}`;
          const isOpen = open === key;
          const x = SWING[i % SWING.length];
          const Icon = node.kind === 'review' ? Trophy : node.state === 'done' ? Check : node.state === 'locked' ? Lock : Star;
          const label = `${node.kind === 'review' ? 'חזרה על היחידה' : `מדרגה ${node.level}: ${node.title}`}. ${node.state === 'done' ? 'הושלם' : node.state === 'current' ? 'השלב הבא' : 'נעול'}`;
          return (
            <li key={key} className="path-step" style={{ '--x': `${x}px` }}>
              {node.state === 'current' && !isOpen && <span className="node-start" aria-hidden="true">{node.parts ? 'המשך' : 'התחלה'}</span>}
              <button
                type="button" ref={key === focusKey ? currentRef : undefined}
                className={clsx('node', `node-${node.state}`, node.kind === 'review' && 'node-review')}
                style={node.state === 'current' && node.kind === 'node' ? { '--ring': `${(node.parts / PARTS) * 360}deg` } : undefined}
                aria-expanded={isOpen} aria-label={label}
                onClick={() => setOpen(isOpen ? null : key)}
              >
                <Icon size={node.kind === 'review' ? 34 : 30} strokeWidth={2.6} aria-hidden="true" />
              </button>
              {key === focusKey && <Mascot mood="happy" size={86} className={clsx('path-mascot', x > 0 ? 'left' : 'right')} />}
              {isOpen && <NodeCard n={node} t={t} onStart={onStart} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Wide screens: the streak, the goal and today's quests sit beside the path. */
function SidePanel({ streak, todayXp, goalXp, freezes, days }) {
  const quests = questProgress(today(), days[today()] || {});
  return (
    <aside className="learn-side" aria-label="היום שלי">
      <Link to="/quests" className="side-card side-streak">
        <Flame size={34} aria-hidden="true" className={clsx(streak > 0 && 'on')} />
        <span><b>{streak === 1 ? 'יום אחד ברצף' : `${streak} ימים ברצף`}</b><span className="muted">{freezes > 0 ? `${freezes === 1 ? 'הקפאה אחת מוכנה' : `${freezes} הקפאות מוכנות`}` : 'שיעור ביום שומר על הרצף'}</span></span>
      </Link>
      <div className="side-card">
        <div className="card-row"><b>היעד היומי</b><span className="card-num">{Math.min(todayXp, goalXp)}/{goalXp} XP</span></div>
        <div className="bar" role="progressbar" aria-label="ההתקדמות ליעד היומי" aria-valuemin={0} aria-valuemax={goalXp} aria-valuenow={Math.min(todayXp, goalXp)}><i style={{ width: `${Math.min(1, todayXp / goalXp) * 100}%` }} /></div>
      </div>
      <Link to="/quests" className="side-card">
        <div className="card-row"><b>המשימות של היום</b><span className="card-num">{quests.filter((q) => q.done).length}/3</span></div>
        <ul className="side-quests">{quests.map((q) => <li key={q.id} className={clsx(q.done && 'done')}><span>{q.title}</span><span className="card-num">{q.have}/{q.target}</span></li>)}</ul>
      </Link>
    </aside>
  );
}

export default function Learn() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile, path, progress, days, xp, goalXp, freezes, settleStreak, lastTopic } = useApp();
  const [view, setView] = useState(profile.grade || '7');
  const [open, setOpen] = useState(null);
  const [away, setAway] = useState(null); // 'up' | 'down' when the current node is off screen
  const currentRef = useRef(null);
  const plan = usePlan();
  const nextStep = plan.weak.length ? plan.steps.find((x) => !x.done && x.kind === 'practice') : null;
  const topics = topicsFor(view);
  const streak = streakOf(days);
  const todayXp = days[today()]?.xp || 0;
  // "Where I am": the next node in the unit practised last (or just now), else in the first unit.
  const focusTopic = [state?.from, lastTopic].find((id) => id && topics.some((t) => t.id === id)) || topics[0]?.id;
  const focusNode = focusTopic && unitNodes(focusTopic, path, progress).find((x) => x.state === 'current');
  const focusKey = focusNode ? `${focusTopic}:${focusNode.kind}:${focusNode.level}` : null;

  useEffect(() => { settleStreak(); }, [settleStreak]);
  // Open on the place to continue from (or the unit just practised).
  useLayoutEffect(() => {
    const el = currentRef.current;
    if (el) el.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useEffect(() => {
    const el = currentRef.current; if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setAway(e.isIntersecting ? null : e.boundingClientRect.top < 0 ? 'up' : 'down'), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [view, path]);

  const onStart = (to) => navigate(to);
  const otherGrade = view === '7' ? '8' : '7';

  return (
    <div className="learn">
      <header className="learn-top">
        <button type="button" className="grade-switch" onClick={() => { setView(otherGrade); setOpen(null); }} aria-label={`מציגים את כיתה ${view === '7' ? 'ז׳' : 'ח׳'}. מעבר לכיתה ${otherGrade === '7' ? 'ז׳' : 'ח׳'}`}>
          כיתה {view === '7' ? 'ז׳' : 'ח׳'}<ChevronDown size={18} aria-hidden="true" />
        </button>
        <Link to="/quests" className={clsx('top-stat streak', streak > 0 && 'on')} aria-label={`רצף של ${streak} ימים`}><Flame size={24} aria-hidden="true" />{streak}</Link>
        {freezes > 0 && <Link to="/quests" className="top-stat freeze" aria-label={`${freezes} הקפאות רצף`}><Snowflake size={22} aria-hidden="true" />{freezes}</Link>}
        <Link to="/quests" className="top-stat xp" aria-label={`היום ${todayXp} מתוך ${goalXp} XP, סך הכול ${xp}`}><Zap size={22} aria-hidden="true" /><bdi dir="ltr">{todayXp}<span className="top-stat-of">/{goalXp}</span></bdi></Link>
      </header>

      <div className="learn-layout">
      <div className="learn-body">
        {nextStep && TOPIC[nextStep.topic] && (
          <Link to={`/lesson/${nextStep.topic}/${nextStep.level}?part=2&from=plan`} className="plan-banner">
            <Route size={24} aria-hidden="true" />
            <span className="plan-banner-text"><b>הצעד הבא בתוכנית: <span className="hl">{nextStep.levelTitle}</span></b><span>{TOPIC[nextStep.topic].title}, {nextStep.have} מתוך {nextStep.need} תשובות נכונות</span></span>
          </Link>
        )}
        {topics.map((t, i) => (
          <Unit key={t.id} t={t} n={i + 1} nodes={unitNodes(t.id, path, progress)} open={open} setOpen={setOpen} onStart={onStart} currentRef={currentRef} focusKey={focusKey} />
        ))}
        <p className="path-end">עוד יחידות יגיעו לפי תכנית הלימודים של השנה.</p>
      </div>
      <SidePanel streak={streak} todayXp={todayXp} goalXp={goalXp} freezes={freezes} days={days} />
      </div>

      {away && (
        <button type="button" className="jump-current" onClick={() => currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })} aria-label="חזרה לשלב הבא">
          {away === 'up' ? <ArrowUp size={26} aria-hidden="true" /> : <ArrowDown size={26} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
