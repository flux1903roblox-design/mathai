import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { Zap, Target, Timer, Flame, Snowflake, Moon, Star, Trophy, ChevronsUp, Footprints, Wrench } from 'lucide-react';
import { useApp, today, dayBefore, isShabbat } from '@/lib/store.js';
import Mascot from '@/components/Mascot.jsx';
import Stairs from '@/components/Stairs.jsx';
import Lottie from '@/components/Lottie.jsx';
import RewardBadge from '@/components/RewardBadge.jsx';
import { topicsFor } from '@/content/index.js';
import { Button } from '@/components/ui.jsx';

const DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const fmtTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
// Celebration content rises in one after another, once.
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };
const stagger = (delay = 0.25) => ({ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: delay } } });

/** Counts up from 0 once the card is on screen (a still number under reduced motion). */
function useCount(target) {
  const [v, setV] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setV(target)); return () => cancelAnimationFrame(id); }, [target]);
  return v;
}

function Stat({ tone, icon: Icon, label, value, prefix = '', suffix = '', text }) {
  const v = useCount(value ?? 0);
  return (
    <m.div variants={rise} className={clsx('stat', `stat-${tone}`)}>
      <span className="stat-label">{label}</span>
      <span className="stat-value"><Icon size={20} aria-hidden="true" /><span>{text ?? <>{prefix}<NumberFlow value={v} />{suffix}</>}</span></span>
    </m.div>
  );
}

