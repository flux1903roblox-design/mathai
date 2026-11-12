import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { Zap, Target, Timer, Snowflake, Star, Trophy, ChevronsUp, Wrench, Medal } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { weekStart, weekTotals, personalBest, streakMilestone } from '@/lib/streak.js';
import Mascot from '@/components/Mascot.jsx';
import Stairs from '@/components/Stairs.jsx';
import { unitProgress, stagesDone, partsOf, isDone, practiceComplete, STAIR_STAGES } from '@/lib/path.js';
import { skillId } from '@/learn/skills.ts';
import { checkWaits } from '@/learn/mastery.ts';
import { Segments } from '@/components/ds.jsx';
import Lottie from '@/components/Lottie.jsx';
import { TOPIC, placementTopicsFor } from '@/content/index.js';
import { Button } from '@/components/ui.jsx';
import { DUR, enter } from '@/lib/motion.js';
import { askAfterLesson } from '@/lib/durable/persist.js';
import GoalStage from '@/components/learn/GoalStage.jsx';
import { installDue } from '@/lib/install.js';
import { reminderDue } from '@/lib/reminder.js';
import { UnlockMoment, useNewUnlocks, useMadiLook } from '@/lib/madiLook.js';
import { wearing } from '@/lib/wardrobe.js';
import ChestChoice, { useChestOffer } from '@/components/learn/ChestChoice.jsx';
import StreakStage from '@/components/learn/StreakStage.jsx';
import Celebrate from '@/components/learn/Celebrate.jsx';
import XpCount from '@/components/learn/XpCount.jsx';

// the install offer is shown to few, and late: its screen loads when it comes (STUDENT-10)
const InstallCard = lazy(() => import('@/components/learn/InstallCard.jsx'));
// so is the daily reminder's offer, once ever (STUDENT-11)
const ReminderCard = lazy(() => import('@/components/learn/ReminderCard.jsx'));

// The main button takes the focus (for a keyboard or a screen reader) without scrolling a tall celebration
// down to it: on a small phone the climb at the top stays in view.
const focusQuietly = (el) => { if (el) el.focus({ preventScroll: true }); };
const fmtTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
// Celebration content rises in one after another, once.
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: enter(DUR.slow) } };
const stagger = (delay = 0.25) => ({ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: delay } } });

/** Counts up from 0 once the card is on screen (a still number under reduced motion). */
function useCount(target) {
  const [v, setV] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setV(target)); return () => cancelAnimationFrame(id); }, [target]);
  return v;
}

/** A result tile. `xpAt`: the XP tile, whose number counts up (XpCount, PRODUCT2-38) once the tile is in view. */
function Stat({ tone, icon: Icon, label, value, prefix = '', suffix = '', text, xpAt }) {
  const v = useCount(value ?? 0);
  return (
    <m.div variants={rise} className={clsx('stat', `stat-${tone}`)}>
      <span className="stat-label">{label}</span>
      <span className="stat-value"><Icon size={20} aria-hidden="true" /><span>{xpAt != null ? <XpCount value={value ?? 0} delay={xpAt} unit={false} /> : text ?? <>{prefix}<NumberFlow value={v} />{suffix}</>}</span></span>
    </m.div>
  );
}

/** The top of a celebration: confetti behind the hero, played once. */
function Hero({ children, confetti = true }) {
  return (
    <div className="done-hero">
      {confetti && <Lottie name="confetti" className="done-confetti" decorative />}
      {children}
    </div>
  );
}

/**
 * A new weekly best, said once a week (STUDENT-5): this week's stages just passed the best earlier week's (the personal
 * best the missions tab shows, PRODUCT2-39), and that best was at least 3 stages. Worked out once, as the screen opens;
 * then the week is marked as told (nudges.pbWeek).
 */
function useWeekBest(passed) {
  const [pb] = useState(() => {
    const { days, nudges } = useApp.getState();
    const week = weekStart(today());
    const best = personalBest(days, week).stages;
    return passed && !!best && best.n >= 3 && weekTotals(days, week).stages > best.n && nudges?.pbWeek !== week ? week : null;
  });
  useEffect(() => { if (pb) useApp.getState().setNudge({ pbWeek: pb }); }, [pb]);
  return !!pb;
}

/**
 * Whether the daily reminder's card comes last (STUDENT-11): the quick rules first (lib/reminder.js), then the server's
 * answer (lib/push.js reminderState, loaded only then; in the iPhone app, the phone's permission). settle() fixes the answer once the student moves on, so the screens
 * never change under them.
 */
