import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Zap, Snowflake, Check, BookOpen, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp, streakOf, today } from '@/lib/store.js';
import { questProgress } from '@/lib/quests.js';
import { topicsFor } from '@/content/index.js';
import { unitNodes, chestAfter } from '@/lib/path.js';
import { PARTS, JUMP_LEN, REVIEW_LEN, LESSON_LEN } from '@/lib/lesson.js';
import Mascot from '@/components/Mascot.jsx';
import PathNode from '@/components/PathNode.jsx';
import Board from '@/components/Board.jsx';
import ContinueCard from '@/components/ContinueCard.jsx';
import PathTrail from '@/components/map/PathTrail.jsx';
import { SCENERY, Emblem } from '@/components/map/Scenery.jsx';
import WorldBackdrop from '@/components/map/WorldBackdrop.jsx';
import Chest from '@/components/map/Chest.jsx';
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

/** The key of the last finished stop in a unit: the one a lesson just completed. */
function lastDoneKey(topic) {
  const { path, progress } = useApp.getState();
  const done = unitNodes(topic, path, progress).filter((x) => x.state === 'done');
  const last = done[done.length - 1];
  return last ? `${topic}:${last.kind}:${last.level}` : null;
}

/** Which stops get a piece of scenery beside them: those the path swings away from, on the far side. */
function sceneryAt(count, avoid = -1) {
  // Not beside the stop where מדי stands: he takes that side.
  const swung = Array.from({ length: count }, (_, i) => i).filter((i) => SWING[i % SWING.length] !== 0 && i !== avoid);
  return [swung[0], swung[2], swung[4]].filter((i) => i != null);
}

