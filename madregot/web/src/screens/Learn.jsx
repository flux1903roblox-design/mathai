import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Zap, Check, BookOpen, ChevronDown, ChevronLeft, ArrowUp, ArrowDown, School } from 'lucide-react';
import { useApp, streakOf, today } from '@/lib/store.js';
import { questProgress } from '@/lib/quests.js';
import { topicsFor } from '@/content/index.js';
import { unitNodes, chestAfter, chestOpen, stairProgress, unitProgress, unitCountText } from '@/lib/path.js';
import { PARTS, JUMP_LEN, REVIEW_LEN } from '@/lib/lesson.js';
import { MASTERY_N } from '@/learn/mastery.ts';
import PathNode from '@/components/PathNode.jsx';
import StorageBanner from '@/components/durable/StorageBanner.jsx';
import InstallSheet, { InstallCard } from '@/components/durable/InstallSheet.jsx';
import { showLearnCard } from '@/lib/durable/install.js';
import Chest from '@/components/map/Chest.jsx';
import { Button } from '@/components/ui.jsx';
import { nextStage } from '@/learn/mastery.ts';
import { routeOf, STAGE_NAME, STAGE_N } from '@/learn/recommend.ts';
import { skillId } from '@/learn/skills.ts';
import { urgentWork, urgentText } from '@/lib/classWork.js';

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
  return <StairCard n={n} t={t} onStart={onStart} />;
}

/**
 * A stair's card on the path (Duolingo's node popover): its name, the stage that comes next, and one START that opens
 * it. A stair is done only after its mastery check; one passed over (placement, a jump test) or kept from before
 * mastery checks existed offers its check.
 */
function StairCard({ n, t, onStart }) {
  const skill = skillId(t.id, n.level);
  const rec = useApp((s) => s.learn.skills[skill]);
  const st = nextStage(rec);
  const stageTo = st === 'D' ? `/lesson/${t.id}/${n.level}?part=${Math.min(n.parts + 1, PARTS)}` : st === 'E' ? routeOf.check(skill, 'mastery') : `/learn/${t.id}/${n.level}/${st}`;
  const check = routeOf.check(skill, 'mastery');
  const mastered = n.state === 'done' && !!rec?.mastered;
  return (
    <div className="node-card" role="group" aria-label={n.title}>
      <p className="node-card-title">{n.title}</p>
      {n.state === 'current' && <p className="node-card-sub">שלב {STAGE_N[st]} מתוך 5: {STAGE_NAME[st]}</p>}
      {n.state === 'current' && <Button className="btn-block node-start-btn" onClick={() => onStart(stageTo)}>{rec?.taught?.A || n.parts ? 'המשך' : 'התחלה'}</Button>}
      {n.state === 'current' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>כל חמשת השלבים</Button>}
      {mastered && <p className="node-card-sub">שולטים בזה: עברתם את בדיקת השליטה.</p>}
      {n.state === 'done' && !mastered && <p className="node-card-sub">המדרגה הושלמה לפני שהיו בדיקות שליטה. בדיקה קצרה, {MASTERY_N} שאלות, תראה שזה נשאר.</p>}
      {n.state === 'open' && <p className="node-card-sub">המדרגה הזאת פתוחה. בדיקת שליטה קצרה, {MASTERY_N} שאלות, תסמן אותה כמדרגה שעברתם.</p>}
      {n.state === 'locked' && <p className="node-card-sub">יודעים כבר? מבחן קצר של {JUMP_LEN} תרגילים, טעות אחת מותרת, פותח את כל הדרך עד לכאן.</p>}
      {(n.state === 'open' || (n.state === 'done' && !mastered)) && <Button className="btn-block" onClick={() => onStart(check)}>לבדיקת שליטה</Button>}
      {n.state === 'open' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>לשיעור</Button>}
      {mastered && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>לשיעור</Button>}
      {n.state === 'done' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/lesson/${t.id}/${n.level}?part=${PARTS}`)}>תרגול חוזר</Button>}
      {n.state === 'locked' && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${n.level}?kind=jump`)}>מבחן קפיצה</Button>}
    </div>
  );
}

/** The key of the last finished stop in a unit: the one a lesson just completed. */
function lastDoneKey(topic) {
  const { path } = useApp.getState();
  const done = unitNodes(topic, path).filter((x) => x.state === 'done');
  const last = done[done.length - 1];
  return last ? `${topic}:${last.kind}:${last.level}` : null;
}

