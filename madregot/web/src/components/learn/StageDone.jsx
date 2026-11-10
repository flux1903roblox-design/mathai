// The end of a teaching stage (A understand, B worked examples, C solve together): a short, calm moment in the app's
// celebration language, lighter than a lesson's end (no confetti, no stat tiles, no streak screen): מדי, the stage that
// is done, what it earned as quiet pills (XP the first time, the streak), the stair's five stages with this one
// filled, and what comes next with one button. A quiet way back to the map, where the stair's ring has moved.
// When the stage reached the daily goal, the goal's own moment (GoalStage) comes first.
import { useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import { Zap, Flame, Snowflake, Check, Clock } from 'lucide-react';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';
import { Segments } from '@/components/ds.jsx';
import { STAGE_NAME, STAGE_MIN, STAGE_N } from '@/learn/recommend.ts';
import { STAIR_STAGES } from '@/lib/path.js';
import { DUR, enter } from '@/lib/motion.js';
import { play, haptic } from '@/lib/sound.js';
import GoalStage from './GoalStage.jsx';

const NEXT = { A: 'B', B: 'C', C: 'D' };
const GO = { B: 'לדוגמה הפתורה', C: 'לפתור יחד', D: 'לתרגול' };
const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: enter(DUR.slow) } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } };

/**
 * stage: 'A' | 'B' | 'C'; stair: the stair's title; award: what completeStage returned; steps: the stair's stages done
 * now (0..5); onNext: on to the next stage; onMap: back to the map.
 */
export default function StageDone(props) {
  const [goal, setGoal] = useState(!!props.award.goalReached);
  if (goal) return <GoalStage onNext={() => { setGoal(false); window.scrollTo?.({ top: 0 }); }} />;
  return <StageMoment {...props} />;
}

function StageMoment({ stage, stair, award, steps, onNext, onMap }) {
  const next = NEXT[stage];
  const ref = useRef(null);
  useEffect(() => { play('correct'); haptic('correct'); ref.current?.focus({ preventScroll: true }); }, []);
  const pills = [
    award.xp > 0 && { icon: Zap, tone: 'gold', label: `+${award.xp} XP` },
    award.streakRepaired
      ? { icon: Flame, tone: 'streak', label: `הרצף נשמר: ${award.streak} ימים` }
      : award.streakExtended && { icon: Flame, tone: 'streak', label: award.streak > 1 ? `${award.streak} ימים ברצף` : 'התחלתם רצף' },
    award.freezeEarned && { icon: Snowflake, tone: 'brand', label: 'קיבלתם הקפאת רצף' },
    award.questsDone && !award.freezeEarned && { icon: Check, tone: 'good', label: 'סיימתם את המשימות של היום' },
  ].filter(Boolean);
  return (
    <div className="done-screen stage-done" data-stage={stage}>
      <div className="done-hero stage-done-hero"><Mascot mood="happy" size={112} className="done-madi" /></div>
      <m.div className="done-copy" variants={stagger} initial="hidden" animate="show">
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
            {pills.map((b) => <span key={b.label} className={`done-earned tone-${b.tone}`}><b.icon size={16} aria-hidden="true" />{b.label}</span>)}
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
