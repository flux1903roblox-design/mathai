// The end of a teaching stage (A understand, B worked examples, C solve together): a short moment in the app's
// celebration language, lighter than a lesson's end (no confetti, no stat tiles): מדי jumps in and dances while a soft
// blue light turns behind him and small shapes fly out once (Celebrate, PRODUCT2-38), the stage that is done, what it
// earned (the XP the first time counts up in a gold pill and lands with a pop; the streak), the stair's five stages with
// this one filled, and what comes next with one button. A quiet way back to the map, where the stair's ring has moved.
// When the stage reached the daily goal, the goal's own moment (GoalStage) comes first. When it brought מדי a new piece
// (the first stage of all brings the first one, PRODUCT2-36), the unlock moment (UnlockStage) comes after this one,
// whichever way on the student picks, and a gold pill here says it is waiting. When it brought the streak to 3, 7 or
// 30 days for the first time, that milestone's moment (StreakStage) comes next. When it finished the day's three
// quests, the day's chest opens last, before the way picked, as at the end of a lesson (QuestsStage: the chest, the
// streak freeze, a piece for מדי to choose now or later, on the missions tab); a gold pill here says it is waiting
// (it had been a chip alone, the student council's round 3).
// The buttons are live from the first frame; under reduced motion nothing moves and the XP is simply there.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { Zap, Flame, Clock, Gift, PackageOpen } from 'lucide-react';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';
import { Segments } from '@/components/ds.jsx';
import { STAGE_NAME, STAGE_MIN, STAGE_N } from '@/learn/recommend.ts';
import { STAIR_STAGES } from '@/lib/path.js';
import { DUR, enter, entrance } from '@/lib/motion.js';
import { play, haptic } from '@/lib/sound.js';
import { useApp } from '@/lib/store.js';
import { streakMilestone } from '@/lib/streak.js';
import GoalStage from './GoalStage.jsx';
import Celebrate from './Celebrate.jsx';
import XpCount from './XpCount.jsx';
import StreakStage from './StreakStage.jsx';
import QuestsStage from './QuestsStage.jsx';
import { UnlockMoment, useNewUnlocks } from '@/lib/madiLook.js';

const NEXT = { A: 'B', B: 'C', C: 'D' };
/** The pill that says the day's chest opens next (the three quests are done). */
export const STAGE_CHEST = 'סיימתם את משימות היום: תיבה מחכה לכם';
const GO = { B: 'לדוגמה הפתורה', C: 'לפתור יחד', D: 'לתרגול' };
const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: enter(DUR.slow) } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } };

/**
 * stage: 'A' | 'B' | 'C'; stair: the stair's title; topic: its unit; award: what completeStage returned; steps: the
 * stair's stages done now (0..5); onNext: on to the next stage; onMap: back to the map.
 */
export default function StageDone(props) {
  const [goal, setGoal] = useState(!!props.award.goalReached);
  // a piece for stages earned by this stage, worked out once as the moment opens (lib/madiLook.js)
  const unlocks = useNewUnlocks(props.topic);
  // a streak milestone not shown before (3, 7, 30 days), worked out once too: its moment marks it as shown
  const [milestone] = useState(() => streakMilestone(props.award, useApp.getState().nudges?.streakSeen));
  // the moments after this one, in order, then the way the student picked
  const [then, setThen] = useState(null);
  const [step, setStep] = useState(0);
  if (goal) return <GoalStage onNext={() => { setGoal(false); window.scrollTo?.({ top: 0 }); }} />;
  const after = [unlocks.length > 0 && 'unlock', milestone && 'milestone', props.award.questsDone && 'quests'].filter(Boolean);
  const top = () => window.scrollTo?.({ top: 0 });
  const go = () => (step + 1 < after.length ? (setStep(step + 1), top()) : then());
  if (then && after[step] === 'unlock') return <UnlockMoment ids={unlocks} onNext={go} />;
  if (then && after[step] === 'milestone') {
    const { days, freezes } = useApp.getState();
    return <StreakStage streak={props.award.streak} repaired={!!props.award.streakRepaired} days={days} freezes={freezes} milestone={milestone} onNext={go} />;
  }
  if (then && after[step] === 'quests') return <QuestsStage award={props.award} onNext={go} />;
  const on = (fn) => () => (after.length ? (setThen(() => fn), top()) : fn());
  return <StageMoment {...props} onNext={on(props.onNext)} onMap={on(props.onMap)} gift={unlocks.length > 0} />;
}

function StageMoment({ stage, stair, award, steps, onNext, onMap, gift }) {
  const next = NEXT[stage];
  const ref = useRef(null);
  useEffect(() => { play('correct'); haptic('correct'); ref.current?.focus({ preventScroll: true }); }, []);
  const pills = [
    // the XP counts up once the pills are in view (rise, 0.15 s + 2 × 0.08 s), and lands with a pop
    award.xp > 0 && { icon: Zap, tone: 'gold', label: `+${award.xp} XP`, xp: award.xp, className: 'xp-pill' },
    award.streakRepaired
      ? { icon: Flame, tone: 'streak', label: `הרצף נשמר: ${award.streak} ימים` }
      : award.streakExtended && { icon: Flame, tone: 'streak', label: award.streak > 1 ? `${award.streak} ימים ברצף` : 'התחלתם רצף' },
    // the day's chest opens after this moment (QuestsStage), with the freeze it holds and a piece for מדי
    award.questsDone && { icon: PackageOpen, tone: 'gold', label: STAGE_CHEST },
    gift && { icon: Gift, tone: 'gold', label: 'מדי קיבל משהו חדש' },
  ].filter(Boolean);
  return (
    <div className="done-screen stage-done" data-stage={stage}>
      <div className="done-hero stage-done-hero">
        <Celebrate tone="brand"><Mascot mood="excited" size={112} className="done-madi" /></Celebrate>
      </div>
      <m.div className="done-copy" variants={stagger} initial={entrance('hidden')} animate="show">
        <m.div variants={rise} className="stage-done-head">
          <h1 ref={ref} tabIndex={-1} className="done-title stage-done-title">שלב {STAGE_N[stage]} הושלם!</h1>
          <p className="stage-done-label">{STAGE_NAME[stage]} · {stair}</p>
        </m.div>
        <m.div variants={rise} className="stage-done-climb">
          <Segments steps={STAIR_STAGES} done={steps} size="thick" className="stage-done-segs" label={`השלבים של המדרגה ${stair}`} valueText={`${steps} מתוך ${STAIR_STAGES} שלבים`} />
          <p className="climb-caption">{steps} מתוך {STAIR_STAGES} שלבים במדרגה</p>
        </m.div>
        {pills.length > 0 && (
          <m.div variants={rise} className="badges">
            {pills.map((b) => (
              <span key={b.label} className={clsx('done-earned', `tone-${b.tone}`, b.className)}>
                <b.icon size={b.xp ? 18 : 16} aria-hidden="true" />{b.xp ? <XpCount value={b.xp} delay={0.45} /> : b.label}
              </span>
            ))}
          </m.div>
        )}
        <m.p variants={rise} className="stage-done-next">
          <span>הבא: <b>{STAGE_NAME[next]}</b></span>
          <span className="stage-done-min"><Clock size={16} aria-hidden="true" />כ־{STAGE_MIN[next]} דקות</span>
        </m.p>
      </m.div>
      <div className="done-actions" data-region="footer">
        <Button className="btn-block btn-lg" onClick={onNext}>{GO[next]}</Button>
        <Button variant="ghost" className="btn-block done-quiet" onClick={onMap}>למפה</Button>
      </div>
    </div>
  );
}