function useReminderOffer(may) {
  const [due, setDue] = useState(false);
  const settled = useRef(false);
  useEffect(() => {
    if (!may || !reminderDue(useApp.getState())) return undefined;
    let live = true;
    import('@/lib/push.js').then((mod) => mod.reminderState()).then((s) => { if (live && !settled.current && s === 'ready') setDue(true); }).catch(() => {});
    return () => { live = false; };
  }, [may]);
  return { due, settle: () => { settled.current = true; } };
}

export default function LessonDone({ result, award, topic, onExit, onAgain }) {
  const days = useApp((s) => s.days);
  const freezes = useApp((s) => s.freezes);
  const path = useApp((s) => s.path);
  const skills = useApp((s) => s.learn.skills);
  // the screens after a lesson, in order: what it earned, a new piece for מדי (STUDENT-3), the daily goal (its own
  // moment), the streak, the day's chest (the streak screen also comes when this lesson kept the streak with an earned
  // repair: STUDENT-5), and last, from the second learning day, the install offer where the browser can (STUDENT-10;
  // decided once, as the screen opens)
  const unlocks = useNewUnlocks(topic.id);
  const [install] = useState(() => result.passed && installDue(useApp.getState(), today()));
  // the daily reminder's offer (STUDENT-11): from the third learning day, once ever, where the server has it on; one
  // card per result, so not after the install offer. The server is asked as the screen opens; the answer counts only
  // while the student is still on the first screen.
  const remind = useReminderOffer(result.passed && !install);
  const stages = ['summary', result.passed && unlocks.length > 0 && 'unlock', award.goalReached && 'goal', (award.streakExtended || award.streakRepaired) && result.passed && 'streak', award.questsDone && 'quests', install && 'install', remind.due && 'reminder'].filter(Boolean);
  const [i, setI] = useState(0);
  // the first finished lesson is the moment to ask the browser to keep the data (once; never on Firefox from here)
  useEffect(() => { askAfterLesson(); }, []);
  const pb = useWeekBest(result.passed);
  // a streak milestone (3, 7, 30 days) not shown before: the streak's moment is the milestone's (PRODUCT2-38),
  // worked out once as the screen opens (the moment marks it as shown)
  const [milestone] = useState(() => (result.passed ? streakMilestone(award, useApp.getState().nudges?.streakSeen) : null));
  const stage = stages[i];
  const nextStage = () => { remind.settle(); return i + 1 < stages.length ? setI(i + 1) : onExit(); };
  const levelTitle = topic.levels[result.level - 1]?.title;

  if (!result.passed) {
    return (
      <div className={clsx('done-screen', `ch-${topic.color}`)}>
        <Mascot mood="encouraging" size={150} />
        <h1 className="done-title">כמעט! עוד קצת תרגול</h1>
        <p className="lead">במבחן הקפיצה מותרת טעות אחת. אפשר לנסות שוב, או להמשיך במסלול מהמקום שלכם.</p>
        <div className="done-actions" data-region="footer">
          <Button className="btn-block btn-lg" onClick={onExit}>חזרה למפה</Button>
          <Button variant="ghost" className="btn-block done-quiet" onClick={onAgain}>לנסות שוב</Button>
        </div>
      </div>
    );
  }

  if (stage === 'unlock') return <UnlockMoment ids={unlocks} onNext={nextStage} />;
  if (stage === 'goal') return <GoalStage onNext={nextStage} />;
  if (stage === 'streak') return <StreakStage streak={award.streak} repaired={!!award.streakRepaired} days={days} freezes={freezes} onNext={nextStage} milestone={milestone} />;
  if (stage === 'install') return <Suspense fallback={<div className="done-screen" />}><InstallCard onDone={nextStage} /></Suspense>;
  if (stage === 'reminder') return <Suspense fallback={<div className="done-screen" />}><ReminderCard onDone={nextStage} /></Suspense>;

  if (stage === 'quests') return <QuestsStage award={award} onNext={nextStage} />;

  const title = result.kind === 'review' ? 'סיימתם חזרה על היחידה!' : result.kind === 'jump' ? 'קפצתם קדימה!' : result.perfect ? 'שיעור מושלם!' : 'השיעור הושלם!';
  // Medals only for what this lesson really earned.
  const badges = [
    award.unitDone && { icon: Trophy, label: `${topic.title}: היחידה הושלמה`, tone: 'gold' },
    result.kind === 'jump' && { icon: ChevronsUp, label: `עכשיו ב${levelTitle}`, tone: 'brand' },
    result.perfect && { icon: Star, label: 'בלי אף טעות', tone: 'gold' },
    result.fixed > 0 && { icon: Wrench, label: result.fixed === 1 ? 'תיקנתם טעות' : `תיקנתם ${result.fixed} טעויות`, tone: 'good' },
    pb && { icon: Medal, label: 'שיא שבועי חדש', tone: 'gold' },
  ].filter(Boolean);
  // What moved: this stair's five stages (practice fills the fourth), and the unit's stairs once one is done (a stair
  // counts once its mastery check is passed). A review or a jump test speaks of the unit only.
  const steps = topic.levels.length;
  // multiplication facts (/facts) are a lesson on no stair: no stair line and no unit count
  const unit = steps ? unitProgress(topic.id, path, skills) : { done: 0 };
  const stairLine = result.kind !== 'review' && result.kind !== 'jump' && !!levelTitle;
  const stairRec = stairLine ? skills[skillId(topic.id, result.level)] : null;
  const stairParts = stairLine ? partsOf(path, topic.id, result.level) : 0;
  const stairDoneNow = stairLine && isDone(path, topic.id, result.level);
  const stairSteps = stairLine ? stagesDone(stairRec, stairParts, stairDoneNow) : 0;
  // practice is complete and the stair is not counted yet: its mastery check is next
  // (after a failed mastery check, only once it is offered again: mastery.ts checkWaits)
  const checkNext = (award.practiceDone || (stairLine && !stairDoneNow && practiceComplete(stairRec, stairParts))) && !checkWaits(stairRec);
  return (
    <div className={clsx('done-screen', `ch-${topic.color}`)}>
      <Hero>
        {award.unitDone && <Lottie name="trophy" className="done-trophy" label="גביע" fallback={null} />}
        {result.perfect && !award.unitDone && <Lottie name="stars" className="done-stars" decorative />}
        {/* מדי jumps in under the confetti, then dances (PRODUCT2-38) */}
        <Celebrate rays={false} burst={false} delay={0.1}><Mascot mood={award.unitDone || result.perfect ? 'achievement' : 'excited'} size={120} className="done-madi" /></Celebrate>
      </Hero>
      {/* after the hop: the title, then the numbers, then the medals */}
      <m.div className="done-copy" variants={stagger(0.85)} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title">{title}</m.h1>
        {stairLine ? (
          <m.div variants={rise} className="stage-done-climb">
            <Segments steps={STAIR_STAGES} done={stairSteps} size="thick" label={`השלבים של המדרגה ${levelTitle}`} valueText={`${stairSteps} מתוך ${STAIR_STAGES} שלבים`} />
            <p className="climb-caption">{levelTitle}: <bdi>{stairSteps}</bdi> מתוך <bdi>{STAIR_STAGES}</bdi> שלבים</p>
            {unit.done > 0 && <p className="climb-caption">{topic.title}: <bdi>{unit.done}</bdi> מתוך <bdi>{steps}</bdi> מדרגות</p>}
          </m.div>
        ) : unit.done > 0 && <m.p variants={rise} className="climb-caption">{topic.title}: <bdi>{unit.done}</bdi> מתוך <bdi>{steps}</bdi> מדרגות</m.p>}
        {checkNext && !award.unitDone && <m.p variants={rise} className="climb-next">סיימתם לתרגל. אחרי בדיקת שליטה קצרה, המדרגה נספרת.</m.p>}
        {badges.length > 0 && (
          <m.div variants={rise} className="badges">
            {badges.map((b) => <span key={b.label} className={`done-earned tone-${b.tone}`}><b.icon size={16} aria-hidden="true" />{b.label}</span>)}
          </m.div>
        )}
        <m.div className="stats" variants={stagger(0.05)} data-region="answers">
          <Stat tone="gold" icon={Zap} label="XP" value={result.xp} xpAt={1.15} />
          <Stat tone="good" icon={Target} label="דיוק" value={result.accuracy} suffix="%" />
          <Stat tone="brand" icon={Timer} label="זמן" text={fmtTime(result.secs)} />
        </m.div>
        {result.fixed > 0 && <m.p variants={rise} className="muted">כולל {result.fixed * 2} XP על תיקון {result.fixed === 1 ? 'טעות' : `${result.fixed} טעויות`}.</m.p>}
      </m.div>
      <div className="done-actions" data-region="footer"><Button className="btn-block btn-lg" onClick={nextStage} ref={focusQuietly}>המשך</Button></div>
    </div>
  );
}