function Unit({ t, n, nodes, open, setOpen, onStart, currentRef, focusKey, fresh, mastered, celebrate }) {
  const skills = useApp((s) => s.learn.skills);
  const path = useApp((s) => s.path);
  // the unit's counters move from the first stage: stairs done (mastered) once there is one, before that stages done,
  // and a thin bar of all its stages under the name
  const prog = unitProgress(t.id, path, skills);
  const half = chestAfter(t.id);
  // the chest opens as the store awards it: once every stair up to it is done (not a stair done out of order)
  const chest = chestOpen(t.id, path);
  return (
    <section className={clsx('unit', `ch-${t.color}`, `world-${t.id}`, mastered && 'is-mastered')} aria-labelledby={`unit-${t.id}`}>
      {/* the unit's banner, as on Duolingo's path: which unit, its name, and the guidebook; it stays on top while its path scrolls */}
      <header className="unit-head" data-region="banner">
        <div className="unit-head-text">
          <h2 id={`unit-${t.id}`} className="unit-title">{t.title}</h2>
          <p className="unit-label">יחידה {n} · {unitCountText(prog)}</p>
          <div className="unit-bar" role="progressbar" aria-label={`${t.title}: שלבים שהושלמו`} aria-valuemin={0} aria-valuemax={prog.of} aria-valuenow={prog.stages} aria-valuetext={`${prog.stages} מתוך ${prog.of} שלבים`}><i style={{ width: `${(prog.stages / prog.of) * 100}%` }} /></div>
        </div>
        <Link to={`/topic/${t.id}`} className="unit-guide" aria-label={`תזכורת מהשיעור: ${t.title}`}><BookOpen size={22} aria-hidden="true" /><span>תזכורת</span></Link>
      </header>
      <div className="unit-world">
        <ol className="path" data-region="path">
          {nodes.map((node, i) => {
            const key = `${t.id}:${node.kind}:${node.level}`;
            const isOpen = open === key;
            const x = SWING[i % SWING.length];
            const rec = node.kind === 'node' ? skills[skillId(t.id, node.level)] : null;
            const pct = node.kind === 'node' ? stairProgress(rec, node.parts) : 0;
            const label = `${node.kind === 'review' ? 'חזרה על היחידה' : `מדרגה ${node.level}: ${node.title}`}. ${node.state === 'done' ? (mastered ? 'נשלט' : 'הושלם') : node.state === 'open' ? 'פתוחה, בדיקת השליטה מחכה' : node.state === 'current' ? (node.kind === 'node' ? `השלב הבא, ${Math.round(pct * 5)} מתוך 5 שלבים` : 'השלב הבא') : 'נעול'}`;
            return [
              <li key={key} className="path-step" style={{ '--x': `${x}px` }}>
                {node.state === 'current' && !isOpen && <span className="node-start" aria-hidden="true">{pct > 0 ? 'המשך' : 'התחלה'}</span>}
                <div className={clsx('node-anchor', node.state === 'current' && 'is-current')}>
                  <PathNode
                    ref={key === focusKey ? currentRef : undefined}
                    state={node.state} kind={node.kind} parts={node.parts} of={PARTS} pct={pct} mastered={mastered}
                    fillLast={key === focusKey && fresh === t.id && node.parts > 0}
                    celebrate={celebrate === key}
                    label={label} expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)}
                  />
                </div>
                {isOpen && <NodeCard n={node} t={t} onStart={onStart} />}
              </li>,
              // halfway along the unit, a treasure chest sits on the road
              node.kind === 'node' && node.level === half && (
                <li key={`${t.id}:chest`} className="path-step path-chest" style={{ '--x': `${(x + SWING[(i + 1) % SWING.length]) / 2}px` }}>
                  <Chest open={chest} celebrate={chest && celebrate === key} expanded={open === `${t.id}:chest`}
                    label={`תיבת אוצר. ${chest ? 'פתוחה' : `נפתחת אחרי מדרגה ${half}`}`} onClick={() => setOpen(open === `${t.id}:chest` ? null : `${t.id}:chest`)} />
                  {open === `${t.id}:chest` && (
                    <div className="node-card" role="group" aria-label="תיבת אוצר">
                      <p className="node-card-title">{chest ? 'חצי היחידה מאחוריכם' : 'תיבת אוצר'}</p>
                      <p className="node-card-sub">{chest ? 'פתחתם את התיבה של היחידה הזאת. היא מחכה באוסף המדליות שלכם בפרופיל.' : `התיבה נפתחת כשמסיימים את כל המדרגות עד מדרגה ${half}: ${nodes[half - 1].title}.`}</p>
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
        <span><b>{streak === 1 ? 'יום אחד ברצף' : `${streak} ימים ברצף`}</b><span className="muted">{freezes > 0 ? `${freezes === 1 ? 'הקפאה אחת מוכנה' : `${freezes} הקפאות מוכנות`}` : 'שיעור או שלב ביום שומרים על הרצף'}</span></span>
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
  const { profile, path, days, xp, goalXp, freezes, settleStreak, lastTopic } = useApp();
  const [view, setView] = useState(profile.grade || '7');
  const [open, setOpen] = useState(null);
  const [away, setAway] = useState(null); // 'up' | 'down' when the current node is off screen
  const [install, setInstall] = useState(false);
  const installHintAt = useApp((s) => s.durable?.installHintAt);
  const currentRef = useRef(null);
  const firstView = useRef(true);
  const topics = topicsFor(view);
  const streak = streakOf(days);
  const todayXp = days[today()]?.xp || 0;
  // "Where I am": the next node in the unit practised last (or just now), else in the first unit.
  const focusTopic = [state?.from, lastTopic].find((id) => id && topics.some((t) => t.id === id)) || topics[0]?.id;
  const focusNode = focusTopic && unitNodes(focusTopic, path).find((x) => x.state === 'current');
  const focusKey = focusNode ? `${focusTopic}:${focusNode.kind}:${focusNode.level}` : null;

  useEffect(() => { settleStreak(); }, [settleStreak]);
  // The screen opens at the top of the path; back from a lesson, or on another grade, it opens on the place to continue from.
  useLayoutEffect(() => {
    const first = firstView.current; firstView.current = false;
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
  const otherGrade = view === '7' ? '8' : '7';
  // the teacher's most urgent work, due within 3 days (only in a class): a chip to the missions tab
  const classWork = useApp((s) => s.classWork);
  const workOutbox = useApp((s) => s.workOutbox);
  const urgent = profile.token ? urgentWork(classWork, workOutbox) : null;

  return (
    <div className="learn">
      <header className="learn-top" data-region="header">
        <button type="button" className="grade-switch" onClick={() => { setView(otherGrade); setOpen(null); }} aria-label={`מציגים את כיתה ${view === '7' ? 'ז׳' : 'ח׳'}. מעבר לכיתה ${otherGrade === '7' ? 'ז׳' : 'ח׳'}`}>
          כיתה {view === '7' ? 'ז׳' : 'ח׳'}<ChevronDown size={18} aria-hidden="true" />
        </button>
        <Link to="/quests" className={clsx('top-stat streak', streak > 0 && 'on')} aria-label={`רצף של ${streak} ימים`}><Flame size={24} aria-hidden="true" />{streak}</Link>
        <Link to="/quests" className="top-stat xp" aria-label={`היום ${todayXp} מתוך ${goalXp} XP, סך הכול ${xp}`}><Zap size={22} aria-hidden="true" /><bdi dir="ltr">{todayXp}<span className="top-stat-of">/{goalXp}</span></bdi></Link>
      </header>
      {urgent && (
        <Link to="/quests" className="learn-work-chip">
          <School size={18} aria-hidden="true" /><span className="learn-work-text">{urgentText(urgent)}</span><ChevronLeft size={18} aria-hidden="true" />
        </Link>
      )}
      <StorageBanner />
      {/* on an iPhone in the browser, from the 3rd day: the Home Screen guide, offered once (lib/durable/install.js) */}
      {showLearnCard({ profile, days, xp, durable: { installHintAt } }) && <InstallCard onOpen={() => setInstall(true)} />}
      <InstallSheet open={install} onOpenChange={setInstall} />

      <div className="learn-layout">
      <div className="learn-body">
        {/* the home screen is the path, as on Duolingo: units under their sticky banners, the current stop marked */}
        {topics.map((t, i) => (
          <Unit key={t.id} t={t} n={i + 1} nodes={unitNodes(t.id, path)} open={open} setOpen={setOpen} onStart={onStart} currentRef={currentRef} focusKey={focusKey} fresh={state?.from}
            mastered={(path[t.id]?.reviews || 0) > 0} celebrate={state?.from === t.id && state?.nodeDone ? lastDoneKey(t.id) : null} />
        ))}
        <p className="path-end">עוד יחידות יגיעו לפי תכנית הלימודים של השנה. <Link to="/topics">כל הנושאים והמצב בכל אחד</Link></p>
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
