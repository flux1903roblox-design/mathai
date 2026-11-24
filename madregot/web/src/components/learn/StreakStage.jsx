// The streak's moment after a result (STUDENT-5), and its milestones (PRODUCT2-38).
// The ordinary moment: a living flame, the number ticking up from yesterday's value to today's (after a repair, from
// today's fresh start back to the whole streak), the week in a card, and what keeps the streak.
// A milestone (3, 7 and 30 days, lib/streak.js streakMilestone): each comes once, in place of the ordinary moment.
// מדי jumps in with the star held high, the light turns orange behind him, small shapes fly out, and an orange medal
// carries the number; one short line says what it means, with no countdown to the next one and nothing to lose. The
// week and what keeps the streak stay as they are. Its own sound and vibration (a level up). One button goes on, live
// from the first frame and focused, so Enter or one tap skips it; under reduced motion nothing moves.
// It is marked as shown as it opens (nudges.streakSeen), so it never comes again.
// Used by the end of a lesson (screens/LessonDone.jsx) and of a teaching stage (StageDone.jsx), never the first load.
import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { Flame, Snowflake, Moon } from 'lucide-react';
import { today, dayBefore, isActiveDay, useApp } from '@/lib/store.js';
import { isRestDay, isYomTov } from '@shared/restDays.js';
import Mascot from '@/components/Mascot.jsx';
import Lottie from '@/components/Lottie.jsx';
import { Button } from '@/components/ui.jsx';
import { SPRING, entrance } from '@/lib/motion.js';
import { play, haptic } from '@/lib/sound.js';
import Celebrate from './Celebrate.jsx';

const focusQuietly = (el) => { if (el) el.focus({ preventScroll: true }); };
const DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/** What each milestone means, in one calm line: what was done, never what could be lost. */
export const MILESTONE_LINE = {
  3: 'שלושה ימים של תרגול. מדי שמח איתכם.',
  7: 'שבעה ימים של תרגול. זה כבר הרגל.',
  30: 'שלושים ימים של תרגול. איזו דרך עשיתם!',
};

/** The last seven days: a flame for a day learned, a snowflake for a kept one, a moon for Shabbat or a holiday. */
export function Week({ days }) {
  const keys = []; let k = today();
  for (let i = 0; i < 7; i++) { keys.unshift(k); k = dayBefore(k); }
  return (
    <ol className="week" aria-label="השבוע האחרון">
      {keys.map((key, i) => {
        const d = days[key]; const on = isActiveDay(d);
        const state = on ? 'on' : d?.frozen ? 'frozen' : isRestDay(key) ? 'rest' : 'off';
        // a rest day says which (Shabbat or a holiday); a repaired day says the streak was kept
        const label = { on: 'תרגלתם', frozen: d?.frozen === 'repair' ? 'הרצף נשמר' : 'הקפאת רצף', rest: isYomTov(key) ? 'חג' : 'שבת', off: 'לא תרגלתם' }[state];
        return (
          <m.li key={key} className={clsx('week-day', state, key === today() && 'today')} initial={entrance({ scale: 0.6, opacity: 0 })} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.pop, delay: 0.25 + i * 0.05 }}>
            <span className="week-dot" aria-hidden="true">{state === 'on' ? <Flame size={16} /> : state === 'frozen' ? <Snowflake size={16} /> : state === 'rest' ? <Moon size={14} /> : null}</span>
            <span className="week-name">{DAY[new Date(`${key}T12:00:00`).getDay()]}</span>
            <span className="visually-hidden">{label}</span>
          </m.li>
        );
      })}
    </ol>
  );
}

/** מדי with the star held high, the orange light, and the medal with the number (a milestone's top). */
function MilestoneHero({ n }) {
  return (
    <div className="milestone-hero" aria-hidden="true">
      <Celebrate tone="streak"><Mascot mood="achievement" size={124} /></Celebrate>
      <m.span className="milestone-medal" initial={entrance({ scale: 0, rotate: -30 })} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.bounce, delay: 0.45 }}>
        <Flame size={22} strokeWidth={2.4} /><b>{n}</b>
      </m.span>
    </div>
  );
}

/**
 * streak: the streak now; repaired: this result kept it with an earned repair; days, freezes: from the store;
 * milestone: 3, 7 or 30 when this result reached one not shown before (lib/streak.js streakMilestone), else null.
 */
export default function StreakStage({ streak, repaired = false, days, freezes, onNext, milestone = null }) {
  // after a repair the number climbs from today's fresh start back to the whole streak
  const [v, setV] = useState(repaired ? 1 : Math.max(0, streak - 1));
  useEffect(() => { const t = setTimeout(() => setV(streak), 450); return () => clearTimeout(t); }, [streak]);
  useEffect(() => {
    if (!milestone) return;
    useApp.getState().markMilestone(milestone);
    play('levelup'); haptic('levelup');
  }, [milestone]);
  return (
    <div className={clsx('done-screen streak-screen', milestone && 'streak-milestone')} data-milestone={milestone || undefined}>
      {milestone ? <MilestoneHero n={streak} /> : (
        <>
          <div className="streak-hero" aria-hidden="true">
            <Lottie name="flame" loop className="streak-lottie" still="middle" fallback={<span className="streak-big"><Flame size={120} strokeWidth={1.6} /></span>} />
          </div>
          <m.p className="streak-num" initial={entrance({ scale: 0.6 })} animate={{ scale: 1 }} transition={{ ...SPRING.bounce, delay: 0.3 }}><NumberFlow value={v} /></m.p>
        </>
      )}
      <h1 className="done-title" id="streak-title">{streak === 1 ? 'התחלתם רצף!' : `${streak} ימים ברצף!`}</h1>
      {milestone && <p className="milestone-line" id="milestone-line">{MILESTONE_LINE[milestone]}</p>}
      {/* Duolingo's streak screen: the week in a card, and what keeps the streak written inside it */}
      <section className="streak-card" aria-label="השבוע">
        <Week days={days} />
        <p className="streak-card-text">{repaired
          ? `הרצף נשמר. ${streak} ימים ברצף.`
          : `שיעור אחד ביום, או שלב אחד בלימוד מדרגה, שומר על הרצף. בשבת ובחג הרצף נשמר.${freezes > 0 ? ` ${freezes === 1 ? 'יש לכם הקפאה אחת ליום שלא יוצא ללמוד בו.' : `יש לכם ${freezes} הקפאות לימים שלא יוצא ללמוד בהם.`}` : ''}`}</p>
      </section>
      <div className="done-actions" data-region="footer">
        <Button className="btn-block btn-lg" onClick={onNext} ref={focusQuietly} aria-describedby={milestone ? 'streak-title milestone-line' : undefined}>המשך</Button>
      </div>
    </div>
  );
}