/**
 * The day's chest, opened by the last of the three quests: the streak freeze, and a choice of one of two pieces for מדי
 * (PRODUCT2-36, components/learn/ChestChoice.jsx). The offer is fixed as the screen opens. Once a piece is chosen, מדי
 * shows it on, and "לשמור על מדי" keeps it on; "המשך" without a choice leaves it waiting in the quests tab.
 */
function QuestsStage({ award, onNext }) {
  const live = useChestOffer();
  const [offer] = useState(live);
  const [picked, setPicked] = useState(null);
  const look = useMadiLook();
  const pick = (id) => { if (useApp.getState().pickChest(offer.day, id)) setPicked(id); };
  const keep = () => { useApp.getState().setLook(wearing(picked)); onNext(); };
  return (
    <div className="done-screen quests-done-screen">
      <Hero confetti={!picked}>
        {picked
          ? <Mascot mood="achievement" size={130} look={{ ...look, ...wearing(picked) }} reveal={picked} className="done-madi" />
          : <Lottie name="chest" className="done-chest" label="תיבת אוצר נפתחת" fallback={<Mascot mood="achievement" size={150} />} />}
      </Hero>
      <m.div className="done-copy" variants={stagger(0.2)} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title">סיימתם את המשימות של היום!</m.h1>
        {award.freezeEarned
          ? <m.p variants={rise} className="reward streak-freeze"><Lottie name="snowflake" className="freeze-flake" fallback={<Snowflake size={22} aria-hidden="true" />} />קיבלתם הקפאת רצף. היא שומרת על הרצף ביום שלא יוצא ללמוד בו.</m.p>
          : !offer && <m.p variants={rise} className="lead">כל הכבוד. מחר יחכו משימות חדשות.</m.p>}
        {offer && <m.div variants={rise} className="quests-done-choice"><ChestChoice ids={offer.ids} picked={picked} onPick={pick} title="ובתיבה גם חלק למדי. בחרו אחד:" /></m.div>}
      </m.div>
      <div className="done-actions" data-region="footer">
        {picked
          ? <><Button className="btn-block btn-lg" onClick={keep}>לשמור על מדי</Button><Button variant="ghost" className="btn-block" onClick={onNext}>המשך</Button></>
          : <Button className="btn-block btn-lg" variant={offer ? 'secondary' : 'primary'} onClick={onNext}>{offer ? 'לבחור אחר כך' : 'המשך'}</Button>}
      </div>
    </div>
  );
}

