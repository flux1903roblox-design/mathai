import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Zap, Check, BookOpen, ChevronDown, ChevronLeft, ArrowUp, ArrowDown, School } from 'lucide-react';
import { useApp, useStreak, today } from '@/lib/store.js';
import { questProgress } from '@/lib/quests.js';
import { topicsFor, pathColours } from '@/content/topics.js';
import { schoolMonth } from '@/learn/programme.ts';
import { unitNodes, chestAfter, chestOpen, stairProgress, unitProgress, unitCountText, addedStairNote, journey } from '@/lib/path.js';
import { PARTS, JUMP_LEN, REVIEW_LEN } from '@/lib/lessonRules.js';
import { MASTERY_N, checkWaits, PRACTICE_AGAIN } from '@/learn/mastery.ts';
import PathNode from '@/components/PathNode.jsx';
import StorageBanner from '@/components/durable/StorageBanner.jsx';
import OfflineChip from '@/components/durable/OfflineChip.jsx';
import InstallSheet, { InstallCard } from '@/components/durable/InstallSheet.jsx';
import { showLearnCard } from '@/lib/durable/install.js';
import Chest from '@/components/map/Chest.jsx';
import { Emblem, EMBLEMS } from '@/components/map/emblems.jsx';
import { Button } from '@/components/ui.jsx';
import RepairCard, { useRepairOn } from '@/components/learn/RepairCard.jsx';
import { homeCard } from '@/lib/homeCards.js';
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

// the Sunday recap's card (STUDENT-6) loads only from Sunday to Tuesday, and not back from a lesson; the card itself
// applies the whole rule (lib/recap.js), so the home screen's first download carries none of it
const RecapCard = lazy(() => import('@/components/learn/RecapCard.jsx'));
// the picture of what a unit's chest holds loads with the first chest card opened (Madi's accessories are not in the boot bundle)
const ItemArt = lazy(() => import('@/components/mascot/Accessories.jsx').then((m) => ({ default: m.ItemArt })));
// מדי at the stop the student is on, who walks there after a stair is done (PRODUCT2-37); loaded after the map is drawn
const Walker = lazy(() => import('@/components/map/Walker.jsx'));
// The locations whose arrival was already played: the walk and the unlock come once, not again on a re-render or Back.
const arrived = new Set();

// The path winds gently: each node sits a little to one side of the one before.
const SWING = [0, 52, 78, 52, 0, -52, -78, -52];
// After these stops, a small drawing from the unit's own topic (its second and third pieces) sits beside the path: after
// the second stop and after the fourth, or after the last one in a unit with fewer stops (two stairs and its review).
const ART_AFTER = { 1: 1, 3: 2 };
const artAfter = (i, stops) => (i === 1 ? ART_AFTER[1] : i > 1 && i === Math.min(3, stops - 1) ? ART_AFTER[3] : 0);
// how far from the middle the drawing sits: as far out as the widest swing, so it never meets a stop or its bubble
const ART_X = SWING[2];

// the drawings beside the path load after the first screen (components/map/Scenery.jsx; the emblems on the banners are
// in the first load, map/emblems.jsx): the place keeps its size (.path-art), so nothing moves when one arrives
const SceneryArt = lazy(() => import('@/components/map/Scenery.jsx').then((m) => ({ default: m.SceneryArt })));

/** A calm drawing from the unit's topic, opposite the swing of the stop above it: no text, no focus, no motion. */
function PathArt({ topic, piece, x }) {
  // every unit with an emblem has its two drawings (content.test.js: three pieces a topic)
  if (!EMBLEMS[topic] || !piece) return null;
  return <li className="path-art" aria-hidden="true" style={{ '--x': `${x > 0 ? -ART_X : ART_X}px` }}><Suspense fallback={null}><SceneryArt topic={topic} piece={piece} /></Suspense></li>;
}

