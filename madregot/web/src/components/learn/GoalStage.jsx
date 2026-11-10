// The daily goal, reached (STUDENT-7): its own short, calm moment on the way out of a lesson or a teaching stage,
// before the streak. A gold ring closes around מדי, today's XP rolls up, one line says a new goal starts tomorrow,
// and one button goes on. Its own sound and vibration; under reduced motion the ring is drawn whole at once.
import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { m, useReducedMotion } from 'motion/react';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';
import { useApp, today } from '@/lib/store.js';
import { DUR, EASE, enter } from '@/lib/motion.js';
import { play, haptic } from '@/lib/sound.js';

const focusQuietly = (el) => { if (el) el.focus({ preventScroll: true }); };
const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: enter(DUR.slow) } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } };

export default function GoalStage({ onNext, label = 'המשך' }) {
  const reduce = useReducedMotion();
  const todayXp = useApp((s) => s.days[today()]?.xp || 0);
  // the number rolls up from 0 once on screen (NumberFlow shows it still under reduced motion)
  const [xp, setXp] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setXp(todayXp)); return () => cancelAnimationFrame(id); }, [todayXp]);
  useEffect(() => { play('goal'); haptic('goal'); }, []);
  return (
    <div className="done-screen goal-stage">
      <div className="done-hero goal-hero">
        <div className="goal-ring">
          <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
            <circle className="goal-track" cx="100" cy="100" r="90" />
            <m.circle className="goal-arc" cx="100" cy="100" r="90" transform="rotate(-90 100 100)"
              initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }}
              transition={reduce ? { duration: 0 } : { duration: DUR.verySlow, ease: EASE.out, delay: 0.15 }} />
          </svg>
          <Mascot mood="achievement" size={108} className="goal-madi" />
        </div>
      </div>
      <m.div className="done-copy" variants={stagger} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title" id="goal-title">הגעתם ליעד היומי!</m.h1>
        <m.p variants={rise} className="goal-sub" id="goal-sub">
          <b className="goal-xp"><bdi dir="ltr"><NumberFlow value={xp} /> XP</bdi></b> היום. מחר מתחילים יעד חדש.
        </m.p>
      </m.div>
      <div className="done-actions" data-region="footer">
        <Button className="btn-block btn-lg" onClick={onNext} ref={focusQuietly} aria-describedby="goal-title goal-sub">{label}</Button>
      </div>
    </div>
  );
}