export function Week({ days }) {
  const keys = []; let k = today();
  for (let i = 0; i < 7; i++) { keys.unshift(k); k = dayBefore(k); }
  return (
    <ol className="week" aria-label="השבוע האחרון">
      {keys.map((key, i) => {
        const d = days[key]; const on = (d?.lessons || 0) > 0 || (d && d.lessons == null && d.q > 0);
        const state = on ? 'on' : d?.frozen ? 'frozen' : isShabbat(key) ? 'rest' : 'off';
        const label = { on: 'תרגלתם', frozen: 'הקפאת רצף', rest: 'שבת', off: 'לא תרגלתם' }[state];
        return (
          <m.li key={key} className={clsx('week-day', state, key === today() && 'today')} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25 + i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}>
            <span className="week-dot" aria-hidden="true">{state === 'on' ? <Flame size={16} /> : state === 'frozen' ? <Snowflake size={16} /> : state === 'rest' ? <Moon size={14} /> : null}</span>
            <span className="week-name">{DAY[new Date(`${key}T12:00:00`).getDay()]}</span>
            <span className="visually-hidden">{label}</span>
          </m.li>
        );
      })}
    </ol>
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

export default function LessonDone({ result, award, topic, onExit, onAgain }) {
  const days = useApp((s) => s.days);
  const freezes = useApp((s) => s.freezes);
  const stages = ['summary', award.streakExtended && result.passed && 'streak', award.questsDone && 'quests'].filter(Boolean);
  const [i, setI] = useState(0);
  const stage = stages[i];
  const nextStage = () => (i + 1 < stages.length ? setI(i + 1) : onExit());
  const levelTitle = topic.levels[result.level - 1]?.title;

  if (!result.passed) {
    return (
      <div className={clsx('done-screen', `ch-${topic.color}`)}>
        <Mascot mood="encouraging" size={150} />
        <h1 className="done-title">כמעט! עוד קצת תרגול</h1>
        <p className="lead">במבחן הקפיצה מותרת טעות אחת. אפשר לנסות שוב, או להמשיך במסלול מהמקום שלכם.</p>
        <div className="done-actions">
          <Button className="btn-block btn-lg" onClick={onExit}>חזרה למפה</Button>
          <Button variant="secondary" className="btn-block" onClick={onAgain}>לנסות שוב</Button>
        </div>
      </div>
    );
  }

  if (stage === 'streak') return <StreakStage streak={award.streak} days={days} freezes={freezes} onNext={nextStage} />;

  if (stage === 'quests') {
    return (
      <div className="done-screen quests-done-screen">
        <Hero>
          <Lottie name="chest" className="done-chest" label="תיבת אוצר נפתחת" fallback={<Mascot mood="achievement" size={150} />} />
        </Hero>
        <m.div className="done-copy" variants={stagger(0.2)} initial="hidden" animate="show">
          <m.h1 variants={rise} className="done-title">סיימתם את המשימות של היום!</m.h1>
          {award.freezeEarned
            ? <m.p variants={rise} className="reward streak-freeze"><Lottie name="snowflake" className="freeze-flake" fallback={<Snowflake size={22} aria-hidden="true" />} />קיבלתם הקפאת רצף. היא שומרת על הרצף ביום שתפספסו.</m.p>
            : <m.p variants={rise} className="lead">כל הכבוד. מחר יחכו משימות חדשות.</m.p>}
        </m.div>
        <div className="done-actions"><Button className="btn-block btn-lg" onClick={nextStage}>המשך</Button></div>
      </div>
    );
  }

  const title = result.kind === 'review' ? 'סיימתם חזרה על היחידה!' : result.kind === 'jump' ? 'קפצתם קדימה!' : result.perfect ? 'שיעור מושלם!' : 'השיעור הושלם!';
  // Medals only for what this lesson really earned.
  const badges = [
    award.unitDone && { icon: Trophy, label: `${topic.title}: היחידה הושלמה`, tone: 'gold' },
    !award.unitDone && award.nodeDone && { icon: Footprints, label: `${levelTitle}: המדרגה הושלמה`, tone: 'chapter' },
    result.kind === 'jump' && { icon: ChevronsUp, label: `עכשיו ב${levelTitle}`, tone: 'brand' },
    result.perfect && { icon: Star, label: 'בלי אף טעות', tone: 'gold' },
    result.fixed > 0 && { icon: Wrench, label: result.fixed === 1 ? 'תיקנתם טעות' : `תיקנתם ${result.fixed} טעויות`, tone: 'good' },
    award.goalReached && { icon: Zap, label: 'הגעתם ליעד היומי', tone: 'gold' },
  ].filter(Boolean);
  return (
    <div className={clsx('done-screen', `ch-${topic.color}`)}>
      <Hero>
        {award.unitDone && <Lottie name="trophy" className="done-trophy" label="גביע" fallback={null} />}
        {result.perfect && !award.unitDone && <Lottie name="stars" className="done-stars" decorative />}
        <Mascot mood={award.unitDone || result.perfect ? 'achievement' : 'excited'} size={award.unitDone ? 120 : 150} />
      </Hero>
      <m.div className="done-copy" variants={stagger(0.15)} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title">{title}</m.h1>
        {badges.length > 0 && (
          <m.div variants={rise} className="badges">
            {badges.map((b, k) => <RewardBadge key={b.label} {...b} delay={0.45 + k * 0.12} />)}
          </m.div>
        )}
        <m.div className="stats" variants={stagger(0.05)}>
          <Stat tone="gold" icon={Zap} label="XP" value={result.xp} prefix="+" />
          <Stat tone="good" icon={Target} label="דיוק" value={result.accuracy} suffix="%" />
          <Stat tone="brand" icon={Timer} label="זמן" text={fmtTime(result.secs)} />
        </m.div>
        {result.fixed > 0 && <m.p variants={rise} className="muted">כולל {result.fixed * 2} XP על תיקון {result.fixed === 1 ? 'טעות' : `${result.fixed} טעויות`}.</m.p>}
      </m.div>
      <div className="done-actions"><Button className="btn-block btn-lg" onClick={nextStage} autoFocus>המשך</Button></div>
    </div>
  );
}

/** After the placement test: where each topic starts, then the first day of the streak. */
export function PlacementDone({ result, award, onExit }) {
  const days = useApp((s) => s.days);
  const freezes = useApp((s) => s.freezes);
  const stages = ['result', award.streakExtended && 'streak'].filter(Boolean);
  const [i, setI] = useState(0);
  const last = i + 1 >= stages.length;
  const nextStage = () => (last ? onExit() : setI(i + 1));
  if (stages[i] === 'streak') return <StreakStage streak={award.streak} days={days} freezes={freezes} onNext={nextStage} />;
  return (
    <div className="done-screen place-done">
      <Hero><Mascot mood="achievement" size={130} /></Hero>
      <m.div className="done-copy" variants={stagger(0.15)} initial="hidden" animate="show">
        <m.h1 variants={rise} className="done-title">מצאנו את המדרגה שלכם!</m.h1>
        <m.ol variants={rise} className="place-list">
          {topicsFor(result.grade).map((t) => {
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
        <m.div className="stats" variants={stagger(0.05)}>
          <Stat tone="gold" icon={Zap} label="XP" value={result.xp} prefix="+" />
          <Stat tone="good" icon={ChevronsUp} label="מדרגות" value={Object.values(result.results).reduce((a, r) => a + r.level, 0)} />
          <Stat tone="brand" icon={Timer} label="זמן" text={fmtTime(result.secs)} />
        </m.div>
      </m.div>
      <div className="done-actions"><Button className="btn-block btn-lg" onClick={nextStage} autoFocus>{last ? 'ללוח שלי' : 'המשך'}</Button></div>
    </div>
  );
}

/** The streak number ticks up from yesterday's value to today's, over a living flame. */
function StreakStage({ streak, days, freezes, onNext }) {
  const [v, setV] = useState(Math.max(0, streak - 1));
  useEffect(() => { const t = setTimeout(() => setV(streak), 450); return () => clearTimeout(t); }, [streak]);
  return (
    <div className="done-screen streak-screen">
      <div className="streak-hero" aria-hidden="true">
        <Lottie name="flame" loop className="streak-lottie" still="middle" fallback={<span className="streak-big"><Flame size={120} strokeWidth={1.6} /></span>} />
      </div>
      <m.p className="streak-num" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.3 }}><NumberFlow value={v} /></m.p>
      <h1 className="done-title">{streak === 1 ? 'התחלתם רצף!' : `${streak} ימים ברצף!`}</h1>
      <Week days={days} />
      <p className="lead">שיעור אחד ביום שומר על הרצף, ובשבת הרצף לא נשבר.{freezes > 0 ? ` יש לכם ${freezes === 1 ? 'הקפאה אחת' : `${freezes} הקפאות`} למקרה שתפספסו יום.` : ''}</p>
      <div className="done-actions"><Button className="btn-block btn-lg" onClick={onNext} autoFocus>המשך</Button></div>
    </div>
  );
}