function NodeCard({ n, t, onStart, next }) {
  const top = t.levels.length;
  if (n.kind === 'review') {
    return (
      <div className="node-card" role="group" aria-label={n.title}>
        <p className="node-card-title">חזרה על כל היחידה</p>
        <p className="node-card-sub">{n.state === 'locked' ? 'נפתחת אחרי בדיקת השליטה של כל המדרגות ביחידה.' : `${REVIEW_LEN} תרגילים מכל המדרגות, מעורבבים.`}</p>
        {n.state !== 'locked' && <Button className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${top}?kind=review`)}>{n.state === 'done' ? 'עוד חזרה' : 'התחלה'}</Button>}
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
  // after a failed mastery check: practice first, and the card says so in the result screen's words
  const waits = checkWaits(rec);
  const path = useApp((s) => s.path);
  const added = addedStairNote(n, path);
  return (
    <div className="node-card" role="group" aria-label={n.title}>
      <p className="node-card-title">{n.title}</p>
      {added && <p className="node-card-sub node-card-added">{added}</p>}
      {lead && <p className="node-card-sub node-card-next">הצעד הבא: <MathText text={lead.title} /></p>}
      {lead && <Button className="btn-block node-next-btn" onClick={() => onStart(lead.to)}>לצעד הבא</Button>}
      {n.state === 'current' && <p className="node-card-sub">שלב {STAGE_N[st]} מתוך 5: {STAGE_NAME[st]}{waits ? `. ${PRACTICE_AGAIN}` : ''}</p>}
      {n.state === 'current' && <Button variant={main} className="btn-block node-start-btn" onClick={() => onStart(own)}>{rec?.taught?.A || n.parts ? 'המשך' : 'התחלה'}</Button>}
      {n.state === 'current' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>כל חמשת השלבים</Button>}
      {mastered && <p className="node-card-sub">שולטים בזה: עברתם את בדיקת השליטה.</p>}
      {n.state === 'done' && !mastered && <p className="node-card-sub">{waits ? PRACTICE_AGAIN : `המדרגה הושלמה לפני שהיו בדיקות שליטה. בדיקה קצרה, ${MASTERY_N} שאלות, תראה שזה נשאר.`}</p>}
      {n.state === 'open' && <p className="node-card-sub">{waits ? PRACTICE_AGAIN : `המדרגה הזאת פתוחה. בדיקת שליטה קצרה, ${MASTERY_N} שאלות, תסמן אותה כמדרגה שעברתם.`}</p>}
      {n.state === 'locked' && <p className="node-card-sub">יודעים כבר? מבחן קצר של {JUMP_LEN} תרגילים, טעות אחת מותרת, פותח את כל הדרך עד לכאן.</p>}
      {(n.state === 'open' || (n.state === 'done' && !mastered)) && <Button variant={main} className="btn-block" onClick={() => onStart(waits ? own : check)}>{waits ? 'לתרגול' : 'לבדיקת שליטה'}</Button>}
      {n.state === 'open' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>לשיעור</Button>}
      {mastered && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/learn/${t.id}/${n.level}`)}>לשיעור</Button>}
      {n.state === 'done' && <Button variant="ghost" className="btn-block btn-sm" onClick={() => onStart(`/lesson/${t.id}/${n.level}?part=${PARTS}`)}>תרגול חוזר</Button>}
      {n.state === 'locked' && <Button variant="secondary" className="btn-block" onClick={() => onStart(`/lesson/${t.id}/${n.level}?kind=jump`)}>מבחן קפיצה</Button>}
    </div>
  );
}

/**
 * The chest's card: what it holds for Madi before it opens (no surprises, STUDENT-3), and after, a way to try it on.
 */