function Unit({ t, n, nodes, open, setOpen, onStart, currentRef, focusKey, fresh, mastered, celebrate, mascotMood }) {
  const done = nodes.filter((x) => x.kind === 'node' && x.state === 'done').length;
  const total = t.levels.length;
  const worldRef = useRef(null);
  const anchors = useRef([]);
  const [geo, setGeo] = useState(null);
  // The trail and the scenery follow the stops where they actually landed (an open card moves the ones below).
  useLayoutEffect(() => {
    const world = worldRef.current; if (!world) return undefined;
    const measure = () => {
      const w = world.getBoundingClientRect();
      const pts = nodes.map((_, i) => anchors.current[i]).filter(Boolean).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2 };
      });
      setGeo({ w: w.width, h: w.height, pts });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure); ro.observe(world);
    return () => ro.disconnect();
  }, [nodes.length, open]);
  const reached = Math.max(0, nodes.findIndex((x) => x.state !== 'done'));
  const allDone = nodes.every((x) => x.state === 'done');
  const props = SCENERY[t.id] || [];
  const half = chestAfter(t.id);
  return (
    <section className={clsx('unit', `ch-${t.color}`, `world-${t.id}`, mastered && 'is-mastered')} aria-labelledby={`unit-${t.id}`}>
      <header className="unit-head">
        <Emblem topic={t.id} />
        <div className="unit-head-text">
          <h2 id={`unit-${t.id}`} className="unit-title"><span className="unit-num" aria-hidden="true">{n}</span>{t.title}</h2>
          <p className="unit-desc">{t.desc}</p>
          <div className="unit-progress" aria-label={`${done} מתוך ${total} מדרגות הושלמו`}>
            <span className="unit-bar"><i style={{ width: `${(done / total) * 100}%` }} /></span>
            <bdi dir="ltr" className="unit-count">{done}/{total}</bdi>
          </div>
        </div>
        <Link to={`/topic/${t.id}`} className="unit-guide" aria-label={`תזכורת מהשיעור: ${t.title}`}><BookOpen size={22} aria-hidden="true" /><span>תזכורת</span></Link>
      </header>
      <div className="unit-world" ref={worldRef}>
        <WorldBackdrop topic={t.id} />
        {geo && <PathTrail points={geo.pts} reached={allDone ? nodes.length - 1 : reached} width={geo.w} height={geo.h} draw={fresh === t.id} />}
        {geo && sceneryAt(nodes.length, nodes.findIndex((x) => `${t.id}:${x.kind}:${x.level}` === focusKey)).map((i, k) => {
          const P = props[k]; const pt = geo.pts[i];
          if (!P || !pt) return null;
          const side = SWING[i % SWING.length] > 0 ? 'left' : 'right';
          return <div key={k} className={clsx('scenery', side)} style={{ top: pt.y }} aria-hidden="true"><P /></div>;
        })}
        <ol className="path">
          {nodes.map((node, i) => {
            const key = `${t.id}:${node.kind}:${node.level}`;
            const isOpen = open === key;
            const x = SWING[i % SWING.length];
            const label = `${node.kind === 'review' ? 'חזרה על היחידה' : `מדרגה ${node.level}: ${node.title}`}. ${node.state === 'done' ? (mastered ? 'נשלט' : 'הושלם') : node.state === 'current' ? (node.kind === 'node' ? `השלב הבא, ${node.parts} מתוך ${PARTS} שיעורים` : 'השלב הבא') : 'נעול'}`;
            return [
              <li key={key} className="path-step" style={{ '--x': `${x}px` }}>
                {node.state === 'current' && !isOpen && <span className="node-start" aria-hidden="true">{node.parts ? 'המשך' : 'התחלה'}</span>}
                <div className={clsx('node-anchor', node.state === 'current' && 'is-current')} ref={(el) => { anchors.current[i] = el; }}>
                  <PathNode
                    ref={key === focusKey ? currentRef : undefined}
                    state={node.state} kind={node.kind} parts={node.parts} of={PARTS} mastered={mastered}
                    fillLast={key === focusKey && fresh === t.id && node.parts > 0}
                    celebrate={celebrate === key}
                    label={label} expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)}
                  />
                </div>
                {key === focusKey && <Mascot mood={mascotMood} size={88} className={clsx('path-mascot', x > 0 ? 'left' : 'right')} />}
                {isOpen && <NodeCard n={node} t={t} onStart={onStart} />}
              </li>,
              // halfway along the unit, a treasure chest sits on the road
              node.kind === 'node' && node.level === half && (
                <li key={`${t.id}:chest`} className="path-step path-chest" style={{ '--x': `${(x + SWING[(i + 1) % SWING.length]) / 2}px` }}>
                  <Chest open={node.state === 'done'} celebrate={celebrate === key} expanded={open === `${t.id}:chest`}
                    label={`תיבת אוצר. ${node.state === 'done' ? 'פתוחה' : `נפתחת אחרי מדרגה ${half}`}`} onClick={() => setOpen(open === `${t.id}:chest` ? null : `${t.id}:chest`)} />
                  {open === `${t.id}:chest` && (
                    <div className="node-card" role="group" aria-label="תיבת אוצר">
                      <p className="node-card-title">{node.state === 'done' ? 'חצי היחידה מאחוריכם' : 'תיבת אוצר'}</p>
                      <p className="node-card-sub">{node.state === 'done' ? 'פתחתם את התיבה של היחידה הזאת. היא מחכה באוסף המדליות שלכם בפרופיל.' : `התיבה נפתחת כשמסיימים את מדרגה ${half}: ${nodes[half - 1].title}.`}</p>
                    </div>
                  )}
                </li>
              ),
            ];
          })}
        </ol>
      </div>
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
        <ul className="side-quests">{quests.map((q) => <li key={q.id} className={clsx(q.done && 'done')}><span>{q.done && <Check size={16} strokeWidth={3} aria-hidden="true" />}{q.title}</span><span className="card-num">{q.have}/{q.target}</span></li>)}</ul>
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
  const firstView = useRef(true);
  const topics = topicsFor(view);
  const streak = streakOf(days);
  const todayXp = days[today()]?.xp || 0;
  // "Where I am": the next node in the unit practised last (or just now), else in the first unit.
  const focusTopic = [state?.from, lastTopic].find((id) => id && topics.some((t) => t.id === id)) || topics[0]?.id;
  const focusNode = focusTopic && unitNodes(focusTopic, path, progress).find((x) => x.state === 'current');
  const focusKey = focusNode ? `${focusTopic}:${focusNode.kind}:${focusNode.level}` : null;

  useEffect(() => { settleStreak(); }, [settleStreak]);
  // The screen opens at the top (continue card, then the map); after the placement test it opens on the board;
  // back from a lesson, or on another grade, it opens on the place to continue from.
  useLayoutEffect(() => {
    const first = firstView.current; firstView.current = false;
    if (first && state?.placed) { document.getElementById('board-title')?.scrollIntoView({ block: 'start' }); return; }
    if (first && !state?.from) { window.scrollTo(0, 0); return; }
    currentRef.current?.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useEffect(() => {
    const el = currentRef.current; if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setAway(e.isIntersecting ? null : e.boundingClientRect.top < 0 ? 'up' : 'down'), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [view, path]);

  const onStart = (to) => navigate(to);
  const onBoard = () => document.getElementById('board-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const onJump = (id) => document.getElementById(`unit-${id}`)?.closest('.unit')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
        <ContinueCard grade={view} next={focusNode} onStart={onStart} onBoard={onBoard} />
        <h2 className="map-title">מפת השיעורים</h2>
        {topics.map((t, i) => (
          <Unit key={t.id} t={t} n={i + 1} nodes={unitNodes(t.id, path, progress)} open={open} setOpen={setOpen} onStart={onStart} currentRef={currentRef} focusKey={focusKey} fresh={state?.from}
            mastered={(path[t.id]?.reviews || 0) > 0} celebrate={state?.from === t.id && state?.nodeDone ? lastDoneKey(t.id) : null}
            mascotMood={state?.nodeDone ? 'excited' : state?.from ? 'happy' : 'idle'} />
        ))}
        <p className="path-end">עוד יחידות יגיעו לפי תכנית הלימודים של השנה.</p>
        {/* the board: the level in each topic and what is not clear yet, under the map */}
        <Board grade={view} placed={!!state?.placed} onStart={onStart} onJump={onJump} />
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
