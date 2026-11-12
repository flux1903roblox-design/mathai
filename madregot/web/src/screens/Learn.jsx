import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Zap, Check, BookOpen, ChevronDown, ChevronLeft, ArrowUp, ArrowDown, School } from 'lucide-react';
import { useApp, streakOf, today } from '@/lib/store.js';
import { questProgress } from '@/lib/quests.js';
import { topicsFor } from '@/content/index.js';
import { unitNodes, chestAfter, chestOpen, stairProgress, unitProgress, unitCountText, addedStairNote } from '@/lib/path.js';
import { PARTS, JUMP_LEN, REVIEW_LEN } from '@/lib/lessonRules.js';
import { MASTERY_N } from '@/learn/mastery.ts';
import PathNode from '@/components/PathNode.jsx';
import StorageBanner from '@/components/durable/StorageBanner.jsx';
import OfflineChip from '@/components/durable/OfflineChip.jsx';
import InstallSheet, { InstallCard } from '@/components/durable/InstallSheet.jsx';
import { showLearnCard } from '@/lib/durable/install.js';
import { showBackupLine } from '@/lib/durable/vault.js';
import Chest from '@/components/map/Chest.jsx';
import { Emblem, SCENERY } from '@/components/map/Scenery.jsx';
import { Button } from '@/components/ui.jsx';
import RepairCard, { useRepair } from '@/components/learn/RepairCard.jsx';
import { routeOf, stairStage, STAGE_NAME, STAGE_N } from '@/learn/recommend.ts';
import { todayRoute, missionFor } from '@/learn/mission.ts';
import { skillId } from '@/learn/skills.ts';
import { mapTopics, mapFocus, onMap, nodeRoute } from '@/learn/next.ts';
import { useNext } from '@/lib/useLearn.js';
import { ensureTopics } from '@/learn/content/index.ts';
import NextBanner from '@/components/learn/NextBanner.jsx';
import { MathText } from '@/components/MathText.jsx';
import { urgentWork, urgentText } from '@/lib/classWork.js';
import { chestItem } from '@/lib/wardrobe.js';
import ClassGoalCard, { ClassGoalMoment } from '@/components/learn/ClassGoalCard.jsx';

import { t as tr } from '@/lib/i18n.js';
// the picture of what a unit's chest holds loads with the first chest card opened (Madi's accessories are not in the boot bundle)
const ItemArt = lazy(() => import('@/components/mascot/Accessories.jsx').then((m) => ({ default: m.ItemArt })));
// the one-time line about the backup that is on by default (COUNCIL2-24): loaded only while it is due
const BackupLine = lazy(() => import('@/components/durable/BackupLine.jsx'));

// The path winds gently: each node sits a little to one side of the one before.
const SWING = [0, 52, 78, 52, 0, -52, -78, -52];
// After these stops, a small drawing from the unit's own topic (its second and third pieces) sits beside the path.
const ART_AFTER = { 1: 1, 3: 2 };
// how far from the middle the drawing sits: as far out as the widest swing, so it never meets a stop or its bubble
const ART_X = SWING[2];

/** A calm drawing from the unit's topic, opposite the swing of the stop above it: no text, no focus, no motion. */
function PathArt({ topic, piece, x }) {
  const Art = SCENERY[topic]?.[piece];
  if (!Art) return null;
  return <li className="path-art" aria-hidden="true" style={{ '--x': `${x > 0 ? -ART_X : ART_X}px` }}><Art /></li>;
}