function ChestCard({ topic, open, half, onTry }) {
  const item = chestItem(topic);
  return (
    <div className="node-card" role="group" aria-label="תיבת אוצר">
      <p className="node-card-title">{open ? 'חצי היחידה מאחוריכם' : 'תיבת אוצר'}</p>
      <div className="chest-card-item">
        <Suspense fallback={<span className="chest-card-art" />}>{item ? <ItemArt id={item.id} className="chest-card-art" /> : <span className="chest-card-art" />}</Suspense>
        <p className="node-card-sub">{open ? `פתחתם: ${item?.name}.` : `בתיבה: ${item?.name} למדי. היא נפתחת כשתשלטו ${half === 1 ? 'במדרגה הראשונה' : `במדרגות 1 עד ${half}`}.`}</p>
      </div>
      {open && item && <Button variant="secondary" className="btn-block" onClick={() => onTry(`/me/madi?try=${item.id}`)}>לנסות על מדי</Button>}
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

/**
 * A unit folded into one row, one tap away (PRODUCT2-37): its emblem, name and count; the row opens it in place. The
 * unit's name is a heading, so a screen reader's list of headings still names every unit.
 */
function UnitRow({ t, colour, n, mastered, onOpen }) {
  const skills = useApp((s) => s.learn.skills);
  const path = useApp((s) => s.path);
  const prog = unitProgress(t.id, path, skills);
  return (
    <section className={clsx('unit-row', `ch-${colour || t.color}`, mastered && 'is-mastered')}>
      <h2 className="unit-row-h">
        <button type="button" className="unit-row-btn" aria-expanded="false" onClick={() => onOpen(t.id)}>
          <Emblem topic={t.id} />
          <span className="unit-row-text">
            <span className="unit-title">{t.title}</span>
            <span className="unit-label">{t.bridge ? 'יסודות' : `יחידה ${n}`}{'\u00a0· '}<span className="unit-count">{unitCountText(prog)}</span></span>
          </span>
          <ChevronDown size={22} aria-hidden="true" className="unit-row-go" />
        </button>
      </h2>
    </section>
  );
}

function Unit({ t, colour, n, nodes, open, setOpen, onStart, currentRef, focusKey, focusNext, fresh, mastered, celebrate, preview, onUnfold, arrive }) {
  const skills = useApp((s) => s.learn.skills);
  const path = useApp((s) => s.path);
  // the unit's counters move from the first stage: stairs done (mastered) once there is one, before that stages done,
  // and a thin bar of all its stages under the name
  const prog = unitProgress(t.id, path, skills);
  const half = chestAfter(t.id);
  // the chest opens as the store awards it: once every stair up to it is done (not a stair done out of order)
  const chest = chestOpen(t.id, path);
  return (
    <section className={clsx('unit', `ch-${colour || t.color}`, `world-${t.id}`, mastered && 'is-mastered', preview && 'is-preview')} aria-labelledby={`unit-${t.id}`}>
      {/* the unit's banner, as on Duolingo's path: which unit, its name, and the guidebook; it stays on top while its path
          scrolls. The fractions floor is not one of the grade's units: it is named יסודות and has no number */}
      <header className="unit-head" data-region="banner">
        <Emblem topic={t.id} />
        <div className="unit-head-text">
          <h2 id={`unit-${t.id}`} className="unit-title" tabIndex={-1}>{t.title}</h2>
          <p className="unit-label">{t.bridge ? 'יסודות' : `יחידה ${n}`}{'\u00a0· '}<span className="unit-count">{unitCountText(prog)}</span></p>
          <div className="unit-bar" role="progressbar" aria-label={`${t.title}: שלבים שהושלמו`} aria-valuemin={0} aria-valuemax={prog.of} aria-valuenow={prog.stages} aria-valuetext={`${prog.stages} מתוך ${prog.of} שלבים`}><i style={{ width: `${(prog.stages / prog.of) * 100}%` }} /></div>
        </div>
        <Link to={`/topic/${t.id}`} className="unit-guide" aria-label={`תזכורת מהשיעור: ${t.title}`}><BookOpen size={22} aria-hidden="true" /><span>תזכורת</span></Link>
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
            const label = `${node.kind === 'review' ? 'חזרה על היחידה' : `מדרגה ${node.level}: ${node.title}`}. ${node.preview && node.state === 'current' ? 'המדרגה הראשונה של היחידה הבאה' : node.state === 'done' ? (mastered ? 'נשלט' : 'הושלם') : node.state === 'open' ? 'פתוחה, בדיקת השליטה מחכה' : node.state === 'current' ? (node.kind === 'node' ? `השלב הבא, ${Math.round(pct * 5)} מתוך 5 שלבים` : 'השלב הבא') : 'נעול'}`;
            // the stop the student is on: מדי stands beside it (on the side toward the middle), and walks in once
            const here = node.state === 'current' && !node.preview && key === focusKey;
            return [
              <li key={key} className="path-step" style={{ '--x': `${x}px` }}>
                {node.state === 'current' && !node.preview && !isOpen && <span className="node-start" aria-hidden="true">{pct > 0 ? 'המשך' : 'התחלה'}</span>}
                {isNext && !isOpen && <span className="node-start node-next" aria-hidden="true">הצעד הבא</span>}
                <div className={clsx('node-anchor', node.state === 'current' && !node.preview && 'is-current')} data-stop={key}>
                  <PathNode
                    ref={key === focusKey ? currentRef : undefined}
                    state={node.preview && node.state === 'current' ? 'preview' : node.state} kind={node.kind} parts={node.parts} of={PARTS} pct={pct} mastered={mastered}
                    fillLast={key === focusKey && fresh === t.id && node.parts > 0}
                    celebrate={celebrate === key} unlocking={here && !!arrive?.from}
                    label={isNext ? `${label}. הצעד הבא` : label} expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)}
                  />
                  {here && <Suspense fallback={null}><Walker side={x > 0 ? 'left' : 'right'} from={arrive?.from} hop={!!arrive && !arrive.from} /></Suspense>}
                </div>
                {isOpen && <NodeCard n={node} t={t} onStart={onStart} next={key === focusKey ? focusNext : null} />}
              </li>,
              // halfway along the unit, a treasure chest sits on the road (not on a unit only previewed)
              !preview && node.kind === 'node' && node.level === half && (
                <li key={`${t.id}:chest`} className="path-step path-chest" style={{ '--x': `${(x + SWING[(i + 1) % SWING.length]) / 2}px` }}>
                  <Chest open={chest} celebrate={chest && celebrate === key} expanded={open === `${t.id}:chest`}
                    label={`תיבת אוצר. ${chest ? 'פתוחה' : `נפתחת אחרי מדרגה ${half}`}`} onClick={() => setOpen(open === `${t.id}:chest` ? null : `${t.id}:chest`)} />
                  {open === `${t.id}:chest` && <ChestCard topic={t.id} open={chest} half={half} onTry={onStart} />}
                </li>
              ),
              artAfter(i, nodes.length) > 0 && <PathArt key={`${t.id}:art${i}`} topic={t.id} piece={artAfter(i, nodes.length)} x={x} />,
            ];
          })}
        </ol>
        {preview && (
          <button type="button" className="btn btn-ghost btn-sm unit-more" onClick={() => onUnfold(t.id)}>
            כל המדרגות של {t.title}<ChevronDown size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}

/** "עוד שני שיעורים היום שומרים עליו": what keeps a streak at risk (the repair card's own count, RepairCard repairText). */
const keepsIt = (repair) => (Math.max(1, repair?.left || 0) === 1 ? 'עוד שיעור אחד היום שומר עליו.' : 'עוד שני שיעורים היום שומרים עליו.');

/**
 * The header's flame (PRODUCT2-40): the streak, and while a missed school day can still be repaired, the kept streak
 * with a calm mark, "מחכה", the number the repair card names. Never 0 beside "הרצף של 4 ימים נשמר"; no red, no countdown.
 */
function StreakStat({ streak }) {
  const { n, atRisk, repair } = streak;
  const label = atRisk ? `רצף של ${n} ימים, מחכה לשיעור היום. ${keepsIt(repair)}` : `רצף של ${n} ימים`;
  return (
    <Link to="/quests" className={clsx('top-stat streak', n > 0 && !atRisk && 'on', atRisk && 'at-risk')} aria-label={label}>
      <Flame size={24} aria-hidden="true" />{n}{atRisk && <span className="top-stat-risk" aria-hidden="true">מחכה</span>}
    </Link>
  );
}

/** Wide screens: the streak, the goal and today's quests sit beside the path. */
function SidePanel({ streak, todayXp, goalXp, freezes, days }) {
  const quests = questProgress(today(), days[today()] || {});
  const { n, atRisk, repair } = streak;
  return (
    <aside className="learn-side" aria-label="היום שלי">
      <Link to="/quests" className="side-card side-streak">
        <Flame size={34} aria-hidden="true" className={clsx(n > 0 && !atRisk && 'on', atRisk && 'at-risk')} />
        <span><b>{n === 1 ? 'יום אחד ברצף' : `${n} ימים ברצף`}</b><span className="muted">{atRisk ? keepsIt(repair) : freezes > 0 ? `${freezes === 1 ? 'הקפאה אחת מוכנה' : `${freezes} הקפאות מוכנות`}` : 'שיעור או שלב ביום שומרים על הרצף'}</span></span>
      </Link>
      <div className="side-card">
        <div className="card-row"><b>היעד היומי</b><span className="card-num">{Math.min(todayXp, goalXp)}/{goalXp} XP</span></div>
        <div className="bar" role="progressbar" aria-label="ההתקדמות ליעד היומי" aria-valuemin={0} aria-valuemax={goalXp} aria-valuenow={Math.min(todayXp, goalXp)}><i style={{ width: `${Math.min(1, todayXp / goalXp) * 100}%` }} /></div>
      </div>
      <Link to="/quests" className="side-card">
        <div className="card-row"><b>המשימות של היום</b><span className="card-num">{quests.filter((q) => q.done).length}/3</span></div>
        <ul className="side-quests">{quests.map((q) => <li key={q.id} className={clsx(q.done && 'done')}><span>{q.done && <Check size={16} strokeWidth={3} aria-hidden="true" />}{q.title}</span><span className="card-num">{q.have}/{q.target}</span></li>)}</ul>
      </Link>
      {/* the class goal of the week, small (STUDENT-4); nothing for a student with no class */}
      <ClassGoalCard compact />
    </aside>
  );
}

/**
 * The installed app's shortcut "השיעור של היום" (./#/?go=today, STUDENT-10) opens what TodayCard's button opens: the
 * teacher's work while it is the plan's top, else the mission's next part, or the missions tab when the day's mission
 * is done. The mission is fixed for the day once
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
    navigate(plan.top?.kind === 'teacher' ? plan.top.to : todayRoute(items), { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Load these topics (or skills) when the browser is idle: their teaching and their exercise generators, which are not in
 * the first download (the boot split). A topic already loaded costs nothing.
 */
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
  const { state, key: locKey } = useLocation();
  const { profile, path, days, xp, goalXp, freezes, settleStreak, lastTopic } = useApp();
  // the grade on show: the student's own, or the one a link to a unit asks for (the wardrobe's "ליחידת …")
  const [view, setView] = useState(state?.grade || profile.grade || '7');
  const floorOn = useApp((s) => !!(s.learn.floor ?? null)?.on);
  const [open, setOpen] = useState(null);
  // the units the student unfolded on this visit (the unit they are on is always open: lib/path.js journey)
  const [unfolded, setUnfolded] = useState([]);
  const [away, setAway] = useState(null); // 'up' | 'down' when the current node is off screen
  const [install, setInstall] = useState(false);
  const installHintAt = useApp((s) => s.durable?.installHintAt);
  const currentRef = useRef(null);
  const jumpRef = useRef(null);
  const firstView = useRef(true);
  // the grade's own units, and above them the fractions floor while it is on (the floor check or the student put it there)
  const own = topicsFor(view);
  // the path of the month: a unit of the other grade joins it once the programme teaches it here (PRODUCT2-20)
  const topics = mapTopics(view, floorOn, schoolMonth(today()));
  const topicIds = topics.map((t) => t.id);
  // a unit's number on this path: the grade's own units, then any unit of the other grade that has joined it
  const unitNumber = (t) => topics.filter((x) => !x.bridge).indexOf(t) + 1;
  // each banner's colour on this path: a joined unit never sits beside its own colour
  const colours = pathColours(topics);
  // the streak as the repair card says it (store.js useStreak): kept and at risk while a missed day can be repaired
  const streak = useStreak();
  const todayXp = days[today()]?.xp || 0;
  // "Where I am" follows the one plan (learn/next.ts): back from a lesson, the unit just practised; on a fresh open, the
  // plan's next step when it is a stair of this map (that stair is the focused node); else the unit practised last, else
  // the grade's first unit (the floor above it is never where the map opens by default). A next step that is not a
  // stair of this map (an exam step, a repair, a review, points lost in an exam, the floor check) is the banner above.
  const { top } = useNext();
  const focus = mapFocus({ from: state?.from, top, lastTopic, topicIds, firstId: own[0]?.id, path });
  const focusKey = focus.key;
  const banner = top && !onMap(top, topicIds) ? top : null;
  // the next step's topic and the focused unit's (the stair a tap most likely opens) load while the map is open, when the
  // browser is idle, so the step opens without a wait (the boot split); a card opened on another unit fetches that one
  usePrefetchTopics([top?.skill, focus.topic, open?.split(':')[0]]);
  // only the unit the student is on opens; the next is previewed, the others fold (PRODUCT2-35/37)
  const units = journey(topicIds, path, focus.topic, unfolded);
  const unfold = (id) => {
    setUnfolded((u) => (u.includes(id) ? u : [...u, id]));
    requestAnimationFrame(() => { const h = document.getElementById(`unit-${id}`); h?.scrollIntoView({ block: 'start' }); h?.focus({ preventScroll: true }); });
  };
  // back from a stage or a stair: מדי arrives at the stop the student is on, once (not again on Back to this entry, or a
  // re-render). After a stair is done he walks there from the stop just finished, and the stop opens; after a stage he
  // hops where he is. The stop just done pops and its ring fills on that same arrival only.
  const [arrive] = useState(() => (state?.from && !arrived.has(locKey) ? { topic: state.from, from: state.nodeDone ? lastDoneKey(state.from) : null } : null));
  useEffect(() => { if (arrive) arrived.add(locKey); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const repairOn = useRepairOn();
  // the teacher's most urgent work, due within 3 days (only in a class): a chip to the missions tab, unless the banner
  // already names it (the plan's top is the teacher's work: band 1 of learn/next.ts, the same selection)
  const classWork = useApp((s) => s.classWork);
  const workOutbox = useApp((s) => s.workOutbox);
  const urgent = profile.token && banner?.kind !== 'teacher' ? urgentWork(classWork, workOutbox) : null;
  // the Sunday recap (STUDENT-6), decided once as the screen opens, so the card (and the share sheet it opens) stays
  // mounted after it is closed
  const [recapHere] = useState(() => !state?.from && new Date(`${today()}T12:00:00Z`).getUTCDay() < 3);
  // at most one card above the path, the most important (lib/homeCards.js); the install guide that loses waits under the
  // path, and the rest live in the missions tab too
  const installOn = showLearnCard({ profile, days, xp, durable: { installHintAt } });
  const card = homeCard({ repair: repairOn, work: !!urgent, next: !!banner, install: installOn });

  useEffect(() => { settleStreak(); }, [settleStreak]);
  // The screen opens at the top of the path; back from a lesson, or on another grade, it opens on the place to continue from.
  // On a fresh open the screen opens at the top, unless the plan's next stair is out of view: then it opens on it. With a
  // card above the path it stays at the top: the card is the most important thing today (and the repair card's button goes
  // to that same next step), so it is never scrolled half away; the button back to the current stop points down.
  useLayoutEffect(() => {
    const first = firstView.current; firstView.current = false;
    if (first && !state?.from) {
      const r = focus.next && !card ? currentRef.current?.getBoundingClientRect() : null;
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

  // the way back to the current stop floats at the end side (no emblem lives there: a banner's emblem and a folded row's
  // are at the start), and it steps aside while a unit's banner passes under it, so it never covers the banner's emblem
  // or its guide link (PRODUCT2-40). Checked before the button is first painted, so it never flashes over a banner
  useLayoutEffect(() => {
    const btn = jumpRef.current; if (!btn) return undefined;
    let raf = 0;
    const check = () => {
      raf = 0;
      const b = btn.getBoundingClientRect();
      const over = [...document.querySelectorAll('.learn [data-region="banner"]')].some((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right;
      });
      btn.toggleAttribute('data-over', over);
    };
    const later = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', later); window.removeEventListener('resize', later); };
  }, [away]);

  const onStart = (to) => navigate(to);
  const otherGrade = view === '7' ? '8' : '7';

  return (
    <div className="learn">
      <header className="learn-top" data-region="header">
        <button type="button" className="grade-switch" onClick={() => { setView(otherGrade); setOpen(null); setUnfolded([]); }} aria-label={`מציגים את כיתה ${view === '7' ? 'ז׳' : 'ח׳'}. מעבר לכיתה ${otherGrade === '7' ? 'ז׳' : 'ח׳'}`}>
          כיתה {view === '7' ? 'ז׳' : 'ח׳'}<ChevronDown size={18} aria-hidden="true" />
        </button>
        <StreakStat streak={streak} />
        <Link to="/quests" className="top-stat xp" aria-label={`היום ${todayXp} מתוך ${goalXp} XP, סך הכול ${xp}`}><Zap size={22} aria-hidden="true" /><bdi dir="ltr">{todayXp}<span className="top-stat-of">/{goalXp}</span></bdi></Link>
      </header>
      <OfflineChip />
      {card === 'work' && (
        <Link to="/quests" className="learn-work-chip">
          <School size={18} aria-hidden="true" /><span className="learn-work-text">{urgentText(urgent)}</span><ChevronLeft size={18} aria-hidden="true" />
        </Link>
      )}
      <StorageBanner />
      {/* on an iPhone in the browser, from the 3rd day: the Home Screen guide, offered once (lib/durable/install.js) */}
      {card === 'install' && <InstallCard onOpen={() => setInstall(true)} />}
      <InstallSheet open={install} onOpenChange={setInstall} />
      {/* the class reached a week's goal this student added to: a short shared moment, once (STUDENT-4) */}
      <ClassGoalMoment />

      <div className="learn-layout">
      <div className="learn-body">
        {/* a missed school day: two items today keep the streak (STUDENT-5); closed for the day with its X */}
        {card === 'repair' && <RepairCard />}
        {/* the Sunday recap (STUDENT-6): Sunday to Tuesday after a week with learning, once, never right after a lesson */}
        {recapHere && <Suspense fallback={null}><RecapCard afterLesson={!!state?.from} /></Suspense>}
        {/* the next step when it is not a stop of the map (the missions tab leads with it too); while the repair card is
            up, its button already goes to this same next step */}
        {card === 'next' && <NextBanner item={banner} onGo={() => onStart(banner.to)} />}
        {/* the home screen is the path, as on Duolingo: units under their sticky banners, the current stop marked */}
        {units.map(({ id, mode, nodes }) => {
          const t = topics.find((x) => x.id === id);
          const mastered = (path[id]?.reviews || 0) > 0;
          if (mode === 'folded') return <UnitRow key={id} t={t} colour={colours[id]} n={unitNumber(t)} mastered={mastered} onOpen={unfold} />;
          return (
            <Unit key={id} t={t} colour={colours[id]} n={unitNumber(t)} nodes={nodes} open={open} setOpen={setOpen} onStart={onStart} currentRef={currentRef} focusKey={focusKey} focusNext={focus.next} fresh={arrive?.topic}
              mastered={mastered} celebrate={arrive?.topic === id ? arrive.from : null} preview={mode === 'preview'} onUnfold={unfold} arrive={id === focus.topic && arrive?.topic === id ? arrive : null} />
          );
        })}
        {/* the Home Screen guide when a more important card stood above the path: it waits here, under the path */}
        {installOn && card !== 'install' && <InstallCard onOpen={() => setInstall(true)} />}
        {/* the end of the path: every topic and how far each one is. What the app has of the Ministry's programme is for
            the adults (the topics tab, the parents' and the teacher's screens), not the child's path (PRODUCT2-41) */}
        <div className="path-end">
          <Link to="/topics" className="btn btn-ghost btn-sm">כל הנושאים והמצב בכל אחד</Link>
        </div>
      </div>
      <SidePanel streak={streak} todayXp={todayXp} goalXp={goalXp} freezes={freezes} days={days} />
      </div>

      {away && (
        <button type="button" ref={jumpRef} className="jump-current" onClick={() => currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })} aria-label="חזרה לשלב הבא">
          {away === 'up' ? <ArrowUp size={26} aria-hidden="true" /> : <ArrowDown size={26} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