/** After the placement test: where each topic starts, then the first day of the streak. */
export function PlacementDone({ result, award, onExit }) {
  const days = useApp((s) => s.days);
  const freezes = useApp((s) => s.freezes);
  const unlocks = useNewUnlocks(null);
  const stages = ['result', unlocks.length > 0 && 'unlock', award.goalReached && 'goal', award.streakExtended && 'streak'].filter(Boolean);
  const [i, setI] = useState(0);
  const last = i + 1 >= stages.length;
  const nextStage = () => (last ? onExit() : setI(i + 1));
  if (stages[i] === 'unlock') return <UnlockMoment ids={unlocks} onNext={nextStage} />;
  if (stages[i] === 'goal') return <GoalStage onNext={nextStage} label={last ? 'ללוח שלי' : 'המשך'} />;
  if (stages[i] === 'streak') return <StreakStage streak={award.streak} days={days} freezes={freezes} onNext={nextStage} />;
  return (
    <div className="done-screen place-done">
      <Hero><Mascot mood="achievement" size={130} /></Hero>
      <m.div className="done-copy" variants={stagger(0.15)} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title">מצאנו את המדרגה שלכם!</m.h1>
        {/* Duolingo's result order: the title, the tiles, then the details (where each topic starts) */}
        <m.div className="stats" variants={stagger(0.05)} data-region="answers">
          <Stat tone="gold" icon={Zap} label="XP" value={result.xp} xpAt={0.5} />
          <Stat tone="good" icon={ChevronsUp} label="מדרגות" value={Object.values(result.results).reduce((a, r) => a + r.level, 0)} />
          <Stat tone="brand" icon={Timer} label="זמן" text={fmtTime(result.secs)} />
        </m.div>
        <m.ol variants={rise} className="place-list" aria-label="איפה מתחילים בכל נושא">
          {(result.topics ? result.topics.map((id) => TOPIC[id]).filter(Boolean) : placementTopicsFor(result.grade)).map((t) => {
            const L = result.results[t.id]?.level ?? 0; const top = t.levels.length;
            return (
              <li key={t.id} className={clsx('place-row', `ch-${t.color}`)}>
                <Stairs steps={top} done={L} label={`${L} מתוך ${top} מדרגות`} />
                <span className="place-text">
                  <b>{t.title}</b>
                  <span>{L >= top ? 'כל המדרגות פתוחות. נשארה החזרה על היחידה.' : `${L === 0 ? 'המדרגה הראשונה' : 'המדרגה הבאה'}: ${t.levels[L].title}`}</span>
                </span>
              </li>
            );
          })}
        </m.ol>
      </m.div>
      <div className="done-actions" data-region="footer"><Button className="btn-block btn-lg" onClick={nextStage} ref={focusQuietly}>{last ? 'ללוח שלי' : 'המשך'}</Button></div>
    </div>
  );
}