function NodeCard({ n, t, onStart, next }) {
  const top = t.levels.length;
  if (n.kind === 'review') {
    return (
      <div className="node-card" role="group" aria-label={n.title}>
        <p className="node-card-title">{tr('shell.learn.1')}</p>
        <p className="node-card-sub">{n.state === 'locked' ? tr('shell.learn.2') : tr('shell.learn.3', { REVIEW_LEN })}</p>
        {n.state !== 'locked' && <Button className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${top}?kind=review`)}>{n.state === 'done' ? tr('shell.learn.4') : tr('shell.learn.5')}</Button>}
      </div>
    );
  }
  return <StairCard n={n} t={t} onStart={onStart} next={next} />;
}

/**
 * A stair's card on the path (Duolingo's node popover): its name, the stage that comes next, and one START that opens
 * it. A stair is done only after its mastery check; one passed over (placement, a jump test) or kept from before
 * mastery checks existed offers its check. Its main button is learn/next.ts nodeRoute, the same route the plan gives
 * this stair; when the plan's next step is this stair but a different activity (`next`), that step leads the card
 * and the card's own buttons step back.
 */
function StairCard({ n, t, onStart, next }) {
  const skill = skillId(t.id, n.level);
  const rec = useApp((s) => s.learn.skills[skill]);
  const st = stairStage(skill, rec);
  const own = nodeRoute(n, rec);
  const lead = next && next.to !== own ? next : null;
  const main = lead ? 'secondary' : 'primary';
  const check = routeOf.check(skill, 'mastery');
  const mastered = n.state === 'done' && !!rec?.mastered;
  const path = useApp((s) => s.path);
  const added = addedStairNote(n, path);
  return (
    <div className="node-card" role="group" aria-label={n.title}>
      <p className="node-card-title">{n.title}</p>
      {added && <p className="node-card-sub node-card-added">{added}</p>}
      {lead && <p className="node-card-sub node-card-next">{tr('shell.learn.6')}<MathText text={lead.title} /></p>}
      {lead && <Button className="btn-block node-next-btn" onClick={() => onStart(lead.to)}>{tr('shell.learn.7')}</Button>}
      {n.state === 'current' && <p className="node-card-sub">{tr('shell.learn.8')}{STAGE_N[st]}{tr('shell.learn.9')}{STAGE_NAME[st]}</p>}
      {n.state === 'current' && <Button variant={main} className="btn-block node-start-btn" onClick={() => onStart(own)}>{rec?.taught?.A || n.parts ? tr('shell.learn.10') : tr('shell.learn.5')}</Button>}
      {n.state === 'current' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>{tr('shell.learn.11')}</Button>}
      {mastered && <p className="node-card-sub">{tr('shell.learn.12')}</p>}
      {n.state === 'done' && !mastered && <p className="node-card-sub">{tr('shell.learn.13')}{MASTERY_N}{tr('shell.learn.14')}</p>}
      {n.state === 'open' && <p className="node-card-sub">{tr('shell.learn.15')}{MASTERY_N}{tr('shell.learn.16')}</p>}
      {n.state === 'locked' && <p className="node-card-sub">{tr('shell.learn.17')}{JUMP_LEN}{tr('shell.learn.18')}</p>}
      {(n.state === 'open' || (n.state === 'done' && !mastered)) && <Button variant={main} className="btn-block" onClick={() => onStart(check)}>{tr('shell.learn.19')}</Button>}
      {n.state === 'open' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>{tr('shell.learn.20')}</Button>}
      {mastered && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>{tr('shell.learn.20')}</Button>}
      {n.state === 'done' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/lesson/${t.id}/${n.level}?part=${PARTS}`)}>{tr('shell.learn.21')}</Button>}
      {n.state === 'locked' && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${n.level}?kind=jump`)}>{tr('shell.learn.22')}</Button>}
    </div>
  );
}

/**
 * The chest's card: what it holds for Madi before it opens (no surprises, STUDENT-3), and after, a way to try it on.
 */
function ChestCard({ topic, open, half, onTry }) {
  const item = chestItem(topic);
  return (
    <div className="node-card" role="group" aria-label={tr('shell.learn.23')}>
      <p className="node-card-title">{open ? tr('shell.learn.24') : tr('shell.learn.23')}</p>
      <div className="chest-card-item">
        <Suspense fallback={<span className="chest-card-art" />}>{item ? <ItemArt id={item.id} className="chest-card-art" /> : <span className="chest-card-art" />}</Suspense>
        <p className="node-card-sub">{open ? tr('shell.learn.25', { name: item?.name }) : tr('shell.learn.26', { name: item?.name, half })}</p>
      </div>
      {open && item && <Button variant="secondary" className="btn-block" onClick={() => onTry(`/me/madi?try=${item.id}`)}>{tr('shell.learn.27')}</Button>}
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

function Unit({ t, n, nodes, open, setOpen, onStart, currentRef, focusKey, focusNext, fresh, mastered, celebrate }) {
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
      {/* the unit's banner, as on Duolingo's path: which unit, its name, and the guidebook; it stays on top while its path
          scrolls. The fractions floor is not one of the grade's units: it is named יסודות and has no number */}
      <header className="unit-head" data-region="banner">
        <Emblem topic={t.id} />
        <div className="unit-head-text">
          <h2 id={`unit-${t.id}`} className="unit-title">{t.title}</h2>
          <p className="unit-label">{t.bridge ? tr('shell.learn.28') : tr('shell.learn.29', { n })} · {unitCountText(prog)}</p>
          <div className="unit-bar" role="progressbar" aria-label={tr('shell.learn.30', { title: t.title })} aria-valuemin={0} aria-valuemax={prog.of} aria-valuenow={prog.stages} aria-valuetext={tr('shell.learn.31', { stages: prog.stages, of: prog.of })}><i style={{ width: `${(prog.stages / prog.of) * 100}%` }} /></div>
        </div>
        <Link to={`/topic/${t.id}`} className="unit-guide" aria-label={tr('shell.learn.32', { title: t.title })}><BookOpen size={22} aria-hidden="true" /><span>{tr('shell.learn.33')}</span></Link>
      </header>
      <div className="unit-world">
        <ol className="path" data-region="path">
          {nodes.map((node, i) => {
            const key = `${t.id}:${node.kind}:${node.level}`;
            const isOpen = open === key;
            // the plan's next step is this stair (and not the path's current one): it is marked as the next step
            const isNext = key === focusKey && !!focusNext && node.state !== 'current';
            const x = SWING[i % SWING.length];
            const rec = node.kind === 'node' ? skills[skillId(t.id, node.level)] : null;
            const pct = node.kind === 'node' ? stairProgress(rec, node.parts) : 0;
            const label = `${node.kind === 'review' ? tr('shell.learn.34') : tr('shell.learn.35', { level: node.level, title: node.title })}. ${node.state === 'done' ? (mastered ? tr('shell.learn.36') : tr('shell.learn.37')) : node.state === 'open' ? tr('shell.learn.38') : node.state === 'current' ? (node.kind === 'node' ? tr('shell.learn.39', { p0: Math.round(pct * 5) }) : tr('shell.learn.40')) : tr('shell.learn.41')}`;
            return [
              <li key={key} className="path-step" style={{ '--x': `${x}px` }}>
                {node.state === 'current' && !isOpen && <span className="node-start" aria-hidden="true">{pct > 0 ? tr('shell.learn.10') : tr('shell.learn.5')}</span>}
                {isNext && !isOpen && <span className="node-start node-next" aria-hidden="true">{tr('shell.learn.42')}</span>}
                <div className={clsx('node-anchor', node.state === 'current' && 'is-current')}>
                  <PathNode
                    ref={key === focusKey ? currentRef : undefined}
                    state={node.state} kind={node.kind} parts={node.parts} of={PARTS} pct={pct} mastered={mastered}
                    fillLast={key === focusKey && fresh === t.id && node.parts > 0}
                    celebrate={celebrate === key}
                    label={isNext ? tr('shell.learn.43', { label }) : label} expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)}
                  />
                </div>
                {isOpen && <NodeCard n={node} t={t} onStart={onStart} next={key === focusKey ? focusNext : null} />}
              </li>,
              // halfway along the unit, a treasure chest sits on the road
              node.kind === 'node' && node.level === half && (
                <li key={`${t.id}:chest`} className="path-step path-chest" style={{ '--x': `${(x + SWING[(i + 1) % SWING.length]) / 2}px` }}>
                  <Chest open={chest} celebrate={chest && celebrate === key} expanded={open === `${t.id}:chest`}
                    label={tr('shell.learn.46', { p0: chest ? tr('shell.learn.44') : tr('shell.learn.45', { half }) })} onClick={() => setOpen(open === `${t.id}:chest` ? null : `${t.id}:chest`)} />
                  {open === `${t.id}:chest` && <ChestCard topic={t.id} open={chest} half={half} onTry={onStart} />}
                </li>
              ),
              ART_AFTER[i] && <PathArt key={`${t.id}:art${i}`} topic={t.id} piece={ART_AFTER[i]} x={x} />,
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
    <aside className="learn-side" aria-label={tr('shell.learn.47')}>
      <Link to="/quests" className="side-card side-streak">
        <Flame size={34} aria-hidden="true" className={clsx(streak > 0 && 'on')} />
        <span><b>{streak === 1 ? tr('shell.learn.48') : tr('shell.learn.49', { streak })}</b><span className="muted">{freezes > 0 ? `${freezes === 1 ? tr('shell.learn.50') : tr('shell.learn.51', { freezes })}` : tr('shell.learn.52')}</span></span>
      </Link>
      <div className="side-card">
        <div className="card-row"><b>{tr('shell.learn.53')}</b><span className="card-num">{Math.min(todayXp, goalXp)}/{goalXp} XP</span></div>
        <div className="bar" role="progressbar" aria-label={tr('shell.learn.54')} aria-valuemin={0} aria-valuemax={goalXp} aria-valuenow={Math.min(todayXp, goalXp)}><i style={{ width: `${Math.min(1, todayXp / goalXp) * 100}%` }} /></div>
      </div>
      <Link to="/quests" className="side-card">
        <div className="card-row"><b>{tr('shell.learn.55')}</b><span className="card-num">{quests.filter((q) => q.done).length}/3</span></div>
        <ul className="side-quests">{quests.map((q) => <li key={q.id} className={clsx(q.done && 'done')}><span>{q.done && <Check size={16} strokeWidth={3} aria-hidden="true" />}{q.title}</span><span className="card-num">{q.have}/{q.target}</span></li>)}</ul>
      </Link>
      {/* the class goal of the week, small (STUDENT-4); nothing for a student with no class */}
      <ClassGoalCard compact />
    </aside>
  );
}

/**
 * The installed app's shortcut "השיעור של היום" (./#/?go=today, STUDENT-10) opens what TodayCard's button opens: the
 * mission's next part, or the missions tab when the day's mission is done. The mission is fixed for the day once
 * shown, as TodayCard fixes it. The address is replaced, so Back does not come here again.
 */
function GoToday() {
  const navigate = useNavigate();
  // today's mission from the one plan (learn/next.ts planNext), as TodayCard makes it
  const learn = useApp((s) => s.learn);
  const plan = useNext();
  const { items, fresh } = missionFor(learn, today(), plan.items);
  const went = useRef(false);
  useEffect(() => {
    if (went.current) return;
    went.current = true;
    const { saveMission, learnEvent } = useApp.getState();
    if (fresh && items.length) { saveMission(today(), items); learnEvent({ e: 'mission-start' }); }
    navigate(todayRoute(items), { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Load these topics (or skills) when the browser is idle; a topic already loaded costs nothing. */
function usePrefetchTopics(list) {
  const key = [...new Set(list.filter(Boolean).map((x) => String(x).split(':')[0]))].sort().join(',');
  useEffect(() => {
    if (!key) return undefined;
    const run = () => { ensureTopics(key.split(',')).catch(() => {}); };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 1500);
    return () => clearTimeout(id);
  }, [key]);
}

export default function Learn() {
  const { search } = useLocation();
  if (new URLSearchParams(search).get('go') === 'today') return <GoToday />;
  return <LearnMap />;
}

function LearnMap() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { profile, path, days, xp, goalXp, freezes, settleStreak, lastTopic } = useApp();
  // the grade on show: the student's own, or the one a link to a unit asks for (the wardrobe's "ליחידת …")
  const [view, setView] = useState(state?.grade || profile.grade || '7');
  const floorOn = useApp((s) => !!(s.learn.floor ?? null)?.on);
  const [open, setOpen] = useState(null);
  const [away, setAway] = useState(null); // 'up' | 'down' when the current node is off screen
  const [install, setInstall] = useState(false);
  const installHintAt = useApp((s) => s.durable?.installHintAt);
  const currentRef = useRef(null);
  const firstView = useRef(true);
  // the grade's own units, and above them the fractions floor while it is on (the floor check or the student put it there)
  const own = topicsFor(view);
  const topics = mapTopics(view, floorOn);
  const topicIds = topics.map((t) => t.id);
  const streak = streakOf(days);
  const todayXp = days[today()]?.xp || 0;
  // "Where I am" follows the one plan (learn/next.ts): back from a lesson, the unit just practised; on a fresh open, the
  // plan's next step when it is a stair of this map (that stair is the focused node); else the unit practised last, else
  // the grade's first unit (the floor above it is never where the map opens by default). A next step that is not a
  // stair of this map (an exam step, a repair, a review, points lost in an exam, the floor check) is the banner above.
  const { top } = useNext();
  const focus = mapFocus({ from: state?.from, top, lastTopic, topicIds, firstId: own[0]?.id, path });
  const focusKey = focus.key;
  const banner = top && !onMap(top, topicIds) ? top : null;
  // the next step's topic (its exercise generators and its teaching) loads while the map is open, when the browser is
  // idle, so the step opens without a wait (COUNCIL2-14); the focused unit's too, the stair a tap most likely opens
  usePrefetchTopics([top?.skill, focus.topic]);
  const repair = useRepair();
  const repairDismissed = useApp((s) => s.nudges?.repairDismissed);
  const repairOn = !!repair && repairDismissed !== today();

  useEffect(() => { settleStreak(); }, [settleStreak]);
  // The screen opens at the top of the path; back from a lesson, or on another grade, it opens on the place to continue from.
  // On a fresh open the screen opens at the top, unless the plan's next stair is out of view: then it opens on it. While
  // the backup's one-time line is due (COUNCIL2-24), it opens at the top, so a small phone shows the line; the arrow
  // button leads down to the stair.
  useLayoutEffect(() => {
    const first = firstView.current; firstView.current = false;
    if (first && !state?.from) {
      const r = focus.next && !showBackupLine(useApp.getState().backup) ? currentRef.current?.getBoundingClientRect() : null;
      if (r && (r.top < 0 || r.bottom > window.innerHeight * 0.8)) currentRef.current.scrollIntoView({ block: 'center' });
      else window.scrollTo(0, 0);
      return;
    }
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
  const backupLine = useApp((s) => showBackupLine(s.backup));

  return (
    <div className="learn">
      <header className="learn-top" data-region="header">
        {/* the page's heading for a screen reader's list of headings (COUNCIL2-8); the look stays the bar's */}
        <h1 className="visually-hidden">{tr('shell.learn.56')}{view === '7' ? tr('shell.learn.57') : tr('shell.learn.58')}</h1>
        <button type="button" className="grade-switch" onClick={() => { setView(otherGrade); setOpen(null); }} aria-label={tr('shell.learn.59', { p0: view === '7' ? tr('shell.learn.57') : tr('shell.learn.58'), p1: otherGrade === '7' ? tr('shell.learn.57') : tr('shell.learn.58') })}>{tr('shell.learn.60')}{view === '7' ? tr('shell.learn.57') : tr('shell.learn.58')}<ChevronDown size={18} aria-hidden="true" />
        </button>
        <Link to="/quests" className={clsx('top-stat streak', streak > 0 && 'on')} aria-label={tr('shell.learn.61', { streak })}><Flame size={24} aria-hidden="true" />{streak}</Link>
        <Link to="/quests" className="top-stat xp" aria-label={tr('shell.learn.62', { todayXp, goalXp, xp })}><Zap size={22} aria-hidden="true" /><bdi dir="ltr">{todayXp}<span className="top-stat-of">/{goalXp}</span></bdi></Link>
      </header>
      <OfflineChip />
      {urgent && (
        <Link to="/quests" className="learn-work-chip">
          <School size={18} aria-hidden="true" /><span className="learn-work-text">{urgentText(urgent)}</span><ChevronLeft size={18} aria-hidden="true" />
        </Link>
      )}
      <StorageBanner />
      {/* a solo student's backup was turned on by default after the first questions: said once, here (COUNCIL2-24) */}
      {backupLine && <Suspense fallback={null}><BackupLine /></Suspense>}
      {/* on an iPhone in the browser, from the 3rd day: the Home Screen guide, offered once (lib/durable/install.js) */}
      {showLearnCard({ profile, days, xp, durable: { installHintAt } }) && <InstallCard onOpen={() => setInstall(true)} />}
      <InstallSheet open={install} onOpenChange={setInstall} />
      {/* the class reached a week's goal this student added to: a short shared moment, once (STUDENT-4) */}
      <ClassGoalMoment />

      <div className="learn-layout">
      <div className="learn-body">
        {/* a missed school day: two items today keep the streak (STUDENT-5); closed for the day with its X */}
        <RepairCard />
        {/* the next step when it is not a stop of the map; it stacks last under any other banner, and at most one shows:
            while the repair card is up, its button already goes to this same next step */}
        {banner && !repairOn && <NextBanner item={banner} onGo={() => onStart(banner.to)} />}
        {/* the home screen is the path, as on Duolingo: units under their sticky banners, the current stop marked */}
        {topics.map((t) => (
          <Unit key={t.id} t={t} n={own.indexOf(t) + 1} nodes={unitNodes(t.id, path)} open={open} setOpen={setOpen} onStart={onStart} currentRef={currentRef} focusKey={focusKey} focusNext={focus.next} fresh={state?.from}
            mastered={(path[t.id]?.reviews || 0) > 0} celebrate={state?.from === t.id && state?.nodeDone ? lastDoneKey(t.id) : null} />
        ))}
        {/* the end of the path says plainly what the app has of the year's programme, and what it does not have yet;
            each way on is a full-size target on its own line, not a link inside a sentence (STUDENT-9 §1) */}
        <div className="path-end">
          <Link to={`/programme?grade=${view}`}>{tr('shell.learn.63')}</Link>
          <Link to="/topics" className="btn btn-ghost btn-sm">{tr('shell.learn.64')}</Link>
        </div>
      </div>
      <SidePanel streak={streak} todayXp={todayXp} goalXp={goalXp} freezes={freezes} days={days} />
      </div>

      {away && (
        <button type="button" className="jump-current" onClick={() => currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })} aria-label={tr('shell.learn.65')}>
          {away === 'up' ? <ArrowUp size={26} aria-hidden="true" /> : <ArrowDown size={26} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
